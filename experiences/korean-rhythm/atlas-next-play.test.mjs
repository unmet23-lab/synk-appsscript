// 말의 리듬의 새 길(Atlas 재설계 단계 4 §23-7 · §23-10 「게임」) — atlas-next-play.mjs. 진짜 엔진 코치를 가짜 입구로 셸의 문(createGameDoor)에
// 넣고 틀 창의 키트로 열어, 문을 거친 그대로 app.mjs의 차례(곡 고르기 → 보면의 변형 → 문장마다 제시 · 전달 · 도움 · 답 · 정답 보기 → 곡 끝)를 돈다.
//   은행 · 추천 곡(곡 문항 전체 recommend) · 문장 변형(문장마다 변형 둘 recommend) · 곡 하나가 판 하나(5 · 새것 한도 3n) · 판 끝 finishSet,
//   none(같은 날 넷째 게임 — 게임 차례 · 이유 줄 없음 · 곡 끝까지 기록) · idle, 순간 맞춤은 박자만(듣기 답은 Flow를 움직이지 않는다),
//   며칠 뒤 다시 확인은 due()의 단위가 든 대화, 다시 듣기는 같은 제시의 도움, 오류는 code로만(RUN_ENDED · 판을 다시 정함 · 그 밖).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';
import { BANKS, GAME_ID, SONG_LENGTH, claimsOf, createRhythm, openRhythm, songItems } from './atlas-next-play.mjs';
import { TRACKS, RoundState } from './core.mjs';
import { FLOW_RHYTHM, rhythmItem, timingObservation } from './personalization.mjs';
import { supplementalItems } from './supplemental.mjs';
// 원문 토막은 게임 모듈처럼 엄격 모드로 돌린다. 느슨한 모드(with)는 얼린 FLOW_ 값에 쓰는 줄을 조용히 넘겨, 게임에서만 던지는 줄을 시험이 놓친다
// (4-6e 첫 묶음 Fable F4). env의 이름이 토막의 바깥 이름이다 — 토막이 env에 없는 이름에 쓰면 시험이 던진다.
// 토막이 대입할 수 있는 이름은 게임 모듈이 맨 위 let으로 둔 것뿐이다(module — 그 게임 모듈의 원문). 나머지(가져온 FLOW_ 값 · const · 함수)는 const로
// 묶어 다시 대입하면 게임 모듈처럼 던진다(4-6e-2 검수 GA1 · 새 사슬 GA2).
// 이름은 글이 아니라 구문(acorn)으로 읽는다 — 초기값 속의 이름은 선언이 아니다(사슬 -d F1).
const acorn = createRequire(import.meta.url)('acorn');
const topLets = module =>
  new Set(acorn.parse(module, { ecmaVersion: 'latest', sourceType: 'module' }).body.flatMap(node => (node.type === 'VariableDeclaration' && node.kind !== 'const' ? node.declarations.map(({ id }) => id.name) : [])));
const strictEnv = (body, module) => env => {
  const names = Object.keys(env);
  const lets = topLets(module);
  const free = names.filter(name => lets.has(name));
  const fixed = names.filter(name => !free.includes(name));
  return new Function('__env', ...free, `'use strict';\nconst { ${fixed.join(', ')} } = __env;\n${body}`)(env, ...free.map(name => env[name]));
};

const atlas = await import('../../packages/atlas/src/index.mjs');
const readJson = rel => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const INDEX = readJson('../../packages/atlas/map/index.json');
const UNITS = readJson('../../packages/atlas/map/units.json');
const WORDS = readJson('../../packages/atlas/map/words.json'); // 셸이 여는 은행 조각처럼 낱말 이름이 서게(이유 줄)
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0); // 서울 10시
const DAY = 86_400_000;
const SET ={ length: SONG_LENGTH, newLimit: 3 * SONG_LENGTH };
const COACH_METHODS = ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live'];

const clockAt = (start = T0) => { const state = { t: start }; return { now: () => state.t, advance: (ms = 4000) => (state.t += ms) }; };
let stores = 0;
async function realCoach({ clock, port = atlas.memoryPort(), key = null, gameId = GAME_ID }) {
  stores += 1;
  const coach = atlas.createCoach({
    gameId,
    mapData: { index: INDEX, units: UNITS, words: WORDS },
    dayOffset: 540,
    host: { guest: true, port, key: key ?? `synk-atlas:korean-rhythm-test-${process.pid}-${stores}`, now: clock.now },
  });
  await coach.ready;
  return coach;
}
// 셸 창 코치를 지켜보는 겉 — 부른 차례와 인수 · 결과를 적는다(문은 이 객체의 메서드를 부른다).
// startSet: 코치 판 열기 첩자를 둔다(지금 엔진에는 없다 — 설계 주인 11-19 밤에 승인한 꼴: { opened, setId }). 적기만 하고 판은 첫 제시가 연다.
function spied(coach, { startSet = false } = {}) {
  const calls = [];
  const spy = { calls };
  for (const name of COACH_METHODS) spy[name] = (...args) => { const row = [name, args]; calls.push(row); row.push(coach[name](...args)); return row[2]; };
  if (startSet) spy.startSet = options => { const row = ['startSet', [options], { opened: true, setId: `spy-${calls.length}` }]; calls.push(row); return row[2]; };
  return spy;
}
// 가짜 입구(셸 world-atlas-next.mjs gameCoach · retired).
function entryOf(give) {
  const retirers = new Map();
  return {
    asked: [],
    async gameCoach(gameId, banks) { this.asked.push([gameId, banks]); return give(); },
    retired(made, fn) { retirers.set(made, fn); return () => retirers.delete(made); },
    retire(made, reason = 'account') { retirers.get(made)?.({ reason }); },
  };
}
const tasks = () => { const queue = []; return { later: fn => queue.push(fn), run: () => queue.splice(0).forEach(fn => fn()) }; };
// 틀 창 — 위 창(셸)에 문이 있다.
function frameOf(door) {
  const listeners = [];
  const top = { SYNKAtlasGame: door.api };
  return { parent: top, top, listeners, location: { hostname: 'synk.im', search: '' }, addEventListener: (type, fn) => listeners.push([type, fn]), leave() { for (const [type, fn] of listeners) if (type === 'pagehide') fn(); } };
}
// 진짜 코치를 셸의 문에 넣고 틀에서 새 길로 연다.
async function opened({ clock = clockAt(), port = atlas.memoryPort(), key = null, startSet = false } = {}) {
  const coach = await realCoach({ clock, port, key });
  const spy = spied(coach, { startSet });
  const entry = entryOf(() => spy);
  const shell = tasks();
  const door = createGameDoor({ entry, gameId: GAME_ID, later: shell.later });
  const frame = frameOf(door);
  const play = await openRhythm({ win: frame });
  return { play, coach, port, spy, entry, shell, door, frame, clock };
}
const events = async (coach, port) => { await coach.finishSet({ record: false }).folded; return (await port.read()).filter(row => row.value?.kind === 'event').map(row => row.value.event); };
const names = spy => spy.calls.map(([name]) => name);
const recommends = spy => spy.calls.filter(([name]) => name === 'recommend');
// app.mjs의 답 꼴(answered) — 답하지 않은 문장은 판정 못 한 답.
const oldAnswer = want => (want === 'none' ? { correct: null, assessable: false, reason: 'unanswered' } : { correct: want === 'right', assessable: true, reason: undefined });

