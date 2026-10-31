'use strict';
// 광고 반응 리포트 도구(tools/반응리포트/) — 네트워크 없이 도는 순수 함수 시험. node --test tests/반응리포트.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

const 플랫폼 = require('../tools/반응리포트/플랫폼.js');
const 랜딩 = require('../tools/반응리포트/랜딩.js');
const 집계모듈 = require('../tools/반응리포트/집계.js');
const 글모듈 = require('../tools/반응리포트/글.js');
const 그리기모듈 = require('../tools/반응리포트/그리기.js');
const 리포트 = require('../tools/반응리포트/리포트.js');
const 브리핑그리기 = require('../tools/업종브리핑/그리기.js');
const { latestJudgments } = require('../tools/게시성과.js');

test('게시 주소 → 장부와 같은 게시물 키(게시 성과 판정 postIdOf)', () => {
  const 키 = (u) => 플랫폼.게시키(u)?.키 ?? null;
  assert.equal(키('https://www.youtube.com/watch?v=U9DF-ZmAaxQ'), 'youtube:U9DF-ZmAaxQ');
  assert.equal(키('https://youtube.com/shorts/akfPOwhnSl8?feature=share'), 'youtube:akfPOwhnSl8');
  assert.equal(키('https://www.instagram.com/reel/Det19VyHDxo/'), 'instagram:Det19VyHDxo');
  assert.equal(키('https://www.instagram.com/p/Dey7vk-I8hu/'), 'instagram:Dey7vk-I8hu');
  assert.equal(키('https://www.tiktok.com/@synklab.mm/video/7698740136493780231?utm_campaign=x'), 'tiktok:7698740136493780231');
  assert.equal(키('https://www.facebook.com/reel/1789856122228259/'), 'facebook:1789856122228259');
  assert.equal(키('https://synk.im/pulse/'), null);
  assert.equal(키('아무 글'), null);
});

// 장부 견본: 같은 post|point 여러 줄 · 7일 없음 → 72시간 · 페이스북 조회 없음 · 인스타 3초 유지 (추정) · 인스타 7일 줄에 유지 없음 · 화면 값
function 장부() {
  const 줄 = (post, point, publishedAt, observedAt, metrics, 덧 = {}) => ({ kind: '판정', at: observedAt, post, point, account: 덧.account || 'lab-youtube', format: 덧.format || 'youtube-shorts', publishedAt, observedAt, metrics, ...덧 });
  const L = [];
  // 같은 계정 · 형식의 앞선 편 다섯 — 7일 조회 600 · 700 · 800 · 900 · 1000(중앙 800)
  [600, 700, 800, 900, 1000].forEach((v, i) => L.push(줄(`youtube:old${i}`, '7d', `2026-10-0${i + 1}T12:00:00Z`, `2026-10-0${i + 8}T12:00:00Z`, { views: v })));
  L.push(줄('youtube:a', '72h', '2026-10-20T12:00:00Z', '2026-10-23T12:00:00Z', { views: 900, averageWatchSeconds: 9.5 }, { line: '조회 900 · 평균 시청 9.5초(창) · 평소 대비 5배' }));
  L.push(줄('youtube:a', '7d', '2026-10-20T12:00:00Z', '2026-10-27T00:00:00Z', { views: 1200, stayedToWatchPct: 21 }, { screenMetrics: ['stayedToWatchPct'], multiple: { value: 7.2, median: 167, n: 12 }, line: '조회 1,200 · 본 비율 21%(화면·4일째) → 보통', standing: { views: { label: 'middle', n: 11 } } }));
  L.push(줄('youtube:a', '7d', '2026-10-20T12:00:00Z', '2026-10-27T00:00:00Z', { views: 1220, stayedToWatchPct: 21 }, { screenMetrics: ['stayedToWatchPct'], multiple: { value: 7.3, median: 167, n: 12 }, line: '조회 1,220 · 본 비율 21%(화면·4일째) → 보통', standing: { views: { label: 'middle', n: 11 } } }));
  L.push(줄('instagram:b', '72h', '2026-10-20T12:00:00Z', '2026-10-23T12:00:00Z', { views: 120, earlyRetention3sPct: 27.6 }, { account: 'lab-instagram', format: 'instagram-reels', line: '조회 120 · 3초 유지율 27.6%(추정) · 평소 대비 1.0배' }));
  L.push(줄('instagram:b', '7d', '2026-10-20T12:00:00Z', '2026-10-27T12:00:00Z', { views: 140, likes: 3 }, { account: 'lab-instagram', format: 'instagram-reels', line: '조회 140 · 좋아요 3' }));
  L.push(줄('facebook:c', '7d', '2026-10-20T12:00:00Z', '2026-10-27T12:00:00Z', { likes: 2, averageWatchSeconds: 16 }, { account: 'lab-facebook', format: 'facebook-reels', screenMetrics: ['averageWatchSeconds'], line: '좋아요 2 · 평균 시청 16초(화면·6일째)' }));
  L.push(줄('youtube:d', '72h', '2026-10-27T12:00:00Z', '2026-10-30T12:00:00Z', { views: 300 }));
  return latestJudgments(L);
}

