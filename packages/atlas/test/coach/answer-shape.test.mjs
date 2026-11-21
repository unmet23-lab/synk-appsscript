// 답의 형식과 전달(단계 4 계획 §25-3 불변식 나) · 요약의 세대(불변식 가) · 기록부의 치우기 시각(§25-5 floor).
// 셸은 게임 판의 한 수를 게임이 넘긴 값이 아니라 코치가 정한 판정 · 형식 · 전달로 센다. 형식은 답할 때 돌려주고, 전달은 답의 저장이 끝난
// 뒤 evidence에 싣는다(설계 주인 11-21 — r2 GA2 · r3 GA3). 답할 때 정하면 앞 전달 · 제외의 저장 결과로 낡기 때문이다. 기록부의 쓰기는
// 차례대로라, 답이 저장된 때에는 앞 전달의 저장 성패와 앞 제외가 판의 거름에 들어 있다. 그 값이 일반 길과 손잡이 길에서 같다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, fakeMap, memoryPort, openCoach } from './support.mjs';

const items = bankOf(rng(71), { items: 8 });
const RUSH = () => ({
  id: 'test.shape',
  target: 0.75,
  knobs: [{ id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 }],
});
const listening = item => ({ ...item, audioRequired: true, modality: 'listening' });
const settle = async () => {
  for (let k = 0; k < 4; k += 1) await new Promise(resolve => setTimeout(resolve, 0));
};
const deliveredOf = async recorded => (await recorded.evidence).delivered;

test('일반 답은 제시 사건의 형식을 싣고, 전달은 저장 뒤 evidence에 — 소리가 드는 문항은 그 답 앞에 끝난 전달만 delivered다', async () => {
  const time = clock();
  const { coach } = await openCoach({ items, time });
  coach.recommend(items.slice(1), { set: { length: 6 } });
  const read = coach.present(items[1]);
  time.advance(1000);
  const plain = coach.answer(read, { correct: true, assessable: true });
  assert.equal(plain.modality, 'reading');
  assert.equal(
    Object.hasOwn(plain, 'delivered'),
    false,
    '답할 때의 전달 값은 없다 — 임시 값을 셀 길이 없다',
  );
  assert.equal(await deliveredOf(plain), true, '소리가 들지 않는 문항은 늘 전달된 것이다');

  const pid = coach.present(listening(items[2]));
  time.advance(1000);
  const none = coach.answer(pid, { correct: false, assessable: true });
  assert.equal(none.modality, 'listening');
  assert.equal(await deliveredOf(none), false, '전달을 알리지 않은 답(pending)');
  coach.delivery(pid, { audio: 'failed' });
  time.advance(1000);
  assert.equal(
    await deliveredOf(coach.answer(pid, { correct: false, assessable: true })),
    false,
    'failed 뒤의 답',
  );
  coach.delivery(pid, { audio: 'completed' });
  time.advance(1000);
  assert.equal(
    await deliveredOf(coach.answer(pid, { correct: true, assessable: true })),
    true,
    '끝난 전달 뒤의 답',
  );
  coach.dispose();
});

test('손잡이 길(live)의 답도 recorded에 같은 형식을, evidence에 같은 전달을 싣는다', async () => {
  const time = clock();
  const { coach } = await openCoach({ items, time });
  const live = coach.live(RUSH());
  const pid = live.present(listening(items[3]));
  time.advance(1000);
  const before = live.answer(pid, { correct: true, assessable: true });
  assert.equal(before.recorded.modality, 'listening');
  assert.equal(Object.hasOwn(before.recorded, 'delivered'), false);
  assert.equal(await deliveredOf(before.recorded), false);
  const other = live.present(listening(items[4]));
  coach.delivery(other, { audio: 'completed' });
  time.advance(1000);
  const after = live.answer(other, { correct: true, assessable: true });
  assert.equal(await deliveredOf(after.recorded), true);
  assert.equal(after.recorded.verdict, 'correct');
  coach.dispose();
});

test('요약의 저장 칸은 기록부 세대를 싣고, 손님 기록을 비우면 오른다', async () => {
  const time = clock();
  const { coach } = await openCoach({ items, time });
  assert.equal(coach.summary().storage.generation, 0);
  const done = await coach.reset({ legacy: null });
  assert.equal(done.ok, true);
  assert.equal(coach.summary().storage.generation, 1);
  coach.dispose();
});

