/** 자유 글의 뜻을 분류하지 않는다. 이번 용도는 사용자가 확인한 선택만 받는다. */
export const MEMORY_USES = Object.freeze({ 'shared-memory': '함께한 기억', 'gift-preference': '선물 취향' });

/** 현재 수첩에서 다시 찾는다. 다른 사람·삭제한 원문·철회한 기억은 재사용할 수 없다. */
export function resolveCareMemory({ state, personId, eventType = 'checkin', memorySelection = null } = {}) {
  if (memorySelection === null || memorySelection === undefined) return null;
  if (!memorySelection || typeof memorySelection !== 'object' || Array.isArray(memorySelection)
    || Object.keys(memorySelection).some(key => !['memoryId', 'use', 'confirmed'].includes(key))
    || memorySelection.confirmed !== true || !Object.hasOwn(MEMORY_USES, memorySelection.use)
    || typeof memorySelection.memoryId !== 'string' || !memorySelection.memoryId) throw new Error('이번에 쓸 기억과 용도를 직접 확인해 주세요.');
  const person = state?.people?.find(item => item.id === personId);
  const memory = state?.memories?.find(item => item.id === memorySelection.memoryId);
  const source = state?.sources?.find(item => item.id === memory?.sourceId);
  if (!person || !memory || memory.personId !== personId || !source || source.personId !== personId
    || typeof memory.text !== 'string' || !memory.text.trim() || typeof memory.sourceQuote !== 'string'
    || !memory.sourceQuote || typeof source.text !== 'string' || !source.text.includes(memory.sourceQuote)) throw new Error('이 사람의 현재 기억과 원문을 다시 선택해 주세요. 삭제하거나 바뀐 근거는 사용할 수 없어요.');
  const sensitive = ['condolence', 'memorial'].includes(eventType);
  const pref = person.recipientPreference ?? {};
  const blockedReasons = [];
  if (pref.confirmed && (pref.avoidPhrases ?? []).some(phrase => memory.text.includes(phrase))) blockedReasons.push('직접 정한 피할 표현이 기억에 있어 자동으로 넣지 않았어요.');
  if (pref.confirmed && pref.noReplyPressure && /(?:꼭|반드시|빨리|바로)[^.!?\n]{0,12}(?:답장|연락|회신)|(?:답장|연락|회신)[^.!?\n]{0,12}(?:꼭|반드시|빨리|바로|해\s?줘|주세요|부탁)/u.test(memory.text)) blockedReasons.push('답장을 재촉할 수 있는 표현이 있어 기억을 자동으로 넣지 않았어요.');
  if (sensitive && /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]|[ㅋㅎ]{2,}|농담|장난|웃겨|웃기지|웃기네|(?:ha){2,}|lol/iu.test(memory.text)) blockedReasons.push('조심스러운 날에 맞지 않을 수 있는 이모지·웃음·농담 표지가 있어 기억을 자동으로 넣지 않았어요.');
  if (memorySelection.use === 'gift-preference' && (sensitive || eventType === 'checkin')) blockedReasons.push('이번 연락에는 선물 취향을 자동으로 사용하지 않아요. 함께한 기억을 고르거나 선택 없이 준비해 주세요.');
  return {
    memoryId: memory.id, use: memorySelection.use, text: memory.text,
    sourceId: source.id, sourceTitle: source.title, sourceQuote: memory.sourceQuote,
    appliedTo: [], blockedReasons,
  };
}
