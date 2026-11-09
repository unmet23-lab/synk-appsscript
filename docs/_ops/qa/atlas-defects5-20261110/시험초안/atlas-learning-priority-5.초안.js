'use strict';
// 초안: tests/atlas-learning-priority-5.test.js로 옮겨 그 자리에서 돈다(require 경로가 tests/ 기준이라 이 자리에서는 돌지 않는다).
// Core 추천 정책판 5(2026-11-10 — Fable 5.2 검수 결함 3 · 4 · 5, docs/_ops/qa/atlas-defects5-20261110/설계.md §3).
// 칸 상태(측정)는 그대로이고, 고르는 순서와 이유 한 줄만 바뀐다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../atlas/game-learning');
const Learning = require('../atlas/learning');
const { createMap } = require('../strata');
const map = createMap(require('../strata/topik-i').topikMap());
const MINUTE = 60000, DAY = 86400000;
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
const clockAt = iso => { let t = Date.parse(iso); const c = () => new Date(t).toISOString(); c.advance = ms => { t += ms; }; c.set = value => { t = Date.parse(value); }; return c; };
const item = (skillId, difficulty, i, { format = 'single-choice', modality = skillId.split('.')[1] } = {}) => ({ id: `${skillId}.d${difficulty}.${format}.${i}`, itemKey: `${skillId}.d${difficulty}.${format}.${i}`,
  familyKey: `${skillId}.d${difficulty}.${format}.${i}`, skillId, skillIds: [skillId], modality, difficulty, responseFormat: format, audioRequired: false });
const play = (coach, it, correct) => coach.answer(coach.present(it), { correct, assessable: true });

test('정책판 5', () => { assert.equal(Learning.POLICY.version, 'learning-priority-5'); });

test('작은 칸에서 두 번 틀린 뒤: 새 첫 시도가 남아 있는 동안 본 문항은 놓친 것의 한 번 다시만 고르고, 은행을 다 쓰면 고르게 돈다', () => {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = createGame({ gameId: 'small', map, storage: memory(), clock });
  const skill = 'ko.listening.negation';
  const cell = Array.from({ length: 6 }, (_, i) => item(skill, 2, i, { format: 'cup-compose' }));
  const others = ['ko.listening.detail', 'ko.listening.condition'].flatMap(s => Array.from({ length: 6 }, (_, i) => item(s, 1, i)));
  const all = [...cell, ...others], shown = new Map(), missed = new Set([cell[0].familyKey, cell[1].familyKey]);
  const record = it => shown.set(it.familyKey, (shown.get(it.familyKey) || 0) + 1);
  for (const [i, correct] of [[0, false], [1, false], [2, true]]) { play(coach, cell[i], correct); record(cell[i]); clock.advance(20000); }
  let inCell = 0, retries = 0, maxSpread = 0;
  for (let step = 0; step < 40; step += 1) {
    const r = coach.recommend(all, { audioAvailable: true }), it = r.selected, before = shown.get(it.familyKey) || 0;
    const freshLeft = all.some(x => !shown.has(x.familyKey));
    if (freshLeft && before) { assert.ok(missed.has(it.familyKey) && before === 1, `${step}: 새 문항이 남았는데 ${it.id}(${before}번 본 문항)`); retries += 1; assert.match(r.reason, /놓친 문제를 한 번 더/); }
    if (!freshLeft) { const counts = all.map(x => shown.get(x.familyKey) || 0); maxSpread = Math.max(maxSpread, Math.max(...counts) - Math.min(...counts)); }
    if (it.skillId === skill) inCell += 1;
    play(coach, it, true); record(it); clock.advance(20000);
  }
  assert.equal(retries, 2, '놓친 두 계열이 한 번씩 다시 나온다');
  assert.ok(inCell <= 16, `그 칸 ${inCell}번(고치기 전 38번)`);
  assert.ok(maxSpread <= 2, `은행을 다 쓴 뒤 제시 횟수 차이 ${maxSpread}`);
  // 측정은 그대로: 30일 안 처음 시도 6개 중 2개를 놓친 칸.
  const state = coach.summary().skills.find(s => s.id === skill).levels[2].formats['cup-compose'];
  assert.equal(state.status, 'practice'); assert.equal(state.n, 6); assert.equal(state.incorrect, 2);
});

