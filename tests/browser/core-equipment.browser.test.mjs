// Optional real Chromium test: uses an installed Playwright, no project dependency or download.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadItemCatalog, loadEquipmentScenarios } from '../../src/adapters/browser/item-catalog.mjs';
import { createEquipmentController } from '../../src/adapters/browser/core-equipment.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { /* explicitly skipped below */ }
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
let available = Boolean(chromium);
try { await fs.access(executablePath); } catch { available = false; }
const skip = available ? false : 'Requires installed Playwright and Chromium; not a browser pass';
const root = fileURLToPath(new URL('../../', import.meta.url));
let server, browser, base, reference;
test.before(async () => {
  if (!available) return;
  const fetcher = async url => new Response(await fs.readFile(url));
  const [catalog, definition] = await Promise.all([loadItemCatalog({ fetcher }), loadEquipmentScenarios({ fetcher })]);
  reference = createEquipmentController({ catalog, definition });
  server = http.createServer(async (request, response) => {
    try {
      const file = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
      if (!file.startsWith(root)) { response.writeHead(403); response.end(); return; }
      const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };
      const bytes = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(bytes);
    } catch { if (!response.headersSent) response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
});
test.after(async () => { reference?.dispose(); await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function open(viewport = { width: 1280, height: 900 }, tamper = false) {
  const context = await browser.newContext({ viewport }), page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
  await context.addInitScript(() => {
    sessionStorage.setItem('test-isolation', 'browser-only');
    localStorage.setItem('lineage_v048_character', 'DO-NOT-CHANGE');
    for (const method of ['setItem', 'removeItem', 'clear']) Storage.prototype[method] = () => { throw new Error('Unexpected storage write'); };
  });
  await context.route('**/*', async route => {
    if (!route.request().url().startsWith(`${base}/`)) return route.abort();
    if (tamper && route.request().url().endsWith('/armor-part-01.json')) {
      const original = await route.fetch(); return route.fulfill({ response: original, body: `${await original.text()} ` });
    }
    return route.continue();
  });
  await page.goto(`${base}/dev/core-equipment.html`);
  await page.waitForFunction(() => ['ready', 'error'].includes(document.querySelector('main').dataset.status));
  return { context, page, errors, requests };
}
const field = (page, key) => page.locator(`[data-field="${key}"]`);
async function scene(page, id) {
  await page.selectOption('[data-role="scenario"]', id);
  await page.waitForFunction(id => document.querySelector('main').dataset.scenario === id, id);
  assert.equal(await field(page, 'revision').textContent(), '0');
  reference.loadScenario(id); await assertSnapshotDisplay(page);
}
async function equip(page, id, slot) {
  const row = page.locator(`[data-field="inventory"] [data-instance-id="${id}"]`);
  if (slot) await row.locator('select').selectOption(slot);
  const target = await row.locator('select').inputValue();
  await row.locator('button[data-action="equip"]').click();
  reference.equip(id, target); await assertSnapshotDisplay(page);
}
// The independent Node core is an equivalent-input test oracle, never app state.
async function assertSnapshotDisplay(page) {
  const s = reference.getSnapshot();
  assert.equal(await field(page, 'revision').textContent(), String(s.revision));
  assert.equal(await field(page, 'hp').textContent(), `${s.character.resources.hp} / ${s.derived.maxHp}`);
  assert.equal(await field(page, 'mp').textContent(), `${s.character.resources.mp} / ${s.derived.maxMp}`);
  assert.equal(await field(page, 'ac').textContent(), String(s.derived.ac));
  assert.equal(await field(page, 'dr').textContent(), String(s.derived.dr.value));
  assert.equal(await field(page, 'count').textContent(), String(s.inventory.ownedInstanceIds.length));
  for (const [slot, instanceId] of Object.entries(s.equipment.slots)) {
    const text = await page.locator(`[data-field="slots"] > [data-slot="${slot}"]`).textContent();
    assert.ok(text.includes(instanceId === null ? '未穿戴' : `[${instanceId}]`));
  }
}
async function display(page) {
  return Promise.all(['revision', 'hp', 'mp', 'ac', 'dr', 'weapon'].map(k => field(page, k).textContent()));
}

test('[desktop Chromium] isolated two-panel layout and every initial scenario', { skip }, async () => {
  const { page, context, errors, requests } = await open();
  try {
    assert.equal(await page.locator('main').getAttribute('data-status'), 'ready');
    const left = await page.locator('#character-panel').boundingBox(), right = await page.locator('#inventory-panel').boundingBox();
    assert.ok(left.x < right.x && Math.abs(left.y - right.y) < 2);
    for (const id of ['basic-knight', 'set-a', 'set-b', 'level-restricted', 'double-rings',
      'capacity-increase', 'capacity-clamp', 'replace-rollback', 'weapon-resolution', 'ownership']) {
      await scene(page, id);
      for (const k of ['mr', 'er', 'weight']) assert.equal(await field(page, k).textContent(), '未實作');
      if (id === 'set-a' || id === 'set-b') assert.equal(await page.locator('[data-action="unequip"]').count(), 10);
    }
    assert.equal(await page.locator('canvas').count(), 0);
    assert.equal(await page.evaluate(() => typeof window.lineageCharacter), 'undefined');
    assert.equal(await page.evaluate(() => localStorage.getItem('lineage_v048_character')), 'DO-NOT-CHANGE');
    assert.ok(requests.every(url => !url.includes('lineage_v0583.html'))); assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('[desktop Chromium] actual clicks exercise transactions, two rings, limits, rollback, clamp, weapon and ownership', { skip }, async () => {
  const { page, context, errors } = await open();
  try {
    await scene(page, 'level-restricted'); const before = await display(page);
    await equip(page, 'head-level40'); assert.match(await field(page, 'result').textContent(), /LEVEL_RESTRICTED/);
    assert.deepEqual(await display(page), before);
    await scene(page, 'double-rings');
    await equip(page, 'ring-a'); assert.match(await field(page, 'result').textContent(), /TARGET_SLOT_REQUIRED/);
    await equip(page, 'ring-a', 'ring1'); await equip(page, 'ring-b', 'ring2');
    assert.equal(await field(page, 'revision').textContent(), '2');
    assert.match(await page.locator('[data-field="slots"] > [data-slot="ring1"]').textContent(), /ring-a/);
    assert.match(await page.locator('[data-field="slots"] > [data-slot="ring2"]').textContent(), /ring-b/);
    await equip(page, 'ring-a', 'ring2'); assert.match(await field(page, 'result').textContent(), /ITEM_ALREADY_EQUIPPED/);
    assert.equal(await field(page, 'revision').textContent(), '2');
    await scene(page, 'capacity-increase'); await equip(page, 'soul-belt');
    assert.equal(await field(page, 'hp').textContent(), '80 / 125'); assert.equal(await field(page, 'mp').textContent(), '10 / 45');
    await scene(page, 'capacity-clamp');
    await page.locator('[data-action="unequip"][data-slot="cloak"]').click();
    reference.unequip('cloak'); await assertSnapshotDisplay(page);
    assert.equal(await field(page, 'hp').textContent(), '100 / 100'); assert.equal(await field(page, 'mp').textContent(), '20 / 20');
    assert.equal(await field(page, 'revision').textContent(), '1');
    await scene(page, 'replace-rollback'); await equip(page, 'body-new');
    assert.equal(await field(page, 'revision').textContent(), '1');
    assert.match(await page.locator('[data-field="slots"] > [data-slot="body"]').textContent(), /body-new/);
    const replaced = await display(page); await equip(page, 'body-forbidden');
    assert.match(await field(page, 'result').textContent(), /CLASS_RESTRICTED/); assert.deepEqual(await display(page), replaced);
    await scene(page, 'weapon-resolution'); await equip(page, 'long-sword');
    assert.match(await field(page, 'weapon').textContent(), /實例 long-sword.*模板 31/);
    await equip(page, 'rapier'); assert.match(await field(page, 'weapon').textContent(), /實例 rapier.*模板 42/);
    await page.locator('[data-action="unequip"][data-slot="weapon"]').click();
    reference.unequip('weapon'); await assertSnapshotDisplay(page);
    assert.match(await field(page, 'weapon').textContent(), /未穿戴武器/);
    await scene(page, 'ownership'); await page.locator('[data-action="check"]').click();
    reference.runCheck(0); await assertSnapshotDisplay(page);
    assert.match(await field(page, 'result').textContent(), /ITEM_NOT_OWNED/); assert.equal(await field(page, 'revision').textContent(), '0');
    assert.equal(await page.locator('[data-field="inventory"] [data-instance-id="other-rapier"]').count(), 0);
    for (let i = 0; i < 4; i++) { await scene(page, 'weapon-resolution'); await equip(page, 'long-sword');
      assert.equal(await field(page, 'revision').textContent(), '1'); assert.match(await field(page, 'result').textContent(), /操作成功/); }
    assert.equal(await page.evaluate(() => localStorage.getItem('lineage_v048_character')), 'DO-NOT-CHANGE');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('[desktop Chromium] corrupt catalog bytes stop initialization visibly without fallback', { skip }, async () => {
  const { page, context } = await open(undefined, true);
  try {
    assert.equal(await page.locator('main').getAttribute('data-status'), 'error');
    assert.match(await field(page, 'result').textContent(), /INTEGRITY_MISMATCH/);
    assert.equal(await page.locator('[data-role="scenario"]').isDisabled(), true);
    assert.equal(await page.locator('[data-action="equip"]').count(), 0);
  } finally { await context.close(); }
});

test('[mobile viewport Chromium, not Safari] stacked panels, no horizontal overflow and working explicit ring target', { skip }, async () => {
  const { page, context, errors } = await open({ width: 390, height: 844 });
  try {
    await scene(page, 'double-rings');
    const left = await page.locator('#character-panel').boundingBox(), right = await page.locator('#inventory-panel').boundingBox();
    assert.ok(right.y >= left.y + left.height);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await equip(page, 'ring-a', 'ring1'); assert.equal(await field(page, 'revision').textContent(), '1');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
