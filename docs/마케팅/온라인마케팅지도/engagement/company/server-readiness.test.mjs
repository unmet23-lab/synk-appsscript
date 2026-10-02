import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyApp } from './server.mjs';

const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });
const close = server => new Promise(resolve => server.close(resolve));

test('health remains unready until the legacy listener starts and failed startup closes resources once', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'synk-company-readiness-'));
  const reservation = createServer();
  const legacyPort = await listen(reservation);
  await close(reservation);
  const app = createCompanyApp({ dataDir: dir, port: 0, allowTestHost: true, legacyMessengerPort: legacyPort, schedule: false });
  let releaseLegacy, reachedLegacy;
  const waiting = new Promise(resolve => { reachedLegacy = resolve; });
  const originalListen = Server.prototype.listen;
  const mockedListen = t.mock.method(Server.prototype, 'listen', function (...args) {
    if (this !== app.server && args[0] === legacyPort) {
      releaseLegacy = () => Reflect.apply(originalListen, this, args);
      reachedLegacy();
      return this;
    }
    return Reflect.apply(originalListen, this, args);
  });
  t.after(async () => { mockedListen.mock.restore(); releaseLegacy?.(); await app.stop(); await rm(dir, { recursive: true, force: true }); });
  const starting = app.start();
  await waiting;
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const pending = await (await fetch(base + '/api/health')).json();
  assert.equal(pending.app, 'synk-company');
  assert.equal(pending.workspaceIntegration, true);
  assert.equal(pending.ready, false);
  releaseLegacy(); releaseLegacy = null;
  await starting;
  mockedListen.mock.restore();
  assert.equal((await (await fetch(base + '/api/health')).json()).ready, true);
  assert.equal((await (await fetch(`http://127.0.0.1:${legacyPort}/api/health`)).json()).service, 'synk-workspace-redirect');
  await app.stop();
  await app.stop();
  assert.equal(app.server.listening, false);

  const blocker = createServer();
  const blockedPort = await listen(blocker);
  const failed = createCompanyApp({ dataDir: join(dir, 'failed'), port: 0, allowTestHost: true, legacyMessengerPort: blockedPort, schedule: false });
  t.after(async () => { await failed.stop(); await close(blocker); });
  await assert.rejects(failed.start(), { code: 'EADDRINUSE' });
  assert.equal(failed.server.listening, false);
  assert.equal(failed.store.db.isOpen, false);
  assert.equal(failed.messenger.db.isOpen, false);
  await failed.stop();
  await failed.stop();
});
