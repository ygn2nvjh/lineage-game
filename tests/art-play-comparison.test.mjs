import test from 'node:test';
import assert from 'node:assert/strict';
import {artComparePositions,ART_COMPARE_ROLES} from '../src/art-play-comparison.mjs';
import {createArtPlayAnimation} from '../src/art-play-animation.mjs';
import {readFileSync} from 'node:fs';
test('comparison has five fixed identities, one common floor and intentional depth arrangements',()=>{
  assert.deepEqual(ART_COMPARE_ROLES.map(r=>r.kind),['male','female','skeleton','spartoi','skeleton_fighter']);
  const row=artComparePositions('line');assert.equal(new Set(row.map(r=>r.y)).size,1);
  assert.equal(new Set(artComparePositions('stagger').map(r=>r.y)).size,5);
  assert.equal(new Set(artComparePositions('close').map(r=>r.y)).size,5);
  assert(ART_COMPARE_ROLES.filter(r=>r.legacy).every(r=>['spartoi','skeleton_fighter'].includes(r.kind)));
});
test('comparison shadow switch affects shadows while preserving the whole sprite draw',()=>{
  const meta=JSON.parse(readFileSync(new URL('../assets/art-play/manifest-v5.json',import.meta.url)));
  const used={male:new Set()},art=createArtPlayAnimation(meta,{male:{}},used,{height:63,scale:1.75});
  let images=0,fills=0;
  const ctx=new Proxy({drawImage:()=>images++,fill:()=>fills++},{get:(o,k)=>k in o?o[k]:()=>{}});
  art.draw(ctx,{x:0,y:0,dir:'down',shadows:false},'male');assert.equal(images,1);assert.equal(fills,0);
  art.draw(ctx,{x:0,y:0,dir:'down'},'male');assert.equal(images,2);assert(fills>0);
});
