import {STAT_KEYS, SLOTS, GEAR_TYPES, compatibleSlots, validateCatalog} from './catalog.mjs';
import {Game, SAVE_VERSION, createState, derive, buyPrice, expRequired, distance, validatePlayer} from './core.mjs';
import {Storage, parseBackup} from './storage.mjs';
import {World} from './world.mjs';
import {loadActorArt} from './actor-art.mjs';
import {loadWorldArt,REGION_AT} from './world-art.mjs';
import {loadPortraits} from './portraits.mjs';
import {drawActor} from './sprites.mjs';

const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>Number(value).toLocaleString('zh-TW',{maximumFractionDigits:1});
const icon=i=>({weapon:'⚔',armor:'▣',accessory:'◉',material:'✦',consumable:i.effect==='heal'?'♜':'▤'}[i.type]||'◆');
const storage=new Storage();
let actorArt,worldArt,portraits,catalog,game,world,allocation,activePanel=null,activeTab='',lastFocus,toastUntil=0,lastFrame=0,hudTimer=0,saveTimer=0,lastSavedRevision=-1;
let persistenceError=false,saving=false,editor={category:'items',id:null,dirty:false},running=true;
let warehouseBusy=false,warehouseMode='deposit';
let selectedEquipmentSlot='weapon';
const keys=new Set(),joy={x:0,y:0,pointer:null};

