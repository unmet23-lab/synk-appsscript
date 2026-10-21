'use strict';
/**
 * 평소 대비 배수 — 「그 편 조회수 ÷ 그 계정 최근 12편 조회수의 중앙값」(제작 방식 v2 §1·§6, 2026-10-21).
 *
 * 기준은 쇼츠 탭 맨 앞 12편이다(최신순, 그 편이 12편 안에 있어도 빼지 않는다). 평균 대신 중앙값이라 한 편만 크게 터진 계정에서도
 * 기준이 흔들리지 않는다. 숫자를 못 읽은 계정은 「못 잼」으로 둔다 — 0으로 채우지 않는다.
 *
 * 쓰는 곳
 *   - tools/평소배수.js — 유튜브 채널·영상 주소로 바로 잰다(월요일 스캔의 「같은 분야 계정에서 평소보다 크게 터진 게시물」 고르기).
 *   - tools/게시성과.js — 우리 계정 판정 줄의 배수 칸. 회사 서버가 하루 한 번 모은 게시물별 숫자(snapshots)로 그 시각의 12편을 잰다.
 *
 * 유튜브 쇼츠 탭 목록은 업로드 재생목록의 쇼츠판(UUSH + 채널 ID 셋째 글자부터)으로 읽는다. 공식 문서에 없는 재생목록이라
 * 못 읽으면(404·빈 목록) 업로드 재생목록에서 3분 이하 영상만 고르고 그렇게 쟀다고 남긴다.
 * 읽기만 한다 — 게시·수정·댓글을 하지 않는다. 자격 값은 출력하지 않는다.
 */

const KEEP = 12;

function median(values) {
  const sorted = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 배수 — 중앙값이 없거나 0이면 null(「못 잼」). 소수 둘째 자리까지. */
function multiple(value, middle) {
  if (typeof value !== 'number' || !Number.isFinite(value) || typeof middle !== 'number' || !(middle > 0)) return null;
  return Math.round((value / middle) * 100) / 100;
}

/**
 * 그 시각(at)의 쇼츠 탭 맨 앞 count편을 게시물 목록과 하루 숫자로 다시 세운다.
 *   posts: [{id, publishedAt}] — 같은 채널·같은 형식만 넘긴다
 *   viewsAt(postId, atMs): 그 시각까지 읽은 가장 늦은 조회수 또는 null
 *   self: {id, publishedAt, views} — 판정하는 그 편(그 시각에 관측한 값을 쓴다)
 * 맨 앞 count편을 먼저 정하고 그 안에서 숫자가 있는 편만 쓴다(쇼츠 탭과 같은 12편 — 숫자 없는 편 대신 더 옛 편을 끌어오지 않는다).
 * → {median, n, at, items:[{id, views}], missing} · 하나도 못 읽으면 median null
 */
function baselineAt({ posts, viewsAt, at, count = KEEP, self = null }) {
  const atMs = typeof at === 'number' ? at : Date.parse(at);
  const list = posts.filter(p => Date.parse(p.publishedAt) <= atMs && (!self || p.id !== self.id));
  if (self && Date.parse(self.publishedAt) <= atMs) list.push({ id: self.id, publishedAt: self.publishedAt, self: true });
  list.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || String(a.id).localeCompare(String(b.id)));
  const items = [];
  let missing = 0;
  for (const p of list.slice(0, count)) {
    const views = p.self ? self.views : viewsAt(p.id, atMs);
    if (typeof views === 'number' && Number.isFinite(views)) items.push({ id: p.id, views });
    else missing += 1;
  }
  return { median: median(items.map(i => i.views)), n: items.length, at: new Date(atMs).toISOString(), items, missing };
}

// ── 유튜브(공개 숫자, Data API v3) ─────────────────────────────────────────

const YT = 'https://www.googleapis.com/youtube/v3/';

/** 유튜브 주소·핸들·채널 ID를 읽는다 → {kind:'video', id} | {kind:'handle', handle} | {kind:'channel', id} | null */
function youtubeTarget(text) {
  const raw = String(text || '').trim();
  if (/^@[\w.-]{2,}$/.test(raw)) return { kind: 'handle', handle: raw.slice(1) };
  if (/^UC[\w-]{22}$/.test(raw)) return { kind: 'channel', id: raw };
  if (/^[\w-]{11}$/.test(raw)) return { kind: 'video', id: raw };
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch { return null; }
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; return /^[\w-]{11}$/.test(id) ? { kind: 'video', id } : null; }
  if (host !== 'youtube.com') return null;
  const v = u.searchParams.get('v');
  if (u.pathname === '/watch' && /^[\w-]{11}$/.test(v || '')) return { kind: 'video', id: v };
  const m = /^\/(shorts|live|embed)\/([\w-]{11})/.exec(u.pathname);
  if (m) return { kind: 'video', id: m[2] };
  const h = /^\/@([\w.-]{2,})/.exec(u.pathname);
  if (h) return { kind: 'handle', handle: decodeURIComponent(h[1]) };
  const c = /^\/channel\/(UC[\w-]{22})/.exec(u.pathname);
  if (c) return { kind: 'channel', id: c[1] };
  return null;
}

