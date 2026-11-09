// 레슨을 다 마친 학생이 목표마다 무엇을 받나 — 아르곤 지적(한글 만나기로 되돌아감 · 목표를 고른 학생의 이유 문장)을 잰다. 읽기 전용, 기록은 메모리에만.
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const {worldLearning} = await imp('experiences/synk-world-app/world-learning-map.mjs');
const createGame = worldLearning.engine.createGame;
const {LESSONS} = await imp('experiences/synk-world-app/life-content.mjs');
const {createWorldLearningPlan} = await imp('experiences/synk-world-app/world-learning-plan.mjs');
const {LISTENING_CHECKS, checkMetadata} = await imp('experiences/korean-runner/listening-check.mjs');
const {RHYTHM_CANDIDATES} = await imp('experiences/korean-rhythm/personalization.mjs');
const {PLAN_ITEMS} = await imp('experiences/subway-rush/plan-items.mjs');
const {decisionMeta} = await imp('experiences/subway-rush/learning.mjs');
const {worldPosition: position} = await imp('experiences/synk-world-app/world-position-kit.mjs');
globalThis.fetch = async url => new Response(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app', path.basename(String(url)))));
await position.topik.load('world-topik-items.json');
const NOW = Date.parse('2026-11-09T03:00:00.000Z');
const store = () => { const m = new Map(); return {getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v)}; };
const coachNew = () => createGame({gameId: 'world-persona', storage: store(), clock: () => new Date(NOW).toISOString()});
const doneAll = () => { const p = {version: 1, owner: 's', revision: 0, activeLessonId: null, activeReview: null, lessons: {}, reviews: {}, hangul: {answer: 'reads'}}; for (const l of LESSONS) p.lessons[l.id] = {startedAt: NOW - 90000, completedAt: NOW - 86000, answers: {}, questionIds: l.questions.map(q => q.id)}; return p; };
const seeAllGames = coach => {
  for (const t of [...LISTENING_CHECKS.map(checkMetadata), ...RHYTHM_CANDIDATES, ...PLAN_ITEMS.map(decisionMeta)]) {
    const pid = coach.present({id: String(t.id).replace(/[^a-zA-Z0-9_.:-]/g, '_'), itemKey: t.itemKey || t.id, familyKey: t.familyKey || t.familyKeys?.[0] || t.itemKey || t.id, skillId: t.skillId || t.skillIds?.[0], difficulty: t.difficulty, modality: t.modality, responseFormat: t.responseFormat, audioRequired: true, confounded: false, conceptIds: t.conceptIds || []});
    try { coach.delivery(pid, {audio: 'completed'}); } catch {}
    coach.answer(pid, {correct: true, assessable: true});
  }
};
const pool = position.practice.pool.filter(i => !/^ko2\./.test(i.skillId));
function run(name, settings, {games = false, bank = true} = {}) {
  const c = coachNew(); if (games) seeAllGames(c);
  const seen = item => { try { return c.exposure(item).seen; } catch { return null; } };
  const summary = c.summary();
  const extra = bank ? position.practice.practiceCandidates({pool, seen, summary, count: 5}) : [];
  const r = createWorldLearningPlan({now: NOW, summary, progress: doneAll(), settings, extra, recommendActivities: i => c.recommendActivities(i.candidates, {settings: i.settings, at: i.at})});
  console.log(`${name.padEnd(30)} → ${r.selected?.label || '없음'} | ${r.reason}`);
}
console.log('=== 레슨 22개 다 마침 · 한글 읽음 · 게임 처음 · 연습 은행 있음');
for (const reason of ['travel', 'people', 'life', 'culture', 'hobby', 'study', 'work', 'career', 'other']) run(reason, {reasons: [reason]});
run('목표 없음', {});
console.log('\n=== 같은 학생 + 추천 게임 문항까지 다 봄');
for (const reason of ['travel', 'people', 'life', 'culture', 'hobby', 'study', 'work', 'other']) run(reason, {reasons: [reason]}, {games: true});
run('목표 없음', {}, {games: true});
