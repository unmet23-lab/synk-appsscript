// 솔리오 구독 방의 비서 판(docs/디자인/솔리오_구독비서_20261120/설계.md 3절 · 7절). 구독 스냅숏은 합성이다.
// 공개 저장소라 계정 이름은 지어낸 것만 쓴다. 숫자의 모양은 11-20 유호님 PC 자료(계정 열 개 가운데 일곱이 다 씀)를 본떴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { solioBrief, briefHead, briefSoon, briefDiag, briefDial, briefGroups, poolRunout, poolSay, dailyDiag, diagWhen, briefLive, tokSample, recentOut, soonWhen, SOON_SHOWN, RECENT_MS, DIAL_MS } from '../renderer/solio-brief.mjs';
import { solioToday } from '../renderer/solio-today.mjs';

const D = 864e5, H = 3600e3, W = 7 * D;
const NOW = new Date(2026, 10, 20, 3, 0).getTime(); // 2026-11-20(금) 03:00
let serial = 0;
const row = extra => ({ id: 'r' + (++serial), service: 'claude', source: 'auto', label: 'Claude', kind: 'weekly', state: 'ok', plan: 'max_20x', email: 'acct' + serial + '@example.com', price: null, currency: 'KRW', billDay: null, ...extra });
const weekly = (service, used, resetsAt, extra = {}) => row({ service, label: service, live: { readAt: NOW - 5 * 60e3, weekly: { usedPercent: used, resetsAt } }, ...extra });
const PRICES = { services: { claude: { checked: '2026-11-01', currency: 'USD', krVat: 0.1, plans: { pro: { month: 20, year: 200 }, max5x: { month: 100 }, max20x: { month: 200 } } } } };
const snap = (rows, stats = {}, { checkAt = NOW - 5 * 60e3, goal = null, prices = PRICES } = {}) => ({
  ok: true, rows, check: { at: checkAt }, prices, settings: { usdKrw: 1400, ...(goal ? { goal } : {}) },
  usage: { accounts: Object.fromEntries(Object.entries(stats).map(([id, s]) => [id, typeof s === 'number' ? { rate3: s } : s])) },
});
const brief = (s, now = NOW) => solioBrief({ today: solioToday({ snapshot: s }, now), snapshot: s }, now);
const sentences = text => (String(text).match(/[^.]+\./g) || []).length;

/* 유호님 모양: 열 계정 가운데 일곱이 다 썼고 셋이 남았다. 서비스 전체가 하루 계정 세 개 몫(300%p)을 쓴다 */
function sevenOfTen() {
  const out = [6, 40, 52, 58, 76, 110, 130].map((h, i) => weekly('claude', 100, NOW + h * H, { email: 'out' + i + '@example.com' }));
  const left = [weekly('claude', 0, NOW + 5 * D, { email: 'fresh1@example.com' }), weekly('claude', 1, NOW + 6 * D, { email: 'fresh2@example.com' }), weekly('claude', 0, NOW + 6 * D + 5 * H, { email: 'fresh3@example.com' })];
  const rows = [...out, ...left], stats = {};
  for (const r of rows) stats[r.id] = 30;
  return { rows, out, left, stats };
}

test('the whole pool runs out before the next account opens: said first, with how long it stays shut (설계 검토 D1)', () => {
  const { rows, out, stats } = sevenOfTen();
  const s = snap(rows, stats), g = briefGroups(s, NOW)[0];
  const r = poolRunout(s, g, NOW);
  // 남은 299%를 시간당 12.5%p로: 6시간 뒤 224가 남고 하나가 열려 324, 그 뒤 약 26시간 → 40시간 뒤 다음 계정이 열리기 전에 모두 막힌다
  assert.ok(r && !r.beyond);
  assert.ok(r.at > NOW + 31 * H && r.at < NOW + 33 * H, 'runs out about eight hours before the next account opens');
  assert.equal(r.next.a.row.id, out[1].id);
  assert.equal(Math.round(r.perWeek), 21);
  const b = brief(s);
  assert.match(b.head.say, /^지금 속도면 Claude는 (토요일|내일) .+쯤 모두 막힙니다\.$/);
  assert.match(b.head.then, /에 out1이 다시 열릴 때까지 \d+시간쯤 막힙니다\.$/);
  assert.ok(sentences(b.head.say) === 1 && sentences(b.head.then) <= 1, 'the top is two sentences at most (설계 4절)');
  // 맨 위가 말한 계정은 다가오는 일에서 뺀다
  assert.ok(!b.soon.all.some(i => i.text.includes('out1')));
  assert.ok(b.soon.all.some(i => i.text === 'Claude out0이 다시 열립니다'));
});

test('the old next-run formula used only the accounts left, so the pool must use every account of the service', () => {
  const { rows, stats, left } = sevenOfTen();
  // 남은 셋은 막 열려 속도가 거의 0이다. 그 셋만 보면 일주일 넘게 가는 것으로 나온다
  for (const r of left) stats[r.id] = 0;
  const s = snap(rows, stats), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  assert.ok(r && !r.beyond, 'the seven used-up accounts still carry the pace');
});

test('a pool that lasts past the week says how many are used up, never 「넉넉」 (설계 4절 1, 설계 검토 D5)', () => {
  const { rows, stats } = sevenOfTen();
  for (const id of Object.keys(stats)) stats[id] = 2;
  const s = snap(rows, stats), b = brief(s);
  assert.equal(b.head.say, 'Claude 10개 가운데 7개를 다 썼습니다.');
  assert.equal(b.head.then, '지금 속도면 이번 주는 모두 막히지는 않습니다.');
  const today = solioToday({ snapshot: s }, NOW), claude = today.rows.find(x => x.name === 'Claude');
  // 줄도 가장 좋은 계정 하나가 아니라 합친 몫이다(「100% 남음」이 일곱 개 다 쓴 것을 가렸다)
  assert.deepEqual([claude.sub, claude.val], ['계정 10개 · 7개 다 씀', '합쳐서 29% 남음']);
  assert.match(claude.when, /에 out0 열림$/);
  assert.ok(!/넉넉/.test(b.says.claude || ''), 'the row inside does not say plenty');
  assert.equal(b.says.claude, 'Claude 10개 가운데 7개를 다 썼습니다. 지금 속도면 이번 주는 모두 막히지는 않습니다.');
});

