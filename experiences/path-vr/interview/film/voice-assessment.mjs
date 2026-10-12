import { classifyAnswer, isShortExperienceDenial } from '../dialogue.mjs';
import { planAnswerFollowup } from './answer-followup.mjs';

// Decoder confidence is uncertainty evidence, never a measured accuracy rate.
export const VOICE_MIN_CONFIDENCE = .55;
const ENGINES = new Set(['whisper-tiny', 'whisper-base', 'whisper-tiny-q8', 'whisper-base-q8']);
const DEFAULT_CLIPS = ['strict-followup-experience', 'strict-followup-plan'];
const SELF = /제가|저는|저도|나는|내가|본인은|본인이/gu;
const ACTION = /돌봤|돌보았|돌본|보살폈|간병했|부축했|도왔|도운|도와드렸|모셨|근무했|일했|봉사했|실습했|보조했|수행했|담당했|맡았|준비했|확인했|기록했|보고했|전달했|(?:준비|공부|교육|훈련|실습)(?:를|을)?(?:하고|했|받고|받았|받으며|받겠|하겠|중)|배우고|배웠|배우겠|배울|배워/gu;
const EXPERIENCE = /경험|경력/gu;
// A recognizer can substitute 있/없 with a high score. A bare experience
// claim must be explicitly checked; do not infer the missing original word.
const EXPERIENCE_POLARITY = /(?:(?:경험|경력)(?:이|은|는)?|(?:해본|해봤던|한|돌본|돌봤던|도운|도왔던|일한|근무한|봉사한|실습한)적(?:이|은|는)?)(?:(?:아직|전혀|별로|거의|조금|많이))*(?:있|없)(?:지(?:는)?않)?(?:었)?(?:습니다|어요|다|어)?/gu;
const POLARITY = /없|않|아니|아닙|못(?:하|했|해|도|돌)|안(?:하|했|해|도|돌)|있(?:습|어|지)|겠습니다|예정|계획/gu;
const CARE_ACTION = /식사|이동|간병|부축|돌봄/gu;
const AMBIGUOUS = /아니요|정정|제가아니|내가아니|뜻은아니|뜻은아닙|없지(?:는)?않|(?:것|거|듯)같|(?:봤|았|었|했)을수도|만약|(?:돌봤다|도왔다|했다|있다|없다)면|돌본다면|(?:다는|라는).{0,16}(?:얘기|말|문장)|(?:다고|라고)(?:들었|말했|합니다)/gu;
const OTHER = /(?:동료|친구|남편|아내|배우자|딸|아들|어머니|아버지|씨|선생님)(?:이|가|는|은)/gu;
const DAMAGED = /\uFFFD|[ㄱ-ㅎㅏ-ㅣ]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu;

function tokens(text) {
  return [...text.matchAll(/\S+/gu)].map(match => ({ word: match[0], start: match.index, end: match.index + match[0].length }));
}
function metadata(text, supplied) {
  const list = tokens(text);
  const aligned = Array.isArray(supplied) && supplied.length === list.length && supplied.every((word, index) => word?.word === list[index].word);
  return list.map((token, index) => {
    const value = aligned ? supplied[index] : {};
    return { ...token, ...(Number.isFinite(value.conf) && value.conf >= 0 && value.conf <= 1 ? { conf: value.conf } : {}),
      ...(Number.isFinite(value.start) && value.start >= 0 ? { audioStart: value.start } : {}),
      ...(Number.isFinite(value.end) && value.end >= 0 ? { audioEnd: value.end } : {}) };
  });
}
function compactView(text) {
  let value = ''; const offsets = [];
  for (let index = 0; index < text.length; index++) if (!/\s/u.test(text[index])) { value += text[index]; offsets.push(index); }
  return { value, offsets };
}
function ranges(text, pattern, role, wordList) {
  const { value, offsets } = compactView(text);
  return [...value.matchAll(pattern)].map(match => {
    const start = offsets[match.index], end = offsets[match.index + match[0].length - 1] + 1;
    const covered = wordList.filter(word => word.start < end && word.end > start);
    return { start: covered[0].start, end: covered.at(-1).end, role };
  });
}
function includeRepeatedPredicate(text, span, wordList, clauseEnd) {
  // A real noisy decode produced "경험이 있다고 있습니다.". Keep that
  // adjacent duplicate in ONE editable issue, without repairing either word.
  // Extend by only one exact token in this evidence clause; normal reported
  // speech ("있다고 말했습니다"), punctuation and new clauses stay separate.
  if (!/있다고$/u.test(text.slice(span.start, span.end).replace(/\s/gu, ''))) return span;
  const next = wordList.find(word => word.start >= span.end);
  if (!next || next.end > clauseEnd || next.end - span.start > 120
    || !/^[\t ]+$/u.test(text.slice(span.end, next.start)) || !/^있습니다[.!?。！？]*$/u.test(next.word)) return span;
  return { ...span, end: next.end };
}
function shortSpan(wordList, start = 0, end = Infinity) {
  const selected = wordList.filter(word => word.end > start && word.start < end);
  if (!selected.length) return { start: 0, end: 0 };
  const first = selected[0];
  const last = selected.filter(word => word.end - first.start <= 120).at(-1) || first;
  return { start: first.start, end: last.end };
}

