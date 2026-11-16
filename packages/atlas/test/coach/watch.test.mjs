// 받기 알림(coach.watch — 단계 4 계획 §21-20, 설계 주인 11-16 오후 승인 조건 1 · 2). 문서 밖의 답이 들어왔다는 호스트 알림 두 가지만 넘긴다.
// receive는 받기(다른 기기의 답)에서, refresh는 다른 탭의 쓰기에서 난다. 넘기는 것은 { kind } 하나이고, 듣는 함수 안의 summary()는 이미 새
// 값이다(storage.sync.pulled 포함). 같은 문서 안의 쓰기(written · failed)는 넘기지 않는다. 되돌림은 여러 번 불러도 되고, 코치를 닫으면 듣는
// 함수가 빠진다. 알림을 돌리는 사이 되돌렸거나 코치를 닫았으면 남은 듣는 함수는 그 알림을 받지 않는다. 규칙마다 tools/mutants/coach.mjs에 깬 변형이 있다.
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
async function until(check, label, ms = 3000) {
  for (const end = Date.now() + ms; Date.now() < end; ) {
    if (check()) return;
    await settle();
  }
  assert.fail(`기다림 한도 — ${label}`);
}
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

test('다른 기기의 답을 받기가 접어 오면 receive를 넘긴다 — 늦게 끝난 첫 받기는 요약이 그대로여도 한 번 넘기고, 듣는 함수 안의 summary()는 이미 새 값이다(pulled · 그 답의 단위)', async () => {
  const items = bankOf(rng(2011), { items: 6 });
  const map = fakeMap(items);
  const server = createServer({ random: rng(2012), index: indexOfMap(map) });
  // B의 첫 받기는 시험이 풀 때까지 기다린다 — 듣기를 건 뒤에 첫 받기가 끝나야 「알림 안에서 pulled가 이미 참」을 본다(엔진 묶음 카본 A2).
  let release = null;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const transportOf = gated => ({
    post: (events, since) => server.post(events, since),
    get: async since => {
      if (gated) await held;
      return { summary: await server.summary(since), serverTime: server.now };
    },
  });
  const time = clock();
  const account = transport => ({
    guest: false,
    account: 'acct-watch',
    revision: 1,
    transport,
    now: time.now,
  });
  const [keyA, keyB] = [keyOf('device-a'), keyOf('device-b')];
  const a = createCoach({
    gameId: 'a',
    map,
    seed: 's',
    dayOffset: 0,
    host: { ...account(transportOf(false)), key: keyA, port: memoryPort() },
  });
  const b = createCoach({
    gameId: 'b',
    map,
    seed: 's',
    dayOffset: 0,
    host: { ...account(transportOf(true)), key: keyB, port: memoryPort() },
  });
  await Promise.all([a.ready, b.ready]);
  await a.synced();
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
    assert.equal(b.summary().storage.sync.pulled, false, '듣기를 건 때는 아직 받지 않았다');
    release();
    assert.equal((await b.synced()).ok, true);
    await settle();
    assert.deepEqual(
      heard.map(row => [row.note, row.pulled]),
      [[{ kind: 'receive' }, true]],
      '늦게 끝난 첫 받기는 요약이 그대로여도(빈 서버) 한 번 알리고, 알림 안에서 pulled는 이미 참이다',
    );
    heard.length = 0;
    // 다른 기기(A)의 답 — A가 올리고, B가 받는다.
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
    assert.equal(first.pulled, true);
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

test('같은 브라우저의 다른 탭이 쓴 답은 refresh로 넘긴다 — 이 탭이 아무것도 부르지 않아도 오고, 마지막 알림이 본 요약이 끝 값이다 · 이 탭 자기 쓰기(written)는 넘기지 않는다', async () => {
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
  // 두 창이 열며 접은 요약을 저장하면 서로에게 알린다(받기 알림 설계 검토 D2) — 그 알림이 그친 뒤에 듣는다. 그래야 A가 받는 것이 자기 쓰기뿐이다.
  for (let quiet = 0; quiet < 20; quiet += 1) await settle();
  // 요약의 모양 — 단위 수 · 접히지 않은 답 · 능력 줄의 답 수.
  const shape = () => {
    const summary = b.summary();
    return JSON.stringify([
      summary.units.length,
      summary.storage.unfolded,
      summary.skills.reduce((n, row) => n + row.n, 0),
    ]);
  };
  const heardA = [];
  const heardB = [];
  a.watch(note => heardA.push(note));
  b.watch(note => heardB.push({ note, shape: shape() }));
  try {
    const before = shape();
    a.recommend(items, { set: { length: 6, newLimit: 6 } });
    await answerAll(a, items.slice(0, 1), time);
    // A의 쓰기마다 B가 BroadcastChannel로 듣고 꼬리를 다시 읽어 알린다(Node에도 BroadcastChannel이 있다). 쓰기마다 알림이 날 수 있어 셸이
    // 잇달아 온 알림을 묶는다(§21-20 조건 3). 손으로 꼬리를 다시 읽지 않는다 — 탭 사이 알림이 끊기면 이 장면이 깨져야 한다(엔진 묶음 GPT GA2 ·
    // 카본 A3). 알림이 그친 뒤 마지막 알림이 본 모양을 끝 모양과 견준다 — 꼬리를 읽기 전에 알리면 마지막 알림이 옛 모양을 본다(A3 ②).
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && !(heardB.length && heardB.at(-1).shape !== before))
      await settle();
    for (let quiet = 0; quiet < 20; quiet += 1) await settle();
    assert.deepEqual(heardA, [], '자기 쓰기(written)는 넘기지 않는다');
    assert.ok(
      heardB.length >= 1,
      '다른 탭의 쓰기가 알림으로 온다 — 이 탭은 아무것도 부르지 않았다',
    );
    assert.ok(
      heardB.every(row => row.note.kind === 'refresh' && Object.keys(row.note).length === 1),
      '넘기는 것은 { kind: refresh } 하나',
    );
    assert.notEqual(heardB.at(-1).shape, before, '알림 안에서 그 답이 이미 보인다');
    assert.equal(
      heardB.at(-1).shape,
      shape(),
      '마지막 알림이 본 요약이 끝 값이다 — 꼬리를 다시 읽은 뒤에 알린다',
    );
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

test('알림을 돌리는 사이 되돌린 듣는 함수와 닫힌 코치의 듣는 함수는 그 알림을 받지 않는다 — 호스트가 목록의 사본을 돌아도(엔진 묶음 GPT GA1 · 카본 A1)', async () => {
  const items = bankOf(rng(2041), { items: 4 });
  const time = clock();
  const port = memoryPort();
  const key = keyOf('during');
  const coachOf = gameId =>
    createCoach({
      gameId,
      map: fakeMap(items),
      seed: 's',
      dayOffset: 0,
      host: { guest: true, key, port, now: time.now },
    });
  const one = coachOf('one');
  const two = coachOf('two'); // 같은 문서 · 같은 호스트
  await Promise.all([one.ready, two.ready]);
  const heard = [];
  let offSecond = () => {};
  one.watch(() => {
    heard.push('one:first');
    offSecond();
  });
  offSecond = one.watch(() => heard.push('one:second'));
  two.watch(() => {
    heard.push('two:first');
    two.dispose();
  });
  two.watch(() => {
    heard.push('two:second');
    two.summary(); // 닫힌 코치에서 부르면 던진다 — 불리면 안 된다
  });
  const refresh = async () => {
    const handle = await acquireHost(
      { key, params: PARAMS, now: time.now, guest: true },
      globalThis,
    );
    await handle.refresh();
    releaseHost(handle);
  };
  try {
    await refresh();
    assert.deepEqual(
      heard,
      ['one:first', 'two:first'],
      '앞 함수가 되돌린 함수와 앞 함수가 닫은 코치의 함수는 그 알림을 받지 않는다',
    );
    await refresh();
    assert.deepEqual(heard, ['one:first', 'two:first', 'one:first'], '그 뒤의 알림도 받지 않는다');
  } finally {
    one.dispose();
    two.dispose();
  }
});

// 손님 창 둘 — 같은 포트 · 다른 위 창(scope).
async function guestTabs(seed, tag) {
  const items = bankOf(rng(seed), { items: 6 });
  const time = clock();
  const port = memoryPort();
  const key = keyOf(tag);
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
  a.recommend(items, { set: { length: 6, newLimit: 6 } });
  await answerAll(a, items.slice(0, 3), time);
  await until(
    () => b.summary().storage.unfolded > 0,
    'B가 A의 답 사건까지 읽었다 — 아직 접히지 않았다',
  );
  return { a, b, key };
}
const shapeOf = coach => {
  const summary = coach.summary();
  return JSON.stringify([
    summary.units.length,
    summary.storage.unfolded,
    summary.skills.reduce((n, row) => n + row.n, 0),
  ]);
};

test('손님 창 A가 판을 닫아 요약을 접어 저장하면 창 B에 알린다 — B는 손으로 꼬리를 읽지 않고도 접힌 칸을 본다(받기 알림 설계 검토 D2 · 설계 주인 11-16 저녁 조건 3)', async () => {
  const { a, b } = await guestTabs(2051, 'fold-tabs');
  try {
    const heard = [];
    b.watch(note => heard.push({ note, unfolded: b.summary().storage.unfolded }));
    await a.finishSet({ record: false }).folded;
    assert.equal(a.summary().storage.unfolded, 0, 'A는 판을 닫으며 접었다');
    await until(() => b.summary().storage.unfolded === 0, 'B도 접힌 요약을 읽는다');
    assert.equal(shapeOf(b), shapeOf(a), 'B의 칸이 A가 접은 값과 같다');
    assert.ok(
      heard.some(row => row.note.kind === 'refresh' && row.unfolded === 0),
      '그 refresh 알림 안에서 이미 접힌 값이다',
    );
  } finally {
    a.dispose();
    b.dispose();
  }
});

test('창 A의 요약 저장 알림에 창 B는 되알리지 않는다 — A가 판을 닫은 뒤 탭 사이 글은 A의 하나뿐이다(받기 알림 설계 검토 D2 · 설계 주인 11-16 저녁 조건 3)', async () => {
  const { a, b, key } = await guestTabs(2061, 'pingpong');
  for (let quiet = 0; quiet < 20; quiet += 1) await settle(); // 답 사건의 글이 다 오고 그친다
  const posts = [];
  const ear = new BroadcastChannel(`synk-atlas:${key}`);
  ear.onmessage = event => posts.push(event.data);
  try {
    await a.finishSet({ record: false }).folded;
    await until(() => b.summary().storage.unfolded === 0, 'B가 접힌 요약을 읽는다');
    for (let quiet = 0; quiet < 30; quiet += 1) await settle(); // B가 되알렸다면 그 글이 올 때까지
    assert.equal(
      posts.length,
      1,
      '탭 사이 글은 A의 요약 저장 알림 하나다 — B는 아무 글도 보내지 않는다',
    );
  } finally {
    ear.close();
    a.dispose();
    b.dispose();
  }
});
