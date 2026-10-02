import test from 'node:test';
import assert from 'node:assert/strict';
import { RETRY_DELAYS, RATE_LIMIT_DELAY_MINUTES, planFailure, shouldCollect, collectionHealth } from './collection-policy.mjs';

const NOW = '2026-09-27T00:00:00.000Z'; // 09:00 KST
const base = (extra = {}) => ({ id: 'test-channel', platform: 'youtube', active: true, connected: true, ownerIds: ['staff-a'], status: 'ready', ...extra });
const options = (extra = {}) => ({ at: NOW, enabled: true, hourKst: 9, ...extra });
const after = (at, minutes) => new Date(Date.parse(at) + minutes * 60_000).toISOString();

test('temporary errors schedule exactly three retries at 5, 20, 60 minutes', () => {
  assert.deepEqual(RETRY_DELAYS, [5, 20, 60]);
  const error = { code: 'NETWORK_ERROR', retryable: true };
  let channel = base();
  let at = NOW;
  for (const [index, delay] of RETRY_DELAYS.entries()) {
    const failure = planFailure(error, channel, at);
    assert.equal(failure.failureKind, 'transient');
    assert.equal(failure.retryCount, index + 1);
    assert.equal(failure.nextRetryAt, after(at, delay));
    assert.equal(failure.requiresReconnect, false);
    channel = { ...channel, ...failure, status: 'error', lastAttemptAt: at };
    at = failure.nextRetryAt;
  }
  const exhausted = planFailure(error, channel, at);
  assert.equal(exhausted.retryCount, 3);
  assert.equal(exhausted.nextRetryAt, null);
  assert.equal(shouldCollect({ ...channel, ...exhausted, lastAttemptAt: at }, options({ at })), false);
});

test('only an explicit retryable true can schedule another external request', () => {
  for (const error of [{ code: 'TIMEOUT' }, { code: 'API_ERROR', status: 503 }, { code: 'OAUTH_TIMEOUT' }, { code: 'RATE_LIMITED' }, { code: 'NETWORK_ERROR', retryable: 'true' }]) {
    const result = planFailure(error, base(), NOW);
    assert.equal(result.nextRetryAt, null);
    assert.equal(result.retryCount, 0);
  }
  assert.equal(planFailure({ code: 'API_ERROR', status: 503, retryable: true }, base(), NOW).failureKind, 'transient');
});

test('known auth and account mismatch errors require reconnection even when retryable is true', () => {
  for (const code of ['AUTH_REQUIRED', 'connection_required', 'ACCOUNT_MISMATCH', 'reconnect_required', 'token_exchange_failed', 'invalid_grant', 'access_token_expired', 'insufficient_scope']) {
    const result = planFailure({ code, retryable: true }, base(), NOW);
    assert.equal(result.failureKind, 'auth', code);
    assert.equal(result.requiresReconnect, true, code);
    assert.equal(result.nextRetryAt, null, code);
    assert.equal(shouldCollect(base({ ...result, status: 'error' }), options({ at: after(NOW, 24 * 60) })), false, code);
  }
});

test('quota exhaustion and collapsed rate-limit codes use 24 hours rather than short retries', () => {
  assert.equal(RATE_LIMIT_DELAY_MINUTES, 1440);
  for (const error of [{ code: 'RATE_LIMITED', retryable: true }, { code: 'quotaExceeded', retryable: true }, { code: 'QUOTA_EXHAUSTED', retryable: true }, { status: 429, retryable: true }]) {
    const failure = planFailure(error, base(), NOW);
    assert.equal(failure.failureKind, 'rate-limit');
    assert.equal(failure.nextRetryAt, '2026-09-28T00:00:00.000Z');
    const channel = base({ ...failure, status: 'error', lastAttemptAt: NOW });
    assert.equal(shouldCollect(channel, options({ at: after(NOW, 60) })), false);
    assert.equal(shouldCollect(channel, options({ at: failure.nextRetryAt })), true);
  }
});

test('a pending retry retains its budget across KST midnight', () => {
  const at = '2026-09-27T14:59:00.000Z'; // 23:59 KST
  const first = planFailure({ code: 'NETWORK_ERROR', retryable: true }, base(), at);
  const channel = base({ ...first, status: 'error', lastAttemptAt: at });
  assert.equal(shouldCollect(channel, options({ at: first.nextRetryAt })), true);
  const second = planFailure({ code: 'NETWORK_ERROR', retryable: true }, channel, first.nextRetryAt);
  assert.equal(second.retryCount, 2);
  assert.equal(second.nextRetryAt, after(first.nextRetryAt, 20));
});