/** No rewriting, network calls or accuracy claims. confirmedSpans must be
 * explicit user approvals of {start,end,text} in this exact current rawText.
 * Recognition uncertainty may be acknowledged; semantic rejection remains a
 * rejection and the session must still run its normal semantic guard. */
export function assessVoiceAnswer(result, { turn = 1, availableClipIds = DEFAULT_CLIPS, confirmedSpans = [], minConfidence = VOICE_MIN_CONFIDENCE } = {}) {
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) throw new RangeError('minConfidence must be between 0 and 1');
  const rawText = typeof result?.text === 'string' ? result.text : '';
  const wordList = metadata(rawText, result?.words);
  const proposedBranch = turn === 1 ? planAnswerFollowup(rawText, { availableClipIds }) : classifyAnswer(rawText);
  const criticalSpans = [];
  const output = (decision, issue = null) => ({ decision, rawText, issue, criticalSpans, proposedBranch });
  const confirmed = span => Array.isArray(confirmedSpans) && confirmedSpans.some(item => Number.isInteger(item?.start) && Number.isInteger(item?.end)
    && item.start >= 0 && item.end <= rawText.length && item.start <= span.start && item.end >= span.end
    && item.end > item.start && typeof item.text === 'string' && rawText.slice(item.start, item.end) === item.text);
  const issue = (kind, span, prompt) => ({ kind, start: span.start, end: span.end, prompt });
  const firstClauseEnd = rawText.search(/[.!?。！？\n]/u);
  const basis = proposedBranch.evidence && typeof proposedBranch.evidence === 'object' ? proposedBranch.evidence
    : shortSpan(wordList, 0, firstClauseEnd >= 0 ? firstClauseEnd + 1 : rawText.length);
  const excerpt = shortSpan(wordList, basis.start, basis.end);
  if (!rawText.trim()) return output('retry', issue('empty', { start: 0, end: rawText.length }, '말소리를 확인하지 못했습니다. 다시 답변해 주세요.'));
  if (result?.truncated) return output('retry', issue('truncated', shortSpan(wordList, Math.max(0, rawText.length - 120)), '답변 끝까지 인식하지 못했습니다. 짧게 나누어 다시 말해 주세요.'));
  const damaged = [...rawText.matchAll(DAMAGED)][0];
  if (damaged) {
    const span = shortSpan(wordList, damaged.index, damaged.index + damaged[0].length);
    return output(confirmed(span) ? 'retry' : 'clarify', issue('damaged', span, '이 부분의 글자가 제대로 인식되지 않았습니다. 고치거나 다시 말해 주세요.'));
  }
  const ambiguity = ranges(rawText, AMBIGUOUS, 'meaning', wordList).find(span => !confirmed(span));
  if (ambiguity) return output('clarify', issue('meaning', ambiguity, '이 표현이 말한 뜻과 맞는지 확인해 주세요. 다르면 이 부분만 고쳐 주세요.'));
  if (proposedBranch.kind !== 'usable') {
    const candidate = ranges(rawText, OTHER, 'actor', wordList)[0] || excerpt;
    return output(confirmed(candidate) ? 'retry' : 'clarify', issue('semantic', candidate, '본인이 직접 한 일이나 준비에 관한 답변인지 확인하고, 다르면 고쳐 주세요.'));
  }
  const actors = ranges(rawText, SELF, 'actor', wordList).filter(span => span.end <= basis.end);
  const actions = ranges(rawText, ACTION, 'action', wordList).filter(span => span.start >= basis.start && span.end <= basis.end);
  const experience = ranges(rawText, EXPERIENCE, 'experience', wordList).filter(span => span.start >= basis.start && span.end <= basis.end);
  const polarity = ranges(rawText, POLARITY, 'polarity', wordList).filter(span => span.start >= basis.start && span.end <= basis.end);
  const care = ranges(rawText, CARE_ACTION, 'action', wordList).filter(span => span.start >= basis.start && span.end <= basis.end);
  const experienceClaims = ranges(rawText, EXPERIENCE_POLARITY, 'polarity', wordList)
    .filter(span => span.start >= basis.start && span.end <= basis.end)
    .map(span => includeRepeatedPredicate(rawText, span, wordList, basis.end));
  // The shared router already recognizes complete replies such as "아직 안
  // 해봤어요" in this question's experience context. Approve that short reply
  // once (including its stated/omitted actor) instead of rejecting it again for
  // lacking the literal word 경험 or a positive past-action verb. Anchors in
  // the shared rule exclude other people, unrelated activities and quotation.
  if (!experienceClaims.length && proposedBranch.negatedExperience === true
    && rawText.trim().length <= 120 && isShortExperienceDenial(rawText)) {
    experienceClaims.push({ ...shortSpan(wordList), role: 'polarity' });
  }
  criticalSpans.push(...experienceClaims);
  const uncheckedClaim = experienceClaims.find(span => !confirmed(span));
  if (uncheckedClaim) return output('clarify', issue('experience-polarity', uncheckedClaim, '본인의 경험이 있는지 없는지를 이 부분만 확인해 주세요. 반대로 들렸다면 고쳐 주세요.'));
  if (!actors.length && !confirmed(excerpt) && !experienceClaims.some(confirmed)) return output('clarify', issue('actor', excerpt, '이 부분은 본인이 직접 한 일이나 준비를 말한 건가요? 다르면 고쳐 주세요.'));
  if (!actions.length && !(experience.length && polarity.length) && !experienceClaims.length) return output(confirmed(excerpt) ? 'retry' : 'clarify', issue('detail', excerpt, '직접 한 일이나 준비한 내용을 이 부분에 구체적으로 말씀해 주세요.'));
  const other = ranges(rawText, OTHER, 'actor', wordList).find(span => !confirmed(span));
  if (other) return output('clarify', issue('actor', other, '누가 한 일인지 이 부분을 확인해 주세요. 다르면 고쳐 주세요.'));
  for (const span of [actors.at(-1), ...actions, ...experience, ...polarity, ...care].filter(Boolean)) {
    if (!criticalSpans.some(item => item.start === span.start && item.end === span.end)) criticalSpans.push(span);
  }
  criticalSpans.sort((a, b) => a.start - b.start || a.end - b.end);
  // Inspect every word in each critical phrase, not an utterance average.
  // Other words can remain uncertain without forcing full-transcript review.
  for (const span of criticalSpans) {
    for (const word of wordList.filter(word => word.start < span.end && word.end > span.start)) {
      if (confirmed(word)) continue;
      const knownEngine = ENGINES.has(result?.engine);
      if (!knownEngine || !Number.isFinite(word.conf) || word.conf < minConfidence) {
        return output('clarify', issue(!knownEngine ? 'engine' : Number.isFinite(word.conf) ? 'confidence' : 'metadata', word,
          '다음 질문에 영향을 주는 이 부분이 맞는지 확인해 주세요. 다르면 이 부분만 고쳐 주세요.'));
      }
    }
  }
  return output('auto');
}

