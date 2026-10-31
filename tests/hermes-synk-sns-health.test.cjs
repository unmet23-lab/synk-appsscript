'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sanitizeSns, snsHealthEvents } = require('../tools/hermes-synk/overview.cjs');
const { plan, collect, attentionDraft, recoveryDraft } = require('../tools/hermes-synk/monitor.cjs');
const { sanitizeCollection, carryFailingSince, FULL_STALE_MS, RECENT_STALE_MS, WAIT_LIMIT_MS, CHECKPOINT_LATE_MS } = require('../tools/hermes-synk/sns-health.cjs');

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-31T06:00:00Z');
const ago = ms => new Date(NOW - ms).toISOString();
const ahead = ms => new Date(NOW + ms).toISOString();
const ref = n => n.toString(16).padStart(12, '0');
const healthy = (n = 1, extra = {}) => ({ ref: ref(n), platform: 'youtube', label: '채널' + n, status: 'success', recentStatus: 'success',
  lastCollectedAt: ago(5 * HOUR), recentLastCollectedAt: ago(0.4 * HOUR), lastAttemptAt: ago(5 * HOUR), ...extra });
const point = (n, extra = {}) => ({ ref: ref(0xa00 + n), channel: ref(1), title: '게시물' + n, hours: 24, status: 'recorded',
  dueAt: ago(2 * HOUR), closesAt: ahead(4 * HOUR), ...extra });
const channels = (count, make = healthy) => Array.from({ length: count }, (_, i) => make(i + 1));
const sns = (collection, extra = {}) => ({ available: true, stale: false, appRunning: true, checkedAt: new Date(NOW).toISOString(),
  collection: sanitizeCollection({ schemaVersion: 1, enabled: true, channels: channels(1), checkpoints: [], ...collection }), collectionError: false, ...extra });
const overviewOf = value => ({ events: snsHealthEvents(value) });
const byId = (value, id) => snsHealthEvents(value).find(row => row.id === id);
const channelId = n => 'sns-collection-' + ref(n);
const pointId = n => 'sns-performance-' + ref(0xa00 + n);
const missedId = n => 'sns-performance-missed-' + ref(n);

// 한 사건의 생애를 감시 회차로 돌린다: 정상 기준선 → 나빠짐 → 같은 상태로 또 읽음 → 풀림 → 또 읽음
function lifecycle(good, bad) {
  const clock = n => new Date(NOW + n * 5 * 60_000);
  let state = plan(null, overviewOf(good), clock(0)).state;
  const round = (value, n) => { const out = plan(state, overviewOf(value), clock(n)); state = out.state; return out.notifications; };
  return { alert: round(bad, 1), repeat: round(bad, 2), recover: round(good, 3), after: round(good, 4), state };
}
function assertOnce(run, pattern) {
  assert.equal(run.alert.length, 1, '나빠지면 한 번 알린다');
  assert.equal(run.alert[0].kind, 'attention');
  assert.match(run.alert[0].text, pattern);
  assert.equal(run.repeat.length, 0, '같은 사건은 다시 알리지 않는다');
  assert.equal(run.recover.length, 1, '풀리면 한 번 알린다');
  assert.equal(run.recover[0].kind, 'recovery');
  assert.match(run.recover[0].text, /^SYNK · 풀린 일/);
  assert.equal(run.recover[0].needs_attention, true, '발송부는 이 표시가 있는 알림만 보낸다');
  assert.equal(run.after.length, 0, '회복도 한 번만 알린다');
}

test('채널이 다시 연결을 기다리면 한 번 알리고 풀리면 한 번 알린다', () => {
  const bad = healthy(1, { status: 'error', failureKind: 'auth', failureCode: 'TOKEN_EXPIRED', requiresReconnect: true, lastFailureAt: ago(HOUR) });
  assertOnce(lifecycle(sns({}), sns({ channels: [bad] })), /유튜브 채널1 · 다시 연결 필요[^]*TOKEN_EXPIRED/);
});

