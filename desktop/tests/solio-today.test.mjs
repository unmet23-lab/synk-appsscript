// 솔리오 첫 화면의 문장과 줄(PC 클라이언트 1단계, 1단계_구현설계.md 8절). 구독 스냅숏은 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solioToday, solioTodayNeedsReread, SOLIO_TODAY_NAMES, whenWords, shortWhen, readLine, joinNames, josa } from '../renderer/solio-today.mjs';

const D = 864e5, H = 3600e3;
const NOW = new Date(2026, 10, 16, 10, 0).getTime(); // 2026-11-16(월) 10:00
let serial = 0;
const row = extra => ({ id: 'r' + (++serial), service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'ok', email: 'member@example.com', price: null, currency: 'KRW', billDay: null, credits: null, creditsAt: null, lowAt: null, resetDay: null, resetHour: null, resetMinute: null, usedUpAt: null, note: '', live: null, ...extra });
const weekly = (service, used, resetsAt, extra = {}) => row({ service, label: service, plan: 'pro', live: { readAt: NOW - 5 * 60e3, weekly: { usedPercent: used, resetsAt } }, ...extra });
const snap = (rows, rates = {}, { checkAt = NOW - 5 * 60e3, checking = false, prices = null } = {}) => ({ ok: true, rows, check: { at: checkAt }, checking, usage: { accounts: Object.fromEntries(Object.entries(rates).map(([id, rate3]) => [id, { rate3 }])) }, prices });

test('the GPT row is named Codex from one table', () => {
  assert.equal(SOLIO_TODAY_NAMES.gpt, 'Codex');
  const a = weekly('gpt', 20, NOW + 3 * D);
  const out = solioToday({ snapshot: snap([a], { [a.id]: 5 }) }, NOW);
  assert.equal(out.rows[0].name, 'Codex');
});

test('a service that runs out before it comes back is said first, others are plenty only when known', () => {
  const codex = weekly('gpt', 88, NOW + 5 * D), claude = weekly('claude', 36, NOW + 3 * D), gemini = weekly('gemini', 12, NOW + 6 * D);
  const out = solioToday({ snapshot: snap([codex, claude, gemini], { [codex.id]: 10, [claude.id]: 5, [gemini.id]: 2 }) }, NOW);
  // Codex 12%를 하루 10%p씩 쓰면 1.2일 뒤(내일 오후)에 막히고 풀리는 것은 닷새 뒤다.
  assert.equal(out.say, 'Codex가 내일 오후에 바닥납니다.');
  assert.equal(out.then, 'Claude와 Gemini는 이번 주 내내 넉넉합니다.');
  const codexRow = out.rows.find(r => r.name === 'Codex');
  assert.equal(codexRow.urgent, true);
  assert.equal(codexRow.val, '12% 남음');
  assert.match(codexRow.when, /^토 10:00 초기화$/);
  assert.equal(out.rows.find(r => r.name === 'Claude').urgent, false);
});

test('a service with all accounts used up says when it opens again', () => {
  const used = weekly('gpt', 100, NOW + 2 * D + 4 * H), other = weekly('claude', 30, NOW + 3 * D);
  const out = solioToday({ snapshot: snap([used, other], { [other.id]: 5 }) }, NOW);
  assert.equal(out.say, 'Codex는 이번 주 한도를 다 썼습니다.');
  assert.equal(out.then, '모레 오후 2시에 다시 열립니다.');
  const r = out.rows.find(x => x.name === 'Codex');
  assert.deepEqual([r.val, r.urgent], ['다 씀', true]);
});

test('everything plenty with known pace names the first reset', () => {
  const a = weekly('claude', 20, NOW + 3 * D), b = weekly('gemini', 10, NOW + D + 2 * H);
  const out = solioToday({ snapshot: snap([a, b], { [a.id]: 3, [b.id]: 1 }) }, NOW);
  assert.equal(out.say, '이번 주는 모든 구독이 넉넉합니다.');
  assert.equal(out.then, '가장 먼저 Gemini가 내일 오후 12시에 초기화됩니다.');
});

