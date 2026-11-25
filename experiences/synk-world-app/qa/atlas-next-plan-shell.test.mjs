// 4-4b 이번 주 계획 새 판의 셸 배선(단계4_계획 §21-6 · 21-11 · 설계 주인 11-16 물음 1의 답) — world-learning-ui.mjs가 새 길 홈에 이번 주 계획을
// 짓고(weekNext), 계획 입구(홈의 계획 단추 · 배우기의 이번 주 계획 줄)와 알림 입력이 그 계획을 읽으며, 새 길 판(짧은 진단)이 끝나면 이 기기의 판
// 기록에 적고 묶음 만남을 다시 묻는다(카본 A8). 배우기 허브의 쓰기 줄은 지금처럼 남는다(시험 종류 — app-shell.mjs leadRows · moreRows).
// 진짜 엔진 코치(손님 메모리 저장소) · 진짜 지도 조각 · 진짜 홈 플래너(world-today · 입구의 positionPlanner · planPlanner)로 돌린다. 셸 판은
// 글(HTML)만 본다(이 저장소에 DOM 도구가 없다 — qa/atlas-next-position-shell.test.mjs와 같은 방식).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { createWriteCount, homeBanksOf, planPlanner, positionPlanner } from '../world-atlas-next.mjs';
// 길 표(4-6e-2 — 단계4_계획 §25-3)는 입구가 홈 플래너에 실어 준다. 이 시험의 플래너도 싣는다(게임 목록은 싣지 않는다 — 게임 길은 qa/atlas-next-routes-shell.test.mjs가 본다).
import { createRoutes } from '../world-home-games.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from '../world-today.mjs';
import { createPlanLog } from '../world-plan-next.mjs';
import { WRITING_CANDIDATES } from '../world-writing-practice.mjs';
import { SPEAKING_CANDIDATES } from '../world-speaking-practice.mjs';

// 변형 시험은 깬 셸 사본을 SYNK_LEARNING_UI_MODULE로 넘긴다. 그 밖에는 원본이다.
const { createWorldEducation } = await import(
  process.env.SYNK_LEARNING_UI_MODULE ? pathToFileURL(process.env.SYNK_LEARNING_UI_MODULE).href : '../world-learning-ui.mjs'
);

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const PLANNER = Object.freeze({ createWorldTodayPlan, watchHomePlan, todayKey, say: () => '', position: positionPlanner, createRoutes, plan: planPlanner });
const EXAM_T1 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2, examDate: '2027-04-18', weeklyMinutes: 120 };
const EXAM_T2 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik2', targetGrade: 4, examDate: '2027-04-18', weeklyMinutes: 120 };
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, ms = 8000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error(`기다림이 넘쳤다: ${label}`);
    await tick(10);
  }
}
// 이번 주 계획의 주 안 시각 — 지금에서 ago만큼 앞이되 이번 주 시작보다 앞으로 가지 않는다. 주가 막 시작한 때에 돌려도 이번 주 기록이 지난주로
// 넘어가지 않는다(끝 판 검수 GPT GC1 · 카본 C2).
const recentInWeek = ago => Math.max(worldPosition.exam.examWeek(Date.now()).start, Date.now() - ago);
// 시험 도중 주가 바뀌면 앞서 적은 이번 주 기록이 지난주가 된다 — 이번 주가 1분도 남지 않았으면 주가 바뀔 때까지 기다린 뒤 시작한다.
async function clearOfWeekEnd() {
  const left = worldPosition.exam.examWeek(Date.now()).end - Date.now();
  if (left < 60_000) await tick(left + 50);
}
// 점검 칸의 차례 돌리기(world-today.mjs checkShift — 밀린 날 수)는 「오늘이 이번 계획 주의 몇째 학습일인가」를 센다. 그래서 차례를 보는
// 장면은 요일에 따라 결과가 바뀐다(11-18 수요일에 깨졌다 — 시계를 하루씩 옮겨 이레를 재 보니 월 · 화 · 금만 지났다). 그런 장면은 계획 주의
// 월요일 정오(한국 시각)로 시계를 옮겨 돌린다. 시간은 그대로 흐르고, 끝나면 시계를 되돌린다.
async function onPlanMonday(run) {
  const real = Date.now;
  const offset = worldPosition.exam.examWeek(real()).start + 12 * 3_600_000 - real();
  Date.now = () => real() + offset;
  try {
    return await run();
  } finally {
    Date.now = real;
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
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:plan-shell-${process.pid}-${stores}` },
  });
  await coach.ready;
  return coach;
}

// 판 상자: innerHTML 글을 들고 단추 누르기만 흉내 낸다.
function stage() {
  const clicks = [];
  const made = new Map();
  const buttonsOf = (html, name) => {
    const key = `${name}|${html}`;
    if (!made.has(key))
      made.set(
        key,
        [...html.matchAll(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`, 'g'))].map(([, value = '']) => {
          const heard = [];
          const camel = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return { value, dataset: { [camel]: value }, addEventListener: (type, fn) => type === 'click' && heard.push(fn), click: () => heard.forEach(fn => fn({})), focus() {}, getAttribute: attr => (attr === name ? value : null), hasAttribute: attr => attr === name };
        }),
      );
    return made.get(key);
  };
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
    // 「이 항목 연습하기」 단추만 글에서 짓는다(끝 화면이 길을 거는 자리 — 사슬 -c GC2). 나머지는 앞과 같이 흉내만 낸다.
    querySelectorAll: selector => (selector === '[data-position-practice]' ? buttonsOf(box.html, 'data-position-practice') : []),
    querySelector: () => ({ focus() {}, addEventListener() {} }),
  };
  box.practice = skill => buttonsOf(box.html, 'data-position-practice').find(button => button.value === skill) ?? null;
  box.press = (attr, value = '') => {
    const camel = attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const button = { dataset: { [camel]: value }, disabled: false, hasAttribute: name => name === attr };
    for (const fn of [...clicks]) fn({ target: { closest: selector => (selector === 'button' ? button : null) } });
  };
  return box;
}

// 셸 하나 — 새 길 홈 입구(homeNext)를 넘긴 학습 화면. values: 학습 목표 값(시험 정보). planLog(made): 입구의 판 기록(시험은 기기 저장소 하나).
// wrap: 홈 코치에 얹을 것(묶음 만남을 세거나 기록부를 계정처럼 보이게).
// planner: 입구가 플래너를 주는 때(끝내 주지 않으면 홈이 확인 중에 머문다). fast: 창의 시계를 30ms로 줄인다(기다림 한도를 넘기는 장면).
// writingPractice · speakingPractice: 앱이 넘기는 쓰기 · 말하기 호스트(app-shell.mjs와 같은 꼴 — 아래 writingHost · speakingHost). 없으면 넘기지 않는다.
// focusing: 판 글의 단추와 문서의 초점(activeElement), 판 안의 스크롤 칸(#panel-content)을 흉내 낸다. 진짜 홈처럼 판을 보일 때마다 스크롤 자리가 처음으로
// 가고 초점은 닫기 단추(판 밖)로 간다(home.mjs openPanel) — 셸이 되돌려야 한다. 셸이 초점을 둔 자리는 focused에 적는다(판 머리는 root, 단추는 이름=값#몇 번째).
function shell({
  values = { audio: 'off', ...EXAM_T1 },
  wrap = made => made,
  planLog = null,
  planner = null,
  fast = false,
  focusing = false,
  writingPractice = null,
  speakingPractice = null,
  panels = false,
  atlasNext = null,
} = {}) {
  const opens = [];
  const launched = [];
  const toasts = [];
  const waits = [];
  // 기록이 바뀐 셈(4-6e-2) — 입구처럼 홈 코치를 그 겉으로 내고(쓰기 · 받기 알림마다 오른다) 플래너의 writes로 넘긴다.
  const writes = createWriteCount();
  planner ??= async () => ({ ...PLANNER, writes: writes.count });
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
  const coaches = [];
  let drawn = 0;
  let box = null;
  const storage = new Map();
  // 창 · 문서의 듣는 함수 — 시험이 초점 · 화면 복귀 · 다시 연결을 일으킨다(fire).
  const listeners = [];
  const listen = (type, fn) => listeners.push({ type, fn });
  let active = null;
  const focused = [];
  const content = { scrollTop: 0 };
  const buttonsMade = new Map();
  // 판 글에서 그 속성을 가진 단추를 짓는다(focusing일 때만). 같은 판 글이면 같은 단추를 돌려준다(초점이 몇 번째 단추였는지 견줄 수 있게).
  const buttonsIn = selector => {
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
        const button = {
          inPanel: true,
          dataset: {},
          getAttribute: attr => (attr === name ? value : null),
          hasAttribute: attr => attr === name,
          focus: () => {
            active = button;
            focused.push(`${name}=${value}#${index}`);
          },
          addEventListener() {},
        };
        return button;
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
    querySelector: selector => (focusing ? (buttonsIn(selector)[0] ?? null) : null),
    querySelectorAll: selector => (focusing ? buttonsIn(selector) : []),
    contains: element => focusing && element?.inPanel === true,
    addEventListener() {},
    insertAdjacentHTML() {},
  });
  const document = {
    visibilityState: 'visible',
    get activeElement() {
      return active;
    },
    addEventListener: listen,
    removeEventListener() {},
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
  const target = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document,
    addEventListener: listen,
    removeEventListener() {},
    setTimeout: fast
      ? (fn, ms) => {
          waits.push(ms);
          return setTimeout(fn, Math.min(ms, 30));
        }
      : setTimeout,
  };
  const state = { values, panel: panels ? '' : null };
  // 판 자원(panels일 때만) — 진짜 홈처럼 한 칸이다. 새 자원을 달거나 판을 바꾸거나 닫으면 앞 자원을 바로 정리한다(home.mjs attachPanelResource · openPanel).
  let resource = null;
  const dropResource = () => {
    const was = resource;
    resource = null;
    was?.dispose?.();
  };
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
    updateStudy() {
      drawn += 1;
    },
    toast(text) {
      toasts.push(String(text));
    },
    closePanel() {
      if (!panels) return;
      dropResource();
      state.panel = '';
      shown.push('');
    },
    attachPanelResource(value) {
      if (!panels || value === resource) return;
      const was = resource;
      resource = value;
      was?.dispose?.();
    },
    openPanel: () => state.panel,
    showPanel(title, html, options = {}) {
      if (panels) {
        dropResource();
        state.panel = options?.type || 'life-position';
      }
      shown.push(String(html));
      if (/data-position-stage/.test(html)) box = stage();
      // 진짜 홈처럼 판 글을 바꾸면 스크롤 자리가 처음으로 가고 초점은 닫기 단추로 간다(focusing일 때만).
      if (focusing) {
        content.scrollTop = 0;
        active = { inPanel: false, hasAttribute: () => false };
      }
    },
  };
  const homeNext = {
    async coach() {
      const made = writes.face(wrap(await homeCoach()));
      coaches.push(made);
      return made;
    },
    planner,
    retired: () => () => {},
    life: () => 'engine',
    ask: async () => {},
    judge: () => ({ state: 'engine', items: [], ids: [], times: [], upcoming: [], stuck: [] }),
    answers: () => null,
    openGames: () => null,
    packs() {},
    painted() {},
    ...(planLog ? { planLog } : {}),
  };
  const education = createWorldEducation({
    home,
    getProgress: () => progress,
    engine,
    createPlan: () => ({ selected: null, reason: '' }),
    launchGame: id => launched.push(id),
    startLesson() {},
    startReview() {},
    position: worldPosition,
    target,
    homeNext,
    ...(writingPractice ? { writingPractice } : {}),
    ...(speakingPractice ? { speakingPractice } : {}),
    ...(atlasNext ? { atlasNext } : {}),
  });
  return {
    education,
    // 학생이 판을 닫는다(panels일 때만).
    closePanel: () => home.closePanel(),
    opens,
    launched,
    shown,
    coaches,
    state,
    last: () => shown.at(-1) ?? '',
    toasts,
    waits,
    drawn: () => drawn,
    fire(type) {
      for (const row of listeners.filter(entry => entry.type === type)) row.fn({ type });
    },
    box: () => box,
    plan: () => education.metrics().plan,
    // 초점(focusing일 때만) — 판 안의 단추(몇 번째)에 둔다. 셸이 초점을 둔 자리는 focused에, 판 안의 스크롤 칸은 content에 있다.
    focused,
    content,
    focusOn(name, value = '', index = 0) {
      active = buttonsIn(`[${name}]`).filter(button => button.getAttribute(name) === value)[index] ?? null;
      assert.ok(active, `판에 ${name}="${value}"의 ${index + 1}번째 단추가 있다`);
    },
    dispose() {
      education.dispose();
      for (const made of coaches) made.dispose();
    },
  };
}
const engineHome = app => app.plan()?.today?.state === 'engine' && Boolean(app.plan()?.examPlan);

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

