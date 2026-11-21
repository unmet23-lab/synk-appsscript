'use strict';
// 솔리오 「사무실」의 기록 살피기(office-records.cjs, 구현설계.md 3.1 · 3.3 · 3.4 · 4.4 · 14.1). 기록 파일은 모두 임시 폴더의 합성이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createOfficeRecords, defaultRoots, SLICE } = require('../src/office-records.cjs');
const { createOffice, loadOfficeModel } = require('../src/office.cjs');

const S = 1e3, M = 60e3, H = 3600e3;
const uuid = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tmp = name => fs.mkdtempSync(path.join(os.tmpdir(), `office-records-${name}-`));
const claudeLine = (cwd, extra = {}) => JSON.stringify({ type: 'user', sessionId: 'x', cwd, message: { role: 'user', content: '비밀 글' }, ...extra }) + '\n';
const codexMeta = cwd => JSON.stringify({ timestamp: '2026-11-20T00:00:00Z', type: 'session_meta', payload: { id: 'x', cwd, instructions: '긴 지시' } }) + '\n';
function put(file, text, mtime) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  if (mtime != null) fs.utimesSync(file, mtime / 1e3, mtime / 1e3);
  return file;
}
/* 세는 fs: stat · readdir · open의 수를 센다 */
function counting() {
  const p = fs.promises;
  const calls = { stat: 0, readdir: 0, open: 0, opened: [], openMs: 0 };
  const fsImpl = { promises: {
    stat: (...a) => { calls.stat += 1; return p.stat(...a); },
    readdir: (...a) => { calls.readdir += 1; return p.readdir(...a); },
    open: async (...a) => {
      calls.open += 1; calls.opened.push(a[0]);
      const started = process.hrtime.bigint();
      try { return await p.open(...a); } finally { calls.openMs += Number(process.hrtime.bigint() - started) / 1e6; }
    },
  } };
  const reset = () => { calls.stat = 0; calls.readdir = 0; calls.open = 0; calls.opened = []; calls.openMs = 0; };
  return { fsImpl, calls, reset };
}
const byId = list => Object.fromEntries(list.map(o => [o.sessionId, o]));

test('several roots: two Claude config folders and Codex, each session once with its tool and folder', async () => {
  const now = Date.now();
  const a = tmp('a'), b = tmp('b'), codex = tmp('codex');
  const shop = put(path.join(a, 'projects', 'C--work-shop', uuid(1) + '.jsonl'), '{"type":"summary","summary":"x"}\n' + claudeLine('C:\\work\\shop'), now - 10 * S);
  put(path.join(b, 'projects', 'C--work-law', uuid(2) + '.jsonl'), claudeLine('C:\\work\\law'), now - 5 * M);
  put(path.join(b, 'projects', 'C--work-law', uuid(3) + '.jsonl'), claudeLine('C:\\work\\law'), now - 31 * M); // 30분 넘게 그대로
  put(path.join(b, 'projects', 'C--work-law', 'agent-1234abcd.jsonl'), claudeLine('C:\\work\\law'), now); // 옛 판의 도우미 기록
  put(path.join(b, 'projects', 'C--work-law', 'notes.txt'), 'x', now);
  put(path.join(codex, '2026', '11', '20', `rollout-2026-11-20T09-00-00-${uuid(4)}.jsonl`), codexMeta('C:\\work\\codex'), now - 20 * S);
  put(path.join(codex, '2026', '11', '20', `rollout-2026-11-20T09-00-00-${uuid(5)}.jsonl.zst`), 'zz', now);
  const records = createOfficeRecords({ roots: { claude: [a, b, a.toUpperCase()], codex: [codex] }, now: () => now });
  const found = byId(await records.scan());
  assert.deepEqual(Object.keys(found).sort(), [uuid(1), uuid(2), uuid(4)]);
  assert.deepEqual(found[uuid(1)], { kind: 'record', sessionId: uuid(1), cwd: 'C:\\work\\shop', tool: 'claude', changedAt: fs.statSync(shop).mtimeMs });
  assert.equal(found[uuid(2)].cwd, 'C:\\work\\law');
  assert.equal(found[uuid(4)].tool, 'codex');
  assert.equal(found[uuid(4)].cwd, 'C:\\work\\codex');
  for (const o of Object.values(found)) assert.deepEqual(Object.keys(o).sort(), ['changedAt', 'cwd', 'kind', 'sessionId', 'tool'], 'nothing else from the file');
  assert.ok(!JSON.stringify(Object.values(found)).includes('비밀'), 'no content leaves the module');
});

