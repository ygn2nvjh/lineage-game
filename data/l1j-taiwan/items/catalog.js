/* Taiwan L1J 3.80c item catalog loader. Read-only; no gameplay mutations. */
(function(root){
'use strict';
const BASE='./data/l1j-taiwan/items/';
function numericFields(row){const o={};for(const [k,v] of Object.entries(row)){o[k]=typeof v==='string'&&/^-?\d+$/.test(v)&&!['name','unidentified_name_id','identified_name_id'].includes(k)?Number(v):v;}return o;}
async function load(options={}){
 const base=options.base||BASE;
 const fetcher=options.fetcher||(typeof fetch==='function'?fetch.bind(root):null);
 if(!fetcher)throw new Error('fetch unavailable');
 const manifest=await (await fetcher(base+'manifest.json')).json();
 if(!Array.isArray(manifest.tables))throw new Error('invalid item manifest');
 const items=new Map(),byTable={weapon:[],armor:[],etcitem:[]};
 for(const entry of manifest.tables){
   for(const part of entry.parts){
     const filename=part.path.split('/').pop();
     const response=await fetcher(base+filename);
     if(!response.ok)throw new Error('failed loading '+filename+': '+response.status);
     const data=await response.json();
     if(data.table!==entry.table||data.rows.length!==part.rows)throw new Error('manifest mismatch '+filename);
     for(const raw of data.rows){
       const id=Number(raw.item_id);
       if(!Number.isSafeInteger(id)||id<=0||items.has(id))throw new Error('invalid/duplicate item id '+raw.item_id);
       const item=Object.freeze({...numericFields(raw),id,category:entry.table});
       items.set(id,item);
       byTable[entry.table].push(item);
     }
   }
 }
 if(items.size!==manifest.totalRows)throw new Error('item count mismatch: '+items.size);
 return Object.freeze({count:items.size,byId:id=>items.get(Number(id))||null,byCategory:type=>(byTable[type]||[]).slice(),search:(q,limit=30)=>{const needle=String(q||'').trim();return needle?[...items.values()].filter(x=>String(x.name).includes(needle)||String(x.id)===needle).slice(0,limit):[]},summary:()=>Object.fromEntries(Object.entries(byTable).map(([k,v])=>[k,v.length]))});
}
root.LineageTaiwanItems=Object.freeze({load});
})(typeof window!=='undefined'?window:globalThis);
