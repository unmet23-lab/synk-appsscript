// AI 구독 계정판(회원 혜택) 화면. 읽기·로그인·저장은 데스크톱 본체(src/ai-subscriptions.cjs)가 하고,
// 이 파일은 받은 숫자를 두 화면으로 보여 준다(10-18 구조 개편: 한 겹에 한 질문).
//  · 한눈에 보기: 손볼 계정(있을 때만) → 01 서비스마다 지금 쓸 계정 한 줄 → 02 다 쓴 계정이 다시 열리는 때 → 계정 관리·요금 입구
//  · 계정 관리: 서비스별 연결·설치 가이드, 계정 줄 메뉴(요금·결제일·다시 로그인·지우기), 요금 합계, 직접 넣는 구독, 막혔을 때
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
// 주의는 「10% 이하 남음」 하나로 숫자·색·점이 같은 기준을 쓴다.
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

// 한눈에 화면의 서비스 묶음(직접 넣은 구독은 이름·종류마다). 월 구독만 넣은 줄은 한도가 없어 「요금·결제일」에만 보인다.
// 묶음 안: 바로 쓸 계정(많이 남은 순, 같으면 큰 요금제) → 풀렸을 계정 → 직접 넣은 구독 → 다 쓴 계정(먼저 풀리는 순) → 못 읽음 → 다시 로그인 → 아직 안 읽음.
export function serviceGroups(rows, now, checkAt = null) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.kind !== 'weekly' && row.kind !== 'credit') continue;
    const auto = row.source === 'auto' && Object.hasOwn(AUTO, row.service), label = String(row.label || '').trim();
    const key = auto ? row.service : `m-${row.kind}-${label.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, service: auto ? row.service : null, label: auto ? AUTO[row.service].short : label || '직접 넣은 구독', kind: row.kind, accounts: [] });
    map.get(key).accounts.push({ row, name: nameOf(row), ...accountState(row, now, checkAt) });
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
    return { ...g, usable, projected, manual: by(['manual']), out, error: by(['error']), login: by(['login']), pending: by(['unknown']), ready, best: plenty[0] || projected[0] || usable[0] || by(['manual'])[0] || null };
  });
  const order = g => (g.service ? ORDER.indexOf(g.service) : ORDER.length);
  return groups.sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label, 'ko'));
}

// 이번 주 일정: 다 쓴 계정이 다시 열리는 때(unblock) · 쓸 수 있는 계정의 주간 초기화(reset) · 7일 안 결제(bill)를 시간순으로.
// 한눈에 화면은 unblock의 앞 셋만 보이고, 「모두 보기」를 누르면 그 자리에서 전부 펼친다.
export function upcoming(rows, now, checkAt = null) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const items = [];
  for (const row of rows || []) {
    const a = accountState(row, now, checkAt);
    if (a.state === 'out' && a.unblock) items.push({ t: a.unblock, type: 'unblock', row, focus: a.focus, after: a.focus === 'session' && a.g.weekly ? a.g.weekly.left : null });
    else if ((a.state === 'ok' || a.state === 'low') && a.g?.weekly?.resetsAt && a.g.weekly.resetsAt - now <= 7 * DAY_MS) items.push({ t: a.g.weekly.resetsAt, type: 'reset', row });
    const dd = nextBill(row.billDay, now);
    if (dd !== null && dd <= 6) items.push({ t: today.getTime() + dd * DAY_MS, type: 'bill', row, days: dd });
  }
  return items.sort((a, b) => a.t - b.t);
}

export function costSummary(rows, now, rate = 1400) {
  let krw = 0, usd = 0, count = 0, soon = 0, soonKrw = 0, soonUsd = 0;
  for (const row of rows) {
    if (num(row.price) === null) continue;
    count++; const usdRow = row.currency === 'USD';
    if (usdRow) usd += Number(row.price); else krw += Number(row.price);
    const dd = nextBill(row.billDay, now);
    if (dd !== null && dd <= 6) { soon++; if (usdRow) soonUsd += Number(row.price); else soonKrw += Number(row.price); }
  }
  return { krw, usd, count, soon, soonKrw, soonUsd, approx: krw + usd * (Number(rate) || 1400) };
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
const billWord = d => (d === 0 ? '오늘' : `D-${d}`);
const modelName = name => (/모델$/.test(name) ? name : `${name} 모델`);
const shortVersion = v => (v ? String(v).replace(/\s*\(.*\)\s*$/, '').replace(/^(codex-cli|higgsfield)\s+/i, '') : '');
const svcClass = service => (service && Object.hasOwn(AUTO, service) ? 'ms-s-' + service : 'ms-s-other');
const labelOf = row => (row.source === 'auto' && Object.hasOwn(AUTO, row.service) ? AUTO[row.service].short : row.label);
const arrowBack = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
const chevron = '<svg class="ms-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6"/></svg>';
const moreIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>';

// 서비스 줄의 고리(10-17 Bklit 게이지에서 원리만, 10-18 한 겹으로): 추천 계정의 덜 남은 쪽만, 남은 만큼 12시에서 시계 방향으로 찬다.
// 97% 넘게 남으면 둥근 끝이 맞닿아 닫혀 보여 각진 끝으로, 100%는 이음매 없는 닫힌 원으로 그린다.
function ring(w) {
  const level = gaugeLevel(w), attrs = 'cx="30" cy="30" r="25" stroke-width="7"';
  const arc = w.left > 0 ? `<circle class="ms-arc" data-level="${level}" ${attrs}${w.left >= 100 ? ' data-full' : ` stroke-linecap="${w.left >= 97 ? 'butt' : 'round'}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="${100 - w.left}" transform="rotate(-90 30 30)"`}/>` : '';
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
  const ui = { view: 'glance', open: new Set(), more: false, menu: null, guide: null, guideClosed: false, editing: null, removeArmed: null, manualOpen: false, email: '', code: '', key: '', help: new Set(), relogin: null };
  const rolled = new Map();
  // 알림과 응답은 따로 도착해 순서가 바뀔 수 있다. 본체가 붙인 번호(seq)보다 옛 스냅숏은 버린다.
  const take = value => { if (value?.ok && !(value.seq < snapshot?.seq)) snapshot = value; };
  api?.onChanged?.(value => { if (value?.ok) { take(value); if (visible) paint(); } });
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
    el.addEventListener('change', event => { if (!visible) return; if (event.target.matches('[data-kind-select]')) event.target.closest('form')?.setAttribute('data-kind', event.target.value); if (event.target.id === 'ms-rate') void act('rate', () => api.save({ settings: { usdKrw: Number(event.target.value) } })); });
  }
  // 화면 바꾸기: 그 화면 맨 위(또는 to 구획)로 옮기고, 화면 제목에 초점을 둔다.
  function show(view, to = null) {
    ui.view = view; ui.menu = null; ui.editing = null; ui.removeArmed = null;
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
    if (name === 'menu') { ui.menu = ui.menu === id ? null : id; ui.editing = null; ui.removeArmed = null; return paint(); }
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
    if (name === 'edit') { ui.menu = id; ui.editing = ui.editing === id ? null : id; return paint(); }
    if (name === 'remove') { if (ui.removeArmed !== id) { ui.removeArmed = id; return paint(); } ui.removeArmed = null; ui.menu = null; return void act('remove', () => api.save({ remove: id })); }
    if (name === 'used') { const row = rowById(id); if (row) return void act('used', () => api.save({ row: { id, usedUpAt: isUsedUp(row, Date.now()) ? null : Date.now() } })); }
    if (name === 'manual') { ui.manualOpen = !ui.manualOpen; return paint(); }
  }
  function formValues(form) {
    const get = n => form.querySelector(`[name="${n}"]`)?.value ?? '';
    const kind = get('kind'), time = get('time') || '00:00', [h, m] = time.split(':').map(x => parseInt(x, 10) || 0), day = get('day');
    return { label: get('label').trim(), kind, price: num(get('price')), currency: get('currency') === 'USD' ? 'USD' : 'KRW', billDay: num(get('bill')), credits: kind === 'credit' ? num(get('credits')) : null, lowAt: kind === 'credit' ? num(get('low')) : null, note: get('note').trim(), resetDay: kind === 'weekly' && day !== '' ? Number(day) : null, resetHour: kind === 'weekly' && day !== '' ? h : null, resetMinute: kind === 'weekly' && day !== '' ? m : null };
  }
  function onForm(name, form) {
    if (name === 'code') { const code = ui.code.trim(); if (!code) return toast('브라우저에 보이는 코드를 붙여 넣어 주세요.'); return void act('code', async () => { const r = await api.submitCode(snapshot?.login?.id, code); if (r?.ok) ui.code = ''; return r; }); }
    if (name === 'key') { const key = ui.key.trim(), service = form.dataset.service; if (!key) return toast('복사한 API 키를 붙여 넣어 주세요.'); return void act('key', async () => { const replace = ui.relogin && rowById(ui.relogin)?.service === service ? ui.relogin : null; const r = await api.connectKey(service, key, replace ? { replace } : {}); if (!r?.ok) return r; ui.key = ''; ui.guide = null; ui.relogin = null; toast(`${AUTO[service]?.label || ''} 키를 연결했어요. 남은 크레딧을 읽었어요.`); return r.snapshot || r; }); }
    if (name === 'manual') { const v = formValues(form); if (!v.label) return toast(CODE_TEXT.LABEL_REQUIRED); return void act('manual', async () => { const r = await api.save({ add: v }); if (r?.rows) { ui.manualOpen = false; toast(`${v.label}를 넣었어요.`); } return r; }); }
    if (name === 'edit') { const id = form.dataset.id, row = rowById(id); if (!row) return; const v = formValues(form); const patch = { id, price: v.price, currency: v.currency, billDay: v.billDay, note: v.note }; if (row.source === 'manual') Object.assign(patch, { label: v.label || row.label, kind: v.kind, resetDay: v.resetDay, resetHour: v.resetHour, resetMinute: v.resetMinute }); if ((row.kind === 'credit' || v.kind === 'credit') && row.source === 'manual') Object.assign(patch, { credits: v.credits, lowAt: v.lowAt }); else if (row.kind === 'credit') patch.lowAt = v.lowAt; return void act('edit', async () => { const r = await api.save({ row: patch }); if (r?.rows) { ui.editing = null; toast('저장했어요.'); } return r; }); }
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
        <div class="ms-hero-title"><h1 id="benefit-title" tabindex="-1">구독</h1><p>흩어진 AI 구독,<br>이번 주 얼마 남았는지 한 번에.</p></div>
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
    if (n === 1) {
      const a = g.accounts[0], unit = g.service === 'typecast' ? '키' : g.service ? '계정' : '구독';
      const word = a.projected ? '풀렸을 거예요' : { low: credit ? '부족' : '거의 다 씀', out: '다 씀', error: '못 읽음', login: '다시 로그인', unknown: waiting }[a.state];
      return `${unit} 1개${word ? ` <span class="ms-soft">${word}</span>` : ''}`;
    }
    const tail = [credit ? (low ? `${low}개 부족` : '') : (low ? `${low}개 거의 다 씀` : ''), g.projected.length ? `${g.projected.length}개 풀렸을 거예요` : '', g.out.length ? `${g.out.length}개 다 씀` : '', g.error.length ? `${g.error.length}개 못 읽음` : '', g.login.length ? `${g.login.length}개 다시 로그인` : '', g.pending.length ? `${g.pending.length}개 ${waiting}` : ''].filter(Boolean).join(' · ');
    return `${n}개 중 <em>${g.ready.length}개</em> ${credit ? '넉넉' : '바로 써요'}${tail ? ` <span class="ms-soft">${tail}</span>` : ''}`;
  }
  function valueHtml(g, now, stale) {
    const best = g.best, read = stale && best?.row?.live?.readAt ? ` · ${stamp(best.row.live.readAt, now)}` : '', guess = best?.projected ? ' · 예상' : '';
    if (best && g.kind === 'credit' && best.credits !== undefined) return `<span class="ms-gauge ms-value" data-level="${best.state}"><span class="ms-big"><b class="ms-big-num" data-roll="c-${esc(g.key)}">${credits(best.credits, true)}</b><span>크레딧${read}</span></span></span>`;
    if (best?.g) { const w = best.g[best.focus]; return `<span class="ms-gauge ms-value${best.projected ? ' is-guess' : ''}" data-level="${gaugeLevel(w)}">${ring(w)}<span class="ms-big"><b class="ms-big-num" data-roll="r-${esc(g.key)}">${w.left}<small>%</small></b><span>${WINDOW_NAME[best.focus]} 남음${guess}${read}</span></span></span>`; }
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
    const pick = n > 1 ? (g.best && !g.best.projected && g.best.state === 'low' ? '남은 건 이것뿐' : '추천') : g.service === 'typecast' ? '연결한 키' : g.service ? '연결한 계정' : '직접 넣은 구독';
    const plan = g.best && g.service ? planName(g.best.row.plan) : '';
    return `<div class="ms-svc${open ? ' open' : ''} ${svcClass(g.service)}">
      <button type="button" class="ms-svc-row" data-subs="toggle" data-id="${esc(id)}" aria-expanded="${open}">
        <span class="ms-pool"><span class="ms-pool-top"><span class="ms-tag">${esc(g.label)}</span><span class="ms-count">${countText(g)}</span></span><span class="ms-dots" aria-hidden="true">${dots}</span></span>
        <span class="ms-pick"><span class="ms-pick-label">${pick}</span><span class="ms-pick-name${g.best ? '' : ' is-none'}">${g.best ? `<span>${esc(g.best.name)}</span>${plan ? `<small>${esc(plan)}</small>` : ''}` : '지금은 없어요'}</span></span>
        ${valueHtml(g, now, stale)}${chevron}
      </button>${open ? detailHtml(g, now) : ''}</div>`;
  }
  // 펼친 줄의 보조 글: 오른쪽 값(덜 남은 창)은 빼고 나머지 창 — 주간, 모델별 주간(Fable 등), 5시간 순 — 과 주간 초기화 때.
  function windowsText(a, now) {
    const { g } = a, parts = [];
    if (g.weekly && a.focus !== 'weekly') parts.push(`주간 ${g.weekly.left}%`);
    for (const m of a.row.live?.models || []) if (Number.isFinite(Number(m.usedPercent))) parts.push(`${modelName(m.name)} ${leftPercent(Math.min(100, Math.max(0, Number(m.usedPercent))))}%`);
    if (g.session && a.focus !== 'session') parts.push(`5시간 ${g.session.left}%`);
    if (g.weekly?.resetsAt) parts.push(`${soon(g.weekly.resetsAt, now)} 주간 초기화`);
    return parts.join(' · ');
  }
  function detailHtml(g, now) {
    const credit = g.kind === 'credit';
    // 계정 이름 옆에 요금제(Max 5x·Max 20x·Pro Lite 등)를 작게 붙여 계정마다 등급이 보이게 한다.
    const tierOf = a => (a.row.source === 'auto' ? planName(a.row.plan) : '');
    const line = (a, body, action = '') => `<div class="ms-acc" data-row="${esc(a.row.id)}"><i class="ms-dot" data-state="${a.projected ? 'projected' : a.state}" aria-hidden="true"></i><span class="ms-acc-name">${esc(a.name)}${tierOf(a) ? `<small>${esc(tierOf(a))}</small>` : ''}</span>${body}${action ? `<span class="ms-acc-act">${action}</span>` : ''}</div>`;
    const value = a => `<span class="ms-acc-val"><b class="ms-num">${a.left}%</b><small>${WINDOW_NAME[a.focus]}</small></span>`;
    const bar = a => `<span class="ms-bar" data-state="${a.state}" aria-hidden="true"><i style="width:${a.left}%"></i></span>`;
    const usable = g.usable.map(a => credit
      ? line(a, `<span class="ms-acc-sub">${a.state === 'low' ? '크레딧 부족' : ''}</span><span class="ms-acc-val"><b class="ms-num">${credits(a.credits)}</b></span>`)
      : line(a, `<span class="ms-acc-sub">${esc(windowsText(a, now))}</span>${bar(a)}${value(a)}`)).join('');
    const projected = g.projected.map(a => line(a, `<span class="ms-acc-sub">${esc(hm(a.projected))}에 풀렸을 거예요 · 지금 확인하면 정확해요${a.g.weekly?.resetsAt ? ` · ${esc(soon(a.g.weekly.resetsAt, now))} 주간 초기화` : ''}</span>${bar(a)}${value(a)}`)).join('');
    const manual = g.manual.map(a => line(a, `<span class="ms-acc-when">${credit ? '잔액을 넣지 않았어요' : '직접 넣은 주간 구독이에요 · 다 쓰면 「다 씀 표시」를 눌러요'}</span>`, credit ? '' : usedButton(a.row, now))).join('');
    const out = g.out.map(a => line(a, `<span class="ms-acc-when">${WINDOW_NAME[a.focus]} 한도 · ${a.unblock ? `<b>${esc(soon(a.unblock, now))}</b>${a.focus === 'weekly' ? ' 주간 초기화' : ''}에 풀려요(${esc(after(a.unblock - now))})` : '풀리는 때를 몰라요'}${a.focus === 'session' && a.g.weekly ? ` · 풀리면 주간 ${a.g.weekly.left}%` : ''}${a.focus === 'session' && a.g.weekly?.resetsAt ? ` · ${esc(soon(a.g.weekly.resetsAt, now))} 주간 초기화` : ''}</span>`, a.row.source !== 'auto' ? usedButton(a.row, now) : '')).join('');
    // 긴 이유는 두 줄까지만 보이고(전문은 title과 계정 관리 ⋯), 마지막으로 읽은 값의 시각을 붙인다.
    const reason = a => `${a.row.stateMessage || '읽지 못했어요.'}${a.readAt ? ` · ${stamp(a.readAt, now)} 값` : ''}`;
    const error = g.error.map(a => line(a, `<span class="ms-acc-when ms-acc-msg" title="${esc(reason(a))}">${esc(reason(a))}</span>`, `<button type="button" class="ms-button ms-button-small" data-subs="reread" data-id="${esc(a.row.id)}" ${checkBusy() ? 'disabled' : ''}>다시 읽기</button>`)).join('');
    const login = g.login.map(a => line(a, '<span class="ms-acc-when">다시 로그인이 필요해요</span>', `<button type="button" class="ms-button ms-button-small ms-button-primary" data-subs="relogin" data-id="${esc(a.row.id)}">${reloginLabel(a.row)}</button>`)).join('');
    const pending = g.pending.map(a => line(a, `<span class="ms-acc-when">${snapshot?.checking ? '읽는 중이에요' : '아직 읽지 않았어요 · 「지금 확인」을 누르면 읽어요'}</span>`)).join('');
    const part = (title, body) => (body ? `<div class="ms-acc-group"><h3>${title}</h3>${body}</div>` : '');
    return `<div class="ms-detail">${part(credit ? '남은 크레딧' : '바로 쓸 수 있어요', usable)}${part('풀렸을 거예요', projected)}${part('직접 넣은 구독', manual)}${part('막혀 있어요', out)}${part('손볼 것', error + login)}${part('확인 전', pending)}</div>`;
  }
  const usedButton = (row, now) => `<button type="button" class="ms-button ms-button-small" data-subs="used" data-id="${esc(row.id)}">${isUsedUp(row, now) ? '다 씀 풀기' : '다 씀 표시'}</button>`;
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
    const what = item.type === 'unblock' ? `${esc(label)} · ${WINDOW_NAME[item.focus]} 한도${item.after !== null && item.after !== undefined ? ` · 풀리면 주간 ${item.after}%` : ''}`
      : item.type === 'reset' ? `${esc(label)} · 주간 초기화` : `${esc(label)} · 결제${num(item.row.price) !== null ? ` ${esc(money(item.row.price, item.row.currency))}` : '일'}`;
    const time = item.type === 'bill' ? (item.days === 0 ? '오늘' : item.days === 1 ? '내일' : (d => `${d.getMonth() + 1}/${d.getDate()}`)(new Date(item.t))) : soon(item.t, now);
    const relText = item.type === 'bill' ? billWord(item.days) : after(item.t - now);
    return `<div class="ms-next-item is-${item.type} ${svcClass(item.row.source === 'auto' ? item.row.service : null)}"><span class="ms-next-time ms-num">${esc(time)}</span><span class="ms-next-rel">${esc(relText)}</span><span class="ms-next-who"><b>${esc(name)}</b> ${what}</span></div>`;
  }
  function nextSection(now, rows, checkAt) {
    const all = upcoming(rows, now, checkAt), unblocks = all.filter(i => i.type === 'unblock');
    if (!unblocks.length) return '';
    const list = ui.more ? all : unblocks.slice(0, 3);
    const more = all.length > Math.min(3, unblocks.length) ? `<button type="button" class="ms-more" data-subs="more" aria-expanded="${ui.more}">${ui.more ? '접기' : `앞으로 7일 일정 ${all.length}개 모두 보기`}</button>` : '';
    return section('02', '다음에 풀려요', ui.more ? '다 쓴 계정이 풀리는 때, 쓸 수 있는 계정의 주간 초기화, 7일 안 결제를 날짜순으로 모았어요.' : '다 쓴 계정이 다시 열리는 때예요.', `<div class="ms-next">${list.map(item => nextLine(item, now)).join('')}</div>${more}`);
  }
  function footer(now, rows) {
    const cost = costSummary(rows, now, snapshot?.settings?.usdKrw);
    const next = rows.map(r => ({ r, d: nextBill(r.billDay, now) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d)[0];
    const day = next && (d => `${d.getMonth() + 1}/${d.getDate()}`)(new Date(new Date(now).setHours(0, 0, 0, 0) + next.d * DAY_MS));
    const bill = next ? `다음 결제 ${next.d === 0 ? '오늘' : day} ${labelOf(next.r)}${next.r.source === 'auto' ? ' ' + nameOf(next.r) : ''}` : '';
    const text = cost.count ? [`한 달 약 ${money(cost.approx, 'KRW')}`, bill].filter(Boolean).join(' · ') : bill || '아직 넣은 구독료가 없어요';
    return `<div class="ms-foot"><button type="button" class="ms-foot-link" data-subs="manage"><b>계정 관리</b><span>연결 · 설치 · 직접 넣기 · 막혔을 때</span></button><button type="button" class="${cost.count || next ? 'ms-button ms-foot-button' : 'ms-foot-link'}" data-subs="manage" data-to="ms-cost"><b>요금·결제일</b><span>${esc(text)}</span></button></div>`;
  }
  function glanceView(now, rows, groups) {
    const checkAt = snapshot?.check?.at || null, stale = freshness(checkAt, now) === 'stale';
    return `${hero(now, groups)}${fixBand(groups, now)}${nowSection(now, groups, stale)}${nextSection(now, rows, checkAt)}${rows.length ? footer(now, rows) : ''}`;
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
    return `<div class="ms-mrow${open ? ' open' : ''}" data-row="${esc(row.id)}"><div class="ms-mline"><span class="ms-mname">${esc(name)}</span><span class="ms-mplan">${esc(plan)}</span>${stateMark(row, now)}<span class="ms-mread">${esc(read)}</span><button type="button" class="ms-menu" data-subs="menu" data-id="${esc(row.id)}" aria-expanded="${open}" aria-label="${esc(name)} 관리 열기">${moreIcon}</button></div>${open ? menuPanel(row, now) : ''}</div>`;
  }
  function menuPanel(row, now) {
    const auto = row.source === 'auto', armed = ui.removeArmed === row.id, editing = ui.editing === row.id, dd = nextBill(row.billDay, now);
    const pay = [num(row.price) !== null ? `월 ${money(row.price, row.currency)}` : '', row.billDay ? `매월 ${row.billDay}일 결제(${billWord(dd)})` : ''].filter(Boolean).join(' · ');
    const facts = [row.state && !['ok', 'unknown'].includes(row.state) && row.stateMessage ? `<p class="ms-warn-text">${esc(row.stateMessage)}</p>` : '', `<p>${pay ? esc(pay) : '요금·결제일을 아직 넣지 않았어요.'}</p>`, row.note ? `<p class="ms-soft">${esc(row.note)}</p>` : ''].join('');
    const buttons = [
      auto ? `<button type="button" class="ms-button ms-button-small${row.state === 'needs-login' ? ' ms-button-primary' : ''}" data-subs="relogin" data-id="${esc(row.id)}">${reloginLabel(row)}</button>` : '',
      !auto && row.kind === 'weekly' ? usedButton(row, now) : '',
      `<button type="button" class="ms-button ms-button-small" data-subs="edit" data-id="${esc(row.id)}" aria-expanded="${editing}">${auto ? '요금·결제일' : '고치기'}</button>`,
      `<button type="button" class="ms-button ms-button-small${armed ? ' ms-button-danger' : ''}" data-subs="remove" data-id="${esc(row.id)}">${armed ? '한 번 더 누르면 지워요' : '지우기'}</button>`].join('');
    return `<div class="ms-mpanel">${facts}<div class="ms-inline">${buttons}</div>${editing ? editForm(row) : ''}</div>`;
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
    const cost = costSummary(rows, now, snapshot?.settings?.usdKrw);
    const priced = rows.filter(r => num(r.price) !== null || r.billDay).map(r => ({ r, d: nextBill(r.billDay, now) })).sort((a, b) => (a.d ?? 99) - (b.d ?? 99));
    const metrics = cost.count ? `<div class="ms-metrics">
        <div class="ms-metric"><span>한 달 구독료</span><strong class="ms-num">약 ${money(cost.approx, 'KRW')}</strong><small>${esc(pair(cost.krw, cost.usd) || '0')} · 구독 ${cost.count}개</small></div>
        <div class="ms-metric"><span>7일 안 결제</span><strong class="ms-num">${cost.soon}건</strong><small>${cost.soon ? esc(pair(cost.soonKrw, cost.soonUsd)) : '다음 7일은 결제가 없어요'}</small></div>
        <div class="ms-metric"><span>달러 환산 기준</span><label class="ms-rate">1달러 = <input id="ms-rate" type="number" min="1" step="1" value="${esc(snapshot?.settings?.usdKrw || 1400)}"> 원</label><small>합계의 '약' 금액에만 써요</small></div>
      </div>` : '';
    const list = priced.length ? `<div class="ms-bills">${priced.map(({ r, d }) => `<div class="ms-bill ${svcClass(r.source === 'auto' ? r.service : null)}"><span class="ms-tag">${esc(labelOf(r))}</span><span class="ms-bill-name">${esc(r.source === 'auto' ? nameOf(r) : KINDS.find(([k]) => k === r.kind)?.[1] || '')}</span><span class="ms-bill-price ms-num">${num(r.price) !== null ? esc(money(r.price, r.currency)) : ''}</span><span class="ms-bill-day">${r.billDay ? `매월 ${r.billDay}일 · ${billWord(d)}` : '결제일 없음'}</span><button type="button" class="ms-link" data-subs="cost-edit" data-id="${esc(r.id)}">고치기</button></div>`).join('')}</div>`
      : '<p class="ms-cost-empty">계정 줄의 ⋯에서 「요금·결제일」을 넣으면 한 달 합계와 다가오는 결제를 여기서 알려 드려요.</p>';
    return section('02', '요금·결제일', '월 구독료와 결제일을 넣은 구독만 모여요.', metrics + list, 'ms-cost');
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
  function editForm(row) {
    const v = x => (x === null || x === undefined ? '' : esc(x)), manual = row.source === 'manual';
    return `<form class="ms-form ms-edit" data-subs-form="edit" data-id="${esc(row.id)}" data-kind="${esc(row.kind)}">
      ${manual ? `<label>서비스 이름<input name="label" value="${v(row.label)}" maxlength="40"></label><label>한도 종류<select name="kind" data-kind-select>${KINDS.map(([k, t]) => `<option value="${k}"${k === row.kind ? ' selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
      ${manual ? `<label class="ms-only-weekly">초기화 요일<select name="day"><option value="">없음</option>${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}"${row.resetDay === d ? ' selected' : ''}>${DAY[d]}요일</option>`).join('')}</select></label><label class="ms-only-weekly">초기화 시각<input name="time" type="time" value="${hasReset(row) ? pad(row.resetHour || 0) + ':' + pad(row.resetMinute || 0) : ''}"></label><label class="ms-only-credit">지금 잔액<input name="credits" type="number" step="any" value="${v(row.credits)}"></label>` : ''}
      ${row.kind === 'credit' || manual ? `<label class="ms-only-credit">부족 기준(이하면 알림)<input name="low" type="number" step="any" value="${v(row.lowAt)}" placeholder="비우면 1 이하"></label>` : ''}
      <label>월 구독료<span class="ms-pair"><input name="price" type="number" min="0" step="any" value="${v(row.price)}" placeholder="29000"><select name="currency" aria-label="통화"><option value="KRW"${row.currency !== 'USD' ? ' selected' : ''}>원</option><option value="USD"${row.currency === 'USD' ? ' selected' : ''}>달러</option></select></span></label>
      <label>결제일(매월)<input name="bill" type="number" min="1" max="31" value="${v(row.billDay)}" placeholder="3"></label>
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
      <label>월 구독료<span class="ms-pair"><input name="price" type="number" min="0" step="any" placeholder="29000"><select name="currency" aria-label="통화"><option value="KRW">원</option><option value="USD">달러</option></select></span></label>
      <label>결제일(매월)<input name="bill" type="number" min="1" max="31" placeholder="3"></label>
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
    setVisible(value) { visible = !!value; if (!visible) { ui.removeArmed = null; ui.open.clear(); ui.more = false; rolled.clear(); if (!loginActive()) { ui.view = 'glance'; ui.menu = null; ui.editing = null; } } },
    dispose() { clearInterval(timer); timer = null; visible = false; },
    refresh: () => load(true),
  };
}
