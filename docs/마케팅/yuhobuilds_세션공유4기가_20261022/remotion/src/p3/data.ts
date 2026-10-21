// 판 안에 쓰는 실제 값. 출처는 ../../기획.md §2 「사실 대조」.
//  · 숫자: 현장 노트 윈도우 셸 「세션 공유 미러가 바뀔 때마다 28곳에 복사…」(10-20 22:05~10-21 00:10 실측)
//  · 코드: 공개 저장소 claude-session-share — 고치기 전 판(d2d7ea0) 39·571행, 고친 판(ac13744) 54행
//  · 기록 줄: %LOCALAPPDATA%/claude-session-share/claude-session-share.log (UTC → KST로 옮김, 괄호 속 세션 파일 이름은 자름)
//  · 세션 기록 파일: 10-22 이 PC의 local_….json 한 개를 칸 이름·칸 크기만 읽음(값은 화면에 내지 않음)

export const FOLDERS = 29; // 지금 계정 + 짝 28
export const NEVER = 13; // 로그인 기록 없는 짝
export const PASSING = 9; // 계정을 바꾸며 1~13초만 스친 짝
export const REAL = 7; // 남은 진짜 짝(지금 계정 포함)

export const BEFORE = { mbPerHour: 4279, cpu: 23.6, copiesPerHour: 34664, statePerHour: 328 } as const;
export const V3 = { mbPerHour: 333, cpu: 0.93, copiesPerHour: 4259 } as const;
export const V31 = { mbPerHour: 94, cpu: 0.26, copiesPerHour: 876, statePerHour: 12 } as const;

export const CODE_BEFORE = [
  { n: 39, t: 'const WATCH_DEBOUNCE_MS = 150;' },
  { n: 571, t: 'const w = fs.watch(d, { recursive: true }, () => {' },
  { n: 0, t: '  ctx.dirty.add(lower(d));' },
  { n: 0, t: '  scheduleTick(ctx, WATCH_DEBOUNCE_MS); });' },
] as const;
export const CODE_AFTER = [
  { n: 54, t: 'const BATCH_MS = envMs(' },
  { n: 0, t: '  "CLAUDE_SESSION_SHARE_BATCH_MS", 300000);' },
] as const;

/** 고치기 전 기록(10-20 21:56~21:57 KST). */
export const LOG_BEFORE = [
  { t: '21:56:31', m: 'claude-code-sessions: 1곳 확인, 28개 복사, 0개 삭제' },
  { t: '21:56:48', m: 'claude-code-sessions: 1곳 확인, 28개 복사, 0개 삭제' },
  { t: '21:57:11', m: 'claude-code-sessions: 1곳 확인, 28개 복사, 0개 삭제' },
  { t: '21:57:12', m: 'claude-code-sessions: 1곳 확인, 28개 복사, 0개 삭제' },
  { t: '21:57:13', m: 'claude-code-sessions: 1곳 확인, 28개 복사, 0개 삭제' },
] as const;

/** 고친 뒤 실제 계정 전환(10-21 00:10 KST). */
export const LOG_AFTER = [
  { t: '00:10:28.216', m: '로그아웃 줄을 봄 — 기다리지 않고 바로 전부 맞춤' },
  { t: '00:10:28.346', m: 'claude-code-sessions: 7곳 확인, 24개 복사, 0개 삭제' },
] as const;

/** 세션 기록 파일 한 개(10-22 확인): 전체 112,870바이트, 그중 도구 목록 칸 102,332바이트. 차례마다 바뀌는 칸은 활동 시각들. */
export const RECORD = { bytes: 112870, toolsKey: 'remoteMcpServersConfig', toolsBytes: 102332, changing: ['lastActivityAt', 'lastTurnEdgeAt'] } as const;

export const INSTALL = 'irm https://raw.githubusercontent.com/unmet23-lab/claude-session-share/main/install.ps1 | iex';
