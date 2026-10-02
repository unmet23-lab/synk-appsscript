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
]);
const RATE_CODES = new Set(['RATE_LIMITED', 'RATE_LIMIT_EXCEEDED', 'TOO_MANY_REQUESTS', 'QUOTA_EXCEEDED', 'QUOTA_EXHAUSTED', 'DAILY_LIMIT_EXCEEDED']);
const KNOWN_CODES = new Set([...AUTH_CODES, ...RATE_CODES,
  'INVALID_CHANNEL_URL', 'INVALID_CONFIG', 'INVALID_API_TARGET', 'INVALID_RESPONSE',
  'CHANNEL_NOT_FOUND', 'API_ERROR', 'CANCELLED', 'TIMEOUT', 'NETWORK_ERROR',
  'UNSUPPORTED_PROVIDER', 'MANUAL_ONLY', 'INVALID_API_VERSION', 'INVALID_REDIRECT',
  'HTTPS_REQUIRED', 'INVALID_STATE', 'INVALID_PKCE', 'PROVIDER_NOT_CONFIGURED',
  'MISSING_CODE', 'OAUTH_TIMEOUT', 'OAUTH_UNAVAILABLE', 'COLLECTION_INTERRUPTED', 'UNKNOWN_ERROR',
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
  const failureKind = AUTH_CODES.has(failureCode) ? 'auth' : RATE_CODES.has(failureCode) ? 'rate-limit' : error?.retryable === true ? 'transient' : 'permanent';
  const previousFailure = timestamp(channel.lastFailureAt);
  const previousPending = timestamp(channel.nextRetryAt);
  const newDailyCycle = previousFailure !== null && kstDay(previousFailure) < ctx.day && previousPending === null;
  const prior = !currentFailure(channel) || newDailyCycle ? 0 : count(channel.retryCount);
  let retryCount = prior;
  let nextRetryAt = null;
  if ((failureKind === 'transient' || failureKind === 'rate-limit') && error?.retryable === true && prior < RETRY_DELAYS.length) {
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
  if (!active(channel)) return show('archived', '관리 중지', '채널 관리가 중지되어 자동 수집하지 않습니다.');
  if (!supported(channel)) return show('unsupported', '자동 수집 미지원', '이 플랫폼은 현재 자동 수집 연결을 제공하지 않습니다.');
  if (channel.collectionDisabled) return show('needs-connection', '연결 해제됨', '직접 연결을 해제한 채널입니다. 다시 연결해야 수집합니다.', 'connect');
  const failed = currentFailure(channel);
  if (failed && (channel.requiresReconnect || channel.failureKind === 'auth')) return show('needs-reconnect', '재연결 필요', '계정 또는 조회 권한을 확인하고 공식 로그인으로 다시 연결해 주세요.', 'connect');
  if (!connected(channel)) return show('needs-connection', '연결 필요', '채널 주소가 등록되어 있습니다. 계정 조회 권한을 연결하면 실제 수집을 시작합니다.', 'connect');
  if (BUSY.has(channel.status)) return show('collecting', '수집 진행 중', '현재 수집 대기 또는 실행 중입니다. 완료 결과를 기다려 주세요.', 'wait');

  const collectedAt = timestamp(channel.lastCollectedAt);
  const collectedToday = collectedAt !== null && collectedAt <= ctx.time && kstDay(collectedAt) === ctx.day;
  if (!failed && collectedToday) {
    const partial = channel.status === 'partial' || channel.coverage?.status === 'partial' || channel.lastCollectionStatus === 'partial';
    return partial
      ? show('partial', '오늘 일부 수집', '일부 콘텐츠나 지표가 제공되지 않았습니다. 채널별 수집 범위를 확인해 주세요.')
      : show('success', '오늘 수집 완료', '오늘의 수집 기록이 저장되었습니다. 일부 플랫폼 지표는 반영 시점이 다를 수 있습니다.');
  }
  const retryAt = timestamp(channel.nextRetryAt);
  if (failed && retryAt !== null && ['transient', 'rate-limit'].includes(channel.failureKind)) {
    if (!ctx.enabled) return show('paused', '자동 수집 꺼짐', '자동 수집을 켜면 예약된 재시도를 이어갑니다.', channel.failureKind === 'rate-limit' ? 'wait' : 'collect');
    if (collectedToday) return show('failed', '추가 수집 실패', '오늘 저장된 기록은 남아 있습니다. 추가 수집 오류를 성장 감소로 해석하지 않습니다.', channel.failureKind === 'rate-limit' ? 'wait' : 'collect');
    const reason = channel.failureKind === 'rate-limit'
      ? '플랫폼 조회 한도로 최소 24시간 간격을 둡니다. 기록 누락은 성장 감소를 뜻하지 않습니다.'
      : retryAt > ctx.time ? '일시적인 연결 오류로 자동 재시도를 기다립니다. 기록 누락은 성장 감소를 뜻하지 않습니다.' : '예약된 재시도 시각이 되었습니다. 다음 수집 점검에서 다시 요청합니다.';
    return show('retry-scheduled', '재시도 예약', reason, 'wait');
  }
  if (failed && (channel.failureKind === 'permanent' || (timestamp(channel.lastFailureAt) !== null && kstDay(timestamp(channel.lastFailureAt)) === ctx.day) || (timestamp(channel.lastAttemptAt) !== null && kstDay(timestamp(channel.lastAttemptAt)) === ctx.day) || channel.nextRetryAt)) {
    const reason = channel.failureKind === 'permanent'
      ? '자동 재시도 대상이 아닌 오류입니다. 설정과 채널 상태를 확인한 뒤 다시 수집해 주세요.'
      : '자동 재시도 한도가 끝났거나 예약을 확인할 수 없습니다. 미확인 기록을 성장 감소로 표시하지 않습니다.';
    return show('failed', '수집 확인 필요', reason, channel.failureKind === 'rate-limit' ? 'wait' : 'collect');
  }
  if (!ctx.enabled) return show('paused', '자동 수집 꺼짐', '자동 수집이 꺼져 있습니다. 필요할 때 직접 수집할 수 있습니다.', 'collect');
  if (shouldCollect(channel, { at: ctx.at, enabled: ctx.enabled, hourKst: ctx.hourKst, connected: connected(channel) })) return show('overdue', '오늘 수집 대기', '예약 시각이 지났지만 오늘의 수집 기록이 없습니다. 다음 수집 점검에서 확인합니다.', 'collect');
  return show('scheduled', '수집 시각 대기', '예약된 수집 시각을 기다립니다. 아직 수집하지 않은 기록은 미확인 상태입니다.', 'wait');
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