test('every account shut: says so and when the first opens; a 5-hour block is 「막혀 있습니다」', () => {
  const a = weekly('gpt', 100, NOW + 30 * H, { plan: 'pro', email: 'alpha@example.com' }), b = weekly('gpt', 100, NOW + 50 * H, { plan: 'pro', email: 'beta@example.com' });
  let s = snap([a, b], { [a.id]: 30, [b.id]: 30 });
  assert.equal(brief(s).head.say, 'Codex는 지금 모든 계정을 다 썼습니다.');
  assert.equal(brief(s).head.then, '내일 오전 9시에 alpha가 먼저 다시 열립니다.');
  // 5시간 한도로 막힌 계정이 섞이면 「막혀 있습니다」다. 조사도 동사에 맞춘다(화면 검수 r2 A6 · B4)
  const c = row({ service: 'gpt', label: 'gpt', plan: 'pro', email: 'gamma@example.com', live: { readAt: NOW - 5 * 60e3, session: { usedPercent: 100, resetsAt: NOW + 2 * H }, weekly: { usedPercent: 40, resetsAt: NOW + 4 * D } } });
  s = snap([a, c], { [a.id]: 30, [c.id]: 30 });
  assert.equal(brief(s).head.say, 'Codex는 지금 모든 계정이 막혀 있습니다.');
  assert.match(brief(s).says.gpt, /^Codex는 지금 모든 계정이 막혀 있습니다\. /);
  const one = weekly('gemini', 100, NOW + 4 * H, { plan: 'ultra_20x' });
  s = snap([one], { [one.id]: 5 });
  assert.equal(brief(s).head.say, 'Gemini는 이번 주 한도를 다 썼습니다.');
  assert.equal(brief(s).head.then, '오늘 오전 7시에 다시 열립니다.');
});

test('an account that resets refills to 100%, not only by what it had used; the soonest reset is used first (화면 검수 A1)', () => {
  // 90% 남은 계정 하나가 20시간 뒤 초기화되고 하루 60%를 쓴다: 20시간에 50%를 써 40%가 남고, 초기화로 100%가 된 뒤 40시간 더 간다
  const a = weekly('claude', 10, NOW + 20 * H, { plan: 'pro' });
  const s = snap([a], { [a.id]: 60 }), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  assert.ok(Math.abs(r.at - (NOW + 60 * H)) < 60e3, 'runs out about 60 hours from now');
});

test('a 5-hour block opens to its weekly share, and its weekly reset refills it later (화면 검수 A2)', () => {
  // A: 20% 남음(초기화 5일 뒤). B: 주간 10%가 남은 채 5시간 한도에 막혀 1시간 뒤 풀리고, 12시간 뒤 주간 초기화. 둘이 합쳐 시간당 2%를 쓴다
  const a = weekly('claude', 80, NOW + 5 * D, { plan: 'pro' });
  const b = row({ plan: 'pro', live: { readAt: NOW - 5 * 60e3, session: { usedPercent: 100, resetsAt: NOW + H }, weekly: { usedPercent: 90, resetsAt: NOW + 12 * H } } });
  const s = snap([a, b], { [a.id]: 24, [b.id]: 24 }), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  // 12시간째 B가 100%로 차므로 65시간째에야 모두 막힌다. 주간 초기화를 놓치면 15시간째에 막힌다고 했다
  assert.ok(Math.abs(r.at - (NOW + 65 * H)) < 60e3, 'counts the weekly reset of the 5-hour-blocked account');
  assert.equal(r.next.type, 'reset');
  assert.equal(r.next.a.row.id, a.id);
});

test('Max 20x with Pro mixed: no 「n개 몫」 against a headcount and no 「남음」 by headcount (화면 검수 A3)', () => {
  const big = weekly('claude', 100, NOW + 2 * D, { plan: 'max_20x' }), pros = [0, 1, 2].map(() => weekly('claude', 100, NOW + 2 * D, { plan: 'pro' }));
  const rows = [big, ...pros], stats = {};
  for (const r of rows) stats[r.id] = { rate3: 30, weeks4: { ...fourWeeks(95), windows: windowsOf([true, true, true, true]) } };
  const d = briefDiag(snap(rows, stats), briefGroups(snap(rows, stats), NOW), NOW).items[0];
  assert.equal(d.word, '모자람');
  assert.doesNotMatch(d.more, /개 몫/);
  const quiet = {};
  for (const r of rows) quiet[r.id] = { rate3: 1, weeks4: { ...fourWeeks(5), windows: windowsOf([false, false, false, false]) } };
  assert.notEqual(briefDiag(snap(rows, quiet), briefGroups(snap(rows, quiet), NOW), NOW).items[0].word, '남음');
});

test('used-up accounts with one to log in again: the top says the login, never 「모든 계정」 (Fable 최종 F1)', () => {
  const used = weekly('claude', 100, NOW + 30 * H, { email: 'used@example.com' }), gone = row({ email: 'gone@example.com', state: 'needs-login' });
  const s = snap([used, gone], { [used.id]: 30 }), b = brief(s);
  assert.equal(b.head.say, 'Claude 2개 가운데 1개를 다 썼고 1개는 다시 로그인해야 합니다.');
  assert.equal(b.head.then, '계정 관리에서 다시 로그인합니다.');
  assert.equal(b.says.claude, 'Claude 2개 가운데 1개를 다 썼고 1개는 다시 로그인해야 합니다.');
  const lab = row({ email: 'lab@example.com', state: 'error' });
  const both = snap([used, gone, lab], { [used.id]: 30 });
  assert.equal(brief(both).head.say, 'Claude 3개 가운데 1개를 다 썼고 1개는 다시 로그인해야 하고 1개는 읽지 못했습니다.');
  assert.ok(!/모든 계정/.test(brief(both).head.say));
});

test('only manual subscriptions: nothing to fold, the rows stay in sight (Fable 최종 F4)', () => {
  const m = row({ source: 'manual', service: 'grokultra', kind: 'weekly', label: 'Grok Ultra', price: 295000, resetDay: 1, resetHour: 9 });
  const s = snap([m], {});
  assert.equal(solioBrief({ today: solioToday({ snapshot: s }, NOW), snapshot: s }, NOW), null);
});

