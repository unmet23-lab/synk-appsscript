import { createHash, randomUUID } from 'node:crypto';
import { collectChannel, PLATFORM_CAPABILITIES } from './collectors.mjs';
import { canReadChannel, canWriteChannel } from './organization.mjs';

const KIND = 'postPerformanceEntries', LOCKS = 'postPerformanceLocks';
const HOUR = 3600000, WINDOW = 6 * HOUR, LEASE = 3 * 60000, MAX_ATTEMPTS = 3;
export const POST_PERFORMANCE_METRICS = Object.freeze([
  { id: 'views', label: '조회', unit: 'count' }, { id: 'likes', label: '좋아요', unit: 'count' },
  { id: 'comments', label: '댓글', unit: 'count' }, { id: 'shares', label: '공유', unit: 'count' },
  { id: 'saves', label: '저장', unit: 'count' }, { id: 'reach', label: '도달', unit: 'count' },
  { id: 'earlyRetention3sPct', label: '3초 유지율', unit: 'percent', max: 100, description: '재생을 시작한 시청 중 3초 지점까지 유지된 비율입니다. 다른 초 지점의 유지율은 넣지 않습니다.' },
  { id: 'averageWatchSeconds', label: '평균 시청 시간', unit: 'seconds', description: '이 게시물의 평균 시청 시간을 초로 입력합니다. 총 시청 시간이 아닙니다.' },
  { id: 'completionRatePct', label: '완주율', unit: 'percent', max: 100, description: '재생 시작 대비 영상 끝까지 시청한 비율입니다.' },
  { id: 'toolVisits', label: '맞춤 도구 유입', unit: 'count', description: '이 게시물에 연결한 구분 가능한 링크에서 확인한 도구 유입 수입니다. 채널 전체 방문 수는 넣지 않습니다.' },
]);
const metricIds = POST_PERFORMANCE_METRICS.map(metric => metric.id);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const cleanText = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const emptyMetrics = () => Object.fromEntries(metricIds.map(key => [key, null]));
const iso = (value, label = '시각') => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw fail(`${label}에는 시간대를 포함한 날짜와 시간을 입력해 주세요.`);
  const date = new Date(value), day = value.slice(0, 10).split('-').map(Number);
  if (!Number.isFinite(date.getTime()) || day[1] < 1 || day[1] > 12 || day[2] < 1 || day[2] > new Date(Date.UTC(day[0], day[1], 0)).getUTCDate()) throw fail(`${label}을 확인해 주세요.`);
  return date.toISOString();
};
const atPlus = (value, amount) => new Date(Date.parse(value) + amount).toISOString();

