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

// Korean particles follow the label's last Hangul syllable: with a final consonant
// (받침) 은/을, without one 는/를. Labels end in many ways ("낱말 듣기", "반대말").
function particle(label, withFinal, without) {
  for (let i = label.length - 1; i >= 0; i -= 1) {
    const code = label.charCodeAt(i);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? withFinal : without;
  }
  return without;
}
// These reasons describe observed practice scope, never a person's fixed ability.
function learningReason({ status, label }) {
  if (typeof label !== 'string') throw new TypeError('Vellum: invalid learning reason');
  const topic = `${label}${particle(label, '은', '는')}`, object = `${label}${particle(label, '을', '를')}`;
  const reasons = {
    unseen: `${topic} 아직 기록이 적어요. 짧게 확인해 봐요.`,
    checking: `${object} 조금 더 확인해 봐요.`,
    practice: `최근 놓친 ${object} 조금 더 연습해 봐요.`,
    supported: `${object} 도움과 함께 해냈어요. 이어서 살펴봐요.`,
    'recent-independent': `${object} 최근 혼자 해냈어요. 가볍게 이어가요.`,
    review: `${object} 다시 살펴볼 때예요.`,
  };
  if (!Object.hasOwn(reasons, status)) throw new TypeError('Vellum: invalid learning reason');
  return reasons[status];
}
// The line beside practice a product picked because a declared learning reason leads to that
// situation (Strata links.goals). The blank is the situation's own words (when_ko: "주문할 때").
// It names the reason's situation only; a product shows it next to content it chose for it.
function situationLine({ when }) {
  if (typeof when !== 'string' || !when.trim()) throw new TypeError('Vellum: invalid situation line');
  return `${when} 쓰는 말이라 골랐어요.`;
}
// Activity reasons keep a product's scheduled review distinct from observed practice.
function activityReason({ reasons = [], state = 'unseen', label } = {}) {
  if (!Array.isArray(reasons)) throw new TypeError('Vellum: invalid activity reason');
  if (reasons.includes('activity.none')) return '지금 조건에 맞는 활동이 없어요. 시간이나 소리 설정을 바꿔 볼 수 있어요.';
  if (reasons.includes('review.due')) return '복습할 시간이 된 내용이 있어요. 짧게 다시 만나 봐요.';
  const goal = reasons.includes('goal.declared');
  if (reasons.includes('activity.retry')) return `처음에 놓친 부분을 다시 연습해 봐요.${goal ? ' 고른 목표와 이어지는 활동이에요.' : ''}`;
  if (reasons.includes('activity.assisted')) return `도움과 함께 해낸 부분이에요. 한 번 더 살펴봐요.${goal ? ' 고른 목표와 이어지는 활동이에요.' : ''}`;
  // Every item already presented: a repeat is welcome, but it is not a new first try (Core learning.js).
  if (reasons.includes('practice.spent')) return `이 활동의 새 문항은 모두 만났어요. 다시 해도 좋지만 연습 기록은 새 문항으로만 바뀌어요.${goal ? ' 고른 목표와 이어지는 활동이에요.' : ''}`;
  if (label && state !== 'unseen') return `${learningReason({ status: state, label })}${goal ? ' 고른 목표와 이어지는 활동이에요.' : ''}`;
  if (goal) return '직접 고른 목표와 이어지는 활동이에요. 짧게 시작해 봐요.';
  if (reasons.includes('history.incomplete')) return '기록을 모두 확인하기 전이라 기본 활동으로 시작해요.';
  return '아직 연습 기록이 적어요. 짧게 해 보며 맞춰 갈게요.';
}
// These lines describe evidence and observation windows, not preference strength
// or learning effectiveness. App opening is never called activity completion.
function memberActivityReason({ kind, action = false } = {}) {
  if (!['favorite', 'opened'].includes(kind)) throw new TypeError('Vellum: invalid member activity basis');
  if (kind === 'favorite') return action ? '직접 즐겨찾기에 고른 앱에서 이어서 시작해요.' : '직접 즐겨찾기에 고른 앱이에요. 이용 횟수와는 별개의 선택이에요.';
  return action ? '최근 60일에 열어 본 앱에서 이어서 시작해요.' : '연결을 허용한 뒤 최근 60일에 앱을 연 기록이에요. 실제 활동 완료나 좋아하는 정도를 뜻하지 않아요.';
}
function periodComparisonReason({ source, state } = {}) {
  if (!['activity', 'practice'].includes(source) || !['ready', 'empty', 'partial', 'disabled'].includes(state)) throw new TypeError('Vellum: invalid period comparison');
  if (state === 'disabled') return '앱 이용 기록 연결이 꺼져 있어요. 연결을 허용한 뒤의 기록부터 모아요.';
  if (state === 'partial') return '연결 시작 시점이나 보관 범위 때문에 두 기간의 기록을 모두 확인할 수 없어요. 있는 기록만 보여드리고 차이는 계산하지 않아요.';
  if (state === 'empty') return '두 기간 모두에 기록이 있어야 차이를 비교해요. 기록이 없는 기간을 성향이나 실력의 변화로 판단하지 않아요.';
  return source === 'activity' ? '같은 길이의 두 기간에 앱을 연 횟수와 날짜를 비교해요. 활동 완료나 관심의 강도를 뜻하지 않아요.'
    : '같은 길이의 두 기간에 답한 횟수를 비교해요. 혼자 응답에는 오답도 포함하며, 실력 성장이나 학습 효과를 뜻하지 않아요.';
}
// Member understanding uses authored evidence wording. Confirmation changes the
// person's interpretation; it never changes an observed count or proves a trait.
const memberDate = value => {
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) throw new TypeError('Vellum: invalid member evidence date');
  const [year, month, day] = new Date(time + 9 * 3600000).toISOString().slice(0, 10).split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
};
function memberUnderstandingLine({ kind, label, count = 0, activeDays = 0, state = 'observed', selection = null, periodEnd = null } = {}) {
  if (typeof label !== 'string' || !['observed', 'agreed', 'contextual', 'disagreed', 'declared', 'empty', 'disabled'].includes(state)) throw new TypeError('Vellum: invalid member understanding');
  if (state === 'disabled') return '이 자료의 연결이 꺼져 있어 관찰과 그에 대한 확인을 요약에 사용하지 않아요.';
  if (state === 'empty') return '아직 여러 날의 기록이 충분하지 않아요. 지금 선호하는 방식을 직접 고를 수 있어요.';
  if (state === 'declared') {
    if (kind === 'learning-topic') {
      if (selection === 'interested') return `${label}에 관심이 있다고 직접 알려 줬어요. 다음 설명에서도 이 선택을 먼저 참고해요.`;
      if (selection === 'practice-only') return `${label}${particle(label, '은', '는')} 연습에서 다룬 내용일 뿐이라고 직접 알려 줬어요.`;
      if (selection === 'not-now') return `${label}${particle(label, '은', '는')} 지금 관심 있는 내용이 아니라고 직접 알려 줬어요.`;
      throw new TypeError('Vellum: invalid member topic selection');
    }
    return `직접 고른 내용: ${label}. 다음 설명에서도 이 선택을 먼저 참고해요.`;
  }
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(activeDays)) throw new TypeError('Vellum: invalid member observation count');
  const period = periodEnd ? `${memberDate(periodEnd)} 기준 최근 30일` : '최근 30일';
  const fact = kind === 'usage-repeat' ? `${period}의 연결된 기록에서 ${label}${particle(label, '을', '를')} ${activeDays}일에 걸쳐 ${count}번 열었어요.`
    : kind === 'learning-topic' ? `${period}의 학습 기록에서 ${label}${particle(label, '을', '를')} 다룬 응답이 ${activeDays}일에 걸쳐 ${count}건 있어요.`
      : `${period}의 학습 기록에서 ${label} 방식의 응답이 ${activeDays}일에 걸쳐 ${count}건 있어요.`;
  if (state === 'agreed') return `${fact} ${kind === 'learning-topic' ? '관심 있는 내용이라고 직접 확인했어요.' : '자신에게 맞는 이용 방식이라고 직접 확인했어요.'}`;
  if (state === 'contextual') return `${fact} 다만 상황에 따라 달라지는 내용이라고 직접 알려 줬어요.`;
  if (state === 'disagreed') return `${fact} 이 기록을 자신의 관심이나 선호로 해석하지 않기로 했어요.`;
  return `${fact} ${kind === 'learning-topic' ? '다뤘다는 사실만으로 관심이라고 정하지 않아요.' : '기록된 방식이며 선호나 효과를 뜻하지는 않아요.'}`;
}
// Core supplies validated, consent-scoped facts. A compact overview describes
// what is known and missing without promoting practice content to a preference.
function memberUnderstandingSummary({ hasDeclaration, hasFeedback, practice = null, learning, usage, learningAt = null, usageAt = null }) {
  if (typeof hasDeclaration !== 'boolean' || typeof hasFeedback !== 'boolean'
    || !['ready', 'disabled', 'unavailable'].includes(learning) || !['ready', 'disabled', 'unavailable'].includes(usage)) throw new TypeError('Vellum: invalid member summary');
  let observation = '';
  if (learning === 'ready' && practice) {
    const { answered, independent, assisted, activeDays, to } = practice;
    if (![answered, independent, assisted, activeDays].every(n => Number.isSafeInteger(n) && n >= 0)
      || independent + assisted > answered || activeDays > Math.min(answered, 31)) throw new TypeError('Vellum: invalid member practice summary');
    const period = `${memberDate(to)} 기준 최근 30일`;
    observation = answered ? `학습 기록은 ${period} 중 ${activeDays}일, 응답 ${answered}건이에요. 그중 도움 없이 답한 응답은 ${independent}건, 도움을 받은 응답은 ${assisted}건이에요. ${activeDays === 1 ? '하루의 기록만으로 반복되는 경향이나 선호를 정하지 않아요.' : '연습에서 사용한 방식과 본인이 원하는 방식은 다를 수 있어요.'}`
      : `${period}에는 학습 응답 기록이 없어요. 기록이 없다는 사실을 관심이나 실력이 없다는 뜻으로 보지 않아요.`;
  }
  const scope = [];
  if (learning === 'disabled') scope.push('학습 기록 연결이 꺼져 있어 이번 설명에 사용하지 않았어요.');
  else if (learning === 'unavailable') scope.push('학습 기록은 이번 설명에 연결되지 않았어요.');
  else if (!practice) scope.push(learningAt ? `학습 자료는 ${memberDate(learningAt)} 기준이며, 기간별 응답 수를 함께 확인할 수 없어 요약하지 않았어요.` : '기간별 학습 응답 수를 확인할 수 없어 요약하지 않았어요.');
  else if (hasDeclaration) scope.push(`학습 기록은 ${memberDate(practice.to)} 기준 최근 30일의 자료예요. 직접 알려준 선호와 연습에서 관찰한 사실을 구분해요.`);
  if (usage === 'disabled') scope.push('앱 이용 기록 연결이 꺼져 있어 이번 설명에 사용하지 않았어요.');
  else if (usage === 'unavailable') scope.push('앱 이용 기록은 이번 설명에 연결되지 않았어요.');
  else if (usageAt) scope.push(`앱 이용 기록은 ${memberDate(usageAt)} 기준으로 확인했어요. 앱을 연 사실만으로 구체적인 관심을 정하지 않아요.`);
  return {
    headline: hasDeclaration ? '내가 확인한 선호와 지금의 기록' : '아직 나의 선호를 알아가는 중이에요',
    opening: hasDeclaration ? '' : hasFeedback ? '기록에 대한 본인의 확인을 먼저 반영했어요. 아직 확인하지 않은 관심이나 편한 방식은 추측하지 않아요.'
      : '아직 관심사와 편한 방식을 정리할 만큼 직접 확인한 내용이 없어요. 원하는 방식을 직접 알려 주면 다음 설명에 먼저 반영해요.',
    observation, scope: scope.join(' '),
  };
}
function memberUnderstandingNote({ line, note }) {
  if (typeof line !== 'string' || typeof note !== 'string' || [...note].length > 200
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDFFF]/u.test(note)) throw new TypeError('Vellum: invalid member note');
  // A literal quotation, never input to an instruction interpreter or classifier.
  return note.trim() ? `${line} 직접 남긴 설명: “${note}”` : line;
}
function memberUnderstandingActivityReason({ kind, labels }) {
  if (!['topic', 'learning', 'app'].includes(kind) || !Array.isArray(labels) || !labels.length || labels.some(label => typeof label !== 'string')) throw new TypeError('Vellum: invalid member activity link');
  const named = labels.join(' · ');
  if (kind === 'learning') return `관심 있다고 직접 확인한 '${named}'에서 이어서 학습을 골라 볼 수 있어요.`;
  if (kind === 'app') return `이어서 이용할 앱으로 ${named}${particle(named, '을', '를')} 직접 골랐어요.`;
  return `직접 고른 '${named}' 관심과 연결되는 앱이에요.`;
}
module.exports = { SUPPORTS, STUCK, reviewOpen, offerCue, learningReason, situationLine, activityReason, memberActivityReason, periodComparisonReason, memberUnderstandingLine, memberUnderstandingSummary, memberUnderstandingNote, memberUnderstandingActivityReason };
