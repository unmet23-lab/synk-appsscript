// 주문 폭주의 새 길(단계 4 계획 §23-7 · §23-10 「게임」). 꺼진 판은 옛 엔진을 지금과 같은 때 · 같은 인수로 부르고 새 길 모듈을 싣지 않는다.
// 문이 있으면 새 길 모듈을 동적으로 싣는다 — open이 null이면 옛 길, RUN_ENDED면 옛 길을 열지 않는다. 진짜 엔진 코치를 가짜 입구로 셸의 문
// (createGameDoor)에 넣고 문을 거친 그대로(인수 복제 · 후보 되맞춤) 한 판씩 돌린다: 한가한 오픈 8 · 같은 제시의 뒤 답 · 빈 기억 손님의 none ·
// 점심 러시의 순간 맞춤 · 며칠 뒤 주문 · 판을 다시 정함 · 패널 닫힘 · 초급 가게.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';
import { BANKS, GAME_ID, SET_LENGTH, openCafe, openShop } from './atlas-next-play.mjs';
import { judge, metadata as shopMetadata, stageOrders } from './beginner-core.mjs';
import { devFlag, ended, nextDoor } from './kit/atlas-next.mjs';
import { CafeSession, DELAYED_ORDERS, judgeOrder, makeCup, ORDERS } from './core.mjs';
import { customerName, customerOf } from './cafe.mjs';
import {
  closingObservation,
  FLOW_PRACTICE,
  FLOW_RUSH,
  FLOW_SKILLS,
  FLOW_WORDS,
  orderAnswer,
  orderMetadata,
  pressureOf,
  tuningFrom,
} from './learning.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const source = file => readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const MAP = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0); // 11-19 10:00(한국)
const DAY = 86_400_000;

/* ── 꺼진 판 · 문 열기(게임 진입의 원문) ── */

const staticImports = text => [...text.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gms)].map(match => match[1]);

test('원문 — 정적 import에 새 길 모듈이 없고 키트만 더했다, 새 길 모듈은 동적으로만 싣는다, /atlas/를 부르지 않는다', () => {
  for (const file of ['./app.mjs', './beginner.mjs']) {
    const text = source(file);
    const imports = staticImports(text);
    assert.ok(!imports.includes('./atlas-next-play.mjs'), `${file}: 새 길 모듈은 정적으로 싣지 않는다`);
    assert.ok(imports.includes('./kit/atlas-next.mjs'), `${file}: 문 찾기는 키트(맨 위는 정의뿐)`);
    assert.equal(text.match(/import\('\.\/atlas-next-play\.mjs'\)/g)?.length, 1, `${file}: 동적 import 한 자리`);
    assert.doesNotMatch(text, /['"`]\/atlas\//, `${file}: /atlas/ 요청 없음`);
  }
  assert.deepEqual(staticImports(source('./atlas-next-play.mjs')), ['./kit/atlas-next.mjs', './learning.mjs']);
  assert.deepEqual([...BANKS], [...GAME_BANKS['order-rush']], '셸의 게임 은행 표와 같은 은행');
  assert.equal(GAME_ID, 'order-rush');
  assert.deepEqual(SET_LENGTH, { open: 8, rush: null, review: 3, delayed: 1 });
});

test('원문 — 새 길의 한가한 오픈은 순간 맞춤을 열지 않는다(FLOW_PRACTICE는 손잡이가 문항 난도뿐)', () => {
  const text = source('./app.mjs');
  const body = text.slice(text.indexOf('function startLive('), text.indexOf('function applyFlow('));
  // 두 줄이 다 있는지 먼저 본다 — 가드 줄이 없으면 indexOf가 -1이라 차례 단언이 늘 참이다(끝 판 F6 ①).
  const guard = body.indexOf("if (atlasNext && state.mode !== 'rush') return;");
  const live = body.indexOf('coach.live(');
  assert.ok(guard >= 0 && live >= 0, '가드 줄과 순간 맞춤 열기가 startLive 안에 있다');
  assert.ok(guard < live, '새 길의 한가한 오픈은 순간 맞춤을 열기 전에 돌아간다');
});

// 게임 진입의 원문(새 길 문 열기부터 옛 코치를 만드는 문장까지)을 잘라 가짜 창 · 가짜 옛 엔진으로 돌린다. 꺼진 판의 옛 코치는 이 토막을
// 부르는 동안 동기로 만들어진다 — 지금과 같은 때(앞의 await 뒤 첫 차례)다.
const AsyncFunction = (async () => {}).constructor;
function opening(file) {
  const text = source(file);
  const from = text.indexOf('let atlasNext = null');
  const to = text.indexOf('\n', text.indexOf('SynkLearning?.createGame(', from));
  const body = text.slice(from, to).replace("import('./atlas-next-play.mjs')", '__load()');
  return new AsyncFunction(
    'nextDoor',
    'devFlag',
    'ended',
    'window',
    'localStorage',
    '__load',
    `let coach = null, learningFailed = false;\n${body}\nreturn { coach, atlasNext, learningFailed };`,
  );
}
const kitEnded = error => error?.code === 'RUN_ENDED';
const pending = promise => Promise.race([promise.then(() => 'settled'), new Promise(resolve => setTimeout(() => resolve('pending'), 30))]);

function fakeEngine() {
  const made = [];
  globalThis.SynkLearning = {
    createGame(options) {
      made.push(options);
      return { old: true };
    },
  };
  return made;
}

for (const [file, open, args] of [
  ['./app.mjs', 'openCafe', storage => ({ gameId: 'order-rush', storage, followups: true })],
  ['./beginner.mjs', 'openShop', storage => ({ gameId: 'order-rush', storage })],
]) {
  test(`${file} 진입 — 문이 없으면 옛 코치를 동기로 같은 인수로 만들고 새 길 모듈을 싣지 않는다`, async () => {
    const made = fakeEngine();
    const storage = {};
    const loads = [];
    const run = opening(file)(() => null, () => false, kitEnded, {}, storage, () => loads.push(1));
    assert.deepEqual(made, [args(storage)], '부르는 동안 동기로(앞에 await 없음)');
    const result = await run;
    assert.deepEqual(result.coach, { old: true });
    assert.equal(result.atlasNext, null);
    assert.equal(loads.length, 0, '새 길 모듈을 싣지 않는다');
    delete globalThis.SynkLearning;
  });

  test(`${file} 진입 — 문이 있고 open이 null이면 기다린 뒤 옛 길로 정상 시작한다(개발 깃발도 같다)`, async () => {
    for (const [door, flag] of [[() => ({}), () => false], [() => null, () => true]]) {
      const made = fakeEngine();
      const storage = {};
      const loads = [];
      const run = opening(file)(door, flag, kitEnded, {}, storage, async () => {
        loads.push(1);
        return { [open]: async () => null };
      });
      assert.deepEqual(made, [], '문을 기다리는 동안 옛 코치를 만들지 않는다');
      const result = await run;
      assert.deepEqual(made, [args(storage)]);
      assert.deepEqual([result.coach, result.atlasNext, loads.length], [{ old: true }, null, 1]);
      delete globalThis.SynkLearning;
    }
  });

  test(`${file} 진입 — open이 RUN_ENDED로 거절하면 옛 길(createGame)을 열지 않는다`, async () => {
    const made = fakeEngine();
    const run = opening(file)(() => ({}), () => false, kitEnded, {}, {}, async () => ({
      [open]: async () => {
        throw Object.assign(new Error('closed'), { code: 'RUN_ENDED' });
      },
    }));
    if (file === './app.mjs') assert.equal(await pending(run), 'pending', '카페는 시작 화면에 멈춘다');
    else assert.deepEqual(await run, { coach: null, atlasNext: null, learningFailed: false }, '초급 가게는 기록 없이 논다');
    assert.deepEqual(made, []);
    delete globalThis.SynkLearning;
  });

  test(`${file} 진입 — 새 겉이면 그 겉을 코치 자리에 두고 옛 코치를 만들지 않는다`, async () => {
    const made = fakeEngine();
    const play = { next: true };
    const result = await opening(file)(() => ({}), () => false, kitEnded, {}, {}, async () => ({ [open]: async () => play }));
    assert.equal(result.coach, play);
    assert.equal(result.atlasNext, play);
    assert.deepEqual(made, []);
    delete globalThis.SynkLearning;
  });
}

/* ── 진짜 엔진 코치 — 문을 거친 그대로 ── */

let stores = 0;
async function realCoach() {
  const clock = { t: T0 };
  const port = atlas.memoryPort();
  const coach = atlas.createCoach({
    gameId: GAME_ID,
    mapData: MAP,
    dayOffset: 540,
    host: { guest: true, port, key: `synk-atlas:order-rush-test-${process.pid}-${(stores += 1)}`, now: () => clock.t },
  });
  await coach.ready;
  return { coach, port, clock };
}

const COACH_METHODS = ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation'];
const LIVE_METHODS = ['settings', 'intro', 'level', 'pick', 'present', 'answer', 'observe', 'stuck', 'offerLessHelp', 'acceptLessHelp', 'declineLessHelp', 'floor', 'end', 'trace'];
// 셸 창 코치에 들어온 부름을 적는다(문이 복제한 인수 그대로). recommend는 돌려준 결과도 적는다.
function spy(coach, calls, results = []) {
  const out = {};
  for (const name of COACH_METHODS)
    out[name] = (...args) => {
      calls.push([name, ...args]);
      const value = coach[name](...args);
      if (name === 'recommend') results.push(value);
      return value;
    };
  out.live = (...args) => {
    calls.push(['live', ...args]);
    const handle = coach.live(...args);
    const wrapped = { spec: handle.spec };
    for (const name of LIVE_METHODS)
      wrapped[name] = (...rest) => {
        if (['present', 'answer', 'observe'].includes(name)) calls.push([`live.${name}`, ...rest]);
        return handle[name](...rest);
      };
    return wrapped;
  };
  return out;
}

// 셸의 문과 그 문을 위 창에 둔 틀.
function doorFor(entry) {
  const door = createGameDoor({ entry, gameId: GAME_ID });
  const top = { SYNKAtlasGame: door.api };
  const frame = { parent: top, top, location: { hostname: 'synk.im', search: '' }, addEventListener() {} };
  return { door, top, frame };
}

async function eventsOf(port) {
  let count = -1;
  for (let i = 0; i < 20; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 5));
    const rows = await port.read();
    if (rows.length === count) break;
    count = rows.length;
  }
  return (await port.read()).map(row => row.value?.event).filter(Boolean);
}

