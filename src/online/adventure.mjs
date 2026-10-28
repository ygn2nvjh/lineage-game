import {Game} from '../core.mjs';
import {saveGame} from './room.mjs';
export const ADVENTURE_VERSION='adventure-0.1.5';
export function adventureCatalog(seed){const c=structuredClone(seed),town=c.maps.find(m=>m.id==='town');if(!town.buildings.some(b=>b.id==='guild')){town.buildings.push({id:'guild',name:'冒險者公會',x:660,y:650,action:'guild',art:'inn'});town.obstacles.push({id:'guild',x:570,y:590,width:180,height:130});town.paths.push({id:'guild_path',ground:'cobble',x:480,y:700,width:180,height:64});}return c;}
export function saveSolo(g){return {...saveGame(g),enemies:structuredClone(g.enemies),logs:structuredClone(g.logs)};}
export function restoreSolo(c,s){const p=structuredClone(s.p);if(p.hp<=0)p.hp=1;const g=new Game(c,p);for(const [k,v] of Object.entries(s))if(k!=='enemies')g[k]=structuredClone(v);g.enemies=structuredClone(s.enemies);g.events=[];return g;}
