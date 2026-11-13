// 4-2 WORLD 생활 새 길 — 판 겉(createLifeNext) · 「돌아온 복습」(lifeDue) · 진도에 판정 넣기(setDueSource) · 셸의 판정 넣기(watchLifeDue)
// (단계 4 계획 §19). 앞쪽은 가짜 코치로 갈래를 하나씩, 뒤쪽은 진짜 엔진 코치(손님 저장소 · 메모리 포트)와 진짜 생활 진도로 돈다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import * as atlas from '../../../packages/atlas/src/index.mjs';
import { homeTutorRecommendation } from '../../brand-opening/home-tutor-lines.mjs';
import { LESSONS, PACKS } from '../life-content.mjs';
import { lifeAssessable, lifeItem } from '../life-items.mjs';
import { createLifeProgress } from '../life-progress.mjs';
import { lessonSlot, reviewSlot } from '../life-trail.mjs';
import { buildWorldLearningCandidates } from '../world-learning-plan.mjs';
import { createLifeNext, lifeDue, lifeUnitsOf, stuckBook, watchLifeDue } from '../world-life-next.mjs';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse('2026-11-13T00:00:00.000Z');
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(check, ms = 5000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw Error('기다린 일이 오지 않았다');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  };
}

// ── lifeDue ──
// 진도(life-progress.mjs)가 적는 복습 기록 그대로: 본문항 답(at) — 놓침(틀림 · 직접 연 도움)이면 lapses 1 · streak 0 · 1분 뒤, 아니면 하루 뒤.
// lastAt이 at보다 뒤면 그때 새 장면 복습에 답했다 — reviewed 'alone'(기본: 혼자 맞힘 — streak 1 · 하루 뒤) · 'missed'(틀림 · 도움 — lapses +1 · 1분 뒤).
const MINUTE = 60_000;
function review(id, { lessonId = 'L', questionId = id, at = T0, correct = true, helped = false, helpSource, lastAt = at, reviewed = 'alone' } = {}) {
  const difficult = !correct || (helped && helpSource !== 'setting');
  const r = {
    id: `${id}-transfer`,
    questionId,
    lessonId,
    packId: 'p',
    skillId: 's',
    dueAt: at + (difficult ? MINUTE : DAY),
    lastAt: at,
    streak: 0,
    lapses: difficult ? 1 : 0,
    intervalDays: difficult ? 0 : 1,
  };
  if (lastAt > at) {
    const missed = reviewed === 'missed';
    r.streak = missed ? 0 : r.streak + 1;
    r.lapses += missed ? 1 : 0;
    r.intervalDays = missed ? 0 : 1;
    r.dueAt = lastAt + (missed ? MINUTE : DAY);
    r.lastAt = lastAt;
  }
  return r;
}
// cleared: 그 레슨을 다시 하기로 열어 본문항 답이 비워졌다(진도의 복습 기록은 그대로 — F2).
function snapshotOf(rows) {
  const lessons = {};
  const reviews = {};
  for (const row of rows) {
    const r = review(row.q, {
      lessonId: row.lesson ?? 'L',
      at: row.at,
      correct: row.correct ?? true,
      helped: row.helped ?? false,
      helpSource: row.helpSource,
      lastAt: row.lastAt ?? row.at,
      reviewed: row.reviewed,
    });
    reviews[r.id] = r;
    lessons[r.lessonId] ??= { answers: {} };
    if (row.cleared) continue;
    lessons[r.lessonId].answers[row.q] = {
      correct: row.correct ?? true,
      helped: row.helped ?? false,
      ...(row.helpSource ? { helpSource: row.helpSource } : {}),
      at: row.at,
    };
  }
  return { lessons, reviews };
}
const unitsFrom = table => r => table[r.questionId ?? r.id.replace(/-transfer$/, '')] ?? [];

test('lifeDue ① 방금 놓친 것 — 틀렸거나 직접 도움을 연 본문항의 복습은 혼자 맞힐 때까지 남고, 돌아온 때는 진도의 값(놓친 답 1분 뒤)이다(설정 도움은 아님 · L6 · Fable F1)', () => {
  const snapshot = snapshotOf([
    { q: 'a', at: T0, correct: false },
    { q: 'b', at: T0 + 10, correct: true, helped: true },
    { q: 'c', at: T0, correct: true, helped: true, helpSource: 'setting' },
    { q: 'd', at: T0, correct: false, lastAt: T0 + 60_000 },
  ]);
  const units = unitsFrom({ a: ['ko.life.x'] });
  // 1분 안 — 아직 돌아오지 않았고 「곧 돌아올 표현」 · 다음 때에 든다(지금 판과 같은 「조금 뒤」)
  const soon = lifeDue({ snapshot, unitsOf: units, now: T0 + 1000 });
  assert.deepEqual(soon.ids, []);
  assert.deepEqual(
    soon.upcoming.map(row => [row.id, row.at]),
    [
      ['a-transfer', T0 + MINUTE],
      ['b-transfer', T0 + 10 + MINUTE],
    ],
  );
  assert.equal(soon.nextAt, T0 + MINUTE);
  const out = lifeDue({ snapshot, unitsOf: units, now: T0 + 2 * MINUTE });
  assert.deepEqual(out.ids, ['a-transfer', 'b-transfer'], 'd는 새 장면에서 혼자 맞혔다');
  assert.deepEqual(
    out.items.map(item => [item.why, item.at]),
    [
      ['soon', T0 + MINUTE],
      ['soon', T0 + 10 + MINUTE],
    ],
  );
  assert.deepEqual(out.times, [T0 + MINUTE, T0 + 10 + MINUTE], '알림은 돌아온 때(고정 시각)로 가른다');
  assert.equal(out.nextAt, null, '앞으로 열릴 것이 없으면 다음 때도 없다');
});

test('lifeDue ① — 새 장면 복습을 틀리거나 도움 받고 답해도 혼자 맞힐 때까지 「조금 뒤」 다시 돌아온다(단위 있는 것 · 없는 것 · 다른 단위에 놓침이 적힌 것 — Fable 5.2 합친 끝 판 F1)', () => {
  const rows = [
    // 본문항을 놓친 뒤 새 장면 복습도 틀림 — 생활 단위 있음 · 엔진 기억 줄 없음(놓침이 다른 단위에 적힘)
    { q: 'a', at: T0, correct: false, lastAt: T0 + HOUR, reviewed: 'missed' },
    // 생활 단위 없는 복습 — 본문항은 맞혔고 복습을 도움 받고 답함
    { q: 'b', at: T0, lastAt: T0 + HOUR, reviewed: 'missed' },
    // 혼자 맞힌 복습 — 빠진다
    { q: 'c', at: T0, correct: false, lastAt: T0 + HOUR, reviewed: 'alone' },
  ];
  const units = unitsFrom({ a: ['ko.life.x'], c: ['ko.life.y'] });
  const memory = [{ unit: 'ko.life.y', lastAt: T0 + HOUR, dueAt: T0 + HOUR + 1.3 * DAY }];
  const back = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, now: T0 + HOUR + 2 * MINUTE });
  assert.deepEqual(back.ids, ['a-transfer', 'b-transfer'], '틀린 복습 둘은 곧 다시 — 혼자 맞힌 c는 빠짐');
  assert.ok(back.items.every(item => item.why === 'soon' && item.at === T0 + HOUR + MINUTE), '돌아온 때는 진도의 값(그 답 1분 뒤)');
  assert.deepEqual(back.stuck, [], '놓친 것은 붙들 뿐 stuck이 아니다');
  // 열흘 뒤에도 그대로 — 혼자 맞힐 때까지
  const later = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, now: T0 + 10 * DAY });
  assert.deepEqual(later.ids.slice(0, 2), ['a-transfer', 'b-transfer']);
  // 그 단위가 엔진의 돌아온 것(③)에도 걸리면 ①로 한 번
  const both = lifeDue({
    snapshot: snapshotOf([...rows, { q: 'd', at: T0 }]),
    unitsOf: unitsFrom({ a: ['ko.life.x'], c: ['ko.life.y'], d: ['ko.life.x'] }),
    memory: [...memory, { unit: 'ko.life.x', lastAt: T0, dueAt: T0 + DAY }],
    due: [{ unit: 'ko.life.x' }],
    now: T0 + 2 * DAY,
  });
  assert.deepEqual(
    both.items.map(item => [item.id, item.why]),
    [
      ['a-transfer', 'soon'],
      ['b-transfer', 'soon'],
    ],
    'x는 ①의 a로 한 번 — 같은 단위의 d를 ③으로 또 세지 않는다',
  );
});

test('lifeDue — 레슨을 다시 하기로 열어 본문항 답이 비워져도 ① · ② 대기는 그대로다(진도의 복습 기록으로 읽는다 — Fable 5.2 합친 끝 판 F2)', () => {
  const rows = [
    { q: 'a', at: T0, correct: false },
    { q: 'b', at: T0 },
    { q: 'c', at: T0, lastAt: T0 + 2 * DAY },
  ];
  const units = unitsFrom({ a: ['ko.life.x'], b: ['ko.life.y'], c: ['ko.life.z'] });
  for (const now of [T0 + DAY / 2, T0 + DAY + 1000, T0 + 3 * DAY]) {
    const kept = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, now });
    const cleared = lifeDue({ snapshot: snapshotOf(rows.map(row => ({ ...row, cleared: true }))), unitsOf: units, now });
    assert.deepEqual(cleared, kept, `다시 하기를 열기만 한 판정이 앞과 같다(${(now - T0) / DAY}일)`);
  }
  const after = lifeDue({ snapshot: snapshotOf(rows.map(row => ({ ...row, cleared: true }))), unitsOf: units, now: T0 + DAY + 1000 });
  assert.deepEqual(after.ids, ['a-transfer', 'b-transfer'], '놓친 a는 ①, 처음인 b는 하루 뒤 다리로');
  assert.deepEqual(after.stuck, ['c-transfer'], '혼자 맞혔는데 기억 줄이 없는 c는 그대로 stuck(받아들인 틈)');
});

