'use strict';
/**
 * 게시성과판정 — 회사 서버 기록으로 게시물마다 24시간·72시간·7일 판정을 낸다(2026-10-21, AI 없음).
 *
 * 규칙은 제작 방식 v2 §6과 회사 서버 publication-learning.mjs의 「계정 안 상위 25%」를 그대로 옮겼다:
 *   - 같은 채널·형식의 이전 편과만 견준다. 3편부터 중앙값, 4편부터 위치(가운데 순위 = 아래 비율 + 같은 값의 절반)를 잰다.
 *     0.75를 넘으면 상위 25%, 0.25 미만이면 하위 25%, 이전 값이 세 가지 미만이면 가르지 않는다(보통).
 *   - 24·72시간은 서버 체크포인트 값(목표 시각부터 6시간 안 관측)만 쓰고, 같은 출처·관측 지연 차 15분 안의 편끼리 견준다.
 *     창 지표(유튜브 분석이 게시 5일 뒤 채우는 값)는 같은 창 정의끼리 견준다.
 *   - 7일은 서버가 하루 한 번(09시 KST 무렵) 모으는 게시물 숫자(snapshots) 가운데 게시 168시간에 가장 가까운 값(±13시간)이다.
 *     하루 한 번이라 지연 규칙 없이 같은 채널·형식의 7일 값끼리 견준다(등록하지 않은 편의 숫자도 견줄 편에 든다).
 *   - 상위·하위와 다음 할 일은 v2 §6의 네 숫자(초반 유지·평균 시청과 완주·보내기와 저장·맞춤 도구 유입)로만 정한다.
 *     조회·좋아요·댓글·도달은 판정 줄에 보이기만 한다(「조회수만으로 보지 않는다」). 지표가 엇갈리면 제안하지 않는다.
 *   - 평소 대비 배수 = 이 편 조회 ÷ 그 시각 같은 채널·형식 최근 12편 조회의 중앙값(lib/평소배수.js, 그 편도 12편에 든다).
 * 화면에서만 볼 수 있는 칸(유튜브 본 비율, 인스타 팔로우, 권한이 없어 서버가 못 받은 칸)은 「화면 필요」로 남기고
 * 한 주에 한 번 모아 읽은 값(장부의 「화면」 줄)을 72시간·7일 판정에 더한다.
 */
const 배수 = require('./평소배수.js');

const H = 3_600_000;
const MIN = 60_000;
const MIN_SAMPLE = 3;
const STANDING_MIN = 4;
const DAILY_TOLERANCE = 13 * H;

