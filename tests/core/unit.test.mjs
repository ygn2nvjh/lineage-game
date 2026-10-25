import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { deriveStats, createItemCatalog, createGame, SLOTS, provenance } from '../../src/core/index.mjs';
import { makeState, makeCatalog, makeGame, equip, clone, fixture } from './fixture.mjs';

test('[core unit] imports without browser globals and exposes no arbitrary write APIs', () => {
  const game = makeGame();
  assert.equal(typeof game.getSnapshot, 'function');
  for (const name of ['state', 'player', 'applyDamage', 'gainExperience', 'recalculateStats', 'setState'])
    assert.equal(game[name], undefined, name);
  assert.ok(Object.isFrozen(game));
});

test('[core unit] all core modules avoid environment I/O and implicit clocks/randomness', () => {
  function visit(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? visit(new URL(`${e.name}/`, dir)) : [new URL(e.name, dir)]); }
  for (const url of visit(new URL('../../src/core/', import.meta.url))) {
    const source = fs.readFileSync(url, 'utf8');
    assert.doesNotMatch(source, /\b(?:window|document|localStorage|fetch|Canvas)\s*[.(]/, url.pathname);
    assert.doesNotMatch(source, /Date\s*\(|Date\.now|Math\.random|from\s*['"]node:/, url.pathname);
  }
});

test('[core unit] input state and catalog cannot mutate the core after creation', () => {
  const state = makeState(), raw = { version: fixture.catalogVersion, templates: clone(fixture.templates) };
  const catalog = createItemCatalog(raw), game = createGame({ state, catalog });
  state.characters.hero.resources.hp = 1; state.itemInstances.sword.enchantLevel = 999;
  raw.templates[0].add_hp = 5000;
  assert.equal(game.getSnapshot('hero').character.resources.hp, 80);
  assert.equal(game.getSnapshot('hero').inventory.items.find(x => x.instanceId === 'sword').enchantLevel, 0);
  assert.ok(Object.isFrozen(catalog.templates['90001']));
});

test('[core unit] derived values are deterministic, non-mutating and never double-add equipment', () => {
  const state = makeState(), catalog = makeCatalog(); state.equipment.hero.slots.body = 'armor';
  const before = clone(state), first = deriveStats(state, catalog, 'hero');
  for (let i = 0; i < 10; i++) assert.deepEqual(deriveStats(state, catalog, 'hero'), first);
  assert.deepEqual(state, before);
  assert.equal(first.maxHp, 200); assert.equal(first.maxMp, 30);
  assert.equal(first.equipmentBonuses.add_str, 2); assert.equal(first.dr.value, 3);
  assert.equal(first.attributes.equipmentAdjusted.con, 23);
  assert.equal(state.characters.hero.base.hpCapacity, 100);
});

test('[core unit] AC uses base DEX and original DEX, not equipment-adjusted DEX', () => {
  const extra = { id: 91000, name: 'DEX fixture', category: 'armor', type: 'glove', weight: 1,
    use_knight: 1, add_dex: 20 };
  const state = makeState(), catalog = makeCatalog([extra]);
  state.itemInstances.dex = { templateId: 91000, quantity: 1, enchantLevel: 0, durability: 0 };
  state.inventories.hero.ownedInstanceIds.push('dex'); state.equipment.hero.slots.hands = 'dex';
  const d = deriveStats(state, catalog, 'hero');
  assert.equal(d.attributes.equipmentAdjusted.dex, 32);
  assert.equal(d.ac, 6); // 10 - floor(30/7), original DEX12 gives no AC bonus.
});

test('[core unit] HP/MP and AC match actual V0.5.83 HUD at fixed valid inputs', () => {
  const require = createRequire(import.meta.url);
  const harness = require('../helpers/game-harness.cjs');
  for (const dex of [9, 12, 13, 16, 18]) {
    const state = makeState(); state.characters.hero.base.stats.dex = dex;
    state.characters.hero.originalStats.dex = dex; state.equipment.hero.slots.body = 'armor';
    const c = state.characters.hero, d = deriveStats(state, makeCatalog(), 'hero');
    const old = harness.core({ name: 'Fixture', level: c.base.level, stats: c.base.stats,
      originalStats: c.originalStats, baseMaxHp: c.base.hpCapacity, baseMaxMp: c.base.mpCapacity });
    old.context.lineageGearTest = { totals: { ac: -5, add_hp: 100, add_mp: 20 } };
    old.context.__phase0.updateUI();
    assert.deepEqual([d.ac, d.maxHp, d.maxMp],
      [old.context.__phase0.player.ac, old.context.__phase0.player.max, old.context.__phase0.player.maxMp]);
  }
});

test('[core unit] MR/ER/weight/effects remain explicit contracts, not guessed formula results', () => {
  const state = makeState(); state.characters.hero.effects = [{ effectId: 'e1', kind: 'unresolved', data: { wis: 5 } }];
  const d = deriveStats(state, makeCatalog(), 'hero');
  for (const key of ['mr', 'er', 'weight']) {
    assert.equal(d[key].status, 'not-implemented'); assert.equal(d[key].value, null);
  }
  assert.equal(d.attributes.effects.status, 'not-implemented');
  assert.equal(d.weight.inputs.items.length, 10);
  assert.equal(provenance.l1jReferenceSha, '8aa24617476a7d8f6a7072687279c77cf9f3d405');
});

test('[core unit] new catalog equipment uses the same derivation path without new character fields', () => {
  const extra = { id: 92000, name: 'New fixture boots', category: 'armor', type: 'boots',
    weight: 2, use_knight: 1, add_hp: 7, add_dex: 3, damage_reduction: 2, ac: -2 };
  const state = makeState(); state.itemInstances.new = { templateId: 92000, quantity: 1, enchantLevel: 0, durability: 0 };
  state.inventories.hero.ownedInstanceIds.push('new');
  const game = makeGame(state, makeCatalog([extra]));
  assert.equal(equip(game, 'new', 'feet').ok, true);
  const snapshot = game.getSnapshot('hero');
  assert.equal(snapshot.derived.maxHp, 107); assert.equal(snapshot.derived.dr.value, 2);
  assert.equal(snapshot.derived.attributes.equipment.dex, 3);
});

test('[core unit] snapshots and nested catalog/weapon references are immutable and detached', () => {
  const game = makeGame(); equip(game, 'sword', 'weapon');
  const before = game.exportSave(), s = game.getSnapshot('hero');
  for (const mutate of [() => { s.character.resources.hp = 0; },
    () => { s.equipment.slots.weapon = null; },
    () => { s.inventory.items[0].template.add_hp = 999; },
    () => { s.derived.weapon.template.dmg_small = 999; },
    () => { s.derived.attributes.original.str = 99; }]) assert.throws(mutate, TypeError);
  const detached = clone(s); detached.character.resources.hp = 0;
  assert.deepEqual(game.exportSave(), before);
  for (let i = 0; i < 10; i++) assert.deepEqual(game.getSnapshot('hero'), s);
});

test('[core unit] UI rendering a snapshot cannot change revision, resources or derivation', () => {
  const game = makeGame(), before = game.exportSave();
  function render(snapshot) { return `${snapshot.character.resources.hp}/${snapshot.derived.maxHp} AC${snapshot.derived.ac}`; }
  for (let i = 0; i < 100; i++) assert.equal(render(game.getSnapshot('hero')), '80/100 AC6');
  assert.deepEqual(game.exportSave(), before);
});

test('[core unit] weapon resolver follows equipped instance and preserves instance properties', () => {
  const state = makeState(); state.itemInstances.sword.enchantLevel = 6; state.itemInstances.sword.durability = 2;
  const game = makeGame(state); equip(game, 'sword', 'weapon');
  const w = game.resolveWeapon('hero');
  assert.equal(w.instanceId, 'sword'); assert.equal(w.templateId, 90003);
  assert.equal(w.enchantLevel, 6); assert.equal(w.durability, 2); assert.equal(w.template.dmg_small, 11);
});

test('[core unit] unequipped weapon never falls back to an external TEST_WEAPON', () => {
  const game = makeGame();
  assert.equal(game.resolveWeapon('hero'), null);
  assert.equal(game.getSnapshot('hero').derived.weapon, null);
  assert.doesNotMatch(fs.readFileSync(new URL('../../src/core/derived-stats.mjs', import.meta.url), 'utf8'), /TEST_WEAPON/);
});

test('[core unit] every existing equipment position remains represented, including two rings', () => {
  for (const slot of ['head', 'neck', 'earring', 'weapon', 'body', 'shield', 'cloak', 'hands', 'ring1', 'ring2', 'belt', 'feet'])
    assert.ok(SLOTS.includes(slot), slot);
  assert.equal(Object.keys(makeGame().getSnapshot('hero').equipment.slots).length, SLOTS.length);
});

test('[core unit] actual Taiwan catalog records normalize through one catalog boundary', async () => {
  const require = createRequire(import.meta.url), { catalog } = require('../helpers/game-harness.cjs');
  const legacyCatalog = await catalog();
  const normalized = createItemCatalog({ version: 'test-taiwan-baseline', templates:
    ['weapon', 'armor', 'etcitem'].flatMap(kind => legacyCatalog.byCategory(kind).map(clone)) });
  assert.equal(Object.keys(normalized.templates).length, 2992);
  assert.equal(normalized.templates['31'].category, 'weapon');
});

test('[core unit] catalog rejects duplicate templates and malformed entries with explicit errors', () => {
  assert.throws(() => createItemCatalog({ version: 'x', templates: [null] }), { code: 'INVALID_RECORD' });
  const item = clone(fixture.templates[0]);
  assert.throws(() => createItemCatalog({ version: 'x', templates: [item, item] }), { code: 'DUPLICATE_TEMPLATE' });
});

test('[core unit] capacity floor preserves legacy HUD minimum one, including base MP zero', () => {
  const state = makeState(); state.characters.hero.base.mpCapacity = 0;
  state.characters.hero.resources.mp = 0;
  const game = makeGame(state); assert.equal(game.getSnapshot('hero').derived.maxMp, 1);
  assert.equal(game.getSnapshot('hero').character.resources.mp, 0);
});