test('without three days of history it does not call a service plenty', () => {
  const a = weekly('claude', 20, NOW + 3 * D), b = weekly('gpt', 30, NOW + 4 * D);
  const none = solioToday({ snapshot: snap([a, b], {}) }, NOW);
  assert.equal(none.say, '쓰는 속도를 셀 만큼 기록이 아직 쌓이지 않았습니다.');
  assert.equal(none.then, 'Claude와 Codex는 사흘쯤 쓰면 언제 바닥날지 미리 알려 드립니다.');
  const some = solioToday({ snapshot: snap([a, b], { [a.id]: 2 }) }, NOW);
  assert.equal(some.say, '이번 주는 Claude가 넉넉합니다.');
  assert.equal(some.then, 'Codex는 사흘쯤 쓰면 언제 바닥날지 미리 알려 드립니다.');
});

test('a weekly service at ten percent or less is bright by the model rule', () => {
  const a = weekly('claude', 93, NOW + 3 * D);
  const out = solioToday({ snapshot: snap([a], {}) }, NOW);
  assert.equal(out.say, 'Claude는 7%만 남았습니다.');
  assert.equal(out.rows[0].urgent, true);
});

test('a low credit service and its bill day', () => {
  const credit = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'plus', billDay: 3, live: { readAt: NOW, credits: 1 } });
  const out = solioToday({ snapshot: snap([credit]) }, NOW);
  assert.equal(out.say, 'Higgsfield 크레딧이 얼마 남지 않았습니다.');
  assert.equal(out.then, '12월 3일에 다시 찹니다.');
  assert.equal(out.rows[0].val, '1 크레딧');
  assert.equal(out.rows[0].when, '12월 3일 결제');
});

test('credit rows show a percent only when the month allotment is known', () => {
  const credit = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'plus', live: { readAt: NOW, credits: 1240, planCredits: 3000 } });
  const r = solioToday({ snapshot: snap([credit]) }, NOW).rows[0];
  assert.deepEqual([r.val, r.gauge, r.when], ['41% 남음', 41, '1,240 / 3,000 크레딧']);
});

test('several accounts of one service show the count and the account to use now', () => {
  const a = weekly('claude', 80, NOW + 3 * D), b = weekly('claude', 30, NOW + 4 * D);
  const r = solioToday({ snapshot: snap([a, b], { [a.id]: 1, [b.id]: 1 }) }, NOW).rows[0];
  assert.deepEqual([r.name, r.sub, r.val], ['Claude', '계정 2개', '70% 남음']);
  assert.match(r.label, /^Claude, 계정 2개, 70% 남음, .+ 초기화\. 자세한 내용은 이 줄 아래에 펼쳐집니다\.$/);
});

test('no subscriptions, guest, preview and read errors', () => {
  assert.deepEqual([solioToday({ snapshot: snap([]) }, NOW).say, solioToday({ snapshot: snap([]) }, NOW).action], ['아직 연결한 AI 구독이 없습니다.', 'connect']);
  assert.equal(solioToday({ signedIn: false, error: 'SIGN_IN_REQUIRED' }, NOW).say, '로그인하면 구독별 남은 양이 여기에 보입니다.');
  // 회원으로 보이는 동안의 거절과 기다림은 손님 문장이 아니다(Fable 다시 검수 -c)
  const w = solioToday({ error: 'SIGN_IN_REQUIRED' }, NOW);
  assert.deepEqual([w.state, w.say, w.then, w.action], ['waiting', '계정 연결을 확인하지 못했습니다.', '연결되면 구독별 남은 양을 읽습니다.', 'recheck-auth']);
  const c = solioToday({ waiting: 'error', authChecking: true }, NOW);
  // 확인하는 동안에도 단추를 숨기지 않고 누를 수 없게만 둔다(다시 검수 -d)
  assert.deepEqual([c.state, c.say, c.then, c.action, c.checking], ['waiting', '계정 연결을 다시 확인하고 있습니다.', '', 'recheck-auth', true]);
  // 토큰을 갱신하는 동안은 거절이 남아 있어도 조용히 기다린다
  assert.deepEqual([solioToday({ waiting: 'pending', error: 'SIGN_IN_REQUIRED' }, NOW).state, solioToday({ waiting: 'pending', error: 'SIGN_IN_REQUIRED' }, NOW).say], ['loading', '']);
  assert.equal(solioToday({ waiting: 'error' }, NOW).state, 'waiting');
  assert.deepEqual([solioToday({ waiting: 'pending' }, NOW).state, solioToday({ waiting: 'pending' }, NOW).say], ['loading', '']);
  assert.equal(solioToday({ waiting: 'error', snapshot: snap([]) }, NOW).say, '아직 연결한 AI 구독이 없습니다.');
  assert.equal(solioToday({ signedIn: false }, NOW).state, 'guest');
  assert.equal(solioToday({ native: false }, NOW).say, '구독 자료는 PC 앱에서 읽습니다.');
  const e = solioToday({ error: 'BOARD_BUSY' }, NOW);
  assert.deepEqual([e.say, e.then], ['구독 자료를 읽지 못했습니다.', '잠시 뒤 「다시 읽기」를 눌러 주세요.']);
  assert.equal(solioToday({ snapshot: null }, NOW).state, 'loading');
});

