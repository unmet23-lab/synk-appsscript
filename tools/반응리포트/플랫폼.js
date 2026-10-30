'use strict';
/**
 * 광고 반응 리포트 · 플랫폼 — 광고 주소마다 그 시점(1주 · 4주)의 숫자를 고른다(2026-10-30).
 * 출처는 넷이고 앞의 것이 있으면 앞의 것을 쓴다:
 *   ① 게시 성과 장부(docs/_ops/게시성과.jsonl — SYNK 게시물. tools/게시성과.js가 쓰고 여기서는 그 도구의 readLedger · latestJudgments로 읽기만)
 *   ② 회사 서버 하루 숫자(tools/lib/게시성과읽기.cjs — 읽기 전용. 장부에 없는 시점 · 4주)
 *   ③ 손 입력(실행 폴더의 플랫폼_손입력.json — 고객 광고 계정 · 스튜디오에서 내보낸 숫자)
 *   ④ 유튜브 Data API 지금 숫자(videos.list — 위에 없을 때 · 고객 유튜브). 받은 때의 나이를 함께 적는다.
 * 평소 대비는 한 가지 정의만 쓴다: 같은 계정 · 같은 형식에서 이 편 앞에 올린 최근 12편이 같은 나이(7일째 · 28일째, ±13시간)에 낸 조회의 중앙값(이 편 뺌, 4편부터).
 *   장부의 multiple(그 관측 때 최근 12편의 그때까지 조회 — 어린 편이 섞여 7일째 편의 배수가 부푼다)은 쓰지 않는다(10-30 Fable 설계 검토 1: 5.52배 → 같은 나이 1.29배).
 * 시청 유지는 칸마다 그 칸이 있는 가장 늦은 판정(7일 → 72시간 → 24시간)에서 고르고 출처 시점 · 추정 · 창 · 화면 나이를 붙인다(검토 2).
 * 순수 함수만 둔다(장부 줄 · 서버 응답 · API 결과를 받아 고른다). 파일 · 네트워크는 리포트.js가 한다.
 */
const 판정 = require('../lib/게시성과판정.js');

const 하루 = 24 * 60 * 60 * 1000;
const 시점들 = Object.freeze({ '1주': { 일: 7, 장부: ['7d', '72h', '24h'] }, '4주': { 일: 28, 장부: ['28d'] } });
const 장부시점이름 = Object.freeze({ '24h': '24시간', '72h': '72시간', '7d': '7일', '28d': '28일' });
const 플랫폼이름 = Object.freeze({ youtube: '유튜브', instagram: '인스타', facebook: '페이스북', tiktok: '틱톡' });
// 장부 · 서버와 같은 칸 이름(tools/lib/게시성과판정.js METRICS) → 리포트 지표 이름
const 숫자칸 = Object.freeze({
  views: '조회', reach: '도달', likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장',
  earlyRetention3sPct: '앞3초유지', stayedToWatchPct: '본비율', averageWatchSeconds: '평균시청', averageViewPct: '평균조회율', completionRatePct: '완주율',
  follows: '팔로우', subscribersGained: '구독증가',
});
const 유지칸 = Object.freeze(['앞3초유지', '본비율', '평균시청', '평균조회율', '완주율']);
const 단위 = Object.freeze({ 조회: '회', 도달: '명', 좋아요: '개', 댓글: '개', 공유: '회', 저장: '회', 앞3초유지: '%', 본비율: '%', 평균시청: '초', 평균조회율: '%', 완주율: '%', 팔로우: '명', 구독증가: '명' });
const 평소최소편수 = 4;
const 평소편수 = 12;
const 주변시간 = 13;
const 위치글 = Object.freeze({ top25: '상위 25%', middle: '보통', bottom25: '하위 25%' });

const 수 = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const 한자리 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const 중앙값 = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** 게시 주소 → {플랫폼, id, 키} — 장부 · 게시 성과 판정과 같은 postIdOf(새 파서를 두지 않는다) */
function 게시키(주소) {
  const p = 판정.postIdOf(String(주소 || '').trim());
  return p ? { 플랫폼: p.platform, id: p.externalId, 키: p.key } : null;
}