test('최근 수집이 인증 실패로 굳어도 전체 수집과 같은 사건으로 알린다', () => {
  const bad = healthy(1, { recentStatus: 'error', recentFailureKind: 'auth', recentFailureCode: 'INSUFFICIENT_SCOPE', recentRequiresReconnect: true, recentLastFailureAt: ago(HOUR), recentLastCollectedAt: ago(2 * HOUR) });
  assertOnce(lifecycle(sns({}), sns({ channels: [bad] })), /다시 연결 필요[^]*INSUFFICIENT_SCOPE/);
  // 일부 수치를 못 받은 수집은 같은 시각에 수집과 실패를 함께 적는다(server.mjs) — 성공으로 치지 않는다
  const partial = healthy(1, { recentStatus: 'error', recentFailureKind: 'auth', recentRequiresReconnect: true, recentLastFailureAt: ago(HOUR), recentLastCollectedAt: ago(HOUR) });
  assert.equal(byId(sns({ channels: [partial] }), channelId(1)).needs_attention, true);
});

test('다시 시도하지 않는 영구 실패로 굳으면 한 번 알리고 풀리면 한 번 알린다', () => {
  const bad = healthy(1, { status: 'error', failureKind: 'permanent', failureCode: 'CHANNEL_NOT_FOUND', lastFailureAt: ago(HOUR) });
  assertOnce(lifecycle(sns({}), sns({ channels: [bad] })), /수집 실패로 멈춤[^]*CHANNEL_NOT_FOUND/);
});

test('성공 뒤의 옛 실패 기록은 굳은 실패가 아니다', () => {
  const past = healthy(1, { failureKind: 'auth', lastFailureAt: ago(9 * HOUR), lastCollectedAt: ago(5 * HOUR) });
  assert.equal(byId(sns({ channels: [past] }), channelId(1)).needs_attention, false);
});

test('전체 수집이 26시간 넘게 없으면 한 번 알리고 풀리면 한 번 알린다', () => {
  const bad = healthy(1, { lastCollectedAt: ago(FULL_STALE_MS + HOUR), failureCode: 'TIMEOUT' });
  assertOnce(lifecycle(sns({}), sns({ channels: [bad] })), /전체 수집 멈춤[^]*26시간 넘게[^]*TIMEOUT/);
  const edge = healthy(1, { lastCollectedAt: ago(FULL_STALE_MS - HOUR) });
  assert.equal(byId(sns({ channels: [edge] }), channelId(1)).needs_attention, false, '26시간 안이면 오늘 수집을 기다리는 것이다');
});