test('lifeDue ①은 놓친 문항마다 — 같은 생활 단위의 놓친 복습 둘은 둘(결과 화면 soon 묶음과 같은 수), 그 단위는 ② 다리 · ③ 엔진에서 다시 세지 않는다(GPT 합친 끝 판 GC3)', () => {
  const snapshot = snapshotOf([
    { q: 'a', at: T0, correct: false },
    { q: 'b', at: T0 + 10, correct: false },
    { q: 'c', at: T0 + 20 },
  ]);
  const units = unitsFrom({ a: ['ko.life.x'], b: ['ko.life.x'], c: ['ko.life.x'] });
  const out = lifeDue({ snapshot, unitsOf: units, due: [{ unit: 'ko.life.x' }], now: T0 + DAY + 1000 });
  assert.deepEqual(out.ids, ['a-transfer', 'b-transfer'], '놓친 둘은 둘 — 같은 단위의 맞힌 c는 다리 · 엔진에서 또 세지 않는다');
  assert.ok(out.items.every(item => item.why === 'soon'));
  assert.deepEqual(out.upcoming, [], '그 단위는 앞으로 열릴 것에도 다시 들지 않는다');
});

test('lifeDue ② 처음 만나는 장면 — 기억 줄 없는 생활 단위의 복습은 본문항 하루 뒤 한 번, 단위마다 하나, 한 번 답하면 다시 안 연다(E · L3)', () => {
  const rows = [
    { q: 'a', at: T0 },
    { q: 'b', at: T0 + 5000 },
    { q: 'c', at: T0 },
  ];
  const units = unitsFrom({ a: ['ko.life.x'], b: ['ko.life.x'], c: ['ko.life.y'] });
  const before = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, now: T0 + DAY - 1 });
  assert.deepEqual(before.ids, []);
  assert.equal(before.nextAt, T0 + DAY, '다음 때는 하루 뒤');
  assert.deepEqual(
    before.upcoming.map(row => row.id),
    ['a-transfer', 'c-transfer'],
    '같은 단위의 다른 복습(b)은 다리를 또 세지 않는다',
  );
  const after = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, now: T0 + DAY + 10_000 });
  assert.deepEqual(after.ids, ['a-transfer', 'c-transfer'], 'x는 하나(이른 것) · y 하나');
  assert.ok(after.items.every(item => item.why === 'first' && item.at === T0 + DAY));
  const answered = snapshotOf([{ q: 'a', at: T0, lastAt: T0 + DAY + 20_000 }]);
  const once = lifeDue({ snapshot: answered, unitsOf: units, now: T0 + 3 * DAY });
  assert.deepEqual(once.ids, [], '답했는데 기억 줄이 없으면 다시 열지 않는다');
  assert.deepEqual(once.stuck, ['a-transfer'], '계기에 남길 것');
});

test('lifeDue ③ 돌아온 단위마다 복습 하나 — 안 답한 것 → 오래된 것 → 원고 차례, 한 단위는 한 번만(①이 먼저 · L5), 돌아온 때는 그 단위의 다음 때', () => {
  const rows = [
    { q: 'a', at: T0, lastAt: T0 + 3 * DAY },
    { q: 'b', at: T0, lastAt: T0 + 2 * DAY },
    { q: 'c', at: T0 + 1000 },
    { q: 'd', at: T0, correct: false },
    { q: 'e', at: T0 + 3.5 * DAY },
  ];
  const units = unitsFrom({ a: ['ko.life.x'], b: ['ko.life.x'], c: ['ko.life.y'], d: ['ko.life.z'], e: ['ko.life.x'] });
  const memory = [
    { unit: 'ko.life.x', lastAt: T0, dueAt: T0 + DAY },
    { unit: 'ko.life.y', lastAt: T0, dueAt: T0 + 2 * DAY },
    { unit: 'ko.life.z', lastAt: T0, dueAt: T0 + DAY },
  ];
  const due = [{ unit: 'ko.life.x' }, { unit: 'ko.life.y' }, { unit: 'ko.life.z' }];
  const out = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, due, now: T0 + 4 * DAY });
  assert.deepEqual(out.ids, ['d-transfer', 'e-transfer', 'c-transfer'], 'z는 방금 놓친 것으로 한 번 · x는 안 답한 e(답한 것 가운데 가장 오래된 b보다 먼저) · y는 c');
  const noE = lifeDue({ snapshot: snapshotOf(rows.slice(0, 4)), unitsOf: units, memory, due, now: T0 + 4 * DAY });
  assert.deepEqual(noE.ids, ['d-transfer', 'b-transfer', 'c-transfer'], '모두 답했으면 마지막 답이 가장 오래된 b');
  // ①이 센 단위는 그 단위의 다른 복습을 돌아온 것으로 또 세지 않는다(한 단위는 한 번만)
  const twice = lifeDue({
    snapshot: snapshotOf([...rows, { q: 'f', at: T0, lastAt: T0 + DAY }]),
    unitsOf: unitsFrom({ a: ['ko.life.x'], b: ['ko.life.x'], c: ['ko.life.y'], d: ['ko.life.z'], e: ['ko.life.x'], f: ['ko.life.z'] }),
    memory,
    due,
    now: T0 + 4 * DAY,
  });
  assert.deepEqual(twice.ids, out.ids, '①이 센 z의 다른 복습 f는 또 세지 않는다');
  assert.deepEqual(
    out.items.map(item => [item.why, item.at]),
    [
      ['soon', T0 + MINUTE],
      ['due', T0 + DAY],
      ['due', T0 + 2 * DAY],
    ],
  );
});

test('lifeDue — 생활 단위 없는 복습(19개)은 방금 놓친 것으로만 돌아오고, 기억 줄의 다음 때가 날짜 줄이 되며, 진도에 없는 단위 · 지난 때는 세지 않는다(19-2 · F)', () => {
  const rows = [
    { q: 'a', at: T0 },
    { q: 'b', at: T0, correct: false },
    { q: 'c', at: T0 },
  ];
  const units = unitsFrom({ c: ['ko.life.y'] });
  const memory = [
    { unit: 'ko.life.y', lastAt: T0, dueAt: T0 + 3 * DAY },
    { unit: 'ko.life.nowhere', lastAt: T0, dueAt: T0 + DAY },
  ];
  const out = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, due: [], now: T0 + 2 * DAY });
  assert.deepEqual(out.ids, ['b-transfer']);
  assert.equal(out.nextAt, T0 + 3 * DAY, '진도에 복습이 없는 단위(nowhere)의 때는 날짜가 되지 않는다');
  assert.deepEqual(out.upcoming, [{ id: 'c-transfer', unit: 'ko.life.y', at: T0 + 3 * DAY }]);
  const due = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, due: [{ unit: 'ko.life.nowhere' }], now: T0 + 2 * DAY });
  assert.deepEqual(due.ids, ['b-transfer'], '진도에 복습이 없는 단위가 돌아와도 열 것이 없다');
  // 때가 지났는데 돌아온 목록(due)에 없는 단위(하루 한도 · 끈질긴 단위로 쉼)는 「다음 복습」 날짜 · 곧 돌아올 표현이 되지 않는다
  const held = lifeDue({
    snapshot: snapshotOf([...rows, { q: 'g', at: T0, lastAt: T0 + 1000 }]),
    unitsOf: unitsFrom({ c: ['ko.life.y'], g: ['ko.life.w'] }),
    memory: [...memory, { unit: 'ko.life.w', lastAt: T0, dueAt: T0 + DAY }],
    due: [],
    now: T0 + 2 * DAY,
  });
  assert.equal(held.nextAt, T0 + 3 * DAY, '지난 때는 다음 복습 날짜가 되지 않는다');
  assert.equal(held.upcoming.some(row => row.unit === 'ko.life.w'), false);
});

// ── 판 겉 ──
function fakeCoach() {
  const calls = [];
  let n = 0;
  return {
    calls,
    present(item, context) {
      calls.push(['present', item.itemKey, context.firstExposure ?? null]);
      n += 1;
      return `p${n}`;
    },
    help(pid, kind) {
      calls.push(['help', pid, kind]);
      return { id: 'h' };
    },
    delivery(pid, { audio }) {
      calls.push(['delivery', pid, audio]);
      return { id: 'd' };
    },
    answer(pid, result) {
      calls.push(['answer', pid, result.correct, result.assessable, result.reason ?? null]);
      return { stored: Promise.resolve(true) };
    },
  };
}
const item = (key, extra = {}) => ({ itemKey: key, familyKey: `${key}.f`, skillId: 's', ...extra });