test('a rescan in the middle keeps the last ten minutes; only the very first count starts over (Fable 최종 F3)', () => {
  const day = '2026-11-20', cells = out => [[day, 'claude', 'claude-opus-5-5', 0, out, 0, 0, 0, 1]];
  let prev = { enabled: true, scannedAt: NOW - H, cells: cells(1000) }, samples = tokSample([], prev, null, NOW);
  for (let k = 1; k <= 14; k++) { const t = { ...prev, cells: cells(1000 + k * 10) }; samples = tokSample(samples, t, prev, NOW + k * 60e3); prev = t; }
  assert.equal(recentOut(samples, NOW + 14 * 60e3).delta, 100);
  const scanning = { ...prev, scanning: true };
  samples = tokSample(samples, scanning, prev, NOW + 14.5 * 60e3);
  const done = { ...prev, scanning: false, scannedAt: NOW + 15 * 60e3, cells: cells(1150) };
  samples = tokSample(samples, done, scanning, NOW + 15 * 60e3);
  assert.equal(recentOut(samples, NOW + 15 * 60e3).partial, false, 'still ten minutes deep after the rescan');
  assert.equal(briefLive(done, samples, NOW + 15 * 60e3).small.startsWith('최근 10분 '), true);
  const first = { enabled: true, scanning: true, scannedAt: null, cells: cells(5) };
  assert.equal(tokSample(samples, first, done, NOW + 16 * 60e3).length, 1, 'the very first count starts over');
});

test('running dry exactly when another account opens is not a block (GPT 검수 GA2)', () => {
  // 남은 25%를 하루 25%씩 쓰고 다른 계정이 정확히 하루 뒤 열린다
  const a = weekly('claude', 75, NOW + 5 * D, { plan: 'pro' }), b = weekly('claude', 100, NOW + D, { plan: 'pro' });
  const s = snap([a, b], { [a.id]: 25, [b.id]: 0 }), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  assert.ok(!r || r.at > NOW + D, 'no zero-length block at the reopening');
  assert.ok(!briefSoon(s, briefGroups(s, NOW), NOW, []).all.some(i => i.key === 'runout:claude' && Math.abs(i.at - (NOW + D)) < 60e3));
});

test('the pace weighs each use by the plan of its time when the main process gives it (GPT 검수 GA3)', () => {
  const a = weekly('claude', 50, NOW + 5 * D, { plan: 'max_20x' });
  // rate3(지금 요금제 %)를 그대로 무게 20으로 곱하면 하루 2,000이지만, 그때 요금제로 센 값은 하루 400이다
  const s = snap([a], { [a.id]: { rate3: 100, rate3w: 400 } }), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  assert.ok(Math.abs(r.at - (NOW + (50 * 20 / 400) * D)) < 60e3);
});

test('Codex Pro used up and Plus full is not 「합쳐서 50% 남음」 (GPT 검수 GA5)', () => {
  const pro = weekly('gpt', 100, NOW + 2 * D, { plan: 'pro' }), plus = weekly('gpt', 0, NOW + 5 * D, { plan: 'plus' });
  const row0 = solioToday({ snapshot: snap([pro, plus], { [pro.id]: 5, [plus.id]: 5 }) }, NOW).rows.find(r => r.name === 'Codex');
  assert.doesNotMatch(row0.val, /합쳐서/);
});

test('a window whose 100% was first read just before reset, with the read before days earlier, is left out (GPT 검수 GA6)', () => {
  const rows = [0, 1].map(() => weekly('claude', 10, NOW + 3 * D));
  const sure = { end: NOW - W, hit: true, early: 0.1 * D, earlyMax: 0.2 * D, known: true, closed: true };
  const unsure = { end: NOW - 2 * W, hit: true, early: 0.05 * D, earlyMax: 3 * D, known: true, closed: true };
  const stats = Object.fromEntries(rows.map(r => [r.id, { rate3: 5, weeks4: { ...fourWeeks(60), windows: [unsure, sure, sure] } }]));
  const d = briefDiag(snap(rows, stats), briefGroups(snap(rows, stats), NOW), NOW).items[0];
  assert.match(d.say, /주간 한도 4번/, 'the two unsure windows are not counted');
});

test('a 5-hour peak at the limit keeps 「남음」 away even when the week was quiet (GPT 검수 GA8)', () => {
  const a = weekly('claude', 5, NOW + 3 * D, { plan: 'pro' });
  const stats = { [a.id]: { rate3: 1, weeks4: { ...fourWeeks(8), hPeak: 100, windows: windowsOf([false, false, false, false]) } } };
  assert.notEqual(briefDiag(snap([a], stats), briefGroups(snap([a], stats), NOW), NOW).items[0].word, '남음');
});

test('credits: the 4-week pace is said as a month, and only with every account counted (GPT 검수 GA9 · GA10)', () => {
  const cr = (id, plan, extra = {}) => row({ id, service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan, live: { readAt: NOW - 60e3, credits: 500, planCredits: 1000 }, ...extra });
  const one = cr('c1', 'plus');
  const used = n => ({ cover: true, known: true, weeks: [0, 1, 2, 3].map(() => ({ used: n / 4, peak: null, reads: 4 })) });
  let d = briefDiag(snap([one], { c1: { weeks4: used(850) } }), briefGroups(snap([one], { c1: { weeks4: used(850) } }), NOW), NOW).items[0];
  assert.equal(d.say, '지금 속도면 한 달에 크레딧의 92%를 씁니다.');
  const two = cr('c2', 'plus');
  const s = snap([one, two], { c1: { weeks4: used(40) } });
  d = briefDiag(s, briefGroups(s, NOW), NOW).items[0];
  assert.equal(d.word, '아직 모름', 'one account without a full record keeps the whole service undecided');
});

test('one more account costs the official price, not an account’s own discounted price (GPT 검수 GA11)', () => {
  const rows = [0, 1].map(() => weekly('claude', 100, NOW + 2 * D, { price: 120000, currency: 'KRW' }));
  const stats = Object.fromEntries(rows.map(r => [r.id, { rate3: 40, weeks4: { ...fourWeeks(120, 100), windows: windowsOf([true, true, true, true]) } }]));
  const d = briefDiag(snap(rows, stats), briefGroups(snap(rows, stats), NOW), NOW).items[0];
  assert.match(d.more, /월 약 308,000원/);
});

