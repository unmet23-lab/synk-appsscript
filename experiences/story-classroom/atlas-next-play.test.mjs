// 이야기 교실의 새 길(Atlas 재설계 4-6d — 단계4_계획 §23-7 · §23-10 「게임」). 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 게임 문
// (synk-world-app/world-atlas-game.mjs createGameDoor)에 넣고, 문을 거친 그대로(인수 복제) atlas-next-play.mjs로 진짜 StoryGame을 한 판씩 돈다.
// 이 게임은 WORLD 밖에서만 열려 4-6에서는 개발 깃발 길로만 쓰지만, 새 겉은 문과 깃발이 같은 키트(openNext)로 받으므로 문으로 한 바퀴 돌린다.
// 보는 것: recommend를 부르지 않음 · 장면의 부탁을 장면 차례로 한꺼번에 present(제시 사건은 모두 arm: host) · 판은 첫 제시 전에 서고 이야기
// 가운데 다시 열리지 않음(판 번호 하나) · 판마다 첫 제시 앞에서 startSet({ length: 이 판의 제시 수 })(셸 코치 흉내 — 지금 엔진에는 startSet이
// 없어 기본 판으로 연다) · 제시 → 도움 → 답의 차례 · 같은 제시의 뒤 답이 기록되고 두뇌 판 상태는 첫 판정 답만 움직임 ·
// 판 끝 finishSet({ record: false }) · 이어 하기 · 새것 한도를 다 쓴 날에도 끝까지 · 판을 다시 정하면 기록 없이 잇고 다음 판은 문을 다시 엶 ·
// 표시 설정으로 자동 읽기 · 은행에 없는 부탁은 내지 않음 · 원문(꺼진 판은 새 길 모듈을 싣지 않는다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { StoryGame } from './core.mjs';
import { EPISODE } from './story.mjs';
import { GAME_ID, missionMetadata } from './learning.mjs';
import { BANKS, NextStoryLearning, openStoryLearning } from './atlas-next-play.mjs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';

const require = createRequire(import.meta.url);
const { Flow } = require('../../atlas/game-browser.js');
const atlas = await import('../../packages/atlas/src/index.mjs');
const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0);   // 서울 오전 10시
const clock = (start = T0) => { const s = { t: start }; return { now: () => s.t, advance: (ms) => { s.t += ms; } }; };
let stores = 0;
const newKey = () => `synk-atlas:story-classroom-test-${process.pid}-${(stores += 1)}`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const ALL = [...EPISODE.acts.flatMap((act) => act.missions), ...EPISODE.review];
const byId = (id) => ALL.find((mission) => mission.id === id);
const keyOf = (id) => missionMetadata(byId(id)).itemKey;

async function engineCoach({ gameId = GAME_ID, port = atlas.memoryPort(), key = newKey(), time = clock(), prefs } = {}) {
  const coach = atlas.createCoach({ gameId, mapData, dayOffset: 540, host: { guest: true, port, key, now: time.now, ...(prefs ? { prefs } : {}) } });
  await coach.ready;
  return { coach, port, key, time };
}

// 코치 메서드 호출을 적는 겉(얼린 코치라 Proxy 대신 같은 이름의 함수 묶음).
function traced(coach) {
  const calls = [];
  const out = {};
  for (const name of Object.keys(coach)) {
    const value = coach[name];
    out[name] = typeof value === 'function' ? (...args) => { const result = value(...args); calls.push({ name, args, result }); return result; } : value;
  }
  return { coach: out, calls, names: () => calls.map((call) => call.name) };
}

// 가짜 입구 · 문 · 틀 창 — 문을 거친 그대로 연다. 틀 창에는 옛 묶음의 Flow(대응 함수)만 있다(페이지가 싣는 atlas-learning.js와 같은 일).
async function throughDoor(coach, { give = () => coach } = {}) {
  const retirers = new Set();
  const entry = { gameCoach: async () => give(), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } };
  const door = createGameDoor({ entry, gameId: 'story-classroom', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const win = { parent: top, top, addEventListener: () => {}, location: { hostname: 'synk.im', search: '' }, SynkLearning: { Flow } };
  const learning = await openStoryLearning({ win, old: () => 'OLD' });
  return { learning, door, win, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })) };
}

