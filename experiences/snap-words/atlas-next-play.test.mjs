// 찰칵 낱말의 새 길(Atlas 재설계 단계 4 §23-7 · §23-10 「게임」) — atlas-next-play.mjs.
// 진짜 엔진 코치를 가짜 입구로 셸의 문(createGameDoor)에 넣고 틀 창의 키트로 열어 문을 거친 그대로 돈다(인수 복제 · 겉 닫힘까지).
// 장소 한 판(app.mjs와 같은 차례 — 부탁 present · 전달 · 답 · 도움, 인화 present · 답, 판 끝 finishSet), 판 하나 · 게임 차례(arm host),
// 같은 제시의 뒤 답(기록되고 판 상태를 움직이지 않음), 나가기의 다음 차례 번호, 약한 낱말(due() · 끈질긴 단위), 같은 날 넷째 게임(하루
// 새것 한도를 다 써도 게임 차례라 판 끝까지 기록), 판을 다시 정하면 다음 판에서 다시 열기, 오류는 code로만.
// 찰칵 낱말은 recommend를 부르지 않는다(§23-7 — 부탁 차례는 게임) — 그래서 idle · none이 없고, 이유 줄도 없다. 대신 첫 부탁 전에 판 길이를
// 코치 startSet으로 넘긴다(부탁 수 + 인화 상한) — 지금 엔진에는 startSet이 없어 첩자로 차례를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGameDoor, GAME_BANKS } from '../synk-world-app/world-atlas-game.mjs';
import { BANKS, createNextLearning, missionItems, openLearning, roundLength } from './atlas-next-play.mjs';
import { GAME_ID, itemMetadata, missionMetadata, recallMetadata } from './learning.mjs';
import { PLACES, PLACE_ORDER, placeWords } from './places.mjs';
import { RECALL_PER_ROUND, helpLevel, makeRecall, makeRng, pickMissions } from './core.mjs';

const atlas = await import('../../packages/atlas/src/index.mjs');
const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const INDEX = readJson('../../packages/atlas/map/index.json');
const UNITS = readJson('../../packages/atlas/map/units.json');
const T0 = Date.UTC(2026, 10, 19, 1, 0, 0); // 서울 10시
const HOUR = 3_600_000, DAY = 24 * HOUR;
const COACH_METHODS = ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live'];

