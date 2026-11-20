// 코치 reset() — 연습 기록 비우기의 길 셋(단계 4 계획 §22-4): 손님(이 기기의 손님 기록 전부), 올리는 계정(올리기를 먼저 다 하고 서버를
// 비운 뒤 손님 저장소에서 그 계정으로 옮긴 사건을 지운다), 기기 길 계정(입구가 준 서버 비우기). 옛 기록 옮기기의 바닥 · 옮긴 번호 · 옮긴 장부
// 칸도 본다. 「비우는 중」 표지 · 본인 값 옮기기 · 앞 판 쓸기 · 다시 정하기는 입구(WORLD world-atlas-next.mjs)의 몫이라 여기서 보지 않는다.
// 규칙마다 tools/mutants/me.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, STEP } from './support.mjs';

const { installHostMaker } = await subject('coach/host.mjs');
const { storeName } = await subject('record/port.mjs');
const { resetAccount } = await subject('coach/reset.mjs');
const { createFlowMemory, FLOW_MEMORY_PREFIX } = await subject('coach/flow-memory.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const origin = { origin: 'https://synk.test' };
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
  const calls = [];
  const route = {
    async post(events, since) {
      calls.push('post');
      return server.post(events, since);
    },
    async get(since) {
      return { summary: await server.summary(since), serverTime: server.now };
    },
    // 서버 비우기 — 기본은 판을 올린 답. 시험마다 바꾼다.
    clear: async () => {
      calls.push('clear');
      return { ok: true, revision: 2 };
    },
  };
  return {
    items,
    map,
    server,
    route,
    calls,
    time: clock(),
    top: topWindow(),
    guestPort: memoryPort(),
  };
}

const open = (w, host) =>
  createCoach({
    gameId: 'reset',
    map: w.map,
    seed: 's',
    dayOffset: 0,
    scope: w.top,
    host: { now: w.time.now, ...host },
  });

const at = w => new Date(w.time.now()).toISOString();
const legacyEvent = (w, id) => ({
  schema: 1,
  id,
  scope: { domain: 'LAB', workspace: 'learning', subject: 'device' },
  at: at(w),
  recordedAt: at(w),
  type: 'practice.presented',
});
const ledgerOf = families => ({
  keys: Object.fromEntries(families.map(family => [`family:${family}`, 1])),
  cells: {},
});

