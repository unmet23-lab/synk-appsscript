// 4-6e-2 · 4-6e-3 길 표의 셸 배선(단계4_계획 §25-3 불변식 다 · §25-6) — world-learning-ui.mjs가 문서마다 길 표 한 벌(입구가 홈 플래너에 실어 준
// createRoutes)을 시험 관문 밖에서 짓고, 계획(weekNext) · 홈 숙제 줄(world-today.mjs) · 「이 항목 연습하기」(nextData)가 같은 표에 능력 id만 넘겨 같은
// 답을 받는다. 표의 열쇠는 홈 코치 · 기록이 바뀐 셈(입구의 createWriteCount — 이 문서의 쓰기와 받기 알림) · 묶음 만남의 캐시 열쇠다.
// 진짜 엔진 코치(손님 메모리 저장소) · 진짜 지도 조각 · 진짜 홈 플래너(world-today · 입구의 positionPlanner · planPlanner · homeGames)로 돈다.
// 다른 탭은 같은 저장소의 다른 창(scope)에 연 코치다 — 엔진 호스트가 BroadcastChannel로 알려 홈 코치의 받기 알림(refresh)이 난다.
// 셸 판은 글(HTML)만 보고, 단추는 판 글에서 지어 누른다. 변형 시험(qa/plan-mutants.mjs routes · entry 갈래)은 깬 사본을 SYNK_LEARNING_UI_MODULE ·
// SYNK_ATLAS_NEXT_MODULE로 넘긴다. 카드(놓친 곳 카드 — 4-6e-5)의 연습 단추는 아직 없어 네 화면 가운데 셋을 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { sliceOf } from '../../../packages/atlas/tools/map-ship.mjs';
import { worldPosition } from '../world-position-kit.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { createWorldTodayPlan, todayKey, watchHomePlan } from '../world-today.mjs';

const moduleOf = (name, fallback) => (process.env[name] ? pathToFileURL(process.env[name]).href : new URL(fallback, import.meta.url).href);
const { createWorldEducation } = await import(moduleOf('SYNK_LEARNING_UI_MODULE', '../world-learning-ui.mjs'));
const { createWriteCount, homeBanksOf, planPlanner, positionPlanner } = await import(moduleOf('SYNK_ATLAS_NEXT_MODULE', '../world-atlas-next.mjs'));
const HG = await import('../world-home-games.mjs');

const acorn = createRequire(import.meta.url)('acorn');
const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
// 원문 시험은 장면 시험과 같은 셸을 읽는다 — 변형이 SYNK_LEARNING_UI_MODULE로 넘긴 사본(4-6e-2 검수 GPT GB3).
const shellText = () => (process.env.SYNK_LEARNING_UI_MODULE ? fs.readFileSync(process.env.SYNK_LEARNING_UI_MODULE, 'utf8') : read('world-learning-ui.mjs'));
const INDEX = readJson('../../../packages/atlas/map/index.json');
const UNITS = readJson('../../../packages/atlas/map/units.json');
const WORDS = readJson('../../../packages/atlas/map/words.json');
worldPosition.topik.use(readJson('../world-topik-items.json'));
const PRACTICE = worldPosition.practice.pool;
const DETAIL = 'ko.listening.detail';
const CONDITION = 'ko.listening.condition';
const G211_READING = 'blank-slice.e06.v2'; // 바람길 ko.listening.detail 네 문항의 단위(G211)가 든 읽기 짧은 연습 문항
const EXAM_T1 = { audio: 'available', reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2, examDate: '2027-04-18', weeklyMinutes: 120 };
const EXAM_T2 = { ...EXAM_T1, examType: 'topik2', targetGrade: 4 };
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// 계획 함수(world-exam-plan.mjs — 계정 묶음 원천)의 4-6e-2 앞 바이트(줄끝은 LF로 맞춰 잰다). 4-6e는 이 파일을 고치지 않는다(§25-3).
const EXAM_PLAN_SHA256 = '1b90372a8df81bd7ffec6bc61777d86741f7e8f2fba3176337d95003e6cfeba5';
// 시험의 오늘 — 2026-11-25(수) 10:00(한국)에서 시작해 실제처럼 흐른다. 셸은 이 시각을, 코치는 그 이틀 전부터 장면이 옮긴 시각을 읽는다. 실행 시각을 그대로
// 쓰면 저녁 ~ 새벽에는 코치가 학습일 경계(새벽 4시)를 넘어 홈이 고르는 숙제 줄이 바뀌고, 시험일(2027-04-18) 뒤에는 계획이 서지 않는다(새 사슬 GB4).
const RealDate = globalThis.Date;
const TODAY = RealDate.parse('2026-11-25T10:00:00+09:00');
const began = RealDate.now();
const todayNow = () => TODAY + (RealDate.now() - began);
globalThis.Date = class extends RealDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(todayNow());
  }
  static now() {
    return todayNow();
  }
};
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, ms = 8000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw Error(`기다림이 넘쳤다: ${label}`);
    await tick(10);
  }
}
const listening = item => item.audioRequired ?? item.modality === 'listening';
const itemOf = key => PRACTICE.find(item => item.itemKey === key);
const games = (snapshot = {}, settings = EXAM_T1) => HG.homeGames({ progress: snapshot, settings, storage: null });
const gameItems = (gameId, skill, snapshot = {}) => games(snapshot).find(game => game.gameId === gameId).items.filter(item => item.skillId === skill);

