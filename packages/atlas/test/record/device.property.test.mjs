// 저장 관문 ② · ③ · ④(기기 쪽) — 기기 얹기(설계 §11):
//   기기 시계가 서버가 받은 때보다 앞서지 않는 한, 기기가 얹은 줄(단위 · 능력 · 첫 만남)은 서버가 같은 사건으로 접은 값과 같다.
//   얹을 수 없는 줄은 요약 값 그대로 기다리고, 올린 뒤 온 요약으로 맞춰진다. 서버가 시각을 누른 묶음은 얹지 않는다.
//   두 기기의 답이 뒤섞여 도착해도(접기를 건너뛴 요청 · 상한 · 늦은 도착) 끝에는 같은 상태다. 한 기기가 제 차례로만 쓰면 기다리는 줄이 없다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { createClient, createServer, memory, PARAMS } from '../support/trail-sync.mjs';
import {
  bank,
  createLegacyDevice,
  indexOf,
  newState,
  pick,
  rng,
  stepDevice,
} from '../support/trail-world.mjs';

const { linesOfGroups } = await subject('record/rows.mjs');
const { groupsOf } = await subject('record/adapt.mjs');
const { entryOf } = await subject('record/server.mjs');

// 기기가 아는 사건 = 요약에 든 서버 사건(받은 차례 ≤ 요약의 「어디까지 접었나」) + 아직 요약에 안 든 내 사건.
function expectedFor(client, server, index) {
  const summary = client.record.summary;
  const until = summary?.foldedUntil ?? 0;
  const onServer = new Map(server.server.log().map(r => [r.event.id, r]));
  const entries = server.server
    .log()
    .filter(r => r.seq <= until)
    .map(entryOf);
  for (const id of client.record.pending()) {
    const record = onServer.get(id);
    if (record && record.seq <= until) continue;
    const event = record?.event ?? client.held(id);
    entries.push(record ? entryOf(record) : { event, key: event.id, atMs: Date.parse(event.at) });
  }
  return linesOfGroups(groupsOf(entries), { memory, params: PARAMS, index });
}

// 기다리지 않는 줄은 서버 값과 같고, 서버에 없는 줄이 남아 있지 않다(단위 · 능력 — 아르곤 끝 판 E4).
function sameMap(got, want, waiting, label) {
  for (const [key, line] of want)
    if (!waiting.has(key)) assert.deepEqual(got.get(key) ?? null, line, `${label} ${key}`);
  for (const key of got.keys())
    if (!waiting.has(key) && !want.has(key)) assert.fail(`${label}: 없어야 할 줄 ${key}`);
}

function sameLines(view, want, label) {
  sameMap(view.memory, want.unit, view.waitUnits, `${label}: 단위`);
  sameMap(view.ability, want.skill, view.waitSkills, `${label}: 능력`);
  for (const [family, line] of want.family)
    assert.equal(
      view.met.get(family),
      line.at ?? Number.NEGATIVE_INFINITY,
      `${label}: 첫 만남 ${family}`,
    );
  // 첫 만남 표도 양방향 — 서버가 접지 않은 계열이 남아 있지 않다(GPT 끝 판 GE2).
  for (const family of view.met.keys())
    if (!want.family.has(family)) assert.fail(`${label}: 없어야 할 첫 만남 ${family}`);
}

function checkView(client, server, index, label) {
  const view = client.record.view();
  if (view.waitAll) return 'wait';
  sameLines(view, expectedFor(client, server, index), label);
  return view.waitUnits.size || view.waitSkills.size ? 'partial' : 'clean';
}

async function act(client, server, random, old, solo) {
  const roll = random();
  if (roll < 0.35) await client.push(1 + Math.floor(random() * 6));
  else if (roll < 0.45) await client.pull();
  else if (!solo && roll < 0.5) server.legacy(stepDevice(old.device, old.state, old.ctx, random));
}

async function settleAll(clients) {
  for (let round = 0; round < 3; round += 1)
    for (const client of clients) {
      while (await client.push()) {}
      await client.pull();
    }
}

async function run(seed, { solo = false } = {}) {
  const random = rng(seed);
  const items = bank(random);
  const index = indexOf(items, 'index-a');
  const ctx = { items, indexEdition: 'index-a' };
  const server = createServer({ random, index, foldChance: solo ? 1 : 0.7 });
  const drift = () =>
    solo ? -Math.floor(random() * 60_000) : Math.floor((random() - 0.7) * 20 * 60_000);
  const clients = [
    await createClient(server, { name: 'aaaa', drift: drift() }),
    ...(solo ? [] : [await createClient(server, { name: 'bbbb', drift: drift() })]),
  ];
  for (const client of clients) client.held = id => client.record.heldEvent(id);
  const states = new Map(clients.map(c => [c, newState()]));
  const old = { device: createLegacyDevice('old', { random }), state: newState(), ctx };
  const tally = { wait: 0, partial: 0, clean: 0 };
  const steps = 20 + Math.floor(random() * 40);
  for (let step = 0; step < steps; step += 1) {
    const client = pick(random, clients);
    server.tick(Math.floor(random() * 5 * 60_000));
    stepDevice(client.device, states.get(client), { ...ctx, solo }, random);
    await client.settle();
    await act(client, server, random, old, solo);
    tally[checkView(client, server, index, `씨앗 ${seed} 걸음 ${step} ${client.name}`)] += 1;
  }
  await settleAll(clients);
  const final = clients.map(client => client.record.view());
  for (const view of final) {
    assert.equal(view.waitAll, false, `씨앗 ${seed}: 끝에는 기다리지 않는다`);
    assert.equal(
      view.waitUnits.size + view.waitSkills.size,
      0,
      `씨앗 ${seed}: 끝에는 기다리는 줄이 없다`,
    );
  }
  const all = linesOfGroups(groupsOf(server.server.log().map(entryOf)), {
    memory,
    params: PARAMS,
    index,
  });
  for (const view of final) {
    assert.deepEqual(
      Object.fromEntries([...view.memory].sort()),
      Object.fromEntries([...all.unit].sort()),
      `씨앗 ${seed}: 끝 단위`,
    );
    assert.deepEqual(
      Object.fromEntries([...view.ability].sort()),
      Object.fromEntries([...all.skill].sort()),
      `씨앗 ${seed}: 끝 능력`,
    );
    assert.deepEqual(
      Object.fromEntries([...view.met].sort()),
      Object.fromEntries(
        [...all.family]
          .map(([family, line]) => [family, line.at ?? Number.NEGATIVE_INFINITY])
          .sort(),
      ),
      `씨앗 ${seed}: 끝 첫 만남`,
    );
  }
  return tally;
}

test('기기 얹기 — 기다리지 않는 줄은 서버가 같은 사건으로 접은 값과 같고, 끝에는 두 기기가 같은 상태다', async () => {
  const total = { wait: 0, partial: 0, clean: 0 };
  for (const seed of seedRange({ count: 40 })) {
    const tally = await run(seed);
    for (const key of Object.keys(total)) total[key] += tally[key];
  }
  assert.ok(total.clean > total.wait, `얹은 줄을 실제로 맞대야 뜻이 있다 ${JSON.stringify(total)}`);
});

test('한 기기가 제 차례로만 쓰면(시계가 늦거나 같고 다른 기기가 없으면) 기다리는 줄이 없다', async () => {
  for (const seed of seedRange({ count: 30 })) {
    const tally = await run(seed, { solo: true });
    assert.equal(tally.wait + tally.partial, 0, `씨앗 ${seed}: ${JSON.stringify(tally)}`);
  }
});