async function guestCoach(w, legacy = null) {
  const coach = open(w, { guest: true, key: storeName({}), port: w.guestPort, legacy });
  await coach.ready;
  return coach;
}
async function practise(w, coach, items) {
  for (const item of items) {
    const pid = coach.present(item);
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    w.time.advance(STEP);
  }
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
// 요약 사본(local)은 뒤에서 저장되어 차례가 섞인다 — 빼고 본다.
const kinds = async port =>
  (await port.read()).map(row => row.value.kind).filter(kind => kind !== 'local');
const lastCleared = async port =>
  (await port.read()).filter(row => row.value.kind === 'cleared').at(-1)?.value ?? null;
const heldIds = async port =>
  (await port.read()).filter(row => row.value.kind === 'event').map(row => row.value.event.id);

test('손님 — 손님 저장소를 비우고 옛 엔진 기록도 비운다. 옛 엔진 비우기가 되면 바닥을 거둔다', async () => {
  const w = world(41);
  const coach = await guestCoach(w);
  await practise(w, coach, w.items.slice(0, 2));
  let wiped = 0;
  let epoch = 'e1';
  const done = await coach.reset({
    legacy: {
      // 옛 엔진 reset은 빈 로그와 새 epoch을 쓴다.
      read: () => ({ log: wiped ? [] : [legacyEvent(w, 'old-1')], ledger: null, epoch }),
      clear: async () => {
        wiped += 1;
        epoch = 'e2';
      },
    },
  });
  assert.deepEqual(done, { ok: true, path: 'guest', gen: 1, legacy: 'cleared' });
  assert.equal(wiped, 1);
  assert.deepEqual(
    await kinds(w.guestPort),
    ['gen', 'cleared', 'cleared'],
    '사건이 하나도 남지 않고, 바닥을 거둔 같은 세대의 표지가 뒤에 선다',
  );
  const cleared = await lastCleared(w.guestPort);
  assert.equal(cleared.legacy, null, '옛 엔진을 비웠으니 바닥이 필요 없다');
  coach.dispose();
});

test('손님 — 비우면 순간 맞춤 내용 기억도 비운 뒤의 세대로 비운다. 표지는 record.clear() 바로 뒤, 옛 엔진 비우기보다 먼저 선다(§23-13 · 설계 관문 검토 M1)', async () => {
  const w = world(47);
  const map = new Map();
  const storage = {
    getItem: name => (map.has(name) ? map.get(name) : null),
    setItem: (name, value) => map.set(name, String(value)),
    removeItem: name => map.delete(name),
  };
  const store = storeName({});
  const coach = open(w, { guest: true, key: store, port: w.guestPort, prefs: { storage } });
  await coach.ready;
  const base = `${FLOW_MEMORY_PREFIX}${store}`;
  storage.setItem(
    base,
    JSON.stringify({ v: 1, gen: 0, seeded: true, contents: { a: { at: 'x' } }, declined: {} }),
  );
  let marked = null;
  const done = await coach.reset({
    legacy: {
      read: () => ({ log: [], ledger: null, epoch: marked === null ? 'e1' : 'e2' }),
      // 옛 엔진 비우기(기다리는 걸음) 때는 표지가 이미 서 있다.
      clear: async () => {
        marked = storage.getItem(`${base}@1`);
      },
    },
  });
  assert.deepEqual(done, { ok: true, path: 'guest', gen: 1, legacy: 'cleared' });
  assert.ok(marked, '옛 엔진 비우기 전에 순간 맞춤 표지가 서지 않았다');
  assert.equal(JSON.parse(marked).seeded, true);
  const after = createFlowMemory({ storage, store, generation: () => 1 });
  assert.equal(after.memory('a'), null, '비운 뒤에 비우기 전 기억을 읽었다');
  const stale = createFlowMemory({ storage, store, generation: () => 0 });
  assert.equal(stale.memory('a'), null, '비운 것을 모르는 탭이 비우기 전 기억을 읽었다');
  coach.dispose();
});

test('손님 — 비우기 트랜잭션이 커밋된 뒤 다시 읽기만 실패해도 비우기는 된 것이다. 옛 엔진 비우기까지 하고, 다음 읽기가 메모리 사본을 맞춘다(4-5 코드 검수 GPT GB5)', async () => {
  const w = world(47);
  const base = w.guestPort;
  let failRead = false;
  w.guestPort = {
    ...base,
    async read() {
      if (failRead) {
        failRead = false;
        throw Object.assign(new Error('읽기 실패'), { code: 'STORAGE_FAILED' });
      }
      return base.read();
    },
    async swap(options) {
      const keys = await base.swap(options);
      failRead = true; // 커밋 바로 뒤의 다시 읽기만 실패한다
      return keys;
    },
  };
  const coach = await guestCoach(w);
  await practise(w, coach, w.items.slice(0, 2));
  let wiped = 0;
  let epoch = 'e1';
  const done = await coach.reset({
    legacy: {
      read: () => ({ log: wiped ? [] : [legacyEvent(w, 'old-1')], ledger: null, epoch }),
      clear: async () => {
        wiped += 1;
        epoch = 'e2';
      },
    },
  });
  assert.deepEqual(
    [done.ok, done.path, done.legacy],
    [true, 'guest', 'cleared'],
    '비우기는 됐다 — 저장소 실패로 알리지 않는다',
  );
  assert.equal(wiped, 1, '옛 엔진 비우기까지 한다');
  assert.deepEqual(await heldIds(base), [], '새 길 저장소는 비었다');
  assert.deepEqual(coach.summary().units, [], '다음 읽기가 메모리 사본을 맞췄다');
  coach.dispose();
});

test('손님 — 옛 엔진이 바쁘면(STORAGE_BUSY) 일부만 비움으로 알리고 바닥을 둔다. 바닥은 옛 로그의 그때 기록이 다시 들어오지 못하게 막는다', async () => {
  const w = world(42);
  const old = { log: [legacyEvent(w, 'old-1')], ledger: ledgerOf(['t.f0']), epoch: 'e1' };
  const coach = await guestCoach(w, () => old);
  assert.ok((await heldIds(w.guestPort)).includes('old-1'), '열 때 옛 기록을 옮겨 왔다');
  const done = await coach.reset({
    legacy: {
      read: () => old,
      clear: async () => {
        throw Object.assign(new Error('busy'), { code: 'STORAGE_BUSY' });
      },
    },
  });
  assert.equal(done.ok, true);
  assert.equal(done.legacy, 'busy', '일부만 비움 — 입구가 알린다');
  coach.dispose();
  // 다시 열면 옛 기록 옮기기가 돈다 — 같은 epoch의 옛 로그는 바닥 뒤의 사건만, 장부는 옮기지 않는다.
  w.time.advance(STEP);
  old.log = [...old.log, legacyEvent(w, 'old-2')];
  const again = await guestCoach(w, () => old);
  assert.deepEqual(
    await heldIds(w.guestPort),
    ['old-2'],
    '비우기 전의 옛 사건과 장부는 되살아나지 않는다',
  );
  again.dispose();
  // 옛 엔진이 나중에 비워져 epoch이 바뀌면 그 뒤 옛 로그는 모두 새것이다.
  const fresh = { log: [legacyEvent(w, 'old-3')], ledger: ledgerOf(['t.f1']), epoch: 'e2' };
  const third = await guestCoach(w, () => fresh);
  const ids = await heldIds(w.guestPort);
  assert.ok(ids.includes('old-3'));
  assert.ok(
    (await w.guestPort.read()).some(row => row.value.event?.type === 'record.carried'),
    'epoch이 다르면 장부도 옮긴다',
  );
  third.dispose();
});

test('손님 — epoch을 모르는 바닥(옛 로그를 못 읽음)은 같은 옛 로그로 본다. 옛 로그가 아예 없으면 바닥을 두지 않는다', async () => {
  const w = world(43);
  const coach = await guestCoach(w);
  const blind = await coach.reset({
    legacy: {
      read: () => {
        throw new Error('broken');
      },
      clear: async () => {
        throw Object.assign(new Error('err'), { code: 'STORAGE_ERROR' });
      },
    },
  });
  assert.equal(blind.legacy, 'failed');
  const floor = (await lastCleared(w.guestPort)).legacy;
  assert.equal(floor.epoch, null, 'epoch을 모르면 비워 둔다');
  coach.dispose();
  // epoch을 모르는 바닥은 어떤 옛 로그든 같은 로그로 본다 — 바닥 앞의 옛 사건과 장부는 되살아나지 않고, 바닥 뒤 사건만 들어온다.
  const before = legacyEvent(w, 'old-before');
  w.time.advance(STEP);
  const afterFloor = legacyEvent(w, 'old-after');
  const reopened = await guestCoach(w, () => ({
    log: [before, afterFloor],
    ledger: ledgerOf(['t.f0']),
    epoch: 'e7',
  }));
  assert.deepEqual(await heldIds(w.guestPort), ['old-after']);
  assert.ok(
    !(await w.guestPort.read()).some(row => row.value.event?.type === 'record.carried'),
    '장부는 옮기지 않는다',
  );
  reopened.dispose();
  const w2 = world(44);
  const bare = await guestCoach(w2);
  const none = await bare.reset({ legacy: { read: () => null, clear: async () => {} } });
  assert.equal(none.legacy, 'none');
  assert.equal((await lastCleared(w2.guestPort)).legacy, null, '옛 로그가 없으면 바닥이 없다');
  bare.dispose();
});

test('올리는 계정 — 아직 안 올린 답을 먼저 다 올리고 서버를 비운 뒤, 손님 저장소에서 그 계정으로 옮긴 사건을 지운다', async () => {
  const w = world(45);
  const guest = await guestCoach(w);
  await practise(w, guest, w.items.slice(0, 2));
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort });
  assert.equal((await recs.move()).ok, true);
  recs.close();
  const pid = a.present(w.items[3]);
  const answered = a.answer(pid, { correct: true, assessable: true });
  let seenAtClear = null;
  w.route.clear = async () => {
    seenAtClear = new Set(w.server.server.log().map(row => row.event.id));
    return { ok: true, revision: 2 };
  };
  const done = await a.reset({
    guestPort: w.guestPort,
    legacy: { read: () => null, clear: async () => {} },
  });
  assert.equal(done.ok, true);
  assert.equal(done.path, 'upload');
  assert.equal(done.revision, 2, '서버가 올린 새 판');
  assert.ok(seenAtClear.has(answered.eventId), '비우기 전에 대기열을 다 올렸다(숙제 답이 남게)');
  assert.equal(done.guest.dropped, 4, '옮긴 제시 둘 · 답 둘');
  assert.equal(done.guest.legacy, 'none');
  assert.deepEqual(
    await heldIds(w.guestPort),
    [],
    '손님 저장소에서 그 계정으로 옮긴 사건이 지워졌다',
  );
  a.dispose();
});

test('올리는 계정 — 올리기가 안 되면 서버를 부르지 않고 아무것도 지우지 않는다(결과를 안다)', async () => {
  const w = world(46);
  const a = await accountCoach(w, 'A');
  w.route.post = async () => {
    throw Object.assign(new Error('offline'), { code: 'NETWORK' });
  };
  const pid = a.present(w.items[0]);
  await a.answer(pid, { correct: true, assessable: true }).stored;
  const done = await a.reset({ guestPort: w.guestPort });
  assert.equal(done.ok, false);
  assert.equal(done.step, 'upload');
  assert.equal(done.known, true, '서버에 비우기를 보내지 않았다');
  assert.ok(!w.calls.includes('clear'));
  a.dispose();
});

test('올리는 계정의 0 걸음 — 기록부를 다시 읽다 저장소가 실패하면 서버를 부르지 않고 결과를 아는 실패로 돌려준다(4-5 코드 다시 검수 GPT GA3)', async () => {
  const w = world(57);
  const base = memoryPort();
  let failRange = false;
  const port = {
    ...base,
    async range(afterKey) {
      if (failRange) throw Object.assign(new Error('읽기 실패'), { code: 'STORAGE_FAILED' });
      return base.range(afterKey);
    },
  };
  const a = open(w, {
    guest: false,
    account: 'A',
    revision: 1,
    key: storeName({ account: 'A', revision: 1 }),
    port,
    transport: w.route,
  });
  await a.ready;
  const pid = a.present(w.items[0]);
  await a.answer(pid, { correct: true, assessable: true }).stored;
  failRange = true;
  const done = await a.reset({ guestPort: w.guestPort });
  failRange = false;
  assert.equal(done.ok, false);
  assert.equal(done.step, 'upload');
  assert.equal(done.code, 'STORAGE_FAILED');
  assert.equal(
    done.known,
    true,
    '서버에 비우기를 보내지 않았다 — 입구가 「비우는 중」 표지를 지운다',
  );
  assert.ok(!w.calls.includes('clear'));
  a.dispose();
});