test('장부 시점 고르기 — 가장 늦은 판정 · 72시간 대체 · 유지 칸은 칸마다 출처 시점 · 추정 · 화면', () => {
  const 최신 = 장부();
  const a = 플랫폼.장부고르기(최신, 'youtube:a', '1주');
  assert.equal(a.시점, '7d');
  assert.equal(a.숫자.조회, 1220, '같은 post · 시점이면 장부에서 가장 늦은 줄');
  assert.equal(a.나이일, 6.5);
  assert.deepEqual(a.칸출처.본비율, { 시점이름: '7일', 추정: false, 창: false, 화면일: 4 });
  assert.equal(a.숫자.평균시청, 9.5, '7일 줄에 없는 유지 칸은 72시간 줄에서');
  assert.deepEqual(a.칸출처.평균시청, { 시점이름: '72시간', 추정: false, 창: true, 화면일: null });
  assert.deepEqual(a.위치, { 글: '보통', 편수: 11 });
  assert.equal(a.평소, null, '장부 multiple(나이 섞임)은 쓰지 않는다');
  const b = 플랫폼.장부고르기(최신, 'instagram:b', '1주');
  assert.equal(b.숫자.조회, 140);
  assert.equal(b.숫자.앞3초유지, 27.6, '인스타 7일 줄엔 유지가 없어 72시간 줄에서');
  assert.equal(b.칸출처.앞3초유지.추정, true);
  const c = 플랫폼.장부고르기(최신, 'facebook:c', '1주');
  assert.equal(c.숫자.조회, undefined, '페이스북 7일 줄엔 조회가 없다');
  const d = 플랫폼.장부고르기(최신, 'youtube:d', '1주');
  assert.equal(d.시점, '72h');
  assert.match(d.모자람, /7일 판정 전/);
  assert.equal(플랫폼.장부고르기(최신, 'youtube:a', '4주'), null, '장부에 28일 판정은 없다');
});

test('같은 나이 평소 — 장부는 같은 계정 · 형식 · 시점 앞선 편(이 편 뺌, 4편부터)', () => {
  const 최신 = 장부();
  const 키 = { 플랫폼: 'youtube', id: 'a', 키: 'youtube:a' };
  const a = 플랫폼.평소붙이기(플랫폼.장부고르기(최신, 'youtube:a', '1주'), { 최신, 서버: null, 키 });
  assert.deepEqual(a.평소, { 중앙: 800, 편수: 5, 출처: '게시 성과 장부(같은 나이)', 배수: 1.53 });
  const b = 플랫폼.평소붙이기(플랫폼.장부고르기(최신, 'instagram:b', '1주'), { 최신, 서버: null, 키: { 플랫폼: 'instagram', id: 'b', 키: 'instagram:b' } });
  assert.equal(b.평소, null, '같은 계정 앞선 편이 없으면 말하지 않는다');
  const d = 플랫폼.평소붙이기(플랫폼.장부고르기(최신, 'youtube:d', '1주'), { 최신, 서버: null, 키: { 플랫폼: 'youtube', id: 'd', 키: 'youtube:d' } });
  assert.equal(d.평소, null, '72시간 숫자는 72시간 앞선 편끼리만(견본엔 없다)');
});

function 서버견본() {
  const H = 3600000;
  const 게시 = (i) => Date.parse('2026-09-01T00:00:00Z') + i * 24 * H;
  const posts = [], snapshots = [];
  for (let i = 0; i < 6; i++) {
    posts.push({ id: `p${i}`, channelId: 'c1', externalId: `vid0000000${i}`, url: `https://www.youtube.com/watch?v=vid0000000${i}`, publishedAt: new Date(게시(i)).toISOString(), publicationFormat: 'youtube-shorts' });
    snapshots.push([`p${i}`, 게시(i) + 677 * H, 100 * (i + 1), 1, 0, 0, 0, null]); // 28일째(672시간 + 5시간)
    snapshots.push([`p${i}`, 게시(i) + 170 * H, 50 * (i + 1), 1, 0, 0, 0, null]); // 7일째
  }
  snapshots.push(['p5', 게시(5) + 900 * H, 9999, 0, 0, 0, 0, null]); // 기간 밖
  posts.push({ id: 'q', channelId: 'c2', externalId: 'other', url: 'https://www.instagram.com/reel/other/', publishedAt: new Date(게시(9)).toISOString(), publicationFormat: 'instagram-reels' });
  return { channels: [{ id: 'c1', platform: 'youtube' }, { id: 'c2', platform: 'instagram' }], posts, snapshots };
}