/** 판정 줄의 사람용 글(line)에서 그 칸의 표시 — 「3초 유지율 27.6%(추정)」 · 「평균 시청 4.6초(창)」 · 「본 비율 21%(화면·4일째)」 */
function 칸표시(줄, 칸) {
  const 이름 = 판정.METRICS[칸]?.label;
  if (!이름 || typeof 줄?.line !== 'string') return {};
  const 조각 = 줄.line.split(' · ').find((p) => p.startsWith(`${이름} `));
  if (!조각) return {};
  const 화면 = /\(화면·(\d+)일째\)/.exec(조각);
  return { 추정: 조각.includes('(추정)'), 창: 조각.includes('(창)'), 화면일: 화면 ? Number(화면[1]) : null };
}

/**
 * 장부에서 한 편의 그 시점 숫자를 고른다 → null | {출처, 시점, 시점이름, 모자람, 나이일, 게시때, 숫자{지표: 값}, 칸출처{지표: {시점이름, 추정, 창, 화면일}}, 위치, 계정, 형식}
 * 조회 · 좋아요 같은 기본 숫자는 그 시점 판정(1주는 7일, 없으면 72시간 → 24시간 — 모자람에 적는다), 시청 유지 칸은 칸마다 그 칸이 있는 가장 늦은 판정.
 * 같은 post · 시점 판정이 여럿이면 tools/게시성과.js latestJudgments와 같이 장부에서 가장 늦은 줄.
 */
function 장부고르기(최신, 키, 시점 = '1주') {
  const 차례 = 시점들[시점]?.장부 || [];
  const 줄들 = 차례.map((p) => ({ p, x: 최신.get(`${키}|${p}`) })).filter((r) => r.x);
  if (!줄들.length) return null;
  const { p: 기본시점, x: 기본 } = 줄들[0];
  const 게시 = Date.parse(기본.publishedAt || '');
  const 관측 = Date.parse(기본.observedAt || '');
  const 숫자 = {}, 칸출처 = {};
  for (const [칸, 이름] of Object.entries(숫자칸)) {
    const 유지 = 유지칸.includes(이름);
    for (const { p, x } of 유지 ? 줄들 : [{ p: 기본시점, x: 기본 }]) {
      const v = 수(x.metrics?.[칸]);
      if (v === null) continue;
      숫자[이름] = v;
      칸출처[이름] = { 시점이름: 장부시점이름[p], ...칸표시(x, 칸) };
      break;
    }
  }
  const 위 = 기본.standing?.views;
  return {
    출처: '게시 성과 장부', 시점: 기본시점, 시점이름: 장부시점이름[기본시점],
    모자람: 기본시점 !== 차례[0] ? `${장부시점이름[차례[0]]} 판정 전이라 ${장부시점이름[기본시점]} 숫자` : null,
    나이일: Number.isFinite(관측 - 게시) ? 한자리((관측 - 게시) / 하루) : null, 게시때: 기본.publishedAt || null,
    숫자, 칸출처, 위치: 위 && 위치글[위.label] && Number.isFinite(위.n) ? { 글: 위치글[위.label], 편수: 위.n } : null,
    계정: 기본.account || null, 형식: 기본.format || null, 평소: null,
  };
}

/** 장부로 같은 나이 평소 — 같은 계정 · 형식에서 이 편 앞에 올린 편들의 같은 시점(고른 숫자의 판정 시점) 조회(최근 12편, 이 편 뺌) */
function 장부평소(최신, 키, 고른) {
  const p = 고른?.시점;
  if (!장부시점이름[p] || !고른.계정 || !고른.게시때) return null;
  const 게시 = Date.parse(고른.게시때);
  const 앞 = [...최신.values()].filter((x) => x.point === p && x.post !== 키 && x.account === 고른.계정 && x.format === 고른.형식 && Date.parse(x.publishedAt) < 게시 && Number.isFinite(x.metrics?.views))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 평소편수).map((x) => x.metrics.views);
  return 앞.length >= 평소최소편수 ? { 중앙: 중앙값(앞), 편수: 앞.length, 출처: '게시 성과 장부(같은 나이)' } : null;
}

// ── 회사 서버 하루 숫자 ────────────────────────────────────────────────
const 서버칸 = ['조회', '좋아요', '댓글', '공유', '저장', '도달']; // 게시성과읽기.cjs snapshots: [postId, checkedAt, views, likes, comments, shares, saves, reach]

function 서버게시물(서버, 키) {
  const 채널 = new Map((서버?.channels || []).map((c) => [c.id, c]));
  return (서버?.posts || []).find((p) => 채널.get(p.channelId)?.platform === 키.플랫폼 && (p.externalId === 키.id || 게시키(p.url)?.id === 키.id)) || null;
}

