import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';

const cli = fileURLToPath(new URL('../experiences/atlas-lab/dating-server.mjs', import.meta.url));
const digest = async filename => createHash('sha256').update(await fs.readFile(filename)).digest('hex');
const listen = target => new Promise((resolve, reject) => { target.once('error', reject); target.listen(0, '127.0.0.1', resolve); });
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
async function bounded(promise) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Synthetic restore CLI timed out')), 10000); })]); } finally { clearTimeout(timer); } }
async function portOpen(port) { return new Promise(resolve => { const socket = net.createConnection({ host: '127.0.0.1', port }); let done = false; const finish = value => { if (done) return; done = true; socket.destroy(); resolve(value); }; socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.setTimeout(1000, () => finish(false)); }); }
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-restore-cli-')), children = [];
  let identityRequests = 0;
  const identity = http.createServer((_req, res) => { identityRequests++; res.writeHead(500).end(); });
  t.after(async () => {
    // Child termination here is fixture cleanup, not OS graceful-shutdown proof.
    for (const process of children) if (process.child.exitCode === null && process.child.signalCode === null) process.child.kill();
    await Promise.all(children.map(process => process.exited));
    identity.closeAllConnections(); await new Promise(resolve => identity.close(resolve));
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-dating-restore-cli-'));
    await fs.rm(dir, { recursive: true, force: true });
  });
  await listen(identity); const identityOrigin = `http://127.0.0.1:${identity.address().port}`;
  const reservation = net.createServer(); await listen(reservation); const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const databasePath = path.join(dir, 'account.sqlite'), evidencePath = path.join(dir, 'paired.json'), latestEvidencePath = path.join(dir, 'latest.json'), configPath = path.join(dir, 'public.json');
  const subject = randomUUID(), eventId = randomUUID(), observedAt = new Date().toISOString();
  const config = { version: 1, supabaseUrl: identityOrigin, accountApiUrl: identityOrigin, supabasePublishableKey: 'sb_publishable_synthetic_restore_cli', portalUrl: identityOrigin + '/id/', clients: { platform: { clientId: 'synthetic-restore-cli', redirectUri: `http://127.0.0.1:${port}/atlas-lab/dating.html` } } };
  const store = createDatingStore({ path: databasePath, mode: 'account' });
  try { store.transaction(tx => { tx.ensureAccount(subject, { nickname: '합성 복구 비공개 이름', secret: 'synthetic-private-restore-record' }); tx.putCentralAvailability(subject, 1, 'active', false, observedAt); tx.rememberAvailabilitySequence(subject, 1, 'active'); tx.putLifecycleReceipt('synk-account', eventId, 'a'.repeat(64), observedAt, { status: 'applied', subjectId: subject, sequence: 1 }); }); } finally { store.close(); }
  const environment = { accountApiUrl: new URL(config.accountApiUrl).href, clientId: config.clients.platform.clientId, issuer: 'synk-account', audience: 'atlas-dating' };
  const central = { accounts: [{ synk_user_id: subject, status: 'active' }], cursor: [{ subject_id: subject, sequence: 1 }], events: [{ event_id: eventId, subject_id: subject, sequence: 1, status: 'active', state: 'delivered' }], deletion: [] };
  const paired = { version: 1, kind: 'atlas-dating-restore-snapshot', exportId: randomUUID(), environment, capturedAt: observedAt, productSha256: await digest(databasePath), central };
  const latest = { version: 1, kind: 'atlas-dating-restore-latest', exportId: randomUUID(), environment, observedAt, source: 'independent-current-central-ledger', central: structuredClone(central) };
  await fs.writeFile(configPath, JSON.stringify(config)); await fs.writeFile(evidencePath, JSON.stringify(paired)); await fs.writeFile(latestEvidencePath, JSON.stringify(latest));
  const env = { ...cleanEnv(), SYNK_DATING_MODE: 'account', SYNK_DATING_PORT: String(port), SYNK_DATING_ACCOUNT_CONFIG: configPath, SYNK_DATING_DB: databasePath, SYNK_DATING_RESTORE_EVIDENCE: evidencePath, SYNK_DATING_RESTORE_LATEST: latestEvidencePath };
  const launch = (args, extra = {}) => {
    const child = spawn(process.execPath, [cli, ...args], { env: { ...env, ...extra }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); let stdout = '', stderr = '', readyResolve;
    const ready = new Promise(resolve => { readyResolve = resolve; });
    child.stdout.on('data', chunk => { stdout += chunk; if (stdout.includes('SYNK 나다운 만남 (account):')) readyResolve(); }); child.stderr.on('data', chunk => { stderr += chunk; });
    const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr })); });
    const running = { child, exited, ready: () => bounded(Promise.race([ready, exited.then(value => { throw new Error('Restore CLI did not start: ' + value.stderr); })])), output: () => ({ stdout, stderr }) }; children.push(running); return running;
  };
  const run = async (args, extra) => bounded(launch(args, extra).exited);
  const snapshot = async () => { const files = (await fs.readdir(dir)).sort(); return Object.fromEntries(await Promise.all(files.map(async name => [name, await digest(path.join(dir, name))]))); };
  const assertPrivate = output => { for (const privateValue of [dir, subject, eventId, '합성 복구 비공개 이름', 'synthetic-private-restore-record', config.clients.platform.clientId]) assert.equal(output.includes(privateValue), false, 'CLI must omit private fixture details'); };
  return { dir, port, databasePath, evidencePath, latestEvidencePath, latest, config, run, launch, snapshot, assertPrivate, identityRequests: () => identityRequests };
}

