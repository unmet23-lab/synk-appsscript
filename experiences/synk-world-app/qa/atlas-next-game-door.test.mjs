// 게임 문(4-6c — 단계4_계획 §23-2 · §23-10 「문」): 셸이 게임 코치를 열어 틀에 겉으로 넘긴다. 가짜 입구 · 가짜 코치로 문의 규칙을 본다 —
// 다른 게임 · 표에 없는 은행 거절, 지금 판이면 null, 패널 닫힘 · 틀 다시 싣기로 취소된 open은 RUN_ENDED, 닫힌 겉 · 손잡이는 RUN_ENDED,
// 판을 다시 정하면 onRetired 뒤 닫힘, 패널을 닫으면 finishSet({ record: false }) 한 번, 인수는 셸 창 사본, 옮기지 못하는 인수는
// DOOR_ARGUMENT, 떠나는 틀의 마지막 답이 겉 닫기보다 먼저(셸 창의 다음 차례), 키트가 고른 후보를 원래 객체로 되맞춤.
import assert from 'node:assert/strict';
import test from 'node:test';
import { answerOf, openNext, setPlay } from '../../play-common/kit/atlas-next.mjs';
import { createGameDoor, GAME_BANKS } from '../world-atlas-game.mjs';

function fakeCoach() {
  const calls = [];
  const coach = {
    calls,
    recommend(candidates, options) {
      calls.push(['recommend', candidates, options]);
      return candidates.length
        ? { status: 'ready', selected: candidates[0], alternatives: candidates.slice(1), why: { line: '이유' } }
        : { status: 'none', selected: null };
    },
    present(item) {
      calls.push(['present', item]);
      return `p-${calls.length}`;
    },
    answer(pid, result) {
      calls.push(['answer', pid, result]);
      return { verdict: result.correct ? 'correct' : 'incorrect' };
    },
    startSet(options) {
      calls.push(['startSet', options]);
      return { opened: true, setId: 's-1' };
    },
    finishSet(options) {
      calls.push(['finishSet', options]);
    },
    live(input) {
      calls.push(['live', input]);
      return {
        spec: { id: input.id },
        pick: (candidates, options) => coach.recommend(candidates, options),
        answer: (pid, result) => coach.answer(pid, result),
        observe: () => ({ change: null }),
        settings: () => ({}),
      };
    },
    today: () => null,
    presentation: () => null,
  };
  return coach;
}

function fakeEntry({ coach = fakeCoach(), give = () => coach } = {}) {
  const retirers = new Map();
  return {
    coach,
    asked: [],
    async gameCoach(gameId, banks) {
      this.asked.push([gameId, banks]);
      return give();
    },
    retired(made, fn) {
      retirers.set(made, fn);
      return () => retirers.delete(made);
    },
    retire(made, reason = 'account') {
      retirers.get(made)?.({ reason });
    },
  };
}

const tasks = () => {
  const queue = [];
  return { later: fn => queue.push(fn), run: () => queue.splice(0).forEach(fn => fn()), queue };
};

test('문은 그 게임 하나와 표의 은행만 받고, 지금 판이면 null이다', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'order-rush' });
  await assert.rejects(door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] }), { code: 'DOOR_GAME' });
  await assert.rejects(door.api.open({ gameId: 'order-rush', banks: ['talk-rally'] }), { code: 'DOOR_BANK' });
  await assert.rejects(door.api.open({ gameId: 'order-rush', banks: [] }), { code: 'DOOR_BANK' });
  const facade = await door.api.open({ gameId: 'order-rush', banks: ['order-rush-beginner', 'order-rush'] });
  assert.ok(facade);
  assert.deepEqual(entry.asked.at(-1), ['order-rush', ['order-rush', 'order-rush-beginner']]);
  const old = createGameDoor({ entry: fakeEntry({ give: () => null }), gameId: 'talk-rally' });
  assert.equal(await old.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] }), null);
  assert.deepEqual(Object.keys(GAME_BANKS).sort().length, 11);
});

