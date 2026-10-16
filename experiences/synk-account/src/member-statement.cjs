'use strict';
// Account-only language and synthesis adapter. Common Core owns quotation,
// confirmation, freshness, declared evidence and conditional comparison.
const Interpretation = require('../../../atlas/interpretation');
const Domain = require('../../../atlas/domain');
const Conditional = require('../../../atlas/conditional-preference');
const Contract = require('./member-statement-contract.cjs');
const { parseMemberStatement, validateMemberStatement, meaningsConflict, meaningLabel, PARSER_VERSION,
  MEMBER_STATEMENT_VALUES: VALUES, MEMBER_STATEMENT_LABELS: LABELS, MEMBER_STATEMENT_CONDITIONS: CONDITIONS } = Contract;
const SCOPE = Object.freeze({ domain: 'SYNK', workspace: 'member-understanding', subject: 'authorized-member' });
const CONDITIONAL_SCOPE = Object.freeze({ personId: 'authorized-member', productId: 'synk-account', contextId: 'member-understanding', domain: 'SYNK' });
const fail = () => { throw new TypeError('Member statement: refresh the interpretation before confirming'); };
const instant = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x ? Date.parse(x) : fail();
const copy = x => JSON.parse(JSON.stringify(x));
const canonical = x => JSON.stringify(x, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
const multi = m => Contract.MEMBER_STATEMENT_MULTI_FIELDS.includes(m.field);
const slot = m => multi(m) ? `declared.${m.field}.${m.value}.${m.condition || 'general'}` : m.field === 'topic' ? `topic.${m.value}.${m.condition || 'general'}`
  : m.polarity === 'avoid' ? `avoid.${m.field}.${m.value}.${m.condition || 'general'}` : `prefer.${m.field}.${m.condition || 'general'}`;
const value = m => multi(m) || m.field === 'topic' ? m.polarity === 'prefer' : m.polarity === 'avoid' ? true : m.value;
const definition = m => multi(m) || m.field === 'topic' || m.polarity === 'avoid' ? { id: slot(m), kind: 'boolean', maxAgeDays: 36500 }
  : { id: slot(m), kind: 'enum', values: [...VALUES[m.field]], maxAgeDays: 36500 };
const domainContract = fields => ({ id: 'member-statement', version: '1', purpose: 'member-self-understanding', fields, criteria: [] });
function packet({ id = 'draft', text, at, clarifications = [], parserVersion = PARSER_VERSION }, asOf, parsed = parseMemberStatement(text, { clarifications, parserVersion })) {
  instant(at);instant(asOf);const fields = new Map(parsed.meanings.map(m => [slot(m), definition(m)]));
  return { contract: domainContract([...fields.values()].length ? [...fields.values()] : [{ id: 'empty', kind: 'boolean', maxAgeDays: 36500 }]), scope: SCOPE,
    sources: [{ id: 's.' + id, scope: SCOPE, at, text, actor: 'self' }], proposals: parsed.meanings.map(m => ({ id: m.id, field: slot(m), value: value(m), subject: 'self', stance: 'current', evidence: [{ sourceId: 's.' + id, ...m.evidence }] })), reviews: [], at: asOf };
}
function previewMemberStatement({ text, document = null, asOf, at = asOf, clarifications = [] } = {}) {
  // Reuse this invocation's parse when building the Core packet. No source or
  // account result is cached across previews or confirmations.
  instant(asOf);if (instant(asOf) < instant(at)) fail();const parsed = parseMemberStatement(text, { clarifications }), p = packet({ text, at, clarifications }, asOf, parsed), prepared = Interpretation.prepare(p);
  const proposals = parsed.meanings.map(m => {
    const state = prepared.proposals.find(row => row.id === m.id), conflict = state.status === 'conflict' || parsed.meanings.some(other => other.id !== m.id && meaningsConflict(m, other));
    return { ...copy(m), summary: meaningLabel(m), status: conflict ? 'conflict' : 'pending', confirmable: state.status !== 'blocked',
      reason: conflict ? 'conflicting-meanings' : null, reasonLabel: conflict ? '같은 상황에서 함께 적용하기 어려운 뜻이에요. 맞는 뜻만 선택해 주세요.' : '' };
  });
  // document is deliberately not scanned for old notes. A new source is only
  // the text just typed into this explicit editor; saved notes remain literals.
  return { version: 1, parserVersion: PARSER_VERSION, text, at, proposals, unresolved: parsed.unresolved,
    question: parsed.question, clarifications: parsed.clarifications, clarificationAnswers: parsed.clarificationAnswers };
}
function replay(row, asOf) {
  const p = packet(row, asOf), accepted = new Set(row.meanings.map(m => m.id)), reviews = [];
  // Non-selected alternatives are explicitly withheld from this confirmation.
  // The immutable source and exact selected subset make replay deterministic.
  for (const proposal of p.proposals.filter(p => !accepted.has(p.id))) reviews.push(Interpretation.review({ ...p, reviews, id: `r.${row.id}.${proposal.id}`, proposalId: proposal.id, action: 'reject', at: row.confirmedAt }));
  for (const meaning of row.meanings) reviews.push(Interpretation.review({ ...p, reviews, id: `r.${row.id}.${meaning.id}`, proposalId: meaning.id, action: 'confirm', at: row.confirmedAt }));
  return Interpretation.resolve({ ...p, reviews });
}
function confirmMemberStatement({ preview, acceptedIds, id, at, clarifications = preview?.clarifications, text = preview?.text } = {}) {
  if (!preview || preview.version !== 1 || preview.parserVersion !== PARSER_VERSION || instant(at) < instant(preview.at)
    || !Array.isArray(acceptedIds) || !acceptedIds.length || acceptedIds.length > 8 || new Set(acceptedIds).size !== acceptedIds.length) fail();
  const fresh = previewMemberStatement({ text: preview.text, asOf: preview.at, clarifications: preview.clarifications });
  if (text !== preview.text || canonical(clarifications) !== canonical(preview.clarifications) || fresh.question || canonical(fresh) !== canonical(preview)
    || acceptedIds.some(id => !fresh.proposals.some(p => p.id === id && p.confirmable))) fail();
  const parsed = parseMemberStatement(preview.text, { clarifications }), row = validateMemberStatement({ id, parserVersion: PARSER_VERSION, text: preview.text, at: preview.at, confirmedAt: at,
    meanings: parsed.meanings.filter(m => acceptedIds.includes(m.id)), clarifications }, { now: at, enforceTime: true });
  const result = replay(row, at);
  if (row.meanings.some(m => !result.understanding.fields.some(field => field.id === slot(m) && field.usable && field.value === value(m)))) fail();
  return row;
}
function explicitSource(entry) { return { eventId: `statement.${entry.row.id}.${entry.meaning.id}`, source: 'explicit', duration: 'ongoing', encounterId: 'member-understanding', at: entry.row.confirmedAt }; }
function resolveMemberStatements(statements = [], asOf) {
  instant(asOf);if (!Array.isArray(statements) || statements.length > 20) fail();
  const ids = new Set(), rows = statements.map(row => { const checked = validateMemberStatement(row, { now: asOf, enforceTime: true });if (ids.has(checked.id)) fail();ids.add(checked.id);return checked; }).sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id));
  const entries = [], fields = new Map(), observations = [];
  for (const row of rows) {
    const resolved = replay(row, asOf);
    for (const meaning of row.meanings) {
      const state = resolved.understanding.fields.find(field => field.id === slot(meaning));
      entries.push({ row, meaning, active: false, verified: !!state?.usable });fields.set(slot(meaning), definition(meaning));
    }
    observations.push(...resolved.observations);
  }
  // Domain resolves each field across confirmations. Equal-time conflicting
  // declarations remain unresolved; an old declaration must not reappear.
  for (const field of fields.values()) {
    let state;
    try { state = Domain.understand({ contract: domainContract([field]), scope: SCOPE, at: asOf, observations: observations.filter(row => row.field === field.id) }).fields[0]; }
    catch (error) { if (!/ambiguous observation order/.test(error.message)) throw error;continue; }
    if (!state.usable) continue;
    const matching = entries.filter(entry => entry.verified && slot(entry.meaning) === field.id && value(entry.meaning) === state.value);
    const latest = matching.at(-1);if (latest) latest.active = true;
  }
  // A later explicit negation suppresses the same old positive declaration;
  // it does not invent a preference for an alternative.
  const currentlyActive = entries.filter(e => e.active);
  for (const entry of currentlyActive.filter(e => e.meaning.field !== 'topic')) {
    const opposite = currentlyActive.filter(e => e.meaning.field === entry.meaning.field && e.meaning.value === entry.meaning.value && e.meaning.condition === entry.meaning.condition && e.meaning.polarity !== entry.meaning.polarity).at(-1);
    if (opposite && opposite.row.confirmedAt >= entry.row.confirmedAt) entry.active = false;
  }
  return { rows, entries };
}
function conditionalPair(base, alternative, current, asOf) {
  const field = alternative.meaning.field, source = explicitSource(base), currentSource = current ? explicitSource(current) : null;
  const contract = { id: 'member-condition', version: '1', purpose: 'member-self-understanding', fields: [
    { id: 'preference', kind: 'enum', values: [...VALUES[field]] }, { id: 'candidate', kind: 'enum', values: [...VALUES[field]] }, { id: 'context', kind: 'enum', values: [...Object.keys(CONDITIONS), 'other'] }], criteria: [] };
  const rule = { version: Conditional.VERSION, id: `condition.${alternative.row.id}.${alternative.meaning.id}`, scope: CONDITIONAL_SCOPE, field: 'preference', feature: 'candidate', primary: base.meaning.value,
    alternative: alternative.meaning.value, when: { field: 'context', value: alternative.meaning.condition }, target: 'baseline', encounterId: 'member-understanding', at: alternative.row.confirmedAt, until: null, source };
  return Conditional.assess({ contract, scope: CONDITIONAL_SCOPE, rule, preference: { value: current?.meaning.value ?? null, source: currentSource, usable: current?.active === true, required: false },
    facts: { candidate: { value: alternative.meaning.value, usable: true }, context: { value: alternative.meaning.condition, usable: true } }, encounterId: 'member-understanding', at: asOf });
}
function completePeriods(periods, asOf) {
  if (!periods || periods.days !== 30 || periods.sufficient !== true || !periods.delta) return false;
  try {
    const recent = periods.recent, previous = periods.previous;
    if (instant(recent.to) - instant(recent.from) !== 30 * 86400000 || instant(previous.to) - instant(previous.from) !== 30 * 86400000
      || recent.from !== previous.to || instant(recent.to) > instant(asOf) || recent.answered < 1 || previous.answered < 1) return false;
    return ['answered', 'independent', 'assisted', 'activeDays'].every(key => Number.isSafeInteger(recent[key]) && recent[key] >= 0 && Number.isSafeInteger(previous[key]) && previous[key] >= 0
      && periods.delta[key] === recent[key] - previous[key]) && [recent, previous].every(p => p.independent <= p.answered && p.assisted <= p.answered && p.activeDays <= 30);
  } catch { return false; }
}
const evidence = entry => ({ kind: 'statement', ref: `statement.${entry.row.id}.${entry.meaning.id}`, label: [...entry.meaning.evidence.quote].slice(0, 120).join('') });
function summarizeStatementRelations({ document, facets, summary, activity, learning, asOf } = {}) {
  const resolved = resolveMemberStatements([2, 3, 4, 5, 6, 7, 8, 9, 10].includes(document?.version) ? document.statements : [], asOf), { entries } = resolved, relations = [], coveredFacets = new Set();
  // A directly written preference is authorized by the person's confirmation.
  // Turning learning observation off disables comparisons, not that declaration.
  const available = () => true;
  for (const entry of entries) {
    const manual = facets.find(f => f.id === (entry.meaning.field === 'topic' ? 'topics' : entry.meaning.field))?.override;
    if (manual && manual.at >= entry.row.confirmedAt) entry.active = false;
  }
  const active = entries.filter(e => e.active), newest = rows => [...rows].sort((a, b) => b.row.confirmedAt.localeCompare(a.row.confirmedAt));
  const add = (kind, id, line, proof, certainty) => relations.push({ id, kind, line, evidence: proof, certainty });
  for (const alt of newest(active.filter(e => e.meaning.condition && e.meaning.polarity === 'prefer' && e.meaning.field !== 'topic' && !multi(e.meaning)))) {
    const priorBases = entries.filter(e => e.verified && available(e) && e.meaning.field === alt.meaning.field && !e.meaning.condition && e.meaning.polarity === 'prefer' && e.row.confirmedAt <= alt.row.confirmedAt);
    const base = priorBases.at(-1), current = active.find(e => e.meaning.field === alt.meaning.field && !e.meaning.condition && e.meaning.polarity === 'prefer');
    if (!base || base.meaning.value === alt.meaning.value) continue;
    const assessed = conditionalPair(base, alt, current, asOf);
    if (assessed.status === 'conditional') {
      add('conditional-preference', `condition.${alt.row.id}.${alt.meaning.id}`, `평소 원하는 방식은 ‘${LABELS[current.meaning.value]}’이고, ${CONDITIONS[alt.meaning.condition]}${alt.meaning.condition.includes('after-example') ? '에는' : '는'} ‘${LABELS[alt.meaning.value]}’를 원한다고 확인했어요. 기본 선호와 그 상황의 도움을 함께 반영했어요.`, [evidence(current), evidence(alt)], 'declared');
      coveredFacets.add(alt.meaning.field);
    } else if (assessed.status === 'inactive' && assessed.reason === 'source-changed') {
      alt.active = false;
      const changed = current ? `기본 선호가 ‘${LABELS[base.meaning.value]}’에서 ‘${LABELS[current.meaning.value]}’로 바뀌었어요.`
        : `이전 기본 선호인 ‘${LABELS[base.meaning.value]}’를 현재 선호로 적용하지 않고 있어요.`;
      const latest = current || newest(active.filter(e => e.meaning.field === alt.meaning.field && !e.meaning.condition)).at(0);
      add('conditional-preference', `condition.${alt.row.id}.${alt.meaning.id}`, `${changed} 이전의 ‘${CONDITIONS[alt.meaning.condition]}: ${LABELS[alt.meaning.value]}’ 조건을 지금도 적용할지는 아직 확인하지 않았어요.`, [evidence(base), ...(latest ? [evidence(latest)] : []), evidence(alt)], 'needs-check');
    }
  }
  for (const entry of newest(entries.filter(e => e.active && !e.meaning.condition))) {
    const prior = entries.filter(e => e !== entry && e.verified && e.meaning.field === entry.meaning.field && e.meaning.condition === null && e.row.confirmedAt < entry.row.confirmedAt
      && (e.meaning.field !== 'topic' && !multi(e.meaning) || e.meaning.value === entry.meaning.value)).at(-1);
    if (!prior || prior.meaning.value === entry.meaning.value && prior.meaning.polarity === entry.meaning.polarity) continue;
    add('preference-change', `change.${entry.row.id}.${entry.meaning.id}`, `앞서 확인한 내용은 ‘${meaningLabel(prior.meaning)}’였고, 이번에는 ‘${meaningLabel(entry.meaning)}’로 알려 줬어요. 다음 설명은 이번 확인을 기준으로 해요.`, [evidence(prior), evidence(entry)], 'declared');coveredFacets.add(entry.meaning.field);
  }
  const mode = facets.find(f => f.id === 'practice-mode'), declaredMode = newest(entries.filter(e => e.active && e.meaning.field === 'practice-mode' && e.meaning.condition === null)).at(0);
  const choice = declaredMode ? { value: declaredMode.meaning.value, polarity: declaredMode.meaning.polarity, evidence: evidence(declaredMode) }
    : mode?.selected.length === 1 && ['listening', 'reading'].includes(mode.selected[0]) ? { value: mode.selected[0], polarity: 'prefer', evidence: { kind: 'selection', ref: 'facet.practice-mode', label: '직접 고른 학습 방식' } } : null;
  if (learning && mode?.claim && choice) {
    const matches = choice.polarity === 'prefer' && choice.value === mode.claim.reference;
    add('preference-observation', 'relationship.practice-mode', `직접 밝힌 내용은 ‘${choice.polarity === 'avoid' ? '선호하지 않음: ' : ''}${LABELS[choice.value]}’예요. 최근 기록에는 ${LABELS[mode.claim.reference]} 응답이 ${mode.claim.activeDays}일에 걸쳐 ${mode.claim.count}건 있어요. ${matches ? '직접 고른 방식과 반복된 기록이 일치해요.' : '기록에 많이 나타난 방식과 현재 원하는 방식을 구분해 반영해요.'}`, [choice.evidence, { kind: 'observation', ref: 'facet.practice-mode', label: mode.evidenceLine.slice(0, 120) }], matches ? 'declared' : 'needs-check');coveredFacets.add('practice-mode');
  }
  const periods = learning ? summary?.practice?.periods : null;
  const support = newest(entries.filter(e => e.active && e.meaning.field === 'support' && !e.meaning.condition && e.meaning.polarity === 'prefer')).at(0);
  if (support && completePeriods(periods, asOf) && ['independent', 'step', 'example'].includes(support.meaning.value)) {
    const key = support.meaning.value === 'independent' ? 'independent' : 'assisted', label = key === 'independent' ? '도움 없이 한 응답' : '도움을 받은 응답';
    add('activity-change', 'relationship.practice-period', `현재 ‘${LABELS[support.meaning.value]}’를 원한다고 확인했어요. 같은 길이의 두 기간에서 ${label}은 ${periods.previous[key]}건에서 ${periods.recent[key]}건으로 ${periods.delta[key] === 0 ? '같았어요' : '바뀌었어요'}. 이 차이를 선호의 원인이나 실력 변화로 단정하지 않아요.`, [evidence(support), { kind: 'period', ref: 'period.practice', label: '동일한 30일 구간의 실제 응답 수' }], 'observed');
  }
  const entriesByRef = new Map(entries.map(entry => [`statement.${entry.row.id}.${entry.meaning.id}`, entry]));
  const proofEntries = relation => relation.evidence.filter(item => item.kind === 'statement').map(item => entriesByRef.get(item.ref)).filter(Boolean);
  const relationTimes = new Map(relations.map(relation => [relation.id, proofEntries(relation).reduce((latest, entry) => entry.row.confirmedAt > latest ? entry.row.confirmedAt : latest, '')]));
  const relationTime = relation => relationTimes.get(relation.id) || '';
  // A condition that needs confirmation must remain visible even when newer
  // declarations fill the short overview. Recency cannot silently resolve it.
  relations.sort((a, b) => Number(b.certainty === 'needs-check') - Number(a.certainty === 'needs-check') || relationTime(b).localeCompare(relationTime(a)));relations.splice(4);
  coveredFacets.clear();for (const relation of relations) for (const entry of proofEntries(relation)) coveredFacets.add(entry.meaning.field);
  const statementHistory = [...resolved.rows].reverse().map(row => ({ id: row.id, text: row.text, at: row.confirmedAt, active: entries.some(e => e.row.id === row.id && e.active),
    clarificationAnswers: row.parserVersion === 'member-statement-ko-1' ? [] : parseMemberStatement(row.text, { clarifications: row.clarifications, parserVersion: row.parserVersion }).clarificationAnswers,
    meanings: row.meanings.map(m => ({ id: m.id, line: meaningLabel(m), condition: m.condition, quote: m.evidence.quote, active: !!entries.find(e => e.row.id === row.id && e.meaning.id === m.id)?.active })) }));
  const lineItems = newest(entries.filter(e => e.active && !coveredFacets.has(e.meaning.field))).map(entry => ({ line: `직접 확인한 내용은 ‘${meaningLabel(entry.meaning)}’예요.`, at: entry.row.confirmedAt }));
  const paragraphs = [...relations.map(row => ({ line: row.line, at: relationTime(row), needsCheck: row.certainty === 'needs-check' })), ...lineItems]
    .sort((a, b) => Number(b.needsCheck === true) - Number(a.needsCheck === true) || b.at.localeCompare(a.at)).map(row => row.line).slice(0, 4);
  return { relations, statementHistory, paragraphs, lines: lineItems.map(row => row.line), coveredFacets: [...coveredFacets], active: entries.filter(e => e.active).map(e => ({ ...copy(e.meaning), at: e.row.confirmedAt, statementId: e.row.id })) };
}
module.exports = { ...Contract, previewMemberStatement, confirmMemberStatement, resolveMemberStatements, summarizeStatementRelations };
