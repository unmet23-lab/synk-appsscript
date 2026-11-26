'use strict';
// 첫 보호 범위(STAGE1_DESIGN.md 4.17): 진단 결과로 지킬 폴더를 고르는 규칙, 계획기로 센 크기로 넣기를 정하는 규칙, 범위 파일과
// 넣기 · 빼기 · 추가 보호, 「보호 시작」에 넘길 폴더. 진단과 계획기는 가짜 실행기로 갈아 끼운다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { FirstRange: Range, run, pickRange, decide, totals, homeProjects, GB } = require('../src/first-range.cjs');

// 시험이 어떻게 끝나든 만든 범위를 닫고 쓰던 저장까지 기다린 뒤 폴더를 지운다 — 늦은 저장이 지운 폴더를 다시 만들지 않게(Fable 설계 검토 · 0.7.5 GPT r3 GA4)
const made = [], bases = [];
class FirstRange extends Range { constructor(o) { super(o); made.push(this); } }
const temp = async (name) => { const base = await fs.mkdtemp(path.join(os.tmpdir(), name)); bases.push(base); return base; };
test.afterEach(async () => {
  for (const r of made.splice(0)) { await r.stop(); await r.saving?.catch(() => {}); }
  for (const base of bases.splice(0)) await fs.rm(base, { recursive: true, force: true });
});

// 범위는 Windows 경로(드라이브 글자, 사용자 폴더)로 정하므로 Linux에서는 뜻이 없다(mass-hold.test.cjs와 같다)
const windowsPaths = process.platform !== 'win32' && 'Windows 경로 규칙을 보는 시험 — GitHub Windows에서 돈다(tools/conditional-qa)';

const cand = (raw, category, evidence, bytes = 0, { state = 'present', incomplete = [], files = 10 } = {}) =>
  ({ path: { raw, display: raw, lossy: false }, category, evidence: [].concat(evidence), state, configured_coverage: 'none', stats: { files, logical_bytes: bytes, extensions: {}, incomplete, excluded: [] } });
const P = 'C:\\Users\\kim';
const known = (name, bytes, more = {}) => cand(`${P}\\${name}`, 'irreplaceable', `known_folder_${name}`, bytes, more);
const inventory = (candidates, complete = true) => ({ schema_version: 1, scan_complete: complete, candidates });
const measured = (rows, sizes = {}) => rows.map((r) => ({ ...r, measured: true, partial: false, ...(sizes[path.win32.basename(r.path)] !== undefined ? { bytes: sizes[path.win32.basename(r.path)] } : {}) }));
const byName = (rows) => Object.fromEntries(rows.map((r) => [path.win32.basename(r.path), r]));

