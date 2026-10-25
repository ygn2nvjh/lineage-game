import fs from 'node:fs';
import { createGame, createItemCatalog, SLOTS, RULESET_ID } from '../../src/core/index.mjs';

export const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/core-v1.json', import.meta.url), 'utf8'));
export const clone = value => JSON.parse(JSON.stringify(value));
export function makeCatalog(extra = []) {
  return createItemCatalog({ version: fixture.catalogVersion, templates: [...clone(fixture.templates), ...extra] });
}
export function makeState() {
  const stats = { str: 16, dex: 12, con: 18, int: 8, wis: 9, cha: 12 };
  return { schemaVersion: 1, revision: 0, rulesetId: RULESET_ID, catalogVersion: fixture.catalogVersion,
    characters: { hero: {
      identity: { name: 'Fixture Knight', characterClass: 'knight', sex: 'male', createdAt: 1 },
      originalStats: clone(stats),
      base: { stats: clone(stats), level: 30, experience: 810016, hpCapacity: 100, mpCapacity: 10 },
      resources: { hp: 80, mp: 8 }, effects: [], wallet: { adena: 100 }, history: { lossRecords: [] }
    } },
    itemInstances: Object.fromEntries([
      ['armor', 90001], ['ring-a', 90002], ['ring-b', 90002], ['sword', 90003],
      ['replacement', 90004], ['forbidden', 90005], ['high-level', 90006], ['helmet', 90007],
      ['overflow', 90008], ['lowering', 90009]
    ].map(([id, templateId]) => [id, { templateId, quantity: 1, enchantLevel: 0, durability: 0 }])),
    inventories: { hero: { ownedInstanceIds: ['armor', 'ring-a', 'ring-b', 'sword', 'replacement',
      'forbidden', 'high-level', 'helmet', 'overflow', 'lowering'] } },
    equipment: { hero: { slots: Object.fromEntries(SLOTS.map(s => [s, null])) } }
  };
}
export function makeGame(state = makeState(), catalog = makeCatalog()) {
  return createGame({ state, catalog });
}
export function equip(game, instanceId, targetSlot, expectedRevision = game.getSnapshot('hero').revision) {
  return game.equipItem({ characterId: 'hero', instanceId, targetSlot, expectedRevision });
}
export function unequip(game, targetSlot, expectedRevision = game.getSnapshot('hero').revision) {
  return game.unequipItem({ characterId: 'hero', targetSlot, expectedRevision });
}
export function legacyFixture() {
  const state = makeState(), c = state.characters.hero;
  return {
    raw: { name: c.identity.name, sex: c.identity.sex, createdAt: c.identity.createdAt,
      stats: clone(c.base.stats), originalStats: clone(c.originalStats), level: c.base.level,
      exp: c.base.experience, baseMaxHp: c.base.hpCapacity, baseMaxMp: c.base.mpCapacity,
      coins: c.wallet.adena, lossRecords: [] },
    evidence: { characterId: 'hero', resources: clone(c.resources),
      itemInstances: clone(state.itemInstances), inventory: clone(state.inventories.hero),
      equipment: clone(state.equipment.hero), effects: [], adenaEvidence: 100 }
  };
}
