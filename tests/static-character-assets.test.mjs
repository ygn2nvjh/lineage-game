import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadStaticCharacter,STATIC_DIRECTIONS} from '../src/static-character-assets.mjs';
const root=new URL('../assets/characters/red-knight/v1/',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
async function fixture(change=x=>x){const character=await read('character.json'),runtime=change(await read('runtime/idle.json')),requests=[];return {requests,options:{baseURL:'https://game.example/',fetcher:async url=>{requests.push(url);return {ok:true,json:async()=>url.endsWith('character.json')?character:runtime};},decodeImage:async url=>{requests.push(url);return {width:1024,height:128};}}};}
test('archived atlas has all eight directions; draws from a shared ground origin without auto-fit',async()=>{const f=await fixture(),knight=await loadStaticCharacter('/art/character.json',f.options);assert.equal(f.requests.length,3);assert(f.requests.every(x=>!x.includes('/references/')));const calls=[],ctx={save(){},restore(){},drawImage(...args){calls.push(args)}};for(const d of STATIC_DIRECTIONS)knight.draw(ctx,d,200,300,{scale:2});for(let i=0;i<8;i++)assert.deepEqual(calls[i].slice(1),[i*128,0,128,128,72,76,256,256]);});
test('rejects missing directions and wrong atlas bounds instead of choosing another pose',async()=>{let f=await fixture(r=>{delete r.frames['up-right'];return r});await assert.rejects(loadStaticCharacter('/art/character.json',f.options),/Unsupported/);f=await fixture(r=>{r.frames.right.x=1024;return r});await assert.rejects(loadStaticCharacter('/art/character.json',f.options),/Invalid static frame/);});
test('rejects unknown directions and invalid display scale',async()=>{const f=await fixture(),knight=await loadStaticCharacter('/art/character.json',f.options);assert.throws(()=>knight.draw({},'northeast',0,0),/Unknown/);assert.throws(()=>knight.draw({},'up-right',0,0,{scale:0}),/positive/);});