test('a line that cannot be read gives cwd null, never a guess; a grown file is read again only from where it was', async () => {
  let now = Date.now();
  const root = tmp('lines');
  const dir = path.join(root, 'projects', 'p');
  const bad = put(path.join(dir, uuid(1) + '.jsonl'), [
    '{ broken json "cwd": "C:\\\\guess"',
    JSON.stringify({ type: 'user', message: { cwd: 'C:\\nested' } }), // 안쪽 칸의 cwd는 세션의 작업 폴더가 아니다
    JSON.stringify({ type: 'user', cwd: 'relative\\folder' }), // 절대 경로가 아니다
    JSON.stringify({ type: 'user', cwd: 42 }),
  ].join('\n') + '\n', now - 5 * S);
  const codexRoot = tmp('codex-lines');
  put(path.join(codexRoot, '2026', '11', '20', `rollout-2026-11-20T09-00-00-${uuid(2)}.jsonl`), JSON.stringify({ type: 'response_item', payload: { cwd: 'C:\\not-meta' } }) + '\n', now - 5 * S);
  const { fsImpl, calls, reset } = counting();
  const records = createOfficeRecords({ roots: { claude: [root], codex: [codexRoot] }, now: () => now, fsImpl });
  let found = byId(await records.scan());
  assert.equal(found[uuid(1)].cwd, null);
  assert.equal(found[uuid(2)].cwd, null, 'Codex cwd is taken only from session_meta or turn_context');
  reset(); now += 15 * S;
  found = byId(await records.scan());
  assert.equal(calls.open, 0, 'a file that did not grow is not read again');
  const before = fs.statSync(bad).size;
  fs.appendFileSync(bad, claudeLine('C:\\work\\late'));
  fs.utimesSync(bad, (now - S) / 1e3, (now - S) / 1e3);
  reset(); now += 15 * S;
  found = byId(await records.scan());
  assert.equal(found[uuid(1)].cwd, 'C:\\work\\late');
  assert.equal(calls.open, 1);
  assert.ok(fs.statSync(bad).size > before);
  reset(); now += 15 * S;
  await records.scan();
  assert.equal(calls.open, 0, 'a found folder is cached: each file is read once');
});

test('only a bounded slice is read: the first 64 KB, then the last 64 KB, and complete lines only', async () => {
  const now = Date.now();
  const root = tmp('slice');
  const dir = path.join(root, 'projects', 'p');
  // 첫 줄이 64KB를 넘으면 그 줄은 읽지 않는다. 끝 64KB의 온전한 줄에서 찾는다
  const huge = claudeLine('C:\\head-too-long', { pad: 'x'.repeat(SLICE + 10) });
  put(path.join(dir, uuid(1) + '.jsonl'), huge + JSON.stringify({ type: 'progress' }) + '\n' + claudeLine('C:\\work\\tail'), now - S);
  // 가운데에만 있는 작업 폴더는 찾지 않는다(앞과 끝만 본다)
  const filler = JSON.stringify({ type: 'progress', pad: 'y'.repeat(1000) }) + '\n';
  put(path.join(dir, uuid(2) + '.jsonl'), filler.repeat(70) + claudeLine('C:\\work\\middle') + filler.repeat(70), now - S);
  const { fsImpl, calls } = counting();
  const records = createOfficeRecords({ roots: { claude: [root], codex: [] }, now: () => now, fsImpl });
  const found = byId(await records.scan());
  assert.equal(found[uuid(1)].cwd, 'C:\\work\\tail');
  assert.equal(found[uuid(2)].cwd, null);
  assert.equal(calls.open, 2);
});

