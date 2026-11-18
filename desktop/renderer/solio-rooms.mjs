// 솔리오 안쪽의 나머지(2단계 둘째 조각)를 구독 스냅숏에서 만든다. DOM이 없다.
// 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 1~4절. 셈은 subscriptions-model.mjs를 그대로 쓰고,
// 이 파일은 그 숫자를 합니다체 글과 줄 자료로 옮긴다. 옛 구독 판(subscriptions.mjs)의 입력 검사 규칙은 닫힌 함수 안에 있어 여기에 옮겨 적었다(설계 14절 D3).
//
// 줄 하나: { key, nm, sub, mid, val, when, now, unread, gap, label, more }
// 안쪽 한 줄은 [종류, …]이다(시안 nodesOf). 함수 대신 동작 이름을 적는다.
//   ['say', 글] · ['note', 글] · ['cmd', 명령 원문] · ['live', 글]
//   ['row', 이름, 가운데, 값, 오른쪽, 밝힘] — 칸은 글, 단추 [글, 동작, 인자, 표시], 또는 { text, btn: 단추 }
//   ['acts', [단추…], 앞 글] — 단추는 [글, 동작, 인자, 표시]. 표시는 'far' · 'off' · 'warn' · 'enter' · 'top'(바깥 동작)을 띄어 적는다
//   ['pick', 이름, [[글, 값]…], 지금 값, 칸 이름, 동작] · ['fld', 이름, 값, 도움말, 칸 이름, 종류] · ['qa', 물음, 답] · ['grp', 이름, [안쪽…], 숨김]
import { ORDER, num, nameOf, planName, planKey, accountState, passesOf, passPlan, apiCreditPlan, apiCreditOf, apiCreditEndsAtBill, apiCredits, API_CREDIT_SERVICES, flowCreditOf, flowCredits, officialPrice, costOf, billList, nextMonthlyBill, monthSummary, summaryOn, shownAnnual, serviceGroups, isUsedUp, nextBill, DAY_MS } from './subscriptions-model.mjs';
import { SOLIO_TODAY_NAMES, josa, joinNames } from './solio-today.mjs';

/* ── 오류 코드의 글. 옛 구독 판의 CODE_TEXT를 합니다체로 다시 썼다. 표에 없으면 DEFAULT_SAY다 ── */
export const CODE_SAY = Object.freeze({
  TOOL_MISSING: '먼저 공식 프로그램을 설치해 주세요. 설치한 뒤 「다시 확인」을 누릅니다.',
  NOT_LOGGED_IN: '이 PC에 가져올 로그인이 없습니다. 「새 계정 연결」로 로그인해 주세요.',
  LOGIN_BUSY: '다른 로그인이 진행 중입니다. 끝내거나 취소한 뒤 다시 해 주세요.',
  INVALID_EMAIL: '이메일 형식을 확인해 주세요.',
  INVALID_CODE: '코드를 띄어쓰기나 줄바꿈 없이 그대로 붙여 넣어 주세요.',
  NODE_REQUIRED: 'Higgsfield CLI는 Node.js가 있어야 설치됩니다. 먼저 「Node.js 받기」로 설치해 주세요.',
  SIGN_IN_REQUIRED: 'SYNK ID로 로그인한 뒤 쓸 수 있습니다.',
  LAUNCHER_ONLY: 'SYNK Platform PC 앱에서 쓸 수 있습니다.',
  LABEL_REQUIRED: '서비스 이름을 넣어 주세요.',
  TOO_MANY_ROWS: '구독은 200개까지 넣을 수 있습니다.',
  INSTALLER_FAILED: '설치 창을 열지 못했습니다. 명령을 복사해 PowerShell에 붙여 넣어 주세요.',
  INVALID_KEY_FORMAT: 'API 키를 띄어쓰기 없이 그대로 붙여 넣어 주세요.',
  INVALID_KEY: 'Typecast가 이 키를 받지 않았습니다. 키 화면에서 다시 복사해 붙여 넣어 주세요.',
  KEY_CHECK_FAILED: 'Typecast 크레딧을 확인하지 못했습니다. 잠시 뒤 다시 해 주세요.',
  NETWORK: 'Typecast에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.',
  SECURE_STORAGE_UNAVAILABLE: '이 PC에서는 키를 안전하게 저장할 수 없어 연결하지 않았습니다.',
  BOARD_BUSY: '다른 프로그램이 구독 관리 파일을 잠깐 쓰고 있습니다. 잠시 뒤 다시 해 주세요.',
  NO_WORKSPACE: 'Higgsfield에서 쓸 작업공간이 골라져 있지 않습니다. 터미널에서 「higgsfield workspace set」으로 고른 뒤 다시 해 주세요.',
  SAVE_FAILED: '이 PC에 저장하지 못했습니다. 잠시 뒤 다시 해 주세요.',
  DELETE_FAILED: '모은 숫자를 지우지 못해 켜 둔 채로 두었습니다. 다른 프로그램이 그 파일을 쓰고 있을 수 있습니다. 잠시 뒤 다시 꺼 주세요.',
});
export const DEFAULT_SAY = '요청을 마치지 못했습니다. 잠시 뒤 다시 해 주세요.';
export const codeSay = code => (code && Object.hasOwn(CODE_SAY, code) ? CODE_SAY[code] : DEFAULT_SAY);

/* ── 글자 ── */
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const NUM_WORD = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
const countWord = n => NUM_WORD[n] || n + '개';
const pad = n => String(n).padStart(2, '0');
const fmt = n => Math.round(Number(n) || 0).toLocaleString('ko-KR');
export const won = n => fmt(n) + '원';
export const usd = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const money = (v, currency) => (currency === 'USD' ? usd(v) : won(v));
const md = t => (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일')(new Date(t));
const hm = t => (d => pad(d.getHours()) + ':' + pad(d.getMinutes()))(new Date(t));
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysBetween = (t, now) => Math.round((dayStart(t) - dayStart(now)) / DAY_MS);
const dayAfter = (now, n) => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const isoDay = t => (d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()))(new Date(t));
const neun = w => josa(w, ['은', '는']), ga = w => josa(w, ['이', '가']), eul = w => josa(w, ['을', '를']);
/* 7일 안이면 「목요일 09:00」, 오늘이면 「오늘 09:00」, 그 뒤는 「12월 3일」 */
function dayTime(t, now) {
  const days = daysBetween(t, now);
  if (t < now || days >= 7) return md(t);
  return (days === 0 ? '오늘' : days === 1 ? '내일' : WEEKDAY[new Date(t).getDay()] + '요일') + ' ' + hm(t);
}
/* 계정 줄의 읽은 때: 2분 안 「방금 읽음」, 오늘 「09:12에 읽음」, 그 전 「11월 16일에 읽음」 */
export function readWord(readAt, now) {
  if (!readAt) return '';
  if (now - readAt < 2 * 60e3) return '방금 읽음';
  return dayStart(readAt) === dayStart(now) ? hm(readAt) + '에 읽음' : md(readAt) + '에 읽음';
}
const svcName = row => (row?.source === 'auto' && SOLIO_TODAY_NAMES[row.service]) || String(row?.label || '').trim() || '직접 넣은 구독';
/* 문장 속 계정 이름: 「Codex work 계정」. 메일 앞부분은 영문이 많아 조사를 바로 붙이지 않고 「계정」 뒤에 붙인다. 직접 넣은 구독은 넣은 이름 하나다 */
const whoOf = row => (row?.source === 'auto' ? [svcName(row), nameOf(row), '계정'].filter(Boolean).join(' ') : svcName(row));
const KIND_NAME = Object.freeze({ weekly: '주간 한도', credit: '크레딧', plan: '월 구독만' });
const KIND_PICK = Object.freeze([['주간 한도', 'weekly'], ['크레딧', 'credit'], ['월 구독만', 'plan']]);
/* 이름을 넣으면 한도 종류를 저절로 고른다(옛 MANUAL_KIND). 한도 종류를 고르지 않았을 때만 쓴다 */
const MANUAL_KIND = Object.freeze({ suno: 'credit', typecast: 'credit', elevenlabs: 'credit', kling: 'credit', higgsfield: 'credit', claude: 'weekly', gpt: 'weekly', chatgpt: 'weekly' });
export const manualKindOf = label => MANUAL_KIND[String(label || '').trim().toLowerCase().replace(/\s+/g, '')] || null;
const GEMINI_PLANS = Object.freeze([['고르지 않음', ''], ['Pro', 'pro'], ['Ultra 5x', 'ultra_5x'], ['Ultra 20x', 'ultra_20x'], ['Plus', 'plus'], ['가족 공유', 'family']]);
const geminiPlanChoice = row => row?.source === 'auto' && row.service === 'gemini';
const LOGIN_SOON_MS = 7 * DAY_MS;
const loginSoon = (row, now) => row?.source === 'auto' && row.state === 'ok' && num(row.loginUntil) !== null && row.loginUntil - now <= LOGIN_SOON_MS;
const activeLogin = login => !!login && !['done', 'error', 'cancelled'].includes(login.stage);
const flags = (...list) => list.filter(Boolean).join(' ');

