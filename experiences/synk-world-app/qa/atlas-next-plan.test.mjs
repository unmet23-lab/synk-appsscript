// 4-4b 이번 주 계획 새 판(단계4_계획 §21-6 · 21-11 「이번 주 계획」 · 설계 주인 11-16 물음 1의 답) — 능력 읽개(여덟 자리), 시작점(측정용 만남),
// 기기의 판 기록과 그 열쇠, 새 길 계획 짓기, 홈의 숙제 연습 줄 · 점검 칸, 생활 상황 이름을 본다. 진짜 엔진 코치(손님 · 메모리 포트)와 진짜 지도로
// 두뇌의 차례를 돌린다(가짜 plan()으로는 층 · 숙제 문장의 차이를 못 잡는다 — 4-3 설계 검토 H14). 읽개 없는 지금 판이 고치기 전과 같은지는
// qa/world-exam-plan-reader.test.mjs가, 셸의 배선(계획 입구 · 알림 입력 · 판 기록 · 묶음 만남 다시 묻기)은 qa/atlas-next-plan-shell.test.mjs가 본다.
// 변형 시험(qa/today-mutants.mjs)은 깬 홈 계획 사본을 SYNK_TODAY_MODULE로, qa/plan-mutants.mjs는 깬 계획 사본을 SYNK_EXAM_PLAN_MODULE ·
// SYNK_PLAN_NEXT_MODULE로 넘긴다. 그 밖에는 원본이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import worldLife from '../../../strata/world-life.js';
import { worldPosition } from '../world-position-kit.mjs';
import { worldLearning } from '../world-learning-map.mjs';
import { createAtlasNext, positionPlanner } from '../world-atlas-next.mjs';
import { PACKS, LESSONS } from '../life-content.mjs';
import { lifeTargets } from '../life-plan.mjs';
import { lifeDue, lifeUnitsOf } from '../world-life-next.mjs';
import STRINGS, { SITUATIONS_KO } from '../../brand-opening/world-strings.mjs';
import { situationName } from '../../brand-opening/world-lang.mjs';

const moduleOf = (name, fallback) => (process.env[name] ? pathToFileURL(process.env[name]).href : new URL(fallback, import.meta.url).href);
const examPlan = await import(moduleOf('SYNK_EXAM_PLAN_MODULE', '../world-exam-plan.mjs'));
const N = await import(moduleOf('SYNK_PLAN_NEXT_MODULE', '../world-plan-next.mjs'));
const { createWorldTodayPlan, todayRows, HOMEWORK_PREFIX } = await import(moduleOf('SYNK_TODAY_MODULE', '../world-today.mjs'));
const { buildExamPlan, examInfo, examWeek } = examPlan;
const { PLAN_LOG_PREFIX, PLAN_NEXT_POLICY, buildPlanNext, createPlanLog, planBoard, planLogKey, planReader, planStart } = N;

const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
worldPosition.topik.use(readJson('../world-topik-items.json'));
const MAP_DATA = { index: readJson('../../../packages/atlas/map/index.json'), units: readJson('../../../packages/atlas/map/units.json') };
const NODES = worldLearning.SKILLS;
const DIAGNOSTIC = worldPosition.items;
const PRACTICE = worldPosition.practice.pool;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 18, 1, 0, 0); // 11-18(수) 10:00 KST — 이번 주 월요일은 11-16
const ORDER = PACKS.flatMap(pack => pack.lessons.map(lesson => lesson.id));
const lessonOf = id => LESSONS.find(lesson => lesson.id === id);
const mainKeys = id => lifeTargets(lessonOf(id), lessonOf(id).questions).map(target => target.itemKey);
const ko = id => STRINGS[`position.skill.${id}`]?.ko ?? null;
// 앱의 이름 함수와 같은 꼴(app-shell.mjs — 생활 상황은 situationName, 능력은 화면 글 표).
const labelOf = lang => id => (String(id).startsWith('sit-') ? situationName(id, lang) : STRINGS[`position.skill.${id}`]?.[lang] ?? null);

// ── 바탕 ──

const guestStorage = (extra = {}) => ({
  available: true,
  guest: true,
  base: true,
  pending: 0,
  unsent: 0,
  unfolded: 0,
  sync: { stopped: false, writesOff: false, switchOff: false },
  waiting: false,
  ...extra,
});
const summaryOf = (skills, storage = guestStorage()) => ({ skills, units: [], carried: null, storage });
const cell = (difficulty, independent, correct, helped = 0, lastAt = T0 - DAY) => ({ difficulty, independent, correct, helped, lastAt });
const line = (id, cells, { n = null, streak = 0, level = null } = {}) => ({
  id,
  theta: 0,
  n: n ?? cells.reduce((sum, row) => sum + row.independent, 0),
  streak,
  level,
  cells,
});
const readerOf = (summary, { start = () => false, nodes = NODES } = {}) =>
  planReader({ board: planBoard({ nodes, summary }), nodes, start });