test('서버 하루 숫자 — 672시간에 가장 가까운 값(±13시간), 앞선 편의 같은 나이 평소(이 편 뺌), 7일째 → 28일째 꼬리', () => {
  const 서버 = 서버견본();
  const 키 = 플랫폼.게시키('https://youtu.be/vid00000005');
  const r = 플랫폼.평소붙이기(플랫폼.서버고르기(서버, 키, '4주'), { 최신: null, 서버, 키 });
  assert.equal(r.숫자.조회, 600);
  assert.equal(r.나이일, 28.2);
  assert.deepEqual(r.평소, { 중앙: 300, 편수: 5, 출처: '회사 서버 하루 숫자(같은 나이)', 배수: 2 }, '앞선 다섯 편 100~500의 중앙값 300(이 편 600은 뺀다)');
  assert.deepEqual(r.꼬리, { 일주조회: 300, 늘어남: 300, 앞나이일: 7.1 });
  assert.equal(플랫폼.서버고르기(서버, 플랫폼.게시키('https://youtu.be/none0000000'), '4주'), null);
  // 7일째 값이 28일째보다 크면(계수 정정) 꼬리를 내지 않는다
  const 줄어든 = { ...서버, snapshots: 서버.snapshots.map((s) => (s[0] === 'p5' && s[2] === 300 ? [...s.slice(0, 2), 700, ...s.slice(3)] : s)) };
  assert.equal(플랫폼.서버고르기(줄어든, 키, '4주').꼬리, null);
});

test('유튜브 지금 숫자 — 받은 때 기준 나이 · 모자람 · 평소 없음', () => {
  const r = 플랫폼.유튜브지금고르기({ 올린때: '2026-10-20T12:00:00Z', 조회: 3000, 좋아요: 9, 댓글수: 2 }, '4주', '2026-11-10T12:00:00Z');
  assert.equal(r.나이일, 21);
  assert.equal(r.시점이름, '21일째');
  assert.match(r.모자람, /아직 21일째/);
  assert.deepEqual(r.숫자, { 조회: 3000, 좋아요: 9, 댓글: 2 });
  assert.equal(플랫폼.평소붙이기(r, { 최신: 장부(), 서버: 서버견본(), 키: { 플랫폼: 'youtube', id: 'x', 키: 'youtube:x' } }).평소, null, '나이가 다른 편끼리는 견주지 않는다');
});

test('손 입력 — 같은 게시물 · 시점의 마지막 줄, 평소는 「같은 나이」라고 밝힌 것만', () => {
  const 줄 = [{ 주소: 'https://www.instagram.com/reel/Det19VyHDxo/', 시점: '1주', 조회: 100, 출처: '메타 광고 관리자' }, { 주소: 'https://www.instagram.com/reel/Det19VyHDxo/', 시점: '1주', 조회: 140, 평소중앙: 100, 평소편수: 6, 평소정의: '같은 나이', 출처: '메타 광고 관리자' }];
  const r = 플랫폼.손입력고르기(줄, 'instagram:Det19VyHDxo', '1주');
  assert.equal(r.숫자.조회, 140);
  assert.equal(r.평소.중앙, 100);
  assert.equal(플랫폼.손입력고르기([{ ...줄[1], 평소정의: undefined }], 'instagram:Det19VyHDxo', '1주').평소, null);
});

function 하루응답({ 세션, 스크롤, 참여, 헛, 봇 = 1 }) {
  return [
    { metricName: 'Traffic', information: [{ totalSessionCount: String(세션), totalBotSessionCount: String(봇), distantUserCount: String(세션 - 1), PagesPerSessionPercentage: 1.5, Url: 'https://synk.im/pulse/' }, { totalSessionCount: '50', Url: 'https://synk.im/' }] },
    { metricName: 'ScrollDepth', information: [{ averageScrollDepth: 스크롤, Url: 'https://synk.im/pulse/' }, { averageScrollDepth: 99, Url: 'https://synk.im/' }] },
    { metricName: 'EngagementTime', information: [{ totalTime: 참여 + 10, activeTime: 참여, Url: 'https://synk.im/pulse/' }] },
    { metricName: 'DeadClickCount', information: [{ sessionsCount: 세션, subTotal: 3, sessionsWithMetricPercentage: 헛, Url: 'https://synk.im/pulse/' }] },
    { metricName: 'PopularPages', information: [{ url: 'https://synk.im/pulse/', visitsCount: 3 }] },
  ];
}

