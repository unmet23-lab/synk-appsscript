'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.SYNK_장부올리기 = '끔'; // 시험은 origin에 올리지 않는다
const 판정 = require('../tools/lib/게시성과판정.js');
const 편 = require('../tools/lib/게시성과편.js');
const 도구 = require('../tools/게시성과.js');
const 읽기 = require('../tools/lib/게시성과읽기.cjs');

// 서버 기록·편 폴더는 모두 합성 자료다. 실제 회사 서버·편 폴더·장부를 건드리지 않는다.
const H = 3_600_000;
const T0 = Date.parse('2026-10-01T12:00:00Z');
const iso = t => new Date(t).toISOString();
const YT = 'UC' + 'a'.repeat(22);

function cp(hours, publishedMs, metrics, { source = 'api:instagram-graph', late = 2 * 60_000, status = 'recorded', window = null } = {}) {
  const due = publishedMs + hours * H;
  const observedAt = iso(due + late);
  const metricProvenance = {};
  for (const k of Object.keys(metrics)) metricProvenance[k] = { source, observedAt, unit: 'count', timing: 'on-time', measurementWindowMissed: false };
  return { hours, status, dueAt: iso(due), closesAt: iso(due + 6 * H), observedAt: status === 'recorded' ? observedAt : null, source, metrics, metricProvenance, ...(window ? { window } : {}) };
}

function igEntry(n, saves, { views = 1000, shares = 5, day = n } = {}) {
  const published = T0 + day * 24 * H;
  return { id: 'e' + n, channelId: 'c-ig', platform: 'instagram', url: `https://www.instagram.com/reel/CODE${n}x/`, publishedAt: iso(published),
    publicationFormat: 'instagram-reels', origin: 'auto', checkpoints: [cp(24, published, { views: Math.round(views / 2) }), cp(72, published, { views, saves, shares, reach: views })] };
}

function data({ entries, posts = [], snapshots = [] }) {
  return {
    checkedAt: iso(T0 + 30 * 24 * H),
    channels: [{ id: 'c-ig', platform: 'instagram', handle: 'test.ig', name: 'IG' }, { id: 'c-yt', platform: 'youtube', handle: 'testtube', externalId: YT, name: 'YT' }],
    entries, posts, snapshots,
  };
}

test('게시 주소에서 플랫폼과 게시물 ID를 읽는다', () => {
  assert.equal(판정.postIdOf('https://youtube.com/shorts/R3zPsNM6a2c').key, 'youtube:R3zPsNM6a2c');
  assert.equal(판정.postIdOf('https://www.youtube.com/watch?v=R3zPsNM6a2c&t=3').key, 'youtube:R3zPsNM6a2c');
  assert.equal(판정.postIdOf('https://youtu.be/R3zPsNM6a2c').key, 'youtube:R3zPsNM6a2c');
  assert.equal(판정.postIdOf('https://www.instagram.com/p/DerKTa-qZtl/').key, 'instagram:DerKTa-qZtl');
  assert.equal(판정.postIdOf('https://www.instagram.com/reel/DeoGOuuDBdk/?igsh=x').key, 'instagram:DeoGOuuDBdk');
  assert.equal(판정.postIdOf('https://www.facebook.com/reel/1789856122228259/').key, 'facebook:1789856122228259');
  assert.equal(판정.postIdOf('https://www.tiktok.com/@synklab.mm/video/7698740136493780231').key, 'tiktok:7698740136493780231');
  assert.equal(판정.postIdOf('https://synk.im/'), null);
});