test('판 겉 — 코치가 서기 전의 보임 · 도움 · 첫 답을 쌓아 두었다가 그 차례로 흘려보내고, 답은 늘 판정할 수 있는 답 · 설정이 편 도움은 시범 답, 도움이 이미 있으면 해설을 덧붙이지 않는다(L8 · L1 · D)', async () => {
  const coach = fakeCoach();
  let resolve;
  const ready = new Promise(r => (resolve = r));
  const surface = createLifeNext({ coach: () => ready, snapshot: () => null, assessable: () => true });
  surface.shown('k1', item('life.a'), { helped: true });
  surface.answer('k1', { correct: true, helped: true, helpBy: 'setting' });
  surface.shown('k2', item('life.b'));
  surface.help('k2', 'text');
  surface.answer('k2', { correct: true, helped: true, helpBy: 'user' });
  assert.equal(surface.metrics().queued, 5);
  assert.equal(surface.metrics().coach, 'waiting');
  resolve(coach);
  await settle();
  await settle();
  assert.deepEqual(coach.calls, [
    ['present', 'life.a', false],
    ['help', 'p1', 'explanation'],
    ['answer', 'p1', true, true, 'demo'],
    ['help', 'p1', 'answer'],
    ['present', 'life.b', false],
    ['help', 'p2', 'text'],
    ['answer', 'p2', true, true, null],
    ['help', 'p2', 'answer'],
  ]);
  assert.equal(surface.metrics().coach, 'ready');
  // 보일 때 이미 펼친 도움은 답이 없어도 적는다(설정 · 새로고침 뒤 이어 하기 — 도움만 보고 나간 것도 「이어서 혼자 맞힌 수」를 끊는다)
  const lone = fakeCoach();
  const only = createLifeNext({ coach: () => lone, snapshot: () => null, assessable: () => true });
  only.shown('k9', item('life.z'), { helped: true });
  await settle();
  await settle();
  assert.deepEqual(lone.calls, [
    ['present', 'life.z', false],
    ['help', 'p1', 'explanation'],
  ]);
});

test('판 겉 — 처음 만나는 검수 안 문항만 처음으로 내고, 검수 밖 · 이미 만난 계열 · 튜터 안내는 처음이 아니라고 낸다(B (ㄱ) · M5 · M6)', async () => {
  const coach = fakeCoach();
  const snapshot = { lessons: {}, reviews: {}, daily: { days: {} } };
  const surface = createLifeNext({ coach: () => coach, snapshot: () => snapshot, assessable: candidate => candidate.itemKey !== 'life.out' });
  const real = LESSONS.find(lesson => lesson.questions.length >= 2);
  const fresh = lifeItem({ lesson: real, question: real.questions[0] });
  surface.shown('a', fresh);
  surface.shown('b', { ...lifeItem({ lesson: real, question: real.questions[1] }), itemKey: 'life.out' });
  surface.guided(lifeItem({ lesson: real, question: real.questions[0], review: true }));
  await settle();
  await settle();
  const presents = coach.calls.filter(call => call[0] === 'present');
  assert.deepEqual(
    presents.map(call => call[2]),
    [null, false, false],
    '처음 · 검수 밖 · 안내 연습',
  );
  assert.deepEqual(coach.calls.at(-1), ['help', 'p3', 'explanation'], '안내 연습은 해설만, 답은 없다');
});

test('판 겉 — 코치가 끝내 서지 못하면 쌓인 일을 버리고 계기에 남기며, 판이 바뀌면 슬롯을 비우고 화면에 알린다(L8 · M9)', async () => {
  const notes = [];
  const gone = createLifeNext({ coach: () => null, note: (kind, outcome) => notes.push([kind, outcome]) });
  gone.shown('k', item('life.a'));
  gone.answer('k', { correct: true });
  await settle();
  await settle();
  assert.deepEqual(notes, [['save', { ok: false, code: 'LIFE_NO_COACH', dropped: 2, dependent: true }]]);
  const coach = fakeCoach();
  let retire = null;
  let closed = 0;
  const surface = createLifeNext({
    coach: () => coach,
    watch: (_, fn) => {
      retire = fn;
      return () => {};
    },
    onRetired: () => (closed += 1),
  });
  surface.shown('k', item('life.a'));
  await settle();
  await settle();
  assert.equal(surface.metrics().slots, 1);
  retire();
  assert.equal(surface.metrics().slots, 0);
  assert.equal(closed, 1);
  assert.equal(surface.answer('k', { correct: true }), null, '닫힌 판의 슬롯으로는 답하지 않는다');
});

// ── 진도에 판정 넣기 ──
test('진도 — 넣은 판정이 없으면 지금 판 그대로, 넣으면 그 목록 · 수 · 다음 때, 확인 중이면 0 · 날짜 없음, 고른 복습은 그대로 연다(§19-1 ⑤)', () => {
  let at = T0;
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => at });
  const lesson = LESSONS[0];
  progress.summary([], LESSONS);
  progress.startLesson(lesson);
  const [q1, q2] = lesson.questions;
  progress.recordAnswer({ lessonId: lesson.id, questionId: q1.id, correct: false });
  progress.recordAnswer({ lessonId: lesson.id, questionId: q2.id, correct: true });
  at += 2 * 60_000;
  const old = progress.summary([], LESSONS);
  assert.equal(old.dueCount, 1, '지금 판: 틀린 것은 1분 뒤');
  assert.equal(old.dueState, undefined);
  const emitted = [];
  const watched = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => at, onChange: () => emitted.push(1) });
  watched.setDueSource(() => null);
  assert.equal(emitted.length, 1, '판정을 넣으면 화면에 알린다');
  progress.setDueSource(() => ({ state: 'engine', ids: [q2.review.id, 'none-transfer'], nextAt: at + DAY, times: [at + DAY], upcoming: [] }));
  const next = progress.summary([], LESSONS);
  assert.deepEqual(next.dueIds, [q2.review.id], '진도에 없는 복습은 뺀다');
  assert.equal(next.dueCount, 1);
  assert.equal(next.dueExpressions, 1);
  assert.equal(next.nextReviewAt, at + DAY);
  assert.equal(next.dueState, 'engine');
  progress.setDueSource(() => ({ state: 'checking' }));
  const checking = progress.summary([], LESSONS);
  assert.equal(checking.dueCount, 0);
  assert.equal(checking.nextReviewAt, null);
  assert.equal(checking.dueState, 'checking');
  assert.equal(progress.startReview(6), null, '확인 중에는 판정 목록이 비어 있다');
  progress.setDueSource(() => {
    throw Error('판정 실패');
  });
  assert.equal(progress.summary([], LESSONS).dueState, 'checking', '판정이 던지면 확인 중');
  const run = progress.startReview(1, q1.review.id, null, { ids: [q1.review.id] });
  assert.deepEqual(run.ids, [q1.review.id], '고른 복습은 간격 · 판정을 건너뛰고 그대로 연다');
  progress.setDueSource(null);
  assert.equal(progress.summary([], LESSONS).dueState, undefined, 'null이면 지금 판으로');
});

test('진도 요약은 판정을 한 번만 잰다 — 한 요약 안의 수 · 목록 · 다음 때가 같은 판정이다(카본 합친 끝 판 B4)', () => {
  const at = T0;
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => at });
  progress.summary([], LESSONS);
  const lesson = LESSONS[0];
  progress.startLesson(lesson);
  const [q1] = lesson.questions;
  progress.recordAnswer({ lessonId: lesson.id, questionId: q1.id, correct: false });
  let calls = 0;
  // 잴 때마다 갈리는 판정(그 사이 경계를 넘거나 상태가 바뀐 것과 같다)
  progress.setDueSource(() => {
    calls += 1;
    return calls % 2
      ? { state: 'engine', ids: [q1.review.id], nextAt: null, times: [at], upcoming: [] }
      : { state: 'engine', ids: [], nextAt: at + DAY, times: [at + DAY], upcoming: [] };
  });
  calls = 0;
  const s = progress.summary([], LESSONS);
  assert.equal(calls, 1, '한 요약에 한 번');
  assert.equal(s.dueCount, s.dueIds.length, '수와 목록이 같은 판정');
  assert.deepEqual(s.dueReviews.map(r => r.id), s.dueIds);
});

// ── 판정을 읽는 자리(홈 튜터 · 홈 후보) ──
function greetedProgress(owner) {
  const clock = { at: T0 };
  const progress = createLifeProgress({ owner, mode: 'local', storage: memoryStorage(), now: () => clock.at });
  progress.summary(PACKS, LESSONS);
  const lesson = LESSONS.find(row => row.id === 'greetings-expressions');
  progress.startLesson(lesson);
  for (const question of lesson.questions)
    progress.recordAnswer({ lessonId: lesson.id, questionId: question.id, correct: true, choiceId: question.answerId });
  progress.finishLesson(lesson.id);
  clock.at += 2 * 60_000;
  return { progress, lesson, clock };
}

test('홈 튜터 — 새 길은 진도 요약에 넣은 판정으로 돌아온 복습을 권하고(지금 판의 1일 간격이 아니다), 확인 중이면 권하지 않는다(§19-1 ⑤)', () => {
  const owner = 'life-next-home';
  const { progress, lesson, clock } = greetedProgress(owner);
  const recommend = () =>
    homeTutorRecommendation({ owner, summary: progress.summary(PACKS, LESSONS), snapshot: progress.exportSnapshot(), lessons: LESSONS, now: clock.at });
  assert.notEqual(recommend().kind, 'review', '지금 판: 맞힌 표현은 1일 뒤');
  progress.setDueSource(() => ({ state: 'engine', ids: [lesson.questions[0].review.id], nextAt: null, times: [clock.at], upcoming: [] }));
  assert.equal(recommend().kind, 'review', '새 길: 판정에 든 복습');
  progress.setDueSource(() => ({ state: 'checking' }));
  assert.notEqual(recommend().kind, 'review', '확인 중이면 권하지 않는다');
});

