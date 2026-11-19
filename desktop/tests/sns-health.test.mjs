// 솔리오 「계정 건강」(2026-11-19): 요약 파일 읽기(sns-health.cjs)와 방의 글 다듬기(sns-health-model.mjs).
// 끝의 이어 보기 시험은 진단 도구(tools/lib/계정건강.js)가 실제로 낸 방을 요약으로 써서 본체와 모델을 지나게 한다 —
// 도구와 앱의 꼴이 어긋나면 그 시험이 깨진다. 설계: docs/디자인/솔리오_계정건강_20261119/PC앱_구현설계.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { snsHealthView, rowSpeech, SNS_HEALTH_NAME, LIMITS } from '../renderer/sns-health-model.mjs';

const require = createRequire(import.meta.url);
const { createSnsHealth, defaultFile, defaultViewersFile, shapeProblem, MAX_BYTES } = require('../src/sns-health.cjs');
const { 진단, 방 } = require('../../tools/lib/계정건강.js');
const { 요약, 요약쓰기 } = require('../../tools/계정건강.js');

const NOW = new Date(2026, 10, 24, 12, 0).getTime();
const iso = t => new Date(t).toISOString();
const ME = { synk_user_id: 'user-yuho-0001', display_name: '유호' };
const OTHER = { synk_user_id: 'user-demo-0002', display_name: '시연' };

const account = (more = []) => ({ key: 'synkbrief-instagram', nm: '인스타그램 @synkbrief', mid: '보고 지나가는 계정', val: '건강하지 않음', when: '팔로워 0 · 한 편 133번', now: 1, unread: 0, more });
const MORE = [
  ['say', '한 편의 조회는 133번쯤입니다.'],
  ['good', '잘하고 있는 것', '꾸준히 올립니다.'],
  ['head', '조회 1,000번이 가는 길'],
  ['flow', [
    { 이름: '첫 장면', 명: 348.5, 큰: null, 글: '349명이 3초 넘게 봅니다', 판정: '보통', 샘: false },
    { 이름: '보는 길이', 명: null, 큰: '62%', 글: '본 사람은 평균해서 편의 62%를 봅니다', 판정: '보통', 샘: false },
    { 이름: '반응', 명: 1.46, 큰: null, 글: '1.5명이 보내거나 저장하거나 댓글을 답니다', 판정: '나쁨', 샘: true },
    { 이름: '팔로우', 명: 0, 큰: null, 글: '아직 아무도 팔로우하지 않습니다', 판정: '나쁨', 샘: false },
  ], '가장 먼저 새는 곳은 반응입니다.'],
  ['text', '잘된 3편은 1,261번, 안 된 3편은 2번입니다.'],
  ['row', '본 사람이 반응하는가', '보고 지나갑니다.', '나쁨', '평균의 23%'],
  ['row', '꾸준히 올리는가', '지난 14일 동안 9편을 올렸습니다.', '좋음', '2주에 9편'],
  ['do', '할 일 1', '보내고 싶은 편을 만듭니다.'],
  ['goal', '다음 목표', '조회 1,000번에 공유 2번입니다.'],
  ['note', '숫자는 올린 지 사흘째의 값입니다.'],
];
const summary = (patch = {}) => ({
  판: 1, 만든때: iso(NOW - 3600e3),
  방: { say: '진단한 계정 2개 가운데 하나가 건강합니다.', then: '인스타그램 @synkbrief부터 봅니다.', scope: '진단 2 · 아직 이른 계정 1',
    rows: [account(MORE), { key: 'synkmn-tiktok', nm: '틱톡 @synk.mn', mid: '반응이 진한 계정', val: '건강함', when: '팔로워 1,204 · 한 편 2,310번', now: 0, unread: 0, more: [['say', '보내는 사람이 많습니다.']] }] },
  ...patch,
});
const ok = s => ({ ok: true, available: true, summary: s });

