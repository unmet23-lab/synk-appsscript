import { createHash, randomUUID } from 'node:crypto';
import { collectChannel, collectYoutubeWindows, PLATFORM_CAPABILITIES } from './collectors.mjs';
import { canReadChannel, canWriteChannel } from './organization.mjs';
import { lookupPerformancePost } from './post-performance-lookup.mjs';

const KIND = 'postPerformanceEntries', LOCKS = 'postPerformanceLocks';
const HOUR = 3600000, WINDOW = 6 * HOUR, LEASE = 3 * 60000;
// 자동 등록(10-20): 채널 집계가 찾은 공개 게시물 중 게시 24시간 안의 것만 올린다 — 지난 관측 시점은 복원하지 않는다.
// 한 번에 20편까지, 공식 수집이 되는 네 플랫폼만. 형식은 집계가 받은 영상 길이·릴스 여부에서 온다.
const AUTO_TRACK_WINDOW = 24 * HOUR, AUTO_TRACK_BATCH = 20, AUTO_TRACK_PLATFORMS = new Set(['youtube', 'instagram', 'facebook', 'tiktok']);
const FORMAT_PLATFORM = Object.freeze({ 'youtube-shorts': 'youtube', 'youtube-video': 'youtube', 'instagram-reels': 'instagram' });
export const POST_PERFORMANCE_METRICS = Object.freeze([
  { id: 'views', label: '조회', unit: 'count' }, { id: 'likes', label: '좋아요', unit: 'count' },
  { id: 'comments', label: '댓글', unit: 'count' }, { id: 'shares', label: '공유', unit: 'count' },
  { id: 'saves', label: '저장', unit: 'count' }, { id: 'reach', label: '도달', unit: 'count' },
  { id: 'earlyRetention3sPct', label: '3초 유지율', unit: 'percent', max: 100, description: '재생된 것 가운데 3초까지 계속 본 비율이에요. 다른 초의 유지율은 넣지 않아요. Instagram 릴스는 건너뛴 비율(추정)로 계산해 받아요.' },
  { id: 'stayedToWatchPct', label: '본 비율', unit: 'percent', max: 100, platforms: ['youtube'], description: 'YouTube 쇼츠 분석의 「본 비율 대 넘긴 비율」 중 본 비율이에요. API로 받을 수 없어 스튜디오에서 보고 직접 넣어요.' },
  { id: 'averageWatchSeconds', label: '평균 시청 시간', unit: 'seconds', description: '이 게시물의 평균 시청 시간을 초로 넣어요. 총 시청 시간이 아니에요.' },
  { id: 'averageViewPct', label: '평균 조회율', unit: 'percent', platforms: ['youtube'], description: '영상 길이에 비해 평균 얼마나 봤는지 나타낸 비율이에요(YouTube 평균 조회율). 반복 재생 때문에 100%를 넘을 수 있고, 완주율과는 달라요.' },
  { id: 'completionRatePct', label: '완주율', unit: 'percent', max: 100, description: '재생된 것 가운데 끝까지 본 비율이에요.' },
  { id: 'toolVisits', label: '맞춤 도구 유입', unit: 'count', description: '이 게시물에만 단 링크로 맞춤 도구에 들어온 수예요. 채널 전체 방문 수는 넣지 않아요.' },
  { id: 'subscribersGained', label: '구독 증가', unit: 'count', platforms: ['youtube'], description: '이 영상에서 늘어난 구독자 수예요(YouTube Analytics).' },
  { id: 'subscribersLost', label: '구독 취소', unit: 'count', platforms: ['youtube'], description: '이 영상에서 구독을 취소한 수예요(YouTube Analytics).' },
]);
const metricIds = POST_PERFORMANCE_METRICS.map(metric => metric.id);
const definitionOf = key => POST_PERFORMANCE_METRICS.find(item => item.id === key);
const capabilityOf = platform => PLATFORM_CAPABILITIES.find(item => item.id === platform);
const validValue = (value, definition) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && (definition.unit !== 'count' || Number.isSafeInteger(value)) && (definition.max === undefined || value <= definition.max);
// Metrics an official screen shows but no API returns: the reason says so and the value is entered by hand.
const NO_API = Object.freeze({
  youtube: { stayedToWatchPct: '본 비율은 API로 받을 수 없어요. YouTube 스튜디오 쇼츠 분석의 「본 비율 대 넘긴 비율」을 보고 직접 넣어 주세요.', completionRatePct: '완주율은 YouTube API로 받을 수 없어요. 확인한 값이 있으면 직접 넣어 주세요.' },
  instagram: { completionRatePct: '완주율은 Instagram API로 받을 수 없어요. 확인한 값이 있으면 직접 넣어 주세요.' },
});
// Lagged Analytics metrics have no value "at" a checkpoint time. The 72-hour point reads a fixed window instead:
// the publication date in Pacific Time and the next two days, once, five days after publication (the last
// day is then 48~72 hours old). It fills only metrics the checkpoint left empty and is never fetched again.
const WINDOW_TIME_ZONE = 'America/Los_Angeles', WINDOW_DAYS = 3, WINDOW_DUE = 120 * HOUR, WINDOW_OPEN = 72 * HOUR, WINDOW_BATCH = 10;
const pacificDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: WINDOW_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 24 * HOUR).toISOString().slice(0, 10);
const withoutLease = ({ leaseToken, leaseUntil, ...rest }) => rest;
function windowPlan(row, checkpoint) {
  if (checkpoint?.hours !== 72) return null;
  if (checkpoint.window) return checkpoint.window;
  const metrics = capabilityOf(row.platform)?.laggedMetrics || [];
  if (!metrics.length || !Number.isFinite(Date.parse(row.publishedAt))) return null;
  const startDate = pacificDate(row.publishedAt);
  // closesAt is set on the first attempt: a late registration still gets its window, with bounded retries.
  return { kind: 'window', timeZone: WINDOW_TIME_ZONE, days: WINDOW_DAYS, startDate, endDate: addDays(startDate, WINDOW_DAYS - 1), metrics: [...metrics],
    dueAt: new Date(Date.parse(row.publishedAt) + WINDOW_DUE).toISOString(), closesAt: null, status: 'pending', attempts: 0, nextAttemptAt: null, fetchedAt: null, lastErrorCode: null, message: null };
}
const windowEligible = (plan, at) => !!plan && ['pending', 'retry', 'collecting'].includes(plan.status) && plan.dueAt <= at && (!plan.nextAttemptAt || plan.nextAttemptAt <= at) && !(plan.status === 'collecting' && plan.leaseUntil > at);
const windowDetail = meta => meta?.kind === 'window' && meta.timeZone === WINDOW_TIME_ZONE && meta.days === WINDOW_DAYS && /^\d{4}-\d{2}-\d{2}$/.test(meta.startDate || '') && meta.endDate === addDays(meta.startDate, WINDOW_DAYS - 1);
const sameWindowKind = (a, b) => windowDetail(a) && windowDetail(b) && a.source === b.source && a.unit === b.unit;
// Keep window-filled values when a checkpoint observation is rebuilt (late manual entry on an unrecorded point).
function keepWindowValues(previous, next) {
  const metrics = { ...next.metrics }, metricProvenance = { ...next.metricProvenance }, unavailableReasons = { ...next.unavailableReasons };
  for (const [key, meta] of Object.entries(previous.metricProvenance || {})) {
    if (meta?.kind !== 'window' || metrics[key] !== null && metrics[key] !== undefined || !validValue(previous.metrics?.[key], definitionOf(key) || {})) continue;
    metrics[key] = previous.metrics[key]; metricProvenance[key] = meta; delete unavailableReasons[key];
  }
  return { ...next, metrics, metricProvenance, unavailableReasons };
}
// Automatic derivations from collectors (estimated reel retention, unit conversion) keep their raw value.
function derivation(detail) {
  if (!detail || typeof detail !== 'object') return {};
  const result = {};
  if (typeof detail.derivedFrom === 'string' && /^[a-z_]{1,60}$/.test(detail.derivedFrom)) result.derivedFrom = detail.derivedFrom;
  if (typeof detail.rawValue === 'number' && Number.isFinite(detail.rawValue)) result.rawValue = detail.rawValue;
  if (['percent', 'milliseconds', 'seconds'].includes(detail.rawUnit)) result.rawUnit = detail.rawUnit;
  if (detail.estimated === true) result.estimated = true;
  return result;
}
// Fill only empty metrics of the 72-hour point; values recorded at that time (or by hand) stay as they are.
function applyWindow(checkpoint, plan, video, { at, source }) {
  const values = {}, filled = [], kept = [];
  for (const key of plan.metrics) {
    const definition = definitionOf(key), value = video.metrics?.[key];
    if (!definition || !validValue(value, definition)) continue;
    if (checkpoint.metrics?.[key] !== null && checkpoint.metrics?.[key] !== undefined) { kept.push(key); continue; }
    values[key] = value; filled.push(key);
  }
  const meta = { source, kind: 'window', timeZone: plan.timeZone, days: plan.days, startDate: plan.startDate, endDate: plan.endDate, observedAt: at, recordedAt: at, timing: 'window', lagged: true, measurementWindowMissed: false };
  const unavailableReasons = { ...checkpoint.unavailableReasons };
  for (const key of filled) delete unavailableReasons[key];
  for (const key of plan.metrics) if (!filled.includes(key) && !kept.includes(key)) unavailableReasons[key] = `YouTube Analytics의 ${plan.startDate}~${plan.endDate}(태평양시) 값을 받았지만 이 지표는 비어 있었어요.`;
  return { ...checkpoint, metrics: { ...checkpoint.metrics, ...values }, unavailableReasons,
    metricProvenance: { ...checkpoint.metricProvenance, ...Object.fromEntries(filled.map(key => [key, { ...meta, unit: definitionOf(key).unit }])) },
    window: { ...plan, status: 'recorded', fetchedAt: at, views: Number.isSafeInteger(video.views) ? video.views : null, filled, kept, nextAttemptAt: null, lastErrorCode: null,
      message: kept.length ? `이미 기록된 ${topic(kept.map(key => definitionOf(key).label).join('·'))} 그대로 두고 나머지 빈칸만 채웠어요.` : '태평양시 게시일부터 사흘 동안의 YouTube Analytics 값으로 빈칸을 채웠어요.' } };
}
// Korean topic particle by the final consonant of the last syllable (「공유는」, 「평균 조회율은」).
const topic = word => { const code = String(word).slice(-1).charCodeAt(0) - 0xac00; return word + (code >= 0 && code <= 11171 && code % 28 === 0 ? '는' : '은'); };
// A window that Analytics answered but could not fill yet (not processed, rejected, transient) is tried again within
// 72 hours of that first answer, then left to manual entry.
function windowRetry(plan, at, { code, retryable = false, message }) {
  const closesAt = plan.closesAt || new Date(Date.parse(at) + WINDOW_OPEN).toISOString();
  if (at >= closesAt) return { ...plan, closesAt, status: 'unavailable', nextAttemptAt: null, lastErrorCode: code, message: `${message} 처음 확인한 뒤 72시간이 지나 더는 확인하지 않아요. YouTube 스튜디오에서 본 값은 직접 넣을 수 있어요.` };
  const delay = retryable ? Math.min(15 * 2 ** Math.max(0, (plan.attempts || 1) - 1), 60) * 60000 : 6 * HOUR;
  return { ...plan, closesAt, status: 'retry', nextAttemptAt: new Date(Math.min(Date.parse(at) + delay, Date.parse(closesAt))).toISOString(), lastErrorCode: code, message };
}
// A missing grant or connection waits for a reconnect without spending those 72 hours: the window is a recount of
// fixed dates and means the same whenever it is read.
const WINDOW_WAIT_CODES = new Set(['AUTH_REQUIRED', 'ACCOUNT_MISMATCH', 'MANUAL_ONLY', 'CONNECTION_REQUIRED', 'CONNECTION_CHANGED']);
// 기다림에도 끝이 있다. 창 시작(게시 5일 뒤)부터 30일이 지나면 직접 입력으로 넘긴다 — 공개 읽기·API 키 연결은 권한이 없어 이 대기가
// 끝나지 않는데, 집계 자동 등록으로 그런 유튜브 기록이 늘면 6시간마다 도는 대기가 기록 수만큼 쌓인다(10-20).
const WINDOW_WAIT_LIMIT = 30 * 24 * HOUR;
const windowWait = (plan, at, code, message) => Date.parse(at) >= Date.parse(plan.dueAt) + WINDOW_WAIT_LIMIT
  ? { ...plan, status: 'unavailable', nextAttemptAt: null, lastErrorCode: code, message: '채널 연결·권한을 30일 기다렸지만 늦게 반영되는 숫자를 받지 못해 더는 확인하지 않아요. YouTube 스튜디오에서 본 값은 직접 넣을 수 있어요.' }
  : { ...plan, status: 'retry', nextAttemptAt: new Date(Date.parse(at) + 6 * HOUR).toISOString(), lastErrorCode: code, message };
