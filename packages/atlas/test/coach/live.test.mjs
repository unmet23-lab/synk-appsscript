// 코치의 순간 맞춤 · 오늘 · 표시 설정(단계 4 계획 §23-4 · 4-6b). 한 제시는 Flow를 한 번만 움직이고(첫 판정 답, 또는 게임이 준
// flow.outcome 관찰 가운데 먼저 온 하나 — 설계 주인 11-19 밤), 다시 서빙은 움직이지 않는다. pick은 recommend와 같고, 판 정한 값은 제시
// 사건에 싣지 않는다. 오늘 · 표시 설정은 셸이 넘긴 읽개(host.prefs)를 읽고, 내용 기억은 저장소마다 이 기기에 남는다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { bankOf, clock, memoryPort, openCoach, T0 } from './support.mjs';
import { rng } from '../support/seeds.mjs';

const items = bankOf(rng(46), { items: 12 });
const RUSH = () => ({
  id: 'test.rush',
  target: 0.75,
  items: { levels: [1, 2, 3] },
  knobs: [
    { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
    { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
  ],
});

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: name => (map.has(name) ? map.get(name) : null),
    setItem: (name, value) => map.set(name, String(value)),
    removeItem: name => map.delete(name),
  };
}

let stores = 0;
async function open({
  prefs = {},
  port = memoryPort(),
  storage = fakeStorage(),
  key = `synk-atlas:live-${process.pid}-${(stores += 1)}`,
} = {}) {
  const time = clock(T0);
  const { coach } = await openCoach({
    items,
    time,
    port,
    host: {
      guest: true,
      port,
      now: time.now,
      key,
      prefs: { storage, ...prefs },
    },
  });
  return { coach, time, storage, port };
}

test('오늘 · 표시 설정은 셸이 넘긴 읽개를 읽고, 낱말 밖이거나 없으면 null이다', async () => {
  const one = await open({
    prefs: { today: () => 'tired', presentation: () => ({ motion: 'reduced' }) },
  });
  assert.equal(one.coach.today(), 'tired');
  assert.deepEqual(one.coach.presentation(), { motion: 'reduced' });
  one.coach.dispose();
  const two = await open({ prefs: { today: () => 'sleepy', presentation: () => ({ age: 60 }) } });
  assert.equal(two.coach.today(), null);
  assert.equal(two.coach.presentation(), null);
  two.coach.dispose();
  const three = await open({
    prefs: {
      today: () => {
        throw new Error('blocked');
      },
    },
  });
  assert.equal(three.coach.today(), null);
  assert.equal(three.coach.presentation(), null);
  three.coach.dispose();
});

test('한 제시는 Flow를 한 번만 움직인다 — 다시 서빙(같은 제시의 뒤 답)은 움직이지 않는다', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  const r = live.pick(items, { set: { length: 6 } });
  assert.equal(r.status, 'ready', 'pick은 recommend와 같다');
  const pid = live.present(r.selected);
  time.advance(4_000);
  const first = live.answer(pid, { correct: false, assessable: true, attemptNo: 1 });
  time.advance(4_000);
  const again = live.answer(pid, { correct: true, assessable: true, attemptNo: 2 });
  assert.equal(again.change, null);
  assert.equal(again.evidence, false, '다시 서빙은 Flow의 근거가 아니다');
  assert.equal(live.trace().length, 1, 'Flow는 첫 판정 답 하나만 보았다');
  assert.equal(first.recorded.verdict, 'incorrect');
  assert.equal(again.recorded.verdict, 'correct', '뒤 답도 기록은 된다');
  coach.dispose();
});

test('판정 못 한 첫 답은 Flow의 몫을 쓰지 않고, 게임이 준 flow.outcome은 그 제시의 몫을 쓴다', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  const one = live.present(items[0]);
  time.advance(3_000);
  live.answer(one, { correct: null, assessable: false, reason: 'audio' });
  assert.equal(live.trace().length, 0, '판정 못 한 답은 움직이지 않는다');
  live.answer(one, { correct: true, assessable: true });
  assert.equal(live.trace().length, 1, '그 뒤 첫 판정 답이 움직인다');
  const two = live.present(items[1]);
  time.advance(60_000);
  // 떠난 손님 — 답은 판정 못 함이지만 게임이 시간 초과로 관찰을 준다(카본 A6 · GPT GA4).
  live.answer(
    two,
    { correct: null, assessable: false, reason: 'unanswered' },
    { outcome: 'timeout' },
  );
  assert.equal(live.trace().length, 2);
  assert.equal(live.trace()[1].outcome, 'timeout');
  live.answer(two, { correct: true, assessable: true });
  assert.equal(live.trace().length, 2, '관찰을 준 제시의 뒤 답은 움직이지 않는다');
  coach.dispose();
});

