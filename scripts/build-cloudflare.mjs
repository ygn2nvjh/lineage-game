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
await import('./build-hero-calibration.mjs');

// Isolated static art acceptance; does not replace /play or its assets.
await cp(new URL('assets/art-scene-review/knight-96-review.html',root),new URL('art-scene-review.html',out));

await cp(new URL('assets/art-scene-review/knight-128-review.html',root),new URL('art-scene-review-v2.html',out));

await cp(new URL('assets/art-scene-review/knight-112-review.html',root),new URL('art-scene-review-v3.html',out));

await cp(new URL('assets/art-scene-review/knight-96-local-fix.html',root),new URL('art-scene-review-v4.html',out));

await cp(new URL('assets/art-scene-review/knight-eight-static.html',root),new URL('art-eight-static.html',out));

await cp(new URL('assets/art-scene-review/knight-eight-revised.html',root),new URL('art-eight-revised.html',out));

await cp(new URL('assets/art-scene-review/knight-eight-revised-v2.html',root),new URL('art-eight-revised-v2.html',out));