test('유튜브 형식은 쇼츠 탭 목록으로 다시 가른다(서버는 길이로만 가름)', () => {
  const shorts = { ids: new Set(['AAAAAAAAAAA']), coversAt: 0 };
  assert.equal(판정.formatOf({ platform: 'youtube', url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA', postFormat: 'youtube-video', externalId: 'AAAAAAAAAAA', publishedMs: 5, shorts }), 'youtube-shorts');
  assert.equal(판정.formatOf({ platform: 'youtube', url: 'https://www.youtube.com/watch?v=BBBBBBBBBBB', postFormat: 'youtube-shorts', externalId: 'BBBBBBBBBBB', publishedMs: 5, shorts }), 'youtube-video');
  // 목록이 덮지 않는 옛 편은 서버 형식을 그대로 둔다
  assert.equal(판정.formatOf({ platform: 'youtube', url: 'x', postFormat: 'youtube-shorts', externalId: 'BBBBBBBBBBB', publishedMs: 5, shorts: { ids: new Set(), coversAt: 10 } }), 'youtube-shorts');
  assert.equal(판정.formatOf({ platform: 'instagram', url: 'https://www.instagram.com/p/X1/', externalId: 'X1' }), 'instagram-post');
  assert.equal(판정.formatOf({ platform: 'facebook', url: 'https://www.facebook.com/reel/123456789/' }), 'facebook-reels');
});

test('계정 안 위치는 서버 규칙과 같다 — 4편부터, 가운데 순위, 값이 세 가지 미만이면 가르지 않음', () => {
  assert.equal(판정.standingOf(9, [1, 2, 3]), null);
  assert.equal(판정.standingOf(9, [1, 2, 3, 4]).label, 'top25');
  assert.equal(판정.standingOf(0, [1, 2, 3, 4]).label, 'bottom25');
  assert.equal(판정.standingOf(2.5, [1, 2, 3, 4]).label, 'middle');
  assert.equal(판정.standingOf(1, [0, 0, 1, 1, 1]).label, 'middle');
});

test('체크포인트 값은 목표 시각부터 6시간 안 관측만 비교에 쓴다', () => {
  const p = T0;
  const ok = 판정.checkpointPoint({ checkpoints: [cp(72, p, { views: 10 })] }, { key: '72h', hours: 72 });
  assert.equal(ok.status, 'recorded');
  assert.equal(ok.meta.views.valid, true);
  const late = 판정.checkpointPoint({ checkpoints: [cp(72, p, { views: 10 }, { late: 7 * H })] }, { key: '72h', hours: 72 });
  assert.equal(late.meta.views.valid, false);
  const missed = 판정.checkpointPoint({ checkpoints: [cp(24, p, { views: 10 }, { status: 'missed' })] }, { key: '24h', hours: 24 });
  assert.deepEqual(missed.metrics, {});
});

test('비교에 쓰는 조건은 서버 provenance와 같다 — 마감 6시간·지표별 출처·창 정의·미래 관측', () => {
  const p = T0, point = { key: '72h', hours: 72 };
  const base = cp(72, p, { views: 10 });
  const wide = { ...base, closesAt: iso(p + 72 * H + 10 * H) };
  assert.equal(판정.checkpointPoint({ checkpoints: [wide] }, point, p + 200 * H).meta.views.valid, false, '마감이 목표 + 6시간을 넘는 기록');
  const noMeta = { ...base, metricProvenance: {} };
  assert.equal(판정.checkpointPoint({ checkpoints: [noMeta] }, point, p + 200 * H).meta.views.valid, false, '지표별 출처가 없는 값');
  assert.equal(판정.checkpointPoint({ checkpoints: [base] }, point, p + 72 * H).meta.views.valid, false, '관측이 지금보다 뒤');
  const win = { source: 'api:youtube-analytics-v2', observedAt: iso(p + 120 * H), unit: 'count', kind: 'window', lagged: true, timeZone: 'America/Los_Angeles', days: 3, startDate: '2026-10-01', endDate: '2026-10-03' };
  const withWindow = { ...base, metrics: { views: 10, shares: 3 }, metricProvenance: { ...base.metricProvenance, shares: win } };
  assert.equal(판정.checkpointPoint({ checkpoints: [withWindow] }, point, p + 200 * H).meta.shares.valid, true);
  const badWindow = { ...withWindow, metricProvenance: { ...base.metricProvenance, shares: { ...win, days: 7 } } };
  assert.equal(판정.checkpointPoint({ checkpoints: [badWindow] }, point, p + 200 * H).meta.shares.valid, false, '창 정의가 다르면 쓰지 않는다');
});

test('페북 주소 — ?v= 먼저, reel·videos·posts 바로 뒤 숫자, 페이지 ID를 게시물로 잡지 않는다 · 서버 형식이 있으면 그것', () => {
  assert.equal(판정.postIdOf('https://www.facebook.com/100064538291234/videos/?v=998877665544').externalId, '998877665544');
  assert.equal(판정.postIdOf('https://www.facebook.com/synkworld/videos/998877665544/').externalId, '998877665544');
  assert.equal(판정.postIdOf('https://www.facebook.com/122136096939343429/posts/122136098109343429').externalId, '122136098109343429');
  assert.equal(판정.postIdOf('https://www.facebook.com/watch/?v=1234567').externalId, '1234567');
  assert.equal(판정.postIdOf('https://fb.watch/abcd123456/'), null);
  assert.equal(판정.formatOf({ platform: 'facebook', url: 'https://www.facebook.com/watch/?v=1234567', entryFormat: 'facebook-reels' }), 'facebook-reels');
  assert.equal(판정.formatOf({ platform: 'tiktok', url: 'x', postFormat: 'tiktok-photo' }), 'tiktok-photo');
});

test('편 글 속 주소 뒤에 한글이 붙어도 주소만 읽는다', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-index-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'LAB_편_20261001', '게시'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'LAB_편_20261001', '게시', '게시결과_20261001.md'), '유튜브 https://youtu.be/R3zPsNM6a2c에 올렸다. 인스타는 https://www.instagram.com/reel/DeoGOuuDBdk!\n');
  const index = 편.buildIndex(dir);
  assert.equal(index.resolve('youtube:R3zPsNM6a2c').info.folder, 'LAB_편_20261001');
  assert.equal(index.resolve('instagram:DeoGOuuDBdk').info.folder, 'LAB_편_20261001');
});