test('the monthly total follows today’s rate even inside the day-long diagnosis (GPT 검수 GA12)', () => {
  const a = weekly('claude', 10, NOW + 3 * D, { price: 200, currency: 'USD' });
  const s1 = snap([a], { [a.id]: 1 }), b1 = brief(s1);
  const s2 = { ...s1, settings: { ...s1.settings, usdKrw: 1600 } };
  const b2 = solioBrief({ today: solioToday({ snapshot: s2 }, NOW), snapshot: s2, memo: b1.memo }, NOW);
  assert.notEqual(b1.diag.cost, b2.diag.cost);
  assert.match(b2.diag.cost, /320,000원/);
});

test('an API credit that disappears on the bill day is said with the bill (GPT 검수 GA13)', () => {
  const a = weekly('claude', 10, NOW + 5 * D, { plan: 'max_20x', billDay: 21, apiCredit: 30, apiCreditUntil: new Date(2026, 10, 21).getTime() });
  const s = snap([a], { [a.id]: 1 }), soon = briefSoon(s, briefGroups(s, NOW), NOW, []);
  assert.ok(soon.all.some(i => /API 크레딧 \$30가 사라집니다/.test(i.text)), JSON.stringify(soon.all));
});

test('a quiet stretch keeps its last value as the ten-minute baseline (GPT 검수 GA14)', () => {
  const day = '2026-11-20', cells = out => [[day, 'claude', 'claude-opus-5-5', 0, out, 0, 0, 0, 1]];
  const t0 = { enabled: true, scannedAt: NOW - H, cells: cells(100) };
  let samples = tokSample([], t0, null, NOW);
  const t1 = { ...t0, cells: cells(200) };
  samples = tokSample(samples, t1, t0, NOW + 20 * 60e3);
  const t2 = { ...t0, cells: cells(210) };
  samples = tokSample(samples, t2, t1, NOW + 21 * 60e3);
  assert.equal(recentOut(samples, NOW + 21 * 60e3).delta, 110);
});

test('Codex with Pro and Plus mixed has no common unit, so no pool forecast (설계 검토 D4)', () => {
  const pro = weekly('gpt', 10, NOW + 5 * D, { plan: 'pro' }), plus = weekly('gpt', 100, NOW + 3 * D, { plan: 'plus' });
  const s = snap([pro, plus], { [pro.id]: 30, [plus.id]: 20 });
  assert.equal(poolRunout(s, briefGroups(s, NOW)[0], NOW), null);
  // 기록이 3일 안 된 계정이 있어도 말하지 않는다
  const a = weekly('claude', 10, NOW + 5 * D), b = weekly('claude', 100, NOW + 2 * D);
  const young = snap([a, b], { [a.id]: 30 });
  assert.equal(poolRunout(young, briefGroups(young, NOW)[0], NOW), null);
});

test('an account to use first, a login to fix, and a bill tomorrow each take the top in that order', () => {
  // 오늘은 이 계정부터: 24시간 안에 초기화되는데 20% 넘게 남음
  const soon = weekly('claude', 30, NOW + 9 * H, { email: 'soon@example.com' }), other = weekly('claude', 10, NOW + 5 * D);
  let s = snap([soon, other], { [soon.id]: 5, [other.id]: 5 });
  let b = brief(s);
  assert.equal(b.head.say, '오늘은 Claude soon부터 쓰세요.');
  assert.equal(b.head.then, '오늘 오후 12시에 초기화되는데 70%가 남았습니다.');
  assert.ok(!b.soon.all.some(i => i.text.includes('soon')), 'the account named on top is not repeated');
  // 다시 로그인할 계정이 있으면 그것이 먼저다
  const gone = row({ email: 'gone@example.com', state: 'needs-login' });
  s = snap([soon, other, gone], { [soon.id]: 5, [other.id]: 5 });
  b = brief(s);
  assert.equal(b.head.say, 'Claude gone 계정은 다시 로그인해야 합니다.');
  assert.equal(b.head.then, '계정 관리에서 다시 로그인합니다.');
  // 넉넉하고 급한 일이 없을 때 내일 결제가 있으면 그것을 말한다
  const calm = weekly('claude', 10, NOW + 5 * D, { billDay: 21 });
  s = snap([calm], { [calm.id]: 5 });
  b = brief(s);
  assert.equal(b.head.say, '내일 Claude 결제가 있습니다.');
  assert.equal(b.head.then, '모두 약 308,000원입니다.');
});

test('nothing urgent: with used-up accounts it never says plenty; with none it keeps the old sentence that has the proof', () => {
  const used = weekly('claude', 100, NOW + 3 * D, { email: 'used@example.com' }), a = weekly('claude', 5, NOW + 5 * D), c = weekly('claude', 5, NOW + 5 * D, { email: 'c@example.com' });
  let s = snap([used, a, c], { [used.id]: 1, [a.id]: 1, [c.id]: 1 });
  let b = brief(s);
  assert.equal(b.head.say, '지금은 급한 일이 없습니다.');
  // 문장 전체를 본다(화면 검수 r2 B3)
  assert.equal(b.head.then, '가장 먼저 월요일 새벽 3시에 Claude used가 다시 열립니다.');
  const x = weekly('claude', 5, NOW + 5 * D);
  s = snap([x], { [x.id]: 1 });
  b = brief(s);
  assert.equal(b.head.say, '이번 주는 모든 구독이 넉넉합니다.');
});

test('coming up: 48 hours only, three on the first screen, bills of one service on one day in one line, the bill without a clock (설계 3.2, D6, D11)', () => {
  const rows = [
    weekly('claude', 100, NOW + 2 * H, { email: 'one@example.com' }),
    weekly('claude', 100, NOW + 20 * H, { email: 'two@example.com' }),
    weekly('claude', 100, NOW + 30 * H, { email: 'three@example.com' }),
    weekly('claude', 100, NOW + 60 * H, { email: 'late@example.com' }),
    weekly('claude', 5, NOW + 5 * D, { email: 'ok1@example.com', billDay: 22 }),
    weekly('claude', 5, NOW + 5 * D, { email: 'ok2@example.com', billDay: 22 }),
    weekly('claude', 5, NOW + 5 * D, { email: 'ok3@example.com', billDay: 22 }),
  ];
  const s = snap(rows, {}), groups = briefGroups(s, NOW), soon = briefSoon(s, groups, NOW, []);
  assert.ok(soon.all.every(i => i.at <= NOW + 48 * H));
  assert.ok(!soon.all.some(i => i.text.includes('late')), 'past 48 hours is left out');
  const bill = soon.all.find(i => /결제/.test(i.text));
  assert.equal(bill.text, 'Claude 결제 3건 · 약 924,000원');
  assert.equal(bill.when, '모레', 'a bill has a day, not 00:00');
  assert.equal(soon.shown.length, SOON_SHOWN);
  assert.equal(soon.more, soon.all.length - SOON_SHOWN);
});

