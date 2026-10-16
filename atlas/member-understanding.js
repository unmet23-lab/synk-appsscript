'use strict';
// A SYNK product adapter of Core's existing interpretation/domain capabilities.
// It consumes authorized aggregates only. Trail owns the facts, Strata owns the
// labels, Vellum owns the explanation, and the host owns identity/consent/storage.
const Interpretation = require('./interpretation');
const Domain = require('./domain');
const Contract = require('./member-understanding-contract');
const { memberUnderstandingLine, memberUnderstandingSummary, memberUnderstandingNote, memberUnderstandingActivityReason } = require('./vellum');
const Periods = require('./trail-periods');
const Statements = require('../experiences/synk-account/src/member-statement.cjs');
const { understandingFacet, validateUnderstandingClaim, validateUnderstandingValues } = Contract;
const SCOPE = Object.freeze({ domain: 'SYNK', workspace: 'member-understanding', subject: 'authorized-member' });
const REASONS = Object.freeze({ culture: '한국 문화', travel: '여행', people: '사람들과 대화', life: '한국 생활', study: '학업', work: '일', career: '진로', exam: '시험', hobby: '취미', other: '다른 이유' });
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const exact = (x, fields) => plain(x) && Reflect.ownKeys(x).length === fields.length && fields.every(key => {
  const field = Object.getOwnPropertyDescriptor(x, key); return field?.enumerable === true && Object.hasOwn(field, 'value');
});
const copy = x => JSON.parse(JSON.stringify(x));
const fail = () => { throw new TypeError('Member understanding: invalid authorized input'); };
const canonical = x => JSON.stringify(x, (_k, v) => plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const integer = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
const safeText = (s, max = 160) => typeof s === 'string' && s.trim() && [...s].length <= max && !/[\u0000-\u001f\u007f]/.test(s);
const semantic = c => canonical(Object.fromEntries(['version', 'kind', 'source', 'generation', 'reference', 'value'].map(key => [key, c[key]])));
function documentOf(document, asOf) {
  if (document == null) return { version: 1, reviews: [], overrides: [] };
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(document.version) || !exact(document, document.version >= 2 ? ['version', 'reviews', 'overrides', 'statements'] : ['version', 'reviews', 'overrides'])) fail();
  const ids = new Set();
  for (const [key, fields] of [['reviews', ['id', 'facetId', 'verdict', 'claim', 'note', 'at']], ['overrides', ['id', 'facetId', 'values', 'note', 'at']]]) {
    if (!Array.isArray(document[key]) || document[key].length > 50) fail();
    const facets = new Set();
    for (const row of document[key]) {
      if (!exact(row, fields) || typeof row.id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(row.id) || ids.has(row.id)
        || facets.has(row.facetId) || typeof row.note !== 'string' || [...row.note].length > 200
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|[\uD800-\uDFFF]/u.test(row.note)
        || Periods.instant(row.at) > Periods.instant(asOf)) fail();
      understandingFacet(row.facetId); ids.add(row.id); facets.add(row.facetId);
      if (key === 'reviews') {
        if (!['agree', 'disagree', 'contextual'].includes(row.verdict)) fail();
        validateUnderstandingClaim(row.claim, { facetId: row.facetId });
        if (Date.parse(row.claim.to) > Date.parse(row.at)) fail();
      } else validateUnderstandingValues(row.facetId, row.values);
    }
  }
  if (document.version >= 2) {
    if (!Array.isArray(document.statements) || document.statements.length > 20) fail();
    for (const row of document.statements) {
      const checked = Statements.validateMemberStatement(row, { now: asOf, enforceTime: true });
      if (ids.has(checked.id) || document.version === 2 && checked.parserVersion !== 'member-statement-ko-1'
        || document.version === 3 && !['member-statement-ko-1', 'member-statement-ko-2'].includes(checked.parserVersion)
        || document.version === 4 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3'].includes(checked.parserVersion)
        || document.version === 5 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4'].includes(checked.parserVersion)
        || document.version === 6 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4', 'member-statement-ko-5'].includes(checked.parserVersion)
        || document.version === 7 && !['member-statement-ko-1', 'member-statement-ko-2', 'member-statement-ko-3', 'member-statement-ko-4', 'member-statement-ko-5', 'member-statement-ko-6'].includes(checked.parserVersion)) fail();
      ids.add(checked.id);
    }
  }
  return copy(document);
}
function coreContract(values) {
  return { id: 'member-understanding', version: '1', purpose: 'member-self-understanding',
    fields: [{ id: 'meaning', kind: 'enum', values, maxAgeDays: 30 }], criteria: [] };
}
// The internal source text is a deterministic serialization of allowed metadata,
// not a quote from an app, note or customer message. Core still validates exact
// provenance, review chronology and basis, rather than a second review algorithm.
function reviewedMeaning(review, current, asOf) {
  if (!review || !current || semantic(review.claim) !== semantic(current)) return null;
  if (Date.parse(review.at) - Date.parse(review.claim.to) >= 30 * 86400000) return null;
  const sourceText = canonical(review.claim);
  const packet = { contract: coreContract(['interested', 'fits', 'contextual']), scope: SCOPE,
    sources: [{ id: 'aggregate', scope: SCOPE, at: review.claim.to, text: sourceText, actor: 'self' }],
    proposals: [{ id: 'interpretation', field: 'meaning', value: review.claim.value, subject: 'self', stance: 'current',
      evidence: [{ sourceId: 'aggregate', start: 0, end: sourceText.length, quote: sourceText }] }], reviews: [], at: review.at };
  const action = review.verdict === 'agree' ? 'confirm' : review.verdict === 'disagree' ? 'reject' : 'correct';
  const event = Interpretation.review({ ...packet, id: review.id, proposalId: 'interpretation', action, ...(action === 'correct' ? { value: 'contextual' } : {}) });
  const resolved = Interpretation.resolve({ ...packet, at: asOf, reviews: [event] });
  const state = resolved.understanding.fields.find(field => field.id === 'meaning');
  // A rejected interpretation stays rejected while this exact semantic claim is
  // current; an expired confirmation never silently becomes a fresh declaration.
  if (review.verdict === 'disagree') return { verdict: review.verdict, at: review.at, meaning: 'disagreed' };
  return state.usable ? { verdict: review.verdict, at: review.at, meaning: state.value === 'contextual' ? 'contextual' : 'agreed' } : null;
}
function declaredValues(facetId, values, at, asOf) {
  const definition = understandingFacet(facetId);
  validateUnderstandingValues(facetId, values);
  // Direct selections are declarations, with no attempted inference from facts.
  // They remain until explicitly changed/removed by the user (host lifetime).
  const fields = definition.multiple ? definition.choices.map(choice => ({ id: choice.id, kind: 'boolean', maxAgeDays: 36500 }))
    : [{ id: 'selection', kind: 'enum', values: definition.choices.map(choice => choice.id), maxAgeDays: 36500 }];
  const contract = { id: 'member-direct-choice', version: '1', purpose: 'member-self-understanding', fields, criteria: [] };
  const observations = definition.multiple ? fields.map((field, index) => ({ id: `selection-${index}`, field: field.id, value: values.includes(field.id) }))
    : [{ id: 'selection', field: 'selection', value: values[0] }];
  const understanding = Domain.understand({ contract, scope: SCOPE, at: asOf, observations: observations.map(row => ({ ...row, scope: SCOPE,
    contract: { id: contract.id, version: contract.version, purpose: contract.purpose }, source: 'declared', at })) });
  return definition.multiple ? understanding.fields.filter(field => field.usable && field.value === true).map(field => field.id)
    : understanding.fields.filter(field => field.usable).map(field => field.value);
}
function observationsOf(value, asOf) {
  if (value == null) return null;
  if (!exact(value, ['from', 'to', 'total', 'topics', 'modes', 'formats']) || !integer(value.total)
    || Periods.instant(value.to) > Periods.instant(asOf) || Periods.instant(value.to) - Periods.instant(value.from) !== 30 * 86400000) fail();
  for (const [key, limit] of [['topics', 12], ['modes', 2], ['formats', 4]]) {
    if (!Array.isArray(value[key]) || value[key].length > limit) fail();
    const ids = new Set();
    for (const row of value[key]) {
      if (!exact(row, key === 'topics' ? ['id', 'kind', 'label', 'count', 'activeDays', 'lastAt'] : ['id', 'count', 'activeDays', 'lastAt'])
        || !safeText(row.id, 80) || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(row.id) || ids.has(row.id)
        || !integer(row.count) || row.count < 1 || row.count > value.total || !integer(row.activeDays) || row.activeDays < 1 || row.activeDays > Math.min(row.count, 31)
        || !Periods.within(row.lastAt, value)) fail();
      if (key === 'topics' ? !safeText(row.label) || !['situation', 'topic', 'word', 'grammar_point', 'skill', 'concept'].includes(row.kind)
        : !understandingFacet(key === 'modes' ? 'practice-mode' : 'practice-response').choices.some(choice => choice.id === row.id && !['mixed', 'no-fixed-mode', 'no-fixed-format'].includes(choice.id))) fail();
      ids.add(row.id);
    }
  }
  return value;
}
function practiceEvidenceOf(periods, observations, asOf) {
  if (!periods || periods.days !== 30 || !plain(periods.recent)) return null;
  const recent = periods.recent;
  try {
    if (!exact(recent, ['from', 'to', 'answered', 'independent', 'assisted', 'activeDays'])
      || Periods.instant(recent.to) > Periods.instant(asOf) || Periods.instant(recent.to) - Periods.instant(recent.from) !== 30 * 86400000
      || !['answered', 'independent', 'assisted', 'activeDays'].every(key => integer(recent[key]))
      || recent.independent + recent.assisted > recent.answered || recent.activeDays > Math.min(recent.answered, 31)
      || recent.answered > 0 && recent.activeDays === 0
      || observations && (observations.from !== recent.from || observations.to !== recent.to || observations.total !== recent.answered)) return null;
    return { ...recent };
  } catch { return null; }
}
function summarizeMemberUnderstanding({ accountSummary = null, activity = null, document = null, asOf } = {}) {
  Periods.instant(asOf);
  const stored = documentOf(document, asOf);
  let summary = null, learning = false, revision = null;
  if (accountSummary !== null) {
    if (!plain(accountSummary) || accountSummary.ok !== true || accountSummary.scope !== 'synk-atlas-summary'
      || !plain(accountSummary.learning) || typeof accountSummary.learning.enabled !== 'boolean' || !Number.isSafeInteger(accountSummary.learning.revision)
      || accountSummary.learning.revision < 0 || !['practice-and-settings', 'declared-only'].includes(accountSummary.shared)
      || !plain(accountSummary.summary) || accountSummary.summary.version !== 'atlas-account-summary-1') fail();
    summary = accountSummary.summary; revision = accountSummary.learning.revision;
    if (Periods.instant(new Date(summary.asOf).toISOString()) > Periods.instant(asOf)) fail();
    learning = accountSummary.learning.enabled && accountSummary.shared === 'practice-and-settings';
  }
  const observations = learning ? observationsOf(summary.practice?.observations, asOf) : null;
  const usage = activity !== null && ['ready', 'empty'].includes(activity.availability);
  if (activity !== null && (!plain(activity) || !['ready', 'empty', 'disabled'].includes(activity.availability))) fail();
  if (usage && (!Array.isArray(activity.interests) || activity.interests.length > 4 || Periods.instant(activity.enabledAt) > Periods.instant(asOf))) fail();
  const overrides = new Map(stored.overrides.map(row => [row.facetId, row]));
  const reviews = new Map(stored.reviews.map(row => [row.facetId, row]));
  const facets = [], appliedAt = new Map();
  function add(id, { label = null, claim = null, available = true, declared = null } = {}) {
    const definition = understandingFacet(id), kind = claim?.kind || id;
    if (claim) validateUnderstandingClaim(claim, { facetId: id });
    const storedOverride = overrides.get(id), activeOverride = available ? storedOverride : null;
    const selected = activeOverride ? declaredValues(id, activeOverride.values, activeOverride.at, asOf) : declared || [];
    const review = available ? reviewedMeaning(reviews.get(id), claim, asOf) : null;
    const selectedLabels = definition.choices.filter(choice => selected.includes(choice.id)).map(choice => choice.label);
    const evidenceLine = claim ? memberUnderstandingLine({ kind, label, count: claim.count, activeDays: claim.activeDays, periodEnd: claim.to }) : '';
    let line, basis = 'empty';
    if (!available) line = memberUnderstandingLine({ label: '', state: 'disabled' });
    else if (selectedLabels.length) { line = memberUnderstandingLine({ kind, label: kind === 'learning-topic' ? label : selectedLabels.join(' · '), selection: selected[0], state: 'declared' }); basis = 'self-declared'; }
    else if (claim) { line = memberUnderstandingLine({ kind, label, count: claim.count, activeDays: claim.activeDays, state: review?.meaning || 'observed', periodEnd: claim.to }); basis = review && review.meaning !== 'disagreed' ? 'self-declared' : 'observed'; }
    else line = id === 'topics' ? '관심 있는 구체적인 주제를 직접 골라 두면 다음 요약에 반영해요.'
      : ['support', 'explanation'].includes(id) ? '현재 원하는 방식을 직접 고를 수 있어요.' : memberUnderstandingLine({ label: '', state: 'empty' });
    const applied = activeOverride && selected.length ? activeOverride : review ? reviews.get(id) : null;
    if (available && applied) {
      appliedAt.set(id, applied.at);
      line = memberUnderstandingNote({ line, note: applied.note });
    }
    facets.push({ id, title: id.startsWith('learning-topic:') ? label : definition.title, line, basis, claim: available ? claim : null,
      evidenceLine, choices: copy(definition.choices), multiple: definition.multiple, selected,
      review: review ? { verdict: review.verdict, at: review.at } : null,
      override: activeOverride ? { values: [...activeOverride.values], at: activeOverride.at } : null, available });
  }
  add('topics');
  for (const id of ['support', 'explanation']) {
    const value = learning ? summary.presentation?.[id] : null;
    if (value != null) validateUnderstandingValues(id, [value]);
    add(id, { declared: value == null ? null : [value] });
  }
  const makeClaim = (kind, row, period, total) => ({ version: 1, kind, source: kind === 'usage-repeat' ? 'usage' : 'learning',
    generation: kind === 'usage-repeat' ? activity.enabledAt : revision, reference: row.id, value: kind === 'learning-topic' ? 'interested' : 'fits',
    from: period.from, to: period.to, count: row.count, total, activeDays: row.activeDays, lastAt: row.lastAt });
  const repeated = rows => [...rows].filter(row => row.count >= 3 && row.activeDays >= 3).sort((a, b) => b.activeDays - a.activeDays || b.count - a.count || a.id.localeCompare(b.id))[0];
  let opening = null;
  if (usage) {
    const rows = activity.interests.map(row => ({ id: row.id, count: row.recentCount, activeDays: row.recentActiveDays ?? 0, lastAt: row.lastAt }));
    opening = repeated(rows);
    if (opening) validateUnderstandingValues('usage-repeat', [opening.id]);
  }
  add('usage-repeat', { available: usage, ...(opening ? { label: understandingFacet('usage-repeat').choices.find(choice => choice.id === opening.id).label,
    claim: makeClaim('usage-repeat', opening, activity.periods.recent, activity.periods.recent.observations) } : {}) });
  for (const [id, key] of [['practice-mode', 'modes'], ['practice-response', 'formats']]) {
    const row = repeated(observations?.[key] || []);
    add(id, { available: learning, ...(row ? { label: understandingFacet(id).choices.find(choice => choice.id === row.id).label,
      claim: makeClaim(id, row, observations, observations.total) } : {}) });
  }
  for (const row of observations?.topics.slice(0, 4) || []) add(`learning-topic:${row.id}`, { label: row.label,
    claim: makeClaim('learning-topic', row, observations, observations.total) });
  const byFacet = new Map(facets.map(facet => [facet.id, facet]));
  const history = [...stored.reviews.map(row => ({ kind: 'review', id: row.id, facetId: row.facetId,
    title: byFacet.get(row.facetId)?.title || understandingFacet(row.facetId).title,
    line: ({ agree: '이 설명이 맞다고 확인했어요.', disagree: '이 설명을 자신의 관심이나 선호로 보지 않기로 했어요.', contextual: '상황에 따라 다르다고 알려 줬어요.' })[row.verdict], note: row.note, at: row.at })),
  ...stored.overrides.map(row => ({ kind: 'override', id: row.id, facetId: row.facetId,
    title: byFacet.get(row.facetId)?.title || understandingFacet(row.facetId).title,
    line: `직접 선택: ${understandingFacet(row.facetId).choices.filter(choice => row.values.includes(choice.id)).map(choice => choice.label).join(' · ')}`, note: row.note, at: row.at }))]
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  const paragraphs = [], included = new Set();
  const addParagraph = facet => {
    if (paragraphs.length < 4 && !included.has(facet.id)) { paragraphs.push(facet.line); included.add(facet.id); }
  };
  // A newly saved correction must be visible on reopening even when older
  // topics/reasons/settings already fill the short synthesis. This is recency
  // of explicit feedback, never a new preference score or inferred trait.
  const readable = facets.filter(facet => facet.available && (facet.claim || facet.selected.length));
  const recentFeedback = readable.filter(facet => appliedAt.has(facet.id))
    .sort((a, b) => appliedAt.get(b.id).localeCompare(appliedAt.get(a.id)));
  for (const facet of recentFeedback) addParagraph(facet);
  const topics = facets.find(facet => facet.id === 'topics');
  if (topics.selected.length) addParagraph(topics);
  if (summary?.reasons?.length) {
    if (!Array.isArray(summary.reasons) || summary.reasons.some(reason => !Object.hasOwn(REASONS, reason))) fail();
    if (paragraphs.length < 4) paragraphs.push(`한국어를 배우는 이유로 ${summary.reasons.map(reason => REASONS[reason]).join(' · ')} 항목을 직접 골랐어요. 이 선택을 다른 분야의 관심으로 넓혀 해석하지 않아요.`);
  }
  // Practice taxonomy remains in the detailed evidence. Several grammar labels
  // from one answer must not fill the overview as if they describe a person.
  const rest = facets.filter(facet => facet.id !== 'topics' && facet.available && facet.basis === 'self-declared');
  for (const facet of rest) addParagraph(facet);
  const targetLabels = { world: 'WORLD에서 연습 고르기', path: 'PATH 열기', pulse: 'PULSE 열기', messenger: '워크스페이스 열기' };
  const activityCandidates = [];
  const offer = (targetId, kind, labels, at) => activityCandidates.push({ targetId, label: targetLabels[targetId],
    reason: memberUnderstandingActivityReason({ kind, labels }), basis: 'self-declared', at });
  if (topics.override) {
    for (const [target, ids] of [['path', ['career-interview', 'career-planning']], ['pulse', ['content-video', 'content-design']], ['messenger', ['work-collaboration']]]) {
      const labels = topics.choices.filter(choice => ids.includes(choice.id) && topics.selected.includes(choice.id)).map(choice => choice.label);
      if (labels.length) offer(target, 'topic', labels, topics.override.at);
    }
  }
  const app = byFacet.get('usage-repeat');
  if (app.available && app.override && Object.hasOwn(targetLabels, app.selected[0])) offer(app.selected[0], 'app',
    [app.choices.find(choice => choice.id === app.selected[0]).label], app.override.at);
  for (const facet of facets.filter(facet => facet.id.startsWith('learning-topic:') && facet.available && facet.claim)) {
    const interest = facet.override ? facet.selected.includes('interested') : facet.review?.verdict === 'agree';
    if (interest) offer('world', 'learning', [facet.title], appliedAt.get(facet.id));
  }
  const targets = new Set();
  const activities = activityCandidates.sort((a, b) => b.at.localeCompare(a.at)).filter(row => {
    if (targets.has(row.targetId)) return false;
    targets.add(row.targetId); return true;
  }).slice(0, 3).map(({ at, ...row }) => row);
  const synthesis = Statements.summarizeStatementRelations({ document: stored, facets, summary, activity, learning, asOf });
  const originalFacetLines = new Map(facets.map(facet => [facet.id, facet.line]));
  const originalTopics = [...facets.find(facet => facet.id === 'topics').selected];
  const spokenFields = new Set(synthesis.active.filter(row => row.condition === null).map(row => row.field === 'topic' ? 'topics' : row.field));
  for (const facet of facets) {
    const meanings = synthesis.active.filter(row => row.condition === null && (row.field === 'topic' ? 'topics' : row.field) === facet.id);
    if (!meanings.length) continue;
    const positives = meanings.filter(row => row.polarity === 'prefer'), choices = positives.map(row => row.value).filter(value => facet.choices.some(choice => choice.id === value));
    const kept = facet.selected.filter(value => !meanings.some(row => row.value === value && row.polarity === 'avoid'));
    facet.line = meanings.map(row => `직접 확인한 내용은 ‘${Statements.meaningLabel(row)}’예요.`).join(' ');
    if (facet.id === 'topics') choices.splice(0, choices.length, ...new Set([...kept, ...choices]));
    else if (!positives.length) choices.push(...kept);
    choices.splice(understandingFacet(facet.id).max);
    facet.basis = 'self-declared';facet.selected = choices;facet.available = true;
  }
  const suppressed = new Set([...spokenFields, ...synthesis.coveredFacets].map(id => originalFacetLines.get(id)));
  const hasDeclaration = synthesis.active.length > 0 || facets.some(facet => facet.available
    && (facet.selected.length > 0 || facet.review?.verdict === 'agree')) || !!summary?.reasons?.length;
  const overview = memberUnderstandingSummary({ hasDeclaration, hasFeedback: appliedAt.size > 0,
    practice: learning ? practiceEvidenceOf(summary.practice?.periods, observations, asOf) : null,
    learning: learning ? 'ready' : accountSummary !== null ? 'disabled' : 'unavailable',
    usage: usage ? 'ready' : activity?.availability === 'disabled' ? 'disabled' : 'unavailable',
    learningAt: learning ? summary.asOf : null, usageAt: usage ? activity.periods?.recent?.to : null });
  const primary = [...new Set([...synthesis.paragraphs, ...paragraphs.filter(line => !suppressed.has(line))])];
  const finalParagraphs = primary.slice(0, overview.scope ? 3 : 4);
  if (!hasDeclaration && overview.opening && finalParagraphs.length < 3) finalParagraphs.push(overview.opening);
  if (overview.observation && finalParagraphs.length < (overview.scope ? 3 : 4)) finalParagraphs.push(overview.observation);
  if (!hasDeclaration && opening && finalParagraphs.length < (overview.scope ? 3 : 4)) finalParagraphs.push(byFacet.get('usage-repeat').line);
  if (overview.scope) finalParagraphs.push(overview.scope);
  // Only a confirmed, unconditional interest links to a product. Negation and
  // conditional text never silently become a general recommendation.
  const statementTargets = { 'career-interview': 'path', 'career-planning': 'path', 'content-video': 'pulse', 'content-design': 'pulse', 'work-collaboration': 'messenger' };
  const textActivities = [];
  for (const row of synthesis.active.filter(row => row.field === 'topic' && row.polarity === 'prefer' && row.condition === null)) {
    const targetId = statementTargets[row.value];if (!targetId || textActivities.some(a => a.targetId === targetId)) continue;
    textActivities.push({ targetId, label: targetLabels[targetId], reason: memberUnderstandingActivityReason({ kind: 'topic', labels: [Statements.MEMBER_STATEMENT_LABELS[row.value]] }), basis: 'self-declared' });
  }
  const originalTopicTargets = new Set(originalTopics.map(id => statementTargets[id]).filter(Boolean));
  const currentTopicTargets = new Set(facets.find(f => f.id === 'topics').selected.map(id => statementTargets[id]).filter(Boolean));
  const appTarget = app.available && app.override ? app.selected[0] : null;
  const finalActivities = [...textActivities, ...activities.filter(row => !textActivities.some(a => a.targetId === row.targetId)
    && (!spokenFields.has('topics') || !originalTopicTargets.has(row.targetId) || currentTopicTargets.has(row.targetId) || appTarget === row.targetId))].slice(0, 3);
  return { version: 1, headline: overview.headline, paragraphs: finalParagraphs, facets, history, activities: finalActivities,
    relations: synthesis.relations, statementHistory: synthesis.statementHistory,
    limitations: ['앱을 연 사실에서 구체적인 취향이나 활동 완료를 추측하지 않아요.', '학습에서 다룬 내용과 직접 밝힌 관심을 구분해요. 성격·실력·학습 효과를 단정하지 않아요.',
      '확인과 수정은 언제든 지울 수 있어요. 원래의 관찰 횟수는 바꾸지 않으며 연결이 꺼진 자료는 다음 설명에 사용하지 않아요.'] };
}
module.exports = { ...Contract, previewMemberStatement: Statements.previewMemberStatement, confirmMemberStatement: Statements.confirmMemberStatement,
  validateMemberStatement: Statements.validateMemberStatement, summarizeMemberUnderstanding };
