'use strict';
/**
 * 게시성과시험 — 「2주 시험」 판정(시청자수요조사 6-5·6-9, 2026-10-23, AI 없음). tools/게시성과.js의 요약이 쓴다.
 *
 * 같은 계정·형식 이전 4편부터 가르는 기존 판정(lib/게시성과판정.js, 서버 publication-learning과 같은 규칙)은 그대로 두고,
 * 작은 계정·새 형식에서도 첫 편부터 닿는 기준으로 빨리 판단하는 표를 그 옆에 하나 더 낸다.
 * 숫자는 장부(docs/_ops/게시성과.jsonl)의 판정 줄·화면 줄만 쓴다 — 서버를 읽지 않는 --요약에서도 같은 표가 나온다.
 *
 * ── 지금 규칙(한곳에) ─────────────────────────────────────────────────────────
 * 대상     편 폴더 게시/준비.json에 "시험": {"이름": "2주 시험 10-26", "갈래": "A 장치형"}이 있는 편.
 * 셀 판    그 편 준비.json 판[].계정 → sns-계정.json의 플랫폼·핸들. 서버가 받는 유튜브·인스타·틱톡·페북만 센다(네이버 블로그 같은 판은
 *          「안 셈」으로 적는다). 계정표에 없는 키는 「계정 키 확인」 — 그 편이 든 갈래는 정하지 않는다(아직).
 *          준비.json에 없는 판의 장부 줄은 표에만. 판 목록이 없는 옛 준비.json은 장부 줄을 그대로 판으로 쓴다.
 * 편의 때  첫 실제 게시(장부 줄 · 게시결과.json 「게시됨」), 없으면 예정(셀 판 시각 → 슬롯 → 날짜, 날짜는 그날 끝 KST).
 *          창(기준.창)과 게시 순은 이 때로 잰다.
 * 편 판정  판마다. 72시간 전 「아직」, 72시간 값 기다림(측정 창 6시간)도 「아직」, 그 뒤 값이 없으면 영구 「자료 부족」.
 *          조회: 기존 판정이 비교에 쓴 72시간 값(측정 창 안 관측 · invalidMetrics에 없음)의 「평소 대비」가 기준.배수 이상.
 *          인스타는 3초 유지율(24시간 → 72시간 → 24시간 뒤 읽은 화면 값)도 기준.삼초유지 이상. 하나라도 못 넘으면 「못 넘음」.
 *          장부 줄이 없는 셀 판은 그 판의 때(게시 → 예정 시각 → 같은 편 첫 실제 게시 → 슬롯·날짜) + 78시간까지 「아직」, 그 뒤 영구 자료 부족.
 * 본 비율  유튜브만. 72시간 뒤에 읽은 화면 값을 지난 편들(같은 계정·형식, 읽은 값이 있는 가까운 12편) 중앙값과 견준다.
 *          72시간 전 · 안 읽음 · 72시간 전에 읽음은 「아직」(다시 읽기). 장부에 앞선 같은 계정·형식 편이 하나도 없는 첫 편은
 *          끝내 견줄 수 없어 판정에서 빼고 표에만 적는다.
 * 갈래     같은 시험·계정(채널 핸들 — @synkbrief의 인스타·유튜브는 한 계정, 페북 교차 게시는 따로)·갈래.
 *          실제로 올린 편(게시 순) 다음 예정 편(예정 순)으로 줄 세워 앞 기준.편수 편만 센다 — 넷째 편부터는 표에만(값을 보고 편을 더해
 *          판정을 돌리지 않게). 올린 편이 기준.편수보다 적으면 「아직(3편 미만)」 — 예정 편은 기다림일 뿐이다(6-5 「3편이 쌓인 뒤」).
 *          곳마다(플랫폼, 유튜브 하나인 계정은 조회·본 비율) 그 곳을 준비.json에 잡은 편으로 센다.
 * 일찍 정하기  곳마다 남은 판이 어떻게 나와도 안 바뀔 때만 — 넘음 ≥ 기준.넘을편수면 「계속」, 넘음 + 기다림 < 기준.넘을편수면 「멈춤」
 *          (재진 판이 기준.넘을편수 이상일 때만, 아니면 「자료 부족」). 그 밖에는 「아직」.
 * 영구 자료 부족  끝내 안 오는 값(72시간 값 없음 · 측정 창 밖 · 기존 판정이 뺌 · 조회 못 받음 · 평소 대비 못 잼 · 안 올린 판의 창이 닫힘)은
 *          기다리지 않고 넘지 못한 것으로 친다. 화면 값으로 채울 수 있는 것(3초 유지율 없음 · 견줄 지난 편 없음)은 기다린다.
 * 방향     두 곳이 같은 방향일 때만 계속·멈춤, 다르면 「엇갈림」(6-5 「같은 방향일 때만」). 목표(우리 최고 편)는 보이기만 한다.
 */
