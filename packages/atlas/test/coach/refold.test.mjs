// 판 일지를 지금 거름으로 다시 접는다(단계 4 계정 길 끝 판 둘째 — 카본 E1 · E2 · E3 · GPT GE2). 판 상태(coach/session.mjs)가 기록부 ·
// 서버 접기(어댑터 foldEventsOf)와 같은 값을 들고, 보기가 아무것도 얹지 못하는 동안(waitAll — 일지를 판을 열 때의 사본에 다시 돌림)에도
// 같다: 제품이 「처음이 아니다」라고 한 제시의 장부 만남, 제외 · 저장 실패로 바뀐 앞 자식(전달 · 도움), 판의 낸 수.
// 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, fakeMap, memoryPort, PARAMS } from './support.mjs';

const { acquireHost, releaseHost } = await subject('coach/host.mjs');
const { createSession } = await subject('coach/session.mjs');
const { emptySummary, packSummary } = await subject('record/summary.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:refold-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
// 다음 쓰기 한 번만 실패하는 그릇(memoryPort의 failNext는 heal까지 모든 쓰기를 실패시킨다).
function onceFailing(port) {
  let armed = false;
  return {
    ...port,
    async append(values) {
      if (armed) {
        armed = false;
        throw new Error('quota');
      }
      return port.append(values);
    },
    arm() {
      armed = true;
    },
  };
}

// 판 하나 — waiting이면 보기가 아무것도 얹지 못하는 계정 저장소(판 묶음이 다른 요약), 아니면 손님 저장소.
async function sessionOn({ seed, tag, waiting = false }) {
  const items = bankOf(rng(seed));
  const time = clock();
  const port = onceFailing(memoryPort());
  if (waiting)
    await port.append([
      {
        kind: 'ack',
        acks: [],
        clamped: [],
        dropped: [],
        summary: packSummary(emptySummary('other-edition')),
      },
    ]);
  const map = fakeMap(items);
  const host = await acquireHost({
    key: keyOf(tag),
    port,
    params: PARAMS,
    now: time.now,
    map,
    ...(waiting ? { guest: false, account: `acct-${tag}`, revision: 1 } : { guest: true }),
  });
  const mapItem = product => {
    try {
      return map.item(product);
    } catch {
      return null;
    }
  };
  const session = createSession({ host, gameId: 'g', seed: 's', dayOffset: 0, mapItem });
  return {
    items,
    time,
    port,
    map,
    host,
    session,
    close() {
      session.dispose();
      releaseHost(host);
    },
  };
}

test('제품이 「처음이 아니다」라고 한 제시의 첫 답 — 판 안의 학습자 · 저장 전 보기가 기록부 접기처럼 장부 만남 뒤의 답으로 센다(카본 끝 판 둘째 E1)', async () => {
  const w = await sessionOn({ seed: 31, tag: 'prior-live' });
  const item = w.items[0];
  const { skillId, familyKey } = w.map.item(item);
  w.session.choose(w.items, { set: { length: 4 } });
  const pid = w.session.present(item, { firstExposure: false });
  w.time.advance(1000);
  const out = w.session.answer(pid, { correct: true, assessable: true });
  const before = w.host.view(); // 저장 전 — 호스트가 얹은 접기 사건
  const live = w.session.learner;
  assert.equal(await out.stored, true);
  await settle();
  const stored = w.host.view(); // 기록부 보기 — 저장된 사건을 어댑터로 접은 것
  assert.deepEqual(
    live.ability.get(skillId),
    stored.ability.get(skillId),
    '판 안의 능력 줄 = 기록부 접기',
  );
  assert.deepEqual(
    before.ability.get(skillId),
    stored.ability.get(skillId),
    '저장 전 보기 = 기록부 접기',
  );
  assert.equal(live.met.get(familyKey), stored.met.get(familyKey));
  assert.equal(
    stored.ability.get(skillId).n,
    0,
    '장부 만남 뒤의 답은 독립 근거가 아니다 — 능력 추정을 움직이지 않는다',
  );
  // 비교 — 「처음이다」인 제시의 첫 답은 능력 추정을 움직인다(같은 값이면 위 시험이 아무것도 가르지 못한다)
  const v = await sessionOn({ seed: 31, tag: 'prior-free' });
  v.session.choose(v.items, { set: { length: 4 } });
  const fresh = v.session.present(item, { firstExposure: true });
  v.time.advance(1000);
  await v.session.answer(fresh, { correct: true, assessable: true }).stored;
  assert.equal(v.host.view().ability.get(skillId).n, 1);
  w.close();
  v.close();
});

test('보기가 아무것도 얹지 못하는 동안 다시 세워도 장부 만남이 남는다 — 「처음이 아니다」인 제시의 첫 답은 다시 돌려도 장부 만남 뒤의 답(카본 끝 판 둘째 E1)', async () => {
  const w = await sessionOn({ seed: 32, tag: 'prior-wait', waiting: true });
  w.session.choose(w.items, { set: { length: 4 } });
  assert.equal(w.host.view().waitAll, true, '보기가 아무것도 얹지 못하는 동안');
  const item = w.items[0];
  const { skillId, familyKey } = w.map.item(item);
  const pid = w.session.present(item, { firstExposure: false });
  w.time.advance(1000);
  w.session.answer(pid, { correct: true, assessable: true });
  const live = {
    ability: w.session.learner.ability.get(skillId),
    met: w.session.learner.met.get(familyKey),
  };
  assert.equal(live.ability.n, 0, '판 안에서도 장부 만남 뒤의 답');
  w.session.rebuild();
  assert.deepEqual(
    w.session.learner.ability.get(skillId),
    live.ability,
    '다시 세워도 같은 능력 줄',
  );
  assert.equal(w.session.learner.met.get(familyKey), live.met, '같은 첫 만남');
  w.close();
});

test('제외한 전달 뒤의 답은 다시 세우면 판정 못 한 답이다 — 판 일지를 지금 거름으로 다시 접는다(GPT 끝 판 둘째 GE2)', async () => {
  const w = await sessionOn({ seed: 33, tag: 'delivery-excluded' });
  w.session.choose(w.items, { set: { length: 4 } });
  const item = w.items[0];
  const { units } = w.map.item(item);
  const pid = w.session.present({ ...item, audioRequired: true }, {});
  const sent = w.session.delivery(pid, { audio: 'completed' });
  assert.equal(await sent.stored, true);
  w.time.advance(1000);
  assert.equal(await w.session.answer(pid, { correct: false, assessable: true }).stored, true);
  const retried = () =>
    [...w.session.learner.session.retries.keys()].some(unit => units.includes(unit));
  assert.equal(
    w.session.learner.session.blank.has(item.itemKey),
    false,
    '소리를 다 들은 답은 판정한 답',
  );
  assert.equal(retried(), true, '놓친 답은 「다시」를 만든다');
  const exclusion = w.session.exclude(sent.event.id);
  assert.equal(await exclusion.stored, true);
  await settle();
  assert.equal(
    w.session.learner.session.blank.has(item.itemKey),
    true,
    '전달을 거두면 판정 못 한 답 — 이 판에서 다시 내지 않는다(기록부 · 서버 접기와 같게)',
  );
  assert.equal(retried(), false, '판정 못 한 답은 「다시」를 만들지 않는다');
  w.close();
});

test('앞 도움의 저장이 실패하면 다시 세울 때 그 뒤 도움이 첫 도움이다 — 보기가 못 얹는 동안에도 도움 만남이 남는다(카본 끝 판 둘째 E3)', async () => {
  const w = await sessionOn({ seed: 34, tag: 'help-second', waiting: true });
  w.session.choose(w.items, { set: { length: 4 } });
  const item = w.items[0];
  const family = w.map.item(item).familyKey;
  const pid = w.session.present(item, {});
  await settle();
  w.port.arm();
  const first = w.session.help(pid, 'hint'); // 저장이 실패한다
  const second = w.session.help(pid, 'explanation'); // 앞 도움이 실패를 알리기 전에 쓴다
  assert.equal(w.session.learner.met.has(family), true, '앞 도움의 만남');
  assert.equal(await first.stored, false);
  assert.equal(await second.stored, true);
  await settle();
  assert.equal(w.session.learner.met.has(family), true, '다시 세워도 뒤 도움의 만남이 남는다');
  w.close();
});

test('제외한 도움도 도움이다 — 판이 답을 접을 때 기록부처럼 도움을 본 답으로 센다(Fable 5.2 끝 판 둘째 넘친 #16)', async () => {
  const w = await sessionOn({ seed: 36, tag: 'help-excluded' });
  w.session.choose(w.items, { set: { length: 4 } });
  const item = w.items[0];
  const pid = w.session.present(item, {});
  const help = w.session.help(pid, 'hint');
  assert.equal(await help.stored, true);
  assert.equal(await w.session.exclude(help.event.id).stored, true);
  await settle();
  w.time.advance(1000);
  const out = w.session.answer(pid, { correct: true, assessable: true });
  assert.equal(
    out.fold.answer.assisted,
    true,
    '제외는 만났다는 사실을 지우지 않는다 — 기록부 어댑터처럼 도움을 본 답(혼자 맞힌 답이 아니다)',
  );
  assert.equal(await out.stored, true);
  w.close();
});

test('뒤 전달을 제외하면 그 뒤 소리는 「아직」이다 — 앞 전달의 소리로 판정한 답이 되지 않는다(Fable 5.2 끝 판 둘째 넘친 #16)', async () => {
  const w = await sessionOn({ seed: 37, tag: 'delivery-second' });
  w.session.choose(w.items, { set: { length: 4 } });
  const item = w.items[0];
  const pid = w.session.present({ ...item, audioRequired: true }, {});
  assert.equal(await w.session.delivery(pid, { audio: 'completed' }).stored, true);
  // WORLD 연습은 다시 듣기를 끝낼 때마다 다 들은 전달을 하나씩 더 쓴다
  const again = w.session.delivery(pid, { audio: 'completed' });
  assert.equal(await again.stored, true);
  assert.equal(await w.session.exclude(again.event.id).stored, true);
  await settle();
  w.time.advance(1000);
  const out = w.session.answer(pid, { correct: false, assessable: true });
  assert.equal(out.fold.answer.assessable, false, '기록부 어댑터처럼 판정 못 한 답');
  assert.equal(
    w.session.learner.session.blank.has(item.itemKey),
    true,
    '이 판에서 다시 내지 않는다',
  );
  w.close();
});

test('제외한 도움의 만남은 다시 세워도 남는다 — 보기가 못 얹는 동안에도(Fable 5.2 끝 판 둘째 넘친 #16)', async () => {
  const w = await sessionOn({ seed: 38, tag: 'help-excluded-wait', waiting: true });
  w.session.choose(w.items, { set: { length: 4 } });
  const item = w.items[0];
  const family = w.map.item(item).familyKey;
  const pid = w.session.present(item, {});
  const help = w.session.help(pid, 'hint');
  assert.equal(await help.stored, true);
  assert.equal(await w.session.exclude(help.event.id).stored, true);
  await settle();
  assert.equal(w.session.learner.met.has(family), true, '제외한 도움도 만남이다');
  w.close();
});

test('저장에 실패한 제시는 판의 낸 수에 들지 않는다 — 판 길이를 다 채우기 전에 새 판이 열리지 않는다(카본 끝 판 둘째 E2)', async () => {
  const w = await sessionOn({ seed: 35, tag: 'served' });
  const set = { length: 3 };
  // 문항마다 같은 set을 넘기는 제품처럼 — 고른 문항을 낸다
  const show = async (fail = false) => {
    const { rows, products } = w.session.choose(w.items, { set });
    if (fail) w.port.arm();
    const pid = w.session.present(products.get(rows[0].item.itemKey), {});
    await settle();
    await settle();
    return pid;
  };
  await show();
  const setId = w.session.setId;
  await show(true); // 저장에 실패한 제시
  await show();
  w.session.choose(w.items, { set });
  assert.equal(w.session.setId, setId, '저장된 제시는 둘 — 판 길이 셋을 다 채우기 전이라 같은 판');
  w.close();
});

test('첫 만남 측정은 기록 전체로 묶는다 — 옛 꼴 결정을 겨눈 제외가 그 결정의 제시 답을 거두면 그 답은 첫 혼자 답이 아니다(GPT 끝 판 둘째 GE1)', async () => {
  const { openTrail } = await subject('coach/record.mjs');
  const { createMemory } = await subject('memory/index.mjs');
  const port = memoryPort();
  const T = Date.UTC(2026, 10, 1, 1, 0, 0);
  const scope = { domain: 'LAB', workspace: 'learning', subject: 'device' };
  const at = m => new Date(T + m * 60_000).toISOString();
  const measure = {
    skillId: 'ko.reading.detail',
    modality: 'reading',
    difficulty: 1,
    familyKey: 'fq',
    audioRequired: false,
    confounded: false,
  };
  // 옛 꼴(옛 기기 기록에서 옮겨 온 것) — 결정 → 제시 → 혼자 맞힌 첫 답
  const decided = {
    schema: 1,
    id: 'd1',
    scope,
    at: at(0),
    recordedAt: at(0),
    type: 'decision.made',
  };
  const shown = {
    schema: 1,
    id: 'p1',
    scope,
    at: at(0),
    recordedAt: at(0),
    type: 'practice.presented',
    decisionId: 'd1',
    taskId: 't',
    taskVersion: 'v',
    itemKey: 'old-1',
    conceptIds: ['ko.reading.detail'],
    firstExposure: true,
    measure,
  };
  const answered = {
    schema: 1,
    id: 'a1',
    scope,
    at: at(1),
    recordedAt: at(1),
    type: 'practice.attempted',
    presentationId: 'p1',
    attemptNo: 1,
    verdict: 'correct',
    errorTags: [],
  };
  await port.append([decided, shown, answered].map(event => ({ kind: 'event', event })));
  const trail = await openTrail({
    port,
    revision: 0,
    guest: true,
    memory: createMemory(PARAMS),
    params: PARAMS,
    index: { edition: 'index-t', lookup: () => null },
    health: null,
    now: () => T + 3_600_000,
  });
  const firstAt = Date.parse(at(1));
  assert.equal(trail.leadAt('fq', firstAt)?.solo, true, '거두기 전에는 혼자 맞힌 첫 답');
  const made = trail.add('record.excluded', { targetId: 'd1' });
  assert.equal(await made.stored, true);
  const lead = trail.leadAt('fq', firstAt);
  assert.equal(lead?.id != null, true, '거둔 답도 만남으로 남는다');
  assert.equal(
    lead.solo,
    false,
    '옛 꼴 결정을 거두면 그 제시의 답도 거둔다 — 전체 접기와 같은 근거',
  );
});

test('저장에 실패한 복습 제시는 「이 판에서 돌아온 것을 냈다」에 들지 않는다(카본 끝 판 둘째 E2)', async () => {
  const w = await sessionOn({ seed: 36, tag: 'served-due' });
  const item = w.items[0];
  const units = new Set(w.map.item(item).units);
  const other = w.items.find(
    one => one !== item && !w.map.item(one).units.some(unit => units.has(unit)),
  );
  w.session.choose([item], { set: { length: 3 } });
  const pid = w.session.present(item, {});
  w.time.advance(1000);
  await w.session.answer(pid, { correct: true, assessable: true }).stored;
  w.session.close();
  w.time.advance(4 * 86_400_000); // 돌아올 때가 지났다
  const set = { length: 3 };
  w.session.choose([other], { set });
  w.session.present(other, {});
  await settle();
  const { rows } = w.session.choose([item], { set });
  assert.equal(rows[0].tier, 1, '돌아온 것');
  w.port.arm();
  w.session.present(item, {}); // 저장에 실패한 복습 제시
  await settle();
  await settle();
  const { facts } = w.session.choose(w.items, { set });
  assert.equal(facts.servedDue, false, '저장에 실패한 복습은 이 판에 낸 것이 아니다');
  w.close();
});