/** Parse an exact public post URL. Input URLs are never fetched. */
export function normalizePerformancePostUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || /[\\\u0000-\u0020]/u.test(input.trim())) throw fail('게시물의 정확한 HTTPS 주소를 입력해 주세요.');
  let url; try { url = new URL(input.trim()); } catch { throw fail('게시물의 정확한 HTTPS 주소를 입력해 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || /%(?:2f|5c|00)/i.test(url.pathname)) throw fail('게시물의 정확한 HTTPS 주소를 입력해 주세요.');
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
  throw fail('지원하는 플랫폼의 게시물 주소를 입력해 주세요. 프로필·단축·공유 링크는 사용할 수 없습니다.');
}

function valuesAndReasons(values, platform, { manual = false, unavailable = [] } = {}) {
  const supported = new Set(PLATFORM_CAPABILITIES.find(item => item.id === platform)?.metrics || []), metrics = {}, unavailableReasons = {};
  for (const key of metricIds) {
    const value = values?.[key], definition = POST_PERFORMANCE_METRICS.find(item => item.id === key);
    const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0 && (definition.unit !== 'count' || Number.isSafeInteger(value)) && (definition.max === undefined || value <= definition.max);
    if (manual && value !== undefined && value !== null && value !== '' && !valid) throw fail(definition.unit === 'percent' ? '비율은 0~100% 사이 숫자로 입력해 주세요.' : definition.unit === 'seconds' ? '시청 시간은 0 이상의 초 단위 숫자로 입력해 주세요.' : '성과 횟수는 0 이상의 정수로 입력해 주세요.');
    metrics[key] = valid && (manual || supported.has(key)) ? value : null;
    if (metrics[key] === null) unavailableReasons[key] = manual ? '직접 확인한 값이 입력되지 않았습니다.' : !supported.has(key) || unavailable.includes(key) ? '현재 플랫폼 연결에서 제공하지 않는 지표입니다.' : '이 게시물의 수치를 API 응답에서 확인하지 못했습니다.';
  }
  return { metrics, unavailableReasons };
}

export function createPostPerformanceService({ store, clock = () => new Date().toISOString(), collector = collectChannel,
  getCredentials = channel => ({ ...store.secret(`provider:${channel.platform}`), ...store.secret(`channel:${channel.id}`) }),
  isConnected = channel => !channel.collectionDisabled && !!(store.secret(`channel:${channel.id}`)?.accessToken || channel.platform === 'youtube' && (store.secret(`channel:${channel.id}`)?.apiKey || store.secret('provider:youtube')?.apiKey)),
} = {}) {
  if (!store) throw new Error('Post performance requires a store.');
  const activeJobs = new Set(), controllers = new Set();
  let stopped = false;
  const stamp = () => iso(clock(), '서버 시각');
  function currentUser(user) {
    const live = user?.id && store.get('users', user.id);
    if (!live || live.active === false) throw fail('현재 로그인 정보를 확인해 주세요.', 403);
    return live;
  }
  function channelFor(user, id, write = false) {
    user = currentUser(user); const channel = store.get('channels', id);
    if (!channel || channel.active === false || !(write ? canWriteChannel : canReadChannel)(user, channel)) throw fail('담당 채널을 찾을 수 없습니다.', 404);
    return channel;
  }
  function accessEntry(user, id, write = false) {
    const row = store.get(KIND, id); if (!row) throw fail('게시물 기록을 찾을 수 없습니다.', 404);
    channelFor(user, row.channelId, write); return row;
  }
  function comparison(row, checkpoint, all) {
    const prior = all.filter(other => other.id !== row.id && other.channelId === row.channelId && other.publishedAt < row.publishedAt)
      .map(other => other.checkpoints.find(item => item.hours === checkpoint.hours))
      .filter(item => item?.status === 'recorded' && item.observedAt && Date.parse(item.observedAt) <= Date.parse(item.closesAt));
    return Object.fromEntries(metricIds.map(key => {
      const meta = checkpoint.metricProvenance?.[key], unit = POST_PERFORMANCE_METRICS.find(item => item.id === key).unit;
      const currentValid = checkpoint.status === 'recorded' && meta && !meta.measurementWindowMissed;
      const values = currentValid ? prior.filter(item => {
        const previous = item.metricProvenance?.[key];
        return previous && !previous.measurementWindowMissed && previous.unit === unit && previous.source === meta.source
          && Math.abs((Date.parse(previous.observedAt) - Date.parse(item.dueAt)) - (Date.parse(meta.observedAt) - Date.parse(checkpoint.dueAt))) <= 15 * 60000;
      }).map(item => item.metrics?.[key]).filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b) : [];
      const middle = Math.floor(values.length / 2), median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : null;
      const value = currentValid ? checkpoint.metrics[key] : null;
      return [key, { sampleCount: values.length, median, delta: value !== null && value !== undefined && median !== null ? value - median : null, deltaPercent: value !== null && value !== undefined && median > 0 ? Math.round((value - median) / median * 1000) / 10 : null }];
    }));
  }
  function view(user, row, all = store.all(KIND)) {
    const channel = channelFor(user, row.channelId), writable = canWriteChannel(currentUser(user), channel);
    return { ...structuredClone(row), channelName: channel.displayName || channel.handle || channel.id, canEdit: writable,
      checkpoints: row.checkpoints.map(checkpoint => { const { leaseToken, leaseUntil, ...safe } = checkpoint; return { ...structuredClone(safe), comparison: comparison(row, checkpoint, all) }; }) };
  }
  function list(user) {
    user = currentUser(user); const all = store.all(KIND);
    const channels = store.all('channels').filter(channel => channel.active !== false && canReadChannel(user, channel));
    const readable = new Set(channels.map(channel => channel.id));
    return { entries: all.filter(row => readable.has(row.channelId)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(row => view(user, row, all)),
      channels: channels.map(channel => ({ id: channel.id, platform: channel.platform, displayName: channel.displayName || channel.handle || channel.id, canEdit: canWriteChannel(user, channel), connected: isConnected(channel) })),
      canWrite: channels.some(channel => canWriteChannel(user, channel)), metricDefinitions: POST_PERFORMANCE_METRICS, checkpointHours: [24, 72], captureWindowHours: 6 };
  }
  function register(user, input = {}) {
    const channel = channelFor(user, input.channelId, true), url = normalizePerformancePostUrl(input.url), at = stamp(), publishedAt = iso(input.publishedAt, '게시 시각');
    const publicationFormat=input.publicationFormat||null;
    if(publicationFormat&&!['youtube-shorts','youtube-video','instagram-reels'].includes(publicationFormat))throw fail('게시한 영상 형식을 확인해 주세요.');
    if(publicationFormat&&(!input.publicationPackageId||!publicationFormat.startsWith(channel.platform==='youtube'?'youtube-':channel.platform==='instagram'?'instagram-':'unsupported-')))throw fail('게시 묶음과 계정에 맞는 영상 형식을 선택해 주세요.');
    if (url.platform !== channel.platform) throw fail('게시물과 담당 채널의 플랫폼이 다릅니다.');
    if (url.handle && channel.handle && url.handle.toLowerCase() !== channel.handle.toLowerCase()) throw fail('게시물 주소와 담당 채널의 계정이 다릅니다.');
    if (Date.parse(publishedAt) > Date.parse(at)) throw fail('실제로 공개한 게시물만 등록할 수 있습니다. 게시 시각을 확인해 주세요.');
    const id = createHash('sha256').update(`${channel.id}\0${url.identity}`).digest('hex');
    const result = store.transaction(() => {
      const previous = store.get(KIND, id);
      if(previous){
        if(publicationFormat&&previous.publicationFormat&&previous.publicationFormat!==publicationFormat)throw fail('이미 다른 영상 형식으로 연결한 게시 주소입니다.',409);
        if(input.publicationPackageId&&previous.publicationPackageId&&previous.publicationPackageId!==input.publicationPackageId)throw fail('이미 다른 게시 묶음에 연결한 주소입니다.',409);
        if(publicationFormat&&!previous.publicationFormat&&(!previous.publicationPackageId||previous.publicationPackageId===input.publicationPackageId)){
          const linked={...previous,publicationPackageId:input.publicationPackageId,publicationFormat,updatedAt:at};
          store.put(KIND,id,linked);return {row:linked,existing:true,linked:true};
        }
        return {row:previous,existing:true};
      }
      if (store.all(KIND).filter(row => row.channelId === channel.id).length >= 2000) throw fail('이 채널의 성과 기록 한도에 도달했습니다.', 409);
      const row = { id, channelId: channel.id, platform: channel.platform, url: url.canonicalUrl, postIdentity: url.identity, title: cleanText(input.title), publicationPackageId: cleanText(input.publicationPackageId, 100) || null,
        publicationFormat, publishedAt, active: true, createdAt: at, updatedAt: at, createdBy: user.id, checkpoints: [24, 72].map(hours => {
          const dueAt = atPlus(publishedAt, hours * HOUR), closesAt = atPlus(dueAt, WINDOW), missed = at > closesAt;
          return { hours, dueAt, closesAt, status: missed ? 'missed' : 'pending', timing: missed ? 'missed' : null, observedAt: null, recordedAt: null, delayMinutes: null, recordingDelayMinutes: null,
            metrics: emptyMetrics(), unavailableReasons: Object.fromEntries(metricIds.map(key => [key, '아직 확인한 값이 없습니다. 실제 0과 구분합니다.'])), source: null, attempts: 0, nextAttemptAt: null, message: missed ? '등록 전에 관측 시간이 지나 과거 수치를 자동 복원할 수 없습니다.' : null };
        }) };
      store.put(KIND, id, row); return { row, existing: false };
    });
    return { entry: view(user, result.row), existing: result.existing, ...(result.linked?{linked:true}:{}) };
  }
  function observation(checkpoint, values, { observedAt, recordedAt, source, note = '', unavailable = [], platform, manual = false }) {
    const delayMinutes = Math.max(0, Math.round((Date.parse(observedAt) - Date.parse(checkpoint.dueAt)) / 60000));
    const normalized = valuesAndReasons(values, platform, { manual, unavailable }), timing = delayMinutes > 15 ? 'late' : 'on-time', measurementWindowMissed = Date.parse(observedAt) > Date.parse(checkpoint.closesAt);
    const metricProvenance = Object.fromEntries(POST_PERFORMANCE_METRICS.filter(item => normalized.metrics[item.id] !== null).map(item => [item.id, { source, observedAt, recordedAt, unit: item.unit, timing, measurementWindowMissed }]));
    return { ...checkpoint, ...normalized, metricProvenance, status: 'recorded', timing, observedAt, recordedAt,
      delayMinutes, recordingDelayMinutes: Math.max(0, Math.round((Date.parse(recordedAt) - Date.parse(checkpoint.dueAt)) / 60000)), source, note,
      nextAttemptAt: null, lastErrorCode: null, measurementWindowMissed,
      message: manual ? '사용자가 직접 확인한 누적값입니다. 확인 시각과 서버 기록 시각을 구분합니다.' : '서버가 이 시각에 관측한 누적값입니다. 정확한 목표 시각의 과거 분석값은 아닙니다.' };
  }
  function manualCheckpoint(user, id, hours, input = {}) {
    hours = Number(hours); if (![24, 72].includes(hours)) throw fail('24시간 또는 72시간 확인을 선택해 주세요.');
    const result = store.transaction(() => {
      const row = accessEntry(user, id, true), at = stamp(), checkpoint = row.checkpoints.find(item => item.hours === hours);
      const observedAt = input.measuredAt ? iso(input.measuredAt, '직접 확인 시각') : at;
      if (observedAt > at || observedAt < checkpoint.dueAt) throw fail('직접 확인 시각은 목표 시각 이후이면서 현재 시각 이전이어야 합니다.');
      if (checkpoint.status === 'collecting' && checkpoint.leaseUntil > at) throw fail('서버에서 수집 중입니다. 잠시 뒤 다시 확인해 주세요.', 409);
      const values = valuesAndReasons(input.metrics, row.platform, { manual: true });
      if (!Object.values(values.metrics).some(value => value !== null)) throw fail('직접 확인한 수치를 하나 이상 입력해 주세요.');
      let updated;
      if (checkpoint.status === 'recorded') {
        const keys = metricIds.filter(key => values.metrics[key] !== null);
        if (keys.some(key => checkpoint.metrics[key] !== null && checkpoint.metrics[key] !== undefined)) throw fail('이미 기록한 지표는 덮어쓸 수 없습니다. 값이 없는 지표만 보완해 주세요.', 409);
        const supplemental = observation(checkpoint, values.metrics, { observedAt, recordedAt: at, source: 'manual', note: cleanText(input.note, 1000), platform: row.platform, manual: true });
        const unavailableReasons = { ...checkpoint.unavailableReasons }; for (const key of keys) delete unavailableReasons[key];
        const supplement = { source: 'manual', observedAt, recordedAt: at, metrics: Object.fromEntries(keys.map(key => [key, values.metrics[key]])), note: supplemental.note };
        updated = { ...checkpoint, metrics: { ...checkpoint.metrics, ...supplement.metrics }, unavailableReasons,
          metricProvenance: { ...checkpoint.metricProvenance, ...supplemental.metricProvenance }, hasManualSupplement: true,
          supplements: [...(checkpoint.supplements || []), supplement], latestRecordedAt: at };
      } else updated = observation(checkpoint, values.metrics, { observedAt, recordedAt: at, source: 'manual', note: cleanText(input.note, 1000), platform: row.platform, manual: true });
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
    if (PLATFORM_CAPABILITIES.find(item => item.id === channel?.platform)?.mode === 'manual') return '이 플랫폼은 자동 수집을 지원하지 않아 직접 수치 입력이 필요합니다.';
    if (!channel || channel.active === false || !isConnected(channel)) return '담당 채널의 공식 연결이 없어 직접 입력하거나 채널 연결을 확인해야 합니다.';
    return null;
  }
  function setActive(user, id, active) {
    if (typeof active !== 'boolean') throw fail('자동 확인의 시작 또는 중지를 선택해 주세요.');
    const next = store.transaction(() => {
      const row = accessEntry(user, id, true), updated = { ...row, active, updatedAt: stamp() };
      store.put(KIND, id, updated); return updated;
    });
    return { entry: view(user, next) };
  }
  async function collectDueWork({ user = null, entryId = null, signal, authorize } = {}) {
    authorize?.();
    if (entryId) accessEntry(user, entryId, true);
    const requester = user ? currentUser(user) : null;
    const summary = { checked: 0, recorded: 0, manualRequired: 0, missed: 0, retried: 0, skipped: 0 };
    const initial = stamp(), candidateChannels = [...new Set(store.all(KIND).filter(row => row.active !== false && (!entryId || row.id === entryId) && (!requester || canWriteChannel(requester, store.get('channels', row.channelId))) && row.checkpoints.some(checkpoint => eligible(checkpoint, initial))).map(row => row.channelId))].slice(0, 20);
    for (const channelId of candidateChannels) {
      if (signal?.aborted) break;
      authorize?.();
      const token = randomUUID(), claim = store.transaction(() => {
        const at = stamp(), lock = store.get(LOCKS, channelId); if (lock?.leaseUntil > at) return null;
        const channel = store.get('channels', channelId), selected = [];
        if (requester) channelFor(requester, channelId, true);
        for (const row of store.all(KIND).filter(row => row.active !== false && row.channelId === channelId && (!entryId || row.id === entryId))) {
          let changed = false;
          const checkpoints = row.checkpoints.map(checkpoint => {
            if (!eligible(checkpoint, at)) return checkpoint;
            summary.checked++; changed = true;
            if (at > checkpoint.closesAt) { summary.missed++; return { ...checkpoint, status: 'missed', timing: 'missed', nextAttemptAt: null, message: '관측 시간이 지나 해당 시점의 수치를 자동 복원할 수 없습니다.' }; }
            const unavailable = !ownsAutomation(row, channel) ? '등록 담당자의 현재 권한을 확인해야 합니다. 현재 담당자가 직접 수치를 기록할 수 있습니다.' : availability(channel);
            if (unavailable) { summary.manualRequired++; return { ...checkpoint, status: 'manual-required', nextAttemptAt: atPlus(at, HOUR), message: unavailable }; }
            if (checkpoint.attempts >= MAX_ATTEMPTS) { summary.manualRequired++; return { ...checkpoint, status: 'manual-required', nextAttemptAt: checkpoint.closesAt, message: '자동 조회 재시도 한도에 도달했습니다. 직접 확인한 수치를 입력해 주세요.' }; }
            selected.push({ id: row.id, hours: checkpoint.hours });
            return { ...checkpoint, status: 'collecting', attempts: checkpoint.attempts + 1, attemptedAt: at, leaseToken: token, leaseUntil: atPlus(at, LEASE), nextAttemptAt: null };
          });
          if (changed) store.put(KIND, row.id, { ...row, updatedAt: at, checkpoints });
        }
        if (!selected.length) return null;
        store.put(LOCKS, channelId, { id: channelId, token, leaseUntil: atPlus(at, LEASE) });
        return { channel, selected, version: channel.connectionVersion || 0, at };
      });
      if (!claim) { summary.skipped++; continue; }
      let result = null, error = null;
      try {
        const credentials = await getCredentials(claim.channel), live = store.get('channels', channelId);
        authorize?.();
        if (live?.active === false || (live?.connectionVersion || 0) !== claim.version || availability(live)) throw Object.assign(new Error(), { code: 'CONNECTION_CHANGED' });
        const oldest = Math.min(...claim.selected.map(item => Date.parse(store.get(KIND, item.id).publishedAt)));
        const timeout = AbortSignal.timeout(120000), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
        result = await collector(live, credentials, { signal: combined, recentSince: new Date(oldest - HOUR).toISOString(), now: stamp(), maxPosts: 100, maxPages: 3 });
      } catch (caught) { error = { code: ['RATE_LIMITED', 'AUTH_REQUIRED', 'TIMEOUT', 'NETWORK_ERROR', 'MANUAL_ONLY', 'CONNECTION_CHANGED', 'ACCOUNT_MISMATCH', 'CANCELLED'].includes(caught?.code) ? caught.code : 'COLLECTION_FAILED', retryable: caught?.retryable === true }; }
      let authorizationLost = false;
      try { authorize?.(); if (requester) channelFor(requester, channelId, true); } catch { authorizationLost = true; }
      if (signal?.aborted) error = { code: 'CANCELLED', retryable: true };
      store.transaction(() => {
        const at = stamp(), lock = store.get(LOCKS, channelId), live = store.get('channels', channelId);
        if (lock?.token !== token) { summary.skipped++; return; }
        const connectionChanged = !live || live.active === false || (live.connectionVersion || 0) !== claim.version || availability(live);
        for (const selected of claim.selected) {
          const row = store.get(KIND, selected.id), checkpoint = row?.checkpoints.find(item => item.hours === selected.hours);
          if (!row || checkpoint?.leaseToken !== token || checkpoint.status !== 'collecting') continue;
          let next;
          if (authorizationLost || row.active === false || connectionChanged || !ownsAutomation(row, live)) {
            next = { ...checkpoint, status: 'manual-required', nextAttemptAt: atPlus(at, HOUR), message: '수집 중 연결 또는 담당 권한이 바뀌어 응답을 저장하지 않았습니다.' }; summary.manualRequired++;
          } else if (at > checkpoint.closesAt || lock.leaseUntil < at) {
            next = { ...checkpoint, status: 'missed', timing: 'missed', nextAttemptAt: null, message: '수집이 관측 시간 안에 끝나지 않아 해당 시점의 수치를 기록하지 않았습니다.' }; summary.missed++;
          } else {
            const post = result?.posts?.find(item => { try { return normalizePerformancePostUrl(item.url).identity === row.postIdentity; } catch { return false; } });
            const published = post?.publishedAt && Date.parse(post.publishedAt), mismatch = !!post && (!Number.isFinite(published) || Math.abs(published - Date.parse(row.publishedAt)) > 5 * 60000);
            const hasMetric = post && Object.values(valuesAndReasons(post.metrics, row.platform).metrics).some(value => value !== null);
            if (!error && post && !mismatch && hasMetric) {
              next = observation(checkpoint, post.metrics, { observedAt: at, recordedAt: at, source: `api:${cleanText(result.coverage?.source || row.platform, 80)}`, unavailable: result.coverage?.unavailableMetrics || [], platform: row.platform });
              next.providerPublishedAt = post.publishedAt; summary.recorded++;
            } else {
              const retryable = !mismatch && (!error || error.retryable), retry = retryable && checkpoint.attempts < MAX_ATTEMPTS;
              const delay = checkpoint.attempts === 1 ? 5 * 60000 : 15 * 60000;
              next = { ...checkpoint, status: retry ? 'retry' : 'manual-required', nextAttemptAt: retry ? atPlus(at, delay) : checkpoint.closesAt, lastErrorCode: mismatch ? 'PUBLISHED_AT_MISMATCH' : error?.code || (post ? 'METRICS_UNAVAILABLE' : 'POST_NOT_IN_RESPONSE'),
                message: mismatch ? '플랫폼 게시 시각과 등록한 시각이 달라 자동 기록하지 않았습니다. 실제 시각을 확인해 주세요.' : retry ? '이 게시물의 수치를 확인하지 못했습니다. 제한된 횟수 안에서 다시 확인합니다.' : '이 게시물의 자동 확인을 마치지 못했습니다. 공식 화면에서 확인한 수치를 직접 입력해 주세요.' };
              if (retry) summary.retried++; else summary.manualRequired++;
            }
          }
          delete next.leaseToken; delete next.leaseUntil;
          store.put(KIND, row.id, { ...row, updatedAt: at, checkpoints: row.checkpoints.map(item => item.hours === selected.hours ? next : item) });
        }
        store.remove(LOCKS, channelId);
      });
      if (authorizationLost) throw fail('로그인 권한이 변경되어 수집 결과를 저장하지 않았습니다.', 401);
    }
    return summary;
  }
  function collectDue(options = {}) {
    if (stopped) return Promise.reject(fail('서버가 종료 중입니다.', 503));
    const controller = new AbortController(); controllers.add(controller);
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const job = collectDueWork({ ...options, signal }); activeJobs.add(job);
    job.then(() => { activeJobs.delete(job); controllers.delete(controller); }, () => { activeJobs.delete(job); controllers.delete(controller); });
    return job;
  }
  const waitForIdle = async () => { await Promise.allSettled([...activeJobs]); };
  const stop = async () => { stopped = true; for (const controller of controllers) controller.abort(); await waitForIdle(); };
  return { register, list, manualCheckpoint, collectDue, setActive, waitForIdle, stop };
}
