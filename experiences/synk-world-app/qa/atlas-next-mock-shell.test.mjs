// 4-4d 시험 형식 연습 새 판의 셸 배선(단계4_계획 §21-23의 1 · 5) — world-learning-ui.mjs openMock의 판 셋 검사(지금 판 · 확인 중 · 엔진)와
// 새 길 연습(openMockNext · runMockNext). 여는 곳 넷(알림 시트 · 홈 줄 · 내 위치 단추 · 이번 주 계획 단추)은 모두 education.mock(openMock)을 지난다.
// 새 길 문서는 어느 길로도 옛 코치 'world-mock'을 열지 않는다. 진짜 엔진 코치(손님 메모리 저장소) · 진짜 지도 조각 · 진짜 홈 플래너로 돌리고,
// 홈 코치와 시험 형식 코치는 앱처럼 같은 저장소 열쇠로 연다. 셸 판은 글(HTML)만 본다(qa/atlas-next-plan-shell.test.mjs와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { banksOf, homeBanksOf, planPlanner, positionPlanner } from '../world-atlas-next.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from '../world-today.mjs';
import { todayPractice } from '../world-mock-next.mjs';
import { createPlanLog } from '../world-plan-next.mjs';
import { memoryStorage } from './storage-scenes.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';

// 변형 시험은 깬 셸 사본을 SYNK_LEARNING_UI_MODULE로 넘긴다. 그 밖에는 원본이다.
const { createWorldEducation } = await import(
  process.env.SYNK_LEARNING_UI_MODULE ? pathToFileURL(process.env.SYNK_LEARNING_UI_MODULE).href : '../world-learning-ui.mjs'
);

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const PLANNER = Object.freeze({ createWorldTodayPlan, watchHomePlan, todayKey, say: () => '', position: positionPlanner, plan: planPlanner });
const EXAM_T1 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2, examDate: '2027-04-18', weeklyMinutes: 120 };
const ko = key => STRINGS[key].ko;
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, ms = 8000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error(`기다림이 넘쳤다: ${label}`);
    await tick(10);
  }
}

let stores = 0;
// 판 상자: innerHTML 글을 들고 단추 누르기(위임 click)와 판 안 단추의 click(querySelector로 건 것)을 흉내 낸다.
function stage() {
  const clicks = [];
  const handlers = new Map();
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
    querySelector: selector => ({
      focus() {},
      addEventListener(type, fn) {
        if (type === 'click') handlers.set(selector, fn);
      },
    }),
  };
  box.press = (attr, value = '') => {
    const camel = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const button = { dataset: { [camel]: value }, disabled: false, hasAttribute: name => name === attr };
    for (const fn of [...clicks]) fn({ target: { closest: selector => (selector === 'button' ? button : null) } });
  };
  box.tap = selector => {
    const fn = handlers.get(selector);
    assert.ok(fn, `${selector} 단추가 있다`);
    handlers.delete(selector);
    fn();
  };
  return box;
}

