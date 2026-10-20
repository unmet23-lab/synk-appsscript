'use strict';

// Pure text presentation. Never serialize jobs or interpolate unknown errors.
const LIVE_FRESH_MS = 150000;
const clean = value => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').slice(0, 80) : '';
const stamp = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8640000000000000 ? value
  : typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
const fresh = (value, now) => { const time = stamp(value); return Number.isFinite(time) && time <= now && now - time <= LIVE_FRESH_MS; };
function timeText(value) {
  const time = stamp(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(time)) + ' (한국시간)' : '기록 없음';
}
function gib(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? (value / 1024 ** 3).toFixed(1) + ' GiB' : '확인 안 됨';
}

function errorGuidance(code, { paused = false } = {}) {
  if (typeof code !== 'string') return '원인을 확인하지 못했습니다. 담당자에게 로컬 작업 기록 확인을 요청하고 녹화 원본을 보존하세요.';
  if (['CONFIG_PLACEHOLDERS', 'ANON_KEY', 'CLASS_SYNC_KEY', 'SYNC_ENV_MISSING'].includes(code))
    return '담당자가 예제 설정값과 공개키·반별 동기화키를 확인한 뒤 check를 다시 실행하세요. 키 원문을 안내에 붙이지 마세요.';
  if (['DIRECTORY_READY', 'MINIMUM_FREE_BYTES', 'RECORDING_DISK_SPACE'].includes(code))
    return '녹화 폴더·권한·여유 공간을 확인하세요. 녹화 원본을 보존한 채 공간을 확보하고 check를 다시 실행하세요.';
  if (['YOUTUBE_NETWORK_ERROR', 'SYNC_NETWORK_ERROR', 'UPLOAD_NO_PROGRESS', 'UPLOAD_FINAL_RESPONSE_PENDING'].includes(code)
    || /^(?:YOUTUBE|SYNC|UPLOAD|UPLOAD_INIT)_HTTP_(?:408|429|5[0-9]{2})$/.test(code))
    return paused
      ? '연결 또는 서버 응답 오류가 기록되어 있습니다. 담당자가 서버와 로컬 작업 기록을 대조해 일시정지 원인을 확인하세요. 녹화 원본과 작업 기록을 유지하고 새 영상을 중복 생성하지 마세요.'
      : '연결 또는 서버 응답을 기다리고 있습니다. worker가 실행 중이면 재시도합니다. 녹화 원본과 작업 기록을 유지하고 새 영상을 중복 생성하지 마세요.';
  if (['YOUTUBE_CREDENTIAL_MISSING', 'YOUTUBE_AUTH_REFRESH_FAILED', 'CHANNEL_MISMATCH'].includes(code)
    || /^(?:YOUTUBE|SYNC|UPLOAD|UPLOAD_INIT)_HTTP_(?:401|403)$/.test(code))
    return '담당자가 계정 인증·채널·반 연결과 API 권한 또는 할당량을 확인해야 합니다. 설정을 확인한 뒤 재시도하세요.';
  if (code === 'SYNC_HTTP_409')
    return '저장된 수업과 상태 또는 영상 정보가 충돌합니다. 같은 수업을 반복 준비하거나 작업 기록을 지우지 말고 담당자에게 확인을 요청하세요.';
  if (code === 'VIDEO_ALREADY_LINKED')
    return '이 영상이 서버의 다른 수업에 이미 연결되어 있습니다. 담당자가 반·수업·영상 연결을 대조하고 중복 worker 여부를 확인하세요. 다른 수업의 연결을 덮어쓰거나 새 영상을 만들어 우회하지 마세요.';
  if (code === 'SESSION_IDENTITY_CONFLICT')
    return '저장된 수업의 반·교실·영상 연결이 서버 기록과 다릅니다. 담당자가 서버와 로컬 원본 기록을 대조하세요. 수업 키나 영상 ID를 임의로 바꾸거나 작업 기록을 지우지 마세요.';
  if (code === 'STALE_STATE')
    return '서버가 이미 더 진행된 수업 상태를 저장했습니다. 담당자가 Studio의 실제 방송 상태와 서버·로컬 기록을 대조하세요. 서버 상태를 되돌리거나 같은 수업을 새로 준비하지 마세요.';
  if (['SYNC_MANUAL_REVIEW_REQUIRED', 'SYNC_REVIEW_CONFIRMATION_REQUIRED'].includes(code))
    return '동기화가 일시정지된 수업은 담당자 확인이 필요합니다. status CONFIG --human으로 원인을 확인하고 서버·로컬·Studio의 충돌을 해결한 뒤 retry-sync CONFIG SESSION --confirmed-resolved를 실행하세요. 이후 once/watch의 정상 조회와 동기화까지 확인하세요. 작업 기록과 순서를 초기화하지 마세요.';
  if (code === 'SYNC_RETRY_NOT_APPLICABLE')
    return '이 수업은 동기화 일시정지 상태가 아닙니다. status CONFIG --human으로 현재 오류와 다음 행동을 확인하세요. 작업 기록을 바꿔 일시정지를 만들거나 복구 명령을 반복하지 마세요.';
  if (code === 'STALE_SYNC_SEQUENCE')
    return '더 최신인 요청이 서버에 이미 반영되어 오래된 요청을 거절했습니다. worker는 다음 요청에 새 순서를 사용합니다. 계속되면 담당자가 중복 worker 실행과 최신 작업 기록을 확인하세요. 순서 값을 임의로 낮추거나 작업 기록을 지우지 마세요.';
  if (['SYNC_SEQUENCE_INVALID', 'SYNC_SEQUENCE_EXHAUSTED'].includes(code))
    return '저장된 동기화 순서가 잘못되었거나 사용 가능한 범위를 넘었습니다. 담당자가 서버와 최신 작업 기록을 대조해야 합니다. 순서를 초기화하거나 작업 기록을 지우지 말고 녹화 원본을 보존하세요.';
  if (code === 'BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY')
    return '기존 영상의 재생 차단이 해제되지 않아 교체를 보류했습니다. 기존 영상의 공개설정·교실 연결과 오류를 복구하세요. 동기화가 일시정지됐다면 담당자 확인 후 retry-sync로 재개하고, worker의 정상 조회로 서버 차단 해제까지 확인한 뒤 교체하세요. 녹화 원본과 작업 기록을 보존하세요.';
  if (code === 'BROADCAST_ACTUAL_TIMES_PENDING')
    return '방송은 종료됐지만 YouTube의 실제 시작·종료 시각을 확인하지 못했습니다. worker가 실행 중이면 다시 조회합니다. 계속되면 Studio에서 종료 상태를 확인하세요. 예정 시각이나 현재 시각으로 작업 기록을 고치지 말고 녹화 원본을 보존하세요.';
  if (['STREAM_ERROR', 'STREAM_NOT_READY', 'STREAM_NOT_ACTIVE', 'STREAM_HEALTH_ERROR', 'STREAM_HEALTH_NO_DATA', 'STREAM_STATUS_UNKNOWN'].includes(code))
    return 'OBS 송출 연결과 YouTube 스트림 상태를 확인하세요. 마이크 입력·음소거·오디오 트랙을 확인하고 직접 들어 보세요. 입력이 정상화되면 다음 성공 조회에서 차단을 해제합니다.';
  if (['STREAM_NOT_OWNED', 'STREAM_NOT_REUSABLE', 'STREAM_REUSABLE_UNKNOWN', 'SESSION_STREAM_CONFIG_CHANGED'].includes(code))
    return '담당자가 이 교실의 올바른 재사용 스트림인지 확인해야 합니다. 기존 수업의 연결을 임의로 덮어쓰지 말고 확인 전 방송을 시작하지 마세요.';
  if (['VIDEO_NOT_OWNED_EXPECTED_PRIVACY', 'BROADCAST_NOT_OWNED_EXPECTED_PRIVACY', 'PLAYLIST_NOT_OWNED_UNLISTED', 'LIVE_MAPPING_INVALID', 'BROADCAST_BOUND_TO_OTHER_CLASS'].includes(code))
    return '영상·재생목록의 채널, 정해진 공개설정과 교실 연결을 확인하세요. 비공개 영상을 공개로 바꾸지 마세요. 정상화 뒤 다음 성공 조회에서 차단을 해제합니다.';
  if (['BROADCAST_CREATE_AMBIGUOUS_MANUAL_RECOVERY', 'UPLOAD_CREATE_AMBIGUOUS_MANUAL_RECOVERY', 'UPLOAD_SESSION_EXPIRED_MANUAL_RECOVERY'].includes(code))
    return 'YouTube Studio에서 영상 생성 여부를 먼저 확인하세요. 이미 있으면 recover로 연결하고, 없음을 확인한 경우에만 retry-create --confirmed-no-video를 사용하세요. 이후 라이브는 prepare, 녹화 업로드는 once/watch로 재개합니다. 녹화 원본과 작업 기록은 보존하세요.';
  if (code === 'PLAYLIST_INSERT_AMBIGUOUS_MANUAL_REVIEW')
    return 'YouTube Studio에서 영상이 해당 반 재생목록에 있는지 확인하세요. 없으면 한 번 추가하고 다음 조회를 기다리세요. 목록 추가를 반복하지 마세요.';
  if (code === 'WORKER_LOCKED_CHECK_PID_BEFORE_REMOVING_LOCK')
    return '다른 worker가 실행 중인지 먼저 확인하세요. 비정상 종료한 PID가 끝났음을 확인한 경우에만 잠금파일을 처리하세요. 작업 state를 지우지 마세요.';
  if (['OBS_RECORDING_IN_PROGRESS', 'ROOM_HAS_UNFINISHED_LIVE', 'CLASS_HAS_UNFINISHED_LIVE'].includes(code))
    return '현재 방송·녹화와 완료 파일 등록이 끝났는지 확인하세요. 녹화 원본과 점유 파일을 보존하고 정상 완료 또는 담당자의 복구 확인 뒤 다음 수업을 준비하세요.';
  if (code === 'BROADCAST_ALREADY_ENDED')
    return '종료된 방송은 같은 수업으로 재개되지 않습니다. Studio에서 종료와 로컬 녹화 완료를 확인하세요. 이어송출은 새 수업 키로 준비하고, 복습 완본은 직접 확인한 뒤 replace-replay를 사용하세요. 새 비공개 영상은 학생을 다시 초대해야 합니다.';
  if (['REPLAY_REQUIRES_ENDED_LIVE', 'FALLBACK_REQUIRES_FAILED_LIVE', 'COMPLETE_RECORDING_CONFIRMATION_REQUIRED'].includes(code))
    return '진행 중인 방송에는 완본 교체를 적용하지 마세요. 종료된 수업과 전체 녹화를 직접 확인한 뒤 replace-replay --confirmed-complete를 사용하세요. 기존 --fallback은 failed 상태 전용입니다. 새 영상의 비공개 초대와 앱 초대 확인이 다시 필요합니다.';
  if (code === 'PENDING_FALLBACK_REQUIRES_REVIEW')
    return '기존 fallback 요청을 먼저 확인하세요. 담당자가 해당 요청을 완료 폴더 밖에 보관한 뒤 완본 교체를 다시 접수하세요. 녹화 원본과 작업 state는 지우지 마세요.';
  if (code === 'CLASS_CLOSED')
    return '이 반은 close-cohort로 기수를 마쳐 닫았습니다. 닫은 반으로는 방송·녹화·업로드를 하지 않습니다. 새 기수는 새 반 ID·재생목록·이용권으로 config에 더해 준비하세요. 닫은 반의 영상을 다시 열어야 하면 담당자가 Studio에서 직접 확인하세요.';
  if (['CLASS_HAS_UNFINISHED_SESSIONS', 'CLASS_HAS_PENDING_RECORDING'].includes(code))
    return '이 반에 아직 끝나지 않은 수업·녹화가 있습니다. status CONFIG --human으로 확인하고 방송 종료·업로드·처리(완료 또는 실패)와 동기화 일시정지 해결이 끝난 뒤 close-cohort를 다시 실행하세요. 읽지 못한 녹화 완료 파일이 버릴 것이면 담당자가 확인한 뒤 inbox 밖 보관 폴더로 옮기세요. 녹화 원본과 작업 기록은 보존하세요.';
  if (code === 'CLASS_ARMED')
    return '이 반으로 준비된 녹화(arm)가 있는데 그 수업이 아직 끝나지 않았습니다. 그 수업을 녹화할 것이면 끝난 뒤, 하지 않을 것이면 담당자가 작업 기록 폴더의 그 active-*.json을 보관 폴더로 옮긴 뒤 close-cohort를 다시 실행하세요.';
  if (['PLAYLIST_NOT_OWNED', 'PLAYLIST_TOO_LARGE'].includes(code))
    return '반 재생목록이 이 채널의 것인지, config의 재생목록 ID가 맞는지 확인하세요. 확인 전에는 영상의 공개설정을 바꾸지 마세요.';
  if (['VIDEO_STILL_NOT_PRIVATE', 'VIDEO_STILL_SCHEDULED', 'PLAYLIST_STILL_NOT_PRIVATE'].includes(code))
    return '바꾼 뒤 다시 읽었을 때 아직 비공개가 아니거나 예약 공개가 남은 영상·재생목록이 있습니다. 같은 close-cohort 명령을 다시 실행하세요. 계속되면 Studio에서 그 영상의 공개설정과 예약을 직접 확인하세요.';
  if (['RECORDING_STILL_CHANGING', 'SEALED_RECORDING_CHANGED', 'EMPTY_RECORDING', 'RECORDING_READ_TRUNCATED', 'SESSION_RECORDING_CONFLICT', 'MANIFEST_ALREADY_EXISTS', 'RECORDING_COMPLETION_REQUIRED', 'RECORDING_END_TIME_REQUIRED', 'SESSION_RECORDING_ALREADY_COMPLETED'].includes(code))
    return '녹화가 종료되었는지, 파일과 수업 연결이 맞는지 확인하세요. 원본을 보존하고 처음·중간·끝을 재생한 뒤 담당자가 등록 기록을 확인해야 합니다. 확인 없이 원본을 덮어쓰거나 완료 파일을 재생성하지 마세요.';
  return '원인을 확인하지 못했습니다. 담당자에게 로컬 작업 기록 확인을 요청하고 녹화 원본을 보존하세요.';
}

