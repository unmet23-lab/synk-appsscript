// 찰칵 낱말 진입(Atlas 재설계 4-6d — 단계4_계획 §23-6 「열기」 · §23-10). 진짜 app.mjs를 노드에서 띄워(DOM은 받아 주는 겉) 한 판을 돈다.
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 같은 차례(모듈 첫 실행)에 불리고, 새 길 모듈 · /atlas/ · IndexedDB ·
//            fetch를 건드리지 않는다. 옛 코치에 닿는 차례는 4-6d 앞의 app.mjs로 잰 값이다(짓는 때 원래 파일과 이 파일을 같은 겉에서 돌려
//            메서드 · 인수까지 같음을 봤다).
//   문이 있고 open이 null이면 옛 길로 정상 시작(같은 차례), RUN_ENDED면 옛 길(createGame)을 열지 않고 기록 없이 놀기만 한다.
//   문이 겉을 주면(진짜 엔진 코치) 그 겉으로 한 판 — 판 끝(앨범 한 면)에 finishSet, 입구로 나가면 다음 차례 번호로 답하고 판을 닫는다.
//   판마다 첫 부탁 전에 판 길이(부탁 수 + 인화 상한)를 startSet으로 넘긴다 — 지금 엔진에는 startSet이 없어 첩자로 본다.
// 이 파일은 맨 위에서 새 길 모듈을 부르지 않는다 — 꺼진 판 시험이 그 모듈의 적재를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

const resolved = [];
registerHooks({
  resolve(specifier, context, next) {
    resolved.push(specifier);
    return next(specifier, context);
  },
});
const APP = fs.readFileSync(new URL('./app.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// ── DOM 겉: 만든 노드의 자식 · 듣는 함수를 들고, 고르개는 같은 노드를 돌려준다([data-screen=…]은 자식에서 찾는다) ──
class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.dataset = {}; this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.children = []; this.listeners = []; this.found = new Map();
    this.hidden = false; this.textContent = ''; this.innerHTML = ''; this.className = ''; this.disabled = false;
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  remove() {}
  replaceWith() {}
  focus() {}
  setAttribute() {}
  removeAttribute() {}
  setPointerCapture() {}
  addEventListener(type, fn) { this.listeners.push([type, fn]); }
  removeEventListener() {}
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844, x: 0, y: 0 }; }
  animate() { return { finished: Promise.resolve(), cancel() {}, effect: { getTiming: () => ({ fill: 'backwards' }) } }; }
  getAnimations() { return []; }
  decode() { return Promise.resolve(); }
  getContext() { return { font: '', measureText: () => ({ width: 100 }) }; }
  querySelector(sel) {
    const screen = /^\[data-screen=([\w-]+)\]$/.exec(sel);
    if (screen) { const hit = this.find((n) => n.dataset.screen === screen[1]); if (hit) return hit; }
    if (!this.found.has(sel)) this.found.set(sel, new FakeNode());
    return this.found.get(sel);
  }
  querySelectorAll() { return new Proxy([], { get: (t, p) => (typeof p === 'string' && /^\d+$/.test(p) ? new FakeNode() : t[p]) }); }
  find(test) {
    for (const c of this.children) {
      if (!(c instanceof FakeNode)) continue;
      if (test(c)) return c;
      const d = c.find(test);
      if (d) return d;
    }
    return null;
  }
}
const fakeStorage = () => { const map = new Map(); return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) }; };
// 옛 코치 흉내 — 부른 메서드를 차례대로 적는다.
function loggingCoach(log) {
  let n = 0;
  return new Proxy({}, {
    get(_t, name) {
      if (name === 'then' || typeof name === 'symbol') return undefined;
      return () => { log.push(name); if (name === 'present') return `p${(n += 1)}`; if (name === 'recommend') return { status: 'none' }; return null; };
    },
  });
}