// app.mjs의 새 길 차례 그대로: 판 열기 → (러시면 순간 맞춤 열기) → 손님이 줄에 서면 덱 차례로 자리만 잡고(selectOrder) → 그 손님을 들을 때
// 고르고 곧바로 제시(chooseLate — app.mjs 원문 토막, 다시 보기 GB3) → 전달 → 서빙(답) → 틀리면 도움(hint) · 고쳐 다시 서빙. begun이면 판은 이미
// 열었다(순간 맞춤을 연 뒤). picks: 들을 때 고른 결과(pick)를 차례대로 모은다.
const shifts = new Map();
function lateChooser() {
  const body = between(source('./app.mjs'), 'function chooseLate(t) {', 'function presentTicket(');
  return new Function('env', `with (env) {
${body}
return chooseLate;
}`);
}
function openShift(play, picks, { kind = 'open', deck = ORDERS, limit = 8, tuning = null, begun = false } = {}) {
  if (!begun) play.begin(kind);
  const session = new CafeSession(kind === 'rush' ? 'rush' : 'practice', 7, { deck, orderLimit: limit, tuning, selectOrder: orders => orders[0] });
  const learn = (method, ...args) => {
    const value = play[method](...args);
    if (method === 'pick') picks.push(value);
    return value;
  };
  shifts.set(play, lateChooser()({ state: { session }, learningFailed: false, nextWhy: null, updateLearning() {}, learn }));
  return session;
}
function hear(play, t, { complete = true } = {}) {
  if (!t.presentationId) shifts.get(play)?.(t);
  t.presentationId = play.present(orderMetadata(t.order));
  play.delivery(t.presentationId, { audio: 'pending' });
  if (!complete) return;
  play.delivery(t.presentationId, { audio: 'completed' });
  t.audioCompleted = true;
}
function serve(play, session, t, cups) {
  const judged = judgeOrder(t.order, cups);
  const out = play.answer(
    t.presentationId,
    { ...orderAnswer(judged, t), attemptNo: t.attempts + 1 },
    { pressure: pressureOf(t, session), ...(t.audioCompleted === true || t.help ? {} : { outcome: 'void' }) },
  );
  const result = session.submit(t.uid, cups);
  if (!result.correct) play.help(t.presentationId, 'hint');
  return out;
}
const right = order => order.cups.map(cup => ({ ...makeCup(), ...cup }));
const wrong = () => [makeCup()];

test('한가한 오픈 한 판 — 문을 거쳐 손님마다 recommend(판 길이 8), 제시 · 전달 · 도움 · 답의 차례, 같은 제시의 둘째 답은 기록되고 판을 움직이지 않는다', async () => {
  const { coach, port, clock } = await realCoach();
  const calls = [];
  const results = [];
  const { frame } = doorFor({ gameCoach: async () => spy(coach, calls, results), retired: () => () => {} });
  const play = await openCafe({ win: frame });
  assert.ok(play);
  assert.equal(play.hosted, false, '손님 코치는 WORLD 계정 기록이 아니다');
  const picks = [];
  const session = openShift(play, picks);
  let first = null;
  while (!session.done) {
    const t = session.queue[0];
    clock.t += 20_000;
    hear(play, t);
    if (!first) {
      first = t;
      assert.equal(serve(play, session, t, wrong()).recorded.verdict, 'incorrect');
      clock.t += 5_000;
      assert.equal(serve(play, session, t, right(t.order)).recorded.verdict, 'correct', '고쳐 다시 서빙도 기록된다');
      continue;
    }
    serve(play, session, t, right(t.order));
  }
  const next = play.reason(ORDERS);
  play.end();

  assert.equal(calls.shift()[0], 'summary', '열 때 손님인지 계정인지 한 번 본다');
  const names = calls.map(([name]) => name);
  assert.deepEqual(names.slice(0, 8), ['recommend', 'present', 'delivery', 'delivery', 'answer', 'help', 'answer', 'recommend']);
  assert.deepEqual(calls[0][2], { set: { length: 8, newLimit: 24 } }, '판 길이 8 · 새것 한도 3n');
  assert.equal(names.filter(name => name === 'present').length, 8);
  assert.equal(names.filter(name => name === 'live').length, 0, '한가한 오픈은 순간 맞춤이 없다');
  assert.deepEqual(calls.at(-1), ['finishSet', { record: false }], '판 끝 finishSet');
  assert.deepEqual(calls.at(-2)[0], 'recommend', '판을 닫기 전 다음 이유를 이 판의 상태로 묻는다');
  assert.ok(next === null || typeof next === 'string');

  // 고른 것은 게임이 넘긴 원래 후보(되맞춤) — 엔진이 고르면 이유 줄이 있고, idle이면 엔진의 채우기, none이면 게임 차례(덱 첫 주문)다.
  assert.equal(picks.length, 8);
  picks.forEach((pick, at) => {
    const result = results[at];
    assert.equal(pick.selected.itemKey, result.selected?.itemKey ?? pick.selected.itemKey);
    if (result.status === 'none') assert.deepEqual([pick.engine, pick.why], [false, null]);
    else {
      assert.equal(pick.engine, true, `${at}: ${result.status}은 엔진이 고른 문항`);
      assert.equal(pick.idle, result.status === 'idle');
      assert.equal(pick.selected.itemKey, result.selected.itemKey);
      assert.equal(pick.why?.code, result.why?.code);
    }
  });
  assert.ok(results.slice(0, 8).some(result => result.status === 'idle'), '이 판에 채우기(idle)가 있다 — 엔진 문항으로 낸다');
  assert.ok(picks.some(pick => typeof pick.why?.line === 'string'), '엔진이 고른 주문에는 이유 줄이 있다');
  assert.ok(
    picks.some(pick => pick.why?.code === 'unit.retry'),
    '틀린 단위가 이 판에서 다른 주문으로 돌아온다 — 고쳐 다시 서빙(뒤 답)이 「다시」를 풀지 않았다',
  );

  const events = await eventsOf(port);
  const presented = events.filter(event => event.type === 'practice.presented');
  assert.equal(presented.length, 8);
  assert.equal(new Set(presented.map(event => event.setId)).size, 1, '한 판');
  const tries = events.filter(event => event.type === 'practice.attempted' && event.presentationId === first.presentationId);
  assert.deepEqual(tries.map(event => [event.attemptNo, event.verdict]), [[1, 'incorrect'], [2, 'correct']]);
  const helps = events.filter(event => event.type === 'practice.helped' && event.presentationId === first.presentationId);
  assert.deepEqual(helps.map(event => event.helpId), ['hint']);
  coach.dispose();
});