// app.mjs와 같은 차례: 이야기를 열 때 이 판에서 낼 제시 수를 판 길이로 넘기고(start), 부탁 판이 보이면 그 장면의 부탁을 모두 제시하고
// (renderAsk), 놓을 때마다 recordResponse(place)한다.
const begin = (learning, game, options = {}) => learning.beginRun({ ...options, length: game.missionsAhead().length });
const showAsk = (learning, game) => { for (const m of game.missions) learning.present(m, { record: game.records.find((r) => r.id === m.id), visible: true }); };
const done = (game, m) => game.completedIds.includes(m.id);
const ready = (game) => game.missions.filter((m) => !done(game, m) && (m.requires || []).every((id) => game.completedIds.includes(id)));
const WRONG = { snacks: 'shelf', paper: 'box', flowers: 'shelf', letter: 'table', cake: 'box', ribbon: 'drawer' };
function place(learning, game, m, destination, time) {
  time.advance(4000);
  game.selectActor(m.actor); game.selectObject(m.object);
  const result = game.place(destination);
  const record = game.records.find((r) => r.id === m.id);
  return result.mission && result.moved ? learning.recordResponse(result, { attemptNo: record.attempts, requestId: `${m.id}:${record.attempts}` }) : null;
}
function hint(learning, game, m, time) {
  time.advance(2000);
  const r = game.help(m.id);
  learning.help(r.mission.id, { kind: 'text', revealsAnswer: true, requestId: `hint:${m.id}:${game.records.find((x) => x.id === m.id).helpCount}` });
}
const toAsk = (game) => { while (!['play', 'review', 'complete'].includes(game.phase)) game.advance(); };
// 장면 하나를 끝까지(장면 차례 — requires를 채운 첫 부탁부터). wrong: 먼저 틀리게 놓을 부탁, hints: 먼저 힌트를 볼 부탁.
function playScene(learning, game, time, { wrong = new Set(), hints = new Set() } = {}) {
  toAsk(game);
  if (game.phase === 'complete') return [];   // 바뀐 부탁 없이 끝나는 연습 판 — 결과 화면은 부탁 판을 그리지 않는다
  showAsk(learning, game);
  const recs = [];
  while (['play', 'review'].includes(game.phase)) {
    const m = ready(game)[0];
    if (hints.has(m.id)) hint(learning, game, m, time);
    if (wrong.has(m.id)) recs.push(place(learning, game, m, WRONG[m.object], time));
    recs.push(place(learning, game, m, m.destination, time));
  }
  return recs;
}
function playStory(learning, game, time, options = {}) {
  const recs = [];
  while (game.phase !== 'complete') { recs.push(...playScene(learning, game, time, options)); if (game.phase !== 'complete') game.advance(); }
  return recs;
}

const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
const presentedOf = async (port) => (await eventsOf(port)).filter((event) => event.type === 'practice.presented');
const stored = async (recs) => { await Promise.all(recs.filter(Boolean).map((rec) => rec.stored)); await settle(); };

test('은행 이름은 셸의 게임 은행 표와 같다', () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS['story-classroom']]);
});

