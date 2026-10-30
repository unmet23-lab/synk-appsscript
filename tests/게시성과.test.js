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

test('평소 대비 배수(7일) — 이 편 앞에 올린 최근 12편이 7일째에 낸 조회의 중앙값(뒤에 올린 편 · 이 편 · 그 뒤 누적은 안 씀)', () => {
  const id = n => `V${String(n).padStart(10, '0')}`;
  const day = n => T0 + n * 24 * H;
  const posts = [], snapshots = [];
  for (let n = 1; n <= 19; n += 1) {
    posts.push({ id: `c-yt:${id(n)}`, channelId: 'c-yt', externalId: id(n), url: `https://www.youtube.com/shorts/${id(n)}`, publishedAt: iso(day(n)), publicationFormat: 'youtube-shorts' });
    // 7일째(같은 나이)는 n×100, 그 뒤 누적은 열 배 — 판정하는 편(16번)은 7일째 3000
    snapshots.push(n === 16 ? [`c-yt:${id(n)}`, day(n) + 168 * H, 3000] : [`c-yt:${id(n)}`, day(n) + 168 * H, n * 100], [`c-yt:${id(n)}`, day(n) + 400 * H, n * 1000]);
  }
  const entry = { id: 'y16', channelId: 'c-yt', platform: 'youtube', url: `https://www.youtube.com/shorts/${id(16)}`, publishedAt: iso(day(16)), publicationFormat: 'youtube-shorts', checkpoints: [] };
  const got = 판정.judgeAll(data({ entries: [entry], posts, snapshots }), { now: day(16) + 400 * H }).find(x => x.record.entryId === 'y16');
  const j = got.judgments['7d'];
  // 앞선 15편 가운데 가까운 12편 = 15…4번의 7일째 값(1500…400) → 중앙값 (900+1000)/2 = 950. 17~19번(뒤에 올림)과 이 편은 들지 않는다
  assert.deepEqual(j.multiple, { value: Math.round(3000 / 950 * 100) / 100, median: 950, n: 12, basis: 판정.SAME_AGE });
  assert.match(판정.judgmentLine(j), /평소 대비 3\.2배\(앞선 12편 같은 나이 중앙값 950\)/);
});

test('평소 대비 배수(24·72시간) — 앞서 올린 편의 같은 시점 체크포인트(같은 출처 · 관측 지연 차 15분 안)와 견주고, 앞선 편이 4편 미만이면 못 잰다', () => {
  const judge72 = list => 판정.judgeAll(data({ entries: list }), { now: T0 + 40 * 24 * H }).find(x => x.record.entryId === 'e7').judgments['72h'];
  const prior = [1, 2, 3, 4, 5].map(n => igEntry(n, 10, { views: n * 100 }));
  const late = { ...igEntry(6, 10, { views: 9000 }), checkpoints: [cp(72, T0 + 6 * 24 * H, { views: 9000 }, { late: 60 * 60_000 })] };
  const j = judge72([...prior, late, igEntry(7, 10, { views: 900 }), igEntry(8, 10, { views: 1 })]);
  // 앞선 다섯 편(100…500)만 — 한 시간 늦게 관측한 6번 · 뒤에 올린 8번 · 이 편은 빼고 중앙값 300
  assert.deepEqual(j.multiple, { value: 3, median: 300, n: 5, basis: 판정.SAME_AGE });
  assert.match(판정.judgmentLine(j), /평소 대비 3\.0배\(앞선 5편 같은 나이 중앙값 300\)/);
  const few = judge72([...prior.slice(0, 3), igEntry(7, 10, { views: 900 })]);
  assert.deepEqual(few.multiple, { value: null, median: null, n: 3, basis: 판정.SAME_AGE });
  assert.match(판정.judgmentLine(few), /평소 대비 못 잼\(같은 나이로 견줄 앞선 편 3편 — 4편부터\)/);
});

test('같은 나이 배수는 새 판정부터 — 10-31 전에 낸 판정 줄은 굳기 전에도 그 배수를 지키고(다시 덧붙이지 않는다), 처음 내는 판정만 같은 나이로 잰다', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-test-sameage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerFile = path.join(dir, 'docs', '_ops', '게시성과.jsonl');
  const prior = [1, 2, 3, 4, 5].map(n => igEntry(n, 10, { views: n * 100 }));
  await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now: T0 + 10 * 24 * H + 3 * H, data: data({ entries: [...prior, igEntry(7, 10, { views: 900 })] }), shorts: new Map() });
  // 7번의 72시간 줄을 10-31 전 정의(표식 없음 · 그 시각 최근 12편)로 바꿔 둔다 — 그때 도구가 쓴 모양 그대로
  const old = { value: 9.9, median: 91, n: 12 };
  const lines = 도구.readLedger(ledgerFile).map(l => (l.post === 'instagram:CODE7x' && l.point === '72h'
    ? { ...l, multiple: old, line: l.line.replace('평소 대비 3.0배(앞선 5편 같은 나이 중앙값 300)', '평소 대비 9.9배(최근 12편 중앙값 91)') } : l));
  assert.ok(lines.some(l => l.multiple === old && l.line.includes('평소 대비 9.9배(최근 12편 중앙값 91)')));
  fs.writeFileSync(ledgerFile, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  // 이틀 뒤(굳기 전) — 9번이 처음 72시간 판정을 받는다
  const report = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now: T0 + 12 * 24 * H + 3 * H, data: data({ entries: [...prior, igEntry(7, 10, { views: 900 }), igEntry(9, 10, { views: 700 })] }), shorts: new Map() });
  const after = 도구.readLedger(ledgerFile);
  const of = (post, point) => after.filter(l => l.kind === '판정' && l.post === post && l.point === point);
  assert.equal(of('instagram:CODE7x', '72h').length, 1, '지난 판정은 다시 재어 덧붙이지 않는다');
  assert.deepEqual(of('instagram:CODE7x', '72h')[0].multiple, old);
  // 9번 앞의 여섯 편(100…500, 900) → 중앙값 350, 700 ÷ 350 = 2배
  assert.deepEqual(of('instagram:CODE9x', '72h')[0].multiple, { value: 2, median: 350, n: 6, basis: 판정.SAME_AGE });
  assert.ok(report.새판정.every(l => !l.includes('9.9배')));
  // 요약도 지난 판정을 그때 배수 그대로 보인다(3배 목록에 옛 9.9배가 남는다 — 다시 재는 것은 승인 뒤)
  const summary = fs.readFileSync(path.join(dir, 'docs', '마케팅', '게시성과.md'), 'utf8');
  assert.match(summary, /- \*\*평소 대비 3배 넘은 편\*\*[^\n]*인스타 @test\.ig 72시간 9\.9배/);
  assert.match(summary, /평소 대비 9\.9배\(최근 12편 중앙값 91\)/);
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
  // 평소 대비는 앞선 네 편의 72시간 조회(1,000회씩)와 견주고, 새 정의라는 표시를 단다
  assert.deepEqual(result.자동판정.판[0].시점['72시간'].평소대비, { 배수: 1, 중앙값: 1000, 편수: 4, 기준: '앞선 편 같은 나이' });
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

// ── 2주 시험(시청자수요조사 6-9) ─────────────────────────────────────────────
// 장부 줄·편 색인은 합성이다. 시각은 시험 창(10-26 ~ 11-07 KST) 안에 둔다.

const 시험 = require('../tools/lib/게시성과시험.js');
const S0 = Date.parse('2026-10-27T21:00:00+09:00');
const sday = n => S0 + n * 24 * H;
const 판종류 = {
  yt: { platform: 'youtube', format: 'youtube-shorts', label: '유튜브' },
  ig: { platform: 'instagram', format: 'instagram-reels', label: '인스타' },
  tt: { platform: 'tiktok', format: 'tiktok-video', label: '틱톡' },
  fb: { platform: 'facebook', format: 'facebook-reels', label: '페북' },
};