// 다른 게임이 오늘의 새 단위를 하루 한도(20)까지 쓴 기기 — 주문 폭주와 단위가 겹치지 않는 다른 은행 문항을 셸의 코치로 먼저 낸다.
function fillDay(coach, clock) {
  const { fields, items } = MAP.index;
  const rows = items.map(row => Object.fromEntries(fields.map((field, at) => [field, row[at]])));
  const own = new Set(rows.filter(row => row.bank.startsWith('order-rush')).flatMap(row => row.units));
  const met = new Set();
  for (const row of rows) {
    if (row.bank.startsWith('order-rush') || row.flags & 1 || row.units.some(unit => own.has(unit) || met.has(unit))) continue;
    row.units.forEach(unit => met.add(unit));
    const pid = coach.present({ itemKey: row.itemKey });
    coach.answer(pid, { correct: true, assessable: true });
    clock.t += 10_000;
    if (met.size > 20) break;
  }
  coach.finishSet({ record: false });
  clock.t += 60_000;
}

test('빈 기억 손님의 같은 날 넷째 게임 — none이면 게임 차례로 present만 하고 이유 줄이 없으며, 판은 끝까지 간다', async () => {
  const { coach, port, clock } = await realCoach();
  fillDay(coach, clock);
  const results = [];
  const { frame } = doorFor({ gameCoach: async () => spy(coach, [], results), retired: () => () => {} });
  const play = await openCafe({ win: frame });
  const picks = [];
  const session = openShift(play, picks);
  while (!session.done) {
    const t = session.queue[0];
    clock.t += 20_000;
    hear(play, t);
    serve(play, session, t, right(t.order));
  }
  play.end();
  assert.equal(results[0].status, 'none', '첫 추천부터 none');
  assert.deepEqual([picks[0].engine, picks[0].why, picks[0].selected.id], [false, null, ORDERS[0].id], '게임 차례 — 덱의 첫 주문');
  assert.equal(picks.length, 8, '판 끝까지');
  picks.forEach((pick, at) => {
    if (results[at].status === 'none') assert.deepEqual([pick.engine, pick.why], [false, null], `${at}: 게임 차례 문항에 이유 줄 없음`);
    else assert.equal(pick.engine, true);
  });
  const events = await eventsOf(port);
  const mine = events.filter(event => event.type === 'practice.presented' && event.itemKey.startsWith('order-rush.'));
  assert.equal(mine.length, 8);
  assert.equal(mine.find(event => event.itemKey === orderMetadata(ORDERS[0]).itemKey).arm, 'host', '제품 차례로 남는다');
  coach.dispose();
});

test('점심 러시 — 순간 맞춤은 손님 속도만 움직이고, 한 제시는 Flow를 한 번만 움직인다(뒤 답 · 떠난 손님 · 소리 전 서빙)', async () => {
  const { coach, clock } = await realCoach();
  const calls = [];
  const { frame } = doorFor({ gameCoach: async () => spy(coach, calls), retired: () => () => {} });
  const play = await openCafe({ win: frame });
  const picks = [];
  play.begin('rush');
  const live = play.live(FLOW_RUSH, { skillIds: FLOW_SKILLS, responseFormat: 'cup-compose', declared: {}, words: FLOW_WORDS });
  const start = live.settings();
  assert.equal(start.adaptive, true);
  assert.deepEqual(Object.keys(start.values).sort(), ['patience', 'queueMax', 'spawnEvery'], '문항 난도는 손잡이가 아니다');
  const session = openShift(play, picks, { kind: 'rush', tuning: tuningFrom(start.values), begun: true });
  const lines = [live.intro().line?.text].filter(Boolean);
  const note = out => {
    if (out?.line) lines.push(out.line.text);
    if (out?.settings) session.tune(tuningFrom(out.settings.values));
  };
  const outcomes = () => live.trace().map(step => step.outcome);

  // 손님 하나: 틀린 컵(fail) → 고쳐 다시 서빙(움직이지 않음).
  const a = session.queue[0];
  hear(play, a);
  assert.deepEqual(calls.find(([name]) => name === 'recommend')[2], { set: {} }, '러시는 시간으로 끝나는 판');
  clock.t += 5_000;
  note(serve(play, session, a, wrong()));
  note(serve(play, session, a, right(a.order)));
  assert.deepEqual(outcomes(), ['fail']);
  assert.ok(calls.some(([name]) => name === 'live.present'), '러시의 제시는 순간 맞춤 겉으로 낸다');

  // 손님 둘: 틀린 컵 뒤 기다리다 떠남 — 시간 초과는 그 제시의 몫(첫 판정 답이 썼다)이라 움직이지 않는다.
  session.spawn();
  const b = session.queue[0];
  hear(play, b);
  note(serve(play, session, b, wrong()));
  session.time = b.born + b.patience;
  session.step(0);
  const left = session.records.find(record => record.uid === b.uid);
  const close = closingObservation(left);
  assert.deepEqual(close, { answer: false, outcome: 'timeout' });
  note(play.observe({ outcome: close.outcome }, left.presentationId));
  assert.deepEqual(outcomes(), ['fail', 'fail']);

  // 손님 셋: 소리를 다 듣기 전 서빙(void — 몫을 쓰지 않음) → 다 들은 뒤 고쳐 서빙이 첫 판정 답이다.
  const c = session.queue.find(t => !t.presentationId) ?? (session.spawn(), session.queue.at(-1));
  hear(play, c, { complete: false });
  note(serve(play, session, c, wrong()));
  play.delivery(c.presentationId, { audio: 'completed' });
  c.audioCompleted = true;
  note(serve(play, session, c, right(c.order)));
  assert.deepEqual(outcomes(), ['fail', 'fail', 'void', 'success']);

  // 손님 넷: 들은 뒤 답하지 않고 떠남 — 응답 없음 답과 시간 초과 한 번.
  session.spawn();
  const d = session.queue.find(t => !t.presentationId);
  hear(play, d);
  const gone = closingObservation({ presentationId: d.presentationId, attempts: 0, outcome: 'missed' });
  assert.deepEqual(gone, { answer: true, outcome: 'timeout' });
  const out = play.answer(d.presentationId, { correct: null, assessable: false, reason: 'unanswered' }, { outcome: gone.outcome });
  note(out);
  assert.equal(out.recorded.verdict, 'unassessed');
  assert.deepEqual(outcomes(), ['fail', 'fail', 'void', 'success', 'timeout']);

  const end = live.end();
  assert.ok(end.changes.every(change => change.kind === 'pace'), '바뀌는 것은 손님 속도 손잡이뿐');
  for (const key of ['raise.content', 'ease.content']) assert.ok(!lines.includes(FLOW_WORDS[key]), `${key} 안내 줄 없음`);
  play.end();
  assert.deepEqual(calls.at(-1), ['finishSet', { record: false }]);
  coach.dispose();
});

