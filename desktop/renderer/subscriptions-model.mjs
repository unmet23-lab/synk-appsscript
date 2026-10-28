// AI 구독 계정판의 계산(DOM 없음, 10-23 감사 C10). 화면(subscriptions.mjs)은 본체가 준 스냅숏과 지금 시각(now)을 여기에 넣고,
// 나온 숫자·상태·고른 팁을 글과 HTML로 옮기기만 한다. 요금·한도·목표·기간·추천 기준은 모두 이 파일에 있다.
//  · 계정 상태·서비스 묶음·이번 주 일정·요금 합계(10-17~, 예전부터 시험 대상이던 함수를 그대로 옮겼다 — subscriptions.mjs가 같은 이름으로 다시 내보낸다)
//  · 요금표(3차): 확인한 지 60일 신선도·한국 부가세·연간 결제 값·공식 요금으로 셈하는 줄
//  · 지난 7일 사용량 막대와 팁(크레딧 급증·속도·초기화권·요금제 맞추기·안 쓰는 구독), 목표·쉬는 팁·둘까지 고르기
//  · 한 달 요약·연간 결제·할인 시기
//  · Claude API 크레딧(10-28): 요금제로 매달 들어오는 금액과 회원이 넣은 남은 금액·만료
// 여기서는 문장을 만들지 않는다. 숫자를 글자로 바꾸는 형식(₩·$ 표기와 자리수, 천 원 어림, % 정수 표기, 날짜 말)과 문장 조립은 화면 몫이다.
// (옮겨 온 nameOf·serviceGroups의 이름 글자 둘 — 「이 PC 로그인」·「직접 넣은 구독」 — 만 예전 그대로 둔다.)
export const DAY_MS = 864e5;
// 마지막 확인에서 20분이 지나면 몇 분 전인지 붙이고, 1시간이 지나면 값이 지금과 다를 수 있다고 알린다.
const AGING_MS = 20 * 60e3, STALE_MS = 3600e3;
// 계정 하나의 읽은 값이 전체 확인보다 이만큼 오래되면 그 계정은 「못 읽음」으로 본다(옛 값을 정상처럼 보이지 않게).
const OLD_READ_MS = 12 * 3600e3;
// 계정판 본체가 자동으로 읽는 서비스와 한눈에 화면의 순서(주간 한도(고리)가 먼저, 크레딧이 뒤), 짧은 이름. 화면의 서비스 표(AUTO)도 이 이름을 쓴다.
export const ORDER = ['claude', 'gpt', 'gemini', 'higgsfield', 'typecast'];
export const SHORT = { claude: 'Claude', gpt: 'GPT', higgsfield: 'Higgsfield', gemini: 'Gemini', typecast: 'Typecast' };
// Claude 요금제 배수(공식 claude.com/pricing, 본체 ai-usage.cjs와 같은 값). GPT·Gemini는 공식 배수가 없어 같은 무게.
const CLAUDE_WEIGHT = { pro: 1, max: 5, max5x: 5, max20x: 20 };
// 팁 발동: 크레딧은 지난 7일이 그 전 평균의 1.5배 그리고 서비스별 최소량 이상(Typecast는 1글자 1크레딧이라 크게),
// 한도형은 바로 쓸 계정 전부가 가장 이른 풀리는 때보다 3시간 넘게 먼저 막힐 때. 화면에는 급한 것부터 둘까지.
const SPIKE_RATIO = 1.5, SPIKE_MIN = { higgsfield: 300, typecast: 3000 }, PACE_MARGIN = 3 * 3600e3, MAX_TIPS = 2;
// 초기화권(10-19): 「지금 쓰기」는 묶음의 모든 계정이 막혔고 가장 먼저 풀리는 때가 하루 넘게 남았을 때만(막힌 줄 안내와 팁이 같은 기준), 「곧 만료」는 3일 안일 때.
// 초기화권은 GPT(Codex가 개수·만료일을 알려 준다)와 Claude(회원이 넣는다)에만 있다 — passesOf와 같은 두 서비스.
const PASS_WAIT = DAY_MS, PASS_SOON = 3 * DAY_MS;
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
//  · 한 달 요약: 지난 4주를 쓴 만큼으로 치면 약 얼마어치인지. 가장 여유가 많은 계정은 30% 넘게 남았을 때만 말한다.
//  · 연간 결제: 12주 내내 꾸준히 쓴 계정만(Claude는 4주씩 주간 평균 40% 넘게 · 크레딧형은 4주씩 한 달 크레딧의 50% 넘게), 요금표에 연간 결제가 있고
//    1년에 덜 내는 요금제만 — Claude는 Pro만(Max는 월 결제만). 할인 시기는 요금표에 날짜·출처가 있는 할인이 45일 안에 시작하거나 지금 진행 중일 때만.
const MONTH_DAYS = 365.25 / 12, ROOM_LINE = 30, ANNUAL_PCT = 40, ANNUAL_CREDIT = 0.5, DEAL_AHEAD = 45 * DAY_MS;
// 목표 묻기: 「아끼기」는 아끼는 팁(안 쓰는 구독·요금제 맞추기·크레딧 증가·곧 만료되는 초기화권)을 먼저,
// 「막힘 없이 쓰기」는 막히기 전 팁(속도 경고·지금 쓸 초기화권)을 먼저 드리고 요금제를 낮추자는 팁은 뺀다. 고르기 전·「아직 몰라요」는 급한 순서.
export const GOAL_KEYS = ['save', 'smooth', 'unsure'];

export const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/* ---------- 계정 상태(시험 대상) ---------- */
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
export const planKey = plan => String(plan || '').toLowerCase().replace(/[\s_-]/g, '');
export const planName = plan => (plan ? PLAN[planKey(plan)] || String(plan) : '');
// 계정 이름: 메일 앞부분(Gemini도 — 본체가 agy 기록에서 지금 로그인된 계정 메일을 읽는다, 10-22) → API 키 끝 네 글자(서비스가 이미 Typecast라
// 「키」는 붙이지 않는다) → 아직 메일을 못 읽은 Gemini 줄(새 판으로 처음 읽기 전)은 이 PC 로그인 → 직접 넣은 구독 이름.
export const nameOf = row => (row?.email ? row.email.split('@')[0] : row?.keyHint ? row.keyHint : row?.source === 'auto' && row.service === 'gemini' ? '이 PC 로그인' : row?.label || '');

