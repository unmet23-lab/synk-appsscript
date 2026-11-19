// 입장 검사 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs를 노드에서 띄운다(DOM은 무엇이든 받아 주는 겉).
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다.
//            옛 코치에 닿는 차례는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은 겉에서 돌려 견줬다).
//   문이 있고 open이 null이면 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 안내 없이 놀기만 한다.
//   문이 겉을 주면 그 겉으로 연다 — 옛 코치를 만들지 않고, 추천 근무지는 엔진의 한 줄, 기록 지우기 단추를 숨긴다. 진짜 엔진 코치로 근무 하나를
//   app.mjs의 단추로 끝까지 돈다(손님마다 고르고 · 제시 · 도장 · 근무 끝 finishSet). 단추로 연 연수는 첫 제시 전에 startSet을 부른다.
// 이 파일은 처음 시험이 끝날 때까지 새 길 모듈을 싣지 않는다(맨 위에서 부르지 않는다) — 꺼진 판 시험이 그 모듈의 적재를 본다.
// 맨 아래 원문 검사: 정적 import에 새 길 모듈이 없고, 옛 코치는 같은 줄 그대로이며, learning.mjs가 내보내는 이름(드라마 「오늘」이 부른다)이 그대로다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';

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
      if (prop === 'dataset') { const o = {}; store.set(prop, o); return o; }
      const child = stubNode(); store.set(prop, child); return child;
    },
    set(_t, prop, value) { store.set(prop, value); return true; },
    apply() { return stubNode(); },
  });
}
function fakeDocument() {
  const nodes = new Map();
  const own = {
    documentElement: { dataset: {}, style: stubNode() },
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
const PROGRESS_KEY = 'synk.entry-check.v1';
const played = (plays) => ({ v: 1, stars: {}, plays, tutorial: true, doneDay: null, motion: true });

let boots = 0;
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판). still: 움직임 줄이기(기다림 0).
async function boot({ door = null, progress = null, host = 'synk.im', search = '', still = false } = {}) {
  const log = [];
  const created = [];
  const storage = fakeStorage(progress ? { [PROGRESS_KEY]: JSON.stringify(progress) } : {});
  const local = fakeStorage();
  const doc = fakeDocument();
  const coach = loggingCoach(log);
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  Object.assign(globalThis, {
    window: globalThis, document: doc,
    location: { hostname: host, search, pathname: '/entry-check/' },
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { createGame: (options) => { log.push('createGame'); created.push(options); return coach; } },
    SynkPlayAccount: { ready: async () => { log.push('account.ready'); }, storage: () => storage },
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    matchMedia: () => ({ matches: still, addEventListener() {} }), scrollTo() {}, scrollBy() {}, addEventListener() {}, removeEventListener() {}, confirm: () => false,
    Image: class { decode() { return Promise.resolve(); } },
    indexedDB: { open: () => { log.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async (url) => { log.push(`fetch ${url}`); throw new Error('닫힘'); },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  await import(`./app.mjs?boot=${(boots += 1)}`);
  const $ = (sel) => doc.querySelector(sel);
  return { log, created, local, storage, $, specifiers: () => resolved.slice(from) };
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const quietError = async (fn) => { const error = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = error; } };

// 4-6d 앞의 app.mjs가 시작할 때 옛 코치에 닿는 차례(같은 겉에서 잰 값 — 소리 목록 받기는 코치와 상관없이 늘 한 번).
const OLD_START = ['account.ready', 'createGame', 'fetch assets/voice/voices.json', 'syncPort', 'summary', 'events', 'summary'];
const OLD_START_PLAYED = ['account.ready', 'createGame', 'fetch assets/voice/voices.json', 'syncPort', 'recommend', 'summary', 'events', 'summary', 'events', 'summary'];

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다', async () => {
  const first = await boot();
  assert.deepEqual(first.log, OLD_START);
  assert.equal(first.created.length, 1);
  assert.deepEqual(Object.keys(first.created[0]), ['gameId', 'storage']);
  assert.equal(first.created[0].gameId, 'entry-check');
  assert.equal(first.created[0].storage, first.local, '이 창의 localStorage');
  const again = await boot({ progress: played(3) });
  assert.deepEqual(again.log, OLD_START_PLAYED);
  const touched = [...first.specifiers(), ...again.specifiers()];
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.equal([...first.log, ...again.log].some((entry) => entry === 'indexedDB.open' || entry.includes('/atlas/')), false);
  assert.match(first.$('#rec-reason').textContent, /처음이니까/);
  assert.equal(first.$('#reset-learning').hidden, false, '꺼진 판은 기록 지우기를 그대로 둔다');
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다', async () => {
  const asked = [];
  const door = { open: async (request) => { asked.push(request); return null; } };
  const page = await boot({ door, progress: played(3) });
  assert.deepEqual(asked, [{ gameId: 'entry-check', banks: ['entry-check'] }]);
  assert.deepEqual(page.log, OLD_START_PLAYED, '옛 길은 지금과 같은 차례');
  assert.equal(page.created[0].storage, page.local);
  assert.ok(page.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 안내 없이 놀기만 한다', async () => {
  const door = { open: async () => { throw Object.assign(new Error('닫힘'), { code: 'RUN_ENDED' }); } };
  const page = await boot({ door });
  assert.equal(page.log.includes('createGame'), false, '위 창의 옛 학습 호스트를 부르지 않는다');
  assert.deepEqual(page.log, ['account.ready', 'fetch assets/voice/voices.json']);
  assert.equal(page.$('#storage-note').hidden, true, '「학습 기록을 쓸 수 없어요」 안내도 없다');
  assert.equal(page.$('#reset-learning').hidden, true);
  // 그 밖의 실패(새 길이 맡은 판)도 옛 길을 열지 않는다 — 기록을 쓸 수 없다는 안내만 보인다.
  const broken = await quietError(() => boot({ door: { open: async () => { throw Object.assign(new Error('지도'), { code: 'MAP_FAILED' }); } } }));
  assert.equal(broken.log.includes('createGame'), false);
  assert.equal(broken.$('#storage-note').hidden, false);
  assert.match(broken.$('#storage-note').textContent, /학습 기록을 쓸 수 없어/);
});

test('문이 겉을 주면 그 겉으로 연다 — 옛 코치 없음, 추천 근무지는 엔진의 한 줄, 기록 지우기 숨김, 근무 하나를 단추로 끝까지', async () => {
  const atlas = await import('../../packages/atlas/src/index.mjs');
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const { caseMetadata } = await import('./learning.mjs');
  const { composeShift } = await import('./core.mjs');
  const { VENUES } = await import('./content.mjs');
  const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
  const port = atlas.memoryPort();
  const t = { now: Date.UTC(2026, 10, 19, 1) };
  const coach = atlas.createCoach({ gameId: 'entry-check', mapData, dayOffset: 540, host: { guest: true, port, key: `synk-atlas:entry-check-app-${process.pid}`, now: () => t.now } });
  await coach.ready;
  const calls = [];
  const spy = {};
  for (const name of Object.keys(coach)) {
    const value = coach[name];
    spy[name] = typeof value === 'function' ? (...args) => { const result = value(...args); calls.push({ name, args, result }); return result; } : value;
  }
  const door = createGameDoor({ entry: { gameCoach: async () => spy, retired: () => () => {} }, gameId: 'entry-check', later: (fn) => fn() });
  const page = await boot({ door: door.api, progress: played(3), search: '?qa', still: true });
  assert.equal(page.log.includes('createGame'), false);
  assert.equal(page.$('#reset-learning').hidden, true);
  assert.equal(page.$('#storage-note').hidden, true);
  const lobby = calls.find((call) => call.name === 'recommend');
  assert.deepEqual(lobby.args[1], {}, '입구는 판을 열지 않고 추천 근무지만 묻는다');
  assert.equal(page.$('#rec-reason').textContent, lobby.result.why.line, '이유는 엔진의 한 줄');
  assert.equal(page.$('#rec-practice').hidden, true, '놓친 단위가 없으면 한 손님 연습을 건네지 않는다');
  // 근무 하나 — 열린 근무지는 수영장뿐이다.
  const before = calls.length;
  page.$('#rec-start').onclick();
  assert.equal(page.$('#brief-reason').hidden, true, '근무 전 안내에 이유를 지어내지 않는다');
  assert.deepEqual(globalThis.__entry.state().queue, composeShift(VENUES[0], {}).map((c) => c.id), '처음 보이는 줄은 게임 순서');
  page.$('#btn-begin').onclick();
  for (let i = 0; i < 6; i += 1) {
    await sleep(5);
    assert.equal(globalThis.__entry.state().index, i);
    t.now += 6000;
    page.$('#btn-pass').onclick({ timeStamp: Number.MAX_SAFE_INTEGER });
    await sleep(5);
    page.$('#btn-next').onclick();
  }
  await sleep(10);
  const state = globalThis.__entry.state();
  assert.equal(state.results.length, 6);
  assert.equal(page.$('#results').hidden, false, '결과 화면');
  const shift = calls.slice(before);
  assert.equal(shift.filter((call) => call.name === 'recommend' && call.args[1].set?.length === 6).length, 6, '손님마다 고른다');
  assert.deepEqual(shift.filter((call) => call.name === 'finishSet').map((call) => call.args[0]), [{ record: false }], '근무 끝에 기록 없이 닫는다');
  assert.equal(shift.filter((call) => call.name === 'live').length, 1, '돋보기 순간 맞춤');
  assert.equal(page.$('#skills-scope').textContent, '이번 근무의');
  await sleep(30);
  const events = (await port.read()).map((row) => row.value).filter((value) => value?.kind === 'event').map((value) => value.event);
  const presented = events.filter((event) => event.type === 'practice.presented');
  assert.deepEqual(presented.map((event) => event.itemKey), state.queue.map((id) => caseMetadata(VENUES[0].cases.find((c) => c.id === id)).itemKey));
  assert.deepEqual(state.results.map((r) => r.caseId), state.queue);
  const attempts = events.filter((event) => event.type === 'practice.attempted');
  assert.deepEqual(attempts.map((event) => event.verdict), state.results.map((r) => (r.correct ? 'correct' : 'incorrect')), '통과 도장 — 통과 손님만 맞음');
  assert.ok(presented.every((event) => attempts.some((a) => a.presentationId === event.id)));
  door.dispose();
  coach.dispose();
});

test('연수 — 단추로 연 연수는 첫 손님의 제시 전에 코치 startSet({ length: 6 })을 부르고, 그만둔 뒤 다시 연 연수도 앞 판을 닫은 뒤 다시 부른다', async () => {
  const atlas = await import('../../packages/atlas/src/index.mjs');
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const mapData = { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') };
  const coach = atlas.createCoach({ gameId: 'entry-check', mapData, dayOffset: 540, host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:entry-check-tutorial-${process.pid}`, now: () => Date.UTC(2026, 10, 19, 1) } });
  await coach.ready;
  const calls = [];
  const spy = {};
  for (const name of Object.keys(coach)) {
    const value = coach[name];
    spy[name] = typeof value === 'function' ? (...args) => { const result = value(...args); calls.push({ name, args, result }); return result; } : value;
  }
  // 코치 startSet 첩자(지금 엔진에는 없다 — 설계 주인 11-19 밤에 승인한 꼴).
  spy.startSet = (options) => { calls.push({ name: 'startSet', args: [options] }); return { opened: true, setId: `set-${calls.length}` }; };
  const door = createGameDoor({ entry: { gameCoach: async () => spy, retired: () => () => {} }, gameId: 'entry-check', later: (fn) => fn() });
  const page = await boot({ door: door.api, progress: played(3), search: '?qa', still: true });
  // 판에 닿는 부름 — 입구로 돌아가 추천 근무지를 묻는 recommend(판 옵션 없음)는 판을 열지 않으니 뺀다.
  const order = (from) => calls.slice(from).filter((call) => ['startSet', 'present', 'finishSet'].includes(call.name) || (call.name === 'recommend' && call.args[1]?.set)).map((call) => call.name);
  const from = calls.length;
  page.$('#how-tutorial').onclick();
  assert.equal(globalThis.__entry.tutorial().on, true);
  assert.deepEqual(order(from), [], '근무 전 안내에서는 판을 열지 않는다');
  page.$('#btn-begin').onclick();
  await sleep(5);
  assert.deepEqual(order(from), ['startSet', 'present'], '첫 손님의 제시 전에 한 번');
  assert.deepEqual(calls.slice(from).find((call) => call.name === 'startSet').args[0], { length: 6 }, 'n = 연수 손님 수');
  page.$('#quit').onclick();
  page.$('#how-tutorial').onclick();
  page.$('#btn-begin').onclick();
  await sleep(5);
  assert.deepEqual(order(from), ['startSet', 'present', 'finishSet', 'startSet', 'present'], '그만두면 판을 닫고, 다음 연수는 첫 손님 전에 다시 연다');
  assert.ok(calls.slice(from).filter((call) => call.name === 'startSet').every((call) => call.args[0].length === 6));
  page.$('#quit').onclick();
  assert.equal(order(from).at(-1), 'finishSet');
  door.dispose();
  coach.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않는다', async () => {
  const page = await quietError(() => boot({ host: 'localhost', search: '?atlas=next' }));
  assert.equal(page.log.includes('createGame'), false);
  assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
});

test('원문 — 꺼진 판은 새 길 모듈을 싣지 않고 옛 코치를 지금 자리에서 같은 인수로 만들며, learning.mjs가 내보내는 이름은 그대로다', async () => {
  const source = readFileSync(new URL('./app.mjs', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  assert.ok(imports.includes('./kit/atlas-next.mjs'), '키트는 정의뿐이라 정적으로 싣는다');
  assert.ok(!imports.some((path) => path.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  assert.equal([...source.matchAll(/import\('\.\/atlas-next-play\.mjs'\)/g)].length, 1, '새 길 모듈을 부르는 곳은 하나');
  assert.ok(source.includes("  try { coach = window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }) || null; } catch { coach = null; }"), '옛 코치는 지금과 같은 인수');
  assert.match(source, /const atlasNext = !!\(nextDoor\(window\) \|\| devFlag\(window\)\);\r?\nconst nextOpening = atlasNext \? openNextPath\(\) : null;/, '문 · 개발 깃발이 있을 때만 새 길을 연다');
  assert.match(source, /if \(nextOpening\) takeNext\(await nextOpening\); else openOldCoach\(\);/, '문이 없으면 이 자리에서 동기로 옛 코치');
  assert.equal(source.includes('/atlas/'), false, '게임이 입구를 직접 부르지 않는다');
  for (const name of readdirSync(new URL('.', import.meta.url))) {
    if (!/\.(m?js)$/.test(name) || name === 'atlas-next-play.mjs' || name.endsWith('.test.mjs')) continue;
    const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+'\.\/atlas-next-play\.mjs'/.test(text), name);
  }
  // 새 길 모듈은 옛 길의 것(return-practice · 옛 요약 · events · 즉시 확인 · 짝 맞추기 · 기록 지우기 · syncPort)을 쓰지 않는다.
  const next = readFileSync(new URL('./atlas-next-play.mjs', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['returnPractice', 'missedPractice', 'soloGuestPlan', 'shiftPlan', 'skillReport', 'rankCases', 'recommendVenue', 'immediateCheck', 'followUpResult', 'events(', 'syncPort', 'reset(', 'recheck']) assert.equal(next.includes(word), false, word);
  // 드라마 「오늘」(today/gather.mjs)이 learning.mjs를 부른다 — 내보내는 이름을 지우거나 바꾸지 않는다.
  const learning = await import('./learning.mjs');
  assert.deepEqual(Object.keys(learning).sort(), ['FLOW_ENTRY', 'FLOW_WORDS', 'FORMAT', 'GAME_ID', 'ITEM_VERSION', 'LANGUAGE_DIFFICULTY', 'MAGNIFIER_AFTER', 'RETURN_PATTERNS', 'RULE_GRAMMAR', 'answerPayload', 'assignmentCases', 'assignmentVenues', 'caseCandidates', 'caseMetadata', 'entryTargetLabel', 'magnifierAfter', 'missedPractice', 'opensTutorial', 'rankCases', 'recommendVenue', 'shiftPlan', 'skillReport', 'soloGuestPlan']);
});
