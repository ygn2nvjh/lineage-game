import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog, SLOTS, compatibleSlots} from '../src/catalog.mjs';
import {Game,createState,derive,buyPrice,hitChance,validatePlayer,expRequired} from '../src/core.mjs';
import {parseBackup,validateSnapshot} from '../src/storage.mjs';
import {upgradeData} from '../src/migrations.mjs';

const catalog=JSON.parse(readFileSync(new URL('../data/game/catalog.json',import.meta.url)));
const clone=structuredClone;
function seeded(seed=17){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function setup(random=seeded()){return new Game(catalog,createState(catalog,'循環測試'),{random});}
function advance(g,seconds){for(let t=0;t<seconds;t+=.05)g.update(.05);}
function walkExit(g){const id=g.p.mapId;assert(g.setGoal(g.map.exit).ok);for(let n=0;n<2000&&g.p.mapId===id;n++)g.update(.05);assert.notEqual(g.p.mapId,id,'行走應到達出口並換圖');}
function killOne(g){
  const kills=g.p.kills,e=g.nearest();assert(e,'附近應有怪物');g.select(e.id);g.toggleAttack();
  for(let n=0;n<2500&&g.p.kills===kills&&g.p.mapId==='field';n++)g.update(.05);
  assert.equal(g.p.kills,kills+1,'戰鬥應成功結算擊殺');assert.equal(g.p.mapId,'field');
}

test('正式資料結構、數值與引用完整',()=>{assert.equal(validateCatalog(clone(catalog)).maps.length,2);});
test('資料驗證阻擋錯誤引用、重複 ID、缺漏公式、非法數值與買賣套利',()=>{
  const invalid=[
    c=>c.monsters[0].drops[0].itemId='missing',
    c=>c.items.push(clone(c.items[0])),
    c=>delete c.rules.combat.baseHit,
    c=>c.rules.combat.playerAttackSeconds=0,
    c=>c.maps[1].spawns[0].x=-1,
    c=>c.shops[0].items.push('missing'),
    c=>c.items[0].sellPrice=c.items[0].price,
    c=>c.maps[0].safe=false,
    c=>c.items[5].effect='unknown',
    c=>c.rules.combat.minHit=1,
    c=>c.maps[0].spawn={x:300,y:330}
  ];
  for(const mutate of invalid){const c=clone(catalog);mutate(c);assert.throws(()=>validateCatalog(c));}
});
test('創角配點驗證；六項能力都影響實際共用計算',()=>{
  assert.throws(()=>createState(catalog,'', 'male'));
  assert.throws(()=>createState(catalog,'測試','male',{str:999}));
  const p=createState(catalog),d=derive(p,catalog);
  for(const [stat,field] of [['str','damageMin'],['con','maxHp'],['int','healing'],['wis','maxMp'],['cha','discount']]){
    const next=clone(p);next.stats[stat]+=2;assert(derive(next,catalog)[field]>d[field],`${stat} 應影響 ${field}`);
  }
  const next=clone(p);next.stats.dex+=3;
  assert(hitChance(next,catalog.monsters[0],catalog)>hitChance(p,catalog.monsters[0],catalog));
  assert(hitChance(next,catalog.monsters[0],catalog,false)<hitChance(p,catalog.monsters[0],catalog,false));
  next.stats.cha+=5;assert(buyPrice(catalog.items[0],next,catalog)<buyPrice(catalog.items[0],p,catalog));
});
test('購買、出售與裝備共用狀態；不足、超量與非法操作不改變狀態',()=>{
  const g=setup(),before=clone(g.p);
  assert.equal(g.buy('town_shop','long_sword').ok,false);assert.deepEqual(g.p,before);
  assert.equal(g.buy('town_shop','short_sword',-1).ok,false);assert.deepEqual(g.p,before);
  assert(g.buy('town_shop','short_sword').ok);assert.equal(g.p.gold,130);assert.equal(g.p.inventory.short_sword,1);
  const unarmed=g.derived.damageMin;assert(g.equip('short_sword').ok);assert(g.derived.damageMin>unarmed);
  assert.equal(g.sell('short_sword').ok,false);assert(g.unequip('weapon').ok);assert(g.sell('short_sword').ok);assert(!g.p.inventory.short_sword);
  g.travel('field');const gold=g.p.gold;assert.equal(g.buy('town_shop','red_potion').ok,false);assert.equal(g.sell('red_potion').ok,false);assert.equal(g.p.gold,gold);
});
test('裝備增加與卸下確實影響 HP／MP、傷害與減傷，不重複加總負重',()=>{
  const g=setup();g.p.gold=2000;
  for(const id of ['long_sword','leather_armor','wisdom_ring'])assert(g.buy('town_shop',id).ok);
  const before=g.derived;
  for(const id of ['long_sword','leather_armor','wisdom_ring'])assert(g.equip(id).ok);
  const after=g.derived;assert(after.damageMin>before.damageMin);assert(after.maxHp>before.maxHp);assert(after.maxMp>before.maxMp);assert.equal(after.defense,7);assert.equal(after.weight,before.weight);
  g.p.hp=after.maxHp;g.p.mp=after.maxMp;g.unequip('armor');g.unequip('ring1');assert(g.p.hp<=g.derived.maxHp);assert(g.p.mp<=g.derived.maxMp);
  const bare=setup(()=>.5),armored=setup(()=>.5);armored.p.gold=1000;armored.buy('town_shop','leather_armor');armored.equip('leather_armor');
  const losses=[];
  for(const x of [bare,armored]){x.p.settings.autoPotion=false;x.travel('field');const e=x.enemies[0];x.p.x=e.x;x.p.y=e.y;const hp=x.p.hp;x.enemyAttack(e);advance(x,.45);losses.push(hp-x.p.hp);}
  assert(losses[1]<losses[0],'防具應降低同條件的實際受傷');
});

test('13 格裝備都可穿戴，雙戒指依實際持有件數限制，不能出售穿戴中的副本',()=>{
  const g=setup();g.p.gold=10000;
  for(const slot of SLOTS){
    const i=catalog.items.find(i=>compatibleSlots(i).includes(slot));assert(i,`${slot} 有對應裝備`);
    assert(g.buy('town_shop',i.id).ok);assert(g.equip(i.id,slot).ok);
  }
  assert.equal(Object.keys(g.p.equipment).length,13);assert(Object.values(g.p.equipment).every(Boolean));validatePlayer(g.p,catalog);
  assert.equal(g.p.inventory.wisdom_ring,2);assert.equal(g.derived.gear.wis,5);assert.equal(g.sell('wisdom_ring').ok,false);
  assert(g.unequip('ring1').ok);assert(g.sell('wisdom_ring').ok);assert.equal(g.p.inventory.wisdom_ring,1);
  assert.equal(g.equip('wisdom_ring','ring1').ok,false);assert.equal(g.equip('short_sword','helmet').ok,false);
  validatePlayer(g.p,catalog);
  const invalid=structuredClone(g.p);invalid.equipment.ring1='wisdom_ring';assert.throws(()=>validatePlayer(invalid,catalog));
});

test('0.6.0 舊存檔與自訂資料升級保留角色、裝備、背包、配點與平衡，不重複遷移',()=>{
  const legacy=JSON.parse(readFileSync(new URL('fixtures/v060-catalog.json',import.meta.url)));
  legacy.rules.combat.baseHit=.79;legacy.items.find(i=>i.id==='red_potion').power=53;
  const p=createState(catalog,'保留舊角色');p.gold=321;p.level=3;p.xp=8;p.points=2;p.kills=17;
  p.inventory.short_sword=1;p.inventory.cloth_armor=1;p.inventory.wisdom_ring=1;
  p.equipment={weapon:'short_sword',armor:'cloth_armor',accessory:'wisdom_ring'};
  const original=structuredClone(p),snapshot={schemaVersion:1,catalogVersion:legacy.version,savedAt:'2026-10-26T00:00:00Z',player:p};
  const upgraded=upgradeData(legacy,snapshot,catalog);assert(upgraded.changed);
  assert.equal(legacy.schemaVersion,1);assert.deepEqual(p,original);
  const q=upgraded.snapshot.player;
  for(const key of ['name','gold','level','xp','points','kills','stats','inventory','hp','mp'])assert.deepEqual(q[key],original[key]);
  assert.equal(q.equipment.ring1,'wisdom_ring');assert.equal(q.equipment.weapon,'short_sword');assert.equal(q.equipment.armor,'cloth_armor');
  assert.equal(upgraded.catalog.rules.combat.baseHit,.79);assert.equal(upgraded.catalog.items.find(i=>i.id==='red_potion').power,53);
  assert.equal(upgraded.catalog.monsters.length,9);validateSnapshot(upgraded.snapshot,upgraded.catalog);
  const again=upgradeData(upgraded.catalog,upgraded.snapshot,catalog);assert.equal(again.changed,false);assert.deepEqual(again.catalog,upgraded.catalog);
  const backup=parseBackup(JSON.stringify({format:'lineage-mvp-backup',schemaVersion:1,catalog:legacy,snapshot}),catalog);
  assert.equal(backup.snapshot.player.equipment.ring1,'wisdom_ring');assert.equal(backup.snapshot.player.kills,17);
  assert.throws(()=>upgradeData(legacy,{...snapshot,catalogVersion:'inconsistent'},catalog));
});

test('使用者指定的怪物特徵具有獨立資料與有效怪物引用',()=>{
  const byId=Object.fromEntries(catalog.monsterAppearances.map(a=>[a.id,a]));
  assert.equal(byId.skeleton.weapon,'scimitar');
  assert.deepEqual([byId.spartoi.colorTone,byId.spartoi.weapon,byId.spartoi.shield],['blue','scimitar','large_wooden']);
  assert.deepEqual([byId.skeleton_fighter.colorTone,byId.skeleton_fighter.weapon,byId.skeleton_fighter.shield,byId.skeleton_fighter.helmet],['gold','sword','large_steel',true]);
  for(const id of ['skeleton','spartoi','skeleton_fighter']){
    assert.equal(catalog.monsters.find(m=>m.id===id).appearanceId,id);
    assert(catalog.maps.find(m=>m.id==='field').spawns.some(s=>s.monsterId===id));
  }
  const invalid=structuredClone(catalog);invalid.monsters.find(m=>m.id==='spartoi').appearanceId='missing';assert.throws(()=>validateCatalog(invalid));
});
test('藥水與治療消耗、冷卻、溢補及 MP 限制',()=>{
  const g=setup();g.p.settings.autoPotion=false;const stock=g.p.inventory.red_potion;
  assert.equal(g.useItem('red_potion').ok,false);assert.equal(g.p.inventory.red_potion,stock);
  g.p.hp-=10;assert(g.useItem('red_potion').ok);assert.equal(g.p.hp,g.derived.maxHp);assert.equal(g.p.inventory.red_potion,stock-1);
  g.p.hp-=20;assert.equal(g.useItem('red_potion').ok,false);advance(g,1.5);assert(g.useItem('red_potion').ok);
  g.p.hp-=40;const mp=g.p.mp;assert(g.heal().ok);assert.equal(g.p.mp,mp-catalog.rules.healing.manaCost);assert.equal(g.heal().ok,false);
  advance(g,6);g.p.mp=0;g.p.hp-=10;assert.equal(g.heal().ok,false);
});
test('擊殺只結算一次；重生、升級多階與最高等級正確',()=>{
  const g=setup(()=>.5);g.travel('field');const e=g.enemies[0];e.hp=0;assert(g.defeat(e));const kills=g.p.kills,gold=g.p.gold,xp=g.p.xp;
  assert.equal(g.defeat(e),false);assert.equal(g.p.kills,kills);assert.equal(g.p.gold,gold);assert.equal(g.p.xp,xp);
  advance(g,catalog.monsters.find(m=>m.id===e.monsterId).respawnSeconds+.2);assert.equal(e.dead,false);assert.equal(e.hp,catalog.monsters.find(m=>m.id===e.monsterId).hp);
  g.grantExp(1000);assert(g.p.level>2);assert(g.p.points>=2);assert.equal(g.p.hp,g.derived.maxHp);assert.equal(g.p.mp,g.derived.maxMp);
  assert(g.allocate('str').ok);assert.equal(g.allocate('invalid').ok,false);
  g.p.level=catalog.rules.growth.maxLevel-1;g.p.xp=0;g.grantExp(expRequired(g.p.level,catalog));assert.equal(g.p.level,catalog.rules.growth.maxLevel);assert.equal(g.p.xp,0);
});
test('死亡回城、清除追擊、休息後能再次出發',()=>{
  const g=setup(()=>.5);g.p.settings.autoPotion=false;g.travel('field');const gold=g.p.gold,xp=g.p.xp;
  const e=g.enemies[0];g.p.x=e.x;g.p.y=e.y;g.p.hp=1;g.target=e.id;g.autoAttack=true;g.enemyAttack(e);advance(g,1.3);
  assert.equal(g.p.mapId,'town');assert.equal(g.p.deaths,1);assert.equal(g.autoAttack,false);assert.equal(g.target,null);assert.equal(g.enemies.length,0);assert.equal(g.p.gold,gold);assert.equal(g.p.xp,xp);
  assert(g.p.hp>0);assert(g.rest().ok);assert.equal(g.p.hp,g.derived.maxHp);walkExit(g);assert.equal(g.p.mapId,'field');
});
test('地圖障礙、出口防反覆換圖、無回城卷也能免費回城',()=>{
  const g=setup();assert.equal(g.setGoal({x:300,y:330}).ok,false);assert.equal(g.travelExit().ok,false);
  walkExit(g);assert.equal(g.p.mapId,'field');advance(g,2);assert.equal(g.p.mapId,'field');
  delete g.p.inventory.return_scroll;assert.equal(g.useItem('return_scroll').ok,false);walkExit(g);assert.equal(g.p.mapId,'town');advance(g,2);assert.equal(g.p.mapId,'town');
});
test('滿負重時購買與拾取不會超額；正常金幣與經驗仍結算',()=>{
  const g=setup(()=>0);g.p.inventory.monster_fang=440;const gold=g.p.gold,stock=g.p.inventory.red_potion;
  assert.equal(g.buy('town_shop','red_potion',10).ok,false);assert.equal(g.p.gold,gold);assert.equal(g.p.inventory.red_potion,stock);
  g.travel('field');g.p.inventory.monster_fang=1000;const e=g.enemies[0];e.hp=0;g.defeat(e);assert.equal(g.p.inventory.monster_fang,1000);assert(g.p.gold>gold);assert(g.p.xp>0);
});
test('存檔與完整備份驗證，阻止損毀與錯誤資料版本',()=>{
  const g=setup();assert(validatePlayer(g.p,catalog));const snap=g.snapshot();assert(validateSnapshot(snap,catalog));
  const backup={format:'lineage-mvp-backup',schemaVersion:1,catalog,snapshot:snap};assert.equal(parseBackup(JSON.stringify(backup)).snapshot.player.name,'循環測試');
  for(const mutate of [p=>p.hp=-1,p=>p.gold=-1,p=>p.equipment.weapon='missing',p=>p.inventory.missing=1,p=>p.x=NaN,p=>p.stats.str=Infinity,p=>p.xp=10000]){
    const p=clone(g.p);mutate(p);assert.throws(()=>validatePlayer(p,catalog));
  }
  assert.throws(()=>validateSnapshot({...snap,catalogVersion:'old'},catalog));assert.throws(()=>parseBackup('{"format":"unknown"}'));
});
test('兩輪完整最小循環：購買→裝備→步行出城→打怪升級→回城補給→再次出發',()=>{
  const g=setup();assert(g.buy('town_shop','short_sword').ok);assert(g.buy('town_shop','cloth_armor').ok);assert(g.buy('town_shop','red_potion',10).ok);assert(g.equip('short_sword').ok);assert(g.equip('cloth_armor').ok);
  for(let round=0;round<2;round++){
    assert(g.rest().ok);walkExit(g);
    for(let i=0;i<5;i++)killOne(g);
    assert(g.p.level>=2);
    if(round===0)assert(g.useItem('return_scroll').ok);else walkExit(g);
    assert.equal(g.p.mapId,'town');const qty=g.p.inventory.monster_fang||0;if(qty)assert(g.sell('monster_fang',qty).ok);
    assert(g.buy('town_shop','red_potion',3).ok);assert(g.rest().ok);
    validateSnapshot(g.snapshot(),catalog);
  }
  assert.equal(g.p.kills,10);assert.equal(g.p.deaths,0);assert(g.p.milestones.resupplied);assert(g.p.gold>0);
  const restored=new Game(catalog,g.snapshot().player);assert.equal(restored.p.kills,10);walkExit(restored);assert.equal(restored.p.milestones.fieldVisits,3);
});

test('整合動作：蓄力不扣血，接觸只結算一次，橫砍縱砍交替',()=>{
 const g=setup(()=>.5);g.travel('field');const e=g.enemies[0];g.p.x=e.x-40;g.p.y=e.y;e.cooldown=99;const hp=e.hp;
 assert(g.attack(e));assert.equal(g.playerAnimation.style,'slash');assert.equal(e.hp,hp);advance(g,.15);assert.equal(e.hp,hp);advance(g,.15);assert(e.hp<hp);const after=e.hp;advance(g,.25);assert.equal(e.hp,after);advance(g,.4);assert(g.attack(e));assert.equal(g.playerAnimation.style,'chop');
});
test('整合動作：目標離開接觸範圍會打空；待擊倒動畫完成才回城',()=>{
 const g=setup(()=>.5);g.travel('field');const e=g.enemies[0];g.p.x=e.x-40;g.p.y=e.y;e.cooldown=99;const hp=e.hp;g.attack(e);g.p.x-=100;advance(g,.4);assert.equal(e.hp,hp);
 g.p.settings.autoPotion=false;g.p.x=e.x-40;g.p.y=e.y;g.p.hp=1;e.cooldown=0;g.enemyAttack(e);advance(g,.45);assert.equal(g.p.hp,0);assert(g.deathPending>0);assert.equal(g.p.mapId,'field');assert.equal(g.useItem('red_potion').ok,false);advance(g,.9);assert.equal(g.p.mapId,'town');assert.equal(g.p.deaths,1);assert(g.p.hp>0);
});

test('新版地圖：安全村北接墓園，同圖跨橋到密林，六種指定怪物分區',()=>{
 const g=setup(()=>.5),town=g.map;assert(town.safe);assert.equal(town.exit.to,'field');g.travel('field');const field=g.map,river=field.river;assert.equal(field.regions.length,2);assert(field.spawns.every(s=>s.y>river.y+river.height?['skeleton','spartoi','skeleton_fighter'].includes(s.monsterId):['werewolf','night_werewolf','white_wolf_king'].includes(s.monsterId)));assert(g.blocked(200,1000));assert(!g.blocked(576,1000));
 // Route from off-center cemetery to off-center forest must pass through the bridge.
 g.enemies=[];Object.assign(g.p,{x:220,y:1600});assert(g.setGoal({x:870,y:660}).ok);let bridge=false;for(let i=0;i<800&&g.goal;i++){g.update(.05);assert.equal(g.p.mapId,'field');if(g.p.y>=river.y&&g.p.y<=river.y+river.height){bridge=true;assert(g.p.x>=river.bridge.x+13&&g.p.x<=river.bridge.x+river.bridge.width-13);}}assert(bridge);assert(Math.hypot(g.p.x-870,g.p.y-660)<6);
});
test('狼人特徵為資料來源，白狼王1.2倍及雙手反握短刀；舊版資料升級保留進度和自訂平衡',()=>{
 const a=Object.fromEntries(catalog.monsterAppearances.map(a=>[a.id,a]));assert.equal(a.werewolf.colorTone,'brown');assert.equal(a.werewolf.armor,'ragged_cloth_shorts');assert.equal(a.night_werewolf.colorTone,'gray_black');assert.equal(a.night_werewolf.armor,'simple_leather');assert.equal(a.white_wolf_king.scale,1.2);assert.equal(a.white_wolf_king.armor,'fine_leather');assert.equal(a.white_wolf_king.weapon,'dual_reverse_daggers');
 const old=JSON.parse(readFileSync(new URL('./fixtures/v061-catalog.json',import.meta.url)));old.items.find(i=>i.id==='red_potion').power=57;const p=createState(old,'世界更新保留');p.gold=321;p.kills=17;p.mapId='field';Object.assign(p,old.maps[1].spawn);const snapshot={schemaVersion:2,catalogVersion:old.version,player:p};const up=upgradeData(old,snapshot,catalog);assert(up.changed);assert.equal(up.catalog.version,'mvp-0.9.0');assert.equal(up.catalog.items.find(i=>i.id==='red_potion').power,57);assert.equal(up.snapshot.player.gold,321);assert.equal(up.snapshot.player.kills,17);assert.deepEqual({x:up.snapshot.player.x,y:up.snapshot.player.y},catalog.maps[1].spawn);assert.equal(upgradeData(up.catalog,up.snapshot,catalog).changed,false);
});
test('倉庫存領守恆、穿戴保留、數量與負重拒絕不改變狀態，離城無法存領',()=>{
 const g=setup();g.p.inventory.short_sword=2;g.equip('short_sword');const before=structuredClone(g.p);
 assert.equal(g.deposit('short_sword',2).ok,false);assert.deepEqual(g.p,before);
 assert(g.deposit('short_sword').ok);assert.equal(g.p.inventory.short_sword,1);assert.equal(g.p.warehouse.short_sword,1);validatePlayer(g.p,catalog);
 assert(g.withdraw('short_sword').ok);assert.equal(g.p.inventory.short_sword,2);assert.deepEqual(g.p.warehouse,{});
 for(const n of [0,-1,1.5,NaN,Infinity,100001]){const p=structuredClone(g.p);assert.equal(g.deposit('short_sword',n).ok,false);assert.deepEqual(g.p,p);}
 g.p.warehouse.red_potion=10000;const p=structuredClone(g.p);assert.equal(g.withdraw('red_potion',10000).ok,false);assert.deepEqual(g.p,p);
 g.p.mapId='field';assert.equal(g.deposit('short_sword').ok,false);assert.equal(g.withdraw('red_potion').ok,false);
});
test('0.8倉庫升級僅增加設施，保留地圖、自訂平衡、位置及完整角色；升級不重複',()=>{
 const old=structuredClone(catalog);old.version='mvp-0.8.0';const town=old.maps.find(m=>m.id==='town');town.buildings=town.buildings.filter(b=>b.action!=='warehouse');town.obstacles=town.obstacles.filter(b=>b.id!=='warehouse');town.paths=town.paths.filter(b=>b.id!=='warehouse_path');old.items[0].price+=3;
 const player=createState(old,'舊角色');delete player.warehouse;player.gold=789;player.x=520;player.y=550;const snap={schemaVersion:2,catalogVersion:old.version,player};
 const up=upgradeData(old,snap,catalog);assert.equal(up.snapshot.schemaVersion,3);assert.deepEqual(up.snapshot.player,{...player,warehouse:{}});assert.deepEqual(up.catalog.items,old.items);assert.deepEqual(up.catalog.maps[1],old.maps[1]);assert.equal(up.catalog.maps[0].buildings.filter(b=>b.action==='warehouse').length,1);assert.equal(upgradeData(up.catalog,up.snapshot,catalog).changed,false);
 const bad=structuredClone(up.snapshot);bad.player.warehouse.red_potion=-1;assert.throws(()=>validateSnapshot(bad,up.catalog));
});
