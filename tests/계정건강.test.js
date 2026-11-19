'use strict';
// 계정 건강 진단(tools/lib/계정건강.js)의 유형과 상태. 유호님 11-19의 두 예시가 첫 두 시험이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { 진단, 방, 상태이름 } = require('../tools/lib/계정건강.js');
const { 제목 } = require('../tools/계정건강.js');

const NOW = Date.parse('2026-11-19T00:00:00Z'), DAY = 864e5;
const day = n => new Date(NOW - n * DAY).toISOString();
const date = n => day(n).slice(0, 10);
/** 편들: 가장 오래된 것부터. 하루 간격으로 올렸고 72시간 값만 있다 */
function 계정(followers, posts, extra = {}) {
  const n = posts.length;
  return { key: 'a', name: '시험 계정', platform: 'instagram',
    followers: Array.isArray(followers) ? followers : [{ date: date(14), n: followers }, { date: date(0), n: followers }],
    posts: posts.map((m, i) => ({ id: 'p' + i, title: '편' + i, publishedAt: day(n - i + 2), points: { '72h': m }, screen: m.screen || {} })), ...extra };
}
const 편 = (views, shares = 0, comments = 0, saves = 0, likes = 0) => ({ views, shares, comments, saves, likes });
const 신호 = (d, 키) => d.신호.find(s => s.키 === 키);

test('조회는 낮은데 팔로워가 비정상적으로 높으면 건강하지 않다', () => {
  const d = 진단(계정(20000, Array.from({ length: 8 }, () => 편(300, 0, 0, 0, 6))), NOW);
  assert.equal(d.상태, 상태이름.나쁨);
  assert.equal(d.유형, '팔로워만 큰 계정');
  assert.equal(신호(d, '닿음').판정, '나쁨');
  assert.match(d.결론, /팔로워는 20,000명인데 한 편을 보는 사람은 300명꼴/);
  assert.match(d.처방[0], /팔로워 수를 늘리는 일.*멈춥니다/);
});

test('조회는 낮아도 공유와 댓글 반응이 좋으면 건강하다', () => {
  const d = 진단(계정(150, Array.from({ length: 8 }, () => 편(200, 3, 2, 2, 10))), NOW);
  assert.equal(d.상태, 상태이름.건강);
  assert.equal(d.유형, '반응이 진한 계정');
  assert.equal(신호(d, '깊이').판정, '좋음');
  assert.match(d.결론, /조회수의 크기와 상관없이 건강한 계정/);
});

test('조회수의 크기는 판정에 들지 않는다 — 조회와 반응이 함께 100배여도 상태와 반응 판정이 같다', () => {
  const small = 진단(계정(150, Array.from({ length: 8 }, () => 편(200, 3, 2, 2, 10))), NOW);
  const big = 진단(계정(15000, Array.from({ length: 8 }, () => 편(20000, 300, 200, 200, 1000))), NOW);
  assert.equal(small.상태, big.상태);
  assert.equal(신호(small, '깊이').판정, 신호(big, '깊이').판정);
  assert.equal(신호(small, '깊이').깊은반응, 신호(big, '깊이').깊은반응);
});

test('조회는 나오는데 반응이 없으면 보고 지나가는 계정, 좋아요만 많으면 좋아요만 받는 계정', () => {
  const pass = 진단(계정(200, Array.from({ length: 8 }, () => 편(5000, 0, 0, 1, 20))), NOW);
  assert.equal(pass.유형, '보고 지나가는 계정');
  assert.notEqual(pass.상태, 상태이름.건강);
  const likes = 진단(계정(200, Array.from({ length: 8 }, () => 편(5000, 0, 0, 1, 400))), NOW);
  assert.equal(likes.유형, '좋아요만 받는 계정');
  assert.match(likes.처방[0], /좋아요는 받는데/);
});

test('한 편이 조회의 절반을 넘고 보통 편의 열 배면 한 편에 기대는 계정', () => {
  const posts = [...Array.from({ length: 7 }, () => 편(200, 1, 0, 1, 4)), 편(9000, 45, 0, 27, 180)];
  const d = 진단(계정(120, posts), NOW);
  assert.equal(신호(d, '쏠림').판정, '나쁨');
  assert.equal(d.유형, '한 편에 기대는 계정');
  assert.ok(d.처방.some(p => /「편7」의 주제와 첫 2초/.test(p)));
});

test('최근 편이 그 앞의 60% 아래면 식어 가는 계정', () => {
  const posts = [...Array.from({ length: 5 }, () => 편(1000, 3, 1, 2, 30)), ...Array.from({ length: 5 }, () => 편(400, 1, 0, 1, 12))];
  const d = 진단(계정(300, posts), NOW);
  assert.equal(신호(d, '흐름').판정, '나쁨');
  assert.equal(d.유형, '식어 가는 계정');
});

test('평소대로 나오다 마지막 세 편이 20% 아래면 막힌 것을 의심한다', () => {
  const posts = [...Array.from({ length: 8 }, () => 편(2000, 12, 5, 8, 80)), 편(40), 편(35), 편(50)];
  const d = 진단(계정(900, posts), NOW);
  assert.equal(d.유형, '갑자기 닿지 않게 된 계정');
  assert.equal(d.상태, 상태이름.나쁨);
  assert.match(d.처방[0], /계정 상태/);
});