/**
 * 시험 판 하나의 장부 줄 — 24시간 줄, v72가 있으면 72시간 줄(m72 = 평소 대비 배수, null이면 못 잼). r24·r72는 인스타 3초 유지율.
 * 관측은 목표 1분 뒤(늦게72 = 72시간 줄을 목표 몇 시간 뒤에 관측했나), 못씀72 = 기존 판정이 비교에서 뺀 72시간 지표(invalidMetrics)
 */
function 시험판(folder, kind, handle, publishedMs, { v72, m72, r24, r72, 추정 = true, 늦게72 = 0, 못씀72 = null } = {}) {
  const k = 판종류[kind];
  const base = { kind: '판정', post: `${k.platform}:${folder}-${kind}`, url: `https://example.invalid/${kind}/${encodeURIComponent(folder)}`,
    channel: `${k.label} @${handle}`, platform: k.platform, format: k.format, folder, publishedAt: iso(publishedMs), screenMetrics: [], verdict: '자료 부족' };
  const 줄 = (point, hours, metrics, multiple, late = 0, invalid = null) => ({ ...base, at: iso(publishedMs + hours * H + late + 60_000), point,
    observedAt: iso(publishedMs + hours * H + late + 60_000), metrics, multiple, ...(invalid ? { invalidMetrics: invalid } : {}),
    line: `${Object.entries(metrics).map(([m, v]) => `${판정.METRICS[m].label} ${판정.valueText(m, v)}${m === 'earlyRetention3sPct' && 추정 ? '(추정)' : ''}`).join(' · ')} → **자료 부족**` });
  const out = [줄('24h', 24, { views: 50, ...(r24 === undefined ? {} : { earlyRetention3sPct: r24 }) }, { value: 1, median: 50, n: 3 })];
  if (v72 !== undefined) out.push(줄('72h', 72, { views: v72, ...(r72 === undefined ? {} : { earlyRetention3sPct: r72 }) }, m72 === null ? null : { value: m72, median: Math.round(v72 / m72), n: 12 }, 늦게72, 못씀72));
  return out;
}

/** 편 폴더 → 준비.json "시험" 칸(undefined면 시험 밖 편) — 판 목록 없이(장부 줄로 판을 정하는 꼴) */
function 시험색인(map) {
  return { folders: new Map(Object.entries(map).map(([folder, 칸]) => [folder, { folder, prep: { 브랜드: '시험', ...(칸 === undefined ? {} : { 시험: 칸 }) } }])) };
}

/**
 * 편 폴더 → { 칸: 시험 칸, 판: [[계정, 예정 시각]] (준비.json 판 — 시각을 빼면 그 판에 「시각」 칸이 없다), 올림: [[계정, 시각]] (게시결과.json 「게시됨」),
 *             슬롯: 'YYYY-MM-DD' (준비.json 슬롯) }
 */
function 계획색인(spec) {
  return { folders: new Map(Object.entries(spec).map(([folder, s]) => [folder, { folder,
    prep: { 브랜드: '시험', 시험: s.칸, ...(s.슬롯 ? { 슬롯: s.슬롯 } : {}), 판: (s.판 || []).map(([계정, at]) => ({ 계정, ...(at === undefined ? {} : { 시각: iso(at) }) })) },
    result: s.올림 ? { 판: s.올림.map(([계정, at]) => ({ 계정, 상태: '게시됨', 시각: iso(at), 주소: `https://example.invalid/${계정}/${encodeURIComponent(folder)}` })) } : null }])) };
}

/** sns-계정.json에서 읽는 꼴(loadAccounts) — 서버가 받지 않는 네이버 블로그도 섞어 둔다 */
const 시험계정 = [
  { key: 'synkbrief-instagram', platform: 'instagram', handle: '@synkbrief' },
  { key: 'synkbrief-youtube', platform: 'youtube', handle: '@synkbrief' },
  { key: 'shift-naverblog', platform: 'naver-blog', handle: 'synkshift' },
  { key: 'lab-instagram', platform: 'instagram', handle: '@synk.mn' },
  { key: 'lab-facebook', platform: 'facebook', handle: 'facebook.com/synkworld' },
];

test('2주 시험 판 — 72시간 전·값 기다림은 아직, 72시간 창이 닫히면 자료 부족', () => {
  const index = 시험색인({ A편: { 이름: '2주 시험 10-26', 갈래: 'A 장치형' } });
  // 앞편(시험 밖) — 장부에 앞선 편이 있어야 본 비율을 견줄 수 있다(없으면 채널 첫 편이라 본 비율을 판정에서 뺀다)
  const ledger = [...시험판('앞편', 'yt', 'synkkorean', S0 - 5 * 24 * H, { v72: 150, m72: 0.9 }), ...시험판('A편', 'yt', 'synkkorean', S0, {})];
  const at = h => 시험.시험판정({ ledger, index, now: S0 + h * H }).판들[0];
  assert.deepEqual([at(48).판정, at(48).까닭], ['아직', '72시간 전']);
  assert.deepEqual([at(75).판정, at(75).까닭], ['아직', '72시간 값 기다림']);
  assert.deepEqual([at(80).판정, at(80).까닭], ['자료 부족', '72시간 값 없음']);
  // 본 비율은 72시간 전에는 읽을 때가 아니고, 지나면 화면 필요
  assert.equal(at(48).본비율.상태, '72시간 전');
  assert.equal(at(80).본비율.상태, '화면 필요');
});

test('2주 시험 판 — 평소의 2배부터 넘음, 인스타는 3초 유지 30%도 넘어야 하고 「추정」·72시간 값·화면 값을 가린다', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '화면 글' };
  const index = 시험색인(Object.fromEntries(['B', 'C', 'D', 'E', 'F', 'G', 'K', 'L'].map(f => [f, 칸])));
  const ledger = [
    ...시험판('B', 'yt', 'synkkorean', S0, { v72: 400, m72: 2 }),
    ...시험판('C', 'yt', 'synkkorean', S0, { v72: 300, m72: 1.4 }),
    ...시험판('D', 'ig', 'synk.mn', S0, { v72: 500, m72: 3.1, r24: 33.2 }),
    ...시험판('E', 'ig', 'synk.mn', S0, { v72: 500, m72: 3.1, r24: 22.1 }),
    ...시험판('F', 'ig', 'synk.mn', S0, { v72: 500, m72: 3.1 }),
    ...시험판('G', 'ig', 'synk.mn', S0, { v72: 500, m72: 3.1, r72: 41.7, 추정: false }),
    ...시험판('K', 'yt', 'synkkorean', S0, { v72: 120, m72: null }),
    ...시험판('L', 'ig', 'synk.mn', S0, { v72: 120, m72: null, r24: 18 }),
  ];
  const by = Object.fromEntries(시험.시험판정({ ledger, index, now: sday(5) }).판들.map(x => [x.folder, x]));
  assert.deepEqual([by.L.판정, by.L.까닭], ['못 넘음', '3초 유지 18%'], '평소 대비를 못 재도 3초 유지가 모자라면 못 넘음');
  assert.equal(by.B.판정, '기준 넘음', '딱 2배도 넘음');
  assert.deepEqual([by.C.판정, by.C.까닭], ['못 넘음', '조회 1.4배']);
  assert.equal(by.D.판정, '기준 넘음');
  assert.deepEqual(by.D.삼초, { value: 33.2, 때: '24시간', 추정: true });
  assert.deepEqual([by.E.판정, by.E.까닭], ['못 넘음', '3초 유지 22.1%'], '조회가 넘어도 3초 유지가 모자라면 못 넘음');
  assert.deepEqual([by.F.판정, by.F.까닭], ['자료 부족', '3초 유지율 없음']);
  assert.deepEqual([by.G.판정, by.G.삼초], ['기준 넘음', { value: 41.7, 때: '72시간', 추정: false }], '24시간 값이 없으면 72시간 값');
  assert.deepEqual([by.K.판정, by.K.까닭], ['자료 부족', '평소 대비 못 잼']);
  // 서버 값이 없을 때만 화면에서 읽은 3초 유지율(--적기 3초유지율=)을 쓴다
  const screens = new Map([['instagram:F-ig', { metrics: { earlyRetention3sPct: 35 } }], ['instagram:E-ig', { metrics: { earlyRetention3sPct: 90 } }]]);
  const withScreen = Object.fromEntries(시험.시험판정({ ledger, index, now: sday(5), screens }).판들.map(x => [x.folder, x]));
  assert.deepEqual([withScreen.F.판정, withScreen.F.삼초.때], ['기준 넘음', '화면']);
  assert.equal(withScreen.E.판정, '못 넘음');
  // 「추정」은 장부 줄의 판정 글로 읽는다
  assert.equal(시험.추정인가({ metrics: { earlyRetention3sPct: 33.2 }, line: '조회 9 · 3초 유지율 33.2%(추정) · 평균 시청 4초' }, 'earlyRetention3sPct'), true);
  assert.equal(시험.추정인가({ metrics: { earlyRetention3sPct: 33.2 }, line: '조회 9 · 3초 유지율 33.2% · 평균 시청 4초' }, 'earlyRetention3sPct'), false);
});

