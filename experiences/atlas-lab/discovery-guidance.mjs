import { DISCOVERY_FIELDS } from './discovery.mjs';
import { validateMeetingRegions } from './meeting-regions.mjs';

// Product copy and one next action from an already authorized projection.
// No replay, model inference, automatic consent, or relaxation of must-haves.
const own = (value, key) => value !== null && typeof value === 'object' && Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const specs = new Map(DISCOVERY_FIELDS.map(field => [field.id, field]));
const guidance = (id, title, body, action, counts) => ({ id, title, body, action, ...(counts ? { counts } : {}) });
const navigate = (page, label) => ({ kind: 'navigate', page, label });
const answer = (field, label) => ({ kind: 'answer', field, label });
const unavailable = () => guidance('projection-unavailable', '추천 상태를 다시 확인해 주세요.', '현재 화면 정보만으로 추천이 없는 이유를 확인할 수 없어요.', { kind: 'refresh', label: '최신 상태 확인하기' });
const validAnswer=(field,value)=>{if(specs.get(field)?.kind==='regions'){try{validateMeetingRegions(value);return true;}catch{return false;}}return specs.get(field)?.options.some(option=>option.value===value)||false;};
const known = field => object(field) && field.state === 'known' && validAnswer(field.id,field.value);
const requiredKnown = field => known(field) && (specs.get(field.id)?.kind !== 'wants' || field.required !== true
  || own(field, 'requiredValue') && specs.get(field.id).options.some(option => option.value === field.requiredValue));
const projectedRows = discovery => {
  if (!object(discovery) || !Array.isArray(discovery.fields) || !Array.isArray(discovery.candidates)) return null;
  const rows = discovery.candidates.filter(row => object(row) && typeof row.id === 'string' && ['eligible', 'pending', 'excluded'].includes(row.status));
  return rows.length === discovery.candidates.length && new Set(rows.map(row => row.id)).size === rows.length ? rows : null;
};
const fieldItem = field => ({ field, label: specs.get(field).label });

// A missing public fact is attributed only when this current authorized public
// profile lacks it and a structured unknown comparison uses my confirmed hard
// answer. Candidate names, criteria values and free-form reason text stay out.
function pendingEvidence(view, discovery, fields, rows) {
  const ownFields = new Set(), publicFields = new Set(); let unclassified = false;
  const q = discovery.question;
  if (object(q) && q.optional === false && fields.has(q.field) && !requiredKnown(fields.get(q.field))) ownFields.add(q.field);
  for (const field of fields.values()) if (field.required === true && !requiredKnown(field)) ownFields.add(field.id);
  if(discovery.meetingRegions?.needsOwnAnswer===true && fields.has('self.meetingRegions')&&!known(fields.get('self.meetingRegions')))ownFields.add('self.meetingRegions');
  const publicProfiles = own(view, 'discovery') && Array.isArray(view.candidates) ? view.candidates : [];
  for (const row of rows.filter(item => item.status === 'pending')) {
    const matchingProfiles = publicProfiles.filter(person => object(person) && (person.accountId || person.id) === row.id);
    const profile = matchingProfiles.length === 1 && object(matchingProfiles[0].values) ? matchingProfiles[0] : null;
    let explained = false;
    for (const detail of Array.isArray(row.reasonDetails) ? row.reasonDetails : []) {
      if (!object(detail) || detail.comparison !== 'unknown' || !specs.has(detail.field)) continue;
      const publicScheduleMissing = profile && detail.field === 'availability' && detail.owner === 'self' && detail.editable === true && detail.required === true
        && known(fields.get('availability')) && detail.value === fields.get('availability').value && !own(profile.values, 'availability');
      if (publicScheduleMissing) {
        publicFields.add('availability'); explained = true;
      }
      const publicRegionsMissing=profile&&detail.field==='self.meetingRegions'&&detail.owner==='self'&&detail.editable===true&&detail.required===true
        &&known(fields.get(detail.field))&&JSON.stringify(detail.value)===JSON.stringify(fields.get(detail.field).value)&&!own(profile.values,detail.field);
      if(publicRegionsMissing){publicFields.add(detail.field);explained=true;}
      if (detail.owner === 'self' && detail.required === true && ownFields.has(detail.field)) explained = true;
      if (detail.owner === 'partner' && detail.required === true && specs.get(detail.field).kind === 'wants') {
        const ownField = detail.field.replace('wants.', 'self.');
        if (ownFields.has(ownField)) explained = true;
        else unclassified = true;
      }
      const field = fields.get(detail.field), actual = detail.field.replace('wants.', 'self.');
      if (profile && detail.owner === 'self' && detail.editable === true && detail.required === true
        && specs.get(detail.field).kind === 'wants' && field?.required === true && requiredKnown(field)
        && field.requiredValue !== 'any' && detail.value === field.requiredValue && !own(profile.values, actual)) {
        publicFields.add(detail.field); explained = true;
      } else if (detail.required === true && detail.owner === 'self' && !ownFields.has(detail.field)
        && !publicScheduleMissing&&!publicRegionsMissing) unclassified = true;
    }
    if (!explained) unclassified = true;
  }
  return { own: [...ownFields].map(field => ({ ...fieldItem(field), action: answer(field, '내 답 확인하기') })),
    public: [...publicFields].map(fieldItem), unclassified };
}