test('coming up: an account away from this PC is left out, and 「먼저 쓰세요」 only for the account the group picked', () => {
  const away = weekly('gemini', 10, NOW + 10 * H, { plan: 'ultra_20x', state: 'elsewhere', email: 'away@example.com' });
  const here = weekly('gemini', 50, NOW + 30 * H, { plan: 'ultra_20x', email: 'here@example.com' });
  const s = snap([away, here], { [away.id]: 1, [here.id]: 1 }), soon = briefSoon(s, briefGroups(s, NOW), NOW, []);
  assert.ok(!soon.all.some(i => i.text.includes('away')));
  const r = soon.all.find(i => i.text.includes('here'));
  assert.equal(r.text, 'Gemini here가 초기화됩니다 · 남은 50%가 사라집니다', 'not the pick of today (resets after 24 hours)');
  assert.equal(soonWhen(NOW + 30 * H, NOW), '내일 09:00');
  assert.equal(soonWhen(NOW + 3 * D, NOW), '월요일 03:00');
});

/* 4주 기록: 계정마다 주간 창 넷. early는 초기화까지 남았던 때 */
const windowsOf = (hits, earlyDays = 3) => hits.map((hit, i) => ({ end: NOW - (3 - i) * W, hit, early: hit ? earlyDays * D : 0, known: true, closed: true }));
const fourWeeks = (used, peak = used) => ({ cover: true, known: true, weeks: [0, 1, 2, 3].map(() => ({ used, peak, reads: 6 })) });

test('diagnosis: short when most weekly windows ran out more than a day early, with the pace in accounts and the price of one more (설계 검토 D2 · D4)', () => {
  const rows = [0, 1, 2, 3].map(() => weekly('claude', 100, NOW + 2 * D));
  const stats = Object.fromEntries(rows.map(r => [r.id, { rate3: 18, weeks4: { ...fourWeeks(120, 100), windows: windowsOf([true, true, true, false]) } }]));
  const s = snap(rows, stats), d = briefDiag(s, briefGroups(s, NOW), NOW);
  const c = d.items[0];
  assert.deepEqual([c.name, c.word], ['Claude', '모자람']);
  assert.equal(c.say, '지난 4주 동안 주간 한도 16번 가운데 12번이 초기화 하루 넘게 전에 바닥났습니다.');
  assert.equal(c.more, '지금 속도는 한 주에 계정 약 5개 몫입니다(지금 4개). 계정을 하나 더하면 월 약 308,000원입니다.');
  // 창 끝 몇 시간 전에야 닿은 창은 「일찍 바닥남」이 아니다
  const late = Object.fromEntries(rows.map(r => [r.id, { rate3: 70, weeks4: { ...fourWeeks(100), windows: windowsOf([true, true, true, true], 0.2) } }]));
  assert.equal(briefDiag(snap(rows, late), briefGroups(snap(rows, late), NOW), NOW).items[0].word, '알맞음');
});

test('diagnosis: spare only with four full weeks known, counted by the busiest week of the whole service (설계 검토 D3)', () => {
  const rows = [0, 1, 2, 3].map(() => weekly('claude', 10, NOW + 3 * D));
  const quiet = Object.fromEntries(rows.map(r => [r.id, { rate3: 3, weeks4: { ...fourWeeks(15), windows: windowsOf([false, false, false, false]) } }]));
  let d = briefDiag(snap(rows, quiet), briefGroups(snap(rows, quiet), NOW), NOW);
  assert.deepEqual([d.items[0].word, d.items[0].say], ['남음', '가장 바쁜 주에도 계정 1개 몫만 썼습니다. 계정 3개를 줄여도 됩니다.']);
  assert.equal(d.items[0].more, '월 약 924,000원을 아낍니다.');
  // 4주 가운데 놓친 틈이 있으면(known 거짓) 「남음」을 말하지 않는다
  const gap = Object.fromEntries(rows.map(r => [r.id, { rate3: 3, weeks4: { ...fourWeeks(15), known: false, windows: windowsOf([false, false, false, false]) } }]));
  d = briefDiag(snap(rows, gap), briefGroups(snap(rows, gap), NOW), NOW);
  assert.equal(d.items[0].word, '알맞음');
  // 한 주만 바빴어도 그 주로 센다: 100 · 0 · 0 · 40인 두 계정은 줄이라고 하지 않는다
  const two = rows.slice(0, 2), busy = Object.fromEntries(two.map(r => [r.id, { rate3: 3, weeks4: { cover: true, known: true, weeks: [100, 0, 0, 40].map(v => ({ used: v, peak: v, reads: 6 })), windows: windowsOf([true, false, false, false], 0.1) } }]));
  d = briefDiag(snap(two, busy), briefGroups(snap(two, busy), NOW), NOW);
  assert.notEqual(d.items[0].word, '남음');
});

test('diagnosis: Codex and Gemini speak only for the CLI limit and never say to cancel (설계 검토 D3)', () => {
  const a = weekly('gpt', 5, NOW + 3 * D, { plan: 'pro' }), b = weekly('gpt', 5, NOW + 3 * D, { plan: 'pro' });
  const stats = Object.fromEntries([a, b].map(r => [r.id, { rate3: 1, weeks4: { ...fourWeeks(10), windows: windowsOf([false, false, false, false]) } }]));
  const d = briefDiag(snap([a, b], stats), briefGroups(snap([a, b], stats), NOW), NOW), c = d.items[0];
  assert.equal(c.say, 'Codex로는 가장 바쁜 주에도 계정 1개 몫만 썼습니다.');
  assert.equal(c.more, 'ChatGPT 웹과 앱을 덜 쓴다면 계정 1개를 줄일 수 있습니다.');
  assert.equal(c.scope, 'Codex 한도 기준');
  assert.ok(!/끊/.test(c.say + c.more));
});