test('2주 시험 갈래 — 두 플랫폼 계정은 두 곳이 같은 방향일 때만 계속·멈춤, 다르면 엇갈림', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const index = 시험색인({ 편1: 칸, 편2: 칸, 편3: 칸 });
  const 판들 = (ig, yt) => ['편1', '편2', '편3'].flatMap((f, i) => [
    ...시험판(f, 'ig', 'synkbrief', sday(i * 2), { v72: 500, m72: ig[i] ? 3 : 1, r24: 35 }),
    ...시험판(f, 'yt', 'synkbrief', sday(i * 2), { v72: 500, m72: yt[i] ? 3 : 1 }),
  ]);
  const 갈래 = (ig, yt) => 시험.시험판정({ ledger: 판들(ig, yt), index, now: sday(20) }).갈래들;
  const [mixed, ...rest] = 갈래([1, 1, 0], [1, 0, 0]);
  assert.equal(rest.length, 0, '인스타·유튜브가 같은 핸들이면 한 계정');
  assert.equal(mixed.계정.shown, '@synkbrief');
  assert.deepEqual(mixed.platforms, ['youtube', 'instagram']);
  assert.deepEqual(mixed.dims.map(d => [d.이름, d.넘음, d.n, d.상태]), [['유튜브', 1, 3, '멈춤'], ['인스타', 2, 3, '계속']]);
  assert.deepEqual([mixed.방향, mixed.판정.값], ['엇갈림', '엇갈림']);
  const [same] = 갈래([1, 1, 0], [0, 1, 1]);
  assert.deepEqual([same.방향, same.판정.값], ['같음', '계속']);
  const [down] = 갈래([0, 0, 1], [0, 0, 0]);
  assert.deepEqual([down.방향, down.판정.값], ['같음', '멈춤']);
  // 3편이 쌓였으면 남은 편이 어떻게 나와도 바뀌지 않는 판정은 바로 낸다(2편이 이미 넘음) — 아니면 아직
  const 앞둘 = r => ['편1', '편2'].flatMap((f, i) => [
    ...시험판(f, 'ig', 'synkbrief', sday(i * 2), { v72: 500, m72: r[i] ? 3 : 1, r24: 35 }),
    ...시험판(f, 'yt', 'synkbrief', sday(i * 2), { v72: 500, m72: r[i] ? 3 : 1 }),
  ]);
  const 셋째 = [...시험판('편3', 'ig', 'synkbrief', sday(4), {}), ...시험판('편3', 'yt', 'synkbrief', sday(4), {})];
  const [early] = 시험.시험판정({ ledger: [...앞둘([1, 1]), ...셋째], index, now: sday(4) + 30 * H }).갈래들;
  assert.deepEqual([early.방향, early.판정.값], ['같음', '계속']);
  const [wait] = 시험.시험판정({ ledger: [...앞둘([1, 0]), ...셋째], index, now: sday(4) + 30 * H }).갈래들;
  assert.equal(wait.판정.값, '아직');
  assert.equal(wait.판정.까닭, '유튜브 72시간 전 1 · 인스타 72시간 전 1');
});

test('2주 시험 갈래 — 유튜브 하나인 계정은 조회와 본 비율을 따로 세고, 같은 방향일 때만 판정한다', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: 'A 장치형' };
  const index = 시험색인({ 앞편: undefined, T1: 칸, T2: 칸, T3: 칸 });
  const ledger = [
    ...시험판('앞편', 'yt', 'synkkorean', sday(-3), { v72: 150, m72: 0.9 }), // 시험 밖 지난 편 — 본 비율 견줄 값
    ...시험판('T1', 'yt', 'synkkorean', sday(0), { v72: 500, m72: 2.9 }),
    ...시험판('T2', 'yt', 'synkkorean', sday(2), { v72: 500, m72: 2.4 }),
    ...시험판('T3', 'yt', 'synkkorean', sday(4), { v72: 200, m72: 1.1 }),
  ];
  const 본 = values => new Map(Object.entries({ 앞편: 30, ...values }).map(([f, v]) => [`youtube:${f}-yt`, { metrics: { stayedToWatchPct: v } }]));
  const 판정해 = values => 시험.시험판정({ ledger, index, now: sday(20), screens: 본(values) });
  // 본 비율 41(지난 30보다 위) · 25(지난 41·30 중앙 35.5보다 아래) · 45(지난 25·41·30 중앙 30보다 위) → 2/3, 조회도 2/3
  const same = 판정해({ T1: 41, T2: 25, T3: 45 });
  assert.deepEqual(same.판들.find(x => x.folder === 'T2').본비율, { value: 25, median: 35.5, n: 2, 상태: '아래' });
  assert.equal(same.판들.some(x => x.folder === '앞편'), false, '시험 칸이 없는 편은 표에 안 든다');
  const [g] = same.갈래들;
  assert.equal(g.목표, 시험.기준.목표.synkkorean);
  assert.deepEqual(g.dims.map(d => [d.이름, d.넘음, d.상태]), [['조회', 2, '계속'], ['본 비율', 2, '계속']]);
  assert.deepEqual([g.방향, g.판정.값], ['같음', '계속']);
  // 조회는 2/3인데 본 비율이 다 지난 편보다 낮으면 엇갈림
  const [crossed] = 판정해({ T1: 25, T2: 20, T3: 22 }).갈래들;
  assert.deepEqual(crossed.dims.map(d => d.상태), ['계속', '멈춤']);
  assert.deepEqual([crossed.방향, crossed.판정.값], ['엇갈림', '엇갈림']);
  // 본 비율을 아직 화면에서 안 읽었으면 아직
  const [pending] = 판정해({ T1: 41 }).갈래들;
  assert.equal(pending.판정.값, '아직');
  assert.match(pending.판정.까닭, /본 비율 화면 필요 2/);
  // 장부에 앞선 편이 하나도 없는 채널 첫 편은 위·아래를 가르지 않고 판정에서 뺀다(재확인 A2)
  const 첫편 = 시험.시험판정({ ledger: 시험판('T1', 'yt', 'synkkorean', sday(0), { v72: 500, m72: 2.9 }), index, now: sday(20), screens: new Map([['youtube:T1-yt', { metrics: { stayedToWatchPct: 41 } }]]) });
  assert.deepEqual([첫편.판들[0].본비율.상태, 첫편.판들[0].본비율.뺌], ['첫 편', true]);
});

