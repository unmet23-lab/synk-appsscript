// 「맞춤 연습 시작」을 누르면 실제로 무엇이 고르나 — 실제 계획 코드 + 실제 Core로 학습자별로 잰다(읽기 전용, 기록은 메모리에만).
// 화면이 부르는 순서: world-learning-ui.mjs next() → refresh() → planWith() → createWorldLearningPlan() → coach.recommendActivities() → launch(selected)
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const ROOT = process.argv[2];
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const require = createRequire(pathToFileURL(path.join(ROOT, 'package.json')).href);
const {worldLearning} = await imp('experiences/synk-world-app/world-learning-map.mjs');
const createGame = worldLearning.engine.createGame;
const {PACKS, LESSONS} = await imp('experiences/synk-world-app/life-content.mjs');
const {createWorldLearningPlan} = await imp('experiences/synk-world-app/world-learning-plan.mjs');
const {lifeItem, lifeMeasureItem} = await imp('experiences/synk-world-app/life-items.mjs');
const {LISTENING_CHECKS, checkMetadata} = await imp('experiences/korean-runner/listening-check.mjs');
const {RHYTHM_CANDIDATES} = await imp('experiences/korean-rhythm/personalization.mjs');
const {PLAN_ITEMS} = await imp('experiences/subway-rush/plan-items.mjs');
const {decisionMeta} = await imp('experiences/subway-rush/learning.mjs');
const kit = await imp('experiences/synk-world-app/world-position-kit.mjs');
const position = kit.worldPosition || kit.default || kit;
const practiceKit = await imp('experiences/synk-world-app/world-reading-practice.mjs');

