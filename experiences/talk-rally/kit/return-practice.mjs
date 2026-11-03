// 재방문 맞춤 연습의 공통 판정: 지난번에 놓친 구체적인 능력(게임이 저작한 패턴)을 근거로 다음 판의 실제 문항을 고른다.
// 원본은 play-common/kit/이고 게임마다 kit/ 사본을 둔다(build-kit.mjs). 화면·저장·전송은 하지 않는다. 독립 응답 판정은 Trail,
// 칸 상태는 Core가 맡고 여기서는 그 결과만 읽는다. 조작 실수와 언어 오답은 기록에서 구분되지 않으므로 서로 다른 문항에서
// 두 번 놓쳐야 말하고, 호출하는 게임의 문구도 단정하지 않는다.
const MISSED_CELL = new Set(['practice', 'checking', 'review']);
const WINDOW = 3, MISSES = 2, EVIDENCE = 3;

// 엔진 칸이 독립 응답으로 인정한 근거 가운데 이 게임 것으로 확인된 응답만 시간순으로 돌려준다.
// 접힌 기록과 다른 게임의 응답은 출처를 잇지 못하므로 세지 않는다.
function ownEvidence(summary, events, gameId, patternOfFamily) {
  const byId = new Map(events.map((event, index) => [event.id, { event, index }])), rows = [];
  for (const skill of summary.skills || []) for (const level of Object.values(skill.levels || {})) for (const cell of Object.values(level.formats || {})) {
    for (const id of cell.evidence || []) {
      const attempt = byId.get(id)?.event;
      if (attempt?.type !== 'practice.attempted' || !['correct', 'incorrect'].includes(attempt.verdict)) continue;
      const shown = byId.get(attempt.presentationId)?.event, decision = byId.get(shown?.decisionId)?.event;
      if (shown?.type !== 'practice.presented' || decision?.type !== 'decision.made' || decision.experienceId !== gameId) continue;
      const familyKey = shown.measure?.familyKey || shown.itemKey, pattern = patternOfFamily(familyKey);
      if (pattern) rows.push({ id, pattern, familyKey, missed: attempt.verdict === 'incorrect', difficulty: shown.measure?.difficulty, cell, order: byId.get(id).index });
    }
  }
  return rows.sort((a, b) => a.order - b.order);
}

// 패턴별 최근 3개 안에서 서로 다른 문항을 두 번 이상 놓쳤고, 그 칸이 아직 연습이 필요한 상태인 것만 남긴다.
export function missedPatterns({ coach, gameId, patterns, patternOfFamily }) {
  const summary = coach.summary();
  if (summary?.storage?.available !== true || summary.evidenceComplete !== true) return [];
  const rows = ownEvidence(summary, coach.events(), gameId, patternOfFamily), found = [];
  for (const [id, pattern] of Object.entries(patterns)) {
    const recent = rows.filter(row => row.pattern === id).slice(-WINDOW), missed = recent.filter(row => row.missed);
    if (recent.length < (pattern.minEvidence ?? EVIDENCE) || missed.length < MISSES || !MISSED_CELL.has(missed.at(-1).cell.status)) continue;
    found.push({ id, misses: missed.length, seen: recent.length, lastMiss: missed.at(-1).order, evidenceIds: recent.map(row => row.id),
      missedFamilies: missed.map(row => row.familyKey), difficulty: Math.max(...recent.map(row => row.difficulty ?? 1)) });
  }
  return found.sort((a, b) => b.lastMiss - a.lastMiss || b.misses - a.misses);
}

const candidateOf = ({ id, meta }) => ({ id, skillIds: [meta.skillId], difficulty: meta.difficulty, modality: meta.modality,
  responseFormat: meta.responseFormat, itemKey: meta.itemKey, familyKey: meta.familyKey, conceptIds: meta.conceptIds || [], audioRequired: meta.audioRequired });

// freshItems(패턴) → [{ id, meta, item, tier? }]. tier가 낮은 묶음부터 쓴다(리듬: 곡 문항이 없을 때만 보충 문항).
function freshTarget(coach, found, freshItems, audioAvailable) {
  const usable = (freshItems(found.id) || []).filter(row => row.meta.difficulty <= found.difficulty && (audioAvailable || !row.meta.audioRequired)
    && coach.exposure(row.meta).seen === false && (row.peers || []).every(peer => coach.exposure(peer).seen === false));
  if (!usable.length) return null;
  const tier = Math.min(...usable.map(row => row.tier ?? 0)), list = usable.filter(row => (row.tier ?? 0) === tier);
  const plan = coach.recommend(list.map(candidateOf), { audioAvailable });
  return list.find(row => row.id === plan?.selected?.id) || list[0];
}

/**
 * 다음 판의 맞춤 연습. 아니면 null이고, 호출하는 게임은 기존 안내와 기존 선택을 그대로 쓴다.
 * 과제가 있거나 기록을 다 받지 못했거나 새 문항이 없으면 말하지 않는다. 재노출 문항을 새 문항이라 부르지 않는다:
 * 새 문항이 없어도 다시 해 볼 수 있는 게임만 repeatItem을 주고, 그 결과는 repeat: true로 표시된다.
 */
export function returnPractice({ coach, gameId, patterns, patternOfFamily, freshItems, repeatItem = null, audioAvailable = true }) {
  if (!coach) return null;
  try {
    if (coach.assignment?.()) return null;
    for (const found of missedPatterns({ coach, gameId, patterns, patternOfFamily })) {
      const target = freshTarget(coach, found, freshItems, audioAvailable);
      if (target) return { ...found, patternId: found.id, target, repeat: false, why: patterns[found.id].why, next: patterns[found.id].next };
      const again = repeatItem?.(found);
      if (again) return { ...found, patternId: found.id, target: again, repeat: true, why: patterns[found.id].why, next: patterns[found.id].next };
    }
  } catch { /* 기록을 읽지 못하면 맞춤 없이 기존 판으로 간다 */ }
  return null;
}