// app.mjs의 차례 그대로 곡 하나: 보면의 변형(variants) → 문장마다 제시(showQuestion) → (글로 보기) → 전달(소리 끝) → 답 → 정답 보기 → 곡 끝(end).
function playSong(play, trackId, clock, { plan = ['right', 'right', 'right', 'right', 'right'], texted = new Set() } = {}) {
  const track = play.variants(TRACKS[trackId]);
  const round = new RoundState(track, 'easy', 7);
  const records = [];
  round.questions.forEach((q, i) => {
    const pid = play.coach.present(rhythmItem(trackId, q)); clock.advance(3000);
    if (texted.has(i)) { play.coach.help(pid, 'text'); clock.advance(1000); }
    play.coach.delivery(pid, { audio: 'completed' }); clock.advance(3000);
    records.push(play.coach.answer(pid, oldAnswer(plan[i]))); clock.advance(500);
    play.coach.help(pid, 'answer'); clock.advance(20_000);
  });
  play.end();
  return { track, round, records };
}

test('은행 이름은 셸의 게임 은행 표와 같고, 곡의 문장 · 새 문장 확인 · 보충 연습 · 며칠 뒤 확인 대화는 모두 은행에 있다', async () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS[GAME_ID]]);
  const coach = await realCoach({ clock: clockAt() });
  const items = [
    ...songItems(),
    ...TRACKS.flatMap(track => track.questions.map((_, sourceIndex) => rhythmItem(track.id, { sourceIndex }, { recall: true }))),
    ...supplementalItems({ purpose: 'practice' }),
    ...supplementalItems({ purpose: 'delayed', seen: () => false }),
  ];
  assert.equal(items.length, 30 + 15 + 32 + 16);
  for (const item of items) assert.ok(coach.itemUnits(item.itemKey).length > 0, item.itemKey);
  assert.equal(songItems().length, TRACKS.length * SONG_LENGTH * 2, '곡 문항 전체 — 곡마다 문장마다 주장 변형 둘');
  assert.deepEqual(claimsOf(1, 2).map(item => [item.id, item.trackId, item.variant]), [['t1q2v0', 1, 0], ['t1q2v1', 1, 1]]);
});

test('추천 곡 — 곡 문항 전체 recommend(판 5 · 새것 한도 3n)의 고른 문항이 든 곡, 이유는 코치의 한 줄', async () => {
  const { play, spy, door } = await opened();
  const picked = play.song();
  const [, [items, options], result] = recommends(spy).at(-1);
  assert.deepEqual(options, { set: SET });
  assert.deepEqual(items.map(item => item.itemKey), songItems().map(item => item.itemKey));
  assert.equal(result.status, 'ready', '빈 기억 손님의 첫 곡은 엔진이 고른다');
  assert.equal(picked.trackId, result.selected.trackId);
  assert.ok(result.selected.itemKey.startsWith(`korean-rhythm:t${picked.trackId}q`));
  assert.equal(picked.line, result.why.line);
  assert.ok(typeof picked.line === 'string' && picked.line.length > 0);
  assert.equal(picked.held, null);
  assert.ok(!names(spy).includes('present'), '고르기만 한다');
  door.dispose();
});

