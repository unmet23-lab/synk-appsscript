'use strict';
// Turns the company server's document fields into attention rows. No remote call, no credentials, no write.
// Elapsed time is always measured from the last server read: this cache is re-read every 5 minutes for 3 hours,
// so measuring from the wall clock would call finished work "late" until the next read.
const status = require('./status.cjs');

const HOUR = 60 * 60_000;
const FULL_STALE_MS = 26 * HOUR; // 매일 09:00 전체 수집의 하루 + 여유 2시간
const RECENT_STALE_MS = 6 * HOUR; // 30분 최근 수집이 열두 번 넘게 빠진 때
const WAIT_LIMIT_MS = 72 * HOUR; // 한도 대기가 정상으로 인정되는 끝(24시간 재시도 세 번)
const CHECKPOINT_LATE_MS = HOUR; // 관측 수집기는 1분마다 돈다
const MAX_CHANNELS = 100;
const MAX_CHECKPOINTS = 300;
const MISSED_HINT = Object.freeze({ POST_NOT_IN_RESPONSE: '플랫폼이 준 게시물 목록에 이 글이 없어 자동으로 못 읽었습니다' });
const PLATFORM = Object.freeze({ youtube: '유튜브', instagram: '인스타그램', facebook: '페이스북', tiktok: '틱톡' });

const code = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : null;
const when = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const ref = value => typeof value === 'string' && /^[a-f0-9]{12}$/.test(value) ? value : null;
const clock = value => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; };
const later = (a, b) => a !== null && b !== null && a > b;

function sanitizeCollection(payload) {
  if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.channels) || !Array.isArray(payload.checkpoints)) throw new Error('COLLECTION_SHAPE');
  if (payload.channels.length > MAX_CHANNELS || payload.checkpoints.length > MAX_CHECKPOINTS) throw new Error('COLLECTION_LIMIT');
  const channels = payload.channels.map(row => {
    if (!ref(row?.ref) || !Object.hasOwn(PLATFORM, row.platform)) throw new Error('COLLECTION_CHANNEL');
    return { ref: row.ref, platform: row.platform, label: status.plain(row.label, 80) || PLATFORM[row.platform], disabled: row.disabled === true,
      status: code(row.status), failureKind: code(row.failureKind), failureCode: code(row.failureCode), requiresReconnect: row.requiresReconnect === true,
      nextRetryAt: when(row.nextRetryAt), lastFailureAt: when(row.lastFailureAt), lastCollectedAt: when(row.lastCollectedAt), lastAttemptAt: when(row.lastAttemptAt),
      recentStatus: code(row.recentStatus), recentFailureKind: code(row.recentFailureKind), recentFailureCode: code(row.recentFailureCode), recentRequiresReconnect: row.recentRequiresReconnect === true,
      recentNextRetryAt: when(row.recentNextRetryAt), recentLastFailureAt: when(row.recentLastFailureAt), recentLastCollectedAt: when(row.recentLastCollectedAt),
      failingSince: when(row.failingSince) };
  });
  const checkpoints = payload.checkpoints.map(row => {
    if (!ref(row?.ref) || !ref(row.channel) || ![24, 72].includes(row.hours) || !when(row.dueAt) || !when(row.closesAt)) throw new Error('COLLECTION_CHECKPOINT');
    return { ref: row.ref, channel: row.channel, title: status.plain(row.title, 80) || '게시물', hours: row.hours, status: code(row.status) || 'unknown',
      dueAt: when(row.dueAt), closesAt: when(row.closesAt), nextAttemptAt: when(row.nextAttemptAt), attemptedAt: when(row.attemptedAt), lastErrorCode: code(row.lastErrorCode) };
  });
  // 꺼짐은 설정이 false라고 적힌 때뿐이다 — 설정을 못 읽은 것을 꺼짐으로 알리지 않는다.
  return { schemaVersion: 1, enabled: payload.enabled !== false, limited: payload.limited === true, channels, checkpoints };
}

