'use strict';
// 첫 보호 범위(STAGE1_DESIGN.md 4.17): 진단 결과로 지킬 폴더를 고르는 규칙, 계획기로 센 크기로 넣기를 정하는 규칙, 범위 파일과
// 넣기 · 빼기 · 추가 보호, 「보호 시작」에 넘길 폴더. 진단과 계획기는 가짜 실행기로 갈아 끼운다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FirstRange, pickRange, decide, totals, homeProjects, GB } = require('../src/first-range.cjs');

const cand = (raw, category, evidence, bytes = 0, { state = 'present', incomplete = [], files = 10 } = {}) =>
  ({ path: { raw, display: raw, lossy: false }, category, evidence: [].concat(evidence), state, configured_coverage: 'none', stats: { files, logical_bytes: bytes, extensions: {}, incomplete, excluded: [] } });
const P = 'C:\\Users\\kim';
const known = (name, bytes, more = {}) => cand(`${P}\\${name}`, 'irreplaceable', `known_folder_${name}`, bytes, more);
const inventory = (candidates, complete = true) => ({ schema_version: 1, scan_complete: complete, candidates });
const measured = (rows, sizes = {}) => rows.map((r) => ({ ...r, measured: true, partial: false, ...(sizes[path.win32.basename(r.path)] !== undefined ? { bytes: sizes[path.win32.basename(r.path)] } : {}) }));
const byName = (rows) => Object.fromEntries(rows.map((r) => [path.win32.basename(r.path), r]));

test('범위 고르기: 알려진 폴더, 찾아낸 작업 폴더, AI 폴더, 넣지 않는 자리', () => {
  const inv = inventory([
    known('Desktop', 1 * GB), known('Documents', 30 * GB), known('Pictures', 2 * GB), known('Downloads', 25 * GB), known('Music', 1 * GB), known('Videos', 3 * GB),
    // 문서 안의 프로젝트는 따로 세우지 않고, 큰 것은 「가장 큰 안쪽 폴더」로만 보인다
    cand(`${P}\\Documents\\big-repo`, 'irreplaceable', 'git_marker_name_only', 12 * GB),
    cand('D:\\work\\app', 'irreplaceable', 'git_marker_name_only', 3 * GB),
    cand('D:\\work\\app\\sub', 'irreplaceable', 'project_manifest_name_only', 1 * GB),
    cand('D:\\SD\\models', 'irreplaceable', 'ai_directory_name_hint', 90 * GB),
    // 숨은 폴더 · AppData · 로그인 자리 · 다시 만들 수 있는 것 안은 넣지 않는다
    cand(`${P}\\.claude\\projects\\x`, 'irreplaceable', 'git_marker_name_only', 1),
    cand(`${P}\\AppData\\Roaming\\tool\\repo`, 'irreplaceable', 'git_marker_name_only', 1),
    cand('D:\\keys', 'credential_location', 'sensitive_directory_name_hint', 1),
    cand('D:\\keys\\proj', 'irreplaceable', 'git_marker_name_only', 1),
    cand('D:\\work\\app\\node_modules', 'regenerable', 'node_modules_with_package_json', 9 * GB),
    // AI 도구 폴더는 빼 둔 줄로, 다른 설정 폴더는 아예 넣지 않는다
    cand(`${P}\\.claude`, 'ai_settings', 'known_ai_or_developer_location', 24 * GB, { incomplete: ['global_scan_limit'] }),
    cand(`${P}\\.config`, 'ai_settings', 'known_ai_or_developer_location', 1),
    cand(`${P}\\AppData\\Roaming\\Claude`, 'ai_settings', 'known_application_settings', 1),
    cand(`${P}\\.ssh`, 'credential_location', 'known_sensitive_location_metadata_only', 1),
    // 엔진 폴더와 겹치는 것은 넣지 않는다
    cand('E:\\SynkWorkBackup\\proj', 'irreplaceable', 'git_marker_name_only', 1),
  ]);
  const r = pickRange(inv, { forbidden: ['E:\\SynkWorkBackup'] });
  const kinds = r.folders.map((f) => `${f.kind}:${path.win32.basename(f.path)}`);
  assert.deepEqual(kinds, ['desktop:Desktop', 'documents:Documents', 'work:app', 'pictures:Pictures', 'downloads:Downloads', 'music:Music', 'videos:Videos', 'aitool:.claude', 'ai:models']);
  assert.equal(byName(r.folders).Documents.inner.name, 'big-repo');
  assert.equal(byName(r.folders)['.claude'].partial, true);
  // 넣기는 계획기가 센 뒤에 정한다 — 세기 전에는 작은 것만 넣는 무리가 「세는 중」이다
  const before = byName(decide(r.folders));
  assert.equal(before.Desktop.on, true); assert.equal(before.Documents.on, true);
  assert.equal(before.Pictures.on, false); assert.equal(before.Pictures.why, 'measuring');
  const d = byName(decide(measured(r.folders)));
  assert.deepEqual([d.app.on, d.Pictures.on, d.Music.on, d.Videos.on], [true, true, true, true]);
  assert.deepEqual([d.Downloads.on, d.Downloads.why], [false, 'big']);
  assert.deepEqual([d['.claude'].why, d.models.why], ['aitool', 'ai']);
});

