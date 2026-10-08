// Private, read-only product projections. Inputs must be the host's current
// authorized view; this module neither authorizes access nor publishes answers.
import { DISCOVERY_FIELDS } from './discovery.mjs';
import { formatMeetingRegions } from './meeting-regions.mjs';

const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const own = (value, key) => Object.hasOwn(value, key);
const text = (value, limit = 1200) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const spec = field => DISCOVERY_FIELDS.find(item => item.id === field);
const valueLabel = (field, value) => {
  if(spec(field)?.kind==='regions'){try{return value==null?undefined:formatMeetingRegions(value);}catch{return undefined;}}
  return spec(field)?.options.find(item => item.value === value)?.label;
};
const emptyComparison = reason => ({ status: 'unavailable', reason, columns: [], options: [], fields: [], rows: [], same: null,
  summary: '지금 비교할 수 있는 두 후보를 다시 골라 주세요.' });
const validFields = fields => Array.isArray(fields) && fields.length > 0 && fields.length <= 2
  && new Set(fields).size === fields.length && fields.every(field => spec(field)?.kind === 'wants');

/** A compact view of already projected own declarations. No new question,
 * recommendation, publication, private reflection or raw-event lookup occurs. */
export function getPreferenceSummary(view) {
  const groups = [{ id: 'required', title: '꼭 지킬 기준', items: [] }, { id: 'priorities', title: '더 중요하게 볼 기준', items: [] },
    { id: 'context', title: '이번에만 적용하는 답', items: [] }, { id: 'unknown', title: '아직 모르는 답', items: [] }];
  const unavailable = () => ({ status: 'unavailable', groups, summary: '현재 내 기준을 다시 확인해 주세요.' });
  const discovery = view?.discovery;
  if (!plain(view) || view.status !== 'active' || view.consents?.storePreferences !== true || !plain(discovery)
    || !Array.isArray(discovery.fields) || discovery.fields.length > DISCOVERY_FIELDS.length) return unavailable();
  const fields = discovery.fields, ids = fields.map(field => field?.id), priorities = discovery.priorities?.effective ?? [];
  if (new Set(ids).size !== ids.length || ids.some(id => !spec(id)) || !Array.isArray(priorities)
    || priorities.length && !validFields(priorities)) return unavailable();
  const known = (field, layer) => plain(layer) && layer.state === 'known' && valueLabel(field, layer.value) !== undefined;
  const until = layer => {
    const value = layer?.provenance?.until;
    return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? { until: value } : {};
  };
  const item = (field, layer, detail, label) => ({ field: field.id, label: spec(field.id).label,
    valueLabel: label ?? valueLabel(field.id, layer?.value) ?? '답 미확인', detail, ...until(layer) });
  for (const definition of DISCOVERY_FIELDS.filter(field => field.id !== 'consent')) {
    const field = fields.find(entry => entry.id === definition.id);
    if (!plain(field)) continue;
    if(definition.legacy&&field.required!==true)continue;
    const effective = plain(field.effective) ? field.effective : field, baseline = field.baseline, context = field.context;
    const required = field.required === true, hard = required && definition.kind === 'wants';
    const conflict = hard && known(field.id, baseline) && known(field.id, context)
      && baseline.value !== 'any' && context.value !== 'any' && baseline.value !== context.value;
    if (required) {
      const basis = hard ? baseline : effective;
      const detail = !known(field.id, basis) ? '필수 지정은 유지하며, 답을 확인하기 전에는 충족했다고 판단하지 않아요.'
        : conflict ? '평소 필수 답이에요. 이번 답과 달라 추천을 보류해요.'
          : field.source === 'explicit-unknown' ? '평소 필수 답은 남아 있지만 이번에는 모른다고 밝혀 추천을 보류해요.'
            : hard ? '이번 선호로 바뀌지 않는 평소 필수 답이에요.' : definition.kind==='regions'?'직접 고른 만남 가능 지역이 겹치는지 확인해요.':'서로 가능한 일정을 직접 확인하는 필수 항목이에요.';
      groups[0].items.push(item(field, known(field.id, basis) ? basis : null, detail,
        known(field.id, basis) ? undefined : basis?.state === 'expired' ? '답의 기한이 지났어요' : '답 미확인'));
    }
    if (priorities.includes(field.id) && known(field.id, effective)) {
      const contextPriority=discovery.priorities?.context!=null&&discovery.priorities?.expired?.context!==true&&!discovery.context?.closed;
      const priorityItem=item(field, effective, conflict ? '이번 답과 평소 필수 답이 달라 추천을 보류해요. 중요도는 필수조건을 대신하지 않아요.'
        : contextPriority ? '이번 회차에 더 중요하게 비교해요.' : '평소에 더 중요하게 비교해요.');
      const deadline=discovery.priorities?.deadlines?.[contextPriority?'context':'baseline'];
      if(deadline&&Number.isFinite(Date.parse(deadline))&&(!priorityItem.until||Date.parse(deadline)<Date.parse(priorityItem.until)))priorityItem.until=deadline;
      groups[1].items.push(priorityItem);
    }
    if (!discovery.context?.closed && field.source === 'context' && known(field.id, context))
      groups[2].items.push(item(field, context, conflict ? '평소 필수 답과 달라 추천을 보류해요.'
        : known(field.id, baseline) ? `이번 적용이 끝나면 유효한 평소 답 ‘${valueLabel(field.id, baseline.value)}’을 사용해요.`
          : '이번 적용이 끝나면 유효한 평소 답이 없어 미확인으로 남아요.'));
    if (!known(field.id, effective) || hard && !known(field.id, baseline)) {
      const explicit = field.source === 'explicit-unknown';
      const detail = explicit ? '이번에는 모른다고 직접 남겼어요. 평소 답이나 어느 쪽도 괜찮음으로 대신 채우지 않아요.'
        : hard && !known(field.id, baseline) ? '필수로 확인할 평소 답이 없어요. 이번 선호로 대신 채우지 않아요.'
        : effective?.state === 'expired' ? '직접 정한 기한이 끝났어요. 옛 답을 되살리지 않아요.' : '현재 확인된 답이 없어요. 어느 쪽도 괜찮다는 뜻은 아니에요.';
      groups[3].items.push(item(field, null, detail, explicit ? '이번에는 아직 모르겠어요' : effective?.state === 'expired' ? '답의 기한이 지났어요' : '미확인'));
    }
  }
  return { status: 'ready', groups,
    summary: '지금 직접 정한 필수·중요 기준과 이번 답·미확인을 모았어요. 나머지 평소 답은 내 기준에서 확인할 수 있어요. 새 질문이나 답 변경은 없어요.'
      + (fields.some(field => field.context?.state === 'expired' && known(field.id, field.baseline)) ? ' 이번 답의 기한이 끝난 항목은 유효한 평소 답을 사용해요.' : '') };
}

