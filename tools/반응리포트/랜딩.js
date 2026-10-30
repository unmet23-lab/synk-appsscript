'use strict';
/**
 * 광고 반응 리포트 · 랜딩 — Microsoft Clarity Data Export API의 하루 장부를 읽어 리포트 기간의 랜딩 숫자로 합친다(2026-10-30).
 *
 * API(공식 문서): GET https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=1|2|3&dimension1..3
 *   지난 1~3일만(부른 시각 기준 24 · 48 · 72시간) · 프로젝트마다 하루 10번 · 1,000줄 · 차원 셋까지. 히트맵 · 녹화 · 칸별 도달은 없다.
 *   그래서 하루 한 번 numOfDays=1로 받아 git 밖 장부에 덧붙이고(받기), 리포트 기간의 날을 겹치지 않게 골라 더한다(기간합치기).
 * 응답 꼴: [{metricName, information: [{…차원, …값}]}] — 값이 글(「9554」)로 올 수 있고, 칸 이름이 문서와 실제 사용 코드에서
 *   철자가 조금 다르다(distantUserCount/distinctUserCount 등) — 후보 이름을 대소문자 무시로 차례로 읽는다. 첫 실제 응답으로 시험 견본을 고정한다.
 * 평균 스크롤은 숫자 하나라, 칸 지도(칸지도.mjs가 잰 칸 위치)에 얹어 「평균이 닿는 칸」으로 바꾼다 — 「대부분이 여기서 멈췄다」가 아니다.
 * 토큰은 ~/SYNK_보안/clarity_<프로젝트>.txt(클로드 키와 같은 자리) — 출력 · 기록하지 않는다. 순수 함수 + 받기(네트워크) 하나.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';
const 하루 = 24 * 60 * 60 * 1000;
const 받을차원 = Object.freeze([['URL'], ['URL', 'Device'], ['URL', 'Source', 'Campaign']]);

const 차원후보 = Object.freeze({
  URL: ['Url', 'URL', 'url'], Device: ['Device', 'device'], Source: ['Source', 'source'], Medium: ['Medium', 'medium'],
  Campaign: ['Campaign', 'campaign'], Channel: ['Channel', 'channel'], OS: ['OS', 'os'], Browser: ['Browser', 'browser'], Country: ['Country/Region', 'Country', 'country'],
});
// 지표 블록마다 읽을 값 — [리포트 이름, 후보 칸 이름…]
const 값후보 = Object.freeze({
  Traffic: [['세션', 'totalSessionCount'], ['봇세션', 'totalBotSessionCount'], ['사람', 'distinctUserCount', 'distantUserCount'], ['세션당쪽수', 'pagesPerSessionPercentage', 'PagesPerSessionPercentage']],
  ScrollDepth: [['평균스크롤', 'averageScrollDepth']],
  EngagementTime: [['전체시간', 'totalTime'], ['참여시간', 'activeTime']],
  신호: [['세션수', 'sessionsCount'], ['횟수', 'subTotal'], ['쪽보기', 'pagesViews'], ['걸린비율', 'sessionsWithMetricPercentage']],
});
const 신호들 = Object.freeze({ DeadClickCount: '헛클릭', RageClickCount: '분노클릭', QuickbackClick: '되돌아감', ExcessiveScroll: '지나친스크롤', ScriptErrorCount: '스크립트오류', ErrorClickCount: '오류클릭' });

function 글수(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim()) { const n = Number(v.replace('%', '').trim()); return Number.isFinite(n) ? n : null; }
  return null;
}

function 칸찾기(정보, 후보들) {
  const 낮춤 = new Map(Object.keys(정보 || {}).map((k) => [k.toLowerCase(), k]));
  for (const 후보 of 후보들) { const k = 낮춤.get(후보.toLowerCase()); if (k !== undefined) return 정보[k]; }
  return undefined;
}

/** 응답 → [{지표, 차원{…}, 값{…}}] — 모르는 칸은 읽지 않을 뿐 장부에는 응답이 원본째 남아 있어, 칸 이름을 고치면 다시 읽힌다 */
function 응답읽기(응답) {
  const 줄 = [];
  for (const 블록 of Array.isArray(응답) ? 응답 : []) {
    const 지표 = String(블록?.metricName || '');
    if (!지표 || !Array.isArray(블록.information)) continue;
    const 후보 = 값후보[지표] || (신호들[지표] ? 값후보.신호 : null);
    for (const 정보 of 블록.information) {
      const 차원 = {};
      for (const [이름, 후보들] of Object.entries(차원후보)) { const v = 칸찾기(정보, 후보들); if (typeof v === 'string' && v.trim()) 차원[이름] = v.trim(); }
      const 값 = {};
      for (const [이름, ...후보들] of 후보 || []) { const v = 글수(칸찾기(정보, 후보들)); if (v !== null) 값[이름] = v; }
      줄.push({ 지표, 차원, 값 });
    }
  }
  return 줄;
}