// 셸 하나 — life: 생활 판정의 판('engine' · 'old'). planner: 입구가 플래너를 주는 때(끝내 주지 않으면 확인 중에 머문다). fast: 창의 시계를 30ms로.
// wrap: 홈 코치에 얹을 것(만남 · 요약을 바꿔 열 수 없는 날을 흉내 낸다).
// mockWrap — 시험 형식 코치(world-mock)만 감싼다(저장 · 접기를 시험이 붙잡는 장면). wrap은 홈 코치를 감싼다.
function shell({ values = { audio: 'off', ...EXAM_T1 }, life = 'engine', planner = async () => PLANNER, fast = false, wrap = made => made, mockWrap = made => made, mockChanged = null } = {}) {
  stores += 1;
  const key = `synk-atlas:mock-shell-${process.pid}-${stores}`;
  const port = atlas.memoryPort();
  const openCoach = async (gameId, banks) => {
    const coach = atlas.createCoach({
      gameId,
      mapData: { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS },
      dayOffset: 540,
      host: { guest: true, port, key },
    });
    await coach.ready;
    return coach;
  };
  const opens = [];
  const toasts = [];
  const shown = [];
  // 이 기기의 판 기록(4-4d — 점검 칸의 시험 형식 줄) — 앱처럼 그 코치의 저장소 이름으로 연다(같은 저장소의 코치는 같은 기록).
  const logStorage = memoryStorage();
  const planLog = made => (made ? createPlanLog({ storage: logStorage, store: key }) : null);
  const coaches = [];
  const mockCalls = [];
  const retirers = [];
  const resources = [];
  let box = null;
  const storage = new Map();
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
  const node = () => ({
    isConnected: true,
    focus() {},
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    contains: () => false,
    addEventListener() {},
    insertAdjacentHTML() {},
  });
  const document = {
    visibilityState: 'visible',
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) {
      const html = shown.at(-1) ?? '';
      for (const stageName of ['data-mock-stage', 'data-position-stage'])
        if (selector.includes(`[${stageName}]`)) return box && html.includes(stageName) ? box : null;
      const found = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(selector);
      if (!found) return null;
      const [, name, value] = found;
      const hit = value === undefined ? new RegExp(`\\s${name}(?=[\\s=>])`).test(html) : html.includes(`${name}="${value}"`);
      return hit ? node() : null;
    },
  };
  const target = {
    localStorage: { getItem: name => storage.get(name) ?? null, setItem: (name, value) => storage.set(name, String(value)), removeItem: name => storage.delete(name) },
    document,
    addEventListener() {},
    removeEventListener() {},
    setTimeout: fast ? (fn, ms) => setTimeout(fn, Math.min(ms, 30)) : setTimeout,
  };
  const state = { values, panel: null };
  const progress = {
    owner: 'guest',
    learningProfile: () => ({ profile: { status: 'active', revision: 1, consent: true } }),
    learningProfileValues: () => state.values,
    status: () => ({ phase: 'synced', rejected: false, scoped: false, message: '' }),
    exportSnapshot: () => ({}),
    summary: () => ({ nextLesson: null, resume: false }),
    flush: async () => {},
    hangulReading: () => ({ answer: 'reads' }),
  };
  const home = {
    updateStudy() {},
    toast(text) {
      toasts.push(String(text));
    },
    closePanel() {},
    // 판 자원(판을 닫으면 부르는 정리) — 진짜 홈처럼 다음 판을 열거나 셸을 닫을 때 부른다(연습의 영역 시계가 남지 않게).
    attachPanelResource(resource) {
      resources.push(resource);
    },
    openPanel: () => state.panel,
    showPanel(title, html) {
      shown.push(String(html));
      if (/data-(mock|position)-stage/.test(html)) box = stage();
    },
  };
  const homeNext = {
    async coach() {
      const made = wrap(await openCoach('world-home', homeBanksOf(worldPosition.practice.pool)));
      coaches.push(made);
      return made;
    },
    planner,
    retired: () => () => {},
    life: () => life,
    ask: async () => {},
    judge: () => ({ state: life === 'engine' ? 'engine' : 'old', items: [], ids: [], times: [], upcoming: [], stuck: [] }),
    answers: () => null,
    openGames: () => null,
    packs() {},
    painted() {},
    planLog,
  };
  // 입구의 겉 — 시험 형식 코치(같은 저장소의 world-mock)와 판을 다시 정할 때 부를 함수만.
  const atlasNext = {
    async mockCoach(pool) {
      mockCalls.push(pool.length);
      const made = mockWrap(await openCoach('world-mock', banksOf(pool)));
      coaches.push(made);
      return made;
    },
    retired(coach, fn) {
      const row = { coach, fn, live: true };
      retirers.push(row);
      return () => {
        row.live = false;
      };
    },
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
    atlasNext,
    ...(mockChanged ? { mockChanged } : {}),
  });
  return {
    education,
    opens,
    toasts,
    shown,
    state,
    mockCalls,
    box: () => box,
    last: () => shown.at(-1) ?? '',
    homeCoach: () => coaches[0] ?? null,
    planTimes: area => planLog(true).times(area),
    retire() {
      for (const row of retirers.filter(entry => entry.live)) row.fn({ reason: 'account' });
    },
    dispose() {
      for (const resource of resources.splice(0))
        try {
          resource?.dispose?.();
        } catch {
          // 닫힌 판의 정리는 다음 정리를 막지 않는다
        }
      education.dispose();
      for (const made of coaches) made.dispose();
    },
  };
}