/** 지표 — 서버 POST_PERFORMANCE_METRICS와 같은 이름, 팔로우만 화면 전용으로 더했다. */
const METRICS = Object.freeze({
  views: { label: '조회', unit: 'count' }, likes: { label: '좋아요', unit: 'count' }, comments: { label: '댓글', unit: 'count' },
  shares: { label: '공유', unit: 'count' }, saves: { label: '저장', unit: 'count' }, reach: { label: '도달', unit: 'count' },
  earlyRetention3sPct: { label: '3초 유지율', unit: 'percent', max: 100 }, stayedToWatchPct: { label: '본 비율', unit: 'percent', max: 100 },
  averageWatchSeconds: { label: '평균 시청', unit: 'seconds' }, averageViewPct: { label: '평균 조회율', unit: 'percent' },
  completionRatePct: { label: '완주율', unit: 'percent', max: 100 }, toolVisits: { label: '맞춤 도구 유입', unit: 'count' },
  subscribersGained: { label: '구독 증가', unit: 'count' }, subscribersLost: { label: '구독 취소', unit: 'count' },
  follows: { label: '팔로우', unit: 'count' },
});
const NEXT_STEP_METRICS = new Set(['earlyRetention3sPct', 'stayedToWatchPct', 'averageWatchSeconds', 'averageViewPct', 'completionRatePct', 'shares', 'saves', 'toolVisits']);
const POINTS = Object.freeze([{ key: '24h', hours: 24, label: '24시간' }, { key: '72h', hours: 72, label: '72시간' }, { key: '7d', hours: 168, label: '7일' }]);
const PLATFORM_LABEL = Object.freeze({ youtube: '유튜브', instagram: '인스타', facebook: '페북', tiktok: '틱톡' });
/** 형식마다 v2 §6 네 숫자 가운데 화면에서 읽어야 할 수 있는 칸(서버가 이미 받은 칸은 뺀다). */
const SCREEN_FIELDS = Object.freeze({
  'youtube-shorts': ['stayedToWatchPct', 'averageWatchSeconds', 'averageViewPct', 'shares', 'subscribersGained'],
  'youtube-video': ['averageWatchSeconds', 'averageViewPct', 'shares', 'subscribersGained'],
  'instagram-reels': ['earlyRetention3sPct', 'averageWatchSeconds', 'shares', 'saves', 'follows'],
  'instagram-post': ['shares', 'saves', 'follows'],
  'facebook-reels': ['views', 'averageWatchSeconds', 'shares'],
  'facebook-video': ['views', 'averageWatchSeconds', 'shares'],
  'tiktok-video': ['averageWatchSeconds', 'completionRatePct'],
});
/** 유튜브 창 지표(게시 5일 뒤 서버가 채운다) — 창을 기다리는 동안은 화면 필요로 올리지 않는다. */
const YOUTUBE_WINDOW_FIELDS = new Set(['averageWatchSeconds', 'averageViewPct', 'shares', 'subscribersGained', 'subscribersLost']);

const NEXT = Object.freeze({
  top: '같은 형식으로 세 편 더 · 다른 씨앗·국가 계정에 현지어판 · 맞춤 프로그램 편 설정 붙이기',
  bottom: '첫 3초(훅)를 바꾼 판을 다른 씨앗 계정에서 시험하거나 접기 — 같은 계정에 다시 올리지 않고 본문은 고치지 않는다',
});

const ms = v => (typeof v === 'number' ? v : typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : null);
const validValue = (value, key) => {
  const d = METRICS[key];
  return !!d && typeof value === 'number' && Number.isFinite(value) && value >= 0 && (d.unit !== 'count' || Number.isSafeInteger(value)) && (d.max === undefined || value <= d.max);
};

/** 게시 주소 → {platform, externalId, key} 또는 null */
function postIdOf(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|web)\./, '');
  const y = 배수.youtubeTarget(String(url));
  if (y && y.kind === 'video') return { platform: 'youtube', externalId: y.id, key: 'youtube:' + y.id };
  if (host === 'instagram.com') {
    const m = /^\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,})/.exec(u.pathname);
    return m ? { platform: 'instagram', externalId: m[1], key: 'instagram:' + m[1] } : null;
  }
  if (host === 'facebook.com') {
    // ?v=·story_fbid가 먼저, 그다음 reel·videos·posts 바로 뒤 숫자, 그다음 경로의 마지막 숫자(페이지 ID를 게시물로 잡지 않게)
    const q = [u.searchParams.get('v'), u.searchParams.get('story_fbid')].find(v => /^\d{6,}$/.test(v || ''));
    const after = /\/(?:reel|reels|videos|posts)\/(\d{6,})/.exec(u.pathname);
    const nums = u.pathname.match(/\d{6,}/g) || [];
    const id = q || after?.[1] || (/\/(?:reel|reels|videos|posts|watch)\b/.test(u.pathname) ? null : nums[nums.length - 1]);
    return id ? { platform: 'facebook', externalId: id, key: 'facebook:' + id } : null;
  }
  if (host === 'tiktok.com') {
    const m = /\/video\/(\d{6,})/.exec(u.pathname);
    return m ? { platform: 'tiktok', externalId: m[1], key: 'tiktok:' + m[1] } : null;
  }
  return null;
}

