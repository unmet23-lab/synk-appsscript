'use strict';
// 작업실 「게시주소」(11-18) — 게시가 끝난 작업실 판의 공개 주소를 예약큐 캐시로 게시결과에 적는다.
// 세 회차 GPT 검수 뒤 설계 검토(.tmp/검수/설계검토_게시성과편연결_20261118.md)로 다시 짰다: 신원은 작업실.json(원고 postId · 판 줄의 채널 · 작업)에서 읽고,
// 쓰기는 「빈 주소를 세 ID로 검증한 주소로 채우기」만 한다. 시험 이름 끝의 번호는 설계 검토 시험 목록 번호다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TOOL = path.resolve(__dirname, '..', 'tools', '작업실예약.js');
const JOB_IG = 'a'.repeat(64), JOB_YT = 'b'.repeat(64), JOB_OLD = 'c'.repeat(64), JOB_NEW = 'd'.repeat(64);
const POST = 'post-1';
const URL_IG = 'https://www.instagram.com/reel/DfzTnYHiUuc/';
const CHANNELS = [{ id: 'ig', platform: 'instagram', handle: 'synkbrief' }, { id: 'yt', platform: 'youtube', handle: 'synkbrief' }];
const STATE = { postId: POST, 판: [{ 계정: 'synkbrief-instagram', 채널: 'ig', 작업: JOB_IG, 시각: '2026-11-16T12:00:00.000Z' }, { 계정: 'synkbrief-youtube', 채널: 'yt', 작업: JOB_YT, 시각: '2026-11-19T12:00:00.000Z' }] };

function fixture(t, { git = true } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-published-url-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, 'tools'));
  fs.mkdirSync(path.join(repo, 'docs', '마케팅'), { recursive: true });
  if (git) spawnSync('git', ['init', '-q'], { cwd: repo });
  process.env.SYNK_WORKSPACE_LINK_DIR = path.join(repo, '.링크');
  delete require.cache[TOOL];
  const 예약 = require(TOOL);
  // 편 하나 — 게시결과 줄과 작업실.json(등록 도구가 남기는 신원)을 함께 쓴다. state: null이면 작업실.json을 쓰지 않는다
  const episode = (name, rows, { state = STATE, 추가게시 } = {}) => {
    const dir = path.join(repo, 'docs', '마케팅', name);
    fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
    fs.writeFileSync(path.join(dir, '게시', '게시결과.json'), JSON.stringify({ 설명: '그대로', 판: rows, ...(추가게시 ? { 추가게시 } : {}) }, null, 2) + '\n');
    if (state) fs.writeFileSync(path.join(dir, '게시', '작업실.json'), JSON.stringify(state, null, 2) + '\n');
    return dir;
  };
  const read = dir => JSON.parse(fs.readFileSync(path.join(dir, '게시', '게시결과.json'), 'utf8'));
  const raw = dir => fs.readFileSync(path.join(dir, '게시', '게시결과.json'), 'utf8');
  const jobs = [
    { id: JOB_IG, postId: POST, channelId: 'ig', status: 'published', scheduledAt: '2026-11-16T12:00:00.000Z', publicationUrl: URL_IG, publishedAt: '2026-11-16T12:01:18.000Z' },
    { id: JOB_YT, postId: POST, channelId: 'yt', status: 'scheduled', reviewWaiting: false, scheduledAt: '2026-11-19T12:00:00.000Z', publicationUrl: null },
    { id: JOB_OLD, postId: 'post-0', channelId: 'ig', status: 'cancelled', scheduledAt: '2026-11-13T12:00:00.000Z', publicationUrl: null },
  ];
  const cache = { jobs, channels: CHANNELS };
  const withJob = (id, patch) => ({ ...cache, jobs: jobs.map(j => (j.id === id ? { ...j, ...patch } : j)) });
  return { repo, 예약, episode, read, raw, jobs, cache, withJob };
}

