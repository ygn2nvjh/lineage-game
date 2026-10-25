'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { plain, core, catalog, gear, selectScript, evaluate } = require('../helpers/game-harness.cjs');

// Setup/runtime failures remain ordinary failures. Only the final assertion of
// desired behavior may become a TODO. No expected value encodes the defect.
function defect(id, title, arrange, verify) {
  test(`[known-defect ${id}] ${title}`, async t => {
    const subject = await arrange();
    try { await verify(subject); }
    catch (error) {
      if (error.code !== 'ERR_ASSERTION') throw error;
      t.todo(`${id}: desired behavior is not implemented; see docs/v06-stage-0a.md`);
      throw error;
    }
    t.diagnostic(`${id}: desired behavior now passes; review and promote to regression, never change the expected value to retain a defect`);
  });
}

defect('D001', 'equipment apply must update private core AC immediately across closures', async () => {
  const h = await gear(core(), await catalog());
  const before = h.context.__phase0.player.ac;
  await h.gearClick({ preset: '0' }); await h.gearClick({ on: '20110' });
  assert.equal(h.context.lineageGearTest.totals.ac, -5, 'Setup: armor must actually be worn');
  assert.equal(require('node:vm').runInContext('typeof player', h.context), 'undefined',
    'Adapter must not leak private player into the global scope');
  return { h, expected: before - 5 };
}, ({ h, expected }) => assert.equal(h.context.__phase0.player.ac, expected,
  'apply() should reach the core without waiting for a HUD refresh'));

defect('D002', 'combat weapon must be the weapon actually equipped', async () => {
  const h = await gear(core(), await catalog());
  await h.gearClick({ preset: '0' }); await h.gearClick({ on: '31' });
  assert.deepEqual(plain(h.context.lineageGearTest.equipped), [31]);
  return h;
}, h => assert.equal(h.context.__phase0.weapon.id, 31,
  'Equipped long sword must replace the independent TEST_WEAPON combat source'));

defect('D003', 'UI refresh must leave the entire core player state unchanged', () => {
  const h = core(), p = h.context.__phase0.player;
  h.context.lineageGearTest = { totals: { add_hp: 20, add_mp: 10, ac: -5 } };
  p.hp = 12; p.mp = 1;
  const before = plain(p);
  h.context.__phase0.updateUI();
  return { before, after: plain(p) };
}, ({ before, after }) => assert.deepEqual(after, before,
  'Rendering should only read core state; event handling must own recalculation'));

defect('D004', 'actual defense validation button must reach its exported combat core', () => {
  const h = core();
  assert.equal(typeof h.context.lineageNpcAttackLabCore, 'function', 'Setup: real combat core must exist');
  evaluate(h, selectScript("center.id='devCenter'"));
  const button = h.created.find(x => x.textContent === '實際防禦／受傷驗證');
  assert.equal(typeof button?.onclick, 'function', 'Setup: actual button handler must exist');
  button.onclick();
  const output = h.created.filter(x => x.tagName === 'DIV' && x.style.cssText?.includes('white-space:pre-wrap'));
  assert.equal(output.length, 1, 'Setup: validation output must be found');
  return output[0].textContent;
}, text => assert.match(text, /正式戰鬥核心驗證/,
  'A private player must be accessed through an explicit interface, not an undefined global'));

defect('D005', 'DR audit must not claim formal armorDR is fixed at zero', () => {
  const h = core();
  evaluate(h, selectScript("$('equipmentAuditRun').onclick"));
  assert.equal(typeof h.get('equipmentAuditRun').onclick, 'function');
  h.get('equipmentAuditRun').onclick();
  assert.ok(h.get('equipmentAuditReport').value, 'Setup: audit report must be generated');
  return h.get('equipmentAuditReport').value;
}, text => assert.doesNotMatch(text, /armorDR：固定 0/,
  'Audit wording must reflect the V0.5.83 equipment DR connection'));
