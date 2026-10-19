// 화면에 쓰는 값. 기록 줄·ID·숫자는 실제 값만 쓴다(.tmp/yuhobuilds-세션공유-20261017/로그발췌.txt, 가림 규칙: ID 앞 4자 + ····).
// 세션 제목은 가림 흐림 아래에 깔리는 글이라 읽히지 않는다(실제 제목을 쓰지 않는다).

/** 01A 목록 줄: 흐림 아래 글 · 오른쪽 시각(이것도 흐림). */
export const ROWS = [
  { title: '설치 파일 서명 다시 맞추기', meta: '2분' },
  { title: '결제 화면 오류 고치기', meta: '14분' },
  { title: '배포 순서 정리', meta: '1시간' },
  { title: '영상 콘티 다듬기', meta: '3시간' },
  { title: '로그인 흐름 점검', meta: '어제' },
];

/** main.log 거절 줄. 처음 넷과 끝 셋만 실제 시각·ID를 보이고, 가운데 1,079줄은 시각·ID를 가린 채 빠르게 흐른다. */
const MSG = ': Refusing non-directory at private dir path (symlink/file plant): …';
export type LogLine = { time: string; id: string };
export const LOG_FIRST: LogLine[] = [
  { time: '10:37:47', id: 'local_090b····' },
  { time: '10:37:48', id: 'local_090b····' },
  { time: '10:38:03', id: 'local_fc96····' },
  { time: '10:38:04', id: 'local_fc96····' },
];
export const LOG_LAST: LogLine[] = [
  { time: '12:41:23', id: 'local_fec4····' },
  { time: '12:41:23', id: 'local_b14a····' },
  { time: '12:41:23', id: 'local_dfe4····' },
];
export const LOG_MASKED: LogLine = { time: '··:··:··', id: 'local_········' };
export const LOG_TAIL = MSG;
/** 실제 거절 줄 수(Refusing non-directory). */
export const REFUSALS = 1086;
export const RANGE = '10:37:47 ~ 12:41:23';

/** 저장 안 된 세션 수(링크 건 계정으로 일한 두 시간). 카드 제목은 가림 흐림. */
export const UNSAVED = 21;

/** 공개판 --status(10-17 15:13)의 짝 폴더 25곳과 세션 기록 수. ★ = 지금 계정. */
export const PLACES = [
  '3dcb/418d', '3dcb/61f3', '3dcb/81ce', '4402/3e4a', '4402/418d',
  '4402/61f3', '4402/81ce', '4402/9f8c', '4402/dbad', '7204/418d',
  '7204/dbad', 'b0d4/3e4a', '3dcb/9f8c', 'b0d4/418d', 'b0d4/61f3',
  'b0d4/9f8c', 'b631/3e4a', 'b631/61f3', 'b631/81ce', 'b631/9f8c',
  'd70f/418d', 'd70f/61f3', 'd70f/81ce', 'd70f/9f8c', 'd70f/dbad',
];
export const HERE = 12; // 가운데 칸 = 3dcb/9f8c(지금 계정). 퍼지는 모양을 보이려고 가운데에 놓았다.
export const SESSIONS = 101;
/** 공개판 공유 도구 기록(한 곳이 바뀌면 나머지 24곳에 복사). */
export const RECORD = 'claude-code-sessions: 1곳 확인, 24개 복사, 0개 삭제';
