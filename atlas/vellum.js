'use strict';
// SYNK Vellum: when help opens and how much. The words come from the approved
// material; nothing here changes a question, its answers or its grading.
const SUPPORTS = ['choose', 'step', 'independent'];
const VERDICTS = ['correct', 'incorrect', 'unassessed', 'skipped'];
// Default meaning of "stuck" (Atlas design §8-5): a long pause or two misses at the
// same spot. Each game passes its own values; no clock is ever shown to the learner.
const STUCK = Object.freeze({ afterMs: 40000, misses: 2 });

// What a review opens without a tap: 'answer' (answer and explanation), 'cue', or null.
// The default shows the answer so nobody leaves an error unexplained. A learner who
// chose to work through it first gets the cue first, with the answer one tap away.
// Whatever the choice, a retried item ends with the full answer.
function reviewOpen({ verdict, support = 'choose', retried = false, hasCue = false, unsure = false }) {
  if (!VERDICTS.includes(verdict) || !SUPPORTS.includes(support)) throw new TypeError('Vellum: invalid review state');
  if (verdict === 'correct') return unsure ? 'answer' : null;
  if (verdict === 'unassessed' || retried || support === 'choose' || !hasCue) return 'answer';
  return 'cue';
}

// During a first attempt: offer the cue when the learner seems stuck, at most once per
// item (`offered`), and not at all for the rest of the round once one offer was
// declined (`declined`, design §8-5) or when they chose to try on their own first.
function offerCue({ support = 'choose', elapsedMs = 0, misses = 0, offered = false, declined = false, hasCue = false, stuck = STUCK }) {
  if (!SUPPORTS.includes(support)) throw new TypeError('Vellum: invalid support');
  if (offered || declined || !hasCue || support === 'independent') return false;
  return elapsedMs >= stuck.afterMs || misses >= stuck.misses;
}

// These reasons describe observed practice scope, never a person's fixed ability.
function learningReason({ status, label }) {
  const reasons = {
    unseen: `${label}는 아직 기록이 적어요. 짧게 확인해 봐요.`,
    checking: `${label}를 조금 더 확인해 봐요.`,
    practice: `최근 놓친 ${label}를 조금 더 연습해 봐요.`,
    supported: `${label}를 도움과 함께 해냈어요. 이어서 살펴봐요.`,
    'recent-independent': `${label}를 최근 혼자 해냈어요. 가볍게 이어가요.`,
    review: `${label}를 다시 살펴볼 때예요.`,
  };
  if (!Object.hasOwn(reasons, status) || typeof label !== 'string') throw new TypeError('Vellum: invalid learning reason');
  return reasons[status];
}
module.exports = { SUPPORTS, STUCK, reviewOpen, offerCue, learningReason };