const igRow = (extra = {}) => ({ 계정: 'synkbrief-instagram', 상태: '승인 대기', 시각: '2026-11-16T12:00:00.000Z', 방법: '작업실', 작업: JOB_IG, 원고ID: POST, 승인: '유호님 상시', 확인: '검토 화면 승인', ...extra });
const ytRow = (extra = {}) => ({ 계정: 'synkbrief-youtube', 상태: '예약됨', 방법: '작업실', 작업: JOB_YT, 승인: '유호님 상시', ...extra });

test('게시된 작업의 그 계정 · 작업 줄 하나만 「게시됨」 · 공개 주소로 바꾸고, 다른 칸 · 다른 줄은 그대로 둔다 · 두 번째는 고침 0(1 · 14)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_필라테스예약_20261113', [
    { 계정: 'synkbrief-instagram', 상태: '취소됨', 방법: '작업실', 작업: JOB_OLD },
    igRow(),
    ytRow(),
    { 계정: 'synkbrief-tiktok', 상태: '예약됨', 방법: 'ego' },
  ]);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r.막힘, []);
  assert.deepEqual(r.쓴파일, ['docs/마케팅/synkbrief_필라테스예약_20261113/게시/게시결과.json']);
  const after = f.read(dir);
  assert.equal(after.설명, '그대로');
  assert.deepEqual(after.판[0], { 계정: 'synkbrief-instagram', 상태: '취소됨', 방법: '작업실', 작업: JOB_OLD });
  const ig = after.판[1];
  assert.equal(ig.상태, '게시됨');
  assert.equal(ig.주소, URL_IG);
  assert.equal(ig.게시물ID, 'DfzTnYHiUuc');
  assert.equal(ig.게시관측시각, '2026-11-16T12:01:18.000Z');
  for (const k of ['시각', '승인', '확인', '원고ID']) assert.equal(ig[k], igRow()[k], `${k}는 그대로`);
  assert.deepEqual(after.판[2], ytRow(), '아직 안 나간 판은 그대로');
  assert.deepEqual(after.판[3], { 계정: 'synkbrief-tiktok', 상태: '예약됨', 방법: 'ego' });
  assert.equal(after.판.length, 4, '줄을 덧붙이지 않는다');
  const before = f.raw(dir);
  const again = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual([again.고침, again.막힘, again.쓴파일], [[], [], []]);
  assert.equal(f.raw(dir), before);
});

test('서버 작업의 원고 · 채널이 작업실.json과 다르거나 주소 플랫폼이 채널과 다르면 쓰지 않고 알린다(2 · 3 · 4)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_원고다름_20261113', [igRow()]);
  const before = f.raw(dir);
  for (const [cache, why] of [
    [f.withJob(JOB_IG, { postId: 'post-2' }), /원고 · 채널이 작업실\.json과 다르다\(원고 다름/],
    [f.withJob(JOB_IG, { channelId: 'yt' }), /채널 다름/],
    [{ ...f.cache, channels: [{ id: 'ig', platform: 'youtube' }, CHANNELS[1]] }, /플랫폼이 다르다/],
    [{ ...f.cache, channels: [CHANNELS[1]] }, /서버 채널\(모름\)/],
  ]) {
    const r = await f.예약.fillPublished(f.repo, cache, { run: true });
    assert.deepEqual(r.고침, []);
    assert.equal(r.막힘.length, 1);
    assert.match(r.막힘[0].까닭, why);
    assert.equal(f.raw(dir), before);
  }
});