test('넣기 규칙: 바탕화면 · 문서는 예산을 넘어도 넣고, 작은 것만 넣는 무리는 80GB 예산과 다 센 크기로 정한다', () => {
  const r = pickRange(inventory([known('Desktop', 0), known('Documents', 75 * GB), known('Pictures', 3 * GB), known('Music', 3 * GB), known('Videos', 1 * GB)]));
  const d = byName(decide(measured(r.folders)));
  assert.equal(d.Documents.on, true);
  // 작은 것부터 채운다: 동영상 1GB(76) → 사진 3GB(79) → 음악은 예산을 넘는다
  assert.deepEqual([d.Videos.on, d.Pictures.on, d.Music.on, d.Music.why], [true, true, false, 'budget']);
  // 문서만으로 예산을 넘어도 문서는 넣는다(하던 작업의 중심)
  const big = byName(decide(measured(pickRange(inventory([known('Documents', 140 * GB), known('Pictures', 1 * GB)])).folders)));
  assert.deepEqual([big.Documents.on, big.Pictures.why], [true, 'budget']);
  // 손님이 큰 문서를 빼면 예산이 비어 작은 폴더가 들어오고, 손님이 넣은 큰 줄은 예산을 먼저 쓴다(11-25 실측 — 문서 350GB 넘는 PC)
  const huge = pickRange(inventory([known('Documents', 350 * GB), known('Pictures', 1 * GB), known('Videos', 30 * GB)])).folders;
  const docs = `${P}\\Documents`.toLowerCase(), vids = `${P}\\Videos`.toLowerCase();
  assert.deepEqual(Object.values(byName(decide(measured(huge)))).map((r) => [r.kind, r.on, r.why]), [['documents', true, null], ['pictures', false, 'budget'], ['videos', false, 'big']]);
  assert.deepEqual(Object.values(byName(decide(measured(huge), { [docs]: false }))).map((r) => [r.kind, r.on, r.why]), [['documents', false, 'user'], ['pictures', true, null], ['videos', false, 'big']]);
  assert.deepEqual(Object.values(byName(decide(measured(huge), { [docs]: false, [vids]: true }))).map((r) => [r.kind, r.on]), [['documents', false], ['pictures', true], ['videos', true]]);
  // 다 세지 못한 크기(하한)로는 넣지 않는다(Fable F2)
  const unsure = decide(pickRange(inventory([known('Videos', 6 * GB)])).folders.map((f) => ({ ...f, measured: true, partial: true })));
  assert.deepEqual([unsure[0].on, unsure[0].why], [false, 'unsure']);
  // 합: 넣은 것만, 서로 품으면 바깥 것만
  const t = totals([{ path: 'D:\\a', on: true, bytes: 5, files: 1, measured: true }, { path: 'D:\\a\\b', on: true, bytes: 3, files: 1, measured: true }, { path: 'D:\\c', on: false, bytes: 9, measured: true }]);
  assert.deepEqual(t, { bytes: 5, files: 1, partial: false, count: 1 });
});