test('values older than six hours do not predict, and say so only when the reread failed', () => {
  const a = weekly('gpt', 88, NOW + 5 * D);
  const old = snap([a], { [a.id]: 10 }, { checkAt: NOW - 7 * H });
  assert.equal(solioToday({ snapshot: { ...old, checking: true } }, NOW).say, '구독별 남은 양을 다시 읽고 있습니다.');
  const failed = solioToday({ snapshot: old, rereadFailed: true }, NOW);
  assert.equal(failed.say, '마지막으로 읽은 지 6시간이 넘었습니다.');
  assert.equal(failed.dim, true);
  assert.equal(solioToday({ snapshot: snap([a], { [a.id]: 10 }, { checkAt: NOW - 5 * H }) }, NOW).say, 'Codex가 내일 오후에 바닥납니다.');
});

test('rereads once on entry when values are an hour old, never read, or a reset has passed', () => {
  const a = weekly('claude', 20, NOW + 3 * D);
  assert.equal(solioTodayNeedsReread(snap([a], {}, { checkAt: NOW - 10 * 60e3 }), NOW), false);
  assert.equal(solioTodayNeedsReread(snap([a], {}, { checkAt: NOW - 61 * 60e3 }), NOW), true);
  assert.equal(solioTodayNeedsReread(snap([a], {}, { checkAt: null }), NOW), true);
  const passed = row({ live: { readAt: NOW - 3 * H, weekly: { usedPercent: 60, resetsAt: NOW - H } } });
  assert.equal(solioTodayNeedsReread(snap([passed], {}, { checkAt: NOW - 10 * 60e3 }), NOW), true);
  assert.equal(solioTodayNeedsReread(snap([]), NOW), false);
});

test('time words in sentences, rows and the read line', () => {
  assert.equal(whenWords(NOW + 20 * 60e3, NOW), '20분 뒤');
  assert.equal(whenWords(NOW + 5 * H, NOW), '오늘 오후');
  assert.equal(whenWords(NOW + 14 * H, NOW), '내일 새벽');
  assert.equal(whenWords(NOW + 5 * D + 4 * H, NOW, { withTime: true }), '토요일 오후 2시');
  assert.equal(whenWords(NOW + 2.5 * H, NOW, { withTime: true }), '오늘 오후 12시 30분');
  assert.equal(whenWords(NOW + 14 * H, NOW, { withTime: true }), '내일 새벽 0시');
  assert.equal(whenWords(NOW + 20 * D, NOW), '12월 6일');
  // 이미 지난 때는 「1분 뒤」가 아니고, 1시간 안은 59분을 넘기지 않는다(0.4.95 원천 후보 카본)
  assert.equal(whenWords(NOW - 5 * 60e3, NOW), '오늘 오전');
  assert.equal(whenWords(NOW + 59.8 * 60e3, NOW), '59분 뒤');
  // 자정을 넘기면 「내일」이 「오늘」이 된다
  const late = new Date(2026, 10, 16, 23, 30).getTime();
  assert.equal(whenWords(late + 10 * H, late), '내일 오전');
  assert.equal(whenWords(late + 10 * H, late + H), '오늘 오전');
  assert.equal(shortWhen(NOW + 3 * D - H, NOW), '목 09:00');
  assert.equal(shortWhen(NOW + 10 * D, NOW), '11월 26일');
  assert.deepEqual([readLine(NOW - 60e3, NOW, false), readLine(NOW - 30 * 60e3, NOW, false), readLine(NOW - 3 * H, NOW, false), readLine(NOW, NOW, true)], ['방금 읽은 값입니다.', '30분 전에 읽은 값입니다.', '3시간 전에 읽은 값입니다.', '다시 읽고 있습니다.']);
});

