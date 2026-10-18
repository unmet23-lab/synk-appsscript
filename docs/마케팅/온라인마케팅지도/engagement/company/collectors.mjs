import {instagramIdentity} from './meta-connection.mjs';

/**
 * Read-only SNS collectors. Only fixed official API origins are fetched.
 * Values are lifetime snapshots taken now, not historical daily analytics.
 * An unavailable metric is null; an actual API value of zero remains zero.
 */

export const PLATFORM_CAPABILITIES = Object.freeze([
  { id: 'youtube', label: 'YouTube', mode: 'api-key', metrics: ['followers', 'views', 'likes', 'comments', 'shares'], requirements: '관리자 API 키로 공개 수치를 수집하거나 채널 소유자의 Google 계정을 연결합니다. 공유는 소유자 Analytics 권한이 추가로 필요합니다. 저장·도달은 제공하지 않습니다.', docsUrl: 'https://developers.google.com/youtube/v3/docs/channels/list' },
  { id: 'instagram', label: 'Instagram', mode: 'oauth', metrics: ['followers', 'views', 'likes', 'comments', 'shares', 'saves', 'reach'], requirements: 'Instagram 프로페셔널 계정과 해당 계정의 공식 로그인 토큰, 인사이트 조회 권한이 필요합니다. 콘텐츠 종류별 지원 수치가 다릅니다.', docsUrl: 'https://developers.facebook.com/docs/instagram-platform/insights/' },
  { id: 'facebook', label: 'Facebook', mode: 'oauth', metrics: ['followers', 'likes', 'comments', 'shares'], requirements: '관리 중인 Facebook 페이지의 페이지 액세스 토큰과 페이지 ID가 필요합니다. 개인 프로필은 지원하지 않습니다.', docsUrl: 'https://developers.facebook.com/docs/pages-api/' },
  { id: 'tiktok', label: 'TikTok', mode: 'oauth', metrics: ['followers', 'views', 'likes', 'comments', 'shares'], requirements: 'TikTok 승인 앱과 해당 계정의 user.info.basic, user.info.profile, user.info.stats, video.list 권한 토큰이 필요합니다.', docsUrl: 'https://developers.tiktok.com/doc/tiktok-api-v2-video-list/' },
  { id: 'threads', label: 'Threads', mode: 'manual', metrics: [], requirements: '주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.', docsUrl: 'https://developers.facebook.com/docs/threads/' },
  { id: 'x', label: 'X', mode: 'manual', metrics: [], requirements: '주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.', docsUrl: 'https://docs.x.com/x-api' },
  { id: 'linkedin', label: 'LinkedIn', mode: 'manual', metrics: [], requirements: '회사 페이지 주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.', docsUrl: 'https://learn.microsoft.com/en-us/linkedin/' },
  { id: 'douyin', label: 'Douyin', mode: 'manual', metrics: [], requirements: '주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.', docsUrl: 'https://developer.open-douyin.com/' },
  { id: 'vk', label: 'VK', mode: 'manual', metrics: [], requirements: '주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.', docsUrl: 'https://dev.vk.com/' },
  { id: 'xiaohongshu', label: 'Xiaohongshu', mode: 'manual', metrics: [], requirements: '주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.', docsUrl: 'https://open.xiaohongshu.com/' },
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

const invalid = () => new CollectorError('INVALID_CHANNEL_URL', '지원하는 SNS의 채널·페이지 주소를 입력해 주세요. 게시물 주소나 단축 주소는 사용할 수 없습니다.');
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
  const warnings = [...collected.warnings, '최근 수집은 지정한 게시 기간의 콘텐츠만 확인하며, 반응 수치는 수집 시점의 누적값입니다.'];
  if (recent.uncertainOrder) warnings.push('목록의 게시일 정렬을 보장할 수 없어 오래된 콘텐츠만 있는 페이지에서 조회를 멈췄습니다. 최근 콘텐츠 전체를 확인한 것은 아닙니다.');
  if (recent.invalidDates) warnings.push(`게시일을 확인할 수 없는 콘텐츠 ${recent.invalidDates}개는 최근 콘텐츠에서 제외했습니다.`);
  if (recent.insightsSkipped) warnings.push(`최근 인사이트 요청 한도(${recent.maxInsights}개) 또는 조회 오류로 콘텐츠 ${recent.insightsSkipped}개의 추가 수치를 확인하지 못했습니다.`);
  const partial = collected.coverage.status !== 'complete' || recent.uncertainOrder || recent.invalidDates > 0 || recent.insightsSkipped > 0;
  return { ...collected, warnings, coverage: { ...collected.coverage, scope: 'recent', status: partial ? 'partial' : 'complete',
    limitations: warnings, ...(recent.collectionError ? { collectionError: recent.collectionError } : {}),
    recent: { since: recent.since, until: recent.until, maxPosts: recent.maxPosts, maxPages: recent.maxPages,
      complete: !partial, excludedOutsideWindow: recent.excludedOutsideWindow, invalidDates: recent.invalidDates,
      uncertainOrder: recent.uncertainOrder, insightsRequested: recent.insightsRequested, insightsSkipped: recent.insightsSkipped, maxInsights: recent.maxInsights } } };
}
const mismatch = () => new CollectorError('ACCOUNT_MISMATCH', '연결한 계정과 등록한 페이지 주소가 다릅니다. 해당 페이지의 연결 정보를 확인해 주세요.');
const apiOrigins = new Set(['https://www.googleapis.com', 'https://youtubeanalytics.googleapis.com', 'https://graph.instagram.com', 'https://graph.facebook.com', 'https://open.tiktokapis.com']);

function apiError(status, apiCode) {
  const codes = String(apiCode || '').toLowerCase();
  if (status === 429 || ['4', '17', '32', '613'].includes(codes) || /quota|rate.limit|rate_limit|too_many/.test(codes)) return new CollectorError('RATE_LIMITED', '플랫폼의 조회 한도에 도달했습니다. 잠시 후 다시 수집해 주세요.', { retryable: true, status });
  if (status === 401 || status === 403 || ['102', '190', '200'].includes(codes) || /access.token|access_token|unauthor|permission|oauth|scope/.test(codes)) return new CollectorError('AUTH_REQUIRED', '플랫폼 연결이 만료되었거나 필요한 조회 권한이 없습니다. 연결을 확인해 주세요.', { status });
  if (status === 404) return new CollectorError('CHANNEL_NOT_FOUND', '플랫폼에서 해당 채널 또는 콘텐츠를 찾을 수 없습니다.', { status });
  return new CollectorError('API_ERROR', '플랫폼이 수집 요청을 처리하지 못했습니다. 연결 정보와 플랫폼 상태를 확인해 주세요.', { retryable: status >= 500, status });
}

function makeRequester({ fetchImpl, signal }) {
  return async (url, options = {}) => {
    const parsed = new URL(url);
    if (!apiOrigins.has(parsed.origin) || parsed.username || parsed.password) throw new CollectorError('INVALID_API_TARGET', '허용되지 않은 수집 주소입니다.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new CollectorError('CANCELLED', '수집이 취소되었습니다.');
    signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
    timer.unref?.();
    try {
      const response = await fetchImpl(parsed.href, { ...options, redirect: 'error', signal: controller.signal });
      let data;
      try { data = await response.json(); } catch { throw new CollectorError('INVALID_RESPONSE', '플랫폼의 응답 형식을 확인할 수 없습니다.', { retryable: response.status >= 500, status: response.status }); }
      const code = data?.error?.errors?.[0]?.reason ?? data?.error?.code ?? data?.error_code;
      if (!response.ok || (data?.error && code !== undefined && code !== 'ok' && code !== 0)) throw apiError(response.status, code);
      return data;
    } catch (error) {
      if (error instanceof CollectorError) throw error;
      if (signal?.aborted) throw new CollectorError('CANCELLED', '수집이 취소되었습니다.');
      if (timedOut) throw new CollectorError('TIMEOUT', '플랫폼 응답 시간이 초과되었습니다. 잠시 후 다시 수집해 주세요.', { retryable: true });
      // Never include the thrown message/cause: fetch errors can contain tokens or URLs.
      throw new CollectorError('NETWORK_ERROR', '플랫폼에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.', { retryable: true });
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
function capWarning(cap) { return `1회 수집 한도(콘텐츠 ${cap.maxPosts.toLocaleString('ko-KR')}개 또는 목록 ${cap.maxPages.toLocaleString('ko-KR')}페이지)에 도달하여 일부 콘텐츠만 수집했습니다.`; }

async function youtube(channel, credentials, request, recent) {
  const accessToken = typeof credentials.accessToken === 'string' ? credentials.accessToken.trim() : '';
  const publicOnly=credentials.publicOnly===true;
  const apiKey = accessToken ? undefined : required(credentials, 'apiKey', 'YouTube 계정을 연결하거나 관리자에게 YouTube Data API 키 연결을 요청해 주세요.');
  const cap = recent || limits(credentials);
  const api = (path, params) => request(endpoint('https://www.googleapis.com', `/youtube/v3/${path}`, { ...params, key: apiKey }), accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {});
  const response = await api('channels', { part: 'snippet,statistics,contentDetails', ...(channel.externalId ? { id: channel.externalId } : { forHandle: channel.handle }) });
  const item = response.items?.[0];
  if (!item?.id) throw new CollectorError('CHANNEL_NOT_FOUND', 'YouTube에서 해당 채널을 찾을 수 없습니다.');
  if (channel.externalId && item.id !== channel.externalId) throw mismatch();
  if (accessToken&&!publicOnly) {
    const mine = await api('channels', { part: 'id', mine: true, maxResults: 50 });
    if (!mine.items?.some(owned => owned.id === item.id) || (credentials.accountId && credentials.accountId !== item.id)) throw mismatch();
  }
  const warnings = ['저장·도달은 이 YouTube 연결에서 제공하지 않습니다.', 'YouTube 구독자 수는 공개 표시 정책에 따라 반올림될 수 있습니다.', '채널 누적 조회수와 수집된 콘텐츠 조회수 합계는 삭제·비공개 콘텐츠 등의 영향으로 다를 수 있습니다.'];
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
      if (!Array.isArray(list.items)) throw new CollectorError('INVALID_RESPONSE', 'YouTube 콘텐츠 목록을 확인할 수 없습니다.');
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
      if (token && seenTokens.has(token)) { hasMore = true; warnings.push('플랫폼에서 같은 목록 커서를 반복해 반환하여 추가 수집을 중단했습니다.'); break; }
      if (token) seenTokens.add(token);
      if ((ids.size >= cap.maxPosts || pages >= cap.maxPages) && token) hasMore = true;
      if (hasMore) { warnings.push(capWarning(cap)); break; }
    } while (token);
  } else if (number(item.statistics?.videoCount) > 0) {
    warnings.push('업로드 목록이 제공되지 않아 채널 수치만 수집했습니다.');
    hasMore = true;
  }
  const posts = [];
  const allIds = [...ids];
  for (let offset = 0; offset < allIds.length; offset += 50) {
    const batch = allIds.slice(offset, offset + 50);
    const videos = await api('videos', { part: 'snippet,statistics,status', id: batch.join(','), maxResults: 50 });
    if (!Array.isArray(videos.items)) throw new CollectorError('INVALID_RESPONSE', 'YouTube 콘텐츠 수치를 확인할 수 없습니다.');
    const returned = new Set();
    for (const video of videos.items) {
      if (!batch.includes(video.id) || returned.has(video.id)) continue;
      returned.add(video.id);
      if(publicOnly&&video.status?.privacyStatus!=='public')continue;
      if(video.status?.privacyStatus&&video.status.privacyStatus!=='public')continue;
      if (video.snippet?.channelId && video.snippet.channelId !== item.id) { omitted++; continue; }
      if (!recentDate(video.snippet?.publishedAt, recent)) continue;
      posts.push({ externalId: video.id, url: `https://www.youtube.com/watch?v=${video.id}`, title: text(video.snippet?.title), publishedAt: isoDate(video.snippet?.publishedAt), thumbnailUrl: safeUrl(video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url), metrics: metrics({ views: video.statistics?.viewCount, likes: video.statistics?.likeCount, comments: video.statistics?.commentCount }) });
    }
    omitted += batch.filter(id => !returned.has(id)).length;
  }
  if (omitted) warnings.push(`삭제·비공개 또는 제공되지 않는 콘텐츠 ${omitted}개는 상세 수치에서 제외했습니다.`);
  if (item.statistics?.hiddenSubscriberCount) warnings.push('이 채널은 구독자 수를 공개하지 않습니다.');
  const unavailable = ['saves', 'reach'];
  const metricPeriods = {};
  let analyticsPartial = false;
  const analyticsAllowed=!credentials.scope||String(credentials.scope).split(/[ ,]+/).includes('https://www.googleapis.com/auth/yt-analytics.readonly');
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
        if (!(shareColumn >= 0 && (batch.length === 1 || videoColumn >= 0)) || (analytics.rows !== undefined && !Array.isArray(analytics.rows))) throw new CollectorError('INVALID_RESPONSE', 'YouTube Analytics 수치를 확인할 수 없습니다.');
        const values = new Map((analytics.rows || []).map(row => [batch.length === 1 ? batch[0].externalId : row[videoColumn], number(row[shareColumn])]));
        for (const post of batch) post.metrics.shares = values.get(post.externalId) ?? null;
      }
      metricPeriods.shares = { source: 'youtube-analytics-api-v2', startDate: '2005-01-01', requestedEndDate: endDate, lagged: true };
      warnings.push('공유 수치는 YouTube Analytics가 제공하는 2005년 이후 누적값이며 최신 며칠이 늦게 반영될 수 있습니다. 보고서에 없는 콘텐츠는 미제공으로 표시합니다.');
    } catch (error) {
      if (error.code === 'CANCELLED') throw error;
      optionalFailure(error, recent, true);
      analyticsPartial = true;
      warnings.push('YouTube Analytics 공유 수치 일부 또는 전부를 받지 못했습니다. Analytics 사용 설정과 소유자 조회 권한을 확인해 주세요.');
    }
    if (!posts.some(post => post.metrics.shares !== null)) unavailable.push('shares');
  } else {
    unavailable.push('shares');
    if (!accessToken||publicOnly||!analyticsAllowed) warnings.push('공개 통계 연결에서는 공유 수치를 제공하지 않습니다. 채널 소유자의 Analytics 조회 권한이 필요합니다.');
  }
  return result({ externalId: item.id, displayName: text(item.snippet?.title) || channel.handle || item.id, followers: item.statistics?.hiddenSubscriberCount ? null : number(item.statistics?.subscriberCount), views: number(item.statistics?.viewCount), metrics: { posts: number(item.statistics?.videoCount) } }, posts, { warnings, hasMore, omitted, pages, partial: analyticsPartial, ownerAuthorized: Boolean(accessToken)&&!publicOnly, metricPeriods, source: 'youtube-data-api-v3', unavailable });
}