test('점심 러시 — 줄에 손님 셋이 선 뒤 어느 차례로 들어도, 주문은 들을 때 고르고 곧바로 내서 제시의 근거가 그 고르기의 근거다(4-6 끝 판 F1 · GC3 · 다시 보기 GB3)', async () => {
  for (const order of [[0, 1, 2], [1, 0, 2], [0, 2, 1]]) {
    const { coach, port, clock } = await realCoach();
    const calls = [];
    const results = [];
    const { frame } = doorFor({ gameCoach: async () => spy(coach, calls, results), retired: () => () => {} });
    const play = await openCafe({ win: frame });
    const picks = [];
    const session = openShift(play, picks, { kind: 'rush' });
    session.spawn();
    session.spawn();
    assert.equal(session.queue.length, 3, '손님 셋이 줄에 섰다');
    assert.equal(results.length, 0, '줄에 설 때는 고르지 않는다');
    const line = [...session.queue];
    for (const at of order) {
      const t = line[at];
      clock.t += 1_000;
      hear(play, t);
      const names = calls.map(([name]) => name).filter(name => !['delivery', 'help', 'answer'].includes(name));
      assert.deepEqual(names.slice(-2), ['recommend', 'present'], `${order}: 고르고 곧바로 낸다`);
      clock.t += 3_000;
      serve(play, session, t, right(t.order));
    }
    const presented = (await eventsOf(port)).filter(event => event.type === 'practice.presented');
    assert.equal(presented.length, 3);
    presented.forEach((event, at) => {
      const pick = picks[at];
      const t = line[order[at]];
      assert.equal(event.itemKey, orderMetadata(t.order).itemKey, `${order}: 들은 손님의 주문`);
      assert.equal(pick.selected.itemKey, event.itemKey, `${order}: 고른 주문을 냈다`);
      if (!pick.engine) {
        assert.equal(event.arm, 'host');
        return;
      }
      assert.notEqual(event.arm, 'host', `${order}: 엔진이 고른 주문은 제품 차례로 남지 않는다`);
      assert.equal(event.arm, pick.idle ? 'filler' : 'adaptive', `${order}: 고른 갈래 그대로`);
      assert.equal(event.reason?.code, pick.why?.code, `${order}: 고른 근거 그대로`);
    });
    assert.ok(picks.some(pick => pick.engine && !pick.idle), `${order}: 엔진이 새로 고른 주문이 있는 판`);
    play.end();
    coach.dispose();
  }
});

test('점심 러시 — 첫 손님을 들은 뒤 31분 쉬고 서빙하기 전에 새 손님이 오거나 줄의 다른 손님을 들어도 첫 손님의 답이 남고, 답을 기다리는 제시가 있는 동안은 판을 새로 열지 않는다(GC2)', async () => {
  for (const after of ['새 손님이 온다', '줄의 다른 손님을 듣는다']) {
    const { coach, port, clock } = await realCoach();
    const { frame } = doorFor({ gameCoach: async () => coach, retired: () => () => {} });
    const play = await openCafe({ win: frame });
    const session = openShift(play, [], { kind: 'rush' });
    session.spawn();
    const [a, b] = session.queue;
    clock.t += 1_000;
    hear(play, a);
    clock.t += 31 * 60_000; // 첫 손님을 서빙하기 전에 31분 쉰다(멈춤 · 다른 탭 — 영업 시간은 흐르지 않는다)
    if (after === '새 손님이 온다') session.spawn();
    else hear(play, b);
    clock.t += 2_000;
    assert.equal(serve(play, session, a, right(a.order))?.recorded?.verdict, 'correct', `${after}: 첫 손님의 답이 저장된다`);
    for (const t of [...session.queue]) {
      if (!t.presentationId) hear(play, t);
      clock.t += 2_000;
      assert.ok(serve(play, session, t, right(t.order))?.recorded, `${after}: 줄의 손님도 저장된다`);
    }
    // 줄의 다른 손님을 들으면 첫 손님이 답을 기다리는 동안 고른다 — 판은 하나다. 새 손님이 오면(줄에 설 때는 고르지 않는다) 그 손님을 첫 손님을
    // 서빙한 뒤에 들어 고르므로, 기다리는 제시가 없어 지금처럼 쉼이 판을 가른다(§23-6).
    const sets = after === '새 손님이 온다' ? 2 : 1;
    const shown = (await eventsOf(port)).filter(event => event.type === 'practice.presented');
    assert.equal(new Set(shown.map(event => event.setId)).size, sets, `${after}: 판의 수`);

    // 기다리는 제시가 없으면 지금처럼 — 오래 쉰 뒤의 고르기는 코치가 판을 가른다(§23-6 「쉼 · 날로 코치가 가른다」).
    clock.t += 31 * 60_000;
    session.spawn();
    const c = session.queue.at(-1);
    hear(play, c);
    assert.ok(serve(play, session, c, right(c.order))?.recorded);
    const later = (await eventsOf(port)).filter(event => event.type === 'practice.presented');
    assert.equal(new Set(later.map(event => event.setId)).size, sets + 1, `${after}: 쉰 뒤 기다리는 제시가 없으면 새 판`);
    play.end();
    coach.dispose();
  }
});

// app.mjs의 제시 · 서빙 토막(presentOrder · answerWithFlow, chooseLate · presentTicket, serve)을 원문 그대로 돌린다. 화면 · 소리 · 타이머는
// env의 빈 자리다. world면 WORLD(실사 손님 · 문 종), 아니면 LAB(주문마다 정한 펠트 동물)이다.
function counterParts() {
  const text = source('./app.mjs');
  const body = [
    between(text, 'function presentOrder(order) {', '/* 저장 상태는'),
    between(text, 'function chooseLate(t) {', 'function refreshRecommendation('),
    between(text, 'function serve() {', 'function completeServe() {'),
  ].join('\n');
  return new Function('env', `with (env) {\n${body}\nreturn { presentTicket, serve };\n}`);
}
function counter(play, session, { world = true } = {}) {
  const nodes = {};
  const state = { screen: 'game', paused: false, celebrating: false, served: null, session, ticket: null, cups: [makeCup()], active: 0 };
  const $ = selector => (nodes[selector] ??= { dataset: {}, classList: { add() {} } });
  const env = {
    state, atlasNext: play, live: null, learningFailed: false, nextWhy: null,
    learn: (method, ...args) => { try { return play[method](...args); } catch { return null; } },
    applyFlow() {}, updateLearning() {}, orderMetadata, judgeOrder, orderAnswer, pressureOf,
    ticket: () => session.queue.find(t => t.uid === state.ticket),
    cast: world ? {} : null, customerOf, guestName: t => customerName(t.order.id),
    world: world ? { correct() {}, differ() {}, leave() {}, BEAT: { next: 900, leave: 620 } } : null,
    $, audio: { stop() {} }, tone() {}, setMood() {}, renderBubble() {}, stage: null, popScore() {}, punch() {}, metrics() {},
    announce() {}, reduced: () => false, completeServe() {}, setTimeout: () => 0, celebrationTimer: 0, leaveTimer: 0,
  };
  // 계산대에 손님을 세운다(selectTicket) — 말하기(playTicket → presentTicket)는 따로 부른다. 맞게 서빙한 손님은 받아 간 것으로 거둔다(completeServe).
  const stand = t => {
    Object.assign(state, { celebrating: false, served: null, ticket: t.uid, cups: [makeCup()] });
    $('#guest').dataset.uid = String(t.uid);
    $('#guest-img').src = `assets/cast/${customerOf(t.order.id)}.webp`;
  };
  return { ...counterParts()(env), state, $, stand };
}
const warmCoffee = () => [{ ...makeCup(), base: 'coffee' }];