// 시험 형식 판을 끝까지 푼다(소리를 끈 날 — 읽기만). wrong: 틀린 보기를 고른다. 끝 한 장이 서면 참. submitted: 마지막 영역을 낸 데서 멈춘다 — 낸 뒤
// 판이 그대로면(다음 영역도 끝 한 장도 아님) 끝 한 장이 저장이나 접기를 기다리는 중이라 참.
async function runToEnd(app, { wrong = false, submitted = false } = {}) {
  for (let guard = 0; guard < 400; guard += 1) {
    const html = app.box().html;
    if (html.includes('data-mock-done')) return true;
    if (html.includes('data-mock-between')) {
      app.box().press('data-mock-next-section');
      await tick(0);
      continue;
    }
    if (!html.includes('data-mock-run')) {
      await tick(10);
      continue;
    }
    const marks = [...html.matchAll(/data-mock-go="(\d+)" data-mark="(\w+)"( aria-current="step")?/g)].map(match => ({
      index: Number(match[1]),
      mark: match[2],
      current: Boolean(match[3]),
    }));
    const current = marks.find(row => row.current);
    const choices = [...html.matchAll(/data-mock-choice="([^"]+)"([^>]*)>/g)].filter(match => !/disabled/.test(match[2])).map(match => match[1]);
    if (current && current.mark !== 'answered' && choices.length) {
      const run = /data-mock-run="([^"]+)"/.exec(html)[1];
      const item = worldPosition.mock.pool.find(row => row.id === run);
      const pick = wrong ? choices.find(id => id !== item.correctId) : item.correctId;
      app.box().press('data-mock-choice', pick);
      continue;
    }
    const open = marks.find(row => row.mark !== 'answered');
    if (open) {
      app.box().press('data-mock-go', String(open.index));
      continue;
    }
    app.box().press('data-mock-submit');
    await tick(10);
    if (submitted && app.box().html === html) return true;
  }
  return false;
}

test('지금 판 문서 — openMock은 지금 판 연습을 그대로 연다(옛 코치 world-mock) · 새 길 코치를 받지 않는다', async () => {
  const app = shell({ life: 'old' });
  try {
    await app.education.mock();
    assert.ok(app.opens.includes('world-mock'), '지금 판 코치');
    assert.equal(app.mockCalls.length, 0, '새 길 코치를 받지 않는다');
    assert.match(app.last(), /data-mock-stage/);
    assert.match(app.box().html, /data-mock-intro/, '지금 판 안내 한 장');
  } finally {
    app.dispose();
  }
});

test('확인 중 문서 — 판이 설 때까지 한도 안에서 기다린 뒤 「확인 중」으로 알리고, 옛 코치를 열지 않는다(§21-23의 1)', async () => {
  const app = shell({ planner: () => new Promise(() => {}), fast: true });
  try {
    await app.education.mock();
    assert.ok(app.toasts.includes(ko('homeTutor.checking')), '확인 중이라고 알린다');
    assert.ok(!app.opens.includes('world-mock'), '옛 코치를 열지 않는다');
    assert.equal(app.mockCalls.length, 0);
    assert.ok(!app.shown.some(html => /data-mock-stage/.test(html)), '연습 판을 열지 않는다');
  } finally {
    app.dispose();
  }
});

test('엔진 문서 — 새 코치(world-mock)로 안내 · 영역 · 끝 한 장까지 가고, 옛 코치를 열지 않는다 · 끝 한 장의 「다음 연습」은 그날 낼 것이 있는 연습만이다', async () => {
  const app = shell();
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    assert.equal(app.mockCalls.length, 1, '새 길 코치를 한 번 받는다');
    assert.match(app.box().html, /data-mock-intro/, '안내 한 장');
    app.box().tap('[data-mock-start]');
    assert.match(app.box().html, /data-mock-run/, '첫 문항');
    assert.equal(await runToEnd(app, { wrong: true }), true, '끝 한 장');
    assert.ok(!app.opens.includes('world-mock'), '새 길 문서는 옛 코치 world-mock을 열지 않는다');
    const homeCoach = app.homeCoach();
    assert.equal(homeCoach.summary().storage.unfolded, 0, '판을 닫아 손님 요약이 그 답으로 접혔다');
    const links = [...app.box().html.matchAll(/data-position-practice="([^"]+)"/g)].map(match => match[1]);
    const routes = todayPractice({ coach: homeCoach, pool: worldPosition.practice.pool, audioAvailable: false });
    assert.ok(links.length > 0, '틀린 항목의 연습을 잇는다(홈 코치로 센 그날의 연습)');
    assert.ok(links.every(id => routes.has(id)), `잇는 연습(${links.join(', ')})은 그날 낼 것이 있는 연습뿐`);
  } finally {
    app.dispose();
  }
});

