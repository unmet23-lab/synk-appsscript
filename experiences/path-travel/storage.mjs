import { normalizeProfile, formatMoney, VERSION } from './model.mjs';
import { createPersonalization, validatePersonalization } from './profile.mjs';

export const STORAGE_KEY = 'synk-path-travel-local-v1';
const browserStorage = () => globalThis.localStorage;

function validateState(state) {
  if (!state || ![VERSION, 'path-travel-local-2', 'path-travel-local-1'].includes(state.version) || state.consent !== true) throw new TypeError('이 저장 기록은 다시 확인해야 해요.');
  if (state.lockedHotelId !== null && (typeof state.lockedHotelId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(state.lockedHotelId))) throw new TypeError('숙소 선택 기록을 확인해 주세요.');
  return { consent: true, profile: normalizeProfile(state.profile), lockedHotelId: state.lockedHotelId, personalization: validatePersonalization(state.personalization ?? createPersonalization()), migrated: state.version !== VERSION };
}

export function loadSavedTrip(storage = browserStorage()) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  if (raw.length > 1000000) throw new TypeError('저장 기록이 너무 커서 불러오지 않았어요.');
  try { return validateState(JSON.parse(raw)); }
  catch { throw new TypeError('이 기기의 여행 기록을 읽을 수 없어요. 기록을 지우고 다시 시작해 주세요.'); }
}

/** Called only by an explicit save action after the product's consent checkbox. */
export function saveTrip({ profile, lockedHotelId = null, personalization = createPersonalization() }, storage = browserStorage()) {
  const record = { version: VERSION, consent: true, profile: normalizeProfile(profile), lockedHotelId, personalization: validatePersonalization(personalization) };
  validateState(record);
  const encoded = JSON.stringify(record);
  if (encoded.length > 1000000) throw new TypeError('저장할 기록이 커졌어요. 현재 조건을 내보내고 새 기록으로 시작해 주세요.');
  storage.setItem(STORAGE_KEY, encoded);
  return validateState(record);
}

export function clearSavedTrip(storage = browserStorage()) {
  storage.removeItem(STORAGE_KEY);
}

export function exportPlan(plan, input) {
  if (!plan?.isFixture || !Array.isArray(plan.stops)) throw new TypeError('먼저 여행안을 만들어 주세요.');
  const profile = normalizeProfile(input);
  return [
    'SYNK PATH · 서울 개인화 여행 시제품',
    '가상 업체·가상 가격·시험용 시간표입니다. 실제 예약·길안내용이 아닙니다.',
    '성인 1명 / 서울 하루 일정 + 숙소 1박 / 객실 1개 / KRW',
    `예산 ${formatMoney(profile.budget)} / 가상 합계 ${formatMoney(plan.totalCost)}`,
    '세금·필수 수수료 포함 가정. 항공·서울 도착/출발 교통·다음 날 식사·자유시간 추가 소비 제외.',
    '', plan.title, ...plan.reasons.map(reason => '- ' + reason), '',
    '반영 조건과 확인할 점', ...(plan.fitDetails ?? []).map(item => `- ${item.label}: ${item.wanted} / ${item.fit === 'met' ? '반영' : item.fit === 'unknown' ? '미확인' : '차이 있음'} / ${item.duration === 'ongoing' ? '평소' : '이번 여행'}`), '',
    ...plan.stops.map(stop => `${stop.time}  ${stop.name} / ${stop.area} / ${stop.duration}분 / ${formatMoney(stop.cost)}`),
    '', '확인할 점', ...plan.tradeoffs.map(point => '- ' + point),
    '', '이 파일에는 계정·위치 이력·다른 앱의 개인 자료가 포함되지 않습니다.',
  ].join('\n');
}
