import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createGameFromSave, migrateLegacySave } from '../../src/core/index.mjs';
import { makeState, makeCatalog, makeGame, equip, clone, legacyFixture } from '../core/fixture.mjs';

test('[save] export/restore round-trip preserves authoritative data and derived results', () => {
  const game = makeGame(); equip(game, 'armor', 'body'); equip(game, 'sword', 'weapon'); equip(game, 'ring-a', 'ring1');
  const envelope = game.exportSave();
  assert.equal(envelope.saveVersion, 1);
  assert.equal(envelope.state.derived, undefined); assert.equal(envelope.state.characters.hero.equipmentBonuses, undefined);
  const restored = createGameFromSave(envelope, { catalog: makeCatalog() });
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.game.exportSave(), envelope);
  assert.deepEqual(restored.game.getSnapshot('hero'), game.getSnapshot('hero'));
  assert.throws(() => { envelope.state.characters.hero.resources.hp = 0; }, TypeError);
});

test('[save] restored state does not retain writable input references or reroll permanent growth', () => {
  const original = makeGame(), envelope = clone(original.exportSave());
  const restored = createGameFromSave(envelope, { catalog: makeCatalog() });
  envelope.state.characters.hero.base.hpCapacity = 999;
  assert.equal(restored.game.getSnapshot('hero').character.base.hpCapacity, 100);
});

for (const [label, change, code] of [
  ['unknown save version', e => { e.saveVersion = 2; }, 'UNSUPPORTED_SAVE_VERSION'],
  ['unknown state version', e => { e.state.schemaVersion = 2; }, 'UNSUPPORTED_STATE_VERSION'],
  ['unknown ruleset', e => { e.rulesetId = 'unknown'; }, 'SAVE_RULESET_MISMATCH'],
  ['catalog mismatch', e => { e.catalogVersion = 'other'; }, 'SAVE_CATALOG_MISMATCH'],
  ['missing original stats', e => { delete e.state.characters.hero.originalStats; }, 'MISSING_ORIGINAL_STATS'],
  ['duplicate inventory entry', e => { e.state.inventories.hero.ownedInstanceIds.push('armor'); }, 'DUPLICATE_OWNERSHIP'],
  ['same instance equipped twice', e => { e.state.equipment.hero.slots.ring1 = 'ring-a'; e.state.equipment.hero.slots.ring2 = 'ring-a'; }, 'DUPLICATE_EQUIPMENT'],
  ['unknown template', e => { e.state.itemInstances.armor.templateId = 999999; }, 'TEMPLATE_NOT_FOUND'],
  ['missing equipment slot', e => { delete e.state.equipment.hero.slots.earring; }, 'MISSING_SLOT'],
  ['derived state injected into save', e => { e.state.derived = { ac: -99 }; }, 'UNEXPECTED_FIELD'],
  ['out-of-range HP is not silently clamped on load', e => { e.state.characters.hero.resources.hp = 500; }, 'RESOURCE_OUT_OF_RANGE'],
  ['unsafe integer', e => { e.state.revision = Number.MAX_SAFE_INTEGER + 1; }, 'INVALID_INTEGER']
]) {
  test(`[save rejection] ${label}`, () => {
    const input = clone(makeGame().exportSave()); change(input); const before = clone(input);
    const result = createGameFromSave(input, { catalog: makeCatalog() });
    assert.equal(result.ok, false); assert.equal(result.error.code, code); assert.deepEqual(input, before);
  });
}

test('[save rejection] one instance cannot be owned by two characters', () => {
  const envelope = clone(makeGame().exportSave()), state = envelope.state;
  state.characters.other = clone(state.characters.hero);
  state.inventories.other = { ownedInstanceIds: ['armor'] }; state.equipment.other = clone(state.equipment.hero);
  const result = createGameFromSave(envelope, { catalog: makeCatalog() });
  assert.equal(result.ok, false); assert.equal(result.error.code, 'DUPLICATE_OWNERSHIP');
});

test('[legacy migration] complete captured evidence restores without inventing items or changing raw save', () => {
  const { raw, evidence } = legacyFixture(), before = clone({ raw, evidence });
  const migrated = migrateLegacySave(raw, evidence, makeCatalog()); assert.equal(migrated.ok, true);
  const restored = createGameFromSave(migrated.save, { catalog: makeCatalog() }); assert.equal(restored.ok, true);
  assert.deepEqual(restored.game.exportSave().state, makeState());
  assert.deepEqual({ raw, evidence }, before);
});

