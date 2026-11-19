'use strict';
// 계정 건강 진단(tools/lib/계정건강.js)의 유형과 상태. 유호님 11-19의 두 예시가 첫 두 시험이다.
const test = require('node:test');
const assert = require('node:assert/strict');
const { 진단, 방, 상태이름 } = require('../tools/lib/계정건강.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 제목, main, 요약자리, 요약판 } = require('../tools/계정건강.js');

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
  const d = 진단(계정([{ date: date(14), n: 280 }, { date: date(0), n: 300 }], posts), NOW); // 팔로워는 보통으로 는다
  assert.equal(신호(d, '흐름').판정, '나쁨');
  assert.equal(d.유형, '식어 가는 계정');
});

test('보고 반응도 하는데 팔로워가 늘지 않으면 팔로우로 이어지지 않는 계정', () => {
  const d = 진단(계정(300, Array.from({ length: 8 }, () => 편(1000, 2, 0, 1, 15)), { ownComments: 0 }), NOW);
  assert.equal(신호(d, '남김').판정, '나쁨');
  assert.equal(d.유형, '팔로우로 이어지지 않는 계정');
  assert.equal(d.세부.새는곳.단계, '팔로우');
  assert.match(d.처방[0], /프로필 첫 줄/);
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
  // 댓글과 좋아요만 잰 계정(유튜브 공개 숫자). 유튜브의 선은 댓글 0.6 · 좋아요 15다
  const d = 진단(계정(50, Array.from({ length: 8 }, () => ({ views: 2000, comments: 4, likes: 60 })), { platform: 'youtube' }), NOW);
  assert.equal(신호(d, '깊이').판정, '좋음');
  assert.deepEqual(신호(d, '깊이').못잰것, ['공유', '저장']);
});

test('반응의 선은 플랫폼마다 다르다 — 같은 숫자가 틱톡에서는 보통, 인스타그램에서는 나쁨', () => {
  const posts = () => Array.from({ length: 8 }, () => ({ views: 2000, shares: 2, comments: 0, likes: 10 })); // 1,000번에 공유 1 · 댓글 0 · 좋아요 5. 틱톡의 공유 선은 1.5, 인스타그램은 2.4다
  assert.equal(신호(진단(계정(50, posts(), { platform: 'tiktok', ownComments: 0 }), NOW), '깊이').판정, '보통');
  assert.equal(신호(진단(계정(50, posts(), { platform: 'instagram', ownComments: 0 }), NOW), '깊이').판정, '나쁨');
});

test('편마다 꼭 하나씩 달린 댓글은 내가 단 고정 댓글로 보고 뺀다', () => {
  const posts = () => Array.from({ length: 8 }, (_, i) => ({ views: 1000, shares: 0, comments: i < 7 ? 1 : 0, likes: 5 }));
  const auto = 신호(진단(계정(50, posts(), { platform: 'youtube' }), NOW), '깊이');
  assert.equal(auto.비율.comments, 0);
  assert.match(auto.글, /고정 댓글로 보고 뺐습니다/);
  // 편마다 댓글 수가 다르면 본 사람의 댓글이라 빼지 않는다
  const real = 신호(진단(계정(50, Array.from({ length: 8 }, (_, i) => ({ views: 1000, shares: 0, comments: i % 4, likes: 5 })), { platform: 'youtube' }), NOW), '깊이');
  assert.ok(real.비율.comments > 0);
  // 계정에 적어 두면 그 수만큼 뺀다
  assert.equal(신호(진단(계정(50, posts(), { platform: 'youtube', ownComments: 0 }), NOW), '깊이').비율.comments > 0, true);
});

test('조회 1,000번이 가는 길에서 가장 먼저 나쁜 단계를 새는 곳으로 짚고, 그 처방과 목표가 맨 앞이다', () => {
  const posts = Array.from({ length: 8 }, () => ({ views: 2000, shares: 0, comments: 0, saves: 1, likes: 4, screen: { earlyRetention3sPct: 20 } }));
  const d = 진단(계정(50, posts, { ownComments: 0 }), NOW);
  assert.deepEqual(d.세부.길.map(s => s.키), ['첫장면', '반응', '팔로우']);
  assert.equal(d.세부.길[0].명, 200);
  assert.equal(d.세부.새는곳.단계, '첫장면');
  assert.match(d.세부.새는곳.글, /1,000번 가운데 800번은 첫 장면에서 넘어갑니다/);
  assert.equal(d.유형, '첫 장면에서 놓치는 계정');
  assert.match(d.처방[0], /첫 2초/);
  assert.equal(d.세부.목표, '다음 세 편의 목표는 3초 넘게 본 비율 25%입니다(지금 20%).');
});