const 판정 = require('./게시성과판정.js');
const 배수 = require('./평소배수.js');

const H = 3_600_000;
/** 서버 체크포인트 측정 창 — 목표 시각부터 6시간(게시성과판정 checkpointPoint와 같다). 그 안에 값이 없으면 기다리고, 지나면 자료 부족 */
const 측정창 = 6 * H;
const WAIT_72H = 72 * H + 측정창;
const PLATFORM_ORDER = ['youtube', 'instagram', 'tiktok', 'facebook'];
/** 서버가 게시 성과를 받는 플랫폼 — 준비.json의 그 밖 판(네이버 블로그·티스토리 …)은 세지 않는다 */
const TRACKED = new Set(PLATFORM_ORDER);

/**
 * 2주 시험 기준 — 가설 — 첫 주 숫자로 다시 정한다(시청자수요조사 6-9).
 * 우리 기록(3초 유지 14~43% · 계정 중앙값)에서 닿을 수 있는 값으로 잡았다. 목표(우리 최고 편, 6-5 기준선)는 표에 보이기만 하고 판정에 쓰지 않는다.
 */
const 기준 = Object.freeze({
  배수: 2,            // 72시간 조회가 평소의 이 배수 이상이면 조회 기준을 넘는다
  삼초유지: 30,        // 인스타 3초 유지율(%)이 이 값 이상
  편수: 3,            // 갈래를 판단하는 편 수 — 실제로 올린 편이 이만큼 쌓여야 정하고, 넷째 편부터는 세지 않는다
  넘을편수: 2,         // 그 가운데 이만큼 넘으면 「계속」 · 멈춤도 재진 판이 이만큼은 있어야 낸다
  본비율이전최소: 1,    // 본 비율을 견줄 지난 편(같은 계정·형식, 화면에서 읽은 값)이 이만큼은 있어야 위·아래를 가른다
  /** 시험 이름 → 게시 날짜 창(KST, 양끝 포함). 편의 때가 창 밖이면 표에는 보이되 갈래에 세지 않는다. 없는 이름은 날짜를 가리지 않는다 */
  창: Object.freeze({ '2주 시험 10-26': Object.freeze({ 시작: '2026-10-26', 끝: '2026-11-07' }) }),
  /** 계정(핸들) → 우리 최고 편 */
  목표: Object.freeze({
    synkkorean: '관용구 퀴즈 #4(10-20) 유튜브 24시간 1,199회 · 평소의 4.8배',
    'synk.mn': '관용구 퀴즈 #4(10-20) 인스타 3초 유지 42.6%',
    yuhobuilds: '세션 공유(10-18) 인스타 3초 유지 41.7% · 평균 시청 11.6초 · 72시간 4,049회',
  }),
});

const 배글 = v => `${v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toFixed(1)}배`;
const kstDay = (date, end) => Date.parse(`${date}T${end ? '23:59:59.999' : '00:00:00.000'}+09:00`);
const 날짜끝 = d => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim()) ? kstDay(d.trim(), true) : null);
const 순서 = pl => (PLATFORM_ORDER.indexOf(pl) + 1 || PLATFORM_ORDER.length + 1);
const 때순 = (a, b) => (a ?? Infinity) - (b ?? Infinity) || 0;
const 최소 = list => { const v = list.filter(Number.isFinite); return v.length ? Math.min(...v) : null; };

/** 핸들(「@synk.mn」 · sns-계정.json의 「facebook.com/synkworld」) → 계정 열쇠(synk.mn · synkworld) */
function 핸들열쇠(handle) {
  const last = String(handle || '').trim().replace(/\/+$/, '').split('/').pop() || '';
  return last.replace(/^@/, '').toLowerCase();
}

/** 판정 줄의 채널 칸(「인스타 @synkbrief」) → 계정 {key: 'synkbrief', shown: '@synkbrief'} */
function 계정Of(channel) {
  const text = String(channel || '').trim();
  const shown = text.replace(/^\S+\s+/, '').trim() || text;
  return { key: 핸들열쇠(shown), shown };
}