const clockAt = (start = T0) => { const state = { t: start }; return { now: () => state.t, advance: (ms = 4000) => (state.t += ms) }; };
let stores = 0;
async function realCoach({ clock, port = atlas.memoryPort(), key = null, gameId = GAME_ID }) {
  stores += 1;
  const coach = atlas.createCoach({
    gameId,
    mapData: { index: INDEX, units: UNITS },
    dayOffset: 540,
    host: { guest: true, port, key: key ?? `synk-atlas:snap-words-test-${process.pid}-${stores}`, now: clock.now },
  });
  await coach.ready;
  return { coach, port };
}
// 셸 창 코치를 지켜보는 겉 — 부른 차례와 인수 · 결과를 적는다(문은 이 객체의 메서드를 부른다).
// startSet: 판 길이 첩자를 둔다 — 엔진에 startSet이 있으면 그것을 부르고, 없으면(지금 엔진) 적기만 하고 연 판을 지어 돌려준다.
// startSet을 주지 않으면 지금 엔진처럼 startSet이 없는 코치다.
function spied(coach, { startSet = false } = {}) {
  const calls = [];
  const spy = { calls };
  let sets = 0;
  const fake = { startSet: () => ({ opened: true, setId: `fake-set-${(sets += 1)}` }) };
  const names = startSet ? [...COACH_METHODS, 'startSet'] : COACH_METHODS;
  for (const name of names) spy[name] = (...args) => { const row = [name, args]; calls.push(row); row.push((typeof coach[name] === 'function' ? coach : fake)[name](...args)); return row[2]; };
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
async function opened({ clock = clockAt(), give = null, port = atlas.memoryPort(), key = null, startSet = false } = {}) {
  const { coach } = await realCoach({ clock, port, key });
  const spy = spied(coach, { startSet });
  const entry = entryOf(() => (give ? give(spy) : spy));
  const shell = tasks();
  const door = createGameDoor({ entry, gameId: GAME_ID, later: shell.later });
  const frame = frameOf(door);
  let olds = 0;
  const learn = await openLearning({ win: frame, old: () => { olds += 1; return 'old-coach'; } });
  return { learn, coach, port, spy, entry, shell, door, frame, clock, olds: () => olds };
}
// 저장된 사건 — 저장소의 차례는 일어난 차례가 아니라서 때(at)로 줄 세운다(같은 때는 저장소 차례 그대로).
const events = async (coach, port) => {
  await coach.finishSet({ record: false }).folded;
  return (await port.read()).filter((row) => row.value?.kind === 'event').map((row) => row.value.event).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
};
const names = (spy, { units = false } = {}) => spy.calls.map(([name]) => name).filter((name) => units || name !== 'itemUnits');
const otherWord = (place, m) => (m.kind === 'word' ? place.things.find((t) => t.word !== m.word).word : Object.values(place.groups).flatMap((g) => g.pool).find((w) => w !== m.word));

// app.mjs의 차례 그대로: 판을 열 때 약한 낱말 → 부탁 시작(판 길이 — begin) → 부탁마다 제시 → (소리 부탁이면 다 들음 — 다시 들어도 전달은
// 한 번) → 다르게 찍은 답(둘째부터 도움) → 맞힌 답, 그다음 인화(제시 → 바로 답), 판 끝. wrongs[i]: i번째 부탁에서 다르게 찍는 수.
// recallWrong: 틀리는 인화의 차례.
function playRound(learn, clock, { place = PLACES.gate, seed = 7, wrongs = [], recallWrong = -1, voice = true } = {}) {
  const rng = makeRng(seed);
  const step = () => clock.advance(4000);
  const missions = pickMissions(place, { weak: learn.weak(place), rng, voice });
  learn.begin(missions);
  const shots = [];
  missions.forEach((m, i) => {
    m.tries = 0;
    learn.present(m); step();
    if (m.kind === 'sound') { learn.heard(m); step(); learn.heard(m); step(); }
    for (let w = 0; w < (wrongs[i] ?? 0); w += 1) {
      learn.answer(m, { correct: false, selected: otherWord(place, m), attemptNo: m.tries + 1 }); m.tries += 1; step();
      if (helpLevel(m.tries) !== 'point') { learn.helped(m); step(); }
    }
    learn.answer(m, { correct: true, selected: m.word, attemptNo: m.tries + 1 }); step();
    learn.heard(m); // 맞힌 뒤 소리가 끝나도 전달을 더 남기지 않는다
    shots.push({ word: m.word, kind: m.kind === 'word' ? 'thing' : 'plate' });
  });
  const qs = makeRecall(place, shots, { rng, lang: 'ko' });
  qs.forEach((q, i) => { learn.recall(q, i === recallWrong ? q.options.find((o) => o !== q.answer) : q.answer); step(); });
  learn.end();
  return { missions, qs };
}

test('은행 이름은 셸의 게임 은행 표와 같고, 게임이 낼 수 있는 부탁 · 인화 문항은 모두 은행에 있다', async () => {
  assert.deepEqual([...BANKS], [...GAME_BANKS[GAME_ID]]);
  const { coach } = await realCoach({ clock: clockAt() });
  const keys = new Set();
  for (const id of PLACE_ORDER) {
    const place = PLACES[id];
    for (let seed = 1; seed < 40; seed += 1) for (const notices of [false, true]) for (const m of pickMissions(place, { rng: makeRng(seed), notices })) keys.add(missionMetadata(m).itemKey);
    // 인화: 물건 사진 → 낱말 고르기, 판(고정 판 포함) → 뜻 고르기(core.mjs makeRecall)
    for (const word of placeWords(place, { notices: true })) keys.add(recallMetadata({ mode: place.things.some((t) => t.word === word) ? 'word' : 'meaning', answer: word }).itemKey);
    // 약한 낱말이 보는 부탁 문항 = pickMissions의 뜻 · 소리 · 낱말 부탁(안내문 빼고)
    const seen = new Set();
    for (let seed = 1; seed < 80; seed += 1) for (const m of pickMissions(place, { rng: makeRng(seed) })) if (m.kind !== 'notice') seen.add(missionMetadata(m).itemKey);
    assert.deepEqual(new Set(missionItems(place).map((row) => row.meta.itemKey)), seen, id);
  }
  for (const key of keys) assert.ok(coach.itemUnits(key).length > 0, key);
});

test('문을 거친 진짜 코치로 장소 한 판 — 제시 · 전달 · 도움 · 답의 차례, 판 하나(게임 차례), 판 끝 finishSet', async () => {
  const { learn, coach, port, spy, entry, clock, door, frame } = await opened();
  assert.deepEqual(entry.asked, [[GAME_ID, ['snap-words']]]);
  assert.deepEqual(frame.listeners.map(([type]) => type), ['pagehide'], '키트의 leave만 — 게임은 떠날 때 답을 지어내지 않는다');
  const { missions, qs } = playRound(learn, clock, { wrongs: [2, 1], recallWrong: 1 });
  assert.equal(missions.length, 4);
  assert.ok(missions.some((m) => m.kind === 'sound'), '소리 부탁이 든 판(씨앗 7)');
  assert.equal(qs.length, 3);

  // 부른 차례 — 약한 낱말(due · summary) 뒤 부탁 · 인화. recommend · live는 부르지 않는다(부탁 차례는 게임). 이 코치에는 startSet이 없어
  // (지금 엔진) begin이 아무것도 부르지 않고 판은 첫 제시가 연다.
  const want = ['due', 'summary'];
  missions.forEach((m, i) => {
    want.push('present');
    if (m.kind === 'sound') want.push('delivery');
    for (let w = 1; w <= ([2, 1][i] ?? 0); w += 1) want.push('answer', ...(helpLevel(w) !== 'point' ? ['help'] : []));
    want.push('answer');
  });
  for (let i = 0; i < qs.length; i += 1) want.push('present', 'answer');
  want.push('finishSet');
  assert.deepEqual(names(spy), want);
  assert.deepEqual(spy.calls.at(-1).slice(0, 2), ['finishSet', [{ record: false }]], '판 끝 — 판을 기록 없이 닫는다');

  const rows = await events(coach, port);
  const shown = rows.filter((e) => e.type === 'practice.presented');
  assert.deepEqual(shown.map((e) => e.itemKey), [...missions.map((m) => missionMetadata(m).itemKey), ...qs.map((q) => recallMetadata(q).itemKey)]);
  assert.equal(new Set(shown.map((e) => e.setId)).size, 1, '장소 한 판이 판 하나');
  for (const e of shown) assert.equal(e.arm, 'host', `게임 차례: ${e.itemKey}`);
  missions.forEach((m, i) => {
    const e = shown[i];
    const kids = rows.filter((x) => x.presentationId === e.id);
    const misses = [2, 1][i] ?? 0;
    const wantKids = [...(m.kind === 'sound' ? ['practice.delivery'] : [])];
    for (let w = 1; w <= misses; w += 1) wantKids.push('practice.attempted', ...(helpLevel(w) !== 'point' ? ['practice.helped'] : []));
    wantKids.push('practice.attempted');
    assert.deepEqual(kids.map((x) => x.type), wantKids, m.word);
    const tries = kids.filter((x) => x.type === 'practice.attempted');
    assert.deepEqual(tries.map((x) => [x.attemptNo, x.verdict]), [...Array.from({ length: misses }, (_, w) => [w + 1, 'incorrect']), [misses + 1, 'correct']], `맞힐 때까지 같은 제시: ${m.word}`);
    for (const x of tries) assert.equal(x.choice.correctId, m.word);
    if (m.kind === 'sound') assert.equal(kids[0].audio, 'completed');
  });
  qs.forEach((q, i) => {
    const tries = rows.filter((x) => x.presentationId === shown[missions.length + i].id && x.type === 'practice.attempted');
    assert.deepEqual(tries.map((x) => [x.attemptNo, x.verdict]), [[1, i === 1 ? 'incorrect' : 'correct']], q.answer);
  });
  door.dispose();
});

test('정해진 차례 판 — 첫 부탁의 제시 전에 판 길이(부탁 수 + 인화 상한)를 문을 거쳐 startSet으로 한 번 넘기고, 판을 닫고 다음 판을 열 때 다시 넘긴다', async () => {
  const { learn, coach, port, spy, clock, door } = await opened({ startSet: true });
  const rounds = [playRound(learn, clock, { seed: 7, wrongs: [1] }), playRound(learn, clock, { place: PLACES.union, seed: 5 })];
  // 입구로 나가기로 닫은 판 뒤, 그리고 그다음 판에도 다시 넘긴다.
  const m = { kind: 'meaning', group: 'blade', word: 'bank', tries: 0 };
  learn.begin([m]); learn.present(m); clock.advance(); learn.leave();
  const n = { kind: 'word', group: null, word: 'cat', tries: 0 };
  learn.begin([n]); learn.present(n); clock.advance(); learn.end();

  assert.deepEqual(rounds.map(({ missions }) => roundLength(missions)), [4 + RECALL_PER_ROUND, 4 + RECALL_PER_ROUND], '부탁 넷 + 인화 상한 셋');
  const flow = spy.calls.filter(([name]) => ['startSet', 'present', 'finishSet'].includes(name)).map(([name, args]) => (name === 'present' ? name : [name, ...args]));
  const want = [];
  for (const { missions, qs } of rounds) want.push(['startSet', { length: missions.length + RECALL_PER_ROUND }], ...Array(missions.length + qs.length).fill('present'), ['finishSet', { record: false }]);
  for (let i = 0; i < 2; i += 1) want.push(['startSet', { length: 1 + RECALL_PER_ROUND }], 'present', ['finishSet', { record: false }]);
  assert.deepEqual(flow, want, '판마다 startSet 한 번 — 그 판의 첫 제시보다 먼저, 앞 판을 닫은 뒤');
  const named = names(spy);
  assert.deepEqual(named.slice(0, 4), ['due', 'summary', 'startSet', 'present'], '약한 낱말을 고른 뒤 첫 부탁 바로 앞');
  for (const row of spy.calls.filter(([name]) => name === 'startSet')) assert.ok(row[2]?.setId, '겉을 거쳐 연 판을 받는다');

  const shown = (await events(coach, port)).filter((e) => e.type === 'practice.presented');
  const sets = [...new Set(shown.map((e) => e.setId))];
  assert.deepEqual(sets.map((id) => shown.filter((e) => e.setId === id).length), [...rounds.map(({ missions, qs }) => missions.length + qs.length), 1, 1], '판마다 판 하나');
  door.dispose();
});

test('begin — startSet이 연 판은 낸 제시가 없어도 닫고, 닫지 않은 앞 판은 먼저 닫는다. startSet이 없거나 거절해도 놀이는 그대로 돈다', () => {
  const calls = [];
  let fail = null;
  const base = {
    itemUnits: (key) => (key.includes('.exit.') ? [] : [{ unit: 'u' }]),
    present: (meta) => { calls.push(['present', meta.itemKey]); return `p${calls.length}`; },
    answer: () => ({}),
    finishSet: (options) => { calls.push(['finishSet', options]); },
  };
  const startSet = (options) => { calls.push(['startSet', options]); if (fail) throw { code: fail }; return { opened: true, setId: 's1' }; };
  const bank = { kind: 'meaning', word: 'bank' }, post = { kind: 'meaning', word: 'post' }, off = { kind: 'meaning', word: 'exit' };
  const shape = (rows) => rows.map(([name, x]) => (name === 'present' ? name : [name, x]));
  const learn = createNextLearning({ ...base, startSet }, { win: null });
  learn.begin([off]); learn.present(off); learn.end();
  assert.deepEqual(calls.splice(0), [['startSet', { length: 1 + RECALL_PER_ROUND }], ['finishSet', { record: false }]], '은행에 없는 부탁뿐이라 낸 제시가 없어도 startSet이 연 판은 닫는다');
  learn.begin([bank, post]); learn.present(bank);
  learn.begin([post]); learn.present(post); learn.end();
  assert.deepEqual(shape(calls.splice(0)), [['startSet', { length: 5 }], 'present', ['finishSet', { record: false }], ['startSet', { length: 4 }], 'present', ['finishSet', { record: false }]], '닫지 않은 앞 판은 먼저 닫는다');
  for (const code of ['RUN_ENDED', 'STORE_BUSY']) {
    fail = code;
    learn.begin([bank]); learn.present(bank); learn.answer(bank, { correct: true, selected: 'bank' }); learn.end();
    assert.deepEqual(calls.splice(0).map(([name]) => name), ['startSet', 'present', 'finishSet'], `${code} — 판은 첫 제시가 열고 놀이는 잇는다`);
  }
  assert.equal(learn.available(), true);
  // startSet이 없는 코치(지금 엔진) — begin은 아무것도 부르지 않는다.
  const plain = createNextLearning(base, { win: null });
  plain.begin([bank]);
  assert.deepEqual(calls, []);
  plain.present(bank); plain.end();
  assert.deepEqual(calls.map(([name]) => name), ['present', 'finishSet']);
});

test('같은 제시의 뒤 답 — 둘째 답은 기록되고, 두뇌 판 상태는 첫 판정 답만 움직인다(놓친 단위가 이 판에서 다른 문항으로 돌아온다)', async () => {
  const cands = ['sound.library', 'recall-meaning.library', 'meaning.dorm', 'meaning.bank', 'meaning.post', 'meaning.office', 'sound.dorm', 'meaning.cafeteria']
    .map((key) => itemMetadata(...key.split('.')));
  const library = 'ko.word.w0600';
  async function after(misses) {
    const { learn, coach, port, clock } = await opened();
    const m = { kind: 'meaning', group: 'blade', word: 'library', tries: 0 };
    learn.present(m); clock.advance();
    for (let w = 0; w < misses; w += 1) { learn.answer(m, { correct: false, selected: 'bank', attemptNo: w + 1 }); clock.advance(); }
    learn.answer(m, { correct: true, selected: 'library', attemptNo: misses + 1 }); clock.advance();
    // 같은 판(첫 제시가 연 판)에서 다음 문항 몇을 코치에 묻는다 — 게임 밖의 탐침.
    const picks = [];
    for (let i = 0; i < 4; i += 1) {
      const r = coach.recommend(cands);
      if (r.status !== 'ready') break;
      picks.push({ units: coach.itemUnits(r.selected.itemKey).map((u) => u.unit), code: r.why?.code });
      const pid = coach.present(r.selected); clock.advance();
      coach.answer(pid, { correct: true, assessable: true }); clock.advance();
    }
    const tries = (await events(coach, port)).filter((e) => e.type === 'practice.attempted' && e.presentationId === m.pid);
    return { picks, tries };
  }
  const missed = await after(1);
  assert.deepEqual(missed.tries.map((e) => [e.attemptNo, e.verdict]), [[1, 'incorrect'], [2, 'correct']], '뒤 답도 기록된다');
  const back = missed.picks.find((p) => p.units.includes(library));
  assert.ok(back, '놓친 단위가 돌아온다 — 뒤 답(맞음)이 「다시」를 풀지 않았다');
  assert.equal(back.code, 'unit.retry');
  const right = await after(0);
  assert.ok(!right.picks.some((p) => p.code === 'unit.retry'), '첫 답에 맞히면 다시 오지 않는다(탐침이 가른다)');
});

test('나가기 — 답하지 않은 부탁은 다음 차례 번호로 unanswered 답하고 판을 닫는다', async () => {
  const { learn, coach, port, spy, clock } = await opened();
  const m = { kind: 'meaning', group: 'blade', word: 'bank', tries: 0 };
  learn.present(m); clock.advance();
  learn.answer(m, { correct: false, selected: 'post', attemptNo: 1 }); clock.advance();
  learn.leave();
  assert.deepEqual(spy.calls.slice(-2).map(([name, args]) => [name, args]), [
    ['answer', [m.pid, { correct: null, assessable: false, reason: 'unanswered', attemptNo: 2 }]],
    ['finishSet', [{ record: false }]],
  ]);
  const count = spy.calls.length;
  learn.leave(); learn.end();
  assert.equal(spy.calls.length, count, '닫은 판은 다시 닫지 않는다');
  // 답하기 전에 나가면 첫 차례로.
  const n = { kind: 'word', group: null, word: 'cat', tries: 0 };
  learn.present(n); clock.advance();
  learn.leave();
  assert.deepEqual(spy.calls.slice(-2)[0][1], [n.pid, { correct: null, assessable: false, reason: 'unanswered', attemptNo: 1 }]);
  const rows = await events(coach, port);
  const left = rows.filter((e) => e.type === 'practice.attempted' && e.presentationId === m.pid);
  assert.deepEqual(left.map((e) => [e.attemptNo, e.verdict, e.reason ?? null]), [[1, 'incorrect', null], [2, 'unassessed', 'unanswered']]);
});

test('약한 낱말 — 기억이 없으면 없고, 돌아온 단위(떠올릴 확률이 낮은 것부터) · 끈질긴 단위의 낱말이며, 그 장소의 부탁 낱말만', async () => {
  const sitting = (learn, clock, word, misses) => {
    const m = { kind: 'meaning', group: 'blade', word, tries: 0 };
    learn.present(m); clock.advance();
    for (let w = 0; w < misses; w += 1) { learn.answer(m, { correct: false, selected: 'x', attemptNo: w + 1 }); clock.advance(); }
    learn.answer(m, { correct: true, selected: word, attemptNo: misses + 1 }); clock.advance();
    learn.end();
  };
  {
    const { learn, coach, clock } = await opened();
    assert.deepEqual(learn.weak(PLACES.gate), [], '빈 기억 손님 — 앨범 차례대로 고른다');
    for (const word of ['library', 'dorm', 'bank', 'post']) sitting(learn, clock, word, word === 'library' ? 1 : 0);
    clock.advance(DAY);
    assert.deepEqual(coach.due().map((u) => u.unit), ['ko.word.w0600'], '하루 뒤에는 놓친 도서관만 돌아왔다');
    assert.deepEqual(learn.weak(PLACES.gate), ['library']);
    assert.deepEqual(learn.weak(PLACES.union), [], '학생회관에는 도서관 부탁이 없다');
    clock.advance(DAY);
    const weak = learn.weak(PLACES.gate);
    assert.equal(weak.length, 2);
    assert.equal(weak[0], 'library', '떠올릴 확률이 가장 낮은 돌아온 단위가 먼저');
    const missions = pickMissions(PLACES.gate, { weak, rng: makeRng(3) });
    assert.ok(missions.some((m) => m.word === 'library'), '약한 낱말이 부탁 정답으로 먼저 나온다');
    assert.ok(learn.weak(PLACES.union).every((w) => ['bank', 'post'].includes(w)));
  }
  {
    // 끈질긴 단위: 자리마다(8시간 간격) 맞음 · 놓침 셋 · 맞음 — 마지막에 맞혀 돌아오지 않았어도 약한 낱말이다.
    const { learn, coach, clock } = await opened();
    [0, 1, 1, 1, 0].forEach((misses, i) => { if (i) clock.advance(8 * HOUR); sitting(learn, clock, 'bank', misses); });
    const line = coach.summary().units.find((u) => u.unit === 'ko.word.w0039');
    assert.equal(line.stubborn, true);
    assert.deepEqual(coach.due(), [], '돌아온 단위는 없다');
    assert.deepEqual(learn.weak(PLACES.gate), ['bank']);
  }
  {
    // 고르는 데 쓰는 것은 due · summary · itemUnits뿐이다(옛 추천 · 순간 맞춤 없음).
    const { learn, spy } = await opened();
    learn.weak(PLACES.gate);
    assert.deepEqual(new Set(names(spy, { units: true })), new Set(['due', 'summary']), '기억이 없으면 단위를 묻지 않는다');
  }
});

test('같은 날 넷째 게임(다른 게임이 하루 새것 한도를 다 씀) — 부탁 · 인화는 게임 차례라 판 끝까지 기록한다', async () => {
  const clock = clockAt();
  const port = atlas.memoryPort(), key = `synk-atlas:snap-words-none-${process.pid}`;
  const { coach: other } = await realCoach({ clock, port, key, gameId: 'talk-rally' });
  const col = (name) => INDEX.fields.indexOf(name);
  const snapUnits = new Set(INDEX.items.filter((r) => r[col('bank')] === GAME_ID).flatMap((r) => r[col('units')]));
  const rows = INDEX.items.filter((r) => r[col('bank')] === 'talk-rally' && r[col('units')].length && r[col('units')].every((u) => !snapUnits.has(u)));
  const introduced = new Set();
  for (const r of rows) {
    if (introduced.size >= 24) break;
    const pid = other.present({ itemKey: r[col('itemKey')] }); clock.advance();
    other.answer(pid, { correct: true, assessable: true }); clock.advance();
    for (const u of r[col('units')]) introduced.add(u);
  }
  await other.finishSet({ record: false }).folded;
  const probe = other.recommend(INDEX.items.filter((r) => r[col('bank')] === GAME_ID).map((r) => ({ itemKey: r[col('itemKey')] })));
  assert.equal(probe.status, 'none', '하루 한도 — 엔진이라면 낼 새 문항이 없다');

  const { learn, coach, spy } = await opened({ clock, port, key });
  const { missions, qs } = playRound(learn, clock, { seed: 11 });
  assert.ok(!names(spy).includes('recommend'));
  const shown = (await events(coach, port)).filter((e) => e.type === 'practice.presented' && e.itemKey.startsWith(`${GAME_ID}.`));
  assert.deepEqual(shown.map((e) => e.itemKey), [...missions.map((m) => missionMetadata(m).itemKey), ...qs.map((q) => recallMetadata(q).itemKey)], '판 끝까지 기록한다');
  for (const e of shown) {
    assert.equal(e.arm, 'host', e.itemKey);
    assert.equal(e.reason.code, 'host.order', e.itemKey);
  }
});

test('판을 다시 정하면 그 판은 기록 없이 잇고, 다음 판에서 문을 다시 연다 — 새 겉이면 다시 기록, 지금 판이면 옛 길', async () => {
  const { learn, spy, entry, clock, frame, shell } = await opened();
  const m = { kind: 'meaning', group: 'blade', word: 'post', tries: 0 };
  learn.present(m); clock.advance();
  entry.retire(spy);
  assert.equal(learn.retired, true);
  assert.equal(learn.available(), false);
  const count = spy.calls.length;
  learn.answer(m, { correct: false, selected: 'bank', attemptNo: 1 }); learn.helped(m); learn.answer(m, { correct: true, selected: 'post', attemptNo: 2 });
  learn.recall({ mode: 'meaning', answer: 'post', options: ['post'] }, 'post');
  learn.weak(PLACES.gate); learn.leave(); learn.end();
  frame.leave(); shell.run();
  assert.equal(spy.calls.length, count, '닫힌 겉에는 더 부르지 않는다 — 게임은 기록 없이 잇는다');

  const renewed = await learn.renew();
  assert.notEqual(renewed, learn);
  assert.equal(entry.asked.length, 2, '다음 판에서 문을 다시 연다');
  playRound(renewed, clock, { seed: 5 });
  const after = spy.calls.slice(count);
  assert.ok(after.some(([name]) => name === 'present') && after.at(-1)[0] === 'finishSet', 'retire 뒤 다음 판도 다시 기록된다');

  // 지금 판으로 정해지면 다시 연 문이 null — 옛 길로 간다.
  let gave = false;
  const now = await opened({ give: (made) => { if (gave) return null; gave = true; return made; } });
  assert.equal(now.olds(), 0);
  now.entry.retire(now.spy);
  assert.equal(await now.learn.renew(), 'old-coach');
  assert.equal(now.olds(), 1);
});

test('문의 open이 null이면 옛 길(old()), RUN_ENDED · 그 밖의 거절이면 옛 길을 열지 않고 기록 없이 논다', async () => {
  const run = async (open) => {
    let olds = 0;
    const frame = { parent: { SYNKAtlasGame: { open } }, location: { hostname: 'synk.im', search: '' }, addEventListener() {} };
    frame.top = frame.parent;
    const learn = await openLearning({ win: frame, old: () => { olds += 1; return 'old-coach'; } });
    return { learn, olds };
  };
  assert.deepEqual(await run(async () => null), { learn: 'old-coach', olds: 1 });
  // 셸 창의 오류 — 틀에서 instanceof Error가 거짓이다(코드만 있는 객체).
  const stopped = await run(async () => { throw { code: 'RUN_ENDED' }; });
  assert.equal(stopped.olds, 0, '닫히는 틀이 옛 학습 호스트를 열지 않는다');
  assert.equal(stopped.learn.available(), false);
  const m = { kind: 'meaning', word: 'bank' };
  stopped.learn.present(m); stopped.learn.answer(m, { correct: true, selected: 'bank', attemptNo: 1 }); stopped.learn.leave();
  assert.deepEqual(stopped.learn.weak(PLACES.gate), []);
  const errors = [];
  const error = console.error;
  console.error = (e) => errors.push(e);
  try {
    const broken = await run(async () => { throw { code: 'MAP_FAILED' }; });
    assert.equal(broken.olds, 0, '새 길이 맡은 판 — 실패해도 옛 길을 열지 않는다');
    assert.equal(broken.learn.available(), false);
  } finally {
    console.error = error;
  }
  assert.equal(errors.length, 1);
});

test('오류는 code로만 가른다 — RUN_ENDED면 그 겉을 더 부르지 않고, 다른 오류는 그 부르기만 버린다(차례 번호는 기록된 답만 센다)', () => {
  const calls = [];
  let fail = null;
  const fake = {
    itemUnits: () => [{ unit: 'u' }],
    present: () => { calls.push('present'); if (fail === 'present') throw { code: 'ATTEMPT_UNSAVED' }; return `p${calls.length}`; },
    delivery: () => { calls.push('delivery'); return {}; },
    help: () => { calls.push('help'); return {}; },
    answer: (pid, answer) => { calls.push(['answer', answer.attemptNo]); if (fail === 'answer') { fail = null; throw { code: 'STORE_BUSY' }; } if (fail === 'ended') throw { code: 'RUN_ENDED' }; return { verdict: 'x' }; },
    due: () => { throw { code: 'NOT_READY' }; },
    summary: () => ({ units: [] }),
    finishSet: () => { calls.push('finishSet'); },
  };
  const learn = createNextLearning(fake, { win: null });
  assert.deepEqual(learn.weak(PLACES.gate), [], '고르기가 거절돼도 앨범 차례로 논다');
  fail = 'present';
  const a = { kind: 'meaning', word: 'bank' };
  learn.present(a);
  assert.equal(a.pid, null);
  learn.answer(a, { correct: true, selected: 'bank' });
  assert.ok(!calls.some((c) => c[0] === 'answer'), '제시가 없으면 답하지 않는다');
  fail = 'answer';
  const b = { kind: 'meaning', word: 'post' };
  learn.present(b);
  learn.answer(b, { correct: false, selected: 'bank' }); // 저장되지 못한 답 — 차례를 세지 않는다
  learn.answer(b, { correct: false, selected: 'bank' });
  learn.answer(b, { correct: true, selected: 'post' });
  assert.deepEqual(calls.filter((c) => c[0] === 'answer').map((c) => c[1]), [1, 1, 2]);
  fail = 'ended';
  const c = { kind: 'meaning', word: 'dorm' };
  learn.present(c);
  learn.answer(c, { correct: true, selected: 'dorm' });
  assert.equal(learn.available(), false);
  const before = calls.length;
  const d = { kind: 'meaning', word: 'office' };
  learn.present(d); learn.heard(d); learn.helped(d); learn.recall({ mode: 'meaning', answer: 'office' }, 'office'); learn.leave(); learn.end();
  assert.equal(d.pid, null);
  assert.equal(calls.length, before, 'RUN_ENDED 뒤에는 그 겉을 부르지 않는다');
});

test('은행에 없는 문항은 내지 않는다(태그 없는 문항으로 새 단위를 세지 않게)', () => {
  const calls = [];
  const fake = {
    itemUnits: (key) => (key.includes('.bank.') ? [{ unit: 'ko.word.w0039' }] : []),
    present: (meta) => { calls.push(meta.itemKey); return 'p1'; },
    answer: () => ({}),
    finishSet: () => { calls.push('finishSet'); },
  };
  const learn = createNextLearning(fake, { win: null });
  const off = { kind: 'meaning', word: 'exit' };
  learn.present(off);
  assert.equal(off.pid, null);
  learn.recall({ mode: 'meaning', answer: 'exit' }, 'exit');
  learn.end();
  assert.deepEqual(calls, [], '낸 것이 없으면 판도 닫지 않는다');
  const on = { kind: 'meaning', word: 'bank' };
  learn.present(on);
  learn.end();
  assert.deepEqual(calls, ['snap-words.meaning.bank.v1', 'finishSet']);
});
