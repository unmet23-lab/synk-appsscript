// 솔리오 「백업」 방의 글(2026-11-20). DOM이 없다. 본체(src/solio-backup.cjs)의 스냅숏 하나를 방의 결론 · 할 일 · 줄 · 단추로 옮긴다.
// 계약: experiences/solo-backup-rust/STAGE1_DESIGN.md 4.13. 솔리오 비서 네 가지(ROADMAP 「솔리오는 그 사람만의 비서처럼 말한다」)를 따른다.
// 맨 위 한 문장은 지금 가장 급한 한 가지이고, 「지키고 있습니다」는 상태 파일이 safe이고 예정 시각이 지나지 않았을 때만 쓴다.
// 스냅숏에는 경로 · 파일 이름 · 계정 주소가 없다. 이 파일도 그런 값을 만들지 않는다.

export const SOLIO_BACKUP_NAME = '백업';

const TOPIC_NAMES = Object.freeze({ status: '백업 상태', folders: '백업 폴더', changes: '많이 바뀐 파일', devices: '기기', restore: '되살리기 증명', space: '저장 공간', signin: 'Google 로그인', update: '엔진 업데이트' });
const PROOF_WORDS = Object.freeze({ passed: '통과', failed: '실패', incomplete: '덜 끝남', skipped: '건너뜀' });
const STAGE_WORDS = Object.freeze({ backup: '백업하는', check: '백업을 점검하는', proof: '되살리기를 증명하는', restore: '파일을 되살리는', move: '옮겨 오는', setup: '처음 설정하는', other: '일하는' });
const UNINSTALL = 'Windows 설정의 「설치된 앱」에서 「SYNK 업무 백업」을 지웁니다. 솔리오를 지워도 엔진은 남아 백업을 이어 갑니다.';