test('subagent records are not sessions, but their latest change counts as the session time', async () => {
  const now = Date.now();
  const root = tmp('sub');
  const dir = path.join(root, 'projects', 'p');
  put(path.join(dir, uuid(1) + '.jsonl'), claudeLine('C:\\work\\shop'), now - 40 * M); // 본 기록은 40분째 그대로
  const sub = put(path.join(dir, uuid(1), 'subagents', 'agent-a1.jsonl'), claudeLine('C:\\work\\shop', { isSidechain: true }), now - 20 * S);
  put(path.join(dir, uuid(1), 'subagents', uuid(9) + '.jsonl'), claudeLine('C:\\work\\shop'), now - 30 * S); // 이름이 uuid여도 도우미 기록이다
  put(path.join(dir, uuid(2), 'subagents', 'agent-b.jsonl'), claudeLine('C:\\work\\x'), now - 10 * S); // 본 기록이 없는 도우미 폴더
  let clock = now;
  const records = createOfficeRecords({ roots: { claude: [root], codex: [] }, now: () => clock });
  let found = await records.scan();
  assert.deepEqual(found.map(o => o.sessionId), [uuid(1)], 'one session; subagent files and an orphan folder are not sessions');
  assert.equal(found[0].changedAt, fs.statSync(sub).mtimeMs);
  // 틱에서도 도우미 기록의 바뀜을 본다
  clock += 15 * S;
  fs.appendFileSync(sub, claudeLine('C:\\work\\shop'));
  fs.utimesSync(sub, (clock - S) / 1e3, (clock - S) / 1e3);
  found = await records.scan();
  assert.equal(found[0].changedAt, fs.statSync(sub).mtimeMs);
  assert.equal(found[0].cwd, 'C:\\work\\shop');
});

test('a tick finds a new session in an old project folder and a new project folder without a full listing', async () => {
  let now = Date.now();
  const root = tmp('tick');
  put(path.join(root, 'projects', 'old', uuid(1) + '.jsonl'), claudeLine('C:\\old'), now - 3 * H);
  const codexRoot = tmp('tick-codex');
  put(path.join(codexRoot, '2026', '11', '19', `rollout-2026-11-19T09-00-00-${uuid(5)}.jsonl`), codexMeta('C:\\c'), now - 3 * H);
  const { fsImpl, calls, reset } = counting();
  const records = createOfficeRecords({ roots: { claude: [root], codex: [codexRoot] }, now: () => now, fsImpl });
  assert.deepEqual(await records.scan({ full: true }), []);
  await new Promise(resolve => setTimeout(resolve, 60)); // 폴더의 고친 때가 앞 훑기와 다른 때가 되도록
  put(path.join(root, 'projects', 'old', uuid(2) + '.jsonl'), claudeLine('C:\\old'));
  put(path.join(root, 'projects', 'new', uuid(3) + '.jsonl'), claudeLine('C:\\new'));
  put(path.join(codexRoot, '2026', '11', '20', `rollout-2026-11-20T09-00-00-${uuid(6)}.jsonl`), codexMeta('C:\\c2'));
  reset(); now += 15 * S;
  const found = byId(await records.scan());
  assert.deepEqual(Object.keys(found).sort(), [uuid(2), uuid(3), uuid(6)]);
  assert.equal(found[uuid(3)].cwd, 'C:\\new');
  assert.equal(found[uuid(6)].cwd, 'C:\\c2');
  assert.ok(calls.stat < 20, `a tick stats folders and new files only (${calls.stat})`);
  // 모두 훑기를 부탁해도 앞 훑기가 15초 안이면 틱이다
  reset(); now += 1 * S;
  await records.scan({ full: true });
  assert.ok(calls.stat < 20);
});

test('a folder dropped from the list is forgotten', async () => {
  const now = Date.now();
  const a = tmp('drop-a'), b = tmp('drop-b');
  put(path.join(a, 'projects', 'p', uuid(1) + '.jsonl'), claudeLine('C:\\a'), now - S);
  put(path.join(b, 'projects', 'p', uuid(2) + '.jsonl'), claudeLine('C:\\b'), now - S);
  const records = createOfficeRecords({ now: () => now });
  assert.equal((await records.scan({ roots: { claude: [a, b], codex: [] } })).length, 2);
  assert.deepEqual((await records.scan({ roots: { claude: [b], codex: [] } })).map(o => o.sessionId), [uuid(2)]);
  assert.deepEqual(await records.scan({ roots: { claude: [path.join(a, 'missing')], codex: [] } }), [], 'a missing folder is skipped quietly');
});

test('default roots: the Claude config folder and Codex sessions, CLAUDE_CONFIG_DIR and CODEX_HOME win', () => {
  assert.deepEqual(defaultRoots({}, 'win32', 'C:\\Users\\a'), { claude: ['C:\\Users\\a\\.claude'], codex: ['C:\\Users\\a\\.codex\\sessions'] });
  assert.deepEqual(defaultRoots({ CLAUDE_CONFIG_DIR: 'D:\\cc', CODEX_HOME: 'D:\\cx' }, 'win32', 'C:\\Users\\a'), { claude: ['D:\\cc'], codex: ['D:\\cx\\sessions'] });
  assert.deepEqual(defaultRoots({}, 'linux', () => '/home/a'), { claude: ['/home/a/.claude'], codex: ['/home/a/.codex/sessions'] });
  assert.deepEqual(defaultRoots({}, 'win32', () => { throw new Error('no home'); }), { claude: [], codex: [] });
});