let stores = 0;
// 홈 코치 — 지도 전체(생활 · TOPIK 은행)를 안다. start: 코치의 시계가 시작하는 때. label: 앱처럼 이름 함수를 싣는다.
async function homeCoach({ start = T0, params = null, lang = 'ko' } = {}) {
  stores += 1;
  let now = start;
  const time = { now: () => now, advance: ms => (now += ms), at: value => (now = value), get t() { return now; } };
  const coach = atlas.createCoach({
    gameId: 'world-home',
    mapData: MAP_DATA,
    dayOffset: 540,
    lang,
    label: labelOf(lang),
    ...(params ? { params: { ...atlas.PARAMS, ...params } } : {}),
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:world-plan-test-${process.pid}-${stores}`, now: time.now },
  });
  await coach.ready;
  return { coach, time };
}
// 소리가 드는 문항은 소리를 끝까지 들려준 뒤에 답한다(전달을 알리지 않은 듣기 답은 칸에 들지 않는다).
async function answer(coach, itemKey, correct, { help = null, audio = false } = {}) {
  const pid = coach.present({ itemKey });
  if (audio) coach.delivery(pid, { audio: 'completed' });
  if (help) coach.help(pid, help);
  await coach.answer(pid, { correct, assessable: true }).stored;
}
// 생활 진도의 꼴 — exportSnapshot()과 summary(PACKS, LESSONS)의 다음 레슨만(qa/atlas-next-home.test.mjs와 같다).
function progressOf({ completed = [], reviews = [] } = {}) {
  const lessons = {};
  for (const id of completed) lessons[id] = { completedAt: T0 - 2 * DAY, startedAt: T0 - 2 * DAY - MIN, answers: {} };
  const snapshot = { owner: 'guest', lessons, reviews: Object.fromEntries(reviews.map(review => [review.id, review])) };
  const next = ORDER.map(lessonOf).find(lesson => !completed.includes(lesson.id)) || null;
  return { exportSnapshot: () => snapshot, summary: () => ({ nextLesson: next ? { ...next } : null, resume: false }) };
}
const judgeOf = (coach, progress, now) => {
  const summary = coach.summary();
  return { state: 'engine', ...lifeDue({ snapshot: progress.exportSnapshot(), lessons: LESSONS, unitsOf: lifeUnitsOf(coach, LESSONS), memory: summary.units, due: coach.due(), now }) };
};
function homePlan({ coach, progress, now, settings = {}, week = null, lang = 'ko', pool = PRACTICE }) {
  const say = why => atlas.renderReason(why, { lang, label: labelOf(lang) });
  return createWorldTodayPlan({ coach, progress, judged: judgeOf(coach, progress, now), settings, now, pool, lang, say, labels: id => ko(id) ?? id, week });
}
const EXAM_T1 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2, examDate: '2027-04-18', weeklyMinutes: 120 };
const EXAM_T2 = { reasons: ['exam'], primaryReason: 'exam', examType: 'topik2', targetGrade: 4, examDate: '2027-04-18', weeklyMinutes: 120 };
// 셸(world-learning-ui.mjs weekNext)과 같은 재료로 이번 주 계획을 짓는다 — 묶음 만남 · 내 위치 칸 · 시작점 · 이 기기의 판 기록.
// speaking — 말하기를 고른 학생의 이번 주 말하기(셸의 speakingThisWeek 꼴 — times · untried). 주면 계획에 말하기 영역이 선다(앱 셸과 같다).
function weekOf({ coach, settings = EXAM_T1, now, log = null, audioAvailable = true, extra = {}, speaking = null }) {
  const met = coach.exposures([...DIAGNOSTIC, ...PRACTICE]);
  const metDiag = met.slice(0, DIAGNOSTIC.length);
  const metPractice = met.slice(DIAGNOSTIC.length);
  const at = new Map(PRACTICE.map((item, i) => [item, i]));
  const seenOf = item => metPractice[at.get(item)]?.seen ?? null;
  const pools = [{ items: DIAGNOSTIC, exposures: metDiag }, { items: PRACTICE, exposures: metPractice }];
  const skip = item => positionPlanner.withheldItem(item);
  const summary = coach.summary();
  const info = examInfo(settings);
  const exam = info.type === 'topik2' ? 'topik2' : 'topik1';
  const board = positionPlanner.buildPositionNext({ exam, skills: positionPlanner.examSkills(NODES, exam), summary, unseen: positionPlanner.unseenFamilies(pools, skip) });
  const diag = positionPlanner.selectDiagnosticNext({ position: board, items: DIAGNOSTIC, exposures: metDiag, audioAvailable });
  const reader = planReader({ board: planBoard({ nodes: NODES, summary, unseen: positionPlanner.unseenFamilies(pools, skip) }), nodes: NODES, start: ids => planStart({ ids, pools, skip }) });
  const ready = diag.status === 'ready' && diag.items.length > 0;
  const plan = buildPlanNext({
    examPlan,
    info,
    reader,
    log,
    progress: null,
    now,
    audioAvailable,
    available: {
      practice: worldPosition.practice.practiceSupply({ pool: PRACTICE, seen: seenOf, audioAvailable }),
      listening: {},
      recheck: ready ? diag.items.length : 0,
      life: true,
      ...(info.type === 'topik2' ? { topik2: { listening: true, reading: true }, writing: [{ id: 'topik2-writing-54', routeId: 'writing:54', skillIds: ['ko2.writing.argument'] }] } : {}),
      ...extra,
    },
    speaking,
  });
  return { examPlan: plan, fresh: item => seenOf(item) === false, diagnostic: { ready }, reader };
}

// ── 능력 읽개(§21-6 표 · 검토 D1) ──

test('읽개는 옛 요약의 여덟 자리를 내 위치 칸으로 읽는다 — 기록 · TOPIK II · 영역 · 약한가 · 확인 · 혼자 해냄 · 근거 수 · 숙제 상태와 차례', () => {
  const summary = summaryOf([
    line('ko.reading.detail', [cell(1, 3, 2)]), // 연습 중 · 놓친 1 → 숙제 missed, 줄 세울 값 1
    line('ko.reading.grammar', [cell(1, 0, 0, 2, T0 - 2 * DAY)]), // 도움받은 첫 만남만 → 숙제 상태 없음, 줄 세울 값 2
    line('ko.listening.detail', [cell(1, 5, 5)]), // 혼자 해냄
    line('ko.reading.vocabulary', [cell(1, 2, 2)]), // 연습 중이지만 놓친 수 · 도움받은 수가 없다 → 약하지 않다
    line('ko2.reading.detail', [cell(2, 1, 0)]), // TOPIK II 능력 — TOPIK I 학생의 계획은 읽지 않는다
  ]);
  const reader = readerOf(summary);
  assert.equal(reader.complete, true, '손님의 바탕 요약이 있으면 기록이 다 왔다(21-3)');
  assert.equal(reader.topik2, true, 'TOPIK II 능력이 있는가는 열린 지도의 목록으로 본다(카본 A2)');
  const domains = Object.fromEntries(reader.skills.map(skill => [skill.id, skill.domain]));
  assert.equal(domains['ko.listening.word'], 'listening', '영역은 열린 지도의 것이다 — 만나지 않은 능력도 목록에 있다');
  assert.equal(domains['ko2.writing.argument'], 'writing', '쓰기 능력도 지도에서(자동 판정이 없어 늘 아직)');
  assert.equal(reader.skills.find(skill => skill.id === 'ko2.writing.argument').cell, 'notyet');
  const plan = buildExamPlan({ exam: examInfo(EXAM_T1), now: T0, available: { practice: { 'ko.reading.detail': 3, 'ko.reading.grammar': 2, 'ko.listening.detail': 2 }, recheck: 5, life: true }, reader });
  const topik1 = reader.skills.filter(skill => /^ko\.(listening|reading)\./.test(skill.id));
  assert.deepEqual(
    plan.homework.map(row => [row.skillId, row.status]),
    [['ko.reading.grammar', null], ['ko.reading.detail', 'missed']],
    '약한 항목은 연습 중이면서 놓친 수 · 도움받은 수가 있는 것, 차례는 그 합(같은 꼴의 내 위치 먼저 볼 항목)',
  );
  assert.deepEqual(plan.reach, { confirmed: 1, observed: 4, total: topik1.length, evidence: 3 + 0 + 5 + 2, basis: 'topik1' }, '확인 · 혼자 해냄 · 근거 수');
  assert.deepEqual(plan.progress.reading, { total: topik1.filter(skill => skill.domain === 'reading').length, checked: 3, basis: 'topik1' });
  assert.deepEqual(plan.progress.listening, { total: topik1.filter(skill => skill.domain === 'listening').length, checked: 1, basis: 'topik1' });
  // TOPIK II 학생은 TOPIK II 문항이 있는 영역을 TOPIK II 칸으로 읽는다 — 읽개는 두 시험의 칸으로 짓는다(planBoard).
  const two = buildExamPlan({ exam: examInfo(EXAM_T2), now: T0, available: { practice: { 'ko2.reading.detail': 2 }, recheck: 5, life: true, topik2: { listening: true, reading: true } }, reader });
  assert.deepEqual(two.homework.map(row => [row.skillId, row.status]), [['ko2.reading.detail', 'missed']], 'TOPIK II 칸의 놓친 답');
  assert.equal(two.progress.reading.checked, 1);
  assert.equal(two.progress.reading.basis, 'topik2');
  assert.ok(!plan.notes.includes('start'), '시작점 판정이 거짓이면 시작점이 아니다');
  assert.equal(plan.doneScope, undefined, '표지는 넘긴 때만');
  // 기록이 다 오지 않았으면 필요를 만들지 않고 시작점으로 단정하지 않는다 — 약한 항목이 없는 학생과 같은 나누기다.
  const partial = planReader({ board: { ...planBoard({ nodes: NODES, summary }), complete: false }, nodes: NODES, start: () => true });
  const plain = readerOf(summaryOf([line('ko.reading.vocabulary', [cell(1, 2, 2)])]), { start: () => false });
  const input = { exam: examInfo(EXAM_T1), now: T0, available: { practice: { 'ko.reading.detail': 3, 'ko.listening.detail': 2 }, recheck: 5, life: true } };
  const cut = buildExamPlan({ ...input, reader: partial });
  assert.ok(!cut.notes.includes('start'), '기록 일부면 시작점이 아니다(시작점 판정이 참이어도)');
  assert.deepEqual(cut.areas.map(row => [row.area, row.planned]), buildExamPlan({ ...input, reader: plain }).areas.map(row => [row.area, row.planned]));
  // 같은 합이면 마지막 때가 늦은 차례다.
  const tie = readerOf(summaryOf([line('ko.reading.detail', [cell(1, 3, 2, 0, T0 - 3 * DAY)]), line('ko.reading.main', [cell(1, 3, 2, 0, T0 - DAY)])]));
  assert.deepEqual(buildExamPlan({ ...input, available: { practice: { 'ko.reading.detail': 1, 'ko.reading.main': 1 }, recheck: 5, life: true }, reader: tie }).homework.map(row => row.skillId), ['ko.reading.main', 'ko.reading.detail']);
});

test('읽개를 넘기면 옛 요약 · 사건(summary · examSkills)을 한 번도 읽지 않는다 — 한 문서에 두 판을 섞지 않는다(§6)', () => {
  const trap = () =>
    new Proxy({}, Object.fromEntries(['get', 'has', 'ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor'].map(name => [name, () => { throw Error(`옛 입력을 읽었다: ${name}`); }])));
  const reader = readerOf(summaryOf([line('ko.reading.detail', [cell(1, 3, 2)])]), { start: () => true });
  const input = { exam: examInfo(EXAM_T2), now: T0, available: { practice: { 'ko.reading.detail': 2 }, recheck: 5, life: true, topik2: { listening: true, reading: true } }, reader, doneScope: 'device' };
  const plan = buildExamPlan({ ...input, summary: trap(), examSkills: trap() });
  assert.deepEqual(plan, buildExamPlan(input), '옛 입력이 있든 없든 같은 계획');
  assert.equal(plan.doneScope, 'device', '「이 기기에서 센 수」 표지(검토 D5)');
});

test('TOPIK II를 고른 새 학생은 기록이 없어도 TOPIK II 계획이다 — 새 요약은 만난 능력만 내므로 지도 목록으로 본다(카본 A2)', async () => {
  const { coach } = await homeCoach();
  assert.deepEqual(coach.summary().skills, [], '새 학생의 요약에는 능력 줄이 없다');
  const week = weekOf({ coach, settings: EXAM_T2, now: T0 });
  assert.equal(week.reader.topik2, true);
  const plan = week.examPlan;
  assert.equal(plan.exam.type, 'topik2');
  assert.equal(plan.reach.basis, 'topik2', '듣기 · 읽기 모두 TOPIK II 문항이 있으면 TOPIK II로 센다');
  assert.equal(plan.progress.reading.basis, 'topik2');
  assert.equal(plan.progress.reading.total, positionPlanner.examSkills(NODES, 'topik2').filter(skill => skill.domain === 'reading').length);
  assert.ok(plan.areas.some(row => row.area === 'writing' && row.planned > 0), '쓰기는 늘 한 번(10-22)');
  assert.ok(plan.notes.includes('start'), '측정용 만남이 하나도 없으면 시작점');
  assert.equal(plan.next.area, 'recheck', '시작점이면 짧은 진단부터');
  assert.equal(plan.doneScope, 'device');
  // 지도에 TOPIK II 능력이 없으면(옛 지도) TOPIK I로 센다.
  const bare = readerOf(summaryOf([]), { nodes: NODES.filter(node => !String(node.id).startsWith('ko2.')) });
  assert.equal(bare.topik2, false);
  assert.equal(buildExamPlan({ exam: examInfo(EXAM_T2), now: T0, available: { recheck: 5, life: true, topik2: { listening: true, reading: true } }, reader: bare }).reach.basis, 'topik1');
  coach.dispose();
});

// ── 시작점(§21-6 · 검토 D4) ──

test('시작점은 측정용 만남으로 정한다 — TOPIK I 문항만 푼 TOPIK II 학생 · 생활 답만 있는 학생은 시작점, 모르는 문항이 있으면 단정하지 않는다', async () => {
  const { coach, time } = await homeCoach({ start: T0 - 30 * MIN });
  const reading1 = PRACTICE.filter(item => item.skillId === 'ko.reading.detail').slice(0, 2);
  for (const item of reading1) await answer(coach, item.itemKey, true);
  for (const key of mainKeys('greetings-expressions')) await answer(coach, key, true); // 생활 은행의 답 — 시작점의 근거가 아니다
  time.at(T0);
  const t1 = weekOf({ coach, settings: EXAM_T1, now: T0 }).examPlan;
  assert.ok(!t1.notes.includes('start'), 'TOPIK I 문항을 만난 TOPIK I 학생은 시작점이 아니다');
  const t2 = weekOf({ coach, settings: EXAM_T2, now: T0 }).examPlan;
  assert.ok(t2.notes.includes('start'), 'TOPIK I 문항만 푼 TOPIK II 학생은 시작점(듣기 · 읽기 모두 TOPIK II 문항이 있는 주)');
  const life = await homeCoach({ start: T0 - 30 * MIN });
  for (const key of [...mainKeys('greetings-expressions'), ...mainKeys('greetings-story')]) await answer(life.coach, key, true);
  life.time.at(T0);
  assert.ok(life.coach.summary().skills.length > 0, '생활 답도 능력 줄을 세운다(칸에는 든다 — 21-0)');
  assert.ok(weekOf({ coach: life.coach, settings: EXAM_T1, now: T0 }).examPlan.notes.includes('start'), '생활 답만 있는 학생도 시험 형식의 시작점은 짧은 진단부터(11-08 프론트 검수)');
  // 묶음 만남의 세 값 — 만났음 · 안 만났음 · 모름(null), 지금 낼 수 없는 문항(skip)은 보지 않는다.
  const items = [{ skillId: 'ko.reading.a' }, { skillId: 'ko.reading.a' }, { skillId: 'ko.reading.b' }];
  assert.equal(planStart({ ids: ['ko.reading.a'], pools: [{ items, exposures: [{ met: false }, { met: false }, { met: true }] }] }), true, '다른 능력의 만남은 보지 않는다');
  assert.equal(planStart({ ids: ['ko.reading.a'], pools: [{ items, exposures: [{ met: false }, { met: true }, { met: false }] }] }), false);
  assert.equal(planStart({ ids: ['ko.reading.a'], pools: [{ items, exposures: [{ met: false }, { met: null }, { met: false }] }] }), null, '모르는 문항이 있으면 시작점으로 단정하지 않는다');
  assert.equal(planStart({ ids: ['ko.reading.a'], pools: [{ items, exposures: [{ met: false }, null, { met: false }] }] }), null, '만남을 못 받은 문항도 모름');
  assert.equal(planStart({ ids: ['ko.reading.a'], pools: [{ items, exposures: [{ met: false }, { met: true }, { met: false }] }], skip: item => item === items[1] }), true, '뺀 문항의 만남은 세지 않는다');
  assert.equal(planStart({ ids: ['ko.reading.a'], pools: [{ items, exposures: [{ met: false }, { met: null }] }, { items: [{ skillId: 'ko.reading.a' }], exposures: [{ met: true }] }] }), false, '만난 것을 찾으면 모름보다 앞이다');
  // 모르면 계획도 시작점으로 단정하지 않는다.
  const unknown = buildExamPlan({ exam: examInfo(EXAM_T1), now: T0, available: { recheck: 5, life: true }, reader: readerOf(summaryOf([]), { start: () => null }) });
  assert.ok(!unknown.notes.includes('start'));
  coach.dispose();
  life.coach.dispose();
});

// ── 기기의 판 기록(§21-6 가 · 검토 D5) ──

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return { map, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}

test('판 기록은 영역과 끝난 때만 적고, 상한을 넘으면 오래된 줄부터 버리되 마지막 다시 확인은 남긴다', () => {
  const storage = memoryStorage();
  const log = createPlanLog({ storage, store: 'synk-atlas:guest' });
  assert.equal(log.key, `${PLAN_LOG_PREFIX}synk-atlas:guest`);
  assert.equal(log.key, planLogKey('synk-atlas:guest'));
  assert.equal(log.record('recheck', T0 - 9 * DAY), true);
  assert.equal(log.record('reading', T0 - HOUR), true);
  assert.equal(log.record('writing', T0), false, '판 기록의 영역은 다시 확인 · 듣기 · 읽기 · 시험 형식뿐이다');
  assert.equal(log.record('mock', T0 - 2 * HOUR), true, '시험 형식 판(4-4d — 점검 칸의 시험 형식 줄)');
  assert.deepEqual(log.times('mock'), [T0 - 2 * HOUR]);
  assert.equal(log.record('reading', Number.NaN), false);
  assert.deepEqual(log.times('reading'), [T0 - HOUR]);
  assert.equal(log.lastCheck(examWeek(T0).start), T0 - 9 * DAY, '이번 주 앞의 가장 늦은 다시 확인');
  assert.equal(log.lastCheck(T0 - 10 * DAY), null);
  for (let i = 0; i < PLAN_NEXT_POLICY.log + 10; i += 1) log.record('listening', T0 - 8 * DAY + i * MIN);
  const rows = JSON.parse(storage.getItem(log.key)).rows;
  assert.equal(rows.length, PLAN_NEXT_POLICY.log, '상한');
  assert.equal(rows.filter(row => row.area === 'recheck').length, 1, '마지막 다시 확인은 남긴다(다음 확인의 간격을 잰다)');
  assert.equal(log.lastCheck(), T0 - 9 * DAY);
  // 저장소가 없거나 깨졌어도 계획이 서야 한다 — 그 판을 세지 못할 뿐이다.
  assert.equal(createPlanLog({ storage, store: '' }).record('reading', T0), false, '열쇠가 없으면 적지 않는다');
  assert.deepEqual(createPlanLog({ storage: { getItem: () => '{oops', setItem() {} }, store: 'x' }).times('reading'), []);
  assert.equal(createPlanLog({ storage: { getItem: () => null, setItem() { throw Error('full'); } }, store: 'x' }).record('reading', T0), false);
});

// 가짜 계정 길 · 로더(qa/atlas-next-account.test.mjs와 같은 꼴) — 엔진 모듈은 storeName만.
function accountLine({ enabled = true, revision = 1, learningSync = true } = {}) {
  const state = { enabled, revision, learningSync };
  state.trail = async () => ({
    learning: { enabled: state.enabled, revision: state.revision },
    learningSync: state.learningSync,
    transport: () => ({ get: async () => ({ summary: null, serverTime: 0 }), post: async () => ({ accepted: [], clamped: [], summary: null, serverTime: 0 }) }),
    postLegacy: async () => ({ ok: true }),
  });
  return state;
}
function fakeLoader() {
  const opened = [];
  const make = () => {
    const made = { options: null, disposed: 0, ready: Promise.resolve(), summary: () => ({ storage: { base: true } }), synced: async () => ({ ok: true, base: true }), guestRecords: async () => null, dispose() { made.disposed += 1; } };
    return made;
  };
  return { opened, load: async () => ({ coach: options => { const made = make(); made.options = options; opened.push(made); return made; }, SynkAtlas: { load: async () => ({ storeName: atlas.storeName }) } }) };
}
const recorder = () => ({ note() {}, snapshot: () => ({}) });
async function until(check, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    if (check()) return;
    if (Date.now() > end) throw Error('기다린 일이 오지 않았다');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test('판 기록의 열쇠는 그 코치의 저장소 이름이다 — 손님 · 올리는 길 · 기기 길, 동의 판이 오른 뒤에는 앞 판의 기록을 읽지 않는다(검토 D5)', async () => {
  const POOL = [{ itemKey: 'topik-items.x1' }];
  const storage = memoryStorage();
  const guest = createAtlasNext({ owner: 'guest', storage, load: fakeLoader().load, health: recorder() });
  const guestCoach = await guest.practiceCoach(POOL);
  assert.equal(guest.planLog(guestCoach).key, PLAN_LOG_PREFIX + atlas.storeName({}));
  assert.equal(guest.planLog({}), null, '이 입구가 연 코치가 아니면 판 기록이 없다');
  assert.equal(guest.planLog(null), null);
  guest.dispose();
  const line = accountLine();
  const next = createAtlasNext({ owner: 'acct-plan', storage, trail: line.trail, load: fakeLoader().load, health: recorder() });
  const coach = await next.practiceCoach(POOL);
  const first = next.planLog(coach);
  assert.equal(first.key, PLAN_LOG_PREFIX + atlas.storeName({ account: 'acct-plan', revision: 1 }));
  assert.equal(first.record('recheck', T0), true);
  assert.deepEqual(next.planLog(coach).times('recheck'), [T0], '같은 판의 코치는 같은 기록을 읽는다');
  line.revision = 2;
  coach.options.host.onAccount({ kind: 'account', code: 'REVISION_CONFLICT', status: 409, revision: 2 });
  await until(() => coach.disposed === 1);
  const again = await next.practiceCoach(POOL);
  const second = next.planLog(again);
  assert.equal(second.key, PLAN_LOG_PREFIX + atlas.storeName({ account: 'acct-plan', revision: 2 }));
  assert.deepEqual(second.times('recheck'), [], '「연습 기록 비우기」로 판이 오르면 앞 판의 판 기록은 읽히지 않는다');
  assert.equal(second.lastCheck(), null);
  next.dispose();
  const deviceLine = accountLine({ enabled: false, learningSync: false, revision: 4 });
  const device = createAtlasNext({ owner: 'acct-device', storage, trail: deviceLine.trail, load: fakeLoader().load, health: recorder() });
  const deviceCoach = await device.practiceCoach(POOL);
  assert.equal(device.planLog(deviceCoach).key, PLAN_LOG_PREFIX + atlas.storeName({ account: 'acct-device', revision: 4, local: true }), '기기 길은 그 기기 저장소의 이름');
  device.dispose();
  const bare = createAtlasNext({ owner: 'guest', storage: null, load: fakeLoader().load, health: recorder() });
  assert.equal(bare.planLog(await bare.practiceCoach(POOL)), null, '저장소가 없는 입구는 판 기록을 열지 않는다');
  bare.dispose();
});

// ── 새 길의 이번 주 계획(§21-6) ──

test('새 길 계획은 이번 주에 한 횟수를 이 기기의 판 기록으로 세고 표지를 싣는다 — 지난 다시 확인도 그 기록에서, 말하기 · 쓰기는 기기 시각', async () => {
  const { coach } = await homeCoach();
  const storage = memoryStorage();
  const log = createPlanLog({ storage, store: 'synk-atlas:guest' });
  const week = examWeek(T0);
  log.record('recheck', week.start + HOUR);
  log.record('reading', week.start + 2 * HOUR);
  log.record('reading', week.start + 2 * HOUR + 5 * MIN); // 같은 자리의 판(간격 안) — 한 번
  log.record('reading', week.start + DAY);
  log.record('listening', week.start - DAY); // 지난주
  const plan = weekOf({ coach, settings: EXAM_T1, now: T0, log }).examPlan;
  const done = Object.fromEntries(plan.areas.map(row => [row.area, row.done]));
  assert.equal(done.recheck, 1);
  assert.equal(done.reading, 2, '같은 간격 안의 판은 한 번으로 묶어 센다(지금 판 weekActivity와 같다)');
  assert.equal(done.listening ?? 0, 0, '지난주의 판은 세지 않는다');
  assert.equal(plan.doneScope, 'device');
  // 지난 다시 확인이 가까우면 이번 주에 또 확인하지 않는다(지금 판 lastRecheck와 같은 뜻). 시작점이 아닌 학생 · 이번 주가 다시 확인 주인 시험일로 본다.
  const seen = await homeCoach({ start: T0 - HOUR });
  for (const item of PRACTICE.filter(row => row.skillId.startsWith('ko.reading.')).slice(0, 2)) await answer(seen.coach, item.itemKey, true);
  seen.time.at(T0);
  const months = Array.from({ length: 18 }, (_, i) => { const at = new Date(Date.UTC(2027, i, 15)); return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`; });
  const date = months.find(value => examPlan.recheckWeek(value, week.start) && (examPlan.EXAM_PLAN_POLICY.recheckEvery[examPlan.examPhase(value, week.start).phase] || 4) > 1);
  assert.ok(date, '이번 주가 다시 확인 주이고 주기가 한 주보다 긴 시험일');
  const settings = { ...EXAM_T1, examDate: date };
  const fresh = weekOf({ coach: seen.coach, settings, now: T0 }).examPlan;
  assert.ok(!fresh.notes.includes('start'));
  assert.equal(fresh.areas.find(row => row.area === 'recheck')?.planned, 1, '지난 확인이 없으면 다시 확인 주');
  const recent = createPlanLog({ storage: memoryStorage(), store: 'r' });
  recent.record('recheck', week.start - 2 * DAY);
  const spaced = weekOf({ coach: seen.coach, settings, now: T0, log: recent }).examPlan;
  assert.equal(spaced.areas.find(row => row.area === 'recheck')?.planned ?? 0, 0, '지난 확인과의 간격이 주기보다 짧은 주는 다시 확인 주가 아니다');
  seen.coach.dispose();
  // 말하기 · 쓰기는 기기 시각으로 센다(계정의 Trail 시도는 읽지 않는다 — §21-6 「말하기」).
  const info = examInfo(EXAM_T2);
  const reader = readerOf(summaryOf([]));
  const speakingPlan = buildPlanNext({
    examPlan,
    info,
    reader,
    now: T0,
    available: { recheck: 0, life: true, speaking: [{ id: 'speaking-3', route: 'speaking:3' }, { id: 'speaking-5', route: 'speaking:5' }], writing: [{ id: 'w', routeId: 'writing:54', skillIds: [] }], topik2: { listening: false, reading: false } },
    writingTimes: [week.start + HOUR],
    speaking: { list: [{ id: 'speaking-3' }, { id: 'speaking-5' }], times: [week.start + 3 * HOUR], untried: 1 },
  });
  assert.equal(speakingPlan.exam.speaking, true, '말하기를 고른 학생은 시험 정보에 말하기가 붙는다');
  assert.equal(speakingPlan.areas.find(row => row.area === 'speaking').done, 1);
  assert.equal(speakingPlan.areas.find(row => row.area === 'writing').done, 1);
  assert.deepEqual(speakingPlan.speaking, { untried: 1, total: 2 });
  // 지을 수 없으면 계획이 없다(4-3처럼 세 줄만).
  assert.equal(buildPlanNext({ examPlan, info: null, reader, now: T0 }), null, '시험을 고르지 않은 학생');
  assert.equal(buildPlanNext({ examPlan: {}, info, reader, now: T0 }), null, '계획 모듈이 없음');
  assert.equal(buildPlanNext({ examPlan, info, reader: null, now: T0 }), null, '읽개가 없음');
  // 판 기록이 깨져도 계획은 선다(그 판을 세지 못할 뿐이다).
  const broken = { times() { throw Error('x'); }, lastCheck() { throw Error('x'); } };
  assert.ok(buildPlanNext({ examPlan, info: examInfo(EXAM_T1), reader, log: broken, now: T0, available: { recheck: 3, life: true } }));
  coach.dispose();
});

