import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeState, equip, unequip, clone } from './fixture.mjs';

test('[transaction] equip succeeds once, keeps ownership and publishes one committed revision', () => {
  const game = makeGame(), notes = [];
  const unsubscribe = game.subscribe(note => { notes.push(note); assert.equal(game.getSnapshot('hero').revision, note.revision); });
  const beforeIds = game.getSnapshot('hero').inventory.ownedInstanceIds;
  const result = equip(game, 'armor', 'body');
  assert.equal(result.ok, true); assert.equal(result.revision, 1); assert.equal(notes.length, 1);
  assert.equal(notes[0].snapshot.derived.maxHp, 200);
  assert.deepEqual(game.getSnapshot('hero').inventory.ownedInstanceIds, beforeIds);
  assert.ok(Object.isFrozen(notes[0])); unsubscribe();
});

test('[transaction] original/base stats, permanent capacity and history survive repeated gear changes', () => {
  const game = makeGame(), before = game.getSnapshot('hero').character;
  for (let i = 0; i < 5; i++) { assert.equal(equip(game, 'armor', 'body').ok, true); assert.equal(unequip(game, 'body').ok, true); }
  const after = game.getSnapshot('hero').character;
  assert.deepEqual(after.originalStats, before.originalStats); assert.deepEqual(after.base, before.base);
  assert.deepEqual(after.history, before.history);
  assert.equal(game.getSnapshot('hero').derived.equipmentBonuses.add_hp, 0);
});

for (const [name, item, slot, error] of [
  ['missing item', 'absent', 'body', 'ITEM_NOT_FOUND'],
  ['wrong slot', 'armor', 'head', 'INCOMPATIBLE_SLOT'],
  ['class restriction', 'forbidden', 'body', 'CLASS_RESTRICTED'],
  ['level restriction', 'high-level', 'body', 'LEVEL_RESTRICTED'],
  ['unknown slot', 'armor', 'ring', 'INVALID_SLOT'],
  ['failure after candidate construction', 'overflow', 'body', 'UNSAFE_DERIVED_NUMBER']
]) {
  test(`[transaction] ${name}: complete rollback, no resource or notification changes`, () => {
    const game = makeGame(); equip(game, 'replacement', 'body');
    const before = game.exportSave(), notifications = [];
    game.subscribe(n => notifications.push(n));
    const result = equip(game, item, slot);
    assert.equal(result.ok, false); assert.equal(result.error.code, error);
    assert.equal(result.revision, 1); assert.deepEqual(game.exportSave(), before);
    assert.equal(notifications.length, 0);
  });
}

test('[transaction] replacing equipment is atomic and leaves displaced item owned', () => {
  const game = makeGame(); equip(game, 'armor', 'body');
  const result = equip(game, 'replacement', 'body');
  assert.equal(result.ok, true); assert.equal(result.revision, 2);
  assert.equal(result.events[0].type, 'ItemReplaced');
  assert.equal(result.events[0].previousInstanceId, 'armor');
  const s = game.getSnapshot('hero'); assert.equal(s.equipment.slots.body, 'replacement');
  assert.ok(s.inventory.ownedInstanceIds.includes('armor')); assert.equal(s.derived.maxHp, 150);
});

test('[transaction] identical ring templates require distinct instances and explicit slots', () => {
  const game = makeGame();
  assert.equal(equip(game, 'ring-a', 'ring1').ok, true);
  assert.equal(equip(game, 'ring-b', 'ring2').ok, true);
  assert.equal(game.getSnapshot('hero').derived.equipmentBonuses.add_str, 2);
  assert.deepEqual([game.getSnapshot('hero').equipment.slots.ring1, game.getSnapshot('hero').equipment.slots.ring2], ['ring-a', 'ring-b']);
});

test('[transaction] same instance cannot occupy two slots and failed ring replacement preserves both', () => {
  const game = makeGame(); equip(game, 'ring-a', 'ring1'); equip(game, 'ring-b', 'ring2');
  const before = game.exportSave();
  const result = equip(game, 'ring-a', 'ring2');
  assert.equal(result.error.code, 'ITEM_ALREADY_EQUIPPED'); assert.deepEqual(game.exportSave(), before);
});

test('[transaction] ring replacement changes only selected slot and keeps the other ring', () => {
  const state = makeState(); state.itemInstances['ring-c'] = clone(state.itemInstances['ring-a']);
  state.inventories.hero.ownedInstanceIds.push('ring-c');
  const game = makeGame(state); equip(game, 'ring-a', 'ring1'); equip(game, 'ring-b', 'ring2');
  assert.equal(equip(game, 'ring-c', 'ring1').ok, true);
  assert.equal(game.getSnapshot('hero').equipment.slots.ring2, 'ring-b');
  assert.ok(game.getSnapshot('hero').inventory.ownedInstanceIds.includes('ring-a'));
});