// 계정 하나의 지금 상태.
//  ok 넉넉 · low 10% 이하 남음이나 크레딧 부족 · out 다 씀(unblock = 다시 열리는 때) · login 다시 로그인 ·
//  error 읽기 실패(또는 이번 확인에서 못 읽어 옛 값만 있음) · manual 직접 넣어 한도 숫자가 없음 · unknown 아직 안 읽음.
//  projected: 마지막으로 읽은 뒤 초기화 시각이 지나 「다시 찼을 것」으로 보는 때(그사이 쓴 양은 모른다).
//  away: 지금 PC의 Antigravity에 다른 계정이 로그인돼 있어 마지막으로 읽은 값만 있는 Gemini 계정(본체 state 'elsewhere', 10-22).
//    값은 마지막으로 읽은 그대로 보이되(오래돼도 「못 읽음」으로 바꾸지 않는다) 바로 쓸 계정·손볼 계정으로 세지 않는다.
export function accountState(row, now, checkAt = null) {
  const auto = row?.source === 'auto', readAt = row?.live?.readAt || 0;
  if (auto && row.state === 'elsewhere') return { ...accountState({ ...row, state: 'ok' }, now, null), away: true, readAt };
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

/* ---------- Claude API 크레딧(10-28) ---------- */
// Max 요금제에 매달 딸려 Console 조직에 들어오는 크레딧(공식 안내 10-28 확인 — Max 5x $100 · Max 20x $200. claude.ai에서 Console 조직을 연결해야 받고,
// 결제 주기마다 결제 뒤 들어와 그 주기 끝(다음 결제일)에 사라지며 이월이 없다. Claude Code·채팅 한도와는 따로다). 남은 금액과 만료일은 Console 결제 화면에만
// 보이고 읽는 공식 경로가 없어(개인 조직은 Admin API도 열리지 않는다) 회원이 넣는다. 계정판이 스스로 아는 것은 요금제로 들어오는 금액뿐이다 —
// 요금표(본체가 준 snapshot.prices)의 apiCredit에서, 금액과 같은 60일 문을 따른다. Pro는 말하지 않고, 등급을 못 읽은 Max는 「모름」(unknown)이다.
// 공식 요금처럼(officialPrice) 마지막으로 읽은 지 30일이 넘은 채 못 읽히는 줄(구독을 끊고 로그인만 남았을 수 있다)은 세지 않는다(Fable 최종 P3).
function grantOf(prices, row, now) {
  if (row?.source !== 'auto' || row.service !== 'claude') return null;
  if (row.state !== 'ok' && now - (row.live?.readAt || 0) > 30 * DAY_MS) return null;
  const table = priceTable(prices, 'claude', now), key = planKey(row.plan);
  if (!table) return null;
  const v = num(table.plans?.[key]?.apiCredit);
  return v > 0 ? { grant: v } : key === 'max' ? { unknown: true } : null;
}
export const apiGrant = (prices, row, now) => grantOf(prices, row, now)?.grant ?? null;
// 계정 하나: 넣은 값(left·until·at) · 넣은 값의 만료가 지남(left null, expired) · 안 넣음(left null — 등급을 못 읽은 Max면 unknown).
// Claude 자동 연결 줄이 아니거나, 넣은 값도 들어오는 금액도 없으면 null.
// 만료일은 그날 0시로 받아 그날부터 없는 것으로 본다(사라지는 시각을 몰라 남은 양을 부풀리지 않는 쪽). 그래서 화면은 날짜만 말한다.
export function apiCreditOf(prices, row, now) {
  if (row?.source !== 'auto' || row.service !== 'claude') return null;
  const g = grantOf(prices, row, now), grant = g?.grant ?? null, left = num(row.apiCredit), until = num(row.apiCreditUntil), at = num(row.apiCreditAt);
  if (left === null) return grant ? { grant, left: null } : g?.unknown ? { grant: null, left: null, unknown: true } : null;
  if (until !== null && until <= now) return { grant, left: null, expired: until, at };
  return { grant, left, until, at };
}
// 판 전체: left 만료 전에 넣은 남은 금액의 합 · entered 그 계정 수 · oldest·newest 그 값들을 넣은 가장 이른·늦은 때(넣은 값은 쓰는 만큼 낡는다) ·
// monthly 요금제로 매달 들어오는 금액의 합 · granted 그 계정 수 · unknown 등급을 못 읽어 들어오는 금액을 모르는 Max 계정 수 ·
// first 남은 금액이 있는 계정 가운데 가장 먼저 사라지는 것. 셀 계정이 없으면 null.
export function apiCredits(prices, rows, now) {
  let left = 0, entered = 0, monthly = 0, granted = 0, unknown = 0, oldest = null, newest = null, first = null;
  for (const row of rows || []) {
    const a = apiCreditOf(prices, row, now);
    if (grantOf(prices, row, now)?.unknown) unknown++;
    if (!a) continue;
    if (a.grant) { monthly += a.grant; granted++; }
    if (a.left === null) continue;
    left += a.left; entered++;
    if (a.at) { oldest = oldest === null ? a.at : Math.min(oldest, a.at); newest = newest === null ? a.at : Math.max(newest, a.at); }
    if (a.until && a.left > 0 && (!first || a.until < first.until)) first = { row, until: a.until, left: a.left };
  }
  return entered || granted || unknown ? { left: Math.round(left * 100) / 100, entered, oldest, newest, monthly, granted, unknown, first } : null;
}

// 한눈에 화면의 서비스 묶음(직접 넣은 구독은 이름·종류마다). 월 구독만 넣은 줄은 한도가 없어 「요금·결제일」에만 보인다.
// 묶음 안: 바로 쓸 계정(많이 남은 순, 같으면 큰 요금제) → 풀렸을 계정 → 직접 넣은 구독 → 다 쓴 계정(먼저 풀리는 순) → 못 읽음 → 다시 로그인 → 아직 안 읽음.
export function serviceGroups(rows, now, checkAt = null) {
  const map = new Map();
  for (const row of rows || []) {
    if (row.kind !== 'weekly' && row.kind !== 'credit') continue;
    const auto = row.source === 'auto' && Object.hasOwn(SHORT, row.service), label = String(row.label || '').trim();
    const key = auto ? row.service : `m-${row.kind}-${label.toLowerCase()}`;
    if (!map.has(key)) map.set(key, { key, service: auto ? row.service : null, label: auto ? SHORT[row.service] : label || '직접 넣은 구독', kind: row.kind, accounts: [] });
    map.get(key).accounts.push({ row, name: nameOf(row), ...accountState(row, now, checkAt), pass: passesOf(row, now) });
  }
  const amount = a => a.credits ?? a.left ?? -1, tier = a => TIER[planKey(a.row.plan)] || 0;
  const rank = (a, b) => amount(b) - amount(a) || tier(b) - tier(a);
  const groups = [...map.values()].map(g => {
    // 지금 로그인되지 않은 Gemini 계정(away)은 아래 묶음 어디에도 넣지 않고 따로 둔다(추천·바로 쓸 수·손볼 것에서 빠진다).
    const here = g.accounts.filter(a => !a.away), by = states => here.filter(a => states.includes(a.state));
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
    return { ...g, usable, projected, manual: by(['manual']), out, error: by(['error']), login: by(['login']), pending: by(['unknown']), away: g.accounts.filter(a => a.away), ready, today, best: today || plenty[0] || projected[0] || usable[0] || by(['manual'])[0] || null };
  });
  const order = g => (g.service ? ORDER.indexOf(g.service) : ORDER.length);
  return groups.sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label, 'ko'));
}