/**
 * 형식 — 등록의 형식 → 서버 수집 게시물의 형식 → 주소 모양.
 * 유튜브는 쇼츠 탭 목록(shorts: {ids:Set, coversAt})이 있으면 그것으로 다시 가른다 — 서버는 길이(3분 이하)로만 가르므로
 * 3분 이하 가로 영상도 쇼츠로 잡힌다. 목록이 덮는 기간(coversAt 이후)에 올라왔는데 목록에 없으면 일반 영상이다.
 */
function formatOf({ platform, url, entryFormat, postFormat, externalId, publishedMs, shorts }) {
  if (platform === 'youtube') {
    if (shorts && shorts.ids.has(externalId)) return 'youtube-shorts';
    const known = entryFormat || postFormat || (/\/shorts\//.test(String(url)) ? 'youtube-shorts' : 'youtube-video');
    if (known === 'youtube-shorts' && shorts && typeof shorts.coversAt === 'number' && publishedMs >= shorts.coversAt) return 'youtube-video';
    return known;
  }
  if (platform === 'instagram') return entryFormat || postFormat || (/\/(reel|reels)\//.test(String(url)) ? 'instagram-reels' : 'instagram-post');
  if (platform === 'facebook') return entryFormat || postFormat || (/\/reels?\//.test(String(url)) ? 'facebook-reels' : /\/videos?\//.test(String(url)) || /[?&]v=/.test(String(url)) ? 'facebook-video' : 'facebook-post');
  if (platform === 'tiktok') return entryFormat || postFormat || 'tiktok-video';
  return platform + '-other';
}

const WINDOW_TIME_ZONE = 'America/Los_Angeles', WINDOW_DAYS = 3;
const addDays = (date, days) => new Date(Date.parse(date + 'T00:00:00.000Z') + days * 24 * H).toISOString().slice(0, 10);
const sourceOk = s => typeof s === 'string' && !!s.trim() && s.length <= 100;
/** 창 지표의 출처 — 서버 publication-learning의 windowValid와 같다 */
function windowValid(p, key) {
  return p?.kind === 'window' && p.lagged === true && p.unit === METRICS[key]?.unit && sourceOk(p.source) && p.timeZone === WINDOW_TIME_ZONE
    && p.days === WINDOW_DAYS && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate || '') && Number.isFinite(Date.parse(p.startDate + 'T00:00:00.000Z'))
    && p.endDate === addDays(p.startDate, WINDOW_DAYS - 1);
}

/**
 * 서버 체크포인트 하나 → 판정에 쓸 점. 비교에 쓸 수 있는지(valid)는 서버 publication-learning의 provenance와 같은 조건이다:
 * 지표마다 출처 기록(단위가 맞고 출처가 빈칸 아님)이 있고, 기록됨, 목표 시각 ≤ 관측 ≤ 마감(목표 + 6시간 안), 관측이 지금보다 앞,
 * 창을 놓치지 않음. 창 지표는 같은 창 정의(windowValid)일 때만.
 */
function checkpointPoint(entry, point, now = Date.now()) {
  const cp = (entry.checkpoints || []).find(c => c.hours === point.hours);
  if (!cp) return { key: point.key, status: 'none' };
  const due = ms(cp.dueAt), closes = ms(cp.closesAt);
  const metrics = {}, meta = {};
  for (const [key, value] of Object.entries(cp.metrics || {})) {
    if (!validValue(value, key)) continue;
    const p = cp.metricProvenance?.[key] || null;
    const windowed = p?.kind === 'window';
    if (cp.status !== 'recorded' && !windowed) continue;
    const observed = ms(p?.observedAt);
    const seen = observed !== null && observed <= now;
    const valid = windowed
      ? windowValid(p, key) && seen
      : cp.status === 'recorded' && !!p && p.unit === METRICS[key].unit && sourceOk(p.source) && seen && due !== null && closes !== null
        && closes >= due && closes <= due + 6 * H && observed >= due && observed <= closes && p.measurementWindowMissed !== true;
    metrics[key] = value;
    meta[key] = { source: String(p?.source || cp.source || ''), observedAt: seen ? observed : null, windowed, valid, offset: windowed || !seen || due === null ? null : observed - due,
      estimated: p?.estimated === true, ...(windowed ? { window: `${p.startDate}~${p.endDate}` } : {}) };
  }
  return { key: point.key, status: cp.status || 'none', dueAt: due, observedAt: ms(cp.observedAt), source: cp.source || null, metrics, meta,
    window: cp.window && typeof cp.window === 'object' ? { status: cp.window.status || null, dueAt: ms(cp.window.dueAt), lastErrorCode: cp.window.lastErrorCode || null } : null };
}

/** 하루 숫자(snapshots)에서 게시 hours시간에 가장 가까운 값(±13시간) */
function dailyPoint({ publishedAt, snaps, platform }, point, now) {
  const target = ms(publishedAt) + point.hours * H;
  if (now < target - DAILY_TOLERANCE) return { key: point.key, status: 'pending', dueAt: target };
  let best = null;
  for (const s of snaps || []) {
    const off = s.at - target;
    if (Math.abs(off) <= DAILY_TOLERANCE && (!best || Math.abs(off) < Math.abs(best.at - target))) best = s;
  }
  if (!best) return { key: point.key, status: now > target + DAILY_TOLERANCE + 3 * H ? 'missed' : 'pending', dueAt: target };
  const metrics = {}, meta = {};
  for (const key of ['views', 'likes', 'comments', 'shares', 'saves', 'reach']) {
    if (!validValue(best[key], key)) continue;
    metrics[key] = best[key];
    meta[key] = { source: `daily:${platform}`, observedAt: best.at, windowed: false, valid: true, offset: best.at - target };
  }
  return { key: point.key, status: 'recorded', dueAt: target, observedAt: best.at, source: `daily:${platform}`, metrics, meta, daily: true };
}

/** 가운데 순위 위치 — 서버 standingOf와 같다 */
function standingOf(value, values) {
  if (values.length < STANDING_MIN) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const nearest = p => sorted[Math.max(0, Math.ceil(p / 100 * sorted.length) - 1)];
  const rank = (sorted.filter(v => v < value).length + sorted.filter(v => v === value).length / 2) / sorted.length;
  const label = new Set(sorted).size < 3 ? 'middle' : rank > 0.75 ? 'top25' : rank < 0.25 ? 'bottom25' : 'middle';
  return { label, p25: nearest(25), p75: nearest(75), sampleCount: sorted.length };
}

/** 이전 편 값과 견준다. peers: 같은 채널·형식의 다른 기록들(이 점이 있는 것) */
function compare(record, pointKey, metric, peers) {
  const mine = record.points[pointKey];
  const m = mine?.meta?.[metric];
  if (!m || !m.valid) return { status: 'unavailable', sampleCount: 0 };
  const values = [];
  const seen = new Set();
  for (const peer of peers) {
    if (peer === record || peer.id === record.id || peer.publishedMs >= record.publishedMs || seen.has(peer.key)) continue;
    const p = peer.points[pointKey];
    const v = p?.metrics?.[metric], pm = p?.meta?.[metric];
    if (!validValue(v, metric) || !pm?.valid || pm.windowed !== m.windowed) continue;
    if (!m.windowed && !mine.daily) {
      if (pm.source !== m.source || pm.offset === null || m.offset === null || Math.abs(pm.offset - m.offset) > 15 * MIN) continue;
    }
    if (m.windowed && pm.source !== m.source) continue;
    seen.add(peer.key);
    values.push(v);
  }
  if (values.length < MIN_SAMPLE) return { status: 'insufficient', sampleCount: values.length };
  const value = mine.metrics[metric];
  return { status: 'ready', sampleCount: values.length, median: 배수.median(values), standing: standingOf(value, values) };
}

/** 화면에서 읽은 값끼리 견준다(읽은 때 나이는 따지지 않고 적어 둔다) */
function compareScreen(record, metric, peers) {
  const value = record.screen?.metrics?.[metric];
  if (!validValue(value, metric)) return { status: 'unavailable', sampleCount: 0 };
  const seen = new Set();
  const values = [];
  for (const p of peers) {
    if (p === record || p.id === record.id || p.publishedMs >= record.publishedMs || seen.has(p.key) || !validValue(p.screen?.metrics?.[metric], metric)) continue;
    seen.add(p.key);
    values.push(p.screen.metrics[metric]);
  }
  if (values.length < MIN_SAMPLE) return { status: 'insufficient', sampleCount: values.length };
  return { status: 'ready', sampleCount: values.length, median: 배수.median(values), standing: standingOf(value, values) };
}

/** 판정 하나 — {label, next, facts[], ranked{top[],bottom[]}, reason} */
function verdictOf(facts) {
  const ranked = facts.filter(f => NEXT_STEP_METRICS.has(f.metric) && f.comparison.standing);
  const tops = ranked.filter(f => f.comparison.standing.label === 'top25');
  const bottoms = ranked.filter(f => f.comparison.standing.label === 'bottom25');
  if (!ranked.length) {
    const have = facts.filter(f => NEXT_STEP_METRICS.has(f.metric));
    const reason = !have.length ? '네 숫자(초반 유지·평균 시청·보내기와 저장·맞춤 도구 유입)가 아직 없다'
      : `견줄 이전 편이 모자란다(${have.map(f => `${METRICS[f.metric].label} ${f.comparison.sampleCount}편`).join(' · ')} — 4편부터)`;
    return { label: '자료 부족', next: null, tops: [], bottoms: [], reason };
  }
  if (tops.length && !bottoms.length) return { label: '상위 25%', next: NEXT.top, tops, bottoms, reason: null };
  if (bottoms.length && !tops.length) return { label: '하위 25%', next: NEXT.bottom, tops, bottoms, reason: null };
  if (tops.length && bottoms.length) return { label: '엇갈림', next: null, tops, bottoms, reason: '지표가 엇갈려 다음 할 일을 정하지 않는다' };
  return { label: '보통', next: null, tops, bottoms, reason: null };
}

/**
 * 서버 기록 → 판정할 기록들.
 *   data: 게시성과읽기.읽기()의 결과 · shortsByChannel: Map(channelId → {ids:Set, complete, coversAt}) (유튜브 쇼츠 탭, 없으면 서버 형식)
 *   screens: Map(postKey → {at, ageHours, metrics}) 장부의 「화면」 줄 가운데 칸마다 가장 늦은 값
 * → {records[], registered[], channels: Map}
 */
function buildRecords(data, { now = Date.now(), shortsByChannel = new Map(), screens = new Map() } = {}) {
  const channels = new Map(data.channels.map(c => [c.id, c]));
  const snapsByPost = new Map();
  for (const s of data.snapshots) {
    const [postId, at, views, likes, comments, shares, saves, reach] = s;
    if (!snapsByPost.has(postId)) snapsByPost.set(postId, []);
    snapsByPost.get(postId).push({ at, views, likes, comments, shares, saves, reach });
  }
  for (const list of snapsByPost.values()) list.sort((a, b) => a.at - b.at);
  const byKey = new Map();
  const add = (channelId, url, fields) => {
    const id = postIdOf(url);
    const channel = channels.get(channelId);
    if (!id || !channel || id.platform !== channel.platform) return null;
    const key = `${channelId}:${id.externalId}`;
    const record = byKey.get(key) || { key, id: key, postKey: id.key, channelId, platform: id.platform, externalId: id.externalId, url, points: {} };
    Object.assign(record, Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== null)));
    byKey.set(key, record);
    return record;
  };
  for (const p of data.posts) add(p.channelId, p.url, { serverPostId: p.id, postFormat: p.publicationFormat, publishedAt: p.publishedAt });
  for (const e of data.entries) {
    add(e.channelId, e.url, { entry: e, entryId: e.id, entryFormat: e.publicationFormat, publishedAt: e.publishedAt, title: e.title, origin: e.origin || 'manual' });
  }
  const records = [];
  for (const r of byKey.values()) {
    r.publishedMs = ms(r.publishedAt);
    if (r.publishedMs === null) continue;
    r.format = formatOf({ platform: r.platform, url: r.url, entryFormat: r.entryFormat, postFormat: r.postFormat, externalId: r.externalId,
      publishedMs: r.publishedMs, shorts: r.platform === 'youtube' ? shortsByChannel.get(r.channelId) || null : null });
    r.snaps = r.serverPostId ? snapsByPost.get(r.serverPostId) || [] : [];
    for (const point of POINTS) {
      if (point.key === '7d') r.points[point.key] = dailyPoint({ publishedAt: r.publishedAt, snaps: r.snaps, platform: r.platform }, point, now);
      else if (r.entry) r.points[point.key] = checkpointPoint(r.entry, point, now);
    }
    r.screen = screens.get(r.postKey) || null;
    records.push(r);
  }
  return { records, registered: records.filter(r => r.entry), channels, snapsByPost };
}

