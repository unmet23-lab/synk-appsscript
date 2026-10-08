'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { preflightText, statusText, errorGuidance } = require('../tools/classroom-media/operator-guide');
const now = Date.parse('2026-10-09T03:00:00Z');
const ago = ms => new Date(now - ms).toISOString();
const live = changes => ({ sessionKey: 'lesson-1', status: 'live', syncedAt: ago(1000),
  streamHealth: { streamStatus: 'active', healthStatus: 'good', checkedAt: ago(1000), issues: [] }, ...changes });

test('failed authentication refresh gives account repair guidance without a healthy-live claim', () => {
  const text = statusText([live({ lastError: 'YOUTUBE_AUTH_REFRESH_FAILED' })], { now });
  assert.match(text, /계정 인증·채널/);
  assert.doesNotMatch(text, /원인을 확인하지 못했습니다|최근 확인: 방송 신호 수신 중/);
});

test('live is recent only when both timestamps, current health, and last result agree', () => {
  assert.match(statusText([live()], { now }), /최근 확인: 방송 신호 수신 중/);
  for (const row of [live({ syncedAt: ago(150001) }), live({ lastError: 'YOUTUBE_NETWORK_ERROR' }),
    live({ streamHealth: { streamStatus: 'active', healthStatus: 'good', checkedAt: ago(150001) } }),
    live({ streamHealth: { streamStatus: 'inactive', healthStatus: 'noData', checkedAt: ago(1000) } })]) {
    const text = statusText([row], { now });
    assert.match(text, /방송 상태 미확인/);
    assert.doesNotMatch(text, /최근 확인: 방송 신호 수신 중/);
  }
});

test('future or invalid timestamps cannot certify a current broadcast', () => {
  for (const stamp of [ago(-1), 'not-a-date', null, Number.MAX_VALUE, Infinity]) {
    assert.match(statusText([live({ syncedAt: stamp })], { now }), /방송 상태 미확인/);
    assert.match(statusText([live({ streamHealth: { streamStatus: 'active', healthStatus: 'good', checkedAt: stamp } })], { now }), /방송 상태 미확인/);
  }
});

test('local block and failure to reflect the block on the server have distinct warnings', () => {
  const blocked = statusText([live({ playbackBlocked: true, lastError: 'STREAM_HEALTH_ERROR' })], { now });
  assert.match(blocked, /재생 일시 차단/);
  assert.doesNotMatch(blocked, /최근 확인: 방송 신호 수신 중/);
  const pending = statusText([live({ playbackBlocked: true, blockSyncError: 'SYNC_HTTP_503' })], { now });
  assert.match(pending, /차단 요청 저장됨 · 서버 반영 미확인/);
  assert.match(pending, /학생 화면도 함께 확인/);
});

test('ready is an archive state, not a fresh-live or private-invitation guarantee', () => {
  const text = statusText([{ sessionKey: 'replay', status: 'ready', syncedAt: ago(86400000), replaceReplay: true }], { now });
  assert.match(text, /영상 처리 완료 · 학생 재생 확인 필요/);
  assert.match(text, /학생 초대 완료는 이 기록으로 알 수 없습니다/);
  assert.match(text, /전체 수업 녹화가 보장되지는 않습니다/);
  assert.doesNotMatch(text, /방송 상태 미확인|마지막 반영 시각이 오래/);
});

test('presentation never serializes secrets, local paths, upload URLs, or unknown error payloads', () => {
  const secret = 'DO_NOT_SHOW_SECRET';
  const text = statusText([live({ title: '합성\u001b[31m\n수업\u202e', secret, uploadUrl: 'https://example.test/' + secret,
    recording: { file: 'C:/private/' + secret }, lastError: secret, blockSyncError: secret })], { now });
  assert.doesNotMatch(text, /DO_NOT_SHOW_SECRET|https:\/\/example|C:\/private/);
  assert.doesNotMatch(text, /[\u001b\u202e]/);
  assert.ok(!text.includes('합성\n수업'));
  assert.doesNotMatch(errorGuidance(secret), /DO_NOT_SHOW_SECRET/);
});