const WINDOW_WAIT_MESSAGES = { AUTH_REQUIRED: 'YouTube Analytics 통계를 볼 권한이 없어 받지 못했어요. 채널을 통계 권한까지 다시 연결해 주세요. 그때까지 6시간마다 다시 확인해요.', ACCOUNT_MISMATCH: '연결한 계정이 이 채널의 소유자로 확인되지 않아 받지 못했어요. 채널 소유자 계정으로 다시 연결해 주세요. 6시간마다 다시 확인해요.' };
const youtubeVideoId = row => { try { const normalized = normalizePerformancePostUrl(row.url); return normalized.platform === 'youtube' ? normalized.externalId : null; } catch { return null; } };
// 연결이 바뀐 것(재연결·토큰 갱신·담당 변경과 겹침)은 새 연결로 곧 다시 본다. 채널이 정말 멈췄으면 다음 회차의 확인이 사람 일로 넘긴다(10-20).
const failureOf = caught => ({ code: ['RATE_LIMITED', 'AUTH_REQUIRED', 'TIMEOUT', 'NETWORK_ERROR', 'MANUAL_ONLY', 'CONNECTION_CHANGED', 'ACCOUNT_MISMATCH', 'CANCELLED'].includes(caught?.code) ? caught.code : 'COLLECTION_FAILED', retryable: caught?.retryable === true || caught?.code === 'CONNECTION_CHANGED' });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cleanText = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emptyMetrics = () => Object.fromEntries(metricIds.map(key => [key, null]));
const iso = (value, label = '시각') => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw fail(`${label}에는 시간대가 붙은 날짜와 시간을 넣어 주세요.`);
  const date = new Date(value), day = value.slice(0, 10).split('-').map(Number);
  if (!Number.isFinite(date.getTime()) || day[1] < 1 || day[1] > 12 || day[2] < 1 || day[2] > new Date(Date.UTC(day[0], day[1], 0)).getUTCDate()) throw fail(`${label}에 없는 날짜가 들어 있어요. 다시 넣어 주세요.`);
  return date.toISOString();
};
const atPlus = (value, amount) => new Date(Date.parse(value) + amount).toISOString();