test('범위 고르기: 알려진 폴더, 찾아낸 작업 폴더, AI 폴더, 넣지 않는 자리', { skip: windowsPaths }, () => {
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

test('넣기 규칙: 바탕화면 · 문서는 예산을 넘어도 넣고, 작은 것만 넣는 무리는 80GB 예산과 다 센 크기로 정한다', { skip: windowsPaths }, () => {
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

test('범위 고르기: 드라이브 전체로 옮긴 알려진 폴더, 겹친 알려진 폴더, 24곳 상한과 부모 묶기', { skip: windowsPaths }, () => {
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
  // 작업 폴더 안의 로그인 폴더는 그 작업 폴더를 막지 않는다 — 백업이 그 안쪽을 뺀다(GA2)
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
  const base = await temp('swb-range-');
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
// 바쁜 PC에서는 서른 줄을 세고 적는 데 1초를 넘긴다 — 끝날 때까지, 길어도 2분
const settle = async (r) => { const until = Date.now() + 120000; while (Date.now() < until && (r.finding || r.active || r.queue.length)) { await r.finding; await new Promise((x) => setTimeout(x, 5)); } };

test('범위 찾기: 진단 뒤 계획기로 줄마다 세고, 보고서 폴더를 지우고, 사용자 폴더 맨 위 프로젝트를 더한다', { skip: windowsPaths }, async () => {
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
});

test('넣기 · 빼기 · 추가 보호와 다시 찾기: 손님이 바꾼 것은 다시 찾아도 남는다', { skip: windowsPaths }, async () => {
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
});

test('GPT 검수(GA3 · GA6 · GA7 · GA11): 빼 둔 줄 더하기, 진단이 놓친 줄, 더한 줄 다시 세기, 닫는 중', { skip: windowsPaths }, async () => {
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
});

test('GPT 검수(GA5 · GA8): 넣은 줄 안의 줄은 손님이 뺐어도 「함께 지킵니다」로 보이고, 넣은 곳이 30곳을 넘으면 저절로 넣은 줄을 뺀다', { skip: windowsPaths }, () => {
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

test('GPT 다시 검수(GA2 · GA3 · GA4 · GA5): 다시 넣기의 30곳 검사, 빼 둔 바깥 줄 더하기, 없어진 줄 안의 줄, 손님 줄만으로 30곳 넘김', { skip: windowsPaths }, async () => {
  const base = await temp('swb-range2-');
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
  // 「보호 시작」이 RANGE_FULL로 멈춰 손님이 고른다(문서 없는 백업이 「지키는 중」으로 가지 않게). 고르는 단계가 그 몫을 남기므로(r4 GA3)
  // 이 상태는 앞 판이 쓴 범위 파일에서만 온다
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
});

const row0 = (p, kind, more = {}) => ({ path: p, kind, bytes: 1, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0, ...more });
test('r4 GA3: 고를 때 바탕화면 · 문서와 빠져 있는 손님 줄의 몫을 남겨, 다시 찾아 저절로 들어와도 30곳을 넘지 않는다', { skip: windowsPaths }, async () => {
  const { base, home, state } = await sandbox();
  const mine = []; for (let i = 0; i < 31; i++) { const d = path.join(base, `m${i}`); await fs.mkdir(d); mine.push(await fs.realpath(d)); }
  let fail = true;
  const good = fakeExec({ home, sizes: { Videos: 30 * GB } }), bad = fakeExec({ home, fail: true });
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: (...a) => (fail ? bad : good)(...a), home, forbidden: () => [state] });
  await r.open(); await r.find(); await settle(r);
  assert.equal(r.state().status, 'failed');
  // 진단이 실패한 뒤 손으로 30곳을 고르면 28곳까지만 들어간다
  const first = await r.add(mine.slice(0, 30)); await settle(r);
  assert.deepEqual([first.skipped.map((x) => x.why), totals(r.folders()).count, r.blocker()], [['full', 'full'], 28, null]);
  // 바탕화면 · 문서를 손으로 더해도 다시 찾기 전에는 그 몫을 따로 남긴다(알려진 폴더인지 아직 모른다)
  assert.equal((await r.add([path.join(home, 'Desktop')])).skipped[0]?.why, 'full');
  // 다시 찾아 바탕화면 · 문서가 들어와도 30곳이고 시작할 수 있다. 저절로 넣는 작은 것은 30곳이 다 차서 빠진다
  fail = false; await r.find(); await settle(r);
  const f = byName(r.folders());
  assert.deepEqual([f.Desktop.on, f.Documents.on, f.Pictures.why, totals(r.folders()).count, r.blocker()], [true, true, 'full', 30, null]);
  assert.equal((await r.sources()).length, 30);
  // 문서를 찾을 수 없게 되면(뽑은 드라이브 따위) 그 몫은 다른 폴더가 쓰지 못한다 — 다시 찾아 들어와도 30곳이다
  for (const n of ['Pictures', 'code']) await r.set(path.join(home, n), false);
  const docs = path.join(home, 'Documents'), away = path.join(home, 'away');
  await fs.rename(docs, away);
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual([totals(r.folders()).count, (await r.add([mine[30]])).skipped[0]?.why], [29, 'full']);
  await fs.rename(away, docs);
  await r.find(); await settle(r);
  assert.deepEqual([byName(r.folders()).Documents.on, totals(r.folders()).count, r.blocker()], [true, 30, null]);
  // 「넣기」도 몫을 남긴다: 문서가 없어진 동안 빼 둔 사진을 넣으려 하면 거절한다
  await fs.rename(docs, away);
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  await assert.rejects(r.set(path.join(home, 'Pictures'), true), { code: 'RANGE_FULL' });
  await fs.rename(away, docs); await r.set(docs, true);
  assert.deepEqual([totals(r.folders()).count, r.blocker()], [30, null]);
  // 손님이 문서를 빼면 그 자리를 쓸 수 있다
  await r.set(docs, false);
  assert.deepEqual([(await r.add([mine[30]])).skipped, totals(r.folders()).count], [[], 30]);
  await settle(r);
  // 드라이브 전체라 넣을 수 없는 문서의 자리도 남긴다 — 보통 폴더로 되돌리면 들어온다(Fable 설계 다시 검토)
  r.data = { ...r.blank(), at: '2026-11-25T03:00:00Z', complete: true, folders: [row0(path.join(home, 'Desktop'), 'desktop'), row0('D:\\', 'documents', { why: 'whole' })],
    added: mine.slice(0, 28).map((p) => ({ path: p, bytes: 1, files: 1, partial: false, measured: true })), choices: {} };
  r.gone.clear();
  assert.deepEqual([totals(r.folders()).count, (await r.add([mine[28]])).skipped[0]?.why], [29, 'full']);
  // 앞 판(0.7.4)에서 이미 30곳을 채운 범위 파일: 다시 찾으면 바탕화면 · 문서가 들어와 32곳이고 「보호 시작」이 RANGE_FULL로 멈춘다(받아들인 한계). 두 곳을 빼면 풀린다
  r.data = { ...r.blank(), added: mine.slice(0, 30).map((p) => ({ path: p, bytes: 1, files: 1, partial: false, measured: true })), choices: {} };
  await r.find(); await settle(r);
  assert.deepEqual([totals(r.folders()).count, r.blocker()], [32, 'RANGE_FULL']);
  await r.set(mine[0], false); await r.set(mine[1], false);
  assert.deepEqual([totals(r.folders()).count, r.blocker()], [30, null]);
  // 손님이 넣었는데 지금 열리지 않는 줄(진단이 「열 수 없음」으로 남긴 동영상)도 30곳에 센다
  const row = (p, kind, more = {}) => ({ path: p, kind, bytes: 1, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0, ...more });
  const added = (p) => ({ path: p, bytes: 1, files: 1, partial: false, measured: true });
  const desk = path.join(home, 'Desktop'), vids = path.join(home, 'Videos');
  r.data = { ...r.blank(), at: '2026-11-25T03:00:00Z', complete: true, folders: [row(desk, 'desktop'), row(docs, 'documents'), row(vids, 'videos', { why: 'unreadable' })],
    added: mine.slice(0, 27).map(added), choices: { [vids.toLowerCase()]: true } };
  r.gone.clear();
  assert.deepEqual([totals(r.folders()).count, (await r.add([mine[28]])).skipped[0]?.why], [29, 'full']);
  // 손으로 더한 폴더가 문서 폴더 자체이면 문서 몫을 따로 남기지 않는다
  r.data = { ...r.data, folders: [row(desk, 'desktop'), row(docs, 'documents')], added: [added(docs), ...mine.slice(0, 27).map(added)], choices: { [docs.toLowerCase()]: true } };
  assert.equal(totals(r.folders()).count, 29);
  assert.deepEqual([(await r.add([mine[28]])).skipped, totals(r.folders()).count], [[], 30]);
  await settle(r);
});

test('Fable 설계 검토가 더하라고 한 시험: 저절로 넣은 줄이 찬 30곳, 바깥 줄을 뺀 뒤, 모두 없어진 뒤, 새 창, 뺀 안쪽 줄', { skip: windowsPaths }, async () => {
  const base = await temp('swb-range3-');
  const dir = async (...p) => { const d = path.join(base, ...p); await fs.mkdir(d, { recursive: true }); return fs.realpath(d); };
  const make = () => new FirstRange({ root: path.join(base, 'state'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: async () => '{}', home: path.join(base, 'home') });
  const add = (p) => ({ path: p, bytes: 1, files: 1, partial: false, measured: true });
  const row = (p, kind, bytes = 1) => ({ path: p, kind, bytes, files: 1, partial: false, measured: true, on: false, why: null, inner: null, grouped: 0 });
  const blank = () => ({ v: 2, at: '2026-11-25T03:00:00Z', complete: true, failed: null, more: 0, folders: [], added: [], choices: {} });
  const r = make(), desk = await dir('Desktop'), docs = await dir('Documents'), vids = await dir('Videos');
  const work = [], mine = []; for (let i = 0; i < 21; i++) work.push(await dir(`w${i}`)); for (let i = 0; i < 28; i++) mine.push(await dir(`m${i}`));
  const count = () => totals(r.folders()).count;
  // ① 저절로 넣은 줄이 켜진 30곳에서 「넣기」는 거절하고, 저절로 넣은 줄도 고른 것도 바꾸지 않는다. 한 곳을 빼면 넣는다
  r.data = { ...blank(), folders: [row(desk, 'desktop'), row(docs, 'documents'), ...work.map((p) => row(p, 'work')), row(vids, 'videos', 30 * GB)], added: mine.slice(0, 7).map(add) };
  assert.deepEqual([count(), byName(r.folders()).Videos.why], [30, 'big']);
  await assert.rejects(r.set(vids, true), { code: 'RANGE_FULL' });
  assert.deepEqual([count(), r.data.choices, r.folders().filter((f) => f.why === 'full').length], [30, {}, 0]);
  await r.set(work[0], false); await r.set(vids, true);
  assert.deepEqual([count(), byName(r.folders()).Videos.on, r.blocker()], [30, true, null]);
  // ② 바깥 줄을 빼면 그 안의 더한 줄이 따로 선다 — 고를 때 그 수로 세므로 바깥 줄을 빼도 30곳을 넘지 않는다(0.7.5 GPT GA3)
  const a = await dir('Videos', 'a'), b = await dir('Videos', 'b');
  r.data = { ...blank(), folders: [row(desk, 'desktop'), row(docs, 'documents'), row(vids, 'videos', 1 * GB)], added: [...mine.slice(0, 26), a, b].map(add), choices: { [vids.toLowerCase()]: true, [a.toLowerCase()]: true } };
  assert.equal(count(), 29);
  assert.deepEqual([(await r.add([mine[26]])).skipped[0]?.why, count()], ['full', 29]);
  await r.set(vids, false);
  assert.deepEqual([count(), r.blocker()], [30, null]);
  // 바깥 폴더를 「추가 보호」로 고르면 그 안의 줄을 걷으므로 곳 수가 줄고, 걷은 줄의 자리를 쓸 수 있다
  assert.deepEqual([(await r.add([vids])).skipped, count()], [[], 29]);
  assert.deepEqual([(await r.add([mine[26]])).skipped, count(), r.data.choices[a.toLowerCase()]], [[], 30, undefined]);
  await settle(r);
  // ③ 넣은 줄이 모두 없어지면 한 번 멈춘다. 두 번째는 범위에 넘길 폴더가 없다(null) — 워커는 이 창에서 고른 폴더를 쓴다
  const x = await dir('E', 'x'), y = await dir('E', 'y');
  r.data = { ...blank(), added: [add(x), add(y)] }; r.gone.clear();
  await fs.rm(path.join(base, 'E'), { recursive: true });
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual([r.folders().map((f) => f.why), count(), await r.sources()], [['gone', 'gone'], 0, null]);
  // ④ 「찾을 수 없음」 표시는 창을 닫으면 남지 않는다 — 새 창에서 한 번 더 멈춘 뒤 나머지로 시작한다
  const keep = await dir('keep'), lost = await dir('lost');
  r.data = { ...blank(), added: [add(keep), add(lost)] }; r.gone.clear(); await r.save();
  await fs.rm(lost, { recursive: true });
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual(await r.sources(), [keep]);
  const again = make(); await again.open();
  assert.equal(byName(again.folders()).lost.on, true);
  await assert.rejects(again.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual(await again.sources(), [keep]);
  // ⑤ 손님이 뺐지만 바깥 줄 때문에 「함께 지킵니다」였던 줄은, 바깥 줄을 찾을 수 없게 된 뒤 따로 넘기지 않는다
  const outer = await dir('F'), inner = await dir('F', 'Documents');
  r.data = { ...blank(), folders: [row(inner, 'documents')], added: [add(outer), add(keep)], choices: { [inner.toLowerCase()]: false } }; r.gone.clear();
  assert.deepEqual([byName(r.folders()).Documents.on, byName(r.folders()).Documents.within], [true, outer]);
  const opens = r.opens.bind(r);
  r.opens = async (p) => { if (p.toLowerCase() === outer.toLowerCase()) throw Object.assign(new Error('denied'), { code: 'EPERM' }); return opens(p); };
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  assert.deepEqual([byName(r.folders()).F.why, byName(r.folders()).Documents.on, byName(r.folders()).Documents.why], ['gone', false, 'user']);
  assert.deepEqual(await r.sources(), [keep]);
});

test('Fable 설계 검토 P2: 저절로 넣은 바깥 줄이 손님 줄을 품고 있다가 다시 세어 빠져도 30곳을 넘지 않는다', { skip: windowsPaths }, async () => {
  const { base, home, state } = await sandbox();
  const mine = []; for (let i = 0; i < 27; i++) { const d = path.join(base, `m${i}`); await fs.mkdir(d); mine.push(await fs.realpath(d)); }
  for (const n of ['a', 'b', 'c']) await fs.mkdir(path.join(home, 'Pictures', n));
  const sizes = { Pictures: 30 * GB, Videos: 30 * GB };
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, sizes }), home, forbidden: () => [state] });
  await r.open(); await r.find(); await settle(r);
  await r.set(path.join(home, 'code'), false);
  // 사진이 30GB라 빠져 있을 때 그 안의 두 폴더를 더한다. 손님이 뺀 안쪽 줄(c)은 바깥 줄이 빠지면 뺀 줄로 돌아가므로 세지 않는다
  await r.add(['a', 'b', 'c'].map((n) => path.join(home, 'Pictures', n))); await settle(r);
  await r.set(path.join(home, 'Pictures', 'c'), false);
  assert.equal(totals(r.folders()).count, 4);
  // 사진이 1GB가 되면 저절로 들어와 안쪽 줄은 「함께 지킵니다」가 된다
  sizes.Pictures = 1 * GB; await r.find(); await settle(r);
  assert.deepEqual([totals(r.folders()).count, byName(r.folders()).a.within, byName(r.folders()).c.on], [3, path.join(home, 'Pictures'), true]);
  // 손님이 채울 때는 두 줄이 따로 설 때의 수로 막는다: 스물여섯 곳까지
  const add = await r.add(mine); await settle(r);
  assert.deepEqual([add.skipped.map((x) => x.why), totals(r.folders()).count, r.blocker()], [['full'], 29, null]);
  // 다음 날 사진이 다시 커져 빠져도 30곳이고 시작할 수 있다
  sizes.Pictures = 30 * GB; await r.find(); await settle(r);
  const f = byName(r.folders());
  assert.deepEqual([f.Pictures.why, f.a.on, f.b.on, f.c.on, totals(r.folders()).count, r.blocker()], ['big', true, true, false, 30, null]);
});

test('0.7.5 GPT GA3 · GA4: 찾을 수 없는 바깥 줄 안에 더하기, 뽑은 드라이브의 AI 폴더 — 다시 꽂아도 30곳을 넘지 않는다', { skip: windowsPaths }, async () => {
  const { base, home, state } = await sandbox();
  const mine = []; for (let i = 0; i < 29; i++) { const d = path.join(base, `m${i}`); await fs.mkdir(d); mine.push(await fs.realpath(d)); }
  const ext = path.join(base, 'ext'); for (const n of ['a', 'b']) await fs.mkdir(path.join(ext, n), { recursive: true });
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home }), home, forbidden: () => [state] });
  await r.open(); await r.find(); await settle(r);
  for (const n of ['Pictures', 'Videos', 'code']) await r.set(path.join(home, n), false);
  // 바깥 폴더까지 30곳을 고른 뒤 드라이브를 뽑고 「보호 시작」을 누른다
  assert.deepEqual([(await r.add([ext, ...mine.slice(0, 27)])).skipped, totals(r.folders()).count], [[], 30]);
  await settle(r);
  const away = path.join(base, 'away');
  await fs.rename(ext, away);
  await assert.rejects(r.sources(), { code: 'RANGE_GONE' });
  // 다시 꽂고 바깥 줄 안의 폴더 둘을 더하면, 바깥 줄이 빠져 있는 동안 둘이 따로 서므로 하나까지만 들어간다
  await fs.rename(away, ext);
  assert.deepEqual([(await r.add([path.join(ext, 'a'), path.join(ext, 'b')])).skipped.map((x) => x.why), totals(r.folders()).count], [['full'], 30]);
  await settle(r);
  assert.equal(r.blocker(), null);
  // 다시 찾아 바깥 줄이 돌아와도 30곳을 넘지 않는다
  await r.find(); await settle(r);
  assert.deepEqual([totals(r.folders()).count, byName(r.folders()).a.within, r.blocker()], [30, ext, null]);

  // 뽑은 드라이브의 AI 폴더: 손님이 넣은 줄은 열리지 않아도 빼 둔 줄로 남아 30곳에 센다
  const ai = path.join(home, '.claude'), aiAway = path.join(home, 'claude-away');
  r.data = { ...r.data, added: [], choices: Object.fromEntries(['Pictures', 'Videos', 'code'].map((n) => [path.join(home, n).toLowerCase(), false])) };
  await r.set(ai, true); await settle(r);
  assert.deepEqual([(await r.add(mine.slice(0, 27))).skipped, totals(r.folders()).count], [[], 30]);
  await settle(r);
  await fs.rename(ai, aiAway);
  await r.find(); await settle(r);
  assert.deepEqual([byName(r.folders())['.claude'].why, totals(r.folders()).count], ['unreadable', 29]);
  assert.equal((await r.add([mine[28]])).skipped[0]?.why, 'full');
  await fs.rename(aiAway, ai);
  await r.find(); await settle(r);
  assert.deepEqual([byName(r.folders())['.claude'].on, totals(r.folders()).count, r.blocker()], [true, 30, null]);
  // 앞 판(0.7.4)의 범위 파일에는 줄 없이 「넣음」만 남은 것이 있다: 열리지 않아 버린 AI 폴더, 바깥 폴더를 더하며 걷은 줄. 저절로 넣지도 말없이 버리지도
  // 않는다 — 뺀 줄로 보이고(넣은 바깥 줄 안의 것은 「함께 지킵니다」) 「보호 시작」을 한 번 멈춘다. 자리도 차지하지 않는다(r2 GA5 · r3 GA1 · r4 GA1 · r5 GA1)
  const absorbed = path.join(mine[0], 'inner').toLowerCase(), offOuter = path.join(base, 'off'), under = Array.from({ length: 20 }, (_, i) => path.join(offOuter, `u${i}`).toLowerCase());
  await fs.mkdir(path.join(offOuter, 'u0'), { recursive: true });
  r.data = { ...r.data, folders: r.data.folders.filter((f) => f.kind !== 'aitool'), added: [...r.data.added, { path: offOuter, bytes: 1, files: 1, partial: false, measured: true }],
    choices: { ...r.data.choices, [offOuter.toLowerCase()]: false, [absorbed]: true, ...Object.fromEntries(under.map((k) => [k, true])) } };
  await r.save();
  const old = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home }), home, forbidden: () => [state] });
  await old.open(); await settle(old);
  let o = byName(old.folders());
  assert.deepEqual([o['.claude'].on, o['.claude'].why, o.u0.why, o.u19.why, o.inner.within, old.data.choices[absorbed], old.data.choices[path.join(home, 'Pictures').toLowerCase()]], [false, 'user', 'user', 'user', mine[0], false, false]);
  // 뺀 줄은 자리를 차지하지 않는다: 29곳에서 한 곳을 더하면 30곳이다
  assert.deepEqual([(await old.add([mine[28]])).skipped, totals(old.folders()).count], [[], 30]);
  await settle(old);
  await assert.rejects(old.sources(), { code: 'RANGE_GONE' });
  assert.ok(!(await old.sources()).some((p) => /\.claude|\\off|inner/i.test(p)));
  // 창을 다시 열어도 한 번만 멈춘다. 다시 찾아도 뺀 줄로 남고, 「넣기」로 되돌리면 넘긴다
  const next = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home }), home, forbidden: () => [state] });
  await next.open(); await next.find(); await settle(next);
  o = byName(next.folders());
  assert.deepEqual([o['.claude'].on, o['.claude'].why, (await next.sources()).length], [false, 'user', 30]);
  await next.set(mine[1], false); await next.set(ai, true); await settle(next);
  assert.deepEqual([totals(next.folders()).count, (await next.sources()).some((p) => path.basename(p) === '.claude')], [30, true]);
  // 드라이브 전체이거나 나중에 엔진 폴더와 겹쳐 빠질 문서 줄 안의 「넣음」도 확인할 줄로 남는다. 엔진 폴더와 겹치는 것은 남기지 않는다(r6 GA1 · GA2 · r7 Q1)
  const w = (forbidden, docs = row0('D:\\', 'documents', { why: 'whole' })) => {
    const x = new FirstRange({ root: path.join(base, 'w'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: async () => '{}', home });
    x.data = { ...x.blank(), at: '2026-11-25T03:00:00Z', complete: true, folders: [row0(path.join(home, 'Desktop'), 'desktop'), docs], choices: { 'd:\\work\\checkpoints': true } };
    x.settleChoices(forbidden);
    return [x.data.added.length, x.data.choices['d:\\work\\checkpoints'], !!x.data.ask];
  };
  assert.deepEqual([w([]), w(['D:\\Work\\Checkpoints\\repo']), w(['D:\\Work\\Backup'], row0('D:\\Work', 'documents'))], [[1, false, true], [0, undefined, true], [1, false, true]]);
  // 여는 때에도 겹침을 보고, 나중에 겹치게 된 줄은 「넣기」가 거절된다. 확인할 줄은 「넣기」를 누르기 전에는 세지 않는다(r6 GA2 · GA3)
  const repo = path.join(base, 'late'), inside = path.join(repo, 'repo'), calls = []; await fs.mkdir(inside, { recursive: true });
  let taken = [];
  const late = () => new FirstRange({ root: path.join(base, 'late-state'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: fakeExec({ home, calls }), home, forbidden: () => taken });
  const one = late(); one.data = { ...one.blank(), at: '2026-11-25T03:00:00Z', complete: true, choices: { [repo.toLowerCase()]: true } }; await one.save();
  const two = late(); await two.open(); await settle(two);
  assert.deepEqual([byName(two.folders()).late.why, calls], ['user', []]);
  // 진단이 같은 폴더를 작업 폴더로 찾아도 「넣기」 전에는 세지 않는다(r7 GA1)
  assert.deepEqual([two.wantsMeasure({ ...row0(repo, 'work'), measured: false }), two.wantsMeasure({ ...row0(path.join(base, 'other-work'), 'work'), measured: false })], [false, true]);
  taken = [inside];
  await assert.rejects(two.set(repo, true), { code: 'SOURCES_MISSING' });
  taken = []; await two.set(repo, true); await settle(two);
  assert.deepEqual([byName(two.folders()).late.on, calls], [true, ['plan.exe']]);
  taken = [inside];
  const three = late(); three.data = { ...three.blank(), at: '2026-11-25T03:00:00Z', complete: true, choices: { [repo.toLowerCase()]: true } }; await three.save();
  const four = late(); await four.open();
  assert.deepEqual([four.folders(), four.data.choices], [[], {}]);
});