test('preflight uses configured capacity and known reason messages without trusting supplied descriptions', () => {
  const GiB = 1024 ** 3;
  const text = preflightText({ ok: false, checks: [
    { code: 'RECORDING_DISK_SPACE', ok: false, freeBytes: 25 * GiB, minimumFreeBytes: 40 * GiB, reason: 'INSUFFICIENT_SPACE' },
    { code: 'DIRECTORY_READY', directory: 'inboxDir', ok: false, reason: 'NOT_WRITABLE', path: 'SECRET_PATH' },
    { code: 'CLASS_SYNC_KEY', classIndex: 2, ok: false, reason: 'MISSING', value: 'SECRET_VALUE' },
  ], manualChecksRequired: [{ description: 'DO_NOT_ECHO_THIS' }] });
  assert.match(text, /25\.0 GiB.*40\.0 GiB/);
  assert.match(text, /녹화 완료 폴더: 쓸 수 없습니다/);
  assert.match(text, /반별 동기화키 2번: 설정되지 않았습니다/);
  assert.match(text, /원본을 보존/);
  assert.doesNotMatch(text, /SECRET_PATH|SECRET_VALUE|DO_NOT_ECHO_THIS/);
  const pass = preflightText({ ok: true, checks: [{ code: 'CONFIG_PLACEHOLDERS', ok: true }] });
  assert.match(pass, /로컬 자동 검사 통과/);
  assert.match(pass, /실제 송출·학생 시청 완료를 뜻하지 않습니다/);
});

test('manual recovery guidance preserves the order of Studio inspection and conditional retry', () => {
  const text = errorGuidance('BROADCAST_CREATE_AMBIGUOUS_MANUAL_RECOVERY');
  assert.ok(text.indexOf('Studio에서 영상 생성 여부를 먼저') < text.indexOf('retry-create'));
  assert.match(text, /이미 있으면 recover/);
  assert.match(text, /없음을 확인한 경우에만 retry-create --confirmed-no-video/);
  assert.match(errorGuidance('PENDING_FALLBACK_REQUIRES_REVIEW'), /작업 state는 지우지/);
  assert.match(errorGuidance('BROADCAST_ALREADY_ENDED'), /같은 수업으로 재개되지 않습니다/);
  assert.match(errorGuidance('PLAYLIST_INSERT_AMBIGUOUS_MANUAL_REVIEW'), /목록 추가를 반복하지/);
  assert.match(errorGuidance('STREAM_NOT_REUSABLE'), /올바른 재사용 스트림/);
});

test('blocked replacement and missing actual times guide recovery before retrying or editing state', () => {
  const blocked = errorGuidance('BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY');
  assert.match(blocked, /기존 영상의 재생 차단.*교체를 보류/);
  assert.match(blocked, /서버 차단 해제까지 확인한 뒤 교체/);
  assert.match(blocked, /녹화 원본과 작업 기록을 보존/);
  const pending = errorGuidance('BROADCAST_ACTUAL_TIMES_PENDING');
  assert.match(pending, /실제 시작·종료 시각/);
  assert.match(pending, /worker가 실행 중이면 다시 조회/);
  assert.match(pending, /예정 시각이나 현재 시각으로 작업 기록을 고치지/);
});

test('sequence errors explain ordering conflicts without advising an unsafe reset', () => {
  assert.match(errorGuidance('STALE_SYNC_SEQUENCE'), /더 최신인 요청.*서버에 이미 반영/);
  assert.match(errorGuidance('STALE_SYNC_SEQUENCE'), /순서 값을 임의로 낮추거나.*지우지/);
  for (const code of ['SYNC_SEQUENCE_INVALID', 'SYNC_SEQUENCE_EXHAUSTED']) {
    assert.match(errorGuidance(code), /서버와 최신 작업 기록을 대조/);
    assert.match(errorGuidance(code), /순서를 초기화하거나 작업 기록을 지우지/);
  }
});