test('올리는 계정 — 서버가 받지 않으면(409) 결과를 알고, 닿지 못하면 결과를 모른다', async () => {
  const w = world(47);
  const a = await accountCoach(w, 'A');
  w.route.clear = async () => {
    throw Object.assign(new Error('conflict'), {
      status: 409,
      code: 'REVISION_CONFLICT',
      revision: 3,
    });
  };
  const refused = await a.reset({ guestPort: w.guestPort });
  assert.deepEqual(
    { ok: refused.ok, step: refused.step, code: refused.code, known: refused.known },
    { ok: false, step: 'clear', code: 'REVISION_CONFLICT', known: true },
  );
  w.route.clear = async () => {
    throw Object.assign(new Error('timeout'), { code: 'NETWORK' });
  };
  const lost = await a.reset({ guestPort: w.guestPort });
  assert.equal(lost.known, false, '늦게 끝나는 요청이 있을 수 있다 — 입구는 표지를 남긴다');
  w.route.clear = async () => ({ ok: true });
  const odd = await a.reset({ guestPort: w.guestPort });
  assert.equal(odd.ok, false, '새 판이 없는 답은 비웠다고 보지 않는다');
  assert.equal(odd.known, false);
  a.dispose();
});

test('올리는 계정의 4b — 옛 손님 로그가 모두 그 계정으로 옮긴 것이면 옛 엔진을 비운다. 섞였으면 두고 알려진 한계로 둔다', async () => {
  const w = world(48);
  const old = { log: [legacyEvent(w, 'old-1')], ledger: null, epoch: 'e1' };
  const guest = await guestCoach(w, () => old);
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  let wiped = 0;
  let now = old;
  const all = await a.reset({
    guestPort: w.guestPort,
    legacy: {
      read: () => now,
      clear: async () => {
        wiped += 1;
        now = { log: [], ledger: null, epoch: 'e2' };
      },
    },
  });
  assert.equal(all.guest.legacy, 'cleared');
  assert.equal(wiped, 1);
  a.dispose();
  // 로그아웃 뒤 손님 사건이 섞인 옛 로그는 건드리지 않는다.
  const w2 = world(49);
  const mixed = {
    log: [legacyEvent(w2, 'old-1'), legacyEvent(w2, 'old-after')],
    ledger: null,
    epoch: 'e1',
  };
  const b = await accountCoach(w2, 'B');
  const recsB = await b.guestRecords({
    port: w2.guestPort,
    legacy: () => ({ ...mixed, log: mixed.log.slice(0, 1) }),
  });
  assert.equal(
    (await recsB.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recsB.close();
  let touched = 0;
  const kept = await b.reset({
    guestPort: w2.guestPort,
    legacy: { read: () => mixed, clear: async () => (touched += 1) },
  });
  assert.equal(kept.guest.legacy, 'kept');
  assert.equal(touched, 0);
  b.dispose();
  // 남은 옛 로그를 다시 읽어도 그 계정으로 옮겼다가 지운 사건은 되살아나지 않는다(옮김 표지의 번호 — 카본새1 · Fable새1). 로그아웃 뒤 사건은 남는다.
  const again = await guestCoach(w2, () => mixed);
  assert.deepEqual(await heldIds(w2.guestPort), ['old-after']);
  again.dispose();
});

test('올리는 계정의 넷째 걸음 — 옮긴 「옮겨 오기 전 기록」을 지워도 같은 옛 장부가 새 번호로 다시 들지 않고, 그 뒤 새로 접힌 칸만 옮긴다(Fable -c FA1)', async () => {
  const w = world(51);
  // 옛 로그에 이 계정으로 옮기지 않은 사건(로그아웃 뒤 손님의 것)이 있어 4b가 서지 않는 기기 — 옛 엔진 기록과 그 장부가 그대로 남는다.
  const old = {
    log: [legacyEvent(w, 'old-guest')],
    ledger: ledgerOf(['t.f0', 't.f1']),
    epoch: 'e1',
  };
  const guest = await guestCoach(w, () => old);
  guest.dispose();
  const carried = async () =>
    (await w.guestPort.read()).filter(row => row.value.event?.type === 'record.carried');
  assert.equal((await carried()).length, 1, '열 때 장부를 옮겨 왔다');
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal((await recs.move({ postLegacy: async () => ({ ok: true, ids: [] }) })).ok, true);
  recs.close();
  const done = await a.reset({
    guestPort: w.guestPort,
    legacy: { read: () => old, clear: async () => {} },
  });
  assert.equal(done.guest.dropped, 1, '옮긴 장부 사건을 지웠다');
  assert.equal(done.guest.legacy, 'kept', '옮기지 않은 옛 사건이 섞여 옛 로그는 둔다');
  assert.deepEqual((await lastCleared(w.guestPort)).carried?.families, ['t.f0', 't.f1']);
  a.dispose();
  // 옛 엔진이 그 장부를 그대로 들고 있어도(같은 epoch) 다시 들지 않는다. 로그아웃 뒤 새로 접힌 칸만 옮긴다.
  const grown = { ...old, ledger: ledgerOf(['t.f0', 't.f1', 't.f2']) };
  const reopened = await guestCoach(w, () => grown);
  const rows = await carried();
  assert.equal(rows.length, 1, '새 칸 하나만 담은 장부');
  assert.deepEqual(Object.keys(rows[0].value.event.families), ['t.f2']);
  reopened.dispose();
});

test('옛 엔진 비우기를 확인하지 못하면(비우기 문은 끝났는데 epoch이 그대로) 일부만 비움이고 바닥과 옮긴 장부 칸을 거두지 않는다 — 손님 · 계정 4b(설계 주인 11-18 승인 조건)', async () => {
  const w = world(52);
  const old = { log: [legacyEvent(w, 'old-1')], ledger: ledgerOf(['t.f0']), epoch: 'e1' };
  const coach = await guestCoach(w, () => old);
  const done = await coach.reset({ legacy: { read: () => old, clear: async () => {} } });
  assert.equal(done.legacy, 'failed', '새 epoch을 못 봤다 — 일부만 비움');
  assert.equal((await lastCleared(w.guestPort)).legacy?.epoch, 'e1', '바닥을 둔다');
  coach.dispose();
  // 다시 읽지 못해도 확인하지 못한 것이다.
  const w1 = world(54);
  const coach1 = await guestCoach(w1, () => old);
  let reads = 0;
  const unread = await coach1.reset({
    legacy: {
      read: () => {
        reads += 1;
        if (reads > 1) throw new Error('읽지 못함');
        return old;
      },
      clear: async () => {},
    },
  });
  assert.equal(unread.legacy, 'failed');
  assert.equal((await lastCleared(w1.guestPort)).legacy?.epoch, 'e1');
  coach1.dispose();
  // 계정 4b — 모두 옮긴 옛 로그. 옮긴 장부 칸(cleared.carried)을 남긴다.
  const w2 = world(53);
  const old2 = { log: [legacyEvent(w2, 'old-1')], ledger: ledgerOf(['t.f0']), epoch: 'e1' };
  const guest = await guestCoach(w2, () => old2);
  guest.dispose();
  const a = await accountCoach(w2, 'A');
  const recs = await a.guestRecords({ port: w2.guestPort, legacy: () => old2 });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  const same = await a.reset({
    guestPort: w2.guestPort,
    legacy: { read: () => old2, clear: async () => {} },
  });
  assert.equal(same.guest.legacy, 'failed');
  assert.deepEqual(
    (await lastCleared(w2.guestPort)).carried?.families,
    ['t.f0'],
    '옮긴 장부 칸을 남긴다',
  );
  a.dispose();
});

test('다른 탭의 은퇴 알림 — 손님 저장소를 다른 탭이 비우면 이 탭의 늦은 답은 저장되지 않고, 셸에 저장소를 비웠다고 한 번 알린다', async () => {
  const w = world(52);
  const told = [];
  const mine = open(w, {
    guest: true,
    key: storeName({}),
    port: w.guestPort,
    onAccount: detail => told.push(detail),
  });
  await mine.ready;
  const pid = mine.present(w.items[0]);
  // 다른 탭 — 같은 저장소를 다른 창(등록부)에서 연다.
  const other = createCoach({
    gameId: 'reset',
    map: w.map,
    seed: 's',
    dayOffset: 0,
    scope: topWindow(),
    host: { now: w.time.now, guest: true, key: storeName({}), port: w.guestPort },
  });
  await other.ready;
  assert.equal((await other.reset({})).ok, true);
  const late = mine.answer(pid, { correct: true, assessable: true });
  assert.equal(await late.stored, false, '지워진 제시에 답을 이어 쓰지 않는다');
  assert.deepEqual(
    told.map(detail => [detail.kind, detail.code]),
    [['store', 'STORE_CLEARED']],
    '셸이 이 탭의 코치를 은퇴시키고 다시 정한다',
  );
  other.dispose();
  mine.dispose();
});

test('기기 길 계정 — 입구가 준 서버 비우기로 판을 올리고, 닿지 못하면 아무것도 지우지 않는다', async () => {
  const w = world(50);
  // 그 계정으로 옮긴 손님 기록 — 비우기가 되면 넷째 걸음이 지우고, 닿지 못하면 그대로다(4-5 끝 판 Fable F5 — 이름의 뒷절을 단언한다).
  const g = await guestCoach(w);
  await practise(w, g, w.items.slice(0, 1));
  g.dispose();
  const up = await accountCoach(w, 'L');
  const recs = await up.guestRecords({ port: w.guestPort });
  assert.equal((await recs.move()).ok, true);
  recs.close();
  up.dispose();
  const moved = await heldIds(w.guestPort);
  assert.ok(moved.length >= 2, '옮긴 제시와 답이 손님 저장소에 있다');
  const local = open(w, {
    guest: true,
    account: 'L',
    revision: 1,
    key: storeName({ account: 'L', revision: 1, local: true }),
    port: memoryPort(),
  });
  await local.ready;
  const missing = await local.reset({ guestPort: w.guestPort });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, 'NO_CLEAR', '서버 비우기를 받지 않으면 비우지 않는다');
  const offline = await local.reset({
    clear: async () => {
      throw Object.assign(new Error('NETWORK'), { code: 'NETWORK', retryable: true });
    },
    guestPort: w.guestPort,
  });
  assert.deepEqual(
    [offline.ok, offline.path, offline.step, offline.known],
    [false, 'device', 'clear', false],
    '닿지 못하면 결과를 모른다',
  );
  assert.deepEqual(await heldIds(w.guestPort), moved, '닿지 못하면 옮긴 손님 기록을 지우지 않는다');
  const done = await local.reset({
    clear: async () => ({ ok: true, revision: 4 }),
    guestPort: w.guestPort,
  });
  assert.equal(done.ok, true);
  assert.equal(done.path, 'device');
  assert.equal(done.revision, 4);
  const left = await heldIds(w.guestPort);
  assert.ok(
    moved.every(id => !left.includes(id)),
    '비우기가 되면 그 계정으로 옮긴 손님 기록을 지운다',
  );
  local.dispose();
});

test('서버가 이미 비운 뒤의 남은 걸음(settle) — 올리기 · 서버 비우기 없이 손님 저장소의 걸음만 한다. cleared는 옮긴 사건을 지우고 4b를, legacy는 4b만 한다', async () => {
  const w = world(51);
  const old = { log: [legacyEvent(w, 'old-1')], ledger: null, epoch: 'e1' };
  const guest = await guestCoach(w, () => old);
  await practise(w, guest, w.items.slice(0, 1));
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  const moved = await heldIds(w.guestPort);
  assert.ok(moved.length >= 3, '옛 꼴 하나와 새 꼴 제시 · 답이 손님 저장소에 있다');
  // legacy — 넷째 걸음은 이미 했다: 옮긴 사건은 그대로 두고, 옛 손님 로그가 모두 옮긴 것이면 옛 엔진만 비운다.
  let now = old;
  let wiped = 0;
  const port = {
    read: () => now,
    clear: async () => {
      wiped += 1;
      now = { log: [], ledger: null, epoch: `e${wiped + 1}` }; // 옛 엔진 reset은 비울 때마다 새 epoch을 쓴다
    },
  };
  const calls = w.calls.length;
  // 입구처럼 그 비우기가 올린 판(2)을 넘긴다 — 판 1로 옮긴 사건은 넷째 걸음의 경계 안이지만, legacy는 넷째 걸음을 하지 않는다.
  const legacyOnly = await a.reset({
    guestPort: w.guestPort,
    legacy: port,
    settle: 'legacy',
    revision: 2,
  });
  assert.deepEqual(
    [
      legacyOnly.ok,
      legacyOnly.path,
      legacyOnly.settled,
      legacyOnly.guest.dropped,
      legacyOnly.guest.legacy,
    ],
    [true, 'upload', 'legacy', 0, 'cleared'],
  );
  assert.equal(wiped, 1);
  assert.deepEqual(
    await heldIds(w.guestPort),
    moved,
    '옮긴 사건은 지우지 않는다(그 뒤 새로 옮긴 것을 지우지 않게)',
  );
  assert.ok(!w.calls.slice(calls).includes('clear'), '서버 비우기를 부르지 않는다');
  // cleared — 결과를 몰랐던 비우기가 서버에서 됐다(판 2): 서버를 다시 부르지 않고 그 판보다 앞서 옮긴 사건을 지운다.
  const settled = await a.reset({
    guestPort: w.guestPort,
    legacy: port,
    settle: 'cleared',
    revision: 2,
  });
  assert.deepEqual(
    [settled.ok, settled.settled, settled.guest.dropped >= 3, settled.guest.legacy, wiped],
    [true, 'cleared', true, 'cleared', 2],
  );
  assert.deepEqual(await heldIds(w.guestPort), []);
  assert.ok(!w.calls.slice(calls).includes('clear'), '서버 비우기를 부르지 않는다');
  a.dispose();
});

test('남은 걸음(settle cleared)의 넷째 걸음은 그 비우기가 올린 새 판보다 앞선 판의 옮김 표지만 센다 — 판 경계가 코치를 거쳐 기록부까지 간다(4-5 Opus 대체 설계 검토 F5)', async () => {
  const w = world(58);
  const guest = await guestCoach(w);
  await practise(w, guest, w.items.slice(0, 1));
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort });
  assert.equal((await recs.move()).ok, true);
  recs.close();
  const moved = await heldIds(w.guestPort);
  assert.ok(moved.length >= 2, '판 1로 옮긴 제시 · 답이 손님 저장소에 있다');
  // 비우기가 판 1을 올린 것이 아니라면(경계 1) 판 1로 옮긴 사건은 그 비우기 뒤의 것이다 — 지우지 않는다.
  const kept = await a.reset({ guestPort: w.guestPort, settle: 'cleared', revision: 1 });
  assert.deepEqual([kept.ok, kept.guest.dropped], [true, 0]);
  assert.deepEqual(await heldIds(w.guestPort), moved);
  // 판 2로 올린 비우기 — 판 1로 옮긴 사건은 그 앞의 것이다.
  const dropped = await a.reset({ guestPort: w.guestPort, settle: 'cleared', revision: 2 });
  assert.equal(dropped.guest.dropped, moved.length);
  assert.deepEqual(await heldIds(w.guestPort), []);
  a.dispose();
});

