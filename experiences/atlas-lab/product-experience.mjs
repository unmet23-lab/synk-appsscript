// Product-owned private experience reports. These are self-reports, never a score
// for the other person, inferred traits, automatic preference changes or efficacy.
import Temper from '../../atlas/temper-outcomes.js';
const VERSION = 'dating-experience-1', DAY = 86400000;
const plain = x => !!x && Object.getPrototypeOf(x) === Object.prototype;
const copy = x => JSON.parse(JSON.stringify(x));
const exact = (x, keys) => plain(x) && Object.keys(x).every(key => keys.includes(key));
const token = x => typeof x === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(x);
const fail = message => { throw new TypeError(`Experience: ${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };
const time = at => { assert(typeof at === 'string' && Number.isFinite(Date.parse(at)) && new Date(at).toISOString() === at, 'canonical time required'); return Date.parse(at); };
const METRICS = { intent: { values: { yes: 1, partly: 0.5, no: 0 }, direction: 'higher', windowMs: DAY },
  burden: { values: { easy: 0, much: 1 }, direction: 'lower', windowMs: DAY },
  comfort: { values: { comfortable: 1, mixed: 0.5, uncomfortable: 0 }, direction: 'higher', windowMs: 7 * DAY },
  followup: { values: { better: 1, same: 0.5, worse: 0 }, direction: 'higher', windowMs: 7 * DAY } };
const POLICY = { id: 'dating-explicit', version: '1' }, REFERENCE = { id: 'reference-not-run', version: '1' };
const criterionSnapshot = (item, at) => exact(item, ['field', 'label', 'value', 'valueLabel', 'declarationId', 'declarationTarget', 'until'])
  && token(item.field) && item.field.startsWith('wants.') && [item.label, item.value, item.valueLabel].every(value => typeof value === 'string' && value.length > 0 && value.length <= 160)
  && token(item.declarationId) && (item.declarationTarget === undefined || ['baseline', 'context'].includes(item.declarationTarget))
  && (item.until === undefined || time(item.until) > time(at));
const reflectionSnapshot = (source, at) => exact(source, ['contextId', 'priorityKey', 'criteria', 'criterion', 'selectedId'])
  && token(source.contextId) && /^[a-f0-9]{64}$/.test(source.priorityKey) && token(source.selectedId)
  && Array.isArray(source.criteria) && source.criteria.length <= 2 && new Set(source.criteria).size === source.criteria.length
  && source.criteria.every(field => token(field) && field.startsWith('wants.')) && !source.criteria.includes(source.criterion?.field)
  && criterionSnapshot(source.criterion, at);
export function createProductExperience() {
  const create = () => ({ version: VERSION, goal: null, evaluationConsent: false, consentAt: null, records: [] });
  function validate(state, at) {
    assert(exact(state, ['version', 'goal', 'evaluationConsent', 'consentAt', 'records', 'corrections', 'meetingCriteria']) && state.version === VERSION
      && [null, 'comfortable', 'intent', 'pace'].includes(state.goal) && typeof state.evaluationConsent === 'boolean'
      && Array.isArray(state.records) && state.records.length <= 500, 'invalid private state');
    if (state.consentAt !== null) assert(time(state.consentAt) <= time(at), 'future consent');
    const ids = new Set();
    for (const row of state.records) {
      assert(exact(row, ['id', 'kind', 'at', 'deliveredAt', 'goal', 'contextId', 'pairId', 'appointmentId', 'proposalVersion', 'candidateIds', 'selectedId', 'responses', 'evaluationEligible', 'correctionId', 'allowance'])
        && token(row.id) && !ids.has(row.id) && ['recommendation', 'meeting'].includes(row.kind) && time(row.at) <= time(at)
        && (row.deliveredAt === null || time(row.deliveredAt) >= time(row.at) && time(row.deliveredAt) <= time(at))
        && typeof row.evaluationEligible === 'boolean' && [null, 'comfortable', 'intent', 'pace'].includes(row.goal)
        && Array.isArray(row.candidateIds) && row.candidateIds.every(token) && new Set(row.candidateIds).size === row.candidateIds.length
        && row.candidateIds.includes(row.selectedId) && plain(row.responses), 'invalid private record');
      for (const [metric, answer] of Object.entries(row.responses)) {
        assert(Object.hasOwn(METRICS, metric) && (row.kind === 'meeting' ? metric === 'comfort' : metric !== 'comfort')
          && exact(answer, ['value', 'at']) && (answer.value === 'unknown' || Object.hasOwn(METRICS[metric].values, answer.value))
          && row.deliveredAt !== null && time(answer.at) >= time(row.deliveredAt) && time(answer.at) <= time(at), 'invalid private answer');
      }
      if (row.allowance !== undefined) {
        const a = row.allowance;
        assert(row.kind === 'recommendation' && exact(a, ['id', 'target', 'description', 'capturedAt', 'until', 'binding', 'ruleKey', 'ruleAt', 'source', 'contextId', 'candidatePublicKey', 'ownerGeneration', 'ownKey', 'response', 'responseRevision'])
          && a.id === 'contact-with-notice' && ['baseline', 'context'].includes(a.target)
          && typeof a.description === 'string' && a.description.length > 0 && a.description.length <= 500
          && a.capturedAt === row.at && time(a.ruleAt) <= time(a.capturedAt)
          && (a.until === undefined || time(a.until) > time(a.capturedAt))
          && [a.binding, a.ruleKey, a.candidatePublicKey, a.ownKey].every(value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
          && a.contextId === row.contextId && token(a.contextId) && Number.isSafeInteger(a.ownerGeneration) && a.ownerGeneration >= 0
          && exact(a.source, ['eventId', 'at', 'until', 'duration', 'encounterId']) && token(a.source.eventId) && token(a.source.encounterId)
          && ['ongoing', 'once'].includes(a.source.duration) && time(a.source.at) <= time(a.ruleAt)
          && (a.source.until === undefined || time(a.source.until) > time(a.capturedAt) && a.until !== undefined && time(a.until) <= time(a.source.until))
          && (a.target !== 'baseline' || a.source.duration === 'ongoing')
          && Number.isSafeInteger(a.responseRevision) && a.responseRevision >= 0, 'invalid allowance snapshot');
        if (a.response !== undefined) assert(exact(a.response, ['value', 'at']) && ['keep', 'stop', 'unknown'].includes(a.response.value)
          && a.responseRevision > 0 && row.deliveredAt && time(a.response.at) >= time(row.deliveredAt) && time(a.response.at) <= time(at), 'invalid allowance response');
      }
      ids.add(row.id);
    }
    const corrections = state.corrections || [], correctionIds = new Set();
    assert(Array.isArray(corrections) && corrections.length <= 500, 'invalid corrections');
    for (const correction of corrections) {
      assert(exact(correction, ['id', 'sourceDecisionId', 'sourceCriterion', 'sourceAnswer', 'contextId', 'basisKey', 'at', 'until', 'changes', 'evaluationEligible', 'invalidatedAt', 'restore', 'restoredAt'])
        && token(correction.id) && !correctionIds.has(correction.id) && token(correction.contextId) && /^[a-f0-9]{64}$/.test(correction.basisKey)
        && time(correction.at) <= time(at) && typeof correction.evaluationEligible === 'boolean'
        && (correction.invalidatedAt === undefined || time(correction.invalidatedAt) >= time(correction.at) && time(correction.invalidatedAt) <= time(at))
        && exact(correction.sourceAnswer, ['value', 'at']) && (correction.sourceCriterion ? correction.sourceAnswer.value === 'more-important' : ['partly', 'no'].includes(correction.sourceAnswer.value))
        && time(correction.sourceAnswer.at) <= time(correction.at)
        && (correction.sourceCriterion ? correction.sourceDecisionId === undefined && exact(correction.sourceCriterion, ['pairId', 'appointmentId', 'proposalVersion', 'completedAt', 'field', 'source'])
          && token(correction.sourceCriterion.pairId) && token(correction.sourceCriterion.appointmentId) && token(correction.sourceCriterion.field)
          && Number.isSafeInteger(correction.sourceCriterion.proposalVersion) && correction.sourceCriterion.proposalVersion > 0
          && time(correction.sourceCriterion.completedAt) <= time(correction.sourceAnswer.at)
          && reflectionSnapshot(correction.sourceCriterion.source, correction.sourceAnswer.at)
          && correction.sourceCriterion.field === correction.sourceCriterion.source.criterion.field
          && correction.contextId === correction.sourceCriterion.source.contextId
          && (!correction.sourceCriterion.source.criterion.until || correction.until && time(correction.until) <= time(correction.sourceCriterion.source.criterion.until))
          : state.records.some(row => row.id === correction.sourceDecisionId && row.kind === 'recommendation' && row.deliveredAt && time(row.deliveredAt) <= time(correction.at)))
        && (correction.until === undefined || time(correction.until) > time(correction.at))
        && Array.isArray(correction.changes) && correction.changes.length > 0 && correction.changes.length <= 30
        && correction.changes.every(change => exact(change, ['field', 'before', 'after']) && token(change.field)
          && typeof change.before === 'string' && change.before.length <= 1000 && typeof change.after === 'string' && change.after.length <= 1000 && change.before !== change.after), 'invalid correction basis');
      correctionIds.add(correction.id);
      if (correction.restore !== undefined) assert(exact(correction.restore, ['kind', 'field', 'changeId', 'currentKey']) && token(correction.restore.changeId)
        && (correction.restore.currentKey === undefined || /^[a-f0-9]{64}$/.test(correction.restore.currentKey))
        && (correction.restore.kind === 'undo-field' && token(correction.restore.field) || correction.restore.kind === 'undo-priorities' && !Object.hasOwn(correction.restore, 'field')), 'invalid restoration source');
      if (correction.restoredAt !== undefined) assert(correction.restore && time(correction.restoredAt) >= time(correction.at) && time(correction.restoredAt) <= time(at), 'invalid restoration time');
    }
    for (const row of state.records) {
      if (row.correctionId !== undefined) assert(row.kind === 'recommendation' && corrections.some(correction => correction.id === row.correctionId && time(correction.at) <= time(row.at)), 'invalid correction link');
      if (row.responses.followup) assert(row.correctionId !== undefined, 'followup needs a correction link');
    }
    const meetings = state.meetingCriteria || [], pairs = new Set();
    assert(Array.isArray(meetings) && meetings.length <= 500, 'invalid meeting criteria');
    for (const meeting of meetings) {
      assert(exact(meeting, ['pairId', 'at', 'contextId', 'priorityKey', 'priorityTarget', 'criteria', 'reviews']) && token(meeting.pairId) && !pairs.has(meeting.pairId)
        && time(meeting.at) <= time(at) && token(meeting.contextId) && /^[a-f0-9]{64}$/.test(meeting.priorityKey)
        && (meeting.priorityTarget === undefined || ['baseline', 'context'].includes(meeting.priorityTarget))
        && Array.isArray(meeting.criteria) && meeting.criteria.length <= 2 && new Set(meeting.criteria.map(item => item.field)).size === meeting.criteria.length
        && meeting.criteria.every(item => criterionSnapshot(item, meeting.at))
        && Array.isArray(meeting.reviews) && meeting.reviews.length <= 500, 'invalid meeting criterion snapshot');
      const appointments = new Set();
      for (const review of meeting.reviews) {
        assert(exact(review, ['appointmentId', 'proposalVersion', 'completedAt', 'field', 'response', 'source', 'evaluationEligible']) && token(review.appointmentId) && !appointments.has(review.appointmentId)
          && Number.isSafeInteger(review.proposalVersion) && review.proposalVersion > 0 && time(review.completedAt) >= time(meeting.at) && time(review.completedAt) <= time(at)
          && (review.response?.value === 'more-important' ? reflectionSnapshot(review.source, review.response.at) && review.source.criterion.field === review.field
            && typeof review.evaluationEligible === 'boolean' : meeting.criteria.some(item => item.field === review.field) && review.source === undefined)
          && exact(review.response, ['value', 'at']) && ['helped', 'less-important', 'more-important', 'unknown'].includes(review.response.value)
          && time(review.response.at) >= time(review.completedAt) && time(review.response.at) <= time(at), 'invalid private criterion review');
        appointments.add(review.appointmentId);
      }
      pairs.add(meeting.pairId);
    }
    return state;
  }
  const sourceValid = (state, correction, allowed, at) => {
    if (correction.invalidatedAt || correction.until && at && time(at) >= time(correction.until)) return false;
    if (correction.sourceCriterion) {
      const src = correction.sourceCriterion, review = (state.meetingCriteria || []).find(meeting => meeting.pairId === src.pairId)?.reviews.find(item => item.appointmentId === src.appointmentId);
      return review?.field === src.field && review.proposalVersion === src.proposalVersion && review.completedAt === src.completedAt
        && review.response.value === correction.sourceAnswer.value && review.response.at === correction.sourceAnswer.at
        && JSON.stringify(review.source) === JSON.stringify(src.source) && (!allowed || allowed.includes(src.source.selectedId));
    }
    const source = state.records.find(row => row.id === correction.sourceDecisionId);
    return !correction.invalidatedAt && !!source?.deliveredAt && source.responses.intent?.value === correction.sourceAnswer.value && source.responses.intent?.at === correction.sourceAnswer.at
      && (!allowed || allowed.includes(source.selectedId));
  };
  function correctionSource(state, decisionId, at, allowed) {
    validate(state, at); const source = state.records.find(row => row.id === decisionId);
    assert(source?.kind === 'recommendation' && source.deliveredAt && ['partly', 'no'].includes(source.responses.intent?.value)
      && (!allowed || allowed.includes(source.selectedId)), 'current own partly/no response required');
    return copy(source.responses.intent);
  }
  function correct(state, snapshot, at, allowed) {
    validate(state, at); assert(exact(snapshot, ['id', 'sourceDecisionId', 'contextId', 'basisKey', 'changes', 'restore']) && !(state.corrections || []).some(row => row.id === snapshot.id), 'invalid correction');
    const sourceAnswer = correctionSource(state, snapshot.sourceDecisionId, at, allowed), next = copy(state);
    next.corrections = [...(next.corrections || []), { ...copy(snapshot), sourceAnswer, at,
      evaluationEligible: state.evaluationConsent && state.records.find(row => row.id === snapshot.sourceDecisionId).evaluationEligible }];
    validate(next, at); return next;
  }
  function criterionCorrection(state, snapshot, at) {
    validate(state, at); assert(exact(snapshot, ['id', 'sourceCriterion', 'contextId', 'basisKey', 'until', 'changes', 'restore'])
      && !(state.corrections || []).some(row => row.id === snapshot.id), 'invalid criterion correction');
    const source = criterionSource(state, snapshot.sourceCriterion, at);
    assert(source.review.response.value === 'more-important', 'current more-important review required');
    const { appointmentId, proposalVersion, completedAt, field } = source.review, next = copy(state);
    next.corrections = [...(next.corrections || []), { ...copy(snapshot), sourceCriterion: { pairId: source.pairId, appointmentId, proposalVersion, completedAt, field, source: copy(source.review.source) },
      sourceAnswer: copy(source.review.response), at, evaluationEligible: state.evaluationConsent && source.review.evaluationEligible }];
    validate(next, at); return next;
  }
  function restoreSource(state, decisionId, at, allowed) {
    validate(state, at); const row = state.records.find(item => item.id === decisionId), correction = (state.corrections || []).find(item => item.id === row?.correctionId);
    assert(row?.deliveredAt && row.responses.followup?.value === 'worse' && correction?.restore && !correction.restoredAt
      && sourceValid(state, correction, allowed, at) && (!allowed || allowed.includes(row.selectedId)), 'current worse response and original correction required');
    const { currentKey, ...action } = correction.restore;
    return copy({ correctionId: correction.id, contextId: correction.contextId, action, ...(currentKey ? { currentKey } : {}), response: row.responses.followup });
  }
  function restored(state, decisionId, at, allowed) {
    const source = restoreSource(state, decisionId, at, allowed), next = copy(state);
    next.corrections.find(item => item.id === source.correctionId).restoredAt = at; return next;
  }
  function captureCriteria(state, snapshot, at, { startedAt = at } = {}) {
    validate(state, at); assert(exact(snapshot, ['pairId', 'contextId', 'priorityKey', 'priorityTarget', 'criteria']), 'invalid meeting criteria snapshot');
    assert(time(startedAt) <= time(at) && (startedAt === at || snapshot.criteria.length === 0), 'only an empty historical criterion snapshot is allowed');
    if ((state.meetingCriteria || []).some(item => item.pairId === snapshot.pairId)) return copy(state);
    const next = copy(state); next.meetingCriteria = [...(next.meetingCriteria || []), { ...copy(snapshot), at: startedAt, reviews: [] }];
    validate(next, at); return next;
  }
  function criterion(state, input, at) {
    validate(state, at); assert(exact(input, ['pairId', 'appointmentId', 'proposalVersion', 'completedAt', 'field', 'value', 'source']), 'invalid criterion response');
    const next = copy(state), meeting = (next.meetingCriteria || []).find(item => item.pairId === input.pairId);
    if (input.value === null) {
      if (meeting) meeting.reviews = meeting.reviews.filter(item => item.appointmentId !== input.appointmentId);
      for (const correction of next.corrections || []) if (correction.sourceCriterion?.pairId === input.pairId && correction.sourceCriterion?.appointmentId === input.appointmentId && !correction.invalidatedAt) correction.invalidatedAt = at;
      return next;
    }
    assert(meeting && (input.value === 'more-important' ? reflectionSnapshot(input.source, at) && input.source.criterion.field === input.field
      : meeting.criteria.some(item => item.field === input.field) && ['helped', 'less-important', 'unknown'].includes(input.value)), 'known meeting criterion required');
    const prior = meeting.reviews.find(item => item.appointmentId === input.appointmentId);
    if (prior) assert(prior.proposalVersion === input.proposalVersion && prior.completedAt === input.completedAt, 'changed completed appointment');
    if (!prior || prior.field !== input.field || prior.response.value !== input.value || JSON.stringify(prior.source) !== JSON.stringify(input.source)) {
      for (const correction of next.corrections || []) if (correction.sourceCriterion?.pairId === input.pairId && correction.sourceCriterion?.appointmentId === input.appointmentId && !correction.invalidatedAt) correction.invalidatedAt = at;
      meeting.reviews = meeting.reviews.filter(item => item.appointmentId !== input.appointmentId);
      meeting.reviews.push({ appointmentId: input.appointmentId, proposalVersion: input.proposalVersion, completedAt: input.completedAt,
        field: input.field, response: { value: input.value, at }, ...(input.value === 'more-important' ? { source: copy(input.source),
          evaluationEligible: state.evaluationConsent && time(meeting.at) >= time(state.consentAt) } : {}) });
    }
    validate(next, at); return next;
  }
  function criterionSource(state, { pairId, appointmentId, field }, at) {
    validate(state, at); const meeting = (state.meetingCriteria || []).find(item => item.pairId === pairId), review = meeting?.reviews.find(item => item.appointmentId === appointmentId);
    assert(review?.field === field && ['less-important', 'more-important'].includes(review.response.value), 'current less-important or more-important review required');
    return copy({ ...meeting, reviews: undefined, criterion: review.source?.criterion || meeting.criteria.find(item => item.field === field), review });
  }
  function setting(state, action, at) {
    validate(state, at); const next = copy(state);
    if (action.kind === 'goal') { assert(exact(action, ['kind', 'value']) && [null, 'comfortable', 'intent', 'pace'].includes(action.value), 'invalid goal'); next.goal = action.value; }
    else {
      assert(exact(action, ['kind', 'enabled']) && action.kind === 'evaluation-consent' && typeof action.enabled === 'boolean', 'explicit evaluation consent required');
      if (next.evaluationConsent !== action.enabled) {
        next.evaluationConsent = action.enabled; next.consentAt = action.enabled ? at : null;
        // Consent is prospective. Turning it on again never restores old eligibility.
        for (const row of next.records) row.evaluationEligible = false;
        for (const correction of next.corrections || []) correction.evaluationEligible = false;
        for (const meeting of next.meetingCriteria || []) for (const review of meeting.reviews) if (review.evaluationEligible !== undefined) review.evaluationEligible = false;
      }
    }
    return next;
  }
  function decide(state, snapshot, at, { basisKey, allowedSelectedIds } = {}) {
    validate(state, at); assert(exact(snapshot, ['id', 'contextId', 'candidateIds', 'selectedId', 'allowance']) && token(snapshot.id), 'invalid issued decision');
    assert(!state.records.some(row => row.id === snapshot.id), 'duplicate issued decision');
    const correction = (state.corrections || []).filter(row => row.contextId === snapshot.contextId && row.basisKey === basisKey && sourceValid(state, row, allowedSelectedIds, at)
      && !state.records.some(record => record.correctionId === row.id)).at(-1);
    const next = copy(state); next.records.push({ ...copy(snapshot), kind: 'recommendation', at, deliveredAt: null, goal: state.goal, responses: {}, evaluationEligible: state.evaluationConsent,
      ...(correction ? { correctionId: correction.id } : {}) });
    validate(next, at); return next;
  }
  function deliver(state, id, at) {
    validate(state, at); const next = copy(state), row = next.records.find(item => item.id === id);
    assert(row?.kind === 'recommendation', 'unknown issued decision');
    if (row.deliveredAt === null) row.deliveredAt = at;
    return next;
  }
  function respond(state, { decisionId, metric, value }, at) {
    validate(state, at); const next = copy(state), row = next.records.find(item => item.id === decisionId);
    assert(row?.deliveredAt && ['intent', 'burden'].includes(metric) && row.kind === 'recommendation', 'response needs your delivered recommendation');
    assert(value === null || value === 'unknown' || Object.hasOwn(METRICS[metric].values, value), 'invalid explicit response');
    if (metric === 'intent' && row.responses.intent?.value !== value)
      for (const correction of next.corrections || []) if (correction.sourceDecisionId === decisionId && !correction.invalidatedAt) correction.invalidatedAt = at;
    if (value === null) delete row.responses[metric]; else if (row.responses[metric]?.value !== value) row.responses[metric] = { value, at };
    validate(next, at); return next;
  }
  function allowanceSource(state, decisionId, at, { binding, requireStop = false, requireDelivered = true } = {}) {
    validate(state, at); const row = state.records.find(item => item.id === decisionId), a = row?.allowance;
    assert(row?.kind === 'recommendation' && (!requireDelivered || row.deliveredAt) && a && typeof binding === 'string' && a.binding === binding
      && (!a.until || time(at) < time(a.until)) && (!requireStop || a.response?.value === 'stop'), 'current delivered allowance source required');
    return copy(a);
  }
  function allowanceReview(state, input, at, { binding } = {}) {
    validate(state, at); assert(exact(input, ['kind', 'decisionId', 'value']) && (input.kind === undefined || input.kind === 'allowance-review')
      && token(input.decisionId) && [null, 'keep', 'stop', 'unknown'].includes(input.value), 'invalid allowance review');
    const next = copy(state), row = next.records.find(item => item.id === input.decisionId);
    assert(row?.kind === 'recommendation' && row.deliveredAt && row.allowance, 'own delivered allowance record required');
    if (input.value !== null) allowanceSource(state, input.decisionId, at, { binding });
    if ((row.allowance.response?.value ?? null) !== input.value) {
      row.allowance.responseRevision++;
      if (input.value === null) delete row.allowance.response; else row.allowance.response = { value: input.value, at };
    }
    validate(next, at); return next;
  }
  function followup(state, { decisionId, value }, at, { allowedSelectedIds } = {}) {
    validate(state, at); const next = copy(state), row = next.records.find(item => item.id === decisionId);
    const correction = (state.corrections || []).find(item => item.id === row?.correctionId);
    assert(row?.deliveredAt && correction, 'followup needs your delivered linked recommendation');
    assert(value === null || value === 'unknown' || Object.hasOwn(METRICS.followup.values, value), 'invalid followup response');
    if (value === null) delete row.responses.followup;
    else { assert(sourceValid(state, correction, allowedSelectedIds, at) && (!allowedSelectedIds || allowedSelectedIds.includes(row.selectedId)), 'correction source no longer available');
      if (row.responses.followup?.value !== value) row.responses.followup = { value, at }; }
    validate(next, at); return next;
  }
  function comfort(state, snapshot, value, at) {
    validate(state, at); assert(exact(snapshot, ['id', 'pairId', 'appointmentId', 'proposalVersion', 'at', 'completedAt']) && token(snapshot.id)
      && token(snapshot.pairId) && token(snapshot.appointmentId) && Number.isSafeInteger(snapshot.proposalVersion) && snapshot.proposalVersion > 0
      && time(snapshot.at) <= time(snapshot.completedAt) && time(snapshot.completedAt) <= time(at), 'your completed appointment required');
    assert(value === null || value === 'unknown' || Object.hasOwn(METRICS.comfort.values, value), 'invalid comfort response');
    const next = copy(state); let row = next.records.find(item => item.id === snapshot.id);
    if (!row && value === null) return next;
    if (!row) {
      row = { id: snapshot.id, kind: 'meeting', at: snapshot.at, deliveredAt: snapshot.completedAt, pairId: snapshot.pairId, appointmentId: snapshot.appointmentId,
        proposalVersion: snapshot.proposalVersion, goal: null, candidateIds: [snapshot.id], selectedId: snapshot.id, responses: {},
        evaluationEligible: state.evaluationConsent && time(snapshot.at) >= time(state.consentAt) };
      next.records.push(row);
    }
    assert(row.kind === 'meeting' && row.pairId === snapshot.pairId && row.appointmentId === snapshot.appointmentId && row.proposalVersion === snapshot.proposalVersion
      && row.at === snapshot.at && row.deliveredAt === snapshot.completedAt, 'changed appointment basis');
    if (value === null) delete row.responses.comfort; else if (row.responses.comfort?.value !== value) row.responses.comfort = { value, at };
    validate(next, at); return next;
  }
  function withdrawComfort(state, { pairId, appointmentId }, at) {
    validate(state, at); const next = copy(state);
    for (const row of next.records) if (row.kind === 'meeting' && row.pairId === pairId && row.appointmentId === appointmentId) delete row.responses.comfort;
    return next;
  }
  function inspect(state, { workspace, at, allowedSelectedIds, allowanceBindings = {} }) {
    validate(state, at); assert(token(workspace), 'private workspace required');
    const correctionFor = row => (state.corrections || []).find(item => item.id === row.correctionId);
    const validFollowup = row => !!correctionFor(row) && sourceValid(state, correctionFor(row), allowedSelectedIds, at)
      && (!allowedSelectedIds || allowedSelectedIds.includes(row.selectedId));
    const metrics = state.evaluationConsent ? Object.fromEntries(Object.entries(METRICS).map(([name, definition]) => {
      const scope = { domain: 'SHIFT', workspace, purpose: `dating-${name}` };
      const contract = { id: `dating.${name}`, version: '1', scope, outcome: { id: name, kind: 'numeric', direction: definition.direction, range: [0, 1], windowMs: definition.windowMs } };
      const rows = state.records.filter(row => row.evaluationEligible && (name === 'comfort' ? row.kind === 'meeting' : row.kind === 'recommendation')
        && (name !== 'followup' || validFollowup(row) && correctionFor(row).evaluationEligible));
      const decisions = rows.map(row => ({ id: row.id, subject: 'self', scope, at: row.at, contract: { id: contract.id, version: contract.version }, policy: POLICY,
        candidateIds: row.candidateIds, selectedId: row.selectedId }));
      const exposures = rows.filter(row => row.deliveredAt).map(row => ({ id: `exposure.${row.id}`, subject: 'self', scope, at: row.deliveredAt, decisionId: row.id, candidateId: row.selectedId }));
      const outcomes = rows.filter(row => row.deliveredAt && row.responses[name] && row.responses[name].value !== 'unknown').map(row => ({ id: `outcome.${row.id}`, subject: 'self', scope,
        at: row.responses[name].at, exposureId: `exposure.${row.id}`, value: definition.values[row.responses[name].value] }));
      const measured = Temper.evaluateOutcomes({ contract, decisions, exposures, outcomes, policies: [POLICY, REFERENCE], subjects: ['self'], asOf: at });
      return [name, { ...measured, explicitUnknown: rows.filter(row => row.responses[name]?.value === 'unknown').length }];
    })) : null;
    return { version: VERSION, goal: state.goal, evaluationConsent: state.evaluationConsent,
      records: state.records.map(({ candidateIds, selectedId, correctionId, allowance, ...row }) => ({ ...copy(row),
        ...(allowance ? { allowance: (() => {
          let valid = false; try { allowanceSource(state, row.id, at, { binding: allowanceBindings[row.id], requireDelivered: false }); valid = !allowedSelectedIds || allowedSelectedIds.includes(selectedId); } catch { /* No inferred allowance for stale records. */ }
          return { id: allowance.id, target: allowance.target, description: allowance.description, capturedAt: allowance.capturedAt,
            ...(allowance.until ? { until: allowance.until } : {}), ...(allowance.response ? { response: copy(allowance.response) } : {}), valid, canReview: valid, canRespond: valid && !!row.deliveredAt,
            canPreviewClear: valid && !!row.deliveredAt && allowance.response?.value === 'stop', ...(!valid ? { unavailableReason: '당시 허용 조건의 출처·기한이나 공개된 비교 정보가 달라져 지금은 이 기록으로 기준을 바꿀 수 없어요. 남긴 답은 지울 수 있어요.' } : {}) };
        })() } : {}),
        canCorrect: row.kind === 'recommendation' && !!row.deliveredAt && ['partly', 'no'].includes(row.responses.intent?.value) && (!allowedSelectedIds || allowedSelectedIds.includes(selectedId)),
        ...(correctionId ? { followup: { correctionId, sourceDecisionId: correctionFor({ correctionId }).sourceDecisionId || null,
          ...(correctionFor({ correctionId }).sourceCriterion ? { sourceMeeting: (() => { const s = correctionFor({ correctionId }).sourceCriterion;
            return { appointmentId: s.appointmentId, completedAt: s.completedAt, label: s.source.criterion.label, valueLabel: s.source.criterion.valueLabel }; })() } : {}), changes: copy(correctionFor({ correctionId }).changes),
          valid: validFollowup({ ...row, selectedId, correctionId }), canRespond: !!row.deliveredAt && validFollowup({ ...row, selectedId, correctionId }) } } : {}) })), metrics,
      limitations: ['본인 응답의 기술통계이며 상대의 점수나 호감 확률이 아니에요.', '미응답과 모르겠음은 실패가 아니에요. 비교 정책과 실제 효과는 검증하지 않았어요.',
        '평가 동의 후 시작된 기록만 집계하며 동의를 끄면 이전 기록도 집계에서 제외돼요.', '기준 수정 뒤 더 가까워졌다는 답도 본인의 비교 응답이며, 수정이 개선을 일으켰다는 인과효과는 아니에요.'] };
  }
  return Object.freeze({ create, setting, decide, deliver, respond, followup, correct, correctionSource, restoreSource, restored,
    captureCriteria, criterion, criterionSource, criterionCorrection, comfort, withdrawComfort, allowanceSource, allowanceReview, inspect });
}
