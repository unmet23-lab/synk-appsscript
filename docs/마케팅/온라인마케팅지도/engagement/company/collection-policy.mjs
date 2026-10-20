/** Pure scheduling/status rules. No API requests, secrets, or growth estimates. */

// Minutes after each failure, for at most three automatic retries.
export const RETRY_DELAYS = Object.freeze([5, 20, 60]);
export const RATE_LIMIT_DELAY_MINUTES = 24 * 60;
export const RECENT_INTERVAL_MINUTES = 30;

const MINUTE = 60_000;
const KST_OFFSET = 9 * 60 * MINUTE;
const SUPPORTED = new Set(['youtube', 'instagram', 'facebook', 'tiktok']);
const BUSY = new Set(['collecting', 'queued', 'running']);
const AUTH_CODES = new Set([
  'AUTH_REQUIRED', 'CONNECTION_REQUIRED', 'ACCOUNT_MISMATCH', 'RECONNECT_REQUIRED',
  'TOKEN_EXCHANGE_FAILED', 'INVALID_GRANT', 'INVALID_TOKEN', 'TOKEN_EXPIRED',
  'ACCESS_TOKEN_EXPIRED', 'REFRESH_TOKEN_EXPIRED', 'ACCESS_DENIED',
  'UNAUTHORIZED', 'INSUFFICIENT_SCOPE', 'SCOPE_NOT_AUTHORIZED', 'PERMISSION_DENIED',
  // 연결한 사람의 회사 계정이 꺼지면 지금 담당자가 다시 연결해야 한다.
  'CONNECTION_OWNER_INACTIVE',
]);
const RATE_CODES = new Set(['RATE_LIMITED', 'RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS', 'QUOTA_EXCEEDED', 'QUOTA_EXHAUSTED', 'DAILY_LIMIT_EXCEEDED']);
// 다시 해도 되는 오류. 알 수 없는 오류·형식이 틀린 응답도 영구 오류로 굳히지 않고, 자동 재시도가 끝나면 다음 날 수집 시각에 다시 본다(10-20).
const TRANSIENT_CODES = new Set(['TIMEOUT', 'NETWORK_ERROR', 'COLLECTION_INTERRUPTED', 'CONNECTION_CHANGED', 'INVALID_RESPONSE', 'UNKNOWN_ERROR', 'CANCELLED']);
// 연결이 수집 도중 바뀌었으면 새 연결로 곧 다시 시도한다.
const RETRY_CODES = new Set(['CONNECTION_CHANGED']);
const KNOWN_CODES = new Set([...AUTH_CODES, ...RATE_CODES, ...TRANSIENT_CODES,
  'INVALID_CHANNEL_URL', 'INVALID_CONFIG', 'INVALID_API_TARGET',
  'CHANNEL_NOT_FOUND', 'API_ERROR',
  'UNSUPPORTED_PROVIDER', 'MANUAL_ONLY', 'INVALID_API_VERSION', 'INVALID_REDIRECT',
  'HTTPS_REQUIRED', 'INVALID_STATE', 'INVALID_PKCE', 'PROVIDER_NOT_CONFIGURED',
  'MISSING_CODE', 'OAUTH_TIMEOUT', 'OAUTH_UNAVAILABLE',
]);

const timestamp = value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const iso = value => { const time = timestamp(value); return time === null ? null : new Date(time).toISOString(); };
const kstDay = time => new Date(time + KST_OFFSET).toISOString().slice(0, 10);
const kstHour = time => new Date(time + KST_OFFSET).getUTCHours();
const active = channel => channel.active !== false;
const supported = channel => SUPPORTED.has(String(channel.platform || '').toLowerCase());
const count = value => Number.isInteger(value) && value >= 0 ? Math.min(value, RETRY_DELAYS.length) : 0;
const connected = (channel, explicit) => !channel.collectionDisabled && (typeof explicit === 'boolean' ? explicit : channel.connected === true);

function context({ at = new Date().toISOString(), enabled = true, hourKst = 9 } = {}) {
  const time = timestamp(at);
  if (time === null) throw new TypeError('수집 기준 시각은 올바른 날짜·시간이어야 합니다.');
  if (!Number.isInteger(hourKst) || hourKst < 0 || hourKst > 23) throw new RangeError('수집 시각은 한국 시간 0~23시여야 합니다.');
  return { at: new Date(time).toISOString(), time, day: kstDay(time), enabled: enabled === true, hourKst };
}

