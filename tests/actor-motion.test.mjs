import test from 'node:test';
import assert from 'node:assert/strict';
import {World} from '../src/world.mjs';
import {ART_MOTION} from '../src/art-config.mjs';
function world(){return {motion:new Map(),actorState:World.prototype.actorState};}
test('network snapshots preserve a full alternating walk cycle for player, monster and teammate',()=>{
 for(const key of ['town:player','field:enemy:bone','field:member:friend']){
  const w=world(),frames=new Set();
  for(let i=0;i<36;i++){const a=w.actorState({x:i*2,y:0},{moving:true},'right',key);if(i)assert(a.moving);frames.add(Math.floor(a.walkPhase*6));}
  assert.equal(frames.size,6,`${key} must reach all six walk frames despite replacement objects`);
  assert.equal(w.motion.size,1);
 }
});
test('walking phase follows distance, stops cleanly, and teleport does not advance a stride',()=>{
 const w=world();w.actorState({x:0,y:0},{moving:true},'right','p');
 assert.equal(w.actorState({x:ART_MOTION.stride/2,y:0},{moving:true},'right','p').walkPhase,.5);
 const stop=w.actorState({x:ART_MOTION.stride/2,y:0},{moving:false},'right','p');assert.equal(stop.walkPhase,0);assert.equal(stop.moving,false);
 assert.equal(w.actorState({x:500,y:0},{moving:true},'right','p').walkPhase,0);
});
test('monster facing follows continuous motion across snapshots rather than resetting right',()=>{
 const w=world();w.actorState({x:20,y:20},{moving:true},'down','m',true);
 assert.equal(w.actorState({x:18,y:20},{moving:true},'down','m',true).dir,'left');
 assert.equal(w.actorState({x:18,y:18},{moving:true},'down','m',true).dir,'up');
});