// ── 홈의 숙제 연습 줄(§21-6 · 검토 D3 · 카본 A9 · A10) ──

// 숙제가 있는 학생 — 생활 팩을 다 마쳐 오늘 공부 칸을 숙제 연습 하나가 겨룬다. 읽기 능력 하나에 놓친 답(혹은 도움받은 첫 만남)을 지어 넣는다.
async function homeworkStudent({ skillId = 'ko.reading.detail', wrong = 1, help = null, params = null, settings = EXAM_T1 } = {}) {
  const { coach, time } = await homeCoach({ start: T0 - 2 * HOUR, params });
  const items = PRACTICE.filter(item => item.skillId === skillId);
  const families = new Set();
  const used = items.filter(item => !families.has(item.familyKey) && families.add(item.familyKey)).slice(0, help ? 1 : 3);
  // 놓친 답은 끝에 둔다 — 이어 맞힌 수가 서면 두뇌는 「한 단계 올려 볼게요」를 먼저 말한다(목표 문장은 엔진이 더 구체적인 말이 없을 때만 — plan.mjs goalReason).
  for (const [i, item] of used.entries()) {
    await answer(coach, item.itemKey, help ? true : i < used.length - wrong, { help, audio: item.audioRequired ?? item.modality === 'listening' });
    time.advance(MIN);
  }
  // 판 끝에 접어야 칸에 든다(접히기 전에는 「칸이 따라오는 중」 — 놓친 수가 칸에 없다, 21-3).
  assert.equal(await coach.finishSet({ kind: 'short' }).folded, true);
  time.at(T0);
  const progress = progressOf({ completed: ORDER });
  return { coach, time, progress, items, used, settings };
}

