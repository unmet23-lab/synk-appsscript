// 저장 관문 ① — 서버 접기(설계 §11): 임의의 차례 · 지연 · 제외 · 본인 말 · 옮겨 온 장부 · 같은 시각 · 태그 고침으로 돌려,
// 닿은 것만 다시 접은 줄 = 처음부터 전부 접은 줄. 근거 줄은 묶음마다 통째로 다시 짓는다.
// 기준 둘: ① linesOfGroups(기록 전부) ② 단계 2의 foldServer(기록 전부를 한 번에 — 묶음으로 나누지 않는다).
import assert from 'node:assert/strict';
import test from 'node:test';
import { seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import {
  bank,
  createDevice,
  createLegacyDevice,
  createMemoryAccount,
  indexOf,
  newState,
  pick,
  rng,
  stepDevice,
  T0,
} from '../support/trail-world.mjs';

const { foldAccount, summaryOf, entryOf, foldEdition } = await subject('record/server.mjs');
const { linesOfGroups } = await subject('record/rows.mjs');
const { groupsOf, foldEventsOfAll } = await subject('record/adapt.mjs');
const { foldServer } = await subject('fold/server.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const memory = createMemory(PARAMS);
const MINUTE = 60_000;

const plain = lines =>
  Object.fromEntries(
    Object.entries(lines).map(([kind, map]) => [kind, Object.fromEntries([...map].sort())]),
  );

async function served(server, edition) {
  const summary = await summaryOf(server.account.store(edition), { edition });
  const lines = {
    unit: new Map(),
    skill: new Map(),
    family: new Map(),
    item: new Map(),
    cell: new Map(),
  };
  for (const line of summary.lines) lines[line.kind].set(line.key, line.value);
  return lines;
}

const oracle = (server, index) =>
  linesOfGroups(groupsOf(server.log().map(entryOf)), { memory, params: PARAMS, index });

// 접기를 상한으로 나눠 끝까지. 한 번 접을 때마다 「표지가 정확하다」 — 내려 줄 줄 = 표지(어디까지 접었나)까지의 사건만 접은 기준.
async function foldAll(server, index, random, { capMax = 6, edition = null } = {}) {
  for (let guard = 0; guard < 10_000; guard += 1) {
    const cap = 1 + Math.floor(random() * capMax);
    const result = await foldAccount(server.account, {
      memory,
      params: PARAMS,
      index,
      nowMs: T0 + 1e12,
      cap,
    });
    if (!result.building && random() < 0.3) {
      const until = (await server.account.store(result.served).head()).foldedUntil;
      const prefix = server
        .log()
        .filter(r => r.seq <= until)
        .map(entryOf);
      const want = linesOfGroups(groupsOf(prefix), { memory, params: PARAMS, index });
      assert.deepEqual(
        plain(await served(server, result.served)),
        plain(want),
        `표지 ${until}까지`,
      );
    }
    if (result.done && !result.building) return result;
  }
  throw new Error('접기가 끝나지 않는다');
}

// 단계 2의 foldServer와 같은가 — 기억 · 난도 · 첫 만남.
function sameAsBrain(lines, server, index, seed) {
  const all = server.log().map(entryOf);
  const brain = foldServer(foldEventsOfAll(all, index), memory, PARAMS);
  const units = Object.fromEntries([...brain.memory].filter(([, v]) => v != null).sort());
  assert.deepEqual(Object.fromEntries([...lines.unit].sort()), units, `씨앗 ${seed}: 단위 줄`);
  const skills = Object.fromEntries([...brain.ability].sort());
  assert.deepEqual(Object.fromEntries([...lines.skill].sort()), skills, `씨앗 ${seed}: 능력 줄`);
  for (const [family, at] of brain.met)
    assert.equal(
      lines.family.get(family)?.at,
      at === Number.NEGATIVE_INFINITY ? null : at,
      `씨앗 ${seed}: 첫 만남 ${family}`,
    );
}

// 비우기(계획 §14) — 사건 몇은 다른 표(교실 연결 · 첫걸음 점수)가 물고 있어 남는다. 남은 사건은 바닥 아래라
// 뒤에 그것을 가리키는 답 · 제외가 와도 접기에 들지 않는다 — 기준(oracle)은 바닥 위 사건만으로 처음부터 접은 줄이다.
function maybeClear(server, random, seed) {
  if (random() >= 0.06) return false;
  const held = new Set(
    server
      .rawLog()
      .filter(() => random() < 0.4)
      .map(record => record.event.id),
  );
  server.pin(record => held.has(record.event.id));
  const before = server.rawLog().length;
  const { kept, floor } = server.clear();
  assert.ok(kept <= before && floor >= 0);
  assert.equal(server.heads.size, 0, `씨앗 ${seed}: 비우면 Trail 머리가 없다`);
  return true;
}

async function run(seed) {
  const random = rng(seed);
  const items = bank(random);
  const indexA = indexOf(items, 'index-a');
  const ctx = { items, indexEdition: 'index-a' };
  const devices = [
    createDevice('aaaa', { random }),
    createDevice('bbbb', { random }),
    createLegacyDevice('old', { random }),
  ];
  const states = new Map(devices.map(d => [d, newState()]));
  const queues = new Map(devices.map(d => [d, []]));
  const server = createMemoryAccount();
  let serverNow = T0;
  const steps = 20 + Math.floor(random() * 40);
  for (let step = 0; step < steps; step += 1) {
    const device = pick(random, devices);
    queues.get(device).push(...stepDevice(device, states.get(device), ctx, random));
    if (random() < 0.35) {
      const sender = pick(random, devices);
      const queue = queues.get(sender);
      const n = Math.floor(random() * (queue.length + 1));
      serverNow += Math.floor(random() * 4 * MINUTE);
      if (n) server.append(queue.splice(0, n), serverNow);
    }
    const clearing = maybeClear(server, random, seed);
    if (clearing || random() < 0.3) {
      await foldAll(server, indexA, random);
      assert.deepEqual(
        plain(await served(server, foldEdition(PARAMS, indexA))),
        plain(oracle(server, indexA)),
        `씨앗 ${seed}: ${step}번째 걸음`,
      );
    }
  }
  for (const [, queue] of queues) {
    serverNow += MINUTE;
    if (queue.length) server.append(queue.splice(0), serverNow);
  }
  await foldAll(server, indexA, random);
  const editionA = foldEdition(PARAMS, indexA);
  const before = await served(server, editionA);
  assert.deepEqual(plain(before), plain(oracle(server, indexA)), `씨앗 ${seed}: 끝`);
  sameAsBrain(before, server, indexA, seed);

  // 태그 고침 — 색인 판이 바뀌면 옆에 짓고, 짓는 동안은 앞 판 요약 그대로, 따라잡으면 바꿔 끼운다.
  const indexB = indexOf(items, 'index-b', random);
  for (let guard = 0; guard < 10_000; guard += 1) {
    const result = await foldAccount(server.account, {
      memory,
      params: PARAMS,
      index: indexB,
      nowMs: T0,
      cap: 1 + Math.floor(random() * 4),
    });
    if (result.building) {
      assert.equal(result.served, editionA);
      assert.deepEqual(
        plain(await served(server, editionA)),
        plain(before),
        `씨앗 ${seed}: 짓는 동안 앞 판 요약이 그대로`,
      );
      continue;
    }
    break;
  }
  const editionB = foldEdition(PARAMS, indexB);
  assert.equal((await server.account.active()).edition, editionB);
  assert.equal(server.heads.size, 1, '앞 판 머리는 지운다');
  const after = await served(server, editionB);
  assert.deepEqual(plain(after), plain(oracle(server, indexB)), `씨앗 ${seed}: 태그 고침 뒤`);
  sameAsBrain(after, server, indexB, seed);
}

test('서버 접기 — 닿은 것만 다시 접은 줄이 처음부터 전부 접은 줄 · 단계 2 foldServer와 같다(차례 · 지연 · 상한 · 태그 고침)', async () => {
  for (const seed of seedRange({ count: 60 })) await run(seed);
});