test('범위 고르기: 드라이브 전체로 옮긴 알려진 폴더, 겹친 알려진 폴더, 24곳 상한과 부모 묶기', () => {
  // 사진이 문서 안에 있어도 두 줄을 다 둔다(합은 바깥 것만 센다, GPT GA4). 드라이브 전체인 폴더는 넣지 않고 까닭을 보인다(Fable F11)
  const r = pickRange(inventory([known('Documents', 1), cand(`${P}\\Documents\\Pictures`, 'irreplaceable', 'known_folder_Pictures', 1), cand('D:\\', 'irreplaceable', 'known_folder_Videos', 1)]));
  assert.deepEqual(r.folders.map((f) => [f.kind, f.why]), [['documents', null], ['pictures', null], ['videos', 'whole']]);
  assert.equal(decide(r.folders)[2].on, false);
  assert.equal(totals(decide(measured(r.folders))).count, 1);
  // 큰 다운로드(D:\Data)가 문서(D:\Data\Documents)를 품어도 다운로드가 빠질 때 문서는 남는다(GA4)
  const nest = byName(decide(measured(pickRange(inventory([cand('D:\\Data', 'irreplaceable', 'known_folder_Downloads', 30 * GB), cand('D:\\Data\\Documents', 'irreplaceable', 'known_folder_Documents', 2 * GB)])).folders)));
  assert.deepEqual([nest.Data.on, nest.Data.why, nest.Documents.on], [false, 'big', true]);
  // 넣지 않는 드라이브 전체 줄은 같은 드라이브의 작업 폴더를 가리지 않는다(GA4)
  const drive = pickRange(inventory([known('Documents', 1), cand('D:\\', 'irreplaceable', 'known_folder_Downloads', 1), cand('D:\\work\\app', 'irreplaceable', 'git_marker_name_only', 1)]));
  assert.ok(drive.folders.some((f) => f.kind === 'work' && f.path === 'D:\\work\\app'));
  // 작업 폴더 안의 로그인 폴더는 그 작업 폴더를 막지 않는다 — 백업이 이름으로 뺀다(GA2)
  assert.ok(pickRange(inventory([cand('D:\\work\\app', 'irreplaceable', 'git_marker_name_only', 1), cand('D:\\work\\app\\.ssh', 'credential_location', 'sensitive_directory_name_hint', 1)])).folders.some((f) => f.path === 'D:\\work\\app'));
  // 작업 폴더가 넘치면 같은 부모로 묶는다. 묶은 부모의 크기는 계획기가 센 뒤에 정한다(F13)
  const many = Array.from({ length: 30 }, (_, i) => cand(`D:\\repos\\p${i}`, 'irreplaceable', 'git_marker_name_only', 1 * GB));
  const g = pickRange(inventory([known('Documents', 1), ...many]));
  const parent = g.folders.find((f) => f.path === 'D:\\repos');
  assert.ok(parent && parent.grouped === 30 && parent.bytes === null);
  assert.ok(g.folders.length <= 24);
  assert.equal(byName(decide(g.folders)).repos.why, 'measuring');
  // 로그인 자리를 품는 부모로는 묶지 않는다 — 그러면 남는 작업 폴더는 목록에서 덜어 「더 찾은 폴더」로 센다. node_modules는 묶기를 막지 않는다
  assert.ok(pickRange(inventory([known('Documents', 1), ...many, cand('D:\\repos\\p0\\node_modules', 'regenerable', 'node_modules_with_package_json', 1)])).folders.some((f) => f.path === 'D:\\repos'));
  const mixed = pickRange(inventory([known('Documents', 1), ...many, cand('D:\\repos\\keys', 'credential_location', 'sensitive_directory_name_hint', 1)]));
  assert.ok(!mixed.folders.some((f) => f.path === 'D:\\repos'));
  assert.ok(mixed.folders.length <= 24 && mixed.more > 0);
});