test('먼저 시작한 비우기의 옛 로그 확인이 늦게 끝나도 그사이 다음 비우기가 둔 바닥을 걷지 않는다 — 자기 세대일 때만 걷는다(4-5 코드 검수 GPT)', async () => {
  const w = world(53);
  const first = await guestCoach(w);
  const second = await guestCoach(w);
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  let log = { log: [], ledger: null, epoch: 'e1' };
  let reads = 0;
  const slow = {
    // 둘째 읽기(비운 뒤의 확인)를 늦춘다.
    read: async () => {
      reads += 1;
      if (reads === 2) await gate;
      return log;
    },
    clear: async () => {
      log = { log: [], ledger: null, epoch: 'e2' };
    },
  };
  const firstDone = first.reset({ legacy: slow });
  try {
    // 한도를 둔다 — 첫 비우기가 옛 로그를 다시 읽으러 오지 않는 판(변형)에서 끝없이 기다리지 않고 실패한다.
    for (const end = Date.now() + 3000; reads < 2; ) {
      assert.ok(Date.now() < end, '첫 비우기가 옛 엔진을 비운 뒤 옛 로그를 다시 읽으러 왔다');
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    const busy = await second.reset({
      legacy: {
        read: () => log,
        clear: async () => {
          throw Object.assign(Error('busy'), { code: 'STORAGE_BUSY' });
        },
      },
    });
    assert.equal(busy.legacy, 'busy');
    const floor = (await lastCleared(w.guestPort)).legacy;
    assert.ok(floor, '둘째 비우기가 바닥을 두었다(옛 엔진을 못 비움)');
    release();
    assert.equal((await firstDone).legacy, 'cleared');
    assert.deepEqual(
      (await lastCleared(w.guestPort)).legacy,
      floor,
      '첫 비우기는 둘째 세대의 바닥을 걷지 않는다',
    );
  } finally {
    release();
    first.dispose();
    second.dispose();
  }
});

test('셸의 호스트를 빌린 코치(host.document — 틀의 게임)는 비우지 않는다 — 아무것도 쓰기 전에 거절한다(4-5 코드 검수 GPT)', async () => {
  const w = world(54);
  const port = memoryPort();
  const shell = open(w, {
    guest: true,
    account: 'L',
    revision: 1,
    key: storeName({ account: 'L', revision: 1, local: true }),
    port,
  });
  await shell.ready;
  await practise(w, shell, w.items.slice(0, 1));
  const held = await heldIds(port);
  assert.ok(held.length > 0);
  const game = open(w, { document: true, wait: 0 });
  await game.ready;
  let called = 0;
  const answer = await game.reset({
    clear: async () => {
      called += 1;
      return { ok: true, revision: 2 };
    },
  });
  assert.deepEqual(answer, {
    ok: false,
    path: 'document',
    step: 'owner',
    code: 'NOT_OWNER',
    known: true,
  });
  assert.equal(called, 0, '서버 비우기를 부르지 않았다');
  assert.deepEqual(await heldIds(port), held, '기기 길 계정의 기록이 그대로다');
  game.dispose();
  shell.dispose();
});

test('계정 비우기의 4b — 판단과 비우기 사이에 다른 탭이 옮기지 않은 손님 기록을 쓰면, 옛 엔진 문이 임대를 쥔 채 다시 판단해 비우지 않는다(4-5 코드 검수 GPT GA1)', async () => {
  const w = world(55);
  let now = { log: [legacyEvent(w, 'old-1')], ledger: null, epoch: 'e1' };
  const guest = await guestCoach(w, () => now);
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => now });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  let wiped = 0;
  // 옛 엔진 문 — 셸의 옛 손님 코치 reset과 같은 약속: 임대를 쥔 채 옛 로그를 다시 읽어 check가 참일 때만 비우고, 거짓이면 'kept'.
  const door = {
    read: () => now,
    clear: async ({ check } = {}) => {
      // 판단(모두 옮긴 것)을 읽은 뒤, 이 문이 임대를 쥐기 전에 다른 탭이 옮기지 않은 손님 기록을 썼다(GPT 재현).
      now = { ...now, log: [...now.log, legacyEvent(w, 'after-1')] };
      if (check && !check(now)) return 'kept';
      wiped += 1;
      now = { log: [], ledger: null, epoch: 'e2' };
    },
  };
  const done = await a.reset({ guestPort: w.guestPort, legacy: door });
  assert.equal(done.ok, true);
  assert.equal(done.guest.legacy, 'kept', '다시 판단해 섞인 것을 보았다');
  assert.equal(wiped, 0, '비우지 않았다');
  assert.deepEqual(
    now.log.map(event => event.id),
    ['old-1', 'after-1'],
    '다른 탭이 쓴 손님 기록이 남는다',
  );
  a.dispose();
});

