// 한글 만나기 진입(Atlas 재설계 4-7 — 단계4_계획 §26-3 · §26-8). 진짜 app.mjs를 노드에서 띄워(DOM은 받아 주는 겉) 한 회차를 돈다.
//   꺼진 판: 문이 없으면 SynkLearning.createGame이 지금과 같은 인수로 모듈 첫 실행에 불리고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않는다.
//            회차는 core.mjs planSession 그대로이고 놓친 글자의 다시 내기도 지금 판 그대로다.
//   문이 있고 open이 null이면 옛 길로 정상 시작, RUN_ENDED면 옛 길(createGame)을 열지 않고 기록 없이 논다.
//   문이 겉을 주면(진짜 엔진 코치) 그 겉으로 한 회차 — 판 열기 · 제시 · 전달 · 답 · 판 닫기. 그만두기와 다시 열기.
// 이 파일은 맨 위에서 새 길 모듈을 부르지 않는다 — 꺼진 판 시험이 그 모듈의 적재를 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';

const resolved = [];
registerHooks({ resolve(specifier, context, next) { resolved.push(specifier); return next(specifier, context); } });
// 짓는 때 원래 파일과 견주려고 앱 파일을 바꿔 부를 수 있다(원래 app.mjs를 이 폴더에 다른 이름으로 두고 가리킨다).
const APP = process.env.SYNK_HANGUL_APP || './app.mjs';
const LAYER = JSON.parse(fs.readFileSync(new URL('../../strata/hangul.json', import.meta.url), 'utf8'));
const DEMOS = ['listen_pick', 'see_pick', 'build', 'match', 'pair', 'teach', 'build_final'];

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase(); this.dataset = {}; this.children = []; this.listeners = []; this.attributes = {};
    this.style = { setProperty() {} }; this.className = ''; this.textContent = ''; this.hidden = false; this.disabled = false; this.isConnected = true; this.scrollTop = 0;
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'disabled') this.disabled = true; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, fn) { this.listeners.push([type, fn]); }
  removeEventListener() {}
  querySelector() { return new FakeNode(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
  getContext() { return new Proxy({}, { get: () => () => {}, set: () => true }); }
  scrollIntoView() {}
  focus() {}
  click() { for (const [type, fn] of this.listeners) if (type === 'click') fn({ preventDefault() {} }); }
  all(cls, out = []) {
    for (const child of this.children.flat()) if (child instanceof FakeNode) { if (child.className.split(' ').includes(cls)) out.push(child); child.all(cls, out); }
    return out;
  }
}
const fakeStorage = seed => { const map = new Map(Object.entries(seed)); return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; };
// 옛 코치 — 부른 메서드와 인수를 차례대로 적는다.
function oldCoach(log) {
  let n = 0;
  return Object.fromEntries(['present', 'delivery', 'help', 'answer', 'flush'].map(name => [name, (...args) => { log.push([name, ...args]); return name === 'present' ? `p${(n += 1)}` : null; }]));
}
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms = 0, ...args) => realTimeout(fn, Math.min(Number(ms) || 0, 3), ...args);
const sleep = ms => new Promise(resolve => realTimeout(resolve, ms));
const until = async (check, what, ms = 8000) => { const end = Date.now() + ms; while (!check()) { if (Date.now() > end) throw new Error(`기다림 넘침: ${what}`); await sleep(5); } };

