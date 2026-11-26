// 빈칸 베기 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉).
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다.
//            옛 코치에 닿는 차례는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은 겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 안내 없이 놀기만 한다.
//   문이 겉을 주면 그 겉으로 연다(옛 코치를 만들지 않고, 입구에서 판을 미리 짜지 않으며, 기록 지우기 단추를 숨긴다).
//   문이 있어도 입구는 셸의 코치를 기다리지 않고 먼저 그린다 — 시작 단추가 그 열기를 기다린다.
// 이 파일은 처음 시험이 끝날 때까지 새 길 모듈을 싣지 않는다(맨 위에서 부르지 않는다) — 꺼진 판 시험이 그 모듈의 적재를 본다.
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
      if (prop === 'hidden' || prop === 'open' || prop === 'checked' || prop === 'disabled') return false;
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
    fonts: { ready: Promise.resolve() },
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
// 옛 코치 흉내 — 부른 메서드를 차례대로 적는다(syncPort는 읽기만 해도 적는다). more: 메서드의 답을 바꾼다.
function loggingCoach(log, more = {}) {
  const answers = { summary: () => ({ skills: [], storage: { available: true }, evidenceComplete: true }), events: () => [], recommend: () => ({ status: 'none' }), ...more };
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
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판). texts: 마디의 처음 글(index.html). old: 옛 코치 흉내의 답.
async function boot({ door = null, plays = 0, host = 'synk.im', search = '', texts = {}, old = {} } = {}) {
  const log = [];
  const created = [];
  const storage = fakeStorage(plays ? { 'synk.blank-slice.v1': JSON.stringify({ v: 1, plays, practiced: true, slow: false, best: null }) } : {});
  const local = fakeStorage();
  const doc = fakeDocument();
  for (const [sel, text] of Object.entries(texts)) doc.querySelector(sel).textContent = text;
  const coach = loggingCoach(log, old);
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  Object.assign(globalThis, {
    window: globalThis, document: doc,
    location: { hostname: host, search, pathname: '/blank-slice/' },
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

// 4-6d 앞의 app.mjs가 시작할 때 옛 코치에 닿는 차례(같은 겉에서 잰 값).
const OLD_START = ['account.ready', 'createGame', 'syncPort', 'summary', 'events', 'summary'];
const OLD_START_PLAYED = ['account.ready', 'createGame', 'syncPort', 'recommend', 'summary', 'events', 'summary'];

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다', async () => {
  const first = await boot();
  assert.deepEqual(first.log, OLD_START);
  assert.equal(first.created.length, 1);
  assert.deepEqual(Object.keys(first.created[0]), ['gameId', 'storage']);
  assert.equal(first.created[0].gameId, 'blank-slice');
  assert.equal(first.created[0].storage, first.local, '이 창의 localStorage');
  const played = await boot({ plays: 3 });
  assert.deepEqual(played.log, OLD_START_PLAYED);
  await settle();
  assert.deepEqual(first.log, OLD_START, '뒤늦게 닿는 것도 없다');
  const touched = [...first.specifiers(), ...played.specifiers()];
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.equal([...first.log, ...played.log].some((entry) => entry.startsWith('fetch') || entry === 'indexedDB.open'), false);
  assert.match(first.$('#l-reason').textContent, /처음이라/);
  assert.match(played.$('#l-reason').textContent, /새 문장을 섞어/);
  assert.equal(first.$('#reset-learning').hidden, false, '꺼진 판은 기록 지우기를 그대로 둔다');
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다', async () => {
  const asked = [];
  const door = { open: async (request) => { asked.push(request); return null; } };
  const page = await boot({ door, plays: 3 });
  await settle();
  assert.deepEqual(asked, [{ gameId: 'blank-slice', banks: ['blank-slice'] }]);
  assert.deepEqual(page.log, OLD_START_PLAYED, '옛 길은 지금과 같은 차례(입구를 먼저 그린 뒤 옛 코치로 다시 그린다)');
  assert.equal(page.created[0].storage, page.local);
  assert.ok(page.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
  assert.match(page.$('#l-reason').textContent, /새 문장을 섞어/);
  assert.equal(page.$('#l-reason').hidden, false, '옛 길의 이유 줄을 다시 보인다');
  assert.equal(page.$('#storage-note').hidden, true);
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 놀기만 한다', async () => {
  const door = { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } };
  const page = await boot({ door });
  await settle();
  assert.equal(page.log.includes('createGame'), false, '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.deepEqual(page.log, ['account.ready']);
  assert.equal(page.$('#storage-note').hidden, true, '「학습 기록을 쓸 수 없어요」 안내도 없다');
  assert.equal(page.$('#reset-learning').hidden, true);
  assert.match(page.$('#l-reason').textContent, /처음이라/);
  // 그 밖의 실패(새 길이 맡은 판)도 옛 길을 열지 않는다 — 기록을 쓸 수 없다는 안내만 보인다.
  const broken = await boot({ door: { open: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); } } });
  await settle();
  assert.equal(broken.log.includes('createGame'), false);
  assert.equal(broken.$('#storage-note').hidden, false);
  assert.match(broken.$('#storage-note').textContent, /학습 기록을 쓸 수 없어/);
});