test('처음 시도를 놓친 계열은 1분이 지나야, 한 번만, 같은 칸 새 문항보다 먼저 다시 나온다', () => {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = createGame({ gameId: 'retry', map, storage: memory(), clock });
  const skill = 'ko.reading.vocabulary', words = Array.from({ length: 5 }, (_, i) => item(skill, 1, i));
  play(coach, words[0], false); clock.advance(10000);
  let r = coach.recommend(words, { audioAvailable: true });
  assert.notEqual(r.selected.id, words[0].id, '1분 안에는 다시 내지 않는다');
  clock.advance(MINUTE);
  r = coach.recommend(words, { audioAvailable: true });
  assert.equal(r.selected.id, words[0].id); assert.equal(r.reason, '「낱말 뜻 읽기」에서 놓친 문제를 한 번 더 풀어 봐요.');
  assert.equal(r.state, 'checking', '칸 상태는 측정 그대로');
  play(coach, words[0], true); clock.advance(5 * MINUTE);
  for (let i = 1; i < 5; i += 1) { r = coach.recommend(words, { audioAvailable: true }); assert.notEqual(r.selected.id, words[0].id, '두 번째 다시는 없다'); play(coach, r.selected, true); clock.advance(MINUTE); }
  // 다시 푼 맞힘은 근거가 아니다: 놓친 처음 시도가 그대로 남는다.
  const cell = coach.summary().skills.find(s => s.id === skill).levels[1].formats['single-choice'];
  assert.equal(cell.incorrect, 1); assert.deepEqual(cell.missed, [words[0].familyKey]);
});

test('1분이 안 된 한 번 다시는 다른 칸의 새 문항이 점수가 낮아도, 나머지가 모두 다 봄이어도 기다린다 — 기회를 일찍 쓰지 않는다', () => {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = createGame({ gameId: 'wait', map, storage: memory(), clock });
  const easy = Array.from({ length: 6 }, (_, i) => item('ko.reading.detail', 1, i));
  for (const it of easy.slice(0, 4)) { play(coach, it, true); clock.advance(5000); } // 혼자 해냄 칸(우선도 .15)
  const word = item('ko.reading.vocabulary', 1, 0);
  play(coach, word, false); clock.advance(10000);
  assert.notEqual(coach.recommend([word, ...easy.slice(4)], { audioAvailable: true }).selected.id, word.id, '쉬운 칸의 새 문항이 남아 있으면 그것부터');
  const harder = item('ko.reading.vocabulary', 2, 0); // 아래 단계가 혼자 해냄이 아니라 −0.25를 받는 새 문항(설계 검수 GPT GA2)
  assert.equal(coach.recommend([word, harder], { audioAvailable: true }).selected.id, harder.id, '감점 받은 새 문항도 1분 안의 다시보다 먼저');
  assert.notEqual(coach.recommend([word, ...easy.slice(0, 4)], { audioAvailable: true }).selected.id, word.id, '나머지가 모두 다 봄이어도 1분 안에는 기다린다');
  assert.equal(coach.recommend([word], { audioAvailable: true }).selected.id, word.id, '혼자 남으면 낸다');
  clock.advance(MINUTE);
  const r = coach.recommend([word, ...easy.slice(0, 4)], { audioAvailable: true });
  assert.equal(r.selected.id, word.id); assert.equal(r.reason, '「낱말 뜻 읽기」에서 놓친 문제를 한 번 더 풀어 봐요.');
});

test('하루 쉬고 와도 어제 마지막에 놓친 문항은 「방금 본」 문항이 아니다', () => {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = createGame({ gameId: 'retry-day', map, storage: memory(), clock });
  const words = Array.from({ length: 6 }, (_, i) => item('ko.reading.vocabulary', 1, i));
  for (let i = 0; i < 3; i += 1) { play(coach, words[i], i !== 2); clock.advance(20000); } // 마지막 문항(2)을 놓침
  clock.advance(DAY);
  assert.equal(coach.recommend(words, { audioAvailable: true }).selected.id, words[2].id);
});

test('다 쓴 복습 칸은 새 문항이 남은 칸을 앞지르지 않는다', () => {
  const clock = clockAt('2026-11-01T09:00:00.000Z'), coach = createGame({ gameId: 'stale', map, storage: memory(), clock });
  const done = Array.from({ length: 4 }, (_, i) => item('ko.reading.detail', 1, i)), fresh = Array.from({ length: 12 }, (_, i) => item('ko.reading.reason', 1, i));
  for (const it of done) { play(coach, it, true); clock.advance(20000); }
  clock.advance(8 * DAY);
  const picks = [];
  for (let i = 0; i < 12; i += 1) { const r = coach.recommend([...done, ...fresh], { audioAvailable: true }); picks.push(r.selected.skillId); play(coach, r.selected, true); clock.advance(20000); }
  assert.deepEqual([...new Set(picks)], ['ko.reading.reason']);
  assert.equal(coach.summary().skills.find(s => s.id === 'ko.reading.detail').levels[1].formats['single-choice'].status, 'review', '복습 상태는 측정 그대로');
});