test('패널이 닫히면 기다리던 open은 null이 아니라 RUN_ENDED로 거절하고, 받은 코치의 판을 닫는다(카본 다시 검토 A2)', async () => {
  let release;
  const coach = fakeCoach();
  const entry = fakeEntry({ coach, give: () => new Promise(resolve => (release = () => resolve(coach))) });
  const door = createGameDoor({ entry, gameId: 'talk-rally' });
  const opening = door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  door.dispose();
  release();
  await assert.rejects(opening, { code: 'RUN_ENDED' });
  assert.deepEqual(coach.calls.filter(([name]) => name === 'finishSet'), [['finishSet', { record: false }]]);
  await assert.rejects(door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] }), { code: 'RUN_ENDED' });
});

test('패널을 닫으면 겉이 닫히고 판을 한 번 닫는다 — 닫힌 겉과 손잡이는 RUN_ENDED, 오류는 code로 가른다', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'talk-rally' });
  const facade = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  const live = facade.live({ id: 'rally' });
  const pid = facade.present({ itemKey: 'a' });
  facade.answer(pid, { correct: true, assessable: true });
  door.dispose();
  const finished = entry.coach.calls.filter(([name]) => name === 'finishSet');
  assert.deepEqual(finished, [['finishSet', { record: false }]]);
  const names = entry.coach.calls.map(([name]) => name);
  assert.ok(names.indexOf('answer') < names.indexOf('finishSet'), '판 닫기는 그 답 뒤');
  assert.throws(() => facade.recommend([]), { code: 'RUN_ENDED' });
  assert.throws(() => live.answer(pid, { correct: true }), { code: 'RUN_ENDED' });
  assert.equal(facade.closed, true);
});

test('같은 패널의 다시 open은 앞 겉을 닫고 그 판을 닫은 뒤 새 겉을 준다 — 앞 문서의 늦은 open은 RUN_ENDED(GPT GA6)', async () => {
  const coach = fakeCoach();
  let slow;
  let first = true;
  const entry = fakeEntry({
    coach,
    give: () => {
      if (!first) return coach;
      first = false;
      return new Promise(resolve => (slow = () => resolve(coach)));
    },
  });
  const door = createGameDoor({ entry, gameId: 'talk-rally' });
  const late = door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  const fresh = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  slow();
  await assert.rejects(late, { code: 'RUN_ENDED' });
  assert.equal(coach.calls.filter(([name]) => name === 'finishSet').length, 0, '새 문서가 받은 같은 코치의 판은 건드리지 않는다');
  const again = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  assert.throws(() => fresh.present({ itemKey: 'a' }), { code: 'RUN_ENDED' });
  assert.equal(coach.calls.filter(([name]) => name === 'finishSet').length, 1, '앞 겉의 판을 한 번 닫는다');
  assert.ok(again.present({ itemKey: 'b' }));
});

test('판을 다시 정하면 틀에 onRetired로 알리고 겉을 닫는다 — 다음 판은 open을 다시 부른다', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'talk-rally' });
  const facade = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  const heard = [];
  facade.onRetired(detail => heard.push(detail.reason));
  entry.retire(entry.coach, 'account');
  assert.deepEqual(heard, ['account']);
  assert.throws(() => facade.present({ itemKey: 'a' }), { code: 'RUN_ENDED' });
  const next = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  assert.ok(next.present({ itemKey: 'a' }));
});

test('인수는 셸 창의 사본으로 옮기고, 옮기지 못하는 인수는 DOOR_ARGUMENT다(설계 주인 조건 ③)', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'talk-rally' });
  const facade = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  const item = { itemKey: 'a', meta: { n: 1 } };
  facade.present(item);
  const given = entry.coach.calls.find(([name]) => name === 'present')[1];
  assert.deepEqual(given, item);
  assert.notEqual(given, item, '틀의 객체를 셸 코치가 들지 않는다');
  assert.throws(() => facade.present({ itemKey: 'a', onPick() {} }), { code: 'DOOR_ARGUMENT' });
});

