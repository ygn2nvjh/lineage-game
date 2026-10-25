'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { read, plain, createCharacter, core, catalog, gear } = require('../helpers/game-harness.cjs');

test('[regression] actual catalog loader loads every manifest part and all 2992 items', async () => {
  const items = await catalog();
  assert.equal(items.count, 2992);
  assert.deepEqual(plain(items.summary()), { weapon: 351, armor: 643, etcitem: 1998 });
  for (const kind of ['weapon', 'armor', 'etcitem']) {
    for (const item of items.byCategory(kind)) {
      assert.ok(Number.isSafeInteger(item.id) && item.id > 0);
      assert.equal(item.category, kind);
      assert.ok(Number.isFinite(item.weight), `${item.id} weight`);
    }
  }
  for (const item of items.byCategory('armor')) {
    for (const key of ['ac', 'damage_reduction', 'add_hp', 'add_mp', 'add_str', 'add_dex', 'add_con', 'add_int', 'add_wis', 'add_cha'])
      assert.ok(Number.isFinite(item[key]), `${item.id}.${key}`);
  }
});

test('[regression] runtime monster and weapon datasets have usable IDs and numeric fields', () => {
  const monsters = JSON.parse(read('data/monsters.json')).monsters;
  assert.equal(monsters.length, 17);
  assert.equal(new Set(monsters.map(m => m.npcId)).size, monsters.length);
  for (const m of monsters) {
    assert.ok(Number.isSafeInteger(m.npcId));
    for (const key of ['level', 'hp', 'mp', 'ac', 'exp']) assert.ok(Number.isFinite(m[key]), `${m.npcId}.${key}`);
    assert.ok(m.hp > 0); assert.ok(m.originalTaiwan);
  }
  const weapons = JSON.parse(read('data/weapons.json')).weapons;
  assert.deepEqual(weapons.map(w => w.id), [24, 42]);
  for (const w of weapons) for (const key of ['small', 'large', 'hit', 'bonus', 'bless', 'canbedmg'])
    assert.ok(Number.isFinite(w[key]), `${w.id}.${key}`);
});

test('[regression] real creation handler publishes separate base/original six-stat objects and saves them', () => {
  const h = createCharacter(), c = h.context.lineageCharacter;
  assert.deepEqual(plain(c.stats), { str: 16, dex: 12, con: 18, int: 8, wis: 9, cha: 12 });
  assert.deepEqual(plain(c.originalStats), plain(c.stats));
  assert.notEqual(c.stats, c.originalStats);
  assert.equal(c.level, 1); assert.equal(c.baseMaxHp, 16); assert.equal(c.baseMaxMp, 1);
  assert.deepEqual(JSON.parse(h.storage.get('lineage_v048_character')), plain(c));
});

test('[regression] real equipment transaction publishes IDs, totals and character equipment fields', async () => {
  const h = await gear(core(), await catalog());
  await h.gearClick({ preset: '0' });
  assert.equal(h.context.lineageGearTest.inventory.length, 10);
  await h.gearClick({ on: '20110' });
  const snapshot = h.context.lineageGearTest;
  assert.deepEqual(plain(snapshot.equipped), [20110]);
  assert.equal(snapshot.inventory.length, 9);
  assert.equal(snapshot.totals.ac, -5);
  assert.equal(snapshot.totals.damage_reduction, 0);
  for (const k of ['str', 'dex', 'con', 'int', 'wis', 'cha', 'hp', 'mp', 'hpr', 'mpr', 'mr'])
    assert.ok(Number.isFinite(h.context.lineageCharacter.equipmentBonuses[k]), k);
  await h.gearClick({ off: '20110' });
  assert.equal(h.context.lineageGearTest.totals.ac, 0);
  assert.equal(h.context.lineageGearTest.inventory.length, 10);
});

test('[regression] formal NPC damage entry reads current published equipment DR on every call', () => {
  const h = core(), api = h.context.__phase0;
  api.player.ac = 10;
  h.context.lineageGearTest = { totals: { damage_reduction: 5 } };
  const reduced = api.calculateNpcPcDamage({ lv: 10, str: 12 });
  assert.equal(reduced.armorReduction, 5);
  assert.equal(reduced.total, 2);
  h.context.lineageGearTest.totals.damage_reduction = 0;
  const normal = api.calculateNpcPcDamage({ lv: 10, str: 12 });
  assert.equal(normal.armorReduction, 0);
  assert.equal(normal.total, 7);
  delete h.context.lineageGearTest;
  assert.equal(api.calculateNpcPcDamage({ lv: 10, str: 12 }).total, 7);
});

for (const [random, raw, reduced] of [[0, 7, 2], [0.999999, 16, 11]]) {
  test(`[regression] fixed random=${random}: DR5 reduces damage by 5, bounded at zero`, () => {
    const h = core(), api = h.context.__phase0;
    h.setRandom(() => random);
    const input = { lv: 10, str: 12, ac: 10 };
    assert.equal(api.lineageNpcDamageCore({ ...input, armorDR: 0 }).total, raw);
    assert.equal(api.lineageNpcDamageCore({ ...input, armorDR: 5 }).total, reduced);
    assert.equal(api.lineageNpcDamageCore({ ...input, armorDR: 100 }).total, 0);
  });
}

test('[regression] historical and current damage cores agree when given identical explicit DR', () => {
  const old = core(undefined, 'lineage_v0582.html'), current = core();
  for (const value of [0, 0.5, 0.999999]) {
    old.setRandom(() => value); current.setRandom(() => value);
    for (const ac of [10, 0, -20]) for (const dr of [0, 5, 100]) {
      const input = { lv: 10, str: 12, ac, armorDR: dr };
      assert.deepEqual(plain(current.context.__phase0.lineageNpcDamageCore(input)),
        plain(old.context.__phase0.lineageNpcDamageCore(input)));
    }
  }
});