// 저장소 하나(한 기기) — 같은 열쇠 · 같은 메모리 저장소의 코치는 같은 창이면 같은 호스트, 다른 창(scope)이면 다른 탭이다. 코치의 시계는 시험이 옮긴다.
let stores = 0;
function device({ start = Date.now() - 2 * DAY } = {}) {
  stores += 1;
  const key = `synk-atlas:routes-shell-${process.pid}-${stores}`;
  const port = atlas.memoryPort();
  let now = start;
  const banks = homeBanksOf(PRACTICE);
  const mapData = { index: banks.map(bank => sliceOf(INDEX, bank, WORDS)), units: UNITS, words: WORDS };
  const tab = () => {
    const scope = { location: { origin: 'https://routes.test' }, addEventListener() {}, removeEventListener() {} };
    scope.parent = scope;
    return scope;
  };
  const make = async ({ gameId = 'world-home', scope = null, at = key, on = port } = {}) => {
    // label: 제품 셸(app-shell.mjs)처럼 능력 이름을 넘긴다. 이름이 없으면 두뇌의 숙제 문장(host.homework)이 비어 홈 숙제 줄이 서지 않는다(GB1).
    const coach = atlas.createCoach({ gameId, mapData, dayOffset: 540, label: id => worldLearning.SKILLS.find(skill => skill.id === id)?.label_ko ?? null, ...(scope ? { scope } : {}), host: { guest: true, port: on, key: at, now: () => now } });
    await coach.ready;
    return coach;
  };
  return { key, port, make, tab, advance: ms => (now += ms), get now() { return now; } };
}
async function answer(coach, item, correct = true) {
  const pid = coach.present({ itemKey: item.itemKey });
  if (listening(item)) coach.delivery(pid, { audio: 'completed' });
  await coach.answer(pid, { correct, assessable: true }).stored;
}
// 띄우기만 하고 닫는다(답 없음) — 저장이 끝나야 묶음 만남에 비친다.
async function showOnly(coach, item) {
  coach.present({ itemKey: item.itemKey });
  await tick(20);
}
// 그 능력의 짧은 연습을 모두 쓰고(셋에 하나 놓침 — 숙제가 된다) 판을 접는다. more: 그 뒤 더 할 일.
async function spend(d, skill, more = async () => {}) {
  const seed = await d.make({ gameId: 'world-practice' });
  const items = PRACTICE.filter(item => item.skillId === skill);
  for (const [i, item] of items.entries()) await answer(seed, item, i % 3 !== 0);
  await more(seed);
  assert.equal(await seed.finishSet({ kind: 'short' }).folded, true);
  seed.dispose();
}

// 판 글의 단추 — 그 속성을 가진 태그를 지어 듣는 함수를 받아 둔다(누르기는 click).
function buttonsOf(html, name) {
  const out = [];
  for (const match of html.matchAll(new RegExp(`<[a-z]+[^>]*\\s${name}(?:="[^"]*")?[^>]*>`, 'g'))) {
    const tag = match[0];
    const attrs = Object.fromEntries([...tag.matchAll(/\s(data-[a-z-]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? '']));
    const listeners = [];
    out.push({
      attrs,
      at: match.index,
      dataset: Object.fromEntries(Object.entries(attrs).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value])),
      getAttribute: key => attrs[key] ?? null,
      hasAttribute: key => Object.hasOwn(attrs, key),
      addEventListener: (type, fn) => type === 'click' && listeners.push(fn),
      click: () => listeners.forEach(fn => fn({})),
      focus() {},
      listeners,
    });
  }
  return out;
}

// 셸 하나 — 새 길 홈 입구(homeNext)와 입구 같은 홈 플래너(길 표 · 게임 목록 · 기록이 바뀐 셈)를 넘긴 학습 화면.
// planner: 홈 플래너의 칸을 바꿔 끼운다(칸 규칙을 지켜보는 장면).
function shell(d, { values = EXAM_T1, snapshot = {}, openGames = null, saved = {}, planner: extra = {}, position = worldPosition } = {}) {
  const writes = createWriteCount();
  const counts = { routes: 0, exposures: 0, last: null, coach: null, args: [] };
  const state = { values, snapshot, openGames, coaches: [], retire: null, at: d.key, on: d.port };
  const launched = [];
  const toasts = [];
  const shown = [];
  const built = new Map(); // 판 글 차례 → 속성 이름 → 단추
  const storage = new Map(Object.entries(saved));
  const planner = {
    createWorldTodayPlan,
    watchHomePlan,
    todayKey,
    say: () => '',
    position: positionPlanner,
    plan: planPlanner,
    games: HG.homeGames,
    createRoutes(options) {
      counts.routes += 1;
      counts.coach = options.coach;
      counts.args.push(options);
      counts.last = HG.createRoutes(options);
      return counts.last;
    },
    writes: writes.count,
    ...extra,
  };
  const buttons = name => {
    const at = shown.length;
    if (!built.has(at)) built.set(at, new Map());
    const map = built.get(at);
    if (!map.has(name)) map.set(name, buttonsOf(shown.at(-1) ?? '', name));
    return map.get(name);
  };
  const node = () => ({
    isConnected: true,
    focus() {},
    closest: () => null,
    contains: () => false,
    addEventListener() {},
    insertAdjacentHTML() {},
    querySelectorAll(selector) {
      const found = /^\[(data-[a-z-]+)\]$/.exec(selector);
      return found ? buttons(found[1]) : [];
    },
    querySelector(selector) {
      const found = /^\[(data-[a-z-]+)\]$/.exec(selector);
      return found ? (buttons(found[1])[0] ?? null) : null;
    },
  });
  const target = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    document: {
      visibilityState: 'visible',
      activeElement: null,
      addEventListener() {},
      removeEventListener() {},
      querySelector(selector) {
        const html = shown.at(-1) ?? '';
        const found = /\[(data-[a-z-]+)(?:="([^"]*)")?\]/.exec(selector);
        if (!found) return null;
        const [, name, value] = found;
        const hit = value === undefined ? new RegExp(`\\s${name}(?=[\\s=>])`).test(html) : html.includes(`${name}="${value}"`);
        return hit ? node() : null;
      },
    },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
  };
  const progress = {
    owner: 'guest',
    learningProfile: () => ({ profile: { status: 'active', revision: 1, consent: true } }),
    learningProfileValues: () => state.values,
    status: () => ({ phase: 'synced', rejected: false, scoped: false, message: '' }),
    exportSnapshot: () => state.snapshot,
    summary: () => ({ nextLesson: null, resume: false }),
    flush: async () => {},
    hangulReading: () => ({ answer: 'reads' }),
  };
  const home = {
    updateStudy() {},
    toast: text => toasts.push(String(text)),
    closePanel() {},
    attachPanelResource() {},
    openPanel: () => null,
    showPanel: (title, html) => shown.push(String(html)),
  };
  const homeNext = {
    async coach() {
      const raw = await d.make({ at: state.at, on: state.on });
      const counting = { ...raw, exposures: items => ((counts.exposures += 1), raw.exposures(items)) };
      const made = writes.face(counting);
      state.coaches.push({ raw, made });
      return made;
    },
    planner: async () => planner,
    retired: (made, fn) => {
      state.retire = fn;
      return () => {};
    },
    life: () => 'engine',
    ask: async () => {},
    judge: () => ({ state: 'engine', items: [], ids: [], times: [], upcoming: [], stuck: [] }),
    answers: () => null,
    openGames: () => state.openGames,
    packs() {},
    painted() {},
  };
  const education = createWorldEducation({
    home,
    getProgress: () => progress,
    engine: worldLearning,
    createPlan: () => ({ selected: null, reason: '' }),
    launchGame: id => launched.push(id),
    startLesson() {},
    startReview() {},
    position,
    target,
    homeNext,
  });
  const app = {
    education,
    state,
    counts,
    launched,
    toasts,
    shown,
    last: () => shown.at(-1) ?? '',
    plan: () => education.metrics().plan,
    routes: () => counts.last,
    raw: () => state.coaches.at(-1)?.raw ?? null,
    face: made => writes.face(made),
    writes: () => writes.count(),
    // 이 기기의 저장소에 적는다(다른 탭이 환승 난도를 저장한 것과 같다 — 셸이 게임 목록에 넘기는 저장소).
    save: (key, value) => storage.set(key, String(value)),
    click(name, value) {
      const button = buttons(name).find(row => row.getAttribute(name) === value);
      assert.ok(button, `판에 ${name}="${value}" 단추가 있다`);
      button.click();
    },
    // 열린 계획 판에서 그 능력 줄의 게임 단추를 누른다(새 사슬 GB1).
    clickPlanGame(skill) {
      const html = app.last();
      const from = html.indexOf(`<li data-skill="${skill}">`);
      assert.ok(from >= 0, `계획 판에 ${skill} 줄이 있다`);
      const to = html.indexOf('</li>', from);
      const button = buttons('data-plan-game').find(row => row.at > from && row.at < to);
      assert.ok(button, `${skill} 줄에 게임 단추가 있다`);
      button.click();
    },
    homeworkRow: skill => app.plan()?.examPlan?.homework?.find(row => row.skillId === skill) ?? null,
    homeworkAct: skill => app.plan()?.candidates?.find(open => open.id === `world.homework.${skill}`) ?? null,
    async ready() {
      education.refresh();
      await until(() => app.plan()?.today?.state === 'engine', '엔진 판의 홈');
    },
    async board() {
      await education.position();
      await until(() => /data-position-next="engine"/.test(app.last()), '엔진 판의 내 위치');
      return app.last();
    },
    async planBoard() {
      assert.equal(await education.plan(), 'shown');
      return app.last();
    },
    dispose() {
      education.dispose();
      for (const { raw } of state.coaches) raw.dispose();
    },
  };
  return app;
}
// 판 글에서 그 능력의 「이 항목 연습하기」 단추 — 없으면 null.
const practiceButton = (html, skill) =>
  buttonsOf(html, 'data-position-practice').find(button => button.getAttribute('data-position-practice') === skill) ?? null;
