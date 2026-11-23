// 대조 장치의 「시험 목표 1급 · 3급」 계정 상태: 계정 서버의 놀이 기록(synk-play records)에 든 생활 진도 값을 master 코드로 만든다.
// 첫 실행 걸음(화면 언어 · 한글 · 튜터)은 이미 지난 학생으로 둔다. 만든 값은 master 읽개로 다시 읽어 본다.
import fs from 'node:fs';
const W = 'D:/SYNK-worktrees/SYNK-appsscript/goofy-rosalind-2b88f5/experiences/synk-world-app/';
const { updateWorldLearningProfile } = await import('file:///' + W + 'world-learning-profile.mjs');
const { createLifeProgress, LIFE_PROGRESS_KEY } = await import('file:///' + W + 'life-progress.mjs');
const A = '11111111-1111-4111-8111-111111111111';
const BASE = Date.parse('2026-11-21T10:00:00+09:00');
const at = BASE - 2 * 86400000;
function record(examType, targetGrade) {
  const learningProfile = updateWorldLearningProfile(undefined, { owner: A, at, values: { reasons: ['exam'], primaryReason: 'exam', examType, targetGrade }, consent: true, expectedRevision: 0 });
  const value = { version: 1, owner: A, revision: 4, activeLessonId: null, activeReview: null, lessons: {}, reviews: {}, display: { version: 1, language: 'ko' }, hangul: { version: 1, answer: 'reads', at, via: 'question' }, tutor: { version: 1, selected: 'mongle' }, learningProfile };
  const raw = JSON.stringify(value);
  const store = new Map([[LIFE_PROGRESS_KEY, raw]]);
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  const progress = createLifeProgress({ storage, owner: A, mode: 'account', now: () => BASE });
  const status = progress.status();
  if (status.phase === 'unreadable') throw Error('master가 읽지 못함 ' + examType + targetGrade + ' ' + status.code);
  const values = progress.learningProfileValues?.();
  return { raw, check: { phase: status.phase, values } };
}
const one = record('topik1', 1), three = record('topik2', 3);
console.log(JSON.stringify(one.check).slice(0, 400));
console.log(JSON.stringify(three.check).slice(0, 400));
fs.writeFileSync(process.argv[2], JSON.stringify({ 'login-exam1': { [LIFE_PROGRESS_KEY]: one.raw }, 'login-exam3': { [LIFE_PROGRESS_KEY]: three.raw } }, null, 1));
console.log('wrote', process.argv[2]);