test('숙제 연습 — 놓친 답이 있는 숙제는 오늘 공부 칸의 줄이고 이유는 숙제 문장이다, 후보는 그 능력의 처음 보는 문항이다', async () => {
  const s = await homeworkStudent();
  const week = weekOf({ coach: s.coach, settings: s.settings, now: s.time.t });
  assert.deepEqual(week.examPlan.homework.map(row => [row.skillId, row.status]).slice(0, 1), [['ko.reading.detail', 'missed']]);
  const plan = homePlan({ coach: s.coach, progress: s.progress, now: s.time.t, settings: s.settings, week });
  const act = plan.candidates.find(open => open.id === `${HOMEWORK_PREFIX}ko.reading.detail`);
  assert.ok(act, '숙제 연습 활동을 넘긴다');
  assert.equal(act.route, 'practice');
  assert.equal(act.skillId, 'ko.reading.detail');
  const row = plan.today.items.find(item => item.kind === 'new');
  assert.equal(row?.activityId, act.id, '오늘 공부 칸의 줄');
  assert.equal(row.why.code, 'host.homework');
  assert.equal(row.why.text, `이번 주 숙제예요. 「${ko('ko.reading.detail')}」에서 놓친 답이 있어 새 문항으로 다시 확인해요.`);
  assert.equal(plan.examPlan, week.examPlan, '홈 계획이 이번 주 계획을 싣는다(계획 입구 · 알림이 읽는다)');
  // 후보 거름(검토 D3): 그 능력의 처음 보는 문항만, 돌아온 단위가 든 문항은 뺀다(다음 레슨과 같은 거름 — 그 단위는 복습 칸이 맡는다).
  const { todayActivities } = await import(moduleOf('SYNK_TODAY_MODULE', '../world-today.mjs'));
  const fresh = s.items.filter(item => week.fresh(item));
  assert.equal(fresh.length, s.items.length - s.used.length, '푼 문항은 처음 보는 문항이 아니다');
  const back = fresh[0];
  const units = new Set(s.coach.itemUnits(back.itemKey).map(row => row.unit));
  const acts = todayActivities({ snapshot: s.progress.exportSnapshot(), life: s.progress.summary(), judged: judgeOf(s.coach, s.progress, s.time.t), settings: s.settings, pool: PRACTICE, engine: true, dueUnits: units, itemUnits: key => s.coach.itemUnits(key), week, labels: id => ko(id) ?? id });
  const homework = acts.find(entry => entry.plan.id === `${HOMEWORK_PREFIX}ko.reading.detail`);
  const keys = homework.plan.candidates.map(row => row.itemKey);
  assert.ok(!keys.includes(back.itemKey), '돌아온 단위가 든 문항은 뺀다');
  assert.ok(keys.every(key => fresh.some(item => item.itemKey === key) && !s.coach.itemUnits(key).some(row => units.has(row.unit))));
  assert.ok(!keys.some(key => s.used.some(item => item.itemKey === key)), '푼 문항은 후보가 아니다');
  s.coach.dispose();
});