let boots = 0;
// 앱의 기다림(움직임 줄이기 판에서도 부탁 사이 0.2 ~ 1.5초)을 몇 ms로 줄인다 — 차례는 그대로이고 시험만 빨라진다.
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms = 0, ...args) => realTimeout(fn, Math.min(Number(ms) || 0, 5), ...args);
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame(없으면 꺼진 판). 움직임 줄이기(matchMedia)로 움직임 기다림을 없앤다.
async function boot({ door = null, search = '?seed=7', host = 'synk.im' } = {}) {
  const log = [], created = [], requests = [];
  const local = fakeStorage();
  const root = new FakeNode('main');
  const found = new Map([['#app', root]]);
  const doc = {
    documentElement: { dataset: {}, lang: '' }, fonts: { load: () => Promise.resolve() }, visibilityState: 'visible',
    createElement: (tag) => new FakeNode(tag),
    querySelector: (sel) => { if (!found.has(sel)) found.set(sel, new FakeNode()); return found.get(sel); },
    querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
  };
  const coach = loggingCoach(log);
  const up = door ? { SYNKAtlasGame: door } : null;
  const from = resolved.length;
  Object.assign(globalThis, {
    window: globalThis, document: doc, location: { hostname: host, search, pathname: '/snap-words/', origin: `https://${host}` },
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { createGame: (options) => { log.push('createGame'); created.push(options); return coach; } },
    matchMedia: () => ({ matches: true, addEventListener() {} }), innerWidth: 390, innerHeight: 844,
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {},
    indexedDB: { open: () => { requests.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async (url) => { requests.push(`fetch ${url}`); throw new Error('닫힘'); },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  await import(`./app.mjs?boot=${(boots += 1)}`);
  return { log, created, requests, local, root, snap: globalThis.__snap, specifiers: () => resolved.slice(from) };
}
const until = async (test, ms = 15000) => { const end = Date.now() + ms; while (!test()) { if (Date.now() > end) throw new Error('기다림이 넘쳤다'); await new Promise((r) => setTimeout(r, 15)); } };
const target = (S, m, right) => S.items.find((i) => (m.kind === 'word' ? i.kind === 'thing' : i.kind === 'plate') && (i.word === m.word) === right);
// 입구 → 둘러보기 → 부탁 시작.
async function begin(page, place = 'gate') {
  await page.snap.startPlace(place);
  clearTimeout(page.snap.S.hintTimer);
  page.snap.beginMissions();
}
// 부탁 i를 wrongs번 다르게 찍은 뒤 맞힌다.
async function shoot(page, wrongs = 0) {
  const { snap } = page, m = snap.S.missions[snap.S.mi];
  for (let w = 0; w < wrongs; w += 1) { snap.focusOn(target(snap.S, m, false)); await snap.snap(); }
  snap.focusOn(target(snap.S, m, true)); await snap.snap();
}
// 한 판: 부탁(wrongs[i]번 다르게 찍은 뒤 맞힘) → 인화(recallWrong 번째만 틀림) → 앨범 한 면.
async function playRound(page, { wrongs = [2, 1], recallWrong = 1 } = {}) {
  const { snap, root } = page;
  await begin(page);
  for (let i = 0; i < snap.S.missions.length; i += 1) await shoot(page, wrongs[i] ?? 0);
  await until(() => snap.S.screen === 'develop' || snap.S.screen === 'result');
  const options = () => root.find((n) => n.dataset.screen === 'develop').children[3];
  for (let i = 0; snap.S.screen === 'develop'; i += 1) {
    await until(() => snap.S.recallNow && options()?.children.length);
    const q = snap.S.recallNow, buttons = options().children;
    const right = snap.answerNow(), pick = i === recallWrong ? (right + 1) % buttons.length : right;
    buttons[pick].listeners.find(([type]) => type === 'click')[1]({ stopPropagation() {}, target: buttons[pick] });
    await until(() => snap.S.recallNow !== q || snap.S.screen === 'result');
  }
  await until(() => snap.S.screen === 'result');
}
// 단추 하나(입구로 · 다시 등) — app.mjs의 클릭 위임.
function press(page, go) {
  const [, handler] = page.root.listeners.find(([type]) => type === 'click');
  handler({ target: { closest: (sel) => (sel === '[data-go]' ? { dataset: { go } } : null) } });
}

// 4-6d 앞의 app.mjs가 씨앗 7 · 판 playRound()에서 옛 코치에 닿는 차례(같은 겉에서 잰 값 — 약한 낱말 · 부탁 넷(다르게 둘 · 하나) · 인화 셋).
const OLD_ROUND = ['recommend', 'present', 'answer', 'answer', 'help', 'answer', 'present', 'answer', 'answer', 'present', 'answer', 'present', 'answer',
  'present', 'answer', 'present', 'answer', 'present', 'answer'];
// 나가기: 부탁 하나를 다르게 찍고 입구로 — 답하지 않은 부탁을 unanswered로 닫는다.
const OLD_LEAVE = ['recommend', 'present', 'answer', 'answer'];

test('꺼진 판 — 문이 없으면 옛 코치를 지금과 같은 인수 · 차례로 만들고, 새 길 모듈 · /atlas/ · IndexedDB · fetch를 건드리지 않는다', async () => {
  const page = await boot();
  assert.deepEqual(page.log, ['createGame'], '모듈 첫 실행에서 옛 코치를 만든다');
  assert.equal(page.created.length, 1);
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].gameId, 'snap-words');
  assert.equal(page.created[0].storage, page.local, '이 창의 localStorage');
  await playRound(page);
  assert.deepEqual(page.log, ['createGame', ...OLD_ROUND]);
  press(page, 'back');
  assert.equal(page.log.length, 1 + OLD_ROUND.length, '판을 마친 뒤 입구로 — 닫을 부탁이 없다');
  await begin(page);
  page.snap.focusOn(target(page.snap.S, page.snap.S.missions[0], false)); await page.snap.snap();
  press(page, 'back');
  assert.deepEqual(page.log.slice(1 + OLD_ROUND.length), OLD_LEAVE, '나가기도 지금과 같은 차례');
  const touched = page.specifiers();
  assert.equal(touched.some((specifier) => specifier.includes('atlas-next-play')), false, '새 길 모듈을 싣지 않는다');
  assert.equal(touched.some((specifier) => specifier.includes('/atlas/')), false, '입구를 싣지 않는다');
  assert.deepEqual(page.requests, [], 'IndexedDB · fetch를 건드리지 않는다');
});

test('app.mjs 원문 — 새 길 모듈은 정적 import에 없고 문 · 개발 깃발이 있을 때만 동적으로 싣는다, 옛 코치는 지금 자리 · 인수 그대로', () => {
  const statics = [...APP.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(statics.includes('./kit/atlas-next.mjs'), '키트는 정적으로(맨 위는 정의뿐)');
  assert.ok(!statics.some((s) => s.includes('atlas-next-play')), '새 길 모듈은 정적 import에 없다');
  const code = APP.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
  assert.equal(code.match(/atlas-next-play/g).length, 1, '새 길 모듈을 부르는 자리는 하나');
  assert.equal(code.match(/import\('\.\/atlas-next-play\.mjs'\)/g).length, 1, '그 자리는 동적 import');
  assert.ok(!APP.includes("'/atlas/"), '게임은 입구를 스스로 부르지 않는다(개발 깃발 길은 키트가)');
  assert.equal(APP.match(/createGame\(/g).length, 1);
  assert.ok(APP.includes('const oldLearning = () => createLearning(() => window.SynkLearning?.createGame({ gameId: GAME_ID, storage: window.localStorage }));'), '옛 코치는 지금 인수 그대로');
  assert.ok(APP.includes("let learn = atlasNext ? createLearning(() => null) : oldLearning();"), '꺼진 판은 그 자리에서 동기로');
  const album = APP.indexOf('const albumStore = await openAlbumStore('), open = APP.indexOf('let learn = '), prefs = APP.indexOf('const prefs = ');
  assert.ok(album >= 0 && album < open && open < prefs, '옛 코치를 만드는 자리는 지금과 같다(앨범을 연 뒤, 소리 설정 앞)');
  assert.ok(APP.includes('learn.end?.();'), '판 끝 — 새 길만 판을 닫는다');
  assert.ok(APP.includes('learn.begin?.(S.missions);'), '첫 부탁 전 판 길이 — 새 길만 넘긴다');
});

test('문이 있고 셸이 지금 판이라고 하면(null) 기다린 뒤 옛 길로 정상 시작한다 — 옛 코치에 닿는 차례가 같다', async () => {
  const asked = [];
  const door = { open: async (request) => { asked.push(request); return null; } };
  const page = await boot({ door });
  assert.ok(page.specifiers().some((specifier) => specifier.includes('atlas-next-play')), '문이 있을 때만 새 길 모듈을 부른다');
  await playRound(page);
  assert.deepEqual(asked, [{ gameId: 'snap-words', banks: ['snap-words'] }]);
  assert.deepEqual(page.log, ['createGame', ...OLD_ROUND], '옛 길은 지금과 같은 차례');
  assert.equal(page.created[0].storage, page.local);
});

test('문이 닫히는 중이면(RUN_ENDED) 옛 길을 열지 않고 기록 없이 놀기만 한다 — 그 밖의 거절도 옛 길을 열지 않는다', async () => {
  // 셸 창에서 던진 오류는 틀에서 instanceof Error가 거짓이다 — 코드만 있는 객체.
  const page = await boot({ door: { open: async () => { throw { code: 'RUN_ENDED' }; } } });
  await begin(page);
  assert.equal(page.snap.S.missions.length, 4, '부탁은 게임이 그대로 짠다');
  await shoot(page, 1);
  await shoot(page, 0);
  assert.equal(page.snap.S.mi, 2, '놀이는 이어 간다');
  assert.deepEqual(page.log, [], '위 창의 옛 학습 호스트를 부르지 않는다');
  const errors = [];
  const error = console.error;
  console.error = (e) => errors.push(e);
  try {
    const broken = await boot({ door: { open: async () => { throw { code: 'MAP_FAILED' }; } } });
    await begin(broken);
    assert.deepEqual(broken.log, []);
  } finally {
    console.error = error;
  }
  assert.equal(errors.length, 1);
});

test('문이 겉을 주면(진짜 엔진 코치) 그 겉으로 한 판 — 옛 코치 없음, 판 끝에 finishSet, 입구로 나가면 다음 차례 번호로 답하고 판을 닫는다', async () => {
  const atlas = await import('../../packages/atlas/src/index.mjs');
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
  let t = Date.UTC(2026, 10, 19, 1, 0, 0);
  const port = atlas.memoryPort();
  const coach = atlas.createCoach({
    gameId: 'snap-words',
    mapData: { index: readJson('../../packages/atlas/map/index.json'), units: readJson('../../packages/atlas/map/units.json') },
    dayOffset: 540,
    host: { guest: true, port, key: `synk-atlas:snap-words-entry-${process.pid}`, now: () => (t += 1000) },
    scope: {}, // 틀 흉내의 위 창(globalThis.parent)에 호스트 등록부를 두지 않게
  });
  await coach.ready;
  const calls = [];
  const spy = {};
  for (const name of ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live'])
    spy[name] = (...args) => { calls.push([name, args]); return coach[name](...args); };
  const asked = [];
  let retire = null;
  const entry = { gameCoach: async (...args) => { asked.push(args); return spy; }, retired: (_made, fn) => { retire = fn; return () => {}; } };
  const door = createGameDoor({ entry, gameId: 'snap-words', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  await playRound(page);
  assert.deepEqual(page.log, [], '옛 코치를 만들지 않는다');
  assert.deepEqual(asked, [['snap-words', ['snap-words']]]);
  const named = () => calls.map(([name]) => name).filter((name) => name !== 'itemUnits');
  assert.deepEqual(named(), ['due', 'summary', 'present', 'answer', 'answer', 'help', 'answer', 'present', 'answer', 'answer', 'present', 'answer', 'present', 'answer',
    'present', 'answer', 'present', 'answer', 'present', 'answer', 'finishSet'], '옛 길과 같은 차례 — 약한 낱말만 due · summary로, 판 끝에 판을 닫는다');
  assert.deepEqual(calls.at(-1)[1], [{ record: false }]);
  await coach.finishSet({ record: false }).folded;
  const rows = (await port.read()).filter((row) => row.value?.kind === 'event').map((row) => row.value.event).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const shown = rows.filter((e) => e.type === 'practice.presented');
  const missions = page.snap.S.missions.map((m) => `snap-words.${m.kind}.${m.word}.v1`);
  assert.deepEqual(shown.slice(0, 4).map((e) => e.itemKey), missions, '부탁은 게임 차례대로');
  assert.ok(shown.slice(4).every((e) => /^snap-words\.recall-(word|meaning)\./.test(e.itemKey)) && shown.length === 7);
  assert.equal(new Set(shown.map((e) => e.setId)).size, 1, '장소 한 판이 판 하나');
  assert.ok(shown.every((e) => e.arm === 'host'));
  const tries = rows.filter((e) => e.type === 'practice.attempted' && e.presentationId === shown[0].id);
  assert.deepEqual(tries.map((e) => [e.attemptNo, e.verdict]), [[1, 'incorrect'], [2, 'incorrect'], [3, 'correct']], '맞힐 때까지 같은 제시');

  // 입구로 나가기 — 다르게 찍은 부탁이 열린 채면 다음 차례 번호로 unanswered.
  press(page, 'back');
  const count = calls.length;
  await begin(page);
  page.snap.focusOn(target(page.snap.S, page.snap.S.missions[0], false)); await page.snap.snap();
  press(page, 'back');
  const after = calls.slice(count).filter(([name]) => name !== 'itemUnits');
  assert.deepEqual(after.map(([name]) => name), ['due', 'summary', 'present', 'answer', 'answer', 'finishSet']);
  assert.deepEqual(after[4][1][1], { correct: null, assessable: false, reason: 'unanswered', attemptNo: 2 });
  assert.deepEqual(after[5][1], [{ record: false }]);

  // 판을 다시 정하면(입구의 retire) 그 겉은 닫히고, 다음 판을 열 때 문을 다시 연다 — 새 겉으로 다시 기록한다.
  retire({ reason: 'account' });
  const held = calls.length;
  await begin(page);
  assert.equal(asked.length, 2, '다음 판에서 문을 다시 연다');
  assert.deepEqual(calls.slice(held).map(([name]) => name).filter((name) => name !== 'itemUnits'), ['due', 'summary', 'present']);
  assert.deepEqual(page.log, [], '옛 코치는 여전히 없다');
  door.dispose();
});

test('정해진 차례 판 — app.mjs가 판마다 첫 부탁의 제시 전에 판 길이(부탁 수 + 인화 상한)를 startSet으로 한 번 넘긴다(판 끝 · 나가기 뒤 다음 판에 다시)', async () => {
  const atlas = await import('../../packages/atlas/src/index.mjs');
  const { createGameDoor } = await import('../synk-world-app/world-atlas-game.mjs');
  const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
  let t = Date.UTC(2026, 10, 19, 1, 0, 0);
  const coach = atlas.createCoach({
    gameId: 'snap-words',
    mapData: { index: readJson('../../packages/atlas/map/index.json'), units: readJson('../../packages/atlas/map/units.json') },
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:snap-words-entry-set-${process.pid}`, now: () => (t += 1000) },
    scope: {},
  });
  await coach.ready;
  const calls = [];
  const spy = {};
  for (const name of ['recommend', 'present', 'help', 'delivery', 'answer', 'exposure', 'exposures', 'summary', 'due', 'itemUnits', 'finishSet', 'today', 'presentation', 'live'])
    spy[name] = (...args) => { calls.push([name, args]); return coach[name](...args); };
  // 지금 엔진에는 startSet이 없다 — 적기만 하고 연 판을 지어 돌려준다(엔진에 있으면 그것을 부른다).
  spy.startSet = (...args) => { calls.push(['startSet', args]); return typeof coach.startSet === 'function' ? coach.startSet(...args) : { opened: true, setId: `fake-set-${calls.length}` }; };
  const door = createGameDoor({ entry: { gameCoach: async () => spy, retired: () => () => {} }, gameId: 'snap-words', later: (fn) => fn() });
  const page = await boot({ door: door.api });
  await playRound(page);
  press(page, 'back');
  await begin(page);
  page.snap.focusOn(target(page.snap.S, page.snap.S.missions[0], false)); await page.snap.snap();
  press(page, 'back');
  assert.deepEqual(page.log, [], '옛 코치를 만들지 않는다');
  const flow = calls.filter(([name]) => ['startSet', 'present', 'finishSet'].includes(name)).map(([name, args]) => (name === 'present' ? name : [name, ...args]));
  assert.deepEqual(flow, [
    ['startSet', { length: 4 + 3 }], ...Array(4 + 3).fill('present'), ['finishSet', { record: false }],
    ['startSet', { length: 4 + 3 }], 'present', ['finishSet', { record: false }],
  ], '판마다 startSet 한 번 — 그 판의 첫 제시보다 먼저, 앞 판을 닫은 뒤');
  door.dispose();
});

test('로컬 개발 깃발(?atlas=next)은 문이 없어도 새 길로 간다 — 옛 코치를 만들지 않고 입구를 키트가 싣는다', async () => {
  const errors = [];
  const error = console.error;
  console.error = (e) => errors.push(e);
  try {
    const page = await boot({ host: 'localhost', search: '?atlas=next&seed=7' });
    await begin(page);
    assert.deepEqual(page.log, []);
    assert.ok(page.specifiers().includes('/atlas/loader.js'), '혼자 뜨는 길은 입구를 싣는다');
  } finally {
    console.error = error;
  }
  assert.equal(errors.length, 1, '노드에는 입구가 없다 — 기록 없이 논다');
});