/** 주소 → 집 + 길(질의 · 조각 · 끝 / · 대소문자 뺌) */
function 주소다듬기(s) {
  try { const u = new URL(String(s)); return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase(); } catch { return String(s || '').replace(/[?#].*$/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '').toLowerCase(); }
}

/** 주소가 랜딩인가 — 다듬은 앞이 같으면(아래 쪽도 든다) */
function 랜딩인가(주소, 랜딩) {
  const a = 주소다듬기(주소), b = 주소다듬기(랜딩);
  return Boolean(b) && (a === b || a.startsWith(`${b}/`));
}

/**
 * 장부 줄들([{받은때, 차원: 'URL'|'URL,Device'|…, 창시간, 응답}]) 가운데 리포트 기간 [시작, 끝)에 든 것을 차원마다 겹치지 않게 고른다.
 * 한 줄은 (받은때 − 창시간, 받은때]를 덮는다. 앞 줄과 1시간 넘게 겹치면 건너뛰고, 기간 밖으로 반 넘게 나간 줄은 뺀다.
 * → {차원: {줄들, 덮은시간, 빈시간, 겹쳐뺀수}}
 */
function 기간고르기(장부, 시작, 끝) {
  const t0 = Date.parse(시작), t1 = Date.parse(끝);
  const 묶음 = {};
  for (const 줄 of [...장부].sort((a, b) => Date.parse(a.받은때) - Date.parse(b.받은때))) {
    const 받은 = Date.parse(줄.받은때);
    const 창 = (Number(줄.창시간) || 24) * 3600000;
    if (!Number.isFinite(받은)) continue;
    const 안 = Math.min(받은, t1) - Math.max(받은 - 창, t0);
    if (안 < 창 / 2) continue;
    const g = (묶음[줄.차원] ||= { 줄들: [], 덮은시간: 0, 빈시간: 0, 겹쳐뺀수: 0, 끝: -Infinity });
    if (받은 - 창 < g.끝 - 3600000) { g.겹쳐뺀수 += 1; continue; }
    g.줄들.push(줄);
    g.덮은시간 += Math.max(0, Math.min(받은, t1) - Math.max(받은 - 창, t0, g.끝)) / 3600000;
    g.끝 = 받은;
  }
  for (const g of Object.values(묶음)) { g.빈시간 = Math.max(0, Math.round((t1 - t0) / 3600000 - g.덮은시간)); g.덮은시간 = Math.round(g.덮은시간); delete g.끝; }
  return 묶음;
}

/** 고른 줄들의 랜딩 행을 더한다 — 세션은 합, 스크롤 · 시간 · 비율은 세션 가중 평균. 나눔(차원 이름, 예: 'Device')을 주면 그 값마다 따로 */
function 행합치기(줄들, 랜딩, 나눔 = null) {
  const 칸 = new Map();
  const 칸얻기 = (k) => { if (!칸.has(k)) 칸.set(k, { 세션: 0, 봇세션: 0, 쪽세션: 0, 쪽합: 0, 스세션: 0, 스합: 0, 시세션: 0, 참여합: 0, 전체합: 0, 신호: {} }); return 칸.get(k); };
  for (const 줄 of 줄들) {
    const 행들 = 응답읽기(줄.응답).filter((r) => r.차원.URL && 랜딩인가(r.차원.URL, 랜딩));
    // 같은 날 · 같은 칸의 Traffic 세션 수를 가중치로 쓴다(ScrollDepth · EngagementTime 블록에는 세션 수가 없다).
    // 먼저 같은 주소 글자 그대로의 행, 없으면 다듬은 주소가 같은 행들의 합
    const 무게 = new Map(), 다듬은무게 = new Map();
    const 나눈값 = (r) => (나눔 ? r.차원[나눔] || '(모름)' : '');
    const 열쇠 = (r) => `${r.차원.URL}|${나눈값(r)}`, 다듬은열쇠 = (r) => `${주소다듬기(r.차원.URL)}|${나눈값(r)}`;
    for (const r of 행들.filter((x) => x.지표 === 'Traffic')) {
      무게.set(열쇠(r), (무게.get(열쇠(r)) || 0) + (r.값.세션 || 0));
      다듬은무게.set(다듬은열쇠(r), (다듬은무게.get(다듬은열쇠(r)) || 0) + (r.값.세션 || 0));
    }
    for (const r of 행들) {
      const c = 칸얻기(나눔 ? 나눈값(r) : '전체');
      const w = 무게.get(열쇠(r)) ?? 다듬은무게.get(다듬은열쇠(r)) ?? 0;
      if (r.지표 === 'Traffic') {
        c.세션 += r.값.세션 || 0; c.봇세션 += r.값.봇세션 || 0;
        if (Number.isFinite(r.값.세션당쪽수) && r.값.세션) { c.쪽세션 += r.값.세션; c.쪽합 += r.값.세션당쪽수 * r.값.세션; }
      } else if (r.지표 === 'ScrollDepth' && Number.isFinite(r.값.평균스크롤) && w) { c.스세션 += w; c.스합 += r.값.평균스크롤 * w; }
      else if (r.지표 === 'EngagementTime' && w) {
        if (Number.isFinite(r.값.참여시간)) { c.시세션 += w; c.참여합 += r.값.참여시간 * w; c.전체합 += (r.값.전체시간 ?? r.값.참여시간) * w; }
      } else if (신호들[r.지표]) {
        const s = (c.신호[신호들[r.지표]] ||= { 횟수: 0, 걸린세션: 0, 세션: 0 });
        s.횟수 += r.값.횟수 || 0;
        if (Number.isFinite(r.값.걸린비율) && w) { s.걸린세션 += (r.값.걸린비율 / 100) * w; s.세션 += w; }
      }
    }
  }
  const 결과 = {};
  for (const [k, c] of 칸) {
    const 신호 = {};
    for (const [이름, s] of Object.entries(c.신호)) 신호[이름] = { 횟수: s.횟수, 걸린비율: s.세션 ? Math.round((s.걸린세션 / s.세션) * 1000) / 10 : null };
    결과[k] = {
      세션: c.세션, 봇세션: c.봇세션,
      세션당쪽수: c.쪽세션 ? Math.round((c.쪽합 / c.쪽세션) * 100) / 100 : null,
      평균스크롤: c.스세션 ? Math.round((c.스합 / c.스세션) * 10) / 10 : null,
      참여시간: c.시세션 ? Math.round(c.참여합 / c.시세션) : null,
      전체시간: c.시세션 ? Math.round(c.전체합 / c.시세션) : null,
      신호,
    };
  }
  return 결과;
}

/** 칸 지도({폭, 쪽높이, 칸[{id, 이름, 위, 아래}]} — 위 · 아래는 쪽 높이의 %)에 평균 스크롤 %를 얹는다 → {id, 이름, 칸안: 앞|가운데|끝} */
function 칸얹기(지도, 깊이) {
  if (!지도?.칸?.length || !Number.isFinite(깊이)) return null;
  const d = Math.max(0, Math.min(100, 깊이));
  const 칸 = 지도.칸.find((c) => d >= c.위 && d < c.아래) || (d >= 지도.칸[지도.칸.length - 1].아래 ? { id: '_끝', 이름: '맨 아래(꼬리말)', 위: 지도.칸[지도.칸.length - 1].아래, 아래: 100 } : 지도.칸[0]);
  const 비 = 칸.아래 > 칸.위 ? (d - 칸.위) / (칸.아래 - 칸.위) : 0;
  return { id: 칸.id, 이름: 칸.이름, 칸안: 비 < 1 / 3 ? '앞부분' : 비 < 2 / 3 ? '가운데' : '끝부분' };
}

/** 기기 이름(Clarity Device 값) → 칸 지도 폭 */
function 기기지도(지도들, 기기) {
  const 폰 = /mobile|phone|tablet/i.test(String(기기 || ''));
  return (지도들 || []).find((m) => (폰 ? m.폭 < 768 : m.폭 >= 768)) || null;
}

/**
 * 리포트 기간의 랜딩 결과 — {상태, 까닭?, 기간{시작, 끝, 일수}, 덮음{덮은시간, 빈시간, 받은날수, 겹쳐뺀수}, 전체, 기기{}, 캠페인{}, 지도[]}
 * 장부가 비었거나 기간에 든 날이 없으면 「못 읽음」 꼴로 까닭을 돌려준다.
 */
function 랜딩모으기({ 장부, 랜딩, 시작, 끝, 지도들 = [], 캠페인낱말 = [] }) {
  if (!랜딩?.주소) return { 상태: '설정 없음', 까닭: '캠페인 설정에 랜딩 주소가 없다' };
  if (!장부?.length) return { 상태: '측정 전', 까닭: '이 랜딩의 Clarity 하루 장부가 아직 없다(측정 코드 설치 · 하루 받기 전)' };
  const 고른 = 기간고르기(장부, 시작, 끝);
  const 기본 = 고른.URL;
  if (!기본?.줄들.length) return { 상태: '측정 전', 까닭: '리포트 기간에 든 하루 장부가 없다' };
  const 전체 = 행합치기(기본.줄들, 랜딩.주소).전체 || null;
  if (!전체?.세션) return { 상태: '방문 없음', 까닭: '기간 안 이 랜딩 세션이 0이다', 덮음: 덮음꼴(기본) };
  const 기기 = 고른['URL,Device']?.줄들.length ? 행합치기(고른['URL,Device'].줄들, 랜딩.주소, 'Device') : {};
  const 출처 = 고른['URL,Source,Campaign']?.줄들.length ? 행합치기(고른['URL,Source,Campaign'].줄들, 랜딩.주소, 'Campaign') : {};
  const 캠페인 = {};
  for (const [이름, r] of Object.entries(출처)) if (!캠페인낱말.length || 캠페인낱말.some((w) => 이름.includes(w))) 캠페인[이름] = r;
  const 기기칸 = {};
  for (const [이름, r] of Object.entries(기기)) { const m = 기기지도(지도들, 이름); 기기칸[이름] = { ...r, 평균칸: m ? 칸얹기(m, r.평균스크롤) : null }; }
  return {
    상태: '됨', 기간: { 시작, 끝, 일수: Math.round((Date.parse(끝) - Date.parse(시작)) / 하루) }, 덮음: 덮음꼴(기본),
    전체, 기기: 기기칸, 캠페인, 지도: 지도들.map((m) => ({ 폭: m.폭, 쪽높이: m.쪽높이, 잰날: m.잰날, 칸: m.칸 })),
  };
}

function 덮음꼴(g) {
  return { 덮은시간: g.덮은시간, 빈시간: g.빈시간, 받은날수: g.줄들.length, 겹쳐뺀수: g.겹쳐뺀수 };
}

// ── 받기(네트워크) ─────────────────────────────────────────────────
const 열쇠자리 = (프로젝트) => path.join(os.homedir(), 'SYNK_보안', `clarity_${String(프로젝트).replace(/[^\w-]/g, '')}.txt`);

function 열쇠읽기(프로젝트) {
  try { const t = fs.readFileSync(열쇠자리(프로젝트), 'utf8').trim(); return t || null; } catch { return null; }
}

/** 하루치를 받는다 — 차원 묶음마다 한 번(하루 10번 가운데 받을차원 수만큼). 429 · 401은 그 자리에서 멈춘다 */
async function 하루받기({ 프로젝트, 토큰 = 열쇠읽기(프로젝트), fetch기 = (...a) => fetch(...a), 지금 = () => new Date() }) {
  if (!토큰) return { 상태: '열쇠 없음', 까닭: `Clarity 토큰이 없다(${열쇠자리(프로젝트).replace(os.homedir(), '~')})`, 줄들: [] };
  const 줄들 = [];
  for (const 차원 of 받을차원) {
    const q = new URLSearchParams({ numOfDays: '1' });
    차원.forEach((d, i) => q.set(`dimension${i + 1}`, d));
    const 받은때 = 지금().toISOString();
    let res, 몸 = null;
    try {
      res = await fetch기(`${API}?${q}`, { headers: { authorization: `Bearer ${토큰}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60000) });
      몸 = await res.json().catch(() => null);
    } catch (e) { return { 상태: '실패', 까닭: String(e?.cause?.code || e?.name || e?.message || e).slice(0, 120), 줄들 }; }
    if (!res.ok) return { 상태: res.status === 429 ? '오늘 몫 끝' : '실패', 까닭: `HTTP ${res.status}`, 줄들 };
    줄들.push({ 받은때, 프로젝트, 차원: 차원.join(','), 창시간: 24, 응답: 몸 });
  }
  return { 상태: '됨', 줄들 };
}

module.exports = { API, 받을차원, 응답읽기, 주소다듬기, 랜딩인가, 기간고르기, 행합치기, 칸얹기, 기기지도, 랜딩모으기, 하루받기, 열쇠자리, 열쇠읽기, 글수, 신호들 };