test('2주 시험 — 3편 미만은 아직, 창 밖 편은 표에만 보이고, 판정 줄이 없는 편·시험 칸 모양 오류를 알린다', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '실물 주기' };
  const index = 시험색인({ 둘1: 칸, 둘2: 칸, 이른편: 칸, 아직없음: 칸, 틀린칸: 'A 장치형', 빈갈래: { 이름: '2주 시험 10-26', 갈래: ' ' } });
  const ledger = [
    ...시험판('둘1', 'ig', 'yuhobuilds', sday(0), { v72: 900, m72: 3, r24: 40 }),
    ...시험판('둘2', 'ig', 'yuhobuilds', sday(2), { v72: 900, m72: 3, r24: 40 }),
    ...시험판('이른편', 'ig', 'yuhobuilds', Date.parse('2026-10-25T23:59:00+09:00'), { v72: 900, m72: 3, r24: 40 }),
  ];
  const r = 시험.시험판정({ ledger, index, now: sday(20) });
  assert.equal(r.판들.find(x => x.folder === '이른편').창밖, true);
  assert.equal(r.판들.find(x => x.folder === '둘1').창밖, false);
  assert.equal(r.갈래들.length, 1);
  const [g] = r.갈래들;
  assert.deepEqual([g.편수, g.판정.값, g.판정.까닭], [2, '아직', '2편 — 3편 미만'], '2편이 다 넘어도 3편 전에는 판단하지 않는다');
  assert.equal(g.목표, 시험.기준.목표.yuhobuilds);
  assert.deepEqual(r.판정없는편.map(x => x.folder), ['아직없음']);
  assert.deepEqual(r.칸오류.map(x => x.folder).sort(), ['빈갈래', '틀린칸']);
  // 창 첫날 0시(KST)부터 센다
  const 첫날 = 시험.시험판정({ ledger: 시험판('둘1', 'ig', 'yuhobuilds', Date.parse('2026-10-26T00:00:00+09:00'), {}), index, now: sday(20) });
  assert.equal(첫날.판들[0].창밖, false);
  // 시험 칸이 없는 편만 있으면 아무것도 없다
  assert.deepEqual(시험.시험판정({ ledger, index: 시험색인({ 둘1: undefined }), now: sday(20) }), { 판들: [], 갈래들: [], 판정없는편: [], 칸오류: [], 키확인: [], 안셈: {} });
});

test('시험 칸이 붙은 편이 없으면 요약의 2주 시험 절은 비어 있다 · 판정 줄이 없는 시험 편과 칸 오류는 알린다', () => {
  const text = 도구.summarize({ ledger: [], now: S0, index: null });
  assert.match(text, /- \*\*2주 시험 갈래\*\*[^\n]*: 「시험」 칸이 붙은 편이 아직 없다/);
  assert.match(text, /## 2주 시험\n[\s\S]*\| 아직 없음 \| — \| — \| — \| — \| — \| — \| — \|[\s\S]*\| — \| — \| — \| — \| — \| — \| — \| 아직 없음 \|[\s\S]*## 훅 이름표별/);
  const waiting = 도구.summarize({ ledger: [], now: S0, index: 시험색인({ LAB_새편_20261027: { 이름: '2주 시험 10-26', 갈래: 'A 장치형' }, LAB_틀린편_20261027: { 갈래: 'A 장치형' } }) });
  assert.match(waiting, /- \*\*2주 시험 갈래\*\*[^\n]*: 시험 편 1개에 셀 판이 없다/);
  assert.match(waiting, /- 셀 판을 못 찾은 시험 편\([^\n]*\): \[LAB_새편_20261027\]\([^)]+\)\(A 장치형\)\n/);
  assert.match(waiting, /- 「시험」 칸을 읽지 못한 편: \[LAB_틀린편_20261027\]\([^)]+\) — "이름"과 "갈래"가 빈칸 아닌 글자여야 한다\n/);
});

test('2주 시험 — --실행 요약에 갈래 표·편 표(추정 표시)와 「먼저 볼 것」 한 줄이 생기고, --적기 본 비율이 들어가며, --요약도 같은 표를 낸다', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = args => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.invalid']);
  git(['config', 'user.name', 't']);
  git(['config', 'core.autocrlf', 'false']);
  const IG = 'https://www.instagram.com/reel/TESTIG1x/', YTU = 'https://www.youtube.com/shorts/TESTYT00001';
  const folder = path.join(dir, 'docs', '마케팅', 'synkbrief_시험편_20261027');
  fs.mkdirSync(path.join(folder, '게시'), { recursive: true });
  fs.writeFileSync(path.join(folder, '기획.md'), '1일 1편 · synkbrief · 2026-10-27\n\n# 시험편\n');
  fs.writeFileSync(path.join(folder, '게시', '준비.json'), JSON.stringify({ 브랜드: 'synkbrief', 시험: { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' },
    판: [{ 계정: 'synkbrief-instagram' }, { 계정: 'synkbrief-youtube' }] }));
  fs.writeFileSync(path.join(folder, '게시', '게시결과.json'), JSON.stringify({ 판: [
    { 계정: 'synkbrief-instagram', 상태: '게시됨', 시각: iso(S0), 주소: IG }, { 계정: 'synkbrief-youtube', 상태: '게시됨', 시각: iso(S0), 주소: YTU }] }));
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);
  // 체크포인트 — 지표 단위는 서버와 같게, 3초 유지율은 서버가 어림한 값(estimated)
  const 점 = (hours, metrics, source, estimated = []) => {
    const due = S0 + hours * H, observedAt = iso(due + 2 * 60_000);
    const metricProvenance = Object.fromEntries(Object.keys(metrics).map(k => [k, { source, observedAt, unit: 판정.METRICS[k].unit, timing: 'on-time',
      measurementWindowMissed: false, ...(estimated.includes(k) ? { estimated: true } : {}) }]));
    return { hours, status: 'recorded', dueAt: iso(due), closesAt: iso(due + 6 * H), observedAt, source, metrics, metricProvenance };
  };
  // 인스타 평소 = 앞서 올린 네 편의 72시간 조회 100회 → 이 편 400회는 4배. 유튜브는 앞선 편이 없어 못 잰다
  const peers = [1, 2, 3, 4].map(n => ({ id: `e-p${n}`, channelId: 'c-ig', platform: 'instagram', url: `https://www.instagram.com/reel/PEER${n}x/`, publishedAt: iso(S0 - n * 24 * H),
    publicationFormat: 'instagram-reels', origin: 'auto', checkpoints: [cp(72, S0 - n * 24 * H, { views: 100 })] }));
  const server = {
    checkedAt: iso(S0 + 80 * H),
    channels: [{ id: 'c-ig', platform: 'instagram', handle: 'synkbrief', name: 'IG' }, { id: 'c-yt', platform: 'youtube', handle: 'synkbrief', externalId: YT, name: 'YT' }],
    entries: [
      ...peers,
      { id: 'e-ig', channelId: 'c-ig', platform: 'instagram', url: IG, publishedAt: iso(S0), publicationFormat: 'instagram-reels', origin: 'auto',
        checkpoints: [점(24, { views: 150, earlyRetention3sPct: 33.2 }, 'api:instagram-graph', ['earlyRetention3sPct']), 점(72, { views: 400 }, 'api:instagram-graph')] },
      { id: 'e-yt', channelId: 'c-yt', platform: 'youtube', url: YTU, publishedAt: iso(S0), publicationFormat: 'youtube-shorts', origin: 'auto',
        checkpoints: [점(24, { views: 120 }, 'api:youtube-data-api-v3'), 점(72, { views: 200 }, 'api:youtube-data-api-v3')] },
    ],
    posts: [],
    snapshots: [],
  };
  const now = S0 + 80 * H;
  const first = await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now, data: server, shorts: new Map() });
  assert.equal(first.시험, '시험 편 1 · 판 2 · 갈래 1(아직 1)');
  const summaryFile = path.join(dir, 'docs', '마케팅', '게시성과.md');
  const summary = fs.readFileSync(summaryFile, 'utf8');
  const 갈래줄 = '| 2주 시험 10-26 | @synkbrief(유튜브·인스타) | 지금 막힌 것 | 1 | 유튜브 0/1(자료 부족 1) · 인스타 1/1 | — | 아직(1편 — 3편 미만) | — |';
  assert.ok(summary.includes(갈래줄), summary);
  assert.match(summary, /\| \[synkbrief_시험편_20261027\]\([^)]+\) \| 인스타 @synkbrief \| 지금 막힌 것 \| 400회 · 4\.0배\(앞선 4편 같은 나이 중앙값 100\) \| 33\.2%\(추정\) \| — \| \*\*기준 넘음\*\* \|/);
  // 유튜브 판은 이 채널의 장부 첫 편이라 본 비율을 견줄 지난 편이 없다 — 판정에서 빼고 표에만 적는다(재확인 A2).
  // 조회도 같은 나이로 견줄 앞선 편이 없어 끝내 못 잰다(10-31 전에는 이 편만 든 기준으로 늘 1.0배 → 못 넘음이었다)
  assert.match(summary, /\| 유튜브 @synkbrief \| 지금 막힌 것 \| 200회 · 평소 대비 못 잼 \| — \| 첫 편이라 판정에서 뺌 \| 자료 부족\(평소 대비 못 잼 — 같은 나이로 견줄 앞선 편 0편\) \|/);
  assert.match(summary, /- \*\*2주 시험 갈래\*\*[^\n]*: 계속 — 없음 \/ 멈춤 — 없음 \/ 그 밖 1갈래\(아직 1\)/);
  // 기존 판정 줄은 그대로 — 이전 편이 모자라 「자료 부족」
  assert.match(summary, /인스타 @synkbrief \| 72시간 \| [^\n]*→ \*\*자료 부족\*\*/);
  // 화면에서 읽은 본 비율을 적으면 편 표에 들어간다(첫 편이라 판정에서는 뺀다)
  await 도구.run({ 실행: true, 저장소: dir, 적기: YTU, 값들: ['본비율=41'] }, { now, data: server, shorts: new Map() });
  assert.match(fs.readFileSync(summaryFile, 'utf8'), /\| 41%\(화면\) · 첫 편이라 판정에서 뺌 \| 자료 부족\(평소 대비 못 잼 — 같은 나이로 견줄 앞선 편 0편\) \|/);
  // 서버를 읽지 않는 --요약도 장부만으로 같은 표를 낸다
  const again = await 도구.run({ 요약: true, 저장소: dir, 값들: [] }, { now });
  assert.ok(again.요약.includes(갈래줄));
  assert.match(again.요약, /\| 41%\(화면\) · 첫 편이라 판정에서 뺌 \|/);
});