/** Compare existing reasons, never reconstruct either person's raw profile.
 * Explicit priorities win. Without priorities, `fields` is the user's local
 * comparison choice and does not change discovery preferences or ranking.
 */
export function compareCandidates(discovery, ids, { fields } = {}) {
  if (!plain(discovery) || discovery.context?.closed === true || !Array.isArray(discovery.fields)
    || !discovery.fields.some(field => field?.id === 'consent' && field.state === 'known' && field.value === true)
    || !Array.isArray(discovery.candidates)) return emptyComparison('discovery-unavailable');
  if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1] || ids.some(id => !text(id, 160))) return emptyComparison('choose-two-candidates');
  const candidates = ids.map(id => discovery.candidates.filter(candidate => candidate?.id === id));
  if (candidates.some(matches => matches.length !== 1 || matches[0].status !== 'eligible' || !text(matches[0].label, 80)))
    return emptyComparison('candidate-unavailable');
  const people = candidates.map(matches => matches[0]);
  const columns = people.map(({ id, label }) => ({ id, label }));
  const options = DISCOVERY_FIELDS.filter(item => item.kind === 'wants'
    && discovery.fields.some(field => field?.id === item.id && field.kind === 'wants')).map(item => ({ field: item.id, label: item.label }));
  const priorities = discovery.priorities?.effective ?? [];
  if (!Array.isArray(priorities) || priorities.length && !validFields(priorities)) return emptyComparison('invalid-priorities');
  const selected = priorities.length ? priorities : fields;
  if (selected === undefined || Array.isArray(selected) && selected.length === 0) return { status: 'choose-fields', reason: 'choose-comparison-fields', columns,
    options, fields: [], rows: [], same: null, summary: '두 사람을 비교할 기준을 한두 개 골라 주세요. 추천 기준은 바뀌지 않아요.' };
  if (!validFields(selected) || selected.some(id => !options.some(item => item.field === id))) return emptyComparison('invalid-comparison-fields');
  const rows = selected.map(field => {
    const cells = people.map(person => {
      const matches = Array.isArray(person.reasonDetails) ? person.reasonDetails.filter(reason => reason?.field === field && reason.owner === 'self') : [];
      const reason = matches.length === 1 ? matches[0] : null;
      // Legacy text alone is not enough to infer agreement, disagreement or the
      // counterpart's answer. In particular, never parse Korean display text.
      const comparison = reason?.comparison;
      const recognized = (['match', 'different', 'unknown', 'any'].includes(comparison)
        || comparison === 'conditional' && field === 'wants.contact' && reason.conditionStatus === 'satisfied' && reason.conditionalRuleId === 'contact-with-notice') && text(reason?.text);
      const state = recognized ? comparison === 'any' ? 'known' : comparison : 'unknown';
      return { candidateId: person.id, state, text: recognized ? reason.text : '이 기준은 현재 공개된 추천 근거만으로 비교할 수 없어요.' };
    });
    const comparable = cells.every(cell => cell.state !== 'unknown');
    return { field, label: spec(field).label, cells, same: comparable ? cells[0].state === cells[1].state : null };
  });
  const same = rows.some(row => row.same === false) ? false : rows.every(row => row.same === true) ? true : null;
  const summary = same === true ? '고른 기준에 대한 비교 결과는 같아요. 두 사람 자체가 같다는 뜻은 아니에요.'
    : same === false ? '고른 기준에서 다른 점이 있어요. 내가 더 중요하게 보는 쪽을 살펴보세요.'
      : '아직 확인하지 못한 답이 있어 차이가 없다고 말할 수 없어요.';
  return { status: 'ready', reason: null, columns, options, fields: [...selected], rows, same, summary };
}

