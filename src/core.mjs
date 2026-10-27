import {clearLine,planRoute,riverBlocked} from './navigation.mjs';
import {ART_MOTION} from './art-config.mjs';
import {STAT_KEYS, SLOTS, compatibleSlots, indexCatalog} from './catalog.mjs';

export const SAVE_VERSION = 3;
export const STACK_LIMIT = 100000;
export const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clone = value => structuredClone(value);
const safeInt = (v,min=0,max=1e9) => Number.isSafeInteger(v)&&v>=min&&v<=max;
const reject = message => { throw new Error(message); };

export function expRequired(level,c) {
  return Math.round(c.rules.growth.baseExp * c.rules.growth.expMultiplier ** (level-1));
}

export function derive(p,c) {
  const r=c.rules, gear=Object.fromEntries(STAT_KEYS.map(k=>[k,0]));
  let defense=0;
  for(const id of Object.values(p.equipment)) {
    const i=c.items.find(x=>x.id===id); if(!i) continue;
    defense+=i.defense||0;
    for(const k of STAT_KEYS) gear[k]+=i.bonuses?.[k]||0;
  }
  const stats=Object.fromEntries(STAT_KEYS.map(k=>[k,Math.max(1,p.stats[k]+gear[k])]));
  const bonus=k=>Math.max(0,stats[k]-r.statBase);
  const weapon=c.items.find(x=>x.id===p.equipment.weapon);
  const damageBonus=Math.floor(bonus('str')*r.combat.damagePerStr+(p.level-1)*r.combat.damagePerLevel);
  const damageMin=(weapon?.damageMin||r.combat.baseDamage)+damageBonus;
  const damageMax=(weapon?.damageMax||r.combat.baseDamage)+damageBonus;
  const maxHp=Math.round(r.health.base+bonus('con')*r.health.perCon+(p.level-1)*r.health.perLevel);
  const maxMp=Math.round(r.mana.base+bonus('wis')*r.mana.perWis+(p.level-1)*r.mana.perLevel);
  const hpRegen=r.health.regenBase+bonus('con')*r.health.regenPerCon;
  const mpRegen=r.mana.regenBase+bonus('wis')*r.mana.regenPerWis;
  const discount=Math.min(r.economy.maxDiscount,bonus('cha')*r.economy.discountPerCha);
  const weight=c.items.reduce((sum,i)=>sum+(p.inventory[i.id]||0)*i.weight,0);
  const maxWeight=r.weight.base+stats.str*r.weight.perStr+stats.con*r.weight.perCon;
  const healing=Math.round(r.healing.base+bonus('int')*r.healing.perInt+p.level*r.healing.perLevel);
  const ac=r.combat.acBase-defense-Math.floor(bonus('dex')*r.combat.armorClassPerDex);
  return {stats,gear,defense,damageMin,damageMax,maxHp,maxMp,hpRegen,mpRegen,discount,weight,maxWeight,healing,ac};
}

export function buyPrice(item,p,c) {
  return Math.max(1,Math.ceil(item.price*(1-derive(p,c).discount)));
}

export function hitChance(p,monster,c,playerAttacking=true) {
  const r=c.rules, d=derive(p,c);
  const raw=playerAttacking?r.combat.baseHit+(d.stats.dex-r.statBase)*r.combat.hitPerDex+(p.level-monster.level)*r.combat.hitPerLevel:monster.hit-(d.stats.dex-r.statBase)*r.combat.evasionPerDex+(monster.level-p.level)*r.combat.hitPerLevel;
  return clamp(raw,r.combat.minHit,r.combat.maxHit);
}

