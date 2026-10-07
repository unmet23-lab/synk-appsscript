/* Vellum's optional surface-expression review. Products own language patterns,
 * intended recipients, date meaning and confirmation. This module compares text
 * and exact source spans; it does not infer personality, intent or correctness. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkVellumExpression = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'vellum-expression-1';
  const textValue = (value, label = 'text') => {
    if (typeof value !== 'string' || value.length > 50000) throw new TypeError(`Vellum Expression: invalid ${label}`);
    return value;
  };
  const emoji = () => /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)/gu;
  const codepoints = value => [...value];
  const list = value => { if (!Array.isArray(value) || value.length > 500) throw new TypeError('Vellum Expression: invalid list'); return value; };
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compareEdits({ before, after, minReduction = 8, maxRatio = 0.8 } = {}) {
    textValue(before); textValue(after);
    if (!Number.isInteger(minReduction) || minReduction < 1 || !Number.isFinite(maxRatio) || maxRatio <= 0 || maxRatio >= 1) throw new TypeError('Vellum Expression: invalid revision policy');
    if (!before.trim() || !after.trim() || before === after) return { version: VERSION, observations: [] };
    const original = codepoints(before.trim()), revised = codepoints(after.trim()), observations = [];
    if (original.length - revised.length >= minReduction && revised.length / original.length <= maxRatio) observations.push({ kind: 'shorter', beforeLength: original.length, afterLength: revised.length });
    const removedEmoji = [...new Set(before.match(emoji()) || [])].filter(value => !after.includes(value));
    if (removedEmoji.length && !(after.match(emoji()) || []).length) observations.push({ kind: 'no-emoji', removed: removedEmoji });
    // One exact contiguous deletion, bounded on both sides by word boundaries.
    // Replacing arbitrary words or deleting a Hangul syllable is not a preference.
    let start = 0, end = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
    const removedRaw = before.slice(start, before.length - end), inserted = after.slice(start, after.length - end);
    const removed = removedRaw.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu, '').trim().replace(/^[.!?。！？,;:·\s]+|[.!?。！？,;:·\s]+$/gu, '');
    const position = removed ? before.indexOf(removed, start) : -1;
    if (!inserted.trim() && removed.length >= 2 && removed.length <= 80 && position >= 0
      && !/[\p{L}\p{N}]/u.test(before[position - 1] || '') && !/[\p{L}\p{N}]/u.test(before[position + removed.length] || '')
      && !after.includes(removed) && !/[\r\n]/u.test(removed)) observations.push({ kind: 'avoid-phrase', removed, start: position, end: position + removed.length });
    return { version: VERSION, observations };
  }
  function occurrences(text, value, { wholeName = false, suffixes = [] } = {}) {
    textValue(value, 'literal');
    if (!value.trim()) return [];
    const result = []; let index = text.indexOf(value);
    while (index >= 0) {
      const next = index + value.length, tail = text.slice(next);
      const right = !/[\p{L}\p{N}]/u.test(tail[0] || '') || suffixes.some(suffix => new RegExp('^' + escape(suffix) + '(?:$|[^\\p{L}\\p{N}])', 'u').test(tail));
      if (!wholeName || !/[\p{L}\p{N}]/u.test(text[index - 1] || '') && right) result.push({ quote: value, start: index, end: next });
      index = text.indexOf(value, next);
    }
    return result;
  }
  function validSpan(text, item) {
    if (!item || typeof item.quote !== 'string' || !item.quote || !Number.isInteger(item.start) || !Number.isInteger(item.end)
      || item.start < 0 || item.end <= item.start || text.slice(item.start, item.end) !== item.quote) throw new TypeError('Vellum Expression: invalid source span');
    return { quote: item.quote, start: item.start, end: item.end };
  }
  function review({ text, forbiddenPhrases = [], otherNames = [], recipientNames = [], nameSuffixes = [], dates = [], expectedDate = null, promises = [], confirmedPromises = [] } = {}) {
    textValue(text); [forbiddenPhrases, otherNames, recipientNames, nameSuffixes, dates, promises, confirmedPromises].forEach(list);
    [...forbiddenPhrases, ...otherNames, ...recipientNames, ...nameSuffixes, ...confirmedPromises].forEach(value => textValue(value, 'literal'));
    if (expectedDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) throw new TypeError('Vellum Expression: invalid expected date');
    const issues = [], seen = new Set();
    const add = (kind, evidence, extra = {}) => { const id = `${kind}:${evidence.start}:${evidence.end}`; if (!seen.has(id)) { seen.add(id); issues.push({ id, kind, evidence, ...extra }); } };
    for (const phrase of forbiddenPhrases) for (const evidence of occurrences(text, phrase)) add('avoid-phrase', evidence);
    for (const name of otherNames.filter(value => !recipientNames.includes(value))) for (const evidence of occurrences(text, name, { wholeName: true, suffixes: nameSuffixes })) add('other-name', evidence);
    for (const date of dates) {
      const evidence = validSpan(text, date);
      if (date.valid === false) add('invalid-date', evidence);
      else if (date.valid !== true || typeof date.value !== 'string') throw new TypeError('Vellum Expression: invalid date observation');
      else if (date.uncertain) add('date-confirmation', evidence, { candidate: date.value });
      else if (expectedDate && date.value !== expectedDate) add('date-mismatch', { ...evidence, expected: expectedDate }, { candidate: date.value });
    }
    for (const promise of promises) { const evidence = validSpan(text, promise); if (!confirmedPromises.includes(evidence.quote)) add('promise-confirmation', evidence); }
    return { version: VERSION, method: 'surface-rules', needsReview: true, issues: issues.sort((a, b) => a.evidence.start - b.evidence.start || a.kind.localeCompare(b.kind)) };
  }
  return Object.freeze({ VERSION, compareEdits, review });
});