function preflightText(result) {
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const passed = result?.ok === true && checks.length > 0 && checks.every(check => check?.ok === true);
  const lines = [passed ? '로컬 자동 검사 통과' : '로컬 준비 확인 필요'];
  const credentialReasons = { MISSING: '설정되지 않았습니다', PLACEHOLDER: '예제값이 남아 있습니다', INVALID_FORMAT: '공백 또는 형식이 잘못되었습니다', TOO_SHORT: '길이가 부족합니다' };
  const directoryReasons = { MISSING: '폴더가 없습니다', NOT_DIRECTORY: '폴더 경로가 아닙니다', NOT_READABLE: '읽을 수 없습니다', NOT_WRITABLE: '쓸 수 없습니다', UNAVAILABLE: '접근 상태를 확인할 수 없습니다' };
  const directoryNames = { stateDir: '작업 기록 폴더', inboxDir: '녹화 완료 폴더', recordingsRoot: '녹화 원본 폴더' };
  for (const check of checks) {
    if (!check || typeof check !== 'object') continue;
    let text;
    switch (check.code) {
      case 'CONFIG_PLACEHOLDERS':
        text = check.ok ? '예제 설정값 없음' : '예제 설정값이 남아 있습니다. 담당자가 실제 운영 설정으로 바꾸세요.';
        break;
      case 'ANON_KEY':
      case 'CLASS_SYNC_KEY': {
        const suffix = Number.isInteger(check.classIndex) && check.classIndex > 0 ? ' ' + check.classIndex + '번' : '';
        const name = check.code === 'ANON_KEY' ? '공개키' : '반별 동기화키' + suffix;
        text = check.ok ? name + ' 형식 확인' : name + ': ' + (credentialReasons[check.reason] || '확인할 수 없습니다') + '. 담당자가 설정한 뒤 다시 검사하세요.';
        break;
      }
      case 'DIRECTORY_READY':
        text = (directoryNames[check.directory] || '운영 폴더') + (check.ok ? ' 접근 확인' : ': ' + (directoryReasons[check.reason] || '확인할 수 없습니다') + '. 담당자가 폴더와 접근 권한을 확인하세요.');
        break;
      case 'MINIMUM_FREE_BYTES':
        text = check.ok ? '최소 여유 공간 기준: ' + gib(check.minimumFreeBytes)
          : '최소 여유 공간 기준이 잘못되었습니다. minimumFreeBytes를 0보다 큰 정수 바이트로 설정하세요.';
        break;
      case 'RECORDING_DISK_SPACE':
        text = '녹화 디스크 여유: ' + gib(check.freeBytes) + ' / 설정된 최소 기준: ' + gib(check.minimumFreeBytes);
        if (!check.ok) text += check.reason === 'INSUFFICIENT_SPACE'
          ? '. 원본을 보존한 채 여유 공간을 확보하고 다시 검사하세요.'
          : '. 디스크와 최소 여유 공간 설정을 확인한 뒤 다시 검사하세요.';
        break;
      default:
        text = '추가 검사 결과를 해석할 수 없습니다. 담당자가 검사 항목을 확인하세요.';
    }
    lines.push((check.ok === true ? '✓ ' : '확인 필요: ') + text);
  }
  lines.push('실제 확인 필요: OBS 교실 연결·완료 스크립트, 카메라 화면, 마이크 음량·잡음·동기, 종료된 녹화 파일의 전체 재생.');
  const manual = Array.isArray(result?.manualChecksRequired) ? result.manualChecksRequired.map(check => check?.code) : null;
  if (!manual || manual.includes('STUDENT_PRIVATE_VIDEO_ACCESS')) lines.push('비공개 반은 학생 Google 계정 초대와 앱의 초대 확인 후 실제 학생 계정 재생·미초대 계정 차단을 확인하세요.');
  if (manual?.includes('STUDENT_UNLISTED_VIDEO_NOTICE')) lines.push('일부공개 반은 초대가 필요 없습니다. 앱에서 수강생에게만 링크가 보이는지, 화면·제목에 학생 이름과 얼굴이 나오지 않는지 확인하세요. 기수가 끝나면 close-cohort로 닫습니다.');
  lines.push('이 결과는 로컬 설정 검사이며 실제 송출·학생 시청 완료를 뜻하지 않습니다.');
  return lines.join('\n');
}