// ── 2주 시험 2차 검수(10-23 아르곤·GPT) 재현 ────────────────────────────────

test('2주 시험 갈래 — 플랫폼은 그 편들의 준비.json 판으로 정한다: 장부에 아직 없는 판은 아직·자료 부족으로 남아 「한 곳」 계속이 나지 않는다(A2·GA1)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const 판 = at => [['synkbrief-instagram', at], ['synkbrief-youtube', at], ['shift-naverblog', at]];
  const 유튜브올림 = [['synkbrief-youtube', sday(5)]];
  const index = 계획색인({ 편1: { 칸, 판: 판(sday(0)), 올림: 유튜브올림 }, 편2: { 칸, 판: 판(sday(2)), 올림: 유튜브올림 }, 편3: { 칸, 판: 판(sday(4)), 올림: 유튜브올림 } });
  // 인스타 세 편은 조회 4배 · 3초 유지 40%로 다 넘었다. 유튜브는 늦게(11-01) 올려 아직 판정 줄이 없다
  const ledger = ['편1', '편2', '편3'].flatMap((f, i) => 시험판(f, 'ig', 'synkbrief', sday(i * 2), { v72: 900, m72: 4, r24: 40 }));
  const 판정해 = now => 시험.시험판정({ ledger, index, accounts: 시험계정, now });
  const [g] = 판정해(sday(5) + 10 * H).갈래들;
  assert.deepEqual(g.platforms, ['youtube', 'instagram'], '서버가 받지 않는 네이버 블로그는 셈에 안 든다');
  assert.deepEqual(g.dims.map(d => [d.이름, d.넘음, d.n, d.상태]), [['유튜브', 0, 3, '아직'], ['인스타', 3, 3, '계속']]);
  assert.deepEqual([g.방향, g.판정.값], ['—', '아직']);
  assert.match(g.판정.까닭, /유튜브 판정 줄 기다림 3/);
  // 창이 다 닫혀도 유튜브 값이 끝내 안 오면 자료 부족 — 인스타 하나로 계속이 나지 않는다
  const late = 판정해(sday(30));
  assert.deepEqual([late.갈래들[0].방향, late.갈래들[0].판정.값], ['—', '자료 부족']);
  const 빈판 = late.판들.filter(x => x.platform === 'youtube');
  assert.equal(빈판.length, 3, '편 표에 빈 판도 보인다');
  assert.ok(빈판.every(x => x.빈판 && x.판정 === '자료 부족' && /판정 줄 없음/.test(x.까닭)), JSON.stringify(빈판.map(x => x.까닭)));
  // 아직 안 올린 판은 예정 시각 뒤 72시간 창이 닫힐 때까지 「올리기 전」
  const plan = 시험.시험판정({ ledger, index: 계획색인({ 편1: { 칸, 판: 판(sday(0)) } }), accounts: 시험계정, now: sday(0) + 10 * H }).판들;
  assert.ok(plan.some(x => x.platform === 'youtube' && x.판정 === '아직' && x.까닭 === '올리기 전'));
});

test('2주 시험 갈래 — 페북 교차 게시 계정은 따로 묶이고, 같은 편이라도 준비.json에 없는 판은 표에만 보인다', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '화면 글' };
  const index = 계획색인({ 몽1: { 칸, 판: [['lab-instagram', sday(0)], ['lab-facebook', sday(0)]] } });
  const ledger = [
    ...시험판('몽1', 'ig', 'synk.mn', sday(0), { v72: 300, m72: 2.5, r24: 35 }),
    ...시험판('몽1', 'fb', 'synkworld', sday(0), { v72: 40, m72: 1 }),
    ...시험판('몽1', 'tt', 'synklab.mm', sday(0), { v72: 900, m72: 5 }),
  ];
  const r = 시험.시험판정({ ledger, index, accounts: 시험계정, now: sday(20) });
  assert.deepEqual(r.갈래들.map(g => [g.계정.shown, g.platforms.join('·')]), [['@synk.mn', 'instagram'], ['@synkworld', 'facebook']]);
  const 틱톡 = r.판들.find(x => x.platform === 'tiktok');
  assert.deepEqual([틱톡.따로, 틱톡.판정], [true, '기준 넘음'], '판정은 보이되 갈래에는 안 센다');
});

