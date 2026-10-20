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
  constructor(code, message, { retryable = false, status = null } = {}) {
    super(message);
    this.name = 'CollectorError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
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

function apiError(status, apiCode, transient = false) {
  const codes = String(apiCode || '').toLowerCase();
  // YouTube는 한도를 403 + 이유(rateLimitExceeded·userRateLimitExceeded·dailyLimitExceeded·quotaExceeded)로, Meta는 4·17·32·613과
  // 업무별 한도 800xx로 알린다. 이것을 인증 오류로 읽으면 「재연결 필요」로 자동 수집이 멈춘다(10-20).
  if (status === 429 || ['4', '17', '32', '613'].includes(codes) || /^800\d\d$/.test(codes) || /quota|rate.?limit|too.?many|limit.?exceeded/.test(codes)) return new CollectorError('RATE_LIMITED', '플랫폼 호출 한도에 걸렸어요. 적어도 24시간 뒤에 다시 시도해요.', { retryable: true, status });
  if (status === 401 || status === 403 || ['102', '190', '200'].includes(codes) || /access.token|access_token|unauthor|permission|oauth|scope/.test(codes)) return new CollectorError('AUTH_REQUIRED', '연결이 만료됐거나 권한이 모자라요. 채널 카드에서 계정을 다시 연결해 주세요.', { status });
  if (status === 404) return new CollectorError('CHANNEL_NOT_FOUND', '플랫폼에서 이 채널이나 콘텐츠를 찾지 못했어요. 주소가 맞는지 봐 주세요.', { status });
  // Meta는 일시 오류에 is_transient:true를 붙인다. 영구 오류로 굳히지 않고 재시도한다.
  return new CollectorError('API_ERROR', '플랫폼이 수집 요청을 처리하지 못했어요. 연결과 플랫폼 상태를 봐 주세요.', { retryable: status >= 500 || transient, status });
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
      if (!response.ok || (data?.error && code !== undefined && code !== 'ok' && code !== 0)) throw apiError(response.status, code, data?.error?.is_transient === true);
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
      const list = await api('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: 50, pageToken: token });
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
  const list = await graphList(`${pageId}/posts`, { fields: 'id,message,created_time,permalink_url,attachments{target},shares,reactions.type(LIKE).limit(0).summary(true),comments.limit(0).summary(true)' }, api, cap, recent, post => post.created_time);
  const posts = list.entries.map(post => ({ externalId: String(post.id), url: safeUrl(post.permalink_url), title: text(post.message), publishedAt: isoDate(post.created_time), thumbnailUrl: null, metrics: metrics({ likes: post.reactions?.summary?.total_count, comments: post.comments?.summary?.total_count, shares: post.shares?.count }) }));
  const warnings = [...list.warnings, 'Facebook은 영상 조회수와 게시물 좋아요를 받은 그대로 적어요. 일반 게시물 조회수·저장·도달과 받지 못한 공유 수는 비워 둬요.'];
  let videosPartial=false,hasMore=list.hasMore,pages=list.pages;
  const videoId=url=>{try{const u=new URL(url,'https://www.facebook.com');return u.searchParams.get('v')||u.pathname.match(/\/(?:reel|videos)\/(\d+)/)?.[1]||null;}catch{return null;}};
  const known=new Map();list.entries.forEach((p,i)=>{known.set(String(p.id),posts[i]);for(const attachment of p.attachments?.data||[])if(attachment.target?.id)known.set(String(attachment.target.id),posts[i]);const id=videoId(p.permalink_url);if(id)known.set(id,posts[i]);});
  if(posts.length<cap.maxPosts&&pages<cap.maxPages){
    try{
      const videos=await graphList(`${pageId}/videos`,{fields:'id,title,description,created_time,permalink_url,views,likes.limit(0).summary(true),comments.limit(0).summary(true)'},api,{...cap,maxPosts:cap.maxPosts-posts.length,maxPages:cap.maxPages-pages},recent,v=>v.created_time);
      hasMore=hasMore||videos.hasMore;pages+=videos.pages;warnings.push(...videos.warnings);
      for(const video of videos.entries){
        const id=String(video.id),existing=known.get(id);
        if(existing){existing.metrics.views=number(video.views);continue;}
        const url=typeof video.permalink_url==='string'?safeUrl(new URL(video.permalink_url,'https://www.facebook.com').href):null;
        posts.push({externalId:id,url,title:text(video.title)||text(video.description),publishedAt:isoDate(video.created_time),thumbnailUrl:null,metrics:metrics({views:video.views,likes:video.likes?.summary?.total_count,comments:video.comments?.summary?.total_count})});
        known.set(id,posts.at(-1));
      }
    }catch(error){if(error.code==='CANCELLED')throw error;optionalFailure(error,recent,true);videosPartial=true;warnings.push('Facebook 영상·릴스 목록을 받지 못해 전체 게시물 수와 영상 조회수가 일부만 모였어요.');}
  }else{hasMore=true;warnings.push(capWarning(cap));}
  const collected=result({ externalId: pageId, displayName: text(page.name) || channel.handle || pageId, followers: number(page.followers_count), views: null, metrics: { likes: number(page.fan_count) } }, posts, { warnings, partial:videosPartial,hasMore, pages, ownerAuthorized: true, source: 'facebook-pages-api', unavailable: ['saves', 'reach', 'channel.views',...(posts.some(p=>p.metrics.views!==null)?[]:['views'])] });
  if(videosPartial)collected.coverage.inventoryComplete=false;
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
