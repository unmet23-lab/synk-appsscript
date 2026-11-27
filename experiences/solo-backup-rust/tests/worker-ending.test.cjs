'use strict';
// The windowless host's end as the worker sees it (SOLIO_ONE_CLIENT.md 2.1 「끝」, Fable 설계 검토 호스트끝 F2): after `$ending`
// the window worker takes up no new setup request, so the host SYNK 솔리오 starts next finds it waiting. Before `$ending` the
// same request is taken at once. The live check needs the pinned restic in SOLO_BACKUP_RESTIC; every folder is a new
// temporary one, and the host the worker asks is a stand-in that answers the few native calls the window needs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const solio = require('../engine/src/solio.cjs');

const restic = process.env.SOLO_BACKUP_RESTIC;
const pkg = path.resolve(__dirname, '..');
const LIMIT_MS = 90000;
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(check, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (check()) return true; await sleep(100); } return check(); }

test('an ending worker leaves a setup request for the next host; before the end it takes one at once', { skip: !restic && 'SOLO_BACKUP_RESTIC is not set' }, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-ending-'));
  const dir = (name) => { const p = path.join(base, name); fs.mkdirSync(p, { recursive: true }); return p; };
  const state = dir('state');
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: dir('home'), APPDATA: dir('appdata'), LOCALAPPDATA: dir('local'),
    TEMP: process.env.TEMP, TMP: process.env.TMP, USERDOMAIN: process.env.USERDOMAIN, USERNAME: process.env.USERNAME,
    SWB_ROOT: state, SWB_CACHE_ROOT: dir('cache'), SWB_RESTIC: restic, SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1' };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const frames = [], replies = new Map();
  let buf = '', exitCode = null, killed = false;
  const guard = setTimeout(() => { killed = true; child.kill(); }, LIMIT_MS);
  const send = (o) => child.stdin.write(JSON.stringify({ v: 1, ...o }) + '\n');
  child.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); frames.push(m);
      if (m.call) {
        const a = m.args || [], known = { 'startup.read': false, 'engine.lock': true, 'engine.unlock': true, 'run.progress': null };
        if (m.method === 'secret.encrypt') send({ callResult: m.call, ok: true, value: Buffer.from(String(a[0])).toString('base64') });
        else if (m.method === 'secret.decrypt') send({ callResult: m.call, ok: true, value: Buffer.from(String(a[0]), 'base64').toString() });
        else send(m.method in known ? { callResult: m.call, ok: true, value: known[m.method] } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && replies.has(m.id)) { replies.get(m.id)(m); replies.delete(m.id); }
    }
  });
  const closed = new Promise((ok) => child.once('close', (code) => { exitCode = code; ok(); }));
  const call = (id, method) => Promise.race([new Promise((ok) => { replies.set(id, ok); send({ id, method, args: [] }); }), closed.then(() => ({ ok: false, closed: true }))]);
  const files = new solio.SolioFiles({ root: state });
  const request = (tail) => { const n = `${Date.now()}-${tail}.json`; fs.writeFileSync(path.join(files.requests, n), JSON.stringify({ v: 1, kind: 'setup', mode: 'protect' })); return path.join(files.requests, n); };
  try {
    assert.equal((await call(1, '$boot')).ok, true);
    await files.ready();
    // Before the end: the window's 2-second look takes a setup request.
    const first = request('before00');
    assert.ok(await until(() => !fs.existsSync(first), 15000), 'the setup request was taken while the window worker runs');
    // The end begins: the request that comes now is left where it is for the next host.
    const ending = await call(2, '$ending');
    assert.equal(ending.ok, true, `ending ${JSON.stringify(ending).slice(0, 200)}`);
    const second = request('after000');
    await sleep(6000);
    assert.ok(fs.existsSync(second), 'an ending worker leaves the setup request alone');
    assert.equal((await call(3, '$ending')).ok, true, 'a second $ending changes nothing');
    const down = await call(4, '$shutdown');
    assert.equal(down.ok, true);
    await closed;
    assert.equal(killed, false, 'the worker ended by itself');
    assert.equal(exitCode, 0);
    assert.deepEqual(frames.filter((f) => f.fatal), []);
  } finally {
    if (exitCode === null) { if (!killed) child.kill(); await closed; }
    clearTimeout(guard);
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
