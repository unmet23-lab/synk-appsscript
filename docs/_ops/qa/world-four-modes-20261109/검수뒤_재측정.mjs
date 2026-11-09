// 아르곤 · Fable 지적 뒤 다시 잰 것 — ① 레슨 22개를 실제로 답한 기록(거울 코치)으로 ② 화면에 있는 시간 3 · 5 · 10분 ③ 손님 ④ 이유 문장 세 언어. 읽기 전용, 기록은 메모리에만.
// 알아 둘 차이: 진도의 answers를 비워 두어 복습 줄에 호스트 사실(activity.retry)이 안 붙는다 — 화면에서는 붙는다. 고른 활동과 이유 문장은 같다. 시험 목표 흐름(진단 · 이번 주 계획)은 학습자별추천.mjs가 잰다.
import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const require = createRequire(pathToFileURL(path.join(ROOT, 'package.json')).href);
const {worldLearning} = await imp('experiences/synk-world-app/world-learning-map.mjs');
const createGame = worldLearning.engine.createGame;
const {recommendActivities} = require(path.join(ROOT, 'atlas/game-browser.js'));
const {LESSONS} = await imp('experiences/synk-world-app/life-content.mjs');
const {createWorldLearningPlan} = await imp('experiences/synk-world-app/world-learning-plan.mjs');
const {lifeItem, lifeMeasureItem} = await imp('experiences/synk-world-app/life-items.mjs');
const {LISTENING_CHECKS, checkMetadata} = await imp('experiences/korean-runner/listening-check.mjs');
const {RHYTHM_CANDIDATES} = await imp('experiences/korean-rhythm/personalization.mjs');
const {PLAN_ITEMS} = await imp('experiences/subway-rush/plan-items.mjs');
const {decisionMeta} = await imp('experiences/subway-rush/learning.mjs');
const {worldPosition: position} = await imp('experiences/synk-world-app/world-position-kit.mjs');
const {tMessage} = await imp('experiences/brand-opening/world-lang.mjs');
globalThis.fetch = async url => new Response(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app', path.basename(String(url)))));
await position.topik.load('world-topik-items.json');
const NOW = Date.parse('2026-11-09T03:00:00.000Z');
const store = () => { const m = new Map(); return {getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v)}; };
const coachNew = () => createGame({gameId: 'world-persona', storage: store(), clock: () => new Date(NOW).toISOString()});
const empty = () => ({version: 1, owner: 's', revision: 0, activeLessonId: null, activeReview: null, lessons: {}, reviews: {}, hangul: {answer: 'reads'}});
const pool = position.practice.pool.filter(i => !/^ko2\./.test(i.skillId));
const reasons = new Set();
function fill(coach, progress, {wrongEvery = 0, due = false} = {}) {
  let n = 0;
  for (const l of LESSONS) {
    progress.lessons[l.id] = {startedAt: NOW - 90000, completedAt: NOW - 86000, answers: {}, questionIds: l.questions.map(q => q.id)};
    for (const q of l.questions) {
      const it = lifeItem({lesson: l, question: q}); if (!it || it.confounded) continue;
      const wrong = wrongEvery > 0 && ++n % wrongEvery === 0;
      const pid = coach.present(lifeMeasureItem(it)); coach.answer(pid, {correct: !wrong, assessable: true});
      if (wrong && due) progress.reviews[q.review.id] = {id: q.review.id, questionId: q.id, lessonId: l.id, packId: l.packId, skillId: q.skillId, dueAt: NOW - 1000, lastAt: NOW - 86400000, streak: 0, lapses: 1, intervalDays: 0};
    }
  }
}
const seeGames = coach => { for (const t of [...LISTENING_CHECKS.map(checkMetadata), ...RHYTHM_CANDIDATES, ...PLAN_ITEMS.map(decisionMeta)]) { const pid = coach.present({id: String(t.id).replace(/[^a-zA-Z0-9_.:-]/g, '_'), itemKey: t.itemKey || t.id, familyKey: t.familyKey || t.familyKeys?.[0] || t.itemKey || t.id, skillId: t.skillId || t.skillIds?.[0], difficulty: t.difficulty, modality: t.modality, responseFormat: t.responseFormat, audioRequired: true, confounded: false, conceptIds: t.conceptIds || []}); try { coach.delivery(pid, {audio: 'completed'}); } catch {} coach.answer(pid, {correct: true, assessable: true}); } };
function run(name, settings, {wrongEvery = 0, due = false, games = false, audio = true} = {}) {
  const c = coachNew(), p = empty(); fill(c, p, {wrongEvery, due}); if (games) seeGames(c);
  const seen = item => { try { return c.exposure(item).seen; } catch { return null; } };
  const summary = c.summary();
  const extra = position.practice.practiceCandidates({pool, seen, summary, count: 5});
  const r = createWorldLearningPlan({now: NOW, summary, progress: p, settings, extra, recommendActivities: i => c.recommendActivities(i.candidates, {settings: i.settings, at: i.at})});
  reasons.add(r.reason);
  console.log(`  ${name.padEnd(12)} → ${(r.selected?.label || '없음').slice(0, 34).padEnd(34)} | ${(r.reasons || []).join(',').slice(0, 42).padEnd(42)} | ${r.reason}`);
}
const goals = [['목표 없음', {}], ['여행', {reasons: ['travel']}], ['사람', {reasons: ['people']}], ['일', {reasons: ['work']}], ['문화', {reasons: ['culture']}], ['취미', {reasons: ['hobby']}]];
console.log('\n① 레슨 22개를 실제로 답함(다 맞힘) · 게임 처음 · 연습 은행 있음'); for (const [n, s] of goals) run(n, s);
console.log('\n② 같은 학생 + 추천 게임 문항까지 다 봄'); for (const [n, s] of goals) run(n, s, {games: true});
console.log('\n③ 레슨 22개, 셋 중 하나 틀림 · 복습은 아직 안 옴'); for (const [n, s] of goals) run(n, s, {wrongEvery: 3});
console.log('\n④ 레슨 22개, 셋 중 하나 틀림 · 복습 돌아옴'); for (const [n, s] of goals.slice(0, 3)) run(n, s, {wrongEvery: 3, due: true});
console.log('\n⑤ 소리 끔 · 레슨 22개 답함 · 추천 게임 안 봄'); for (const [n, s] of goals.slice(0, 3)) run(n, {...s, audio: 'off'});

