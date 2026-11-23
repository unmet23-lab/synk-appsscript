// 서버 이어 접기 대조(설계 주인 11-23 (가)) — 같은 사건 열을 메모리 서버 둘에 똑같이 올리고, 하나는 이어 접기를 켜고(기본) 하나는 끈 채
// (append: false — 지금처럼 닿은 능력을 늘 처음부터) 같은 상한으로 접는다. 접을 때마다 두 서버의 요약(통째 답 · 앞 접기 뒤의 부분 답)이 같은
// 글자다. 줄은 (갈래, 열쇠) 순으로 놓고 갱신 차례 seq만 뺀다(한 접기 안의 쓰기 순서다 — 줄 수와 머리의 lineSeq는 견준다).
// 사건 열: 기기 셋(2판 둘 · 옛 꼴 하나)이 제 시계로 만든다. 늦게 온 답(다른 기기의 뒤 답이 먼저 접힘 · 대기열에 남긴 자식이 뒤에 감) · 제외 ·
// 도움 · 장부 · 본인 말 · 같은 시각(기기 시계의 0ms 걸음 · 받은 시각으로 눌린 사건 여럿 · 받은 시각이 같은 두 요청) · firstExposure false ·
// 한 계열 두 능력(fam3 · gam3) · 상한으로 나뉜 묶음 · 옆에 짓는 판 묶음 · 비우기가 든다. 씨앗의 반은 늦은 답 판, 반은 같은 시각 판이다(createWorld).
// 기본 100씨앗에서 이어 접기 규칙(lastAt · 계열 첫 만남 · 지운 줄과 바뀐 줄)을 하나씩 깬 변형을 값으로 잡는다(tools/mutants/record.mjs).
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
const { groupsOf } = await subject('record/adapt.mjs');
const { createMemory } = await subject('memory/index.mjs');
const { PARAMS } = await subject('params.mjs');

const memory = createMemory(PARAMS);
const MINUTE = 60_000;
// 묶음의 머리(부모) — 대기열에 남기지 않는다(talk 올리기는 부모 없는 자식을 받지 않는다). 자식(전달 · 도움 · 답 · 제외)만 뒤로 미룬다.
const SOURCES = new Set(['practice.presented', 'decision.made', 'unit.stated', 'record.carried']);

const byLine = (a, b) =>
  a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
const textOf = summary =>
  JSON.stringify({ ...summary, lines: summary.lines.map(({ seq, ...line }) => line).sort(byLine) });

// 두 서버의 머리 전부(활성 · 옆에 짓는 중)를 통째 답과 since 뒤 부분 답으로 견준다.
async function sameServers(a, b, label, before = new Map()) {
  assert.deepEqual([...a.heads.keys()].sort(), [...b.heads.keys()].sort(), `${label}: 머리`);
  for (const edition of a.heads.keys()) {
    assert.equal(a.heads.get(edition).state, b.heads.get(edition).state, `${label}: 머리 상태`);
    const read = (server, since) => summaryOf(server.account.store(edition), { edition, since });
    const left = await read(a, null);
    assert.equal(textOf(left), textOf(await read(b, null)), `${label}: ${edition} 통째 요약`);
    const since = before.get(edition);
    if (since)
      assert.equal(
        textOf(await read(a, since)),
        textOf(await read(b, since)),
        `${label}: ${edition} since ${since.seq} 부분 요약`,
      );
  }
}

const sinceOf = async server => {
  const out = new Map();
  for (const [edition, head] of server.heads)
    out.set(edition, { edition, seq: head.lineSeq, gen: head.gen ?? undefined });
  return out;
};

function createPair() {
  const a = createMemoryAccount();
  const b = createMemoryAccount();
  return {
    a,
    b,
    append(events, receivedMs) {
      a.append(events, receivedMs);
      b.append(events, receivedMs);
    },
    clear(held) {
      for (const server of [a, b]) {
        server.pin(record => held.has(record.event.id));
        server.clear();
      }
    },
  };
}