test('상태 없는 숙제(도움받은 첫 만남만)도 낼 후보가 있으면 줄이다 — 층 3 · 4여도, 숙제 문장 없이 엔진의 이유로(카본 A9)', async () => {
  const s = await homeworkStudent({ help: 'hint' });
  const week = weekOf({ coach: s.coach, settings: s.settings, now: s.time.t });
  const hw = week.examPlan.homework.find(row => row.skillId === 'ko.reading.detail');
  assert.ok(hw, '도움받은 첫 만남은 다시 볼 항목이다');
  assert.equal(hw.status, null, '놓친 답이 없으면 숙제 상태 없음');
  const plan = homePlan({ coach: s.coach, progress: s.progress, now: s.time.t, settings: s.settings, week });
  const row = plan.today.items.find(item => item.kind === 'new');
  assert.equal(row?.activityId, `${HOMEWORK_PREFIX}ko.reading.detail`, '숙제 연습 줄이 선다');
  assert.notEqual(row.why.code, 'host.homework', '상태를 모르면 숙제 문장을 짓지 않는다(두뇌 goalReason)');
  assert.ok(row.why.text, '엔진의 이유로 선다');
  // 층으로 가르지 않는다 — 층 3 · 4의 항목도 낼 것이 있으면 줄이다(두뇌 항목을 지어 넣어 본다).
  for (const tier of [3, 4]) {
    const act = { kind: 'new', role: 'homework', open: { id: 'world.homework.x', route: 'practice', label: 'x', minutes: 3 }, plan: { id: 'world.homework.x' } };
    const entry = { id: 'world.homework.x', locked: false, fact: -1, tier, todo: 0, offered: 3, idle: false, none: false, capped: false, why: { code: 'unit.new', slots: {}, line: '처음 만나요.' } };
    assert.equal(todayRows({ entries: [entry], activities: [act] }).rows.length, 1, `층 ${tier}`);
    assert.equal(todayRows({ entries: [{ ...entry, none: true, tier: 9, why: { code: 'host.homework', slots: {}, line: '이번 주 숙제예요.' } }], activities: [act] }).rows.length, 0, '낼 것이 없으면 숙제 문장이 있어도 줄이 아니다');
    assert.equal(todayRows({ entries: [{ ...entry, locked: true }], activities: [act] }).rows.length, 0, '잠긴 숙제 연습은 줄이 아니다');
    assert.equal(todayRows({ entries: [entry], activities: [act], dayCapped: true }).rows.length, 1, '상한 날에도 숙제 연습은 줄이다 — 상한은 복습만 미룬다(20-3)');
  }
  s.coach.dispose();
});

test('맨 앞 층이 9(새 단위 한도에 막힘)인데 두뇌가 숙제 문장을 내는 날은 숙제 연습 줄이 서지 않는다(설계 주인 11-15 · 21-5 실측 장면)', async () => {
  const s = await homeworkStudent({ params: { newPerDay: 0 } });
  const week = weekOf({ coach: s.coach, settings: s.settings, now: s.time.t });
  const plan = homePlan({ coach: s.coach, progress: s.progress, now: s.time.t, settings: s.settings, week });
  const id = `${HOMEWORK_PREFIX}ko.reading.detail`;
  const act = plan.candidates.find(open => open.id === id);
  assert.ok(act, '숙제 연습 활동은 넘긴다');
  const [entry] = s.coach.plan([{ id, candidates: s.items.filter(item => week.fresh(item)).map(item => ({ itemKey: item.itemKey })), facts: { goals: [{ kind: 'homework', skill: 'ko.reading.detail', status: 'missed' }] } }], { lang: 'ko' });
  assert.equal(entry.none, true, '새 단위 한도에 막혀 낼 것이 없다');
  assert.equal(entry.tier, 9);
  assert.equal(entry.why?.code, 'host.homework', '두뇌는 숙제 문장을 낸다');
  assert.ok(!plan.today.items.some(row => row.activityId === id), '그래도 숙제 연습 줄은 서지 않는다');
  s.coach.dispose();
});

test('소리를 끈 날의 듣기 숙제 — 소리를 켠 사실로 한 번 더 셈해, 낼 것이 있으면 조건에 걸린 날이고 새 단위 한도에 막혔으면 낼 것 없는 날이다(카본 A10)', async () => {
  const listen = PRACTICE.find(item => item.skillId === 'ko.listening.detail') ? 'ko.listening.detail' : PRACTICE.find(item => /^ko\.listening\./.test(item.skillId)).skillId;
  for (const [params, code] of [[null, 'blocked'], [{ newPerDay: 0 }, 'done']]) {
    const s = await homeworkStudent({ skillId: listen, params });
    const settings = { ...s.settings, audio: 'off' };
    const week = weekOf({ coach: s.coach, settings, now: s.time.t, audioAvailable: false });
    assert.ok(week.examPlan.homework.some(row => row.skillId === listen && row.blocked === 'audio'), '듣기 숙제는 소리를 끈 날 막혔다');
    const plan = homePlan({ coach: s.coach, progress: s.progress, now: s.time.t, settings: { ...settings, audioAvailable: false }, week });
    const act = plan.candidates.find(open => open.id === `${HOMEWORK_PREFIX}${listen}`);
    assert.ok(act?.audioRequired, '듣기 숙제 연습은 빼지 않고 잠근다');
    assert.ok(!plan.today.items.some(row => row.activityId === act.id), '잠긴 줄은 서지 않는다');
    assert.equal(plan.today.empty?.code, code, params ? '소리를 켜도 낼 것이 없으면 조건에 걸린 날이 아니다' : '소리를 켜면 낼 것이 있으니 조건에 걸린 날');
    s.coach.dispose();
  }
});

test('시간 조건에 걸린 숙제 연습도 풀어서 한 번 더 셈한다 — 낼 문항이 없으면 조건에 걸린 날이 아니라 다 한 날이다(4-4b 끝 판 Fable F2)', async () => {
  const s = await homeworkStudent();
  const id = `${HOMEWORK_PREFIX}ko.reading.detail`;
  // 그 능력의 처음 보는 문항을 뺀 풀 — 푼 문항만 남아 숙제 연습이 낼 것이 없다.
  const spent = PRACTICE.filter(item => item.skillId !== 'ko.reading.detail' || s.used.includes(item));
  const settings = { ...s.settings, minutes: 2 };
  const week = weekOf({ coach: s.coach, settings, now: s.time.t });
  assert.ok(week.examPlan.homework.some(row => row.skillId === 'ko.reading.detail' && row.status === 'missed'));
  for (const [pool, code, status] of [[PRACTICE, 'blocked', 'unavailable'], [spent, 'done', 'empty']]) {
    const plan = homePlan({ coach: s.coach, progress: s.progress, now: s.time.t, settings, week, pool });
    const act = plan.candidates.find(open => open.id === id);
    assert.ok(act, '숙제 연습 활동은 넘긴다');
    assert.ok(!plan.today.items.some(row => row.activityId === id), '시간 조건에 걸린 줄은 서지 않는다');
    assert.equal(plan.today.empty?.code, code, pool === spent ? '시간을 풀어도 낼 문항이 없으면 조건에 걸린 날이 아니다' : '시간을 풀면 낼 것이 있으니 조건에 걸린 날');
    assert.equal(plan.status, status);
  }
  s.coach.dispose();
});

// ── 점검 칸의 짧은 진단(§21-6 · 20-2 · 설계 주인 11-16 알림 3) ──

