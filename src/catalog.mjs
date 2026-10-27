import {riverBlocked} from './navigation.mjs';
export const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const SLOTS = ['weapon','helmet','necklace','armor','cloak','gloves','shield','boots','ring1','ring2','earring','belt','underwear'];
export const GEAR_TYPES = ['weapon','armor','accessory'];
export const compatibleSlots = item => item?.slot === 'ring' ? ['ring1','ring2'] : SLOTS.includes(item?.slot) ? [item.slot] : [];
const TYPES = ['weapon', 'armor', 'accessory', 'consumable', 'material'];
const fail = message => { throw new Error(message); };
const record = (v, path) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${path} 必須是物件`);
};
const number = (v, path, min = 0, max = 1e6, integer = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) fail(`${path} 必須是 ${min}～${max} 的${integer ? '整數' : '數值'}`);
};
const string = (v, path, max = 120) => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) fail(`${path} 必須是 1～${max} 字的文字`);
};
const bool = (v, path) => { if (typeof v !== 'boolean') fail(`${path} 必須是 true 或 false`); };
const array = (v, path, max = 500) => { if (!Array.isArray(v) || v.length > max) fail(`${path} 必須是陣列（最多 ${max} 筆）`); };
const allowed = (v, options, path) => { if (!options.includes(v)) fail(`${path} 必須是 ${options.join(' / ')}`); };
const exactKeys = (obj, keys, path) => {
  record(obj, path);
  for (const key of Object.keys(obj)) if (!keys.includes(key)) fail(`${path}.${key} 是不支援的欄位`);
  for (const key of keys) if (!(key in obj)) fail(`${path}.${key} 缺少欄位`);
};
const RANGES = {
  health: {base:[1,10000],perCon:[0,100],perLevel:[0,1000],regenBase:[0,100],regenPerCon:[0,100]},
  mana: {base:[0,10000],perWis:[0,100],perLevel:[0,1000],regenBase:[0,100],regenPerWis:[0,100]},
  combat: {baseDamage:[1,1000],damagePerStr:[0,100],damagePerLevel:[0,100],baseHit:[0,1],hitPerDex:[0,1],hitPerLevel:[0,1],evasionPerDex:[0,1],minHit:[0,1],maxHit:[0,1],playerAttackSeconds:[0.1,10],armorReduction:[0,10],minimumDamage:[1,100],interactRange:[30,100],acBase:[-100,100],armorClassPerDex:[0,10]},
  growth: {baseExp:[1,100000],expMultiplier:[1,2],maxLevel:[2,100],pointsPerLevel:[0,10]},
  weight: {base:[1,10000],perStr:[0,1000],perCon:[0,1000]},
  economy: {discountPerCha:[0,0.1],maxDiscount:[0,0.8]},
  healing: {base:[1,1000],perInt:[0,100],perLevel:[0,100],manaCost:[1,1000],cooldown:[0.1,60]},
  recovery: {interval:[1,60],townMultiplier:[1,20],potionCooldown:[0.1,10],deathHpRatio:[0.1,1]},
  movement: {playerSpeed:[30,300],playerRadius:[8,20],enemyRadius:[8,25],leash:[100,500],aggroRadius:[30,250],attackRange:[30,70]}
};

export function validateCatalog(c) {
  exactKeys(c, ['schemaVersion','version','title','provenance','abilities','rules','items','monsters','shops','maps','equipmentSlots','monsterAppearances'], '資料庫');
  if (c.schemaVersion !== 2) fail('不支援的資料庫版本');
  string(c.version, 'version'); string(c.title, 'title'); string(c.provenance, 'provenance', 1000);
  for (const name of ['abilities','items','monsters','shops','maps','equipmentSlots','monsterAppearances']) {
    array(c[name], name);
    const ids = new Set();
    for (const row of c[name]) {
      record(row, name); string(row.id, `${name}.id`, 64);
      if (!/^[a-z][a-z0-9_]*$/.test(row.id)) fail(`${name}.id 只接受小寫英數與底線`);
      if (ids.has(row.id)) fail(`${name} 的 ID 重複：${row.id}`);
      ids.add(row.id); string(row.name, `${name}.${row.id}.name`, 40);
    }
  }
  if(c.equipmentSlots.length!==13||SLOTS.some(id=>!c.equipmentSlots.some(s=>s.id===id)))fail('必須保留完整 13 個裝備欄位');
  const positions=new Set();
  for(const s of c.equipmentSlots){
    string(s.icon,'equipmentSlot.icon',8);number(s.column,'equipmentSlot.column',1,3,true);number(s.row,'equipmentSlot.row',1,6,true);
    const key=`${s.column}:${s.row}`;
    if(positions.has(key)||(s.column===2&&s.row>1))fail('裝備欄位不得重疊或遮擋中央人物');positions.add(key);
  }
  for(const a of c.monsterAppearances){
    allowed(a.family,['skeleton','werewolf'],'appearance.family');    if(a.family==='skeleton'){
      allowed(a.colorTone,['bone','blue','gold'],'appearance.colorTone');allowed(a.weapon,['scimitar','sword'],'appearance.weapon');allowed(a.shield,['none','large_wooden','large_steel'],'appearance.shield');
    }else{
      allowed(a.colorTone,['brown','gray_black','white'],'appearance.colorTone');allowed(a.weapon,['claws','dual_reverse_daggers'],'appearance.weapon');allowed(a.armor,['ragged_cloth_shorts','simple_leather','fine_leather'],'appearance.armor');allowed(a.shield,['none'],'appearance.shield');number(a.scale,'appearance.scale',.5,2);
    }
    bool(a.helmet,'appearance.helmet');string(a.description,'appearance.description',400);
    array(a.requiredTraits,'appearance.requiredTraits',4);
    if(new Set(a.requiredTraits).size!==a.requiredTraits.length)fail('怪物必要特徵不可重複');
    for(const trait of a.requiredTraits)allowed(trait,['colorTone','weapon','shield','helmet','armor','scale'],'appearance.requiredTraits');
  }
  if (c.abilities.length !== 6 || STAT_KEYS.some(k => !c.abilities.some(a => a.id === k))) fail('六項能力必須保留 str/dex/con/int/wis/cha');
  for (const a of c.abilities) string(a.description, `${a.id}.description`, 240);
  const r = c.rules;
  exactKeys(r, ['statBase','creationPoints','baseStats','defaultAllocation','startGold','startItems',...Object.keys(RANGES),'restCost','starterWeapon'], 'rules');
  number(r.statBase, 'statBase', 1, 30, true); number(r.creationPoints, 'creationPoints', 0, 30, true);
  for (const name of ['baseStats','defaultAllocation']) {
    exactKeys(r[name], STAT_KEYS, name);
    for (const k of STAT_KEYS) number(r[name][k], `${name}.${k}`, name === 'baseStats' ? r.statBase : 0, name === 'baseStats' ? 99 : r.creationPoints, true);
  }
  if (Object.values(r.defaultAllocation).reduce((a,b) => a+b,0) !== r.creationPoints) fail('預設配點總數必須等於創角點數');
  number(r.startGold, 'startGold', 0, 1e6, true); number(r.restCost, 'restCost', 0, 10000, true);
  for (const [name, fields] of Object.entries(RANGES)) {
    exactKeys(r[name], Object.keys(fields), name);
    for (const [key, range] of Object.entries(fields)) number(r[name][key], `${name}.${key}`, ...range);
  }
  for (const key of ['baseExp','maxLevel','pointsPerLevel']) number(r.growth[key], `growth.${key}`, ...RANGES.growth[key], true);
  if (r.combat.minHit > r.combat.maxHit) fail('最低命中不得高於最高命中');
  const byId = (table, id) => c[table].find(x => x.id === id) || fail(`${table} 找不到 ID：${id}`);
  for (const i of c.items) {
    allowed(i.type, TYPES, `${i.id}.type`);
    for (const k of ['price','sellPrice']) number(i[k], `${i.id}.${k}`, 0, 1e6, true);
    number(i.weight, `${i.id}.weight`, 0, 10000);
    string(i.description, `${i.id}.description`, 400);
    if (i.price > 0 && i.sellPrice > Math.max(1, Math.ceil(i.price * (1-r.economy.maxDiscount)))) fail(`${i.id} 售價高於最低買價，會產生買賣套利`);
    if (GEAR_TYPES.includes(i.type)) {
      if(!compatibleSlots(i).length)fail(`${i.id}.slot 不是有效裝備欄位`);
      if(i.type==='weapon'&&i.slot!=='weapon')fail('武器必須穿戴在武器欄');
      if(i.type!=='weapon'&&i.slot==='weapon')fail('武器欄只接受武器');
      record(i.bonuses, `${i.id}.bonuses`);
      for (const [k,v] of Object.entries(i.bonuses)) {
        allowed(k, STAT_KEYS, `${i.id}.bonuses`); number(v, `${i.id}.bonuses.${k}`, -9, 50, true);
      }
    }
    if (i.type === 'weapon') {
      number(i.damageMin, `${i.id}.damageMin`, 1, 1000, true); number(i.damageMax, `${i.id}.damageMax`, i.damageMin, 1000, true);
    }
    if (i.type === 'armor') number(i.defense, `${i.id}.defense`, 0, 100, true);
    if (i.type === 'consumable') {
      allowed(i.effect, ['heal','return'], `${i.id}.effect`);
      if (i.effect === 'heal') number(i.power, `${i.id}.power`, 1, 10000, true);
    }
  }
  const starter = byId('items', r.starterWeapon);
  if (starter.type !== 'weapon') fail('starterWeapon 必須是武器');
  record(r.startItems, 'startItems');
  for (const [id,qty] of Object.entries(r.startItems)) { byId('items',id); number(qty, `startItems.${id}`, 1, 100, true); }
  if (!c.items.some(x => x.effect === 'heal') || !c.items.some(x => x.effect === 'return')) fail('最小循環需要藥水與回城道具');
  for (const m of c.monsters) {
    allowed(m.sprite, ['goblin','orc','skeleton','ogre','werewolf'], `${m.id}.sprite`);
    if(['skeleton','werewolf'].includes(m.sprite)){
      const appearance=byId('monsterAppearances',m.appearanceId);
      if(appearance.family!==m.sprite)fail('怪物特徵與基礎形體不一致');
    }else if(m.appearanceId)byId('monsterAppearances',m.appearanceId);
    for (const key of ['level','hp','damageMin','damageMax','exp','goldMin','goldMax']) number(m[key], `${m.id}.${key}`, ['goldMin','goldMax'].includes(key)?0:1, 100000, true);
    if (m.damageMax < m.damageMin || m.goldMax < m.goldMin) fail(`${m.id} 最大值小於最小值`);
    number(m.defense, `${m.id}.defense`, 0, 100); number(m.hit, `${m.id}.hit`, 0, 1);
    number(m.speed, `${m.id}.speed`, 10, 200); number(m.attackSeconds, `${m.id}.attackSeconds`, 0.3, 10);
    number(m.respawnSeconds, `${m.id}.respawnSeconds`, 3, 600); bool(m.aggressive, `${m.id}.aggressive`);
    array(m.drops, `${m.id}.drops`, 20);
    for (const drop of m.drops) {
      byId('items', drop.itemId); number(drop.chance, 'drop.chance', 0, 1);
      number(drop.min, 'drop.min', 1, 100, true); number(drop.max, 'drop.max', drop.min, 100, true);
    }
  }
  if (c.maps.length !== 2 || !c.maps.some(m=>m.id==='town') || !c.maps.some(m=>m.id==='field')) fail('本版地圖必須是 town 與 field');
  for (const map of c.maps) {
    bool(map.safe, `${map.id}.safe`);
    if (map.safe !== (map.id === 'town')) fail('城鎮必須安全，野外必須可戰鬥');
    number(map.width, 'map.width', 600, 3000, true); number(map.height, 'map.height', 600, 3000, true);
    array(map.obstacles, 'obstacles', 100); array(map.buildings, 'buildings', 20); array(map.spawns, 'spawns', 200);
    const point = (p, name, bounds = map) => {
      record(p, name); number(p.x, `${name}.x`, 30, bounds.width-30); number(p.y, `${name}.y`, 30, bounds.height-30);
    };
    for (const o of map.obstacles) {
      number(o.x, 'obstacle.x', 0, map.width); number(o.y, 'obstacle.y', 0, map.height);
      number(o.width, 'obstacle.width', 1, map.width-o.x); number(o.height, 'obstacle.height', 1, map.height-o.y);
    }
    const clear = (p, name) => { if (riverBlocked(map,p.x,p.y,20)||map.obstacles.some(o=>p.x>=o.x-20&&p.x<=o.x+o.width+20&&p.y>=o.y-20&&p.y<=o.y+o.height+20)) fail(`${map.id} ${name} 不得位於障礙物內`); };
    point(map.spawn, 'spawn'); clear(map.spawn, '出生點'); point(map.exit, 'exit'); clear(map.exit, '出口');
    const to = byId('maps',map.exit.to); if (to.id === map.id) fail('出口必須通往另一張地圖');
    number(map.exit.radius, 'exit.radius', 30, 80); point(map.exit.arrival, 'arrival', to);
    if (riverBlocked(to,map.exit.arrival.x,map.exit.arrival.y,20)||to.obstacles.some(o=>map.exit.arrival.x>=o.x-20&&map.exit.arrival.x<=o.x+o.width+20&&map.exit.arrival.y>=o.y-20&&map.exit.arrival.y<=o.y+o.height+20)) fail('出口目的地位於障礙物內');
    if(map.art!==undefined)allowed(map.art,['twilight'],'map.art');
    if(map.regions){array(map.regions,'map.regions',10);for(const region of map.regions){string(region.id,'region.id',40);string(region.name,'region.name',40);allowed(region.ground,['grass','forest','cemetery'],'region.ground');number(region.x,'region.x',0,map.width);number(region.y,'region.y',0,map.height);number(region.width,'region.width',1,map.width-region.x);number(region.height,'region.height',1,map.height-region.y);}}
    if(map.paths){array(map.paths,'map.paths',20);for(const path of map.paths){allowed(path.ground,['grass','dirt','cobble','moss','cemetery','forest'],'path.ground');number(path.x,'path.x',0,map.width);number(path.y,'path.y',0,map.height);number(path.width,'path.width',1,map.width-path.x);number(path.height,'path.height',1,map.height-path.y);}}
    if(map.scenery){array(map.scenery,'map.scenery',200);const ids=new Set();for(const prop of map.scenery){string(prop.id,'scenery.id',64);if(ids.has(prop.id))fail('場景ID重複');ids.add(prop.id);allowed(prop.kind,['shop','inn','gate','well','conifer','broadleaf','tombstone','grave','bridge','boulder','fence','crypt'],'scenery.kind');number(prop.x,'scenery.x',0,map.width);number(prop.y,'scenery.y',0,map.height);number(prop.width,'scenery.width',20,400);number(prop.height,'scenery.height',20,400);allowed(prop.layer,['ground','object'],'scenery.layer');}}
    if(map.river){const river=map.river;number(river.x,'river.x',0,map.width);number(river.y,'river.y',0,map.height);number(river.width,'river.width',1,map.width-river.x);number(river.height,'river.height',1,map.height-river.y);const bridge=river.bridge;number(bridge.x,'bridge.x',river.x,river.x+river.width);number(bridge.y,'bridge.y',0,map.height);number(bridge.width,'bridge.width',60,200);number(bridge.height,'bridge.height',river.height,400);if(bridge.x+bridge.width>river.x+river.width||bridge.y>river.y||bridge.y+bridge.height<river.y+river.height)fail('木橋必須完整跨過河面');}
    const spawnIds = new Set();
    for (const s of map.spawns) {
      string(s.id, 'spawn.id',64); if(spawnIds.has(s.id)) fail('怪物出生點 ID 重複'); spawnIds.add(s.id);
      byId('monsters',s.monsterId); point(s,'spawn'); clear(s,'怪物出生點');
    }
    if (map.safe && map.spawns.length) fail('安全區不能有怪物出生點');
    for (const b of map.buildings) {
      point(b,'building'); string(b.name,'building.name',40); allowed(b.action,['shop','rest'],'building.action');
      if (b.action==='shop' && byId('shops',b.shopId).mapId!==map.id) fail('商店與建築地圖不一致');
    }
  }
  if (!byId('maps','field').spawns.length) fail('野外至少需要一個怪物出生點');
  for (const shop of c.shops) {
    if (!byId('maps',shop.mapId).safe) fail('本版商店必須位於安全區');
    array(shop.items,'shop.items',100);
    if (new Set(shop.items).size!==shop.items.length) fail('商店物品 ID 重複');
    for (const id of shop.items) { const i = byId('items',id); if(i.price<=0) fail('商店商品必須有正數價格'); }
  }
  if (!c.shops.some(s=>s.items.includes(r.starterWeapon))) fail('城鎮需要販售起始武器');
  return c;
}

export function indexCatalog(catalog) {
  validateCatalog(catalog);
  return Object.fromEntries(['items','monsters','maps','shops','abilities','equipmentSlots','monsterAppearances'].map(k => [k, new Map(catalog[k].map(row=>[row.id,row]))]));
}
