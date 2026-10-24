// Select public replay semantics, leaving authored labels and repeated option catalogues to
// their existing product tests. This is shared by the one-off baseline capture and its replay test.
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
export function replayObservation(view) {
  return {
    ...pick(view, ['version', 'synthetic', 'context', 'status', 'topCandidateId', 'topTierIds', 'selection',
      'questionsPaused', 'priorities', 'conditionalPreference', 'questionControl', 'priorityChanges',
      'snoozedCandidates', 'excludedCandidates', 'feedback', 'exclusions', 'exposure', 'changes', 'change', 'repetition']),
    fields: view.fields.map(field => ({
      ...pick(field, ['id', 'state', 'value', 'source', 'required', 'requiredValue', 'sceneSource']),
      ...Object.fromEntries(['baseline', 'context', 'effective'].filter(key => field[key]).map(key => [key, pick(field[key], ['state', 'value', 'provenance'])])),
    })),
    scenes: view.scenes.map(scene => pick(scene, ['id', 'field', 'response', 'suggestion', 'canRespond'])),
    candidates: view.candidates.map(candidate => pick(candidate, ['id', 'status', 'selected', 'score'])),
    question: view.question && pick(view.question, ['field', 'target', 'optional', 'valueBasis']),
  };
}