test('점검 칸은 이번 주 계획에 남은 다시 확인이 있고 진단이 낼 문항이 있을 때만 짧은 진단 줄이다 — 시작점이면 시작점 문장, 아니면 다시 확인 문장', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER.slice(0, 1) });
  const week = weekOf({ coach, settings: EXAM_T1, now: time.t });
  assert.ok(week.examPlan.notes.includes('start'));
  assert.equal(week.diagnostic.ready, true);
  const plan = homePlan({ coach, progress, now: time.t, settings: EXAM_T1, week });
  const check = plan.today.items.find(row => row.kind === 'check');
  assert.equal(check?.route, 'position', '여는 길은 내 위치의 짧은 진단');
  assert.equal(check.why.code, 'host.start');
  assert.equal(check.why.text, '시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.');
  const recheck = { ...week, examPlan: { ...week.examPlan, notes: week.examPlan.notes.filter(note => note !== 'start') } };
  assert.equal(homePlan({ coach, progress, now: time.t, settings: EXAM_T1, week: recheck }).today.items.find(row => row.kind === 'check')?.why.text, '이번 주 계획의 다시 확인이에요. 처음 보는 문항으로 지금 위치를 확인해요.');
  const closed = { ...week, diagnostic: { ready: false } };
  assert.ok(!homePlan({ coach, progress, now: time.t, settings: EXAM_T1, week: closed }).today.items.some(row => row.kind === 'check'), '진단이 낼 문항이 없으면(기록 일부 · 소리 끈 날 · 다 만남) 줄이 없다');
  const done = { ...week, examPlan: { ...week.examPlan, areas: week.examPlan.areas.map(row => (row.area === 'recheck' ? { ...row, done: row.planned, remaining: 0 } : row)) } };
  assert.ok(!homePlan({ coach, progress, now: time.t, settings: EXAM_T1, week: done }).today.items.some(row => row.kind === 'check'), '이번 주 다시 확인을 마쳤으면 줄이 없다');
  assert.ok(!homePlan({ coach, progress, now: time.t, settings: EXAM_T1 }).today.items.some(row => row.kind === 'check'), '시험을 고르지 않은 학생(계획 없음)은 4-3처럼 점검 칸이 빈다');
  coach.dispose();
});

// ── 점검 칸 넷(4-4d — 단계4_계획 §21-23의 3, 설계 주인 11-17 답 3 · 4) — 4-4b의 「새 길 홈에 쓰기 · 말하기 줄이 없다」를 뒤집었다 ──

// 셸(weekNext)이 이번 주 계획 값에 싣는 점검 칸 셋의 사실 — 시험 형식(고르기가 ready일 때) · 쓰기(TOPIK II의 53번과 한 가지 고치기) · 말하기(이번 주에
// 아직 안 해 본 유형 가운데 첫 유형).
const CHECK_FACTS = Object.freeze({
  mock: Object.freeze({ minutes: 40, audioRequired: true, done: false }),
  writing: Object.freeze({ label: '쓰기 연습 · 53', routeId: 'writing:53', minutes: 18, focus: 'ending-53', need: 'retry' }),
  speaking: Object.freeze({ label: '말하기 연습 · 그림 보고 이야기하기', routeId: 'speaking:3', minutes: 4, type: 'narrate', untried: 2 }),
});
function checkWeek(coach, now, facts = {}) {
  const week = weekOf({
    coach,
    settings: { ...EXAM_T2, speaking: true },
    now,
    extra: { speaking: [{ id: 'speaking-3', route: 'speaking:3' }] },
    speaking: { times: [], untried: CHECK_FACTS.speaking.untried },
  });
  // 이번 주 다시 확인을 마친 주 — 짧은 진단 줄은 서지 않고 나머지 셋이 겨룬다.
  // 다음 영역은 없는 것으로 두고(목표 없이 겨룸), 영역 목표를 보는 장면은 next를 따로 준다.
  const examPlan = { ...week.examPlan, next: null, areas: week.examPlan.areas.map(row => (row.area === 'recheck' ? { ...row, done: row.planned, remaining: 0 } : row)) };
  return { ...week, examPlan, ...CHECK_FACTS, ...facts };
}
const checkRow = plan => plan.today.items.find(row => row.kind === 'check') ?? null;
// 이번 주 계획의 그 영역을 채운 주(설계 주인 11-17 다시 여쭘의 답 — 점검 칸의 쓰기 · 말하기 줄은 그 영역의 몫이 남았을 때만 선다).
const fillArea = (base, area) => ({
  ...base,
  examPlan: { ...base.examPlan, areas: base.examPlan.areas.map(row => (row.area === area ? { ...row, done: row.planned, remaining: 0 } : row)) },
});

test('새 길 홈의 점검 칸에 쓰기 · 말하기가 선다 — 한 가지 고치기가 열린 쓰기는 그 목표로 앞서고, 이유 문장은 학생이 얻는 것을 말한다(4-4b 장면을 뒤집음)', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const plan = homePlan({ coach, progress, now: time.t, settings: { ...EXAM_T2, speaking: true }, week: checkWeek(coach, time.t) });
  assert.ok(plan.candidates.some(open => open.route === 'writing' && open.routeId === 'writing:53'), '쓰기 활동을 넘긴다');
  assert.ok(plan.candidates.some(open => open.route === 'speaking' && open.routeId === 'speaking:3'), '말하기 활동을 넘긴다');
  assert.ok(plan.candidates.some(open => open.route === 'mock'), '시험 형식 활동을 넘긴다');
  const row = checkRow(plan);
  assert.equal(row?.activityId, 'topik2-writing-53', '한 가지 고치기 목표를 맞춘 쓰기가 앞선다');
  assert.equal(row.why.code, 'host.writing');
  assert.deepEqual(row.why.slots, { focus: 'ending-53', need: 'retry' });
  assert.equal(row.why.text, '지난 53번 글에서 놓친 「-다」 끝맺음을 다시 연습해요. TOPIK 쓰기의 언어 사용 점수에 도움이 돼요.');
  assert.equal(row.open.routeId, 'writing:53', '여는 길은 53번 쓰기');
  // 몽골어 화면에서도 선다(§6 「TOPIK II 학생의 한 가지 고치기가 점검 칸에 서는지」는 몽골어 화면에서 본다)
  const mn = homePlan({ coach, progress, now: time.t, settings: { ...EXAM_T2, speaking: true }, week: checkWeek(coach, time.t), lang: 'mn' });
  assert.equal(checkRow(mn)?.activityId, 'topik2-writing-53');
  assert.match(checkRow(mn).why.text, /^Өмнөх 53 дугаар даалгаврын бичвэртээ/);
  coach.dispose();
});

test('점검 칸 넷이 두뇌에서 같은 자리이면 제품 차례(짧은 진단 → 시험 형식 → 쓰기 → 말하기)로 선다 — 다음 영역 목표를 맞춘 활동은 앞선다', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const settings = { ...EXAM_T2, speaking: true };
  const at = facts => checkRow(homePlan({ coach, progress, now: time.t, settings, week: checkWeek(coach, time.t, facts) }));
  const start = { ...CHECK_FACTS.writing, need: null };
  // 목표가 없는 셋 — 시험 형식이 쓰기 · 말하기보다 앞이다
  assert.equal(at({ writing: start })?.activityId, 'world.mock');
  // 시험 형식이 없으면 쓰기(한 가지 고치기 전 — 근거 없는 문장)가 말하기보다 앞이다
  const writingStart = at({ writing: start, mock: null });
  assert.equal(writingStart?.activityId, 'topik2-writing-53');
  assert.equal(writingStart.why.code, 'host.writing.start');
  assert.equal(writingStart.why.text, '53번 글을 한 편 써 봐요. 규칙 점검이 「-다」 끝맺음처럼 TOPIK 쓰기에서 확인해 볼 곳을 짚어 줘요.');
  // 다음 영역이 말하기면 말하기가 그 목표로 쓰기보다 앞선다
  const week = checkWeek(coach, time.t, { writing: start, mock: null });
  const speakingNext = checkRow(homePlan({ coach, progress, now: time.t, settings, week: { ...week, examPlan: { ...week.examPlan, next: { area: 'speaking', skillId: null } } } }));
  assert.equal(speakingNext?.activityId, 'world.speaking.check');
  assert.equal(speakingNext.why.code, 'host.speaking');
  assert.equal(speakingNext.why.text, 'TOPIK 말하기 여섯 유형 가운데 이번 주에 이 기기에서 아직 안 해 본 유형이 2개예요. 오늘은 「그림 보고 이야기하기」를 해 봐요.');
  assert.equal(speakingNext.open.routeId, 'speaking:3');
  // 쓰기가 없는 학생(TOPIK I)과 이번 주에 여섯 유형을 다 해 본 말하기 — 근거 없는 문장
  const again = at({ writing: null, mock: null, speaking: { ...CHECK_FACTS.speaking, untried: 0 } });
  assert.equal(again?.why.code, 'host.speaking.again');
  coach.dispose();
});

test('점검 칸 — 소리를 끈 날의 말하기 · 시간 설정에 걸린 시험 형식은 잠기고, 이번 주에 시험 형식 판을 한 뒤에는 시험 형식 줄이 서지 않는다', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const at = (settings, facts) => homePlan({ coach, progress, now: time.t, settings: { ...EXAM_T2, speaking: true, ...settings }, week: checkWeek(coach, time.t, facts) });
  const quiet = at({ audio: 'off' }, { writing: null, mock: null });
  assert.equal(checkRow(quiet), null, '소리를 끈 날의 말하기는 잠긴다');
  const mockQuiet = at({ audio: 'off' }, { writing: null, speaking: null });
  assert.equal(checkRow(mockQuiet), null, '소리를 끈 날 듣기가 든 시험 형식은 잠긴다');
  const short = at({ minutes: 10 }, { writing: null, speaking: null });
  assert.equal(checkRow(short), null, '시간 설정(10분)에 걸린 시험 형식(40분)은 잠긴다');
  const done = at({}, { writing: null, speaking: null, mock: { ...CHECK_FACTS.mock, done: true } });
  assert.ok(!done.candidates.some(open => open.route === 'mock'), '이번 주에 시험 형식 판을 했으면 넘기지 않는다');
  assert.equal(checkRow(done), null);
  coach.dispose();
});

