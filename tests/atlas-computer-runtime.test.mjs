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

test('a missing or broken adapter source leaves the host modules loadable with the paid feature unavailable', async t => {
  const company = 'docs/마케팅/온라인마케팅지도/engagement/company/', service = company + 'computer-interpretation-service.mjs', store = company + 'store.mjs';
  for (const [breakage, reason] of [['missing', 'ERR_MODULE_NOT_FOUND'], ['syntax', 'ADAPTER_LOAD_FAILED']]) {
    const f = await fixture(t);
    for (const path of [service, store]) await fs.copyFile(join(root, path), join(f.directory, path));
    if (breakage === 'missing') await fs.rm(join(f.directory, 'experiences/atlas-lab/model-extraction.mjs'));
    else await fs.writeFile(join(f.directory, 'atlas/domain.js'), 'this is not JavaScript (');
    // The company server imports exactly this service module at startup.
    const result = await f.run(`import { Store } from './${store}';
      const runtime = await import('./${runtime}'), { createComputerInterpretationService } = await import('./${service}');
      const s = new Store('./data'), admin = s.createUser({ name: 'Fixture admin', email: 'admin@runtime-proof.example.test', role: 'admin' });
      const service = createComputerInterpretationService({ store: s, getEnv: name => ({ SYNK_COMPUTER_AI_ENABLED: '1' })[name], fetchImpl: () => { throw new Error('No provider call allowed'); } });
      const state = service.state(admin), privacy = service.privacy(admin);
      const error = await service.interpret(admin, { id: '00000000-0000-4000-8000-000000000001', requestId: 'r', sourceId: 's', revision: 1, text: 'synthetic' })
        .then(() => null, e => ({ status: e.status, code: e.code }));
      await service.stop(); s.close();
      console.log(JSON.stringify({ status: runtime.computerAdapterStatus(), proof: runtime.computerRuntimeProof(), model: runtime.COMPUTER_MODEL,
        build: runtime.buildComputerModelRequest, state: { available: state.available, reason: state.reason }, canDelete: privacy.canDelete, error }));`);
    assert.deepEqual(result.status, { available: false, reason }, breakage);
    assert.equal(result.proof.runtimeAttested, false); assert.equal(result.proof.buildId, null);
    assert.equal(result.model, null); assert.equal(result.build, null);
    assert.deepEqual(result.state, { available: false, reason: 'adapter-unavailable' });
    // Stored responses stay deletable; nothing can be dispatched.
    assert.equal(result.canDelete, true);
    assert.deepEqual(result.error, { status: 503, code: 'SYNK_COMPUTER_AI_UNAVAILABLE' });
  }
});