test('Clarity 응답 읽기 — 글 숫자 · 문서와 실제 코드의 칸 이름 철자 · 차원', () => {
  const 행 = 랜딩.응답읽기(하루응답({ 세션: 10, 스크롤: 40, 참여: 20, 헛: 10 }));
  const 교통 = 행.find((r) => r.지표 === 'Traffic' && r.차원.URL === 'https://synk.im/pulse/');
  assert.deepEqual(교통.값, { 세션: 10, 봇세션: 1, 사람: 9, 세션당쪽수: 1.5 });
  assert.equal(행.find((r) => r.지표 === 'ScrollDepth').값.평균스크롤, 40);
  assert.equal(랜딩.글수('12.5%'), 12.5);
  assert.equal(랜딩.글수(''), null);
  assert.equal(랜딩.랜딩인가('https://synk.im/pulse/?utm_source=yt', 'https://synk.im/pulse'), true);
  assert.equal(랜딩.랜딩인가('https://synk.im/', 'https://synk.im/pulse/'), false);
  assert.equal(랜딩.랜딩인가('https://synk.im/pulsex/', 'https://synk.im/pulse/'), false);
});

test('하루 장부 고르기 — 겹친 받기 · 48시간 행과 겹침 · 기간 밖은 빼고, 빈 시간을 센다', () => {
  const 줄 = (받은때, 창시간 = 24) => ({ 받은때, 차원: 'URL', 창시간, 응답: [] });
  const 장부 = [줄('2026-10-21T00:00:00Z'), 줄('2026-10-22T00:00:00Z'), 줄('2026-10-22T06:00:00Z'), 줄('2026-10-23T00:00:00Z', 48), 줄('2026-10-24T00:00:00Z'), 줄('2026-11-02T00:00:00Z')];
  const g = 랜딩.기간고르기(장부, '2026-10-20T00:00:00Z', '2026-10-27T00:00:00Z').URL;
  assert.equal(g.줄들.length, 3);
  assert.equal(g.겹쳐뺀수, 2, '6시간 뒤 다시 받은 줄과 앞 이틀을 다시 덮는 48시간 줄');
  assert.equal(g.덮은시간, 72);
  assert.equal(g.빈시간, 168 - 72);
});

test('기간 합치기 — 세션은 합, 스크롤 · 시간 · 헛클릭 비율은 세션 가중 평균, 사람 수는 더하지 않는다', () => {
  const 장부 = [
    { 받은때: '2026-10-21T00:00:00Z', 차원: 'URL', 창시간: 24, 응답: 하루응답({ 세션: 10, 스크롤: 40, 참여: 20, 헛: 10 }) },
    { 받은때: '2026-10-22T00:00:00Z', 차원: 'URL', 창시간: 24, 응답: 하루응답({ 세션: 30, 스크롤: 80, 참여: 60, 헛: 30 }) },
  ];
  const r = 랜딩.랜딩모으기({ 장부, 랜딩: { 주소: 'https://synk.im/pulse/' }, 시작: '2026-10-20T00:00:00Z', 끝: '2026-10-27T00:00:00Z' });
  assert.equal(r.상태, '됨');
  assert.equal(r.전체.세션, 40);
  assert.equal(r.전체.봇세션, 2);
  assert.equal(r.전체.평균스크롤, 70, '(40×10 + 80×30) ÷ 40');
  assert.equal(r.전체.참여시간, 50);
  assert.equal(r.전체.신호.헛클릭.걸린비율, 25);
  assert.equal('사람' in r.전체, false, '날마다 센 사람 수를 더하면 같은 사람이 겹쳐 세진다(검토 7)');
  assert.equal(r.덮음.받은날수, 2);
  assert.equal(랜딩.랜딩모으기({ 장부: [], 랜딩: { 주소: 'https://synk.im/pulse/' }, 시작: '2026-10-20', 끝: '2026-10-27' }).상태, '측정 전');
});

test('측정 코드 확인 — 있음 · 없음 · 못 읽음을 가른다', async () => {
  const 응답 = (ok, 글) => async () => ({ ok, text: async () => 글 });
  assert.equal(await 랜딩.측정코드있나('https://synk.im/pulse/', 'z67ez8kfp3', 응답(true, '<script>(window,document,"clarity","script","z67ez8kfp3");</script>')), true);
  assert.equal(await 랜딩.측정코드있나('https://synk.im/pulse/', 'z67ez8kfp3', 응답(true, '<html></html>')), false);
  assert.equal(await 랜딩.측정코드있나('https://synk.im/pulse/', 'z67ez8kfp3', 응답(false, '')), null, '쪽을 못 읽으면 코드 없음으로 치지 않는다');
  assert.equal(await 랜딩.측정코드있나('https://synk.im/pulse/', 'z67ez8kfp3', async () => { throw new Error('끊김'); }), null);
});

