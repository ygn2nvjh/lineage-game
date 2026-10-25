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


async function openHud(mode = 'normal') {
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
   window.storageCalls=[];window.engineCalls=[];
   for(const method of ['getItem','setItem','removeItem','clear','key'])Storage.prototype[method]=()=>{window.storageCalls.push(method);throw Error('Storage forbidden');};
   window.requestAnimationFrame=()=>{window.engineCalls.push('raf');throw Error('Old loop forbidden');};
 });
 await context.route('**/*',async route=>{
   const url=route.request().url();if(!url.startsWith(base+'/'))return route.abort();
   if((mode==='catalog'&&url.endsWith('armor-part-01.json'))||(mode==='scenario'&&url.endsWith('core-equipment-scenarios.json')))return route.fulfill({status:200,body:'{}'});
   return route.continue();
 });
 await page.goto(base+'/dev/core-hud-integration.html');await page.waitForFunction(()=>['ready','error'].includes(document.querySelector('main').dataset.status),null,{polling:50});
 return {context,page,errors};
}
async function isolated(page){assert.deepEqual(await page.evaluate(()=>window.storageCalls),[]);assert.deepEqual(await page.evaluate(()=>window.engineCalls),[]);assert.equal(await page.evaluate(()=>typeof window.lineageCharacter),'undefined');assert.equal(await page.evaluate(()=>typeof window.player),'undefined');assert.equal(await page.locator('canvas').count(),0);}
async function scene(page,id){await page.selectOption('[data-scenario]',id);reference.loadScenario(id);await consistent(page);}
async function equip(page,id,slot){const row=page.locator(`[data-instance="${id}"]`);await row.locator('select').selectOption(slot);await row.locator('button').click();const result=reference.equip(id,slot);await consistent(page);return result;}
async function consistent(page){
 const s=reference.getSnapshot();for(const area of ['hud','character','equipment'])assert.equal(await page.locator(`[data-${area}]`).getAttribute('data-revision'),String(s.revision));
 for(const area of ['hud','character']){
  const root=page.locator(`[data-${area}]`);
  for(const [key,value] of Object.entries({hp:`${s.character.resources.hp} / ${s.derived.maxHp}`,mp:`${s.character.resources.mp} / ${s.derived.maxMp}`,ac:String(s.derived.ac),level:String(s.character.base.level)}))assert.equal(await root.locator(`[data-value="${key}"]`).textContent(),value);
 }
 assert.equal(await page.locator('[data-hud] [data-value="weapon"]').textContent(),s.derived.weapon?.template.name??'未穿戴武器');
 for(const key of Object.keys(s.derived.attributes.base))assert.equal(await page.locator(`[data-character] [data-value="${key}"]`).textContent(),`${s.derived.attributes.base[key]} / 裝備 ${s.derived.attributes.equipment[key]} / 合計 ${s.derived.attributes.equipmentAdjusted[key]}`);
 for(const key of ['mr','er','weight','effects'])assert.equal(await page.locator(`[data-character] [data-value="${key}"]`).textContent(),'未實作');
 assert.equal(await page.locator('[data-value="count"]').textContent(),String(s.inventory.ownedInstanceIds.length));
 for(const [slot,id] of Object.entries(s.equipment.slots))assert.ok((await page.locator(`[data-slot-row="${slot}"]`).textContent()).includes(id??'未穿戴'));
 for(const item of s.inventory.items){const text=await page.locator(`[data-instance="${item.instanceId}"]`).textContent();assert.ok(text.includes(item.template.name));const worn=Object.entries(s.equipment.slots).find(([,id])=>id===item.instanceId);assert.ok(text.includes(worn?`已穿戴 ${worn[0]}`:'未穿戴'));}
}
test('[HUD Chromium] actual commands, atomic rollback and Snapshot-consistent views', {skip},async()=>{
 const {page,context,errors}=await openHud();try{
 for(const id of ['basic-knight','set-a','set-b','level-restricted','double-rings','capacity-increase','capacity-clamp','replace-rollback','weapon-resolution','ownership'])await scene(page,id);
 await scene(page,'weapon-resolution');await equip(page,'long-sword','weapon');await equip(page,'rapier','weapon');
 await scene(page,'replace-rollback');await equip(page,'body-new','body');assert.equal((await equip(page,'body-forbidden','body')).ok,false);assert.match(await page.locator('[data-result]').textContent(),/CLASS_RESTRICTED/);
 await scene(page,'level-restricted');await equip(page,'head-level40','head');assert.match(await page.locator('[data-result]').textContent(),/LEVEL_RESTRICTED/);
 await scene(page,'double-rings');await equip(page,'ring-a','ring1');await equip(page,'ring-b','ring2');await equip(page,'ring-a','ring2');assert.match(await page.locator('[data-result]').textContent(),/ITEM_ALREADY_EQUIPPED/);
 await scene(page,'capacity-increase');await equip(page,'soul-belt','belt');
 await scene(page,'capacity-clamp');await page.locator('[data-off="cloak"]').click();reference.unequip('cloak');await consistent(page);
 for(let i=0;i<3;i++){await page.locator('[data-panel="character"]').click();await page.locator('[data-panel="character"]').click();await page.locator('[data-panel="equipment"]').click();await page.locator('[data-panel="equipment"]').click();await page.locator('[data-render]').click();await consistent(page);}
 await isolated(page);assert.deepEqual(errors,[]);
 await page.reload();await page.waitForFunction(()=>document.querySelector('main').dataset.status==='ready',null,{polling:50});reference.loadScenario('basic-knight');await consistent(page);await isolated(page);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }finally{await context.close();}
});
for(const mode of ['catalog','scenario'])test(`[HUD Chromium] ${mode} load failure stops initialization without storage or fallback`,{skip},async()=>{const {page,context,errors}=await openHud(mode);try{assert.equal(await page.locator('main').getAttribute('data-status'),'error');assert.equal(await page.locator('[data-controls]').getAttribute('disabled'),'');assert.match(await page.locator('[data-result]').textContent(),/初始化停止.*INTEGRITY_MISMATCH/);await isolated(page);assert.deepEqual(errors,[]);}finally{await context.close();}});