test('엔진 문서 — 끝 한 장이 답의 저장을 기다리는 사이 판이 닫히면 판을 기록 없이 닫고 끝 한 장을 그리지 않는다(진단 Fable 끝 판 F2와 같은 막이)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  const sets = [];
  // 답의 저장(evidence)이 끝나는 때를 시험이 정한다 — 진짜 저장을 기다린 뒤 풀린다.
  const app = shell({
    mockWrap: made => ({
      ...made,
      answer(pid, result) {
        const out = made.answer(pid, result);
        return { ...out, evidence: hold.then(() => out?.evidence) };
      },
      finishSet(options) {
        sets.push(options);
        return made.finishSet(options);
      },
    }),
  });
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    app.box().tap('[data-mock-start]');
    assert.equal(await runToEnd(app, { submitted: true }), true, '마지막 영역을 냈다');
    await tick(30);
    assert.deepEqual(sets, [], '끝내기가 저장을 기다린다 — 판은 아직 닫지 않았다');
    app.box().isConnected = false;
    release();
    await until(() => sets.length > 0, '판을 닫는다');
    assert.deepEqual(
      sets.map(options => options.record),
      [false],
      '판 기록 없이 닫기만 한다',
    );
    assert.doesNotMatch(app.box().html, /data-mock-done/, '닫힌 판에 끝 한 장을 그리지 않는다');
    await until(() => app.homeCoach().summary().storage.unfolded === 0, '그 답이 손님 요약에 접힌다');
  } finally {
    release();
    app.dispose();
  }
});

test('엔진 문서 — 손님 끝 한 장은 판이 그 답으로 다시 접힌 뒤에 짓는다(진단 Fable 끝 판 F3와 같은 막이)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  const sets = [];
  // 접기가 끝나는 때를 시험이 정한다 — 진짜 접기를 기다린 뒤 풀린다.
  const app = shell({
    mockWrap: made => ({
      ...made,
      finishSet(options) {
        const out = made.finishSet(options);
        sets.push(options);
        return out && { ...out, folded: hold.then(() => out.folded) };
      },
    }),
  });
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    app.box().tap('[data-mock-start]');
    assert.equal(await runToEnd(app, { submitted: true }), true, '마지막 영역을 냈다');
    await until(() => sets.length === 1, '판을 닫는다');
    await tick(50);
    assert.doesNotMatch(app.box().html, /data-mock-done/, '접기가 끝나기 전에는 끝 한 장을 짓지 않는다');
    release();
    await until(() => app.box().html.includes('data-mock-done'), '접힌 뒤의 끝 한 장');
    assert.equal(app.homeCoach().summary().storage.unfolded, 0, '끝 한 장은 그 답이 다 접힌 칸으로 지었다');
  } finally {
    release();
    app.dispose();
  }
});

