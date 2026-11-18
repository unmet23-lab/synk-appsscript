import {instagramIdentity} from './meta-connection.mjs';

/**
 * Read-only SNS collectors. Only fixed official API origins are fetched.
 * Values are lifetime snapshots taken now, not historical daily analytics.
 * An unavailable metric is null; an actual API value of zero remains zero.
 */

// metrics are the channel collection metrics shown on the connection screen. postMetrics exist only for
// post performance checkpoints. laggedMetrics come from daily YouTube Analytics reports that fill in days
// later, so a checkpoint never records them as that moment's value (the 72-hour point uses a window report).
export const PLATFORM_CAPABILITIES = Object.freeze([
  { id: 'youtube', label: 'YouTube', mode: 'api-key', metrics: ['followers', 'views', 'likes', 'comments', 'shares'], postMetrics: ['averageWatchSeconds', 'averageViewPct', 'subscribersGained', 'subscribersLost'], laggedMetrics: ['shares', 'averageWatchSeconds', 'averageViewPct', 'subscribersGained', 'subscribersLost'], requirements: '관리자의 공개 통계 키로 공개 수치를 모으거나, 채널 주인의 Google 계정을 연결해요. 공유 수는 주인의 YouTube 분석 권한이 더 있어야 해요. 저장·도달은 받을 수 없어요.', docsUrl: 'https://developers.google.com/youtube/v3/docs/channels/list' },
  { id: 'instagram', label: 'Instagram', mode: 'oauth', metrics: ['followers', 'views', 'likes', 'comments', 'shares', 'saves', 'reach'], postMetrics: ['earlyRetention3sPct', 'averageWatchSeconds'], requirements: 'Instagram 프로페셔널 계정으로 로그인하고 인사이트를 볼 권한을 허락해야 해요. 콘텐츠 종류마다 받는 수치가 달라요.', docsUrl: 'https://developers.facebook.com/docs/instagram-platform/insights/' },
  { id: 'facebook', label: 'Facebook', mode: 'oauth', metrics: ['followers', 'views', 'likes', 'comments', 'shares'], requirements: '관리하는 Facebook 페이지로 연결해요. 토큰으로 직접 연결할 때는 페이지 토큰과 페이지 번호가 있어야 해요. 개인 프로필은 안 돼요. 조회수는 영상·릴스에만 있어요.', docsUrl: 'https://developers.facebook.com/docs/pages-api/' },
  { id: 'tiktok', label: 'TikTok', mode: 'oauth', metrics: ['followers', 'views', 'likes', 'comments', 'shares'], requirements: '승인받은 TikTok 앱과, 그 계정의 기본 정보·프로필·통계·영상 목록 권한(user.info.basic·user.info.profile·user.info.stats·video.list)이 있어야 해요.', docsUrl: 'https://developers.tiktok.com/doc/tiktok-api-v2-video-list/' },
  { id: 'threads', label: 'Threads', mode: 'manual', metrics: [], requirements: '주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.', docsUrl: 'https://developers.facebook.com/docs/threads/' },
  { id: 'x', label: 'X', mode: 'manual', metrics: [], requirements: '주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.', docsUrl: 'https://docs.x.com/x-api' },
  { id: 'linkedin', label: 'LinkedIn', mode: 'manual', metrics: [], requirements: '회사 페이지 주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.', docsUrl: 'https://learn.microsoft.com/en-us/linkedin/' },
  { id: 'douyin', label: 'Douyin', mode: 'manual', metrics: [], requirements: '주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.', docsUrl: 'https://developer.open-douyin.com/' },
  { id: 'vk', label: 'VK', mode: 'manual', metrics: [], requirements: '주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.', docsUrl: 'https://dev.vk.com/' },
  { id: 'xiaohongshu', label: 'Xiaohongshu', mode: 'manual', metrics: [], requirements: '주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.', docsUrl: 'https://open.xiaohongshu.com/' },
]);

export class CollectorError extends Error {
  constructor(code, message, { retryable = false, status = null, reason = null } = {}) {
    super(message);
    this.name = 'CollectorError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.reason = reason;
  }
}

const invalid = () => new CollectorError('INVALID_CHANNEL_URL', '지원하는 SNS의 채널·페이지 주소를 넣어 주세요. 게시물 주소나 줄인 주소는 안 돼요.');
const RESERVED = new Set(['accounts', 'explore', 'reel', 'reels', 'p', 'stories', 'direct', 'about', 'login', 'signup', 'home', 'watch', 'search', 'share', 'settings', 'help', 'privacy', 'terms', 'i']);

/** Parse only known SNS profile URLs. Never request an input URL or short link. */
export function normalizeChannelUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || !input.trim() || /[\\\u0000-\u0020]/u.test(input.trim())) throw invalid();
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`); } catch { throw invalid(); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && url.port !== '443')) throw invalid();
  const host = url.hostname.toLowerCase();
  if (/%(?:2f|5c|00)/i.test(url.pathname)) throw invalid();
  let path;
  try { path = decodeURIComponent(url.pathname).replace(/\/+$/, ''); } catch { throw invalid(); }
  const finish = (platform, canonicalUrl, { externalId = null, handle = null } = {}) => ({ platform, canonicalUrl, externalId, handle, label: handle || externalId || platform });
  let match;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if ((match = path.match(/^\/channel\/(UC[A-Za-z\d_-]{22})(?:\/(?:videos|shorts|streams|featured|about))?$/))) return finish('youtube', `https://www.youtube.com/channel/${match[1]}`, { externalId: match[1] });
    if ((match = path.match(/^\/@([\p{L}\p{N}_.·-]{1,100})(?:\/(?:videos|shorts|streams|featured|about))?$/u))) return finish('youtube', `https://www.youtube.com/@${encodeURIComponent(match[1])}`, { handle: match[1] });
    throw invalid();
  }
  if (['instagram.com', 'www.instagram.com'].includes(host)) {
    if ((match = path.match(/^\/([A-Za-z\d_.]{1,30})$/)) && !RESERVED.has(match[1].toLowerCase())) return finish('instagram', `https://www.instagram.com/${match[1].toLowerCase()}/`, { handle: match[1].toLowerCase() });
    throw invalid();
  }
  if (['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'].includes(host)) {
    if (path === '/profile.php' && /^\d{1,30}$/.test(url.searchParams.get('id') || '')) return finish('facebook', `https://www.facebook.com/profile.php?id=${url.searchParams.get('id')}`, { externalId: url.searchParams.get('id') });
    if ((match = path.match(/^\/pages\/[^/]+\/(\d{1,30})$/))) return finish('facebook', `https://www.facebook.com/profile.php?id=${match[1]}`, { externalId: match[1] });
    if ((match = path.match(/^\/([A-Za-z\d_.-]{1,100})$/)) && !RESERVED.has(match[1].toLowerCase()) && match[1] !== 'profile.php') return finish('facebook', `https://www.facebook.com/${match[1].toLowerCase()}`, { externalId: /^\d+$/.test(match[1]) ? match[1] : null, handle: /^\d+$/.test(match[1]) ? null : match[1].toLowerCase() });
    throw invalid();
  }
  if (['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'].includes(host)) {
    if ((match = path.match(/^\/@([A-Za-z\d_.]{1,30})$/))) return finish('tiktok', `https://www.tiktok.com/@${match[1].toLowerCase()}`, { handle: match[1].toLowerCase() });
    throw invalid();
  }
  if (['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'].includes(host) && (match = path.match(/^\/@([A-Za-z\d_.]{1,30})$/))) return finish('threads', `https://www.threads.com/@${match[1].toLowerCase()}`, { handle: match[1].toLowerCase() });
  if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(host) && (match = path.match(/^\/([A-Za-z\d_]{1,15})$/)) && !RESERVED.has(match[1].toLowerCase())) return finish('x', `https://x.com/${match[1].toLowerCase()}`, { handle: match[1].toLowerCase() });
  if (['linkedin.com', 'www.linkedin.com'].includes(host) && (match = path.match(/^\/company\/([A-Za-z\d_-]{1,100})$/))) return finish('linkedin', `https://www.linkedin.com/company/${match[1].toLowerCase()}/`, { handle: match[1].toLowerCase() });
  if (['douyin.com', 'www.douyin.com'].includes(host) && (match = path.match(/^\/user\/([A-Za-z\d_-]{1,200})$/))) return finish('douyin', `https://www.douyin.com/user/${match[1]}`, { externalId: match[1] });
  if (['vk.com', 'www.vk.com', 'vk.ru', 'www.vk.ru'].includes(host) && (match = path.match(/^\/([A-Za-z\d_.-]{1,100})$/)) && !RESERVED.has(match[1].toLowerCase())) return finish('vk', `https://vk.com/${match[1].toLowerCase()}`, { handle: match[1].toLowerCase() });
  if (['xiaohongshu.com', 'www.xiaohongshu.com'].includes(host) && (match = path.match(/^\/user\/profile\/([A-Za-z\d]{1,100})$/))) return finish('xiaohongshu', `https://www.xiaohongshu.com/user/profile/${match[1]}`, { externalId: match[1] });
  throw invalid();
}