test('names are joined and particles follow the last name', () => {
  assert.equal(joinNames(['Claude']), 'Claude');
  assert.equal(joinNames(['Claude', 'Gemini']), 'Claude와 Gemini');
  assert.equal(joinNames(['Claude', 'Gemini', 'Higgsfield']), 'Claude, Gemini와 Higgsfield');
  assert.equal(josa('구독', ['은', '는']), '구독은');
  assert.equal(josa('Codex', ['이', '가']), 'Codex가');
});

test('「모든 구독이 넉넉합니다」 only when every service is known to be plenty (carbon B2)', () => {
  const claude = weekly('claude', 20, NOW + 3 * D);
  // Codex는 다시 로그인해야 한다: 넉넉한 것은 Claude뿐이고, Codex는 확인하라고 한다
  const codex = row({ service: 'gpt', label: 'gpt', plan: 'pro', state: 'needs-login', live: null });
  const withLogin = solioToday({ snapshot: snap([claude, codex], { [claude.id]: 3 }) }, NOW);
  assert.equal(withLogin.say, '이번 주는 Claude가 넉넉합니다.');
  assert.equal(withLogin.then, 'Codex는 계정 관리에서 확인해 주세요.');
  // 크레딧형이 함께 있으면 「모든」이라 하지 않는다(넉넉하다고 말할 근거는 주간 한도형의 속도뿐이다)
  const credit = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'plus', billDay: 3, live: { readAt: NOW, credits: 1240, planCredits: 3000 } });
  const withCredit = solioToday({ snapshot: snap([claude, credit], { [claude.id]: 3 }) }, NOW);
  assert.equal(withCredit.say, '이번 주는 Claude가 넉넉합니다.');
  // 다시 로그인할 구독뿐이면 확인 안내다
  const onlyLogin = solioToday({ snapshot: snap([codex]) }, NOW);
  assert.equal(onlyLogin.state, 'check');
});

test('only healthy credit services or only manual records still get a calm first line (carbon B1)', () => {
  const credit = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'plus', billDay: 3, live: { readAt: NOW, credits: 1240, planCredits: 3000 } });
  const onlyCredit = solioToday({ snapshot: snap([credit]) }, NOW);
  assert.equal(onlyCredit.state, 'ready');
  assert.equal(onlyCredit.say, 'Higgsfield 크레딧이 41% 남았습니다.');
  assert.equal(onlyCredit.then, '12월 3일에 다시 찹니다.');
  const manual = row({ service: null, source: 'manual', label: '내 구독', state: 'unknown', resetDay: 4, resetHour: 9, live: null });
  const onlyManual = solioToday({ snapshot: snap([manual]) }, NOW);
  assert.equal(onlyManual.state, 'ready');
  assert.equal(onlyManual.say, '직접 넣은 구독은 남은 양을 읽지 않습니다.');
});