/* ── 입력 검사(옛 onForm 335~383행의 규칙). { ok:true, … } 또는 { ok:false, say } ── */
const clean = v => String(v ?? '').trim();
const numText = v => clean(v).replace(/[,\s원₩$]/g, '');
const parseDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').map(Number) : null);
const parseTime = (s, fallback) => (/^\d{1,2}:\d{2}$/.test(s || '') ? s : fallback).split(':').map(x => parseInt(x, 10) || 0);
const bad = say => ({ ok: false, say });

export function checkBillDay(value) {
  const text = numText(value);
  if (text === '') return { ok: true, value: null };
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? { ok: true, value: n } : bad('결제일은 1부터 31 사이로 넣어 주세요.');
}
function checkPrice(value) {
  const text = numText(value);
  if (text === '') return { ok: true, value: null };
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? { ok: true, value: n } : bad('월 구독료는 0 이상의 숫자로 넣어 주세요.');
}
function optionalNumber(value, say) {
  const text = numText(value);
  if (text === '') return { ok: true, value: null };
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? { ok: true, value: n } : bad(say);
}
/* 초기화권: 0~20장(넘치면 옛 판처럼 20으로 둔다), 만료 시각을 비우면 그날 23:59, 이미 지난 때는 받지 않는다 */
export function parsePass(fields, now) {
  const count = Math.max(0, Math.min(20, Math.round(num(numText(fields.passCount)) ?? 0)));
  const date = parseDate(clean(fields.passDate)), [h, m] = parseTime(clean(fields.passTime), '23:59');
  const until = count && date ? new Date(date[0], date[1] - 1, date[2], h, m, 0, 0).getTime() : null;
  if (until !== null && until <= now) return bad('만료 때가 이미 지났습니다. 날짜를 확인해 주세요.');
  return { ok: true, patch: { passCount: count, passUntil: until } };
}
/* API 크레딧: 0~100,000달러. Claude와 Codex는 만료 날짜가 있어야 하고 오늘이나 지난 날은 받지 않는다. 금액을 비우면 넣은 값을 지운다.
   월 결제이고 결제일이 비어 있으면 만료 날짜의 일로 결제일을 채운다(크레딧은 결제 주기 끝에 사라진다) */
export function parseApi(fields, row, now) {
  const text = numText(fields.apiCredit), amount = text === '' ? null : num(text);
  if (text !== '' && (amount === null || amount < 0 || amount > 100000)) return bad('남은 금액은 0에서 100,000달러 사이 숫자로 넣어 주세요.');
  const value = amount === null ? null : Math.round(amount * 100) / 100;
  if (row?.service === 'gemini') return { ok: true, patch: { apiCredit: value } };
  const date = parseDate(clean(fields.apiDate));
  const until = amount !== null && date ? new Date(date[0], date[1] - 1, date[2]).getTime() : null;
  if (amount !== null && until === null) return bad('결제 화면에 보이는 만료 날짜도 넣어 주세요.');
  if (until !== null && until <= now) return bad(dayStart(until) === dayStart(now) ? '오늘 사라지는 크레딧은 세지 않습니다. 오늘 안에 써 주세요.' : '만료 날짜가 이미 지났습니다. 날짜를 확인해 주세요.');
  const billDay = until !== null && row && !row.billDay && row.cycle !== 'annual' && apiCreditEndsAtBill(row) ? date[2] : null;
  return { ok: true, patch: { apiCredit: value, apiCreditUntil: until, ...(billDay ? { billDay } : {}) }, billDay };
}
/* Flow 크레딧: 0~10,000,000 정수, 다시 차는 날짜가 있어야 하고 지금보다 뒤다. 시각을 비우면 그날 23:59. 가족 공유 계정은 결제일을 채우지 않는다 */
export function parseFlow(fields, row, now) {
  const text = numText(fields.flowCredit), amount = text === '' ? null : num(text);
  if (text !== '' && (amount === null || amount < 0 || amount > 10000000 || !Number.isInteger(amount))) return bad('남은 Flow 크레딧은 0에서 10,000,000 사이 정수로 넣어 주세요.');
  const date = parseDate(clean(fields.flowDate)), [h, m] = parseTime(clean(fields.flowTime), '23:59');
  const until = amount !== null && date ? new Date(date[0], date[1] - 1, date[2], h, m, 0, 0).getTime() : null;
  if (amount !== null && until === null) return bad('Flow 프로필에 보이는 다시 차는 날짜도 넣어 주세요.');
  if (until !== null && until <= now) return bad('다시 차는 때가 이미 지났습니다. 날짜와 시각을 확인해 주세요.');
  const billDay = until !== null && row && !row.billDay && row.cycle !== 'annual' && row.plan !== 'family' ? date[2] : null;
  return { ok: true, patch: { flowCredit: amount, flowCreditUntil: until, ...(billDay ? { billDay } : {}) }, billDay };
}
/* 요금과 결제일(옛 editForm · onForm 'edit'). 직접 넣은 구독은 이름 · 한도 종류 · 종류별 칸을 더한다 */
function costFields(fields, kind) {
  const price = checkPrice(fields.price); if (!price.ok) return price;
  const bill = checkBillDay(fields.billDay); if (!bill.ok) return bill;
  const out = { price: price.value, currency: fields.currency === 'USD' ? 'USD' : 'KRW', billDay: bill.value, cycle: fields.cycle === 'annual' ? 'annual' : null, note: clean(fields.note).slice(0, 120) };
  if (kind === 'weekly') {
    const day = clean(fields.resetDay), [h, m] = parseTime(clean(fields.resetTime), '00:00');
    Object.assign(out, day === '' ? { resetDay: null, resetHour: null, resetMinute: null } : { resetDay: Number(day), resetHour: h, resetMinute: m });
  }
  if (kind === 'credit') {
    const credits = optionalNumber(fields.credits, '지금 잔액은 0 이상의 숫자로 넣어 주세요.'); if (!credits.ok) return credits;
    const low = optionalNumber(fields.lowAt, '부족 기준은 0 이상의 숫자로 넣어 주세요.'); if (!low.ok) return low;
    Object.assign(out, { credits: credits.value, lowAt: low.value });
  }
  return { ok: true, value: out };
}
export function parseCost(fields, row, kind = null) {
  const manual = row?.source !== 'auto';
  const k = manual ? (KIND_NAME[kind] ? kind : KIND_NAME[fields.kind] ? fields.kind : row?.kind) : row?.kind;
  const r = costFields(fields, manual || k === 'credit' ? k : null);
  if (!r.ok) return r;
  const v = r.value, patch = { id: row.id, price: v.price, currency: v.currency, billDay: v.billDay, note: v.note, cycle: v.cycle };
  if (manual) Object.assign(patch, { label: clean(fields.label).slice(0, 40) || row.label, kind: k, resetDay: v.resetDay ?? null, resetHour: v.resetHour ?? null, resetMinute: v.resetMinute ?? null });
  if (manual && k === 'credit') Object.assign(patch, { credits: v.credits, lowAt: v.lowAt });
  else if (!manual && row.kind === 'credit') patch.lowAt = v.lowAt;
  if (geminiPlanChoice(row)) patch.plan = GEMINI_PLANS.some(([, key]) => key && key === fields.plan) || (fields.plan === 'ultra' && row.plan === 'ultra') ? fields.plan : null;
  return { ok: true, patch };
}
/* 직접 넣는 구독: 서비스 이름이 있어야 한다. 한도 종류를 고르지 않았으면 이름으로 고른다 */
export function parseManual(fields, kindPicked) {
  const label = clean(fields.label).slice(0, 40);
  if (!label) return bad(CODE_SAY.LABEL_REQUIRED);
  const kind = KIND_NAME[kindPicked] ? kindPicked : manualKindOf(label) || 'plan';
  const r = costFields(fields, kind);
  if (!r.ok) return r;
  const v = r.value;
  return { ok: true, add: { label, kind, price: v.price, currency: v.currency, billDay: v.billDay, cycle: v.cycle, credits: kind === 'credit' ? v.credits : null, lowAt: kind === 'credit' ? v.lowAt : null, note: v.note, resetDay: kind === 'weekly' ? v.resetDay : null, resetHour: kind === 'weekly' ? v.resetHour : null, resetMinute: kind === 'weekly' ? v.resetMinute : null } };
}
/* 로그인 코드: 8자 이상, 공백과 줄바꿈 없음(본체 INVALID_CODE와 같다) */
export function checkCode(value) {
  const code = clean(value);
  if (/\s/.test(code)) return bad(CODE_SAY.INVALID_CODE);
  if (code.length < 8) return bad('코드를 끝까지 붙여 넣어 주세요.');
  return { ok: true, value: code };
}
export function checkKey(value) { const key = clean(value); return key ? { ok: true, value: key } : bad('복사한 키를 붙여 넣어 주세요.'); }
export function checkEmail(value) {
  const email = clean(value);
  if (!email) return { ok: true, value: undefined };
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { ok: true, value: email } : bad(CODE_SAY.INVALID_EMAIL);
}
export function checkRate(value) {
  const n = Number(numText(value));
  return Number.isFinite(n) && n >= 1 && n <= 100000 ? { ok: true, value: Math.round(n * 100) / 100 } : bad('1달러가 몇 원인지 숫자로 넣어 주세요.');
}