function statusText(jobs, { now = Date.now(), closedClasses = [], privacyByClass = {} } = {}) {
  const closed = Array.isArray(closedClasses) ? closedClasses.filter(item => item && typeof item === 'object') : [];
  if ((!Array.isArray(jobs) || !jobs.length) && !closed.length) return '저장된 수업 작업이 없습니다. 로컬 기록만으로 현재 송출 여부는 알 수 없습니다.';
  if (!Array.isArray(jobs)) jobs = [];
  const clock = Number.isFinite(now) ? now : NaN;
  const lines = ['저장된 작업 상태 · 실시간 화면을 직접 확인한 결과는 아닙니다.'];
  for (const item of closed) {
    const name = clean(item.displayName) || clean(item.classId) || '반';
    lines.push('', name + (item.closedAt ? ' — 기수 닫음 · ' + timeText(item.closedAt)
      : ' — 닫는 중 · 남은 문제 ' + (Number.isInteger(item.failures) ? item.failures : 0) + '개 · 같은 close-cohort 명령을 다시 실행하세요'));
  }
  jobs.forEach((job, index) => {
    const current = job && typeof job === 'object' ? job : {};
    const label = clean(current.title) || clean(current.displayName) || clean(current.sessionKey) || '수업 ' + (index + 1);
    const health = current.streamHealth && typeof current.streamHealth === 'object' ? current.streamHealth : {};
    const issues = Array.isArray(health.issues) ? health.issues : [];
    const healthy = health.streamStatus === 'active' && ['good', 'ok'].includes(health.healthStatus) && !issues.some(issue => issue?.severity === 'error');
    const paused = current.syncPaused && typeof current.syncPaused === 'object' ? current.syncPaused : null;
    if (current.cohortClosedAt) {
      lines.push('', label + ' — 기수 마침 · 자동 조회 멈춤 · 영상 공개설정은 위 반 줄에서 확인');
      lines.push('닫은 시각: ' + timeText(current.cohortClosedAt));
      return;
    }
    let state;
    if (paused) state = '동기화 일시정지 · 담당자 확인 필요';
    else if (current.blockSyncError) state = '차단 요청 저장됨 · 서버 반영 미확인';
    else if (current.playbackBlocked) state = '재생 일시 차단';
    else if (current.status === 'live') {
      state = !current.lastError && fresh(current.syncedAt, clock) && fresh(health.checkedAt, clock) && healthy
        ? '최근 확인: 방송 신호 수신 중' : '방송 상태 미확인';
    } else {
      state = ({ scheduled: '수업 예정', processing: '업로드 또는 복습 영상 처리 중', ready: '영상 처리 완료 · 학생 재생 확인 필요', failed: '영상 처리 실패 · 복구 확인 필요' })[current.status] || '작업 상태 미확인';
    }
    lines.push('', label + ' — ' + state);
    lines.push('마지막 앱 상태 반영: ' + timeText(current.syncedAt));
    if (current.status === 'live') lines.push('마지막 스트림 확인: ' + timeText(health.checkedAt));
    if (current.status === 'live' && !fresh(current.syncedAt, clock)) lines.push('마지막 반영 시각이 오래되었거나 확인할 수 없습니다. 현재 방송 중이라고 판단하지 마세요.');
    if (paused) {
      lines.push('일시정지 저장 시각: ' + timeText(paused.at));
      lines.push('이 수업의 자동 조회·동기화·업로드 재시도는 중단되었습니다. OBS 송출·녹화의 실제 상태는 직접 확인하세요.');
      lines.push('원인 확인: ' + errorGuidance(paused.code, { paused: true }));
      lines.push('재개 절차: 담당자가 서버·로컬 작업 기록과 YouTube Studio를 대조해 원인을 해결한 뒤 retry-sync CONFIG SESSION --confirmed-resolved를 실행하세요. 이 명령은 로컬 일시정지만 해제합니다. once/watch의 소유권 재확인과 정상 동기화까지 확인해야 복구가 끝납니다.');
      lines.push('기존 영상·녹화 원본·작업 기록과 동기화 순서를 유지하세요. 작업 파일을 지우거나 순서를 초기화하지 마세요.');
    } else if (current.lastError) lines.push('다음 행동: ' + errorGuidance(current.lastError));
    if (current.blockSyncError) lines.push(paused
      ? '차단 반영 확인: 서버 반영 미확인입니다. 재개 후 동기화 결과와 학생 화면도 함께 확인하세요.'
      : '차단 반영 확인: ' + errorGuidance(current.blockSyncError) + ' 학생 화면도 함께 확인하세요.');
    if (issues.some(issue => issue?.type === 'noAudioStream')) lines.push('오디오 확인: YouTube가 오디오 입력 문제를 보고했습니다. 마이크·음소거·오디오 트랙을 확인하고 직접 들어 보세요.');
    else if (issues.some(issue => issue?.severity === 'warning')) lines.push('스트림 품질 경고가 있습니다. OBS와 YouTube Studio에서 영상·음성을 확인하세요.');
    const next = stamp(current.nextAttemptAt);
    if (!paused && Number.isFinite(next)) lines.push(next > clock
      ? 'worker 실행 중이면 다음 재시도 예정: ' + timeText(next)
      : '저장된 재시도 예정 시각이 지났습니다. worker 실행 여부와 최근 처리 결과를 확인하세요.');
    if ((current.status === 'ready' || current.replaceReplay) && privacyByClass[current.classId] !== 'unlisted') lines.push('비공개 영상의 학생 초대 완료는 이 기록으로 알 수 없습니다. 새 영상은 재초대와 앱 초대 확인 후 실제 학생 계정으로 재생하세요.');
    if (current.status === 'ready') lines.push('처리 성공만으로 전체 수업 녹화가 보장되지는 않습니다. 원본과 영상의 처음·중간·끝을 확인하세요.');
  });
  return lines.join('\n');
}