export function getDiscoveryGuidance(view) {
  if (!object(view)) return unavailable();
  const hosted = own(view, 'discovery');
  if (hosted) {
    if (view.status === 'deleted' || view.deleted === true) return guidance('account-deleted', '소개팅 기록을 삭제했어요.', '기존 추천과 선택을 다시 표시하지 않아요.', navigate('settings', '내 설정 확인하기'));
    if (view.status === 'suspended') return guidance('account-unavailable', '현재 추천을 이용할 수 없어요.', '이용 상태와 기록 관리는 내 설정에서 확인할 수 있어요.', navigate('settings', '이용 상태 확인하기'));
    if (view.centralAvailability && view.centralAvailability.status !== 'active') return guidance('central-account-unavailable', '현재 추천을 이용할 수 없어요.', '공통 계정의 이용 상태를 확인한 뒤 추천을 다시 불러와 주세요.', navigate('settings', '이용 상태 확인하기'));
    if (view.onboarding?.complete === false || view.adult?.selfDeclared === false || object(view.profile) && view.profile.nickname === '')
      return guidance('onboarding-required', '시작할 때 확인할 정보가 남았어요.', '내 소개와 성인 여부에 대한 직접 확인을 먼저 마쳐 주세요.', navigate('discover', '시작 정보 확인하기'));
    if (view.adult?.verification?.required === true && view.adult.verification.status !== 'verified')
      return guidance('adult-verification-required', '성인 확인이 남아 있어요.', '현재 성인 확인 상태를 내 설정에서 확인해 주세요. 필요한 확인이 끝나기 전에는 후보를 안내하지 않아요.', navigate('settings', '성인 확인 상태 보기'));
    if (view.paused === true) return guidance('discovery-paused', '지금은 추천을 쉬고 있어요.', '쉬는 설정을 바꾸기 전까지 새로운 추천을 진행하지 않아요.', navigate('settings', '쉬는 설정 확인하기'));
    if (view.consents?.storePreferences === false) return guidance('storage-consent-off', '추천 답변 저장을 꺼 두었어요.', '답변 저장 범위를 확인한 뒤 직접 켤 수 있어요. 여기서 동의를 대신 바꾸지 않아요.', navigate('settings', '답변 저장 범위 정하기'));
    if (view.consents?.profilePublic === false)
      return guidance('profile-not-public', '내 소개를 공개하지 않은 상태예요.', '현재 추천은 서로 공개한 소개로 비교해요. 공개할 범위를 먼저 직접 정해 주세요.', navigate('settings', '소개 공개 범위 정하기'));
  }
  const discovery = hosted ? view.discovery : view;
  if (!object(discovery) || !Array.isArray(discovery.fields) || !Array.isArray(discovery.candidates)) return unavailable();
  const fields = new Map(discovery.fields.filter(field => object(field) && specs.has(field.id)).map(field => [field.id, field]));
  const consent = fields.get('consent');
  if (!consent || consent.state !== 'known' || consent.value !== true)
    return guidance(consent?.state === 'known' && consent.value === false ? 'discovery-consent-off' : 'discovery-consent-missing',
      consent?.state === 'known' && consent.value === false ? '후보 살펴보기를 꺼 두었어요.' : '후보를 살펴볼지 먼저 확인해요.',
      '살펴보기 여부는 내가 직접 정해요. 확인하기 전에는 후보를 안내하지 않아요.', answer('consent', '살펴보기 여부 정하기'));
  if (discovery.context?.closed === true) return guidance('context-ended', '이번 추천 회차가 끝났어요.', '이번 회차의 선택은 끝났고 평소 기준은 남아 있어요. 새 회차에서도 필수조건은 유지해요.', { kind: 'start-context', label: '평소 기준으로 새 회차 시작하기' });
  const conflict = Array.isArray(discovery.context?.conflicts) && discovery.context.conflicts.find(id => fields.has(id) && specs.get(id)?.kind === 'wants');
  if (conflict) return guidance('context-conflict', '이번 선택이 평소 필수조건과 달라요.', `${specs.get(conflict).label}에서 서로 다른 답을 고른 상태예요. 이번 선택만 취소하면 평소 필수조건을 그대로 사용할 수 있어요.`,
    { kind: 'revert-context', field: conflict, label: '이 항목의 이번 선택 취소하기' });
  const availability = fields.get('availability');
  if (!availability || availability.state !== 'known' || !['weekend', 'weekday', 'any'].includes(availability.value))
    return guidance('own-availability-missing', '내가 가능한 일정이 아직 없어요.', '서로 가능한 때가 겹치는지 비교하려면 내 일정을 직접 골라야 해요. 모르는 답을 가능하다는 뜻으로 채우지 않아요.', answer('availability', '가능한 일정 고르기'));
  if(discovery.legacyRelationship?.required===true)return guidance('legacy-relationship-confirmation-required','이전 관계 필수조건을 직접 확인해 주세요.','예전 답에는 관계 목적과 시작 속도가 섞여 있어요. 새 두 답으로 자동 해석하지 않고 이전 필수조건을 유지하고 있어요. 해제 여부를 먼저 확인한 뒤 목적과 속도를 각각 고를 수 있어요.',answer('wants.purpose','이전 필수조건 확인하기'));
  if(discovery.meetingRegions?.needsOwnAnswer===true&&!known(fields.get('self.meetingRegions')))return guidance('own-meeting-regions-missing','내가 만날 수 있는 지역을 확인해요.','지역 소개글로 가능 지역을 추정하지 않아요. 상대가 직접 공개한 지역과 비교하려면 내 실제 가능 지역을 골라 주세요.',answer('self.meetingRegions','만남 가능 지역 고르기'));
  const missing = [...fields.values()].find(field => field.id !== 'consent' && field.id !== 'availability' && field.required === true
    && (field.state !== 'known' || field.value === null || own(field, 'requiredValue') && field.requiredValue === null));
  if (missing) return guidance('own-required-answer-missing', '꼭 지킬 조건의 답을 다시 확인해요.', `${specs.get(missing.id).label}을 필수로 정했지만 답은 아직 미확인이에요. 필수 지정은 그대로 유지해요.`, answer(missing.id, '이 필수조건의 답 확인하기'));
  const rows = discovery.candidates.filter(row => object(row) && typeof row.id === 'string' && ['eligible', 'pending', 'excluded'].includes(row.status));
  if (rows.length !== discovery.candidates.length || new Set(rows.map(row => row.id)).size !== rows.length) return unavailable();
  if (rows.some(row => row.status === 'eligible')) return null;
  const excludedIds = new Set(Array.isArray(discovery.exclusions) ? discovery.exclusions : []);
  const counts = { visible: rows.length, eligible: 0, pending: rows.filter(row => row.status === 'pending').length,
    excluded: rows.filter(row => row.status === 'excluded').length, skipped: rows.filter(row => excludedIds.has(row.id)).length };
  if (!rows.length) return guidance('visible-pool-empty', '지금 비교할 공개 후보가 없어요.', '현재 공개된 후보 목록이 비어 있어요. 다른 사람의 비공개 상태나 마음은 판단하지 않아요. 내 필수조건은 그대로 두어도 돼요.',
    { kind: 'refresh', label: '공개 후보 다시 확인하기' }, counts);
  if (rows.some(row => row.reasonCode === 'snoozed')) return guidance('candidates-temporarily-hidden', '기간을 정해 다시 보지 않기로 한 후보가 있어요.',
    '이 숨김은 새 회차에서도 유지돼요. 내 기준의 숨김 관리에서 기간을 확인하거나 직접 취소할 수 있어요. 숨김을 취소해도 서로의 필수조건을 다시 확인해요.',
    navigate('profile', '기간 숨김 확인하기'), counts);
  if (counts.skipped) {
    const canInspectExclusions = Array.isArray(discovery.excludedCandidates) && discovery.excludedCandidates.some(item => object(item)
      && typeof item.feedbackId === 'string' && /^event-[1-9][0-9]*$/.test(item.feedbackId) && item.status === 'excluded'
      && excludedIds.has(item.id) && rows.some(row => row.id === item.id && row.status === 'excluded' && row.label === item.label));
    return guidance(counts.skipped === rows.length ? 'all-current-candidates-skipped' : 'current-candidates-skipped',
      counts.skipped === rows.length ? '이번 회차에서 후보를 모두 넘겼어요.' : '이번 회차에서 직접 넘긴 후보가 있어요.',
      canInspectExclusions
        ? '넘긴 사람을 확인하고 원하는 사람의 이번 제외만 취소할 수 있어요. 다른 답과 다른 후보 제외는 유지하며, 지금 공개된 조건으로 다시 비교해요. 이번만 답과 넘김을 모두 마치려면 화면 아래에서 새 회차를 따로 시작해 주세요.'
        : '새 회차를 시작하면 이번에만 고른 답과 넘김은 끝나고 평소 기준으로 다시 비교해요. 필수조건을 바꾸거나 이전 후보 선택을 복원하지 않아요.',
      canInspectExclusions ? { kind: 'focus-excluded', label: '이번에 넘긴 사람 확인하기' }
        : { kind: 'start-context', label: '평소 기준으로 새 회차 시작하기' }, counts);
  }
  const q = discovery.question, ownRequiredQuestion = object(q) && q.optional === false && fields.has(q.field) && fields.get(q.field).state !== 'known';
  if (counts.pending && ownRequiredQuestion) return guidance('reciprocal-answer-missing', '서로의 조건을 비교할 내 답이 남았어요.', `${specs.get(q.field).label}을 직접 확인하면 상대가 공개한 조건과 비교할 수 있어요. 상대의 호감이나 수락 여부를 뜻하지는 않아요.`, answer(q.field, '내 답 확인하기'), counts);
  // Account profiles and synthetic demo roles are different pools. Match exact
  // currently projected IDs before attributing missing public schedule fields.
  const evidence = pendingEvidence(view, discovery, fields, rows);
  if (evidence.public.some(item => item.field === 'availability')) return guidance('public-schedule-missing', '상대가 공개한 일정 확인이 더 필요해요.', '현재 보류된 후보 중 가능한 일정을 아직 공개하지 않은 경우가 있어요. 가능한 일정이라고 대신 판단하지 않고 확인될 때까지 보류해요.',
    { kind: 'refresh', label: '공개 정보 다시 확인하기' }, counts);
  if (counts.pending) {
    const publicAnswer = evidence.public.find(item => item.field !== 'availability');
    return guidance('required-confirmation-pending', publicAnswer ? '공개 답이 더 필요해 추천을 보류했어요.' : '필수 확인이 남아 추천을 보류했어요.', publicAnswer
      ? `내 ‘${publicAnswer.label}’ 필수 답은 확인됐어요. 보류된 후보 중 이 기준과 비교할 공개 답이 없는 경우가 있어요. 확인될 때까지 보류하며 내 필수조건은 유지해요.`
      : '현재 공개된 답만으로 서로의 필수조건을 모두 확인할 수 없어요. 미확인을 가능하다는 뜻으로 바꾸지 않아요.',
      { kind: 'refresh', label: '확인된 정보 다시 살펴보기' }, counts);
  }
  return guidance('required-conditions-unmatched', '지금은 서로의 필수조건을 충족하는 후보가 없어요.', '어느 한쪽의 필수조건도 몰래 낮추지 않아요. 내 기준이 정확하게 기록됐는지 살펴보고, 그대로 유지해도 괜찮아요.', navigate('profile', '내 기준 확인하기'), counts);
}

