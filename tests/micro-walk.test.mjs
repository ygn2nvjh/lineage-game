import test from 'node:test';import assert from 'node:assert/strict';import {microWalkPixels,HEAD_Y_OFFSETS} from '../src/micro-walk.mjs';
test('Only F2/F6 head and one neck seam row move; all other RGBA remains exact',()=>{
 const a=Uint8ClampedArray.from({length:1024*128*4},(_,i)=>(i*37+Math.floor(i/4096))%256),saved=a.slice(),b=microWalkPixels(a);
 for(let f=0;f<8;f++)for(let y=0;y<128;y++)for(let x=0;x<128;x++){
 const k=(y*1024+f*128+x)*4,inside=HEAD_Y_OFFSETS[f]&&x>=30&&x<=83&&y>=12&&y<=44;
 if(!inside)assert.deepEqual(b.subarray(k,k+4),a.subarray(k,k+4));
 else if(y===12)assert.deepEqual([...b.subarray(k,k+4)],[0,0,0,0]);
 else assert.deepEqual(b.subarray(k,k+4),a.subarray(k-4096,k-4092));
 }assert.deepEqual(a,saved);assert.equal(HEAD_Y_OFFSETS[7],HEAD_Y_OFFSETS[0]);
});
test('Reject invalid dimensions',()=>assert.throws(()=>microWalkPixels(new Uint8ClampedArray(4))));
