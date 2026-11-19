// 낱말 마법 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉,
// 그림 · 소리는 곧바로 끝나는 흉내). 소리 확인 판 하나를 키 입력으로 끝까지 해 코치에 닿는 차례를 본다.
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례(모듈 첫 실행 — 계정 준비 뒤)에 불리고, 새 길 모듈 · /atlas/ ·
//            IndexedDB를 건드리지 않는다. 옛 코치에 닿는 차례(OLD_*)는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은
//            겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 기다린 뒤 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 기록 없이 논다.
//   문이 겉을 주면 그 겉으로 연다 — 같은 판이 present만(recommend 없음) · 첫 답만 · 판 끝 finishSet, 답하기 전에 떠나면 skipped.
//   코치에 startSet이 있으면 첫 확인을 내기 전에 판 길이 2를 넘긴다.
//   로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길(입구 /atlas/loader.js)로 간다.
// 이 파일은 처음 시험이 끝날 때까지 새 길 모듈을 싣지 않는다(맨 위에서 부르지 않는다) — 꺼진 판 시험이 그 모듈의 적재를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PUZZLES } from './content.mjs';
import { initialProgress, SAVE_KEY } from './core.mjs';

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
// 문서 겉 — 열린 대화 상자는 없다(키 입력이 막히지 않게). 듣는 함수는 모아 두고 시험이 부른다.
function fakeDocument(listeners) {
  const nodes = new Map();
  const own = {
    documentElement: { dataset: {} },
    fonts: { ready: Promise.resolve() },
    hidden: false,
    querySelector: (sel) => { if (sel.includes('[open]')) return null; if (!nodes.has(sel)) nodes.set(sel, stubNode()); return nodes.get(sel); },
    querySelectorAll: () => [],
    getElementById: (id) => own.querySelector(`#${id}`),
    createElement: () => stubNode(),
    addEventListener: (type, fn) => listeners.push([`document.${type}`, fn]),
    removeEventListener: () => {},
  };
  const rest = stubNode();
  return new Proxy(own, { get: (target, prop) => (prop in target ? target[prop] : rest[prop]) });
}
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}
// 그림은 곧바로 실리고, 소리는 곧바로 끝난다.
class FakeImage {
  constructor() { this.width = 320; this.height = 200; }
  set src(value) { this.url = value; setTimeout(() => this.onload?.(), 0); }
  get src() { return this.url; }
  decode() { return Promise.resolve(); }
}
class FakeAudio {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  resume() { return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve({ duration: 1 }); }
  createBufferSource() { const source = { buffer: null, connect() {}, stop() {}, start() { setTimeout(() => source.onended?.(), 0); } }; return source; }
  createOscillator() { return stubNode(); }
  createGain() { return stubNode(); }
}
// 옛 코치 흉내 — 부른 메서드를 차례대로 적는다(제시는 문항 열쇠, 답 · 도움 · 전달은 넘긴 값).
function loggingCoach(log) {
  let n = 0;
  const show = { present: (meta) => meta.itemKey, delivery: (_pid, value) => value.audio, help: (_pid, kind) => kind, answer: (_pid, value) => JSON.stringify(value) };
  return new Proxy({}, {
    get(_t, name) {
      if (name === 'then' || typeof name === 'symbol') return undefined;
      return (...args) => { log.push(`${name}${show[name] ? ` ${show[name](...args)}` : ''}`); return name === 'present' ? `p${(n += 1)}` : null; };
    },
  });
}
// 같은 차례의 섞기(checkpointRound) — 판마다 같은 순서로 낸다.
function seeded(seed = 7) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));
async function until(check, what) {
  for (let i = 0; i < 500; i += 1) { if (check()) return; await tick(); }
  assert.fail(`기다림이 끝나지 않았다: ${what}`);
}
// 첫 장의 사건 여섯을 마치고 소리 확인 둘을 기다리는 진행(「남은 소리 확인 이어 하기」).
function awaitingChecks() {
  const progress = initialProgress();
  progress.introduced = ['size'];
  progress.completed = PUZZLES.filter((p) => p.chapter === 0).map((p) => p.id);
  return JSON.stringify(progress);
}