async function tiktok(channel, credentials, request, recent) {
  const accessToken = required(credentials, 'accessToken', '해당 TikTok 계정을 공식 앱에 연결한 액세스 토큰이 필요합니다.');
  const cap = recent || limits(credentials);
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const userData = await request(endpoint('https://open.tiktokapis.com', '/v2/user/info/', { fields: 'open_id,display_name,username,profile_deep_link,follower_count,following_count,likes_count,video_count' }), { headers });
  const user = userData.data?.user;
  if (!user?.open_id || !user?.username) throw new CollectorError('AUTH_REQUIRED', 'TikTok 계정 확인에 필요한 user.info.profile 조회 권한이 없습니다.');
  if (user.username.toLowerCase() !== channel.handle?.toLowerCase() || (credentials.accountId && credentials.accountId !== user.open_id)) throw mismatch();
  const posts = [];
  const seen = new Set();
  const cursors = new Set();
  let cursor;
  let pages = 0;
  let hasMore = false;
  const warnings = ['저장·도달은 TikTok Display API에서 제공하지 않습니다.', '공개 동영상의 누적 수치를 수집합니다. 과거 날짜의 일별 수치가 소급 생성되지는 않습니다.'];
  do {
    const response = await request(endpoint('https://open.tiktokapis.com', '/v2/video/list/', { fields: 'id,create_time,title,video_description,share_url,cover_image_url,like_count,comment_count,share_count,view_count' }), { method: 'POST', headers, body: JSON.stringify({ max_count: Math.min(20, cap.maxPosts - posts.length), ...(cursor !== undefined ? { cursor } : {}) }) });
    pages++;
    const data = response.data;
    if (!data || !Array.isArray(data.videos)) throw new CollectorError('INVALID_RESPONSE', 'TikTok 동영상 목록을 확인할 수 없습니다.');
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
    if (cursor === undefined || cursors.has(String(cursor))) { warnings.push('플랫폼이 다음 목록 커서를 제공하지 않거나 같은 커서를 반복해 반환했습니다.'); hasMore = true; break; }
    cursors.add(String(cursor));
    if (posts.length >= cap.maxPosts || pages >= cap.maxPages) { warnings.push(capWarning(cap)); break; }
    hasMore = false;
  } while (true);
  return result({ externalId: String(user.open_id), displayName: text(user.display_name) || user.username, followers: number(user.follower_count), views: null, metrics: { likes: number(user.likes_count), posts: number(user.video_count) } }, posts, { warnings, hasMore, pages, ownerAuthorized: true, source: 'tiktok-display-api-v2', unavailable: ['saves', 'reach', 'channel.views'] });
}

