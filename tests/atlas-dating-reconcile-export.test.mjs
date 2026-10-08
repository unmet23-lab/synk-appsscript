import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { inspectDatingRestore } from '../experiences/atlas-lab/dating-restore.mjs';
const require = createRequire(import.meta.url);
const { createLifecycleFixture } = require('../../SYNK-talk/tests/lib/account-lifecycle-fixture.js');
const { createAccountLifecycleDispatcher } = require('../../SYNK-talk/lib/synk-account-lifecycle.js');
const { main: exportEvidence } = require('../../SYNK-talk/tools/synk-account-restore-export.js');
const execute = promisify(execFile), cli = fileURLToPath(new URL('../tools/atlas-dating-backup.mjs', import.meta.url));
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SYNK_DATING_')));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const stop = async server => { if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
const token = 'synthetic-export-chain-lifecycle-token-000000000';

for (const transition of ['disabled-active', 'deleted']) test(`real PostgreSQL export to backup/reconcile/resume and dispatcher redelivery: ${transition}`, { timeout: 30000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-reconcile-chain-'));
  let central, original, resumed, identity, identityRequests = 0;
  t.after(async () => {
    await stop(original); await stop(resumed); await stop(identity); if (central) await central.close();
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-reconcile-chain-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  central = await createLifecycleFixture({ availability: true }); const account = await central.account(), subject = account.synk_user_id;
  identity = http.createServer((_req, res) => { identityRequests++; res.writeHead(500).end(); }); await listen(identity);
  const identityOrigin = `http://127.0.0.1:${identity.address().port}`;
  const environment = { accountApiUrl: identityOrigin + '/', clientId: 'synthetic-export-chain', issuer: 'synk-account', audience: 'atlas-dating' };
  const accountConfig = { version: 1, supabaseUrl: identityOrigin, accountApiUrl: identityOrigin,
    supabasePublishableKey: 'sb_publishable_synthetic_chain', portalUrl: identityOrigin + '/id/',
    clients: { platform: { clientId: environment.clientId, redirectUri: 'http://127.0.0.1:1/atlas-lab/dating.html' } } };
  const lifecycle = { token, issuer: 'synk-account', audience: 'atlas-dating' };
  const databasePath = path.join(dir, 'original.sqlite'), evidencePath = path.join(dir, 'paired.json'), latestEvidencePath = path.join(dir, 'latest.json');
  const store = createDatingStore({ path: databasePath, mode: 'account' });
  store.transaction(tx => tx.ensureAccount(subject, { profile: { nickname: 'synthetic private name', values: {} }, preferences: { private: 'retained only when active' },
    consents: { profilePublic: true, receiveInvitations: true, storePreferences: true }, createdAt: new Date().toISOString() })); store.close();
  original = createDatingServer({ mode: 'account', databasePath, accountConfig, lifecycle }); await listen(original);
  const dispatcher = server => createAccountLifecycleDispatcher({ sql: central.sql,
    receiverUrl: `http://127.0.0.1:${server.address().port}/api/atlas-dating/lifecycle`, token });
  assert.deepEqual(await dispatcher(original).runOnce(), { claimed: 1, delivered: 1, pending: 0, blocked: 0, leaseLost: 0 });
  await stop(original);
  assert.equal(fs.existsSync(databasePath + '-wal'), false);
  const connect = () => ({
    begin: (_settings, callback) => central.sql.begin(async tx => { await tx`set transaction isolation level repeatable read read only`; return callback(tx); }),
    async end() {}
  });
  const json = (name, value) => { const filename = path.join(dir, name + '.json'); fs.writeFileSync(filename, JSON.stringify(value)); return filename; };
  const sourceConfig = json('snapshot-config', { version: 1, environment, outputPath: evidencePath,
    operatorConfirmedAllWritersStopped: true, productDatabasePath: databasePath });
  const exportEnv = { SYNK_ACCOUNT_RESTORE_DATABASE_URL: 'postgres://synthetic:local-only@127.0.0.1:1/synthetic' };
  await exportEvidence(['--snapshot', sourceConfig], exportEnv, { connect });
  const bundle = path.join(dir, 'backup');
  const createConfig = json('create-config', { version: 1, environment, operatorConfirmedAllWritersStopped: true, databasePath, evidencePath, destination: bundle });
  const execOptions = { env: cleanEnv(), windowsHide: true, timeout: 10000 };
  const created = JSON.parse((await execute(process.execPath, [cli, 'create', createConfig], execOptions)).stdout);
  const sourceHashes = [databasePath, evidencePath].map(digest), backupHashes = fs.readdirSync(bundle).sort().map(name => [name, digest(path.join(bundle, name))]);
  if (transition === 'disabled-active') {
    await central.sql`update engine.synk_accounts set status='disabled' where synk_user_id=${subject}::uuid`;
    await central.sql`update engine.synk_accounts set status='active' where synk_user_id=${subject}::uuid`;
  } else await central.purge(await central.request(subject));
  const latestConfig = json('latest-config', { version: 1, environment, outputPath: latestEvidencePath,
    operatorConfirmedAllWritersStopped: true, pairedEvidencePath: evidencePath });
  await exportEvidence(['--latest', latestConfig], exportEnv, { connect });
  const destination = path.join(dir, 'reconciled');
  const reconcileConfig = json('reconcile-config', { version: 1, environment, operatorConfirmedAllWritersStopped: true,
    bundlePath: bundle, expectedManifestSha256: created.manifestSha256, latestEvidencePath, destination });
  const completed = await execute(process.execPath, [cli, 'reconcile', reconcileConfig], execOptions);
  assert.equal(JSON.parse(completed.stdout).serviceStarted, false);
  assert.ok(!completed.stdout.includes(subject)); assert.ok(!completed.stdout.includes(dir));
  const restoredDatabase = path.join(destination, 'account.sqlite'), restoredEvidence = path.join(destination, 'paired.json');
  const checked = inspectDatingRestore({ databasePath: restoredDatabase, evidencePath: restoredEvidence, latestEvidencePath, expectedEnvironment: environment });
  const read = () => { const db = new DatabaseSync(resumed ? restoredDatabase : pathToFileURL(restoredDatabase).href + '?immutable=1', { readOnly: true }); try {
    return { account: db.prepare('select * from dating_accounts where id=?').get(subject), receipts: db.prepare('select count(*) n from dating_lifecycle_receipts').get().n };
  } finally { db.close(); } };
  const before = read();
  if (transition === 'disabled-active') {
    assert.equal(before.account.status, 'active'); assert.equal(JSON.parse(before.account.document).consents.profilePublic, false);
    assert.equal(JSON.parse(before.account.document).consents.receiveInvitations, false);
  } else { assert.equal(before.account.status, 'deleted'); assert.equal(before.account.document, null); }
  // The actual runtime consumes the one-use admission before opening/listening.
  resumed = createDatingServer({ mode: 'account', databasePath: restoredDatabase, accountConfig, lifecycle, restoreAdmission: checked.admission }); await listen(resumed);
  const response = await fetch(`http://127.0.0.1:${resumed.address().port}/api/atlas-dating/config`, { headers: { Connection: 'close' } }); assert.equal(response.status, 200);
  const redelivered = await dispatcher(resumed).runOnce();
  assert.deepEqual(redelivered, { claimed: 2, delivered: 2, pending: 0, blocked: 0, leaseLost: 0 });
  const availability = await central.sql`select state,error_code from engine.synk_account_availability where subject_id=${subject}::uuid`;
  assert.ok(availability.every(row => row.state === 'delivered' && row.error_code === null));
  if (transition === 'deleted') { const terminal = await central.queue(subject); assert.equal(terminal.state, 'delivered'); assert.equal(terminal.error_code, null); }
  assert.deepEqual(read(), before); assert.equal(identityRequests, 0);
  assert.deepEqual([databasePath, evidencePath].map(digest), sourceHashes);
  assert.deepEqual(fs.readdirSync(bundle).sort().map(name => [name, digest(path.join(bundle, name))]), backupHashes);
});
