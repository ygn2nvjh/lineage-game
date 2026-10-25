import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createGame } from '../../src/core/index.mjs';
import { loadItemCatalog, loadEquipmentScenarios } from '../../src/adapters/browser/item-catalog.mjs';
import { createHudController } from '../../src/adapters/browser/core-hud-integration.mjs';
import { renderHud, renderCharacter, supportText } from '../../src/adapters/browser/character-views.mjs';
const fetcher = async url => new Response(await fs.readFile(url));
const [catalog, definition] = await Promise.all([loadItemCatalog({fetcher}), loadEquipmentScenarios({fetcher})]);
function setup(id) {
  const calls = [[],[],[]]; let creates = 0;
  const c = createHudController({catalog, definition, createCore: input => { creates++; return createGame(input); },
    views: Object.fromEntries(['renderHud','renderCharacter','renderEquipment'].map((key,i)=>[key,s=>calls[i].push(s)]))});
  c.loadScenario(id); return {c,calls,creates:()=>creates};
}
function same(calls) { const s=calls[0].at(-1); assert.equal(s,calls[1].at(-1));assert.equal(s,calls[2].at(-1));return s; }
test('HUD coordinator passes identical frozen snapshot references on initialization and every successful command',()=>{
 const {c,calls,creates}=setup('weapon-resolution'); same(calls);assert.equal(creates(),1);
 assert.equal(c.equip('long-sword','weapon').ok,true);const s=same(calls);assert.equal(s.revision,1);assert.equal(s.derived.weapon.instanceId,'long-sword');
 const before=JSON.stringify(c.getSnapshot());for(let i=0;i<4;i++)c.render();same(calls);assert.equal(JSON.stringify(c.getSnapshot()),before);assert.equal(creates(),1);c.dispose();
});
for(const [name,id,operation,code] of [
 ['level','level-restricted',c=>c.equip('head-level40','head'),'LEVEL_RESTRICTED'],
 ['class','replace-rollback',c=>c.equip('body-forbidden','body'),'CLASS_RESTRICTED'],
 ['ownership','ownership',c=>c.equip('other-rapier','weapon'),'ITEM_NOT_OWNED'],
 ['revision','weapon-resolution',c=>c.equip('long-sword','weapon',99),'STALE_REVISION']]) {
 test(`failed ${name} command leaves all views and authoritative state unchanged`,()=>{const {c,calls}=setup(id);const before=JSON.stringify(c.getSnapshot());const n=calls[0].length;assert.equal(operation(c).error.code,code);assert.equal(JSON.stringify(c.getSnapshot()),before);assert.equal(calls[0].length,n);same(calls);c.dispose();});
}
test('replacement is atomic, displaced item remains owned and unequip uses same coordinator',()=>{
 const {c,calls}=setup('replace-rollback');const before=c.getSnapshot();assert.equal(c.equip('body-new','body').ok,true);
 const s=same(calls);assert.equal(s.equipment.slots.body,'body-new');assert.deepEqual(s.inventory.ownedInstanceIds,before.inventory.ownedInstanceIds);
 assert.equal(c.unequip('body').ok,true);assert.equal(same(calls).equipment.slots.body,null);c.dispose();
});
test('two same-template ring instances and duplicate instance rejection',()=>{const {c,calls}=setup('double-rings');assert.equal(c.equip('ring-a','ring1').ok,true);assert.equal(c.equip('ring-b','ring2').ok,true);assert.equal(c.equip('ring-a','ring2').error.code,'ITEM_ALREADY_EQUIPPED');assert.equal(same(calls).revision,2);c.dispose();});
test('capacity increase never heals and clamp occurs once on successful unequip',()=>{
 const a=setup('capacity-increase');a.c.equip('soul-belt','belt');assert.equal(same(a.calls).character.resources.hp,80);assert.equal(a.c.getSnapshot().derived.maxHp,125);a.c.dispose();
 const b=setup('capacity-clamp');b.c.unequip('cloak');const s=same(b.calls);assert.deepEqual(s.character.resources,{hp:100,mp:20});assert.equal(s.revision,1);b.c.render();assert.equal(b.c.getSnapshot().revision,1);b.c.dispose();
});
test('scene changes dispose previous subscriptions and explicit disposal stops operations',()=>{const {c,calls,creates}=setup('basic-knight');c.loadScenario('weapon-resolution');assert.equal(creates(),2);const n=calls[0].length;c.equip('long-sword','weapon');assert.equal(calls[0].length,n+1);same(calls);c.dispose();assert.throws(()=>c.render(),/ADAPTER_NOT_ACTIVE/);});
test('HUD and character renderers only display frozen authoritative values',()=>{const {c}=setup('set-a');const s=c.getSnapshot(),before=JSON.stringify(s);
 const root=()=>({dataset:{},fields:new Map(),querySelector(selector){if(!this.fields.has(selector))this.fields.set(selector,{textContent:''});return this.fields.get(selector);}});
 const hud=root(),character=root();renderHud(hud,s);renderCharacter(character,s);assert.equal(hud.dataset.revision,character.dataset.revision);assert.equal(hud.querySelector('[data-value="hp"]').textContent,character.querySelector('[data-value="hp"]').textContent);assert.equal(JSON.stringify(s),before);
 for(const k of ['mr','er','weight'])assert.equal(character.querySelector(`[data-value="${k}"]`).textContent,'未實作');assert.equal(supportText(s.derived.attributes.effects),'未實作');c.dispose();});