/** 준비.json의 "시험" 칸 → {이름, 갈래} · 없으면 null · 모양이 틀리면 {오류} */
function 시험칸(prep) {
  if (!prep || typeof prep !== 'object' || prep.시험 === undefined || prep.시험 === null) return null;
  const t = prep.시험;
  if (typeof t !== 'object' || Array.isArray(t)) return { 오류: '"시험"은 {"이름": …, "갈래": …} 꼴이어야 한다' };
  const 이름 = typeof t.이름 === 'string' ? t.이름.trim() : '';
  const 갈래 = typeof t.갈래 === 'string' ? t.갈래.trim() : '';
  if (!이름 || !갈래) return { 오류: '"이름"과 "갈래"가 빈칸 아닌 글자여야 한다' };
  return { 이름, 갈래 };
}

/** 장부 → 게시물마다 시점별 가장 늦은 판정 줄 */
function 게시물들(ledger) {
  const out = new Map();
  const points = new Set(판정.POINTS.map(p => p.key));
  for (const l of ledger) {
    if (!l || l.kind !== '판정' || !l.post || !points.has(l.point)) continue;
    const p = out.get(l.post) || { post: l.post, points: {}, folder: null, account: null };
    p.points[l.point] = l;
    if (l.folder) p.folder = l.folder;
    if (l.account) p.account = l.account;
    for (const k of ['url', 'channel', 'platform', 'format', 'publishedAt']) if (l[k] !== undefined && l[k] !== null) p[k] = l[k];
    out.set(l.post, p);
  }
  const list = [];
  for (const p of out.values()) {
    p.publishedMs = Date.parse(p.publishedAt);
    if (!Number.isFinite(p.publishedMs)) continue;
    p.계정 = 계정Of(p.channel);
    list.push(p);
  }
  return list;
}

/** 장부 화면 줄 → post → metric → {value, ageHours} (칸마다 가장 늦은 읽기 — 읽은 때의 게시 나이를 칸마다 지킨다) */
function 화면읽기(ledger) {
  const out = new Map();
  for (const l of ledger.filter(l => l && l.kind === '화면' && l.post).sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const m = out.get(l.post) || new Map();
    for (const [k, v] of Object.entries(l.metrics || {})) m.set(k, { value: v, ageHours: typeof l.ageHours === 'number' ? l.ageHours : null });
    out.set(l.post, m);
  }
  return out;
}

/** 화면에서 읽은 값 하나 — 장부 화면 줄이 먼저, 없으면 넘겨받은 screens(게시성과.js screensOf 꼴) → {value, ageHours} 또는 null */
function 화면값(ctx, post, metric) {
  const r = ctx.읽기.get(post)?.get(metric);
  if (r && 판정.validValue(r.value, metric)) return r;
  const s = ctx.screens.get(post);
  const v = s?.metrics?.[metric];
  return 판정.validValue(v, metric) ? { value: v, ageHours: typeof s.ageHours === 'number' ? s.ageHours : null } : null;
}

/** 그 줄의 판정 글에 「(추정)」이 붙어 있나 — 장부 줄은 지표별 추정 여부를 글(판정.judgmentLine)로만 남긴다 */
function 추정인가(line, metric) {
  const v = line?.metrics?.[metric];
  return typeof line?.line === 'string' && 판정.validValue(v, metric)
    && line.line.includes(`${판정.METRICS[metric].label} ${판정.valueText(metric, v)}(추정)`);
}

/**
 * 그 줄의 그 지표를 판정에 쓸 수 있나 — 기존 판정이 비교에 쓴 값만 쓴다:
 * 서버 값(화면에서 읽은 값이 아님) · 줄의 관측이 목표 시각부터 측정 창 안 · 기존 판정이 비교에서 빼지 않음(장부 줄 invalidMetrics).
 * → {상태: '씀'|'화면'|'창 밖'|'못 씀'|'없음', v}
 */
function 쓸값(line, metric, hours, publishedMs) {
  const v = line?.metrics?.[metric];
  if (!판정.validValue(v, metric)) return { 상태: '없음', v: null };
  if ((line.screenMetrics || []).includes(metric)) return { 상태: '화면', v };
  const due = publishedMs + hours * H, obs = Date.parse(line.observedAt);
  if (!Number.isFinite(obs) || obs < due || obs > due + 측정창) return { 상태: '창 밖', v };
  if ((line.invalidMetrics || []).includes(metric)) return { 상태: '못 씀', v };
  return { 상태: '씀', v };
}