// 계획 판에서 그 능력 줄의 단추(게임이면 게임 이름, 짧은 연습이면 'practice', 모자람이면 'shortage').
function planAction(html, skill) {
  const row = new RegExp(`<li data-skill="${skill.replace(/\./g, '\\.')}">(.*?)</li>`).exec(html)?.[1] ?? null;
  if (row == null) return null;
  const game = /data-plan-game="([^"]+)"/.exec(row)?.[1];
  if (game) return game;
  if (/data-plan-practice=/.test(row)) return 'practice';
  if (/wplan-shortage/.test(row)) return 'shortage';
  return '?';
}
// 네 화면(카드는 4-6e-5) — 계획 숙제 줄 · 계획 판 단추 · 홈 숙제 줄 · 「이 항목 연습하기」의 길.
async function screens(app, skill) {
  const got = await screensOf(app, skill);
  assert.ok(got.same, `${skill} — 홈에 선 숙제 줄은 숙제 후보와 같은 길을 연다`);
  return got;
}
async function screensOf(app, skill) {
  const row = app.homeworkRow(skill);
  const act = app.homeworkAct(skill);
  const planHtml = await app.planBoard();
  const board = await app.board();
  const button = practiceButton(board, skill);
  // home은 숙제 후보가 여는 길, shown은 홈에 선 숙제 줄이 여는 길이다(줄이 없으면 null — 4-6e-2 검수 GPT GB1).
  const shownRow = app.plan().today.items.find(item => item.activityId === `world.homework.${skill}`) ?? null;
  const wayOf = open => (open && open.route === 'game' ? open.gameId : open ? 'practice' : null);
  return {
    plan: row ? (row.fresh > 0 ? 'practice' : (row.activities?.[0]?.split('.').pop() ?? 'shortage')) : null,
    planButton: planAction(planHtml, skill),
    home: wayOf(act),
    shown: wayOf(shownRow?.open ?? null),
    homeRow: Boolean(shownRow),
    same: shownRow === null || wayOf(shownRow.open) === wayOf(act),
    position: button ? (button.getAttribute('data-position-game') ?? 'practice') : null,
  };
}

test('네 화면이 같은 길 — 짧은 연습 새 문항이 없는 듣기 숙제는 계획 · 홈 숙제 줄 · 「이 항목 연습하기」가 모두 같은 게임을 열고, 시각만 지나 앞 게임의 문항이 돌아온 단위에 걸리면 함께 뒤 게임으로 바뀐다(길 표는 다시 짓지 않는다)', async () => {
  const d = device();
  await spend(d, DETAIL, seed => answer(seed, itemOf(G211_READING), false));
  const app = shell(d);
  try {
    await app.ready();
    const route = app.routes().routeOf(DETAIL);
    assert.deepEqual([route.route, route.practice.length, route.games.map(game => game.gameId)], ['game', 0, ['runner', 'rhythm']]);
    const before = await screens(app, DETAIL);
    assert.deepEqual(
      { plan: before.plan, planButton: before.planButton, home: before.home, shown: before.shown, position: before.position },
      { plan: 'runner', planButton: 'runner', home: 'runner', shown: 'runner', position: 'runner' },
      '돌아온 단위가 없으면 목록 차례의 첫 게임',
    );
    assert.equal(app.counts.routes, 1, '홈 · 계획 · 내 위치가 길 표 한 벌을 읽는다');
    assert.equal(app.counts.exposures, 1, '묶음 만남은 길 표가 한 번 묻는다');
    // 시각만 지난다 — 쓰기 · 받기 알림 · 판 끝이 없어 길 표의 열쇠는 그대로다.
    for (let hours = 0; hours < 48 && !app.raw().due().some(row => row.unit === 'ko.grammar.G211'); hours += 1) d.advance(HOUR);
    assert.ok(app.raw().due().some(row => row.unit === 'ko.grammar.G211'), 'G211이 돌아왔다');
    app.education.refresh();
    const after = await screens(app, DETAIL);
    assert.deepEqual(
      { plan: after.plan, planButton: after.planButton, home: after.home, shown: after.shown, position: after.position },
      { plan: 'rhythm', planButton: 'rhythm', home: 'rhythm', shown: 'rhythm', position: 'rhythm' },
      '바람길의 처음 보는 문항이 모두 돌아온 단위에 걸려 리듬이 앞이다',
    );
    assert.equal(app.counts.routes, 1, '돌아온 단위는 물을 때마다 읽는다 — 길 표를 다시 짓지 않는다');
    // 「이 항목 연습하기」 단추는 게임 길이면 그 게임을 연다.
    app.click('data-position-practice', DETAIL);
    assert.deepEqual(app.launched, ['rhythm']);
    // 계획 판의 그 능력 줄 단추도 그 게임을 연다 — 속성만이 아니라 눌러서 열린 게임을 본다(새 사슬 GB1).
    await app.planBoard();
    app.clickPlanGame(DETAIL);
    assert.deepEqual(app.launched, ['rhythm', 'rhythm']);
  } finally {
    app.dispose();
  }
});