test('다시 확인이 남은 주 — 다음 영역이 다시 확인이면 짧은 진단이 그 목표로 한 가지 고치기가 열린 쓰기와 같은 자리이고 제품 차례로 앞선다', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const settings = { ...EXAM_T2, speaking: true };
  const base = weekOf({ coach, settings, now: time.t, extra: { speaking: [{ id: 'speaking-3', route: 'speaking:3' }] } });
  const recheck = base.examPlan.areas.find(row => row.area === 'recheck');
  assert.ok(recheck?.remaining > 0 && base.diagnostic.ready === true, '이 장면은 다시 확인이 남고 짧은 진단을 낼 수 있는 주다');
  const at = next => checkRow(homePlan({ coach, progress, now: time.t, settings, week: { ...base, examPlan: { ...base.examPlan, next }, ...CHECK_FACTS } }));
  assert.equal(at({ area: 'recheck', skillId: null })?.activityId, 'world.position.check', '목표 하나씩 — 제품 차례로 짧은 진단');
  assert.equal(at({ area: 'writing', skillId: null })?.activityId, 'topik2-writing-53', '다음 영역이 쓰기면 쓰기가 두 목표로 앞선다');
  coach.dispose();
});

test('점검 칸의 쓰기 · 말하기 줄은 이번 주 계획의 그 영역이 남았을 때만 선다 — 쓰기를 채운 주에는 한 가지 고치기가 열려 있어도 말하기가 선다(설계 주인 11-17 다시 여쭘의 답 1)', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const settings = { ...EXAM_T2, speaking: true };
  const week = checkWeek(coach, time.t, { mock: null });
  const plan = at => homePlan({ coach, progress, now: time.t, settings, week: at });
  assert.ok(week.examPlan.areas.some(row => row.area === 'writing' && row.remaining > 0), '장면의 전제 — 계획에 쓰기 몫이 남았다');
  assert.ok(week.examPlan.areas.some(row => row.area === 'speaking' && row.remaining > 0), '장면의 전제 — 계획에 말하기 몫이 남았다');
  assert.equal(checkRow(plan(week))?.activityId, 'topik2-writing-53', '몫이 남은 주 — 한 가지 고치기 목표로 쓰기가 앞선다');
  const writingDone = plan(fillArea(week, 'writing'));
  assert.ok(!writingDone.candidates.some(open => open.route === 'writing'), '쓰기를 채운 주에는 쓰기를 넘기지 않는다');
  assert.equal(checkRow(writingDone)?.activityId, 'world.speaking.check', '말하기가 선다');
  const speakingDone = plan(fillArea(week, 'speaking'));
  assert.ok(!speakingDone.candidates.some(open => open.route === 'speaking'), '말하기를 채운 주에는 말하기를 넘기지 않는다');
  assert.equal(checkRow(speakingDone)?.activityId, 'topik2-writing-53', '쓰기가 선다');
  assert.equal(checkRow(plan(fillArea(fillArea(week, 'writing'), 'speaking'))), null, '둘 다 채우고 이번 주에 열린 고치기가 없으면 점검 칸 줄이 없다');
  const noWriting = { ...week, examPlan: { ...week.examPlan, areas: week.examPlan.areas.filter(row => row.area !== 'writing') } };
  assert.ok(!plan(noWriting).candidates.some(open => open.route === 'writing'), '계획에 쓰기 영역이 없으면 쓰기를 넘기지 않는다');
  coach.dispose();
});

test('보탬 — 점검 칸 넷의 이번 주 몫이 모두 찬 날에만 이번 주 쓰기에서 열린 한 가지 고치기가 한 줄로 선다(설계 주인 11-17 다시 여쭘의 답 2)', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const settings = { ...EXAM_T2, speaking: true };
  const base = checkWeek(coach, time.t, { mock: null });
  const bounds = base.examPlan.week;
  assert.ok(Number.isFinite(bounds?.start) && Number.isFinite(bounds?.end), '이번 주 계획에 주의 경계가 있다');
  const thisWeek = new Date(bounds.start + 60_000).toISOString();
  const lastWeek = new Date(bounds.start - 86_400_000).toISOString();
  const opened = (at, need = 'retry') => ({ ...base, writing: { ...CHECK_FACTS.writing, need, needAt: at } });
  const full = week => fillArea(fillArea(week, 'writing'), 'speaking');
  const plan = at => homePlan({ coach, progress, now: time.t, settings, week: at });
  // 3일째 쓰기로 고치기가 열린 뒤 말하기 계획이 남은 4일째 — 고치기가 아니라 말하기가 선다(설계 주인이 더하라고 한 장면)
  const speakingLeft = plan(fillArea(opened(thisWeek), 'writing'));
  assert.equal(checkRow(speakingLeft)?.activityId, 'world.speaking.check', '말하기 몫이 남은 날에는 말하기가 선다');
  assert.ok(!speakingLeft.candidates.some(open => open.route === 'writing'), '그날은 고치기를 넘기지 않는다');
  // 시험 형식이 남은 날 — 다른 줄이 하나라도 설 수 있으면 서지 않는다
  const mockLeft = plan({ ...full(opened(thisWeek)), mock: CHECK_FACTS.mock });
  assert.ok(mockLeft.candidates.some(open => open.route === 'mock'), '시험 형식을 넘긴다');
  assert.ok(!mockLeft.candidates.some(open => open.route === 'writing'), '그날은 고치기를 넘기지 않는다');
  // 몫이 모두 찬 날 — 이번 주 쓰기에서 열린 고치기가 선다
  const fixed = plan(full(opened(thisWeek)));
  const row = checkRow(fixed);
  assert.equal(row?.activityId, 'topik2-writing-53', '고치기가 선다');
  assert.equal(row.why.code, 'host.writing');
  assert.deepEqual(row.why.slots, { focus: 'ending-53', need: 'retry' });
  assert.equal(row.open.routeId, 'writing:53', '여는 길은 53번 쓰기');
  assert.equal(fixed.candidates.filter(open => open.route === 'writing').length, 1, '쓰기 활동은 하나');
  // 도움을 받아 고친 판(assisted)도 고치기가 아직 열린 것이라 「이번에는 혼자」 줄로 선다
  assert.deepEqual(checkRow(plan(full(opened(thisWeek, 'assisted'))))?.why.slots, { focus: 'ending-53', need: 'assisted' });
  // 지난주에 열린 고치기 · 열린 고치기가 없는 주 — 줄이 없다(계획이 찬 뒤에는 첫 글이 서지 않는다)
  assert.equal(checkRow(plan(full(opened(lastWeek)))), null, '지난주에 열린 고치기는 서지 않는다');
  assert.equal(checkRow(plan(full({ ...base, writing: { ...CHECK_FACTS.writing, need: null, needAt: null } }))), null, '열린 고치기가 없으면 첫 글이 서지 않는다');
  coach.dispose();
});

// 보탬을 막는 몫(설계 주인이 승인한 해석 1 — 잠긴 활동과 낼 것이 없는 활동도 몫은 남은 것이다). 넘길 줄이 없다는 것만으로는 몫이 모두 찬 날이
// 아니다(끝 판 검수 GPT GE1).
test('보탬은 점검 칸의 몫이 남은 날에는 서지 않는다 — 넘길 줄이 없어도 다시 확인이나 말하기 몫이 남았으면 그날은 보탬이 아니다(해석 1 · 끝 판 검수 GPT GE1)', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const settings = { ...EXAM_T2, speaking: true };
  const base = checkWeek(coach, time.t, { mock: null });
  const opened = { ...base, writing: { ...CHECK_FACTS.writing, need: 'retry', needAt: new Date(base.examPlan.week.start + 60_000).toISOString() } };
  const full = fillArea(fillArea(opened, 'writing'), 'speaking');
  const plan = week => homePlan({ coach, progress, now: time.t, settings, week });
  assert.equal(checkRow(plan(full))?.activityId, 'topik2-writing-53', '장면의 전제 — 몫이 모두 찬 날에는 보탬이 선다');
  // 다시 확인 몫이 남았는데 진단이 낼 문항이 없는 주 — 셸은 이 값을 짓지 않지만(계획은 낼 문항이 있을 때만 다시 확인 몫을 세운다) 홈 플래너는 몫으로 본다
  assert.ok(full.examPlan.areas.find(row => row.area === 'recheck')?.planned > 0, '장면의 전제 — 계획에 다시 확인 칸이 있다');
  const recheckAreas = full.examPlan.areas.map(row => (row.area === 'recheck' ? { ...row, done: 0, remaining: row.planned } : row));
  const recheckLeft = plan({ ...full, diagnostic: { ready: false }, examPlan: { ...full.examPlan, areas: recheckAreas } });
  assert.ok(!recheckLeft.candidates.some(open => open.route === 'position'), '진단이 낼 문항이 없으면 짧은 진단을 넘기지 않는다');
  assert.ok(!recheckLeft.candidates.some(open => open.route === 'writing'), '다시 확인 몫이 남아 보탬이 서지 않는다');
  // 말하기 몫이 남았는데 말하기 줄을 지을 값이 없는 주(셸이 말하기 항목의 유형을 읽지 못함)
  const speakingLeft = plan({ ...fillArea(opened, 'writing'), speaking: null });
  assert.ok(!speakingLeft.candidates.some(open => open.route === 'speaking'), '말하기 값이 없으면 말하기를 넘기지 않는다');
  assert.ok(!speakingLeft.candidates.some(open => open.route === 'writing'), '말하기 몫이 남아 보탬이 서지 않는다');
  coach.dispose();
});