test('점심 러시 — WORLD 문 종이 울리는 동안(손님이 말하기 전)에는 서빙을 받지 않고, 말할 때 고른 주문으로 첫 답을 판정한다(둘째 다시 보기 F2)', async () => {
  // 검수의 차례 그대로: 첫 손님(o01)을 서빙한 뒤 둘째 손님은 덱 차례로 o02를 잡아 두었고, 말할 때 엔진이 o05를 고른다.
  const log = [];
  let ids = ['o01', 'o05'];
  let pids = 0;
  const play = {
    pick(orders) {
      const id = ids.shift();
      log.push(['pick', orders.map(o => o.id)]);
      return { selected: orders.find(o => o.id === id) ?? orders[0], why: null, engine: true };
    },
    present: meta => (log.push(['present', meta.itemKey]), `p${(pids += 1)}`),
    answer: (pid, result) => (log.push(['answer', pid, result.correct]), { recorded: { verdict: result.correct ? 'correct' : 'incorrect' } }),
    help: (pid, kind) => log.push(['help', pid, kind]),
  };
  const session = new CafeSession('rush', 7, { deck: ORDERS, orderLimit: 8, selectOrder: orders => orders[0] });
  session.spawn();
  const [a, b] = session.queue;
  assert.deepEqual([a.order.id, b.order.id], ['o01', 'o02'], '줄에 설 때는 덱 차례로 자리만 잡는다');
  const app = counter(play, session);
  app.stand(a);
  a.presentationId = app.presentTicket(a);
  a.audioCompleted = true;
  app.state.cups = warmCoffee();
  app.serve();
  assert.equal(session.records.at(-1)?.uid, a.uid, '첫 손님은 맞게 서빙했다');

  app.stand(b);
  const before = log.length;
  for (const cups of [warmCoffee(), right(b.order)]) {
    app.state.cups = cups;
    app.serve();
  }
  assert.deepEqual([b.attempts, b.first, b.note ?? null, app.state.celebrating], [0, null, null, false], '말하기 전에는 서빙을 받지 않는다 — 잡아 둔 주문으로 판정하지 않는다');
  assert.ok(session.queue.includes(b));
  assert.deepEqual(log.slice(before), [], '코치에 답 · 도움을 넘기지 않는다');

  b.presentationId = app.presentTicket(b);
  assert.equal(b.order.id, 'o05', '말할 때 고른 주문');
  assert.deepEqual(log.slice(before).map(([name]) => name), ['pick', 'present']);
  b.audioCompleted = true;
  app.state.cups = right(b.order);
  app.serve();
  assert.equal(b.first, true, '첫 답은 제시한 주문(o05)으로 판정한다');
  assert.deepEqual(log.filter(([name, pid]) => name === 'answer' && pid === b.presentationId), [['answer', b.presentationId, true]]);

  // 제시 번호를 받지 못해(쓰기 차례 대기 등) 다시 들을 때 다시 내도, 이미 들려준 주문을 다시 고르지 않는다.
  session.spawn();
  const c = session.queue.at(-1);
  ids = ['o07', 'o09'];
  play.present = meta => (log.push(['present', meta.itemKey]), null);
  app.stand(c);
  const mark = log.length;
  c.presentationId = app.presentTicket(c);
  assert.equal(c.order.id, 'o07');
  c.presentationId = app.presentTicket(c);
  assert.equal(c.order.id, 'o07', '다시 낼 때 주문이 바뀌지 않는다');
  assert.deepEqual(log.slice(mark).map(([name]) => name), ['pick', 'present', 'present'], '고르기는 손님마다 한 번');

  // LAB(개발 깃발): 펠트 동물은 주문마다 정해져 있다 — 계산대의 손님은 고른 주문의 동물로 맞춘다(목소리 · 결과의 손님 이름과 같다).
  ids = ['o01', 'o05'];
  play.present = meta => (log.push(['present', meta.itemKey]), `p${(pids += 1)}`);
  const lab = new CafeSession('rush', 7, { deck: ORDERS, orderLimit: 8, selectOrder: orders => orders[0] });
  lab.spawn();
  const shop = counter(play, lab, { world: false });
  const [x, y] = lab.queue;
  shop.stand(x);
  x.presentationId = shop.presentTicket(x);
  shop.stand(y);
  assert.equal(shop.$('#guest-img').src, `assets/cast/${customerOf('o02')}.webp`);
  y.presentationId = shop.presentTicket(y);
  assert.equal(y.order.id, 'o05');
  assert.equal(shop.$('#guest-img').src, `assets/cast/${customerOf('o05')}.webp`, '계산대의 동물이 고른 주문의 동물이다');
  assert.equal(shop.$('#guest-img').alt, customerName('o05'));
});

test('점심 러시 — 진짜 코치: 손님이 말하기 전 서빙은 기록되지 않고, 말한 뒤 첫 답이 그 제시의 주문으로 기록된다(둘째 다시 보기 F2)', async () => {
  const { coach, port, clock } = await realCoach();
  const { frame } = doorFor({ gameCoach: async () => coach, retired: () => () => {} });
  const play = await openCafe({ win: frame });
  play.begin('rush');
  const session = new CafeSession('rush', 7, { deck: ORDERS, orderLimit: 8, selectOrder: orders => orders[0] });
  session.spawn();
  const [a, b] = session.queue;
  const app = counter(play, session);
  app.stand(a);
  clock.t += 1_000;
  a.presentationId = app.presentTicket(a);
  play.delivery(a.presentationId, { audio: 'completed' });
  a.audioCompleted = true;
  app.state.cups = right(a.order);
  clock.t += 2_000;
  app.serve();
  app.stand(b);
  const held = b.order;
  for (const cups of [warmCoffee(), wrong(), right(held)]) {
    app.state.cups = cups;
    app.serve();
  }
  assert.deepEqual([b.attempts, b.first, session.queue.includes(b)], [0, null, true], '말하기 전 서빙은 받지 않는다');
  clock.t += 1_000;
  b.presentationId = app.presentTicket(b);
  play.delivery(b.presentationId, { audio: 'completed' });
  b.audioCompleted = true;
  const chosen = b.order;
  app.state.cups = right(chosen);
  clock.t += 2_000;
  app.serve();
  assert.equal(b.first, true);
  const events = await eventsOf(port);
  const shown = events.filter(event => event.type === 'practice.presented');
  const tried = events.filter(event => event.type === 'practice.attempted');
  assert.equal(shown.length, 2);
  assert.equal(shown[1].itemKey, orderMetadata(chosen).itemKey, '둘째 제시는 말할 때 고른 주문');
  assert.deepEqual(tried.map(event => event.verdict), ['correct', 'correct'], '말하기 전 서빙은 답으로 남지 않는다');
  assert.equal(tried[1].presentationId, shown[1].id);
  play.end();
  coach.dispose();
});

test('순간 맞춤 — FLOW_PRACTICE는 새 길에서 맞춤이 없고, 끄기 단추(fixed)는 순간 맞춤만 끈다', async () => {
  const { coach, clock } = await realCoach();
  const { frame } = doorFor({ gameCoach: async () => coach, retired: () => () => {} });
  const play = await openCafe({ win: frame });
  play.begin('open');
  const practice = play.live(FLOW_PRACTICE, { words: FLOW_WORDS });
  assert.deepEqual([practice.settings().adaptive, practice.intro().line], [false, null]);
  play.begin('rush');
  const fixed = play.live(FLOW_RUSH, { declared: { mode: 'fixed' }, words: FLOW_WORDS });
  const before = fixed.settings().values;
  const picks = [];
  const session = openShift(play, picks, { kind: 'rush', tuning: tuningFrom(before), begun: true });
  assert.equal(fixed.settings().adaptive, false);
  for (let i = 0; i < 3; i += 1) {
    const t = session.queue[0] ?? (session.spawn(), session.queue[0]);
    hear(play, t);
    if (i === 0) assert.equal(picks[0].engine, true, '끄기 단추를 눌러도 손님은 엔진이 고른다');
    clock.t += 5_000;
    const out = serve(play, session, t, wrong());
    assert.equal(out.recorded.verdict, 'incorrect', '기록도 그대로');
    assert.equal(out.line, null);
    serve(play, session, t, right(t.order));
  }
  assert.deepEqual(fixed.settings().values, before, '정해진 속도 그대로');
  assert.ok(fixed.trace().length > 0, '관찰은 하되 움직이지 않는다');
  play.end();
  coach.dispose();
});

test('며칠 뒤 주문 — 돌아온 단위(due())가 든 처음 듣는 주문 하나로 판 길이 1', async () => {
  const { coach, clock } = await realCoach();
  const calls = [];
  const { frame } = doorFor({ gameCoach: async () => spy(coach, calls), retired: () => () => {} });
  const play = await openCafe({ win: frame });
  assert.deepEqual(play.delayed(DELAYED_ORDERS), [], '돌아온 단위가 없으면 없다');
  const session = openShift(play, []);
  while (!session.done) {
    const t = session.queue[0];
    clock.t += 20_000;
    hear(play, t);
    serve(play, session, t, right(t.order));
  }
  play.end();
  clock.t += 3 * DAY;
  const due = new Set(coach.due().map(row => row.unit));
  const list = play.delayed(DELAYED_ORDERS);
  assert.ok(list.length > 0);
  for (const order of list) {
    assert.equal(coach.exposure(orderMetadata(order)).seen, false, `${order.id}: 처음 듣는 주문`);
    assert.ok(coach.itemUnits(orderMetadata(order).itemKey).some(row => due.has(row.unit)), `${order.id}: 돌아온 단위가 든다`);
  }
  calls.length = 0;
  const picks = [];
  const check = openShift(play, picks, { kind: 'delayed', deck: [list[0]], limit: 1 });
  const t = check.queue[0];
  assert.equal(t.order.id, list[0].id);
  hear(play, t);
  serve(play, check, t, right(t.order));
  assert.equal(check.done, true);
  assert.deepEqual(calls.find(([name]) => name === 'recommend')[2], { set: { length: 1, newLimit: 3 } });
  play.end();
  assert.equal(play.delayed(DELAYED_ORDERS).some(order => order.id === list[0].id), false, '들은 주문은 다시 권하지 않는다');
  coach.dispose();
});