/** 인스타 3초 유지율 — 24시간 서버 값 → 72시간 서버 값(둘 다 쓸 수 있는 값만) → 게시 24시간 뒤에 읽은 화면 값 */
function 삼초유지Of(p, ctx) {
  const metric = 'earlyRetention3sPct';
  for (const [point, hours, 때] of [['24h', 24, '24시간'], ['72h', 72, '72시간']]) {
    const line = p.points[point];
    if (line && 쓸값(line, metric, hours, p.publishedMs).상태 === '씀') return { value: line.metrics[metric], 때, 추정: 추정인가(line, metric) };
  }
  const r = 화면값(ctx, p.post, metric);
  return r && ctx.now >= p.publishedMs + 24 * H && (r.ageHours === null || r.ageHours >= 24) ? { value: r.value, 때: '화면', 추정: false } : null;
}

/** 유튜브 본 비율(화면 값) — 머리 주석 「본 비율」 */
function 본비율Of(p, ctx) {
  const metric = 'stayedToWatchPct';
  const earlier = ctx.all.filter(q => q.post !== p.post && q.channel === p.channel && q.format === p.format && q.publishedMs < p.publishedMs);
  const reading = 화면값(ctx, p.post, metric);
  const value = reading ? reading.value : null;
  if (!earlier.length) return { value, 상태: '첫 편', 뺌: true, 영구: true };
  if (ctx.now < p.publishedMs + 72 * H) return { value, 상태: '72시간 전' };
  if (!reading) return { value: null, 상태: '화면 필요' };
  if (reading.ageHours !== null && reading.ageHours < 72) return { value, 상태: '72시간 뒤 다시 읽기' };
  const prev = earlier.sort((a, b) => b.publishedMs - a.publishedMs).map(q => 화면값(ctx, q.post, metric))
    .filter(r => r && (r.ageHours === null || r.ageHours >= 72)).slice(0, 배수.KEEP).map(r => r.value);
  if (prev.length < 기준.본비율이전최소) return { value, 상태: '견줄 지난 편 없음', n: prev.length, median: null };
  const median = 배수.median(prev);
  return { value, median, n: prev.length, 상태: value > median ? '위' : '아래' };
}

const 조회까닭 = { 없음: '72시간 조회 못 받음', 화면: '72시간 조회 못 받음(화면 값만)', '창 밖': '72시간 값이 측정 창 밖', '못 씀': '72시간 조회를 기존 판정이 비교에서 뺐다' };
/** 평소 대비를 못 잰 까닭 — 같은 나이로 견줄 앞선 편이 모자라면 그 수(게시성과판정 multipleOf — 앞선 편은 늘지 않아 끝내 못 잰다) */
const 못잼까닭 = m => (m?.basis === 판정.SAME_AGE && m.n < 판정.MULTIPLE_MIN ? `평소 대비 못 잼 — 같은 나이로 견줄 앞선 편 ${m.n}편` : '평소 대비 못 잼');

/** 장부 줄이 있는 판 하나 → 판정(머리 주석 「편 판정」). 영구: 끝내 안 오는 자료 부족 */
function 판결과(p, 시험, ctx) {
  const l72 = p.points['72h'] || null;
  const 조회 = l72 ? 쓸값(l72, 'views', 72, p.publishedMs) : { 상태: '없음', v: null };
  const multiple = 조회.상태 === '씀' && l72.multiple && typeof l72.multiple.value === 'number' && Number.isFinite(l72.multiple.value) ? l72.multiple : null;
  const 삼초 = p.platform === 'instagram' ? 삼초유지Of(p, ctx) : null;
  const 본비율 = p.platform === 'youtube' ? 본비율Of(p, ctx) : null;
  const 조회넘음 = multiple ? multiple.value >= 기준.배수 : null;
  const 삼초넘음 = p.platform !== 'instagram' ? true : 삼초 ? 삼초.value >= 기준.삼초유지 : null;
  let 값 = '기준 넘음', 까닭 = null, 영구 = false;
  if (!l72 && ctx.now < p.publishedMs + 72 * H) [값, 까닭] = ['아직', '72시간 전'];
  else if (!l72 && ctx.now < p.publishedMs + WAIT_72H) [값, 까닭] = ['아직', '72시간 값 기다림'];
  else if (조회넘음 === false) [값, 까닭] = ['못 넘음', `조회 ${배글(multiple.value)}`];
  else if (삼초넘음 === false) [값, 까닭] = ['못 넘음', `3초 유지 ${판정.valueText('earlyRetention3sPct', 삼초.value)}`];
  else if (조회넘음 === null) [값, 까닭, 영구] = ['자료 부족', !l72 ? '72시간 값 없음' : 조회까닭[조회.상태] || 못잼까닭(l72.multiple), true];
  else if (삼초넘음 === null) [값, 까닭] = ['자료 부족', '3초 유지율 없음'];
  return {
    post: p.post, url: p.url, folder: p.folder, channel: p.channel, platform: p.platform, format: p.format, account: p.account || null,
    publishedAt: p.publishedAt, publishedMs: p.publishedMs, 계정: p.계정, 시험, 올림: true,
    조회: { 값: 조회.v, 상태: 조회.상태 }, multiple, 삼초, 본비율, 판정: 값, 까닭, 영구,
  };
}

