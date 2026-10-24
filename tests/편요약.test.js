'use strict';
// 편 요약(tools/lib/편요약.js · tools/편요약.js) — 합성 편 폴더로 v1 모양, 방법 원문을 넣지 않는 것, 서버 응답 처리.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 요약 = require('../tools/lib/편요약.js');
const { 보내기 } = require('../tools/편요약.js');

function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '편요약-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); };
  put('docs/마케팅/sns-계정.json', { accounts: {
    'lab-youtube': { brand: 'LAB', platform: 'youtube', handle: '@synkkorean' },
    'lab-facebook': { brand: 'LAB', platform: 'facebook', handle: 'synkworld' },
    'lab-mm-tiktok': { brand: 'LAB', platform: 'tiktok', handle: '@synklab.mm', countryCode: 'MM' },
    'yuhobuilds-instagram': { brand: 'SHIFT', platform: 'instagram', handle: '@yuhobuilds' },
    'shift-tistory': { brand: 'SHIFT', platform: 'tistory', handle: 'synkshift' },
  } });
  put('docs/마케팅/LAB_퀴즈_20261023/게시/준비.json', { 제목: 'LAB 퀴즈', 슬롯: '2026-10-23', 상태: '올릴 준비' });
  put('docs/마케팅/LAB_퀴즈_20261023/게시/게시결과.json', { 판: [
    { 계정: 'lab-youtube', 상태: '승인 대기', 시각: '2026-10-26T12:00:00.000Z', 방법: '작업실', 작업: 'f'.repeat(64), 원고ID: 'e907c48e-d85c-44be-82c2-56a3ea243854' },
    { 계정: 'lab-facebook', 상태: '예약됨', 시각: '2026-10-24T21:00:00+09:00', 주소: null, 방법: '10-24 유호님 「올려」 뒤 Business Suite 예약(ego) — 비밀 메모' },
    { 계정: 'shift-tistory', 상태: '게시됨', 시각: '2026-10-23T21:20:00+09:00', 주소: 'https://synkshift.tistory.com/5', 방법: '티스토리' },
    { 계정: 'lab-mm-tiktok', 상태: '게시됨', 시각: '2026-10-23 22:30', 주소: 'https://www.tiktok.com/@synklab.mm/video/123456', 방법: 'ego TikTok Studio' },
  ] });
  put('docs/마케팅/LAB_빈칸_20261023/게시/준비.json', { 제목: '빈칸', 슬롯: '2026-10-27', 상태: '올릴 준비', 판: [{ 계정: 'lab-facebook' }] });
  put('docs/마케팅/LAB_옛편_20261001/게시/게시결과.json', { 판: [{ 계정: 'lab-youtube', 상태: '게시됨', 시각: '2026-10-01T12:00:00Z', 주소: 'https://www.youtube.com/shorts/OLD' }] });
  put('docs/_ops/게시성과.jsonl', [
    { kind: '판정', post: 'youtube:AAAA', point: '24h', url: 'https://www.youtube.com/shorts/AAAA', platform: 'youtube', account: 'lab-youtube', folder: 'LAB_퀴즈_20261023', publishedAt: '2026-10-23T12:00:00Z', multiple: { value: 2.5, median: 240, n: 5 }, verdict: '자료 부족' },
    { kind: '게시연결', url: 'https://www.instagram.com/reel/TEST/', group: '운영시험' },
    { kind: '게시연결', url: 'https://www.instagram.com/reel/ART/', group: '작품' },
  ].map((l) => JSON.stringify(l)).join('\n') + '\n');
  return root;
}

test('편 요약 v1 — 작업실 판은 작업·원고 ID로, 서버 밖 판은 방법 이름으로만, SNS 네 곳·창 밖은 뺀다', (t) => {
  const d = 요약.build({ repo: repo(t), now: Date.parse('2026-10-24T08:16:00Z'), commit: 'abc1234' });
  assert.equal(d.v, 1); assert.equal(d.today, '2026-10-24');
  const quiz = d.episodes.find((e) => e.key === 'LAB_퀴즈_20261023');
  assert.equal(quiz.title, 'LAB 퀴즈'); assert.equal(quiz.titleFrom, 'prep'); assert.equal(quiz.brand, 'LAB');
  const byPlatform = Object.fromEntries(quiz.plates.filter((p) => p.url !== 'https://www.youtube.com/shorts/AAAA').map((p) => [p.platform, p]));
  assert.equal(byPlatform.youtube.jobId, 'f'.repeat(64)); assert.equal(byPlatform.youtube.method, '작업실');
  const ledgerPlate = quiz.plates.find((p) => p.url === 'https://www.youtube.com/shorts/AAAA');
  assert.equal(ledgerPlate.state, '게시됨', '판정 장부가 이은 주소는 게시됨 판으로 더한다');
  assert.equal(byPlatform.facebook.method, 'Meta 예약'); assert.equal(byPlatform.facebook.at, '2026-10-24T12:00:00.000Z');
  assert.equal(byPlatform.tiktok.at, '2026-10-23T13:30:00.000Z', '시간대 없는 시각은 한국 시각');
  assert.equal(byPlatform.tistory, undefined, 'SNS 네 곳 밖은 뺀다');
  assert.ok(!JSON.stringify(d).includes('비밀 메모'), '게시결과 방법 원문은 넣지 않는다');
  assert.equal(d.episodes.some((e) => e.key === 'LAB_옛편_20261001'), false, '창 밖 편은 뺀다');
  const blank = d.episodes.find((e) => e.key === 'LAB_빈칸_20261023');
  assert.deepEqual(blank.plates, []); assert.deepEqual(blank.planned.map((p) => p.platform), ['facebook']);
  assert.deepEqual(d.excluded, { 운영시험: 1, 작품: 1, urls: ['https://www.instagram.com/reel/TEST/', 'https://www.instagram.com/reel/ART/'] });
  assert.equal(d.judgments[0].multiple.n, 5);
  assert.equal(d.accounts.find((a) => a.key === 'yuhobuilds-instagram').brand, '유호', '장부 brand(SHIFT)가 아니라 열쇠 앞머리로');
  assert.equal('country' in d.accounts[0], false, '장부 countryCode는 본 계정에도 붙어 나라별 표시로 쓰지 않는다');
});