test('2주 시험 갈래 — 일찍 정하기는 플랫폼마다 준비.json에 잡힌 판 수까지 보고, 남은 판이 어떻게 나와도 안 바뀔 때만(A1)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const 둘 = at => [['synkbrief-instagram', at], ['synkbrief-youtube', at]];
  // 편마다 인스타·유튜브 줄 — 1 넘음 · 0 못 넘음 · null 72시간 전(24시간 줄만) · undefined 줄 없음
  const 줄 = (f, d, ig, yt) => [ig, yt].flatMap((v, i) => (v === undefined ? [] : 시험판(f, i ? 'yt' : 'ig', 'synkbrief', sday(d),
    v === null ? { r24: 35 } : { v72: 500, m72: v ? 3 : 1, r24: 35 })));
  // ① 유튜브를 세 편 다 잡았고 셋째가 아직이면: 1/2 넘음은 셋째에 따라 갈리니 아직, 0/2는 셋째가 넘어도 1/3이라 멈춤
  const index = 계획색인({ 편1: { 칸, 판: 둘(sday(0)) }, 편2: { 칸, 판: 둘(sday(2)) }, 편3: { 칸, 판: 둘(sday(4)) } });
  const 판정해 = (ledger, now, idx = index) => 시험.시험판정({ ledger, index: idx, accounts: 시험계정, now }).갈래들[0];
  const now = sday(4) + 30 * H;
  const half = 판정해([...줄('편1', 0, 1, 1), ...줄('편2', 2, 1, 0), ...줄('편3', 4, null, null)], now);
  assert.deepEqual(half.dims.map(d => [d.이름, d.넘음, d.n, d.상태]), [['유튜브', 1, 3, '아직'], ['인스타', 2, 3, '계속']]);
  assert.equal(half.판정.값, '아직');
  const none = 판정해([...줄('편1', 0, 1, 0), ...줄('편2', 2, 1, 0), ...줄('편3', 4, null, null)], now);
  assert.deepEqual([none.dims.map(d => d.상태), none.판정.값], [['멈춤', '계속'], '엇갈림']);
  // ② 준비.json이 유튜브를 두 편에만 잡았으면 더 올라올 유튜브 판이 없다 — 셋째를 기다리지 않고 그 두 편으로 정한다
  const index2 = 계획색인({ 편1: { 칸, 판: 둘(sday(0)) }, 편2: { 칸, 판: 둘(sday(2)) }, 편3: { 칸, 판: [['synkbrief-instagram', sday(4)]] } });
  const two = 판정해([...줄('편1', 0, 1, 1), ...줄('편2', 2, 1, 0), ...줄('편3', 4, 1)], sday(20), index2);
  assert.deepEqual(two.dims.map(d => [d.이름, d.넘음, d.n, d.상태]), [['유튜브', 1, 2, '멈춤'], ['인스타', 3, 3, '계속']]);
  assert.equal(two.판정.값, '엇갈림');
});

test('2주 시험 갈래 — 게시 순 앞 3편만 세고 넷째부터는 표에만, 창이 닫혀 값이 끝내 안 온 판은 기다리지 않는다(A3)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '화면 글' };
  const index = 시험색인({ T1: 칸, T2: 칸, T3: 칸, T4: 칸 });
  const 넘 = (f, d) => 시험판(f, 'ig', 'synk.mn', sday(d), { v72: 500, m72: 3, r24: 35 });
  const 못 = (f, d) => 시험판(f, 'ig', 'synk.mn', sday(d), { v72: 200, m72: 1, r24: 35 });
  const 빈 = (f, d) => 시험판(f, 'ig', 'synk.mn', sday(d), { r24: 35 }); // 72시간 값이 끝내 안 왔다
  const 판정해 = ledger => 시험.시험판정({ ledger, index, now: sday(20) });
  // ① 앞 3편이 1/3이라 멈춤 — 넷째가 넘어도 바뀌지 않는다(값을 보고 편을 더해 판정을 돌리지 않게)
  const r = 판정해([...넘('T1', 0), ...못('T2', 2), ...못('T3', 4), ...넘('T4', 6)]);
  assert.deepEqual([r.갈래들[0].편수, r.갈래들[0].센편수, r.갈래들[0].판정.값], [4, 3, '멈춤']);
  assert.equal(r.판들.find(x => x.folder === 'T4').표만, true);
  assert.equal(r.판들.find(x => x.folder === 'T3').표만, undefined);
  // ② 앞 3편 가운데 하나가 자료 부족(창이 닫힘)이어도 재진 두 편이 1/2면 멈춤 — 자료 부족에 머물지 않는다
  assert.equal(판정해([...빈('T1', 0), ...넘('T2', 2), ...못('T3', 4), ...못('T4', 6)]).갈래들[0].판정.값, '멈춤');
  // ③ 재진 판이 둘보다 적으면 멈춤으로 보지 않는다 — 값이 거의 없는 갈래를 접지 않게
  assert.equal(판정해([...빈('T1', 0), ...빈('T2', 2), ...넘('T3', 4)]).갈래들[0].판정.값, '자료 부족');
});

test('2주 시험 판 — 기존 판정이 비교에서 뺀 72시간 값(측정 창 밖 관측 · invalidMetrics)은 쓰지 않는다(GA2)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '화면 글' };
  const index = 시험색인({ 늦음: 칸, 뺌: 칸, 제때: 칸, 늦은3초: 칸 });
  const ledger = [
    ...시험판('늦음', 'ig', 'synk.mn', sday(0), { v72: 400, m72: 4, r24: 40, 늦게72: 7 * H }),
    ...시험판('뺌', 'ig', 'synk.mn', sday(1), { v72: 400, m72: 4, r24: 40, 못씀72: ['views'] }),
    ...시험판('제때', 'ig', 'synk.mn', sday(2), { v72: 400, m72: 4, r24: 40 }),
    ...시험판('늦은3초', 'ig', 'synk.mn', sday(3), { v72: 400, m72: 4, r24: 40, r72: 25 }),
  ];
  // 24시간 줄을 측정 창(목표 + 6시간) 밖에서 관측했다 → 그 3초 유지율 대신 72시간 값(25%)
  const l24 = ledger.find(l => l.folder === '늦은3초' && l.point === '24h');
  l24.observedAt = iso(sday(3) + 31 * H);
  const by = Object.fromEntries(시험.시험판정({ ledger, index, now: sday(20) }).판들.map(x => [x.folder, x]));
  assert.deepEqual([by.늦음.판정, by.늦음.까닭, by.늦음.multiple], ['자료 부족', '72시간 값이 측정 창 밖', null]);
  assert.deepEqual([by.뺌.판정, by.뺌.까닭], ['자료 부족', '72시간 조회를 기존 판정이 비교에서 뺐다']);
  assert.equal(by.제때.판정, '기준 넘음');
  assert.deepEqual([by.늦은3초.판정, by.늦은3초.삼초.때, by.늦은3초.까닭], ['못 넘음', '72시간', '3초 유지 25%']);
});

