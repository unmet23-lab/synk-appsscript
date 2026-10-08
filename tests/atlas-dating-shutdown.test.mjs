import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { createDatingServer } from '../experiences/atlas-lab/dating-server.mjs';
import { createDatingShutdown, installDatingShutdownSignals } from '../experiences/atlas-lab/dating-shutdown.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-dating-shutdown-'));
  const filename = path.join(dir, 'account.sqlite');
  const server = createDatingServer({ mode: 'account', databasePath: filename, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-dating-shutdown-'));
    await fs.rm(dir, { recursive: true, force: true });
  });
  return { server, filename, port: server.address().port, origin: `http://127.0.0.1:${server.address().port}` };
}
function readRows(filename, table) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try { return db.prepare(`SELECT * FROM ${table}`).all(); } finally { db.close(); }
}

test('shutdown lets an accepted save finish and rejects a later pipelined request before dispatch', { timeout: 10000 }, async t => {
  const entered = deferred(), release = deferred(); let calls = 0, slow = false;
  const owner = randomUUID();
  t.after(() => release.resolve());
  const f = await fixture(t, { shutdownGraceMs: 3000, verify: async () => { calls++; if (slow) { entered.resolve(); await release.promise; } return { accountId: owner }; } });
  const baseline = await fetch(f.origin + '/api/atlas-dating/state', { headers: { Origin: f.origin, Authorization: 'Bearer synthetic-shutdown' } }).then(res => res.json());
  const requestId = randomUUID(), body = JSON.stringify({ requestId, expectedRevision: baseline.view.revision,
    action: { kind: 'profile', profile: { nickname: '종료 전 합성 저장', region: '', intro: '', values: {}, required: [] } } });
  slow = true;
  const socket = net.createConnection({ host: '127.0.0.1', port: f.port });
  t.after(() => socket.destroy());
  let output = '';
  socket.on('data', data => { output += data; });
  const closed = new Promise((resolve, reject) => { socket.on('close', resolve); socket.on('error', reject); });
  await new Promise(resolve => socket.once('connect', resolve));
  socket.write(`POST /api/atlas-dating/action HTTP/1.1\r\nHost: 127.0.0.1:${f.port}\r\nOrigin: ${f.origin}\r\nAuthorization: Bearer synthetic-shutdown\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  await entered.promise;
  const stopping = f.server.shutdownDating();
  assert.equal(f.server.shutdownDating(), stopping, 'Repeated stop shares one drain operation');
  socket.write(`GET /api/atlas-dating/config HTTP/1.1\r\nHost: 127.0.0.1:${f.port}\r\n\r\n`);
  // Yield until the already-connected peer has submitted its second request.
  await new Promise(resolve => setTimeout(resolve, 30));
  release.resolve();
  assert.deepEqual(await stopping, { stopped: true, forced: false }); await closed;
  assert.match(output, /HTTP\/1\.1 200/); assert.match(output, /HTTP\/1\.1 503/);
  assert.match(output, /service-restarting/); assert.match(output, /Retry-After: 1/i);
  assert.equal(calls, 2, 'The rejected request did not reach authentication');
  const account = readRows(f.filename, 'dating_accounts').find(row => row.id === owner);
  assert.equal(JSON.parse(account.document).profile.nickname, '종료 전 합성 저장');
  assert.equal(readRows(f.filename, 'dating_receipts').filter(row => row.id === requestId).length, 1);
});

test('a bounded forced stop prevents a late authentication from writing after SQLite closes', { timeout: 10000 }, async t => {
  const entered = deferred(), release = deferred(), owner = randomUUID();
  t.after(() => release.resolve());
  const f = await fixture(t, { shutdownGraceMs: 30, verify: async () => { entered.resolve(); await release.promise; return { accountId: owner }; } });
  const pending = fetch(f.origin + '/api/atlas-dating/state', { headers: { Origin: f.origin, Authorization: 'Bearer synthetic-late' } }).catch(error => error);
  await entered.promise;
  assert.deepEqual(await f.server.shutdownDating(), { stopped: true, forced: true });
  assert.ok(await pending instanceof Error);
  release.resolve(); await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(readRows(f.filename, 'dating_accounts'), []);
});

test('draining rejects public config and mutation without reading the body or invoking a handler', async () => {
  const closeReady = deferred(), events = [];
  const control = createDatingShutdown({ graceMs: 1000 });
  control.attach({ close(done) { events.push('close'); closeReady.promise.then(() => done()); }, closeAllConnections() { events.push('forced'); } });
  assert.equal(control.allowRequest({}, {}), true);
  const pending = control.stop();
  for (const method of ['GET', 'POST']) {
    let status, headers, value;
    const allowed = control.allowRequest({ method }, { writeHead(s, h) { status = s; headers = h; }, end(v) { value = JSON.parse(v); } });
    assert.equal(allowed, false); assert.equal(status, 503); assert.equal(headers['Retry-After'], '1');
    assert.deepEqual(value, { ok: false, error: { code: 'service-restarting' } });
  }
  closeReady.resolve(); assert.equal((await pending).forced, false); assert.deepEqual(events, ['close']);
});

test('CLI signal wiring drains once and removes handlers; forced completion exits nonzero', async () => {
  for (const forced of [false, true]) {
    const target = new EventEmitter(), server = new EventEmitter(), completed = deferred(), done = deferred(); let starts = 0;
    server.shutdownDating = () => { starts++; return completed.promise; };
    const dispose = installDatingShutdownSignals(server, { target, finish: code => done.resolve(code) });
    target.emit('SIGINT'); target.emit('SIGTERM'); target.emit('SIGBREAK');
    await Promise.resolve(); assert.equal(starts, 1);
    completed.resolve({ stopped: true, forced }); assert.equal(await done.promise, forced ? 1 : 0);
    for (const name of ['SIGINT', 'SIGTERM', 'SIGBREAK']) assert.equal(target.listenerCount(name), 0);
    dispose();
  }
});

test('invalid shutdown bounds fail before a listener or database is created', () => {
  for (const graceMs of [0, -1, 30001, 1.5, '1000', null]) assert.throws(() => createDatingShutdown({ graceMs }), TypeError);
  const control = createDatingShutdown(); assert.throws(() => control.stop(), TypeError);
});