/** ISO 8601 길이(PT1M5S) → 초 */
function seconds(duration) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(duration || ''));
  if (!m) return null;
  return (Number(m[1] || 0) * 86400) + (Number(m[2] || 0) * 3600) + (Number(m[3] || 0) * 60) + Number(m[4] || 0);
}

function youtubeClient({ token, fetchImpl = fetch }) {
  return async function api(resource, params) {
    const url = YT + resource + '?' + new URLSearchParams(params);
    const response = await fetchImpl(url, { headers: { authorization: 'Bearer ' + token } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`YouTube ${resource} ${response.status}: ${body?.error?.message || '응답 오류'}`);
      error.status = response.status;
      throw error;
    }
    return body;
  };
}

/** 채널 하나 → {id, title, handle} */
async function youtubeChannel(api, target) {
  let params;
  if (target.kind === 'handle') params = { part: 'id,snippet', forHandle: target.handle };
  else if (target.kind === 'channel') params = { part: 'id,snippet', id: target.id };
  else {
    const v = (await api('videos', { part: 'snippet', id: target.id })).items?.[0];
    if (!v) throw new Error(`영상 ${target.id}을 찾지 못했다`);
    params = { part: 'id,snippet', id: v.snippet.channelId };
  }
  const c = (await api('channels', params)).items?.[0];
  if (!c) throw new Error('채널을 찾지 못했다');
  return { id: c.id, title: c.snippet?.title || '', handle: c.snippet?.customUrl || '' };
}

async function videoStats(api, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const body = await api('videos', { part: 'snippet,statistics,contentDetails', id: ids.slice(i, i + 50).join(','), maxResults: '50' });
    for (const v of body.items || []) {
      out.set(v.id, {
        id: v.id, title: v.snippet?.title || '', publishedAt: v.snippet?.publishedAt || null,
        views: v.statistics?.viewCount === undefined ? null : Number(v.statistics.viewCount),
        seconds: seconds(v.contentDetails?.duration),
      });
    }
  }
  return out;
}

/**
 * 채널 쇼츠 탭(tab 'shorts') 또는 동영상 탭(tab 'videos', 롱폼) 맨 앞 count편 → {channel, items:[{id,title,publishedAt,views}], median, n, how}
 * how: 'shorts-playlist'·'videos-playlist'(그 탭과 같은 목록) | 'uploads-3min'·'uploads-long'(업로드를 3분으로 갈라 고름)
 */
async function youtubeShortsTab({ target, token, fetchImpl = fetch, count = KEEP, tab = 'shorts' }) {
  const api = youtubeClient({ token, fetchImpl });
  const channel = await youtubeChannel(api, target);
  const rest = channel.id.slice(2);
  const long = tab === 'videos';
  let ids = [];
  let how = long ? 'videos-playlist' : 'shorts-playlist';
  try {
    const body = await api('playlistItems', { part: 'contentDetails', playlistId: (long ? 'UULF' : 'UUSH') + rest, maxResults: String(Math.min(50, count)) });
    ids = (body.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  let stats;
  if (!ids.length) {
    how = long ? 'uploads-long' : 'uploads-3min';
    const body = await api('playlistItems', { part: 'contentDetails', playlistId: 'UU' + rest, maxResults: '50' });
    const all = (body.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
    stats = await videoStats(api, all);
    ids = all.filter(id => { const s = stats.get(id); return s && s.seconds !== null && (long ? s.seconds > 180 : s.seconds <= 180); }).slice(0, count);
  } else {
    ids = ids.slice(0, count);
    stats = await videoStats(api, ids);
  }
  const items = ids.map(id => stats.get(id)).filter(Boolean);
  const views = items.map(i => i.views).filter(v => v !== null);
  return { channel, items, median: median(views), n: views.length, how };
}

/** 영상 하나의 공개 숫자 */
async function youtubeVideo({ id, token, fetchImpl = fetch }) {
  const api = youtubeClient({ token, fetchImpl });
  return (await videoStats(api, [id])).get(id) || null;
}

module.exports = { KEEP, median, multiple, baselineAt, youtubeTarget, youtubeShortsTab, youtubeVideo, seconds };
