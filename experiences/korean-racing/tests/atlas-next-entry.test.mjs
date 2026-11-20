// 레이싱 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.js를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉, three는
// vendor/three.module.js — 3D 준비는 WebGL이 없어 실패하고 입구에 머문다).
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다.
//            옛 코치에 닿는 차례(OLD_START)는 4-6d 앞의 app.js로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은 겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 기다린 뒤 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 안내 없이 기록 없이 달린다.
//   문이 겉을 주면 그 겉으로 연다(옛 코치를 만들지 않고, 입구에서 엔진에 고르게 하지 않으며, 기록 지우기 단추를 숨긴다).
//   문이 있어도 첫 화면(입구 그리기 · 3D 준비)은 코치를 기다리지 않는다.
//   연 뒤에 판을 다시 정하거나(onRetired) 겉이 닫혀도(RUN_ENDED) 저장 안내가 「저장이 제한되어」로 떨어지지 않고, 다음 레이스에서 다시 열면
//   그 코치로 계정 기록인지 다시 정한다(4-6 끝 판 B6 · B2/GB8과 같은 규칙). 요소의 듣개는 적어 두었다가 시험이 부른다(fire).
// 이 파일은 처음 시험이 끝날 때까지 새 길 모듈을 싣지 않는다(맨 위에서 부르지 않는다) — 꺼진 판 시험이 그 모듈의 적재를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const THREE_URL = new URL('../vendor/three.module.js', import.meta.url).href;
const resolved = [];
registerHooks({
  resolve(specifier, context, next) {
    resolved.push(specifier);
    // 페이지는 importmap으로 three를 vendor/에서 받는다.
    return next(specifier === 'three' ? THREE_URL : specifier, context);
  },
});