/* ── 구독 방의 「요금」 줄(설계 2절). 이 PC에 없는 계정의 요금도 합에 넣는다(설계 검토 D13) ── */
const awayRow = row => row?.source === 'auto' && row.state === 'elsewhere';
export function costRow(snapshot, st = {}, now = Date.now()) {
  const rows = snapshot?.rows || [];
  if (!snapshot || !rows.length) return null;
  const cost = costOf(snapshot, rows, now), prices = snapshot.prices || null;
  const rate = Number(snapshot.settings?.usdKrw) || 1400;
  const awayCounted = rows.some(r => awayRow(r) && (num(r.price) !== null || officialPrice(prices, r, now)));
  const next = nextMonthlyBill(rows, now);
  const when = next ? '다음 결제 ' + md(next.at) + ' ' + svcName(next.row) : '';
  const usdIn = cost.usd > 0;
  const total = (usdIn ? '약 ' : '') + won(cost.count ? cost.approx : 0);
  const mid = cost.count
    ? ['한 달 ' + total, cost.soon ? '7일 안 결제 ' + cost.soon + '건' : '', cost.unknown ? '요금을 모르는 ' + cost.unknown + '개 빼고' : '', awayCounted ? '이 PC에 없는 계정 포함' : ''].filter(Boolean).join(' · ')
    : '아직 넣은 요금이 없습니다';
  const soonNames = [...new Set(rows.filter(r => r.cycle !== 'annual' && (d => d !== null && d <= 6)(nextBill(r.billDay, now))).map(svcName))];
  const more = [];
  if (!cost.count) more.push(['say', '요금을 넣은 계정이 아직 없습니다.']);
  else more.push(['say', '한 달에 ' + total + '을 냅니다.' + (soonNames.length ? ' 7일 안에 ' + ga(joinNames(soonNames)) + ' 결제됩니다.' : '')]);
  for (const { row, official, days } of billList(prices, rows, now)) {
    const family = official && row.source === 'auto' && row.service === 'gemini' && planKey(row.plan) === 'family';
    const date = row.cycle === 'annual' ? '연간 결제' : days !== null ? md(dayAfter(now, days)) : '결제일 없음';
    const price = num(row.price) !== null ? money(row.price, row.currency) : family ? '가족 공유' : official ? money(official.price, official.currency) : '';
    const soon = row.cycle !== 'annual' && days !== null && days <= 6;
    const right = [soon ? (days === 0 ? '오늘' : days + '일 뒤') : '', num(row.price) === null && official && !family ? '공식 요금' : ''].filter(Boolean).join(' · ');
    more.push(['row', date, [svcName(row), row.source === 'auto' ? nameOf(row) : ''].filter(Boolean).join(' · '), price, right, soon]);
  }
  const credit = creditLine(prices, rows, now);
  if (credit) more.push(['row', '구독에 든 크레딧', credit.mid, '', credit.when]);
  if (summaryOn(snapshot.settings)) {
    const sum = monthSummary(snapshot, rows, now);
    if (sum?.items?.length) {
      const room = sum.room ? ' 가장 여유가 큰 계정은 ' + whoOf(sum.room.row) + '입니다.' : '';
      more.push(['note', (sum.hasMoney ? '지난 4주 동안 낸 돈의 약 ' + sum.pct + '%만큼 썼습니다.' : '지난 4주 동안 한도와 크레딧의 약 ' + sum.pct + '%를 썼습니다.') + room]);
    }
  }
  for (const t of shownAnnual(snapshot, rows, now)) {
    const plan = planName(t.row.plan, t.service), cur = t.table?.currency || 'USD';
    more.push(['note', [svcName(t.row) + ' ' + neun(plan) + ' 연간 결제로 바꾸면 1년에 ' + eul(money(t.saving, cur)) + ' 덜 냅니다.', '지난 12주 동안 꾸준히 썼습니다.', t.lock ? '연간 결제로 바꾸면 중간에 월 결제로 돌아올 수 없습니다.' : ''].filter(Boolean).join(' ')]);
    more.push(['acts', [['도움 됐습니다', 'tip', t.key + '|helpful'], ['이런 팁 그만', 'tip', t.key + '|stop']]]);
  }
  if (usdIn) {
    more.push(['fld', '1달러는', String(rate), '원. 합계의 약 금액에만 씁니다', 'usdKrw', 'number']);
    more.push(['acts', [['저장', 'rate-save', '', flags('enter', st.busy === 'cost:rate-save' && 'off')]]]);
  }
  more.push(['note', ['넣은 요금을 먼저 쓰고, 넣지 않은 계정은 공식 요금으로 셈합니다.', usdIn ? '달러는 1달러에 ' + fmt(rate) + '원으로 칩니다.' : '', '요금과 결제일은 계정 관리에서 고칩니다.'].filter(Boolean).join(' ')]);
  more.push(['acts', [['계정 관리', 'connect', '', 'top']]]);
  more.push(['live', st.notes?.get?.('cost') || '']);
  return { key: 'cost', gap: true, nm: '요금', mid, val: '', when, unread: !cost.count, label: ['요금', mid, when].filter(Boolean).join(', ') + '. 자세한 내용은 이 줄 아래에 펼쳐집니다.', more };
}
/* 「구독에 든 크레딧」: 넣은 값이 있는 것만 잇는다. 7일 안에 사라지는 API 크레딧이 있으면 가장 이른 하나를 오른쪽에 쓴다 */
const API_NAME = Object.freeze({ claude: 'Claude API', gpt: 'Codex API', gemini: 'Gemini API' });
function creditLine(prices, rows, now) {
  const parts = [];
  let first = null;
  for (const service of API_CREDIT_SERVICES) {
    const c = apiCredits(prices, rows, now, service);
    if (!c || !c.entered) continue;
    parts.push(API_NAME[service] + ' ' + usd(c.left));
    if (c.first && c.first.until - now <= 7 * DAY_MS && (!first || c.first.until < first.until)) first = c.first;
  }
  const f = flowCredits(prices, rows, now);
  if (f && f.entered) parts.push(f.refilled ? 'Flow 다시 찼을 것' : 'Flow ' + fmt(f.left));
  if (!parts.length) return null;
  return { mid: parts.join(' · '), when: first ? md(first.until) + '에 ' + usd(first.left) + '가 사라짐' : '' };
}