test('같은 원고의 작업실.json이 다른 편에도 있으면 어느 편도 쓰지 않는다 · 잠금 안에서 다시 센다(5)', async t => {
  const f = fixture(t);
  const a = f.episode('synkbrief_원편_20261113', [igRow()]);
  const b = f.episode('synkbrief_복사한편_20261115', [igRow()]);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r.고침, []);
  assert.equal(r.막힘.length, 2);
  for (const x of r.막힘) assert.match(x.까닭, /작업실\.json이 2개 편에 있다/);
  assert.equal(f.read(a).판[0].상태, '승인 대기');
  assert.equal(f.read(b).판[0].상태, '승인 대기');
  // 처음 훑을 때는 하나였는데 잠금 전에 복사본이 생긴 경우 — 잠금 안의 셈(같은원고)이 둘이면 쓰지 않는다
  fs.rmSync(b, { recursive: true });
  const bundle = { dir: a, name: path.basename(a) };
  const late = f.예약.applyPublished(bundle, f.cache, { 같은원고: () => 2 });
  assert.deepEqual(late.고침, []);
  assert.match(late.막힘[0], /2개 편에 있다/);
  assert.equal(f.read(a).판[0].상태, '승인 대기');
});

test('지움 · 보류 · 취소됨 · 실패 줄은 게시됨으로 되살리지 않는다 — synkbrief_디테일줄여줘 꼴(지움 + 주소 + 작업)(6)', async t => {
  const f = fixture(t);
  for (const 상태 of ['지움', '보류', '취소됨', '실패']) {
    const dir = f.episode(`synkbrief_거둔줄_${상태}`, [igRow({ 상태, 주소: URL_IG, 숨김: '삭제' }), { 계정: 'synkbrief-instagram', 상태: '게시됨', 주소: 'https://www.instagram.com/reel/OTHERPOST1/' }]);
    const before = f.raw(dir);
    const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
    assert.deepEqual(r.고침, [], 상태);
    assert.match(r.막힘[0].까닭, new RegExp(`「${상태}」이라 게시됨으로 바꾸지 않는다`));
    assert.equal(f.raw(dir), before);
    fs.rmSync(dir, { recursive: true });
  }
});

test('그 계정 줄 뒤에 거둔 줄(보류 · 지움)이 있으면 쓰지 않고 알린다(7)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_뒤에보류_20261113', [igRow(), { 계정: 'synkbrief-instagram', 상태: '보류', 까닭: '11-09 전부 다시 제작' }]);
  const before = f.raw(dir);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r.고침, []);
  assert.match(r.막힘[0].까닭, /「보류」\(거둔 판\)/);
  assert.equal(f.raw(dir), before);
});

test('주소 없이 다른 게시물ID만 있는 줄은 덮지 않는다 — 게시주소와 상태 --캐시 길 모두(8 · 15 · GA1)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_게시물ID만_20261113', [igRow({ 게시물ID: 'OTHERPOST1', 플랫폼: 'instagram' }), ytRow()]);
  const before = f.raw(dir);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r.고침, []);
  assert.match(r.막힘[0].까닭, /주소가 달라/);
  assert.equal(f.raw(dir), before);
  // 손으로 부르는 상태 --캐시 길도 병합(mergeResults)이 게시물ID를 보고 막는다
  const bundle = { dir, name: path.basename(dir) };
  await assert.rejects(f.예약.status(bundle, null, { jobs: f.jobs }), /주소가 달라/);
  assert.equal(f.raw(dir), before);
});

test('같은 게시물의 다른 꼴 주소(/p/)가 적힌 줄은 상태만 게시됨으로 올린다 · 게시물 ID로 못 읽는 다른 주소는 덮지 않는다(9)', async t => {
  const f = fixture(t);
  const linked = f.episode('synkbrief_이어둠_20261113', [igRow({ 주소: 'https://www.instagram.com/p/DfzTnYHiUuc/', 게시물ID: 'DfzTnYHiUuc', 플랫폼: 'instagram' })]);
  const r1 = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r1.막힘, []);
  assert.equal(f.read(linked).판[0].상태, '게시됨');
  assert.equal(f.read(linked).판[0].게시물ID, 'DfzTnYHiUuc');
  fs.rmSync(linked, { recursive: true });
  const short = f.episode('synkbrief_짧은주소_20261113', [igRow({ 주소: 'https://www.instagram.com/synkbrief/' })]);
  const r2 = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r2.고침, []);
  assert.match(r2.막힘[0].까닭, /주소가 달라/);
  assert.equal(f.read(short).판[0].주소, 'https://www.instagram.com/synkbrief/');
});