test('전체 수집에 성공한 적 없이 실패만 쌓이면, 처음 실패를 본 조회부터 26시간 뒤 멈춤으로 본다', () => {
  // 서버는 시도마다 시도·실패·최근 수집 시각을 새로 적는다 — 그 시각으로는 끝내 26시간이 차지 않는다
  const never = at => ({ ...healthy(1), lastCollectedAt: null, status: 'error', failureKind: 'transient', failureCode: 'TIMEOUT', lastFailureAt: at, lastAttemptAt: at, recentLastCollectedAt: at });
  const since = carryFailingSince(sanitizeCollection({ schemaVersion: 1, channels: [never(ago(HOUR))], checkpoints: [] }), null, ago(HOUR));
  assert.equal(since.channels[0].failingSince, ago(HOUR));
  assert.equal(byId(sns({ channels: [{ ...never(ago(HOUR)), failingSince: ago(HOUR) }] }), channelId(1)).needs_attention, false, '첫 실패 직후는 기다린다');
  // 다음 조회들이 같은 사건을 이어 적는다
  const later = carryFailingSince(sanitizeCollection({ schemaVersion: 1, channels: [never(ago(0.1 * HOUR))], checkpoints: [] }), since, ago(0));
  assert.equal(later.channels[0].failingSince, ago(HOUR));
  const old = { ...never(ago(0.1 * HOUR)), failingSince: ago(FULL_STALE_MS + HOUR) };
  assert.equal(byId(sns({ channels: [old] }), channelId(1)).needs_attention, true);
  const retrying = { ...old, nextRetryAt: ahead(HOUR) };
  assert.equal(byId(sns({ channels: [retrying] }), channelId(1)).needs_attention, false, '다음 시도가 잡혀 있으면 72시간까지 기다린다');
  assert.equal(byId(sns({ channels: [{ ...retrying, failingSince: ago(WAIT_LIMIT_MS + HOUR) }] }), channelId(1)).needs_attention, true, '재시도만 되풀이해도 72시간이 넘으면 멈춤이다');
  const first = { ...healthy(1), lastCollectedAt: null, status: 'ready', recentStatus: 'ready', lastAttemptAt: ago(HOUR), recentLastCollectedAt: ago(0.4 * HOUR) };
  assert.equal(carryFailingSince(sanitizeCollection({ schemaVersion: 1, channels: [first], checkpoints: [] }), since, ago(0)).channels[0].failingSince, undefined, '실패가 아니면 처음 본 시각을 남기지 않는다');
  assert.equal(byId(sns({ channels: [first] }), channelId(1)).needs_attention, false, '실패 없이 첫 전체 수집을 기다리는 채널은 멈춘 것이 아니다');
  const done = { ...healthy(1), failingSince: ago(FULL_STALE_MS + HOUR) };
  assert.equal(carryFailingSince(sanitizeCollection({ schemaVersion: 1, channels: [done], checkpoints: [] }), since, ago(0)).channels[0].failingSince, undefined, '성공하면 지운다');
});

test('플랫폼 한도를 기다리는 동안은 알리지 않고, 기다림이 72시간을 넘으면 알린다', () => {
  const waiting = age => healthy(1, { lastCollectedAt: ago(age), failureKind: 'rate-limit', nextRetryAt: ahead(5 * HOUR), lastFailureAt: ago(HOUR), status: 'error' });
  assert.equal(byId(sns({ channels: [waiting(FULL_STALE_MS + HOUR)] }), channelId(1)).needs_attention, false);
  assert.equal(byId(sns({ channels: [waiting(WAIT_LIMIT_MS + HOUR)] }), channelId(1)).needs_attention, true);
  const exhausted = healthy(1, { lastCollectedAt: ago(FULL_STALE_MS + HOUR), failureKind: 'rate-limit', nextRetryAt: null, lastFailureAt: ago(HOUR), status: 'error' });
  assert.equal(byId(sns({ channels: [exhausted] }), channelId(1)).needs_attention, true, '재시도가 끝나면 기다리는 것이 아니다');
});

test('절반 넘는 채널이 함께 밀리면 한 줄로 알리고, 풀린 뒤 남은 채널만 따로 알린다', () => {
  const stale = n => healthy(n, { lastCollectedAt: ago(FULL_STALE_MS + HOUR) });
  const good = sns({ channels: channels(6) });
  const bad = sns({ channels: channels(6, stale) });
  const run = lifecycle(good, bad);
  assertOnce(run, /채널 전체에서 멈춤[^]*6개 중 6개/);
  assert.doesNotMatch(run.alert[0].text, /채널1 · 전체 수집 멈춤/, '채널마다 따로 울리지 않는다');
  assert.doesNotMatch(run.recover[0].text, /채널1/, '알린 적 없는 채널은 회복도 알리지 않는다');

  let state = plan(null, overviewOf(good), new Date(NOW)).state;
  state = plan(state, overviewOf(bad), new Date(NOW + 300_000)).state;
  const mostly = sns({ channels: channels(6, n => n === 2 ? stale(n) : healthy(n)) });
  const left = plan(state, overviewOf(mostly), new Date(NOW + 600_000)).notifications;
  assert.equal(left.filter(x => x.kind === 'attention').length, 1, '전체 멈춤이 풀려도 아직 멈춘 채널은 묻히지 않는다');
  assert.match(left.find(x => x.kind === 'attention').text, /채널2 · 전체 수집 멈춤/);
});

