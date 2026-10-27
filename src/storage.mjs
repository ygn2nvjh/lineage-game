import {validateCatalog} from './catalog.mjs';
import {validatePlayer, SAVE_VERSION} from './core.mjs';
import {upgradeData} from './migrations.mjs';

const DB_NAME='lineage-mvp-v1';
const STORE='records';
export function validateSnapshot(snapshot,catalog){
  if(!snapshot||snapshot.schemaVersion!==SAVE_VERSION)throw new Error('不支援的存檔格式');
  if(snapshot.catalogVersion!==catalog.version)throw new Error('存檔與資料庫版本不符，請匯入完整備份');
  validatePlayer(snapshot.player,catalog);return snapshot;
}
export function parseBackup(text,seed){
  if(text.length>2*1024*1024)throw new Error('備份超過 2 MB，請確認檔案');
  const backup=JSON.parse(text);
  if(backup.format!=='lineage-mvp-backup'||backup.schemaVersion!==1)throw new Error('這不是重置版完整備份');
  const upgraded=upgradeData(backup.catalog,backup.snapshot,seed);
  return {...backup,catalog:upgraded.catalog,snapshot:upgraded.snapshot};
}

export class Storage {
  constructor(){this.tail=Promise.resolve();}
  async open(){
    if(!globalThis.indexedDB)throw new Error('瀏覽器不支援 IndexedDB，請使用新版 Safari 或 Chrome');
    this.db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,3);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('資料庫被其他分頁占用，請先關閉舊分頁'));
    });
    this.db.onversionchange=()=>this.db.close();return this;
  }
  async get(key){
    return new Promise((resolve,reject)=>{
      const tx=this.db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  write(entries,{expectedVersion}={}){
    const data=structuredClone(entries);
    const job=this.tail.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
      const tx=this.db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
      let guardError;const apply=()=>{for(const [key,value] of data)if(value===undefined)store.delete(key);else store.put(value,key);};
      if(expectedVersion){const check=store.get('catalog');check.onsuccess=()=>{if(check.result&&check.result.version!==expectedVersion){guardError=new Error('資料庫已由另一個分頁更新，請重新整理後繼續；未覆寫新版資料');tx.abort();}else apply();};}else apply();
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(guardError||tx.error||new Error('存檔寫入中止'));
    }));
    this.tail=job;return job;
  }
  async load(){
    if(globalThis.LINEAGE_SEED)this.seed=validateCatalog(structuredClone(globalThis.LINEAGE_SEED));
    else{
      const response=await fetch(new URL('../data/game/catalog.json',import.meta.url));
      if(!response.ok)throw new Error(`遊戲資料載入失敗（HTTP ${response.status}）`);
      this.seed=validateCatalog(await response.json());
    }
    const stored=await this.get('catalog'),saved=await this.get('snapshot');
    const result=upgradeData(stored||this.seed,saved,this.seed);
    if(!stored||result.changed){
      const entries=[['catalog',result.catalog],['snapshot',result.snapshot||undefined]];
      if(stored)entries.push(['preUpgradeCatalog',stored],['preUpgradeSnapshot',saved]);
      await this.write(entries);
    }
    this.catalogVersion=result.catalog.version;return result;
  }
  save(snapshot,catalog){validateSnapshot(snapshot,catalog);return this.write([['snapshot',snapshot]],{expectedVersion:catalog.version});}
  replace(catalog,snapshot){validateCatalog(catalog);if(snapshot)validateSnapshot(snapshot,catalog);return this.write([['catalog',catalog],['snapshot',snapshot||undefined]],{expectedVersion:this.catalogVersion}).then(()=>{this.catalogVersion=catalog.version;});}
  backup(catalog,snapshot){return {format:'lineage-mvp-backup',schemaVersion:1,exportedAt:new Date().toISOString(),catalog,snapshot:snapshot||null};}
}
