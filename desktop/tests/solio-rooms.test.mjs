// 솔리오 안쪽의 나머지(2단계 둘째 조각) 자료 함수 시험. 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 12.1절.
// 요금 줄, 계정 관리 방(계정 줄 · 사실 줄 · 고치는 칸 · 계정 더하기 · 막혔을 때), 입력 검사, 화면 글의 말투를 본다. 메일은 모두 example.com이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CODE_SAY, DEFAULT_SAY, codeSay, costRow, manageRoom, addItems, manageOpenKey, checkBillDay, parsePass, parseApi, parseFlow, parseCost, parseManual, checkCode, checkKey, checkEmail, checkRate, readWord, MANAGE_HELP, ADD_SERVICES, tokRow, TOK_SHOWN, accountRoom, accountSay, checkName, ACCOUNT_SAY, ACCOUNT_NETWORK_SAY, ACCOUNT_DEFAULT_SAY, SESSIONS_SHOWN,
  settingsRoom, updateWords, updateSay, updateOf, checkShortcut, checkQuiet, desktopSay, ZOOMS, DIAG_SAY, DRAFT_SAY, SHORTCUT_SAY, tipWords, tipDoneWords, subTips } from '../renderer/solio-rooms.mjs';
import { tokenDay } from '../renderer/subscriptions-tokens.mjs';

const NOW = new Date(2026, 10, 18, 10, 0).getTime(), D = 864e5, H = 3600e3;
const weekly = (id, service, used, resetsAt, extra = {}) => ({ id, service, source: 'auto', label: service, kind: 'weekly', state: 'ok', plan: 'pro', email: id + '@example.com', folder: true, live: { readAt: NOW - 5 * 60e3, weekly: { usedPercent: used, resetsAt } }, ...extra });
const credit = (id, credits, extra = {}) => ({ id, service: 'higgsfield', source: 'auto', label: 'Higgsfield', kind: 'credit', state: 'ok', plan: 'plus', email: id + '@example.com', folder: true, live: { readAt: NOW - 5 * 60e3, credits, planCredits: 3000 }, ...extra });
const manual = (id, label, extra = {}) => ({ id, source: 'manual', label, kind: 'plan', ...extra });
const snap = (rows, extra = {}) => ({ ok: true, seq: 1, rows, check: { at: NOW - 5 * 60e3 }, usage: { accounts: {} }, prices: null, settings: { usdKrw: 1400 }, tools: {}, login: null, ...extra });
const PRICES = { services: { claude: { checked: '2026-11-10', currency: 'USD', krVat: 0.1, plans: { pro: { month: 20, year: 200 }, max5x: { month: 100, apiCredit: 100 }, max20x: { month: 200, apiCredit: 200 } } }, gemini: { checked: '2026-11-10', currency: 'KRW', plans: { family: { month: 0 }, ultra20x: { month: 360000, flowCredits: 25000, apiCredit: 100 } } } } };
const st = (extra = {}) => ({ notes: new Map(), grps: new Set(), add: { svc: '' }, kinds: {}, installing: new Set(), ...extra });
const kinds = (items, k) => items.filter(x => x[0] === k);
const flat = items => items.flatMap(x => (x[0] === 'grp' ? [x, ...flat(x[2])] : [x]));
const actsOf = items => flat(items).filter(x => x[0] === 'acts').flatMap(x => x[1]);
const texts = value => { const out = []; const walk = v => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); }; walk(value); return out; };

/* ── 요금 줄(설계 2절, 설계 검토 D13) ── */
test('cost line: no price yet says so and stays dim', () => {
  const row = costRow(snap([weekly('a', 'claude', 20, NOW + 3 * D)]), st(), NOW);
  assert.equal(row.key, 'cost');
  assert.equal(row.gap, true);
  assert.equal(row.mid, '아직 넣은 요금이 없습니다');
  assert.equal(row.unread, true);
  assert.equal(row.more[0][1], '요금을 넣은 계정이 아직 없습니다.');
  assert.equal(costRow(null, st(), NOW), null);
  assert.equal(costRow(snap([]), st(), NOW), null);
});

test('cost line: the total, bills due in 7 days, unknown prices and the next bill', () => {
  const rows = [weekly('w', 'claude', 20, NOW + 3 * D, { price: 290000, currency: 'KRW', billDay: 20 }), weekly('g', 'gpt', 20, NOW + 3 * D, { price: 145000, currency: 'KRW', billDay: 30 }), weekly('u', 'gemini', 20, NOW + 3 * D)];
  const row = costRow(snap(rows), st(), NOW);
  assert.equal(row.mid, '한 달 435,000원 · 7일 안 결제 1건 · 요금을 아는 구독만 더함');
  assert.equal(row.when, '다음 결제 11월 20일 Claude');
  assert.equal(row.more[0][1], '한 달에 435,000원을 냅니다. 7일 안에 Claude가 결제됩니다.');
  // 구독과 요금제마다 한 줄, 그 아래 7일 안에 결제되는 계정만 이름과 함께(11-20 유호님 「난잡해」, 솔리오 구독 비서 설계 3.6)
  const lines = kinds(row.more, 'row');
  assert.deepEqual(lines.filter(r => !/월 \d+일$/.test(r[1])).map(b => [b[1], b[2], b[3], b[4]]), [['Claude Pro', 'w', '290,000원', '다음 결제 11월 20일'], ['Codex Pro 200', 'g', '145,000원', '다음 결제 11월 30일']], 'an account with no price and no bill day is left out of the total (「요금을 아는 구독만 더함」)');
  assert.ok(kinds(row.more, 'note').some(n => n[1] === '7일 안에 결제되는 계정입니다.'));
  assert.deepEqual(lines.filter(r => /월 \d+일$/.test(r[1])).map(b => [b[1], b[2], b[3], b[4], b[5]]), [['11월 20일', 'Claude · w', '290,000원', '2일 뒤', true]]);
});

test('cost line: ten accounts of one plan are one line with their sum, not ten lines (솔리오 구독 비서 3.6)', () => {
  const rows = Array.from({ length: 10 }, (_, i) => weekly('m' + i, 'claude', 20, NOW + 3 * D, { plan: 'max_20x', billDay: 21 + (i % 3) }));
  const row = costRow(snap(rows, { prices: PRICES }), st(), NOW);
  const lines = kinds(row.more, 'row').filter(r => !/월 \d+일$/.test(r[1]));
  assert.deepEqual(lines.map(b => [b[1], b[2], b[3], b[4]]), [['Claude Ultra', '계정 10개 · 공식 요금', '약 3,080,000원', '다음 결제 11월 21일']]);
});

test('cost line: dollars, official prices, family sharing, free and annual billing', () => {
  const rows = [
    weekly('o', 'claude', 20, NOW + 3 * D, { plan: 'pro' }),
    weekly('f', 'gemini', 20, NOW + 3 * D, { plan: 'family' }),
    weekly('y', 'claude', 20, NOW + 3 * D, { plan: 'pro', price: 20, currency: 'USD', cycle: 'annual', billDay: 19 }),
  ];
  const row = costRow(snap(rows, { prices: PRICES }), st(), NOW);
  assert.match(row.mid, /^한 달 약 /, 'dollars make it approximate');
  const bills = kinds(row.more, 'row');
  // 같은 요금제(Claude Pro)의 공식 요금 계정과 연간 결제 계정은 한 줄에 묶이고, 무엇이 섞였는지 가운데 칸이 말한다
  const pro = bills.find(b => b[1] === 'Claude Pro'), family = bills.find(b => b[1] === 'Gemini');
  assert.deepEqual([pro[2], pro[3], pro[4]], ['계정 2개 · 공식 요금 1개 · 연간 결제 1개', '약 58,800원', ''], 'annual billing is not called due this month');
  assert.deepEqual([family[2], family[3]], ['f', '가족 공유']);
  assert.ok(!bills.some(b => /월 \d+일$/.test(b[1])), 'an annual bill day is not listed as due within 7 days');
  assert.ok(kinds(row.more, 'fld').some(f => f[4] === 'usdKrw' && f[2] === '1400'), 'a dollar amount brings the rate field');
  assert.match(kinds(row.more, 'note').at(-1)[1], /달러는 1달러에 1,400원으로 칩니다\./);
  const won = costRow(snap([weekly('k', 'claude', 20, NOW + 3 * D, { price: 30000, currency: 'KRW' })]), st(), NOW);
  assert.ok(!kinds(won.more, 'fld').length, 'no dollars, no rate field');
  assert.doesNotMatch(kinds(won.more, 'note').at(-1)[1], /달러/);
});

test('cost line: an account not on this PC still counts, and the line says so (설계 검토 D13)', () => {
  const rows = [weekly('h', 'gemini', 20, NOW + 3 * D, { price: 100000, currency: 'KRW' }), weekly('away', 'gemini', 20, NOW + 3 * D, { state: 'elsewhere', price: 50000, currency: 'KRW' })];
  const row = costRow(snap(rows), st(), NOW);
  assert.equal(row.mid, '한 달 150,000원 · 이 PC에 없는 계정 포함');
  const noPrice = costRow(snap([weekly('h', 'gemini', 20, NOW + 3 * D, { price: 100000, currency: 'KRW' }), weekly('away', 'gemini', 20, NOW + 3 * D, { state: 'elsewhere' })]), st(), NOW);
  assert.doesNotMatch(noPrice.mid, /이 PC에 없는/, 'only an away account that is counted is mentioned');
});

test('cost line: credits in the plans only when entered, and the earliest that disappears within 7 days', () => {
  const none = costRow(snap([weekly('w', 'claude', 20, NOW + 3 * D, { price: 290000 })]), st(), NOW);
  assert.ok(!kinds(none.more, 'row').some(r => r[1] === '구독에 든 크레딧'));
  const rows = [
    weekly('w', 'claude', 20, NOW + 3 * D, { plan: 'max20x', price: 290000, apiCredit: 50, apiCreditUntil: NOW + 3 * D }),
    weekly('g', 'gemini', 20, NOW + 3 * D, { plan: 'ultra_20x', flowCredit: 1200, flowCreditUntil: NOW + 20 * D }),
  ];
  const row = costRow(snap(rows), st(), NOW);
  const c = kinds(row.more, 'row').find(r => r[1] === '구독에 든 크레딧');
  assert.equal(c[2], 'Claude API $50 · Flow 1,200');
  assert.equal(c[4], '11월 21일에 $50가 사라짐');
  const refilled = costRow(snap([weekly('g', 'gemini', 20, NOW + 3 * D, { plan: 'ultra_20x', price: 1, flowCredit: 1200, flowCreditUntil: NOW - D })], { prices: PRICES }), st(), NOW);
  assert.equal(kinds(refilled.more, 'row').find(r => r[1] === '구독에 든 크레딧')[2], 'Flow 다시 찼을 것');
});

test('cost line: four weeks of use only with a full record, and nothing when the summary is off', () => {
  const w4 = { cover: true, known: true, weeks: [{ used: 50, reads: 2 }, { used: 50, reads: 2 }, { used: 50, reads: 2 }, { used: 50, reads: 2 }] };
  const row = weekly('w', 'claude', 20, NOW + 3 * D, { price: 100000 });
  const usage = { accounts: { w: { weeks4: w4 } } };
  const on = costRow(snap([row], { usage }), st(), NOW);
  assert.ok(kinds(on.more, 'note').some(n => n[1] === '지난 4주 동안 낸 돈의 약 50%만큼 썼습니다. 가장 여유가 큰 계정은 Claude w 계정입니다.'));
  const off = costRow(snap([row], { usage, settings: { summaryOff: true } }), st(), NOW);
  assert.ok(!kinds(off.more, 'note').some(n => /지난 4주/.test(n[1])));
  const young = costRow(snap([row], { usage: { accounts: { w: { weeks4: { ...w4, cover: false } } } } }), st(), NOW);
  assert.ok(!kinds(young.more, 'note').some(n => /지난 4주/.test(n[1])), 'a short record leaves the line out');
});

test('cost line: the last line opens account management through the top-level action', () => {
  const row = costRow(snap([weekly('w', 'claude', 20, NOW + 3 * D, { price: 1 })]), st({ notes: new Map([['cost', '저장했습니다.']]) }), NOW);
  assert.deepEqual(actsOf(row.more).find(a => a[1] === 'connect'), ['계정 관리', 'connect', '', 'top']);
  assert.deepEqual(row.more.at(-1), ['live', '저장했습니다.']);
});

/* ── 계정 관리 방(설계 4절) ── */
test('manage room: the first sentence counts accounts, and an empty room offers to connect one', () => {
  const empty = manageRoom(snap([]), st(), NOW);
  assert.deepEqual([empty.say, empty.then, empty.act], ['아직 연결한 계정이 없습니다.', '구독을 하나 연결하면 남은 양과 결제일을 여기에서 봅니다.', null]);
  assert.deepEqual(empty.rows.map(r => r.key), ['add', 'help']);
  const four = manageRoom(snap([weekly('a', 'claude', 10, NOW + D), weekly('b', 'gpt', 10, NOW + D), weekly('c', 'gemini', 10, NOW + D), credit('d', 900)]), st(), NOW);
  assert.equal(four.say, '연결한 계정은 넷입니다.');
  const mixed = manageRoom(snap([weekly('a', 'claude', 10, NOW + D), manual('m', 'Suno')]), st(), NOW);
  assert.equal(mixed.say, '연결한 계정은 하나이고, 직접 넣은 구독은 하나입니다.');
  assert.equal(mixed.foot, '로그인 정보와 사용량은 이 PC 밖으로 나가지 않습니다.');
  assert.deepEqual(mixed.act, ['모두 다시 읽기', 'reread-all', '']);
  assert.deepEqual(manageRoom(snap([weekly('a', 'claude', 10, NOW + D)]), st(), NOW, { checking: true }).act[2], 'off');
});