test('그 계정 · 작업 줄이 없거나 둘이면 새 줄을 만들지 않는다 · 다른 작업 줄이 이미 쓰는 같은 게시물은 덮지 않는다(10)', async t => {
  const f = fixture(t);
  const none = f.episode('synkbrief_작업줄없음_20261113', [igRow({ 작업: JOB_OLD })]);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.match(r.막힘[0].까닭, /줄이 0개라 건드리지 않았다/);
  assert.equal(f.read(none).판.length, 1);
  fs.rmSync(none, { recursive: true });
  const two = f.episode('synkbrief_작업줄둘_20261113', [igRow({ 상태: '예약됨' }), igRow()]);
  const r2 = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.match(r2.막힘[0].까닭, /줄이 2개라/);
  assert.equal(f.read(two).판[1].상태, '승인 대기');
  fs.rmSync(two, { recursive: true });
  const dup = f.episode('synkbrief_두작업_20261113', [igRow({ 작업: JOB_OLD, 상태: '게시됨', 주소: URL_IG }), igRow()]);
  const r3 = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r3.고침, []);
  assert.match(r3.막힘[0].까닭, /작업ID가 달라/);
  assert.equal(f.read(dup).판[1].상태, '승인 대기');
});

test('다시 등록으로 작업실.json이 새 작업을 가리키면 옛 작업을 되살리지 않는다 — 잠금 안에서 다시 읽는다(11)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_다시등록_20261113', [igRow({ 상태: '취소됨' }), igRow({ 작업: JOB_NEW, 상태: '승인 대기' })]);
  const bundle = { dir, name: path.basename(dir) };
  // 고를 때는 옛 작업(JOB_IG)을 봤어도, 쓰기 직전에 등록이 작업실.json을 새 작업으로 바꿨다
  fs.writeFileSync(path.join(dir, '게시', '작업실.json'), JSON.stringify({ postId: 'post-9', 판: [{ 계정: 'synkbrief-instagram', 채널: 'ig', 작업: JOB_NEW }] }));
  const cache = { ...f.cache, jobs: [...f.jobs, { id: JOB_NEW, postId: 'post-9', channelId: 'ig', status: 'scheduled', reviewWaiting: true, publicationUrl: null }] };
  const before = f.raw(dir);
  const r = f.예약.applyPublished(bundle, cache);
  assert.deepEqual([r.고침, r.막힘], [[], []]);
  assert.equal(f.raw(dir), before);
});

test('상태 --캐시: 캐시에 없는 작업은 「작업 없음」으로 쓰지 않고, 원고 · 채널이 다른 작업은 쓰지 않는다(12 · 15)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_캐시밖_20261113', [igRow(), ytRow()]);
  const bundle = { dir, name: path.basename(dir) };
  const r = await f.예약.status(bundle, null, { jobs: f.jobs.filter(j => j.id !== JOB_YT) });
  assert.equal(r.rows.length, 1);
  assert.match(r.막힘[0], /캐시에 작업 bbbbbbbb이 없다/);
  assert.equal(f.read(dir).판[1].상태, '예약됨', '「작업 없음」으로 내리지 않는다');
  assert.equal(f.read(dir).판[0].상태, '게시됨');
  const other = f.episode('synkbrief_원고다른캐시_20261113', [igRow(), ytRow()]);
  const r2 = await f.예약.status({ dir: other, name: path.basename(other) }, null, { jobs: f.withJob(JOB_IG, { postId: 'post-2' }).jobs });
  assert.match(r2.막힘[0], /원고 다름/);
  assert.equal(f.read(other).판[0].상태, '승인 대기');
});