test('판 정한 값은 제시 사건에 싣지 않는다 — 사건은 2판 목록 칸만', async () => {
  const port = memoryPort();
  const { coach } = await open({ port });
  const live = coach.live(RUSH());
  const pid = live.present(items[0]);
  await coach.answer(pid, { correct: true, assessable: true }).stored;
  const rows = await port.read();
  const shown = rows.map(row => row.value.event).find(event => event?.id === pid);
  assert.ok(shown, '제시 사건이 저장소에 있다');
  assert.equal(Object.hasOwn(shown, 'flow'), false);
  coach.dispose();
});

test('items는 손잡이가 아니다 — 문항 단계 바뀜 · 안내 줄이 없고 level()은 null', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  assert.equal(live.level(), null);
  for (let i = 0; i < 8; i += 1) {
    const pid = live.present(items[i % items.length]);
    time.advance(3_000);
    const out = live.answer(pid, { correct: true, assessable: true });
    assert.notEqual(out.change?.knob, 'items');
  }
  assert.ok(!Object.hasOwn(live.settings().values, 'items'));
  coach.dispose();
});

test('다시 본 문항은 제시할 때 정한다 — 첫 도움이 그 제시를 「다시 본 문항」으로 만들지 않는다(카본 다시 검토 A1)', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  const pid = live.present(items[2]);
  coach.help(pid, 'hint');
  time.advance(3_000);
  live.answer(pid, { correct: true, assessable: true });
  assert.equal(live.trace()[0].repeat, false);
  assert.equal(live.trace()[0].assisted, true, '도움 여부는 그 답의 접기 값');
  // 만난 적 없는 계열 둘 — 하나는 그냥, 하나는 「처음이 아니다」로 낸다.
  const unseen = items.filter(item => item.familyKey !== items[2].familyKey);
  const families = [...new Map(unseen.map(item => [item.familyKey, item])).values()];
  const plain = live.present(families[0]);
  time.advance(3_000);
  live.answer(plain, { correct: true, assessable: true });
  assert.equal(live.trace()[1].repeat, false, '처음 본 문항');
  const again = live.present(families[1], { firstExposure: false });
  time.advance(3_000);
  live.answer(again, { correct: true, assessable: true });
  assert.equal(live.trace()[2].repeat, true, '「처음이 아니다」 제시는 다시 본 문항');
  coach.dispose();
});

test('내용 기억은 이 저장소에 남아 다음 판이 이어 받는다', async () => {
  const storage = fakeStorage();
  const key = `synk-atlas:live-${process.pid}-kept`;
  const one = await open({ storage, key });
  const live = one.coach.live(RUSH());
  const start = live.settings().values;
  for (let i = 0; i < 40 && !live.trace().some(row => row.change); i += 1) {
    const pid = live.present(items[i % items.length]);
    one.time.advance(3_000);
    live.answer(pid, { correct: true, assessable: true }, { pressure: 0.2 });
  }
  const ended = live.end();
  assert.notDeepEqual(ended.settings.values, start, '판 안에서 손잡이가 움직였다');
  one.coach.dispose();
  assert.ok(storage.map.has(`synk.atlas.next.flow.${key}`));
  const two = await open({ storage, key });
  const next = two.coach.live(RUSH());
  assert.deepEqual(next.settings().values, ended.settings.values);
  two.coach.dispose();
});

test('코치가 순간 맞춤 기억에 기록부의 비움 세대를 넘긴다 — 손님 비우기 뒤 새 판은 처음 손잡이로 열고, 그 판의 기억은 비운 세대의 열쇠에 선다', async () => {
  const storage = fakeStorage();
  const key = `synk-atlas:live-${process.pid}-cleared`;
  const base = `synk.atlas.next.flow.${key}`;
  const one = await open({ storage, key });
  const play = live => {
    for (let i = 0; i < 40 && !live.trace().some(row => row.change); i += 1) {
      const pid = live.present(items[i % items.length]);
      one.time.advance(3_000);
      live.answer(pid, { correct: true, assessable: true }, { pressure: 0.2 });
    }
    return live.end();
  };
  const first = one.coach.live(RUSH());
  const start = first.settings().values;
  assert.notDeepEqual(play(first).settings.values, start, '판 안에서 손잡이가 움직였다');
  assert.equal(JSON.parse(storage.getItem(base)).gen, 0, '세대 0의 기억이 기본 열쇠에 서지 않았다');
  const done = await one.coach.reset({});
  assert.equal(done.gen, 1);
  const again = one.coach.live(RUSH());
  assert.deepEqual(again.settings().values, start, '비운 뒤에 비우기 전 손잡이로 열었다');
  assert.notDeepEqual(play(again).settings.values, start);
  assert.equal(
    JSON.parse(storage.getItem(`${base}@1`)).gen,
    1,
    '비운 뒤의 기억이 그 세대의 열쇠에 서지 않았다',
  );
  one.coach.dispose();
});