test('Fable final: refilled or unread rows, a 5-hour limit, stale credit balances, manual-only and partial trouble', () => {
  const H = 3600e3;
  // 다시 찼을 것뿐: 확인 안내가 아니라 다시 읽으라고 말한다
  const refilled = row({ live: { readAt: NOW - 3 * H, session: { usedPercent: 40, resetsAt: NOW - H }, weekly: { usedPercent: 40, resetsAt: NOW + 3 * D } } });
  const r1 = solioToday({ snapshot: snap([refilled], {}, { checkAt: NOW - 3 * H }) }, NOW);
  assert.equal(r1.state, 'projected');
  assert.equal(r1.say, '초기화 시각이 지나 남은 양이 다시 찼을 수 있습니다.');
  // 읽기 전뿐
  const unread = row({ live: null });
  assert.equal(solioToday({ snapshot: snap([unread]) }, NOW).say, '아직 남은 양을 읽지 않은 구독이 있습니다.');
  // 5시간 창만 바닥이면 「5시간 한도」
  const fiveHour = row({ live: { readAt: NOW - 60e3, session: { usedPercent: 100, resetsAt: NOW + 2 * H }, weekly: { usedPercent: 40, resetsAt: NOW + 3 * D } } });
  const r3 = solioToday({ snapshot: snap([fiveHour]) }, NOW);
  assert.equal(r3.say, 'Claude는 5시간 한도를 다 썼습니다.');
  assert.equal(r3.then, '오늘 오후 12시에 다시 열립니다.');
  // 다시 로그인해야 하는 크레딧형은 옛 잔액을 정상처럼 보이지 않는다
  const staleCredit = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'plus', billDay: 3, state: 'needs-login', live: { readAt: NOW - 2 * D, credits: 1240, planCredits: 3000 } });
  const r4 = solioToday({ snapshot: snap([staleCredit]) }, NOW);
  assert.equal(r4.state, 'check');
  assert.deepEqual([r4.rows[0].val, r4.rows[0].when], ['다시 로그인', '계정 관리에서 다시 로그인합니다']);
  // 직접 넣은 구독뿐이면 읽은 적이 없거나 오래돼도 같은 문장이고, 다시 읽기 단추와 읽은 때 줄이 없다
  const manual = row({ service: null, source: 'manual', label: '내 구독', state: 'unknown', resetDay: 4, resetHour: 9, live: null });
  for (const checkAt of [null, NOW - 7 * H]) {
    const r = solioToday({ snapshot: snap([manual], {}, { checkAt }) }, NOW);
    assert.deepEqual([r.state, r.say, r.read, r.action], ['ready', '직접 넣은 구독은 남은 양을 읽지 않습니다.', '', null]);
  }
  // 6시간이 넘었어도 다시 읽기가 실패하지 않았으면 「새로 읽지 못했습니다」라고 하지 않는다
  const old = weekly('claude', 20, NOW + 3 * D, { live: { readAt: NOW - 7 * H, weekly: { usedPercent: 20, resetsAt: NOW + 3 * D } } });
  assert.equal(solioToday({ snapshot: snap([old], {}, { checkAt: NOW - 7 * H }) }, NOW).then, '「다시 읽기」를 누르면 지금 남은 양을 읽습니다.');
  assert.match(solioToday({ snapshot: snap([old], {}, { checkAt: NOW - 7 * H }), rereadFailed: true }, NOW).then, /새로 읽지 못했습니다/);
  // 같은 서비스 계정 둘 가운데 하나만 다시 로그인: 「모든」이라 하지 않고 그 계정을 알린다
  const good = weekly('claude', 20, NOW + 3 * D), login = row({ state: 'needs-login', live: null });
  const r7 = solioToday({ snapshot: snap([good, login], { [good.id]: 3 }) }, NOW);
  assert.equal(r7.say, '이번 주는 Claude가 넉넉합니다.');
  assert.equal(r7.then, 'Claude 계정 1개는 계정 관리에서 확인해 주세요.');
  // 확인할 구독이 둘 이상이어도 일부만 확인할 구독은 몇 개인지 적어 첫 줄과 어긋나지 않는다(0.4.95 원천 후보 카본)
  const codexLogin = row({ id: 'r-codex-login', service: 'gpt', label: 'Codex', state: 'needs-login', live: null });
  const r8 = solioToday({ snapshot: snap([good, login, codexLogin], { [good.id]: 3 }) }, NOW);
  assert.equal(r8.say, '이번 주는 Claude가 넉넉합니다.');
  assert.equal(r8.then, 'Claude 계정 1개와 Codex는 계정 관리에서 확인해 주세요.');
  // 읽기 전 크레딧형이 함께 있으면 「모든」이라 하지 않는다
  const unreadCredit = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'plus', state: 'unknown', live: null });
  assert.equal(solioToday({ snapshot: snap([good, unreadCredit], { [good.id]: 3 }) }, NOW).say, '이번 주는 Claude가 넉넉합니다.');
});