test('diagnosis order follows the goal; manual subscriptions of any kind are listed; the monthly total names what it leaves out', () => {
  const short = [0, 1].map(() => weekly('claude', 100, NOW + 2 * D)), spare = [0, 1].map(() => weekly('gemini', 5, NOW + 3 * D, { plan: 'ultra_20x' }));
  const stats = {};
  for (const r of short) stats[r.id] = { rate3: 50, weeks4: { ...fourWeeks(120, 100), windows: windowsOf([true, true, true, true]) } };
  for (const r of spare) stats[r.id] = { rate3: 1, weeks4: { ...fourWeeks(5), windows: windowsOf([false, false, false, false]) } };
  const grok = row({ source: 'manual', service: 'grokultra', kind: 'plan', label: 'Grok Ultra', price: 295000 });
  const rows = [...short, ...spare, grok];
  assert.deepEqual(briefDiag(snap(rows, stats), briefGroups(snap(rows, stats), NOW), NOW).items.map(i => i.word), ['모자람', '남음']);
  const save = snap(rows, stats, { goal: 'save' }), d = briefDiag(save, briefGroups(save, NOW), NOW);
  assert.deepEqual(d.items.map(i => i.word), ['남음', '모자람']);
  assert.equal(d.manual, 'Grok Ultra는 쓴 양을 읽지 못해 진단에서 뺐습니다(월 295,000원).');
  assert.equal(d.cost, '한 달 구독료 약 911,000원 · 요금을 모르는 2개 빼고');
});

test('diagnosis once a day: kept through the day, counted again on a new day read or a changed plan (설계 검토 D10)', () => {
  const a = weekly('claude', 10, NOW + 3 * D);
  const s1 = snap([a], { [a.id]: 1 }, { checkAt: NOW - 3 * H });
  const g = briefGroups(s1, NOW);
  const m1 = dailyDiag(null, s1, g, NOW);
  assert.equal(diagWhen(m1.at, NOW), '오늘 00:00에 읽은 기록으로');
  const later = NOW + 5 * H, s2 = snap([a], { [a.id]: 1 }, { checkAt: later - 60e3 });
  assert.equal(dailyDiag(m1, s2, g, later), m1, 'the same day keeps the morning count');
  const tomorrowNoRead = NOW + D;
  assert.equal(dailyDiag(m1, s2, g, tomorrowNoRead), m1, 'a new day without a new read keeps yesterday');
  const s3 = snap([a], { [a.id]: 1 }, { checkAt: NOW + D - 60e3 });
  assert.notEqual(dailyDiag(m1, s3, g, NOW + D), m1, 'the first read of a new day counts again');
  const s4 = snap([{ ...a, plan: 'max_5x' }], { [a.id]: 1 }, { checkAt: later - 60e3 });
  assert.notEqual(dailyDiag(m1, s4, briefGroups(s4, later), later), m1, 'a changed plan counts again');
  assert.equal(diagWhen(NOW - 4 * H, NOW), '어제 23:00에 읽은 기록으로');
});

test('live output: off, first count, and today with the last ten minutes (설계 3.3, 설계 검토 D8)', () => {
  assert.deepEqual(briefLive({ enabled: false }, [], NOW), { state: 'off', big: '', unit: '', small: '토큰 세기가 꺼져 있습니다.' });
  assert.equal(briefLive({ enabled: true, scanning: true, progress: { done: 12, total: 340 } }, [], NOW).small, '처음 세는 중입니다. 12/340');
  const day = '2026-11-20', cells = out => [[day, 'claude', 'claude-opus-5-5', 0, out * 0.7, 0, 0, 0, 1], [day, 'gpt', 'gpt-6.2-sol', 0, out * 0.3, 0, 0, 0, 1], ['2026-11-19', 'claude', 'claude-opus-5-5', 0, 9e9, 0, 0, 0, 1]];
  const t0 = { enabled: true, scannedAt: NOW - H, cells: cells(30_000_000) };
  let samples = tokSample([], t0, null, NOW);
  let live = briefLive(t0, samples, NOW, NOW);
  assert.deepEqual([live.big, live.unit, live.small], ['3,000만', '오늘 출력 토큰', 'Claude Code 70%']);
  const t1 = { ...t0, cells: cells(30_500_000) };
  samples = tokSample(samples, t1, t0, NOW + 3 * 60e3);
  assert.equal(briefLive(t1, samples, NOW + 3 * 60e3, NOW).small, '방금부터 50만 · Claude Code 70%');
  // 10분이 지나도록 더 늘지 않았으면 쉬는 중이다
  assert.equal(briefLive(t1, samples, NOW + 3 * 60e3 + RECENT_MS + 1, NOW).small, '최근 10분은 쉬는 중 · Claude Code 70%');
  // 다 훑은 셈이 바뀐 알림(밀린 몫이 섞인다)은 기억을 비우지 않고 앞 값을 그만큼 올려 잇는다. 밀린 몫은 최근 10분에 들지 않는다(화면 검수 A4)
  const t2 = { ...t1, scannedAt: NOW + 4 * 60e3, cells: cells(40_000_000) };
  samples = tokSample(samples, t2, t1, NOW + 4 * 60e3);
  assert.deepEqual(samples.map(x => x.out), [39_500_000, 40_000_000]);
  assert.equal(recentOut(samples, NOW + 4 * 60e3).delta, 500_000);
  // 날이 바뀌면 새로 센다
  const nextDay = { ...t2, cells: [['2026-11-21', 'claude', 'claude-opus-5-5', 0, 1000, 0, 0, 0, 1]] };
  assert.deepEqual(tokSample(samples, nextDay, t2, NOW + D).map(x => x.out), [1000]);
});