/** 그 게시물의 하루 숫자 가운데 게시 뒤 목표 시간에 가장 가까운 한 벌(±13시간) — 게시 성과 판정 dailyPoint와 같은 규칙 */
function 나이숫자(서버, postId, 게시ms, 목표시간) {
  let 고른 = null;
  for (const s of 서버?.snapshots || []) {
    if (s[0] !== postId) continue;
    const 차 = Math.abs(s[1] - (게시ms + 목표시간 * 3600000));
    if (차 <= 주변시간 * 3600000 && (!고른 || 차 < 고른.차)) 고른 = { 차, s };
  }
  return 고른?.s || null;
}

/** 서버로 같은 나이 평소 — 같은 채널 · 형식에서 이 편 앞에 올린 최근 12편이 같은 나이(목표 시간 ±13시간)에 낸 조회(이 편 뺌) */
function 서버평소(서버, 키, 목표시간) {
  const p = 목표시간 ? 서버게시물(서버, 키) : null;
  if (!p) return null;
  const 게시 = Date.parse(p.publishedAt);
  const 조회들 = (서버.posts || []).filter((q) => q.id !== p.id && q.channelId === p.channelId && q.publicationFormat === p.publicationFormat && Date.parse(q.publishedAt) < 게시)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .map((q) => 나이숫자(서버, q.id, Date.parse(q.publishedAt), 목표시간)).map((x) => (x ? 수(x[2]) : null)).filter(Number.isFinite).slice(0, 평소편수);
  return 조회들.length >= 평소최소편수 ? { 중앙: 중앙값(조회들), 편수: 조회들.length, 출처: '회사 서버 하루 숫자(같은 나이)' } : null;
}

/** 서버 하루 숫자에서 그 시점 값(장부에 없는 시점 — 4주 · 등록 안 한 편). 4주면 7일째 값도 찾아 꼬리(7일째 → 28일째 늘어난 조회)를 붙인다 */
function 서버고르기(서버, 키, 시점) {
  const 목표일 = 시점들[시점]?.일;
  const p = 목표일 ? 서버게시물(서버, 키) : null;
  if (!p) return null;
  const 게시 = Date.parse(p.publishedAt);
  const s = 나이숫자(서버, p.id, 게시, 목표일 * 24);
  if (!s) return null;
  const 숫자 = {}, 칸출처 = {};
  서버칸.forEach((이름, i) => { const v = 수(s[i + 2]); if (v !== null) { 숫자[이름] = v; 칸출처[이름] = { 시점이름: `${목표일}일` }; } });
  let 꼬리 = null;
  if (목표일 > 7 && Number.isFinite(숫자.조회)) {
    const 주 = 나이숫자(서버, p.id, 게시, 7 * 24);
    // 같은 계수기(서버 하루 숫자)의 두 끝만 견준다 — 7일째가 없거나 줄었으면(계수 정정) 꼬리를 내지 않는다(검토 3)
    if (주 && Number.isFinite(주[2]) && 숫자.조회 >= 주[2]) 꼬리 = { 일주조회: 주[2], 늘어남: 숫자.조회 - 주[2], 앞나이일: 한자리((주[1] - 게시) / 하루) };
  }
  return {
    출처: '회사 서버 하루 숫자', 시점: `${목표일}d`, 시점이름: `${목표일}일`, 모자람: null, 나이일: 한자리((s[1] - 게시) / 하루), 게시때: p.publishedAt,
    숫자, 칸출처, 위치: null, 계정: null, 형식: p.publicationFormat || null, 평소: null, 꼬리,
  };
}

/** 손 입력 한 줄 {주소, 시점, 조회, …, 평소중앙?, 평소편수?, 출처, 읽은날} → 같은 꼴. 평소는 준 사람이 「같은 나이」라고 밝힌 것만(평소정의: "같은 나이") */
function 손입력고르기(손입력, 키, 시점) {
  const 줄 = (손입력 || []).filter((r) => 게시키(r.주소)?.키 === 키 && (!r.시점 || r.시점 === 시점)).pop();
  if (!줄) return null;
  const 숫자 = {}, 칸출처 = {};
  for (const 이름 of Object.values(숫자칸)) { const v = 수(줄[이름]); if (v !== null) { 숫자[이름] = v; 칸출처[이름] = { 시점이름: 시점 }; } }
  const 중앙 = 수(줄.평소중앙), 편수 = 수(줄.평소편수);
  return {
    출처: String(줄.출처 || '손 입력').slice(0, 60), 시점, 시점이름: 시점, 모자람: null, 나이일: 수(줄.나이일), 게시때: 줄.게시때 || null, 숫자, 칸출처, 위치: null, 계정: null, 형식: null,
    평소: 줄.평소정의 === '같은 나이' && 중앙 && 편수 >= 평소최소편수 ? { 중앙, 편수, 출처: `${String(줄.출처 || '손 입력').slice(0, 40)}(같은 나이)` } : null,
  };
}