test('7일 값은 게시 168시간에 가장 가까운 하루 숫자(±13시간)', () => {
  const pub = iso(T0);
  const snaps = [{ at: T0 + 150 * H, views: 1 }, { at: T0 + 170 * H, views: 7 }, { at: T0 + 190 * H, views: 9 }];
  const point = { key: '7d', hours: 168 };
  const got = 판정.dailyPoint({ publishedAt: pub, snaps, platform: 'youtube' }, point, T0 + 200 * H);
  assert.equal(got.status, 'recorded');
  assert.equal(got.metrics.views, 7);
  assert.equal(판정.dailyPoint({ publishedAt: pub, snaps: [], platform: 'youtube' }, point, T0 + 100 * H).status, 'pending');
  assert.equal(판정.dailyPoint({ publishedAt: pub, snaps: [], platform: 'youtube' }, point, T0 + 190 * H).status, 'missed');
});

test('네 숫자가 상위면 「상위 25%」와 세 편 더, 하위면 훅 바꿔 다른 계정, 엇갈리면 제안 없음', () => {
  const prior = [1, 2, 3, 4].map(n => igEntry(n, n * 10));
  const top = judge([...prior, igEntry(5, 90)], 'e5');
  assert.equal(top.judgments['72h'].verdict.label, '상위 25%');
  assert.match(top.judgments['72h'].verdict.next, /세 편 더/);
  const bottom = judge([...prior, igEntry(5, 1)], 'e5');
  assert.equal(bottom.judgments['72h'].verdict.label, '하위 25%');
  assert.match(bottom.judgments['72h'].verdict.next, /훅/);
  // 이전 편 공유가 모두 같으면(값 한 가지) 위아래를 가르지 않으므로, 엇갈림은 공유도 갈리는 이전 편으로 본다
  const spread = [1, 2, 3, 4].map(n => igEntry(n, n * 10, { shares: n * 2 }));
  const mixed = judge([...spread, igEntry(5, 90, { shares: 0 })], 'e5');
  assert.equal(mixed.judgments['72h'].verdict.label, '엇갈림');
  assert.equal(mixed.judgments['72h'].verdict.next, null);
  const few = judge([igEntry(1, 10), igEntry(2, 90)], 'e2');
  assert.equal(few.judgments['72h'].verdict.label, '자료 부족');
  // 조회만 높아서는 상위가 아니다(조회는 보이기만)
  const viewsOnly = judge([...prior.map(e => ({ ...e, checkpoints: [cp(72, Date.parse(e.publishedAt), { views: 100 })] })), { ...igEntry(5, 0), checkpoints: [cp(72, T0 + 5 * 24 * H, { views: 9999 })] }], 'e5');
  assert.equal(viewsOnly.judgments['72h'].verdict.label, '자료 부족');
  function judge(entries, id) {
    return 판정.judgeAll(data({ entries }), { now: T0 + 40 * 24 * H }).find(x => x.record.entryId === id);
  }
});