test('곡 하나 — 앞 판을 닫고 문장마다 변형 둘 가운데 recommend로 보면을 짓고, 문장마다 제시 · 전달 · 도움 · 답, 곡 끝에 판을 기록 없이 닫는다', async () => {
  const { play, coach, port, spy, clock, door } = await opened();
  const trackId = play.song().trackId;
  const from = spy.calls.length;
  const { track, round, records } = playSong(play, trackId, clock, { plan: ['right', 'wrong', 'none', 'right', 'right'], texted: new Set([3]) });
  const calls = spy.calls.slice(from);
  // 곡을 열 때: 앞 판 닫기 → 문장마다 변형 둘의 recommend(같은 판 옵션). 엔진이 고른 변형으로 보면의 변형이 선다.
  assert.deepEqual(calls[0].slice(0, 2), ['finishSet', [{ record: false }]]);
  calls.slice(1, 6).forEach(([name, [items, options], result], i) => {
    assert.equal(name, 'recommend');
    assert.deepEqual(items.map(item => item.id), [`t${trackId}q${i}v0`, `t${trackId}q${i}v1`]);
    assert.deepEqual(options, { set: SET });
    if (result.status !== 'none') {
      assert.deepEqual(track.variantChoices[i], [result.selected.variant]);
      assert.equal(round.questions[i].variant, result.selected.variant, '보면이 그 변형을 쓴다');
    } else assert.equal(track.variantChoices[i], undefined);
  });
  // 문장마다: 은행 확인 → 그 문장 변형 둘의 recommend → 제시(곡의 첫 문장 앞에서 판을 다시 닫지 않는다 — 곡을 열 때 닫았다).
  const perQuestion = calls.slice(6).map(([name]) => name);
  assert.deepEqual(perQuestion, [
    ...['itemUnits', 'recommend', 'present', 'delivery', 'answer', 'help'],
    ...['itemUnits', 'recommend', 'present', 'delivery', 'answer', 'help'],
    ...['itemUnits', 'recommend', 'present', 'delivery', 'answer', 'help'],
    ...['itemUnits', 'recommend', 'present', 'help', 'delivery', 'answer', 'help'],
    ...['itemUnits', 'recommend', 'present', 'delivery', 'answer', 'help'],
    'finishSet',
  ]);
  assert.deepEqual(calls.at(-1)[1], [{ record: false }], '곡 끝 — 판 기록은 셸 몫');
  assert.ok(!names(spy).includes('summary') && !names(spy).includes('live'), '옛 요약 · 순간 맞춤(박자)은 이 차례에 없다');
  // 답은 키트 answerOf로 옮긴 꼴 — 답하지 않은 문장은 판정 못 한 답(unanswered).
  const answers = calls.filter(([name]) => name === 'answer').map(([, [, answer]]) => answer);
  assert.deepEqual(answers, [
    { correct: true, assessable: true }, { correct: false, assessable: true }, { correct: null, assessable: false, reason: 'unanswered' },
    { correct: true, assessable: true }, { correct: true, assessable: true },
  ]);

  const rows = await events(coach, port);
  const shown = rows.filter(e => e.type === 'practice.presented');
  assert.deepEqual(shown.map(e => e.itemKey), round.questions.map(q => rhythmItem(trackId, q).itemKey), '곡의 차례대로');
  assert.equal(new Set(shown.map(e => e.setId)).size, 1, '곡 하나가 판 하나');
  const confirms = calls.filter(([name], at) => name === 'recommend' && calls[at + 1]?.[0] === 'present');
  shown.forEach((e, i) => {
    const result = confirms[i][2];
    const engine = result.status !== 'none' && result.selected.itemKey === e.itemKey;
    assert.equal(e.arm === 'host', !engine, `낸 변형을 지금도 고르면 엔진이 고른 제시: ${e.itemKey}`);
    assert.equal(e.arm === 'host' ? e.reason.code : null, engine ? null : 'host.order');
    const kinds = rows.filter(x => x.presentationId === e.id).map(x => (x.type === 'practice.helped' ? `helped:${x.helpId}` : x.type));
    assert.deepEqual(kinds, [...(i === 3 ? ['helped:text'] : []), 'practice.delivery', 'practice.attempted', 'helped:answer'], e.itemKey);
  });
  // 혼자 처음 맞혔나는 저장 뒤 근거가 서면 채운다 — 판 끝에서 기다린다.
  await play.settled(records);
  assert.deepEqual(records.map(record => [record.verdict, record.independent]), [
    ['correct', true], ['incorrect', true], ['unassessed', false], ['correct', false], ['correct', true],
  ]);
  door.dispose();
});

test('새 문장 확인 · 보충 연습은 게임 차례로 제시만 하고, 다시 듣기는 같은 제시의 도움(replay)이다 — 답은 한 번', async () => {
  const { play, coach, port, spy, clock, door } = await opened();
  const trackId = play.song().trackId;
  const { round } = playSong(play, trackId, clock);
  play.song(); // 판 끝의 다음 곡 고르기(paintNextReason)
  const from = spy.calls.length;
  // app.mjs recall: 첫 듣기가 끊기면 「다시 듣기」 — 같은 제시에 replay, 그다음 답 하나와 정답 보기.
  const source = round.questions[0];
  const pid = play.coach.present(rhythmItem(trackId, source, { recall: true })); clock.advance();
  play.coach.delivery(pid, { audio: 'failed' }); clock.advance();
  play.coach.help(pid, 'replay'); clock.advance();
  play.coach.delivery(pid, { audio: 'completed' }); clock.advance();
  play.coach.answer(pid, { correct: source.recall.answer === 'O', assessable: true }); clock.advance();
  play.coach.help(pid, 'answer'); clock.advance();
  // 보충 연습 한 대화(supplemental-player.mjs의 차례 — 듣기 둘째부터 replay).
  const row = supplementalItems({ purpose: 'practice' })[0];
  const sid = play.coach.present(row); clock.advance();
  play.coach.delivery(sid, { audio: 'completed' }); clock.advance();
  play.coach.help(sid, 'replay'); clock.advance();
  play.coach.delivery(sid, { audio: 'completed' }); clock.advance();
  play.coach.answer(sid, { correct: true, assessable: true }); clock.advance();
  play.coach.help(sid, 'explanation');
  const later = spy.calls.slice(from).map(([name]) => name);
  assert.ok(!later.includes('recommend'), '새 문장 확인 · 보충 연습은 recommend 없이 제시만(게임 차례)');
  const rows = await events(coach, port);
  const recall = rows.find(e => e.id === pid);
  const practice = rows.find(e => e.id === sid);
  for (const e of [recall, practice]) {
    assert.equal(e.arm, 'host', e.itemKey);
    assert.equal(rows.filter(x => x.presentationId === e.id && x.type === 'practice.attempted').length, 1, '답은 한 번');
    assert.equal(rows.filter(x => x.presentationId === e.id && x.type === 'practice.helped' && x.helpId === 'replay').length, 1, '다시 듣기는 도움');
  }
  assert.equal(recall.itemKey, rhythmItem(trackId, source, { recall: true }).itemKey);
  assert.equal(recall.firstExposure, false, '같은 계열의 곡 문장을 이미 들었다');
  door.dispose();
});

