import { instagramIdentity } from './meta-connection.mjs';

// Official read-only metadata APIs. Never fetch the supplied post URL or a
// provider-supplied pagination URL; only use a bounded cursor on these origins.
// https://developers.google.com/youtube/v3/docs/videos/list
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
const MAX_BYTES = 1024 * 1024;
const unavailable = reason => ({ ownerMatch: null, publishedAt: null, suggestedFormat: null, title: null, reason });
const line = value => typeof value === 'string' ? value.trim().split(/[\r\n]/, 1)[0].slice(0, 200) || null : null;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const id = value => typeof value === 'string' && /^\d{1,50}$/.test(value) ? value : null;
const secret = value => typeof value === 'string' && value.length <= 16000 && !/[\r\n]/.test(value) ? value.trim() : '';

async function json(response) {
  if (Number(response.headers?.get?.('content-length') || 0) > MAX_BYTES) throw Error('size');
  if (response.body?.getReader) {
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw Error('size'); }
        chunks.push(Buffer.from(part.value));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { reader.releaseLock(); }
  }
  // Small synthetic fetch responses in tests need not implement streams.
  const raw = response.text ? await response.text() : JSON.stringify(await response.json());
  if (Buffer.byteLength(raw) > MAX_BYTES) throw Error('size');
  return JSON.parse(raw);
}

export async function lookupPerformancePost({ channel, normalized, originalUrl, credentials = {}, normalizeUrl, fetchImpl = globalThis.fetch, signal, check = () => {} }) {
  const request = async (origin, path, params, token) => {
    check();
    const url = new URL(path, origin);
    for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
    const timeout = AbortSignal.timeout(15000), requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const response = await fetchImpl(url.href, { method: 'GET', redirect: 'error', headers: { Accept: 'application/json', 'Cache-Control': 'no-store', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: requestSignal });
    check(); const data = await json(response); check();
    if (!response.ok || data?.error) throw Error('provider');
    return data;
  };
  if (channel.platform === 'youtube') {
    const token = secret(credentials.accessToken), apiKey = secret(credentials.apiKey);
    if (!token && !apiKey) return unavailable('유튜브 조회 연결이 없어요. 채널·수집의 연결 관리에서 연결해 주세요.');
    if (!/^UC[\w-]{22}$/.test(channel.externalId || '')) return unavailable('연결된 유튜브 채널 ID를 아직 확인하지 못했어요. 채널 연결을 확인해 주세요.');
    const data = await request('https://www.googleapis.com', '/youtube/v3/videos', { part: 'snippet,contentDetails,status', id: normalized.externalId, ...(!token ? { key: apiKey } : {}) }, token);
    if (!Array.isArray(data.items)) throw Error('response');
    const video = data.items.find(item => item?.id === normalized.externalId);
    if (!video) return unavailable('유튜브에서 이 영상을 찾지 못했어요. 공개 상태와 게시 주소를 확인해 주세요.');
    if (!video.snippet?.channelId) return unavailable('유튜브가 게시한 채널 정보를 보내지 않아 소유를 확인하지 못했어요.');
    if (video.snippet.channelId !== channel.externalId) return { ...unavailable('선택한 채널과 영상을 올린 채널이 달라요.'), ownerMatch: false };
    if (video.status?.privacyStatus && video.status.privacyStatus !== 'public') return unavailable('공개된 유튜브 영상만 등록할 수 있어요. 영상의 공개 상태를 확인해 주세요.');
    const publishedAt = date(video.snippet.publishedAt), duration = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(video.contentDetails?.duration || '');
    const seconds = duration ? Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0) : null;
    const shortAddress = /^\/shorts\//.test(new URL(originalUrl).pathname);
    return { ownerMatch: true, publishedAt, title: line(video.snippet.title), suggestedFormat: shortAddress || seconds !== null && seconds > 0 && seconds <= 180 ? 'youtube-shorts' : seconds !== null ? 'youtube-video' : null,
      reason: publishedAt ? null : '영상 소유는 확인했지만 게시 시각을 받지 못했어요. 잠시 후 다시 확인해 주세요.' };
  }
  if (channel.platform === 'instagram') {
    const token = secret(credentials.accessToken);
    if (!token) return unavailable('인스타그램 조회 연결이 없어요. 채널·수집의 연결 관리에서 연결해 주세요.');
    const direct = credentials.authType === 'instagram-login' || credentials.loginType === 'instagram', version = credentials.apiVersion || 'v26.0';
    if (!/^v\d{1,2}\.\d{1,2}$/.test(version)) return unavailable('인스타그램 연결의 API 버전을 확인해 주세요.');
    const origin = direct ? 'https://graph.instagram.com' : 'https://graph.facebook.com', accountId = direct ? 'me' : id(credentials.accountId);
    if (!accountId) return unavailable('연결된 인스타그램 계정 ID를 확인해 주세요.');
    const get = (path, params) => request(origin, `/${version}/${path}`, params, token);
    const user = await get(accountId, { fields: direct ? 'id,user_id,username' : 'id,username' });
    const identity = direct ? instagramIdentity(user, { requireUserId: credentials.metaIdentityVersion === 1 }) : { id: id(user.id), appScopedId: null, username: user.username };
    if (!identity.id || !identity.username) return unavailable('인스타그램에서 계정 정보를 확인하지 못했어요. 연결을 확인해 주세요.');
    const ids = new Set([identity.id, identity.appScopedId].filter(Boolean));
    if (!channel.externalId && !channel.handle || channel.externalId && !ids.has(channel.externalId) || channel.handle && channel.handle.replace(/^@/, '').toLowerCase() !== identity.username.toLowerCase() || credentials.accountId && !ids.has(credentials.accountId)) return unavailable('연결된 인스타그램 계정과 선택한 채널이 달라요. 연결 관리에서 다시 확인해 주세요.');
    const cursors = new Set(); let after;
    for (let page = 0; page < 3; page++) {
      const data = await get(`${identity.id}/media`, { fields: 'id,permalink,timestamp,media_product_type,caption', limit: 100, after });
      if (!Array.isArray(data.data)) throw Error('response');
      const media = data.data.slice(0, 100).find(item => { try { return !!item.id && normalizeUrl(item.permalink).identity === normalized.identity; } catch { return false; } });
      if (media) {
        const publishedAt = date(media.timestamp);
        return { ownerMatch: true, publishedAt, title: line(media.caption), suggestedFormat: media.media_product_type === 'REELS' ? 'instagram-reels' : null,
          reason: publishedAt ? null : '게시물 소유는 확인했지만 게시 시각을 받지 못했어요. 잠시 후 다시 확인해 주세요.' };
      }
      if (!data.paging?.next) break;
      const next = data.paging?.cursors?.after;
      if (typeof next !== 'string' || !next || next.length > 2048 || cursors.has(next)) break;
      cursors.add(next); after = next;
    }
    return unavailable('연결된 인스타그램 계정의 최근 게시물에서 이 주소를 찾지 못했어요. 오래된 게시물이나 삭제된 게시물인지 확인해 주세요.');
  }
  return unavailable('이 플랫폼은 게시 정보를 자동으로 확인하지 못해요. 실제 게시 시각을 직접 입력해 주세요.');
}