test('칸 지도에 평균 스크롤 얹기 — 칸 안 자리와 경계', () => {
  const 지도 = { 폭: 390, 칸: [{ id: 'top', 이름: '첫 화면', 위: 0, 아래: 8.5 }, { id: 'film', 이름: '영상', 위: 8.5, 아래: 45 }, { id: 'contact', 이름: '문의', 위: 84, 아래: 91.7 }] };
  assert.deepEqual(랜딩.칸얹기(지도, 10), { id: 'film', 이름: '영상', 칸안: '앞부분' });
  assert.equal(랜딩.칸얹기(지도, 44.9).칸안, '끝부분');
  assert.equal(랜딩.칸얹기(지도, 0).id, 'top');
  assert.equal(랜딩.칸얹기(지도, 95).id, '_끝');
  assert.equal(랜딩.칸얹기(지도, null), null);
  assert.equal(랜딩.기기지도([{ 폭: 390 }, { 폭: 1440 }], 'Mobile').폭, 390);
  assert.equal(랜딩.기기지도([{ 폭: 390 }, { 폭: 1440 }], 'PC').폭, 1440);
});

// 끝까지 한 벌: 숫자 든 광고 이름 · &·' 든 이름 · 랜딩 측정 전 · 댓글 둘
function 한벌() {
  const 설정 = { 이름: '시험', 제목: '시험 캠페인', 업종: '시험', 받는사람: 'A & B\'s 가게', 납품일: '2026-10-20', 광고: [{ 키: '간', 이름: '관용구 퀴즈 4 「간」', 주소: ['https://www.youtube.com/watch?v=U9DF-ZmAaxQ', 'https://www.instagram.com/reel/Det19VyHDxo/'] }, { 키: '총동원', 이름: 'R&D 팀\'s 편', 주소: ['https://www.youtube.com/watch?v=y1DagXoCxwo'] }], 랜딩: { 주소: 'https://synk.im/pulse/' } };
  const 숫자 = (조회, 덧 = {}) => ({ 출처: '게시 성과 장부', 시점: '7d', 시점이름: '7일', 모자람: null, 나이일: 7, 게시때: '2026-10-20T12:00:00Z', 숫자: { 조회, 좋아요: 3, 댓글: 1, ...덧.숫자 }, 칸출처: 덧.칸출처 || {}, 위치: 덧.위치 || null, 평소: 덧.평소 || null });
  const 플랫폼행 = [
    { 광고: '간', 플랫폼: 'youtube', 주소: 설정.광고[0].주소[0], 키: 'youtube:U9DF-ZmAaxQ', 숫자: 숫자(1220, { 숫자: { 본비율: 21 }, 칸출처: { 본비율: { 시점이름: '7일', 화면일: 4 } }, 평소: { 중앙: 800, 편수: 5, 출처: '게시 성과 장부(같은 나이)', 배수: 1.53 }, 위치: { 글: '보통', 편수: 11 } }) },
    { 광고: '간', 플랫폼: 'instagram', 주소: 설정.광고[0].주소[1], 키: 'instagram:Det19VyHDxo', 숫자: 숫자(113, { 평소: { 중앙: 130, 편수: 6, 출처: '게시 성과 장부(같은 나이)', 배수: 0.87 } }) },
    { 광고: '총동원', 플랫폼: 'youtube', 주소: 설정.광고[1].주소[0], 키: 'youtube:y1DagXoCxwo', 숫자: null, 까닭: '없음' },
  ];
  const 댓글 = { 상태: '됨', 목록: [{ 키: 'U9DF-ZmAaxQ#0', 광고: '간', 영상: 'U9DF-ZmAaxQ', 글: '간이 콩알만 해진다는 말 처음 알았어요 신기하네요', 좋아요: 4 }, { 키: 'U9DF-ZmAaxQ#1', 광고: '간', 영상: 'U9DF-ZmAaxQ', 글: '이거 무슨 뜻이에요?', 좋아요: 1 }], 장부: [{ 광고: '간', 플랫폼: 'youtube', 수: 2 }, { 광고: '간', 플랫폼: 'instagram', 수: 1 }] };
  const 나누기 = { 댓글: { 'U9DF-ZmAaxQ#0': ['칭찬·감탄'], 'U9DF-ZmAaxQ#1': ['내용 헷갈림'] } };
  const 모음 = 집계모듈.집계({ 설정, 플랫폼행, 랜딩: { 상태: '측정 전', 까닭: 'Clarity 프로젝트가 아직 없다' }, 댓글, 나누기 });
  return { 설정, 모음 };
}