// 소리를 끈 날 지금 판 계획은 말하기를 닫는다(notes 'speaking-audio-off' · 이번 주에 한 적이 없으면 영역도 빠진다). 위 「소리를 끈 날의 말하기」
// 장면은 소리를 켠 채 지은 주를 써서 이 길을 보지 못했다 — 여기서는 셸처럼 소리를 끈 날의 재료로 이번 주 계획을 짓는다(끝 판 검수 GPT GE1).
test('소리를 끈 날 — 계획이 말하기를 닫아도 이번 주에 하지 않은 말하기는 잠긴 줄로 넘어가 조건에 걸린 날이 되고 보탬은 서지 않는다 · 이번 주에 한 말하기와 말하기 항목이 없는 날은 보탬이 선다(해석 1 · GPT GE1)', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER });
  const settings = { ...EXAM_T2, speaking: true, audio: 'off' };
  const bounds = examPlan.examWeek(time.t);
  // 다시 확인과 시험 형식은 이번 주에 마쳤고 쓰기는 채웠다. 이번 주 쓰기에서 연 고치기가 열려 있다.
  const quietWeek = ({ times = [], list = [{ id: 'speaking-3', route: 'speaking:3' }], speaking = CHECK_FACTS.speaking } = {}) => {
    const week = weekOf({ coach, settings, now: time.t, audioAvailable: false, extra: { speaking: list }, speaking: { times, untried: CHECK_FACTS.speaking.untried } });
    const areas = week.examPlan.areas.map(row => (row.area === 'recheck' ? { ...row, done: row.planned, remaining: 0 } : row));
    const writing = { ...CHECK_FACTS.writing, need: 'retry', needAt: new Date(bounds.start + 60_000).toISOString() };
    const mock = { ...CHECK_FACTS.mock, audioRequired: false, done: true };
    return fillArea({ ...week, examPlan: { ...week.examPlan, next: null, areas }, mock, writing, speaking }, 'writing');
  };
  const plan = week => homePlan({ coach, progress, now: time.t, settings, week });
  const quiet = quietWeek();
  assert.ok(quiet.examPlan.notes.includes('speaking-audio-off'), '장면의 전제 — 소리를 끈 날 계획이 말하기를 닫는다');
  assert.ok(!quiet.examPlan.areas.some(row => row.area === 'speaking'), '장면의 전제 — 이번 주에 한 적이 없어 계획에 말하기 영역이 없다');
  const locked = plan(quiet);
  assert.ok(locked.candidates.some(open => open.route === 'speaking'), '말하기를 넘긴다 — 소리 때문에 잠긴다');
  assert.ok(!locked.candidates.some(open => open.route === 'writing'), '보탬은 서지 않는다');
  assert.equal(checkRow(locked), null, '잠긴 줄은 그리지 않는다');
  assert.deepEqual([locked.status, locked.today.empty?.code], ['unavailable', 'blocked'], '오늘 칸이 비어 홈이 조건에 걸린 날로 학습 조건 단추를 낸다');
  // 이번 주에 말하기를 한 주 — 몫이 찼다. 말하기를 넘기지 않고 보탬이 선다
  const did = quietWeek({ times: [new Date(bounds.start + 2 * 3_600_000).toISOString()] });
  assert.ok(did.examPlan.areas.some(row => row.area === 'speaking' && row.done > 0 && row.remaining === 0), '장면의 전제 — 이번 주에 한 말하기가 영역에 남는다');
  const didPlan = plan(did);
  assert.ok(!didPlan.candidates.some(open => open.route === 'speaking'), '이번 주에 한 말하기는 넘기지 않는다');
  assert.equal(checkRow(didPlan)?.activityId, 'topik2-writing-53', '보탬이 선다');
  // 말하기 항목이 없는 날(모듈을 아직 부르지 못함) — 소리를 켜도 말하기가 없으니 몫이 없다. 보탬이 선다
  assert.equal(checkRow(plan(quietWeek({ list: [], speaking: null })))?.activityId, 'topik2-writing-53', '말하기 항목이 없으면 보탬이 선다');
  coach.dispose();
});

test('점검 칸의 설명 칸이 틀리면 그 줄의 이유가 비어 서지 않는다 · 오늘 공부 · 복습 칸의 줄은 계획 목표가 있을 때와 없을 때 같다', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER.slice(0, 1) });
  const settings = { ...EXAM_T2, speaking: true };
  const bad = homePlan({ coach, progress, now: time.t, settings, week: checkWeek(coach, time.t, { writing: null, mock: null, speaking: { ...CHECK_FACTS.speaking, type: 'chat' } }) });
  assert.ok(!bad.today.items.some(row => row.kind === 'check'), '표 밖의 열거값 — 이유가 비어 줄이 서지 않는다');
  const week = checkWeek(coach, time.t);
  const withGoals = homePlan({ coach, progress, now: time.t, settings, week: { ...week, examPlan: { ...week.examPlan, next: { area: 'writing', skillId: null } } } });
  const without = homePlan({ coach, progress, now: time.t, settings, week });
  const others = plan => plan.today.items.filter(row => row.kind !== 'check').map(row => [row.kind, row.activityId, row.why.code]);
  assert.ok(others(withGoals).length > 0, '오늘 공부 칸에 줄이 있다');
  assert.deepEqual(others(withGoals), others(without), '계획 목표는 점검 칸 넷에만 싣는다');
  coach.dispose();
});

test('홈은 엔진 판일 때만 이번 주 계획을 싣는다 — 확인 중(생활 판정이 서기 전)이면 계획 없이 제품 사실 줄만', async () => {
  const { coach, time } = await homeCoach();
  const progress = progressOf({ completed: ORDER.slice(0, 1) });
  const week = weekOf({ coach, settings: EXAM_T1, now: time.t });
  const say = why => atlas.renderReason(why, { lang: 'ko' });
  const checking = createWorldTodayPlan({ coach, progress, judged: { state: 'checking' }, settings: EXAM_T1, now: time.t, pool: PRACTICE, say, week });
  assert.equal(checking.examPlan, null);
  assert.ok(!checking.candidates.some(open => open.id.startsWith(HOMEWORK_PREFIX) || open.route === 'position'), '확인 중에는 숙제 연습 · 진단을 넘기지 않는다');
  coach.dispose();
});

// ── 생활 상황 이름(§21-6 「관심 줄과 상황 이름」 · 설계 주인 21-10 덧붙인 물음 2) ──

test('상황 이름 표의 한국어는 Strata 지도의 label_ko와 같고, 생활 레슨이 쓰는 상황을 모두 덮는다', () => {
  const map = readJson('../../../strata/maps/topik-i.json');
  const nodes = new Map((Array.isArray(map.nodes) ? map.nodes : Object.values(map.nodes)).map(node => [node.id, node]));
  const used = [...new Set(PACKS.flatMap(pack => worldLife.lifeSituations(pack.skills.map(skill => skill.id))))].sort();
  assert.deepEqual(Object.keys(SITUATIONS_KO).sort(), used, '생활 레슨이 쓰는 상황마다 하나');
  for (const [id, name] of Object.entries(SITUATIONS_KO)) {
    assert.equal(nodes.get(id)?.kind, 'situation', id);
    assert.equal(name, nodes.get(id).label_ko, `${id}의 한국어 이름은 Strata label_ko와 같다(손으로 옮긴 이름이 어긋나면 잡는다)`);
  }
  assert.ok(Object.isFrozen(SITUATIONS_KO));
  assert.ok(!Object.keys(STRINGS).some(key => key.startsWith('sit-')), '세 언어가 다 있어야 하는 1판 표에는 넣지 않는다');
});

test('이름 함수는 생활 상황 이름을 한국어 화면에서만 준다 — 관심 문장은 한국어에서 서고 영어 · 몽골어에서는 짓지 않는다(Vellum은 언어를 물러서지 않는다)', () => {
  assert.equal(situationName('sit-travel-order', 'ko'), '주문');
  assert.equal(situationName('sit-people-messenger', 'ko'), '영상통화·메신저');
  for (const lang of ['en', 'mn']) assert.equal(situationName('sit-travel-order', lang), null, lang);
  assert.equal(situationName('sit-unknown', 'ko'), null);
  assert.equal(situationName('toString', 'ko'), null, '표의 원형 이름을 이름으로 읽지 않는다');
  const why = { code: 'goal.match', slots: { topic: 'sit-travel-order' } };
  assert.equal(atlas.renderReason(why, { lang: 'ko', label: labelOf('ko') }), '더 배우고 싶다고 알려 준 「주문」이에요.');
  assert.equal(atlas.renderReason({ ...why, slots: { topic: 'sit-travel-directions' } }, { lang: 'ko', label: labelOf('ko') }), '더 배우고 싶다고 알려 준 「길 묻기」예요.');
  for (const lang of ['en', 'mn']) assert.equal(atlas.renderReason(why, { lang, label: labelOf(lang) }), null, `${lang} — 세 겹 대조 전에는 관심 문장을 짓지 않는다`);
});