// 가짜 셸 코치 — 부른 메서드를 적는다. guest: 저장소가 손님인가(아니면 계정).
function shellCoach(calls, { guest = true } = {}) {
  return {
    summary: () => { calls.push('summary'); return { storage: { available: true, guest } }; },
    recommend: () => { calls.push('recommend'); return { status: 'none', selected: null }; },
    present: () => { calls.push('present'); return 'p1'; },
    itemUnits: () => { calls.push('itemUnits'); return [{ unit: 'ko.word.w0001', kind: 'word', label: null }]; },
    finishSet: () => { calls.push('finishSet'); },
    today: () => { calls.push('today'); return null; },
    live: () => { calls.push('live'); throw Object.assign(new Error('없음'), { code: 'NOT_IMPLEMENTED' }); },
  };
}
// 문을 거친 가짜 셸 코치 — 부른 메서드를 적는다.
async function doorWith(calls) {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const coach = shellCoach(calls);
  return createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'blank-slice', later: (fn) => fn() });
}
// 판을 다시 정할 수 있는 문(retire). give(n, coach): n번째 open이 받는 코치(기본은 늘 그 코치). guest: 그 코치의 저장소가 손님인가.
async function retiringDoor(calls, { guest = true, give = (_n, coach) => coach } = {}) {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const coach = shellCoach(calls, { guest });
  const retirers = new Set();
  let opens = 0;
  const door = createGameDoor({ entry: { gameCoach: async () => give((opens += 1), coach), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } }, gameId: 'blank-slice', later: (fn) => fn() });
  return { door, opens: () => opens, retire: () => [...retirers].forEach((fn) => fn({ reason: 'account' })) };
}

test('문이 겉을 주면 그 겉으로 연다 — 옛 코치 없음, 입구에서 판을 미리 짜지 않음, 기록 지우기 숨김', async () => {
  const calls = [];
  const door = await doorWith(calls);
  const page = await boot({ door: door.api, plays: 3 });
  await settle();
  assert.equal(page.log.includes('createGame'), false);
  assert.deepEqual(calls, ['summary', 'summary'], '저장소만 읽는다 — 열 때 계정의 기록인가, 입구의 저장 안내(판은 문장마다 고른다)');
  assert.equal(page.$('#reset-learning').hidden, true);
  assert.equal(page.$('#l-reason').hidden, true, '판을 미리 짜지 않으니 이유를 지어내지 않는다');
  assert.equal(page.$('#storage-note').hidden, true);
  door.dispose();
});

test('셸이 코치를 준비하는 동안에도 입구를 먼저 그리고, 시작 단추는 그 열기를 기다린다', async () => {
  const calls = [];
  const inner = await doorWith(calls);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const door = { open: async (request) => { await gate; return inner.api.open(request); } };
  const page = await boot({ door });
  // 모듈은 셸의 코치를 기다리지 않고 끝났다 — 입구가 그려져 있다.
  assert.match(page.$('#l-reason').textContent, /처음이라/);
  assert.equal(page.$('#storage-note').hidden, true, '기다리는 동안 「기록을 쓸 수 없어요」라고 하지 않는다');
  assert.equal(page.$('#lobby').hidden, false);
  assert.equal(typeof page.$('#btn-start').onclick, 'function');
  page.$('#btn-start').onclick();
  page.$('#btn-start').onclick();   // 기다리는 동안 다시 누름
  await settle();
  assert.deepEqual(calls, [], '열기 전에는 판을 시작하지 않는다');
  assert.equal(page.$('#game').hidden, true);
  release();
  await settle();
  assert.equal(page.log.includes('createGame'), false);
  assert.equal(page.$('#game').hidden, false, '열린 뒤 판을 시작한다');
  assert.equal(calls.filter((name) => name === 'today').length, 1, '판은 한 번만 시작한다');
  assert.deepEqual(calls.filter((name) => name !== 'itemUnits'), ['summary', 'summary', 'today', 'live'], '열 때 계정의 기록인가 → 입구 다시 그리기 → 순간 맞춤(오늘 · 조각 시간)');
  assert.equal(calls.filter((name) => name === 'itemUnits').length, 32, '처음 판의 쉬운 문장이 은행에 있는지 본다');
  inner.dispose();
});

const FIRST_SCOPE = '학습 기록은 이 브라우저에만 저장되고, 같은 주소에서 연 다른 SYNK 게임과 같이 써요.';
const ACCOUNT_SCOPE = 'WORLD에서 선택한 계정의 학습 기록으로 연결해요. 기록 공유와 삭제는 WORLD 계정 설정에서 관리해요.';