/** 그 시각 조회수 — 하루 숫자 가운데 at 이전의 가장 늦은 값 */
function viewsAtFactory(records) {
  const byId = new Map(records.map(r => [r.id, r]));
  return (id, at) => {
    const r = byId.get(id);
    if (!r) return null;
    let v = null;
    for (const s of r.snaps || []) if (s.at <= at && validValue(s.views, 'views')) v = s.views;
    return v;
  };
}

/** 기록 하나의 점 하나를 판정한다 → 판정 객체 또는 null(아직 값 없음) */
function judgePoint(record, pointKey, { peers, viewsAt }) {
  const point = record.points[pointKey];
  if (!point || point.status !== 'recorded' && !Object.values(point.meta || {}).some(m => m.windowed)) return null;
  const facts = [];
  for (const [metric, value] of Object.entries(point.metrics || {})) {
    facts.push({ metric, value, source: point.meta[metric].source, windowed: point.meta[metric].windowed, estimated: point.meta[metric].estimated === true,
      ...(point.meta[metric].window ? { window: point.meta[metric].window } : {}), comparison: compare(record, pointKey, metric, peers) });
  }
  if (pointKey !== '24h' && record.screen) {
    for (const [metric, value] of Object.entries(record.screen.metrics || {})) {
      if (facts.some(f => f.metric === metric) || !validValue(value, metric)) continue;
      facts.push({ metric, value, source: 'screen', screen: true, ageHours: record.screen.ageHours, comparison: compareScreen(record, metric, peers) });
    }
  }
  const views = point.metrics?.views;
  let multipleInfo = null;
  if (validValue(views, 'views')) {
    const at = point.observedAt ?? point.dueAt;
    const base = 배수.baselineAt({ posts: peers.map(p => ({ id: p.id, publishedAt: p.publishedAt })), viewsAt, at,
      self: { id: record.id, publishedAt: record.publishedAt, views } });
    multipleInfo = { value: 배수.multiple(views, base.median), median: base.median, n: base.n, at: base.at };
  }
  const verdict = verdictOf(facts);
  return { point: pointKey, status: point.status, observedAt: point.observedAt ?? null, daily: point.daily === true, facts, multiple: multipleInfo, verdict };
}