test('manage room: the second line says one thing in order — reading, re-login, unread, sign-in deadline, used up, all fine', () => {
  const ok = weekly('ok', 'claude', 10, NOW + D);
  const then = (rows, extra = {}, ctx = {}) => manageRoom(snap(rows, extra), st(), NOW, ctx).then;
  assert.equal(then([ok], { checking: true, progress: { done: 2, total: 5 } }), '지금 읽고 있습니다. 2/5');
  assert.equal(then([ok, weekly('x', 'gpt', 0, NOW + D, { state: 'needs-login' })]), 'Codex x 계정은 다시 로그인해야 합니다.');
  assert.equal(then([weekly('x', 'gpt', 0, NOW + D, { state: 'needs-login' }), weekly('y', 'gpt', 0, NOW + D, { state: 'needs-login' })]), '다시 로그인해야 하는 계정이 둘 있습니다.');
  assert.equal(then([ok, weekly('e', 'claude', 0, NOW + D, { state: 'error' })]), 'Claude e 계정은 읽지 못했습니다.');
  assert.equal(then([weekly('s', 'claude', 10, NOW + D, { loginUntil: NOW + 5 * D })]), 'Claude s 계정은 11월 23일에 로그인 기한이 끝납니다.');
  const out = weekly('o', 'gpt', 100, new Date(2026, 10, 20, 9, 0).getTime());
  assert.equal(then([ok, out]), 'Codex o 계정은 다 써서 금요일 09:00에 다시 열립니다.');
  assert.equal(then([ok], { check: { at: NOW - 60e3 } }), '모두 방금 읽었고, 막힌 계정은 없습니다.');
  assert.equal(then([ok], { check: { at: NOW - 30 * 60e3 } }), '모두 09:30에 읽었고, 막힌 계정은 없습니다.');
  // 오늘 읽지 않았으면 날짜를 붙이고, 아직 읽지 않은 계정이나 이 PC에 없는 계정이 섞이면 「모두 읽었다」고 하지 않는다(화면 검수 C2)
  assert.equal(then([ok], { check: { at: NOW - D } }), '모두 11월 17일 10:00에 읽었고, 막힌 계정은 없습니다.');
  const unread = weekly('u', 'gpt', 0, NOW + D, { live: null });
  assert.equal(then([ok, unread]), 'Codex u 계정은 아직 읽지 않았습니다.');
  assert.equal(then([unread, { ...unread, id: 'v', email: 'v@example.com' }]), '아직 읽지 않은 계정이 둘 있습니다.');
  const away = weekly('a', 'gemini', 10, NOW + D, { state: 'elsewhere' });
  assert.equal(then([ok, away], { check: { at: NOW - 60e3 } }), '이 PC에 로그인된 계정은 모두 방금 읽었고, 막힌 계정은 없습니다.');
  assert.equal(then([away]), 'Gemini a 계정은 지금 이 PC에 로그인되어 있지 않습니다.');
});

test('manage room: the middle of an account line follows its state, and the bright lines are the ones to act on', () => {
  const rows = [
    weekly('ok', 'claude', 36, NOW + D),
    weekly('lo', 'claude', 0, NOW + D, { state: 'needs-login' }),
    weekly('er', 'claude', 0, NOW + D, { state: 'error' }),
    weekly('aw', 'gemini', 10, NOW + D, { state: 'elsewhere' }),
    { ...weekly('un', 'gpt', 0, NOW + D), live: null },
    weekly('ou', 'gpt', 100, NOW + D),
    { ...weekly('pj', 'gpt', 50, NOW - H), live: { readAt: NOW - 3 * H, weekly: { usedPercent: 50, resetsAt: NOW - H } } },
    credit('cr', 1240),
    manual('m1', 'Suno'),
    manual('m2', 'Kling', { kind: 'weekly', usedUpAt: NOW - H, resetDay: 1, resetHour: 9, resetMinute: 0 }),
  ];
  const m = manageRoom(snap(rows), st(), NOW);
  const line = id => m.rows.find(r => r.key === 'a:' + id);
  assert.equal(line('ok').mid, '한도 64% 남음 · 09:55에 읽음');
  assert.equal(line('lo').mid, '다시 로그인해야 합니다');
  assert.equal(line('er').mid, '읽지 못했습니다');
  assert.equal(line('aw').mid, '지금 이 PC에 로그인되어 있지 않습니다');
  assert.equal(line('un').mid, '아직 읽지 않았습니다');
  assert.equal(line('ou').mid, '다 썼습니다 · 09:55에 읽음');
  assert.equal(line('pj').mid, '다시 찼을 것입니다 · 07:00에 읽음');
  assert.equal(line('cr').mid, '1,240 크레딧 · 09:55에 읽음');
  assert.equal(line('m1').mid, '한도는 읽지 않습니다');
  assert.equal(line('m2').mid, '다 썼다고 표시했습니다');
  assert.deepEqual(m.rows.filter(r => r.now).map(r => r.key), ['a:lo', 'a:er', 'a:ou']);
  assert.equal(line('ok').gap, true, 'the first account line stands apart from 「계정 더하기」');
  assert.equal(line('m1').sub, '월 구독만');
  assert.equal(line('ok').sub, 'ok · Pro');
  assert.equal(m.rows.at(-1).gap, true);
  assert.equal(readWord(NOW - 60e3, NOW), '방금 읽음');
  assert.equal(readWord(NOW - 2 * D, NOW), '11월 16일에 읽음');
});

test('manage room: the price and the billing words of an account line', () => {
  const m = manageRoom(snap([
    weekly('p', 'claude', 10, NOW + D, { price: 290000, currency: 'KRW', billDay: 9 }),
    weekly('o', 'claude', 10, NOW + D, { plan: 'pro' }),
    weekly('f', 'gemini', 10, NOW + D, { plan: 'family' }),
    weekly('y', 'claude', 10, NOW + D, { price: 20, currency: 'USD', cycle: 'annual' }),
    weekly('n', 'claude', 10, NOW + D, { price: 1000 }),
  ], { prices: PRICES }), st(), NOW);
  const line = id => m.rows.find(r => r.key === 'a:' + id);
  assert.deepEqual([line('p').val, line('p').when], ['월 290,000원', '매월 9일 결제']);
  assert.deepEqual([line('o').val, line('o').when], ['월 $22', '요금을 넣지 않음']);
  assert.equal(line('f').val, '가족 공유');
  assert.deepEqual([line('y').val, line('y').when], ['월 $20', '연간 결제']);
  assert.equal(line('n').when, '결제일 없음');
  assert.ok(kinds(line('o').more, 'note').some(n => n[1] === '공식 요금으로 셈합니다. 다르면 요금과 결제일에서 고칩니다.'));
  assert.ok(kinds(line('f').more, 'note').some(n => n[1] === '가족 공유로 받아 따로 내지 않습니다.'));
  assert.ok(kinds(line('y').more, 'note').some(n => n[1] === '연간 결제로 표시했습니다.'));
});

test('manage room: fact lines appear only with their data, and each editable fact opens its own group', () => {
  const plain = manageRoom(snap([weekly('h', 'higgsfield', 10, NOW + D)]), st(), NOW).rows[1].more;
  assert.ok(!kinds(plain, 'row').length, 'no facts, no fact lines');
  const claude = weekly('c', 'claude', 10, NOW + D, { plan: 'max20x', loginUntil: NOW + 3 * D, passCount: 2, passUntil: NOW + 5 * D, apiCredit: 50, apiCreditUntil: NOW + 6 * D });
  const more = manageRoom(snap([claude]), st({ grps: new Set(['a:c:pass']) }), NOW).rows[1].more;
  const facts = kinds(more, 'row').map(r => [r[1], r[2], r[3], typeof r[4] === 'string' ? r[4] : r[4].text, r[5]]);
  const benefit = facts.find(([name]) => name === '무료 API 혜택 연결');
  assert.equal(benefit[2], '미확인', 'a recorded dollar balance does not confirm the benefit');
  assert.deepEqual(facts.filter(f => f !== benefit), [
    ['로그인', '기한 전에 다시 로그인하면 끊기지 않습니다', '', '11월 21일까지', true],
    ['초기화권', '주간 한도를 한 번 다시 채웁니다', '2장', '11월 23일까지', undefined],
    ['API 크레딧', '구독에 함께 들어 있는 API 사용 금액입니다', '$50', '11월 24일에 사라짐', undefined],
  ]);
  assert.deepEqual(kinds(more, 'row')[1][4].btn, ['고치기', 'grp', 'pass', 'on']);
  const grps = Object.fromEntries(kinds(more, 'grp').map(g => [g[1], g[3]]));
  assert.deepEqual(grps, { pass: false, benefit: true, api: true, cost: true }, 'only the group that was opened shows');
  assert.ok(actsOf(more).some(a => a[1] === 'pass-used' && a[0] === '1장 썼습니다'));
  const gpt = manageRoom(snap([weekly('g', 'gpt', 10, NOW + D, { plan: 'plus', live: { readAt: NOW, weekly: { usedPercent: 10, resetsAt: NOW + D }, resets: { count: 0 } } })]), st(), NOW).rows[1].more;
  assert.deepEqual(kinds(gpt, 'row').map(r => [r[1], r[3]]), [['초기화권', '없음'], ['무료 API 혜택 연결', '미확인']]);
  assert.equal(kinds(gpt, 'row')[0][2], 'Codex가 알려 준 값입니다');
  assert.ok(!kinds(gpt, 'grp').some(g => g[1] === 'pass'), 'Codex passes cannot be edited');
  const gem = manageRoom(snap([weekly('m', 'gemini', 10, NOW + D, { plan: null })]), st(), NOW).rows[1].more;
  assert.ok(kinds(gem, 'note').some(n => n[1] === '요금제를 고르면 매달 딸려 오는 Flow와 API 크레딧을 알려 드립니다.'));
  assert.ok(kinds(gem, 'row').some(r => r[1] === 'Flow 크레딧'));
  const plan = flat(gem).find(x => x[0] === 'pick' && x[4] === 'plan');
  assert.deepEqual(plan[2].map(p => p[1]), ['', 'pro', 'ultra_5x', 'ultra_20x', 'plus', 'family'], 'the unknown Ultra tier is only offered to a row that has it');
});

test('manage room: the actions of an account line and the twice press of 「지우기」', () => {
  const rows = [weekly('e', 'claude', 0, NOW + D, { state: 'error' }), weekly('t', 'typecast', 0, NOW + D, { kind: 'credit', keyHint: 'a41c', email: null }), weekly('a', 'gemini', 0, NOW + D, { state: 'elsewhere' }), manual('m', 'Kling', { kind: 'weekly' })];
  const m = manageRoom(snap(rows), st(), NOW);
  const labels = id => m.rows.find(r => r.key === 'a:' + id).more.filter(x => x[0] === 'acts').flatMap(x => x[1]).map(a => a[0]);
  assert.deepEqual(labels('e'), ['다시 로그인', '이 계정 다시 읽기', '공식 화면에서 연결 확인', '요금과 결제일', '지우기']);
  assert.deepEqual(labels('t'), ['키 다시 넣기', '요금과 결제일', '지우기']);
  // 「이번 달 Flow 사용량 읽기」는 고칠 때까지 세우지 않는다(GPT solio-subs-agy-be-20261126 A5)
  assert.deepEqual(labels('a'), ['이 계정으로 바꾸기', '공식 화면에서 연결 확인', '요금과 결제일', '지우기']);
  assert.deepEqual(labels('m'), ['다 썼습니다', '고치기', '지우기']);
  const remove = m.rows[1].more.flatMap(x => (x[0] === 'acts' ? x[1] : [])).find(a => a[1] === 'remove');
  assert.deepEqual(remove, ['지우기', 'remove', '', 'far']);
  const armed = manageRoom(snap(rows), st({ armed: { key: 'a:e', act: 'remove', at: NOW } }), NOW).rows[1].more;
  assert.deepEqual(actsOf(armed).find(a => a[1] === 'remove'), ['한 번 더 누르면 지웁니다', 'remove', '', 'far warn']);
  assert.deepEqual(armed.at(-1), ['live', '이 앱이 만든 로그인 폴더와 쌓인 사용 기록을 함께 지웁니다. 되돌릴 수 없습니다.']);
  const existing = manageRoom(snap([{ ...rows[0], folder: false }]), st({ armed: { key: 'a:e', act: 'remove', at: NOW } }), NOW).rows[1].more;
  assert.equal(existing.at(-1)[1], '목록에서 빼고 쌓인 사용 기록을 지웁니다. 이 PC의 기존 로그인은 그대로 둡니다.');
});