test('전체 멈춤은 절반을 넘어야 하고, 정확히 절반이면 채널마다 알린다', () => {
  const stale = n => healthy(n, { lastCollectedAt: ago(FULL_STALE_MS + HOUR) });
  const half = sns({ channels: channels(6, n => n <= 3 ? stale(n) : healthy(n)) });
  assert.equal(byId(half, 'sns-collection-stopped').needs_attention, false);
  assert.notEqual(byId(half, channelId(1)).notify, false);
  const over = sns({ channels: channels(7, n => n <= 4 ? stale(n) : healthy(n)) });
  assert.equal(byId(over, 'sns-collection-stopped').needs_attention, true);
  assert.equal(byId(over, channelId(1)).notify, false);
  const few = sns({ channels: channels(3, n => n <= 2 ? stale(n) : healthy(n)) });
  assert.equal(byId(few, 'sns-collection-stopped').needs_attention, false, '채널이 적으면 셋 미만은 묶지 않는다');
});

test('최근 수집만 다 같이 6시간 밀려도 전체 수집을 기다리지 않고 일찍 알린다', () => {
  const stale = n => healthy(n, { recentLastCollectedAt: ago(RECENT_STALE_MS + HOUR) });
  assert.equal(byId(sns({ channels: channels(4, stale) }), 'sns-collection-stopped').needs_attention, true);
  const one = sns({ channels: channels(4, n => n === 1 ? stale(n) : healthy(n)) });
  assert.equal(byId(one, 'sns-collection-stopped').needs_attention, false, '한 채널의 최근 수집 지연은 전체 수집이 맡는다');
  assert.equal(byId(one, channelId(1)).needs_attention, false);
});

test('자동 수집 설정이 꺼지면 설정 한 줄만 알리고 켜지면 한 번 알린다', () => {
  const stale = n => healthy(n, { lastCollectedAt: ago(FULL_STALE_MS + HOUR) });
  const run = lifecycle(sns({ channels: channels(4) }), sns({ enabled: false, channels: channels(4, stale) }));
  assertOnce(run, /자동 수집이 꺼져 있음/);
  assert.doesNotMatch(run.alert[0].text, /채널 전체에서 멈춤|채널1/);
  for (const unknown of [undefined, null, 'on']) assert.equal(byId(sns({ enabled: unknown }), 'sns-collection-off').needs_attention, false, '설정을 못 읽은 것을 꺼짐으로 알리지 않는다');
});

test('연결을 끊었거나 주소만 등록한 채널은 수집 대상이 아니고, 그 채널의 관측도 알리지 않는다', () => {
  const address = { ref: ref(2), platform: 'tiktok', label: '주소만', status: 'not-connected' };
  const value = sns({ channels: [healthy(1, { disabled: true, lastCollectedAt: null, recentLastCollectedAt: null, lastAttemptAt: null }), address],
    checkpoints: [point(1, { status: 'manual-required' }), point(2, { channel: ref(2), status: 'missed' })] });
  for (const id of [channelId(1), channelId(2)]) assert.equal(byId(value, id).needs_attention, false);
  assert.equal(snsHealthEvents(value).filter(row => row.needs_attention).length, 0);
});

test('알린 채널의 연결을 끊으면 수집 대상에서 빠졌다고 한 번 알린다', () => {
  const bad = healthy(1, { lastCollectedAt: ago(FULL_STALE_MS + HOUR) });
  let state = plan(null, overviewOf(sns({})), new Date(NOW)).state;
  state = plan(state, overviewOf(sns({ channels: [bad] })), new Date(NOW + 300_000)).state;
  const off = sns({ channels: [{ ...bad, disabled: true }] });
  const out = plan(state, overviewOf(off), new Date(NOW + 600_000)).notifications;
  assert.equal(out.length, 1);
  assert.match(out[0].text, /수집 대상 아님/);
});

