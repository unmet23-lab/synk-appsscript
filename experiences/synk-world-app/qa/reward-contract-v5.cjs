'use strict';
// Live HTTP + isolated PGlite audit of the current trust boundary. This does not
// implement or claim a server-verified runner/rhythm completion adapter.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const talk = path.resolve(root, '../SYNK-talk');
const { QUESTIONS, APRON_ID, SCARF_ID } = require(path.join(talk, 'lib/world-v1-catalog.js'));
const checks = [];
let child, base, fixtureDirectory;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, fn) { await fn(); checks.push({ name, passed: true }); }
async function request(route, { session, body, origin, method, headers = {} } = {}) {
  const response = await fetch(base + '/api/world/' + route, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', 'X-Synk-Product': 'world', 'X-Synk-Contract': '1',
      ...(session ? { Authorization: 'Bearer ' + session.token, 'X-Synk-Rehearsal-Tab': session.tab } : {}),
      ...(origin ? { Origin: origin } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
async function login(accountKey) {
  const tab = randomUUID();
  const response = await request('rehearsal/session', { body: { accountKey }, headers: { 'X-Synk-Rehearsal-Tab': tab } });
  assert.equal(response.status, 200);
  return { tab, token: response.body.accessToken };
}
async function boot(session) { const response = await request('bootstrap', { session }); assert.equal(response.status, 200); return response.body; }
async function unchanged(session, baseline) { const current = await boot(session); assert.deepEqual(current.inventory, baseline.inventory); assert.equal(current.revision, baseline.revision); }
const answers = () => QUESTIONS.map(q => ({ questionId: q.questionId, optionId: q.correctOptionId }));
async function main() {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-world-reward-v5-'));
  child = spawn(process.execPath, [path.join(root, 'experiences/synk-world-app/server.mjs')], {
    cwd: root, env: { ...process.env, SYNK_WORLD_PORT: String(port), SYNK_WORLD_DATA_DIR: path.join(fixtureDirectory, 'db') },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let log = '';
  child.stdout.on('data', value => { log += value; }); child.stderr.on('data', value => { log += value; });
  let healthy = false;
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) throw Error('Isolated server stopped: ' + log);
    try { const response = await fetch(base + '/health', { signal: AbortSignal.timeout(1000) }); healthy = response.ok; } catch {}
    if (healthy) break;
    await delay(100);
  }
  assert.ok(healthy, 'Isolated server must start');
  const a = await login('player-a'), b = await login('player-b');
  const initialA = await boot(a), initialB = await boot(b);
  await check('fresh isolated accounts have only the starter apron', async () => {
    assert.deepEqual(initialA.inventory.map(x => x.itemId), [APRON_ID]);
    assert.deepEqual(initialB.inventory.map(x => x.itemId), [APRON_ID]);
    assert.notEqual(initialA.accountId, initialB.accountId);
  });
  await check('unauthenticated game completion cannot issue an item', async () => {
    assert.equal((await request('play/complete', { body: { requestId: randomUUID(), runId: randomUUID(), answers: answers() } })).status, 401);
    await unchanged(a, initialA);
  });
  for (const gameId of ['runner', 'rhythm']) {
    await check(`${gameId} cannot be substituted for the server-issued first-steps game`, async () => {
      const response = await request('play/start', { session: a, body: { requestId: randomUUID(), gameId } });
      assert.equal(response.status, 400); await unchanged(a, initialA);
    });
    await check(`${gameId} client completion summary does not mint a shared costume`, async () => {
      const response = await request('play/complete', { session: a, body: { requestId: randomUUID(), game: gameId, total: 10, correct: 10, completed: true, automatic: false, roundId: randomUUID() } });
      assert.equal(response.status, 400); await unchanged(a, initialA);
    });
  }
  await check('external Origin is denied before any account mutation', async () => {
    const response = await request('play/start', { session: a, origin: 'https://untrusted.example', body: { requestId: randomUUID() } });
    assert.equal(response.status, 403); assert.equal(response.body.error.code, 'ORIGIN_FORBIDDEN'); await unchanged(a, initialA);
  });
  await check('there is no generic client reward grant endpoint', async () => {
    const response = await request('play/reward', { session: a, body: { requestId: randomUUID(), rewardItemId: SCARF_ID, completed: true } });
    assert.equal(response.status, 404); await unchanged(a, initialA);
  });
  const started = await request('play/start', { session: a, body: { requestId: randomUUID() } });
  assert.equal(started.status, 200);
  const before = await boot(a), runId = started.body.run.runId;
  await check('issued run carries exactly the server catalog and no answers', async () => {
    assert.equal(started.body.run.gameId, 'first-steps-v1');
    assert.equal(started.body.run.questions.length, 3);
    assert.ok(started.body.run.questions.every(q => !Object.hasOwn(q, 'correctOptionId')));
  });
  await check('a second account cannot complete the first account run', async () => {
    const response = await request('play/complete', { session: b, body: { requestId: randomUUID(), runId, answers: answers() } });
    assert.equal(response.status, 404); await unchanged(a, before); await unchanged(b, initialB);
  });
  await check('client-selected owner, reward, and score are rejected', async () => {
    for (const extra of [{ accountId: initialB.accountId }, { rewardItemId: SCARF_ID }, { score: 9999 }]) {
      const response = await request('play/complete', { session: a, body: { requestId: randomUUID(), runId, answers: answers(), ...extra } });
      assert.equal(response.status, 400);
    }
    await unchanged(a, before);
  });
  await check('missing answers and fabricated game questions are rejected', async () => {
    for (const selected of [answers().slice(0, 2), [{ questionId: 'runner-left', optionId: 'left' }, ...answers().slice(1)]]) {
      assert.equal((await request('play/complete', { session: a, body: { requestId: randomUUID(), runId, answers: selected } })).status, 400);
    }
    await unchanged(a, before);
  });
  const completeBody = { requestId: randomUUID(), runId, answers: answers() };
  await check('parallel identical completion requests issue one item in one revision', async () => {
    const results = await Promise.all([request('play/complete', { session: a, body: completeBody }), request('play/complete', { session: a, body: completeBody })]);
    assert.ok(results.every(r => r.status === 200));
    assert.equal(results.filter(r => r.body.completion.rewardGranted).length, 1);
    assert.ok(results.every(r => r.body.revision === before.revision + 1));
    assert.equal((await boot(a)).inventory.filter(x => x.itemId === SCARF_ID).length, 1);
  });
  const completed = await boot(a);
  await check('retry after an ignored acknowledgement cannot pay again', async () => {
    const replay = await request('play/complete', { session: a, body: completeBody });
    assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true); assert.equal(replay.body.completion.rewardGranted, false);
    await unchanged(a, completed);
  });
  await check('a different request id cannot pay an already completed run again', async () => {
    const replay = await request('play/complete', { session: a, body: { ...completeBody, requestId: randomUUID() } });
    assert.equal(replay.status, 200); assert.equal(replay.body.completion.rewardGranted, false); await unchanged(a, completed);
  });
  await check('a changed answer cannot overwrite a completed result', async () => {
    const changed = answers(); changed[0].optionId = 'thanks';
    assert.equal((await request('play/complete', { session: a, body: { ...completeBody, answers: changed } })).status, 409);
    await unchanged(a, completed);
  });
  await check('logged-out session cannot start or complete another run', async () => {
    assert.equal((await request('rehearsal/logout', { session: a, body: {} })).status, 200);
    assert.equal((await request('play/start', { session: a, body: { requestId: randomUUID() } })).status, 401);
    assert.equal((await request('play/complete', { session: a, body: completeBody })).status, 401);
    await unchanged(b, initialB);
  });
  const sourceFiles = ['experiences/synk-world-app/server.mjs', 'experiences/korean-runner/app.mjs', 'experiences/korean-runner/core.mjs', 'experiences/korean-rhythm/app.mjs'];
  const hashes = Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  for (const file of ['lib/world-v1-server.js', 'lib/world-v1-domain.js', 'lib/world-v1-store.js', 'supabase/migrations/20261009180000_synk_world_v1_c16.sql']) hashes['SYNK-talk/' + file] = createHash('sha256').update(fs.readFileSync(path.join(talk, file))).digest('hex');
  const result = { at: new Date().toISOString(), implementation: 'current-world-v1-first-steps-only', transport: 'real HTTP / isolated local PGlite', checks, passed: checks.length, failed: 0,
    sourceSHA256: hashes, fixtureDirectory, productionTouched: false,
    limitation: 'These checks establish current rejection, account isolation and idempotency. They do not implement runner/rhythm server completion, prove a human played, or measure learning effects. Existing game local coins remain separate.' };
  fs.writeFileSync(path.join(__dirname, 'reward-contract-v5.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, failed: 0, result: 'experiences/synk-world-app/qa/reward-contract-v5.json', fixtureDirectory }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited; }
});
