// 닫힌 저장소 연결의 자리를 등록부에서 내린다 · 알림은 통로마다 한 번(단계 4 계획 §23-3 — Fable 5.2 끝 판 둘째 넘친 #6 · 설계 주인 조건 (a)).
//   다른 탭이 판이 오른 저장소를 열어 이 판 저장소의 연결이 닫히면 그 자리를 등록부에서 내린다 — 같은 열쇠로 다시 여는 코치는 새 연결을 받고,
//   먼저 내려간 자리의 늦은 놓기는 같은 열쇠의 새 자리와 문서 호스트를 건드리지 않는다. 틀이 먼저 연 호스트(알림 통로 없음)가 닫힌 뒤 셸이
//   받으면 그 셸의 통로에 한 번 알린다. 내려간 자리는 문서 호스트가 되지 않는다.
// 규칙마다 tools/mutants/coach.mjs 「호스트(4-6a)」 갈래에 깬 변형이 있다.
import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from '../support/seeds.mjs';
import { subject } from '../support/subject.mjs';
import { bankOf, clock, createCoach, fakeMap, memoryPort } from './support.mjs';

const { installHostMaker } = await subject('coach/host.mjs');

let stores = 0;
const keyOf = tag => `synk-atlas:dropped-${process.pid}-${tag}-${(stores += 1)}`;
const origin = { origin: 'https://synk.test' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function topWindow(openPort) {
  const top = { location: origin, addEventListener() {}, removeEventListener() {} };
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

// 올리지 않는 계정 저장소(기기 길)로 연다 — 올리기 없이 셸 알림 통로(onAccount)만 본다.
function deviceCoach(scope, key, host = {}) {
  const items = bankOf(rng(31), { items: 6 });
  return createCoach({
    gameId: 'dropped',
    map: fakeMap(items),
    seed: 's',
    dayOffset: 0,
    scope,
    host: { guest: true, account: 'acct-dropped', revision: 1, key, now: clock().now, ...host },
  });
}

test('닫힌 연결의 자리는 등록부에서 내리고, 같은 열쇠로 다시 열면 새 연결이다 — 내려간 자리의 늦은 놓기는 새 자리 · 문서 호스트를 건드리지 않는다(§23-3)', async () => {
  const ports = [];
  const top = topWindow(async (_key, options) => {
    ports.push(options?.onClosed ?? null);
    return memoryPort();
  });
  const reg = () => top.__synkAtlasHosts ?? new Map();
  const key = keyOf('n');
  const first = [];
  const a = deviceCoach(top, key, { onAccount: detail => first.push(detail.code) });
  await a.ready;
  assert.equal(reg().document, key, '셸이 연 저장소가 문서 호스트다');
  ports[0]();
  ports[0]();
  assert.deepEqual(first, ['STORE_CLOSED'], '같은 통로에는 한 번');
  assert.equal(reg().has(key), false, '닫힌 자리는 등록부에서 내린다');
  assert.equal(reg().document, null, '문서 호스트에서도 내려온다');
  const second = [];
  const b = deviceCoach(top, key, { onAccount: detail => second.push(detail.code) });
  await b.ready;
  assert.equal(ports.length, 2, '같은 열쇠로 다시 열면 새 연결을 연다');
  assert.deepEqual(second, [], '새 연결은 닫히지 않았다');
  assert.equal(reg().document, key);
  const fresh = reg().get(key);
  a.dispose();
  assert.equal(reg().get(key), fresh, '내려간 자리의 늦은 놓기가 새 자리를 내리지 않는다');
  assert.equal(reg().document, key, '문서 호스트도 그대로다');
  const c = deviceCoach(top, key);
  await c.ready;
  assert.equal(ports.length, 2, '뒤 코치는 새 자리를 나눠 쓴다');
  b.dispose();
  c.dispose();
});

test('틀이 먼저 연 저장소가 서기 전에 닫히면, 같은 자리를 받은 셸의 통로에 한 번 알리고 그 자리는 문서 호스트가 되지 않는다(§23-3)', async () => {
  let open;
  const gate = new Promise(resolve => {
    open = resolve;
  });
  const closers = [];
  const top = topWindow(async (_key, options) => {
    closers.push(options?.onClosed ?? null);
    await gate;
    return memoryPort();
  });
  const reg = () => top.__synkAtlasHosts ?? new Map();
  const key = keyOf('f');
  const framed = deviceCoach(frameOf(top), key, {
    onAccount: () => assert.fail('틀이 넘긴 통로는 들지 않는다'),
  });
  for (let i = 0; i < 50 && !closers.length; i += 1) await sleep(5);
  const told = [];
  const shell = deviceCoach(top, key, { onAccount: detail => told.push(detail.code) });
  for (let i = 0; i < 50 && reg().get(key)?.claims.users !== 2; i += 1) await sleep(5);
  assert.equal(reg().get(key)?.claims.users, 2, '틀과 셸이 여는 중인 같은 자리를 받았다');
  assert.equal(closers.length, 1, '저장소를 한 번 연다');
  closers[0]();
  open();
  await Promise.all([framed.ready, shell.ready]);
  assert.deepEqual(told, ['STORE_CLOSED'], '셸의 통로에 한 번 알린다');
  assert.equal(reg().has(key), false, '닫힌 자리는 등록부에 없다');
  assert.notEqual(reg().document, key, '내려간 자리는 문서 호스트가 되지 않는다');
  framed.dispose();
  shell.dispose();
});