test('manage room: the cost group carries the fields of the old edit form', () => {
  const field = (more, name) => flat(more).find(x => (x[0] === 'fld' || x[0] === 'pick') && x[4] === name);
  const auto = manageRoom(snap([credit('h', 900, { lowAt: 100 })]), st(), NOW).rows[1].more;
  assert.deepEqual(['price', 'currency', 'cycle', 'billDay', 'note', 'lowAt'].map(n => !!field(auto, n)), [true, true, true, true, true, true]);
  assert.equal(field(auto, 'credits'), undefined, 'an automatic credit row does not take a balance');
  const m = manual('m', 'Kling', { kind: 'credit', credits: 200 });
  const man = manageRoom(snap([m]), st(), NOW).rows[1].more;
  assert.deepEqual(['label', 'kind', 'credits', 'lowAt'].map(n => !!field(man, n)), [true, true, true, true]);
  const asWeekly = manageRoom(snap([m]), st({ kinds: { 'a:m': 'weekly' } }), NOW).rows[1].more;
  assert.ok(field(asWeekly, 'resetDay') && field(asWeekly, 'resetTime') && !field(asWeekly, 'credits'), 'picking the limit kind changes the fields');
});

test('manage room: 「막혔을 때」 has twelve questions with the two facts the sketch shortened', () => {
  const m = manageRoom(snap([]), st(), NOW);
  const help = m.rows.find(r => r.key === 'help');
  assert.equal(help.more.length, 12);
  assert.ok(help.more.every(x => x[0] === 'qa'));
  assert.equal(MANAGE_HELP.length, 12);
  assert.match(MANAGE_HELP.find(h => /구독 한도가 없다/.test(h[0]))[1], /「그 밖의 구독」으로 결제일만 넣어 둘 수 있습니다\./);
  assert.match(MANAGE_HELP.find(h => /Claude API/.test(h[0]))[1], /Claude Console 조직을 연결해야 들어옵니다\./);
});

test('manage room: which line opens when the room opens (설계 9.3)', () => {
  assert.equal(manageOpenKey(snap([]), null, NOW), 'add');
  const rows = [weekly('a', 'claude', 10, NOW + D), weekly('b', 'gpt', 10, NOW + D)];
  assert.equal(manageOpenKey(snap(rows), null, NOW), null, 'from the room bottom with nothing to fix, nothing opens');
  assert.equal(manageOpenKey(snap(rows), 'gpt', NOW), 'a:b', 'from a subscription line, its first account');
  assert.equal(manageOpenKey(snap([...rows, weekly('x', 'gpt', 0, NOW + D, { state: 'needs-login' })]), 'claude', NOW), 'a:x', 'an account to fix comes first');
});

/* ── 계정 더하기(설계 4.5) ── */
test('add: the steps follow the tools and the login stage', () => {
  const add = (svc, extra = {}, state = {}) => addItems(snap([], extra), st({ add: { svc }, ...state }), NOW);
  const pick = addItems(snap([]), st(), NOW);
  assert.deepEqual(pick[0].slice(0, 2), ['pick', '무엇을 더하시겠습니까']);
  assert.deepEqual(pick[0][2].map(p => p[1]), ADD_SERVICES);
  assert.equal(pick[1][1], '고르면 그 자리에서 차례대로 안내합니다. 연결하면 바로 한 번 읽습니다.');
  const missing = add('claude', { tools: { claude: { installed: false } }, platform: 'win32' });
  assert.deepEqual(kinds(missing, 'row').map(r => r[1]), ['1 요금제', '2 설치', '3 로그인']);
  assert.ok(kinds(missing, 'cmd').length === 1, 'the install command can be pasted by hand');
  // 「다시 확인」은 설치 창을 열기 전에도 있다. 직접 설치한 사람도 다음 단계로 넘어간다(화면 검수 C1). 이름은 오류 글의 「다시 확인」과 같다(C4)
  assert.deepEqual(actsOf(missing).filter(a => a[1] === 'install' || a[1] === 'recheck-tools').map(a => a[0]), ['설치 창 열기', '다시 확인']);
  assert.deepEqual(actsOf(missing).filter(a => a[1] === 'tool-copy' || a[1] === 'help').map(a => a[0]), ['명령 복사', '공식 설치 안내 ↗']);
  assert.deepEqual(actsOf(add('claude', { tools: { claude: { installed: false } } }, { installing: new Set(['claude']) })).filter(a => a[1] === 'install' || a[1] === 'recheck-tools').map(a => a[0]), ['다시 확인']);
  assert.match(CODE_SAY.TOOL_MISSING, /「다시 확인」/);
  assert.match(MANAGE_HELP[0][1], /「다시 확인」/);
  assert.match(MANAGE_HELP[0][0], /「아직 없음」/, 'the question names the state the install line shows');
  const mac = add('claude', { tools: { claude: { installed: false } }, platform: 'darwin' });
  assert.equal(kinds(mac, 'cmd').length, 0, 'the PowerShell command is not offered on a Mac');
  assert.deepEqual(actsOf(mac).filter(a => a[1] === 'tool-copy' || (a[1] === 'help' && a[2] === 'claude-install') || a[1] === 'recheck-tools').map(a => a[0]), ['공식 설치 안내 ↗', '다시 확인'], 'a Mac still gets the official guide and 「다시 확인」');
  const node = add('higgsfield', { tools: { higgsfield: { installed: false, npm: false } } });
  assert.ok(kinds(node, 'note').some(n => n[1] === 'Higgsfield CLI는 Node.js가 먼저 있어야 합니다.'));
  const ready = add('claude', { tools: { claude: { installed: true, version: '2.1.3 (Claude Code)' } } });
  assert.equal(kinds(ready, 'row')[1][2], '이 PC에 설치되어 있습니다 · 2.1.3');
  assert.ok(kinds(ready, 'fld').some(f => f[4] === 'email' && f[5] === 'email'));
  assert.deepEqual(actsOf(ready).filter(a => a[1] === 'login' || a[1] === 'existing').map(a => a[0]), ['새 계정 연결', '이 PC의 기존 로그인 쓰기']);
  const gem = add('gemini', { tools: { gemini: { installed: true } } });
  assert.deepEqual(actsOf(gem).filter(a => a[1] === 'login' || a[1] === 'existing').map(a => a[0]), ['Gemini 로그인']);
  const busy = add('claude', { tools: { claude: { installed: true } }, login: { id: 'l', service: 'gpt', stage: 'browser' } });
  assert.ok(kinds(busy, 'note').some(n => n[1] === '다른 로그인이 진행 중입니다. 끝난 뒤 이어서 해 주세요.'));
  assert.ok(actsOf(busy).filter(a => a[1] === 'login').every(a => /off/.test(a[3])), 'and its buttons cannot be pressed');
});

test('add: browser, code, black window, checking, failure', () => {
  const tools = { claude: { installed: true }, gpt: { installed: true }, gemini: { installed: true } };
  const at = (svc, login, state = {}) => addItems(snap([], { tools, login: { id: 'l', service: svc, ...login } }), st({ add: { svc }, ...state }), NOW);
  const browser = at('gpt', { stage: 'browser', url: 'https://example.com/login' });
  assert.equal(kinds(browser, 'row').at(-1)[2], '브라우저에서 로그인을 마쳐 주세요. 끝나면 저절로 넘어갑니다.');
  assert.ok(kinds(browser, 'note').some(n => /휴대폰 인증/.test(n[1])));
  assert.deepEqual(actsOf(browser).map(a => a[1]), ['open-url', 'copy-url', 'cancel-login']);
  const code = at('claude', { stage: 'browser', url: 'https://example.com/login', needsCode: true });
  assert.ok(kinds(code, 'fld').some(f => f[4] === 'code'));
  assert.ok(actsOf(code).some(a => a[1] === 'console-login'), 'Claude can fall back to the black window');
  const consoleNow = at('gemini', { stage: 'console' });
  assert.equal(kinds(consoleNow, 'note').length, 2);
  assert.deepEqual(actsOf(consoleNow).map(a => a[1]), ['cancel-login']);
  assert.equal(kinds(at('gpt', { stage: 'verifying' }), 'row').at(-1)[2], '연결을 확인하고 있습니다.');
  const failed = at('gpt', { stage: 'error', message: '로그인을 마치지 못했어요.' }, { ended: { id: 'l', stage: 'error' } });
  assert.equal(kinds(failed, 'row').at(-1)[4], '마치지 못함');
  assert.deepEqual(actsOf(failed).find(a => a[1] === 'login').slice(0, 2), ['다시 시도', 'login']);
  const stale = at('gpt', { stage: 'error', message: '옛 실패' });
  assert.ok(!kinds(stale, 'note').some(n => n[1] === '옛 실패'), 'a failure from before this visit is not shown');
});

test('relogin: while another login runs, the account line says so in one note and adds no empty 「로그인」 line (화면 검수 C5)', () => {
  const c = weekly('c', 'claude', 10, NOW + D, { loginUntil: NOW + 20 * D });
  const more = manageRoom(snap([c], { tools: { claude: { installed: true } }, login: { id: 'l', service: 'gpt', stage: 'browser' } }), st({ relogin: 'c' }), NOW).rows[1].more;
  assert.deepEqual(kinds(more, 'row').filter(r => r[1] === '로그인').map(r => r[2]), ['한 번 로그인하면 4주쯤 이어집니다'], 'only the sign-in deadline line, no empty step line');
  assert.deepEqual(kinds(more, 'note').filter(n => /로그인이 진행 중/.test(n[1])).map(n => n[1]), ['다른 로그인이 진행 중입니다. 끝난 뒤 이어서 해 주세요.']);
});

test('the API credit group fills the next bill day, and next month’s when today is the bill day (화면 검수 C6)', () => {
  const field = row => flat(manageRoom(snap([row]), st(), NOW).rows[1].more).find(x => x[0] === 'fld' && x[4] === 'apiDate')[2];
  const c = weekly('c', 'claude', 10, NOW + D, { plan: 'max20x' });
  assert.equal(field({ ...c, billDay: 20 }), '2026-11-20');
  assert.equal(field({ ...c, billDay: 18 }), '2026-12-18', 'today is the bill day, so the date is next month’s');
  assert.equal(parseApi({ apiCredit: '50', apiDate: field({ ...c, billDay: 18 }) }, { ...c, billDay: 18 }, NOW).ok, true, 'putting in only the amount saves');
  assert.equal(field({ ...c, billDay: 18, cycle: 'annual' }), '', 'annual billing has no monthly date to fill');
});

test('add: Typecast key and other subscriptions', () => {
  const tc = addItems(snap([]), st({ add: { svc: 'typecast' } }), NOW);
  assert.deepEqual(kinds(tc, 'row').map(r => r[1]), ['1 요금제', '2 API 키']);
  assert.deepEqual(kinds(tc, 'fld').map(f => [f[1], f[4], f[5]]), [['3 키 붙여 넣기', 'key', 'password']]);
  const other = addItems(snap([]), st({ add: { svc: 'other' } }), NOW);
  assert.deepEqual(kinds(other, 'fld').map(f => f[4]), ['label', 'price', 'billDay', 'note']);
  assert.deepEqual(actsOf(other).map(a => a[1]), ['manual-add']);
  const credits = addItems(snap([]), st({ add: { svc: 'other' }, kinds: { add: 'credit' } }), NOW);
  assert.deepEqual(kinds(credits, 'fld').map(f => f[4]), ['label', 'credits', 'lowAt', 'price', 'billDay', 'note']);
});

/* ── 입력 검사(설계 4.4 표, 옛 onForm과 같은 경계값) ── */
test('input checks: billing day and the cost group', () => {
  assert.deepEqual(checkBillDay(''), { ok: true, value: null });
  assert.equal(checkBillDay('1').value, 1);
  assert.equal(checkBillDay('31').value, 31);
  for (const bad of ['0', '32', '3.5', '셋']) assert.equal(checkBillDay(bad).say, '결제일은 1부터 31 사이로 넣어 주세요.', bad);
  const row = weekly('g', 'gemini', 10, NOW + D);
  const ok = parseCost({ price: '290,000', currency: 'KRW', billDay: '9', cycle: '', note: ' 회사 카드 ', plan: 'ultra_20x' }, row);
  assert.deepEqual(ok.patch, { id: 'g', price: 290000, currency: 'KRW', billDay: 9, note: '회사 카드', cycle: null, plan: 'ultra_20x' });
  assert.equal(parseCost({ plan: 'ultra' }, row).patch.plan, null, 'the unknown tier is only kept for a row that already has it');
  assert.equal(parseCost({ plan: 'ultra' }, { ...row, plan: 'ultra' }).patch.plan, 'ultra');
  assert.equal(parseCost({ price: '-1' }, row).say, '월 구독료는 0 이상의 숫자로 넣어 주세요.');
  const m = manual('m', 'Kling', { kind: 'credit' });
  assert.deepEqual(parseCost({ label: '', kind: 'credit', credits: '200', lowAt: '' }, m).patch, { id: 'm', price: null, currency: 'KRW', billDay: null, note: '', cycle: null, label: 'Kling', kind: 'credit', resetDay: null, resetHour: null, resetMinute: null, credits: 200, lowAt: null });
  const wk = parseCost({ kind: 'weekly', resetDay: '1', resetTime: '09:30' }, m).patch;
  assert.deepEqual([wk.kind, wk.resetDay, wk.resetHour, wk.resetMinute], ['weekly', 1, 9, 30]);
});