function safeCode(error) {
  const value = typeof error?.code === 'string' ? error.code.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[.-]/g, '_').toUpperCase() : '';
  if (KNOWN_CODES.has(value)) return value;
  // HTTP status can identify a rate limit but never infer retry permission.
  if (error?.status === 429 || error?.statusCode === 429) return 'RATE_LIMITED';
  return 'UNKNOWN_ERROR';
}

function currentFailure(channel) {
  const failedAt = timestamp(channel.lastFailureAt);
  const collectedAt = timestamp(channel.lastCollectedAt);
  if (failedAt !== null && collectedAt !== null && collectedAt > failedAt) return false;
  return channel.status === 'error' || Boolean(channel.failureKind || channel.requiresReconnect || failedAt !== null);
}

/**
 * retryCount means the last scheduled retry number (1, 2, or 3), not total
 * attempts. Failure after retry 3 retains 3 and has no nextRetryAt.
 * A successful/partial collection or verified new connection must clear these
 * fields in the caller. An exhausted transient incident may start a fresh daily
 * cycle the following KST day; a pending retry keeps its budget over midnight.
 */
export function planFailure(error, channel = {}, at = new Date().toISOString()) {
  const ctx = context({ at });
  const failureCode = safeCode(error);
  const retryable = error?.retryable === true || RETRY_CODES.has(failureCode);
  const failureKind = AUTH_CODES.has(failureCode) ? 'auth' : RATE_CODES.has(failureCode) ? 'rate-limit' : retryable || TRANSIENT_CODES.has(failureCode) ? 'transient' : 'permanent';
  const previousFailure = timestamp(channel.lastFailureAt);
  const previousPending = timestamp(channel.nextRetryAt);
  const newDailyCycle = previousFailure !== null && kstDay(previousFailure) < ctx.day && previousPending === null;
  const prior = !currentFailure(channel) || newDailyCycle ? 0 : count(channel.retryCount);
  let retryCount = prior;
  let nextRetryAt = null;
  if ((failureKind === 'transient' || failureKind === 'rate-limit') && retryable && prior < RETRY_DELAYS.length) {
    const delay = failureKind === 'rate-limit' ? RATE_LIMIT_DELAY_MINUTES : RETRY_DELAYS[prior];
    retryCount = prior + 1;
    nextRetryAt = new Date(ctx.time + delay * MINUTE).toISOString();
  }
  return { failureKind, failureCode, retryCount, nextRetryAt, requiresReconnect: failureKind === 'auth', lastFailureAt: ctx.at };
}

/**
 * Automatic work only. Manual collection remains the caller's explicit action.
 * Explicit disconnect/archive/no connection always wins, including due retries.
 */
export function shouldCollect(channel = {}, options = {}) {
  const ctx = context(options);
  if (!ctx.enabled || !active(channel) || !supported(channel) || !connected(channel, options.connected) || BUSY.has(channel.status)) return false;
  const failed = currentFailure(channel);
  if (failed && (channel.requiresReconnect || channel.failureKind === 'auth' || channel.failureKind === 'permanent')) return false;
  const collectedAt = timestamp(channel.lastCollectedAt);
  if (collectedAt !== null && (collectedAt > ctx.time || kstDay(collectedAt) === ctx.day)) return false;
  const nextRetry = timestamp(channel.nextRetryAt);
  if (failed && channel.nextRetryAt) {
    if (nextRetry === null || !['transient', 'rate-limit'].includes(channel.failureKind) || count(channel.retryCount) < 1) return false;
    return nextRetry <= ctx.time;
  }
  if (kstHour(ctx.time) < ctx.hourKst) return false;
  const attemptedAt = timestamp(channel.lastAttemptAt);
  const failedAt = timestamp(channel.lastFailureAt);
  if (failed && channel.failureKind === 'rate-limit' && failedAt !== null && ctx.time < failedAt + RATE_LIMIT_DELAY_MINUTES * MINUTE) return false;
  if (attemptedAt !== null && (attemptedAt > ctx.time || kstDay(attemptedAt) === ctx.day)) return false;
  if (failed && failedAt !== null && (failedAt > ctx.time || kstDay(failedAt) === ctx.day)) return false;
  return true;
}

// The daily full scan and the recent-content scan have independent success
// timestamps. A successful recent scan must not claim full-account coverage.
export function recentPolicyChannel(channel = {}) {
  const recent = { ...channel, status: channel.recentStatus || 'ready',
    lastCollectedAt: channel.recentLastCollectedAt || channel.lastCollectedAt || null,
    lastAttemptAt: channel.recentLastAttemptAt || null };
  for (const field of ['failureKind','failureCode','retryCount','nextRetryAt','requiresReconnect','lastFailureAt'])
    recent[field] = channel['recent' + field[0].toUpperCase() + field.slice(1)] ?? null;
  return recent;
}