const context = (index, cap, nowMs, append) => ({
  memory,
  params: PARAMS,
  index,
  nowMs,
  cap,
  random: () => 0.5, // 세대 표지(gen)를 두 서버가 같게
  ...(append ? {} : { append: false }),
});

// 끝까지 접는다 — 상한을 같게 두 서버를 한 번씩 접고 그때마다 견준다.
async function foldBoth(pair, { index, random, nowMs, tally, label }) {
  for (let guard = 0; guard < 10_000; guard += 1) {
    const cap = 1 + Math.floor(random() * 6);
    const before = await sinceOf(pair.a);
    const left = await foldAccount(pair.a.account, context(index, cap, nowMs, true));
    const right = await foldAccount(pair.b.account, context(index, cap, nowMs, false));
    assert.equal(right.skills.appended, 0, `${label}: 끈 쪽은 이어 접지 않는다`);
    assert.equal(left.changed, right.changed, `${label}: 바뀐 줄 수`);
    tally.appended += left.skills.appended;
    tally.refolded += left.skills.refolded;
    await sameServers(pair.a, pair.b, `${label} · 상한 ${cap}`, before);
    if (left.done && !left.building) return;
  }
  throw new Error('접기가 끝나지 않는다');
}

// 대기열 앞 n개를 보낸다. 자식은 얼마쯤 남겨 뒤 요청으로 미룬다(늦게 온 도움 · 전달 · 답 — 접힌 답의 줄이 바뀌거나 첫 만남이 바뀐다).
function sendSome(queue, random) {
  const n = Math.floor(random() * (queue.length + 1));
  const sent = [];
  const kept = [];
  queue.forEach((event, i) => {
    if (i < n && (SOURCES.has(event.type) || random() >= 0.2)) sent.push(event);
    else kept.push(event);
  });
  queue.splice(0, queue.length, ...kept);
  return sent;
}

function createWorld(seed) {
  const random = rng(seed);
  // 계열 여덟(fam · gam 넷씩, fam3 · gam3은 두 능력) — 첫 만남(측정 답)이 여러 계열에 고루 서야 같은 시각의 차례가 값을 가른다.
  const items = [
    ...bank(random),
    ...bank(random).map(item => ({
      ...item,
      itemKey: item.itemKey.replace('it', 'iu'),
      familyKey: item.familyKey.replace('fam', 'gam'),
    })),
  ];
  // 씨앗의 반은 「늦은 답」 판(기기 시계가 서버와 같이 출발 — 다른 기기 · 남긴 자식이 늦게 온다), 반은 「같은 시각」 판(기기 시계가 서버보다 두세 시간 앞서
  // 사건이 모두 받은 시각으로 눌리고, 서버 시계가 자주 멈춰 여러 요청 · 접기가 같은 밀리초를 나눈다 — 남긴 자식과 덜 앞선 기기의 번호가 더 작다).
  const tied = random() < 0.5;
  const start = () => T0 + (tied ? (120 + Math.floor(random() * 60)) * MINUTE : 0);
  const devices = [
    createDevice('aaaa', { random, start: start() }),
    createDevice('bbbb', { random, start: start() }),
    createLegacyDevice('old', { random, start: start() }),
  ];
  return {
    seed,
    random,
    ctx: { items, indexEdition: 'index-a' },
    indexA: indexOf(items, 'index-a'),
    indexB: indexOf(items, 'index-b', random),
    devices,
    states: new Map(devices.map(d => [d, newState()])),
    queues: new Map(devices.map(d => [d, []])),
    pair: createPair(),
    serverNow: T0,
    pause: tied ? 0.7 : 0.25,
  };
}

