'use strict';
// SYNK 솔리오's windowless host, `WorkBackup.exe --solio` (SOLIO_ONE_CLIENT.md 2.1 · 2.6), end to end: hello first, a
// call answered in the window's envelope, a line not in the table dropped, a second host told `busy`, and the end at
// `bye` or at the input's end. Needs a debug build in SWB_HOST_EXE (its `--test-mode` skips the parent check and keeps a
// test state folder; it reads resources from SWB_RESOURCES) and the pinned restic in SOLO_BACKUP_RESTIC, from which the
// resources are staged here. Test state lives in a temp folder only.
//   SWB_HOST_EXE=<debug WorkBackup.exe> SOLO_BACKUP_RESTIC=<restic 0.19.1> node --test tests/host-exe.e2e.cjs
// Not named *.test.cjs: the CI's wide tests would skip it for want of the executable, and a skip not registered in
// tools/conditional-qa/cases.json turns them red. Registering it (and building WorkBackup.exe, which needs dist/, on that
// route) comes first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { stage, UI_FILES } = require('../scripts/stage-resources.cjs');

const exe = process.env.SWB_HOST_EXE, restic = process.env.SOLO_BACKUP_RESTIC;
// The resource check hashes node and restic in a debug build at every start: slow on a busy PC (run-exe.test.cjs).
const WAIT = process.env.SOLO_BACKUP_SLOW_TEST === '1' ? 900000 : 240000;
const started = [];