/** 임시 폴더에 요약과 볼 계정 파일을 두고 본체를 만든다 */
function place({ body, viewers } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sns-health-'));
  const file = path.join(dir, 'sns-health', 'summary.json'), viewersFile = path.join(dir, 'site-visits', 'viewers.json');
  fs.mkdirSync(path.dirname(file)); fs.mkdirSync(path.dirname(viewersFile));
  if (body !== undefined) fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body));
  if (viewers !== undefined) fs.writeFileSync(viewersFile, typeof viewers === 'string' ? viewers : JSON.stringify({ synk_user_ids: viewers }));
  return { dir, file, viewersFile, health: createSnsHealth({ file, viewersFile }) };
}

test('the program name is the word Yuho used', () => {
  assert.equal(SNS_HEALTH_NAME, '계정 건강');
});

/* ── 본체: 어디서 읽고 누구에게 주나 ── */

test('the summary lives beside the app data and the viewer list is the one 방문자 분석 uses', () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' };
  assert.equal(defaultFile(env, 'win32'), path.join(env.LOCALAPPDATA, 'synk', 'sns-health', 'summary.json'));
  assert.equal(defaultViewersFile(env, 'win32'), path.join(env.LOCALAPPDATA, 'synk', 'site-visits', 'viewers.json'));
  assert.equal(defaultFile({}, 'win32'), null);
  assert.equal(defaultFile(env, 'darwin'), null);
  assert.equal(defaultFile({ SYNK_SNS_HEALTH_SUMMARY: 'X:\\t\\s.json' }, 'darwin'), 'X:\\t\\s.json');
  assert.equal(defaultViewersFile({ SYNK_SITE_VISITS_SUMMARY: path.join('X:', 't', 'summary.json') }, 'darwin'), path.join('X:', 't', 'viewers.json'));
});

test('nothing is offered when there is no summary, no viewer list, or the account is not on it', () => {
  const none = { ok: true, available: false };
  assert.deepEqual(createSnsHealth({ file: null }).snapshot(ME), none);
  assert.deepEqual(place({ viewers: [ME.synk_user_id] }).health.snapshot(ME), none, '요약 파일 없음');
  assert.deepEqual(place({ body: summary() }).health.snapshot(ME), none, '볼 계정 파일 없음');
  assert.deepEqual(place({ body: summary(), viewers: '{깨짐' }).health.snapshot(ME), none, '볼 계정 파일 깨짐');
  assert.deepEqual(place({ body: summary(), viewers: [] }).health.snapshot(ME), none, '볼 계정이 비어 있음');
  const p = place({ body: summary(), viewers: [ME.synk_user_id] });
  assert.deepEqual(p.health.snapshot(OTHER), none, '볼 계정이 아님');
  assert.deepEqual(p.health.snapshot(null), none);
  assert.deepEqual(p.health.snapshot({ synk_user_id: '../x' }), none, '번호 꼴이 틀림');
  // 깨진 요약이어도 볼 계정이 아니면 있다는 것조차 알리지 않는다
  assert.deepEqual(place({ body: '{깨짐', viewers: [ME.synk_user_id] }).health.snapshot(OTHER), none);
});

test('a listed account gets the summary, and the module writes nothing', () => {
  const p = place({ body: summary(), viewers: [ME.synk_user_id] });
  const before = fs.readdirSync(p.dir, { recursive: true }).sort();
  const got = p.health.snapshot(ME);
  assert.equal(got.ok, true); assert.equal(got.available, true);
  assert.equal(got.summary.방.rows.length, 2);
  assert.deepEqual(fs.readdirSync(p.dir, { recursive: true }).sort(), before, '대기 줄도 남기지 않는다(방문자 분석 쪽이 남긴다)');
});