test('an exhausted temporary incident can start a new daily cycle after the following schedule', () => {
  const channel = base({ status: 'error', retryCount: 3, failureKind: 'transient', failureCode: 'NETWORK_ERROR', nextRetryAt: null, lastFailureAt: NOW, lastAttemptAt: NOW });
  const nextDay = after(NOW, 1440);
  assert.equal(shouldCollect(channel, options({ at: after(nextDay, -1) })), false);
  assert.equal(shouldCollect(channel, options({ at: nextDay })), true);
  const failure = planFailure({ code: 'NETWORK_ERROR', retryable: true }, channel, nextDay);
  assert.equal(failure.retryCount, 1);
  assert.equal(failure.nextRetryAt, after(nextDay, 5));
});

test('daily collection catches up after scheduled hour but never before it', () => {
  assert.equal(shouldCollect(base(), options({ at: after(NOW, -1) })), false);
  assert.equal(shouldCollect(base(), options()), true);
  assert.equal(shouldCollect(base(), options({ at: after(NOW, 600) })), true);
  assert.equal(shouldCollect(base({ lastAttemptAt: after(NOW, -1440) }), options()), true);
  assert.equal(shouldCollect(base({ lastAttemptAt: NOW }), options({ at: after(NOW, 60) })), false);
});

test('archive, disconnect, no permission, unsupported platform, busy state, and pause override due work', () => {
  const due = { status: 'error', failureKind: 'transient', retryCount: 1, nextRetryAt: NOW, lastFailureAt: after(NOW, -5) };
  for (const patch of [{ active: false }, { collectionDisabled: true }, { connected: false }, { platform: 'vk' }, { requiresReconnect: true }, { failureKind: 'permanent' }, { status: 'collecting' }, { status: 'queued' }, { status: 'running' }]) {
    assert.equal(shouldCollect(base({ ...due, ...patch }), options()), false, JSON.stringify(patch));
  }
  assert.equal(shouldCollect(base(due), options({ enabled: false })), false);
  assert.equal(shouldCollect(base({ connected: false }), options({ connected: true })), true);
  assert.equal(shouldCollect(base({ collectionDisabled: true }), options({ connected: true })), false);
});

test('today saved complete or partial data prevents duplicate scheduled work, even after a later manual failure', () => {
  for (const status of ['success', 'partial', 'error']) {
    const channel = base({ status, lastCollectedAt: after(NOW, -30), coverage: { status: status === 'partial' ? 'partial' : 'complete' }, failureKind: 'transient', retryCount: 1, lastFailureAt: after(NOW, -5), nextRetryAt: NOW });
    assert.equal(shouldCollect(channel, options()), false);
  }
  const midnight = '2026-09-26T15:00:00.000Z';
  assert.equal(shouldCollect(base({ lastCollectedAt: midnight }), options()), false);
  assert.equal(shouldCollect(base({ lastCollectedAt: after(midnight, -1) }), options()), true);
});

test('a saved collection after an old failure makes stale retry fields irrelevant', () => {
  const channel = base({ status: 'success', lastFailureAt: after(NOW, -30), lastCollectedAt: NOW, requiresReconnect: true, failureKind: 'auth', retryCount: 2, nextRetryAt: after(NOW, 30) });
  const health = collectionHealth([channel], options());
  assert.equal(health.items[0].status, 'success');
  assert.equal(health.needsReconnect, 0);
  const failed = planFailure({ code: 'NETWORK_ERROR', retryable: true }, channel, after(NOW, 10));
  assert.equal(failed.retryCount, 1);
});

test('permanent and auth failures do not get an automatic next-day retry', () => {
  for (const failureKind of ['permanent', 'auth']) {
    const channel = base({ status: 'error', failureKind, retryCount: 0, nextRetryAt: null, lastAttemptAt: NOW, lastFailureAt: NOW });
    assert.equal(shouldCollect(channel, options({ at: after(NOW, 1440) })), false);
  }
});

test('invalid retry metadata cannot produce a repeated immediate request', () => {
  for (const nextRetryAt of ['invalid-date', '2026-09-27T00:00:00.000Z']) {
    assert.equal(shouldCollect(base({ status: 'error', failureKind: 'transient', retryCount: 0, nextRetryAt }), options()), false);
  }
  assert.equal(shouldCollect(base({ status: 'error', failureKind: 'transient', retryCount: 1, nextRetryAt: after(NOW, 20), lastAttemptAt: after(NOW, -1440) }), options()), false);
});