test('같은 게시물이 작업ID 없는 추가게시 줄에도 있으면 판 줄을 채우고 「중복 정리 필요」로 알린다(13)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_손연결중복_20261113', [igRow({ 상태: '취소됨', 작업: JOB_OLD }), igRow()], {
    추가게시: [{ 계정: 'synkbrief-instagram', 상태: '공개 확인 필요', 주소: 'https://www.instagram.com/p/DfzTnYHiUuc/', 게시물ID: 'DfzTnYHiUuc', 플랫폼: 'instagram', 연결: '캡션' }],
  });
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.equal(r.고침.length, 1);
  assert.deepEqual(r.막힘, []);
  assert.match(r.중복[0].까닭, /중복 정리 필요/);
  assert.equal(f.read(dir).판[1].상태, '게시됨');
  assert.equal(f.read(dir).추가게시.length, 1, '추가게시 줄은 사람이 합친다');
});

test('명령: 캐시가 없거나 낡으면 건너뛰고, 미리 보기는 쓰지 않고, --json으로 불러도 쓴다 · git 밖(운영 사본을 가리지 못함)에서는 쓰지 않는다(16)', t => {
  const run = (f, ...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd: f.repo, env: { ...process.env, SYNK_QUEUE_DIR: path.join(f.repo, '.예약큐'), SYNK_장부올리기: '끔' }, encoding: 'utf8' });
  const writeCache = (f, checkedAt) => {
    fs.mkdirSync(path.join(f.repo, '.예약큐'), { recursive: true });
    fs.writeFileSync(path.join(f.repo, '.예약큐', '서버.json'), JSON.stringify({ checkedAt, channels: CHANNELS, jobs: f.jobs, posts: [] }));
  };
  const f = fixture(t);
  const dir = f.episode('synkbrief_한도인수인계_20261113', [igRow()]);
  const before = f.raw(dir);
  let out = run(f, '게시주소');
  assert.equal(out.status, 0); assert.match(out.stdout, /캐시가 없다/);
  writeCache(f, new Date(Date.now() - 3 * 3600_000).toISOString());
  out = run(f, '게시주소', '--실행');
  assert.equal(out.status, 0); assert.match(out.stdout, /낡았다/);
  assert.equal(f.raw(dir), before);
  writeCache(f, new Date().toISOString());
  out = run(f, 'published');
  assert.equal(out.status, 0, out.stderr); assert.match(out.stdout, /1개\(미리 보기\)/);
  assert.equal(f.raw(dir), before);
  out = run(f, '게시주소', '--실행', '--json');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(JSON.parse(out.stdout).쓴파일, ['docs/마케팅/synkbrief_한도인수인계_20261113/게시/게시결과.json']);
  assert.equal(f.read(dir).판[0].상태, '게시됨');
  // git 밖 — 운영 사본 가리킴을 읽지 못하니 쓰지 않는다
  const g = fixture(t, { git: false });
  const gdir = g.episode('synkbrief_깃밖_20261113', [igRow()]);
  writeCache(g, new Date().toISOString());
  out = run(g, '게시주소', '--실행');
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /가리킴을 읽지 못했다/);
  assert.equal(g.read(gdir).판[0].상태, '승인 대기');
});

test('고칠 것이 없는 편은 잠그지 않는다 · 작업실.json이 없는 편은 보지 않는다 · --json은 건너뛸 때도 JSON이다(16)', async t => {
  const f = fixture(t);
  const idle = f.episode('synkbrief_고칠것없음_20261113', [igRow({ 상태: '게시됨', 주소: URL_IG })]);
  fs.writeFileSync(path.join(idle, '게시', '작업실_처리중.lock'), '{}');
  f.episode('synkbrief_손으로올림_20261113', [igRow()], { state: null });
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual([r.고침, r.막힘], [[], []], '다른 작업이 잡은 편이어도 고칠 것이 없으면 잠금을 건드리지 않는다');
  const out = spawnSync(process.execPath, [TOOL, '게시주소', '--실행', '--json'], { cwd: f.repo, env: { ...process.env, SYNK_QUEUE_DIR: path.join(f.repo, '.없는캐시'), SYNK_장부올리기: '끔' }, encoding: 'utf8' });
  assert.equal(out.status, 0, out.stderr);
  assert.match(JSON.parse(out.stdout).건너뜀, /캐시가 없다/);
});