test('an unreadable summary says why, to a listed account only', () => {
  const read = body => place({ body, viewers: [ME.synk_user_id] }).health.snapshot(ME);
  assert.deepEqual(read('{깨짐'), { ok: false, available: true, code: 'UNREADABLE' });
  assert.deepEqual(read('[]'), { ok: false, available: true, code: 'NOT_OBJECT' });
  assert.deepEqual(read(summary({ 판: 2 })), { ok: false, available: true, code: 'VERSION', version: 2, supported: 1 });
  assert.deepEqual(read(summary({ 판: '1' })), { ok: false, available: true, code: 'VERSION' });
  assert.deepEqual(read(summary({ 만든때: '어제' })), { ok: false, available: true, code: 'MADE_AT' });
  assert.deepEqual(read(summary({ 방: null })), { ok: false, available: true, code: 'ROOM' });
  assert.deepEqual(read(summary({ 방: { say: 'x' } })), { ok: false, available: true, code: 'ROOM' });
  assert.deepEqual(read(' '.repeat(MAX_BYTES + 1)), { ok: false, available: true, code: 'TOO_LARGE' });
  assert.equal(shapeProblem(summary()), null);
});

test('the file is read again only when it changes', () => {
  const p = place({ body: summary(), viewers: [ME.synk_user_id] });
  let reads = 0;
  const fsImpl = { ...fs, readFileSync: (f, ...rest) => { if (f === p.file) reads += 1; return fs.readFileSync(f, ...rest); } };
  const health = createSnsHealth({ file: p.file, viewersFile: p.viewersFile, fsImpl });
  health.snapshot(ME); health.snapshot(ME);
  assert.equal(reads, 1);
  fs.writeFileSync(p.file, JSON.stringify(summary({ 방: { say: '바뀜', rows: [] } })));
  fs.utimesSync(p.file, new Date(NOW), new Date(NOW + 5000));
  assert.equal(health.snapshot(ME).summary.방.say, '바뀜');
  assert.equal(reads, 2);
  fs.rmSync(p.file);
  assert.deepEqual(health.snapshot(ME), { ok: true, available: false });
});

/* ── 모델: 요약 → 방 ── */

test('nothing shows when the program is not available', () => {
  assert.deepEqual(snsHealthView(null, NOW), { visible: false });
  assert.deepEqual(snsHealthView({ ok: true, available: false }, NOW), { visible: false });
});

test('the room has the conclusion, one row per account, and when it was diagnosed', () => {
  const v = snsHealthView(ok(summary()), NOW);
  assert.equal(v.visible, true); assert.equal(v.problem, null); assert.equal(v.stale, false);
  assert.equal(v.say, '진단한 계정 2개 가운데 하나가 건강합니다.');
  assert.equal(v.then, '인스타그램 @synkbrief부터 봅니다.');
  assert.equal(v.scope, '진단 2 · 아직 이른 계정 1');
  assert.match(v.when, /^11월 24일 11:00에 진단했습니다\. /);
  assert.deepEqual(v.rows.map(r => [r.key, r.nm, r.mid, r.val, r.when, r.now, r.unread]), [
    ['synkbrief-instagram', '인스타그램 @synkbrief', '보고 지나가는 계정', '건강하지 않음', '팔로워 0 · 한 편 133번', 1, 0],
    ['synkmn-tiktok', '틱톡 @synk.mn', '반응이 진한 계정', '건강함', '팔로워 1,204 · 한 편 2,310번', 0, 0],
  ]);
  assert.equal(rowSpeech(v.rows[0]), '인스타그램 @synkbrief, 건강하지 않음, 보고 지나가는 계정, 팔로워 0 · 한 편 133번');
});

test('every kind of line inside a row keeps its order and its words', () => {
  const more = snsHealthView(ok(summary()), NOW).rows[0].more;
  assert.deepEqual(more.map(m => m[0]), ['say', 'good', 'head', 'flow', 'text', 'row', 'row', 'do', 'goal', 'note']);
  assert.deepEqual(more[1], ['good', '잘하고 있는 것', '꾸준히 올립니다.']);
  assert.deepEqual(more[5], ['row', '본 사람이 반응하는가', '보고 지나갑니다.', '나쁨', '평균의 23%', 1], '나쁨인 줄은 강조');
  assert.deepEqual(more[6], ['row', '꾸준히 올리는가', '지난 14일 동안 9편을 올렸습니다.', '좋음', '2주에 9편', 0]);
  assert.deepEqual(more[7], ['do', '할 일 1', '보내고 싶은 편을 만듭니다.']);
});

