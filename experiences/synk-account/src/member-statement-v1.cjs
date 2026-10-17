'use strict';
// SYNK Account's bounded Korean statement vocabulary. This is a product adapter,
// not a general language interpreter. Only a complete supported clause becomes
// a proposal; an unrecognized/uncertain clause stays visible and unapplied.
const PARSER_VERSION = 'member-statement-ko-1';
const MEMBER_STATEMENT_LIMITS = Object.freeze({ text: 500, statements: 20, meanings: 8, unresolved: 12 });
const VALUES = Object.freeze({
  support: Object.freeze(['independent', 'example', 'step', 'choose', 'together']),
  explanation: Object.freeze(['brief', 'standard', 'detailed']),
  'practice-mode': Object.freeze(['listening', 'reading', 'mixed']),
  topic: Object.freeze(['travel-planning', 'travel-food', 'travel-stay', 'career-interview', 'career-planning', 'content-video', 'content-design', 'ai-tools', 'work-collaboration']),
});
const LABELS = Object.freeze({ independent: '혼자 시도하기', example: '예시를 먼저 보기', step: '단계별 도움', choose: '필요할 때 도움 선택', together: '함께 하기',
  brief: '짧은 설명', standard: '보통 길이의 설명', detailed: '자세한 설명', listening: '듣기 연습', reading: '읽기 연습', mixed: '듣기와 읽기를 함께',
  'travel-planning': '여행 일정·동선', 'travel-food': '여행지 음식·주문', 'travel-stay': '여행지 숙소', 'career-interview': '면접 준비', 'career-planning': '진로 탐색',
  'content-video': '영상 제작', 'content-design': '디자인 제작', 'ai-tools': 'AI 도구 활용', 'work-collaboration': '업무 협업' });