/** Valid ongoing self declarations only. The host must recheck the same values,
 * consent and revision when the person explicitly publishes selected fields.
 * No effective/context layer, wants answer, private reason or reflection is read.
 */
export function getDisclosureDifferences(view) {
  const profilePublic = view?.consents?.profilePublic === true;
  const base = { status: 'unavailable', profilePublic, canEnablePublic: false, differences: [],
    notice: '답변 저장에 동의한 현재 계정의 평소 답만 따로 확인할 수 있어요.' };
  if (!plain(view) || view.status !== 'active' || view.consents?.storePreferences !== true || !Array.isArray(view.discovery?.fields)
    || !plain(view.profile?.values)) return base;
  const differences = [];
  for (const definition of DISCOVERY_FIELDS.filter(field => !field.legacy&&(field.kind === 'self'||field.kind==='regions'))) {
    const matches = view.discovery.fields.filter(field => field?.id === definition.id);
    if (matches.length !== 1) continue;
    const baseline = matches[0].baseline;
    if (!plain(baseline) || baseline.state !== 'known' || !valueLabel(definition.id, baseline.value)
      || baseline.provenance?.duration !== 'ongoing' || baseline.expired?.length) continue;
    const publicValue = own(view.profile.values, definition.id) ? view.profile.values[definition.id] : null;
    // A malformed public value must not be relabeled as an absent answer or be
    // echoed as private arbitrary data. The host can recover it separately.
    if (publicValue !== null && !valueLabel(definition.id, publicValue)) continue;
    if (definition.kind==='regions'?JSON.stringify(baseline.value)===JSON.stringify(publicValue):baseline.value===publicValue) continue;
    differences.push({ field: definition.id, label: definition.label, baselineValue: Array.isArray(baseline.value)?[...baseline.value]:baseline.value,
      baselineLabel: valueLabel(definition.id, baseline.value), publicValue: Array.isArray(publicValue)?[...publicValue]:publicValue,
      publicLabel: publicValue === null ? '아직 공개할 답을 저장하지 않았어요' : valueLabel(definition.id, publicValue) });
  }
  return { status: 'ready', profilePublic, canEnablePublic: false, differences,
    notice: profilePublic ? '선택한 평소 답만 확인 후 공개 프로필에 저장해요. 이번 상황의 답과 비공개 회고는 복사하지 않아요.'
      : '프로필 공개는 꺼져 있어요. 선택한 답을 저장해도 공개를 켜지 않아요.' };
}