// app.mjs recall() 차례 그대로 확인 문장 하나: 남은 확인 문장으로 정해진 판(fixed) → 제시 → 전달 → 답 → 정답 보기 → 입구 추천 다시 그리기(song).
function recallAt(play, trackId, round, index, clock) {
  const recallOf = q => rhythmItem(trackId, q, { recall: true });
  play.fixed(round.questions.slice(index).map(recallOf), round.questions);
  const pid = play.coach.present(recallOf(round.questions[index])); clock.advance();
  play.coach.delivery(pid, { audio: 'completed' }); clock.advance();
  play.coach.answer(pid, { correct: true, assessable: true }); clock.advance();
  play.coach.help(pid, 'answer'); clock.advance();
  play.song();
  return pid;
}
// supplemental-player.mjs start() 차례 그대로 연습 하나: 낼 대화 목록으로 정해진 판(beginSet → fixed) → 대화마다 제시 · 전달 · (between) · 답 · 해설.
function practiceOf(play, queue, clock, { between = () => {} } = {}) {
  play.fixed(queue);
  return queue.map(item => {
    const pid = play.coach.present(item); clock.advance();
    play.coach.delivery(pid, { audio: 'completed' }); clock.advance();
    between();
    play.coach.answer(pid, { correct: true, assessable: true }); clock.advance();
    play.coach.help(pid, 'explanation'); clock.advance();
    return pid;
  });
}
const setCalls = calls => calls.map(([name]) => name).filter(name => ['startSet', 'present', 'finishSet'].includes(name));

test('정해진 판 — 새 문장 확인 · 보충 연습 · 며칠 뒤 다시 확인은 첫 제시 앞에서 앞 판을 닫고 startSet({ length: n })을 한 번 부른다. 다음 판을 열 때 다시 부르고, 곡을 열면 곡의 판으로 돌아온다', async () => {
  const { play, spy, clock, door } = await opened({ startSet: true });
  const trackId = play.song().trackId;
  const { round } = playSong(play, trackId, clock);
  assert.ok(!names(spy).includes('startSet'), '곡은 recommend로 여는 판이라 startSet을 부르지 않는다');
  play.song(); // 판 끝의 다음 곡 고르기(paintNextReason) — 곡의 판 옵션
  const from = spy.calls.length;
  // 새 문장 확인 둘 → 보충 연습 셋(첫 대화를 듣는 사이 입구에서 곡을 누른다 — 추천 곡을 다시 그린다) → 새 문장 확인의 남은 셋 → 며칠 뒤 다시 확인 하나.
  recallAt(play, trackId, round, 0, clock);
  recallAt(play, trackId, round, 1, clock);
  let touched = false;
  practiceOf(play, supplementalItems({ purpose: 'practice' }).slice(0, 3), clock, { between: () => { if (!touched) play.song(); touched = true; } });
  for (const index of [2, 3, 4]) recallAt(play, trackId, round, index, clock);
  practiceOf(play, supplementalItems({ purpose: 'delayed', seen: () => false }).slice(0, 1), clock);
  const later = spy.calls.slice(from);
  assert.deepEqual(setCalls(later), [
    'finishSet', 'startSet', 'present', 'present',
    'finishSet', 'startSet', 'present', 'present', 'present',
    'finishSet', 'startSet', 'present', 'present', 'present',
    'finishSet', 'startSet', 'present',
  ], '판마다 앞 판을 닫고 첫 제시 앞에서 한 번 — 같은 판의 다음 제시에는 다시 부르지 않는다');
  assert.deepEqual(later.filter(([name]) => name === 'startSet').map(([, [options]]) => options), [
    { length: 5 }, // 새 문장 확인 — 곡의 문장 수
    { length: 3 }, // 보충 연습 — 낼 대화 수
    { length: 3 }, // 보충 연습이 끼어 닫힌 새 문장 확인 — 남은 확인 문장 수
    { length: 1 }, // 며칠 뒤 다시 확인 — 대화 하나
  ]);
  const peeks = later.filter(([name]) => name === 'recommend');
  assert.equal(peeks.length, 6, '확인 문장의 답마다 하나와 보충 연습 중 곡을 누를 때 하나');
  for (const [, [, options]] of peeks) assert.deepEqual(options, {}, '판이 도는 동안 추천 곡은 판 옵션 없이 고른다');
  // 곡을 열면 정해진 판을 닫고 곡의 판 옵션으로 돌아온다.
  const next = spy.calls.length;
  playSong(play, trackId, clock);
  assert.deepEqual(spy.calls[next].slice(0, 2), ['finishSet', [{ record: false }]]);
  assert.deepEqual(spy.calls.slice(next).find(([name]) => name === 'recommend')[1][1], { set: SET });
  play.song();
  assert.deepEqual(recommends(spy).at(-1)[1][1], { set: SET }, '판 끝의 추천 곡도 다시 곡의 판 옵션으로');
  door.dispose();
});