test('홈 후보 — 판정이 있으면 그 목록(차례 그대로 · reviewAt은 지금)만 생활 복습 후보로, 확인 중이면 없고, 없으면 지금 판(M8)', () => {
  const { progress, lesson, clock } = greetedProgress('life-next-plan');
  const snapshot = progress.exportSnapshot();
  const reviewsOf = due => buildWorldLearningCandidates({ progress: snapshot, now: clock.at, due }).filter(row => row.route === 'review');
  assert.deepEqual(reviewsOf(null), [], '지금 판: 맞힌 표현은 1일 뒤');
  const later = due => buildWorldLearningCandidates({ progress: snapshot, now: clock.at + 2 * DAY, due }).filter(row => row.route === 'review');
  assert.equal(later(null).length, 1, '지금 판: 이틀 뒤면 돌아온다');
  assert.deepEqual(later({ state: 'checking' }), [], '확인 중이면 지금 판의 간격으로 고르지 않는다');
  const [q1, q2] = lesson.questions;
  const rows = reviewsOf({ state: 'engine', ids: [q2.review.id, q1.review.id] });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].reviewIds, [q2.review.id, q1.review.id], '판정의 차례 그대로');
  assert.equal(rows[0].reviewAt, new Date(clock.at).toISOString(), 'reviewAt은 지금 시각');
  assert.deepEqual(reviewsOf({ state: 'checking' }), [], '확인 중이면 복습 후보 없음');
});

// ── 셸의 판정 넣기(가짜 코치) ──
function fakeTimers() {
  const queue = [];
  return {
    queue,
    setTimeout(fn, ms) {
      const job = { fn, ms };
      queue.push(job);
      return job;
    },
    clearTimeout(job) {
      const at = queue.indexOf(job);
      if (at >= 0) queue.splice(at, 1);
    },
    run() {
      const job = queue.shift();
      job?.fn();
      return job;
    },
  };
}
function dueCoach({ base = true, waiting = false } = {}) {
  const state = { base, waiting, units: [], due: [] };
  return {
    state,
    summary: () => ({ units: state.units, storage: { base: state.base, waiting: state.waiting } }),
    due: () => state.due,
    itemUnits: () => [],
  };
}

test('판정 넣기 — 코치를 여는 동안 · 요약이 없거나 얹지 못하는 동안은 확인 중, 얹을 수 있게 되면 다시 그리고 엔진, 지금 판이면 거둔다(M7)', async () => {
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
  progress.summary([], LESSONS);
  const coach = dueCoach({ base: false });
  let open;
  const opening = new Promise(r => (open = r));
  const timers = fakeTimers();
  const watcher = watchLifeDue({ open: () => opening, progress, lessons: LESSONS, timers });
  assert.equal(progress.summary([], LESSONS).dueState, 'checking', '코치를 여는 동안');
  open(coach);
  await settle();
  await settle();
  assert.equal(progress.summary([], LESSONS).dueState, 'checking', '이 기기에 그 판의 요약이 아직 없다');
  assert.equal(timers.queue.length, 1, '확인 중으로 잰 동안만 다시 본다');
  timers.run();
  assert.equal(timers.queue.length, 1, '아직이면 늘려 가며 다시');
  assert.ok(timers.queue[0].ms > 3000);
  coach.state.base = true;
  coach.state.waiting = true;
  timers.run();
  assert.equal(progress.summary([], LESSONS).dueState, 'checking', '보기가 아무것도 얹지 못하는 동안');
  coach.state.waiting = false;
  timers.run();
  assert.equal(progress.summary([], LESSONS).dueState, 'engine');
  assert.equal(timers.queue.length, 0, '엔진이면 다시 보지 않는다');
  watcher.dispose();
  assert.equal(progress.summary([], LESSONS).dueState, undefined, '닫으면 지금 판(판정 없음)');

  const old = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
  old.summary([], LESSONS);
  const none = watchLifeDue({ open: async () => null, progress: old, lessons: LESSONS, timers: fakeTimers() });
  await settle();
  await settle();
  assert.equal(old.summary([], LESSONS).dueState, undefined, '지금 판으로 정해진 문서는 진도 간격 그대로');
  assert.equal(await none.coach(), null);
  const failed = watchLifeDue({ open: async () => Promise.reject(Error('엔진')), progress: old, lessons: LESSONS, timers: fakeTimers() });
  await settle();
  await settle();
  assert.equal(failed.state(), 'old', '엔진을 못 받아도 그 문서는 지금 판');
});

test('판정 넣기 — 판이 바뀌면 확인 중으로 두고 새 코치를 받는다, 앞 코치의 늦은 알림은 새 판을 건드리지 않는다', async () => {
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
  progress.summary([], LESSONS);
  const first = dueCoach();
  const second = dueCoach();
  const watchers = new Map();
  let opened = 0;
  let hold = null;
  const open = () => {
    opened += 1;
    if (opened === 1) return Promise.resolve(first);
    return new Promise(r => (hold = () => r(second)));
  };
  const retired = (made, fn) => {
    watchers.set(made, fn);
    return () => watchers.delete(made);
  };
  const watcher = watchLifeDue({ open, retired, progress, lessons: LESSONS, timers: fakeTimers() });
  await settle();
  await settle();
  assert.equal(await watcher.coach(), first);
  assert.equal(progress.summary([], LESSONS).dueState, 'engine');
  const retire = watchers.get(first);
  retire();
  assert.equal(progress.summary([], LESSONS).dueState, 'checking', '판을 다시 정하는 동안');
  assert.equal(watchers.has(first), false, '앞 코치의 알림은 끊는다');
  await settle();
  assert.equal(opened, 2, '판을 다시 정하는 코치를 한 번 청한다');
  retire();
  await settle();
  assert.equal(opened, 2, '같은 앞 코치의 두 번째 알림은 다시 받지 않는다');
  hold();
  await settle();
  await settle();
  assert.equal(await watcher.coach(), second);
  assert.equal(progress.summary([], LESSONS).dueState, 'engine');
  watcher.dispose();
});

test('판정 넣기 — 지금 판도 붙들지 않는다: 화면이 코치를 청하거나 입구가 풀렸다고 알리면 다시 묻고, 묻는 동안은 지금 판 그대로, 새 길이면 엔진(§19-3 7)', async () => {
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
  progress.summary([], LESSONS);
  const coach = dueCoach();
  let answer = null;
  let asked = 0;
  let hold = null;
  const open = () => {
    asked += 1;
    if (asked === 3) return new Promise(r => (hold = () => r(answer)));
    return Promise.resolve(answer);
  };
  const listeners = new Set();
  const reopened = fn => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const tell = () => {
    for (const fn of [...listeners]) fn({ reason: 'switch' });
  };
  const watcher = watchLifeDue({ open, reopened, progress, lessons: LESSONS, timers: fakeTimers() });
  await settle();
  await settle();
  assert.equal(watcher.state(), 'old', '문서 시작 때 지금 판으로 정해졌다');
  assert.equal(await watcher.coach(), null, '화면이 청하면 다시 묻는다 — 아직 지금 판');
  assert.equal(asked, 2);
  assert.equal(progress.summary([], LESSONS).dueState, undefined, '지금 판이면 진도 간격 그대로');
  answer = coach;
  tell();
  tell();
  await settle();
  assert.equal(asked, 3, '겹친 알림은 한 번만 묻는다');
  assert.equal(progress.summary([], LESSONS).dueState, undefined, '묻는 동안은 지금 판 그대로(확인 중으로 깜빡이지 않는다)');
  assert.equal(watcher.state(), 'old');
  hold();
  await settle();
  await settle();
  assert.equal(watcher.state(), 'engine', '새 길이면 엔진 판정');
  assert.equal(progress.summary([], LESSONS).dueState, 'engine');
  assert.equal(await watcher.coach(), coach);
  tell();
  await settle();
  assert.equal(asked, 3, '엔진이면 알림에도 다시 묻지 않는다(판이 바뀌면 retired가 다시 받는다)');
  watcher.dispose();
  assert.equal(listeners.size, 0, '닫으면 듣기를 끊는다');
});

test('판정 넣기 — 묻는 사이(확인 중 · 다시 묻는 중)에 온 「판이 풀렸다」 알림은 버리지 않는다: 그 물음이 지금 판으로 끝나면 한 번 더 묻는다(GPT · 카본 합친 끝 판 GC4 · C3 ①)', async () => {
  const coach = dueCoach();
  const listeners = new Set();
  const reopened = fn => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const tell = () => {
    for (const fn of [...listeners]) fn({ reason: 'opened' });
  };
  // ① 확인 중 — 문서 시작의 물음이 아직 안 끝났을 때 알림이 온다
  {
    const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
    progress.summary([], LESSONS);
    const answers = [];
    let asked = 0;
    const open = () => {
      asked += 1;
      return new Promise(resolve => answers.push(resolve));
    };
    const watcher = watchLifeDue({ open, reopened, progress, lessons: LESSONS, timers: fakeTimers() });
    await settle();
    assert.equal(watcher.state(), 'checking');
    tell();
    answers[0](null); // 처음 물음은 지금 판으로 끝났다(생활 은행을 못 받음)
    await until(() => asked === 2);
    answers[1](coach);
    await until(() => watcher.state() === 'engine');
    assert.equal(await watcher.coach(), coach, '알림을 버리지 않아 새 길로 갔다');
    watcher.dispose();
  }
  // ② 지금 판에서 다시 묻는 중 — 화면이 청한 물음이 도는 동안 알림이 온다
  {
    const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
    progress.summary([], LESSONS);
    const answers = [];
    let asked = 0;
    const open = () => {
      asked += 1;
      if (asked === 1) return Promise.resolve(null);
      return new Promise(resolve => answers.push(resolve));
    };
    const watcher = watchLifeDue({ open, reopened, progress, lessons: LESSONS, timers: fakeTimers() });
    await settle();
    await settle();
    assert.equal(watcher.state(), 'old');
    const asking = watcher.coach(); // 화면이 청함 — 다시 묻는 중
    await until(() => asked === 2);
    tell(); // 묻는 중에 온 알림
    answers[0](null); // 그 물음은 지금 판으로 끝났다
    await until(() => asked === 3);
    answers[1](coach);
    await until(() => watcher.state() === 'engine');
    assert.equal(await asking, coach, '화면이 청한 물음도 한 번 더 물은 답(새 길)까지 이어 받는다');
    assert.equal(await watcher.coach(), coach, '한 번 더 물어 새 길로 갔다');
    watcher.dispose();
  }
});