test('관측 지연이 15분 넘게 다른 편과는 견주지 않는다', () => {
  const prior = [1, 2, 3, 4].map(n => ({ ...igEntry(n, n * 10), checkpoints: [cp(72, T0 + n * 24 * H, { saves: n * 10 }, { late: 60 * 60_000 })] }));
  const got = 판정.judgeAll(data({ entries: [...prior, igEntry(5, 90)] }), { now: T0 + 40 * 24 * H }).find(x => x.record.entryId === 'e5');
  assert.equal(got.judgments['72h'].facts.find(f => f.metric === 'saves').comparison.status, 'insufficient');
});

test('평소 대비 배수 — 그 시각 같은 채널·형식 최근 12편 조회 중앙값(그 편 포함)', () => {
  const posts = [], snapshots = [];
  for (let n = 1; n <= 14; n += 1) {
    const published = T0 + n * 24 * H;
    posts.push({ id: `c-yt:V${String(n).padStart(10, '0')}`, channelId: 'c-yt', externalId: `V${String(n).padStart(10, '0')}`, url: `https://www.youtube.com/watch?v=V${String(n).padStart(10, '0')}`, publishedAt: iso(published), publicationFormat: 'youtube-shorts' });
    snapshots.push([`c-yt:V${String(n).padStart(10, '0')}`, published + 30 * 24 * H - 1, n * 100]);
  }
  // 판정할 편(15번째) — 72시간 조회 3000
  const published = T0 + 15 * 24 * H;
  const entry = { id: 'y15', channelId: 'c-yt', platform: 'youtube', url: 'https://www.youtube.com/watch?v=V0000000015', publishedAt: iso(published), publicationFormat: 'youtube-shorts',
    checkpoints: [cp(72, published, { views: 3000 }, { source: 'api:youtube-data-api-v3' })] };
  // 하루 숫자의 시각을 판정 시각 전으로 당긴다
  const snaps = snapshots.map(([id, , v]) => [id, published + 70 * H, v]);
  const got = 판정.judgeAll(data({ entries: [entry], posts, snapshots: snaps }), { now: published + 80 * H }).find(x => x.record.entryId === 'y15');
  const m = got.judgments['72h'].multiple;
  // 최근 12편 = 이 편(3000) + 14·13·…·4번(1400…400) → 중앙값 (900+1000)/2 = 950
  assert.equal(m.n, 12);
  assert.equal(m.median, 950);
  assert.equal(m.value, Math.round(3000 / 950 * 100) / 100);
});

test('기획.md 첫 줄에서 역할과 훅 이름표를 읽고, A는 인스타·B는 유튜브', () => {
  const line = '1일 1편 · LAB · 2026-10-22 · 슬롯 2026-10-23 · 상시 · 역할 권위 · 트리거: 연재 — 근거 · 훅: A 손해 피하기 · B 숫자';
  const got = 편.parseFirstLine(line);
  assert.equal(got.role, '권위');
  assert.deepEqual(got.hooks, { A: '손해 피하기', B: '숫자' });
  const info = { hooks: got.hooks, plateHooks: new Map() };
  assert.deepEqual(편.hookFor(info, { account: 'lab-youtube', platform: 'youtube' }), { label: '숫자', slot: 'B' });
  assert.deepEqual(편.hookFor(info, { account: 'lab-instagram', platform: 'instagram' }), { label: '손해 피하기', slot: 'A' });
  // 판마다 적은 것이 먼저
  const plate = { hooks: got.hooks, plateHooks: new Map([['lab-youtube', 'A']]) };
  assert.deepEqual(편.hookFor(plate, { account: 'lab-youtube', platform: 'youtube' }), { label: '손해 피하기', slot: 'A' });
  assert.deepEqual(편.parseFirstLine('트리거: 실화 · 훅: 질문').hooks, { one: '질문' });
  assert.equal(편.parseFirstLine('# 제목만 있는 옛 기획').hooks, null);
  assert.equal(편.parseFirstLine('1일 1편 · LAB · 역할: 전환 · 트리거: 달력').role, '전환');
});

function tempRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-perf-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const run = args => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); };
  run(['init', '-q']);
  run(['config', 'user.email', 't@example.invalid']);
  run(['config', 'user.name', 't']);
  run(['config', 'core.autocrlf', 'false']);
  const folder = path.join(dir, 'docs', '마케팅', 'LAB_시험편_20261005');
  fs.mkdirSync(path.join(folder, '게시'), { recursive: true });
  fs.writeFileSync(path.join(folder, '기획.md'), '1일 1편 · LAB · 2026-10-05 · 역할 권위 · 트리거: 연재 · 훅: A 숫자 · B 질문\n\n# 시험편\n\n본문\n');
  fs.writeFileSync(path.join(folder, '게시', '게시결과.json'), JSON.stringify({ 판: [{ 계정: 'lab-instagram', 상태: '게시됨', 시각: iso(T0 + 5 * 24 * H), 주소: 'https://www.instagram.com/reel/CODE5x/' }] }));
  fs.writeFileSync(path.join(folder, '게시', '성과.json'), JSON.stringify({ readings: [{ window: '72h', note: '손으로 읽은 옛 기록' }] }, null, 2));
  const other = path.join(dir, 'docs', '마케팅', 'LAB_안올린편_20261006', '게시');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, '게시결과.json'), JSON.stringify({ 판: [{ 계정: 'lab-youtube', 상태: '게시됨', 시각: iso(T0 + 6 * 24 * H), 주소: 'https://youtube.com/shorts/ZZZZZZZZZZZ' }] }));
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'init']);
  return { dir, folder };
}

test('--실행은 편 폴더(성과.json 자동판정 칸·기획.md 끝 묶음)·장부·요약에 쓰고, 같은 값이면 다시 쓰지 않는다', async t => {
  const { dir, folder } = tempRepo(t);
  const server = data({ entries: [1, 2, 3, 4, 5].map(n => igEntry(n, n === 5 ? 90 : n * 10)) });
  const now = T0 + 9 * 24 * H;
  const first = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now, data: server, shorts: new Map() });
  assert.equal(first.결과, '씀');
  const result = JSON.parse(fs.readFileSync(path.join(folder, '게시', '성과.json'), 'utf8'));
  assert.ok(result.readings, '다른 칸은 그대로 둔다');
  assert.equal(result.자동판정.판[0].훅, '숫자');
  assert.equal(result.자동판정.판[0].역할, '권위');
  assert.equal(result.자동판정.판[0].시점['72시간'].판정, '상위 25%');
  const plan = fs.readFileSync(path.join(folder, '기획.md'), 'utf8');
  assert.match(plan, /게시성과:시작/);
  assert.match(plan, /인스타 @test\.ig · 훅 A 숫자 72시간/);
  const summary = fs.readFileSync(path.join(dir, 'docs', '마케팅', '게시성과.md'), 'utf8');
  assert.match(summary, /\| 숫자 \| 1 \|/);
  assert.match(summary, /\| 권위 \| 1 \|/);
  assert.match(summary, /서버에 등록되지 않은 게시[\s\S]*ZZZZZZZZZZZ/);
  const ledger = 도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl'));
  assert.ok(ledger.length >= 2);
  // 같은 값으로 다시 돌면 장부에 새 줄이 없다
  const second = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now: now + H, data: server, shorts: new Map() });
  assert.equal(second.새판정.length, 0);
  assert.equal(도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl')).length, ledger.length);
});

