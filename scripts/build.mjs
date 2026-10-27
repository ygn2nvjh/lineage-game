import {syncArt} from './sync-art.mjs';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateCatalog} from '../src/catalog.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)),out=path.join(root,'dist');
await mkdir(out,{recursive:true});
await mkdir(path.join(root,'artifacts'),{recursive:true});
const html=await readFile(path.join(root,'index.html'),'utf8');
const css=await readFile(path.join(root,'src/styles.css'),'utf8');
const catalog=validateCatalog(JSON.parse(await readFile(path.join(root,'data/game/catalog.json'),'utf8')));
const art=await syncArt();for(const a of Object.values(art)){const bytes=await readFile(path.join(root,'assets/art',a.url));a.url='data:image/'+(a.url.endsWith('.webp')?'webp':'png')+';base64,'+bytes.toString('base64');}
const world=JSON.parse(await readFile(path.join(root,'assets/world/manifest.json'),'utf8'));for(const a of Object.values(world)){const bytes=await readFile(path.join(root,'assets/world',a.url));a.url='data:image/webp;base64,'+bytes.toString('base64');}
const portraits={};for(const sex of ['male','female'])portraits[sex]='data:image/webp;base64,'+(await readFile(path.join(root,'assets/portraits',sex+'.webp'))).toString('base64');
const files=['portraits','art-config','actor-art','world-art','navigation','catalog','core','migrations','storage','sprites','world','app'];
const modules=await Promise.all(files.map(name=>readFile(path.join(root,`src/${name}.mjs`),'utf8')));
const bundle=modules.map(source=>source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')).join('\n\n');
const script=`globalThis.LINEAGE_PORTRAITS=${JSON.stringify(portraits)};\n globalThis.LINEAGE_WORLD=${JSON.stringify(world)};\nglobalThis.LINEAGE_ART=${JSON.stringify(art)};\nglobalThis.LINEAGE_SEED=${JSON.stringify(catalog).replace(/</g,'\\u003c')};\n${bundle}`;
const single=html.replace('<link rel="stylesheet" href="./src/styles.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./src/app.mjs"></script>',()=>`<script type="module">\n${script.replace(/<\/script/gi,'<\\/script')}\n</script>`);
await writeFile(path.join(out,'index.html'),single);
await writeFile(path.join(root,'artifacts/lineage-mvp-0.9.0.html'),single);
await cp(path.join(root,'data/game/catalog.json'),path.join(out,'catalog.json'));
console.log(`Built dist/index.html and artifacts/lineage-mvp-0.9.0.html (${Buffer.byteLength(single)} bytes). No runtime dependencies.`);