// 은행 불러오기: 화면이 topik.load(url)로 받는 실제 파일을 그대로 준다.
const fs = (await import('node:fs')).default;
globalThis.fetch = async url => new Response(fs.readFileSync(path.join(ROOT, 'experiences/synk-world-app', path.basename(String(url)))));
await position.topik.load('world-topik-items.json');
const NOW = Date.parse('2026-11-09T03:00:00.000Z');
const empty = () => ({version: 1, owner: 'synthetic', revision: 0, activeLessonId: null, activeReview: null, lessons: {}, reviews: {}});
const store = () => { const m = new Map(); return {getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v)}; };
const coachNew = () => createGame({gameId: 'world-persona', storage: store(), clock: () => new Date(NOW).toISOString()});
const byId = id => LESSONS.find(l => l.id === id);
const complete = (p, l) => { p.lessons[l.id] = {startedAt: NOW - 90000, completedAt: NOW - 86000, answers: {}, questionIds: l.questions.map(q => q.id)}; };
function answerLesson(coach, id, {help = false, correct = () => true} = {}) {
  byId(id).questions.forEach((q, i) => {
    const item = lifeItem({lesson: byId(id), question: q}); if (!item || item.confounded) return;
    const pid = coach.present(lifeMeasureItem(item)); if (help) coach.help(pid, 'explanation'); coach.answer(pid, {correct: correct(i), assessable: true});
  });
}
function reviewDue(p, l, {at = NOW - 86400000, due = NOW - 1000, correct = false} = {}) {
  const q = l.questions[0], answer = {correct, helped: false, at, choiceId: 'a'};
  p.lessons[l.id] = {startedAt: at - 1000, completedAt: at + 1, answers: {[q.id]: answer}, questionIds: l.questions.map(x => x.id)};
  p.reviews[q.review.id] = {id: q.review.id, questionId: q.id, lessonId: l.id, packId: l.packId, skillId: q.skillId, dueAt: due, lastAt: at, streak: 0, lapses: correct ? 0 : 1, intervalDays: 0};
}
const pool = values => {
  const all = position?.practice?.pool || [];
  return all.filter(item => values?.examType === 'topik2' ? /^ko2\./.test(item.skillId) || !all.some(x => /^ko2\./.test(x.skillId) && x.modality === item.modality) : !/^ko2\./.test(item.skillId));
};
const seenBy = coach => item => { try { return coach.exposure(item).seen; } catch { return null; } };
function plan(coach, {progress = empty(), settings = {}, practice = true}) {
  const summary = coach.summary(), seen = seenBy(coach), now = NOW, audioAvailable = settings.audio !== 'off';
  const recommendActivities = input => coach.recommendActivities(input.candidates, {settings: input.settings, at: input.at});
  const extra = [];
  const list = pool(settings);
  if (practice && summary.evidenceComplete) extra.push(...position.practice.practiceCandidates({pool: list, seen, summary, count: 5}));
  const exam = position.exam.examInfo(settings);
  let diagnostic = null;
  if (exam) { try { diagnostic = position.selectDiagnostic({summary, items: position.items, seen, audioAvailable, exam: settings.examType === 'topik2' ? 'topik2' : 'topik1'}); } catch (e) { console.log('진단 실패', e.message); } }
  if (exam && diagnostic?.status === 'ready') extra.push(position.checkCandidate());
  if (exam) console.log('  (진단', diagnostic?.status, (diagnostic?.items || []).length, '문항 · 시험', exam.type, exam.grade, ')');
  const base = createWorldLearningPlan({now, summary, progress, settings, extra, recommendActivities});
  if (!exam) return base;
  const week = position.exam.examWeek(now);
  const listening = {};
  for (const c of base.candidates || []) { if (c.route !== 'game' || c.modality !== 'listening' || c.available === false) continue; for (const tg of c.targets || []) if (seen({itemKey: tg.itemKey || tg.id, familyKey: tg.familyKeys?.[0]}) === false) for (const id of tg.skillIds || []) { (listening[id] = listening[id] || []); if (!listening[id].includes(c.id)) listening[id].push(c.id); } }
  const examPlan = position.exam.buildExamPlan({exam, summary, now, audioAvailable, classwork: [], lastCheckAt: null, examSkills: position.exam.examEvidenceSkills?.(coach.events?.() || []) ?? null,
    done: position.exam.weekActivity({events: coach.events?.() || [], progress, week, extra: []}),
    available: {practice: position.practice.practiceSupply({pool: list, seen, audioAvailable}), listening, recheck: diagnostic?.items?.length || 0, life: true, writing: [], topik2: {listening: true, reading: true}}});
  return createWorldLearningPlan({now, summary, progress, settings, extra, recommendActivities, examPlan});
}
const show = (name, r) => {
  const s = r.selected;
  console.log(`\n■ ${name}`);
  console.log(`  고름: ${s ? `${s.label} (${s.route}${s.gameId ? ':' + s.gameId : ''}, ${s.minutes}분)` : '없음'} · 근거 ${r.basis || r.status} · ${(r.reasons || []).join(', ')}`);
  console.log(`  이유: ${r.reason}`);
  console.log(`  다음 후보: ${(r.alternatives || []).slice(0, 4).map(a => a.label).join(' / ')}`);
};
const allGamesSeen = coach => {
  const meta = [...LISTENING_CHECKS.map(checkMetadata), ...RHYTHM_CANDIDATES, ...PLAN_ITEMS.map(decisionMeta)];
  let ok = 0, bad = 0;
  for (const t of meta) {
    const skillId = t.skillId || t.skillIds?.[0];
    try {
      const pid = coach.present({id: String(t.id).replace(/[^a-zA-Z0-9_.:-]/g, '_'), itemKey: t.itemKey || t.id, familyKey: t.familyKey || t.familyKeys?.[0] || t.itemKey || t.id, skillId, difficulty: t.difficulty, modality: t.modality, responseFormat: t.responseFormat, audioRequired: true, confounded: false, conceptIds: t.conceptIds || []});
      try { coach.delivery(pid, {audio: 'completed'}); } catch {}
      coach.answer(pid, {correct: true, assessable: true}); ok++;
    } catch { bad++; }
  }
  console.log('  (게임 문항 제시', ok, '건 · 지도 밖', bad, '건)');
};
const doneAll = () => { const p = empty(); for (const l of LESSONS) complete(p, l); return p; };