/** Parse an exact public post URL. Input URLs are never fetched. */
export function normalizePerformancePostUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || /[\\\u0000-\u0020]/u.test(input.trim())) throw fail('게시물 하나를 가리키는 HTTPS 주소를 넣어 주세요.');
  let url; try { url = new URL(input.trim()); } catch { throw fail('게시물 하나를 가리키는 HTTPS 주소를 넣어 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || /%(?:2f|5c|00)/i.test(url.pathname)) throw fail('게시물 하나를 가리키는 HTTPS 주소를 넣어 주세요.');
  const host = url.hostname.toLowerCase().replace(/^(?:www\.|m\.|web\.)/, ''), path = url.pathname.replace(/\/+$/, '');
  const result = (platform, externalId, canonicalUrl, handle = null) => ({ platform, externalId, canonicalUrl, handle, identity: `${platform}:${externalId}` });
  let match;
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? path.slice(1) : path === '/watch' ? url.searchParams.get('v') : path.match(/^\/(?:shorts|live)\/([^/]+)$/)?.[1];
    if (/^[\w-]{11}$/.test(id || '')) return result('youtube', id, `https://www.youtube.com/watch?v=${id}`);
  }
  if (host === 'instagram.com' && (match = path.match(/^\/(?:p|reel|tv)\/([\w-]{3,100})$/))) return result('instagram', match[1], `https://www.instagram.com/p/${match[1]}/`);
  if (host === 'tiktok.com' && (match = path.match(/^\/@([\w.]{1,30})\/video\/(\d{5,30})$/))) return result('tiktok', match[2], `https://www.tiktok.com/@${match[1].toLowerCase()}/video/${match[2]}`, match[1].toLowerCase());
  if (['threads.net', 'threads.com'].includes(host) && (match = path.match(/^\/@([\w.]{1,30})\/post\/([\w-]{3,100})$/))) return result('threads', match[2], `https://www.threads.com/@${match[1].toLowerCase()}/post/${match[2]}`, match[1].toLowerCase());
  if (['x.com', 'twitter.com'].includes(host) && (match = path.match(/^\/([\w]{1,15})\/status\/(\d{5,30})$/))) return result('x', match[2], `https://x.com/${match[1].toLowerCase()}/status/${match[2]}`, match[1].toLowerCase());
  if (host === 'facebook.com') {
    if ((match = path.match(/^\/reel\/(\d{3,40})$/))) return result('facebook', `video:${match[1]}`, `https://www.facebook.com/reel/${match[1]}/`);
    if ((match = path.match(/^\/([\w.-]{1,100})\/videos\/(\d{3,40})$/))) return result('facebook', `video:${match[2]}`, `https://www.facebook.com/${match[1].toLowerCase()}/videos/${match[2]}/`);
    if ((match = path.match(/^\/([\w.-]{1,100})\/posts\/([\w]{3,200})$/))) return result('facebook', `post:${match[1].toLowerCase()}:${match[2]}`, `https://www.facebook.com/${match[1].toLowerCase()}/posts/${match[2]}`);
    if (path === '/watch' && /^\d{3,40}$/.test(url.searchParams.get('v') || '')) return result('facebook', `video:${url.searchParams.get('v')}`, `https://www.facebook.com/watch/?v=${url.searchParams.get('v')}`);
    const id = url.searchParams.get('id'), post = url.searchParams.get('story_fbid');
    if (['/permalink.php', '/story.php'].includes(path) && /^\d{1,40}$/.test(id || '') && /^[\w]{3,200}$/.test(post || '')) return result('facebook', `post:${id}:${post}`, `https://www.facebook.com/${id}/posts/${post}`);
  }
  if (host === 'linkedin.com' && (match = path.match(/^\/feed\/update\/urn:li:activity:(\d{5,30})$/))) return result('linkedin', match[1], `https://www.linkedin.com/feed/update/urn:li:activity:${match[1]}/`);
  if (host === 'linkedin.com' && (match = path.match(/^\/posts\/([\w-]{5,250})$/))) return result('linkedin', match[1], `https://www.linkedin.com/posts/${match[1]}`);
  if (host === 'douyin.com' && (match = path.match(/^\/video\/(\d{5,30})$/))) return result('douyin', match[1], `https://www.douyin.com/video/${match[1]}`);
  if (['vk.com', 'vk.ru'].includes(host) && (match = path.match(/^\/wall(-?\d+_\d+)$/))) return result('vk', match[1], `https://vk.com/wall${match[1]}`);
  if (host === 'xiaohongshu.com' && (match = path.match(/^\/(?:explore|discovery\/item)\/([a-f\d]{12,40})$/i))) return result('xiaohongshu', match[1], `https://www.xiaohongshu.com/explore/${match[1]}`);
  throw fail('지원하는 플랫폼의 게시물 주소를 넣어 주세요. 프로필·단축·공유 링크로는 안 돼요.');
}

// transient: 이번 응답에 일시 오류(한도·시간 초과·연결)가 있었다. 그때 응답에 칸이 있는데 빈 지원 지표는 「제공하지 않음」이 아니라 「일시 오류로 못 받음」으로 남긴다(10-20).
function valuesAndReasons(values, platform, { manual = false, unavailable = [], hours = null, transient = false } = {}) {
  const capability = capabilityOf(platform), supported = new Set([...(capability?.metrics || []), ...(capability?.postMetrics || [])]), lagged = new Set(manual ? [] : capability?.laggedMetrics || []), metrics = {}, unavailableReasons = {};
  for (const key of metricIds) {
    const value = values?.[key], definition = definitionOf(key);
    const valid = validValue(value, definition);
    if (manual && value !== undefined && value !== null && value !== '' && !valid) throw fail(definition.unit === 'percent' ? (definition.max === undefined ? '비율은 0 이상 숫자로 넣어 주세요.' : '비율은 0~100% 사이 숫자로 넣어 주세요.') : definition.unit === 'seconds' ? '시청 시간은 0 이상의 초 단위로 넣어 주세요.' : '횟수는 0 이상의 정수로 넣어 주세요.');
    metrics[key] = valid && (manual || supported.has(key) && !lagged.has(key)) ? value : null;
    if (metrics[key] === null) unavailableReasons[key] = manual ? '직접 넣을 때 비워 둔 숫자예요.'
      : lagged.has(key) ? (hours === 72 ? '늦게 반영되는 YouTube Analytics 지표라 72시간 시점에는 넣지 않아요. 게시 5일 뒤 고정 창(태평양시 게시일부터 사흘) 값으로 채워요.' : '늦게 반영되는 YouTube Analytics 지표라 이 시점에는 넣지 않아요. 72시간 칸에서 채워요.')
      : NO_API[platform]?.[key] || (transient && supported.has(key) && values?.[key] !== undefined ? '플랫폼 일시 오류로 이 숫자를 받지 못했고, 모을 기간 안에 다시 받지도 못했어요.' : !supported.has(key) || unavailable.includes(key) ? '지금 연결로는 플랫폼이 제공하지 않는 숫자예요.' : '플랫폼 응답에 이 게시물의 이 숫자가 없었어요.');
  }
  return { metrics, unavailableReasons };
}
// 일시 오류로 지원 지표가 빈 관측은 관측 기간 안에서 이만큼까지 다시 확인한 뒤에 있는 값만 기록한다.
const GAP_ATTEMPTS = 4, GAP_LAST_CHANCE = 30 * 60000;