/** Return a real due time, or null when automation cannot safely run. */
export function recentNextCheckAt(channel = {}, options = {}) {
  const ctx = context(options), recent = recentPolicyChannel(channel);
  if (!ctx.enabled || !active(channel) || !supported(channel) || !connected(channel, options.connected) || BUSY.has(channel.status) || BUSY.has(recent.status)) return null;
  // A full-scan incident owns its recovery budget; a recent scan cannot bypass it.
  if (currentFailure(channel)) return null;
  if (currentFailure(recent)) {
    if (recent.requiresReconnect || ['auth','permanent'].includes(recent.failureKind)) return null;
    const retry = timestamp(recent.nextRetryAt);
    if (recent.nextRetryAt) return retry !== null && ['transient','rate-limit'].includes(recent.failureKind) && count(recent.retryCount) > 0 ? new Date(Math.max(ctx.time,retry)).toISOString() : null;
    // Exhausted transient incidents restart only at the next daily recovery slot.
    const last = Math.max(timestamp(recent.lastFailureAt) || 0, timestamp(recent.lastAttemptAt) || 0);
    if (!last) return null;
    let due = Date.parse(kstDay(last) + 'T00:00:00.000Z') - KST_OFFSET + ctx.hourKst * 60 * MINUTE + 86400000;
    if (recent.failureKind === 'rate-limit') due = Math.max(due,last + RATE_LIMIT_DELAY_MINUTES * MINUTE);
    return new Date(Math.max(ctx.time,due)).toISOString();
  }
  const last = Math.max(timestamp(recent.lastCollectedAt) || 0, timestamp(recent.lastAttemptAt) || 0);
  return new Date(Math.max(ctx.time,last ? last + RECENT_INTERVAL_MINUTES * MINUTE : ctx.time)).toISOString();
}

export function shouldCollectRecent(channel = {}, options = {}) {
  const ctx = context(options), due = recentNextCheckAt(channel,options);
  return due !== null && Date.parse(due) <= ctx.time;
}