test('2주 시험 — 실제 판정 경로에서 72시간 목표보다 7시간 늦게 관측한 조회는 장부에 invalidMetrics로 남고 시험 판정에 안 들어간다(GA2)', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-post-test-late-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = args => { const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); };
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.invalid']);
  git(['config', 'user.name', 't']);
  git(['config', 'core.autocrlf', 'false']);
  const IG = 'https://www.instagram.com/reel/LATEIG1x/';
  const folder = path.join(dir, 'docs', '마케팅', 'synkbrief_늦은관측_20261027');
  fs.mkdirSync(path.join(folder, '게시'), { recursive: true });
  fs.writeFileSync(path.join(folder, '기획.md'), '1일 1편 · synkbrief · 2026-10-27\n\n# 늦은 관측\n');
  fs.writeFileSync(path.join(folder, '게시', '준비.json'), JSON.stringify({ 브랜드: 'synkbrief', 시험: { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' }, 판: [{ 계정: 'synkbrief-instagram' }] }));
  fs.writeFileSync(path.join(folder, '게시', '게시결과.json'), JSON.stringify({ 판: [{ 계정: 'synkbrief-instagram', 상태: '게시됨', 시각: iso(S0), 주소: IG }] }));
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);
  const 점 = (hours, metrics, late = 2 * 60_000, estimated = []) => {
    const due = S0 + hours * H, observedAt = iso(due + late);
    const metricProvenance = Object.fromEntries(Object.keys(metrics).map(k => [k, { source: 'api:instagram-graph', observedAt, unit: 판정.METRICS[k].unit,
      timing: 'on-time', measurementWindowMissed: false, ...(estimated.includes(k) ? { estimated: true } : {}) }]));
    return { hours, status: 'recorded', dueAt: iso(due), closesAt: iso(due + 6 * H), observedAt, source: 'api:instagram-graph', metrics, metricProvenance };
  };
  const peers = [1, 2, 3, 4].map(n => ({ id: `c-ig:P${n}`, channelId: 'c-ig', url: `https://www.instagram.com/reel/PEER${n}x/`, publishedAt: iso(S0 - n * 24 * H), publicationFormat: 'instagram-reels' }));
  const server = {
    checkedAt: iso(S0 + 90 * H),
    channels: [{ id: 'c-ig', platform: 'instagram', handle: 'synkbrief', name: 'IG' }],
    entries: [{ id: 'e-ig', channelId: 'c-ig', platform: 'instagram', url: IG, publishedAt: iso(S0), publicationFormat: 'instagram-reels', origin: 'auto',
      checkpoints: [점(24, { views: 150, earlyRetention3sPct: 40 }, 2 * 60_000, ['earlyRetention3sPct']), 점(72, { views: 400 }, 7 * H)] }],
    posts: peers,
    snapshots: peers.map(p => [p.id, S0 + 71 * H, 100]),
  };
  const now = S0 + 90 * H;
  await 도구.run({ 실행: true, 저장소: dir, 값들: [] }, { now, data: server, shorts: new Map() });
  const line = 도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl')).find(l => l.kind === '판정' && l.point === '72h');
  // 측정 창 밖에서 관측한 값은 같은 나이가 아니라 평소 대비도 못 잰다(10-31 전에는 그 시각 최근 편과 견줘 4배였다)
  assert.deepEqual(line.multiple, { value: null, median: null, n: 0, basis: 판정.SAME_AGE });
  assert.ok(line.invalidMetrics.includes('views'), '기존 판정이 비교에서 뺀 지표를 장부에 남긴다');
  assert.equal(line.verdict, '자료 부족');
  const summary = fs.readFileSync(path.join(dir, 'docs', '마케팅', '게시성과.md'), 'utf8');
  assert.match(summary, /\| 인스타 @synkbrief \| 지금 막힌 것 \| 400회 · 안 씀 \| 40%\(추정\) \| — \| 자료 부족\(72시간 값이 측정 창 밖\) \|/);
  // 제때 관측한 판정 줄에는 invalidMetrics 칸이 없다(장부 줄 모양이 그대로라 옛 판정이 다시 덧붙지 않는다)
  assert.equal(도구.readLedger(path.join(dir, 'docs', '_ops', '게시성과.jsonl')).find(l => l.kind === '판정' && l.point === '24h').invalidMetrics, undefined);
});

// ── 2주 시험 재확인 검수(10-23 아르곤 A1·A2 · GPT GA1~GA4) 재현 ─────────────

test('2주 시험 판 — 준비.json 판에 시각이 없어도 안 올린 판이 아직에 갇히지 않는다: 같은 편의 첫 실제 게시, 없으면 슬롯 날짜로 잰다(재확인 A1)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const 판 = [['synkbrief-instagram'], ['synkbrief-youtube']]; // 「시각」 칸 없음
  // 인스타만 올렸고(장부에 있다) 유튜브는 끝내 안 올렸다
  const index = 계획색인({ 편1: { 칸, 판 } });
  const ledger = 시험판('편1', 'ig', 'synkbrief', sday(0), { v72: 900, m72: 4, r24: 40 });
  const yt = now => 시험.시험판정({ ledger, index, accounts: 시험계정, now }).판들.find(x => x.platform === 'youtube');
  assert.deepEqual([yt(sday(0) + 50 * H).판정, yt(sday(0) + 50 * H).까닭], ['아직', '올리기 전']);
  assert.deepEqual([yt(sday(20)).판정, yt(sday(20)).까닭], ['자료 부족', '올린 기록 없음']);
  // 아무 판도 안 올렸으면 슬롯 날짜(그날 끝, KST)부터 잰다
  const index2 = 계획색인({ 편2: { 칸, 판, 슬롯: '2026-10-28' } });
  const 빈 = now => 시험.시험판정({ ledger: [], index: index2, accounts: 시험계정, now }).판들;
  assert.equal(빈(Date.parse('2026-10-30T12:00:00+09:00')).filter(x => x.판정 === '아직' && x.까닭 === '올리기 전').length, 2);
  assert.equal(빈(Date.parse('2026-11-01T12:00:00+09:00')).filter(x => x.판정 === '자료 부족' && x.까닭 === '올린 기록 없음').length, 2);
});

test('2주 시험 갈래 — 채널 첫 편(장부에 그보다 앞선 같은 계정·형식 편이 없다)의 본 비율은 끝내 견줄 수 없어 판정에서 빼고 표에만 적는다(재확인 A2)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: 'A 장치형' };
  const index = 시험색인({ 앞편: undefined, T1: 칸, T2: 칸, T3: 칸 });
  const 줄 = 앞편도 => [
    ...(앞편도 ? 시험판('앞편', 'yt', 'newtube', sday(-5), { v72: 150, m72: 0.9 }) : []),
    ...시험판('T1', 'yt', 'newtube', sday(0), { v72: 500, m72: 3 }),
    ...시험판('T2', 'yt', 'newtube', sday(2), { v72: 500, m72: 3 }),
    ...시험판('T3', 'yt', 'newtube', sday(4), { v72: 200, m72: 1 }),
  ];
  const 읽음 = { T1: 41, T2: 25, T3: 45 };
  const screens = new Map(Object.entries(읽음).map(([f, v]) => [`youtube:${f}-yt`, { metrics: { stayedToWatchPct: v } }]));
  const r = 시험.시험판정({ ledger: 줄(false), index, now: sday(20), screens });
  const t1 = r.판들.find(x => x.folder === 'T1');
  assert.deepEqual([t1.본비율.value, t1.본비율.상태, t1.본비율.뺌], [41, '첫 편', true]);
  // 본 비율은 T2(25 < 41)·T3(45 > 33) 두 편으로 센다 — 1/2라 멈춤이고 조회 2/3 계속과 엇갈린다(전에는 T1을 기다려 영영 아직이었다)
  const [g] = r.갈래들;
  assert.deepEqual(g.dims.map(d => [d.이름, d.넘음, d.n, d.상태]), [['조회', 2, 3, '계속'], ['본 비율', 1, 2, '멈춤']]);
  assert.equal(g.판정.값, '엇갈림');
  // 장부에 앞선 편이 있는데 그 편 본 비율만 안 읽었으면 영구가 아니다 — 그 편을 화면에서 읽으면 정해진다
  const t1b = 시험.시험판정({ ledger: 줄(true), index, now: sday(20), screens }).판들.find(x => x.folder === 'T1');
  assert.deepEqual([t1b.본비율.상태, t1b.본비율.뺌], ['견줄 지난 편 없음', undefined]);
  // 요약 표에는 첫 편 값이 그대로 적힌다
  const 화면줄 = Object.entries(읽음).map(([f, v]) => ({ at: iso(sday(10)), kind: '화면', post: `youtube:${f}-yt`, url: 'https://example.invalid/', ageHours: 100, metrics: { stayedToWatchPct: v } }));
  const text = 도구.summarize({ ledger: [...줄(false), ...화면줄], now: sday(20), index });
  assert.match(text, /\| \[T1\]\([^)]+\) \| 유튜브 @newtube \| A 장치형 \| [^|]+ \| — \| 41%\(화면\) · 첫 편이라 판정에서 뺌 \|/);
});