test('문이 없으면 옛 길, 셸이 지금 판이면 옛 길, 문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 기록 없이 논다', async () => {
  let olds = 0;
  const old = () => { olds += 1; return 'OLD'; };
  assert.equal(await openStoryLearning({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '?atlas=next' } }, old }), 'OLD', '공개 주소는 개발 깃발을 읽지 않는다');
  const held = await throughDoor(null, { give: () => null });
  assert.equal(held.learning, 'OLD', '셸이 지금 판이라고 하면 옛 길');
  // 기다리던 open이 패널 닫힘으로 끝나면 null이 아니라 RUN_ENDED — 옛 길을 열지 않는다.
  let release;
  const { coach } = await engineCoach();
  const entry = { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} };
  const door = createGameDoor({ entry, gameId: 'story-classroom', later: (fn) => fn() });
  const top = { SYNKAtlasGame: door.api };
  const opening = openStoryLearning({ win: { parent: top, top, addEventListener() {} }, old });
  door.dispose(); release();
  const quiet = await opening;
  assert.equal(olds, 1, '닫히는 문에서는 옛 길(createGame)을 열지 않는다');
  assert.ok(quiet instanceof NextStoryLearning);
  assert.equal(quiet.quiet, true);
  assert.equal(quiet.status().phase, 'quiet');
  assert.equal(quiet.status().warning, null, '안내 없이');
  quiet.beginRun();
  assert.equal(quiet.present(byId('cleanup-snacks')), null, '기록 없이 논다');
  assert.equal(quiet.retired, false, '다시 열지 않는다');
  coach.dispose();
});

test('빈 기억 손님의 한 판 — recommend 없이 장면 차례로 한꺼번에 제시(모두 host), 판 하나, 제시 → 도움 → 답, 뒤 답 기록, 판 끝 finishSet', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { learning } = await throughDoor(spy.coach);
  assert.ok(learning instanceof NextStoryLearning);
  const game = new StoryGame();
  begin(learning, game);
  assert.deepEqual(spy.names(), ['finishSet', 'summary'], '이야기를 열 때 그 코치에 열린 판을 기록 없이 닫는다 — 새 판은 첫 제시 앞에서 연다');
  // 장면 1: 과자는 틀린 뒤 같은 제시에서 고쳐 놓고(뒤 답), 종이는 맞힌 뒤 되돌려 다시 틀리고 고친다(놓을 때마다 답).
  toAsk(game);
  showAsk(learning, game);
  assert.deepEqual(spy.names().filter((name) => name === 'present').length, 2, '장면의 부탁 둘을 한꺼번에');
  showAsk(learning, game);
  assert.equal(spy.names().filter((name) => name === 'present').length, 2, '다시 그려도 한 번');
  const snacks = byId('cleanup-snacks'), paper = byId('cleanup-paper');
  const recs = [];
  hint(learning, game, paper, time);
  recs.push(place(learning, game, snacks, WRONG.snacks, time), place(learning, game, snacks, snacks.destination, time));
  recs.push(place(learning, game, paper, paper.destination, time));
  assert.equal(game.phase, 'outro');
  assert.equal(game.undo(), true);
  recs.push(place(learning, game, paper, WRONG.paper, time), place(learning, game, paper, paper.destination, time));
  assert.deepEqual(recs.map((rec) => rec.verdict), ['incorrect', 'correct', 'correct', 'incorrect', 'correct']);
  game.advance();
  recs.push(...playStory(learning, game, time, { hints: new Set(['clue-letter']) }));
  learning.endRun();
  learning.endRun();
  assert.equal(spy.names().includes('recommend'), false, '새 길은 recommend를 부르지 않는다');
  assert.deepEqual(spy.calls.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }, { record: false }], '열 때와 판 끝에 한 번씩, 기록 없이');
  // 장면 차례: 장면마다 그 장면의 제시가 그 장면의 답보다 먼저 한꺼번에.
  const order = spy.calls.filter((call) => ['present', 'answer'].includes(call.name)).map((call) => (call.name === 'present' ? call.args[0].itemKey : 'a'));
  assert.deepEqual(order.filter((x) => x !== 'a'), ALL.map((m) => missionMetadata(m).itemKey), '부탁 아홉을 장면 차례로');
  assert.deepEqual(order.slice(0, 3), [keyOf('cleanup-snacks'), keyOf('cleanup-paper'), 'a']);
  await stored(recs);
  const rows = await eventsOf(port);
  const presented = rows.filter((event) => event.type === 'practice.presented');
  assert.equal(presented.length, 9);
  assert.ok(presented.every((event) => event.arm === 'host' && event.reason.code === 'host.order'), '제시 사건은 모두 제품 차례');
  assert.equal(new Set(presented.map((event) => event.setId)).size, 1, '판은 첫 제시 전에 서고 이야기 가운데 다시 열리지 않는다');
  assert.deepEqual(spy.calls.filter((call) => call.name === 'startSet').map((call) => call.args[0]), [{ length: 9 }], '판 길이는 부탁 아홉');
  assert.ok(presented.every((event) => event.reason.tier !== 9), '판 길이를 넘겨 새것 한도(27) 안 — 빈 기억 손님의 첫 판에 한도를 넘은 부탁(층 9)이 없다');
  assert.ok(presented.every((event) => event.confounded === false));
  // 제시마다: 제시 → (도움) → 답. 뒤 답은 같은 제시의 attemptNo 2, 3.
  const group = (id) => rows.filter((row) => row.presentationId === presented.find((event) => event.itemKey === keyOf(id)).id);
  assert.deepEqual(group('cleanup-snacks').map((row) => [row.type, row.attemptNo, row.verdict]), [
    ['practice.attempted', 1, 'incorrect'], ['practice.attempted', 2, 'correct']]);
  assert.deepEqual(group('cleanup-paper').map((row) => [row.type, row.helpId ?? row.attemptNo, row.verdict ?? null]), [
    ['practice.helped', 'answer', null], ['practice.attempted', 1, 'correct'], ['practice.attempted', 2, 'incorrect'], ['practice.attempted', 3, 'correct']]);
  assert.deepEqual(group('clue-letter').map((row) => row.type), ['practice.helped', 'practice.attempted']);
  assert.deepEqual(group('review-cake').map((row) => row.type), ['practice.attempted']);
  assert.equal(rows.some((row) => row.type === 'practice.delivery'), false, '읽기 게임 — 전달은 없다(보이는 글이 읽을거리)');
  // 다음 판은 새 판 번호.
  const again = new StoryGame();
  begin(learning, again);
  playScene(learning, again, time);
  learning.endRun();
  await settle();
  const next = (await presentedOf(port)).slice(9);
  assert.equal(next.length, 2);
  assert.notEqual(next[0].setId, presented[0].setId);
  assert.equal(spy.calls.filter((call) => call.name === 'finishSet').length, 4);
  coach.dispose();
});

