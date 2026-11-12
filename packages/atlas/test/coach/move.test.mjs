// 손님 → 계정 옮기기의 다섯 걸음(단계 4 계획 §18-5-3 — src/coach/move.mjs · coach.guestRecords). 계정 코치가 손님 저장소를 옆으로(문서
// 호스트 없이) 열어 경계를 지난 것만 고르고, 옛 꼴은 제품의 옛 POST로 먼저, 2판은 계정 저장소에 그 판으로 덧붙인 뒤 옮김 표지를 쓴다.
// 어느 걸음이 실패하면 표지를 쓰지 않는다. 두 번 옮겨도 한 번이다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS, STEP } from './support.mjs';

const { installHostMaker } = await subject('coach/host.mjs');
const { storeName } = await subject('record/port.mjs');
const { UPLOAD_DELAY_MS } = await subject('coach/sync.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const origin = { origin: 'https://synk.test' };
// 시험마다 자기 창(등록부) — 손님 저장소 이름(synk-atlas:guest)이 시험끼리 겹치지 않게.
function topWindow() {
  const top = { location: origin, addEventListener() {}, removeEventListener() {} };
  top.parent = top;
  installHostMaker(top, { openPort: () => memoryPort() });
  return top;
}

function world(seed) {
  const items = bankOf(rng(seed), { items: 8 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(seed + 1), index: indexOfMap(map) });
  const route = {
    async post(events, since) {
      return server.post(events, since);
    },
    async get(since) {
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
  return { items, map, server, route, time: clock(), top: topWindow(), guestPort: memoryPort() };
}

const open = (w, host) =>
  createCoach({
    gameId: 'move',
    map: w.map,
    seed: 's',
    dayOffset: 0,
    scope: w.top,
    host: { now: w.time.now, ...host },
  });

async function practiseAsGuest(w, items) {
  const coach = open(w, { guest: true, key: storeName({}), port: w.guestPort });
  await coach.ready;
  for (const item of items) {
    const pid = coach.present(item);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    w.time.advance(STEP);
  }
  coach.dispose();
}

// 사건들이 그 포트에 실제로 들 때까지 — 제외는 저장 대기 수(pending — 답 · 본인 말)에 들지 않아, 기다리지 않으면 옮길 계획이
// 마지막 쓰기를 못 본다.
async function inPort(port, events) {
  const want = events.map(event => event.id);
  for (let i = 0; i < 400; i += 1) {
    const ids = new Set((await port.read()).map(row => row.value?.event?.id).filter(Boolean));
    if (want.every(id => ids.has(id))) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail(`포트에 들지 않았다: ${want.join(' · ')}`);
}

async function accountCoach(w, account, revision = 1) {
  const coach = open(w, {
    guest: false,
    account,
    revision,
    key: storeName({ account, revision }),
    port: memoryPort(),
    transport: w.route,
  });
  await coach.ready;
  return coach;
}

const answersOf = plan => plan.current.filter(event => event.type === 'practice.attempted');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// 옮긴 사건이 서버에 올라갔나 — 계정 호스트가 스스로 올리기를 잡는다(올리기 대기 1.5초, 다른 계기 없이).
async function uploaded(w, ids, waitMs = 5000) {
  for (let waited = 0; waited <= waitMs; waited += 100) {
    const have = new Set(w.server.server.log().map(row => row.event.id));
    if (ids.every(id => have.has(id))) return true;
    await sleep(100);
  }
  return false;
}
// 열 때 잡힌 올리기(대기 1.5초)가 지나간 뒤 — 그 뒤의 올리기는 옮기기가 잡은 것뿐이다.
async function settled(coach) {
  await coach.synced();
  await sleep(UPLOAD_DELAY_MS + 300);
}

test('손님 → A로 옮기고 로그아웃 → 손님 답 하나 → B에는 그 하나만 — 옮긴 것은 그 계정의 판으로 계정 저장소에 들고 올라간다', async () => {
  const w = world(21);
  await practiseAsGuest(w, w.items.slice(0, 2));
  const a = await accountCoach(w, 'A');
  await settled(a);
  const recs = await a.guestRecords({ port: w.guestPort });
  const before = await recs.plan();
  assert.equal(answersOf(before).length, 2, '물음의 수');
  const moved = await recs.move();
  assert.equal(moved.ok, true);
  assert.equal(moved.current, 4, '제시 둘 · 답 둘');
  assert.ok(
    await uploaded(
      w,
      before.current.map(event => event.id),
    ),
    '⑤ 옮긴 뒤 알리고 올린다 — 다른 계기 없이 서버에 간다',
  );
  assert.equal(answersOf(await recs.plan()).length, 0, '옮긴 뒤에는 다시 고르지 않는다');
  assert.deepEqual((await recs.move()).current, 0, '두 번 옮겨도 한 번');
  await recs.note('logout');
  recs.close();
  a.dispose();
  await practiseAsGuest(w, w.items.slice(2, 3));
  const b = await accountCoach(w, 'B');
  const recsB = await b.guestRecords({ port: w.guestPort });
  const plan = await recsB.plan();
  assert.equal(answersOf(plan).length, 1, 'B에는 로그아웃 뒤의 답 하나만');
  assert.ok(plan.current.every(event => event.revision === 1));
  recsB.close();
  b.dispose();
});

test('옛 꼴을 보내지 못하면 표지를 쓰지 않고 계정 저장소에도 덧붙이지 않는다 — 다음에 다시 고른다', async () => {
  const w = world(23);
  const at = new Date(w.time.now()).toISOString();
  // 옛 꼴(schema 1) 사건 하나 — 옮기기가 손님 저장소에 들이고, 옮길 계획의 옛 꼴 몫이 된다.
  const legacyEvent = {
    schema: 1,
    id: 'legacy-p1',
    scope: { domain: 'LAB', workspace: 'learning', subject: 'device' },
    at,
    recordedAt: at,
    type: 'practice.presented',
  };
  await practiseAsGuest(w, w.items.slice(0, 1));
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({
    port: w.guestPort,
    legacy: () => ({ log: [legacyEvent], ledger: null }),
  });
  const plan = await recs.plan();
  assert.deepEqual(
    plan.legacy.map(event => event.id),
    ['legacy-p1'],
    '옛 꼴은 옛 POST 몫',
  );
  const failed = await recs.move({ postLegacy: async () => false });
  assert.equal(failed.ok, false);
  assert.equal(failed.step, 'legacy');
  assert.equal(answersOf(await recs.plan()).length, 1, '표지를 쓰지 않았다 — 다시 고른다');
  const sent = [];
  const done = await recs.move({ postLegacy: async events => (sent.push(...events), true) });
  assert.equal(done.ok, true);
  assert.ok(sent.length >= 1, '옛 꼴은 옛 POST로');
  assert.deepEqual(
    (await recs.plan()).legacy,
    [],
    '보낸 옛 꼴은 다시 고르지 않는다(열쇠 경계 — C1)',
  );
  // 보낸 옛 꼴 답을 겨눈 2판 제외는 다음 옮기기에서 A로 간다 — 옮김 표지 ids에 옛 꼴 번호도 실었다(GPT 다시 GA2)
  const guest = open(w, { guest: true, key: storeName({}), port: w.guestPort });
  await guest.ready;
  const excluded = guest.exclude('legacy-p1');
  await inPort(w.guestPort, [excluded]);
  guest.dispose();
  const next = await recs.plan();
  assert.deepEqual(
    next.current.map(event => event.id),
    [excluded.id],
    '옛 꼴 대상을 겨눈 제외도 따라간다',
  );
  recs.close();
  a.dispose();
});

test('옛 POST가 고른 것만 보냈으면(ok · ids) 그 번호만 옮김 표지에 — 보내지 않은 옛 꼴을 겨눈 제외는 따라가지 않는다(GPT 다시 GA2)', async () => {
  const w = world(24);
  const at = new Date(w.time.now()).toISOString();
  const legacy = id => ({
    schema: 1,
    id,
    scope: { domain: 'LAB', workspace: 'learning', subject: 'device' },
    at,
    recordedAt: at,
    type: 'practice.presented',
  });
  await practiseAsGuest(w, w.items.slice(0, 1));
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({
    port: w.guestPort,
    legacy: () => ({ log: [legacy('legacy-sent'), legacy('legacy-kept')], ledger: null }),
  });
  const done = await recs.move({ postLegacy: async () => ({ ok: true, ids: ['legacy-sent'] }) });
  assert.equal(done.ok, true);
  const guest = open(w, { guest: true, key: storeName({}), port: w.guestPort });
  await guest.ready;
  const sentDrop = guest.exclude('legacy-sent');
  const keptDrop = guest.exclude('legacy-kept');
  await inPort(w.guestPort, [sentDrop, keptDrop]);
  guest.dispose();
  assert.ok(keptDrop.id, '보내지 않은 옛 꼴을 겨눈 제외도 손님 저장소에는 든다');
  assert.deepEqual(
    (await recs.plan()).current.map(event => event.id),
    [sentDrop.id],
    '보낸 것을 겨눈 제외만',
  );
  const refused = await recs.move({ postLegacy: async () => ({ ok: false, ids: [] }) });
  assert.equal(refused.ok, true, '옛 꼴이 남지 않았으면 옛 POST를 부르지 않는다');
  recs.close();
  a.dispose();
});

test('손님 저장소가 없으면 만들지 않는다(create: false) — 손님 코치에는 옮길 계정이 없다', async () => {
  const w = world(25);
  const a = await accountCoach(w, 'A');
  assert.equal(await a.guestRecords({ create: false }), null);
  const guest = open(w, { guest: true, key: storeName({}), port: w.guestPort });
  await guest.ready;
  await assert.rejects(guest.guestRecords(), { code: 'GUEST' });
  guest.dispose();
  // 옆으로 연 손님 저장소는 문서 호스트가 되지 않는다 — 계정 코치가 닫혀도 틀이 손님 저장소를 받지 않게(R7).
  const recs = await a.guestRecords({ port: w.guestPort });
  a.dispose();
  assert.equal(w.top.__synkAtlasHosts.document ?? null, null);
  recs.close();
});

test('표지를 못 쓰면 다음 옮기기가 다시 고르지만 계정 저장소에는 한 번만 들고, 든 것은 그때 알리고 올린다(§18-5-3 ③ · ④ · ⑤)', async () => {
  const w = world(27);
  await practiseAsGuest(w, w.items.slice(0, 2));
  const a = await accountCoach(w, 'A');
  const append = w.guestPort.append;
  let failMark = true;
  w.guestPort.append = async values => {
    if (failMark && values.some(value => value.kind === 'mark')) {
      failMark = false;
      throw new Error('표지 쓰기 실패');
    }
    return append.call(w.guestPort, values);
  };
  await settled(a);
  const recs = await a.guestRecords({ port: w.guestPort });
  const before = await recs.plan();
  await assert.rejects(recs.move(), /표지 쓰기 실패/);
  assert.ok(
    await uploaded(
      w,
      before.current.map(event => event.id),
    ),
    '표지를 못 썼어도 계정 저장소에 든 것은 알리고 올린다',
  );
  assert.equal(answersOf(await recs.plan()).length, 2, '표지가 없으니 다시 고른다');
  const again = await recs.move();
  assert.equal(again.ok, true);
  assert.equal(again.current, 0, '이미 든 번호는 덧붙이지 않는다');
  assert.equal(answersOf(await recs.plan()).length, 0);
  recs.close();
  a.dispose();
});

test('옮긴 뒤 다른 탭의 손님 코치가 같은 제시에 이어 낸 답은 다음 옮기기에 그 계정으로 가서 올라간다(GPT 끝 판 GE1 · 카본 E1 — 옮김 표지의 ids)', async () => {
  const w = world(29);
  // 다른 탭 — 제 등록부(창)로 같은 손님 저장소를 연다.
  const guest = open(
    { ...w, top: topWindow() },
    { guest: true, key: storeName({}), port: w.guestPort },
  );
  await guest.ready;
  const pid = guest.present(w.items[0]);
  assert.equal(await guest.answer(pid, { correct: false, assessable: true }).stored, true);
  w.time.advance(STEP);
  const a = await accountCoach(w, 'A');
  await settled(a);
  const recs = await a.guestRecords({ port: w.guestPort });
  const first = await recs.plan();
  assert.equal((await recs.move()).current, 2, '제시와 첫 답');
  assert.ok(
    await uploaded(
      w,
      first.current.map(event => event.id),
    ),
  );
  const marks = (await w.guestPort.read()).filter(row => row.value.kind === 'mark');
  assert.deepEqual(
    marks.map(row => [...row.value.ids].sort()),
    [first.current.map(event => event.id).sort()],
    '옮김 표지에 옮긴 번호를 적는다',
  );
  w.time.advance(STEP);
  assert.equal(await guest.answer(pid, { correct: true, assessable: true }).stored, true);
  const plan = await recs.plan();
  assert.deepEqual(
    answersOf(plan).map(event => event.attemptNo),
    [2],
    '옮긴 제시의 둘째 답만 고른다(제시는 다시 가지 않는다)',
  );
  assert.equal((await recs.move()).current, 1);
  assert.ok(
    await uploaded(
      w,
      plan.current.map(event => event.id),
    ),
    '서버가 받는다 — 제시 · 첫 답이 먼저 올라가 있다',
  );
  assert.equal(answersOf(await recs.plan()).length, 0, '그 뒤에는 다시 고르지 않는다');
  recs.close();
  a.dispose();
  guest.dispose();
});

test('닫은 손잡이 · 닫은 코치에서는 옮기지 않고, 손님 기록을 여는 사이 코치를 닫으면 옆으로 연 것도 놓는다(카본 끝 판 C)', async () => {
  const w = world(41);
  await practiseAsGuest(w, w.items.slice(0, 1));
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort });
  recs.close();
  await assert.rejects(recs.plan(), { code: 'CLOSED' });
  await assert.rejects(recs.move(), { code: 'CLOSED' });
  await assert.rejects(recs.note('visited'), { code: 'CLOSED' });
  const again = await a.guestRecords({ port: w.guestPort });
  a.dispose();
  await assert.rejects(
    again.keep(),
    { code: 'DISPOSED' },
    '닫은 코치(옛 판 · 닫힌 계정 호스트)로 옮기지 않는다',
  );
  await assert.rejects(again.move(), { code: 'DISPOSED' });
  again.close();
  // 여는 사이 닫으면 옆으로 연 손님 호스트를 놓고 DISPOSED
  const b = await accountCoach(w, 'B');
  const opening = b.guestRecords({ port: w.guestPort });
  b.dispose();
  await assert.rejects(opening, { code: 'DISPOSED' });
  await sleep(0);
  assert.equal(w.top.__synkAtlasHosts.has(storeName({})), false, '손님 저장소 자리가 남지 않는다');
});