test('the first screen keeps the rules: two sentences on top, three coming-up lines, rows folded under 상세내역 (설계 4절)', () => {
  const { rows, stats } = sevenOfTen();
  const b = brief(snap(rows, stats));
  assert.equal(b.fold, true);
  assert.ok(sentences(b.head.say) <= 1 && sentences(b.head.then) <= 1);
  assert.ok(b.soon.shown.length <= SOON_SHOWN);
  // 줄이 다시 읽기를 기다리는 동안(6시간 넘음)도 줄은 접힌 채 문장만 보인다(설계 검토 D9)
  const stale = snap(rows, stats, { checkAt: NOW - 7 * H });
  const sb = solioBrief({ today: solioToday({ snapshot: stale }, NOW), snapshot: stale }, NOW);
  assert.deepEqual([sb.fold, sb.head, sb.diag], [true, null, null]);
  // 확인할 구독이 있는 판(check)은 접지 않는다
  const gone = row({ state: 'needs-login' });
  const check = snap([gone], {});
  assert.equal(solioBrief({ today: solioToday({ snapshot: check }, NOW), snapshot: check }, NOW), null);
});

/* ── 화면 검수 r2(카본, solio-brief-20261120-r2) ── */
test('a gap under 30 minutes is not the block: the count goes on to the real one (화면 검수 r2 A1)', () => {
  // a는 10%가 남아 시간당 1%p로 10시간째 바닥난다. b는 그 10분 뒤 열리고 100시간 간다. 진짜 막힘은 110시간째, a가 초기화되는 120시간째까지다
  const a = weekly('claude', 90, NOW + 5 * D, { plan: 'pro' }), b = weekly('claude', 100, NOW + 10 * H + 10 * 60e3, { plan: 'pro' });
  const s = snap([a, b], { [a.id]: 12, [b.id]: 12 }), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  assert.ok(r && Math.abs(r.at - (NOW + 110 * H + 10 * 60e3)) < 60e3, 'skips the 10-minute gap: ' + new Date(r?.at).toISOString());
  assert.equal(r.next.a.row.id, a.id);
});

test('a 5-hour block opens at 100% when its weekly reset comes first; without a weekly share it is not counted (화면 검수 r2 A2)', () => {
  const b = row({ plan: 'pro', live: { readAt: NOW - 5 * 60e3, session: { usedPercent: 100, resetsAt: NOW + 3 * H }, weekly: { usedPercent: 90, resetsAt: NOW + H } } });
  const s = snap([b], { [b.id]: 24 }), r = poolRunout(s, briefGroups(s, NOW)[0], NOW);
  assert.equal(r.next.type, 'reopen');
  assert.equal(r.next.t, NOW + 3 * H, 'still shut until the 5-hour limit lifts, not at the weekly reset');
  const bare = row({ plan: 'pro', live: { readAt: NOW - 5 * 60e3, session: { usedPercent: 100, resetsAt: NOW + H } } });
  const s2 = snap([bare], { [bare.id]: 24 });
  assert.equal(poolRunout(s2, briefGroups(s2, NOW)[0], NOW), null);
});

test('the pace in accounts is said only when the rounded number is more than the accounts there are (화면 검수 r2 A3)', () => {
  const one = weekly('claude', 50, NOW + 3 * D, { plan: 'pro' });
  const st = { [one.id]: { rate3: 20, weeks4: { ...fourWeeks(95), windows: windowsOf([true, true, true, true]) } } };
  const d = briefDiag(snap([one], st), briefGroups(snap([one], st), NOW), NOW).items[0];
  assert.equal(d.word, '모자람');
  assert.doesNotMatch(d.more, /개 몫/, d.more);
});

test('a refill date for credits comes from the last refill, as in the row (화면 검수 r2 A4)', () => {
  const h = row({ service: 'higgsfield', label: 'Higgsfield', kind: 'credit', plan: 'ultra', billDay: 25, live: { readAt: NOW - 5 * 60e3, credits: { remaining: 30, total: 3000 } } });
  const s = snap([h], { [h.id]: { refillAt: new Date(2026, 10, 10).getTime() } });
  const b = briefHead(s, briefGroups(s, NOW), NOW);
  if (b.say.includes('크레딧이 얼마 남지 않았습니다')) assert.equal(b.then, '12월 10일에 다시 찹니다.');
});

test('an empty second line is filled from coming-up only when nothing is urgent (화면 검수 r2 A7)', () => {
  const calm = weekly('claude', 10, NOW + 30 * H, { billDay: 21 });
  const s = snap([calm], { [calm.id]: 5 }, { prices: { services: {} } }), b = brief(s);
  assert.equal(b.head.say, '내일 Claude 결제가 있습니다.');
  assert.equal(b.head.then, '', 'no other schedule glued under a bill');
  assert.ok(b.soon.all.some(i => /초기화됩니다/.test(i.text)));
});

test('a forecast rounded to the hour never lands before now (화면 검수 r2 A8)', () => {
  // 10%를 28분에 다 쓴다: 03:28을 03:00으로 내리지 않고 03:30으로 올린다
  const a = weekly('claude', 90, NOW + 5 * D, { plan: 'pro' });
  const s = snap([a], { [a.id]: (10 / 28) * 60 * 24 }), b = brief(s);
  assert.equal(b.head.say, '지금 속도면 Claude는 30분 뒤쯤 바닥납니다.');
});

test('the ten-minute baseline survives a finished rescan; yesterday’s values never count today (화면 검수 r2 A10 · A11)', () => {
  const day = '2026-11-20', cells = out => [[day, 'claude', 'claude-opus-5-5', 0, out, 0, 0, 0, 1]];
  const t0 = { enabled: true, scannedAt: NOW - H, cells: cells(100) };
  let samples = tokSample([], t0, null, NOW);
  const t1 = { ...t0, cells: cells(150) };
  samples = tokSample(samples, t1, t0, NOW + 12 * 60e3);
  const t2 = { ...t0, scannedAt: NOW + 17 * 60e3, cells: cells(300) };
  samples = tokSample(samples, t2, t1, NOW + 17 * 60e3);
  assert.deepEqual(recentOut(samples, NOW + 17 * 60e3), { delta: 50, partial: false });
  const midnight = new Date(2026, 10, 21).getTime();
  assert.equal(recentOut([{ t: midnight - 5 * 60e3, day, out: 1000 }], midnight + 3 * 60e3), null);
});