test('the path of a thousand views starts at 1,000 and marks the step that leaks', () => {
  const [, steps, text] = snsHealthView(ok(summary()), NOW).rows[0].more[3];
  assert.equal(text, '가장 먼저 새는 곳은 반응입니다.');
  assert.deepEqual(steps.map(s => [s.name, s.big, s.verdict, s.leak]), [
    ['조회', '1,000', '', false], ['첫 장면', '349', '보통', false], ['보는 길이', '62%', '보통', false], ['반응', '1.5', '나쁨', true], ['팔로우', '0', '나쁨', false],
  ]);
  assert.equal(steps[1].text, '349명이 3초 넘게 봅니다');
  const odd = snsHealthView(ok(summary({ 방: { rows: [account([['flow', [{ 이름: '반응', 명: 'x' }, { 이름: '팔로우', 명: -3 }, { 명: 5 }, null], '']])] } })), NOW).rows[0].more[0][1];
  assert.deepEqual(odd.map(s => [s.name, s.big]), [['조회', '1,000'], ['반응', '·'], ['팔로우', '·']], '숫자가 아니면 가운뎃점, 이름 없는 단계는 버린다');
});

test('a flow with no usable step keeps only its sentence', () => {
  const more = snsHealthView(ok(summary({ 방: { rows: [account([['flow', [], '아직 잴 숫자가 없습니다.'], ['flow', 'x', '']])] } })), NOW).rows[0].more;
  assert.deepEqual(more, [['text', '아직 잴 숫자가 없습니다.']]);
});

test('unknown kinds and malformed lines are dropped without losing the rest', () => {
  const rows = [
    account([['say', '남는 글'], ['chart', [1, 2, 3]], 'x', null, ['say'], ['say', { a: 1 }], ['row', '', '이름 없는 줄'], ['do', '할 일 1', ''], ['note', 7]]),
    null, 'x', { key: 'no-name' }, { nm: '키 없음' }, { key: 'synkbrief-instagram', nm: '같은 키' },
    { key: 'ok-2', nm: '둘째', more: 'x' },
  ];
  const v = snsHealthView(ok(summary({ 방: { say: '둘', rows } })), NOW);
  assert.deepEqual(v.rows.map(r => r.key), ['synkbrief-instagram', 'ok-2']);
  assert.deepEqual(v.rows[0].more, [['say', '남는 글'], ['note', '7']]);
  assert.deepEqual(v.rows[1], { key: 'ok-2', nm: '둘째', mid: '', val: '', when: '', now: 0, unread: 0, more: [] });
});

test('text from the summary loses invisible characters and is cut to length', () => {
  const C = String.fromCharCode;
  const dirty = `보${C(0)}이${C(0x200b)}는${C(0x202e)} 글${C(0x2028)}${C(0xfeff)}`;
  const long = '가'.repeat(5000);
  const v = snsHealthView(ok(summary({ 방: { say: dirty + long, then: long, scope: long,
    rows: [{ ...account([['say', dirty], ['text', long], ['row', long, long, long, long], ['flow', [{ 이름: long, 큰: long, 글: long, 판정: long }], long]]), nm: dirty + long, mid: long, val: long, when: long }] } })), NOW);
  assert.equal(v.say.length, LIMITS.head); assert.ok(v.say.startsWith('보이는 글가'));
  assert.equal(v.then.length, LIMITS.head); assert.equal(v.scope.length, LIMITS.cell);
  const r = v.rows[0];
  for (const cell of [r.nm, r.mid, r.val, r.when]) assert.equal(cell.length, LIMITS.cell);
  assert.deepEqual(r.more[0], ['say', '보이는 글']);
  assert.equal(r.more[1][1].length, LIMITS.text);
  assert.deepEqual(r.more[2].slice(1, 5).map(s => s.length), [LIMITS.cell, LIMITS.text, 12, LIMITS.cell]);
  const step = r.more[3][1][1];
  assert.deepEqual([step.name.length, step.big.length, step.text.length, step.verdict.length], [20, 12, LIMITS.cell, 12]);
  const all = JSON.stringify(v);
  for (const code of [0, 0x200b, 0x202e, 0x2028, 0xfeff]) assert.equal(all.includes(C(code)), false);
  assert.equal(snsHealthView(ok(summary({ 방: { say: '가'.repeat(LIMITS.head - 1) + '😀', rows: [] } })), NOW).say, '가'.repeat(LIMITS.head - 1), '글자 하나를 반으로 자르지 않는다');
});