test('올리는 계정의 0 걸음 — 다른 탭이 저장했지만 이 탭이 아직 읽지 않은 답도 서버 비우기 전에 올린다(4-5 코드 검수 GPT GA2)', async () => {
  const w = world(56);
  const port = memoryPort();
  const key = storeName({ account: 'A', revision: 1 });
  const tab = (scope, transport) =>
    createCoach({
      gameId: 'reset',
      map: w.map,
      seed: 's',
      dayOffset: 0,
      scope,
      host: { now: w.time.now, guest: false, account: 'A', revision: 1, key, port, transport },
    });
  const offlineError = () =>
    Object.assign(new Error('NETWORK'), { code: 'NETWORK', retryable: true });
  // 이 탭 — 비우기를 누르기 전까지는 닿지 못한다. 닿으면 제 받기 · 올리기가 차례에 들며 꼬리를 다시 읽어 틈이 가려진다.
  let online = false;
  let seenAtClear = null;
  const gated = {
    post: async (events, since) => {
      if (!online) throw offlineError();
      return w.server.post(events, since);
    },
    get: async since => {
      if (!online) throw offlineError();
      return { summary: await w.server.summary(since), serverTime: w.server.now };
    },
    clear: async () => {
      seenAtClear = new Set(w.server.server.log().map(row => row.event.id));
      return { ok: true, revision: 2 };
    },
  };
  const mine = tab(w.top, gated);
  await mine.ready;
  // 다른 탭 — 같은 저장소에 답을 저장하지만 제 올리기는 닿지 못한다.
  const offline = {
    post: async () => {
      throw offlineError();
    },
    get: async () => {
      throw offlineError();
    },
  };
  // 그 탭의 알림(BroadcastChannel)이 아직 이 탭에 닿지 않은 때다 — 알림 통로 없이 연다(닿으면 이 탭이 꼬리를 다시 읽어 틈이 가려진다).
  const channel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  delete globalThis.BroadcastChannel;
  let other;
  try {
    other = tab(topWindow(), offline);
    await other.ready;
  } finally {
    if (channel) Object.defineProperty(globalThis, 'BroadcastChannel', channel);
  }
  const pid = other.present(w.items[0]);
  const answered = other.answer(pid, { correct: true, assessable: true });
  assert.equal(await answered.stored, true);
  assert.equal(mine.summary().storage.unsent, 0, '이 탭은 아직 그 답을 읽지 않았다');
  online = true;
  const done = await mine.reset({ guestPort: w.guestPort, legacy: { read: () => null } });
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.ok(seenAtClear.has(answered.eventId), '다른 탭의 답을 들여 서버 비우기 전에 올렸다');
  other.dispose();
  mine.dispose();
});

