import {Game,createState,derive,distance} from '../core.mjs';
import {ART_MOTION} from '../art-config.mjs';
export const ONLINE={version:'online-0.1.0',maxPlayers:4,roomTtl:20*60*1000,reconnectMs:45000,combatPoll:500,lobbyPoll:2000,step:.05,maxCatchup:2};
export function dungeonCatalog(seed){
 const c=structuredClone(seed),field=c.maps.find(m=>m.id==='field');
 Object.assign(field,{name:'公會墓園',width:640,height:640,spawn:{x:320,y:510},exit:{x:320,y:600,radius:30,to:'town',arrival:{x:480,y:550}},regions:[{id:'crypt',name:'公會墓園',x:0,y:0,width:640,height:640,ground:'cemetery'}],paths:[{ground:'dirt',x:250,y:0,width:140,height:640}],scenery:[{id:'crypt',kind:'crypt',x:320,y:200,width:210,height:190,layer:'object'},{id:'stone1',kind:'tombstone',x:100,y:350,width:55,height:70,layer:'object'},{id:'stone2',kind:'tombstone',x:540,y:350,width:55,height:70,layer:'object'}],obstacles:[{x:240,y:100,width:160,height:90}],buildings:[],spawns:[{id:'bone1',monsterId:'skeleton',x:220,y:340},{id:'bone2',monsterId:'spartoi',x:420,y:340},{id:'bone3',monsterId:'skeleton_fighter',x:320,y:270}]});delete field.river;c.maps.find(m=>m.id==='town').exit.arrival={x:320,y:510};return c;
}
export function guestPlayer(seed,name,sex){
 const p=createState(seed,name,sex);p.inventory.short_sword=1;p.inventory.leather_armor=1;p.inventory.red_potion=10;p.equipment.weapon='short_sword';p.equipment.armor='leather_armor';p.hp=derive(p,seed).maxHp;return p;
}
const fields=['p','clock','cooldowns','target','autoAttack','goal','face','swing','hurt','attackSequence','playerAnimation','deathPending','playerHurtFacing','fallen','moving'];
export class DungeonGame extends Game{
 die(){this.deathPending=0;this.fallen=true;this.p.hp=0;this.p.deaths++;this.cancelCombat();this.playerAnimation=null;}
 defeat(e){if(e.dead||e.hp>0)return false;e.dead=true;e.fall=0;e.animation=null;e.active=false;e.respawn=Infinity;this.p.kills++;this.touch();return true;}
}
export function saveGame(g){return Object.fromEntries(fields.map(k=>[k,structuredClone(g[k]??null)]));}
export function restoreGame(c,s,enemies){const p=structuredClone(s.p);if(p.hp===0)p.hp=1;const g=new DungeonGame(c,p);for(const k of fields)if(k in s)g[k]=structuredClone(s[k]);g.enemies=enemies;g.events=[];return g;}
export function newRoom(seed,owner,id,player,code,capacity,now){
 const g=new DungeonGame(dungeonCatalog(seed),player);return {code,capacity,leader:id,status:'lobby',createdAt:now,expiresAt:now+ONLINE.roomTtl,lastAt:now,clock:0,members:[{owner,id,name:player.name,sex:player.sex,lastSeen:now,game:saveGame(g),lastSeq:0,receipts:[]}],enemies:[],settled:false,events:[],eventId:0,rng:crypto.getRandomValues(new Uint32Array(1))[0]||1};
}
// All combat methods and formulas come from Game; only party orchestration lives here.
export function tickRoom(room,seed,now){
 if(room.status!=='combat'){room.lastAt=now;return;}
 const c=dungeonCatalog(seed),games=room.members.map(m=>restoreGame(c,m.game,room.enemies));
 const random=()=>{room.rng=(Math.imul(room.rng,1664525)+1013904223)>>>0;return room.rng/4294967296;};for(const g of games)g.random=random;
 let remaining=Math.min(ONLINE.maxCatchup,Math.max(0,(now-room.lastAt)/1000));room.lastAt=now;
 const emit=(g,id)=>{for(const event of g.events.splice(0))room.events.push({...event,id:++room.eventId,actor:id});};
 while(remaining>1e-6){const dt=Math.min(ONLINE.step,remaining);remaining-=dt;room.clock+=dt;
  for(let i=0;i<games.length;i++){const g=games[i],m=room.members[i];
   if(now-m.lastSeen>ONLINE.reconnectMs){g.goal=null;g.autoAttack=false;g.playerAnimation=null;g.swing=0;g.moving=false;}
   if(!g.fallen)g.update(dt,{x:0,y:0},{enemies:false,travel:false});emit(g,m.id);
  }
  for(const e of room.enemies){
   e.hurt=Math.max(0,e.hurt-dt);e.swing=Math.max(0,e.swing-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.moving=false;if(e.dead){e.fall+=dt;continue;}
   const pending=games.find((g,i)=>room.members[i].id===e.attackTarget&&!g.fallen&&g.p.hp>0);
   if(e.animation){e.animation.elapsed+=dt;if(!e.animation.done&&e.animation.elapsed>=e.animation.impact){e.animation.done=true;if(pending){pending.resolveEnemyAttack(e);emit(pending,e.attackTarget);}}}
   const candidates=games.map((g,i)=>({g,m:room.members[i]})).filter(({g,m})=>g.p.hp>0&&!g.fallen&&now-m.lastSeen<=ONLINE.reconnectMs).sort((a,b)=>distance(e,a.g.p)-distance(e,b.g.p));
   const t=candidates[0];if(!t)continue;const g=t.g,m=g.index.monsters.get(e.monsterId);e.active=true;e.face=Math.atan2(g.p.y-e.y,g.p.x-e.x);
   if(e.swing>0)continue;
   if(distance(e,g.p)>g.rules.movement.attackRange-6)e.moving=g.navigate(e,g.p,m.speed,dt);
   else if(e.cooldown<=0){g.enemyAttack(e);e.attackTarget=t.m.id;}
  }
  if(room.enemies.every(e=>e.dead)){room.status='cleared';break;}
  if(games.every(g=>g.fallen)){room.status='failed';break;}
 }
 if(room.status==='cleared'&&!room.settled){
  for(const g of games){for(const e of room.enemies){const m=g.index.monsters.get(e.monsterId);g.grantExp(m.exp);g.p.gold=Math.min(1e9,g.p.gold+g.roll(m.goldMin,m.goldMax));}g.cancelCombat();}room.settled=true;
 }
 for(let i=0;i<games.length;i++)room.members[i].game=saveGame(games[i]);room.events=room.events.slice(-32);
}
export function startRoom(room,seed,now){
 if(room.status!=='lobby')throw Error('副本已開始或已結束');if(room.members.length<2)throw Error('至少兩人才能開始');
 const c=dungeonCatalog(seed);room.members.forEach((m,i)=>{const p=structuredClone(m.game.p);p.mapId='field';Object.assign(p,{x:240+i*50,y:510});p.hp=derive(p,c).maxHp;p.mp=derive(p,c).maxMp;const g=new DungeonGame(c,p);m.game=saveGame(g);m.lastSeen=now;});room.enemies=new DungeonGame(c,room.members[0].game.p).enemies;room.status='combat';room.lastAt=now;
}
export function roomView(room,owner,now,since=0){
 return {code:room.code,capacity:room.capacity,leader:room.leader,status:room.status,expiresAt:room.expiresAt,serverTime:now,eventId:room.eventId,events:room.events.filter(e=>e.id>since),clock:room.clock,enemies:room.enemies,members:room.members.map(m=>({id:m.id,name:m.name,sex:m.sex,connected:now-m.lastSeen<=ONLINE.reconnectMs,self:m.owner===owner,game:m.owner===owner?m.game:{p:{name:m.name,sex:m.sex,x:m.game.p.x,y:m.game.p.y,hp:m.game.p.hp},autoAttack:m.game.autoAttack,moving:m.game.moving,face:m.game.face,playerAnimation:m.game.playerAnimation,hurt:m.game.hurt,playerHurtFacing:m.game.playerHurtFacing,deathPending:m.game.deathPending,fallen:m.game.fallen}})),settled:room.settled};
}
