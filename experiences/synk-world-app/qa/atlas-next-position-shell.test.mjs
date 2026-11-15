// 4-4a 「내 위치」 새 판의 셸 배선(단계4_계획 §21-2 · 21-5 · 21-11) — world-learning-ui.mjs openPosition이 홈과 같은 판 셋(지금 판 · 확인 중 · 엔진)을
// 따르고, 엔진 판은 홈 코치 하나로 그린다. 판을 다시 정하면(retired) 확인 중으로 다시 그렸다가 새 코치로 다시 그린다. 엔진 판을 열 때 옛 코치(옛
// 저장소)를 새로 열지 않고 /atlas/ 요청 · IndexedDB를 늘리지 않는다. 한글 열쇠는 이 화면이 이미 든 옛 코치에서만 짓는다(설계 주인 11-15).
// 진짜 엔진 코치(손님 메모리 저장소) · 진짜 지도 조각 · 진짜 홈 플래너(world-today · 입구의 positionPlanner)로 돌린다. 셸 판은 글(HTML)만 본다
// (이 저장소에 DOM 도구가 없다 — atlas-next-off.test.mjs의 판 상자와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { createWorldEducation } from '../world-learning-ui.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { homeBanksOf, positionPlanner } from '../world-atlas-next.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from '../world-today.mjs';

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const PLANNER = Object.freeze({ createWorldTodayPlan, watchHomePlan, todayKey, say: () => '', position: positionPlanner });
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, ms = 5000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error(`기다림이 넘쳤다: ${label}`);
    await tick(10);
  }
}

