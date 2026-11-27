// 솔리오 「백업」 방의 글(2026-11-20). DOM이 없다. 본체(src/solio-backup.cjs)의 스냅숏 하나를 방의 결론 · 할 일 · 줄 · 단추로 옮긴다.
// 계약: experiences/solo-backup-rust/STAGE1_DESIGN.md 4.13. 솔리오 비서 네 가지(ROADMAP 「솔리오는 그 사람만의 비서처럼 말한다」)를 따른다.
// 맨 위 한 문장은 지금 가장 급한 한 가지이고, 「지키고 있습니다」는 상태 파일이 safe이고 예정 시각이 지나지 않았을 때만 쓴다.
// 스냅숏에는 경로 · 파일 이름 · 계정 주소가 없다. 이 파일도 그런 값을 만들지 않는다.

// 11-23 유호님 「응, 옮겨」: 오브제 이름이 「원클릭」이 됐다(docs/디자인/솔리오_원클릭_20261123/PC앱_옮기기.md). 보호 중이면 원클릭 판(board)을 더 낸다
export const SOLIO_BACKUP_NAME = '원클릭';

// 11-26 한 몸(experiences/solo-backup-rust/SOLIO_ONE_CLIENT.md, 유호님 시안 「가」): 화면 글에서 「엔진」 · 「엔진 창」을 뺐다.
// 손님 말은 설치 · 업데이트 · 지우기 때만 「백업 부품」이고, 나머지는 솔리오 화면 이름(파일 되살리기 · 새 PC로 옮겨 오기 · 설정)이다.
// 호스트가 있는 백업 부품(0.8.0 이상)은 그 화면들을 이 방 안에 연다(room). 옛 판은 지금처럼 따로 창을 연다
// 주의 낱말의 이름은 방 안 화면의 길 이름(DOOR_NAMES)과 같게 쓴다. 문장 · 단추 · 길이 같은 것을 다르게 부르지 않게 한다(Fable workbackup-solio-one-ui-20261127 F4 · -r2 FA2).
// restore 낱말은 서버가 부탁한 되살리기(엔진 solio.cjs serverRestore)이고 「파일 되살리기」 화면에서 한다
const TOPIC_NAMES = Object.freeze({ status: '백업 상태', folders: '지키는 폴더', changes: '많이 바뀐 파일', devices: '내 기기', restore: '파일 되살리기', space: '공간', signin: 'Google 계정', update: '백업 부품 업데이트' });
const PROOF_WORDS = Object.freeze({ passed: '통과', failed: '실패', incomplete: '덜 끝남', skipped: '건너뜀' });
const STAGE_WORDS = Object.freeze({ backup: '백업하는', check: '백업을 점검하는', proof: '되살리기를 증명하는', restore: '파일을 되살리는', move: '옮겨 오는', setup: '처음 설정하는', free: '공간을 비우는', other: '일하는' });
const UNINSTALL = 'Windows 설정의 「설치된 앱」에서 「SYNK 업무 백업」을 지웁니다. 솔리오를 지워도 백업 부품은 남아 백업을 이어 갑니다.';
/* 방 안 화면의 이름(띠 아래 「← 원클릭 › 이름」) */
const DOOR_NAMES = Object.freeze({ restore: '파일 되살리기', move: '새 PC로 옮겨 오기', settings: '설정', start: '보호 시작', status: '백업 상태', folders: '지키는 폴더', changes: '많이 바뀐 파일', devices: '내 기기', space: '공간', signin: 'Google 계정', update: '백업 부품 업데이트' });
/* 주의 낱말마다 그 화면을 여는 단추 이름 */
const LOOK_LABEL = Object.freeze({ status: '백업 상태 보기', folders: '지키는 폴더 보기', changes: '바뀐 파일 보기', devices: '내 기기 보기', restore: '파일 되살리기', space: '공간 화면 열기', signin: 'Google 계정 확인', update: '백업 부품 업데이트', move: '새 PC로 옮겨 오기' });
/* 하던 일(상태 파일 job.stage)을 「하던 ~를 마무리하는 중」으로 */
const JOB_NOUN = Object.freeze({ backup: '백업을', check: '점검을', proof: '되살리기 확인을', restore: '되살리기를', move: '옮겨 오기를', setup: '처음 설정을', free: '공간 비우기를', other: '일을' });

/* 단추 이름 뒤의 「을/를」: 끝 글자에 받침이 있으면 「을」(「Google 계정 확인」을, 「백업 상태 보기」를) */
const objectJosa = word => { const code = String(word).charCodeAt(String(word).length - 1); return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '을' : '를'; };
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
const knownTopics = words => (Array.isArray(words) ? words : []).filter(w => Object.hasOwn(TOPIC_NAMES, w));
const topicList = words => knownTopics(words).map(w => TOPIC_NAMES[w]).join(', ');

const act = (label, action, arg = '', extra = {}) => ({ label, act: action, arg, ...extra });
/* 원클릭 판 옆의 조용한 단추 셋(시안 가). 누르면 같은 방 안에서 그 화면을 연다 */
const ROOM_ACTS = Object.freeze([act('파일 되살리기', 'backup-open', 'restore'), act('새 PC로 옮겨 오기', 'backup-open', 'move'), act('설정', 'backup-open', 'settings')]);
const look = (topic, extra = {}) => act(LOOK_LABEL[topic] || LOOK_LABEL.status, 'backup-open', LOOK_LABEL[topic] ? topic : 'status', extra);

/* 설치 중 · 끝 · 실패의 글. 시작 단추가 연 일이 남아 있는 동안은 이것이 방의 맨 위다.
   설치기는 창 없이(/S) 돈다. 호스트가 있는 판(host)은 끝나면 이 방이 Google 계정으로 이어 가고, 옛 판은 「백업 창 열기」로 잇는다 */