export function createState(c,name='見習騎士',sex='male',allocation=c.rules.defaultAllocation) {
  name=String(name).trim();
  if(!name||name.length>12) reject('角色名稱請填寫 1～12 字');
  if(!['male','female'].includes(sex)) reject('角色性別無效');
  if(Object.keys(allocation).length!==6||STAT_KEYS.some(k=>!safeInt(allocation[k],0,c.rules.creationPoints))||Object.values(allocation).reduce((a,b)=>a+b,0)!==c.rules.creationPoints) reject('請分配全部創角點數');
  const p={name,sex,level:1,xp:0,gold:c.rules.startGold,stats:Object.fromEntries(STAT_KEYS.map(k=>[k,c.rules.baseStats[k]+allocation[k]])),points:0,inventory:clone(c.rules.startItems),warehouse:{},equipment:Object.fromEntries(SLOTS.map(s=>[s,null])),mapId:'town',...c.maps.find(m=>m.id==='town').spawn,hp:1,mp:0,kills:0,deaths:0,settings:{autoPotion:true,potionThreshold:50},milestones:{bought:false,equipped:false,fieldVisits:0,leveled:false,resupplied:false},playSeconds:0};
  const d=derive(p,c);p.hp=d.maxHp;p.mp=d.maxMp;return p;
}

export function validatePlayer(p,c) {
  if(!p||typeof p!=='object'||Array.isArray(p)) reject('存檔缺少角色資料');
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>12) reject('存檔角色名稱無效');
  if(!['male','female'].includes(p.sex)) reject('存檔性別無效');
  if(!safeInt(p.level,1,c.rules.growth.maxLevel)||!safeInt(p.xp,0,Number.MAX_SAFE_INTEGER)||!safeInt(p.gold)||!safeInt(p.points,0,10000)||!safeInt(p.kills)||!safeInt(p.deaths)) reject('存檔等級、經驗、金幣或計數無效');
  if(p.level<c.rules.growth.maxLevel&&p.xp>=expRequired(p.level,c)) reject('存檔經驗超出目前等級範圍');
  if(!p.stats||STAT_KEYS.some(k=>!safeInt(p.stats[k],1,999))) reject('存檔六項能力無效');
  const ids=new Map(c.items.map(i=>[i.id,i]));
  if(!p.inventory||typeof p.inventory!=='object'||Array.isArray(p.inventory)) reject('存檔背包無效');
  for(const [id,qty] of Object.entries(p.inventory)) if(!ids.has(id)||!safeInt(qty,1,STACK_LIMIT)) reject(`背包物品無效：${id}`);
  if(!p.warehouse||typeof p.warehouse!=='object'||Array.isArray(p.warehouse)) reject('存檔倉庫無效');
  for(const [id,qty] of Object.entries(p.warehouse))if(!ids.has(id)||!safeInt(qty,1,STACK_LIMIT))reject(`倉庫物品無效：${id}`);
  if(!p.equipment||typeof p.equipment!=='object'||Object.keys(p.equipment).length!==SLOTS.length) reject('存檔裝備欄位無效');
  for(const slot of SLOTS) {
    const id=p.equipment[slot];
    if(id!==null&&(!ids.has(id)||!compatibleSlots(ids.get(id)).includes(slot)||!(p.inventory[id]>0))) reject(`裝備引用無效：${slot}`);
  }
  for(const id of Object.values(p.equipment).filter(Boolean))if(Object.values(p.equipment).filter(x=>x===id).length>(p.inventory[id]||0))reject(`穿戴件數超過持有數量：${id}`);
  const map=c.maps.find(m=>m.id===p.mapId);
  if(!map||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<13||p.y<13||p.x>map.width-13||p.y>map.height-13) reject('存檔地圖或位置無效');
  if(!p.settings||typeof p.settings.autoPotion!=='boolean'||!safeInt(p.settings.potionThreshold,10,90)) reject('存檔自動補給設定無效');
  if(!p.milestones||['bought','equipped','leveled','resupplied'].some(k=>typeof p.milestones[k]!=='boolean')||!safeInt(p.milestones.fieldVisits)) reject('存檔旅程進度無效');
  const d=derive(p,c);
  if(!Number.isFinite(p.hp)||p.hp<0||p.hp>d.maxHp||!Number.isFinite(p.mp)||p.mp<0||p.mp>d.maxMp||!Number.isFinite(p.playSeconds)||p.playSeconds<0) reject('存檔生命、魔力或遊玩時間無效');
  return p;
}