function healthItem(channel, ctx) {
  const item = {
    channelId: channel.id ?? null, status: '', label: '', reason: '', action: 'none',
    nextRetryAt: iso(channel.nextRetryAt), lastCollectedAt: iso(channel.lastCollectedAt),
    ownerIds: Array.isArray(channel.ownerIds) ? [...new Set(channel.ownerIds.filter(id => typeof id === 'string'))] : [],
  };
  const show = (status, label, reason, action = 'none') => ({ ...item, status, label, reason, action });
  if (!active(channel)) return show('archived', '보관됨', '보관한 채널이라 자동 수집하지 않아요.');
  if (!supported(channel)) return show('unsupported', '자동 수집 안 됨', '이 플랫폼은 아직 자동 수집이 안 돼요.');
  if (channel.collectionDisabled) return show('needs-connection', '연결 끊김', '연결을 끊은 채널이에요. 다시 연결해야 수집해요.', 'connect');
  const failed = currentFailure(channel);
  if (failed && (channel.requiresReconnect || channel.failureKind === 'auth')) return show('needs-reconnect', '다시 연결해야 함', '연결이 만료됐거나 권한이 모자라요. 채널 카드에서 계정을 다시 연결해 주세요.', 'connect');
  if (!connected(channel)) return show('needs-connection', '연결해야 함', '주소만 등록돼 있어요. 계정을 연결하면 수집을 시작해요.', 'connect');
  if (BUSY.has(channel.status)) return show('collecting', '수집 중', '수집하고 있어요. 끝날 때까지 기다려 주세요.', 'wait');

  const collectedAt = timestamp(channel.lastCollectedAt);
  const collectedToday = collectedAt !== null && collectedAt <= ctx.time && kstDay(collectedAt) === ctx.day;
  if (!failed && collectedToday) {
    const partial = channel.status === 'partial' || channel.coverage?.status === 'partial' || channel.lastCollectionStatus === 'partial';
    return partial
      ? show('partial', '오늘 일부만 수집', '플랫폼이 일부 콘텐츠나 수치를 주지 않았어요. 채널 카드의 안내를 봐 주세요.')
      : show('success', '오늘 수집 완료', '오늘 기록을 저장했어요. 플랫폼에 따라 늦게 반영되는 수치도 있어요.');
  }
  const retryAt = timestamp(channel.nextRetryAt);
  if (failed && retryAt !== null && ['transient', 'rate-limit'].includes(channel.failureKind)) {
    if (!ctx.enabled) return show('paused', '자동 수집 꺼짐', '자동 수집을 켜면 미뤄 둔 재시도를 이어 가요.', channel.failureKind === 'rate-limit' ? 'wait' : 'collect');
    if (collectedToday) return show('failed', '추가 수집 실패', '오늘 저장한 기록은 남아 있어요. 이번 실패를 성장이 줄어든 것으로 보지 않아요.', channel.failureKind === 'rate-limit' ? 'wait' : 'collect');
    const reason = channel.failureKind === 'rate-limit'
      ? '플랫폼 호출 한도에 걸려 적어도 24시간 뒤에 다시 해요. 빠진 기록은 성장이 줄었다는 뜻이 아니에요.'
      : retryAt > ctx.time ? '잠깐 연결이 안 돼서 자동으로 다시 시도해요. 빠진 기록은 성장이 줄었다는 뜻이 아니에요.' : '다시 시도할 때가 됐어요. 다음 점검 때 수집해요.';
    return show('retry-scheduled', '다시 시도 예정', reason, 'wait');
  }
  if (failed && (channel.failureKind === 'permanent' || (timestamp(channel.lastFailureAt) !== null && kstDay(timestamp(channel.lastFailureAt)) === ctx.day) || (timestamp(channel.lastAttemptAt) !== null && kstDay(timestamp(channel.lastAttemptAt)) === ctx.day) || channel.nextRetryAt)) {
    const reason = channel.failureKind === 'permanent'
      ? '자동으로 다시 시도할 수 없는 오류예요. 연결과 채널 상태를 본 뒤 직접 수집해 주세요.'
      : '자동 재시도가 끝났거나 다음 시도를 잡지 못했어요. 직접 수집해 주세요. 빠진 기록을 성장이 줄었다고 표시하지 않아요.';
    return show('failed', '수집 실패', reason, channel.failureKind === 'rate-limit' ? 'wait' : 'collect');
  }
  if (!ctx.enabled) return show('paused', '자동 수집 꺼짐', '자동 수집이 꺼져 있어요. 필요할 때 직접 수집해 주세요.', 'collect');
  if (shouldCollect(channel, { at: ctx.at, enabled: ctx.enabled, hourKst: ctx.hourKst, connected: connected(channel) })) return show('overdue', '오늘 수집 전', '수집 시각이 지났는데 오늘 기록이 아직 없어요. 다음 점검 때 다시 봐요.', 'collect');
  return show('scheduled', '수집 시각 전', '정해 둔 수집 시각을 기다리고 있어요. 그 전까지 오늘 수치는 비어 있어요.', 'wait');
}

/** Counts are disjoint result buckets; total/active/supported/connected are scopes. */
export function collectionHealth(channels = [], options = {}) {
  if (!Array.isArray(channels)) throw new TypeError('채널 목록이 필요합니다.');
  const ctx = context(options);
  const rows = channels.filter(channel => channel && typeof channel === 'object');
  const items = rows.map(channel => healthItem(channel, ctx));
  const totalOf = status => items.filter(item => item.status === status).length;
  const successTimes = rows.map(channel => {
    const explicit = timestamp(channel.lastSuccessAt);
    if (explicit !== null && explicit <= ctx.time) return explicit;
    const collected = timestamp(channel.lastCollectedAt);
    return collected !== null && collected <= ctx.time && (channel.status === 'success' || channel.lastCollectionStatus === 'success' || channel.coverage?.status === 'complete') ? collected : null;
  }).filter(value => value !== null);
  return {
    total: rows.length, active: rows.filter(active).length,
    supported: rows.filter(channel => active(channel) && supported(channel)).length,
    connected: rows.filter(channel => active(channel) && supported(channel) && connected(channel)).length,
    successToday: totalOf('success'), partialToday: totalOf('partial'),
    needsConnection: totalOf('needs-connection'), needsReconnect: totalOf('needs-reconnect'),
    retryScheduled: totalOf('retry-scheduled'), failed: totalOf('failed'), overdue: totalOf('overdue'),
    unsupported: totalOf('unsupported'), archived: totalOf('archived'), collecting: totalOf('collecting'), scheduled: totalOf('scheduled'), paused: totalOf('paused'),
    lastSuccessAt: successTimes.length ? new Date(Math.max(...successTimes)).toISOString() : null,
    items,
  };
}
