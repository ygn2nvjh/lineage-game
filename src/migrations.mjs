import {SLOTS, validateCatalog} from './catalog.mjs';
import {SAVE_VERSION, validatePlayer} from './core.mjs';

// Upgrade a cloned copy; the caller persists catalog and snapshot in one transaction.
// Existing balance edits, items, possessions and progress take precedence over seed data.
export function upgradeData(inputCatalog,inputSnapshot,seed){
  const catalog=structuredClone(inputCatalog),snapshot=inputSnapshot?structuredClone(inputSnapshot):null;
  const oldVersion=catalog.version,oldSnapshot=snapshot?.schemaVersion;
  let changed=false;const upgradeWorld=['mvp-0.8.0','mvp-0.9.0'].includes(seed?.version)&&['mvp-0.6.0','mvp-0.6.1'].includes(catalog.version);
  if(snapshot&&snapshot.catalogVersion!==catalog.version)throw new Error('存檔與資料庫版本不符，無法安全轉換');
  if(catalog.schemaVersion===1){
    if(!seed||seed.schemaVersion!==2)throw new Error('舊版轉換需要新版起始資料');
    if(snapshot&&snapshot.schemaVersion!==1)throw new Error('舊資料庫的存檔格式不相容');
    catalog.schemaVersion=2;catalog.version=seed.version;
    catalog.equipmentSlots=structuredClone(seed.equipmentSlots);
    catalog.monsterAppearances=structuredClone(seed.monsterAppearances);
    for(const i of catalog.items)if(i.slot==='accessory')i.slot='ring';
    for(const i of seed.items)if(!catalog.items.some(x=>x.id===i.id))catalog.items.push(structuredClone(i));
    for(const m of catalog.monsters)if(m.sprite==='skeleton')m.appearanceId='skeleton';
    for(const m of seed.monsters)if(!catalog.monsters.some(x=>x.id===m.id))catalog.monsters.push(structuredClone(m));
    for(const shop of catalog.shops){
      const template=seed.shops.find(x=>x.id===shop.id);
      if(template)for(const id of template.items)if(!shop.items.includes(id)&&!inputCatalog.items.some(x=>x.id===id))shop.items.push(id);
    }
    const field=catalog.maps.find(m=>m.id==='field'),template=seed.maps.find(m=>m.id==='field');
    for(const s of template.spawns.filter(s=>['spartoi','skeleton_fighter'].includes(s.monsterId))){
      if(field.spawns.some(x=>x.id===s.id))continue;
      const clear=(x,y)=>!field.obstacles.some(o=>x>o.x-22&&x<o.x+o.width+22&&y>o.y-22&&y<o.y+o.height+22);
      let point=clear(s.x,s.y)&&s.x<field.width-30&&s.y<field.height-30?{x:s.x,y:s.y}:null;
      for(let y=80;!point&&y<field.height/2;y+=64)for(let x=80;!point&&x<field.width-30;x+=64)if(clear(x,y))point={x,y};
      if(point)field.spawns.push({...s,...point});
    }
    changed=true;
  }
  if(snapshot&&snapshot.schemaVersion===1){
    const old=snapshot.player?.equipment;
    if(!old||Object.keys(old).length!==3||!['weapon','armor','accessory'].every(k=>k in old))throw new Error('舊裝備欄位不完整，未覆寫存檔');
    snapshot.player.equipment=Object.fromEntries(SLOTS.map(s=>[s,null]));
    snapshot.player.equipment.weapon=old.weapon;snapshot.player.equipment.armor=old.armor;snapshot.player.equipment.ring1=old.accessory;
    snapshot.schemaVersion=SAVE_VERSION;snapshot.catalogVersion=catalog.version;changed=true;
  }
  if(upgradeWorld){
    // User explicitly replaced the world layout. Character progress and custom balance stay intact;
    // Storage archives the full previous catalog/snapshot before persisting this upgrade.
    for(const appearance of seed.monsterAppearances)if(!catalog.monsterAppearances.some(a=>a.id===appearance.id))catalog.monsterAppearances.push(structuredClone(appearance));
    for(const monster of seed.monsters)if(!catalog.monsters.some(m=>m.id===monster.id))catalog.monsters.push(structuredClone(monster));
    catalog.maps=structuredClone(seed.maps);catalog.version=seed.version;catalog.title=seed.title;
    if(snapshot){snapshot.catalogVersion=catalog.version;const map=catalog.maps.find(m=>m.id===snapshot.player.mapId);Object.assign(snapshot.player,map.spawn);}
    changed=true;
  }
  if(seed?.version==='mvp-0.9.0'&&['mvp-0.6.0','mvp-0.6.1','mvp-0.8.0'].includes(oldVersion)){
    const town=catalog.maps.find(m=>m.id==='town'),template=seed.maps.find(m=>m.id==='town');
    if(!town.buildings.some(b=>b.action==='warehouse')){
      town.buildings.push(structuredClone(template.buildings.find(b=>b.action==='warehouse')));
      town.obstacles.push(structuredClone(template.obstacles.find(b=>b.id==='warehouse')));
      town.paths??=[];town.paths.push(structuredClone(template.paths.find(b=>b.id==='warehouse_path')));
    }
    catalog.version=seed.version;if(snapshot)snapshot.catalogVersion=catalog.version;changed=true;
  }
  if(snapshot&&[1,2].includes(oldSnapshot)){snapshot.player.warehouse??={};snapshot.schemaVersion=SAVE_VERSION;changed=true;}
  validateCatalog(catalog);
  if(snapshot){
    if(snapshot.schemaVersion!==SAVE_VERSION||snapshot.catalogVersion!==catalog.version)throw new Error('存檔格式不相容');
    validatePlayer(snapshot.player,catalog);
  }
  return {catalog,snapshot,changed};
}