/* ── 구독 줄 안쪽 「계정 관리」가 열 계정 줄(설계 9.3). 손볼 계정이 있으면 그 계정, 없으면 그 구독의 첫 계정이다 ── */
export const manageKey = row => 'a:' + row.id;
export function manageOpenKey(snapshot, svc = null, now = Date.now()) {
  const rows = (snapshot?.rows || []).filter(r => r.kind === 'weekly' || r.kind === 'credit' || r.source !== 'auto');
  if (!rows.length) return 'add';
  const fix = rows.find(r => r.source === 'auto' && (r.state === 'needs-login' || r.state === 'error'));
  if (fix) return manageKey(fix);
  if (!svc) return null;
  const groups = serviceGroups(snapshot.rows || [], now, snapshot.check?.at || null);
  const g = groups.find(x => x.key === svc);
  const row = g ? g.accounts.map(a => a.row).find(r => !awayRow(r)) || g.accounts[0]?.row : null;
  return row ? manageKey(row) : null;
}

/* ── 계정 관리 방(설계 4절) ── */
const ADD = Object.freeze({
  claude: { nm: 'Claude', plan: 'Claude Pro, Max, Ultra 요금제가 있어야 합니다. 무료 요금제로는 읽지 못합니다.', planLink: 'claude-plans', tool: 'Claude Code', cmd: 'irm https://claude.ai/install.ps1 | iex', installLink: 'claude-install', email: true, code: true },
  gpt: { nm: 'Codex', plan: 'ChatGPT 계정으로 로그인합니다. 요금제마다 Codex 한도가 다릅니다.', planLink: 'chatgpt-plans', tool: 'Codex', cmd: 'powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"', installLink: 'codex-install' },
  gemini: { nm: 'Gemini', plan: 'Antigravity CLI에 로그인한 Google 계정의 한도를 읽습니다. 한 번에 한 계정만 로그인됩니다.', planLink: 'gemini-plans', tool: 'Antigravity CLI', cmd: 'irm https://antigravity.google/cli/install.ps1 | iex', installLink: 'antigravity-install', dark: true },
  higgsfield: { nm: 'Higgsfield', plan: '남은 크레딧을 읽습니다. 계정 여러 개를 하나씩 연결할 수 있습니다.', planLink: null, tool: 'Higgsfield CLI', cmd: 'npm install -g @higgsfield/cli', installLink: 'higgsfield-install', node: true },
  typecast: { nm: 'Typecast', plan: 'API 요금제의 이번 달 남은 크레딧을 읽습니다. 설치할 프로그램은 없습니다.', planLink: 'typecast-api-pricing', key: true },
  other: { nm: '그 밖의 구독', manual: true },
});
export const ADD_SERVICES = Object.freeze(Object.keys(ADD));
export const addInfo = svc => ADD[svc] || null;
const shortVersion = v => (v ? String(v).replace(/\s*\(.*\)\s*$/, '').replace(/^(codex-cli|higgsfield)\s+/i, '') : '');
const HELP = Object.freeze([
  ['설치했는데 「설치 안 됨」으로 나옵니다', '설치 창이 끝난 뒤 그 창을 닫고 「설치가 끝났습니다 · 다시 확인」을 눌러 주세요.'],
  ['로그인 화면이 열리지 않습니다', '「로그인 화면 다시 열기」를 누르거나, 「주소 복사」로 주소를 브라우저에 직접 붙여 넣습니다.'],
  ['다른 계정으로 로그인됩니다', '브라우저에 로그인돼 있던 계정으로 연결된 것입니다. 「주소 복사」로 주소를 시크릿 창에 붙여 넣고 더할 계정으로 로그인합니다.'],
  ['코드를 붙여 넣어도 넘어가지 않습니다', 'Claude는 검은 창으로 로그인하는 길이 따로 있습니다. 코드가 들어가지 않으면 그 길로 로그인합니다.'],
  ['「구독 한도가 없다」고 나옵니다', 'Claude 무료 요금제로는 읽지 못합니다. Pro, Max, Ultra 요금제인지 확인합니다. 무료 요금제는 「그 밖의 구독」으로 결제일만 넣어 둘 수 있습니다.'],
  ['ChatGPT가 휴대폰 인증을 요구합니다', '안내대로 인증을 마치면 이 화면이 저절로 넘어갑니다.'],
  ['Gemini 검은 창에서 막혔습니다', '검은 창에 /logout을 치고 Enter, /login을 치고 Enter를 누릅니다. 「1. Google OAuth」를 고르고 브라우저에서 계정을 고른 뒤, 복사한 코드를 검은 창에 오른쪽 클릭으로 붙여 넣고 Enter를 누릅니다.'],
  ['Typecast 키가 맞지 않다고 나옵니다', '키를 새로 만들면 예전 키는 쓸 수 없습니다. 개발자 화면에서 지금 키를 다시 복사해 넣습니다.'],
  ['연결을 끊고 싶습니다', '그 계정 줄을 열고 「지우기」를 두 번 누릅니다. 이 앱이 만든 로그인 폴더까지 지웁니다. 기존 로그인을 가져온 계정은 목록에서만 빠집니다.'],
  ['Claude API 크레딧 남은 금액은 어디서 봅니까', 'Claude Console의 결제 화면에 남은 금액과 만료 날짜가 있습니다. 그 값을 계정 줄에 넣어 둡니다. Max와 Ultra의 API 크레딧은 claude.ai에서 Claude Console 조직을 연결해야 들어옵니다.'],
  ['Codex API 크레딧 남은 금액은 어디서 봅니까', 'OpenAI 플랫폼의 Credit grants 표에서 BALANCE 앞 숫자와 EXPIRES를 봅니다.'],
  ['Gemini 크레딧은 어디서 봅니까', 'API 크레딧은 AI Studio의 결제 화면에, Flow 크레딧은 Flow에 있습니다.'],
]);
export const MANAGE_HELP = HELP;
const API_BILLING = Object.freeze({ claude: ['Console 결제 화면 열기 ↗', 'claude-console-billing', 'Claude Console 결제 화면의 Promotional credits에 남은 금액과 만료 날짜가 있습니다.'], gpt: ['Credit grants 열기 ↗', 'gpt-credit-grants', 'OpenAI 플랫폼 결제의 Credit grants 표에서 BALANCE 앞 숫자와 EXPIRES를 봅니다.'], gemini: ['AI Studio 결제 열기 ↗', 'gemini-ai-studio-billing', 'AI Studio 결제 화면에 크레딧 금액이 있습니다. 선불로 넣은 돈은 빼고 넣습니다.'] });

/* st: 방 상태(orb-rooms.mjs). armed · grps · add · relogin · kinds · installing · busy · notes · ended · roomNote
   ctx: { checking, sentence(본체 글을 화면 말투로) } */
