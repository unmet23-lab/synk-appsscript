// 받기 알림(coach.watch — 단계 4 계획 §21-20, 설계 주인 11-16 오후 승인 조건 1 · 2). 문서 밖의 답이 들어왔다는 호스트 알림 두 가지만 넘긴다.
// receive는 받기(다른 기기의 답)에서, refresh는 다른 탭의 쓰기에서 난다. 넘기는 것은 { kind } 하나이고, 듣는 함수 안의 summary()는 이미 새
// 값이다(storage.sync.pulled 포함). 같은 문서 안의 쓰기(written · failed)는 넘기지 않는다. 되돌림은 여러 번 불러도 되고, 코치를 닫으면 듣는
// 함수가 빠진다. 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort, PARAMS, STEP } from './support.mjs';

const { acquireHost, installHostMaker, releaseHost } = await subject('coach/host.mjs');
const { createServer } = await import('../support/trail-sync.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:watch-${process.pid}-${tag}-${(stores += 1)}`;
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const indexOfMap = map => ({ edition: 'index-t', lookup: key => map.item(key) });
const origin = { origin: 'https://world.test' };
function topWindow(openPort) {
  const top = { location: origin };
  top.parent = top;
  installHostMaker(top, { openPort });
  return top;
}

async function answerAll(coach, items, time) {
  for (const item of items) {
    await coach.answer(coach.present(item), { correct: true, assessable: true }).stored;
    time.advance(STEP);
  }
}

test('다른 기기의 답을 받기가 접어 오면 receive를 넘긴다 — 듣는 함수 안의 summary()는 이미 새 값이다(pulled · 그 답의 단위)', async () => {
  const items = bankOf(rng(2011), { items: 6 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(2012), index: indexOfMap(map) });
  const transport = {
    post: (events, since) => server.post(events, since),
    get: async since => ({ summary: await server.summary(since), serverTime: server.now }),
  };
  const time = clock();
  const account = { guest: false, account: 'acct-watch', revision: 1, transport, now: time.now };
  const [keyA, keyB] = [keyOf('device-a'), keyOf('device-b')];
  const a = createCoach({
    gameId: 'a',
    map,
    seed: 's',
    dayOffset: 0,
    host: { ...account, key: keyA, port: memoryPort() },
  });
  const b = createCoach({
    gameId: 'b',
    map,
    seed: 's',
    dayOffset: 0,
    host: { ...account, key: keyB, port: memoryPort() },
  });
  await Promise.all([a.ready, b.ready]);
  // 첫 받기(빈 서버)가 끝난 뒤에 듣는다 — 첫 받기는 요약이 그대로여도 한 번 알린다(F1 조건 2).
  await Promise.all([a.synced(), b.synced()]);
  await settle();
  const heard = [];
  const unwatch = b.watch(note => {
    const summary = b.summary();
    heard.push({
      note,
      pulled: summary.storage.sync.pulled,
      units: summary.units.map(row => row.unit),
    });
  });
  try {
    a.recommend(items, { set: { length: 6, newLimit: 6 } });
    await answerAll(a, items.slice(0, 2), time);
    const handleA = await acquireHost(
      { key: keyA, params: PARAMS, now: time.now, guest: false },
      globalThis,
    );
    await handleA.settled();
    await handleA.upload();
    releaseHost(handleA);
    assert.equal(heard.length, 0, '다른 기기의 올리기만으로는 이 기기에 알림이 없다');
    const handleB = await acquireHost(
      { key: keyB, params: PARAMS, now: time.now, guest: false },
      globalThis,
    );
    await handleB.pull({ force: true });
    releaseHost(handleB);
    assert.equal(heard.length, 1, '받기가 요약을 바꿨다 — 한 번');
    const [first] = heard;
    assert.deepEqual(first.note, { kind: 'receive' }, '넘기는 것은 kind 하나');
    assert.equal(first.pulled, true, '알림보다 먼저 pulled가 선다');
    const answered = new Set(items.slice(0, 2).flatMap(item => item.units));
    assert.ok(
      [...answered].every(unit => first.units.includes(unit)),
      '그 답의 단위가 이미 요약에 있다',
    );
  } finally {
    unwatch();
    a.dispose();
    b.dispose();
  }
});

test('같은 브라우저의 다른 탭이 쓴 답은 refresh로 넘긴다 — 이 탭의 summary()가 이미 그 답을 든다 · 이 탭 자기 쓰기(written)는 넘기지 않는다', async () => {
  const items = bankOf(rng(2021), { items: 6 });
  const time = clock();
  const port = memoryPort();
  const key = keyOf('tabs');
  const [topA, topB] = [topWindow(() => port), topWindow(() => port)];
  const coachIn = (scope, gameId) =>
    createCoach({
      gameId,
      map: fakeMap(items),
      seed: 's',
      dayOffset: 0,
      scope,
      host: { guest: true, key, port, now: time.now },
    });
  const a = coachIn(topA, 'a');
  const b = coachIn(topB, 'b');
  await Promise.all([a.ready, b.ready]);
  const heardA = [];
  const heardB = [];
  a.watch(note => heardA.push(note));
  b.watch(note =>
    heardB.push({ note, unfolded: b.summary().storage.unfolded, units: b.summary().units.length }),
  );
  try {
    const before = b.summary().units.length;
    a.recommend(items, { set: { length: 6, newLimit: 6 } });
    await answerAll(a, items.slice(0, 3), time);
    await settle();
    assert.deepEqual(heardA, [], '자기 쓰기(written)는 넘기지 않는다');
    // A의 쓰기마다 B가 다시 읽고 알릴 수 있다(BroadcastChannel — Node에도 있다). 셸이 잇달아 온 알림을 묶는 까닭이다(§21-20 조건 3).
    // 알림이 아직 안 왔어도 같은 길(꼬리 다시 읽기)을 한 번 더 부른다.
    const hostB = await acquireHost({ key, params: PARAMS, now: time.now, guest: true }, topB);
    await hostB.refresh();
    releaseHost(hostB);
    assert.ok(heardB.length >= 1, '다른 탭의 쓰기가 알림으로 온다');
    assert.ok(
      heardB.every(row => row.note.kind === 'refresh' && Object.keys(row.note).length === 1),
      '넘기는 것은 { kind: refresh } 하나',
    );
    const last = heardB.at(-1);
    assert.ok(last.units > before || last.unfolded > 0, '듣는 함수 안에서 그 답이 이미 보인다');
  } finally {
    a.dispose();
    b.dispose();
  }
});

test('되돌림은 여러 번 불러도 되고 다른 듣는 함수를 건드리지 않는다 · 코치를 닫으면 듣는 함수가 빠진다 · 닫은 코치에서는 부르지 못한다', async () => {
  const items = bankOf(rng(2031), { items: 4 });
  const time = clock();
  const port = memoryPort();
  const key = keyOf('close');
  const coachOf = gameId =>
    createCoach({
      gameId,
      map: fakeMap(items),
      seed: 's',
      dayOffset: 0,
      host: { guest: true, key, port, now: time.now },
    });
  const one = coachOf('one');
  const two = coachOf('two'); // 같은 문서 · 같은 호스트 — 하나를 닫아도 호스트는 살아 있다
  await Promise.all([one.ready, two.ready]);
  const heard = { first: 0, second: 0, two: 0 };
  const offFirst = one.watch(() => (heard.first += 1));
  one.watch(() => (heard.second += 1));
  two.watch(() => (heard.two += 1));
  const refresh = async () => {
    const handle = await acquireHost(
      { key, params: PARAMS, now: time.now, guest: true },
      globalThis,
    );
    await handle.refresh();
    releaseHost(handle);
  };
  try {
    offFirst();
    offFirst();
    await refresh();
    assert.deepEqual(heard, { first: 0, second: 1, two: 1 }, '되돌린 함수만 빠진다');
    one.dispose();
    await refresh();
    assert.deepEqual(
      heard,
      { first: 0, second: 1, two: 2 },
      '닫은 코치의 듣는 함수는 빠진다 — 같은 호스트의 다른 코치는 그대로 듣는다',
    );
    assert.throws(
      () => one.watch(() => {}),
      error => error.code === 'DISPOSED',
    );
    assert.throws(() => two.watch('not a function'), TypeError);
  } finally {
    one.dispose();
    two.dispose();
  }
});