test('줄끝만 다른 요약·장부는 다시 쓰지 않고, 덧붙일 때는 그 파일의 줄끝을 따른다(공용 작업본은 CRLF로 꺼낸다)', async t => {
  const { dir } = tempRepo(t);
  const server = data({ entries: [1, 2, 3, 4, 5].map(n => igEntry(n, n * 10)) });
  const now = T0 + 9 * 24 * H;
  await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now, data: server, shorts: new Map() });
  const summary = path.join(dir, 'docs', '마케팅', '게시성과.md');
  const ledger = path.join(dir, 'docs', '_ops', '게시성과.jsonl');
  // 공용 작업본처럼 CRLF로 바꿔 둔다
  fs.writeFileSync(summary, fs.readFileSync(summary, 'utf8').replace(/\n/g, '\r\n'));
  fs.writeFileSync(ledger, fs.readFileSync(ledger, 'utf8').replace(/\n/g, '\r\n'));
  const r = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now, data: server, shorts: new Map() });
  assert.ok(!r.쓴파일?.includes('docs/마케팅/게시성과.md'), '줄끝만 다르면 요약을 다시 쓰지 않는다');
  // 화면 값을 덧붙이면 장부는 CRLF 그대로
  await 도구.run({ 실행: true, 저장소: dir, 적기: 'https://www.instagram.com/reel/CODE5x/', 값들: ['팔로우=3'] }, { now, data: server, shorts: new Map() });
  const text = fs.readFileSync(ledger, 'utf8');
  assert.ok(!/[^\r]\n/.test(text), '장부에 LF만 있는 줄이 섞이지 않는다');
  assert.equal(도구.readLedger(ledger).filter(l => l.kind === '화면').length, 1);
});

test('남의 미커밋이 있는 기획.md는 건드리지 않는다(이 도구 묶음만 바뀐 것은 내 것)', async t => {
  const { dir, folder } = tempRepo(t);
  const server = data({ entries: [1, 2, 3, 4, 5].map(n => igEntry(n, n * 10)) });
  fs.appendFileSync(path.join(folder, '기획.md'), '\n다른 세션이 쓰는 중인 줄\n');
  const r = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now: T0 + 9 * 24 * H, data: server, shorts: new Map() });
  assert.ok(r.건너뜀.some(s => /기획\.md: 남의 미커밋/.test(s)));
  assert.doesNotMatch(fs.readFileSync(path.join(folder, '기획.md'), 'utf8'), /게시성과:시작/);
  // 이 도구가 쓴 묶음만 미커밋인 것은 다시 써도 된다
  const { dir: dir2, folder: folder2 } = tempRepo(t);
  await 도구.run({ 실행: true, 저장소: dir2, 값들: [] }, { now: T0 + 9 * 24 * H, data: server, shorts: new Map() });
  assert.equal(도구.onlyMine(dir2, 'docs/마케팅/LAB_시험편_20261005/기획.md', 'md'), true);
  assert.equal(도구.onlyMine(dir2, 'docs/마케팅/LAB_시험편_20261005/게시/성과.json', 'json'), true);
  fs.appendFileSync(path.join(folder2, '기획.md'), '남의 줄\n');
  assert.equal(도구.onlyMine(dir2, 'docs/마케팅/LAB_시험편_20261005/기획.md', 'md'), false);
});

test('판정은 관측 10일 뒤 굳는다 — 서버가 옛 숫자를 지워 다시 잰 값이 달라도 장부에 새 줄을 쓰지 않는다', async t => {
  const { dir } = tempRepo(t);
  const server = data({ entries: [1, 2, 3, 4, 5].map(n => igEntry(n, n === 5 ? 90 : n * 10)) });
  await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now: T0 + 9 * 24 * H, data: server, shorts: new Map() });
  const before = 도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl')).length;
  // 30일 뒤: 이전 편 기록이 빠져 다시 재면 「자료 부족」이 되지만 굳은 판정은 그대로다
  const later = data({ entries: [igEntry(5, 90)] });
  const r = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now: T0 + 40 * 24 * H, data: later, shorts: new Map() });
  assert.equal(r.새판정.length, 0);
  assert.equal(도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl')).length, before);
});

test('--적기 미리 보기도 그 값이 들어간 판정을 보이고, 장부에는 쓰지 않는다', async t => {
  const { dir } = tempRepo(t);
  const server = data({ entries: [1, 2, 3, 4, 5].map(n => igEntry(n, n * 10)) });
  const r = await 도구.run({ 실행: false, 저장소: dir, 적기: 'https://www.instagram.com/reel/CODE5x/', 값들: ['팔로우=7'] },
    { now: T0 + 9 * 24 * H, data: server, shorts: new Map() });
  assert.deepEqual(r.화면줄.metrics, { follows: 7 });
  assert.ok(!fs.existsSync(path.join(dir, 'docs', '_ops', '게시성과.jsonl')));
  assert.ok(!r.화면목록.some(x => x.주소.includes('CODE5x') && x.칸.includes('팔로우')));
});