function toast(text,seconds=2.5){
  $('toast').textContent=text;$('toast').hidden=false;$('systemMessages').classList.add('has-toast');
  $('panelNotice').textContent=text;$('panelNotice').hidden=!activePanel;
  toastUntil=performance.now()+seconds*1000;
}
function result(value){if(value?.ok===false)toast(value.message);return value;}
function download(value,name){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function persist(force=false){
  if(!game||saving||warehouseBusy||(!force&&game.revision===lastSavedRevision))return;
  saving=true;const snapshot=game.snapshot(),revision=game.revision;
  $('saveStatus').textContent='存檔中…';
  try{await storage.save(snapshot,catalog);lastSavedRevision=revision;persistenceError=false;$('saveStatus').textContent='✓ 已自動存檔';}
  catch(error){persistenceError=true;$('saveStatus').textContent='⚠ 存檔失敗，請匯出備份';toast(`存檔失敗：${error.message}。可在系統匯出備份。`,6);}
  finally{saving=false;}
}
function drainEvents(){
  if(!game)return;
  for(const event of game.events.splice(0)){
    world.particle(event);
    if(!['damage','hurt','miss','dodge'].includes(event.type)){
      if(event.type==='potion'&&!event.time)continue;
      toast(event.text,event.type==='level'||event.type==='death'?4:2.5);
    }
  }
}
function renderCreation(){
  const r=catalog.rules,total=Object.values(allocation).reduce((a,b)=>a+b,0),remain=r.creationPoints-total;
  $('createRemain').textContent=remain;
  $('createStats').innerHTML=catalog.abilities.map(a=>`<div class="stat-allocation"><span title="${esc(a.description)}">${esc(a.name)}</span><button type="button" data-create="${a.id}" data-dir="-1" aria-label="減少${esc(a.name)}" ${allocation[a.id]===0?'disabled':''}>−</button><b>${r.baseStats[a.id]+allocation[a.id]}</b><button type="button" data-create="${a.id}" data-dir="1" aria-label="增加${esc(a.name)}" ${remain<=0?'disabled':''}>＋</button></div>`).join('');
  $('createConfirm').disabled=remain!==0;
  const stats=Object.fromEntries(STAT_KEYS.map(k=>[k,r.baseStats[k]+allocation[k]]));
  const sample={stats,equipment:{},level:1,inventory:r.startItems};const d=derive(sample,catalog);
  $('createPreview').textContent=`生命 ${d.maxHp} · 魔力 ${d.maxMp} · 起始金幣 ${r.startGold}。已預配 ${r.creationPoints} 點，可自行調整。`;
}
function showCreation(){
  activePanel=null;$('panel').hidden=true;$('hud').hidden=true;$('controls').hidden=true;$('journey').hidden=true;
  $('createOverlay').hidden=false;allocation=structuredClone(catalog.rules.defaultAllocation);renderCreation();$('createName').focus();
}
function start(player){
  game=new Game(catalog,player);lastSavedRevision=-1;world.particles=[];
  $('createOverlay').hidden=true;$('loading').hidden=true;$('hud').hidden=false;$('controls').hidden=false;
  renderHud();world.resize();world.render(game);persist(true);
}
function journey(){
  const p=game.p,m=p.milestones;
  if(!m.bought)return {text:'第一步：到城鎮商店購買短劍',button:'前往商店',action:'shop'};
  if(!m.equipped)return {text:'穿上裝備，準備第一次遠征',button:'打開裝備',action:'gear'};
  if(m.fieldVisits===0)return {text:'準備好了，從北方出口前往野外',button:'出發',action:'field'};
  if(!m.leveled)return {text:game.map.safe?'返回野外，打怪累積經驗':'點怪物鎖定，再按攻擊；升至 Lv.2',button:game.map.safe?'前往野外':'鎖定怪物',action:game.map.safe?'field':'lock'};
  if(!m.resupplied)return {text:game.map.safe?'買些藥水，準備下一輪冒險':'你已升級！回城補給後再出發',button:game.map.safe?'補給':'回城',action:game.map.safe?'shop':'return'};
  if(m.fieldVisits<2)return {text:'補給完成，重返野外完成循環',button:'再次出發',action:'field'};
  return {text:'最小循環已完成，繼續你的遠征',button:'旅程紀錄',action:'journey',complete:true};
}
function renderHud(){
  if(!game)return;const p=game.p,d=game.derived,max=p.level>=catalog.rules.growth.maxLevel,xp=max?100:p.xp/expRequired(p.level,catalog)*100;
  $('playerName').textContent=`Lv.${p.level}　${p.name}・騎士`;
  for(const [id,v] of [['hp',p.hp/d.maxHp*100],['mp',d.maxMp?p.mp/d.maxMp*100:0],['xp',xp]])$(id+'Fill').style.width=`${Math.min(100,v)}%`;
  $('hpValue').textContent=`HP ${Math.ceil(p.hp)} / ${d.maxHp}`;$('mpValue').textContent=`MP ${Math.floor(p.mp)} / ${d.maxMp}`;
  $('xpValue').textContent=max?'EXP MAX':`EXP ${xp.toFixed(1)}%`;
  $('acValue').textContent=d.ac;$('weightValue').textContent=`${Math.round(d.weight/d.maxWeight*100)}%`;
  $('goldValue').textContent=fmt(p.gold);$('mapName').textContent=REGION_AT(game.map,game.p);$('zoneLabel').textContent=game.map.safe?'安全區 · MVP 0.10.0':'戰鬥區 · MVP 0.10.0';
  $('zoneButton').querySelector('.nav-label').textContent=game.map.safe?'去野外':'回城';
  $('zoneButton').setAttribute('aria-label',game.map.safe?'去野外':'回城');
  const potion=catalog.items.find(i=>i.effect==='heal'),count=p.inventory[potion.id]||0;
  $('potionButton').innerHTML=`紅水<br>${count}`;$('potionButton').disabled=count===0||game.cooldowns.potion>0;
  $('healButton').innerHTML=game.cooldowns.heal>0?`治療<br>${Math.ceil(game.cooldowns.heal)}s`:`治療術<br>${catalog.rules.healing.manaCost} MP`;
  $('healButton').disabled=game.cooldowns.heal>0||p.mp<catalog.rules.healing.manaCost;
  $('attackButton').innerHTML=game.autoAttack?'⚔<br>停止':'⚔<br>攻擊';$('attackButton').classList.toggle('active',game.autoAttack);
  $('lockButton').innerHTML=game.target?'取消<br>鎖定':'鎖定';
  const target=game.enemies.find(e=>e.id===game.target&&!e.dead);$('target').hidden=!target;
  if(target){const m=game.index.monsters.get(target.monsterId);$('target').textContent=`Lv.${m.level} ${m.name}　HP ${target.hp}/${m.hp}`;}
  const j=journey();$('journey').hidden=false;$('journey').classList.toggle('complete',!!j.complete);$('journeyLabel').textContent=j.text;$('journeyAction').textContent=j.button;$('journeyAction').dataset.journey=j.action;
  const b=game.map.buildings.find(b=>distance(p,{x:b.x,y:b.y+110})<115);
  const context=$('contextAction');context.hidden=!b;
  $('systemMessages').classList.toggle('has-context',!!b);
  const contextKey=b?`${b.action}:${b.name}`:'';
  if(context.dataset.key!==contextKey){context.dataset.key=contextKey;context.innerHTML=b?`<button data-context="${b.action}">${b.action==='shop'?'開啟':'進入'}${esc(b.name)}</button>`:'';}
}
function itemDetails(i){
  const bits=[];if(i.type==='weapon')bits.push(`傷害 ${i.damageMin}～${i.damageMax}`);if(i.defense)bits.push(`防禦 +${i.defense}`);
  for(const [key,value] of Object.entries(i.bonuses||{}))if(value)bits.push(`${catalog.abilities.find(a=>a.id===key)?.name||key} ${value>0?'+':''}${value}`);
  if(i.effect==='heal')bits.push(`恢復 ${i.power} HP`);if(i.effect==='return')bits.push('返回城鎮');bits.push(`重量 ${fmt(i.weight)}`);
  return bits.join(' · ');
}
function itemRow(i,actions='',tag=''){
  return `<article class="item-row"><div class="item-icon" aria-hidden="true">${icon(i)}</div><div class="item-info"><h4>${esc(i.name)}${tag}</h4><small>${esc(itemDetails(i))}</small><p>${esc(i.description)}</p><div class="item-actions">${actions}</div></div></article>`;
}
function pauseNote(){return '<p class="pause-note">開啟面板時暫停戰鬥，關閉後繼續。</p>';}
function renderCharacter(){
  const p=game.p,d=game.derived;
  if(activeTab==='gear'){
    const slot=selectedEquipmentSlot,current=game.index.items.get(p.equipment[slot]),definition=game.index.equipmentSlots.get(slot);
    const available=catalog.items.filter(i=>compatibleSlots(i).includes(slot)&&p.inventory[i.id]&&i.id!==current?.id);
    return pauseNote()+`<div class="summary"><span>近戰傷害 <strong>${d.damageMin}～${d.damageMax}</strong></span><span>防禦 <strong>${d.defense}</strong> · AC ${d.ac}</span></div>
    <div class="paperdoll" aria-label="人物與 13 個裝備欄位">${catalog.equipmentSlots.map(s=>{
      const i=game.index.items.get(p.equipment[s.id]);
      return `<button class="equipment-slot ${s.id===slot?'selected':''} ${i?'':'empty'}" data-equipment-slot="${s.id}" style="grid-column:${s.column};grid-row:${s.row}" aria-label="${esc(s.name)}：${esc(i?.name||'未裝備')}" aria-pressed="${s.id===slot}"><span class="slot-label"><i aria-hidden="true">${esc(s.icon)}</i>${esc(s.name)}</span><span class="slot-item">${esc(i?.name||'未裝備')}</span></button>`;
    }).join('')}<div class="paperdoll-figure"><canvas id="paperdollFigure" width="384" height="896" aria-label="騎士精細全身立繪"></canvas><small>${esc(p.name)}</small></div></div>
    <div class="selected-slot-title"><h3>${esc(definition.name)}</h3><small class="subtle">點選人物周圍欄位查看</small></div>
    ${current?itemRow(current,`<button data-action="unequip" data-slot="${slot}">卸下</button>`,'<span class="badge">穿戴中</span>'):'<p class="subtle">此欄位尚未裝備。背包持有的相容裝備會顯示在下方。</p>'}
    ${available.map(i=>{
      const used=Object.entries(p.equipment).filter(([s,id])=>s!==slot&&id===i.id).length,can=p.inventory[i.id]>used;
      return itemRow(i,`<button data-action="equip" data-id="${i.id}" data-slot="${slot}" ${can?'':'disabled'}>裝備</button>`,can?'':'<span class="badge">已穿戴於另一格</span>');
    }).join('')}${!available.length&&!current?'<p class="subtle">目前沒有可用裝備，可至城鎮商店購買。</p>':''}`;
  }
  return pauseNote()+`<div class="summary"><span>Lv.${p.level} ${esc(p.name)}</span><strong>可分配 ${p.points} 點</strong></div><div class="stats-grid">${catalog.abilities.map(a=>`<div class="stat-card"><div class="stat-title"><span>${esc(a.name)} <small>${a.id.toUpperCase()}</small></span><b>${d.stats[a.id]}</b><button data-action="allocate" data-stat="${a.id}" aria-label="增加${esc(a.name)}" ${p.points<=0?'disabled':''}>＋</button></div><p>基礎 ${p.stats[a.id]} + 裝備 ${d.gear[a.id]}<br>${esc(a.description)}</p></div>`).join('')}</div>
  <h3>實際戰鬥能力</h3><div class="derived-grid">${[
    ['生命',`${Math.ceil(p.hp)} / ${d.maxHp}`],['魔力',`${Math.floor(p.mp)} / ${d.maxMp}`],['近戰傷害',`${d.damageMin}～${d.damageMax}`],['物理防禦',d.defense],['防禦 AC',d.ac],['同級基礎命中',`${Math.round(Math.min(catalog.rules.combat.maxHit,catalog.rules.combat.baseHit+(d.stats.dex-catalog.rules.statBase)*catalog.rules.combat.hitPerDex)*100)}%`],['每次恢復 HP',fmt(d.hpRegen)],['每次恢復 MP',fmt(d.mpRegen)],['治療術恢復量',d.healing],['商店優惠',`${Math.round(d.discount*100)}%`],['負重',`${fmt(d.weight)} / ${d.maxWeight}`],['累計擊殺',p.kills]
  ].map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join('')}</div><p class="subtle">每 ${catalog.rules.recovery.interval} 秒恢復一次，城鎮恢復為 ${catalog.rules.recovery.townMultiplier} 倍。負重超過上限時移動減半，無法再購買或拾取超重物品。<br>本版 AC 顯示防禦與敏捷的換算；實際命中由敏捷計算，減傷由物理防禦計算。</p><h3>升級進度</h3><p class="subtle">${p.level>=catalog.rules.growth.maxLevel?'已達本版最高等級':`EXP ${fmt(p.xp)} / ${fmt(expRequired(p.level,catalog))}，升級獲得 ${catalog.rules.growth.pointsPerLevel} 點能力，生命與魔力全滿。`}</p>`;
}
function renderBag(){
  const p=game.p,d=game.derived;
  const items=catalog.items.filter(i=>p.inventory[i.id]&&(activeTab==='all'||(activeTab==='gear'?GEAR_TYPES.includes(i.type):i.type===activeTab)));
  return pauseNote()+`<div class="summary"><span>負重 ${fmt(d.weight)} / ${d.maxWeight}</span><strong>◆ ${fmt(p.gold)}</strong></div>`+(items.length?items.map(i=>{
    const worn=Object.entries(p.equipment).filter(([s,id])=>id===i.id),equipped=worn.length>0;
    const action=i.type==='consumable'?`<button data-action="use" data-id="${i.id}">使用</button>`:compatibleSlots(i).length?worn.map(([slot])=>`<button data-action="unequip" data-slot="${slot}">卸下${esc(game.index.equipmentSlots.get(slot).name)}</button>`).join('')+(p.inventory[i.id]>worn.length?`<button data-action="equip" data-id="${i.id}">裝備</button>`:''):'';
    return itemRow(i,action+(game.map.safe?`<button class="secondary" data-action="sell" data-id="${i.id}" ${p.inventory[i.id]<=worn.length?'disabled':''}>出售 1 · ${i.sellPrice} 金</button>`:''),`<span class="badge">×${p.inventory[i.id]}${equipped?` · 穿戴 ${worn.length} 件`:''}</span>`);
  }).join(''):'<div class="empty">這個分類還沒有物品。<br>可到城鎮商店購買，或前往野外打怪取得。</div>');
}
function renderShop(){
  const p=game.p,d=game.derived,shop=catalog.shops.find(s=>s.mapId===p.mapId);
  if(!game.map.safe||!shop)return pauseNote()+'<div class="empty">商店位於城鎮安全區。<br>使用回城卷軸，或從野外南方出口回城。</div><button class="primary" data-action="return">返回城鎮</button>';
  const head=pauseNote()+`<div class="summary"><span>${esc(shop.name)}</span><strong>◆ ${fmt(p.gold)}</strong></div><p class="subtle">魅力 ${d.stats.cha} · 購買優惠 ${Math.round(d.discount*100)}% · 物品購入後需手動裝備。</p>`;
  if(activeTab==='guild')return head+'<h3>冒險者公會</h3><p>與朋友建立2人或4人房間，一起挑戰墓園副本。</p><p class="subtle">目前使用獨立雲端訪客測試角色；本機角色與倉庫保留。副本不需門票與等級，Google／Apple綁定尚未開放。</p><button data-action="online-guild">進入公會・多人副本</button>';
  if(activeTab==='warehouse')return renderWarehouse();
  if(activeTab==='rest')return head+`<div class="rest-card"><b>旅人休息所</b><p>在安全區休息，恢復全部生命與魔力。<br>費用：${catalog.rules.restCost===0?'免費':catalog.rules.restCost+' 金幣'}</p><button data-action="rest">休息・恢復生命與魔力</button></div>`;
  if(activeTab==='sell'){
    const items=catalog.items.filter(i=>p.inventory[i.id]&&i.sellPrice>0);
    return head+(items.length?items.map(i=>{
      const kept=Object.values(p.equipment).filter(id=>id===i.id).length,count=p.inventory[i.id]-kept;
      return itemRow(i,`<button data-action="sell" data-id="${i.id}" ${count<1?'disabled':''}>出售 1 · ${i.sellPrice} 金</button>${count>1?`<button class="secondary" data-action="sell" data-id="${i.id}" data-quantity="${count}">出售 ${count} · ${fmt(count*i.sellPrice)} 金</button>`:''}`,`<span class="badge">×${p.inventory[i.id]}${kept?` · 保留穿戴中 ${kept} 件`:''}</span>`);
    }).join(''):'<div class="empty">沒有可出售的物品</div>');
  }
  return head+shop.items.map(id=>{
    const i=game.index.items.get(id),price=buyPrice(i,p,catalog),afford=p.gold>=price&&d.weight+i.weight<=d.maxWeight;
    return itemRow(i,`<button data-action="buy" data-id="${id}" data-shop="${shop.id}" ${!afford?'disabled':''}>購買 · ${price} 金</button>${i.type==='consumable'?`<button class="secondary" data-action="buy" data-id="${id}" data-shop="${shop.id}" data-quantity="10" ${p.gold<price*10||d.weight+i.weight*10>d.maxWeight?'disabled':''}>買 10 · ${price*10} 金</button>`:''}`,p.inventory[id]?`<span class="badge">持有 ${p.inventory[id]}</span>`:'');
  }).join('');
}
function renderWarehouse(){
  const p=game.p,d=game.derived,deposit=warehouseMode==='deposit';
  const rows=catalog.items.filter(i=>(deposit?p.inventory:p.warehouse)[i.id]);
  return pauseNote()+`<div class="summary"><strong>個人倉庫 · 免費存領</strong><span>負重 ${fmt(d.weight)} / ${d.maxWeight}</span></div><p class="subtle">穿戴中的裝備會保留；倉庫物品不計入隨身負重。領取時需有足夠負重。</p><div class="button-grid"><button data-action="warehouse-deposit" aria-pressed="${deposit}">存入背包物品</button><button data-action="warehouse-withdraw" aria-pressed="${!deposit}">領取倉庫物品</button></div>`+(rows.length?rows.map(i=>{
    const count=(deposit?p.inventory:p.warehouse)[i.id],worn=deposit?Object.values(p.equipment).filter(id=>id===i.id).length:0,available=count-worn;
    const capacity=deposit?available:Math.min(available,i.weight?Math.max(0,Math.floor((d.maxWeight-d.weight)/i.weight)):available);
    return itemRow(i,`<button data-action="${warehouseMode}" data-id="${i.id}" ${warehouseBusy||capacity<1?'disabled':''}>${deposit?'存入':'領取'} 1</button>${capacity>1?`<button data-action="${warehouseMode}" data-id="${i.id}" data-quantity="${Math.min(10,capacity)}" ${warehouseBusy?'disabled':''}>${deposit?'存入':'領取'} ${Math.min(10,capacity)}</button><button data-action="${warehouseMode}" data-id="${i.id}" data-quantity="${capacity}" ${warehouseBusy?'disabled':''}>${deposit?'全部存入':'可領取全部'} ${capacity}</button>`:''}`,`<span class="badge">×${count}${worn?` · 穿戴 ${worn}`:''}</span>`);
  }).join(''):'<div class="empty">目前沒有可存領物品</div>');
}
async function transferWarehouse(action,id,quantity){
  if(warehouseBusy)return;
  const before=structuredClone({p:game.p,revision:game.revision,logs:game.logs,events:game.events});
  const outcome=game[action](id,quantity);if(!outcome.ok){result(outcome);return;}
  warehouseBusy=true;renderPanel();
  try{await storage.save(game.snapshot(),catalog);lastSavedRevision=game.revision;persistenceError=false;drainEvents();$('saveStatus').textContent='✓ 倉庫已存檔';}
  catch(error){game.p=before.p;game.revision=before.revision;game.logs=before.logs;game.events=before.events;toast('存檔失敗，本次存領已取消：'+error.message,6);}
  finally{warehouseBusy=false;renderHud();renderPanel();}
}
function renderMap(){
  return pauseNote()+`<div class="summary"><span>${esc(game.map.name)}</span><strong>${game.map.safe?'安全區':'戰鬥區'}</strong></div><canvas id="mapPreview" class="map-preview" width="320" height="300" aria-label="地圖，可點擊位置設定移動目的地"></canvas><p class="map-legend">● 金色：你　◇ 淺色：出口　■ 棕色：建築　● 紅色：怪物<br>點擊地圖選擇目的地，關閉面板後會自動行走。</p><div class="button-grid"><button data-action="exit">走向${game.map.safe?'野外':'城鎮'}出口</button><button data-action="return" ${game.map.safe?'disabled':''}>使用回城卷軸</button></div><h3>野外分布</h3><p class="subtle">南方墓園：骷髏、史巴托、骷髏鬥士。<br>向北經木橋進入密林：狼人、暗夜狼人、白狼王。<br>墓園與密林屬於同一張野外地圖，只有木橋可以跨河。怪物脫離追擊範圍後返回出生點。</p>`;
}
function drawMapPreview(){
  const canvas=$('mapPreview');if(!canvas)return;const ctx=canvas.getContext('2d'),m=game.map,s=Math.min(canvas.width/m.width,canvas.height/m.height);
  const ox=(canvas.width-m.width*s)/2,oy=(canvas.height-m.height*s)/2;
  if(m.art==='twilight')worldArt.overview(ctx,m,canvas.width,canvas.height);else{ctx.fillStyle='#213e2a';ctx.fillRect(0,0,canvas.width,canvas.height);}
  ctx.strokeStyle='#7a8960';ctx.strokeRect(ox,oy,m.width*s,m.height*s);
  for(const o of m.art==='twilight'?[]:m.obstacles){ctx.fillStyle=m.safe?'#a68b5b':'#7c8a73';ctx.fillRect(ox+o.x*s,oy+o.y*s,o.width*s,o.height*s);}
  for(const e of game.enemies)if(!e.dead){ctx.fillStyle='#d8846a';ctx.beginPath();ctx.arc(ox+e.x*s,oy+e.y*s,3,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#e5d8a3';ctx.lineWidth=2;ctx.strokeRect(ox+m.exit.x*s-5,oy+m.exit.y*s-5,10,10);
  ctx.fillStyle='#ffdf89';ctx.beginPath();ctx.arc(ox+game.p.x*s,oy+game.p.y*s,5,0,Math.PI*2);ctx.fill();
  if(game.goal){ctx.strokeStyle='#f3d385';ctx.beginPath();ctx.moveTo(ox+game.p.x*s,oy+game.p.y*s);ctx.lineTo(ox+game.goal.x*s,oy+game.goal.y*s);ctx.stroke();}
  canvas.onclick=e=>{
    const b=canvas.getBoundingClientRect(),x=((e.clientX-b.left)/b.width*canvas.width-ox)/s,y=((e.clientY-b.top)/b.height*canvas.height-oy)/s;
    if(result(game.setGoal({x,y})).ok){closePanel();toast('已設定目的地，再次移動搖桿可取消');}
  };
}
function renderJourney(){
  const p=game.p,m=p.milestones,steps=[['購入裝備與補給',m.bought,'在城鎮商店購買第一件物品'],['穿上裝備',m.equipped,'到人物／裝備面板穿戴'],['踏入野外',m.fieldVisits>0,'從城鎮北方出口出發'],['打怪並升級',m.leveled,'擊敗怪物累積經驗，升至 Lv.2'],['回城補給',m.resupplied,'回城後再次購買消耗品'],['再次出發',m.fieldVisits>=2,'補給後第二次進入野外']];
  return pauseNote()+`<ol class="journey-steps">${steps.map(([label,done,detail])=>`<li class="${done?'done':''}">${done?'✓':'○'} ${label}<small>${detail}</small></li>`).join('')}</ol><div class="summary"><span>擊殺 ${p.kills} · 倒下 ${p.deaths}</span><span>遠征 ${m.fieldVisits} 次</span></div><button class="primary" data-action="continue-journey">${journey().button}</button><h3>冒險紀錄</h3>`+(game.logs.length?game.logs.map(e=>`<div class="log-entry ${e.type}">${esc(e.text)}</div>`).join(''):'<p class="subtle">這一趟冒險才剛開始。</p>');
}
function renderSystem(){
  if(activeTab==='bestiary')return pauseNote()+`<h3>怪物辨識特徵</h3><p class="subtle">這些是你指定的長期特徵，未來更換像素、手繪或其他美術風格都要保留。</p><div class="monster-previews">${catalog.monsterAppearances.map(a=>`<article class="monster-preview"><canvas data-appearance-preview="${a.id}" width="140" height="150" aria-label="${esc(a.name)}外觀示意"></canvas><b>${esc(a.name)}</b><p>${esc(a.description)}</p></article>`).join('')}</div><p class="subtle">南方墓園有三種骷髏，木橋北方的密林有三種狼人；白狼王體型為一般狼人的1.2倍。</p>`;
  if(activeTab==='help')return pauseNote()+`<h3>第一輪冒險</h3><ol class="help-list"><li>到商店買短劍與布甲，在人物／裝備穿上。</li><li>點「去野外」，自動走到北方出口。</li><li>點怪物或按「鎖定」，再按「攻擊」自動追擊；每次擊殺後重新選擇目標。</li><li>使用藥水或治療術恢復生命。升級後到人物面板分配能力點。</li><li>按「回城」使用卷軸；沒有卷軸時會自動走向南方出口。</li><li>在城鎮休息、出售材料、購買補給，再度出發。</li></ol><h3>鍵盤</h3><p class="kbd">WASD／方向鍵移動 · Space 攻擊 · E 鎖定<br>P 藥水 · H 治療 · R 回城<br>C 人物 · B 背包 · M 地圖 · Esc 關閉</p><h3>這一版的規則</h3><p class="subtle">單機遊戲，開啟面板或離開分頁時暫停。死亡回城不扣金幣或經驗，保留半數生命，可在休息所恢復。野外怪物依資料表重生，重新進入地圖也會重建怪物。角色外觀沿用原版像素騎士。<br>資料與公式均為自有設定，並非天堂官方數值。</p>`;
  return pauseNote()+`<h3>補給設定</h3><label class="setting-row"><span>自動喝紅水</span><input id="autoPotion" type="checkbox" ${game.p.settings.autoPotion?'checked':''}></label><label class="setting-row"><span>生命低於 <b id="thresholdValue">${game.p.settings.potionThreshold}%</b></span><input id="potionThreshold" type="range" min="10" max="90" step="10" value="${game.p.settings.potionThreshold}"></label><h3>存檔與備份</h3><p class="subtle">角色與自有資料表保存在此瀏覽器的 IndexedDB。每 3 秒與操作後自動儲存。換裝置、網址或清除瀏覽資料前，請先匯出完整備份。</p><div class="button-grid"><button data-action="save">立即存檔</button><button data-action="export">匯出完整備份</button><button data-action="import">匯入完整備份</button><button data-action="journey">旅程紀錄</button></div><h3>核心資料管理</h3><p class="subtle">所有裝備、道具、怪物、商店、地圖與公式設定由同一份自有資料庫提供。這裡的修改會在本瀏覽器生效，可匯出資料表留存至專案。</p><button class="primary" data-action="editor">開啟資料管理</button><h3>新旅程</h3><p class="subtle">只重建重置版角色，保留目前資料表。既有 V0.5.x 角色與檔案不受影響。</p><button class="danger" data-action="new-character">重新建立角色</button><h3>版本</h3><p class="subtle">MVP 0.10.0 · ${esc(catalog.version)}<br>${esc(catalog.provenance)}${persistenceError?'<br><strong class="error">目前存檔失敗，請立即匯出備份。</strong>':''}</p>`;
}

const panelConfig={
  char:{title:'人物／裝備',eyebrow:'CHARACTER',tabs:[['gear','人物裝備'],['stats','六項能力']],render:renderCharacter},
  bag:{title:'背包',eyebrow:'INVENTORY',tabs:[['all','全部'],['consumable','補給'],['gear','裝備'],['material','材料']],render:renderBag},
  shop:{title:'城鎮補給',eyebrow:'TOWN SUPPLIES',tabs:[['buy','購買'],['sell','出售'],['rest','休息'],['warehouse','倉庫'],['guild','公會']],render:renderShop},
  map:{title:'世界地圖',eyebrow:'TOWN & WILDERNESS',render:renderMap},
  journey:{title:'遠征紀錄',eyebrow:'YOUR FIRST ADVENTURE',render:renderJourney},
  system:{title:'系統',eyebrow:'SETTINGS & BACKUP',tabs:[['settings','設定與存檔'],['help','遊玩說明'],['bestiary','怪物圖鑑']],render:renderSystem},
  editor:{title:'自有資料管理',eyebrow:'GAME DATABASE · 本機修改',render:renderEditor}
};
function openPanel(name,tab){
  if(!game||warehouseBusy)return;if(activePanel==='editor'&&editor.dirty&&!confirm('尚有未套用的資料修改，確定離開？'))return;
  editor.dirty=false;keys.clear();clearJoy();world?.clearDrag();lastFocus=document.activeElement;
  activePanel=name;activeTab=tab||panelConfig[name].tabs?.[0][0]||'';$('panel').hidden=false;
  $('panelNotice').hidden=true;
  renderPanel();$('closePanel').focus();persist(true);
}
function closePanel(){
  if(warehouseBusy)return;
  if(activePanel==='editor'&&editor.dirty&&!confirm('尚有未套用的資料修改，確定離開？'))return;
  editor.dirty=false;activePanel=null;$('panel').hidden=true;keys.clear();clearJoy();world?.clearDrag();lastFocus?.focus?.();renderHud();persist(true);
}
function renderPanel(){
  if(!activePanel)return;
  const config=panelConfig[activePanel],scroll=$('panelBody').scrollTop;
  $('panelTitle').textContent=config.title;$('panelEyebrow').textContent=config.eyebrow;
  $('panelTabs').hidden=!config.tabs;
  $('panelTabs').innerHTML=config.tabs?.map(([id,label])=>`<button data-tab="${id}" class="${id===activeTab?'selected':''}" aria-pressed="${id===activeTab}">${label}</button>`).join('')||'';
  $('panelBody').innerHTML=config.render();$('panelBody').scrollTop=scroll;
  if(activePanel==='map')drawMapPreview();
  if(activePanel==='editor')loadEditorValue();
  drawPanelFigures();
}

function drawPanelFigures(){
  const figure=$('paperdollFigure');
  if(figure){const ctx=figure.getContext('2d'),im=portraits[game.p.sex],scale=Math.min(figure.width/im.width,figure.height/im.height);ctx.imageSmoothingEnabled=true;ctx.drawImage(im,(figure.width-im.width*scale)/2,(figure.height-im.height*scale)/2,im.width*scale,im.height*scale);}

  for(const canvas of document.querySelectorAll('[data-appearance-preview]')){
    const appearance=game.index.monsterAppearances.get(canvas.dataset.appearancePreview),ctx=canvas.getContext('2d');
    ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(70,105);ctx.scale(1.7,1.7);actorArt.draw(ctx,{x:0,y:0,dir:'down'},appearance.id,.8*(appearance.scale||1));ctx.restore();
  }
}

const categoryNames={items:'武器／裝備／道具',monsters:'怪物與掉落',monsterAppearances:'怪物長期特徵',equipmentSlots:'人物裝備欄位',shops:'商店',maps:'地圖與出生點',rules:'公式與成長',abilities:'能力說明'};
function renderEditor(){
  const category=editor.category,rows=Array.isArray(catalog[category])?catalog[category]:[];
  if(rows.length&&!rows.some(r=>r.id===editor.id))editor.id=rows[0].id;
  return `<p class="pause-note">修改經驗證後套用至本機遊戲。套用會重建目前地圖的怪物，角色進度保留。可匯出資料表至專案。</p><div class="editor-toolbar"><select id="editorCategory" aria-label="資料分類">${Object.entries(categoryNames).map(([id,label])=>`<option value="${id}" ${category===id?'selected':''}>${label}</option>`).join('')}</select><button data-action="export-catalog">匯出資料表</button></div>${rows.length?`<div class="editor-record-list">${rows.map(row=>`<button data-editor-id="${row.id}" class="${row.id===editor.id?'selected':''}">${esc(row.name)} <small>· ${row.id}</small></button>`).join('')}</div>`:''}<div class="editor-toolbar">${['items','monsters'].includes(category)?'<button data-action="editor-new">新增資料</button><button data-action="editor-clone">複製這筆</button><button class="danger" data-action="editor-delete">刪除這筆</button>':''}</div><label class="editor-label" for="editorJson">${category==='rules'?'公式參數（所有計算共用）':'資料內容（JSON）'}</label><textarea id="editorJson" class="json-editor" spellcheck="false" aria-describedby="editorHelp"></textarea><p id="editorHelp" class="subtle">ID 使用小寫英數與底線。商店、掉落與地圖以 ID 引用。資料缺漏、引用不存在、非法數值與買賣套利會阻止套用。若修改後不相容目前角色，請調整資料再套用。</p><div class="editor-toolbar"><button data-action="editor-apply">驗證並套用</button><button data-action="editor-revert">放棄這筆修改</button><button data-action="export">完整備份</button></div><p id="editorStatus" class="editor-status" role="status">資料庫：${esc(catalog.version)} · ${catalog.items.length} 項物品 · ${catalog.monsters.length} 種怪物 · ${catalog.maps.length} 張地圖</p>`;
}
function loadEditorValue(){
  const value=editor.category==='rules'?catalog.rules:catalog[editor.category].find(row=>row.id===editor.id);
  $('editorJson').value=JSON.stringify(value,null,2);editor.dirty=false;
}
function editorStatus(text,error=false){$('editorStatus').textContent=text;$('editorStatus').classList.toggle('error',error);}
async function applyCatalog(next,message){
  validateCatalog(next);const player=structuredClone(game.p),d=derive(player,next);
  player.hp=Math.min(player.hp,d.maxHp);player.mp=Math.min(player.mp,d.maxMp);validatePlayer(player,next);
  const nextGame=new Game(next,player);nextGame.logs=game.logs;
  await storage.replace(next,nextGame.snapshot());catalog=structuredClone(next);game=nextGame;editor.dirty=false;lastSavedRevision=game.revision;
  world.particles=[];renderPanel();renderHud();editorStatus(message);$('saveStatus').textContent='✓ 資料與角色已儲存';
}
async function applyEditor(){
  try{
    const value=JSON.parse($('editorJson').value),next=structuredClone(catalog);
    if(editor.category==='rules')next.rules=value;
    else{
      const rows=next[editor.category],index=rows.findIndex(row=>row.id===editor.id);
      if(index<0)throw new Error('找不到原資料');rows[index]=value;
    }
    const id=value.id;await applyCatalog(next,'驗證通過，修改已套用並儲存。');
    if(id){editor.id=id;renderPanel();editorStatus('驗證通過，修改已套用並儲存。');}
  }catch(error){editorStatus(`未套用：${error.message}`,true);}
}
function cloneEditor(fresh=false){
  if(editor.dirty&&!confirm('尚有未套用修改，確定新增另一筆？'))return;
  const template=catalog[editor.category].find(row=>row.id===editor.id);
  const value=structuredClone(template);let n=1;while(catalog[editor.category].some(row=>row.id===`${fresh?'new':value.id}_${n}`))n++;
  value.id=`${fresh?'new':value.id}_${n}`;value.name=fresh?(editor.category==='items'?'新道具':'新怪物'):`${value.name} 副本`;
  $('editorJson').value=JSON.stringify(value,null,2);editor.dirty=true;editor.adding=true;
  editorStatus('正在新增資料。調整後按「驗證並套用」，新 ID 必須唯一。');
}
async function addEditor(){
  try{
    const value=JSON.parse($('editorJson').value),next=structuredClone(catalog);
    next[editor.category].push(value);await applyCatalog(next,'新增成功。');editor.id=value.id;editor.adding=false;renderPanel();editorStatus('新增成功，已儲存。');
  }catch(error){editorStatus(`未新增：${error.message}`,true);}
}
async function deleteEditor(){
  if(!confirm(`確定刪除 ${editor.id}？若其他資料或目前角色引用它，將阻止刪除。`))return;
  try{
    const next=structuredClone(catalog);next[editor.category]=next[editor.category].filter(row=>row.id!==editor.id);
    await applyCatalog(next,'刪除成功。');editor.id=null;renderPanel();editorStatus('刪除成功，已儲存。');
  }catch(error){editorStatus(`未刪除：${error.message}`,true);}
}

function goField(){
  if(!game.map.safe){toast('你已經在野外');return;}
  closePanel();result(game.setGoal(game.map.exit));toast('正前往城鎮北方出口…');
}
function returnTown(){
  if(game.map.safe){toast('你已經在城鎮');return;}
  const scroll=catalog.items.find(i=>i.effect==='return'&&game.p.inventory[i.id]);
  closePanel();
  if(scroll)result(game.useItem(scroll.id));else{result(game.setGoal(game.map.exit));toast('沒有回城卷軸，正前往南方出口（免費）',4);}
}
function journeyAction(action){
  if(action==='shop')openPanel('shop');else if(action==='gear')openPanel('char','gear');else if(action==='field')goField();else if(action==='lock'){closePanel();game.lockNearest();}else if(action==='return')returnTown();else openPanel('journey');
}
async function dispatch(action,b){
  if(warehouseBusy)return;
  const id=b?.dataset.id,quantity=Number(b?.dataset.quantity||1);
  switch(action){
    case 'warehouse-deposit':warehouseMode='deposit';renderPanel();return;
    case 'warehouse-withdraw':warehouseMode='withdraw';renderPanel();return;
    case 'deposit':case 'withdraw':await transferWarehouse(action,id,quantity);return;
    case 'online-guild':await persist(true);location.assign('https://lineage-party-proof.pearlymoth33.chatgpt.site/dungeon');return;
    case 'buy':result(game.buy(b.dataset.shop,id,quantity));break;
    case 'sell':result(game.sell(id,quantity));break;
    case 'equip':result(game.equip(id,b.dataset.slot||null));break;
    case 'unequip':result(game.unequip(b.dataset.slot));break;
    case 'allocate':result(game.allocate(b.dataset.stat));break;
    case 'use':result(game.useItem(id));break;
    case 'rest':result(game.rest());break;
    case 'return':returnTown();break;
    case 'exit':{closePanel();result(game.setGoal(game.map.exit));toast('已設定出口為目的地');break;}
    case 'save':await persist(true);toast(persistenceError?'存檔失敗，請匯出備份':'已完成存檔');return;
    case 'export':download(storage.backup(catalog,game.snapshot()),`lineage-backup-${new Date().toISOString().slice(0,10)}.json`);return;
    case 'export-catalog':download(catalog,'catalog.json');return;
    case 'import':$('importFile').click();return;
    case 'journey':openPanel('journey');return;
    case 'continue-journey':journeyAction(journey().action);return;
    case 'editor':editor.adding=false;openPanel('editor');return;
    case 'editor-apply':if(editor.adding)await addEditor();else await applyEditor();return;
    case 'editor-new':cloneEditor(true);return;
    case 'editor-clone':cloneEditor();return;
    case 'editor-delete':await deleteEditor();return;
    case 'editor-revert':editor.adding=false;loadEditorValue();editorStatus('已還原這筆內容。');return;
    case 'new-character':{
      if(!confirm('確定重新建立角色？建議先匯出完整備份。這會清除重置版目前角色，保留自有資料表。'))return;
      await storage.write([['previousSnapshot',game.snapshot()],['snapshot',undefined]]);game=null;closePanel();showCreation();return;
    }
    default:return;
  }
  drainEvents();renderHud();if(activePanel)renderPanel();persist(true);
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.create){
    const key=b.dataset.create,delta=Number(b.dataset.dir);allocation[key]+=delta;renderCreation();return;
  }
  if(!game||warehouseBusy)return;
  if(b.dataset.equipmentSlot){selectedEquipmentSlot=b.dataset.equipmentSlot;renderPanel();return;}
  if(b.dataset.tab){activeTab=b.dataset.tab;$('panelBody').scrollTop=0;renderPanel();return;}
  if(b.dataset.editorId){
    if(editor.dirty&&!confirm('尚有未套用修改，確定切換？'))return;
    editor.id=b.dataset.editorId;editor.adding=false;renderPanel();return;
  }
  if(b.dataset.journey){journeyAction(b.dataset.journey);return;}
  if(b.dataset.context){openPanel('shop',b.dataset.context==='warehouse'?'warehouse':b.dataset.context==='rest'?'rest':'buy');return;}
  if(b.dataset.action)dispatch(b.dataset.action,b).catch(error=>toast(error.message,5));
});
document.addEventListener('input',e=>{
  if(e.target.id==='editorJson')editor.dirty=true;
  if(e.target.id==='potionThreshold'){
    game.p.settings.potionThreshold=Number(e.target.value);$('thresholdValue').textContent=`${e.target.value}%`;game.touch();persist(true);
  }
});
document.addEventListener('change',e=>{
  if(e.target.id==='autoPotion'){game.p.settings.autoPotion=e.target.checked;game.touch();persist(true);}
  if(e.target.id==='editorCategory'){
    if(editor.dirty&&!confirm('尚有未套用修改，確定切換分類？')){e.target.value=editor.category;return;}
    editor.category=e.target.value;editor.id=null;editor.adding=false;renderPanel();
  }
});
$('createForm').addEventListener('submit',async e=>{
  e.preventDefault();$('createError').textContent='';
  try{const player=createState(catalog,$('createName').value,$('createSex').value,allocation);await storage.replace(catalog,{schemaVersion:SAVE_VERSION,catalogVersion:catalog.version,savedAt:new Date().toISOString(),player});start(player);toast('歡迎來到暮色村莊。先買短劍與布甲，再出城冒險。',5);}
  catch(error){$('createError').textContent=error.message;}
});
$('closePanel').onclick=closePanel;
for(const [button,panel] of [['charButton','char'],['bagButton','bag'],['shopButton','shop'],['mapButton','map'],['systemButton','system']])$(button).onclick=()=>openPanel(panel);
$('zoneButton').onclick=()=>{if(!warehouseBusy)game.map.safe?goField():returnTown();};
$('attackButton').onclick=()=>{if(warehouseBusy)return;game.toggleAttack();drainEvents();renderHud();};
$('lockButton').onclick=()=>{if(warehouseBusy)return;game.lockNearest();drainEvents();renderHud();};
$('potionButton').onclick=()=>{if(warehouseBusy)return;const i=catalog.items.find(i=>i.effect==='heal'&&game.p.inventory[i.id]);result(game.useItem(i?.id));drainEvents();renderHud();persist(true);};
$('healButton').onclick=()=>{if(warehouseBusy)return;result(game.heal());drainEvents();renderHud();persist(true);};
$('importFile').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{
    if(file.size>2*1024*1024)throw new Error('備份超過 2 MB');
    const backup=parseBackup(await file.text(),storage.seed);
    if(!confirm(`將匯入 ${backup.snapshot?.player.name||'無角色資料'} 的完整備份，取代目前重置版角色與資料表。確定繼續？`))return;
    if(game)await storage.write([['previousSnapshot',game.snapshot()],['previousCatalog',catalog]]);
    await storage.replace(backup.catalog,backup.snapshot);catalog=backup.catalog;editor.dirty=false;editor.adding=false;closePanel();
    if(backup.snapshot)start(backup.snapshot.player);else{game=null;showCreation();}
    toast('完整備份已匯入');
  }catch(error){toast(`未匯入：${error.message}`,6);}
};