test('0.7.5 GPT r2 GA1: 바깥 폴더를 더했다 빼도 손님이 뺀 안쪽의 미리 채운 줄은 뺀 채로 남는다', { skip: windowsPaths }, async () => {
  const { base, home, state } = await sandbox();
  const mine = []; for (let i = 0; i < 29; i++) { const d = path.join(base, `m${i}`); await fs.mkdir(d); mine.push(await fs.realpath(d)); }
  let fail = true;
  const good = fakeExec({ home }), bad = fakeExec({ home, fail: true });
  const r = new FirstRange({ root: state, inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: (...a) => (fail ? bad : good)(...a), home: path.join(base, 'other'), forbidden: () => [state] });
  await r.open(); await r.find(); await settle(r);
  // 진단이 실패한 뒤 바탕화면 · 문서를 손으로 더하고, 다시 찾은 뒤 둘을 뺀다
  const desk = path.join(home, 'Desktop'), docs = path.join(home, 'Documents');
  await r.add([desk, docs]); await settle(r);
  fail = false; await r.find(); await settle(r);
  for (const p of [desk, docs, path.join(home, 'Pictures'), path.join(home, 'Videos')]) await r.set(p, false);
  // 다른 29곳과 두 폴더의 바깥 폴더를 더하면 둘은 「함께 지킵니다」가 되고, 바깥 폴더를 빼면 뺀 줄로 돌아간다
  assert.deepEqual([(await r.add([...mine, home])).skipped, totals(r.folders()).count], [[], 30]);
  await settle(r);
  assert.deepEqual([byName(r.folders()).Desktop.within, byName(r.folders()).Documents.within], [home, home]);
  await r.set(home, false);
  assert.deepEqual([byName(r.folders()).Desktop.why, byName(r.folders()).Documents.why, totals(r.folders()).count, r.blocker()], ['user', 'user', 29, null]);
  // 손으로 더했다가 뺀 폴더는 바깥 폴더를 더해 그 줄이 걷혀도, 다시 찾아 미리 채운 줄이 되면 뺀 채로 있다
  const pics = path.join(home, 'Pictures'), two = new FirstRange({ root: path.join(base, 'state2'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: (...a) => (fail ? bad : good)(...a), home: path.join(base, 'other') });
  fail = true; await two.open(); await two.find(); await settle(two);
  await two.add([pics]); await settle(two); await two.set(pics, false);
  assert.deepEqual((await two.add([home])).skipped, []); await settle(two);
  fail = false; await two.find(); await settle(two);
  await two.set(home, false);
  assert.equal(byName(two.folders()).Pictures.why, 'user');
  // 손으로 더한 큰 동영상은 미리 채운 줄이 된 뒤 바깥 폴더를 더했다 빼도 넣은 채로 있다
  const vids = path.join(home, 'Videos'), big = fakeExec({ home, sizes: { Videos: 30 * GB } });
  const three = new FirstRange({ root: path.join(base, 'state3'), inventoryPath: 'C:\\x\\inv.exe', plannerPath: 'C:\\x\\plan.exe', exec: (...a) => (fail ? bad : big)(...a), home: path.join(base, 'other') });
  fail = true; await three.open(); await three.find(); await settle(three);
  await three.add([vids]); await settle(three);
  fail = false; await three.find(); await settle(three);
  assert.deepEqual((await three.add([home])).skipped, []); await settle(three);
  await three.set(home, false);
  assert.deepEqual([byName(three.folders()).Videos.kind, byName(three.folders()).Videos.on], ['videos', true]);
});

test('빼기 규칙 한 곳(engine.cjs, Fable 설계 검토 자리 1): 채움 목록 거르기와 지킬 폴더로 받지 않는 자리', () => {
  const { inSkippedDir, skippedPlace, refuseSkipped } = require('../src/engine.cjs');
  // 채움 목록: 담지 않는 폴더의 안쪽만 — 같은 이름의 보통 파일은 남는다(r4 GA1 · GA2)
  assert.deepEqual([inSkippedDir('D:\\w\\fixtures\\node_modules'), inSkippedDir('D:\\w\\node_modules\\a.js'), inSkippedDir('D:\\w\\.ssh\\id'), inSkippedDir('D:\\w\\.aws'), inSkippedDir('D:\\w\\my node_modules notes\\a.txt')], [false, true, true, false, false]);
  // 지킬 폴더: 어느 마디(마지막 포함)가 node_modules이거나 로그인 이름이면 받지 않는다
  assert.deepEqual([skippedPlace('D:\\p\\node_modules\\myfork'), skippedPlace('C:\\Users\\kim\\node_modules'), skippedPlace('D:\\work\\.aws'), skippedPlace('D:\\work\\.ssh\\keys'), skippedPlace('D:\\work\\node_modules_notes'), skippedPlace('D:\\work')], [true, true, true, true, false, false]);
  assert.throws(() => refuseSkipped(['D:\\work', 'D:\\p\\node_modules\\x']), { code: 'SOURCES_SKIPPED' });
  assert.deepEqual(refuseSkipped(['D:\\work']), ['D:\\work']);
  // 진단이 찾은 node_modules 안의 프로젝트는 줄로 세우지 않는다
  assert.ok(!pickRange(inventory([cand('D:\\p\\node_modules\\pkg', 'irreplaceable', 'project_manifest_name_only', 1), cand('D:\\work\\app', 'irreplaceable', 'git_marker_name_only', 1)])).folders.some((f) => /node_modules/.test(f.path)));
});

test('진단이 실패하면 「다 읽지 못했습니다」로 두고 추가 보호로 고른다 · 1.5배를 넘거나 세는 중이면 시작을 막는다', { skip: windowsPaths }, async () => {
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
});

test('사용자 폴더 맨 위의 프로젝트: 그 폴더나 바로 아래에 프로젝트 표시가 있으면 낸다(Fable F9)', { skip: windowsPaths }, async () => {
  const { base, home } = await sandbox();
  await fs.mkdir(path.join(home, 'repo-top', '.git'), { recursive: true });
  await fs.mkdir(path.join(home, 'AppData', 'x', '.git'), { recursive: true });
  await fs.mkdir(path.join(home, 'OneDrive', 'p', '.git'), { recursive: true });
  // 사용자 폴더에서 잘못 깐 node_modules(그 안 패키지의 package.json)는 프로젝트가 아니다(Fable 설계 검토 자리 1)
  await fs.mkdir(path.join(home, 'node_modules', 'left-pad'), { recursive: true });
  await fs.writeFile(path.join(home, 'node_modules', 'left-pad', 'package.json'), '{}');
  const found = (await homeProjects(home, [path.join(home, 'Documents')])).map((p) => path.basename(p)).sort();
  assert.deepEqual(found, ['code', 'repo-top']);
});

// 끊은 진단이 띄운 자식이 진단의 출력 연결을 물려받아 붙들고 있어도 창은 곧 닫힌다. 진단(WorkBackupInventory.exe)이 Get-AppxPackage로
// 띄운 Windows PowerShell이 그랬다: 진단은 끝났는데 연결이 그 PowerShell이 끝날 때까지 열려 있어, 0.7.4부터 CI backup 갈래의 창 워커
// 닫기가 21 ~ 36초 걸려 30초 한도에 닿았다(QA 「창 닫기가 진단의 PowerShell을 기다리던 것」). 실행기는 run 그대로이고, 진단 대신 셸을 돌린다.
// 셸의 자식은 진단의 PowerShell처럼 셸이 물려받은 연결을 함께 물려받는다(node가 띄운 node는 물려받지 않아 이 일을 재현하지 못한다).
// 그 자식은 20초 동안 0.05초마다 그 연결에 쓴다(GPT r2 GA1). 「started」는 자식을 띄운 뒤에 찍는다 — 자식이 뜨기 전에 끊으면 고치기 전 판도
// 통과하므로(GPT GA2). stay면 셸도 그 자식이 끝날 때까지 남는다
const HOLD = 20;
const holding = (stay) => {
  if (process.platform !== 'win32') return ['/bin/sh', ['-c', `(i=0; while [ $i -lt ${HOLD * 20} ]; do echo x; sleep 0.05; i=$((i+1)); done) & echo started${stay ? '; wait' : ''}`]];
  const writer = Buffer.from(`1..${HOLD * 20} | ForEach-Object { 'x'; Start-Sleep -Milliseconds 50 }`, 'utf16le').toString('base64');
  return [process.env.ComSpec || 'cmd.exe', ['/d', '/c', `start /b powershell -NoProfile -NonInteractive -EncodedCommand ${writer} & echo started${stay ? ` & ping -n ${HOLD + 1} 127.0.0.1 >nul` : ''}`]];
};

test('창을 닫아 끊은 진단은 그 자식이 출력 연결을 붙들고 계속 써도 곧 끝난다(0.7.4 CI backup APP_EXIT)', async () => {
  const [shell, args] = holding(true);
  const state = await temp('swb-range-hold-');
  let ready;
  const writing = new Promise((y) => { ready = y; });
  // 셸이 「started」를 찍은 뒤 그 자식이 쓰기 시작하면 닫는다
  const exec = (exe, a, o) => run(shell, args, { ...o, onChild: (c, alive) => {
    o.onChild(c, alive);
    let seen = '';
    if (alive) c.stdout.on('data', (b) => { seen += b; if (/started[\s\S]*x/.test(seen)) ready(); });
  } });
  const r = new FirstRange({ root: state, inventoryPath: 'inventory', plannerPath: 'planner', exec, home: state });
  await r.open();
  const finding = r.find();
  // 대신 띄운 셸이 자식을 띄우기 전에 끝나면 기다리지 않고 떨어진다
  await Promise.race([writing, finding.then(() => { throw new Error(`자식이 쓰기 전에 끝났다: ${r.state().status}`); })]);
  const at = Date.now();
  await r.stop();
  await finding;
  const took = Date.now() - at;
  assert.ok(took < HOLD * 1000 / 4, `창을 닫는 데 ${took}ms — 남은 자식이 끝날 때까지 기다렸다`);
  assert.equal(r.state().status, 'idle');
});

test('스스로 끝난 실행 파일은 그 자식이 출력 연결을 붙들고 계속 써도 다 읽은 출력으로 곧 끝난다(0.7.5 닫기 고침 GPT GA1 · r2 GA1)', async () => {
  const [shell, args] = holding(false);
  const at = Date.now();
  const out = await run(shell, args, { timeoutMs: 60000 });
  const took = Date.now() - at;
  assert.match(out, /started/);
  assert.ok(took < HOLD * 1000 / 4, `끝나는 데 ${took}ms — 남은 자식이 끝날 때까지 기다렸다`);
});
