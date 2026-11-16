// 4-4a 「내 위치」 새 판의 셸 배선(단계4_계획 §21-2 · 21-5 · 21-11) — world-learning-ui.mjs openPosition이 홈과 같은 판 셋(지금 판 · 확인 중 · 엔진)을
// 따르고, 엔진 판은 홈 코치 하나로 그린다. 판을 다시 정하면(retired) 확인 중으로 다시 그렸다가 새 코치로 다시 그린다. 엔진 판을 열 때 옛 코치(옛
// 저장소)를 새로 열지 않고 /atlas/ 요청 · IndexedDB를 늘리지 않는다. 한글 열쇠는 이 화면이 이미 든 옛 코치에서만 짓는다(설계 주인 11-15).
// 진짜 엔진 코치(손님 메모리 저장소) · 진짜 지도 조각 · 진짜 홈 플래너(world-today · 입구의 positionPlanner)로 돌린다. 셸 판은 글(HTML)만 본다
// (이 저장소에 DOM 도구가 없다 — atlas-next-off.test.mjs의 판 상자와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { homeBanksOf, positionPlanner } from '../world-atlas-next.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from '../world-today.mjs';

// 변형 시험(qa/position-mutants.mjs)은 깬 셸 사본을 SYNK_LEARNING_UI_MODULE로 넘긴다. 그 밖에는 원본이다.
const { createWorldEducation } = await import(
  process.env.SYNK_LEARNING_UI_MODULE ? pathToFileURL(process.env.SYNK_LEARNING_UI_MODULE).href : '../world-learning-ui.mjs'
);

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
// open: 홈 코치를 짓는 길(기본 손님 홈 코치). timers: 셸이 target으로 받는 시계(setTimeout · clearTimeout — 가짜 시계). panels: 홈처럼 판 자원을
// 다룬다(판을 바꾸거나 닫으면 그 판의 자원을 dispose — home.mjs disposePanelContent, 판을 닫으면 진짜 홈처럼 다음 마이크로태스크에 education.refresh를
// 부른다 — home.mjs closePanel). 창(online)과 문서(visibilitychange)의 알림은 fire로 내고, 셸이 단 듣기 수는 listening으로, 홈을 그린 횟수
// (updateStudy)는 studied로 본다. 열린 판의 종류(openPanel)는 판을 보이면 그 종류, panels로 닫으면 빈 값이다. fade: 진짜 홈처럼 닫으며 흐려지는
// 동안(160ms) 판 조각을 남긴다 — 판 종류만 곧 빈 값이 되고, endFade가 조각을 지운다(받기 알림 설계 검토 D1).
// focusing: 판 글의 단추와 문서의 초점(activeElement)을 흉내 내고, 셸이 초점을 둔 자리를 focused에 적는다(판 머리는 root, 단추는 이름=값#몇 번째).
// paint: 판 글을 바꿔 둔다(진짜 판에서 생길 수 있는 꼴을 흉내 낸다). focusing이면 판 안의 스크롤 칸(#panel-content)도 흉내 낸다 — 판 글을 바꾸면 스크롤 자리가
// 처음으로 가고(셸이 되돌려야 한다), 능력 줄(details)은 접힌 채로 서며, 닫힌 줄 안의 단추에는 초점이 가지 않는다(브라우저는 닫힌 details의 몸을 그리지 않는다).
function shell({ owner = 'guest', values = { audio: 'off' }, reading = { answer: 'reads' }, host = null, storage = new Map(), wrap = made => made, open = homeCoach, timers = null, panels = false, focusing = false, paint = html => html, planner = PLANNER, fade = false, nextExtra = {} } = {}) {
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
  let active = null;
  const focused = [];
  const buttonsMade = new Map();
  const content = { scrollTop: 0 };
  // 판 글의 능력 줄(details[data-skill])과 그 summary를 짓는다(focusing일 때만). 같은 판 글이면 같은 줄을 돌려준다.
  const rowsIn = () => {
    const key = `${shown.length}|details`;
    if (!buttonsMade.has(key)) {
      const html = shown.at(-1) ?? '';
      const list = [...html.matchAll(new RegExp('<details[^>]*data-skill="([^"]*)"', 'g'))].map(match => {
        const skill = match[1];
        const row = {
          inPanel: true,
          tagName: 'DETAILS',
          open: false,
          getAttribute: attr => (attr === 'data-skill' ? skill : null),
          querySelector: selector => (selector === 'summary' ? summary : null),
        };
        const summary = {
          inPanel: true,
          tagName: 'SUMMARY',
          hasAttribute: () => false,
          closest: selector => (selector === 'details[data-skill]' ? row : null),
          focus: () => focused.push(`summary=${skill}`),
        };
        return row;
      });
      buttonsMade.set(key, list);
    }
    return buttonsMade.get(key);
  };
  // 판 글에서 그 속성을 가진 단추를 짓는다(focusing일 때만). 같은 판 글이면 같은 단추를 돌려준다(초점이 몇 번째 단추였는지 견줄 수 있게).
  const buttonsIn = selector => {
    if (selector === 'details[data-skill]') return rowsIn();
    const found = /^\[(data-[a-z-]+)\]$/.exec(selector);
    if (!found) return [];
    const name = found[1];
    const key = `${shown.length}|${name}`;
    if (!buttonsMade.has(key)) {
      const seen = new Map();
      const html = shown.at(-1) ?? '';
      const list = [...html.matchAll(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`, 'g'))].map(match => {
        const value = match[1] ?? '';
        const index = seen.get(value) ?? 0;
        seen.set(value, index + 1);
        // 그 단추가 능력 줄(details) 안이면 그 줄의 능력.
        const rowAt = html.lastIndexOf('<details', match.index);
        const inRow = rowAt >= 0 && html.indexOf('</details>', rowAt) > match.index;
        const rowSkill = inRow ? (/data-skill="([^"]*)"/.exec(html.slice(rowAt, html.indexOf('>', rowAt))) ?? [])[1] ?? null : null;
        const clicks = [];
        return {
          inPanel: true,
          clicks,
          dataset: { [name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())]: value },
          getAttribute: attr => (attr === name ? value : null),
          hasAttribute: attr => attr === name,
          rowSkill,
          focus: () => {
            if (rowSkill != null && rowsIn().find(row => row.getAttribute('data-skill') === rowSkill)?.open !== true) return;
            focused.push(`${name}=${value}#${index}`);
          },
          addEventListener(type, fn) {
            if (type === 'click') clicks.push(fn);
          },
        };
      });
      buttonsMade.set(key, list);
    }
    return buttonsMade.get(key);
  };
  const node = () => ({
    isConnected: true,
    focus() {
      if (focusing) focused.push('root');
    },
    closest: selector => (focusing && selector === '#panel-content' ? content : null),
    querySelector: () => null,
    querySelectorAll: selector => (focusing ? buttonsIn(selector) : []),
    contains: element => focusing && (element?.inPanel === true || element?.isRoot === true),
    addEventListener() {},
    insertAdjacentHTML() {},
  });
  const heard = new Map();
  const listen = (scope, type, fn) => heard.set(`${scope}:${type}`, [...(heard.get(`${scope}:${type}`) ?? []), fn]);
  const unlisten = (scope, type, fn) => heard.set(`${scope}:${type}`, (heard.get(`${scope}:${type}`) ?? []).filter(row => row !== fn));
  let resource = null;
  let studied = 0;
  let kind = '';
  let fading = false;
  const disposeResource = () => {
    const was = resource;
    resource = null;
    was?.dispose?.();
  };
  const document = {
    visibilityState: 'visible',
    get activeElement() {
      return active;
    },
    addEventListener: (type, fn) => listen('document', type, fn),
    removeEventListener: (type, fn) => unlisten('document', type, fn),
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
    addEventListener: (type, fn) => listen('window', type, fn),
    removeEventListener: (type, fn) => unlisten('window', type, fn),
    setTimeout: timers ? timers.setTimeout : setTimeout,
    ...(timers ? { clearTimeout: timers.clearTimeout } : {}),
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
    updateStudy() {
      studied += 1;
    },
    toast: text => toasts.push(text),
    closePanel() {
      if (!panels) return;
      disposeResource();
      kind = '';
      if (fade) fading = true;
      else shown.push('');
      queueMicrotask(() => education.refresh());
    },
    attachPanelResource(value) {
      if (!panels || value === resource) return;
      const was = resource;
      resource = value;
      was?.dispose?.();
    },
    openPanel: () => kind,
    showPanel(title, html, options = {}) {
      if (panels) disposeResource();
      fading = false;
      kind = options?.type || 'life-position';
      shown.push(String(paint(String(html))));
      if (focusing) content.scrollTop = 0;
      if (/data-position-stage/.test(html)) box = stage();
    },
  };
  const homeNext = {
    async coach() {
      const made = wrap(await open());
      coaches.push(made);
      return made;
    },
    planner: async () => planner,
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
    ...nextExtra,
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
    // 판을 닫는다(홈의 닫기 — panels일 때만 판 자원을 dispose하고 홈을 새로 그린다).
    closePanel: () => home.closePanel(),
    // 홈을 그린 횟수(drawHome의 updateStudy) · 셸이 창과 문서에 단 그 알림의 듣기 수.
    studied: () => studied,
    // 흐려지던 판의 조각을 지운다(fade일 때 — 홈의 닫기 타이머가 끝난 때).
    endFade() {
      if (!fading) return;
      fading = false;
      shown.push('');
    },
    listening: type => ['window', 'document'].reduce((n, scope) => n + (heard.get(`${scope}:${type}`)?.length ?? 0), 0),
    // 초점(focusing일 때만) — 판 안의 단추(몇 번째), 판 머리, 판 밖, 다시 그린 판에는 없는 단추에 둔다.
    focused,
    focusOn(name, value = '', index = 0) {
      active = buttonsIn(`[${name}]`).filter(button => button.getAttribute(name) === value)[index] ?? null;
      assert.ok(active, `판에 ${name}="${value}"의 ${index + 1}번째 단추가 있다`);
      assert.ok(
        active.rowSkill == null || rowsIn().find(row => row.getAttribute('data-skill') === active.rowSkill)?.open === true,
        '닫힌 능력 줄 안의 단추에는 초점을 둘 수 없다 — 줄을 먼저 편다',
      );
    },
    focusRoot() {
      active = { isRoot: true, hasAttribute: () => false };
    },
    focusOutside() {
      active = { inPanel: false, hasAttribute: () => false };
    },
    // 판 단추를 누른다(focusing일 때만 — 셸이 그 단추에 단 click을 부른다).
    click(name, value = '') {
      const button = buttonsIn(`[${name}]`).find(row => row.getAttribute(name) === value);
      assert.ok(button, `판에 ${name}="${value}" 단추가 있다`);
      for (const fn of [...button.clicks]) fn({ type: 'click' });
    },
    // 판 안의 스크롤 칸(focusing일 때만) · 능력 줄 펴기 · 펴 둔 줄 · 화면 숨기기와 다시 보이기.
    content,
    openRow(skill) {
      const row = rowsIn().find(item => item.getAttribute('data-skill') === skill);
      assert.ok(row, `판에 ${skill} 능력 줄이 있다`);
      row.open = true;
    },
    openRows: () => rowsIn().filter(row => row.open).map(row => row.getAttribute('data-skill')),
    hide() {
      document.visibilityState = 'hidden';
    },
    show() {
      document.visibilityState = 'visible';
    },
    // 능력 줄을 펴는 summary에 둔다.
    focusSummary(skill) {
      active = rowsIn().find(row => row.getAttribute('data-skill') === skill)?.querySelector('summary') ?? null;
      assert.ok(active, `판에 ${skill} 능력 줄이 있다`);
    },
    focusGone(name, value) {
      active = { inPanel: true, hasAttribute: attr => attr === name, getAttribute: attr => (attr === name ? value : null) };
    },
    // 창 · 문서 알림을 낸다 — online은 창, visibilitychange는 문서.
    fire(type) {
      for (const fn of heard.get(`${type === 'visibilitychange' ? 'document' : 'window'}:${type}`) ?? []) fn({ type });
    },
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

// 서버 길 계정처럼 보이는 홈 코치 — 요약의 기록부가 서버 길(guest false)이고, 첫 받기 답(synced)을 시험이 차례로 준다(함수면 늘 그 답 — 진짜
// 엔진은 첫 받기 결과를 그 문서 동안 그대로 돌려준다). sync: 요약의 storage.sync(올리기 · 받기 상태 — pulled 등)를 시험이 준다. 받기 알림(coach.watch)은
// 시험이 emit으로 낸다 — 진짜 코치는 기록부와 요약이 바뀐 뒤에 알리므로(§21-20 조건 2), 시험도 sync를 바꾼 뒤에 낸다.
function accountLike(answers, { sync = () => ({}) } = {}) {
  const calls = [];
  const listeners = new Set();
  const wrap = made => ({
    ...made,
    summary() {
      const summary = made.summary();
      return { ...summary, storage: { ...summary.storage, guest: false, sync: sync() } };
    },
    async synced(wait) {
      calls.push(wait ?? null);
      await tick(5);
      return typeof answers === 'function' ? answers() : (answers.shift() ?? { ok: true });
    },
    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
  const emit = kind => {
    for (const listener of [...listeners]) listener({ kind });
  };
  return { wrap, calls, listeners, emit };
}

// 받기 알림을 시험이 내는 손님 홈 코치 — 진짜 코치의 watch 대신 코치마다 듣는 함수 묶음을 든다(sets — 판을 다시 정하면 새 코치의 묶음이 뒤에 선다).
// emit(kind, 몇 번째 코치)으로 낸다(기본 마지막 코치). listeners는 마지막 코치의 묶음이다.
function heardLike(more = () => ({})) {
  const sets = [];
  const wrap = made => {
    const listeners = new Set();
    sets.push(listeners);
    return {
      ...made,
      watch(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      ...more(made),
    };
  };
  const emit = (kind, at = -1) => {
    for (const listener of [...(sets.at(at) ?? [])]) listener({ kind });
  };
  return {
    wrap,
    sets,
    emit,
    get listeners() {
      return sets.at(-1) ?? new Set();
    },
  };
}

test('엔진 판 — 서버 길 계정의 첫 받기가 시간 초과로 답해도, 받기가 끝나면 같은 코치로 기록이 다 온 판을 다시 그린다(GPT 끝 판 GB1)', async () => {
  const sync = accountLike([{ ok: false, kind: 'timeout', code: 'PULL_TIMEOUT' }, { ok: true }]);
  const app = shell({ wrap: sync.wrap });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await until(() => /data-complete="true"/.test(app.last()), '받기가 끝난 뒤 기록이 다 온 판');
    assert.deepEqual(sync.calls, [null, 60000], '시간 초과면 받기가 끝날 때까지 한 번 더 길게 기다린다');
    assert.match(app.last(), /data-diagnostic="ready"/, '진단이 다시 열린다');
    await tick(50);
    assert.equal(sync.calls.length, 2, '된 답을 받은 뒤에는 다시 묻지 않는다');
    assert.equal(app.coaches.length, 1, '같은 코치');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 첫 받기가 실패로 끝나면 기록 일부로 그리고, 뒤의 받기가 요약을 바꾼 뒤 알리면(receive — synced는 처음 실패 그대로) 열린 판을 기록이 다 온 판으로 한 번 다시 그린다(GPT 끝 판 GB1 · Fable 끝 판 F1 · §21-20)', async () => {
  let pulled = false;
  const failure = { ok: false, kind: 'offline', code: 'NETWORK' };
  const sync = accountLike(() => failure, { sync: () => ({ pulled }) });
  const app = shell({ wrap: sync.wrap });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    assert.match(app.last(), /data-complete="false"/, '실패면 기록 일부');
    await tick(50);
    assert.equal(sync.calls.length, 1, '실패 뒤 저절로 되풀이해 묻지 않는다');
    assert.equal(sync.listeners.size, 1, '홈 코치 하나에 한 번 듣는다 — 내 위치 판이 따로 듣지 않는다');
    // 뒤의 받기가 됐다 — 진짜 엔진은 synced()에 처음 실패를 그대로 돌려주고, pulled를 세운 뒤 receive를 알린다(조건 2).
    pulled = true;
    const drawn = app.shown.length;
    sync.emit('receive');
    assert.equal(app.shown.length, drawn, '알림을 받은 자리에서는 그리지 않는다(다음 틱)');
    await until(() => /data-complete="true"/.test(app.last()), '받기 알림으로 기록이 다 온 판');
    await tick(60);
    assert.equal(app.shown.length, drawn + 1, '판을 한 번 다시 그리고 되풀이하지 않는다');
    assert.ok(sync.calls.every(wait => wait === null), '실패 답은 늦게 기다리지 않는다(시간 초과만)');
  } finally {
    app.dispose();
  }
  assert.equal(sync.listeners.size, 0, '문서를 닫으면 듣기를 되돌린다');
});

test('엔진 판 — 첫 받기가 실패로 끝난 뒤 판을 닫으면, 받기 알림이 와도 닫힌 판은 다시 그리지 않고 홈만 새로 그린다. 다시 열면 그 칸을 읽어 기록이 다 온 판으로 그린다(Fable 끝 판 F1 · §21-20)', async () => {
  let pulled = false;
  const sync = accountLike(() => ({ ok: false, kind: 'offline', code: 'NETWORK' }), { sync: () => ({ pulled }) });
  const app = shell({ wrap: sync.wrap });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="false"/.test(app.last()), '기록 일부 판');
    // 판을 닫는다(다른 판을 엶) — 받기가 되어도 닫힌 판을 다시 그리지 않는다.
    app.shown.push('<div data-other-panel></div>');
    await tick(20);
    const studied = app.studied();
    pulled = true;
    sync.emit('receive');
    await until(() => app.studied() > studied, '받기 알림으로 홈을 새로 그린다');
    await tick(30);
    assert.equal(app.last(), '<div data-other-panel></div>', '닫힌 판은 다시 그리지 않는다');
    // 다시 열면 그 칸을 읽어 기록이 다 온 판으로 그린다.
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="true"/.test(app.last()), '다시 연 판');
  } finally {
    app.dispose();
  }
});