/**
 * 화면 필요 칸 — 형식의 화면 칸 가운데 서버(24·72시간·창·7일)·화면 읽기 어디에도 없는 것.
 * 조회가 어디에도 없으면(통계 권한이 없는 계정) 조회·도달도 화면 필요다.
 * 유튜브 창 지표는 게시 6일째까지 서버를 기다린다(창은 게시 5일 뒤 채워진다). 채널이 공개 통계로만 연결돼 주인 권한이 없으면
 * (channel.ownerAuthorized === false) 창이 오지 않으므로 기다리지 않는다.
 * 아직 72시간이 안 된 편은 비워 둔다(주 1회 읽기는 72시간이 지난 편만 본다).
 */
function screenNeeds(record, now, channel = null) {
  if (now < record.publishedMs + 72 * H) return [];
  const fields = [...(SCREEN_FIELDS[record.format] || [])];
  const have = new Set();
  for (const key of ['24h', '72h', '7d']) for (const [m, v] of Object.entries(record.points[key]?.metrics || {})) if (validValue(v, m)) have.add(m);
  for (const [m, v] of Object.entries(record.screen?.metrics || {})) if (validValue(v, m)) have.add(m);
  if (!have.has('views')) fields.unshift(...(record.platform === 'instagram' ? ['views', 'reach'] : ['views']));
  const p72 = record.points['72h'];
  const windowError = !!p72?.window?.lastErrorCode;
  const waiting = record.platform === 'youtube' && channel?.ownerAuthorized !== false && !windowError && p72?.window?.status !== 'recorded'
    && now < record.publishedMs + 6 * 24 * H;
  return [...new Set(fields)].filter(m => !have.has(m) && !(waiting && YOUTUBE_WINDOW_FIELDS.has(m)));
}

