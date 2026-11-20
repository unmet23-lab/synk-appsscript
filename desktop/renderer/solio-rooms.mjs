// 솔리오 안쪽의 나머지(2단계 둘째 조각)를 구독 스냅숏에서 만든다. DOM이 없다.
// 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 1~6절. 셈은 subscriptions-model.mjs를 그대로 쓰고,
// 이 파일은 그 숫자를 합니다체 글과 줄 자료로 옮긴다. 옛 구독 판(subscriptions.mjs)의 입력 검사 규칙은 닫힌 함수 안에 있어 여기에 옮겨 적었다(설계 14절 D3).
// 모델별 토큰의 기간 묶기와 숫자 글은 subscriptions-tokens.mjs, 내 계정의 자료 읽기는 옛 내 계정(account-page.mjs)의 순수 함수를 그대로 쓴다.
//
// 줄 하나: { key, nm, sub, mid, val, when, now, unread, gap, label, more }
// 안쪽 한 줄은 [종류, …]이다(시안 nodesOf). 함수 대신 동작 이름을 적는다.
//   ['say', 글] · ['note', 글] · ['cmd', 명령 원문] · ['live', 글]
//   ['row', 이름, 가운데, 값, 오른쪽, 밝힘] — 칸은 글, 단추 [글, 동작, 인자, 표시], 또는 { text, btn: 단추 }
//   ['acts', [단추…], 앞 글] — 단추는 [글, 동작, 인자, 표시]. 표시는 'far' · 'off' · 'warn' · 'enter' · 'top'(바깥 동작)을 띄어 적는다
//   ['pick', 이름, [[글, 값]…], 지금 값, 칸 이름, 동작] · ['fld', 이름, 값, 도움말, 칸 이름, 종류] · ['qa', 물음, 답] · ['grp', 이름, [안쪽…], 숨김]
//   ['gauge', 이름, 몫(0~100), 값, 오른쪽] · ['tog', 이름, 설명, 켜짐, 동작, 표시] · ['confirm', 물음, [사실…], [단추…]](줄 안에서 펼치는 확인, 설계 8.3)
//   tog의 일곱째 칸은 그 단추의 인자다(설정 방의 칸 이름). 같은 동작의 tog가 여럿이어도 다시 그린 뒤 초점이 같은 단추로 돌아온다
// 줄의 watch가 참이면 화면이 그 줄을 열고 접을 때 알린다(모델별 토큰의 실시간, 계정 지우기 확인 묶음).
import { ORDER, num, nameOf, planName, planKey, accountState, passesOf, passPlan, apiCreditPlan, apiCreditOf, apiCreditEndsAtBill, apiCredits, API_CREDIT_SERVICES, flowCreditOf, flowCredits, officialPrice, costOf, billList, nextMonthlyBill, monthSummary, summaryOn, shownAnnual, serviceGroups, isUsedUp, nextBill, pickUsageTips, restWeeks, DAY_MS } from './subscriptions-model.mjs';
import { SOLIO_TODAY_NAMES, josa, joinNames, whenWords, korDate, benefitInfo } from './solio-today.mjs';
import { TOKEN_RANGES, tokenSummary, tokenText } from './subscriptions-tokens.mjs';
import { NAME_MAX, nameProblem, pendingDeletion, membershipLines, sessionRows, signInMethods } from './account-page.mjs';

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
  CREDIT_ACCOUNT_CHANGED: '확인하는 사이 계정이나 요금제가 바뀌었습니다. 지금 보이는 계정 정보를 다시 확인해 주세요.',
  INVALID_CREDIT_CHECK: '확인할 계정 정보나 기입한 값을 읽지 못했습니다. 내용을 다시 확인해 주세요.',
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
/* 「12월 3일 15:00」 */
export const dateTimeWords = t => md(t) + ' ' + hm(t);
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const daysBetween = (t, now) => Math.round((dayStart(t) - dayStart(now)) / DAY_MS);
const dayAfter = (now, n) => { const d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime(); };
const isoDay = t => (d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()))(new Date(t));
/* 오늘 뒤의 다음 결제일까지 남은 날. 오늘이 결제일이면 다음 달 결제일이다 */
const billAfterToday = (day, now) => { const d = nextBill(day, now); if (d !== 0) return d; const n = nextBill(day, dayAfter(now, 1)); return n === null ? null : n + 1; };
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
const BENEFIT_STATUSES = Object.freeze(['linked', 'unlinked', 'not-shown']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normLower = v => clean(v).toLowerCase();
function validIsoDate(s) {
  const p = parseDate(s);
  if (!p) return null;
  const d = new Date(p[0], p[1] - 1, p[2]);
  return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2] ? d.getTime() : null;
}
export function flowUsageOf(row) {
  if (row?.source !== 'auto' || row.service !== 'gemini') return null;
  const email = verifiedEmail(row).toLowerCase(), u = row.flowUsage;
  if (!email || !u || typeof u !== 'object' || normLower(u.account) !== email) return null;
  const from = clean(u.from), to = clean(u.to);
  if (validIsoDate(from) === null || validIsoDate(to) === null || from > to) return null;
  if (typeof u.used !== 'number' || !Number.isInteger(u.used) || u.used < 0 || u.used > 10000000) return null;
  return { account: clean(u.account), checkedAt: u.checkedAt ?? null, from, to, used: u.used };
}
export function parseFlowUsage(fields, now) {
  const from = clean(fields?.flowFrom), to = clean(fields?.flowTo);
  if (!from || !to) return bad('시작일과 마감일을 모두 기입해 주세요.');
  const fromTs = validIsoDate(from), toTs = validIsoDate(to);
  if (fromTs === null || toTs === null) return bad('날짜 형식을 확인해 주세요.');
  if (fromTs > toTs) return bad('시작일은 마감일보다 뒤일 수 없습니다.');
  if (fromTs > dayStart(now) || toTs > dayStart(now)) return bad('오늘보다 뒤의 날짜는 기입할 수 없습니다.');
  if (typeof fields?.flowUsed === 'boolean') return bad('실제 기간 사용량은 0에서 10,000,000 사이 정수로 기입해 주세요.');
  const usedText = numText(fields?.flowUsed);
  if (usedText === '') return bad('직접 확인한 실제 기간 사용량을 기입해 주세요.');
  const used = Number(usedText);
  if (!/^\d+$/.test(usedText) || !Number.isInteger(used) || used < 0 || used > 10000000) return bad('실제 기간 사용량은 0에서 10,000,000 사이 정수로 기입해 주세요.');
  return { ok: true, from, to, used };
}
export function checkCreditTarget(row, arg, kind) {
  let parsed = null;
  try { parsed = JSON.parse(arg); } catch { parsed = null; }
  const expectLen = kind === 'api' ? 3 : 2;
  if (!Array.isArray(parsed) || parsed.length !== expectLen || parsed.some(x => typeof x !== 'string')) return { ok: false, code: 'INVALID_CREDIT_CHECK' };
  const email = clean(parsed[0]), plan = clean(parsed[1]), status = kind === 'api' ? parsed[2] : '';
  if (!EMAIL_RE.test(email) || (kind === 'api' && !BENEFIT_STATUSES.includes(status))) return { ok: false, code: 'INVALID_CREDIT_CHECK' };
  const rowEmail = verifiedEmail(row);
  if (!row || !rowEmail || rowEmail.toLowerCase() !== email.toLowerCase() || (kind === 'api' && normLower(row.plan) !== plan.toLowerCase())) return { ok: false, code: 'CREDIT_ACCOUNT_CHANGED' };
  const validSvc = row.source === 'auto' && (kind === 'api' ? API_CREDIT_SERVICES.includes(row.service) : row.service === 'gemini');
  if (!validSvc) return { ok: false, code: 'INVALID_CREDIT_CHECK' };
  return { ok: true, email, plan, status };
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
  // 결제 줄은 계정마다가 아니라 구독과 요금제마다 한 줄로 묶는다. 계정 열 개가 결제 줄 열 개가 되어 난잡했다(11-20 유호님 「가격 정리해준거 좋은데 조금 뭔가 지금 난잡해」,
  // 솔리오 구독 비서 설계 3.6). 7일 안에 결제되는 계정만 그 아래에 이름과 함께 따로 둔다
  const bills = billList(prices, rows, now), groups = new Map();
  for (const b of bills) {
    // 가족 공유라도 직접 넣은 요금이 있으면 그 요금을 묶음 합에 넣는다. 맨 위 합계와 7일 안 결제 줄은 넣는데 묶음 줄만 「가족 공유」로 덮었다(0.5.0 공개 후보 카본 E2)
    const { row } = b, family = row.source === 'auto' && row.service === 'gemini' && planKey(row.plan) === 'family' && num(row.price) === null;
    const key = svcName(row) + '|' + (row.source === 'auto' ? planName(row.plan, row.service) : '');
    if (!groups.has(key)) groups.set(key, { svc: svcName(row), plan: row.source === 'auto' ? planName(row.plan, row.service) : '', list: [], family: true });
    const g = groups.get(key);
    g.list.push({ ...b, family });
    if (!family) g.family = false;
  }
  for (const g of groups.values()) {
    let krw = 0, priced = 0, unknown = 0, official = 0, annual = 0, usdIn = false;
    for (const { row, official: o, family } of g.list) {
      if (row.cycle === 'annual') annual++;
      if (family) continue;
      const own = num(row.price) !== null;
      if (!own && !o) { unknown++; continue; }
      if (!own) official++;
      if ((own ? row.currency : o.currency) === 'USD') usdIn = true;
      krw += (own ? Number(row.price) : o.price) * ((own ? row.currency : o.currency) === 'USD' ? rate : 1);
      priced++;
    }
    const n = g.list.length, one = n === 1 ? g.list[0].row : null;
    const name = g.family ? g.svc : [g.svc, g.plan].filter(Boolean).join(' ');
    const mid = [one ? (one.source === 'auto' ? nameOf(one) : '') : '계정 ' + n + '개', official ? (official === n ? '공식 요금' : '공식 요금 ' + official + '개') : '', annual ? (annual === n ? '연간 결제' : '연간 결제 ' + annual + '개') : '', unknown && priced ? '요금을 모르는 ' + unknown + '개' : ''].filter(Boolean).join(' · ');
    const val = g.family ? '가족 공유' : priced ? (usdIn ? '약 ' : '') + won(krw) : '';
    const next = g.list.map(x => x.days).filter(d => d !== null && d !== undefined).sort((a, b) => a - b)[0];
    more.push(['row', name, mid, val, next === undefined ? '' : '다음 결제 ' + md(dayAfter(now, next)), false]);
  }
  const due = bills.filter(b => b.row.cycle !== 'annual' && b.days !== null && b.days <= 6);
  if (due.length) {
    more.push(['note', '7일 안에 결제되는 계정입니다.']);
    for (const { row, official, days } of due) {
      const family = row.source === 'auto' && row.service === 'gemini' && planKey(row.plan) === 'family';
      const price = num(row.price) !== null ? money(row.price, row.currency) : family ? '가족 공유' : official ? money(official.price, official.currency) : '';
      more.push(['row', md(dayAfter(now, days)), [svcName(row), row.source === 'auto' ? nameOf(row) : ''].filter(Boolean).join(' · '), price, days === 0 ? '오늘' : days + '일 뒤', true]);
    }
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
  ['설치했는데 「아직 없음」으로 나옵니다', '설치가 끝나면 「다시 확인」을 눌러 주세요. 설치 창을 열었으면 그 창을 닫은 뒤 누릅니다.'],
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
const BENEFIT_CHECK = Object.freeze({
  claude: ['Claude 혜택 설정 열기 ↗', 'claude-benefit-settings', 'Claude Console 결제 조직이'],
  gpt: ['ChatGPT 혜택 설정 열기 ↗', 'gpt-benefit-settings', 'OpenAI 결제 조직이'],
  gemini: ['Google 개발자 혜택 열기 ↗', 'gemini-dev-benefits', 'AI Studio 결제 계정이(Google AI Studio의 Veo API 사용량은 Flow와 별개)'],
});
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
  // 아직 읽지 않은 계정이나 이 PC에 없는 계정이 섞이면 「모두 읽었다」고 하지 않는다(검수 C2)
  const unread = states.filter(x => !x.a.away && x.a.state === 'unknown');
  if (unread.length) return one(unread, r => neun(whoOf(r)) + ' 아직 읽지 않았습니다.', n => '아직 읽지 않은 계정이 ' + countWord(n) + ' 있습니다.');
  const away = states.filter(x => x.a.away);
  if (away.length === states.length) return one(away, r => neun(whoOf(r)) + ' 지금 이 PC에 로그인되어 있지 않습니다.', n => '이 PC에 로그인되어 있지 않은 계정이 ' + countWord(n) + ' 있습니다.');
  // 읽은 때는 계정 줄의 「읽음」과 같은 규칙이다. 오늘이 아니면 날짜를 붙인다
  const when = now - checkAt < 2 * 60e3 ? '방금' : (dayStart(checkAt) === dayStart(now) ? '' : md(checkAt) + ' ') + hm(checkAt) + '에';
  return (away.length ? '이 PC에 로그인된 계정은 모두 ' : '모두 ') + when + ' 읽었고, 막힌 계정은 없습니다.';
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
  // 무료 API 혜택 연결
  if (auto && API_CREDIT_SERVICES.includes(row.service)) {
    const b = benefitInfo(row), open = grpOpen('benefit'), pName = planName(row.plan, row.service) || '요금제 미선택';
    const [billLabel, billLink] = API_BILLING[row.service];
    const [chkLabel, chkLink, orgGuide] = BENEFIT_CHECK[row.service];
    const bMid = b.email ? b.email + (b.matched ? ' · 공식 화면에서 직접 확인한 연결 상태입니다' : '') : '계정 이메일이 확인된 뒤 연결 상태를 기입할 수 있습니다';
    more.push(['row', '무료 API 혜택 연결', bMid, b.label, { text: b.checked, btn: ['확인', 'grp', 'benefit', open ? 'on' : ''] }]);
    const bSaves = b.email ? [
      ['연결됨으로 직접 확인', 'save-benefit', JSON.stringify([row.email, row.plan || '', 'linked']), off('save-benefit')],
      ['미연결로 직접 확인', 'save-benefit', JSON.stringify([row.email, row.plan || '', 'unlinked']), off('save-benefit')],
      ['혜택 항목 안 보임으로 직접 확인', 'save-benefit', JSON.stringify([row.email, row.plan || '', 'not-shown']), off('save-benefit')],
    ] : [];
    const bLinks = [
      [chkLabel, 'help', chkLink],
      [billLabel, 'help', billLink],
      ...(row.service === 'gemini' ? [['AI Studio Veo API 사용량 열기 ↗', 'help', 'gemini-studio-usage']] : []),
      ['닫기', 'grp', 'benefit'],
    ];
    more.push(['grp', 'benefit', [
      ['note', b.email
        ? b.email + ' (' + pName + ') 계정으로 로그인한 공식 설정과 ' + orgGuide + ' 같은지 직접 확인한 뒤 아래 단추로 상태를 기입합니다. 화면을 열기만 해서는 바뀌지 않습니다.'
        : '이 계정의 이메일을 아직 확인하지 못했습니다. 이메일이 확인될 때까지는 공식 화면 열기만 쓸 수 있습니다.'],
      ['acts', [...bSaves, ...bLinks]],
    ], !open]);
  }
  // API 크레딧
  if (auto && API_CREDIT_SERVICES.includes(row.service) && (apiCreditPlan(row) || num(row.apiCredit) !== null)) {
    const c = apiCreditOf(snapshot?.prices, row, now), gemini = row.service === 'gemini';
    const has = !!c && c.left !== null;
    const midText = c?.expired ? '넣어 둔 금액이 ' + md(c.expired) + '에 사라졌습니다' : '구독에 함께 들어 있는 API 사용 금액입니다' + (!has && c?.grant ? ' · 매달 ' + usd(c.grant) : '');
    const right = has ? (gemini ? (c.at ? md(c.at) + '에 넣은 값' : '') : c.until ? md(c.until) + '에 사라짐' : '') : '';
    more.push(['row', 'API 크레딧', midText, has ? usd(c.left) : '', { text: right, btn: editBtn(has, 'api', grpOpen('api')) }]);
    const [billLabel, billLink, where] = API_BILLING[row.service];
    // 넣은 값이 없으면 다음 결제일을 미리 채운다. 오늘이 결제일이면 오늘 받은 크레딧은 다음 달 결제일에 사라지고, 오늘 날짜는 저장할 수 없다(검수 C6)
    const untilDay = c?.until && c.until > now ? isoDay(c.until) : (d => (d === null ? '' : isoDay(dayAfter(now, d))))(row.cycle === 'annual' ? null : billAfterToday(row.billDay, now));
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
    const staleFlow = !!(f?.refilled || f?.expired);
    const has = !staleFlow && !!f && f.left !== null;
    const flowSrcDate = has ? korDate(f?.at ?? f?.checkedAt ?? row.flowCreditAt) : '';
    const flowSrc = has ? (flowSrcDate ? '마지막 확인 ' + flowSrcDate : '확인일 없음') : '';
    const midText = staleFlow ? '기입한 다시 차는 때가 지났습니다 · Flow에서 직접 확인해 다시 기입해 주세요'
      : '영상과 그림에 씁니다' + (has ? ' · ' + flowSrc : f?.grant ? ' · 매달 ' + fmt(f.grant) + '개' : '');
    more.push(['row', 'Flow 크레딧', midText, staleFlow ? '재확인 필요' : has ? fmt(f.left) : '', { text: has && f.until ? md(f.until) + '에 다시 참' : '', btn: editBtn(has, 'flow', grpOpen('flow')) }]);
    const at = has && f.until && f.until > now ? f.until : null;
    more.push(['grp', 'flow', [
      ['fld', '남은 Flow 크레딧', has ? String(f.left) : '', '정수, 0에서 10,000,000', 'flowCredit', 'number'],
      ['fld', '다시 차는 날짜', at ? isoDay(at) : '', '', 'flowDate', 'date'],
      ['fld', '다시 차는 시각(선택)', at && hm(at) !== '23:59' ? hm(at) : '', '비우면 그날 23:59로 봅니다', 'flowTime', 'time'],
      ['note', '그 계정으로 로그인한 브라우저에서 Google Flow 오른쪽 위 프로필을 눌러 요금제 기본 남은 개수와 다시 차는 때를 직접 확인해 기입합니다. 추가 보충 AI 크레딧과 구분해 보며, 개수를 비우고 저장하면 기입한 값을 지웁니다.'],
      ['acts', [['저장', 'save-flow', '', flags('enter', off('save-flow'))], ['Flow 열기 ↗', 'help', 'flow-app'], ['닫기', 'grp', 'flow']]],
    ], !grpOpen('flow')]);
    const u = flowUsageOf(row), uOpen = grpOpen('flow-usage'), uEmail = verifiedEmail(row);
    const uDate = u ? korDate(u.checkedAt) : '';
    const uChecked = u ? (uDate ? '마지막 확인 ' + uDate : '확인일 없음') : '';
    const uMid = u ? uEmail + ' · ' + korDate(u.from) + ' ~ ' + korDate(u.to) + ' ' + (row.flowUsage?.source === 'official' ? '공식 활동 내역' : '직접 기입')
      : uEmail ? 'Google One 활동에서 실제 기간 사용량과 마감일을 직접 확인해 기입합니다'
      : '계정 이메일이 확인된 뒤 실제 기간 사용량을 기입할 수 있습니다';
    more.push(['row', 'Flow 활동 사용량', uMid, u ? fmt(u.used) + ' 크레딧 사용' : '미확인', { text: uChecked, btn: editBtn(!!u, 'flow-usage', uOpen) }]);
    more.push(['grp', 'flow-usage', [
      ...(uEmail ? [
        ['fld', '시작일', u ? u.from : '', '', 'flowFrom', 'date'],
        ['fld', '마감일', u ? u.to : '', '', 'flowTo', 'date'],
        ['fld', '실제 기간 사용량', u ? String(u.used) : '', '정수, 0에서 10,000,000', 'flowUsed', 'number'],
      ] : []),
      ['note', uEmail
        ? uEmail + ' 계정의 Google One 활동에서 실제 기간 사용량과 마감일을 직접 확인해 기입합니다(제공량에서 잔액을 뺀 추정치 아님). Flow 요금제 기본 잔액과 보충 AI 크레딧은 구분하며, Google AI Studio의 Veo API 사용량은 별개입니다.'
        : '이 계정의 이메일을 아직 확인하지 못했습니다. 이메일이 확인될 때까지는 공식 화면 열기만 쓸 수 있습니다. Flow 요금제 기본 잔액과 보충 AI 크레딧은 구분하며, Google AI Studio의 Veo API 사용량은 별개입니다.'],
      ['acts', [
        ...(uEmail ? [['저장', 'save-flow-usage', JSON.stringify([row.email, row.plan || '']), flags('enter', off('save-flow-usage'))]] : []),
        ['Google One 활동 열기 ↗', 'help', 'flow-activity'],
        ['Flow 잔액 열기 ↗', 'help', 'flow-app'],
        ['닫기', 'grp', 'flow-usage'],
      ]],
    ], !uOpen]);
  }
  // Render confirmed official Google Flow wallet next to dated Flow usage without mixing into AI credits.
  const flowWallet = flowWalletValue(row);
  if (flowWallet) more.push(['row', 'Flow 확인 잔액', flowWallet]);
  if (row.note) more.push(['note', row.note]);
  // 할 수 있는 일
  const acts = [];
  if (auto) acts.push([reloginLabel(row), 'relogin', '', off('relogin')]);
  if (auto && a.state === 'error') acts.push(['이 계정 다시 읽기', 'reread-one', '', off('reread-one')]);
  const creditEmail = auto ? verifiedEmail(row) : '';
  if (creditEmail && (row.service === 'claude' || row.service === 'gpt' || row.service === 'gemini')) {
    const creditArg = creditReadArg(row, creditEmail);
    acts.push(['공식 화면에서 연결 확인', 'read-credit-api', creditArg, off('read-credit-api')]);
    if (row.service === 'gemini') {
      acts.push(['이번 달 Flow 사용량 읽기', 'read-credit-flow', creditArg, off('read-credit-flow')]);
    }
  }
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
// Helpers for verified-account provider reads and official Flow wallet display.
function verifiedEmail(row) {
  if (!row || row.emailVerified === false || typeof row.email !== 'string') return '';
  const email = row.email.trim();
  return EMAIL_RE.test(email) ? email : '';
}
function creditReadArg(row, email) {
  const plan = typeof row?.plan === 'string' ? row.plan : '';
  return JSON.stringify([email, plan || '']);
}
function flowCheckedDate(value) {
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T00:00:00Z`);
      return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
    }
    if (!s) return '';
    const ms = Date.parse(s);
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
  return '';
}
function flowWalletValue(row) {
  if (row?.service !== 'gemini') return '';
  const email = verifiedEmail(row);
  const usage = row.flowUsage;
  if (!email || !usage || usage.source !== 'official') return '';
  const rawAcct = usage.email ?? usage.account ?? usage.accountEmail;
  const observedEmail = typeof rawAcct === 'string' ? rawAcct.trim() : '';
  if (!observedEmail || observedEmail.toLowerCase() !== email.toLowerCase()) return '';
  if (!Number.isInteger(usage.wallet) || usage.wallet < 0) return '';
  const checked = flowCheckedDate(usage.checkedAt);
  if (!checked) return '';
  return `${usage.wallet.toLocaleString('ko-KR')}개 · ${checked}`;
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
  const items = [['pick', '무엇을 더하시겠습니까', ADD_SERVICES.map(k => [ADD[k].nm, k]), svc, '', 'add-pick']];
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
      // 설치 줄 아래에 직접 설치하는 길을 둔다(옛 판의 「직접 붙여 넣고 싶다면」). PowerShell 명령은 Windows에만, 공식 설치 안내는 어느 PC에나 둔다.
      // 지금 누를 단추는 맨 아래, 알림 줄 바로 위에 선다
      const direct = [];
      if (snapshot?.platform !== 'darwin' && s.cmd) { out.push(['note', '직접 붙여 넣으려면 PowerShell에 이 명령을 넣습니다.'], ['cmd', s.cmd]); direct.push(['명령 복사', 'tool-copy', svc]); }
      if (s.installLink) direct.push(['공식 설치 안내 ↗', 'help', s.installLink]);
      if (direct.length) out.push(['acts', direct]);
      out.push(['row', '3 로그인', '설치가 끝나면 열립니다', '', '']);
      if (s.node && tool && tool.npm === false) out.push(['note', 'Higgsfield CLI는 Node.js가 먼저 있어야 합니다.'], ['acts', [['Node.js 받기 ↗', 'help', 'node']]]);
      // 「다시 확인」은 늘 둔다. 설치 창을 거치지 않고 직접 설치한 사람도 다음 단계로 넘어간다(검수 C1)
      const recheck = ['다시 확인', 'recheck-tools', svc, off('recheck-tools')];
      out.push(['acts', opened ? [recheck] : [['설치 창 열기', 'install', svc, off('install')], recheck]]);
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
  // 다른 로그인은 다른 서비스일 수도, 같은 서비스의 다른 계정이나 「계정 더하기」일 수도 있다(검수 C5)
  const busySay = '다른 로그인이 진행 중입니다. 끝난 뒤 이어서 해 주세요.';
  if (relogin) {
    // 단계 줄은 실패했을 때만 선다. 다른 로그인을 기다릴 때는 알림 한 줄이다(빈 「로그인」 줄을 두지 않는다)
    if (failed) out.push(['row', step, '로그인을 마치지 못했습니다', '', '']);
    if (failed && login.message) out.push(['note', sentence(login.message)]);
    if (busyOther) out.push(['note', busySay]);
    if (failed) out.push(['acts', [['다시 시도', 'relogin', '', flags(busyOther && 'off', off('relogin'))]]]);
    return failed || busyOther ? out : [];
  }
  const switching = svc === 'gemini' && (snapshot?.rows || []).some(r => r.source === 'auto' && r.service === 'gemini');
  out.push(['row', '3 로그인', s.dark ? '검은 창이 열립니다. 브라우저에서 연결할 Google 계정을 고릅니다.' + (switching ? ' 이미 다른 계정으로 로그인된 창이면 /logout과 /login을 먼저 칩니다.' : '') : '브라우저에서 로그인합니다. 이 PC에 이미 로그인해 둔 계정이 있으면 그대로 가져올 수 있습니다.', '', failed ? '마치지 못함' : '', true]);
  if (failed && login.message) out.push(['note', sentence(login.message)]);
  if (s.email) out.push(['fld', '연결할 이메일(선택)', '', '로그인 화면에 미리 채웁니다. 브라우저에 다른 계정이 로그인돼 있으면 그 계정으로 연결됩니다', 'email', 'email']);
  if (busyOther) out.push(['note', busySay]);
  const dis = flags(busyOther && 'off', off('login'));
  out.push(['acts', s.dark ? [[failed ? '다시 시도' : 'Gemini 로그인', 'login', svc, dis]] : [[failed ? '다시 시도' : '새 계정 연결', 'login', svc, dis], ['이 PC의 기존 로그인 쓰기', 'existing', svc, flags(busyOther && 'off', off('existing'))]]]);
  return out;
}

/* ── 구독 방의 「모델별 토큰」 줄(설계 3절, 설계 검토 D8). 기간 묶기와 모델 이름은 subscriptions-tokens.mjs를 그대로 쓴다.
   st: { tokRange, tokAll, armed, busy, notes }. 토큰 자료가 없거나(아직 읽지 않음, 본체가 거절) ok가 아니면 줄을 세우지 않는다 ── */
export const TOK_SHOWN = 6;
// 오른쪽 칸의 프로그램 이름. 본체가 기록을 읽는 도구 넷이다
const TOK_TOOLS = Object.freeze({ claude: 'Claude Code', gpt: 'Codex', grok: 'Grok CLI', gemini: 'Gemini CLI' });
const TOK_SPAN = Object.freeze({ today: '오늘', week: '지난 7일', month: '지난 30일' });
const tokDay = (key, now) => (Number(key.slice(0, 4)) !== new Date(now).getFullYear() ? Number(key.slice(0, 4)) + '년 ' : '') + Number(key.slice(5, 7)) + '월 ' + Number(key.slice(8, 10)) + '일';
const tokShare = m => { const p = Math.round((m.share || 0) * 100); return p === 0 && m.out > 0 ? '1% 미만' : p + '%'; };
const rowLabel = parts => parts.filter(Boolean).join(', ') + '. 자세한 내용은 이 줄 아래에 펼쳐집니다.';
export function tokRow(tokens, st = {}, now = Date.now()) {
  if (!tokens || tokens.ok !== true) return null;
  const off = act => (st.busy === 'tok:' + act ? 'off' : '');
  const note = ['live', st.notes?.get?.('tok') || ''];
  const base = { key: 'tok', nm: '모델별 토큰', watch: true };
  if (!tokens.enabled) {
    return { ...base, mid: '꺼져 있습니다', val: '', when: '', unread: true, label: rowLabel(['모델별 토큰', '꺼져 있습니다']), more: [
      ['say', '모델마다 AI가 답으로 쓴 토큰을 셉니다. 토큰은 AI가 읽고 쓴 글의 양입니다.'],
      ['note', '켜면 이 PC에 남은 대화 기록에서 모델 이름과 토큰 수만 꺼내 더합니다. 대화 내용은 꺼내 두지 않고 밖으로 보내지 않습니다. 로그인 정보 파일은 열지 않습니다.'],
      ['note', '이 PC에 남기는 것은 날짜와 모델별 숫자, 어느 기록 파일을 어디까지 읽었는지입니다. 끄면 모두 지웁니다.'],
      ['acts', [['모델별 토큰 켜기', 'tok-on', '', off('tok-on')]]],
      note,
    ] };
  }
  // 끄기는 두 번 누른다(설계 8절). 묻는 동안 알림 줄에 무엇이 지워지는지 쓴다
  const armed = !!st.armed && st.armed.key === 'tok' && st.armed.act === 'tok-off';
  const offBtn = [armed ? '한 번 더 누르면 끄고 지웁니다' : '끄기', 'tok-off', '', flags(armed && 'warn', off('tok-off'))];
  const live = armed ? ['live', '끄면 모은 숫자를 지웁니다. 다시 켜면 처음부터 다시 셉니다.'] : note;
  const p = tokens.progress, progress = p && p.total ? fmt(p.done) + '/' + fmt(p.total) : '';
  if (!tokens.scannedAt) {
    if (tokens.scanning) {
      return { ...base, mid: '처음 세는 중입니다', val: progress, when: '', label: rowLabel(['모델별 토큰', '처음 세는 중입니다', progress && '기록 파일 ' + progress]), more: [
        ['say', '처음이라 이 PC의 기록 파일을 모두 세고 있습니다.'],
        ['note', '기록이 많으면 몇 분 걸립니다. 다른 화면을 봐도 계속 셉니다.'],
        ['acts', [offBtn]], live] };
    }
    const mid = tokens.error ? '세다가 멈췄습니다' : '아직 세지 않았습니다';
    return { ...base, mid, val: '', when: '', unread: true, label: rowLabel(['모델별 토큰', mid]), more: [
      ['say', tokens.error ? '기록 파일을 세다가 멈췄습니다.' : '아직 기록 파일을 세지 않았습니다.'],
      ['acts', [['다시 세기', 'tok-scan', '', off('tok-scan')], offBtn]], live] };
  }
  const range = TOKEN_RANGES.some(([k]) => k === st.tokRange) ? st.tokRange : 'week';
  const s = tokenSummary(tokens, range, now), span = TOK_SPAN[s.range], top = s.models[0] || null;
  // 닫힌 줄의 요약은 한 가지만 말한다(시안 맹검 11-18)
  const mid = top ? '가장 많이 쓴 모델은 ' + top.label + '입니다 · ' + tokShare(top) : s.range === 'today' ? '오늘은 센 응답이 없습니다' : span + ' 동안 센 응답이 없습니다';
  const val = top ? tokenText(s.total.out) : '';
  const when = top ? span + ' · 응답 ' + fmt(s.total.n) + '번' : '';
  const more = [['pick', '기간', TOKEN_RANGES.map(([k, t]) => [t, k]), s.range, '', 'tok-range']];
  for (const m of st.tokAll ? s.models : s.models.slice(0, TOK_SHOWN)) more.push(['gauge', m.label, Math.max(Math.round(m.share * 100), m.out > 0 ? 1 : 0), tokenText(m.out), (TOK_TOOLS[m.service] || m.tool) + ' · 응답 ' + fmt(m.n) + '번']);
  if (s.models.length > TOK_SHOWN) more.push(['acts', [[st.tokAll ? '여섯 개만 보기' : '모델 ' + s.models.length + '개 모두 보기', 'tok-all', '']]]);
  if (s.late.length) more.push(['note', s.late.map(l => (TOK_TOOLS[l.service] || l.tool) + ' 기록은 ' + tokDay(l.since, now) + '부터').join(', ') + ' 있습니다. 그 전 날은 비어 있습니다.']);
  const tools = tokens.tools || {}, found = ['claude', 'gpt', 'grok', 'gemini'].some(k => tools[k] > 0);
  const about = [];
  if (top) about.push('AI가 답으로 쓴 토큰(글의 양)이 많은 순서입니다.', '오른쪽은 그 모델을 쓴 프로그램입니다.');
  if (!found) about.push('이 PC에서 Claude Code, Codex, Grok CLI, Gemini CLI의 기록을 아직 찾지 못했습니다.');
  about.push('이 PC에 기록이 남지 않는 웹과 휴대폰 사용은 빠집니다.');
  if (tools.agy) about.push('Antigravity CLI는 토큰 수를 남기지 않아 세지 못합니다.');
  more.push(['note', about.join(' ')]);
  const last = Math.max(Number(tokens.scannedAt) || 0, Number(tokens.liveAt) || 0), facts = [];
  if (tokens.scanning) facts.push('지금 다시 세고 있습니다' + (progress ? '(기록 파일 ' + progress + ')' : '') + '.');
  else if (last) facts.push((dayStart(last) === dayStart(now) ? '' : md(last) + ' ') + hm(last) + '에 마지막으로 셌습니다.');
  if (tokens.live) facts.push('구독 방을 열어 두면 답이 끝날 때마다 숫자를 더합니다.');
  if (tokens.failed > 0 && !tokens.scanning) facts.push('읽지 못한 파일이 ' + fmt(tokens.failed) + '개 있습니다.');
  if (tokens.error) facts.push('지난번에는 끝까지 세지 못했습니다.');
  if (facts.length) more.push(['note', facts.join(' ')]);
  more.push(['acts', [['토큰 다시 세기', 'tok-scan', '', flags(tokens.scanning && 'off', off('tok-scan'))], offBtn]], live);
  return { ...base, mid, val, when, unread: !top, label: rowLabel(['모델별 토큰', mid, val && val + ' 토큰', when]), more };
}

/* ── 내 계정 방(설계 5절, 설계 검토 D1 · D4 · D5 · D11 · D12). 자료는 accountView와 accountIdentity다 ── */
/* 오류 글. 옛 내 계정의 MESSAGES를 합니다체로 다시 썼다 */
export const ACCOUNT_SAY = Object.freeze({
  PROFILE_CONFLICT: '다른 곳에서 먼저 이름을 바꿨습니다. 지금 이름을 확인한 뒤 다시 저장해 주세요.',
  REVISION_CONFLICT: '다른 곳에서 학습 기록 연결을 먼저 바꿨습니다. 지금 상태를 확인한 뒤 다시 해 주세요.',
  LEARNING_DISABLED: '지금은 학습 기록 연결을 켤 수 없습니다.',
  FEATURE_DISABLED: '지금은 학습 기록 연결을 켤 수 없습니다.',
  ACCOUNT_UNAVAILABLE: '지금 이 계정 상태에서는 할 수 없습니다.',
  DELETION_NOT_CANCELLABLE: '이미 처리하기 시작해 삭제 요청을 취소할 수 없습니다. hello@synk.im으로 알려 주세요.',
  REQUEST_NOT_FOUND: '취소할 삭제 요청을 찾지 못했습니다. 계정 정보를 새로 불러왔습니다.',
  SESSION_NOT_FOUND: '이미 끝난 로그인입니다. 목록을 새로 불러왔습니다.',
  AUTH_REQUIRED: 'SYNK ID로 다시 로그인해 주세요.',
  AUTH_CHANGED: '로그인 상태가 바뀌었습니다. 다시 해 주세요.',
  SUITE_UNAVAILABLE: '로그인 기록을 읽지 못했습니다. 플랫폼을 다시 시작한 뒤 해 주세요.',
  PROFILE_REVISION_MISSING: '이 계정 서버 판에서는 여기서 이름을 바꿀 수 없습니다.',
  SECURITY_OPEN_FAILED: '브라우저를 열지 못했습니다. synk.im/id에서 로그인한 뒤 「로그인과 보안」을 열어 주세요.',
});
export const ACCOUNT_NETWORK_SAY = '계정 서버에 닿지 못했습니다. 인터넷 연결을 확인한 뒤 다시 해 주세요.';
export const ACCOUNT_DEFAULT_SAY = '처리하지 못했습니다. 잠시 뒤 다시 해 주세요.';
export const accountSay = (code, retryable = false) => (code && Object.hasOwn(ACCOUNT_SAY, code) ? ACCOUNT_SAY[code]
  : retryable || ['NETWORK', 'SERVICE_UNAVAILABLE', 'AUTH_SERVER_UNAVAILABLE'].includes(code) ? ACCOUNT_NETWORK_SAY : ACCOUNT_DEFAULT_SAY);
/* 바꾼 뒤 이 코드가 오면 조용히 다시 읽고 알린다(옛 내 계정 193행) */
export const ACCOUNT_CONFLICTS = Object.freeze(['PROFILE_CONFLICT', 'REQUEST_NOT_FOUND', 'SESSION_NOT_FOUND', 'REVISION_CONFLICT']);
export const SESSIONS_SHOWN = 6;
/* 이름 검사. 규칙은 옛 nameProblem(빈 이름, 60자, 쓸 수 없는 글자)이고 글만 합니다체로 고쳐 쓴다 */
export function checkName(value) {
  const name = String(value ?? '').trim();
  if (!nameProblem(value)) return { ok: true, value: name };
  if (!name) return bad('이름을 넣어 주세요.');
  if (name.length > NAME_MAX || [...name].length > NAME_MAX) return bad('이름은 ' + NAME_MAX + '자 안으로 적어 주세요.');
  return bad('이름에 쓸 수 없는 글자가 들어 있습니다.');
}
const dayWords = t => (d => d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일')(new Date(t));
const PLACE_WORD = ['', '한', '두', '세', '네'];
const placeWord = n => (PLACE_WORD[n] ? PLACE_WORD[n] + ' 곳' : n + '곳');
const usedWhen = (t, now) => (dayStart(t) === dayStart(now) ? '오늘 ' : md(t) + ' ') + hm(t);

/* acc: { data, identity, loading, error, identityError, allSessions, askDelete }
   st: 방 상태(armed · busy · notes) · ctx: { name(로그인 정보의 이름), accountKey(계정 번호를 아직 읽지 못했을 때) } */
export function accountRoom(acc = {}, st = {}, now = Date.now(), ctx = {}) {
  const data = acc.data || null, account = data?.account || null;
  const number = account?.synk_user_id || ctx.accountKey || '';
  // 계정 번호는 시안처럼 맨 아래 작은 줄에 늘 보인다(설계 검토 D12)
  const foot = number ? '문의할 때 쓰는 계정 번호 ' + number : '';
  if (!data) {
    if (acc.error) return { say: '계정 정보를 불러오지 못했습니다.', then: acc.error, rows: [], foot, act: ['다시 불러오기', 'retry', acc.loading ? 'off' : ''] };
    return { say: '계정 정보를 불러오고 있습니다.', then: '', rows: [], foot, act: ['로그아웃', 'sign-out', ''] };
  }
  const off = (key, act) => (st.busy === key + ':' + act ? 'off' : '');
  const name = String(account?.profile?.display_name || ctx.name || '').trim();
  const pending = pendingDeletion(data), deleting = account?.status === 'deletion-requested';
  const sessions = sessionRows(data), n = sessions.length;
  const due = pending ? Date.parse(pending.due_at || '') : NaN, dueText = Number.isFinite(due) ? md(due) + ' ' + hm(due) : '';
  const say = deleting ? '계정을 지워 달라고 요청했습니다.' : name ? name + ' 님으로 로그인했습니다.' : 'SYNK 회원으로 로그인했습니다.';
  const then = pending ? (dueText ? dueText + '까지는' : '7일 동안은') + ' 이 자리에서 취소할 수 있습니다.'
    : deleting ? '계정 삭제를 처리하고 있습니다.'
      : n > 1 ? '이 PC를 포함해 ' + placeWord(n) + '에서 쓰고 있습니다.' : n === 1 ? '이 PC에서만 쓰고 있습니다.' : '';
  const rows = [
    nameRow(acc, st, name, deleting, off),
    loginRow(acc, st, off),
    placesRow(acc, st, now, sessions, off),
    dataRow(acc, st, deleting, off),
    deleteRow(acc, st, pending, deleting, Number.isFinite(due) ? due : null, off),
  ];
  return { say, then, rows, foot, act: ['로그아웃', 'sign-out', ''] };
}
function nameRow(acc, st, name, deleting, off) {
  const created = Date.parse(acc.identity?.createdAt || ''), memberships = membershipLines(acc.data);
  const more = [];
  // 삭제를 요청한 동안에는 이름을 바꿀 수 없다(옛 화면과 같다)
  if (deleting) more.push(['say', '계정 삭제를 요청한 동안에는 이름을 바꿀 수 없습니다.']);
  else more.push(['fld', '새 이름', name, NAME_MAX + '자까지', 'name', 'text'], ['acts', [['저장', 'name-save', '', flags('enter', off('name', 'name-save'))]]]);
  more.push(['row', '소속', memberships.length ? memberships.join(' / ') : '학교나 회사와 연결된 소속이 없습니다', '', '']);
  more.push(['note', '회사 Workspace에는 회사 계정 이름이 보입니다.']);
  more.push(['live', st.notes?.get?.('name') || '']);
  const when = Number.isFinite(created) ? dayWords(created) + ' 가입' : '';
  return { key: 'name', nm: '이름', mid: 'SYNK 앱마다 이 이름으로 보입니다', val: name, when, label: rowLabel(['이름', name, when]), more };
}
function loginRow(acc, st, off) {
  const id = acc.identity || null, methods = signInMethods(id), email = String(id?.email || '');
  const ways = [methods.email ? '이메일과 비밀번호' : '', methods.google ? 'Google' : ''].filter(Boolean);
  const unknown = acc.identityError ? '불러오지 못했습니다' : '불러오는 중입니다';
  const go = (text, section) => [text, 'security', section, off('login', 'security')];
  // 비밀번호와 로그인 이메일은 브라우저의 SYNK ID에서 바꾼다. PC 앱은 비밀번호를 받지 않는다. 메일은 옛 화면처럼 전체를 보인다(설계 검토 D11)
  const more = [['say', '비밀번호와 로그인 이메일은 브라우저에서 바꿉니다. PC 앱은 비밀번호를 받지 않습니다.']];
  more.push(['row', '로그인 이메일', email || unknown, '', go('바꾸기 ↗', 'email')]);
  if (id?.newEmail) more.push(['note', '새 이메일 ' + id.newEmail + '의 확인을 기다리고 있습니다.']);
  if (methods.email || !methods.google) more.push(['row', '비밀번호', '바꾸면 이 PC 앱도 로그아웃됩니다. 새 비밀번호로 다시 로그인합니다', '', go('바꾸기 ↗', 'password')]);
  else more.push(['row', '비밀번호', 'Google로 가입한 계정입니다. 비밀번호를 만들면 이메일로도 로그인할 수 있습니다', '', go('비밀번호 만들기 ↗', 'password')]);
  if (methods.google) more.push(['row', 'Google', '연결되어 있습니다', '', '']);
  else if (id) more.push(['row', 'Google', '연결하면 다음부터 Google로 로그인해도 이 계정이 열립니다', '', go('Google 연결하기 ↗', 'google')]);
  if (email) more.push(['note', '브라우저에 다른 계정이 로그인되어 있을 수 있습니다. 열린 화면의 로그인 이메일이 ' + email + '인지 확인해 주세요.']);
  more.push(['live', st.notes?.get?.('login') || '']);
  const mid = ways.length ? ways.join(' · ') : unknown;
  return { key: 'login', nm: '로그인', mid, val: '', when: email, label: rowLabel(['로그인', mid, email]), more };
}
function placesRow(acc, st, now, sessions, off) {
  const raw = new Map((acc.data?.sessions || []).filter(Boolean).map(r => [r.id, r]));
  const place = s => (s.current ? '이 PC' : s.label || s.name);
  const more = [];
  if (!sessions.length) more.push(['note', '보일 로그인 기록이 없습니다.']);
  for (const s of acc.allSessions ? sessions : sessions.slice(0, SESSIONS_SHOWN)) {
    const t = Date.parse(raw.get(s.id)?.last_seen || '');
    const seen = s.current ? '지금 쓰는 중' : Number.isFinite(t) ? usedWhen(t, now) + '에 사용' : '사용 기록 없음';
    more.push(['row', place(s), [s.current || s.label ? s.name : '', seen].filter(Boolean).join(' · '), '', s.current ? '' : ['로그아웃시키기', 'revoke', s.id, off('places', 'revoke:' + s.id)], s.current]);
  }
  if (sessions.length > SESSIONS_SHOWN) more.push(['acts', [[acc.allSessions ? '여섯 곳만 보기' : (sessions.length - SESSIONS_SHOWN) + '곳 더 보기', 'sessions-all', '']]]);
  // 모든 곳에서 로그아웃은 두 번 누른다. 두 번째 누름 뒤 쓰던 글이 있으면 펼침의 로그아웃과 같은 확인을 거친다(설계 검토 D1)
  const armed = !!st.armed && st.armed.key === 'places' && st.armed.act === 'revoke-all';
  more.push(['acts', [[armed ? '한 번 더 누르면 모두 로그아웃합니다' : '모든 곳에서 로그아웃', 'revoke-all', '', flags(armed && 'warn', off('places', 'revoke-all'))]]]);
  more.push(['live', armed ? '이 PC를 포함해 다른 기기와 브라우저의 SYNK 로그인을 모두 끝냅니다. 이 PC도 바로 로그아웃됩니다.' : st.notes?.get?.('places') || '']);
  const names = sessions.map(place);
  const mid = names.length > 3 ? names.slice(0, 3).join(' · ') + ' 외 ' + (names.length - 3) + '곳' : names.join(' · ');
  const val = sessions.length + '곳';
  return { key: 'places', nm: '로그인한 곳', mid, val, when: '', label: rowLabel(['로그인한 곳', mid, val]), more };
}
function dataRow(acc, st, deleting, off) {
  const data = acc.data, on = data?.learning?.enabled === true, can = data?.capabilities?.learningSync === true && !deleting;
  const why = on ? '켜져 있습니다. 연습 기록을 계정에 저장해 다른 기기에서도 이어 갑니다'
    : can ? '켜면 연습 기록을 계정에 저장해 다른 기기에서도 이어 갑니다'
      : deleting ? '계정 삭제를 요청해서 켤 수 없습니다. 요청을 취소하면 다시 켤 수 있습니다' : '지금은 켤 수 없습니다. 이 기기에서 하는 연습은 그대로 할 수 있습니다';
  // 연습 기록 내려받기와 마을 기록은 옛 내 계정 화면을 연다(설계 검토 D4). 내 성향은 두지 않는다(D5)
  const more = [
    ['tog', '학습 기록 연결', why, on, 'learning', flags(!(on || can) && 'off', off('data', 'learning'))],
    ['row', '연습 기록', '내 기록을 파일 하나로 받습니다. 과제와 AI 기록은 들어 있지 않습니다', '', ['내려받기', 'export', '']],
    ['row', '마을 기록', '싱크타운 주민이 기억하는 일을 보고, 빼거나 비울 수 있습니다', '', ['열기', 'town', '']],
    ['note', '내려받기와 마을 기록은 지금 앱의 내 계정 화면에서 엽니다. 맨 위 「돌아가기」를 누르면 이 방으로 돌아옵니다.'],
    ['live', st.notes?.get?.('data') || ''],
  ];
  const mid = '학습 기록 연결 ' + (on ? '켜짐' : '꺼짐') + ' · 연습 기록 · 마을 기록';
  return { key: 'data', nm: '내 데이터', mid, val: '', when: '', label: rowLabel(['내 데이터', mid]), more };
}
/* 계정 지우기. 요청은 같은 단추를 두 번 누르지 않고 줄 안에서 펼치는 확인 묶음으로 보낸다(설계 8.3, 설계 검토 D1) */
function deleteRow(acc, st, pending, deleting, due, off) {
  const live = ['live', st.notes?.get?.('del') || ''];
  if (pending) {
    const mid = due ? md(due) + '까지 취소할 수 있습니다' : '7일 동안 취소할 수 있습니다';
    return { key: 'del', gap: true, now: true, nm: '계정 지우기', mid, val: '요청됨', when: '', label: rowLabel(['계정 지우기', '요청됨', mid]), more: [
      ['say', (due ? md(due) + ' ' + hm(due) + '까지는' : '7일 동안은') + ' 이 자리에서 요청을 취소할 수 있습니다.'],
      ['note', '그 뒤 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지웁니다. 늦어도 요청 후 30일 안에 지우고, 지운 뒤에는 되돌릴 수 없습니다. 취소해도 학습 기록 연결은 꺼진 채로 남습니다.'],
      ['acts', [['요청 취소', 'delete-cancel', '', off('del', 'delete-cancel')]]], live] };
  }
  if (deleting) {
    return { key: 'del', gap: true, now: true, nm: '계정 지우기', mid: '삭제를 처리하고 있습니다', val: '', when: '', label: rowLabel(['계정 지우기', '삭제를 처리하고 있습니다']), more: [
      ['say', '계정 삭제를 처리하고 있어 이제는 취소할 수 없습니다.'],
      ['note', '늦어도 요청 후 30일 안에 계정과 기록을 지웁니다. 궁금한 점은 hello@synk.im으로 알려 주세요.'], live] };
  }
  const asking = !!acc.askDelete;
  const more = [['say', '계정을 지우면 학습 기록, 맞춤 기억, 로그인 정보가 함께 지워집니다.']];
  // 확인 묶음이 펼쳐지면 같은 사실을 되풀이하지 않게 작은 글을 뺀다
  if (!asking) more.push(['note', '요청하면 학습 기록 연결을 바로 멈춥니다. 7일이 지나면 되돌릴 수 없습니다. 회사 작업실 자료와 학교 소속 기록은 그곳에서 따로 정리합니다.']);
  more.push(['acts', [['지우기 요청', 'delete-ask', '', flags('toggle', asking && 'on', off('del', 'delete-ask'))]]]);
  if (asking) more.push(['confirm', '계정 삭제를 요청하시겠습니까?', [
    '요청하면 학습 기록 연결을 바로 멈춥니다.',
    '7일 동안은 이 자리에서 요청을 취소할 수 있습니다. 그 뒤 계정과 학습 기록, 맞춤 기억, 로그인 정보를 지우고(늦어도 요청 후 30일 안), 지운 뒤에는 되돌릴 수 없습니다.',
    '회사 작업실 자료와 학교 소속 기록은 그곳에서 따로 정리합니다.',
  ], [['삭제 요청 보내기', 'delete-send', '', off('del', 'delete-send')], ['그만두기', 'delete-keep', '']]]);
  more.push(live);
  // 줄이 접히면 확인 묶음도 접는다(화면이 접힘을 알린다)
  return { key: 'del', gap: true, unread: true, watch: true, nm: '계정 지우기', mid: '요청한 뒤 7일 동안은 취소할 수 있습니다', val: '', when: '', label: rowLabel(['계정 지우기', '요청한 뒤 7일 동안은 취소할 수 있습니다']), more };
}

/* ── 구독 줄 안쪽의 팁(설계 14절 D7, 설계 검토 16절). 고르는 일(쉬는 팁, 둘까지, 방향 순서, 팁 끄기)은 모델의 pickUsageTips가 하고,
   여기서는 그 팁의 숫자로 합니다체 한 줄을 짓는다. 연간 결제 팁은 요금 줄 안쪽에 있다(costRow). 돌려주는 값: 서비스 → { key, text, done, live, busy } ── */
const tipWhen = (t, now) => whenWords(t, now, { withTime: true });
function passHint(h, now) {
  if (h.gpt) {
    if (h.hint === 'reset') return ' 지금 쓰면 ' + tipWhen(h.reset, now) + '의 주간 초기화가 사라집니다. 초기화 뒤 많이 쓴 다음 만료 전에 쓰는 편이 낫습니다.';
    return h.hint === 'used' ? ' 지금 주간 한도를 ' + h.used + '% 썼습니다. 쓰면 쓴 만큼 다시 채워지고, 주간 초기화 날짜가 바뀝니다.' : ' 주간 한도를 많이 쓴 뒤에 쓰면 가장 많이 채워집니다.';
  }
  if (h.hint === 'reset') return ' 그 전에 ' + tipWhen(h.reset, now) + '에 주간 초기화가 옵니다. 초기화 뒤 많이 쓴 다음 만료 전에 쓰면 더 많이 채워집니다.';
  return h.hint === 'used' ? ' 지금 주간 한도를 ' + h.used + '% 썼습니다. 지금 쓰면 쓴 만큼 다시 채워집니다.' : ' 주간 한도를 많이 쓴 뒤에 쓰면 가장 많이 채워집니다.';
}
export function tipWords(t, now = Date.now()) {
  const name = SOLIO_TODAY_NAMES[t?.service] || String(t?.label || '').trim();
  if (!t || !name) return '';
  if (t.type === 'spike') return eul(name) + ' 지난 7일 동안 ' + (t.ratio !== null && t.ratio !== undefined ? '평소의 ' + t.ratio.toFixed(1) + '배' : '평소보다 많이') + '(' + fmt(t.s7) + '크레딧) 썼습니다.';
  if (t.type === 'pace') return '최근 3일 동안 ' + (t.many ? '바로 쓸 계정 ' + t.live + '개가 ' : '') + '하루 평균 주간 한도의 ' + t.rate + '%씩 썼습니다.';
  if (t.type === 'pass') {
    const whose = t.many && t.name ? t.name + ' 계정의 ' : '';
    if (t.mode === 'now') return whose + '초기화권을 쓰면 ' + (t.release ? '하루 넘게 기다리지 않고 ' : '') + '바로 다시 찹니다.';
    return (whose || name + ' ') + '초기화권 ' + t.count + '장이 ' + tipWhen(t.until, now) + '에 만료됩니다.' + (t.hint ? passHint(t.hint, now) : '');
  }
  if (t.type === 'size') {
    const from = planName(t.plan, 'claude'), to = planName(t.rule?.to, 'claude');
    return (t.name || name) + ' 계정(' + from + ')은 4주 내내 주간 한도를 ' + t.rule.limit + '%도 쓰지 않았습니다. ' + to + '로 낮춰도 넉넉할 가능성이 큽니다.' + (t.saving ? ' 공식 요금으로 한 달 ' + money(Math.round(t.saving * 100) / 100, t.table?.currency || 'USD') + ' 덜 냅니다.' : '');
  }
  if (t.type === 'idle') {
    const price = t.price ? '(' + money(t.price.amount, t.price.currency) + ')' : '';
    const head = (t.name || name) + (t.service === 'typecast' ? ' 키는' : ' 계정은') + ' 4주 동안 ' + (t.credit ? '크레딧을 쓰지 않았습니다.' : '주간 한도를 5%도 쓰지 않았습니다.');
    return head + (t.days === 0 ? ' 오늘이 결제일' + price + '입니다. 다음 달에도 쓸지 정해 두면 좋습니다.' : ' ' + (t.days === 1 ? '내일' : md(t.billAt)) + ' 결제' + price + ' 전에 계속 쓸지 정해 두면 좋습니다.');
  }
  return '';
}
/* 팁에 반응한 뒤 그 줄에 남기는 글. 「도움 됐습니다」는 같은 팁을 7일 쉬고, 「이런 팁 그만」은 처음 4주, 두 번째부터 12주 쉰다(본체 ai-subscriptions.cjs) */
export function tipDoneWords(action, settings, key) {
  return action === 'stop' ? '이 종류의 팁은 ' + restWeeks(settings, key) + '주 동안 쉽니다.' : '도움이 됐다고 남겼습니다. 같은 팁은 7일 동안 쉽니다.';
}
/* st: { tipDone(팁 열쇠 → 반응), notes, busy }. 이 화면에서 방금 반응한 팁은 쉬는 동안에도 그 줄에 남겨 반응 뒤의 한 줄을 보인다 */
export function subTips(snapshot, st = {}, now = Date.now()) {
  const out = new Map();
  if (!snapshot?.usage || snapshot.settings?.tipsOff === true) return out;
  const groups = serviceGroups(snapshot.rows || [], now, snapshot.check?.at || null).filter(g => g.service && g.accounts.some(a => !a.away));
  const answered = Object.fromEntries([...(st.tipDone || new Map())].map(([k]) => [k, true]));
  const { tips } = pickUsageTips(snapshot, groups, now, answered);
  for (const [service, t] of tips) {
    const text = tipWords(t, now);
    if (!text) continue;
    const key = 'svc:' + service;
    out.set(service, { key: t.key, text, done: st.tipDone?.has?.(t.key) === true, live: st.notes?.get?.(key) || '', busy: st.busy === key + ':tip' });
  }
  return out;
}

/* ── 설정 방(설계 6절, 설계 검토 D6 · D7 · D9 · D10). 업데이트 갈래는 update-view.mjs의 규칙을 고치지 않고 옮겨 적었다(자동 설치 판정 포함) ── */
const UPDATE_STATES = new Set(['disabled', 'idle', 'checking', 'current', 'available', 'downloading', 'ready', 'opening', 'error']);
const verOf = v => (typeof v === 'string' && /^[0-9][0-9A-Za-z.+-]{0,47}$/.test(v) ? v : null);
export const updateAuto = (u, platform) => u?.automatic === true && platform === 'win32' && u.code !== 'UPDATE_EXIT_CANCELLED';
/* 본체가 주는 업데이트 판. { state }이거나 { status: { state } }다. 모르는 꼴이면 null */
export const updateOf = value => { const next = value?.state ? value : value?.status; return next && UPDATE_STATES.has(next.state) ? { ...next } : null; };
/* 줄 안쪽 문장. 판 번호는 괄호로 붙여 받침에 따라 갈리는 조사를 피한다. 새 판에서 구가 깎이는 장면은 아직 없어 말하지 않는다(설계 검토 D10) */
export function updateWords(u, platform) {
  const latest = verOf(u?.latestVersion), ver = latest ? '(v' + latest + ')' : '', auto = updateAuto(u, platform);
  switch (u?.state) {
    case 'disabled': return '여기서는 새 판을 받을 수 없습니다. 지금 앱은 그대로 쓸 수 있습니다.';
    case 'checking': return '새 판이 있는지 보고 있습니다.';
    case 'current': return '최신 판입니다. 쓰는 동안에도 새 판이 있는지 저절로 확인합니다.';
    case 'available': return '새 판' + ver + '이 나왔습니다. 받는 동안에도 지금 앱을 쓸 수 있습니다.';
    case 'downloading': return auto ? '새 판' + ver + '을 받고 있습니다. 다 받으면 바꾼 뒤 다시 엽니다. 받는 동안에도 지금 앱을 쓸 수 있습니다.' : '새 판' + ver + ' 설치 파일을 받고 있습니다. 받는 동안에도 지금 앱을 쓸 수 있습니다.';
    case 'ready':
      if (u.code === 'UPDATE_EXIT_CANCELLED') return '앱 끄기를 취소했습니다. 쓰던 글을 저장한 뒤 다시 설치해 주세요.';
      if (auto) return '새 판' + ver + '이 준비됐습니다. 쓰던 글이 있는지 확인한 뒤 바꾸고 다시 엽니다.';
      if (platform === 'darwin') return u.code === 'UPDATE_MANUAL_INSTALL' ? '설치 파일을 열었습니다. 쓰던 글을 저장하고 SYNK Platform을 끈 뒤, 열린 창의 앱을 Applications 폴더로 옮겨 주세요.' : '새 판' + ver + ' 설치 파일이 준비됐습니다. 파일을 연 뒤 쓰던 글을 저장하고 SYNK Platform을 꺼 주세요. 열린 창의 앱을 Applications 폴더로 옮기면 설치됩니다.';
      return '새 판' + ver + ' 설치 파일이 준비됐습니다. 쓰던 글을 저장한 뒤 진행해 주세요. 앱을 끄고 설치 파일을 엽니다.';
    case 'opening': return auto ? '업데이트를 준비하고 있습니다. 앱이 꺼지면 설치하고, 끝나면 다시 열립니다.' : '설치를 준비하고 있습니다. 앱이 꺼지면 열린 설치 파일에서 이어서 진행해 주세요.';
    case 'error': {
      const code = typeof u.code === 'string' ? u.code : '';
      if (code === 'UPDATE_STORAGE_FAILED') return '설치 파일을 저장하지 못했습니다. PC 저장 공간을 비운 뒤 다시 받아 주세요. 지금 앱은 그대로 쓸 수 있습니다.';
      if (/SAME_VERSION|BUILD_MISMATCH|VERSION_CONFLICT/.test(code)) return '지금 판과 올라온 설치 파일이 맞지 않습니다. synk.im에서 최신 설치 파일을 받아 다시 설치해 주세요. 지금 앱은 그대로 쓸 수 있습니다.';
      if (/HASH|INTEGRITY|SIGNATURE|SIZE_MISMATCH|MANIFEST|UNTRUSTED|DOWNGRADE|INVALID_(RELEASE|ARTIFACT|CACHE|RESPONSE)/.test(code)) return '받은 업데이트 파일이 온전하지 않습니다. 「지금 확인」을 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있습니다.';
      if (/OPEN|INSTALL/.test(code)) return '설치 파일을 열지 못했습니다. 「지금 확인」을 누른 뒤 「' + (platform === 'darwin' ? '설치 파일 열기' : '앱 끄고 설치 파일 열기') + '」를 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있습니다.';
      return '새 판을 받지 못했습니다. 인터넷 연결을 확인한 뒤 「지금 확인」을 다시 눌러 주세요. 지금 앱은 그대로 쓸 수 있습니다.';
    }
    default: return platform === 'darwin' ? '켤 때와 쓰는 동안 새 판을 저절로 확인하고 받습니다. 받은 설치 파일을 열어 업데이트해 주세요.' : '켤 때와 쓰는 동안 새 판을 저절로 확인합니다. 새 판이 있으면 받아서 바꾼 뒤 다시 엽니다.';
  }
}
/* 맨 위 문장(설계 6.3 표) */
export function updateSay(u) {
  const latest = verOf(u?.latestVersion);
  return ({
    current: '이 PC의 SYNK는 최신 판입니다.', idle: '이 PC의 SYNK는 쓰는 동안 새 판을 저절로 확인합니다.', checking: '새 판이 있는지 보고 있습니다.',
    available: latest ? '새 판(v' + latest + ')이 나왔습니다.' : '새 판이 나왔습니다.', downloading: '새 판을 받고 있습니다.', ready: '새 판이 준비됐습니다.',
    opening: '업데이트를 준비하고 있습니다.', error: '새 판을 받지 못했습니다.',
  })[u?.state] || '여기서는 새 판을 받을 수 없습니다.';
}
const UPDATE_MID = Object.freeze({
  current: '쓰는 동안에도 새 판이 있는지 저절로 확인합니다', idle: '쓰는 동안에도 새 판이 있는지 저절로 확인합니다', checking: '새 판이 있는지 보고 있습니다', available: '새 판이 나왔습니다',
  downloading: '새 판을 받고 있습니다', ready: '새 판이 준비됐습니다', opening: '업데이트를 준비하고 있습니다', error: '새 판을 받지 못했습니다', disabled: '여기서는 새 판을 받을 수 없습니다',
});
/* 단축키(본체 desktop-preferences.cjs validShortcut과 같은 꼴). 「ctrl + alt + s」처럼 넣어도 같은 모양으로 고쳐 읽는다 */
const SHORTCUT = /^(?:(?:CommandOrControl|Control|Ctrl|Alt|Shift|Super|Command)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/;
const SHORTCUT_MOD = /(?:CommandOrControl|Control|Ctrl|Alt|Super|Command)\+/;
const MOD_NAME = Object.freeze({ ctrl: 'Ctrl', control: 'Control', commandorcontrol: 'CommandOrControl', cmdorctrl: 'CommandOrControl', alt: 'Alt', shift: 'Shift', super: 'Super', command: 'Command', cmd: 'Command' });
export const SHORTCUT_SAY = Object.freeze({ empty: '단축키를 넣어 주세요.', shape: '단축키 모양을 알아보지 못했습니다. 예: Ctrl+Alt+S', taken: '다른 앱이 쓰는 단축키입니다. 다른 조합을 골라 주세요.' });
export function checkShortcut(value) {
  const raw = clean(value);
  if (!raw) return bad(SHORTCUT_SAY.empty);
  const parts = raw.split('+').map(p => p.trim());
  const last = parts.pop() || '';
  const key = /^space$/i.test(last) ? 'Space' : /^f\d{1,2}$/i.test(last) || last.length === 1 ? last.toUpperCase() : last;
  const text = [...parts.map(p => MOD_NAME[p.toLowerCase()] || p), key].join('+');
  return text.length <= 80 && SHORTCUT.test(text) && SHORTCUT_MOD.test(text) ? { ok: true, value: text } : bad(SHORTCUT_SAY.shape);
}
/* 데스크톱 설정을 바꾸지 못한 까닭 */
export function desktopSay(code, patch = {}) {
  if (code === 'SHORTCUT_UNAVAILABLE') return SHORTCUT_SAY.taken;
  if (code === 'INVALID_DESKTOP_PREFERENCES' && Object.hasOwn(patch || {}, 'globalShortcut')) return SHORTCUT_SAY.shape;
  return '설정을 적용하지 못했습니다. 잠시 뒤 다시 해 주세요.';
}
/* 조용한 시간의 시각(편의 convenience-state.mjs notificationPreferences와 같은 꼴 HH:MM) */
const quietTime = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(clean(v)); if (!m) return null; const h = Number(m[1]), mi = Number(m[2]); return h <= 23 && mi <= 59 ? pad(h) + ':' + pad(mi) : null; };
export function checkQuiet(fields = {}) {
  const start = quietTime(fields.quietStart), end = quietTime(fields.quietEnd);
  if (!start || !end) return bad('시각은 22:00처럼 넣어 주세요.');
  return { ok: true, value: { start, end, weekdays: fields.quietDays === 'weekdays' } };
}
export const ZOOMS = Object.freeze([0.8, 0.9, 1, 1.1, 1.25, 1.5]);
const pctOf = z => Math.round(z * 100) + '%';
const OS_NAME = Object.freeze({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' });
export const DIAG_SAY = Object.freeze({ ok: '버전과 연결 상태만 복사했습니다. 이름, 글, 파일 경로는 넣지 않았습니다.', no: '복사하지 못했습니다. 앱 창을 한 번 누른 뒤 다시 해 주세요.' });
export const DRAFT_SAY = '쓰던 글 되살리기를 바꾸지 못했습니다. 로그인 상태와 PC 저장 공간을 봐 주세요.';
/* 플레저 PC 알림(PC 0.5.0 설계 4.5 R7). 본체가 쓸 수 있고 로그인했다고 알려 줄 때만 켜고 끄기를 세운다 */
export const careOn = c => c?.ok === true && c.available === true && c.signedIn === true;
export const CARE_SAY = Object.freeze({ CARE_DATA_REQUIRED: '플레저에 저장한 일정이 아직 없어 켜지 못했습니다. synk.im/care에서 로그인하고 일정을 저장한 뒤 다시 켜 주세요.', AUTH_CHANGED: '그사이 계정이 바뀌어 바꾸지 않았습니다. 다시 눌러 주세요.', no: '플레저 PC 알림을 바꾸지 못했습니다. 로그인 상태와 인터넷 연결을 보고 다시 해 주세요.' });

/* s: { update(본체 판, 없으면 받을 수 없음), desktop(데스크톱 설정 판), drafts(쓰던 글 되살리기 상태), care(플레저 PC 알림 상태), notices(알림 설정), env(판 정보), member(회원으로 보이는가), tipsOff(구독 팁을 껐는가, 구독 자료가 없으면 null) }
   st: 방 상태(busy · notes · grps · roomNote · restChoice). 바꿀 수 없는 칸은 줄에서 뺀다(편의 79행과 같다) */
export function settingsRoom(s = {}, st = {}, now = Date.now()) {
  const env = s.env || {}, u = updateOf(s.update) || { state: 'disabled' };
  // 업데이트 상태를 아직 받지 못한 동안(다리는 있음)에는 「받을 수 없다」고 하지 않는다. 방을 열면 낭독기가 맨 위 문장을 먼저 읽는다(검수)
  const loading = s.loading === true && !s.update;
  const desk = s.desktop?.ok === true ? s.desktop : null, p = desk?.preferences || {}, cap = desk?.capabilities || {};
  const rows = [loading ? null : updateRow(u, env, st), startRow(p, cap, st), keyRow(desk, env, st), viewRow(desk, st), noticeRow(s, st, now), draftRow(s, st)].filter(Boolean);
  // 둘째 줄은 켜지는 방식이다(시안 세 갈래). 자동 시작을 바꿀 수 없는 판이면 비운다
  const then = cap.launchAtLogin ? (!p.launchAtLogin ? '컴퓨터를 켤 때 함께 켜지 않습니다.' : p.startHidden && cap.tray ? '컴퓨터를 켜면 창 없이 함께 켜집니다.' : '컴퓨터를 켜면 창과 함께 켜집니다.') : '';
  const version = verOf(u.currentVersion) || verOf(env.version);
  const foot = st.roomNote || ['SYNK Platform' + (version ? ' ' + version : ''), env.mode && env.mode !== 'release' ? '시험판' : '', OS_NAME[env.platform] || ''].filter(Boolean).join(' · ');
  return { say: loading ? '설정을 불러오고 있습니다.' : updateSay(u), then, rows, foot, act: ['문제 알리기용 정보 복사', 'diag-copy', st.busy === 'settings:diag-copy' ? 'off' : ''] };
}
function updateRow(u, env, st) {
  const platform = env.platform || '', state = u.state, auto = updateAuto(u, platform);
  const pending = typeof st.busy === 'string' && st.busy.startsWith('update:');
  const busy = pending || ['checking', 'downloading', 'opening'].includes(state) || (auto && state === 'ready');
  const latest = verOf(u.latestVersion), current = verOf(u.currentVersion) || verOf(env.version);
  const more = [['say', updateWords(u, platform)]], acts = [];
  if (state !== 'disabled') acts.push(['지금 확인', 'update-check', '', flags(busy && 'off')]);
  if (state === 'available') acts.push(['받기', 'update-download', '', flags(busy && 'off')]);
  if (state === 'ready' && !auto) acts.push([platform === 'darwin' ? '설치 파일 열기' : '앱 끄고 설치 파일 열기', 'update-install', '', flags(busy && 'off')]);
  if (acts.length) more.push(['acts', acts]);
  more.push(['live', st.notes?.get?.('update') || '']);
  const mid = UPDATE_MID[state] || UPDATE_MID.disabled;
  // 받는 중에는 값 칸에 받은 몫을 쓴다. 확인한 때는 본체 판에 없어 쓰지 않는다(설계 15절)
  const val = state === 'downloading' ? Math.round(Math.max(0, Math.min(100, Number(u.progress) || 0))) + '%' : current || '';
  const when = latest && ['available', 'downloading', 'ready', 'opening'].includes(state) ? '새 판 ' + latest : '';
  return { key: 'update', nm: '업데이트', mid, val, when, now: ['available', 'ready', 'error'].includes(state), label: rowLabel(['업데이트', mid, val, when]), more };
}
function startRow(p, cap, st) {
  const busy = st.busy === 'start:pref' ? 'off' : '', togs = [];
  if (cap.launchAtLogin) togs.push(['tog', '자동 시작', '컴퓨터를 켜면 SYNK도 함께 켭니다', p.launchAtLogin === true, 'pref', busy, 'launchAtLogin']);
  // 트레이로 시작은 자동 시작이 켜져 있을 때만 누를 수 있다
  if (cap.launchAtLogin && cap.tray) togs.push(['tog', '트레이로 시작', '자동으로 켤 때는 창을 띄우지 않고 작업 표시줄 오른쪽 끝의 작은 아이콘(트레이)으로만 둡니다' + (p.launchAtLogin ? '' : '. 자동 시작을 켜야 고를 수 있습니다'), p.startHidden === true, 'pref', flags(!p.launchAtLogin && 'off', busy), 'startHidden']);
  if (cap.tray) togs.push(['tog', '트레이에 남기기', '닫기 단추를 눌러도 끄지 않고 그 아이콘으로 둡니다', p.closeToTray === true, 'pref', busy, 'closeToTray']);
  if (!togs.length) return null;
  const mid = [cap.launchAtLogin ? (p.launchAtLogin ? '자동 시작' : '자동 시작 안 함') : '', cap.launchAtLogin && cap.tray && p.launchAtLogin && p.startHidden ? '트레이로 시작' : '', cap.tray ? (p.closeToTray ? '닫아도 트레이에 남음' : '닫으면 끔') : ''].filter(Boolean).join(' · ');
  return { key: 'start', nm: '켜고 닫을 때', mid, val: '', when: '', label: rowLabel(['켜고 닫을 때', mid]), more: [...togs, ['live', st.notes?.get?.('start') || '']] };
}
/* 어디서나 열기. 단축키는 창을 앞으로 띄운다(본체 main 278~282행). Windows가 아니면 줄을 뺀다(설계 검토 D9) */
function keyRow(desk, env, st) {
  if (desk?.capabilities?.globalShortcut !== true || (env.platform && env.platform !== 'win32')) return null;
  const key = String(desk.preferences?.globalShortcut || ''), off = act => (st.busy === 'key:' + act ? 'off' : '');
  const more = [['fld', '단축키', key, '예: Ctrl+Alt+S', 'shortcut', 'text'], ['acts', [['적용', 'shortcut-apply', '', flags('enter', off('shortcut-apply'))], ['끄기', 'shortcut-off', '', flags(!key && 'off', off('shortcut-off'))]]]];
  if (key && desk.warning === 'SHORTCUT_UNAVAILABLE') more.push(['note', '저장한 단축키를 다른 앱이 쓰고 있어 지금은 듣지 않습니다. 다른 조합을 골라 주세요.']);
  more.push(['note', '다른 앱이 쓰는 단축키면 적용하지 않고, 다른 조합을 고르라고 알립니다.'], ['live', st.notes?.get?.('key') || '']);
  const mid = key ? '어느 화면에서든 이 단축키로 SYNK 창을 앞으로 띄웁니다' : '단축키를 정하지 않았습니다';
  return { key: 'key', nm: '어디서나 열기', mid, val: key, when: '', unread: !key, label: rowLabel(['어디서나 열기', mid, key]), more };
}
/* 화면. 움직임 줄이기는 저장할 길이 없어 두지 않는다(설계 검토 D6) */
function viewRow(desk, st) {
  if (!desk) return null;
  const z = Number(desk.preferences?.zoomFactor) || 1, list = ZOOMS.includes(z) ? ZOOMS : [...ZOOMS, z].sort((a, b) => a - b);
  const mid = '크기 ' + pctOf(z);
  return { key: 'view', nm: '화면', mid, val: '', when: '', label: rowLabel(['화면', mid]), more: [['pick', '화면 크기', list.map(v => [pctOf(v), String(v)]), String(z), '', 'zoom'], ['note', 'Ctrl과 +, − 키로도 바꿀 수 있습니다.'], ['live', st.notes?.get?.('view') || '']] };
}
/* 알림. 배너는 앱 설치 파일이 준비됐거나 실패했을 때만 뜬다(편의 31행, 설계 검토 D10). 구독 팁 켜고 끄기도 이 줄 안쪽이다(설계 검토 16절 D7) */
function noticeRow(s, st, now) {
  const n = s.notices;
  if (!n || typeof n !== 'object') return null;
  const resting = Number(n.mutedUntil) > now, open = !!st.grps?.has?.('notice:quiet');
  const quietDesc = n.start === n.end ? (n.weekdays ? '평일에는 ' : '') + '하루 종일 배너를 띄우지 않습니다' : (n.weekdays ? '평일 ' : '매일 ') + n.start + '부터 ' + n.end + '까지는 배너를 띄우지 않습니다';
  const more = [
    ['tog', '알림 배너', '앱 설치 파일이 준비됐거나 실패했을 때 배너를 띄웁니다', n.banners === true, 'notice', '', 'banners'],
    ['tog', '조용한 시간', quietDesc, n.schedule === true, 'notice', '', 'schedule'],
    ['acts', [['시각 고치기', 'grp', 'quiet', open ? 'on' : '']]],
    ['grp', 'quiet', [
      ['fld', '시작', n.start || '', '', 'quietStart', 'time'],
      ['fld', '끝', n.end || '', '시작과 끝을 같게 하면 하루 종일 쉽니다', 'quietEnd', 'time'],
      ['pick', '요일', [['매일', ''], ['월요일부터 금요일만', 'weekdays']], n.weekdays ? 'weekdays' : '', 'quietDays'],
      ['acts', [['저장', 'quiet-save', '', 'enter'], ['닫기', 'grp', 'quiet']]],
    ], !open],
    ['pick', '잠시 쉬기', [['30분', '30'], ['1시간', '60'], ['쉬지 않음', '0']], resting ? st.restChoice || '' : '0', '', 'rest'],
  ];
  const care = careOn(s.care) && s.member === true ? s.care : null;
  if (care) {
    const at = String(care.hour ?? 9).padStart(2, '0') + ':' + String(care.minute ?? 0).padStart(2, '0'), cap = s.desktop?.capabilities || {}, p = s.desktop?.preferences || {};
    // 본체(main.cjs careNotifications.configure)는 켤 때 트레이에 남기기를 켜고, 자동 시작이 꺼져 있을 때만 자동 시작과 트레이로 시작을 함께 켠다.
    // 끌 때는 아무것도 되돌리지 않는다. 그래서 켜기 전 글은 지금 설정으로 고르고, 켠 뒤 글에는 남는 설정을 적는다(0.5.0 최종 검수 F4)
    // 트레이가 없는 PC(맥 등)에는 트레이 말을 하지 않는다(카본 A1)
    const boot = [cap.tray && '켜면 창을 닫아도 트레이에 남습니다', cap.launchAtLogin && p.launchAtLogin !== true && (cap.tray ? '자동 시작도 함께 켜져, 컴퓨터를 켤 때 창 없이 트레이로 켜집니다' : '켜면 자동 시작도 함께 켜져, 컴퓨터를 켤 때 SYNK도 켜집니다')].filter(Boolean).map(x => '. ' + x).join('');
    const kept = [cap.tray && '트레이', cap.launchAtLogin && '자동 시작'].filter(Boolean).join('와 ');
    const desc = care.enabled === true ? '매일 ' + at + '(한국 시간)에 플레저에 저장한 일정과 챙길 일을 PC 알림으로 알려 드립니다. PC를 끄거나 SYNK를 완전히 종료한 동안에는 받을 수 없습니다' + (kept ? '. 꺼도 「켜고 닫을 때」의 ' + kept + ' 설정은 그대로 둡니다' : '')
      : '매일 ' + at + '(한국 시간)에 플레저에 저장한 일정과 챙길 일을 알려 드립니다' + boot;
    more.push(['tog', '플레저 PC 알림', desc, care.enabled === true, 'care', st.busy === 'notice:care' ? 'off' : '']);
  }
  if (s.tipsOff === true || s.tipsOff === false) more.push(['tog', '구독 팁', '구독 줄과 요금 줄 안쪽에 아끼는 법과 막히지 않는 법을 한 줄씩 알려 드립니다', s.tipsOff === false, 'tips', st.busy === 'notice:tips' ? 'off' : '']);
  more.push(['live', st.notes?.get?.('notice') || '']);
  const mid = resting ? hm(n.mutedUntil) + '까지 배너를 띄우지 않습니다'
    : [n.banners ? '배너 켜짐' : '배너 꺼짐', n.schedule ? '조용한 시간 ' + (n.start === n.end ? '하루 종일' : n.start + '~' + n.end) : '', care?.enabled === true ? '플레저 PC 알림 켜짐' : '', s.tipsOff === true ? '구독 팁 꺼짐' : ''].filter(Boolean).join(' · ');
  return { key: 'notice', nm: '알림', mid, val: '', when: '', label: rowLabel(['알림', mid]), more };
}
/* 쓰던 글 되살리기. 로그인하지 않았거나 이 PC의 암호화 저장을 쓸 수 없으면 켜는 칸을 누를 수 없다(손님 포함) */
function draftRow(s, st) {
  const d = s.drafts;
  if (!d || typeof d !== 'object') return null;
  const can = d.ok === true && d.available === true && s.member === true, on = can && d.enabled === true;
  const mid = '창이 갑자기 닫혀도 쓰던 글을 7일 동안 되살립니다', val = on ? '켜짐' : '꺼짐';
  return { key: 'draft', nm: '쓰던 글 되살리기', mid, val, when: '', unread: !can, label: rowLabel(['쓰던 글 되살리기', mid, val]), more: [
    ['tog', '되살리기', can ? '이 PC에 암호화해 두고, 끄거나 로그아웃하면 지웁니다' : '로그인하고, 이 PC의 암호화 저장을 쓸 수 있을 때 켤 수 있습니다', on, 'draft', flags(!can && 'off', st.busy === 'draft:draft' && 'off')],
    ['live', st.notes?.get?.('draft') || ''],
  ] };
}