test('input checks: passes (0 to 20, expiry after now, empty time is 23:59)', () => {
  const day = d => { const t = new Date(NOW + d * D); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  assert.deepEqual(parsePass({ passCount: '0' }, NOW).patch, { passCount: 0, passUntil: null });
  assert.equal(parsePass({ passCount: '20', passDate: day(3) }, NOW).patch.passCount, 20);
  assert.equal(parsePass({ passCount: '21', passDate: day(3) }, NOW).patch.passCount, 20, 'like the old form, more than 20 is kept at 20');
  assert.equal(new Date(parsePass({ passCount: '1', passDate: day(3) }, NOW).patch.passUntil).getHours(), 23);
  assert.equal(parsePass({ passCount: '1', passDate: day(-1) }, NOW).say, '만료 때가 이미 지났습니다. 날짜를 확인해 주세요.');
});

test('input checks: API credits (0 to 100,000 dollars, an expiry for Claude and Codex, not today or before)', () => {
  const day = d => { const t = new Date(NOW + d * D); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const claude = weekly('c', 'claude', 10, NOW + D, { plan: 'max20x' });
  assert.deepEqual(parseApi({ apiCredit: '' }, claude, NOW).patch, { apiCredit: null, apiCreditUntil: null });
  assert.equal(parseApi({ apiCredit: '0', apiDate: day(2) }, claude, NOW).patch.apiCredit, 0);
  assert.equal(parseApi({ apiCredit: '100000', apiDate: day(2) }, claude, NOW).patch.apiCredit, 100000);
  assert.equal(parseApi({ apiCredit: '100000.01', apiDate: day(2) }, claude, NOW).say, '남은 금액은 0에서 100,000달러 사이 숫자로 넣어 주세요.');
  assert.equal(parseApi({ apiCredit: '50' }, claude, NOW).say, '결제 화면에 보이는 만료 날짜도 넣어 주세요.');
  assert.equal(parseApi({ apiCredit: '50', apiDate: day(0) }, claude, NOW).say, '오늘 사라지는 크레딧은 세지 않습니다. 오늘 안에 써 주세요.');
  assert.equal(parseApi({ apiCredit: '50', apiDate: day(-1) }, claude, NOW).say, '만료 날짜가 이미 지났습니다. 날짜를 확인해 주세요.');
  const filled = parseApi({ apiCredit: '50', apiDate: day(5) }, claude, NOW);
  assert.equal(filled.billDay, new Date(NOW + 5 * D).getDate(), 'a monthly plan with no billing day takes the expiry day');
  assert.equal(parseApi({ apiCredit: '50', apiDate: day(5) }, { ...claude, billDay: 3 }, NOW).billDay, null);
  assert.deepEqual(parseApi({ apiCredit: '40' }, weekly('g', 'gemini', 10, NOW + D, { plan: 'ultra_20x' }), NOW).patch, { apiCredit: 40 }, 'Gemini takes no expiry date');
});

test('input checks: Flow credits (integers to 10,000,000, a refill date after now; family sharing fills no billing day)', () => {
  const day = d => { const t = new Date(NOW + d * D); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const gem = weekly('g', 'gemini', 10, NOW + D, { plan: 'ultra_20x' });
  assert.equal(parseFlow({ flowCredit: '10000000', flowDate: day(3) }, gem, NOW).patch.flowCredit, 10000000);
  for (const bad of ['10000001', '1.5', '-1']) assert.equal(parseFlow({ flowCredit: bad, flowDate: day(3) }, gem, NOW).say, '남은 Flow 크레딧은 0에서 10,000,000 사이 정수로 넣어 주세요.', bad);
  assert.equal(parseFlow({ flowCredit: '1200' }, gem, NOW).say, 'Flow 프로필에 보이는 다시 차는 날짜도 넣어 주세요.');
  assert.equal(parseFlow({ flowCredit: '1200', flowDate: day(-1) }, gem, NOW).say, '다시 차는 때가 이미 지났습니다. 날짜와 시각을 확인해 주세요.');
  assert.equal(parseFlow({ flowCredit: '1200', flowDate: day(3) }, gem, NOW).billDay, new Date(NOW + 3 * D).getDate());
  assert.equal(parseFlow({ flowCredit: '1200', flowDate: day(3) }, { ...gem, plan: 'family' }, NOW).billDay, null);
});

test('input checks: other subscriptions, code, key, e-mail and the dollar rate', () => {
  assert.equal(parseManual({ label: ' ' }).say, '서비스 이름을 넣어 주세요.');
  assert.equal(parseManual({ label: 'Suno' }).add.kind, 'credit', 'a known name picks its limit kind');
  assert.equal(parseManual({ label: 'Suno' }, 'plan').add.kind, 'plan', 'a picked kind wins');
  assert.equal(parseManual({ label: 'Midjourney', price: '10', currency: 'USD', billDay: '3' }).add.price, 10);
  assert.equal(parseManual({ label: 'X', billDay: '40' }).say, '결제일은 1부터 31 사이로 넣어 주세요.');
  assert.equal(checkCode('').say, '코드를 끝까지 붙여 넣어 주세요.');
  assert.equal(checkCode('ABCDEFG').say, '코드를 끝까지 붙여 넣어 주세요.');
  assert.equal(checkCode('ABCD EFGH').say, CODE_SAY.INVALID_CODE);
  assert.equal(checkCode(' ABCDEFGH ').value, 'ABCDEFGH');
  assert.equal(checkKey('').say, '복사한 키를 붙여 넣어 주세요.');
  assert.deepEqual(checkEmail(''), { ok: true, value: undefined });
  assert.equal(checkEmail('qa@example.com').value, 'qa@example.com');
  assert.equal(checkEmail('qa@').say, '이메일 형식을 확인해 주세요.');
  assert.equal(checkRate('1,450').value, 1450);
  assert.equal(checkRate('0').say, '1달러가 몇 원인지 숫자로 넣어 주세요.');
  assert.equal(codeSay('LOGIN_BUSY'), CODE_SAY.LOGIN_BUSY);
  assert.equal(codeSay('NOPE'), DEFAULT_SAY);
  assert.equal(DEFAULT_SAY, '요청을 마치지 못했습니다. 잠시 뒤 다시 해 주세요.');
});

/* ── 모델별 토큰 줄(설계 3절, 설계 검토 D8) ── */
const dayKey = k => tokenDay(NOW - k * D);
// 본체 칸의 차례: [날짜, 도구, 모델, 입력, 출력, 캐시 읽기, 캐시 쓰기, 생각, 응답 수]
const cell = (k, service, model, out, n) => [dayKey(k), service, model, 10, out, 0, 0, 0, n];
const tokOn = (extra = {}) => ({ ok: true, enabled: true, epoch: 1, seq: 1, scanning: false, progress: null, scannedAt: NOW - 30 * 60e3, liveAt: null, live: false, since: dayKey(20), sinceBy: { claude: dayKey(20), gpt: dayKey(20) }, tools: { claude: 3, gpt: 2 }, failed: 0, error: null,
  cells: [cell(0, 'claude', 'claude-opus-5-5', 6100, 40), cell(1, 'claude', 'claude-opus-5-5', 1000, 10), cell(2, 'gpt', 'gpt-6.1-sol', 2900, 25), cell(10, 'claude', 'claude-sonnet-5', 50000, 90)], ...extra });
const tokSt = (extra = {}) => ({ notes: new Map(), tokRange: 'week', tokAll: false, ...extra });

test('token line: switched off says so dimly, explains what it reads and offers to switch on', () => {
  assert.equal(tokRow(null, tokSt(), NOW), null, 'no line before the state is read');
  assert.equal(tokRow({ ok: false, code: 'SIGN_IN_REQUIRED' }, tokSt(), NOW), null);
  const row = tokRow({ ok: true, enabled: false }, tokSt(), NOW);
  assert.deepEqual([row.key, row.nm, row.mid, row.unread, row.watch], ['tok', '모델별 토큰', '꺼져 있습니다', true, true]);
  // 이름 아래 한 줄이 「토큰」을 풀어 준다(11-23 맹검: 설명 없이 나온 기술 낱말)
  assert.equal(row.sub, 'AI가 답으로 쓴 글의 양');
  assert.ok(row.label.startsWith('모델별 토큰, AI가 답으로 쓴 글의 양, 꺼져 있습니다'));
  assert.equal(tokRow(tokOn(), tokSt(), NOW).sub, 'AI가 답으로 쓴 글의 양', 'the counted line keeps the same explanation');
  assert.equal(row.more[0][1], '모델마다 AI가 답으로 쓴 토큰을 셉니다. 토큰은 AI가 읽고 쓴 글의 양입니다.');
  assert.ok(kinds(row.more, 'note').some(n => /끄면 모두 지웁니다\.$/.test(n[1])), 'what stays on this PC and that switching off clears it');
  assert.deepEqual(actsOf(row.more).map(a => a[1]), ['tok-on']);
});

test('token line: the first count shows its progress, a stopped count offers 「다시 세기」', () => {
  const first = tokRow(tokOn({ scannedAt: null, scanning: true, progress: { done: 120, total: 1840 } }), tokSt(), NOW);
  assert.deepEqual([first.mid, first.val], ['처음 세는 중입니다', '120/1,840']);
  assert.ok(kinds(first.more, 'note').some(n => n[1] === '기록이 많으면 몇 분 걸립니다. 다른 화면을 봐도 계속 셉니다.'));
  assert.deepEqual(actsOf(first.more).map(a => a[1]), ['tok-off'], 'it can still be switched off');
  const stopped = tokRow(tokOn({ scannedAt: null, error: 'SCAN_FAILED' }), tokSt(), NOW);
  assert.equal(stopped.mid, '세다가 멈췄습니다');
  assert.deepEqual(actsOf(stopped.more).map(a => a[1]), ['tok-scan', 'tok-off']);
});

test('token line: the closed line says one thing, the top model and its share, with the total and responses', () => {
  const row = tokRow(tokOn(), tokSt(), NOW);
  assert.equal(row.mid, '가장 많이 쓴 모델은 Opus 5.5입니다 · 71%');
  assert.equal(row.val, '1만');
  assert.equal(row.when, '지난 7일 · 응답 75번');
  const pick = kinds(row.more, 'pick')[0];
  assert.deepEqual([pick[1], pick[2], pick[3], pick[5]], ['기간', [['오늘', 'today'], ['7일', 'week'], ['30일', 'month']], 'week', 'tok-range']);
  const gauges = kinds(row.more, 'gauge');
  assert.deepEqual(gauges.map(g => [g[1], g[2], g[3], g[4]]), [['Opus 5.5', 71, '7,100', 'Claude Code · 응답 50번'], ['GPT-6.1 Sol', 29, '2,900', 'Codex · 응답 25번']]);
  const month = tokRow(tokOn(), tokSt({ tokRange: 'month' }), NOW);
  assert.equal(month.mid, '가장 많이 쓴 모델은 Sonnet 5입니다 · 83%');
  assert.equal(month.when, '지난 30일 · 응답 165번');
  const today = tokRow(tokOn({ cells: [cell(3, 'claude', 'claude-opus-5-5', 100, 1)] }), tokSt({ tokRange: 'today' }), NOW);
  assert.deepEqual([today.mid, today.val, today.when, today.unread], ['오늘은 센 응답이 없습니다', '', '', true]);
  const none = tokRow(tokOn({ cells: [] }), tokSt(), NOW);
  assert.equal(none.mid, '지난 7일 동안 센 응답이 없습니다');
});

test('token line: a share under 0.5% says 「1% 미만」, more than six models fold behind 「모두 보기」', () => {
  const tiny = tokRow(tokOn({ cells: [cell(0, 'claude', 'claude-opus-5-5', 1, 1), cell(0, 'gpt', 'gpt-6.1-sol', 999, 1)] }), tokSt(), NOW);
  assert.deepEqual(kinds(tiny.more, 'gauge').map(g => [g[2], g[3]]), [[100, '999'], [1, '1']], 'a used model keeps at least a sliver of line');
  // 모델이 아주 많으면 가장 많이 쓴 모델도 0.5%에 못 미칠 수 있다
  const crowd = tokRow(tokOn({ cells: Array.from({ length: 300 }, (_, i) => cell(0, 'gpt', 'gpt-6.' + i, 1, 1)) }), tokSt(), NOW);
  assert.match(crowd.mid, / · 1% 미만$/);
  assert.equal(kinds(crowd.more, 'gauge').length, TOK_SHOWN);
  const nine = tokOn({ cells: Array.from({ length: 8 }, (_, i) => cell(0, 'gpt', 'gpt-6.' + i, 100 + i, 1)).concat([cell(0, 'claude', 'claude-opus-5-5', 1, 1)]) });
  const shut = tokRow(nine, tokSt(), NOW), all = tokRow(nine, tokSt({ tokAll: true }), NOW);
  assert.equal(kinds(shut.more, 'gauge').length, TOK_SHOWN);
  assert.equal(actsOf(shut.more).find(a => a[1] === 'tok-all')[0], '모델 9개 모두 보기');
  assert.equal(kinds(all.more, 'gauge').length, 9);
  assert.equal(kinds(all.more, 'gauge').at(-1)[1], 'Opus 5.5');
  assert.equal(actsOf(all.more).find(a => a[1] === 'tok-all')[0], '여섯 개만 보기');
});

test('token line: tools that start late, unreadable files, a stopped count, no records and Antigravity are said as facts', () => {
  const late = tokRow(tokOn({ sinceBy: { claude: dayKey(20), gpt: dayKey(3) } }), tokSt(), NOW);
  const month = (k => (d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일')(new Date(NOW - k * D)))(3);
  assert.ok(kinds(late.more, 'note').some(n => n[1] === 'Codex 기록은 ' + month + '부터 있습니다. 그 전 날은 비어 있습니다.'), 'the tool whose records begin inside the range');
  const facts = tokRow(tokOn({ failed: 3, error: 'SCAN_FAILED', live: true, liveAt: NOW - 60e3, tools: { claude: 3, agy: 2 } }), tokSt(), NOW);
  const notes = kinds(facts.more, 'note').map(n => n[1]).join(' ');
  assert.match(notes, /09:59에 마지막으로 셌습니다\./, 'the later of the scan and the live count');
  assert.match(notes, /구독 방을 열어 두면 답이 끝날 때마다 숫자를 더합니다\./);
  assert.match(notes, /읽지 못한 파일이 3개 있습니다\./);
  assert.match(notes, /지난번에는 끝까지 세지 못했습니다\./);
  assert.match(notes, /Antigravity CLI는 토큰 수를 남기지 않아 세지 못합니다\./);
  const empty = tokRow(tokOn({ cells: [], tools: {} }), tokSt(), NOW);
  assert.match(kinds(empty.more, 'note').map(n => n[1]).join(' '), /이 PC에서 Claude Code, Codex, Grok CLI, Gemini CLI의 기록을 아직 찾지 못했습니다\./);
  assert.ok(!/많은 순서입니다/.test(kinds(empty.more, 'note').map(n => n[1]).join(' ')), 'no order sentence without models');
  const again = tokRow(tokOn({ scanning: true, progress: { done: 3, total: 9 } }), tokSt(), NOW);
  assert.match(kinds(again.more, 'note').map(n => n[1]).join(' '), /지금 다시 세고 있습니다\(기록 파일 3\/9\)\./);
  assert.equal(actsOf(again.more).find(a => a[1] === 'tok-scan')[3], 'off', 'no second count while one runs');
  const yesterday = tokRow(tokOn({ scannedAt: NOW - D }), tokSt(), NOW);
  assert.match(kinds(yesterday.more, 'note').map(n => n[1]).join(' '), /11월 17일 10:00에 마지막으로 셌습니다\./);
});

test('token line: switching off asks first and says what goes in the status line', () => {
  const row = tokRow(tokOn(), tokSt({ armed: { key: 'tok', act: 'tok-off', at: NOW } }), NOW);
  const off = actsOf(row.more).find(a => a[1] === 'tok-off');
  assert.equal(off[0], '한 번 더 누르면 끄고 지웁니다');
  assert.match(off[3], /warn/);
  assert.equal(row.more.at(-1)[1], '끄면 모은 숫자를 지웁니다. 다시 켜면 처음부터 다시 셉니다.');
  const busy = tokRow(tokOn(), tokSt({ busy: 'tok:tok-scan' }), NOW);
  assert.equal(actsOf(busy.more).find(a => a[1] === 'tok-scan')[3], 'off');
});

/* ── 내 계정 방(설계 5절) ── */
const AID = '11111111-1111-4111-8111-111111111111';
const sess = (id, extra = {}) => ({ id, product: 'world', label: '', last_seen: new Date(NOW - 2 * H).toISOString(), current: false, revoked: false, ...extra });
const view = (extra = {}) => ({ ok: true, account: { synk_user_id: AID, status: 'active', profile: { display_name: '합성 회원', locale: 'ko', time_zone: 'Asia/Seoul' }, profile_revision: 3 },
  memberships: [{ kind: 'learner', role: 'student', student_code: 'S-01' }], learning: { enabled: true, revision: 2 }, capabilities: { learningSync: true },
  sessions: [sess('s-now', { product: 'platform', current: true }), sess('s-phone', { label: '휴대폰', last_seen: new Date(NOW - 3 * D).toISOString() }), sess('s-old', { revoked: true })], dataRequests: [], ...extra });
const who = (extra = {}) => ({ ok: true, email: 'member@example.com', newEmail: null, createdAt: '2026-03-02T00:00:00Z', identities: [{ provider: 'email' }, { provider: 'google' }], ...extra });
const accSt = (extra = {}) => ({ notes: new Map(), ...extra });
const accRow = (room, key) => room.rows.find(r => r.key === key);

test('account room: loading, a failed read with its reason and 「다시 불러오기」, and the account number always at the bottom', () => {
  const loading = accountRoom({ loading: true }, accSt(), NOW, { accountKey: AID });
  assert.deepEqual([loading.say, loading.rows, loading.foot, loading.act[1]], ['계정 정보를 불러오고 있습니다.', [], '문의할 때 쓰는 계정 번호 ' + AID, 'sign-out']);
  const failed = accountRoom({ error: accountSay('NETWORK') }, accSt(), NOW, { accountKey: AID });
  assert.deepEqual([failed.say, failed.then, failed.act.slice(0, 2)], ['계정 정보를 불러오지 못했습니다.', ACCOUNT_NETWORK_SAY, ['다시 불러오기', 'retry']]);
  const ready = accountRoom({ data: view(), identity: who() }, accSt(), NOW, {});
  assert.equal(ready.foot, '문의할 때 쓰는 계정 번호 ' + AID, 'the number comes from the account server once read (설계 검토 D12)');
  assert.deepEqual(ready.act.slice(0, 2), ['로그아웃', 'sign-out']);
});

test('account room: the first sentence names the member, the second counts the places; without a name it says SYNK 회원', () => {
  const room = accountRoom({ data: view(), identity: who() }, accSt(), NOW, {});
  assert.deepEqual([room.say, room.then], ['합성 회원 님으로 로그인했습니다.', '이 PC를 포함해 두 곳에서 쓰고 있습니다.']);
  assert.deepEqual(room.rows.map(r => r.key), ['name', 'login', 'places', 'data', 'del']);
  const nameless = accountRoom({ data: view({ account: { ...view().account, profile: {} } }) }, accSt(), NOW, {});
  assert.equal(nameless.say, 'SYNK 회원으로 로그인했습니다.');
  const fromSignIn = accountRoom({ data: view({ account: { ...view().account, profile: {} } }) }, accSt(), NOW, { name: '로그인 이름' });
  assert.equal(fromSignIn.say, '로그인 이름 님으로 로그인했습니다.');
  const one = accountRoom({ data: view({ sessions: [sess('s-now', { current: true })] }) }, accSt(), NOW, {});
  assert.equal(one.then, '이 PC에서만 쓰고 있습니다.');
});

test('account room: the name line, its field, affiliation and the joined day only when known', () => {
  const room = accountRoom({ data: view(), identity: who() }, accSt(), NOW, {});
  const name = accRow(room, 'name');
  assert.deepEqual([name.nm, name.mid, name.val, name.when], ['이름', 'SYNK 앱마다 이 이름으로 보입니다', '합성 회원', '2026년 3월 2일 가입']);
  assert.deepEqual(kinds(name.more, 'fld')[0].slice(1, 6), ['새 이름', '합성 회원', '60자까지', 'name', 'text']);
  assert.deepEqual(kinds(name.more, 'row')[0].slice(1, 3), ['소속', '학생 · S-01']);
  assert.equal(accRow(accountRoom({ data: view({ memberships: [] }), identity: who({ createdAt: null }) }, accSt(), NOW, {}), 'name').when, '', 'no joined day without one');
  assert.equal(kinds(accRow(accountRoom({ data: view({ memberships: [] }) }, accSt(), NOW, {}), 'name').more, 'row')[0][2], '학교나 회사와 연결된 소속이 없습니다');
});

test('account room: sign-in shows the whole e-mail and opens 「로그인과 보안」 for each change (설계 검토 D11)', () => {
  const login = accRow(accountRoom({ data: view(), identity: who() }, accSt(), NOW, {}), 'login');
  assert.deepEqual([login.mid, login.when], ['이메일과 비밀번호 · Google', 'member@example.com']);
  assert.deepEqual(kinds(login.more, 'row').map(r => [r[1], Array.isArray(r[4]) ? r[4].slice(0, 3) : r[4]]), [['로그인 이메일', ['바꾸기 ↗', 'security', 'email']], ['비밀번호', ['바꾸기 ↗', 'security', 'password']], ['Google', '']]);
  const google = accRow(accountRoom({ data: view(), identity: who({ identities: [{ provider: 'google' }], newEmail: 'next@example.com' }) }, accSt(), NOW, {}), 'login');
  assert.equal(kinds(google.more, 'row')[1][4][0], '비밀번호 만들기 ↗');
  assert.ok(kinds(google.more, 'note').some(n => n[1] === '새 이메일 next@example.com의 확인을 기다리고 있습니다.'));
  const email = accRow(accountRoom({ data: view(), identity: who({ identities: [{ provider: 'email' }] }) }, accSt(), NOW, {}), 'login');
  assert.deepEqual(kinds(email.more, 'row')[2][4].slice(0, 3), ['Google 연결하기 ↗', 'security', 'google']);
  const unread = accRow(accountRoom({ data: view(), identityError: true }, accSt(), NOW, {}), 'login');
  assert.deepEqual([unread.mid, unread.when], ['불러오지 못했습니다', '']);
});

test('account room: places put this PC first without a sign-out, show six of seven, and ask twice to sign out everywhere', () => {
  const seven = [sess('s-now', { product: 'platform', current: true }), ...Array.from({ length: 6 }, (_, i) => sess('s' + i, { label: '기기 ' + i }))];
  const places = accRow(accountRoom({ data: view({ sessions: seven }) }, accSt(), NOW, {}), 'places');
  assert.deepEqual([places.mid, places.val], ['이 PC · 기기 0 · 기기 1 외 4곳', '7곳']);
  const rows = kinds(places.more, 'row');
  assert.equal(rows.length, SESSIONS_SHOWN);
  assert.deepEqual([rows[0][1], rows[0][2], rows[0][4], rows[0][5]], ['이 PC', 'SYNK 플랫폼 · 지금 쓰는 중', '', true]);
  assert.deepEqual([rows[1][1], rows[1][2], rows[1][4].slice(0, 3)], ['기기 0', 'SYNK WORLD · 오늘 08:00에 사용', ['로그아웃시키기', 'revoke', 's0']]);
  assert.equal(actsOf(places.more).find(a => a[1] === 'sessions-all')[0], '1곳 더 보기');
  assert.equal(kinds(accRow(accountRoom({ data: view({ sessions: seven }), allSessions: true }, accSt(), NOW, {}), 'places').more, 'row').length, 7);
  const armed = accRow(accountRoom({ data: view() }, accSt({ armed: { key: 'places', act: 'revoke-all', at: NOW } }), NOW, {}), 'places');
  assert.equal(actsOf(armed.more).find(a => a[1] === 'revoke-all')[0], '한 번 더 누르면 모두 로그아웃합니다');
  assert.equal(armed.more.at(-1)[1], '이 PC를 포함해 다른 기기와 브라우저의 SYNK 로그인을 모두 끝냅니다. 이 PC도 바로 로그아웃됩니다.');
});

test('account room: my data has the learning switch, the practice record and the town record, and no personality line (설계 검토 D4 · D5)', () => {
  const data = accRow(accountRoom({ data: view() }, accSt(), NOW, {}), 'data');
  assert.equal(data.mid, '학습 기록 연결 켜짐 · 연습 기록 · 마을 기록');
  const tog = kinds(data.more, 'tog')[0];
  assert.deepEqual([tog[1], tog[3], tog[4], tog[5]], ['학습 기록 연결', true, 'learning', '']);
  assert.deepEqual(kinds(data.more, 'row').map(r => [r[1], r[4][1]]), [['연습 기록', 'export'], ['마을 기록', 'town']]);
  assert.ok(!texts(data).some(t => /내 성향/.test(t)));
  const deleting = view({ account: { ...view().account, status: 'deletion-requested' }, learning: { enabled: false, revision: 3 } });
  const locked = kinds(accRow(accountRoom({ data: deleting }, accSt(), NOW, {}), 'data').more, 'tog')[0];
  assert.deepEqual([locked[2], locked[5]], ['계정 삭제를 요청해서 켤 수 없습니다. 요청을 취소하면 다시 켤 수 있습니다', 'off']);
  const noFeature = kinds(accRow(accountRoom({ data: view({ learning: { enabled: false, revision: 1 }, capabilities: {} }) }, accSt(), NOW, {}), 'data').more, 'tog')[0];
  assert.deepEqual([noFeature[2], noFeature[5]], ['지금은 켤 수 없습니다. 이 기기에서 하는 연습은 그대로 할 수 있습니다', 'off']);
});

test('account room: deleting is a confirm group, not a second press; a pending request can be cancelled; processing cannot', () => {
  const before = accRow(accountRoom({ data: view() }, accSt(), NOW, {}), 'del');
  assert.deepEqual([before.gap, before.unread, before.watch, before.mid], [true, true, true, '요청한 뒤 7일 동안은 취소할 수 있습니다']);
  assert.deepEqual(actsOf(before.more).map(a => a[1]), ['delete-ask']);
  assert.equal(kinds(before.more, 'confirm').length, 0);
  const asking = accRow(accountRoom({ data: view(), askDelete: true }, accSt(), NOW, {}), 'del');
  const box = kinds(asking.more, 'confirm')[0];
  assert.equal(box[1], '계정 삭제를 요청하시겠습니까?');
  assert.equal(box[2].length, 3);
  assert.deepEqual(box[3].map(a => a[1]), ['delete-send', 'delete-keep']);
  assert.match(actsOf(asking.more).find(a => a[1] === 'delete-ask')[3], /toggle on/);
  const due = new Date(2026, 11, 3, 15, 0).toISOString();
  const pending = view({ account: { ...view().account, status: 'deletion-requested' }, dataRequests: [{ kind: 'delete', status: 'pending', request_id: 'r1', due_at: due }] });
  const room = accountRoom({ data: pending }, accSt(), NOW, {});
  assert.deepEqual([room.say, room.then], ['계정을 지워 달라고 요청했습니다.', '12월 3일 15:00까지는 이 자리에서 취소할 수 있습니다.']);
  const del = accRow(room, 'del');
  assert.deepEqual([del.now, del.val, del.mid], [true, '요청됨', '12월 3일까지 취소할 수 있습니다']);
  assert.deepEqual(actsOf(del.more).map(a => a[1]), ['delete-cancel']);
  const noDue = accRow(accountRoom({ data: view({ account: { ...view().account, status: 'deletion-requested' }, dataRequests: [{ kind: 'delete', status: 'pending', request_id: 'r2' }] }) }, accSt(), NOW, {}), 'del');
  assert.deepEqual([noDue.mid, noDue.more[0][1]], ['7일 동안 취소할 수 있습니다', '7일 동안은 이 자리에서 요청을 취소할 수 있습니다.'], 'without a due time the line does not say 「7일 안까지」 (화면 검수 C7)');
  assert.equal(kinds(accRow(room, 'name').more, 'fld').length, 0, 'the name cannot be changed while deletion is requested');
  const processing = accountRoom({ data: view({ account: { ...view().account, status: 'deletion-requested' } }) }, accSt(), NOW, {});
  assert.equal(processing.then, '계정 삭제를 처리하고 있습니다.');
  assert.deepEqual(actsOf(accRow(processing, 'del').more), []);
});

test('account errors take the 합니다 voice, and the name check keeps the old rules', () => {
  assert.equal(accountSay('PROFILE_CONFLICT'), ACCOUNT_SAY.PROFILE_CONFLICT);
  assert.equal(accountSay('SERVICE_UNAVAILABLE'), ACCOUNT_NETWORK_SAY);
  assert.equal(accountSay('WHATEVER', true), ACCOUNT_NETWORK_SAY);
  assert.equal(accountSay('WHATEVER'), ACCOUNT_DEFAULT_SAY);
  assert.equal(checkName('  ').say, '이름을 넣어 주세요.');
  assert.equal(checkName('가'.repeat(60)).value, '가'.repeat(60));
  assert.equal(checkName('가'.repeat(61)).say, '이름은 60자 안으로 적어 주세요.');
  assert.equal(checkName('😀'.repeat(31)).say, '이름은 60자 안으로 적어 주세요.', 'UTF-16 length is what the server counts');
  assert.equal(checkName('a\u0007b').say, '이름에 쓸 수 없는 글자가 들어 있습니다.');
  assert.equal(checkName('  새 이름 ').value, '새 이름');
});

/* ── 설정 방(설계 6절, 설계 검토 D6 · D7 · D9 · D10)과 구독 줄 안쪽의 팁(D7) ── */
const deskSnap = (prefs = {}, caps = {}, extra = {}) => ({ ok: true, preferences: { closeToTray: true, launchAtLogin: false, startHidden: false, globalShortcut: '', zoomFactor: 1, ...prefs }, capabilities: { launchAtLogin: true, globalShortcut: true, tray: true, encryptedDrafts: true, ...caps }, ...extra });
const noticeVal = (extra = {}) => ({ banners: true, mutedUntil: 0, schedule: false, start: '22:00', end: '08:00', weekdays: false, ...extra });
const WIN = { platform: 'win32', version: '0.4.97', mode: 'development' };
const setSt = (extra = {}) => ({ notes: new Map(), grps: new Set(), ...extra });
const setRoom = (s = {}, extra = {}) => settingsRoom({ update: { state: 'current', currentVersion: '0.4.97' }, desktop: deskSnap(), drafts: { ok: true, available: true, enabled: true }, notices: noticeVal(), env: WIN, member: true, tipsOff: false, ...s }, setSt(extra), NOW);
const setRow = (room, key) => room.rows.find(r => r.key === key);
const togs = row => row.more.filter(x => x[0] === 'tog');

test('settings room: six rows, the first sentence from the update state, how it starts, and the version line at the bottom (설계 6.3)', () => {
  const r = setRoom();
  assert.deepEqual(r.rows.map(x => x.key), ['update', 'start', 'key', 'view', 'notice', 'draft']);
  assert.deepEqual([r.say, r.then, r.foot], ['이 PC의 SYNK는 최신 판입니다.', '컴퓨터를 켤 때 함께 켜지 않습니다.', 'SYNK Platform 0.4.97 · 시험판 · Windows']);
  assert.deepEqual(r.act, ['문제 알리기용 정보 복사', 'diag-copy', '']);
  assert.equal(setRoom({ desktop: deskSnap({ launchAtLogin: true, startHidden: true }) }).then, '컴퓨터를 켜면 창 없이 함께 켜집니다.');
  assert.equal(setRoom({ desktop: deskSnap({ launchAtLogin: true }) }).then, '컴퓨터를 켜면 창과 함께 켜집니다.');
  assert.equal(setRoom({ desktop: deskSnap({ launchAtLogin: true, startHidden: true }, { tray: false }) }).then, '컴퓨터를 켜면 창과 함께 켜집니다.', 'without the tray it cannot start hidden');
  assert.equal(setRoom({ desktop: deskSnap({}, { launchAtLogin: false }) }).then, '', 'a build that cannot start at sign-in says nothing about it');
  assert.equal(setRoom({ env: { ...WIN, mode: 'release' } }).foot, 'SYNK Platform 0.4.97 · Windows');
  assert.equal(setRoom({}, { roomNote: '버전과 연결 상태만 복사했습니다. 이름, 글, 파일 경로는 넣지 않았습니다.' }).foot, '버전과 연결 상태만 복사했습니다. 이름, 글, 파일 경로는 넣지 않았습니다.');
  assert.equal(setRoom({}, { busy: 'settings:diag-copy' }).act[2], 'off');
  assert.ok(!texts(r).some(t => /움직임/.test(t)), 'motion reduction is not offered (설계 검토 D6)');
});

test('settings room: update words keep the old rules for nine states, automatic and manual, Windows and Mac, and four error codes (설계 검토 D10)', () => {
  const v = { latestVersion: '0.4.98' };
  assert.deepEqual(['current', 'idle', 'checking', 'available', 'downloading', 'ready', 'opening', 'error', 'disabled'].map(state => updateSay({ state, ...v })), [
    '이 PC의 SYNK는 최신 판입니다.', '이 PC의 SYNK는 쓰는 동안 새 판을 저절로 확인합니다.', '새 판이 있는지 보고 있습니다.', '새 판(v0.4.98)이 나왔습니다.', '새 판을 받고 있습니다.',
    '새 판이 준비됐습니다.', '업데이트를 준비하고 있습니다.', '새 판을 받지 못했습니다.', '여기서는 새 판을 받을 수 없습니다.']);
  assert.equal(updateWords({ state: 'downloading', automatic: true, ...v }, 'win32'), '새 판(v0.4.98)을 받고 있습니다. 다 받으면 바꾼 뒤 다시 엽니다. 받는 동안에도 지금 앱을 쓸 수 있습니다.');
  assert.equal(updateWords({ state: 'downloading', automatic: true, ...v }, 'darwin'), '새 판(v0.4.98) 설치 파일을 받고 있습니다. 받는 동안에도 지금 앱을 쓸 수 있습니다.', 'Mac never installs by itself');
  assert.match(updateWords({ state: 'ready', automatic: true, ...v }, 'win32'), /^새 판\(v0\.4\.98\)이 준비됐습니다\. 쓰던 글이 있는지 확인한 뒤/);
  assert.match(updateWords({ state: 'ready', automatic: true, code: 'UPDATE_EXIT_CANCELLED' }, 'win32'), /^앱 끄기를 취소했습니다\./);
  assert.match(updateWords({ state: 'ready', code: 'UPDATE_MANUAL_INSTALL' }, 'darwin'), /Applications 폴더로 옮겨 주세요\.$/);
  assert.match(updateWords({ state: 'ready', ...v }, 'win32'), /앱을 끄고 설치 파일을 엽니다\.$/);
  assert.match(updateWords({ state: 'error', code: 'UPDATE_STORAGE_FAILED' }, 'win32'), /^설치 파일을 저장하지 못했습니다\./);
  assert.match(updateWords({ state: 'error', code: 'UPDATE_SAME_VERSION' }, 'win32'), /^지금 판과 올라온 설치 파일이 맞지 않습니다\./);
  assert.match(updateWords({ state: 'error', code: 'UPDATE_HASH_MISMATCH' }, 'win32'), /^받은 업데이트 파일이 온전하지 않습니다\./);
  assert.match(updateWords({ state: 'error', code: 'INSTALL_OPEN_FAILED' }, 'darwin'), /「설치 파일 열기」를 다시 눌러 주세요\./);
  assert.match(updateWords({ state: 'error', code: 'UPDATE_NETWORK_FAILED' }, 'win32'), /^새 판을 받지 못했습니다\. 인터넷 연결을 확인한 뒤/);
  assert.match(updateWords({ state: 'idle' }, 'darwin'), /받은 설치 파일을 열어 업데이트해 주세요\.$/);
  const acts = (u, env = WIN) => setRow(setRoom({ update: u, env }), 'update').more.filter(x => x[0] === 'acts').flatMap(x => x[1]).map(a => [a[0], a[1], a[3]]);
  assert.deepEqual(acts({ state: 'available', ...v }), [['지금 확인', 'update-check', ''], ['받기', 'update-download', '']]);
  assert.deepEqual(acts({ state: 'ready', ...v }), [['지금 확인', 'update-check', ''], ['앱 끄고 설치 파일 열기', 'update-install', '']]);
  assert.deepEqual(acts({ state: 'ready', ...v }, { ...WIN, platform: 'darwin' }), [['지금 확인', 'update-check', ''], ['설치 파일 열기', 'update-install', '']]);
  assert.deepEqual(acts({ state: 'ready', automatic: true, ...v }), [['지금 확인', 'update-check', 'off']], 'an automatic install shows no install button and waits');
  assert.deepEqual(acts({ state: 'disabled' }), []);
  const down = setRow(setRoom({ update: { state: 'downloading', progress: 41.6, ...v } }), 'update');
  assert.deepEqual([down.mid, down.val, down.when], ['새 판을 받고 있습니다', '42%', '새 판 0.4.98']);
  assert.equal(setRow(setRoom(), 'update').when, '', 'the check time is not in the main snapshot, so it is not said (설계 15절)');
  assert.equal(setRoom({ update: null }).say, '여기서는 새 판을 받을 수 없습니다.');
  assert.deepEqual([updateOf({ status: { state: 'current' } })?.state, updateOf({ state: 'nope' }), updateOf(null)], ['current', null, null]);
  assert.ok(!texts(setRoom({ update: { state: 'downloading', automatic: true, ...v } })).some(t => /깎/.test(t)), 'the orb carving scene does not exist yet');
});

test('settings room: rows that cannot change are left out, and 트레이로 시작 waits for 자동 시작 (편의 79행)', () => {
  const start = setRow(setRoom(), 'start');
  assert.deepEqual(togs(start).map(t => [t[1], t[3], t[4], t[5], t[6]]), [['자동 시작', false, 'pref', '', 'launchAtLogin'], ['트레이로 시작', false, 'pref', 'off', 'startHidden'], ['트레이에 남기기', true, 'pref', '', 'closeToTray']]);
  assert.match(togs(start)[1][2], /자동 시작을 켜야 고를 수 있습니다$/);
  assert.equal(start.mid, '자동 시작 안 함 · 닫아도 트레이에 남음');
  assert.equal(togs(setRow(setRoom({ desktop: deskSnap({ launchAtLogin: true }) }), 'start'))[1][5], '', 'once 자동 시작 is on 트레이로 시작 can be pressed');
  assert.deepEqual(togs(setRow(setRoom({ desktop: deskSnap({}, { launchAtLogin: false }) }), 'start')).map(t => t[6]), ['closeToTray']);
  assert.equal(setRow(setRoom({ desktop: deskSnap({}, { launchAtLogin: false, tray: false }) }), 'start'), undefined);
  assert.equal(setRow(setRoom({ desktop: deskSnap({}, { globalShortcut: false }) }), 'key'), undefined);
  assert.equal(setRow(setRoom({ env: { ...WIN, platform: 'darwin' } }), 'key'), undefined, 'the anywhere shortcut is Windows only');
  assert.deepEqual(setRoom({ desktop: null }).rows.map(r => r.key), ['update', 'notice', 'draft']);
  assert.deepEqual(setRoom({ desktop: null, notices: null, drafts: null }).rows.map(r => r.key), ['update']);
  assert.equal(togs(setRow(setRoom({}, { busy: 'start:pref' }), 'start'))[0][5], 'off', 'a change on its way blocks the next one');
});

test('settings room: the anywhere shortcut says what it really does, and the shortcut check keeps the main rule (설계 검토 D9)', () => {
  const on = setRow(setRoom({ desktop: deskSnap({ globalShortcut: 'Ctrl+Alt+S' }) }), 'key');
  assert.deepEqual([on.nm, on.mid, on.val, on.unread], ['어디서나 열기', '어느 화면에서든 이 단축키로 SYNK 창을 앞으로 띄웁니다', 'Ctrl+Alt+S', false]);
  assert.deepEqual(on.more[0], ['fld', '단축키', 'Ctrl+Alt+S', '예: Ctrl+Alt+S', 'shortcut', 'text']);
  const off = setRow(setRoom(), 'key');
  assert.deepEqual([off.mid, off.val, off.unread], ['단축키를 정하지 않았습니다', '', true]);
  assert.equal(actsOf(off.more).find(a => a[1] === 'shortcut-off')[3], 'off', 'nothing to switch off');
  assert.ok(!texts(on).some(t => /빠른 검색/.test(t)), 'the shortcut does not open the quick search (설계 검토 D9)');
  const taken = setRow(setRoom({ desktop: deskSnap({ globalShortcut: 'Ctrl+Alt+S' }, {}, { warning: 'SHORTCUT_UNAVAILABLE' }) }), 'key');
  assert.ok(texts(taken).includes('저장한 단축키를 다른 앱이 쓰고 있어 지금은 듣지 않습니다. 다른 조합을 골라 주세요.'));
  assert.equal(checkShortcut('').say, '단축키를 넣어 주세요.');
  assert.equal(checkShortcut('ctrl + alt + s').value, 'Ctrl+Alt+S');
  assert.equal(checkShortcut('Ctrl+Alt+space').value, 'Ctrl+Alt+Space');
  assert.equal(checkShortcut('ctrl+shift+f12').value, 'Ctrl+Shift+F12');
  for (const bad of ['Shift+A', 'S', 'Ctrl+Alt+Enter', 'Ctrl+Alt+Shift+Super+S', 'Ctrl+Alt+F25']) assert.equal(checkShortcut(bad).say, '단축키 모양을 알아보지 못했습니다. 예: Ctrl+Alt+S', bad);
  const { validShortcut } = createRequire(import.meta.url)('../src/desktop-preferences.cjs');
  for (const good of ['ctrl+alt+s', 'Alt+F4', 'CommandOrControl+Shift+K', 'ctrl+9']) assert.equal(validShortcut(checkShortcut(good).value), true, good + ' is what the main process takes');
  assert.equal(desktopSay('SHORTCUT_UNAVAILABLE'), '다른 앱이 쓰는 단축키입니다. 다른 조합을 골라 주세요.');
  assert.equal(desktopSay('INVALID_DESKTOP_PREFERENCES', { globalShortcut: 'x' }), '단축키 모양을 알아보지 못했습니다. 예: Ctrl+Alt+S');
  assert.equal(desktopSay('STARTUP_UNAVAILABLE', { launchAtLogin: true }), '설정을 적용하지 못했습니다. 잠시 뒤 다시 해 주세요.');
});

test('settings room: the screen size picks 80 to 150 percent and keeps an odd saved value (설계 검토 D6)', () => {
  const view = setRow(setRoom({ desktop: deskSnap({ zoomFactor: 1.25 }) }), 'view');
  assert.equal(view.mid, '크기 125%');
  const pick = view.more.find(x => x[0] === 'pick');
  assert.deepEqual([pick[1], pick[2].map(o => o[0]), pick[3], pick[5]], ['화면 크기', ['80%', '90%', '100%', '110%', '125%', '150%'], '1.25', 'zoom']);
  assert.deepEqual(ZOOMS, [0.8, 0.9, 1, 1.1, 1.25, 1.5]);
  assert.deepEqual(setRow(setRoom({ desktop: deskSnap({ zoomFactor: 1.2 }) }), 'view').more.find(x => x[0] === 'pick')[2].map(o => o[0]), ['80%', '90%', '100%', '110%', '120%', '125%', '150%']);
});

test('settings room: the screen line has a sound switch when the app knows the setting, and says so in the line when sound is off (2026-11-20)', () => {
  const on = setRow(setRoom({ desktop: deskSnap({ uiSound: true }) }), 'view');
  assert.equal(on.mid, '크기 100%');
  assert.deepEqual(togs(on).map(t => [t[1], t[2], t[3], t[4], t[5], t[6]]), [['효과음', '구가 별 지도로 바뀔 때와 공간 이름을 가리킬 때 작은 소리를 냅니다', true, 'pref', '', 'uiSound']]);
  const off = setRow(setRoom({ desktop: deskSnap({ uiSound: false }) }, setSt({ busy: 'view:pref' })), 'view');
  assert.equal(off.mid, '크기 100% · 효과음 꺼짐');
  assert.deepEqual(togs(off).map(t => [t[3], t[5]]), [[false, 'off']], 'the switch waits while the change is being saved');
  assert.deepEqual(togs(setRow(setRoom({ desktop: deskSnap() }), 'view')), [], 'an older app that does not know the setting shows no switch');
});

test('settings room: notices say what the banner really does, the quiet hours have their own fields, resting says until when, and the tip switch sits in the same line (설계 검토 D7 · D10)', () => {
  const n = setRow(setRoom(), 'notice');
  assert.deepEqual(togs(n).map(t => [t[1], t[2], t[3], t[4], t[6]]), [
    ['알림 배너', '앱 설치 파일이 준비됐거나 실패했을 때 배너를 띄웁니다', true, 'notice', 'banners'],
    ['조용한 시간', '매일 22:00부터 08:00까지는 배너를 띄우지 않습니다', false, 'notice', 'schedule'],
    ['구독 팁', '구독 줄과 요금 줄 안쪽에 아끼는 법과 막히지 않는 법을 한 줄씩 알려 드립니다', true, 'tips', undefined]]);
  assert.equal(n.mid, '배너 켜짐');
  assert.equal(n.more.find(x => x[0] === 'grp')[3], true, 'the quiet hours fields wait behind 「시각 고치기」');
  const open = setRow(setRoom({}, { grps: new Set(['notice:quiet']) }), 'notice').more.find(x => x[0] === 'grp');
  assert.deepEqual([open[3], open[2].filter(x => x[0] === 'fld').map(f => [f[1], f[2], f[4], f[5]])], [false, [['시작', '22:00', 'quietStart', 'time'], ['끝', '08:00', 'quietEnd', 'time']]]);
  assert.deepEqual(open[2].find(x => x[0] === 'pick').slice(1, 5), ['요일', [['매일', ''], ['월요일부터 금요일만', 'weekdays']], '', 'quietDays']);
  assert.equal(togs(setRow(setRoom({ notices: noticeVal({ schedule: true, weekdays: true }) }), 'notice'))[1][2], '평일 22:00부터 08:00까지는 배너를 띄우지 않습니다');
  assert.equal(togs(setRow(setRoom({ notices: noticeVal({ start: '09:00', end: '09:00' }) }), 'notice'))[1][2], '하루 종일 배너를 띄우지 않습니다');
  assert.equal(setRow(setRoom({ notices: noticeVal({ schedule: true, banners: false }), tipsOff: true }), 'notice').mid, '배너 꺼짐 · 조용한 시간 22:00~08:00 · 구독 팁 꺼짐');
  const rest = setRow(setRoom({ notices: noticeVal({ mutedUntil: NOW + 30 * 60e3 }) }, { restChoice: '30' }), 'notice');
  assert.equal(rest.mid, '10:30까지 배너를 띄우지 않습니다');
  assert.deepEqual(rest.more.find(x => x[1] === '잠시 쉬기').slice(2, 6), [[['30분', '30'], ['1시간', '60'], ['쉬지 않음', '0']], '30', '', 'rest']);
  assert.equal(setRow(setRoom(), 'notice').more.find(x => x[1] === '잠시 쉬기')[3], '0');
  assert.ok(!togs(setRow(setRoom({ tipsOff: null }), 'notice')).some(t => t[4] === 'tips'), 'no tip switch without the subscription settings (a guest)');
  assert.ok(!texts(n).some(t => /새 판이 준비됐을 때/.test(t)), 'the banner is not said to announce a new version (설계 검토 D10)');
  assert.deepEqual(checkQuiet({ quietStart: '7:05', quietEnd: '23:59', quietDays: 'weekdays' }).value, { start: '07:05', end: '23:59', weekdays: true });
  for (const bad of [{ quietStart: '', quietEnd: '08:00' }, { quietStart: '24:00', quietEnd: '08:00' }, { quietStart: '22:00', quietEnd: '8시' }]) assert.equal(checkQuiet(bad).say, '시각은 22:00처럼 넣어 주세요.');
});

test('settings room: the 플레저 PC 알림 words follow what the main process changes and say what stays after turning it off (0.5.0 최종 검수 F4)', () => {
  const careDesc = (desktop, enabled = false) => togs(setRow(setRoom({ desktop, care: { ok: true, available: true, signedIn: true, enabled, hour: 9, minute: 0 } }), 'notice')).find(t => t[1] === '플레저 PC 알림')[2];
  const head = '매일 09:00(한국 시간)에 플레저에 저장한 일정과 챙길 일을 알려 드립니다. 켜면 창을 닫아도 트레이에 남습니다';
  // 자동 시작이 꺼져 있으면 본체가 자동 시작과 트레이로 시작을 함께 켠다
  assert.equal(careDesc(deskSnap()), head + '. 자동 시작도 함께 켜져, 컴퓨터를 켤 때 창 없이 트레이로 켜집니다');
  // 자동 시작이 이미 켜져 있으면 본체가 트레이로 시작을 건드리지 않으므로 「창 없이」라고 하지 않는다
  for (const startHidden of [false, true]) assert.equal(careDesc(deskSnap({ launchAtLogin: true, startHidden })), head, 'startHidden ' + startHidden);
  assert.equal(careDesc(deskSnap({}, { launchAtLogin: false })), head, 'a build without the login item only keeps the tray');
  // 트레이가 없는 PC에는 트레이 말을 하지 않는다(카본 A1)
  assert.equal(careDesc(deskSnap({}, { tray: false })), '매일 09:00(한국 시간)에 플레저에 저장한 일정과 챙길 일을 알려 드립니다. 켜면 자동 시작도 함께 켜져, 컴퓨터를 켤 때 SYNK도 켜집니다');
  assert.equal(careDesc(deskSnap({}, { tray: false, launchAtLogin: false })), '매일 09:00(한국 시간)에 플레저에 저장한 일정과 챙길 일을 알려 드립니다');
  const on = '매일 09:00(한국 시간)에 플레저에 저장한 일정과 챙길 일을 PC 알림으로 알려 드립니다. PC를 끄거나 SYNK를 완전히 종료한 동안에는 받을 수 없습니다';
  assert.equal(careDesc(deskSnap({ launchAtLogin: true, startHidden: true }), true), on + '. 꺼도 「켜고 닫을 때」의 트레이와 자동 시작 설정은 그대로 둡니다');
  assert.equal(careDesc(deskSnap({}, { launchAtLogin: false }), true), on + '. 꺼도 「켜고 닫을 때」의 트레이 설정은 그대로 둡니다');
  assert.equal(careDesc(null, true), on, 'without desktop settings it names none');
});

test('settings room: draft recovery is locked for a guest or without encrypted storage', () => {
  const on = setRow(setRoom(), 'draft');
  assert.deepEqual([on.mid, on.val, on.unread, togs(on)[0].slice(1, 6)], ['창이 갑자기 닫혀도 쓰던 글을 7일 동안 되살립니다', '켜짐', false, ['되살리기', '이 PC에 암호화해 두고, 끄거나 로그아웃하면 지웁니다', true, 'draft', '']]);
  for (const s of [{ member: false }, { drafts: { ok: true, available: false, enabled: true } }, { drafts: { ok: false } }]) {
    const row = setRow(setRoom(s), 'draft');
    assert.deepEqual([row.val, row.unread, togs(row)[0][2], togs(row)[0][3], togs(row)[0][5]], ['꺼짐', true, '로그인하고, 이 PC의 암호화 저장을 쓸 수 있을 때 켤 수 있습니다', false, 'off'], JSON.stringify(s));
  }
  assert.equal(setRow(setRoom({ drafts: null }), 'draft'), undefined);
});

test('tips: each tip type is one line in the 합니다 voice from the model’s numbers only', () => {
  assert.equal(tipWords({ type: 'spike', service: 'higgsfield', ratio: 2.34, s7: 1240 }, NOW), 'Higgsfield를 지난 7일 동안 평소의 2.3배(1,240크레딧) 썼습니다.');
  assert.equal(tipWords({ type: 'spike', service: 'typecast', ratio: null, s7: 5000 }, NOW), 'Typecast를 지난 7일 동안 평소보다 많이(5,000크레딧) 썼습니다.');
  assert.equal(tipWords({ type: 'pace', service: 'gpt', many: true, live: 2, rate: 12 }, NOW), '최근 3일 동안 바로 쓸 계정 2개가 하루 평균 주간 한도의 12%씩 썼습니다.');
  assert.equal(tipWords({ type: 'pass', service: 'claude', mode: 'now', many: true, name: 'work', release: NOW + 2 * D }, NOW), 'work 계정의 초기화권을 쓰면 하루 넘게 기다리지 않고 바로 다시 찹니다.');
  assert.equal(tipWords({ type: 'pass', service: 'gpt', mode: 'expiry', count: 2, until: NOW + 2 * D, hint: { gpt: true, hint: 'reset', reset: NOW + D } }, NOW), 'Codex 초기화권 2장이 모레 오전 10시에 만료됩니다. 지금 쓰면 내일 오전 10시의 주간 초기화가 사라집니다. 초기화 뒤 많이 쓴 다음 만료 전에 쓰는 편이 낫습니다.');
  assert.match(tipWords({ type: 'pass', service: 'claude', mode: 'expiry', many: true, name: 'work', count: 1, until: NOW + 2 * D, hint: { gpt: false, hint: 'used', used: 62 } }, NOW), /^work 계정의 초기화권 1장이 .+ 지금 주간 한도를 62% 썼습니다\. 지금 쓰면 쓴 만큼 다시 채워집니다\.$/);
  assert.equal(tipWords({ type: 'size', service: 'claude', name: 'work', plan: 'max20x', rule: { to: 'max5x', limit: 20 }, saving: 100, table: { currency: 'USD' } }, NOW), 'work 계정(Ultra)은 4주 내내 주간 한도를 20%도 쓰지 않았습니다. Max로 낮춰도 넉넉할 가능성이 큽니다. 공식 요금으로 한 달 $100 덜 냅니다.');
  assert.equal(tipWords({ type: 'idle', service: 'claude', name: 'home', days: 3, billAt: NOW + 3 * D, price: { amount: 29000, currency: 'KRW' } }, NOW), 'home 계정은 4주 동안 주간 한도를 5%도 쓰지 않았습니다. 11월 21일 결제(29,000원) 전에 계속 쓸지 정해 두면 좋습니다.');
  assert.equal(tipWords({ type: 'idle', service: 'typecast', name: '…7890', credit: true, days: 0, billAt: NOW, price: null }, NOW), '…7890 키는 4주 동안 크레딧을 쓰지 않았습니다. 오늘이 결제일입니다. 다음 달에도 쓸지 정해 두면 좋습니다.');
  assert.equal(tipWords({ type: 'annual', service: 'claude' }, NOW), '', 'the annual tip stays in the cost line');
  assert.equal(tipDoneWords('helpful', {}, 'pass:claude'), '도움이 됐다고 남겼습니다. 같은 팁은 7일 동안 쉽니다.');
  assert.equal(tipDoneWords('stop', { tips: { 'pass:claude': { stops: 1 } } }, 'pass:claude'), '이 종류의 팁은 4주 동안 쉽니다.');
  assert.equal(tipDoneWords('stop', { tips: { 'pass:claude': { stops: 2 } } }, 'pass:claude'), '이 종류의 팁은 12주 동안 쉽니다.');
});

test('tips: the model picks the tip, an answered tip stays with its line, a resting one goes, and nothing shows when tips are off', () => {
  const rows = [weekly('w', 'claude', 36, NOW + D, { passCount: 1, passUntil: NOW + 2 * D })];
  const s = snap(rows);
  const tip = subTips(s, setSt(), NOW).get('claude');
  assert.deepEqual([tip.key, tip.done, tip.live, tip.busy], ['pass:claude', false, '', false]);
  assert.match(tip.text, /^Claude 초기화권 1장이 .+에 만료됩니다\./);
  const resting = snap(rows, { settings: { tips: { 'pass:claude': { until: NOW + 7 * D } } } });
  assert.equal(subTips(resting, setSt(), NOW).size, 0, 'a resting tip is not shown');
  const answered = subTips(resting, setSt({ tipDone: new Map([['pass:claude', 'helpful']]), notes: new Map([['svc:claude', '도움이 됐다고 남겼습니다. 같은 팁은 7일 동안 쉽니다.']]) }), NOW).get('claude');
  assert.deepEqual([answered.done, answered.live], [true, '도움이 됐다고 남겼습니다. 같은 팁은 7일 동안 쉽니다.'], 'the tip just answered here stays with the line after it');
  assert.equal(subTips(snap(rows, { settings: { tipsOff: true } }), setSt(), NOW).size, 0);
  assert.equal(subTips(snap(rows, { usage: null }), setSt(), NOW).size, 0, 'no usage, no tip (옛 판과 같다)');
  assert.equal(subTips(s, setSt({ busy: 'svc:claude:tip' }), NOW).get('claude').busy, true);
});

/* ── 화면 글: 합니다체이고, 「GEO」 · 「SEO」 같은 말이 없다(설계 1.3절 「화면 글」) ── */
test('screen words: no 해요체 endings and no GEO or SEO anywhere the room functions write', () => {
  const rows = [
    weekly('a', 'claude', 36, NOW + D, { plan: 'max20x', loginUntil: NOW + 3 * D, passCount: 1, passUntil: NOW + 5 * D, apiCredit: 50, apiCreditUntil: NOW + 6 * D, price: 290000, billDay: 20 }),
    weekly('b', 'gpt', 100, NOW + D, { state: 'needs-login' }), weekly('c', 'gemini', 10, NOW + D, { state: 'elsewhere', price: 10, currency: 'USD' }),
    credit('d', 1240), manual('m', 'Suno', { kind: 'weekly', usedUpAt: NOW - H }),
  ];
  const all = [];
  const s = snap(rows, { prices: PRICES, tools: { claude: { installed: false }, gpt: { installed: true }, gemini: { installed: true }, higgsfield: { installed: false, npm: false } } });
  const allGrps = new Set(rows.flatMap(r => ['cost', 'pass', 'api', 'flow'].map(g => 'a:' + r.id + ':' + g)));
  all.push(...texts(manageRoom(s, st({ grps: allGrps, armed: { key: 'a:a', act: 'remove', at: NOW } }), NOW)));
  all.push(...texts(costRow(s, st(), NOW)));
  all.push(...texts(addItems(s, st(), NOW)));
  for (const svc of ADD_SERVICES) all.push(...texts(addItems(s, st({ add: { svc } }), NOW)));
  for (const stage of ['browser', 'console', 'verifying']) for (const svc of ['claude', 'gpt', 'gemini']) all.push(...texts(addItems({ ...s, tools: { [svc]: { installed: true } }, login: { id: 'l', service: svc, stage, url: 'https://example.com', needsCode: stage === 'browser' } }, st({ add: { svc } }), NOW)));
  all.push(...Object.values(CODE_SAY), DEFAULT_SAY, ...MANAGE_HELP.flat());
  // 모델별 토큰 줄과 내 계정 방(둘째 묶음)
  for (const t of [{ ok: true, enabled: false }, tokOn({ scannedAt: null, scanning: true, progress: { done: 1, total: 2 } }), tokOn({ scannedAt: null, error: 'X' }), tokOn({ failed: 2, error: 'X', live: true, tools: { agy: 1 }, cells: [] }), tokOn({ sinceBy: { gpt: dayKey(2) } })]) all.push(...texts(tokRow(t, tokSt({ armed: { key: 'tok', act: 'tok-off', at: NOW } }), NOW)));
  all.push(...texts(tokRow(tokOn({ cells: Array.from({ length: 8 }, (_, i) => cell(0, 'gpt', 'gpt-6.' + i, 9, 1)) }), tokSt(), NOW)));
  const pend = view({ account: { ...view().account, status: 'deletion-requested' }, dataRequests: [{ kind: 'delete', status: 'pending', request_id: 'r', due_at: new Date(NOW + 7 * D).toISOString() }] });
  for (const acc of [{ loading: true }, { error: ACCOUNT_NETWORK_SAY }, { data: view(), identity: who(), askDelete: true }, { data: pend }, { data: view({ account: { ...view().account, status: 'deletion-requested' } }) }, { data: view({ capabilities: {}, learning: { enabled: false } }), identity: who({ identities: [{ provider: 'google' }], newEmail: 'n@example.com' }) }])
    all.push(...texts(accountRoom(acc, accSt({ armed: { key: 'places', act: 'revoke-all', at: NOW } }), NOW, {})));
  all.push(...Object.values(ACCOUNT_SAY), ACCOUNT_NETWORK_SAY, ACCOUNT_DEFAULT_SAY, checkName('').say, checkName('가'.repeat(61)).say, checkName('\u0007').say);
  // 설정 방과 구독 줄의 팁(셋째 묶음)
  const ups = ['current', 'idle', 'checking', 'available', 'downloading', 'ready', 'opening', 'disabled'].flatMap(state => [{ state, latestVersion: '0.4.98' }, { state, automatic: true }])
    .concat(['UPDATE_EXIT_CANCELLED', 'UPDATE_MANUAL_INSTALL'].map(code => ({ state: 'ready', code })), ['UPDATE_STORAGE_FAILED', 'UPDATE_SAME_VERSION', 'UPDATE_HASH_MISMATCH', 'INSTALL_OPEN_FAILED', 'X'].map(code => ({ state: 'error', code })));
  for (const u of ups) for (const env of [WIN, { ...WIN, platform: 'darwin' }]) all.push(...texts(setRoom({ update: u, env })));
  all.push(...texts(setRoom({ desktop: deskSnap({ globalShortcut: 'Ctrl+Alt+S', launchAtLogin: true, startHidden: true }, {}, { warning: 'SHORTCUT_UNAVAILABLE' }), notices: noticeVal({ mutedUntil: NOW + H, schedule: true, weekdays: true }), member: false, tipsOff: true }, { grps: new Set(['notice:quiet']) })));
  all.push(...Object.values(SHORTCUT_SAY), ...Object.values(DIAG_SAY), DRAFT_SAY, desktopSay('X'), checkQuiet({}).say);
  for (const t of [{ type: 'spike', service: 'higgsfield', ratio: 2, s7: 3 }, { type: 'pace', service: 'gpt', many: true, live: 2, rate: 3 }, { type: 'pass', service: 'claude', mode: 'now', release: NOW + D }, ...['reset', 'used', 'later'].flatMap(hint => [true, false].map(gpt => ({ type: 'pass', service: gpt ? 'gpt' : 'claude', mode: 'expiry', count: 1, until: NOW + D, hint: { gpt, hint, reset: NOW + H, used: 60 } }))), { type: 'size', service: 'claude', name: 'w', plan: 'max5x', rule: { to: 'pro', limit: 16 }, saving: 80 }, { type: 'idle', service: 'claude', name: 'w', days: 0, billAt: NOW }, { type: 'idle', service: 'typecast', name: 'k', credit: true, days: 2, billAt: NOW + 2 * D, price: { amount: 10, currency: 'USD' } }])
    all.push(tipWords(t, NOW));
  all.push(tipDoneWords('helpful', {}, 'k'), tipDoneWords('stop', {}, 'k'));
  const sentences = all.flatMap(t => t.split(/(?<=[.!?])\s+/));
  // 해요체는 「…요」로 끝난다. 지워요 · 봐요 같은 모음 축약형과 -까요 · -나요 · -네요 · -세요 같은 물음과 권유를 함께 잡는다(화면 검수 F2).
  // 「…해 주세요」는 설계 1.3절의 합니다체 화면 글(「잠시 뒤 다시 해 주세요.」)이 쓰는 부탁 꼴이라 뺀다
  const isYo = x => /요[.!?]?$/.test(x.trim()) && !/주세요[.!?]?$/.test(x.trim());
  for (const t of ['지워요.', '봐요', '바꿔요.', '할까요?', '되나요?', '좋네요.', '누르세요.', '무엇을 더할까요']) assert.ok(isYo(t), t);
  assert.ok(!isYo('잠시 뒤 다시 해 주세요.') && !isYo('지웠습니다.') && !isYo('요청하시겠습니까?'));
  const yo = sentences.filter(isYo);
  assert.deepEqual(yo, [], 'every sentence ends in 합니다체');
  assert.ok(!all.some(t => /\bGEO\b|\bSEO\b/.test(t)));
  assert.ok(all.length > 200, 'the check saw the room words (' + all.length + ')');
});

test('a Gemini family account with its own price keeps that price in the grouped bill row, as the total and the due row do (0.5.0 공개 후보 카본 E2)', () => {
  const tomorrow = new Date(NOW + D).getDate();
  const fam = { ...weekly('fam', 'gemini', 20, NOW + 3 * D), plan: 'family', price: 30000, currency: 'KRW', billDay: tomorrow };
  const shared = { ...weekly('shared', 'gemini', 20, NOW + 3 * D), plan: 'family', billDay: tomorrow };
  const own = costRow(snap([fam]), st(), NOW);
  assert.equal(own.mid.split(' · ')[0], '한 달 30,000원');
  const group = own.more.find(x => x[0] === 'row' && !x[5]);
  assert.deepEqual([group[1], group[3]], ['Gemini 가족 공유', '30,000원']);
  assert.equal(own.more.find(x => x[0] === 'row' && x[5])[3], '30,000원');
  // 요금을 넣지 않은 가족 공유 계정은 전처럼 「가족 공유」다
  const none = costRow(snap([shared]), st(), NOW).more.find(x => x[0] === 'row' && !x[5]);
  assert.equal(none[3], '가족 공유');
});
