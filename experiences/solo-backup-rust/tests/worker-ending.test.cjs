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

// A worker with a stand-in host. `holdLock`: the stand-in keeps its answers to `engine.lock` until `release()`.
function boot({ holdLock = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-ending-'));
  const dir = (name) => { const p = path.join(base, name); fs.mkdirSync(p, { recursive: true }); return p; };
  const state = dir('state');
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: dir('home'), APPDATA: dir('appdata'), LOCALAPPDATA: dir('local'),
    TEMP: process.env.TEMP, TMP: process.env.TMP, USERDOMAIN: process.env.USERDOMAIN, USERNAME: process.env.USERNAME,
    SWB_ROOT: state, SWB_CACHE_ROOT: dir('cache'), SWB_RESTIC: restic, SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '1' };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const w = { frames: [], replies: new Map(), held: [], hold: holdLock, exitCode: null, killed: false };
  let buf = '';
  w.guard = setTimeout(() => { w.killed = true; child.kill(); }, LIMIT_MS);
  const send = (o) => child.stdin.write(JSON.stringify({ v: 1, ...o }) + '\n');
  child.stdout.on('data', (d) => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); w.frames.push(m);
      if (m.call) {
        const a = m.args || [], known = { 'startup.read': false, 'engine.lock': true, 'engine.unlock': true, 'run.progress': null };
        if (m.method === 'engine.lock' && w.hold) w.held.push(m.call);
        else if (m.method === 'secret.encrypt') send({ callResult: m.call, ok: true, value: Buffer.from(String(a[0])).toString('base64') });
        else if (m.method === 'secret.decrypt') send({ callResult: m.call, ok: true, value: Buffer.from(String(a[0]), 'base64').toString() });
        else send(m.method in known ? { callResult: m.call, ok: true, value: known[m.method] } : { callResult: m.call, ok: false, code: 'TEST_HOST' });
      } else if (m.id && w.replies.has(m.id)) { w.replies.get(m.id)(m); w.replies.delete(m.id); }
    }
  });
  w.release = () => { w.hold = false; for (const id of w.held.splice(0)) send({ callResult: id, ok: true, value: true }); };
  w.closed = new Promise((ok) => child.once('close', (code) => { w.exitCode = code; ok(); }));
  w.call = (id, method) => Promise.race([new Promise((ok) => { w.replies.set(id, ok); send({ id, method, args: [] }); }), w.closed.then(() => ({ ok: false, closed: true }))]);
  w.files = new solio.SolioFiles({ root: state });
  w.request = (tail) => { const n = `${Date.now()}-${tail}.json`; fs.writeFileSync(path.join(w.files.requests, n), JSON.stringify({ v: 1, kind: 'setup', mode: 'protect' })); return path.join(w.files.requests, n); };
  w.end = async () => {
    if (w.exitCode === null) { if (!w.killed) child.kill(); await w.closed; }
    clearTimeout(w.guard);
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };
  return w;
}

test('an ending worker leaves a setup request for the next host; before the end it takes one at once', { skip: !restic && 'SOLO_BACKUP_RESTIC is not set' }, async () => {
  const w = boot(), { call, files, request, frames } = w;
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
    await w.closed;
    assert.equal(w.killed, false, 'the worker ended by itself');
    assert.equal(w.exitCode, 0);
    assert.deepEqual(frames.filter((f) => f.fatal), []);
  } finally { await w.end(); }
});

test('$ending answers only after the setup pass going now ends, and that pass leaves the request (Fable 설계 검토 끝의setup요청 D2)', { skip: !restic && 'SOLO_BACKUP_RESTIC is not set' }, async () => {
  const w = boot();
  try {
    assert.equal((await w.call(1, '$boot')).ok, true);
    await w.files.ready();
    // The recovery and account looks at the start take the engine lock once and then wait a minute: let them pass first,
    // so the next lock asked for is the setup pass's.
    await sleep(3000);
    w.hold = true;
    // The 2-second look finds the request and asks the host for the engine lock; the stand-in holds that answer.
    const req = w.request('inflight');
    assert.ok(await until(() => w.held.length > 0, 15000), 'the setup pass asked for the engine lock');
    let answered = null;
    const ending = w.call(2, '$ending').then((m) => { answered = Date.now(); return m; });
    await sleep(2000);
    assert.equal(answered, null, '$ending waits for the pass going now');
    const released = Date.now();
    w.release();
    const reply = await ending;
    assert.equal(reply.ok, true, `ending ${JSON.stringify(reply).slice(0, 200)}`);
    assert.ok(answered >= released, 'answered after the pass ended');
    assert.ok(fs.existsSync(req), 'the pass that saw the end leaves the request for the next host');
    assert.deepEqual(fs.readdirSync(w.files.claimed), [], 'nothing left claimed as the answer comes');
    assert.equal((await w.call(3, '$shutdown')).ok, true);
    await w.closed;
    assert.equal(w.exitCode, 0);
  } finally { await w.end(); }
});