// app.mjs의 토막 넷을 원문 그대로 한 몸으로 돌린다 — 진입(새 길 문 열기 ~ 옛 코치) · 기록의 자리(hosted) · 며칠 뒤 주문과 판을 다시 정한 뒤의
// 다시 열기 · 기록 지우기 단추와 기록의 자리 글. 토막이 읽는 이름(화면 $ · start 등)은 env에 두고 with로 읽는다(토막의 대입은 토막 안 let에 남는다).
const between = (text, from, to) => {
  const start = text.indexOf(from);
  const end = text.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `${from} … ${to}`);
  return text.slice(start, end);
};
function lobbyParts() {
  const text = source('./app.mjs');
  const entry = text.slice(text.indexOf('let atlasNext = null'), text.indexOf('\n', text.indexOf('SynkLearning?.createGame(', text.indexOf('let atlasNext = null'))));
  const parts = [
    entry.replace("import('./atlas-next-play.mjs')", '__load()'),
    between(text, '// SYNK WORLD 안에서는 기록이 계정의 것이다', '/* ── 아틀라스 순간 맞춤'),
    between(text, '// 며칠 뒤 주문 후보', '/* ── 상태 ── */'),
    between(text, '// 학습 기록 지우기: WORLD 계정이면', '// 지우기 결과는 누른 단추 바로 옆'),
  ];
  return new AsyncFunction(
    'env',
    `with (env) {\nlet coach = null, learningFailed = false;\nconst learn = (method, ...args) => { try { return coach?.[method](...args); } catch { return null; } };\n${parts.join('\n')}\nreturn { get atlasNext() { return atlasNext; }, get coach() { return coach; }, get hosted() { return hosted; }, startDelayed, refreshDelayed, reopenNext };\n}`,
  );
}
const SCOPE_START = { '#learning-scope': '학습 기록은 이 브라우저에만 저장되고', '#result-scope': '지금 연습한 기록은 저장할 수 있을 때 이 브라우저에 남아요.' };
function lobbyEnv(win, extra = {}) {
  const nodes = {};
  const $ = selector => (nodes[selector] ??= { hidden: selector.startsWith('#followup'), textContent: SCOPE_START[selector] ?? '' });
  const seen = { started: [], refreshed: 0, lobbies: 0 };
  const env = {
    nextDoor, devFlag, ended, window: win, localStorage: {}, __load: async () => ({ openCafe }), $,
    DELAYED_ORDERS, assignment: () => null, delayedOrders: () => [],
    start: (isReview, delayed) => seen.started.push([isReview, delayed?.id ?? null]),
    refreshRecommendation: () => { seen.refreshed += 1; }, renderLobby: () => { seen.lobbies += 1; },
    ...extra,
  };
  return { env, $, seen };
}
const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise(resolve => setTimeout(resolve, 2)); };

test('며칠 뒤 주문 — 단추가 보일 때 판을 다시 정한 뒤 누르면, 문을 다시 열고 다시 연 코치의 후보로 그 주문을 연다(GC4)', async () => {
  const { coach, clock } = await realCoach();
  const asked = [];
  const retirers = new Map();
  const { frame, door } = doorFor({
    gameCoach: async (...args) => (asked.push(args), coach),
    retired: (made, fn) => (retirers.set(made, fn), () => {}),
  });
  const { env, $, seen } = lobbyEnv(frame);
  const app = await lobbyParts()(env);
  // 한 판을 하고 사흘 뒤 — 며칠 뒤 주문 후보가 선다.
  const session = openShift(app.atlasNext, []);
  while (!session.done) {
    const t = session.queue[0];
    clock.t += 20_000;
    hear(app.atlasNext, t);
    serve(app.atlasNext, session, t, right(t.order));
  }
  app.atlasNext.end();
  await settle(); // 그 판의 저장이 끝난 뒤(사흘 뒤에 단추를 본다)
  clock.t += 3 * DAY;
  const list = app.atlasNext.delayed(DELAYED_ORDERS);
  assert.ok(list.length > 0);
  app.refreshDelayed();
  assert.equal($('#followup-start').hidden, false, '단추가 보인다');

  retirers.get(coach)({ reason: 'account' });
  assert.equal(app.atlasNext.retired, true);
  app.refreshDelayed();
  assert.equal($('#followup-start').hidden, false, '판을 다시 정한 뒤에도 숨기지 않는다 — 닫힌 겉은 후보를 모른다');
  app.startDelayed();
  await settle();
  assert.equal(asked.length, 2, '누르면 문을 다시 연다');
  assert.deepEqual(seen.started, [[false, list[0].id]], '다시 연 코치의 첫 후보로 며칠 뒤 주문을 연다');
  door.dispose();
  coach.dispose();
});

test('기록의 자리(hosted)와 기록 지우기 단추는 실제로 연 코치로 정하고, 판을 다시 정해 길이 바뀌면 다시 그린다(끝 판 C1)', async () => {
  // 꺼진 판(문도 깃발도 없음) — 지금과 같다: 옛 코치에 assignment가 있으면(WORLD 옛 학습 호스트의 겉) 숨기고 계정 글, 없으면 그대로.
  for (const world of [false, true]) {
    globalThis.SynkLearning = { createGame: () => (world ? { assignment: () => null } : {}) };
    const { env, $ } = lobbyEnv({ location: { hostname: 'synk.im', search: '' } });
    const app = await lobbyParts()(env);
    assert.equal(app.atlasNext, null);
    assert.equal(app.hosted, world);
    assert.equal($('#learning-reset').hidden, world);
    assert.equal($('#learning-scope').textContent.startsWith('연습 기록은 WORLD 계정에'), world);
    if (!world) assert.equal($('#result-scope').textContent, SCOPE_START['#result-scope'], '글을 건드리지 않는다');
  }

  // ① 새 길로 정해진 판에서 코치를 열지 못하면(RUN_ENDED 밖의 실패) 옛 기록 지우기 단추를 보이지 않는다.
  {
    const { frame, door } = doorFor({ gameCoach: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); }, retired: () => () => {} });
    const { env, $ } = lobbyEnv(frame);
    const app = await lobbyParts()(env);
    assert.deepEqual([app.atlasNext, app.coach, app.hosted], [null, null, false]);
    assert.equal($('#learning-reset').hidden, true, '새 길 판에는 이 화면의 기록 지우기가 없다');
    door.dispose();
  }

  // ② 손님 코치 → (판을 다시 정함) 계정 코치 → (다시 정함) 지금 판(옛 코치 — assignment 없음). 길이 바뀔 때마다 다시 그린다.
  const guest = await realCoach();
  const other = await realCoach();
  const account = {
    ...spy(other.coach, []),
    summary: () => {
      const summary = other.coach.summary();
      return { ...summary, storage: { ...summary.storage, guest: false } };
    },
  };
  const queue = [guest.coach, account, null];
  const retirers = new Map();
  const { frame, door } = doorFor({ gameCoach: async () => queue.shift(), retired: (made, fn) => (retirers.set(made, fn), () => {}) });
  const { env, $, seen } = lobbyEnv(frame);
  const app = await lobbyParts()(env);
  assert.equal(app.hosted, false, '손님 코치');
  assert.equal($('#learning-reset').hidden, true);
  assert.equal($('#learning-scope').textContent, SCOPE_START['#learning-scope']);

  const then = [];
  retirers.get(guest.coach)({ reason: 'account' });
  app.reopenNext(() => then.push('next'));
  await settle();
  assert.deepEqual(then, ['next']);
  assert.equal(app.atlasNext.hosted, true, '겉도 다시 연 코치로 다시 정한다');
  assert.equal(app.hosted, true, '계정 코치');
  assert.match($('#learning-scope').textContent, /^연습 기록은 WORLD 계정에/);
  assert.match($('#result-scope').textContent, /연습 기록은 WORLD 계정에 이어지고/);
  assert.equal($('#learning-reset').hidden, true);
  assert.deepEqual([seen.refreshed, seen.lobbies], [1, 1], '입구의 다음 이유 · 단추를 다시 연 코치로 다시 그린다');

  globalThis.SynkLearning = { createGame: () => ({ old: true }) };
  retirers.get(account)({ reason: 'switch' });
  app.reopenNext(() => then.push('old'));
  await settle();
  assert.deepEqual(then, ['next', 'old']);
  assert.deepEqual([app.atlasNext, app.coach], [null, { old: true }], '지금 판 — 옛 코치');
  assert.equal(app.hosted, false);
  assert.equal($('#learning-reset').hidden, false, '옛 길은 지금처럼 — 계정 기록이 아니면 지우기 단추가 보인다');
  assert.equal($('#learning-scope').textContent, SCOPE_START['#learning-scope'], '처음 글로 되돌린다');
  assert.equal($('#result-scope').textContent, SCOPE_START['#result-scope']);
  assert.deepEqual([seen.refreshed, seen.lobbies], [2, 2], '옛 코치로 다음 이유를 다시 받는다(닫힌 새 코치의 이유가 남지 않는다)');
  delete globalThis.SynkLearning;
  door.dispose();
  guest.coach.dispose();
  other.coach.dispose();
});