async function sandbox() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'swb-range-'));
  const home = path.join(base, 'home');
  for (const d of ['Desktop', 'Documents', 'Pictures', 'Videos', '.claude', '.ssh', 'code\\app', 'notes']) await fs.mkdir(path.join(home, d), { recursive: true });
  await fs.writeFile(path.join(home, 'code', 'app', 'package.json'), '{}');
  const state = path.join(base, 'state'); await fs.mkdir(state);
  return { base, home, state };
}
/** 가짜 진단: --output 폴더에 inventory.json을 쓴다. 가짜 계획기: 폴더 이름마다 정한 크기 */
function fakeExec({ home, sizes = {}, fail = false, calls = [], hold = null, skip = [] }) {
  return async (exe, args, opts) => {
    calls.push(path.basename(exe));
    if (exe.endsWith('inv.exe')) {
      if (fail) throw Object.assign(new Error('boom'), { exitCode: 1 });
      const out = args[args.indexOf('--output') + 1];
      await fs.mkdir(out);
      // skip: 이번 진단이 놓친 폴더 이름(시간 제한 따위)
      await fs.writeFile(path.join(out, 'inventory.json'), JSON.stringify(inventory([
        cand(path.join(home, 'Desktop'), 'irreplaceable', 'known_folder_Desktop', 1),
        cand(path.join(home, 'Documents'), 'irreplaceable', 'known_folder_Documents', 1),
        cand(path.join(home, 'Pictures'), 'irreplaceable', 'known_folder_Pictures', 1),
        cand(path.join(home, 'Videos'), 'irreplaceable', 'known_folder_Videos', 1),
        cand(path.join(home, '.claude'), 'ai_settings', 'known_ai_or_developer_location', 1),
      ].filter((c) => !skip.includes(path.basename(c.path.raw))))));
      await fs.writeFile(path.join(out, 'backup-plan.txt'), 'paths');
      return '{}';
    }
    const name = path.basename(opts.input.sources[0]);
    if (hold) await hold;
    if (sizes[name] === 'fail') throw new Error('timeout');
    return JSON.stringify({ schema: 1, complete: true, sources: opts.input.sources, files: 3, bytes: sizes[name] ?? 1024, databases: 0, exclusions: [], errors: [] });
  };
}
const settle = async (r) => { for (let i = 0; i < 200 && (r.finding || r.active || r.queue.length); i++) { await r.finding; await new Promise((x) => setTimeout(x, 5)); } };

test('범위 찾기: 진단 뒤 계획기로 줄마다 세고, 보고서 폴더를 지우고, 사용자 폴더 맨 위 프로젝트를 더한다', async () => {
  const { base, home, state } = await sandbox();
  const calls = [];
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, sizes: { Videos: 30 * GB }, calls }), home, forbidden: () => [state] });
  await r.open();
  assert.equal(r.stale(), true);
  const finding = r.find();
  assert.equal(r.state().status, 'scanning');
  assert.equal(r.find(), finding, '도는 진단은 하나뿐이다');
  await settle(r);
  const s = r.state();
  assert.equal(s.status, 'ready');
  const f = byName(s.folders);
  assert.deepEqual([f.Desktop.on, f.Documents.on, f.Pictures.on], [true, true, true]);
  assert.deepEqual([f.Videos.on, f.Videos.why], [false, 'big']);
  assert.deepEqual([f['.claude'].on, f['.claude'].why], [false, 'aitool']);
  // 사용자 폴더 맨 위의 프로젝트(code)는 사용자 폴더가 어디에 놓였든 찾는다(GA15)
  assert.deepEqual([f.code.kind, f.code.on], ['work', true]);
  // 넣기를 정하는 줄(바탕화면 · 문서 · 사진 · 동영상 · code)은 계획기로 세고, 빼 둔 AI 도구 폴더는 세지 않는다
  assert.equal(calls.filter((c) => c === 'plan.exe').length, 5);
  assert.equal(s.complete, true);
  assert.deepEqual((await fs.readdir(state)).filter((n) => n.startsWith('range-scan-')), [], '진단 보고서 폴더는 읽은 뒤 지운다');
  assert.equal(r.stale(), false);
  // 범위 파일에는 경로가 있고 엔진 상태 폴더에만 있다
  assert.match(await fs.readFile(path.join(state, 'range.json'), 'utf8'), /Documents/);
  // 「보호 시작」에 넘길 폴더: 넣은 줄의 실제 경로
  assert.deepEqual((await r.sources()).map((p) => path.basename(p)).sort(), ['Desktop', 'Documents', 'Pictures', 'code']);
  assert.equal(r.blocker(), null);
  await fs.rm(base, { recursive: true, force: true });
});