function 좋은글(모음) {
  return {
    한줄: '{{광고.간.이름}}은 유튜브에서 평소의 {{광고.간.유튜브.평소대비}}였어요.',
    타일: [{ 라벨: '유튜브 조회', 지표: '광고.간.유튜브.조회', 설명: '7일 판정' }, { 라벨: '평소 대비', 지표: '광고.간.유튜브.평소대비', 설명: '같은 나이' }, { 라벨: '인스타', 지표: '광고.간.인스타.평소대비', 설명: '같은 나이' }, { 라벨: '댓글', 지표: '댓글.수', 설명: '유튜브' }],
    플랫폼: '관용구 퀴즈 4 「간」은 유튜브에서 평소보다 많이 보였고, 인스타에선 평소의 {{광고.간.인스타.평소대비}}였어요. 앞 3초 뒤 본 비율은 {{광고.간.유튜브.본비율}}이에요.',
    랜딩: '', 댓글: '뜻을 묻는 댓글이 있었어요.',
    바꿀셋: [
      { 어디: '영상', 무엇: '첫 장면에 답 먼저', 왜: '본 비율이 {{광고.간.유튜브.본비율}}로 첫 부분에서 많이 넘겼어요.', 어떻게: '첫 장면에 결과를 먼저 보여요.', 근거: ['광고.간.유튜브.본비율'] },
      { 어디: '영상', 무엇: '인스타 첫 화면 바꾸기', 왜: '인스타는 평소보다 덜 보였어요.', 어떻게: '인스타판 표지를 따로 만들어요.', 근거: ['광고.간.인스타.평소대비'] },
      { 어디: '댓글·운영', 무엇: '뜻을 고정 댓글로', 왜: '뜻을 묻는 댓글이 {{댓글.주제.내용 헷갈림.수}} 있었어요.', 어떻게: '고정 댓글에 뜻을 적어요.', 근거: ['댓글.주제.내용 헷갈림.수'] },
    ],
    덜낸까닭: '', 지킬것: { 무엇: '유튜브 퀴즈 꼴', 근거: ['광고.간.유튜브.평소대비'] },
    예시: [{ 댓글: 'U9DF-ZmAaxQ#1', 뜻: '표현의 뜻을 묻는 말' }],
  };
}

test('글 검사 — 숫자 든 광고 이름 허용 · 바꿀 것은 그 갈래의 약한 신호 · 지킬 것은 센 신호 · 「멈췄다」 금지', () => {
  const { 설정, 모음 } = 한벌();
  const 표본댓글 = Object.fromEntries(Object.values(모음.표본.댓글).flat().map((c) => [c.키, c.글]));
  const 검 = (글) => 글모듈.검사하기(글, { 지표: 모음.지표, 표본댓글, 상태: 모음.상태, 허용낱말: 설정.광고.map((a) => a.이름) });
  assert.deepEqual(검(좋은글(모음)), []);
  const 나쁜 = 좋은글(모음);
  나쁜.바꿀셋[0].근거 = ['광고.간.유튜브.조회']; // 조회만으로 첫 부분을 말함 · 약한 신호 아님
  나쁜.바꿀셋[1] = { 어디: '랜딩', 무엇: '랜딩 위로', 왜: '사람들이 첫 화면에서 멈췄어요.', 어떻게: '작업 영상을 위로', 근거: [] };
  나쁜.지킬것 = { 무엇: '인스타 꼴', 근거: ['광고.간.인스타.평소대비'] };
  나쁜.랜딩 = '평균적으로 둘째 칸에서 멈췄어요.';
  나쁜.플랫폼 = '유튜브에서 1,220회 보였어요. 일곱 배였어요.';
  const 문제 = 검(나쁜);
  assert.ok(문제.some((x) => /바꿀셋1.*약한 신호가 아니다/.test(x)), 문제.join('\n'));
  assert.ok(문제.some((x) => /바꿀셋1\.왜가 영상 앞부분/.test(x)));
  assert.ok(문제.some((x) => /바꿀셋2.*「랜딩」.*못 읽었다/.test(x)));
  assert.ok(문제.some((x) => /지킬것.*센 신호/.test(x)));
  assert.ok(문제.some((x) => /「랜딩」 칸의 자료를 이번엔 못 읽었다/.test(x)));
  assert.ok(문제.some((x) => /「랜딩」 칸에 「멈췄다」/.test(x)));
  assert.ok(문제.some((x) => /플랫폼에 자리표시자 밖 숫자/.test(x)));
  assert.ok(문제.some((x) => /플랫폼에 배수를 말로 풀어 쓴 곳이 있다\(「일곱 배」\)/.test(x)), '고유어 배수도 자료 값이다');
  const 둘 = 좋은글(모음); 둘.바꿀셋 = 둘.바꿀셋.slice(0, 2);
  assert.ok(검(둘).some((x) => /덜낸까닭/.test(x)), '셋을 못 채우면 까닭을 쓴다');
  둘.덜낸까닭 = '랜딩을 아직 못 재서 바꿀 곳을 더 못 집었어요.';
  assert.deepEqual(검(둘), []);
  const 옮김 = 좋은글(모음); 옮김.예시 = [{ 댓글: 'U9DF-ZmAaxQ#0', 뜻: '간이 콩알만 해진다는 말 처음 알았어요' }];
  assert.ok(검(옮김).some((x) => /원문을 그대로/.test(x)));
});

