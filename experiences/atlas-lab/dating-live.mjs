// Compare only the current authorized product views. No raw event, credential,
// inferred preference or counterpart private record is read or returned.
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const list = value => Array.isArray(value) ? value : [];
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value?.[key] ?? null]));
const canonical = value => JSON.stringify(value, (_key, item) => plain(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const keyed = (values, key) => new Map(list(values).filter(value => typeof value?.[key] === 'string').map(value => [value[key], value]));
const sort = (values, key) => list(values).map(value => ({ ...value })).sort((a, b) => String(a[key]).localeCompare(String(b[key])));

/** Terminal account access errors, not temporary connectivity failures or the
 * loss of one introduction. A closed pair also uses HTTP 410 on the server. */
export function isAccountAccessLost(error) {
  return error?.status === 401 || error?.status === 410 && !['pair-closed', 'target-unavailable'].includes(error?.code)
    || ['operator-required', 'account-suspended', 'account-unavailable', 'account-deleted'].includes(error?.code);
}

function ownBasis(view) {
  const discovery = view.discovery;
  return {
    status: view.status, paused: view.paused === true, adult: view.adult?.selfDeclared === true,
    adultVerification: pick(view.adult?.verification, ['required','status','validUntil','resumeRequired','canResume']),
    centralAvailability: pick(view.centralAvailability, ['status','resumeRequired','canResume']),
    consents: pick(view.consents, ['storePreferences', 'profilePublic', 'receiveInvitations']),
    profile: view.profile || null,
    onboarding: view.onboarding || null,
    publicAnswers: view.publicAnswers || null,
    discovery: discovery ? {
      context: pick(discovery.context, ['id', 'closed', 'expiresAt', 'endedReason']),
      fields: sort(list(discovery.fields).map(field => pick(field,
        ['id', 'source', 'effective', 'baseline', 'context', 'required', 'requiredValue'])), 'id'),
      priorities: discovery.priorities || null,
      conditionalPreference: discovery.conditionalPreference || null,
    } : null,
  };
}

function candidateBasis(candidate) {
  // The server's candidate projection contains only disclosed profile values.
  return pick(candidate, ['nickname', 'region', 'intro', 'values', 'required', 'adult', 'canConnect']);
}

function introductionBasis(introduction) {
  return { ...pick(introduction, ['accepted', 'canSend', 'canRespond', 'canWithdraw', 'canReopen']),
    current: introduction?.current ? pick(introduction.current, ['id', 'status', 'expiresAt']) : null };
}

function pairBasis(pair) {
  const projected = pair.view;
  return {
    status: pair.status, paused: pair.paused === true,
    introduction: introductionBasis(pair.introduction),
    scheduleDraftBasis: pair.scheduleDraftBasis || null,
    view: projected ? {
      canPropose: projected.canPropose,
      receiving: projected.me?.receiving || null,
      nextForm: projected.me?.nextForm || null,
      appointments: sort(list(projected.appointments).map(item => ({
        ...pick(item, ['id', 'status', 'canRespond', 'canRevise', 'canCancel', 'canComplete', 'canReflect']),
        proposal: pick(item.proposal, ['version', 'expiresAt']),
      })), 'id'),
    } : null,
    alignment: pick(pair.alignment, ['key', 'contextKey', 'proposalVersion', 'selectedOptionId', 'canRespond', 'canWithdraw', 'canProposeOption', 'canCancelOption']),
    criterionReviews: pair.criterionReviews || null,
    introductionCanDecline: pair.introduction?.canDecline ?? pair.introduction?.canRespond ?? false,
  };
}

function existingChanged(before, after, key, basis) {
  const next = keyed(after, key);
  for (const [id, item] of keyed(before, key)) {
    if (!next.has(id) || canonical(basis(item)) !== canonical(basis(next.get(id)))) return true;
  }
  return false;
}

function visible(view) {
  // pair.view.at and asOf are read clocks. Revisions and the rotating opaque
  // recommendation receipt alone are not a new answer or notification.
  const value = { ...view,
    ...(view.adult?.verification ? { adult: { ...view.adult, verification: { ...view.adult.verification, checkedAt: null } } } : {}),
    pairs: list(view.pairs).map(pair => ({ ...pair,
    ...(pair.view ? { view: { ...pair.view, at: null } } : {}) })) };
  return JSON.stringify(value, (_key, item) => {
    if (['revision', 'recommendationToken', 'asOf'].includes(_key)) return undefined;
    return plain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item;
  });
}

/** The host decides whether to hold ordinary new responses while someone is
 * typing. Invalidation means apply the new view and prune drafts against their
 * original source/permission keys; it does not mean erase every own draft. */
export function getLiveChange(before, after) {
  if (!plain(after) || !after.accountId || after.status === 'deleted' || after.deleted === true
    || before?.accountId && before.accountId !== after.accountId) {
    return { kind: 'identity-lost', message: '계정의 현재 이용 상태가 바뀌었어요. 이전 화면과 작성 중인 내용을 정리했어요.' };
  }
  if (!plain(before)) return { kind: 'notify', message: '현재 기록을 불러왔어요.' };
  if (after.centralAvailability && after.centralAvailability.status !== 'active'
    && canonical(ownBasis(before)) !== canonical(ownBasis(after))) {
    return { kind: 'invalidate', message: '계정 이용 상태가 바뀌어 작성 중인 내용과 전송 확인을 정리했어요.' };
  }
  if (canonical(ownBasis(before)) !== canonical(ownBasis(after))
    || existingChanged(before.candidates, after.candidates, 'accountId', candidateBasis)
    || existingChanged(before.savedCandidates?.items, after.savedCandidates?.items, 'id', item => pick(item, ['candidateId']))
    || existingChanged(before.pairs, after.pairs, 'pairId', pairBasis)) {
    return { kind: 'invalidate', message: '현재 답이나 공개·연결 상태가 바뀌어 최신 상태를 확인했어요. 그대로 유효한 작성 내용은 유지해요.' };
  }
  if (visible(before) === visible(after)) return { kind: 'unchanged', message: '' };
  return { kind: 'notify', message: '새 응답이나 기록이 있어요. 작성한 내용을 유지한 채 확인할 수 있어요.' };
}