test('관측 기간 안의 manual-required는 한 번 알리고 숫자가 들어오면 한 번 알린다', () => {
  const run = lifecycle(sns({ checkpoints: [point(1)] }), sns({ checkpoints: [point(1, { status: 'manual-required', lastErrorCode: 'METRICS_UNAVAILABLE' })] }));
  assertOnce(run, /24시간 숫자 직접 입력 필요[^]*METRICS_UNAVAILABLE/);
  assert.match(run.recover[0].text, /24시간 관측 회복/);
});

test('수집기가 멈춰 관측이 한 시간 넘게 밀리면 한 번 알리고 숫자가 들어오면 한 번 알린다', () => {
  for (const late of [{ status: 'pending', dueAt: ago(CHECKPOINT_LATE_MS + HOUR) },
    { status: 'retry', nextAttemptAt: ago(CHECKPOINT_LATE_MS + 60_000) },
    { status: 'collecting', attemptedAt: ago(CHECKPOINT_LATE_MS + 60_000) }]) assertOnce(lifecycle(sns({ checkpoints: [point(1)] }), sns({ checkpoints: [point(1, late)] })), /24시간 관측 밀림/);
});

test('정해진 재시도를 기다리는 관측과 막 지난 관측은 사건이 아니고, 회복으로도 치지 않는다', () => {
  for (const waiting of [{ status: 'pending', dueAt: ago(CHECKPOINT_LATE_MS - 60_000) }, { status: 'retry', nextAttemptAt: ahead(HOUR) }, { status: 'collecting', attemptedAt: ago(60_000) }]) {
    assert.equal(byId(sns({ checkpoints: [point(1, waiting)] }), pointId(1)), undefined);
  }
  const late = sns({ checkpoints: [point(1, { status: 'pending', dueAt: ago(3 * HOUR) })] });
  let state = plan(null, overviewOf(sns({})), new Date(NOW)).state;
  state = plan(state, overviewOf(late), new Date(NOW + 300_000)).state;
  const out = plan(state, overviewOf(sns({ checkpoints: [point(1, { status: 'retry', nextAttemptAt: ahead(HOUR) })] })), new Date(NOW + 600_000));
  assert.equal(out.notifications.length, 0, '숫자가 들어오기 전에는 풀렸다고 하지 않는다');
});

test('놓친 관측은 채널마다 한 번 알리고, 같은 채널이 더 놓쳐도 다시 알리지 않으며 「풀림」도 없다', () => {
  const missed = n => point(n, { status: 'missed', closesAt: ago(HOUR), lastErrorCode: 'POST_NOT_IN_RESPONSE' });
  const run = lifecycle(sns({ checkpoints: [point(1)] }), sns({ checkpoints: [missed(1)] }));
  assert.equal(run.alert.length, 1);
  assert.match(run.alert[0].text, /채널1 관측 놓침 1건[^]*POST_NOT_IN_RESPONSE — 플랫폼이 준 게시물 목록에 이 글이 없어/);
  assert.equal(run.repeat.length, 0);
  assert.equal(run.recover.length, 0, '놓침은 되돌릴 수 없어 풀렸다고 하지 않는다');
  // 이미 알린 채널이 다음 날 또 놓쳐도 같은 사건이다
  let state = plan(null, overviewOf(sns({})), new Date(NOW)).state;
  state = plan(state, overviewOf(sns({ checkpoints: [missed(1)] })), new Date(NOW + 300_000)).state;
  const more = plan(state, overviewOf(sns({ checkpoints: [missed(1), missed(2), missed(3)] })), new Date(NOW + 600_000));
  assert.equal(more.notifications.length, 0);
  assert.match(byId(sns({ checkpoints: [missed(1), missed(2), missed(3)] }), missedId(1)).title, /놓침 3건/);
  // 3일 동안 새로 놓치지 않아 정상 줄로 돌아오면, 다음 놓침은 새 사건이다
  state = plan(more.state, overviewOf(sns({})), new Date(NOW + 900_000)).state;
  assert.equal(plan(state, overviewOf(sns({ checkpoints: [missed(4)] })), new Date(NOW + 1_200_000)).notifications.length, 1);
  // 모을 기간이 끝났는데 멈춘 관측도 놓친 것이다
  const stuck = sns({ checkpoints: [point(1, { status: 'pending', dueAt: ago(8 * HOUR), closesAt: ago(2 * HOUR) })] });
  assert.equal(byId(stuck, missedId(1)).needs_attention, true);
  assert.equal(byId(stuck, pointId(1)), undefined);
});

