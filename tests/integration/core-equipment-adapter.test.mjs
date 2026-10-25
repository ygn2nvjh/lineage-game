import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createGame } from '../../src/core/index.mjs';
import { createEquipmentController, createScenarioState } from '../../src/adapters/browser/core-equipment.mjs';
import { loadItemCatalog, loadEquipmentScenarios, CATALOG_VERSION, pinnedCatalogVersion, sha256 } from '../../src/adapters/browser/item-catalog.mjs';
import { RESOURCE_SHA256 } from '../../src/adapters/browser/item-catalog-pin.mjs';

const root = new URL('../../', import.meta.url);
export async function fileFetcher(url) {
  const target = new URL(url);
  assert.ok(target.href.startsWith(root.href), `Unexpected external resource: ${url}`);
  try { return new Response(await fs.readFile(target)); } catch { return new Response('', { status: 404 }); }
}
const [catalog, definition] = await Promise.all([
  loadItemCatalog({ fetcher: fileFetcher }), loadEquipmentScenarios({ fetcher: fileFetcher })
]);
const clone = value => JSON.parse(JSON.stringify(value));
function setup(scenarioId) {
  const renders = [], results = [];
  const controller = createEquipmentController({ catalog, definition,
    onSnapshot: s => renders.push(s), onResult: r => results.push(r) });
  controller.loadScenario(scenarioId); return { controller, renders, results };
}

test('[adapter data] fixed catalog version binds manifest and every one of 34 parts', async () => {
  assert.equal(await pinnedCatalogVersion(), CATALOG_VERSION);
  assert.equal(Object.keys(RESOURCE_SHA256).length, 35);
  assert.equal(Object.keys(catalog.templates).length, 2992);
  assert.equal(definition.catalogVersion, catalog.version);
});

test('[adapter data] normalized records exactly match baseline loader without modifying source files', async () => {
  const require = createRequire(import.meta.url), old = await require('../helpers/game-harness.cjs').catalog();
  for (const kind of ['weapon', 'armor', 'etcitem']) for (const item of old.byCategory(kind))
    assert.deepEqual(clone(catalog.templates[item.id]), clone(item));
});

test('[adapter data] selected scenario rows match the complete rows verified against pinned upstream SQL', async () => {
  const rows = new Map();
  for (const filename of Object.keys(RESOURCE_SHA256).filter(x => x !== 'manifest.json')) {
    const data = JSON.parse(await fs.readFile(new URL(`data/l1j-taiwan/items/${filename}`, root), 'utf8'));
    for (const row of data.rows) rows.set(Number(row.item_id), { data, row });
  }
  const verified = new Set();
  for (const proof of definition.provenance.rowHashes) {
    const { data, row } = rows.get(proof.templateId);
    const payload = { table: data.table, columns: data.columns, values: data.columns.map(k => row[k]) };
    assert.equal(await sha256(new TextEncoder().encode(JSON.stringify(payload))), proof.rowSha256);
    assert.equal(data.table, proof.table); verified.add(proof.templateId);
  }
  for (const scene of definition.scenarios) for (const item of scene.items) assert.ok(verified.has(item.templateId));
  assert.equal(verified.size, 24);
});

for (const filename of ['manifest.json', 'weapon-part-01.json', 'armor-part-01.json', 'etcitem-part-01.json']) {
  test(`[adapter data] modified ${filename} is rejected before use, even at unchanged version`, async () => {
    const fetcher = async url => {
      const response = await fileFetcher(url);
      return new URL(url).pathname.endsWith(`/${filename}`)
        ? new Response(`${await response.text()} `) : response;
    };
    await assert.rejects(loadItemCatalog({ fetcher }), { code: 'INTEGRITY_MISMATCH' });
  });
}

test('[adapter data] missing catalog response and tampered scenario file do not fall back', async () => {
  await assert.rejects(loadItemCatalog({ fetcher: async () => new Response('', { status: 404 }) }), { code: 'RESOURCE_LOAD_FAILED' });
  await assert.rejects(loadEquipmentScenarios({ fetcher: async () => new Response('{}') }), { code: 'INTEGRITY_MISMATCH' });
});

