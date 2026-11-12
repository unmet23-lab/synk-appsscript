// 자물쇠 없는 기록부 여럿 · 포트 하나 임의 시험(단계 4 계획 §18-5-1 R10 · §18-5-6 — Fable 5.2 끝 판 F6). 계획이 정한 두 시험:
//   ① 두 기록부가 같은 장부 · 옛 기록을 함께 옮긴다 → 보기는 한 번 옮긴 것과 같다(손님 — 옛 기록 옮기기 · 장부 · 표지가 겹친다)
//   ② 저장소에 쓰는 파생 기록(받은 표지 · 요약 · 치운 표시)이 자물쇠 없는 두 기록부 · 한 포트에서 겹쳐도 보기가 서버와 같다(계정 — 올리기
//      · 받기 · 치우기 · 꼬리 읽기 · 탭 다시 열기가 겹치고, 서버의 답이 가끔 사라진다)
// 포트는 일을 부른 그 순간 실행하고(IndexedDB처럼 만든 차례대로) 결과는 탭마다 차례대로 임의의 틈 뒤에 돌려준다 — 일이 겹쳐 도는 차례(결과가
// 늦게 오는 틈)를 만든다. Fable 5.2 검수자의 탐침(probe-account · probe-guest)의 꼴 그대로다(그 탐침: 계정 500씨앗 · 손님 950씨앗 실패 0).
import assert from 'node:assert/strict';
import test from 'node:test';
import { subject } from '../support/subject.mjs';
import { createServer, memory, PARAMS } from '../support/trail-sync.mjs';
import {
  bank,
  createLegacyDevice,
  indexOf,
  newState,
  pick,
  rng,
  stepDevice,
  T0,
} from '../support/trail-world.mjs';