test('채널마다 놓침을 따로 센다', () => {
  const value = sns({ channels: channels(2), checkpoints: [point(1, { status: 'missed', closesAt: ago(HOUR) }), point(2, { channel: ref(2), status: 'missed', closesAt: ago(HOUR) })] });
  assert.equal(byId(value, missedId(1)).needs_attention, true);
  assert.equal(byId(value, missedId(2)).needs_attention, true);
});

test('놓친 관측이 조회 범위를 벗어나 사라져도 회복이라 하지 않는다', () => {
  const missed = sns({ checkpoints: [point(1, { status: 'missed', closesAt: ago(HOUR) })] });
  let state = plan(null, overviewOf(sns({})), new Date(NOW)).state;
  state = plan(state, overviewOf(missed), new Date(NOW + 300_000)).state;
  assert.equal(plan(state, overviewOf(sns({})), new Date(NOW + 600_000)).notifications.length, 0);
});

test('밀림 뒤 끝내 놓치면 회복이 아니라 놓침을 한 번 더 알린다', () => {
  const late = sns({ checkpoints: [point(1, { status: 'pending', dueAt: ago(3 * HOUR) })] });
  const missed = sns({ checkpoints: [point(1, { status: 'missed', closesAt: ago(HOUR) })] });
  let state = plan(null, overviewOf(sns({})), new Date(NOW)).state;
  state = plan(state, overviewOf(late), new Date(NOW + 300_000)).state;
  const out = plan(state, overviewOf(missed), new Date(NOW + 600_000)).notifications;
  assert.deepEqual(out.map(x => x.kind), ['attention']);
  assert.match(out[0].text, /관측 놓침/);
});

test('못 읽거나 낡은 회차는 판단을 바꾸지 않는다 — 없어진 사건은 회복이 아니다', () => {
  const bad = sns({ channels: [healthy(1, { status: 'error', failureKind: 'auth', requiresReconnect: true, lastFailureAt: ago(HOUR) })] });
  let state = plan(null, overviewOf(sns({})), new Date(NOW)).state;
  state = plan(state, overviewOf(bad), new Date(NOW + 300_000)).state;
  for (const gone of [{ ...sns({}), stale: true }, { ...sns({}), available: false }, { ...sns({}), appRunning: false }, { ...sns({}), collection: null }]) {
    const out = plan(state, overviewOf(gone), new Date(NOW + 600_000));
    assert.equal(out.notifications.length, 0);
    state = out.state;
  }
  const back = plan(state, overviewOf(bad), new Date(NOW + 900_000));
  assert.equal(back.notifications.length, 0, '다시 읽힌 같은 사건도 다시 알리지 않는다');
  assert.equal(plan(back.state, overviewOf(sns({})), new Date(NOW + 1_200_000)).notifications[0].kind, 'recovery');
});

test('집계 칸을 못 읽으면 한 번 알리고, 다음에 읽히면 풀렸다고 한 번 알린다', () => {
  const failed = { available: true, stale: false, appRunning: true, checkedAt: new Date(NOW).toISOString(), collection: null, collectionError: true };
  assertOnce(lifecycle(sns({}), failed), /SNS 집계 상태를 읽지 못함/);
});

test('조회가 상한에 걸리면 조용히 넘기지 않고 한 번 알린다', () => {
  assertOnce(lifecycle(sns({}), sns({ limited: true })), /조회 범위가 상한에 걸림/);
});

