'use strict';

// Target-only rebuilding for marker-delimited esbuild bundles. This is not a JS parser:
// the final marker includes the entry/epilogue and is deliberately immutable.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const lf = text => text.replace(/\r\n/g, '\n');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function chunks(text) {
  const markers = [...text.matchAll(/^ *\/\/ (\S+)$/gm)], seen = new Map();
  assert.ok(markers.length, 'Bundle has no source markers');
  return markers.map((marker, i) => {
    const occurrence = seen.get(marker[1]) || 0;
    seen.set(marker[1], occurrence + 1);
    const end = markers[i + 1]?.index ?? text.length;
    return { name: marker[1], key: `${marker[1]}#${occurrence}`, start: marker.index, end, text: text.slice(marker.index, end) };
  });
}

function one(list, key, where) {
  const found = list.filter(chunk => chunk.key === key);
  assert.equal(found.length, 1, `${where}: ${key} must occur once`);
  return found[0];
}

function without(text, keys) {
  let result = text;
  for (const chunk of chunks(text).filter(row => keys.includes(row.key)).sort((a, b) => b.start - a.start)) {
    result = result.slice(0, chunk.start) + result.slice(chunk.end);
  }
  return result;
}

function bundleCounts(text) {
  return {
    chunks: chunks(text).length,
    commonJsModules: [...text.matchAll(/^ *var require_[\w$]+ = __commonJS2?\(/gm)].length,
  };
}

function buildTargetRelease({ key, previous, baseline, candidate, targets, removed = [], productionVariants = {} }) {
  const P = chunks(previous), B = chunks(baseline), C = chunks(candidate);
  const uniqueKeys = list => [...new Set(list)];
  assert.equal(uniqueKeys([...targets, ...removed]).length, targets.length + removed.length, `${key}: duplicate or overlapping targets`);
  assert.deepEqual(B.map(c => c.key), P.map(c => c.key), `${key}: baseline marker order changed`);
  assert.deepEqual(C.map(c => c.key).sort(), B.filter(c => !removed.includes(c.key)).map(c => c.key).sort(), `${key}: candidate marker set changed`);
  for (const target of [...targets, ...removed]) {
    one(P, target, 'public');
    assert.notEqual(target, P.at(-1).key, `${key}: terminal entry/epilogue chunk cannot be replaced or removed`);
  }
  assert.equal(P.at(-1).key, C.at(-1).key, `${key}: terminal entry changed`);
  assert.equal(previous.slice(0, P[0].start), baseline.slice(0, B[0].start), `${key}: baseline prefix changed`);
  assert.equal(candidate.slice(0, C[0].start), baseline.slice(0, B[0].start), `${key}: candidate prefix changed`);
  for (const variant of Object.keys(productionVariants)) one(P, variant, 'production variant');
  for (const chunk of P) {
    if (Object.hasOwn(productionVariants, chunk.key)) {
      assert.equal(sha256(chunk.text), productionVariants[chunk.key], `${key}: public variant changed ${chunk.key}`);
    } else {
      assert.equal(one(B, chunk.key, 'baseline').text, chunk.text, `${key}: baseline chunk changed ${chunk.key}`);
    }
  }
  for (const chunk of C) {
    if (!targets.includes(chunk.key)) {
      assert.equal(chunk.text, one(B, chunk.key, 'baseline').text, `${key}: candidate non-target changed ${chunk.key}`);
    }
  }
  let text = previous;
  for (const target of [...targets, ...removed].sort((a, b) => one(P, b, 'public').start - one(P, a, 'public').start)) {
    const at = one(P, target, 'public');
    text = text.slice(0, at.start) + (removed.includes(target) ? '' : one(C, target, 'candidate').text) + text.slice(at.end);
  }
  assert.equal(without(text, targets), without(previous, [...targets, ...removed]), `${key}: non-target public bytes changed`);
  const declared = [...text.matchAll(/^ *var (require_[\w$]+) = __commonJS2?\(/gm)].map(m => m[1]);
  for (const call of text.matchAll(/\b(require_[\w$]+)\(\)/g)) {
    assert.ok(declared.includes(call[1]), `${key}: undeclared module ${call[1]}`);
  }
  return { text, result: {
    baselineSha256LF: sha256(baseline), targetBuildSha256LF: sha256(candidate), sha256LF: sha256(text),
    nonTargetSha256: sha256(without(previous, [...targets, ...removed])),
    targetChunks: Object.fromEntries(targets.map(target => [target, sha256(one(chunks(text), target, 'output').text)])),
    ...bundleCounts(text), terminalChunk: P.at(-1).key, terminalPolicy: 'immutable-entry-and-epilogue',
  } };
}

// Preflight every mirror of every bundle before running a generator or returning any output.
function planRelease({ bundles, readPublic, generate }) {
  const paths = new Set();
  const inputs = bundles.map(row => {
    assert.ok(row.publicPaths.length, `${row.key}: no public paths`);
    const mirrors = row.publicPaths.map(publicPath => {
      assert.ok(!paths.has(publicPath), `Duplicate public path: ${publicPath}`);
      paths.add(publicPath);
      const bytes = readPublic(publicPath), text = lf(bytes.toString('utf8'));
      assert.equal(sha256(text), row.previous.sha256LF, `Public bytes moved: ${publicPath}`);
      if (row.previous.rawSha256?.[publicPath]) {
        assert.equal(sha256(bytes), row.previous.rawSha256[publicPath], `Public raw bytes moved: ${publicPath}`);
      }
      return { path: publicPath, rawSha256: sha256(bytes), sha256LF: sha256(text), text };
    });
    return { row, mirrors };
  });
  return inputs.map(({ row, mirrors }) => {
    const generated = generate(row);
    const release = buildTargetRelease({ key: row.key, previous: mirrors[0].text,
      baseline: lf(generated.baseline), candidate: lf(generated.candidate),
      targets: row.targetModules.map(name => `${name}#0`), removed: (row.removedModules || []).map(name => `${name}#0`),
      productionVariants: row.productionVariants });
    return { key: row.key, publicPaths: row.publicPaths, mirrors: mirrors.map(({ text, ...receipt }) => receipt), ...release };
  });
}

// A plan is fully validated in memory. Check all existing destinations before any writes.
function writePlan(plan, outputRoot, { check = false } = {}) {
  const root = path.resolve(outputRoot), used = new Set();
  const files = plan.flatMap(row => row.publicPaths.map(publicPath => {
    const file = path.resolve(root, publicPath);
    assert.ok(file.startsWith(root + path.sep), `Output escapes root: ${publicPath}`);
    assert.ok(!used.has(file), `Duplicate output: ${publicPath}`); used.add(file);
    if (check || fs.existsSync(file)) assert.equal(fs.readFileSync(file, 'utf8'), row.text, `Stale candidate: ${publicPath}`);
    return { file, text: row.text };
  }));
  if (!check) for (const { file, text } of files) {
    if (!fs.existsSync(file)) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, { flag: 'wx' }); }
  }
  return files.map(({ file, text }) => ({ path: file, sha256: sha256(text), bytes: Buffer.byteLength(text) }));
}

// Verify the whole recipe before materialization, and call again immediately before each helper execution.
function verifyPinnedFiles(pins) {
  const paths = new Set();
  return pins.map(pin => {
    assert.match(pin.sha256, /^[a-f0-9]{64}$/, `Expected SHA-256 required: ${pin.path}`);
    const file = path.resolve(pin.path);
    assert.ok(!paths.has(file), `Duplicate pinned helper: ${file}`); paths.add(file);
    const actual = sha256(fs.readFileSync(file));
    assert.equal(actual, pin.sha256, `Pinned helper changed: ${file}`);
    return { path: file, sha256: actual };
  });
}

module.exports = { lf, sha256, chunks, bundleCounts, buildTargetRelease, planRelease, writePlan, verifyPinnedFiles };
