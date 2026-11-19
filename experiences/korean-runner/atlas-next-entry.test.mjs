// 바람길 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉).
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다.
//            옛 코치에 닿는 차례는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은 겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 안내 없이 놀기만 한다.
//   문이 겉을 주면 그 겉으로 연다(옛 코치를 만들지 않고, 입구에서 부탁을 미리 고르지 않으며, 이유 줄 · 기록 지우기 단추를 숨긴다).
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
function loggingCoach(log) {
  const answers = { summary: () => ({ skills: [], storage: { available: true }, evidenceComplete: true }), events: () => [], recommend: () => ({ status: 'none' }) };
  return new Proxy({}, {
    get(_t, name) {
      if (name === 'then' || typeof name === 'symbol') return undefined;
      if (name === 'syncPort') { log.push('syncPort'); return undefined; }
      if (name === 'assignment') return undefined;   // LAB의 옛 코치에는 없다(WORLD 옛 학습 호스트의 겉에만 있다)
      return (...args) => { log.push(name); return answers[name]?.(...args) ?? null; };
    },
  });
}

let boots = 0;
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판).
async function boot({ door = null, host = 'synk.im', search = '' } = {}) {
  const log = [];
  const created = [];
  const storage = fakeStorage();
  const local = fakeStorage();
  const doc = fakeDocument();
  const coach = loggingCoach(log);
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
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 놀기만 한다', async () => {
  const door = { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } };
  const page = await boot({ door });
  assert.equal(page.log.includes('createGame'), false, '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.deepEqual(page.log, ['account.ready']);
  assert.equal(page.$('#l-reason').hidden, true, '「학습 기록을 저장할 수 없어요」 안내도 없다');
  assert.equal(page.$('#learning-reset').hidden, true);
  // 그 밖의 실패(새 길이 맡은 판)도 옛 길을 열지 않는다 — 기록을 저장할 수 없다는 안내만 보인다.
  const broken = await boot({ door: { open: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); } } });
  assert.equal(broken.log.includes('createGame'), false);
  assert.equal(broken.$('#l-reason').hidden, false);
  assert.match(broken.$('#l-reason').textContent, /학습 기록을 저장할 수 없어서/);
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
  assert.deepEqual(calls, [], '입구는 셸 코치를 부르지 않는다(달리기 부탁은 게임 차례, 듣기 확인은 열 때 고른다)');
  assert.equal(page.$('#l-reason').hidden, true, '이유를 지어내지 않는다');
  assert.equal(page.$('#l-reason').textContent, '');
  assert.equal(page.$('#learning-reset').hidden, true);
  assert.equal(page.$('#listening-check').textContent, '듣기 확인 3문제');
  door.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않는다', async () => {
  const page = await boot({ host: 'localhost', search: '?atlas=next' });
  assert.equal(page.log.includes('createGame'), false);
  assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
});