export function manageRoom(snapshot, st = {}, now = Date.now(), ctx = {}) {
  const rows = snapshot?.rows || [];
  const checkAt = snapshot?.check?.at || null;
  const autos = ORDER.flatMap(s => rows.filter(r => r.source === 'auto' && r.service === s));
  const manuals = rows.filter(r => r.source !== 'auto');
  const list = [...autos, ...manuals];
  const lines = list.map((row, i) => accountRow(snapshot, row, st, now, ctx, i === 0));
  lines.unshift({ key: 'add', nm: '계정 더하기', sub: '', mid: '구독 하나를 이 PC에 연결합니다', val: '', when: '', label: '계정 더하기, 구독 하나를 이 PC에 연결합니다. 자세한 내용은 이 줄 아래에 펼쳐집니다.', more: addItems(snapshot, st, now, ctx) });
  lines.push({ key: 'help', gap: true, nm: '막혔을 때', sub: '', mid: '설치, 로그인, 코드, 키에서 막힐 때 보는 열두 가지', val: '', when: '', label: '막혔을 때, 물음 열두 가지. 자세한 내용은 이 줄 아래에 펼쳐집니다.', more: HELP.map(([q, a]) => ['qa', q, a]) });
  const say = !list.length ? '아직 연결한 계정이 없습니다.'
    : autos.length && manuals.length ? '연결한 계정은 ' + countWord(autos.length) + '이고, 직접 넣은 구독은 ' + countWord(manuals.length) + '입니다.'
      : autos.length ? '연결한 계정은 ' + countWord(autos.length) + '입니다.' : '직접 넣은 구독은 ' + countWord(manuals.length) + '입니다.';
  return { say, then: manageThen(snapshot, autos, now, checkAt, ctx), rows: lines, foot: st.roomNote || '로그인 정보와 사용량은 이 PC 밖으로 나가지 않습니다.', act: autos.length ? ['모두 다시 읽기', 'reread-all', ctx.checking || snapshot?.checking ? 'off' : ''] : null };
}
/* 둘째 줄은 하나만 말한다. 차례: 읽는 중 · 다시 로그인 · 못 읽음 · 로그인 기한 7일 안 · 다 씀 · 모두 괜찮음 */
function manageThen(snapshot, autos, now, checkAt, ctx) {
  if (!autos.length) return snapshot?.rows?.length ? '직접 넣은 구독은 한도를 읽지 않습니다.' : '구독을 하나 연결하면 남은 양과 결제일을 여기에서 봅니다.';
  if (ctx.checking || snapshot?.checking) {
    const p = snapshot?.progress;
    return '지금 읽고 있습니다.' + (p?.total ? ' ' + p.done + '/' + p.total : '');
  }
  const states = autos.map(row => ({ row, a: accountState(row, now, checkAt) }));
  const one = (list, single, many) => (list.length === 1 ? single(list[0].row) : many(list.length));
  const login = states.filter(x => x.a.state === 'login');
  if (login.length) return one(login, r => neun(whoOf(r)) + ' 다시 로그인해야 합니다.', n => '다시 로그인해야 하는 계정이 ' + countWord(n) + ' 있습니다.');
  const error = states.filter(x => x.a.state === 'error');
  if (error.length) return one(error, r => neun(whoOf(r)) + ' 읽지 못했습니다.', n => '읽지 못한 계정이 ' + countWord(n) + ' 있습니다.');
  const soon = states.filter(x => loginSoon(x.row, now)).sort((p, q) => p.row.loginUntil - q.row.loginUntil);
  if (soon.length) { const r = soon[0].row; return r.loginUntil > now ? neun(whoOf(r)) + ' ' + md(r.loginUntil) + '에 로그인 기한이 끝납니다.' : neun(whoOf(r)) + ' 로그인 기한이 지났습니다.'; }
  const out = states.filter(x => x.a.state === 'out' && !x.a.away).sort((p, q) => (p.a.unblock ?? Infinity) - (q.a.unblock ?? Infinity));
  if (out.length) { const x = out[0]; return neun(whoOf(x.row)) + (x.a.unblock ? ' 다 써서 ' + dayTime(x.a.unblock, now) + '에 다시 열립니다.' : ' 다 썼습니다.'); }
  if (!checkAt) return '「모두 다시 읽기」를 누르면 지금 남은 양을 읽습니다.';
  return (now - checkAt < 2 * 60e3 ? '모두 방금 읽었고' : '모두 ' + hm(checkAt) + '에 읽었고') + ', 막힌 계정은 없습니다.';
}

function stateMid(row, a, now) {
  if (row.source !== 'auto') return isUsedUp(row, now) ? '다 썼다고 표시했습니다' : '한도는 읽지 않습니다';
  const read = readWord(row.live?.readAt, now);
  const withRead = t => [t, read].filter(Boolean).join(' · ');
  if (a.away) return '지금 이 PC에 로그인되어 있지 않습니다';
  if (a.state === 'login') return '다시 로그인해야 합니다';
  if (a.state === 'error') return '읽지 못했습니다';
  if (a.state === 'unknown') return '아직 읽지 않았습니다';
  if (a.projected) return withRead('다시 찼을 것입니다');
  if (a.state === 'out') return withRead('다 썼습니다');
  if (row.kind === 'credit' && Number.isFinite(a.credits)) return withRead(fmt(a.credits) + ' 크레딧');
  if (a.g) return withRead('한도 ' + a.left + '% 남음');
  return '아직 읽지 않았습니다';
}
function stateSay(row, a, now) {
  const who = whoOf(row);
  if (row.source !== 'auto') return isUsedUp(row, now) ? neun(who) + ' 다 썼다고 표시했습니다.' : '직접 넣은 구독입니다. 한도는 읽지 않고, 넣은 요금과 결제일만 셉니다.';
  if (a.away) return neun(who) + ' 지금 이 PC에 로그인되어 있지 않습니다. 마지막으로 읽은 값을 보입니다.';
  if (a.state === 'login') return neun(who) + ' 로그인이 풀렸습니다. 다시 로그인하면 이어서 읽습니다.';
  if (a.state === 'error') return neun(who) + ' 읽지 못했습니다. 이 계정만 다시 읽어 볼 수 있습니다.';
  if (a.state === 'unknown') return neun(who) + ' 아직 읽지 않았습니다.';
  if (a.projected) return neun(who) + ' 초기화 시각이 지나 다시 찼을 것입니다. 다시 읽으면 확인됩니다.';
  if (a.state === 'out') return neun(who) + ' 다 썼습니다.' + (a.unblock ? ' ' + dayTime(a.unblock, now) + '에 다시 열립니다.' : '');
  if (row.kind === 'credit' && Number.isFinite(a.credits)) return neun(who) + ' ' + fmt(a.credits) + ' 크레딧이 남았습니다.' + (a.state === 'low' ? ' 부족 기준 아래입니다.' : '');
  if (a.g) return neun(who) + ' 한도가 ' + a.left + '% 남았습니다.' + (a.g.resetsAt ? ' ' + dayTime(a.g.resetsAt, now) + '에 다시 찹니다.' : '');
  return neun(who) + ' 아직 읽지 않았습니다.';
}
function priceVal(snapshot, row, now) {
  if (num(row.price) !== null) return '월 ' + money(row.price, row.currency);
  const o = officialPrice(snapshot?.prices, row, now);
  if (!o) return '';
  return geminiPlanChoice(row) && planKey(row.plan) === 'family' ? '가족 공유' : '월 ' + money(Math.round(o.price * 100) / 100, o.currency);
}
const billWhen = row => (row.cycle === 'annual' ? '연간 결제' : row.billDay ? '매월 ' + row.billDay + '일 결제' : num(row.price) !== null ? '결제일 없음' : '요금을 넣지 않음');
const reloginLabel = row => (row.service === 'typecast' ? '키 다시 넣기' : row.state === 'elsewhere' ? (row.awayReason === 'none' ? '이 계정으로 로그인' : '이 계정으로 바꾸기') : '다시 로그인');
const editBtn = (has, grp, open) => [has ? '고치기' : '넣기', 'grp', grp, open ? 'on' : ''];

