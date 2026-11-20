// 꺼진 판(문도 개발 깃발도 없을 때)의 듣기 확인 다시 확인 — 진짜 app.mjs를 노드에서 띄운다. 듣기 확인 화면의 요소는 진짜처럼 움직이는 겉이고,
// 코치는 진짜 옛 코치(atlas/game-learning.js)다. 첫 문제를 틀린 뒤 같은 목표의 새 문제를 맞히면 앞 답과 견주는 안내(recheck)가 한 번 나온다.
// 기대값(recheck 부르기 · 피드백 글 · 옛 코치에 닿는 차례)은 4-6d 앞의 app.mjs · listening-check-ui.mjs를 같은 겉 · 같은 응답 순서로 돌려 잰
// 값이다(4-6 끝 판 GB1 · GC1 — app.mjs가 코치를 함수로 넘기자 화면이 그 함수에서 recheck를 찾아 0번이 됐다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { LISTENING_CHECKS } from './listening-check.mjs';

const require = createRequire(import.meta.url);
const { createGame } = require('../../atlas/game-learning.js');
const { createMap } = require('../../strata/index.js');
const map = createMap(require('../../strata/maps/topik-i.json'));

// 모르는 이름은 무엇이든 받아 주는 겉(atlas-next-entry.test.mjs와 같다).
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
// 글 · 자식 · 대화상자 열림은 진짜처럼, 나머지는 겉으로 받는 요소.
class Element {
  constructor() {
    this.children = []; this.dataset = {}; this.style = {}; this.open = false; this.hidden = false; this.disabled = false;
    this._text = ''; this.nodes = new Map(); this.rest = stubNode();
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map((n) => (typeof n === 'string' ? n : n.textContent)).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
  querySelector(selector) { if (!this.nodes.has(selector)) this.nodes.set(selector, element()); return this.nodes.get(selector); }
  showModal() { this.open = true; }
  close() { this.open = false; }
}
function element() {
  return new Proxy(new Element(), { get: (target, prop) => (prop === 'then' ? undefined : prop in target ? target[prop] : target.rest[prop]) });
}
function fakeDocument() {
  const nodes = new Map();
  const own = {
    documentElement: { dataset: {} },
    fonts: { ready: new Promise(() => {}) },   // 입구 그림(캔버스)은 그리지 않는다
    hidden: false,
    querySelector: (sel) => { if (!nodes.has(sel)) nodes.set(sel, element()); return nodes.get(sel); },
    querySelectorAll: () => [],
    getElementById: (id) => own.querySelector(`#${id}`),
    createElement: () => element(),
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
// 소리: 받은 MP3는 바로 끝까지 재생된다(listening-recheck.test.mjs와 같다).
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect() {} }; }
  decodeAudioData() { return Promise.resolve({ duration: 1 }); }
  createBufferSource() { return { connect() {}, stop() {}, start() { queueMicrotask(() => this.onended?.()); } }; }
  resume() { return Promise.resolve(); }
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
const until = async (check, rounds = 200) => { for (let i = 0; i < rounds && !check(); i += 1) await tick(); };

let boots = 0;
// 꺼진 판 한 페이지 — 옛 코치는 진짜이고, 부른 메서드 이름 · recheck 인수 · 답을 적는다.
async function boot() {
  const log = [], rechecks = [], answers = [];
  const doc = fakeDocument();
  const local = fakeStorage();
  Object.assign(globalThis, {
    window: globalThis, document: doc,
    location: { hostname: 'synk.im', search: '', pathname: '/korean-runner/' },
    parent: globalThis, top: globalThis,
    SynkLearning: {
      createGame: (options) => {
        const coach = createGame({ ...options, map, fold: false });
        for (const [name, value] of Object.entries(coach)) {
          if (typeof value !== 'function') continue;
          coach[name] = (...args) => {
            log.push(name);
            const result = value(...args);
            if (name === 'recheck') rechecks.push(args);
            if (name === 'answer') answers.push(result);
            return result;
          };
        }
        return coach;
      },
    },
    SynkPlayAccount: { ready: async () => {}, storage: () => fakeStorage() },
    AudioContext,
    requestAnimationFrame: () => 0, requestIdleCallback: () => 0, cancelAnimationFrame() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }), scrollTo() {}, addEventListener() {}, removeEventListener() {}, confirm: () => false,
    getComputedStyle: () => ({ lineHeight: '20px' }),
    Image: class { decode() { return Promise.resolve(); } },
    fetch: async (url) => {
      if (!String(url).endsWith('.mp3')) throw new Error('닫힘');
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) };
    },
  });
  Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true, writable: true });
  await import(`./app.mjs?recheck=${(boots += 1)}`);
  const $ = (id) => doc.getElementById(id);
  const ready = () => until(() => $('check-q').dataset.phase === 'ready');
  // 지금 문제의 정답 자리(또는 오답 자리)를 누른다.
  const answer = async (correct) => {
    await ready();
    const item = LISTENING_CHECKS.find((row) => row.id === $('listening-check-dialog').dataset.item);
    $('check-choices').children[correct ? item.correct : (item.correct + 1) % item.choices.length].onclick();
    return { item: item.id, result: answers.at(-1) };
  };
  return { $, log, rechecks, answer };
}

// 4-6d 앞의 app.mjs로 잰 값(같은 겉 · 같은 응답 순서, 한 프로세스에 한 페이지): 판을 열고 첫 문제를 틀린 뒤 「다음」 — 같은 목표의 새 문제를 맞힌다.
// 옛 코치에 닿는 차례 — 판 열기(요약 · 사건 · 만남) → 고르기 → 제시 · 전달 · 답 → 다음 고르기 → 제시 · 전달 · 답 → 앞 답과 견주기.
const OLD_FIRST = 'check-fence-jump';
const OLD_SECOND = 'check-sign-duck';
const OLD_CHECK = ['summary', 'events', ...Array(12).fill('exposure'), 'recommend', 'exposure', 'present', 'delivery', 'delivery', 'answer',
  'exposure', 'exposure', 'exposure', 'recommend', 'exposure', 'present', 'delivery', 'delivery', 'answer', 'recheck'];
const OLD_RECHECK_LINE = '다른 새 문항은 도움 없이 맞혔어요.';

test('꺼진 판 — 듣기 확인에서 틀린 뒤 같은 목표의 새 문제를 맞히면 앞 답과 견주는 안내가 4-6d 앞과 같이 한 번 나온다', async () => {
  const page = await boot();
  const opened = page.log.length;
  await page.$('listening-check').onclick();
  const first = await page.answer(false);
  assert.equal(first.item, OLD_FIRST);
  assert.equal(first.result.verdict, 'incorrect');
  assert.deepEqual(page.rechecks, [], '첫 답에는 견줄 앞 답이 없다');
  page.$('check-next').onclick();
  const second = await page.answer(true);
  assert.equal(second.item, OLD_SECOND, '같은 목표의 다른 새 문제');
  assert.equal(second.result.verdict, 'correct');
  assert.deepEqual(page.rechecks, [[first.result.eventId, second.result.eventId]], '앞 답과 이 답을 한 번 견준다');
  assert.ok(page.$('check-feedback').textContent.endsWith(`처음 듣고 혼자 답한 기록이에요.${OLD_RECHECK_LINE}`), '기록 줄 뒤에 견준 안내 한 줄');
  assert.deepEqual(page.log.slice(opened), OLD_CHECK, '옛 코치에 닿는 차례가 4-6d 앞과 같다');
});