test('startSet이 없는 지금 엔진 — 정해진 판도 놀이는 그대로 돈다: 첫 제시가 코치의 기본 판을 열고, 판이 도는 동안 곡을 눌러도 그 판의 답이 남는다', async () => {
  const { play, coach, port, spy, clock, door } = await opened();
  const trackId = play.song().trackId;
  const { round } = playSong(play, trackId, clock);
  play.song();
  const from = spy.calls.length;
  round.questions.forEach((_, index) => recallAt(play, trackId, round, index, clock));
  const queue = supplementalItems({ purpose: 'practice' }).slice(3, 6);
  practiceOf(play, queue, clock, { between: () => play.song() });
  assert.ok(!names(spy).includes('startSet'));
  assert.deepEqual(setCalls(spy.calls.slice(from)), ['finishSet', ...Array(5).fill('present'), 'finishSet', ...Array(3).fill('present')]);
  const rows = await events(coach, port);
  const shown = rows.filter(e => e.type === 'practice.presented');
  const song = shown.slice(0, 5), recalls = shown.slice(5, 10), practice = shown.slice(10);
  assert.deepEqual(recalls.map(e => e.itemKey), round.questions.map(q => rhythmItem(trackId, q, { recall: true }).itemKey));
  assert.deepEqual(practice.map(e => e.itemKey), queue.map(item => item.itemKey));
  assert.equal(new Set(recalls.map(e => e.setId)).size, 1, '새 문장 확인 다섯이 한 판');
  assert.equal(new Set(practice.map(e => e.setId)).size, 1, '보충 연습 셋이 한 판 — 사이에 곡을 눌러도 판을 새로 열지 않는다');
  assert.equal(new Set([song[0].setId, recalls[0].setId, practice[0].setId]).size, 3, '곡 · 새 문장 확인 · 보충 연습은 다른 판');
  for (const e of [...recalls, ...practice]) {
    assert.equal(e.arm, 'host', e.itemKey);
    assert.equal(rows.filter(x => x.type === 'practice.attempted' && x.presentationId === e.id).length, 1, `답이 남는다: ${e.itemKey}`);
  }
  door.dispose();
});

test('정해진 판 — 도는 판에 답을 기다리는 제시가 있으면 다른 판을 열지 않는다(false). 그 제시의 답이나 판정 못 한 답을 받은 뒤에 연다. 같은 판은 잇고, 판을 다시 정한 겉은 막지 않는다(둘째 다시 보기 Q6)', async () => {
  const { play, coach, port, spy, clock, door } = await opened({ startSet: true });
  const trackId = play.song().trackId;
  const { round } = playSong(play, trackId, clock);
  play.song();
  const recallOf = q => rhythmItem(trackId, q, { recall: true });
  const recalls = round.questions.map(recallOf);
  const queue = supplementalItems({ purpose: 'practice' }).slice(0, 2);
  assert.equal(play.fixed(queue), true, '보충 연습의 판을 연다');
  const sid = play.coach.present(queue[0]); clock.advance();
  play.coach.delivery(sid, { audio: 'completed' }); clock.advance();
  let from = spy.calls.length;
  assert.equal(play.fixed(recalls, round.questions), false, '보충 대화가 답을 기다리면 새 문장 확인의 판을 열지 않는다');
  assert.deepEqual(setCalls(spy.calls.slice(from)), [], '앞 판을 닫지 않는다');
  assert.equal(play.holds(sid), true);
  assert.equal(play.fixed(queue.slice(1), queue), true, '같은 판은 그대로 잇는다');
  play.coach.answer(sid, { correct: true, assessable: true }); clock.advance();
  from = spy.calls.length;
  assert.equal(play.fixed(recalls, round.questions), true, '답한 뒤에는 연다');
  assert.deepEqual(setCalls(spy.calls.slice(from)), ['finishSet', 'startSet']);
  const pid = play.coach.present(recalls[0]); clock.advance();
  assert.equal(play.fixed(queue.slice(1), queue), false, '새 문장이 답을 기다리면 보충 연습의 판을 다시 열지 않는다');
  play.coach.answer(pid, { correct: null, assessable: false, reason: 'unanswered' }); clock.advance();
  assert.equal(play.fixed(queue.slice(1), queue), true, '판정 못 한 답을 받은 뒤에도 연다');
  const next = play.coach.present(queue[1]); clock.advance();
  const rows = await events(coach, port);
  for (const id of [sid, pid]) assert.equal(rows.filter(x => x.type === 'practice.attempted' && x.presentationId === id).length, 1, id);
  const shown = rows.filter(e => e.type === 'practice.presented');
  const setOf = id => shown.find(e => e.id === id).setId;
  assert.equal(new Set([setOf(sid), setOf(pid), setOf(next)]).size, 3, '판마다 다른 판');
  // 판을 다시 정했다 — 그 겉의 제시는 기록되지 않으니 다음 판을 막지 않는다.
  const o = await opened({ startSet: true });
  o.play.fixed(queue);
  assert.ok(o.play.coach.present(queue[0]));
  o.entry.retire(o.spy);
  assert.equal(o.play.fixed(recalls, round.questions), true);
  door.dispose();
  o.door.dispose();
});