test('판을 다시 정하면 이번 판은 기록 없이 잇고, 다음 판에서 openNext를 다시 부른다(새 겉 · 지금 판이면 옛 길 · 패널이 닫혔으면 기록 없이)', async () => {
  const one = await realCoach();
  const two = await realCoach();
  const queue = [one.coach, two.coach, null];
  const retirers = new Map();
  const asked = [];
  const entry = {
    gameCoach: async (...args) => {
      asked.push(args);
      return queue.shift();
    },
    retired: (made, fn) => {
      retirers.set(made, fn);
      return () => retirers.delete(made);
    },
  };
  const { frame, door, top } = doorFor(entry);
  const play = await openCafe({ win: frame });
  play.begin('open');
  const pick = play.pick(ORDERS);
  const pid = play.present(orderMetadata(pick.selected));
  retirers.get(one.coach)({ reason: 'account' });
  assert.equal(play.retired, true);
  // 이번 판은 기록 없이 — 고르기는 게임 차례, 제시는 자리표, 답 · 도움 · 판 닫기는 부르지 않는다(던지지 않는다).
  const after = play.pick(ORDERS.slice(1));
  assert.deepEqual([after.engine, after.why, after.selected.id], [false, null, ORDERS[1].id]);
  assert.match(play.present(orderMetadata(after.selected)), /^ended:/);
  assert.equal(play.answer(pid, { correct: true, assessable: true }), null);
  assert.equal(play.help(pid, 'text'), null);
  play.end();
  assert.equal(asked.length, 1, '판 안에서는 다시 열지 않는다');

  // 다음 판: openNext를 다시 — 새 겉.
  assert.equal(await play.reopen(), 'next');
  assert.equal(asked.length, 2);
  assert.equal(play.retired, false);
  play.begin('open');
  const fresh = play.pick(ORDERS);
  const freshPid = play.present(orderMetadata(fresh.selected));
  assert.doesNotMatch(freshPid, /^ended:/);
  play.answer(freshPid, { correct: true, assessable: true });
  const events = await eventsOf(two.port);
  assert.equal(events.filter(event => event.type === 'practice.attempted').length, 1, '새 겉의 코치에 기록된다');
  const old = await eventsOf(one.port);
  assert.equal(old.filter(event => event.type === 'practice.attempted').length, 0, '다시 정한 뒤의 답은 앞 코치에 남지 않는다');

  // 다시 정한 뒤 지금 판(null)이면 옛 길.
  retirers.get(two.coach)({ reason: 'switch' });
  assert.equal(await play.reopen(), 'old');

  // 패널이 닫혀 문이 치워졌으면 옛 길을 열지 않는다.
  const three = await realCoach();
  const later = doorFor({ gameCoach: async () => three.coach, retired: (made, fn) => (retirers.set(made, fn), () => {}) });
  const other = await openCafe({ win: later.frame });
  retirers.get(three.coach)({ reason: 'account' });
  later.door.dispose();
  delete later.top.SYNKAtlasGame;
  assert.equal(await other.reopen(), 'ended');
  assert.equal(other.retired, false, '닫힌 겉은 다시 열지 않는다');
  assert.match(other.present(orderMetadata(ORDERS[0])), /^ended:/);
  door.dispose();
  delete top.SYNKAtlasGame;
  for (const made of [one, two, three]) made.coach.dispose();
});

test('패널이 닫히면 기록 없이 잇는다 — 오류는 code로만 가르고(RUN_ENDED · PRESENTATION_GONE), 다른 오류는 게임에 그대로 던진다', async () => {
  const { coach } = await realCoach();
  const { frame, door } = doorFor({ gameCoach: async () => coach, retired: () => () => {} });
  const play = await openCafe({ win: frame });
  play.begin('open');
  const pid = play.present(orderMetadata(play.pick(ORDERS).selected));
  assert.throws(() => play.help(pid, 'shout'), TypeError, '판정 못 할 부름은 게임의 learn()이 받는다(learningFailed)');
  play.end();
  assert.equal(play.help(pid, 'answer'), null, '닫은 판의 제시(PRESENTATION_GONE)는 기록 없이');
  play.begin('open');
  const live = play.pick(ORDERS);
  const open = play.present(orderMetadata(live.selected));
  door.dispose();
  await new Promise(resolve => setTimeout(resolve, 0)); // 문은 겉과 판을 셸 창의 다음 차례에 닫는다(끝 판 GD5)
  assert.equal(play.answer(open, { correct: true, assessable: true }), null);
  assert.equal(play.delivery(open, { audio: 'completed' }), null);
  assert.match(play.present(orderMetadata(ORDERS[1])), /^ended:/);
  assert.deepEqual(play.pick(ORDERS).engine, false);
  assert.deepEqual(play.delayed(DELAYED_ORDERS), []);
  assert.equal(play.reason(ORDERS), null);
  play.end();
  coach.dispose();
});

test('초급 가게 — 정해진 차례라 present만 하고(recommend 없음), 장이 끝나면 판을 닫는다(코치에 startSet이 없으면 첫 제시가 기본 판으로 연다)', async () => {
  const { coach, port, clock } = await realCoach();
  const calls = [];
  const { frame } = doorFor({ gameCoach: async () => spy(coach, calls), retired: () => () => {} });
  const shop = await openShop({ win: frame });
  shop.end();
  assert.equal(calls.length, 0, '낸 것이 없으면 닫을 판도 없다');
  const orders = stageOrders(0, 3);
  orders.forEach((order, at) => {
    clock.t += 15_000;
    assert.equal(shop.begin(orders.length - at), null, '지금 엔진(startSet 없음)은 판 길이를 넘기지 않는다');
    const pid = shop.present(shopMetadata(order));
    shop.delivery(pid, { audio: 'pending' });
    shop.delivery(pid, { audio: 'completed' });
    if (at === 0) shop.help(pid, 'text');
    shop.answer(pid, { correct: at !== 1, assessable: true });
  });
  shop.end();
  assert.equal(calls.filter(([name]) => name === 'recommend').length, 0);
  assert.deepEqual(calls.at(-1), ['finishSet', { record: false }]);
  const events = await eventsOf(port);
  const presented = events.filter(event => event.type === 'practice.presented');
  assert.deepEqual(presented.map(event => event.itemKey).sort(), orders.map(order => shopMetadata(order).itemKey).sort());
  assert.ok(presented.every(event => event.arm === 'host'), '제품 차례');
  assert.deepEqual(
    events.filter(event => event.type === 'practice.attempted').map(event => event.verdict).sort(),
    ['correct', 'correct', 'correct', 'correct', 'correct', 'incorrect'],
  );
  assert.equal(calls.filter(([name]) => name === 'startSet').length, 0);
  coach.dispose();
});