/** 서버 기록 전체를 판정한다 → [{record, judgments:{24h,72h,7d}, screenNeeded[]}] (등록된 편만) */
function judgeAll(data, opts = {}) {
  const now = opts.now ?? Date.now();
  const built = buildRecords(data, { ...opts, now });
  const viewsAt = viewsAtFactory(built.records);
  const group = new Map();
  for (const r of built.records) {
    const g = `${r.channelId}|${r.format}`;
    if (!group.has(g)) group.set(g, []);
    group.get(g).push(r);
  }
  return built.registered.map(record => {
    const peers = group.get(`${record.channelId}|${record.format}`) || [];
    const judgments = {};
    for (const point of POINTS) {
      const j = judgePoint(record, point.key, { peers, viewsAt });
      if (j) judgments[point.key] = j;
    }
    const channel = built.channels.get(record.channelId);
    return { record, channel, judgments, screenNeeded: screenNeeds(record, now, channel) };
  });
}

// ── 사람이 읽는 글 ─────────────────────────────────────────────────────────

const 수 = v => Number(v).toLocaleString('ko-KR');
function valueText(metric, value) {
  const unit = METRICS[metric]?.unit;
  return unit === 'percent' ? `${Math.round(value * 10) / 10}%` : unit === 'seconds' ? `${Math.round(value * 10) / 10}초` : 수(value);
}
const 배수글 = m => (!m || m.value === null ? '평소 대비 못 잼' : `평소 대비 ${m.value >= 10 ? Math.round(m.value) : m.value.toFixed(1)}배(최근 ${m.n}편 중앙값 ${수(Math.round(m.median))})`);
const 위치글 = { top25: '상위 25%', bottom25: '하위 25%', middle: '보통' };