test('판 열기 startSet도 겉으로 넘기고(인수는 사본), 키트 setPlay.open()은 판 길이가 있을 때만 부른다 — 닫힌 겉이면 null', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'story-classroom' });
  const facade = await door.api.open({ gameId: 'story-classroom', banks: ['story-classroom'] });
  assert.equal(typeof facade.startSet, 'function');
  const set = setPlay(facade, { length: 9 });
  assert.deepEqual(set.open(), { opened: true, setId: 's-1' });
  assert.deepEqual(
    entry.coach.calls.filter(([name]) => name === 'startSet'),
    [['startSet', { length: 9 }]],
  );
  assert.equal(setPlay(facade).open(), null, '길이를 모르는 판은 startSet을 부르지 않는다');
  assert.equal(entry.coach.calls.filter(([name]) => name === 'startSet').length, 1);
  door.dispose();
  assert.throws(() => facade.startSet({ length: 9 }), { code: 'RUN_ENDED' });
  assert.equal(set.open(), null);
  const { startSet, ...older } = fakeCoach();
  assert.equal(setPlay(older, { length: 3 }).open(), null, 'startSet이 없는 앞 판 입구의 코치');
});

test('떠나는 틀의 마지막 답이 겉 닫기보다 먼저 들어간다 — 닫기는 셸 창의 다음 차례(Fable 5.2 다시 검토 F1)', async () => {
  const entry = fakeEntry();
  const clock = tasks();
  const door = createGameDoor({ entry, gameId: 'subway-rush', later: clock.later });
  const facade = await door.api.open({ gameId: 'subway-rush', banks: ['subway-rush'] });
  const pid = facade.present({ itemKey: 'a' });
  // 같은 pagehide 안: 키트가 먼저 건 leave, 그다음 게임의 떠날 때 답.
  facade.leave();
  facade.answer(pid, { correct: null, assessable: false, reason: 'unanswered' });
  clock.run();
  const names = entry.coach.calls.map(([name]) => name);
  assert.deepEqual(names.slice(-2), ['answer', 'finishSet']);
  assert.throws(() => facade.present({ itemKey: 'b' }), { code: 'RUN_ENDED' });
});

test('키트 — 문의 겉으로 열고, 고른 후보를 게임이 넘긴 원래 객체로 되맞춘다(Fable 5.2 다시 검토 F2)', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'order-rush' });
  const listeners = [];
  const top = { SYNKAtlasGame: door.api };
  const frame = { parent: top, top, addEventListener: (...args) => listeners.push(args) };
  const next = await openNext({ win: frame, gameId: 'order-rush', banks: ['order-rush'] });
  const orders = [{ itemKey: 'o1', serve: () => 'x' }, { itemKey: 'o2', serve: () => 'y' }].map(order => ({
    ...order,
  }));
  // 함수가 든 후보는 문을 지나지 못한다 — 키트에 넘기는 후보는 자료만, 고른 것은 원래 객체로 돌아온다.
  const plain = orders.map(({ itemKey }) => ({ itemKey }));
  const picked = next.recommend(plain, { set: { length: 8 } });
  assert.equal(picked.selected, plain[0]);
  assert.equal(picked.alternatives[0], plain[1]);
  assert.equal(listeners[0][0], 'pagehide', '틀이 떠날 때 셸에 알린다');
  const set = setPlay(next, { length: 8 });
  assert.equal(set.next(plain).item, plain[0]);
  // idle(「다시」를 기다리는 사이의 채우기)도 엔진이 고른 문항이다 — 게임 차례로 넘기지 않는다(4-6d 환승 · 랠리 보고).
  const idleCoach = { recommend: candidates => ({ status: 'idle', selected: candidates[1], why: { code: 'idle' } }) };
  assert.deepEqual(setPlay(idleCoach).next(plain, () => assert.fail('게임 차례가 아니다')), {
    item: plain[1],
    why: { code: 'idle' },
    engine: true,
    idle: true,
  });
  // 이번 고르기에만 더하는 옵션(소리를 끈 사람)과 판 옵션이 함께 간다.
  const seen = [];
  setPlay({ recommend: (_c, o) => (seen.push(o), { status: 'none' }) }, { options: { pool: 'unseen' } }).next(plain, () => null, { audio: false });
  assert.deepEqual(seen[0], { pool: 'unseen', audio: false, set: {} });
  const none = set.next([], () => ({ itemKey: 'game-turn' }));
  assert.deepEqual(none, { item: { itemKey: 'game-turn' }, why: null, engine: false }, 'none이어도 게임 차례로 이어 간다');
  assert.deepEqual(entry.coach.calls.find(([name]) => name === 'recommend')[2], { set: { length: 8 } });
  assert.deepEqual(
    entry.coach.calls.filter(([name]) => name === 'recommend').at(-1)[2],
    { set: { length: 8, newLimit: 24 } },
    '판 길이가 정해진 판은 새것 한도 3n',
  );
  door.dispose();
  set.end(); // 닫힌 겉의 판 끝은 조용히 지나간다
});