test('actual --check-restore prints a redacted summary without DB writes, adult imports, account calls or a listener', { timeout: 15000 }, async t => {
  const f = await fixture(t), marker = path.join(f.dir, 'adult-imported.txt'), adapter = path.join(f.dir, 'adult.mjs');
  await fs.writeFile(adapter, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'imported'); throw new Error('must not import during inspection');`);
  const before = await f.snapshot(), result = await f.run(['--check-restore'], { SYNK_DATING_ADULT_ADAPTER: adapter });
  assert.equal(result.code, 0, result.stderr); const summary = JSON.parse(result.stdout); assert.equal(summary.ok, true); assert.equal(summary.kind, 'atlas-dating-restore-check'); assert.equal(summary.accountCount, 1); assert.equal(summary.remoteLatestVerified, false); assert.equal(summary.localOnly, true);
  f.assertPrivate(result.stdout + result.stderr); assert.deepEqual(await f.snapshot(), before); assert.equal(f.identityRequests(), 0); assert.equal(await portOpen(f.port), false);
});

test('actual --resume-after-restore admits the same files and serves account config without verifier injection or account calls', { timeout: 15000 }, async t => {
  const f = await fixture(t), running = f.launch(['--resume-after-restore']); await running.ready();
  const response = await fetch(`http://127.0.0.1:${f.port}/api/atlas-dating/config`, { signal: AbortSignal.timeout(2000) }); assert.equal(response.status, 200);
  const value = await response.json(); assert.equal(value.mode, 'account'); assert.equal(value.demoEnabled, false); assert.equal(value.accountConfig.clients.platform.clientId, f.config.clients.platform.clientId); assert.equal(f.identityRequests(), 0); f.assertPrivate(running.output().stdout + running.output().stderr);
});

test('evidence changed by an imported adult adapter after inspection is rejected before reopening the product DB or listening', { timeout: 15000 }, async t => {
  const f = await fixture(t), adapter = path.join(f.dir, 'adult.mjs'), marker = path.join(f.dir, 'adult-imported.txt');
  await fs.writeFile(adapter, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'imported'); fs.appendFileSync(${JSON.stringify(f.latestEvidencePath)}, '\\n'); export default {required:true,issuer:'synthetic-restore-cli',verify:async()=>{throw new Error('must not verify on startup');}};`);
  const before = await digest(f.databasePath), result = await f.run(['--resume-after-restore'], { SYNK_DATING_ADULT_ADAPTER: adapter });
  assert.equal(await fs.readFile(marker, 'utf8'), 'imported', 'The initial inspection must pass and reach adapter import');
  assert.equal(result.code, 1); assert.equal(result.stdout, ''); const error = JSON.parse(result.stderr).error; assert.equal(error.code, 'dating-runtime-restore-rejected'); assert.equal(error.reason, 'restore-files-changed');
  assert.equal(await digest(f.databasePath), before); assert.equal((await fs.readdir(f.dir)).some(name => /-(?:wal|shm|journal)$/.test(name)), false); assert.equal(await portOpen(f.port), false); assert.equal(f.identityRequests(), 0); f.assertPrivate(result.stderr);
});

test('configured restore evidence cannot be bypassed by default startup, and stale latest evidence cannot resume', { timeout: 15000 }, async t => {
  const f = await fixture(t), before = await f.snapshot(); let result = await f.run([]);
  assert.equal(result.code, 1); assert.equal(JSON.parse(result.stderr).error.code, 'dating-runtime-restore-command'); assert.equal(result.stdout, ''); assert.deepEqual(await f.snapshot(), before); assert.equal(await portOpen(f.port), false); f.assertPrivate(result.stderr);
  f.latest.observedAt = new Date(Date.now() - 6 * 60_000).toISOString(); await fs.writeFile(f.latestEvidencePath, JSON.stringify(f.latest)); const stale = await f.snapshot(); result = await f.run(['--resume-after-restore']);
  assert.equal(result.code, 1); const error = JSON.parse(result.stderr).error; assert.equal(error.code, 'dating-runtime-restore-rejected'); assert.equal(error.reason, 'restore-latest-evidence-stale'); assert.equal(result.stdout, ''); assert.deepEqual(await f.snapshot(), stale); assert.equal(await portOpen(f.port), false); assert.equal(f.identityRequests(), 0); f.assertPrivate(result.stderr);
});