// 이번 주 일정: 다 쓴 계정이 다시 열리는 때(unblock) · 쓸 수 있는 계정의 주간 초기화(reset) · 7일 안 결제(bill) · 7일 안 초기화권 만료(pass) ·
// 7일 안 Claude API 크레딧 만료(api)를 시간순으로.
// 한눈에 화면은 unblock의 앞 셋만 보이고, 「모두 보기」를 누르면 그 자리에서 전부 펼친다.
export function upcoming(rows, now, checkAt = null) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const items = [];
  for (const row of rows || []) {
    const a = accountState(row, now, checkAt), pass = passesOf(row, now);
    if (a.state === 'out' && a.unblock) items.push({ t: a.unblock, type: 'unblock', row, focus: a.focus, after: a.focus === 'session' && a.g.weekly ? a.g.weekly.left : null, pass });
    else if ((a.state === 'ok' || a.state === 'low') && a.g?.weekly?.resetsAt && a.g.weekly.resetsAt - now <= 7 * DAY_MS) items.push({ t: a.g.weekly.resetsAt, type: 'reset', row });
    // 연간으로 표시한 줄(3차)의 「매월 n일」은 달마다 오는 결제가 아니라 세지 않는다.
    const dd = row.cycle === 'annual' ? null : nextBill(row.billDay, now), bill = dd !== null && dd <= 6 ? { t: today.getTime() + dd * DAY_MS, type: 'bill', row, days: dd } : null;
    if (bill) items.push(bill);
    // GPT는 초기화권마다 만료가 따로라 그때 사라지는 장수만, 직접 넣은 Claude는 한 만료 때에 넣은 장수 모두.
    if (pass?.until && pass.until - now <= 7 * DAY_MS) items.push({ t: pass.until, type: 'pass', row, count: pass.manual ? pass.count : (row.live?.resets?.until || []).filter(t => t === pass.until).length || 1 });
    // 넣어 둔 Claude API 크레딧이 남은 채 7일 안에 사라지는 때(10-28). 크레딧은 결제 주기 끝에 사라지니 그 계정의 결제일과 같은 날이면 결제 줄에 붙인다(bill.api).
    const api = apiCreditOf(null, row, now);
    if (api?.left > 0 && api.until && api.until - now <= 7 * DAY_MS) {
      if (bill && new Date(bill.t).toDateString() === new Date(api.until).toDateString()) bill.api = api.left;
      else items.push({ t: api.until, type: 'api', row, amount: api.left });
    }
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

/* ---------- 요금표(3차) ---------- */
// 요금표 확인 날짜('YYYY-MM-DD')를 이 PC 시간대의 그날 0시로.
export const dayAt = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null; };
// 본체가 준 서비스별 공식 요금(확인한 날·출처·세금). 확인한 지 60일이 지나면 그 서비스의 금액·결제 주기를 말하지 않는다(null).
export function priceTable(prices, service, now) { const p = prices?.services?.[service], at = dayAt(p?.checked); return p?.plans && at !== null && now - at <= PRICE_FRESH ? { ...p, at } : null; }
// 한국 결제 값: 요금표의 기본값(세전)에 한국 부가세(krVat)를 더한다 — claude.com이 한국에서 $20 → $22로 덧씌워 보이는 것과 같은 규칙(Fable 3차 시안 P2-4).
const shown = (t, v) => Math.round(v * (1 + (t.krVat || 0)) * 100) / 100;
// 요금제 하나의 한국 결제 값: month 월 결제 한 달, year 연간 결제 1년 치(없으면 연간 결제 없음).
export function planPrice(t, key) { const p = t?.plans?.[key]; return p ? { month: shown(t, p.month), year: p.year ? shown(t, p.year) : null } : null; }
// 요금을 넣지 않은 자동 연결 계정의 공식 한 달 요금(한국 결제 값, 확인한 지 60일 안, 연간으로 표시한 계정은 1년 치의 12분의 1). 모르면 null.
// 한 달 요약·요금 합계·결제 목록·입구 글이 모두 이 한 기준을 쓴다(넣은 값이 늘 먼저, 값마다 「공식 요금」·「넣은 요금」을 붙인다).
// 마지막으로 읽은 지 30일이 넘은 채 못 읽히는 줄(구독을 끊고 로그인만 남았을 수 있다)은 채우지 않는다(Fable 3차 시안 P3-1).
export function officialPrice(prices, row, now) {
  if (row.source !== 'auto' || num(row.price) !== null) return null;
  if (row.state !== 'ok' && now - (row.live?.readAt || 0) > 30 * DAY_MS) return null;
  const table = priceTable(prices, row.service, now), plan = planPrice(table, planKey(row.plan));
  return plan ? { price: row.cycle === 'annual' && plan.year ? plan.year / 12 : plan.month, currency: table.currency, table } : null;
}
// 요금 합계: 넣은 값, 없으면 공식 요금. 달러는 회원이 넣은 환율(없으면 1,400원)로 원 어림에 더한다.
export const costOf = (snapshot, rows, now) => costSummary(rows, now, snapshot?.settings?.usdKrw, row => officialPrice(snapshot?.prices, row, now));
// 다음 결제: 달마다 오는 결제일만(연간으로 표시한 줄의 「매월 n일」은 셈하지 않는다 — P3-4).
export const monthlyBill = (row, now) => (row.cycle === 'annual' ? null : nextBill(row.billDay, now));
// 입구 글의 다음 결제 하나(가장 가까운 것). at은 그날 0시.
export function nextMonthlyBill(rows, now) {
  const next = rows.map(r => ({ r, d: monthlyBill(r, now) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d)[0];
  return next ? { row: next.r, days: next.d, at: new Date(now).setHours(0, 0, 0, 0) + next.d * DAY_MS } : null;
}
// 요금·결제일 목록: 넣은 요금·결제일·공식 요금 가운데 하나라도 있는 줄을 결제가 가까운 순으로(결제일이 없으면 뒤로).
export function billList(prices, rows, now) {
  return rows.map(r => ({ row: r, official: officialPrice(prices, r, now), days: monthlyBill(r, now) })).filter(x => num(x.row.price) !== null || x.row.billDay || x.official).sort((a, b) => (a.days ?? 99) - (b.days ?? 99));
}

/* ---------- 지난 7일 사용량(10-19) ---------- */
// 본체가 읽기 기록으로 센 구간 막대 다섯(마지막이 지난 7일). 한도형은 100%를 꼭대기로, 크레딧은 가장 큰 구간을 꼭대기로.
// 조금이라도 쓴 구간은 3% 높이는 보이게, 한도형 90% 이상(10% 이하 남음)은 주의 색. 그 전 평균과의 차이는 지난 7일과 평균이 다 있을 때만.
export function usageBars(usage, group) {
  const u = usage?.services?.[group.service] || null, kind = group.kind === 'credit' ? 'credit' : 'pct', buckets = usage?.buckets || [];
  const raw = Array.from({ length: 5 }, (_, i) => u?.bars?.[i] || null);
  const max = kind === 'pct' ? 100 : Math.max(1, ...raw.map(b => b?.v || 0));
  const bars = raw.map(b => (b ? { ...b, height: Math.min(100, Math.max(b.v > 0 ? 3 : 0, Math.round((b.v / max) * 100))), level: kind === 'pct' && b.v >= 90 ? 'low' : 'ok' } : null));
  const has = !!u && u.base !== null && !!raw[4];
  return { u, kind, buckets, bars, has, diff: has ? raw[4].v - u.base : 0 };
}
// 그 전 평균의 무게: Claude는 요금제 배수, 나머지는 같은 무게.
const weightOf = row => (row.service === 'claude' ? CLAUDE_WEIGHT[planKey(row.plan)] || 1 : 1);
// 다음 충전: 기록의 지난 충전에서 Higgsfield는 30일씩(연간 결제는 30일마다), Typecast는 한 달씩. 기록이 없으면 Typecast만 결제일.
export function nextRefill(service, row, refillAt, now) {
  if (refillAt) { const d = new Date(refillAt); while (d.getTime() <= now) { if (service === 'typecast') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 30); } return d.getTime(); }
  const dd = service === 'typecast' ? nextBill(row.billDay, now) : null;
  return dd === null ? null : new Date(now).setHours(0, 0, 0, 0) + dd * DAY_MS;
}
// 팁 하나의 모양: type(spike·pace·pass·size·idle·annual) · key(반응을 남기는 열쇠) · kind(save 아끼기 · smooth 막힘 없이) · at(일이 닥치는 때, 줄 세우기) · 그 팁 글에 들어갈 숫자.
// 크레딧: 지난 7일이 그 전 평균의 1.5배 그리고 300크레딧 이상. 예측은 잔액이 줄고 있는 계정 하나로(충전일이 계정마다 다르다).
//  forecast: 다음 충전 전에(충전일을 모르면 14일 안에) 바닥날 때만 — basis는 다음 충전을 센 근거(last 지난 충전 · bill 넣어 둔 결제일).
export function spikeTip(snapshot, g, u, now) {
  const s7 = u.bars?.[4]?.v, min = SPIKE_MIN[g.service] ?? 300;
  if (u.base === null || s7 === null || s7 === undefined || s7 < min || s7 < SPIKE_RATIO * u.base) return null;
  const stats = snapshot?.usage?.accounts || {};
  const acc = g.accounts.filter(a => a.credits > 0 && stats[a.row.id]?.perDay > 0).sort((a, b) => stats[b.row.id].used7 - stats[a.row.id].used7)[0];
  let forecast = null, at = now + 7 * DAY_MS;
  if (acc) {
    const st = stats[acc.row.id], emptyAt = now + (acc.credits / st.perDay) * DAY_MS, refill = nextRefill(g.service, acc.row, st.refillAt, now);
    if (refill ? emptyAt < refill : emptyAt - now <= 14 * DAY_MS) {
      // 충전일은 지난 충전에서 센 어림이라 화면은 「쯤」으로 말한다(월 결제는 같은 날짜, 연간 결제는 30일마다 — 공식).
      forecast = { name: acc.name, emptyAt, refill, credits: acc.credits, perDay: st.perDay, refillAt: st.refillAt, basis: st.refillAt ? 'last' : refill ? 'bill' : null };
      at = emptyAt;
    }
  }
  // ratio: 평소의 몇 배인지(소수 첫째 자리 내림) — 그 전 평균이 0이면 null(「평소보다 많이」).
  return { type: 'spike', key: `spike:${g.service}`, kind: 'save', at, service: g.service, label: g.label, s7, base: u.base, baseWeeks: u.baseWeeks, min, ratio: u.base > 0 ? Math.floor((s7 / u.base) * 10) / 10 : null, forecast };
}
// 한도형: 바로 쓸 계정 전부가 이 속도(최근 3일)면 가장 이른 풀리는 때보다 먼저 막힐 때만. 계정 하나가 막히는 건 01이 다음 계정을 권한다.
//  used: 바로 쓸 계정들의 주간 쓴 %(요금제 무게 평균) · rate: 하루 평균 %p · many: 지금 로그인된 계정이 둘 이상.
export function paceTip(snapshot, g, now) {
  const stats = snapshot?.usage?.accounts || {}, live = g.usable.filter(a => a.g?.weekly);
  // 풀렸을 계정은 남은 양을 몰라서, 기록이 3일 안 된 계정이 있으면 속도를 몰라서 말하지 않는다.
  if (!live.length || g.projected.length || live.some(a => !Number.isFinite(stats[a.row.id]?.rate3))) return null;
  let left = 0, rate = 0, weight = 0;
  for (const a of live) { const w = weightOf(a.row); left += a.g.weekly.left * w; rate += stats[a.row.id].rate3 * w; weight += w; }
  const releases = [...live.map(a => a.g.weekly.resetsAt), ...g.out.map(a => a.unblock)].filter(Boolean);
  if (rate <= 0 || !releases.length) return null;
  const blockedAt = now + (left / rate) * DAY_MS, release = Math.min(...releases);
  if (blockedAt > release - PACE_MARGIN) return null;
  // 지금 로그인되지 않은 Gemini 계정은 「모두 막혀요」에 세지 않는다(그 계정으로 바꾸면 이어서 쓸 수 있다).
  return { type: 'pace', key: `pace:${g.service}`, kind: 'smooth', at: blockedAt, service: g.service, label: g.label, many: g.accounts.length - g.away.length > 1, live: live.length, release, used: 100 - Math.round(left / weight), rate: Math.round(rate / weight) };
}
// 초기화권을 지금 쓸 때인지(막힌 줄 안내와 팁이 같은 기준을 쓴다).
//  바로 쓸 계정·풀렸을 계정이 있으면 아껴 둔다 → 묶음에서 가장 먼저 풀리는 때가 하루 안이면 그때까지 기다린다 →
//  못 읽은·다시 로그인할·확인 전 계정이 있으면 그 계정부터 본다 → 모든 계정이 막혔고 하루 넘게 남았을 때만 「지금」.
export function passPlan(g, now) {
  const first = g.out.filter(a => a.unblock).sort((x, y) => x.unblock - y.unblock)[0] || null;
  if (g.usable.length || g.projected.length) return { use: false, why: g.ready.some(a => a.state === 'ok') ? 'roomy' : g.projected.length ? 'projected' : 'low', first };
  if (first && first.unblock - now < PASS_WAIT) return { use: false, why: 'soon', first };
  if (g.error.length || g.login.length || g.pending.length) return { use: false, why: 'unread', first };
  return { use: true, why: 'all', first };
}
// 「곧 만료」 한 줄의 갈래: 주간 초기화가 만료보다 먼저 오면(reset) GPT는 지금 쓰면 그 초기화가 사라지고(공식), Claude는 그대로라 하루 안일 때만 초기화 뒤를 권한다.
// 아니면 주간을 50% 넘게 썼는지(used) · 아직 덜 썼는지(later). 못 읽은·다시 로그인할 계정의 %는 옛 값이라 쓰지 않는다(직접 넣은 Claude 장수만 팁에 남는 경우).
export function passExpiry(g, a, now) {
  const stale = ['error', 'login'].includes(a.state), w = stale ? null : a.g?.weekly;
  const used = w ? 100 - w.left : null, reset = w?.resetsAt || null, until = a.pass.until, gpt = g.service === 'gpt';
  const first = gpt ? reset && reset < until : reset && reset < until && reset - now < PASS_WAIT;
  return { gpt, hint: first ? 'reset' : used !== null && used >= 50 ? 'used' : 'later', reset, used };
}
// 초기화권 팁: ① 모든 계정이 막혔고 가장 먼저 풀리는 때가 하루 넘게 남았으면 「쓰면 지금 풀려요」(mode now, 먼저 만료되는 것부터, passPlan과 같은 기준)
// ② 아니면 만료가 3일 안인 것을 「만료 전에」(mode expiry). 못 읽은·다시 로그인할 GPT 계정의 옛 값은 그사이 썼을 수 있어 팁에 쓰지 않는다.
export function passTip(g, now) {
  if (g.service !== 'gpt' && g.service !== 'claude') return null;
  const holders = g.accounts.filter(a => a.pass && (a.pass.manual || !['error', 'login'].includes(a.state)));
  if (!holders.length) return null;
  const base = { type: 'pass', key: `pass:${g.service}`, service: g.service, label: g.label, many: g.accounts.length > 1 }, plan = passPlan(g, now);
  const blocked = holders.filter(a => a.state === 'out').sort((x, y) => (x.pass.until ?? Infinity) - (y.pass.until ?? Infinity));
  if (plan.use && blocked.length) {
    const a = blocked[0];
    return { ...base, mode: 'now', at: now, kind: 'smooth', name: a.name, total: holders.reduce((sum, h) => sum + h.pass.count, 0), until: a.pass.until, release: plan.first?.unblock || null };
  }
  const soonest = holders.filter(a => a.pass.until && a.pass.until - now <= PASS_SOON).sort((x, y) => x.pass.until - y.pass.until)[0];
  if (!soonest) return null;
  return { ...base, mode: 'expiry', at: soonest.pass.until, kind: 'save', name: soonest.name, until: soonest.pass.until, count: soonest.pass.count, manual: soonest.pass.manual, hint: passExpiry(g, soonest, now) };
}
// 두 팁(요금제 맞추기·안 쓰는 구독)과 한 달 요약은 4주 소비를 다 알 때만 말한다: 지금 읽히는 자동 연결 계정이고, 4주를 처음부터 덮었고, 놓친 틈이 없고,
// 7일마다 읽은 적이 있을 때(못 읽은 주를 「안 썼다」로 세지 않게 — Fable 2차 검수 P1-2).
const fourKnown = (row, w4) => row.source === 'auto' && row.state === 'ok' && !!w4?.cover && !!w4.known && w4.weeks.every(w => w.reads > 0);
// 요금제 맞추기(Claude, 2차): 주간이 4주 모두 기준 이하이고 읽은 5시간 % 최고도 낮춘 요금제에 들어가는 Max 계정을 한 단계 아래로.
// 덜 내는 액수가 큰 계정부터. 7일마다 「쓴 양」과 「읽은 가장 높은 주간 %」 가운데 큰 값을 본다(값은 지금 요금제 기준).
//  saving: 공식 요금(60일 안)으로 한 달 덜 내는 값 · proYear/proMonth: Pro 연간 결제 1년 치와 그 12분의 1 · maxMonthly: 요금표에 Max 연간 결제가 없음.
export function sizeTip(snapshot, g, now) {
  if (g.service !== 'claude') return null;
  const stats = snapshot?.usage?.accounts || {}, table = priceTable(snapshot?.prices, 'claude', now), month = k => planPrice(table, k)?.month ?? null;
  const fits = g.accounts.map(a => {
    const plan = planKey(a.row.plan), rule = SIZE_DOWN[plan], w4 = stats[a.row.id]?.weeks4;
    if (!rule || !fourKnown(a.row, w4) || !w4.hCover || w4.hPeak === null || w4.hPeak >= rule.h5) return null;
    const highs = w4.weeks.map(w => Math.max(w.used, w.peak ?? 0));
    return highs.some(v => v > rule.limit) ? null : { a, rule, highs, hPeak: w4.hPeak, weight: CLAUDE_WEIGHT[plan], saving: month(plan) !== null && month(rule.to) !== null ? month(plan) - month(rule.to) : null };
  }).filter(Boolean).sort((x, y) => (y.saving ?? -1) - (x.saving ?? -1) || y.weight - x.weight);
  const f = fits[0];
  if (!f) return null;
  // 낮출지는 다음 결제 전에 정해야 하니 결제일을 넣어 둔 계정이면 그날 기준으로 줄을 세운다.
  // 모르면 열흘 뒤 — 몇 주씩 맞는 팁이라 기한이 있는 팁(결제 5일 안·만료 3일 안)을 먼저 보이고 그 뒤에 선다.
  const dd = nextBill(f.a.row.billDay, now), at = dd === null ? now + 10 * DAY_MS : new Date(now).setHours(0, 0, 0, 0) + dd * DAY_MS;
  // 공식 배수는 5시간 창 기준이고 주간 배수는 공식 자료에 없다(Fable 2차 P2-1). 결제 주기도 금액과 같이 60일이 지나면 말하지 않는다(P3-1) —
  // 둘 다 요금표에서: 연간 결제가 있는 Pro는 그 값으로, 연간 결제가 없는 Max는 「월 결제만」.
  const pro = planPrice(table, 'pro'), hPeak = Math.round(f.hPeak);
  return { type: 'size', key: 'size:claude', kind: 'save', at, service: 'claude', name: f.a.name, plan: f.a.row.plan, rule: f.rule, highs: f.highs, hPeak, hScaled: hPeak * f.rule.times, saving: f.saving, proYear: pro?.year ?? null, proMonth: pro?.year ? pro.year / 12 : null, maxMonthly: !!(table && !table.plans.max5x?.year && !table.plans.max20x?.year), table };
}
// 안 쓰는 구독(2차): Claude와 크레딧형만. 4주 모두 5% 이하(크레딧은 4주 동안 0)이고 넣어 둔 결제일이 5일 안일 때 「계속 쓸지 정해 보세요」.
// 결제일이 가까운 것부터(days 0은 결제일 당일 — 이미 결제됐을 수 있어 화면이 「결제 전에」라고 하지 않는다, Fable 2차 P3-3).
export function idleTip(snapshot, g, now) {
  const credit = g.kind === 'credit';
  if (!credit && g.service !== 'claude') return null;
  const stats = snapshot?.usage?.accounts || {};
  const found = g.accounts.map(a => {
    const w4 = stats[a.row.id]?.weeks4, dd = nextBill(a.row.billDay, now);
    // 연간 결제로 표시한 계정(3차)은 달마다 오는 결제일이 아니라 1년에 한 번이라 「결제 전에」를 말하지 않는다.
    if (a.row.cycle === 'annual' || !fourKnown(a.row, w4) || dd === null || dd > IDLE_BILL_DAYS) return null;
    const highs = w4.weeks.map(w => (credit ? w.used : Math.max(w.used, w.peak ?? 0)));
    return (credit ? highs.some(v => v > 0) : highs.some(v => v > IDLE_LIMIT)) ? null : { a, dd, highs };
  }).filter(Boolean).sort((x, y) => x.dd - y.dd);
  const f = found[0];
  if (!f) return null;
  const billAt = new Date(now).setHours(0, 0, 0, 0) + f.dd * DAY_MS;
  return { type: 'idle', key: `idle:${g.service}`, kind: 'save', at: billAt, service: g.service, credit, name: f.a.name, days: f.dd, billAt, price: num(f.a.row.price) !== null ? { amount: f.a.row.price, currency: f.a.row.currency } : null, highs: f.highs };
}
// 쉬는 팁: 반응한 팁은 정해진 때(until)까지 쉰다. 다만 이 화면에서 방금 반응한 팁(answered — 화면이 넘겨 주는 값)은 누른 뒤 한 줄을 보여야 해서 그대로 둔다.
const isResting = (settings, key, now, answered) => (Number(settings?.tips?.[key]?.until) || 0) > now && !answered?.[key];
// 「그만」을 누른 팁이 쉬는 동안(본체가 남긴 횟수): 처음은 4주, 두 번째부터 12주.
export const restWeeks = (settings, key) => (Number(settings?.tips?.[key]?.stops) > 1 ? 12 : 4);
// 지금 쉬고 있는 팁 수(prefix로 갈래를 고른다 — 'annual:'은 연간 결제 팁만). 방금 「그만」을 누른 팁도 센다.
export const restingCount = (settings, now, prefix = '') => Object.keys(settings?.tips || {}).filter(key => key.startsWith(prefix) && (Number(settings.tips[key]?.until) || 0) > now).length;
// 지난 7일 사용량 칸의 팁: 서비스마다 사용량(크레딧 급증·한도형 속도)·초기화권·요금제 맞추기·안 쓰는 구독 팁 가운데 쉬지 않는 것 중 하나
// (초기화권 팁은 기록이 없어도 뜬다), 칸 전체에 급한 것(일이 먼저 닥치는 것)부터 둘까지. 목표에 맞는 갈래(kind)를 먼저 세운다.
// 「막힘 없이 쓰기」를 고르면 요금제를 낮추자는 팁은 내지 않고, 「팁 끄기」면 하나도 고르지 않는다.
// groups: 칸에 줄로 보일 서비스 묶음(화면이 고른다). 돌려주는 tips는 서비스 → 팁.
export function pickUsageTips(snapshot, groups, now, answered = {}) {
  const settings = snapshot?.settings || {}, goal = GOAL_KEYS.includes(settings.goal) ? settings.goal : null, off = settings.tipsOff === true;
  const rank = t => ((goal === 'save' && t.kind === 'save') || (goal === 'smooth' && t.kind === 'smooth') ? 0 : 1);
  const order = (a, b) => rank(a) - rank(b) || a.at - b.at;
  const pick = g => { const u = snapshot.usage?.services?.[g.service]; return [u ? (g.kind === 'credit' ? spikeTip(snapshot, g, u, now) : paceTip(snapshot, g, now)) : null, passTip(g, now), goal === 'smooth' ? null : sizeTip(snapshot, g, now), idleTip(snapshot, g, now)].filter(t => t && !isResting(settings, t.key, now, answered)).sort(order)[0] || null; };
  const chosen = off ? [] : groups.map(g => { const tip = pick(g); return tip ? { service: g.service, tip } : null; }).filter(Boolean)
    .sort((a, b) => order(a.tip, b.tip)).slice(0, MAX_TIPS);
  return { goal, off, tips: new Map(chosen.map(c => [c.service, c.tip])), resting: restingCount(settings, now) };
}

/* ---------- 한 달 요약(3차, Fable 1차 아이디어 6) ---------- */
// 계정 하나의 한 달 요금(원으로 어림): 넣은 값, 없으면 공식 요금. 모르면 null.
export function monthPrice(snapshot, row, now) {
  const rate = Number(snapshot?.settings?.usdKrw) || 1400, won = (v, currency) => (currency === 'USD' ? v * rate : v);
  if (num(row.price) !== null) return { krw: won(Number(row.price), row.currency), official: false };
  const o = officialPrice(snapshot?.prices, row, now);
  return o ? { krw: won(o.price, o.currency), official: true, table: o.table } : null;
}
// 크레딧형 한 달 크레딧: Typecast는 API가 알려 준 이번 요금제 크레딧, 없으면 요금표. 요금제 사실이라 60일 문 밖이다(금액·결제 주기만 문 안 — Fable 3차 시안 P2-1).
// Higgsfield Ultra는 CLI가 등급(3,000·6,000·9,000)을 알려 주지 않아 가장 작은 3,000으로 둔다(큰 등급이면 쓴 몫이 크게 잡혀 여유를 부풀리지 않는 쪽).
export function monthCredits(prices, row) { const own = num(row.live?.planCredits); return own > 0 ? { credits: own, own: true } : (c => (c ? { credits: c, own: false } : null))(prices?.services?.[row.service]?.plans?.[planKey(row.plan)]?.credits); }
export const ultraGuess = (row, allot) => row.service === 'higgsfield' && planKey(row.plan) === 'ultra' && allot && !allot.own;
export const summaryOn = settings => settings?.summaryOff !== true;
// 넣는 계정: 4주 소비를 다 아는(fourKnown) Claude(대화·Claude Code가 한 한도)와 크레딧형 자동 연결 계정. GPT·Gemini의 %는 Codex·Antigravity 한도라 구독 전체를 말하지 못해 뺀다.
// 쓴 몫: Claude는 7일마다 「쓴 양」과 「읽은 가장 높은 주간 %」 가운데 큰 값의 4주 평균(적게 잡지 않게 — 2차 안 쓰는 구독과 같은 잣대),
// 크레딧형은 4주 동안 쓴 크레딧 ÷ 4주치 한 달 크레딧(한 달 = 365.25/12일). 100%를 넘으면 100%로 본다. 공식 요금이 $0인 무료 요금제는 구독이 아니라 뺀다.
// 빠지는 까닭은 따로 센다: waiting(4주 기록이 모자람), noCredits(한 달 크레딧을 모름).
// 셈할 계정이 없으면 wait로 까닭을 준다: until(첫 기록에서 4주 뒤 waitAt쯤) · first(기록이 아직 없음 — 첫 기록부터 4주 뒤) · gaps(그 날이 지났는데 읽지 못한 주가 있음) ·
// credits(한 달 크레딧을 몰라서 — 기록 탓으로 말하지 않는다, Fable 3차 시안 P2-1).
// 셈할 계정이 있으면: total 구독료(요금을 아는 계정끼리), worth 쓴 만큼 값, pct 쓴 몫(금액이 없으면 계정 평균), list 여유가 많은 계정부터, room 가장 여유가 많은 계정(30% 넘게 남았을 때만),
// tables 공식 요금을 쓴 서비스의 요금표, usd 달러를 원으로 셈했는지, guessed Ultra 등급을 어림했는지, unpriced 요금을 모르는 계정 수.
export function monthSummary(snapshot, rows, now) {
  const stats = snapshot?.usage?.accounts || {}, items = [];
  let waiting = 0, noCredits = 0, since = null, fresh = false;
  for (const row of rows) {
    if (row.source !== 'auto' || !(row.service === 'claude' || row.kind === 'credit') || !Object.hasOwn(SHORT, row.service)) continue;
    const st = stats[row.id], w4 = st?.weeks4, allot = row.kind === 'credit' ? monthCredits(snapshot?.prices, row) : null, price = monthPrice(snapshot, row, now);
    if (price && price.official && price.krw === 0) continue;
    if (!fourKnown(row, w4)) { waiting++; if (st?.since) since = since === null ? st.since : Math.min(since, st.since); else fresh = true; continue; }
    if (row.kind === 'credit' && !allot) { noCredits++; continue; }
    const share = Math.min(1, Math.max(0, row.kind === 'credit' ? w4.weeks.reduce((n, w) => n + w.used, 0) / ((allot.credits * 28) / MONTH_DAYS) : w4.weeks.reduce((n, w) => n + Math.max(w.used, w.peak ?? 0), 0) / 400));
    items.push({ row, share, price, guess: ultraGuess(row, allot), worth: price ? price.krw * share : null });
  }
  if (!items.length) {
    if (!waiting && !noCredits) return null;
    const at = since ? since + 28 * DAY_MS : null;
    return { items, waiting, noCredits, since, fresh, wait: waiting ? (at && at > now ? 'until' : fresh && !since ? 'first' : 'gaps') : 'credits', waitAt: at };
  }
  // 금액은 요금을 아는 계정끼리만 더한다. 하나도 없으면(요금표가 오래됐고 넣은 요금도 없음) %만 말한다.
  const priced = items.filter(i => i.price), total = priced.reduce((n, i) => n + i.price.krw, 0), worth = priced.reduce((n, i) => n + i.price.krw * i.share, 0);
  const pct = total > 0 ? Math.round((worth / total) * 100) : Math.round((items.reduce((n, i) => n + i.share, 0) / items.length) * 100);
  const list = [...items].sort((a, b) => a.share - b.share || (b.price?.krw ?? 0) - (a.price?.krw ?? 0));
  const tables = [...new Set(priced.filter(i => i.price.official).map(i => i.row.service))].map(service => ({ service, table: priceTable(snapshot?.prices, service, now) })).filter(x => x.table);
  return { items, waiting, noCredits, since, priced, total, worth, pct, list, room: (1 - list[0].share) * 100 >= ROOM_LINE ? list[0] : null, hasMoney: total > 0, rate: Number(snapshot?.settings?.usdKrw) || 1400, tables, usd: total > 0 && priced.some(i => i.price.official || i.row.currency === 'USD'), guessed: items.some(i => i.guess), unpriced: items.length - priced.length };
}

/* ---------- 연간 결제·할인 시기(3차, Fable 1차 아이디어 7) ---------- */
// 서비스마다 12주 내내 꾸준히 쓴 계정 하나(1년에 덜 내는 액수가 큰 계정부터). 요금표가 60일 안이고 그 요금제에 연간 결제가 있어야 한다.
//  Claude: 4주씩 주간 한도를 평균 40% 넘게(쓴 양만, 한 주는 100%까지 — 놓친 틈은 적게 잡혀 「많이 썼다」를 부풀리지 않는다). Higgsfield: 4주씩 한 달 크레딧의 50% 넘게.
//  12주 동안 요금제를 바꾼 계정(옛 구간이 지금 무게로 부풀어 보임), 이미 연간으로 표시한 계정, 지금 읽히지 않는 계정은 뺀다.
//  Typecast API·GPT 개인·Gemini는 확인한 연간 결제가 없어 말하지 않는다.
// 할인 시기(deal): 요금표에 날짜·출처가 있고 확인한 지 60일 안인 할인이 45일 안에 시작하거나 진행 중일 때만(그 요금제·연간 결제에 해당하는 것).
//  fromAt 시작일 0시 · untilAt 끝나는 날의 마지막 순간 · checkedAt 확인한 날 0시 · upcoming 아직 시작 전.
// 돌려주는 값: saving 1년에 덜 내는 값(센트까지), perMonth 연간 결제의 한 달 꼴, blocks 4주씩 쓴 양, averages 4주씩 주간 평균(Claude),
//  line 기준 %(Claude 40 · 크레딧 50), lock 연간에서 월로 못 돌아옴, at 줄 세우기(할인 시작·끝, 없으면 30일 뒤).
export function annualTips(snapshot, rows, now) {
  const stats = snapshot?.usage?.accounts || {}, tips = [];
  for (const service of ['claude', 'higgsfield']) {
    const table = priceTable(snapshot?.prices, service, now);
    if (!table) continue;
    const fits = rows.filter(r => r.source === 'auto' && r.service === service && r.state === 'ok' && r.cycle !== 'annual').map(row => {
      const plan = planPrice(table, planKey(row.plan)), w12 = stats[row.id]?.weeks12, saving = plan?.year ? Math.round((plan.month * 12 - plan.year) * 100) / 100 : 0;
      if (saving <= 0 || !w12?.cover || w12.samePlan === false || w12.weeks?.length !== 12 || w12.weeks.some(w => !w.reads)) return null;
      const allot = service === 'claude' ? null : monthCredits(snapshot?.prices, row);
      const blocks = [0, 4, 8].map(i => w12.weeks.slice(i, i + 4).reduce((n, w) => n + (service === 'claude' ? Math.min(100, w.used) : w.used), 0));
      const steady = service === 'claude' ? blocks.every(v => v / 4 > ANNUAL_PCT) : !!allot && blocks.every(v => v > (ANNUAL_CREDIT * allot.credits * 28) / MONTH_DAYS);
      return steady ? { row, plan, blocks, allot, saving } : null;
    }).filter(Boolean).sort((x, y) => y.saving - x.saving || y.blocks.reduce((a, b) => a + b, 0) - x.blocks.reduce((a, b) => a + b, 0));
    const f = fits[0];
    if (!f) continue;
    const deal = (snapshot?.prices?.deals || []).filter(d => d.service === service && (!d.plans || d.plans.includes(planKey(f.row.plan))) && dayAt(d.checked) !== null && now - dayAt(d.checked) <= PRICE_FRESH)
      .map(d => ({ ...d, fromAt: dayAt(d.from), untilAt: dayAt(d.until) + DAY_MS - 1, checkedAt: dayAt(d.checked) })).filter(d => d.fromAt !== null && d.untilAt >= now && d.fromAt - now <= DEAL_AHEAD).sort((a, b) => a.fromAt - b.fromAt)[0] || null;
    tips.push({ type: 'annual', key: `annual:${service}`, kind: 'save', service, row: f.row, rowId: f.row.id, plan: f.plan, perMonth: f.plan.year / 12, saving: f.saving, blocks: f.blocks, averages: f.blocks.map(v => v / 4), allot: f.allot, guess: ultraGuess(f.row, f.allot), deal, upcoming: !!deal && deal.fromAt > now, lock: !!table.annualLock, line: service === 'claude' ? ANNUAL_PCT : Math.round(ANNUAL_CREDIT * 100), table, at: deal ? (deal.fromAt > now ? deal.fromAt : deal.untilAt) : now + 30 * DAY_MS });
  }
  return tips.sort((a, b) => a.at - b.at);
}
// 요금·결제일 칸에 보일 연간 결제 팁(「팁 끄기」면 없음, 쉬는 팁은 뺀다). 서비스마다 하나, 화면에 둘까지.
export const shownAnnual = (snapshot, rows, now, answered = {}) => (snapshot?.settings?.tipsOff === true ? [] : annualTips(snapshot, rows, now).filter(t => !isResting(snapshot?.settings, t.key, now, answered)).slice(0, MAX_TIPS));