/**
 * 편 하나의 셀 판(머리 주석 「셀 판」). 장부 줄은 계정이 같으면, 아니면 플랫폼·핸들이 같으면 그 판에 잇는다.
 * → {기대[{account, platform, 계정, post}], 따로[장부 게시물], 키확인[{key, 까닭}], 안셈[플랫폼]}
 */
function 편판들(folder, info, posts, 계정표) {
  const mine = posts.filter(p => p.folder === folder).sort((a, b) => a.publishedMs - b.publishedMs);
  const keys = [...new Set((Array.isArray(info?.prep?.판) ? info.prep.판 : []).map(p => (p && typeof p.계정 === 'string' ? p.계정.trim() : '')).filter(Boolean))];
  if (!keys.length) {
    return { 기대: mine.filter(p => TRACKED.has(p.platform)).map(p => ({ account: p.account, platform: p.platform, 계정: p.계정, post: p })), 따로: [], 키확인: [], 안셈: [] };
  }
  const used = new Set();
  const 기대 = [], 키확인 = [], 안셈 = [];
  for (const key of keys) {
    const acc = 계정표.get(key);
    const byAccount = mine.find(p => !used.has(p.post) && p.account === key) || null;
    const platform = acc?.platform || byAccount?.platform || null;
    if (!platform) { 키확인.push({ key, 까닭: 'sns-계정.json에 없는 계정 키' }); continue; }
    if (!TRACKED.has(platform)) { 안셈.push(platform); continue; }
    const 계정 = acc?.handle ? { key: 핸들열쇠(acc.handle), shown: `@${핸들열쇠(acc.handle)}` } : byAccount?.계정 || null;
    if (!계정 || !계정.key) { 키확인.push({ key, 까닭: 'sns-계정.json에 핸들이 없다' }); continue; }
    const post = byAccount || mine.find(p => !used.has(p.post) && p.platform === platform && p.계정.key === 계정.key) || null;
    if (post) used.add(post.post);
    기대.push({ account: key, platform, 계정, post });
  }
  return { 기대, 따로: mine.filter(p => !used.has(p.post) && TRACKED.has(p.platform)), 키확인, 안셈 };
}

/** 그 계정 판의 시각들 — 게시결과.json 「게시됨」(올림) · 준비.json 판 시각(예정) */
const 판시각들 = (list, account, ok) => (Array.isArray(list) ? list : []).filter(p => p && p.계정 === account && ok(p)).map(p => Date.parse(p.시각)).filter(Number.isFinite);

/** 장부 줄이 없는 셀 판의 때 — 게시 → 예정 시각 → 같은 편 첫 실제 게시 → 슬롯·날짜(그날 끝). 대신 쓴 때는 근거를 단다 */
function 판때(e, info, 편첫실제) {
  const posted = 최소(판시각들(info?.result?.판, e.account, p => p.상태 === '게시됨'));
  if (posted !== null) return { ms: posted, 올림: true };
  const planned = 최소(판시각들(info?.prep?.판, e.account, () => true));
  if (planned !== null) return { ms: planned, 올림: false };
  if (편첫실제 !== null) return { ms: 편첫실제, 올림: false, 근거: '같은 편 첫 게시' };
  const 슬롯 = 날짜끝(info?.prep?.슬롯) ?? 날짜끝(info?.prep?.날짜);
  return 슬롯 !== null ? { ms: 슬롯, 올림: false, 근거: '슬롯' } : null;
}

