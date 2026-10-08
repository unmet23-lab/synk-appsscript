// Read-only product copy from the host's current authorized discovery projection.
// This neither ranks people nor reconstructs a counterpart's private answers.
import { DISCOVERY_FIELDS } from './discovery.mjs';

const data = (object, key) => {
  if (!object || typeof object !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
};
const list = (value, limit) => {
  if (!Array.isArray(value) || value.length > limit) return null;
  const result = [];
  for (let index = 0; index < value.length; index++) {
    const item = data(value, String(index));
    if (item === undefined) return null;
    result.push(item);
  }
  return result;
};
const instant = value => {
  if (typeof value !== 'string' || value.length > 32) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) && new Date(at).toISOString() === value ? at : null;
};
const words = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1200;
const definition = id => DISCOVERY_FIELDS.find(field => field.id === id && field.kind === 'wants' && !field.legacy);
const until = object => data(object, 'until') ?? null;
const live = (deadline, at) => deadline === null || instant(deadline) !== null && at !== null && at < instant(deadline);
const sameFields = (a, b) => a.length === b.length && a.every((field, index) => field === b[index]);
const reasonKeys = ['field', 'label', 'text', 'owner', 'editable', 'comparison', 'source', 'value', 'at', 'until', 'required', 'priority', 'conditionStatus', 'conditionalRuleId'];
const sameReason = (a, b) => reasonKeys.every(key => data(a, key) === data(b, key));
const uniqueReason = (candidate, field) => {
  const reasons = list(data(candidate, 'reasonDetails'), DISCOVERY_FIELDS.length * 3);
  if (!reasons) return null;
  const own = reasons.filter(reason => data(reason, 'field') === field && data(reason, 'owner') === 'self');
  return own.length === 1 ? own[0] : null;
};
const describe = (comparison, valueLabel) => ({
  match: `내가 바라는 ‘${valueLabel}’와 상대의 현재 공개 답이 맞아요.`,
  different: `내가 바라는 ‘${valueLabel}’와 상대의 현재 공개 답은 달라요.`,
  unknown: '상대의 현재 공개 답이 미확인이어서 이 기준은 아직 비교하지 못해요.',
  conditional: '원래 선호와 같은 일치는 아니지만, 공개한 사전 예고 방식이 내가 정한 연락 허용 조건에 맞아요.',
  any: '나는 어느 쪽도 괜찮다고 골랐어요. 이 기준에서 더 맞는 사람을 구분하지 않아요.',
})[comparison];

/**
 * Maximum two rows in current effective priority order. Supply `discovery.asOf`
 * from the host's server view when a field/priority/context has a dated limit.
 * A missing clock never certifies a dated declaration as still current.
 * Each row contains own-policy copy and an existing public comparison only.
 */
export function getCandidateHighlights(discovery, candidate) {
  const context = data(discovery, 'context'), fields = list(data(discovery, 'fields'), DISCOVERY_FIELDS.length),
    priorities = data(discovery, 'priorities'), effective = list(data(priorities, 'effective'), 2),
    candidates = list(data(discovery, 'candidates'), 1000), at = instant(data(discovery, 'asOf'));
  if (!fields || !effective?.length || !candidates || data(context, 'closed') !== false
    || new Set(effective).size !== effective.length || effective.some(field => !definition(field))) return [];
  const consent = fields.filter(field => data(field, 'id') === 'consent');
  if (consent.length !== 1 || data(consent[0], 'state') !== 'known' || data(consent[0], 'value') !== true) return [];
  const id = data(candidate, 'id'), current = candidates.filter(item => data(item, 'id') === id);
  if (typeof id !== 'string' || !id.length || current.length !== 1) return [];
  const deadlines = data(priorities, 'deadlines'), expired = data(priorities, 'expired'),
    contextFields = data(priorities, 'context'), contextUntil = data(deadlines, 'context') ?? null,
    contextPriority = Array.isArray(contextFields) && data(expired, 'context') !== true && live(contextUntil, at),
    prioritySource = contextPriority ? 'context' : 'baseline', priorityUntil = data(deadlines, prioritySource) ?? null;
  if (data(expired, prioritySource) === true || !live(priorityUntil, at)) return [];
  const activeFields = list(data(priorities, prioritySource), 2);
  if (activeFields && !sameFields(activeFields, effective)) return [];
  if (prioritySource === 'context' && !live(data(context, 'expiresAt') ?? null, at)) return [];
  const rows = [];
  for (const id of effective) {
    const matches = fields.filter(field => data(field, 'id') === id);
    if (matches.length !== 1) continue;
    const field = matches[0], currentValue = data(field, 'effective'), source = data(field, 'source'), spec = definition(id);
    if (data(currentValue, 'state') !== 'known' || !['baseline', 'context'].includes(source)) continue;
    const value = data(currentValue, 'value'), option = spec.options.find(option => option.value === value);
    if (!option) continue;
    const reason = uniqueReason(candidate, id), latest = uniqueReason(current[0], id);
    if (!reason || !latest || !sameReason(reason, latest) || data(reason, 'editable') !== true || data(reason, 'priority') !== true
      || !words(data(reason, 'text')) || data(reason, 'value') !== value) continue;
    const required = data(reason, 'required') === true, basis = required ? data(field, 'baseline') : currentValue,
      reasonSource = data(reason, 'source'), provenance = data(basis, 'provenance');
    if (data(basis, 'state') !== 'known' || data(basis, 'value') !== value
      || reasonSource !== (required ? 'baseline' : source) || data(reason, 'at') !== (data(provenance, 'at') ?? null)
      || until(reason) !== until(provenance) || !live(until(provenance), at)) continue;
    if (source === 'context' && !live(data(context, 'expiresAt') ?? null, at)) continue;
    const comparison = data(reason, 'comparison');
    if (!['match', 'different', 'unknown', 'conditional', 'any'].includes(comparison)
      || comparison === 'any' && value !== 'any' || comparison !== 'any' && value === 'any') continue;
    const limits = [until(provenance), priorityUntil, ...(source === 'context' || prioritySource === 'context' ? [data(context, 'expiresAt') ?? null] : [])];
    if (comparison === 'conditional') {
      const conditional = data(discovery, 'conditionalPreference'), rule = data(data(conditional, 'effective'), 'rule');
      if (id !== 'wants.contact' || value !== 'daily' || required || data(reason, 'conditionStatus') !== 'satisfied'
        || data(reason, 'conditionalRuleId') !== 'contact-with-notice' || data(data(conditional, 'effective'), 'status') !== 'active'
        || !rule || !live(until(rule), at)) continue;
      limits.push(until(rule));
      if (data(conditional, 'target') === 'context') {
        const end = data(context, 'expiresAt') ?? null;
        if (!live(end, at)) continue;
        limits.push(end);
      }
    }
    const dated = limits.filter(value => value !== null);
    rows.push({ field: id, label: spec.label, text: describe(comparison, option.label), comparison, source: reasonSource,
      required, prioritySource, until: dated.length ? dated.sort((a, b) => instant(a) - instant(b))[0] : null });
  }
  return rows;
}