test('--적기는 화면 값을 장부에 남기고 72시간 판정에 더한다', async t => {
  const { dir } = tempRepo(t);
  const server = data({ entries: [1, 2, 3, 4, 5].map(n => igEntry(n, n * 10)) });
  const r = await 도구.run({ 실행: true, 저장소: dir, 적기: 'https://www.instagram.com/reel/CODE5x/', 값들: ['팔로우=7', '3초유지율=55.5'] },
    { now: T0 + 9 * 24 * H, data: server, shorts: new Map() });
  assert.deepEqual(r.화면줄.metrics, { follows: 7, earlyRetention3sPct: 55.5 });
  const ledger = 도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl'));
  assert.equal(ledger.filter(l => l.kind === '화면').length, 1);
  const line = ledger.filter(l => l.kind === '판정' && l.post === 'instagram:CODE5x' && l.point === '72h').pop();
  assert.ok(line.screenMetrics.includes('follows'));
  assert.ok(!line.screenNeeded.includes('follows'));
  assert.throws(() => 도구.화면값(['본비율=120']), /맞지 않는다/);
  assert.throws(() => 도구.화면값(['아무거나=1']), /칸 이름이 아니다/);
});

test('화면 필요 — 유튜브 창 지표는 주인 권한 채널이면 6일째까지 기다리고, 공개 통계 연결이면 바로 올린다', () => {
  const published = T0;
  const record = { platform: 'youtube', format: 'youtube-shorts', publishedMs: published, points: { '72h': { metrics: { views: 10 } } }, screen: null };
  const now = published + 4 * 24 * H;
  assert.deepEqual(판정.screenNeeds(record, now, { ownerAuthorized: true }), ['stayedToWatchPct']);
  assert.deepEqual(판정.screenNeeds(record, now, { ownerAuthorized: false }), ['stayedToWatchPct', 'averageWatchSeconds', 'averageViewPct', 'shares', 'subscribersGained']);
  assert.deepEqual(판정.screenNeeds(record, published + 7 * 24 * H, { ownerAuthorized: true }), ['stayedToWatchPct', 'averageWatchSeconds', 'averageViewPct', 'shares', 'subscribersGained']);
  assert.deepEqual(판정.screenNeeds(record, published + 60 * H, { ownerAuthorized: false }), [], '72시간 전에는 비운다');
  // 인스타 통계 권한이 없어 조회가 비면 조회·도달도 화면 필요
  const ig = { platform: 'instagram', format: 'instagram-reels', publishedMs: published, points: { '72h': { metrics: { likes: 1 } } }, screen: null };
  assert.deepEqual(판정.screenNeeds(ig, now).slice(0, 2), ['views', 'reach']);
});

test('서버 응답 다듬기 — 모르는 채널의 기록·게시물은 버린다', () => {
  const got = 읽기.다듬기({ checkedAt: iso(T0), channels: [{ id: 'c1', platform: 'youtube' }, { id: 'c2', platform: 'linkedin' }],
    entries: [{ id: 'e1', channelId: 'c1', url: 'https://youtu.be/AAAAAAAAAAA', publishedAt: iso(T0), checkpoints: [{ hours: 24 }, { hours: 'x' }] }, { id: 'e2', channelId: 'c2', url: 'u', publishedAt: iso(T0) }],
    posts: [{ id: 'p1', channelId: 'c1', publishedAt: iso(T0) }, { id: 'p2', channelId: 'zz', publishedAt: iso(T0) }],
    snapshots: [['p1', T0, 1], ['p2', T0, 2]] });
  assert.deepEqual(got.channels.map(c => c.id), ['c1']);
  assert.deepEqual(got.entries.map(e => e.id), ['e1']);
  assert.equal(got.entries[0].checkpoints.length, 1);
  assert.deepEqual(got.snapshots.map(s => s[0]), ['p1']);
  assert.throws(() => 읽기.다듬기({}), /PERFORMANCE_SHAPE/);
  // 원격 스크립트의 매개는 숫자로만 들어간다
  assert.match(읽기.파이썬({ days: '7;import os', perChannel: 3 }), /DAYS=21;PER=3/);
});