// collection-policy.mjs currentFailure와 같은 판단이다. 실패 뒤 성공이 있으면 지난 일이다.
function failing(state, kind, reconnect, failedAt, collectedAt) {
  if (later(clock(collectedAt), clock(failedAt))) return false;
  return state === 'error' || !!kind || reconnect || clock(failedAt) !== null;
}
const neverCollected = row => clock(row.lastCollectedAt) === null && failing(row.status, row.failureKind, row.requiresReconnect, row.lastFailureAt, null);

// The server rewrites every attempt/failure time, so a channel that never completed a full scan has no fixed clock.
// This cache keeps the first read that saw it failing, carried from the previous cache, and drops it on the first success.
function carryFailingSince(collection, previous, checkedAt) {
  if (!collection) return collection;
  const before = new Map((previous?.channels || []).map(row => [row.ref, row.failingSince]));
  return { ...collection, channels: collection.channels.map(row => {
    const { failingSince, ...rest } = row;
    return neverCollected(row) ? { ...rest, failingSince: before.get(row.ref) || checkedAt } : rest;
  }) };
}
const frozen = (failed, kind, reconnect) => failed && (reconnect || kind === 'auth') ? 'auth' : failed && kind === 'permanent' ? 'permanent' : null;

function channelState(row, at) {
  if (row.disabled) return { state: 'off' };
  const traces = [row.lastCollectedAt, row.recentLastCollectedAt, row.lastAttemptAt, row.lastFailureAt, row.recentLastFailureAt].map(clock).filter(value => value !== null);
  // 주소만 등록한 채널은 수집 대상이 아니다. 연결 여부는 인증 표를 읽지 않고 수집 흔적으로 본다.
  if (!traces.length) return { state: 'untracked' };
  const full = frozen(failing(row.status, row.failureKind, row.requiresReconnect, row.lastFailureAt, row.lastCollectedAt), row.failureKind, row.requiresReconnect);
  const recent = frozen(failing(row.recentStatus, row.recentFailureKind, row.recentRequiresReconnect, row.recentLastFailureAt, row.recentLastCollectedAt || row.lastCollectedAt), row.recentFailureKind, row.recentRequiresReconnect);
  if (full || recent) return { state: full || recent, failureCode: full ? row.failureCode : row.recentFailureCode };
  // 전체 수집에 성공한 적 없이 실패만 있으면, 처음 실패를 본 조회부터 잰다 — 시도 시각이 새로워도 멈춘 것이다.
  const fullBase = clock(row.lastCollectedAt) ?? (neverCollected(row) ? clock(row.failingSince) ?? at : Math.min(...traces));
  const recentBase = clock(row.recentLastCollectedAt) ?? fullBase;
  const waiting = [[row.failureKind, row.nextRetryAt], [row.recentFailureKind, row.recentNextRetryAt]]
    .some(([kind, next]) => ['transient', 'rate-limit'].includes(kind) && later(clock(next), at));
  const fullAge = at - fullBase;
  if (fullAge > FULL_STALE_MS && !(waiting && fullAge <= WAIT_LIMIT_MS)) return { state: 'stale', failureCode: row.failureCode || row.recentFailureCode };
  return { state: 'ok', recentStale: !waiting && at - recentBase > RECENT_STALE_MS };
}

function checkpointState(row, at) {
  if (row.status === 'recorded') return 'ok';
  const due = clock(row.dueAt), closes = clock(row.closesAt);
  if (row.status === 'missed' || at > closes) return 'missed';
  if (row.status === 'manual-required') return 'manual';
  const base = row.status === 'retry' ? clock(row.nextAttemptAt) ?? due : row.status === 'collecting' ? clock(row.attemptedAt) ?? due : due;
  // 기다리는 관측은 사건으로 내지 않는다 — 없어진 사건은 회복이 아니라서, 밀림이 풀렸다고 말하려면 숫자가 들어와야 한다.
  return ['pending', 'retry', 'collecting'].includes(row.status) && at - base > CHECKPOINT_LATE_MS ? 'late' : 'waiting';
}