test('none — 같은 날 넷째 게임(다른 게임이 하루 새것 한도를 다 씀): 추천 곡 없이 고른 곡 그대로, 문장은 보면의 섞기로 이유 줄 없이 곡 끝까지 기록한다', async () => {
  const clock = clockAt();
  const port = atlas.memoryPort(), key = `synk-atlas:korean-rhythm-none-${process.pid}`;
  const other = await realCoach({ clock, port, key, gameId: 'talk-rally' });
  const col = name => INDEX.fields.indexOf(name);
  const rhythmUnits = new Set(INDEX.items.filter(r => r[col('bank')] === GAME_ID).flatMap(r => r[col('units')]));
  const introduced = new Set();
  for (const r of INDEX.items.filter(row => row[col('bank')] === 'talk-rally' && row[col('units')].length && row[col('units')].every(u => !rhythmUnits.has(u)))) {
    if (introduced.size >= 24) break;
    const pid = other.present({ itemKey: r[col('itemKey')] }); clock.advance();
    other.answer(pid, { correct: true, assessable: true }); clock.advance();
    for (const u of r[col('units')]) introduced.add(u);
  }
  await other.finishSet({ record: false }).folded;

  const { play, coach, spy } = await opened({ clock, port, key });
  const picked = play.song();
  const result = recommends(spy).at(-1)[2];
  assert.equal(result.status, 'none', '하루 한도 — 엔진은 낼 문항이 없다');
  // 새것 한도로 고를 것이 없는 none에는 까닭 줄도 없다(하루 복습 상한 · 끈질긴 말의 몫일 때만 held).
  assert.equal(result.why, null);
  assert.deepEqual(picked, { trackId: null, line: null, held: null }, '게임 차례 — 추천 곡도 이유 줄도 지어내지 않는다');
  const from = spy.calls.length;
  const { track, round } = playSong(play, 2, clock, { plan: ['right', 'wrong', 'right', 'none', 'right'] });
  assert.deepEqual(track.variantChoices, {}, '문장 변형은 보면의 섞기(게임 차례)');
  const calls = spy.calls.slice(from);
  const planned = calls.filter(([name]) => name === 'recommend').slice(0, SONG_LENGTH);
  for (const [, , out] of planned) assert.deepEqual([out.status, out.selected], ['none', null], '곡을 열 때는 고를 새것이 없다');
  const shown = (await events(coach, port)).filter(e => e.type === 'practice.presented' && e.itemKey.startsWith(`${GAME_ID}:`));
  assert.deepEqual(shown.map(e => e.itemKey), round.questions.map(q => rhythmItem(2, q).itemKey), 'none이어도 놀이는 멈추지 않고 곡 끝까지 기록한다');
  assert.equal(new Set(shown.map(e => e.setId)).size, 1);
  // 낼 때의 recommend가 none이면 게임 차례(host · 이유 없음). 곡 안에서 이미 만난 단위의 문장은 채우기(idle)로 엔진이 고를 수 있다 — 그때만 이유 줄이 선다.
  const confirms = calls.filter(([name], at) => name === 'recommend' && calls[at + 1]?.[0] === 'present').map(([, , out]) => out);
  assert.equal(confirms.length, SONG_LENGTH);
  assert.equal(confirms[0].status, 'none', '첫 문장은 게임 차례');
  shown.forEach((e, i) => {
    const out = confirms[i];
    const engine = out.status !== 'none' && out.selected.itemKey === e.itemKey;
    assert.equal(e.arm === 'host', !engine, e.itemKey);
    if (!engine) assert.equal(e.reason.code, 'host.order', e.itemKey);
    if (out.status === 'none') assert.equal(out.why, null, '게임 차례에는 이유가 없다');
    else assert.ok(out.why.line, '엔진이 고른 것에만 이유 줄');
  });
  assert.ok(shown.filter(e => e.arm === 'host').length >= 1);
  assert.deepEqual(spy.calls.at(-1).slice(0, 2), ['finishSet', [{ record: false }]]);
});

test('idle — 같은 날 곡을 이어 하면 엔진이 채우기를 고를 때도 엔진 차례로 잇고, 곡마다 판이 새로 선다(판 길이 5)', async () => {
  const { play, coach, port, spy, clock } = await opened();
  const statuses = [];
  let songs = 0;
  for (; songs < 8 && !statuses.includes('idle'); songs++) {
    const trackId = play.song().trackId ?? songs % TRACKS.length;
    const from = recommends(spy).length;
    const { track } = playSong(play, trackId, clock, { plan: ['right', 'right', 'wrong', 'right', 'right'] });
    const planned = recommends(spy).slice(from, from + SONG_LENGTH);
    planned.forEach(([, , result], i) => {
      statuses.push(result.status);
      // idle(채우기)도 엔진이 고른 문항이다 — none만 게임 차례(키트 setPlay).
      assert.equal(track.variantChoices[i] !== undefined, result.status !== 'none', `${track.id}:${i} ${result.status}`);
    });
    clock.advance(60_000);
  }
  assert.ok(statuses.includes('idle'), statuses.join(' '));
  assert.equal(statuses[0], 'ready');
  const shown = (await events(coach, port)).filter(e => e.type === 'practice.presented');
  const sets = new Map();
  for (const e of shown) sets.set(e.setId, (sets.get(e.setId) ?? 0) + 1);
  assert.equal(sets.size, songs, '곡마다 판 하나');
  assert.deepEqual([...sets.values()], Array(songs).fill(SONG_LENGTH));
  assert.ok(shown.some(e => e.arm === 'filler'), '채우기로 낸 문장도 있다');
});

test('순간 맞춤 — 판정 폭(박자)만 움직이고, 박자는 제시 없이 관찰한다. 듣기 O·X 답은 Flow를 움직이지 않는다(trace)', async () => {
  const { play, spy, clock, door, shell } = await opened();
  const live = play.coach.live(FLOW_RHYTHM, { declared: {} });
  assert.deepEqual(spy.calls.find(([name]) => name === 'live')[1], [FLOW_RHYTHM, { declared: {} }]);
  const start = live.settings().values.window;
  const trackId = play.song().trackId;
  let beats = 0;
  const beat = event => { const seen = timingObservation(event); if (!seen) return; beats += 1; live.observe(seen); };
  const track = play.variants(TRACKS[trackId]);
  const round = new RoundState(track, 'easy', 7);
  round.questions.forEach(q => {
    for (let i = 0; i < 4; i++) beat(i % 2 ? { type: 'miss' } : { type: 'tap', quality: 0.5 });
    beat({ type: 'question', quality: 1 }); // 듣기 답의 박자는 관찰하지 않는다(timingObservation null)
    const before = live.trace().length;
    const pid = play.coach.present(rhythmItem(trackId, q)); clock.advance();
    play.coach.delivery(pid, { audio: 'completed' }); clock.advance();
    play.coach.answer(pid, oldAnswer('right')); clock.advance();
    play.coach.help(pid, 'answer'); clock.advance();
    assert.equal(live.trace().length, before, '제시 · 답은 순간 맞춤에 들지 않는다');
  });
  play.end();
  assert.equal(live.trace().length, beats, '박자 관찰 하나가 trace 한 줄');
  assert.ok(live.trace().every(row => ['success', 'timeout'].includes(row.outcome)));
  const end = live.end();
  assert.ok(end.settings.values.window > start, '놓친 박자가 많으면 판정 폭을 넓힌다');
  // 「판정 폭 맞춤 꺼짐」 — 정해진 판정 폭.
  const fixed = play.coach.live(FLOW_RHYTHM, { declared: { mode: 'fixed' } });
  for (let i = 0; i < 12; i++) fixed.observe({ outcome: 'timeout' });
  assert.equal(fixed.settings().values.window, 1);
  door.dispose();
  shell.run(); // 문은 겉과 판을 셸 창의 다음 차례에 닫는다(끝 판 GD5)
  assert.throws(() => live.observe({ outcome: 'timeout' }), { code: 'RUN_ENDED' }, '닫힌 손잡이 — app.mjs는 잡아서 순간 맞춤 없이 잇는다');
});