test('옛 사본처럼 집계 칸이 아직 없으면 아무 사건도 만들지 않는다', () => {
  assert.deepEqual(snsHealthEvents({ available: true, stale: false, appRunning: true, checkedAt: new Date(NOW).toISOString(), collection: null, collectionError: false }), []);
});

test('기준선 회차는 이미 있던 문제도 조용히 넘기고, 첫 감시 뒤의 첫 조회는 지금 문제를 한 번 알린다', () => {
  const bad = sns({ channels: [healthy(1, { status: 'error', failureKind: 'auth', requiresReconnect: true, lastFailureAt: ago(HOUR) })] });
  assert.equal(plan(null, overviewOf(bad), new Date(NOW)).notifications.length, 0);
  const running = plan(null, { events: [] }, new Date(NOW)).state;
  assert.equal(plan(running, overviewOf(bad), new Date(NOW + 300_000)).notifications.length, 1);
});

test('회복 표시가 없는 기존 사건의 알림 흐름은 그대로다', () => {
  const row = (needs_attention) => ({ id: 'sns-jobs', kind: 'sns', severity: 'info', title: 'SNS 예약 게시', detail: '', fingerprint: 'a', attention_fingerprint: 'a', needs_attention });
  let state = plan(null, { events: [row(false)] }, new Date(NOW)).state;
  state = plan(state, { events: [row(true)] }, new Date(NOW + 300_000)).state;
  assert.equal(plan(state, { events: [row(false)] }, new Date(NOW + 600_000)).notifications.length, 0);
});

test('성과·집계 알림은 한 번에 여섯 줄까지만 보이고 나머지 수를 밝힌다', () => {
  const many = Array.from({ length: 8 }, (_, i) => point(i + 1, { status: 'manual-required' }));
  const run = lifecycle(sns({ checkpoints: many.map(row => ({ ...row, status: 'recorded' })) }), sns({ checkpoints: many }));
  assert.match(run.alert[0].text, /그 밖에 2건/);
  assert.match(run.recover[0].text, /그 밖에 2건/);
});

test('허용하지 않은 칸은 사본에 남지 않고, 정제를 두 번 해도 같다', () => {
  const input = { appRunning: true, connections: [], inbox: [], jobs: { total: 0 }, collection: { schemaVersion: 1, enabled: true, limited: false, secret: 'private-token',
    channels: [healthy(1, { accessToken: 'private-token', lastError: 'private-error' })],
    checkpoints: [point(1, { metrics: { views: 1 }, message: 'private-message', createdBy: 'private-user' })] } };
  const once = sanitizeSns(input);
  assert.deepEqual(sanitizeSns(once), once);
  assert.doesNotMatch(JSON.stringify(once), /private-/);
});

test('집계 칸이 깨지면 기존 SNS 상태는 살리고 못 읽음으로 남긴다', () => {
  for (const collection of [{ schemaVersion: 2 }, { schemaVersion: 1, channels: [{ ref: 'bad' }], checkpoints: [] },
    { schemaVersion: 1, channels: [], checkpoints: [{ ref: ref(1), channel: ref(1), hours: 48 }] },
    { schemaVersion: 1, channels: Array.from({ length: 101 }, (_, i) => healthy(i + 1)), checkpoints: [] }]) {
    const out = sanitizeSns({ appRunning: true, connections: [{ platform: 'youtube', state: 'connected' }], inbox: [], jobs: { total: 1 }, collection });
    assert.equal(out.connections[0].state, 'connected');
    assert.equal(out.collection, undefined);
    assert.equal(out.collectionError, 'COLLECTION_READ_FAILED');
  }
});

async function collectRound(home, overview, now) {
  return collect({ home, root: home, now, readOverview: async () => overview });
}