test('lifeDue — 때가 지났나는 호스트 판정(요약 줄 due)으로 — 기기 시계가 앞서도 호스트로 아직이면 「앞으로 열릴 것」에 남고, 호스트로 지났는데 목록에 없으면 그대로 세지 않으며, 단위가 둘인 복습은 한 번만 든다(카본 합친 끝 판 C4)', () => {
  const now = T0 + 5 * DAY;
  const snapshot = snapshotOf([
    { q: 'a', at: T0, lastAt: T0 + DAY + 1 },
    { q: 'b', at: T0, lastAt: T0 + DAY + 1 },
    { q: 'c', at: T0, lastAt: T0 + DAY + 1 },
  ]);
  const units = unitsFrom({ a: ['life:u1', 'life:u2'], b: ['life:u3'], c: ['life:u4'] });
  const out = lifeDue({
    snapshot,
    lessons: [],
    unitsOf: units,
    memory: [
      { unit: 'life:u1', lastAt: T0, dueAt: now + DAY, due: false },
      { unit: 'life:u2', lastAt: T0, dueAt: now + 2 * DAY, due: false },
      { unit: 'life:u3', lastAt: T0, dueAt: now - 60_000, due: false }, // 기기 시계로는 지났지만 호스트(서버 시각)로는 아직 — due()에 없다
      { unit: 'life:u4', lastAt: T0, dueAt: now - DAY, due: true }, // 호스트로도 지났는데 돌아온 목록에 없다 — 세지 않는다
    ],
    due: [],
    now,
  });
  assert.deepEqual(out.items, [], '지금 열 것은 없다');
  assert.deepEqual(
    out.upcoming.map(row => [row.id, row.unit]),
    [
      ['b-transfer', 'life:u3'],
      ['a-transfer', 'life:u1'],
    ],
    '지난 dueAt의 단위도 남고, 단위가 둘인 복습 a는 한 번만',
  );
  assert.equal(out.nextAt, now - 60_000, '다음 때는 그 단위(곧 열린다)');
  assert.deepEqual(out.times, [now - 60_000, now + DAY], '알림의 때도 복습마다 한 번');
});

test('lifeDue — 단위가 둘인 복습은 그 가운데 이른 때에 든다 — 기억 줄 차례가 늦은 단위를 앞에 둬도 다음 때 · 알림은 이른 때(카본 A1 · GPT GA3 처리 판)', () => {
  const now = T0 + 5 * DAY;
  const snapshot = snapshotOf([{ q: 'a', at: T0, lastAt: T0 + DAY + 1 }]);
  const out = lifeDue({
    snapshot,
    lessons: [],
    unitsOf: unitsFrom({ a: ['life:u1', 'life:u2'] }),
    memory: [
      { unit: 'life:u1', lastAt: T0, dueAt: now + 5 * DAY, due: false }, // 먼저 배워 간격이 는 단위 — 기억 줄 차례로는 앞
      { unit: 'life:u2', lastAt: T0, dueAt: now + DAY, due: false },
    ],
    due: [],
    now,
  });
  assert.deepEqual(
    out.upcoming.map(row => [row.id, row.unit, row.at]),
    [['a-transfer', 'life:u2', now + DAY]],
    '그 복습이 열리는 때는 이른 단위의 때',
  );
  assert.equal(out.nextAt, now + DAY);
  assert.deepEqual(out.times, [now + DAY], '알림도 이른 때 한 번');
});

// ── 진짜 엔진 코치(손님 저장소 · 메모리 포트) ──
const readJson = url => JSON.parse(fs.readFileSync(new URL(url, import.meta.url), 'utf8'));
const MAP_DATA = {
  index: readJson('../../../packages/atlas/map/index.json'),
  units: readJson('../../../packages/atlas/map/units.json'),
};
// 시험마다 저장소 열쇠를 따로 — 같은 열쇠의 손님 호스트는 한 문서에서 나눠 쓰여(시계까지) 앞 시험의 기록 · 시각이 섞인다.
let stores = 0;
async function realCoach(now) {
  stores += 1;
  const made = atlas.createCoach({
    gameId: 'world-life',
    banks: ['world-life'],
    words: true,
    mapData: MAP_DATA,
    dayOffset: 540,
    host: { guest: true, port: atlas.memoryPort(), key: `synk-atlas:world-life-test-${process.pid}-${stores}`, now },
  });
  await made.ready;
  return made;
}
const lifeUnits = (coach, candidate) =>
  coach
    .itemUnits(candidate.itemKey)
    .filter(row => row.kind === 'life')
    .map(row => row.unit);
const lineOf = (coach, unit) => coach.summary().units.find(line => line.unit === unit) ?? null;

test('엔진 뜻 — 혼자 맞힌 고르기는 약 1.3일 뒤, 검수 밖도 기억에 서고, 카페 장면 · 처음 만나는 단위의 시범 답은 줄을 세우지 않으며, 직접 연 해설 뒤 답은 놓침(6시간)이다(F · L1 · L2 · D)', async () => {
  let now = T0;
  const coach = await realCoach(() => now);
  const answers = [];
  const spy = Object.fromEntries(
    Object.entries(coach).map(([name, value]) => [name, typeof value === 'function' ? value.bind(coach) : value]),
  );
  spy.answer = (pid, result) => {
    const out = coach.answer(pid, result);
    answers.push({ pid, result, out });
    return out;
  };
  const mains = LESSONS.flatMap(lesson =>
    lesson.questions
      .filter(question => Array.isArray(question.choices))
      .map(question => ({ lesson, question, item: lifeItem({ lesson, question }) })),
  );
  const used = new Set();
  const pick = (why, ok) => {
    const found = mains.find(row => {
      const units = lifeUnits(coach, row.item);
      return units.length && units.every(unit => !used.has(unit)) && ok(row);
    });
    assert.ok(found, why);
    for (const unit of lifeUnits(coach, found.item)) used.add(unit);
    return found;
  };
  const solo = pick('검수 안 문항', row => lifeAssessable(row.item));
  const unchecked = pick('검수 밖 문항', row => !lifeAssessable(row.item) && !row.item.confounded);
  const scene = pick('카페 장면 문항', row => row.item.confounded === true);
  const demo = pick('시범 답 문항', row => lifeAssessable(row.item));
  const asked = pick('직접 해설 문항', row => lifeAssessable(row.item));
  const surface = createLifeNext({ coach: () => spy, snapshot: () => ({ lessons: {}, reviews: {}, daily: { days: {} } }) });
  const answer = (key, row, extra = {}) =>
    surface.answer(key, { correct: true, choiceId: row.question.answerId, correctId: row.question.answerId, ...extra });
  surface.shown('solo', solo.item);
  answer('solo', solo);
  surface.shown('unchecked', unchecked.item);
  answer('unchecked', unchecked);
  surface.shown('scene', scene.item);
  answer('scene', scene);
  surface.shown('demo', demo.item, { helped: true });
  answer('demo', demo, { helped: true, helpBy: 'setting' });
  surface.shown('asked', asked.item);
  surface.help('asked', 'explanation');
  answer('asked', asked, { helped: true, helpBy: 'user' });
  await until(() => answers.length === 5);
  await Promise.all(answers.map(row => row.out.stored));
  const gap = unit => {
    const line = lineOf(coach, unit);
    return line ? (line.dueAt - line.lastAt) / DAY : null;
  };
  const [soloUnit] = lifeUnits(coach, solo.item);
  assert.ok(gap(soloUnit) > 1.2 && gap(soloUnit) < 1.4, `혼자 맞힌 고르기의 첫 돌아옴 ${gap(soloUnit)}일`);
  assert.ok(lineOf(coach, lifeUnits(coach, unchecked.item)[0]), '검수 밖 문항도 기억에는 선다');
  assert.equal(lineOf(coach, lifeUnits(coach, scene.item)[0]), null, '카페 장면은 기억에 서지 않는다');
  assert.equal(lineOf(coach, lifeUnits(coach, demo.item)[0]), null, '처음 만나는 단위의 시범 답은 줄을 세우지 않는다');
  const askedGap = gap(lifeUnits(coach, asked.item)[0]);
  assert.ok(askedGap > 0.2 && askedGap < 0.3, `직접 연 해설 뒤 답은 놓침 — ${askedGap}일`);
  const demoAnswer = answers.find(row => row.result.reason === 'demo');
  assert.ok(demoAnswer, '시범 답은 reason demo로 간다');
  assert.equal(demoAnswer.out.grade ?? null, null, '시범 답은 등급이 없다');
  const evidence = Object.fromEntries(
    await Promise.all(
      answers.map(async row => [row.pid, await row.out.evidence]),
    ),
  );
  const soloPid = answers[0].pid;
  const uncheckedPid = answers[1].pid;
  assert.equal(evidence[soloPid].independent, true, '처음 만나 혼자 맞힌 검수 안 문항은 측정에 선다');
  assert.equal(evidence[uncheckedPid].independent, false, '검수 밖 문항은 측정에 세지 않는다');
  coach.dispose();
});