test('one account refilled by a passed reset does not make a known service sound new (0.4.95 carbon E1)', () => {
  // 같은 Claude의 두 계정: 하나는 사흘 기록이 있고 넉넉하다. 다른 하나는 초기화 시각이 지나 다시 찼을 것이다
  const good = weekly('claude', 20, NOW + 3 * D);
  const refilled = row({ live: { readAt: NOW - 3 * H, session: { usedPercent: 40, resetsAt: NOW - H }, weekly: { usedPercent: 40, resetsAt: NOW + 3 * D } } });
  const out = solioToday({ snapshot: snap([good, refilled], { [good.id]: 3 }) }, NOW);
  assert.doesNotMatch(out.say + ' ' + out.then, /사흘쯤 쓰면/, 'not 「기록이 쌓이면 알려 드립니다」');
  assert.equal(out.say, '이번 주는 Claude가 넉넉합니다.');
  assert.doesNotMatch(out.say, /모든 구독/, 'a refilled account still keeps it out of 「모든 구독」');
});

test('the read line says reading for the first time when nothing was read yet (0.4.95 carbon E2)', () => {
  assert.equal(readLine(null, NOW, true), '처음 읽고 있습니다.');
  assert.equal(readLine(NOW - 60e3, NOW, true), '다시 읽고 있습니다.');
});

test('bill days are counted on the calendar, also across a daylight saving change (0.4.95 carbon E5)', async () => {
  const { execFileSync } = await import('node:child_process');
  const mod = new URL('../renderer/solio-today.mjs', import.meta.url).href;
  // 미국 동부는 2026-11-01 02:00에 서머타임이 끝난다(그날은 25시간). 10-31 10:00에서 이틀 뒤 결제일은 11월 2일이다
  const code = `process.env.TZ = 'America/New_York';
const { solioToday } = await import(${JSON.stringify(mod)});
const now = new Date(2026, 9, 31, 10, 0).getTime();
const row = { id: 'c', service: 'higgsfield', source: 'auto', label: 'Higgsfield', kind: 'credit', plan: 'plus', state: 'ok', billDay: 2, live: { readAt: now, credits: 1240 } };
const out = solioToday({ snapshot: { ok: true, rows: [row], check: { at: now }, usage: { accounts: {} } } }, now);
process.stdout.write(out.rows[0].when);`;
  const when = execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(when, '11월 2일 결제');
});

test('a time already past is said as a date, not a weekday that reads as coming (0.4.95 re-review FA2)', () => {
  const now = new Date(2026, 10, 16, 0, 30).getTime(); // 11-16(월) 00:30
  assert.equal(whenWords(now - H, now, { withTime: true }), '11월 15일 밤 11시 30분');
  assert.equal(whenWords(now - 3 * D, now), '11월 13일 새벽');
  assert.equal(whenWords(now + 2 * H, now, { withTime: true }), '오늘 새벽 2시 30분');
});

/* ── 줄 안쪽(2단계 첫 조각, 2단계_첫조각_구현설계.md 2.2절). 자료가 없는 줄은 빠진다 ── */
const PRICES = { services: {
  claude: { checked: '2026-11-10', currency: 'USD', krVat: 0.1, plans: { pro: { month: 20 }, max5x: { month: 100 } } },
  gemini: { checked: '2026-11-10', currency: 'KRW', plans: { family: { month: 0 }, plus: { month: 7500 } } },
} };
const moreOf = (rows, opts = {}, input = {}) => solioToday({ snapshot: { ...snap(rows, opts.rates || {}, { prices: opts.prices || null }), ...(opts.usage ? { usage: opts.usage } : {}), ...(opts.settings ? { settings: opts.settings } : {}) }, ...input }, NOW).rows;