// 승인된 코치 startSet의 꼴(설계 주인 11-19 밤): 열린 판이 없으면 판 길이로 새 판을 열고, 이 코치의 판이 이미 열려 있으면 새 판을 열지
// 않는다({ opened: false, setId }). 판은 첫 제시가 기본 판으로도 열고 finishSet이 닫는다. 엔진에 들어오기 전이라 첩자 코치에 붙인다.
function withStartSet(target, calls) {
  let made = 0;
  let open = null;
  return {
    ...target,
    startSet(options) {
      calls.push(['startSet', options]);
      if (open) return { opened: false, setId: open };
      open = `set-${(made += 1)}`;
      return { opened: true, setId: open };
    },
    present(...args) {
      open ??= `set-${(made += 1)}`;
      return target.present(...args);
    },
    finishSet(...args) {
      open = null;
      return target.finishSet(...args);
    },
  };
}

test('초급 가게 — 판마다 첫 제시 전에 startSet({ length: 그 판에서 남은 주문 수 })을 한 번 부르고, 판을 닫고 다음 판을 열면 다시 부른다', async () => {
  const { coach, clock } = await realCoach();
  const calls = [];
  const { frame, door } = doorFor({ gameCoach: async () => withStartSet(spy(coach, calls), calls), retired: () => () => {} });
  const shop = await openShop({ win: frame });
  // beginner.mjs의 차례: 제시마다 그 직전에 begin(남은 주문 수) → present, 장 · 복습이 끝나거나 입구로 가면 end().
  const sets = [
    { name: '첫 장(주문 6)', orders: stageOrders(0, 3), from: 0 },
    { name: '이어 하기(셋째 주문부터 — 남은 4)', orders: stageOrders(1, 3), from: 2 },
    { name: '축제 다시 열기(주문 9)', orders: stageOrders(3, 5), from: 0 },
  ];
  const opened = [];
  for (const { orders, from } of sets) {
    for (let at = from; at < orders.length; at += 1) {
      clock.t += 15_000;
      const started = shop.begin(orders.length - at);
      if (at === from) opened.push(started);
      else assert.equal(started, null, '열린 판에서는 다시 부르지 않는다');
      const pid = shop.present(shopMetadata(orders[at]));
      assert.ok(pid);
      shop.delivery(pid, { audio: 'pending' });
      shop.delivery(pid, { audio: 'completed' });
      shop.answer(pid, { correct: true, assessable: true });
    }
    shop.end();
  }
  assert.deepEqual(opened, [
    { opened: true, setId: 'set-1' },
    { opened: true, setId: 'set-2' },
    { opened: true, setId: 'set-3' },
  ]);
  // 판마다(finishSet으로 가른 토막) startSet은 한 번, 그 판의 첫 present보다 먼저.
  const segments = [[]];
  for (const call of calls) {
    segments.at(-1).push(call);
    if (call[0] === 'finishSet') segments.push([]);
  }
  assert.deepEqual(segments.pop(), []);
  assert.equal(segments.length, sets.length);
  segments.forEach((segment, at) => {
    const { name, orders, from } = sets[at];
    const names = segment.map(([method]) => method);
    assert.deepEqual(
      segment.filter(([method]) => method === 'startSet'),
      [['startSet', { length: orders.length - from }]],
      `${name}: 판 길이 한 번`,
    );
    assert.equal(names[0], 'startSet', `${name}: 첫 present보다 먼저`);
    assert.equal(names.filter(method => method === 'present').length, orders.length - from);
    assert.deepEqual(segment.at(-1), ['finishSet', { record: false }]);
  });
  assert.equal(calls.filter(([name]) => name === 'recommend').length, 0);

  // 판 길이를 넘긴 뒤 낸 것 없이 입구로 가도 그 판을 닫는다 — 다음 판의 startSet이 열린 판에 막히지 않는다.
  calls.length = 0;
  assert.deepEqual(shop.begin(6), { opened: true, setId: 'set-4' });
  shop.end();
  assert.deepEqual(calls, [['startSet', { length: 6 }], ['finishSet', { record: false }]]);
  // 길이가 없으면 넘기지 않고 첫 제시가 기본 판으로 연다.
  calls.length = 0;
  assert.equal(shop.begin(null), null);
  assert.equal(calls.length, 0);
  // 패널이 닫히면(RUN_ENDED) 기록 없이 잇는다 — 문은 겉과 판을 셸 창의 다음 차례에 닫는다(끝 판 GD5).
  door.dispose();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(shop.begin(6), null);
  assert.equal(shop.present(shopMetadata(stageOrders(0, 3)[0])), null);
  coach.dispose();
});

test('원문 — 초급 가게는 제시 직전에 남은 주문 수를 넘기고(60초 러시는 넘기지 않는다), 쉬던 놀이에서 소풍을 열면 앞 판을 먼저 닫는다', () => {
  const text = source('./beginner.mjs');
  const start = text.slice(text.indexOf('function startPlay('), text.indexOf('function guest('));
  const begin = start.indexOf("if (atlasNext && !rush) learn('begin', orders.length - index);");
  assert.ok(begin > 0, '새 길에서만 · 러시가 아닐 때만');
  assert.ok(begin < start.indexOf("presentation = learn('present', metadata(current));"), '제시보다 먼저');
  assert.equal(text.match(/learn\('begin'/g)?.length, 1);
  const picnic = text.slice(text.indexOf("if (kind === 'picnic') {"), text.indexOf("busy = false; rush = kind === 'rush';"));
  const close = picnic.indexOf("if (atlasNext && screen === 'play') { closeObservation(); learn('end'); }");
  assert.ok(close > 0 && close < picnic.indexOf('startPlay(true)'), '소풍 판을 열기 전에 앞 판을 닫는다');
});

// beginner.mjs의 서빙 토막(판정 · 시도 수 · 코치에 넘기는 답)을 원문 그대로 돌린다 — 서빙 뒤 화면 그리기는 빼고.
function serveStep() {
  const text = source('./beginner.mjs');
  const body = between(text, 'function serve() {', '  if (!result.correct) {').slice('function serve() {'.length);
  return new Function('env', `with (env) {\n${body}\nreturn result;\n}`);
}

test('초급 가게 — 새 길에서는 고쳐 건넨 답도 같은 제시의 다음 답으로 넘기고, 옛 길은 지금처럼 첫 서빙만 넘긴다(GC5)', async () => {
  const { coach, port, clock } = await realCoach();
  const { frame } = doorFor({ gameCoach: async () => coach, retired: () => () => {} });
  const shop = await openShop({ win: frame });
  const order = stageOrders(0, 3).find(one => one.item === 'water');
  shop.begin(6);
  const pid = shop.present(shopMetadata(order));
  shop.delivery(pid, { audio: 'pending' });
  shop.delivery(pid, { audio: 'completed' });
  // beginner.mjs의 learn 그대로 — 제시 번호가 없는 답 · 도움 · 전달은 부르지 않고, 던지면 삼킨다.
  const learnOf = target => (method, ...args) => {
    if (['answer', 'help', 'delivery'].includes(method) && !args[0]) return null;
    try { return target?.[method]?.(...args); } catch { return null; }
  };
  const run = serveStep();
  const env = {
    screen: 'play', paused: false, solved: false, busy: false, phase: 'order', judge, current: order, presentation: pid,
    attempt: { heard: true, attempts: 0, firstCorrect: null }, tray: ['bread'], learn: learnOf(shop), atlasNext: shop,
  };
  assert.equal(run(env).correct, false, '물 주문에 빵을 냈다');
  shop.help(pid, 'hint');
  clock.t += 5_000;
  env.tray = ['water'];
  assert.equal(run(env).correct, true, '물로 고쳐 건넸다');
  shop.end();
  const events = await eventsOf(port);
  const tries = events.filter(event => event.type === 'practice.attempted' && event.presentationId === pid);
  assert.deepEqual(tries.map(event => [event.attemptNo, event.verdict]), [[1, 'incorrect'], [2, 'correct']], '뒤 답도 같은 제시의 다음 답');

  // 옛 길(문이 없음 — atlasNext null): 지금처럼 첫 서빙만 넘긴다.
  const old = [];
  const before = { ...env, atlasNext: null, attempt: { heard: true, attempts: 0, firstCorrect: null }, tray: ['bread'], presentation: 'p1', learn: (...args) => old.push(args) };
  run(before);
  before.tray = ['water'];
  run(before);
  assert.deepEqual(old, [['answer', 'p1', { correct: false, assessable: true, reason: undefined }]]);
  coach.dispose();
});