test("the app's own AiSubscriptions\\run session is dropped by the reducer and never appears through the office", async () => {
  const model = await loadOfficeModel();
  const now = Date.now();
  const root = tmp('own-run');
  put(path.join(root, 'projects', 'run', uuid(1) + '.jsonl'), claudeLine('C:\\Users\\a\\AppData\\Roaming\\SYNK Desktop\\AiSubscriptions\\run'), now - 5 * S);
  put(path.join(root, 'projects', 'shop', uuid(2) + '.jsonl'), claudeLine('C:\\work\\shop'), now - 5 * S);
  const home = tmp('own-run-home');
  const viewersFile = path.join(home, 'office', 'viewers.json');
  put(viewersFile, JSON.stringify({ synk_user_ids: ['owner-1234567890'] }));
  const records = createOfficeRecords({ now: () => now });
  const office = createOffice({ userData: path.join(home, 'userData'), viewersFile, model, records, roots: { claude: [root], codex: [] },
    capacity: { read: async () => ({ cores: 8, totalMemGb: 16, freeMemGb: 8, cpuPercent: 10 }) }, now: () => now,
    setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {} });
  const yuho = { synk_user_id: 'owner-1234567890', display_name: '유호' };
  assert.equal((await office.watch(true, yuho)).ok, true);
  const snap = await office.snapshot(yuho);
  assert.deepEqual(Object.keys(snap.state.sessions), [uuid(2)]);
  assert.deepEqual(snap.state.ignored, {}, 'the ignored session ids are not handed to the screen');
  assert.deepEqual(model.officeSessions(snap.state, now).map(v => v.id), [uuid(2)]);
  office.close();
});

test('5,000 record files: a 15-second tick stats far fewer files than a full listing', async t => {
  const root = tmp('many'), codexRoot = tmp('many-codex');
  const made = Date.now();
  const recent = [];
  let n = 0;
  for (let p = 0; p < 50; p++) {
    for (let i = 0; i < 96; i++) put(path.join(root, 'projects', `project-${p}`, uuid(++n) + '.jsonl'), claudeLine(`C:\\work\\p${p}`));
  }
  for (let d = 1; d <= 10; d++) {
    for (let i = 0; i < 20; i++) put(path.join(codexRoot, '2026', '11', String(d).padStart(2, '0'), `rollout-2026-11-${String(d).padStart(2, '0')}T09-00-00-${uuid(++n)}.jsonl`), codexMeta('C:\\work\\codex'));
  }
  assert.equal(n, 5000);
  let now = made + 24 * H; // 만든 파일은 모두 하루 전 것으로 보인다
  for (const k of [1, 97, 193, 289, 385, 481, 577, 673, 4801, 4821]) {
    const file = k <= 4800 ? path.join(root, 'projects', `project-${Math.floor((k - 1) / 96)}`, uuid(k) + '.jsonl') : path.join(codexRoot, '2026', '11', String(Math.floor((k - 4801) / 20) + 1).padStart(2, '0'), `rollout-2026-11-${String(Math.floor((k - 4801) / 20) + 1).padStart(2, '0')}T09-00-00-${uuid(k)}.jsonl`);
    fs.utimesSync(file, (now - M) / 1e3, (now - M) / 1e3);
    recent.push(uuid(k));
  }
  const { fsImpl, calls, reset } = counting();
  const records = createOfficeRecords({ roots: { claude: [root], codex: [codexRoot] }, now: () => now, fsImpl });
  let started = process.hrtime.bigint();
  const first = await records.scan({ full: true });
  const fullMs = Number(process.hrtime.bigint() - started) / 1e6;
  const full = { stat: calls.stat, readdir: calls.readdir, open: calls.open, openMs: calls.openMs };
  assert.deepEqual(first.map(o => o.sessionId).sort(), [...recent].sort());
  // 15초 뒤의 틱: 새 세션 하나가 생겼다
  await new Promise(resolve => setTimeout(resolve, 60));
  const fresh = put(path.join(root, 'projects', 'project-7', uuid(9001) + '.jsonl'), claudeLine('C:\\work\\p7'));
  fs.utimesSync(fresh, (now + 10 * S) / 1e3, (now + 10 * S) / 1e3);
  reset(); now += 15 * S;
  started = process.hrtime.bigint();
  const second = await records.scan();
  const tickMs = Number(process.hrtime.bigint() - started) / 1e6;
  const tick = { stat: calls.stat, readdir: calls.readdir, open: calls.open, openMs: calls.openMs };
  assert.deepEqual(second.map(o => o.sessionId).sort(), [...recent, uuid(9001)].sort());
  // 다음 틱: 새 파일이 없다
  reset(); now += 15 * S;
  started = process.hrtime.bigint();
  await records.scan();
  const quietMs = Number(process.hrtime.bigint() - started) / 1e6;
  const quiet = { stat: calls.stat, readdir: calls.readdir, open: calls.open };
  t.diagnostic(`full listing: ${full.stat} stat, ${full.readdir} readdir, ${full.open} files opened, ${fullMs.toFixed(0)} ms (opening ${full.openMs.toFixed(0)} ms)`);
  t.diagnostic(`15 s tick with one new file: ${tick.stat} stat, ${tick.readdir} readdir, ${tick.open} file opened, ${tickMs.toFixed(0)} ms (opening ${tick.openMs.toFixed(0)} ms)`);
  t.diagnostic(`15 s tick, nothing new: ${quiet.stat} stat, ${quiet.readdir} readdir, ${quiet.open} files opened, ${quietMs.toFixed(0)} ms`);
  assert.equal(quiet.open, 0);
  assert.ok(quiet.stat * 20 < full.stat);
  assert.ok(full.stat >= 5000);
  assert.ok(tick.stat * 20 < full.stat, `tick ${tick.stat} vs full ${full.stat}`);
  assert.equal(tick.open, 1, 'only the new file is read for its folder');
  // 2분이 지나면 다시 모두 훑는다
  reset(); now += 2 * M;
  await records.scan();
  assert.ok(calls.stat >= 5000);
});