const INSTALL_SAY = Object.freeze({
  feed: ['백업 부품 설치 파일을 찾고 있습니다.', ''],
  download: ['백업 부품을 받고 있습니다.', '우리가 올린 파일이 맞는지 크기와 서명까지 본 뒤에만 엽니다.'],
  verify: ['받은 파일을 확인하고 있습니다.', '우리가 올린 파일이 맞는지 크기와 서명까지 본 뒤에만 엽니다.'],
  admin: ['Windows가 한 번 묻습니다.', 'Windows가 「SYNK 업무 백업」을 바꿔도 되는지 물으면 「예」를 눌러 주세요.'],
  install: ['백업 부품을 깔고 있습니다.', '설치 창은 따로 뜨지 않습니다. 끝나면 이 방이 Google 계정으로 이어 갑니다.'],
  opening: ['백업 창을 여는 중입니다.', ''],
  opened: ['백업 창에서 이어서 해 주세요.', '백업 창이 Google 로그인으로 바로 이어집니다. 백업 창이 보이지 않으면 아래 「백업 창 열기」를 눌러 주세요.'],
  done: ['백업 부품을 깔았습니다.', '「이어서 하기」를 누르면 Google 계정으로 이어 갑니다.'],
});
/* 옛 판(호스트 없음)의 설치: 끝나도 창이 뜨지 않으므로 「백업 창 열기」로 잇는다 */
const INSTALL_OLD = Object.freeze({
  install: '설치 창은 따로 뜨지 않습니다. 끝나면 「백업 창 열기」로 Google 계정에 이어 갑니다.',
  done: '「백업 창 열기」를 누르면 Google 로그인으로 이어집니다.',
});
const ERROR_SAY = Object.freeze({
  FEED_MISSING: ['백업 부품 설치 파일이 아직 올라오지 않아 받을 수 없습니다.', '첫 배포 판이 올라오면 이 자리에서 바로 받을 수 있습니다.'],
  FEED_INVALID: ['설치 파일 목록이 올바르지 않아 받지 않았습니다.', '잠시 뒤 다시 해 주세요. 계속되면 SYNK에 알려 주세요.'],
  NETWORK: ['설치 파일을 받지 못했습니다.', '인터넷 연결을 확인한 뒤 「다시 받기」를 눌러 주세요.'],
  UNTRUSTED_REDIRECT: ['설치 파일 주소가 우리가 쓰는 곳이 아니어서 받지 않았습니다.', '잠시 뒤 「다시 받기」를 눌러 주세요.'],
  VERIFY_FAILED: ['받은 파일이 우리가 올린 설치 파일과 달라 열지 않았습니다.', '「다시 받기」를 눌러 새로 받아 주세요.'],
  READ_FAILED: ['받은 설치 파일을 읽지 못해 열지 않았습니다.', '백신이 그 파일을 검사하는 중일 수 있습니다. 잠시 뒤 「다시 받기」를 눌러 주세요.'],
  VERIFY_ERROR: ['받은 파일을 확인하는 기능에 오류가 나서 열지 않았습니다.', '파일이 틀렸다는 뜻은 아닙니다. 「다시 받기」를 눌러 보고, 계속되면 SYNK에 알려 주세요.'],
  UNEXPECTED: ['PC 앱에서 예상하지 못한 오류가 나서 설치를 멈췄습니다.', '인터넷 문제는 아닙니다. 「다시 받기」를 눌러 보고, 계속되면 SYNK에 알려 주세요.'],
  LOCK_FAILED: ['받은 파일을 확인하는 동안 잠그지 못해 열지 않았습니다.', '다른 프로그램이 그 파일을 쓰고 있을 수 있습니다. 「다시 받기」를 눌러 주세요.'],
  DECLINED: ['Windows 확인을 받지 못해 깔지 않았습니다.', '다시 누르면 처음부터 합니다. 관리자 계정으로 「예」를 눌러야 깔립니다.'],
  INSTALL_STOPPED: ['설치가 끝나지 않았습니다.', '다른 프로그램이 설치를 막았을 수 있습니다. 「다시 받기」를 눌러 주세요.'],
  STORAGE: ['이 PC에 설치 파일을 저장하지 못했습니다.', '디스크 공간을 확인한 뒤 「다시 받기」를 눌러 주세요.'],
  REQUEST_FAILED: ['보호 시작을 알리지 못했습니다.', '이 Windows 계정의 앱 데이터 폴더에 쓰지 못했습니다. 「다시 하기」를 눌러 주세요.'],
  INSTALL_REQUEST_FAILED: ['보호 시작을 알리지 못해 설치를 멈췄습니다.', '이 Windows 계정의 앱 데이터 폴더에 쓰지 못했습니다. 「다시 받기」를 누르면 설치 파일을 새로 받아 다시 합니다.'],
  OPEN_FAILED: ['백업 화면을 열지 못했습니다.', '다시 하려면 「다시 하기」를 눌러 주세요.'],
  NOT_NEEDED: ['그사이 백업 부품이 깔려 이 방을 다시 읽었습니다.', '지금 상태는 이 방에 그대로 보입니다.'],
  ACCOUNT_CHANGED: ['로그인한 SYNK 계정이 바뀌어 멈췄습니다.', '지금 계정으로 시작하려면 「다시 받기」를 눌러 주세요.'],
  INSTALL_UNCONFIRMED: ['설치가 끝났는지 확인하지 못했습니다.', '잠시 뒤 이 방을 다시 열어 주세요. 그래도 그대로면 「다시 받기」를 눌러 주세요.'],
  ENGINE_UNKNOWN: ['백업 부품이 깔려 있는지 확인하지 못해 설치를 멈췄습니다.', '잠시 뒤 「다시 받기」를 눌러 주세요. 확인하지 못한 채로는 설치기를 띄우지 않습니다.'],
});
/* 단추를 눌렀는데 본체가 거절하거나 열지 못했을 때 방에 잠깐 보이는 한 줄(Fable 최종 검수 F3) */
const NOTICE = Object.freeze({
  OPEN_FAILED: '화면을 열지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
  NO_ENGINE: '이 PC에 백업 부품이 없어 열 수 없습니다.',
  BUSY: '앞서 누른 일이 아직 진행 중입니다.',
  NOT_NEEDED: '지금 상태에서는 할 일이 없어 다시 읽었습니다.',
  ENGINE_UNKNOWN: '백업 부품이 깔려 있는지 확인하지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
  SIGN_IN_REQUIRED: 'SYNK ID로 로그인한 뒤 쓸 수 있습니다.',
  // 원클릭(11-23)
  REQUEST_FAILED: '지금 백업을 부탁하지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
  NOT_AVAILABLE: '이 계정에서는 원클릭을 쓸 수 없습니다.',
});
export function backupActionNotice(result) {
  if (!result || result.ok !== false) return '';
  return NOTICE[result.code] || '요청을 처리하지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
}
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
  const [say0, then0] = INSTALL_SAY[phase] || INSTALL_SAY.feed;
  const say = phase === 'download' && Number.isFinite(install.progress) ? `백업 부품을 받고 있습니다(${install.progress}%).` : say0;
  // 옮겨 오기로 시작했으면 옮겨 오기 화면(move)으로 열고, 끝난 뒤의 할 일도 옮겨 오기로 말한다(카본 A2)
  const move = install.mode === 'move', host = install.host === true;
  const then = !host && INSTALL_OLD[phase] ? INSTALL_OLD[phase] : then0;
  const acts = phase === 'opened' ? [act('백업 창 열기', 'backup-open', move ? 'move' : 'status', { primary: true }), act('닫기', 'backup-dismiss')]
    : phase === 'done' ? (host ? [act('이어서 하기', 'backup-open', move ? 'move' : 'start', { primary: true }), act('닫기', 'backup-dismiss')]
      : [act('백업 창 열기', 'backup-open', move ? 'move' : 'status', { primary: true }), act('닫기', 'backup-dismiss')]) : [];
  const doneThen = move ? (host ? '「이어서 하기」에서 Google 계정을 고르면 옛 PC의 백업을 고르고 옮겨 오기를 시작합니다.' : '「백업 창 열기」에서 Google 로그인을 마치면 옛 PC의 백업을 고르고 옮겨 오기를 시작합니다.') : then;
  return { say, then: phase === 'done' ? doneThen : then, acts, busy: !['opened', 'done'].includes(phase) };
}

function statusRows(snap, now) {
  const s = snap.status || {}, rows = [];
  if (s.lastBackupAt) rows.push({ key: 'last', nm: '마지막 확인', val: backupWhen(s.lastBackupAt, now), more: [['note', '백업을 마지막으로 확인한 때입니다.']] });
  if (s.proof) rows.push({ key: 'proof', nm: '되살리기 증명', mid: PROOF_WORDS[s.proof.result] || '', val: backupDay(s.proof.at), more: [['note', '백업에서 파일을 실제로 되살려 보고 원본과 같은지 견준 결과입니다.']] });
  if (Number.isSafeInteger(s.folders)) rows.push({ key: 'folders', nm: '지키는 폴더', mid: `${s.folders}개`, val: backupBytes(s.bytes), more: [['note', '폴더 이름은 「설정」의 「지키는 폴더」에서 봅니다. 원클릭 판은 폴더 이름을 읽지 않습니다.']] });
  // 「매시간 저절로」는 자동 백업이 도는 상태에서만 쓴다. 꺼짐 · 멈춤 · 보호 전 · 읽지 못함에서는 쓰지 않는다(카본 A3)
  const running = snap.view === 'status' && ['safe', 'starting', 'attention'].includes(s.state) && s.writer !== false;
  if (snap.status) {
    const nextNote = s.writer === false ? '이 PC는 백업을 쓰는 기기가 아닙니다.' : running ? '로그인해 있는 동안 매시간 저절로 백업합니다.'
      : s.state === 'off' ? '자동 백업을 꺼 두어 다음 백업이 없습니다.' : s.state === 'paused' ? '멈춘 동안에는 백업하지 않습니다.' : '';
    rows.push({ key: 'next', nm: '다음 백업', val: s.writer === false || s.state === 'off' ? '없음' : backupWhen(s.nextRunAt, now) || '정해지지 않음', more: nextNote ? [['note', nextNote]] : [] });
  }
  rows.push({ key: 'engine', nm: '백업 부품', val: snap.engine?.version || s.engine || '', more: [['say', '백업 부품 지우기'], ['note', UNINSTALL]] });
  return rows;
}
const SETUP_ROWS = Object.freeze([
  Object.freeze({ key: 'how', nm: '까는 방법', val: 'Windows 확인 한 번', more: Object.freeze([['note', '솔리오가 백업 부품을 직접 받아, 크기와 SHA-256과 서명이 맞을 때만 엽니다. 설치 창은 따로 뜨지 않습니다.']]) }),
  Object.freeze({ key: 'google', nm: '로그인', val: 'Google 계정', more: Object.freeze([['note', '복구 정보는 손님의 Google 계정에 보관합니다. 우리 서버가 멈춰도 되살릴 수 있게 하려는 것입니다.'], ['note', 'SYNK ID를 Google로 로그인했다면 그 주소로 바로 이어집니다.']]) }),
  Object.freeze({ key: 'remove', nm: '지우기', val: '설치된 앱에서', more: Object.freeze([['note', UNINSTALL]]) }),
]);

/* 방 하나. visible:false면 이 계정에게는 방도 오브제도 없다(유호님 계정이 아니거나 PC 앱 밖).
   방 안에 엔진 화면을 열었으면(snap.room.open) 그 화면의 길과 호스트 상태가 방의 전부다(doorScene) */