const { openRecord, KEEP_MS } = await subject('record/log.mjs');
const { memoryPort } = await subject('record/port.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { groupsOf } = await subject('record/adapt.mjs');
const { entryOf } = await subject('record/server.mjs');
const { EVENT_TYPES } = await subject('record/events.mjs');
const { carriedFields, carriedSoFar, legacyToImport } = await subject('record/carry.mjs');

const hop = () => new Promise(resolve => setImmediate(resolve));
const hops = async n => {
  for (let i = 0; i < n; i += 1) await hop();
};
// 탭 하나의 포트 손잡이 — 일은 곧 실행하고, 결과는 그 탭의 차례대로 임의의 틈 뒤에 돌려준다.
function tabPort(base, random, maxHops = 3) {
  let chain = Promise.resolve();
  const later = promise => {
    const n = Math.floor(random() * (maxHops + 1));
    const run = chain.then(async () => {
      await hops(n);
      return promise;
    });
    chain = run.catch(() => {});
    return run;
  };
  const wrap =
    name =>
    (...args) => {
      let promise;
      try {
        promise = base[name](...args);
      } catch (error) {
        promise = Promise.reject(error);
      }
      promise.catch(() => {});
      return later(promise);
    };
  return {
    read: wrap('read'),
    range: wrap('range'),
    append: wrap('append'),
    remove: wrap('remove'),
    close: async () => {},
  };
}
const linesOf = view =>
  JSON.stringify({
    memory: [...view.memory].sort(([a], [b]) => a.localeCompare(b)),
    ability: [...view.ability].sort(([a], [b]) => a.localeCompare(b)),
    met: [...view.met].sort(([a], [b]) => a.localeCompare(b)),
  });
function sameMap(got, want, waiting, label) {
  for (const [key, line] of want)
    if (!waiting.has(key)) assert.deepEqual(got.get(key) ?? null, line, `${label} ${key}`);
  for (const key of got.keys())
    if (!waiting.has(key) && !want.has(key)) assert.fail(`${label}: 없어야 할 줄 ${key}`);
}

// ── ② 계정 ──
// 기다리지 않는 줄의 기대값 = 서버가 접은 사건(요약의 foldedUntil까지) + 밀린 내 사건을 같은 규칙으로 접은 값.
function expectedFor(record, server, index) {
  const until = record.summary?.foldedUntil ?? 0;
  const onServer = new Map(server.server.log().map(row => [row.event.id, row]));
  const entries = server.server
    .log()
    .filter(row => row.seq <= until)
    .map(entryOf);
  for (const id of record.pending()) {
    const row = onServer.get(id);
    if (row && row.seq <= until) continue;
    const event = row?.event ?? record.heldEvent(id);
    entries.push(row ? entryOf(row) : { event, key: event.id, atMs: Date.parse(event.at) });
  }
  return linesOfGroups(groupsOf(entries), { memory, params: PARAMS, index });
}
function checkView(record, server, index, label) {
  const view = record.view();
  if (view.waitAll) return;
  // 답이 사라져 「받은 표지 없이 이미 접힌」 사건이 있는 동안은 어림이다(다음 올리기가 받은 표지를 준다) — 견주지 않는다.
  const until = record.summary?.foldedUntil ?? 0;
  const seqOf = new Map(server.server.log().map(row => [row.event.id, row.seq]));
  if (
    [...record.pending()].some(
      id => seqOf.has(id) && seqOf.get(id) <= until && record.acked(id) === undefined,
    )
  )
    return;
  const want = expectedFor(record, server, index);
  sameMap(view.memory, want.unit, view.waitUnits, `${label}: 단위`);
  sameMap(view.ability, want.skill, view.waitSkills, `${label}: 능력`);
}

// 계정 한 바퀴의 판 — 탭 · 서버 · 포트와 탭이 하는 일(올리기 · 받기). 걸음 · 중간 점검 · 마무리는 아래 함수로 나눈다.
async function accountWorld(seed, { tabsN, lost }) {
  const random = rng(seed);
  const items = bank(random);
  const w = {
    seed,
    random,
    lost,
    items,
    index: indexOf(items, 'index-a'),
    server: null,
    base: memoryPort(),
    drift: -Math.floor(random() * 60_000),
    made: new Set(),
    all: [],
    errors: [],
    tabs: [],
    serial: 0,
  };
  w.ctx = { items, indexEdition: 'index-a', solo: false };
  w.server = createServer({ random, index: w.index, foldChance: 0.7 });
  w.fire = promise => w.all.push(Promise.resolve(promise).catch(error => w.errors.push(error)));
  for (let i = 0; i < tabsN; i += 1) w.tabs.push(await openAccountTab(w, i));
  return w;
}
async function openAccountTab(w, i) {
  w.serial += 1;
  const record = await openRecord({
    port: tabPort(w.base, w.random),
    revision: 1,
    memory,
    params: PARAMS,
    index: w.index,
    now: () => w.server.now + w.drift,
    tag: `a${i}${w.serial}`.padEnd(8, 'x').slice(0, 8),
  });
  const tab = { i, record, state: newState(), flows: [], lane: Promise.resolve() };
  tab.device = {
    name: `a${i}`,
    time: () => record.clock.lastAt,
    make(type, fields) {
      const { event, stored } = record.add(type, fields);
      w.made.add(event.id);
      tab.flows.push(stored);
      return event;
    },
  };
  tab.inLane = work => {
    const run = tab.lane.then(work, work);
    tab.lane = run.catch(() => {});
    return run;
  };
  return tab;
}
const push = (w, tab, drop) =>
  tab.inLane(async () => {
    await tab.record.refresh();
    await tab.record.saved();
    const events = tab.record.unsent(1 + Math.floor(w.random() * 12));
    if (!events.length) return;
    const reply = await w.server.post(events, tab.record.since());
    await hops(Math.floor(w.random() * 3));
    if (!drop) await tab.record.receive(reply);
  });
const pull = (w, tab, drop) =>
  tab.inLane(async () => {
    await w.server.fold();
    const summary = await w.server.summary(tab.record.since());
    await hops(Math.floor(w.random() * 3));
    if (!drop && summary) await tab.record.receive({ summary, serverTime: w.server.now });
  });
async function quiesce(w) {
  for (;;) {
    const n = w.all.length;
    const flows = w.tabs.flatMap(tab => tab.flows.splice(0));
    await Promise.all([...w.all, ...flows.map(p => p.catch(error => w.errors.push(error)))]);
    if (w.all.length === n && !w.tabs.some(tab => tab.flows.length)) break;
  }
  if (w.errors.length) throw w.errors[0];
}
// 한 걸음 — 답 · 올리기 · 받기 · 꼬리 읽기 · 치우기 · 탭 다시 열기 가운데 하나(서버의 답이 lost만큼 사라진다).
async function accountStep(w) {
  w.server.tick(Math.floor(w.random() * 5 * 60_000));
  const tab = pick(w.random, w.tabs);
  const roll = w.random();
  if (roll < 0.45) stepDevice(tab.device, tab.state, w.ctx, w.random);
  else if (roll < 0.65) w.fire(push(w, tab, w.random() < w.lost));
  else if (roll < 0.75) w.fire(pull(w, tab, w.random() < w.lost));
  else if (roll < 0.85) w.fire(tab.record.refresh());
  else if (roll < 0.93) {
    if (w.random() < 0.5) w.server.tick(KEEP_MS + 60_000);
    w.fire(tab.inLane(() => tab.record.compact()));
  } else if (roll < 0.96) {
    // 탭 하나를 닫고 새로 연다(새 기록부 — 포트에서 처음부터 읽는다). 하던 일은 끝까지 간다.
    await quiesce(w);
    const next = await openAccountTab(w, tab.i);
    next.state = tab.state;
    w.tabs[w.tabs.indexOf(tab)] = next;
  }
}
// 중간 점검 — 기다리지 않는 줄 = 서버가 같은 사건으로 접은 값, 받은 표지가 있는 사건은 대기열에 없다.
async function accountMidCheck(w, step) {
  await quiesce(w);
  const acked = new Set(
    (await w.base.read())
      .filter(row => row.value.kind === 'ack')
      .flatMap(row => row.value.acks.map(([id]) => id)),
  );
  for (const t of w.tabs) {
    await t.record.refresh();
    checkView(t.record, w.server, w.index, `씨앗 ${w.seed} 걸음 ${step} 탭 ${t.i}`);
    for (const event of t.record.unsent(Number.POSITIVE_INFINITY))
      assert.equal(acked.has(event.id), false, `씨앗 ${w.seed}: 받은 ${event.id}가 대기열에`);
  }
}
async function accountDrain(w) {
  await quiesce(w);
  for (let round = 0; round < 4; round += 1)
    for (const tab of w.tabs) {
      for (let guard = 0; guard < 200; guard += 1) {
        await tab.record.refresh();
        if (!tab.record.unsent(1).length) break;
        await push(w, tab, false);
      }
      await pull(w, tab, false);
    }
  for (const tab of w.tabs) await tab.record.refresh();
}
// 끝 — 만든 사건이 모두 서버에(버린 것 빼고) · 보기 = 포트를 새로 읽은 보기 = 서버 전체 접기 · 기다리지 않음 · 대기열 빔.
async function accountFinal(w) {
  const onServer = new Set(w.server.server.rawLog().map(row => row.event.id));
  const fresh = await openRecord({
    port: w.base,
    revision: 1,
    memory,
    params: PARAMS,
    index: w.index,
    now: () => w.server.now + w.drift,
    tag: 'freshxxx',
  });
  const rows = await w.base.read();
  const dropped = new Set(
    rows.filter(row => row.value.kind === 'ack').flatMap(row => row.value.dropped ?? []),
  );
  assert.deepEqual(
    [...w.made].filter(id => !onServer.has(id) && !dropped.has(id)),
    [],
    `씨앗 ${w.seed}: 만든 사건이 모두 서버에(버린 것 빼고)`,
  );
  const truth = linesOfGroups(groupsOf(w.server.server.log().map(entryOf)), {
    memory,
    params: PARAMS,
    index: w.index,
  });
  const sorted = map => Object.fromEntries([...map].sort());
  for (const tab of w.tabs) {
    const label = `씨앗 ${w.seed} 탭 ${tab.i}`;
    const view = tab.record.view();
    assert.equal(linesOf(view), linesOf(fresh.view()), `${label}: 보기 = 포트를 새로 읽은 보기`);
    assert.equal(view.waitAll, false, `${label}: 끝에는 기다리지 않는다`);
    assert.equal(view.waitUnits.size + view.waitSkills.size, 0, `${label}: 끝에 기다리는 줄`);
    assert.deepEqual(sorted(view.memory), sorted(truth.unit), `${label}: 끝 단위 = 서버 전체 접기`);
    assert.deepEqual(
      sorted(view.ability),
      sorted(truth.skill),
      `${label}: 끝 능력 = 서버 전체 접기`,
    );
    assert.equal(tab.record.unsent(1).length, 0, `${label}: 대기열이 비었다`);
  }
}
async function accountRun(seed, { tabsN = 2, steps = 80, lost = 0.2 } = {}) {
  const w = await accountWorld(seed, { tabsN, lost });
  for (let step = 0; step < steps; step += 1) {
    await accountStep(w);
    if (w.random() < 0.5) await hops(Math.floor(w.random() * 4));
    if (w.random() < 0.15) await accountMidCheck(w, step);
  }
  await accountDrain(w);
  await accountFinal(w);
}

test('② 계정 기록부 둘 · 셋 · 한 포트(자물쇠 없음) — 올리기 · 받기 · 치우기 · 꼬리 읽기 · 탭 다시 열기가 겹치고 답이 사라져도, 기다리지 않는 줄 = 서버 접기 · 끝 보기 = 새로 읽은 보기 = 서버 전체 접기 · 만든 사건이 모두 서버에(§18-5-6 · F6)', async () => {
  for (let seed = 1; seed <= 40; seed += 1) await accountRun(seed, { tabsN: seed % 2 ? 2 : 3 });
});

// ── ① 손님 ──
function sameLines(view, want, label) {
  sameMap(view.memory, want.memory, view.waitUnits, `${label} 단위`);
  sameMap(view.ability, want.ability, view.waitSkills, `${label} 능력`);
}

async function guestWorld(seed, tabsN) {
  const random = rng(seed);
  const items = bank(random);
  const w = {
    seed,
    random,
    items,
    index: indexOf(items, 'index-a'),
    base: memoryPort(),
    clock: T0,
    tabs: [],
    all: [],
    errors: [],
    old: { device: createLegacyDevice('old', { random }), state: newState(), log: [] },
    ledger: { keys: {}, cells: {} },
  };
  w.ctx = { items, indexEdition: 'index-a' };
  w.fire = promise => w.all.push(Promise.resolve(promise).catch(error => ({ error })));
  for (let i = 0; i < tabsN; i += 1) {
    const drift = Math.floor((random() - 0.5) * 120_000);
    const record = await openRecord({
      port: tabPort(w.base, random),
      guest: true,
      memory,
      params: PARAMS,
      index: w.index,
      now: () => w.clock + drift,
      tag: `g${i}`.padEnd(8, 'x'),
    });
    const tab = { i, record, state: newState(), flows: [] };
    tab.device = {
      name: `g${i}`,
      time: () => record.clock.lastAt,
      make(type, fields) {
        const { event, stored } = record.add(type, fields);
        tab.flows.push(stored);
        return event;
      },
    };
    w.tabs.push(tab);
  }
  return w;
}
// 옛 기록 · 장부 옮기기(host.carryLegacy와 같은 차례 — 꼬리 읽기 → importLegacy → carried). 두 탭이 같은 것을 겹쳐 옮긴다(R10).
async function carryOld(w, tab) {
  await tab.record.refresh();
  await tab.record.importLegacy(legacyToImport(w.old.log, id => tab.record.has(id)));
  const fields = carriedFields(w.ledger, carriedSoFar(tab.record.heldEvents()));
  if (fields) await tab.record.add(EVENT_TYPES.carried, fields).stored;
}
async function markAs(tab, mark, account) {
  await tab.record.refresh();
  const plan = tab.record.guestUpload(1, { account });
  await tab.record.mark({
    mark,
    account,
    revision: mark === 'moved' ? 1 : null,
    until: plan.until,
    ids: plan.current.map(event => event.id),
  });
}
function guestStep(w) {
  w.clock += Math.floor(w.random() * 3 * 60_000);
  const tab = pick(w.random, w.tabs);
  const roll = w.random();
  if (roll < 0.5) {
    try {
      stepDevice(tab.device, tab.state, w.ctx, w.random);
    } catch (error) {
      w.errors.push(error);
    }
  } else if (roll < 0.62) w.fire(tab.record.refold());
  else if (roll < 0.74) w.fire(tab.record.refresh());
  else if (roll < 0.84) {
    w.old.log.push(...stepDevice(w.old.device, w.old.state, w.ctx, w.random));
    if (w.random() < 0.5) w.ledger.keys[`family:${pick(w.random, w.items).familyKey}`] = 1;
    w.fire(carryOld(w, tab));
  } else if (roll < 0.92) {
    const mark = pick(w.random, ['moved', 'kept', 'logout', 'visited']);
    w.fire(markAs(tab, mark, mark === 'logout' ? null : pick(w.random, ['A', 'B'])));
  }
}
// 끝 — 2판 답은 요약 · 밀린 것 꼭 한쪽 · 기다리지 않는 줄 = 새로 읽은 보기 · 다시 접은 보기 · 옮길 계획이 새로 읽은 것과 같다.
async function guestFinal(w) {
  const fresh = await openRecord({
    port: w.base,
    guest: true,
    memory,
    params: PARAMS,
    index: w.index,
    now: () => w.clock,
    tag: 'freshxxx',
  });
  const answers = (await w.base.read()).filter(row => row.value.event?.schema === 2);
  for (const tab of w.tabs) {
    const label = `씨앗 ${w.seed} 탭 ${tab.i}`;
    const until = tab.record.summary.foldedUntil;
    for (const row of answers)
      assert.notEqual(
        row.key <= until,
        tab.record.pending().has(row.value.event.id),
        `${label}: ${row.value.event.id}는 요약 또는 밀린 것 꼭 한쪽에만`,
      );
    const view = tab.record.view();
    const want = fresh.view();
    if (!view.waitAll && !want.waitAll) sameLines(view, want, label);
    await tab.record.refold();
    assert.equal(linesOf(tab.record.view()), linesOf(fresh.view()), `${label}: 다시 접은 보기`);
    for (const account of ['A', 'B']) samePlans(tab.record, fresh, account, label);
  }
}
function samePlans(record, fresh, account, label) {
  const a = record.guestUpload(1, { account });
  const b = fresh.guestUpload(1, { account });
  assert.deepEqual(
    a.current.map(event => event.id),
    b.current.map(event => event.id),
    `${label}: ${account} 옮길 2판`,
  );
  assert.deepEqual(
    a.legacy.map(event => event.id).sort(),
    b.legacy.map(event => event.id).sort(),
    `${label}: ${account} 옮길 옛 꼴(같은 번호가 두 열쇠에 서도 — 넘친 #11)`,
  );
}
async function guestRun(seed, { tabsN = 2, steps = 60 } = {}) {
  const w = await guestWorld(seed, tabsN);
  for (let step = 0; step < steps; step += 1) {
    guestStep(w);
    if (w.random() < 0.5) await hops(Math.floor(w.random() * 4));
  }
  for (const tab of w.tabs) w.all.push(...tab.flows.map(p => p.catch(error => ({ error }))));
  for (const outcome of await Promise.all(w.all)) if (outcome?.error) w.errors.push(outcome.error);
  if (w.errors.length) throw w.errors[0];
  for (const tab of w.tabs) {
    await tab.record.saved();
    await tab.record.refresh();
    await tab.record.localSaved();
  }
  await guestFinal(w);
}

test('① 손님 기록부 둘 · 셋 · 한 포트(자물쇠 없음) — 옛 기록 · 장부를 겹쳐 옮기고 표지가 끼어도, 2판 답은 요약 · 밀린 것 꼭 한쪽 · 기다리지 않는 줄 = 새로 읽은 보기 · 다시 접은 보기 · 옮길 계획이 같다(§18-5-1 R10 · F6)', async () => {
  for (let seed = 1; seed <= 60; seed += 1) await guestRun(seed, { tabsN: seed % 3 ? 2 : 3 });
});