test('잘된 편과 안 된 편의 차이가 첫 장면에서 나면 그렇게 말한다', () => {
  const good = i => ({ views: 5000 + i, shares: 5, comments: 0, saves: 5, likes: 50, screen: { earlyRetention3sPct: 58 } });
  const bad = i => ({ views: 300 + i, shares: 0, comments: 0, saves: 0, likes: 3, screen: { earlyRetention3sPct: 22 } });
  const d = 진단(계정(50, [bad(1), good(1), bad(2), good(2), bad(3), good(3), bad(4), good(4), bad(5)], { ownComments: 0 }), NOW);
  assert.equal(d.세부.대조.차이.지표, 'earlyRetention3sPct');
  assert.match(d.세부.대조.글, /잘된 편은 3초 넘게 본 비율이 58%이고 안 된 편은 22%입니다\. 조회의 차이가 첫 장면에서 납니다/);
  // 할 일이 이 계정의 편을 본보기로 짚는다
  assert.ok(d.처방.some(p => /가장 잘 붙잡은 편은 「편\d」\(58%\)/.test(p)));
});

test('첫 장면이 나쁨이 아니어도 잘된 편과의 차이가 거기서 나면 할 일로 준다', () => {
  const good = i => ({ views: 5000 + i, shares: 12, comments: 2, saves: 8, likes: 90, screen: { earlyRetention3sPct: 58 } });
  const bad = i => ({ views: 300 + i, shares: 1, comments: 0, saves: 0, likes: 5, screen: { earlyRetention3sPct: 30 } });
  const d = 진단(계정([{ date: date(14), n: 300 }, { date: date(0), n: 380 }], [bad(1), good(1), bad(2), good(2), bad(3), good(3), bad(4), good(4), good(5)], { ownComments: 0 }), NOW);
  assert.notEqual(신호(d, '붙잡음').판정, '나쁨');
  assert.ok(d.처방.some(p => /^이 계정에서는 첫 장면이 붙잡은 편이 멀리 갔습니다/.test(p)));
});

test('건강한 계정에도 다음으로 올릴 것과 목표를 준다', () => {
  const posts = Array.from({ length: 8 }, () => ({ ...편(2000, 12, 2, 8, 60), screen: { earlyRetention3sPct: 45 } }));
  const d = 진단(계정([{ date: date(14), n: 300 }, { date: date(0), n: 320 }], posts, { ownComments: 0 }), NOW); // 팔로워 전환만 보통
  assert.equal(d.상태, 상태이름.건강);
  assert.equal(d.세부.새는곳.단계, null);
  assert.match(d.세부.새는곳.글, /다음으로 올릴 것은 팔로우입니다/);
  assert.ok(d.처방.some(p => /^더 올릴 수 있는 곳은 팔로우입니다/.test(p)));
  assert.match(d.세부.목표, /팔로워 3명입니다/);
});

test('잘하고 있는 것을 먼저 말하고, 방의 안쪽도 그 순서다', () => {
  const d = 진단(계정(150, Array.from({ length: 8 }, () => 편(200, 3, 2, 2, 10))), NOW);
  assert.match(d.결론, /본 사람이 /);
  assert.doesNotMatch(d.세부.강점, /본 사람이 보내/); // 결론이 말한 것은 되풀이하지 않는다
  assert.match(d.세부.강점, /팔로워 밖의 사람에게 퍼집니다/);
  const more = 방([d], { now: NOW }).rows[0].more.map(m => m[0]);
  assert.deepEqual(more.slice(0, 2), ['say', 'good']);
  assert.ok(more.indexOf('flow') < more.indexOf('row') && more.indexOf('row') < more.indexOf('do'));
});

test('한 편이 반응을 다 만들었으면 그 편을 뺀 값으로 판정한다', () => {
  const posts = [...Array.from({ length: 7 }, () => 편(1000, 0, 0, 0, 5)), 편(3000, 60, 30, 40, 200)];
  const s = 신호(진단(계정(50, posts), NOW), '깊이');
  assert.equal(s.한편뺌, true);
  assert.equal(s.판정, '나쁨');
  assert.ok(s.전체지수 > s.지수);
});

