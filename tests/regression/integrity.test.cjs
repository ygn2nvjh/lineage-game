'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const { ROOT, read, scripts } = require('../helpers/game-harness.cjs');
const manifest = require('../fixtures/baseline.json');

function verify(file) {
  const bytes = fs.readFileSync(path.join(ROOT, file.path));
  const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(blob, file.blob, `${file.path}: bytes differ from approved baseline ${manifest.commit}`);
}

for (const name of ['lineage_v0582.html', 'lineage_v0583.html']) {
  test(`[regression] ${name} is byte-identical to approved Git blob`, () => {
    const entry = manifest.files.find(x => x.path === name);
    assert.ok(entry, `Missing baseline record ${name}`); verify(entry);
  });
}

test('[regression] all other pre-existing tracked files retain their Git blob hashes', () => {
  assert.equal(manifest.commit, 'bb4a13f0765ae12b134a3fb98088f4879fc3778d');
  assert.equal(manifest.files.length, 187, 'Review baseline inventory, do not regenerate to hide drift');
  for (const entry of manifest.files.filter(x => !['lineage_v0582.html', 'lineage_v0583.html'].includes(x.path))) verify(entry);
});

test('[regression] baseline JSON datasets all parse', () => {
  const files = manifest.files.filter(x => x.path.startsWith('data/') && x.path.endsWith('.json'));
  assert.ok(files.length > 50);
  for (const file of files) assert.doesNotThrow(() => JSON.parse(read(file.path)), file.path);
});

test('[regression] V0.5.83 literal script and fetch resources exist locally', () => {
  const html = read('lineage_v0583.html');
  const paths = [...html.matchAll(/(?:src\s*=\s*|fetch\(\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
  assert.ok(paths.includes('./data/monsters.json'));
  assert.ok(paths.includes('./data/weapons.json'));
  assert.ok(paths.includes('data/item-weights.json'));
  assert.ok(paths.some(x => x.endsWith('/catalog.js')));
  for (const file of paths) {
    assert.ok(!file.includes('://'), `Review remote dependency ${file}`);
    assert.ok(fs.statSync(path.join(ROOT, file)).isFile(), file);
  }
});

const inline = scripts();
test('[regression] V0.5.83 contains ten script tags', () => assert.equal(inline.length, 10));
for (const script of inline) {
  test(`[regression] parse ${script.filename}${script.source ? '' : ' (external tag)'}`, () => {
    assert.doesNotThrow(() => new vm.Script(script.source, { filename: script.filename }));
  });
}