test('한 바퀴(진짜 엔진 · 진짜 진도) — 확인 중 → 엔진, 틀린 문항은 곧 「방금 놓친 것」, 맞힌 표현은 1일 뒤에는 아직 · 1.3일 뒤 단위마다 하나 돌아오고 답하면 빠진다(M7 · L6 · M2 · L5)', async () => {
  let at = T0;
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => at });
  progress.summary([], LESSONS);
  const coach = await realCoach(() => at);
  let release;
  const gate = new Promise(r => (release = r));
  const watcher = watchLifeDue({ open: () => gate, progress, lessons: LESSONS, timers: fakeTimers() });
  const first = progress.summary([], LESSONS);
  assert.equal(first.dueState, 'checking');
  assert.equal(first.dueCount, 0);
  assert.equal(first.nextReviewAt, null);
  release(coach);
  await settle();
  await settle();
  assert.equal(progress.summary([], LESSONS).dueState, 'engine');
  const unitsOf = lifeUnitsOf(coach, LESSONS);
  // 본문항 · 복습이 같은 생활 단위를 싣고(놓침이 그 단위에 적히는 짝) 고르는 꼴인 문항이 둘 이상인 레슨
  const paired = lesson =>
    lesson.questions.filter(question => {
      if (!Array.isArray(question.choices)) return false;
      const main = lifeUnits(coach, lifeItem({ lesson, question }));
      return main.length && unitsOf({ id: question.review.id }).some(unit => main.includes(unit));
    });
  const lesson = LESSONS.find(candidate => paired(candidate).length >= 2 && candidate.questions.every(q => Array.isArray(q.choices)));
  assert.ok(lesson, '시험할 레슨');
  const surface = createLifeNext({ coach: () => watcher.coach(), snapshot: () => progress.exportSnapshot() });
  const { attemptId } = progress.startLesson(lesson);
  const missed = paired(lesson)[0];
  for (const question of lesson.questions) {
    const slot = lessonSlot(attemptId, question.id);
    surface.shown(slot, lifeItem({ lesson, question }));
    const correct = question !== missed;
    const choiceId = correct ? question.answerId : question.choices.find(choice => choice.id !== question.answerId).id;
    progress.recordAnswer({ lessonId: lesson.id, questionId: question.id, choiceId, correct });
    surface.answer(slot, { correct, choiceId, correctId: question.answerId });
  }
  progress.finishLesson(lesson.id);
  await settle();
  await settle();
  at += 2 * 60_000;
  const why = () => watcher.judge(progress.exportSnapshot(), at).items.map(row => [row.id, row.why]);
  assert.deepEqual(
    why().filter(([, kind]) => kind === 'soon'),
    [[missed.review.id, 'soon']],
    '틀린 문항은 단추 없이 나가도 곧 돌아온다',
  );
  assert.equal(progress.summary([], LESSONS).dueCount >= 1, true);
  // 틀린 것을 새 장면으로 답한다 — 「이 표현 같이 연습」과 같은 고른 복습
  const run = progress.startReview(1, missed.review.id, null, { ids: [missed.review.id] });
  const reviewQuestion = missed.review;
  const reviewSurface = reviewSlot(run.id, missed.review.id);
  surface.shown(reviewSurface, lifeItem({ lesson, question: missed, review: true }));
  progress.answerReview({ reviewId: missed.review.id, correct: true, runId: run.id });
  surface.answer(reviewSurface, { correct: true, choiceId: reviewQuestion.answerId, correctId: reviewQuestion.answerId });
  await settle();
  await settle();
  assert.equal(
    why().some(([id]) => id === missed.review.id),
    false,
    '새 장면으로 답한 뒤에는 빠진다',
  );
  // 맞힌 표현의 단위 — 틀린 문항이 싣지 않고, 이 레슨의 복습이 싣는 단위(틀린 단위는 같은 자리의 놓침으로 6시간 뒤 돌아온다 — M1).
  const missedUnits = new Set(lifeUnits(coach, lifeItem({ lesson, question: missed })));
  const reviewUnits = new Set(lesson.questions.flatMap(question => unitsOf({ id: question.review.id })));
  const solid = new Set(
    lesson.questions
      .filter(question => question !== missed)
      .flatMap(question => lifeUnits(coach, lifeItem({ lesson, question })))
      .filter(unit => !missedUnits.has(unit) && reviewUnits.has(unit)),
  );
  assert.ok(solid.size >= 1, '맞힌 단위가 있다');
  const dueSolid = () => watcher.judge(progress.exportSnapshot(), at).items.filter(row => row.why === 'due' && solid.has(row.unit));
  at = T0 + DAY + 60_000;
  assert.equal(dueSolid().length, 0, '맞힌 표현은 1일 뒤에는 아직(고르기의 첫 돌아옴 약 1.3일)');
  at = T0 + 1.35 * DAY;
  const back = dueSolid();
  assert.ok(back.length >= 1, '1.3일 뒤 돌아온다');
  assert.equal(new Set(back.map(row => row.unit)).size, back.length, '단위마다 하나');
  const summary = progress.summary([], LESSONS);
  assert.equal(summary.dueState, 'engine');
  assert.ok(back.every(row => summary.dueIds.includes(row.id)), '홈 칩 · 튜터가 읽는 진도 요약과 같은 목록');
  // 복습 결과 글(M4)이 읽는 그 단위의 다음 돌아올 때 — 기억 줄이 있으면 그 줄의 때, 진도에 없는 복습 · 생활 단위가 없으면 null.
  const missedLine = coach.summary().units.find(line => missedUnits.has(line.unit));
  assert.equal(watcher.nextAt(missed.review.id), missedLine.dueAt);
  assert.equal(watcher.nextAt('없는-문항-transfer'), null);
  watcher.dispose();
  assert.equal(watcher.nextAt(missed.review.id), null, '닫은 뒤에는 모름');
  coach.dispose();
});

// ── Fable 5.2 합친 끝 판(atlas-redesign-stage4-acct-life-final-20261113) 처리 ──
test('lifeDue 전수 — 원고의 복습을 하나씩 본문항 · 새 장면 둘 다 틀려도 모두 「조금 뒤」(1분 뒤) 돌아오고, 혼자 맞히면 빠진다 — 안 돌아오는 복습 0(Fable 5.2 합친 끝 판 F1)', () => {
  const all = LESSONS.flatMap(lesson => lesson.questions.map(question => ({ lesson, question })));
  assert.ok(all.length >= 60, `원고의 복습 ${all.length}개`);
  const wrong = [];
  for (const { lesson, question } of all) {
    let at = T0;
    const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => at });
    progress.summary([], LESSONS);
    progress.startLesson(lesson);
    progress.recordAnswer({ lessonId: lesson.id, questionId: question.id, correct: false });
    const id = question.review.id;
    // 생활 단위가 없는 것으로 본다 — ①은 진도 기록만 읽어 단위 · 기억 줄과 상관없이 돌아와야 한다
    const back = now => lifeDue({ snapshot: progress.exportSnapshot(), lessons: LESSONS, unitsOf: () => [], now }).ids.includes(id);
    at += 2 * MINUTE;
    if (!back(at)) wrong.push(`${id}: 본문항을 놓친 2분 뒤`);
    const run = progress.startReview(1, id, null, { ids: [id] });
    progress.answerReview({ id, runId: run.id, correct: false });
    if (back(at + 30_000)) wrong.push(`${id}: 틀린 복습이 1분 안에 돌아옴`);
    for (const later of [2 * MINUTE, 7 * HOUR, 2 * DAY, 30 * DAY]) if (!back(at + later)) wrong.push(`${id}: 틀린 복습 ${later / MINUTE}분 뒤`);
    at += 2 * MINUTE;
    const again = progress.startReview(1, id, null, { ids: [id] });
    progress.answerReview({ id, runId: again.id, correct: true });
    if (back(at + 2 * MINUTE)) wrong.push(`${id}: 혼자 맞힌 뒤에도 남음`);
  }
  assert.deepEqual(wrong, []);
});

test('lifeDue — 진짜 진도: 마친 레슨을 다시 하기로 열기만 해도 놓친 것(①) · 다리 대기(②)는 앞과 같다(Fable 5.2 합친 끝 판 F2)', () => {
  let at = T0;
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => at });
  progress.summary([], LESSONS);
  const lesson = LESSONS.find(candidate => candidate.questions.length >= 3 && !candidate.id.startsWith('cafe'));
  progress.startLesson(lesson);
  lesson.questions.forEach((question, index) =>
    progress.recordAnswer({ lessonId: lesson.id, questionId: question.id, correct: index !== 0 }),
  );
  progress.finishLesson(lesson.id);
  const unitOf = new Map(lesson.questions.map((question, index) => [question.review.id, [`ko.life.f2-${index}`]]));
  const judge = now => lifeDue({ snapshot: progress.exportSnapshot(), lessons: LESSONS, unitsOf: review => unitOf.get(review.id) ?? [], now });
  at += 2 * MINUTE;
  const before = [judge(at), judge(T0 + DAY + MINUTE), judge(T0 + 3 * DAY)];
  assert.deepEqual(before[0].ids, [lesson.questions[0].review.id], '놓친 것은 곧');
  assert.deepEqual(
    before[0].upcoming.map(row => row.id).sort(),
    lesson.questions.slice(1).map(q => q.review.id).sort(),
    '맞힌 것은 다리 대기',
  );
  // 다시 하기를 연다 — 진도는 그 레슨의 본문항 답을 비운다(복습 기록은 그대로)
  const replay = progress.startLesson(lesson, { replay: true });
  assert.deepEqual(replay.answers, {}, '다시 하기는 본문항 답을 비운다');
  assert.deepEqual([judge(at), judge(T0 + DAY + MINUTE), judge(T0 + 3 * DAY)], before, '판정은 열기 전과 같다');
});

// 기본 판이 낡아(30분 쉼 · 새벽 4시) 앞 제시 번호를 놓은 코치 — gone에 든 번호로 도움 · 소리 · 답을 부르면 PRESENTATION_GONE으로 던진다.
function staleCoach() {
  const coach = fakeCoach();
  const gone = new Set();
  const guard = (name, fn) => (pid, ...rest) => {
    if (gone.has(pid)) {
      coach.calls.push([`${name}:gone`, pid]);
      throw Object.assign(new Error('Atlas coach: 끝났거나 모르는 제시다'), { code: 'PRESENTATION_GONE' });
    }
    return fn(pid, ...rest);
  };
  return { ...coach, gone, help: guard('help', coach.help), delivery: guard('delivery', coach.delivery), answer: guard('answer', coach.answer) };
}

