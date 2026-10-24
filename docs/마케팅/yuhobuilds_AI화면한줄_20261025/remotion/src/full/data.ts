// 본편 장면에 쓰는 실제 값(가림 규칙: 계정·조직·세션 ID는 앞 4자 + ····, 사용자 이름은 …).
// 원문: .tmp/yuhobuilds-세션공유-20261017/로그발췌.txt(main.log·공개판 --status·공유 도구 기록), Documents/claude-session-share/README.md.
export * from '../film/data';

/** 03·04·08 폴더 셋(설명 그림). 1번이 링크가 가리킨 본거지, 2번이 지금 계정(목록이 빈 곳, 거절 줄의 경로). */
export const FOLDERS = [
  { id: 'd70f····\\418d····', home: true },
  { id: '7204····\\dbad····', current: true },
  { id: 'd70f····\\dbad····' },
];
export const SESSIONS_ROOT = 'claude-code-sessions\\';
export const TRANSCRIPTS = '~/.claude/projects';
export const LINK_DATE = 'junction · 2026.10.16';

/** 05 실제 줄: 목록은 읽혔고(Loaded 54), 13초 뒤 첫 저장이 거부됐다. 경로 앞은 …로 줄인다 — Loaded는 C:\Users\…\AppData\Roaming\Claude까지, 거절 줄은 바로 위 줄과 같은 폴더라 10b처럼 claude-code-sessions까지. */
export const LOADED_54 = { time: '10:37:34', text: '[info] Loaded 54 persisted sessions from …\\claude-code-sessions\\7204····\\dbad····' };
export const FIRST_REFUSAL = {
  time: '10:37:47',
  text: '[error] Failed to save session local_090b····: Refusing non-directory at private dir path ',
  mark: '(symlink/file plant)',
  tail: ': …\\7204····\\dbad····',
};

/** 08 공개판 --status(10-17 15:13). ★ = 지금 계정. */
export const STATUS_HEAD = 'claude-code-sessions: 25곳, 공통 파일 3430개';
export const STATUS_ROWS = [
  '3dcb/418d', '3dcb/61f3', '3dcb/81ce', '3dcb/9f8c', '4402/3e4a', '4402/418d', '4402/61f3', '4402/81ce', '4402/9f8c', '4402/dbad',
  '7204/418d', '7204/dbad', 'b0d4/3e4a', 'b0d4/418d', 'b0d4/61f3', 'b0d4/9f8c', 'b631/3e4a', 'b631/61f3', 'b631/81ce', 'b631/9f8c',
  'd70f/418d', 'd70f/61f3', 'd70f/81ce', 'd70f/9f8c', 'd70f/dbad',
].map((p) => {
  const [a, b] = p.split('/');
  return { id: `${a}····/${b}····`, here: p === '3dcb/9f8c' };
});
export const STATUS_TAIL = { sessions: '101개 세션 기록', files: '파일 3430개' };

/** 10b 실제 줄: 서로 다른 계정 넷이 모두 Loaded 76(10-17 14:08~14:14). */
export const LOADED_76 = [
  { time: '14:08:29', path: 'd70f····\\9f8c····' },
  { time: '14:08:37', path: '3dcb····\\9f8c····' },
  { time: '14:13:28', path: 'b0d4····\\61f3····' },
  { time: '14:14:55', path: 'b631····\\3e4a····' },
];

/** 11 저장소 첫 화면(README 기준, 공개 때 다시 맞춤). 주소는 아직 빈칸. */
export const REPO = {
  name: 'claude-session-share',
  desc: 'Claude 데스크톱(Windows)의 Code 탭에서 계정을 바꿔도 세션 목록이 그대로 보이게 하는 작은 도구입니다.',
  facts: ['윈도 Claude 데스크톱 · PowerShell 한 줄 설치', '설치 뒤 앱을 한 번 껐다 켜요'],
};
/** 11 끝 프로필 카드: 채널 배너(docs/SHIFT/배너/yuhobuilds_배너.png)의 실제 문구 + README 설명의 앞부분. 저장소 주소는 넣지 않는다. */
export const PROFILE = {
  handle: '@yuhobuilds',
  name: '유호 · YUHO BUILDS',
  bio: 'AI로 회사를 만드는 과정',
  sub: '직접 만든 결과와 시행착오까지',
  linkDesc: '계정을 바꿔도 세션 목록이 그대로 보이게',
};
/** 11 「글로 된 방법」 종이(README 본문 실제 문장, 흐림 아래 깔린다). */
export const README_LINES = [
  '어떤 문제인가요',
  '사용량 한도 때문에 Claude 계정 여러 개를 번갈아 쓰면,',
  '계정을 바꿀 때마다 Code 탭의 세션 목록이 비어 보입니다.',
  '대화 원문(~/.claude/projects)은 그대로 남아 있습니다.',
  '어떻게 푸나요',
  '앱은 세션 목록을 계정·조직 짝마다 다른 폴더에 둡니다.',
  '<앱 데이터>\\claude-code-sessions\\<계정 ID>\\<조직 ID>\\',
  '    local_*.json            세션 기록',
  '    deleted_*               앱이 지운 세션의 표식',
  '    archived-sessions.idx   보관한 세션 목록',
  '이 도구는 이 짝 폴더들을 1~2초 안에 서로 똑같이 맞춥니다.',
  '한 폴더에서 생기거나 바뀌거나 지워진 파일을 나머지 폴더 전부에 옮깁니다.',
  '같은 파일이 폴더마다 다르면 더 최근에 바뀐 쪽이 이깁니다.',
  '앱이 지운 세션은 다른 폴더에 옛 사본이 있어도 되살리지 않습니다.',
  '예약 작업',
  '앱은 계정에 로그인할 때마다 그 계정의 예약 작업 목록을 다시 씁니다.',
  '설치',
  'Node.js 20 이상이 필요합니다.',
  'PowerShell에서 아래 한 줄을 실행합니다.',
  '설치가 끝나면 Claude 데스크톱을 한 번 완전히 껐다 켭니다.',
];