const COHORT_ACTIONS = {
  'make-private': ['비공개로 바꿀 예정', '비공개로 바꿈'], unschedule: ['예약 공개를 풀고 비공개로 둘 예정', '예약 공개를 풀고 비공개로 둠'],
  'already-private': ['이미 비공개'], missing: ['YouTube에서 찾지 못함 · 그대로'], 'not-owned': ['다른 채널 영상 · 그대로'],
  'other-class': ['다른 반 수업 영상 · 그대로'], 'left-public': ['공개 영상 · 그대로(필요하면 Studio에서 직접 판단)'],
  'left-unlisted': ['일부공개 · 이 반 종류가 아니라 그대로'], 'left-unknown': ['공개설정을 알 수 없음 · 그대로'],
};
function closeCohortText(result) {
  const preview = result?.preview === true;
  const done = action => { const names = COHORT_ACTIONS[action] || ['확인 필요']; return preview ? names[0] : names[names.length - 1]; };
  const lines = [preview ? '미리 보기 · 아직 아무것도 바꾸지 않았습니다.'
    : result?.closed ? '기수를 닫았습니다. 반 영상과 재생목록이 비공개이고, worker는 이 반을 더 다루지 않습니다.'
      : '닫는 중 문제가 남았습니다. 같은 close-cohort 명령을 다시 실행하세요. 이 반은 이미 worker에서 빠졌습니다.'];
  lines.push('재생목록: ' + (result?.playlist === 'already-private' ? '이미 비공개' : preview ? '비공개로 바꿀 예정' : '비공개로 바꿈'));
  for (const video of Array.isArray(result?.videos) ? result.videos : []) {
    const where = video?.from === 'playlist' ? ' · 재생목록에서만 찾음' : video?.from === 'replaced-live' ? ' · 교체된 라이브' : '';
    lines.push('- ' + (clean(video?.title) || '제목 없음') + ' (' + clean(video?.videoId) + ') — ' + done(video?.action) + where);
  }
  if (Array.isArray(result?.notHeld) && result.notHeld.length) lines.push('열리지 않은 수업(작업 기록에 실패로 남김): ' + result.notHeld.map(clean).join(', '));
  if (Array.isArray(result?.staleArms) && result.staleArms.length) lines.push('지난 수업의 OBS 준비 파일 ' + result.staleArms.length + '개를 ' + (preview ? '보관 이름으로 바꿀 예정' : '보관 이름으로 바꿈'));
  for (const failure of Array.isArray(result?.failures) ? result.failures : []) {
    lines.push('문제: ' + (clean(failure?.videoId) || clean(failure?.playlistId) || '?') + ' — ' + errorGuidance(failure?.error));
  }
  if (preview) lines.push('바꾸려면 이 반의 앱 이용권이 끝난 것을 확인한 뒤 같은 명령에 --confirmed-cohort-ended를 붙여 다시 실행하세요.');
  return lines.join('\n');
}

module.exports = { preflightText, statusText, errorGuidance, closeCohortText };