test('rows, inner lines and steps stop at their limits', () => {
  const many = Array.from({ length: LIMITS.rows + 20 }, (_, i) => ({ key: `k${i}`, nm: `계정 ${i}`, more: Array.from({ length: LIMITS.more + 9 }, (_, j) => ['say', `글 ${j}`]) }));
  const v = snsHealthView(ok(summary({ 방: { say: '많음', rows: many } })), NOW);
  assert.equal(v.rows.length, LIMITS.rows);
  assert.equal(v.rows[0].more.length, LIMITS.more);
  const steps = Array.from({ length: 12 }, (_, i) => ({ 이름: `단계 ${i}`, 명: i }));
  assert.equal(snsHealthView(ok(summary({ 방: { rows: [account([['flow', steps, '']])] } })), NOW).rows[0].more[0][1].length, LIMITS.steps);
});

test('a summary with no conclusion still says something true', () => {
  const some = snsHealthView(ok(summary({ 방: { rows: [account()] } })), NOW);
  assert.equal(some.say, '계정 1개를 진단했습니다.');
  const none = snsHealthView(ok(summary({ 방: { rows: [] } })), NOW);
  assert.equal(none.say, '진단한 계정이 아직 없습니다.');
  assert.equal(none.then, '게시물의 숫자가 쌓이면 여기에 보입니다.');
});

test('an old summary says so first and keeps the conclusion below', () => {
  const v = snsHealthView(ok(summary({ 만든때: iso(new Date(2026, 10, 20, 9, 0).getTime()) })), NOW);
  assert.equal(v.stale, true);
  assert.equal(v.say, '11월 20일 뒤로 다시 진단하지 못했습니다.');
  assert.equal(v.then, '진단한 계정 2개 가운데 하나가 건강합니다. 인스타그램 @synkbrief부터 봅니다.');
  assert.equal(snsHealthView(ok(summary({ 만든때: iso(NOW - 47 * 3600e3) })), NOW).stale, false);
});

test('a summary that could not be read says what to wait for', () => {
  const say = r => { const v = snsHealthView({ ok: false, available: true, ...r }, NOW); assert.equal(v.visible, true); assert.equal(v.say, '진단을 읽지 못했습니다.'); assert.deepEqual(v.rows, []); return [v.then, v.problem]; };
  assert.deepEqual(say({ code: 'VERSION', version: 2, supported: 1 }), ['진단 도구가 새 꼴로 썼습니다. 앱을 업데이트하면 보입니다.', 'VERSION']);
  assert.deepEqual(say({ code: 'VERSION', version: 0, supported: 1 }), ['진단 도구가 옛 꼴로 썼습니다. 다음 진단 때 새 꼴로 쓰면 보입니다.', 'VERSION']);
  assert.deepEqual(say({ code: 'UNREADABLE' }), ['다음 진단 때 다시 쓰면 저절로 보입니다.', 'UNREADABLE']);
  assert.deepEqual(say({ code: 'TOO_LARGE' }), ['다음 진단 때 다시 쓰면 저절로 보입니다.', 'TOO_LARGE']);
  // 본체를 지나지 않고 온 틀린 답도 화면을 깨지 않는다
  assert.equal(snsHealthView({ ok: true, available: true, summary: { 판: 1 } }, NOW).problem, 'UNREADABLE');
});

/* ── 이어 보기: 진단 도구 → 요약 파일 → 본체 → 모델 ── */