// ── 옮긴 장부 칸(Fable -c FA1)의 끼움 장면 — 4-5 Opus 대체 설계 검토(물음 2)가 돌린 셋을 옮겼다. 넷째 걸음이 옮긴 「옮겨 오기 전 기록」을
// 지운 뒤, 손님 비우기 · 다른 계정의 비우기 · 옛 엔진 비우기를 끼워도 같은 옛 장부가 새 번호로 다시 들지 않는다.
const carriedRows = async port =>
  (await port.read()).filter(row => row.value.event?.type === 'record.carried');
const busyLegacy = old => ({
  read: () => old,
  clear: async () => {
    throw Object.assign(new Error('busy'), { code: 'STORAGE_BUSY' });
  },
});
const sent = { postLegacy: async () => ({ ok: true, ids: [] }) };

test('FA1-가 — 넷째 걸음 뒤 손님 비우기(옛 엔진 바쁨)를 끼우면 같은 epoch의 바닥이 장부를 막고, 옛 엔진이 비워진 뒤에는 새로 접힌 장부만 든다(4-5 Opus 대체 설계 검토)', async () => {
  const w = world(61);
  const old = {
    log: [legacyEvent(w, 'old-guest')],
    ledger: ledgerOf(['t.f0', 't.f1']),
    epoch: 'e1',
  };
  const g = await guestCoach(w, () => old);
  g.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal((await recs.move(sent)).ok, true);
  recs.close();
  const done = await a.reset({
    guestPort: w.guestPort,
    legacy: { read: () => old, clear: async () => {} },
  });
  assert.equal(done.guest.legacy, 'kept', '옮기지 않은 옛 사건이 있어 옛 로그는 둔다');
  a.dispose();
  // 로그아웃한 손님이 손님 비우기를 누른다 — 옛 엔진은 다른 창이 쥐었다.
  const g2 = await guestCoach(w, () => old);
  assert.equal((await g2.reset({ legacy: busyLegacy(old) })).legacy, 'busy');
  g2.dispose();
  const cleared = await lastCleared(w.guestPort);
  assert.equal(cleared.carried, null, '손님 비우기 표지는 옮긴 장부 칸을 들지 않는다');
  assert.equal(cleared.legacy?.epoch, 'e1', '대신 같은 epoch의 바닥이 막는다');
  const g3 = await guestCoach(w, () => ({ ...old, ledger: ledgerOf(['t.f0', 't.f1', 't.f2']) }));
  assert.equal(
    (await carriedRows(w.guestPort)).length,
    0,
    '같은 epoch — 자란 장부도 옮기지 않는다',
  );
  g3.dispose();
  // 옛 엔진이 나중에 비워졌다(새 epoch) — 그 뒤 새로 접힌 장부만 든다.
  const g4 = await guestCoach(w, () => ({ log: [], ledger: ledgerOf(['t.f9']), epoch: 'e2' }));
  assert.deepEqual(
    (await carriedRows(w.guestPort)).map(row => Object.keys(row.value.event.families)),
    [['t.f9']],
  );
  g4.dispose();
});

test('FA1-나 — 두 계정이 차례로 옮기고 비우면 옮긴 장부 칸이 앞 표지의 칸에 쌓여, 어느 계정으로 옮긴 칸도 다시 들지 않는다(4-5 Opus 대체 설계 검토)', async () => {
  const w = world(62);
  const old = { log: [legacyEvent(w, 'old-guest')], ledger: ledgerOf(['t.f0']), epoch: 'e1' };
  const g = await guestCoach(w, () => old);
  g.dispose();
  const a = await accountCoach(w, 'A');
  const ra = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal((await ra.move(sent)).ok, true);
  ra.close();
  assert.equal(
    (await a.reset({ guestPort: w.guestPort, legacy: { read: () => old, clear: async () => {} } }))
      .ok,
    true,
  );
  a.dispose();
  // 장부가 자라 새 칸이 든 뒤 B로 옮기고 B가 비운다.
  const grown = { ...old, ledger: ledgerOf(['t.f0', 't.f1']) };
  const g2 = await guestCoach(w, () => grown);
  g2.dispose();
  const b = await accountCoach(w, 'B');
  const rb = await b.guestRecords({ port: w.guestPort, legacy: () => grown });
  assert.equal((await rb.move(sent)).ok, true);
  rb.close();
  assert.equal(
    (
      await b.reset({
        guestPort: w.guestPort,
        legacy: { read: () => grown, clear: async () => {} },
      })
    ).ok,
    true,
  );
  b.dispose();
  assert.deepEqual(
    (await lastCleared(w.guestPort)).carried?.families,
    ['t.f0', 't.f1'],
    '앞 표지의 칸을 잇는다',
  );
  const g3 = await guestCoach(w, () => grown);
  assert.equal(
    (await carriedRows(w.guestPort)).length,
    0,
    '어느 계정으로 옮긴 장부 칸도 다시 들지 않는다',
  );
  g3.dispose();
});

test('FA1-다 — 손님 비우기(옛 엔진 바쁨 · 바닥)가 먼저고 계정의 넷째 걸음이 뒤면, 넷째 걸음 표지가 바닥을 이어 받아 비우기 전의 옛 사건 · 장부가 되살아나지 않는다(4-5 Opus 대체 설계 검토)', async () => {
  const w = world(66);
  const old = { log: [legacyEvent(w, 'old-pre')], ledger: ledgerOf(['t.f0']), epoch: 'e1' };
  const g = await guestCoach(w, () => old);
  assert.equal((await g.reset({ legacy: busyLegacy(old) })).legacy, 'busy');
  w.time.advance(STEP);
  await practise(w, g, w.items.slice(0, 1));
  g.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal((await recs.move(sent)).ok, true);
  recs.close();
  assert.equal(
    (await a.reset({ guestPort: w.guestPort, legacy: { read: () => old, clear: async () => {} } }))
      .ok,
    true,
  );
  a.dispose();
  assert.equal((await lastCleared(w.guestPort)).legacy?.epoch, 'e1', '앞 바닥을 잇는다');
  const g2 = await guestCoach(w, () => old);
  assert.ok(
    !(await heldIds(w.guestPort)).includes('old-pre'),
    '비우기 전 옛 사건은 돌아오지 않는다',
  );
  assert.equal((await carriedRows(w.guestPort)).length, 0, '장부도 돌아오지 않는다');
  g2.dispose();
});

// ── 설계 주인 11-18 밤 답(4-5 Opus 대체 설계 검토 F4 · F6 · F7) ──
const fault = (status, code) =>
  Object.assign(new Error(code), { status, code, retryable: status >= 500 });

