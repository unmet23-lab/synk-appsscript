// 2026-10-17 11:45 개발 창 「지금 확인」으로 읽은 실제 값. 이메일은 앞부분만 쓴다(콘티 v1과 같음).
// weekly·session은 앱이 읽은 「쓴 %」 그대로 두고, 화면 글(「N% 남음」·고리)은 앱 식(leftPercent·limitGauge)으로 바꿔 그린다
// (16:36부터 계정판이 쓴 %가 아니라 남은 %를 두 겹 고리로 보여 준다). session이 없는 계정은 앱에도 5시간 고리가 없다(GPT).
export type Svc = 'claude' | 'gpt' | 'gemini' | 'higgsfield';
export type Account = { svc: Svc; label: string; name: string; weekly?: number; session?: number; credits?: number };

export const ACCOUNTS: Account[] = [
  { svc: 'claude', label: 'Claude', name: 'unmet23', weekly: 38, session: 0 },
  { svc: 'claude', label: 'Claude', name: 'synk.yuh', weekly: 63, session: 41 },
  { svc: 'claude', label: 'Claude', name: 'founder', weekly: 99, session: 0 },
  { svc: 'gpt', label: 'GPT', name: 'synk.yuh', weekly: 31 },
  { svc: 'gemini', label: 'Gemini', name: 'Gemini', weekly: 0, session: 0 },
  { svc: 'higgsfield', label: 'Higgsfield', name: '77yuhbs', credits: 0.22 },
];

export const CHECK = { total: 6, seconds: 14, at: '11:45' };

// attention(): 줄 순서대로(같은 단계면 앞 줄이 먼저) — 77yuhbs 줄이 founder보다 앞이다.
export const ATTENTION = [
  { level: 1, text: '크레딧 부족 · 77yuhbs Higgsfield · 0.22' },
  { level: 1, text: '거의 소진 · 주간 1% 남음 · founder Claude' },
];

// ── 본편 나머지 장면(10-17 11:45 같은 확인의 캡처 cap540/services·claude-open·agenda·connect·guide-gemini와 대조) ──
// 01 지금 볼 것의 고리 카드(meter): 서비스마다 지금 가장 여유 있는 계정(roomiest). 남은 % = 100 - 쓴 %.
export const METERS = [
  { svc: 'claude', tag: 'Claude', name: 'unmet23', note: '계정 3개 중 가장 여유', g: { weekly: 62, session: 100 }, reset: ['주간 초기화까지 ', '4일 23시간'] },
  { svc: 'gpt', tag: 'GPT', name: 'synk.yuh', note: '', g: { weekly: 69 }, reset: ['주간 초기화까지 ', '6일 5시간'] },
  { svc: 'gemini', tag: 'Gemini', name: '', note: '', g: { weekly: 100, session: 100 }, reset: ['아직 안 씀', ''] },
] as const;

// 02 서비스 · 주간 한도 표(serviceBlock). 이메일은 앞부분만(앱도 표에선 앞부분만 쓴다).
export const SERVICE_ROWS = [
  { svc: 'claude', tag: 'Claude', best: 'unmet23', left: 62, most: true, next: '월 12:00 초기화' },
  { svc: 'gpt', tag: 'GPT', best: 'synk.yuh', left: 69, most: false, next: '금 17:03 초기화' },
  { svc: 'gemini', tag: 'Gemini', best: 'Gemini', left: 100, most: false, next: '초기화 시각 없음' },
] as const;

// Claude 줄을 펼친 계정 셋(accountRow · rowLine). 이름은 캡처처럼 「앞부분@···」. weekly·session·fable은 쓴 %.
export const CLAUDE_ACCOUNTS = [
  { name: 'unmet23@···', weekly: 38, session: 0, sessionIn: '4시간 41분', fable: 19, reset: '목 10:59', resetIn: '4일 23시간' },
  { name: 'synk.yuh@···', weekly: 63, session: 41, sessionIn: '3시간 42분', fable: 54, reset: '월 12:00', resetIn: '2일' },
  { name: 'founder@···', weekly: 99, session: 0, sessionIn: '', fable: 78, reset: '월 19:00', resetIn: '2일 7시간' },
] as const;
export const READ_AT = '11:45';
export const PLAN = 'max';

// 03 앞으로 7일(agendaSection). 오늘은 10/17(토).
export const AGENDA = [
  { day: '월 10/19', items: [{ time: '12:00', svc: 'claude', tag: 'Claude', what: 'synk.yuh 주간 초기화' }, { time: '19:00', svc: 'claude', tag: 'Claude', what: 'founder 주간 초기화' }] },
  { day: '목 10/22', items: [{ time: '10:59', svc: 'claude', tag: 'Claude', what: 'unmet23 주간 초기화' }] },
  { day: '금 10/23', items: [{ time: '17:03', svc: 'gpt', tag: 'GPT', what: 'synk.yuh 주간 초기화' }] },
] as const;

// 04 연결과 가이드 카드(connectSection). 11:45엔 공식 프로그램 넷이었다(Typecast 키 카드는 14:48에 생겼다).
export const CONNECTS = [
  { svc: 'claude', tag: 'Claude', tool: 'Claude Code', count: 3, version: '2.1.301 (Claude Code)' },
  { svc: 'gpt', tag: 'ChatGPT · Codex', tool: 'Codex', count: 1, version: 'codex-cli 0.163.0' },
  { svc: 'higgsfield', tag: 'Higgsfield', tool: 'Higgsfield CLI', count: 1, version: 'higgsfield 1.1.24 (74e091aaff646537b8f77d42e695ecccafbaa761)' },
  { svc: 'gemini', tag: 'Gemini', tool: 'Antigravity CLI', count: 1, version: '1.4.0' },
] as const;

// Gemini 연결 가이드(guide('gemini')) — 설치됨 · 로그인 단계
export const GEMINI_GUIDE = {
  plan: 'Antigravity CLI에 로그인한 Google 계정의 한도를 읽어요. Gemini 모델 한도와 Claude·GPT 모델 한도가 따로 보여요. 이 PC에는 Google 계정 하나만 연결돼요.',
  installed: '이 PC에 설치돼 있어요 (1.4.0).',
  login: '이미 이 PC에서 Antigravity CLI에 로그인해 쓰고 있다면 그 계정을 바로 가져올 수 있어요. 처음이라면 「Gemini 로그인」을 눌러요.',
  first: '연결하면 바로 사용량을 한 번 읽어요. 다음부터는 맨 위 「지금 확인」 한 번이면 모든 계정을 다시 읽어요.',
};

// 혜택 포스터(benefits.mjs subscriptions + launcher.mjs benefitPoster)
export const POSTER = { label: 'SYNK FOR YOU · 02 / 06', badge: 'PC 앱 · 회원 무료', word: '구독', lines: ['흩어진 AI 구독,', '이번 주 얼마나 썼는지 한 번에.'] };
