// 바람길 결과 화면의 숫자와 학습 항목(순수 함수 — report.test.mjs).
// 달리기의 동작은 장면을 보고도 할 수 있어 듣기 실력 근거가 아니다(learning.mjs actionEvidence: 늘 평가하지 않음).
// 그래서 ‘듣기 능력 기록’ 줄은 아틀라스 공통 기록 가운데 듣기 확인(보기 하나 고르기)의 응답만 읽고, 이번 달리기 숫자는 따로 보여 준다.
import { instructionMetadata } from './learning.mjs';

export const SKILL_LABEL = Object.freeze({
  'ko.listening.detail': '방향·동작 듣기',
  'ko.listening.negation': '하지 말라는 말',
  'ko.listening.sequence': '두 동작의 순서',
});
export const CHECK_FORMAT = 'single-choice';
// 듣기 확인 문항의 난도(listening-check.mjs checkMetadata = instructionMetadata): 한 동작 1, 두 동작 2
const LEVELS = Object.freeze({ 'ko.listening.detail': [1], 'ko.listening.negation': [1], 'ko.listening.sequence': [2] });
export const STEP_WORD = Object.freeze({ done: '해냄', timing: '타이밍 놓침', different: '다른 동작', missed: '안 함' });

export const skillOf = (item) => instructionMetadata(item).skillId;

/**
 * 한 번 달린 결과. answers는 core.mjs의 부탁 기록(지난 부탁 순서). 별은 말 랠리와 같은 규칙(다 해내면 3, 둘까지 놓치면 2, 절반이면 1),
 * 90초를 끝까지 달리지 못했으면(부딪혀 멈춤) 별은 하나까지다.
 */
export function scoreRun(answers, { completed = false } = {}) {
  const total = answers.length, correct = answers.filter((a) => a.correct).length;
  let stars = total && correct === total ? 3 : total > 2 && correct >= total - 2 ? 2 : total && correct >= Math.ceil(total / 2) ? 1 : 0;
  if (!completed) stars = Math.min(stars, 1);
  const bySkill = Object.fromEntries(Object.keys(SKILL_LABEL).map((id) => [id, { heard: 0, done: 0 }]));
  for (const a of answers) {
    const id = skillOf(a);
    if (!bySkill[id]) continue;
    bySkill[id].heard += 1; if (a.correct) bySkill[id].done += 1;
  }
  return { total, correct, missed: total - correct, stars, bySkill, texted: answers.filter((a) => a.texted).length,
    timing: answers.flatMap((a) => a.steps).filter((s) => s.status === 'timing').length };
}

const STATUS = {
  unseen: { text: '혼자 답한 듣기 확인 기록이 아직 없어요', tone: 'quiet' },
  checking: { text: '확인하는 중이에요', tone: 'quiet' },
  practice: { text: '조금 더 연습하면 좋아요', tone: 'focus' },
  supported: { text: '도움을 받아 해냈어요', tone: 'quiet' },
  'recent-independent': { text: '최근 혼자 해냈어요', tone: 'good' },
  review: { text: '다시 볼 때예요', tone: 'focus' },
};

/** 공통 기록 요약(coach.summary())에서 세 듣기 항목의 상태 — 듣기 확인의 ‘보기 하나 고르기’ 응답만 본다. */
export function skillReport(summary) {
  if (!summary?.skills) return [];
  return Object.keys(SKILL_LABEL).map((id) => {
    const s = summary.skills.find((x) => x.id === id);
    const levels = LEVELS[id].map((d) => s?.levels?.[d]?.formats?.[CHECK_FORMAT]).filter(Boolean);
    const f = levels.find((x) => x.lastAt || x.assisted || x.n);
    const status = f && STATUS[f.status] ? f.status : 'unseen';
    return { id, label: SKILL_LABEL[id], status, text: STATUS[status].text, tone: STATUS[status].tone, n: f?.n || 0, correct: f?.correct || 0 };
  });
}