test('판 겉 — 코치가 앞 제시를 놓았으면(PRESENTATION_GONE) 그 문항을 다시 보이고(처음 아님) 앞 도움을 다시 실은 뒤 답 · 소리를 잇는다, 다른 오류는 잇지 않는다(Fable 5.2 합친 끝 판 F4)', async () => {
  const coach = staleCoach();
  const notes = [];
  const surface = createLifeNext({
    coach: () => coach,
    snapshot: () => null,
    assessable: () => true,
    note: (kind, outcome) => notes.push([kind, outcome.code]),
  });
  surface.shown('a', item('life.a'));
  surface.help('a', 'explanation');
  await settle();
  await settle();
  coach.gone.add('p1'); // 31분 쉼 뒤 다른 제시가 서며 기본 판이 새로 열렸다
  surface.answer('a', { correct: true, helped: true, helpBy: 'user' });
  assert.deepEqual(coach.calls.slice(2), [
    ['answer:gone', 'p1'],
    ['present', 'life.a', false],
    ['help', 'p2', 'explanation'],
    ['answer', 'p2', true, true, null],
    ['help', 'p2', 'answer'],
  ]);
  assert.deepEqual(notes, [['save', 'LIFE_REPRESENTED']], '다시 보여 이은 수는 따로 센다');
  // 소리(카페 직원 말)도 같은 길
  surface.shown('b', item('life.b'));
  coach.gone.add('p3');
  surface.delivery('b', 'completed');
  assert.deepEqual(coach.calls.slice(-3), [
    ['delivery:gone', 'p3'],
    ['present', 'life.b', false],
    ['delivery', 'p4', 'completed'],
  ]);
  // 다른 오류는 다시 보이지 않고 그대로 계기에
  const broken = fakeCoach();
  const brokenNotes = [];
  broken.answer = () => {
    throw Object.assign(new Error('저장소'), { code: 'STORAGE_ERROR' });
  };
  const other = createLifeNext({ coach: () => broken, snapshot: () => null, note: (kind, outcome) => brokenNotes.push(outcome.code) });
  other.shown('c', item('life.c'));
  other.answer('c', { correct: true });
  await settle();
  await settle();
  assert.equal(broken.calls.filter(call => call[0] === 'present').length, 1, '다시 보이지 않는다');
  assert.deepEqual(brokenNotes, ['STORAGE_ERROR']);
});

test('판 겉 — 시도를 열 때(prepare) 코치를 청해 판 바뀜을 듣는다: 첫 문항 전에 판이 바뀌어도 화면에 알린다(Fable 5.2 합친 끝 판 F7)', async () => {
  const coach = fakeCoach();
  let retire = null;
  let closed = 0;
  const surface = createLifeNext({
    coach: () => coach,
    watch: (_, fn) => {
      retire = fn;
      return () => {};
    },
    onRetired: () => (closed += 1),
  });
  surface.prepare();
  await settle();
  await settle();
  assert.equal(typeof retire, 'function', '보임 전에 판 바뀜을 듣는다');
  assert.equal(coach.calls.length, 0, '청하기만 — 아무것도 보이지 않는다');
  retire();
  assert.equal(closed, 1, '첫 문항 전의 판 바뀜도 화면에 알린다');
  surface.dispose();
  surface.prepare();
  await settle();
  assert.equal(surface.metrics().coach, 'none', '닫은 겉은 청하지 않는다');
});

test('판 겉 — 끝자리: 도움 없는 슬롯의 도움 받은 답 앞에 해설 · 답 뒤 도움과 두 번째 답은 버림 · 닫은 뒤 · 코치 약속 거절 뒤 다시 받기 · 판이 바뀐 뒤 늦게 온 코치(넘친 #4)', async () => {
  const coach = fakeCoach();
  const surface = createLifeNext({ coach: () => coach, snapshot: () => null, assessable: () => true });
  surface.shown('a', item('life.a'));
  surface.answer('a', { correct: true, helped: true, helpBy: 'user' });
  surface.help('a', 'hint');
  surface.answer('a', { correct: false });
  await settle();
  await settle();
  assert.deepEqual(
    coach.calls,
    [
      ['present', 'life.a', false],
      ['help', 'p1', 'explanation'],
      ['answer', 'p1', true, true, null],
      ['help', 'p1', 'answer'],
    ],
    '도움 받은 답은 해설을 앞에 적고, 답 뒤의 도움 · 두 번째 답은 적지 않는다',
  );
  surface.shown('b', item('life.b'));
  surface.answer('b', { correct: true, helped: true, helpBy: 'setting' });
  assert.deepEqual(
    coach.calls.slice(4),
    [
      ['present', 'life.b', false],
      ['help', 'p2', 'explanation'],
      ['answer', 'p2', true, true, 'demo'],
      ['help', 'p2', 'answer'],
    ],
    '설정이 편 도움의 답은 해설 + 시범 답',
  );
  surface.dispose();
  assert.equal(surface.shown('c', item('life.c')), null);
  assert.equal(coach.calls.length, 8, '닫은 뒤에는 아무것도 적지 않는다');
  // 코치 약속이 거절되면 그 일은 버리고(계기) 다음 일에서 다시 청한다
  let attempt = 0;
  const later = fakeCoach();
  const notes = [];
  const retry = createLifeNext({
    coach: () => (++attempt === 1 ? Promise.reject(Error('엔진')) : later),
    snapshot: () => null,
    note: (kind, outcome) => notes.push(outcome.code),
  });
  retry.shown('a', item('life.a'));
  await settle();
  await settle();
  assert.deepEqual(notes, ['LIFE_COACH_FAILED']);
  retry.shown('b', item('life.b'));
  await settle();
  await settle();
  assert.deepEqual(later.calls.map(call => call[1]), ['life.b'], '거절 뒤 다시 청해 다음 일을 적는다');
  // 판이 바뀐 뒤 늦게 온 앞 약속은 받지 않는다
  const holds = [];
  let retire = null;
  const late = createLifeNext({
    coach: () => new Promise(r => holds.push(r)),
    watch: (_, fn) => {
      retire = fn;
      return () => {};
    },
    snapshot: () => null,
  });
  late.shown('a', item('life.a'));
  await settle(); // 코치는 다음 차례에 청한다
  const ready = fakeCoach();
  holds[0](ready);
  await settle();
  await settle();
  late.shown('b', item('life.b'));
  retire(); // 판이 바뀜 — 슬롯을 비우고 다음 일에서 새 코치를 청한다
  late.shown('c', item('life.c'));
  await settle();
  await settle();
  const fresh = fakeCoach();
  holds[1](fresh);
  await settle();
  await settle();
  assert.deepEqual(ready.calls.map(call => call[1]), ['life.a', 'life.b'], '앞 판의 일은 앞 코치에');
  assert.deepEqual(fresh.calls.map(call => call[1]), ['life.c'], '판이 바뀐 뒤의 일은 새 코치에만');
});

// 생활 단위를 문항 열쇠로 돌려주는 코치(판정 넣기 시험)
function unitCoach(map) {
  const coach = dueCoach();
  coach.itemUnits = key => (map.get(key) ?? []).map(unit => ({ kind: 'life', unit }));
  return coach;
}

test('판정 넣기 — LIFE_BRIDGE_STUCK은 방금 적힌 복습 답을 세지 않고(판 겉이 코치에 넘기는 중), 정말 줄이 안 선 복습만 이 기기 · 주인에서 한 번 센다(Fable 5.2 합친 끝 판 F8)', async () => {
  let at = T0;
  let progress = null;
  progress = createLifeProgress({
    owner: 'guest',
    mode: 'local',
    storage: memoryStorage(),
    now: () => at,
    // 셸처럼 — 진도가 저장을 알리면 요약을 그린다(판정을 잰다)
    onChange: () => progress?.summary([], LESSONS),
  });
  progress.summary([], LESSONS);
  const lesson = LESSONS.find(candidate => candidate.questions.length >= 2 && !candidate.id.startsWith('cafe'));
  const [q1, q2] = lesson.questions;
  const keyOf = question => lifeItem({ lesson, question, review: true }).itemKey;
  const coach = unitCoach(
    new Map([
      [keyOf(q1), ['ko.life.s1']],
      [keyOf(q2), ['ko.life.s2']],
    ]),
  );
  const notes = [];
  const seen = new Set();
  const noted = { has: id => seen.has(id), add: id => seen.add(id) };
  const watcher = watchLifeDue({
    open: async () => coach,
    progress,
    lessons: LESSONS,
    note: (kind, outcome) => notes.push(outcome.code),
    noted,
    timers: fakeTimers(),
  });
  await settle();
  await settle();
  progress.startLesson(lesson);
  progress.recordAnswer({ lessonId: lesson.id, questionId: q1.id, correct: true });
  progress.recordAnswer({ lessonId: lesson.id, questionId: q2.id, correct: true });
  at = T0 + DAY + MINUTE;
  assert.deepEqual(
    watcher.judge(progress.exportSnapshot(), at).ids.sort(),
    [q1.review.id, q2.review.id].sort(),
    '다리로 둘이 열린다',
  );
  // ① 정상 다리 복습 — 진도의 저장 알림(onChange)이 코치에 답이 가기 전에 판정을 잰다
  const run = progress.startReview(2, null, null, { ids: [q1.review.id, q2.review.id] });
  progress.answerReview({ id: q1.review.id, runId: run.id, correct: true });
  assert.deepEqual(notes, [], '방금 적힌 답은 세지 않는다');
  coach.state.units.push({ unit: 'ko.life.s1', lastAt: at, dueAt: at + 1.3 * DAY }); // 판 겉이 코치에 넘겨 줄이 섰다
  // ② 줄이 끝내 안 서는 복습(답이 버려짐)
  progress.answerReview({ id: q2.review.id, runId: run.id, correct: true });
  at += 3 * MINUTE;
  watcher.judge(progress.exportSnapshot(), at);
  watcher.judge(progress.exportSnapshot(), at + MINUTE);
  assert.deepEqual(notes, ['LIFE_BRIDGE_STUCK'], '정말 줄이 안 선 복습 하나만 한 번');
  // 다른 문서(새 감시)라도 이 기기 · 주인에서 이미 센 복습은 다시 세지 않는다
  const next = watchLifeDue({
    open: async () => coach,
    progress,
    lessons: LESSONS,
    note: (kind, outcome) => notes.push(outcome.code),
    noted,
    timers: fakeTimers(),
  });
  await settle();
  await settle();
  next.judge(progress.exportSnapshot(), at + 2 * MINUTE);
  assert.deepEqual(notes, ['LIFE_BRIDGE_STUCK'], '문서마다 다시 세지 않는다');
  next.dispose();
  watcher.dispose();
  // 기본 장부는 주인마다 · 저장소에 — 같은 주인의 다른 장부가 읽는다
  const storage = memoryStorage();
  stuckBook('acct-1', storage).add('r-1');
  assert.equal(stuckBook('acct-1', storage).has('r-1'), true);
  assert.equal(stuckBook('acct-2', storage).has('r-1'), false, '주인마다 따로');
  assert.equal(stuckBook('acct-1', { getItem: () => '{깨짐', setItem() {} }).has('r-1'), false, '못 읽으면 빈 장부');
});