let boots = 0;
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판).
async function boot({ door = null, host = 'synk.im', search = '?qa', progress = awaitingChecks() } = {}) {
  const log = [];
  const created = [];
  const listeners = [];
  const local = fakeStorage();
  const saved = fakeStorage(progress ? { [SAVE_KEY]: progress } : {});
  const doc = fakeDocument(listeners);
  const coach = loggingCoach(log);
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  const random = Math.random;
  Math.random = seeded();
  Object.assign(globalThis, {
    window: globalThis, document: doc,
    location: { hostname: host, search, pathname: '/word-magic/' },
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { createGame: (options) => { log.push('createGame'); created.push(options); return coach; } },
    SynkPlayAccount: { ready: async () => { log.push('account.ready'); }, storage: () => saved, status: () => ({ mode: 'guest', accountId: null, phase: 'ready' }), subscribe: () => () => {} },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, devicePixelRatio: 1,
    matchMedia: () => ({ matches: true, addEventListener() {} }), scrollTo() {},
    addEventListener: (type, fn) => listeners.push([`window.${type}`, fn]), removeEventListener() {},
    Image: FakeImage, AudioContext: FakeAudio,
    indexedDB: { open: () => { log.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async (input) => {
      const url = String(input?.url ?? input);
      if (url.startsWith('file:')) { const bytes = readFileSync(fileURLToPath(url)); return { ok: true, json: async () => JSON.parse(bytes.toString('utf8')), arrayBuffer: async () => bytes.buffer }; }
      log.push(`fetch ${url}`); throw new Error('닫힘');
    },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  await import(`./app.mjs?boot=${(boots += 1)}`);
  const $ = (sel) => doc.querySelector(sel);
  const fire = (type, event = {}) => { for (const [name, fn] of listeners) if (name === type) fn(event); };
  const page = {
    log, created, local, $, fire,
    qa: () => globalThis.__wordMagic.state(),
    specifiers: () => resolved.slice(from),
    // 키 하나(A · S: 고르기, R: 다시 듣기).
    key: (code) => fire('document.keydown', { code, repeat: false, altKey: false, ctrlKey: false, metaKey: false, preventDefault() {} }),
    // 지금 확인의 맞는 · 틀린 단추 키.
    choice: (right) => { const check = page.qa().check; return ['KeyA', 'KeyS'][check.choices.findIndex((id) => (id === check.spell) === right)]; },
    // index번째 확인을 다 들었다(새 길의 startCheck는 코치를 기다린 뒤에 확인을 바꾼다 — 앞 확인의 들음으로 끝나지 않게 번호를 본다).
    heard: (index = 0) => until(() => { const s = page.qa(); return s.screen === 'checkpoint' && s.checkIndex === index && s.attempt === 0 && s.heard && !s.busy; }, `소리 확인 ${index + 1}을 다 들음`),
    done: () => { Math.random = random; },
  };
  return page;
}

// 소리 확인 판 하나: 「남은 소리 확인 이어 하기」 → 첫 확인을 틀린 뒤 다시 고름 → 둘째 확인을 다시 듣고 맞힘 → 모험 끝 → 처음으로.
async function playChecks(page) {
  page.$('#start').onclick();
  await page.heard();
  page.key(page.choice(false));
  await until(() => page.qa().attempt === 1, '첫 고르기');
  page.key(page.choice(true));
  await until(() => page.qa().solved, '다시 고르기');
  page.$('#next').onclick();
  await page.heard(1);
  page.key('KeyR');
  await page.heard(1);
  page.key(page.choice(true));
  await until(() => page.qa().solved, '둘째 확인');
  page.$('#next').onclick();
  await until(() => page.qa().screen === 'ending', '모험 끝');
  page.$('#pause-home').onclick();
  await tick();
}
// 첫 확인을 듣기만 하고 떠난다(pagehide).
async function leaveBeforeAnswer(page) {
  page.$('#start').onclick();
  await page.heard();
  page.fire('window.pagehide');
  await tick();
}

// 4-6d 앞의 app.mjs가 옛 코치에 닿는 차례(같은 겉 · 같은 섞기에서 잰 값).
const OLD_BOOT = ['account.ready', 'createGame'];
const OLD_CHECKS = [
  ...OLD_BOOT,
  'present word-magic.size.shrink.v2', 'delivery completed', 'answer {"correct":false,"assessable":true}', 'help hint',
  'present word-magic.size.grow.v2', 'delivery completed', 'help replay', 'answer {"correct":true,"assessable":true}',
];
const OLD_LEAVE = [...OLD_BOOT, 'present word-magic.size.shrink.v2', 'delivery completed', 'answer {"correct":false,"assessable":false,"reason":"skip"}'];
// 새 길에서 셸 코치에 닿는 차례(같은 판). 둘째 고르기 · 모험 끝 뒤의 처음으로는 닿지 않는다.
const NEXT_CHECKS = ['itemUnits', 'startSet', 'present', 'delivery', 'answer', 'help', 'itemUnits', 'present', 'delivery', 'help', 'answer', 'finishSet'];

const quietErrors = async (fn) => {
  const error = console.error;
  const seen = [];
  console.error = (...args) => seen.push(args);
  try { await fn(); } finally { console.error = error; }
  return seen;
};

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다', async () => {
  const page = await boot();
  assert.deepEqual(page.log, OLD_BOOT, '모듈 첫 실행 — 계정 준비 뒤 곧바로');
  assert.equal(page.created.length, 1);
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].gameId, 'word-magic');
  assert.equal(page.created[0].storage, page.local, '이 창의 localStorage');
  await playChecks(page);
  assert.deepEqual(page.log, OLD_CHECKS, '소리 확인 판 — 4-6d 앞과 같은 차례 · 같은 값');
  page.done();
  const leaving = await boot();
  await leaveBeforeAnswer(leaving);
  assert.deepEqual(leaving.log, OLD_LEAVE, '답하기 전에 떠나면 옛 길은 지금처럼 reason skip');
  leaving.done();
  const touched = [...page.specifiers(), ...leaving.specifiers()];
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.equal([...page.log, ...leaving.log].some((entry) => entry.startsWith('fetch') || entry === 'indexedDB.open'), false);
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다', async () => {
  const asked = [];
  const page = await boot({ door: { open: async (request) => { asked.push(request); return null; } } });
  await until(() => page.created.length === 1, '옛 코치');
  assert.deepEqual(asked, [{ gameId: 'word-magic', banks: ['word-magic'] }]);
  assert.equal(page.created[0].storage, page.local);
  await playChecks(page);
  assert.deepEqual(page.log, OLD_CHECKS, '옛 길은 지금과 같은 차례');
  assert.ok(page.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
  page.done();
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 기록 없이 놀기만 한다', async () => {
  const page = await boot({ door: { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } } });
  const errors = await quietErrors(() => playChecks(page));
  assert.deepEqual(page.log, ['account.ready'], '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.equal(page.qa().screen, 'lobby', '소리 확인 판은 끝까지 놀았다');
  assert.equal(errors.length, 0, 'RUN_ENDED는 오류로 적지 않는다');
  page.done();
});

test('문이 겉을 주면 그 겉으로 연다 — 같은 판이 present만 · 첫 고르기만 답 · 판 끝 finishSet, 답하기 전에 떠나면 저장된 판정이 skipped', async () => {
  const atlas = await import('../../packages/atlas/src/index.mjs');
  const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const eventsOf = async (port) => (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
  // 진짜 엔진 코치(손님 · 메모리 저장소)를 셸의 문에 넣는다. 부른 메서드를 적는다.
  async function shell() {
    const port = atlas.memoryPort();
    const engine = atlas.createCoach({ gameId: 'word-magic', mapData, dayOffset: 540, scope: {}, host: { guest: true, port, key: `synk-atlas:word-magic-entry-${process.pid}-${boots}` } });
    await engine.ready;
    const names = [];
    const coach = Object.fromEntries(Object.keys(engine).map((name) => [name, typeof engine[name] === 'function' ? (...args) => { names.push(name); return engine[name](...args); } : engine[name]]));
    const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'word-magic', later: (fn) => fn() });
    return { port, engine, names, door };
  }
  const one = await shell();
  const page = await boot({ door: one.door.api });
  await playChecks(page);
  assert.equal(page.created.length, 0, '옛 코치를 만들지 않는다');
  assert.deepEqual(one.names, NEXT_CHECKS);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const rows = await eventsOf(one.port);
  const presented = rows.filter((row) => row.type === 'practice.presented');
  assert.deepEqual(presented.map((row) => row.itemKey), ['word-magic.size.shrink.v2', 'word-magic.size.grow.v2'], '옛 길과 같은 문항 · 차례');
  assert.ok(presented.every((row) => row.arm === 'host' && row.reason.code === 'host.order'));
  assert.equal(presented[0].setId, presented[1].setId, '한 장의 확인 둘이 한 판');
  assert.deepEqual(rows.filter((row) => row.type === 'practice.attempted').map((row) => row.verdict), ['incorrect', 'correct'], '다시 고르기는 남지 않는다');
  page.done();
  one.door.dispose(); one.engine.dispose();

  const two = await shell();
  const leaving = await boot({ door: two.door.api });
  await leaveBeforeAnswer(leaving);
  assert.deepEqual(two.names.slice(0, 6), ['itemUnits', 'startSet', 'present', 'delivery', 'answer', 'finishSet'], '떠날 때의 답이 판 닫기보다 먼저');
  assert.ok(two.names.slice(6).every((name) => name === 'finishSet'), '셸이 다음 차례에 닫는 판');
  await new Promise((resolve) => setTimeout(resolve, 30));
  const attempts = (await eventsOf(two.port)).filter((row) => row.type === 'practice.attempted');
  assert.deepEqual(attempts.map((row) => [row.verdict, row.attemptNo]), [['skipped', 1]], '옛 길의 reason skip이 skipped로(GPT 다시 검토 GA7)');
  leaving.done();
  two.door.dispose(); two.engine.dispose();
});