export function createPostPerformanceService({ store, clock = () => new Date().toISOString(), collector = collectChannel, windowCollector = null, fetchImpl = globalThis.fetch,
  getCredentials = channel => ({ ...store.secret(`provider:${channel.platform}`), ...store.secret(`channel:${channel.id}`) }),
  isConnected = channel => !channel.collectionDisabled && !!(store.secret(`channel:${channel.id}`)?.accessToken || channel.platform === 'youtube' && (store.secret(`channel:${channel.id}`)?.apiKey || store.secret('provider:youtube')?.apiKey)),
  autoTrack = false, collectTimeoutMs = 120000,
} = {}) {
  if (!store) throw new Error('Post performance requires a store.');
  const readWindows = windowCollector || ((channel, credentials, options) => collectYoutubeWindows(channel, credentials, { ...options, fetchImpl }));
  const activeJobs = new Set(), controllers = new Set();
  let stopped = false;
  const stamp = () => iso(clock(), '서버 시각');
  function currentUser(user) {
    const live = user?.id && store.get('users', user.id);
    if (!live || live.active === false) throw fail('로그인한 계정을 찾지 못했어요. 다시 로그인해 주세요.', 403);
    return live;
  }
  function channelFor(user, id, write = false) {
    user = currentUser(user); const channel = store.get('channels', id);
    if (!channel || channel.active === false || !(write ? canWriteChannel : canReadChannel)(user, channel)) throw fail('맡은 계정 중에 이 계정이 없어요.', 404);
    return channel;
  }
  function lookupChannel(user, id) {
    user = currentUser(user); const channel = store.get('channels', id);
    if (!channel || channel.active === false || !canWriteChannel(user, channel)) throw fail('이 계정의 게시물을 확인하거나 기록할 권한이 없어요.', 403);
    return channel;
  }
  const channelBinding = channel => JSON.stringify([channel.id, channel.platform, channel.externalId, channel.handle, channel.connectionVersion || 0, !!channel.collectionDisabled]);
  async function lookupWork(user, input = {}, { authorize, signal } = {}) {
    authorize?.();
    const channel = lookupChannel(user, input.channelId), binding = channelBinding(channel), normalized = normalizePerformancePostUrl(input.url);
    if (normalized.platform !== channel.platform) throw fail('고른 계정과 게시물의 플랫폼이 달라요. 게시한 계정을 골라 주세요.');
    const check = () => {
      authorize?.();
      if (stopped || signal?.aborted) throw fail('게시물 확인이 중간에 멈췄어요. 다시 시도해 주세요.', 503);
      const live = lookupChannel(user, channel.id);
      if (channelBinding(live) !== binding) throw fail('확인하는 사이 채널 연결이 바뀌었어요. 다시 시도해 주세요.', 409);
    };
    check();
    let details = { ownerMatch: null, publishedAt: null, suggestedFormat: null, title: null, reason: '이 계정은 아직 플랫폼과 연결돼 있지 않아요. 채널·수집의 연결 관리에서 연결해 주세요.' };
    if (!['youtube', 'instagram'].includes(channel.platform)) details.reason = '이 플랫폼은 게시 정보를 자동으로 읽지 못해요. 실제 게시 시각을 직접 넣어 주세요.';
    else if (isConnected(channel)) {
      try {
        const credentials = await getCredentials(channel); check();
        details = await lookupPerformancePost({ channel, normalized, originalUrl: input.url, credentials, normalizeUrl: normalizePerformancePostUrl, fetchImpl, signal, check });
      } catch {
        // Provider URLs/messages can contain credentials. Only a fixed message
        // crosses the API boundary; local authorization failures still throw.
        check(); details.reason = '플랫폼에서 게시 정보를 읽지 못했어요. 채널 연결이 살아 있는지, 게시물이 공개 상태인지 본 뒤 다시 시도해 주세요.';
      }
    }
    check();
    const publishedAt = details.publishedAt;
    const checkpoints = Object.fromEntries([24, 72].map(hours => {
      const dueAt = publishedAt ? atPlus(publishedAt, hours * HOUR) : null, closesAt = dueAt ? atPlus(dueAt, WINDOW) : null;
      return [hours, { dueAt, closesAt, missed: !!closesAt && stamp() > closesAt }];
    }));
    const entryId = createHash('sha256').update(`${channel.id}\0${normalized.identity}`).digest('hex');
    return { platform: normalized.platform, externalId: normalized.externalId, url: normalized.canonicalUrl, ...details, existingEntryId: store.get(KIND, entryId)?.id || null, checkpoints };
  }
  function lookup(user, input, options) { return tracked(options => lookupWork(user, input, options), options); }
  function registerVerified(user, input = {}, options) {
    // Clone before awaiting provider I/O; HTTP/body objects are not authority.
    const candidate = structuredClone(input);
    return tracked(async options => {
      const channel = lookupChannel(user, candidate.channelId), binding = channelBinding(channel);
      const verified = await lookupWork(user, candidate, options);
      if (stopped || options.signal?.aborted) throw fail('게시물 확인이 중간에 멈췄어요. 다시 시도해 주세요.', 503);
      options.authorize?.(); const live = lookupChannel(user, candidate.channelId);
      if (channelBinding(live) !== binding) throw fail('확인하는 사이 채널 연결이 바뀌었어요. 다시 시도해 주세요.', 409);
      const mustVerify = ['youtube', 'instagram'].includes(live.platform);
      if (mustVerify && verified.ownerMatch !== true) throw fail(verified.reason || '고른 계정에서 올린 게시물인지 확인하지 못했어요. 게시한 계정을 다시 골라 주세요.', 400);
      if (mustVerify && !verified.publishedAt) throw fail('플랫폼에서 게시 시각을 읽지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      const submitted = candidate.publishedAt ? iso(candidate.publishedAt, '게시 시각') : null;
      const adjusted = !!(mustVerify && submitted && Math.abs(Date.parse(submitted) - Date.parse(verified.publishedAt)) > 5 * 60000);
      options.authorize?.(); lookupChannel(user, candidate.channelId);
      const result = registerStored(user, { ...candidate, url: verified.url, ...(mustVerify ? { publishedAt: verified.publishedAt } : {}) }, mustVerify);
      return { ...result, ...(adjusted && result.entry.publishedAt === verified.publishedAt ? { publishedAtAdjusted: true } : {}) };
    }, options);
  }
  function accessEntry(user, id, write = false) {
    const row = store.get(KIND, id); if (!row) throw fail('게시 기록을 찾지 못했어요.', 404);
    channelFor(user, row.channelId, write); return row;
  }
  // 같은 채널·같은 형식(쇼츠·일반 영상·릴스)의 이전 기록과만 견준다 — 학습 카드와 같은 조건이다(10-20: 쇼츠를 긴 영상 중앙값과 견줘 +9900%가 나왔다).
  // ms는 한 조회 안에서 시각 문자열을 한 번만 해석하는 함수다(지표 × 이전 기록마다 다시 해석하면 기록이 늘수록 느려진다).
  function comparison(row, checkpoint, all, ms = Date.parse) {
    const format = row.publicationFormat || null;
    const points = all.filter(other => other.id !== row.id && other.channelId === row.channelId && (other.publicationFormat || null) === format && other.publishedAt < row.publishedAt)
      .map(other => other.checkpoints.find(item => item.hours === checkpoint.hours)).filter(Boolean);
    const prior = points.filter(item => item.status === 'recorded' && item.observedAt && ms(item.observedAt) <= ms(item.closesAt));
    return Object.fromEntries(metricIds.map(key => {
      const meta = checkpoint.metricProvenance?.[key], unit = definitionOf(key).unit, windowed = meta?.kind === 'window';
      // A window value is a platform recount of fixed dates: it is compared only with the same window kind and has no
      // observation-delay rule, whatever happened to the snapshot at that point.
      const currentValid = windowed ? windowDetail(meta) && meta.unit === unit : checkpoint.status === 'recorded' && meta && !meta.measurementWindowMissed;
      const offset = currentValid && !windowed ? ms(meta.observedAt) - ms(checkpoint.dueAt) : null;
      const values = currentValid ? (windowed ? points : prior).filter(item => {
        const previous = item.metricProvenance?.[key];
        if (windowed) return sameWindowKind(previous, meta);
        return previous && previous.kind !== 'window' && !previous.measurementWindowMissed && previous.unit === unit && previous.source === meta.source
          && Math.abs((ms(previous.observedAt) - ms(item.dueAt)) - offset) <= 15 * 60000;
      }).map(item => item.metrics?.[key]).filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b) : [];
      const middle = Math.floor(values.length / 2), median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null;
      const value = currentValid ? checkpoint.metrics[key] : null;
      return [key, { sampleCount: values.length, median, delta: value !== null && value !== undefined && median !== null ? value - median : null, deltaPercent: value !== null && value !== undefined && median > 0 ? Math.round((value - median) / median * 1000) / 10 : null }];
    }));
  }
  // The 72-hour point of a YouTube post always shows its window plan, stored or not yet attempted.
  function publicCheckpoint(row, checkpoint) {
    const safe = withoutLease(checkpoint), plan = windowPlan(row, checkpoint);
    return plan ? { ...safe, window: withoutLease(plan) } : safe;
  }
  function view(user, row, all = store.all(KIND), ms = Date.parse) {
    const channel = channelFor(user, row.channelId), writable = canWriteChannel(currentUser(user), channel);
    return { ...structuredClone(row), channelName: channel.displayName || channel.handle || channel.id, canEdit: writable,
      checkpoints: row.checkpoints.map(checkpoint => ({ ...structuredClone(publicCheckpoint(row, checkpoint)), comparison: comparison(row, checkpoint, all, ms) })) };
  }
  function list(user) {
    user = currentUser(user); const all = store.all(KIND);
    const channels = store.all('channels').filter(channel => channel.active !== false && canReadChannel(user, channel));
    const readable = new Set(channels.map(channel => channel.id));
    // comparison()은 같은 채널의 이전 기록만 본다. 채널별로 미리 묶어 「전체 기록 × 전체 기록」 계산을 피한다.
    const sameChannel = new Map(), parsed = new Map();
    for (const row of all) { if (!sameChannel.has(row.channelId)) sameChannel.set(row.channelId, []); sameChannel.get(row.channelId).push(row); }
    const ms = value => { let time = parsed.get(value); if (time === undefined) { time = Date.parse(value); parsed.set(value, time); } return time; };
    return { entries: all.filter(row => readable.has(row.channelId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(row => view(user, row, sameChannel.get(row.channelId), ms)),
      channels: channels.map(channel => ({ id: channel.id, platform: channel.platform, displayName: channel.displayName || channel.handle || channel.id, canEdit: canWriteChannel(user, channel), connected: isConnected(channel) })),
      canWrite: channels.some(channel => canWriteChannel(user, channel)), lookupAvailable: true, metricDefinitions: POST_PERFORMANCE_METRICS, checkpointHours: [24, 72], captureWindowHours: 6 };
  }
  // Readers that need only the observations (SNS insights, copy comparisons) skip comparison(), which compares every post with
  // its whole channel history (posts² work per call).
  function observations(user) {
    user = currentUser(user); const readable = new Set(store.all('channels').filter(channel => channel.active !== false && canReadChannel(user, channel)).map(channel => channel.id));
    return { entries: store.all(KIND).filter(row => readable.has(row.channelId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(row => ({ ...row, checkpoints: row.checkpoints.map(checkpoint => publicCheckpoint(row, checkpoint)) })),
      metricDefinitions: POST_PERFORMANCE_METRICS };
  }
  // Link checks need current source/permission only, not the full analytics
  // projection (which compares every post with its channel history).
  function linkSource(user, id) {
    user = currentUser(user);
    const row = store.get(KIND, id);
    if (!row || row.active === false) throw fail('볼 수 있는 게시 기록이 없어요.', 404);
    const channel = channelFor(user, row.channelId);
    return { id: row.id, url: row.url, canEdit: canWriteChannel(user, channel) };
  }
  function register(user, input = {}) { return registerStored(user, input); }
  function registerStored(user, input = {}, verified = false, auto = false) {
    const channel = channelFor(user, input.channelId, true), url = normalizePerformancePostUrl(input.url), at = stamp(), publishedAt = iso(input.publishedAt, '게시 시각');
    const publicationFormat=input.publicationFormat||null;
    if(publicationFormat&&!['youtube-shorts','youtube-video','instagram-reels'].includes(publicationFormat))throw fail('게시한 영상 형식은 쇼츠·일반 영상·릴스 중에서 골라 주세요.');
    if(publicationFormat&&(!input.publicationPackageId&&!verified||!publicationFormat.startsWith(channel.platform==='youtube'?'youtube-':channel.platform==='instagram'?'instagram-':'unsupported-')))throw fail('게시 묶음과 계정에 맞는 영상 형식을 골라 주세요.');
    if (url.platform !== channel.platform) throw fail('고른 계정과 게시물의 플랫폼이 달라요. 게시한 계정을 골라 주세요.');
    if (url.handle && channel.handle && url.handle.toLowerCase() !== channel.handle.toLowerCase()) throw fail('게시물 주소가 고른 계정의 것이 아니에요. 게시한 계정을 골라 주세요.');
    if (Date.parse(publishedAt) > Date.parse(at)) throw fail('게시 시각이 지금보다 늦어요. 이미 공개한 게시물만 기록할 수 있어요.');
    const id = createHash('sha256').update(`${channel.id}\0${url.identity}`).digest('hex');
    const result = store.transaction(() => {
      const previous = store.get(KIND, id);
      if(previous&&previous.origin==='auto'&&!auto){
        // 집계가 먼저 자동 등록한 기록은 워크스페이스 게시·직접 등록이 이어받는다. 관측 기록은 그대로 두고 묶음·형식·등록자만
        // 새 등록으로 바꾼다 — 영상 길이로 짐작한 형식은 게시 묶음이나 사람이 고른 형식에 진다.
        const { origin: _auto, ...kept } = previous;
        const adopted={...kept,publicationPackageId:cleanText(input.publicationPackageId,100)||null,publicationFormat:publicationFormat||previous.publicationFormat||null,...(verified&&!input.publicationPackageId?{origin:'external'}:{}),title:cleanText(input.title)||previous.title,createdBy:user.id,updatedAt:at};
        store.put(KIND,id,adopted);return {row:adopted,existing:true,linked:true};
      }
      if(previous){
        if(publicationFormat&&previous.publicationFormat&&previous.publicationFormat!==publicationFormat)throw fail('이 주소는 이미 다른 영상 형식으로 기록돼 있어요.',409);
        if(input.publicationPackageId&&previous.publicationPackageId&&previous.publicationPackageId!==input.publicationPackageId)throw fail('이 주소는 이미 다른 게시 묶음에 연결돼 있어요.',409);
        if(publicationFormat&&!previous.publicationFormat&&(!previous.publicationPackageId||previous.publicationPackageId===input.publicationPackageId)){
          const linked={...previous,publicationPackageId:input.publicationPackageId||previous.publicationPackageId||null,publicationFormat,...(verified&&!input.publicationPackageId&&!previous.publicationPackageId?{origin:'external'}:{}),updatedAt:at};
          store.put(KIND,id,linked);return {row:linked,existing:true,linked:true};
        }
        return {row:previous,existing:true};
      }
      if (store.all(KIND).filter(row => row.channelId === channel.id).length >= 2000) throw fail('이 계정의 게시 기록이 2,000개로 가득 찼어요.', 409);
      const row = { id, channelId: channel.id, platform: channel.platform, url: url.canonicalUrl, postIdentity: url.identity, title: cleanText(input.title), publicationPackageId: cleanText(input.publicationPackageId, 100) || null,
        publicationFormat, ...(auto?{origin:'auto'}:verified&&!input.publicationPackageId?{origin:'external'}:{}), publishedAt, active: true, createdAt: at, updatedAt: at, createdBy: user.id, checkpoints: [24, 72].map(hours => {
          const dueAt = atPlus(publishedAt, hours * HOUR), closesAt = atPlus(dueAt, WINDOW), missed = at > closesAt;
          return { hours, dueAt, closesAt, status: missed ? 'missed' : 'pending', timing: missed ? 'missed' : null, observedAt: null, recordedAt: null, delayMinutes: null, recordingDelayMinutes: null,
            metrics: emptyMetrics(), unavailableReasons: Object.fromEntries(metricIds.map(key => [key, '아직 못 받은 숫자예요. 0과는 달라요.'])), source: null, attempts: 0, nextAttemptAt: null, message: missed ? '게시 기록을 넣기 전에 모을 기간이 지나, 그때 숫자는 자동으로 받을 수 없어요. 본 값이 있으면 직접 넣어 주세요.' : null };
        }) };
      store.put(KIND, id, row); return { row, existing: false };
    });
    return { entry: view(user, result.row), existing: result.existing, ...(result.linked?{linked:true}:{}) };
  }
  function observation(checkpoint, values, { observedAt, recordedAt, source, note = '', unavailable = [], platform, manual = false, details = null, transient = false }) {
    const delayMinutes = Math.max(0, Math.round((Date.parse(observedAt) - Date.parse(checkpoint.dueAt)) / 60000));
    const normalized = valuesAndReasons(values, platform, { manual, unavailable, hours: checkpoint.hours, transient }), timing = delayMinutes > 15 ? 'late' : 'on-time', measurementWindowMissed = Date.parse(observedAt) > Date.parse(checkpoint.closesAt);
    const metricProvenance = Object.fromEntries(POST_PERFORMANCE_METRICS.filter(item => normalized.metrics[item.id] !== null).map(item => [item.id, { source, observedAt, recordedAt, unit: item.unit, timing, measurementWindowMissed, ...(manual ? {} : derivation(details?.[item.id])) }]));
    return keepWindowValues(checkpoint, { ...checkpoint, ...normalized, metricProvenance, status: 'recorded', timing, observedAt, recordedAt,
      delayMinutes, recordingDelayMinutes: Math.max(0, Math.round((Date.parse(recordedAt) - Date.parse(checkpoint.dueAt)) / 60000)), source, note,
      nextAttemptAt: null, lastErrorCode: null, measurementWindowMissed,
      message: manual ? '사람이 직접 보고 넣은 누적 숫자예요. 본 시각과 저장한 시각을 따로 남겨요.' : '서버가 이 시각에 읽은 누적 숫자예요. 목표 시각 그때의 값을 거슬러 구한 건 아니에요.' });
  }
  function manualCheckpoint(user, id, hours, input = {}) {
    hours = Number(hours); if (![24, 72].includes(hours)) throw fail('24시간과 72시간 중 하나를 골라 주세요.');
    const result = store.transaction(() => {
      const row = accessEntry(user, id, true), at = stamp(), checkpoint = row.checkpoints.find(item => item.hours === hours);
      const observedAt = input.measuredAt ? iso(input.measuredAt, '숫자를 확인한 시각') : at;
      if (observedAt > at || observedAt < checkpoint.dueAt) throw fail('숫자를 확인한 시각은 목표 시각과 지금 사이여야 해요.');
      if (checkpoint.status === 'collecting' && checkpoint.leaseUntil > at) throw fail('서버가 지금 이 숫자를 받는 중이에요. 잠시 뒤 다시 시도해 주세요.', 409);
      const values = valuesAndReasons(input.metrics, row.platform, { manual: true });
      if (!Object.values(values.metrics).some(value => value !== null)) throw fail('확인한 숫자를 하나 이상 넣어 주세요.');
      let updated;
      if (checkpoint.status === 'recorded') {
        const keys = metricIds.filter(key => values.metrics[key] !== null);
        if (keys.some(key => checkpoint.metrics[key] !== null && checkpoint.metrics[key] !== undefined)) throw fail('이미 기록한 숫자는 바꿀 수 없어요. 빈칸만 채워 주세요.', 409);
        const supplemental = observation(checkpoint, values.metrics, { observedAt, recordedAt: at, source: 'manual', note: cleanText(input.note, 1000), platform: row.platform, manual: true });
        const unavailableReasons = { ...checkpoint.unavailableReasons }; for (const key of keys) delete unavailableReasons[key];
        const supplement = { source: 'manual', observedAt, recordedAt: at, metrics: Object.fromEntries(keys.map(key => [key, values.metrics[key]])), note: supplemental.note };
        updated = { ...checkpoint, metrics: { ...checkpoint.metrics, ...supplement.metrics }, unavailableReasons,
          metricProvenance: { ...checkpoint.metricProvenance, ...supplemental.metricProvenance }, hasManualSupplement: true,
          supplements: [...(checkpoint.supplements || []), supplement], latestRecordedAt: at };
      } else {
        // Values a window report already filled count as recorded even while the snapshot itself is missing.
        if (metricIds.some(key => values.metrics[key] !== null && checkpoint.metricProvenance?.[key]?.kind === 'window' && checkpoint.metrics?.[key] !== null && checkpoint.metrics?.[key] !== undefined)) throw fail('이미 기록한 숫자는 바꿀 수 없어요. 빈칸만 채워 주세요.', 409);
        updated = observation(checkpoint, values.metrics, { observedAt, recordedAt: at, source: 'manual', note: cleanText(input.note, 1000), platform: row.platform, manual: true });
      }
      delete updated.leaseToken; delete updated.leaseUntil;
      const next = { ...row, updatedAt: at, checkpoints: row.checkpoints.map(item => item.hours === hours ? updated : item) };
      store.put(KIND, id, next); return next;
    });
    return { entry: view(user, result) };
  }
  function eligible(checkpoint, at) {
    return ['pending', 'retry', 'manual-required', 'collecting'].includes(checkpoint.status) && checkpoint.dueAt <= at && (!checkpoint.nextAttemptAt || checkpoint.nextAttemptAt <= at) && !(checkpoint.status === 'collecting' && checkpoint.leaseUntil > at);
  }
  function ownsAutomation(row, channel) {
    const user = store.get('users', row.createdBy); return channel?.active !== false && !!user && user.active !== false && canWriteChannel(user, channel);
  }
  function availability(channel) {
    if (PLATFORM_CAPABILITIES.find(item => item.id === channel?.platform)?.mode === 'manual') return '이 플랫폼은 숫자를 자동으로 모으지 못해요. 플랫폼 화면에서 본 숫자를 직접 넣어 주세요.';
    if (!channel || channel.active === false || !isConnected(channel)) return '이 계정이 플랫폼과 연결돼 있지 않아요. 연결하거나 숫자를 직접 넣어 주세요.';
    return null;
  }
  function setActive(user, id, active) {
    if (typeof active !== 'boolean') throw fail('자동 수집을 켤지 멈출지 골라 주세요.');
    const next = store.transaction(() => {
      const row = accessEntry(user, id, true), updated = { ...row, active, updatedAt: stamp() };
      store.put(KIND, id, updated); return updated;
    });
    return { entry: view(user, next) };
  }
  // 크롬·앱에서 바로 올린 게시물도 워크스페이스 게시와 같은 24·72시간 관측을 받게 한다(10-20). 채널 집계가 이미 저장한
  // 공개 게시물만 읽으므로 이 단계는 SNS를 부르지 않는다. 등록자는 첫 활성 관리자(서버 예약 수집과 같은 주체)다.
  function discover() {
    const summary = { registered: 0, skipped: 0 };
    if (!autoTrack || stopped) return summary;
    const actor = store.all('users').find(user => user.role === 'admin' && user.active !== false);
    if (!actor) return summary;
    const at = stamp(), now = Date.parse(at), since = now - AUTO_TRACK_WINDOW;
    const channels = new Map(store.all('channels').filter(channel => channel.active !== false && channel.hidden !== true && AUTO_TRACK_PLATFORMS.has(channel.platform) && isConnected(channel)).map(channel => [channel.id, channel]));
    if (!channels.size) return summary;
    const known = new Set(store.all(KIND).map(row => row.id));
    const fresh = store.all('posts').filter(post => {
      const published = Date.parse(post.publishedAt);
      return channels.has(post.channelId) && String(post.source || '').startsWith('api:') && !post.unavailableAt && !(post.expiresAt && Date.parse(post.expiresAt) <= now)
        && Number.isFinite(published) && published > since && published <= now;
    }).sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt));
    for (const post of fresh) {
      if (summary.registered >= AUTO_TRACK_BATCH) break;
      const channel = channels.get(post.channelId);
      let url; try { url = normalizePerformancePostUrl(post.url); } catch { summary.skipped++; continue; }
      // Facebook 피드 글은 워크스페이스 게시가 다른 주소 모양으로 등록할 수 있어 영상·릴스만 자동으로 올린다.
      if (url.platform !== channel.platform || channel.platform === 'facebook' && !url.externalId.startsWith('video:')) { summary.skipped++; continue; }
      if (known.has(createHash('sha256').update(`${channel.id}\0${url.identity}`).digest('hex'))) continue;
      const format = FORMAT_PLATFORM[post.publicationFormat] === channel.platform ? post.publicationFormat : null;
      try {
        const { entry } = registerStored(actor, { channelId: channel.id, url: post.url, publishedAt: post.publishedAt, title: post.title, ...(format ? { publicationFormat: format } : {}) }, true, true);
        known.add(entry.id); summary.registered++;
      } catch { summary.skipped++; }
    }
    return summary;
  }
  async function collectDueWork({ user = null, entryId = null, signal, authorize } = {}) {
    authorize?.();
    if (entryId) accessEntry(user, entryId, true);
    // 서버 예약 회차에서만 새 게시물을 찾아 올린다. 사람이 누른 「지금 확인」은 고른 기록만 다룬다.
    const discovered = !user && !entryId ? discover() : null;
    const requester = user ? currentUser(user) : null;
    const summary = { checked: 0, recorded: 0, manualRequired: 0, missed: 0, retried: 0, skipped: 0, windowChecked: 0, windowRecorded: 0, windowRetried: 0, windowUnavailable: 0, autoRegistered: discovered?.registered || 0 };
    const initial = stamp(), due = row => row.checkpoints.some(checkpoint => eligible(checkpoint, initial) || windowEligible(windowPlan(row, checkpoint), initial));
    const candidateChannels = [...new Set(store.all(KIND).filter(row => row.active !== false && (!entryId || row.id === entryId) && (!requester || canWriteChannel(requester, store.get('channels', row.channelId))) && due(row)).map(row => row.channelId))].slice(0, 20);
    for (const channelId of candidateChannels) {
      if (signal?.aborted) break;
      authorize?.();
      const token = randomUUID(), claim = store.transaction(() => {
        const at = stamp(), lock = store.get(LOCKS, channelId); if (lock?.leaseUntil > at) return null;
        const channel = store.get('channels', channelId), selected = [], windows = [];
        if (requester) channelFor(requester, channelId, true);
        for (const row of store.all(KIND).filter(row => row.active !== false && row.channelId === channelId && (!entryId || row.id === entryId))) {
          let changed = false;
          const checkpoints = row.checkpoints.map(checkpoint => {
            let next = checkpoint;
            if (eligible(checkpoint, at)) {
              summary.checked++; changed = true;
              const unavailable = at > checkpoint.closesAt ? null : !ownsAutomation(row, channel) ? '이 기록을 만든 사람이 지금 이 계정을 맡고 있지 않아 자동으로 받지 않아요. 지금 맡은 사람이 숫자를 직접 넣을 수 있어요.' : availability(channel);
              if (at > checkpoint.closesAt) { summary.missed++; next = { ...checkpoint, status: 'missed', timing: 'missed', nextAttemptAt: null, message: '모을 기간(목표 시각부터 6시간)이 지나 이 시점 숫자는 자동으로 채울 수 없어요. 본 값이 있으면 직접 넣어 주세요.' }; }
              else if (unavailable) { summary.manualRequired++; next = { ...checkpoint, status: 'manual-required', nextAttemptAt: atPlus(at, HOUR), message: unavailable }; }
              else {
                selected.push({ id: row.id, hours: checkpoint.hours });
                next = { ...checkpoint, status: 'collecting', attempts: checkpoint.attempts + 1, attemptedAt: at, leaseToken: token, leaseUntil: atPlus(at, LEASE), nextAttemptAt: null };
              }
            }
            const plan = windowPlan(row, next);
            if (windowEligible(plan, at) && windows.length < WINDOW_BATCH) {
              summary.windowChecked++; changed = true;
              const opened = withoutLease(plan), videoId = youtubeVideoId(row);
              const unavailable = !videoId ? null : !ownsAutomation(row, channel) ? '이 기록을 만든 사람이 지금 이 계정을 맡고 있지 않아 받지 못했어요. 그 사람이 다시 맡으면 다음 확인 때 받아요.' : availability(channel);
              if (opened.closesAt && at > opened.closesAt || !videoId) { summary.windowUnavailable++; next = { ...next, window: { ...opened, status: 'unavailable', nextAttemptAt: null, message: videoId ? '처음 확인한 뒤 72시간이 지나 늦게 반영되는 숫자는 더 확인하지 않아요. YouTube 스튜디오에서 본 값은 직접 넣을 수 있어요.' : '게시 주소로 영상을 찾지 못해 늦게 반영되는 숫자는 받지 않아요.' } }; }
              else if (unavailable) { const waited = windowWait(opened, at, 'CONNECTION_REQUIRED', unavailable); summary[waited.status === 'retry' ? 'windowRetried' : 'windowUnavailable']++; next = { ...next, window: waited }; }
              else {
                windows.push({ id: row.id, externalId: videoId, startDate: opened.startDate, endDate: opened.endDate });
                next = { ...next, window: { ...opened, status: 'collecting', attempts: (opened.attempts || 0) + 1, attemptedAt: at, leaseToken: token, leaseUntil: atPlus(at, LEASE), nextAttemptAt: null } };
              }
            }
            return next;
          });
          if (changed) store.put(KIND, row.id, { ...row, updatedAt: at, checkpoints });
        }
        if (!selected.length && !windows.length) return null;
        store.put(LOCKS, channelId, { id: channelId, token, leaseUntil: atPlus(at, LEASE) });
        return { channel, selected, windows, version: channel.connectionVersion || 0, at };
      });
      if (!claim) { summary.skipped++; continue; }
      let result = null, error = null, windowResult = null, windowError = null, timeout = null;
      try {
        const credentials = await getCredentials(claim.channel), live = store.get('channels', channelId);
        authorize?.();
        if (live?.active === false || (live?.connectionVersion || 0) !== claim.version || availability(live)) throw Object.assign(new Error(), { code: 'CONNECTION_CHANGED' });
        timeout = AbortSignal.timeout(collectTimeoutMs); const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
        if (claim.selected.length) {
          try {
            const oldest = Math.min(...claim.selected.map(item => Date.parse(store.get(KIND, item.id).publishedAt)));
            result = await collector(live, credentials, { signal: combined, recentSince: new Date(oldest - HOUR).toISOString(), now: stamp(), maxPosts: 100, maxPages: 3 });
          } catch (caught) { error = failureOf(caught); }
        }
        if (claim.windows.length) {
          try { windowResult = await readWindows(live, credentials, { signal: combined, videos: claim.windows.map(({ externalId, startDate, endDate }) => ({ externalId, startDate, endDate })) }); }
          catch (caught) { windowError = failureOf(caught); }
        }
      } catch (caught) { error = windowError = failureOf(caught); }
      let authorizationLost = false;
      try { authorize?.(); if (requester) channelFor(requester, channelId, true); } catch { authorizationLost = true; }
      // 자체 2분 제한이 끝난 것은 취소가 아니라 시간 초과다. 관측 기간 안에서 다시 확인한다(10-20: 재시도 없이 직접 입력으로 넘어갔다).
      const timedOut = failure => failure?.code === 'CANCELLED' && !signal?.aborted && timeout?.aborted ? { code: 'TIMEOUT', retryable: true } : failure;
      error = timedOut(error); windowError = timedOut(windowError);
      if (signal?.aborted) error = windowError = { code: 'CANCELLED', retryable: true };
      store.transaction(() => {
        const at = stamp(), lock = store.get(LOCKS, channelId), live = store.get('channels', channelId);
        if (lock?.token !== token) { summary.skipped++; return; }
        const connectionChanged = !live || live.active === false || (live.connectionVersion || 0) !== claim.version || availability(live);
        for (const selected of claim.selected) {
          const row = store.get(KIND, selected.id), checkpoint = row?.checkpoints.find(item => item.hours === selected.hours);
          if (!row || checkpoint?.leaseToken !== token || checkpoint.status !== 'collecting') continue;
          let next;
          if (authorizationLost || row.active === false || connectionChanged || !ownsAutomation(row, live)) {
            next = { ...checkpoint, status: 'manual-required', nextAttemptAt: atPlus(at, HOUR), message: '받는 사이 채널 연결이나 담당 권한이 바뀌어 받은 숫자를 저장하지 않았어요. 한 시간 뒤 다시 확인해요.' }; summary.manualRequired++;
          } else if (at > checkpoint.closesAt || lock.leaseUntil < at) {
            next = { ...checkpoint, status: 'missed', timing: 'missed', nextAttemptAt: null, message: '모을 기간 안에 받기를 끝내지 못해 이 시점 숫자는 기록하지 않았어요. 본 값이 있으면 직접 넣어 주세요.' }; summary.missed++;
          } else {
            const post = result?.posts?.find(item => { try { return normalizePerformancePostUrl(item.url).identity === row.postIdentity; } catch { return false; } });
            const published = post?.publishedAt && Date.parse(post.publishedAt), mismatch = !!post && (!Number.isFinite(published) || Math.abs(published - Date.parse(row.publishedAt)) > 5 * 60000);
            const hasMetric = post && Object.values(valuesAndReasons(post.metrics, row.platform).metrics).some(value => value !== null);
            // 인사이트·Analytics의 일시 오류(한도·시간 초과·연결)로 지원 지표가 비었으면 바로 확정하지 않는다. 관측 기간 안에서 몇 번 더 본 뒤
            // 마지막 기회에만 있는 값으로 기록한다(10-20: 일시 오류 한 번이 조회·도달·공유·저장 없이 기록을 끝냈다). 늦게 반영되는 지표(laggedMetrics)는
            // 이 지점에 기록하지 않아 빈 칸으로 보지 않고, 응답에 칸이 없는 지표(릴스가 아닌 게시물의 릴스 지표)도 보지 않는다.
            const capability = capabilityOf(row.platform), lagged = new Set(capability?.laggedMetrics || []);
            const gapMetrics = new Set([...(capability?.metrics || []), ...(capability?.postMetrics || [])].filter(key => !lagged.has(key)));
            const gap = !error && post && !mismatch && hasMetric && !!result.coverage?.collectionError && metricIds.some(key => gapMetrics.has(key) && post.metrics?.[key] === null);
            const lastChance = checkpoint.attempts >= GAP_ATTEMPTS || Date.parse(at) + GAP_LAST_CHANCE >= Date.parse(checkpoint.closesAt);
            if (!error && post && !mismatch && hasMetric && (!gap || lastChance)) {
              next = observation(checkpoint, post.metrics, { observedAt: at, recordedAt: at, source: `api:${cleanText(result.coverage?.source || row.platform, 80)}`, unavailable: gap ? [] : result.coverage?.unavailableMetrics || [], platform: row.platform, details: post.metricDetails, transient: gap });
              next.providerPublishedAt = post.publishedAt; summary.recorded++;
            } else if (gap) {
              const delay = (checkpoint.attempts === 1 ? 5 : checkpoint.attempts === 2 ? 15 : 30) * 60000;
              next = { ...checkpoint, status: 'retry', nextAttemptAt: new Date(Math.min(Date.parse(at) + delay, Date.parse(checkpoint.closesAt) - 10 * 60000)).toISOString(), lastErrorCode: String(result.coverage.collectionError.code || 'METRICS_PARTIAL').slice(0, 40),
                message: '플랫폼 일시 오류로 일부 숫자를 받지 못했어요. 모을 기간 안에 몇 번 더 받아 볼게요.' };
              summary.retried++;
            } else {
              const retryable = !mismatch && (!error || error.retryable), retry = retryable && at < checkpoint.closesAt;
              const delay = (checkpoint.attempts === 1 ? 5 : checkpoint.attempts === 2 ? 15 : 30) * 60000;
              next = { ...checkpoint, status: retry ? 'retry' : 'manual-required', nextAttemptAt: retry ? new Date(Math.min(Date.parse(at) + delay, Date.parse(checkpoint.closesAt))).toISOString() : at < checkpoint.closesAt ? checkpoint.closesAt : atPlus(checkpoint.closesAt, 1), lastErrorCode: mismatch ? 'PUBLISHED_AT_MISMATCH' : error?.code || (post ? 'METRICS_UNAVAILABLE' : 'POST_NOT_IN_RESPONSE'),
                message: mismatch ? '플랫폼의 게시 시각이 기록한 시각과 5분 넘게 달라 자동으로 기록하지 않았어요. 플랫폼 화면에서 본 숫자를 직접 넣어 주세요.' : retry ? '이 게시물 숫자를 받지 못했어요. 모을 기간이 끝날 때까지 몇 번 더 받아 볼게요.' : '이 게시물 숫자를 자동으로 받지 못했어요. 플랫폼 화면에서 본 숫자를 직접 넣어 주세요.' };
              if (retry) summary.retried++; else summary.manualRequired++;
            }
          }
          delete next.leaseToken; delete next.leaseUntil;
          store.put(KIND, row.id, { ...row, updatedAt: at, checkpoints: row.checkpoints.map(item => item.hours === selected.hours ? next : item) });
        }
        for (const selected of claim.windows) {
          const row = store.get(KIND, selected.id), checkpoint = row?.checkpoints.find(item => item.hours === 72), plan = checkpoint?.window;
          if (!row || plan?.leaseToken !== token || plan.status !== 'collecting') continue;
          const open = withoutLease(plan);
          let next;
          if (authorizationLost || row.active === false || connectionChanged || !ownsAutomation(row, live)) {
            next = { ...checkpoint, window: windowWait(open, at, 'CONNECTION_CHANGED', '받는 사이 채널 연결이나 담당 권한이 바뀌어 저장하지 않았어요. 다음 확인 때 다시 받아요.') };
          } else {
            const video = !windowError && windowResult?.videos?.find(item => item?.externalId === selected.externalId && item.startDate === open.startDate && item.endDate === open.endDate);
            if (video?.status === 'ready') next = applyWindow(checkpoint, open, video, { at, source: `api:${cleanText(windowResult.source || 'youtube-analytics-api-v2', 80)}` });
            else if (windowError && WINDOW_WAIT_CODES.has(windowError.code)) next = { ...checkpoint, window: windowWait(open, at, windowError.code, WINDOW_WAIT_MESSAGES[windowError.code] || '채널 연결이 없거나 바뀌어 받지 못했어요. 채널을 다시 연결해 주세요. 6시간마다 다시 확인해요.') };
            else if (windowError) next = { ...checkpoint, window: windowRetry(open, at, { code: windowError.code, retryable: windowError.retryable, message: 'YouTube Analytics에서 숫자를 받지 못했어요.' }) };
            else next = { ...checkpoint, window: windowRetry(open, at, video?.status === 'error'
              ? { code: 'REPORT_REJECTED', message: 'YouTube Analytics가 이 영상의 숫자 요청을 받지 않았어요.' }
              : { code: 'WINDOW_NOT_READY', message: `YouTube Analytics에 ${open.startDate}~${open.endDate}(태평양시) 숫자가 아직 없어요. 집계가 늦어지는 중일 수 있어요.` }) };
          }
          summary[next.window.status === 'recorded' ? 'windowRecorded' : next.window.status === 'retry' ? 'windowRetried' : 'windowUnavailable']++;
          store.put(KIND, row.id, { ...row, updatedAt: at, checkpoints: row.checkpoints.map(item => item.hours === 72 ? next : item) });
        }
        store.remove(LOCKS, channelId);
      });
      if (authorizationLost) throw fail('그사이 로그인 권한이 바뀌어 받은 결과를 저장하지 않았어요. 다시 로그인해 주세요.', 401);
    }
    return summary;
  }
  function tracked(work, options = {}) {
    if (stopped) return Promise.reject(fail('서버가 꺼지는 중이에요. 잠시 뒤 다시 시도해 주세요.', 503));
    const controller = new AbortController(); controllers.add(controller);
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const job = work({ ...options, signal }); activeJobs.add(job);
    job.then(() => { activeJobs.delete(job); controllers.delete(controller); }, () => { activeJobs.delete(job); controllers.delete(controller); });
    return job;
  }
  function collectDue(options = {}) { return tracked(collectDueWork, options); }
  const waitForIdle = async () => { await Promise.allSettled([...activeJobs]); };
  const stop = async () => { stopped = true; for (const controller of controllers) controller.abort(); await waitForIdle(); };
  return { register, registerVerified, lookup, list, observations, linkSource, manualCheckpoint, collectDue, setActive, waitForIdle, stop };
}