let boots = 0;
// 앱 모듈의 첫 실행이 끝나기를 기다린다 — 끝나지 않으면(기다림이 풀리지 않는 갈림) 시험이 멈추지 않고 실패한다.
// 기한 타이머는 끝나면 치운다 — 남으면 시험 프로세스가 그만큼 늦게 끝난다(검수 -b GA3).
const loaded = page => {
  let timer;
  const late = new Promise((_, reject) => { timer = realTimeout(() => reject(new Error('앱의 첫 실행이 끝나지 않았다')), 15_000); });
  return Promise.race([page.loading, late]).finally(() => clearTimeout(timer));
};
const KEY = 'synk.hangul-stage.v1';
const progressOf = async (met = []) => {
  const core = await import('./core.mjs');
  const p = core.meet(core.emptyProgress(), met, new Date(Date.now() - 5 * 86400000).toISOString());
  return { ...p, demoSeen: DEMOS, recent: met.length ? Array.from({ length: 20 }, (_, i) => ({ ok: i < 10 })) : [] };
};
// 한 페이지를 띄운다. door: 위 창의 window.SYNKAtlasGame. host: 위 창의 SYNKPlayHost(계정).
async function boot({ door = null, calls = null, met = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n'], host = null } = {}) {
  const log = [], created = [], requests = [], pagehide = [], order = [];
  const local = fakeStorage({ [KEY]: JSON.stringify(await progressOf(met)) });
  const read = local.getItem;
  local.getItem = key => { if (key === KEY) order.push('read'); return read(key); };
  const nodes = new Map();
  const byId = id => { if (!nodes.has(id)) nodes.set(id, new FakeNode()); return nodes.get(id); };
  const up = door || host ? { SYNKAtlasGame: door ?? undefined, SYNKPlayHost: host ?? undefined, location: { origin: 'https://synk.im' }, document: { getElementById: () => null } } : null;
  if (up) { up.parent = up; up.top = up; }
  const from = resolved.length;
  const voice = { lang: 'ko-KR', localService: true, default: true };
  Object.assign(globalThis, {
    window: globalThis, frameElement: null, name: '', devicePixelRatio: 1,
    document: { documentElement: new FakeNode('html'), getElementById: byId, createElement: tag => new FakeNode(tag), querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, fonts: { ready: Promise.resolve() } },
    location: { hostname: 'synk.im', origin: 'https://synk.im', pathname: '/world/hangul-stage/', search: '?qa=inspect' },
    parent: up ?? globalThis, top: up ?? globalThis,
    SynkLearning: { layer: LAYER, createGame: options => { created.push(options); order.push('createGame'); log.push(['createGame', options.gameId]); return oldCoach(log); } },
    matchMedia: () => ({ matches: true }), scrollTo() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    addEventListener: (type, fn) => { if (type === 'pagehide') pagehide.push(fn); }, removeEventListener() {},
    ResizeObserver: class { observe() {} disconnect() {} },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    // __failSpeak: 다음 소리 N개를 실패시킨다. __failFor(글): 참이면 그 소리를 실패시킨다. __spoken: 끝난 소리 수. __speakMs: 소리 하나의 길이(기본 1ms).
    // __said: 낸 소리의 글(차례대로).
    speechSynthesis: { getVoices: () => [voice], addEventListener() {}, speak: u => (globalThis.__said ??= []).push(u.text) && realTimeout(() => {
      let fail = false;
      if (globalThis.__failSpeak > 0) { globalThis.__failSpeak -= 1; fail = true; } else if (globalThis.__failFor?.(u.text)) fail = true;
      globalThis.__spoken = (globalThis.__spoken ?? 0) + 1;
      if (fail) u.onerror?.(); else u.onend?.();
    }, globalThis.__speakMs ?? 1), cancel() {}, pause() {}, resume() {} },
    Audio: class { constructor() { this.paused = true; this.currentTime = 0; } addEventListener() {} removeAttribute() {} load() {} play() { return Promise.resolve(); } pause() {} },
    indexedDB: { open: () => { requests.push('indexedDB.open'); throw new Error('닫힘'); } },
    fetch: async url => { requests.push(`fetch ${url}`); throw new Error('닫힘'); },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  const loading = import(`${APP}?boot=${(boots += 1)}`);
  return { loading, log, calls: calls ?? log, order, created, requests, local, byId, pagehide, qa: () => globalThis.__hangulQA, specifiers: () => resolved.slice(from),
    stage: () => byId('stage'), next: () => { const [button] = byId('dock').all('felt-cta'); if (button) button.click(); } };
}
// 지금 문항의 소리 전달이 적힐 때까지(적을 곳이 없으면 잠깐) 기다린다.
async function heard(page) {
  const last = name => page.calls.findLastIndex(([called]) => called === name);
  if (last('present') < 0) return sleep(80);
  await until(() => last('delivery') > last('present'), '소리 전달');
}
// 지금 걸음 하나를 푼다 — reason · meet는 다음, 문항은 고르고 다음. correct가 거짓이면 다른 것을 고른다.
// replay: 듣는 문항에서 첫 소리가 적힌 뒤 소리 단추로 한 번 더 듣고, 그 소리가 끝나면 고른다.
// failNext: 다음 문항의 첫 소리(그 문항의 글)를 실패시킨다 — 앞 문항의 답 뒤 소리가 늦게 나도 그것을 실패시키지 않는다.
async function solve(page, { correct = true, failFirstCard = false, replay = false, failNext = false } = {}) {
  const step = page.qa().step();
  if (step.kind !== 'item') { page.next(); return step; }
  const { item } = step, stage = page.stage();
  if (item.options) {
    const buttons = stage.all('opt');
    const right = item.options.findIndex(o => o.text === item.target.text);
    const at = correct ? right : (right + 1) % item.options.length;
    if (item.type !== 'see_pick') {
      await heard(page);
      if (replay) { const before = globalThis.__spoken ?? 0; stage.all('speak')[0].click(); await until(() => (globalThis.__spoken ?? 0) > before, '다시 듣기의 소리'); }
      buttons[at].click();
    } else { buttons[at].click(); await sleep(20); page.byId('dock').all('felt-cta')[0].click(); }
  } else if (item.pieces) {
    await heard(page);
    const [cs, vs, fs] = stage.all('piece-row');
    const pick = (row, ids, id) => row.all('piece')[ids.indexOf(id)].click();
    pick(cs, item.pieces.consonants, item.target.consonant);
    const v = correct ? item.target.vowel : item.pieces.vowels.find(id => id !== item.target.vowel);
    pick(vs, item.pieces.vowels, v);
    if (item.pieces.finals) pick(fs, item.pieces.finals, item.target.final);
    page.byId('dock').all('felt-cta')[0].click();
  } else {
    const [sounds, letters] = stage.all('col');
    const card = async (col, list, letter) => { col.all('card')[list.findIndex(c => c.letter === letter)].click(); await sleep(25); };
    const order = item.sounds.map(c => c.letter);
    if (!correct) { await card(sounds, item.sounds, order[0]); await sleep(30); await card(letters, item.cards, order[1]); await sleep(30); }
    for (const letter of order) {
      // 마지막 소리 카드의 첫 소리가 나지 않고, 다시 누르면 난다(뒤 카드의 첫 소리가 실패를 풀어 주지 않는 자리).
      if (failFirstCard && letter === order.at(-1)) { globalThis.__failSpeak = 1; await card(sounds, item.sounds, letter); await sleep(30); }
      await card(sounds, item.sounds, letter); await sleep(60); await card(letters, item.cards, letter); await sleep(30);
    }
  }
  await until(() => page.byId('dock').all('felt-cta').length > 0, `${item.type} 판정`);
  if (failNext) {
    globalThis.__failFor = text => {
      const now = page.qa().step();
      if (now?.kind !== 'item' || now.item === item || text !== now.item.target.text) return false;
      globalThis.__failFor = null;
      return true;
    };
  }
  page.next();
  return step;
}
// 회차 하나를 끝까지 — 걸음 목록을 돌려준다.
async function playSession(page, { wrong = () => false, failFirstCard = false, failAt = -1 } = {}) {
  page.byId('start').click();
  await until(() => page.qa().step(), '회차 시작');
  const steps = [];
  let n = 0;
  while (page.qa().step()) {
    const step = page.qa().step();
    const item = step.kind === 'item';
    await solve(page, { correct: !(item && wrong(step.item, n)), failFirstCard, replay: item && n === failAt, failNext: item && n === failAt - 1 });
    if (step.kind === 'item') n += 1;
    steps.push(step);
    if (steps.length > 60) throw new Error('회차가 끝나지 않는다');
  }
  return steps;
}
const itemsOf = steps => steps.filter(s => s.kind === 'item').map(s => s.item);
// 셸의 문 — 진짜 엔진 코치를 겉으로 준다.
let stores = 0;
async function realDoor() {
  const [{ createGameDoor }, atlas] = [await import('../synk-world-app/world-atlas-game.mjs'), await import('../../packages/atlas/src/index.mjs')];
  const json = rel => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
  const port = atlas.memoryPort();
  const calls = [], coaches = [];
  let retire = null, give = true;
  const entry = {
    async gameCoach() {
      if (!give) return null;
      const coach = atlas.createCoach({ gameId: 'hangul-stage', mapData: { index: json('../../packages/atlas/map/index.json'), units: json('../../packages/atlas/map/units.json') }, dayOffset: 540,
        host: { guest: true, port, key: `synk-atlas:hangul-entry-${process.pid}-${(stores += 1)}` } });
      await coach.ready;
      const spy = {};
      for (const name of ['recommend', 'present', 'help', 'delivery', 'answer', 'summary', 'due', 'itemUnits', 'startSet', 'finishSet']) spy[name] = (...args) => { calls.push([name, ...args]); return coach[name](...args); };
      coaches.push(coach);
      return spy;
    },
    retired: (_made, fn) => { retire = fn; return () => {}; }, ended() {},
  };
  const door = createGameDoor({ entry, gameId: 'hangul-stage', later: fn => realTimeout(fn, 0) });
  const events = async () => { await coaches.at(-1).finishSet({ record: false }).folded; return (await port.read()).filter(row => row.value?.kind === 'event').map(row => row.value.event).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); };
  return { door, calls, events, retire: () => retire({ reason: 'account' }), coaches, old: () => { give = false; } };
}

test('꺼진 판 — 문이 없으면 옛 코치를 모듈 첫 실행에 지금과 같은 인수로 만들고, 새 길 모듈 · /atlas/ · IndexedDB를 건드리지 않으며, 회차는 planSession 그대로다', { timeout: 60_000 }, async () => {
  const page = await boot();
  await loaded(page);
  assert.equal(page.created.length, 1);
  assert.deepEqual(page.order.slice(0, 2), ['createGame', 'read'], '진도를 읽기 전(앱의 첫 동기 실행)에 만든다');
  assert.deepEqual(Object.keys(page.created[0]), ['gameId', 'storage']);
  assert.equal(page.created[0].gameId, 'hangul-stage');
  assert.equal(page.created[0].storage, page.local);
  const { planSession, readProgress } = await import('./core.mjs');
  const { createPack } = await import('./pack.mjs');
  const plan = planSession(readProgress(JSON.parse(page.local.getItem(KEY))), createPack(LAYER), { now: new Date().toISOString(), scope: 'device', sessionNo: 0 });
  const steps = await playSession(page, { wrong: (item, n) => n === 1 });
  const planned = steps.filter(s => s.kind !== 'reason' && !s.item?.again);
  assert.deepEqual(planned, plan.steps, '지금 판의 회차');
  assert.equal(itemsOf(steps).filter(i => i.again).length, 1, '놓친 글자를 회차 안에서 한 번 더(지금 판의 다시 내기)');
  const presents = page.log.filter(([name]) => name === 'present');
  assert.equal(presents.length, itemsOf(steps).reduce((n, i) => n + (i.type === 'match' ? i.cards.length : 1), 0));
  assert.equal(page.log.filter(([name]) => name === 'answer').length, presents.length);
  assert.ok(!page.specifiers().some(name => /atlas-next-play|\/atlas\//.test(name)), '새 길 모듈을 싣지 않는다');
  assert.ok(!page.requests.some(row => /indexedDB|\/atlas\//.test(row)), page.requests.join(' '));
  if (process.env.SYNK_HANGUL_LOG) fs.writeFileSync(process.env.SYNK_HANGUL_LOG, JSON.stringify(page.log, null, 1));
});

test('문이 있고 open이 null이면(지금 판) 옛 코치로 정상 시작한다 — 문은 이 게임의 은행으로 묻는다', { timeout: 60_000 }, async () => {
  const asked = [];
  const page = await boot({ door: { open: async options => { asked.push(options); return null; } } });
  assert.equal(page.created.length, 0, '답을 듣기 전에는 옛 코치를 만들지 않는다');
  await loaded(page);
  assert.deepEqual(asked, [{ gameId: 'hangul-stage', banks: ['hangul-stage'] }]);
  assert.equal(page.created.length, 1);
  const steps = await playSession(page);
  assert.equal(page.log.filter(([name]) => name === 'answer').length, page.log.filter(([name]) => name === 'present').length);
  assert.ok(itemsOf(steps).length >= 10);
});

test('문이 RUN_ENDED로 거절하거나 새 길을 열지 못하면 옛 코치를 만들지 않고 기록 없이 논다 · 다음 회차에 문을 다시 연다', { timeout: 60_000 }, async () => {
  for (const code of ['RUN_ENDED', 'BROKEN']) {
    let asked = 0;
    const error = console.error;
    console.error = () => {};
    try {
      const page = await boot({ door: { open: async () => { asked += 1; throw Object.assign(new Error(code), { code }); } } });
      await loaded(page);
      const steps = await playSession(page);
      assert.ok(itemsOf(steps).length >= 10, '놀이는 된다');
      assert.equal(asked, 2, '시작할 때 문을 다시 연다');
      assert.deepEqual([page.created.length, page.log.length], [0, 0], code);
    } finally { console.error = error; }
  }
});

test('문이 겉을 주면 그 겉으로 한 회차 — 옛 코치를 만들지 않고, 판을 먼저 열고 문항마다 제시 · 전달 · 답, 끝에 기록 없이 닫는다 · 놓친 글자는 제품의 다시 내기가 아니라 엔진이 다시 낸다', { timeout: 60_000 }, async () => {
  const game = await realDoor();
  const page = await boot({ door: game.door.api, calls: game.calls });
  await loaded(page);
  assert.equal(page.created.length, 0);
  const steps = await playSession(page, { wrong: (item, n) => n === 1 });
  const items = itemsOf(steps);
  assert.equal(items.length, 10, '분량만큼');
  assert.ok(!items.some(i => i.again), '제품의 다시 내기는 없다');
  assert.equal(game.calls.find(([name]) => ['startSet', 'present'].includes(name))[0], 'startSet');
  assert.deepEqual(game.calls.at(-1), ['finishSet', { record: false }]);
  const list = await game.events();
  const shown = list.filter(e => e.type === 'practice.presented');
  assert.equal(shown.length, items.reduce((n, i) => n + (i.type === 'match' ? i.cards.length : 1), 0));
  assert.equal(new Set(shown.map(e => e.setId)).size, 1);
  for (const e of shown) {
    const kids = list.filter(x => x.presentationId === e.id);
    assert.equal(kids.filter(x => x.type === 'practice.attempted').length, 1, e.itemKey);
    if (e.audioRequired) assert.ok(kids.some(x => x.type === 'practice.delivery' && x.audio === 'completed'), e.itemKey);
  }
  assert.equal(list.filter(e => e.type === 'practice.attempted' && e.verdict === 'incorrect').length >= 1, true);
  assert.equal(page.log.length, 0);
  const saved = JSON.parse(page.local.getItem(KEY));
  assert.equal(saved.sessions.length, 1, '한글 진도는 지금 자리에 그대로 적힌다');
  assert.ok(page.byId('finish').hidden === false);
  game.door.dispose();
});

test('그만두기 — 답하지 않은 문항을 unanswered로 닫고 판을 닫는다 · 다시 시작하면 새 판이다 · 판을 다시 정하면(retired) 다음 회차에서 문을 다시 열고, 그때 지금 판이면 옛 길로 간다', { timeout: 60_000 }, async () => {
  const game = await realDoor();
  const page = await boot({ door: game.door.api, calls: game.calls });
  await loaded(page);
  page.byId('start').click();
  await until(() => page.qa().step(), '회차 시작');
  page.next();
  while (page.qa().step().kind !== 'item') page.next();
  await sleep(30);
  page.byId('quit').click();
  assert.equal(page.qa().step(), null);
  assert.deepEqual(game.calls.slice(-2).map(([name]) => name), ['answer', 'finishSet']);
  const list = await game.events();
  assert.equal(list.filter(e => e.type === 'practice.attempted').at(-1).verdict, 'unassessed');
  const opened = game.coaches.length;
  const steps = await playSession(page);
  assert.equal(itemsOf(steps).length, 10);
  assert.equal(game.coaches.length, opened, '닫히지 않은 겉을 이어 쓴다');
  const sets = new Set((await game.events()).filter(e => e.type === 'practice.presented').map(e => e.setId));
  assert.equal(sets.size, 2);
  // 판을 다시 정했다 — 다음 회차에서 문을 다시 열고, 셸이 지금 판이라고 하면 옛 코치로 간다.
  game.retire();
  await sleep(20);
  game.old();
  page.byId('done').click();
  const again = await playSession(page);
  assert.ok(itemsOf(again).length >= 10);
  assert.equal(page.created.length, 1, '옛 길');
  assert.ok(page.log.some(([name]) => name === 'present'));
  game.door.dispose();
});

test('계정(놀이 호스트)이면 입구를 먼저 그리고 시작 단추가 셸의 코치를 기다린다 — 기다리는 사이 다른 화면으로 가면 시작하지 않는다 · 놀이 호스트가 없으면 어느 길인지 먼저 안다', { timeout: 60_000 }, async () => {
  const game = await realDoor();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const slow = { open: async options => { await gate; return game.door.api.open(options); } };
  const records = fakeStorage({ [KEY]: JSON.stringify(await progressOf(['v-a', 'v-eo', 'v-o', 'v-u'])) });
  const host = { ready: async () => {}, storage: () => records, status: () => ({ phase: 'synced' }), subscribe: () => () => {}, flush: async () => {} };
  const page = await boot({ door: slow, host });
  await loaded(page);
  assert.equal(page.byId('home').hidden, false, '입구가 먼저 선다');
  page.byId('start').click();
  page.byId('start').click();
  await sleep(20);
  assert.equal(page.qa().step(), null, '셸의 코치를 기다린다');
  release();
  await until(() => page.qa().step(), '기다린 뒤 시작');
  await sleep(20);
  assert.equal(game.calls.filter(([name]) => name === 'startSet').length, 1, '두 번 눌러도 회차는 하나다');
  assert.equal(page.created.length, 0);
  page.byId('quit').click();

  // 기다리는 사이 다른 화면(노래)으로 갔으면 시작하지 않는다.
  let late;
  const hold = new Promise(resolve => { late = resolve; });
  const moved = await boot({ door: { open: async options => { await hold; return game.door.api.open(options); } }, host });
  await loaded(moved);
  moved.byId('start').click();
  moved.byId('songs').all('song-card')[0].click();
  assert.equal(moved.byId('song').hidden, false);
  // 노래를 닫고 입구로 돌아와도 앞의 시작은 살아나지 않는다(검수 GA1 · 카본 A1).
  moved.byId('song-close').click();
  assert.equal(moved.byId('home').hidden, false);
  late();
  await sleep(60);
  assert.equal(moved.qa().step(), null);
  game.door.dispose();

  // 놀이 호스트가 없으면(손님) 진도 자리가 어느 길인지에 달려 있어 먼저 기다린다.
  let free;
  const wait = new Promise(resolve => { free = resolve; });
  const guest = await boot({ door: { open: async () => { await wait; return null; } } });
  await sleep(30);
  assert.equal(globalThis.document.getElementById('hero-title').textContent, '', '아직 그리지 않았다');
  free();
  await loaded(guest);
  assert.notEqual(globalThis.document.getElementById('hero-title').textContent, '');
});

test('짝 맞추기 카드의 첫 소리가 나지 않아도 다시 들어 소리가 나면, 다음 문항이 보고 고르기로 묶이지 않는다(검수 GA2)', { timeout: 90_000 }, async () => {
  const seen = [];
  for (const failFirstCard of [false, true]) {
    const game = await realDoor();
    const page = await boot({ door: game.door.api, calls: game.calls, met: ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b'] });
    await loaded(page);
    const items = itemsOf(await playSession(page, { failFirstCard }));
    seen.push(items.map(i => i.type));
    game.door.dispose();
  }
  const at = seen[0].indexOf('match');
  assert.ok(at >= 0 && at < seen[0].length - 1, `짝 맞추기 뒤에 문항이 있는 회차: ${seen[0]}`);
  assert.deepEqual(seen[1], seen[0], '다시 들어 소리가 났으면 회차가 같다');
});

test('듣는 문항의 첫 소리가 나지 않아도 다시 들어 소리가 나면, 다음 문항이 보고 고르기로 묶이지 않는다(검수 Fable F2 — 앱의 play가 회차의 소리 실패를 푼다)', { timeout: 90_000 }, async () => {
  const met = ['v-a', 'v-eo', 'v-o', 'v-u', 'v-eu', 'v-i', 'c-g', 'c-n', 'c-d', 'c-r', 'c-m', 'c-b'];
  const run = async failAt => {
    const game = await realDoor();
    const page = await boot({ door: game.door.api, calls: game.calls, met });
    await loaded(page);
    const steps = await playSession(page, { failAt }).finally(() => { globalThis.__failFor = null; });
    game.door.dispose();
    return { steps, items: itemsOf(steps), page };
  };
  const plain = await run(-1);
  // 앞 걸음도 문항인 듣는 문항(듣고 고르기 · 짝 · 가르쳐 주기) 가운데, 다음 문항이 보고 고르기가 아닌 자리.
  const listening = new Set(['listen_pick', 'pair', 'teach']);
  const at = plain.items.findIndex((item, k) => k > 0 && listening.has(item.type) && plain.items[k + 1] && plain.items[k + 1].type !== 'see_pick'
    && plain.steps[plain.steps.indexOf(plain.steps.find(s => s.item === item)) - 1]?.kind === 'item');
  assert.ok(at > 0, `그런 자리가 있는 회차: ${plain.items.map(i => i.type)}`);
  const failed = await run(at);
  assert.ok(failed.page.calls.some(([name, , info]) => name === 'delivery' && info?.audio === 'failed'), '그 문항의 첫 소리는 실패로 적힌다');
  assert.deepEqual(failed.items.slice(0, at + 2).map(i => i.type), plain.items.slice(0, at + 2).map(i => i.type), '다시 들어 소리가 났으면 다음 문항의 꼴이 같다');
});

// 늦게 내는 소리는 그 장을 떠나면 내지 않는다. 틀린 답 뒤에 앱은 고른 소리 → 쉼 → 정답 소리를 이어 낸다. 그 사이 다음 장으로 가면 이어 낸 정답 소리가
// 다음 장의 첫 소리를 끊어 소리 실패로 적혔고(새 길은 뒤 문항을 보고 고르기로 묶는다), 그만두면 홈 위에서 났다. 문항을 그린 뒤 잠깐 쉬고 내는 첫 소리도 같다.
for (const path of ['꺼진 판(옛 길)', '새 길']) {
  for (const type of ['listen_pick', 'see_pick', 'build']) {
    test(`틀린 답 뒤에 이어 내는 소리는 그 장을 떠나면 멈춘다 — 다음 장으로 가고 곧바로 그만두면 소리가 더 나지 않는다(${path} · ${type})`, { timeout: 60_000 }, async () => {
      const game = path === '새 길' ? await realDoor() : null;
      const page = await boot(game ? { door: game.door.api, calls: game.calls } : {});
      await loaded(page);
      page.byId('start').click();
      await until(() => page.qa().step(), '회차 시작');
      const now = () => page.qa().step();
      for (let n = 0; now() && !(now().kind === 'item' && now().item.type === type); n += 1) { if (n > 40) break; await solve(page); }
      assert.equal(now()?.item?.type, type, `회차에 ${type} 문항이 있다`);
      globalThis.__speakMs = 120; // 답 뒤의 첫 소리가 나는 동안 장을 떠난다
      try {
        await solve(page, { correct: false });   // 틀린 답 → 판정 → 다음 장
        const left = globalThis.__said.length;
        page.byId('quit').click();
        await sleep(500);
        assert.deepEqual(globalThis.__said.slice(left), [], '그만둔 뒤에는 앞 장의 소리 · 다음 장의 첫 소리를 내지 않는다');
      } finally { globalThis.__speakMs = null; }
      game?.door.dispose();
    });
  }
}
