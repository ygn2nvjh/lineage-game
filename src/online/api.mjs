import {derive,validatePlayer} from '../core.mjs';
import {ONLINE,DungeonGame,guestPlayer,newRoom,dungeonCatalog,saveGame,restoreGame,startRoom,tickRoom,roomView} from './room.mjs';
const onlineFail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function guestOwner(request){const pass=request.headers.get('x-online-pass');if(!/^og_[a-f0-9]{64}$/.test(pass||''))onlineFail(401,'請先建立訪客身分');const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pass));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
const onlineJson=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...headers}});
export function onlineService(seed,clock=Date.now){return async function onlineApi(request,env){
 const began=performance.now(),metric={queries:0,read:0,written:0,dbMs:0,simulationMs:0,conflicts:0};const run=async stmt=>{const dbStart=performance.now();const r=await stmt;metric.dbMs+=performance.now()-dbStart;metric.queries++;metric.read+=r.meta?.rows_read||0;metric.written+=r.meta?.rows_written||0;return r;};const batchRun=async statements=>{const start=performance.now(),results=await env.DB.batch(statements);metric.dbMs+=performance.now()-start;return results;};const answer=(body,status=200)=>onlineJson(body,status,{'server-timing':`app;dur=${(performance.now()-began).toFixed(1)}`,'x-online-db':JSON.stringify(metric),'x-online-timing':JSON.stringify({appMs:performance.now()-began,dbMs:metric.dbMs,simulationMs:metric.simulationMs,conflicts:metric.conflicts})});
 try{
  if(request.method!=='POST')onlineFail(405,'請使用POST');const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)onlineFail(403,'不接受跨站操作');
  if(!request.headers.get('content-type')?.startsWith('application/json'))onlineFail(415,'請使用JSON');const raw=await request.text();if(raw.length>2048)onlineFail(413,'指令過大');let body;try{body=JSON.parse(raw);}catch{onlineFail(400,'指令格式錯誤');}
  if(!body||Array.isArray(body)||typeof body!=='object')onlineFail(400,'指令格式錯誤');
  if(body.action==='ping')return answer({version:ONLINE.version,pong:true,serverTime:clock(),edge:request.cf?.colo||null});
  if(!env.DB)onlineFail(503,'雲端資料庫尚未設定');
  const types={state:[],create:['name','sex'],createRoom:['capacity'],join:['code'],start:[],leave:[],goal:['x','y'],attack:['target'],stop:[],potion:[],heal:[]};if(!Object.hasOwn(types,body.action))onlineFail(400,'未知操作');for(const key of Object.keys(body))if(!['action','requestId','seq','since',...types[body.action]].includes(key))onlineFail(400,'不接受角色數值或額外欄位');
  if(body.since!==undefined&&(!Number.isSafeInteger(body.since)||body.since<0))onlineFail(400,'事件序號無效');
  const owner=await guestOwner(request),DB=env.DB;const getPlayer=async()=>{const q=await run(DB.prepare('SELECT p.*,r.revision AS cached_revision,r.data AS cached_data,r.expires_at AS cached_expires_at FROM online_players p LEFT JOIN online_rooms r ON r.code=p.room_code WHERE p.owner = ?').bind(owner).all());return q.results[0];};
  let record=await getPlayer();
  if(body.action==='create'){
   if(!record){const count=await run(DB.prepare('SELECT COUNT(*) AS n FROM online_players').all());if(count.results[0].n>=64)onlineFail(503,'本次測試訪客容量已滿');
    let p;try{p=guestPlayer(seed,body.name,body.sex);}catch(e){onlineFail(400,e.message);}const id=crypto.randomUUID();await run(DB.prepare('INSERT OR IGNORE INTO online_players (owner,id,data,room_code,created_at) VALUES (?,?,?,NULL,?)').bind(owner,id,JSON.stringify(p),clock()).run());record=await getPlayer();}
  }
  if(!record)return answer({version:ONLINE.version,player:null,room:null,limits:ONLINE});
  if(body.action!=='state'&&body.action!=='create'&&(!Number.isSafeInteger(body.seq)||body.seq<1))onlineFail(400,'缺少指令序號');
  if(body.action==='createRoom'){
   if(![2,4].includes(body.capacity))onlineFail(400,'請選擇2人或4人房');
   if(!record.room_code){await run(DB.prepare('DELETE FROM online_rooms WHERE expires_at<=?').bind(clock()).run());const count=await run(DB.prepare('SELECT COUNT(*) AS n FROM online_rooms').all());if(count.results[0].n>=64)onlineFail(503,'測試房間已滿，請稍後再試');const code=[...crypto.getRandomValues(new Uint8Array(6))].map(n=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[n%'ABCDEFGHJKMNPQRSTUVWXYZ23456789'.length]).join(''),now=clock(),room=newRoom(seed,owner,record.id,JSON.parse(record.data),code,body.capacity,now),tx=crypto.randomUUID();room.tx=tx;
    const results=await batchRun([DB.prepare('INSERT INTO online_rooms (code,revision,data,expires_at) SELECT ?,0,?,? WHERE (SELECT room_code FROM online_players WHERE owner=?) IS NULL').bind(code,JSON.stringify(room),room.expiresAt,owner),DB.prepare('UPDATE online_players SET room_code=? WHERE owner=? AND room_code IS NULL AND EXISTS (SELECT 1 FROM online_rooms WHERE code=? AND json_extract(data,\'$.tx\')=?)').bind(code,owner,code,tx)]);for(const r of results){metric.queries++;metric.read+=r.meta?.rows_read||0;metric.written+=r.meta?.rows_written||0;}record=await getPlayer();}
  }
  const code=body.action==='join'?String(body.code||'').trim().toUpperCase():record.room_code;
  if(body.action==='join'&&!/^[A-Z2-9]{6}$/.test(code))onlineFail(400,'房號格式錯誤');
  if(body.action==='join'&&record.room_code&&record.room_code!==code)onlineFail(409,'請先離開目前房間');
  if(!code)return answer({version:ONLINE.version,id:record.id,player:JSON.parse(record.data),room:null,limits:ONLINE});
  for(let attempt=0;attempt<8;attempt++){
   const cached=attempt===0&&record.room_code===code&&record.cached_data!==null&&record.cached_data!==undefined;
   const rows=cached?null:await run(DB.prepare('SELECT * FROM online_rooms WHERE code=?').bind(code).all()),row=cached?{revision:record.cached_revision,data:record.cached_data,expires_at:record.cached_expires_at}:rows.results[0],now=clock();
   if(!row||row.expires_at<=now){if(record.room_code===code)await run(DB.prepare('UPDATE online_players SET room_code=NULL WHERE owner=? AND room_code=?').bind(owner,code).run());if(body.action==='join')onlineFail(410,'房間不存在或已過期');return answer({id:record.id,player:JSON.parse(record.data),room:null,expired:true,limits:ONLINE});}
   const room=JSON.parse(row.data);let member=room.members.find(m=>m.owner===owner),joining=!member&&body.action==='join';
   if(!member&&!joining)onlineFail(403,'你不是房間成員');
   if(joining){if(room.status!=='lobby'||room.members.length>=room.capacity)onlineFail(409,'房間已滿或已開始');const g=new DungeonGame(dungeonCatalog(seed),JSON.parse(record.data));member={owner,id:record.id,name:g.p.name,sex:g.p.sex,lastSeen:now,game:saveGame(g),lastSeq:0};room.members.push(member);}
   if(body.action==='state'&&now-room.lastAt<120&&now-member.lastSeen<10000)return answer({version:ONLINE.version,id:record.id,player:member.game.p,room:roomView(room,owner,now,body.since||0),revision:row.revision,sequence:member.lastSeq,limits:ONLINE});
   const simulationStart=performance.now();tickRoom(room,seed,now);metric.simulationMs+=performance.now()-simulationStart;member.lastSeen=now;
   const mutable=!['state','create','createRoom','join'].includes(body.action),replayed=mutable&&body.seq<=member.lastSeq;
   if(mutable&&!replayed){
    if(body.action==='start'){if(room.leader!==member.id)onlineFail(403,'只有隊長能開始');try{startRoom(room,seed,now);}catch(e){onlineFail(409,e.message);}}
    else if(body.action==='leave'){room.members=room.members.filter(m=>m.owner!==owner);if(room.leader===member.id)room.leader=room.members[0]?.id||null;}
    else{
     if(room.status!=='combat')onlineFail(409,'副本尚未開始或已結束');const g=restoreGame(dungeonCatalog(seed),member.game,room.enemies);if(g.fallen||g.deathPending||g.p.hp<=0)onlineFail(409,'你已倒下，等待隊友或返回村莊');
     let out={ok:true};if(body.action==='goal'){if(!Number.isFinite(body.x)||!Number.isFinite(body.y))onlineFail(400,'移動位置無效');out=g.setGoal({x:body.x,y:body.y});}
     if(body.action==='attack'){const e=room.enemies.find(e=>e.id===body.target&&!e.dead);if(!e)onlineFail(409,'請先選擇存活怪物');g.target=e.id;g.autoAttack=true;g.goal=null;}
     if(body.action==='stop')g.cancelCombat();if(body.action==='potion')out=g.useItem('red_potion');if(body.action==='heal')out=g.heal();if(out?.ok===false)onlineFail(409,out.message);member.game=saveGame(g);
    }member.lastSeq=body.seq;
   }
   const tx=crypto.randomUUID();room.tx=tx;const rev=row.revision+1,leaving=body.action==='leave'&&!replayed,settlement=room.settled&&JSON.parse(row.data).settled!==true;
   const condition=joining?' AND (SELECT room_code FROM online_players WHERE owner=?) IS NULL':'';
   const stmt=DB.prepare('UPDATE online_rooms SET revision=?,data=? WHERE code=? AND revision=?'+condition).bind(rev,JSON.stringify(room),code,row.revision,...(joining?[owner]:[]));
   const batch=[stmt],guard='EXISTS (SELECT 1 FROM online_rooms WHERE code=? AND revision=? AND json_extract(data,\'$.tx\')=?)';
   if(joining)batch.push(DB.prepare('UPDATE online_players SET room_code=? WHERE owner=? AND '+guard).bind(code,owner,code,rev,tx));
   const townPlayer=g=>{const p=structuredClone(g.p),town=seed.maps.find(m=>m.id==='town');p.mapId='town';Object.assign(p,town.spawn);p.hp=Math.max(1,p.hp);validatePlayer(p,seed);return p;};
   if(settlement)for(const m of room.members)batch.push(DB.prepare('UPDATE online_players SET data=? WHERE owner=? AND room_code=? AND '+guard).bind(JSON.stringify(townPlayer(m.game)),m.owner,code,code,rev,tx));
   if(leaving)batch.push(DB.prepare('UPDATE online_players SET data=?,room_code=NULL WHERE owner=? AND room_code=? AND '+guard).bind(JSON.stringify(townPlayer(member.game)),owner,code,code,rev,tx));
   const results=await batchRun(batch);for(const r of results){metric.queries++;metric.read+=r.meta?.rows_read||0;metric.written+=r.meta?.rows_written||0;}if(results[0].meta.changes!==1){metric.conflicts++;continue;}
   return answer({version:ONLINE.version,id:record.id,player:leaving?townPlayer(member.game):member.game.p,room:leaving?null:roomView(room,owner,now,body.since||0),revision:rev,replayed,sequence:member.lastSeq,limits:ONLINE});
  }onlineFail(409,'操作衝突，請重試');
 }catch(error){env.onError?.(error);return answer({error:error.status?error.message:'服務暫時無法處理，請稍後重試'},error.status||500);}
};}
