// 점검 칸의 이레 측정(Atlas 재설계 단계4_계획 §21-23의 3 — 설계 주인 11-17 답 3의 조건). TOPIK II를 고르고 「말하기 평가도 준비해요」를 켠 새
// 손님으로, 진짜 엔진 코치(손님 메모리 저장소) · 진짜 셸(world-learning-ui.mjs weekNext) · 진짜 홈 플래너(world-today.mjs)로 이레 동안 홈의 점검
// 칸에 선 줄을 잰다. 시계(Date.now)를 월요일 한국 시각 10시부터 하루씩 옮긴다 — 계획의 주(월요일 0시부터) 안에 이레가 든다. 학생은 날마다 점검
// 칸에 선 줄을 한다: 짧은 진단은 셸에서 끝까지 답하고(셸이 판 기록에 다시 확인을 적는다), 시험 형식은 판 기록에 한 판을 적고(셸 markPlan과
// 같은 자리 — 문항을 처음 낸 때), 쓰기는 첫 글 뒤에 한 가지 고치기가 열리고 고쳐 쓰면 닫히며, 말하기는 그 유형을 이번 주에 해 본 것으로 적는다.
// 장면은 둘이다 — 계획에 쓰기 · 말하기가 있는 경우(앱이 쓰기 · 말하기 모듈을 부른 때)와 듣기 · 읽기만 있는 경우(모듈을 아직 부르지 못한 때 —
// 쓰기 · 말하기 후보가 비어 계획에 그 영역이 없다). 잰 열은 단계4_계획 §21-23의 3 「지었다」에 옮긴다. 말하기 영역이 있는데 이레 동안 말하기 줄이
// 0이면 설계 주인께 다시 여쭌다(조건) — 그래서 그 장면은 말하기 줄이 한 번 이상 서는지 본다.
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
// writingPractice · speakingPractice: 앱이 넘기는 쓰기 · 말하기 호스트(app-shell.mjs와 같은 꼴 — 아래 writingHost · speakingHost). 없으면 넘기지 않는다.
// focusing: 판 글의 단추와 문서의 초점(activeElement), 판 안의 스크롤 칸(#panel-content)을 흉내 낸다. 진짜 홈처럼 판을 보일 때마다 스크롤 자리가 처음으로
// 가고 초점은 닫기 단추(판 밖)로 간다(home.mjs openPanel) — 셸이 되돌려야 한다. 셸이 초점을 둔 자리는 focused에 적는다(판 머리는 root, 단추는 이름=값#몇 번째).
function shell({
  values = { audio: 'off', ...EXAM_T1 },
  wrap = made => made,
  planLog = null,
  planner = async () => PLANNER,
  fast = false,
  focusing = false,
  writingPractice = null,
  speakingPractice = null,
} = {}) {
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
    updateStudy() {
      drawn += 1;
    },
    toast(text) {
      toasts.push(String(text));
    },
    closePanel() {},
    attachPanelResource() {},
    openPanel: () => state.panel,
    showPanel(title, html) {
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
    ...(writingPractice ? { writingPractice } : {}),
    ...(speakingPractice ? { speakingPractice } : {}),
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

// ── 이레 측정 ──
// 시계 — 셸 · 엔진 · 홈 플래너는 Date.now를 읽는다. 시험이 하루씩 옮긴다(기다림 한도 until도 같은 시계라 옮기는 사이에는 기다리지 않는다).
const realNow = Date.now.bind(Date);
let shift = 0;
Date.now = () => realNow() + shift;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;
// 다음 월요일 한국 시각 10시로 옮긴다.
function toMonday10() {
  const now = realNow();
  const kst = new Date(now + KST);
  const ahead = (8 - kst.getUTCDay()) % 7 || 7;
  shift = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + ahead, 10) - KST - now;
}
const label = row => (row ? `${row.activityId} · ${row.why?.code ?? '-'}` : '-');

// 짧은 진단을 끝까지 — 시험 틀에는 소리 재생이 없어(target.Audio 없음) 듣기 문항은 보기가 잠긴 채라 건너뛰고, 나머지는 첫 보기로 답한다.
async function finishDiagnostic(app) {
  for (let guard = 0; guard < 160; guard += 1) {
    const html = app.box()?.html ?? '';
    if (html.includes('data-position-done')) return;
    const open = /data-position-choice="([^"]+)">/.exec(html);
    if (open) app.box().press('data-position-choice', open[1]);
    else if (html.includes('data-position-skip')) app.box().press('data-position-skip');
    await tick(10);
  }
  throw Error('짧은 진단이 끝나지 않았다');
}

