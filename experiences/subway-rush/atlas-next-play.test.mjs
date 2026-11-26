// 환승 러시의 새 길(Atlas 재설계 단계 4 §23-7 · §23-10 「게임」) — atlas-next-play.mjs와 app.mjs의 기록 길 고르기.
// 꺼진 판(문 없음)은 지금과 같은 인수로 같은 때(모듈 첫 실행, 기다림 없이) 옛 코치를 만들고 새 길 모듈을 싣지 않는다. 문이 있고 open이 null이면
// 옛 길로 정상 시작, RUN_ENDED면 옛 길을 열지 않는다. 진짜 엔진 코치를 가짜 입구로 셸의 문(createGameDoor)에 넣고 틀 창의 키트로 열어
// 문을 거친 그대로 한 판씩 돈다 — 여정 고르기(set: {}), 제시 · 전달 · 도움 · 답의 차례, 은행에 없는 「그대로」는 내지 않음, 판 끝 finishSet,
// none(같은 날 넷째 게임 — 게임 차례 · 이유 줄 없음) · idle, 떠날 때 열린 제시를 unanswered로 닫고 셸의 판 닫기가 그 뒤, 판을 다시 정하면 다음 여정에서 다시 열기.
import test from 'node:test';
import { namelessLine } from './kit/atlas-next.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';
import { BANKS, createNextPlay, openLearning } from './atlas-next-play.mjs';
import { GAME_ID, answerPayload, decisionMeta, meetingMeta } from './learning.mjs';
import { buildJourney } from './journeys.mjs';
import { planDay } from './people.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const INDEX = readJson('../../packages/atlas/map/index.json');
const UNITS = readJson('../../packages/atlas/map/units.json');
const WORDS = readJson('../../packages/atlas/map/words.json'); // 셸이 여는 은행 조각처럼 낱말 이름이 서게(이유 줄)
const APP = fs.readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0); // 서울 10시
const COACH_METHODS = ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live'];

const clockAt = (start = T0) => { const state = { t: start }; return { now: () => state.t, advance: (ms = 4000) => (state.t += ms) }; };
let stores = 0;
async function realCoach({ clock, port = atlas.memoryPort(), key = null, gameId = GAME_ID }) {
  stores += 1;
  const coach = atlas.createCoach({
    gameId,
    mapData: { index: INDEX, units: UNITS, words: WORDS },
    dayOffset: 540,
    host: { guest: true, port, key: key ?? `synk-atlas:subway-rush-test-${process.pid}-${stores}`, now: clock.now },
  });
  await coach.ready;
  return { coach, port };
}
// 셸 창 코치를 지켜보는 겉 — 부른 차례와 인수 · 결과를 적는다(문은 이 객체의 메서드를 부른다).
function spied(coach) {
  const calls = [];
  const spy = { calls };
  for (const name of COACH_METHODS) spy[name] = (...args) => { const row = [name, args]; calls.push(row); row.push(coach[name](...args)); return row[2]; };
  return spy;
}
// 가짜 입구(셸 world-atlas-next.mjs gameCoach · retired) — give()가 돌려준 코치를 문이 겉으로 감싼다.
function entryOf(give) {
  const retirers = new Map();
  return {
    asked: [],
    async gameCoach(gameId, banks) { this.asked.push([gameId, banks]); return give(); },
    retired(made, fn) { retirers.set(made, fn); return () => retirers.delete(made); },
    retire(made, reason = 'account') { retirers.get(made)?.({ reason }); },
  };
}
const tasks = () => { const queue = []; return { later: (fn) => queue.push(fn), run: () => queue.splice(0).forEach((fn) => fn()) }; };
// 틀 창 — 위 창(셸)에 문이 있다. leave()는 pagehide를 건 차례대로 부른다.
function frameOf(door) {
  const listeners = [];
  const top = { SYNKAtlasGame: door.api };
  return { parent: top, top, listeners, location: { hostname: 'synk.im', search: '' }, addEventListener: (type, fn) => listeners.push([type, fn]), leave() { for (const [type, fn] of listeners) if (type === 'pagehide') fn(); } };
}
// 진짜 코치를 셸의 문에 넣고 틀에서 새 길로 연다.
async function opened({ clock = clockAt(), give = null, port = atlas.memoryPort(), key = null } = {}) {
  const { coach } = await realCoach({ clock, port, key });
  const spy = spied(coach);
  const entry = entryOf(() => (give ? give(spy) : spy));
  const shell = tasks();
  const door = createGameDoor({ entry, gameId: GAME_ID, later: shell.later });
  const frame = frameOf(door);
  let olds = 0;
  const out = await openLearning({ win: frame, old: () => { olds += 1; return 'old-coach'; } });
  return { ...out, coach, port, spy, entry, shell, door, frame, clock, olds: () => olds };
}
const candidates = (seed, level = 'basic') => Array.from({ length: 12 }, (_, i) => buildJourney({ seed: seed + i * 7919, level }));
const events = async (coach, port) => { await coach.finishSet({ record: false }).folded; return (await port.read()).filter((row) => row.value?.kind === 'event').map((row) => row.value.event); };
const names = (spy) => spy.calls.map(([name]) => name);

