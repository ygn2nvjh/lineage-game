import {cp} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist-cloudflare/public/',root);
await cp(new URL('src/micro-walk.mjs',root),new URL('game-assets/characters/micro-walk.mjs',out));
await cp(new URL('assets/art-scene-review/knight-walk-micro.html',root),new URL('art-walk-micro.html',out));
console.log('Built v0.4 versus 1px micro-walk comparison.');