test('키트 — 문이 없고 개발 깃발도 없으면 null(옛 길), 옛 답 꼴을 새 꼴로 옮긴다', async () => {
  assert.equal(await openNext({ win: { parent: null, top: null, location: { hostname: 'synk.im', search: '' } }, gameId: 'x', banks: ['x'] }), null);
  assert.deepEqual(answerOf({ correct: true }), { correct: true, assessable: true });
  assert.deepEqual(answerOf({ correct: null, reason: 'skip' }), { correct: null, assessable: true });
  assert.deepEqual(answerOf({ correct: false, reason: 'audio' }), { correct: null, assessable: false, reason: 'audio' });
  assert.deepEqual(answerOf({ correct: false, attemptNo: 2, choice: { selectedId: 'a', correctId: 'b' } }), {
    correct: false,
    assessable: true,
    attemptNo: 2,
    choice: { selectedId: 'a', correctId: 'b' },
  });
});

test('셸의 내용 기억 열쇠 앞마디는 엔진의 것과 같고, 읽개는 옛 기기 열쇠를 그 하루 안에서만 읽는다', async () => {
  const { FLOW_MEMORY_PREFIX, gamePrefs } = await import('../world-atlas-game.mjs');
  // 입구의 앞 판 쓸기가 지우는 열쇠는 엔진 내용 기억의 열쇠와 같아야 한다.
  const engine = await import('../../../packages/atlas/src/coach/flow-memory.mjs');
  assert.equal(FLOW_MEMORY_PREFIX, engine.FLOW_MEMORY_PREFIX);
  const map = new Map([
    ['synk.atlas.learning.v1.device.today', JSON.stringify({ day: '2026-11-19', condition: 'tired' })],
    ['synk.atlas.learning.v1.device.flow', JSON.stringify({ v: 1, contents: { a: {} }, declined: {} })],
  ]);
  const storage = { getItem: name => map.get(name) ?? null };
  const same = gamePrefs({ storage, presentation: () => ({}), now: () => new Date(2026, 10, 19, 9) });
  assert.equal(same.today(), 'tired');
  assert.equal(same.presentation(), null, '고른 것이 없으면 null');
  assert.deepEqual(Object.keys(same.seed().contents), ['a']);
  const next = gamePrefs({ storage, presentation: () => ({ support: 'step' }), now: () => new Date(2026, 10, 20, 9) });
  assert.equal(next.today(), null, '다음 날에는 어제 컨디션을 읽지 않는다');
  assert.deepEqual(next.presentation(), { support: 'step' });
});

test('셸 원문 — 문은 새 길 입구가 있을 때만 틀보다 먼저 서고, 패널이 닫히면 치운다(꺼진 판에는 문이 없다)', async () => {
  const { readFileSync } = await import('node:fs');
  const shell = readFileSync(new URL('../app-shell.mjs', import.meta.url), 'utf8');
  const start = shell.indexOf('async function launchGame(');
  const body = shell.slice(start, shell.indexOf('\n}\n', start));
  const sets = [...body.matchAll(/window\.SYNKAtlasGame=(?!=)/g)];
  assert.equal(sets.length, 1, '문을 두는 자리는 하나');
  const guard = body.indexOf('if(life.atlasNext?.gameDoor){');
  assert.ok(guard >= 0 && guard < sets[0].index, '입구가 있을 때만 문을 둔다');
  assert.ok(sets[0].index < body.indexOf('class="game-frame"'), '틀보다 먼저 둔다');
  assert.match(body, /attachPanelResource\(\{dispose:\(\)=>\{closeDoor\(gameDoor\);/, '패널이 닫히면 문을 치운다');
  assert.match(body, /const closeDoor=door=>\{if\(!door\)return;door\.dispose\(\);if\(window\.SYNKAtlasGame===door\.api\)delete window\.SYNKAtlasGame;\};/);
});