const METRIC_NAMES = ['views', 'likes', 'comments', 'shares', 'saves', 'reach'];
const number = value => value === null || value === undefined || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
const metrics = values => Object.fromEntries(METRIC_NAMES.map(key => [key, number(values?.[key])]));
const text = value => typeof value === 'string' ? value : '';
const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } };
const isoDate = value => { if (value === null || value === undefined || value === '') return null; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toISOString() : null; };
const required = (credentials, key, description) => {
  if (!credentials || typeof credentials[key] !== 'string' || !credentials[key].trim()) throw new CollectorError('CONNECTION_REQUIRED', description);
  return credentials[key].trim();
};
// 게시 성과의 「같은 계정·형식」 비교에 쓰는 형식. 「게시 주소로 추가」의 판정(post-performance-lookup.mjs)과 같은 규칙이다.
const youtubeFormat = duration => {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(typeof duration === 'string' ? duration : '');
  const seconds = match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : null;
  return seconds !== null && seconds > 0 && seconds <= 180 ? 'youtube-shorts' : seconds !== null ? 'youtube-video' : null;
};
const limits = credentials => {
  const validate = (value, fallback) => value === undefined ? fallback : Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
  const maxPosts = validate(credentials.maxPosts, 10000);
  const maxPages = validate(credentials.maxPages, 1000);
  if (maxPosts === null || maxPages === null) throw new CollectorError('INVALID_CONFIG', '수집 한도는 1 이상의 정수로 입력해 주세요.');
  return { maxPosts, maxPages };
};
// The frequent poll is deliberately bounded. Full daily collection keeps its
// existing limits; a recent poll must never silently claim full history coverage.
function recentWindow(options, credentials) {
  if (options.recentSince === undefined) return null;
  const since = isoDate(options.recentSince), until = isoDate(options.now ?? new Date().toISOString());
  if (!since || !until || Date.parse(since) > Date.parse(until)) throw new CollectorError('INVALID_CONFIG', '최근 수집 기간을 확인해 주세요.');
  const configured = limits(credentials);
  const bounded = (value, fallback, ceiling) => {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new CollectorError('INVALID_CONFIG', '최근 수집 한도는 1 이상의 정수로 입력해 주세요.');
    return Math.min(Number(value), ceiling);
  };
  return { since, until, sinceMs: Date.parse(since), untilMs: Date.parse(until),
    maxPosts: Math.min(configured.maxPosts, bounded(options.maxPosts, 100, 100)),
    maxPages: Math.min(configured.maxPages, bounded(options.maxPages, 3, 3)),
    excludedOutsideWindow: 0, invalidDates: 0, uncertainOrder: false,
    insightsRequested: 0, insightsSkipped: 0, maxInsights: 25, collectionError: null };
}
function recentDate(value, recent) {
  if (!recent) return true;
  const date = isoDate(value);
  if (!date) { recent.invalidDates++; return false; }
  const stamp = Date.parse(date);
  if (stamp < recent.sinceMs || stamp > recent.untilMs) { recent.excludedOutsideWindow++; return false; }
  return true;
}
function oldPage(entries, dateOf, recent) {
  return !!recent && entries.length > 0 && entries.every(entry => {
    const date = isoDate(dateOf(entry));
    return date !== null && Date.parse(date) < recent.sinceMs;
  });
}
function optionalFailure(error, recent, independentPermission=false) {
  // A denied optional Insights/Analytics edge does not revoke a successful
  // identity + media/statistics read. Rate limits still pause all polling.
  if(independentPermission&&error.code==='AUTH_REQUIRED')return;
  if (recent && ['RATE_LIMITED', 'AUTH_REQUIRED', 'TIMEOUT', 'NETWORK_ERROR'].includes(error.code)) {
    recent.collectionError = { code: error.code, status: error.status ?? null, retryable: error.retryable === true };
  }
}
function recentResult(collected, recent) {
  if (!recent) return collected;
  const warnings = [...collected.warnings, '최근 수집은 정한 기간에 올린 콘텐츠만 보고, 반응 수치는 수집한 때까지의 누적이에요.'];
  if (recent.uncertainOrder) warnings.push('목록이 게시일 순서인지 알 수 없어 오래된 콘텐츠만 나온 곳에서 멈췄어요. 최근 콘텐츠를 다 본 건 아니에요.');
  if (recent.invalidDates) warnings.push(`게시일을 알 수 없는 콘텐츠 ${recent.invalidDates}개는 최근 콘텐츠에서 뺐어요.`);
  if (recent.insightsSkipped) warnings.push(`최근 인사이트 요청 한도(${recent.maxInsights}개)나 조회 오류 때문에 콘텐츠 ${recent.insightsSkipped}개의 수치 일부를 받지 못했어요.`);
  const partial = collected.coverage.status !== 'complete' || recent.uncertainOrder || recent.invalidDates > 0 || recent.insightsSkipped > 0;
  return { ...collected, warnings, coverage: { ...collected.coverage, scope: 'recent', status: partial ? 'partial' : 'complete',
    limitations: warnings, ...(recent.collectionError ? { collectionError: recent.collectionError } : {}),
    recent: { since: recent.since, until: recent.until, maxPosts: recent.maxPosts, maxPages: recent.maxPages,
      complete: !partial, excludedOutsideWindow: recent.excludedOutsideWindow, invalidDates: recent.invalidDates,
      uncertainOrder: recent.uncertainOrder, insightsRequested: recent.insightsRequested, insightsSkipped: recent.insightsSkipped, maxInsights: recent.maxInsights } } };
}
const mismatch = () => new CollectorError('ACCOUNT_MISMATCH', '연결한 계정과 등록한 페이지 주소가 달라요. 이 페이지를 관리하는 계정으로 다시 연결해 주세요.');
const apiOrigins = new Set(['https://www.googleapis.com', 'https://youtubeanalytics.googleapis.com', 'https://graph.instagram.com', 'https://graph.facebook.com', 'https://open.tiktokapis.com']);

function apiError(status, apiCode, transient = false, apiMessage = null) {
  const codes = String(apiCode || '').toLowerCase();
  // YouTube는 한도를 403 + 이유(rateLimitExceeded·userRateLimitExceeded·dailyLimitExceeded·quotaExceeded)로, Meta는 4·17·32·613과
  // 업무별 한도 800xx로 알린다. 이것을 인증 오류로 읽으면 「재연결 필요」로 자동 수집이 멈춘다(10-20).
  // 341은 Meta의 앱 한도(「Application limit reached」)다(11-19 검수 GA3).
  if (status === 429 || ['4', '17', '32', '341', '613'].includes(codes) || /^800\d\d$/.test(codes) || /quota|rate.?limit|too.?many|limit.?exceeded/.test(codes)) return new CollectorError('RATE_LIMITED', '플랫폼 호출 한도에 걸렸어요. 적어도 24시간 뒤에 다시 시도해요.', { retryable: true, status });
  if (status === 401 || status === 403 || ['102', '190', '200'].includes(codes) || /access.token|access_token|unauthor|permission|oauth|scope/.test(codes)) return new CollectorError('AUTH_REQUIRED', '연결이 만료됐거나 권한이 모자라요. 채널 카드에서 계정을 다시 연결해 주세요.', { status });
  if (status === 404) return new CollectorError('CHANNEL_NOT_FOUND', '플랫폼에서 이 채널이나 콘텐츠를 찾지 못했어요. 주소가 맞는지 봐 주세요.', { status, reason: apiCode === 'playlistNotFound' ? 'playlistNotFound' : null });
  // Meta는 일시 오류에 is_transient:true를 붙인다. 영구 오류로 굳히지 않고 재시도한다.
  // Meta 100의 오류 글이 우리가 더해 묻는 칸 이름(published · post_id)을 낱말로 담을 때만 그 칸 이름을 남긴다. 칸을 빼고 다시 묻는 곳이
  // 권한 · 한도 · 칸과 무관한 100으로 되풀이 묻지 않게 한다(11-19 검수 GA3 · 다시 GA4 · 셋째 GA3). 문장 전체가 아니라 칸 이름만 보는 것은
  // Meta가 문구를 바꿔도 영상 목록을 잃지 않게 하려는 것이다(설계 검토). 오류 글 자체는 싣지 않는다(토큰 · 주소가 들 수 있다).
  const field = codes === '100' && typeof apiMessage === 'string' ? apiMessage.match(/\b(published|post_id)\b/)?.[1] : null;
  return new CollectorError('API_ERROR', '플랫폼이 수집 요청을 처리하지 못했어요. 연결과 플랫폼 상태를 봐 주세요.', { retryable: status >= 500 || transient, status, reason: field ? `nonexistingField:${field}` : null });
}

