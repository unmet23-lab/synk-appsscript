'use strict';
// 모델별 토큰 실시간 지켜보기(11-16 유호님 「실시간으로 나오게 하고싶은데」) 시험:
// 바뀐 파일만 읽어 곧바로 알리고, 쓰는 중인 마지막 조각과 다른 파일이 이미 센 응답은 세지 않고, 떠나거나 부탁이 끊기면 멈추고,
// 다 훑는 세기와 두 번 세지 않고, 끄기 · 켜기가 겹쳐도 마지막 부탁대로 된다(0.4.93 카본 B1 · Fable F1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTokenUsage, createTokenUsageWorker, readLines } = require('../src/ai-tokens.cjs');

const T = Date.parse('2026-11-16T03:00:00.000Z');
const iso = t => new Date(t).toISOString();
// Claude Code 2.1.325 줄 모양(열쇠 순서 그대로): message의 첫 열쇠가 model · id, 맨 위 type · uuid는 끝 가까이.
function claudeRow({ id, model = 'claude-opus-5-5', out = 100, t = Date.now() }) {
  return JSON.stringify({ parentUuid: 'p', isSidechain: false, message: { model, id, type: 'message', role: 'assistant', content: [{ type: 'text', text: 'hi' }], stop_reason: null, usage: { input_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: out } }, requestId: 'r', type: 'assistant', uuid: `u-${id}`, timestamp: iso(t) });
}
function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-tokens-live-'));
  const write = (rel, text) => { const f = path.join(home, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
  return { home, write, root: path.join(home, 'AppData', 'AiSubscriptions') };
}
const outOf = s => (s?.cells || []).filter(c => c[1] === 'claude').reduce((n, c) => n + c[4], 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(pred, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = pred(); if (v) return v; await sleep(25); }
  return null;
}
// 시험에서는 기다림을 줄인다(앱은 0.8초 · 2.5초 · 30초).
const FAST = { lease: 60e3, settle: 60, maxWait: 200, save: 100 };

test('실시간: 바뀐 파일만 곧바로 더해 알리고, 새 파일도 찾고, 사본 · 쓰는 중인 조각은 세지 않고, 다 훑어도 같은 숫자', async () => {
  const { home, write, root } = fakeHome();
  const events = [];
  const u = createTokenUsage({ root, home, env: {}, onChange: s => events.push(s), liveTiming: FAST });
  try {
    const a = write('.claude/projects/p/a.jsonl', claudeRow({ id: 'a1', out: 10 }) + '\n');
    // 꺼져 있으면 지켜보지 않는다.
    assert.equal(u.live(true).enabled, false);
    await u.setEnabled(true);
    await u.scan({ force: true });
    const on = u.live(true);
    assert.deepEqual([on.live, outOf(on), on.liveAt], [true, 10, null]);
    // 덧붙인 응답은 다 훑지 않아도 곧바로 더해지고 알린다.
    fs.appendFileSync(a, claudeRow({ id: 'a2', out: 25 }) + '\n');
    const got = await waitFor(() => events.find(e => e.live && outOf(e) === 35));
    assert.ok(got, '덧붙인 응답이 곧바로 더해진다');
    assert.ok(got.liveAt > 0, '지켜보며 더한 때가 판에 있다');
    // 같은 응답의 뒤 줄(스트리밍 끝값)은 차이만 더한다.
    fs.appendFileSync(a, claudeRow({ id: 'a2', out: 40 }) + '\n');
    assert.ok(await waitFor(() => events.find(e => outOf(e) === 50)), '같은 응답의 끝값은 차이만');
    // 새 파일: 찾은 파일 수가 늘고, 다른 파일이 이미 센 응답(옮겨진 세션의 사본)은 다시 세지 않는다.
    write('.claude/projects/p/b.jsonl', [claudeRow({ id: 'a1', out: 10 }), claudeRow({ id: 'b1', out: 7 })].join('\n') + '\n');
    const nb = await waitFor(() => events.find(e => outOf(e) === 57));
    assert.ok(nb, '새 파일의 새 응답만 더한다');
    assert.equal(nb.tools.claude, 2);
    // 쓰는 중인 마지막 조각(줄바꿈 전)은 아직 세지 않고, 줄이 끝나면 센다.
    fs.appendFileSync(a, claudeRow({ id: 'a3', out: 1000 }));
    await sleep(400);
    assert.equal(outOf(u.state()), 57);
    fs.appendFileSync(a, '\n');
    assert.ok(await waitFor(() => events.find(e => outOf(e) === 1057)), '줄이 끝나면 센다');
    // 다 훑는 세기를 해도 같은 숫자다(지켜보며 읽은 자리에서 잇는다).
    assert.equal(outOf(await u.scan({ force: true })), 1057);
    await sleep(300); // 지켜보며 더한 숫자의 저장(시험 0.1초)
    // 떠나면 멈춘다: 더 써도 더하지 않는다.
    assert.equal(u.live(false).live, false);
    fs.appendFileSync(a, claudeRow({ id: 'a4', out: 5 }) + '\n');
    await sleep(400);
    assert.equal(outOf(u.state()), 1057);
    // 새로 띄워도 저장해 둔 자리에서 이어 같은 숫자가 된다.
    u.dispose();
    const fresh = createTokenUsage({ root, home, env: {} });
    assert.equal(outOf(await fresh.scan({ force: true })), 1062);
    fresh.dispose();
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 화면의 부탁이 끊기면 저절로 멈추고, 끄면 지켜보기도 닫는다', async () => {
  const { home, write, root } = fakeHome();
  const events = [];
  const u = createTokenUsage({ root, home, env: {}, onChange: s => events.push(s), liveTiming: { ...FAST, lease: 150 } });
  try {
    const a = write('.claude/projects/p/a.jsonl', claudeRow({ id: 'l1', out: 3 }) + '\n');
    await u.setEnabled(true);
    await u.scan({ force: true });
    assert.equal(u.live(true).live, true);
    const at = events.length;
    assert.ok(await waitFor(() => events.slice(at).find(e => e.enabled && e.live === false), 3000), '부탁이 끊기면 멈추고 알린다');
    fs.appendFileSync(a, claudeRow({ id: 'l2', out: 4 }) + '\n');
    await sleep(300);
    assert.equal(outOf(u.state()), 3);
    // 다시 켜고, 끄면 지켜보기도 닫힌다(꺼진 뒤의 부탁은 지켜보지 않는다).
    assert.equal(u.live(true).live, true);
    const off = await u.setEnabled(false);
    assert.deepEqual([off.ok, off.enabled], [true, false]);
    assert.equal(u.live(true).enabled, false);
    fs.appendFileSync(a, claudeRow({ id: 'l3', out: 4 }) + '\n');
    await sleep(300);
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json')), false, '끈 뒤에 지켜보던 숫자를 다시 저장하지 않는다');
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 알림을 모으는 동안은 다 훑는 세기를 15분마다만 한다(이 일꾼에서 아직 훑지 않았으면 5분)', async () => {
  const { home, write, root } = fakeHome();
  let now = T;
  const u = createTokenUsage({ root, home, env: {}, now: () => now, liveTiming: FAST });
  try {
    write('.claude/projects/p/a.jsonl', claudeRow({ id: 'm1', out: 3, t: T }) + '\n');
    await u.setEnabled(true);
    const first = await u.scan({ force: true });
    u.live(true);
    now += 6 * 60e3;
    assert.equal((await u.scan()).scannedAt, first.scannedAt, '알림을 모으는 중 6분: 다시 세지 않는다');
    now += 10 * 60e3;
    assert.equal((await u.scan()).scannedAt, now, '16분: 놓친 알림을 메우러 다시 센다');
    u.dispose();
    // 앱을 다시 켠 것처럼 새 본체(알림 모으기 없음): 5분이 지났으면 센다.
    const fresh = createTokenUsage({ root, home, env: {}, now: () => now, liveTiming: FAST });
    now += 6 * 60e3;
    assert.equal((await fresh.scan()).scannedAt, now, '알림을 모은 적 없는 본체는 5분이 지나면 센다');
    fresh.dispose();
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 창을 내렸다 올리면 그 사이 바뀐 기록을 다 훑지 않고 곧바로 읽는다(GPT 지적)', async () => {
  const { home, write, root } = fakeHome();
  const events = [];
  const u = createTokenUsage({ root, home, env: {}, onChange: s => events.push(s), liveTiming: FAST });
  try {
    const a = write('.claude/projects/p/a.jsonl', claudeRow({ id: 'g1', out: 10 }) + '\n');
    await u.setEnabled(true);
    const scanned = await u.scan({ force: true });
    assert.equal(u.live(true).live, true);
    // 창을 내림: 실시간은 내리고, 그동안 적힌 응답은 아직 더하지 않는다.
    assert.equal(u.live(false).live, false);
    fs.appendFileSync(a, claudeRow({ id: 'g2', out: 25 }) + '\n');
    await sleep(400);
    assert.equal(outOf(u.state()), 10);
    // 다시 올림: 다 훑지 않고(마지막으로 센 때 그대로) 모아 둔 파일을 곧바로 읽는다.
    const at = events.length;
    u.live(true);
    const got = await waitFor(() => events.slice(at).find(e => outOf(e) === 35), 3000);
    assert.ok(got, '그 사이 적힌 응답을 곧바로 더한다');
    assert.equal(got.scannedAt, scanned.scannedAt, '다 훑지 않았다');
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 처음 지켜볼 때 없던 기록 폴더(새로 연결한 계정 · 처음 쓰는 도구)도 생기면 지켜보고, 그 전에 적힌 응답도 센다(GPT 지적)', async () => {
  const { home, write, root } = fakeHome();
  const events = [], dirs = [];
  const u = createTokenUsage({ root, home, env: {}, claudeDirs: () => dirs, onChange: s => events.push(s), liveTiming: { ...FAST, lease: 900 } });
  const renew = setInterval(() => u.live(true), 200);
  try {
    write('.claude/projects/p/a.jsonl', claudeRow({ id: 'n1', out: 10 }) + '\n');
    await u.setEnabled(true);
    await u.scan({ force: true });
    u.live(true);
    // 계정판에 새 Claude 계정을 연결했다: 그 폴더는 처음 지켜볼 때 없었다.
    const extra = path.join(home, 'accounts', 'c2');
    write('accounts/c2/projects/q/b.jsonl', claudeRow({ id: 'n2', out: 7 }) + '\n');
    dirs.push(extra);
    const got = await waitFor(() => events.find(e => outOf(e) === 17), 4000);
    assert.ok(got, '새로 생긴 폴더를 찾아 그 전에 적힌 응답까지 센다');
    assert.equal(got.tools.claude, 2);
    // 그 뒤 적힌 응답은 알림으로 곧바로 더한다.
    fs.appendFileSync(path.join(extra, 'projects', 'q', 'b.jsonl'), claudeRow({ id: 'n3', out: 5 }) + '\n');
    assert.ok(await waitFor(() => events.find(e => outOf(e) === 22), 4000), '새 폴더의 알림도 받는다');
  } finally { clearInterval(renew); u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('끄기 · 켜기: 끄는 동안 온 켜기는 끄기가 끝난 뒤 켜지고, 읽던 큰 파일은 덩이 사이에서 그만 읽는다(0.4.93 카본 B1 · Fable F1)', async () => {
  const { home, write, root } = fakeHome();
  try {
    // 읽기는 덩이(4MB)마다 그만 읽을지 묻는다.
    const big = write('big.jsonl', `${'x'.repeat(1023)}\n`.repeat(10 * 1024));
    let asked = 0;
    await assert.rejects(readLines(big, 0, fs.statSync(big).size, () => {}, () => ++asked > 1), { code: 'STOPPED' });
    assert.equal(asked, 2);
    for (let i = 0; i < 40; i++) write(`.claude/projects/p/s${i}.jsonl`, claudeRow({ id: 'k' + i, out: 1, t: T }) + '\n');
    const u = createTokenUsage({ root, home, env: {}, now: () => T });
    await u.setEnabled(true); // 켜자마자 세기가 돈다
    const off = u.setEnabled(false), on = u.setEnabled(true);
    assert.equal((await off).enabled, false);
    assert.equal((await on).enabled, true);
    const done = await u.scan({ force: true });
    assert.deepEqual([done.enabled, outOf(done), done.failed], [true, 40, 0]);
    assert.equal(fs.existsSync(path.join(root, 'token-usage.json')), true);
    u.dispose();
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('일꾼 스레드: 실시간 지켜보기가 일꾼에서 돌아 알림이 주 프로세스로 넘어오고, 끄기 · 켜기가 겹쳐도 일꾼을 내리지 않는다', async () => {
  const { home, write, root } = fakeHome();
  const events = [];
  const u = createTokenUsageWorker({ root, home, env: {}, onChange: s => events.push(s) });
  try {
    const a = write('.claude/projects/p/a.jsonl', claudeRow({ id: 'w1', out: 2 }) + '\n');
    assert.equal((await u.live(true)).enabled, false, '켠 적이 없으면 일꾼을 띄우지 않고 꺼짐');
    await u.setEnabled(true);
    await u.scan({ force: true });
    assert.equal((await u.live(true)).live, true);
    fs.appendFileSync(a, claudeRow({ id: 'w2', out: 30 }) + '\n');
    assert.ok(await waitFor(() => events.find(e => e.live && outOf(e) === 32)), '일꾼이 지켜보다 더한 판이 넘어온다');
    // 끄자마자 다시 켜도 마지막 부탁(켜짐)대로 남는다.
    const off = u.setEnabled(false), on = u.setEnabled(true);
    await off; await on;
    const s = await u.scan({ force: true });
    assert.deepEqual([s.ok, s.enabled, outOf(s)], [true, true, 32]);
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 지켜보던 기록 폴더가 지워져도 알림이 쏟아지지 않고(Windows), 다시 생기면 다시 지켜본다', async () => {
  const { home, write, root } = fakeHome();
  const events = [], dirs = [];
  const u = createTokenUsage({ root, home, env: {}, claudeDirs: () => dirs, onChange: s => events.push(s), liveTiming: { ...FAST, lease: 900 } });
  const renew = setInterval(() => u.live(true), 200);
  try {
    write('.claude/projects/p/a.jsonl', claudeRow({ id: 'd1', out: 10 }) + '\n');
    const extra = path.join(home, 'accounts', 'c2');
    write('accounts/c2/projects/q/b.jsonl', claudeRow({ id: 'd2', out: 7 }) + '\n');
    dirs.push(extra);
    await u.setEnabled(true);
    await u.scan({ force: true });
    u.live(true);
    // 계정판에서 그 계정을 지웠다: 계정 폴더가 통째로 지워진다(지켜보던 projects 폴더도).
    fs.rmSync(extra, { recursive: true, force: true });
    const cpu0 = process.cpuUsage();
    await sleep(1500);
    const used = process.cpuUsage(cpu0), ms = (used.user + used.system) / 1000;
    assert.ok(ms < 600, `지워진 폴더의 알림이 쏟아지지 않는다(1.5초에 CPU ${Math.round(ms)}ms)`);
    assert.equal(outOf(u.state()), 17, '지워진 기록의 숫자는 남는다');
    // 같은 계정 폴더가 다시 생기면 다시 지켜보고 새 응답을 센다.
    write('accounts/c2/projects/q/c.jsonl', claudeRow({ id: 'd3', out: 5 }) + '\n');
    assert.ok(await waitFor(() => events.find(e => outOf(e) === 22), 4000), '다시 생긴 폴더를 다시 지켜본다');
  } finally { clearInterval(renew); u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 지켜볼 기록 폴더가 하나도 없으면 「실시간」이라 하지 않는다(카본 지적)', async () => {
  const { home, root } = fakeHome();
  const u = createTokenUsage({ root, home, env: {}, liveTiming: FAST });
  try {
    await u.setEnabled(true);
    await u.scan({ force: true });
    assert.equal(u.live(true).live, false);
  } finally { u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});

test('실시간: 기한이 지난 사이 다 훑는 세기가 끝나도 옛 응답 표로 사본을 한 번 더 세지 않는다(Fable 최종 검수 지적)', async () => {
  const { home, write, root } = fakeHome();
  const events = [];
  const realNow = Date.now;
  const u = createTokenUsage({ root, home, env: {}, onChange: s => events.push(s), liveTiming: FAST });
  try {
    const a = write('.claude/projects/p/a.jsonl', claudeRow({ id: 'o1', out: 10 }) + '\n');
    await u.setEnabled(true);
    await u.scan({ force: true });
    u.live(true);
    // 실시간으로 한 번 읽어 응답 표를 만든다.
    fs.appendFileSync(a, claudeRow({ id: 'o2', out: 25 }) + '\n');
    assert.ok(await waitFor(() => events.find(e => outOf(e) === 35)));
    // 화면의 부탁이 끊겨 기한(1분)이 지났고, 30초 확인은 아직 돌지 않았다.
    Date.now = () => realNow() + 4 * 60e3;
    write('.claude/projects/q/c.jsonl', claudeRow({ id: 'o3', out: 1000 }) + '\n');
    assert.equal(outOf(await u.scan({ force: true })), 1035);
    // 다시 실시간을 켜고 o3의 사본(옮겨진 세션)이 적힌다.
    u.live(true);
    write('.claude/projects/r/c.jsonl', claudeRow({ id: 'o3', out: 1000 }) + '\n');
    await sleep(500);
    assert.equal(outOf(u.state()), 1035, '사본의 응답을 한 번 더 세지 않는다');
  } finally { Date.now = realNow; u.dispose(); fs.rmSync(home, { recursive: true, force: true }); }
});
