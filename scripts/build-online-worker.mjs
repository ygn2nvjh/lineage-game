// Portable deployment build. Configure the static game asset origin before deploying.
import {writeFile,mkdir} from 'node:fs/promises';
import {buildOnline,onlineServerSource} from './build-online.mjs';
const origin=process.env.GAME_ASSET_ORIGIN||'https://lineage-first-expedition.pearlymoth33.chatgpt.site';
const html=await buildOnline(origin),source=await onlineServerSource();
await mkdir(new URL('../dist-online/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist-online/worker.mjs',import.meta.url),source+'\nconst ONLINE_PAGE='+JSON.stringify(html).replace(/</g,'\\u003c')+`;\nexport default {fetch(request,env){const path=new URL(request.url).pathname;if(path==='/api/online')return ONLINE_API(request,env);if(path==='/'||path==='/dungeon'||path==='/dungeon/')return new Response(ONLINE_PAGE,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer'}});return new Response('Not found',{status:404});}};\n`);
console.log('Built dist-online/worker.mjs; requires a DB D1 binding and static assets at '+origin+'/game-assets/');