test('what the diagnosis tool writes arrives in the room whole', () => {
  const day = 864e5, at = d => iso(NOW - d * day);
  const post = (i, views, extra = {}) => ({ id: `p${i}`, title: `편 ${i}`, publishedAt: at(4 + i * 2), points: { '72h': { views, likes: Math.round(views * 0.02), comments: 2, shares: Math.round(views * 0.004), saves: Math.round(views * 0.003), earlyRetention3sPct: 38, ...extra } } });
  const accounts = [
    { key: 'a-instagram', name: '인스타그램 @a', platform: 'instagram', ownComments: 0, followers: [{ date: at(20).slice(0, 10), n: 900 }, { date: at(1).slice(0, 10), n: 960 }], posts: Array.from({ length: 8 }, (_, i) => post(i, 2400 - i * 90)) },
    { key: 'b-tiktok', name: '틱톡 @b', platform: 'tiktok', ownComments: 0, followers: [{ date: at(20).slice(0, 10), n: 52000 }, { date: at(1).slice(0, 10), n: 52010 }], posts: Array.from({ length: 8 }, (_, i) => post(i, 320 + i * 5, { shares: 0, saves: 0, comments: 0 })) },
    { key: 'c-youtube', name: '유튜브 @c', platform: 'youtube', followers: [], posts: [post(0, 40)] },
  ];
  const room = 방(accounts.map(a => 진단(a, NOW)), { now: NOW, 모은때: '시험' });
  assert.ok(room.rows.length >= 2, '진단한 계정이 줄로 나온다');
  const p = place({ viewers: [ME.synk_user_id] });
  요약쓰기(p.file, 요약(room, NOW - 60e3));
  assert.deepEqual(fs.readdirSync(path.dirname(p.file)), ['summary.json'], '임시 파일을 남기지 않는다');
  const written = JSON.parse(fs.readFileSync(p.file, 'utf8'));
  assert.deepEqual(Object.keys(written), ['판', '만든때', '숫자', '방']);
  assert.equal('when' in written.방, false, '「모은 때」 글은 싣지 않는다');

  const v = snsHealthView(p.health.snapshot(ME), NOW);
  assert.equal(v.visible, true); assert.equal(v.problem, null);
  assert.equal(v.say, room.say); assert.equal(v.then, room.then); assert.equal(v.scope, room.scope);
  assert.deepEqual(v.rows.map(r => [r.key, r.nm, r.mid, r.val, r.when]), room.rows.map(r => [r.key, r.nm, r.mid, r.val, r.when]));
  const kinds = rows => rows.map(r => r.more.map(m => m[0]).join(','));
  assert.deepEqual(kinds(v.rows), kinds(room.rows), '안쪽 줄이 하나도 버려지거나 바뀌지 않는다');
  for (const [i, r] of room.rows.entries()) for (const [j, m] of r.more.entries()) {
    const got = v.rows[i].more[j];
    if (m[0] === 'flow') { assert.equal(got[1].length, m[1].length + 1); assert.equal(got[2], m[2] || ''); assert.deepEqual(got[1].slice(1).map(s => [s.name, s.text, s.verdict, s.leak]), m[1].map(s => [s.이름, s.글, s.판정, s.샘 === true])); }
    else if (m[0] === 'row') assert.deepEqual(got.slice(0, 5), [m[0], m[1], m[2], m[3] ?? '', m[4] ?? ''].map(x => x ?? ''));
    else assert.deepEqual(got, m, `줄 ${r.key}의 ${m[0]}이 잘리지 않는다`);
  }
  assert.ok(v.rows.some(r => r.more.some(m => m[0] === 'flow')), '길이 든 계정이 하나는 있다');
});

/* ── 11-19 설계 검토 반영: 숫자를 잰 때, 강조 칸, 설치된 앱이 읽는 견본 ── */

test('the room says when the numbers were measured, not when the summary was written', () => {
  const posts = iso(new Date(2026, 10, 24, 9, 34).getTime());
  const v = snsHealthView(ok(summary({ 숫자: { 게시: posts, 팔로워: '2026-11-23' } })), NOW);
  assert.equal(v.stale, false);
  assert.equal(v.when, '게시 숫자는 11월 24일 09:34, 팔로워는 11월 23일에 잰 값입니다. 게시 숫자를 새로 읽을 때마다 다시 진단합니다.');
  assert.match(snsHealthView(ok(summary({ 숫자: { 게시: posts, 팔로워: null } })), NOW).when, /^게시 숫자는 11월 24일 09:34에 잰 값입니다\. /);
  assert.match(snsHealthView(ok(summary({ 숫자: { 게시: 'x', 팔로워: 20261123 } })), NOW).when, /^11월 24일 11:00에 진단했습니다\. /, '숫자 칸이 틀리면 쓴 때로 말한다');
});