test('넣기 · 빼기 · 추가 보호와 다시 찾기: 손님이 바꾼 것은 다시 찾아도 남는다', async () => {
  const { base, home, state } = await sandbox();
  const extra = path.join(base, 'extra'); await fs.mkdir(path.join(extra, 'inner'), { recursive: true });
  let now = Date.parse('2026-11-25T03:00:00Z');
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, sizes: { extra: 2 * GB, '.claude': 3 * GB } }), home, forbidden: () => [state], now: () => now });
  await r.open(); await r.find(); await settle(r);
  await r.set(path.join(home, 'Pictures'), false);
  await r.set(path.join(home, '.claude'), true);
  await settle(r);
  let f = byName(r.state().folders);
  assert.deepEqual([f.Pictures.on, f.Pictures.why], [false, 'user']);
  assert.deepEqual([f['.claude'].on, f['.claude'].bytes, f['.claude'].measured], [true, 3 * GB, true], '빼 둔 AI 도구 폴더는 넣을 때 센다');
  // 추가 보호: 더한 폴더는 넣음으로, 크기는 뒤에서 센다. 이미 넣은 폴더 안 · 드라이브 전체 · 엔진 폴더 · 로그인 자리는 거절한다
  const added = await r.add([extra, path.join(home, 'Documents'), state, 'C:\\', path.join(home, '.ssh')]);
  assert.deepEqual(added.skipped.map((x) => x.why), ['inside', 'engine', 'drive', 'login']);
  await settle(r);
  f = byName(r.state().folders);
  assert.deepEqual([f.extra.kind, f.extra.on, f.extra.bytes], ['added', true, 2 * GB]);
  // 더한 폴더 안의 폴더는 「이미 지키는 폴더 안」이다
  assert.equal((await r.add([path.join(extra, 'inner')])).skipped[0].why, 'inside');
  // 하루 뒤 다시 찾아도 손님이 바꾼 것과 더한 폴더는 남는다
  now += 2 * 86400000;
  assert.equal(r.stale(), true);
  await r.find(); await settle(r);
  f = byName(r.state().folders);
  assert.deepEqual([f.Pictures.on, f['.claude'].on, f.extra.on], [false, true, true]);
  // 창을 다시 열어도 범위 파일에서 이어진다
  const again = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home }), home, forbidden: () => [state], now: () => now });
  await again.open();
  assert.equal(again.state().status, 'ready');
  assert.deepEqual(byName(again.state().folders).extra.on, true);
  // 그사이 없어진 폴더가 있으면 시작하지 않고 그 줄을 「찾을 수 없어 빼 둠」으로 보인다. 손님이 뺀 것으로 적지 않는다(GA13 · Fable F5)
  await fs.rm(extra, { recursive: true });
  await assert.rejects(again.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual([byName(again.state().folders).extra.on, byName(again.state().folders).extra.why], [false, 'gone']);
  assert.equal(again.data.choices[Object.keys(again.data.choices).find((k) => k.endsWith('\\extra'))], true);
  assert.ok(!(await again.sources()).some((p) => path.basename(p) === 'extra'), '다시 누르면 나머지로 시작한다');
  // 다시 생기기 전에는 넣지 못하고, 다시 생기면 넣는다
  await assert.rejects(again.set(extra, true), { code: 'RANGE_GONE' });
  await fs.mkdir(extra);
  await again.set(extra, true);
  assert.equal(byName(again.state().folders).extra.on, true);
  await fs.rm(base, { recursive: true, force: true });
});

test('GPT 검수(GA3 · GA6 · GA7 · GA11): 빼 둔 줄 더하기, 진단이 놓친 줄, 더한 줄 다시 세기, 닫는 중', async () => {
  const { base, home, state } = await sandbox();
  const extra = path.join(base, 'extra'); await fs.mkdir(extra);
  let now = Date.parse('2026-11-25T03:00:00Z');
  const sizes = { Videos: 200 * GB, extra: 2 * GB }, skip = [];
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, sizes, skip }), home, forbidden: () => [state], now: () => now });
  await r.open(); await r.find(); await settle(r);
  // GA3: 커서 빼 둔 동영상을 「추가 보호」로 고르면 그 줄을 넣는다 — 센 200GB가 합에 들어 시작을 막는다
  assert.equal(byName(r.state().folders).Videos.why, 'big');
  await r.add([path.join(home, 'Videos')]); await settle(r);
  assert.equal(r.data.added.length, 0);
  assert.deepEqual([byName(r.state().folders).Videos.on, byName(r.state().folders).Videos.bytes], [true, 200 * GB]);
  assert.equal(r.blocker(), 'RANGE_TOO_BIG');
  await r.set(path.join(home, 'Videos'), false);
  // GA6: 손님이 넣은 AI 도구 폴더를 다음 진단이 놓쳐도 그 줄은 남는다
  await r.set(path.join(home, '.claude'), true); await settle(r);
  // GA7: 더한 폴더도 다음 날 다시 센다
  await r.add([extra]); await settle(r);
  assert.equal(byName(r.state().folders).extra.bytes, 2 * GB);
  sizes.extra = 40 * GB; skip.push('.claude'); now += 2 * 86400000;
  await r.find(); await settle(r);
  const f = byName(r.state().folders);
  assert.deepEqual([f['.claude'].on, f['.claude'].kind], [true, 'aitool']);
  assert.equal(f.extra.bytes, 40 * GB);
  // GA11: 진단 폴더를 만드는 사이 창을 닫으면 진단을 띄우지 않는다
  const calls = [];
  const closing = new FirstRange({ root: path.join(base, 'state2'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, calls }), home });
  const p = closing.find(); await closing.stop(); await p;
  assert.deepEqual(calls, []);
  assert.equal(closing.state().status, 'idle');
  await fs.rm(base, { recursive: true, force: true });
});