test('retry times are conditional on a running worker and audio errors stay actionable', () => {
  const text = statusText([live({ nextAttemptAt: ago(-10000), lastError: 'STREAM_HEALTH_ERROR',
    streamHealth: { streamStatus: 'active', healthStatus: 'bad', checkedAt: ago(1000), issues: [{ type: 'noAudioStream', severity: 'error' }] } })], { now });
  assert.match(text, /worker 실행 중이면 다음 재시도 예정/);
  assert.match(text, /마이크·음소거·오디오 트랙/);
  assert.doesNotMatch(text, /최근 확인: 방송 신호 수신 중/);
  assert.match(statusText([live({ nextAttemptAt: ago(1000) })], { now }), /예정 시각이 지났습니다/);
});

test('a paused job does not claim live health or promise an automatic retry from stale metadata', () => {
  for (const nextAttemptAt of [ago(-10000), ago(10000)]) {
    const text = statusText([live({ nextAttemptAt, lastError: 'SYNC_NETWORK_ERROR', blockSyncError: 'SYNC_HTTP_503',
      syncPaused: { code: 'VIDEO_ALREADY_LINKED', status: 409, at: ago(500) } })], { now });
    assert.match(text, /동기화 일시정지/);
    assert.match(text, /다른 수업에 이미 연결/);
    assert.match(text, /자동 조회·동기화·업로드 재시도는 중단/);
    assert.match(text, /서버 반영 미확인/);
    assert.doesNotMatch(text, /최근 확인: 방송 신호 수신 중|다음 재시도 예정|재시도 예정 시각이 지났|worker가 실행 중이면 재시도/);
    assert.ok(text.indexOf('원인을 해결한 뒤') < text.indexOf('retry-sync CONFIG SESSION --confirmed-resolved'));
    assert.match(text, /로컬 일시정지만 해제/);
    assert.match(text, /소유권 재확인과 정상 동기화/);
    assert.match(text, /작업 파일을 지우거나 순서를 초기화하지/);
  }
});

test('pause guidance separates conflict causes without exposing unknown server data', () => {
  assert.match(errorGuidance('SESSION_IDENTITY_CONFLICT'), /서버 기록과 다릅니다/);
  assert.match(errorGuidance('STALE_STATE'), /이미 더 진행된 수업 상태/);
  for (const code of ['SYNC_MANUAL_REVIEW_REQUIRED', 'SYNC_REVIEW_CONFIRMATION_REQUIRED']) {
    const guidance = errorGuidance(code);
    assert.ok(guidance.indexOf('충돌을 해결한 뒤') < guidance.indexOf('--confirmed-resolved'));
    assert.match(guidance, /작업 기록과 순서를 초기화하지/);
  }
  assert.match(errorGuidance('SYNC_RETRY_NOT_APPLICABLE'), /일시정지 상태가 아닙니다/);
  assert.doesNotMatch(statusText([live({ syncPaused: { code: 'SYNC_HTTP_503', status: 503, at: ago(500) } })], { now }), /worker가 실행 중이면 재시도/);
  const secret = 'DO_NOT_SHOW_PAUSE_SECRET';
  const text = statusText([live({ syncPaused: { code: secret, status: secret, at: secret,
    response: { token: secret }, uploadUrl: 'https://example.test/' + secret } })], { now });
  assert.match(text, /동기화 일시정지/);
  assert.match(text, /기록 없음/);
  assert.match(text, /원인을 확인하지 못했습니다/);
  assert.doesNotMatch(text, /DO_NOT_SHOW_PAUSE_SECRET|https:\/\/example|최근 확인: 방송 신호 수신 중/);
});