let stores = 0;
// 홈 코치를 앱처럼 연다 — 짧은 연습 풀 전체의 홈 은행(homeBanksOf)만 조각으로 받고 낱말 이름도 싣는다(world-atlas-next.mjs와 같다).
async function homeCoach() {
  stores += 1;
  const banks = homeBanksOf(worldPosition.practice.pool);
  const coach = atlas.createCoach({
    gameId: 'world-home',
    mapData: { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS },
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:position-shell-${process.pid}-${stores}` },
  });
  await coach.ready;
  return coach;
}

// 판 상자: innerHTML 글을 들고 단추 누르기만 흉내 낸다(atlas-next-off.test.mjs와 같은 방식).
function stage() {
  const clicks = [];
  const box = {
    html: '',
    isConnected: true,
    get innerHTML() {
      return this.html;
    },
    set innerHTML(value) {
      this.html = String(value);
    },
    addEventListener(type, fn) {
      if (type === 'click') clicks.push(fn);
    },
    contains: () => true,
    closest: () => null,
    focus() {},
    querySelectorAll: () => [],
    querySelector: () => ({ focus() {}, addEventListener() {} }),
  };
  box.press = (attr, value = '') => {
    const camel = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const button = { dataset: { [camel]: value }, disabled: false, hasAttribute: name => name === attr };
    for (const fn of [...clicks]) fn({ target: { closest: selector => (selector === 'button' ? button : null) } });
  };
  return box;
}

// 셸 하나 — 새 길 홈 입구(homeNext)를 넘긴 학습 화면. 홈 코치는 열 때마다 새로 짓는다(판을 다시 정하면 새 코치).
function shell({ owner = 'guest', values = { audio: 'off' }, reading = { answer: 'reads' }, host = null, storage = new Map() } = {}) {
  const opens = [];
  const engine = {
    ...worldLearning,
    engine: {
      ...worldLearning.engine,
      createGame(options) {
        if (options.gameId !== 'world-home-empty') opens.push(options.gameId);
        return worldLearning.engine.createGame(options);
      },
    },
  };
  const shown = [];
  const toasts = [];
  const coaches = [];
  const retirees = [];
  let box = null;
  const node = () => ({
    isConnected: true,
    focus() {},
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    insertAdjacentHTML() {},
  });
  const document = {
    querySelector(selector) {
      const html = shown.at(-1) ?? '';
      if (selector.includes('[data-position-stage]')) return box && html.includes('data-position-stage') ? box : null;
      const found = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(selector);
      if (!found) return null;
      const [, name, value] = found;
      const hit = value === undefined ? new RegExp(`\\s${name}(?=[\\s=>])`).test(html) : html.includes(`${name}="${value}"`);
      return hit ? node() : null;
    },
  };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  const target = {
    localStorage,
    document,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    ...(host ? { SYNKLearningHost: host } : {}),
  };
  const progress = {
    owner,
    learningProfile: () => ({ profile: { status: 'active', revision: 1, consent: true } }),
    learningProfileValues: () => values,
    status: () => ({ phase: 'synced', rejected: false, scoped: owner !== 'guest', message: '' }),
    exportSnapshot: () => ({}),
    summary: () => ({ nextLesson: null, resume: false }),
    flush: async () => {},
    hangulReading: () => reading,
  };
  const home = {
    updateStudy() {},
    toast: text => toasts.push(text),
    closePanel() {},
    attachPanelResource() {},
    openPanel: () => 'life-position',
    showPanel(title, html) {
      shown.push(String(html));
      if (/data-position-stage/.test(html)) box = stage();
    },
  };
  const homeNext = {
    async coach() {
      const made = await homeCoach();
      coaches.push(made);
      return made;
    },
    planner: async () => PLANNER,
    retired(made, fn) {
      const entry = { made, fn, gone: false };
      retirees.push(entry);
      return () => {
        entry.gone = true;
      };
    },
    life: () => 'engine',
    ask: async () => {},
    judge: () => ({ state: 'engine', items: [], ids: [], times: [], upcoming: [], stuck: [] }),
    answers: () => null,
    openGames: () => null,
    packs() {},
    painted() {},
  };
  const education = createWorldEducation({
    home,
    getProgress: () => progress,
    engine,
    createPlan: () => ({ selected: null, reason: '' }),
    launchGame() {},
    startLesson() {},
    startReview() {},
    position: worldPosition,
    target,
    homeNext,
  });
  return {
    education,
    opens,
    shown,
    toasts,
    coaches,
    last: () => shown.at(-1) ?? '',
    box: () => box,
    // 판을 다시 정한다(입구의 retired) — 그 코치를 지켜보던 화면 모두에 알린다.
    retire(made) {
      for (const entry of retirees) if (entry.made === made && !entry.gone) entry.fn({ reason: 'account' });
    },
    dispose() {
      education.dispose();
      for (const made of coaches) made.dispose();
    },
  };
}

// /atlas/ 요청 · IndexedDB 읽기를 센다(꺼진 판 시험과 같은 자리).
function watchGlobals() {
  const touched = { idb: 0, atlas: 0 };
  const idb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const fetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    get() {
      touched.idb += 1;
      return undefined;
    },
  });
  globalThis.fetch = async (url, ...rest) => {
    if (String(url).includes('/atlas/')) touched.atlas += 1;
    return fetch(url, ...rest);
  };
  return {
    touched,
    restore() {
      if (idb) Object.defineProperty(globalThis, 'indexedDB', idb);
      else delete globalThis.indexedDB;
      globalThis.fetch = fetch;
    },
  };
}

test('엔진 판 — 확인 중에서 엔진 판으로 다시 그리고, 홈 코치 하나로 칸 셋 · 진단 · 다시 확인을 그리며 옛 판을 그리지 않는다(21-2)', async () => {
  const globals = watchGlobals();
  const app = shell();
  try {
    await tick();
    const before = { opens: app.opens.length, ...globals.touched };
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const html = app.last();
    assert.ok(app.shown.every(board => !/data-position-board[\s=>]/.test(board)), '지금 판 판을 그리지 않는다');
    assert.match(html, /data-complete="true"/, '손님 기록은 다 왔다');
    assert.match(html, /data-diagnostic="ready"/, '처음 보는 문항으로 진단이 열린다');
    assert.match(html, /<ul class="wpos-counts"[^>]*>.*data-cell="notyet"><i class="w-led"[^>]*><\/i><strong>16<\/strong>/s, 'TOPIK I 16개가 모두 아직');
    // 레이싱 문항만 있는 능력(ko.listening.word)은 소리와 상관없이 뺀 것이다 — 학생에게는 「진단 문항이 아직 없는 항목」 줄이다(21-2).
    assert.match(html, /data-withheld="ko\.listening\.word"/);
    assert.match(html, /진단 문항이 아직 없는 항목 1개: 낱말 듣기/);
    assert.match(html, /듣기 항목 7개는 빼요/, '그 밖의 듣기 능력은 소리를 끈 날 줄');
    assert.equal(app.coaches.length, 1, '홈 코치 하나 — 판이 코치와 지도를 더 열지 않는다');
    assert.deepEqual(
      { opens: app.opens.length, ...globals.touched },
      before,
      '엔진 판을 열며 옛 코치(옛 저장소) · IndexedDB · /atlas/를 늘리지 않는다',
    );
  } finally {
    app.dispose();
    globals.restore();
  }
});

test('엔진 판 — 판을 다시 정하면(retired) 확인 중으로 다시 그리고, 새 코치가 서면 엔진 판으로 다시 그린다(닫힌 코치를 읽지 않는다)', async () => {
  const app = shell();
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const first = app.coaches[0];
    app.retire(first);
    assert.match(app.last(), /data-position-next="checking"/, '곧바로 확인 중');
    first.dispose();
    await until(() => /data-position-next="engine"/.test(app.last()), '새 코치의 엔진 판');
    assert.equal(app.coaches.length, 2, '판을 다시 정해 새 코치를 열었다');
  } finally {
    app.dispose();
  }
});

test('엔진 판의 짧은 진단 — 제품 순서 문항을 홈 코치에 남기고, 끝 화면은 저장 뒤의 판정으로 그리며 판을 닫는다(21-5)', async () => {
  const app = shell();
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const coach = app.coaches[0];
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    for (let guard = 0; guard < 40 && !app.box().html.includes('data-position-done'); guard += 1) {
      const choice = /data-position-choice="([^"]+)"/.exec(app.box().html);
      if (!choice) {
        await tick(10);
        continue;
      }
      app.box().press('data-position-choice', choice[1]);
    }
    await until(() => app.box().html.includes('data-position-done'), '진단 끝 화면');
    const answered = coach.summary().skills.reduce((n, line) => n + line.n, 0);
    assert.ok(answered > 0, '홈 코치에 진단의 첫 답이 남았다');
    assert.match(app.box().html, /data-position-back/, '내 위치로 돌아가기');
    assert.doesNotMatch(app.box().html, /data-set-response-box/, '손님은 판 응답 줄이 없다(판 기록 없이 닫는다)');
  } finally {
    app.dispose();
  }
});

test('한글 열쇠 — 엔진 판은 이 화면이 이미 든 옛 코치에서만 짓고, 열쇠 하나 때문에 옛 코치를 만들지 않는다(설계 주인 11-15)', async () => {
  // 계정 기록 읽개가 없는 계정(리허설) · 「아직 못 읽어요」를 고른 학생. 이 계정 · 판 구역의 한글 진도는 졸업했다.
  const key = 'synk.account.acct-1.r3.hangul-stage.v1';
  const storage = new Map([[key, JSON.stringify({ v: 1, letters: {}, graduated: { at: '2026-11-01T00:00:00.000Z' } })]]);
  const created = [];
  const empty = worldLearning.engine.createGame({ gameId: 'world-old-empty', storage: null, historyComplete: false }).summary();
  const old = { assignment() {}, summary: () => empty, presentation: () => null, disconnect() {} };
  const host = {
    createGame(options) {
      created.push(options.gameId);
      return old;
    },
    status: () => ({ accountKey: 'acct-1', revision: 3 }),
    ready: async () => {},
    preferences: () => ({ presentation: () => null, setPresentation: () => true }),
  };
  const globals = watchGlobals();
  const app = shell({ owner: 'acct-1', reading: { answer: 'new' }, host, storage });
  try {
    await tick();
    // 든 옛 코치가 없다 — 계정의 한글 자리를 모르는 것(지금 판에서 학습 호스트가 아직 없을 때와 같다)으로 한글 판을 연다.
    await app.education.position();
    assert.match(app.last(), /data-position-board="hangul"/);
    assert.deepEqual(created, [], '열쇠 하나 때문에 옛 코치를 만들지 않는다');
    // 생활 화면의 거울이 옛 코치를 연 뒤 — 그 코치로 계정 구역 열쇠를 지어 졸업을 읽고 엔진 판을 연다.
    assert.ok(app.education.lifeLearning.coach());
    assert.deepEqual(created, ['world-life']);
    const touched = { ...globals.touched };
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    assert.deepEqual(created, ['world-life'], '판을 열며 옛 코치를 더 만들지 않는다');
    assert.deepEqual(globals.touched, touched, 'IndexedDB · /atlas/를 늘리지 않는다');
  } finally {
    app.dispose();
    globals.restore();
  }
});