const unavailablePart = () => ({ status: 'unavailable', title: '현재 상태 확인 필요', body: '최신 정보에서 확인할 수 있어요.' });
const emptyPending = () => ({ own: [], public: [], unclassified: false });
const accessIds = new Set(['projection-unavailable', 'account-deleted', 'account-unavailable', 'central-account-unavailable', 'adult-verification-required']);
const preparationIds = new Set(['onboarding-required', 'discovery-paused', 'storage-consent-off', 'profile-not-public', 'discovery-consent-off',
  'discovery-consent-missing', 'own-availability-missing', 'own-required-answer-missing', 'own-meeting-regions-missing', 'legacy-relationship-confirmation-required', 'context-ended', 'context-conflict']);

// Read-only product progress. Answer counts and hypothetical model confidence
// cannot make preparation complete; ready requires the current decision and an
// actually eligible row. Further confirmations can remain for other candidates.
export function getDiscoveryReadiness(view) {
  const next = getDiscoveryGuidance(view);
  const stopped = result => ({ status: accessIds.has(result.id) ? 'unavailable' : 'needs-action', title: result.title, body: result.body,
    preparation: { status: accessIds.has(result.id) ? 'unavailable' : 'needed', items: accessIds.has(result.id) ? []
      : [{ id: result.id, label: result.title, status: 'needed', action: { ...result.action } }] },
    recommendation: { ...unavailablePart(), ...(accessIds.has(result.id) ? {} : { status: 'blocked' }) },
    optional: unavailablePart(), pending: emptyPending() });
  if (next && accessIds.has(next.id)) return stopped(next);
  const hosted = own(view, 'discovery');
  // Never inspect latent candidate data while a private/account preparation gate
  // is closed, including paused discovery or unfinished public consent.
  if (next && ['onboarding-required', 'discovery-paused', 'storage-consent-off', 'profile-not-public'].includes(next.id)) return stopped(next);
  const discovery = hosted ? view.discovery : view;
  const rows = projectedRows(discovery);
  if (!rows || !['ready', 'needs-confirmation', 'blocked'].includes(discovery.status)) return stopped(unavailable());
  const fields = new Map(discovery.fields.filter(field => object(field) && specs.has(field.id)).map(field => [field.id, field]));
  if (new Set(discovery.fields.map(field => field?.id)).size !== discovery.fields.length) return stopped(unavailable());
  if (hosted && (view.status !== 'active' || view.adult?.selfDeclared !== true || view.onboarding?.complete !== true
    || typeof view.profile?.nickname !== 'string' || !view.profile.nickname
    || view.consents?.storePreferences !== true || view.consents?.profilePublic !== true)) return stopped(unavailable());
  if (next && preparationIds.has(next.id)) return stopped(next);
  const consent = fields.get('consent'), availability = fields.get('availability');
  if (!known(consent) || consent.value !== true || !known(availability)) return stopped(unavailable());
  if ([...fields.values()].some(field => field.required === true && !requiredKnown(field))) return stopped(unavailable());
  if (discovery.question !== null && discovery.question !== undefined && (!object(discovery.question)
    || !fields.has(discovery.question.field) || typeof discovery.question.optional !== 'boolean')) return stopped(unavailable());
  const eligible = rows.some(row => row.status === 'eligible');
  if ((discovery.status === 'ready') !== eligible) return stopped(unavailable());
  const pending = pendingEvidence(view, discovery, fields, rows), needAnswer = next?.id === 'reciprocal-answer-missing';
  const preparation = { status: needAnswer ? 'needed' : 'confirmed', items: [
    ...(hosted ? [{ id: 'start-information', label: '내 소개와 성인 여부 직접 확인', status: 'confirmed' },
      { id: 'public-storage-consents', label: '내 소개 공개와 추천 답변 저장 범위', status: 'confirmed' }] : []),
    { id: 'comparison-answers', label: '현재 추천에 필요한 내 답', status: needAnswer ? 'needed' : 'confirmed', ...(needAnswer ? { action: { ...next.action } } : {}) },
  ] };
  const recommendation = eligible
    ? { status: 'ready', title: '현재 답으로 추천 가능', body: '지금 확인된 답으로 비교할 후보가 있어요. 추가 질문은 원하는 만큼만 살펴볼 수 있어요.' }
    : { status: rows.some(row => row.status === 'pending') ? 'waiting' : rows.length ? 'blocked' : 'empty',
      title: next?.title || '현재 추천 확인 필요', body: next?.body || '현재 공개된 정보에서 다시 확인해 주세요.', ...(next?.action ? { action: { ...next.action } } : {}) };
  const q = discovery.question;
  const optional = discovery.questionsPaused === true || discovery.questionControl?.remaining === 0
    ? { status: 'paused', title: '추가 질문은 선택', body: discovery.questionsPaused === true ? '선택 질문을 쉬고 있어요. 현재 확인된 답은 그대로 사용해요.' : '오늘 고른 선택 질문을 마쳤어요. 현재 확인된 답은 그대로 사용해요.' }
    : object(q) && q.optional === true && fields.has(q.field) && !known(fields.get(q.field))
      ? { status: 'available', title: '추가 질문은 선택', body: '원하면 내 기준을 더 알아볼 수 있어요. 답하지 않아도 지금 확인된 비교 결과는 유지돼요.', action: answer(q.field, '선택 질문 살펴보기') }
      : { status: 'none', title: '추가 질문은 선택', body: '지금 안내할 선택 질문은 없어요. 모든 항목에 답해야 완료되는 방식은 아니에요.' };
  return { status: eligible ? 'ready' : needAnswer ? 'needs-action' : 'waiting', title: recommendation.title,
    body: recommendation.body, preparation, recommendation, optional, pending };
}