export function solioBackupView(snap, now = Date.now()) {
  if (!snap || snap.ok !== true || snap.available !== true) return { visible: false };
  const base = { visible: true, when: '', scope: '', rows: [], acts: [], note: '' };
  const view = snap.view;
  if (view === 'windows-only') return { ...base, say: '백업은 Windows PC에서만 쓸 수 있습니다.', then: 'Mac에는 백업 부품을 깔 수 없습니다. Windows PC의 솔리오에서 시작해 주세요.', note: 'Windows 전용' };
  if (snap.room?.open === true) return doorScene(snap, base);
  return withFoot(roomScene(snap, base, now), snap);
}
function roomScene(snap, base, now) {
  const view = snap.view;
  const engineRows = statusRows(snap, now);
  const startView = view === 'no-engine' || view === 'engine-removed' || view === 'needs-setup';
  // 끝난 설치 결과(열었음 · 깔았음 · 실패)는 처음 시작 갈래에서만 맨 위에 둔다. 보호 범위 확인을 마쳐 상태가 생기면
  // 그 상태가 맨 위다(Fable 최종 검수 F1). 도는 중인 단계(받기 · 확인 · Windows 확인 · 설치)는 언제나 보인다
  const finished = ['opened', 'done', 'error'].includes(snap.install?.phase);
  const installing = finished && !startView ? null : installScene(snap.install);
  if (installing) return { ...base, say: installing.say, then: installing.then, acts: installing.acts, rows: startView ? [...SETUP_ROWS] : engineRows, busy: !!installing.busy, note: installing.busy ? '설치 중' : '' };

  if (view === 'no-engine' || view === 'engine-removed') {
    const removed = view === 'engine-removed';
    const feed = snap.feed?.state;
    const say = removed ? '백업 부품이 지워져서 지금은 이 PC를 백업하지 않습니다.' : '이 PC의 업무 파일은 아직 백업하지 않고 있습니다.';
    if (feed === 'missing') {
      return { ...base, say, then: '백업 부품 설치 파일이 아직 올라오지 않아 지금은 받을 수 없습니다.', rows: [...SETUP_ROWS], note: '아직 받을 수 없음',
        acts: [act('아직 받을 수 없음', 'backup-start', 'protect', { primary: true, disabled: true })] };
    }
    const then = removed ? '「다시 깔기」를 누르면 백업 부품을 받아 깔고 이어서 지킵니다. 클라우드의 백업은 지우지 않았습니다.'
      : feed === 'error' ? '설치 파일 목록을 아직 읽지 못했습니다. 「보호 시작」을 누르면 한 번 더 읽어 봅니다.'
        : '「보호 시작」을 누르면 솔리오가 백업 부품을 깔고, Windows 확인 한 번 뒤 Google 계정으로 이어 갑니다. 새 PC라면 「이 PC로 옮겨 오기」를 누릅니다.';
    return { ...base, say, then, rows: [...SETUP_ROWS], note: removed ? '백업 부품 없음' : '시작 전',
      acts: [act(removed ? '다시 깔기' : '보호 시작', 'backup-start', 'protect', { primary: true }), act('이 PC로 옮겨 오기', 'backup-start', 'move')] };
  }
  if (view === 'needs-setup') {
    const restoreOnly = snap.status?.state === 'restore-only';
    return { ...base, rows: engineRows, note: '시작 전',
      say: restoreOnly ? '이 PC는 옮겨 온 파일을 되살리기만 하고, 백업은 하지 않습니다.' : '이 Windows 계정은 아직 보호를 시작하지 않았습니다.',
      then: restoreOnly ? '이 PC도 지키려면 「보호 시작」을 누릅니다. Google 계정으로 바로 이어 갑니다.' : '「보호 시작」을 누르면 Google 계정으로 바로 이어 갑니다. 새 PC라면 「이 PC로 옮겨 오기」를 누릅니다.',
      acts: restoreOnly ? [act('보호 시작', 'backup-start', 'protect', { primary: true }), act('파일 되살리기', 'backup-open', 'restore')]
        : [act('보호 시작', 'backup-start', 'protect', { primary: true }), act('이 PC로 옮겨 오기', 'backup-start', 'move')] };
  }
  if (view === 'engine-newer') {
    return { ...base, rows: engineRows, note: '업데이트 필요', say: '백업 부품이 솔리오보다 새 판이라 상태를 읽지 못했습니다.', then: '솔리오(SYNK PC 앱)를 업데이트해 주세요. 그동안 백업 상태는 「백업 상태 보기」에서 봅니다.',
      acts: [look('status', { primary: true }), ...ROOM_ACTS] };
  }
  if (view === 'engine-unknown') {
    return { ...base, rows: [...SETUP_ROWS], note: '확인 중', say: '백업 부품이 이 PC에 깔려 있는지 확인하지 못했습니다.',
      then: '잠시 뒤 이 방을 다시 열면 한 번 더 확인합니다. 그동안 백업 부품을 새로 받지 않습니다.', acts: [] };
  }
  if (view === 'status-unreadable') {
    return { ...base, rows: engineRows, note: '확인 필요', say: '백업이 남긴 상태를 읽지 못했습니다.',
      then: '「백업 상태 보기」를 누르면 지금 상태를 볼 수 있습니다. 다음에 상태를 새로 쓰면 여기서도 보입니다.',
      acts: [look('status', { primary: true }), ...ROOM_ACTS] };
  }
  const s = snap.status || {};
  if (view === 'checking') {
    return withBoard({ ...base, rows: engineRows, note: '확인 중', say: '백업 상태를 확인하는 중입니다.',
      then: `예정된 백업(${backupWhen(s.nextRunAt, now)})에서 2시간 넘게 새 소식이 없습니다. 「백업 상태 보기」를 눌러 확인해 주세요.`,
      acts: [look('status', { primary: true }), ...ROOM_ACTS] }, snap, now);
  }
  const job = s.job ? `지금 ${STAGE_WORDS[s.job.stage] || STAGE_WORDS.other} 중입니다${Number.isFinite(s.job.percent) ? `(${s.job.percent}%)` : ''}. ` : '';
  const last = s.lastBackupAt ? `마지막 확인은 ${backupWhen(s.lastBackupAt, now)}입니다.` : '';
  const proofFailed = s.proof && s.proof.result !== 'passed' && s.proof.result !== 'skipped';
  let say, then, note, first = null;
  switch (s.state) {
    case 'safe': {
      // 지키는 중이어도 주의 낱말이 함께 올 수 있다(되살리기 · 업데이트 · 공간 따위). 있으면 그 일이 할 일의 맨 앞이다
      const topics = topicList(s.attention || []);
      say = Number.isSafeInteger(s.folders) && s.folders > 0 ? `업무 폴더 ${s.folders}개를 지키고 있습니다.` : '이 PC의 업무 파일을 지키고 있습니다.';
      then = job + (topics ? `다만 확인할 일이 있습니다: ${topics}. ` : proofFailed ? `마지막 되살리기 증명 결과는 「${PROOF_WORDS[s.proof.result] || '알 수 없음'}」입니다. 「백업 상태 보기」를 눌러 「되살려 본 날」 줄을 봐 주세요. ` : '') + last;
      note = topics || proofFailed ? '확인 필요' : '지키는 중';
      if (topics) first = look(knownTopics(s.attention)[0], { primary: true });
      // 증명 결과는 백업 상태 화면의 「되살려 본 날」 줄에 있다(파일 되살리기 화면이 아니다, -r2 FA2)
      else if (proofFailed) first = look('status', { primary: true });
      break;
    }
    case 'starting': say = '첫 백업을 준비하고 있습니다.'; then = job + '첫 백업이 끝나면 로그인해 있는 동안 매시간 저절로 지킵니다.'; note = '첫 백업 전'; break;
    case 'attention': {
      const topics = topicList(s.attention || []), topic = knownTopics(s.attention)[0] || 'status';
      say = topics ? `확인할 일이 있습니다: ${topics}.` : '확인할 일이 있습니다.';
      then = job + `「${LOOK_LABEL[topic]}」${objectJosa(LOOK_LABEL[topic])} 눌러 확인해 주세요. ` + last;
      note = '확인 필요';
      first = look(topic, { primary: true });
      break;
    }
    // 「백업 상태 보기」는 백업 상태 화면을 연다. 다시 켜는 것은 그 화면의 단추다(Fable workbackup-solio-one-ui-20261127 F5, 엔진 screen-model.js home-paused · home-off)
    case 'paused': say = '백업을 잠시 멈춰 두었습니다.'; then = '멈춘 동안 바뀐 파일은 백업되지 않습니다. 「백업 상태 보기」에서 「지금 다시 시작」을 누르면 이어서 지킵니다. ' + last; note = '멈춤'; first = look('status', { primary: true }); break;
    case 'off': say = '자동 백업을 꺼 두었습니다.'; then = '이대로면 새로 바뀐 파일이 백업되지 않습니다. 「백업 상태 보기」에서 「자동 백업 켜기」를 눌러 주세요. ' + last; note = '꺼짐'; first = look('status', { primary: true }); break;
    case 'moved': say = '이 PC의 백업은 다른 PC로 옮겨 갔습니다.'; then = '이 PC에서는 더 백업하지 않습니다. 옛 백업에서 파일을 꺼낼 수는 있습니다.'; note = '옮겨 감'; first = act('파일 되살리기', 'backup-open', 'restore', { primary: true }); break;
    default: say = '백업이 알려 온 상태를 솔리오가 알아듣지 못했습니다.'; then = '「백업 상태 보기」에서 확인해 주세요. 솔리오를 업데이트하면 여기서도 보입니다.'; note = '확인 필요'; first = look('status', { primary: true });
  }
  const acts = first ? [first, ...ROOM_ACTS.filter(a => !(a.act === first.act && a.arg === first.arg))] : ROOM_ACTS.map((a, i) => (i === 0 ? { ...a, primary: true } : a));
  const when = s.writtenAt ? `${backupWhen(s.writtenAt, now)}에 적은 상태` : '';
  return withBoard({ ...base, say, then: then.trim(), note, rows: engineRows, acts, busy: !!s.job, when }, snap, now);
}

/* 방 안의 엔진 화면(SOLIO_ONE_CLIENT.md 2.2 · 2.4 · 4장). 화면이 준비되면 길(← 원클릭 › 이름)만 남고 그 아래를 엔진 화면이 채운다.
   준비 전이면 호스트 상태를 한 문장으로 말한다: 여는 중 · 하던 일 마무리(busy) · 멈춤 → 다시 열기 · 솔리오가 옛 판 · 그 밖 → 「백업 창 따로 열기」 */