test('같은 판이 예약 줄·게시 줄로 두 번 적혀도 하나로 합친다', () => {
  const plates = [
    { account: 'lab-youtube', platform: 'youtube', at: '2026-10-22T12:00:00.000Z', state: '예약됨', method: 'API 예약', url: null, jobId: null, postId: null },
    { account: 'lab-youtube', platform: 'youtube', at: '2026-10-22T12:00:05.000Z', state: '게시됨', method: null, url: 'https://www.youtube.com/shorts/AAAA1111', jobId: null, postId: null },
    { account: 'lab-youtube', platform: 'youtube', at: '2026-10-22T12:00:05.000Z', state: '게시됨', method: null, url: 'https://www.youtube.com/watch?v=AAAA1111', jobId: null, postId: null },
    { account: 'lab-facebook', platform: 'facebook', at: '2026-10-22T12:00:00.000Z', state: '예약됨', method: 'Meta 예약', url: null, jobId: null, postId: null },
  ];
  요약.dedupe(plates);
  assert.deepEqual(plates.map((p) => [p.platform, p.state, p.method]), [['youtube', '게시됨', 'API 예약'], ['facebook', '예약됨', 'Meta 예약']]);
});

test('GPT 10-24 — 깨진 원천은 멈추고, 시험 주소는 장부로 되살리지 않고, 2027년 편도 읽는다', (t) => {
  const root = repo(t);
  const put = (rel, value) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value)); };
  fs.appendFileSync(path.join(root, 'docs/_ops/게시성과.jsonl'), JSON.stringify({ kind: '판정', post: 'instagram:TEST', point: '24h', url: 'https://www.instagram.com/reel/TEST/', platform: 'instagram', account: 'lab-youtube', folder: 'LAB_퀴즈_20261023', publishedAt: '2026-10-23T12:00:00Z', multiple: { value: 9, median: 10, n: 6 } }) + '\n');
  put('docs/마케팅/LAB_새해_20270101/게시/게시결과.json', { 판: [{ 계정: 'lab-youtube', 상태: '예약됨', 시각: '2026-10-25T12:00:00Z', 방법: 'API' }] });
  const d = 요약.build({ repo: root, now: Date.parse('2026-10-24T08:16:00Z') });
  const quiz = d.episodes.find((e) => e.key === 'LAB_퀴즈_20261023');
  assert.equal(quiz.plates.some((p) => p.url === 'https://www.instagram.com/reel/TEST/'), false, '운영시험으로 가른 주소는 판정 줄이 있어도 판으로 넣지 않는다');
  assert.ok(d.episodes.some((e) => e.key === 'LAB_새해_20270101'), '연도를 2026으로 묶지 않는다');
  put('docs/마케팅/sns-계정.json', '{깨진 json');
  assert.throws(() => 요약.build({ repo: root, now: Date.parse('2026-10-24T08:16:00Z') }), /읽지 못했다/);
  assert.throws(() => 요약.build({ repo: path.join(root, '없는-저장소'), now: Date.now() }), /뿌리가 없다/);
});

test('보내기 — 409·404는 실패로 세지 않고, 회차마다 로그아웃한다', async () => {
  const calls = [];
  const fake = (status) => async () => ({ async post(p) { calls.push(p); if (p === '/api/logout') return {}; if (status) throw Object.assign(new Error('x'), { status }); return { ok: true, episodes: 1, judgments: 0 }; } });
  assert.equal((await 보내기({ v: 1 }, { connect: fake(0) })).ok, true);
  assert.match((await 보내기({ v: 1 }, { connect: fake(409) })).skipped, /더 새/);
  assert.match((await 보내기({ v: 1 }, { connect: fake(404) })).skipped, /아직/);
  await assert.rejects(보내기({ v: 1 }, { connect: fake(500) }));
  assert.equal(calls.filter((p) => p === '/api/logout').length, 4);
});