test('신호 — 약함 · 셈의 문턱', () => {
  const x = (값) => ({ 값 });
  assert.equal(글모듈.신호('광고.간.유튜브.평소대비', x(0.8)), '약함');
  assert.equal(글모듈.신호('광고.간.유튜브.평소대비', x(1.5)), '셈');
  assert.equal(글모듈.신호('광고.간.유튜브.위치', x('하위 25%')), '약함');
  assert.equal(글모듈.신호('광고.간.유튜브.위치', x('보통')), null);
  assert.equal(글모듈.신호('광고.간.유튜브.본비율', x(21)), '약함');
  assert.equal(글모듈.신호('랜딩.휴대폰.평균스크롤', x(62)), '셈');
  assert.equal(글모듈.신호('랜딩.되돌아감비율', x(8)), '약함');
  assert.equal(글모듈.신호('광고.간.유튜브.조회', x(1220)), null);
  assert.equal(글모듈.신호('댓글.수', x(0)), '약함');
});

test('그리기 — 자리표시자가 남지 않고, &·\' 든 이름도 값으로 채우고, 측정 전 칸 · 덜 낸 바꿀 것을 보인다', () => {
  const { 설정, 모음 } = 한벌();
  const 글 = 좋은글(모음);
  글.바꿀셋 = 글.바꿀셋.slice(0, 2); 글.덜낸까닭 = '랜딩을 아직 못 재서 바꿀 곳을 더 못 집었어요.';
  const { 문서, 조각 } = 그리기모듈.그리기({ 지표: 모음.지표, 그림: 모음.그림, 표본: 모음.표본, 글, 상태: 모음.상태, 설정, 시점: '1주', 기준일: '2026-10-30', 지도들: [{ 폭: 390, 쪽높이: 13528, 칸: [{ id: 'top', 이름: '첫 화면', 위: 0, 아래: 8.5 }, { id: 'film', 이름: '영상', 위: 8.5, 아래: 45 }] }] });
  assert.equal(문서.includes('{{'), false);
  assert.ok(문서.includes('1,220'));
  assert.ok(문서.includes('1.53배'));
  assert.ok(문서.includes('아직 랜딩에 측정 코드를 넣기 전이라'), '랜딩 측정 전은 읽는 사람 말로(안쪽 까닭 글을 싣지 않는다)');
  assert.equal(문서.includes('Clarity 프로젝트가 아직 없다'), false);
  assert.ok(문서.includes('class="칸지도"'), '측정 전에도 칸 지도는 보인다');
  assert.ok(문서.includes('다음 편에서 바꿀 것'));
  assert.ok(문서.includes('A &amp; B&#39;s 가게'));
  assert.ok(조각.startsWith('<title>'));
  // 지표 이름에 &·'가 들어도 채워진다(브리핑 글HTML 고침)
  const 지표 = { "R&D 팀's.조회": { 값: 5, 단위: '회', 출처: 'x', 설명: 'y' } };
  assert.match(브리핑그리기.글HTML("{{R&D 팀's.조회}} 보였어요 <b>", 지표), /<b class="수"[^>]*>5회<\/b> 보였어요 &lt;b&gt;/);
});

