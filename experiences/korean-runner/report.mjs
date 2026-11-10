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

/* 다음 달리기 안내: 달리기 칸(action)은 늘 평가하지 않음이라 비어 있다. 엔진의 「아직 기록이 적어요」를 그대로 쓰면 듣기 확인을 다 맞힌 사람에게도
 * 듣기 자체의 기록이 적다고 말하게 되므로, 입구는 달리는 방식으로 범위를 좁혀 말한다. 해낸 일은 Core가 독립 응답으로 인정한 듣기 확인 칸의 근거만 읽는다.
 * 엔진도 11-10(정책판 5)부터 다른 응답 꼴 기록이 있는 처음 칸을 「다른 방식으로 확인해 봐요」로 말한다 — 이 입구는 달리는 방식으로 좁힌 제품 글이라 그대로 둔다. */
const CHECK_FAMILY = 'korean-runner.listening-check.';
const DONE_WHAT = Object.freeze({
  'ko.listening.detail': '방향이나 동작을 말하는 문제',
  'ko.listening.negation': '하지 말라거나 하지 않아도 된다는 문제',
  'ko.listening.sequence': '두 동작의 순서를 말하는 문제',
});
const DONE_MIN = 4;   // Core의 안정 판정(learning.js POLICY.sample)과 같은 수. 칸은 서로 다른 계열을 한 번씩만 센다.
export const RUN_NEXT = '이제 달리면서 동작으로 답해 봐요.';
export const RUN_SCOPE = '달리기는 달리면서 동작으로 답하는 연습이에요. 장면을 보고도 할 수 있어서 듣기 기록은 ‘듣기 확인’에만 남아요.';

/**
 * 이 게임의 듣기 확인에서 처음 듣고 도움 없이 맞힌 근거가 충분한 능력 하나. 없으면 null.
 * 칸의 상태는 여러 게임이 나눠 쓰므로 근거마다 출처를 확인해 이 게임의 듣기 확인만 센다. 출처를 잇지 못하는 근거(접힌 기록 등)는 세지 않는다.
 */
export function doneChecks(coach, prefer = null) {
  try {
    if (!coach || coach.assignment?.()) return null;
    const summary = coach.summary();
    if (summary?.storage?.available !== true || summary.evidenceComplete !== true) return null;
    const events = coach.events(), byId = new Map(events.map((event, index) => [event.id, { event, index }])), found = [];
    for (const skill of summary.skills || []) {
      if (!DONE_WHAT[skill.id]) continue;
      for (const level of Object.values(skill.levels || {})) {
        const cell = level.formats?.[CHECK_FORMAT];
        if (cell?.status !== 'recent-independent') continue;
        const own = (cell.evidence || []).map((id) => byId.get(id)).filter(({ event } = {}) => {
          const shown = byId.get(event?.presentationId)?.event, decision = byId.get(shown?.decisionId)?.event;
          return event?.type === 'practice.attempted' && ['correct', 'incorrect'].includes(event.verdict) && shown?.type === 'practice.presented'
            && decision?.type === 'decision.made' && decision.experienceId === 'korean-runner' && String(shown.measure?.familyKey).startsWith(CHECK_FAMILY);
        });
        if (own.length >= DONE_MIN && own.every(({ event }) => event.verdict === 'correct')) found.push({ skillId: skill.id, count: own.length, last: Math.max(...own.map((row) => row.index)) });
      }
    }
    return found.find((row) => row.skillId === prefer) || found.sort((a, b) => b.last - a.last)[0] || null;
  } catch { return null; }
}

/** 다음 달리기의 빈 칸을 말하는 엔진 이유 대신 쓸 말. 엔진이 다른 까닭을 말할 때(도움으로 해냄 등)는 null이고 그 말을 그대로 쓴다. */
export function runReason(coach, plan) {
  if (plan?.state !== 'unseen' || plan.responseFormat !== 'action') return null;
  const done = doneChecks(coach, plan.focusSkillId);
  return done ? `듣기 확인에서 ${DONE_WHAT[done.skillId]} ${done.count}개를 처음 듣고 도움 없이 맞혔어요. ${RUN_NEXT}` : RUN_SCOPE;
}