test('올리는 계정의 0 걸음 — 서버가 받지 않아 건너뛴 사건이 있으면 막지도 버리지도 않고 그 수를 알린다(UNSENT_SKIPPED). 학생이 그 수를 확인하면 비우고, 덜 확인했거나 옛 대기열의 몫이 더해져 늘었으면 다시 묻는다(4-5 Opus 대체 설계 검토 F4)', async () => {
  const w = world(59);
  const a = await accountCoach(w, 'A');
  const shown = [];
  for (const item of w.items.slice(0, 3)) {
    const pid = a.present(item);
    await a.answer(pid, { correct: true, assessable: true }).stored;
    shown.push(pid);
    w.time.advance(STEP);
  }
  const bad = shown[1];
  const post = w.route.post;
  w.route.post = async (events, since) => {
    if (events.some(event => event.id === bad)) throw fault(400, 'INVALID_EVENTS');
    return post(events, since);
  };
  const first = await a.reset({ guestPort: w.guestPort });
  assert.deepEqual(
    [first.ok, first.step, first.code, first.known],
    [false, 'upload', 'UNSENT_SKIPPED', true],
  );
  assert.equal(first.skipped, 2, '건너뛴 제시와 그 답 — 둘이다(4-5 끝 판 GPT GE5)');
  assert.ok(!w.calls.includes('clear'), '서버를 부르지 않았다');
  const less = await a.reset({ guestPort: w.guestPort, allowSkipped: 1 });
  assert.deepEqual(
    [less.code, less.skipped],
    ['UNSENT_SKIPPED', 2],
    '하나만 확인하면 비우지 않는다',
  );
  const odd = await a.reset({ guestPort: w.guestPort, allowSkipped: 'all' });
  assert.equal(odd.code, 'UNSENT_SKIPPED', '꼴이 틀린 확인은 확인하지 않은 것');
  const text = await a.reset({ guestPort: w.guestPort, allowSkipped: '2' });
  assert.equal(
    text.code,
    'UNSENT_SKIPPED',
    `수와 같은 숫자 글도 확인한 수가 아니다(4-5 끝 판 GPT GE2)`,
  );
  assert.ok(!w.calls.includes('clear'), '그동안 서버를 부르지 않았다');
  const more = await a.reset({
    guestPort: w.guestPort,
    allowSkipped: first.skipped,
    skippedElsewhere: 2,
  });
  assert.deepEqual(
    [more.code, more.skipped],
    ['UNSENT_SKIPPED', first.skipped + 2],
    '옛 대기열의 몫을 더해 한 번에 알린다',
  );
  assert.ok(!w.calls.includes('clear'));
  const done = await a.reset({ guestPort: w.guestPort, allowSkipped: 2 });
  assert.equal(done.ok, true, '확인한 수까지는 지운다');
  assert.ok(w.calls.includes('clear'));
  a.dispose();
});

test('올리는 계정의 0 걸음 — 가려낸 것이 많아 쉬는 세션이면 남은 사건 모두가 지금 보낼 수 없는 것이다. 옛 대기열이 막힌 몫만 있어도 묻는다(F4)', async () => {
  const host = (left, held, status = {}) => ({
    guest: false,
    revision: 1,
    settled: async () => {},
    trail: { record: { refresh: async () => {} } },
    unsentLeft: () => left,
    unsentHeld: () => held,
    syncStatus: () => ({
      stopped: null,
      writesOff: false,
      switchOff: false,
      paused: false,
      ...status,
    }),
    upload: async () => {},
  });
  const never = async () => assert.fail('서버를 부르지 않는다');
  const paused = await resetAccount(host(3, 3, { paused: true }), { account: 'A', clear: never });
  assert.deepEqual([paused.code, paused.skipped], ['UNSENT_SKIPPED', 3]);
  const old = await resetAccount(host(0, 0), { account: 'A', clear: never, elsewhere: 4 });
  assert.deepEqual([old.code, old.skipped], ['UNSENT_SKIPPED', 4]);
  const stuck = await resetAccount(host(2, 0, { writesOff: true }), { account: 'A', clear: never });
  assert.deepEqual(
    [stuck.code, stuck.skipped],
    ['UNSENT', undefined],
    '쓰기가 막혀 남은 것은 다시 해 볼 일이다',
  );
});

const cellLedger = (families, answers) => ({
  keys: Object.fromEntries(families.map(family => [`family:${family}`, 1])),
  cells: { 'ko.reading.s0|1|single-choice': { ind: answers, helped: [] } },
});

test('4b — 옛 장부의 칸이 처음 옮긴 때보다 자랐으면(열쇠는 같아도) 모두 옮긴 것이 아니다. 옛 로그를 두고 kept로 끝낸다 — 넷째 걸음 뒤 4b만 다시 도는 남은 걸음도 비움 표지에 남긴 처음 칸으로 견준다(4-5 Opus 대체 설계 검토 F6 · 설계 주인 11-18)', async () => {
  const w = world(65);
  const old = {
    log: [legacyEvent(w, 'old-1')],
    ledger: cellLedger(['t.f0'], [['x', 1, 'correct']]),
    epoch: 'e1',
  };
  const g = await guestCoach(w, () => old);
  g.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  // 그 뒤 옛 엔진이 접은 칸이 자랐다(같은 계열 — 열쇠는 그대로) — 로그인 뒤 손님이 더 푼 답이다.
  const grown = {
    ...old,
    ledger: cellLedger(
      ['t.f0'],
      [
        ['x', 1, 'correct'],
        ['y', 2, 'correct'],
      ],
    ),
  };
  let wiped = 0;
  const legacy = {
    read: () => grown,
    clear: async () => {
      wiped += 1;
    },
  };
  const done = await a.reset({ guestPort: w.guestPort, legacy });
  assert.deepEqual(
    [done.guest.legacy, wiped],
    ['kept', 0],
    '자란 칸은 그 계정의 것이 아닐 수 있다',
  );
  assert.equal(
    (await lastCleared(w.guestPort)).carried?.cells?.length,
    1,
    '비움 표지가 처음 옮긴 칸을 든다',
  );
  const again = await a.reset({ guestPort: w.guestPort, legacy, settle: 'legacy', revision: 2 });
  assert.deepEqual([again.guest.legacy, wiped], ['kept', 0]);
  a.dispose();
});

test('4b — 칸이 그대로면 넷째 걸음이 「옮겨 오기 전 기록」을 지운 뒤 4b만 다시 도는 남은 걸음도 비움 표지의 처음 칸으로 견주어 옛 로그를 비운다(F6)', async () => {
  const w = world(66);
  const old = {
    log: [legacyEvent(w, 'old-1')],
    ledger: cellLedger(['t.f0'], [['x', 1, 'correct']]),
    epoch: 'e1',
  };
  const g = await guestCoach(w, () => old);
  g.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  let now = old;
  let busy = true;
  const legacy = {
    read: () => now,
    clear: async () => {
      if (busy) throw Object.assign(new Error('busy'), { code: 'STORAGE_BUSY' });
      now = { log: [], ledger: null, epoch: 'e2' };
    },
  };
  const first = await a.reset({ guestPort: w.guestPort, legacy });
  assert.equal(first.guest.legacy, 'busy', '다른 창이 쥐었다 — 4b가 남는다');
  busy = false;
  const settled = await a.reset({ guestPort: w.guestPort, legacy, settle: 'legacy', revision: 2 });
  assert.equal(settled.guest.legacy, 'cleared', '처음 칸이 그대로라 모두 옮긴 것이다');
  a.dispose();
});