test('순위표 — 배수 큰 순 · 같은 광고 · 플랫폼의 조회를 붙이고 · 이름은 이스케이프 · 평소(1배) 자리는 최대에 맞춰', () => {
  const { 설정, 모음 } = 한벌();
  const { 문서 } = 그리기모듈.그리기({ 지표: 모음.지표, 그림: 모음.그림, 표본: 모음.표본, 글: 좋은글(모음), 상태: 모음.상태, 설정, 시점: '1주', 기준일: '2026-10-30', 지도들: [] });
  const 표 = 문서.slice(문서.indexOf('<table class="순위표"'), 문서.indexOf('</table>', 문서.indexOf('<table class="순위표"')));
  assert.ok(표.length > 0, '플랫폼 칸에 순위표가 있다');
  const 배수들 = [...표.matchAll(/<span class="배"[^>]*>([\d.]+)배<\/span>/g)].map((m) => Number(m[1]));
  assert.equal(배수들.length, 모음.그림.플랫폼.막대.length);
  assert.deepEqual(배수들, [...배수들].sort((a, b) => b - a), '배수 큰 순');
  const 첫 = [...모음.그림.플랫폼.막대].sort((a, b) => b.배수 - a.배수)[0];
  const 첫조회 = 모음.그림.플랫폼.표.find((r) => r.광고 === 첫.광고 && r.플랫폼 === 첫.플랫폼).숫자.숫자.조회;
  assert.ok(표.split('</tr>')[1].includes(`${첫조회.toLocaleString('ko-KR')}</td>`), '첫 줄 조회는 같은 광고 · 플랫폼 행에서');

  // 한 광고에 같은 플랫폼 주소가 둘이어도 줄마다 제 행의 조회를 단다(막대는 평소 있는 표 행을 같은 차례로 옮긴 것)
  const 그림 = structuredClone(모음.그림);
  const 원행 = 그림.플랫폼.표.find((r) => r.숫자?.평소);
  const 둘째 = structuredClone(원행); 둘째.숫자.숫자.조회 = 77777; 둘째.숫자.평소.배수 = 9.99;
  그림.플랫폼.표.splice(그림.플랫폼.표.indexOf(원행) + 1, 0, 둘째);
  그림.플랫폼.막대 = 그림.플랫폼.표.filter((r) => r.숫자?.평소).map((r) => ({ 광고: r.광고, 플랫폼: r.플랫폼, 배수: r.숫자.평소.배수 }));
  const 겹친 = 그리기모듈.그리기({ 지표: 모음.지표, 그림, 표본: 모음.표본, 글: 좋은글(모음), 상태: 모음.상태, 설정, 시점: '1주', 기준일: '2026-10-30', 지도들: [] }).문서;
  const 겹친표 = 겹친.slice(겹친.indexOf('<table class="순위표"'), 겹친.indexOf('</table>', 겹친.indexOf('<table class="순위표"'))).split('</tr>');
  assert.ok(겹친표[1].includes('9.99배') && 겹친표[1].includes('77,777</td>'), '둘째 주소 줄은 제 조회');
  const 원줄 = 겹친표.find((x) => x.includes(`>${원행.숫자.평소.배수}배<`));
  assert.ok(원줄 && 원줄.includes(`${원행.숫자.숫자.조회.toLocaleString('ko-KR')}</td>`) && !원줄.includes('77,777'), '첫 주소 줄은 첫 행 조회');

  const 작은 = 그리기모듈.순위표([
    { 이름: '<b>A & B</b>', 곳: '유튜브', 값: 4, 메모: '4배', 강조: true, 조회: 1200, 출처: '서버 "하루"' },
    { 이름: '둘', 곳: '인스타', 값: 0.5, 메모: '0.5배', 강조: false, 조회: undefined },
  ], { 최대: 4 });
  assert.ok(작은.includes('&lt;b&gt;A &amp; B&lt;/b&gt;'));
  assert.ok(작은.includes('title="서버 &quot;하루&quot;"'));
  assert.ok(작은.includes('style="--기준:0.2500"'), '평소 1배 = 1 / 최대');
  assert.ok(작은.includes('style="--w:1.0000"><span class="띠 강조">'));
  assert.ok(작은.includes('style="--w:0.1250"><span class="띠">'));
  assert.ok(작은.includes('<span class="좁을때">조회 </span>—</td>'), '조회가 없으면 —');
  assert.equal(그리기모듈.순위표([], { 최대: 2 }), '');
});

test('랜딩 기간 — 첫 게시 ~ min(기준일 끝, 마지막 게시 + 시점)', () => {
  const 설정 = { 납품일: '2026-10-20' };
  const 행 = (게시때) => ({ 숫자: { 게시때 } });
  const r = 리포트.랜딩기간(설정, { 행들: [행('2026-10-20T12:00:00Z'), 행('2026-10-23T12:00:00Z')] }, '1주', '2026-10-28');
  assert.equal(r.시작, '2026-10-20T12:00:00.000Z');
  assert.equal(r.끝, '2026-10-28T15:00:00.000Z', '기준일(서울) 끝 = 다음 날 0시 서울');
  const r2 = 리포트.랜딩기간(설정, { 행들: [행('2026-10-20T12:00:00Z')] }, '1주', '2026-11-30');
  assert.equal(r2.끝, '2026-10-27T12:00:00.000Z');
});

test('글 스키마 — 배열 maxItems · 2 이상 minItems를 넣지 않는다(구조화 출력 400)', () => {
  const 걷기 = (s, 길 = '') => {
    if (!s || typeof s !== 'object') return;
    if (s.type === 'array') { assert.equal('maxItems' in s, false, `${길} maxItems`); assert.ok(!(s.minItems > 1), `${길} minItems`); }
    for (const [k, v] of Object.entries(s)) if (v && typeof v === 'object') 걷기(v, `${길}.${k}`);
  };
  걷기(글모듈.스키마(['a'], ['b']));
});