test('한 판을 마친 뒤 같은 문서에서, 다른 탭에서 판을 마친(refresh) 뒤에도 네 화면이 새 만남을 반영한 같은 답을 낸다 — 마지막 처음 보는 문항을 답 없이 보고 닫은 뒤에는 숙제 줄이 없고 계획이 모자람을 알린다', async () => {
  const d = device();
  await spend(d, DETAIL, seed => answer(seed, itemOf(G211_READING), false));
  const app = shell(d);
  try {
    await app.ready();
    for (let hours = 0; hours < 48 && !app.raw().due().some(row => row.unit === 'ko.grammar.G211'); hours += 1) d.advance(HOUR);
    app.education.refresh();
    const first = await screens(app, DETAIL);
    assert.deepEqual([first.home, first.shown], ['rhythm', 'rhythm'], '홈에 선 숙제 줄도 리듬을 연다');
    // 같은 문서의 리듬 한 판 — 이 능력의 리듬 문항을 모두 만난다(입구가 낸 코치의 겉으로 쓴다).
    const rhythm = app.face(await d.make({ gameId: 'korean-rhythm' }));
    const writes = app.writes();
    for (const item of gameItems('rhythm', DETAIL)) await answer(rhythm, item);
    assert.ok(app.writes() > writes, '같은 문서의 쓰기가 셈을 올린다');
    app.education.refresh();
    const played = await screens(app, DETAIL);
    assert.deepEqual(
      { plan: played.plan, planButton: played.planButton, home: played.home, position: played.position },
      { plan: 'runner', planButton: 'runner', home: 'runner', position: 'runner' },
      '리듬을 다 만나 바람길이 남는다',
    );
    assert.ok(app.plan().today.items.some(item => item.activityId.startsWith('world.homework.')), '다른 숙제 줄은 선다 — 숙제 줄이 못 서는 환경이 아니다');
    assert.equal(played.homeRow, false, '바람길의 처음 보는 문항은 모두 돌아온 단위에 걸려 홈 숙제 줄이 서지 않는다(그날 복습 칸이 맡는다 — 25-12의 9)');
    assert.ok(app.plan().today.items.some(item => item.kind === 'again'), '돌아온 단위는 홈 복습 칸에 선다');
    // 다른 탭이 바람길 문항 셋을 만난다 — 받기 알림(refresh)이 셈을 올리고 홈을 다시 그린다.
    const other = await d.make({ gameId: 'korean-runner', scope: d.tab() });
    const runner = gameItems('runner', DETAIL);
    const heard = app.writes();
    for (const item of runner.slice(0, 3)) await answer(other, item);
    await until(() => app.writes() > heard, '다른 탭의 쓰기가 받기 알림으로 셈을 올린다');
    await until(() => app.routes()?.routeOf(DETAIL).games[0]?.items.length === 1, '다시 선 길 표');
    // 같은 문서에서 마지막 처음 보는 바람길 문항을 띄우기만 하고 닫는다.
    const runnerHere = app.face(await d.make({ gameId: 'korean-runner' }));
    await showOnly(runnerHere, runner[3]);
    app.education.refresh();
    const done = await screens(app, DETAIL);
    assert.deepEqual(
      { plan: done.plan, planButton: done.planButton, home: done.home, position: done.position },
      { plan: 'shortage', planButton: 'shortage', home: 'practice', position: null },
      '처음 보는 문항이 남은 게임이 없다 — 계획은 모자람, 홈 숙제 줄은 낼 것이 없다, 「이 항목 연습하기」가 없다',
    );
    assert.ok(app.plan().today.items.some(item => item.activityId.startsWith('world.homework.')));
    assert.equal(done.homeRow, false);
    assert.equal(app.homeworkRow(DETAIL).shortage, true);
    rhythm.dispose();
    runnerHere.dispose();
    other.dispose();
  } finally {
    app.dispose();
  }
});

test('실제 세트 — 듣기 세트의 한 문항만 본 날 그 세트의 다른 문항이 그 능력의 마지막 처음 보는 짧은 연습 문항이면 네 화면이 함께 게임을 연다. 소리를 끈 날 계획은 blocked: audio이고 홈 숙제 줄은 잠긴다', async () => {
  const d = device();
  const first = itemOf('topik-items.ti-l-e-001.v1');
  const second = itemOf('topik-items.ti-l-e-002.v1');
  const seed = await d.make({ gameId: 'world-practice' });
  for (const [i, item] of PRACTICE.filter(row => row.skillId === CONDITION && row !== second).entries()) await answer(seed, item, i % 3 !== 0);
  await answer(seed, first);
  assert.equal(await seed.finishSet({ kind: 'short' }).folded, true);
  seed.dispose();
  const app = shell(d);
  try {
    await app.ready();
    assert.equal(app.routes().rows.practice[PRACTICE.indexOf(second)].seen, false, '그 문항 자체는 만나지 않았다');
    const both = await screens(app, CONDITION);
    assert.deepEqual(
      { plan: both.plan, planButton: both.planButton, home: both.home, shown: both.shown, position: both.position },
      { plan: 'rhythm', planButton: 'rhythm', home: 'rhythm', shown: 'rhythm', position: 'rhythm' },
    );
    // 소리를 끈 날 — 계획은 듣기를 세지 않고, 홈 숙제 줄은 게임 길로 잠기고, 「이 항목 연습하기」는 게임 단추를 달지 않는다.
    app.state.values = { ...EXAM_T1, audio: 'off' };
    app.education.refresh();
    const row = app.homeworkRow(CONDITION);
    assert.equal(row.blocked, 'audio');
    assert.equal(row.shortage, true);
    const act = app.homeworkAct(CONDITION);
    assert.equal(act?.route, 'game');
    assert.ok(!app.plan().today.items.some(item => item.activityId === `world.homework.${CONDITION}`), '잠긴 숙제 줄은 서지 않는다');
    const board = await app.board();
    assert.equal(practiceButton(board, CONDITION), null, '소리를 끈 날에는 게임 단추가 없다');
  } finally {
    app.dispose();
  }
});