test('GPT 검수(GA5 · GA8): 넣은 줄 안의 줄은 손님이 뺐어도 「함께 지킵니다」로 보이고, 넣은 곳이 30곳을 넘으면 저절로 넣은 줄을 뺀다', () => {
  const r = new FirstRange({ root: 'C:\\x\\state', inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: async () => '{}', home: 'C:\\Users\\kim' });
  const m = (p, kind, bytes) => ({ path: p, kind, bytes, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0 });
  r.data = { v: 2, at: '2026-11-25T03:00:00Z', complete: true, failed: null, more: 0, folders: [m('D:\\Saved\\Documents', 'documents', 1 * GB)],
    added: [{ path: 'D:\\Saved', bytes: 3 * GB, files: 1, partial: false, measured: true }], choices: { 'd:\\saved\\documents': false, 'd:\\saved': true } };
  const docs = byName(r.folders()).Documents;
  assert.deepEqual([docs.on, docs.within, docs.why], [true, 'D:\\Saved', null]);
  assert.deepEqual(totals(r.folders()), { bytes: 3 * GB, files: 1, partial: false, count: 1 });
  // 저절로 넣은 작업 폴더 24곳 + 더한 폴더 7곳 = 31곳 → 저절로 넣은 줄 하나를 빼 둔다
  r.data = { ...r.data, folders: Array.from({ length: 24 }, (_, i) => m(`D:\\w${i}`, 'work', (i + 1) * 100)), added: Array.from({ length: 7 }, (_, i) => ({ path: `E:\\a${i}`, bytes: 1, files: 1, partial: false, measured: true })), choices: {} };
  const list = r.folders();
  assert.equal(totals(list).count, 30);
  assert.deepEqual(list.filter((x) => x.why === 'full').map((x) => x.path), ['D:\\w23']);
});