/* ── GPT 검수(solio-office-be-20261120) ── */
test('GA12: a cwd line still being written at the first look is read whole once it is finished', async () => {
  let t = Date.now();
  const dir = tmp('partial');
  const line = claudeLine('C:\\work\\half');
  const file = put(path.join(dir, 'projects', 'C--work-half', uuid(31) + '.jsonl'), '{"type":"summary","summary":"x"}\n' + line.slice(0, 20), t - 5 * S);
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  assert.equal(byId(await records.scan({ full: true }))[uuid(31)].cwd, null, 'half a line is not guessed');
  fs.appendFileSync(file, line.slice(20));
  t += 15 * S;
  assert.equal(byId(await records.scan())[uuid(31)].cwd, 'C:\\work\\half', 'the finished line is read from its start');
  // 다 읽은 줄 뒤에서 자란 파일은 그 뒤만 읽는다(앞 줄은 다시 읽지 않는다)
  const other = put(path.join(dir, 'projects', 'C--work-half', uuid(32) + '.jsonl'), '{"type":"summary","summary":"x"}\n', t);
  t += 15 * S;
  assert.equal(byId(await records.scan({ full: true }))[uuid(32)].cwd, null);
  fs.appendFileSync(other, claudeLine('C:\\work\\later'));
  t += 15 * S;
  assert.equal(byId(await records.scan())[uuid(32)].cwd, 'C:\\work\\later');
});

test('GA13: a file dated in the future counts from when it was first seen, so an unchanged file goes quiet and is dropped after 30 minutes', async () => {
  let t = Date.now();
  const dir = tmp('future');
  const file = put(path.join(dir, 'projects', 'C--work-future', uuid(41) + '.jsonl'), claudeLine('C:\\work\\future'), t + 48 * H);
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  const seen = t;
  assert.equal(byId(await records.scan({ full: true }))[uuid(41)].changedAt, seen, 'a time in the future is taken as now');
  t += 15 * S;
  assert.equal(byId(await records.scan())[uuid(41)].changedAt, seen, 'unchanged: still the time it was first seen');
  t += 3 * M;
  assert.equal(byId(await records.scan({ full: true }))[uuid(41)].changedAt, seen, 'a full listing keeps it too');
  t += 28 * M;
  assert.equal(byId(await records.scan())[uuid(41)], undefined, 'quiet for 30 minutes: no longer returned');
  // 다시 적히면(여전히 앞날의 때여도) 새 소식이다
  fs.appendFileSync(file, claudeLine('C:\\work\\future'));
  fs.utimesSync(file, (t + 49 * H) / 1e3, (t + 49 * H) / 1e3);
  t += 15 * S;
  assert.equal(byId(await records.scan({ full: true }))[uuid(41)].changedAt, t, 'a new write is news again');
});