test('판정 넣기 — 끝자리: 지금 판의 판정은 null(확인 중이 아님) · 묻는 사이 온 알림 뒤 다시 물어도 지금 판이면 한 번 더 묻고 멈춘다 · 아직 복습 안 한 것은 stuck이 아니다 · 다리는 하루가 되는 그 순간 · 앞으로 열릴 것은 6개까지(넘친 #4)', async () => {
  const progress = createLifeProgress({ owner: 'guest', mode: 'local', storage: memoryStorage(), now: () => T0 });
  progress.summary([], LESSONS);
  let asked = 0;
  let notify = null;
  let hold = null;
  const watcher = watchLifeDue({
    open: () => {
      asked += 1;
      return asked === 1 ? new Promise(r => (hold = () => r(null))) : Promise.resolve(null);
    },
    reopened: fn => {
      notify = fn;
      return () => {};
    },
    progress,
    lessons: LESSONS,
    timers: fakeTimers(),
  });
  await settle(); // 코치는 다음 차례에 연다
  notify(); // 확인 중에 온 「판이 풀렸다」
  hold();
  for (let i = 0; i < 6; i += 1) await settle();
  assert.equal(watcher.state(), 'old');
  assert.equal(asked, 2, '한 번 더 묻고 — 또 지금 판이면 멈춘다');
  assert.equal(watcher.judge({ reviews: {} }, T0), null, '지금 판의 판정은 null(셸의 홈 후보 · 알림 입력이 지금 판 갈래로 간다)');
  watcher.dispose();
  // 판정의 끝자리
  const fresh = snapshotOf([{ q: 'a', at: T0 }]);
  const units = unitsFrom({ a: ['ko.life.x'] });
  assert.deepEqual(lifeDue({ snapshot: fresh, unitsOf: units, now: T0 + DAY - 1 }).ids, [], '하루가 되기 전');
  assert.deepEqual(lifeDue({ snapshot: fresh, unitsOf: units, now: T0 + DAY }).ids, ['a-transfer'], '하루가 되는 그 순간 다리');
  assert.deepEqual(lifeDue({ snapshot: fresh, unitsOf: units, now: T0 + 3 * DAY }).stuck, [], '아직 복습 안 한 것은 stuck이 아니다');
  const many = snapshotOf(Array.from({ length: 9 }, (_, i) => ({ q: `m${i}`, at: T0 + i })));
  const out = lifeDue({ snapshot: many, unitsOf: r => [`ko.life.${r.questionId}`], now: T0 + 1000 });
  assert.equal(out.upcoming.length, 6, '「곧 돌아올 표현」은 6개까지');
  assert.equal(out.times.length, 9, '알림의 때는 모두');
});

test('판 겉 × 진짜 엔진 — 문항을 연 채 31분 쉬거나 새벽 4시를 넘긴 뒤 다른 제시가 서도 그 문항의 답이 엔진에 남는다(다시 보이고 잇기 · 직접 연 도움도 다시 — Fable 5.2 합친 끝 판 F4)', async () => {
  const cases = [
    // [이름, 시작 시각, 쉰 시간, 직접 연 도움]
    ['31분 쉼 · 직접 연 해설 뒤 답', T0 + 3 * HOUR, 31 * MINUTE, true],
    ['서울 03:50 → 04:05(새벽 4시)', Date.parse('2026-11-13T18:50:00.000Z'), 15 * MINUTE, false],
  ];
  for (const [label, start, gap, asked] of cases) {
    let now = start;
    const coach = await realCoach(() => now);
    const answers = [];
    const spy = Object.fromEntries(
      Object.entries(coach).map(([name, value]) => [name, typeof value === 'function' ? value.bind(coach) : value]),
    );
    spy.answer = (pid, result) => {
      const out = coach.answer(pid, result);
      answers.push({ pid, out });
      return out;
    };
    const presented = [];
    spy.present = (candidate, context) => {
      const pid = coach.present(candidate, context);
      presented.push(pid);
      return pid;
    };
    const notes = [];
    const mains = LESSONS.flatMap(lesson =>
      lesson.questions
        .filter(question => Array.isArray(question.choices))
        .map(question => ({ lesson, question, item: lifeItem({ lesson, question }) })),
    ).filter(row => lifeAssessable(row.item) && !row.item.confounded && lifeUnits(coach, row.item).length);
    const [a, b] = [mains[0], mains.find(row => lifeUnits(coach, row.item).every(unit => !lifeUnits(coach, mains[0].item).includes(unit)))];
    assert.ok(a && b, `${label}: 단위가 다른 문항 둘`);
    const surface = createLifeNext({
      coach: () => spy,
      snapshot: () => ({ lessons: {}, reviews: {}, daily: { days: {} } }),
      note: (kind, outcome) => notes.push(outcome.code),
    });
    surface.shown('a', a.item);
    if (asked) surface.help('a', 'explanation');
    await settle();
    await settle();
    now += gap;
    surface.shown('b', b.item); // 쉬고 돌아와 다른 문항이 먼저 보인다 — 코치의 기본 판이 새로 열린다
    await settle();
    surface.answer('a', {
      correct: true,
      choiceId: a.question.answerId,
      correctId: a.question.answerId,
      ...(asked ? { helped: true, helpBy: 'user' } : {}),
    });
    await until(() => answers.length === 1);
    await answers[0].out.stored;
    assert.notEqual(answers[0].pid, presented[0], `${label}: 답은 다시 보인 제시에`);
    assert.deepEqual(notes, ['LIFE_REPRESENTED'], `${label}: 다시 보여 이은 수만 계기에(답을 버린 계기 없음)`);
    const [unit] = lifeUnits(coach, a.item);
    const line = lineOf(coach, unit);
    assert.ok(line, `${label}: 그 단위에 기억 줄이 선다`);
    const days = (line.dueAt - line.lastAt) / DAY;
    if (asked) assert.ok(days > 0.2 && days < 0.3, `${label}: 앞 제시에 연 해설이 다시 실려 놓침(6시간) — ${days}일`);
    else assert.ok(days > 1.2 && days < 1.4, `${label}: 혼자 맞힘 — ${days}일`);
    coach.dispose();
  }
});

test('lifeDue ① — 때가 아직인 ①(놓친 답 1분 안)도 그 단위를 센다: 같은 단위의 다른 복습을 ③ 엔진 · ② 다리로 그 사이에 열지 않는다(①로 한 번 — GC3 · Fable F1)', () => {
  const rows = [
    { q: 'a', at: T0, correct: false }, // 방금 놓침 — 단위 x, 1분 뒤 돌아온다
    { q: 'd', at: T0 - 3 * DAY, lastAt: T0 - 2 * DAY }, // 혼자 맞힌 같은 단위 x의 다른 장면 — x가 돌아왔다
    { q: 'b', at: T0 + 10, correct: false }, // 방금 놓침 — 단위 z
    { q: 'f', at: T0 - 2 * DAY }, // 처음인 같은 단위 z(기억 줄 없음) — 다리의 하루가 지났다
  ];
  const units = unitsFrom({ a: ['ko.life.x'], d: ['ko.life.x'], b: ['ko.life.z'], f: ['ko.life.z'] });
  const memory = [{ unit: 'ko.life.x', lastAt: T0 - 2 * DAY, dueAt: T0 - DAY }];
  const due = [{ unit: 'ko.life.x' }];
  const pending = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, due, now: T0 + 30_000 });
  assert.deepEqual(pending.ids, [], '1분 안에는 x · z의 다른 장면을 열지 않는다');
  assert.deepEqual(
    pending.upcoming.map(row => row.id),
    ['a-transfer', 'b-transfer'],
    '놓친 둘이 곧 돌아온다',
  );
  const back = lifeDue({ snapshot: snapshotOf(rows), unitsOf: units, memory, due, now: T0 + 2 * MINUTE });
  assert.deepEqual(back.ids, ['a-transfer', 'b-transfer'], '1분 뒤 — ①로 한 번씩, d · f는 그 단위를 또 세지 않는다');
});