function stubNode() {
  const store = new Map();
  const listeners = new Map();
  return new Proxy(function stub() {}, {
    get(_t, prop) {
      if (store.has(prop)) return store.get(prop);
      if (prop === 'addEventListener') return (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); };
      if (prop === 'fire') return (type, event = {}) => (listeners.get(type) ?? []).map((fn) => fn({ preventDefault() {}, ...event }));
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
    documentElement: { dataset: {}, setAttribute() {} },
    fonts: { ready: Promise.resolve() },
    hidden: false,
    querySelector: (sel) => { if (!nodes.has(sel)) nodes.set(sel, stubNode()); return nodes.get(sel); },
    querySelectorAll: () => [],
    getElementById: (id) => own.querySelector(`#${id}`),
    createElement: () => stubNode(),
    createElementNS: () => stubNode(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const rest = stubNode();
  return new Proxy(own, { get: (target, prop) => (prop in target ? target[prop] : rest[prop]) });
}
function fakeStorage() {
  const map = new Map();
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

const until = async (check, ms = 10000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 5));
};
let boots = 0;
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판). 3D 준비가 실패해 입구에 머물고, 문이 있으면 open이 끝날 때까지 기다린다.
async function boot({ door = null, host = 'synk.im', search = '', settled = () => true } = {}) {
  const log = [];
  const created = [];
  const local = fakeStorage();
  const doc = fakeDocument();
  const coach = loggingCoach(log);
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  const quiet = { error: console.error, warn: console.warn };
  const errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  console.warn = () => {};
  delete globalThis.__racingError;
  Object.assign(globalThis, {
    window: globalThis, document: doc,
    location: { hostname: host, search, pathname: '/play/racing/', href: `https://${host}/play/racing/${search}`, reload() {} },
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { createGame: (options) => { log.push('createGame'); created.push(options); return coach; } },
    SynkPlayAccount: { ready: async () => { log.push('account.ready'); }, storage: () => local, status: () => ({ mode: 'guest' }) },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {}, removeEventListener() {}, confirm: () => false,
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
    ResizeObserver: class { observe() {} disconnect() {} },
    history: { replaceState() {}, state: null },
    indexedDB: { open: () => { log.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async (url) => { log.push(`fetch ${url}`); throw new Error('닫힘'); },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { deviceMemory: 8, hardwareConcurrency: 8 }, configurable: true, writable: true });
  try {
    await import(`../app.js?boot=${(boots += 1)}`);
    await until(() => globalThis.__racingError && settled(log));
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    console.error = quiet.error; console.warn = quiet.warn;
  }
  const $ = (sel) => doc.querySelector(sel);
  return { log, created, local, $, errors, specifiers: () => resolved.slice(from) };
}

// 4-6d 앞의 app.js가 시작할 때 옛 코치에 닿는 차례(같은 겉에서 잰 값): 계정 준비 → 옛 코치 → 저장 알림 → 입구(맞춤 판 · 놓친 문제 · 저장 안내)
// → 3D 준비가 실패한 뒤 입구를 한 번 더.
const LOBBY = ['live', 'summary', 'events', 'recommend', 'summary', 'summary', 'events'];
const OLD_START = ['account.ready', 'createGame', 'syncPort', ...LOBBY, ...LOBBY];

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다', async () => {
  const page = await boot();
  assert.deepEqual(page.log, OLD_START);
  assert.equal(page.created.length, 1);
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].gameId, 'korean-racing');
  assert.equal(page.created[0].storage, page.local, '이 창의 localStorage');
  const touched = page.specifiers();
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.equal(page.log.some((entry) => entry.startsWith('fetch') || entry === 'indexedDB.open'), false);
  assert.equal(page.$('#reset-learning').hidden, false, '꺼진 판은 기록 지우기를 그대로 둔다');
  assert.equal(page.$('#learning-scope').textContent, '지금 연습은 이 브라우저에 저장돼요.');
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다 — 첫 화면은 기다리지 않는다', async () => {
  const asked = [];
  let answer;
  const door = { open: (request) => { asked.push(request); return new Promise((resolve) => { answer = () => resolve(null); }); } };
  // 셸이 답하기 전: 입구를 그리고 3D 준비를 시작했지만(실패해 입구에 머문다) 옛 코치는 아직 없다.
  const waiting = await boot({ door, settled: () => !!answer });
  assert.deepEqual(asked, [{ gameId: 'korean-racing', banks: ['korean-racing'] }]);
  assert.deepEqual(waiting.log, ['account.ready'], '코치를 기다리는 동안 옛 코치를 만들지 않는다');
  assert.ok(globalThis.__racingError, '3D 준비는 코치를 기다리지 않고 이미 돌았다(이 겉에서는 WebGL이 없어 실패)');
  assert.equal(waiting.$('#reset-learning').hidden, true);
  answer();
  await until(() => waiting.log.includes('createGame') && waiting.log.length >= 3 + LOBBY.length);
  assert.deepEqual(waiting.log, ['account.ready', 'createGame', 'syncPort', ...LOBBY], '옛 길은 지금과 같은 차례(옛 코치 → 저장 알림 → 입구)');
  assert.deepEqual(waiting.created, [{ gameId: 'korean-racing', storage: waiting.local }]);
  assert.ok(waiting.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
  assert.equal(waiting.$('#reset-learning').hidden, false, '옛 길이면 기록 지우기를 지금처럼');
  assert.equal(waiting.$('#learning-scope').textContent, '지금 연습은 이 브라우저에 저장돼요.');
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 기록 없이 달린다 — 다른 실패도 옛 길을 열지 않는다', async () => {
  const door = { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } };
  const page = await boot({ door });
  assert.deepEqual(page.log, ['account.ready'], '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.equal(page.$('#learning-scope').textContent, '', '「맞춤 기록을 연결하지 못했어요」 안내도 없다');
  assert.equal(page.$('#reset-learning').hidden, true);
  const broken = await boot({ door: { open: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); } } });
  assert.equal(broken.log.includes('createGame'), false);
  assert.match(broken.$('#learning-scope').textContent, /맞춤 기록을 연결하지 못했어요/);
  assert.equal(broken.$('#reset-learning').hidden, true);
  assert.ok(broken.errors.some((text) => text.includes('지도')), '새 길을 열지 못한 까닭은 콘솔에 남긴다');
});