const pad = n => String(n).padStart(2, '0');
function clockWords(date) {
  const h = date.getHours(), m = date.getMinutes();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(m)}`;
}
/* 「오늘 오후 3:50」 · 「어제 오후 3:50」 · 「내일 오전 9:00」 · 「11월 16일 오후 3:00」 */
export function backupWhen(value, now = Date.now()) {
  const at = Date.parse(value || '');
  if (!Number.isFinite(at)) return '';
  const date = new Date(at), today = new Date(now);
  const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(date) - day(today)) / 86400000);
  const lead = diff === 0 ? '오늘' : diff === -1 ? '어제' : diff === 1 ? '내일' : `${date.getMonth() + 1}월 ${date.getDate()}일`;
  return `${lead} ${clockWords(date)}`;
}
export function backupDay(value) {
  const at = Date.parse(value || '');
  if (!Number.isFinite(at)) return '';
  const date = new Date(at);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
export function backupBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return '';
  const units = [['TB', 1024 ** 4], ['GB', 1024 ** 3], ['MB', 1024 ** 2]];
  for (const [unit, size] of units) if (bytes >= size) return `${(bytes / size).toFixed(bytes / size >= 100 ? 0 : 1)}${unit}`;
  return '1MB 미만';
}
const topicList = words => words.map(w => TOPIC_NAMES[w]).filter(Boolean).join(', ');

const act = (label, action, arg = '', extra = {}) => ({ label, act: action, arg, ...extra });
const ENGINE_ACTS = Object.freeze([act('파일 되살리기', 'backup-open', 'restore'), act('새 PC로 옮겨 오기', 'backup-open', 'move'), act('엔진 창 열기', 'backup-open', 'status')]);

/* 설치 중 · 끝 · 실패의 글. 시작 단추가 연 일이 남아 있는 동안은 이것이 방의 맨 위다 */
const INSTALL_SAY = Object.freeze({
  feed: ['백업 엔진 설치 파일을 찾고 있습니다.', ''],
  download: ['백업 엔진을 받는 중입니다.', '다 받으면 우리가 올린 파일인지 확인한 뒤에만 엽니다.'],
  verify: ['받은 설치 파일이 우리가 올린 파일인지 확인하고 있습니다.', '크기, SHA-256, 서명이 모두 맞아야 엽니다.'],
  admin: ['관리자 확인 창에서 「예」를 눌러 주세요.', '「예」를 누르면 설치 창 없이 깔고, 끝나면 엔진이 Google 로그인을 엽니다.'],
  install: ['백업 엔진을 깔고 있습니다.', '끝나면 엔진 창이 열리고 Google 로그인으로 이어집니다.'],
  opening: ['엔진 창을 여는 중입니다.', ''],
  opened: ['엔진 창에서 이어서 해 주세요.', '엔진 창이 Google 로그인으로 바로 이어집니다. 엔진 창이 보이지 않으면 아래 「엔진 창 열기」를 눌러 주세요.'],
  done: ['백업 엔진을 깔았습니다.', '엔진 창에서 Google 로그인과 보호 범위 확인을 마치면 지키기 시작합니다.'],
});
const ERROR_SAY = Object.freeze({
  FEED_MISSING: ['백업 엔진 설치 파일이 아직 올라오지 않아 받을 수 없습니다.', '첫 배포 판이 올라오면 이 자리에서 바로 받을 수 있습니다.'],
  FEED_INVALID: ['설치 파일 목록이 올바르지 않아 받지 않았습니다.', '잠시 뒤 다시 해 주세요. 계속되면 SYNK에 알려 주세요.'],
  NETWORK: ['설치 파일을 받지 못했습니다.', '인터넷 연결을 확인한 뒤 「다시 받기」를 눌러 주세요.'],
  UNTRUSTED_REDIRECT: ['설치 파일 주소가 우리가 쓰는 곳이 아니어서 받지 않았습니다.', '잠시 뒤 「다시 받기」를 눌러 주세요.'],
  VERIFY_FAILED: ['받은 파일이 우리가 올린 설치 파일과 달라 열지 않았습니다.', '「다시 받기」를 눌러 새로 받아 주세요.'],
  LOCK_FAILED: ['받은 파일을 확인하는 동안 잠그지 못해 열지 않았습니다.', '다른 프로그램이 그 파일을 쓰고 있을 수 있습니다. 「다시 받기」를 눌러 주세요.'],
  DECLINED: ['관리자 확인을 받지 못해 깔지 않았습니다.', '관리자 계정으로 「예」를 눌러야 깔립니다. 다시 하려면 「다시 받기」를 눌러 주세요.'],
  INSTALL_STOPPED: ['설치가 끝나지 않았습니다.', '설치 창이 닫혔거나 다른 프로그램이 막았을 수 있습니다. 「다시 받기」를 눌러 주세요.'],
  STORAGE: ['이 PC에 설치 파일을 저장하지 못했습니다.', '디스크 공간을 확인한 뒤 「다시 받기」를 눌러 주세요.'],
  REQUEST_FAILED: ['엔진에 보호 시작을 알리지 못했습니다.', '이 Windows 계정의 앱 데이터 폴더에 쓰지 못했습니다. 「다시 하기」를 눌러 주세요.'],
  OPEN_FAILED: ['엔진 창을 열지 못했습니다.', '시작 메뉴에서 「SYNK 업무 백업」을 직접 열어도 이어집니다. 다시 하려면 「다시 하기」를 눌러 주세요.'],
});
/* 엔진이 이미 있는 길(요청만 쓰고 창 열기)의 실패는 받기가 아니므로 다시 하기 단추 이름이 다르다 */
const RETRY_LABEL = Object.freeze({ REQUEST_FAILED: '다시 하기', OPEN_FAILED: '다시 하기' });

function installScene(install) {
  const phase = install?.phase;
  if (!phase || phase === 'idle') return null;
  if (phase === 'error') {
    const [say, then] = ERROR_SAY[install.code] || ['설치를 마치지 못했습니다.', '「다시 받기」를 눌러 주세요.'];
    const retry = install.code === 'FEED_MISSING' ? [] : [act(RETRY_LABEL[install.code] || '다시 받기', 'backup-start', install.mode || 'protect', { primary: true })];
    return { say, then, acts: [...retry, act('닫기', 'backup-dismiss')] };
  }
  const [say0, then] = INSTALL_SAY[phase] || INSTALL_SAY.feed;
  const say = phase === 'download' && Number.isFinite(install.progress) ? `백업 엔진을 받는 중입니다(${install.progress}%).` : say0;
  const acts = phase === 'opened' ? [act('엔진 창 열기', 'backup-open', 'status', { primary: true }), act('닫기', 'backup-dismiss')]
    : phase === 'done' ? [act('확인', 'backup-dismiss', '', { primary: true })] : [];
  return { say, then, acts, busy: !['opened', 'done'].includes(phase) };
}

function statusRows(snap, now) {
  const s = snap.status || {}, rows = [];
  if (s.lastBackupAt) rows.push({ key: 'last', nm: '마지막 확인', val: backupWhen(s.lastBackupAt, now), more: [['note', '엔진이 백업을 마지막으로 확인한 때입니다.']] });
  if (s.proof) rows.push({ key: 'proof', nm: '되살리기 증명', mid: PROOF_WORDS[s.proof.result] || '', val: backupDay(s.proof.at), more: [['note', '백업에서 파일을 실제로 되살려 보고 원본과 같은지 견준 결과입니다.']] });
  if (Number.isSafeInteger(s.folders)) rows.push({ key: 'folders', nm: '지키는 폴더', mid: `${s.folders}개`, val: backupBytes(s.bytes), more: [['note', '폴더 이름은 엔진 창의 「백업 폴더」에서 봅니다. 솔리오는 이름을 읽지 않습니다.']] });
  rows.push({ key: 'next', nm: '다음 백업', val: s.writer === false ? '없음' : backupWhen(s.nextRunAt, now) || '정해지지 않음', more: [['note', s.writer === false ? '이 PC는 백업을 쓰는 기기가 아닙니다.' : '로그인해 있는 동안 매시간 저절로 백업합니다.']] });
  rows.push({ key: 'engine', nm: '백업 엔진', val: snap.engine?.version || s.engine || '', more: [['say', '엔진 지우기'], ['note', UNINSTALL]] });
  return rows;
}
const SETUP_ROWS = Object.freeze([
  Object.freeze({ key: 'how', nm: '까는 방법', val: '관리자 확인 한 번', more: Object.freeze([['note', 'PC 앱이 설치 파일을 직접 받아, 크기와 SHA-256과 서명이 맞을 때만 엽니다. 설치 창 없이 깔립니다.']]) }),
  Object.freeze({ key: 'google', nm: '로그인', val: 'Google 계정', more: Object.freeze([['note', '복구 정보는 손님의 Google 계정에 보관합니다. 우리 서버가 멈춰도 되살릴 수 있게 하려는 것입니다.'], ['note', 'SYNK ID를 Google로 로그인했다면 그 주소로 바로 이어집니다.']]) }),
  Object.freeze({ key: 'remove', nm: '지우기', val: '설치된 앱에서', more: Object.freeze([['note', UNINSTALL]]) }),
]);

/* 방 하나. visible:false면 이 계정에게는 방도 오브제도 없다(유호님 계정이 아니거나 PC 앱 밖) */
export function solioBackupView(snap, now = Date.now()) {
  if (!snap || snap.ok !== true || snap.available !== true) return { visible: false };
  const base = { visible: true, when: '', scope: '', rows: [], acts: [], note: '' };
  const view = snap.view;
  if (view === 'windows-only') return { ...base, say: '백업은 Windows PC에서만 쓸 수 있습니다.', then: 'Mac에는 백업 엔진을 깔 수 없습니다. Windows PC의 솔리오에서 시작해 주세요.', note: 'Windows 전용' };
  const installing = installScene(snap.install);
  const engineRows = statusRows(snap, now);
  const startView = view === 'no-engine' || view === 'engine-removed' || view === 'needs-setup';
  if (installing) return { ...base, say: installing.say, then: installing.then, acts: installing.acts, rows: startView ? [...SETUP_ROWS] : engineRows, busy: !!installing.busy, note: installing.busy ? '설치 중' : '' };

  if (view === 'no-engine' || view === 'engine-removed') {
    const removed = view === 'engine-removed';
    const feed = snap.feed?.state;
    const say = removed ? '백업 엔진이 지워져서 지금은 이 PC를 백업하지 않습니다.' : '이 PC의 업무 파일은 아직 백업하지 않고 있습니다.';
    if (feed === 'missing') {
      return { ...base, say, then: '백업 엔진 설치 파일이 아직 올라오지 않아 지금은 받을 수 없습니다.', rows: [...SETUP_ROWS], note: '아직 받을 수 없음',
        acts: [act('아직 받을 수 없음', 'backup-start', 'protect', { primary: true, disabled: true })] };
    }
    const then = removed ? '「다시 깔기」를 누르면 엔진을 받아 깔고 이어서 지킵니다. 클라우드의 백업은 지우지 않았습니다.'
      : feed === 'error' ? '설치 파일 목록을 아직 읽지 못했습니다. 「보호 시작」을 누르면 한 번 더 읽어 봅니다.'
        : '「보호 시작」을 누르면 백업 엔진을 받아 깔고, 관리자 확인 한 번 뒤 Google 로그인으로 이어집니다. 새 PC라면 「이 PC로 옮겨 오기」를 누릅니다.';
    return { ...base, say, then, rows: [...SETUP_ROWS], note: removed ? '엔진 없음' : '시작 전',
      acts: [act(removed ? '다시 깔기' : '보호 시작', 'backup-start', 'protect', { primary: true }), act('이 PC로 옮겨 오기', 'backup-start', 'move')] };
  }
  if (view === 'needs-setup') {
    const restoreOnly = snap.status?.state === 'restore-only';
    return { ...base, rows: engineRows, note: '시작 전',
      say: restoreOnly ? '이 PC는 옮겨 온 파일을 되살리기만 하고, 백업은 하지 않습니다.' : '백업 엔진은 깔려 있지만, 이 Windows 계정은 아직 보호를 시작하지 않았습니다.',
      then: restoreOnly ? '이 PC도 지키려면 「보호 시작」을 누릅니다. 엔진 창에서 Google 로그인으로 바로 이어집니다.' : '「보호 시작」을 누르면 엔진 창에서 Google 로그인으로 바로 이어집니다. 새 PC라면 「이 PC로 옮겨 오기」를 누릅니다.',
      acts: restoreOnly ? [act('보호 시작', 'backup-start', 'protect', { primary: true }), act('파일 되살리기', 'backup-open', 'restore')]
        : [act('보호 시작', 'backup-start', 'protect', { primary: true }), act('이 PC로 옮겨 오기', 'backup-start', 'move')] };
  }
  if (view === 'engine-newer') {
    return { ...base, rows: engineRows, note: '업데이트 필요', say: '백업 엔진이 솔리오보다 새 판이라 상태를 읽지 못했습니다.', then: '솔리오(SYNK PC 앱)를 업데이트해 주세요. 그동안 백업 상태는 엔진 창에서 봅니다.',
      acts: [act('엔진 창 열기', 'backup-open', 'status', { primary: true }), ...ENGINE_ACTS.slice(0, 2)] };
  }
  if (view === 'engine-unknown') {
    return { ...base, rows: [...SETUP_ROWS], note: '확인 중', say: '백업 엔진이 이 PC에 깔려 있는지 확인하지 못했습니다.',
      then: '잠시 뒤 이 방을 다시 열면 한 번 더 확인합니다. 그동안 엔진을 새로 받지 않습니다.', acts: [] };
  }
  if (view === 'status-unreadable') {
    return { ...base, rows: engineRows, note: '확인 필요', say: '백업 엔진이 남긴 상태를 읽지 못했습니다.',
      then: '엔진 창을 열면 지금 상태를 볼 수 있습니다. 엔진이 다음에 상태를 새로 쓰면 여기서도 보입니다.',
      acts: [act('엔진 창 열기', 'backup-open', 'status', { primary: true }), ...ENGINE_ACTS.slice(0, 2)] };
  }
  const s = snap.status || {};
  if (view === 'checking') {
    return { ...base, rows: engineRows, note: '확인 중', say: '백업 상태를 확인하는 중입니다.',
      then: `예정된 백업(${backupWhen(s.nextRunAt, now)})에서 2시간 넘게 새 소식이 없습니다. 엔진 창을 열어 확인해 주세요.`,
      acts: [act('엔진 창 열기', 'backup-open', 'status', { primary: true }), ...ENGINE_ACTS.slice(0, 2)] };
  }
  const job = s.job ? `지금 ${STAGE_WORDS[s.job.stage] || STAGE_WORDS.other} 중입니다${Number.isFinite(s.job.percent) ? `(${s.job.percent}%)` : ''}. ` : '';
  const last = s.lastBackupAt ? `마지막 확인은 ${backupWhen(s.lastBackupAt, now)}입니다.` : '';
  const proofFailed = s.proof && s.proof.result !== 'passed' && s.proof.result !== 'skipped';
  let say, then, note, first = null;
  switch (s.state) {
    case 'safe': {
      // 지키는 중이어도 엔진이 주의 낱말을 함께 쓸 수 있다(되살리기 · 업데이트 · 공간 따위). 있으면 그 일이 할 일의 맨 앞이다
      const topics = topicList(s.attention || []);
      say = Number.isSafeInteger(s.folders) && s.folders > 0 ? `업무 폴더 ${s.folders}개를 지키고 있습니다.` : '이 PC의 업무 파일을 지키고 있습니다.';
      then = job + (topics ? `다만 엔진 창에서 확인할 일이 있습니다: ${topics}. ` : proofFailed ? `마지막 되살리기 증명이 ${PROOF_WORDS[s.proof.result]}이라 엔진 창에서 확인해 주세요. ` : '') + last;
      note = topics ? '확인 필요' : '지키는 중';
      if (topics) first = act('엔진 창에서 확인', 'backup-open', s.attention[0], { primary: true });
      else if (proofFailed) first = act('증명 확인', 'backup-open', 'restore', { primary: true });
      break;
    }
    case 'starting': say = '첫 백업을 준비하고 있습니다.'; then = job + '첫 백업이 끝나면 로그인해 있는 동안 매시간 저절로 지킵니다.'; note = '첫 백업 전'; break;
    case 'attention': {
      const topics = topicList(s.attention || []);
      say = topics ? `확인할 일이 있습니다: ${topics}.` : '확인할 일이 있습니다.';
      then = job + '엔진 창에서 확인해 주세요. ' + last;
      note = '확인 필요';
      first = act('엔진 창에서 확인', 'backup-open', (s.attention || [])[0] || 'status', { primary: true });
      break;
    }
    case 'paused': say = '백업을 잠시 멈춰 두었습니다.'; then = '멈춘 동안 바뀐 파일은 백업되지 않습니다. 엔진 창에서 다시 켤 수 있습니다. ' + last; note = '멈춤'; first = act('엔진 창에서 다시 켜기', 'backup-open', 'status', { primary: true }); break;
    case 'off': say = '자동 백업을 꺼 두었습니다.'; then = '이대로면 새로 바뀐 파일이 백업되지 않습니다. 엔진 창에서 켜 주세요. ' + last; note = '꺼짐'; first = act('엔진 창에서 켜기', 'backup-open', 'status', { primary: true }); break;
    case 'moved': say = '이 PC의 백업은 다른 PC로 옮겨 갔습니다.'; then = '이 PC에서는 더 백업하지 않습니다. 옛 백업에서 파일을 꺼낼 수는 있습니다.'; note = '옮겨 감'; first = act('파일 되살리기', 'backup-open', 'restore', { primary: true }); break;
    default: say = '백업 엔진이 알려 온 상태를 솔리오가 알아듣지 못했습니다.'; then = '엔진 창에서 확인해 주세요. 솔리오를 업데이트하면 여기서도 보입니다.'; note = '확인 필요'; first = act('엔진 창 열기', 'backup-open', 'status', { primary: true });
  }
  const acts = first ? [first, ...ENGINE_ACTS.filter(a => !(a.act === first.act && a.arg === first.arg))] : ENGINE_ACTS.map((a, i) => (i === 0 ? { ...a, primary: true } : a));
  return { ...base, say, then: then.trim(), note, rows: engineRows, acts, busy: !!s.job, when: s.writtenAt ? `엔진이 ${backupWhen(s.writtenAt, now)}에 적은 상태` : '' };
}