function accountRow(snapshot, row, st, now, ctx, first) {
  const key = manageKey(row), checkAt = snapshot?.check?.at || null, a = accountState(row, now, checkAt);
  const auto = row.source === 'auto', sentence = ctx.sentence || (s => s);
  const grpOpen = name => !!st.grps?.has?.(key + ':' + name);
  const off = act => (st.busy === key + ':' + act ? 'off' : '');
  const sub = auto ? [nameOf(row), planName(row.plan, row.service)].filter(Boolean).join(' · ') : KIND_NAME[row.kind] || '';
  const mid = stateMid(row, a, now), val = priceVal(snapshot, row, now), when = billWhen(row);
  const bright = auto && (a.state === 'login' || a.state === 'error' || (a.state === 'out' && !a.away) || loginSoon(row, now));
  const more = [['say', stateSay(row, a, now)]];
  if (auto && row.stateMessage && (a.state === 'error' || a.away)) more.push(['note', sentence(row.stateMessage)]);
  // 다시 로그인을 누른 계정은 그 줄 안에서 로그인 단계를 밟는다(설계 4.5)
  if (st.relogin === row.id) more.push(...loginSteps(snapshot, row.service, st, key, ctx, { relogin: row }));
  // 로그인 기한(Claude): 읽히는 계정에만 있다
  if (auto && row.state === 'ok' && num(row.loginUntil) !== null) {
    const soon = loginSoon(row, now), passed = row.loginUntil <= now;
    more.push(['row', '로그인', passed ? '기한이 지나 곧 끊깁니다' : soon ? '기한 전에 다시 로그인하면 끊기지 않습니다' : '한 번 로그인하면 4주쯤 이어집니다', '', passed ? md(row.loginUntil) + '에 끝남' : md(row.loginUntil) + '까지', soon]);
  }
  // 요금 사실: 공식 요금 · 가족 공유 · 연간 결제
  const official = num(row.price) === null ? officialPrice(snapshot?.prices, row, now) : null;
  if (geminiPlanChoice(row) && planKey(row.plan) === 'family') more.push(['note', '가족 공유로 받아 따로 내지 않습니다.']);
  else if (official) more.push(['note', '공식 요금으로 셈합니다. 다르면 요금과 결제일에서 고칩니다.']);
  if (row.cycle === 'annual') more.push(['note', '연간 결제로 표시했습니다.']);
  if (geminiPlanChoice(row) && !row.plan) more.push(['note', '요금제를 고르면 매달 딸려 오는 Flow와 API 크레딧을 알려 드립니다.']);
  // 초기화권: Codex는 알려 준 값이고 고칠 수 없다. Claude는 회원이 넣는다
  if (auto && row.service === 'gpt') {
    const p = passesOf(row, now), read = num(row.live?.resets?.count);
    if (p) more.push(['row', '초기화권', 'Codex가 알려 준 값입니다', p.count + '장', p.until ? md(p.until) + '까지' : '']);
    else if (read === 0) more.push(['row', '초기화권', 'Codex가 알려 준 값입니다', '없음', '']);
  }
  const claude = auto && row.service === 'claude', pass = claude ? passesOf(row, now) : null;
  if (claude) {
    const expired = !pass && num(row.passCount) > 0 && row.passUntil;
    more.push(['row', '초기화권', expired ? '넣어 둔 초기화권이 ' + md(row.passUntil) + '에 만료됐습니다' : '주간 한도를 한 번 다시 채웁니다', pass ? pass.count + '장' : '', { text: pass?.until ? md(pass.until) + '까지' : '', btn: editBtn(!!pass, 'pass', grpOpen('pass')) }]);
    more.push(['grp', 'pass', [
      ['fld', '주간 초기화권', num(row.passCount) !== null && num(row.passCount) > 0 ? String(row.passCount) : '', '0에서 20장', 'passCount', 'number'],
      ['fld', '만료 날짜', row.passUntil && row.passUntil > now ? isoDay(row.passUntil) : '', '', 'passDate', 'date'],
      ['fld', '만료 시각(선택)', row.passUntil && row.passUntil > now ? hm(row.passUntil) : '', '비우면 그날 23:59로 봅니다', 'passTime', 'time'],
      ['note', '그 계정으로 로그인한 브라우저에서 claude.ai 설정의 사용량을 열면 주간 초기화권 수와 만료 때가 있습니다.'],
      ['acts', [['저장', 'save-pass', '', flags('enter', off('save-pass'))], ['사용량 설정 열기 ↗', 'help', 'claude-usage'], ['닫기', 'grp', 'pass']]],
    ], !grpOpen('pass')]);
  }
  if (auto && a.state === 'out') {
    const g = serviceGroups(snapshot?.rows || [], now, checkAt).find(x => x.key === row.service);
    if (g && g.accounts.some(x => x.row.id === row.id && x.pass)) more.push(['note', passWords(passPlan(g, now))]);
  }
  // API 크레딧
  if (auto && API_CREDIT_SERVICES.includes(row.service) && (apiCreditPlan(row) || num(row.apiCredit) !== null)) {
    const c = apiCreditOf(snapshot?.prices, row, now), gemini = row.service === 'gemini';
    const has = !!c && c.left !== null;
    const midText = c?.expired ? '넣어 둔 금액이 ' + md(c.expired) + '에 사라졌습니다' : '구독에 함께 들어 있는 API 사용 금액입니다' + (!has && c?.grant ? ' · 매달 ' + usd(c.grant) : '');
    const right = has ? (gemini ? (c.at ? md(c.at) + '에 넣은 값' : '') : c.until ? md(c.until) + '에 사라짐' : '') : '';
    more.push(['row', 'API 크레딧', midText, has ? usd(c.left) : '', { text: right, btn: editBtn(has, 'api', grpOpen('api')) }]);
    const [billLabel, billLink, where] = API_BILLING[row.service];
    const untilDay = c?.until && c.until > now ? isoDay(c.until) : (d => (d === null ? '' : isoDay(dayAfter(now, d))))(row.cycle === 'annual' ? null : nextBill(row.billDay, now));
    more.push(['grp', 'api', [
      ['fld', '남은 금액', has ? String(c.left) : '', '달러, 0에서 100,000', 'apiCredit', 'number'],
      ...(gemini ? [] : [['fld', '만료 날짜', untilDay, '', 'apiDate', 'date']]),
      ['note', where + (gemini ? '' : ' 만료 날짜 당일은 사라지는 시각을 몰라 그 전날까지만 셉니다.') + ' 금액을 비우고 저장하면 넣은 값을 지웁니다.'],
      ['acts', [['저장', 'save-api', '', flags('enter', off('save-api'))], [billLabel, 'help', billLink], ['닫기', 'grp', 'api']]],
    ], !grpOpen('api')]);
  }
  // Flow 크레딧(Gemini)
  if (auto && row.service === 'gemini') {
    const f = flowCreditOf(snapshot?.prices, row, now);
    const has = !!f && f.left !== null;
    const midText = f?.refilled && has ? '영상과 그림에 씁니다 · ' + md(f.refilled) + '에 다시 찼을 것으로 셉니다'
      : f?.refilled || f?.expired ? '넣어 둔 값이 지났습니다. Flow 프로필에서 보고 다시 넣습니다' : '영상과 그림에 씁니다' + (!has && f?.grant ? ' · 매달 ' + fmt(f.grant) + '개' : '');
    more.push(['row', 'Flow 크레딧', midText, has ? fmt(f.left) : '', { text: has && f.until ? md(f.until) + '에 다시 참' : '', btn: editBtn(has && !f.refilled, 'flow', grpOpen('flow')) }]);
    const at = f?.until && f.until > now ? f.until : null;
    more.push(['grp', 'flow', [
      ['fld', '남은 Flow 크레딧', has && !f.refilled ? String(f.left) : '', '정수, 0에서 10,000,000', 'flowCredit', 'number'],
      ['fld', '다시 차는 날짜', at ? isoDay(at) : '', '', 'flowDate', 'date'],
      ['fld', '다시 차는 시각(선택)', at && hm(at) !== '23:59' ? hm(at) : '', '비우면 그날 23:59로 봅니다', 'flowTime', 'time'],
      ['note', '그 계정으로 로그인한 브라우저에서 Google Flow 오른쪽 위 프로필을 누르면 남은 개수와 다시 차는 때가 있습니다. 개수를 비우고 저장하면 넣은 값을 지웁니다.'],
      ['acts', [['저장', 'save-flow', '', flags('enter', off('save-flow'))], ['Flow 열기 ↗', 'help', 'flow-app'], ['닫기', 'grp', 'flow']]],
    ], !grpOpen('flow')]);
  }
  if (row.note) more.push(['note', row.note]);
  // 할 수 있는 일
  const acts = [];
  if (auto) acts.push([reloginLabel(row), 'relogin', '', off('relogin')]);
  if (auto && a.state === 'error') acts.push(['이 계정 다시 읽기', 'reread-one', '', off('reread-one')]);
  if (!auto && row.kind === 'weekly') acts.push([isUsedUp(row, now) ? '다 쓴 것 풀기' : '다 썼습니다', 'used', '', off('used')]);
  if (claude && pass) acts.push(['1장 썼습니다', 'pass-used', '', off('pass-used')]);
  acts.push([auto ? '요금과 결제일' : '고치기', 'grp', 'cost', grpOpen('cost') ? 'on' : '']);
  const armed = st.armed && st.armed.key === key && st.armed.act === 'remove';
  acts.push([armed ? '한 번 더 누르면 지웁니다' : '지우기', 'remove', '', flags('far', armed && 'warn', off('remove'))]);
  more.push(['acts', acts]);
  more.push(['grp', 'cost', costItems(snapshot, row, st, now, key), !grpOpen('cost')]);
  const note = armed ? (auto ? (row.folder ? '이 앱이 만든 로그인 폴더와 쌓인 사용 기록을 함께 지웁니다. 되돌릴 수 없습니다.' : '목록에서 빼고 쌓인 사용 기록을 지웁니다. 이 PC의 기존 로그인은 그대로 둡니다.') : '이 줄과 넣은 값을 지웁니다. 되돌릴 수 없습니다.') : st.notes?.get?.(key) || '';
  more.push(['live', note]);
  const label = [svcName(row), sub, mid, val, when].filter(Boolean).join(', ') + '. 자세한 내용은 이 줄 아래에 펼쳐집니다.';
  return { key, gap: first, nm: svcName(row), sub, mid, val, when, now: bright, label, more };
}
function passWords(plan) {
  if (plan.use) return '모든 계정이 막혔고 하루 넘게 기다려야 합니다. 지금 초기화권을 쓰면 바로 다시 찹니다.';
  if (plan.why === 'roomy') return '다른 계정이 넉넉해 초기화권을 아껴 둬도 됩니다.';
  if (plan.why === 'projected') return '다시 찼을 계정이 있어 초기화권을 아껴 둬도 됩니다.';
  if (plan.why === 'low') return '조금 남은 계정이 있어 그 계정을 먼저 씁니다.';
  if (plan.why === 'soon') return '하루 안에 다시 열리는 계정이 있어 그때까지 기다려도 됩니다.';
  return '읽지 못한 계정이 있습니다. 그 계정부터 확인합니다.';
}
/* 「요금과 결제일」 묶음(옛 editForm). 직접 넣은 구독은 이름 · 한도 종류 · 종류별 칸을 더한다 */
function costItems(snapshot, row, st, now, key) {
  const manual = row.source !== 'auto';
  const kind = manual ? st.kinds?.[key] || row.kind : row.kind;
  const official = num(row.price) === null ? officialPrice(snapshot?.prices, row, now) : null;
  const items = [];
  if (geminiPlanChoice(row)) {
    const plans = row.plan === 'ultra' ? [...GEMINI_PLANS, ['Ultra 등급 모름', 'ultra']] : GEMINI_PLANS;
    items.push(['pick', '요금제', plans, row.plan || '', 'plan']);
  }
  if (manual) {
    items.push(['fld', '서비스 이름', row.label || '', '', 'label', 'text']);
    items.push(['pick', '한도 종류', KIND_PICK, kind, 'kind', 'kind-pick']);
  }
  items.push(...kindItems(manual ? kind : row.kind === 'credit' ? 'credit-low' : null, row));
  items.push(['fld', '월 구독료', num(row.price) !== null ? String(row.price) : '', official ? '비우면 공식 요금 ' + money(Math.round(official.price * 100) / 100, official.currency) + '으로 셈합니다' : '연간 결제면 1년 치를 12로 나눈 값', 'price', 'number']);
  items.push(['pick', '통화', [['원', 'KRW'], ['달러', 'USD']], row.currency === 'USD' || (official && num(row.price) === null && official.currency === 'USD') ? 'USD' : 'KRW', 'currency']);
  items.push(['pick', '결제 주기', [['월 결제', ''], ['연간 결제', 'annual']], row.cycle === 'annual' ? 'annual' : '', 'cycle']);
  items.push(['fld', '결제일', row.billDay ? String(row.billDay) : '', '매월 며칠인지', 'billDay', 'number']);
  items.push(['fld', '메모', row.note || '', '120자까지', 'note', 'text']);
  items.push(['acts', [['저장', 'save-cost', '', flags('enter', st.busy === key + ':save-cost' && 'off')], ['닫기', 'grp', 'cost']]]);
  return items;
}
/* 한도 종류별 칸: 주간 한도는 초기화 요일과 시각, 크레딧은 지금 잔액과 부족 기준. credit-low는 자동 연결 크레딧형의 부족 기준만이다 */
function kindItems(kind, row = {}) {
  if (kind === 'weekly') {
    const day = row.resetDay !== null && row.resetDay !== undefined && row.resetDay !== '' ? String(row.resetDay) : '';
    return [['pick', '초기화 요일', [['없음', ''], ...[1, 2, 3, 4, 5, 6, 0].map(d => [WEEKDAY[d], String(d)])], day, 'resetDay'], ['fld', '초기화 시각', day ? pad(row.resetHour || 0) + ':' + pad(row.resetMinute || 0) : '', '', 'resetTime', 'time']];
  }
  if (kind === 'credit') return [['fld', '지금 잔액', num(row.credits) !== null ? String(row.credits) : '', '', 'credits', 'number'], ['fld', '부족 기준', num(row.lowAt) !== null ? String(row.lowAt) : '', '이하면 알립니다. 비우면 1 이하', 'lowAt', 'number']];
  if (kind === 'credit-low') return [['fld', '부족 기준', num(row.lowAt) !== null ? String(row.lowAt) : '', '이하면 알립니다. 비우면 1 이하', 'lowAt', 'number']];
  return [];
}

