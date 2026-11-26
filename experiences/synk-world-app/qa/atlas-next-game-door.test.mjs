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
  assert.deepEqual(Object.keys(GAME_BANKS).sort().length, 12, '열한 게임 + 한글 만나기(4-7)');
  assert.deepEqual(GAME_BANKS['hangul-stage'], ['hangul-stage'], '한글 만나기는 한글 단계 은행 하나만 받는다');
});

test('패널이 닫히면 기다리던 open은 null이 아니라 RUN_ENDED로 거절하고, 받은 코치의 판을 닫는다(다시 검토 A2)', async () => {
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
  const clock = tasks();
  const door = createGameDoor({ entry, gameId: 'talk-rally', later: clock.later });
  const facade = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  const live = facade.live({ id: 'rally' });
  const pid = facade.present({ itemKey: 'a' });
  facade.answer(pid, { correct: true, assessable: true });
  door.dispose();
  await assert.rejects(door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] }), { code: 'RUN_ENDED' }, '닫은 문은 바로 거절한다');
  clock.run();
  door.dispose();
  clock.run();
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
  await new Promise(resolve => setTimeout(resolve, 0));
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
  // 보기 번호는 글자나 유한한 수만 — null · undefined · 참거짓 · NaN은 'null' · 'true' 같은 글로 바뀌어 통과하지 않는다(검수 E1 · F2 · GD3).
  for (const bad of [null, undefined, true, false, NaN, Infinity, {}, '', 'a b'])
    assert.deepEqual(answerOf({ correct: false, choice: { selectedId: bad, correctId: 'b' } }), { correct: false, assessable: true }, String(bad));
  assert.deepEqual(answerOf({ correct: true, choice: { correctId: 'milk' } }), { correct: true, assessable: true });
  assert.deepEqual(answerOf({ correct: true, choice: { selectedId: 2, correctId: 2 } }).choice, { selectedId: '2', correctId: '2' });
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