// 셸 코치 흉내 — startSet · present · finishSet을 차례대로 적는다. startSet이 없는 코치(앞 판 엔진)도 만든다.
function setSpy({ withStartSet = true, startSet = null } = {}) {
  const calls = [];
  let n = 0, sets = 0;
  const coach = {
    itemUnits: () => [{ unit: 'u', kind: 'word', label: null }],
    present: (item) => { calls.push(['present', item.itemKey]); return `p${(n += 1)}`; },
    answer: () => ({ eventId: `a${n}`, verdict: 'correct' }),
    help: () => ({}),
    finishSet: (options) => calls.push(['finishSet', options]),
    summary: () => ({ storage: { available: true, guest: true } }),
    presentation: () => null,
  };
  if (withStartSet) coach.startSet = startSet ?? ((options) => { calls.push(['startSet', options]); return { opened: true, setId: `s${(sets += 1)}` }; });
  const order = () => calls.map(([name, arg]) => (name === 'startSet' ? `startSet ${arg.length}` : name));
  return { coach, calls, order };
}

test('정해진 차례 판 — 판마다 첫 제시 앞에서 한 번 startSet({ length: 이 판의 제시 수 }), 판을 닫고 다음 판을 열 때 다시', async () => {
  const time = clock();
  const spy = setSpy();
  const { learning, door } = await throughDoor(spy.coach);
  const game = new StoryGame();
  begin(learning, game);
  assert.deepEqual(spy.order(), ['finishSet'], '이야기를 열 때는 앞 판만 닫는다 — 판은 첫 제시 앞에서 연다');
  const recs = playStory(learning, game, time);
  learning.endRun();
  assert.equal(recs.length, 9);
  assert.deepEqual(spy.order(), ['finishSet', 'startSet 9', ...Array(9).fill('present'), 'finishSet'], '부탁 아홉 앞에서 한 번, 판 끝에 닫는다');
  assert.deepEqual(spy.calls.filter(([name]) => name === 'finishSet').map(([, options]) => options), [{ record: false }, { record: false }]);
  // 다음 판(한 판 더): 앞 판은 이미 닫혔고, 이야기를 열 때 다시 닫은 뒤 새 판의 첫 제시 앞에서 다시 연다.
  spy.calls.length = 0;
  const again = new StoryGame();
  begin(learning, again);
  playScene(learning, again, time);
  assert.deepEqual(spy.order(), ['finishSet', 'startSet 9', 'present', 'present']);
  // 그만두고(endRun) 맞춤 연습 한 장면 — 그 판의 제시 수(2)로 연다.
  learning.endRun();
  spy.calls.length = 0;
  const practice = new StoryGame();
  practice.startPractice(['clue-letter']);
  begin(learning, practice);
  playStory(learning, practice, time);
  learning.endRun();
  assert.deepEqual(spy.order(), ['finishSet', 'startSet 2', 'present', 'present', 'finishSet']);
  // 바뀐 부탁만 연습하는 판은 3.
  spy.calls.length = 0;
  const review = new StoryGame();
  review.startPractice(['review-cake']);
  begin(learning, review);
  playStory(learning, review, time);
  learning.endRun();
  assert.deepEqual(spy.order(), ['finishSet', 'startSet 3', 'present', 'present', 'present', 'finishSet']);
  door.dispose();
});

