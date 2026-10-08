// Owner-only display of saved public declarations. No private preference input,
// candidate ranking, publication, inference or authorization is performed here.
import { DISCOVERY_FIELDS } from './discovery.mjs';
import { validateMeetingRegions, formatMeetingRegions } from './meeting-regions.mjs';

const fields = DISCOVERY_FIELDS.filter(field => field.id !== 'consent');
const data = (object, key) => {
  if (!object || typeof object !== 'object') return undefined;
  const slot = Object.getOwnPropertyDescriptor(object, key);
  return slot && Object.hasOwn(slot, 'value') ? slot.value : undefined;
};
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const instant = value => {
  if (typeof value !== 'string' || value.length > 32) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) && new Date(at).toISOString() === value ? at : null;
};
const text = (value, max) => typeof value === 'string' && value.length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) ? value.trim() : '';
const list = value => {
  if (!Array.isArray(value) || value.length > DISCOVERY_FIELDS.length) return null;
  const items = [];
  for (let i = 0; i < value.length; i++) {
    const item = data(value, String(i));
    if (typeof item !== 'string') return null;
    items.push(item);
  }
  return items;
};
const answer = (field, value) => {
  if (field.kind === 'regions') {
    try {
      const normalized = validateMeetingRegions(value);
      return { key: JSON.stringify(normalized), label: formatMeetingRegions(normalized) };
    } catch { return null; }
  }
  const option = field.options.find(option => option.value === value);
  return option ? { key: option.id, label: option.label } : null;
};
const unavailable = () => ({ status: 'unavailable', isPublic: false, title: '공개 내용 미리보기',
  notice: '현재 저장된 공개 내용을 확인하지 못했어요. 새로고침 후 다시 확인해 주세요.',
  profile: null, answers: [], expired: [], requiredUnknown: [] });

// These mirror dating-service's disclosed/publicAccount gates. This display
// does not replace the server's authorization or counterpart-specific checks.
function nonPublicReason(view, at) {
  if (data(view, 'status') !== 'active') return '현재 계정을 사용할 수 없어 공개하지 않아요.';
  const central = data(view, 'centralAvailability');
  if (central != null && (data(central, 'status') !== 'active' || data(central, 'resumeRequired') !== false))
    return '계정 연결 또는 공개 재개 확인이 필요해 현재 공개하지 않아요.';
  const adult = data(view, 'adult'), verification = data(adult, 'verification');
  if (data(adult, 'selfDeclared') !== true) return '성인 여부 확인을 마치지 않아 현재 공개하지 않아요.';
  if (data(verification, 'required') === true) {
    const end = instant(data(verification, 'validUntil'));
    if (data(verification, 'status') !== 'verified' || data(adult, 'verified') !== true || end === null || end <= at)
      return '성인 확인을 마치지 않아 현재 공개하지 않아요.';
    if (data(verification, 'resumeRequired') !== false) return '성인 확인 뒤 공개 재개를 확인하기 전이라 현재 공개하지 않아요.';
  } else if (data(verification, 'required') !== false) return '공개 상태를 확인하지 못해 현재 공개 중으로 표시하지 않아요.';
  if (data(view, 'paused') !== false) return '지금은 쉬는 중이라 공개하지 않아요.';
  if (data(data(view, 'consents'), 'profilePublic') !== true) return '프로필 공개를 꺼 두어 현재 공개하지 않아요.';
  return null;
}

/**
 * Show only canonical saved public answers present in the server's current
 * public projection, checked again against its own clock and public deadline.
 * Expired answers retain field/required labels, never their former values.
 */
export function getPublicProfilePreview(view) {
  const profile = data(view, 'profile'), projected = data(view, 'publicAnswers'), at = instant(data(view, 'asOf'));
  if (data(view, 'status') === 'deleted' || !plain(profile) || !plain(projected) || at === null) return unavailable();
  const saved = data(profile, 'values'), current = data(projected, 'values'), expirations = data(profile, 'expirations') ?? {},
    savedRequired = list(data(profile, 'required')), projectedRequired = list(data(projected, 'required')),
    projectedExpired = list(data(projected, 'expiredFields'));
  const nickname = text(data(profile, 'nickname'), 60);
  if (!nickname || !plain(saved) || !plain(current) || !plain(expirations) || !savedRequired || !projectedRequired || !projectedExpired)
    return unavailable();
  const required = new Set([...savedRequired, ...projectedRequired]), markedExpired = new Set(projectedExpired),
    answers = [], expired = [], requiredUnknown = [];
  for (const field of fields) {
    const raw = answer(field, data(saved, field.id)), exposed = answer(field, data(current, field.id)),
      deadline = data(expirations, field.id), until = !Object.hasOwn(expirations, field.id) || deadline === null ? null : deadline,
      end = until === null ? null : instant(until), mandatory = field.kind === 'wants' && required.has(field.id),
      ended = markedExpired.has(field.id) || end !== null && end <= at;
    // Only valid saved public fields may appear. A projection cannot resurrect
    // an old value or introduce a field missing from the saved public profile.
    if (ended && raw) expired.push({ field: field.id, label: field.label, required: mandatory });
    const usable = raw && exposed && raw.key === exposed.key && !ended && (until === null || end !== null && end > at);
    if (usable) answers.push({ field: field.id, label: field.label, valueLabel: exposed.label, required: mandatory, until });
    else if (mandatory) requiredUnknown.push({ field: field.id, label: field.label, required: true });
  }
  const reason = nonPublicReason(view, at), isPublic = reason === null;
  return { status: 'ready', isPublic, title: isPublic ? '내 공개 내용 미리보기' : '저장한 공개용 내용 미리보기',
    notice: `${reason || '현재 공개하도록 설정한 내용이에요.'} 상대별 추천 순서나 소개 가능 여부는 달라질 수 있어요.`,
    profile: { nickname, region: text(data(profile, 'region'), 80), intro: text(data(profile, 'intro'), 400) },
    answers, expired, requiredUnknown };
}