function healthRows({ collection, failed = false, checkedAt, formatTime = value => String(value) }) {
  const at = clock(checkedAt);
  if (at === null || !collection && !failed) return [];
  // 못 읽은 회차도 한 번은 알린다 — 조용한 감시가 가장 위험하다. 다음에 읽히면 이 줄로 풀린다.
  const rows = [{ id: 'coverage-sns-collection', kind: 'coverage', severity: failed ? 'warning' : 'info',
    title: failed ? 'SNS 집계 상태를 읽지 못함' : 'SNS 집계 상태를 읽음',
    detail: failed ? `조회 ${formatTime(checkedAt)} · 회사 서버의 채널·관측 칸을 읽지 못해 집계 멈춤을 알 수 없습니다.` : `조회 ${formatTime(checkedAt)}`,
    needed: failed, content: { id: 'coverage-sns-collection', failed } }];
  if (!collection) return rows;
  rows.push({ id: 'coverage-sns-collection-limited', kind: 'coverage', severity: collection.limited ? 'warning' : 'info',
    title: collection.limited ? 'SNS 집계 조회 범위가 상한에 걸림' : 'SNS 집계 조회 범위 안',
    detail: collection.limited ? '채널 100개·관측 300건까지만 읽어 일부를 보지 못했습니다 · 상한을 늘려야 합니다.' : '채널·관측을 상한 안에서 모두 읽었습니다.',
    needed: collection.limited, content: { id: 'coverage-sns-collection-limited', limited: collection.limited } });
  const tracked = [];
  const names = {};
  const states = collection.channels.map(row => {
    const value = channelState(row, at);
    names[row.ref] = { label: `${PLATFORM[row.platform]} ${row.label}`, tracked: !['off', 'untracked'].includes(value.state) };
    if (names[row.ref].tracked) tracked.push(row);
    return { row, value };
  });
  const stopped = states.filter(({ value }) => value.state === 'stale' || value.recentStale);
  const allStopped = collection.enabled && stopped.length >= 3 && stopped.length > tracked.length / 2;
  rows.push({ id: 'sns-collection-off', kind: 'sns-collection', severity: collection.enabled ? 'info' : 'error',
    title: collection.enabled ? 'SNS 자동 수집 켜짐' : 'SNS 자동 수집이 꺼져 있음',
    detail: collection.enabled ? '회사 서버의 자동 수집 설정이 켜져 있습니다.' : '회사 서버 설정에서 자동 수집이 꺼졌습니다. 채널 집계가 더 들어오지 않습니다 · 작업실 설정에서 확인',
    needed: !collection.enabled, content: { id: 'sns-collection-off', off: !collection.enabled } });
  rows.push({ id: 'sns-collection-stopped', kind: 'sns-collection', severity: allStopped ? 'error' : 'info',
    title: allStopped ? 'SNS 집계가 채널 전체에서 멈춤' : 'SNS 집계가 채널 전체에서 돌고 있음',
    detail: allStopped ? `연결된 채널 ${tracked.length}개 중 ${stopped.length}개의 수집이 밀렸습니다(전체 26시간·최근 6시간) · 회사 서버 수집기를 확인`
      : `연결된 채널 ${tracked.length}개 · 조회 ${formatTime(checkedAt)}`,
    needed: allStopped, content: { id: 'sns-collection-stopped', stopped: allStopped } });
  for (const { row, value } of states) {
    const id = 'sns-collection-' + row.ref;
    const name = names[row.ref].label;
    const failure = value.failureCode ? ' · ' + value.failureCode : '';
    if (value.state === 'auth') rows.push({ id, kind: 'sns-collection', severity: 'error', title: `${name} · 다시 연결 필요`,
      detail: `연결이 만료됐거나 권한이 모자라 자동 수집이 멈췄습니다${failure} · 작업실 「계정 연결」에서 다시 연결`, needed: true, content: { id, state: 'auth', code: value.failureCode || null } });
    else if (value.state === 'permanent') rows.push({ id, kind: 'sns-collection', severity: 'error', title: `${name} · 수집 실패로 멈춤`,
      detail: `자동으로 다시 시도하지 않는 오류입니다${failure} · 작업실에서 채널 상태를 보고 직접 수집`, needed: true, content: { id, state: 'permanent', code: value.failureCode || null } });
    else if (value.state === 'stale') rows.push({ id, kind: 'sns-collection', severity: 'warning', title: `${name} · 전체 수집 멈춤`,
      detail: `26시간 넘게 성공이 없습니다 · 마지막 수집 ${formatTime(row.lastCollectedAt)}${failure}`, needed: true, notify: !allStopped && collection.enabled,
      content: { id, state: 'stale', grouped: allStopped || !collection.enabled } });
    else rows.push({ id, kind: 'sns-collection', severity: 'info', title: `${name} · ${value.state === 'ok' ? '집계 정상' : '수집 대상 아님'}`,
      detail: value.state === 'ok' ? `마지막 수집 ${formatTime(row.lastCollectedAt)}` : '연결을 끊었거나 주소만 등록한 채널이라 자동 수집을 보지 않습니다.', needed: false, content: { id, state: 'ok' } });
  }
  // 놓친 관측은 채널마다 사건 하나다. 원인이 같으면 거의 매일 새로 놓치므로(10-31 운영: 페이스북 글 POST_NOT_IN_RESPONSE),
  // 처음 한 번만 알리고, 그 채널이 3일 동안 새로 놓치지 않아 정상 줄로 돌아온 뒤에야 다음 사건을 센다. 놓침은 되돌릴 수 없어 「풀림」도 없다.
  const missed = {};
  for (const row of collection.checkpoints) {
    const name = names[row.channel];
    if (!name?.tracked) continue;
    const state = checkpointState(row, at);
    if (state === 'waiting') continue;
    if (state === 'missed') { (missed[row.channel] ||= []).push(row); continue; }
    const id = 'sns-performance-' + row.ref;
    const post = `「${row.title}」`;
    if (state === 'ok') rows.push({ id, kind: 'sns-performance', severity: 'info', title: `게시 성과 · ${name.label} ${row.hours}시간 관측 회복`, detail: `${post} 숫자가 들어왔습니다.`, needed: false, content: { id, state } });
    else if (state === 'manual') rows.push({ id, kind: 'sns-performance', severity: 'warning', title: `게시 성과 · ${name.label} ${row.hours}시간 숫자 직접 입력 필요`,
      detail: `${post} ${formatTime(row.closesAt)}까지 · ${row.lastErrorCode ? row.lastErrorCode + ' · ' : ''}작업실 「게시 준비·성과」에서 확인`, needed: true, content: { id, state } });
    else if (state === 'late') rows.push({ id, kind: 'sns-performance', severity: 'warning', title: `게시 성과 · ${name.label} ${row.hours}시간 관측 밀림`,
      detail: `${post} 읽을 시각 ${formatTime(row.dueAt)} · 모을 기간 끝 ${formatTime(row.closesAt)} · 서버 관측 수집기를 확인`, needed: true, content: { id, state } });
  }
  for (const channel of collection.channels) {
    if (!names[channel.ref].tracked) continue;
    const id = 'sns-performance-missed-' + channel.ref;
    const list = (missed[channel.ref] || []).sort((a, b) => b.closesAt.localeCompare(a.closesAt));
    const codes = [...new Set(list.map(row => row.lastErrorCode).filter(Boolean))];
    const hint = codes.map(code => MISSED_HINT[code]).find(Boolean);
    rows.push(list.length ? { id, kind: 'sns-performance', severity: 'warning', title: `게시 성과 · ${names[channel.ref].label} 관측 놓침 ${list.length}건(최근 3일)`,
      detail: `최근 「${list[0].title}」 ${list[0].hours}시간 · 모을 기간 끝 ${formatTime(list[0].closesAt)}${codes.length ? ' · ' + codes.join(', ') : ''}${hint ? ' — ' + hint : ''} · 본 값이 있으면 작업실 「게시 준비·성과」에서 직접 입력`,
      needed: true, recovery: false, content: { id, state: 'missed' } }
      : { id, kind: 'sns-performance', severity: 'info', title: `게시 성과 · ${names[channel.ref].label} 최근 3일 놓친 관측 없음`, detail: '', needed: false, recovery: false, content: { id, state: 'ok' } });
  }
  return rows;
}

module.exports = { sanitizeCollection, carryFailingSince, healthRows, channelState, checkpointState, FULL_STALE_MS, RECENT_STALE_MS, WAIT_LIMIT_MS, CHECKPOINT_LATE_MS };