test('선만큼 반응해도 다섯이 안 나올 조회로는 반응의 좋고 나쁨을 가르지 않는다', () => {
  // 틱톡의 선은 공유 1.5 · 댓글 0.7이라 조회 2,300번부터 가른다
  const s = 신호(진단(계정(50, Array.from({ length: 6 }, () => ({ views: 120, shares: 0, comments: 0, likes: 2 })), { platform: 'tiktok' }), NOW), '깊이');
  assert.equal(s.판정, '모름');
  assert.match(s.글, /2,300번부터 가릅니다/);
});

test('반응은 나쁘지 않은데 넘김이 많으면 첫 장면에서 놓치는 계정, 유튜브는 붙잡음이 가장 무겁다', () => {
  const posts = Array.from({ length: 8 }, () => ({ views: 1500, shares: 1, comments: 1, likes: 12, screen: { stayedToWatchPct: 35 } }));
  const d = 진단(계정(50, posts, { platform: 'youtube', ownComments: 0 }), NOW);
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
  assert.equal(room.say, '진단한 계정 둘 가운데 하나가 건강합니다.'); // 건강한 계정부터 말한다
  assert.match(room.then, /^하나는 건강하지 않습니다\. 큰 계정부터 봅니다/);
  assert.equal(room.rows[0].now, 1);
  assert.ok(room.rows[0].more.some(m => m[0] === 'do'));
  assert.equal(room.rows[0].more[0][0], 'say');
});

test('편 폴더 이름에서 제목만 남긴다', () => {
  assert.equal(제목('LAB_생신_mn_20261114'), '생신');
  assert.equal(제목('synkbrief_메뉴판정리_20261030'), '메뉴판정리');
  assert.equal(제목(null), null);
});

/* ── PC 앱 솔리오가 읽는 요약 한 장(--요약쓰기). 꼴은 docs/디자인/솔리오_계정건강_20261119/PC앱_구현설계.md 5절 ── */

