// AI 구독 계정판(회원 혜택) 화면. 읽기·로그인·저장은 데스크톱 본체(src/ai-subscriptions.cjs)가 하고,
// 이 파일은 받은 숫자를 두 화면으로 보여 준다(10-18 구조 개편: 한 겹에 한 질문).
//  · 한눈에 보기: 손볼 계정(있을 때만) → 01 서비스마다 지금 쓸 계정 한 줄 → 02 다 쓴 계정이 다시 열리는 때(있을 때만)
//    → 지난 7일 사용량(10-19, 기록 막대·그 전 평균과 차이·아끼는 팁) → 계정 관리·요금 입구
//  · 계정 관리: 서비스별 연결·설치 가이드, 계정 줄 메뉴(요금·결제일·다시 로그인·지우기), 요금 합계, 직접 넣는 구독, 막혔을 때
//  · 3차(10-19): 한 달 요약과 연간 결제·할인 시기 팁은 돈 이야기라 계정 관리 「요금·결제일」 칸 머리에, 한눈에 아래 입구 글에 한 줄로
const DAY = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_MS = 864e5;
// 마지막 확인에서 20분이 지나면 몇 분 전인지 붙이고, 1시간이 지나면 값이 지금과 다를 수 있다고 알린다.
const AGING_MS = 20 * 60e3, STALE_MS = 3600e3;
// 계정 하나의 읽은 값이 전체 확인보다 이만큼 오래되면 그 계정은 「못 읽음」으로 본다(옛 값을 정상처럼 보이지 않게).
const OLD_READ_MS = 12 * 3600e3;
const KINDS = [['weekly', '주간 한도', '주간 %와 초기화 시각'], ['credit', '크레딧', '잔액과 충전·결제일'], ['plan', '월 구독만', '결제일과 요금']];
const AUTO = {
  claude: { label: 'Claude', short: 'Claude', tool: 'Claude Code', plan: 'Claude Pro·Max 이상 요금제가 필요해요. 무료 요금제는 Claude Code를 쓸 수 없어요.', planLink: 'claude-plans', install: 'irm https://claude.ai/install.ps1 | iex', installLink: 'claude-install', email: true },
  gpt: { label: 'ChatGPT · Codex', short: 'GPT', tool: 'Codex', plan: 'ChatGPT 계정으로 로그인해요. 요금제마다 Codex 한도가 달라요.', planLink: 'chatgpt-plans', install: 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"', installLink: 'codex-install', email: false },
  higgsfield: { label: 'Higgsfield', short: 'Higgsfield', tool: 'Higgsfield CLI', plan: 'Higgsfield 계정의 남은 크레딧을 읽어요. 계정 여러 개를 하나씩 연결할 수 있어요.', planLink: null, install: 'npm install -g @higgsfield/cli', installLink: 'higgsfield-install', email: false, node: true },
  gemini: { label: 'Gemini', short: 'Gemini', tool: 'Antigravity CLI', plan: 'Antigravity CLI에 로그인한 Google 계정의 한도를 읽어요. Gemini 모델 한도와 Claude·GPT 모델 한도가 따로 보여요. 이 PC에는 Google 계정 하나만 연결돼요.', planLink: 'gemini-plans', install: 'irm https://antigravity.google/cli/install.ps1 | iex', installLink: 'antigravity-install', email: false, single: true },
  // 설치할 프로그램 없이 회원이 붙여 넣은 API 키로 읽는다(키는 본체가 이 PC에 암호화해 둔다).
  typecast: { label: 'Typecast', short: 'Typecast', tool: 'Typecast API 키', plan: 'Typecast API 요금제(API Lite 등)의 이번 달 남은 크레딧을 읽어요. 설치할 프로그램은 없고, 키는 이 PC에만 암호화해 보관해요.', planLink: 'typecast-api', key: true },
};
// 한눈에 화면의 서비스 순서: 주간 한도(고리)가 먼저, 크레딧이 뒤.
const ORDER = ['claude', 'gpt', 'gemini', 'higgsfield', 'typecast'];
// 지난 7일 사용량(10-19, Fable 검수 반영): 줄 왼쪽 보조 글은 무엇에 대한 숫자인지 말한다.
const USAGE_UNIT = { claude: '주간 한도 대비', gpt: 'Codex 한도 기준', gemini: 'Antigravity 기준', higgsfield: '쓴 크레딧', typecast: '쓴 크레딧' };
// Claude 요금제 배수(공식 claude.com/pricing, 본체 ai-usage.cjs와 같은 값). GPT·Gemini는 공식 배수가 없어 같은 무게.
const CLAUDE_WEIGHT = { pro: 1, max: 5, max5x: 5, max20x: 20 };
// 아끼는 팁. 사실을 말하는 문장은 공식 원문으로 확인한 것만 쓰고 확인한 날을 붙인다(checked). 「공식 안내」는 그 근거 페이지.
// Typecast는 계정판이 API 요금제를 읽고, 확인한 사실(미리 듣기 무료·이월 없음)은 웹 스튜디오 기준이라 사실 없는 팁만 둔다.
const SAVE_TIPS = {
  higgsfield: { link: 'higgsfield-credits', checked: '10/19', items: ['시안은 싼 모델·낮은 화질로 먼저 잡고, 마지막 한 번만 높은 화질로 뽑아 보세요.', '요금제에 Unlimited 모델이 들어 있는 동안에는 higgsfield.ai 웹에서 그 모델로 만들면 크레딧이 안 나가요(어떤 모델이 언제까지인지는 요금제 카드에서 봐요). CLI·MCP로 만들면 늘 나가요.', '연간 결제는 달마다 내는 것보다 싸지만 중간에 월 결제로 못 돌아와요. 열 달 넘게 쓸 계획일 때만 바꿔 보세요.'] },
  typecast: { link: null, checked: null, items: ['고칠 문장만 골라 그 문장만 다시 만들어 보세요. 긴 글을 통째로 다시 만들면 그만큼 또 나가요.', '여러 곳에 쓰는 문장은 한 번 만든 소리를 저장해 두고 다시 써요.'] },
};
// 팁 발동: 크레딧은 지난 7일이 그 전 평균의 1.5배 그리고 서비스별 최소량 이상(Typecast는 1글자 1크레딧이라 크게),
// 한도형은 바로 쓸 계정 전부가 가장 이른 풀리는 때보다 3시간 넘게 먼저 막힐 때. 화면에는 급한 것부터 둘까지.
const SPIKE_RATIO = 1.5, SPIKE_MIN = { higgsfield: 300, typecast: 3000 }, PACE_MARGIN = 3 * 3600e3, MAX_TIPS = 2;
// 초기화권(10-19): GPT는 Codex가 개수·만료일을 알려 주고, Claude는 Claude Code가 알려 주지 않아 회원이 claude.ai 설정 › 사용량을 보고 넣는다.
// 「지금 쓰기」는 묶음의 모든 계정이 막혔고 가장 먼저 풀리는 때가 하루 넘게 남았을 때만(막힌 줄 안내와 팁이 같은 기준), 「곧 만료」는 3일 안일 때.
// 쓰는 법·효과 문장은 두 회사 공식 도움말(10/19 확인)에 있는 것만. GPT는 쓰면 주간 초기화 날짜가 쓴 때부터 다시 시작되고, Claude는 그대로다.
const PASS_WAIT = DAY_MS, PASS_SOON = 3 * DAY_MS;
const PASS_TIPS = {
  gpt: { link: 'codex-resets', open: null, checked: '10/19', items: ['Codex 앱·CLI·웹의 설정 › 사용량에서 「1 reset available」(또는 「Full reset」)을 누르고 만료일을 확인한 뒤 써요.', '쓰면 5시간·주간 한도가 다시 차요. 대신 다음 주간 초기화는 다시 쓰기 시작한 날부터 일주일쯤 뒤로 바뀌고, 원래 날짜의 초기화는 따로 오지 않아요.', '새로 채울 한도가 없으면 쓰이지 않고 그대로 남아요. 만료되면 되살리거나 다시 받을 수 없어요.'] },
  claude: { link: 'claude-resets', open: 'claude-usage', checked: '10/19', items: ['그 계정으로 로그인한 claude.ai 웹이나 Claude 데스크톱의 설정 › 사용량에서 「Reset for free」를 눌러 써요. Claude Code와 휴대폰 앱에서는 못 써요.', '쓰면 그 한도가 바로 다시 차고, 주간 초기화는 원래 요일·시각에 그대로 와요. 쓴 뒤에는 되돌릴 수 없어요.', '요금제를 내리거나 해지하면 쓰지 않은 초기화권은 사라져요.'] },
};
// 2차(10-19, Fable 1차 아이디어 3·4): 요금제 맞추기는 공식 배수가 있는 Claude만 — 20x → 5x는 4주 모두 20% 이하, 5x → Pro는 16% 이하.
// 공식 배수는 5시간 창 기준이라(claude.com/pricing 「per 5-hour session」) 4주 동안 읽은 5시간 % 최고도 낮춘 요금제에 들어가야 한다
// (h5: 20x → 5x는 25% 미만, 5x → Pro는 20% 미만, Fable 2차 검수 P1-3). 안 쓰는 구독은 Claude(대화·Claude Code가 한 한도)와 크레딧형만 —
// GPT·Gemini의 %는 Codex·Antigravity 한도라 구독 전체를 말하지 못한다(Fable 2차 P1-1). 4주 모두 5% 이하(크레딧은 4주 동안 0)이고 결제일이 5일 안일 때.
// 요금·결제 주기는 본체가 주는 요금표(snapshot.prices — 앱 기본 사본과 synk.im 갱신본 가운데 서비스마다 더 최근에 확인한 쪽, 3차)에서 쓰고,
// 확인한 지 60일이 지난 서비스는 금액·결제 주기를 말하지 않는다. Claude 값은 한국어 요금표(부가세 10% 포함)다. 올려 쓰라는 권유는 하지 않는다(업셀 의심, 벤치마킹 불만 원문).
const PRICE_FRESH = 60 * DAY_MS;
const SIZE_DOWN = { max20x: { to: 'max5x', limit: 20, h5: 25, times: 4, part: '1/4', basis: '5배 대 20배' }, max5x: { to: 'pro', limit: 16, h5: 20, times: 5, part: '1/5', basis: '1배 대 5배' } };
const IDLE_LIMIT = 5, IDLE_BILL_DAYS = 5;
// 3차(10-19, Fable 1차 아이디어 6·7):
//  · 한 달 요약: 지난 4주를 쓴 만큼으로 치면 약 얼마어치인지. 「여유」로 말하고 「낭비」·「남겼다」는 쓰지 않으며 끌 수 있다
//    (꺼도 기록은 그대로 — 스크린타임 주간 리포트의 죄책감·「끄면 기록까지 지워짐」 불만 원문). 가장 여유가 많은 계정은 30% 넘게 남았을 때만 말한다.
//  · 연간 결제: 12주 내내 꾸준히 쓴 계정만(Claude는 4주씩 주간 평균 40% 넘게 · 크레딧형은 4주씩 한 달 크레딧의 50% 넘게), 요금표에 연간 결제가 있고
//    1년에 덜 내는 요금제만 — Claude는 Pro만(Max는 월 결제만), Higgsfield는 「중간에 월 결제로 못 돌아와요」를 머리 글에 붙인다.
//    할인 시기는 요금표에 날짜·출처가 있는 할인이 45일 안에 시작하거나 지금 진행 중일 때만.
const MONTH_DAYS = 365.25 / 12, ROOM_LINE = 30, ANNUAL_PCT = 40, ANNUAL_CREDIT = 0.5, DEAL_AHEAD = 45 * DAY_MS;
// 목표 묻기: 「아끼기」는 아끼는 팁(안 쓰는 구독·요금제 맞추기·크레딧 증가·곧 만료되는 초기화권)을 먼저,
// 「막힘 없이 쓰기」는 막히기 전 팁(속도 경고·지금 쓸 초기화권)을 먼저 드리고 요금제를 낮추자는 팁은 뺀다. 고르기 전·「아직 몰라요」는 급한 순서.
// [값, 단추 글, 고른 뒤 칸 아래 줄, 고른 뒤 알림] — 「아직 몰라요」는 급한 순서 그대로라 그렇게 말한다(Fable 2차 P2-2).
const GOALS = [['save', '아끼기', '아끼기 쪽', '팁을 「아끼기」 쪽으로 드릴게요.'], ['smooth', '막힘 없이 쓰기', '막힘 없이 쓰기 쪽', '팁을 「막힘 없이 쓰기」 쪽으로 드릴게요.'], ['unsure', '아직 몰라요', '급한 순서', '알겠어요. 급한 순서대로 드릴게요.']];
const MANUAL_NAMES = ['Suno', 'Hugging Face', 'ElevenLabs', 'Kling', 'Midjourney', 'Cursor', 'Perplexity', 'Google AI Pro', 'Typecast'];
const MANUAL_KIND = { suno: 'credit', typecast: 'credit', elevenlabs: 'credit', kling: 'credit', higgsfield: 'credit', claude: 'weekly', gpt: 'weekly', chatgpt: 'weekly' };
const CODE_TEXT = {
  TOOL_MISSING: '먼저 공식 프로그램을 설치해 주세요. 설치 후 「다시 확인」을 눌러요.',
  NOT_LOGGED_IN: '이 PC의 기본 로그인이 없어요. 「새 계정 연결」로 로그인해 주세요.',
  LOGIN_BUSY: '다른 로그인이 진행 중이에요. 끝내거나 취소한 뒤 다시 시도해 주세요.',
  INVALID_EMAIL: '이메일 형식을 확인해 주세요.',
  INVALID_CODE: '코드에 띄어쓰기나 줄바꿈 없이 그대로 붙여 넣어 주세요.',
  NODE_REQUIRED: 'Higgsfield CLI는 Node.js가 있어야 설치돼요. 먼저 「Node.js 받기」로 설치해 주세요.',
  SIGN_IN_REQUIRED: 'SYNK ID로 로그인한 뒤 쓸 수 있어요.',
  LAUNCHER_ONLY: 'SYNK Platform PC 앱에서 쓸 수 있어요.',
  LABEL_REQUIRED: '서비스 이름을 넣어 주세요.',
  TOO_MANY_ROWS: '구독은 200개까지 넣을 수 있어요.',
  INSTALLER_FAILED: '설치 창을 열지 못했어요. 명령을 복사해 PowerShell에 붙여 넣어 주세요.',
  INVALID_KEY_FORMAT: 'API 키를 띄어쓰기 없이 그대로 붙여 넣어 주세요.',
  INVALID_KEY: 'Typecast가 이 키를 받지 않았어요. 키 페이지에서 다시 복사해 붙여 넣어 주세요.',
  KEY_CHECK_FAILED: 'Typecast 크레딧을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  NETWORK: 'Typecast에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.',
  SECURE_STORAGE_UNAVAILABLE: '이 PC에서는 키를 안전하게 저장할 수 없어 연결하지 않았어요.',
  BOARD_BUSY: '다른 프로그램이 계정판 파일을 잠깐 쓰고 있어요. 잠시 뒤 다시 시도해 주세요.',
  NO_WORKSPACE: 'Higgsfield에서 쓸 작업공간이 골라져 있지 않아요. 터미널에서 「higgsfield workspace set」으로 고른 뒤 다시 시도해 주세요.',
};
const HELP = [
  ['설치했는데 「설치 안 됨」으로 나와요', '가이드의 「설치 끝났어요 · 다시 확인」을 눌러 주세요. 그래도 같으면 SYNK 앱을 완전히 껐다 켜거나 PC를 다시 시작해 주세요. Windows가 새 프로그램 위치를 아직 모를 때 생겨요.'],
  ['로그인 페이지가 열리지 않아요', '가이드의 「로그인 페이지 다시 열기」를 눌러 주세요. 회사·학교 네트워크, VPN, 백신의 웹 보호가 막을 수 있으니 잠시 끄거나 휴대폰 핫스팟으로 다시 해 보세요.'],
  ['다른 계정으로 로그인돼요', '로그인은 브라우저에 지금 로그인된 계정으로 승인돼요. 가장 쉬운 방법은 로그인 단계의 「주소 복사」를 눌러 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣고, 연결할 계정으로 로그인하는 거예요. 계정을 여러 개 연결할 때는 하나씩 「계정 더 연결」을 누르고, 시크릿 창은 계정마다 새로 열어 주세요.'],
  ['Typecast 키가 맞지 않대요', 'Typecast API 키 페이지에서 키를 다시 복사해 붙여 넣어 주세요. 키를 새로 만들면 예전 키는 더 이상 안 돼요. 그럴 땐 Typecast 키 줄의 ⋯에서 「키 다시 넣기」를 눌러 새 키를 넣어 주세요.'],
  ['코드를 붙여 넣어도 넘어가지 않아요', '코드 앞뒤 공백 없이 한 번에 붙여 넣어 주세요. 계속 안 되면 「검은 창으로 로그인하기」를 눌러 검은 창에 직접 붙여 넣어 주세요(오른쪽 클릭으로 붙여넣기).'],
  ['「구독 한도가 없어요」라고 나와요', 'Claude Code는 Pro·Max 이상 요금제에서만 쓸 수 있어요. 무료 요금제 계정은 자동으로 읽을 수 없으니 「구독 직접 넣기」로 결제일만 챙겨 주세요.'],
  ['ChatGPT가 휴대폰 인증을 요구해요', 'OpenAI의 보안 절차예요. 브라우저 안내대로 휴대폰 인증을 마치면 Codex 로그인이 이어져요.'],
  ['Gemini 검은 창에서 막혔어요', '검은 창을 한 번 눌러 고른 뒤 Enter를 눌러요. 코드는 Ctrl+V 대신 검은 창 안에서 오른쪽 클릭으로 붙여 넣어요. 브라우저에서 계정을 고를 때 연결할 Google 계정을 눌러 주세요. 이 PC에는 Gemini 계정 하나만 연결돼요.'],
  ['연결을 끊고 싶어요', '계정 줄의 ⋯을 누르고 「지우기」를 두 번 누르면 이 앱이 만든 로그인 폴더까지 지워요. 기존 로그인을 가져온 계정은 목록에서만 빠져요.'],
];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/* ---------- 계산(시험 대상) ---------- */
export function hasReset(row) { return row && row.resetDay !== null && row.resetDay !== undefined; }
export function nextReset(row, from) {
  const live = row?.live?.weekly?.resetsAt;
  if (live && live > from) return live;
  if (!hasReset(row)) return null;
  const d = new Date(from); d.setHours(row.resetHour || 0, row.resetMinute || 0, 0, 0);
  d.setDate(d.getDate() + ((Number(row.resetDay) - d.getDay() + 7) % 7));
  if (d.getTime() <= from) d.setDate(d.getDate() + 7);
  return d.getTime();
}
export function isUsedUp(row, now) {
  if (!row?.usedUpAt) return false;
  const r = nextReset({ ...row, live: null }, row.usedUpAt);
  return r === null ? true : now < r;
}
export function nextBill(day, now) {
  if (!day) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const y = today.getFullYear(), m = today.getMonth() + i, last = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(day, last));
    if (d >= today) return Math.round((d - today) / DAY_MS);
  }
  return null;
}
export function balance(row) {
  const live = row?.live?.credits;
  if (live !== null && live !== undefined && (!row.creditsAt || (row.live.readAt || 0) >= row.creditsAt)) return { value: Number(live), at: row.live.readAt || null, source: 'live' };
  return num(row?.credits) === null ? null : { value: Number(row.credits), at: row.creditsAt || null, source: row.source === 'auto' ? 'live' : 'manual' };
}
export function isLow(row) {
  if (row?.kind !== 'credit') return false;
  const b = balance(row); if (!b) return false;
  return num(row.lowAt) !== null ? b.value <= Number(row.lowAt) : b.value <= 1;
}
// 남은 %는 내림한다(99.6% 썼으면 0%). 남은 양을 부풀려 보이지 않게.
export const leftPercent = used => Math.max(0, Math.floor(100 - Number(used) + 1e-6));
// 화면의 %는 쓴 양이다(10-18 유호님: 다른 AI처럼 꽉 차면 더 못 쓰는 쪽으로). 남은 %와 늘 합이 100이라 올림이 된다(99.6% 썼으면 100%).
export const usedShown = used => 100 - leftPercent(used);

// 한도 창 두 개(5시간 · 주간). 초기화 시각이 지난 창은 다시 가득 찬 것으로 본다.
// 「지금 쓸 수 있는 만큼」은 두 창 중 덜 남은 쪽(focus)을 따른다.
export function limitGauge(row, now) {
  if (row?.kind !== 'weekly') return null;
  const shape = w => {
    if (!w || !Number.isFinite(Number(w.usedPercent))) return null;
    if (w.resetsAt && now >= w.resetsAt) return { used: 0, left: 100, resetsAt: null };
    const used = Math.min(100, Math.max(0, Number(w.usedPercent)));
    return { used, left: leftPercent(used), resetsAt: w.resetsAt || null };
  };
  const session = shape(row.live?.session);
  let weekly = shape(row.live?.weekly);
  if (isUsedUp(row, now)) weekly = { used: 100, left: 0, resetsAt: nextReset(row, now) };
  else if (weekly && !weekly.resetsAt && weekly.used > 0) weekly.resetsAt = nextReset(row, now);
  if (!session && !weekly) return null;
  const focus = session && (!weekly || session.left < weekly.left) ? 'session' : 'weekly';
  return { session, weekly, focus, left: (focus === 'session' ? session : weekly).left, resetsAt: (focus === 'session' ? session : weekly).resetsAt };
}
// 주의는 「10% 이하 남음」(화면에는 90% 이상 씀) 하나로 숫자·색·점이 같은 기준을 쓴다.
export const gaugeLevel = w => (!w ? null : w.left <= 0 ? 'out' : w.left <= 10 ? 'low' : 'ok');

