'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sha256, chunks, bundleCounts, buildTargetRelease, planRelease, writePlan, verifyPinnedFiles } = require('../tools/lib/web-target-release.cjs');

const base = '// banner words\nvar helper = 1;\n// header\nvar banner = 2;\n// atlas/flow.js\nvar require_flow = __commonJS({ flow() { return 1; } });\n// app/entry.mjs\nrequire_flow();\nexport { helper };\n';
const next = base.replace('return 1;', 'return 2;');
const input = { key: 'sample', previous: base, baseline: base, candidate: next, targets: ['atlas/flow.js#0'] };
const row = { key: 'sample', publicPaths: ['a.js', 'mirror/a.js'], previous: { sha256LF: sha256(base) }, targetModules: ['atlas/flow.js'] };
const temporary = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-target-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('target replacement preserves all other bytes and reports unambiguous units', () => {
  const result = buildTargetRelease(input);
  assert.equal(result.text, next);
  assert.deepEqual(bundleCounts(result.text), { chunks: 3, commonJsModules: 1 });
  assert.equal(result.result.terminalChunk, 'app/entry.mjs#0');
  assert.equal(result.result.nonTargetSha256, buildTargetRelease({ ...input, candidate: base }).result.nonTargetSha256);
});

test('candidate prefix drift fails even when every module is equal', () => {
  assert.throws(() => buildTargetRelease({ ...input, candidate: next.replace('helper = 1', 'helper = 9') }), /candidate prefix changed/);
});

test('baseline first marker has no broad banner exception', () => {
  const noPrefix = base.slice(base.indexOf('// header'));
  assert.throws(() => buildTargetRelease({ ...input, previous: noPrefix, baseline: noPrefix.replace('banner = 2', 'banner = 3'), candidate: noPrefix }), /baseline chunk changed header/);
});

test('baseline prefix drift fails', () => {
  assert.throws(() => buildTargetRelease({ ...input, previous: base.replace('helper = 1', 'helper = 9') }), /baseline prefix changed/);
});

test('entry and appended epilogue changes cannot hide inside the final marker', () => {
  for (const candidate of [next.replace('require_flow();', 'throw Error("entry");'), next + 'globalThis.changed = true;\n']) {
    assert.throws(() => buildTargetRelease({ ...input, candidate }), /candidate non-target changed app\/entry/);
  }
});

test('last-marker target and removal are explicitly unsupported rather than copying an unchecked tail', () => {
  assert.throws(() => buildTargetRelease({ ...input, targets: ['app/entry.mjs#0'] }), /terminal entry\/epilogue chunk/);
  assert.throws(() => buildTargetRelease({ ...input, targets: [], removed: ['app/entry.mjs#0'], candidate: next.slice(0, next.indexOf('// app/entry')) }), /terminal entry\/epilogue chunk/);
});

test('unknown or duplicate target names fail closed', () => {
  assert.throws(() => buildTargetRelease({ ...input, targets: ['missing#0'] }), /must occur once/);
  assert.throws(() => buildTargetRelease({ ...input, targets: ['atlas/flow.js#0', 'atlas/flow.js#0'] }), /duplicate or overlapping/);
});

test('pinned production variant remains public while generator dependencies stay unchanged', () => {
  const previous = base.replace('banner = 2', 'banner = 7');
  const variant = chunks(previous).find(c => c.key === 'header#0');
  const result = buildTargetRelease({ ...input, previous, productionVariants: { 'header#0': sha256(variant.text) } });
  assert.equal(result.text, next.replace('banner = 2', 'banner = 7'));
  assert.throws(() => buildTargetRelease({ ...input, previous, productionVariants: { 'header#0': '0'.repeat(64) } }), /public variant changed/);
});

test('unused non-terminal removal preserves entry and public ordering', () => {
  const before = base.replace('// app/entry.mjs', '// atlas/unused.js\nvar unused = true;\n// app/entry.mjs');
  const result = buildTargetRelease({ ...input, previous: before, baseline: before, removed: ['atlas/unused.js#0'] });
  assert.equal(result.text, next);
});