test('셸이 코치를 준비하는 동안에도 첫 화면은 그려지고, 소리 확인은 코치가 열린 뒤에 낸다', async () => {
  const calls = [];
  const coach = {
    itemUnits: () => { calls.push('itemUnits'); return [{ unit: 'u' }]; },
    present: () => { calls.push('present'); return 'p1'; },
    delivery: () => { calls.push('delivery'); },
    help: () => { calls.push('help'); },
    answer: () => { calls.push('answer'); return {}; },
    finishSet: () => { calls.push('finishSet'); },
  };
  let release;
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const door = createGameDoor({ entry: { gameCoach: () => new Promise((resolve) => (release = () => resolve(coach))), retired: () => () => {} }, gameId: 'word-magic', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  assert.equal(page.$('#hero-title').textContent, 'Word Magic', '맨 위에서 코치를 기다리지 않는다');
  page.$('#start').onclick();
  for (let i = 0; i < 20; i += 1) await tick();
  assert.equal(page.qa().screen, 'lobby', '코치를 기다린다');
  assert.equal(page.qa().busy, true);
  assert.deepEqual(calls, []);
  release();
  await page.heard();
  assert.deepEqual(calls, ['itemUnits', 'present', 'delivery']);
  page.done();
  door.dispose();
});

test('코치에 startSet이 있으면 장의 첫 소리 확인을 내기 전에 판 길이 2를 넘긴다(recommend 없는 정해진 차례 판)', async () => {
  const calls = [];
  let n = 0;
  const coach = {
    itemUnits: () => { calls.push('itemUnits'); return [{ unit: 'u' }]; },
    startSet: (options) => { calls.push(`startSet ${JSON.stringify(options)}`); return { opened: true, setId: 's1' }; },
    present: () => { calls.push('present'); return `p${(n += 1)}`; },
    delivery: () => { calls.push('delivery'); },
    help: () => { calls.push('help'); },
    answer: () => { calls.push('answer'); return {}; },
    finishSet: () => { calls.push('finishSet'); },
  };
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const door = createGameDoor({ entry: { gameCoach: async () => coach, retired: () => () => {} }, gameId: 'word-magic', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  await playChecks(page);
  assert.deepEqual(calls, ['itemUnits', 'startSet {"length":2}', ...NEXT_CHECKS.slice(2)]);
  page.done();
  door.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길(입구)로 간다 — 옛 코치를 만들지 않는다', async () => {
  let page;
  const errors = await quietErrors(async () => {
    page = await boot({ host: 'localhost', search: '?qa&atlas=next' });
    await until(() => page.specifiers().includes('/atlas/loader.js'), '입구');
    for (let i = 0; i < 10; i += 1) await tick();
  });
  assert.equal(page.created.length, 0);
  assert.ok(errors.length > 0, '노드에는 입구가 없다 — 열지 못한 까닭을 적고 기록 없이 논다');
  page.done();
  // 공개 주소에서는 깃발을 읽지 않는다.
  const open = await boot({ host: 'synk.im', search: '?qa&atlas=next' });
  assert.deepEqual(open.log, OLD_BOOT);
  open.done();
});
