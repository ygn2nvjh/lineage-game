import {StateDeltaEncoder,STATE_DELTAS_ENABLED} from '../online/state-delta.mjs';
import {SOLO_INPUT,normalizeInput} from '../online/solo-input.mjs';
import {DungeonHub} from './hub.mjs';
import {Game,createState,derive,distance} from '../core.mjs';
import {enableLargeDungeon} from '../online/room.mjs';
import {ADVENTURE_VERSION,adventureCatalog,saveSolo,restoreSolo} from '../online/adventure.mjs';
const deny=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const economy=p=>JSON.stringify([p.gold,p.xp,p.level,p.inventory,p.equipment,p.warehouse,p.points,p.stats,p.deaths]);
const soloTypes={move:['frames','mapId'],goal:['x','y'],stop:[],attack:['target'],potion:[],heal:[],buy:['item','quantity'],sell:['item','quantity'],equip:['item','slot'],unequip:['slot'],deposit:['item','quantity'],withdraw:['item','quantity'],use:['item'],allocate:['stat'],rest:[],depart:[],return:[],save:[],settings:['autoPotion','potionThreshold'],pause:['paused']};
export class AdventureService extends DungeonHub{
 constructor(ctx,env){const c=adventureCatalog(env.SEED);enableLargeDungeon(c);super(ctx,{...env,SEED:c});this.stateStreams=new WeakMap();this.stateDeltasEnabled=env.ENABLE_STATE_DELTAS===true||STATE_DELTAS_ENABLED;}
 setSolo(u,p){const g=new Game(this.env.SEED,p);g.logs=u.solo?.logs||[];u.solo=saveSolo(g);u.soloPaused=false;u.soloMove=null;u.p=structuredClone(u.solo.p);u.soloAt=Date.now();}
 advanceSolo(u,now){
  if(u.room||!u.solo)return;
  let remaining=Math.min(.5,Math.max(0,(now-(u.soloAt||now))/1000));
  if(now-(u.soloAt||now)>5000){remaining=0;u.soloMove=null;}
  u.soloAt=now;if(u.soloPaused||!remaining)return;
  const before=economy(u.p),g=restoreSolo(this.env.SEED,u.solo),mapId=g.p.mapId;
  if(now-(u.lastSeen||0)>45000)g.cancelCombat();
  let at=now-remaining*1000;
  while(remaining>1e-6){
   const move=u.soloMove,active=move&&at<move.expiresAt;
   const dt=Math.min(.05,remaining,active?(move.expiresAt-at)/1000:Infinity);
   remaining-=dt;at+=dt*1000;
   // Simulation advances on server time; movement is applied only from validated input frames.
   g.update(dt,{x:0,y:0});
   if(g.p.mapId!==mapId){u.soloMove=null;break;}
  }
  u.recentEvents=[...(u.recentEvents||[]),...g.events.map(e=>({...e,id:u.soloEventId=(u.soloEventId||0)+1}))].slice(-32);
  u.solo=saveSolo(g);u.p=structuredClone(g.p);if(economy(g.p)!==before)this.needsSettlement=true;
 }