test('처음 칸의 이유: 앞 단계를 해냈으면 한 단계 올림, 다른 응답 꼴로 했으면 다른 방식, 기록이 없으면 지금 문장', () => {
  const map2 = map, skill = 'ko.listening.detail', now = '2026-11-10T03:00:00.000Z', day = n => new Date(Date.parse(now) - n * DAY).toISOString();
  const attempts = [1, 2, 3, 4].map(i => ({ eventId: `e${i}`, at: day(i), independent: true, assisted: false, verdict: 'correct', conceptIds: [],
    measure: { skillId: skill, difficulty: 1, responseFormat: 'single-choice', familyKey: `fam${i}` } }));
  const profile = Learning.summarizeLearning({ summary: { asOf: now, attempts }, map: map2 });
  const cand = (id, difficulty, responseFormat) => ({ id, skillIds: [skill], difficulty, modality: 'listening', responseFormat, itemKey: id, familyKey: id });
  let r = Learning.recommend({ profile, candidates: [cand('new-d2', 2, 'single-choice')] });
  assert.equal(r.state, 'unseen'); assert.equal(r.reason, '「듣고 세부 정보 찾기」 앞 단계를 최근 혼자 해냈어요. 한 단계 올려 봐요.');
  r = Learning.recommend({ profile, candidates: [cand('new-action', 1, 'action')] });
  assert.equal(r.state, 'unseen'); assert.equal(r.reason, '「듣고 세부 정보 찾기」를 다른 방식으로 확인해 봐요.');
  // 활동 추천은 이유 코드를 그대로 두고 문장만 바꾼다(WORLD 계획이 코드로 레슨 · 숙제 문장을 고른다).
  const act = Learning.recommendActivities({ profile, at: now, settings: {}, candidates: [{ id: 'game.x', minutes: 3, targets: [cand('t1', 1, 'action')] }] });
  assert.deepEqual(act.reasons, ['practice.unseen']); assert.equal(act.reason, '「듣고 세부 정보 찾기」를 다른 방식으로 확인해 봐요.');
  // 그 능력의 기록이 하나도 없으면 지금 문장 그대로.
  const empty = Learning.summarizeLearning({ summary: { asOf: now, attempts: [] }, map: map2 });
  assert.equal(Learning.recommend({ profile: empty, candidates: [cand('first', 1, 'single-choice')] }).reason, '「듣고 세부 정보 찾기」는 아직 기록이 적어요. 짧게 확인해 봐요.');
  assert.equal(Learning.recommendActivities({ profile: empty, at: now, settings: {}, candidates: [{ id: 'game.y', minutes: 3, targets: [cand('t2', 1, 'action')] }] }).reason,
    '아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.');
});

test('복수 계열 활동: 다 본 단일 대상만 남은 활동은 급한 칸이어도 다 쓴 활동이다', () => {
  const now = '2026-11-10T03:00:00.000Z', skill = 'ko.reading.detail', day = n => new Date(Date.parse(now) - n * DAY).toISOString();
  const attempts = [1, 2, 3].map(i => ({ eventId: `m${i}`, at: day(i), independent: true, assisted: false, verdict: i < 3 ? 'incorrect' : 'correct', conceptIds: [],
    measure: { skillId: skill, difficulty: 1, responseFormat: 'single-choice', familyKey: `seen${i}` } }));
  const profile = Learning.summarizeLearning({ summary: { asOf: now, attempts }, map });
  const target = key => ({ id: key, skillIds: [skill], difficulty: 1, modality: 'reading', responseFormat: 'single-choice', itemKey: key, familyKey: key });
  const presentations = [1, 2, 3].map(i => ({ eventId: `p${i}`, at: day(i), taskId: `seen${i}`, itemKey: `seen${i}`, measure: { familyKey: `seen${i}` } }));
  const act = Learning.recommendActivities({ profile, at: now, settings: {}, presentations, candidates: [
    { id: 'game.spent', minutes: 3, targets: [target('seen3')] }, { id: 'game.fresh', minutes: 5, targets: [target('new1')] }] });
  assert.equal(act.selected.id, 'game.fresh');
  assert.ok(act.assessments.find(row => row.id === 'game.spent').reasons.includes('practice.spent'));
});

test('한 번 다시 대상의 활동 이유 코드는 칸 상태 그대로다 — practice.unseen이 아니라 WORLD 레슨 문장 분기에 들지 않는다', () => {
  const now = '2026-11-10T03:00:00.000Z', skill = 'ko.reading.vocabulary', day = n => new Date(Date.parse(now) - n * DAY).toISOString();
  const attempts = [{ eventId: 'm1', at: day(1), independent: true, assisted: false, verdict: 'incorrect', conceptIds: [],
    measure: { skillId: skill, difficulty: 1, responseFormat: 'single-choice', familyKey: 'w1' } }];
  const profile = Learning.summarizeLearning({ summary: { asOf: now, attempts }, map });
  const target = key => ({ id: key, skillIds: [skill], difficulty: 1, modality: 'reading', responseFormat: 'single-choice', itemKey: key, familyKey: key });
  const presentations = [{ eventId: 'p1', at: day(1), taskId: 'w1', itemKey: 'w1', measure: { familyKey: 'w1' } }];
  const act = Learning.recommendActivities({ profile, at: now, settings: {}, presentations, candidates: [{ id: 'lesson.next', minutes: 5, targets: [target('w1')] }] });
  assert.deepEqual(act.reasons, ['practice.checking']); assert.equal(act.reason, '「낱말 뜻 읽기」에서 놓친 문제를 한 번 더 풀어 봐요.');
});