for (const [label, change, code] of [
  ['missing originalStats', f => { delete f.raw.originalStats; }, 'MISSING_ORIGINAL_STATS'],
  ['missing live evidence', f => { f.evidence = undefined; }, 'LEGACY_EVIDENCE_REQUIRED'],
  ['missing equipment evidence', f => { delete f.evidence.equipment; }, 'LEGACY_EVIDENCE_REQUIRED'],
  ['conflicting currency', f => { f.evidence.adenaEvidence = 999; }, 'LEGACY_CURRENCY_CONFLICT'],
  ['duplicated instances', f => { f.evidence.inventory.ownedInstanceIds.push('armor'); }, 'DUPLICATE_OWNERSHIP'],
  ['conflicting equipment bonuses', f => { f.raw.equipmentBonuses = { hp: 999 }; }, 'LEGACY_BONUS_CONFLICT'],
  ['unknown legacy fields', f => { f.raw.regenBonuses = { otherHpr: 1 }; }, 'UNEXPECTED_FIELD'],
  ['missing current resources', f => { delete f.evidence.resources; }, 'LEGACY_EVIDENCE_REQUIRED'],
  ['missing explicit empty ring2', f => { delete f.evidence.equipment.slots.ring2; }, 'MISSING_SLOT']
]) {
  test(`[legacy migration rejection] ${label} preserves all original input`, () => {
    const f = legacyFixture(); change(f);
    const rawBefore = clone(f.raw), evidenceBefore = f.evidence === undefined ? undefined : clone(f.evidence);
    const result = migrateLegacySave(f.raw, f.evidence, makeCatalog());
    assert.equal(result.ok, false); assert.equal(result.error.code, code);
    assert.deepEqual(f.raw, rawBefore); assert.deepEqual(f.evidence, evidenceBefore);
  });
}

test('[legacy migration] saved equipmentBonuses are verified then discarded, never added twice', () => {
  const f = legacyFixture(); f.evidence.equipment.slots.body = 'armor';
  f.raw.equipmentBonuses = { hp: 100, mp: 20, str: 2, con: 5, wis: 5 };
  const result = migrateLegacySave(f.raw, f.evidence, makeCatalog()); assert.equal(result.ok, true);
  const restored = createGameFromSave(result.save, { catalog: makeCatalog() });
  assert.equal(restored.game.getSnapshot('hero').derived.maxHp, 200);
  assert.equal(restored.game.exportSave().state.characters.hero.equipmentBonuses, undefined);
});

test('[save rejection] currency must not be duplicated as both wallet and item representation', () => {
  const state = makeState(), catalog = makeCatalog([{ id: 40308, name: 'Currency fixture', category: 'etcitem', type: 'other', weight: 0 }]);
  state.itemInstances.gold = { templateId: 40308, quantity: 100, enchantLevel: 0, durability: 0 };
  state.inventories.hero.ownedInstanceIds.push('gold');
  assert.throws(() => createGame({ state, catalog }), { code: 'CURRENCY_REPRESENTATION_CONFLICT' });
});

test('[save rejection] executable/accessor and non-finite data are rejected, not silently serialized away', () => {
  for (const bad of [() => {}, NaN, undefined, 1n]) {
    const input = clone(makeGame().exportSave()); input.state.characters.hero.effects = [bad];
    assert.equal(createGameFromSave(input, { catalog: makeCatalog() }).ok, false);
  }
  let invoked = false;
  const input = clone(makeGame().exportSave());
  Object.defineProperty(input.state, 'revision', { enumerable: true, get() { invoked = true; return 0; } });
  assert.equal(createGameFromSave(input, { catalog: makeCatalog() }).ok, false); assert.equal(invoked, false);
});

test('[save rejection] malformed equipped instance returns a typed error instead of a property exception', () => {
  const input = clone(makeGame().exportSave()); input.state.equipment.hero.slots.body = 'armor';
  input.state.itemInstances.armor = null;
  const result = createGameFromSave(input, { catalog: makeCatalog() });
  assert.equal(result.ok, false); assert.equal(result.error.code, 'INVALID_RECORD');
});

test('[save rejection] malformed collection structures return explicit errors', () => {
  for (const value of [null, [], 1, 'invalid']) {
    const input = clone(makeGame().exportSave()); input.state.equipment = value;
    const result = createGameFromSave(input, { catalog: makeCatalog() });
    assert.equal(result.ok, false); assert.equal(result.error.code, 'INVALID_RECORD');
  }
});

test('[legacy migration rejection] malformed slot evidence is not silently replaced with empty equipment', () => {
  const f = legacyFixture(); f.evidence.equipment = null;
  const result = migrateLegacySave(f.raw, f.evidence, makeCatalog());
  assert.equal(result.ok, false); assert.equal(result.error.code, 'INVALID_RECORD');
});