 command(owner,b){const now=Date.now(),action=b.action;let u=this.users[owner];
  if(action==='create'&&!u){for(const k of Object.keys(b))if(!['action','id','seq','since','requestId','name','sex','allocation'].includes(k))deny('不接受角色數值',400);if(Object.keys(this.users).length>=30)deny('測試訪客容量已滿',503);let p;try{p=createState(this.env.SEED,b.name,b.sex,b.allocation??this.env.SEED.rules.defaultAllocation);}catch(e){deny(e.message,400);}u=this.users[owner]={id:crypto.randomUUID(),p,room:null,lastSeq:0,lastSeen:now};this.setSolo(u,p);this.revision++;return {data:this.view(owner),changed:true,save:true};}
  if(!u)return super.command(owner,b);
  if(action!=='ping'){if(!u.solo&&!u.room)this.setSolo(u,u.p);this.advanceSolo(u,now);u.lastSeen=now;}
  const mutation=!['state','ping','create'].includes(action);if(mutation&&(!Number.isSafeInteger(b.seq)||b.seq<1))deny('缺少指令序號',400);
  // Validate before replay detection too: no client-provided character snapshots.
  if(Object.hasOwn(soloTypes,action)){for(const k of Object.keys(b))if(!['id','action','seq','since','requestId',...soloTypes[action]].includes(k))deny('不接受角色數值或額外欄位',400);}
  if(action==='move'&&(typeof b.mapId!=='string'||!Array.isArray(b.frames)||!b.frames.length||b.frames.length>16||b.frames.some(f=>!f||Object.keys(f).some(k=>!['inputId','x','y','dt'].includes(k))||!Number.isSafeInteger(f.inputId)||f.inputId<1||!Number.isFinite(f.x)||!Number.isFinite(f.y)||Math.abs(f.x)>1||Math.abs(f.y)>1||!Number.isFinite(f.dt)||f.dt<0||f.dt>.050001)))deny('移動方向或序號無效',400);
  if(action==='settings'&&(typeof b.autoPotion!=='boolean'||!Number.isInteger(b.potionThreshold)||b.potionThreshold<10||b.potionThreshold>90))deny('補給設定無效',400);
  if(action==='pause'&&typeof b.paused!=='boolean')deny('暫停設定無效',400);
  if(mutation&&b.seq<=(u.lastSeq||0))return {data:this.view(owner),changed:false,save:false};
  if(action==='settings'&&u.room){const m=this.rooms[u.room]?.members.find(m=>m.owner===owner);if(!m)deny('房間成員不存在');m.game.p.settings={autoPotion:b.autoPotion,potionThreshold:b.potionThreshold};m.lastSeq=b.seq;u.lastSeq=b.seq;this.revision++;return {data:this.view(owner),changed:true,save:true};}
  if(['createRoom','join'].includes(action)&&!u.room&&u.p.mapId!=='town')deny('請先回村莊，到冒險者公會組隊');
  if(Object.hasOwn(soloTypes,action)&&!u.room){
   const g=restoreSolo(this.env.SEED,u.solo);let result={ok:true},movedMap=false;
   if(action==='settings')g.p.settings={autoPotion:b.autoPotion,potionThreshold:b.potionThreshold};
   if(action==='pause'){u.soloPaused=b.paused;u.soloMove=null;}
   if(action==='move'){
    if(b.mapId!==g.p.mapId)return {data:this.view(owner),changed:false,save:false};
    if(u.soloPaused||g.deathPending||g.p.hp<=0)deny('目前無法移動');
    const frames=b.frames.filter(f=>f.inputId>(u.lastMoveId||0));let previous=u.lastMoveId||0;
    for(const f of frames){if(f.inputId<=previous)deny('移動序號順序無效',400);previous=f.inputId;}
    const budget=u.moveBudget||{at:now,credit:.25},credit=Math.min(.25,budget.credit+Math.max(0,now-budget.at)/1000),duration=frames.reduce((n,f)=>n+f.dt,0);
    if(duration>credit+.005)deny('移動時間超出合理範圍',400);
    if(frames.length){g.cancelCombat();g.moving=false;const d=g.derived,speed=g.rules.movement.playerSpeed*(d.weight>d.maxWeight?.5:1);for(const f of frames){const input=normalizeInput(f);if(g.swing<=0)g.moving=g.move(g.p,input.x,input.y,speed,f.dt);u.lastMoveId=f.inputId;u.soloMove={id:f.inputId,...input,expiresAt:now+SOLO_INPUT.leaseMs};if(g.cooldowns.transition<=0&&distance(g.p,g.map.exit)<=g.map.exit.radius){g.travelExit();u.lastMoveId=frames.at(-1).inputId;u.soloMove=null;movedMap=true;break;}}u.moveBudget={at:now,credit:credit-duration};}
   }

   if(['goal','stop','attack','depart','return'].includes(action))u.soloMove=null;
   if(action==='goal'){if(!Number.isFinite(b.x)||!Number.isFinite(b.y))deny('移動位置無效',400);result=g.setGoal({x:b.x,y:b.y});}
   if(action==='stop')g.cancelCombat();if(action==='attack'){const e=g.enemies.find(e=>e.id===b.target&&!e.dead);if(!e)deny('請選擇存活怪物');g.target=e.id;g.autoAttack=true;g.goal=null;}
   if(action==='potion')result=g.useItem('red_potion');if(action==='heal')result=g.heal();
   if(action==='buy')result=g.buy(this.env.SEED.shops.find(s=>s.mapId===g.p.mapId)?.id,b.item,b.quantity??1);
   if(action==='sell')result=g.sell(b.item,b.quantity??1);if(action==='equip')result=g.equip(b.item,b.slot??null);if(action==='unequip')result=g.unequip(b.slot);
   if(action==='deposit')result=g.deposit(b.item,b.quantity??1);if(action==='withdraw')result=g.withdraw(b.item,b.quantity??1);if(action==='use')result=g.useItem(b.item);if(action==='allocate')result=g.allocate(b.stat);if(action==='rest')result=g.rest();
   if(action==='depart'){if(!g.map.safe)deny('已在野外');result=g.setGoal(g.map.exit);}
   if(action==='return'){if(g.map.safe)deny('已在村莊');result=g.p.inventory.return_scroll?g.useItem('return_scroll'):g.setGoal(g.map.exit);}
   if(result?.ok===false)deny(result.message);u.solo=saveSolo(g);u.p=structuredClone(g.p);u.lastSeq=b.seq;this.revision++;
   return {data:action==='move'&&!movedMap?{movementAckOnly:true,version:ADVENTURE_VERSION,id:u.id,position:{x:g.p.x,y:g.p.y,mapId:g.p.mapId,hp:g.p.hp},movement:{id:u.lastMoveId||0},sequence:u.lastSeq,revision:this.revision,face:g.face}:this.view(owner),changed:action!=='move'||movedMap,save:movedMap||!['move','goal','stop','attack','pause'].includes(action)};
  }
  if(Object.hasOwn(soloTypes,action)&&!['goal','stop','attack','potion','heal'].includes(action)&&u.room)deny('請先離開副本房間再整備');
  const before=u.room,out=super.command(owner,b);if(mutation)u.lastSeq=b.seq;
  if(before&&!u.room)this.setSolo(u,u.p);
  if(u.room&&this.rooms[u.room]?.status==='lobby')u.soloAt=now;
  out.data=this.view(owner,b.since||0);return out;
 }
 advance(room,now){const before=room.members.map(m=>economy(m.game.p)).join('|');super.advance(room,now);if(room.members.map(m=>economy(m.game.p)).join('|')!==before)this.needsSettlement=true;}
 expire(now){const was=Object.values(this.users).filter(u=>u.room);super.expire(now);for(const u of was)if(!u.room)this.setSolo(u,u.p);}
 view(owner,since=0){const data=super.view(owner,since),u=this.users[owner];return {...data,version:ADVENTURE_VERSION,solo:u&&!u.room?u.solo:null,movement:u&&!u.room&&u.soloMove?{id:u.soloMove.id,active:Date.now()<u.soloMove.expiresAt}:null,lastMoveId:u?.lastMoveId||0,sequence:u?.room?data.sequence:u?.lastSeq||0,savedAt:this.lastSave,paused:!!u?.soloPaused&&!u?.room,events:u?.recentEvents||[],soloEventId:u?.soloEventId||0,unified:true};}
 resetStateStream(ws){this.stateStreams.delete(ws);}
 send(ws,message){
  if(message.data){message.data.version=ADVENTURE_VERSION;message.data.savedAt=this.lastSave;message.data.edge=ws.deserializeAttachment()?.edge||undefined;}
  if(this.stateDeltasEnabled&&ws.deserializeAttachment()?.stateDeltas&&message.data&&Object.hasOwn(message.data,'player')&&Object.hasOwn(message.data,'room')){
   let stream=this.stateStreams.get(ws);if(!stream){stream=new StateDeltaEncoder();this.stateStreams.set(ws,stream);}
   return super.send(ws,{...message,...stream.encode(message.data)});
  }
  return super.send(ws,message);
 }
 connectedOwners(){return new Set(this.sockets().filter(s=>s.readyState===1).map(s=>s.deserializeAttachment()?.owner).filter(Boolean));}
 soloNeedsTicks(u){return !!u.solo&&!u.soloPaused&&(u.p.mapId!=='town'||(u.soloMove&&Math.hypot(u.soloMove.x,u.soloMove.y)>0&&Date.now()<u.soloMove.expiresAt)||u.solo.goal||u.solo.deathPending>0||u.p.hp<derive(u.p,this.env.SEED).maxHp||u.p.mp<derive(u.p,this.env.SEED).maxMp);}
 hasActiveRoom(){if(super.hasActiveRoom())return true;const connected=this.connectedOwners();return Object.entries(this.users).some(([owner,u])=>connected.has(owner)&&!u.room&&this.soloNeedsTicks(u));}
 broadcast(activeOnly=false){for(const ws of this.sockets()){const a=ws.deserializeAttachment();if(!a?.owner)continue;const u=this.users[a.owner],data=this.view(a.owner,a.since);if(activeOnly&&!data.room&&!a.lastRoom&&(!u?.solo||!u.activeSolo))continue;a.lastRoom=data.room?.code||null;this.send(ws,{push:true,data});a.since=data.room?.eventId||0;ws.serializeAttachment(a);}}
 async step(){try{const now=Date.now(),connected=this.connectedOwners();for(const [owner,u]of Object.entries(this.users)){u.activeSolo=connected.has(owner)&&!u.room&&this.soloNeedsTicks(u);if(u.activeSolo){u.lastSeen=now;this.advanceSolo(u,now);}}
  for(const room of Object.values(this.rooms)){for(const m of room.members)if(connected.has(m.owner))m.lastSeen=now;this.advance(room,now);}this.expire(now);this.revision++;
  if(this.needsSettlement||now-this.lastSave>5000){await this.persist();this.needsSettlement=false;}this.broadcast(true);if(!this.hasActiveRoom()){await this.persist();this.stop();}
 }catch{this.stop();for(const ws of this.sockets())ws.close(1011,'Cloud save unavailable');this.users=await this.ctx.storage.get('users')||{};this.rooms=await this.ctx.storage.get('rooms')||{};}}
}