/** Apply only the span the user selected. No inferred spelling corrections.
 * Surrounding whitespace/characters stay byte-for-byte in the JS string.
 * Text-only or misaligned replacement metadata remains unknown. */
export function replaceVoiceSpan(original, issue, replacement) {
  const before = typeof original?.text === 'string' ? original.text : '';
  const oldWords = metadata(before, original?.words);
  if (!Number.isInteger(issue?.start) || !Number.isInteger(issue?.end) || issue.start < 0 || issue.end <= issue.start || issue.end > before.length
    || !oldWords.some(word => word.start === issue.start) || !oldWords.some(word => word.end === issue.end)) throw new RangeError('Replacement span must contain complete original words');
  const inserted = typeof replacement === 'string' ? replacement : typeof replacement?.text === 'string' ? replacement.text : '';
  const newWords = metadata(inserted, typeof replacement === 'object' ? replacement?.words : undefined);
  const clean = word => ({ word: word.word, ...(Number.isFinite(word.conf) ? { conf: word.conf } : {}),
    ...(Number.isFinite(word.audioStart) ? { start: word.audioStart } : {}), ...(Number.isFinite(word.audioEnd) ? { end: word.audioEnd } : {}) });
  const words = [...oldWords.filter(word => word.end <= issue.start), ...newWords, ...oldWords.filter(word => word.start >= issue.end)].map(clean);
  const text = before.slice(0, issue.start) + inserted + before.slice(issue.end);
  const engine = typeof replacement === 'object' && replacement?.engine && replacement.engine !== original?.engine ? 'mixed' : original?.engine;
  const known = words.filter(word => Number.isFinite(word.conf));
  return { text, words, ...(typeof engine === 'string' ? { engine } : {}),
    ...(known.length ? { confidence: known.reduce((sum, word) => sum + word.conf, 0) / known.length } : {}),
    confidenceCoverage: words.length ? known.length / words.length : 0,
    ...(original?.truncated || typeof replacement === 'object' && replacement?.truncated ? { truncated: true } : {}) };
}