/* ── 계정 더하기(설계 4.5). 단계는 스냅숏의 tools[서비스]와 login에서 정한다 ── */
export function addItems(snapshot, st = {}, now = Date.now(), ctx = {}) {
  const svc = st.add?.svc || '', s = ADD[svc];
  const items = [['pick', '무엇을 더할까요', ADD_SERVICES.map(k => [ADD[k].nm, k]), svc, '', 'add-pick']];
  const live = ['live', st.notes?.get?.('add') || ''];
  if (!s) return [...items, ['note', '고르면 그 자리에서 차례대로 안내합니다. 연결하면 바로 한 번 읽습니다.'], live];
  const off = act => (st.busy === 'add:' + act ? 'off' : '');
  if (s.manual) {
    const kind = st.kinds?.add || 'plan';
    return [...items,
      ['note', 'Suno나 Midjourney처럼 저절로 읽지 못하는 구독은 결제일과 요금을 직접 넣어 둡니다.'],
      ['fld', '서비스 이름', '', '예: Suno', 'label', 'text'],
      ['pick', '한도 종류', KIND_PICK, kind, 'kind', 'kind-pick'],
      ...kindItems(kind),
      ['fld', '월 구독료', '', '연간 결제면 1년 치를 12로 나눈 값', 'price', 'number'],
      ['pick', '통화', [['원', 'KRW'], ['달러', 'USD']], 'KRW', 'currency'],
      ['pick', '결제 주기', [['월 결제', ''], ['연간 결제', 'annual']], '', 'cycle'],
      ['fld', '결제일', '', '매월 며칠인지', 'billDay', 'number'],
      ['fld', '메모', '', '120자까지', 'note', 'text'],
      ['acts', [['넣기', 'manual-add', '', flags('enter', off('manual-add'))]]],
      live];
  }
  const plan = ['row', '1 요금제', s.plan, '', s.planLink ? ['요금제 보기 ↗', 'help', s.planLink] : ''];
  if (s.key) return [...items, plan,
    ['row', '2 API 키', 'Typecast 개발자 화면에서 키를 복사합니다. 키를 새로 만들면 예전 키는 쓸 수 없습니다.', '', ['키 화면 열기 ↗', 'help', 'typecast-api']],
    ['fld', '3 키 붙여 넣기', '', '이 PC에만 암호화해 둡니다. 화면에는 끝 네 글자만 보입니다', 'key', 'password'],
    ['acts', [['연결', 'key', 'typecast', flags('enter', off('key'))]]],
    live];
  return [...items, plan, ...loginSteps(snapshot, svc, st, 'add', ctx), live];
}
/* 설치와 로그인 단계. relogin을 주면 그 계정 줄 안에서 밟는다(Claude는 그 줄의 메일로만 로그인한다) */
function loginSteps(snapshot, svc, st, key, ctx, { relogin = null } = {}) {
  const s = ADD[svc], sentence = ctx.sentence || (x => x);
  if (!s || s.manual) return [];
  const off = act => (st.busy === key + ':' + act ? 'off' : '');
  if (s.key) {
    // 키 다시 넣기(Typecast): 그 줄의 키를 바꾼다
    return [['fld', '새 키 붙여 넣기', '', '이 PC에만 암호화해 둡니다. 화면에는 끝 네 글자만 보입니다', 'key', 'password'], ['acts', [['연결', 'key', svc, flags('enter', off('key'))], ['키 화면 열기 ↗', 'help', 'typecast-api']]]];
  }
  const tool = snapshot?.tools?.[svc], installed = !!tool?.installed;
  const login = snapshot?.login && snapshot.login.service === svc ? snapshot.login : null;
  const mine = login && (relogin ? st.relogin === relogin.id : st.relogin === null || st.relogin === undefined);
  const busyOther = activeLogin(snapshot?.login) && (snapshot.login.service !== svc || !mine);
  const out = [];
  if (!relogin) {
    if (!installed) {
      const opened = st.installing?.has?.(svc);
      out.push(['row', '2 설치', s.tool + '가 이 PC에 없습니다. 설치 창을 열면 공식 설치 명령이 돌아갑니다. 1~2분 걸립니다.', '', opened ? '설치 창이 열려 있음' : '아직 없음', true]);
      // 설치 줄 아래에 명령 원문을 둔다(옛 판의 「직접 붙여 넣고 싶다면」). 지금 누를 단추는 맨 아래, 알림 줄 바로 위에 선다
      if (snapshot?.platform !== 'darwin' && s.cmd) out.push(['note', '직접 붙여 넣으려면 PowerShell에 이 명령을 넣습니다.'], ['cmd', s.cmd], ['acts', [['명령 복사', 'tool-copy', svc], ['공식 설치 안내 ↗', 'help', s.installLink]]]);
      out.push(['row', '3 로그인', '설치가 끝나면 열립니다', '', '']);
      if (s.node && tool && tool.npm === false) out.push(['note', 'Higgsfield CLI는 Node.js가 먼저 있어야 합니다.'], ['acts', [['Node.js 받기 ↗', 'help', 'node']]]);
      out.push(['acts', opened ? [['설치가 끝났습니다 · 다시 확인', 'recheck-tools', svc, off('recheck-tools')]] : [['설치 창 열기', 'install', svc, off('install')]]]);
      return out;
    }
    out.push(['row', '2 설치', '이 PC에 설치되어 있습니다' + (tool?.version ? ' · ' + shortVersion(tool.version) : ''), '', '설치됨']);
  }
  const step = relogin ? '로그인' : '3 로그인';
  if (mine && activeLogin(login)) {
    if (login.stage === 'console') {
      out.push(['row', step, '검은 창이 열렸습니다. 창이 안 보이면 작업 표시줄에서 찾습니다.', '', '기다리는 중', true]);
      if (svc === 'gemini') {
        const switching = (snapshot?.rows || []).some(r => r.source === 'auto' && r.service === 'gemini');
        if (switching) out.push(['note', '이미 다른 계정으로 로그인된 창이면 /logout을 치고 Enter, 이어서 /login을 치고 Enter를 누릅니다.']);
        out.push(['note', '검은 창에서 Enter를 눌러 「1. Google OAuth」를 고릅니다. 열린 브라우저에서 연결할 Google 계정을 고릅니다.']);
        out.push(['note', '브라우저에 나온 코드를 복사하고, 검은 창 안에서 오른쪽 클릭으로 붙여 넣은 뒤 Enter를 누릅니다. 연결되면 이 줄이 저절로 넘어갑니다.']);
      } else out.push(['note', '브라우저에서 승인하고, 코드가 나오면 검은 창에 붙여 넣어 주세요. 연결되면 이 줄이 저절로 넘어갑니다.']);
      out.push(['acts', [['취소', 'cancel-login', '', off('cancel-login')]]]);
      return out;
    }
    if (login.stage === 'verifying') { out.push(['row', step, '연결을 확인하고 있습니다.', '', '확인 중', true]); return out; }
    if (login.needsCode) {
      out.push(['row', step, '브라우저에 코드가 보입니다. 아래에 붙여 넣으면 연결됩니다.', '', '코드를 기다리는 중', true]);
      out.push(['fld', '브라우저에 보이는 코드', '', '붙여 넣기는 Ctrl+V', 'code', 'text']);
      const acts = [['연결', 'code', '', flags('enter', off('code'))], ['취소', 'cancel-login', '', off('cancel-login')]];
      if (s.code && !login.console) acts.push(['코드가 들어가지 않으면 검은 창으로 로그인', 'console-login', svc, off('console-login')]);
      out.push(['acts', acts]);
      return out;
    }
    out.push(['row', step, login.url ? '브라우저에서 로그인을 마쳐 주세요. 끝나면 저절로 넘어갑니다.' : '로그인을 준비하고 있습니다.', '', '기다리는 중', true]);
    if (svc === 'gpt' && login.url) out.push(['note', 'ChatGPT가 휴대폰 인증을 요구하면 안내대로 마쳐 주세요.']);
    out.push(['acts', [...(login.url ? [['로그인 화면 다시 열기', 'open-url', ''], ['주소 복사', 'copy-url', '']] : []), ['취소', 'cancel-login', '', off('cancel-login')]]]);
    return out;
  }
  // 로그인 전 또는 끝난 뒤. 이번에 본 실패는 본체 글과 「다시 시도」로 남긴다(설계 14절 D2는 다음 묶음)
  const failed = mine && login?.stage === 'error' && st.ended?.id === login.id;
  if (relogin) {
    out.push(['row', step, failed ? '로그인을 마치지 못했습니다' : '', '', '']);
    if (failed && login.message) out.push(['note', sentence(login.message)]);
    if (busyOther) out.push(['note', '다른 서비스의 로그인이 진행 중입니다. 끝난 뒤 이어서 해 주세요.']);
    if (failed) out.push(['acts', [['다시 시도', 'relogin', '', flags(busyOther && 'off', off('relogin'))]]]);
    return failed || busyOther ? out : [];
  }
  const switching = svc === 'gemini' && (snapshot?.rows || []).some(r => r.source === 'auto' && r.service === 'gemini');
  out.push(['row', '3 로그인', s.dark ? '검은 창이 열립니다. 브라우저에서 연결할 Google 계정을 고릅니다.' + (switching ? ' 이미 다른 계정으로 로그인된 창이면 /logout과 /login을 먼저 칩니다.' : '') : '브라우저에서 로그인합니다. 이 PC에 이미 로그인해 둔 계정이 있으면 그대로 가져올 수 있습니다.', '', failed ? '마치지 못함' : '', true]);
  if (failed && login.message) out.push(['note', sentence(login.message)]);
  if (s.email) out.push(['fld', '연결할 이메일(선택)', '', '로그인 화면에 미리 채웁니다. 브라우저에 다른 계정이 로그인돼 있으면 그 계정으로 연결됩니다', 'email', 'email']);
  if (busyOther) out.push(['note', '다른 서비스의 로그인이 진행 중입니다. 끝난 뒤 이어서 해 주세요.']);
  const dis = flags(busyOther && 'off', off('login'));
  out.push(['acts', s.dark ? [[failed ? '다시 시도' : 'Gemini 로그인', 'login', svc, dis]] : [[failed ? '다시 시도' : '새 계정 연결', 'login', svc, dis], ['이 PC의 기존 로그인 쓰기', 'existing', svc, flags(busyOther && 'off', off('existing'))]]]);
  return out;
}