/** 장부 두 장이 든 임시 저장소. 판정 줄은 계정 하나의 편 여덟 개다 */
function 임시저장소(판정줄 = 8) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-계정건강-'));
  fs.mkdirSync(path.join(repo, 'docs', '_ops'), { recursive: true });
  const rows = Array.from({ length: 판정줄 }, (_, i) => ({ kind: '판정', account: 'a-instagram', platform: 'instagram', post: 'p' + i, folder: `synkbrief_편${i}_20261101`, publishedAt: day(3 + i * 2), point: '72h',
    metrics: { views: 900 + i * 10, likes: 20, comments: 2, shares: 4, saves: 3 } }));
  fs.writeFileSync(path.join(repo, 'docs', '_ops', '게시성과.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  fs.mkdirSync(path.join(repo, 'docs', '마케팅'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'docs', '마케팅', 'sns-계정.json'), JSON.stringify({ accounts: { 'a-instagram': { platform: 'instagram', handle: '@a' } } }));
  fs.writeFileSync(path.join(repo, 'docs', '_ops', '채널성과.jsonl'), [{ kind: 'account', account: 'a-instagram', date: date(14), followers: 300 }, { kind: 'account', account: 'a-instagram', date: date(0), followers: 320 }].map(r => JSON.stringify(r)).join('\n') + '\n');
  return repo;
}
/** main을 부르는 동안 화면에 찍힌 글을 모은다 */
function 부르기(argv) {
  const out = [], log = console.log, err = console.error;
  console.log = (...a) => out.push(a.join(' ')); console.error = (...a) => out.push(a.join(' '));
  try { return { code: main(argv), out: out.join('\n') }; } finally { console.log = log; console.error = err; }
}

test('요약쓰기는 판, 만든 때, 방을 한 장에 쓰고 임시 파일을 남기지 않는다', () => {
  const repo = 임시저장소(), 자리 = path.join(repo, 'out', 'sns-health', 'summary.json');
  const r = 부르기(['--요약쓰기', '--저장소', repo, '--자리', 자리, '--지금', new Date(NOW).toISOString()]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /요약을 썼습니다/);
  assert.deepEqual(fs.readdirSync(path.dirname(자리)), ['summary.json']);
  const s = JSON.parse(fs.readFileSync(자리, 'utf8'));
  assert.deepEqual(Object.keys(s), ['판', '만든때', '숫자', '방']);
  assert.equal(s.판, 요약판);
  assert.equal(s.만든때, new Date(NOW).toISOString());
  assert.deepEqual(Object.keys(s.방), ['say', 'then', 'scope', 'rows']); // 「모은 때」 글은 앱이 만든다
  assert.equal(s.방.rows[0].key, 'a-instagram');
  assert.ok(Array.isArray(s.방.rows[0].more) && s.방.rows[0].more.length > 0);
  // 저장소 안에는 아무것도 쓰지 않는다
  assert.deepEqual(fs.readdirSync(path.join(repo, 'docs', '_ops')).sort(), ['게시성과.jsonl', '채널성과.jsonl']);
});

test('요약쓰기는 장부를 읽지 못하면 앞 요약을 그대로 둔다', () => {
  const repo = 임시저장소(0), 자리 = path.join(repo, 'out', 'summary.json');
  fs.mkdirSync(path.dirname(자리)); fs.writeFileSync(자리, '앞 요약');
  const r = 부르기(['--요약쓰기', '--저장소', repo, '--자리', 자리]);
  assert.equal(r.code, 1);
  assert.match(r.out, /판정 줄이 없습니다\. 요약은 그대로 둡니다/);
  assert.equal(fs.readFileSync(자리, 'utf8'), '앞 요약');
  // 한 계정만 든 요약도 쓰지 않는다
  const one = 부르기(['--요약쓰기', '--계정', 'a-instagram', '--저장소', 임시저장소(), '--자리', 자리]);
  assert.equal(one.code, 2);
  assert.equal(fs.readFileSync(자리, 'utf8'), '앞 요약');
});

test('요약의 자리는 PC 앱이 읽는 자리다', () => {
  assert.equal(요약자리({ LOCALAPPDATA: 'C:\L' }), path.join('C:\L', 'synk', 'sns-health', 'summary.json'));
  assert.equal(요약자리({ SYNK_SNS_HEALTH_SUMMARY: 'X:\s.json', LOCALAPPDATA: 'C:\L' }), 'X:\s.json');
});

test('길에서 아무도 하지 않은 단계는 하지 않는다고 말한다', () => {
  const d = 진단(계정([{ date: date(14), n: 300 }, { date: date(0), n: 300 }], Array.from({ length: 8 }, () => 편(900, 0, 0, 0, 5)), { ownComments: 0 }), NOW);
  const 글들 = d.세부.길.map(s => s.글).join(' / ');
  assert.doesNotMatch(글들, /아무도 [^/]*(팔로우합니다|답니다|저장합니다|보냅니다)/, 글들);
  assert.match(글들, /아직 아무도 [^/]*않습니다/, 글들);
});

/* ── 11-19 설계 검토 반영: 오래된 팔로워 값, 덜 읽은 장부, 설치된 앱이 읽는 꼴 ── */

test('팔로워를 잰 지 오래됐으면 그 값으로 판정하지 않고 잰 날을 말한다', () => {
  const posts = Array.from({ length: 8 }, () => 편(900, 4, 2, 3, 20));
  const fresh = 진단(계정([{ date: date(20), n: 5000 }, { date: date(2), n: 5100 }], posts, { ownComments: 0 }), NOW);
  assert.notEqual(신호(fresh, '닿음').판정, '모름');
  assert.notEqual(신호(fresh, '남김').판정, '모름');
  const old = 진단(계정([{ date: date(30), n: 5000 }, { date: date(12), n: 5100 }], posts, { ownComments: 0 }), NOW);
  for (const 키 of ['닿음', '남김']) {
    assert.equal(신호(old, 키).판정, '모름', 키);
    assert.match(신호(old, 키).글, /^팔로워 수를 \d+월 \d+일에 마지막으로 쟀습니다\. 다시 재면 판정합니다\.$/);
  }
  assert.equal(old.팔로워잰때, Date.parse(date(12)));
});

test('요약쓰기는 덜 읽은 장부로 앞 요약을 덮지 않는다', () => {
  const 자리 = repo => path.join(repo, 'out', 'summary.json');
  const 쓰기 = (repo, ...more) => 부르기(['--요약쓰기', '--저장소', repo, '--자리', 자리(repo), '--지금', new Date(NOW).toISOString(), ...more]);
  // 깨진 줄(합치다 만 자국)
  const a = 임시저장소();
  fs.appendFileSync(path.join(a, 'docs', '_ops', '게시성과.jsonl'), '<<<<<<< HEAD\n');
  const broken = 쓰기(a);
  assert.equal(broken.code, 1); assert.match(broken.out, /읽지 못한 줄이 있습니다/); assert.equal(fs.existsSync(자리(a)), false);
  // 팔로워 장부 없음
  const b = 임시저장소();
  fs.rmSync(path.join(b, 'docs', '_ops', '채널성과.jsonl'));
  assert.match(쓰기(b).out, /채널 성과 장부/); assert.equal(fs.existsSync(자리(b)), false);
  // 계정 목록 없음
  const d = 임시저장소();
  fs.rmSync(path.join(d, 'docs', '마케팅', 'sns-계정.json'));
  assert.match(쓰기(d).out, /계정 목록/);
  // 계정 줄이 절반 아래로 줄어듦
  const c = 임시저장소();
  fs.mkdirSync(path.dirname(자리(c)));
  const before = JSON.stringify({ 판: 1, 방: { rows: [{}, {}, {}] } });
  fs.writeFileSync(자리(c), before);
  const shrunk = 쓰기(c);
  assert.equal(shrunk.code, 1); assert.match(shrunk.out, /3개에서 1개로 줄었습니다/); assert.equal(fs.readFileSync(자리(c), 'utf8'), before);
  const forced = 쓰기(c, '--줄어도');
  assert.equal(forced.code, 0, forced.out);
  const s = JSON.parse(fs.readFileSync(자리(c), 'utf8'));
  assert.equal(s.방.rows[0].nm, '인스타그램 @a');
  // 숫자를 마지막으로 잰 때를 싣는다
  assert.deepEqual(Object.keys(s), ['판', '만든때', '숫자', '방']);
  assert.equal(s.숫자.팔로워, date(0));
  assert.equal(s.숫자.게시, null, '판정 시각이 없는 장부는 모른다고 둔다');
});

/** 방의 꼴을 이름만 남긴다: 줄 꼴마다 칸 수, 길의 단계 열쇠, 줄과 방의 열쇠 */
function 꼴(room) {
  const sig = { 방: Object.keys(room).filter(k => k !== 'when').sort().join(','), 줄: new Set(), 안쪽: new Set(), 단계: new Set() };
  for (const r of room.rows) {
    sig.줄.add(Object.keys(r).sort().join(','));
    for (const m of r.more) { sig.안쪽.add(`${m[0]}/${m.length}`); if (m[0] === 'flow') for (const s of m[1]) sig.단계.add(Object.keys(s).sort().join(',')); }
  }
  return sig;
}

test('방의 꼴은 설치된 앱이 읽는 견본(판 1)에 있는 꼴만 쓴다', () => {
  // 견본: desktop/tests/fixtures/sns-health-summary-v1.json. 여기에 없는 줄 꼴이나 칸을 엔진이 내면 옛 앱은 그 줄을 말없이 버린다.
  // 꼴을 더할 때는 옛 앱에서 빠져도 되는 줄인지 보고 견본에 더한다. 있는 꼴의 칸이나 단계 열쇠를 바꿀 때는 요약의 판을 올린다.
  const 견본 = 꼴(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'tests', 'fixtures', 'sns-health-summary-v1.json'), 'utf8')).방);
  const bad = 진단({ ...계정(20000, Array.from({ length: 8 }, () => ({ ...편(300, 0, 0, 0, 6), earlyRetention3sPct: 30, completionRatePct: 4 }))), key: 'bad', name: '큰 계정' }, NOW);
  const good = 진단({ ...계정([{ date: date(14), n: 150 }, { date: date(0), n: 190 }], Array.from({ length: 8 }, (_, i) => ({ ...편(2000 + i * 400, 30, 20, 20, 100), averageViewPct: 70 }))), key: 'good', name: '작은 계정', ownComments: 0 }, NOW);
  const early = 진단({ ...계정(10, [편(5)]), key: 'early-1', name: '새 계정' }, NOW);
  const 지금 = 꼴(방([good, bad, early], { now: NOW }));
  assert.equal(지금.방, 견본.방);
  for (const k of ['줄', '안쪽', '단계']) for (const x of 지금[k]) assert.ok(견본[k].has(x), `견본에 없는 ${k} 꼴: ${x}`);
  for (const x of ['say/2', 'good/3', 'head/2', 'flow/3', 'text/2', 'row/6', 'do/3', 'goal/3', 'note/2']) assert.ok(견본.안쪽.has(x), `견본에 ${x}이 있어야 한다`);
  assert.ok(지금.안쪽.has('flow/3') && 지금.안쪽.has('row/6') && 지금.안쪽.has('do/3'), [...지금.안쪽].join(' '));
});

test('아직 이른 계정의 이름이 많으면 열둘만 적고 나머지는 수로 말한다', () => {
  const many = Array.from({ length: 30 }, (_, i) => 진단({ ...계정(10, [편(5)]), key: 'e' + i, name: '계정' + i }, NOW));
  const row = 방(many, { now: NOW }).rows.at(-1).more.find(m => m[0] === 'row');
  assert.match(row[2], /^계정0 · .* · 계정11 외 18개$/);
});
