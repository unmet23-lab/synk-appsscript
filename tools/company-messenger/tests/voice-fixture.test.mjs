import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile, access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createVoiceFixture, runVoicePreflight, cleanupVoiceFixture, parseVoiceFixtureArgs } from '../qa/voice-fixture.mjs';
import { voiceScenarios } from '../qa/voice-scenarios.mjs';

test('disposable company fixture verifies current HTTP control flow without real credentials/media or passing manual cases', async t => {
  const f = await createVoiceFixture({ env: { SYNK_WORKSPACE_VOICE_ENABLED: '1', SYNK_VOICE_LIVEKIT_URL: 'wss://production-unusable.livekit.cloud' } });
  t.after(() => f.stop());
  const secret = await readFile(join(f.directory, 'accounts.private.json'), 'utf8'), accounts = JSON.parse(secret);
  const report = await runVoicePreflight(f);
  assert.equal(report.checks.length, 6); assert.ok(report.checks.every(row => row.status === 'pass'));
  assert.equal(report.actualMediaVerified, false); assert.equal(report.browserOrSdkTested, false); assert.equal(report.externalVoiceCalls, 0);
  assert.equal(f.manifest.accounts.length, 6); assert.equal(Object.keys(f.rooms).length, 5);
  assert.equal(f.provider.serverUrl, 'wss://voice-fixture.invalid'); assert.equal(f.manifest.limits.maxConcurrentParticipants, 4);
  const results = JSON.parse(await readFile(join(f.directory, 'results.json'), 'utf8'));
  assert.equal(results.cases.length, voiceScenarios.length); assert.ok(results.cases.every(row => row.status === 'not_run'));
  for (const filename of ['run.json', 'scenarios.json', 'results.json', 'preflight.json']) {
    const text = await readFile(join(f.directory, filename), 'utf8');
    for (const person of Object.values(accounts)) assert.equal(text.includes(person.password), false);
    assert.equal(text.includes('synthetic-only-'), false); assert.equal(text.includes('proofContext'), false);
  }
  const cleanup = await f.stop(); assert.equal(cleanup.cleanupPending, false);
  await assert.rejects(access(f.directory), { code: 'ENOENT' });
});

test('real-provider preparation uses separate test credentials and starts no external requests', async t => {
  let external = 0;
  await assert.rejects(createVoiceFixture({ mode: 'livekit', env: { SYNK_VOICE_LIVEKIT_URL: 'wss://production.livekit.cloud', SYNK_VOICE_LIVEKIT_API_KEY: 'production-key', SYNK_VOICE_LIVEKIT_API_SECRET: 'unused'.repeat(10) } }));
  const f = await createVoiceFixture({ mode: 'livekit', origin: 'https://voice-qa.example.test', env: {
    SYNK_VOICE_TEST_LIVEKIT_URL: 'wss://qa-only.livekit.cloud', SYNK_VOICE_TEST_LIVEKIT_API_KEY: 'QAfixture123', SYNK_VOICE_TEST_LIVEKIT_API_SECRET: 'synthetic-test-credential-not-a-real-key-12345',
  }, livekitFetch: async () => { external++; throw new Error('No external traffic allowed in this test'); } });
  t.after(() => f.stop());
  assert.equal(f.manifest.simulation, false); assert.equal(f.manifest.mediaVerified, false); assert.equal(external, 0);
  await assert.rejects(runVoicePreflight(f), /synthetic only/); assert.throws(() => f.advance(1000), /synthetic time/);
  assert.equal((await f.stop()).cleanupPending, false); assert.equal(external, 0);
});

test('failed remote revocation preserves the fixture database until explicit cleanup, while running/unrelated directories are refused', async t => {
  const f = await createVoiceFixture(); t.after(() => f.stop());
  await assert.rejects(cleanupVoiceFixture(f.directory), /Stop the running/);
  await assert.rejects(cleanupVoiceFixture(resolve('.')), /non-fixture/);
  const post = (path, body) => f.clients.host('/messenger' + path, { method: 'POST', body });
  const joined = await post(`/api/channels/${f.rooms.main.id}/voice/join`, { requestId: randomUUID(), client: { protocol: 'synk-livekit-e2ee-v1', supported: true } });
  const key = await post(`/api/voice/${joined.admission.id}/encryption/key`, {});
  const ready = await post(`/api/voice/${joined.admission.id}/encryption/ack`, { epoch: key.epoch, sdkEnabled: true, workerReset: true, proof: createHmac('sha256', key.key).update(key.proofContext).digest('base64url') });
  f.provider.observe(ready.admission); f.provider.failRemove = true;
  const stopped = await f.stop(); assert.equal(stopped.cleanupPending, true); assert.equal(stopped.retainedDirectory, f.directory);
  await access(join(f.directory, 'messenger', 'messenger.sqlite'));
  assert.equal((await cleanupVoiceFixture(f.directory)).cleanupPending, false);
  await assert.rejects(access(f.directory), { code: 'ENOENT' });
});

test('report export omits login credentials and refuses overwriting an existing output directory', async t => {
  const f = await createVoiceFixture(); t.after(() => f.stop());
  const parent = await mkdtemp(join(tmpdir(), 'synk-voice-export-'));
  t.after(async () => { assert.ok(resolve(parent).startsWith(resolve(tmpdir()) + sep) && parent.split(sep).at(-1).startsWith('synk-voice-export-')); await rm(parent, { recursive: true, force: true }); });
  const output = join(parent, 'evidence'); await f.exportReports(output);
  await access(join(output, 'results.json')); await assert.rejects(access(join(output, 'accounts.private.json')), { code: 'ENOENT' });
  await assert.rejects(f.exportReports(output), { code: 'EEXIST' });
  await f.stop(); await access(join(output, 'results.json'));
});

test('CLI configuration rejects unsafe/ambiguous preparation modes before opening a fixture', async () => {
  assert.throws(() => parseVoiceFixtureArgs(['--mode=livekit', '--check']), /synthetic/);
  assert.throws(() => parseVoiceFixtureArgs(['--cleanup=x', '--mode=livekit']), /alone/);
  assert.throws(() => parseVoiceFixtureArgs(['--port=no']), /port/);
  assert.throws(() => parseVoiceFixtureArgs(['--host=0.0.0.0']), /Unknown/);
  await assert.rejects(createVoiceFixture({ port: 4191 }), /company port/);
  await assert.rejects(createVoiceFixture({ origin: 'https://workspace.synk.im' }), /test HTTPS/);
  await assert.rejects(createVoiceFixture({ profile: 'unbounded' }), /mode\/profile/);
});