function host(args, env) {
  const child = spawn(exe, args, { env, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  started.push(child);
  child.stdin.on('error', () => {});
  let buffer = '';
  const lines = [], waiting = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => {
    buffer += data;
    for (let at = buffer.indexOf('\n'); at >= 0; at = buffer.indexOf('\n')) {
      const line = JSON.parse(buffer.slice(0, at)); buffer = buffer.slice(at + 1);
      lines.push(line);
      for (const w of [...waiting]) if (w.match(line)) { waiting.splice(waiting.indexOf(w), 1); w.ok(line); }
    }
  });
  const exited = new Promise((ok) => child.once('exit', (code) => ok(code)));
  // Every line the host wrote, read to the end of its output (not only to its exit).
  const drained = new Promise((ok) => child.stdout.once('end', ok));
  const next = (match) => {
    const seen = lines.find(match);
    if (seen) return Promise.resolve(seen);
    return new Promise((ok, no) => {
      waiting.push({ match, ok });
      setTimeout(() => no(Error(`no such line yet: ${JSON.stringify(lines).slice(-400)}`)), WAIT).unref();
    });
  };
  const send = (value) => child.stdin.write(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`);
  return { child, lines, next, send, exited, drained, rest: () => buffer };
}
const within = (promise, ms, what) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(Error(`${what}: not within ${ms} ms`)), ms).unref())]);

test.after(() => { for (const child of started) if (child.exitCode === null) child.kill(); });

test('WorkBackup.exe --solio: hello first, calls as the window answers them, busy for a second host, the end at bye or the input end', { skip: !exe || !restic, timeout: 4 * WAIT }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'swb-host-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = path.join(root, 'state'), inventory = path.join(root, 'inventory'), resources = path.join(root, 'resources');
  for (const d of [state, inventory]) fs.mkdirSync(d, { recursive: true });
  // The host does not start the inventory tools; stand-ins keep the manifest whole.
  for (const name of ['WorkBackupInventory.exe', 'WorkBackupPlanner.exe']) fs.writeFileSync(path.join(inventory, name), 'stand-in');
  // Stand-ins for stage-ui's dist/: the host serves no screen, but its resource check reads them by the manifest.
  const ui = path.join(root, 'ui');
  for (const name of UI_FILES) { const file = path.join(ui, ...name.split('/')); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `stand-in ${name}`); }
  const staged = await stage({ node: process.execPath, restic, output: resources, client: '--none', inventoryBin: inventory, ui });
  assert.ok(staged.files > 0);
  const env = { ...process.env, SOLO_BACKUP_TEST_STATE: state, SWB_RESOURCES: resources };

  // Its parent is this test's Node, not SYNK 솔리오's PC app: without the test switch nothing is written, exit 77.
  const refused = host(['--solio'], env);
  assert.equal(await within(refused.exited, 60000, 'the refused host'), 77);
  assert.deepEqual([refused.lines, refused.rest()], [[], ''], 'not one byte before the parent check');

  const first = host(['--solio', '--test-mode'], env);
  const hello = await first.next((l) => l.hello);
  assert.equal(first.lines[0], hello, 'the first line');
  assert.deepEqual(Object.keys(hello), ['hello']);
  assert.equal(hello.hello.v, 1);
  assert.match(hello.hello.version, /^\d+\.\d+\.\d+$/);
  assert.equal(hello.hello.busy, undefined);
  // The first state is the worker's $boot, sent as a state line.
  const booted = await first.next((l) => 'state' in l);
  assert.equal(typeof booted.state, 'object');
  assert.ok(booted.state && booted.state.profiles, JSON.stringify(booted).slice(0, 200));

  // A window started while the host holds the window lock has no window to wake: it ends 75 (no window opens), so SYNK
  // 솔리오's 「백업 창 따로 열기」 tries again rather than taking it for a woken window (GPT workbackup-solio-one-be-20261127-r3 GA1).
  const kept = spawn(exe, ['--window', '--test-mode'], { env, stdio: 'ignore', windowsHide: true });
  started.push(kept);
  assert.equal(await within(new Promise((ok) => kept.once('exit', (code) => ok(code))), WAIT, 'the window kept out by the host'), 75);

  // A second host while the first holds the window lock: busy, and its end.
  const second = host(['--solio', '--test-mode'], env);
  assert.equal(await within(second.exited, WAIT, 'the busy host'), 0);
  assert.deepEqual(second.lines, [{ hello: { v: 1, busy: true } }]);

  first.send({ id: 1, call: 'getState', args: [] });
  const answer = await first.next((l) => l.id === 1);
  assert.deepEqual(Object.keys(answer).sort(), ['id', 'result']);
  assert.equal(answer.result.ok, true, JSON.stringify(answer).slice(0, 300));
  // Not a method of the contract: the window's refusal, in the same envelope.
  first.send({ id: 2, call: 'secret.encrypt', args: ['x'] });
  assert.deepEqual((await first.next((l) => l.id === 2)).result, { ok: false, error: '이 화면에서는 실행할 수 없습니다.', code: 'INVALID_REQUEST' });
  // Lines not in the table are dropped: a field too many, a line over 128 KB, not JSON, an id of 0. The next call still goes.
  first.send({ id: 3, call: 'getState', args: [], extra: true });
  first.send(`{"id":4,"call":"getState","args":["${'x'.repeat(131072)}"]}`);
  first.send('not a line of the table');
  first.send({ id: 0, call: 'getState', args: [] });
  // An answer to no ask and a window that is not the parent's are taken and change nothing.
  first.send({ answer: 9, ok: true });
  first.send({ window: '123' });
  first.send({ id: 5, call: 'getState', args: [] });
  assert.equal((await first.next((l) => l.id === 5)).result.ok, true);

  // A call still going at `bye` is answered before the worker stops (GPT workbackup-solio-one-be-20261127 C2).
  first.send({ id: 6, call: 'getState', args: [] });
  first.send({ bye: true });
  assert.equal(await within(first.exited, WAIT, 'the host after bye'), 0);
  // Only once the host has ended and its output is read to the end: no answer to a dropped line ever came
  // (GPT workbackup-solio-one-be-20261127 GD3 — one look right after id 5 could miss a later one).
  await within(first.drained, WAIT, 'the host\'s output to its end');
  assert.equal(first.rest(), '', 'no part line left');
  assert.ok(!first.lines.some((l) => l.id === 3 || l.id === 4 || l.id === 0), 'no answer to a dropped line');
  assert.equal(first.lines.find((l) => l.id === 6)?.result?.ok, true, 'the call sent just before bye was answered');
  assert.ok(!first.lines.some((l) => 'failed' in l), JSON.stringify(first.lines.filter((l) => 'failed' in l)));
  for (const line of first.lines) assert.equal(Object.keys(line).length, line.id ? 2 : 1, JSON.stringify(line).slice(0, 120));

  // The lock went with it; the input's end is a bye too.
  const third = host(['--test-mode', '--solio'], env);
  assert.equal((await third.next((l) => l.hello)).hello.busy, undefined);
  await third.next((l) => 'state' in l);
  third.child.stdin.end();
  assert.equal(await within(third.exited, WAIT, 'the host after its input ended'), 0);
});