function graphConfig(credentials, instagramLogin = false) {
  const apiVersion = credentials.apiVersion || 'v26.0';
  if (!/^v\d{1,2}\.\d{1,2}$/.test(apiVersion)) throw new CollectorError('INVALID_CONFIG', 'Meta API 버전 형식이 올바르지 않습니다.');
  const origin = instagramLogin ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
  return { apiVersion, origin };
}
const graphId = value => {
  if (typeof value !== 'string' || !/^\d{1,50}$/.test(value)) throw new CollectorError('INVALID_CONFIG', '플랫폼 계정 ID는 숫자로 된 공식 ID를 입력해 주세요.');
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
    if (!Array.isArray(response.data)) throw new CollectorError('INVALID_RESPONSE', '플랫폼의 콘텐츠 목록을 확인할 수 없습니다.');
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
    if (!after || cursors.has(String(after))) { warnings.push('플랫폼이 다음 목록 커서를 제공하지 않거나 같은 커서를 반복해 반환했습니다.'); break; }
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

async function instagram(channel, credentials, request, recent) {
  const accessToken = required(credentials, 'accessToken', '해당 Instagram 프로페셔널 계정의 조회 권한을 연결해 주세요.');
  const direct = credentials.authType === 'instagram-login' || credentials.loginType === 'instagram';
  const config = graphConfig(credentials, direct);
  const cap = recent || limits(credentials);
  const api = (path, params) => request(endpoint(config.origin, `/${config.apiVersion}/${path}`, params), { headers: { Authorization: `Bearer ${accessToken}` } });
  const accountId = direct ? 'me' : graphId(required(credentials, 'accountId', '연결할 Instagram 프로페셔널 계정 ID가 필요합니다.'));
  const user = await api(accountId, { fields: (direct?'id,user_id':'id')+',username,name,followers_count,media_count' });
  if (!user?.id || !user?.username) throw new CollectorError('AUTH_REQUIRED', 'Instagram 프로페셔널 계정 정보를 확인할 수 없습니다. 조회 권한을 확인해 주세요.');
  const identity=direct?instagramIdentity(user,{requireUserId:credentials.metaIdentityVersion===1}):{id:String(user.id),appScopedId:null};
  if (user.username.toLowerCase() !== channel.handle?.toLowerCase() || (credentials.accountId && credentials.accountId !== identity.id && credentials.accountId !== identity.appScopedId)) throw mismatch();
  const resolvedId = graphId(identity.id);
  const list = await graphList(`${resolvedId}/media`, { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,like_count,comments_count' }, api, cap, recent, media => media.timestamp);
  const warnings = [...list.warnings, 'Instagram 인사이트는 프로페셔널 계정 전환 시점·콘텐츠 종류·플랫폼 보존 기간에 따라 일부 수치가 제공되지 않을 수 있습니다.', '콘텐츠별 도달은 중복 사용자를 포함하므로 전체 채널의 고유 도달 수로 합산할 수 없습니다.'];
  let missingInsights = 0;
  const insightsAllowed=!credentials.permissionsVerifiedAt||String(credentials.scope||'').split(/[ ,]+/).includes(direct?'instagram_business_manage_insights':'instagram_manage_insights');
  let haltInsights = !insightsAllowed;
  const posts = [];
  const metricNames = ['views', 'reach', 'shares', 'saved'];
  for (const media of list.entries) {
    if (!/^\d{1,50}$/.test(String(media.id))) { missingInsights++; continue; }
    const values = { views: null, reach: null, shares: null, saved: null };
    if (!haltInsights && (!recent || recent.insightsRequested < recent.maxInsights)) {
      try {
        if (recent) recent.insightsRequested++;
        const combined = await api(`${media.id}/insights`, { metric: metricNames.join(',') });
        for (const name of metricNames) values[name] = insightValue(combined, name);
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
    posts.push({ externalId: String(media.id), url: safeUrl(media.permalink), title: text(media.caption), publishedAt: isoDate(media.timestamp), thumbnailUrl: safeUrl(media.thumbnail_url), metrics: metrics({ views: values.views, likes: media.like_count, comments: media.comments_count, shares: values.shares, saves: values.saved, reach: values.reach }) });
  }
  if (missingInsights) warnings.push(`콘텐츠 ${missingInsights}개는 일부 인사이트가 제공되지 않아 해당 수치를 미제공으로 표시했습니다.`);
  if (haltInsights) warnings.push('인사이트 조회 권한·한도 또는 연결 오류가 발생하여 추가 인사이트 요청을 중단했습니다.');
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
  const originalToken = required(credentials, 'accessToken', '해당 Facebook 페이지의 조회 권한을 연결해 주세요.');
  const config = graphConfig(credentials);
  const cap = recent || limits(credentials);
  let accessToken = originalToken;
  const api = (path, params) => request(endpoint(config.origin, `/${config.apiVersion}/${path}`, params), { headers: { Authorization: `Bearer ${accessToken}` } });
  let page;
  if (credentials.authType === 'facebook-user') {
    const managed = await graphList('me/accounts', { fields: 'id,name,username,link,access_token' }, api, { maxPosts: 10000, maxPages: cap.maxPages });
    page = managed.entries.find(candidate => facebookMatches(channel, candidate) && (!credentials.accountId || String(candidate.id) === credentials.accountId));
    if (!page?.access_token) throw new CollectorError('ACCOUNT_MISMATCH', managed.hasMore ? '관리 페이지 목록을 모두 받지 못해 해당 페이지의 관리 권한을 확인할 수 없습니다.' : '등록한 페이지를 관리하는 Facebook 계정을 연결해 주세요. 페이지 ID 주소로도 확인할 수 있습니다.');
    accessToken = page.access_token;
  }
  page = await api('me', { fields: 'id,name,username,link,fan_count,followers_count' });
  if (!page?.id || !facebookMatches(channel, page) || (credentials.accountId && credentials.accountId !== String(page.id))) throw mismatch();
  const pageId = graphId(String(page.id));
  const list = await graphList(`${pageId}/posts`, { fields: 'id,message,created_time,permalink_url,attachments{target},shares,reactions.type(LIKE).limit(0).summary(true),comments.limit(0).summary(true)' }, api, cap, recent, post => post.created_time);
  const posts = list.entries.map(post => ({ externalId: String(post.id), url: safeUrl(post.permalink_url), title: text(post.message), publishedAt: isoDate(post.created_time), thumbnailUrl: null, metrics: metrics({ likes: post.reactions?.summary?.total_count, comments: post.comments?.summary?.total_count, shares: post.shares?.count }) }));
  const warnings = [...list.warnings, 'Facebook 영상의 views와 게시물의 LIKE 반응을 원 API 값으로 기록합니다. 일반 게시물 조회수·저장·도달과 응답에 없는 공유 수는 미확인입니다.'];
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
    }catch(error){if(error.code==='CANCELLED')throw error;optionalFailure(error,recent,true);videosPartial=true;warnings.push('Facebook 영상·릴스 목록을 확인하지 못해 전체 게시물 수와 영상 조회수는 일부 수집입니다.');}
  }else{hasMore=true;warnings.push(capWarning(cap));}
  const collected=result({ externalId: pageId, displayName: text(page.name) || channel.handle || pageId, followers: number(page.followers_count), views: null, metrics: { likes: number(page.fan_count) } }, posts, { warnings, partial:videosPartial,hasMore, pages, ownerAuthorized: true, source: 'facebook-pages-api', unavailable: ['saves', 'reach', 'channel.views',...(posts.some(p=>p.metrics.views!==null)?[]:['views'])] });
  if(videosPartial)collected.coverage.inventoryComplete=false;
  return collected;
}

/**
 * Collect one registered URL. Credentials are supplied by encrypted server config;
 * this module never persists, logs, or returns them.
 */
export async function collectChannel(input, credentials = {}, options = {}) {
  const { fetchImpl = globalThis.fetch, signal } = options;
  const channel = normalizeChannelUrl(typeof input === 'string' ? input : input?.canonicalUrl || input?.url);
  if (input?.platform && input.platform !== channel.platform) throw mismatch();
  if (typeof fetchImpl !== 'function') throw new CollectorError('INVALID_CONFIG', '수집 연결을 시작할 수 없습니다.');
  const recent = recentWindow(options, credentials);
  const request = makeRequester({ fetchImpl, signal });
  if (channel.platform === 'youtube') return recentResult(await youtube(channel, credentials, request, recent), recent);
  if (channel.platform === 'tiktok') return recentResult(await tiktok(channel, credentials, request, recent), recent);
  if (channel.platform === 'instagram') return recentResult(await instagram(channel, credentials, request, recent), recent);
  if (channel.platform === 'facebook') return recentResult(await facebook(channel, credentials, request, recent), recent);
  throw new CollectorError('MANUAL_ONLY', '이 플랫폼은 주소 등록과 수동 기록을 지원합니다. 자동 수집 연결은 아직 제공하지 않습니다.');
}