for (const scenario of definition.scenarios) {
  test(`[adapter scene] ${scenario.id} initializes deterministically with validated real templates`, () => {
    const first = setup(scenario.id), second = setup(scenario.id);
    assert.deepEqual(first.controller.getSnapshot(), second.controller.getSnapshot());
    assert.equal(first.controller.getSnapshot().revision, 0);
    assert.equal(first.renders.length, 1);
    first.controller.dispose(); second.controller.dispose();
  });
}

test('[adapter command] equip updates revision, slots and owned inventory from the same snapshot', () => {
  const { controller: c, renders } = setup('weapon-resolution');
  assert.equal(c.equip('long-sword', 'weapon').ok, true);
  const s = c.getSnapshot(); assert.equal(s.revision, 1);
  assert.equal(s.equipment.slots.weapon, 'long-sword');
  assert.ok(s.inventory.ownedInstanceIds.includes('long-sword'));
  assert.equal(s.derived.weapon.instanceId, 'long-sword'); assert.equal(s.derived.weapon.templateId, 31);
  assert.deepEqual(renders.at(-1), s); assert.equal(renders.length, 2);
  c.unequip('weapon'); assert.equal(c.getSnapshot().derived.weapon, null);
});

test('[adapter command] levels and class restrictions leave both state and rendered snapshot unchanged', () => {
  for (const [scene, instance, slot, error] of [
    ['level-restricted', 'head-level40', 'head', 'LEVEL_RESTRICTED'],
    ['replace-rollback', 'body-forbidden', 'body', 'CLASS_RESTRICTED']
  ]) {
    const { controller: c, renders } = setup(scene), before = c.getSnapshot(), count = renders.length;
    const result = c.equip(instance, slot);
    assert.equal(result.ok, false); assert.equal(result.error.code, error);
    assert.deepEqual(c.getSnapshot(), before); assert.equal(renders.length, count);
  }
});

test('[adapter command] same-template rings are separate instances; no duplicate equip or automatic ring move', () => {
  const { controller: c } = setup('double-rings');
  assert.equal(c.equip('ring-a', 'ring1').ok, true); assert.equal(c.equip('ring-b', 'ring2').ok, true);
  const before = c.getSnapshot(); assert.equal(before.revision, 2);
  assert.equal(c.equip('ring-a', 'ring2').error.code, 'ITEM_ALREADY_EQUIPPED');
  assert.deepEqual(c.getSnapshot(), before);
  assert.equal(before.inventory.items.find(x => x.instanceId === 'ring-a').templateId,
    before.inventory.items.find(x => x.instanceId === 'ring-b').templateId);
  assert.equal(c.equip('ring-a', '').error.code, 'INVALID_SLOT');
});

test('[adapter command] successful replacement and failed replacement are atomic', () => {
  const { controller: c, renders } = setup('replace-rollback');
  const result = c.equip('body-new', 'body'); assert.equal(result.ok, true);
  assert.equal(result.events[0].type, 'ItemReplaced');
  assert.ok(c.getSnapshot().inventory.ownedInstanceIds.includes('body-old'));
  const before = c.getSnapshot(), count = renders.length;
  assert.equal(c.equip('body-forbidden', 'body').ok, false);
  assert.deepEqual(c.getSnapshot(), before); assert.equal(renders.length, count);
});

test('[adapter policy] HP/MP upper-limit increase is shown without healing current resources', () => {
  const { controller: c, renders } = setup('capacity-increase');
  assert.equal(c.equip('soul-belt', 'belt').ok, true);
  const s = renders.at(-1);
  assert.equal(s.derived.maxHp, 125); assert.equal(s.derived.maxMp, 45);
  assert.deepEqual(s.character.resources, { hp: 80, mp: 10 });
});

test('[adapter policy] removing capacity gear clamps once; repeated render never recalculates resources', () => {
  const { controller: c, renders } = setup('capacity-clamp');
  const result = c.unequip('cloak'); assert.equal(result.ok, true);
  assert.equal(result.events.filter(x => x.type === 'ResourcesClamped').length, 1);
  const before = c.getSnapshot(); assert.deepEqual(before.character.resources, { hp: 100, mp: 20 });
  for (let i = 0; i < 100; i++) c.render();
  assert.deepEqual(c.getSnapshot(), before); assert.deepEqual(renders.at(-1), before);
  assert.equal(c.unequip('cloak').error.code, 'SLOT_EMPTY'); assert.equal(c.getSnapshot().revision, 1);
});