test('회복 알림은 발송 대상으로 올라가고, 보내기 전에 다시 나빠지면 거둔다', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sns-health-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const bad = overviewOf(sns({ channels: [healthy(1, { status: 'error', failureKind: 'auth', requiresReconnect: true, lastFailureAt: ago(HOUR) })] }));
  const good = overviewOf(sns({}));
  await collectRound(home, good, new Date(NOW));
  const alert = await collectRound(home, bad, new Date(NOW + 300_000));
  assert.equal(alert.notifications.length, 1);
  assert.ok(attentionDraft(alert.notifications[0]));
  const outbox = path.join(home, 'runtime/synk-automation/outbox');
  fs.writeFileSync(path.join(outbox, alert.notifications[0].id + '.claim'), 'sent');

  const recovery = await collectRound(home, good, new Date(NOW + 600_000));
  assert.equal(recovery.notifications.length, 1);
  assert.ok(recoveryDraft(recovery.notifications[0]));
  assert.equal(recovery.notifications[0].kind, 'recovery');

  const again = await collectRound(home, bad, new Date(NOW + 900_000));
  assert.deepEqual(again.notifications.map(x => x.kind), ['attention'], '다시 나빠진 뒤 회복 소식은 나가지 않는다');
  assert.equal(JSON.parse(fs.readFileSync(path.join(outbox, recovery.notifications[0].id + '.claim'), 'utf8')).status, 'suppressed');
});

test('문제 알림이 나가기 전에 풀리면 둘 다 나가지 않는다 — 들은 적 없는 일을 풀렸다고 하지 않는다', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-sns-health-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const bad = overviewOf(sns({ channels: [healthy(1, { status: 'error', failureKind: 'auth', requiresReconnect: true, lastFailureAt: ago(HOUR) })] }));
  const good = overviewOf(sns({}));
  await collectRound(home, good, new Date(NOW));
  const alert = await collectRound(home, bad, new Date(NOW + 300_000));
  assert.equal(alert.notifications.length, 1, '보낼 알림은 있지만 발송부가 그 회차에 죽었다');
  const next = await collectRound(home, good, new Date(NOW + 600_000));
  assert.deepEqual(next.notifications, []);
  const outbox = path.join(home, 'runtime/synk-automation/outbox');
  assert.equal(JSON.parse(fs.readFileSync(path.join(outbox, alert.notifications[0].id + '.claim'), 'utf8')).status, 'suppressed');
  const state = JSON.parse(fs.readFileSync(path.join(home, 'runtime/synk-automation/state.json'), 'utf8'));
  assert.deepEqual(state.attentionAlerted, {}, '다음 사건은 처음부터 다시 센다');
});

test('한 알림에 묶인 사건 가운데 앞 알림이 실제로 나간 것만 회복을 알린다', () => {
  const broken = n => healthy(n, { status: 'error', failureKind: 'permanent', lastFailureAt: ago(HOUR) });
  const clock = n => new Date(NOW + n * 300_000);
  let state = plan(null, overviewOf(sns({ channels: channels(2) })), clock(0)).state;
  const first = plan(state, overviewOf(sns({ channels: [broken(1), healthy(2)] })), clock(1));
  state = first.state;
  const second = plan(state, overviewOf(sns({ channels: [broken(1), broken(2)] })), clock(2));
  state = second.state;
  // 첫 알림(채널1)만 나갔고 둘째(채널2)는 나가기 전에 둘 다 풀렸다
  const sent = id => id === first.notifications[0].id;
  const out = plan(state, overviewOf(sns({ channels: channels(2) })), clock(3), { delivered: sent });
  assert.equal(out.notifications.length, 1);
  assert.match(out.notifications[0].text, /채널1/);
  assert.doesNotMatch(out.notifications[0].text, /채널2/);
  assert.deepEqual(out.state.attentionAlerted, {}, '나가지 않은 알림의 사건도 지운다');
});

test('회복 알림은 발송부의 알림 식별자 규칙을 따른다', () => {
  const run = lifecycle(sns({}), sns({ channels: [healthy(1, { status: 'error', failureKind: 'permanent', lastFailureAt: ago(HOUR) })] }));
  assert.match(run.recover[0].id, /^event-[a-f0-9]{24}$/);
});