test('판 길이를 넘기지 못해도 놀이는 그대로 — 길이 없음 · startSet 없음(앞 판 엔진)이면 부르지 않고, 이미 열린 판(opened: false)도 그 판으로 잇는다', async () => {
  const time = clock();
  // 길이를 모르면 startSet을 부르지 않는다 — 첫 제시가 기본 판을 연다.
  const unknown = setSpy();
  const a = await throughDoor(unknown.coach);
  a.learning.beginRun();
  playScene(a.learning, new StoryGame(), time);
  a.learning.endRun();
  assert.deepEqual(unknown.order(), ['finishSet', 'present', 'present', 'finishSet']);
  a.door.dispose();
  // 셸 코치에 startSet이 없다(지금 엔진).
  const older = setSpy({ withStartSet: false });
  const b = await throughDoor(older.coach);
  const game = new StoryGame();
  begin(b.learning, game);
  assert.equal(playStory(b.learning, game, time).length, 9);
  b.learning.endRun();
  assert.deepEqual(older.order(), ['finishSet', ...Array(9).fill('present'), 'finishSet']);
  assert.equal(b.learning.status().warning, null);
  b.door.dispose();
  // 코치가 이미 열린 판을 돌려준다(opened: false) — 새 판을 열지 않고 그 판으로 잇고, 판 끝에 닫는다.
  const asked = [];
  const kept = setSpy({ startSet: (options) => { asked.push(options); return { opened: false, setId: 's0' }; } });
  const c = await throughDoor(kept.coach);
  c.learning.beginRun({ length: 9 });
  playScene(c.learning, new StoryGame(), time);
  c.learning.endRun();
  assert.deepEqual(asked, [{ length: 9 }]);
  assert.deepEqual(kept.order(), ['finishSet', 'present', 'present', 'finishSet']);
  c.door.dispose();
  // 판을 다시 정해 겉이 닫힌 뒤에는 startSet에 닿지 않는다.
  const shut = setSpy();
  const d = await throughDoor(shut.coach);
  d.learning.beginRun({ length: 9 });
  d.retire();
  playScene(d.learning, new StoryGame(), time);
  assert.deepEqual(shut.order(), ['finishSet']);
  d.door.dispose();
});

