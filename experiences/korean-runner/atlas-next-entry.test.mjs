// 바람길 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉).
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다.
//            옛 코치에 닿는 차례는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은 겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 안내 없이 놀기만 한다.
//   문이 겉을 주면 그 겉으로 연다(옛 코치를 만들지 않고, 입구에서 부탁을 미리 고르지 않으며, 이유 줄 · 기록 지우기 단추를 숨긴다).
//   저장 안내(#learning-scope · 기록 지우기)는 실제로 연 코치로 정한다 — 새 길은 그 코치의 저장소(손님 · 계정), 옛 길은 옛 코치의 assignment.
//   판을 다시 정한 뒤 다시 열면(계정 → 손님 → 지금 판) 다시 정해 다시 쓴다(4-6 끝 판 B2 · GB8).
// 이 파일은 맨 위에서 새 길 모듈을 부르지 않는다 — 꺼진 판 시험이 그 모듈의 적재를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const resolved = [];
registerHooks({
  resolve(specifier, context, next) {
    resolved.push(specifier);
    return next(specifier, context);
  },
});

function stubNode() {
  const store = new Map();
  return new Proxy(function stub() {}, {
    get(_t, prop) {
      if (store.has(prop)) return store.get(prop);
      if (prop === Symbol.iterator) return function* () {};
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;
      if (prop === 'children' || prop === 'childNodes') return [];
      if (['textContent', 'innerHTML', 'className', 'src', 'value', 'id'].includes(prop)) return '';
      if (prop === 'hidden' || prop === 'open' || prop === 'checked') return false;
      if (prop === 'dataset' || prop === 'style') { const o = {}; store.set(prop, o); return o; }
      const child = stubNode(); store.set(prop, child); return child;
    },
    set(_t, prop, value) { store.set(prop, value); return true; },
    apply() { return stubNode(); },
  });
}
function fakeDocument() {
  const nodes = new Map();
  const own = {
    documentElement: { dataset: {} },
    fonts: { ready: new Promise(() => {}) },   // 입구 그림(캔버스)은 그리지 않는다
    hidden: false,
    querySelector: (sel) => { if (!nodes.has(sel)) nodes.set(sel, stubNode()); return nodes.get(sel); },
    querySelectorAll: () => [],
    getElementById: (id) => own.querySelector(`#${id}`),
    createElement: () => stubNode(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const rest = stubNode();
  return new Proxy(own, { get: (target, prop) => (prop in target ? target[prop] : rest[prop]) });
}
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
// 옛 코치 흉내 — 부른 메서드를 차례대로 적는다(syncPort는 읽기만 해도 적는다).
function loggingCoach(log, { assignment = false } = {}) {
  const answers = { summary: () => ({ skills: [], storage: { available: true }, evidenceComplete: true }), events: () => [], recommend: () => ({ status: 'none' }) };
  return new Proxy({}, {
    get(_t, name) {
      if (name === 'then' || typeof name === 'symbol') return undefined;
      if (name === 'syncPort') { log.push('syncPort'); return undefined; }
      if (name === 'assignment') return assignment ? () => null : undefined;   // LAB의 옛 코치에는 없다(WORLD 옛 학습 호스트의 겉에만 있다)
      return (...args) => { log.push(name); return answers[name]?.(...args) ?? null; };
    },
  });
}

let boots = 0;
const LOCAL_SCOPE = '학습 기록은 이 브라우저에만 저장되고, 같은 주소에서 연 다른 SYNK 게임과 같이 써요.';
const ACCOUNT_SCOPE = '학습 기록은 WORLD 계정에 이어져요. 기록 공유와 삭제는 WORLD 계정 설정에서 할 수 있어요.';
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판).
async function boot({ door = null, host = 'synk.im', search = '', assignment = false } = {}) {
  const log = [];
  const created = [];
  const storage = fakeStorage();
  const local = fakeStorage();
  const doc = fakeDocument();
  doc.querySelector('#learning-scope').textContent = LOCAL_SCOPE;   // index.html의 처음 글
  const coach = loggingCoach(log, { assignment });
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  Object.assign(globalThis, {
    window: globalThis, document: doc,
    location: { hostname: host, search, pathname: '/korean-runner/' },
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { createGame: (options) => { log.push('createGame'); created.push(options); return coach; } },
    SynkPlayAccount: { ready: async () => { log.push('account.ready'); }, storage: () => storage },
    requestAnimationFrame: () => 0, requestIdleCallback: () => 0, cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }), scrollTo() {}, addEventListener() {}, removeEventListener() {}, confirm: () => false,
    getComputedStyle: () => ({ lineHeight: '20px' }),
    Image: class { decode() { return Promise.resolve(); } },
    indexedDB: { open: () => { log.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async (url) => { log.push(`fetch ${url}`); throw new Error('닫힘'); },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  await import(`./app.mjs?boot=${(boots += 1)}`);
  const $ = (sel) => doc.querySelector(sel);
  return { log, created, local, $, specifiers: () => resolved.slice(from) };
}

// 4-6d 앞의 app.mjs가 시작할 때 옛 코치에 닿는 차례(같은 겉에서 잰 값): 만들기 → 저장 알림 듣기 → 입구의 다음 부탁 고르기 → 입구 이유 글.
const OLD_START = ['account.ready', 'createGame', 'syncPort', 'recommend', 'summary', 'summary', 'summary', 'events', 'summary'];
const OLD_REASON = '아직 안 들어 본 부탁부터 준비했어요.';

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다', async () => {
  const page = await boot();
  assert.deepEqual(page.log, OLD_START);
  assert.equal(page.created.length, 1);
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].gameId, 'korean-runner');
  assert.equal(page.created[0].storage, page.local, '이 창의 localStorage');
  const touched = page.specifiers();
  assert.ok(touched.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.equal(page.log.some((entry) => entry.startsWith('fetch') || entry === 'indexedDB.open'), false);
  assert.equal(page.$('#l-reason').textContent, OLD_REASON);
  assert.equal(page.$('#l-reason').hidden, false);
  assert.equal(page.$('#learning-reset').hidden, false, '꺼진 판은 기록 지우기를 그대로 둔다');
  assert.equal(page.$('#learning-scope').textContent, LOCAL_SCOPE);
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다', async () => {
  const asked = [];
  const door = { open: async (request) => { asked.push(request); return null; } };
  const page = await boot({ door });
  assert.deepEqual(asked, [{ gameId: 'korean-runner', banks: ['korean-runner'] }]);
  assert.deepEqual(page.log, OLD_START, '옛 길은 지금과 같은 차례');
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].storage, page.local);
  assert.ok(page.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
  assert.equal(page.$('#l-reason').textContent, OLD_REASON);
  assert.equal(page.$('#l-reason').hidden, false);
  // 저장 안내는 연 옛 코치로 정한다 — 이 옛 코치는 계정 겉(assignment)이 아니라 기록 지우기 · 이 브라우저 안내가 그대로다.
  assert.equal(page.$('#learning-reset').hidden, false);
  assert.equal(page.$('#learning-scope').textContent, LOCAL_SCOPE);
  const world = await boot({ door, assignment: true });
  assert.equal(world.$('#learning-reset').hidden, true, 'WORLD 옛 학습 호스트의 코치(assignment)는 계정 기록');
  assert.equal(world.$('#learning-scope').textContent, ACCOUNT_SCOPE);
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 놀기만 한다', async () => {
  const door = { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } };
  const page = await boot({ door });
  assert.equal(page.log.includes('createGame'), false, '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.deepEqual(page.log, ['account.ready']);
  assert.equal(page.$('#l-reason').hidden, true, '「학습 기록을 저장할 수 없어요」 안내도 없다');
  assert.equal(page.$('#learning-reset').hidden, true);
  assert.equal(page.$('#learning-scope').textContent, '', '코치 없이 노는 판은 저장 안내를 쓰지 않는다');
  // 그 밖의 실패(새 길이 맡은 판)도 옛 길을 열지 않는다 — 기록을 저장할 수 없다는 안내만 보인다.
  const broken = await boot({ door: { open: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); } } });
  assert.equal(broken.log.includes('createGame'), false);
  assert.equal(broken.$('#l-reason').hidden, false);
  assert.match(broken.$('#l-reason').textContent, /학습 기록을 저장할 수 없어서/);
  assert.equal(broken.$('#learning-reset').hidden, true);
  assert.equal(broken.$('#learning-scope').textContent, '');
});