/** 판정 한 줄(기획.md·요약 표) */
function judgmentLine(j) {
  const shown = ['views', 'likes', 'comments', 'shares', 'saves', 'reach', 'earlyRetention3sPct', 'stayedToWatchPct', 'averageWatchSeconds', 'averageViewPct', 'completionRatePct', 'toolVisits', 'follows'];
  const facts = shown.map(m => j.facts.find(f => f.metric === m)).filter(Boolean);
  const parts = facts.map(f => `${METRICS[f.metric].label} ${valueText(f.metric, f.value)}${f.estimated ? '(추정)' : ''}${f.windowed ? '(창)' : ''}${f.screen ? `(화면·${Math.round(f.ageHours / 24)}일째)` : ''}`
    + (f.comparison.standing ? `[${위치글[f.comparison.standing.label]}·${f.comparison.standing.sampleCount}편]` : ''));
  const v = j.verdict;
  return `${parts.join(' · ')} · ${배수글(j.multiple)} → **${v.label}**${v.next ? ` — 다음: ${v.next}` : v.reason ? ` (${v.reason})` : ''}`;
}

module.exports = {
  METRICS, NEXT_STEP_METRICS, POINTS, PLATFORM_LABEL, SCREEN_FIELDS, NEXT, H,
  postIdOf, formatOf, checkpointPoint, dailyPoint, standingOf, compare, verdictOf, buildRecords, judgePoint, judgeAll, screenNeeds,
  judgmentLine, valueText, validValue,
};