test('GPT 다시 검수(GA2 · GA3 · GA4 · GA5): 다시 넣기의 30곳 검사, 빼 둔 바깥 줄 더하기, 없어진 줄 안의 줄, 손님 줄만으로 30곳 넘김', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'swb-range2-'));
  const dir = async (...p) => { const d = path.join(base, ...p); await fs.mkdir(d, { recursive: true }); return fs.realpath(d); };
  const r = new FirstRange({ root: path.join(base, 'state'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: async () => '{}', home: path.join(base, 'home') });
  const add = (p) => ({ path: p, bytes: 1, files: 1, partial: false, measured: true });
  const blank = () => ({ v: 2, at: '2026-11-25T03:00:00Z', complete: true, failed: null, more: 0, folders: [], added: [], choices: {} });
  // GA2: 없어져 빼 둔 줄을 다시 넣다가 30곳에 걸리면 빼 둔 채 남는다
  const g = await dir('g'), thirty = []; for (let i = 0; i < 30; i++) thirty.push(await dir(`d${i}`));
  r.data = { ...blank(), added: [add(g), ...thirty.map(add)] };
  r.gone.add(g.toLowerCase());
  await assert.rejects(r.set(g, true), { code: 'RANGE_FULL' });
  assert.equal(byName(r.folders()).g.why, 'gone');
  assert.equal(totals(r.folders()).count, 30);
  // GA5: 손님이 넣은 줄만으로 30곳을 넘으면(빼 둔 줄을 손으로 되살림 따위) 시작을 막는다
  r.gone.clear();
  assert.equal(totals(r.folders()).count, 31);
  assert.equal(r.blocker(), 'RANGE_FULL');
  // GA3: 커서 빼 둔 바깥 줄을 「추가 보호」로 고르면 그 안의 더한 줄은 걷는다
  const dl = await dir('Downloads'), a = await dir('Downloads', 'a'), b = await dir('Downloads', 'b');
  r.data = { ...blank(), folders: [{ path: dl, kind: 'downloads', bytes: 30 * GB, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0 }], added: [add(a), add(b)] };
  await r.add([dl]);
  assert.deepEqual([r.data.added.length, byName(r.folders()).Downloads.on], [0, true]);
  // GA4: 뽑은 드라이브의 바깥 줄이 없어지면 그 안의 넣은 줄(문서)도 함께 빼 두어, 다시 누르면 남은 줄로 시작한다
  const ext = await dir('E'), docs = await dir('E', 'Documents'), keep = await dir('keep');
  r.data = { ...blank(), folders: [{ path: docs, kind: 'documents', bytes: 1, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0 }], added: [add(ext), add(keep)] };
  r.gone.clear();
  await fs.rm(ext, { recursive: true });
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual([byName(r.folders()).E.why, byName(r.folders()).Documents.why], ['gone', 'gone']);
  assert.deepEqual((await r.sources()).map((p) => path.basename(p)), ['keep']);
  // r3 GA2: 바깥 폴더만 목록 권한이 막히고 안쪽 문서는 열리면, 문서는 빼 두지 않고 따로 넘긴다
  const outer = await dir('F'), inner = await dir('F', 'Documents');
  r.data = { ...blank(), folders: [{ path: inner, kind: 'documents', bytes: 1, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0 }], added: [add(outer)] };
  r.gone.clear();
  const opens = r.opens.bind(r);
  r.opens = async (p) => { if (p.toLowerCase() === outer.toLowerCase()) throw Object.assign(new Error('denied'), { code: 'EPERM' }); return opens(p); };
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual([byName(r.folders()).F.why, byName(r.folders()).Documents.on], ['gone', true]);
  assert.deepEqual((await r.sources()).map((p) => path.basename(p)), ['Documents']);
  // r3 GA3 · Fable 설계 검토 자리 2: 손님이 고른 줄로 30곳이 차면 작은 무리는 「30곳이 다 차서」로 빠지지만 바탕화면 · 문서는 빠지지 않고,
  // 「보호 시작」이 RANGE_FULL로 멈춰 손님이 고른다(문서 없는 백업이 「지키는 중」으로 가지 않게)
  const desk = await dir('Desktop'), pics = await dir('Pictures'), mine = []; for (let i = 0; i < 30; i++) mine.push(await dir(`m${i}`));
  r.opens = opens;
  const row2 = (p, kind) => ({ path: p, kind, bytes: 1, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0 });
  r.data = { ...blank(), folders: [row2(desk, 'desktop'), row2(inner, 'documents'), row2(pics, 'pictures')], added: mine.map(add) };
  const full = byName(r.folders());
  assert.deepEqual([full.Desktop.on, full.Documents.on, full.Pictures.why, totals(r.folders()).count, r.blocker()], [true, true, 'full', 32, 'RANGE_FULL']);
  // 자리 2: 없어져 빼 둔 줄을 30곳이 찬 뒤 「추가 보호」로 다시 고르면 30곳에 걸리고 빼 둔 채 남는다
  const back = await dir('back');
  r.data = { ...blank(), added: [add(back), ...mine.map(add)] };
  r.gone.clear(); r.gone.add(back.toLowerCase());
  const again = await r.add([back]);
  assert.deepEqual([again.skipped[0].why, byName(r.folders()).back.why, totals(r.folders()).count], ['full', 'gone', 30]);
  // 자리 1: node_modules 안 · 로그인 폴더는 「추가 보호」로도 받지 않는다(빈 폴더로 성공하므로)
  r.data = blank();
  const nm = await dir('proj', 'node_modules', 'myfork'), aws = await dir('work', '.aws');
  assert.deepEqual((await r.add([nm, aws])).skipped.map((x) => x.why), ['rebuild', 'login']);
  await fs.rm(base, { recursive: true, force: true });
});