function doorScene(snap, base) {
  const r = snap.room, topic = r.topic || 'status';
  const name = DOOR_NAMES[topic] || DOOR_NAMES.status;
  const reopen = (extra = {}) => act('다시 열기', 'backup-open', topic, extra);
  const alone = (extra = {}) => act('백업 창 따로 열기', 'backup-window', '', extra);
  const job = snap.status?.job || null;
  const door = { name, ready: r.ready === true };
  const scene = (say, then, acts = [], busy = false) => ({ ...base, door, say, then, acts, busy, note: '' });
  if (r.ready === true) return scene('', '');
  if (r.host === 'busy') {
    const pct = Number.isFinite(job?.percent) ? `(${job.percent}%)` : '';
    return scene(job ? `하던 ${JOB_NOUN[job.stage] || JOB_NOUN.other} 마무리하는 중입니다${pct}.` : '앞서 하던 일을 마무리하는 중입니다.', '끝나면 이 화면을 저절로 엽니다. 매시간 백업은 그대로 돕니다.', [], true);
  }
  if (r.host === 'failed') return scene('백업 화면이 멈췄습니다.', '매시간 백업은 따로 돌아 멈추지 않았습니다. 「다시 열기」를 눌러 주세요.', [reopen({ primary: true })]);
  if (r.host === 'newer') return scene('솔리오를 업데이트해 주세요.', '백업 부품이 솔리오보다 새 판이라 이 방에서는 열 수 없습니다. 그동안은 「백업 창 따로 열기」로 씁니다.', [alone({ primary: true })]);
  if (r.host === 'refused') return scene('이 방에서는 백업 화면을 열 수 없습니다.', '「백업 창 따로 열기」로 이어서 해 주세요.', [alone({ primary: true })]);
  if (r.host === 'ready' && r.ui === 'installing') return scene('백업 부품을 새 판으로 바꾸는 중입니다.', '끝나면 「다시 열기」를 눌러 주세요.', [reopen({ primary: true })]);
  if (r.host === 'ready' && ['missing', 'invalid', 'version'].includes(r.ui)) return scene('이 방에서는 백업 화면을 열 수 없습니다.', '백업 부품의 화면 파일이 맞지 않습니다. 「백업 창 따로 열기」로 이어서 해 주세요.', [alone({ primary: true }), reopen()]);
  return scene('백업 화면을 여는 중입니다.', '', [], true);
}

/* 원클릭 판 맨 아래 한 줄(3.2 · 4장 1): 업데이트 카드와 옛 판 안내. 누르면 호스트에 bye를 보내고 백업 부품의 업데이터를 띄운다 */
const UPDATE_SAY = Object.freeze({
  running: '백업 부품을 새 판으로 올리고 있습니다. Windows가 물으면 「예」를 눌러 주세요.',
  installing: '백업 부품을 새 판으로 올리는 중입니다. 매시간 백업은 끝나는 대로 그대로 이어집니다.',
  RUN_ACTIVE: '백업이 끝난 뒤 다시 눌러 주세요.',
  UPDATE_START: '관리자 확인을 받지 못했습니다. 관리자 계정이 아니면 관리자에게 부탁해 주세요.',
  error: '백업 부품을 올리지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
});
export function backupUpdateLine(snap) {
  const u = snap?.update, installed = snap?.engine?.installed === true;
  if (!u || !installed) return null;
  const go = act('업데이트', 'backup-update', '');
  const fresh = typeof u.available === 'string' ? u.available : null;
  if (u.phase === 'running' || u.phase === 'installing') return { say: UPDATE_SAY[u.phase], act: null, busy: true };
  if (u.phase === 'error') return { say: UPDATE_SAY[u.code] || UPDATE_SAY.error, act: go };
  // 「0.8.1로」 · 「0.8.0으로」: 끝 숫자를 읽은 소리에 ㄹ 아닌 받침이 있으면(영 · 삼 · 육) 「으로」
  if (u.phase === 'done' && !fresh) return { say: `백업 부품을 ${u.current}${'036'.includes(String(u.current).slice(-1)) ? '으로' : '로'} 올렸습니다. 다시 하실 일은 없습니다.`, act: null, done: true };
  // 호스트가 없는 옛 판은 새 판으로 올리면 이 방에서 모두 할 수 있다고 말한다(4장 1)
  if (snap.engine.host !== true) return { say: '백업 부품을 새 판으로 올리면 이 방에서 모두 할 수 있습니다.', act: fresh ? go : null };
  return fresh ? { say: `백업 부품 새 판 ${fresh} — Windows 확인 한 번`, act: go } : null;
}
function withFoot(scene, snap) {
  const foot = backupUpdateLine(snap);
  return foot ? { ...scene, foot } : scene;
}
/* 보호 중이면 원클릭 판을 붙인다. 큰 단추가 결정 단추이므로 아래 단추 줄은 모두 조용히 두고, 줄(rows)은 판이 대신한다.
   판이 맨 위 문장을 정하면(도는 중 · 답 · 기다림) 그것이 먼저다 */
function withBoard(scene, snap, now) {
  if (!oneClickReady(snap)) return scene;
  const board = oneClickBoard(snap, now), lead = board.lead;
  const quiet = scene.acts.map(a => ({ ...a, primary: false }));
  // 이끄는 단추와 같은 동작 · 낱말이거나 이름이 같은 단추는 뺀다. 주제가 달라도 「엔진 창 열기」가 둘 서지 않는다(카본 A2)
  // 이끄는 단추가 엔진 창을 열면 아래 줄의 「엔진 창 열기」(status)만 뺀다. 「파일 되살리기」 · 「새 PC로 옮겨 오기」는 그대로 둔다(Fable 최종 P1-1)
  const sameDoor = a => a.act === 'backup-open' && lead.act.act === 'backup-open' && a.arg === 'status';
  const acts = lead?.act ? [lead.act, ...quiet.filter(a => !(a.act === lead.act.act && (a.arg === lead.act.arg || a.label === lead.act.label)) && !sameDoor(a))] : quiet;
  // 줄(다음 백업 · 매시간)이 빠지므로 자동 백업이 도는 것은 아래 범위 칸에 한 줄로 남긴다
  // 「매시간 저절로」는 정상(status · safe)일 때만 쓴다. 소식 없음 · 확인할 일 · 첫 백업 준비 중에는 위 문장과 어긋난다(Fable F4)
  const next = nextWords(snap.status?.nextRunAt, now);
  const scope = snap.view === 'status' && snap.status?.state === 'safe' ? `로그인해 있는 동안 매시간 저절로 백업합니다.${next ? ` 다음은 ${next}입니다.` : ''}` : '';
  return { ...scene, say: lead?.say || scene.say, then: lead ? lead.then || '' : scene.then, note: lead?.note || scene.note, rows: [], acts, busy: board.busy, scope, board };
}

/* ── 원클릭 판(11-23). 설계: docs/디자인/솔리오_원클릭_20261123/PC앱_옮기기.md(Fable 설계 검토 반영) ──
   엔진 0.7.0이 하는 일만 「한다」고 쓴다. 01 백업은 run-now 요청으로 실제로 하고, 02 되살리기 확인과 03 공간은 엔진이 정해진 때 스스로 한 결과를
   읽어 보인다. 04 업데이트는 PC 앱 업데이터와 엔진 피드를 다시 본다. 지우기는 엔진의 공간 비우기 2판부터다 */