test('second public mirror drift fails before any generator or output', t => {
  const root = temporary(t), output = path.join(root, 'out'); let generated = 0;
  assert.throws(() => {
    const plan = planRelease({ bundles: [row], readPublic: name => Buffer.from(name.startsWith('mirror') ? base + '// changed\n' : base), generate() { generated++; return { baseline: base, candidate: next }; } });
    writePlan(plan, output);
  }, /Public bytes moved: mirror\/a.js/);
  assert.equal(generated, 0); assert.equal(fs.existsSync(output), false);
});

test('later bundle drift fails before an earlier valid bundle is generated or written', t => {
  const output = path.join(temporary(t), 'out'); let generated = 0;
  const later = { ...row, key: 'later', publicPaths: ['later.js'] };
  assert.throws(() => {
    const plan = planRelease({ bundles: [row, later], readPublic: name => Buffer.from(name === 'later.js' ? base + '\n' : base), generate() { generated++; return { baseline: base, candidate: next }; } });
    writePlan(plan, output);
  }, /Public bytes moved: later.js/);
  assert.equal(generated, 0); assert.equal(fs.existsSync(output), false);
});

test('generator validation failure leaves all outputs absent', t => {
  const output = path.join(temporary(t), 'out');
  assert.throws(() => {
    const plan = planRelease({ bundles: [row], readPublic: () => Buffer.from(base), generate: () => ({ baseline: base, candidate: next + 'throw Error();' }) });
    writePlan(plan, output);
  }, /candidate non-target changed/);
  assert.equal(fs.existsSync(output), false);
});

test('all valid mirrors write and check, with CRLF normalized only for bundle comparison', t => {
  const output = path.join(temporary(t), 'out');
  const plan = planRelease({ bundles: [row], readPublic: name => Buffer.from(name.startsWith('mirror') ? base.replaceAll('\n', '\r\n') : base), generate: () => ({ baseline: base, candidate: next }) });
  assert.equal(plan[0].mirrors.length, 2);
  assert.notEqual(plan[0].mirrors[0].rawSha256, plan[0].mirrors[1].rawSha256);
  assert.equal(writePlan(plan, output).length, 2);
  assert.equal(fs.readFileSync(path.join(output, 'mirror/a.js'), 'utf8'), next);
  assert.equal(writePlan(plan, output, { check: true }).length, 2);
});

test('stale later output and traversal paths are rejected before writes', t => {
  const root = temporary(t), output = path.join(root, 'out');
  fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'exists.js'), 'keep');
  const plan = [{ text: next, publicPaths: ['new.js', 'exists.js'] }];
  assert.throws(() => writePlan(plan, output), /Stale candidate/);
  assert.equal(fs.existsSync(path.join(output, 'new.js')), false);
  assert.throws(() => writePlan([{ text: next, publicPaths: ['../escape.js'] }], output), /escapes root/);
  assert.equal(fs.existsSync(path.join(root, 'escape.js')), false);
});

test('helper hash mismatch is rejected before any recipe side effect or execution', t => {
  const root = temporary(t), first = path.join(root, 'first.cjs'), second = path.join(root, 'second.cjs');
  fs.writeFileSync(first, 'module.exports = 1;'); fs.writeFileSync(second, 'module.exports = 2;');
  const pins = [first, second].map(file => ({ path: file, sha256: sha256(fs.readFileSync(file)) }));
  assert.equal(verifyPinnedFiles(pins).length, 2);
  fs.appendFileSync(second, 'throw Error("changed");');
  let executions = 0;
  assert.throws(() => { verifyPinnedFiles(pins); executions++; }, /Pinned helper changed/);
  assert.equal(executions, 0);
  assert.throws(() => verifyPinnedFiles([{ path: first, sha256: '' }]), /Expected SHA-256 required/);
});