test('[adapter ownership] foreign item is absent from own bag and attempted equip is rejected', () => {
  const { controller: c } = setup('ownership'), before = c.getSnapshot();
  assert.deepEqual(before.inventory.ownedInstanceIds, ['own-sword']);
  assert.equal(c.runCheck(0).error.code, 'ITEM_NOT_OWNED'); assert.deepEqual(c.getSnapshot(), before);
});

test('[adapter lifecycle] switching scenes removes old subscriptions; disposed controller cannot write', () => {
  const games = [], renders = []; let active = 0;
  function createCore(options) {
    const actual = createGame(options); games.push(actual);
    return { ...actual, subscribe(fn) { active++; const off = actual.subscribe(fn);
      return () => { active--; off(); }; } };
  }
  const c = createEquipmentController({ catalog, definition, createCore, onSnapshot: s => renders.push(s) });
  c.loadScenario('weapon-resolution'); assert.equal(active, 1);
  const old = games[0]; c.loadScenario('double-rings'); assert.equal(active, 1);
  const count = renders.length, current = c.getSnapshot();
  assert.equal(old.equipItem({ characterId: 'hero', instanceId: 'long-sword', targetSlot: 'weapon', expectedRevision: 0 }).ok, true);
  assert.equal(renders.length, count); assert.deepEqual(c.getSnapshot(), current);
  for (let i = 0; i < 10; i++) c.loadScenario('double-rings');
  assert.equal(active, 1); c.dispose(); c.dispose(); assert.equal(active, 0);
  assert.throws(() => c.equip('ring-a', 'ring1'), { code: 'ADAPTER_NOT_ACTIVE' });
});

test('[adapter lifecycle] failed scene load keeps the old valid scene and subscription', () => {
  const { controller: c, renders } = setup('weapon-resolution'), before = c.getSnapshot();
  assert.throws(() => c.loadScenario('missing'), { code: 'SCENARIO_NOT_FOUND' });
  assert.deepEqual(c.getSnapshot(), before);
  c.equip('long-sword', 'weapon'); assert.deepEqual(renders.at(-1), c.getSnapshot());
});

test('[adapter boundary] output is readonly, stale commands rejected, incomplete stats remain explicit', () => {
  const { controller: c } = setup('weapon-resolution'); c.equip('long-sword', 'weapon');
  const before = c.getSnapshot(); assert.throws(() => { before.character.resources.hp = 0; }, TypeError);
  assert.equal(c.equip('rapier', 'weapon', 0).error.code, 'STALE_REVISION');
  assert.deepEqual(c.getSnapshot(), before);
  for (const key of ['mr', 'er', 'weight']) {
    assert.equal(before.derived[key].value, null); assert.equal(before.derived[key].status, 'not-implemented');
  }
});

test('[adapter boundary] templates, profile definitions and source game remain unchanged', async () => {
  const before = JSON.stringify(definition), rawCatalog = JSON.stringify(catalog);
  const { controller: c } = setup('set-a'); c.unequip('body'); c.loadScenario('set-b'); c.dispose();
  assert.equal(JSON.stringify(definition), before); assert.equal(JSON.stringify(catalog), rawCatalog);
  for (const file of ['src/adapters/browser/core-equipment.mjs', 'src/adapters/browser/item-catalog.mjs', 'dev/core-equipment.html']) {
    const source = await fs.readFile(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /localStorage|lineageGearTest|TEST_WEAPON|lineageCharacter|lineage_v0583\.html|<canvas/i, file);
  }
  const state = createScenarioState(definition, 'weapon-resolution', catalog);
  assert.equal(state.characters.hero.base.experience, 810016);
});

test('[adapter scene] predefined level/EXP pairs match the immutable legacy table, not guessed growth', async () => {
  const original = await fs.readFile(new URL('lineage_v0583.html', root), 'utf8');
  const exp = JSON.parse(original.match(/const EXP_TABLE=(\[[^;]+\]);/)[1]);
  for (const profile of Object.values(definition.profiles)) {
    assert.equal(profile.base.experience, exp[profile.base.level - 1]);
  }
  for (const scene of definition.scenarios) for (const item of scene.items)
    assert.deepEqual(Object.keys(item).sort(), ['instanceId', 'owner', 'templateId']);
});