test('health gives every channel exactly one outcome, with unsupported separate from failures', () => {
  const rows = [
    base({ id: 'archived', active: false, requiresReconnect: true }),
    base({ id: 'unsupported', platform: 'douyin' }),
    base({ id: 'disconnected', collectionDisabled: true }),
    base({ id: 'unconnected', connected: false }),
    base({ id: 'auth', status: 'error', failureKind: 'auth', requiresReconnect: true }),
    base({ id: 'busy', status: 'collecting' }),
    base({ id: 'ok', status: 'success', lastCollectedAt: NOW }),
    base({ id: 'partial', status: 'partial', lastCollectedAt: after(NOW, -1) }),
    base({ id: 'retry', status: 'error', failureKind: 'transient', retryCount: 1, lastFailureAt: NOW, nextRetryAt: after(NOW, 5) }),
    base({ id: 'failed', status: 'error', failureKind: 'permanent', lastFailureAt: NOW }),
    base({ id: 'overdue' }),
  ];
  const health = collectionHealth(rows, options());
  assert.equal(health.total, 11);
  assert.equal(health.active, 10);
  assert.equal(health.supported, 9);
  assert.equal(health.connected, 7);
  assert.equal(health.successToday, 1);
  assert.equal(health.partialToday, 1);
  assert.equal(health.needsConnection, 2);
  assert.equal(health.needsReconnect, 1);
  assert.equal(health.retryScheduled, 1);
  assert.equal(health.failed, 1);
  assert.equal(health.overdue, 1);
  assert.equal(health.unsupported, 1);
  assert.equal(health.lastSuccessAt, NOW);
  assert.equal(new Set(health.items.map(item => item.channelId)).size, rows.length);
  assert.equal(health.successToday + health.partialToday + health.needsConnection + health.needsReconnect + health.retryScheduled + health.failed + health.overdue + health.unsupported + health.archived + health.collecting + health.scheduled + health.paused, health.total);
  assert.equal(health.items.find(item => item.channelId === 'unsupported').action, 'none');
  assert.equal(health.items.find(item => item.channelId === 'auth').action, 'connect');
  assert.equal(health.items.find(item => item.channelId === 'retry').action, 'wait');
});

test('health never presents unconnected, waiting or late data as a negative growth measurement', () => {
  const rows = [base({ id: 'before', lastCollectedAt: after(NOW, -1440), status: 'success' }), base({ id: 'new', connected: false })];
  const waiting = collectionHealth(rows, options({ at: after(NOW, -1) }));
  assert.equal(waiting.items[0].status, 'scheduled');
  assert.equal(waiting.items[1].status, 'needs-connection');
  const late = collectionHealth(rows, options());
  assert.equal(late.items[0].status, 'overdue');
  for (const item of [...waiting.items, ...late.items]) {
    assert.equal('delta' in item, false);
    assert.equal('growth' in item, false);
    assert.equal('views' in item, false);
  }
});

test('disabled automation shows a pause and does not claim that reserved retries will run', () => {
  const health = collectionHealth([
    base(),
    base({ id: 'retry', failureKind: 'transient', retryCount: 1, lastFailureAt: NOW, nextRetryAt: after(NOW, 5), status: 'error' }),
    base({ id: 'completed', status: 'success', lastCollectedAt: NOW }),
  ], options({ enabled: false }));
  assert.equal(health.paused, 2);
  assert.equal(health.retryScheduled, 0);
  assert.equal(health.successToday, 1);
  assert.equal(health.overdue, 0);
});

test('error payloads and non-allowlisted codes never leak through policy output', () => {
  const failure = planFailure({ code: 'FAKE_SECRET_ACCESS_TOKEN', message: 'Bearer SECRET', cause: new Error('SECRET'), retryable: true }, base(), NOW);
  assert.equal(failure.failureCode, 'UNKNOWN_ERROR');
  assert.ok(!JSON.stringify(failure).includes('SECRET'));
  const health = collectionHealth([base({ ...failure, status: 'error', lastError: 'SECRET' })], options());
  assert.ok(!JSON.stringify(health).includes('SECRET'));
});

test('pure policy calls preserve inputs and reject invalid clock or schedule inputs', () => {
  const channel = Object.freeze(base({ ownerIds: Object.freeze(['staff-a', 'staff-a']) }));
  const original = JSON.stringify(channel);
  planFailure({ code: 'NETWORK_ERROR', retryable: true }, channel, NOW);
  shouldCollect(channel, options());
  const health = collectionHealth([channel], options());
  assert.equal(JSON.stringify(channel), original);
  assert.deepEqual(health.items[0].ownerIds, ['staff-a']);
  assert.throws(() => planFailure({}, channel, 'bad-date'), TypeError);
  assert.throws(() => shouldCollect(channel, options({ hourKst: 24 })), RangeError);
  assert.throws(() => collectionHealth({}, options()), TypeError);
});
