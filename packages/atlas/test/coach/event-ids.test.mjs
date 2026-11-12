// 코치 3판 — 계획 §16 「시각 대신 사건 번호로」와 Fable 5.2 설계 검토(D1~D9). 「누가 · 무엇을」은 시각이 아니라 사건 번호로 가른다.
//   ① 판 안의 「낸 것」 — 다시 세울 때 호스트의 것 전부를 다시 받고 다시 돌릴 내 제시만 번호로 뺀다(D7 · D8)
//   ② 측정용 첫 만남 — 만난 표 시각의 만남 가운데 접기의 차례로 맨 앞 하나(D1 · D2 · D6)
//   ③ 옛 기록 옮기기 — 호스트당 약속 하나를 받는 모든 코치가 기다린다(D3 · D4)
//   ④ 쓰는 사람 셈 — 받기의 첫 기다림 전에 세고, 센 뒤에는 어떤 실패에서도 되돌린다(D5) · 판 번호의 코치 꼬리(D9)
// 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { pick, rng, seedRange } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import {
  bankOf,
  clock,
  createCoach,
  EVENT_TYPES,
  fakeMap,
  memoryPort,
  PARAMS,
  STEP,
} from './support.mjs';

const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
const { foldEdition } = await subject('record/server.mjs');
const { emptySummary, packSummary } = await subject('record/summary.mjs');
const { foldEventsOf, groupsOf } = await subject('record/adapt.mjs');
const { evidenceOf } = await subject('fold/evidence.mjs');
const { skillRowsOf } = await subject('fold/server.mjs');
const { createHealth } = await subject('health/index.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let stores = 0;
const keyOf = tag => `synk-atlas:ids-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const eventsOf = async port => (await port.read()).map(row => row.value.event).filter(Boolean);
const origin = { origin: 'https://world.test' };

function topWindow(openPort = () => memoryPort()) {
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort });
  return top;
}
const frameOf = top => ({
  location: origin,
  parent: top,
  addEventListener() {},
  removeEventListener() {},
});

function coachOn({ items, time, gameId = 'g', seed = 's', scope, params, mapEdition, ...host }) {
  return createCoach({
    gameId,
    map: fakeMap(items, mapEdition),
    seed,
    dayOffset: 0,
    ...(params ? { params } : {}),
    ...(scope ? { scope } : {}),
    host: { guest: true, now: time.now, ...host },
  });
}

// 단위 하나짜리 문항 n개(계열 · 단위가 저마다 다르다).
const words = (count, tag = 'w') =>
  Array.from({ length: count }, (_, i) =>
    Object.freeze({
      itemKey: `${tag}.i${i}`,
      familyKey: `${tag}.f${i}`,
      skillId: `ko.reading.${tag}`,
      difficulty: 1,
      responseFormat: 'single-choice',
      units: Object.freeze([`ko.word.${tag}${i}`]),
      order: i,
      modality: 'reading',
    }),
  );

// 같은 판에서 엔진이 고르는 대로 낼 때 처음 낸 단위 수.
async function freshServed(coach, port, candidates, time, steps = 10) {
  let fresh = 0;
  for (let step = 0; step < steps; step += 1) {
    const picked = coach.recommend(candidates);
    if (picked.status !== 'ready') break;
    const pid = coach.present(picked.selected);
    fresh += (await eventsOf(port)).find(e => e.id === pid).reason.introduced.length;
    await coach.answer(pid, { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  return fresh;
}

// 손님 접기의 lead — 기록부가 든 사건 전부를 어댑터로 접고 계열마다 만남을 (시각, 번호) 순으로 놓았을 때, 답마다 「그 계열의 첫 만남이고
// 혼자 낸 판정된 답인가」(칸의 independent에 드는 답). 서버 · 손님 요약의 cellLines가 세는 것과 같다.
function foldLeads(events, index) {
  const entries = events.map(event => ({ event, key: event.id, atMs: Date.parse(event.at) }));
  const folds = [...groupsOf(entries).values()].flatMap(group => foldEventsOf(group, index));
  const solo = new Map();
  for (const list of evidenceOf(folds).marks.values())
    for (const row of skillRowsOf(list))
      solo.set(row.id, row.lead && row.unaided && row.grade != null);
  return solo;
}
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });

// ① 판 안의 「낸 것」 ─────────────────────────────────────────────────────────────

test('다른 탭이 판을 연 뒤 낸 것은 그 탭의 시계가 뒤여도 이 판의 하루 한도에 든다 — 시각이 아니라 번호로 가른다(§16 ①)', async () => {
  const items = words(40, 'c');
  const port = memoryPort();
  const time = clock();
  const behind = clock(time.t - 10 * 60_000); // 다른 탭의 시계가 10분 뒤
  const key = keyOf('tab-behind');
  const [topA, topB] = [topWindow(() => port), topWindow(() => port)];
  const a = coachOn({ items, time, key, gameId: 'a', scope: topA });
  await a.ready;
  const b = coachOn({ items, time: behind, key, gameId: 'b', scope: topB });
  await b.ready;
  a.recommend(items, { set: { length: 30, newLimit: 50 } }); // A가 먼저 판을 연다
  for (const item of items.slice(20, 38)) {
    await b.answer(b.present(item), { correct: true, assessable: true }).stored; // B가 새 단위 18개(시계는 A보다 뒤)
    behind.advance(1000);
  }
  const hostA = await acquireHost({ key, params: PARAMS, now: time.now, guest: true }, topA);
  await hostA.refresh(); // 다른 탭의 꼬리를 읽는다(BroadcastChannel 소식과 같은 길)
  releaseHost(hostA);
  const fresh = await freshServed(a, port, items.slice(0, 20), time);
  assert.ok(fresh <= 2, `A가 낸 새 단위 ${fresh} — 하루 20 가운데 B가 18`);
  a.dispose();
  b.dispose();
});

test('판 도중 서버 요약으로 온 다른 기기의 낸 것도 이 판의 하루 한도에 든다(§16 ① — r3 GA1)', async () => {
  const items = words(40, 's');
  const map = fakeMap(items);
  const time = clock();
  const port = memoryPort();
  const edition = foldEdition(PARAMS, { edition: 'index-t' });
  // 계정 기기 — 받아 둔 요약(빈 줄)의 판 묶음이 지금 엔진과 같아 보기가 얹는다.
  await port.append([
    {
      kind: 'ack',
      acks: [],
      clamped: [],
      dropped: [],
      summary: packSummary(emptySummary(edition)),
    },
  ]);
  let seq = 0;
  const others = () =>
    Array.from({ length: 18 }, (_, i) => ({
      id: `a.${time.t - 1000}.${String(i).padStart(4, '0')}.otherdev`,
      at: time.t - 1000,
      review: false,
      units: [`ko.word.s${20 + i}`],
    }));
  const transport = async events => ({
    accepted: events.map(event => ({ id: event.id, seq: (seq += 1) })),
    clamped: [],
    rejected: [],
    summary: { edition, full: true, foldedUntil: 0, lineSeq: 1, issued: others(), lines: [] },
    serverTime: time.t,
  });
  const key = keyOf('server-issued');
  const host = { guest: false, account: 'acct-ids', revision: 1, key, port, transport };
  const coach = createCoach({
    gameId: 'acct',
    map,
    seed: 's',
    dayOffset: 0,
    host: { ...host, now: time.now },
  });
  await coach.ready;
  coach.recommend(items, { set: { length: 30, newLimit: 50 } });
  assert.equal(
    await freshServed(coach, port, items.slice(0, 20), time, 2),
    2,
    '판을 열고 새 단위 둘',
  );
  time.advance(60_000);
  const handle = await acquireHost(
    { key, params: PARAMS, now: time.now, guest: false },
    globalThis,
  );
  await handle.upload(); // 서버의 답 — 다른 기기가 오늘 낸 새 단위 18개가 요약의 「낸 것」으로 온다
  releaseHost(handle);
  const fresh = await freshServed(coach, port, items.slice(0, 20), time);
  assert.equal(fresh, 0, `오늘 새 단위 20(내 것 2 + 다른 기기 18) — 더 낸 새 단위 ${fresh}`);
  coach.dispose();
});

test('탭 A가 받은 서버 요약 · 표지(버린 사건 포함)가 같은 저장소의 탭 B 고르기에 든다 — 서버의 답을 받은 탭도 다른 탭에 알린다(GPT 최종 GC1)', async () => {
  const items = words(40, 'g');
  const time = clock();
  const port = memoryPort(); // 두 탭이 같은 저장소를 본다
  const edition = foldEdition(PARAMS, { edition: 'index-t' });
  // 계정 기기 — 받아 둔 요약(빈 줄)의 판 묶음이 지금 엔진과 같아 보기가 얹는다.
  await port.append([
    {
      kind: 'ack',
      acks: [],
      clamped: [],
      dropped: [],
      summary: packSummary(emptySummary(edition)),
    },
  ]);
  let seq = 0;
  const others = Array.from({ length: 18 }, (_, i) => ({
    id: `a.${time.t - 1000}.${String(i).padStart(4, '0')}.otherdev`,
    at: time.t - 1000,
    review: false,
    units: [`ko.word.g${20 + i}`],
  }));
  const sent = [];
  // 서버의 답 — 맨 끝 사건 하나는 버리고(rejected) 나머지는 받으며, 다른 기기가 오늘 낸 새 단위 18개가 요약의 「낸 것」으로 온다.
  const transport = async events => {
    sent.push(...events.map(event => event.id));
    return {
      accepted: events.slice(0, -1).map(event => ({ id: event.id, seq: (seq += 1) })),
      clamped: [],
      rejected: [events.at(-1).id],
      summary: { edition, full: true, foldedUntil: 0, lineSeq: 1, issued: others, lines: [] },
      serverTime: time.t,
    };
  };
  const key = keyOf('tab-receive');
  const account = { guest: false, account: 'acct-tabs', revision: 1, key };
  const [topA, topB] = [topWindow(() => port), topWindow(() => port)];
  const a = coachOn({ items, time, gameId: 'a', scope: topA, ...account, transport }); // 올리는 탭
  await a.ready;
  const b = coachOn({ items, time, gameId: 'b', scope: topB, ...account }); // 올리지 않는 탭
  await b.ready;
  b.recommend(items, { set: { length: 30, newLimit: 50 } });
  assert.equal(
    await freshServed(b, port, items.slice(0, 20), time, 2),
    2,
    'B가 판을 열고 새 단위 둘',
  );
  time.advance(60_000);
  const hostA = await acquireHost({ key, params: PARAMS, now: time.now, guest: false }, topA);
  await hostA.refresh(); // B의 쓰기를 읽는다(BroadcastChannel 소식과 같은 길)
  await hostA.upload();
  releaseHost(hostA);
  assert.ok(sent.length > 0, 'A가 B의 사건을 올렸다');
  for (let wait = 0; wait < 20 && b.summary().storage.unsent > 0; wait += 1) await settle();
  assert.equal(b.summary().storage.unsent, 0, 'A가 받은 표지 · 버린 사건을 B도 읽었다');
  const fresh = await freshServed(b, port, items.slice(0, 20), time);
  assert.equal(fresh, 0, `오늘 새 단위 20(B 2 + 다른 기기 18) — B가 더 낸 새 단위 ${fresh}`);
  a.dispose();
  b.dispose();
});

// 돌아온 것(층 1)으로 낸 문항 수 — 하루 복습 상한(reviewsPerDay 3)까지. between은 걸음마다 판을 다시 세우게 하는 바깥 일.
async function reviewRun({ coach, port, time, items, between }) {
  coach.recommend(items, { set: { length: 8, newLimit: 8 } });
  for (const item of items) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  coach.finishSet({ record: false });
  await between();
  time.advance(40 * DAY);
  await between();
  const before = new Set((await eventsOf(port)).map(event => event.id));
  coach.recommend(items, { set: { length: 10, newLimit: 0 } });
  for (let step = 0; step < 8; step += 1) {
    const picked = coach.recommend(items);
    if (picked.status !== 'ready' || picked.tier !== 1) break;
    await coach.answer(coach.present(picked.selected), { correct: true, assessable: true }).stored;
    await between();
    time.advance(STEP);
  }
  const served = (await eventsOf(port)).filter(
    event => !before.has(event.id) && event.type === EVENT_TYPES.presented,
  );
  return served.filter(event => event.reason.tier === 1).length;
}

test('돌아온 것으로 낸 내 제시는 판이 다시 서도 두 번 세지 않는다 — 하루 복습 상한까지 낸다(§16 ① · Fable 5.2 D8)', async () => {
  const items = words(8, 'r');
  const port = memoryPort();
  const time = clock();
  const key = keyOf('reviews');
  const params = { ...PARAMS, reviewsPerDay: 3 };
  const coach = coachOn({ items, time, port, key, params });
  const other = coachOn({ items, time, port, key, params, gameId: 'other' });
  await Promise.all([coach.ready, other.ready]);
  const between = async () => {
    other.tell('ko.word.zz', 'known'); // 같은 문서 다른 코치의 쓰기 — 판이 다시 선다
    await settle();
  };
  assert.equal(await reviewRun({ coach, port, time, items, between }), 3);
  coach.dispose();
  other.dispose();
});

test('하루 복습 상한에 걸려 낼 것이 없으면(none) 그 까닭(day.capped)과 문장을 싣는다 — 제품이 판 끝 줄을 사실대로(Fable 5.2 최종 F2)', async () => {
  const items = words(8, 'c');
  const time = clock();
  const params = { ...PARAMS, reviewsPerDay: 3 };
  const coach = coachOn({ items, time, port: memoryPort(), key: keyOf('capped-none'), params });
  await coach.ready;
  coach.recommend(items, { set: { length: 8, newLimit: 8 } });
  for (const item of items) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  coach.finishSet({ record: false });
  time.advance(40 * DAY);
  coach.recommend(items, { set: { length: 10, newLimit: 0 } });
  const served = new Set();
  const left = () => items.filter(item => !served.has(item.itemKey));
  for (let step = 0; step < 3; step += 1) {
    const picked = coach.recommend(left());
    assert.equal(picked.tier, 1, '돌아온 것');
    served.add(picked.selected.itemKey);
    await coach.answer(coach.present(picked.selected), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
  const none = coach.recommend(left());
  assert.equal(none.status, 'none');
  assert.equal(none.facts.held, 'day');
  assert.equal(none.why?.code, 'day.capped');
  assert.match(none.why.line, /오늘은 여기까지예요/);
  // 까닭을 모르는 none(후보가 없음)에는 이유가 없다
  assert.equal(coach.recommend([]).why, null);
  coach.dispose();
});

test('손님 길로 여는 계정은 저장소 이름을 스스로 짓지 않는다 — key 없이 guest와 account를 함께 주면 준비가 거절된다(Fable 5.2 최종 F6)', async () => {
  const items = words(2, 'g');
  const time = clock();
  const ambiguous = coachOn({ items, time, port: memoryPort(), account: 'acct-off', revision: 1 });
  await assert.rejects(ambiguous.ready, /저장소 이름/);
  ambiguous.dispose();
  const named = coachOn({
    items,
    time,
    port: memoryPort(),
    account: 'acct-off',
    revision: 1,
    key: keyOf('consent-off'),
  });
  await named.ready;
  named.dispose();
});

test('내 제시가 서버에서 접혀(시각이 눌려) 요약의 「낸 것」 줄로 돌아온 뒤에도 번호로 빼 두 번 세지 않는다(Fable 5.2 D8)', async () => {
  const items = words(8, 'v');
  const map = fakeMap(items);
  const server = createServer({ random: rng(61), index: indexOfMap(map) });
  const time = clock(server.now + HOUR); // 기기 시계가 서버보다 앞서 서버가 시각을 누른다
  const port = memoryPort();
  const key = keyOf('server-folded');
  const transport = events => server.post(events, null);
  const params = { ...PARAMS, reviewsPerDay: 3 };
  const coach = createCoach({
    gameId: 'acct',
    map,
    seed: 's',
    dayOffset: 0,
    params,
    host: { guest: false, account: 'acct-fold', revision: 1, key, port, transport, now: time.now },
  });
  await coach.ready;
  const handle = await acquireHost({ key, params, now: time.now, guest: false }, globalThis);
  let first = true;
  const between = async () => {
    await handle.settled();
    await handle.upload();
    if (first) server.tick(40 * DAY); // 40일 뒤에도 서버가 기기보다 뒤에 있게
    first = false;
    await settle();
  };
  const reviews = await reviewRun({ coach, port, time, items, between });
  const folded = handle.trail.summary()?.issued ?? [];
  assert.ok(folded.length > 0, '서버가 접은 요약의 「낸 것」 줄이 왔다');
  assert.equal(reviews, 3);
  releaseHost(handle);
  coach.dispose();
});

test('host.issued()는 번호로 합친다 — 제시가 기록부에 든 뒤 저장 끝을 듣기 전에도 한 줄이다(Fable 5.2 D8)', async () => {
  const items = words(40, 'd');
  const time = clock();
  const base = memoryPort();
  let gate = null;
  // 손님 요약(kind: 'local') 쓰기만 붙든다 — 느린 IndexedDB 쓰기 흉내(64개째 사건에서 손님이 요약을 다시 접는다).
  const port = {
    ...base,
    append: async values => {
      if (gate && values.some(value => value.kind === 'local')) await gate.promise;
      return base.append(values);
    },
  };
  const key = keyOf('dup');
  const coach = coachOn({ items, time, port, key });
  await coach.ready;
  const host = await acquireHost({ key, params: PARAMS, now: time.now, guest: true }, globalThis);
  for (const item of items.slice(0, 31)) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(1000);
  }
  coach.present(items[31]);
  await settle();
  let release = null;
  gate = { promise: new Promise(resolve => (release = resolve)) };
  time.advance(1000);
  const pid = coach.present(items[32]);
  await settle();
  await settle();
  assert.equal(host.trail.heldEvent(pid)?.id, pid, '제시가 기록부에 들었다');
  assert.equal(host.issued().filter(row => row.id === pid).length, 1, '저장 끝을 듣기 전');
  release();
  await settle();
  assert.equal(host.issued().filter(row => row.id === pid).length, 1, '저장 끝을 들은 뒤');
  releaseHost(host);
  coach.dispose();
});

test('제외한 내 제시도 기록부 · 서버의 「낸 것」처럼 이 판의 하루 한도에 남는다(Fable 5.2 D7)', async () => {
  const items = words(60, 'x');
  const time = clock();
  const port = memoryPort();
  const key = keyOf('excluded');
  const coach = coachOn({ items, time, port, key });
  await coach.ready;
  coach.recommend(items, { set: { length: 60, newLimit: 60 } });
  const pulled = [];
  for (const item of items.slice(0, 3)) {
    pulled.push(coach.present(item)); // 새 단위 셋을 띄우고
    time.advance(1000);
  }
  await settle();
  for (const pid of pulled) coach.exclude(pid); // 그 제시 셋을 제외한다
  await settle();
  await settle();
  const fresh = await freshServed(coach, port, items.slice(3), time, 40);
  const host = await acquireHost({ key, params: PARAMS, now: time.now, guest: true }, globalThis);
  const today = new Set(host.issued().flatMap(row => row.units));
  releaseHost(host);
  assert.equal(fresh, PARAMS.newPerDay - 3, '제외한 셋을 뺀 만큼만 더 낸다');
  assert.equal(today.size, PARAMS.newPerDay, `기록부의 오늘 새 단위 ${today.size}`);
  coach.dispose();
});

// ② 측정용 첫 만남 ─────────────────────────────────────────────────────────────

// 한 걸음 — A가 문항 하나를 띄우고(가끔 답 앞 도움) 답한다(가끔 판정 못 함 · 둘째 답). B는 가끔 같은 은행 문항을 띄우거나 답한다.
async function stepFolds({ a, b, items, random, time, out }) {
  if (random() < 0.3) {
    const pid = b.present(pick(random, items));
    if (random() < 0.5) out.push(b.answer(pid, { correct: random() < 0.6, assessable: true }));
    time.advance(500 + Math.floor(random() * 3000));
  }
  const pid = a.present(pick(random, items));
  time.advance(500 + Math.floor(random() * 3000));
  if (random() < 0.25) a.help(pid, 'hint');
  const assessable = random() < 0.85;
  out.push(a.answer(pid, { correct: assessable ? random() < 0.6 : null, assessable }));
  time.advance(500 + Math.floor(random() * 3000));
  if (random() < 0.3) out.push(a.answer(pid, { correct: random() < 0.6, assessable: true }));
  time.advance(STEP);
}

async function leadRun(seed) {
  const random = rng(seed + 700);
  const items = bankOf(random, { items: 10 });
  const port = memoryPort();
  const time = clock();
  const key = keyOf('lead');
  const a = coachOn({ items, time, port, key, gameId: 'a' });
  const b = coachOn({ items, time, port, key, gameId: 'b' });
  await Promise.all([a.ready, b.ready]);
  const out = [];
  for (let step = 0; step < 14; step += 1) await stepFolds({ a, b, items, random, time, out });
  const evidence = await Promise.all(out.map(row => row.evidence));
  await a.finishSet({ record: false }).folded;
  const solo = foldLeads(await eventsOf(port), indexOfMap(fakeMap(items)));
  const cells = a.summary().skills.flatMap(skill => skill.cells);
  a.dispose();
  b.dispose();
  return { out, evidence, solo, cells };
}

test('코치의 independent = 손님 접기의 lead — 둘째 답 · 답 앞 도움 · 다른 코치가 띄움 · 판정 못 한 답을 섞어도(Fable 5.2 D1)', async () => {
  let independent = 0;
  for (const seed of seedRange({ count: 12 })) {
    const { out, evidence, solo, cells } = await leadRun(seed);
    out.forEach((row, i) => {
      assert.equal(
        evidence[i].independent,
        solo.get(row.eventId) === true,
        `씨앗 ${seed} · 답 ${row.eventId}`,
      );
    });
    const counted = evidence.filter(row => row.independent).length;
    const folded = cells.reduce((sum, cell) => sum + cell.independent, 0);
    assert.equal(counted, folded, `씨앗 ${seed} — 손님 요약 칸의 혼자 낸 첫 답 수`);
    independent += counted;
  }
  assert.ok(independent > 10, `혼자 낸 첫 답 ${independent}`);
});

test('보기가 아무것도 얹지 못하는 동안(요약 전 계정)의 답은 처음이 아니라고 하지 않고 「모름」이다(Fable 5.2 D2)', async () => {
  const items = bankOf(rng(3));
  const X = items[0];
  const time = clock();
  const port = memoryPort();
  const coach = coachOn({
    items,
    time,
    port,
    key: keyOf('unknown'),
    guest: false,
    account: 'acct-u',
    revision: 1,
  });
  await coach.ready;
  coach.recommend([X], { set: { length: 3 } });
  const pid = coach.present(X);
  assert.equal((await eventsOf(port)).find(e => e.id === pid).firstExposure, null);
  time.advance(2000);
  const evidence = await coach.answer(pid, { correct: true, assessable: true }).evidence;
  assert.equal(evidence.exposure, 'unknown');
  assert.equal(evidence.independent, false);
  coach.dispose();
});

test('제품이 「처음이 아니다」라고 한 제시의 답은 처음이 아니다 — 그 제시의 장부 만남이 맨 앞이다(§16 ②)', async () => {
  const items = bankOf(rng(4));
  const time = clock();
  const coach = coachOn({ items, time, port: memoryPort(), key: keyOf('prior') });
  await coach.ready;
  coach.recommend([items[2]], { set: { length: 3 } });
  const pid = coach.present(items[2], { firstExposure: false });
  time.advance(1000);
  const evidence = await coach.answer(pid, { correct: true, assessable: true }).evidence;
  assert.equal(evidence.exposure, 'repeat');
  assert.equal(evidence.independent, false);
  coach.dispose();
});

test('두 탭이 같은 계열을 같은 밀리초에 답해도 상대 사건을 읽은 뒤에는 한쪽만 처음이고, 그쪽이 접기의 lead다(Fable 5.2 D6)', async () => {
  const port = memoryPort(); // 두 탭이 같은 저장소를 본다
  const items = bankOf(rng(22)); // items[0] · items[1]은 같은 계열
  const time = clock();
  const key = keyOf('tabs');
  const tabs = [topWindow(() => port), topWindow(() => port)];
  const [one, two] = tabs.map(scope =>
    coachOn({ items, time, key, gameId: 'world-practice', scope }),
  );
  await Promise.all([one.ready, two.ready]);
  const p1 = one.present(items[0]);
  const p2 = two.present(items[1]);
  await settle();
  await settle();
  time.advance(5000);
  const a1 = one.answer(p1, { correct: true, assessable: true }); // 같은 틱 — 같은 밀리초
  const a2 = two.answer(p2, { correct: true, assessable: true });
  const [e1, e2] = await Promise.all([a1.evidence, a2.evidence]);
  const events = await eventsOf(port);
  const at = id => events.find(event => event.id === id).at;
  assert.equal(at(a1.eventId), at(a2.eventId), '같은 밀리초');
  assert.equal([e1, e2].filter(row => row.exposure === 'new').length, 1, '한쪽만 처음');
  const solo = foldLeads(events, indexOfMap(fakeMap(items)));
  assert.equal(e1.independent, solo.get(a1.eventId) === true);
  assert.equal(e2.independent, solo.get(a2.eventId) === true);
  one.dispose();
  two.dispose();
});

// ③ 옛 기록 옮기기 ─────────────────────────────────────────────────────────────

// X와 Y는 단위 U 하나를 같이 묻고 계열이 다르다. 옛 장부는 계열 X를 이미 만났다.
const row = (i, unit) =>
  Object.freeze({
    itemKey: `h.i${i}`,
    familyKey: `h.f${i}`,
    skillId: 'ko.reading.h',
    difficulty: 1,
    responseFormat: 'single-choice',
    units: Object.freeze([unit]),
    order: i,
    modality: 'reading',
  });
const [X, Y, Z] = [row(0, 'ko.word.u'), row(1, 'ko.word.u'), row(2, 'ko.word.z')];
const legacyOf = () => ({ log: [], ledger: { keys: { [`family:${X.familyKey}`]: 1 }, cells: {} } });

test('읽개 없는 셸 코치가 먼저 받은 저장소도 뒤 셸 코치의 읽개로 옛 기록을 옮긴다(Fable 5.2 D3)', async () => {
  const top = topWindow();
  const time = clock();
  const key = keyOf('late-reader');
  const plain = coachOn({ items: [X, Y, Z], time, key, gameId: 'notice', scope: top });
  await plain.ready;
  const practice = coachOn({
    items: [X, Y, Z],
    time,
    key,
    gameId: 'practice',
    scope: top,
    legacy: async () => legacyOf(),
  });
  await practice.ready;
  assert.equal(practice.exposure(X).met, true, '옛 장부의 계열이 옮겨 왔다');
  plain.dispose();
  practice.dispose();
});

test('탭 A가 옛 기록을 옮기면 같은 저장소를 연 탭 B도 옮겨 온 만남을 본다 — 옮기기 뒤에도 다른 탭에 알린다(GPT 끝 판 GB1)', async () => {
  const time = clock();
  const port = memoryPort(); // 두 탭이 같은 손님 저장소를 본다
  const key = keyOf('tab-carry');
  const [topA, topB] = [topWindow(() => port), topWindow(() => port)];
  const b = coachOn({ items: [X, Y, Z], time, key, gameId: 'b', scope: topB }); // 읽개 없는 탭
  await b.ready;
  assert.equal(b.exposure(X).met, false, '옮기기 전');
  const a = coachOn({
    items: [X, Y, Z],
    time,
    key,
    gameId: 'a',
    scope: topA,
    legacy: async () => legacyOf(),
  });
  await a.ready;
  for (let i = 0; i < 20 && b.exposure(X).met !== true; i += 1) await settle();
  assert.equal(b.exposure(X).met, true, '탭 B가 꼬리를 읽어 옮겨 온 장부의 계열을 본다');
  a.dispose();
  b.dispose();
});

test('뒤에 같은 저장소를 받은 셸 코치의 계기가 걸린다 — 셸이 받을 때마다 그 셸의 것으로(Fable 5.2 D3)', async () => {
  const time = clock();
  const port = memoryPort();
  const key = keyOf('late-health');
  const first = createHealth();
  const second = createHealth();
  const a = coachOn({ items: [X, Y, Z], time, port, key, gameId: 'a', health: first });
  await a.ready;
  const b = coachOn({ items: [X, Y, Z], time, port, key, gameId: 'b', health: second });
  await b.ready;
  port.failNext(new Error('quota'));
  b.present(X);
  await settle();
  assert.equal(second.snapshot().save.failures, 1, '뒤에 받은 셸의 계기에 남는다');
  assert.equal(first.snapshot().save.failures, 0);
  a.dispose();
  b.dispose();
});

test('옮기기가 끝나면 먼저 준비된 틀 코치의 판도 옮겨 온 만남으로 다시 선다(Fable 5.2 D4 ㉠)', async () => {
  const top = topWindow();
  const time = clock();
  const key = keyOf('adopt-rebuild');
  const items = [X, Y, Z];
  const skillTerm = coach => coach.recommend([X]).expected.skill;
  const game = coachOn({ items, time, key, gameId: 'game', scope: frameOf(top) });
  await game.ready;
  game.recommend([Y], { set: { length: 5 } }); // 틀이 판을 열고 Y(단위 U)를 맞힌다
  await game.answer(game.present(Y), { correct: true, assessable: true }).stored;
  time.advance(60_000);
  const before = skillTerm(game);
  const shell = coachOn({
    items,
    time,
    key,
    gameId: 'shell',
    scope: top,
    legacy: async () => legacyOf(),
  });
  await shell.ready;
  assert.equal(shell.exposure(X).met, true);
  assert.notEqual(skillTerm(shell), before, '셸은 옮겨 온 만남으로 고른다');
  assert.equal(skillTerm(game), skillTerm(shell), '틀의 판도 다른 쓰기 없이 다시 섰다');
  game.dispose();
  shell.dispose();
});

test('옮기는 사이 같은 저장소를 받는 셸 · 틀 코치는 모두 옮기기 끝을 기다린 뒤 준비를 끝낸다 — 읽개는 한 번(§16 ③ · D4 ㉡)', async () => {
  const top = topWindow();
  const time = clock();
  const key = keyOf('concurrent');
  const items = [X, Y, Z];
  let reads = 0;
  let open = null;
  const gate = new Promise(resolve => (open = resolve));
  const slow = async () => {
    reads += 1;
    await gate;
    return legacyOf();
  };
  const coaches = [
    coachOn({ items, time, key, gameId: 'shell-a', scope: top, legacy: slow }),
    coachOn({ items, time, key, gameId: 'shell-b', scope: top, legacy: slow }),
    coachOn({ items, time, key, gameId: 'game', scope: frameOf(top) }),
  ];
  const seen = coaches.map(coach => coach.ready.then(() => coach.exposure(X).met));
  setTimeout(open, 30);
  assert.deepEqual(
    await Promise.all(seen),
    [true, true, true],
    '준비가 끝난 때 모두 옮겨 온 만남을 본다',
  );
  assert.equal(reads, 1, '처음 읽개를 받은 곳만 읽는다');
  for (const coach of coaches) coach.dispose();
});

test('저장소가 열리는 동안 읽개 없는 셸 · 틀 코치가 먼저 기다려도 뒤에 온 셸의 읽개로 옮긴 뒤에야 모두 준비를 끝낸다(r4 아르곤 A1)', async () => {
  const top = topWindow();
  const time = clock();
  const key = keyOf('reader-last');
  const items = [X, Y, Z];
  let reads = 0;
  let open = null;
  const gate = new Promise(resolve => (open = resolve));
  const slow = async () => {
    reads += 1;
    await gate;
    return legacyOf();
  };
  const coaches = [
    coachOn({ items, time, key, gameId: 'plain', scope: top }), // 읽개 없는 셸이 먼저 기다린다
    coachOn({ items, time, key, gameId: 'game', scope: frameOf(top) }), // 틀도 먼저 기다린다
    coachOn({ items, time, key, gameId: 'practice', scope: top, legacy: slow }), // 읽개는 맨 뒤 셸만
  ];
  const seen = coaches.map(coach => coach.ready.then(() => coach.exposure(X).met));
  setTimeout(open, 30);
  assert.deepEqual(
    await Promise.all(seen),
    [true, true, true],
    '먼저 기다린 코치도 준비가 끝난 때 옮겨 온 만남을 본다',
  );
  assert.equal(reads, 1, '읽개는 한 번');
  for (const coach of coaches) coach.dispose();
});

test('끝나지 않는 옛 기록 읽개는 시간 한도 뒤 계기(LEGACY_CARRY)에 남기고 연다(Fable 5.2 D4 덧붙임)', async () => {
  const health = createHealth();
  const time = clock();
  const coach = coachOn({
    items: [X, Y, Z],
    time,
    port: memoryPort(),
    key: keyOf('stuck-reader'),
    legacy: () => new Promise(() => {}),
    legacyWait: 40,
    health,
  });
  await coach.ready;
  assert.equal(health.snapshot().save.codes.LEGACY_CARRY, 1);
  assert.equal(coach.exposure(X).met, false);
  coach.dispose();
});

// ④ 쓰는 사람 셈 · 판 번호 ──────────────────────────────────────────────────────

test('이미 선 문서 호스트를 받는 직후 셸이 놓아도 그 호스트는 남는다 — 첫 기다림 전에 센다(§16 ④ · r3 GA8)', async () => {
  const items = bankOf(rng(24));
  const time = clock();
  const top = topWindow();
  const frame = { location: origin, parent: top };
  const key = keyOf('doc-standing');
  const common = { params: PARAMS, now: time.now, map: fakeMap(items), revision: 0, guest: true };
  const shellHost = await acquireHost({ ...common, key, port: memoryPort() }, top);
  const waiting = acquireHost({ ...common, document: true, wait: 2000 }, frame);
  releaseHost(shellHost); // 같은 틱에 셸이 놓는다
  const frameHost = await waiting;
  assert.equal(frameHost, shellHost);
  assert.equal(top.__synkAtlasHosts.has(key), true, '틀이 쓰는 동안 호스트가 남는다');
  releaseHost(frameHost);
  assert.equal(top.__synkAtlasHosts.has(key), false);
});

test('센 뒤 받기가 실패하면(색인 판이 다른 지도) 셈을 되돌린다 — 마지막 코치가 닫으면 등록부 · 문서 호스트가 빈다(Fable 5.2 D5)', async () => {
  const items = bankOf(rng(31));
  const time = clock();
  const top = topWindow();
  const key = keyOf('leak');
  const shell = coachOn({ items, time, key, gameId: 'shell', scope: top });
  await shell.ready;
  const game = createCoach({
    gameId: 'game',
    map: fakeMap(items, 'index-u'), // 배포 뒤에 뜬 틀 — 판 폴더가 달라 색인 판이 다르다
    seed: 's',
    dayOffset: 0,
    host: { document: true, wait: 50 },
    scope: frameOf(top),
  });
  await assert.rejects(game.ready, { code: 'MAP_EDITION_MISMATCH' });
  game.dispose();
  shell.dispose();
  assert.equal(top.__synkAtlasHosts.has(key), false, '등록부에서 빠진다');
  const account = keyOf('account');
  const next = coachOn({
    items,
    time,
    key: account,
    gameId: 'shell',
    scope: top,
    guest: false,
    account: 'acct-1',
    revision: 1,
  });
  await next.ready;
  assert.equal(top.__synkAtlasHosts.document, account, '로그인한 셸의 계정 저장소가 문서 호스트다');
  next.dispose();
});

test('같은 경험 이름의 코치 둘이 같은 밀리초에 판을 열어도 판 번호가 갈린다(Fable 5.2 D9)', async () => {
  const items = words(20, 'p');
  const time = clock();
  const port = memoryPort();
  const key = keyOf('set-id');
  const a = coachOn({ items, time, port, key, gameId: 'world-practice' });
  const b = coachOn({ items, time, port, key, gameId: 'world-practice' });
  await Promise.all([a.ready, b.ready]);
  a.recommend(items.slice(0, 10), { set: { length: 5 } });
  b.recommend(items.slice(10), { set: { length: 5 } });
  const pa = a.present(items[0]);
  const pb = b.present(items[10]);
  await settle();
  const events = await eventsOf(port);
  const setOf = id => events.find(event => event.id === id).setId;
  assert.notEqual(setOf(pa), setOf(pb));
  a.dispose();
  b.dispose();
});