test('엔진 문서 — 처음 보는 문항이 모자라면 시험 형식 코치를 열지 않고 알린 뒤 내 위치로 간다 · 기록이 다 오지 않았으면 그 까닭으로 알린다', async () => {
  const short = shell({ wrap: made => ({ ...made, exposures: items => items.map(() => ({ seen: true, met: true })) }) });
  try {
    await until(() => short.homeCoach(), '홈 코치');
    await short.education.mock();
    assert.ok(short.toasts.includes(ko('mock.unavailable')));
    assert.equal(short.mockCalls.length, 0, '열 수 없는 날에는 시험 형식 코치를 받지 않는다');
    await until(() => /data-position-next/.test(short.last()), '내 위치 판');
  } finally {
    short.dispose();
  }
  const partial = shell({
    wrap: made =>
      ({
        ...made,
        // 서버 길 계정의 기록부처럼 — 이 문서에서 받기가 되지 않았다(첫 받기가 오프라인으로 끝남 · 뒤의 받기도 없음).
        summary: () => ({ ...made.summary(), storage: { ...made.summary().storage, guest: false, sync: {} } }),
        synced: async () => ({ ok: false, kind: 'offline', base: true }),
      }),
  });
  try {
    await until(() => partial.homeCoach(), '홈 코치');
    await partial.education.mock();
    assert.ok(partial.toasts.includes(ko('position.diagnostic.history')), `기록이 다 오지 않았다 — ${partial.toasts.join(' | ')}`);
    assert.equal(partial.mockCalls.length, 0);
    await until(() => /data-position-next/.test(partial.last()), '내 위치 판');
  } finally {
    partial.dispose();
  }
});

test('엔진 문서 — 연습 도중 판을 다시 정해 코치가 닫히면 안내 한 줄과 함께 닫고 내 위치로 간다', async () => {
  const app = shell();
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    app.box().tap('[data-mock-start]');
    const html = app.box().html;
    app.retire();
    assert.ok(app.toasts.includes(ko('practice.next.changed')));
    await until(() => /data-position-next/.test(app.last()), '내 위치 판');
    // 닫힌 판의 단추는 더 남기지 않는다.
    const choice = /data-mock-choice="([^"]+)"/.exec(html)[1];
    app.box().press('data-mock-choice', choice);
  } finally {
    app.dispose();
  }
});

test('확인 중에 연 시험 형식은 기다린 사이 학생이 다른 판을 열었으면 덮지 않는다(이번 주 계획과 같은 막이 — 4-4b 다시 검수 Fable FA2)', async () => {
  // 판이 끝내 서지 않는다 — 한도가 지나도 학생이 연 다른 판 위에 「확인 중」 알림을 띄우지 않는다.
  const stuck = shell({ planner: () => new Promise(() => {}), fast: true });
  try {
    const opening = stuck.education.mock();
    await tick(5);
    stuck.state.panel = 'life-review';
    await opening;
    assert.ok(!stuck.toasts.includes(ko('homeTutor.checking')), '다른 판을 연 학생에게는 알리지 않는다');
    assert.ok(!stuck.shown.some(html => /data-mock-stage/.test(html)));
  } finally {
    stuck.dispose();
  }
  // 판이 선다 — 그 사이 연 다른 판을 덮지 않는다.
  let release = null;
  const app = shell({ planner: () => new Promise(resolve => (release = () => resolve(PLANNER))) });
  try {
    const opening = app.education.mock();
    await tick(20);
    app.state.panel = 'life-review';
    release();
    await opening;
    assert.ok(!app.shown.some(html => /data-mock-stage/.test(html)), '연습 판을 그리지 않는다');
    assert.equal(app.mockCalls.length, 0);
  } finally {
    app.dispose();
  }
});

test('알림 시트의 판정(mockReady) — 지금 판은 참, 확인 중은 거짓, 엔진은 고르기가 설 때만 참이고 시험 형식 코치를 만들지 않는다 · 홈을 다시 그릴 때마다 앱에 알린다(§21-23의 5)', async () => {
  const old = shell({ life: 'old' });
  try {
    assert.equal(old.education.mockReady(), true, '지금 판은 지금처럼(열 수 없으면 openMock이 알린다)');
  } finally {
    old.dispose();
  }
  const checking = shell({ planner: () => new Promise(() => {}) });
  try {
    assert.equal(checking.education.mockReady(), false, '확인 중');
  } finally {
    checking.dispose();
  }
  let told = 0;
  const app = shell({ mockChanged: () => (told += 1) });
  try {
    app.education.refresh();
    await until(() => app.education.metrics().plan?.today?.state === 'engine', '엔진 판');
    assert.ok(told > 0, '홈을 다시 그리면 앱에 알린다');
    assert.equal(app.education.mockReady(), true, '처음 보는 문항이 있고 기록이 다 왔다');
    assert.equal(app.mockCalls.length, 0, '판정은 시험 형식 코치를 만들지 않는다');
  } finally {
    app.dispose();
  }
  const short = shell({ wrap: made => ({ ...made, exposures: items => items.map(() => ({ seen: true, met: true })) }) });
  try {
    short.education.refresh();
    await until(() => short.education.metrics().plan?.today?.state === 'engine', '엔진 판');
    assert.equal(short.education.mockReady(), false, '처음 보는 문항이 모자라면 거짓');
  } finally {
    short.dispose();
  }
});