const CONDITIONS = Object.freeze({ 'first-try': '처음 시도할 때', familiar: '익숙한 내용일 때', busy: '바쁠 때' });
const REASONS = Object.freeze({ other: '다른 사람의 이야기여서 본인의 선호로 사용하지 않아요.', past: '과거의 설명을 현재 선호로 바꾸지 않았어요.',
  hypothetical: '가정한 내용을 현재 선호로 사용하지 않아요.', uncertain: '확실하지 않은 뜻은 확인 가능한 선호로 정하지 않았어요.',
  quotation: '인용된 말의 주체와 뜻을 분명하게 확인하지 못했어요.', condition: '이 조건의 범위를 정확히 이해하지 못했어요.',
  unsupported: '이 문장의 뜻을 현재 지원하는 항목으로 정확히 옮기지 못했어요.', limit: '이번에 확인할 수 있는 범위를 넘어 남겨 두었어요.', duplicate: '같은 뜻이 앞의 제안에 이미 포함되어 있어요.' });
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const data = (x, key) => { const d = Object.getOwnPropertyDescriptor(x, key);return d?.enumerable === true && Object.hasOwn(d, 'value'); };
const exact = (x, fields) => plain(x) && Reflect.ownKeys(x).length === fields.length && fields.every(key => data(x, key));
const list = (x, max) => Array.isArray(x) && x.length <= max && Reflect.ownKeys(x).length === x.length + 1 && Array.from({ length: x.length }, (_, i) => data(x, String(i))).every(Boolean);
const fail = () => { throw new TypeError('Member statement: invalid confirmed statement'); };
const literal = x => typeof x === 'string' && x.trim() && [...x].length <= MEMBER_STATEMENT_LIMITS.text && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDFFF]/u.test(x);
const instant = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x ? Date.parse(x) : fail();
const semanticKey = m => [m.field, m.value, m.polarity, m.condition || 'general'].join(':');
function clauses(text) {
  const result = [], separators = /\s+(?:하지만|그런데|그리고|반면에)\s+|(?:지만|는데)(?=\s)|[.!?;\n]+/g;let start = 0, match;
  function push(end) { while (start < end && /\s/u.test(text[start])) start++;while (end > start && /\s/u.test(text[end - 1])) end--;if (end > start) result.push({ start, end, quote: text.slice(start, end) }); }
  while ((match = separators.exec(text))) { push(match.index + (/^(?:지만|는데)$/.test(match[0]) ? match[0].length : 0));start = match.index + match[0].length; }
  push(text.length);return result;
}
const SUBJECTS = [
  ['support', 'independent', /^(?:혼자(?:서)?(?:하는|해보는|시도하는|시도해보는)?(?:게|것(?:이|은|을)?|걸|건|하기|하길)?)/],
  ['support', 'together', /^(?:같이|함께)(?:하는|해보는|시도하는)?(?:게|것(?:이|은|을)?|걸|건|하기|하길)?/],
  ['support', 'example', /^(?:예시|예제)(?:를|가|는|부터|먼저)?(?:보는(?:게|것)?|보여주는(?:게|것)?)?/],
  ['support', 'step', /^(?:단계별(?:로)?(?:도움|안내|설명)?|차근차근(?:한)?(?:도움|안내|설명)?)/],
  ['support', 'choose', /^필요할때(?:만)?(?:도움(?:을)?(?:받는(?:게|것)?|선택하는(?:게|것)?)?)/],
  ['explanation', 'brief', /^(?:(?:설명(?:은|을)?)?(?:짧게|간단하게)(?:설명(?:하는|해주는)(?:게|것)?)?|(?:짧은|간단한)설명)/],
  ['explanation', 'detailed', /^(?:(?:설명(?:은|을)?)?(?:자세히|길게)(?:설명(?:하는|해주는)(?:게|것)?)?|(?:자세한|긴)설명)/],
  ['explanation', 'standard', /^(?:보통길이(?:의)?설명)/],
  ['practice-mode', 'mixed', /^(?:듣기와읽기(?:를)?함께(?:하는게)?)/],
  ['practice-mode', 'listening', /^(?:듣기(?:연습)?|듣는연습)/], ['practice-mode', 'reading', /^(?:읽기(?:연습)?|읽는연습)/],
  ['topic', 'travel-planning', /^(?:여행일정(?:짜기)?|여행동선|여행계획)/], ['topic', 'travel-food', /^(?:여행지음식|현지음식|음식주문)/],
  ['topic', 'travel-stay', /^(?:여행지숙소|여행숙소)/], ['topic', 'career-interview', /^(?:면접준비|면접)/], ['topic', 'career-planning', /^(?:진로탐색|진로계획)/],
  ['topic', 'content-video', /^(?:영상제작|영상만들기|동영상제작)/], ['topic', 'content-design', /^(?:디자인제작|디자인)/],
  ['topic', 'ai-tools', /^(?:AI도구(?:활용)?|인공지능도구(?:활용)?)/i], ['topic', 'work-collaboration', /^(?:업무협업|업무에서협업)/],
];
const positive = /^(?:좋(?:아(?:해(?:요)?|요)?|다|습니다)?|선호(?:해(?:요)?|한다|합니다)|원(?:해(?:요)?|한다|합니다)|필요(?:해(?:요)?|하다|합니다)|(?:하고|받고|보고)싶(?:어(?:요)?|다)|관심(?:이)?있(?:어(?:요)?|다|습니다)|해줘(?:요)?|보고싶(?:어(?:요)?|다))$/;
const negative = /^(?:싫(?:어(?:요)?|다|습니다)|좋(?:아하지|지는?|아하진)않(?:아(?:요)?|다|습니다)|선호하지않(?:아(?:요)?|는다|습니다)|원하지않(?:아(?:요)?|는다|습니다)|필요(?:가)?없(?:어(?:요)?|다|습니다)|필요하지않(?:아(?:요)?|다|습니다)|관심(?:이)?없(?:어(?:요)?|다|습니다))$/;
function recognize(evidence) {
  let body = evidence.quote.replace(/\s/gu, '').replace(/(?:지만|는데)$/, '');
  if (/["“”‘’]/u.test(body) || /(?:라고|다고)(?:했|말|들)/u.test(body)) return { reason: 'quotation' };
  if (/^(?:(?:내|제)?(?:친구|동료|엄마|아빠|어머니|아버지)|그사람|다른사람|그녀|그|너|당신)(?:은|는|이|가)/u.test(body)) return { reason: 'other' };
  if (/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|싫지않|없지않|않지는않)/u.test(body)) return { reason: 'uncertain' };
  if (/(?:예전|과거|전에는|좋아했|선호했|필요했|원했|했었)/u.test(body)) return { reason: 'past' };
  body = body.replace(/^(?:저는|나는|난|제가|내가|저|나)(?=.)/u, '').replace(/^(?:요즘(?:은|엔)?|지금(?:은|엔)?|현재(?:는)?|평소(?:에는|엔|는)|보통은|일반적으로는)/u, '');
  let condition = null;
  const conditions = [['first-try', /^(?:처음(?:에는|엔|은)|처음(?:시도)?할때(?:는)?|처음시도할때(?:는)?)/], ['familiar', /^(?:익숙할때(?:는)?|익숙한내용일때(?:는)?)/], ['busy', /^(?:바쁠때(?:는)?|시간이없을때(?:는)?)/]];
  for (const [id, pattern] of conditions) if (pattern.test(body)) { condition = id;body = body.replace(pattern, '');break; }
  if (/(?:만약|라면|다면|으면|한다면|때|땐|바쁠|경우|상황|동안|오늘만|내일만|이번만|퇴근후|출근전)/u.test(body) && !/^필요할때/u.test(body)) return { reason: /(?:만약|라면|다면|으면)/u.test(body) ? 'hypothetical' : 'condition' };
  for (const [field, value, pattern] of SUBJECTS) {
    const match = pattern.exec(body);if (!match) continue;
    let predicate = body.slice(match[0].length).replace(/^(?:을|를|이|가|은|는|에|엔)/u, '');
    if (/(?:지만|는데)$/u.test(evidence.quote)) predicate = predicate.replace(/^(필요|선호|원)하$/u, '$1해');
    const polarity = negative.test(predicate) ? 'avoid' : positive.test(predicate) ? 'prefer' : null;
    if (polarity) return { field, value, polarity, condition };
  }
  return { reason: condition ? 'condition' : 'unsupported' };
}
function parseMemberStatement(text) {
  if (!literal(text)) fail();const meanings = [], unresolved = [], seen = new Set(), pieces = clauses(text);let inherited = null, priorCondition = false, stopped = false;
  function unresolvedPiece(evidence, reason) {
    if (unresolved.length === MEMBER_STATEMENT_LIMITS.unresolved - 1 && evidence !== pieces.at(-1)) {
      unresolved.push({ start: evidence.start, end: text.length, quote: text.slice(evidence.start), reason: 'limit', reasonLabel: REASONS.limit });stopped = true;
    } else unresolved.push({ ...evidence, reason, reasonLabel: REASONS[reason] });
  }
  for (let cursor = 0; cursor < pieces.length && !stopped; cursor++) {
    const evidence = pieces[cursor];
    const compact = evidence.quote.replace(/\s/gu, '');
    if (inherited === 'other' && /^(?:나는|난|저는|제가|내가)/u.test(compact)) inherited = null;
    if (inherited === 'past' && /^(?:(?:나는|난|저는|제가|내가))?(?:지금|요즘|현재)/u.test(compact)) inherited = null;
    if (inherited === 'condition' && /^(?:(?:나는|난|저는|제가|내가))?(?:평소|보통은|일반적으로)/u.test(compact)) inherited = null;
    const result = inherited ? { reason: inherited } : recognize(evidence);
    if (priorCondition && !result.reason && !result.condition && !/^(?:(?:나는|난|저는|제가|내가))?(?:평소|보통은|일반적으로)/u.test(compact)) {
      unresolvedPiece(evidence, 'condition');priorCondition = /(?:지만|는데)$/u.test(compact);continue;
    }
    priorCondition = !!result.condition && /(?:지만|는데)$/u.test(compact);
    if (['other', 'past', 'hypothetical', 'condition', 'uncertain', 'quotation'].includes(result.reason)) inherited = result.reason;
    if (result.reason) { unresolvedPiece(evidence, result.reason);continue; }
    if (meanings.length >= MEMBER_STATEMENT_LIMITS.meanings) { unresolvedPiece(evidence, 'limit');continue; }
    const key = semanticKey(result);if (seen.has(key)) { unresolvedPiece(evidence, 'duplicate');continue; }seen.add(key);
    meanings.push({ id: 'p' + meanings.length, ...result, evidence });
  }
  return { parserVersion: PARSER_VERSION, meanings, unresolved };
}
function meaningsConflict(a, b) {
  if (a.field !== b.field || a.condition !== b.condition) return false;
  if (a.value === b.value) return a.polarity !== b.polarity;
  return a.field !== 'topic' && a.polarity === 'prefer' && b.polarity === 'prefer';
}
function meaningLabel(m) { return `${m.condition ? CONDITIONS[m.condition] + ' · ' : ''}${m.polarity === 'avoid' ? '선호하지 않는 내용' : '원하는 내용'}: ${LABELS[m.value]}`; }
function validateMemberStatement(row, { now = Date.now(), enforceTime = false } = {}) {
  if (!exact(row, ['id', 'parserVersion', 'text', 'at', 'confirmedAt', 'meanings']) || typeof row.id !== 'string'
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.id)
    || row.parserVersion !== PARSER_VERSION || !literal(row.text) || !list(row.meanings, MEMBER_STATEMENT_LIMITS.meanings) || !row.meanings.length) fail();
  const at = instant(row.at), confirmed = instant(row.confirmedAt), cutoff = enforceTime ? typeof now === 'string' ? instant(now) : Number.isSafeInteger(now) ? now : fail() : null;
  if (confirmed < at || enforceTime && confirmed > cutoff) fail();
  const parsed = parseMemberStatement(row.text), ids = new Set(), meanings = row.meanings.map(m => {
    if (!exact(m, ['id', 'field', 'value', 'polarity', 'condition', 'evidence']) || !exact(m.evidence, ['start', 'end', 'quote']) || ids.has(m.id)) fail();
    ids.add(m.id);const expected = parsed.meanings.find(x => x.id === m.id);if (!expected) fail();
    for (const field of ['field', 'value', 'polarity', 'condition']) if (m[field] !== expected[field]) fail();
    for (const field of ['start', 'end', 'quote']) if (m.evidence[field] !== expected.evidence[field]) fail();
    return { id: expected.id, field: expected.field, value: expected.value, polarity: expected.polarity, condition: expected.condition, evidence: { ...expected.evidence } };
  }).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  if (meanings.some((a, i) => meanings.slice(i + 1).some(b => meaningsConflict(a, b)))) fail();
  return { id: row.id.toLowerCase(), parserVersion: PARSER_VERSION, text: row.text, at: row.at, confirmedAt: row.confirmedAt, meanings };
}
module.exports = { PARSER_VERSION, MEMBER_STATEMENT_LIMITS, MEMBER_STATEMENT_VALUES: VALUES, MEMBER_STATEMENT_LABELS: LABELS, MEMBER_STATEMENT_CONDITIONS: CONDITIONS,
  parseMemberStatement, validateMemberStatement, meaningsConflict, meaningLabel };