test('GPT 검수 be5 GA6: a helper record written while the main record is dated ahead is still news', async () => {
  let t = Date.now();
  const dir = tmp('future-helper');
  const id = uuid(43);
  put(path.join(dir, 'projects', 'C--work-helper', id + '.jsonl'), claudeLine('C:\\work\\helper'), t + 45 * M);
  const helper = path.join(dir, 'projects', 'C--work-helper', id, 'subagents', 'agent-1.jsonl');
  put(helper, claudeLine('C:\\work\\helper'), t - 60 * M);
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  assert.equal(byId(await records.scan({ full: true }))[id].changedAt, t);
  t += 31 * M;
  assert.equal(byId(await records.scan({ full: true }))[id], undefined, 'quiet for 30 minutes: dropped');
  fs.appendFileSync(helper, claudeLine('C:\\work\\helper'));
  fs.utimesSync(helper, (t - 1000) / 1e3, (t - 1000) / 1e3);
  assert.ok(byId(await records.scan({ full: true }))[id], 'the helper wrote a second ago, so the session stands again');
});

test('설계 검토 be8 고칠 것 2: links below the watched folder are not followed — a helper folder linked elsewhere does not make an old session look busy', async () => {
  let t = Date.now();
  const dir = tmp('linked-helper');
  const other = tmp('linked-target');
  const id = uuid(46);
  put(path.join(dir, 'projects', 'C--work-link', id + '.jsonl'), claudeLine('C:\\work\\link'), t - 3 * H);
  put(path.join(other, 'agent-1.jsonl'), claudeLine('C:\\work\\other'), t - 1000);
  fs.mkdirSync(path.join(dir, 'projects', 'C--work-link', id), { recursive: true });
  fs.symlinkSync(other, path.join(dir, 'projects', 'C--work-link', id, 'subagents'), 'junction');
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  assert.equal(byId(await records.scan({ full: true }))[id], undefined, 'the linked helper folder is not read');
  // 한 번 본 프로젝트 폴더를 연결로 바꾸어도 틱이 따라가지 않는다
  const proj = path.join(dir, 'projects', 'C--work-swap');
  const newId = uuid(47);
  put(path.join(proj, uuid(48) + '.jsonl'), claudeLine('C:\\work\\swap'), t - 1000);
  assert.ok(byId(await records.scan({ full: true }))[uuid(48)], 'a real project folder is read');
  const elsewhere = tmp('linked-project');
  put(path.join(elsewhere, newId + '.jsonl'), claudeLine('C:\\work\\elsewhere'), t);
  fs.rmSync(proj, { recursive: true, force: true });
  fs.symlinkSync(elsewhere, proj, 'junction');
  t += 15 * S;
  assert.equal(byId(await records.scan())[newId], undefined, 'the tick does not follow the swapped-in link');
});

test('GPT 검수 be9 GA1: a year folder swapped for a link is not followed through the remembered folders below it, nor after the root comes back', async () => {
  let t = Date.now();
  const root = tmp('codex-swap');
  const elsewhere = tmp('codex-elsewhere');
  const day = d => path.join(d, '2026', '11', '21');
  const name = n => `rollout-2026-11-21T09-00-00-${uuid(n)}.jsonl`;
  put(path.join(day(root), name(50)), codexMeta('C:\\work\\own'), t - 1000);
  const roots = { claude: [], codex: [root] };
  const records = createOfficeRecords({ roots, now: () => t });
  assert.ok(byId(await records.scan({ full: true, roots }))[uuid(50)], 'its own session is read');
  // 2026 폴더를 다른 곳을 가리키는 연결로 바꾼다. 그 아래에 같은 이름의 달 · 날 폴더와 새 기록이 있다
  put(path.join(day(elsewhere), name(51)), codexMeta('C:\\work\\elsewhere'), t);
  fs.rmSync(path.join(root, '2026'), { recursive: true, force: true });
  fs.symlinkSync(path.join(elsewhere, '2026'), path.join(root, '2026'), 'junction');
  t += 15 * S;
  assert.equal(byId(await records.scan({ roots }))[uuid(51)], undefined, 'the tick does not read through the link');
  // 폴더가 한 번 빠졌다가 2분 안에 돌아와도 같다
  t += 15 * S;
  await records.scan({ roots: { claude: [], codex: [] } });
  t += 15 * S;
  assert.equal(byId(await records.scan({ roots }))[uuid(51)], undefined, 'nor after the root comes back');
});