// 하루 — 점검 칸의 줄을 읽고 그 줄을 한다. 돌려주는 것: 그날의 줄 · 이번 주 계획의 다음 영역 · 넘긴 점검 칸 활동.
async function dayOf(app, { log, writing, tried, done }) {
  app.education.refresh();
  await until(() => engineHome(app), '엔진 판의 이번 주 계획');
  const plan = app.plan();
  const row = checkRows(plan)[0] ?? null;
  const offered = plan.candidates.filter(open => ['position', 'mock', 'writing', 'speaking'].includes(open.route)).map(open => open.route);
  const area = name => plan.examPlan.areas.find(item => item.area === name);
  const count = name => (area(name) ? `${area(name).done}/${area(name).planned}` : '-');
  const day = { check: label(row), next: plan.examPlan.next?.area ?? '-', offered: [...new Set(offered)].join(' · '), writing: count('writing'), speaking: count('speaking') };
  if (row?.activityId === 'world.position.check') {
    await app.education.position();
    await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판');
    await app.education.position({ start: true });
    await until(() => app.box()?.html.includes('data-position-run'), '진단 문항');
    await finishDiagnostic(app);
  } else if (row?.activityId === 'world.mock') {
    assert.equal(log.record('mock', Date.now()), true);
  } else if (row?.activityId === 'topik2-writing-53') {
    // 첫 글 뒤에는 규칙 점검이 「-다」 끝맺음을 짚어 한 가지 고치기가 열리고, 고쳐 쓰면 닫힌다
    writing.state.need = writing.state.need ? null : { kind: 'retry', at: new Date(Date.now()).toISOString() };
    done.writing.push(new Date(Date.now()).toISOString()); // 쓰기 연습의 기기 시각(앱 attempts — 이번 주 계획이 센다)
  } else if (row?.activityId === 'world.speaking.check') {
    tried.push(Number(String(row.open.routeId).split(':')[1]));
    done.speaking.push(new Date(Date.now()).toISOString()); // 말하기 시도의 시각(앱 week().times — 이번 주 계획이 센다)
  }
  return day;
}
async function weekOfScene({ hosts }) {
  toMonday10();
  const logs = new Map();
  const memory = { getItem: key => logs.get(key) ?? null, setItem: (key, value) => logs.set(key, String(value)), removeItem: key => logs.delete(key) };
  const log = createPlanLog({ storage: memory, store: 'synk-atlas:guest' });
  const writing = writingHost(null);
  const tried = [];
  const done = { writing: [], speaking: [] };
  writing.attempts = () => done.writing;
  const speaking = { ...speakingHost({ tried }), week: () => ({ times: done.speaking, tried }) };
  const app = shell({
    values: { ...EXAM_T2 },
    planLog: made => (made ? log : null),
    ...(hosts
      ? { writingPractice: writing, speakingPractice: speaking }
      : {
          // 모듈을 아직 부르지 못한 때 — 후보가 비어 계획에 쓰기 · 말하기 영역이 없다
          writingPractice: { candidates: () => [], open() {}, attempts: () => [] },
          speakingPractice: { ...speakingHost({ tried }), available: () => false, candidates: () => [] },
        }),
  });
  const days = [];
  let areas = null;
  try {
    for (let i = 0; i < 7; i += 1) {
      if (i) shift += DAY;
      days.push({ day: i + 1, ...(await dayOf(app, { log, writing, tried, done })) });
      if (!areas) areas = app.plan().examPlan.areas.map(row => row.area);
    }
  } finally {
    app.dispose();
    shift = 0;
  }
  return { days, areas };
}

test('점검 칸의 이레 — TOPIK II · 말하기를 켠 새 손님, 계획에 쓰기 · 말하기가 있는 경우: 짧은 진단 → 시험 형식 → 쓰기 → 말하기 → 쓰기 고치기(보탬)가 서고 6 ~ 7일째에는 줄이 없다(설계 주인 11-17 답 3의 조건과 다시 여쭘의 답)', { timeout: 120_000 }, async t => {
  const { days, areas } = await weekOfScene({ hosts: true });
  t.diagnostic(`계획 영역: ${areas.join(' · ')}`);
  for (const row of days) t.diagnostic(`${row.day}일째 — 점검 칸: ${row.check} · 다음 영역: ${row.next} · 쓰기 ${row.writing} · 말하기 ${row.speaking} · 넘긴 활동: ${row.offered}`);
  assert.ok(areas.includes('writing') && areas.includes('speaking'), '계획에 쓰기 · 말하기가 있다');
  // 설계 주인 11-17 다시 여쭘의 답이 낸 열. 쓰기 · 말하기 줄은 그 영역의 몫이 남았을 때만 서고, 몫이 모두 찬 5일째에만 3일째 첫 글로 열린 고치기가
  // 보탬으로 선다. 고쳐 쓰면 닫히고, 계획이 찬 뒤에는 첫 글이 서지 않아 6 ~ 7일째에는 줄이 없다.
  assert.deepEqual(
    days.map(row => row.check),
    [
      'world.position.check · host.start',
      'world.mock · host.form',
      'topik2-writing-53 · host.writing.start',
      'world.speaking.check · host.speaking',
      'topik2-writing-53 · host.writing',
      '-',
      '-',
    ],
    '1일째 짧은 진단 · 2일째 시험 형식 · 3일째 쓰기 · 4일째 말하기 · 5일째 쓰기 고치기 · 6 ~ 7일째 줄 없음',
  );
});

test('점검 칸의 이레 — 같은 학생, 계획에 듣기 · 읽기만 있는 경우(쓰기 · 말하기 모듈을 아직 부르지 못함): 짧은 진단과 시험 형식만 서고 쓰기 · 말하기 줄은 서지 않는다', { timeout: 120_000 }, async t => {
  const { days, areas } = await weekOfScene({ hosts: false });
  t.diagnostic(`계획 영역: ${areas.join(' · ')}`);
  for (const row of days) t.diagnostic(`${row.day}일째 — 점검 칸: ${row.check} · 다음 영역: ${row.next} · 쓰기 ${row.writing} · 말하기 ${row.speaking} · 넘긴 활동: ${row.offered}`);
  assert.ok(!areas.includes('writing') && !areas.includes('speaking'), '계획에 쓰기 · 말하기가 없다');
  const checks = days.map(row => row.check.split(' · ')[0]);
  assert.ok(!checks.includes('topik2-writing-53') && !checks.includes('world.speaking.check'), '쓰기 · 말하기 줄이 없다');
  assert.equal(checks.filter(id => id === 'world.mock').length, 1, '시험 형식 줄은 이번 주에 한 번');
});