test('빼기 규칙 한 곳(engine.cjs, Fable 설계 검토 자리 1): 채움 목록 거르기와 지킬 폴더로 받지 않는 자리', () => {
  const { inSkippedDir, skippedPlace, refuseSkipped } = require('../src/engine.cjs');
  // 채움 목록: node_modules는 그 폴더 안의 것만, 로그인 이름은 어느 마디든
  assert.deepEqual([inSkippedDir('D:\\w\\fixtures\\node_modules'), inSkippedDir('D:\\w\\node_modules\\a.js'), inSkippedDir('D:\\w\\.ssh\\id'), inSkippedDir('D:\\w\\.aws'), inSkippedDir('D:\\w\\my node_modules notes\\a.txt')], [false, true, true, true, false]);
  // 지킬 폴더: 어느 마디(마지막 포함)가 node_modules이거나 로그인 이름이면 받지 않는다
  assert.deepEqual([skippedPlace('D:\\p\\node_modules\\myfork'), skippedPlace('C:\\Users\\kim\\node_modules'), skippedPlace('D:\\work\\.aws'), skippedPlace('D:\\work\\.ssh\\keys'), skippedPlace('D:\\work\\node_modules_notes'), skippedPlace('D:\\work')], [true, true, true, true, false, false]);
  assert.throws(() => refuseSkipped(['D:\\work', 'D:\\p\\node_modules\\x']), { code: 'SOURCES_SKIPPED' });
  assert.deepEqual(refuseSkipped(['D:\\work']), ['D:\\work']);
  // 진단이 찾은 node_modules 안의 프로젝트는 줄로 세우지 않는다
  assert.ok(!pickRange(inventory([cand('D:\\p\\node_modules\\pkg', 'irreplaceable', 'project_manifest_name_only', 1), cand('D:\\work\\app', 'irreplaceable', 'git_marker_name_only', 1)])).folders.some((f) => /node_modules/.test(f.path)));
});

test('진단이 실패하면 「다 읽지 못했습니다」로 두고 추가 보호로 고른다 · 1.5배를 넘거나 세는 중이면 시작을 막는다', async () => {
  const { base, home, state } = await sandbox();
  let release; const hold = new Promise((y) => { release = y; });
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, fail: true, sizes: { Documents: 200 * GB }, hold }), home, forbidden: () => [state] });
  await r.open(); await r.find(); await settle(r);
  assert.equal(r.state().status, 'failed');
  assert.match(r.state().error, /다 읽지 못했습니다/);
  assert.equal(r.state().complete, null, '진단 결과가 없으면 다 읽었는지 모른다(GA14)');
  assert.equal(await r.sources(), null, '넣은 폴더가 없으면 워커가 다른 길의 폴더를 쓴다');
  assert.equal(r.stale(), true, '실패한 범위는 다음에 창이 열릴 때 다시 찾는다');
  await r.add([path.join(home, 'Documents')]);
  // 더한 폴더를 세는 동안은 막는다
  assert.deepEqual([r.state().status, r.state().measuring, r.blocker()], ['failed', true, 'RANGE_BUSY']);
  release(); await settle(r);
  assert.equal(r.state().total.bytes, 200 * GB);
  assert.equal(r.blocker(), 'RANGE_TOO_BIG');
  await fs.rm(base, { recursive: true, force: true });
});

test('사용자 폴더 맨 위의 프로젝트: 그 폴더나 바로 아래에 프로젝트 표시가 있으면 낸다(Fable F9)', async () => {
  const { base, home } = await sandbox();
  await fs.mkdir(path.join(home, 'repo-top', '.git'), { recursive: true });
  await fs.mkdir(path.join(home, 'AppData', 'x', '.git'), { recursive: true });
  await fs.mkdir(path.join(home, 'OneDrive', 'p', '.git'), { recursive: true });
  // 사용자 폴더에서 잘못 깐 node_modules(그 안 패키지의 package.json)는 프로젝트가 아니다(Fable 설계 검토 자리 1)
  await fs.mkdir(path.join(home, 'node_modules', 'left-pad'), { recursive: true });
  await fs.writeFile(path.join(home, 'node_modules', 'left-pad', 'package.json'), '{}');
  const found = (await homeProjects(home, [path.join(home, 'Documents')])).map((p) => path.basename(p)).sort();
  assert.deepEqual(found, ['code', 'repo-top']);
  await fs.rm(base, { recursive: true, force: true });
});