export class Game {
  constructor(catalog,player,{random=Math.random}={}) {
    this.catalog=clone(catalog); this.index=indexCatalog(this.catalog);
    this.p=clone(validatePlayer(player,this.catalog)); this.random=random;
    this.events=[]; this.logs=[]; this.clock=0; this.revision=0;
    this.cooldowns={attack:0,potion:0,heal:0,transition:1,regen:0};
    this.target=null;this.autoAttack=false;this.goal=null;this.face=Math.PI/2;this.swing=0;this.hurt=0;
    this.routes=new WeakMap();this.attackSequence=0;this.playerAnimation=null;this.deathPending=0;this.playerHurtFacing='right';this.spawnEnemies();
    if(this.p.hp<=0)this.die();
    if(this.blocked(this.p.x,this.p.y))Object.assign(this.p,this.map.spawn);
  }
  get map(){return this.index.maps.get(this.p.mapId);}
  get derived(){return derive(this.p,this.catalog);}
  get rules(){return this.catalog.rules;}
  touch(){this.revision++;}
  roll(min,max){return min+Math.floor(this.random()*(max-min+1));}
  emit(type,text,extra={}) {
    const event={type,text,time:this.clock,...extra};this.events.push(event);
    this.logs.unshift(event);this.logs=this.logs.slice(0,50);this.touch();return event;
  }
  spawnEnemies(){
    this.enemies=this.map.spawns.map(s=>{
      const m=this.index.monsters.get(s.monsterId);
      return {id:s.id,monsterId:m.id,x:s.x,y:s.y,homeX:s.x,homeY:s.y,hp:m.hp,dead:false,respawn:0,active:false,cooldown:0,hurt:0,swing:0,moving:false,animation:null,fall:0,hurtFacing:'right'};
    });
  }
  snapshot(){return {schemaVersion:SAVE_VERSION,catalogVersion:this.catalog.version,savedAt:new Date().toISOString(),player:clone(this.p)};}
  blocked(x,y,r=this.rules.movement.playerRadius) {
    return riverBlocked(this.map,x,y,r)||x<r||y<r||x>this.map.width-r||y>this.map.height-r||this.map.obstacles.some(o=>x>o.x-r&&x<o.x+o.width+r&&y>o.y-r&&y<o.y+o.height+r);
  }
  move(entity,dx,dy,speed,dt) {
    const d=Math.hypot(dx,dy);if(d<0.001)return false;
    const vx=dx/d*speed*dt,vy=dy/d*speed*dt,ox=entity.x,oy=entity.y;
    const radius=entity===this.p?this.rules.movement.playerRadius:this.rules.movement.enemyRadius;
    if(!this.blocked(entity.x+vx,entity.y,radius))entity.x+=vx;
    if(!this.blocked(entity.x,entity.y+vy,radius))entity.y+=vy;
    if(entity===this.p&&Math.hypot(entity.x-ox,entity.y-oy)>.01)this.face=Math.atan2(dy,dx);
    return Math.hypot(entity.x-ox,entity.y-oy)>.01;
  }
  navigate(entity,to,speed,dt){
    const radius=entity===this.p?this.rules.movement.playerRadius:this.rules.movement.enemyRadius,blocked=(x,y,r)=>this.blocked(x,y,r);
    let target=to;
    if(!clearLine(entity,to,blocked,radius)){
      let cached=this.routes.get(entity);
      if(!cached||cached.map!==this.p.mapId||Math.hypot(cached.goal.x-to.x,cached.goal.y-to.y)>40||!cached.path.length){cached={map:this.p.mapId,goal:{x:to.x,y:to.y},path:planRoute(this.map,entity,to,blocked,radius)};this.routes.set(entity,cached);}
      while(cached.path.length&&distance(entity,cached.path[0])<5)cached.path.shift();
      if(!cached.path.length)return false;target=cached.path[0];
    }else this.routes.delete(entity);
    const length=distance(entity,target);return this.move(entity,target.x-entity.x,target.y-entity.y,Math.min(speed,length/dt),dt);
  }