test('2주 시험 갈래 — 3편 조건은 실제로 올린 편으로 센다: 예정 편은 기다림일 뿐이라 두 편만 올렸으면 아직(재확인 GA1)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const ig = at => [['synkbrief-instagram', at]];
  const index = 계획색인({ 편1: { 칸, 판: ig(sday(-1)) }, 편2: { 칸, 판: ig(sday(0)) }, 편3: { 칸, 판: ig(sday(7)) } });
  const ledger = [...시험판('편1', 'ig', 'synkbrief', sday(-1), { v72: 900, m72: 4, r24: 40 }), ...시험판('편2', 'ig', 'synkbrief', sday(0), { v72: 900, m72: 4, r24: 40 })];
  const [g] = 시험.시험판정({ ledger, index, accounts: 시험계정, now: sday(4) }).갈래들;
  assert.deepEqual([g.편수, g.게시편수, g.판정.값], [3, 2, '아직']);
  assert.equal(g.판정.까닭, '2편 게시(예정 1편) — 3편 미만');
  // 셋째를 올리면(판정 줄 전이라도) 3편이 쌓였고 2편이 이미 넘었으니 계속
  const 올림 = 계획색인({ 편1: { 칸, 판: ig(sday(-1)) }, 편2: { 칸, 판: ig(sday(0)) }, 편3: { 칸, 판: ig(sday(3)), 올림: [['synkbrief-instagram', sday(3)]] } });
  assert.equal(시험.시험판정({ ledger, index: 올림, accounts: 시험계정, now: sday(4) }).갈래들[0].판정.값, '계속');
});

test('2주 시험 판 — 본 비율은 72시간 전에는 화면 값이 있어도 아직이고, 72시간 전에 읽은 값은 다시 읽는다(재확인 GA2)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: 'A 장치형' };
  const index = 시험색인({ 앞편: undefined, T1: 칸, T2: 칸, T3: 칸 });
  const now = sday(10);
  // 게시 나이 126·78·30시간 — 앞 두 편은 조회를 넘었고 본 비율은 지난 30%에 20·40·50%
  const ledger = [
    ...시험판('앞편', 'yt', 'synkkorean', now - 300 * H, { v72: 150, m72: 0.9 }),
    ...시험판('T1', 'yt', 'synkkorean', now - 126 * H, { v72: 500, m72: 3 }),
    ...시험판('T2', 'yt', 'synkkorean', now - 78 * H, { v72: 500, m72: 3 }),
    ...시험판('T3', 'yt', 'synkkorean', now - 30 * H, {}),
  ];
  const 본 = (extra = {}) => new Map(Object.entries({ 앞편: 30, T1: 20, T2: 40, T3: 50 }).map(([f, v]) => [`youtube:${f}-yt`, { metrics: { stayedToWatchPct: v }, ...(extra[f] || {}) }]));
  const r = 시험.시험판정({ ledger, index, now, screens: 본() });
  assert.equal(r.판들.find(x => x.folder === 'T3').본비율.상태, '72시간 전');
  const [g] = r.갈래들;
  assert.deepEqual(g.dims.map(d => [d.이름, d.상태]), [['조회', '계속'], ['본 비율', '아직']]);
  assert.equal(g.판정.값, '아직');
  // 72시간 전에 읽은 화면 값은 72시간이 지나도 쓰지 않는다(다시 읽는다)
  const early = 시험.시험판정({ ledger, index, now, screens: 본({ T2: { ageHours: 30 } }) });
  assert.equal(early.판들.find(x => x.folder === 'T2').본비율.상태, '72시간 뒤 다시 읽기');
});

test('2주 시험 — 창은 편의 첫 실제 게시로 잰다: 올린 판이 있으면 안 올린 판의 지난 예정 시각을 섞지 않는다(재확인 GA3)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const 실제 = Date.parse('2026-10-27T21:00:00+09:00'), 지난예정 = Date.parse('2026-10-25T21:00:00+09:00');
  const index = 계획색인({ 편1: { 칸, 판: [['synkbrief-instagram', 실제], ['synkbrief-youtube', 지난예정]] } });
  const ledger = 시험판('편1', 'ig', 'synkbrief', 실제, { v72: 900, m72: 4, r24: 40 });
  const r = 시험.시험판정({ ledger, index, accounts: 시험계정, now: sday(3) });
  assert.deepEqual(r.판들.map(x => [x.platform, x.창밖]), [['youtube', false], ['instagram', false]]);
  assert.equal(r.갈래들.length, 1);
  // 아무 판도 안 올렸으면 예정 시각으로 잰다 — 가장 이른 예정(10-25)이 창 밖이면 창 밖
  assert.ok(시험.시험판정({ ledger: [], index, accounts: 시험계정, now: sday(3) }).판들.every(x => x.창밖));
});

test('2주 시험 갈래 — 계정표에서 못 찾은 판 계정 키는 「계정 키 확인」으로 남기고 그 갈래를 정하지 않으며, 서버가 안 받는 플랫폼은 세지 않는다고 적는다(재확인 GA4)', () => {
  const 칸 = { 이름: '2주 시험 10-26', 갈래: '지금 막힌 것' };
  const 판 = at => [['synkbrief-instagram', at], ['synkbrief-youtbe', at], ['shift-naverblog', at]]; // 유튜브 키 오타
  const index = 계획색인({ 편1: { 칸, 판: 판(sday(0)) }, 편2: { 칸, 판: 판(sday(2)) }, 편3: { 칸, 판: 판(sday(4)) } });
  const ledger = ['편1', '편2', '편3'].flatMap((f, i) => 시험판(f, 'ig', 'synkbrief', sday(i * 2), { v72: 900, m72: 4, r24: 40 }));
  const r = 시험.시험판정({ ledger, index, accounts: 시험계정, now: sday(20) });
  const [g] = r.갈래들;
  assert.deepEqual(g.키확인, ['synkbrief-youtbe']);
  assert.equal(g.판정.값, '아직', '인스타 하나로 계속이 나지 않는다');
  assert.match(g.판정.까닭, /계정 키 확인 — synkbrief-youtbe/);
  assert.deepEqual(r.키확인.map(x => [x.folder, x.key]), [['편1', 'synkbrief-youtbe'], ['편2', 'synkbrief-youtbe'], ['편3', 'synkbrief-youtbe']]);
  assert.deepEqual(r.안셈, { 'naver-blog': 3 });
  // 요약에도 남는다
  const text = 도구.summarize({ ledger, now: sday(20), index, accounts: 시험계정 });
  assert.match(text, /\| @synkbrief\(인스타\) \| 지금 막힌 것 \| 3 \| [^|]+ \| 한 곳 \| 아직\(계정 키 확인 — synkbrief-youtbe\) \|/);
  assert.match(text, /- 계정 키 확인\([^\n]*\): \[편1\]\([^)]+\) synkbrief-youtbe/);
  assert.match(text, /- 서버가 받지 않아 세지 않는 판: 네이버 블로그 3/);
});