test('row inside: the weekly conclusion follows the same branches as the first sentence', () => {
  const codex = weekly('gpt', 88, NOW + 5 * D), claude = weekly('claude', 20, NOW + 3 * D);
  const rows = moreOf([codex, claude], { rates: { [codex.id]: 10, [claude.id]: 3 } });
  assert.equal(rows.find(r => r.name === 'Codex').more.say, 'Codex가 내일 오후에 바닥납니다. 토요일 오전 10시에 다시 찹니다.');
  assert.match(rows.find(r => r.name === 'Claude').more.say, /^Claude는 이번 주 내내 넉넉합니다\. .+에 초기화됩니다\.$/);
  const young = moreOf([weekly('claude', 20, NOW + 3 * D)])[0].more;
  assert.equal(young.say, 'Claude는 사흘쯤 쓰면 언제 바닥날지 미리 알려 드립니다.');
  const out = moreOf([weekly('gpt', 100, NOW + 2 * D + 4 * H)])[0].more;
  assert.equal(out.say, 'Codex는 이번 주 한도를 다 썼습니다. 모레 오후 2시에 다시 열립니다.');
});

test('row inside: accounts this PC cannot read now are left out, and trouble accounts are said first', () => {
  const good = weekly('gemini', 30, NOW + 3 * D, { email: 'work@example.com' });
  const login = weekly('gemini', 0, NOW + 3 * D, { email: 'home@example.com', state: 'needs-login' });
  const err = weekly('gemini', 0, NOW + 3 * D, { email: 'lab@example.com', state: 'error' });
  const away = weekly('gemini', 10, NOW + 3 * D, { email: 'away@example.com', state: 'elsewhere' });
  const m = moreOf([good, login, err, away], { rates: { [good.id]: 2 } })[0].more;
  assert.deepEqual(m.fix, ['home 계정은 다시 로그인해야 합니다.', 'lab 계정은 읽지 못했습니다.']);
  assert.deepEqual(m.accounts.map(a => a.name), ['work', 'home', 'lab'], 'away account is not shown');
  assert.deepEqual(m.accounts.map(a => a.val), ['70% 남음', '다시 로그인해야 합니다', '읽지 못했습니다']);
  assert.ok(m.accounts.every(a => !/지금 쓰는/.test(a.tag)));
});

test('row inside: one account here means no per-account list; a refilled account says to read again', () => {
  const one = moreOf([weekly('claude', 20, NOW + 3 * D)])[0].more;
  assert.equal(one.accounts, null);
  const a = weekly('claude', 90, NOW - H, { email: 'a@example.com', live: { readAt: NOW - 3 * H, weekly: { usedPercent: 90, resetsAt: NOW - H } } });
  const b = weekly('claude', 20, NOW + 3 * D, { email: 'b@example.com' });
  const m = moreOf([a, b], { rates: { [b.id]: 2 } })[0].more;
  const line = m.accounts.find(x => x.name === 'a');
  assert.deepEqual([line.val, line.when], ['다시 찼을 것', '다시 읽으면 확인됩니다']);
});

test('row inside: the account to use first is tagged in plain words', () => {
  const soon = weekly('claude', 40, NOW + 10 * H, { email: 'soon@example.com' }), later = weekly('claude', 30, NOW + 5 * D, { email: 'later@example.com' });
  const m = moreOf([soon, later], { rates: { [soon.id]: 2, [later.id]: 2 } })[0].more;
  assert.equal(m.accounts.find(x => x.name === 'soon').tag, '먼저 쓸 계정');
  assert.equal(m.accounts.find(x => x.name === 'later').tag, '');
});

test('row inside: the last seven days come from the usage record and are left out without one', () => {
  const a = weekly('claude', 20, NOW + 3 * D);
  const days = [null, { v: 10 }, { v: 20 }, { v: 0 }, { v: 14 }, { v: 12 }, { v: 5 }];
  const usage = avg => ({ accounts: { [a.id]: { rate3: 3 } }, services: { claude: { kind: 'pct', days, dayAvg: avg } } });
  const m = moreOf([a], { rates: { [a.id]: 3 }, usage: usage(13.6) })[0].more;
  assert.equal(m.week.bars.length, 7);
  assert.equal(m.week.bars[0], null);
  assert.equal(m.week.avg, '하루 평균 14%');
  assert.equal(moreOf([a], { rates: { [a.id]: 3 } })[0].more.week, null);
  assert.equal(moreOf([a], { rates: { [a.id]: 3 }, usage: usage(null) })[0].more.week.avg, '');
});