/** 장부 줄이 없는 셀 판 — 그 판의 때 + 78시간까지는 아직(올리기 전 · 판정 줄 기다림), 그 뒤에는 값이 끝내 안 온 자료 부족 */
function 빈판결과(e, 때, 시험, folder, ctx) {
  let 값 = '아직', 까닭 = 때?.올림 ? '판정 줄 기다림' : '올리기 전', 영구 = false;
  if (때 && ctx.now >= 때.ms + WAIT_72H) [값, 까닭, 영구] = ['자료 부족', 때.올림 ? '판정 줄 없음 — 서버 등록을 본다' : '올린 기록 없음', true];
  const 보일때 = 때 && !때.근거 ? new Date(때.ms).toISOString() : null; // 대신 쓴 때(같은 편 첫 게시·슬롯)는 표에 그 판의 시각으로 적지 않는다
  return {
    post: null, 빈판: true, url: null, folder, channel: `${판정.PLATFORM_LABEL[e.platform] || e.platform} ${e.계정.shown}`, platform: e.platform, format: null,
    account: e.account, publishedAt: 보일때, publishedMs: 때 ? 때.ms : null, 예정: !!때 && !때.올림, 계정: e.계정, 시험, 올림: !!때?.올림,
    조회: { 값: null, 상태: '없음' }, multiple: null, 삼초: null, 본비율: e.platform === 'youtube' ? { value: null, 상태: '판정 줄 없음' } : null, 판정: 값, 까닭, 영구,
  };
}

/** 본 비율을 셈에 넣을 결과로 — 판이 아직 없으면 그 판을 따르고, 첫 편은 뺀다(뺌) */
function 본비율결과(x) {
  if (x.빈판) return { 판정: x.판정, 까닭: x.까닭, 영구: x.영구 };
  const b = x.본비율;
  if (b?.뺌) return { 뺌: true };
  if (b?.상태 === '위') return { 판정: '기준 넘음' };
  if (b?.상태 === '아래') return { 판정: '못 넘음' };
  if (b?.상태 === '견줄 지난 편 없음') return { 판정: '자료 부족', 까닭: b.상태 }; // 지난 편 값을 화면에서 읽으면 정해진다(기다린다)
  return { 판정: '아직', 까닭: b?.상태 || '화면 필요' };
}

/** 한 곳의 셈(머리 주석 「일찍 정하기」). 결과: 갈래에서 세는 편 가운데 그 곳을 준비.json에 잡은 편마다 하나 */
function 셈(이름, 결과) {
  const d = { 이름, n: 결과.length, 넘음: 0, 못넘음: 0, 아직: 0, 부족: 0, 기다림: 0, 아직까닭: {} };
  for (const r of 결과) {
    if (r.판정 === '기준 넘음') d.넘음 += 1;
    else if (r.판정 === '못 넘음') d.못넘음 += 1;
    else {
      if (r.판정 === '아직') d.아직 += 1; else d.부족 += 1;
      if (r.판정 === '아직' || !r.영구) {
        d.기다림 += 1;
        const k = r.까닭 || r.판정;
        d.아직까닭[k] = (d.아직까닭[k] || 0) + 1;
      }
    }
  }
  if (d.넘음 >= 기준.넘을편수) d.상태 = '계속';
  else if (d.넘음 + d.기다림 < 기준.넘을편수) d.상태 = d.넘음 + d.못넘음 >= 기준.넘을편수 ? '멈춤' : '자료 부족';
  else d.상태 = '아직';
  return d;
}

