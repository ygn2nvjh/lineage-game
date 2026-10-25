'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function scripts(file = 'lineage_v0583.html') {
  return [...read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .map((m, index) => ({ attributes: m[1], source: m[2], index,
      filename: `${file}:inline-${index + 1}` }));
}

function selectScript(marker, file) {
  const found = scripts(file).filter(s => s.source.includes(marker));
  assert.equal(found.length, 1, `Expected exactly one script containing ${marker}`);
  return found[0];
}

// Minimal DOM adapter, NOT a browser emulator. No layout, Canvas rendering,
// automatic MutationObserver delivery, animation loop or real storage/network.
function dom() {
  const nodes = new Map(), created = [], listeners = new Map();
  function element(tag = 'div', id) {
    const events = new Map(), classes = new Set();
    const el = { tagName: tag.toUpperCase(), id, dataset: {}, style: {}, children: [],
      textContent: '', innerHTML: '', value: '', hidden: false, checked: false,
      classList: { add: x => classes.add(x), remove: x => classes.delete(x),
        toggle(x) { if (classes.has(x)) { classes.delete(x); return false; }
          classes.add(x); return true; } },
      appendChild(child) { this.children.push(child); return child; },
      prepend(child) { this.children.unshift(child); },
      addEventListener(type, fn) { const list = events.get(type) || [];
        list.push(fn); events.set(type, list); },
      async click() { if (this.onclick) await this.onclick({ target: this });
        for (const fn of events.get('click') || []) await fn({ target: this }); },
      closest(selector) { return selector === 'button' ? this : get('realGearChar'); },
      querySelector(selector) { return get(selector.replace(/^#/, '')); },
      querySelectorAll(selector) {
        if (id === 'createStats' && selector === 'button') {
          // Cache until the real render() changes markup, preserving its handlers.
          if (this.buttonMarkup !== this.innerHTML) {
            this.buttonMarkup = this.innerHTML;
            this.buttons = [...this.innerHTML.matchAll(/<button data-idx="(\d+)" data-dir="(-?1)"/g)]
              .map(m => { const b = element('button'); b.dataset = { idx: m[1], dir: m[2] }; return b; });
          }
          return this.buttons || [];
        }
        return [];
      },
      getContext() { return new Proxy({}, { get: (o, key) => o[key] || (() => {}),
        set: (o, key, value) => { o[key] = value; return true; } }); },
      setAttribute() {}, setPointerCapture() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 384, height: 624 }; }
    };
    created.push(el); if (id) nodes.set(id, el); return el;
  }
  function get(id) { return nodes.get(id) || element(id === 'game' ? 'canvas' : 'div', id); }
  const document = { getElementById: get, createElement: tag => element(tag),
    documentElement: { clientWidth: 384, style: {} }, body: element('body'),
    querySelector: selector => get(selector),
    querySelectorAll: selector => selector === 'button'
      ? created.filter(x => x.tagName === 'BUTTON') : [],
    addEventListener(type, fn) { const list = listeners.get(type) || [];
      list.push(fn); listeners.set(type, list); }
  };
  return { document, get, created,
    async gearClick(dataset) {
      const button = element('button'); button.dataset = dataset;
      for (const fn of listeners.get('click') || []) await fn({ target: button });
    }
  };
}

function sandbox() {
  const adapter = dom(), storage = new Map(), math = Object.create(Math);
  let random = () => 0;
  math.random = () => random();
  const context = { document: adapter.document, console, Math: math,
    innerHeight: 624, devicePixelRatio: 1,
    // Keep the real asynchronous startup pending. Tests explicitly call init().
    fetch: () => new Promise(() => {}),
    requestAnimationFrame() {}, addEventListener() {}, setTimeout() {},
    MutationObserver: class { observe() {} },
    localStorage: { getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    confirm: () => false, alert() {}, performance: { now: () => 0 } };
  context.window = context;
  vm.createContext(context);
  return { ...adapter, context, storage, setRandom: fn => { random = fn; } };
}

function evaluate(h, script) {
  return new vm.Script(script.source, { filename: script.filename })
    .runInContext(h.context, { timeout: 2000 });
}

function createCharacter() {
  const h = sandbox();
  evaluate(h, selectScript('const base=[16,12,14,8,9,12]'));
  h.get('createName').value = 'Phase0A'; h.get('createSex').value = 'male';
  for (let i = 0; i < 4; i++) {
    const plus = h.get('createStats').querySelectorAll('button')
      .find(b => b.dataset.idx === '2' && b.dataset.dir === '1');
    assert.ok(plus?.onclick, 'Character allocation handler must be wired');
    plus.onclick();
  }
  h.get('createConfirm').onclick();
  assert.ok(h.context.lineageCharacter, 'Actual creation handler must publish a character');
  return h;
}

function core(character = plain(createCharacter().context.lineageCharacter), file = 'lineage_v0583.html') {
  const h = sandbox(); h.context.lineageCharacter = plain(character);
  const script = selectScript("const c=document.getElementById('game')", file);
  const end = script.source.lastIndexOf('})();');
  assert.ok(end > 0, 'Core IIFE boundary changed: review test adapter');
  // Only the in-memory copy gets a probe. player/TEST_EQUIP stay private;
  // do NOT inject them as globals (that would conceal the real scope defect).
  const probe = `window.__phase0 = { init, updateUI, calculateNpcPcDamage,
    lineageNpcDamageCore, get player(){return player},
    get weapon(){return TEST_WEAPON}, get testEquip(){return TEST_EQUIP} };\n`;
  evaluate(h, { ...script, source: script.source.slice(0, end) + probe + script.source.slice(end) });
  assert.ok(h.context.__phase0?.init, 'Core probe must be installed');
  h.context.__phase0.init();
  return h;
}

async function catalog() {
  const context = vm.createContext({});
  new vm.Script(read('data/l1j-taiwan/items/catalog.js')).runInContext(context);
  return context.LineageTaiwanItems.load({ fetcher: async url => {
    const relative = url.replace(/^\.\//, '');
    assert.ok(relative.startsWith('data/l1j-taiwan/items/'), `Unexpected catalog request ${url}`);
    return { ok: true, status: 200, json: async () => JSON.parse(read(relative)) };
  } });
}

async function gear(h, items) {
  h.context.LineageTaiwanItems = { load: async () => items };
  evaluate(h, selectScript('const PRESETS='));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof h.context.lineageReapplyGear, 'function');
  return h;
}

module.exports = { ROOT, read, plain, scripts, selectScript, evaluate, sandbox,
  createCharacter, core, catalog, gear };