test('row inside: the price line keeps entered values first and marks official, converted and family prices', () => {
  const own = weekly('claude', 20, NOW + 3 * D, { price: 290000, currency: 'KRW', billDay: 2 });
  const m1 = moreOf([own])[0].more;
  assert.deepEqual([m1.cost.val, m1.cost.note, m1.cost.bill], ['월 290,000원', '', '다음 결제 12월 2일']);
  const annual = weekly('claude', 20, NOW + 3 * D, { price: 290000, currency: 'KRW', billDay: 2, cycle: 'annual' });
  assert.equal(moreOf([annual])[0].more.cost.bill, '', 'annual billing does not say every month');
  const official = weekly('claude', 20, NOW + 3 * D);
  const m2 = moreOf([official], { prices: PRICES, settings: { usdKrw: 1500 } })[0].more;
  assert.deepEqual([m2.cost.val, m2.cost.note], ['월 약 33,000원', '공식 요금']);
  const family = weekly('gemini', 20, NOW + 3 * D, { plan: 'family' });
  assert.equal(moreOf([family], { prices: PRICES })[0].more.cost.val, '가족 공유');
  const known = weekly('claude', 20, NOW + 3 * D, { email: 'k@example.com', price: 30000, currency: 'KRW' });
  const unknown = weekly('claude', 20, NOW + 3 * D, { email: 'u@example.com', plan: 'odd' });
  const m3 = moreOf([known, unknown])[0].more;
  assert.deepEqual([m3.cost.val, m3.cost.note], ['월 30,000원', '계정 2개 가운데 1개의 금액만 압니다']);
  // 가족 공유와 금액을 모르는 계정이 섞여도 서로 어긋나지 않는다(카본 A3)
  const fam = weekly('claude', 20, NOW + 3 * D, { email: 'f@example.com', plan: 'family', price: 0, currency: 'KRW' });
  const m4 = moreOf([fam, unknown])[0].more;
  assert.deepEqual([m4.cost.val, m4.cost.note], ['가족 공유', '계정 2개 가운데 1개의 금액만 압니다'], 'family plus unknown keeps the unknown note');
  const m5 = moreOf([known, fam, unknown])[0].more;
  assert.deepEqual([m5.cost.val, m5.cost.note], ['월 30,000원', '가족 공유 1개 · 계정 3개 가운데 2개의 금액만 압니다'], 'a family account counts as one whose price is known');
  assert.equal(moreOf([weekly('gpt', 20, NOW + 3 * D)], { prices: PRICES })[0].more.cost, null, 'no price means no price line');
});

test('row inside: a credit service says whether it lasts until the next refill only when it knows all three', () => {
  const c = row({ service: 'typecast', label: 'Typecast', kind: 'credit', plan: 'plus', billDay: 1, live: { readAt: NOW, credits: 3000, planCredits: 10000 } });
  const lasts = moreOf([c], { usage: { accounts: { [c.id]: { perDay: 100 } } } })[0].more;
  assert.equal(lasts.say, 'Typecast는 다음 충전(12월 1일)까지 남습니다.');
  const runs = moreOf([c], { usage: { accounts: { [c.id]: { perDay: 1000 } } } })[0].more;
  assert.match(runs.say, /^Typecast 크레딧이 .+쯤 바닥납니다\. 다음 충전은 12월 1일입니다\.$/);
  assert.equal(moreOf([c])[0].more.say, '');
});

test('row inside: with no fact at all it gives one reason instead of an empty box', () => {
  const unread = weekly('claude', 0, NOW + 3 * D, { live: null });
  assert.equal(moreOf([unread])[0].more.empty, '아직 기록이 모이지 않았습니다. 하루쯤 지나면 지난 7일이 보입니다.');
  const manual = row({ service: null, source: 'manual', label: '사내 도구', kind: 'weekly', live: null });
  const mm = moreOf([manual])[0].more;
  assert.deepEqual([mm.say, mm.empty], ['', '직접 넣은 구독이라 남은 양을 읽지 않습니다.']);
  const priced = moreOf([row({ service: null, source: 'manual', label: '사내 도구', kind: 'weekly', live: null, price: 10000, currency: 'KRW' })])[0].more;
  assert.deepEqual([priced.cost.val, priced.empty], ['월 10,000원', '']);
});
