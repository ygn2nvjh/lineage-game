import {cp,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('dist-cloudflare/public/',root),base=new URL('game-assets/characters/red-knight/walk-right-v1/',out);await mkdir(base,{recursive:true});
await cp(new URL('assets/characters/red-knight/walk-right-v1/',root),base,{recursive:true});
await cp(new URL('assets/world/tiles.webp',root),new URL('ground.webp',base));
await cp(new URL('src/walk-cycle-preview.mjs',root),new URL('game-assets/characters/walk-cycle-preview.mjs',out));
await cp(new URL('assets/art-scene-review/knight-walk-right.html',root),new URL('art-walk-right.html',out));
console.log('Built isolated right-walk eight-frame acceptance page.');
