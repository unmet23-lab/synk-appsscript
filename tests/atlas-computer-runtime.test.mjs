import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = 'docs/마케팅/온라인마케팅지도/engagement/company/computer-interpretation-runtime.mjs';
const paths = ['atlas/domain.js', 'atlas/interpretation.js', 'docs/마케팅/맞춤도구/computer/content.js',
  'experiences/atlas-lab/interpretation.mjs', 'experiences/atlas-lab/model-extraction.mjs'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const directory = await fs.mkdtemp(join(tmpdir(), 'synk-runtime-proof-'));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep) && directory.includes('synk-runtime-proof-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  for (const path of [runtime, ...paths]) {
    await fs.mkdir(dirname(join(directory, path)), { recursive: true });
    await fs.copyFile(join(root, path), join(directory, path));
  }
  return { directory, async run(code) {
    const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], { cwd: directory });
    return JSON.parse(stdout);
  } };
}

test('fresh Node load reports exactly the five executed interpretation sources', async t => {
  const f = await fixture(t), proof = await f.run(`const m=await import('./${runtime}');console.log(JSON.stringify(m.computerRuntimeProof()));`);
  assert.equal(proof.runtimeAttested, true); assert.ok(Number.isFinite(Date.parse(proof.startedAt)));
  assert.deepEqual(proof.artifacts, await Promise.all(paths.map(async path => ({ path, sha256: hash(await fs.readFile(join(root, path))) }))));
  assert.equal(proof.buildId, hash(JSON.stringify(proof.artifacts)));
});

test('editing disk after load cannot relabel the old in-memory implementation as a new build', async t => {
  const f = await fixture(t), path = 'experiences/atlas-lab/model-extraction.mjs';
  const result = await f.run(`import fs from 'node:fs'; import {createHash} from 'node:crypto';
    const m=await import('./${runtime}'),before=m.computerRuntimeProof();
    fs.appendFileSync(${JSON.stringify(path)},${JSON.stringify('\n// New on-disk revision after server load\n')});
    console.log(JSON.stringify({before,after:m.computerRuntimeProof(),disk:createHash('sha256').update(fs.readFileSync(${JSON.stringify(path)})).digest('hex')}));`);
  assert.deepEqual(result.before, result.after);
  assert.notEqual(result.disk, result.after.artifacts.find(row => row.path === path).sha256);
  // A real fresh process sees the new bytes and must expose a different build.
  const restarted = await f.run(`const m=await import('./${runtime}');console.log(JSON.stringify(m.computerRuntimeProof()));`);
  assert.equal(restarted.runtimeAttested, true); assert.notEqual(restarted.buildId, result.before.buildId);
});

test('previously cached CommonJS cannot be certified using current disk contents', async t => {
  const f = await fixture(t), result = await f.run(`await import('./atlas/interpretation.js');const m=await import('./${runtime}');console.log(JSON.stringify(m.computerRuntimeProof()));`);
  assert.equal(result.runtimeAttested, false); assert.equal(result.buildId, null);
});

test('previously cached ESM cannot be certified even if its file currently matches', async t => {
  const f = await fixture(t), result = await f.run(`await import('./experiences/atlas-lab/interpretation.mjs');const m=await import('./${runtime}');console.log(JSON.stringify(m.computerRuntimeProof()));`);
  assert.equal(result.runtimeAttested, false); assert.equal(result.buildId, null);
});

test('caller cannot mutate the stored proof, and the hook is removed after adapter loading', async t => {
  const f = await fixture(t), result = await f.run(`import fs from 'node:fs';const m=await import('./${runtime}');const p=m.computerRuntimeProof();
    const id=p.buildId;p.artifacts[0].sha256='fake';p.buildId='fake';
    fs.writeFileSync('unrelated.mjs','export default 42;');const other=await import('./unrelated.mjs');
    console.log(JSON.stringify({id,proof:m.computerRuntimeProof(),other:other.default}));`);
  assert.equal(result.proof.buildId, result.id); assert.notEqual(result.proof.artifacts[0].sha256, 'fake'); assert.equal(result.other, 42);
});
