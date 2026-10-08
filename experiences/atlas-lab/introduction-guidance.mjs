// Product copy and navigation only. The host passes current authorized facts;
// this helper neither authorizes introductions nor inspects counterpart records.
import { validateMeetingRegions, compareMeetingRegions } from './meeting-regions.mjs';
import { DISCOVERY_FIELDS } from './discovery.mjs';

// Read explicitly supplied data properties only. Unknown/extra getters, objects,
// identifiers and historical region strings cannot become a reason or a value.
const data = (object, key) => {
  try { const slot = Object.getOwnPropertyDescriptor(object, key); return slot && Object.hasOwn(slot, 'value') ? slot.value : undefined; }
  catch { return undefined; }
};
const regions = value => { try { return validateMeetingRegions(value); } catch { return null; } };
const guidance = (id, title, body, action) => ({ id, title, body, action });
const refresh = () => guidance('introduction-confirmation-pending', '지금 소개를 시작할 수 있는지 확인해요.',
  '추천에서 비교할 수 있어도 소개에 필요한 확인이 남아 있을 수 있어요. 내 기준을 바꾸지 않고 최신 소개 상태를 확인해 주세요.',
  { kind: 'refresh', label: '최신 소개 상태 확인' });
const disclosure = (id, title, body) => guidance(id, title, body,
  { kind: 'navigate', page: 'profile', target: 'disclosure', label: '공개할 만남 지역 확인' });
const pair = (id, title, body, label) => guidance(id, title, body, { kind: 'focus-pair', label });
const expiredFieldDefinitions = [DISCOVERY_FIELDS.find(field => field.id === 'availability'),
  ...DISCOVERY_FIELDS.filter(field => field.kind === 'wants'), DISCOVERY_FIELDS.find(field => field.id === 'self.meetingRegions')];
const expiredFields = value => {
  try {
    const length = data(value, 'length');
    if (!Array.isArray(value) || !Number.isSafeInteger(length) || length < 1 || length > expiredFieldDefinitions.length) return [];
    const fields = Array.from({ length }, (_, index) => data(value, String(index)));
    if (fields.some(id => !expiredFieldDefinitions.some(field => field.id === id)) || new Set(fields).size !== fields.length) return [];
    return expiredFieldDefinitions.filter(field => fields.includes(field.id));
  } catch { return []; }
};

/**
 * Minimum current projection: canConnect, ownReceiveInvitations,
 * ownPrivateRegions, ownPublicRegions, peerPublicRegions, ownExpiredPublicFields
 * (only current owner availability/required wants/meeting-area expirations), and introduction
 * {hasHistory, canReopen, canRespond, canDecline, canWithdraw, accepted, status}.
 * No peer private fact, name, ID or region value is returned. Navigation does
 * not enable consent, publish a profile, widen an area or repeat an old request.
 */
export function getIntroductionGuidance(input) {
  const canConnect = data(input, 'canConnect');
  if (canConnect === true) return null;
  // An incomplete/stale host projection must not manufacture a concrete cause.
  if (canConnect !== false) return refresh();
  if (data(input, 'ownReceiveInvitations') === false) return guidance('own-invitations-off', '내 초대 설정을 확인해요.',
    '내 초대받기가 꺼져 있어 지금 소개 요청을 보낼 수 없어요. 원하는 공개·초대 범위를 직접 확인해 주세요.',
    { kind: 'navigate', page: 'settings', label: '내 초대 설정 확인' });

  // A still-authorized existing introduction is not retrospectively cancelled
  // by the meeting-area checks required for a new introduction.
  const introduction = data(input, 'introduction');
  if (data(introduction, 'hasHistory') === true) {
    if (data(introduction, 'canReopen') === true) return pair('own-introduction-reopen', '이전 소개의 내 받기 상태를 확인해요.',
      '이 소개의 받기를 직접 다시 확인할 수 있어요. 다시 열어도 이전 요청이나 수락은 자동으로 돌아오지 않아요.', '내 소개받기 다시 열기 확인');
    if (data(introduction, 'accepted') === true) return pair('existing-introduction-accepted', '이미 확인한 소개를 이어서 살펴봐요.',
      '서로 수락한 소개의 현재 상태와 약속을 그 화면에서 확인해 주세요. 새로운 요청을 대신 보내지 않아요.', '이 소개와 약속 확인');
    if (data(introduction, 'canRespond') === true || data(introduction, 'canDecline') === true) return pair('existing-introduction-response',
      '받은 소개 요청을 먼저 확인해요.', '지금 받은 요청에서 직접 선택할 수 있는 응답을 확인해 주세요. 새로운 요청이나 수락으로 대신 처리하지 않아요.', '받은 소개 요청 확인');
    if (data(introduction, 'canWithdraw') === true && data(introduction, 'status') === 'pending') return pair('existing-introduction-pending',
      '보낸 소개 요청을 확인해요.', '이미 보낸 소개의 현재 상태를 확인할 수 있어요. 응답이 없는 이유나 상대의 마음을 추측하지 않고 같은 요청을 다시 보내지 않아요.', '보낸 소개 요청 확인');
  }

  const expired = expiredFields(data(input, 'ownExpiredPublicFields'));
  if (expired.length) return guidance('own-public-answer-expired', '내 공개 답의 기한을 다시 확인해요.',
    `내가 공개한 ${expired.map(field => `‘${field.label}’`).join(' · ')} 답의 기한이 지났어요. 현재 공개 비교에 사용하지 않으며, 필수 지정은 그대로 유지해요. 내 추천용 답을 바꾸지 않고 공개할 답과 기한을 따로 확인해 주세요.`,
    { kind: 'navigate', page: 'profile', target: 'disclosure', field: expired[0].id, label: '공개 답과 기한 다시 확인' });

  const mine = regions(data(input, 'ownPrivateRegions'));
  const published = regions(data(input, 'ownPublicRegions'));
  const peerPublished = regions(data(input, 'peerPublicRegions'));
  if (!mine && (published || peerPublished)) return guidance('own-meeting-regions-missing', '내가 만날 수 있는 지역을 확인해요.',
    '직접 공개한 지역과 비교하려면 현재 만날 수 있는 내 지역을 골라야 해요. 공개 답이나 지역 소개글로 내 선택을 대신 채우지 않아요.',
    { kind: 'answer', field: 'self.meetingRegions', label: '내 만남 가능 지역 고르기' });
  if (mine && !published) return disclosure('own-public-meeting-regions-missing', '공개할 만남 지역을 따로 확인해요.',
    '내 추천용 지역은 골랐지만 상대가 비교할 공개 지역은 아직 정하지 않았어요. 공개할 답을 따로 확인해 주세요. 이동할 수 있는 범위를 자동으로 넓히지 않아요.');
  if (mine && published && compareMeetingRegions(mine, published).status === 'disjoint') return disclosure('own-meeting-regions-disjoint',
    '내 추천용 지역과 공개 지역을 확인해요.',
    '현재 추천에 쓰는 내 지역과 내가 공개한 지역이 겹치지 않아요. 지금 가능한 범위와 공개할 답을 각각 확인해 주세요. 공개나 초대를 자동으로 켜지 않아요.');
  // This includes a counterpart's undisclosed private incompatibility, closed
  // receiving permission, pause, missing confirmation and retry cooldown.
  return refresh();
}