test('소리를 끈 날 처음 보는 짧은 연습이 남은 듣기 숙제의 홈 줄은 짧은 연습 길로 잠긴다 — 계획은 그 능력을 모자람(소리)으로 알린다', async () => {
  const d = device();
  // 이 능력의 짧은 연습을 반만 쓴다(놓침이 있어 숙제가 된다).
  const seed = await d.make({ gameId: 'world-practice' });
  const items = PRACTICE.filter(row => row.skillId === DETAIL);
  for (const [i, item] of items.slice(0, 6).entries()) await answer(seed, item, i % 2 === 0);
  assert.equal(await seed.finishSet({ kind: 'short' }).folded, true);
  seed.dispose();
  const app = shell(d, { values: { ...EXAM_T1, audio: 'off' } });
  try {
    await app.ready();
    assert.equal(app.routes().routeOf(DETAIL).route, 'practice', '길은 소리를 켠 셈이다');
    assert.equal(app.homeworkRow(DETAIL).fresh, 0, '계획은 소리를 끈 날 듣기 짧은 연습을 세지 않는다');
    const act = app.homeworkAct(DETAIL);
    assert.equal(act?.route, 'practice', '숙제 줄의 fresh가 아니라 길로 연다');
  } finally {
    app.dispose();
  }
});

test('시험을 고르지 않은 손님에게도 길 표가 선다 — 내 위치의 「이 항목 연습하기」가 길(짧은 연습 · 게임)을 단다(v7 검토)', async () => {
  const d = device();
  await spend(d, DETAIL);
  // 짧은 연습 열기 — 지금 판의 문항 고르기가 받은 능력을 적는다(새 길 입구를 넘기지 않은 셸이다).
  const picked = [];
  const practice = { ...worldPosition.practice, selectPractice: options => (picked.push(options.skillId), worldPosition.practice.selectPractice(options)) };
  const app = shell(d, { values: { audio: 'available' }, position: { ...worldPosition, practice } });
  try {
    await app.ready();
    assert.equal(app.plan().examPlan, null, '시험을 고르지 않았다');
    const board = await app.board();
    assert.equal(practiceButton(board, 'ko.reading.detail')?.getAttribute('data-position-game'), null, '처음 보는 짧은 연습이 남은 능력은 짧은 연습');
    assert.ok(practiceButton(board, 'ko.reading.detail'));
    // 짧은 연습 새 문항과 게임 새 문항이 함께 남은 듣기 능력 — 짧은 연습이 먼저다.
    assert.ok(app.routes().routeOf('ko.listening.negation').games.length > 0, '게임 새 문항도 남았다');
    assert.ok(practiceButton(board, 'ko.listening.negation'), '단추가 선다');
    assert.equal(practiceButton(board, 'ko.listening.negation').getAttribute('data-position-game'), null, '짧은 연습이 먼저');
    assert.equal(practiceButton(board, DETAIL)?.getAttribute('data-position-game'), 'runner', '짧은 연습을 다 쓴 능력은 게임');
    app.click('data-position-practice', DETAIL);
    assert.deepEqual(app.launched, ['runner']);
    assert.deepEqual(picked, [], '게임 길은 짧은 연습을 열지 않는다');
    // 짧은 연습 길의 단추는 그 능력의 짧은 연습을 연다(사슬 -c GB1).
    app.click('data-position-practice', 'ko.listening.negation');
    await until(() => picked.length > 0, '짧은 연습 열기');
    assert.deepEqual(picked, ['ko.listening.negation']);
    assert.deepEqual(app.launched, ['runner']);
    assert.ok(app.counts.routes >= 1);
  } finally {
    app.dispose();
  }
});

test('TOPIK I 학생이 내 위치에서 TOPIK II 판을 누르면 그 판의 능력마다 계획이 그 능력을 낼 때(TOPIK II 학생)와 같은 길을 단다(설계 주인 25-12의 10)', async () => {
  const d = device();
  const supplied = [];
  const plan = { ...planPlanner, buildPlanNext: options => (supplied.push(options.available), planPlanner.buildPlanNext(options)) };
  const app = shell(d, { values: EXAM_T1, planner: { plan } });
  try {
    await app.ready();
    await app.board();
    const asked = app.counts.exposures;
    app.click('data-position-exam', 'topik2');
    await until(() => /data-position-next="engine"[^>]*data-exam="topik2"/.test(app.last()), 'TOPIK II 판');
    assert.equal(app.counts.exposures, asked, 'TOPIK II 판으로 옮겨도 만남을 따로 묻지 않는다(새 사슬 GB3)');
    const board = app.last();
    const routes = app.routes();
    const ko2 = positionPlanner.examSkills(worldLearning.SKILLS, 'topik2').map(skill => skill.id);
    const ways = Object.fromEntries(ko2.map(id => [id, practiceButton(board, id) ? (practiceButton(board, id).getAttribute('data-position-game') ?? 'practice') : null]));
    assert.ok(Object.values(ways).some(Boolean), 'TOPIK II 능력에 단추가 선다');
    // 같은 기록의 TOPIK II 학생 계획 — 숙제가 아닌 능력도 공급(available)은 같은 길에서 온다.
    for (const id of ko2) {
      const route = routes.routeOf(id);
      const expected = route.route === 'practice' ? 'practice' : route.route === 'game' ? route.gameId : null;
      assert.equal(ways[id], expected, `${id}의 길`);
    }
    app.state.values = EXAM_T2;
    app.education.refresh();
    assert.equal(app.counts.routes, 2, '시험 종류가 바뀌어 길 표를 다시 짓는다');
    for (const id of ko2) assert.deepEqual(app.routes().routeOf(id).route, routes.routeOf(id).route, `${id} — 같은 답`);
    // 셸이 TOPIK II 학생 계획에 넘긴 공급(available)도 내 위치 단추와 같은 길이다 — 짧은 연습이면 처음 보는 수가 있고, 게임이면 그 게임이 차례의
    // 맨 앞이다(4-6e-2 검수 GPT GB2 — 시작점 진단 전이라 계획 판에는 능력 줄이 없어 공급으로 본다).
    const supply = supplied.at(-1);
    assert.ok(supply, 'TOPIK II 학생 계획을 지었다');
    for (const id of ko2) {
      // 공급 수는 길 표의 처음 보는 짧은 연습 문항 수 그대로다(소리를 켠 학생 — 사슬 -c GB2).
      assert.equal(supply.practice[id] ?? 0, app.routes().routeOf(id).practice.length, `${id} — 짧은 연습 공급 수`);
      const fromPlan = supply.practice[id] > 0 ? 'practice' : (supply.listening[id]?.[0] ?? null);
      assert.equal(fromPlan === null ? null : fromPlan === 'practice' ? 'practice' : app.routes().routeOf(id).gameId, ways[id], `${id} — 계획의 공급과 내 위치 단추`);
      if (supply.listening[id]) assert.deepEqual(supply.listening[id], app.routes().routeOf(id).games.map(game => game.id), `${id} — 계획의 게임 차례`);
    }
  } finally {
    app.dispose();
  }
});