// 앱(app-shell.mjs)은 node에서 못 올려 원문을 본다 — 셸 시험 틀은 입구 칸을 손으로 짓기 때문이다(현장 노트 「셸 시험 틀이 입구 칸을 직접 넣으면」).
// 변형 시험은 깬 앱 원문을 SYNK_APP_SHELL_SOURCE로 넘긴다.
test('앱의 배선 — 시험 점검 카드의 판정은 셸의 mockReady이고, 두 단추는 그린 때 고른 대상을 그대로 열며, 홈을 다시 그리면 열린 카드를 맞춘다 · 입구 감싸기가 시험 형식 코치를 잇는다(§21-23의 1 · 5)', () => {
  const source = fs.readFileSync(process.env.SYNK_APP_SHELL_SOURCE ?? new URL('../app-shell.mjs', import.meta.url), 'utf8');
  assert.match(source, /canMock:\(\)=>typeof education\?\.mockReady==='function'\?education\.mockReady\(\)===true:typeof education\?\.mock==='function',panel:\(\)=>home\.openPanel\?\.\(\)\?\?null,/);
  assert.match(source, /if\(kind==='exam-mock'\)return run\(\(\)=>life\.education\?\.mock\?\.\(\)\);/);
  assert.match(source, /if\(kind==='exam-start'\)return run\(\(\)=>life\.education\?\.position\?\.\(\{start:true\}\)\);/);
  assert.doesNotMatch(source, /kind==='exam-start'[^\n]*education\?\.mock/, '누른 때 다시 고르지 않는다');
  assert.match(source, /'reminder-exam-start','reminder-exam-mock','reminder-exam-plan'/, '시험 형식 단추의 명령');
  assert.match(source, /\n  mockChanged:\(\)=>reminders\?\.examChanged\?\.\(\),\r?\n/);
  assert.match(source, /async mockCoach\(pool\)\{if\(disposed\)return null;const entry=await load\(\);return disposed\?null:entry\.mockCoach\(pool\);\},/);
});

test('그만둔 시험 형식 판도 이 기기의 판 기록에 한 판으로 적힌다 — 문항을 처음 낸 때 한 번(설계 다시 검수 Opus 대체 FA2 · 설계 주인 11-17 답 3)', async () => {
  const app = shell();
  try {
    await until(() => app.homeCoach(), '홈 코치');
    await app.education.mock();
    assert.match(app.box().html, /data-mock-intro/, '안내 한 장');
    assert.equal(app.planTimes('mock').length, 0, '안내 한 장에서는 적지 않는다(아직 문항을 내지 않았다)');
    app.box().tap('[data-mock-start]');
    assert.match(app.box().html, /data-mock-run/, '첫 문항');
    assert.equal(app.planTimes('mock').length, 1, '문항을 처음 낸 때 한 판');
    // 답하면 판을 다시 그린다 — 다시 그려도 한 판이다
    const choice = /data-mock-choice="([^"]+)"/.exec(app.box().html)?.[1];
    assert.ok(choice, '보기');
    app.box().press('data-mock-choice', choice);
    assert.equal(app.planTimes('mock').length, 1, '다시 그려도 한 판');
    // 그만두기 — 판을 기록 없이 닫아도(엔진의 판 기록은 없다) 이 기기의 판 기록에는 남는다
    app.box().press('data-mock-stop');
    await until(() => app.box().html.includes('data-mock-done'), '그만둔 뒤의 끝 한 장');
    assert.equal(app.planTimes('mock').length, 1, '그만둬도 한 판 — 두 번 적지 않는다');
    assert.deepEqual(app.planTimes('recheck'), [], '다른 영역에는 적지 않는다');
  } finally {
    app.dispose();
  }
});