// 공식 출력의 요금제 이름(prolite 등)을 사람이 읽는 이름으로. 남은 %가 같을 때는 큰 요금제를 먼저 추천한다.
// Claude Max는 본체가 등급을 붙여 max_5x·max_20x로 준다(등급을 못 읽으면 max).
const PLAN = { max20x: 'Max 20x', max5x: 'Max 5x', max: 'Max', ultra: 'Ultra', pro: 'Pro', plus: 'Plus', prolite: 'Pro Lite', lite: 'Lite', free: 'Free', team: 'Team', business: 'Business', enterprise: 'Enterprise' };
const TIER = { max20x: 8, max5x: 7, max: 6, ultra: 5, pro: 4, plus: 3, prolite: 2, lite: 1 };
const planKey = plan => String(plan || '').toLowerCase().replace(/[\s_-]/g, '');
export const planName = plan => (plan ? PLAN[planKey(plan)] || String(plan) : '');
// 계정 이름: 메일 앞부분 → API 키 끝 네 글자(서비스가 이미 Typecast라 「키」는 붙이지 않는다) → 메일을 못 읽는 Gemini는 이 PC 로그인 → 직접 넣은 구독 이름.
export const nameOf = row => (row?.email ? row.email.split('@')[0] : row?.keyHint ? row.keyHint : row?.source === 'auto' && row.service === 'gemini' ? '이 PC 로그인' : row?.label || '');

// 계정 하나의 지금 상태.
//  ok 넉넉 · low 10% 이하 남음이나 크레딧 부족 · out 다 씀(unblock = 다시 열리는 때) · login 다시 로그인 ·
//  error 읽기 실패(또는 이번 확인에서 못 읽어 옛 값만 있음) · manual 직접 넣어 한도 숫자가 없음 · unknown 아직 안 읽음.
//  projected: 마지막으로 읽은 뒤 초기화 시각이 지나 「다시 찼을 것」으로 보는 때(그사이 쓴 양은 모른다).
export function accountState(row, now, checkAt = null) {
  const auto = row?.source === 'auto', readAt = row?.live?.readAt || 0;
  if (auto && row.state === 'needs-login') return { state: 'login' };
  if (auto && (row.state === 'error' || (readAt && checkAt && checkAt - readAt > OLD_READ_MS))) return { state: 'error', readAt };
  if (row?.kind === 'credit') {
    const b = balance(row);
    return b ? { state: isLow(row) ? 'low' : 'ok', credits: b.value } : { state: auto ? 'unknown' : 'manual' };
  }
  if (row?.kind !== 'weekly') return { state: 'manual' };
  const g = limitGauge(row, now);
  if (!g) return { state: auto ? 'unknown' : 'manual' };
  const state = gaugeLevel(g[g.focus]);
  const passed = auto ? ['session', 'weekly'].map(k => row.live?.[k]?.resetsAt).filter(t => t && t > readAt && t <= now) : [];
  return { state, g, left: g.left, focus: g.focus, unblock: state === 'out' ? g.resetsAt : null, projected: state !== 'out' && passed.length ? Math.max(...passed) : null };
}

// 초기화권: GPT는 Codex가 읽어 준 개수에서 그사이 만료된 것을 빼고, Claude는 회원이 넣은 개수(만료가 지났으면 없음).
export function passesOf(row, now) {
  if (row?.source !== 'auto') return null;
  if (row.service === 'gpt') {
    const r = row.live?.resets, total = num(r?.count);
    if (!total || total <= 0) return null;
    const list = Array.isArray(r.until) ? r.until.filter(Number.isFinite) : null;
    const count = Math.max(0, total - (list ? list.filter(t => t <= now).length : 0));
    return count ? { count, until: list ? list.filter(t => t > now).sort((a, b) => a - b)[0] ?? null : null, manual: false } : null;
  }
  if (row.service === 'claude') {
    const count = num(row.passCount);
    if (!count || count <= 0 || (row.passUntil && row.passUntil <= now)) return null;
    return { count, until: row.passUntil || null, manual: true };
  }
  return null;
}

// 한눈에 화면의 서비스 묶음(직접 넣은 구독은 이름·종류마다). 월 구독만 넣은 줄은 한도가 없어 「요금·결제일」에만 보인다.
// 묶음 안: 바로 쓸 계정(많이 남은 순, 같으면 큰 요금제) → 풀렸을 계정 → 직접 넣은 구독 → 다 쓴 계정(먼저 풀리는 순) → 못 읽음 → 다시 로그인 → 아직 안 읽음.
export function serviceGroups(rows, now, checkAt = null) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.kind !== 'weekly' && row.kind !== 'credit') continue;
    const auto = row.source === 'auto' && Object.hasOwn(AUTO, row.service), label = String(row.label || '').trim();
    const key = auto ? row.service : `m-${row.kind}-${label.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, service: auto ? row.service : null, label: auto ? AUTO[row.service].short : label || '직접 넣은 구독', kind: row.kind, accounts: [] });
    map.get(key).accounts.push({ row, name: nameOf(row), ...accountState(row, now, checkAt), pass: passesOf(row, now) });
  }
  const amount = a => a.credits ?? a.left ?? -1, tier = a => TIER[planKey(a.row.plan)] || 0;
  const rank = (a, b) => amount(b) - amount(a) || tier(b) - tier(a);
  const groups = [...map.values()].map(g => {
    const by = states => g.accounts.filter(a => states.includes(a.state));
    const live = by(['ok', 'low']), usable = live.filter(a => !a.projected).sort(rank), projected = live.filter(a => a.projected).sort(rank);
    const out = by(['out']).sort((a, b) => (a.unblock ?? Infinity) - (b.unblock ?? Infinity));
    // 크레딧은 부족한 계정을 「넉넉」에서 뺀다. 주간 한도는 10% 이하도 지금 쓸 수 있다.
    const ready = g.kind === 'credit' ? usable.filter(a => a.state === 'ok') : usable;
    // 추천은 넉넉한 확인값 → 풀렸을 계정 → 거의 다 쓴 확인값 순(1% 남은 계정보다 다시 찼을 계정이 낫다).
    const plenty = usable.filter(a => a.state === 'ok');
    // 「오늘은 이 계정부터」(10-19): 넉넉한 계정 가운데 주간 초기화가 24시간 안이고 주간·5시간 창이 20% 이상 남았으면
    // 초기화로 사라지기 전에 그 계정을 먼저 권한다(먼저 초기화되는 것부터). 그 계정을 읽은 지 1시간이 넘은 값으로는 권하지 않는다.
    const fresh = a => now - (a.row.live?.readAt || 0) <= STALE_MS;
    const today = g.kind === 'weekly' ? plenty.filter(a => fresh(a) && a.g?.weekly?.resetsAt > now && a.g.weekly.resetsAt - now <= DAY_MS && a.g.weekly.left >= 20 && (!a.g.session || a.g.session.left >= 20)).sort((a, b) => a.g.weekly.resetsAt - b.g.weekly.resetsAt)[0] || null : null;
    return { ...g, usable, projected, manual: by(['manual']), out, error: by(['error']), login: by(['login']), pending: by(['unknown']), ready, today, best: today || plenty[0] || projected[0] || usable[0] || by(['manual'])[0] || null };
  });
  const order = g => (g.service ? ORDER.indexOf(g.service) : ORDER.length);
  return groups.sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label, 'ko'));
}

// 이번 주 일정: 다 쓴 계정이 다시 열리는 때(unblock) · 쓸 수 있는 계정의 주간 초기화(reset) · 7일 안 결제(bill) · 7일 안 초기화권 만료(pass)를 시간순으로.
// 한눈에 화면은 unblock의 앞 셋만 보이고, 「모두 보기」를 누르면 그 자리에서 전부 펼친다.
export function upcoming(rows, now, checkAt = null) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const items = [];
  for (const row of rows || []) {
    const a = accountState(row, now, checkAt), pass = passesOf(row, now);
    if (a.state === 'out' && a.unblock) items.push({ t: a.unblock, type: 'unblock', row, focus: a.focus, after: a.focus === 'session' && a.g.weekly ? a.g.weekly.left : null, pass });
    else if ((a.state === 'ok' || a.state === 'low') && a.g?.weekly?.resetsAt && a.g.weekly.resetsAt - now <= 7 * DAY_MS) items.push({ t: a.g.weekly.resetsAt, type: 'reset', row });
    // 연간으로 표시한 줄(3차)의 「매월 n일」은 달마다 오는 결제가 아니라 세지 않는다.
    const dd = row.cycle === 'annual' ? null : nextBill(row.billDay, now);
    if (dd !== null && dd <= 6) items.push({ t: today.getTime() + dd * DAY_MS, type: 'bill', row, days: dd });
    // GPT는 초기화권마다 만료가 따로라 그때 사라지는 장수만, 직접 넣은 Claude는 한 만료 때에 넣은 장수 모두.
    if (pass?.until && pass.until - now <= 7 * DAY_MS) items.push({ t: pass.until, type: 'pass', row, count: pass.manual ? pass.count : (row.live?.resets?.until || []).filter(t => t === pass.until).length || 1 });
  }
  return items.sort((a, b) => a.t - b.t);
}

// official(row): 요금을 넣지 않은 줄의 공식 요금 { price, currency }(3차 요금표, 확인한 지 60일 안) — 없으면 null. 넣은 값이 늘 먼저다.
// count는 넣은 요금과 공식 요금으로 센 구독 수(official은 그 가운데 공식 요금 수), unknown은 요금을 모르는 줄 수.
// 공식 요금이 $0인 무료 요금제는 구독으로 세지 않고, 연간으로 표시한 줄의 「매월 n일」은 7일 안 결제로 세지 않는다(Fable 3차 시안 P3-4·P3-12).
export function costSummary(rows, now, rate = 1400, official = null) {
  let krw = 0, usd = 0, count = 0, fromTable = 0, unknown = 0, soon = 0, soonKrw = 0, soonUsd = 0;
  for (const row of rows) {
    const own = num(row.price) !== null, table = own ? null : official?.(row) || null;
    if (!own && !table) { unknown++; continue; }
    const price = own ? Number(row.price) : table.price, usdRow = (own ? row.currency : table.currency) === 'USD';
    if (!own && price === 0) continue;
    count++; if (table) fromTable++;
    if (usdRow) usd += price; else krw += price;
    const dd = row.cycle === 'annual' ? null : nextBill(row.billDay, now);
    if (dd !== null && dd <= 6) { soon++; if (usdRow) soonUsd += price; else soonKrw += price; }
  }
  return { krw, usd, count, official: fromTable, unknown, soon, soonKrw, soonUsd, approx: krw + usd * (Number(rate) || 1400) };
}
// 마지막 확인이 얼마나 지났나: fresh · aging(20분 넘음, 몇 분 전인지 붙임) · stale(1시간 넘음, 지금과 다를 수 있음).
export const freshness = (at, now) => (!at ? null : now - at > STALE_MS ? 'stale' : now - at > AGING_MS ? 'aging' : 'fresh');

/* ---------- 글자 ---------- */
export function rel(ms) {
  if (!Number.isFinite(ms) || ms < 60000) return '1분 안';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d >= 1) return h % 24 ? `${d}일 ${h % 24}시간` : `${d}일`;
  if (h >= 1) return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
  return `${m}분`;
}
const after = ms => (ms < 60000 ? '1분 안' : `${rel(ms)} 뒤`);
const hm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// 가까운 때는 짧게: 오늘은 시각만, 내일, 이번 주는 요일, 그 뒤는 날짜.
export function soon(t, now) {
  const d = new Date(t), start = new Date(now); start.setHours(0, 0, 0, 0);
  const day = Math.round((new Date(t).setHours(0, 0, 0, 0) - start) / DAY_MS);
  return day === 0 ? hm(t) : day === 1 ? `내일 ${hm(t)}` : day > 1 && day < 7 ? `${DAY[d.getDay()]} ${hm(t)}` : `${d.getMonth() + 1}/${d.getDate()} ${hm(t)}`;
}
const stamp = (t, now) => { const d = new Date(t), n = new Date(now); return d.toDateString() === n.toDateString() ? hm(t) : `${d.getMonth() + 1}/${d.getDate()} ${hm(t)}`; };
export function money(amount, currency) {
  if (amount === null || amount === undefined) return '';
  return currency === 'USD' ? `$${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `₩${Math.round(Number(amount)).toLocaleString('ko-KR')}`;
}
const pair = (krw, usd) => [krw ? money(krw, 'KRW') : '', usd ? money(usd, 'USD') : ''].filter(Boolean).join(' + ');
// 크레딧: 펼친 줄·관리 화면은 소수 둘째 자리까지, 한눈에 줄은 100 이상이면 소수 없이.
const credits = (v, round = false) => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: round && Math.abs(v) >= 100 ? 0 : 2 });
const WINDOW_NAME = { session: '5시간', weekly: '주간' };
// 「주간 14% 사용」 한 덩이는 좁은 창에서도 갈라지지 않게 붙인다(줄은 덩이 사이 「 · 」에서만 바뀐다).
const useText = (name, n) => `${name}\u00a0${n}%\u00a0사용`;
const billWord = d => (d === 0 ? '오늘' : `D-${d}`);
const modelName = name => (/모델$/.test(name) ? name : `${name} 모델`);
const shortVersion = v => (v ? String(v).replace(/\s*\(.*\)\s*$/, '').replace(/^(codex-cli|higgsfield)\s+/i, '') : '');
const svcClass = service => (service && Object.hasOwn(AUTO, service) ? 'ms-s-' + service : 'ms-s-other');
const labelOf = row => (row.source === 'auto' && Object.hasOwn(AUTO, row.service) ? AUTO[row.service].short : row.label);
const arrowBack = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
const chevron = '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6"/></svg>';
const moreIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';

// 서비스 줄의 고리(10-17 Bklit 게이지에서 원리만, 10-18 한 겹으로): 추천 계정의 덜 남은 쪽만, 쓴 만큼 12시에서 시계 방향으로 찬다
// (10-18 밤 남은 만큼에서 뒤집음 — 꽉 차면 그 창은 다 쓴 것). 고리는 추천 계정(넉넉·거의 다 씀·풀렸을 것)만 그려 다 쓴 원은 오지 않는다.
// 둥근 끝(반지름 3.5)이 틈 4.5% 안쪽을 메워 닫혀 보이므로 94% 이상 쓰면 각진 끝으로 그린다.
function ring(w) {
  const level = gaugeLevel(w), use = 100 - w.left, attrs = 'cx="30" cy="30" r="25" stroke-width="7"';
  const arc = use > 0 ? `<circle class="ms-arc" data-level="${level}" ${attrs} stroke-linecap="${use >= 94 ? 'butt' : 'round'}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="${100 - use}" transform="rotate(-90 30 30)"/>` : '';
  return `<svg class="ms-ring" viewBox="0 0 60 60" aria-hidden="true" focusable="false"><circle class="ms-track" data-level="${level}" ${attrs}/>${arc}</svg>`;
}
// 숫자 굴림(WORLD world-motion.mjs의 roll과 같은 문법): 숫자 글자는 그대로 두고(투명), 그 위에 0~9 띠를 굴린다.
const motionOn = () => typeof matchMedia === 'function' && document.documentElement?.dataset?.motion !== 'reduced' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
function roll(el, { delay = 0, duration = 1000 } = {}) {
  const nodes = [], walk = n => { for (const c of [...n.childNodes]) { if (c.nodeType === 3) nodes.push(c); else if (c.nodeType === 1) walk(c); } };
  walk(el);
  let k = 0;
  for (const node of nodes) {
    if (!/\d/.test(node.textContent)) continue;
    const frag = document.createDocumentFragment();
    for (const ch of node.textContent) {
      if (!/\d/.test(ch)) { frag.append(ch); continue; }
      const d = document.createElement('span'); d.className = 'ms-roll'; d.style.setProperty('--d', ch);
      const t = document.createElement('span'); t.className = 'ms-roll-t'; t.textContent = ch;
      const strip = document.createElement('i'); strip.setAttribute('aria-hidden', 'true'); strip.style.setProperty('--rd', `${delay + k * 120}ms`); strip.style.setProperty('--rt', `${duration + k * 160}ms`);
      d.append(t, strip); frag.append(d); k++;
    }
    node.replaceWith(frag);
  }
}