test('손님 코치도 비우기가 확인된 계정의 남은 걸음을 한다 — 입구가 준 계정의 옮긴 사건만 지우고 로그아웃 뒤의 손님 사건은 둔다. 계정을 주지 않으면 하지 않는다(4-5 Opus 대체 설계 검토 F7 · 설계 주인 11-18)', async () => {
  const w = world(67);
  const g = await guestCoach(w);
  await practise(w, g, w.items.slice(0, 2));
  g.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort });
  assert.equal((await recs.move()).ok, true);
  recs.close();
  a.dispose();
  const moved = await heldIds(w.guestPort);
  const g2 = await guestCoach(w);
  await practise(w, g2, w.items.slice(3, 4));
  const fresh = (await heldIds(w.guestPort)).filter(id => !moved.includes(id));
  assert.ok(fresh.length >= 2);
  const none = await g2.reset({ settle: 'cleared', revision: 2, guestPort: w.guestPort });
  assert.deepEqual([none.ok, none.code], [false, 'NO_ACCOUNT']);
  // 손님 코치는 그 계정의 판을 모른다 — 넷째 걸음을 잴 판을 받지 못하면(빠짐 · 0 · 정수 아님) 아무것도 지우지 않는다(4-5 끝 판 카본 D2).
  for (const revision of [undefined, null, 0, 1.5, '2']) {
    const blind = await g2.reset({
      settle: 'cleared',
      account: 'A',
      revision,
      guestPort: w.guestPort,
    });
    assert.deepEqual(
      [blind.ok, blind.code, blind.path],
      [false, 'NO_REVISION', 'guest'],
      `판 ${revision}`,
    );
  }
  assert.deepEqual(
    (await heldIds(w.guestPort)).sort(),
    [...moved, ...fresh].sort(),
    '판 없이 부른 남은 걸음은 아무 사건도 지우지 않았다',
  );
  const done = await g2.reset({
    settle: 'cleared',
    account: 'A',
    revision: 2,
    guestPort: w.guestPort,
    legacy: { read: () => null, clear: async () => {} },
  });
  assert.equal(done.ok, true);
  assert.equal(done.path, 'guest', '손님 코치가 한 남은 걸음이다(그 계정의 길을 모른다)');
  const left = await heldIds(w.guestPort);
  assert.ok(
    moved.every(id => !left.includes(id)),
    '옮긴 사건은 지웠다',
  );
  assert.ok(
    fresh.every(id => left.includes(id)),
    '로그아웃 뒤의 손님 사건은 둔다',
  );
  g2.dispose();
});

test('남은 걸음의 4b도 그 비우기가 올린 새 판보다 앞선 판의 옮김 표지만 센다 — 비운 뒤 그 계정으로 새로 옮긴 옛 손님 기록은 옛 로그에서 지우지 않는다(4-5 끝 판 GPT GD1)', async () => {
  const w = world(71);
  const old = { log: [legacyEvent(w, 'old-1')], ledger: null, epoch: 'e1' };
  const guest = await guestCoach(w, () => old);
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort, legacy: () => old });
  assert.equal(
    (await recs.move({ postLegacy: async () => ({ ok: true, ids: ['old-1'] }) })).ok,
    true,
  );
  recs.close();
  let wiped = 0;
  let now = old;
  const legacy = {
    read: () => now,
    clear: async () => {
      wiped += 1;
      now = { log: [], ledger: null, epoch: 'e2' };
    },
  };
  // 판 1을 올린 비우기라면 판 1로 옮긴 것은 그 뒤의 것이다 — 넷째 걸음도 4b도 건드리지 않는다.
  const kept = await a.reset({ guestPort: w.guestPort, settle: 'cleared', revision: 1, legacy });
  assert.deepEqual([kept.ok, kept.guest.dropped, kept.guest.legacy], [true, 0, 'kept']);
  assert.equal(wiped, 0, '비운 뒤 옮긴 옛 손님 기록은 옛 로그에 남는다');
  // 판 2를 올린 비우기라면 판 1로 옮긴 것은 그 앞의 것이다 — 4b가 옛 로그를 비운다.
  const all = await a.reset({ guestPort: w.guestPort, settle: 'cleared', revision: 2, legacy });
  assert.deepEqual([all.ok, all.guest.legacy], [true, 'cleared']);
  assert.equal(wiped, 1);
  a.dispose();
});

test('결과를 모르는 서버 비우기 실패(시간 초과) 뒤에는 그 계정으로 옮긴 손님 기록을 지우지 않는다 — 서버가 비웠는지 모르기 때문이다(4-5 끝 판 GPT GE1)', async () => {
  const w = world(73);
  const guest = await guestCoach(w);
  await practise(w, guest, w.items.slice(0, 1));
  guest.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort });
  assert.equal((await recs.move()).ok, true);
  recs.close();
  const moved = await heldIds(w.guestPort);
  assert.ok(moved.length >= 2, '옮긴 제시와 답이 손님 저장소에 있다');
  w.route.clear = async () => {
    w.calls.push('clear');
    throw fault(408, 'TIMEOUT');
  };
  const timedOut = await a.reset({ guestPort: w.guestPort });
  assert.deepEqual([timedOut.ok, timedOut.step, timedOut.known], [false, 'clear', false]);
  assert.deepEqual(await heldIds(w.guestPort), moved, '옮긴 손님 기록은 그대로다');
  a.dispose();
});

test('넷째 걸음 뒤에도 그 걸음이 지우지 않은 제시의 답은 저장된다 — 옮긴 사건만 지운 세대에서 남은 부모를 지운 것으로 보지 않는다(4-5 끝 판 Fable F1)', async () => {
  const w = world(67);
  const g = await guestCoach(w);
  await practise(w, g, w.items.slice(0, 2));
  g.dispose();
  const a = await accountCoach(w, 'A');
  const recs = await a.guestRecords({ port: w.guestPort });
  assert.equal((await recs.move()).ok, true);
  recs.close();
  a.dispose();
  const moved = await heldIds(w.guestPort);
  // 로그아웃한 손님이 연습하는 사이 남은 걸음이 돈다 — 넷째 걸음 전에 보인 문항은 옮기지 않아 저장소에 남는다.
  const g2 = await guestCoach(w);
  const pid = g2.present(w.items[3]);
  const done = await g2.reset({
    settle: 'cleared',
    account: 'A',
    revision: 2,
    guestPort: w.guestPort,
    legacy: { read: () => null, clear: async () => {} },
  });
  assert.equal(done.ok, true);
  const left = await heldIds(w.guestPort);
  assert.ok(
    moved.every(id => !left.includes(id)),
    '옮긴 사건은 지웠다',
  );
  assert.ok(left.includes(pid), '넷째 걸음 전에 보인 제시는 남았다');
  assert.equal(
    await g2.answer(pid, { correct: true, assessable: true }).stored,
    true,
    '남은 제시의 답은 저장된다',
  );
  const events = (await w.guestPort.read())
    .filter(row => row.value.kind === 'event')
    .map(row => row.value.event);
  assert.equal(
    events.filter(event => event.presentationId === pid).length,
    1,
    '그 답이 저장소에 있다',
  );
  const next = g2.present(w.items[5]);
  assert.equal(
    await g2.answer(next, { correct: true, assessable: true }).stored,
    true,
    '새 문항도 그대로다',
  );
  g2.dispose();
});