test('새 길 홈은 시험을 고른 학생에게 이번 주 계획을 짓는다 — 계획 입구가 열리고, 배우기의 계획 줄 · 알림 입력이 같은 계획을 읽는다(§21-6 「새 길 홈에 다시 여는 것」)', async () => {
  const app = shell();
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    // 하네스에는 학습 호스트가 없어 설정 읽기(settingsFor)가 옛 코치에서 도움 방식을 읽는다(4-3부터 같은 시험 틀의 일 — 앱에서는 호스트가 준다).
    // 그래서 홈을 그린 뒤부터 잰다(qa/atlas-next-position-shell.test.mjs와 같은 자리).
    const opened = app.opens.length;
    const plan = app.plan();
    assert.equal(plan.examPlan.exam.type, 'topik1');
    assert.equal(plan.examPlan.doneScope, 'device', '알림 입력(app-shell.mjs reminderInputs)이 읽는 계획 — 이 기기에서 센 수');
    assert.ok(plan.examPlan.notes.includes('start'), '새 학생은 시작점');
    assert.ok(plan.today.items.some(row => row.kind === 'check' && row.route === 'position'), '점검 칸에 짧은 진단');
    assert.match(app.education.planRow(), /data-view="plan"/, '배우기의 이번 주 계획 줄');
    assert.equal(app.education.examType(), 'topik1');
    assert.equal(await app.education.plan(), 'shown', '계획 입구가 연다');
    assert.match(app.last(), /data-plan-board/);
    assert.match(app.last(), /data-plan-scope="device"/, '계획 판은 이 기기에서 센 수라는 표지를 든다');
    assert.equal(app.opens.length, opened, '계획 입구가 옛 코치(옛 저장소)를 더 열지 않는다(§6)');
  } finally {
    app.dispose();
  }
});

// 앱의 쓰기 호스트(app-shell.mjs writingPractice — world-writing-practice.mjs writingCandidates의 꼴): 한 가지 고치기가 열려 있으면 53번 후보에
// practiceNeed와 연습 전 어림 분(5분)이 붙는다. need는 시험이 바꾼다(state.need).
function writingHost(need) {
  const state = { need };
  return {
    state,
    candidates: () => WRITING_CANDIDATES.map(row => (row.route === 'writing:53' && state.need ? { ...row, minutes: 5, practiceNeed: state.need } : row)),
    open() {},
    attempts: () => [],
  };
}
// 앱의 말하기 호스트(app-shell.mjs speakingPractice — 「말하기 평가도 준비해요」를 켠 학생). tried: 이번 주에 이 기기에서 해 본 유형(1~6).
function speakingHost({ tried = [] } = {}) {
  return {
    available: () => true,
    candidates: () => SPEAKING_CANDIDATES.filter(row => row.exam === 'speaking'),
    chosen: () => true,
    choose: () => true,
    week: () => ({ times: [], tried }),
    open() {},
  };
}
const checkRows = plan => plan.today.items.filter(row => row.kind === 'check');