test('같은 제시의 뒤 답은 기록되고 두뇌 판 상태는 움직이지 않는다 — 놓친 단위가 이 판에서 다른 문항으로 돌아올 차례로 남는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { learning } = await throughDoor(spy.coach);
  const game = new StoryGame();
  begin(learning, game);
  const recs = playScene(learning, game, time, { wrong: new Set(['cleanup-snacks']) });
  game.advance();
  recs.push(...playScene(learning, game, time));
  assert.deepEqual(recs.slice(0, 2).map((rec) => [rec.verdict, rec.gameAttemptNo]), [['incorrect', 1], ['correct', 2]]);
  // 들여다보기(게임은 부르지 않는다): 같은 판에서 바뀐 부탁 가운데 엔진이 무엇을 먼저 낼지 — 과자(ko.word.w0732)를 놓친 「다시」가 남아 있다.
  // 뒤 답(고쳐 놓음)이 판 상태를 움직였다면 「다시」가 풀려 새 문법(S115)의 부탁이 먼저였다.
  const look = coach.recommend(EPISODE.review.map((m) => ({ itemKey: missionMetadata(m).itemKey })));
  assert.equal(look.why.code, 'unit.retry');
  assert.equal(look.target, 'ko.word.w0732');
  // 들여다본 뒤에도 게임의 다음 제시(장면 3)는 제품 차례 그대로다.
  game.advance();
  recs.push(...playScene(learning, game, time));
  learning.endRun();
  await stored(recs);
  const presented = await presentedOf(port);
  assert.equal(presented.length, 6);
  assert.ok(presented.every((event) => event.arm === 'host'));
  assert.equal(spy.names().includes('recommend'), false);
  coach.dispose();
  // 견줌: 과자를 처음에 맞힌 판에서는 같은 들여다보기에 「다시」가 없다.
  const control = await engineCoach();
  const plain = (await throughDoor(control.coach)).learning;
  const replay = new StoryGame();
  begin(plain, replay);
  playScene(plain, replay, control.time);
  replay.advance();
  playScene(plain, replay, control.time);
  assert.notEqual(control.coach.recommend(EPISODE.review.map((m) => ({ itemKey: missionMetadata(m).itemKey }))).why.code, 'unit.retry');
  control.coach.dispose();
});

test('이어 하기 — 되살린 이미 답한 부탁은 처음이 아닌 제시(firstExposure: false · confounded)로 내고 그 답은 판정하지 않는다', async () => {
  const { coach, port, time } = await engineCoach();
  const { learning } = await throughDoor(coach);
  learning.beginRun({ restored: true });
  const snacks = byId('cleanup-snacks'), paper = byId('cleanup-paper');
  learning.present(snacks, { record: { attempts: 2, helpUsed: true, audioHelpUsed: false } });
  learning.present(paper, { record: { attempts: 0, audioHelpUsed: true, audioHelps: [{ source: 'mission' }] } });
  time.advance(3000);
  const historical = learning.recordResponse({ mission: snacks, correct: true, kind: 'correct' }, { attemptNo: 3 });
  const fresh = learning.recordResponse({ mission: paper, correct: true, kind: 'correct' }, { attemptNo: 1 });
  assert.equal(historical.verdict, 'unassessed'); assert.equal(historical.gameAttemptNo, 3); assert.equal(historical.historical, true);
  assert.equal(fresh.verdict, 'correct');
  assert.equal(learning.recordResponse({ mission: snacks, correct: true, kind: 'correct' }, { attemptNo: 2 }), null, '되살리기 앞의 시도는 받지 않는다');
  learning.endRun();
  await stored([historical, fresh]);
  const rows = await eventsOf(port);
  const [a, b] = rows.filter((event) => event.type === 'practice.presented');
  assert.equal(a.confounded, true); assert.equal(a.firstExposure, false);
  assert.equal(b.confounded, false);
  assert.deepEqual(rows.filter((row) => row.type === 'practice.helped').map((row) => [row.presentationId === a.id ? 'snacks' : 'paper', row.helpId]),
    [['snacks', 'answer'], ['paper', 'replay']]);
  coach.dispose();
});