test('길 표 열쇠 — 목표 급 2 → 3(환승 25 → 30), 환승 해금, 다른 탭의 환승 난도가 바뀌면 다음에 그린 판이 묶음 만남을 다시 묻고 게임 몫이 새 목록과 맞는다. 시험 형식 고르기는 만남을 다시 묻지 않는다', async () => {
  const d = device();
  const open = { lessons: { 'greetings-expressions': { completedAt: Date.now() - DAY, startedAt: Date.now() - DAY - HOUR, answers: {} } } };
  const app = shell(d, { values: EXAM_T1 });
  try {
    await app.ready();
    const subwayOf = () => app.routes().games.find(game => game.gameId === 'subway') ?? null;
    assert.equal(subwayOf(), null, '해금 전 환승은 목록에 없다');
    const asked = app.counts.exposures;
    // 홈을 다시 그리고 계획 · 내 위치를 열어도 — 시험 형식 고르기 포함 — 만남을 다시 묻지 않는다.
    app.education.refresh();
    await app.planBoard();
    await app.board();
    assert.equal(app.counts.exposures, asked, '시험 형식 고르기와 내 위치가 만남을 따로 묻지 않는다');
    // 환승 해금.
    app.state.snapshot = open;
    app.education.refresh();
    assert.equal(subwayOf()?.items.length, 25, '목표 2급 — 첫 등굣길');
    assert.equal(app.counts.exposures, asked + 1, '게임 목록이 바뀌어 다시 묻는다');
    const rows = () => app.routes().rows.games.length;
    assert.equal(rows(), app.routes().games.reduce((n, game) => n + game.items.length, 0), '게임 몫이 새 목록과 맞는다');
    // 목표 급 2 → 3.
    app.state.values = { ...EXAM_T1, examType: 'topik2', targetGrade: 3 };
    app.education.refresh();
    assert.equal(subwayOf()?.items.length, 30, '목표 3급 — 바쁜 아침');
    assert.equal(rows(), app.routes().games.reduce((n, game) => n + game.items.length, 0));
    const now = app.counts.exposures;
    app.education.refresh();
    assert.equal(app.counts.exposures, now, '바뀐 것이 없으면 다시 묻지 않는다');
    // 다른 탭에서 환승 난도만 바꾼다(기기 저장소의 synk.subway.level) — 목표 급은 그대로다.
    app.save(HG.SUBWAY_LEVEL_KEY, 'basic');
    app.education.refresh();
    assert.equal(subwayOf()?.items.length, 25, '저장한 난도가 목표 급보다 먼저 — 첫 등굣길');
    assert.equal(app.counts.exposures, now + 1, '게임 목록이 바뀌어 다시 묻는다');
    assert.equal(rows(), app.routes().games.reduce((n, game) => n + game.items.length, 0));
    // 다시 그려도 시험 형식 고르기 · 내 위치는 만남을 따로 묻지 않는다.
    await app.planBoard();
    await app.board();
    assert.equal(app.counts.exposures, now + 1);
  } finally {
    app.dispose();
  }
});

test('시험 형식 풀이 없는 판에서도 바뀐 것이 없으면 길 표를 다시 짓지 않는다 — 홈과 내 위치를 번갈아 그려도 묶음 만남은 한 번(4-6e-2 검수 GPT GC4)', async () => {
  const d = device();
  const app = shell(d, { values: EXAM_T1, position: { ...worldPosition, mock: null } });
  try {
    await app.ready();
    const asked = app.counts.exposures;
    const built = app.counts.routes;
    app.education.refresh();
    await app.board();
    app.education.refresh();
    await app.board();
    assert.equal(app.counts.routes, built, '길 표를 다시 짓지 않는다');
    assert.equal(app.counts.exposures, asked, '묶음 만남을 다시 묻지 않는다');
    assert.deepEqual(app.routes().rows.mock, [], '시험 형식 몫은 빈 줄');
  } finally {
    app.dispose();
  }
});

test('목록에 없는 화면 이름으로 제시 하나를 쓴 뒤 길 표가 다시 선다 — 시험 형식을 열어 한 문항을 보고 답 없이 닫은 뒤 내 위치는 그 문항을 처음 보는 것으로 세지 않는다(v8 검토 · 설계 주인 25-12의 16)', async () => {
  const d = device();
  const app = shell(d);
  try {
    await app.ready();
    await app.board();
    const built = app.counts.routes;
    // 나중에 생기는 화면(이 목록에 없는 경험 이름)이 이 문서에서 짧은 연습 문항 하나를 띄운다 — 판 끝도 받기 알림도 없다.
    const later = app.face(await d.make({ gameId: 'world-later' }));
    const item = PRACTICE.find(row => row.skillId === 'ko.reading.detail');
    await showOnly(later, item);
    await app.board();
    assert.equal(app.counts.routes, built + 1, '쓰기가 셈을 올려 길 표가 다시 선다');
    assert.equal(app.routes().rows.practice[PRACTICE.indexOf(item)].seen, true, '다시 선 만남 줄이 그 제시를 안다');
    // 시험 형식 연습(world-mock)에서 한 문항을 보고 답 없이 닫는다 — 같은 문항이 짧은 연습 풀에도 있다.
    const mock = app.face(await d.make({ gameId: 'world-mock' }));
    const shared = worldPosition.mock.pool.find(row => PRACTICE.includes(row) && row !== item);
    assert.ok(shared, '시험 형식 풀과 짧은 연습 풀이 함께 든 문항');
    await showOnly(mock, shared);
    await app.board();
    assert.equal(app.counts.routes, built + 2);
    const rows = app.routes().rows;
    assert.equal(rows.practice[PRACTICE.indexOf(shared)].seen, true, '내 위치(먼저 볼 항목의 처음 보는 문항)는 그 문항을 처음 보는 것으로 세지 않는다');
    assert.equal(rows.mock[worldPosition.mock.pool.indexOf(shared)].seen, true);
    later.dispose();
    mock.dispose();
  } finally {
    app.dispose();
  }
});