/* ── 순간 맞춤 진입(4-6e-2 — 설계 주인 11-21) ── */
// app.mjs의 startTiming을 원문 그대로 돌린다. 셸 코치의 live는 가짜다 — 문이 옮겨 온 인자(spec, options)를 적고 진짜 엔진 코치의 live에
// 넘긴다(엔진은 거기서 내용을 정의하고, 막기에 걸리면 던진다). 엔진이 던지면 적어 두고 그대로 던진다. startTiming은 그 던짐을 삼키고
// 순간 맞춤만 끄므로, 시험은 적힌 던짐과 adaptive로 본다.
function liveSpy(coach) {
  const got = [];
  const shell = {};
  for (const name of Object.keys(coach)) if (typeof coach[name] === 'function') shell[name] = (...args) => coach[name](...args);
  shell.live = (spec, options) => {
    const row = { spec, options, error: null, adaptive: null };
    got.push(row);
    try {
      const handle = coach.live(spec, options);
      row.adaptive = handle.settings().adaptive;
      return handle;
    } catch (error) {
      row.error = error;
      throw error;
    }
  };
  return { shell, got };
}
function timingStarter() {
  const text = fs.readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const from = text.indexOf('const TIMING_KEY = ');
  const to = text.indexOf('function followTiming(', from);
  assert.ok(from >= 0 && to > from, 'app.mjs의 판정 폭 맞춤 열기 토막');
  return strictEnv(`${text.slice(from, to)}\nreturn () => { startTiming(); return { live, timingStart }; };`, text);
}

test('순간 맞춤 진입 — app.mjs가 곡마다 넘긴 내용을 진짜 엔진이 정의하고 판정 폭의 순간 맞춤이 켜진다, 「판정 폭 맞춤 꺼짐」이면 꺼진다', async () => {
  const clock = clockAt();
  const coach = await realCoach({ clock });
  const { shell, got } = liveSpy(coach);
  const door = createGameDoor({ entry: entryOf(() => shell), gameId: GAME_ID, later: fn => fn() });
  const play = await openRhythm({ win: frameOf(door) });
  const kept = new Map();
  const scaled = [];
  const env = { store: { get: key => kept.get(key) ?? null }, coach: play.coach, learningAvailable: true, state: { round: { scaleTiming: value => scaled.push(value) } }, FLOW_RHYTHM };
  const startTiming = timingStarter()(env);

  const auto = startTiming();
  assert.equal(got.length, 1);
  assert.equal(got[0].spec.id, FLOW_RHYTHM.id);
  assert.equal(got[0].error, null, `진짜 엔진이 받지 않은 내용 — 게임은 삼키고 순간 맞춤만 꺼진다: ${got[0].error?.message}`);
  assert.equal(got[0].adaptive, true, '곡은 판정 폭의 순간 맞춤이 켜진다');
  assert.ok(auto.live, '게임이 순간 맞춤 겉을 쥔다');
  assert.deepEqual(scaled, [auto.timingStart], '판정 폭을 순간 맞춤의 처음 값으로 둔다');

  kept.set('synk.korean-rhythm.timing-mode', 'fixed');
  const fixed = startTiming();
  assert.equal(got.length, 2);
  assert.deepEqual(got[1].options, { declared: { mode: 'fixed' } });
  assert.equal(got[1].error, null, got[1].error?.message);
  assert.equal(got[1].adaptive, false, '「판정 폭 맞춤 꺼짐」은 순간 맞춤만 끈다');
  assert.ok(fixed.live);
  play.end();
  door.dispose();
});

test('며칠 뒤 다시 확인 — due()의 단위가 든, 아직 듣지 않은 며칠 뒤 확인 대화(옛 followups 대신)', async () => {
  const { play, coach, clock, door } = await opened();
  assert.deepEqual(play.dueItems(), [], '돌아온 단위가 없으면 없다');
  // 보충 연습에서 「-(으)면」(G401) 대화를 놓친다.
  const practice = supplementalItems({ purpose: 'practice' }).find(item => coach.itemUnits(item.itemKey).some(row => row.unit === 'ko.grammar.G401'));
  assert.ok(practice, 'G401이 든 보충 연습 대화');
  const pid = play.coach.present(practice); clock.advance();
  play.coach.delivery(pid, { audio: 'completed' }); clock.advance();
  play.coach.answer(pid, { correct: false, assessable: true }); clock.advance();
  play.end();
  await coach.finishSet({ record: false }).folded;
  clock.advance(3 * DAY);
  const due = coach.due().map(row => row.unit);
  assert.ok(due.includes('ko.grammar.G401'), due.join(' '));
  const items = play.dueItems();
  assert.ok(items.length > 0);
  const delayed = new Set(supplementalItems({ purpose: 'delayed', seen: () => false }).map(item => item.itemKey));
  for (const item of items) {
    assert.ok(delayed.has(item.itemKey), `며칠 뒤 확인 대화만: ${item.itemKey}`);
    assert.ok(coach.itemUnits(item.itemKey).some(row => due.includes(row.unit)), `돌아온 단위가 든 대화: ${item.itemKey}`);
  }
  assert.ok(items.some(item => coach.itemUnits(item.itemKey).some(row => row.unit === 'ko.grammar.G401')));
  // 들은 대화는 다시 내지 않는다.
  const first = items[0];
  const heard = play.coach.present(first); clock.advance();
  play.coach.answer(heard, { correct: true, assessable: true });
  assert.ok(!play.dueItems().some(item => item.itemKey === first.itemKey));
  door.dispose();
});

