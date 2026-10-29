import {mkdir,writeFile,cp,readFile} from 'node:fs/promises';
import {buildOnline} from './build-online.mjs';
const root=new URL('../',import.meta.url),out=new URL('dist-cloudflare/public/',root);await mkdir(out,{recursive:true});
await writeFile(new URL('dungeon.html',out),await buildOnline('',{websocket:true}));
await writeFile(new URL('play.html',out),await buildOnline('',{websocket:true,unified:true}));
await mkdir(new URL('game-assets/portraits/',out),{recursive:true});for(const sex of ['male','female'])await cp(new URL('assets/portraits/'+sex+'.webp',root),new URL('game-assets/portraits/'+sex+'.webp',out));
for(const dir of ['art','world']){const manifest=JSON.parse(await readFile(new URL('assets/'+dir+'/manifest.json',root)));await mkdir(new URL('game-assets/'+dir+'/',out),{recursive:true});for(const entry of Object.values(manifest))await cp(new URL('assets/'+dir+'/'+entry.url,root),new URL('game-assets/'+dir+'/'+entry.url,out));}
console.log('Built self-hosted WebSocket dungeon and runtime assets (no source PNGs).');
await import('./build-art-review.mjs');
await import('./build-art-play.mjs');