test('문이 겉을 주면 그 겉으로 연다 — 옛 코치 없음, 입구에서 부탁을 미리 고르지 않음, 이유 줄 · 기록 지우기 숨김', async () => {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const calls = [];
  const coach = Object.fromEntries(['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live']
    .map((name) => [name, () => { calls.push(name); return null; }]));
  const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'korean-runner', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  assert.equal(page.log.includes('createGame'), false);
  assert.deepEqual(page.log, ['account.ready']);
  assert.deepEqual(calls, ['summary'], '입구는 저장 상태만 읽는다(달리기 부탁은 게임 차례, 듣기 확인은 열 때 고른다)');
  assert.equal(page.$('#l-reason').hidden, true, '이유를 지어내지 않는다');
  assert.equal(page.$('#l-reason').textContent, '');
  assert.equal(page.$('#learning-reset').hidden, true);
  assert.equal(page.$('#listening-check').textContent, '듣기 확인 3문제');
  assert.equal(page.$('#learning-scope').textContent, LOCAL_SCOPE, '저장 상태를 읽지 못한 겉은 계정 기록이라고 하지 않는다');
  door.dispose();
});

// 진짜 엔진 코치(메모리 저장소) — 손님이거나 계정.
async function engineCoach(account = null) {
  const { readFileSync } = await import('node:fs');
  const atlas = await import('../../packages/atlas/src/index.mjs');
  const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json'), words: json('../../packages/atlas/map/words.json') };
  const key = `synk-atlas:korean-runner-entry-${process.pid}-${(boots += 1)}`;
  const host = account ? { guest: false, account, revision: 1 } : { guest: true };
  const coach = atlas.createCoach({ gameId: 'korean-runner', mapData, dayOffset: 540, host: { ...host, port: atlas.memoryPort(), key } });
  await coach.ready;
  return coach;
}