// 기기 하나가 사건을 만들고, 얼마쯤 어느 기기의 대기열을 보낸다.
function makeAndSend(world) {
  const { random, devices } = world;
  const device = pick(random, devices);
  // 기기 시계가 서버보다 앞서면 받은 시각으로 눌린다 — 한 요청의 사건이 같은 밀리초에 모인다.
  if (device.tick && random() < 0.04) device.tick(Math.floor(random() * 20 * MINUTE));
  world.queues.get(device).push(...stepDevice(device, world.states.get(device), world.ctx, random));
  if (random() >= 0.35) return;
  // 받은 시각이 같은 두 요청(같은 시각의 눌린 사건이 두 접기에 걸친다)도 나오게 서버 시계는 가끔 멈춘다.
  if (random() >= world.pause) world.serverNow += Math.floor(random() * 6 * MINUTE);
  const sent = sendSome(world.queues.get(pick(random, devices)), random);
  if (sent.length) world.pair.append(sent, world.serverNow);
}

// 비우기 — 다른 표가 문 사건 몇은 남는다. 비우면 동의 판이 바뀌어 기기의 밀린 대기열은 받지 않고(EVENT_REVISION), 비우기 전 제시 ·
// 결정에 달 자식도 없다(EVENT_LINK).
function clearBoth(world) {
  const held = new Set(
    world.pair.a
      .rawLog()
      .filter(() => world.random() < 0.4)
      .map(record => record.event.id),
  );
  world.pair.clear(held);
  for (const d of world.devices) {
    world.states.set(d, newState());
    world.queues.set(d, []);
  }
}

// 이어 접은 쪽도 처음부터 전부 접은 기준(linesOfGroups)과 같다.
async function sameAsOracle(world, index) {
  const edition = foldEdition(PARAMS, index);
  const summary = await summaryOf(world.pair.a.account.store(edition), { edition });
  const want = linesOfGroups(groupsOf(world.pair.a.log().map(entryOf)), {
    memory,
    params: PARAMS,
    index,
  });
  const got = Object.fromEntries(Object.keys(want).map(kind => [kind, {}]));
  for (const line of summary.lines) got[line.kind][line.key] = line.value;
  for (const kind of Object.keys(want))
    assert.deepEqual(
      got[kind],
      Object.fromEntries(want[kind]),
      `씨앗 ${world.seed}: ${kind} 줄 = 기준`,
    );
}

async function run(seed, tally) {
  const world = createWorld(seed);
  const { random } = world;
  let index = world.indexA;
  const fold = label =>
    foldBoth(world.pair, { index, random, nowMs: world.serverNow, tally, label });
  const steps = 20 + Math.floor(random() * 40);
  const switchAt = Math.floor(random() * steps * 1.5); // 판 묶음 바꾸기(태그 고침) — 반쯤은 길 가운데서
  for (let step = 0; step < steps; step += 1) {
    makeAndSend(world);
    if (step === switchAt) index = world.indexB;
    if (random() < 0.03) clearBoth(world);
    if (random() < 0.3) await fold(`씨앗 ${seed} 걸음 ${step}`);
  }
  for (const [, queue] of world.queues) {
    world.serverNow += MINUTE;
    if (queue.length) world.pair.append(queue.splice(0), world.serverNow);
  }
  await fold(`씨앗 ${seed} 끝`);
  await sameAsOracle(world, index);
}
test('서버 이어 접기 — 켠 쪽과 끈 쪽의 요약이 접을 때마다 같은 글자다(늦은 답 · 제외 · 도움 · 장부 · 같은 시각 · 상한 · 옆에 짓기 · 비우기)', async t => {
  const tally = { appended: 0, refolded: 0 };
  for (const seed of seedRange({ count: 100 })) await run(seed, tally);
  t.diagnostic(`이어 접은 능력 ${tally.appended} · 처음부터 접은 능력 ${tally.refolded}`);
  assert.ok(tally.appended > 0, `이어 접은 능력이 있다(${tally.appended})`);
  assert.ok(tally.refolded > 0, `처음부터 접은 능력이 있다(${tally.refolded})`);
});