// app.mjs의 차례 그대로: 결정마다 제시 → (안내를 다 들음) 전달 → (도움) → 답, 결정 뒤 만남이 있으면 만남의 제시 → 전달 → 답.
function playThrough(play, journey, clock, { wrong = new Set(), help = new Set() } = {}) {
  const plan = planDay(journey);
  const step = () => clock.advance(4000);
  journey.decisions.forEach((d, i) => {
    const ex = play.exchange(decisionMeta(d)); step();
    ex.heard(true); step();
    if (help.has(i)) { ex.help('replay'); step(); }
    const correct = !wrong.has(i), chosen = correct ? d.answer : d.options.find((o) => o.id !== d.answer).id;
    ex.answer(answerPayload({ correct, assessable: d.assessable, selectedId: `subway.${chosen}`, correctId: `subway.${d.answer}`, reason: d.kind === 'stop' && !d.assessable ? 'guessable' : null })); step();
    const m = plan.meetings.find((x) => x.after === i);
    if (m?.scene.item) {
      const mx = play.exchange(meetingMeta(m.scene.item)); step();
      mx.heard(true); step();
      mx.answer(answerPayload({ correct: true, assessable: true, selectedId: `subway.${m.scene.answer}`, correctId: `subway.${m.scene.answer}` })); step();
    }
  });
  return plan;
}
// 그 여정에서 기록될 문항(은행에 있는 결정 · 만남) — 차례대로.
function bankedOf(journey, plan) {
  const out = [];
  journey.decisions.forEach((d, i) => {
    if (d.assessable) out.push(decisionMeta(d).itemKey);
    const m = plan.meetings.find((x) => x.after === i);
    if (m?.scene.item) out.push(meetingMeta(m.scene.item).itemKey);
  });
  return out;
}
const lastRecommend = (spy) => spy.calls.filter(([name]) => name === 'recommend').at(-1);

test('은행 이름은 셸의 게임 은행 표와 같고, 은행에 든 결정은 근거로 세는 결정뿐이다(찍어도 맞는 「그대로」는 은행 밖)', async () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS[GAME_ID]]);
  const clock = clockAt();
  const { coach } = await realCoach({ clock });
  const seen = new Map();
  for (const level of ['basic', 'busy']) for (let seed = 1; seed < 400; seed++) for (const d of buildJourney({ seed, level }).decisions) seen.set(decisionMeta(d).itemKey, d.assessable);
  for (const [itemKey, assessable] of seen) assert.equal(coach.itemUnits(itemKey).length > 0, assessable, itemKey);
  assert.ok([...seen.values()].includes(false), '은행 밖 결정이 있는 생성기 판을 본다');
});