test('새 길의 저장 안내는 문을 거친 진짜 코치로 정한다 — 손님 코치는 이 브라우저 기록, 계정 코치는 WORLD 계정 기록, 기록 지우기는 둘 다 숨김', async () => {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  for (const account of [null, 'acct-runner']) {
    const coach = await engineCoach(account);
    assert.equal(coach.summary().storage.guest, !account);
    const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'korean-runner', later: (fn) => fn() });
    const page = await boot({ door: door.api });
    assert.equal(page.log.includes('createGame'), false);
    assert.equal(page.$('#learning-reset').hidden, true, '새 길은 기록 지우기를 쓰지 않는다');
    assert.equal(page.$('#learning-scope').textContent, account ? ACCOUNT_SCOPE : LOCAL_SCOPE, account ? '계정 코치' : '손님 코치는 계정에 저장한다고 하지 않는다');
    door.dispose();
    coach.dispose();
  }
});

test('판을 다시 정한 뒤 다음 판에서 다시 열면 그 코치로 다시 정한다 — 계정 → 손님 → 지금 판(옛 길)', async () => {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const account = await engineCoach('acct-runner');
  const guest = await engineCoach();
  const given = [account, guest, null];
  const retirers = new Set();
  const entry = { gameCoach: async () => given.shift(), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } };
  const door = createGameDoor({ entry, gameId: 'korean-runner', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  const retire = () => { for (const fn of [...retirers]) fn({ reason: 'account' }); retirers.clear(); };
  // 다음 판 — 듣기 확인을 열면 열기 전에 문을 다시 연다(prepare).
  const nextRound = async () => { await page.$('#listening-check').onclick(); await new Promise((resolve) => setTimeout(resolve, 20)); };
  assert.equal(page.$('#learning-scope').textContent, ACCOUNT_SCOPE);
  assert.equal(page.$('#learning-reset').hidden, true);
  retire();
  await nextRound();
  assert.equal(given.length, 1, '문을 다시 열어 손님 코치를 받았다');
  assert.equal(page.$('#learning-scope').textContent, LOCAL_SCOPE, '손님 코치로 바뀌면 이 브라우저 기록');
  assert.equal(page.$('#learning-reset').hidden, true, '새 길은 여전히 기록 지우기를 쓰지 않는다');
  retire();
  await nextRound();
  assert.equal(given.length, 0);
  assert.ok(page.log.includes('createGame'), '셸이 지금 판이라고 하면 옛 코치로 연다');
  assert.ok(page.log.indexOf('syncPort') > page.log.indexOf('createGame'), '다시 연 옛 코치의 저장 알림을 듣는다');
  assert.equal(page.$('#learning-reset').hidden, false, '옛 길은 옛 코치로 정한다(이 옛 코치는 계정 겉이 아니다)');
  assert.equal(page.$('#learning-scope').textContent, LOCAL_SCOPE);
  door.dispose();
  account.dispose();
  guest.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않는다', async () => {
  const page = await boot({ host: 'localhost', search: '?atlas=next' });
  assert.equal(page.log.includes('createGame'), false);
  assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
});