/** Keep only exact user confirmations outside an explicitly replaced word span.
 * Offsets are JS string offsets, like issue/confirmedSpans; no text is inferred.
 * Validate both versions so stale or partial-word approvals cannot migrate to
 * another word after an edit. Overlapping approvals must be obtained again. */
export function rebaseConfirmedSpans(originalText, issue, replacementText, confirmedSpans = []) {
  if (typeof originalText !== 'string' || typeof replacementText !== 'string') throw new TypeError('Confirmation rebasing requires exact text');
  const oldWords = tokens(originalText);
  const completeRange = (text, words, span) => Number.isInteger(span?.start) && Number.isInteger(span?.end)
    && span.start >= 0 && span.end > span.start && span.end <= text.length
    && words.some(word => word.start === span.start) && words.some(word => word.end === span.end);
  if (!completeRange(originalText, oldWords, issue)) throw new RangeError('Replacement span must contain complete original words');
  const updatedText = originalText.slice(0, issue.start) + replacementText + originalText.slice(issue.end);
  const updatedWords = tokens(updatedText);
  const delta = replacementText.length - (issue.end - issue.start);
  const kept = [];
  for (const span of Array.isArray(confirmedSpans) ? confirmedSpans : []) {
    if (!completeRange(originalText, oldWords, span) || typeof span.text !== 'string' || originalText.slice(span.start, span.end) !== span.text) continue;
    if (span.end > issue.start && span.start < issue.end) continue;
    const shift = span.start >= issue.end ? delta : 0;
    const moved = { start: span.start + shift, end: span.end + shift, text: span.text };
    if (completeRange(updatedText, updatedWords, moved) && updatedText.slice(moved.start, moved.end) === moved.text) kept.push(moved);
  }
  return kept;
}