test('표시 설정이 선언 손잡이를 잡는다 — 게임이 값을 주지 않으면 셸의 표시 설정', async () => {
  const { coach } = await open({ prefs: { presentation: () => ({ support: 'step' }) } });
  const spec = {
    id: 'test.help',
    knobs: [
      { id: 'patience', kind: 'pace', values: [60, 45, 32], start: 1 },
      { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 },
    ],
  };
  assert.equal(
    coach.live(spec).settings().values.hint,
    'early',
    '「한 걸음씩」은 도움을 가장 이른 칸에 잡는다',
  );
  assert.equal(coach.live(spec, { presentation: null }).settings().values.hint, 'normal');
  coach.dispose();
});

test('오늘 컨디션은 셸의 읽개에서 받아 판을 연다 — 게임이 준 값이 이긴다', async () => {
  const { coach } = await open({ prefs: { today: () => 'tired' } });
  const tired = coach.live(RUSH());
  const given = coach.live(RUSH(), { condition: null });
  assert.notDeepEqual(tired.intro(), given.intro(), '피곤한 날은 시작이 다르다');
  assert.deepEqual(coach.live(RUSH(), { condition: 'tired' }).intro(), tired.intro());
  coach.dispose();
});

test('오답 뒤 떠난 손님의 시간 초과는 같은 제시의 몫이고, void 관찰은 몫을 쓰지 않는다(GPT 다시 검토 GA3)', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  const served = live.present(items[0]);
  time.advance(3_000);
  live.answer(served, { correct: false, assessable: true });
  live.observe({ outcome: 'timeout' }, served);
  assert.equal(live.trace().length, 1, '오답이 이미 움직인 제시의 시간 초과는 움직이지 않는다');
  const early = live.present(items[1]);
  time.advance(1_000);
  // 소리를 다 듣기 전에 서빙했다 — 기록은 판정 못 함, Flow에는 void.
  live.answer(early, { correct: null, assessable: false, reason: 'audio' }, { outcome: 'void' });
  live.answer(early, { correct: true, assessable: true });
  const rows = live.trace();
  assert.deepEqual(
    rows.slice(1).map(row => row.outcome),
    ['void', 'success'],
    'void 뒤의 첫 판정 답이 움직인다',
  );
  const left = live.present(items[2]);
  time.advance(60_000);
  live.observe({ outcome: 'timeout' }, left);
  live.answer(left, { correct: true, assessable: true });
  assert.equal(live.trace().length, 4, '시간 초과를 먼저 본 제시의 뒤 답은 움직이지 않는다');
  coach.dispose();
});

test('같은 제시의 몫을 이미 쓴 관찰도 첫 관찰과 같은 꼴로 답한다 — evidence가 거짓으로 든다(카본 끝 판 D3)', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  const served = live.present(items[0]);
  time.advance(3_000);
  const first = live.observe({ outcome: 'timeout' }, served);
  const again = live.observe({ outcome: 'timeout' }, served);
  assert.equal(typeof first.evidence, 'boolean');
  assert.deepEqual(Object.keys(again).sort(), Object.keys(first).sort());
  assert.equal(again.evidence, false);
  assert.equal(again.change, null);
  coach.dispose();
});

test('소리 전달이 안 된 답은 게임이 맞음이라 해도 Flow의 몫을 쓰지 않고, 제대로 들은 뒤의 판정 답이 움직인다(GPT 끝 판 D3)', async () => {
  const { coach, time } = await open();
  const live = coach.live(RUSH());
  const item = { ...items[0], audioRequired: true, modality: 'listening' };
  const pid = live.present(item);
  coach.delivery(pid, { audio: 'failed' });
  time.advance(2_000);
  const first = live.answer(pid, { correct: true, assessable: true });
  assert.equal(first.recorded.grade, null, '전달이 안 된 답은 판정하지 않는다');
  assert.equal(first.evidence, false);
  assert.equal(live.trace().length, 0, '판정 못 한 답이 Flow를 움직였다');
  coach.delivery(pid, { audio: 'completed' });
  time.advance(2_000);
  const second = live.answer(pid, { correct: false, assessable: true });
  assert.equal(second.recorded.grade, 'again');
  assert.deepEqual(
    live.trace().map(row => row.outcome),
    ['fail'],
    '제대로 들은 뒤의 판정 답이 움직인다',
  );
  coach.dispose();
});