/** 판들 → 갈래(머리 주석 「갈래」). 창 밖 편·따로 판은 세지 않고, 넷째 편부터는 x.표만으로 표에만 보인다 */
function 갈래묶기(판들, 편때, 편키확인) {
  const groups = new Map();
  for (const x of 판들) {
    if (x.창밖 || x.따로) continue;
    const key = [x.시험.이름, x.계정.key, x.시험.갈래].join('\u0000');
    if (!groups.has(key)) groups.set(key, { 시험: x.시험.이름, 갈래: x.시험.갈래, 계정: x.계정, 판들: [] });
    groups.get(key).판들.push(x);
  }
  const out = [];
  for (const g of groups.values()) {
    const folders = [...new Set(g.판들.map(x => x.folder))];
    const 때 = f => 편때.get(f)?.ms ?? null;
    const byTime = (a, b) => 때순(때(a), 때(b)) || a.localeCompare(b);
    // 그 갈래에서 실제로 올린 편(그 계정 판 가운데 하나라도 올렸다)이 먼저, 예정 편은 뒤에 — 앞 기준.편수 편만 센다
    const 올린 = folders.filter(f => g.판들.some(x => x.folder === f && x.올림)).sort(byTime);
    const 예정 = folders.filter(f => !올린.includes(f)).sort(byTime);
    const 줄 = [...올린, ...예정];
    const 센 = 줄.slice(0, 기준.편수), 표만 = 줄.slice(기준.편수);
    for (const x of g.판들) if (표만.includes(x.folder)) x.표만 = true;
    const 센판 = g.판들.filter(x => 센.includes(x.folder));
    const platforms = [...new Set(센판.map(x => x.platform))].sort((a, b) => 순서(a) - 순서(b) || a.localeCompare(b));
    // 편마다 그 플랫폼의 첫 판(다시 올린 판이 있어도 처음 것)
    const 첫판 = pl => 센.map(f => 센판.filter(x => x.folder === f && x.platform === pl).sort((a, b) => 때순(a.publishedMs, b.publishedMs))[0]).filter(Boolean);
    const 판결 = x => ({ 판정: x.판정, 까닭: x.까닭, 영구: x.영구 });
    const dims = platforms.length === 1 && platforms[0] === 'youtube'
      ? [셈('조회', 첫판('youtube').map(판결)), 셈('본 비율', 첫판('youtube').map(본비율결과).filter(r => !r.뺌))]
      : platforms.map(pl => 셈(판정.PLATFORM_LABEL[pl] || pl, 첫판(pl).map(판결)));
    const decided = dims.every(d => d.상태 === '계속' || d.상태 === '멈춤');
    const 방향 = dims.length < 2 ? '한 곳' : !decided ? '—' : new Set(dims.map(d => d.상태)).size === 1 ? '같음' : '엇갈림';
    const 아직글 = d => Object.entries(d.아직까닭).map(([k, c]) => `${k} ${c}`).join(' · ');
    const 키확인 = [...new Set(센.flatMap(f => 편키확인.get(f) || []))];
    let 결론;
    // 6-5 「형식 판단은 3편이 쌓인 뒤」 — 실제로 올린 편으로 센다(예정 편은 기다림일 뿐)
    if (올린.length < 기준.편수) 결론 = { 값: '아직', 까닭: `${올린.length}편${예정.length ? ` 게시(예정 ${예정.length}편)` : ''} — ${기준.편수}편 미만` };
    else if (dims.some(d => d.상태 === '아직')) 결론 = { 값: '아직', 까닭: dims.filter(d => d.상태 === '아직').map(d => `${d.이름} ${아직글(d)}`).join(' · ') };
    else if (dims.some(d => d.상태 === '자료 부족')) {
      결론 = { 값: '자료 부족', 까닭: dims.filter(d => d.상태 === '자료 부족').map(d => `${d.이름} 재진 판 ${d.넘음 + d.못넘음}/${d.n}`).join(' · ') };
    } else if (방향 === '엇갈림') 결론 = { 값: '엇갈림', 까닭: '두 곳이 다른 방향이라 판단하지 않는다' };
    else 결론 = { 값: dims[0].상태, 까닭: null };
    // 어느 판인지 모르는 계정 키가 있으면 그 갈래는 정하지 않는다 — 빠진 곳이 다른 방향일 수 있다
    if (키확인.length) {
      const 글 = `계정 키 확인 — ${키확인.join(', ')}`;
      결론 = ['계속', '멈춤', '엇갈림'].includes(결론.값) ? { 값: '아직', 까닭: 글 } : { 값: 결론.값, 까닭: [결론.까닭, 글].filter(Boolean).join(' · ') };
    }
    out.push({ 시험: g.시험, 갈래: g.갈래, 계정: g.계정, platforms, 편수: folders.length, 게시편수: 올린.length, 센편수: 센.length, 표만수: 표만.length,
      folders: 센, dims, 방향, 판정: 결론, 키확인, 목표: 기준.목표[g.계정.key] || null });
  }
  return out.sort((a, b) => a.시험.localeCompare(b.시험) || a.계정.shown.localeCompare(b.계정.shown) || a.갈래.localeCompare(b.갈래));
}