test('bills of one service on one day keep the API credit that disappears (화면 검수 r2 A12)', () => {
  const until = new Date(2026, 10, 21).getTime();
  const a = weekly('claude', 10, NOW + 5 * D, { plan: 'max_20x', billDay: 21, apiCredit: 30, apiCreditUntil: until });
  const b = weekly('claude', 10, NOW + 5 * D, { plan: 'max_20x', billDay: 21, apiCredit: 20, apiCreditUntil: until });
  const s = snap([a, b], { [a.id]: 1, [b.id]: 1 }), soon = briefSoon(s, briefGroups(s, NOW), NOW, []);
  assert.ok(soon.all.some(i => /^Claude 결제 2건 · 약 616,000원 · API 크레딧 \$50가 사라집니다$/.test(i.text)), JSON.stringify(soon.all.map(i => i.text)));
});

/* ── 문자판(11-20 유호님이 고르신 A, 설계 10절) ── */
test('the dial: the service on top in the middle, its pooled share, every account as a cell, three days of ticks', () => {
  const { rows, stats, out } = sevenOfTen();
  const s = snap(rows, stats), d = brief(s).dial;
  assert.equal(d.focus, 'claude');
  assert.deepEqual(d.hero, { value: '29', unit: '%', label: 'Claude 남은 몫' });
  assert.equal(d.rings.length, 1);
  assert.equal(d.rings[0].accounts.length, 10);
  assert.equal(d.rings[0].accounts.filter(a => a.left === 0).length, 7);
  assert.equal(d.span, DIAL_MS);
  assert.equal(d.ticks.length, 72);
  assert.deepEqual(d.days.map(x => x.label), ['지금', '내일', '모레', '월요일']);
  assert.equal(d.days[1].off, 21 * H);
  // 바깥 궤도: 지금 속도로 막히지 않는 때까지(금색), 모두 막히는 동안(붉게), 그 뒤(점선)
  assert.deepEqual(d.arcs.map(a => a.k), ['safe', 'gap', 'after']);
  const safe = d.arcs[0], gap = d.arcs[1];
  assert.ok(safe.from === 0 && safe.to > 31 * H && safe.to < 33 * H);
  assert.deepEqual([gap.from, gap.to], [safe.to, 40 * H]);
  // 막힘 표식은 궤도와 같은 때(반올림 전)에 찍는다(화면 검수 dial A5)
  assert.equal(d.events.find(e => e.kind === 'runout').off, safe.to);
  assert.ok(d.events.some(e => e.kind === 'open' && e.off === 6 * H && e.text.includes('out0')));
  assert.ok(d.events.some(e => e.kind === 'runout'));
  assert.ok(d.events.every(e => e.off > 0 && e.off <= DIAL_MS));
  assert.match(d.label, /^Claude 계정 10개 가운데 3개가 열려 있습니다\. Claude 남은 몫 29%\. 지금 속도면 .+쯤 모두 막힙니다\.$/);
  assert.ok(out.length === 7);
});

test('the dial: mixed plans count open accounts, a single account shows its own share, every service gets cells', () => {
  const pro = weekly('gpt', 100, NOW + 2 * D, { plan: 'pro' }), plus = weekly('gpt', 30, NOW + 5 * D, { plan: 'plus' });
  const gem = weekly('gemini', 20, NOW + 4 * D, { plan: 'ultra_20x' });
  const s = snap([pro, plus, gem], { [pro.id]: 10, [plus.id]: 10, [gem.id]: 5 });
  const g = briefGroups(s, NOW);
  const d = briefDial(s, g, NOW, 'gpt');
  assert.deepEqual(d.hero, { value: '1', unit: '/2', label: 'Codex 열린 계정' });
  assert.deepEqual(d.rings.map(r => [r.key, r.accounts.length, r.focus]), [['gpt', 2, true], ['gemini', 1, false]]);
  assert.deepEqual(d.arcs, [{ from: 0, to: DIAL_MS, k: 'after' }], 'no common unit, no forecast arc');
  assert.deepEqual(briefDial(s, g, NOW, 'gemini').hero, { value: '80', unit: '%', label: 'Gemini 남은 양' });
});

test('the dial when every account is shut: red until the first reopens, and the label says so instead of a forecast (화면 검수 dial A2)', () => {
  const a = weekly('gpt', 100, NOW + 2 * H, { plan: 'pro', email: 'alpha@example.com' }), b = weekly('gpt', 100, NOW + 30 * H, { plan: 'pro', email: 'beta@example.com' });
  const s = snap([a, b], { [a.id]: 10, [b.id]: 10 }), d = briefDial(s, briefGroups(s, NOW), NOW, 'gpt');
  assert.deepEqual(d.arcs[0], { from: 0, to: 2 * H, k: 'gap' });
  assert.match(d.label, /^Codex 계정 2개가 모두 막혀 있습니다\. .+에 처음 다시 열립니다\.$/);
  assert.doesNotMatch(d.label, /지금 속도면/);
  // 30분 안에 열려도 지금 막힌 것은 붉게 그린다
  const c = weekly('gpt', 100, NOW + 10 * 60e3, { plan: 'pro', email: 'gamma@example.com' });
  const s2 = snap([c, b], { [c.id]: 10, [b.id]: 10 }), d2 = briefDial(s2, briefGroups(s2, NOW), NOW, 'gpt');
  assert.deepEqual(d2.arcs[0], { from: 0, to: 10 * 60e3, k: 'gap' });
});

test('the dial leaves out a day name within an hour and a half of 「지금」 (화면 검수 dial A4)', () => {
  const { rows, stats } = sevenOfTen(), late = NOW + 20 * H; // 금요일 23:00
  const s = snap(rows, stats), d = briefDial(s, briefGroups(s, late), late, 'claude');
  assert.equal(d.days[0].label, '지금');
  assert.ok(d.ticks.some(t => t.k === 'day' && t.off === H), 'the midnight tick stays');
  assert.ok(!d.days.some(x => x.off === H), 'but its name does not sit on 「지금」');
});

test('the dial centres the service whose bill or credits the top speaks of (화면 검수 dial A6)', () => {
  const c1 = weekly('claude', 5, NOW + 5 * D), c2 = weekly('claude', 5, NOW + 5 * D);
  const g = weekly('gpt', 10, NOW + 5 * D, { plan: 'plus', billDay: 21 });
  const s = snap([c1, c2, g], { [c1.id]: 1, [c2.id]: 1, [g.id]: 1 }), b = brief(s);
  assert.equal(b.head.say, '내일 Codex 결제가 있습니다.');
  assert.equal(b.dial.focus, 'gpt');
});