test('빠진 시도 · 겹친 시도 — 겹치면 처음 답을 돌려주고, 빠지면 기록을 멈추고 진행 저장도 멈춘다(옛 길과 같다)', async () => {
  const { coach } = await engineCoach();
  const { learning } = await throughDoor(coach);
  learning.beginRun();
  const snacks = byId('cleanup-snacks');
  learning.present(snacks);
  const first = learning.recordResponse({ mission: snacks, correct: true, kind: 'correct' }, { attemptNo: 1 });
  assert.equal(learning.recordResponse({ mission: snacks, correct: false, kind: 'destination' }, { attemptNo: 1 }).eventId, first.eventId);
  assert.equal(learning.progressScope().key, 'synk.story-classroom.progress.v3.guest');
  assert.equal(learning.recordResponse({ mission: snacks, correct: true, kind: 'correct' }, { attemptNo: 3 }), null);
  assert.equal(learning.status().code, 'INCOMPLETE_GAME_ATTEMPTS');
  assert.equal(learning.progressScope().key, null);
  coach.dispose();
});

test('같은 날 다른 게임이 새것 한도를 다 써도 이야기는 끝까지 — 아홉 부탁이 모두 제품 차례로 나가고 기록된다', async () => {
  const port = atlas.memoryPort(), key = newKey(), time = clock();
  const map = atlas.openMap(mapData);
  const storyUnits = new Set(map.items('story-classroom').flatMap((item) => item.units));
  const pool = map.items('blank-slice').filter((item) => item.units.every((unit) => !storyUnits.has(unit))).map((item) => ({ itemKey: item.itemKey }));
  const other = (await engineCoach({ gameId: 'blank-slice', port, key, time })).coach;
  for (let i = 0; i < 40; i += 1) {
    const picked = other.recommend(pool, { set: { length: 40, newLimit: 120 } });
    if (picked.status !== 'ready') break;
    const pid = other.present(picked.selected); time.advance(3000);
    other.answer(pid, { correct: true, assessable: true }); time.advance(3000);
  }
  other.finishSet({ record: false });
  const { coach } = await engineCoach({ port, key, time });
  assert.equal(coach.recommend(ALL.map((m) => ({ itemKey: missionMetadata(m).itemKey }))).status, 'none', '엔진이 고른다면 첫 부탁부터 none');
  coach.finishSet({ record: false });
  const { learning } = await throughDoor(coach);
  const game = new StoryGame();
  begin(learning, game);
  const recs = playStory(learning, game, time);
  learning.endRun();
  assert.equal(recs.length, 9, '놀이는 멈추지 않는다');
  await stored(recs);
  const presented = (await presentedOf(port)).filter((event) => event.itemKey.startsWith('story-classroom.'));
  assert.equal(presented.length, 9);
  assert.ok(presented.every((event) => event.arm === 'host'));
  assert.ok(presented.some((event) => event.reason.tier === 9), '층 9(새것 한도)도 제품 차례로 낸다');
  assert.equal(new Set(presented.map((event) => event.setId)).size, 1);
  other.dispose(); coach.dispose();
});

test('판을 다시 정하면 이번 판은 기록 없이 잇고, 다음 판은 문을 다시 열어 새 겉을 받는다', async () => {
  const { coach, port, time } = await engineCoach();
  const spy = traced(coach);
  const { learning, retire } = await throughDoor(spy.coach);
  const game = new StoryGame();
  begin(learning, game);
  const recs = playScene(learning, game, time);
  // 둘째 장면 앞에서 셸이 판을 다시 정했다.
  retire();
  assert.equal(learning.retired, true);
  assert.equal(learning.status().phase, 'quiet');
  const before = spy.calls.length;
  game.advance();
  const after = playStory(learning, game, time);
  assert.equal(game.phase, 'complete', '이야기는 끝까지 이어 간다');
  assert.ok(after.every((rec) => rec === null), '닫힌 뒤의 답은 기록하지 않는다');
  learning.endRun();
  assert.equal(spy.calls.length, before, '닫힌 뒤에는 셸 코치에 닿지 않는다');
  // 다음 판: 같은 문으로 다시 연다 — 새 겉.
  const renewed = learning.renew();
  assert.equal(learning.renew(), renewed, '여러 번 눌러도 한 번 연다');
  const fresh = await renewed;
  assert.ok(fresh instanceof NextStoryLearning);
  assert.notEqual(fresh, learning);
  assert.equal(fresh.retired, false);
  const third = new StoryGame();
  begin(fresh, third);
  const next = playScene(fresh, third, time);
  fresh.endRun();
  await stored([...recs, ...next]);
  const presented = await presentedOf(port);
  assert.equal(presented.length, 4, '앞 판의 첫 장면 둘과 새 판의 첫 장면 둘');
  assert.notEqual(presented[2].setId, presented[0].setId);
  coach.dispose();
});