test('설계 검토 be9 고칠 것 1: just before reporting, the real place of the top is judged again; anything but false reports nothing from that folder', async () => {
  const t = Date.now();
  const dir = tmp('refuse-top');
  put(path.join(dir, 'projects', 'C--work-refuse', uuid(52) + '.jsonl'), claudeLine('C:\\work\\refuse'), t - 1000);
  const roots = { claude: [dir], codex: [] };
  const asked = [];
  for (const [answer, seen] of [[false, true], [true, false], [null, false], ['throw', false]]) {
    const refuse = async top => { asked.push(top); if (answer === 'throw') throw new Error('x'); return answer; };
    const records = createOfficeRecords({ roots, now: () => t, refuse });
    assert.equal(!!byId(await records.scan({ full: true }))[uuid(52)], seen, String(answer));
  }
  assert.ok(asked.every(a => a.toLowerCase() === fs.realpathSync.native(path.join(dir, 'projects')).toLowerCase()), 'it is asked about the real place of the top');
});

test('설계 검토 be9 고칠 것 2: a folder that fails once to stat keeps what was first seen of its sessions', async () => {
  let t = Date.now();
  const dir = tmp('forget-keep');
  const proj = path.join(dir, 'projects', 'C--work-keep');
  put(path.join(proj, uuid(53) + '.jsonl'), claudeLine('C:\\work\\keep'), t + 45 * M); // 앞날의 때
  let failOnce = false;
  const fsImpl = { ...fs, promises: { ...fs.promises, lstat: async p => {
    if (failOnce && path.resolve(p) === path.resolve(proj)) { failOnce = false; throw Object.assign(new Error('busy'), { code: 'EBUSY' }); }
    return fs.promises.lstat(p);
  } } };
  const records = createOfficeRecords({ fsImpl, roots: { claude: [dir], codex: [] }, now: () => t });
  assert.ok(byId(await records.scan({ full: true }))[uuid(53)]);
  failOnce = true;
  t += 15 * S;
  await records.scan(); // 틱: 프로젝트 폴더의 lstat이 한 번 실패한다
  t += 31 * M;
  assert.equal(byId(await records.scan({ full: true }))[uuid(53)], undefined, 'still quiet since it was first seen');
});

test('설계 검토 be9 고칠 것 3 · 보고 직전 확인: even when lstat follows links, a helper folder linked outside the top makes no session busy', async () => {
  const t = Date.now();
  const dir = tmp('layer-real');
  const other = tmp('layer-real-target');
  const id = uuid(54);
  put(path.join(dir, 'projects', 'C--work-layer', id + '.jsonl'), claudeLine('C:\\work\\layer'), t - 3 * H);
  put(path.join(other, 'agent-1.jsonl'), claudeLine('C:\\work\\other'), t - 1000);
  fs.mkdirSync(path.join(dir, 'projects', 'C--work-layer', id), { recursive: true });
  fs.symlinkSync(other, path.join(dir, 'projects', 'C--work-layer', id, 'subagents'), 'junction');
  // 연결을 알아보지 못하는 lstat(stat과 같다): 늘어놓기는 연결을 따라가고, 보고 직전 확인만 남는다
  const fsImpl = { ...fs, promises: { ...fs.promises, lstat: (...a) => fs.promises.stat(...a) } };
  const records = createOfficeRecords({ fsImpl, roots: { claude: [dir], codex: [] }, now: () => t });
  assert.equal(byId(await records.scan({ full: true }))[id], undefined, 'the real place check alone keeps it out');
});