test('app.mjs 원문 — 새 길 모듈은 정적 import에 없고 문 · 개발 깃발이 있을 때만 동적으로 싣는다, 옛 코치는 지금 자리 · 인수 그대로', () => {
  const statics = [...APP.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(!statics.includes('./kit/atlas-next.mjs'), '키트는 정적으로 싣지 않는다 — 새 길 모듈이 부른다(5-3 게임)');
  assert.ok(!statics.some((s) => s.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  const code = APP.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.equal(code.match(/atlas-next-play/g).length, 1, '새 길 모듈을 부르는 자리는 하나');
  assert.equal(code.match(/await import\('\.\/atlas-next-play\.mjs\?v=[\w-]+'\)/g).length, 1, '그 자리는 동적 import');
  assert.ok(!APP.includes("'/atlas/"), '게임은 입구를 스스로 부르지 않는다(개발 깃발 길은 키트가)');
  assert.equal(APP.match(/createGame\(/g).length, 1);
  assert.ok(APP.includes('const oldCoach = () => { try { return window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { return null; } };'), '옛 코치는 지금 인수 그대로');
  const scene = APP.indexOf('const scene = await readyOrAsk('), open = APP.indexOf('let { coach, nextPlay } = '), cars = APP.indexOf('const availableCars');
  assert.ok(scene >= 0 && scene < open && open < cars, '옛 코치를 만드는 자리는 지금과 같다(장면을 만든 뒤, 나머지 정의 앞)');
  assert.match(APP, /let \{ coach, nextPlay \} = atlasGate\(window\) \? await import\([^)]*\)\.then\(\(m\) => m\.openLearning\(\{ win: window, old: oldCoach \}\)\)\.catch\([^\n]*\) : \{ coach: oldCoach\(\), nextPlay: null \};/);
  // 결정 · 만남의 기록은 한 자리를 거친다 — 꺼진 판은 지금처럼 createExchange(coach, meta).
  assert.ok(APP.includes('const exchangeOf = (meta) => nextPlay ? nextPlay.exchange(meta) : createExchange(coach, meta);'));
  assert.equal(APP.match(/createExchange\(/g).length, 1);
  assert.equal(APP.match(/exchangeOf\(/g).length, 4, '결정 셋(열차 · 표지 · 승강장) · 만남 하나');
  // 여정 고르기: 꺼진 판은 지금 줄 그대로(재방문 맞춤 · 아틀라스가 고른 판 · 입구 한 줄), 새 길은 코치가 고른 여정.
  const start = APP.slice(APP.indexOf('async function start()'), APP.indexOf('\n}\n', APP.indexOf('async function start()')));
  for (const line of [
    'if (nextPlay?.retired) ({ coach, nextPlay } = await nextPlay.renew());',
    'const returning = query.get(\'seed\') ? null : missedPractice(learner, level);',
    'journey = query.get(\'seed\') ? buildJourney({ seed, level }) : returning?.journey || preferJourney(learner, Array.from({ length: 12 }, (_, i) => buildJourney({ seed: seed + i * 7919, level })));',
    'journey.note = query.get(\'seed\') ? null : entryNote(learner, returning);',
    'const run = await playJourney(journey, plan);\n  nextPlay?.end();',
  ]) assert.ok(start.includes(line), line);
  assert.ok(start.indexOf('const learner = personalCoach();') > start.indexOf('} else {'), '옛 길에서만 옛 기록을 읽는다');
});

// app.mjs의 두 줄(옛 코치 · 기록 길 고르기)을 그대로 떼어 가짜 창으로 돌린다 — 동적 import만 load()로 바꾼다.
const AsyncFunction = (async () => {}).constructor;
function appOpening() {
  const lines = APP.split('\n').filter((line) => line.startsWith('const oldCoach = ') || line.startsWith('let { coach, nextPlay } = '));
  assert.equal(lines.length, 2);
  // 앱 안의 문 확인 함수도 그대로 뗀다(원본과 같은 글자인지는 play-common/atlas-gate.test.mjs가 본다 — 5-3 게임).
  const gate = /function atlasGate\(win\) \{[\s\S]*?\r?\n\}\r?\n/.exec(APP)?.[0];
  assert.ok(gate);
  const body = [gate, ...lines].join('\n').replace(/import\('\.\/atlas-next-play\.mjs\?v=[\w-]+'\)/, 'load()');
  assert.ok(body.includes('load()'));
  return new AsyncFunction('window', 'GAME_ID', 'load', 'console', `${body}\nreturn { coach, nextPlay };`);
}
function gameWindow({ parent = null } = {}) {
  const created = [];
  const storage = { getItem: () => null };
  const win = { localStorage: storage, location: { hostname: 'synk.im', search: '' }, addEventListener() {}, SynkLearning: { createGame: (options) => { created.push(options); return { old: true }; } } };
  win.parent = parent ?? win; win.top = parent ?? win;
  return { win, created, storage };
}
const realModule = async () => import('./atlas-next-play.mjs');

test('꺼진 판 — 문이 없으면 옛 코치를 지금 인수로 기다림 없이 만들고 새 길 모듈을 싣지 않는다', async () => {
  const run = appOpening();
  const { win, created, storage } = gameWindow();
  let loads = 0;
  const pending = run(win, GAME_ID, () => { loads += 1; return realModule(); }, console);
  assert.equal(created.length, 1, '부른 그 차례에(기다림 없이) 옛 코치를 만든다');
  assert.deepEqual(created[0], { gameId: 'subway-rush', storage });
  assert.equal(created[0].storage, storage);
  const out = await pending;
  assert.deepEqual(out, { coach: { old: true }, nextPlay: null });
  assert.equal(loads, 0, '새 길 모듈을 싣지 않는다');
});

test('문이 있고 open이 null(지금 판)이면 옛 길로 정상 시작, RUN_ENDED · 모듈을 못 실으면 옛 길을 열지 않는다', async () => {
  const run = appOpening();
  const cases = [
    [async () => null, { coach: { old: true }, nextPlay: null }, 1],
    [async () => { throw { code: 'RUN_ENDED' }; }, { coach: null, nextPlay: null }, 0], // 셸 창의 오류 — 틀에서 instanceof Error가 거짓
  ];
  for (const [open, want, olds] of cases) {
    const { win, created } = gameWindow({ parent: { SYNKAtlasGame: { open } } });
    let loads = 0;
    const out = await run(win, GAME_ID, () => { loads += 1; return realModule(); }, console);
    assert.equal(loads, 1);
    assert.deepEqual(out, want);
    assert.equal(created.length, olds);
  }
  const { win, created } = gameWindow({ parent: { SYNKAtlasGame: { open: async () => null } } });
  const errors = [];
  const out = await run(win, GAME_ID, () => Promise.reject(Object.assign(new Error('load'), { code: 'X' })), { error: (e) => errors.push(e) });
  assert.deepEqual(out, { coach: null, nextPlay: null });
  assert.equal(created.length, 0, '새 길로 정해진 계정에 옛 길을 열지 않는다');
  assert.equal(errors.length, 1);
});

test('문을 거친 진짜 코치로 한 여정 — 고르기(set: {}) · 제시 · 전달 · 도움 · 답의 차례, 「그대로」는 내지 않음, 판 끝 finishSet', async () => {
  const run = appOpening();
  const clock = clockAt();
  const { coach, port } = await realCoach({ clock });
  const spy = spied(coach);
  const door = createGameDoor({ entry: entryOf(() => spy), gameId: GAME_ID, later: (fn) => fn() });
  const { win, created } = gameWindow({ parent: { SYNKAtlasGame: door.api } });
  const listeners = [];
  win.addEventListener = (type, fn) => listeners.push([type, fn]);
  const { coach: old, nextPlay: play } = await run(win, GAME_ID, realModule, console);
  assert.equal(old, null);
  assert.equal(created.length, 0, '새 길이면 옛 코치를 만들지 않는다');
  assert.deepEqual(listeners.map(([type]) => type), ['pagehide', 'pagehide'], '키트의 leave가 먼저, 게임의 떠날 때 답이 뒤');

  const journeys = candidates(1234);
  const picked = play.pick(journeys);
  const [, [items, options], result] = lastRecommend(spy);
  assert.deepEqual(options, { set: {} }, '시간으로 끝나는 판 — 길이 모름');
  assert.equal(new Set(items.map((item) => item.itemKey)).size, items.length);
  assert.ok(items.length > 6 && items.every((item) => coach.itemUnits(item.itemKey).length), '후보는 후보 여정들의 근거 결정 문항');
  assert.equal(result.status, 'ready', '빈 기억 손님의 첫 여정은 엔진이 고른다');
  assert.equal(picked.engine, true);
  assert.ok(journeys.includes(picked.journey));
  assert.ok(picked.journey.decisions.some((d) => d.assessable && decisionMeta(d).itemKey === result.selected.itemKey), '고른 문항이 든 여정');
  // 이유 줄은 이 판에서 아직 평가하지 않은 단위의 이름을 말하지 않는다 — 키트가 이름 없는 줄로 바꾼다(5-3 게임 GE1).
  assert.equal(picked.note, namelessLine(result.why), '입구 한 줄은 코치의 이유 — 첫 평가 전이라 이름 없이');
  assert.ok(typeof picked.note === 'string' && picked.note.length > 0);
  assert.notEqual(picked.note, result.why.line);

  const journey = picked.journey;
  const plan = playThrough(play, journey, clock, { wrong: new Set([1]), help: new Set([0]) });
  play.end();
  assert.deepEqual(spy.calls.at(-1).slice(0, 2), ['finishSet', [{ record: false }]], '여정 끝 — 판을 기록 없이 닫는다');
  assert.ok(!names(spy).includes('summary') && !names(spy).includes('live'), '옛 요약 · 순간 맞춤을 쓰지 않는다');

  const rows = await events(coach, port);
  const shown = rows.filter((e) => e.type === 'practice.presented');
  const want = bankedOf(journey, plan);
  assert.deepEqual(shown.map((e) => e.itemKey), want, '여정의 차례대로, 은행에 있는 결정 · 만남만');
  assert.equal(new Set(shown.map((e) => e.setId)).size, 1, '여정 하나가 판 하나');
  for (const e of shown) if (e.itemKey !== result.selected.itemKey) assert.equal(e.arm, 'host', `제품 차례: ${e.itemKey}`);
  for (const e of shown) {
    const kids = rows.filter((x) => x.presentationId === e.id).map((x) => x.type);
    const helped = e.itemKey === decisionMeta(journey.decisions[0]).itemKey && journey.decisions[0].assessable;
    assert.deepEqual(kids, ['practice.delivery', ...(helped ? ['practice.helped'] : []), 'practice.attempted'], e.itemKey);
  }
  const attempts = new Map(rows.filter((e) => e.type === 'practice.attempted').map((e) => [shown.find((s) => s.id === e.presentationId).itemKey, e]));
  journey.decisions.forEach((d, i) => {
    if (!d.assessable) return;
    const a = attempts.get(decisionMeta(d).itemKey);
    assert.equal(a.verdict, i === 1 ? 'incorrect' : 'correct', d.id);
    assert.equal(a.choice.correctId, `subway.${d.answer}`);
  });
  assert.equal(rows.filter((e) => e.type === 'practice.delivery').every((e) => e.audio === 'completed'), true);
  door.dispose();
});

test('은행 밖 「그대로」가 든 여정 — 그 결정은 제시하지 않고, 나머지는 여정의 차례로 기록된다(씨앗 판)', async () => {
  const seed = [...Array(400).keys()].find((s) => buildJourney({ seed: s + 1 }).decisions.filter((d) => !d.assessable).length >= 2) + 1;
  const journey = buildJourney({ seed });
  const { nextPlay: play, coach, spy, clock, door } = await opened();
  const picked = play.pick([journey]);
  assert.equal(picked.journey, journey);
  const plan = playThrough(play, journey, clock);
  play.end();
  const presented = spy.calls.filter(([name]) => name === 'present').map(([, [meta]]) => meta.itemKey);
  assert.deepEqual(presented, bankedOf(journey, plan));
  for (const d of journey.decisions.filter((x) => !x.assessable)) assert.ok(!presented.includes(decisionMeta(d).itemKey), d.id);
  assert.ok(spy.calls.filter(([name]) => name === 'answer').every(([, [, answer]]) => answer.assessable === true));
  await coach.finishSet({ record: false }).folded;
  door.dispose();
});

test('떠날 때(「그만두기」 · 난도 바꾸기의 다시 싣기) 열린 제시는 unanswered로 닫고, 셸의 판 닫기는 그 답 뒤(셸 창의 다음 차례)에 온다', async () => {
  const { nextPlay: play, coach, port, spy, shell, frame, clock } = await opened();
  const journey = play.pick(candidates(77)).journey;
  const d = journey.decisions.find((x) => x.assessable);
  const ex = play.exchange(decisionMeta(d)); clock.advance();
  ex.heard(true); clock.advance();
  frame.leave(); // 같은 pagehide: 키트가 먼저 건 leave(셸의 다음 차례로 미룸), 그다음 게임의 떠날 때 답
  assert.deepEqual(spy.calls.at(-1).slice(0, 2), ['answer', [ex.pid, { correct: null, assessable: false, reason: 'unanswered' }]]);
  assert.ok(!names(spy).includes('finishSet'), '판 닫기는 아직');
  shell.run();
  assert.deepEqual(names(spy).slice(-2), ['answer', 'finishSet']);
  assert.deepEqual(spy.calls.at(-1)[1], [{ record: false }]);
  assert.equal(ex.cancel(), null, '닫은 제시는 다시 닫지 않는다');
  assert.equal(play.exchange(decisionMeta(d)).pid, null, '겉이 닫힌 뒤에는 기록 없이 잇는다');
  const rows = await events(coach, port);
  const last = rows.filter((e) => e.type === 'practice.attempted').at(-1);
  assert.equal(last.presentationId, ex.pid);
  assert.equal(last.verdict, 'unassessed');
  assert.equal(last.reason, 'unanswered');
});

test('떠날 때 열린 제시가 없으면(입구 · 결과 화면) 답을 지어내지 않고 판만 닫는다', async () => {
  const { nextPlay: play, spy, shell, frame, clock } = await opened();
  const journey = play.pick(candidates(78)).journey;
  playThrough(play, journey, clock);
  const count = spy.calls.filter(([name]) => name === 'answer').length;
  frame.leave();
  shell.run();
  assert.equal(spy.calls.filter(([name]) => name === 'answer').length, count);
  assert.equal(names(spy).at(-1), 'finishSet');
});

test('none — 같은 날 넷째 게임(다른 게임이 하루 새것 한도를 다 씀): 게임 차례로 첫 후보 여정, 이유 줄 없이 판 끝까지 기록한다', async () => {
  const clock = clockAt();
  const port = atlas.memoryPort(), key = `synk-atlas:subway-rush-none-${process.pid}`;
  const { coach: other } = await realCoach({ clock, port, key, gameId: 'talk-rally' });
  const col = (name) => INDEX.fields.indexOf(name);
  const subwayUnits = new Set(INDEX.items.filter((r) => r[col('bank')] === GAME_ID).flatMap((r) => r[col('units')]));
  const rows = INDEX.items.filter((r) => r[col('bank')] === 'talk-rally' && r[col('units')].length && r[col('units')].every((u) => !subwayUnits.has(u)));
  const introduced = new Set();
  for (const r of rows) {
    if (introduced.size >= 24) break;
    const pid = other.present({ itemKey: r[col('itemKey')] }); clock.advance();
    other.answer(pid, { correct: true, assessable: true }); clock.advance();
    for (const u of r[col('units')]) introduced.add(u);
  }
  await other.finishSet({ record: false }).folded;

  const { nextPlay: play, coach, spy } = await opened({ clock, port, key });
  const journeys = candidates(2024);
  const picked = play.pick(journeys);
  assert.equal(lastRecommend(spy)[2].status, 'none', '하루 한도 — 엔진은 낼 문항이 없다');
  assert.deepEqual({ engine: picked.engine, note: picked.note }, { engine: false, note: null }, '게임 차례 — 이유 줄을 지어내지 않는다');
  assert.equal(picked.journey, journeys[0]);
  const plan = playThrough(play, picked.journey, clock);
  play.end();
  const shown = (await events(coach, port)).filter((e) => e.type === 'practice.presented' && e.itemKey.startsWith(`${GAME_ID}.`));
  assert.deepEqual(shown.map((e) => e.itemKey), bankedOf(picked.journey, plan), 'none이어도 놀이는 멈추지 않고 여정 끝까지 기록한다');
  for (const e of shown) {
    assert.equal(e.arm, 'host', e.itemKey);
    assert.equal(e.reason.code, 'host.order', e.itemKey);
  }
});

test('idle — 같은 날 여정을 이어 하면 엔진이 할 것이 없다고 해도 놀이는 잇고, 여정마다 판이 새로 선다', async () => {
  const { nextPlay: play, coach, port, spy, clock } = await opened();
  const statuses = [];
  for (let round = 0; round < 12 && !statuses.includes('idle'); round++) {
    const journeys = candidates(500 + round * 131);
    const picked = play.pick(journeys);
    const [, [, options], result] = lastRecommend(spy);
    assert.deepEqual(options, { set: {} });
    statuses.push(result.status);
    assert.ok(journeys.includes(picked.journey));
    assert.equal(picked.note, picked.engine ? namelessLine(result.why) : null, '이유 줄은 엔진이 고른 여정에만(여정마다 새 판 — 첫 평가 전이면 이름 없이)');
    // idle(채우기)은 엔진이 고른 문항이고, none만 게임 차례다(§23-6 · 키트 setPlay).
    assert.equal(picked.engine, result.status !== 'none');
    playThrough(play, picked.journey, clock);
    play.end();
    clock.advance(60_000);
  }
  assert.ok(statuses.includes('idle'), statuses.join(' '));
  assert.equal(statuses[0], 'ready');
  const shown = (await events(coach, port)).filter((e) => e.type === 'practice.presented');
  assert.equal(new Set(shown.map((e) => e.setId)).size, statuses.length, '여정마다 판 하나');
  assert.equal(spy.calls.filter(([name, args]) => name === 'finishSet' && args[0]?.record === false).length, statuses.length);
});

test('판을 다시 정하면 그 여정은 기록 없이 잇고, 다음 여정에서 문을 다시 연다 — 새 겉이면 다시 기록, 지금 판이면 옛 길', async () => {
  const o = await opened();
  const { nextPlay: play, spy, entry, clock, frame, shell } = o;
  const journey = play.pick(candidates(31)).journey;
  const [first, second] = journey.decisions.filter((d) => d.assessable);
  const ex = play.exchange(decisionMeta(first)); ex.heard(true);
  entry.retire(spy);
  assert.equal(play.retired, true);
  const count = spy.calls.length;
  ex.answer(answerPayload({ correct: true, assessable: true, selectedId: `subway.${first.answer}`, correctId: `subway.${first.answer}` }));
  const later = play.exchange(decisionMeta(second));
  assert.equal(later.pid, null);
  later.heard(true); later.answer({ correct: false, assessable: true });
  play.end();
  frame.leave(); shell.run();
  assert.equal(spy.calls.length, count, '닫힌 겉에는 더 부르지 않는다 — 게임은 기록 없이 잇는다');

  const renewed = await play.renew();
  assert.equal(renewed.coach, null);
  assert.ok(renewed.nextPlay && renewed.nextPlay !== play);
  assert.equal(entry.asked.length, 2, '다음 여정에서 문을 다시 연다');
  const picked = renewed.nextPlay.pick(candidates(32));
  playThrough(renewed.nextPlay, picked.journey, clock);
  renewed.nextPlay.end();
  const after = spy.calls.slice(count);
  assert.ok(after.some(([name]) => name === 'present') && after.at(-1)[0] === 'finishSet', 'retire 뒤 다음 여정도 다시 기록된다');

  // 지금 판으로 정해지면 다시 연 문이 null — 옛 길로 간다.
  let gave = false;
  const now = await opened({ give: (made) => { if (gave) return null; gave = true; return made; } });
  assert.equal(now.olds(), 0);
  now.nextPlay.pick(candidates(33));
  now.entry.retire(now.spy);
  assert.deepEqual(await now.nextPlay.renew(), { coach: 'old-coach', nextPlay: null });
  assert.equal(now.olds(), 1);
});

test('오류는 code로만 가른다 — RUN_ENDED면 그 겉을 더 부르지 않고, 다른 오류는 그 부르기만 버린다(놀이는 멈추지 않는다)', () => {
  const calls = [];
  let fail = null;
  // 셸 창에서 던진 오류는 틀에서 instanceof Error가 거짓이다 — 코드만 있는 객체로 흉내 낸다.
  const fake = {
    itemUnits: () => [{ unit: 'u' }],
    present: () => { calls.push('present'); if (fail) throw fail; return `p${calls.length}`; },
    delivery: () => { calls.push('delivery'); },
    help: () => { calls.push('help'); },
    answer: () => { calls.push('answer'); },
    recommend: () => { calls.push('recommend'); throw { code: 'RECOMMEND_FAILED' }; },
    finishSet: () => { calls.push('finishSet'); },
  };
  const play = createNextPlay(fake, { win: null });
  fail = { code: 'ATTEMPT_UNSAVED' };
  assert.equal(play.exchange({ itemKey: 'a' }).pid, null);
  fail = null;
  const ex = play.exchange({ itemKey: 'b' });
  assert.ok(ex.pid, '다른 오류 뒤에도 다음 문항은 기록한다');
  const journeys = [buildJourney({ seed: 5 }), buildJourney({ seed: 6 })];
  assert.deepEqual(play.pick(journeys), { journey: journeys[0], note: null, engine: false }, '고르기가 거절돼도 첫 후보로 논다');
  fail = { code: 'RUN_ENDED' };
  assert.equal(play.exchange({ itemKey: 'c' }).pid, null);
  fail = null;
  const before = calls.length;
  assert.equal(play.exchange({ itemKey: 'd' }).pid, null, 'RUN_ENDED 뒤에는 그 겉을 부르지 않는다');
  ex.heard(true); ex.help('text'); ex.answer({ correct: true, assessable: true });
  play.end();
  assert.equal(calls.length, before);
});

// 5-3 게임 GE1(검수 재현: 승차권의 「「그대로」 처음 만나요.」가 첫 듣기 평가의 정답을 짚고, 그 답이 도움 없이 맞힌 근거로 남았다).
// 승차권 한 줄은 이 여정(판)이 평가할 말의 이름을 첫 평가 전에 보이지 않는다 — 도움 없이 맞힌 답의 근거가 이유 줄로 부풀지 않는다.
test('승차권 한 줄은 첫 평가 전의 말을 이름으로 알려 주지 않는다 — 도움 없이 맞힌 답 앞에 그 답의 이름이 보이지 않았다(5-3 게임 GE1)', async () => {
  let rawLeaks = 0;
  for (const seed of [1234, 4321, 2026, 777, 31]) {
    const clock = clockAt();
    const { nextPlay: play, coach, port, spy, door } = await opened({ clock });
    const journeys = candidates(seed);
    const picked = play.pick(journeys);
    const raw = lastRecommend(spy)[2];
    // 이 여정에서 평가할 문항(은행에 든 결정 · 만남)의 단위 이름
    const plan = planDay(picked.journey);
    const keys = bankedOf(picked.journey, plan);
    const labelsOf = (itemKey) => coach.itemUnits(itemKey).map((u) => u.label).filter(Boolean);
    const named = (text, itemKey) => typeof text === 'string' && labelsOf(itemKey).some((label) => text.includes(`「${label}」`) || text.includes(`‘${label}’`) || text.includes(`«${label}»`));
    if (keys.some((itemKey) => named(raw.why?.line, itemKey))) rawLeaks += 1;
    for (const itemKey of keys) assert.equal(named(picked.note, itemKey), false, `${seed}: 승차권 「${picked.note}」이 평가 전의 ${itemKey}를 짚는다`);
    playThrough(play, picked.journey, clock);
    play.end();
    // 도움 없이 맞힌 답(근거가 서는 답)의 문항 — 그 앞에 보인 줄이 그 이름을 짚지 않았다.
    const rows = await events(coach, port);
    const shown = new Map(rows.filter((e) => e.type === 'practice.presented').map((e) => [e.id, e]));
    const helped = new Set(rows.filter((e) => e.type === 'practice.helped').map((e) => e.presentationId));
    const unaided = rows.filter((e) => e.type === 'practice.attempted' && e.verdict === 'correct' && !helped.has(e.presentationId));
    assert.ok(unaided.length > 0, `${seed}: 도움 없이 맞힌 답이 있다`);
    for (const e of unaided) assert.equal(named(picked.note, shown.get(e.presentationId).itemKey), false, `${seed}: ${shown.get(e.presentationId).itemKey}`);
    door.dispose();
  }
  assert.ok(rawLeaks > 0, '셸 코치의 이유 줄은 그대로면 평가할 말의 이름을 짚는다 — 이 시험이 그 장면을 본다');
});