// ── GPT 4회차(게시성과편연결-20261118-4) ──────────────────────────────

test('게시물ID가 같아도 플랫폼이 다른 줄은 같은 게시물이 아니다 — 게시주소와 상태 --캐시 모두 덮지 않는다(4회차 GA1 · GA4)', async t => {
  const f = fixture(t);
  for (const extra of [{ 주소: 'https://www.youtube.com/shorts/DfzTnYHiUuc' }, { 게시물ID: 'DfzTnYHiUuc', 플랫폼: 'youtube' }]) {
    const dir = f.episode('synkbrief_다른플랫폼_20261113', [igRow(extra), ytRow()]);
    const before = f.raw(dir);
    const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
    assert.deepEqual(r.고침, [], JSON.stringify(extra));
    assert.match(r.막힘[0].까닭, /주소가 달라/);
    await assert.rejects(f.예약.status({ dir, name: path.basename(dir) }, null, { jobs: f.jobs }), /주소가 달라/);
    assert.equal(f.raw(dir), before);
    fs.rmSync(dir, { recursive: true });
  }
});

test('주소 없이 같은 게시물ID만 있는 「게시됨」 줄에는 공개 주소를 채운다(4회차 GA3)', async t => {
  const f = fixture(t);
  const dir = f.episode('synkbrief_아이디만게시됨_20261113', [igRow({ 상태: '게시됨', 게시물ID: 'DfzTnYHiUuc', 플랫폼: 'instagram' })]);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r.막힘, []);
  assert.equal(r.고침.length, 1);
  assert.equal(f.read(dir).판[0].주소, URL_IG);
  assert.equal(f.read(dir).판[0].게시물ID, 'DfzTnYHiUuc');
});

test('한 작업실.json 안에서 같은 작업 · 채널이 두 계정 판 줄에 있으면 어느 줄도 쓰지 않는다(4회차 GA5)', async t => {
  const f = fixture(t);
  const state = { postId: POST, 판: [STATE.판[0], { ...STATE.판[0], 계정: 'yuhobuilds-instagram' }] };
  const dir = f.episode('synkbrief_두계정한작업_20261113', [igRow(), igRow({ 계정: 'yuhobuilds-instagram' })], { state });
  const before = f.raw(dir);
  const r = await f.예약.fillPublished(f.repo, f.cache, { run: true });
  assert.deepEqual(r.고침, []);
  assert.equal(r.막힘.length, 2);
  for (const x of r.막힘) assert.match(x.까닭, /같은 작업 · 채널이 다른 판 줄/);
  assert.equal(f.raw(dir), before);
});

// ── 설계 검토 다시 보기(4회차 뒤) ──────────────────────────────────────

test('상태 · 상태 --캐시는 지움 · 보류 줄의 상태를 서버 값(게시됨)으로 되살리지 않는다(설계 검토 다시 보기 N1)', async t => {
  const f = fixture(t);
  for (const 상태 of ['지움', '보류']) {
    const dir = f.episode(`synkbrief_상태로되살림_${상태}`, [igRow({ 상태, 주소: URL_IG, 숨김: '삭제' }), ytRow()]);
    const r = await f.예약.status({ dir, name: path.basename(dir) }, null, { jobs: f.jobs });
    assert.equal(r.rows.find(x => x.계정 === 'synkbrief-instagram').상태, '게시됨', '서버 상태는 그대로 돌려준다');
    const ig = f.read(dir).판[0];
    assert.equal(ig.상태, 상태, `${상태} 줄은 그대로`);
    assert.equal(ig.숨김, '삭제');
    fs.rmSync(dir, { recursive: true });
  }
});