test('셸 원문 — 문은 게임 이름(주소의 폴더)으로 청하고, 셸 게임 표의 주소 폴더는 문 · 은행 표의 게임 이름이다(짧은 이름 runner로 청하면 문이 늘 null이었다)', async () => {
  const { readFileSync } = await import('node:fs');
  const shell = readFileSync(new URL('../app-shell.mjs', import.meta.url), 'utf8');
  const start = shell.indexOf('async function launchGame(');
  const body = shell.slice(start, shell.indexOf('\n}\n', start));
  assert.ok(body.includes('life.atlasNext.gameDoor(String(listed.path).split(/[/?#]/)[0])'), '문은 게임 이름으로 청한다');
  // 문을 기다린 뒤에는 그 사이 다른 화면을 열었거나 패널을 닫았는지(gameLaunch)만 본다 — 패널을 열지 않고 게임을 여는 길(리허설 · 운영 손님 ·
  // 홈 「맞춤 연습 시작」)이 패널이 닫혀 있다는 까닭으로 아무것도 열지 못했다(4-6 브라우저 확인).
  const wait = body.slice(body.indexOf('if(life.atlasNext?.gameDoor){'), body.indexOf('window.SYNKAtlasGame=gameDoor.api'));
  assert.ok(wait.includes('if(doorTicket!==gameLaunch||loadingGone()){'), '문을 기다린 뒤 gameLaunch와 계정 길의 로딩 패널을 본다');
  assert.ok(!wait.includes('worldPanel.open'), '문을 기다린 뒤 패널이 열려 있는지 묻지 않는다');
  // 스위치가 켜진 판에서는 문을 보기 전에 생활 세션이 다 서기를 기다린다 — 로그인 직후 바로 연 게임이 입구가 서기 전이라 문 없이 옛 길로
  // 열렸다(4-6 브라우저 다시 보기). 꺼진 판은 기다리지 않는다.
  const gate = body.indexOf('await life.ensure();if(doorTicket!==gameLaunch||loadingGone()){');
  // 로딩 패널을 띄운 열기(계정 길)만 그 패널이 아직 열려 있는지 본다 — 홈의 닫기는 패널 종류를 곧바로 비우고 gameLaunch는 160ms 전환 뒤에
  // 바뀐다(다시 보기 GB4). 패널 없이 연 길은 패널을 묻지 않는다.
  assert.ok(body.includes("loadingGone=()=>loadingShown&&(!worldPanel.open||typeof home.openPanel==='function'&&home.openPanel()!=='world-game-loading')"));
  assert.ok(body.includes("'world-game-loading');loadingShown=true;"), '계정 길이 로딩 패널을 띄울 때만 표를 단다');
  assert.ok(gate >= 0 && gate < body.indexOf('if(life.atlasNext?.gameDoor){'), '입구를 보기 전에 생활 세션을 기다린다');
  const from = shell.indexOf('const games={');
  const table = shell.slice(from, shell.indexOf('\n};', from));
  const folders = new Set([...table.matchAll(/['`]([a-z-]+)\/(?:\?[^'`]*)?['`]/g)].map(match => match[1]));
  const reachable = Object.keys(GAME_BANKS).filter(game => folders.has(game)).sort();
  assert.deepEqual(reachable, ['blank-slice', 'entry-check', 'hangul-stage', 'korean-racing', 'korean-rhythm', 'korean-runner', 'order-rush', 'snap-words', 'subway-rush', 'talk-rally'], 'WORLD가 여는 열 게임(4-7에 한글 만나기를 더함)');
  for (const path of ['korean-runner/', 'snap-words/?grade=3', 'subway-rush/?grade=4', 'talk-rally/'])
    assert.ok(Object.hasOwn(GAME_BANKS, path.split(/[/?#]/)[0]), path);
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

test('겉을 받은 틀이 onRetired를 걸기 전에 판을 다시 정했으면 건 때 다음 차례로 알린다 — 알림이 사라지지 않는다(끝 판 D1)', async () => {
  const entry = fakeEntry();
  const { later, run } = tasks();
  const door = createGameDoor({ entry, gameId: 'talk-rally', later });
  const facade = await door.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  entry.retire(entry.coach, 'account');
  assert.equal(facade.closed, true);
  const heard = [];
  const stop = facade.onRetired(detail => heard.push(detail));
  assert.deepEqual(heard, [], '건 자리에서 바로 부르지 않는다');
  run();
  assert.deepEqual(heard, [{ reason: 'account' }]);
  // 끊은 듣개는 부르지 않는다
  const late = [];
  facade.onRetired(detail => late.push(detail))();
  run();
  assert.deepEqual(late, []);
  stop();
});

test('패널을 닫으면 겉 닫기는 셸 창의 다음 차례다 — 틀이 내려가며(pagehide) 내는 마지막 답이 먼저 든다(끝 판 GD5)', async () => {
  const entry = fakeEntry();
  const clock = tasks();
  const door = createGameDoor({ entry, gameId: 'subway-rush', later: clock.later });
  const facade = await door.api.open({ gameId: 'subway-rush', banks: ['subway-rush'] });
  const pid = facade.present({ itemKey: 'a' });
  door.dispose(); // 셸의 닫기 단추 — 틀을 내리기 전
  facade.answer(pid, { correct: null, assessable: false, reason: 'unanswered' }); // 틀의 pagehide
  clock.run();
  const names = entry.coach.calls.map(([name]) => name);
  assert.deepEqual(names.slice(-2), ['answer', 'finishSet']);
  assert.throws(() => facade.recommend([]), { code: 'RUN_ENDED' });
});

test('다시 연 패널의 문이 같은 코치를 앉혀 쓰면, 앞 문의 늦은 open은 그 판을 닫지 않는다(끝 판 GD1)', async () => {
  const coach = fakeCoach();
  let release;
  const slow = fakeEntry({ coach, give: () => new Promise(resolve => (release = () => resolve(coach))) });
  const old = createGameDoor({ entry: slow, gameId: 'talk-rally', later: fn => fn() });
  const late = old.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  old.dispose();
  const fresh = createGameDoor({ entry: fakeEntry({ coach }), gameId: 'talk-rally', later: fn => fn() });
  const facade = await fresh.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  facade.present({ itemKey: 'a' });
  release();
  await assert.rejects(late, { code: 'RUN_ENDED' });
  assert.deepEqual(coach.calls.filter(([name]) => name === 'finishSet'), [], '새 문의 판을 앞 문이 닫았다');
  assert.equal(facade.closed, false);
  fresh.dispose();
  assert.deepEqual(coach.calls.filter(([name]) => name === 'finishSet'), [['finishSet', { record: false }]]);
});

test('은행 목록은 셸 창의 사본으로 옮긴 뒤 본다 — 본 목록과 입구에 넘기는 목록이 같다(끝 판 GD6)', async () => {
  const entry = fakeEntry();
  const door = createGameDoor({ entry, gameId: 'order-rush' });
  let reads = 0;
  const shifty = new Proxy(['order-rush'], {
    get(target, key, receiver) {
      if (key === '0') return (reads += 1) === 1 ? 'order-rush' : 'talk-rally';
      return Reflect.get(target, key, receiver);
    },
  });
  await door.api.open({ gameId: 'order-rush', banks: shifty });
  assert.deepEqual(entry.asked.at(-1), ['order-rush', ['order-rush']]);
  await assert.rejects(door.api.open({ gameId: 'order-rush', banks: [7] }), { code: 'DOOR_BANK' });
});

test('닫은 패널의 미룬 닫기가 돌기 전에 다시 연 패널의 문이 같은 코치를 앉히면, 앞 판을 먼저 닫고 앉는다(다시 보기 C2)', async () => {
  const coach = fakeCoach();
  const clock = tasks();
  const old = createGameDoor({ entry: fakeEntry({ coach }), gameId: 'talk-rally', later: clock.later });
  const first = await old.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  first.present({ itemKey: 'a' });
  old.dispose(); // 닫기는 다음 차례 — 아직 돌지 않았다
  const fresh = createGameDoor({ entry: fakeEntry({ coach }), gameId: 'talk-rally', later: clock.later });
  const facade = await fresh.api.open({ gameId: 'talk-rally', banks: ['talk-rally'] });
  assert.deepEqual(coach.calls.filter(([name]) => name === 'finishSet'), [['finishSet', { record: false }]], '앞 판을 먼저 닫는다');
  assert.equal(first.closed, true);
  facade.present({ itemKey: 'b' });
  clock.run(); // 미룬 닫기가 이제 돈다 — 새 문의 판은 건드리지 않는다
  assert.equal(coach.calls.filter(([name]) => name === 'finishSet').length, 1);
  assert.equal(facade.closed, false);
});

// ③ (나) 후보(라이브 7dd7a9b 위 cand-pub-s3e2b)의 app-shell 문 기다림 줄. ③ 공개부터 5-3 켜는 공개(master의 app-shell)까지 라이브에 서는 줄이다.
// 후보는 master d3abfd8c14 뒤의 문 기다림(생활 세션 · 계정 길의 로딩 패널)을 옮기지 않고 같은 뜻을 이 한 줄로 막았다 — 기다리기 전에 패널이 열려
// 있던 길만 패널이 닫혔는지 본다(손님 · 리허설은 패널 없이 연다). 검수 중에는 SYNK_STEP3_APP_SHELL로 후보 파일을 주어 이 줄이 그대로인지 본다.
const STEP3_DOOR =
  'if(life.atlasNext?.gameDoor){const doorTicket=gameLaunch,panelWas=worldPanel.open;gameDoor=await life.atlasNext.gameDoor(id).catch(()=>null);if(doorTicket!==gameLaunch||panelWas&&!worldPanel.open){gameDoor?.dispose();gameDoor=null;session?.dispose();return;}if(gameDoor)window.SYNKAtlasGame=gameDoor.api;}';

// 문 기다림 줄 하나를 가짜 셸 상태로 돌린다. 문을 기다리는 사이 장면(패널 닫힘 · 다른 화면 · 그대로)을 일으키고, 연다 · 멈춘다와 치운 것을 낸다.
async function doorScene(statement, { loadingShown, openBefore, openAfter, kindAfter = '', bump = false, door = true }) {
  const disposed = [];
  let release;
  const waiting = new Promise(resolve => (release = resolve));
  const given = door ? { api: { tag: 'door' }, dispose: () => disposed.push('door') } : null;
  const scope = {
    gameLaunch: 1,
    worldPanel: { open: openBefore },
    kind: loadingShown ? 'world-game-loading' : '',
    loadingShown,
    atlasNextOn: true,
    life: { ensure: async () => {}, atlasNext: { gameDoor: () => waiting } },
    home: { openPanel: () => (scope.worldPanel.open ? scope.kind : '') },
    session: { dispose: () => disposed.push('session') },
    gameDoor: null,
    window: {},
    id: 'runner',
    listed: { path: 'korean-runner/' },
  };
  // 셸 원문의 한 줄을 그 자리의 이름(gameLaunch · worldPanel · life …)으로 돌린다 — with는 sloppy 함수 안에서만 쓸 수 있다.
  const run = new Function('scope', `return (async function(){with(scope){${statement}\nreturn 'opened';}})();`)(scope);
  for (let i = 0; i < 3; i += 1) await null;
  scope.worldPanel.open = openAfter;
  scope.kind = kindAfter;
  if (bump) scope.gameLaunch += 1;
  release(given);
  const result = (await run) ?? 'stopped';
  return { result, disposed, door: scope.window.SYNKAtlasGame?.tag ?? null };
}

test('게임 문 — ③ 후보의 문 기다림 줄과 master의 문 기다림이 같은 장면에서 같은 답을 낸다(설계 주인 11-23 조건 5 · master d3abfd8c14)', async () => {
  const { readFileSync } = await import('node:fs');
  if (process.env.SYNK_STEP3_APP_SHELL) assert.ok(readFileSync(process.env.SYNK_STEP3_APP_SHELL, 'utf8').includes(STEP3_DOOR), '후보 app-shell에 이 줄이 그대로 있다');
  const shell = readFileSync(process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const from = shell.indexOf('if(atlasNextOn){const doorTicket=gameLaunch;');
  const to = shell.indexOf('window.SYNKAtlasGame=gameDoor.api;}', from);
  assert.ok(from >= 0 && to > from, 'master의 문 기다림을 찾았다');
  const masterDoor = shell.slice(from, to + 'window.SYNKAtlasGame=gameDoor.api;}'.length);
  const scenes = [
    ['손님 · 리허설 — 패널 없이 열고, 문을 기다리는 사이 아무 일도 없다(4-6 브라우저 확인 · 조건 1 측정에서 막혔던 장면)', { loadingShown: false, openBefore: false, openAfter: false }, 'opened'],
    ['계정 길 — 로딩 패널이 그대로 열려 있다', { loadingShown: true, openBefore: true, openAfter: true, kindAfter: 'world-game-loading' }, 'opened'],
    ['계정 길 — 기다리는 사이 로딩 패널을 닫았다(닫기 전환 160ms 안 — gameLaunch는 그대로)', { loadingShown: true, openBefore: true, openAfter: false }, 'stopped'],
    ['기다리는 사이 다른 화면을 열었다(gameLaunch가 바뀜)', { loadingShown: false, openBefore: false, openAfter: true, kindAfter: 'world-profile', bump: true }, 'stopped'],
    ['계정 길 — 기다리는 사이 다른 화면을 열었다', { loadingShown: true, openBefore: true, openAfter: true, kindAfter: 'world-profile', bump: true }, 'stopped'],
    ['문이 없다(입구가 문을 내지 않음 · 404) — 옛 길로 연다', { loadingShown: false, openBefore: false, openAfter: false, door: false }, 'opened'],
  ];
  for (const [name, setting, want] of scenes) {
    const step3 = await doorScene(STEP3_DOOR, setting);
    const next = await doorScene(masterDoor, setting);
    assert.equal(step3.result, want, `③ 후보 — ${name}`);
    assert.deepEqual(step3, next, `③ 후보와 master가 같다 — ${name}`);
    if (want === 'stopped' && setting.door !== false) assert.deepEqual(step3.disposed.sort(), ['door', 'session'], `멈추면 문과 세션을 치운다 — ${name}`);
    if (want === 'opened') assert.equal(step3.door, setting.door === false ? null : 'door', `열면 문을 둔다 — ${name}`);
  }
});

// 셸 원문의 게임 표(games)를 그 자리의 이름으로 돌려 게임마다 주소를 읽는다. 표는 드라마 칸(drama:{…}})으로 끝난다.
function gamesOf(shell) {
  const from = shell.indexOf('const games={');
  const to = shell.indexOf('};', shell.indexOf('drama:{', from)) + 1;
  return new Function('scope', `with(scope){return (${shell.slice(from + 'const games='.length, to)});}`)({ t: key => key, life: { progress: null }, currentLang: () => 'ko' });
}
// 셸 원문의 launchGame에서 실제로 도는 문 줄 하나를 꺼낸다. master 줄(if(atlasNextOn){…)이 없으면 옛 줄(if(life.atlasNext?.gameDoor){…)이다.
// 주석 안의 줄은 문이 아니다 — 옛 줄을 둔 채 고친 줄을 주석에 넣은 셸이 통과했다(5-3 전 고침 검수 GPT GA1). 그래서 문을 두는 자리
// (window.SYNKAtlasGame=)가 하나이고, 짧은 이름(id)으로 문을 청하는 줄이 없고, 꺼낸 줄이 줄 주석 · 블록 주석 안에 있지 않아야 한다.
function doorOf(shell) {
  const start = shell.indexOf('async function launchGame(');
  const body = shell.slice(start, shell.indexOf('\n}\n', start));
  assert.equal([...body.matchAll(/window\.SYNKAtlasGame=(?!=)/g)].length, 1, '문을 두는 자리는 하나');
  assert.ok(!body.includes('.gameDoor(id)'), '짧은 이름(id)으로 문을 청하는 줄이 없다');
  const end = 'window.SYNKAtlasGame=gameDoor.api;}';
  const to = body.indexOf(end) + end.length;
  const master = body.lastIndexOf('if(atlasNextOn){const doorTicket=gameLaunch;', to);
  const from = master >= 0 ? master : body.lastIndexOf('if(life.atlasNext?.gameDoor){', to);
  assert.ok(from >= 0 && to > from, '문 줄을 찾았다');
  assert.ok(!body.slice(body.lastIndexOf('\n', from) + 1, from).includes('//'), '문 줄이 줄 주석 안에 있지 않다');
  assert.ok(body.lastIndexOf('/*', from) <= body.lastIndexOf('*/', from), '문 줄이 블록 주석 안에 있지 않다');
  return body.slice(from, to);
}
// 문 줄 하나를 진짜 새 길 입구의 gameDoor로 돌린다. on은 깃발 atlasNext다. 꺼진 판의 셸은 입구를 받지 않는다(life.atlasNext null).
async function launchScene(statement, { id, listed, entry, on = true }) {
  const asked = [];
  let ensured = false;
  const scope = {
    gameLaunch: 1,
    worldPanel: { open: false },
    loadingShown: false,
    atlasNextOn: on,
    life: {
      ensure: async () => {
        ensured = true;
      },
      atlasNext: on ? { gameDoor: async name => (asked.push(name), entry.gameDoor(name)) } : null,
    },
    home: { openPanel: () => '' },
    session: null,
    gameDoor: null,
    window: {},
    id,
    listed,
  };
  const result = await new Function('scope', `return (async function(){with(scope){${statement}\nreturn 'opened';}})();`)(scope);
  const door = scope.window.SYNKAtlasGame ?? null;
  scope.gameDoor?.dispose?.();
  return { result: result ?? 'stopped', path: door ? 'new' : 'old', asked: asked[0] ?? null, ensured };
}

// 5-3 전 고침 GD2. 라이브 셸은 짧은 이름(id)으로 문을 청해 입구가 문을 두지 않았다(은행 표의 열쇠는 주소 폴더 이름이다). 5-3 사슬에서는 5-3 후보
// app-shell을 SYNK_APP_SHELL_SOURCE로 넘겨 돌린다. master 셸에는 이미 고친 줄이 있어, 넘기지 않으면 master 셸을 본다.
test('게임 문 두 방향 — 옛 셸(③ 라이브 줄)과 새 입구는 옛 길, 새 셸과 새 입구는 게임 넷(레이싱 · 바람길 · 말의 리듬 · 환승 러시)이 새 길이다. 꺼진 판은 문 줄을 건너뛴다(설계 주인 11-25 · 5-3 전 고침 GD2)', async () => {
  const { readFileSync } = await import('node:fs');
  const { createAtlasNext } = await import('../world-atlas-next.mjs');
  const entry = createAtlasNext({
    owner: 'guest',
    storage: null,
    health: { note() {}, snapshot: () => ({}) },
    load: async () => ({
      coach: () => ({ ready: Promise.resolve(), summary: () => ({ storage: { base: true } }), dispose() {} }),
      SynkAtlas: { load: async () => ({}) },
    }),
  });
  const shell = readFileSync(process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const games = gamesOf(shell);
  const door = doorOf(shell);
  const want = { racing: 'korean-racing', runner: 'korean-runner', rhythm: 'korean-rhythm', subway: 'subway-rush' };
  for (const [id, folder] of Object.entries(want)) {
    assert.equal(String(games[id]?.path).split(/[/?#]/)[0], folder, `셸 게임 표 — ${id}의 주소 폴더`);
    // 옛 셸과 새 입구: 짧은 이름으로 청해 문이 없고 옛 길로 연다. 캐시의 옛 셸이 10분 섞임 창에서 만나는 한계다.
    const old = await launchScene(STEP3_DOOR, { id, listed: games[id], entry });
    assert.deepEqual([old.result, old.asked, old.path], ['opened', id, 'old'], `옛 셸 + 새 입구 — ${id}`);
    // 새 셸과 새 입구: 게임 이름(주소 폴더)으로 청해 문이 서고 새 길로 연다.
    const fresh = await launchScene(door, { id, listed: games[id], entry });
    assert.deepEqual([fresh.result, fresh.asked, fresh.path], ['opened', folder, 'new'], `새 셸 + 새 입구 — ${id}`);
    // 꺼진 판: 문 줄을 건너뛰고 생활 세션도 기다리지 않는다.
    const off = await launchScene(door, { id, listed: games[id], entry, on: false });
    assert.deepEqual([off.result, off.asked, off.path, off.ensured], ['opened', null, 'old', false], `꺼진 판 — ${id}`);
  }
  entry.dispose();
});

// 5-3 게임 GE1(설계 주인 11-26): 이유 줄은 그 판이 평가할 단위를 그 단위의 첫 평가(등급이 매겨진 답) 전에 이름으로 말하지 않는다.
// 키트가 감싼 코치의 recommend 한 자리에서 바꾼다 — 돌아온 · 흔들리는 · 방금 놓친 단위는 GAME_NAMELESS, 처음 만나는 단위는 이름 없는 처음 문장,
// 그 밖은 줄 없음. 판(startSet · finishSet)이 바뀌면 다시 센다.
test('키트 — 이유 줄은 이 판에서 아직 평가하지 않은 단위의 이름을 말하지 않는다(5-3 게임 GE1)', async () => {
  const coach = fakeCoach();
  let why = null, grade = null;
  coach.recommend = candidates => ({ status: 'ready', selected: candidates[0], alternatives: [], why });
  coach.answer = () => ({ verdict: 'correct', grade });
  coach.live = () => ({ spec: { id: 'flow' }, pick: candidates => coach.recommend(candidates), answer: (pid, result) => ({ recorded: coach.answer(pid, result), settings: null }) });
  const door = createGameDoor({ entry: fakeEntry({ coach }), gameId: 'subway-rush' });
  const top = { SYNKAtlasGame: door.api };
  const next = await openNext({ win: { parent: top, top, addEventListener() {} }, gameId: 'subway-rush', banks: ['subway-rush'] });
  const item = { itemKey: 'subway.decision.a' }, other = { itemKey: 'subway.decision.b' };
  const line = (code, text, unit = 'w:그대로') => (why = { code, slots: { unit }, line: text });
  const set = setPlay(next, { length: 4 });
  // 처음 만나는 단위 — 그 이름(곧 답)을 말하지 않는다.
  line('unit.new', '「그대로」 처음 만나요.');
  assert.equal(set.next([item]).why.line, '새로운 말을 처음 만나요.');
  // 제시했지만 등급 없는 답(소리를 끔 · 판정 못 함)은 평가가 아니다 — 여전히 이름 없이.
  next.answer(next.present(item), { correct: true, assessable: false });
  line('unit.retry', '방금 놓친 「그대로」 다시 만나요.');
  assert.equal(set.next([item]).why.line, '게임에서 만난 말이 돌아왔어요. 잊기 전에 한 번 더 만나요.');
  // 등급이 매겨진 답 뒤에는 이름을 말해도 된다(이미 평가했다). 손잡이(live)의 답 { recorded }도 같다.
  grade = 'correct';
  next.live({ id: 'flow' }).answer(next.present(item), { correct: true, assessable: true });
  assert.equal(set.next([item]).why.line, '방금 놓친 「그대로」 다시 만나요.');
  // 다른 단위는 그 단위대로 — 평가 전이면 이름 없이.
  line('unit.due', '돌아온 「왼쪽」, 다시 만나요.', 'w:왼쪽');
  assert.equal(set.next([other]).why.line, '게임에서 만난 말이 돌아왔어요. 잊기 전에 한 번 더 만나요.');
  // 판이 바뀌면 다시 센다.
  set.end();
  line('unit.shaky', '흔들리는 「그대로」, 다시 만나요.');
  assert.equal(set.next([item]).why.line, '게임에서 만난 말이 돌아왔어요. 잊기 전에 한 번 더 만나요.');
  // 화면 언어는 줄의 글자로 가른다. 몽골어 처음 문장은 검수 전이라 줄 없음.
  line('unit.due', 'Back: ‘left’.', 'w:왼쪽');
  assert.equal(set.next([other]).why.line, 'Something you met in a game is back. Let’s review it once more before it fades.');
  line('unit.new', 'Seeing ‘left’ for the first time.', 'w:왼쪽');
  assert.equal(set.next([other]).why.line, 'Meeting something new for the first time.');
  line('unit.due', 'Эргэн ирлээ: «зүүн».', 'w:왼쪽');
  assert.equal(set.next([other]).why.line, 'Тоглоомд үзсэн үг хэллэг эргэн ирлээ. Мартахаасаа өмнө дахин нэг давтъя.');
  line('unit.new', 'Анх удаа танилцаж байна: «зүүн».', 'w:왼쪽');
  assert.equal(set.next([other]).why.line, null);
  // 난도 · 숨 고르기 · 목표처럼 이름 없는 문장이 없는 이유는 줄 없음 — 게임은 기본 안내를 둔다.
  for (const code of ['skill.up', 'skill.ease', 'pace.breather', 'goal.match']) {
    line(code, '「왼쪽」 …', 'w:왼쪽');
    assert.equal(set.next([other]).why.line, null, code);
  }
  // 단위 칸이 없는 이유(채우기)는 그대로, 판 밖 recommend(입구의 추천)도 같은 규칙이다.
  why = { code: 'idle', slots: { left: 0 }, line: '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.' };
  assert.equal(set.next([other]).why.line, '오늘 돌아온 것은 다 만났어요. 가볍게 이어가요.');
  line('unit.new', '「왼쪽」 처음 만나요.', 'w:왼쪽');
  assert.equal(next.recommend([other]).why.line, '새로운 말을 처음 만나요.');
  assert.equal(next.live({ id: 'flow' }).pick([other]).why.line, '새로운 말을 처음 만나요.');
  door.dispose();
});

test('키트의 GAME_NAMELESS는 셸 world-today.mjs의 이름 없는 게임 줄과 글자까지 같다', async () => {
  const { readFileSync } = await import('node:fs');
  const block = rel => {
    const text = readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const at = text.indexOf('const GAME_NAMELESS = Object.freeze({');
    assert.ok(at >= 0, rel);
    return text.slice(at, text.indexOf('});', at)).replace(/\s+/g, ' ');
  };
  assert.equal(block('../../play-common/kit/atlas-next.mjs'), block('../world-today.mjs'));
});
