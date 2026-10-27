import {Game,derive,distance} from '../core.mjs';
import {World} from '../world.mjs';
import {loadActorArt} from '../actor-art.mjs';
import {loadWorldArt} from '../world-art.mjs';
import {ONLINE,dungeonCatalog,restoreGame} from './room.mjs';
const online$=id=>document.getElementById(id),onlineEsc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let onlinePass=localStorage.getItem('lineage-online-guest-v1');
if(!/^og_[a-f0-9]{64}$/.test(onlinePass||'')){onlinePass='og_'+[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem('lineage-online-guest-v1',onlinePass);}
let onlineReceivedAt=0,onlineGoalPending=false;
let onlineState=null,onlineWorld,onlineGame,onlineTarget=null,onlinePanel=null,onlineSeq=0,onlineBusy=false,onlineQueue=Promise.resolve(),onlineLastEvent=0,onlineRoomCode=null,onlineLastFrame=0,onlineLastInput=0,onlineInput={x:0,y:0},onlineSmooth=new Map();
const onlineMetrics={requests:0,sent:0,received:0,read:0,written:0,rtt:[],errors:0};
function onlineNotice(t){online$('toast').textContent=t;online$('toast').hidden=false;online$('systemMessages').classList.add('has-toast');setTimeout(()=>{online$('toast').hidden=true;online$('systemMessages').classList.remove('has-toast');},4000);online$('panelNotice').textContent=t;online$('panelNotice').hidden=!onlinePanel;}
async function onlineRequest(action,extra={}){
 const seq=++onlineSeq,body=JSON.stringify({action,seq,since:onlineLastEvent,requestId:crypto.randomUUID(),...extra});const began=performance.now();onlineMetrics.requests++;onlineMetrics.sent+=new TextEncoder().encode(body).length;
 const response=await fetch('/api/online',{method:'POST',headers:{'content-type':'application/json','x-online-pass':onlinePass},body,signal:AbortSignal.timeout(12000)});const text=await response.text();onlineMetrics.received+=new TextEncoder().encode(text).length;onlineMetrics.rtt.push(Math.round(performance.now()-began));onlineMetrics.rtt=onlineMetrics.rtt.slice(-120);let db;try{db=JSON.parse(response.headers.get('x-online-db')||'{}');}catch{}onlineMetrics.read+=db?.read||0;onlineMetrics.written+=db?.written||0;
 const data=JSON.parse(text);if(!response.ok){onlineMetrics.errors++;throw Error(data.error||'連線失敗');}onlineState=data;onlineReceivedAt=performance.now();onlineSeq=Math.max(onlineSeq,data.sequence||0);onlineAccept();return data;
}
function onlineSend(action,extra={}){const result=onlineQueue.catch(()=>{}).then(()=>onlineRequest(action,extra));onlineQueue=result;return result.catch(e=>{onlineNotice(e.message);throw e;});}
function onlineAccept(){
 const room=onlineState.room,self=room?.members.find(m=>m.self),p=self?.game.p||onlineState.player;
 if(!p){onlineOpen('create');return;}
 if(onlineWorld){
  if(self&&room.status!=='lobby'){
   if(onlineRoomCode!==room.code){onlineSmooth.clear();onlineLastEvent=0;onlineRoomCode=room.code;}
   onlineGame=restoreGame(dungeonCatalog(LINEAGE_SEED),self.game,structuredClone(room.enemies));onlineGame.party=structuredClone(room.members.filter(m=>!m.self));onlineGame.enemies.forEach(e=>{e.active=!!e.active;});
   for(const e of room.events||[])if(e.id>onlineLastEvent)onlineWorld.particle(e);onlineLastEvent=room.eventId;
  }else{onlineRoomCode=null;onlineGame=new Game(LINEAGE_SEED,p);}
  onlineGame.target=onlineTarget;onlineHud();
 }
 if(onlinePanel==='guild'||onlinePanel==='stats')onlineOpen(onlinePanel);
 if(room&&['cleared','failed'].includes(room.status)&&onlinePanel!=='guild')onlineOpen('guild');
}
function onlineHud(){const p=onlineGame.p,d=onlineGame.derived,room=onlineState.room;online$('hud').hidden=false;online$('controls').hidden=false;online$('journey').hidden=false;online$('playerName').textContent=`Lv.${p.level} ${p.name}・雲端訪客`;
 for(const [id,value,max]of [['hp',p.hp,d.maxHp],['mp',p.mp,d.maxMp]]){const el=online$(id+'Fill')||online$(id+'Bar');if(el)el.style.width=`${100*value/max}%`;const t=online$(id+'Value');if(t)t.textContent=`${Math.ceil(value)} / ${max}`;}
 online$('mapName').textContent=room&&room.status!=='lobby'?'公會墓園':'暮色村莊';online$('goldValue').textContent=p.gold;online$('acValue').textContent=d.ac;online$('weightValue').textContent=Math.round(d.weight/d.maxWeight*100)+'%';online$('xpValue').textContent='EXP '+p.xp;online$('zoneLabel').textContent=`${room?room.members.length+'/'+room.capacity+'人':'雲端訪客'} · RTT ${onlineMetrics.rtt.at(-1)||0}ms`;
 online$('journeyLabel').textContent=room?.status==='combat'?'點地移動，點怪物選取後攻擊':room?.status==='cleared'?'通關！獎勵已存入雲端':room?.status==='failed'?'隊伍倒下，可返回村莊再試':'前往冒險者公會，建立或加入房間';online$('journeyAction').textContent='公會';online$('potionButton').innerHTML='紅水<br>'+ (p.inventory.red_potion||0);online$('attackButton').innerHTML=onlineGame.autoAttack?'⚔<br>停止':'⚔<br>攻擊';online$('saveStatus').textContent='☁ 雲端測試角色 · 單人角色另行保留';}
function onlineOpen(type){onlinePanel=type;onlineWorld?.clearDrag();onlineInput={x:0,y:0};online$('panel').hidden=false;online$('panelTabs').hidden=true;online$('panelEyebrow').textContent='ADVENTURERS GUILD';online$('panelTitle').textContent=type==='stats'?'雲端角色':'冒險者公會';const r=onlineState?.room,p=onlineState?.player;
 if(type==='create'){online$('panelBody').innerHTML='<p class="pause-note">建立雲端訪客測試角色；原本單人角色不受影響。</p><label>名稱 <input id="onlineName" maxlength="12" value="冒險者"></label><label>造型 <select id="onlineSex"><option value="male">男騎士</option><option value="female">女騎士</option></select></label><button id="onlineCreate">訪客開始</button><p class="subtle">角色由伺服器保存。此訪客尚未綁定Google／Apple，清除瀏覽器資料可能失去存取資格。</p>';online$('onlineCreate').onclick=()=>onlineSend('create',{name:online$('onlineName').value,sex:online$('onlineSex').value}).then(()=>onlineOpen('guild')).catch(()=>{});return;}
 if(type==='stats'){const d=derive(p,LINEAGE_SEED);online$('panelBody').innerHTML=`<h3>${onlineEsc(p.name)} · Lv.${p.level}</h3><p>HP ${Math.ceil(p.hp)} / ${d.maxHp} · MP ${Math.ceil(p.mp)} / ${d.maxMp}</p><p>傷害 ${d.damageMin}～${d.damageMax} · 防禦 ${d.defense}</p><p>金幣 ${p.gold} · 經驗 ${p.xp} · 倒下 ${p.deaths} 次</p><p class="subtle">副本角色與獎勵保存在雲端，與原本的單人角色分開。</p>`;return;}
 online$('panelBody').innerHTML=`<p class="pause-note">2／4人墓園測試 · 不需門票與等級。開啟公會面板不會暫停多人戰鬥。</p>${r?`<div class="summary"><strong>房號 ${r.code}</strong><span>${({lobby:'等待隊友',combat:'冒險中',cleared:'已通關・已存檔',failed:'隊伍倒下'})[r.status]}</span></div>${r.members.map(m=>`<p>${m.id===r.leader?'隊長 ':''}${onlineEsc(m.name)} · HP ${Math.ceil(m.game.p.hp)} ${m.connected?'':'（暫時斷線）'}</p>`).join('')}<div class="button-grid">${r.status==='lobby'&&r.leader===onlineState.id?`<button data-online="start" ${r.members.length<2?'disabled':''}>隊長開始副本</button>`:''}${r.status==='combat'?'<button id="onlineContinue">繼續冒險</button>':''}<button data-online="leave">離開副本・回村莊</button></div>${r.status==='cleared'?'<p>本次通關獎勵已自動保存，重新整理不會重複領取。</p>':''}`:`<h3>建立房間</h3><div class="button-grid"><button data-online="createRoom" data-capacity="2">雙人副本</button><button data-online="createRoom" data-capacity="4">四人副本</button></div><h3>加入朋友</h3><input id="onlineCode" maxlength="6" placeholder="輸入六碼房號" autocomplete="off"><button id="onlineJoin">加入房間</button>`}<p class="subtle">訪客身分保存在此瀏覽器，角色資料在雲端。Google／Apple綁定尚未開放。刷新可重新連回；離線超過45秒將停止自動攻擊。</p><details><summary>連線量測</summary><p>請求 ${onlineMetrics.requests} 次 · JSON收 ${Math.round(onlineMetrics.received/1024)} KB／送 ${Math.round(onlineMetrics.sent/1024)} KB<br>資料列讀 ${onlineMetrics.read}／寫 ${onlineMetrics.written}<br>往返 ${onlineMetrics.rtt.at(-1)||0} ms（不含等待下次同步）</p></details><a href="https://lineage-first-expedition.pearlymoth33.chatgpt.site">返回原本單人遊戲</a>`;
 online$('onlineJoin')?.addEventListener('click',()=>onlineSend('join',{code:online$('onlineCode').value}).catch(()=>{}));online$('onlineContinue')?.addEventListener('click',onlineClose);
 online$('panelBody').querySelectorAll('[data-online]').forEach(b=>b.onclick=()=>onlineSend(b.dataset.online,b.dataset.capacity?{capacity:Number(b.dataset.capacity)}:{}).then(()=>{if(b.dataset.online==='start')onlineClose();}).catch(()=>{}));
}
function onlineClose(){if(!onlineState?.player)return;onlinePanel=null;online$('panel').hidden=true;}
function onlineAttack(){if(!onlineState?.room||onlineState.room.status!=='combat'){onlineOpen('guild');return;}if(onlineGame.autoAttack){onlineSend('stop').catch(()=>{});return;}const target=onlineGame.enemies.find(e=>e.id===onlineTarget&&!e.dead)||onlineGame.nearest();if(target){onlineTarget=target.id;onlineSend('attack',{target:target.id}).catch(()=>{});}}
function onlinePoint(point){if(onlinePanel||onlineState?.room?.status!=='combat')return;if(distance(point,onlineGame.map.exit)<50){onlineOpen('guild');return;}const enemy=onlineGame.enemies.find(e=>!e.dead&&distance(e,point)<40);if(enemy){onlineTarget=enemy.id;onlineGame.target=enemy.id;onlineNotice('已選取怪物，按攻擊開始');}else onlineSend('goal',{x:Math.round(point.x),y:Math.round(point.y)}).catch(()=>{});}
async function onlinePoll(){if(!document.hidden&&!onlineBusy&&onlineState?.room&&['lobby','combat'].includes(onlineState.room.status)){onlineBusy=true;try{await onlineSend('state');}catch{}finally{onlineBusy=false;}}setTimeout(onlinePoll,onlineState?.room?.status==='combat'?ONLINE.combatPoll:ONLINE.lobbyPoll);}
function onlineFrame(now){const dt=Math.min(.05,(now-onlineLastFrame)/1000||0);onlineLastFrame=now;if(onlineGame&&onlineWorld){
 const input=onlineWorld.drag.x||onlineWorld.drag.y?onlineWorld.drag:onlineInput;
 if(!onlinePanel&&Math.hypot(input.x,input.y)>.15&&now-onlineLastInput>400){onlineLastInput=now;const p=onlineGame.p;if(!onlineGoalPending){onlineGoalPending=true;onlineSend('goal',{x:Math.round(p.x+input.x*90),y:Math.round(p.y+input.y*90)}).catch(()=>{}).finally(()=>onlineGoalPending=false);}}
 // Smooth server-approved positions for remote actors; no client damage, rewards or HP simulation.
 const age=Math.min(.5,(now-onlineReceivedAt)/1000),animate=a=>a?{...a,elapsed:a.elapsed+age}:a;
 const smooth=(key,obj)=>{let s=onlineSmooth.get(key);if(!s||Math.hypot(s.x-obj.x,s.y-obj.y)>160)s={...obj};const x=s.x+(obj.x-s.x)*Math.min(1,dt*12),y=s.y+(obj.y-s.y)*Math.min(1,dt*12);Object.assign(s,obj,{x,y});onlineSmooth.set(key,s);return s;};
 const p=onlineGame.p,enemies=onlineGame.enemies,party=onlineGame.party,animation=onlineGame.playerAnimation,death=onlineGame.deathPending,hurt=onlineGame.hurt;
 onlineGame.p=smooth('self',p);onlineGame.playerAnimation=animate(animation);onlineGame.hurt=Math.max(0,hurt-age);if(onlineGame.fallen)onlineGame.deathPending=.001;
 onlineGame.enemies=enemies.map(e=>smooth(e.id,{...e,animation:animate(e.animation),hurt:Math.max(0,e.hurt-age)}));
 if(party)onlineGame.party=party.map(m=>({...m,game:{...m.game,p:smooth(m.id,m.game.p),playerAnimation:animate(m.game.playerAnimation),hurt:Math.max(0,m.game.hurt-age)}}));
 onlineWorld.render(onlineGame,dt);onlineGame.p=p;onlineGame.enemies=enemies;onlineGame.party=party;onlineGame.playerAnimation=animation;onlineGame.deathPending=death;onlineGame.hurt=hurt;

 }requestAnimationFrame(onlineFrame);}
try{
 const [art,terrain]=await Promise.all([loadActorArt(),loadWorldArt()]);onlineWorld=new World(online$('game'),online$('stage'),onlinePoint,art,terrain);online$('loading').hidden=true;online$('createOverlay').hidden=true;online$('fatal').hidden=true;
 online$('closePanel').onclick=onlineClose;for(const id of ['shopButton','zoneButton','mapButton','systemButton','journeyAction'])online$(id).onclick=()=>onlineOpen('guild');online$('charButton').onclick=()=>onlineOpen('stats');online$('bagButton').onclick=()=>onlineOpen('stats');online$('attackButton').onclick=onlineAttack;online$('lockButton').onclick=()=>{onlineTarget=onlineGame?.nearest()?.id;onlineNotice('已選取最近怪物');};online$('potionButton').onclick=()=>onlineSend('potion').catch(()=>{});online$('healButton').onclick=()=>onlineSend('heal').catch(()=>{});
 online$('zoneButton').innerHTML='♜<br>公會';online$('shopButton').innerHTML='♜<br>公會';online$('contextAction').hidden=true;
 const stick=online$('stick');stick.onpointerdown=e=>{stick.setPointerCapture(e.pointerId);onlineMoveStick(e);};stick.onpointermove=e=>{if(stick.hasPointerCapture(e.pointerId))onlineMoveStick(e);};const clear=()=>{onlineInput={x:0,y:0};online$('knob').style.transform='';onlineWorld.clearDrag();};function onlineMoveStick(e){if(onlinePanel)return;const b=stick.getBoundingClientRect(),dx=e.clientX-b.x-b.width/2,dy=e.clientY-b.y-b.height/2,l=Math.max(30,Math.hypot(dx,dy));onlineInput={x:dx/l,y:dy/l};online$('knob').style.transform=`translate(${dx/l*20}px,${dy/l*20}px)`;}
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(ev,clear);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{clear();if(!document.hidden)onlineSend('state').catch(()=>{});});window.addEventListener('online',()=>onlineSend('state').catch(()=>{}));
 await onlineSend('state');if(onlineState.player)onlineOpen('guild');requestAnimationFrame(onlineFrame);setTimeout(onlinePoll,1000);
 Object.defineProperty(window,'lineageOnline',{value:{inspect:()=>structuredClone({state:onlineState,metrics:onlineMetrics,view:onlineWorld?{width:onlineWorld.width,height:onlineWorld.height}:null})}});
}catch(e){online$('loading').hidden=true;online$('fatal').hidden=false;online$('fatalMessage').textContent=e.message;}