// 순간 맞춤 진입(4-6e-2): 이 게임은 live를 쓰지 않고 FLOW_VOICE를 페이지의 Flow.declaredFrom에만 넘긴다. voiceDefault는 그 던짐을 삼키고
// 기본값(스스로 읽음)으로 가므로, 「혼자 하기 → 누를 때만」이 진짜 대응 함수가 그 내용을 받아들였다는 단정이다.
test('자동 읽기의 처음 값 — 새 코치의 표시 설정(셸 · 혼자 뜨는 길의 prefs)을 같은 대응으로 읽는다', async () => {
  const withChoice = async (presentation, options) => {
    const { coach } = await engineCoach({ prefs: { presentation: () => presentation } });
    const { learning } = await throughDoor(coach);
    const value = learning.voiceDefault(options);
    coach.dispose();
    return value;
  };
  assert.equal(await withChoice({ support: 'independent' }), false, '혼자 하기: 누를 때만 읽는다');
  assert.equal(await withChoice({ support: 'step' }), true, '단계별 도움: 스스로 읽는다');
  assert.equal(await withChoice({ support: 'choose' }), true);
  assert.equal(await withChoice(null), true, '고른 것이 없으면 지금 기본값');
  assert.equal(await withChoice(null, { target: true }), false);
  assert.equal(await withChoice({ support: 'step' }, { target: true }), true);
});

test('은행에 없는 부탁은 내지 않는다 — 셸 코치의 itemUnits가 빈 부탁은 present하지 않는다', async () => {
  const calls = [];
  const fake = {
    itemUnits: (key) => { calls.push(['itemUnits', key]); return key === keyOf('cleanup-paper') ? [] : [{ unit: 'u', kind: 'word', label: null }]; },
    present: (item) => { calls.push(['present', item.itemKey]); return 'p1'; },
    answer: () => ({ eventId: 'a1', verdict: 'correct' }),
    finishSet: () => calls.push(['finishSet']),
    summary: () => ({ storage: { available: true, guest: true } }),
    presentation: () => null,
  };
  const { learning, door } = await throughDoor(fake);
  learning.beginRun();
  assert.equal(learning.present(byId('cleanup-paper')), null);
  assert.equal(learning.present(byId('cleanup-snacks')), 'p1');
  assert.deepEqual(calls.filter(([name]) => name === 'present'), [['present', keyOf('cleanup-snacks')]]);
  assert.equal(learning.status().phase, 'device');
  assert.equal(learning.status().warning, null);
  learning.dispose();
  assert.deepEqual(calls.at(-1), ['finishSet'], '떠날 때 판을 기록 없이 닫는다');
  door.dispose();
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만든다', () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(imports.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.ok(source.includes('const openOldLearning = () => createStoryLearning({ storage: localStorage });'), '옛 코치는 지금과 같은 인수');
  assert.match(source, /let learning = nextDoor\(window\) \|\| devFlag\(window\) \? await openNextLearning\(\) : openOldLearning\(\);/, '문이 없으면 이 자리에서 동기로 옛 코치');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs' || name.endsWith('.test.mjs')) continue;
    const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 옛 길의 것(return-practice · 옛 요약 · events · 기록 지우기 · syncPort · recommend · live)을 쓰지 않는다.
  const next = readFileSync(new URL('./atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['returnPractice', 'missedStory', 'supportedPractice', 'skillReport', 'createGame', 'events(', 'syncPort', 'reset(', 'recheck', '.recommend(', '.live(', 'disconnect'])
    assert.equal(next.includes(word), false, word);
});