test('numbers that were not read for days are said first, even when the summary is new', () => {
  const v = snsHealthView(ok(summary({ 숫자: { 게시: iso(new Date(2026, 10, 20, 9, 0).getTime()), 팔로워: '2026-11-10' } })), NOW);
  assert.equal(v.stale, true);
  assert.equal(v.say, '11월 20일 뒤로 게시 숫자를 새로 읽지 못했습니다.');
  assert.equal(v.then, '진단한 계정 2개 가운데 하나가 건강합니다. 인스타그램 @synkbrief부터 봅니다.');
  assert.match(v.when, /^게시 숫자는 11월 20일 09:00, 팔로워는 11월 10일에 잰 값입니다\. /);
  // 요약도 오래됐으면 그것을 말한다
  const both = snsHealthView(ok(summary({ 만든때: iso(new Date(2026, 10, 21, 9, 0).getTime()), 숫자: { 게시: iso(new Date(2026, 10, 20, 9, 0).getTime()) } })), NOW);
  assert.equal(both.say, '11월 21일 뒤로 다시 진단하지 못했습니다.');
});

test('the summary says which lines to mark; only a summary without that cell falls back to the verdict word', () => {
  const more = lines => snsHealthView(ok(summary({ 방: { rows: [account(lines)] } })), NOW).rows[0].more.map(m => m[5]);
  assert.deepEqual(more([['row', '가', '', '나쁨', '', 0], ['row', '나', '', '보통', '', 1], ['row', '다', '', '나쁨', ''], ['row', '라', '', '좋음', '']]), [0, 1, 1, 0]);
});

test('the fixed sample of summary version 1 is read whole', () => {
  // 견본은 설치된 앱이 읽는 꼴의 계약이다. tests/계정건강.test.js가 진단 도구의 지금 꼴이 이 견본 안에 드는지 본다.
  // 이 시험이 깨지면 앱이 견본의 줄을 버리거나 자른 것이다 — 판 1을 읽는 앱이 이미 설치돼 있으므로 모델을 고친다.
  const sample = JSON.parse(fs.readFileSync(new URL('./fixtures/sns-health-summary-v1.json', import.meta.url), 'utf8'));
  assert.equal(shapeProblem(sample), null);
  const v = snsHealthView(ok(sample), Date.parse(sample.만든때) + 3600e3);
  assert.equal(v.problem, null); assert.equal(v.stale, false);
  assert.equal(v.say, sample.방.say); assert.equal(v.scope, sample.방.scope);
  assert.deepEqual(v.rows.map(r => [r.key, r.nm, r.mid, r.val, r.when, r.now, r.unread]), sample.방.rows.map(r => [r.key, r.nm, r.mid, r.val, r.when, r.now, r.unread]));
  for (const [i, r] of sample.방.rows.entries()) {
    assert.deepEqual(v.rows[i].more.map(m => m[0]), r.more.map(m => m[0]), r.key);
    for (const [j, m] of r.more.entries()) {
      const got = v.rows[i].more[j];
      if (m[0] === 'flow') { assert.deepEqual(got[1].slice(1).map(s => [s.name, s.text, s.verdict, s.leak]), m[1].map(s => [s.이름, s.글, s.판정, s.샘])); assert.equal(got[2], m[2]); }
      else assert.deepEqual(got, m, `${r.key}의 ${m[0]}`);
    }
  }
  const kinds = new Set(v.rows.flatMap(r => r.more.map(m => m[0])));
  assert.deepEqual([...kinds].sort(), ['do', 'flow', 'goal', 'good', 'head', 'note', 'row', 'say', 'text']);
});
