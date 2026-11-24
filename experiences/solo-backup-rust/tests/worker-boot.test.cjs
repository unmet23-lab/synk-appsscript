'use strict';
// The window's worker as an installed app starts it: outside test mode (SWB_TEST=0) on a fresh state folder, before
// protection starts, so the first protection range is searched as the window opens (STAGE1_DESIGN.md 4.17). The test
// mode the other worker tests use skips that search, so 0.7.4's first build started no worker at all on a new PC
// (CI 45481198341 · 45491962318: BOOT — the search reached declarations further down createApplication).
// The live check needs the pinned restic in SOLO_BACKUP_RESTIC (outside test mode the engine checks its hash); every
// folder it uses is a new temporary one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const restic = process.env.SOLO_BACKUP_RESTIC;
const pkg = path.resolve(__dirname, '..');
/** The whole live check, start to exit: a worker that answers nothing is ended, and the test fails instead of hanging. */
const LIMIT_MS = 90000;

test('the first range search starts only after the whole window worker is set up', () => {
  const src = fs.readFileSync(path.join(pkg, 'worker', 'handlers.cjs'), 'utf8');
  const start = src.indexOf('async function createApplication'), end = src.indexOf('\n  return {', start);
  const body = src.slice(start, end);
  // The search the window starts on its own, as code — a commented-out line does not count (GPT GA1), and a second one
  // anywhere on a code line does (GPT 다시 GA3). The 「다시 찾기」 handler starts one too, when pressed.
  const own = 'if (!testMode && !protectedHere() && range.stale()) void range.find();';
  const lines = body.split('\n');
  const code = lines.map((l, i) => ({ l, at: lines.slice(0, i).reduce((n, x) => n + x.length + 1, 0) })).filter(({ l }) => !/^\s*\/\//.test(l));
  const found = code.flatMap(({ l, at }) => { const out = []; for (let i = l.indexOf(own); i >= 0; i = l.indexOf(own, i + 1)) out.push(at + i); return out; });
  assert.equal(found.length, 1, 'the window searches the range on its own, from one place');
  const search = found[0];
  // Every name declared in createApplication itself (two-space indent) comes before it: push() reaches them at once.
  const late = [...body.matchAll(/\n  (?:let|const) ([A-Za-z_$][\w$]*)/g)].filter((m) => m.index > search).map((m) => m[1]);
  assert.deepEqual(late, [], `declared after the search: ${late.join(', ')}`);
});

test('the window worker starts outside test mode before protection and searches the range (0.7.4 CI BOOT)', { skip: !restic && 'SOLO_BACKUP_RESTIC is not set' }, async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-boot-'));
  const dir = (name) => { const p = path.join(base, name); fs.mkdirSync(p, { recursive: true }); return p; };
  const env = { SYSTEMROOT: process.env.SYSTEMROOT, WINDIR: process.env.WINDIR, USERPROFILE: dir('home'), APPDATA: dir('appdata'), LOCALAPPDATA: dir('local'),
    TEMP: process.env.TEMP, TMP: process.env.TMP, USERDOMAIN: process.env.USERDOMAIN, USERNAME: process.env.USERNAME,
    SWB_ROOT: dir('state'), SWB_CACHE_ROOT: dir('cache'), SWB_RESTIC: restic, SWB_ENGINE_ROOT: path.join(pkg, 'engine'), SWB_TEST: '0' };
  const child = spawn(process.execPath, [path.join(pkg, 'worker', 'dispatcher.cjs')], { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const frames = [], replies = new Map();
  let buf = '', exitCode = null, killed = false;
  // Started before anything is waited for, so a silent worker cannot keep the test waiting (GPT GA2)
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
  try {
    const boot = await call(1, '$boot');
    assert.equal(boot.ok, true, `boot ${JSON.stringify(boot).slice(0, 200)} · ${JSON.stringify(frames.filter((f) => f.fatal))}`);
    assert.equal(boot.value?.configured, false);
    // The range is there and its search started as the window opened (GPT GA1 · 다시 GA1)
    assert.equal(typeof boot.value?.range?.status, 'string', `range ${JSON.stringify(boot.value?.range)?.slice(0, 200)}`);
    assert.notEqual(boot.value.range.status, 'idle', `range ${JSON.stringify(boot.value.range).slice(0, 200)}`);
    // Closed while that search may still run: the shutdown is answered and the worker ends by itself, with no fatal frame
    // at any point (GPT GA3)
    const down = await call(2, '$shutdown');
    assert.equal(down.ok, true, `shutdown ${JSON.stringify(down).slice(0, 200)}`);
    await closed;
    assert.equal(killed, false, 'the worker ended by itself');
    assert.equal(exitCode, 0);
    assert.deepEqual(frames.filter((f) => f.fatal), []);
  } finally {
    // Whatever failed, the worker is gone before its folders are removed (GPT 다시 GA2)
    if (exitCode === null) { if (!killed) child.kill(); await closed; }
    clearTimeout(guard);
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