test('TOPIK II 학생 — 새 길 홈의 점검 칸에 쓰기 · 말하기 · 시험 형식이 넘어가고, 이번 주 다시 확인을 마친 학생에게는 한 가지 고치기가 열린 53번이 그 목표로 선다(4-4d — 4-4b 장면을 뒤집음)', () =>
  onPlanMonday(async () => {
  const logs = new Map();
  const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
  const log = createPlanLog({ storage: memory, store: 'synk-atlas:guest' });
  // 이번 주 다시 확인을 마친 학생 — 짧은 진단 줄은 서지 않고 나머지 셋이 겨룬다. 기록 시각은 이번 주 계획의 주 안이다.
  await clearOfWeekEnd();
  assert.equal(log.record('recheck', recentInWeek(60_000)), true);
  // 지난주에 한 시험 형식 판은 이번 주의 시험 형식 줄을 막지 않는다(주 경계는 weekActivity와 같은 계획의 주)
  assert.equal(log.record('mock', worldPosition.exam.examWeek(Date.now()).start - 3_600_000), true);
  const writing = writingHost({ kind: 'retry', at: new Date(recentInWeek(3_600_000)).toISOString() });
  const app = shell({
    values: { ...EXAM_T2 },
    planLog: made => (made ? log : null),
    writingPractice: writing,
    speakingPractice: speakingHost({ tried: [1] }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const plan = app.plan();
    assert.equal(plan.examPlan.exam.type, 'topik2');
    assert.ok(plan.candidates.some(open => open.route === 'writing' && open.routeId === 'writing:53'), '53번 쓰기를 넘긴다');
    assert.ok(plan.candidates.some(open => open.route === 'speaking' && open.routeId === 'speaking:2'), '이번 주에 아직 안 해 본 첫 유형(2번)을 넘긴다');
    assert.ok(plan.candidates.some(open => open.route === 'mock'), '시험 형식을 넘긴다(고르기가 ready)');
    // 이번 주 계획 판에도 시험 형식 칸이 선다 — 지금 판과 같은 꼴 · 조건으로 고르기 결과를 싣는다(Fable 끝 판 F8 · 설계 주인 11-17 저녁 답 3).
    assert.equal(plan.examPlan.mock?.status, 'ready', '계획에 시험 형식 고르기 결과');
    assert.equal(plan.examPlan.mock.minutes, plan.candidates.find(open => open.route === 'mock').minutes, '홈 줄과 같은 고르기');
    assert.equal(await app.education.plan(), 'shown');
    assert.match(app.last(), /data-plan-mock-section/, '새 길 계획 판의 시험 형식 칸');
    assert.ok(!plan.candidates.some(open => open.route === 'position'), '이번 주 다시 확인을 마쳐 짧은 진단은 넘기지 않는다');
    // 이 장면의 계획은 다음 영역이 말하기다 — 말하기 줄은 영역 목표를, 쓰기는 한 가지 고치기 목표를 하나씩 받아 제품 차례(쓰기 → 말하기)로 가른다
    assert.equal(plan.examPlan.next?.area, 'speaking');
    let rows = checkRows(plan);
    assert.equal(rows.length, 1, '점검 칸은 한 줄');
    assert.equal(rows[0].activityId, 'topik2-writing-53', '한 가지 고치기 목표를 맞춘 쓰기가 같은 수의 목표를 맞춘 말하기보다 앞선다');
    assert.equal(rows[0].why.code, 'host.writing');
    assert.deepEqual(rows[0].why.slots, { focus: 'ending-53', need: 'retry' });
    assert.equal(rows[0].open.routeId, 'writing:53');
    // 한 가지 고치기의 시각이 계획 시각보다 뒤면(기기 시계가 앞선 기록) 아직 열린 것으로 보지 않는다 — 목표가 없는 쓰기는 영역 목표를 맞춘 말하기 뒤다
    writing.state.need = { kind: 'retry', at: new Date(Date.now() + 3_600_000).toISOString() };
    app.education.refresh();
    await until(() => checkRows(app.plan())[0]?.activityId !== 'topik2-writing-53', '말하기가 앞선 점검 칸');
    rows = checkRows(app.plan());
    assert.equal(rows[0].activityId, 'world.speaking.check');
    assert.equal(rows[0].why.code, 'host.speaking');
    assert.deepEqual(rows[0].why.slots, { type: 'roleplay', untried: 5 }, '이번 주에 아직 안 해 본 첫 유형(2번 — 능력 이름 끝 마디)과 안 해 본 유형 수');
    assert.equal(rows[0].open.routeId, 'speaking:2');
    // 이번 주에 시험 형식 판을 하면(이 기기의 판 기록) 시험 형식을 넘기지 않는다
    assert.equal(log.record('mock', recentInWeek(30_000)), true);
    app.education.refresh();
    await until(() => !app.plan().candidates.some(open => open.route === 'mock'), '시험 형식을 넘기지 않는 계획');
    assert.ok(app.plan().candidates.some(open => open.route === 'writing'), '쓰기 · 말하기는 그대로 넘긴다');
    assert.equal(app.education.examType(), 'topik2', '허브는 이 값으로 TOPIK II 학생의 쓰기 줄을 맨 위에 둔다(지금 판과 같다)');
  } finally {
    app.dispose();
  }
  }));

test('쓰기 · 말하기 호스트가 없으면(앱이 모듈을 부르지 않은 때) 점검 칸에 쓰기 · 말하기를 넘기지 않는다 — 지금 판과 같다 · 소리를 끈 날의 시험 형식은 듣기 없이 넘긴다', async () => {
  const app = shell({ values: { audio: 'off', ...EXAM_T2 } });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const plan = app.plan();
    assert.ok(!plan.candidates.some(open => ['writing', 'speaking'].includes(open.route)));
    const mock = plan.candidates.find(open => open.route === 'mock');
    assert.equal(mock?.audioRequired, false, '소리를 끈 날의 시험 형식 판에는 듣기 칸이 없다 — 소리 때문에 잠그지 않는다');
  } finally {
    app.dispose();
  }
});

test('TOPIK I 학생 — 쓰기 호스트가 있어도 점검 칸에 53번 쓰기를 넘기지 않고, 말하기를 켰으면 이번 주에 아직 안 해 본 첫 유형을 넘긴다', async () => {
  const app = shell({
    values: { ...EXAM_T1 },
    writingPractice: writingHost({ kind: 'retry', at: new Date(Date.now() - 3_600_000).toISOString() }),
    speakingPractice: speakingHost(),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const plan = app.plan();
    assert.ok(!plan.candidates.some(open => open.route === 'writing'), 'TOPIK I 학생에게는 쓰기가 없다');
    assert.ok(plan.candidates.some(open => open.route === 'speaking' && open.routeId === 'speaking:1'));
  } finally {
    app.dispose();
  }
});

test('TOPIK I 학생 — 점검 칸의 이번 주 몫이 모두 찬 날에도 쓰기 호스트에 열린 53번 고치기를 보탬으로 세우지 않는다(4-4d 설계 주인 다시 여쭘의 답 2)', async () => {
  const logs = new Map();
  const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
  const log = createPlanLog({ storage: memory, store: 'synk-atlas:guest' });
  // 이번 주 다시 확인과 시험 형식 판을 마친 학생 — 말하기는 켜지 않았다. 시각은 이번 주 계획의 주 안이다.
  await clearOfWeekEnd();
  assert.equal(log.record('recheck', recentInWeek(60_000)), true);
  assert.equal(log.record('mock', recentInWeek(30_000)), true);
  const app = shell({
    values: { ...EXAM_T1 },
    planLog: made => (made ? log : null),
    writingPractice: writingHost({ kind: 'retry', at: new Date(recentInWeek(60_000)).toISOString() }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const plan = app.plan();
    assert.ok(!plan.candidates.some(open => ['position', 'mock', 'speaking'].includes(open.route)), '장면의 전제 — 점검 칸의 몫이 모두 찼다');
    assert.ok(!plan.candidates.some(open => open.route === 'writing'), 'TOPIK I 학생에게는 보탬 쓰기도 없다');
    assert.equal(checkRows(plan).length, 0, '점검 칸 줄이 없다');
  } finally {
    app.dispose();
  }
});

test('시험을 고르지 않은 학생은 새 길 홈에도 이번 주 계획이 없다 — 계획 줄이 없고 계획 입구는 목표 창으로 간다(4-3과 같다)', async () => {
  const app = shell({ values: { audio: 'off', reasons: ['travel'], primaryReason: 'travel' } });
  try {
    app.education.refresh();
    await until(() => app.plan()?.today?.state === 'engine', '엔진 판');
    assert.equal(app.plan().examPlan, null);
    assert.equal(app.education.planRow(), '');
    assert.equal(app.education.examType(), null);
    assert.equal(await app.education.plan(), 'missing');
  } finally {
    app.dispose();
  }
});

test('목표 창의 「내 위치 보기」 수 — 새 길 문서는 엔진 판일 때만 「내 위치」 판과 같은 새 요약으로 짓고, 확인 중이면 수 없이 그린다(단계4_계획 §22-1 5b · 설계 주인 11-18)', async () => {
  const row = html => /data-view="position"[\s\S]*?<small>([^<]*)<\/small>/.exec(html)?.[1] ?? null;
  // TOPIK II 학생의 엔진 판 — 새 판은 TOPIK II 항목으로 센다(옛 world-home 요약은 늘 TOPIK I 지도였다).
  const app = shell({ values: { ...EXAM_T2 } });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    app.education.open();
    assert.match(row(app.last()) ?? '', /^TOPIK II \d+개 항목: 혼자 해냄 \d+ · 연습 중 \d+ · 아직 \d+$/, '새 요약의 TOPIK II 수');
  } finally {
    app.dispose();
  }
  // 확인 중(플래너를 끝내 못 받음) — 옛 요약으로 수를 짓지 않고 수 없이 그린다.
  const stuck = shell({ planner: () => new Promise(() => {}), fast: true });
  try {
    stuck.education.open();
    const text = row(stuck.last()) ?? '';
    assert.ok(text.length > 0, '줄은 선다');
    assert.doesNotMatch(text, /혼자 해냄/, '확인 중에는 수가 없다');
  } finally {
    stuck.dispose();
  }
});

test('새 길 홈이 확인 중일 때 연 이번 주 계획은 판이 설 때까지 기다린다 — 시험을 저장한 학생에게 목표 창을 열지 않는다(4-4b 끝 판 Fable F1)', async () => {
  const form = html => html.includes('world-study-form');
  // 문서를 연 직후의 ?exam= 바로가기 — 홈은 아직 확인 중이다.
  const link = shell();
  try {
    assert.notEqual(link.plan()?.today?.state, 'engine', '막 연 셸의 홈은 아직 엔진 판이 아니다');
    const started = Date.now();
    assert.equal(await link.education.examLink('topik1'), true);
    assert.match(link.last(), /data-plan-board/, '판이 선 뒤 이번 주 계획을 연다');
    assert.ok(Date.now() - started < 4000, '판이 서면 곧 연다 — 한도(8초)까지 기다리지 않는다');
    assert.ok(!link.shown.some(form), '목표 창을 열지 않는다');
  } finally {
    link.dispose();
  }
  // 알림의 「이번 주 연습」(app-shell.mjs openReminder 'plan' — education.plan())도 같다.
  const reminder = shell();
  try {
    assert.equal(await reminder.education.plan(), 'shown');
    assert.ok(!reminder.shown.some(form));
  } finally {
    reminder.dispose();
  }
  // 판이 한도 안에 서지 않으면(플래너를 끝내 못 받음 — 확인 중에 머묾) 목표 창 대신 확인 중이라고만 알린다.
  const stuck = shell({ planner: () => new Promise(() => {}), fast: true });
  try {
    assert.equal(await stuck.education.plan(), 'skipped');
    assert.ok(stuck.toasts.includes('오늘 할 공부를 확인하고 있어요'), '학생이 누른 열기에는 확인 중이라고 알린다');
    assert.equal(await stuck.education.examLink('topik1'), false, '바로가기도 목표 창을 열지 않는다');
    assert.ok(!stuck.shown.some(form), '목표 창을 열지 않는다');
  } finally {
    stuck.dispose();
  }
});

test('새 길 짧은 진단이 끝나면 이 기기의 판 기록에 다시 확인을 적고, 계획이 묶음 만남을 다시 물어 시작점이 풀린다(§21-6 가 · 카본 A8)', async () => {
  const logs = new Map();
  const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
  const asked = [];
  const app = shell({
    planLog: made => (made ? createPlanLog({ storage: memory, store: 'synk-atlas:guest' }) : null),
    wrap: made => ({
      ...made,
      exposures(items) {
        asked.push(items.length);
        return made.exposures(items);
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.ok(app.plan().examPlan.notes.includes('start'));
    const before = asked.length;
    app.education.refresh();
    app.education.refresh();
    assert.equal(asked.length, before, '같은 학습일 · 같은 판 끝 · 같은 시험 · 같은 기록 상태면 다시 그려도 묶음 만남을 다시 묻지 않는다');
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    assert.ok((await answerItems(app)) > 0);
    await until(() => app.box().html.includes('data-position-done'), '진단 끝 화면');
    const rows = JSON.parse(logs.get('synk.world.plan-log.v1:synk-atlas:guest') ?? '{"rows":[]}').rows;
    assert.deepEqual(rows.map(row => row.area), ['recheck'], '판 끝에 다시 확인 한 판');
    // 판이 끝나면(판 끝 수가 오름) 묶음 만남을 다시 묻는다 — 학습일 · 시험 · 기록 상태가 그대로여도. 앞의 만남을 그대로 쓰면 시작점이 풀리지 않는다.
    app.education.refresh();
    const plan = app.plan().examPlan;
    assert.equal(plan.areas.find(row => row.area === 'recheck').done, 1, '이번 주 다시 확인 한 번(이 기기에서 센 수)');
    assert.ok(!plan.notes.includes('start'), '진단에서 만난 문항이 있으니 시작점이 아니다');
    // 점검 칸에는 4-4d부터 시험 형식 · 쓰기 · 말하기도 선다 — 진단 줄만 없어진다.
    assert.ok(
      !app.plan().today.items.some(row => row.kind === 'check' && row.activityId === 'world.position.check'),
      '이번 주 다시 확인을 마쳤으니 점검 칸의 진단 줄이 없다',
    );
    const settled = asked.length;
    app.education.refresh();
    assert.equal(asked.length, settled, '판 끝 뒤 다시 물은 만남을 그날 그대로 쓴다');
    // 시험을 바꾸면 다시 묻는다(그날 내내 옛 판정이 굳지 않게).
    const changed = asked.length;
    app.state.values = { audio: 'off', ...EXAM_T2 };
    app.education.refresh();
    assert.equal(asked.length, changed + 1, '목표 시험을 바꾸면 다시 묻는다');
  } finally {
    app.dispose();
  }
});

test('게임 판 끝(§25-3 불변식 나) — 셸은 입구의 판 끝을 듣고 판 끝 수를 올려 묶음 만남을 다시 묻고, 홈과 열린 이번 주 계획 판을 다시 그려 방금 한 게임 판이 듣기 한 수로 든다 · 문서를 닫으면 듣기를 끊는다', async () => {
  const logs = new Map();
  const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
  const log = createPlanLog({ storage: memory, store: 'synk-atlas:guest', gen: 0 });
  // 입구의 판 끝 듣기(홈 플래너의 gameEnds) — 앱의 입구 감싸개는 메서드를 이름으로 옮기므로 셸은 플래너로 건다.
  const ears = new Set();
  const asked = [];
  const app = shell({
    values: { ...EXAM_T1 },
    planner: async () => ({ ...PLANNER, gameEnds: fn => (ears.add(fn), () => ears.delete(fn)) }),
    planLog: made => (made ? log : null),
    wrap: made => ({
      ...made,
      exposures(items) {
        asked.push(items.length);
        return made.exposures(items);
      },
    }),
  });
  try {
    await clearOfWeekEnd();
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.equal(ears.size, 1, '셸이 입구의 게임 판 끝을 듣는다');
    const listening = () => app.plan().examPlan.areas.find(row => row.area === 'listening')?.done ?? 0;
    assert.equal(listening(), 0);
    assert.equal(await app.education.plan(), 'shown', '이번 주 계획 판을 연다');
    const boards = app.shown.length;
    const board = app.last();
    // 판에 보이는 듣기 줄의 수 — 안쪽 계획의 done이 아니라 학생이 보는 글이다(새 사슬 GA4).
    const shownCount = html => Number(/<li data-area="listening">.*?class="wplan-area-count">\D*(\d+)/.exec(html)?.[1] ?? Number.NaN);
    assert.equal(shownCount(board), 0, '판의 듣기 줄은 0회');
    const before = asked.length;
    // 입구가 게임 판의 판 기록을 적은 뒤 알린다. 실제 패널 닫기 알림처럼 판의 다시 접기(folded)를 싣는다(4-6e-2 검수 GPT GA2).
    const at = recentInWeek(60_000);
    log.record('listening', at, 'korean-runner');
    for (const fn of [...ears]) fn({ gameId: 'korean-runner', at, areas: ['listening'], folded: Promise.resolve(true) });
    await until(() => app.shown.length > boards, '열린 이번 주 계획 판을 다시 그림');
    assert.match(app.last(), /data-plan-board/);
    // 다시 그린 판은 새 계획으로 지은 글이다 — 앞 글을 다시 보이면 학생이 보는 듣기 수가 그대로다(GA3).
    assert.notEqual(app.last(), board, '열린 판이 방금 한 게임 판을 반영한 새 글이다');
    assert.equal(shownCount(app.last()), 1, '판의 듣기 줄이 1회로 바뀐다');
    assert.equal(listening(), 1, '방금 한 게임 판이 듣기 한 수로 든다');
    assert.equal(asked.length, before + 1, '판 끝 수가 올라 묶음 만남을 다시 묻는다(답 없이 문항만 본 판의 만남)');
    // 센 첫 답이 없는 판 끝도 판 끝 수를 올린다.
    for (const fn of [...ears]) fn({ gameId: 'korean-runner', at, areas: [], folded: null });
    await tick(20);
    assert.equal(asked.length, before + 2, '센 첫 답이 없는 판 끝도 묶음 만남을 다시 묻게 한다');
    assert.equal(listening(), 1);
  } finally {
    app.dispose();
  }
  assert.equal(ears.size, 0, '문서를 닫으면 판 끝 듣기를 끊는다');
});

// ── 게임 판 끝과 다시 접기의 그리기(사슬 -c 카본 C1 · -d 카본 A1 · GPT GA1 · -d-r2) ──
// 길 표의 답을 바꿔 끼운다 — way()가 참이면 모든 능력의 길이 게임(리듬)이고, 아니면 길이 없다(내 위치의 단추가 서고 없어진다).
function swapRoutes(way) {
  const open = { id: 'world.play.rhythm', label: '말의 리듬', route: 'game', gameId: 'rhythm', minutes: 3, supports: [], targets: [] };
  const answerOf = id =>
    way()
      ? { skillId: id, route: 'game', gameId: 'rhythm', id: open.id, practice: [], games: [{ id: open.id, gameId: 'rhythm', open, items: [], left: 0 }] }
      : { skillId: id, route: null, practice: [], games: [] };
  return options => ({ ...createRoutes(options), routeOf: answerOf, reader: () => answerOf });
}
// 입구의 겉(짧은 연습) — 코치 받기를 시험이 붙들었다가 준다(calls의 give). 판은 문항 하나를 보인 채 선다. broken: 판을 짓다 던진다.
function practiceEntry({ broken = false } = {}) {
  const calls = [];
  const mocks = [];
  const entry = {
    broken,
    calls,
    mocks,
    practiceCoach: () => new Promise(resolve => calls.push({ give: (coach = {}) => resolve(coach) })),
    mockCoach: () => new Promise(resolve => mocks.push({ give: () => resolve(null) })),
    createPracticeNextSession: ({ pool }) => {
      if (entry.broken) throw Error('판을 짓지 못했다');
      const view = { item: pool[0], index: 0, total: 5, upTo: true, heard: false, why: null, stubborn: false, targetLabel: null };
      let at = -1;
      return {
        get current() {
          return at === 0 ? view : null;
        },
        next: () => ((at += 1) === 0 ? view : null),
        preHelp() {},
        answer() {},
        unknown() {},
        skip() {},
        replay: () => null,
        delivery() {},
        stop() {},
        results: () => [],
        settled: async () => [],
        freshLeft: () => 0,
        ending: { kind: 'done' },
      };
    },
    retired: () => () => {},
  };
  return entry;
}
const READING = [...new Set(worldPosition.practice.pool.filter(item => item.skillId.startsWith('ko.reading.')).map(item => item.skillId))];
const practiceButtons = html => [...html.matchAll(/data-position-practice="([^"]+)"/g)].length;
const practiceShown = app => app.shown.filter(html => html.includes('data-practice-stage')).length;

// 셸 하나 — 게임 판 끝을 내고(end), 붙든 다시 접기를 준다(hold). 판(board)을 연 채로 돌려준다. broken: 연습 판을 짓다 던지는 입구.
// opened가 거짓이면 판을 열지 않고 돌려준다(openBoard로 연다).
async function foldApp(board, { practice = false, broken = false, opened = true } = {}) {
  const ears = new Set();
  const logs = new Map();
  const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
  const log = createPlanLog({ storage: memory, store: 'synk-atlas:guest', gen: 0 });
  const way = { game: false };
  const entry = practice ? practiceEntry({ broken }) : null;
  const app = shell({
    values: { audio: 'available', ...EXAM_T1 },
    panels: true,
    // 이번 주 계획은 진짜 길 표로 짓는다(길이 없으면 듣기 줄이 서지 않는다) — 바뀌는 것은 판 기록의 수다.
    planner: async () => ({ ...PLANNER, ...(board === 'plan' ? {} : { createRoutes: swapRoutes(() => way.game) }), gameEnds: fn => (ears.add(fn), () => ears.delete(fn)) }),
    planLog: made => (made ? log : null),
    ...(entry ? { atlasNext: entry } : {}),
  });
  const held = [];
  const end = folded => {
    for (const fn of [...ears]) fn({ gameId: 'korean-runner', at: Date.now(), areas: ['listening'], folded });
  };
  const hold = () => {
    let release = () => {};
    const folded = new Promise(resolve => (release = resolve));
    held.push(release);
    end(folded);
    return release;
  };
  const openBoard = async () => {
    if (board === 'plan') assert.equal(await app.education.plan(), 'shown');
    else {
      await app.education.position();
      await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    }
  };
  // 여기서 떨어지면 셸을 닫고 던진다 — 닫지 않은 셸의 시계가 남아 시험 파일이 끝나지 않는다(변형이 홈 계획을 세우지 않을 때).
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    if (opened) await openBoard();
  } catch (error) {
    app.dispose();
    throw error;
  }
  // 그 판이 지금 보이는 것 — 내 위치는 길이 선 단추가 있는가, 이번 주 계획은 듣기 줄의 수다.
  const now = () =>
    board === 'plan' ? Number(/<li data-area="listening">.*?class="wplan-area-count">\D*(\d+)/.exec(app.last())?.[1] ?? Number.NaN) : Number(practiceButtons(app.last()) > 0);
  let rows = 0;
  // 판 끝 · 다시 접기가 바꾸는 것 — 내 위치의 길이 뒤집히고, 이번 주 계획에 듣기 판이 하나 더 든다(경험이 다르면 한 수씩 — §25-3).
  const turn = () => {
    way.game = !way.game;
    log.record('listening', recentInWeek(60_000), ['korean-runner', 'korean-rhythm', 'order-rush', 'subway-rush'][rows++]);
    return board === 'plan' ? rows : Number(way.game);
  };
  return {
    ...app,
    entry,
    end,
    hold,
    now,
    turn,
    openBoard,
    // 짧은 연습을 연다 — 떨어진 장면이 남긴 열기의 거절이 다른 장면으로 새지 않게 받아 둔다(기다리는 쪽은 그대로 던져진다).
    practice(...args) {
      const run = Promise.resolve(app.education.practice(...args));
      run.catch(() => {});
      return run;
    },
    close() {
      held.forEach(release => release(true));
      for (const call of [...(entry?.calls ?? []), ...(entry?.mocks ?? [])]) call.give(null);
      app.dispose();
    },
  };
}
const BOARDS = ['position', 'plan'];

test('게임 판 끝 — 열린 내 위치 · 이번 주 계획 판과 홈을 판 끝에 한 번, 판이 다시 접힌 뒤 한 번 더 그려 지금 길과 수를 단다(기기 기록부의 요약은 접힌 뒤에야 그 판을 안다 — 사슬 -c 카본 C1 · -d 카본 A1 · -d-r2 GPT GA1) · 접기가 실패하거나 없으면 한 번만 · 닫은 문서는 그리지 않는다', async () => {
  await clearOfWeekEnd();
  for (const board of BOARDS) {
    const t = await foldApp(board);
    try {
      assert.equal(t.now(), 0, '판 끝 앞의 판');
      let [shown, drawn] = [t.shown.length, t.drawn()];
      let want = t.turn();
      const release = t.hold();
      await until(() => t.shown.length > shown, '판 끝에 열린 판을 다시 그린다');
      assert.equal(t.now(), want, '판 끝의 길 · 수');
      assert.ok(t.drawn() > drawn, '판 끝에 홈을 그린다');
      await tick(20);
      [shown, drawn] = [t.shown.length, t.drawn()];
      want = t.turn();
      await tick(20);
      assert.equal(t.shown.length, shown, '접히기 전에는 더 그리지 않는다');
      release(true);
      await until(() => t.shown.length > shown, '접힌 뒤 열린 판을 한 번 더 그린다');
      assert.equal(t.now(), want, '접힌 뒤의 길 · 수');
      assert.ok(t.drawn() > drawn, '접힌 뒤 홈을 한 번 더 그린다');
      await tick(20);
      // 접기가 실패해도(거절) 조용히 지나간다 · 다시 접기가 없는 판 끝은 한 번만 그린다.
      for (const folded of [Promise.reject(Error('접지 못함')), null]) {
        const before = [t.shown.length, t.drawn()];
        t.end(folded);
        await tick(20);
        assert.equal(t.shown.length, before[0] + 1, '판은 판 끝에 한 번만');
        assert.ok(t.drawn() > before[1]);
      }
      // 닫은 문서는 접힌 뒤에도 그리지 않는다.
      const last = t.hold();
      await tick(20);
      const after = [t.shown.length, t.drawn()];
      t.education.dispose();
      last(true);
      await tick(20);
      assert.deepEqual([t.shown.length, t.drawn()], after, '닫은 문서는 그리지 않는다');
    } finally {
      t.close();
    }
  }
});

test('게임 판 끝 — 알림이 온 뒤 접히기 전에 연 판도 접힌 뒤 다시 그린다(판이 열렸는지는 그릴 때마다 본다 — 사슬 -d-r3 GPT GA2) · 열린 판이 없으면 홈만 그린다', async () => {
  await clearOfWeekEnd();
  for (const board of BOARDS) {
    const t = await foldApp(board, { opened: false });
    try {
      const drawn = t.drawn();
      const release = t.hold();
      assert.ok(t.drawn() > drawn, '판 끝에 홈을 그린다');
      assert.equal(t.shown.length, 0, '열린 판이 없다');
      await t.openBoard();
      assert.equal(t.now(), 0, '접기 전의 판');
      const [shown, home] = [t.shown.length, t.drawn()];
      const want = t.turn();
      release(true);
      await until(() => t.shown.length > shown, '접힌 뒤 그 사이 연 판을 다시 그린다');
      assert.equal(t.now(), want, '접힌 뒤의 길 · 수');
      assert.ok(t.drawn() > home, '접힌 뒤 홈도 그린다');
      // 접히기 전에 판을 닫았으면 닫은 판을 다시 열지 않는다.
      const last = t.hold();
      await tick(20);
      t.closePanel();
      const closed = t.shown.length;
      last(true);
      await tick(20);
      assert.equal(t.shown.length, closed, '닫은 판을 다시 열지 않는다');
    } finally {
      t.close();
    }
  }
});

test('여는 중인 짧은 연습 — 판 끝 · 다시 접기 · 은행 도착은 열린 판을 바로 다시 그려 지금 길을 달고, 그 열기는 끊지 않는다(사슬 -d GPT GA1 · -d-r3 GPT GA1)', async () => {
  await clearOfWeekEnd();
  for (const board of BOARDS) {
    const t = await foldApp(board, { practice: true });
    try {
      const opening = t.practice(READING[0]);
      await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
      let shown = t.shown.length;
      let want = t.turn();
      const release = t.hold();
      await until(() => t.shown.length > shown, '판 끝에 열린 판을 다시 그린다');
      assert.equal(t.now(), want, '여는 동안에도 판 끝의 길 · 수를 단다 — 같은 판의 다른 단추가 묵은 길을 열지 않는다');
      await tick(20);
      shown = t.shown.length;
      want = t.turn();
      release(true);
      await until(() => t.shown.length > shown, '접힌 뒤에도 바로 다시 그린다');
      assert.equal(t.now(), want, '접힌 뒤의 길 · 수');
      await tick(20);
      shown = t.shown.length;
      t.education.repaint();
      await until(() => t.shown.length > shown, '은행이 오면 바로 다시 그린다');
      shown = t.shown.length;
      assert.equal(practiceShown(t), 0, '연습은 아직 여는 중이다');
      t.entry.calls[0].give();
      await opening;
      await tick(20);
      assert.equal(t.shown.length, shown + 1, '연습 판 하나만 선다');
      assert.match(t.last(), /data-practice-stage/, '짧은 연습이 열린다');
    } finally {
      t.close();
    }
  }
});

test('다시 그린 뒤 학생이 판을 닫거나 다른 열기로 바꾸면 여는 중이던 연습은 서지 않는다 — 다시 단 자원이 그 열기를 무효로 한다', async () => {
  for (const board of BOARDS) {
    // 판을 닫는다.
    let t = await foldApp(board, { practice: true });
    try {
      const opening = t.practice(READING[0]);
      await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
      t.end(null);
      await tick(20);
      t.closePanel();
      const shown = t.shown.length;
      t.entry.calls[0].give();
      await opening;
      await tick(20);
      assert.equal(t.shown.length, shown, '닫은 뒤에는 서지 않는다');
      // 그 뒤의 새 연습은 열린다.
      const next = t.practice(READING[1]);
      await until(() => t.entry.calls.length === 2, '새 연습의 코치를 기다린다');
      t.entry.calls[1].give();
      await next;
      assert.match(t.last(), /data-practice-stage/, '새 연습은 열린다');
    } finally {
      t.close();
    }
    // 학생이 다른 판을 연다(내 위치 ↔ 이번 주 계획) — 뒤의 다시 그리기가 아니다.
    t = await foldApp(board, { practice: true });
    try {
      const opening = t.practice(READING[0]);
      await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
      t.end(null);
      await tick(20);
      if (board === 'position') assert.equal(await t.education.plan(), 'shown');
      else {
        await t.education.position();
        await until(() => /data-position-next="engine"/.test(t.last()), '엔진 판');
      }
      await tick(20);
      const shown = t.shown.length;
      t.entry.calls[0].give();
      await opening;
      await tick(20);
      assert.equal(t.shown.length, shown, '누른 판을 덮지 않는다');
    } finally {
      t.close();
    }
    // 다른 짧은 연습으로 바꾼다.
    t = await foldApp(board, { practice: true });
    try {
      const first = t.practice(READING[0]);
      await until(() => t.entry.calls.length === 1, '첫 연습의 코치를 기다린다');
      t.end(null);
      await tick(20);
      const second = t.practice(READING[1]);
      await until(() => t.entry.calls.length === 2, '둘째 연습의 코치를 기다린다');
      t.end(null);
      await tick(20);
      const shown = t.shown.length;
      t.entry.calls[0].give();
      await first;
      await tick(20);
      assert.equal(t.shown.length, shown, '앞 연습은 서지 않는다');
      t.entry.calls[1].give();
      await second;
      await tick(20);
      assert.equal(t.shown.length, shown + 1);
      assert.match(t.last(), /data-practice-stage/, '둘째 연습이 열린다');
    } finally {
      t.close();
    }
    // 시험 형식으로 바꾼다 — 시험 형식 코치를 받지 못해 안내 한 줄로 끝난다(시험 형식을 여는 동안의 다시 그리기는 4-4d의 막이 그대로 끝에 한 번이다).
    t = await foldApp(board, { practice: true });
    try {
      const opening = t.practice(READING[0]);
      await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
      t.end(null);
      await tick(20);
      const mocking = t.education.mock();
      await until(() => t.entry.mocks.length === 1, '시험 형식 코치를 기다린다');
      let shown = t.shown.length;
      t.end(null);
      await tick(20);
      assert.equal(t.shown.length, shown, '시험 형식을 여는 중에는 미룬다');
      t.entry.mocks[0].give();
      await mocking;
      await tick(20);
      assert.equal(t.shown.length, shown + 1, '판 없이 끝나면 한 번 다시 그린다');
      shown = t.shown.length;
      t.entry.calls[0].give();
      await opening;
      await tick(20);
      assert.equal(t.shown.length, shown, '버린 연습은 서지 않는다');
    } finally {
      t.close();
    }
  }
});

test('시험 형식을 여는 중에 짧은 연습으로 바꾸면 그 사이 미룬 다시 그리기를 곧 한다 — 연습을 못 열어도 판이 접기 전의 길로 남지 않고, 연습은 끊기지 않는다(사슬 -d-r4 GPT GA1) · 판을 닫으면 그리지 않는다', async () => {
  await clearOfWeekEnd();
  for (const board of BOARDS)
    for (const coach of [null, {}]) {
      const t = await foldApp(board, { practice: true });
      try {
        const mocking = t.education.mock();
        await until(() => t.entry.mocks.length === 1, '시험 형식 코치를 기다린다');
        const shown = t.shown.length;
        const want = t.turn();
        t.end(Promise.resolve(true));
        await tick(20);
        assert.equal(t.shown.length, shown, '시험 형식을 여는 중에는 미룬다');
        const item = worldPosition.practice.pool.find(row => row.skillId === READING[0]);
        const opening = t.practice(null, { only: [item.itemKey] });
        await until(() => t.shown.length === shown + 1, '연습으로 바꾸면 미룬 다시 그리기를 곧 한다');
        assert.equal(t.now(), want, '판 끝 뒤의 길 · 수');
        await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
        t.entry.mocks[0].give();
        await mocking;
        await tick(20);
        assert.equal(t.shown.length, shown + 1, '버린 시험 형식은 다시 그리지 않는다');
        t.entry.calls[0].give(coach);
        await opening;
        await tick(20);
        assert.equal(practiceShown(t), coach ? 1 : 0, '바꾼 연습 열기는 끊기지 않는다');
        assert.equal(t.shown.length, shown + (coach ? 2 : 1));
      } finally {
        t.close();
      }
    }
  // 판을 닫으면 그 정리는 닫은 판을 다시 열지 않는다.
  for (const board of BOARDS) {
    const t = await foldApp(board, { practice: true });
    try {
      const mocking = t.education.mock();
      await until(() => t.entry.mocks.length === 1, '시험 형식 코치를 기다린다');
      t.end(null);
      await tick(20);
      t.closePanel();
      const shown = t.shown.length;
      t.entry.mocks[0].give();
      await mocking;
      await tick(20);
      assert.equal(t.shown.length, shown, '닫은 판을 다시 열지 않는다');
    } finally {
      t.close();
    }
  }
});

test('판을 그리지 않고 끝난 연습 열기(코치를 못 받음 · 판을 짓다 던짐) 뒤에도 열린 판은 판 끝마다 다시 그려지고 새 연습이 열린다', async () => {
  await clearOfWeekEnd();
  for (const board of BOARDS)
    for (const broken of [false, true]) {
      const t = await foldApp(board, { practice: true, broken });
      try {
        const item = worldPosition.practice.pool.find(row => row.skillId === READING[0]);
        // 「다시 확인」 카드로 연 판(only)은 새 길 코치를 못 받으면 열지 않는다. broken이면 코치를 받고 판을 짓다 던진다.
        const opening = t.practice(null, { only: [item.itemKey] });
        await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
        t.entry.calls[0].give(broken ? {} : null);
        if (broken) await assert.rejects(opening, /판을 짓지 못했다/);
        else await opening;
        assert.equal(practiceShown(t), 0, '연습 판은 서지 않았다');
        for (let i = 0; i < 2; i += 1) {
          const shown = t.shown.length;
          const want = t.turn();
          t.end(null);
          await tick(20);
          assert.equal(t.shown.length, shown + 1, '판 끝마다 다시 그린다');
          assert.equal(t.now(), want);
        }
        t.entry.broken = false;
        const next = t.practice(READING[1]);
        await until(() => t.entry.calls.length === 2, '새 연습의 코치를 기다린다');
        t.end(null);
        await tick(20);
        t.entry.calls[1].give();
        await next;
        assert.match(t.last(), /data-practice-stage/, '새 연습은 열린다');
      } finally {
        t.close();
      }
    }
});

test('여는 중에 문서를 닫으면 판 끝 · 접힌 뒤의 그리기도 연습도 서지 않는다', async () => {
  const t = await foldApp('plan', { practice: true });
  try {
    const opening = t.practice(READING[0]);
    await until(() => t.entry.calls.length === 1, '연습 코치를 기다린다');
    const release = t.hold();
    await tick(20);
    const after = [t.shown.length, t.drawn()];
    t.education.dispose();
    release(true);
    t.entry.calls[0].give();
    await Promise.allSettled([opening]);
    await tick(20);
    assert.deepEqual([t.shown.length, t.drawn()], after, '닫은 문서는 그리지 않는다');
  } finally {
    t.close();
  }
});

// 꺼진 판(atlasNext · homeNext 없음 — 앱이 기능 꺼짐에서 넘기는 값)은 지금 그대로다(5-3 꺼진 판 대조): 짧은 연습을 여는 동안에도 은행 도착의 다시
// 그리기가 열린 판을 바로 그리고, 그 정리가 여는 중인 연습을 무효로 한다(master 2a3a74e85a 그대로 — 자원을 넘기는 것은 새 길 문서뿐이다). 라이브 ③은
// 꺼진 문서에서 연습 열기에 자원을 달지 않아 연습이 선다 — 5-3은 라이브 판에 이 묶음의 줄만 얹으므로 그 차이는 이 묶음이 싣지 않는다.
test('꺼진 판 — 짧은 연습을 여는 동안 온 다시 그리기는 지금처럼 열린 판을 바로 그리고 그 열기를 무효로 한다(새 길의 이어 주기가 서지 않는다 — 사슬 -d-r3)', async () => {
  const shown = [];
  let kind = '';
  let resource = null;
  let hold = null;
  let release = () => {};
  const drop = () => {
    const was = resource;
    resource = null;
    was?.dispose?.();
  };
  const node = () => ({ isConnected: true, focus() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], contains: () => false, addEventListener() {}, insertAdjacentHTML() {} });
  const storage = new Map();
  const target = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    document: {
      querySelector(selector) {
        const found = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(selector);
        const html = shown.at(-1) ?? '';
        if (!found) return null;
        return (found[2] === undefined ? new RegExp(`\\s${found[1]}(?=[\\s=>])`).test(html) : html.includes(`${found[1]}="${found[2]}"`)) ? node() : null;
      },
    },
  };
  const progress = {
    owner: 'guest',
    learningProfile: () => ({ profile: { status: 'active', revision: 1, consent: true } }),
    learningProfileValues: () => ({ audio: 'off', ...EXAM_T1 }),
    status: () => ({ phase: 'synced', rejected: false, scoped: false, message: '' }),
    exportSnapshot: () => ({}),
    flush: async () => {},
    hangulReading: () => ({ answer: 'reads' }),
  };
  const home = {
    updateStudy() {},
    toast() {},
    closePanel() {},
    openPanel: () => kind,
    attachPanelResource(value) {
      if (value === resource) return;
      const was = resource;
      resource = value;
      was?.dispose?.();
    },
    showPanel(title, html, options = {}) {
      drop();
      kind = options?.type || 'life-position';
      shown.push(String(html));
    },
  };
  const education = createWorldEducation({
    home,
    getProgress: () => progress,
    engine: worldLearning,
    createPlan: input => ({ selected: null, reason: '', examPlan: input.examPlan ?? null }),
    launchGame() {},
    startLesson() {},
    startReview() {},
    prepare: () => hold ?? Promise.resolve(),
    position: worldPosition,
    target,
  });
  try {
    for (const open of ['position', 'plan']) {
      await education[open]();
      assert.match(shown.at(-1), open === 'plan' ? /data-plan-board/ : /data-position-board[\s=>]/, '지금 판 판');
      hold = new Promise(resolve => (release = resolve));
      const opening = education.practice(READING[0]);
      await tick(5);
      const boards = shown.length;
      education.repaint();
      await until(() => shown.length > boards, '여는 동안에도 열린 판을 다시 그린다');
      hold = null;
      release();
      await opening;
      await tick(5);
      assert.ok(!shown.some(html => html.includes('data-practice-stage')), '정리된 열기는 서지 않는다');
    }
  } finally {
    release();
    education.dispose();
  }
});

test('짧은 진단 결과의 「이 항목 연습하기」도 내 위치와 같은 길이다 — 길이 게임이면 그 게임을 열고, 길이 없으면 단추가 없다(사슬 -c GC2)', async () => {
  // 소리를 켠 학생이다. 진단은 읽기 문항만 낸다(이 시험에는 재생기가 없다). 길 표의 답을 능력마다 바꿔 끼워, 결과 화면이 스스로 고르지 않고 길 표의 답을 다는지 본다.
  const position = { ...positionPlanner, selectDiagnosticNext: options => positionPlanner.selectDiagnosticNext({ ...options, audioAvailable: false }) };
  for (const [before, way] of [['game', 'game'], [null, null], ['game', null], [null, 'game']]) {
    // 진단이 낸 문항이 길을 바꾼다 — 진단 문항이 그 능력의 마지막 새 문항이면 답한 뒤 길이 사라진다. 끝 화면은 진단 뒤의 길을 단다(사슬 -d GA3).
    let now = before;
    const open = { id: 'world.play.rhythm', label: '말의 리듬', route: 'game', gameId: 'rhythm', minutes: 3, supports: [], targets: [] };
    const answerOf = id => (now ? { skillId: id, route: 'game', gameId: 'rhythm', id: open.id, practice: [], games: [{ id: open.id, gameId: 'rhythm', open, items: [], left: 0 }] } : { skillId: id, route: null, practice: [], games: [] });
    const routes = options => ({ ...createRoutes(options), routeOf: answerOf, reader: () => answerOf });
    const app = shell({ values: { audio: 'available', ...EXAM_T1 }, planner: async () => ({ ...PLANNER, position, createRoutes: routes }) });
    try {
      app.education.refresh();
      await until(() => engineHome(app), '엔진 판의 이번 주 계획');
      await app.education.position();
      await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
      await app.education.position({ start: true });
      await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
      now = way;
      assert.ok((await answerItems(app)) > 0);
      await until(() => app.box().html.includes('data-position-done'), '진단 끝 화면');
      const skills = [...app.box().html.matchAll(/data-position-practice="([^"]+)"/g)].map(match => match[1]);
      if (way) {
        assert.ok(skills.length > 0, '결과의 능력에 단추가 선다');
        app.box().practice(skills[0]).click();
        await tick();
        assert.deepEqual(app.launched, ['rhythm'], '길이 게임이면 그 게임을 연다');
      } else assert.deepEqual(skills, [], '길이 없는 능력에는 단추가 없다');
    } finally {
      app.dispose();
    }
  }
});

test('새 길 짧은 진단을 도중에 그만두면 채점된 첫 답이 있을 때만 판 기록에 적고, 한 판에 한 번만 센다', async () => {
  for (const [count, expected] of [[1, ['recheck']], [0, []]]) {
    const logs = new Map();
    const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
    const app = shell({ planLog: made => (made ? createPlanLog({ storage: memory, store: 'synk-atlas:guest' }) : null) });
    try {
      app.education.refresh();
      await until(() => engineHome(app), '엔진 판의 이번 주 계획');
      await app.education.position();
      await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
      await app.education.position({ start: true });
      await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
      if (count) assert.equal(await answerItems(app, count), count);
      app.box().press('data-position-stop');
      app.box().press('data-position-stop');
      await tick(20);
      const rows = JSON.parse(logs.get('synk.world.plan-log.v1:synk-atlas:guest') ?? '{"rows":[]}').rows;
      assert.deepEqual(rows.map(row => row.area), expected, count ? '그만둔 판도 답이 있으면 한 판' : '답 없이 그만둔 판은 세지 않는다');
    } finally {
      app.dispose();
    }
  }
});

test('답 없이 끝난 판도 판 끝이다 — 요약이 그대로여도 이번 주 계획이 묶음 만남을 다시 묻는다(띄우기만 한 문항 · 카본 A8 · 4-4b 끝 판 카본 C2 뒤)', async () => {
  // 이번 주 계획(weekNext)이 물은 것만 센다 — 내 위치 판(nextData)도 같은 풀로 묻는다.
  let weekAsked = 0;
  const app = shell({
    wrap: made => ({
      ...made,
      exposures(items) {
        if (/weekNext/.test(new Error().stack ?? '')) weekAsked += 1;
        return made.exposures(items);
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    const shape = JSON.stringify(app.coaches.at(-1).summary().skills);
    app.education.refresh();
    const before = weekAsked;
    app.box().press('data-position-stop');
    app.box().press('data-position-stop');
    await tick(20);
    assert.equal(JSON.stringify(app.coaches.at(-1).summary().skills), shape, '답이 없으니 요약의 능력 줄은 그대로다');
    app.education.refresh();
    assert.ok(weekAsked > before, '판이 끝났으니 다시 묻는다 — 띄우기만 한 문항은 이제 처음 보는 문항이 아니다');
  } finally {
    app.dispose();
  }
});

test('계정의 기록이 다 오면(첫 받기 · 뒤의 받기) 묶음 만남을 다시 묻는다 — 기록 일부일 때의 판정이 그날 내내 굳지 않는다(카본 A8)', async () => {
  let pulled = false;
  const asked = [];
  const app = shell({
    wrap: made => ({
      ...made,
      summary() {
        const summary = made.summary();
        return { ...summary, storage: { ...summary.storage, guest: false, sync: { ...summary.storage.sync, pulled } } };
      },
      exposures(items) {
        asked.push(items.length);
        return made.exposures(items);
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.ok(!app.plan().examPlan.notes.includes('start'), '기록 일부면 시작점으로 단정하지 않는다');
    const before = asked.length;
    app.education.refresh();
    assert.equal(asked.length, before, '기록 상태가 그대로면 다시 묻지 않는다');
    pulled = true;
    app.education.refresh();
    assert.equal(asked.length, before + 1, '받기가 되어 기록이 다 오면 다시 묻는다');
    assert.ok(app.plan().examPlan.notes.includes('start'), '기록이 다 온 새 학생은 시작점');
  } finally {
    app.dispose();
  }
});

test('서버 길 계정의 기록이 다 오기 전에 그린 홈은 받기 알림(receive)으로 다시 그린다 — 다시 보기 타이머 없이, 학생이 화면을 건드리지 않아도 시작점이 풀린다(4-4b 끝 판 카본 C1 · §21-20)', async () => {
  const sync = { pulled: false };
  const { counted, wrap, emit } = accountWrap(sync);
  const app = shell({ fast: true, wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.ok(!app.plan().examPlan.notes.includes('start'), '기록 일부면 시작점으로 단정하지 않는다');
    assert.equal(counted.listeners.size, 1, '홈 코치 하나에 한 번 듣는다');
    // 알림이 오기 전에는 아무것도 다시 보지 않는다 — 셸이 거는 타이머가 없다(설계 주인 11-16 오후 조건 4).
    const mark = app.waits.length;
    await tick(150);
    assert.deepEqual(app.waits.slice(mark), [], '다시 보기 타이머가 없다');
    sync.pulled = true;
    emit('receive');
    await until(() => app.plan().examPlan.notes.includes('start'), '받기 알림으로 홈이 다시 그려진다');
    assert.ok(app.plan().today.items.some(row => row.kind === 'check'), '점검 칸에 짧은 진단');
  } finally {
    app.dispose();
  }
  assert.equal(counted.listeners.size, 0, '문서를 닫으면 듣기를 되돌린다');
});

test('다른 기기의 답이 받기로 접혀 오면(요약이 바뀌면) 묶음 만남을 다시 묻는다 — 기록이 다 온 탭이 열린 채여도 옛 만남에 굳지 않는다(4-4b 끝 판 카본 C2)', async () => {
  let elsewhere = null;
  const asked = [];
  const app = shell({
    wrap: made => ({
      ...made,
      summary() {
        const summary = made.summary();
        return elsewhere ? { ...summary, skills: [...summary.skills, elsewhere] } : summary;
      },
      exposures(items) {
        asked.push(items.length);
        return made.exposures(items);
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const before = asked.length;
    app.education.refresh();
    assert.equal(asked.length, before, '요약이 그대로면 다시 묻지 않는다(카본 A8)');
    // 다른 기기에서 읽기 문항 셋을 혼자 풀어 그 답이 받기로 접혀 왔다.
    elsewhere = { id: 'ko.reading.detail', theta: 0, n: 3, streak: 1, level: 1, peak: 1, cells: [{ difficulty: 1, independent: 3, correct: 2, helped: 0, lastAt: Date.now() }] };
    app.education.refresh();
    assert.equal(asked.length, before + 1, '요약이 바뀌면 다시 묻는다');
    app.education.refresh();
    assert.equal(asked.length, before + 1, '바뀐 요약이 그대로면 또 묻지 않는다');
  } finally {
    app.dispose();
  }
});

// 서버 길 계정처럼 보이는 홈 코치 — storage.sync를 시험이 바꾼다. weekAsked는 이번 주 계획(weekNext)이 물은 묶음 만남만 센다. 받기 알림
// (coach.watch)은 시험이 emit으로 낸다 — 진짜 코치는 요약이 바뀐 뒤에 알리므로(§21-20 조건 2), 시험도 요약을 바꾼 뒤에 낸다.
function accountWrap(sync, extra = {}) {
  const counted = { weekAsked: 0, shift: null, met: null, listeners: new Set() };
  const wrap = made => ({
    ...made,
    summary() {
      const summary = made.summary();
      const skills = counted.shift ? [...summary.skills, counted.shift] : summary.skills;
      return { ...summary, skills, storage: { ...summary.storage, guest: false, sync: { ...summary.storage.sync, ...sync } } };
    },
    exposures(items) {
      if (/weekNext/.test(new Error().stack ?? '')) counted.weekAsked += 1;
      const out = made.exposures(items);
      return counted.met ? counted.met(out) : out;
    },
    watch(listener) {
      counted.listeners.add(listener);
      return () => counted.listeners.delete(listener);
    },
    ...extra,
  });
  const emit = kind => {
    for (const listener of [...counted.listeners]) listener({ kind });
  };
  return { counted, wrap, emit };
}
const OTHER_DEVICE = { id: 'ko.reading.detail', theta: 0, n: 3, streak: 1, level: 1, peak: 1, cells: [{ difficulty: 1, independent: 3, correct: 2, helped: 0, lastAt: Date.UTC(2026, 10, 16) }] };

test('받기가 언제 되든(끊긴 뒤 사다리의 300초 칸이어도) 그 받기가 접어 온 다른 기기의 답은 receive 알림으로 홈을 다시 그린다 — 깨어난 때와 상관없다(§21-20 시험 1 · 4-4b 다시 검수 GPT GA1)', async () => {
  // 셸에는 시간 창이 없다 — 받기가 몇 초 뒤에 되든 엔진이 요약을 바꾼 뒤 알리고, 셸은 그 알림으로 그린다. 사다리의 칸(5 · 15 · 60 · 300초)은
  // 엔진 시험(packages/atlas/test/coach/sync.test.mjs)이 보고, 받기가 알리는지는 packages/atlas/test/coach/watch.test.mjs가 본다.
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const before = counted.weekAsked;
    await tick(50);
    assert.equal(counted.weekAsked, before, '알림 전에는 다시 묻지 않는다');
    counted.shift = OTHER_DEVICE;
    emit('receive');
    assert.equal(counted.weekAsked, before, '알림을 받은 자리에서는 그리지 않는다(다음 틱)');
    await until(() => counted.weekAsked > before, '받기 알림으로 홈이 다시 그려진다');
  } finally {
    app.dispose();
  }
});

test('같은 브라우저의 다른 창에서 쓴 답은 refresh 알림으로 이 창의 홈에 닿는다 — 이 창은 누르지 않는다(초점 · 화면 복귀 없이, §21-20 시험 2)', async () => {
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const before = counted.weekAsked;
    counted.shift = OTHER_DEVICE;
    emit('refresh');
    await until(() => counted.weekAsked > before, 'refresh 알림으로 홈이 다시 그려진다');
  } finally {
    app.dispose();
  }
});

test('다른 창에서 건너뛰기만 한 판의 만남도 이 창의 이번 주 계획 묶음 만남에 비친다 — 요약 모양이 그대로여도 알림이 만남을 버린다(§21-20 시험 3 · Fable FA1)', async () => {
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const before = counted.weekAsked;
    // 채점된 답이 없어 요약 모양은 그대로이고 만남만 바뀐다 — 알림이 없으면 그대로 굳는다.
    counted.met = out => out.map(row => ({ ...row, seen: true }));
    app.education.refresh();
    assert.equal(counted.weekAsked, before, '알림 없이 다시 그리면 요약 모양이 그대로라 묻지 않는다');
    emit('refresh');
    await until(() => counted.weekAsked > before, '알림이 묶음 만남을 버려 다시 묻는다');
  } finally {
    app.dispose();
  }
});

test('올리기 막힘(writesOff)이 풀려 올린 답의 receive 알림으로 홈이 기록이 다 온 판으로 다시 그려진다 — 막힘 동안은 다시 그리지 않는다(§21-20 시험 4 · Fable FA3)', async () => {
  const sync = { pulled: true, writesOff: true };
  const { wrap, emit } = accountWrap(sync);
  const app = shell({ wrap, fast: true });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.ok(!app.plan().examPlan.notes.includes('start'), '올리기가 막힌 동안은 기록 일부다');
    await tick(100);
    const quiet = app.drawn();
    await tick(300);
    assert.equal(app.drawn(), quiet, '알림 없이는 다시 그리지 않는다');
    sync.writesOff = false;
    emit('receive');
    await until(() => app.plan().examPlan.notes.includes('start'), '막힘이 풀려 올린 답의 알림으로 다시 그린다');
  } finally {
    app.dispose();
  }
});

test('잇달아 온 알림은 다음 틱에 한 번만 그린다 — 받은 자리에서는 그리지 않는다(§21-20 조건 3)', async () => {
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    await tick(30);
    const drawn = app.drawn();
    const asked = counted.weekAsked;
    counted.shift = OTHER_DEVICE;
    emit('receive');
    emit('refresh');
    emit('receive');
    assert.equal(app.drawn(), drawn, '받은 자리에서는 그리지 않는다');
    await tick(40);
    assert.equal(app.drawn(), drawn + 1, '한 번만 그린다');
    assert.equal(counted.weekAsked, asked + 1, '묶음 만남도 한 번만 묻는다');
  } finally {
    app.dispose();
  }
});

test('열린 이번 주 계획 판도 받기 알림으로 한 번 다시 그린다 — 판 뒤의 홈만 그리지 않는다(받기 알림 설계 검토 D3)', async () => {
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.equal(await app.education.plan(), 'shown');
    await tick(30);
    const boards = () => app.shown.filter(html => /data-plan-board/.test(html)).length;
    const before = boards();
    counted.shift = OTHER_DEVICE;
    emit('receive');
    await until(() => boards() > before, '열린 계획 판을 다시 그린다');
    await tick(40);
    assert.equal(boards(), before + 1, '한 번만 그린다');
  } finally {
    app.dispose();
  }
});

// 계획 판 단추의 속성(셸의 PLAN_FOCUS와 같은 이름) — 판 글에 있는 것 가운데 하나를 골라 초점을 둔다.
const PLAN_BUTTONS = ['data-plan-practice', 'data-plan-recheck', 'data-plan-next', 'data-plan-mock', 'data-plan-writing', 'data-plan-speaking', 'data-plan-game', 'data-view'];

test('열린 이번 주 계획 판을 받기 알림으로 다시 그려도 판 안의 초점과 스크롤 자리를 지킨다 — 홈은 판 글을 바꿀 때마다 닫기 단추에 초점을 둔다(4-4b 다시 검수 -d GPT GA1 · Fable)', async () => {
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap, focusing: true });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.equal(await app.education.plan(), 'shown');
    await tick(30);
    const html = app.last();
    const pick = PLAN_BUTTONS.map(name => ({
      name,
      values: [...html.matchAll(new RegExp(`\\s${name}(?:="([^"]*)")?(?=[\\s>])`, 'g'))].map(match => match[1] ?? ''),
    })).find(row => row.values.length);
    assert.ok(pick, '계획 판에 단추가 있다');
    // 같은 값의 단추가 여럿이면 마지막 것 — 몇 번째였는지까지 되돌리는지 본다.
    const value = pick.values.at(-1);
    const index = pick.values.filter(item => item === value).length - 1;
    app.focusOn(pick.name, value, index);
    app.content.scrollTop = 240;
    const boards = () => app.shown.filter(text => /data-plan-board/.test(text)).length;
    const before = boards();
    const mark = app.focused.length;
    counted.shift = OTHER_DEVICE;
    emit('receive');
    await until(() => boards() > before, '열린 계획 판을 다시 그린다');
    await tick(40);
    assert.equal(app.content.scrollTop, 240, '스크롤 자리를 지킨다');
    assert.deepEqual(app.focused.slice(mark), [`${pick.name}=${value}#${index}`], '판 안의 같은 단추로 초점을 되돌린다');
  } finally {
    app.dispose();
  }
});

test('겉에 받기 알림(watch)이 아예 없는 엔진 코치면(받기 알림 앞의 입구 판이 실린 때) 이 문서는 지금 판으로 내린다 — 조용히 듣지 않으면 다른 기기의 답을 놓친다(4-4b 다시 검수 -d Fable P3)', async () => {
  const { wrap } = accountWrap({ pulled: true }, { watch: undefined });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => app.coaches.length > 0 && app.plan() && app.plan().today?.state !== 'checking', '판이 선다');
    await tick(30);
    assert.equal(typeof app.coaches[0].watch, 'undefined', '겉에 watch가 없다');
    assert.notEqual(app.plan()?.today?.state, 'engine', '새 길 홈이 아니다 — 지금 판으로 내렸다');
    assert.ok(app.opens.length > 0, '지금 판이 옛 코치를 연다');
  } finally {
    app.dispose();
  }
});

test('생활 레슨 · 복습 · 카페 판이 열린 동안 온 알림은 그 자리에서 홈과 묶음 만남을 다시 짓지 않는다 — 판을 닫으며 그리는 한 번에 비친다(받기 알림 설계 검토 D8)', async () => {
  const { counted, wrap, emit } = accountWrap({ pulled: true });
  const app = shell({ wrap });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    await tick(30);
    counted.shift = OTHER_DEVICE;
    for (const kind of ['life-question', 'life-review', 'life-cafe']) {
      app.state.panel = kind;
      const at = { drawn: app.drawn(), asked: counted.weekAsked };
      emit('receive');
      await tick(30);
      assert.deepEqual({ drawn: app.drawn(), asked: counted.weekAsked }, at, `${kind} 판이 열린 동안은 다시 짓지 않는다`);
    }
    // 판을 닫는다 — 홈의 closePanel이 다음 마이크로태스크에 부르는 새로 그리기가 미룬 알림을 비춘다.
    app.state.panel = '';
    const asked = counted.weekAsked;
    app.education.refresh();
    assert.equal(counted.weekAsked, asked + 1, '닫으며 그리는 한 번에 묶음 만남을 다시 묻는다');
    const drawn = app.drawn();
    await tick(40);
    assert.equal(app.drawn(), drawn, '그 뒤 미룬 알림으로 또 그리지 않는다');
  } finally {
    app.dispose();
  }
});

test('받기 알림을 걸지 못하는 엔진 판이면(입구의 겉에는 watch가 있으나 실린 판에 없음 — 엔진만 앞 판으로 되돌린 때) 이 문서는 지금 판으로 내린다(받기 알림 설계 검토 D5)', async () => {
  const { wrap } = accountWrap(
    { pulled: true },
    {
      watch() {
        throw new TypeError('real[name] is not a function');
      },
    },
  );
  const app = shell({ wrap });
  try {
    app.education.refresh();
    // 홈 코치가 서고 판이 확인 중을 벗어난 뒤에 본다 — 확인 중에는 새 길이든 지금 판이든 같다.
    await until(() => app.coaches.length > 0 && app.plan() && app.plan().today?.state !== 'checking', '판이 선다');
    await tick(30);
    assert.notEqual(app.plan()?.today?.state, 'engine', '새 길 홈이 아니다 — 지금 판으로 내렸다');
    assert.ok(app.opens.length > 0, '지금 판이 옛 코치를 연다');
  } finally {
    app.dispose();
  }
});

test('확인 중에 학생이 누른 계획 열기는 기다린 사이 다른 판을 열었으면 덮지 않는다(4-4b 다시 검수 Fable FA2)', async () => {
  let release = null;
  const app = shell({ planner: () => new Promise(resolve => (release = () => resolve(PLANNER))) });
  try {
    const opening = app.education.plan();
    await tick(20);
    app.state.panel = 'life-review';
    release();
    assert.equal(await opening, 'skipped', '그사이 연 판을 덮지 않는다');
    assert.ok(!app.shown.some(html => /data-plan-board/.test(html)), '계획 판을 그리지 않는다');
  } finally {
    app.dispose();
  }
});

test('확인 중에 연 계획 열기가 판을 기다리는 사이 문서가 닫히면 기다림이 곧 풀린다 — 8초 한도까지 매달리지 않는다(4-4b 다시 검수 카본 A1)', async () => {
  const app = shell({ planner: () => new Promise(() => {}) });
  const opening = app.education.plan().then(
    value => ({ value }),
    error => ({ error }),
  );
  await tick(20);
  const started = Date.now();
  app.dispose();
  const settled = await Promise.race([opening, tick(2000).then(() => 'hung')]);
  assert.notEqual(settled, 'hung', '닫으면 기다림이 곧 풀린다');
  assert.ok(Date.now() - started < 1000);
  assert.ok(!app.shown.some(html => html.includes('world-study-form') || /data-plan-board/.test(html)), '닫힌 뒤에는 아무 판도 열지 않는다');
});

// 앱(app-shell.mjs)의 배선 — 셸은 판 기록을 홈 입구(homeNext.planLog)로만 연다. 앱이 그 칸을 넘기지 않으면 시험 틀(위 shell())만 기록이 서고
// 실제 앱에서는 새 길 판이 끝나도 이번 주에 한 판을 세지 못한다(11-16 4c가 올리기 전에 찾음). 셸은 node에서 못 올리므로 원문의 두 자리를 본다.
test('앱이 셸에 넘기는 홈 입구에 판 기록(planLog)이 있고, 입구 감싸기가 입구의 planLog로 잇는다(4-4b)', () => {
  const shellSource = fs.readFileSync(new URL('../app-shell.mjs', import.meta.url), 'utf8');
  const home = shellSource.split(/\r?\n/).filter(line => line.includes('const homeNext=lifeDue?{'));
  assert.equal(home.length, 1, '홈 입구를 짓는 자리는 하나');
  assert.ok(home[0].includes('planLog:coach=>atlasNext.planLog(coach)'), '홈 입구가 판 기록을 넘긴다');
  assert.ok(shellSource.includes('planLog:coach=>made&&!disposed?made.planLog?.(coach)??null:null'), '입구 감싸기가 입구의 planLog로 잇는다(입구를 받기 전 · 닫은 뒤는 null)');
});

// 검수 s3d G3: 기기 기록부(손님 · 동의를 끈 계정)에서 새 길 짧은 진단을 도중에 그만두면 판이 그 답으로 다시 접힌다. 접힌 뒤 홈(세 줄 · 이번 주 계획)을
// 한 번 더 그린다 — 엔진의 watch는 같은 문서 안의 접기를 알리지 않아, 그대로면 다른 계기 전까지 홈이 접기 전 요약에 머문다.
test('새 길 짧은 진단을 도중에 그만두면 판이 그 답으로 다시 접힌 뒤 홈을 한 번 더 그린다(검수 s3d G3)', async () => {
  let release = () => {};
  const hold = new Promise(resolve => (release = resolve));
  let held = 0;
  const app = shell({
    wrap: made => ({
      ...made,
      finishSet(options) {
        const out = made.finishSet(options);
        if (!out?.folded) return out;
        held += 1;
        return { ...out, folded: hold.then(() => out.folded) };
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    assert.equal(await answerItems(app, 1), 1, '한 문항 답한다');
    app.box().press('data-position-stop');
    await tick(20);
    assert.equal(held, 1, '판을 닫으며 다시 접기를 기다린다');
    const before = app.drawn();
    await tick(20);
    assert.equal(app.drawn(), before, '접기 전에는 더 그리지 않는다');
    release();
    await until(() => app.drawn() > before, '접힌 뒤 홈을 다시 그린다');
  } finally {
    release();
    app.dispose();
  }
});

test('확인 중에 연 계획 열기는 기다린 사이 학생이 누른 다른 학습(같은 카드의 「짧은 진단 시작하기」)을 덮지 않는다 — 판이 아직 서지 않은 열기는 판 종류로 가릴 수 없다(검수 s3e1 GB4)', async () => {
  let release = null;
  const app = shell({ planner: () => new Promise(resolve => (release = () => resolve(PLANNER))) });
  try {
    const opening = app.education.plan();
    await tick(20);
    const starting = app.education.position({ start: true });
    release();
    assert.equal(await opening, 'skipped', '나중에 누른 학습을 덮지 않는다');
    await starting;
    assert.ok(!app.shown.some(html => /data-plan-board/.test(html)), '계획 판을 그리지 않는다');
    await until(() => app.box()?.html.includes('data-position-run'), '나중에 누른 진단이 시작된다');
  } finally {
    app.dispose();
  }
});