test('[transaction P1] raising HP/MP limits never fills current resources', () => {
  const game = makeGame(); equip(game, 'armor', 'body'); const s = game.getSnapshot('hero');
  assert.deepEqual(s.character.resources, { hp: 80, mp: 8 });
  assert.equal(s.derived.maxHp, 200); assert.equal(s.derived.maxMp, 30);
});

test('[transaction P1] removing capacity gear clamps resources once at commit, never at read', () => {
  const state = makeState(); state.equipment.hero.slots.body = 'armor'; state.characters.hero.resources = { hp: 180, mp: 25 };
  const game = makeGame(state), result = unequip(game, 'body');
  assert.equal(result.ok, true); assert.equal(result.events[1].type, 'ResourcesClamped');
  assert.deepEqual(game.getSnapshot('hero').character.resources, { hp: 100, mp: 10 });
  const saved = game.exportSave(); for (let i = 0; i < 5; i++) game.getSnapshot('hero');
  assert.deepEqual(game.exportSave(), saved);
});

test('[transaction P1] replacement and negative capacity modifiers clamp under the same policy', () => {
  const state = makeState(); state.equipment.hero.slots.body = 'armor'; state.characters.hero.resources = { hp: 180, mp: 25 };
  const game = makeGame(state); equip(game, 'replacement', 'body');
  assert.deepEqual(game.getSnapshot('hero').character.resources, { hp: 150, mp: 20 });
  equip(game, 'lowering', 'body');
  assert.deepEqual(game.getSnapshot('hero').character.resources, { hp: 20, mp: 2 });
});

test('[transaction] failed replacement never clamps HP/MP even if new candidate limits are lower', () => {
  const state = makeState(); state.equipment.hero.slots.body = 'armor'; state.characters.hero.resources = { hp: 180, mp: 25 };
  const game = makeGame(state), before = game.exportSave();
  assert.equal(equip(game, 'forbidden', 'body').ok, false); assert.deepEqual(game.exportSave(), before);
});

test('[transaction] stale/missing revision and empty slot rejection preserve exact state', () => {
  const game = makeGame(); equip(game, 'armor', 'body'); const before = game.exportSave();
  assert.equal(equip(game, 'replacement', 'body', 0).error.code, 'STALE_REVISION');
  assert.equal(game.equipItem({ characterId: 'hero', instanceId: 'helmet', targetSlot: 'head' }).ok, false);
  assert.equal(unequip(game, 'head').error.code, 'SLOT_EMPTY'); assert.deepEqual(game.exportSave(), before);
});

test('[transaction] cannot equip another character\'s item', () => {
  const state = makeState(); state.characters.other = clone(state.characters.hero);
  state.inventories.other = { ownedInstanceIds: ['armor'] }; state.inventories.hero.ownedInstanceIds = state.inventories.hero.ownedInstanceIds.filter(x => x !== 'armor');
  state.equipment.other = clone(state.equipment.hero);
  const game = makeGame(state), before = game.exportSave();
  assert.equal(equip(game, 'armor', 'body').error.code, 'ITEM_NOT_OWNED'); assert.deepEqual(game.exportSave(), before);
});

test('[transaction] subscription exceptions do not roll back commits; reentrant writes are rejected', () => {
  const game = makeGame(); let reentrant, seen;
  game.subscribe(() => { throw new Error('view failed'); });
  game.subscribe(n => { reentrant = equip(game, 'helmet', 'head'); seen = n; });
  const result = equip(game, 'armor', 'body');
  assert.equal(result.ok, true); assert.deepEqual(result.notificationErrors, ['SUBSCRIBER_ERROR']);
  assert.equal(reentrant.error.code, 'REENTRANT_COMMAND'); assert.equal(seen.revision, 1);
  assert.equal(game.getSnapshot('hero').equipment.slots.head, null);
});

test('[transaction] post-clamp invariant failure rolls back even resources and revision', () => {
  const state = makeState(); state.revision = Number.MAX_SAFE_INTEGER;
  state.equipment.hero.slots.body = 'armor'; state.characters.hero.resources = { hp: 180, mp: 25 };
  const game = makeGame(state), before = game.exportSave(), notes = [];
  game.subscribe(n => notes.push(n));
  const result = unequip(game, 'body'); // candidate clamps HP, then revision exceeds the safe range
  assert.equal(result.ok, false); assert.equal(result.error.code, 'INVALID_INTEGER');
  assert.deepEqual(game.exportSave(), before); assert.equal(notes.length, 0);
});

test('[transaction] rejected async subscriber is reported without changing committed state', async () => {
  const game = makeGame(); game.subscribe(async () => { throw new Error('host write failed'); });
  const result = equip(game, 'armor', 'body');
  assert.equal(result.ok, true); assert.deepEqual(result.notificationErrors, ['ASYNC_SUBSCRIBER_UNSUPPORTED']);
  await Promise.resolve(); assert.equal(game.getSnapshot('hero').revision, 1);
});