test('설계 검토 be9 고칠 것 3 · 캐시 정리와 다시 늘어놓기: below a year folder swapped for a link nothing remembered is looked at again, and a root coming back is listed from the top', async () => {
  let t = Date.now();
  const root = tmp('layer-forget');
  const elsewhere = tmp('layer-forget-target');
  const day = d => path.join(d, '2026', '11', '21');
  put(path.join(day(root), `rollout-2026-11-21T09-00-00-${uuid(55)}.jsonl`), codexMeta('C:\\work\\own'), t - 1000);
  put(path.join(day(elsewhere), `rollout-2026-11-21T09-00-00-${uuid(56)}.jsonl`), codexMeta('C:\\work\\elsewhere'), t - 1000);
  const touched = [];
  const wrap = name => (...a) => { touched.push([name, path.resolve(String(a[0]))]); return fs.promises[name](...a); };
  const fsImpl = { promises: { stat: wrap('stat'), lstat: wrap('lstat'), readdir: wrap('readdir'), open: (...a) => fs.promises.open(...a), realpath: (...a) => fs.promises.realpath(...a) } };
  const roots = { claude: [], codex: [root] };
  const records = createOfficeRecords({ fsImpl, roots, now: () => t });
  assert.ok(byId(await records.scan({ full: true, roots }))[uuid(55)]);
  fs.rmSync(path.join(root, '2026'), { recursive: true, force: true });
  fs.symlinkSync(path.join(elsewhere, '2026'), path.join(root, '2026'), 'junction');
  touched.length = 0;
  t += 15 * S;
  await records.scan({ roots });
  const below = path.join(root, '2026') + path.sep;
  assert.deepEqual(touched.filter(([, p]) => p.startsWith(below)), [], 'the month and day folders and the session file below the link are not looked at again');
  // 폴더가 빠졌다가 2분 안에 돌아오면 맨 위부터 다시 늘어놓는다
  t += 15 * S;
  await records.scan({ roots: { claude: [], codex: [] } });
  touched.length = 0;
  t += 15 * S;
  await records.scan({ roots });
  assert.ok(touched.some(([name, p]) => name === 'readdir' && p === path.resolve(root)), 'the top is listed again');
});

test('GPT 검수 be8 GA1: a folder left out of one scan keeps what was seen in it — an unchanged file dated ahead stays dropped when the folder comes back', async () => {
  let t = Date.now();
  const dir = tmp('rest-root');
  const id = uuid(45);
  put(path.join(dir, 'projects', 'C--work-rest', id + '.jsonl'), claudeLine('C:\\work\\rest'), t + 45 * M);
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  const roots = { claude: [dir], codex: [] };
  assert.equal(byId(await records.scan({ full: true, roots }))[id].changedAt, t);
  t += 1 * M;
  assert.deepEqual(await records.scan({ full: true, roots: { claude: [], codex: [] } }), [], 'the folder is left out for one scan');
  t += 30 * M;
  assert.equal(byId(await records.scan({ full: true, roots }))[id], undefined, 'back again: still quiet since it was first seen');
});

test('GPT 검수 be7 GA3: helper lists that differ are told apart whatever their file names hold', async () => {
  let t = Date.now();
  const dir = tmp('future-names');
  const id = uuid(44);
  put(path.join(dir, 'projects', 'C--work-names', id + '.jsonl'), claudeLine('C:\\work\\names'), t + 45 * M);
  const subs = path.join(dir, 'projects', 'C--work-names', id, 'subagents');
  put(path.join(subs, 'a.jsonl'), claudeLine('C:\\work\\names'), 100);
  put(path.join(subs, 'b.jsonl'), claudeLine('C:\\work\\names'), 200);
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  assert.equal(byId(await records.scan({ full: true }))[id].changedAt, t);
  t += 31 * M;
  assert.equal(byId(await records.scan({ full: true }))[id], undefined, 'quiet for 30 minutes: dropped');
  // 두 도우미 파일을 이름에 구분 글자가 든 파일 하나로 바꾼다
  fs.rmSync(path.join(subs, 'a.jsonl'));
  fs.rmSync(path.join(subs, 'b.jsonl'));
  put(path.join(subs, 'a.jsonl=100,b.jsonl'), claudeLine('C:\\work\\names'), 200);
  assert.ok(byId(await records.scan({ full: true }))[id], 'a different helper list is news');
});

test('GPT 검수 be4 GA13: an unchanged file dated 45 minutes ahead stays dropped when the clock reaches that time', async () => {
  let t = Date.now();
  const dir = tmp('future-near');
  put(path.join(dir, 'projects', 'C--work-near', uuid(42) + '.jsonl'), claudeLine('C:\work\near'), t + 45 * M);
  const records = createOfficeRecords({ roots: { claude: [dir], codex: [] }, now: () => t });
  const seen = t;
  assert.equal(byId(await records.scan({ full: true }))[uuid(42)].changedAt, seen);
  t += 31 * M;
  assert.equal(byId(await records.scan())[uuid(42)], undefined, 'quiet for 30 minutes: dropped');
  t += 15 * M; // 지금이 파일의 고친 때를 지났다
  assert.equal(byId(await records.scan())[uuid(42)], undefined, 'the same file does not come back as news');
  assert.equal(byId(await records.scan({ full: true }))[uuid(42)], undefined, 'nor in a full listing');
});