test('문이 겉을 주면 그 겉으로 연다 — 옛 코치 없음, 입구에서 엔진에 고르게 하지 않음, 기록 지우기 숨김, 계정이면 WORLD 계정 안내', async () => {
  const { createGameDoor } = await import('../../synk-world-app/world-atlas-game.mjs');
  for (const guest of [true, false]) {
    const calls = [];
    const coach = {
      summary: () => { calls.push('summary'); return { storage: { available: true, guest } }; },
      recommend: () => { calls.push('recommend'); return { status: 'none', selected: null }; },
      present: () => { calls.push('present'); return 'p1'; },
      finishSet: () => { calls.push('finishSet'); },
      live: () => { calls.push('live'); return {}; },
      today: () => null,
    };
    const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'korean-racing', later: (fn) => fn() });
    const page = await boot({ door: door.api, settled: () => calls.length >= 2 });
    assert.equal(page.log.includes('createGame'), false);
    assert.deepEqual([...new Set(calls)], ['summary'], '입구는 저장 상태만 읽는다(맞춤 판은 관문마다 고른다)');
    assert.equal(page.$('#reset-learning').hidden, true);
    assert.equal(page.$('#learning-scope').textContent, guest ? '지금 연습은 이 브라우저에 저장돼요.' : 'WORLD 계정의 학습 기록 · 공유와 삭제는 WORLD 계정 설정에서 관리해요');
    door.dispose();
  }
});