test('홈 코치가 바뀐 뒤(손님 기록 비우기 · 은퇴 알림 · 조각이 든 코치) 길 표가 새 코치로 다시 선다 — 나머지 열쇠가 같아도(v8 검토)', async () => {
  const d = device();
  const app = shell(d);
  try {
    await app.ready();
    await app.board();
    const first = app.counts.coach;
    const built = app.counts.routes;
    // 다른 빈 저장소의 코치로 바뀐다 — 기록이 바뀐 셈 · 판 끝 · 요약 모양이 앞 코치와 같다.
    app.state.at = `${d.key}-next`;
    app.state.on = atlas.memoryPort();
    app.state.retire();
    await until(() => app.state.coaches.length === 2 && app.plan()?.today?.state === 'engine', '새 홈 코치');
    app.education.refresh();
    await app.board();
    assert.ok(app.counts.routes > built, '길 표를 다시 짓는다');
    assert.notEqual(app.counts.coach, first);
    assert.equal(app.counts.coach, app.state.coaches.at(-1).made, '새 홈 코치로 짓는다');
  } finally {
    app.dispose();
  }
});

test('내 위치 칸 규칙(unseenFamilies · prefer · planStart)의 값이 고치기 전 셸이 묶음 만남을 직접 물어 셈한 값과 같다 — 칸 규칙은 길 표의 만남 줄만 읽는다(v8 검토)', async () => {
  const d = device();
  await spend(d, DETAIL, async seed => {
    for (const item of PRACTICE.filter(row => row.skillId === 'ko.reading.grammar').slice(0, 4)) await answer(seed, item, false);
    await showOnly(seed, PRACTICE.find(row => row.skillId === 'ko.reading.vocabulary'));
  });
  const seen = { unseen: [], prefer: [], start: [] };
  const P = positionPlanner;
  // 칸 규칙을 받는 자리를 지켜본다 — 셸이 넘긴 값을 그대로 기록한다.
  const watched = {
    ...P,
    unseenFamilies: (pools, skip) => {
      const fn = P.unseenFamilies(pools, skip);
      seen.unseen.push(fn);
      return fn;
    },
    buildPositionNext: options => {
      seen.prefer.push(options.prefer);
      return P.buildPositionNext(options);
    },
  };
  const N = { ...planPlanner, planStart: options => (seen.start.push(options), planPlanner.planStart(options)) };
  const planned = shell(d, { values: { ...EXAM_T1, audio: 'off' }, planner: { position: watched, plan: N } });
  try {
    await planned.ready();
    await planned.board();
    const coach = planned.raw();
    // 고치기 전 셸(nextData)의 직접 셈 — 묶음 만남을 따로 묻는다.
    const diagnostic = worldPosition.items;
    const met = coach.exposures([...diagnostic, ...PRACTICE, ...worldPosition.mock.pool]);
    const metDiag = met.slice(0, diagnostic.length);
    const metPractice = met.slice(diagnostic.length, diagnostic.length + PRACTICE.length);
    const unseen = P.unseenFamilies([{ items: diagnostic, exposures: metDiag }, { items: PRACTICE, exposures: metPractice }], item => P.withheldItem(item));
    const fresh = new Set();
    PRACTICE.forEach((item, i) => {
      if (metPractice[i]?.seen === false && !listening(item)) fresh.add(item.skillId);
    });
    const skills = [...new Set(PRACTICE.map(item => item.skillId))];
    const unseenNow = seen.unseen.at(-1);
    const preferNow = seen.prefer.at(-1);
    for (const skill of skills) {
      for (const level of [1, 2, 3, 4, 5, 6]) assert.equal(unseenNow(skill, level), unseen(skill, level), `${skill} · 난도 ${level}의 처음 보는 계열 수`);
      assert.equal(preferNow(skill), fresh.has(skill), `${skill}의 먼저 볼 항목 차례(prefer)`);
    }
    assert.ok(skills.some(skill => !fresh.has(skill)) && skills.some(skill => fresh.has(skill)));
    // 시작점(planStart) — 계획이 넘긴 풀의 만남 줄이 직접 물은 줄과 같다.
    const start = seen.start.at(-1);
    assert.ok(start, '계획이 시작점을 물었다');
    assert.deepEqual(start.pools[0].exposures, metDiag);
    assert.deepEqual(start.pools[1].exposures, metPractice);
  } finally {
    planned.dispose();
  }
});

test('손님에게 닫힌 게임과 해금 전 환승은 계획의 게임 근거 · 홈 숙제 줄 · 「이 항목 연습하기」에 없다', async () => {
  const d = device();
  await spend(d, DETAIL);
  // 바람길이 닫힌 손님(리듬만 열림) · 환승은 해금 전.
  const app = shell(d, { openGames: ['hangul', 'rhythm'] });
  try {
    await app.ready();
    const row = app.homeworkRow(DETAIL);
    assert.deepEqual(row.activities, ['world.play.rhythm']);
    assert.ok(!app.routes().games.some(game => ['runner', 'subway'].includes(game.gameId)));
    assert.equal(app.homeworkAct(DETAIL)?.gameId, 'rhythm');
    const board = await app.board();
    assert.equal(practiceButton(board, DETAIL)?.getAttribute('data-position-game'), 'rhythm');
    for (const homework of app.plan().examPlan.homework)
      assert.ok(!(homework.activities ?? []).some(id => /runner|subway/.test(id)), `${homework.skillId}에 닫힌 게임 · 해금 전 환승이 없다`);
  } finally {
    app.dispose();
  }
});

