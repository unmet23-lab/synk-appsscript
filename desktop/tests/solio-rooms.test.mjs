// 솔리오 안쪽의 나머지(2단계 둘째 조각) 자료 함수 시험. 설계: docs/디자인/플랫폼_클라이언트_검정구_20261116/2단계_둘째조각_구현설계.md 12.1절.
// 요금 줄, 계정 관리 방(계정 줄 · 사실 줄 · 고치는 칸 · 계정 더하기 · 막혔을 때), 입력 검사, 화면 글의 말투를 본다. 메일은 모두 example.com이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CODE_SAY, DEFAULT_SAY, codeSay, costRow, manageRoom, addItems, manageOpenKey, checkBillDay, parsePass, parseApi, parseFlow, parseCost, parseManual, checkCode, checkKey, checkEmail, checkRate, readWord, MANAGE_HELP, ADD_SERVICES, tokRow, TOK_SHOWN, accountRoom, accountSay, checkName, ACCOUNT_SAY, ACCOUNT_NETWORK_SAY, ACCOUNT_DEFAULT_SAY, SESSIONS_SHOWN } from '../renderer/solio-rooms.mjs';
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
  assert.equal(row.mid, '한 달 435,000원 · 7일 안 결제 1건 · 요금을 모르는 1개 빼고');
  assert.equal(row.when, '다음 결제 11월 20일 Claude');
  assert.equal(row.more[0][1], '한 달에 435,000원을 냅니다. 7일 안에 Claude가 결제됩니다.');
  const bills = kinds(row.more, 'row').filter(r => /월 \d+일$/.test(r[1]));
  assert.deepEqual(bills.map(b => [b[1], b[2], b[3], b[4], b[5]]), [['11월 20일', 'Claude · w', '290,000원', '2일 뒤', true], ['11월 30일', 'Codex · g', '145,000원', '', false]]);
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
  const official = bills.find(b => b[2] === 'Claude · o'), family = bills.find(b => b[2] === 'Gemini · f'), annual = bills.find(b => b[2] === 'Claude · y');
  assert.equal(official[4], '공식 요금');
  assert.equal(family[3], '가족 공유');
  assert.deepEqual([annual[1], annual[3], annual[4]], ['연간 결제', '$20', ''], 'annual billing is not called due this month');
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
  assert.deepEqual(facts, [
    ['로그인', '기한 전에 다시 로그인하면 끊기지 않습니다', '', '11월 21일까지', true],
    ['초기화권', '주간 한도를 한 번 다시 채웁니다', '2장', '11월 23일까지', undefined],
    ['API 크레딧', '구독에 함께 들어 있는 API 사용 금액입니다', '$50', '11월 24일에 사라짐', undefined],
  ]);
  assert.deepEqual(kinds(more, 'row')[1][4].btn, ['고치기', 'grp', 'pass', 'on']);
  const grps = Object.fromEntries(kinds(more, 'grp').map(g => [g[1], g[3]]));
  assert.deepEqual(grps, { pass: false, api: true, cost: true }, 'only the group that was opened shows');
  assert.ok(actsOf(more).some(a => a[1] === 'pass-used' && a[0] === '1장 썼습니다'));
  const gpt = manageRoom(snap([weekly('g', 'gpt', 10, NOW + D, { plan: 'plus', live: { readAt: NOW, weekly: { usedPercent: 10, resetsAt: NOW + D }, resets: { count: 0 } } })]), st(), NOW).rows[1].more;
  assert.deepEqual(kinds(gpt, 'row').map(r => [r[1], r[2], r[3]]), [['초기화권', 'Codex가 알려 준 값입니다', '없음']]);
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
  assert.deepEqual(labels('e'), ['다시 로그인', '이 계정 다시 읽기', '요금과 결제일', '지우기']);
  assert.deepEqual(labels('t'), ['키 다시 넣기', '요금과 결제일', '지우기']);
  assert.deepEqual(labels('a'), ['이 계정으로 바꾸기', '요금과 결제일', '지우기']);
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
  assert.deepEqual(pick[0].slice(0, 2), ['pick', '무엇을 더할까요']);
  assert.deepEqual(pick[0][2].map(p => p[1]), ADD_SERVICES);
  assert.equal(pick[1][1], '고르면 그 자리에서 차례대로 안내합니다. 연결하면 바로 한 번 읽습니다.');
  const missing = add('claude', { tools: { claude: { installed: false } }, platform: 'win32' });
  assert.deepEqual(kinds(missing, 'row').map(r => r[1]), ['1 요금제', '2 설치', '3 로그인']);
  assert.ok(kinds(missing, 'cmd').length === 1, 'the install command can be pasted by hand');
  assert.deepEqual(actsOf(missing).filter(a => a[1] === 'install' || a[1] === 'recheck-tools').map(a => a[0]), ['설치 창 열기']);
  assert.deepEqual(actsOf(add('claude', { tools: { claude: { installed: false } } }, { installing: new Set(['claude']) })).filter(a => a[1] === 'recheck-tools').map(a => a[0]), ['설치가 끝났습니다 · 다시 확인']);
  const mac = add('claude', { tools: { claude: { installed: false } }, platform: 'darwin' });
  assert.equal(kinds(mac, 'cmd').length, 0, 'the PowerShell command is not offered on a Mac');
  const node = add('higgsfield', { tools: { higgsfield: { installed: false, npm: false } } });
  assert.ok(kinds(node, 'note').some(n => n[1] === 'Higgsfield CLI는 Node.js가 먼저 있어야 합니다.'));
  const ready = add('claude', { tools: { claude: { installed: true, version: '2.1.3 (Claude Code)' } } });
  assert.equal(kinds(ready, 'row')[1][2], '이 PC에 설치되어 있습니다 · 2.1.3');
  assert.ok(kinds(ready, 'fld').some(f => f[4] === 'email' && f[5] === 'email'));
  assert.deepEqual(actsOf(ready).filter(a => a[1] === 'login' || a[1] === 'existing').map(a => a[0]), ['새 계정 연결', '이 PC의 기존 로그인 쓰기']);
  const gem = add('gemini', { tools: { gemini: { installed: true } } });
  assert.deepEqual(actsOf(gem).filter(a => a[1] === 'login' || a[1] === 'existing').map(a => a[0]), ['Gemini 로그인']);
  const busy = add('claude', { tools: { claude: { installed: true } }, login: { id: 'l', service: 'gpt', stage: 'browser' } });
  assert.ok(kinds(busy, 'note').some(n => n[1] === '다른 서비스의 로그인이 진행 중입니다. 끝난 뒤 이어서 해 주세요.'));
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
  assert.match(notes, /이 줄을 열어 두면 답이 끝날 때마다 숫자를 더합니다\./);
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
  assert.equal(box[1], '계정 삭제를 요청할까요?');
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
  const sentences = all.flatMap(t => t.split(/(?<=[.!?])\s+/));
  const yo = sentences.filter(x => /(어요|아요|해요|예요|에요|돼요)[.!?]?$/.test(x.trim()));
  assert.deepEqual(yo, [], 'every sentence ends in 합니다체');
  assert.ok(!all.some(t => /\bGEO\b|\bSEO\b/.test(t)));
  assert.ok(all.length > 200, 'the check saw the room words (' + all.length + ')');
});
