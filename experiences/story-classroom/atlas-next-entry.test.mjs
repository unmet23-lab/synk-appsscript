// 이야기 교실 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-8 · §23-10). 진짜 app.mjs를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉).
//   꺼진 판: 문도 개발 깃발도 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를
//            건드리지 않는다. 옛 코치에 닿는 차례(입구 → 시작 → 첫 장면 → 부탁 둘)는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이
//            파일을 같은 겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 안내 없이 놀기만 한다.
//   문이 겉을 주면 그 겉으로 연다(옛 코치 없음 · recommend 없음 · 판은 이야기를 열 때 닫고 첫 제시 앞에서 startSet({ length: 이 판의 제시 수 })로
//   연다 — 셸 코치에 startSet이 없으면 첫 제시가 기본 판을 연다 · 판 끝에 닫는다).
//   개발 깃발(로컬 주소의 ?atlas=next)은 문이 없어도 새 길 — 입구(/atlas/loader.js)를 싣는다.
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
    fonts: { ready: Promise.resolve() },
    hidden: false,
    activeElement: null,
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
  let n = 0;
  const answers = {
    summary: () => ({ skills: [], storage: { available: true }, evidenceComplete: true }),
    events: () => [], recommend: () => ({ status: 'none' }), presentation: () => null,
    present: () => `p${(n += 1)}`, answer: () => ({ eventId: `a${n}`, verdict: 'correct', independent: true }),
  };
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
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판). setInterval(계정 줄 3초)은 띄우는 동안만 막는다.
async function boot({ door = null, host = 'synk.im', search = '?qa' } = {}) {
  const log = [];
  const created = [];
  const local = fakeStorage();
  const doc = fakeDocument();
  const coach = loggingCoach(log);
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  const interval = globalThis.setInterval;
  const location = { hostname: host, search, pathname: '/story-classroom/', port: '', href: `https://${host}/story-classroom/` };
  // 페이지마다 새 창 — app.mjs가 창에 다시 정의할 수 없는 읽기 칸(__storyState …)을 둔다. 나머지는 전역에서 읽는다.
  const win = Object.create(globalThis);
  Object.assign(win, { location, parent: up ?? win, top: up ?? win });
  Object.assign(globalThis, {
    window: win, document: doc, location,
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { createGame: (options) => { log.push('createGame'); created.push(options); return coach; }, Flow: { declaredFrom: () => ({ knobs: {} }) } },
    SynkPlayAccount: { ready: async () => { log.push('account.ready'); } },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    matchMedia: () => ({ matches: true, addEventListener() {} }),
    ResizeObserver: class { observe() {} disconnect() {} },
    scrollTo() {}, addEventListener() {}, removeEventListener() {},
    getComputedStyle: () => ({ lineHeight: '20px', fontSize: '16px' }),
    Image: class { decode() { return Promise.resolve(); } },
    indexedDB: { open: () => { log.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async (url) => { log.push(`fetch ${url}`); throw new Error('닫힘'); },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  globalThis.setInterval = () => 0;
  try { await import(`./app.mjs?boot=${(boots += 1)}`); } finally { globalThis.setInterval = interval; }
  const $ = (sel) => doc.querySelector(sel);
  const story = win.__story;
  // 입구 → 이야기 시작 → 첫 장면의 부탁 판 → 부탁 둘을 화면의 같은 길로 푼다(?qa의 __story).
  async function playFirstScene() {
    await $('#start').onclick();
    for (let i = 0; i < 40 && !['play', 'review'].includes(story.state().phase); i += 1) story.advance();
    await story.solve();
    await story.solve();
    return story.state();
  }
  return { log, created, local, $, story, playFirstScene, specifiers: () => resolved.slice(from) };
}

// 4-6d 앞의 app.mjs가 옛 코치에 닿는 차례(같은 겉에서 잰 값).
const OLD_BOOT = ['account.ready', 'createGame', 'presentation', 'syncPort',
  'summary', 'events', 'summary', 'events', 'summary', 'events', 'summary', 'events', 'summary', 'events', 'summary', 'events', 'summary', 'summary'];
const OLD_SCENE = [
  'summary', 'summary',   // 시작
  'summary', 'summary', 'summary', 'summary', 'summary', 'summary', 'summary', 'recommend', 'present', 'present', 'summary',   // 부탁 판까지
  'summary', 'summary', 'answer', 'summary', 'summary',   // 첫 부탁
  'summary', 'summary', 'answer', 'summary', 'summary',   // 둘째 부탁 — 장면 끝
];

test('꺼진 판 — 문도 깃발도 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다', async () => {
  const page = await boot();
  assert.deepEqual(page.log, OLD_BOOT);
  assert.equal(page.created.length, 1);
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].gameId, 'story-classroom');
  assert.equal(page.created[0].storage, page.local, '이 창의 localStorage');
  const from = page.log.length;
  const state = await page.playFirstScene();
  assert.equal(state.phase, 'outro');
  assert.deepEqual(page.log.slice(from), OLD_SCENE, '첫 장면까지 옛 코치에 닿는 차례가 지금과 같다');
  const touched = page.specifiers();
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.equal(page.log.some((entry) => entry === 'indexedDB.open' || entry.includes('/atlas/')), false);
  assert.match(page.$('#account-status').textContent, /이 브라우저에 저장/);
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다', async () => {
  const asked = [];
  const door = { open: async (request) => { asked.push(request); return null; } };
  const page = await boot({ door });
  assert.deepEqual(asked, [{ gameId: 'story-classroom', banks: ['story-classroom'] }]);
  assert.deepEqual(page.log, OLD_BOOT, '옛 길은 지금과 같은 차례');
  assert.equal(page.created[0].storage, page.local);
  assert.ok(page.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
  const from = page.log.length;
  await page.playFirstScene();
  assert.deepEqual(page.log.slice(from), OLD_SCENE);
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 놀기만 한다 — 그 밖의 실패도 옛 길을 열지 않는다', async () => {
  const door = { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } };
  const page = await boot({ door });
  assert.deepEqual(page.log, ['account.ready'], '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.equal(page.$('#account-status').textContent, '', '안내 없이');
  const state = await page.playFirstScene();
  assert.equal(state.phase, 'outro', '이야기는 그대로 논다');
  assert.deepEqual(page.log, ['account.ready']);
  const errors = console.error;
  console.error = () => {};
  try {
    const broken = await boot({ door: { open: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); } } });
    assert.equal(broken.log.includes('createGame'), false);
    assert.match(broken.$('#account-status').textContent, /학습 기록을 사용할 수 없어/);
  } finally { console.error = errors; }
});

// 셸 코치 흉내 — 판 길이(startSet)와 제시 · 답 · 판 닫기를 차례대로 적는다.
function shellCoach(calls) {
  let n = 0, sets = 0;
  return {
    presentation: () => { calls.push('presentation'); return { support: 'independent' }; },
    summary: () => { calls.push('summary'); return { storage: { available: true, guest: true } }; },
    itemUnits: () => { calls.push('itemUnits'); return [{ unit: 'u', kind: 'word', label: null }]; },
    present: (item, context) => { calls.push(context ? ['present', item.itemKey, context] : ['present', item.itemKey]); return `p${(n += 1)}`; },
    help: (pid, kind) => { calls.push(['help', pid, kind]); return {}; },
    answer: (pid, result) => { calls.push(['answer', pid, result]); return { eventId: `a${n}`, verdict: result.correct ? 'correct' : 'incorrect' }; },
    recommend: () => { calls.push('recommend'); return { status: 'none', selected: null }; },
    startSet: (options) => { calls.push(['startSet', options]); return { opened: true, setId: `s${(sets += 1)}` }; },
    finishSet: (options) => { calls.push(['finishSet', options]); },
  };
}
const setCalls = (calls) => calls.filter((call) => Array.isArray(call) && ['startSet', 'present', 'finishSet'].includes(call[0]))
  .map((call) => (call[0] === 'startSet' ? `startSet ${call[1].length}` : call[0]));
async function toAsk(page) {
  for (let i = 0; i < 40 && !['play', 'review'].includes(page.story.state().phase); i += 1) page.story.advance();
}

test('문이 겉을 주면 그 겉으로 연다 — 옛 코치 없음, recommend 없이 장면의 부탁을 함께 제시, 이야기를 열 때 앞 판을 닫고 첫 제시 앞에서 판 길이로 연다', async () => {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const calls = [];
  const coach = shellCoach(calls);
  const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'story-classroom', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  assert.equal(page.log.includes('createGame'), false);
  assert.equal(calls[0], 'presentation', '자동 읽기의 처음 값은 새 코치의 표시 설정');
  assert.ok(calls.every((call) => call === 'presentation' || call === 'summary'), '입구는 표시 설정과 저장 상태만 읽는다');
  assert.match(page.$('#account-status').textContent, /이 브라우저에 저장/);
  calls.length = 0;
  const state = await page.playFirstScene();
  assert.equal(state.phase, 'outro');
  const acts = calls.filter((call) => Array.isArray(call)).map((call) => call.slice(0, 2).join(' '));
  assert.deepEqual(acts, [
    'finishSet [object Object]',
    'startSet [object Object]',
    'present story-classroom.cleanup-snacks.classroom-birthday-2', 'present story-classroom.cleanup-paper.classroom-birthday-2',
    'answer p1', 'answer p2',
  ], '이야기를 열 때 앞 판을 닫고, 첫 제시 앞에서 판을 연 뒤 첫 장면의 부탁 둘을 한꺼번에 제시하고 놓을 때마다 답');
  assert.deepEqual(calls.find((call) => call[0] === 'startSet')[1], { length: 9 }, '판 길이는 이 판에서 낼 제시 수(장면 셋의 부탁 여섯 + 바뀐 부탁 셋)');
  assert.equal(calls.includes('recommend'), false, '새 길은 recommend를 부르지 않는다');
  assert.deepEqual(calls.find((call) => call[0] === 'answer')[2], { correct: true, assessable: true, attemptNo: 1 });
  // 결과까지 — 판은 다시 열리지 않고, 판 끝에 기록 없이 닫는다.
  calls.length = 0;
  for (let i = 0; i < 80 && page.story.state().phase !== 'complete'; i += 1) {
    if (['play', 'review'].includes(page.story.state().phase)) await page.story.solve(); else page.story.advance();
  }
  assert.equal(page.story.state().phase, 'complete');
  assert.equal(calls.filter((call) => call[0] === 'present').length, 7, '남은 장면 둘 · 바뀐 부탁 셋');
  assert.equal(calls.some((call) => call[0] === 'startSet'), false, '이야기 가운데 판을 다시 열지 않는다');
  assert.deepEqual(calls.filter((call) => call[0] === 'finishSet'), [['finishSet', { record: false }]], '판 끝에 한 번');
  // 한 판 더 — 앞 판을 닫고(이야기를 열 때) 새 판의 첫 제시 앞에서 다시 판 길이로 연다.
  calls.length = 0;
  await page.$('#again').onclick();
  await toAsk(page);
  assert.deepEqual(setCalls(calls), ['finishSet', 'startSet 9', 'present', 'present']);
  door.dispose();
});

test('이어 하기 — 남은 제시 수로 판을 연다(둘째 장면에서 이으면 7)', async () => {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const calls = [];
  const door = createGameDoor({ entry: { gameCoach: async () => shellCoach(calls), retired: () => () => {} }, gameId: 'story-classroom', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  await page.playFirstScene();
  page.story.advance();
  await toAsk(page);
  assert.deepEqual([page.story.state().phase, page.story.state().act], ['play', 1]);
  // 둘째 장면의 부탁 판에서 그만두고(진행이 저장된다) 이어 한다.
  await page.$('#quit').onclick();
  calls.length = 0;
  await page.$('#resume').onclick();
  assert.deepEqual([page.story.state().phase, page.story.state().act], ['play', 1], '저장한 자리에서 잇는다');
  assert.deepEqual(setCalls(calls), ['finishSet', 'startSet 7', 'present', 'present'], '남은 장면 둘의 부탁 넷 + 바뀐 부탁 셋');
  door.dispose();
});

test('셸 코치에 startSet이 없으면(앞 판 엔진) 판 길이 없이 첫 제시가 기본 판을 열고 놀이는 그대로다', async () => {
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const calls = [];
  const { startSet, ...older } = shellCoach(calls);
  const door = createGameDoor({ entry: { gameCoach: async () => older, retired: () => () => {} }, gameId: 'story-classroom', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  assert.equal(typeof startSet, 'function');
  calls.length = 0;
  await page.$('#start').onclick();
  for (let i = 0; i < 80 && page.story.state().phase !== 'complete'; i += 1) {
    if (['play', 'review'].includes(page.story.state().phase)) await page.story.solve(); else page.story.advance();
  }
  assert.equal(page.story.state().phase, 'complete', '이야기는 끝까지');
  assert.equal(calls.filter((call) => call[0] === 'present').length, 9);
  assert.deepEqual(calls.filter((call) => call[0] === 'finishSet').length, 2, '열 때와 판 끝');
  door.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않고 입구를 싣는다', async () => {
  const errors = console.error;
  console.error = () => {};
  try {
    const page = await boot({ host: 'localhost', search: '?atlas=next' });
    assert.equal(page.log.includes('createGame'), false);
    assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
    const public_ = await boot({ host: 'synk.im', search: '?atlas=next' });
    assert.deepEqual(public_.log, OLD_BOOT, '공개 주소에서는 깃발을 읽지 않는다');
  } finally { console.error = errors; }
});