test('코치가 곡을 연 뒤에 왔으면(보면은 게임 차례) 곡의 첫 문장 앞에서 앞 판을 닫고 이 곡의 판을 연다', async () => {
  const { play, coach, port, spy, clock, door } = await opened();
  // 입구에서 보충 연습 한 대화 — 그 판에 든다.
  const row = supplementalItems({ purpose: 'practice' })[3];
  const sid = play.coach.present(row); clock.advance();
  play.coach.answer(sid, { correct: true, assessable: true }); clock.advance();
  const round = new RoundState(TRACKS[1], 'easy', 7); // variants 없이(코치를 받는 사이 지은 보면)
  const from = spy.calls.length;
  for (const q of round.questions) {
    const pid = play.coach.present(rhythmItem(1, q)); clock.advance();
    play.coach.answer(pid, oldAnswer('right')); clock.advance();
  }
  play.end();
  assert.deepEqual(names(spy).slice(from, from + 4), ['itemUnits', 'finishSet', 'recommend', 'present'], '첫 문장 앞에서만 앞 판을 닫는다');
  assert.equal(names(spy).slice(from).filter(name => name === 'finishSet').length, 2, '첫 문장 앞 · 곡 끝');
  const shown = (await events(coach, port)).filter(e => e.type === 'practice.presented');
  assert.notEqual(shown[0].setId, shown[1].setId, '보충 연습의 판과 곡의 판은 다르다');
  assert.equal(new Set(shown.slice(1).map(e => e.setId)).size, 1);
  door.dispose();
});

test('오류는 code로만 가른다 — 겉이 닫히면(RUN_ENDED) 기록 없이 놀이를 잇고, 판을 다시 정하면 retired, 그 밖의 오류는 그 부르기만 버린다', async () => {
  // 패널이 닫혔다(셸 dispose) — 그 뒤 부르기는 모두 기록 없이 지나간다.
  const closed = await opened();
  closed.door.dispose();
  closed.shell.run();
  assert.equal(closed.play.coach.present(rhythmItem(0, { sourceIndex: 0 })), null);
  assert.deepEqual(closed.play.song(), { trackId: null, line: null, held: null });
  const track = closed.play.variants(TRACKS[0]);
  assert.deepEqual(track.variantChoices, {}, '보면은 게임 차례로 선다');
  assert.equal(closed.play.coach.answer('p1', oldAnswer('right')), null);
  assert.equal(closed.play.coach.live(FLOW_RHYTHM, {}), null);
  assert.deepEqual(closed.play.dueItems(), []);
  closed.play.end();

  // 판을 다시 정했다 — 틀에 onRetired, 그 곡은 기록 없이 잇는다(다음 곡에서 app.mjs가 문을 다시 연다).
  const o = await opened();
  const pid = o.play.coach.present(rhythmItem(0, { sourceIndex: 0, variant: 0 }));
  assert.ok(pid);
  o.entry.retire(o.spy);
  assert.equal(o.play.retired, true);
  const count = o.spy.calls.length;
  assert.equal(o.play.coach.answer(pid, oldAnswer('right')), null);
  o.play.end();
  assert.equal(o.spy.calls.length, count, '닫힌 겉에는 더 부르지 않는다');

  // 셸 창에서 던진 오류는 틀에서 instanceof Error가 거짓이다 — 코드만 있는 객체로 흉내 낸다.
  const calls = [];
  let fail = null;
  const fake = {
    itemUnits: () => [{ unit: 'u' }],
    present: item => { calls.push('present'); if (fail) throw fail; return `p-${item.itemKey}`; },
    recommend: () => { calls.push('recommend'); throw { code: 'RECOMMEND_FAILED' }; },
    finishSet: () => { calls.push('finishSet'); },
    answer: () => { calls.push('answer'); return { verdict: 'correct', correct: true, evidence: Promise.resolve({ independent: true }) }; },
  };
  const play = createRhythm(fake);
  assert.deepEqual(play.song(), { trackId: null, line: null, held: null }, '고르기가 거절돼도 고른 곡 그대로 논다');
  fail = { code: 'ATTEMPT_UNSAVED' };
  assert.equal(play.coach.present({ itemKey: 'a', id: 'x' }), null);
  fail = null;
  assert.equal(play.coach.present({ itemKey: 'b', id: 'x' }), 'p-b', '다른 오류 뒤에도 다음 문항은 기록한다');
  fail = { code: 'RUN_ENDED' };
  assert.equal(play.coach.present({ itemKey: 'c', id: 'x' }), null);
  const before = calls.length;
  assert.equal(play.coach.present({ itemKey: 'd', id: 'x' }), null, 'RUN_ENDED 뒤에는 그 겉을 부르지 않는다');
  assert.equal(play.coach.answer('p-b', oldAnswer('right')), null);
  play.end();
  assert.equal(calls.length, before);
});

test('개발 깃발(로컬 주소 ?atlas=next) 없이 문도 없으면 새 길을 열지 않는다(null — 옛 길)', async () => {
  assert.equal(await openRhythm({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } } }), null);
  assert.equal(await openRhythm({ win: { parent: null, top: null, location: { hostname: 'localhost', search: '' } } }), null);
});
