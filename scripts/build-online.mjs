import {readFile,writeFile} from 'node:fs/promises';
const onlineRoot=new URL('../',import.meta.url);
export async function buildOnline(assetOrigin='https://lineage-first-expedition.pearlymoth33.chatgpt.site',options={}){
 const read=p=>readFile(new URL(p,onlineRoot),'utf8'),seed=JSON.parse(await read('data/game/catalog.json'));
 const art=JSON.parse(await read('assets/art/manifest.json')),world=JSON.parse(await read('assets/world/manifest.json'));
 for(const a of Object.values(art))a.url=assetOrigin+'/game-assets/art/'+a.url;
 for(const a of Object.values(world))a.url=assetOrigin+'/game-assets/world/'+a.url;
 const parts=['art-config','actor-art','world-art','navigation','catalog','core','sprites','world','online/room','online/transport','online/prediction',...(options.websocket?['online/state-delta','online/websocket']:[]),...(options.unified?['online/solo-input','online/solo-prediction','online/adventure','online/adventure-system','online/adventure-client']:[]),'online/client'];
 const bundle=(await Promise.all(parts.map(n=>read('src/'+n+'.mjs')))).map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n');
 if(options.unified){const {adventureCatalog}=await import('../src/online/adventure.mjs');Object.assign(seed,adventureCatalog(seed));}
 const script=`globalThis.LINEAGE_WEBSOCKET=${!!options.websocket};globalThis.LINEAGE_UNIFIED=${!!options.unified};globalThis.LINEAGE_SEED=${JSON.stringify(seed)};globalThis.LINEAGE_ART=${JSON.stringify(art)};globalThis.LINEAGE_WORLD=${JSON.stringify(world)};${bundle}`;
 let html=await read('index.html');html=html.replace('<link rel="stylesheet" href="./src/styles.css">',()=>'<style>'+readCss+'</style>');
 return html.replace('<script type="module" src="./src/app.mjs"></script>',()=>'<script type="module">'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
}
const readCss=await readFile(new URL('src/styles.css',onlineRoot),'utf8');
export async function onlineServerSource(){const names=['art-config','navigation','catalog','core','online/room','online/api'];return (await Promise.all(names.map(n=>readFile(new URL('src/'+n+'.mjs',onlineRoot),'utf8')))).map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n')+'\nconst ONLINE_API=onlineService('+await readFile(new URL('data/game/catalog.json',onlineRoot),'utf8')+');';}