/**
 * 장부 → 2주 시험 판정
 *   ledger: 장부 줄들(판정 줄 · 화면 줄) · screens: Map(post → {metrics, ageHours}) — 장부에 화면 줄이 없을 때 쓰는 화면 값(게시성과.js screensOf 꼴)
 *   index: 편 색인(lib/게시성과편.js buildIndex — folders의 prep이 준비.json, result가 게시결과.json)
 *   accounts: sns-계정.json 계정들 [{key, platform, handle}] 또는 Map(key → 그것) · now
 * → { 판들[], 갈래들[], 판정없는편[{folder, 시험}](셀 판이 하나도 없는 시험 편), 칸오류[{folder, 오류}],
 *     키확인[{folder, key, 까닭}](계정표에서 못 찾은 판 계정 키), 안셈{플랫폼: 판 수}(서버가 받지 않아 세지 않은 판) }
 */
function 시험판정({ ledger = [], screens = new Map(), index = null, now = Date.now(), accounts = [] } = {}) {
  const 계정표 = accounts instanceof Map ? accounts : new Map((Array.isArray(accounts) ? accounts : []).filter(a => a && a.key).map(a => [a.key, a]));
  const 시험편 = new Map();
  const 칸오류 = [];
  for (const [folder, info] of index?.folders || new Map()) {
    const t = 시험칸(info?.prep);
    if (!t) continue;
    if (t.오류) 칸오류.push({ folder, 오류: t.오류 });
    else 시험편.set(folder, { 시험: t, info });
  }
  const all = 게시물들(ledger);
  const ctx = { all, screens: screens instanceof Map ? screens : new Map(), 읽기: 화면읽기(ledger), now };
  const 판들 = [], 키확인 = [], 안셈 = {};
  const 편때 = new Map(), 편키확인 = new Map();
  for (const [folder, { 시험, info }] of 시험편) {
    const r = 편판들(folder, info, all, 계정표);
    for (const k of r.키확인) 키확인.push({ folder, ...k });
    if (r.키확인.length) 편키확인.set(folder, r.키확인.map(k => k.key));
    for (const pl of r.안셈) 안셈[pl] = (안셈[pl] || 0) + 1;
    // 편의 때 — 첫 실제 게시(장부 줄 · 게시결과.json 「게시됨」), 없으면 예정(셀 판 시각 → 슬롯 → 날짜)
    const 편첫실제 = 최소([...r.기대.filter(e => e.post).map(e => e.post.publishedMs), ...r.따로.map(p => p.publishedMs),
      ...r.기대.filter(e => !e.post).flatMap(e => 판시각들(info?.result?.판, e.account, p => p.상태 === '게시됨'))]);
    const 편예정 = 최소(r.기대.flatMap(e => 판시각들(info?.prep?.판, e.account, () => true))) ?? 날짜끝(info?.prep?.슬롯) ?? 날짜끝(info?.prep?.날짜);
    편때.set(folder, { ms: 편첫실제 ?? 편예정 ?? null, 올림: 편첫실제 !== null });
    for (const e of r.기대) {
      판들.push(e.post ? { ...판결과(e.post, 시험, ctx), 계정: e.계정, account: e.account || e.post.account || null }
        : 빈판결과(e, 판때(e, info, 편첫실제), 시험, folder, ctx));
    }
    for (const p of r.따로) 판들.push({ ...판결과(p, 시험, ctx), 따로: true });
  }
  for (const x of 판들) {
    const w = 기준.창[x.시험.이름];
    const first = 편때.get(x.folder)?.ms ?? null;
    x.창밖 = !!w && first !== null && !(first >= kstDay(w.시작, false) && first <= kstDay(w.끝, true));
  }
  const 갈래들 = 갈래묶기(판들, 편때, 편키확인);
  판들.sort((a, b) => a.시험.이름.localeCompare(b.시험.이름) || a.계정.shown.localeCompare(b.계정.shown) || a.시험.갈래.localeCompare(b.시험.갈래)
    || 때순(편때.get(a.folder)?.ms, 편때.get(b.folder)?.ms) || a.folder.localeCompare(b.folder) || 때순(a.publishedMs, b.publishedMs) || 순서(a.platform) - 순서(b.platform));
  const 판있는편 = new Set(판들.map(x => x.folder));
  const 판정없는편 = [...시험편].filter(([folder]) => !판있는편.has(folder)).map(([folder, { 시험 }]) => ({ folder, 시험 }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
  return { 판들, 갈래들, 판정없는편, 칸오류: 칸오류.sort((a, b) => a.folder.localeCompare(b.folder)),
    키확인: 키확인.sort((a, b) => a.folder.localeCompare(b.folder) || a.key.localeCompare(b.key)), 안셈 };
}

module.exports = { 기준, 시험칸, 계정Of, 핸들열쇠, 추정인가, 시험판정 };