// 가짜 시계 — 셸이 target으로 받는 타이머(받기 알림의 다음 틱 · 계획 기다림)만 센다. advance는 때가 된 타이머를 부른다.
function fakeClock() {
  let now = 0;
  let seq = 0;
  const pending = new Map();
  return {
    setTimeout(fn, ms) {
      seq += 1;
      pending.set(seq, { fn, at: now + ms, ms });
      return seq;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    waits: () => [...pending.values()].map(row => row.ms),
    advance(ms) {
      now += ms;
      for (const [id, row] of [...pending]) {
        if (row.at > now || !pending.has(id)) continue;
        pending.delete(id);
        row.fn();
      }
    },
  };
}

test('엔진 판 — 받기 알림 판에는 다시 보기 타이머가 없다: 첫 받기가 실패해도 셸은 타이머를 걸지 않고 online · visibilitychange를 듣지 않는다(다시 연결 · 화면 복귀의 받기는 엔진 호스트가 한다). 잇달아 온 알림은 다음 틱 타이머 하나로 묶고, 그 전에 홈을 새로 그렸으면 타이머는 홈을 또 그리지 않고 열린 판만 한 번 그리며(설계 검토 D4), 판이나 문서를 닫으면 남은 타이머 · 듣기가 없다(설계 주인 11-16 오후 조건 3 · 4)', async () => {
  const clock = fakeClock();
  let pulled = false;
  const sync = accountLike(() => ({ ok: false, kind: 'offline', code: 'NETWORK' }), { sync: () => ({ pulled }) });
  const app = shell({ wrap: sync.wrap, timers: clock, panels: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="false"/.test(app.last()), '기록 일부 판');
    await tick(20);
    assert.deepEqual(clock.waits(), [], '실패 뒤 셸이 거는 다시 보기 타이머가 없다');
    assert.equal(app.listening('online') + app.listening('visibilitychange'), 0, '셸은 다시 연결 · 화면 복귀를 듣지 않는다');
    const quiet = { shown: app.shown.length, studied: app.studied() };
    app.hide();
    app.fire('visibilitychange');
    app.show();
    app.fire('visibilitychange');
    app.fire('online');
    assert.deepEqual({ shown: app.shown.length, studied: app.studied(), waits: clock.waits() }, { ...quiet, waits: [] }, '다시 연결 · 화면 복귀에 셸은 아무것도 하지 않는다');
    // 알림 둘 — 다음 틱 타이머 하나.
    pulled = true;
    sync.emit('receive');
    sync.emit('refresh');
    assert.deepEqual(clock.waits(), [0], '잇달아 온 알림은 다음 틱 타이머 하나로 묶는다');
    const drawn = app.shown.length;
    clock.advance(0);
    assert.equal(app.shown.length, drawn + 1, '그 타이머가 판을 한 번 다시 그린다');
    assert.match(app.last(), /data-complete="true"/);
    assert.deepEqual(clock.waits(), []);
    // 알림 뒤 타이머가 돌기 전에 홈을 새로 그렸다(초점 등) — 그 그리기가 홈 몫을 비췄으니 홈은 또 그리지 않는다. 열린 판은 그 그리기가 다시 그리지
    // 않으므로 타이머가 한 번 그린다(설계 검토 D4).
    sync.emit('receive');
    app.education.refresh();
    const after = { shown: app.shown.length, studied: app.studied() };
    clock.advance(0);
    assert.deepEqual(
      { shown: app.shown.length, studied: app.studied() },
      { shown: after.shown + 1, studied: after.studied },
      '새로 그린 뒤의 타이머는 홈을 또 그리지 않고 열린 판만 한 번 그린다',
    );
    // 알림이 와 타이머가 걸린 채 판을 닫는다 — 타이머가 먼저 돌아도 닫힌 판은 그리지 않는다.
    sync.emit('receive');
    app.closePanel();
    clock.advance(0);
    await tick(0);
    assert.equal(app.last(), '', '닫힌 판은 다시 그리지 않는다');
    // 다시 열면 같은 코치를 그대로 듣는다. 문서를 닫으면 타이머와 듣기가 남지 않는다.
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '다시 연 판');
    assert.equal(sync.listeners.size, 1, '다시 연 판에서도 듣는 곳은 하나');
    sync.emit('receive');
    assert.deepEqual(clock.waits(), [0]);
    app.education.dispose();
    assert.deepEqual(clock.waits(), [], '문서를 닫으면 남은 타이머가 없다');
    assert.equal(sync.listeners.size, 0, '문서를 닫으면 듣기를 되돌린다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 판을 닫으며 흐려지는 동안(조각이 남은 160ms) 온 알림은 닫은 판을 다시 열지 않고 홈만 새로 그린다(받기 알림 설계 검토 D1)', async () => {
  const clock = fakeClock();
  const heard = heardLike();
  const app = shell({ wrap: heard.wrap, timers: clock, panels: true, fade: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await tick(20);
    const drawn = app.shown.length;
    app.closePanel();
    await tick(0); // 닫기의 새로 그리기
    const studied = app.studied();
    heard.emit('receive');
    clock.advance(0);
    assert.equal(app.shown.length, drawn, '흐려지는 판을 다시 그리지 않는다 — 닫은 판이 다시 열리지 않는다');
    assert.equal(app.studied(), studied + 1, '홈은 새로 그린다');
    app.endFade();
    assert.equal(app.last(), '');
  } finally {
    app.dispose();
  }
});

test('엔진 판의 짧은 진단 — 판을 닫으며 흐려지는 동안 온 알림은 남은 진단 판 조각을 열린 판으로 보지 않고 홈을 새로 그린다 — 미룬 알림이 남지 않는다(받기 알림 설계 검토 D1)', async () => {
  const clock = fakeClock();
  const heard = heardLike();
  const app = shell({ wrap: heard.wrap, timers: clock, panels: true, fade: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    app.closePanel();
    await tick(0); // 닫기의 새로 그리기
    const studied = app.studied();
    heard.emit('receive');
    clock.advance(0);
    assert.equal(app.studied(), studied + 1, '흐려지는 진단 판 조각을 열린 판으로 보지 않는다 — 홈을 그린다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 첫 받기를 늦게 기다리는 사이 판을 닫으면, 그 늦은 답이 와도 닫힌 판을 그리지 않고 타이머를 남기지 않는다. 다시 열면 그 답으로 기록이 다 온 판을 그린다(설계 주인 11-16 조건 1 · GPT 다시 검수 GA1 · 카본 A1)', async () => {
  const clock = fakeClock();
  let late = null;
  // 첫 물음은 시간 초과로 답해 판을 기록 일부로 그리게 하고, 늦게 기다리는 둘째 물음(SYNC_LATE_MS)은 손으로 푼다.
  const sync = accountLike(() => {
    const asked = sync.calls.length;
    if (asked === 1) return { ok: false, kind: 'timeout', code: 'PULL_TIMEOUT' };
    if (asked === 2)
      return new Promise(resolve => {
        late = resolve;
      });
    return { ok: false, kind: 'offline', code: 'NETWORK' };
  });
  const app = shell({ wrap: sync.wrap, timers: clock, panels: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="false"/.test(app.last()) && late, '기록 일부 판과 늦게 묻는 첫 받기');
    assert.deepEqual(sync.calls, [null, 60000], '시간 초과면 늦게 한 번 더 기다린다');
    app.closePanel();
    late({ ok: true });
    await tick(20);
    assert.equal(app.last(), '', '닫힌 판에 온 늦은 답으로는 판을 그리지 않는다');
    assert.deepEqual(clock.waits(), [], '타이머를 남기지 않는다');
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="true"/.test(app.last()), '다시 연 판은 그 된 답으로 기록이 다 온 판');
    assert.equal(sync.calls.length, 2, '된 답을 든 코치에는 다시 묻지 않는다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 화면에 듣는 곳은 홈 코치 하나다: 내 위치 판이 열려 있어도 알림 하나에 홈 한 번 · 판 한 번만 그리고, 첫 받기가 된 계정 판 · 손님 판에도 알림 전에 셸이 거는 타이머가 없다(설계 주인 11-16 오후 조건 3 · 4)', async () => {
  for (const [label, make] of [
    ['계정', () => accountLike(() => ({ ok: true }))],
    ['손님', () => heardLike()],
  ]) {
    const clock = fakeClock();
    const heard = make();
    const app = shell({ wrap: heard.wrap, timers: clock, panels: true });
    try {
      await app.education.position();
      await until(() => /data-position-next="engine"[^>]*data-complete="true"/.test(app.last()), `${label} — 기록이 다 온 판`);
      await tick(20);
      assert.deepEqual(clock.waits(), [], `${label} — 알림 전에는 타이머가 없다`);
      assert.equal(heard.listeners.size, 1, `${label} — 듣는 곳은 하나`);
      const at = { shown: app.shown.length, studied: app.studied() };
      heard.emit('refresh');
      clock.advance(0);
      assert.deepEqual({ shown: app.shown.length - at.shown, studied: app.studied() - at.studied }, { shown: 1, studied: 1 }, `${label} — 홈 한 번 · 판 한 번`);
    } finally {
      app.dispose();
    }
  }
});

test('엔진 판 — 받기 알림으로 다시 그릴 때 펴 둔 능력 줄을 다시 펴고, 스크롤 자리와 판 안의 초점(그 줄 안의 단추)을 지킨다(설계 주인 11-16 조건 3 · Fable 다시 검수 · §21-20)', async () => {
  let pulled = false;
  const clock = fakeClock();
  const sync = accountLike(() => ({ ok: false, kind: 'offline', code: 'NETWORK' }), { sync: () => ({ pulled }) });
  const app = shell({ wrap: sync.wrap, timers: clock, focusing: true });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="false"/.test(app.last()), '기록 일부 판');
    app.openRow('ko.reading.detail');
    app.focusOn('data-position-practice', 'ko.reading.detail');
    app.content.scrollTop = 420;
    app.focused.splice(0);
    pulled = true;
    sync.emit('receive');
    clock.advance(0);
    assert.match(app.last(), /data-complete="true"/, '받기 알림으로 다시 그렸다');
    assert.deepEqual(app.openRows(), ['ko.reading.detail'], '펴 둔 능력 줄을 다시 편다');
    assert.equal(app.content.scrollTop, 420, '스크롤 자리를 지킨다');
    assert.deepEqual(app.focused, ['data-position-practice=ko.reading.detail#0'], '초점이 펴 둔 줄 안의 같은 단추로 돌아온다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 다시 그릴 때의 초점: 같은 단추가 여럿이면 몇 번째였는지로 찾고, 능력 줄의 summary는 그 줄로, 다시 그린 판에 그 단추가 없으면 판 머리에 두며, 판 밖의 초점은 건드리지 않는다(설계 주인 11-16 조건 3)', async () => {
  // 진짜 판은 먼저 볼 항목(attention — 능력 줄 밖)과 그 능력 줄 안에 같은 능력의 연습 단추를 함께 낼 수 있다 — 판 글의 첫 능력 줄 앞에 그 단추를
  // 하나 더 둔다(차례로 줄 밖이 첫째, 줄 안이 둘째).
  const twice = html => {
    const at = html.indexOf('data-position-practice="ko.reading.detail"');
    const rows = html.indexOf('<details');
    if (at < 0 || rows < 0 || rows > at) return html;
    const start = html.lastIndexOf('<button', at);
    const end = html.indexOf('</button>', at) + '</button>'.length;
    return html.slice(0, rows) + html.slice(start, end) + html.slice(rows);
  };
  const app = shell({ focusing: true, paint: twice });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    // 시험 단추를 눌러 판을 다시 그린다(keepScroll — pulled의 다시 그리기와 같은 길). 누르기 전의 초점이 어디로 가는지 본다.
    const redraw = (place, exam = 'topik1') => {
      place();
      app.focused.splice(0);
      app.click('data-position-exam', exam);
      return [...app.focused];
    };
    assert.deepEqual(redraw(() => app.focusOn('data-position-practice', 'ko.reading.detail', 0)), ['data-position-practice=ko.reading.detail#0'], '능력 줄 밖의 첫째 단추');
    assert.deepEqual(
      redraw(() => {
        app.openRow('ko.reading.detail');
        app.focusOn('data-position-practice', 'ko.reading.detail', 1);
      }),
      ['data-position-practice=ko.reading.detail#1'],
      '같은 단추가 둘이면 두 번째(펴 둔 능력 줄 안)로 돌아온다',
    );
    assert.deepEqual(redraw(() => app.focusRoot()), ['root'], '판 머리에 있던 초점은 판 머리로');
    assert.deepEqual(redraw(() => app.focusSummary('ko.reading.detail')), ['summary=ko.reading.detail'], '능력 줄의 summary에 있던 초점은 그 줄의 summary로');
    assert.deepEqual(redraw(() => app.focusGone('data-position-recheck', 'ko.reading.gone')), ['root'], '다시 그린 판에 없는 단추면 판 머리');
    assert.deepEqual(redraw(() => app.focusOutside()), [], '판 밖의 초점은 건드리지 않는다');
    assert.deepEqual(redraw(() => app.focusOn('data-position-exam', 'topik2'), 'topik2'), ['data-position-exam=topik2#0'], '누른 시험 단추에 초점이 남는다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 진짜 계정 길 코치: 앞 문서가 요약을 받아 둔 기기에서 첫 받기가 끊긴 뒤 같은 요약으로 받기가 되면, 열린 판이 다시 그려져 기록 일부 줄이 사라진다(Fable 끝 판 F1 · 설계 주인 11-16 조건 4)', async () => {
  const { rng } = await import('../../../packages/atlas/test/support/seeds.mjs');
  const { createServer } = await import('../../../packages/atlas/test/support/trail-sync.mjs');
  const { subject } = await import('../../../packages/atlas/test/support/subject.mjs');
  const { acquireHost, releaseHost } = await subject('coach/host.mjs');
  const { PARAMS } = await subject('params.mjs');
  const banks = homeBanksOf(worldPosition.practice.pool);
  const mapData = { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS };
  const map = atlas.openMap(mapData);
  const server = createServer({ random: rng(331), index: { edition: map.editions.index, lookup: key => map.item(key) } });
  await server.fold();
  let offline = false;
  const transport = {
    post: (events, since) => server.post(events, since),
    async get(since) {
      if (offline) throw Object.assign(new Error('NETWORK'), { code: 'NETWORK', retryable: true });
      return { summary: await server.summary(since), serverTime: server.now };
    },
  };
  stores += 1;
  const key = `synk-atlas:position-shell-account-${process.pid}-${stores}`;
  const host = { guest: false, account: 'acct-shell', revision: 1, key, port: atlas.memoryPort(), transport };
  const accountCoach = async () => {
    const coach = atlas.createCoach({ gameId: 'world-home', mapData, dayOffset: 540, host });
    await coach.ready;
    return coach;
  };
  // 앞 문서가 서버 요약을 받아 둔 기기.
  const earlier = await accountCoach();
  assert.equal((await earlier.synced(2000)).ok, true);
  earlier.dispose();
  offline = true;
  const app = shell({ owner: 'acct-shell', open: accountCoach });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="false"/.test(app.last()), '첫 받기가 끊겨 기록 일부');
    // 다시 연결 — 코치가 받기를 다시 하고 같은 요약을 받는다(제품에서는 호스트의 online · 화면 복귀 받기). 요약이 그대로여도 처음 된 받기는 한 번
    // 알린다(receive) — 셸은 진짜 코치의 그 알림으로 다시 그린다(§21-20).
    offline = false;
    const handle = await acquireHost({ key, params: PARAMS, guest: false });
    await handle.pull({ force: true });
    releaseHost(handle);
    assert.equal(app.coaches[0].summary().storage.sync.pulled, true);
    assert.equal((await app.coaches[0].synced(500)).ok, false, 'synced()는 처음 실패 그대로');
    await until(() => /data-position-next="engine"[^>]*data-complete="true"/.test(app.last()), '다시 그린 판 — 기록 일부 줄이 없다', 8000);
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 첫 받기를 묻는 메서드(synced)가 없는 코치에서도 판을 한 번 그리고 다시 그리기를 되풀이하지 않는다(카본 끝 판 묶음 B)', async () => {
  const app = shell({
    wrap: made => {
      const { synced, ...rest } = made;
      return rest;
    },
  });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await tick(30);
    const drawn = app.shown.length;
    await tick(60);
    assert.equal(app.shown.length, drawn, '다시 그리기가 되풀이되지 않는다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 판을 다시 정하면(retired) 확인 중으로 다시 그리고, 새 코치가 서면 엔진 판으로 다시 그린다(닫힌 코치를 읽지 않는다) · 받기 알림은 옛 코치에서 되돌리고 새 코치에 건다(§21-20)', async () => {
  const heard = heardLike();
  const app = shell({ wrap: heard.wrap });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const first = app.coaches[0];
    assert.deepEqual(heard.sets.map(set => set.size), [1]);
    app.retire(first);
    assert.match(app.last(), /data-position-next="checking"/, '곧바로 확인 중');
    first.dispose();
    await until(() => /data-position-next="engine"/.test(app.last()), '새 코치의 엔진 판');
    assert.equal(app.coaches.length, 2, '판을 다시 정해 새 코치를 열었다');
    assert.deepEqual(heard.sets.map(set => set.size), [0, 1], '옛 코치의 듣기를 되돌리고 새 코치에 건다');
    await tick(20);
    const drawn = app.shown.length;
    heard.emit('refresh');
    await until(() => app.shown.length > drawn, '새 코치의 알림으로 다시 그린다');
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

// 진단 문항을 count개(없으면 끝까지) 답한다. 마지막 문항을 답하면 문항 판 글이 바뀌지 않는다(끝내기가 답의 저장을 기다린다) — 그때 멈춘다.
async function answerItems(app, count = Infinity) {
  let answered = 0;
  for (let guard = 0; guard < 80 && answered < count; guard += 1) {
    const html = app.box().html;
    if (html.includes('data-position-done')) break;
    const choice = /data-position-choice="([^"]+)"/.exec(html);
    if (!choice) {
      await tick(10);
      continue;
    }
    app.box().press('data-position-choice', choice[1]);
    answered += 1;
    if (app.box().html === html) break;
  }
  return answered;
}

// 홈 코치의 판 닫기를 센다(판 기록을 남기는가). more: 그 코치에 더 얹을 메서드(진짜 코치를 받는다).
function watchSets(more = () => ({})) {
  const sets = [];
  const wrap = made => ({
    ...made,
    finishSet(options) {
      const out = made.finishSet(options);
      sets.push({ record: options?.record !== false, setId: out?.setId ?? null });
      return out;
    },
    ...more(made),
  });
  return { wrap, sets };
}

test('엔진 판의 짧은 진단 — 도중에 그만두면 판을 기록 없이 닫아 손님 칸이 그 답으로 접히고, 열린 내 위치 판을 접힌 칸으로 다시 그린다(Fable 끝 판 F2)', async () => {
  const watch = watchSets();
  const app = shell({ wrap: watch.wrap });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const coach = app.coaches[0];
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    assert.equal(await answerItems(app, 1), 1);
    assert.match(app.box().html, /data-position-run/, '아직 문항이 남았다');
    await until(() => coach.summary().storage.unfolded > 0, '답이 남았다');
    app.box().press('data-position-stop');
    assert.deepEqual(
      watch.sets.map(set => set.record),
      [false],
      '판을 기록 없이 닫는다',
    );
    await until(() => coach.summary().storage.unfolded === 0, '그만둔 답이 손님 요약에 접힌다');
    await until(
      () => /data-position-next="engine"[^>]*data-unfolded="false"[^>]*data-catching="false"/.test(app.last()),
      '접힌 칸으로 다시 그린 판',
    );
  } finally {
    app.dispose();
  }
});

test('엔진 판의 짧은 진단 — 판이 열린 동안 온 받기 알림 셋은 그 자리에서 그리지 않고, 판을 닫으며 그리는 한 번에 다 비친다 — 알림이 그리기를 늘리지 않고 진단을 멈추지 않는다(§21-20 시험 5 · 조건 3)', async () => {
  const runs = [];
  for (const notify of [false, true]) {
    const heard = heardLike();
    const app = shell({ wrap: heard.wrap });
    try {
      await app.education.position();
      await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
      await app.education.position({ start: true });
      await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
      await tick(20);
      const open = { shown: app.shown.length, studied: app.studied() };
      if (notify) {
        heard.emit('receive');
        heard.emit('refresh');
        heard.emit('receive');
      }
      await tick(30);
      assert.deepEqual({ shown: app.shown.length, studied: app.studied() }, open, '판이 열린 동안은 홈도 판도 그리지 않는다');
      assert.equal(await answerItems(app, 1), 1, '진단은 그대로 이어진다(셸이 판 자원을 건드리지 않는다)');
      assert.match(app.box().html, /data-position-run/, '아직 문항이 남았다');
      const before = { shown: app.shown.length, studied: app.studied() };
      app.box().press('data-position-stop');
      await until(
        () => /data-position-next="engine"[^>]*data-unfolded="false"[^>]*data-catching="false"/.test(app.last()),
        '판을 닫고 접힌 칸으로 다시 그린 내 위치',
      );
      await tick(40);
      runs.push({ shown: app.shown.length - before.shown, studied: app.studied() - before.studied });
    } finally {
      app.dispose();
    }
  }
  assert.deepEqual(runs[1], runs[0], '판을 닫으며 그리는 만큼에서 알림 셋이 한 번도 더하지 않는다');
});

test('엔진 판의 짧은 진단 — 끝 화면이 답의 저장을 기다리는 사이 판이 닫히면 판을 기록 없이 닫고 끝 화면을 그리지 않는다(Fable 끝 판 F2)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  // 답의 저장(evidence)이 끝나는 때를 시험이 정한다 — 진짜 저장을 기다린 뒤 풀린다.
  const watch = watchSets(made => ({
    answer(pid, result) {
      const out = made.answer(pid, result);
      return { ...out, evidence: hold.then(() => out.evidence) };
    },
  }));
  const app = shell({ wrap: watch.wrap });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const coach = app.coaches[0];
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    assert.ok((await answerItems(app)) > 0);
    await tick(30);
    assert.deepEqual(watch.sets, [], '끝내기가 저장을 기다린다 — 판은 아직 닫지 않았다');
    app.box().isConnected = false;
    release();
    await until(() => watch.sets.length > 0, '판을 닫는다');
    assert.deepEqual(
      watch.sets.map(set => set.record),
      [false],
      '판 기록 없이 닫기만 한다',
    );
    assert.doesNotMatch(app.box().html, /data-position-done/, '닫힌 판에 끝 화면을 그리지 않는다');
    await until(() => coach.summary().storage.unfolded === 0, '그 답이 손님 요약에 접힌다');
  } finally {
    release();
    app.dispose();
  }
});

test('엔진 판의 짧은 진단 — 손님 끝 화면은 판이 그 답으로 다시 접힌 뒤에 짓는다(21-3 판 끝 칸 견주기 · Fable 끝 판 F3)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  const closed = [];
  const app = shell({
    wrap: made => ({
      ...made,
      // 접기가 끝나는 때를 시험이 정한다 — 진짜 접기를 기다린 뒤 풀린다.
      finishSet(options) {
        const out = made.finishSet(options);
        closed.push(options);
        return { ...out, folded: hold.then(() => out.folded) };
      },
    }),
  });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const coach = app.coaches[0];
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    await answerItems(app);
    await until(() => closed.length === 1, '판을 닫는다');
    await tick(50);
    assert.doesNotMatch(app.box().html, /data-position-done/, '접기가 끝나기 전에는 끝 화면을 짓지 않는다');
    release();
    await until(() => app.box().html.includes('data-position-done'), '접힌 뒤의 끝 화면');
    assert.equal(coach.summary().storage.unfolded, 0, '끝 화면은 그 답이 다 접힌 칸으로 지었다');
  } finally {
    release();
    app.dispose();
  }
});

test('엔진 판의 짧은 진단 — 서버 길 계정의 끝 화면은 접기를 기다리지 않는다(서버가 접는다 — 문항 줄은 답의 evidence로 그린다, Fable 끝 판 F3)', async () => {
  const sync = accountLike([]);
  const closed = [];
  const app = shell({
    wrap: made => ({
      ...sync.wrap(made),
      // 접기가 끝나지 않는 코치 — 기다리면 끝 화면이 서지 않는다.
      finishSet(options) {
        const out = made.finishSet(options);
        closed.push(options);
        return { ...out, folded: new Promise(() => {}) };
      },
    }),
  });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"[^>]*data-complete="true"/.test(app.last()), '기록이 다 온 엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    await answerItems(app);
    await until(() => app.box().html.includes('data-position-done'), '끝 화면', 2000);
    assert.equal(closed.length, 1, '판은 닫았다');
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

// 30일째 문장(4-4c — 단계4_계획 §21-7). 코치(손님 · 동의를 끈 계정 — coach.lookback)가 낸 단위마다의 수에서 셸이 이름이 서는 단위 하나를 골라
// (다시 확인 카드와 같은 이름 길 — unitRoutes) 엔진의 Vellum 문장으로 판 맨 위에 한 줄을 싣는다. 문장이 없으면(그 화면 언어의 줄이 없음 · 서버 길
// 계정 · 코치가 못 셈) 줄 없이 판을 그린다. 코치의 셈 자체는 packages/atlas/test/coach/lookback.test.mjs가 본다.
const htmlText = value =>
  String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function monthShell({ lookback, say = null } = {}) {
  const seen = { named: null };
  const wrap = made => {
    for (const item of worldPosition.practice.pool) {
      const row = made.itemUnits(item).find(unit => unit.kind !== 'family' && unit.label);
      if (row) {
        seen.named = row;
        break;
      }
    }
    return { ...made, lookback: () => lookback(seen.named) };
  };
  const label = id => (id === seen.named?.unit ? seen.named.label : null);
  const planner = { ...PLANNER, say: say ?? ((why, lang) => atlas.renderReason(why, { lang, label })) };
  return { app: shell({ wrap, planner }), seen };
}

test('엔진 판 — 30일째 문장: 이름이 서는 단위 하나를 골라 판 맨 위에 엔진의 문장으로 한 줄을 싣는다(4-4c — 21-7)', async () => {
  const { app, seen } = monthShell({
    lookback: named => ({
      windows: {},
      month: [
        // 이름이 서지 않는 단위 — 수가 커도 고르지 않는다(카본 설계 검토 A11)
        { unit: 'ko.word.zz-nameless', misses: 9, reviews: 9, last: 1, evidence: {} },
        { unit: named.unit, misses: 3, reviews: 7, last: 1, evidence: {} },
      ],
    }),
  });
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    const html = app.last();
    const text = `한 달 전에 3번 놓친 「${seen.named.label}」, 그 뒤로 7번 모두 혼자 맞혔어요.`;
    assert.ok(
      html.includes(`<p class="wpos-month" data-position-month data-unit="${htmlText(seen.named.unit)}" data-misses="3" data-reviews="7">${htmlText(text)}</p>`),
      '고른 단위의 문장 한 줄',
    );
    assert.ok(html.indexOf('data-position-month') < html.indexOf('wpos-counts'), '판 맨 위(머리 그림 바로 뒤)');
    assert.ok(!html.includes('zz-nameless'), '이름이 서지 않는 단위는 고르지 않는다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 30일째 문장이 없으면(서버 길 계정 null · 고를 단위 없음 · 그 화면 언어의 줄 없음 · 코치가 못 셈) 줄 없이 판을 그린다', async () => {
  const cases = [
    ['서버 길 계정(코치가 null)', { lookback: () => null }],
    ['고를 단위 없음', { lookback: () => ({ windows: {}, month: [] }) }],
    ['그 화면 언어의 줄 없음', { lookback: named => ({ windows: {}, month: [{ unit: named.unit, misses: 3, reviews: 7 }] }), say: () => null }],
    [
      '코치가 못 셈',
      {
        lookback: () => {
          throw new Error('closed');
        },
      },
    ],
  ];
  for (const [name, options] of cases) {
    const { app } = monthShell(options);
    try {
      await app.education.position();
      await until(() => /data-position-next="engine"/.test(app.last()), `엔진 판(${name})`);
      assert.ok(!app.last().includes('data-position-month'), name);
    } finally {
      app.dispose();
    }
  }
});

// 30일째 문장의 계정 길(4-4c 둘째 묶음 — 단계4_계획 §21-22). 서버 길 계정은 코치가 null을 내므로, 셸이 그 코치를 연 판의 돌아보기 읽기
// (homeNext.lookback)로 묻고 학습일 답을 쓴다. 묻기 · 받기 · 다시 그리기의 상한은 qa/atlas-next-month-answer.test.mjs가 진짜 엔진 코치와 리허설
// 서버로 센다. 여기서는 셸의 배선만 본다 — 첫 그리기는 묻고 문장 없이 그린다. 같은 자리의 답이 오면 열린 판을 한 번 다시 그려 문장을 싣는다.
// 완결되지 않은 답이면 다시 그리지 않고 까닭을 계기(load)에 남긴다. 답은 잡아 두었다가 셸이 가라앉은 뒤 푼다(첫 받기 뒤 셸이 스스로 한 번 더
// 그리므로, 그 뒤의 그리기만 답이 부른 것이다).
const RECEIVED = { edition: 'e-acct', gen: '1794441600000.aaaaaaaa', foldedUntil: 12 };
function accountMonthShell(reply) {
  let release = null;
  const held = new Promise(resolve => {
    release = resolve;
  });
  const seen = { named: null, asks: 0, offset: null, notes: [], release: () => release() };
  const like = accountLike(() => ({ ok: true }), { sync: () => ({ pulled: true, received: RECEIVED }) });
  const wrap = made => {
    for (const item of worldPosition.practice.pool) {
      const row = made.itemUnits(item).find(unit => unit.kind !== 'family' && unit.label);
      if (row) {
        seen.named = row;
        break;
      }
    }
    return { ...like.wrap(made), lookback: () => null, pull: () => null };
  };
  const label = id => (id === seen.named?.unit ? seen.named.label : null);
  const planner = { ...PLANNER, say: (why, lang) => atlas.renderReason(why, { lang, label }) };
  const nextExtra = {
    lookback: () => ({
      revision: 3,
      ask: async offset => {
        seen.asks += 1;
        seen.offset = offset;
        await held;
        return reply(seen.named);
      },
    }),
    note: (kind, outcome) => seen.notes.push([kind, outcome]),
  };
  return { app: shell({ owner: 'acct-month', wrap, planner, nextExtra }), seen };
}
const WINDOWS_ANY = { monthAgo: { from: 1, to: 2 }, since: { from: 2, to: 3 }, last7: { from: 2.5, to: 3 } };

test('엔진 판 — 서버 길 계정의 30일째 문장: 첫 그리기는 묻고 문장 없이, 같은 자리의 답이 오면 열린 판을 한 번 다시 그려 그 문장을 싣는다(4-4c 둘째 묶음 — §21-22)', async () => {
  const { app, seen } = accountMonthShell(named => ({
    ok: true,
    complete: true,
    summaryAt: RECEIVED,
    lookback: { windows: WINDOWS_ANY, month: [{ unit: named.unit, misses: 3, reviews: 7, last: 2.9 }] },
  }));
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await until(() => seen.asks === 1, '묻는다');
    await tick(80);
    assert.ok(!app.last().includes('data-position-month'), '답이 오기 전 — 문장 없이');
    const drawn = app.shown.length;
    seen.release();
    await until(() => app.last().includes('data-position-month'), '답이 오면 문장');
    const text = `한 달 전에 3번 놓친 「${seen.named.label}」, 그 뒤로 7번 모두 혼자 맞혔어요.`;
    assert.ok(app.last().includes(htmlText(text)), '학습일 답의 문장');
    assert.equal(seen.offset, -new Date().getTimezoneOffset(), '기기의 현지 시각 − UTC(분)');
    await tick(40);
    assert.equal(app.shown.length, drawn + 1, '열린 판을 한 번 다시 그리고 되풀이하지 않는다');
    assert.equal(seen.asks, 1, '한 번 묻는다');
  } finally {
    app.dispose();
  }
});

test('엔진 판 — 서버 길 계정의 30일째 문장: 완결되지 않은 답이면 판을 다시 그리지 않고 까닭을 계기에 남긴다(4-4c 둘째 묶음 — §21-22)', async () => {
  const { app, seen } = accountMonthShell(() => ({ ok: true, complete: false, reason: 'rebuilding', summaryAt: RECEIVED, lookback: { windows: WINDOWS_ANY } }));
  try {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await until(() => seen.asks === 1, '묻는다');
    await tick(80);
    const drawn = app.shown.length;
    seen.release();
    await until(() => seen.notes.length === 1, '물은 답');
    await tick(40);
    assert.equal(app.shown.length, drawn, '완결되지 않은 답으로는 다시 그리지 않는다');
    assert.ok(!app.last().includes('data-position-month'));
    assert.deepEqual(seen.notes, [['load', { ok: false, code: 'LOOKBACK_REBUILDING' }]], '까닭을 계기에');
  } finally {
    app.dispose();
  }
});