console.log('\n⑥ 화면의 시간 선택(3 · 5 · 10분) — 레슨 하나 다 맞힌 기록 · 목표 없음');
for (const m of [3, 5, 10]) {
  const c = coachNew(), p = empty(), l = LESSONS[0]; p.lessons[l.id] = {startedAt: NOW - 90000, completedAt: NOW - 86000, answers: {}, questionIds: l.questions.map(q => q.id)};
  const r = createWorldLearningPlan({now: NOW, summary: c.summary(), progress: p, settings: {minutes: m}, recommendActivities: i => c.recommendActivities(i.candidates, {settings: i.settings, at: i.at})});
  console.log(`  ${m}분 → ${r.selected?.label} · 후보 ${1 + (r.alternatives || []).length}개 · 뺀 것 ${(r.excluded || []).map(x => x.id).join(',') || '없음'}`);
}

console.log('\n⑦ 손님(로그인 전) — 기기 코치 · 화면과 같은 openGames');
for (const [name, openGames, settings, lessonsDone] of [['처음 · 체험 남음', ['hangul', 'runner', 'rhythm'], {}, 0], ['처음 · 여행', ['hangul', 'runner', 'rhythm'], {reasons: ['travel']}, 0], ['체험 다 씀', ['hangul'], {}, 0], ['레슨 22개 마침 · 체험 다 씀', ['hangul'], {}, 22]]) {
  const p = empty(); for (const l of LESSONS.slice(0, lessonsDone)) p.lessons[l.id] = {startedAt: NOW - 90000, completedAt: NOW - 86000, answers: {}, questionIds: l.questions.map(q => q.id)};
  const c = coachNew();   // 손님도 기기 코치가 있다(world-learning-ui.mjs 81행). openGames는 app-shell.mjs 366행과 같다.
  const seen = item => { try { return c.exposure(item).seen; } catch { return null; } };
  const summary = c.summary(), extra = position.practice.practiceCandidates({pool, seen, summary, count: 5});
  const r = createWorldLearningPlan({now: NOW, summary, progress: p, settings, extra, openGames, recommendActivities: i => c.recommendActivities(i.candidates, {settings: i.settings, at: i.at})});
  reasons.add(r.reason);
  console.log(`  ${name.padEnd(26)} → ${(r.selected?.label || '없음').padEnd(28)} | ${r.reason}`);
}

console.log('\n⑧ 이유 문장이 화면 언어로 바뀌나(tMessage)');
const more = ['복습할 시간이 된 내용이 있어요. 짧게 다시 만나 봐요.', '아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.', '직접 고른 목표와 이어지는 활동이에요. 짧게 시작해 봐요.', '최근 놓친 「듣고 부정·변경 이해하기」를 조금 더 연습해 봐요. 고른 목표와 이어지는 활동이에요.', '생활 팩의 다음 레슨이에요. 아직 기록이 없는 표현을 새로 만나요.', '시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.', '최근 놓친 「읽고 세부 정보 찾기」를 조금 더 연습해 봐요.']; // 11-10부터 엔진이 항목 이름을 낫표로 묶는다
for (const text of new Set([...reasons, ...more])) {
  if (typeof text !== 'string') continue;
  const en = tMessage(text, 'en'), mn = tMessage(text, 'mn');
  console.log(`  ${/[가-힣]/.test(en) ? '영어 없음 ✗' : '영어 ✓'} · ${/[가-힣]/.test(mn) ? '몽골어 없음 ✗' : '몽골어 ✓'} | ${text.slice(0, 44)} → ${en.slice(0, 70)}`);
}
