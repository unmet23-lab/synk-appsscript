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
import { homeBanksOf, planPlanner, positionPlanner } from '../world-atlas-next.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from '../world-today.mjs';
import { createPlanLog } from '../world-plan-next.mjs';

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
const EXAM_T2 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik2', targetGrade: 4, examDate: '2027-04-18', weeklyMinutes: 120 };
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, ms = 8000) {
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
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:plan-shell-${process.pid}-${stores}` },
  });
  await coach.ready;
  return coach;
}

// 판 상자: innerHTML 글을 들고 단추 누르기만 흉내 낸다.
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

// 셸 하나 — 새 길 홈 입구(homeNext)를 넘긴 학습 화면. values: 학습 목표 값(시험 정보). planLog(made): 입구의 판 기록(시험은 기기 저장소 하나).
// wrap: 홈 코치에 얹을 것(묶음 만남을 세거나 기록부를 계정처럼 보이게).
// planner: 입구가 플래너를 주는 때(끝내 주지 않으면 홈이 확인 중에 머문다). fast: 창의 시계를 30ms로 줄인다(기다림 한도를 넘기는 장면).
function shell({ values = { audio: 'off', ...EXAM_T1 }, wrap = made => made, planLog = null, planner = async () => PLANNER, fast = false } = {}) {
  const opens = [];
  const toasts = [];
  const waits = [];
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
  let box = null;
  const storage = new Map();
  const document = {
    visibilityState: 'visible',
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
    querySelector(selector) {
      const html = shown.at(-1) ?? '';
      if (selector.includes('[data-position-stage]')) return box && html.includes('data-position-stage') ? box : null;
      const found = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(selector);
      if (!found) return null;
      const [, name, value] = found;
      const hit = value === undefined ? new RegExp(`\\s${name}(?=[\\s=>])`).test(html) : html.includes(`${name}="${value}"`);
      return hit ? { isConnected: true, focus() {}, closest: () => null, querySelector: () => null, querySelectorAll: () => [], contains: () => false, addEventListener() {}, insertAdjacentHTML() {} } : null;
    },
  };
  const target = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document,
    addEventListener() {},
    removeEventListener() {},
    setTimeout: fast
      ? (fn, ms) => {
          waits.push(ms);
          return setTimeout(fn, Math.min(ms, 30));
        }
      : setTimeout,
  };
  const state = { values };
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
    attachPanelResource() {},
    openPanel: () => null,
    showPanel(title, html) {
      shown.push(String(html));
      if (/data-position-stage/.test(html)) box = stage();
    },
  };
  const homeNext = {
    async coach() {
      const made = wrap(await homeCoach());
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
    coaches,
    state,
    last: () => shown.at(-1) ?? '',
    toasts,
    waits,
    box: () => box,
    plan: () => education.metrics().plan,
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

test('TOPIK II 학생 — 새 길 홈에는 쓰기 · 말하기 줄이 없고, 배우기 허브의 쓰기 줄은 지금처럼 위로 올라간다(설계 주인 11-16 조건 3 — 4-4d가 첫 장면을 뒤집는다)', async () => {
  const app = shell({ values: { audio: 'off', ...EXAM_T2 } });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    const plan = app.plan();
    assert.equal(plan.examPlan.exam.type, 'topik2');
    assert.ok(!plan.today.items.some(row => ['writing', 'speaking'].includes(row.route)), '새 길 홈에 쓰기 · 말하기 줄이 없다');
    assert.ok(!plan.candidates.some(open => ['writing', 'speaking'].includes(open.route)));
    assert.equal(app.education.examType(), 'topik2', '허브는 이 값으로 TOPIK II 학생의 쓰기 줄을 맨 위에 둔다(지금 판과 같다)');
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
    assert.ok(!app.plan().today.items.some(row => row.kind === 'check'), '이번 주 다시 확인을 마쳤으니 점검 칸의 진단 줄이 없다');
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

test('서버 길 계정의 기록이 다 오기 전에 그린 홈은 받기가 되면 스스로 다시 그린다 — 학생이 화면을 건드리지 않아도 시작점이 풀린다(4-4b 끝 판 카본 C1)', async () => {
  let pulled = false;
  const app = shell({
    fast: true,
    wrap: made => ({
      ...made,
      summary() {
        const summary = made.summary();
        return { ...summary, storage: { ...summary.storage, guest: false, sync: { ...summary.storage.sync, pulled } } };
      },
    }),
  });
  try {
    app.education.refresh();
    await until(() => engineHome(app), '엔진 판의 이번 주 계획');
    assert.ok(!app.plan().examPlan.notes.includes('start'), '기록 일부면 시작점으로 단정하지 않는다');
    // 내 위치 판을 열지 않았다 — 판의 첫 받기 답(nextSync)이 없어도 엔진의 pulled로 「기록이 다 왔는가」가 풀린다.
    // 받기를 기다리는 간격은 2초부터 두 배씩, 60초에서 멈춘다(내 위치 판의 watchPulled와 같다 — 창의 시계가 받은 값).
    await until(() => app.waits.filter(ms => ms >= 2000).length >= 7, '받기 기다림이 60초 칸까지 간다');
    assert.deepEqual(app.waits.filter(ms => ms >= 2000).slice(0, 7), [2000, 4000, 8000, 16000, 32000, 60000, 60000]);
    pulled = true;
    await until(() => app.plan().examPlan.notes.includes('start'), '받기가 되면 홈이 스스로 다시 그린다');
    assert.ok(app.plan().today.items.some(row => row.kind === 'check'), '점검 칸에 짧은 진단');
  } finally {
    app.dispose();
  }
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

// 앱(app-shell.mjs)의 배선 — 셸은 판 기록을 홈 입구(homeNext.planLog)로만 연다. 앱이 그 칸을 넘기지 않으면 시험 틀(위 shell())만 기록이 서고
// 실제 앱에서는 새 길 판이 끝나도 이번 주에 한 판을 세지 못한다(11-16 4c가 올리기 전에 찾음). 셸은 node에서 못 올리므로 원문의 두 자리를 본다.
test('앱이 셸에 넘기는 홈 입구에 판 기록(planLog)이 있고, 입구 감싸기가 입구의 planLog로 잇는다(4-4b)', () => {
  const shellSource = fs.readFileSync(new URL('../app-shell.mjs', import.meta.url), 'utf8');
  const home = shellSource.split(/\r?\n/).filter(line => line.includes('const homeNext=lifeDue?{'));
  assert.equal(home.length, 1, '홈 입구를 짓는 자리는 하나');
  assert.ok(home[0].includes('planLog:coach=>atlasNext.planLog(coach)'), '홈 입구가 판 기록을 넘긴다');
  assert.ok(shellSource.includes('planLog:coach=>made&&!disposed?made.planLog?.(coach)??null:null'), '입구 감싸기가 입구의 planLog로 잇는다(입구를 받기 전 · 닫은 뒤는 null)');
});