/** 유튜브 지금 숫자(API 상세 + 받은때) → 같은 꼴. 나이는 받은 때 기준, 시점 나이보다 어리면 모자람. 평소는 내지 않는다(나이가 다른 편끼리라) */
function 유튜브지금고르기(상세, 시점, 받은때) {
  if (!상세) return null;
  const 게시 = Date.parse(상세.올린때 || '');
  const 지금 = Date.parse(받은때 || '');
  const 나이일 = Number.isFinite(게시) && Number.isFinite(지금) ? 한자리((지금 - 게시) / 하루) : null;
  const 숫자 = {}, 칸출처 = {};
  for (const [k, 이름] of [['조회', '조회'], ['좋아요', '좋아요'], ['댓글수', '댓글']]) if (수(상세[k]) !== null) { 숫자[이름] = 상세[k]; 칸출처[이름] = { 시점이름: '받은 때' }; }
  const 목표 = 시점들[시점]?.일 ?? null;
  return {
    출처: '유튜브 공개 숫자', 시점: 'api', 시점이름: 나이일 === null ? '받은 때' : `${Math.floor(나이일)}일째`,
    모자람: 목표 !== null && 나이일 !== null && 나이일 < 목표 ? `아직 ${Math.floor(나이일)}일째 숫자` : null,
    나이일, 게시때: 상세.올린때 || null, 숫자, 칸출처, 위치: null, 계정: null, 형식: null, 평소: null,
  };
}

const 시간표 = Object.freeze({ '24h': 24, '72h': 72, '7d': 168, '28d': 672 });

/**
 * 고른 숫자에 같은 나이 평소를 붙인다 — 고른 숫자와 같은 계수기끼리만 견준다: 장부 숫자는 장부의 같은 시점 판정끼리, 서버 숫자는 서버 하루 숫자의 같은 나이끼리.
 * 장부 7일 판정은 서버 하루 숫자의 168시간 값이라(게시성과판정 dailyPoint) 장부에 견줄 편이 모자라면 서버의 같은 나이 값으로 견준다(등록 안 한 편까지 든다).
 * 유튜브 지금 숫자(나이가 편마다 다름) · 손 입력(준 사람이 밝힌 것만)은 여기서 붙이지 않는다. 키는 게시키() 꼴
 */
function 평소붙이기(고른, { 최신, 서버, 키 }) {
  if (!고른 || 고른.평소 || !Number.isFinite(고른.숫자.조회)) return 고른;
  const 기준 = 고른.출처 === '게시 성과 장부'
    ? ((최신 ? 장부평소(최신, 키.키, 고른) : null) || (고른.시점 === '7d' && 서버 ? 서버평소(서버, 키, 시간표['7d']) : null))
    : 고른.출처 === '회사 서버 하루 숫자' ? (서버 ? 서버평소(서버, 키, 시간표[고른.시점]) : null) : null;
  if (!기준 || !(기준.중앙 > 0)) return 고른;
  return { ...고른, 평소: { ...기준, 배수: Math.round((고른.숫자.조회 / 기준.중앙) * 100) / 100 } };
}

/** 서버 · 손 입력 숫자에 장부의 시청 유지 칸을 더한다(출처 시점을 붙여 — 「앞 3초 유지(72시간)」) */
function 유지더하기(고른, 장부고른) {
  if (!고른 || !장부고른) return 고른;
  const 숫자 = { ...고른.숫자 }, 칸출처 = { ...고른.칸출처 };
  for (const k of 유지칸) if (!Number.isFinite(숫자[k]) && Number.isFinite(장부고른.숫자[k])) { 숫자[k] = 장부고른.숫자[k]; 칸출처[k] = 장부고른.칸출처[k]; }
  return { ...고른, 숫자, 칸출처, 위치: 고른.위치 || null };
}

module.exports = {
  게시키, 칸표시, 장부고르기, 장부평소, 서버고르기, 서버평소, 나이숫자, 손입력고르기, 유튜브지금고르기, 평소붙이기, 유지더하기, 중앙값, 시간표,
  시점들, 장부시점이름, 플랫폼이름, 숫자칸, 유지칸, 단위, 평소최소편수, 위치글,
};