test('제외한 전달과 저장이 실패한 전달 뒤의 답은 delivered가 거짓이다 — 접기가 보는 전달과 같다(GPT GA1)', async () => {
  const time = clock();
  const { coach, port } = await openCoach({ items, time });
  coach.recommend(items.slice(1), { set: { length: 6 } });
  const pid = coach.present(listening(items[5]));
  const heard = coach.delivery(pid, { audio: 'completed' });
  await settle();
  coach.exclude(heard.id);
  await settle();
  time.advance(1000);
  const excluded = coach.answer(pid, { correct: true, assessable: true });
  assert.equal(await deliveredOf(excluded), false, '제외한 전달 뒤의 소리는 아직이다');
  assert.equal(excluded.grade, null, '접기도 그 답을 판정 답으로 세지 않는다');

  const other = coach.present(listening(items[6]));
  port.failNext(new Error('quota'));
  coach.delivery(other, { audio: 'completed' });
  await settle();
  port.heal();
  time.advance(1000);
  const lost = coach.answer(other, { correct: true, assessable: true });
  assert.equal(await deliveredOf(lost), false, '저장이 실패한 전달은 없던 것이다');
  assert.equal(lost.grade, null);
  coach.dispose();
});

// 저장 차례(설계 주인 11-21 조건 1 · 2). 앞 사건의 저장 성패가 답할 때는 아직 정해지지 않았다 — 답할 때 정하면 참이었던 값이, 답이
// 저장된 뒤에는 접기와 같게 거짓이다. 답의 저장이 실패하면 evidence는 「기록 안 됨」이고 셸은 세지 않는다.
test('저장 차례 — 늦게 실패한 전달 쓰기 뒤에 저장된 답, 답보다 먼저 쓴 제외 뒤의 답은 delivered가 거짓이고, 저장이 실패한 답은 기록 안 됨이다', async () => {
  const base = memoryPort();
  let hold = null;
  // 소리 전달을 담은 쓰기만 붙들었다가 실패시킨다 — 그 쓰기가 끝나기 전에 답한다.
  const port = {
    ...base,
    append: async (values, options) => {
      if (hold && values.some(value => value?.event?.type === 'practice.delivery')) {
        await hold.promise;
        throw new Error('quota');
      }
      return base.append(values, options);
    },
  };
  const time = clock();
  const { coach } = await openCoach({ items, time, port });
  coach.recommend(items.slice(1), { set: { length: 6 } });

  const late = coach.present(listening(items[2]));
  await settle();
  let release = null;
  hold = { promise: new Promise(resolve => (release = resolve)) };
  coach.delivery(late, { audio: 'completed' });
  time.advance(1000);
  const behind = coach.answer(late, { correct: true, assessable: true });
  hold = null;
  release();
  assert.equal(await behind.stored, true, '답은 저장됐다');
  const evidence = await behind.evidence;
  assert.equal(evidence.stored, true);
  assert.equal(evidence.delivered, false, '늦게 실패한 전달 — 저장 뒤에는 거짓');

  const early = coach.present(listening(items[3]));
  const heard = coach.delivery(early, { audio: 'completed' });
  await settle();
  coach.exclude(heard.id);
  time.advance(1000);
  const after = coach.answer(early, { correct: true, assessable: true });
  assert.equal(await deliveredOf(after), false, '답보다 먼저 쓴 제외 — 저장 뒤에는 거짓');

  const lostPid = coach.present(items[4]);
  await settle();
  base.failNext(new Error('quota'));
  time.advance(1000);
  const lost = coach.answer(lostPid, { correct: true, assessable: true });
  assert.equal(await lost.stored, false);
  assert.deepEqual(
    await lost.evidence,
    { stored: false, independent: false, assisted: null, exposure: null, delivered: false },
    '저장이 실패한 답은 기록 안 됨 — 셸은 세지 않는다',
  );
  base.heal();
  coach.dispose();
});

// 기록부에 든 사건으로 정한다(설계 주인 11-21 — r4 GPT GA1). 판의 표지는 새 판을 열면 비워지고, 묶음의 마지막 전달은 답 뒤의 전달까지 본다.
// 저장 뒤 전달은 접기와 같은 함수(record/adapt.mjs audiosBefore)가 기록부의 그 제시 묶음에서 그 답 앞의 마지막 전달을 본다.
test('답 뒤에 온 전달은 그 답의 전달이 아니고, 저장 전에 새 판을 열어도 늦게 실패한 전달은 거짓이다 — 기록부로 정한다', async () => {
  const time = clock();
  const after = await openCoach({ items, time });
  after.coach.recommend(items.slice(1), { set: { length: 6 } });
  const pid = after.coach.present(listening(items[2]));
  time.advance(1000);
  const early = after.coach.answer(pid, { correct: true, assessable: true });
  after.coach.delivery(pid, { audio: 'completed' });
  assert.equal(await deliveredOf(early), false, '답 뒤의 전달');
  after.coach.dispose();

  const base = memoryPort();
  let hold = null;
  const port = {
    ...base,
    append: async (values, options) => {
      if (hold && values.some(value => value?.event?.type === 'practice.delivery')) {
        await hold.promise;
        throw new Error('quota');
      }
      return base.append(values, options);
    },
  };
  const { coach } = await openCoach({ items, time, port });
  coach.recommend(items.slice(1), { set: { length: 6 } });
  const late = coach.present(listening(items[3]));
  await settle();
  let release = null;
  hold = { promise: new Promise(resolve => (release = resolve)) };
  coach.delivery(late, { audio: 'completed' });
  time.advance(1000);
  const behind = coach.answer(late, { correct: true, assessable: true });
  coach.startSet({ length: 3 });
  hold = null;
  release();
  assert.equal(await behind.stored, true);
  assert.equal(
    await deliveredOf(behind),
    false,
    '저장 전에 새 판 — 판의 표지가 비워져도 기록부에 그 전달이 없다',
  );
  coach.dispose();
});

