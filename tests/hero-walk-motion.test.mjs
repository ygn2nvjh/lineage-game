import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rightWalkPose,drawRightWalkPose} from '../src/hero-walk-motion.mjs';
const config=JSON.parse(readFileSync(new URL('../data/art/right-walk-v1.json',import.meta.url))),reference=JSON.parse(readFileSync(new URL('../assets/art-calibration/reference-v1.json',import.meta.url)));
test('right gait alternates the same near/far legs and passes the swing foot at the two quarter phases',()=>{
 for(const kind of ['male','female']){
  const a=rightWalkPose(config,kind,0),b=rightWalkPose(config,kind,.5);
  assert(a.legs.near.stance&&!a.legs.far.stance);assert(b.legs.far.stance&&!b.legs.near.stance);
  assert(a.legs.near.contact[0]>a.legs.far.contact[0]);assert(b.legs.far.contact[0]>b.legs.near.contact[0]);
  for(const [p,side]of [[.25,'far'],[.75,'near']])assert.equal(rightWalkPose(config,kind,p).legs[side].source.contact[1]-rightWalkPose(config,kind,p).legs[side].contact[1],config.swingLift);
 }
});
test('planted world contact stays fixed, joints stay connected and bone lengths never stretch at any sampled phase',()=>{
 for(const kind of ['male','female']){const contacts=new Map();
  for(let i=0;i<4000;i++)for(const l of Object.values(rightWalkPose(config,kind,i/1000).legs)){
   assert(l.reachError<1e-8);assert(Math.abs(Math.hypot(l.knee[0]-l.hip[0],l.knee[1]-l.hip[1])-l.upperLength)<1e-8);assert(Math.abs(Math.hypot(l.ankle[0]-l.knee[0],l.ankle[1]-l.knee[1])-l.lowerLength)<1e-8);
   if(l.stance){if(contacts.has(l.supportId))assert(Math.hypot(...l.worldContact.map((v,j)=>v-contacts.get(l.supportId)[j]))<1e-8);else contacts.set(l.supportId,l.worldContact);}
  }
 }
 const invalid=structuredClone(config);invalid.cycleDistance=200;assert(Object.values(rightWalkPose(invalid,'male',0).legs).some(l=>l.reachError>1));
});
test('complete pose uses the same immutable parts, unscaled slices and exactly one weapon-containing upper body',()=>{
 const calls=[],log=[],ctx=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawRightWalkPose(ctx,{},reference,config,'male',.25,{drawLog:log});assert.deepEqual(log.map(x=>x.side),['far','near','upper']);assert.equal(log.at(-1).weaponCopies,1);assert(log.every(x=>x.partScale===1));assert.equal(calls.length,7);
 for(const call of calls){assert.equal(call[3],call[7]);assert.equal(call[4],call[8]);}
});