test('ko.listening.word 숙제는 모자람이다(짧은 연습 풀에도 홈 게임에도 문항이 없다 — 지금 판 계획과 같은 값, 25-12의 2) · 계획 함수 파일(world-exam-plan.mjs)은 바뀌지 않았다', async () => {
  const d = device();
  const supplied = [];
  const recording = { ...planPlanner, buildPlanNext: options => (supplied.push(options.available), planPlanner.buildPlanNext(options)) };
  const app = shell(d, { planner: { plan: recording } });
  try {
    await app.ready();
    const route = app.routes().routeOf('ko.listening.word');
    assert.equal(route.route, null);
    // 그 능력이 약한 학생의 계획 — 셸이 계획에 실제로 넘긴 공급(길 표)으로 짓는다(새 사슬 GB2 · 카본 B1).
    const supply = supplied.at(-1);
    assert.ok(supply && Object.keys(supply.practice).length > 0 && Object.keys(supply.listening).length > 0, '셸이 넘긴 공급에 다른 능력의 짧은 연습과 게임이 있다');
    assert.ok(!Object.hasOwn(supply.practice, 'ko.listening.word') && !Object.hasOwn(supply.listening, 'ko.listening.word'), '이 능력의 공급은 없다');
    const reader = { complete: true, topik2: false, skills: positionPlanner.examSkills(worldLearning.SKILLS, 'topik1').map(skill => ({ ...skill, cell: skill.id === 'ko.listening.word' ? 'practicing' : 'notyet', missed: skill.id === 'ko.listening.word' ? 2 : 0, helped: 0, answered: 2, correct: 0 })), start: () => false };
    const plan = worldPosition.exam.buildExamPlan({ exam: worldPosition.exam.examInfo(EXAM_T1), now: Date.now(), reader, available: supply });
    const word = plan.homework.find(row => row.skillId === 'ko.listening.word');
    assert.ok(word, '약한 능력이라 숙제 줄이다');
    assert.equal(word.shortage, true);
    assert.deepEqual(word.activities, []);
  } finally {
    app.dispose();
  }
  const source = read('world-exam-plan.mjs').replace(/\r\n/g, '\n');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), EXAM_PLAN_SHA256, '계획 함수는 고치지 않는다(§25-3 — 「고치기 전 함수와 깊은 같음」 대조 관문이 다시 걸리지 않게)');
});

// 원문 시험(설계 주인 25-12의 14): 계획(weekNext) · 홈 숙제 줄(homeworkActivities) · 내 위치(nextData)와 내 위치 칸 규칙(unseenFamilies · planStart — prefer는
// 셸 함수 안에 있다)의 원문에서 길 표 밖의 만남 묻기(exposures 부름)가 0이다. 카드(4-6e-5)는 아직 없다.
// 함수는 글을 자르지 않고 구문으로 찾는다 — 주석이나 글자 안의 같은 이름 · 중괄호를 함수로 읽지 않는다(4-6e-2 검수 카본 B1 · 사슬 -c GB3).
// 같은 이름의 함수 선언은 원문에 하나여야 한다.
function bodyOf(source, name) {
  const found = [];
  const walk = node => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) found.push(node);
    for (const value of Object.values(node))
      for (const child of Array.isArray(value) ? value : [value]) if (child && typeof child === 'object') walk(child);
  };
  walk(acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert.equal(found.length, 1, `원문에 함수 ${name}이 하나 있다`);
  return source.slice(found[0].start, found[0].end);
}
test('원문 시험 도우미 — 글자 안의 중괄호나 앞선 주석 속의 같은 이름을 함수로 읽지 않는다(4-6e-2 검수 카본 B1 · 사슬 -c GB3)', () => {
  const tricky = ['// function supply() {}', "const word = 'function supply() {}';", 'function supply(a) {', "  const x = '}';", '  return a.exposures(x, word);', '}', ''].join('\n');
  assert.match(bodyOf(tricky, 'supply'), /a\.exposures\(x, word\)/);
  assert.match(bodyOf('function outer() {\n  function inner({ a }) {\n    return { a };\n  }\n  return inner;\n}\n', 'inner'), /return \{ a \}/, '함수 안의 함수');
  assert.throws(() => bodyOf('function twice() {}\n{ function twice() {} }\n', 'twice'), /하나 있다/);
  assert.throws(() => bodyOf('const a = 1;', 'none'), /하나 있다/);
});

test('원문 시험 — 계획 · 홈 숙제 줄 · 내 위치와 그 칸 규칙에서 길 표 밖의 만남 묻기(exposures 부름)가 0이다(설계 주인 25-12의 14)', () => {
  const shellSource = shellText();
  const bodies = [
    ['weekNext', bodyOf(shellSource, 'weekNext')],
    ['nextData', bodyOf(shellSource, 'nextData')],
    ['routesFor', bodyOf(shellSource, 'routesFor')],
    ['supplyOf', bodyOf(shellSource, 'supplyOf')],
    ['homeworkActivities', bodyOf(read('world-today.mjs'), 'homeworkActivities')],
    ['unseenFamilies', bodyOf(read('world-position-next.mjs'), 'unseenFamilies')],
    ['planStart', bodyOf(read('world-plan-next.mjs'), 'planStart')],
  ];
  // 선택적 호출(exposures?.(…))과 대괄호 이름도 만남 묻기다(새 사슬 GB3).
  const asks = /\bexposures?['"`]?\s*\]?\s*(?:\?\.)?\s*\(/;
  for (const text of ['coach.exposures(a)', 'coach.exposure(a)', 'coach?.exposures?.(a)', "coach['exposures'](a)", 'coach.exposures ?.(a)']) assert.match(text, asks);
  for (const [name, body] of bodies) assert.doesNotMatch(body, asks, `${name}에 만남 묻기가 없다`);
  assert.match(bodies[0][1], /routesFor\(/, '계획은 길 표에서 읽는다');
  assert.match(bodies[1][1], /routesFor\(/, '내 위치는 길 표에서 읽는다');
  assert.match(bodies[4][1], /routes\.reader\(/, '홈 숙제 줄은 길 표에 묻는다');
  // 셸은 world-home-games.mjs를 직접 부르지 않는다(꺼진 판 묶음에 실리지 않게) — 홈 플래너로 받는다.
  assert.doesNotMatch(shellSource, /^import[^;]*world-home-games/m);
});