// 마구 만든 차례(설계 주인 11-21 조건 2). 듣기 문항 하나에 전달(끝남 · 실패) · 저장이 실패한 전달 · 앞 전달 제외 · 답을 섞고, 답의
// 저장이 끝나기 전에 새 판을 열기도 한다. 답마다 저장 뒤 evidence.delivered가 그때 기록부를 접은 그 답의 판단(assessable — 판정한 답 ·
// 가림 없음이라 전달이 쓸 만한가와 같다)과 같다. 코치 하나가 차례 서른을 잇고(코치 열 벌), 견줄 때는 그 제시의 사건만 접는다.
const tick = async () => {
  for (let k = 0; k < 4; k += 1) await new Promise(resolve => setImmediate(resolve));
};
const EXCLUDED_TYPE = 'record.excluded';

// 기록부에 든 사건 가운데 그 제시의 묶음(제시 · 자식 · 그것을 겨눈 제외)만.
function groupEvents(events, pid) {
  const ids = new Set([pid]);
  for (const event of events) if (event.presentationId === pid) ids.add(event.id);
  return events.filter(
    event => ids.has(event.id) || (event.type === EXCLUDED_TYPE && ids.has(event.targetId)),
  );
}

// 답 걸음 — 답하고, 때로 저장이 끝나기 전에 새 판을 연 뒤 evidence를 기다려 견준다. 견줬으면 1.
async function answerStep(ctx, run) {
  const { coach, random, check } = ctx;
  const out = coach.answer(run.pid, { correct: random() < 0.5, assessable: true });
  const reopen = random() < 0.2;
  if (reopen) coach.startSet({ length: 3 });
  const evidence = await out.evidence;
  if (evidence.stored) await check(run.pid, out.eventId, evidence.delivered);
  if (reopen) {
    run.pid = coach.present(listening(items[1 + Math.floor(random() * 6)]));
    run.stored = [];
  }
  return evidence.stored ? 1 : 0;
}

// 걸음 하나 — 전달 · 저장이 실패한 전달 · 앞 전달 제외 · 답 가운데 하나. 견준 답의 수를 낸다.
async function oneStep(ctx, run) {
  const { coach, port, random } = ctx;
  const roll = random();
  if (roll < 0.3) {
    run.stored.push(coach.delivery(run.pid, { audio: random() < 0.7 ? 'completed' : 'failed' }).id);
  } else if (roll < 0.4) {
    port.failNext(new Error('quota'));
    coach.delivery(run.pid, { audio: 'completed' });
  } else if (roll < 0.5 && run.stored.length) {
    coach.exclude(run.stored[Math.floor(random() * run.stored.length)]);
  } else {
    return answerStep(ctx, run);
  }
  await tick();
  port.heal();
  return 0;
}

// 차례 하나 — 견준 답의 수를 낸다.
async function oneRun(ctx) {
  const { coach, time, random } = ctx;
  if (random() < 0.3) coach.startSet({ length: 6 });
  const run = { pid: coach.present(listening(items[1 + Math.floor(random() * 6)])), stored: [] };
  let compared = 0;
  for (let step = 0; step < 7; step += 1) {
    time.advance(1000);
    compared += await oneStep(ctx, run);
  }
  return compared;
}

test('마구 만든 차례 300개 — 답마다 저장 뒤 evidence.delivered가 그때 기록부를 접은 판단과 같다', async () => {
  const { foldEventsOfAll } = await subject('record/adapt.mjs');
  const map = fakeMap(items);
  const index = { edition: 'index-t', lookup: key => map.item(key) };
  let compared = 0;
  for (let round = 0; round < 10; round += 1) {
    const time = clock();
    const { coach, port } = await openCoach({ items, time });
    coach.recommend(items.slice(1), { set: { length: 6 } });
    const check = async (pid, eventId, delivered) => {
      const events = groupEvents(
        (await port.read()).map(row => row.value.event).filter(Boolean),
        pid,
      );
      const entries = events.map(event => ({ event, key: event.id, atMs: Date.parse(event.at) }));
      const fold = foldEventsOfAll(entries, index).find(
        one => one.kind === 'answer' && one.id === eventId,
      );
      assert.equal(delivered, fold.answer.assessable, `${round} · ${pid} · ${eventId}`);
    };
    for (let run = 0; run < 30; run += 1)
      compared += await oneRun({ coach, port, time, random: rng(9000 + round * 30 + run), check });
    coach.dispose();
  }
  assert.ok(compared >= 300, `견준 답이 적다(${compared})`);
});