test('조회보다 팔로워가 빨리 늘면 따라온 까닭을 의심한다', () => {
  const followers = [{ date: date(14), n: 1000 }, { date: date(0), n: 3000 }];
  const d = 진단(계정(followers, Array.from({ length: 8 }, () => 편(900, 5, 2, 4, 30))), NOW);
  assert.equal(신호(d, '남김').수상함, true);
  assert.equal(d.유형, '팔로워가 조회보다 빨리 느는 계정');
  assert.notEqual(d.상태, 상태이름.건강);
  assert.match(d.결론, /일 수 있습니다/); // 가짜라고 단정하지 않는다
});

test('잰 편이 다섯이 안 되거나 조회 합이 300 아래면 상태를 말하지 않는다', () => {
  const few = 진단(계정(50, [편(900, 5, 2), 편(800, 4, 1)]), NOW);
  assert.equal(few.상태, 상태이름.이름);
  assert.equal(few.유형, '아직 이른 계정');
  const unseen = 진단(계정(0, Array.from({ length: 6 }, () => 편(4))), NOW);
  assert.equal(unseen.상태, 상태이름.이름);
  assert.equal(unseen.유형, '아직 노출이 시작되지 않은 계정');
});

test('재지 못한 반응은 0으로 치지 않고 기준에서도 뺀다', () => {
  // 댓글과 좋아요만 잰 계정(유튜브 공개 숫자). 유튜브의 선은 댓글 1 · 좋아요 30이다
  const d = 진단(계정(50, Array.from({ length: 8 }, () => ({ views: 1000, comments: 2, likes: 30 })), { platform: 'youtube' }), NOW);
  assert.equal(신호(d, '깊이').판정, '좋음');
  assert.deepEqual(신호(d, '깊이').못잰것, ['공유', '저장']);
});

test('반응의 선은 플랫폼마다 다르다 — 같은 숫자가 틱톡에서는 보통, 인스타그램에서는 나쁨', () => {
  const posts = () => Array.from({ length: 8 }, () => ({ views: 2000, shares: 3, comments: 1, likes: 40 })); // 1,000번에 공유 1.5 · 댓글 0.5 · 좋아요 20
  assert.equal(신호(진단(계정(50, posts(), { platform: 'tiktok' }), NOW), '깊이').판정, '보통');
  assert.equal(신호(진단(계정(50, posts(), { platform: 'instagram' }), NOW), '깊이').판정, '나쁨');
});

test('한 편이 반응을 다 만들었으면 그 편을 뺀 값으로 판정한다', () => {
  const posts = [...Array.from({ length: 7 }, () => 편(1000, 0, 0, 0, 5)), 편(3000, 60, 30, 40, 200)];
  const s = 신호(진단(계정(50, posts), NOW), '깊이');
  assert.equal(s.한편뺌, true);
  assert.equal(s.판정, '나쁨');
  assert.ok(s.전체지수 > s.지수);
});

test('선만큼 반응해도 다섯이 안 나올 조회로는 반응의 좋고 나쁨을 가르지 않는다', () => {
  // 틱톡의 선은 공유 4 · 댓글 1이라 조회 1,000번부터 가른다
  const s = 신호(진단(계정(50, Array.from({ length: 6 }, () => ({ views: 120, shares: 0, comments: 0, likes: 2 })), { platform: 'tiktok' }), NOW), '깊이');
  assert.equal(s.판정, '모름');
  assert.match(s.글, /1,000번부터 가릅니다/);
});

test('반응은 나쁘지 않은데 넘김이 많으면 첫 장면에서 놓치는 계정, 유튜브는 붙잡음이 가장 무겁다', () => {
  const posts = Array.from({ length: 8 }, () => ({ views: 1500, shares: 2, comments: 1, likes: 30, screen: { stayedToWatchPct: 35 } }));
  const d = 진단(계정(50, posts, { platform: 'youtube' }), NOW);
  assert.equal(d.유형, '첫 장면에서 놓치는 계정');
  assert.equal(d.신호[0].키, '붙잡음');
  assert.match(d.처방[0], /첫 2초/);
});

test('화면에서 읽은 넘김 비율이 있으면 첫 장면을 처방한다', () => {
  const posts = Array.from({ length: 8 }, () => ({ ...편(1500, 9, 3, 6, 50), screen: { stayedToWatchPct: 38 } }));
  const d = 진단(계정(400, posts), NOW);
  assert.equal(신호(d, '붙잡음').판정, '나쁨');
  assert.ok(d.처방.some(p => /첫 2초/.test(p)));
});

test('방은 나쁜 계정부터 세우고 처방을 할 일 줄로 넣는다', () => {
  const bad = 진단({ ...계정(20000, Array.from({ length: 8 }, () => 편(300, 0, 0, 0, 6))), key: 'bad', name: '큰 계정' }, NOW);
  const good = 진단({ ...계정(150, Array.from({ length: 8 }, () => 편(200, 3, 2, 2, 10))), key: 'good', name: '작은 계정' }, NOW);
  const room = 방([good, bad], { now: NOW, 모은때: '방금' });
  assert.deepEqual(room.rows.map(r => r.key), ['bad', 'good']);
  assert.equal(room.say, '계정 둘 가운데 하나가 건강하지 않습니다.');
  assert.match(room.then, /큰 계정부터 봅니다/);
  assert.equal(room.rows[0].now, 1);
  assert.ok(room.rows[0].more.some(m => m[0] === 'do'));
  assert.equal(room.rows[0].more[0][0], 'say');
});

test('편 폴더 이름에서 제목만 남긴다', () => {
  assert.equal(제목('LAB_생신_mn_20261114'), '생신');
  assert.equal(제목('synkbrief_메뉴판정리_20261030'), '메뉴판정리');
  assert.equal(제목(null), null);
});