// 진짜 엔진 코치(메모리 저장소) — 손님이거나 계정.
async function engineCoach(account = null) {
  const { readFileSync } = await import('node:fs');
  const atlas = await import('../../../packages/atlas/src/index.mjs');
  const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const mapData = { index: json('../../../packages/atlas/map/index.json'), units: json('../../../packages/atlas/map/units.json') };
  const key = `synk-atlas:korean-racing-entry-${process.pid}-${(boots += 1)}`;
  const host = account ? { guest: false, account, revision: 1 } : { guest: true };
  const coach = atlas.createCoach({ gameId: 'korean-racing', mapData, dayOffset: 540, host: { ...host, port: atlas.memoryPort(), key } });
  await coach.ready;
  return coach;
}
const ACCOUNT_SCOPE = 'WORLD 계정의 학습 기록 · 공유와 삭제는 WORLD 계정 설정에서 관리해요';
const LOCAL_SCOPE = '지금 연습은 이 브라우저에 저장돼요.';
const LIMITED_SCOPE = '저장이 제한되어 이번 페이지에서만 맞춤 기록을 유지해요.';
const RETIRED_SCOPE = '학습 기록은 다음 레이스를 시작할 때 다시 이어요.';
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test('판을 다시 정하면 입구는 다음 레이스에서 다시 잇는다고 말하고, 다음 레이스에서 다시 연 코치로 계정 기록인지 다시 정한다 — 계정 → 손님', async () => {
  const { createGameDoor } = await import('../../synk-world-app/world-atlas-game.mjs');
  const account = await engineCoach('acct-racing');
  const guest = await engineCoach();
  const given = [account, guest];
  const retirers = new Set();
  const entry = { gameCoach: async () => given.shift(), retired: (_made, fn) => { retirers.add(fn); return () => retirers.delete(fn); } };
  const door = createGameDoor({ entry, gameId: 'korean-racing', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  assert.equal(page.$('#learning-scope').textContent, ACCOUNT_SCOPE);
  for (const fn of [...retirers]) fn({ reason: 'account' });
  page.$('#driver-marin').fire('click');   // 입구를 다시 그린다
  assert.notEqual(page.$('#learning-scope').textContent, LIMITED_SCOPE, '판을 다시 정한 겉은 저장 제한이 아니다');
  assert.equal(page.$('#learning-scope').textContent, RETIRED_SCOPE);
  assert.equal(page.$('#reset-learning').hidden, true);
  page.$('#start').fire('click');   // 다음 레이스 — 3D가 없어 출발은 못 하지만 문은 다시 연다
  await tick();
  assert.equal(given.length, 0, '문을 다시 열어 손님 코치를 받았다');
  assert.equal(page.$('#learning-scope').textContent, LOCAL_SCOPE, '다시 연 손님 코치는 이 브라우저 기록');
  assert.equal(page.$('#reset-learning').hidden, true, '새 길은 기록 지우기를 쓰지 않는다');
  door.dispose();
  account.dispose();
  guest.dispose();
});

test('연 뒤에 겉이 닫히면(RUN_ENDED) 입구는 저장 안내를 쓰지 않는다 — 「저장이 제한되어」로 떨어지지 않는다', async () => {
  const { createGameDoor } = await import('../../synk-world-app/world-atlas-game.mjs');
  const coach = await engineCoach('acct-racing');
  const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'korean-racing', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  assert.equal(page.$('#learning-scope').textContent, ACCOUNT_SCOPE);
  door.dispose();   // 패널이 닫힌다 — 겉의 다음 부르기가 RUN_ENDED
  page.$('#driver-marin').fire('click');
  assert.equal(page.$('#learning-scope').textContent, '', '기록 없이 달리는 판');
  page.$('#driver-kkamong').fire('click');
  assert.equal(page.$('#learning-scope').textContent, '', '다시 그려도 그대로');
  assert.equal(page.$('#reset-learning').hidden, true);
  coach.dispose();
});

test('원문 — 조작 연습도 판을 다시 정한 겉이면 문을 다시 연 뒤에 판을 연다(레이스 출발과 같은 차례)', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const body = (name) => { const at = source.indexOf(`async function ${name}(`); return source.slice(at, source.indexOf('\n}\n', at)); };
  for (const name of ['start', 'startTutorial']) {
    const text = body(name);
    const opening = text.indexOf('if (learningOpening) await learningOpening;');
    const reopen = text.indexOf('if (nextRace?.retired) await reopenRace();');
    assert.ok(opening > 0 && reopen > opening, `${name}: 받는 중이면 기다린 뒤 판을 다시 정한 겉을 다시 연다`);
    const first = Math.min(...['beginPlan(', 'learn((c)', 'await startTutorial()'].map((word) => text.indexOf(word)).filter((at) => at >= 0));
    assert.ok(reopen < first, `${name}: 판을 열거나 기록하기 전에`);
  }
});

test('원문 — 학습 허브의 듣기 맞춤 코스(?learning=)를 소리를 끈 채 짓지 못했으면 예약한 출발도 기본 코스로 가지 않고 소리를 켜라고 안내한다', async () => {
  // 3D가 준비돼야 지나는 차례라(준비 → 요청한 코스 짓기 → 예약한 출발) 노드에서는 원문으로 본다(다시 보기 GA3).
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const body = (head) => { const at = source.indexOf(head); assert.ok(at >= 0, head); return source.slice(at, source.indexOf('\n}\n', at)); };
  // 준비되면 요청한 코스를 짓고, 그다음 예약한 출발을 부른다.
  const ready = source.indexOf('ready = true; loadState = \'ready\';');
  assert.ok(ready > 0 && source.indexOf('prepareRequestedCourse();', ready) < source.indexOf('runPendingStart();', ready));
  // 새 길에서 짓지 못하면(소리를 끈 채 듣기 영역만) 기다림 표시를 남기고, 코스를 고르면 지운다.
  assert.match(body('function prepareRequestedCourse() {'), /if \(plan\?\.stage\) selectStage\(plan\.stage\);\n    else if \(nextRace\) requestHeld = true;/);
  assert.match(body('function selectStage(s) {'), /^function selectStage\(s\) \{\n  requestHeld = false;/);
  // 출발은 기다리는 요청이 있으면 그때 다시 짓고, 못 지으면 소리를 켜라고 안내하고 멈춘다 — 판을 열거나 출발을 예약하기 전에.
  const start = body('async function start(');
  const held = start.indexOf('if (nextRace && !demo && requestHeld) {');
  assert.ok(held > start.indexOf('if (starting || !demo && !isUnlocked(round.selectedStage)) return;'));
  assert.ok(held < start.indexOf('if (!ready) {'), '예약한 출발을 실행할 때도 지난다');
  assert.ok(held < start.indexOf('beginPlan('));
  assert.match(start.slice(held), /^if \(nextRace && !demo && requestHeld\) \{\n    const plan = nextPersonalized\(\);\n    if \(!plan\) \{ lobbyNote\('이번 맞춤 판은 듣기 문항이에요\. 소리를 켜면 바로 시작할 수 있어요\.'\); return; \}\n    selectStage\(plan\.stage\);/);
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않는다', async () => {
  const page = await boot({ host: 'localhost', search: '?atlas=next', settled: () => resolved.includes('/atlas/loader.js') });
  assert.equal(page.log.includes('createGame'), false);
  assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
});