export const ONECLICK_LABEL = '백업하고 상태 보기';
/* 공간 비우기 2판을 엔진 창에서 켠 PC(상태 파일 spaceFree on)의 단추(SPACE_DESIGN.md 12.5) */
export const ONECLICK_FREE_LABEL = '백업하고 비우기';
/* 보호 중(본체 oneClickReady와 같은 조건). 멈춤 · 꺼짐 · 옮겨 감에는 판이 없다. 꺼짐은 엔진이 받아도 손님이 꺼 둔 뜻을 요청으로 넘지 않는다 */
export function oneClickReady(snap) {
  const s = snap?.status;
  return (snap?.view === 'status' || snap?.view === 'checking') && !!s && ['safe', 'starting', 'attention'].includes(s.state) && s.writer === true;
}
/* 깨운 뒤 이만큼 엔진이 요청을 가져가지 않으면 「다른 일 중」으로 바꾸고 천천히 다시 읽는다(Fable 설계 검토 1) */
export const ONECLICK_PATIENCE = 60000;
const GB = 1024 ** 3;
/* 1GB보다 작은 크기는 MB로 쓴다. 20MB가 「0.0GB」로 보이지 않게 한다(카본 A6) */
const gb = n => (n >= GB ? `${(n / GB).toFixed(1)}GB` : backupBytes(n));
/* 판 번호 뒤 조사. 끝 숫자를 읽은 소리에 받침이 있으면(영 · 일 · 삼 · 육 · 칠 · 팔) 이/을, 없으면 가/를(카본 A8) */
const josa = (v, [withBatchim, without]) => `${v}${'013678'.includes(String(v).slice(-1)) ? withBatchim : without}`;
/* 예정 시각이 아직 오지 않았을 때만 「다음」이라고 쓴다(카본 A5) */
function nextWords(value, now) {
  const at = Date.parse(value || '');
  return Number.isFinite(at) && at > now ? backupWhen(value, now) : '';
}
const GROUP_NAMES = Object.freeze({
  temp: 'Windows 임시 파일', 'temp-profile': '브라우저 자동화 임시 프로필', build: 'Node 패키지 · 빌드 폴더', cache: '다시 받을 수 있는 패키지',
  worktree: '작업 사본', 'ai-app-copy': 'AI 앱 작업 사본', 'project-temp': '프로젝트 임시 폴더', 'ai-history': 'AI 대화 기록', models: 'AI 모델',
  'cloud-drive': '클라우드 드라이브', 'vm-disk': '가상 디스크', 'big-old-file': '오래 열지 않은 큰 파일', trash: '휴지통', other: '그 밖의 것',
});
/* 솔리오가 지우지 않는 것 가운데 정리하는 곳을 알려 줄 수 있는 것 */
const GROUP_HOW = Object.freeze({
  'ai-app-copy': '그 AI 앱에서 끝난 작업을 정리하면 줄어듭니다.',
  'ai-history': '그 AI 앱의 설정에서 지웁니다.',
  'cloud-drive': '클라우드 드라이브 앱에서 「이 기기에서 공간 확보」로 줄입니다.',
  trash: '휴지통 비우기는 다음 판에서 따로 묻고 합니다.',
});
/* 2판이 비우는 묶음(SPACE_DESIGN.md 12.1). 가 등급이라도 캐시 · 프로젝트 임시 폴더는 비우지 않는다(카본 A2) */
const FREE2_GROUPS = Object.freeze(['temp', 'temp-profile', 'build']);
/* 「다시 만들 수 있는 것」 묶음의 설명. 2판이 열린 PC는 켜고 끈 것에 따라 말한다 */
const AUTO_MID = Object.freeze({ unavailable: '다음 판부터 원클릭이 비웁니다', off: '공간 화면에서 켜면 원클릭이 임시 파일 · 빌드 폴더를 비웁니다', on: '임시 파일 · 빌드 폴더는 원클릭을 누를 때 비웁니다' });
/* 2판 비우기 요청이 비우지 않고 끝났을 때 03 줄의 말. 엔진 창에서 켜지 않은 PC의 요청은 세기만 하므로 「센다」로 말한다(카본 A1) */
const FREE_ANSWER = Object.freeze({
  'old-report': '공간 보고서가 하루 넘게 지나 이번에는 비우지 않았습니다. 공간을 다시 잰 뒤에 비웁니다',
  'no-report': '공간을 다시 잰 뒤에 비웁니다',
  expired: '요청이 늦게 닿아 이번에는 비우지 않았습니다',
  'not-available': '이번에는 비울 것이 없었습니다',
  'not-set-up': '이 PC에서는 비우지 않습니다', 'restore-only': '이 PC에서는 비우지 않습니다', moved: '이 PC에서는 비우지 않습니다',
});
const FREE_ANSWER_PREVIEW = Object.freeze({
  ...FREE_ANSWER,
  'old-report': '공간 보고서가 하루 넘게 지나 이번에는 세지 않았습니다. 공간을 다시 잰 뒤에 셉니다',
  'no-report': '공간을 다시 잰 뒤에 셉니다',
  expired: '요청이 늦게 닿아 이번에는 세지 않았습니다',
  'not-available': '이번에는 비울 만한 것이 없었습니다',
});
/* 백업 답이 온 뒤 비우기 답을 이만큼 기다리면 단추를 풀고 「기다리는 중」으로 둔다. 누름 상한 150초와 넘김 60초보다 길다(카본 A4) */
export const FREE_PATIENCE = 5 * 60000;
const GRADE_GROUPS = Object.freeze([
  Object.freeze({ k: 'auto', nm: '다시 만들 수 있는 것', mid: AUTO_MID.unavailable }),
  Object.freeze({ k: 'suggest', nm: '확인하면 비울 수 있는 것', mid: '고르는 기능은 다음 판에서 엽니다' }),
  Object.freeze({ k: 'view', nm: '솔리오가 지우지 않는 것', mid: '다른 앱의 자료이거나 하나뿐인 파일' }),
]);
const REST_TAIL = '다음 매시 백업 때 다시 봅니다. 「백업 상태 보기」에서 「지금 백업」을 누르면 쉬지 않고 합니다.';
/* 결과(result · reason) 쌍마다의 글. [맨 위 문장, 둘째 문장, 01 줄의 설명, 줄 모양]. 모르는 쌍은 받이 글이다(Fable 설계 검토 3) */
const ANSWER = Object.freeze({
  'rested|battery': ['배터리로 도는 중이라 백업을 쉬었습니다.', REST_TAIL, '배터리라 쉬었습니다', 'wait'],
  'rested|saver': ['절전 모드라 백업을 쉬었습니다.', REST_TAIL, '절전 모드라 쉬었습니다', 'wait'],
  'rested|metered': ['데이터 요금이 붙는 회선이라 백업을 쉬었습니다.', REST_TAIL, '종량제 회선이라 쉬었습니다', 'wait'],
  'rested|network': ['쉬도록 정해 둔 회선이라 백업을 쉬었습니다.', REST_TAIL, '쉬는 회선이라 쉬었습니다', 'wait'],
  'rejected|paused': ['백업을 잠시 멈춰 두어 하지 않았습니다.', '「백업 상태 보기」에서 다시 켜면 이어서 합니다.', '멈춰 두어 하지 않았습니다', 'fail'],
  'rejected|moved': ['이 PC의 백업은 다른 PC로 옮겨 가 하지 않았습니다.', '옛 백업에서 파일을 꺼낼 수는 있습니다.', '옮겨 간 PC라 하지 않았습니다', 'fail'],
  'rejected|restore-only': ['이 PC는 되살리기만 하는 기기라 백업하지 않았습니다.', '이 PC도 지키려면 보호를 시작합니다.', '되살리기만 하는 PC입니다', 'fail'],
  'rejected|not-set-up': ['이 PC는 아직 보호를 시작하지 않아 백업하지 않았습니다.', '보호를 시작해 주세요.', '보호를 시작하지 않았습니다', 'fail'],
  'rejected|expired': ['요청이 하루 넘게 처리되지 않아 거뒀습니다.', '다시 눌러 주세요.', '요청이 만료됐습니다', 'fail'],
  'rejected|cancelled': ['요청을 거둬 백업하지 않았습니다.', '다시 눌러 주세요.', '요청을 거뒀습니다', 'fail'],
  // 엔진은 로그인이 필요함 · 서버 되살리기 중 · 계정 보류 같은 다른 건너뜀도 이 쌍으로 답한다. 「바쁨」이라고 쓰지 않는다
  'rejected|busy': ['지금은 백업할 수 없는 상태입니다.', '「백업 상태 보기」에서 까닭을 확인해 주세요.', '지금은 할 수 없는 상태입니다', 'fail'],
  'rejected|invalid': ['백업이 요청을 받지 않았습니다.', 'PC 시계가 맞는지 확인한 뒤 다시 눌러 주세요.', '요청을 받지 않았습니다', 'fail'],
  'rejected|version': ['백업 부품이 솔리오의 요청을 알아듣지 못했습니다.', '솔리오와 백업 부품을 업데이트해 주세요.', '요청을 알아듣지 못했습니다', 'fail'],
  'failed|busy': ['다른 일을 하고 있어 지금은 백업하지 못했습니다.', '다음 매시 백업 때 합니다.', '다른 일 중이라 미뤘습니다', 'wait'],
  'failed|clock': ['PC 시계가 맞지 않아 백업을 미뤘습니다.', 'Windows 시계를 맞춘 뒤 다시 눌러 주세요.', '시계가 맞지 않습니다', 'fail'],
  'failed|interrupted': ['백업이 중간에 끊겼습니다.', '다음 매시 백업 때 이어서 합니다.', '중간에 끊겼습니다', 'fail'],
  'failed|network': ['인터넷에 닿지 못해 백업하지 못했습니다.', '연결을 확인한 뒤 다시 눌러 주세요.', '인터넷에 닿지 못했습니다', 'fail'],
  'failed|*': ['백업하지 못했습니다.', '「백업 상태 보기」에서 까닭을 확인해 주세요.', '하지 못했습니다', 'fail'],
  'confirm-in-engine|*': ['확인할 일이 있습니다.', '「백업 상태 보기」를 눌러 확인해 주세요.', '확인이 필요합니다', 'fail'],
  '*': ['백업의 답을 솔리오가 알아듣지 못했습니다.', '「백업 상태 보기」에서 확인해 주세요. 솔리오를 업데이트하면 여기서도 보입니다.', '답을 알아듣지 못했습니다', 'fail'],
});
function answerWords(result, reason) {
  return ANSWER[`${result}|${reason}`] || ANSWER[`${result}|*`] || ANSWER['*'];
}
const JOB_STEP = Object.freeze({ backup: 'backup', check: 'backup', proof: 'proof' });
const JOB_LABEL = Object.freeze({ backup: '백업하는 중', check: '백업을 점검하는 중', proof: '되살리기 확인 중', restore: '되살리는 중', move: '옮겨 오는 중', setup: '설정하는 중', free: '비우는 중', other: '일하는 중' });
const cmpVersion = (a, b) => {
  const pa = String(a || '').split('.').map(Number), pb = String(b || '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};

/* 칸으로 세우지 않은 드라이브를 한 줄로 알린다(원클릭 판과 「이 PC에 맞춘 것」 판이 같이 쓴다).
   조사가 드라이브 글자에 붙지 않게 「E: 드라이브는」으로 쓴다(Fable 다시 검수 FA1 — 「M:는」이 나오지 않게) */
const HIDE_WHY = Object.freeze([
  ['virtual', 'Google Drive 같은 가상 드라이브로 보여'],
  ['same', '다른 드라이브와 크기 · 남은 공간이 같아 같은 디스크로 보고'],
  ['small', '32GB보다 작아(복구 파티션 따위)'],
]);
export function hiddenSentence(hidden) {
  const list = Array.isArray(hidden) ? hidden.filter(x => x && typeof x.letter === 'string' && /^[A-Z]$/.test(x.letter)) : [];
  return HIDE_WHY.map(([why, words]) => { const of = list.filter(x => x.why === why); return of.length ? `${of.map(x => `${x.letter}:`).join(' · ')} 드라이브는 ${words} 뺐습니다.` : ''; }).filter(Boolean).join(' ');
}
/* 보고서의 드라이브들(본체 summarizeSpace가 걸러 빠듯한 차례로 둔 것). 옛 꼴(drive 하나)도 읽는다 */
const driveList = space => (Array.isArray(space?.drives) ? space.drives : space?.drive ? [space.drive] : []);
const belowLine = d => !!d.startLineGb && d.free < d.startLineGb * GB;
/* 1000GB부터는 TB로 쓴다(「1907GB」가 아니라 「1.9TB」) */
const sizeWords = n => (n >= 1000 * GB ? `${(n / 1024 ** 4).toFixed(1)}TB` : `${Math.round(n / GB)}GB`);
/* 둘째 드라이브부터의 한 줄 막대 */
function driveRow(d) {
  const line = d.startLineGb ? d.startLineGb * GB : null;
  const scale = Math.max(line ? line * 2 : d.size, d.free * 1.15, 1);
  const pct = v => Math.max(0, Math.min(100, (v / scale) * 100));
  return { letter: d.letter, label: `${d.letter}:`, size: sizeWords(d.size), free: `${gb(d.free)} 남음`, freePct: pct(d.free), linePct: line ? pct(line) : null, below: belowLine(d),
    aria: `${d.letter}: 드라이브 ${sizeWords(d.size)}, 남은 공간 ${gb(d.free)}${line ? `, 정한 선 ${d.startLineGb}GB${belowLine(d) ? '보다 적음' : ''}` : ''}` };
}
/* 드라이브 판(PC 진단 설계 5.1): 첫 칸은 가장 빠듯한 드라이브, 나머지는 그 아래 한 줄 막대. 넷 이상이면 셋째부터 접는다 */
function driveCard(space, now) {
  // 엔진 보고서가 아직 없으면 PC 앱이 잰 드라이브(space.pc)로 세운다. 정한 선과 예측은 비운다(PC 진단 설계 5.1)
  const fromPc = !!space?.missing && Array.isArray(space.pc?.drives) && space.pc.drives.length > 0;
  if (fromPc) return driveCardFrom({ ...space.pc, createdAt: space.pc.readAt }, now, true);
  const list = driveList(space);
  if (!space || space.missing || space.invalid || !list.length) {
    const empty = space?.invalid ? '공간 보고서를 읽지 못했습니다.' : '아직 공간을 재지 않았습니다. 하루 한 번 잽니다.';
    return { empty };
  }
  return driveCardFrom(space, now, false);
}
function driveCardFrom(space, now, fromPc) {
  const list = driveList(space);
  const d = list[0], line = d.startLineGb ? d.startLineGb * GB : null;
  const scale = Math.max(line ? line * 2 : d.size, d.free * 1.15, 1);
  const pct = v => Math.max(0, Math.min(100, (v / scale) * 100));
  const g = d.growthPerDay;
  // 엔진은 증가 속도를 모를 때도(보호 첫날 따위) daysToStartLine을 null로 준다. 「내려가지 않습니다」는 속도가 0 이하로 재였을 때만 쓴다(Fable F2)
  const pred = fromPc ? '첫 공간 훑기를 마치면 정한 선과 언제 닿을지를 보입니다.' : line === null ? '정한 선을 아직 받지 못했습니다.' : belowLine(d) ? `남은 공간이 정한 선(${d.startLineGb}GB)보다 적습니다.`
    // 아직 선 위인데 하루 안에 닿으면 「0일 뒤」가 아니라 「오늘 안에」(카본 A3)
    : d.daysToStartLine === 0 ? '이대로면 오늘 안에 정한 선 아래로 내려갑니다.'
      : Number.isSafeInteger(d.daysToStartLine) ? `이대로면 ${d.daysToStartLine}일 뒤 정한 선 아래로 내려갑니다.`
      : !Number.isSafeInteger(g) ? '며칠 더 재어야 언제 정한 선에 닿는지 알 수 있습니다.' : g <= 0 ? '지금 속도로는 정한 선 아래로 내려가지 않습니다.' : '';
  const pace = Number.isSafeInteger(g) && g !== 0 ? `지난 14일 동안 하루에 ${gb(Math.abs(g))}씩 ${g > 0 ? '찼' : '비었'}습니다.` : '';
  const at = fromPc ? '' : backupDay(space.createdAt);
  // 넷 이상이면 선 위 드라이브만 접는다. 선 아래 드라이브는 늘 보인다(Fable 최종 P2-3)
  const rows = list.slice(1).map(driveRow), shownRows = list.length >= 4 ? Math.max(1, rows.filter(r => r.below).length) : rows.length;
  // 칸으로 세우지 않은 드라이브를 말없이 빼지 않는다(Fable 최종 P2-4). 조사는 「E: 드라이브는」으로 글자에 붙이지 않는다(Fable 다시 검수 FA1)
  const hidden = hiddenSentence(space.hiddenDrives);
  return {
    // PC 앱 값은 잰 때를 함께 쓴다. 오래된 값인지 알 수 있게(Fable 최종 P2-2). 원클릭 판을 읽을 때 10분 넘은 값은 본체가 다시 잰다(main.cjs pcDrives)
    label: `${d.letter}: 드라이브 ${sizeWords(d.size)}`, at: fromPc ? (backupWhen(space.createdAt, now) ? `PC 앱이 ${backupWhen(space.createdAt, now)}에 잰 값` : 'PC 앱이 잰 값') : at ? `${at}에 잰 값` : '',
    free: (d.free / GB).toFixed(1), unit: 'GB 남음', freePct: pct(d.free), linePct: line ? pct(line) : null,
    lineLabel: line ? `정한 선 ${d.startLineGb}GB` : '', max: `${Math.round(scale / GB)}GB`, pred, pace,
    aria: `${d.letter}: 남은 공간 ${(d.free / GB).toFixed(1)}GB${line ? `, 정한 선 ${d.startLineGb}GB` : ''}`,
    below: belowLine(d),
    rows: rows.slice(0, shownRows), folded: rows.slice(shownRows), foldLabel: rows.length > shownRows ? `드라이브 ${rows.length - shownRows}개 더` : '', hidden,
  };
}
function spaceGroups(space, spaceFree = 'unavailable') {
  if (!space || !Array.isArray(space.groups)) return [];
  return GRADE_GROUPS.map(g => {
    const list = space.groups.filter(x => x.grade === g.k && Object.hasOwn(GROUP_NAMES, x.group));
    if (!list.length) return null;
    const total = list.reduce((t, x) => t + x.bytes, 0);
    const two = spaceFree === 'off' || spaceFree === 'on';
    const how = x => g.k === 'view' ? GROUP_HOW[x.group] || '' : g.k === 'auto' && two && !FREE2_GROUPS.includes(x.group) ? '원클릭이 아직 비우지 않습니다' : '';
    return { k: g.k, nm: g.nm, mid: g.k === 'auto' ? AUTO_MID[spaceFree] || AUTO_MID.unavailable : g.mid, val: gb(total), items: list.map(x => ({ nm: GROUP_NAMES[x.group], cnt: x.count > 1 ? `${x.count}곳` : '', val: gb(x.bytes), how: how(x) })) };
  }).filter(Boolean);
}

/* 「방금」 · 「6분 전」 · 「3시간 전」 · 「11월 20일」. 줄 오른쪽 칸은 짧게 쓴다 */
function agoWords(value, now) {
  const at = Date.parse(value || '');
  if (!Number.isFinite(at)) return '';
  const m = Math.round((now - at) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : backupDay(value);
}
/* 누름의 답(했음 · 쉼 · 거절 · 사라짐 · 만료)을 맨 위에 두는 시간. 그 뒤에는 지난 누름으로 보고 판에 쓰지 않는다.
   엔진은 매시 회차를 돌므로, 그보다 오래 두면 지금 상태(확인할 일 · 소식 없음)를 덮는다(Fable F1) */
export const ONECLICK_FRESH = 30 * 60000;
export function oneClickBoard(snap, now = Date.now()) {
  const s = snap.status || {}, space = snap.space || null, app = snap.app || null, raw = snap.oneclick || null;
  const settled = raw && !(['sent', 'claimed'].includes(raw.stage) && !raw.result) ? Date.parse(raw.answeredAt || '') : NaN;
  const c = Number.isFinite(settled) && now - settled > ONECLICK_FRESH ? null : raw;
  const pending = !!c && ['sent', 'claimed'].includes(c.stage) && !c.result;
  const since = c ? Math.max(Date.parse(c.at || '') || 0, Date.parse(c.wokeAt || '') || 0) : 0;
  const late = pending && c.stage === 'sent' && (now - since >= ONECLICK_PATIENCE || c.woke === 'no-task' || c.woke === 'failed');
  const job = s.job || null;
  const working = !!job || (pending && !late);
  const steps = [];

  // 01 백업
  const last = backupWhen(s.lastBackupAt, now), ago = agoWords(s.lastBackupAt, now);
  let b = { k: 'backup', no: '01', nm: '백업', mid: '바뀐 파일을 지금 클라우드에 올립니다', val: ago, state: '', p: null };
  let lead = null;
  if (job && JOB_STEP[job.stage] === 'backup') b = { ...b, mid: job.stage === 'check' ? '올린 백업을 점검하는 중입니다' : '바뀐 파일을 올리는 중입니다', val: Number.isFinite(job.percent) ? `${job.percent}%` : '', state: 'now', p: Number.isFinite(job.percent) ? job.percent / 100 : null };
  else if (pending && !late) b = { ...b, mid: c.stage === 'claimed' ? '요청을 받아 백업을 시작합니다' : '지금 백업을 부탁했습니다', val: '', state: 'now' };
  else if (late) {
    const why = c.woke === 'no-task' ? '백업 요청 작업을 찾지 못해, 다음 매시 백업 때 합니다' : c.woke === 'failed' ? '백업을 깨우지 못해, 다음 매시 백업 때 합니다' : '다른 일을 하고 있어, 끝나는 대로 합니다';
    b = { ...b, mid: why, val: '기다리는 중', state: 'wait' };
    lead = { say: '지금 백업을 부탁해 두었습니다.', then: c.woke === 'no-task' || c.woke === 'failed' ? `${why}.` : '하던 일이 끝나는 대로, 늦어도 다음 매시 백업 때 합니다.', note: '기다리는 중' };
  } else if (c?.result === 'done') {
    b = { ...b, mid: '끝났습니다', val: agoWords(s.lastBackupAt || c.answeredAt, now), state: 'done' };
  } else if (c?.result) {
    const [say, then, mid, state] = answerWords(c.result, c.reason);
    b = { ...b, mid, val: ago, state };
    // 볼 까닭이 있으면 그 주제의 화면을 연다. 주의 낱말(로그인 따위)이 있으면 그것이 먼저다
    // 문장이 「백업 상태 보기」를 부르면 그 단추를 낸다. 주의 낱말의 단추는 아래 줄에 남는다(Fable workbackup-solio-one-ui-20261127 F4)
    const topic = then.includes('「백업 상태 보기」') ? 'status' : knownTopics(s.attention)[0] || 'status';
    lead = { say, then, note: state === 'wait' ? '쉼' : '확인 필요', act: look(topic) };
  } else if (c?.stage === 'gone') {
    b = { ...b, mid: '결과를 확인하지 못했습니다', val: ago, state: 'wait' };
    lead = { say: '백업 결과를 확인하지 못했습니다.', then: `마지막 백업 시각을 봐 주세요.${last ? ` 마지막 확인은 ${last}입니다.` : ''}`, note: '확인 필요' };
  } else if (c?.stage === 'expired') {
    b = { ...b, mid: '하루가 지나도록 답이 없었습니다', val: ago, state: 'fail' };
    lead = { say: '하루가 지나도록 답이 없었습니다.', then: '「백업 상태 보기」에서 확인해 주세요.', note: '확인 필요', act: look('status') };
  }
  steps.push(b);

  // 02 되살리기 확인: 엔진이 정해진 때 스스로 한 결과다. 지금 하라고 부탁하는 길은 엔진에 없다(Fable 설계 검토 5)
  const proof = s.proof;
  let pr = { k: 'proof', no: '02', nm: '되살리기 확인', mid: '정해진 때 스스로 되살려 원본과 맞춰 봅니다', val: '', state: '', p: null };
  if (job?.stage === 'proof') pr = { ...pr, mid: '지금 되살려 맞춰 보는 중입니다', val: Number.isFinite(job.percent) ? `${job.percent}%` : '', state: 'now', p: Number.isFinite(job.percent) ? job.percent / 100 : null };
  else if (!proof) pr = { ...pr, mid: '첫 확인은 정해진 때 합니다', val: '아직 없음' };
  else if (proof.result === 'passed') pr = { ...pr, val: `${backupDay(proof.at)} 통과`, ok: true };
  // 결과 낱말은 오른쪽 칸에도 넣는다. 접힌 한 줄이 날짜만 보여 통과로 읽히지 않게 한다(카본 A1)
  else pr = { ...pr, mid: `마지막 확인이 「${PROOF_WORDS[proof.result] || '알 수 없음'}」이었습니다. 결과는 되살리기 화면에서 봅니다`, val: `${backupDay(proof.at)} ${PROOF_WORDS[proof.result] || '알 수 없음'}`, state: proof.result === 'skipped' ? '' : 'fail' };
  steps.push(pr);

  // 03 공간: 엔진이 하루 한 번 잰 보고서의 합계. 2판이 열린 PC(spaceFree off · on)는 이 누름의 비우기 · 미리 보기 결과를 쓴다(SPACE_DESIGN.md 12.5)
  const autoBytes = pick => (space?.groups || []).filter(x => x.grade === 'auto' && pick(x)).reduce((t, x) => t + x.bytes, 0);
  const auto = autoBytes(() => true), auto2 = autoBytes(x => FREE2_GROUPS.includes(x.group));
  const two = ['off', 'on'].includes(s.spaceFree), freeOn = s.spaceFree === 'on';
  const f = c?.free || null, n = f?.numbers || null;
  const fPending = !!f && ['sent', 'claimed'].includes(f.stage) && !f.result;
  // 백업 답 뒤 비우기 답이 너무 늦으면(워커가 끊긴 따위) 단추를 풀고 기다리는 중으로 둔다(카본 A4)
  const backupAnswered = Date.parse(c?.answeredAt || '');
  const fLate = fPending && !!c.result && !job && Number.isFinite(backupAnswered) && now - backupAnswered >= FREE_PATIENCE;
  const fWait = fPending && !fLate;
  let sp = { k: 'space', no: '03', nm: '공간', mid: '', val: backupDay(space?.createdAt), state: '', p: null };
  if (job?.stage === 'free') sp = { ...sp, mid: freeOn ? '다시 만들 수 있는 것을 비우는 중입니다' : '켜면 비울 것을 세는 중입니다', val: '', state: 'now' };
  else if (fLate) sp = { ...sp, mid: freeOn ? '비우기 답을 기다리는 중입니다. 늦어도 다음 매시 백업 때 답합니다' : '셈의 답을 기다리는 중입니다. 늦어도 다음 매시 백업 때 답합니다', val: '기다리는 중', state: 'wait' };
  else if (fPending && c.result) sp = { ...sp, mid: freeOn ? '다시 만들 수 있는 것을 비우는 중입니다' : '켜면 비울 것을 세는 중입니다', val: '', state: 'now' };
  else if (fPending) sp = { ...sp, mid: freeOn ? '백업 뒤에 다시 만들 수 있는 것을 비웁니다' : '백업 뒤에 켜면 비울 것을 셉니다', val: '', state: '' };
  // 미리 보기 답 뒤에 엔진 창에서 켰으면(상태 파일 on) 「켜면」이 아니라 켠 것을 말한다(Fable 최종 P2-1)
  else if (f?.result === 'done' && n && n.preview) sp = { ...sp, mid: !n.items ? '지금 비울 만한 것이 없었습니다' : freeOn ? `켰습니다. 다음 누름부터 ${gb(n.freed)}쯤 비웁니다` : `켜면 지금 ${gb(n.freed)}를 비울 수 있습니다`, val: '', can: n.items > 0 };
  else if (f?.result === 'done' && n) {
    const kept = n.busy ? `${n.busy}개는 쓰는 중이라 남겼습니다` : '';
    sp = { ...sp, mid: n.items ? `${gb(n.freed)}를 비웠습니다${kept ? ` · ${kept}` : ''}` : kept || '지금 비울 만한 것이 없었습니다', val: n.items ? gb(n.freed) : '', state: 'done' };
  } else if (f?.result) {
    const words = freeOn ? FREE_ANSWER : FREE_ANSWER_PREVIEW;
    sp = { ...sp, mid: words[f.reason] || (freeOn ? '비우지 못했습니다. 공간 화면에서 확인해 주세요' : '비울 것을 세지 못했습니다. 공간 화면에서 확인해 주세요'), state: f.result === 'failed' || !words[f.reason] ? 'fail' : 'wait' };
  }
  // 비우기 · 세기 요청의 답을 잃었으면(사라짐 · 하루 만료) 그렇다고 쓴다. 켠 PC에서는 엔진이 실제로 지웠을 수 있다(Fable 최종 P2-2)
  else if (f && !f.result && ['gone', 'expired'].includes(f.stage)) sp = { ...sp, mid: freeOn ? '비우기 결과를 확인하지 못했습니다. 공간 화면에서 봐 주세요' : '셈 결과를 확인하지 못했습니다. 다음 누름에 다시 셉니다', val: '', state: 'wait' };
  else if (!space || space.missing) sp = { ...sp, mid: '아직 공간을 재지 않았습니다. 하루 한 번 잽니다', val: '' };
  else if (space.invalid) sp = { ...sp, mid: '공간 보고서를 읽지 못했습니다', val: '' };
  else if (!space.lapFinishedAt && Number.isSafeInteger(space.scanningDays)) sp = { ...sp, mid: `디스크를 처음 훑는 중입니다(${space.scanningDays + 1}일째)` };
  // 보고서의 크기는 하루 한 번 잰 값이고, 비울 때 쓰는 중인 것은 걸러지므로 2판에서는 「많게는」으로 쓴다
  else if (two && auto2 > 0) sp = { ...sp, mid: `많게는 ${gb(auto2)}를 비울 수 있습니다`, can: true };
  else if (auto > 0) sp = { ...sp, mid: `다시 만들 수 있는 것 ${gb(auto)}를 찾았습니다`, can: true };
  else sp = { ...sp, mid: '바로 비울 만한 것은 찾지 못했습니다' };
  steps.push(sp);

  // 04 업데이트: 누른 뒤 PC 앱 업데이터와 엔진 피드를 다시 본다. 판은 받지 않는다
  const engineVer = snap.engine?.version || s.engine || '';
  // 피드와 백업 부품이 적은 update.json 가운데 새 판(맨 아래 업데이트 줄과 같은 판을 말한다)
  const feedVer = [snap.feed?.version, snap.update?.available].filter(v => typeof v === 'string' && v).sort((a, b) => cmpVersion(b, a))[0] || '';
  // 「아래에서 올립니다」는 맨 아래 업데이트 줄에 단추가 있을 때만 쓴다. 피드에서만 새 판이 보이면 있다고만 말한다(카본 workbackup-solio-one-ui-20261127 A3)
  const below = !!backupUpdateLine(snap)?.act;
  const enginePart = feedVer && engineVer && cmpVersion(feedVer, engineVer) > 0 ? `백업 부품 새 판 ${josa(feedVer, ['이', '가'])} 있습니다${below ? '(아래에서 올립니다)' : ''}` : engineVer ? `백업 부품 ${engineVer}${feedVer ? ' 최신' : ''}` : '';
  const appWords = !app ? '' : app.state === 'checking' ? 'PC 앱 새 판을 확인하는 중' : app.state === 'available' && app.latest ? `PC 앱 새 판 ${josa(app.latest, ['이', '가'])} 있습니다(설정에서 받습니다)`
    : app.state === 'ready' && app.latest ? `PC 앱 새 판 ${josa(app.latest, ['을', '를'])} 받아 두었습니다` : app.state === 'downloading' ? 'PC 앱 새 판을 받는 중' : app.current ? `PC 앱 ${app.current}${app.state === 'current' ? ' 최신' : ''}` : '';
  const checking = app?.state === 'checking' && !!c;
  const fresh = (app && ['available', 'ready'].includes(app.state)) || /새 판/.test(enginePart);
  steps.push({ k: 'update', no: '04', nm: '업데이트 확인', mid: [appWords, enginePart].filter(Boolean).join(' · ') || '솔리오와 백업 부품의 새 판을 봅니다', val: '', state: checking ? 'now' : fresh ? 'news' : '', p: null });

  // 도우미 구는 실제로 일하는 줄에만 앉는다(01 · 엔진이 하는 되살리기 확인 · 04의 확인)
  const at = steps.find(x => x.state === 'now')?.k || null;
  // 끝: 누른 백업이 답을 받았고 확인도 끝났으면 넷을 한 줄로 접는다
  const finished = !!c && !pending && !job && !checking && c.result === 'done' && !fWait;
  const freed = f?.result === 'done' && n && !n.preview && n.items > 0 ? n.freed : 0;
  const counted = f?.result === 'done' && n?.preview && n.items > 0 ? n.freed : 0;
  // 켜기 전의 셈만 「엔진 창에서 켜기」로 이끈다. 셈 뒤에 이미 켰으면 켠 것을 말한다(Fable 최종 P2-1)
  const canFree = freeOn ? 0 : counted, turnedOn = freeOn ? counted : 0;
  const sum = finished ? { nm: freed ? `백업하고 ${gb(freed)}를 비웠습니다` : '백업을 마쳤습니다', mid: [pr.val && `되살리기 확인 ${pr.val}`, fresh ? '새 판 있음' : ''].filter(Boolean).join(' · '), val: b.val } : null;
  if (finished && !lead) {
    const next = nextWords(s.nextRunAt, now);
    // 네 줄은 접히므로 04 줄을 가리키지 않고 새 판을 이 문장에서 말한다(카본 A3)
    const news = [appWords, enginePart].filter(w => /새 판/.test(w)).join(' · ');
    // 둘째 줄은 지금 확인할 일(엔진의 주의 낱말 · 소식 없음 · 되살리기 실패)부터 말한다(Fable F1)
    const topics = topicList(s.attention || []);
    const lows = driveList(space).filter(belowLine).map(x => `${x.letter}:`);
    // 켠 PC에서 비우기 답을 잃었으면 접힌 줄 안에만 두지 않고 맨 위에서도 말한다(Fable 다시 검수 r2 P2)
    const freeLost = freeOn && !!f && !f.result && ['gone', 'expired'].includes(f.stage);
    const then = topics ? `다만 확인할 일이 있습니다: ${topics}.`
      : snap.view === 'checking' ? '다만 예정된 백업 소식이 2시간 넘게 없습니다. 「백업 상태 보기」를 눌러 확인해 주세요.'
        : pr.state === 'fail' ? '다만 마지막 되살리기 확인이 실패했습니다. 「백업 상태 보기」를 눌러 「되살려 본 날」 줄을 봐 주세요.'
          : freeLost ? '다만 비우기 결과를 확인하지 못했습니다. 공간 화면에서 봐 주세요.'
          // 2판 미리 보기: 지금 켜면 비울 수 있는 양과 켜는 곳(공간 화면)을 말한다. 원클릭 판은 켜지 못한다
          : canFree ? `공간 화면에서 「누를 때 비우기」를 켜면 다음 누름부터 ${gb(canFree)}쯤 비웁니다.`
            : turnedOn ? `「누를 때 비우기」를 켰습니다. 다음 누름부터 ${gb(turnedOn)}쯤 비웁니다.`
            : lows.length ? `다만 ${lows.join(' · ')}의 남은 공간이 정한 선보다 적습니다. 아래에서 비울 수 있는 것을 봐 주세요.`
              : fresh ? `${news}.` : next ? `다음 백업은 ${next}입니다.` : '';
    const attention = !!topics || snap.view === 'checking' || pr.state === 'fail' || freeLost;
    const leadAct = topics ? look(knownTopics(s.attention)[0], { primary: false })
      // 단추도 문장과 같은 차례로 고른다: 소식 없음 · 되살리기 실패를 말하는 동안에는 비우기 쪽 단추를 내지 않는다(카본 A1)
      : freeLost && snap.view !== 'checking' && pr.state !== 'fail' ? look('space', { primary: false })
      : canFree && !attention ? look('space', { primary: false }) : null;
    lead = { say: freed ? `백업하고 ${gb(freed)}를 비웠습니다.` : '백업을 마쳤습니다.', then, note: attention ? '확인 필요' : '끝남', ...(leadAct ? { act: leadAct } : {}) };
  } else if (working && (!lead || job)) {
    // 엔진이 지금 일하면(되살리기 확인 · 파일 되살리기 따위) 지난 누름의 답보다 그 일이 맨 위다(카본 A4)
    // 켜지 않은 PC의 free 일은 세기만 한다(카본 A3)
    const words = job?.stage === 'free' && !freeOn ? '켜면 비울 것을 세는' : STAGE_WORDS[job?.stage] || STAGE_WORDS.other;
    lead = { say: job ? `지금 ${words} 중입니다${Number.isFinite(job.percent) ? `(${job.percent}%)` : ''}.` : '지금 백업을 시작합니다.', then: '창을 닫아도 백업은 이어서 합니다.', note: '하는 중' };
  } else if (fWait && c.result === 'done' && !lead) {
    // 백업은 끝났고 비우기 · 세기 답을 기다린다: 맨 위 문장이 평소 문장으로 돌아가지 않게 한다(카본 A3)
    lead = { say: '백업을 마쳤습니다.', then: freeOn ? '이어서 다시 만들 수 있는 것을 비우는 중입니다.' : '이어서 켜면 비울 것을 세는 중입니다.', note: '하는 중' };
  }
  const main = job ? { label: job.stage === 'free' && !freeOn ? '세는 중' : JOB_LABEL[job.stage] || JOB_LABEL.other, disabled: true }
    : pending && !late ? { label: '백업하는 중', disabled: true }
      : fWait && c.result ? { label: freeOn ? '비우는 중' : '세는 중', disabled: true } : { label: freeOn ? ONECLICK_FREE_LABEL : ONECLICK_LABEL, disabled: false };
  return {
    main, drive: driveCard(space, now), steps, at, sum, groups: spaceGroups(space, two ? s.spaceFree : 'unavailable'), lead,
    // 빨리 다시 읽는 때: 엔진이 일하거나, 요청을 막 넣었거나, 비우기 답을 기다리거나, 업데이트를 확인하는 중. 기다리는 중이면 천천히(15초) 읽는다
    busy: working || checking || fWait, key: c?.at || '',
  };
}