function makeRequester({ fetchImpl, signal }) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    if (!apiOrigins.has(parsed.origin) || parsed.username || parsed.password) throw new CollectorError('INVALID_API_TARGET', '허용되지 않은 수집 주소입니다.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new CollectorError('CANCELLED', '수집을 취소했어요.');
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    timer.unref?.();
    try {
      const response = await fetchImpl(parsed.href, { ...options, redirect: 'error', signal: controller.signal });
      let data;
      // 본문을 받다가 끊기거나 시간이 다 되면 일시 오류다. 형식이 틀린 본문도 다음 회차에 다시 읽는다(영구 오류로 굳히지 않음).
      try { data = await response.json(); } catch {
        if (signal?.aborted) throw new CollectorError('CANCELLED', '수집을 취소했어요.');
        if (timedOut) throw new CollectorError('TIMEOUT', '플랫폼이 제때 답하지 않았어요. 잠시 뒤에 다시 수집해 주세요.', { retryable: true });
        throw new CollectorError('INVALID_RESPONSE', '플랫폼 응답을 읽지 못했어요.', { retryable: true, status: response.status });
      }
      const code = data?.error?.errors?.[0]?.reason ?? data?.error?.code ?? data?.error_code;
      if (!response.ok || (data?.error && code !== undefined && code !== 'ok' && code !== 0)) throw apiError(response.status, code, data?.error?.is_transient === true, data?.error?.message);
      return data;
    } catch (error) {
      if (error instanceof CollectorError) throw error;
      if (signal?.aborted) throw new CollectorError('CANCELLED', '수집을 취소했어요.');
      if (timedOut) throw new CollectorError('TIMEOUT', '플랫폼이 제때 답하지 않았어요. 잠시 뒤에 다시 수집해 주세요.', { retryable: true });
      // Never include the thrown message/cause: fetch errors can contain tokens or URLs.
      throw new CollectorError('NETWORK_ERROR', '플랫폼에 연결하지 못했어요. 잠시 뒤에 다시 수집해 주세요.', { retryable: true });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}

function endpoint(origin, path, params = {}) {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  return url;
}
function result(channel, posts, { warnings = [], partial = false, hasMore = false, unavailable = [], source, pages = 0, omitted = 0, ownerAuthorized = false, metricPeriods = {} } = {}) {
  return { channel, posts, warnings: [...new Set(warnings)], coverage: {
    status: partial || hasMore || omitted ? 'partial' : 'complete', postsFetched: posts.length, hasMore, pagesFetched: pages,
    inventoryComplete: !hasMore&&!omitted,
    omittedPosts: omitted, limitations: [...new Set(warnings)], unavailableMetrics: unavailable,
    source, ownerAuthorized, period: 'lifetime', metricPeriods, observedAt: new Date().toISOString(),
  } };
}
function capWarning(cap) { return `한 번에 모으는 한도(콘텐츠 ${cap.maxPosts.toLocaleString('ko-KR')}개나 목록 ${cap.maxPages.toLocaleString('ko-KR')}쪽)에 닿아 일부 콘텐츠만 모았어요.`; }

// reports.query accepts these scopes. A token without a recorded scope is tried and the API decides.
const ANALYTICS_SCOPES = ['youtube', 'youtube.readonly', 'youtubepartner', 'yt-analytics-monetary.readonly', 'yt-analytics.readonly'].map(scope => `https://www.googleapis.com/auth/${scope}`);
const youtubeAnalyticsScope = credentials => !credentials.scope || String(credentials.scope).split(/[\s,]+/).some(scope => ANALYTICS_SCOPES.includes(scope));

async function youtube(channel, credentials, request, recent) {
  const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
  const publicOnly=credentials.publicOnly===true;
  const apiKey = accessToken ? undefined : required(credentials, 'apiKey', 'YouTube 계정을 연결하거나, 관리자에게 공개 통계 키를 넣어 달라고 해 주세요.');
  const cap = recent || limits(credentials);
  const api = (path, params) => request(endpoint('https://www.googleapis.com', `/youtube/v3/${path}`, { ...params, key: apiKey }), accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {});
  const response = await api('channels', { part: 'snippet,statistics,contentDetails', ...(channel.externalId ? { id: channel.externalId } : { forHandle: channel.handle }) });
  const item = response.items?.[0];
  if (!item?.id) throw new CollectorError('CHANNEL_NOT_FOUND', 'YouTube에서 이 채널을 찾지 못했어요. 주소가 맞는지 봐 주세요.');
  if (channel.externalId && item.id !== channel.externalId) throw mismatch();
  if (accessToken&&!publicOnly) {
    const mine = await api('channels', { part: 'id', mine: true, maxResults: 50 });
    if (!mine.items?.some(owned => owned.id === item.id) || (credentials.accountId && credentials.accountId !== item.id)) throw mismatch();
  }
  const warnings = ['YouTube는 저장·도달 수치를 주지 않아요.', 'YouTube 구독자 수는 반올림된 값일 수 있어요.', '삭제·비공개 콘텐츠 때문에 채널 전체 조회수와 모은 콘텐츠 조회수 합이 다를 수 있어요.'];
  const ids = new Set();
  let token;
  let pages = 0;
  let hasMore = false;
  let omitted = 0;
  const seenTokens = new Set();
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  if (uploads) {
    do {
      let list;
      try { list = await api('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: 50, pageToken: token }); }
      catch (error) {
        // A verified empty channel may not have an uploads playlist yet. Other missing resources and unknown counts remain errors.
        if (pages === 0 && number(item.statistics?.videoCount) === 0 && error.code === 'CHANNEL_NOT_FOUND' && error.status === 404 && error.reason === 'playlistNotFound') {
          warnings.push('공개 영상이 0개이고 업로드 목록이 아직 없어 채널 수치만 기록했어요.');
          break;
        }
        throw error;
      }
      pages++;
      if (!Array.isArray(list.items)) throw new CollectorError('INVALID_RESPONSE', 'YouTube 콘텐츠 목록을 받지 못했어요.');
      for (const entry of list.items) {
        const id = entry.contentDetails?.videoId;
        if (typeof id !== 'string' || !/^[A-Za-z\d_-]{11}$/.test(id)) { omitted++; continue; }
        // videoPublishedAt is the video publication date, not playlist insertion.
        // Missing dates are resolved by videos.list below before filtering.
        if (recent && isoDate(entry.contentDetails?.videoPublishedAt) && !recentDate(entry.contentDetails.videoPublishedAt, recent)) continue;
        if (ids.size < cap.maxPosts) ids.add(id); else if (!ids.has(id)) hasMore = true;
      }
      token = list.nextPageToken;
      if (token && oldPage(list.items, entry => entry.contentDetails?.videoPublishedAt, recent)) { recent.uncertainOrder = true; hasMore = true; break; }
      if (token && seenTokens.has(token)) { hasMore = true; warnings.push('플랫폼이 같은 목록을 되풀이해 보내서 더 모으지 않고 멈췄어요.'); break; }
      if (token) seenTokens.add(token);
      if ((ids.size >= cap.maxPosts || pages >= cap.maxPages) && token) hasMore = true;
      if (hasMore) { warnings.push(capWarning(cap)); break; }
    } while (token);
  } else if (number(item.statistics?.videoCount) > 0) {
    warnings.push('업로드 목록을 받지 못해 채널 수치만 모았어요.');
    hasMore = true;
  }
  const posts = [];
  const allIds = [...ids];
  for (let offset = 0; offset < allIds.length; offset += 50) {
    const batch = allIds.slice(offset, offset + 50);
    // contentDetails(영상 길이)는 같은 요청에 붙고 할당량을 더 쓰지 않는다.
    const videos = await api('videos', { part: 'snippet,statistics,status,contentDetails', id: batch.join(','), maxResults: 50 });
    if (!Array.isArray(videos.items)) throw new CollectorError('INVALID_RESPONSE', 'YouTube 콘텐츠 수치를 받지 못했어요.');
    const returned = new Set();
    for (const video of videos.items) {
      if (!batch.includes(video.id) || returned.has(video.id)) continue;
      returned.add(video.id);
      if(publicOnly&&video.status?.privacyStatus!=='public')continue;
      if(video.status?.privacyStatus&&video.status.privacyStatus!=='public')continue;
      if (video.snippet?.channelId && video.snippet.channelId !== item.id) { omitted++; continue; }
      if (!recentDate(video.snippet?.publishedAt, recent)) continue;
      posts.push({ externalId: video.id, url: `https://www.youtube.com/watch?v=${video.id}`, title: text(video.snippet?.title), publishedAt: isoDate(video.snippet?.publishedAt), thumbnailUrl: safeUrl(video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url), publicationFormat: youtubeFormat(video.contentDetails?.duration), metrics: metrics({ views: video.statistics?.viewCount, likes: video.statistics?.likeCount, comments: video.statistics?.commentCount }) });
    }
    omitted += batch.filter(id => !returned.has(id)).length;
  }
  if (omitted) warnings.push(`삭제·비공개이거나 플랫폼이 수치를 주지 않는 콘텐츠 ${omitted}개는 상세 수치에서 뺐어요.`);
  if (item.statistics?.hiddenSubscriberCount) warnings.push('이 채널은 구독자 수를 숨겨 두었어요.');
  const unavailable = ['saves', 'reach'];
  const metricPeriods = {};
  let analyticsPartial = false;
  // Channel ownership is verified above.
  const analyticsAllowed = youtubeAnalyticsScope(credentials);
  if (accessToken && !publicOnly && analyticsAllowed && posts.length) {
    const endDate = new Date().toISOString().slice(0, 10);
    try {
      for (let offset = 0; offset < posts.length; offset += 200) {
        const batch = posts.slice(offset, offset + 200);
        // Basic user-activity reports allow a multi-value video filter to also be
        // a dimension. A singleton uses the ordinary undimensioned basic report.
        // This is not the top-videos report, which has historical row restrictions.
        const analytics = await request(endpoint('https://youtubeanalytics.googleapis.com', '/v2/reports', { ids: `channel==${item.id}`, startDate: '2005-01-01', endDate, metrics: 'shares', dimensions: batch.length > 1 ? 'video' : undefined, filters: `video==${batch.map(post => post.externalId).join(',')}`, maxResults: 200 }), { headers: { Authorization: `Bearer ${accessToken}` } });
        const videoColumn = analytics.columnHeaders?.findIndex(header => header.name === 'video');
        const shareColumn = analytics.columnHeaders?.findIndex(header => header.name === 'shares');
        if (!(shareColumn >= 0 && (batch.length === 1 || videoColumn >= 0)) || (analytics.rows !== undefined && !Array.isArray(analytics.rows))) throw new CollectorError('INVALID_RESPONSE', 'YouTube 분석 수치를 받지 못했어요.');
        const values = new Map((analytics.rows || []).map(row => [batch.length === 1 ? batch[0].externalId : row[videoColumn], number(row[shareColumn])]));
        for (const post of batch) post.metrics.shares = values.get(post.externalId) ?? null;
      }
      metricPeriods.shares = { source: 'youtube-analytics-api-v2', startDate: '2005-01-01', requestedEndDate: endDate, lagged: true };
      warnings.push('공유 수는 YouTube 분석이 주는 누적값이라 최근 며칠이 늦게 들어올 수 있어요. 분석에 없는 콘텐츠는 비워 둬요.');
    } catch (error) {
      if (error.code === 'CANCELLED') throw error;
      optionalFailure(error, recent, true);
      analyticsPartial = true;
      warnings.push('YouTube 분석의 공유 수를 다 받지 못했어요. 채널 주인 계정으로 분석 권한을 허락했는지 봐 주세요.');
    }
    if (!posts.some(post => post.metrics.shares !== null)) unavailable.push('shares');
  } else {
    unavailable.push('shares');
    if (!accessToken||publicOnly||!analyticsAllowed) warnings.push('공개 통계 키로는 공유 수를 받을 수 없어요. 채널 주인 계정으로 연결하고 YouTube 분석 권한을 허락해야 해요.');
  }
  return result({ externalId: item.id, displayName: text(item.snippet?.title) || channel.handle || item.id, followers: item.statistics?.hiddenSubscriberCount ? null : number(item.statistics?.subscriberCount), views: number(item.statistics?.viewCount), metrics: { posts: number(item.statistics?.videoCount) } }, posts, { warnings, hasMore, omitted, pages, partial: analyticsPartial, ownerAuthorized: Boolean(accessToken)&&!publicOnly, metricPeriods, source: 'youtube-data-api-v3', unavailable });
}

async function tiktok(channel, credentials, request, recent) {
  const accessToken = required(credentials, 'accessToken', '이 TikTok 계정을 「계정 연결」로 연결해 주세요.');
  const cap = recent || limits(credentials);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const userData = await request(endpoint('https://open.tiktokapis.com', '/v2/user/info/', { fields: 'open_id,display_name,username,profile_deep_link,follower_count,following_count,likes_count,video_count' }), { headers });
  const user = userData.data?.user;
  if (!user?.open_id || !user?.username) throw new CollectorError('AUTH_REQUIRED', 'TikTok 프로필을 볼 권한(user.info.profile)이 없어요. 권한을 허락하고 다시 연결해 주세요.');
  if (user.username.toLowerCase() !== channel.handle?.toLowerCase() || (credentials.accountId && credentials.accountId !== user.open_id)) throw mismatch();
  const posts = [];
  const seen = new Set();
  const cursors = new Set();
  let cursor;
  let pages = 0;
  let hasMore = false;
  const warnings = ['TikTok은 저장·도달 수치를 주지 않아요.', '공개 동영상의 누적 수치만 모아요. 지난 날짜의 일별 수치는 거슬러 채우지 않아요.'];
  do {
    const response = await request(endpoint('https://open.tiktokapis.com', '/v2/video/list/', { fields: 'id,create_time,title,video_description,share_url,cover_image_url,like_count,comment_count,share_count,view_count' }), { method: 'POST', headers, body: JSON.stringify({ max_count: Math.min(20, cap.maxPosts - posts.length), ...(cursor !== undefined ? { cursor } : {}) }) });
    pages++;
    const data = response.data;
    if (!data || !Array.isArray(data.videos)) throw new CollectorError('INVALID_RESPONSE', 'TikTok 동영상 목록을 받지 못했어요.');
    for (const video of data.videos) {
      if (!video.id || seen.has(String(video.id))) continue;
      seen.add(String(video.id));
      if (!recentDate(number(video.create_time) === null ? null : Number(video.create_time) * 1000, recent)) continue;
      if (posts.length >= cap.maxPosts) { hasMore = true; continue; }
      posts.push({ externalId: String(video.id), url: safeUrl(video.share_url) || `https://www.tiktok.com/@${channel.handle}/video/${encodeURIComponent(video.id)}`, title: text(video.title || video.video_description), publishedAt: number(video.create_time) === null ? null : isoDate(Number(video.create_time) * 1000), thumbnailUrl: safeUrl(video.cover_image_url), metrics: metrics({ views: video.view_count, likes: video.like_count, comments: video.comment_count, shares: video.share_count }) });
    }
    hasMore ||= data.has_more === true;
    // TikTok documents create_time descending order for this endpoint.
    if (oldPage(data.videos, video => number(video.create_time) === null ? null : Number(video.create_time) * 1000, recent)) { hasMore = false; break; }
    if (!data.has_more) break;
    cursor = data.cursor;
    if (cursor === undefined || cursors.has(String(cursor))) { warnings.push('플랫폼이 다음 목록을 주지 않거나 같은 목록을 되풀이해 보내서 멈췄어요.'); hasMore = true; break; }
    cursors.add(String(cursor));
    if (posts.length >= cap.maxPosts || pages >= cap.maxPages) { warnings.push(capWarning(cap)); break; }
    hasMore = false;
  } while (true);
  return result({ externalId: String(user.open_id), displayName: text(user.display_name) || user.username, followers: number(user.follower_count), views: null, metrics: { likes: number(user.likes_count), posts: number(user.video_count) } }, posts, { warnings, hasMore, pages, ownerAuthorized: true, source: 'tiktok-display-api-v2', unavailable: ['saves', 'reach', 'channel.views'] });
}

function graphConfig(credentials, instagramLogin = false) {
  const apiVersion = credentials.apiVersion || 'v26.0';
  if (!/^v\d{1,2}\.\d{1,2}$/.test(apiVersion)) throw new CollectorError('INVALID_CONFIG', 'Meta 연결 버전 형식이 맞지 않아요. 비워 두면 기본 버전을 써요.');
  const origin = instagramLogin ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
  return { apiVersion, origin };
}
const graphId = value => {
  if (typeof value !== 'string' || !/^\d{1,50}$/.test(value)) throw new CollectorError('INVALID_CONFIG', '계정 번호는 숫자로만 넣어 주세요.');
  return value;
};

async function graphList(path, params, api, cap, recent = null, dateOf = () => null) {
  const entries = [];
  const ids = new Set();
  const cursors = new Set();
  const warnings = [];
  let after;
  let pages = 0;
  let hasMore = false;
  do {
    const response = await api(path, { ...params, limit: Math.min(100, cap.maxPosts - entries.length), after });
    pages++;
    if (!Array.isArray(response.data)) throw new CollectorError('INVALID_RESPONSE', '플랫폼 콘텐츠 목록을 받지 못했어요.');
    for (const entry of response.data) {
      if (!entry.id || ids.has(String(entry.id))) continue;
      ids.add(String(entry.id));
      if (!recentDate(dateOf(entry), recent)) continue;
      if (entries.length < cap.maxPosts) entries.push(entry); else hasMore = true;
    }
    if (!response.paging?.next) break;
    hasMore = true;
    if (oldPage(response.data, dateOf, recent)) { recent.uncertainOrder = true; break; }
    after = response.paging?.cursors?.after;
    if (!after || cursors.has(String(after))) { warnings.push('플랫폼이 다음 목록을 주지 않거나 같은 목록을 되풀이해 보내서 멈췄어요.'); break; }
    cursors.add(String(after));
    if (entries.length >= cap.maxPosts || pages >= cap.maxPages) { warnings.push(capWarning(cap)); break; }
    hasMore = false;
  } while (true);
  return { entries, pages, hasMore, warnings };
}

function insightValue(response, name) {
  const item = response.data?.find(entry => entry.name === name);
  if (item?.total_value && 'value' in item.total_value) return number(item.total_value.value);
  return item?.values?.length === 1 ? number(item.values[0].value) : null;
}

// 3-second retention is 100 − Meta's estimated skip rate; average watch time is milliseconds turned into
// seconds. The original metric, value and unit stay in metricDetails so a wrong unit can be recomputed.
function reelMetrics(values) {
  const skip = values.reels_skip_rate, watch = values.ig_reels_avg_watch_time;
  const retention = skip !== null && skip <= 100 ? Math.round((100 - skip) * 100) / 100 : null;
  const seconds = watch !== null ? Math.round(watch) / 1000 : null;
  const details = {};
  if (retention !== null) details.earlyRetention3sPct = { derivedFrom: 'reels_skip_rate', rawValue: skip, rawUnit: 'percent', estimated: true };
  if (seconds !== null) details.averageWatchSeconds = { derivedFrom: 'ig_reels_avg_watch_time', rawValue: watch, rawUnit: 'milliseconds' };
  return { metrics: { earlyRetention3sPct: retention, averageWatchSeconds: seconds }, details };
}

async function instagram(channel, credentials, request, recent) {
  const accessToken = required(credentials, 'accessToken', '이 Instagram 프로페셔널 계정을 「계정 연결」로 연결해 주세요.');
  const direct = credentials.authType === 'instagram-login' || credentials.loginType === 'instagram';
  const config = graphConfig(credentials, direct);
  const cap = recent || limits(credentials);
  const api = (path, params) => request(endpoint(config.origin, `/${config.apiVersion}/${path}`, params), { headers: { Authorization: `Bearer ${accessToken}` } });
  const accountId = direct ? 'me' : graphId(required(credentials, 'accountId', '연결할 Instagram 프로페셔널 계정 번호가 필요해요.'));
  const user = await api(accountId, { fields: (direct?'id,user_id':'id')+',username,name,followers_count,media_count' });
  if (!user?.id || !user?.username) throw new CollectorError('AUTH_REQUIRED', 'Instagram 프로페셔널 계정 정보를 받지 못했어요. 권한을 허락했는지 봐 주세요.');
  const identity=direct?instagramIdentity(user,{requireUserId:credentials.metaIdentityVersion===1}):{id:String(user.id),appScopedId:null};
  if (user.username.toLowerCase() !== channel.handle?.toLowerCase() || (credentials.accountId && credentials.accountId !== identity.id && credentials.accountId !== identity.appScopedId)) throw mismatch();
  const resolvedId = graphId(identity.id);
  const list = await graphList(`${resolvedId}/media`, { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,like_count,comments_count' }, api, cap, recent, media => media.timestamp);
  const warnings = [...list.warnings, 'Instagram은 프로페셔널 계정으로 바꾼 때, 콘텐츠 종류, 보관 기간에 따라 빠지는 수치가 있어요.', '콘텐츠별 도달에는 겹치는 사람이 있어 더해도 채널 전체 도달이 되지 않아요.'];
  let missingInsights = 0;
  const insightsAllowed=!credentials.permissionsVerifiedAt||String(credentials.scope||'').split(/[ ,]+/).includes(direct?'instagram_business_manage_insights':'instagram_manage_insights');
  let haltInsights = !insightsAllowed;
  const posts = [];
  const metricNames = ['views', 'reach', 'shares', 'saved'];
  // Reels only. reels_skip_rate is a percentage that Meta marks estimated and in development; the unit of
  // ig_reels_avg_watch_time is not documented and is read as milliseconds (raw value kept in metricDetails).
  const reelMetricNames = ['reels_skip_rate', 'ig_reels_avg_watch_time'];
  let reelMetricsRejected = false;
  for (const media of list.entries) {
    if (!/^\d{1,50}$/.test(String(media.id))) { missingInsights++; continue; }
    const values = { views: null, reach: null, shares: null, saved: null };
    const reel = media.media_product_type === 'REELS', reelValues = { reels_skip_rate: null, ig_reels_avg_watch_time: null };
    if (!haltInsights && (!recent || recent.insightsRequested < recent.maxInsights)) {
      try {
        if (recent) recent.insightsRequested++;
        const withReel = reel && !reelMetricsRejected;
        let combined;
        try { combined = await api(`${media.id}/insights`, { metric: [...metricNames, ...(withReel ? reelMetricNames : [])].join(',') }); }
        catch (error) {
          // An unsupported-query 400 may come from the reel-only metrics alone: ask once more for the basic
          // metrics. Only when those alone are accepted are reel metrics skipped for the rest of this collection.
          if (!withReel || error.code !== 'API_ERROR' || error.status !== 400) throw error;
          combined = await api(`${media.id}/insights`, { metric: metricNames.join(',') });
          reelMetricsRejected = true;
        }
        for (const name of metricNames) values[name] = insightValue(combined, name);
        if (withReel && !reelMetricsRejected) for (const name of reelMetricNames) reelValues[name] = insightValue(combined, name);
      } catch (error) {
        if (error.code === 'CANCELLED') throw error;
        optionalFailure(error, recent, true);
        if (!recent && error.code === 'API_ERROR' && error.status === 400) {
          // Different media types support different metrics; probe independently only
          // for the explicit unsupported-query response, never for token/rate errors.
          for (const name of metricNames) {
            try { values[name] = insightValue(await api(`${media.id}/insights`, { metric: name }), name); }
            catch (individual) {
              if (individual.code === 'CANCELLED') throw individual;
              if (individual.code !== 'API_ERROR' || individual.status !== 400) { haltInsights = true; break; }
            }
          }
        } else if (error.code !== 'API_ERROR' || error.status !== 400) haltInsights = true;
      }
    } else if (recent) recent.insightsSkipped++;
    if (metricNames.some(name => values[name] === null)) missingInsights++;
    const post = { externalId: String(media.id), url: safeUrl(media.permalink), title: text(media.caption), publishedAt: isoDate(media.timestamp), thumbnailUrl: safeUrl(media.thumbnail_url), publicationFormat: reel ? 'instagram-reels' : null, metrics: metrics({ views: values.views, likes: media.like_count, comments: media.comments_count, shares: values.shares, saves: values.saved, reach: values.reach }) };
    if (reel) {
      const extra = reelMetrics(reelValues);
      Object.assign(post.metrics, extra.metrics);
      if (Object.keys(extra.details).length) post.metricDetails = extra.details;
    }
    posts.push(post);
  }
  if (missingInsights) warnings.push(`콘텐츠 ${missingInsights}개는 인사이트 일부를 받지 못해 그 수치를 비워 뒀어요.`);
  if (reelMetricsRejected) warnings.push('플랫폼이 릴스 건너뛴 비율·평균 시청 시간 요청을 받지 않아 이번에는 두 수치를 비워 뒀어요.');
  if (haltInsights) warnings.push('권한·한도·연결 문제로 인사이트를 더 요청하지 않고 멈췄어요.');
  const unavailable = ['channel.views', ...METRIC_NAMES.filter(name => posts.length && posts.every(post => post.metrics[name] === null))];
  return result({ externalId: resolvedId, displayName: text(user.name) || user.username, followers: number(user.followers_count), views: null, metrics: { posts: number(user.media_count) } }, posts, { warnings, hasMore: list.hasMore, pages: list.pages, partial: missingInsights > 0, ownerAuthorized: true, source: direct ? 'instagram-login-api' : 'instagram-facebook-login-api', unavailable });
}

function facebookMatches(channel, page) {
  if (channel.externalId) return channel.externalId === String(page.id);
  if (page.username && text(page.username).toLowerCase() === channel.handle) return true;
  try {
    const linked = normalizeChannelUrl(page.link);
    return linked.platform === 'facebook' && linked.handle && linked.handle === channel.handle;
  } catch { return false; }
}

async function facebook(channel, credentials, request, recent) {
  const originalToken = required(credentials, 'accessToken', '이 Facebook 페이지를 「계정 연결」로 연결해 주세요.');
  const config = graphConfig(credentials);
  const cap = recent || limits(credentials);
  let accessToken = originalToken;
  const api = (path, params) => request(endpoint(config.origin, `/${config.apiVersion}/${path}`, params), { headers: { Authorization: `Bearer ${accessToken}` } });
  let page;
  if (credentials.authType === 'facebook-user') {
    const managed = await graphList('me/accounts', { fields: 'id,name,username,link,access_token' }, api, { maxPosts: 10000, maxPages: cap.maxPages });
    page = managed.entries.find(candidate => facebookMatches(channel, candidate) && (!credentials.accountId || String(candidate.id) === credentials.accountId));
    if (!page?.access_token) throw new CollectorError('ACCOUNT_MISMATCH', managed.hasMore ? '관리하는 페이지 목록을 다 받지 못해 이 페이지 권한을 확인하지 못했어요.' : '등록한 페이지를 관리하는 Facebook 계정으로 연결해 주세요. 숫자 페이지 번호가 든 주소로 등록해도 돼요.');
    accessToken = page.access_token;
  }
  page = await api('me', { fields: 'id,name,username,link,fan_count,followers_count' });
  if (!page?.id || !facebookMatches(channel, page) || (credentials.accountId && credentials.accountId !== String(page.id))) throw mismatch();
  const pageId = graphId(String(page.id));
  // 같은 게시물을 잇는 열쇠 둘(11-19 설계 검토 B · 설계 검토 2).
  // - pagePostId: 페이지 게시물 번호(「페이지번호_게시물번호」). 게시결과에는 이 번호가 적힌다. /posts는 id가 그 꼴이고, /videos에서만 찾은 릴스는
  //   영상의 post_id로 채운다. post_id는 Graph API Video 참조(v19.0)에 "identifier of the post this video belongs to"로 적힌 칸이다.
  //   이 페이지의 번호만 쓴다 — 숫자만 오면 이 페이지 번호를 붙이고, 다른 페이지 번호가 붙은 값은 버린다.
  // - videoId: /videos 항목으로 확인한 영상 번호. 영상 목록만의 줄과 영상과 짝지은 게시물 줄에만 단다(첨부 대상 번호만으로는 달지 않는다).
  // 영상 목록에서만 찾은 릴스는 pagePostId를 알면 externalId도 그 번호다. 서버는 두 열쇠로 같은 게시물의 저장 줄을 찾아 잇는다.
  const fullPostId = value => typeof value === 'string' && /^\d{1,50}_\d{1,50}$/.test(value) ? value : null;
  const videoPostId = value => typeof value !== 'string' ? null : /^\d{1,50}$/.test(value) ? `${pageId}_${value}` : value.startsWith(`${pageId}_`) ? fullPostId(value) : null;
  // 주소 정체성은 게시 성과(normalizePerformancePostUrl)의 페이스북 규칙과 같다 — 영상(/reel/번호 · /이름/videos/번호 · /watch?v=번호)과 게시물(/이름/posts/번호).
  // 그 모듈이 이 모듈을 가져오므로 여기서는 같은 규칙을 따로 둔다.
  const addressKey = value => { try { const u = new URL(value), path = u.pathname.replace(/\/+$/, ''); let m;
    if ((m = path.match(/^\/reel\/(\d{3,40})$/)) || (m = path.match(/^\/[\w.-]{1,100}\/videos\/(\d{3,40})$/))) return `video:${m[1]}`;
    if (path === '/watch' && /^\d{3,40}$/.test(u.searchParams.get('v') || '')) return `video:${u.searchParams.get('v')}`;
    if ((m = path.match(/^\/([\w.-]{1,100})\/posts\/([\w]{3,200})$/))) return `post:${m[1].toLowerCase()}:${m[2]}`;
    return u.href; } catch { return null; } };
  // 게시물 주소가 릴스 · 영상 주소면 그 게시물의 영상 번호다(첨부 대상 번호와 달리 주소가 그 영상을 가리킨다 — 6회차 자체 불변식 시험: 목록에 그 영상이 빠진
  // 회차에도 게시물 줄의 영상이 바뀌지 않는다).
  const reelOf = value => { const key = addressKey(safeUrl(value)) || ''; return key.startsWith('video:') ? key.slice(6) : null; };
  const list = await graphList(`${pageId}/posts`, { fields: 'id,message,created_time,permalink_url,attachments{target},shares,reactions.type(LIKE).limit(0).summary(true),comments.limit(0).summary(true)' }, api, cap, recent, post => post.created_time);
  const posts = list.entries.map(post => ({ externalId: String(post.id), url: safeUrl(post.permalink_url), title: text(post.message), publishedAt: isoDate(post.created_time), thumbnailUrl: null, pagePostId: fullPostId(String(post.id)), videoId: reelOf(post.permalink_url), ...(reelOf(post.permalink_url) ? { videoHeldBy: 'address' } : {}), metrics: metrics({ likes: post.reactions?.summary?.total_count, comments: post.comments?.summary?.total_count, shares: post.shares?.count }) }));
  const warnings = [...list.warnings, 'Facebook은 영상 조회수와 게시물 좋아요를 받은 그대로 적어요. 일반 게시물 조회수·저장·도달과 받지 못한 공유 수는 비워 둬요.'];
  let videosPartial=false,hasMore=list.hasMore,pages=list.pages,videoPostIds=null;
  const videoId=url=>{try{const u=new URL(url,'https://www.facebook.com');return u.searchParams.get('v')||u.pathname.match(/\/(?:reel|videos)\/(\d+)/)?.[1]||null;}catch{return null;}};
  // addressed: 게시물 주소(permalink)가 가리키는 영상 번호 → 그 게시물 줄. 첨부 대상으로만 짝지은 것과 가른다(설계 검토 3 조건 2).
  // targets: 게시물 줄마다 첨부 대상 번호들. 첨부 대상이 있는 게시물은 그 영상만 차지한다(6회차 자체 불변식 시험).
  const known=new Map(),addressed=new Map(),targets=new Map();list.entries.forEach((p,i)=>{known.set(String(p.id),posts[i]);for(const attachment of p.attachments?.data||[])if(attachment.target?.id){known.set(String(attachment.target.id),posts[i]);(targets.get(posts[i])||targets.set(posts[i],new Set()).get(posts[i])).add(String(attachment.target.id));}});
  // 게시물 주소가 가리키는 영상은 다른 게시물의 첨부 대상보다 앞선다 — 목록 순서로 덮어쓰지 않는다(6회차 자체 불변식 시험).
  list.entries.forEach((p,i)=>{const id=videoId(p.permalink_url);if(id){known.set(id,posts[i]);addressed.set(id,posts[i]);}});
  if(posts.length<cap.maxPosts&&pages<cap.maxPages){
    try{
      // /videos에는 예약·초안처럼 아직 공개하지 않은 영상(published:false)도 업로드 시각으로 나온다. 게시물로 세면 집계와 성과 자동 등록이
      // 공개 전 시각으로 잡히고, 예약 릴스는 공개 때 다른 번호로 나와 그 번호는 끝내 목록에서 사라진다(10-31 운영: 페이스북 SYNK의 놓친 관측 전부).
      // 공개 여부(published)나 페이지 게시물 번호(post_id) 칸을 Meta가 받지 않으면(첫 요청의 400 · 코드 100, 오류 글에 그 칸 이름) 그 칸만 빼고
      // 다시 받고, 그렇다고 적는다. 권한 · 한도 · 칸과 무관한 400은 다시 묻지 않는다.
      const videoFields='id,title,description,created_time,permalink_url,views,likes.limit(0).summary(true),comments.limit(0).summary(true)',videoCap={...cap,maxPosts:cap.maxPosts-posts.length,maxPages:cap.maxPages-pages};
      let videos,wanted=['published','post_id'],unpublished=0,numberless=0,unreadable=0;
      for(;;){
        let calls=0;const counted=(path,params)=>{calls++;return api(path,params);};
        try{videos=await graphList(`${pageId}/videos`,{fields:[videoFields,...wanted].join(',')},counted,videoCap,recent,v=>v.created_time);break;}
        catch(error){
          // 칸 거절은 첫 요청에서 난다. Meta가 「없는 칸」으로 가리킨 칸이 더 받으려던 칸일 때만 그 칸을 빼고 다시 묻는다. 칸마다 한 번이라 많아야 두 번 더 묻는다.
          const field=error.code==='API_ERROR'&&error.status===400&&calls===1&&typeof error.reason==='string'&&error.reason.startsWith('nonexistingField:')?error.reason.slice('nonexistingField:'.length):null;
          if(!field||!wanted.includes(field))throw error;
          wanted=wanted.filter(name=>name!==field);
        }
      }
      const publishedKnown=wanted.includes('published'),postIdKnown=wanted.includes('post_id');
      hasMore=hasMore||videos.hasMore;pages+=videos.pages;warnings.push(...videos.warnings);
      if(!publishedKnown)warnings.push('Facebook이 영상의 공개 여부를 알려 주지 않아, 예약·초안 영상이 게시물에 섞였을 수 있어요.');
      // 게시물 목록과 영상 번호로 짝지은 영상은 영상의 post_id가 그 게시물 번호와 같은지 센다(matched · agreed). 운영에서 post_id를 제대로 읽는지 이 수로 확인한다.
      videoPostIds={asked:postIdKnown,videos:0,withPostId:0,matched:0,agreed:0,byPostId:0,conflicts:0};
      // 먼저 영상마다 짝지을 게시물 줄을 정한다. row는 첨부 대상 · 주소로 짝지은 줄(byVideo)이나, 없으면 영상의 post_id가 가리키는 이번 회차의 게시물 줄이다.
      // 첨부 대상으로만 짝지은 게시물이 영상의 post_id와 다른 게시물이고 그 post_id의 게시물이 이번 목록에 없으면(conflict) 어느 쪽이 맞는지 모른다. 앞 판처럼 조회수를 그 게시물에 주고 영상 주소를
      // 별칭으로 달되, 영상 번호는 달지 않아 서버가 다음 회차에 그 짝으로 줄을 잇지 않는다(11-19 5회차 GA2 · 설계 검토 3 조건 2 · 6회차 GA2). 게시물 주소가 그 영상 주소인 짝은 그대로 믿는다.
      // Meta가 릴스의 post_id를 게시물 목록 번호와 다르게 준다면 이 수(conflicts)와 matched − agreed가 운영 기록에 보인다.
      const entries=[],seen=new Set();
      for(const video of videos.entries){
        if(video.published===false){unpublished++;continue;}
        const id=String(video.id);if(seen.has(id))continue;seen.add(id);
        const postId=postIdKnown?videoPostId(video.post_id):null,createdAt=isoDate(video.created_time);
        // post_id가 가리키는 게시물이 이번 게시물 목록에 있으면 어긋난 첨부 대상보다 그 게시물을 믿는다(6회차 자체 불변식 시험). 목록에 없을 때만 충돌로 둔다.
        const attached=known.get(id)||null,viaPost=postId&&known.get(postId)||null,clash=!!attached&&!!postId&&!!attached.pagePostId&&attached.pagePostId!==postId&&addressed.get(id)!==attached;
        const byVideo=clash&&viaPost?null:attached,conflict=clash&&!viaPost,row=byVideo||viaPost||null;
        // 빈 주소를 첫 화면 주소로 풀지 않고, 깨진 주소는 주소 없음으로 본다(11-19 셋째 검수 GA1 · 넷째 GA4).
        const permalink=typeof video.permalink_url==='string'?video.permalink_url.trim():'';
        let url=null;try{url=permalink?safeUrl(new URL(permalink,'https://www.facebook.com').href):null;}catch{url=null;}
        entries.push({video,id,postId,createdAt,byVideo,conflict,row,url,group:row||(postId?'post:'+postId:null)});
      }
      // 한 게시물 줄은 영상 하나만 차지한다. 어느 영상이 차지하는지는 회차와 목록 순서에 따라 바뀌지 않게 정한다(11-19 post-performance 검수 GA1 · 6회차
      // GA1 · GA8 · 자체 불변식 시험): 게시물 주소가 영상 주소면 그 영상(이번 목록에 없어도), 아니면 그 줄에 짝지어지는 영상 가운데 가장 먼저 올린 영상(시각이
      // 같으면 번호가 작은 영상). 첨부 대상이 있는 게시물은 첨부 대상 영상만 차지한다(그 영상이 이번 목록에 없으면 이번에는 아무도 차지하지 않는다).
      // 게시물 목록에 없는 게시물도 같은 post_id의 영상 가운데 같은 규칙으로 하나만 게시물 번호 줄이다. 나머지 영상은 자기 주소 · 조회수를 가진 영상 번호
      // 줄이다 — 한 줄에 다른 영상의 주소를 달면 그 주소로 등록된 기록이 첫 영상의 조회수를 받는다. 그 줄에는 그 게시물의 줄이 아니라는 표시(sharedPostId)를
      // 붙여, 서버가 영상 번호만 보고 게시물 줄로 잇지 않게 한다.
      const named=row=>{const key=addressKey(row.url)||'';return key.startsWith('video:')?key.slice(6):null;};
      const earlier=(a,b)=>{const x=a.createdAt||'9999',y=b.createdAt||'9999';return x!==y?x<y:a.id.length!==b.id.length?a.id.length<b.id.length:a.id<b.id;};
      // videoHeldBy: 게시물 줄이 그 영상을 쥔 근거 — 게시물 주소(address) > 첨부 대상(attachment) > post_id(postid). 서버는 더 약한 근거로 쥔 영상을 바꾸지 않는다.
      const owners=new Map(),evidence=new Map();
      for(const e of entries){if(!e.group)continue;const held=e.row&&named(e.row);if(held){owners.set(e.group,held);evidence.set(e.group,'address');continue;}
        const only=e.row&&targets.get(e.row);if(only&&!only.has(e.id)){if(!owners.has(e.group))owners.set(e.group,'');continue;}
        // 게시물 목록에 없는 게시물(group이 post:번호)은 주소를 읽은 영상이 먼저다 — 주소 없는 줄은 서버가 빼서 그 게시물 줄이 앞 영상을 놓지 못한다(자체 불변식 시험).
        const best=owners.get(e.group),readable=x=>typeof e.group!=='string'||!!x.url;
        if(!best||(readable(e)!==readable(best)?readable(e):earlier(e,best))){owners.set(e.group,e);evidence.set(e.group,only?'attachment':'postid');}}
      const ownerOf=group=>{const o=owners.get(group);return typeof o==='string'?o:o?.id;};
      // 합친 줄에서 주 주소와 정체성이 다른 주소는 별칭(aliasUrls: 주소와 그 주소의 게시 시각)으로 단다. 게시 성과 기록이 어느 주소로
      // 등록됐어도 이 줄을 찾는다(11-19 넷째 검수 GA3 · 설계 검토 2 조건 8 · 9).
      const alias=(row,aliasUrl,aliasAt)=>{const key=aliasUrl&&addressKey(aliasUrl);if(!key||key===addressKey(row.url)||(row.aliasUrls||[]).some(a=>addressKey(a.url)===key))return;(row.aliasUrls||=[]).push({url:aliasUrl,publishedAt:aliasAt});};
      for(const e of entries){
        const {video,id,postId,createdAt,byVideo,conflict,row,url}=e,mine=!!e.group&&ownerOf(e.group)===id;
        videoPostIds.videos++;if(postId)videoPostIds.withPostId++;
        // 차지한 게시물 줄에 합친다. 첨부 대상 · 주소로 짝지은 줄은 예전처럼 조회수를 받고, post_id로 합친 줄은 비었을 때만 받는다(같은 게시물은 한 회차에
        // 줄 하나 — 11-19 검수 GA1 · 설계 검토 조건 3). 주 주소는 바꾸지 않는다 — 직접 게시가 그 주소로 등록하고, 자동 등록은 별칭까지 보고 같은 게시물을 두 번
        // 올리지 않는다(5회차 GA3). 주 주소가 비었을 때만 영상 주소 · 영상 시각으로 채우고, 아니면 영상 주소를 그 시각과 함께 별칭으로 단다.
        if(row&&mine){
          if(byVideo){row.metrics.views=number(video.views);videoPostIds.matched++;if(conflict)videoPostIds.conflicts++;else if(postId&&postId===row.pagePostId)videoPostIds.agreed++;}
          else{if(row.metrics.views===null)row.metrics.views=number(video.views);videoPostIds.byPostId++;}
          if(!conflict){row.videoId=id;row.videoHeldBy=evidence.get(e.group);}
          if(!row.url&&url){row.url=url;row.publishedAt=createdAt||row.publishedAt;}
          else{if(!row.publishedAt)row.publishedAt=createdAt;alias(row,url,createdAt);}
          // 별칭이 있어야 찾을 영상인데 주소를 못 읽었으면 이번 목록은 다 본 것이 아니다 — 그 주소로 등록한 기록을 「없음」으로 끄지 않게(5회차 GA4).
          if(!url&&addressKey(row.url)!==`video:${id}`)unreadable++;
          continue;
        }
        // 영상 목록에서만 찾은 릴스는 post_id를 알면 externalId도 그 게시물 번호다. 다음 회차에 게시물 목록이 같은 게시물을 주어도 서버의 같은 줄이다
        // (설계 검토 B). 모르면 예전처럼 영상 번호이고 pagePostId는 없다. 다른 영상이 차지한 게시물의 영상은 영상 번호 줄이고 게시물 번호는 달지 않는다.
        const owns=!row&&mine&&!!postId;
        const shared=owns?null:row?.pagePostId||postId||null;
        posts.push({externalId:owns?postId:id,url,title:text(video.title)||text(video.description),publishedAt:createdAt,thumbnailUrl:null,pagePostId:owns?postId:null,videoId:id,...(shared?{sharedPostId:shared}:{}),...(owns?{videoHeldBy:'postid'}:{}),metrics:metrics({views:video.views,likes:video.likes?.summary?.total_count,comments:video.comments?.summary?.total_count})});
        if(!row&&!postId)numberless++;
        // 주소 없는 영상 줄은 서버가 빼고, 그 영상 주소로 등록한 기록은 이번 결과에서 찾지 못한다 — 목록을 다 본 것으로 치지 않는다(설계 검토 3 조건 4).
        if(!url)unreadable++;
      }
      if(unpublished)warnings.push(`예약·초안처럼 아직 공개하지 않은 영상 ${unpublished}개는 게시물로 세지 않았어요.`);
      // 칸을 거절당했을 때도, 받았는데 번호가 비었을 때도 같다(11-19 검수 GA4).
      if(numberless)warnings.push(`Facebook이 영상의 페이지 게시물 번호를 알려 주지 않아, 영상 목록에서만 찾은 ${numberless}개는 게시물 번호 없이 적었어요.`);
      if(unreadable){warnings.push(`Facebook 영상 ${unreadable}개의 주소를 읽지 못해, 그 영상 주소로 등록한 성과 기록은 이번에 찾지 못할 수 있어요.`);videosPartial=true;}
    }catch(error){if(error.code==='CANCELLED')throw error;optionalFailure(error,recent,true);videosPartial=true;warnings.push('Facebook 영상·릴스 목록을 받지 못해 전체 게시물 수와 영상 조회수가 일부만 모였어요.');}
  }else{hasMore=true;warnings.push(capWarning(cap));}
  const collected=result({ externalId: pageId, displayName: text(page.name) || channel.handle || pageId, followers: number(page.followers_count), views: null, metrics: { likes: number(page.fan_count) } }, posts, { warnings, partial:videosPartial,hasMore, pages, ownerAuthorized: true, source: 'facebook-pages-api', unavailable: ['saves', 'reach', 'channel.views',...(posts.some(p=>p.metrics.views!==null)?[]:['views'])] });
  if(videosPartial)collected.coverage.inventoryComplete=false;
  if(videoPostIds)collected.coverage.videoPostIds=videoPostIds;
  return collected;
}

/** Analytics report columns → post performance metric ids for the fixed-window report. */
export const YOUTUBE_WINDOW_METRICS = Object.freeze({ averageViewDuration: 'averageWatchSeconds', averageViewPercentage: 'averageViewPct', shares: 'shares', subscribersGained: 'subscribersGained', subscribersLost: 'subscribersLost' });
const WINDOW_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read one fixed date window (Pacific Time dates, as YouTube Analytics reports) per owned video.
 * A video without a report row, or with no views inside the window, is `empty`: the report is not
 * processed yet or has nothing to say, and is never turned into zeros.
 */
export async function collectYoutubeWindows(input, credentials = {}, options = {}) {
  const { fetchImpl = globalThis.fetch, signal, videos = [] } = options;
  const channel = normalizeChannelUrl(typeof input === 'string' ? input : input?.canonicalUrl || input?.url);
  if (input?.platform && input.platform !== channel.platform) throw mismatch();
  if (channel.platform !== 'youtube') throw new CollectorError('MANUAL_ONLY', '창 지표는 YouTube 분석에서만 받아요.');
  if (typeof fetchImpl !== 'function') throw new CollectorError('INVALID_CONFIG', '수집을 시작하지 못했어요.');
  const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
  if (!accessToken || credentials.publicOnly === true || !youtubeAnalyticsScope(credentials)) throw new CollectorError('AUTH_REQUIRED', 'YouTube 분석 수치는 채널 주인 계정으로 연결하고 YouTube 분석 권한을 허락해야 받을 수 있어요.');
  const wanted = (Array.isArray(videos) ? videos : []).filter(video => /^[A-Za-z\d_-]{11}$/.test(video?.externalId || '') && WINDOW_DATE.test(video.startDate || '') && WINDOW_DATE.test(video.endDate || '') && video.startDate <= video.endDate).slice(0, 50);
  const fetchedAt = () => new Date().toISOString();
  if (!wanted.length) return { source: 'youtube-analytics-api-v2', timeZone: 'America/Los_Angeles', fetchedAt: fetchedAt(), videos: [] };
  const request = makeRequester({ fetchImpl, signal }), auth = { headers: { Authorization: `Bearer ${accessToken}` } };
  const api = (path, params) => request(endpoint('https://www.googleapis.com', `/youtube/v3/${path}`, params), auth);
  const found = await api('channels', { part: 'id', ...(channel.externalId ? { id: channel.externalId } : { forHandle: channel.handle }) });
  const channelId = found.items?.[0]?.id;
  if (!channelId) throw new CollectorError('CHANNEL_NOT_FOUND', 'YouTube에서 이 채널을 찾지 못했어요. 주소가 맞는지 봐 주세요.');
  if (channel.externalId && channelId !== channel.externalId) throw mismatch();
  const mine = await api('channels', { part: 'id', mine: true, maxResults: 50 });
  if (!mine.items?.some(owned => owned.id === channelId) || (credentials.accountId && credentials.accountId !== channelId)) throw mismatch();
  const columns = ['views', ...Object.keys(YOUTUBE_WINDOW_METRICS)], results = [];
  let answered = 0, denied = null;
  for (const video of wanted) {
    const base = { externalId: video.externalId, startDate: video.startDate, endDate: video.endDate };
    let report;
    try { report = await request(endpoint('https://youtubeanalytics.googleapis.com', '/v2/reports', { ids: `channel==${channelId}`, startDate: video.startDate, endDate: video.endDate, metrics: columns.join(','), filters: `video==${video.externalId}` }), auth); }
    catch (error) {
      // A rejected query for one video does not stop the others; quota and network errors do. A denied query
      // is that video's problem only if Analytics answers another video of this channel; otherwise it is the grant.
      if (error.code === 'API_ERROR' && [400, 404].includes(error.status) || error.code === 'CHANNEL_NOT_FOUND') { results.push({ ...base, status: 'error', errorCode: error.code }); continue; }
      if (error.code === 'AUTH_REQUIRED') { denied ||= error; results.push({ ...base, status: 'error', errorCode: 'AUTH_REQUIRED' }); continue; }
      throw error;
    }
    answered++;
    const headers = Array.isArray(report?.columnHeaders) ? report.columnHeaders.map(header => header?.name) : null;
    if (!headers || (report.rows !== undefined && !Array.isArray(report.rows))) throw new CollectorError('INVALID_RESPONSE', 'YouTube 분석 수치를 받지 못했어요.');
    const row = Array.isArray(report.rows?.[0]) ? report.rows[0] : null, value = name => row && headers.includes(name) ? number(row[headers.indexOf(name)]) : null;
    const views = value('views');
    if (!row || !views) { results.push({ ...base, status: 'empty', views }); continue; }
    results.push({ ...base, status: 'ready', views, metrics: Object.fromEntries(Object.entries(YOUTUBE_WINDOW_METRICS).map(([name, key]) => [key, value(name)])) });
  }
  if (denied && !answered) throw denied;
  return { source: 'youtube-analytics-api-v2', timeZone: 'America/Los_Angeles', fetchedAt: fetchedAt(), videos: results };
}

/**
 * Collect one registered URL. Credentials are supplied by encrypted server config;
 * this module never persists, logs, or returns them.
 */
export async function collectChannel(input, credentials = {}, options = {}) {
  const { fetchImpl = globalThis.fetch, signal } = options;
  const channel = normalizeChannelUrl(typeof input === 'string' ? input : input?.canonicalUrl || input?.url);
  if (input?.platform && input.platform !== channel.platform) throw mismatch();
  if (typeof fetchImpl !== 'function') throw new CollectorError('INVALID_CONFIG', '수집을 시작하지 못했어요.');
  const recent = recentWindow(options, credentials);
  const request = makeRequester({ fetchImpl, signal });
  if (channel.platform === 'youtube') return recentResult(await youtube(channel, credentials, request, recent), recent);
  if (channel.platform === 'tiktok') return recentResult(await tiktok(channel, credentials, request, recent), recent);
  if (channel.platform === 'instagram') return recentResult(await instagram(channel, credentials, request, recent), recent);
  if (channel.platform === 'facebook') return recentResult(await facebook(channel, credentials, request, recent), recent);
  throw new CollectorError('MANUAL_ONLY', '이 플랫폼은 주소 등록과 직접 기록만 돼요. 자동 수집은 아직 안 돼요.');
}
