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
  const done = await local.reset({
    clear: async () => ({ ok: true, revision: 4 }),
    guestPort: w.guestPort,
  });
  assert.equal(done.ok, true);
  assert.equal(done.path, 'device');
  assert.equal(done.revision, 4);
  local.dispose();
});