test('기록 안내는 실제로 연 코치로 정한다 — 기다리는 동안은 계정이라 하지 않고, 문이 null이면 옛 코치의 처음 글 · 기록 지우기, 새 길은 그 코치의 저장소, 판을 다시 정한 뒤에는 다시 연 길로 다시 그린다(4-6 끝 판 A4)', async () => {
  const texts = { '#learning-scope': FIRST_SCOPE };
  const scope = (page) => ({ reset: page.$('#reset-learning').hidden, text: page.$('#learning-scope').textContent });
  // 셸이 코치를 준비하는 동안 입구를 먼저 그린다 — 아직 연 코치가 없다. 셸이 지금 판(null)이라고 하면 이 브라우저의 옛 코치다.
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const waiting = await boot({ door: { open: async () => { await gate; return null; } }, plays: 3, texts });
  assert.deepEqual(scope(waiting), { reset: true, text: '학습 기록을 연결하고 있어요.' }, '기다리는 동안 기록 지우기는 숨기고, 저장 위치를 말하지 않는다(검수 GA1)');
  release();
  await settle();
  assert.equal(waiting.log.includes('createGame'), true);
  assert.deepEqual(scope(waiting), { reset: false, text: FIRST_SCOPE }, '옛 코치의 기록 지우기와 처음 글');
  // 새 길 손님 코치 — 기록 지우기는 쓰지 않고 계정 안내도 하지 않는다.
  const visitor = await retiringDoor([]);
  const guest = await boot({ door: visitor.door.api, plays: 3, texts });
  await settle();
  assert.deepEqual(scope(guest), { reset: true, text: FIRST_SCOPE });
  visitor.door.dispose();
  // 새 길 계정 코치 — 계정 안내. 판을 다시 정한 뒤 셸이 지금 판이면 옛 코치로 판을 열고, 처음 글 · 기록 지우기로 돌아온다.
  const member = await retiringDoor([], { guest: false, give: (n, coach) => (n === 1 ? coach : null) });
  const page = await boot({ door: member.door.api, plays: 3, texts });
  await settle();
  assert.deepEqual(scope(page), { reset: true, text: ACCOUNT_SCOPE });
  member.retire();
  page.$('#btn-start').onclick();
  await settle();
  assert.equal(member.opens(), 2);
  assert.equal(page.log.includes('createGame'), true, '다시 연 길은 옛 길');
  assert.deepEqual(scope(page), { reset: false, text: FIRST_SCOPE });
  member.door.dispose();
});

test('새 길이 코치를 열지 못하면(셸 오류 · 문이 닫히는 중) 「이 브라우저에 저장」이라 하지 않는다 — 열지 못한 까닭은 저장 안내 줄이 말한다(검수 GA1)', async () => {
  const texts = { '#learning-scope': FIRST_SCOPE };
  const failed = await boot({ door: { open: async () => { throw Object.assign(new Error('셸 오류'), { code: 'SHELL' }); } }, plays: 3, texts });
  await settle();
  assert.equal(failed.$('#learning-scope').textContent, '');
  assert.equal(failed.$('#reset-learning').hidden, true);
  assert.match(failed.$('#storage-note').textContent, /학습 기록을 쓸 수 없어서/);
  const closing = await boot({ door: { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } }, plays: 3, texts });
  await settle();
  assert.equal(closing.$('#learning-scope').textContent, '');
  assert.equal(closing.log.includes('createGame'), false);
});

test('결과 화면에서 판을 다시 정한 뒤 「다음 판 시작」이 옛 길로 돌아오면 입구를 지나지 않아도 옛 코치의 필요 순서로 판을 짠다(4-6 끝 판 A5)', async () => {
  const { ITEMS } = await import('./content.mjs');
  const { composeRound } = await import('./core.mjs');
  // 옛 코치는 원고의 거꾸로 차례를 필요 순서로 준다(learning.mjs rankItems).
  const ranking = (list) => ({ status: 'ready', selected: list.at(-1), alternatives: list.slice(0, -1).reverse(), reason: '기록에 맞췄어요.', focusSkillId: null, state: null });
  const d = await retiringDoor([], { give: (n, coach) => (n === 1 ? coach : null) });
  const page = await boot({ door: d.door.api, plays: 3, search: '?qa', old: { recommend: ranking } });
  await settle();
  // 새 길의 판을 마친 결과 화면(입구는 숨김) — 노드에는 3D 무대가 없어 판을 끝까지 돌지 않고 화면만 결과로 둔다.
  page.$('#lobby').hidden = true;
  page.$('#results').hidden = false;
  d.retire();
  page.$('#r-again').onclick();
  await settle();
  assert.equal(d.opens(), 2);
  assert.equal(page.log.includes('createGame'), true, '다시 연 길은 옛 길');
  const ranked = [...ITEMS].reverse().map((x) => x.id);
  assert.deepEqual(globalThis.__slice.state().queue, composeRound(ITEMS, { ranked, seed: 4 }).map((x) => x.id), '옛 코치의 필요 순서로 짠 판');
  d.door.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않는다', async () => {
  const page = await boot({ host: 'localhost', search: '?atlas=next' });
  await settle();
  assert.equal(page.log.includes('createGame'), false);
  assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
});
