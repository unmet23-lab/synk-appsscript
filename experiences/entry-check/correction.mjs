// Authored feedback and bounded queue changes; no diagnosis or external model.
import { activeRules, minutes } from './core.mjs';
import { assignmentCases, caseMetadata } from './learning.mjs';

const sameSet = (a, b) => [...a].sort().join('|') === [...b].sort().join('|');
const sameMeasure = (a, b) => a.skillId === b.skillId && a.difficulty === b.difficulty
  && a.modality === b.modality && a.responseFormat === b.responseFormat;
export const choiceId = choice => choice === 'pass' ? 'pass' : `reject-${choice}`;

// Only an explicitly queued new check is compared; nearby answers are not a pair.
export function followUpResult(coach, link, item, result) {
  if (link?.status !== 'new' || link.id !== item.id || !link.sourceAttemptId || !result?.eventId) return null;
  try { return coach?.recheck?.(link.sourceAttemptId, result.eventId) || null; }
  catch { return null; } // A closed WORLD run or unavailable history is not success.
}

export function choiceCorrection(venue, item, selected) {
  if (selected === item.answer) return '';
  const rules = activeRules(venue, item.at);
  const label = id => rules.find(rule => rule.id === id)?.short || rules.find(rule => rule.id === id)?.text || id;
  if (selected === 'pass') return `통과를 골랐지만, 이 손님은 ‘${label(item.answer)}’ 규칙 때문에 들어갈 수 없어요.`;
  if (item.answer === 'pass') return `‘${label(selected)}’ 규칙으로 거절했지만, 이 손님은 들어갈 수 있어요. 안 되는 것과 괜찮은 것을 같이 읽어 봐요.`;
  return `‘${label(selected)}’ 규칙으로 거절했지만 이유가 달라요. 이 손님은 ‘${label(item.answer)}’ 규칙 때문에 들어갈 수 없어요.`;
}

function preservesShift(venue, before, after, targeted) {
  if (after.length !== before.length || new Set(after.map(item => item.id)).size !== after.length) return false;
  if (!after.every((item, index) => !index || minutes(after[index - 1].at) < minutes(item.at))) return false;
  if (!targeted) {
    // Keep every kind of answer the original shift covered, including its pass.
    if (![...new Set(before.map(item => item.answer))].every(answer => after.some(item => item.answer === answer))) return false;
    if (venue.memo) {
      const at = minutes(venue.memo.at);
      if (!after.some(item => minutes(item.at) < at) || after.filter(item => minutes(item.at) >= at).length < 2) return false;
    }
  }
  return true;
}

/** Replace one remaining slot or move an existing slot; never add an attempt to the shift. */
export function immediateCheck({ venue, queue, index, item, coach, assignment = null, seenIds = [] }) {
  const none = (status, line) => ({ status, queue, item: null, line });
  if (index >= queue.length - 1) return none('round-end', '이번 근무의 마지막 손님이었어요. 근무를 마치면 다음 연습을 볼 수 있어요.');
  const measure = caseMetadata(item), prefix = queue.slice(0, index + 1), remaining = queue.slice(index + 1);
  const attempted = new Set([...seenIds, ...prefix.map(row => row.id)]);
  const pool = assignmentCases(venue.cases, assignment).filter(candidate => candidate.id !== item.id
    && !attempted.has(candidate.id) && minutes(candidate.at) > minutes(item.at)
    && sameMeasure(measure, caseMetadata(candidate)));
  const exposure = candidate => {
    try { const value = coach?.exposure?.(caseMetadata(candidate)); return [true, false].includes(value?.seen) ? value.seen : null; }
    catch { return null; }
  };
  // A shown-but-unanswered question is not a fresh visible scene either. Core's
  // exposure flag protects first independent attempts; preserve the UI distinction.
  const shown = new Set();
  try { for (const event of coach?.events?.() || []) if (event.type === 'practice.presented') { shown.add(event.itemKey); if (event.measure?.familyKey) shown.add(event.measure.familyKey); } } catch { /* exposure still fails closed when history is unavailable */ }
  const strongMatch = candidate => sameSet(item.evidence, candidate.evidence)
    && sameSet(measure.conceptIds, caseMetadata(candidate).conceptIds);
  // An unchanged authored item/family is required. A new choice ID cannot make it new.
  const candidates = pool.map(candidate => ({ candidate, seen: exposure(candidate), strong: strongMatch(candidate) }))
    .sort((a, b) => Number(b.strong) - Number(a.strong) || minutes(a.candidate.at) - minutes(b.candidate.at));
  for (const { candidate, seen, strong } of candidates) {
    const candidateMeasure = caseMetadata(candidate);
    if (seen !== false || shown.has(candidateMeasure.itemKey) || shown.has(candidateMeasure.familyKey)) continue;
    const rest = remaining.filter(row => row.id !== candidate.id);
    // Keep arrival time and memo timing: do not leap forward, then turn the clock back.
    if (rest.some(row => minutes(row.at) <= minutes(candidate.at))) continue;
    const proposed = [];
    if (remaining.some(row => row.id === candidate.id)) proposed.push([...prefix, candidate, ...rest]);
    else for (let remove = rest.length - 1; remove >= 0; remove--) proposed.push([...prefix, candidate, ...rest.filter((_, position) => position !== remove)]);
    const revised = proposed.find(next => preservesShift(venue, queue, next, !!assignment));
    if (!revised) continue;
    return { status: 'new', queue: revised, item: candidate, line: strong
      ? '같은 안내 규칙을 새 손님으로 한 번 더 확인해요.'
      : '비슷한 연습을 새 손님으로 한 번 더 해요. 규칙·표현은 달라질 수 있어요.' };
  }
  const next = remaining[0], equivalent = sameMeasure(measure, caseMetadata(next));
  const nextSeen = exposure(next);
  if (equivalent && nextSeen === true) return { status: 'review', queue, item: next, line: '같은 연습을 할 새 손님이 없어요. 다음 손님은 이미 본 손님의 복습이에요.' };
  if (equivalent && nextSeen === null) return { status: 'unknown', queue, item: next, line: '다음 손님도 비슷한 연습이에요. 전에 만난 손님인지는 확인하지 못했어요.' };
  return none('unavailable', '바로 이어서 확인할 새 손님이 없어요. 다음 손님은 원래 순서대로 만나요.');
}