console.log('연습 은행 문항(공개 은행 + 검수 통과):', (position?.practice?.pool || []).length);
show('① 완전 새 학생 · 목표 안 고름 (실제 화면은 먼저 학습 목표 창을 연다 — next() profile.status new)', plan(coachNew(), {}));
show('② 새 학생 · 여행', plan(coachNew(), {settings: {reasons: ['travel']}}));
show('③ 새 학생 · 사람 사귀기', plan(coachNew(), {settings: {reasons: ['people']}}));
show('④ 새 학생 · 일 · 취업', plan(coachNew(), {settings: {reasons: ['work']}}));
show('⑤ 새 학생 · 시험(TOPIK I · 2급 목표)', plan(coachNew(), {settings: {reasons: ['exam'], primaryReason: 'exam', examType: 'topik1', targetGrade: 2}}));
show('⑥ 새 학생 · 시험(TOPIK II · 4급 목표)', plan(coachNew(), {settings: {reasons: ['exam'], primaryReason: 'exam', examType: 'topik2', targetGrade: 4}}));
{ const c = coachNew(), p = empty(); answerLesson(c, 'greetings-expressions'); complete(p, byId('greetings-expressions')); show('⑦ 레슨 하나 다 맞힘 · 여행 목표', plan(c, {progress: p, settings: {reasons: ['travel']}})); }
{ const c = coachNew(), p = empty(); answerLesson(c, 'greetings-expressions', {correct: i => i !== 0}); reviewDue(p, byId('greetings-expressions')); show('⑧ 레슨에서 하나 틀림 · 복습 돌아옴', plan(c, {progress: p, settings: {reasons: ['travel']}})); }
{ const c = coachNew(); for (let i = 0; i < 3; i++) { const pid = c.present({id: `n${i}`, itemKey: `n${i}`, familyKey: `n${i}`, skillId: 'ko.listening.negation', difficulty: 1, modality: 'listening', responseFormat: 'single-choice', audioRequired: true, confounded: false}); c.delivery(pid, {audio: 'completed'}); c.answer(pid, {correct: false, assessable: true}); } show('⑨ 듣기 부정 표현을 혼자 세 번 틀림 · 여행 목표', plan(c, {settings: {reasons: ['travel']}})); }
{ const c = coachNew(); for (let i = 0; i < 3; i++) { const pid = c.present({id: `g${i}`, itemKey: `g${i}`, familyKey: `g${i}`, skillId: 'ko.reading.detail', difficulty: 1, modality: 'reading', responseFormat: 'single-choice', audioRequired: false, confounded: false}); c.answer(pid, {correct: false, assessable: true}); } show('⑩ 읽기 세부 정보를 혼자 세 번 틀림 · 여행 목표', plan(c, {settings: {reasons: ['travel']}})); }
show('⑪ 레슨 22개 다 마침 · 복습 없음 · 게임 처음', plan(coachNew(), {progress: doneAll(), practice: false}));
{ const c = coachNew(); allGamesSeen(c); show('⑫ 레슨 22개 + 추천 게임 문항까지 다 봄(연습 은행 제외)', plan(c, {progress: doneAll(), practice: false})); }
{ const c = coachNew(); allGamesSeen(c); show('⑬ ⑫와 같은데 연습 은행 포함', plan(c, {progress: doneAll()})); }
show('⑭ 레슨 22개 다 마침 · 소리 끔(연습 은행 제외)', plan(coachNew(), {progress: doneAll(), settings: {audio: 'off'}, practice: false}));
show('⑮ 레슨 22개 다 마침 · 소리 끔(연습 은행 포함 — 화면과 같음)', plan(coachNew(), {progress: doneAll(), settings: {audio: 'off'}}));

// 성향(말해 준 설정)이 고르는 활동을 바꾸는가 — 같은 기록에 설정만 바꾼다.
console.log('\n=== 같은 기록(레슨 하나 다 맞힘)에 설정만 바꿈');
const base = () => { const c = coachNew(), p = empty(); answerLesson(c, 'greetings-expressions'); complete(p, byId('greetings-expressions')); return {c, p}; };
for (const [name, settings] of [['기본', {}], ['도움 한 단계씩', {support: 'step'}], ['도움 혼자', {support: 'independent'}], ['5분', {minutes: 5}], ['2분', {minutes: 2}], ['1분', {minutes: 1}], ['소리 끔', {audio: 'off'}], ['설명 자세히', {explanation: 'detailed'}], ['글자 크게', {textSize: 'large'}], ['여행', {reasons: ['travel']}], ['문화', {reasons: ['culture']}], ['취미', {reasons: ['hobby']}], ['시험', {reasons: ['exam']}]]) {
  const {c, p} = base(); const r = plan(c, {progress: p, settings, practice: false});
  console.log(`  ${name.padEnd(10)} → ${r.selected?.label || '없음'}  [${(r.reasons || []).join(', ')}]  도움:${r.presentation?.support}`);
}