/* ---------- 화면 ---------- */
export function createSubscriptionsBoard({ bridge, toast = () => {}, poster = null } = {}) {
  const api = bridge?.subscriptions;
  let snapshot = null, container = null, visible = false, context = { signedIn: false, native: false }, loadError = null, timer = null, busy = '';
  // view: 한눈에 보기(glance) · 계정 관리(manage). open: 펼친 서비스 줄. menu: ⋯을 연 계정 줄. help: 펼친 「막혔을 때」 질문.
  // relogin: 「다시 로그인」을 누른 줄. API 키 서비스는 새 키를 그 줄에 넣는다(옛 줄이 남지 않게).
  // tipOpen: 펼친 팁. tipDone: 이 화면에서 반응한 팁(누른 뒤 한 줄을 보여 주고, 화면을 옮기면 사라진다). why: 「왜 이 숫자?」.
  // passEditing: 초기화권을 넣는 칸을 연 Claude 줄. goalOpen: 고른 목표를 바꾸려고 다시 연 목표 묻기.
  // sumOpen·sumWhy: 한 달 요약의 「계정별로 보기」·「왜 이 숫자?」(3차).
  const ui = { view: 'glance', open: new Set(), more: false, menu: null, guide: null, guideClosed: false, editing: null, passEditing: null, removeArmed: null, manualOpen: false, email: '', code: '', key: '', help: new Set(), relogin: null, tipOpen: new Set(), tipDone: {}, why: false, goalOpen: false, sumOpen: false, sumWhy: false };
  const rolled = new Map();
  // 알림과 응답은 따로 도착해 순서가 바뀔 수 있다. 본체가 붙인 번호(seq)보다 옛 스냅숏은 버린다.
  const take = value => { if (value?.ok && !(value.seq < snapshot?.seq)) snapshot = value; };
  // 본체의 자동 읽기(quiet) 알림은 1분 다시 그리기처럼 숫자를 굴리지 않는다(저절로 움직이는 효과 없음).
  api?.onChanged?.(value => { if (value?.ok) { take(value); if (visible) paint({ quiet: !!value.quiet }); } });
  const loginActive = () => !!snapshot?.login && !['done', 'error', 'cancelled'].includes(snapshot.login.stage);
  const checkBusy = () => !!(busy || snapshot?.checking);

  async function load(refreshTools = false) {
    if (!api) return;
    try { const value = await api.snapshot({ refreshTools }); if (value?.ok) { take(value); loadError = null; } else loadError = CODE_TEXT[value?.code] || '계정판을 불러오지 못했어요.'; }
    catch { loadError = '계정판을 불러오지 못했어요. 다시 시도해 주세요.'; }
    if (visible) paint();
  }
  async function act(name, task) {
    if (busy) return; busy = name; paint();
    try { const result = await task(); if (result && result.ok === false) toast(CODE_TEXT[result.code] || result.error?.message || '요청을 마치지 못했어요. 다시 시도해 주세요.'); else if (result?.rows) take(result); return result; }
    catch { toast('요청을 마치지 못했어요. 다시 시도해 주세요.'); }
    finally { busy = ''; paint(); }
  }

  function bind(el) {
    if (el.dataset.subsBound === 'true') return; el.dataset.subsBound = 'true';
    el.addEventListener('click', event => { if (!visible) return; const b = event.target.closest('[data-subs]'); if (b && !b.disabled) onAction(b.dataset.subs, b.dataset); });
    el.addEventListener('submit', event => { if (!visible) return; const form = event.target.closest('form[data-subs-form]'); if (!form) return; event.preventDefault(); onForm(form.dataset.subsForm, form); });
    el.addEventListener('input', event => { if (!visible) return; if (event.target.id === 'ms-email') ui.email = event.target.value; if (event.target.id === 'ms-code') ui.code = event.target.value; if (event.target.id === 'ms-key') ui.key = event.target.value; if (event.target.id === 'ms-manual-label') { const k = MANUAL_KIND[event.target.value.trim().toLowerCase().replace(/\s+/g, '')]; const kind = el.querySelector('#ms-manual-kind'); if (k && kind) { kind.value = k; el.querySelector('.ms-manual')?.setAttribute('data-kind', k); } } });
    el.addEventListener('change', event => { if (!visible) return; if (event.target.matches('[data-kind-select]')) event.target.closest('form')?.setAttribute('data-kind', event.target.value); if (event.target.matches('[data-cycle-select]')) event.target.closest('form')?.setAttribute('data-cycle', event.target.value); if (event.target.id === 'ms-rate') void act('rate', () => api.save({ settings: { usdKrw: Number(event.target.value) } })); });
  }
  // 화면 바꾸기: 그 화면 맨 위(또는 to 구획)로 옮기고, 화면 제목에 초점을 둔다.
  function show(view, to = null) {
    ui.view = view; ui.menu = null; ui.editing = null; ui.passEditing = null; ui.removeArmed = null; ui.tipDone = {}; ui.goalOpen = false; ui.sumOpen = false; ui.sumWhy = false;
    paint();
    const target = (to && container?.querySelector(`#${CSS.escape(to)}`)) || container?.querySelector('.member-subs');
    target?.scrollIntoView?.({ block: 'start' });
    if (!to) container?.querySelector('#benefit-title')?.focus?.({ preventScroll: true });
  }
  function openGuide(service, { email = '', relogin = null } = {}) {
    if (ui.view !== 'manage') { ui.view = 'manage'; ui.menu = null; ui.editing = null; }
    ui.guide = service; ui.email = email; ui.code = ''; ui.relogin = relogin;
    paint(); container?.querySelector('#ms-guide')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }
  function onAction(name, data) {
    const id = data.id, service = data.service;
    if (name === 'check') return void act('check', () => api.check());
    // 계정 하나만 다시 읽는다(못 읽은 줄의 「다시 읽기」). 「마지막 확인」 시각은 전체 확인 때 것으로 남는다.
    if (name === 'reread') return void act('check', () => api.check([id]));
    if (name === 'manage') return show('manage', data.to || null);
    if (name === 'glance') return show('glance');
    if (name === 'recheck-tools') return void act('tools', async () => { await load(true); toast('설치 상태를 다시 확인했어요.'); });
    if (name === 'toggle') { ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id); return paint(); }
    if (name === 'more') { ui.more = !ui.more; return paint(); }
    if (name === 'why') { ui.why = !ui.why; return paint(); }
    if (name === 'tip-open') { if (ui.tipDone[data.key]) { delete ui.tipDone[data.key]; ui.tipOpen.delete(data.key); } else if (ui.tipOpen.has(data.key)) ui.tipOpen.delete(data.key); else ui.tipOpen.add(data.key); return paint(); }
    // 팁 반응은 이 PC 판에 남는다(도움 됐어요 7일 · 그만 4주, 두 번째부터 12주). 누른 뒤 한 줄은 화면을 옮길 때까지 보인다.
    if (name === 'tip') { if (!['helpful', 'stop'].includes(data.act)) return; ui.tipDone[data.key] = data.act; return void act('tip', () => api.save({ tip: { key: data.key, action: data.act } })); }
    if (name === 'tip-reset') { ui.tipDone = {}; return void act('tip', async () => { const r = await api.save({ tip: { action: 'reset' } }); if (r?.rows) toast('쉬고 있던 팁을 다시 보여 드려요.'); return r; }); }
    // 목표 묻기·「팁 전부 끄기」(2차). 고른 값은 이 PC 판에 남고 칸 아래 줄에서 바꾸거나 다시 켠다.
    if (name === 'goal') { const g = GOALS.find(([k]) => k === data.goal); if (!g) return; ui.goalOpen = false; return void act('goal', async () => { const r = await api.save({ settings: { goal: g[0] } }); if (r?.rows) toast(g[3]); return r; }); }
    if (name === 'goal-change') { ui.goalOpen = !ui.goalOpen; return paint(); }
    if (name === 'tips-off' || name === 'tips-on') { const off = name === 'tips-off'; return void act('tip', async () => { const r = await api.save({ settings: { tipsOff: off } }); if (r?.rows) toast(off ? '팁을 껐어요. 칸 아래에서 다시 켤 수 있어요.' : '팁을 다시 켰어요.'); return r; }); }
    // 한 달 요약(3차): 펼치기·근거·끄기. 꺼도 기록은 지우지 않는다(같은 자리 한 줄에서 다시 켠다).
    if (name === 'sum-open') { ui.sumOpen = !ui.sumOpen; return paint(); }
    if (name === 'sum-why') { ui.sumWhy = !ui.sumWhy; return paint(); }
    if (name === 'summary-off' || name === 'summary-on') { const off = name === 'summary-off'; return void act('summary', async () => { const r = await api.save({ settings: { summaryOff: off } }); if (r?.rows) toast(off ? '한 달 요약을 껐어요. 기록은 그대로 둬요.' : '한 달 요약을 다시 켰어요.'); return r; }); }
    // 결제 주기 표시(3차): 연간 결제 팁의 「이미 연간이에요」와 계정 줄 ⋯의 「월 결제로 바꾸기」. 연간으로 표시한 계정에는 연간 결제 팁·결제 전 알림을 드리지 않는다.
    if (name === 'cycle') { const cycle = data.cycle === 'annual' ? 'annual' : null; return void act('cycle', async () => { const r = await api.save({ row: { id, cycle } }); if (r?.rows) toast(cycle ? '연간 결제로 표시했어요. 이 계정에는 연간 결제 팁을 드리지 않아요.' : '월 결제로 바꿔 두었어요.'); return r; }); }
    if (name === 'menu') { ui.menu = ui.menu === id ? null : id; ui.editing = null; ui.passEditing = null; ui.removeArmed = null; return paint(); }
    // Claude 초기화권: 넣는 칸 열기 · 쓴 뒤 한 장 줄이기(다 쓰면 만료 때도 비운다).
    if (name === 'pass-edit') { ui.menu = id; ui.passEditing = ui.passEditing === id ? null : id; ui.editing = null; return paint(); }
    // 쓴 직후 그 계정만 다시 읽어 막힘·다음에 풀려요가 바로 바뀌게 한다(못 읽으면 저장한 판을 그대로 둔다).
    if (name === 'pass-used') { const row = rowById(id); if (!row) return; const left = Math.max(0, (num(row.passCount) || 0) - 1); return void act('pass', async () => { const r = await api.save({ row: { id, passCount: left, ...(left ? {} : { passUntil: null }) } }); if (!r?.rows) return r; toast(left ? `초기화권을 1장 줄였어요. ${left}장 남았어요.` : '초기화권을 다 썼어요.'); take(r); const c = api.check ? await api.check([id]).catch(() => null) : null; return c?.rows ? c : r; }); }
    if (name === 'cost-edit') { ui.menu = id; ui.editing = id; ui.removeArmed = null; paint(); container?.querySelector(`[data-row="${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); return; }
    if (name === 'help-item') { ui.help.has(id) ? ui.help.delete(id) : ui.help.add(id); return paint(); }
    if (name === 'guide') return openGuide(service || 'claude');
    if (name === 'close-guide') { ui.guide = null; ui.guideClosed = true; ui.relogin = null; return paint(); }
    if (name === 'install') return void act('install', async () => { const r = await api.install(service); if (r?.ok) toast(`${AUTO[service].tool} 설치 창을 열었어요. 끝나면 「다시 확인」을 눌러 주세요.`); return r; });
    if (name === 'copy') { const text = AUTO[service]?.install; if (text) navigator.clipboard?.writeText(text).then(() => toast('설치 명령을 복사했어요. PowerShell에 붙여 넣어 주세요.'), () => toast('복사하지 못했어요. 명령을 직접 선택해 복사해 주세요.')); return; }
    if (name === 'help') return void api.help(data.link);
    if (name === 'existing') return void act('existing', async () => { const r = await api.useExisting(service); if (r?.ok) { toast(`${AUTO[service].label} 계정을 연결했어요.`); ui.guide = null; } return r; });
    if (name === 'login') return void act('login', () => api.login(service, { email: service === 'claude' ? ui.email.trim() || undefined : undefined }));
    if (name === 'console-login') return void act('login', () => api.login(service, { email: service === 'claude' ? ui.email.trim() || undefined : undefined, console: true }));
    if (name === 'open-url') return void api.openLoginUrl(snapshot?.login?.id);
    // 브라우저에 남은 다른 계정으로 승인되지 않게, 로그인 주소를 시크릿 창에 붙여 넣을 수 있게 한다.
    if (name === 'copy-url') { const url = snapshot?.login?.url; if (url) navigator.clipboard?.writeText(url).then(() => toast('로그인 주소를 복사했어요. 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣어 주세요.'), () => toast('복사하지 못했어요. 「로그인 페이지 다시 열기」를 써 주세요.')); return; }
    if (name === 'cancel-login') return void act('cancel', () => api.cancel(snapshot?.login?.id));
    if (name === 'relogin') { const row = rowById(id); if (row) openGuide(row.service, { email: row.email || '', relogin: row.id }); return; }
    if (name === 'edit') { ui.menu = id; ui.editing = ui.editing === id ? null : id; ui.passEditing = null; return paint(); }
    if (name === 'remove') { if (ui.removeArmed !== id) { ui.removeArmed = id; return paint(); } ui.removeArmed = null; ui.menu = null; return void act('remove', () => api.save({ remove: id })); }
    if (name === 'used') { const row = rowById(id); if (row) return void act('used', () => api.save({ row: { id, usedUpAt: isUsedUp(row, Date.now()) ? null : Date.now() } })); }
    if (name === 'manual') { ui.manualOpen = !ui.manualOpen; return paint(); }
  }
  function formValues(form) {
    const get = n => form.querySelector(`[name="${n}"]`)?.value ?? '';
    const kind = get('kind'), time = get('time') || '00:00', [h, m] = time.split(':').map(x => parseInt(x, 10) || 0), day = get('day');
    // cycle(3차): 결제 주기 칸 — 연간이면 'annual', 아니면 비운다(월 결제·모름). 요금은 어느 쪽이든 한 달 값으로 받는다(연간이면 1년 치 ÷ 12).
    return { label: get('label').trim(), kind, price: num(get('price')), currency: get('currency') === 'USD' ? 'USD' : 'KRW', billDay: num(get('bill')), cycle: get('cycle') === 'annual' ? 'annual' : null, credits: kind === 'credit' ? num(get('credits')) : null, lowAt: kind === 'credit' ? num(get('low')) : null, note: get('note').trim(), resetDay: kind === 'weekly' && day !== '' ? Number(day) : null, resetHour: kind === 'weekly' && day !== '' ? h : null, resetMinute: kind === 'weekly' && day !== '' ? m : null };
  }
  function onForm(name, form) {
    if (name === 'code') { const code = ui.code.trim(); if (!code) return toast('브라우저에 보이는 코드를 붙여 넣어 주세요.'); return void act('code', async () => { const r = await api.submitCode(snapshot?.login?.id, code); if (r?.ok) ui.code = ''; return r; }); }
    if (name === 'key') { const key = ui.key.trim(), service = form.dataset.service; if (!key) return toast('복사한 API 키를 붙여 넣어 주세요.'); return void act('key', async () => { const replace = ui.relogin && rowById(ui.relogin)?.service === service ? ui.relogin : null; const r = await api.connectKey(service, key, replace ? { replace } : {}); if (!r?.ok) return r; ui.key = ''; ui.guide = null; ui.relogin = null; toast(`${AUTO[service]?.label || ''} 키를 연결했어요. 남은 크레딧을 읽었어요.`); return r.snapshot || r; }); }
    if (name === 'manual') { const v = formValues(form); if (!v.label) return toast(CODE_TEXT.LABEL_REQUIRED); return void act('manual', async () => { const r = await api.save({ add: v }); if (r?.rows) { ui.manualOpen = false; toast(`${v.label}를 넣었어요.`); } return r; }); }
    // 만료 시각을 비우면 그날 23:59로 본다. 이미 지난 때는 받지 않는다.
    if (name === 'pass') {
      const id = form.dataset.id, get = n => form.querySelector(`[name="${n}"]`)?.value ?? '';
      const count = Math.max(0, Math.min(20, Math.round(num(get('passCount')) ?? 0))), date = get('passDate');
      const [h, m] = (get('passTime') || '23:59').split(':').map(x => parseInt(x, 10) || 0);
      const [y, mo, d] = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').map(Number) : [];
      const until = count && y ? new Date(y, mo - 1, d, h, m, 0, 0).getTime() : null;
      if (until !== null && until <= Date.now()) return toast('만료 때가 이미 지났어요. 날짜를 확인해 주세요.');
      return void act('pass', async () => { const r = await api.save({ row: { id, passCount: count, passUntil: until } }); if (r?.rows) { ui.passEditing = null; toast(count ? `초기화권 ${count}장을 넣었어요.` : '초기화권을 비웠어요.'); } return r; });
    }
    if (name === 'edit') { const id = form.dataset.id, row = rowById(id); if (!row) return; const v = formValues(form); const patch = { id, price: v.price, currency: v.currency, billDay: v.billDay, note: v.note, cycle: v.cycle }; if (row.source === 'manual') Object.assign(patch, { label: v.label || row.label, kind: v.kind, resetDay: v.resetDay, resetHour: v.resetHour, resetMinute: v.resetMinute }); if ((row.kind === 'credit' || v.kind === 'credit') && row.source === 'manual') Object.assign(patch, { credits: v.credits, lowAt: v.lowAt }); else if (row.kind === 'credit') patch.lowAt = v.lowAt; return void act('edit', async () => { const r = await api.save({ row: patch }); if (r?.rows) { ui.editing = null; toast('저장했어요.'); } return r; }); }
  }
  const rowById = id => snapshot?.rows?.find(row => row.id === id) || null;
  const reloginLabel = row => (row && AUTO[row.service]?.key ? '키 다시 넣기' : '다시 로그인');

  /* 포스터(다른 혜택 소개 머리와 같은 틀) */
  function hero(now, groups) {
    const check = snapshot?.check, rows = snapshot?.rows || [], auto = rows.some(r => r.source === 'auto');
    const total = groups.reduce((n, g) => n + g.accounts.length, 0), ready = groups.reduce((n, g) => n + g.ready.length, 0);
    const fresh = freshness(check?.at, now), progress = snapshot?.progress;
    const missed = check && check.total > check.ok ? ` · <span class="ms-missed"><i class="ms-led-warn" aria-hidden="true"></i>${check.total - check.ok}개 못 읽음</span>` : '';
    let note;
    if (!context.native) note = 'SYNK Platform PC 앱에서 쓸 수 있어요.';
    else if (!context.signedIn) note = 'SYNK ID로 로그인하면 바로 시작할 수 있어요.';
    else if (!snapshot) note = '계정판을 준비하고 있어요…';
    else if (snapshot.checking) note = `공식 프로그램으로 읽는 중이에요…${progress?.total ? ` <b class="ms-num">${progress.done}/${progress.total}</b>` : ''}`;
    else if (!rows.length) note = '연결한 계정 0개 · 계정 관리에서 연결해요.';
    else if (!total) note = '한도를 읽는 계정이 아직 없어요. 계정 관리에서 연결해요.';
    else if (!check?.at) note = auto ? '「지금 확인」을 누르면 연결한 계정을 한꺼번에 읽어요.' : '직접 넣은 구독만 있어요.';
    else if (fresh === 'stale') note = `<span class="ms-stale"><i class="ms-led-warn" aria-hidden="true"></i><span><b class="ms-num">${stamp(check.at, now)}</b>에 읽은 값이에요(${rel(now - check.at)} 전) · 지금과 다를 수 있어요</span></span>`;
    else {
      const ago = fresh === 'aging' ? `(${rel(now - check.at)} 전)` : '';
      note = `<span class="ms-note-long">지금 바로 쓸 수 있는 계정 <b class="ms-num">${ready}</b>개 · 전체 ${total}개 · 마지막 확인 ${stamp(check.at, now)}${ago}${missed}</span><span class="ms-note-short">바로 쓸 계정 <b class="ms-num">${ready}</b>개 · 전체 ${total}개 · ${stamp(check.at, now)} 확인${missed}</span>`;
    }
    // 「계정 관리」는 늘(다른 혜택 포스터와 같은 틀), 「지금 확인」은 읽을 계정이 생긴 뒤에.
    const actions = context.native && context.signedIn && snapshot
      ? `${rows.length ? `<button type="button" class="ms-button ms-button-primary" data-subs="check" ${busy || snapshot.checking || !auto ? 'disabled' : ''}>${snapshot.checking || busy === 'check' ? '확인 중…' : '지금 확인'}</button>` : ''}<button type="button" class="ms-button" data-subs="manage">계정 관리</button>`
      : context.native && !context.signedIn ? '<button type="button" class="ms-button ms-button-primary" data-insight-action="account">SYNK ID로 로그인</button>' : '';
    return `<button type="button" class="ms-back" data-view="benefits">${arrowBack}회원 혜택 모두 보기</button>
      <header class="ms-hero${poster?.art ? ' has-art' : ''}">${poster?.art ? `<img class="ms-object" src="${esc(poster.art)}" alt="">` : ''}
        <div class="ms-hero-top"><span class="ms-eyebrow">${esc(poster?.label || 'SYNK FOR YOU / AI SUBSCRIPTIONS')}</span>${poster?.badge ? `<span class="ms-badge${poster.status === 'integrated' ? ' is-integrated' : ''}"><span class="ms-led" aria-hidden="true"></span>${esc(poster.badge)}</span>` : ''}</div>
        <div class="ms-hero-title"><h1 id="benefit-title" tabindex="-1">구독</h1><p>흩어진 AI 구독,<br>이번 주 얼마나 썼는지 한 번에.</p></div>
        <div class="ms-hero-note"><span class="ms-note">${note}</span><div class="ms-hero-actions">${actions}</div></div>
      </header>`;
  }

  /* 한눈에 보기 */
  // 손볼 계정(다시 로그인·못 읽음)만 계정마다 한 줄로. 넷 이상이면 셋만 보이고 나머지는 계정 관리로.
  function fixBand(groups, now) {
    const items = groups.flatMap(g => [...g.login, ...g.error].map(a => ({ ...a, label: g.label })));
    if (!items.length) return '';
    const line = a => a.state === 'login'
      ? `<div class="ms-fix-row"><i class="ms-dot" data-state="login" aria-hidden="true"></i><span>다시 로그인 필요 · <b>${esc(a.name)}</b>(${esc(a.label)})</span><button type="button" class="ms-button ms-button-small" data-subs="relogin" data-id="${esc(a.row.id)}">${reloginLabel(a.row)}</button></div>`
      : `<div class="ms-fix-row"><i class="ms-dot" data-state="error" aria-hidden="true"></i><span>읽지 못함 · <b>${esc(a.name)}</b>(${esc(a.label)})${a.readAt ? ` · ${stamp(a.readAt, now)} 값` : ''}</span><button type="button" class="ms-button ms-button-small" data-subs="reread" data-id="${esc(a.row.id)}" ${checkBusy() ? 'disabled' : ''}>다시 읽기</button></div>`;
    const shown = items.length > 3 ? items.slice(0, 2) : items;
    return `<div class="ms-fix">${shown.map(line).join('')}${items.length > shown.length ? `<div class="ms-fix-row"><i class="ms-dot" aria-hidden="true"></i><span>손볼 계정이 ${items.length - shown.length}개 더 있어요</span><button type="button" class="ms-button ms-button-small" data-subs="manage">계정 관리에서 모두 보기</button></div>` : ''}</div>`;
  }
  // 점의 뜻을 범례 없이 글로 함께 말한다: 초록 바로 써요 · 노랑 거의 다 씀 · 초록 테두리 풀렸을 거예요 · 빈 원 다 씀 · 빨강 손볼 것.
  function countText(g) {
    const n = g.accounts.length, credit = g.kind === 'credit', low = g.usable.filter(a => a.state === 'low').length;
    const waiting = snapshot?.checking ? '확인 중' : '확인 전';
    const passes = g.accounts.reduce((sum, a) => sum + (a.pass?.count || 0), 0), passWord = passes ? `초기화권 ${passes}장` : '';
    if (n === 1) {
      const a = g.accounts[0], unit = g.service === 'typecast' ? '키' : g.service ? '계정' : '구독';
      const word = [a.projected ? '풀렸을 거예요' : { low: credit ? '부족' : '거의 다 씀', out: '다 씀', error: '못 읽음', login: '다시 로그인', unknown: waiting }[a.state], passWord].filter(Boolean).join(' · ');
      return `${unit} 1개${word ? ` <span class="ms-soft">${word}</span>` : ''}`;
    }
    const tail = [credit ? (low ? `${low}개 부족` : '') : (low ? `${low}개 거의 다 씀` : ''), g.projected.length ? `${g.projected.length}개 풀렸을 거예요` : '', g.out.length ? `${g.out.length}개 다 씀` : '', g.error.length ? `${g.error.length}개 못 읽음` : '', g.login.length ? `${g.login.length}개 다시 로그인` : '', g.pending.length ? `${g.pending.length}개 ${waiting}` : '', passWord].filter(Boolean).join(' · ');
    return `${n}개 중 <em>${g.ready.length}개</em> ${credit ? '넉넉' : '바로 써요'}${tail ? ` <span class="ms-soft">${tail}</span>` : ''}`;
  }
  function valueHtml(g, now, stale) {
    const best = g.best, read = stale && best?.row?.live?.readAt ? ` · ${stamp(best.row.live.readAt, now)}` : '', guess = best?.projected ? ' · 예상' : '';
    if (best && g.kind === 'credit' && best.credits !== undefined) return `<span class="ms-gauge ms-value" data-level="${best.state}"><span class="ms-big"><b class="ms-big-num" data-roll="c-${esc(g.key)}">${credits(best.credits, true)}</b><span>크레딧${read}</span></span></span>`;
    if (best?.g) { const w = best.g[best.focus]; return `<span class="ms-gauge ms-value${best.projected ? ' is-guess' : ''}" data-level="${gaugeLevel(w)}">${ring(w)}<span class="ms-big"><b class="ms-big-num" data-roll="r-${esc(g.key)}">${100 - w.left}<small>%</small></b><span>${WINDOW_NAME[best.focus]} 사용${guess}${read}</span></span></span>`; }
    const wait = (big, small) => `<span class="ms-value"><span class="ms-big is-wait"><b>${big}</b><span>${small}</span></span></span>`;
    if (best) return wait('직접 넣음', g.kind === 'credit' ? '잔액을 안 넣었어요' : '한도 숫자 없음');
    const first = g.out[0];
    if (first?.unblock) return wait(`<span class="ms-num">${esc(soon(first.unblock, now))}</span>`, '가장 먼저 풀려요');
    if (first) return wait('다 썼어요', '풀리는 때를 몰라요');
    if (g.login.length || g.error.length) return wait('손볼 것', g.login.length ? '다시 로그인이 필요해요' : '읽지 못했어요');
    return wait(snapshot?.checking ? '확인 중' : '확인 전', snapshot?.checking ? '읽는 중이에요' : '「지금 확인」을 눌러요');
  }
  function groupRow(g, now, stale) {
    const id = 'g-' + g.key, open = ui.open.has(id), n = g.accounts.length;
    const order = [...g.usable, ...g.projected, ...g.manual, ...g.out, ...g.error, ...g.login, ...g.pending];
    const dots = order.map(a => `<i class="ms-dot" data-state="${a.projected ? 'projected' : a.state}"></i>`).join('');
    // 여러 계정인데 추천이 거의 다 쓴 계정뿐이면 라벨로도 말한다.
    const pick = n > 1 ? (g.today ? '오늘은 이 계정부터' : g.best && !g.best.projected && g.best.state === 'low' ? '남은 건 이것뿐' : '추천') : g.service === 'typecast' ? '연결한 키' : g.service ? '연결한 계정' : '직접 넣은 구독';
    const plan = g.best && g.service ? planName(g.best.row.plan) : '';
    // 초기화 때와 쓴 %(고리와 같은 숫자 하나 — 「남음」은 쓰지 않는다). 한 덩이 안은 줄이 갈리지 않게 붙인다.
    const todayNote = g.today ? `<span class="ms-pick-note">${esc(soon(g.today.g.weekly.resetsAt, now)).replace(/ /g, '\u00a0')}\u00a0초기화 · 아직\u00a0${100 - g.today.g.weekly.left}%만\u00a0썼어요</span>` : '';
    return `<div class="ms-svc${open ? ' open' : ''} ${svcClass(g.service)}">
      <button type="button" class="ms-svc-row" data-subs="toggle" data-id="${esc(id)}" aria-expanded="${open}">
        <span class="ms-pool"><span class="ms-pool-top"><span class="ms-tag">${esc(g.label)}</span><span class="ms-count">${countText(g)}</span></span><span class="ms-dots" aria-hidden="true">${dots}</span></span>
        <span class="ms-pick"><span class="ms-pick-label${g.today && n > 1 ? ' is-today' : ''}">${pick}</span><span class="ms-pick-name${g.best ? '' : ' is-none'}">${g.best ? `<span>${esc(g.best.name)}</span>${plan ? `<small>${esc(plan)}</small>` : ''}` : '지금은 없어요'}</span>${todayNote}</span>
        ${valueHtml(g, now, stale)}${chevron}
      </button>${open ? detailHtml(g, now) : ''}</div>`;
  }
  // 펼친 줄의 보조 글: 오른쪽 값(덜 남은 창)은 빼고 나머지 창 — 주간, 모델별 주간(Fable 등), 5시간 순 — 의 쓴 %와 주간 초기화 때.
  function windowsText(a, now) {
    const { g } = a, parts = [];
    if (g.weekly && a.focus !== 'weekly') parts.push(useText('주간', 100 - g.weekly.left));
    for (const m of a.row.live?.models || []) if (Number.isFinite(Number(m.usedPercent))) parts.push(useText(modelName(m.name), usedShown(Math.min(100, Math.max(0, Number(m.usedPercent))))));
    if (g.session && a.focus !== 'session') parts.push(useText('5시간', 100 - g.session.left));
    if (g.weekly?.resetsAt) parts.push(`${soon(g.weekly.resetsAt, now)} 주간 초기화`);
    return parts.join(' · ');
  }
  function detailHtml(g, now) {
    const credit = g.kind === 'credit';
    // 계정 이름 옆에 요금제(Max 5x·Max 20x·Pro Lite 등)를 작게 붙여 계정마다 등급이 보이게 한다.
    const tierOf = a => (a.row.source === 'auto' ? planName(a.row.plan) : '');
    const line = (a, body, action = '') => `<div class="ms-acc" data-row="${esc(a.row.id)}"><i class="ms-dot" data-state="${a.projected ? 'projected' : a.state}" aria-hidden="true"></i><span class="ms-acc-name">${esc(a.name)}${tierOf(a) ? `<small>${esc(tierOf(a))}</small>` : ''}</span>${body}${action ? `<span class="ms-acc-act">${action}</span>` : ''}</div>`;
    // 막대·값은 쓴 만큼 찬다(꽉 차면 그 창은 다 씀).
    const value = a => `<span class="ms-acc-val"><b class="ms-num">${100 - a.left}%</b><small>${WINDOW_NAME[a.focus]} 사용</small></span>`;
    const bar = a => `<span class="ms-bar" data-state="${a.state}" aria-hidden="true"><i style="width:${100 - a.left}%"></i></span>`;
    const usable = g.usable.map(a => credit
      ? line(a, `<span class="ms-acc-sub">${a.state === 'low' ? '크레딧 부족' : ''}</span><span class="ms-acc-val"><b class="ms-num">${credits(a.credits)}</b></span>`)
      : line(a, `<span class="ms-acc-sub">${[esc(windowsText(a, now)), a.pass ? passHtml(a.pass, now) : ''].filter(Boolean).join(' · ')}</span>${bar(a)}${value(a)}`)).join('');
    const projected = g.projected.map(a => line(a, `<span class="ms-acc-sub">${esc(hm(a.projected))}에 풀렸을 거예요 · 지금 확인하면 정확해요${a.g.weekly?.resetsAt ? ` · ${esc(soon(a.g.weekly.resetsAt, now))} 주간 초기화` : ''}${a.pass ? ` · ${passHtml(a.pass, now)}` : ''}</span>${bar(a)}${value(a)}`)).join('');
    const manual = g.manual.map(a => line(a, `<span class="ms-acc-when">${credit ? '잔액을 넣지 않았어요' : '직접 넣은 주간 구독이에요 · 다 쓰면 「다 씀 표시」를 눌러요'}</span>`, credit ? '' : usedButton(a.row, now))).join('');
    const out = g.out.map(a => line(a, `<span class="ms-acc-when">${WINDOW_NAME[a.focus]} 한도 · ${a.unblock ? `<b>${esc(soon(a.unblock, now))}</b>${a.focus === 'weekly' ? ' 주간 초기화' : ''}에 풀려요(${esc(after(a.unblock - now))})` : '풀리는 때를 몰라요'}${a.focus === 'session' && a.g.weekly ? ` · ${useText('주간', 100 - a.g.weekly.left)}` : ''}${a.focus === 'session' && a.g.weekly?.resetsAt ? ` · ${esc(soon(a.g.weekly.resetsAt, now))} 주간 초기화` : ''}${a.pass ? ` · ${passHtml(a.pass, now)} · ${passAdvice(g, a, now)}` : ''}</span>`, a.row.source !== 'auto' ? usedButton(a.row, now) : a.pass ? passButton(a.row, a.name) : '')).join('');
    // 긴 이유는 두 줄까지만 보이고(전문은 title과 계정 관리 ⋯), 마지막으로 읽은 값의 시각을 붙인다.
    const reason = a => `${a.row.stateMessage || '읽지 못했어요.'}${a.readAt ? ` · ${stamp(a.readAt, now)} 값` : ''}`;
    const error = g.error.map(a => line(a, `<span class="ms-acc-when ms-acc-msg" title="${esc(reason(a))}">${esc(reason(a))}</span>`, `<button type="button" class="ms-button ms-button-small" data-subs="reread" data-id="${esc(a.row.id)}" ${checkBusy() ? 'disabled' : ''}>다시 읽기</button>`)).join('');
    const login = g.login.map(a => line(a, '<span class="ms-acc-when">다시 로그인이 필요해요</span>', `<button type="button" class="ms-button ms-button-small ms-button-primary" data-subs="relogin" data-id="${esc(a.row.id)}">${reloginLabel(a.row)}</button>`)).join('');
    const pending = g.pending.map(a => line(a, `<span class="ms-acc-when">${snapshot?.checking ? '읽는 중이에요' : '아직 읽지 않았어요 · 「지금 확인」을 누르면 읽어요'}</span>`)).join('');
    const part = (title, body) => (body ? `<div class="ms-acc-group"><h3>${title}</h3>${body}</div>` : '');
    return `<div class="ms-detail">${part(credit ? '남은 크레딧' : '바로 쓸 수 있어요', usable)}${part('풀렸을 거예요', projected)}${part('직접 넣은 구독', manual)}${part('막혀 있어요', out)}${part('손볼 것', error + login)}${part('확인 전', pending)}</div>`;
  }
  const usedButton = (row, now) => `<button type="button" class="ms-button ms-button-small" data-subs="used" data-id="${esc(row.id)}">${isUsedUp(row, now) ? '다 씀 풀기' : '다 씀 표시'}</button>`;
  // 초기화권 한 덩이(만료 때가 있으면 붙인다). 쓰는 곳: Claude는 웹 설정 › 사용량, GPT는 Codex 공식 안내.
  const passHtml = (p, now) => `<span class="ms-pass">초기화권\u00a0${p.count}장${p.until ? ` · ${esc(soon(p.until, now)).replace(/ /g, '\u00a0')}까지` : ''}</span>`;
  // claude.ai는 브라우저에 로그인된 계정의 사용량을 연다. 계정이 여럿이면 다른 계정 값을 넣기 쉬워 단추에 그 계정을 적는다.
  const passButton = (row, name) => (row.service === 'claude' ? `<button type="button" class="ms-button ms-button-small" data-subs="help" data-link="claude-usage" title="${esc(name)} 계정으로 로그인한 브라우저에서 열어 주세요">사용량 설정</button>` : '<button type="button" class="ms-button ms-button-small" data-subs="help" data-link="codex-resets">쓰는 법</button>');
  // 초기화권을 지금 쓸 때인지(막힌 줄 안내와 팁이 같은 기준을 쓴다).
  //  바로 쓸 계정·풀렸을 계정이 있으면 아껴 둔다 → 묶음에서 가장 먼저 풀리는 때가 하루 안이면 그때까지 기다린다 →
  //  못 읽은·다시 로그인할·확인 전 계정이 있으면 그 계정부터 본다 → 모든 계정이 막혔고 하루 넘게 남았을 때만 「지금」.
  function passPlan(g, now) {
    const first = g.out.filter(a => a.unblock).sort((x, y) => x.unblock - y.unblock)[0] || null;
    if (g.usable.length || g.projected.length) return { use: false, why: g.ready.some(a => a.state === 'ok') ? 'roomy' : g.projected.length ? 'projected' : 'low', first };
    if (first && first.unblock - now < PASS_WAIT) return { use: false, why: 'soon', first };
    if (g.error.length || g.login.length || g.pending.length) return { use: false, why: 'unread', first };
    return { use: true, why: 'all', first };
  }
  function passAdvice(g, a, now) {
    const plan = passPlan(g, now);
    if (plan.why === 'roomy') return '다른 계정이 넉넉해 아껴 둬도 돼요';
    if (plan.why === 'projected') return '다른 계정이 풀렸을 거예요 · 그 계정부터 써요';
    if (plan.why === 'low') return '다른 계정을 다 쓴 뒤에 써도 돼요';
    if (plan.why === 'soon') return `${after(plan.first.unblock - now)} ${plan.first.row.id === a.row.id ? '' : `${esc(plan.first.name)} 계정이 `}풀려서 아껴 둬도 돼요`;
    // 손볼 것 띠와 같은 낱말로: 다시 로그인 → 못 읽음 → 확인 전.
    if (plan.why === 'unread') return g.login.length ? '다시 로그인할 계정부터 확인해 보세요' : g.error.length ? '못 읽은 계정부터 확인해 보세요' : '확인 전 계정을 먼저 읽어 보세요';
    return '지금 쓰면 풀려요';
  }
  // 「곧 만료」 한 줄: 주간 초기화가 만료보다 먼저 오면 GPT는 지금 쓰면 그 초기화가 사라지고(공식), Claude는 그대로라 하루 안일 때만 초기화 뒤를 권한다.
  function expiryHint(g, a, now) {
    // 못 읽은·다시 로그인할 계정의 %는 옛 값이라 쓰지 않는다(직접 넣은 Claude 장수만 팁에 남는 경우).
    const stale = ['error', 'login'].includes(a.state), w = stale ? null : a.g?.weekly;
    const used = w ? 100 - w.left : null, reset = w?.resetsAt || null, until = a.pass.until;
    if (g.service === 'gpt') {
      if (reset && reset < until) return ` 그 전에 ${whenText(reset, now)}에 주간 초기화가 와요 · 지금 쓰면 그 초기화가 사라지니 초기화 뒤 많이 쓴 다음 만료 전에 써요.`;
      return used !== null && used >= 50 ? ` 지금 주간 ${used}% 썼어요 · 쓰면 쓴 만큼 다시 채워지고, 주간 초기화는 다시 쓰기 시작한 날부터 일주일쯤 뒤로 바뀌어요.` : ' 주간을 많이 쓴 뒤에 쓰면 가장 많이 채워져요 · 쓰면 주간 초기화 날짜가 바뀌어요.';
    }
    if (reset && reset < until && reset - now < PASS_WAIT) return ` 그 전에 ${whenText(reset, now)}에 주간 초기화가 와요 · 초기화 뒤 많이 쓴 다음 만료 전에 쓰면 더 많이 채워져요.`;
    return used !== null && used >= 50 ? ` 지금 주간 ${used}% 썼어요 · 지금 쓰면 쓴 만큼 다시 채워지고, 주간 초기화도 원래대로 와요.` : ' 주간을 많이 쓴 뒤에 쓰면 가장 많이 채워져요.';
  }
  function emptyCard() {
    const rows = snapshot?.rows || [];
    return `<div class="ms-empty"><h3>아직 연결한 계정이 없어요</h3><p>Claude · GPT · Gemini · Higgsfield · Typecast의 공식 프로그램이 이 PC에서만 사용량을 읽어요. 로그인 정보는 PC 밖으로 나가지 않아요.</p>${rows.length ? '<p class="ms-soft">직접 넣은 월 구독은 아래 「요금·결제일」에 모여요.</p>' : ''}<div class="ms-inline"><button type="button" class="ms-button ms-button-primary" data-subs="manage">계정 관리에서 연결</button></div></div>`;
  }
  function nowSection(now, groups, stale) {
    if (!groups.length) return section('01', '지금 쓸 계정', '', emptyCard());
    const note = stale ? `<span class="ms-stale-note"><i class="ms-led-warn" aria-hidden="true"></i>${stamp(snapshot.check.at, now)}에 읽은 값 · <button type="button" class="ms-link" data-subs="check" ${checkBusy() ? 'disabled' : ''}>지금 확인</button></span>` : '줄을 누르면 계정 전체가 보여요.';
    const missing = ORDER.filter(k => !groups.some(g => g.service === k));
    const more = missing.length ? `<div class="ms-svc-more">${esc(missing.map(k => AUTO[k].short).join(' · '))}도 연결할 수 있어요 <button type="button" class="ms-link" data-subs="manage">계정 관리</button></div>` : '';
    return section('01', '지금 쓸 계정', note, `<div class="ms-list">${groups.map(g => groupRow(g, now, stale)).join('')}${more}</div>`);
  }
  function nextLine(item, now) {
    const label = labelOf(item.row), name = nameOf(item.row);
    const what = item.type === 'unblock' ? `${esc(label)} · ${WINDOW_NAME[item.focus]} 한도${item.after !== null && item.after !== undefined ? ` · ${useText('주간', 100 - item.after)}` : ''}${item.pass ? ` · ${passHtml(item.pass, now)}` : ''}`
      : item.type === 'reset' ? `${esc(label)} · 주간 초기화` : item.type === 'pass' ? `${esc(label)} · 초기화권 ${item.count}장 만료` : `${esc(label)} · 결제${num(item.row.price) !== null ? ` ${esc(money(item.row.price, item.row.currency))}` : '일'}`;
    const time = item.type === 'bill' ? (item.days === 0 ? '오늘' : item.days === 1 ? '내일' : (d => `${d.getMonth() + 1}/${d.getDate()}`)(new Date(item.t))) : soon(item.t, now);
    const relText = item.type === 'bill' ? billWord(item.days) : after(item.t - now);
    return `<div class="ms-next-item is-${item.type} ${svcClass(item.row.source === 'auto' ? item.row.service : null)}"><span class="ms-next-time ms-num">${esc(time)}</span><span class="ms-next-rel">${esc(relText)}</span><span class="ms-next-who"><b>${esc(name)}</b> ${what}</span></div>`;
  }
  function nextSection(now, rows, checkAt) {
    const all = upcoming(rows, now, checkAt), unblocks = all.filter(i => i.type === 'unblock');
    if (!unblocks.length) return '';
    const list = ui.more ? all : unblocks.slice(0, 3);
    const more = all.length > Math.min(3, unblocks.length) ? `<button type="button" class="ms-more" data-subs="more" aria-expanded="${ui.more}">${ui.more ? '접기' : `앞으로 7일 일정 ${all.length}개 모두 보기`}</button>` : '';
    return section('02', '다음에 풀려요', ui.more ? '다 쓴 계정이 풀리는 때, 쓸 수 있는 계정의 주간 초기화, 7일 안 결제와 초기화권 만료를 날짜순으로 모았어요.' : '다 쓴 계정이 다시 열리는 때예요.', `<div class="ms-next">${list.map(item => nextLine(item, now)).join('')}</div>${more}`);
  }
  /* 지난 7일 사용량(10-19): 본체가 읽기 기록으로 센 구간 막대 + 그 전 평균과 비교 + 서비스 줄 아래 팁 한 줄 */
  const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  // 문장 안의 때: 오늘·내일·이번 주 요일·날짜. half면 시각 대신 오전/오후(「수요일 오후쯤」).
  function whenText(t, now, half = false) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const day = Math.round((new Date(t).setHours(0, 0, 0, 0) - start) / DAY_MS);
    const word = day === 0 ? '오늘' : day === 1 ? '내일' : day > 1 && day < 7 ? `${DAY[new Date(t).getDay()]}요일` : md(t);
    return `${word} ${half ? (new Date(t).getHours() < 12 ? '오전' : '오후') : hm(t)}`;
  }
  const usageValue = (kind, v) => (kind === 'pct' ? `${v}%` : credits(v, true));
  const baseLabel = u => (u.baseWeeks === 1 ? '그 전 7일' : `그 전 ${u.baseWeeks}주 평균`);
  const weightOf = row => (row.service === 'claude' ? CLAUDE_WEIGHT[planKey(row.plan)] || 1 : 1);
  /* 요금표(3차): 본체가 준 서비스별 공식 요금(확인한 날·출처·세금). 확인한 지 60일이 지나면 그 서비스의 금액·결제 주기를 말하지 않는다. */
  const dayAt = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null; };
  function priceTable(service, now) { const p = snapshot?.prices?.services?.[service], at = dayAt(p?.checked); return p?.plans && at !== null && now - at <= PRICE_FRESH ? { ...p, at } : null; }
  // 한국 결제 값: 요금표의 기본값(세전)에 한국 부가세(krVat)를 더한다 — claude.com이 한국에서 $20 → $22로 덧씌워 보이는 것과 같은 규칙(Fable 3차 시안 P2-4).
  const shown = (t, v) => Math.round(v * (1 + (t.krVat || 0)) * 100) / 100;
  // 요금제 하나의 한국 결제 값: month 월 결제 한 달, year 연간 결제 1년 치(없으면 연간 결제 없음).
  function planPrice(t, key) { const p = t?.plans?.[key]; return p ? { month: shown(t, p.month), year: p.year ? shown(t, p.year) : null } : null; }
  const taxWord = t => (t.krVat ? `한국 결제 · 부가세 ${Math.round(t.krVat * 100)}% 포함` : t.tax === 'included' ? '부가세 포함' : t.tax === 'excluded' ? '세금 별도' : '');
  const priceNote = t => `요금 확인 ${md(t.at)}${taxWord(t) ? `(${taxWord(t)})` : ''}`;
  // 요금표 값은 그대로(센트까지), 1년 치를 12로 나눈 「꼴」 값처럼 끝자리가 긴 값은 정수로(요금표 카드도 $220 → $18로 보인다).
  const dollars = v => money(Math.abs(v - Math.round(v * 100) / 100) < 1e-9 ? v : Math.round(v), 'USD');
  const dollarsOr = (v, currency) => (currency === 'USD' ? dollars(v) : money(v, currency));
  const round1000 = v => Math.round(v / 1000) * 1000;
  // 다음 충전: 기록의 지난 충전에서 Higgsfield는 30일씩(연간 결제는 30일마다), Typecast는 한 달씩. 기록이 없으면 Typecast만 결제일.
  function nextRefill(service, row, refillAt, now) {
    if (refillAt) { const d = new Date(refillAt); while (d.getTime() <= now) { if (service === 'typecast') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 30); } return d.getTime(); }
    const dd = service === 'typecast' ? nextBill(row.billDay, now) : null;
    return dd === null ? null : new Date(now).setHours(0, 0, 0, 0) + dd * DAY_MS;
  }
  // 크레딧: 지난 7일이 그 전 평균의 1.5배 그리고 300크레딧 이상. 예측은 잔액이 줄고 있는 계정 하나로(충전일이 계정마다 다르다).
  function spikeTip(g, u, now) {
    const s7 = u.bars?.[4]?.v, min = SPIKE_MIN[g.service] ?? 300;
    if (u.base === null || s7 === null || s7 === undefined || s7 < min || s7 < SPIKE_RATIO * u.base) return null;
    const stats = snapshot?.usage?.accounts || {}, tips = SAVE_TIPS[g.service] || { items: [] };
    const acc = g.accounts.filter(a => a.credits > 0 && stats[a.row.id]?.perDay > 0).sort((a, b) => stats[b.row.id].used7 - stats[a.row.id].used7)[0];
    let forecast = '', left = '', basis = '', at = now + 7 * DAY_MS;
    if (acc) {
      const st = stats[acc.row.id], emptyAt = now + (acc.credits / st.perDay) * DAY_MS, refill = nextRefill(g.service, acc.row, st.refillAt, now);
      if (refill ? emptyAt < refill : emptyAt - now <= 14 * DAY_MS) {
        // 충전일은 지난 충전에서 센 어림이라 「쯤」(월 결제는 같은 날짜, 연간 결제는 30일마다 — 공식).
        forecast = ` 이 속도면 ${esc(acc.name)} 계정이 <b class="ms-num">${md(emptyAt)}쯤</b> 바닥나요${refill ? ` · 다음 충전 ${md(refill)}쯤` : ''}.`;
        left = ` · ${esc(acc.name)} 남은 크레딧 ${credits(acc.credits, true)} · 하루 약 ${credits(st.perDay, true)}`;
        basis = st.refillAt ? ` · 다음 충전은 지난 충전(${md(st.refillAt)}) 기준` : refill ? ' · 다음 충전은 넣어 둔 결제일 기준' : '';
        at = emptyAt;
      }
    }
    const ratio = u.base > 0 ? `평소의 <b class="ms-num">${(Math.floor((s7 / u.base) * 10) / 10).toFixed(1)}배</b>` : '평소보다 많이';
    return {
      key: `spike:${g.service}`, link: tips.link, items: tips.items, at, kind: 'save',
      head: `${esc(g.label)}를 지난 7일 동안 ${ratio}(${credits(s7, true)}크레딧) 썼어요.${forecast}`,
      // 쓴 양은 읽은 잔액이 준 만큼이라(충전 팩이 만료돼 준 것도 들어간다) 기준 줄에 그렇게 적는다.
      why: [`지난 7일 ${credits(s7, true)} · ${baseLabel(u)} ${credits(u.base, true)}${left}`, `기준: 읽은 잔액이 준 만큼을 쓴 양으로 보고, ${baseLabel(u)}의 1.5배를 넘고 ${credits(min, true)}크레딧 이상일 때${basis}${tips.checked ? ` · 사실 확인 ${tips.checked}` : ''}`],
    };
  }
  // 한도형: 바로 쓸 계정 전부가 이 속도(최근 3일)면 가장 이른 풀리는 때보다 먼저 막힐 때만. 계정 하나가 막히는 건 01이 다음 계정을 권한다.
  function paceTip(g, now) {
    const stats = snapshot?.usage?.accounts || {}, live = g.usable.filter(a => a.g?.weekly);
    // 풀렸을 계정은 남은 양을 몰라서, 기록이 3일 안 된 계정이 있으면 속도를 몰라서 말하지 않는다.
    if (!live.length || g.projected.length || live.some(a => !Number.isFinite(stats[a.row.id]?.rate3))) return null;
    let left = 0, rate = 0, weight = 0;
    for (const a of live) { const w = weightOf(a.row); left += a.g.weekly.left * w; rate += stats[a.row.id].rate3 * w; weight += w; }
    const releases = [...live.map(a => a.g.weekly.resetsAt), ...g.out.map(a => a.unblock)].filter(Boolean);
    if (rate <= 0 || !releases.length) return null;
    const blockedAt = now + (left / rate) * DAY_MS, release = Math.min(...releases);
    if (blockedAt > release - PACE_MARGIN) return null;
    const many = g.accounts.length > 1;
    return {
      key: `pace:${g.service}`, link: null, items: [], at: blockedAt, kind: 'smooth',
      head: many ? `이 속도면 <b class="ms-num">${whenText(blockedAt, now, true)}쯤</b> ${esc(g.label)} 계정이 모두 막혀요. 가장 먼저 풀리는 건 ${whenText(release, now)}예요.` : `이 속도면 <b class="ms-num">${whenText(blockedAt, now, true)}쯤</b> 주간 한도를 다 써요. 초기화는 ${whenText(release, now)}예요.`,
      why: [`바로 쓸 ${many ? `계정 ${live.length}개` : '계정'}의 주간 한도 ${100 - Math.round(left / weight)}% 사용 · 최근 3일 하루 평균 ${Math.round(rate / weight)}%p씩`, '기준: 이 속도로 다 막히는 때가 가장 이른 풀리는 때보다 앞설 때(최근 3일 기록)'],
    };
  }
  // 초기화권 팁: ① 모든 계정이 막혔고 가장 먼저 풀리는 때가 하루 넘게 남았으면 「쓰면 지금 풀려요」(먼저 만료되는 것부터, passPlan과 같은 기준)
  // ② 아니면 만료가 3일 안인 것을 「만료 전에」. 못 읽은·다시 로그인할 GPT 계정의 옛 값은 그사이 썼을 수 있어 팁에 쓰지 않는다.
  function passTip(g, now) {
    const info = PASS_TIPS[g.service], holders = info ? g.accounts.filter(a => a.pass && (a.pass.manual || !['error', 'login'].includes(a.state))) : [];
    if (!holders.length) return null;
    const base = { key: `pass:${g.service}`, link: info.link, open: info.open, items: info.items }, many = g.accounts.length > 1, plan = passPlan(g, now);
    const blocked = holders.filter(a => a.state === 'out').sort((x, y) => (x.pass.until ?? Infinity) - (y.pass.until ?? Infinity));
    if (plan.use && blocked.length) {
      const a = blocked[0], total = holders.reduce((sum, h) => sum + h.pass.count, 0), release = plan.first?.unblock || null;
      const when = release ? ` ${many ? '가장 먼저 풀리는 건' : '초기화는'} <b class="ms-num">${whenText(release, now)}</b>예요.` : '';
      return {
        ...base, at: now, kind: 'smooth',
        head: `${many ? `${esc(g.label)} 계정이 모두 막혔어요.` : `${esc(g.label)} 한도를 다 썼어요.`}${when} ${many ? `<b>${esc(a.name)}</b> 계정의 ` : ''}초기화권을 쓰면 지금 풀려요.`,
        why: [`초기화권 ${total}장${a.pass.until ? ` · ${many ? `${esc(a.name)} 것은 ` : ''}${whenText(a.pass.until, now)}까지` : ''}${release ? ` · 가장 먼저 풀리기까지 ${rel(release - now)}` : ''}`, `기준: 모든 계정이 막혔고 가장 먼저 풀리는 때가 하루 넘게 남았을 때 · 사실 확인 ${info.checked}`],
      };
    }
    const soonest = holders.filter(a => a.pass.until && a.pass.until - now <= PASS_SOON).sort((x, y) => x.pass.until - y.pass.until)[0];
    if (!soonest) return null;
    return {
      ...base, at: soonest.pass.until, kind: 'save',
      head: `${many ? `<b>${esc(soonest.name)}</b> 계정의 ` : `${esc(g.label)} `}초기화권이 <b class="ms-num">${whenText(soonest.pass.until, now)}</b>에 만료돼요.${expiryHint(g, soonest, now)}`,
      why: [`초기화권 ${soonest.pass.count}장 · 만료까지 ${rel(soonest.pass.until - now)}${soonest.pass.manual ? ' · 직접 넣은 값' : ''}`, `기준: 만료까지 3일 안 · 사실 확인 ${info.checked}`],
    };
  }
  // 두 팁은 4주 소비를 다 알 때만 말한다: 지금 읽히는 자동 연결 계정이고, 4주를 처음부터 덮었고, 놓친 틈이 없고, 7일마다 읽은 적이 있을 때
  // (못 읽은 주를 「안 썼다」로 세지 않게 — Fable 2차 검수 P1-2).
  const fourKnown = (a, w4) => a.row.source === 'auto' && a.row.state === 'ok' && !!w4?.cover && !!w4.known && w4.weeks.every(w => w.reads > 0);
  // 요금제 맞추기(Claude, 2차): 주간이 4주 모두 기준 이하이고 읽은 5시간 % 최고도 낮춘 요금제에 들어가는 Max 계정을 한 단계 아래로.
  // 덜 내는 액수가 큰 계정부터. 7일마다 「쓴 양」과 「읽은 가장 높은 주간 %」 가운데 큰 값을 본다(값은 지금 요금제 기준).
  function sizeTip(g, now) {
    if (g.service !== 'claude') return null;
    const stats = snapshot?.usage?.accounts || {}, table = priceTable('claude', now), month = k => planPrice(table, k)?.month ?? null;
    const fits = g.accounts.map(a => {
      const plan = planKey(a.row.plan), rule = SIZE_DOWN[plan], w4 = stats[a.row.id]?.weeks4;
      if (!rule || !fourKnown(a, w4) || !w4.hCover || w4.hPeak === null || w4.hPeak >= rule.h5) return null;
      const highs = w4.weeks.map(w => Math.max(w.used, w.peak ?? 0));
      return highs.some(v => v > rule.limit) ? null : { a, rule, highs, hPeak: w4.hPeak, weight: CLAUDE_WEIGHT[plan], saving: month(plan) !== null && month(rule.to) !== null ? month(plan) - month(rule.to) : null };
    }).filter(Boolean).sort((x, y) => (y.saving ?? -1) - (x.saving ?? -1) || y.weight - x.weight);
    const f = fits[0];
    if (!f) return null;
    // 낮출지는 다음 결제 전에 정해야 하니 결제일을 넣어 둔 계정이면 그날 기준으로 줄을 세운다.
    // 모르면 열흘 뒤 — 몇 주씩 맞는 팁이라 기한이 있는 팁(결제 5일 안·만료 3일 안)을 먼저 보이고 그 뒤에 선다.
    const dd = nextBill(f.a.row.billDay, now), at = dd === null ? now + 10 * DAY_MS : new Date(now).setHours(0, 0, 0, 0) + dd * DAY_MS;
    const from = planName(f.a.row.plan), to = planName(f.rule.to), hp = Math.round(f.hPeak);
    // 공식 배수는 5시간 창 기준이고 주간 배수는 공식 자료에 없다(Fable 2차 P2-1). 결제 주기도 금액과 같이 60일이 지나면 말하지 않는다(P3-1) —
    // 둘 다 요금표에서: 연간 결제가 있는 Pro는 그 값으로, 연간 결제가 없는 Max는 「월 결제만」.
    const pro = planPrice(table, 'pro'), maxMonthly = table && !table.plans.max5x?.year && !table.plans.max20x?.year;
    const items = [
      `${to}는 5시간마다 쓸 수 있는 양이 ${from}의 ${f.rule.part}이에요(공식 배수 ${f.rule.basis}). 한 번에 길게 쓰는 날이 있으면 그날 막힐 수 있어요.`,
      `주간 한도가 얼마나 줄어드는지는 공식 자료에 없어요. 그래서 4주 모두 ${f.rule.limit}% 이하일 때만 알려 드려요.`,
      f.rule.to === 'pro' ? (pro?.year ? `Pro는 연간 결제로 내면 한 달 ${dollars(pro.year / 12)}꼴이에요(1년 치 ${dollars(pro.year)} 한 번에).` : null) : maxMonthly ? 'Max 요금제는 월 결제만 있어요.' : null,
    ].filter(Boolean);
    return {
      key: 'size:claude', link: 'claude-plans', items, at, kind: 'save',
      head: `<b>${esc(f.a.name)}</b> 계정(${esc(from)})은 4주 내내 주간 한도를 ${f.rule.limit}%도 안 썼어요. ${esc(to)}로 낮춰도 넉넉할 가능성이 커요${f.saving ? ` · 공식 요금으로 한 달 ${dollars(f.saving)} 덜 내요` : ''}.`,
      why: [`지난 4주 7일씩 ${f.highs.map(v => `${Math.round(v)}%`).join(' · ')} · 읽은 5시간 창 최고 ${hp}%(${esc(to)}로 치면 ${hp * f.rule.times}%)`, `기준: 4주 모두 ${f.rule.limit}% 이하이고 읽을 때마다 5시간 창이 ${f.rule.h5}% 미만이었을 때${table ? ` · ${priceNote(table)}` : ''}`],
    };
  }
  // 안 쓰는 구독(2차): Claude와 크레딧형만. 4주 모두 5% 이하(크레딧은 4주 동안 0)이고 넣어 둔 결제일이 5일 안일 때 「계속 쓸지 정해 보세요」.
  // 결제일이 가까운 것부터. 결제일 당일은 이미 결제됐을 수 있어 「결제 전에」라고 하지 않는다(Fable 2차 P3-3).
  function idleTip(g, now) {
    const credit = g.kind === 'credit';
    if (!credit && g.service !== 'claude') return null;
    const stats = snapshot?.usage?.accounts || {};
    const found = g.accounts.map(a => {
      const w4 = stats[a.row.id]?.weeks4, dd = nextBill(a.row.billDay, now);
      // 연간 결제로 표시한 계정(3차)은 달마다 오는 결제일이 아니라 1년에 한 번이라 「결제 전에」를 말하지 않는다.
      if (a.row.cycle === 'annual' || !fourKnown(a, w4) || dd === null || dd > IDLE_BILL_DAYS) return null;
      const highs = w4.weeks.map(w => (credit ? w.used : Math.max(w.used, w.peak ?? 0)));
      return (credit ? highs.some(v => v > 0) : highs.some(v => v > IDLE_LIMIT)) ? null : { a, dd, highs };
    }).filter(Boolean).sort((x, y) => x.dd - y.dd);
    const f = found[0];
    if (!f) return null;
    const billAt = new Date(now).setHours(0, 0, 0, 0) + f.dd * DAY_MS, when = f.dd === 1 ? '내일' : md(billAt);
    const price = num(f.a.row.price) !== null ? `(${money(f.a.row.price, f.a.row.currency)})` : '', unit = g.service === 'typecast' ? '키는' : '계정은';
    return {
      key: `idle:${g.service}`, link: null, items: [], at: billAt, kind: 'save',
      head: `<b>${esc(f.a.name)}</b> ${unit} 4주 동안 ${credit ? '크레딧을 쓰지 않았어요' : '주간 한도를 5%도 안 썼어요'}. ${f.dd === 0 ? `오늘이 결제일${esc(price)}이에요. 계속 쓸지 정해 보세요.` : `${when} 결제${esc(price)} 전에 계속 쓸지 정해 보세요.`}`,
      why: [`지난 4주 7일씩 ${f.highs.map(v => (credit ? `${credits(v, true)}크레딧` : `${Math.round(v)}%`)).join(' · ')}`, `기준: 4주 모두 ${credit ? '쓴 크레딧이 없고' : '5% 이하이고'} 결제일이 5일 안일 때 · 결제일은 넣어 둔 값`],
    };
  }
  function tipHtml(t) {
    const open = ui.tipOpen.has(t.key), done = ui.tipDone[t.key], shown = open || !!done;
    const more = `${t.open ? `<button type="button" class="ms-link ms-tip-more" data-subs="help" data-link="${t.open}">사용량 설정 열기</button>` : ''}${t.link ? `<button type="button" class="ms-link ms-tip-more" data-subs="help" data-link="${t.link}">공식 안내</button>` : ''}`;
    const rest = Number(snapshot?.settings?.tips?.[t.key]?.stops) > 1 ? '12주' : '4주';
    // 연간 결제 팁(3차)은 이미 연간으로 내는 계정이면 그 계정에 다시 말하지 않게 「이미 연간이에요」를 둔다.
    const yearly = t.cycleId ? `<button type="button" class="ms-button ms-button-small" data-subs="cycle" data-id="${esc(t.cycleId)}" data-cycle="annual">이미 연간이에요</button>` : '';
    const actions = done
      ? `<div class="ms-tip-actions"><p class="ms-tip-done">${done === 'helpful' ? '고마워요 · 이런 팁은 7일에 한 번만 보여 드려요' : `알겠어요 · 이 종류는 ${rest} 동안 쉬어요(칸 아래 「다시 보기」로 되돌릴 수 있어요)`}</p>${more}</div>`
      : `<div class="ms-tip-actions"><button type="button" class="ms-button ms-button-small" data-subs="tip" data-key="${t.key}" data-act="helpful">도움 됐어요</button><button type="button" class="ms-button ms-button-small" data-subs="tip" data-key="${t.key}" data-act="stop">이런 팁 그만</button>${yearly}${more}</div>`;
    const body = shown ? `<div class="ms-tip-body">${t.items.length ? `<ol>${t.items.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}<p class="ms-tip-why"><b>왜 이 팁?</b> ${t.why.join('<br>')}</p>${actions}</div>` : '';
    return `<div class="ms-tip${shown ? ' is-open' : ''}"><span class="ms-tip-head">${t.head}</span><button type="button" class="ms-link" data-subs="tip-open" data-key="${t.key}" aria-expanded="${shown}">${shown ? '접기' : '자세히'}</button>${body}</div>`;
  }
  function usageRow(g, now, tip) {
    const usage = snapshot?.usage || {}, u = usage.services?.[g.service] || null, kind = g.kind === 'credit' ? 'credit' : 'pct', buckets = usage.buckets || [];
    const bars = Array.from({ length: 5 }, (_, i) => u?.bars?.[i] || null);
    const max = kind === 'pct' ? 100 : Math.max(1, ...bars.map(b => b?.v || 0));
    const label = i => (i === 4 ? '지난 7일' : buckets[i] ? `~${md(buckets[i].end)}` : '');
    const height = b => (b ? Math.min(100, Math.max(b.v > 0 ? 3 : 0, Math.round((b.v / max) * 100))) : 0);
    const barHtml = bars.map((b, i) => `<span class="mu-week${i === 4 ? ' is-last' : ''}${b?.partial ? ' is-partial' : ''}"${b?.partial ? ' title="이 구간 중간부터 기록이 있어요"' : ''}><em>${b ? usageValue(kind, b.v) : '&nbsp;'}</em><span class="mu-bar${kind === 'credit' ? ' is-credit' : ''}${b ? '' : ' is-empty'}${b?.partial ? ' is-partial' : ''}"><i style="height:${height(b)}%" data-level="${kind === 'pct' && b && b.v >= 90 ? 'low' : 'ok'}"></i></span><small>${label(i)}</small></span>`).join('');
    const has = !!u && u.base !== null && !!bars[4], diff = has ? bars[4].v - u.base : 0;
    const cmp = has
      ? `<span class="mu-cmp"><span>${baseLabel(u)} ${usageValue(kind, u.base)}</span><b class="ms-num">${diff >= 0 ? '+' : '−'}${kind === 'pct' ? `${Math.abs(diff)}%p` : credits(Math.abs(diff), true)}</b></span>`
      : `<span class="mu-cmp is-empty"><span>기록 모으는 중</span><span>${md(u?.since || now)}부터</span></span>`;
    const why = u?.mixed && bars.some(Boolean) ? `<button type="button" class="ms-link mu-why" data-subs="why" aria-expanded="${ui.why}">왜 이 숫자?</button>` : '';
    const whyNote = why && ui.why ? '<p class="mu-why-note">요금제가 다른 계정은 한도 크기만큼 무게를 줘서 합쳤어요. Max 20x는 Max 5x의 4배, Pro의 20배로 쳐요. 요금제를 바꾼 계정은 바꾸기 전 구간을 그때 요금제로 쳐요.</p>' : '';
    const sr = `${g.label} 지난 7일 ${bars[4] ? `${usageValue(kind, bars[4].v)}${bars[4].partial ? '(일부)' : ''}` : '기록 없음'}${has ? `, ${baseLabel(u)} ${usageValue(kind, u.base)}` : ''}`;
    return `<div class="mu-row ${svcClass(g.service)}"><span class="ms-sr">${esc(sr)}</span><span class="mu-who"><span class="ms-tag">${esc(g.label)}</span><span class="mu-meta"><small>${g.service === 'typecast' ? '키' : '계정'} ${g.accounts.length}개 · ${USAGE_UNIT[g.service]}</small>${why}</span>${whyNote}</span>`
      + `<span class="mu-weeks" aria-hidden="true">${barHtml}<span class="mu-axis"><span>${buckets[0] ? `${md(buckets[0].start)}부터` : ''}</span><span>지난 7일</span></span></span>${cmp}${tip ? tipHtml(tip) : ''}</div>`;
  }
  // 칸 번호는 앞 칸이 있는 만큼 센다(다음에 풀려요가 없으면 02). 팁은 서비스 줄마다 하나, 칸 전체에 급한 것(일이 먼저 닥치는 것)부터 둘까지.
  // 쉬고 있는 팁이 있으면 칸 아래 「다시 보기」 한 줄(잘못 누른 「그만」을 되돌리는 길).
  function usageSection(now, groups, number) {
    if (!snapshot?.usage) return '';
    const list = groups.filter(g => g.service && USAGE_UNIT[g.service]);
    if (!list.length) return '';
    const resting = key => (Number(snapshot.settings?.tips?.[key]?.until) || 0) > now && !ui.tipDone[key];
    const settings = snapshot.settings || {}, goal = GOALS.some(([k]) => k === settings.goal) ? settings.goal : null, off = settings.tipsOff === true;
    // 목표에 맞는 갈래(kind)를 먼저, 그다음 일이 먼저 닥치는 순서.
    const rank = t => ((goal === 'save' && t.kind === 'save') || (goal === 'smooth' && t.kind === 'smooth') ? 0 : 1);
    const order = (a, b) => rank(a) - rank(b) || a.at - b.at;
    // 서비스마다 사용량·초기화권·요금제 맞추기·안 쓰는 구독 팁 가운데 쉬지 않는 것 중 하나(초기화권 팁은 기록이 없어도 뜬다).
    // 「막힘 없이 쓰기」를 고르면 요금제를 낮추자는 팁은 내지 않는다.
    const pick = g => { const u = snapshot.usage.services?.[g.service]; return [u ? (g.kind === 'credit' ? spikeTip(g, u, now) : paceTip(g, now)) : null, passTip(g, now), goal === 'smooth' ? null : sizeTip(g, now), idleTip(g, now)].filter(t => t && !resting(t.key)).sort(order)[0] || null; };
    const candidates = off ? [] : list.map(g => { const tip = pick(g); return tip ? { service: g.service, tip } : null; }).filter(Boolean)
      .sort((a, b) => order(a.tip, b.tip)).slice(0, MAX_TIPS);
    const tips = new Map(candidates.map(c => [c.service, c.tip]));
    // 「다시 보기」 줄은 방금 「그만」을 누른 팁도 센다(누른 뒤 한 줄이 칸 아래 「다시 보기」를 가리킨다). 팁을 껐으면 「다시 켜기」 한 줄만.
    const rest = Object.keys(settings.tips || {}).filter(key => (Number(settings.tips[key]?.until) || 0) > now).length;
    const restLine = !off && rest ? `<p class="mu-rest">쉬고 있는 팁 ${rest}개 · <button type="button" class="ms-link" data-subs="tip-reset">다시 보기</button></p>` : '';
    // 목표 묻기(2차): 고르기 전에는 칸 아래 한 줄 카드, 고른 뒤에는 「팁: 아끼기 쪽 · 바꾸기 · 팁 끄기」.
    const asking = !off && (!goal || ui.goalOpen);
    const goalCard = asking ? `<div class="mu-goal"><div class="mu-goal-text"><b>팁을 어느 쪽으로 드릴까요?</b><span>고르신 쪽 팁을 먼저 드려요. 언제든 바꿀 수 있어요.</span></div><div class="mu-goal-options">${GOALS.map(([k, label]) => `<button type="button" class="ms-button ms-button-small${goal === k ? ' is-on' : ''}" data-subs="goal" data-goal="${k}" aria-pressed="${goal === k}">${label}</button>`).join('')}</div></div>` : '';
    const goalName = GOALS.find(([k]) => k === goal)?.[2];
    const goalLine = off
      ? '<p class="mu-goal-line">팁을 꺼 두었어요 · <button type="button" class="ms-link" data-subs="tips-on">다시 켜기</button></p>'
      : `<p class="mu-goal-line">${goalName && !asking ? `팁: ${esc(goalName)} · <button type="button" class="ms-link" data-subs="goal-change">바꾸기</button> · ` : ''}<button type="button" class="ms-link" data-subs="tips-off">팁 끄기</button></p>`;
    return section(number, '지난 7일 사용량', '계정을 합친 양이에요. 앱이 꺼져 있던 시간은 빠져요.', `<div class="mu-list">${list.map(g => usageRow(g, now, tips.get(g.service))).join('')}</div>${goalCard}${restLine}${goalLine}`, 'ms-usage');
  }
  /* 한 달 요약(3차, Fable 1차 아이디어 6) */
  // 요금을 넣지 않은 자동 연결 계정의 공식 한 달 요금(한국 결제 값, 확인한 지 60일 안, 연간으로 표시한 계정은 1년 치의 12분의 1). 모르면 null.
  // 한 달 요약·요금 합계·결제 목록·입구 글이 모두 이 한 기준을 쓴다(넣은 값이 늘 먼저, 값마다 「공식 요금」·「넣은 요금」을 붙인다).
  // 마지막으로 읽은 지 30일이 넘은 채 못 읽히는 줄(구독을 끊고 로그인만 남았을 수 있다)은 채우지 않는다(Fable 3차 시안 P3-1).
  function officialPrice(row, now) {
    if (row.source !== 'auto' || num(row.price) !== null) return null;
    if (row.state !== 'ok' && now - (row.live?.readAt || 0) > 30 * DAY_MS) return null;
    const table = priceTable(row.service, now), plan = planPrice(table, planKey(row.plan));
    return plan ? { price: row.cycle === 'annual' && plan.year ? plan.year / 12 : plan.month, currency: table.currency, table } : null;
  }
  const costOf = (rows, now) => costSummary(rows, now, snapshot?.settings?.usdKrw, row => officialPrice(row, now));
  // 계정 하나의 한 달 요금(원으로 어림): 넣은 값, 없으면 공식 요금. 모르면 null.
  function monthPrice(row, now) {
    const rate = Number(snapshot?.settings?.usdKrw) || 1400, won = (v, currency) => (currency === 'USD' ? v * rate : v);
    if (num(row.price) !== null) return { krw: won(Number(row.price), row.currency), official: false };
    const o = officialPrice(row, now);
    return o ? { krw: won(o.price, o.currency), official: true, table: o.table } : null;
  }
  // 크레딧형 한 달 크레딧: Typecast는 API가 알려 준 이번 요금제 크레딧, 없으면 요금표. 요금제 사실이라 60일 문 밖이다(금액·결제 주기만 문 안 — Fable 3차 시안 P2-1).
  // Higgsfield Ultra는 CLI가 등급(3,000·6,000·9,000)을 알려 주지 않아 가장 작은 3,000으로 둔다(큰 등급이면 쓴 몫이 크게 잡혀 여유를 부풀리지 않는 쪽).
  function monthCredits(row) { const own = num(row.live?.planCredits); return own > 0 ? { credits: own, own: true } : (c => (c ? { credits: c, own: false } : null))(snapshot?.prices?.services?.[row.service]?.plans?.[planKey(row.plan)]?.credits); }
  const ultraGuess = (row, allot) => row.service === 'higgsfield' && planKey(row.plan) === 'ultra' && allot && !allot.own;
  // 넣는 계정: 4주 소비를 다 아는(fourKnown) Claude(대화·Claude Code가 한 한도)와 크레딧형 자동 연결 계정. GPT·Gemini의 %는 Codex·Antigravity 한도라 구독 전체를 말하지 못해 뺀다.
  // 쓴 몫: Claude는 7일마다 「쓴 양」과 「읽은 가장 높은 주간 %」 가운데 큰 값의 4주 평균(적게 잡지 않게 — 2차 안 쓰는 구독과 같은 잣대),
  // 크레딧형은 4주 동안 쓴 크레딧 ÷ 4주치 한 달 크레딧(한 달 = 365.25/12일). 100%를 넘으면 100%로 본다. 공식 요금이 $0인 무료 요금제는 구독이 아니라 뺀다.
  // 빠지는 까닭은 따로 센다: waiting(4주 기록이 모자람), noCredits(한 달 크레딧을 모름).
  function monthSummary(rows, now) {
    const stats = snapshot?.usage?.accounts || {}, items = [];
    let waiting = 0, noCredits = 0, since = null, fresh = false;
    for (const row of rows) {
      if (row.source !== 'auto' || !(row.service === 'claude' || row.kind === 'credit') || !Object.hasOwn(AUTO, row.service)) continue;
      const st = stats[row.id], w4 = st?.weeks4, allot = row.kind === 'credit' ? monthCredits(row) : null, price = monthPrice(row, now);
      if (price && price.official && price.krw === 0) continue;
      if (!fourKnown({ row }, w4)) { waiting++; if (st?.since) since = since === null ? st.since : Math.min(since, st.since); else fresh = true; continue; }
      if (row.kind === 'credit' && !allot) { noCredits++; continue; }
      const share = row.kind === 'credit' ? w4.weeks.reduce((n, w) => n + w.used, 0) / ((allot.credits * 28) / MONTH_DAYS) : w4.weeks.reduce((n, w) => n + Math.max(w.used, w.peak ?? 0), 0) / 400;
      items.push({ row, share: Math.min(1, Math.max(0, share)), price, guess: ultraGuess(row, allot) });
    }
    if (!items.length) return waiting || noCredits ? { items, waiting, noCredits, since, fresh } : null;
    // 금액은 요금을 아는 계정끼리만 더한다. 하나도 없으면(요금표가 오래됐고 넣은 요금도 없음) %만 말한다.
    const priced = items.filter(i => i.price), total = priced.reduce((n, i) => n + i.price.krw, 0), worth = priced.reduce((n, i) => n + i.price.krw * i.share, 0);
    const pct = total > 0 ? Math.round((worth / total) * 100) : Math.round((items.reduce((n, i) => n + i.share, 0) / items.length) * 100);
    const room = [...items].sort((a, b) => a.share - b.share || (b.price?.krw ?? 0) - (a.price?.krw ?? 0))[0];
    return { items, waiting, noCredits, since, priced, total, worth, pct, room: (1 - room.share) * 100 >= ROOM_LINE ? room : null };
  }
  const summaryOn = () => snapshot?.settings?.summaryOff !== true;
  function summaryCard(now, rows) {
    const s = monthSummary(rows, now);
    if (!s) return '';
    if (!summaryOn()) return '<p class="ms-sum-off">한 달 요약을 꺼 두었어요 · <button type="button" class="ms-link" data-subs="summary-on">다시 켜기</button></p>';
    const top = '<div class="ms-sum-top"><b>한 달 요약</b><span>지난 4주</span></div>';
    // 셈할 계정이 없을 때 까닭을 그대로: 첫 기록에서 4주 뒤 날짜(「쯤」), 기록이 아직 없으면 첫 기록부터 4주 뒤, 그 날이 지났으면 읽지 못한 주,
    // 한 달 크레딧을 몰라서면 그렇게(기록 탓으로 말하지 않는다 — Fable 3차 시안 P2-1).
    if (!s.items.length) {
      const at = s.since ? s.since + 28 * DAY_MS : null;
      const why = s.waiting ? (at && at > now ? `계정마다 기록이 4주 쌓이면 보여 드려요 · <span class="ms-num">${md(at)}</span>쯤부터` : s.fresh && !s.since ? '첫 기록부터 4주 뒤에 보여 드려요.' : '4주 동안 매주 읽은 기록이 있어야 셈할 수 있어요. 앱을 켜 두면 기록이 이어져요.') : '요금제의 한 달 크레딧을 알 수 없어 셈하지 못했어요.';
      return `<div class="ms-sum is-wait">${top}<p class="ms-sum-sub">${why}</p></div>`;
    }
    const money4 = s.total > 0;
    // 합계는 원 단위 그대로(아래 「한 달 구독료」와 같은 수), 쓴 만큼은 어림이라 천 원 단위(Fable 3차 시안 P3-5).
    const big = money4 ? `쓴 만큼으로 치면 <b class="ms-num">약 ${money(round1000(s.worth), 'KRW')}</b>어치예요` : `쓴 만큼으로 치면 평균 <b class="ms-num">${s.pct}%</b>예요`;
    const sub = money4 ? `구독료 약 ${money(s.total, 'KRW')} 중 ${s.pct}% · 쓴 몫을 아는 계정 ${s.priced.length}개 기준` : `쓴 몫을 아는 계정 ${s.items.length}개 기준 · 요금을 넣으면 금액으로도 셈해요`;
    const plan = row => planName(row.plan), who = row => `<b>${esc(nameOf(row))}</b> 계정(${esc(labelOf(row))}${plan(row) ? ` ${esc(plan(row))}` : ''})`;
    const room = s.room ? `<p class="ms-sum-room">가장 여유가 많았던 건 ${who(s.room.row)}이에요 · 쓴 만큼 ${Math.round(s.room.share * 100)}%</p>` : '';
    // 계정별: 쓴 몫이 작은(여유가 많은) 계정부터. 막대는 서비스 색 — 노랑·빨강 없이. 휴대폰에서도 「공식」·「넣은」 출처 낱말은 남긴다(P3-6).
    const list = ui.sumOpen ? `<div class="ms-sum-list">${[...s.items].sort((a, b) => a.share - b.share || (b.price?.krw ?? 0) - (a.price?.krw ?? 0)).map(i => {
      const p = Math.round(i.share * 100);
      const amount = i.price ? `<span class="ms-sum-amt"><b class="ms-num">약 ${money(round1000(i.price.krw * i.share), 'KRW')}</b><small><span class="ms-sum-of">${money(round1000(i.price.krw), 'KRW')} 중 · </span>${i.price.official ? '공식 요금' : '넣은 요금'}</small></span>` : '<span class="ms-sum-amt"><small>요금 모름</small></span>';
      // 이름만 말줄임하고 요금제 글자는 끝까지 보인다(휴대폰에서 「Max 2」로 잘리지 않게 — 구현 검수 P3-D).
      return `<div class="ms-sum-row ${svcClass(i.row.service)}"><span class="ms-tag">${esc(labelOf(i.row))}</span><span class="ms-sum-name"><span class="ms-sum-who">${esc(nameOf(i.row))}</span>${plan(i.row) ? `<small>${esc(plan(i.row))}</small>` : ''}</span><span class="ms-sum-bar" aria-hidden="true"><i style="width:${p}%"></i></span><span class="ms-sum-pct ms-num">${p}%</span>${amount}</div>`;
    }).join('')}</div>` : '';
    const tables = [...new Set(s.priced.filter(i => i.price.official).map(i => i.row.service))].map(k => ({ k, t: priceTable(k, now) })).filter(x => x.t);
    const rate = Number(snapshot?.settings?.usdKrw) || 1400;
    const why = ui.sumWhy ? `<p class="ms-sum-why">${[
      'Claude는 7일마다 쓴 주간 %(그 주에 읽은 가장 높은 %와 견줘 큰 쪽)의 4주 평균, 크레딧은 4주 동안 쓴 크레딧을 4주치 한 달 크레딧과 견줬어요. 적게 잡지 않는 쪽으로 셈해요.',
      tables.length ? `요금을 넣지 않은 계정은 공식 요금으로 쳤어요(${tables.map(x => `${AUTO[x.k].short} ${priceNote(x.t)}`).join(' · ')}).` : '',
      money4 && s.priced.some(i => i.price.official || i.row.currency === 'USD') ? `달러는 1달러 = ${rate.toLocaleString('ko-KR')}원으로 셈했어요.` : '',
      s.items.some(i => i.guess) ? 'Higgsfield Ultra는 등급을 몰라 가장 작은 3,000크레딧 등급으로 쳤어요(큰 등급이면 쓴 몫이 실제보다 크게 잡혀요).' : '',
      'GPT·Gemini는 Codex·Antigravity 한도만 읽혀 구독 전체를 말할 수 없어 뺐어요.',
      s.waiting ? `4주 기록이 모자란 계정 ${s.waiting}개도 뺐어요.` : '',
      s.noCredits ? `한 달 크레딧을 모르는 계정 ${s.noCredits}개도 뺐어요.` : '',
      s.items.length > s.priced.length && money4 ? `요금을 모르는 계정 ${s.items.length - s.priced.length}개는 금액에서 뺐어요.` : '',
    ].filter(Boolean).join('<br>')}</p>` : '';
    return `<div class="ms-sum">${top}<p class="ms-sum-big">${big}</p><p class="ms-sum-sub">${sub}</p><span class="ms-sum-meter" aria-hidden="true"><i style="width:${s.pct}%"></i></span>${room}`
      + `<div class="ms-sum-actions"><button type="button" class="ms-link" data-subs="sum-open" aria-expanded="${ui.sumOpen}">${ui.sumOpen ? '계정별 접기' : '계정별로 보기'}</button><button type="button" class="ms-link" data-subs="sum-why" aria-expanded="${ui.sumWhy}">왜 이 숫자?</button><button type="button" class="ms-link" data-subs="summary-off">요약 끄기</button></div>${list}${why}</div>`;
  }

  /* 연간 결제·할인 시기(3차, Fable 1차 아이디어 7) */
  // 서비스마다 12주 내내 꾸준히 쓴 계정 하나(1년에 덜 내는 액수가 큰 계정부터). 요금표가 60일 안이고 그 요금제에 연간 결제가 있어야 한다.
  //  Claude: 4주씩 주간 한도를 평균 40% 넘게(쓴 양만, 한 주는 100%까지 — 놓친 틈은 적게 잡혀 「많이 썼다」를 부풀리지 않는다). Higgsfield: 4주씩 한 달 크레딧의 50% 넘게.
  //  12주 동안 요금제를 바꾼 계정(옛 구간이 지금 무게로 부풀어 보임), 이미 연간으로 표시한 계정, 지금 읽히지 않는 계정은 뺀다.
  //  Typecast API·GPT 개인·Gemini는 확인한 연간 결제가 없어 말하지 않는다.
  function annualTips(rows, now) {
    const stats = snapshot?.usage?.accounts || {}, tips = [];
    for (const service of ['claude', 'higgsfield']) {
      const table = priceTable(service, now);
      if (!table) continue;
      const fits = rows.filter(r => r.source === 'auto' && r.service === service && r.state === 'ok' && r.cycle !== 'annual').map(row => {
        const plan = planPrice(table, planKey(row.plan)), w12 = stats[row.id]?.weeks12, saving = plan?.year ? Math.round((plan.month * 12 - plan.year) * 100) / 100 : 0;
        if (saving <= 0 || !w12?.cover || w12.samePlan === false || w12.weeks?.length !== 12 || w12.weeks.some(w => !w.reads)) return null;
        const allot = service === 'claude' ? null : monthCredits(row);
        const blocks = [0, 4, 8].map(i => w12.weeks.slice(i, i + 4).reduce((n, w) => n + (service === 'claude' ? Math.min(100, w.used) : w.used), 0));
        const steady = service === 'claude' ? blocks.every(v => v / 4 > ANNUAL_PCT) : !!allot && blocks.every(v => v > (ANNUAL_CREDIT * allot.credits * 28) / MONTH_DAYS);
        return steady ? { row, plan, blocks, allot, saving } : null;
      }).filter(Boolean).sort((x, y) => y.saving - x.saving || y.blocks.reduce((a, b) => a + b, 0) - x.blocks.reduce((a, b) => a + b, 0));
      const f = fits[0];
      if (!f) continue;
      const name = esc(nameOf(f.row)), plan = esc(planName(f.row.plan));
      // 할인 시기: 요금표에 날짜·출처가 있고 확인한 지 60일 안인 할인이 45일 안에 시작하거나 진행 중일 때만(그 요금제·연간 결제에 해당하는 것).
      const deal = (snapshot?.prices?.deals || []).filter(d => d.service === service && (!d.plans || d.plans.includes(planKey(f.row.plan))) && dayAt(d.checked) !== null && now - dayAt(d.checked) <= PRICE_FRESH)
        .map(d => ({ ...d, fromAt: dayAt(d.from), untilAt: dayAt(d.until) + DAY_MS - 1 })).filter(d => d.fromAt !== null && d.untilAt >= now && d.fromAt - now <= DEAL_AHEAD).sort((a, b) => a.fromAt - b.fromAt)[0] || null;
      const off = deal?.off ? `(${deal.off}%)` : '', kind = deal?.cycle === 'year' ? '연간 결제 ' : '';
      const dealText = !deal ? '' : deal.fromAt > now ? ` <b class="ms-num">${md(deal.fromAt)}</b>부터 ${kind}할인${off}이 있어요 · 바꾸려면 그때까지 기다려 보세요.` : ` 지금 ${kind}할인 중이에요${off} · ${md(deal.untilAt)}까지.`;
      // 둘 다 「월 결제라면」 — 이미 연간이면 「이미 연간이에요」로 받는다(P3-11). Higgsfield는 되돌릴 수 없다는 단서를 머리 글에.
      const lock = table.annualLock ? ' 다만 중간에 월 결제로 못 돌아와요.' : '';
      const head = `<b>${name}</b> 계정(${plan})을 12주 내내 꾸준히 썼어요. 월 결제라면 연간 결제로 1년에 <b class="ms-num">${dollars(f.saving)}</b> 덜 내요.${lock}${dealText}`;
      const tax = taxWord(table);
      const items = service === 'claude'
        ? [`연간 결제는 1년 치를 한 번에 내요: ${dollars(f.plan.year)}(한 달 ${dollars(f.plan.year / 12)}꼴${tax ? `, ${tax}` : ''}). 월 결제는 한 달 ${dollars(f.plan.month)}예요.`, '1년 동안 계속 쓸 계획일 때만 바꿔 보세요. Max 요금제에는 연간 결제가 없어요.']
        : [`연간 결제는 한 달 ${dollars(f.plan.year / 12)}꼴이에요(월 결제는 ${dollars(f.plan.month)}${tax ? `, ${tax}` : ''}).`, ...(table.annualLock ? ['연간 결제에서 월 결제로는 되돌릴 수 없어요. 1년이 끝날 때 자동 갱신을 끄면 그 뒤에 월 결제를 고를 수 있어요.'] : []), '바꾸면 결제일이 그날로 바뀌고, 크레딧은 그 뒤 30일마다 채워져요.', ...(deal ? ['할인가는 첫 결제에만 붙고, 다음 결제부터는 정가로 갱신돼요.'] : [])];
      const allotText = f.allot ? `한 달 크레딧 ${credits(f.allot.credits, true)}${ultraGuess(f.row, f.allot) ? '(Ultra 가장 작은 등급 기준)' : ''}` : '';
      const why = service === 'claude'
        ? [`지난 12주 4주씩 주간 한도 평균 ${f.blocks.map(v => `${Math.round(v / 4)}%`).join(' · ')}`, `기준: 12주 내내 같은 요금제로 4주씩 평균 ${ANNUAL_PCT}% 넘게 썼을 때 · ${priceNote(table)}${deal ? ` · 할인 확인 ${md(dayAt(deal.checked))}` : ''}`]
        : [`지난 12주 4주씩 ${f.blocks.map(v => credits(v, true)).join(' · ')}크레딧 · ${allotText}`, `기준: 12주 내내 같은 요금제로 4주씩 한 달 크레딧의 ${Math.round(ANNUAL_CREDIT * 100)}% 넘게 썼을 때 · ${priceNote(table)}${deal ? ` · 할인 확인 ${md(dayAt(deal.checked))}` : ''}`];
      tips.push({ key: `annual:${service}`, service, link: service === 'claude' ? 'claude-plans' : 'higgsfield-annual', items, why, head, kind: 'save', cycleId: f.row.id, at: deal ? (deal.fromAt > now ? deal.fromAt : deal.untilAt) : now + 30 * DAY_MS });
    }
    return tips.sort((a, b) => a.at - b.at);
  }
  const tipResting = (key, now) => (Number(snapshot?.settings?.tips?.[key]?.until) || 0) > now && !ui.tipDone[key];
  // 요금·결제일 칸에 보일 연간 결제 팁(「팁 끄기」면 없음, 쉬는 팁은 뺀다). 서비스마다 하나, 화면에 둘까지.
  const shownAnnual = (rows, now) => (snapshot?.settings?.tipsOff === true ? [] : annualTips(rows, now).filter(t => !tipResting(t.key, now)).slice(0, MAX_TIPS));
  // 쉬는 연간 결제 팁이 있으면 그 수를 말하고 「다시 보기」(누르면 쉬던 팁을 모두 되살린다 — 03 칸과 같은 단추, P3-7).
  function annualHtml(now, rows) {
    const tips = shownAnnual(rows, now);
    const rest = Object.keys(snapshot?.settings?.tips || {}).filter(key => key.startsWith('annual:') && (Number(snapshot.settings.tips[key]?.until) || 0) > now).length;
    const restLine = snapshot?.settings?.tipsOff !== true && rest ? `<p class="mu-rest">쉬고 있는 연간 결제 팁 ${rest}개 · <button type="button" class="ms-link" data-subs="tip-reset">다시 보기</button></p>` : '';
    return `${tips.length ? `<div class="ms-sum-tips">${tips.map(t => `<div class="ms-sum-tip ${svcClass(t.service)}">${tipHtml(t)}</div>`).join('')}</div>` : ''}${restLine}`;
  }
  // 다음 결제: 달마다 오는 결제일만(연간으로 표시한 줄의 「매월 n일」은 셈하지 않는다 — P3-4).
  const monthlyBill = (row, now) => (row.cycle === 'annual' ? null : nextBill(row.billDay, now));
  function footer(now, rows) {
    const cost = costOf(rows, now);
    const next = rows.map(r => ({ r, d: monthlyBill(r, now) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d)[0];
    const day = next && (d => `${d.getMonth() + 1}/${d.getDate()}`)(new Date(new Date(now).setHours(0, 0, 0, 0) + next.d * DAY_MS));
    const bill = next ? `다음 결제 ${next.d === 0 ? '오늘' : day} ${labelOf(next.r)}${next.r.source === 'auto' ? ' ' + nameOf(next.r) : ''}` : '';
    // 3차: 한 달 요약이 있으면 「지난 4주 쓴 만큼 약 n%」, 연간 결제 팁이 있으면 그 개수를 한 줄에 더한다(요약은 끌 수 있다).
    const sum = summaryOn() ? monthSummary(rows, now) : null, annual = shownAnnual(rows, now).length;
    // 요금을 모르는 줄이 있으면 합계가 그만큼 빠졌다고 붙인다(공식 요금이 없는 GPT·Gemini 등).
    const parts = [cost.count ? `한 달 약 ${money(cost.approx, 'KRW')}${cost.unknown ? `(요금 모르는 ${cost.unknown}개 빼고)` : ''}` : '', sum?.items.length ? `지난 4주 쓴 만큼 약 ${sum.pct}%` : '', annual ? `연간 결제 팁 ${annual}개` : '', bill].filter(Boolean);
    const text = parts.length ? parts.join(' · ') : '아직 넣은 구독료가 없어요';
    return `<div class="ms-foot"><button type="button" class="ms-foot-link" data-subs="manage"><b>계정 관리</b><span>연결 · 설치 · 직접 넣기 · 막혔을 때</span></button><button type="button" class="${parts.length ? 'ms-button ms-foot-button' : 'ms-foot-link'}" data-subs="manage" data-to="ms-cost"><b>요금·결제일</b><span>${esc(text)}</span></button></div>`;
  }
  function glanceView(now, rows, groups) {
    const checkAt = snapshot?.check?.at || null, stale = freshness(checkAt, now) === 'stale';
    const next = nextSection(now, rows, checkAt);
    return `${hero(now, groups)}${fixBand(groups, now)}${nowSection(now, groups, stale)}${next}${usageSection(now, groups, next ? '03' : '02')}${rows.length ? footer(now, rows) : ''}`;
  }

  /* 계정 관리 */
  // 정상은 점 하나로 조용히, 문제 상태만 칩으로 말한다.
  function stateMark(row, now) {
    if (row.source !== 'auto') return isUsedUp(row, now) ? '<span class="ms-chip ms-chip-manual">다 씀</span>' : '<span class="ms-chip ms-chip-manual">직접 넣음</span>';
    if (row.state === 'ok') return '<span class="ms-ok-mark"><i class="ms-dot" data-state="ok" title="연결됨" aria-hidden="true"></i><span class="ms-sr">연결됨</span></span>';
    if (row.state === 'needs-login') return '<span class="ms-chip ms-chip-alert">다시 로그인</span>';
    if (row.state === 'error') return '<span class="ms-chip ms-chip-warn">읽기 실패</span>';
    return '<span class="ms-chip">확인 전</span>';
  }
  function manageRow(row, now) {
    const open = ui.menu === row.id, auto = row.source === 'auto', name = auto ? row.email || nameOf(row) : row.label;
    const plan = auto ? planName(row.plan) : KINDS.find(([k]) => k === row.kind)?.[1] || '';
    // 읽은 시각은 제목 아래 「마지막 확인」과 다를 때만(따로 다시 읽었거나 이번 확인에서 못 읽은 계정) 줄에 쓴다.
    const checkAt = snapshot?.check?.at;
    const read = auto && row.live?.readAt && (!checkAt || Math.abs(row.live.readAt - checkAt) > 2 * 60e3) ? `${stamp(row.live.readAt, now)}에 읽음` : '';
    const pass = passesOf(row, now);
    return `<div class="ms-mrow${open ? ' open' : ''}" data-row="${esc(row.id)}"><div class="ms-mline"><span class="ms-mname">${esc(name)}${pass ? `<small class="ms-pass-mark">초기화권 ${pass.count}장</small>` : ''}</span><span class="ms-mplan">${esc(plan)}</span>${stateMark(row, now)}<span class="ms-mread">${esc(read)}</span><button type="button" class="ms-menu" data-subs="menu" data-id="${esc(row.id)}" aria-expanded="${open}" aria-label="${esc(name)} 관리 열기">${moreIcon}</button></div>${open ? menuPanel(row, now) : ''}</div>`;
  }
  function menuPanel(row, now) {
    const auto = row.source === 'auto', armed = ui.removeArmed === row.id, editing = ui.editing === row.id, dd = nextBill(row.billDay, now);
    // 요금을 넣지 않았어도 공식 요금으로 셈하는 줄이면 그렇게 말한다(목록의 「공식 요금」과 맞게 — Fable 3차 시안 P3-8). 연간으로 표시한 줄은 「매월 n일」을 말하지 않는다.
    const official = officialPrice(row, now), tax = official ? taxWord(official.table) : '';
    const price = num(row.price) !== null ? `월 ${money(row.price, row.currency)}` : official ? `공식 요금 월 ${dollarsOr(official.price, official.currency)}${tax ? `(${tax})` : ''}로 셈해요 · 다르면 「요금·결제일」에서 고쳐 주세요` : '';
    const pay = [price, row.billDay && row.cycle !== 'annual' ? `매월 ${row.billDay}일 결제(${billWord(dd)})` : ''].filter(Boolean).join(' · ');
    // 연간 결제로 표시한 계정(3차)은 그 사실과 되돌리는 길을 같이 둔다.
    const yearly = row.cycle === 'annual' ? `<p class="ms-soft">연간 결제로 표시했어요 · 연간 결제 팁과 결제 전 알림을 드리지 않아요. <button type="button" class="ms-link" data-subs="cycle" data-id="${esc(row.id)}" data-cycle="">월 결제로 바꾸기</button></p>` : '';
    const facts = [row.state && !['ok', 'unknown'].includes(row.state) && row.stateMessage ? `<p class="ms-warn-text">${esc(row.stateMessage)}</p>` : '', `<p>${pay ? esc(pay) : '요금·결제일을 아직 넣지 않았어요.'}</p>`, yearly, passFact(row, now), row.note ? `<p class="ms-soft">${esc(row.note)}</p>` : ''].join('');
    const claude = auto && row.service === 'claude', passOpen = ui.passEditing === row.id;
    const buttons = [
      auto ? `<button type="button" class="ms-button ms-button-small${row.state === 'needs-login' ? ' ms-button-primary' : ''}" data-subs="relogin" data-id="${esc(row.id)}">${reloginLabel(row)}</button>` : '',
      !auto && row.kind === 'weekly' ? usedButton(row, now) : '',
      `<button type="button" class="ms-button ms-button-small" data-subs="edit" data-id="${esc(row.id)}" aria-expanded="${editing}">${auto ? '요금·결제일' : '고치기'}</button>`,
      claude ? `<button type="button" class="ms-button ms-button-small" data-subs="pass-edit" data-id="${esc(row.id)}" aria-expanded="${passOpen}">초기화권</button>` : '',
      claude && passesOf(row, now) ? `<button type="button" class="ms-button ms-button-small" data-subs="pass-used" data-id="${esc(row.id)}">1장 썼어요</button>` : '',
      `<button type="button" class="ms-button ms-button-small${armed ? ' ms-button-danger' : ''}" data-subs="remove" data-id="${esc(row.id)}">${armed ? '한 번 더 누르면 지워요' : '지우기'}</button>`].join('');
    return `<div class="ms-mpanel">${facts}<div class="ms-inline">${buttons}</div>${editing ? editForm(row, now) : ''}${claude && passOpen ? passForm(row, now) : ''}</div>`;
  }
  // 초기화권 한 줄: GPT는 Codex가 알려 준 값, Claude는 넣은 값(만료가 지났으면 그렇게 말한다).
  function passFact(row, now) {
    if (row.source !== 'auto' || !['gpt', 'claude'].includes(row.service)) return '';
    const p = passesOf(row, now), until = p?.until ? ` · ${esc(soon(p.until, now))}까지` : '';
    // GPT: 0장(읽었는데 없음)과 모름(Codex가 칸을 주지 않음)을 나눈다. 모름이면 아무 말도 하지 않는다.
    if (row.service === 'gpt') {
      const read = num(row.live?.resets?.count);
      return p ? `<p>초기화권 ${p.count}장${until} · Codex가 알려 준 값이에요</p>` : read === 0 ? '<p class="ms-soft">초기화권 없음 · Codex가 알려 준 값이에요</p>' : read > 0 ? '<p class="ms-soft">읽은 뒤 초기화권이 만료됐어요 · 다시 확인하면 정확해요</p>' : '';
    }
    if (p) return `<p>초기화권 ${p.count}장${until} · 직접 넣은 값이에요. 쓰면 「1장 썼어요」를 눌러 주세요.</p>`;
    return num(row.passCount) > 0 && row.passUntil ? `<p class="ms-soft">넣어 둔 초기화권이 ${esc(md(row.passUntil))}에 만료됐어요.</p>` : '';
  }
  // Claude 초기화권 넣기: 개수와 만료 때(시각을 비우면 그날 23:59).
  function passForm(row, now) {
    const t = row.passUntil && row.passUntil > now ? new Date(row.passUntil) : null;
    const date = t ? `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}` : '', time = t ? `${pad(t.getHours())}:${pad(t.getMinutes())}` : '';
    return `<form class="ms-form ms-pass-form" data-subs-form="pass" data-id="${esc(row.id)}">
      <p class="ms-wide ms-soft">Claude Code는 초기화권을 알려 주지 않아요. <b>${esc(nameOf(row))}</b> 계정으로 로그인한 브라우저에서 claude.ai 설정 › 사용량을 열고, Resets에 보이는 주간 초기화권 수와 만료 때를 넣어 주세요(5시간용은 넣지 않아요). <button type="button" class="ms-link" data-subs="help" data-link="claude-usage">사용량 설정 열기</button></p>
      <label>주간 초기화권<input name="passCount" type="number" min="0" max="20" step="1" value="${num(row.passCount) ?? ''}" placeholder="1"></label>
      <label>만료 날짜<input name="passDate" type="date" value="${date}"></label>
      <label>만료 시각(선택)<input name="passTime" type="time" value="${time}"></label>
      <div class="ms-wide ms-form-actions"><button type="submit" class="ms-button ms-button-primary">저장</button><button type="button" class="ms-button" data-subs="pass-edit" data-id="${esc(row.id)}">닫기</button></div>
    </form>`;
  }
  function serviceBlocks(now, rows) {
    const tools = snapshot?.tools || {};
    return ORDER.map(key => {
      const info = AUTO[key], tool = tools[key], list = rows.filter(r => r.source === 'auto' && r.service === key), open = ui.guide === key;
      const toolText = info.key ? `${esc(info.tool)}<small class="ms-mtool-note"> · 설치 필요 없음</small>` :`${esc(info.tool)}${tool?.version ? ` · <span class="ms-num">${esc(shortVersion(tool.version))}</span>` : ''}`;
      const chip = !info.key && tool && !tool.installed ? '<span class="ms-chip ms-chip-warn">설치 안 됨</span>' : '';
      const label = !list.length ? '연결 시작' : info.key ? '키 더 넣기' : info.single ? '계정 바꾸기' : '계정 더 연결';
      return `<div class="ms-mblock ${svcClass(key)}"><div class="ms-mhead"><span class="ms-tag">${esc(info.short)}</span><span class="ms-mtool">${toolText}</span>${chip}<button type="button" class="ms-button ms-button-small${open ? ' is-on' : ''}" data-subs="${open ? 'close-guide' : 'guide'}" data-service="${key}" aria-expanded="${open}">${open ? '가이드 닫기' : label}</button></div>${list.map(r => manageRow(r, now)).join('') || `<p class="ms-mempty">아직 연결한 ${info.key ? '키가' : '계정이'} 없어요.</p>`}${open ? guide(key) : ''}</div>`;
    }).join('');
  }
  function costSection(now, rows) {
    const cost = costOf(rows, now);
    // 3차: 요금을 넣지 않은 자동 연결 계정도 공식 요금(60일 안)이 있으면 합계·목록에 넣고 「공식 요금」이라고 붙인다(고치면 넣은 값이 먼저).
    const priced = rows.map(r => ({ r, o: officialPrice(r, now), d: monthlyBill(r, now) })).filter(x => num(x.r.price) !== null || x.r.billDay || x.o).sort((a, b) => (a.d ?? 99) - (b.d ?? 99));
    const counts = [`구독 ${cost.count}개`, cost.official ? `공식 요금 ${cost.official}개` : '', cost.unknown ? `요금 모름 ${cost.unknown}개` : ''].filter(Boolean).join(' · ');
    const metrics = cost.count ? `<div class="ms-metrics">
        <div class="ms-metric"><span>한 달 구독료</span><strong class="ms-num">약 ${money(cost.approx, 'KRW')}</strong><small>${esc(pair(cost.krw, cost.usd) || '0')} · ${esc(counts)}</small></div>
        <div class="ms-metric"><span>7일 안 결제</span><strong class="ms-num">${cost.soon}건</strong><small>${cost.soon ? esc(pair(cost.soonKrw, cost.soonUsd)) : '다음 7일은 결제가 없어요'}</small></div>
        <div class="ms-metric"><span>달러 환산 기준</span><label class="ms-rate">1달러 = <input id="ms-rate" type="number" min="1" step="1" value="${esc(snapshot?.settings?.usdKrw || 1400)}"> 원</label><small>합계의 '약' 금액에만 써요</small></div>
      </div>` : '';
    const priceText = (r, o) => (num(r.price) !== null ? esc(money(r.price, r.currency)) : o ? `${esc(dollarsOr(o.price, o.currency))}<small>공식 요금</small>` : '');
    const list = priced.length ? `<div class="ms-bills">${priced.map(({ r, o, d }) => `<div class="ms-bill ${svcClass(r.source === 'auto' ? r.service : null)}"><span class="ms-tag">${esc(labelOf(r))}</span><span class="ms-bill-name">${esc(r.source === 'auto' ? nameOf(r) : KINDS.find(([k]) => k === r.kind)?.[1] || '')}</span><span class="ms-bill-price ms-num">${priceText(r, o)}</span><span class="ms-bill-day">${r.cycle === 'annual' ? '연간 결제' : r.billDay ? `매월 ${r.billDay}일 · ${billWord(d)}` : '결제일 없음'}</span><button type="button" class="ms-link" data-subs="cost-edit" data-id="${esc(r.id)}">고치기</button></div>`).join('')}</div>`
      : '<p class="ms-cost-empty">계정 줄의 ⋯에서 「요금·결제일」을 넣으면 한 달 합계와 다가오는 결제를 여기서 알려 드려요.</p>';
    // 3차: 칸 머리에 한 달 요약과 연간 결제 팁(돈 이야기는 요금이 있는 화면에서 — Fable 1차 8-1).
    const head = `${summaryCard(now, rows)}${annualHtml(now, rows)}`;
    return section('02', '요금·결제일', cost.official ? '넣은 요금을 먼저 쓰고, 넣지 않은 계정은 공식 요금으로 셈해요.' : '월 구독료와 결제일을 넣은 구독이 모여요.', head + metrics + list, 'ms-cost');
  }
  function manageView(now, rows) {
    const auto = rows.filter(r => r.source === 'auto'), manual = rows.filter(r => r.source !== 'auto'), check = snapshot?.check;
    if (!auto.length && !ui.guide && !ui.guideClosed) ui.guide = 'claude';
    const status = check?.at ? `마지막 확인 ${stamp(check.at, now)}${freshness(check.at, now) === 'fresh' ? '' : `(${rel(now - check.at)} 전)`}` : '아직 확인 전';
    return `<button type="button" class="ms-back" data-subs="glance">${arrowBack}한눈에 보기로</button>
      <div class="ms-mtitle"><h1 id="benefit-title" tabindex="-1">계정 관리</h1><p>연결한 계정 ${auto.length}개${manual.length ? ` · 직접 넣은 구독 ${manual.length}개` : ''}. 공식 프로그램이 이 PC에서만 사용량을 읽고, 로그인 정보는 PC 밖으로 나가지 않아요.</p>
        ${auto.length ? `<p class="ms-mstatus">${snapshot?.checking ? `읽는 중이에요…${snapshot.progress?.total ? ` <b class="ms-num">${snapshot.progress.done}/${snapshot.progress.total}</b>` : ''}` : esc(status)} · <button type="button" class="ms-link" data-subs="check" ${checkBusy() ? 'disabled' : ''}>지금 확인</button></p>` : ''}</div>
      ${section('01', '연결한 계정', '계정 줄의 ⋯을 누르면 요금·결제일, 다시 로그인, 지우기가 나와요.', `<div class="ms-mlist">${serviceBlocks(now, rows)}</div>`)}
      ${costSection(now, rows)}
      ${section('03', '직접 넣는 구독', 'Suno·Hugging Face처럼 자동으로 못 읽는 구독은 결제일·잔액·초기화 요일을 직접 넣어 둘 수 있어요.', `${manual.length ? `<div class="ms-mblock ms-s-other">${manual.map(r => manageRow(r, now)).join('')}</div>` : ''}${manualForm()}`)}
      ${section('04', '막혔을 때', '설치·로그인·키 문제를 하나씩 풀어요.', troubleshooting())}`;
  }
  // 결제 주기 칸(3차, Fable 3차 시안 P3-4): 연간이면 요금은 1년 치를 12로 나눈 한 달 값으로 받고, 「매월 n일」 결제일은 숨긴다(달마다 오는 결제가 아니다).
  const cycleField = cycle => `<label>결제 주기<select name="cycle" data-cycle-select><option value=""${cycle === 'annual' ? '' : ' selected'}>월 결제</option><option value="annual"${cycle === 'annual' ? ' selected' : ''}>연간 결제</option></select></label>`;
  const priceHint = '<small class="ms-only-annual">연간 결제면 1년 치를 12로 나눈 값을 넣어 주세요</small>';
  function editForm(row, now) {
    const v = x => (x === null || x === undefined ? '' : esc(x)), manual = row.source === 'manual';
    // 요금을 비워 둔 자동 연결 계정은 공식 요금을 자리 표시로 보인다(넣으면 넣은 값이 먼저 — Fable 3차 시안 동의 1의 (C)).
    const official = officialPrice(row, now), hint = official ? `${Math.round(official.price * 100) / 100}` : '29000';
    return `<form class="ms-form ms-edit" data-subs-form="edit" data-id="${esc(row.id)}" data-kind="${esc(row.kind)}" data-cycle="${row.cycle === 'annual' ? 'annual' : ''}">
      ${manual ? `<label>서비스 이름<input name="label" value="${v(row.label)}" maxlength="40"></label><label>한도 종류<select name="kind" data-kind-select>${KINDS.map(([k, t]) => `<option value="${k}"${k === row.kind ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      ${manual ? `<label class="ms-only-weekly">초기화 요일<select name="day"><option value="">없음</option>${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${row.resetDay === d ? ' selected' : ''}>${DAY[d]}요일</option>`).join('')}</select></label><label class="ms-only-weekly">초기화 시각<input name="time" type="time" value="${hasReset(row) ? pad(row.resetHour || 0) + ':' + pad(row.resetMinute || 0) : ''}"></label><label class="ms-only-credit">지금 잔액<input name="credits" type="number" step="any" value="${v(row.credits)}"></label>` : ''}
      ${row.kind === 'credit' || manual ? `<label class="ms-only-credit">부족 기준(이하면 알림)<input name="low" type="number" step="any" value="${v(row.lowAt)}" placeholder="비우면 1 이하"></label>` : ''}
      ${cycleField(row.cycle)}
      <label>월 구독료<span class="ms-pair"><input name="price" type="number" min="0" step="any" value="${v(row.price)}" placeholder="${esc(hint)}"><select name="currency" aria-label="통화"><option value="KRW"${row.currency !== 'USD' && !(official && num(row.price) === null && official.currency === 'USD') ? ' selected' : ''}>원</option><option value="USD"${row.currency === 'USD' || (official && num(row.price) === null && official.currency === 'USD') ? ' selected' : ''}>달러</option></select></span>${priceHint}</label>
      <label class="ms-only-monthly">결제일(매월)<input name="bill" type="number" min="1" max="31" value="${v(row.billDay)}" placeholder="3"></label>
      <label class="ms-wide">메모<input name="note" value="${v(row.note)}" maxlength="120" placeholder="회사 카드로 결제"></label>
      <div class="ms-wide ms-form-actions"><button type="submit" class="ms-button ms-button-primary">저장</button><button type="button" class="ms-button" data-subs="edit" data-id="${esc(row.id)}">닫기</button></div>
    </form>`;
  }
  function manualForm() {
    if (!ui.manualOpen) return '<div class="ms-manual-open"><button type="button" class="ms-button" data-subs="manual">구독 직접 넣기</button></div>';
    return `<form class="ms-form ms-manual" data-subs-form="manual" data-kind="plan">
      <h3 class="ms-wide">직접 넣는 구독</h3>
      <label>서비스 이름<input id="ms-manual-label" name="label" list="ms-names" maxlength="40" placeholder="Suno" required></label>
      <datalist id="ms-names">${MANUAL_NAMES.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <label>한도 종류<select id="ms-manual-kind" name="kind" data-kind-select>${KINDS.map(([k, t]) => `<option value="${k}"${k === 'plan' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="ms-only-weekly">초기화 요일<select name="day"><option value="">없음</option>${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}">${DAY[d]}요일</option>`).join('')}</select></label>
      <label class="ms-only-weekly">초기화 시각<input name="time" type="time"></label>
      <label class="ms-only-credit">지금 잔액<input name="credits" type="number" step="any" placeholder="2350"></label>
      <label class="ms-only-credit">부족 기준<input name="low" type="number" step="any" placeholder="비우면 1 이하"></label>
      ${cycleField(null)}
      <label>월 구독료<span class="ms-pair"><input name="price" type="number" min="0" step="any" placeholder="29000"><select name="currency" aria-label="통화"><option value="KRW">원</option><option value="USD">달러</option></select></span>${priceHint}</label>
      <label class="ms-only-monthly">결제일(매월)<input name="bill" type="number" min="1" max="31" placeholder="3"></label>
      <label class="ms-wide">메모<input name="note" maxlength="120" placeholder="계정 이메일이나 결제 카드"></label>
      <div class="ms-wide ms-form-actions"><button type="submit" class="ms-button ms-button-primary">넣기</button><button type="button" class="ms-button" data-subs="manual">닫기</button></div>
    </form>`;
  }
  const step = (n, title, state, body) => `<li class="ms-step ms-step-${state}"><span class="ms-step-mark ms-num" aria-hidden="true">${state === 'done' ? '✓' : n}</span><div><h4>${title}</h4>${body}</div></li>`;
  const guideFrame = (info, steps) => `<div class="ms-guide" id="ms-guide"><h3>${esc(info.label)} 연결 가이드</h3><ol>${steps}</ol></div>`;
  // API 키로 읽는 서비스: 설치·로그인 대신 키 페이지 열기 → 붙여 넣기.
  function keyGuide(key) {
    const info = AUTO[key];
    return guideFrame(info, step(1, '요금제 확인', 'done', `<p>${esc(info.plan)}</p>`)
      + step(2, 'API 키 복사', 'now', `<p>아래 단추로 Typecast API 키 페이지를 열고 로그인해요. 이미 있는 키를 복사해 와도 돼요. 키를 새로 만들면 예전 키는 더 이상 쓸 수 없어요.</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="help" data-link="${esc(info.planLink)}">API 키 페이지 열기</button></div>`)
      + step(3, '키 붙여 넣기', 'now', `<form class="ms-code" data-subs-form="key" data-service="${esc(key)}"><label for="ms-key">${esc(info.label)} API 키</label><div class="ms-inline"><input id="ms-key" type="password" autocomplete="off" spellcheck="false" value="${esc(ui.key)}" placeholder="복사한 키를 붙여 넣기 (Ctrl+V)"><button type="submit" class="ms-button ms-button-primary" ${busy ? 'disabled' : ''}>연결</button></div><p class="ms-soft">키는 ${esc(info.label)}에 남은 크레딧을 물을 때만 쓰고 이 PC에 암호화해 둬요. 화면에는 끝 네 글자만 보여요.</p></form>`)
      + step(4, '첫 확인', 'wait', '<p>연결하면 바로 남은 크레딧을 읽어요. 다음부터는 한눈에 보기의 「지금 확인」 한 번이면 같이 다시 읽어요.</p>'));
  }
  function guide(key) {
    const info = AUTO[key];
    if (info.key) return keyGuide(key);
    const tool = snapshot?.tools?.[key], login = snapshot?.login && snapshot.login.service === key ? snapshot.login : null, otherLogin = snapshot?.login && snapshot.login.service !== key && !['done', 'error', 'cancelled'].includes(snapshot.login.stage);
    const installed = !!tool?.installed;
    const check = step(1, '요금제 확인', 'done', `<p>${esc(info.plan)}</p>${info.planLink ? `<button type="button" class="ms-link" data-subs="help" data-link="${info.planLink}">요금제 보기</button>` : ''}`);
    const install = step(2, `${info.tool} 설치`, installed ? 'done' : 'now', installed
      ? `<p>이 PC에 설치돼 있어요${tool.version ? ` (${esc(shortVersion(tool.version))})` : ''}.</p>`
      : `<p>아래 단추를 누르면 파란 PowerShell 창이 열리고 공식 설치 명령이 실행돼요. 관리자 권한은 필요 없어요. 1~2분 동안 아무 표시가 없을 수 있으니 창을 닫지 말고 기다려 주세요.</p>
        ${info.node && !tool?.npm ? `<p class="ms-warn-text">Higgsfield CLI는 Node.js가 먼저 있어야 해요. Node.js(LTS)를 설치한 뒤 이 단계로 돌아오세요.</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="help" data-link="node">Node.js 받기</button></div>` : ''}
        <div class="ms-inline"><button type="button" class="ms-button ms-button-primary" data-subs="install" data-service="${key}" ${busy ? 'disabled' : ''}>설치 창 열기</button><button type="button" class="ms-button" data-subs="recheck-tools">설치 끝났어요 · 다시 확인</button></div>
        <details class="ms-cmd"><summary>직접 붙여 넣고 싶다면</summary><code>${esc(info.install)}</code><button type="button" class="ms-link" data-subs="copy" data-service="${key}">명령 복사</button> <button type="button" class="ms-link" data-subs="help" data-link="${info.installLink}">공식 설치 안내</button></details>`);
    let loginBody;
    if (!installed) loginBody = '<p class="ms-soft">설치가 끝나면 열려요.</p>';
    else if (login && !['done', 'error', 'cancelled'].includes(login.stage) && key === 'gemini') {
      loginBody = `<p>검은 창이 열렸어요. 아래 순서대로 하면 돼요. 창이 안 보이면 아래쪽 작업 표시줄에서 찾아 주세요.</p>
        <ol class="ms-mini-steps">
          <li>검은 창에서 <b>Enter</b>를 눌러 「1. Google OAuth」를 골라요.</li>
          <li>열린 브라우저에서 연결할 Google 계정을 고르고 「로그인」을 눌러요.</li>
          <li>브라우저에 나온 코드를 「클립보드에 복사」하고, 검은 창 안에서 <b>오른쪽 클릭</b>(붙여넣기) 뒤 <b>Enter</b>를 눌러요.</li>
          <li>폴더를 믿겠냐고 물으면 아무거나 골라도 돼요. 로그인은 이미 끝났어요.</li>
        </ol>
        <p class="ms-soft">연결되면 이 화면이 저절로 넘어가요. 그다음 검은 창은 닫아도 돼요.</p>
        <div class="ms-inline"><button type="button" class="ms-link" data-subs="cancel-login">로그인 취소</button></div>`;
    } else if (login && !['done', 'error', 'cancelled'].includes(login.stage)) {
      loginBody = `<p>${esc(login.message || '로그인을 준비하고 있어요.')}</p>
        ${login.url ? '<p class="ms-soft">브라우저가 열리지 않았다면 아래 단추로 다시 열어 주세요. 브라우저에 다른 계정이 이미 로그인돼 있으면 「주소 복사」를 눌러 시크릿 창(Ctrl+Shift+N) 주소창에 붙여 넣고, 연결할 계정으로 로그인해 주세요.</p><div class="ms-inline"><button type="button" class="ms-button" data-subs="open-url">로그인 페이지 다시 열기</button><button type="button" class="ms-button" data-subs="copy-url">주소 복사</button></div>' : ''}
        ${login.needsCode ? `<form class="ms-code" data-subs-form="code"><label for="ms-code">브라우저에 보이는 코드</label><div class="ms-inline"><input id="ms-code" autocomplete="off" spellcheck="false" value="${esc(ui.code)}" placeholder="코드를 붙여 넣기 (Ctrl+V)"><button type="submit" class="ms-button ms-button-primary">연결</button></div></form>` : ''}
        ${key === 'gpt' && login.url ? '<p class="ms-soft">ChatGPT가 휴대폰 인증을 요구하면 안내대로 마쳐 주세요. 끝나면 이 화면이 저절로 넘어가요.</p>' : ''}
        <div class="ms-inline"><button type="button" class="ms-link" data-subs="cancel-login">로그인 취소</button>${key === 'claude' && !login.console ? '<button type="button" class="ms-link" data-subs="console-login">코드가 안 들어가면 · 검은 창으로 로그인하기</button>' : ''}</div>`;
    } else {
      const last = login && ['done', 'error'].includes(login.stage) ? `<p class="${login.stage === 'done' ? 'ms-ok-text' : 'ms-warn-text'}">${esc(login.message)}</p>` : '';
      loginBody = `${last}<p>이미 이 PC에서 ${esc(info.tool)}에 로그인해 쓰고 있다면 그 계정을 바로 가져올 수 있어요. ${info.single ? `처음이라면 「${esc(info.label)} 로그인」을 눌러요.` : '다른 계정은 「새 계정 연결」로 하나씩 더해요.'}</p>
        ${info.email ? `<label class="ms-field" for="ms-email">연결할 이메일 (선택)<input id="ms-email" type="email" autocomplete="email" value="${esc(ui.email)}" placeholder="name@example.com"><small>로그인 화면에 미리 채워져요. 다만 브라우저에 다른 Claude 계정이 이미 로그인돼 있으면 그 계정으로 연결되니, 먼저 브라우저(claude.ai)에서 연결할 계정으로 바꿔 두세요.</small></label>` : ''}
        <div class="ms-inline"><button type="button" class="ms-button" data-subs="existing" data-service="${key}" ${busy || otherLogin ? 'disabled' : ''}>이 PC의 기존 로그인 쓰기</button><button type="button" class="ms-button ms-button-primary" data-subs="login" data-service="${key}" ${busy || otherLogin ? 'disabled' : ''}>${info.single ? `${esc(info.label)} 로그인` : '새 계정 연결'}</button></div>
        ${otherLogin ? '<p class="ms-soft">다른 서비스의 로그인이 진행 중이에요. 끝난 뒤 이어서 해 주세요.</p>' : ''}`;
    }
    const loginState = !installed ? 'wait' : login?.stage === 'done' ? 'done' : 'now';
    const first = step(4, '첫 확인', login?.stage === 'done' ? 'done' : 'wait', '<p>연결하면 바로 사용량을 한 번 읽어요. 다음부터는 한눈에 보기의 「지금 확인」 한 번이면 모든 계정을 다시 읽어요.</p>');
    return guideFrame(info, `${check}${install}${step(3, '로그인', loginState, loginBody)}${first}`);
  }
  function troubleshooting() {
    return `<div class="ms-help">${HELP.map(([q, a], i) => { const key = String(i), open = ui.help.has(key); return `<div class="ms-help-item${open ? ' open' : ''}"><button type="button" class="ms-help-q" data-subs="help-item" data-id="${key}" aria-expanded="${open}"><span>${esc(q)}</span>${chevron}</button>${open ? `<p class="ms-help-a">${esc(a)}</p>` : ''}</div>`; }).join('')}</div>`;
  }
  function section(number, title, description, body, id = '') {
    return `<section class="ms-section"${id ? ` id="${id}"` : ''}><div class="ms-section-heading"><h2><span class="ms-section-number">${number}</span>${title}</h2>${description ? `<p>${description}</p>` : ''}</div>${body}</section>`;
  }

  // 고리 숫자는 처음 보일 때와 새로 읽은 값이 바뀔 때만 한 번 굴리고 고리를 그린다.
  // 1분마다 다시 그릴 때(quiet)는 값이 바뀌어도(초기화 시각이 지나 「풀렸을 거예요」로 바뀐 때 등) 굴리지 않는다.
  function rollChanged(quiet) {
    const nodes = container?.querySelectorAll?.('[data-roll]'); if (!nodes) return;
    const motion = motionOn() && !quiet;
    for (const el of nodes) {
      const key = el.dataset.roll, value = el.textContent;
      if (motion && rolled.get(key) !== value) { roll(el); el.closest('.ms-gauge')?.classList.add('is-drawing'); }
      rolled.set(key, value);
    }
  }
  // 다시 그린 뒤에도 키보드 초점이 같은 단추·입력에 남게 한다.
  function focusKey() {
    const el = document.activeElement;
    if (!el || !container?.contains?.(el)) return null;
    if (el.id) return { selector: `#${CSS.escape(el.id)}`, range: [el.selectionStart, el.selectionEnd] };
    const d = el.dataset || {};
    return d.subs ? { selector: `[data-subs="${CSS.escape(d.subs)}"]${d.id ? `[data-id="${CSS.escape(d.id)}"]` : ''}${d.service ? `[data-service="${CSS.escape(d.service)}"]` : ''}` } : null;
  }
  function paint({ quiet = false } = {}) {
    if (!container || !visible) return;
    const now = Date.now(), rows = snapshot?.rows || [], checkAt = snapshot?.check?.at || null, groups = serviceGroups(rows, now, checkAt);
    let html;
    if (!context.native) html = hero(now, groups) + section('01', 'PC 앱에서 쓰는 혜택이에요', '이 혜택은 회원 PC에 설치된 공식 프로그램으로 사용량을 읽기 때문에 SYNK Platform PC 앱에서만 열려요.', '<p class="ms-soft">PC 앱을 설치하고 SYNK ID로 로그인한 뒤 회원 혜택에서 열어 주세요.</p>');
    else if (!context.signedIn) html = hero(now, groups) + section('01', '로그인하고 시작해요', '회원 무료 혜택이에요. 로그인 정보와 사용량 기록은 이 PC에만 저장돼요.', '<p class="ms-soft">위 초록 판의 「SYNK ID로 로그인」을 눌러 주세요. 처음이라면 창 오른쪽 위 「회원가입」부터 해요.</p>');
    else if (loadError) html = hero(now, groups) + section('01', '불러오지 못했어요', esc(loadError), '<button type="button" class="ms-button" data-subs="recheck-tools">다시 시도</button>');
    else if (!snapshot) html = hero(now, groups);
    else if (ui.view === 'manage') html = manageView(now, rows);
    else html = glanceView(now, rows, groups);
    const stale = !!snapshot && ui.view !== 'manage' && groups.length > 0 && freshness(checkAt, now) === 'stale';
    const focus = focusKey();
    container.innerHTML = `<div class="member-subs${stale ? ' is-stale' : ''}">${html}</div>`;
    rollChanged(quiet);
    if (focus) { const el = container.querySelector(focus.selector); if (el) { el.focus({ preventScroll: true }); if (focus.range && typeof el.setSelectionRange === 'function') try { el.setSelectionRange(...focus.range); } catch {} } }
  }

  return {
    render(el, next = {}) {
      container = el; bind(el); context = { signedIn: next.signedIn === true, native: next.native === true && !!api };
      visible = true;
      if (context.native && context.signedIn && !snapshot && !loadError) void load(false);
      if (!timer) { timer = setInterval(() => { if (visible && !document.hidden && !(container?.contains(document.activeElement) && document.activeElement.matches('input,select,textarea'))) paint({ quiet: true }); }, 60000); timer?.unref?.(); }
      paint();
    },
    // 혜택을 떠나면 다음에 열 때 펼친 줄 없이 한눈에 보기부터(로그인이 진행 중이면 계정 관리에 둔다).
    setVisible(value) { visible = !!value; if (!visible) { ui.removeArmed = null; ui.open.clear(); ui.more = false; ui.goalOpen = false; ui.sumOpen = false; ui.sumWhy = false; rolled.clear(); if (!loginActive()) { ui.view = 'glance'; ui.menu = null; ui.editing = null; } } },
    dispose() { clearInterval(timer); timer = null; visible = false; },
    refresh: () => load(true),
  };
}