function clearJoy(){joy.x=joy.y=0;joy.pointer=null;$('knob').style.transform='translate(0,0)';}
function setJoy(e){
  const b=$('stick').getBoundingClientRect(),radius=(b.width-42)/2,dx=e.clientX-(b.x+b.width/2),dy=e.clientY-(b.y+b.height/2),length=Math.hypot(dx,dy),factor=length>radius?radius/length:1;
  joy.x=dx*factor/radius;joy.y=dy*factor/radius;$('knob').style.transform=`translate(${dx*factor}px,${dy*factor}px)`;
}
$('stick').addEventListener('pointerdown',e=>{if(activePanel||!game)return;e.preventDefault();joy.pointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);setJoy(e);});
$('stick').addEventListener('pointermove',e=>{if(e.pointerId===joy.pointer)setJoy(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stick').addEventListener(event,clearJoy);
window.addEventListener('blur',()=>{keys.clear();clearJoy();world?.clearDrag();persist(true);});
document.addEventListener('visibilitychange',()=>{keys.clear();clearJoy();world?.clearDrag();if(document.hidden)persist(true);});
window.addEventListener('pagehide',()=>persist(true));
document.addEventListener('keydown',e=>{
  if(e.key==='Tab'&&activePanel){
    const focusable=[...$('panel').querySelectorAll('button:not(:disabled),input,select,textarea,a[href]')].filter(x=>x.offsetParent!==null),first=focusable[0],last=focusable.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
  if(e.code==='Escape'){if(activePanel)closePanel();else if(game){game.cancelCombat();renderHud();}return;}
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||!game||!$('createOverlay').hidden)return;
  if(activePanel)return;
  const key=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  keys.add(key);if(e.repeat)return;
  if(key===' ')game.toggleAttack();if(key==='e')game.lockNearest();
  if(key==='p')$('potionButton').click();if(key==='h')$('healButton').click();if(key==='r')returnTown();
  if(key==='c')openPanel('char');if(key==='b')openPanel('bag');if(key==='m')openPanel('map');
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));

function frame(now){
  const dt=Math.min(.05,(now-lastFrame)/1000||0);lastFrame=now;
  if(game&&running){
    if(!activePanel&&!document.hidden&&$('createOverlay').hidden){
      const x=joy.x+world.drag.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),y=joy.y+world.drag.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      game.update(dt,{x,y});drainEvents();saveTimer+=dt;
      if(saveTimer>=3){saveTimer=0;persist(true);}
    }
    world.render(game,dt);hudTimer+=dt;if(hudTimer>.15){hudTimer=0;renderHud();}
  }
  if(toastUntil&&now>toastUntil){$('toast').hidden=true;$('panelNotice').hidden=true;$('systemMessages').classList.remove('has-toast');toastUntil=0;}
  requestAnimationFrame(frame);
}
function fatal(error){
  running=false;$('loading').hidden=true;$('fatal').hidden=false;$('fatalMessage').textContent=error.message||String(error);
}
$('retryButton').onclick=()=>location.reload();
$('rawBackup').onclick=async()=>{try{download({catalog:await storage.get('catalog'),snapshot:await storage.get('snapshot')},'lineage-recovery-data.json');}catch(error){$('fatalMessage').textContent=error.message;}};
window.addEventListener('error',e=>{if(e.error)fatal(e.error);});
window.addEventListener('unhandledrejection',e=>fatal(e.reason));

// Read-only diagnostics for debugging and browser verification. Returned objects are clones.
Object.defineProperty(window,'lineageMvp',{value:Object.freeze({
  inspect:()=>game?structuredClone({snapshot:game.snapshot(),derived:game.derived,enemies:game.enemies,goal:game.goal,target:game.target,autoAttack:game.autoAttack,cooldowns:game.cooldowns,paused:!!activePanel,camera:world.camera,region:REGION_AT(game.map,game.p),art:{version:'integrated-0.10.0',shieldVisible:false,sideFrames:6,playerVisual:world.lastPlayerVisual,occluded:world.lastOccluded,warehouseBusy,drag:{...world.drag}},view:{width:world.width,height:world.height},logs:game.logs}):null
})});

try{
  await storage.open();const loaded=await storage.load();catalog=loaded.catalog;
  [actorArt,worldArt,portraits]=await Promise.all([loadActorArt(),loadWorldArt(),loadPortraits()]);world=new World($('game'),$('stage'),point=>{
    if(!game||activePanel||!$('createOverlay').hidden)return;
    const b=game.map.buildings.find(b=>point.x>b.x-95&&point.x<b.x+95&&point.y>b.y-62&&point.y<b.y+90);
    if(b){openPanel('shop',b.action==='warehouse'?'warehouse':b.action==='rest'?'rest':'buy');return;}
    const e=game.enemies.filter(e=>!e.dead).sort((a,b)=>distance(a,point)-distance(b,point)).find(e=>distance(e,point)<38);
    if(e){game.select(e.id);renderHud();return;}
    result(game.setGoal(point));
  },actorArt,worldArt);
  $('loading').hidden=true;if(loaded.snapshot)start(loaded.snapshot.player);else showCreation();
  requestAnimationFrame(frame);
}catch(error){fatal(error);}
