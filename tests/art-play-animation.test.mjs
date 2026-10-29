import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artPlayPose,createArtPlayAnimation} from '../src/art-play-animation.mjs';
import {artPlayLegPose} from '../src/art-play-rig.mjs';
const meta=JSON.parse(readFileSync(new URL('../assets/art-play/manifest-v3.json',import.meta.url)));
test('movement and attack transitions draw exactly one whole pose, including mirrored actors',()=>{
  const images={male:{},female:{},skeleton:{}},used=Object.fromEntries(Object.keys(images).map(k=>[k,new Set()]));
  const art=createArtPlayAnimation(meta,images,used,{height:63,scale:1.75});
  for(const kind of Object.keys(images))for(const dir of ['left','right','up','down']){
    for(const state of [{moving:true,walkPhase:.1},{moving:true,walkPhase:.6},{moving:true,attack:1,attackElapsed:.3,duration:.6,side:dir},{attack:1,attackElapsed:.5,duration:.6,side:dir},{hurt:.2},{dead:true},{}]){
      const calls=[],c=new Proxy({drawImage:(...a)=>calls.push(a)},{get:(o,k)=>k in o?o[k]:()=>{}});
      art.draw(c,{x:100,y:100,dir,...state},kind);
      assert.equal(calls.length,1,`${kind} ${dir} ${JSON.stringify(state)} must never combine two weapons`);
      const pose=artPlayPose({dir,...state},12);const f=meta[kind].frames[pose.key];
      assert.deepEqual(calls[0].slice(1,5),[f.x,f.y,f.w,f.h]);
    }
  }
});
test('near and far legs exchange support after half a cycle, for side and front/back',()=>{
  for(const side of [true,false])for(let i=0;i<12;i++){
    const near=artPlayLegPose(i/12,false,side),far=artPlayLegPose(i/12,true,side),next=artPlayLegPose(i/12+.5,false,side);
    for(const field of ['thigh','knee','lift'])assert(Math.abs(far[field]-next[field])<1e-10);
    assert(Math.min(near.lift,far.lift)<1e-10,'one foot must support while the other swings');
  }
  const before=artPlayLegPose(.25),after=artPlayLegPose(.75);
  assert(before.thigh<0&&after.thigh>0,'same near leg must go forward AND back');
  assert(artPlayLegPose(0).lift>8&&artPlayLegPose(.5).lift===0);
});