  cancelCombat(){this.target=null;this.autoAttack=false;this.goal=null;}
  select(id){
    const e=this.enemies.find(e=>e.id===id&&!e.dead);if(!e)return false;
    this.target=e.id;this.autoAttack=false;this.goal=null;this.touch();return true;
  }
  nearest(maxRange=450) {
    return this.enemies.filter(e=>!e.dead&&distance(this.p,e)<=maxRange).sort((a,b)=>distance(this.p,a)-distance(this.p,b))[0];
  }
  toggleAttack(){
    if(this.map.safe)return this.emit('notice','城鎮是安全區，請先前往野外');
    if(!this.enemies.some(e=>e.id===this.target&&!e.dead))this.target=this.nearest()?.id||null;
    if(!this.target)return this.emit('notice','附近沒有怪物，往北探索看看');
    this.autoAttack=!this.autoAttack;this.goal=null;this.touch();
  }
  lockNearest(){
    if(this.target){this.cancelCombat();this.touch();return;}
    const e=this.nearest();if(e)this.select(e.id);else this.emit('notice','附近沒有可鎖定的怪物');
  }
  buy(shopId,itemId,quantity=1) {
    const shop=this.index.shops.get(shopId),item=this.index.items.get(itemId);
    if(!shop||shop.mapId!==this.p.mapId||!this.map.safe||!shop.items.includes(itemId)||!item)return {ok:false,message:'請回城鎮商店購買'};
    if(!safeInt(quantity,1,99))return {ok:false,message:'購買數量必須是 1～99'};
    const cost=buyPrice(item,this.p,this.catalog)*quantity,d=this.derived;
    if(cost>this.p.gold)return {ok:false,message:'金幣不足'};
    if((this.p.inventory[itemId]||0)+quantity>STACK_LIMIT)return {ok:false,message:'持有數量已達上限'};
    if(d.weight+item.weight*quantity>d.maxWeight)return {ok:false,message:'負重不足，請先出售物品'};
    this.p.gold-=cost;this.p.inventory[itemId]=(this.p.inventory[itemId]||0)+quantity;
    this.p.milestones.bought=true;
    if(this.p.milestones.fieldVisits>0&&item.type==='consumable')this.p.milestones.resupplied=true;
    this.emit('buy',`購入 ${item.name} ×${quantity}，花費 ${cost} 金幣`);
    return {ok:true};
  }
  deposit(id,quantity=1){return this.transferWarehouse(id,quantity,true);}
  withdraw(id,quantity=1){return this.transferWarehouse(id,quantity,false);}
  transferWarehouse(id,quantity,deposit){
    const deny=message=>({ok:false,message}),item=this.index.items.get(id);
    if(this.p.mapId!=='town'||!this.map.safe||this.deathPending)return deny('請回村莊使用個人倉庫');
    if(!item||!safeInt(quantity,1,STACK_LIMIT))return deny('物品或數量無效');
    const from=deposit?this.p.inventory:this.p.warehouse,to=deposit?this.p.warehouse:this.p.inventory;
    const worn=deposit?Object.values(this.p.equipment).filter(x=>x===id).length:0;
    if((from[id]||0)-worn<quantity)return deny(deposit?'可存數量不足，穿戴中的裝備請先卸下':'倉庫數量不足');
    if((to[id]||0)+quantity>STACK_LIMIT)return deny('物品數量已達上限');
    if(!deposit&&this.derived.weight+item.weight*quantity>this.derived.maxWeight)return deny('負重不足，請減少領取數量');
    from[id]-=quantity;if(!from[id])delete from[id];to[id]=(to[id]||0)+quantity;
    this.emit('warehouse',`${deposit?'存入':'領取'}${item.name} ×${quantity}`);return {ok:true};
  }
  sell(itemId,quantity=1) {
    const item=this.index.items.get(itemId);
    if(!this.map.safe)return {ok:false,message:'請回城鎮出售物品'};
    if(!item||!safeInt(quantity,1,STACK_LIMIT)||(this.p.inventory[itemId]||0)<quantity)return {ok:false,message:'持有數量不足'};
    const worn=Object.values(this.p.equipment).filter(id=>id===itemId).length;
    if((this.p.inventory[itemId]||0)-quantity<worn)return {ok:false,message:'請先卸下這件裝備'};
    if(item.sellPrice<=0)return {ok:false,message:'這件物品無法出售'};
    if(this.p.gold+item.sellPrice*quantity>1e9)return {ok:false,message:'金幣已達上限'};
    this.consume(itemId,quantity);this.p.gold+=item.sellPrice*quantity;
    this.emit('sell',`售出 ${item.name} ×${quantity}，獲得 ${item.sellPrice*quantity} 金幣`);return {ok:true};
  }
  consume(id,quantity=1) {
    this.p.inventory[id]-=quantity;if(this.p.inventory[id]===0)delete this.p.inventory[id];this.touch();
  }
  equip(itemId,requestedSlot=null) {
    const item=this.index.items.get(itemId);
    const slots=compatibleSlots(item);
    if(!item||!slots.length||!(this.p.inventory[itemId]>0))return {ok:false,message:'沒有這件可穿戴的裝備'};
    const slot=requestedSlot||slots.find(s=>!this.p.equipment[s])||slots[0];
    if(!slots.includes(slot))return {ok:false,message:'這件裝備不能穿戴在此欄位'};
    const used=Object.entries(this.p.equipment).filter(([s,id])=>s!==slot&&id===itemId).length;
    if(used>=this.p.inventory[itemId])return {ok:false,message:'持有數量不足，不能重複穿戴同一件裝備'};
    this.p.equipment[slot]=itemId;this.p.milestones.equipped=true;this.clampVitals();
    this.emit('equip',`已裝備 ${item.name}`);return {ok:true};
  }
  unequip(slot){
    if(!SLOTS.includes(slot)||!this.p.equipment[slot])return {ok:false,message:'這個欄位沒有裝備'};
    this.p.equipment[slot]=null;this.clampVitals();this.touch();return {ok:true};
  }
  clampVitals(){const d=this.derived;this.p.hp=Math.min(this.p.hp,d.maxHp);this.p.mp=Math.min(this.p.mp,d.maxMp);}
  useItem(id,{silent=false}={}) {
    if(this.deathPending)return {ok:false,message:'人物倒下，正在返回城鎮'};
    const i=this.index.items.get(id),deny=message=>({ok:false,message});
    if(!i||!(this.p.inventory[id]>0))return deny('道具不足，請回城補給');
    if(i.type!=='consumable')return deny('此道具無法直接使用');
    if(i.effect==='return') {
      if(this.map.safe)return deny('已經在城鎮中');
      this.consume(id);this.travel('town');this.emit('return','使用回城卷軸，已返回安全區');return {ok:true};
    }
    if(i.effect==='heal') {
      if(this.cooldowns.potion>0)return deny('藥水冷卻中');
      const d=this.derived;if(this.p.hp>=d.maxHp)return deny('生命已滿，不需要喝藥水');
      this.consume(id);const amount=Math.min(i.power,d.maxHp-this.p.hp);this.p.hp+=amount;this.cooldowns.potion=this.rules.recovery.potionCooldown;
      if(!silent)this.emit('potion',`使用 ${i.name}，恢復 ${Math.ceil(amount)} HP`,{amount,x:this.p.x,y:this.p.y});
      else this.events.push({type:'potion',text:`+${Math.ceil(amount)}`,amount,x:this.p.x,y:this.p.y});
      this.touch();return {ok:true};
    }
    return deny('不支援的道具效果');
  }
  heal(){
    if(this.deathPending)return {ok:false,message:'人物倒下，正在返回城鎮'};
    if(this.cooldowns.heal>0)return {ok:false,message:'治療術冷卻中'};
    const d=this.derived,r=this.rules.healing;
    if(this.p.hp>=d.maxHp)return {ok:false,message:'生命已滿'};
    if(this.p.mp<r.manaCost)return {ok:false,message:'魔力不足'};
    this.p.mp-=r.manaCost;const amount=Math.min(d.healing,d.maxHp-this.p.hp);this.p.hp+=amount;this.cooldowns.heal=r.cooldown;
    this.emit('heal',`治療術恢復 ${Math.ceil(amount)} HP`,{amount,x:this.p.x,y:this.p.y});return {ok:true};
  }
  rest(){
    if(!this.map.safe)return {ok:false,message:'休息所位於城鎮，請先回城'};
    if(this.p.gold<this.rules.restCost)return {ok:false,message:'金幣不足'};
    this.p.gold-=this.rules.restCost;const d=this.derived;this.p.hp=d.maxHp;this.p.mp=d.maxMp;
    this.emit('rest','休息完畢，生命與魔力已恢復');return {ok:true};
  }
  allocate(stat){
    if(!STAT_KEYS.includes(stat)||this.p.points<=0||this.p.stats[stat]>=999)return {ok:false,message:'沒有可分配點數'};
    this.p.points--;this.p.stats[stat]++;this.emit('allocate',`${this.index.abilities.get(stat).name} +1`);return {ok:true};
  }
  grantExp(amount){
    if(this.p.level>=this.rules.growth.maxLevel)return;
    this.p.xp+=amount;
    while(this.p.level<this.rules.growth.maxLevel&&this.p.xp>=expRequired(this.p.level,this.catalog)) {
      this.p.xp-=expRequired(this.p.level,this.catalog);this.p.level++;this.p.points+=this.rules.growth.pointsPerLevel;this.p.milestones.leveled=true;
      const d=this.derived;this.p.hp=d.maxHp;this.p.mp=d.maxMp;
      this.emit('level',`升級！Lv.${this.p.level}，獲得 ${this.rules.growth.pointsPerLevel} 點能力`,{x:this.p.x,y:this.p.y});
    }
    if(this.p.level>=this.rules.growth.maxLevel)this.p.xp=0;
    this.touch();
  }
  defeat(e){
    if(e.dead||e.hp>0)return false;
    const m=this.index.monsters.get(e.monsterId);e.dead=true;e.fall=0;e.animation=null;e.active=false;e.respawn=m.respawnSeconds;
    this.p.kills++;const gold=this.roll(m.goldMin,m.goldMax);this.p.gold=Math.min(1e9,this.p.gold+gold);
    const drops=[];
    for(const drop of m.drops)if(this.random()<drop.chance){
      const qty=this.roll(drop.min,drop.max),i=this.index.items.get(drop.itemId),d=this.derived;
      if((this.p.inventory[i.id]||0)+qty<=STACK_LIMIT&&d.weight+qty*i.weight<=d.maxWeight){this.p.inventory[i.id]=(this.p.inventory[i.id]||0)+qty;drops.push(`${i.name} ×${qty}`);}else drops.push(`${i.name}（負重已滿，未拾取）`);
    }
    this.emit('kill',`擊敗 ${m.name}：EXP +${m.exp}、金幣 +${gold}${drops.length?'、'+drops.join('、'):''}`,{x:e.x,y:e.y});
    this.grantExp(m.exp);
    if(this.target===e.id){this.target=null;this.autoAttack=false;this.goal=null;}
    return true;
  }
  attack(e){
    if(e.dead||this.map.safe||this.cooldowns.attack>0||distance(this.p,e)>this.rules.movement.attackRange)return false;
    this.cooldowns.attack=this.rules.combat.playerAttackSeconds;e.active=true;
    const style=this.attackSequence++%2?'chop':'slash',duration=Math.min(style==='chop'?ART_MOTION.chop:ART_MOTION.slash,this.rules.combat.playerAttackSeconds),impact=duration*(style==='chop'?ART_MOTION.chopImpact/ART_MOTION.chop:ART_MOTION.slashImpact/ART_MOTION.slash);
    this.playerAnimation={style,duration,impact,elapsed:0,done:false,target:e.id,side:e.x>=this.p.x?'right':'left'};this.swing=duration;
    this.face=Math.atan2(e.y-this.p.y,e.x-this.p.x);return true;
  }
  resolvePlayerAttack(e){
    if(!e||e.dead||this.map.safe||distance(this.p,e)>this.rules.movement.attackRange||Math.abs(e.y-this.p.y)>40||(e.x-this.p.x)*(this.playerAnimation?.side==='left'?-1:1)<-8)return false;
    this.face=Math.atan2(e.y-this.p.y,e.x-this.p.x);
    const m=this.index.monsters.get(e.monsterId);
    if(this.random()>hitChance(this.p,m,this.catalog)) {this.events.push({type:'miss',text:'MISS',x:e.x,y:e.y});return true;}
    const d=this.derived,damage=Math.max(this.rules.combat.minimumDamage,this.roll(d.damageMin,d.damageMax)-m.defense);
    e.hp=Math.max(0,e.hp-damage);e.hurt=ART_MOTION.hurt;e.hurtFacing=this.p.x<e.x?'left':'right';
    this.events.push({type:'damage',text:String(damage),x:e.x,y:e.y});this.touch();
    this.defeat(e);return true;
  }
  enemyAttack(e){
    if(e.dead||this.map.safe||e.cooldown>0||distance(this.p,e)>this.rules.movement.attackRange)return;
    const m=this.index.monsters.get(e.monsterId);e.cooldown=m.attackSeconds;
    const duration=Math.min(ART_MOTION.enemy,m.attackSeconds);e.animation={duration,impact:duration*ART_MOTION.enemyImpact/ART_MOTION.enemy,elapsed:0,done:false,side:this.p.x>=e.x?'right':'left'};e.swing=duration;
  }
  resolveEnemyAttack(e){
    if(e.dead||this.map.safe||distance(this.p,e)>this.rules.movement.attackRange||this.deathPending)return;
    const m=this.index.monsters.get(e.monsterId);
    if(this.random()>hitChance(this.p,m,this.catalog,false)){this.events.push({type:'dodge',text:'迴避',x:this.p.x,y:this.p.y});return;}
    const damage=Math.max(this.rules.combat.minimumDamage,this.roll(m.damageMin,m.damageMax)-Math.floor(this.derived.defense*this.rules.combat.armorReduction));
    this.p.hp=Math.max(0,this.p.hp-damage);this.hurt=ART_MOTION.hurt;this.playerHurtFacing=e.x<this.p.x?'left':'right';this.events.push({type:'hurt',text:`-${damage}`,x:this.p.x,y:this.p.y});this.touch();
    if(this.p.hp<=0){this.deathPending=ART_MOTION.fall;this.cancelCombat();this.playerAnimation=null;}
  }
  die(){
    this.deathPending=0;this.playerAnimation=null;this.p.deaths++;this.travel('town');const d=this.derived;this.p.hp=Math.max(1,Math.round(d.maxHp*this.rules.recovery.deathHpRatio));this.p.mp=Math.min(this.p.mp,d.maxMp);
    this.emit('death','你已倒下，返回城鎮。到休息所恢復後再出發。');
  }
  travel(mapId,arrival=null){
    if(this.deathPending)return false;
    const map=this.index.maps.get(mapId);
    if(!map||mapId===this.p.mapId)return false;
    this.p.mapId=mapId;Object.assign(this.p,arrival||map.spawn);this.cancelCombat();this.playerAnimation=null;this.swing=0;this.hurt=0;this.spawnEnemies();this.cooldowns.transition=1.5;
    if(!map.safe)this.p.milestones.fieldVisits++;
    this.emit('travel',`抵達 ${map.name}${map.safe?'・安全區':''}`);return true;
  }
  travelExit(){
    if(distance(this.p,this.map.exit)>this.map.exit.radius)return {ok:false,message:'請先走到地圖出口'};
    const exit=this.map.exit;this.travel(exit.to,exit.arrival);return {ok:true};
  }
  setGoal(point){
    if(this.blocked(point.x,point.y))return {ok:false,message:'那裡無法通行'};
    this.goal={x:point.x,y:point.y};this.autoAttack=false;this.target=null;return {ok:true};
  }
  update(dt,input={x:0,y:0}){
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.1);this.clock+=dt;this.p.playSeconds+=dt;
    if(this.deathPending>0){this.deathPending=Math.max(0,this.deathPending-dt);this.moving=false;if(!this.deathPending)this.die();return;}
    const advance=(animation,resolve)=>{if(!animation)return;animation.elapsed+=dt;if(!animation.done&&animation.elapsed>=animation.impact){animation.done=true;resolve();}};
    advance(this.playerAnimation,()=>this.resolvePlayerAttack(this.enemies.find(e=>e.id===this.playerAnimation?.target)));
    for(const enemy of this.enemies)if(!enemy.dead)advance(enemy.animation,()=>this.resolveEnemyAttack(enemy));
    if(this.deathPending)return;
    for(const k of ['attack','potion','heal','transition'])this.cooldowns[k]=Math.max(0,this.cooldowns[k]-dt);
    this.swing=Math.max(0,this.swing-dt);this.hurt=Math.max(0,this.hurt-dt);this.moving=false;
    const d=this.derived,speed=this.rules.movement.playerSpeed*(d.weight>d.maxWeight?.5:1);
    if(this.swing>0){this.moving=false;}
    else if(Math.hypot(input.x,input.y)>.12){this.cancelCombat();this.moving=this.move(this.p,input.x,input.y,speed,dt);}
    else if(this.goal){
      if(distance(this.p,this.goal)<5)this.goal=null;
      else{this.moving=this.navigate(this.p,this.goal,speed,dt);if(!this.moving)this.goal=null;}
    }
    else if(this.autoAttack){
      const e=this.enemies.find(e=>e.id===this.target&&!e.dead);
      if(!e)this.cancelCombat();
      else if(distance(this.p,e)>this.rules.movement.attackRange-4||Math.abs(this.p.y-e.y)>20){
        const side=this.p.x<e.x?-1:1,stance={x:e.x+side*(this.rules.movement.attackRange-8),y:e.y};
        if(this.blocked(stance.x,stance.y))stance.x=e.x-side*(this.rules.movement.attackRange-8);
        this.moving=this.navigate(this.p,stance,speed,dt);
      }
      else this.attack(e);
    }
    const currentMap=this.p.mapId;
    if(!this.map.safe)for(const e of this.enemies){
      const m=this.index.monsters.get(e.monsterId);e.hurt=Math.max(0,e.hurt-dt);e.swing=Math.max(0,e.swing-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.moving=false;
      if(e.dead){e.fall+=dt;e.respawn-=dt;if(e.respawn<=0){Object.assign(e,{x:e.homeX,y:e.homeY,hp:m.hp,dead:false,fall:0,animation:null,hurt:0,swing:0,active:false,cooldown:m.attackSeconds});}continue;}
      if(m.aggressive&&distance(e,this.p)<this.rules.movement.aggroRadius)e.active=true;
      if(distance(e,{x:e.homeX,y:e.homeY})>this.rules.movement.leash||distance(e,this.p)>this.rules.movement.leash)e.active=false;
      if(e.active){
        if(e.swing>0)continue;
        if(distance(e,this.p)>this.rules.movement.attackRange-6)e.moving=this.navigate(e,this.p,m.speed,dt);
        else this.enemyAttack(e);
        if(this.p.mapId!==currentMap)break;
      }else if(distance(e,{x:e.homeX,y:e.homeY})>5){e.moving=this.navigate(e,{x:e.homeX,y:e.homeY},m.speed,dt);}
    }
    if(this.p.settings.autoPotion&&this.p.hp/this.derived.maxHp*100<=this.p.settings.potionThreshold){
      const potion=this.catalog.items.find(i=>i.effect==='heal'&&(this.p.inventory[i.id]||0)>0);if(potion)this.useItem(potion.id,{silent:true});
    }
    this.cooldowns.regen+=dt;
    if(this.cooldowns.regen>=this.rules.recovery.interval){
      this.cooldowns.regen=0;const d=this.derived,mult=this.map.safe?this.rules.recovery.townMultiplier:1;
      this.p.hp=Math.min(d.maxHp,this.p.hp+d.hpRegen*mult);this.p.mp=Math.min(d.maxMp,this.p.mp+d.mpRegen*mult);this.touch();
    }
    if(this.cooldowns.transition<=0&&distance(this.p,this.map.exit)<=this.map.exit.radius)this.travelExit();
  }
}
