/** SYNK 플레저: 한국 시간 기준 관계 기록. 외부 전송과 AI 호출은 하지 않는다. */
import { LUNAR_RANGE, normalizeLunarDate, lunarDateInYear, lunarToSolar, solarToLunar } from './lunar.mjs';
import { resolveCareMemory } from './care-personalization.mjs';
export const EVENT_TYPES = Object.freeze({ birthday: '생일', wedding: '결혼', condolence: '부고', memorial: '기일', anniversary: '기념일' });
export const MESSAGE_TYPES = Object.freeze({ ...EVENT_TYPES, checkin: '오늘 그냥 안부' });
export const CHECKIN_INTENTS = Object.freeze({ everyday: '일상 안부', reconnect: '오랜만의 안부', thanks: '감사 인사', unspecified: '목적 미지정' });
const DAY = 86_400_000;
const MAX_TEXT = 50_000;
const choose = (value, options, fallback, label) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (!options.includes(value)) throw new Error(`${label} 값이 올바르지 않아요.`);
  return value;
};
function clean(value, label, max = 2000, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new Error(`${label}은 글자로 입력해 주세요.`);
  if (/\u0000|[\uD800-\uDFFF]/u.test(value)) throw new Error(`${label}에 저장할 수 없는 문자가 있어요. 해당 글자를 고쳐 주세요.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${label}을 입력해 주세요.`);
  if (result.length > max) throw new Error(`${label}은 ${max.toLocaleString('ko-KR')}자 이내로 입력해 주세요.`);
  return result;
}
function id(value, prefix) {
  if (value !== undefined && value !== '') {
    const result = clean(value, '식별자', 100, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw new Error('식별자가 올바르지 않아요.');
    return result;
  }
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
}
function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2199 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error('1900~2199년 사이의 실제 날짜를 입력해 주세요.');
  return { year, month, day };
}
const dateString = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const dateNumber = value => { const { year, month, day } = dateParts(value); return Date.UTC(year, month - 1, day); };
function clock(now = new Date()) {
  const value = now instanceof Date ? new Date(now) : new Date(now);
  if (!Number.isFinite(value.getTime())) throw new Error('기준 시간이 올바르지 않아요.');
  return value;
}
function today(now) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(clock(now));
  const get = type => parts.find(part => part.type === type).value;
  const result = `${get('year')}-${get('month')}-${get('day')}`;
  dateParts(result);
  return result;
}
const shiftDate = (value, days) => new Date(dateNumber(value) + days * DAY).toISOString().slice(0, 10);
const isLeap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

/** 새 저장 상태. 확인해서 보관한 글 원문만 포함하며 녹음 파일은 제외한다. */
export function emptyState() {
  return { version: 1, people: [], events: [], completions: [], drafts: [], sources: [], memories: [], activities: [], followups: [], preparations: [] };
}

/** 본인이 말한 텍스트만 받는다. 규칙으로 보이는 특징을 관찰하며 상대의 선호를 추론하지 않는다. */
export function analyzeTone(text) {
  const sample = clean(text, '본인 발화', MAX_TEXT, true);
  const sentences = sample.split(/[.!?。！？\n]+/u).map(item => item.trim()).filter(Boolean);
  const endings = sentences.map(item => item.replace(/[\p{Extended_Pictographic}\uFE0F\u200Dㅋㅎㅠㅜ~…\s]+$/gu, ''));
  const polite = endings.filter(item => /(?:요|니다|시오|십시오)$/.test(item)).length;
  const casual = endings.filter(item => !/(?:요|니다|시오|십시오)$/.test(item) && /(?:어|아|야|해|자|지|다|게|네|워|봐|까|음|슴)$/.test(item)).length;
  const formality = polite && casual ? 'mixed' : polite ? 'polite' : casual ? 'casual' : 'unknown';
  const average = sentences.reduce((sum, item) => sum + [...item].length, 0) / Math.max(1, sentences.length);
  const sentenceLength = average <= 24 ? 'short' : average <= 55 ? 'balanced' : 'long';
  const hasLaughter = /[ㅋㅎ]{2,}/.test(sample);
  const hasEmoji = /\p{Extended_Pictographic}/u.test(sample);
  const labels = { polite: '존댓말 표현이 보였어요', casual: '편한 말투가 보였어요', mixed: '존댓말과 편한 말투가 함께 보여요', unknown: '말투를 정하기에는 단서가 부족해요' };
  const observations = [labels[formality], `${sentences.length}개 문장에서 ${sentenceLength === 'short' ? '짧은' : sentenceLength === 'long' ? '긴' : '중간 길이의'} 문장이 주로 보였어요.`];
  if (hasLaughter) observations.push('ㅋㅋ·ㅎㅎ 같은 웃음 표현이 있어요.');
  if (hasEmoji) observations.push('이모지가 있어요.');
  return {
    source: 'rule-based', label: labels[formality], formality, sentenceLength, hasLaughter, hasEmoji,
    observations, sampleCount: sentences.length,
    limits: ['선택한 본인 발화의 표면 특징을 규칙으로 살펴본 결과예요.', '상대가 선호하는 말투나 성격을 판단한 결과가 아니에요.', '적은 예시나 대화 맥락에 따라 결과가 달라질 수 있어요.'],
  };
}

function preference(input = {}) {
  const avoidPhrases = input.avoidPhrases ?? [];
  if (!Array.isArray(avoidPhrases) || avoidPhrases.length > 20) throw new Error('피할 표현은 최대 20개까지 적어 주세요.');
  return {
    confirmed: input.confirmed === true,
    formality: choose(input.formality, ['polite', 'casual', 'auto'], 'auto', '선호 말투'),
    length: choose(input.length, ['short', 'balanced'], 'short', '선호 길이'),
    allowEmoji: input.allowEmoji === true,
    avoidPromises: input.avoidPromises !== false,
    salutation: clean(input.salutation, '호칭', 80),
    avoidPhrases: [...new Set(avoidPhrases.map(item => clean(item, '피할 표현', 80, true)))],
    noReplyPressure: input.noReplyPressure === true,
    closingLine: clean(input.closingLine, '직접 쓴 덧붙일 말', 300),
    note: clean(input.note, '선호 메모', 1000),
  };
}
function savedMessages(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('기억한 문구의 형식을 확인해 주세요.');
  const result = {};
  for (const [type, item] of Object.entries(input)) {
    if (!Object.hasOwn(MESSAGE_TYPES, type) || !item || typeof item !== 'object') throw new Error('기억한 문구의 종류를 확인해 주세요.');
    result[type] = { text: clean(item.text, '기억한 문구', 5000, true), savedAt: timestamp(item.savedAt, '문구를 기억한 시간') };
  }
  return result;
}
function messageLibrary(input) {
  const seen = new Set();
  return backupList(input, 100, '한 사람의 보관 문구').map(value => {
    exactKeys(value, ['id', 'type', 'checkinIntent', 'text', 'savedAt', 'favorite'], '보관 문구');
    if (!Object.hasOwn(MESSAGE_TYPES, value.type)) throw new Error('보관 문구의 종류를 확인해 주세요.');
    const item = { id: requireId(value.id, '보관 문구 식별자'), type: value.type,
      text: clean(value.text, '보관 문구', 5000, true), savedAt: timestamp(value.savedAt, '문구를 보관한 시간'), favorite: value.favorite === true };
    uniqueId(item.id, seen, '보관 문구');
    if (value.favorite !== undefined && typeof value.favorite !== 'boolean') throw new Error('문구 즐겨찾기 여부를 확인해 주세요.');
    if (item.type === 'checkin') item.checkinIntent = choose(value.checkinIntent, Object.keys(CHECKIN_INTENTS), 'unspecified', '보관한 안부의 목적');
    else if (value.checkinIntent !== undefined) throw new Error('행사 문구에는 안부 목적을 저장할 수 없어요.');
    return item;
  });
}
function legacyMessageId(personId, type, saved) {
  // 구자료를 읽을 때마다 같은 ID를 제공한다. 사람과 종류도 포함해 다른 사람의 선택을 받지 않는다.
  const source = JSON.stringify([personId, type, saved.text, saved.savedAt]);
  let first = 2166136261, second = 5381;
  for (let index = 0; index < source.length; index++) {
    first = Math.imul(first ^ source.charCodeAt(index), 16777619);
    second = Math.imul(second, 33) ^ source.charCodeAt(index);
  }
  return `legacy_${type}_${(first >>> 0).toString(36)}_${(second >>> 0).toString(36)}`;
}
function personMessageLibrary(person) {
  // 명시 배열은 빈 배열이어도 삭제 결과다. 옛 mirror로 다시 채우지 않는다.
  if (Object.hasOwn(person, 'messageLibrary')) return person.messageLibrary;
  return Object.entries(person.savedMessages).map(([type, saved]) => ({
    id: legacyMessageId(person.id, type, saved), type, ...saved, favorite: false,
    ...(type === 'checkin' ? { checkinIntent: 'unspecified' } : {}),
  }));
}
function sortedMessages(items, favoritesFirst = true) {
  return items.map((item, index) => ({ item, index })).sort((a, b) =>
    (favoritesFirst ? Number(b.item.favorite) - Number(a.item.favorite) : 0) || b.item.savedAt.localeCompare(a.item.savedAt) || b.index - a.index
  ).map(({ item }) => ({ ...item }));
}
/** 같은 사람의 보관함. 안부 목적을 고르면 해당 목적과 목적 미지정 구자료만 보여 준다. */
export function listSavedMessages(personInput, { type, checkinIntent } = {}) {
  const person = makePerson(personInput);
  if (type !== undefined && !Object.hasOwn(MESSAGE_TYPES, type)) throw new Error('보관 문구의 종류를 확인해 주세요.');
  if (checkinIntent !== undefined && (type !== 'checkin' || !Object.hasOwn(CHECKIN_INTENTS, checkinIntent))) throw new Error('보관한 안부의 목적을 확인해 주세요.');
  return sortedMessages(personMessageLibrary(person).filter(item =>
    (type === undefined || item.type === type) && (checkinIntent === undefined || item.checkinIntent === checkinIntent || item.checkinIntent === 'unspecified')
  ));
}
function timestamp(value, label) {
  const text = clean(value, label, 40, true);
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(text)) throw new Error(`${label}을 확인해 주세요.`);
  dateParts(text.slice(0, 10));
  return clock(text).toISOString();
}
function tone(input) {
  if (!input) return null;
  if (input.source !== 'rule-based') throw new Error('확인할 수 없는 말투 관찰이에요.');
  const formality = choose(input.formality, ['polite', 'casual', 'mixed', 'unknown'], 'unknown', '관찰 말투');
  return {
    source: 'rule-based', label: clean(input.label, '관찰 이름', 100), formality,
    sentenceLength: choose(input.sentenceLength, ['short', 'balanced', 'long'], 'balanced', '문장 길이'),
    hasLaughter: input.hasLaughter === true, hasEmoji: input.hasEmoji === true,
    observations: Array.isArray(input.observations) ? input.observations.slice(0, 8).map(item => clean(item, '관찰', 300)) : [],
    sampleCount: Number.isInteger(input.sampleCount) && input.sampleCount > 0 ? Math.min(input.sampleCount, MAX_TEXT) : 0,
    limits: Array.isArray(input.limits) ? input.limits.slice(0, 8).map(item => clean(item, '관찰 한계', 300)) : [],
  };
}

/** 사람 한 명. selfTone은 관찰, recipientPreference는 사용자가 직접 확인한 선호를 따로 보관한다. */
export function makePerson(input = {}) {
  if (Object.hasOwn(input, 'checkinIntervalDays') && (!Number.isInteger(input.checkinIntervalDays) || input.checkinIntervalDays < 0 || input.checkinIntervalDays > 365)) throw new Error('안부 주기는 0~365일 사이의 정수로 골라 주세요. 0일은 일반 안부 추천 끄기예요.');
  return {
    id: id(input.id, 'person'), name: clean(input.name, '이름', 80, true), relationship: clean(input.relationship, '관계', 80),
    group: choose(input.group, ['family', 'friend', 'work', 'other'], 'other', '사람 모음'),
    selfTone: tone(input.selfTone), recipientPreference: preference(input.recipientPreference), notes: clean(input.notes, '메모'), savedMessages: savedMessages(input.savedMessages),
    ...(Object.hasOwn(input, 'messageLibrary') ? { messageLibrary: messageLibrary(input.messageLibrary) } : {}),
    ...(Object.hasOwn(input, 'checkinIntervalDays') ? { checkinIntervalDays: input.checkinIntervalDays } : {}),
  };
}

/** 생일·기일·기념일은 기본 매년, 결혼·부고는 일회성이다. 음력 날짜와 회차의 양력 날짜를 구분한다. */
export function makeEvent(input = {}) {
  const type = choose(input.type, Object.keys(EVENT_TYPES), 'birthday', '일정 종류');
  const date = clean(input.date, '날짜', 10, true);
  const calendar = choose(input.calendar, ['solar', 'lunar'], 'solar', '달력 종류');
  if (input.lunarLeapMonth !== undefined && typeof input.lunarLeapMonth !== 'boolean') throw new Error('윤달 여부를 확인해 주세요.');
  const lunarLeapMonth = calendar === 'lunar' && input.lunarLeapMonth === true;
  if (calendar === 'lunar') normalizeLunarDate(date, lunarLeapMonth); else dateParts(date);
  const time = clean(input.time, '시간', 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('시간은 00:00~23:59 사이로 입력해 주세요.');
  const personId = clean(input.personId, '사람 식별자', 100, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(personId)) throw new Error('사람 식별자가 올바르지 않아요.');
  const repeat = choose(input.repeat, ['none', 'yearly'], ['birthday', 'memorial', 'anniversary'].includes(type) ? 'yearly' : 'none', '반복');
  if (['wedding', 'condolence'].includes(type) && repeat !== 'none') throw new Error('결혼·부고는 일회성 일정으로 저장해 주세요.');
  const days = input.reminderDays ?? (type === 'condolence' ? [0] : [7, 1, 0]);
  if (!Array.isArray(days) || days.length > 12 || days.some(day => !Number.isInteger(day) || day < 0 || day > 365)) throw new Error('미리 알림은 0~365일 사이의 정수로 최대 12개까지 설정해 주세요.');
  return {
    id: id(input.id, 'event'), personId, type, date, time, calendar,
    lunarLeapMonth, lunarLeapPolicy: choose(input.lunarLeapPolicy, ['regular', 'leap-only'], 'regular', '윤달 처리'),
    lunarShortMonthPolicy: choose(input.lunarShortMonthPolicy, ['last-day', 'skip'], 'last-day', '음력 작은달 처리'),
    title: clean(input.title, '일정 이름', 120) || EVENT_TYPES[type], location: clean(input.location, '장소', 300), repeat,
    reminderDays: [...new Set(days)].sort((a, b) => b - a), leapDayPolicy: choose(input.leapDayPolicy, ['feb28', 'mar1'], 'feb28', '윤년 처리'),
    notes: clean(input.notes, '일정 메모'), carePlan: carePlan(input.carePlan),
  };
}

function amount(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 1000000000) throw new Error('금액은 0~10억 원 사이의 정수로 입력해 주세요.');
  return value;
}
function carePlan(input = {}) {
  recordObject(input, '챙길 계획');
  return { action: choose(input.action, ['contact', 'attend', 'gift', 'remember'], 'contact', '챙길 방법'), amountWon: amount(input.amountWon), note: clean(input.note, '챙길 계획 메모') };
}

const CARE_ACTIONS = ['contact', 'attend', 'gift', 'remember'];
function exactKeys(input, keys, label) {
  recordObject(input, label);
  if (Object.keys(input).some(key => !keys.includes(key))) throw new Error(`${label}에 지원하지 않는 항목이 있어요.`);
}
function makeFollowup(input) {
  exactKeys(input, ['id', 'personId', 'title', 'dueOn', 'status', 'sourceId', 'sourceQuote', 'createdAt', 'updatedAt'], '후속 챙김');
  const dueOn = clean(input.dueOn, '다시 챙길 날짜', 10, true); dateParts(dueOn);
  const createdAt = timestamp(input.createdAt, '후속 챙김 저장 시간');
  const updatedAt = timestamp(input.updatedAt, '후속 챙김 수정 시간');
  if (updatedAt < createdAt) throw new Error('후속 챙김 수정 시간이 저장 시간보다 빨라요.');
  const sourceId = input.sourceId === undefined || input.sourceId === null || input.sourceId === '' ? '' : requireId(input.sourceId, '근거 원문');
  const sourceQuote = clean(input.sourceQuote, '근거 문장', 5000);
  if (Boolean(sourceId) !== Boolean(sourceQuote)) throw new Error('후속 챙김의 근거 원문과 문장을 함께 확인해 주세요.');
  if (!['pending', 'done', 'dismissed'].includes(input.status)) throw new Error('후속 챙김 상태를 확인해 주세요.');
  return { id: requireId(input.id, '후속 챙김 식별자'), personId: requireId(input.personId, '사람 식별자'), title: clean(input.title, '다시 챙길 일', 120, true), dueOn, status: input.status, sourceId, sourceQuote, createdAt, updatedAt };
}
function nullableInteger(value, min, max, label) {
  if (value === undefined || value === null) return null;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${label}을 확인해 주세요.`);
  return value;
}
function makePreparation(input) {
  exactKeys(input, ['id', 'personId', 'eventId', 'recommendedAction', 'chosenAction', 'shownAt', 'selectedAt', 'elapsedSeconds', 'satisfaction', 'satisfactionAt'], '준비 기록');
  const shownAt = timestamp(input.shownAt, '준비를 보여준 시간');
  const chosenAction = input.chosenAction === null || input.chosenAction === undefined ? null : input.chosenAction;
  if (!CARE_ACTIONS.includes(input.recommendedAction) || (chosenAction !== null && !CARE_ACTIONS.includes(chosenAction))) throw new Error('추천한 준비와 선택한 준비를 확인해 주세요.');
  const selectedAt = input.selectedAt === null || input.selectedAt === undefined ? null : timestamp(input.selectedAt, '준비를 선택한 시간');
  const elapsedSeconds = nullableInteger(input.elapsedSeconds, 0, 86400, '준비에 쓴 시간');
  const satisfaction = nullableInteger(input.satisfaction, 1, 5, '직접 답한 만족도');
  const satisfactionAt = input.satisfactionAt === null || input.satisfactionAt === undefined ? null : timestamp(input.satisfactionAt, '만족도를 답한 시간');
  if (Boolean(chosenAction) !== Boolean(selectedAt) || (selectedAt && selectedAt < shownAt)) throw new Error('선택한 준비와 선택 시간을 함께 확인해 주세요.');
  if (!chosenAction && (elapsedSeconds !== null || satisfaction !== null)) throw new Error('준비를 선택한 뒤 시간과 만족도를 기록해 주세요.');
  if ((satisfaction !== null) !== Boolean(satisfactionAt) || (satisfactionAt && satisfactionAt < selectedAt)) throw new Error('만족도와 답한 시간을 함께 확인해 주세요.');
  if (elapsedSeconds !== null && elapsedSeconds > Math.floor((Date.parse(selectedAt) - Date.parse(shownAt)) / 1000)) throw new Error('준비에 쓴 시간이 표시부터 선택까지의 시간보다 길어요.');
  const eventId = input.eventId === '' ? '' : requireId(input.eventId, '일정 식별자');
  if (!eventId && (![null, 'contact', 'remember'].includes(chosenAction) || !['contact', 'remember'].includes(input.recommendedAction))) throw new Error('일정 없는 안부는 연락이나 조용히 기억하기로 준비해 주세요.');
  return { id: requireId(input.id, '준비 기록 식별자'), personId: requireId(input.personId, '사람 식별자'), eventId, recommendedAction: input.recommendedAction, chosenAction, shownAt, selectedAt, elapsedSeconds, satisfaction, satisfactionAt };
}

/** 사용자가 날짜와 내용을 확인한 후에만 호출한다. 원문 후보는 자동으로 보관하지 않는다. */
export function addFollowup(state, input, now = new Date()) {
  exactKeys(input, ['personId', 'title', 'dueOn', 'sourceId', 'sourceQuote'], '새 후속 챙김');
  const at = clock(now).toISOString();
  const item = makeFollowup({ ...input, id: id(undefined, 'followup'), status: 'pending', createdAt: at, updatedAt: at });
  return importBackup({ ...state, followups: [...(state.followups ?? []), item] });
}

export function updateFollowup(state, followupId, patch, now = new Date()) {
  exactKeys(patch, ['title', 'dueOn', 'status', 'sourceId', 'sourceQuote'], '후속 챙김 수정');
  const current = importBackup(state);
  const old = current.followups.find(item => item.id === followupId);
  if (!old) throw new Error('수정할 후속 챙김이 없어요.');
  const updated = makeFollowup({ ...old, ...patch, updatedAt: clock(now).toISOString() });
  return importBackup({ ...current, followups: current.followups.map(item => item.id === followupId ? updated : item) });
}

/** 사용자가 적용을 눌렀을 때 저장한다. 실행·연락 완료 기록과는 별개다. */
export function saveCarePlan(state, eventId, plan) {
  const current = importBackup(state);
  if (!current.events.some(item => item.id === eventId)) throw new Error('준비를 적용할 일정이 없어요.');
  const next = carePlan(plan);
  return importBackup({ ...current, events: current.events.map(item => item.id === eventId ? { ...item, carePlan: next } : item) });
}

/** 추천이 실제 화면에 표시된 후 호출한다. 노출 자체는 선택이나 관계 개선이 아니다. */
export function recordPreparation(state, input, now = new Date()) {
  exactKeys(input, ['personId', 'eventId', 'recommendedAction'], '새 준비 기록');
  const item = makePreparation({ ...input, id: id(undefined, 'preparation'), shownAt: clock(now).toISOString(), chosenAction: null, selectedAt: null, elapsedSeconds: null, satisfaction: null, satisfactionAt: null });
  return importBackup({ ...state, preparations: [...(state.preparations ?? []), item].slice(-500) });
}

/** 선택·직접 답한 만족도만 받는다. 표시와 선택 사이의 시간은 인과 효과가 아니다. */
export function updatePreparation(state, preparationId, patch, now = new Date()) {
  exactKeys(patch, ['chosenAction', 'elapsedSeconds', 'satisfaction'], '준비 기록 수정');
  const current = importBackup(state);
  const old = current.preparations.find(item => item.id === preparationId);
  if (!old) throw new Error('수정할 준비 기록이 없어요.');
  const at = clock(now).toISOString();
  if (at < (old.satisfactionAt ?? old.selectedAt ?? old.shownAt)) throw new Error('준비 기록의 수정 시간을 확인해 주세요.');
  const selecting = Object.hasOwn(patch, 'chosenAction');
  if (selecting && (!CARE_ACTIONS.includes(patch.chosenAction) || old.chosenAction !== null)) throw new Error('준비 선택은 한 번만 기록해 주세요.');
  const updated = makePreparation({ ...old, ...patch, selectedAt: selecting ? at : old.selectedAt, satisfactionAt: Object.hasOwn(patch, 'satisfaction') ? (patch.satisfaction === null ? null : at) : old.satisfactionAt });
  return importBackup({ ...current, preparations: current.preparations.map(item => item.id === preparationId ? updated : item) });
}

function makeSource(input) {
  return { id: requireId(input.id, '원문 식별자'), personId: requireId(input.personId, '사람 식별자'), title: clean(input.title, '원문 제목', 120, true), text: clean(input.text, '보관할 원문', MAX_TEXT, true), kind: choose(input.kind, ['text', 'transcript'], 'text', '원문 종류'), createdAt: timestamp(input.createdAt, '원문 저장 시간') };
}
function makeMemory(input) {
  return { id: requireId(input.id, '기억 식별자'), personId: requireId(input.personId, '사람 식별자'), kind: choose(input.kind, ['preference', 'memory'], 'memory', '기억 종류'), text: clean(input.text, '기억할 내용', 2000, true), sourceId: requireId(input.sourceId, '근거 원문'), sourceQuote: clean(input.sourceQuote, '근거 문장', 5000, true), createdAt: timestamp(input.createdAt, '기억 저장 시간') };
}
function makeActivity(input) {
  const occurredOn = clean(input.occurredOn, '챙긴 날짜', 10, true); dateParts(occurredOn);
  const createdAt = timestamp(input.createdAt, '챙긴 기록 시간');
  if (occurredOn > today(createdAt)) throw new Error('실제로 챙긴 기록의 날짜가 기록한 날보다 미래예요.');
  return { id: requireId(input.id, '챙긴 기록 식별자'), personId: requireId(input.personId, '사람 식별자'), eventId: input.eventId ? requireId(input.eventId, '일정 식별자') : '', kind: choose(input.kind, ['contact', 'attend', 'gift', 'money', 'remember'], 'contact', '챙긴 방법'), occurredOn, amountWon: amount(input.amountWon), direction: choose(input.direction, ['sent', 'received'], 'sent', '주고받은 방향'), note: clean(input.note, '챙긴 기록 메모'), createdAt };
}

/** 선택을 확인한 뒤 원문과 기억·일정을 함께 저장한다. 하나라도 틀리면 전부 저장하지 않는다. */
export function captureSource(state, input, now = new Date()) {
  const createdAt = clock(now).toISOString();
  const source = makeSource({ ...input, id: id(undefined, 'source'), createdAt });
  const memories = (input.memories ?? []).map(item => makeMemory({ ...item, id: id(undefined, 'memory'), personId: source.personId, sourceId: source.id, createdAt }));
  const events = (input.events ?? []).map(item => makeEvent({ ...item, id: undefined, personId: source.personId, notes: [item.notes, `보관한 원문: ${source.title}`].filter(Boolean).join('\n') }));
  const duplicate = events.find((item, index) => [...state.events, ...events.slice(0, index)].some(old => old.personId === item.personId && old.type === item.type && old.date === item.date && old.calendar === item.calendar));
  if (duplicate) throw new Error(`${duplicate.title}은 같은 날짜에 이미 있어요. 선택에서 빼거나 기존 일정을 수정해 주세요.`);
  return importBackup({ ...state, sources: [...(state.sources ?? []), source], memories: [...(state.memories ?? []), ...memories], events: [...state.events, ...events] });
}

export function recordCareAction(state, input, now = new Date()) {
  const activity = makeActivity({ ...input, id: id(undefined, 'activity'), createdAt: clock(now).toISOString() });
  if (activity.occurredOn > today(now)) throw new Error('실제로 챙긴 기록은 오늘까지의 날짜로 남겨 주세요. 앞으로 할 일은 일정의 계획에 적어 주세요.');
  return importBackup({ ...state, activities: [...(state.activities ?? []), activity] });
}

function occurrenceInYear(event, year) {
  const { month, day } = dateParts(event.date);
  if (month === 2 && day === 29 && !isLeap(year)) return event.leapDayPolicy === 'mar1' ? dateString(year, 3, 1) : dateString(year, 2, 28);
  return dateString(year, month, day);
}

/** 오늘을 포함한 다음 일정. 지난 일회성 일정은 null. daysUntil은 한국 날짜 기준이다. */
export function nextOccurrence(eventInput, now = new Date()) {
  const event = makeEvent(eventInput);
  const current = today(now);
  let date = event.date;
  let lunarOccurrence = null;
  if (event.calendar === 'lunar') {
    const source = normalizeLunarDate(event.date, event.lunarLeapMonth);
    if (event.repeat === 'none') {
      date = lunarToSolar(source);
      if (!date || date < current) return null;
      lunarOccurrence = { lunarDate: event.date, leapMonth: event.lunarLeapMonth };
    } else {
      if (current > LUNAR_RANGE.solarMax) return null;
      const lunarToday = solarToLunar(current);
      const startYear = Math.max(source.year, lunarToday?.year ?? LUNAR_RANGE.minYear);
      for (let year = startYear; year <= LUNAR_RANGE.maxYear; year++) {
        const candidate = lunarDateInYear({ date: event.date, leapMonth: event.lunarLeapMonth, leapPolicy: event.lunarLeapPolicy, shortMonthPolicy: event.lunarShortMonthPolicy }, year);
        if (candidate && candidate.date >= current) { lunarOccurrence = candidate; break; }
      }
      if (!lunarOccurrence) return null;
      date = lunarOccurrence.date;
    }
    return { date, time: event.time, occurrenceId: `${event.id}:${date}`, daysUntil: Math.round((dateNumber(date) - dateNumber(current)) / DAY), lunarDate: lunarOccurrence.lunarDate, lunarLeapMonth: lunarOccurrence.leapMonth };
  }
  if (event.repeat === 'yearly') {
    let year = Math.max(dateParts(current).year, dateParts(event.date).year);
    date = occurrenceInYear(event, year);
    if (date < current) date = occurrenceInYear(event, ++year);
    if (year > 2199) return null;
  } else if (date < current) return null;
  return { date, time: event.time, occurrenceId: `${event.id}:${date}`, daysUntil: Math.round((dateNumber(date) - dateNumber(current)) / DAY) };
}

function unfinishedOccurrence(state, event, now) {
  let occurrence = nextOccurrence(event, now);
  const done = new Set((state.completions ?? []).map(item => item.occurrenceId));
  while (occurrence && done.has(occurrence.occurrenceId)) {
    if (event.repeat !== 'yearly') return null;
    if (occurrence.date >= '2199-12-31') return null;
    const nextDay = shiftDate(occurrence.date, 1);
    occurrence = nextOccurrence(event, `${nextDay}T00:00:00+09:00`);
    if (occurrence) occurrence.daysUntil = Math.round((dateNumber(occurrence.date) - dateNumber(today(now))) / DAY);
  }
  return occurrence;
}

/** 각 일정의 다음 미완료 회차, 날짜순. 이미 챙긴 매년 일정은 다음 해로 넘어간다. */
export function upcomingEvents(state, now = new Date()) {
  const result = [];
  for (const eventInput of state.events ?? []) {
    const event = makeEvent(eventInput);
    const person = (state.people ?? []).find(item => item.id === event.personId);
    if (!person) continue;
    const occurrence = unfinishedOccurrence(state, event, now);
    if (occurrence) result.push({ event, person, occurrence, completed: false, reminderDue: event.reminderDays.includes(occurrence.daysUntil) });
  }
  return result.sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date) || a.event.time.localeCompare(b.event.time) || a.event.id.localeCompare(b.event.id));
}

function removeSentences(text, phrases) {
  const removedPhrases = phrases.filter(phrase => text.includes(phrase));
  if (!removedPhrases.length) return { text: text.trim(), removedPhrases };
  const spans = [];
  for (const phrase of removedPhrases) {
    let start = text.indexOf(phrase);
    while (start >= 0) { spans.push([start, start + phrase.length]); start = text.indexOf(phrase, start + phrase.length); }
  }
  const pieces = [...text.matchAll(/[^.!?。！？\n]+[.!?。！？]*|\n+/gu)];
  const result = pieces.filter(piece => !spans.some(([start, end]) => piece.index < end && piece.index + piece[0].length > start)).map(piece => piece[0]).join(' ').replace(/[^\S\n]+/g, ' ').trim();
  return { text: result, removedPhrases };
}
function quietText(text) {
  const withoutEmoji = text.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\u20E3]/gu, '');
  const jokeMarkers = [...new Set(withoutEmoji.match(/[ㅋㅎ]{2,}|(?:농담|장난|웃겨|웃기지|웃기네)|(?:ha){2,}|lol/giu) ?? [])];
  const filtered = removeSentences(withoutEmoji, jokeMarkers);
  return { text: filtered.text, changed: filtered.text !== text.trim() };
}

/** 자동 발송하지 않는 문구 틀과 사용자가 명시적으로 기억한 문구. 자유 메모를 이해했다고 주장하지 않는다. */
export function draftMessage(personInput, eventInput, options = {}) {
  let person = makePerson(personInput);
  let event = makeEvent(eventInput);
  if (person.id !== event.personId) throw new Error('일정과 사람이 일치하지 않아요.');
  if (options.memorySelection != null || options.savedMessageId != null && options.state != null) {
    const current = importBackup(options.state);
    person = current.people.find(item => item.id === person.id);
    event = current.events.find(item => item.id === event.id);
    if (!person || !event || event.personId !== person.id) throw new Error('현재 수첩에서 사람과 일정을 다시 선택해 주세요.');
    options = { ...options, state: current };
  }
  return composeDraft(person, event.type, options);
}

/** 날짜나 가짜 행사를 만들지 않는 일상 안부. 원문을 쓸 때는 현재 수첩을 함께 검증한다. */
export function generateCheckinDraft(personInput, options = {}) {
  let person = makePerson(personInput);
  if (options.memorySelection != null || options.savedMessageId != null && options.state != null) {
    const current = importBackup(options.state);
    person = current.people.find(item => item.id === person.id);
    if (!person) throw new Error('현재 수첩에서 사람을 다시 선택해 주세요.');
    options = { ...options, state: current };
  }
  const checkinIntent = choose(options.checkinIntent, ['everyday', 'reconnect', 'thanks'], 'everyday', '안부의 목적');
  return { ...composeDraft(person, 'checkin', { ...options, checkinIntent }), eventId: '', eventType: 'checkin', eventTitle: MESSAGE_TYPES.checkin, checkinIntent };
}

/** 화면의 첫 초안 선택. 확인한 길이와 같은 종류에 직접 기억한 문구만 사용한다. */
export function defaultDraftApproach(personInput, type, { preferSaved = true, checkinIntent = 'everyday' } = {}) {
  const person = makePerson(personInput);
  if (!Object.hasOwn(MESSAGE_TYPES, type)) throw new Error('초안의 종류를 확인해 주세요.');
  const available = listSavedMessages(person, { type, ...(type === 'checkin' ? { checkinIntent } : {}) });
  if (preferSaved && available.some(item => type !== 'checkin' || item.checkinIntent === checkinIntent)) return 'saved';
  return person.recipientPreference.confirmed && person.recipientPreference.length === 'short' ? 'short' : 'warm';
}

function composeDraft(person, type, options) {
  const pref = person.recipientPreference;
  const sensitive = ['condolence', 'memorial'].includes(type);
  const memory = resolveCareMemory({ state: options.state, personId: person.id, eventType: type, memorySelection: options.memorySelection });
  const observedCasual = person.selfTone?.formality === 'casual';
  const casual = !sensitive && (pref.confirmed && pref.formality !== 'auto' ? pref.formality === 'casual' : observedCasual);
  const selectedId = options.savedMessageId == null || options.savedMessageId === '' ? '' : requireId(options.savedMessageId, '불러올 문구 식별자');
  const approach = selectedId ? 'saved' : choose(options.approach, ['short', 'warm', 'saved'], pref.confirmed && pref.length === 'balanced' ? 'warm' : 'short', '초안 방식');
  const longer = approach === 'warm';
  const customSalutation = pref.confirmed ? pref.salutation : '';
  const casualName = customSalutation || person.name;
  const honorific = customSalutation || (/(?:님|씨)$/.test(person.name) ? person.name : `${person.name}님`);
  const checkinIntent = options.checkinIntent || 'everyday';
  const checkinTexts = {
    everyday: casual ? `${casualName}, 문득 생각나서 안부 전해.${longer ? ' 편안하게 잘 지내길 바라.' : ''}` : `${honorific}, 문득 생각나 안부 전해요.${longer ? ' 편안하게 잘 지내시길 바라요.' : ''}`,
    reconnect: casual ? `${casualName}, 오랜만이야. 잘 지내?${longer ? ' 어떻게 지내는지 궁금해서 연락했어.' : ''}` : `${honorific}, 오랜만에 인사드려요. 잘 지내세요?${longer ? ' 어떻게 지내시는지 궁금해 안부 전해요.' : ''}`,
    thanks: casual ? `${casualName}, 고마워.${longer ? ' 이 말은 꼭 전하고 싶었어.' : ''}` : `${honorific}, 감사합니다.${longer ? ' 감사한 마음을 꼭 전하고 싶었어요.' : ''}`,
  };
  const texts = {
    birthday: casual ? `${casualName}, 생일 축하해!${longer ? ' 좋아하는 것들로 가득한 하루 보내.' : ''}` : `${honorific}, 생일 축하드려요.${longer ? ' 기분 좋은 일들이 가득한 하루 보내세요.' : ''}`,
    wedding: casual ? `결혼 진심으로 축하해!${longer ? ' 두 사람의 앞날에 행복이 가득하길 바라.' : ''}` : `결혼 진심으로 축하드려요.${longer ? ' 두 분의 앞날에 행복이 가득하길 바랍니다.' : ''}`,
    condolence: `깊은 위로의 마음을 전합니다.${longer ? ' 마음으로 함께하겠습니다.' : ''}`,
    memorial: `고인을 기억하며 마음을 함께합니다.${longer ? ' 조용히 위로의 마음을 전합니다.' : ''}`,
    anniversary: casual ? `${casualName}, 기념일 축하해!${longer ? ' 좋은 기억이 남는 하루 보내.' : ''}` : `${honorific}, 기념일 축하드려요.${longer ? ' 소중한 기억이 남는 하루 보내세요.' : ''}`,
    checkin: checkinTexts[checkinIntent],
  };
  const available = approach === 'saved' ? listSavedMessages(person, { type, ...(type === 'checkin' ? { checkinIntent } : {}) }) : [];
  const saved = selectedId ? available.find(item => item.id === selectedId) :
    (available.find(item => type !== 'checkin' || item.checkinIntent === checkinIntent) || available[0]);
  if (selectedId && !saved) throw new Error('불러올 문구가 삭제되었거나 사람·상황이 바뀌었어요. 보관함에서 다시 골라 주세요.');
  const method = saved ? 'saved' : 'template';
  let text = saved ? saved.text : texts[type];
  if (!saved && !sensitive && customSalutation && !['birthday', 'anniversary', 'checkin'].includes(type)) text = `${customSalutation}, ${text}`;
  const basis = saved ? ['이 사람의 같은 종류 일정에 직접 기억해 둔 문구를 가져왔어요. 자동으로 학습한 결과가 아니에요.'] : [sensitive ? '부고·기일에는 차분하고 정중한 표현을 사용했어요.' : pref.confirmed && pref.formality !== 'auto' ? '직접 확인한 상대의 말투 선호를 반영했어요.' : observedCasual ? '본인 발화에서 관찰한 편한 말투를 참고했어요.' : '확인된 단서가 부족해 정중한 표현을 사용했어요.', '만남·선물·송금 약속은 임의로 넣지 않았어요.'];
  const cautions = [saved ? '지난 문구의 호칭·날짜·약속이 지금도 맞는지 확인해 주세요.' : '규칙과 문구 틀로 만든 초안이에요. 보내기 전에 직접 확인해 주세요.'];
  if (approach === 'saved' && !saved) cautions.push('이 종류의 일정에 기억해 둔 문구가 없어 짧은 초안부터 준비했어요.');
  if (customSalutation && !saved && !sensitive) basis.push('직접 정한 호칭을 사용했어요.');
  if (type === 'checkin') {
    if (saved) cautions.push('기억해 둔 안부 문구를 가져왔어요. 이번에 고른 안부 목적에 맞춰 문구를 자동으로 바꾸지 않았어요.');
    else if (checkinIntent !== 'everyday') basis.push(checkinIntent === 'reconnect' ? '이번에 직접 고른 오랜만의 안부를 반영했어요. 마지막 연락일을 추정한 결과가 아니에요.' : '이번에 직접 고른 감사 인사를 반영했어요. 고마웠던 이유는 임의로 넣지 않았어요.');
  }
  if (sensitive && (customSalutation || pref.confirmed && pref.closingLine)) cautions.push('조심스러운 날에는 평소 호칭과 덧붙일 말을 자동으로 연결하지 않았어요. 상황에 맞는 표현을 직접 더해 주세요.');
  const append = (addition, explanation) => {
    if (text.length + addition.length > 5000) { cautions.push('5,000자를 넘는 덧붙임은 넣지 않았어요. 문구를 줄인 뒤 다시 준비해 주세요.'); return false; }
    text += addition; basis.push(explanation); return true;
  };
  if (!saved && !sensitive && pref.confirmed && pref.closingLine && !text.includes(pref.closingLine)) append(`\n${pref.closingLine}`, '직접 쓴 덧붙일 말을 연결했어요.');
  if (!saved && !sensitive && pref.confirmed && pref.allowEmoji) append(type === 'birthday' ? ' 🎂' : type === 'checkin' ? ' 🙂' : ' 💐', '직접 확인한 이모지 선호를 반영했어요.');
  if (pref.confirmed && pref.noReplyPressure) {
    const replyLine = casual ? '답장은 편할 때 해도 괜찮아.' : '답장은 편하실 때 하셔도 괜찮아요.';
    const pressure = [...new Set(text.match(/(?:꼭|반드시|빨리|바로)[^.!?\n]{0,12}(?:답장|연락|회신)|(?:답장|연락|회신)[^.!?\n]{0,12}(?:꼭|반드시|빨리|바로|해\s?줘|주세요|부탁)/gu) ?? [])];
    if (pressure.length) { text = removeSentences(text, pressure).text; cautions.push('답장을 재촉하는 표현이 있는 문장을 제외했어요. 문맥을 확인해 주세요.'); }
    if (!saved && !text.includes(replyLine)) append(`\n${replyLine}`, '답장을 재촉하지 않는 한 줄을 더했어요.');
  }
  if (sensitive) {
    const quiet = quietText(text); text = quiet.text;
    if (quiet.changed) cautions.push('위로 문구에서 이모지와 웃음·농담 표지가 있는 문장을 제외했어요.');
    cautions.push('상대의 상황과 종교에 맞는 표현인지 확인해 주세요. 기일은 연락 자체가 편한지도 살펴 주세요. 문장의 숨은 뜻이나 농담을 판별하는 기능은 아니에요.');
  }
  const filtered = removeSentences(text, pref.confirmed ? pref.avoidPhrases : []);
  text = filtered.text;
  const removedPhrases = [...filtered.removedPhrases];
  if (filtered.removedPhrases.length) { basis.push('직접 정한 피할 표현이 들어간 문장을 제외했어요.'); cautions.push('제외한 문장 때문에 의미가 달라지지 않았는지 직접 확인해 주세요.'); }
  // 기본 문구의 안전 처리와 덧붙임이 끝난 뒤, 원문 인용 전체를 넣을 수 있을 때만 추가한다.
  if (memory) {
    if (!memory.blockedReasons.length && memory.use === 'shared-memory') {
      const line = casual ? `“${memory.text}” 이 기억이 떠올랐어.` : `“${memory.text}” 이 기억이 떠올랐어요.`;
      const quietLine = sensitive ? quietText(line).text : line;
      const reviewed = removeSentences(quietLine, pref.confirmed ? pref.avoidPhrases : []);
      removedPhrases.push(...reviewed.removedPhrases.filter(phrase => !removedPhrases.includes(phrase)));
      if (reviewed.text !== line) memory.blockedReasons.push('기억을 잇는 문장이 표현 검사를 통과하지 못해 인용 전체를 넣지 않았어요.');
      else if (text.includes(`“${memory.text}”`)) {
        memory.appliedTo.push('message');
        basis.push('고른 기억의 인용이 기존 문구에 있어 한 번만 유지했어요.');
      }
      else if (text.length + line.length + 1 > 5000) memory.blockedReasons.push('최종 문구와 합하면 5,000자를 넘어 기억을 넣지 않았어요. 짧은 초안으로 다시 준비해 주세요.');
      else {
        text += `${text ? '\n' : ''}${line}`; memory.appliedTo.push('message');
        basis.push('이번에 함께한 기억으로 직접 고른 글을 인용했어요. 자유 글의 뜻을 해석한 결과가 아니에요.');
      }
    } else if (!memory.blockedReasons.length) cautions.push('선물 취향은 준비 순서에서 참고하고, 연락 문구에 선물 약속을 넣지 않았어요.');
    cautions.push(...memory.blockedReasons);
  }
  if (!text) cautions.push('남은 문구가 없어요. 상황에 맞는 말을 직접 적어 주세요.');
  if (pref.note) cautions.push('자유롭게 적은 선호 메모는 문구에 자동 반영되지 않아요. 직접 대조해 주세요.');
  return { text, basis, cautions, needsReview: true, needsComposition: !text, method, approach, savedMessageId: saved?.id ?? null, removedPhrases, memory };
}

/** 현재 보이는 다음 미완료 회차를 완료 처리한 새 상태. 미래 연간 회차는 기록을 공유하지 않는다. */
export function completeEvent(state, eventId, now = new Date(), occurrenceId, options = {}) {
  const eventInput = (state.events ?? []).find(item => item.id === eventId);
  if (!eventInput) throw new Error('일정을 찾을 수 없어요.');
  const event = makeEvent(eventInput);
  const action = choose(options.action, ['contacted', 'remembered'], 'contacted', '챙긴 방법');
  // 화면에 표시한 회차를 전달하면, 완료 뒤 다음 연도 일정도 정확히 다룬다.
  // 이미 저장한 회차의 재호출/더블클릭은 멱등성을 유지한다.
  if (occurrenceId && (state.completions ?? []).some(item => item.occurrenceId === occurrenceId && item.eventId === event.id)) return state;
  let occurrence = occurrenceId ? unfinishedOccurrence(state, event, now) : nextOccurrence(event, now);
  if (options.allowPast === true && occurrenceId) {
    const date = validateOccurrenceId(occurrenceId, event.id).slice(event.id.length + 1);
    if (date <= today(now)) occurrence = nextOccurrence(event, `${date}T00:00:00+09:00`);
  }
  if (!occurrence) throw new Error('완료할 예정 일정이 없어요.');
  if (occurrenceId && occurrence.occurrenceId !== occurrenceId) throw new Error('일정이 바뀌었어요. 목록에서 다시 확인해 주세요.');
  if ((state.completions ?? []).some(item => item.occurrenceId === occurrence.occurrenceId)) return state;
  return { ...state, completions: [...(state.completions ?? []), { eventId: event.id, personId: event.personId, eventType: event.type, eventTitle: event.title, action, occurrenceId: occurrence.occurrenceId, date: occurrence.date, completedAt: clock(now).toISOString() }] };
}

/** 초안과 사용자 수정을 저장한다. 선호 메모는 명시 기록이며 자동 학습 결과가 아니다. */
export function recordDraft(state, input, now = new Date()) {
  const person = (state.people ?? []).find(item => item.id === input.personId);
  const event = (state.events ?? []).find(item => item.id === input.eventId);
  const checkin = input.eventId === '' && input.eventType === 'checkin';
  if (!person || (!checkin && (!event || event.personId !== person.id)) || (event && input.eventType === 'checkin')) throw new Error('초안을 저장할 사람과 일정을 확인해 주세요.');
  if (checkin && input.occurrenceId != null && input.occurrenceId !== '') throw new Error('일정 없는 안부에는 행사 회차를 저장할 수 없어요.');
  if (input.memorySelection != null) resolveCareMemory({ state: importBackup(state), personId: person.id, eventType: checkin ? 'checkin' : event.type, memorySelection: input.memorySelection });
  const entry = {
    id: id(undefined, 'draft'), personId: person.id, eventId: checkin ? '' : event.id,
    eventType: checkin ? 'checkin' : choose(input.eventType, Object.keys(EVENT_TYPES), event.type, '초안 일정 종류'), eventTitle: checkin ? MESSAGE_TYPES.checkin : clean(input.eventTitle, '초안 일정 이름', 120) || event.title,
    originalText: clean(input.originalText, '원래 초안', 5000), text: clean(input.text, '수정 문구', 5000, true),
    preferenceNote: clean(input.preferenceNote, '수정 이유', 1000), createdAt: clock(now).toISOString(),
  };
  if (!checkin && input.occurrenceId) entry.occurrenceId = validateOccurrenceId(input.occurrenceId, event.id);
  return importBackup({ ...state, drafts: [...(state.drafts ?? []), entry].slice(-200) });
}

/** 별도 버튼으로 요청한 문구만 다음 같은 종류 일정에 사용할 수 있게 기억한다. */
export function rememberDraft(state, input, now = new Date()) {
  const current = importBackup(state);
  const person = current.people.find(item => item.id === input.personId);
  const event = current.events.find(item => item.id === input.eventId);
  const checkin = input.eventId === '' && input.eventType === 'checkin';
  if (!person || (!checkin && (!event || event.personId !== person.id)) || (event && input.eventType === 'checkin')) throw new Error('문구를 기억할 사람과 일정을 확인해 주세요.');
  if (input.memorySelection != null) resolveCareMemory({ state: current, personId: person.id, eventType: checkin ? 'checkin' : event.type, memorySelection: input.memorySelection });
  const type = checkin ? 'checkin' : event.type;
  const checkinIntent = checkin ? choose(input.checkinIntent, ['everyday', 'reconnect', 'thanks'], 'everyday', '안부의 목적') : undefined;
  if (!checkin && input.checkinIntent !== undefined) throw new Error('행사 문구에는 안부 목적을 저장할 수 없어요.');
  const text = clean(input.text, '기억할 문구', 5000, true), savedAt = clock(now).toISOString();
  const library = personMessageLibrary(person);
  const existing = library.find(item => item.type === type && item.checkinIntent === checkinIntent && item.text === text);
  if (!existing && library.length >= 100) throw new Error('한 사람에게 문구를 최대 100개까지 보관할 수 있어요. 필요 없는 문구를 지운 뒤 저장해 주세요.');
  const entry = existing ?? { id: id(undefined, 'message'), type, ...(checkin ? { checkinIntent } : {}), text, savedAt, favorite: false };
  const updated = makePerson({ ...person, messageLibrary: existing ? library : [...library, entry], savedMessages: { ...person.savedMessages, [type]: { text: entry.text, savedAt: entry.savedAt } } });
  return importBackup({ ...current, people: current.people.map(item => item.id === person.id ? updated : item) });
}

function storedMessageTarget(state, { personId, messageId }) {
  const current = importBackup(state), person = current.people.find(item => item.id === personId);
  const library = person ? personMessageLibrary(person) : [];
  const entry = library.find(item => item.id === messageId);
  if (!person || !entry) throw new Error('보관 문구가 삭제되었거나 사람이 바뀌었어요. 보관함에서 다시 골라 주세요.');
  return { current, person, library, entry };
}
/** 문구 원문과 저장 시각은 유지하고 즐겨찾기 여부만 바꾼다. */
export function toggleMessageFavorite(state, input) {
  const { current, person, library, entry } = storedMessageTarget(state, input);
  const updated = { ...person, messageLibrary: library.map(item => item.id === entry.id ? { ...item, favorite: !item.favorite } : item) };
  return importBackup({ ...current, people: current.people.map(item => item.id === person.id ? updated : item) });
}
/** 선택한 버전만 지운다. 이전 버전은 그대로 남기며 옛 mirror에서도 삭제를 반영한다. */
export function removeSavedMessage(state, input) {
  const { current, person, library, entry } = storedMessageTarget(state, input);
  if (!Object.hasOwn(person, 'messageLibrary')) {
    // 삭제만으로 남은 구자료를 새 배열로 이관하면 전체 보관 한도에 막힐 수 있다.
    const savedMessages = { ...person.savedMessages };
    delete savedMessages[entry.type];
    return importBackup({ ...current, people: current.people.map(item => item.id === person.id ? { ...person, savedMessages } : item) });
  }
  const remaining = library.filter(item => item.id !== entry.id), savedMessages = { ...person.savedMessages };
  if (savedMessages[entry.type]?.text === entry.text) {
    const next = sortedMessages(remaining.filter(item => item.type === entry.type), false)[0];
    if (next) savedMessages[entry.type] = { text: next.text, savedAt: next.savedAt };
    else delete savedMessages[entry.type];
  }
  const updated = { ...person, messageLibrary: remaining, savedMessages };
  return importBackup({ ...current, people: current.people.map(item => item.id === person.id ? updated : item) });
}

/** 철회한 기억의 문구가 저장 초안에서 다시 자동 사용되지 않게 함께 지운다. */
export function revokeCareMemory(state, { sourceId, memoryId }) {
  const current = importBackup(state);
  if (Boolean(sourceId) === Boolean(memoryId)) throw new Error('삭제할 원문이나 기억 하나를 골라 주세요.');
  const target = sourceId ? current.sources.find(item => item.id === sourceId) : current.memories.find(item => item.id === memoryId);
  if (!target) throw new Error('삭제할 기록이 없어요.');
  const removed = current.memories.filter(item => sourceId ? item.sourceId === sourceId : item.id === memoryId);
  const texts = [...new Set([...(sourceId ? [target.text] : []), ...removed.map(item => item.text)].filter(Boolean))];
  const contains = text => typeof text === 'string' && texts.some(value => text.includes(value));
  return importBackup({ ...current,
    sources: sourceId ? current.sources.filter(item => item.id !== sourceId) : current.sources,
    memories: current.memories.filter(item => !removed.some(deleted => deleted.id === item.id)),
    followups: sourceId ? current.followups.filter(item => item.sourceId !== sourceId) : current.followups,
    people: current.people.map(person => person.id !== target.personId ? person : { ...person,
      savedMessages: Object.fromEntries(Object.entries(person.savedMessages).filter(([, saved]) => !contains(saved.text))),
      ...(Object.hasOwn(person, 'messageLibrary') ? { messageLibrary: person.messageLibrary.filter(item => !contains(item.text)) } : {}),
    }),
    drafts: current.drafts.filter(item => item.personId !== target.personId || !contains(item.text) && !contains(item.originalText)),
  });
}

/** 복사는 발송 증거가 아니다. 실제 챙겼다는 기록과 별도로 보여 준다. */
export function personTimeline(state, personId) {
  const events = new Map((state.events ?? []).filter(item => item.personId === personId).map(item => [item.id, item]));
  const copied = (state.drafts ?? []).filter(item => item.personId === personId && (events.has(item.eventId) || item.eventId === '' && item.eventType === 'checkin')).map(item => ({
    ...item, kind: 'copied', eventType: item.eventType || events.get(item.eventId).type, eventTitle: item.eventTitle || (item.eventType === 'checkin' ? MESSAGE_TYPES.checkin : events.get(item.eventId).title),
  }));
  const completed = (state.completions ?? []).filter(item => events.has(item.eventId)).map(item => ({
    ...item, id: `complete_${item.occurrenceId}`, kind: 'completed', personId, eventType: item.eventType || events.get(item.eventId).type,
    eventTitle: item.eventTitle || events.get(item.eventId).title, action: item.action || 'contacted', createdAt: item.completedAt,
  }));
  const activities = (state.activities ?? []).filter(item => item.personId === personId).map(item => ({ ...item, activityKind: item.kind, kind: 'activity', eventTitle: events.get(item.eventId)?.title || '우리의 기록' }));
  return [...copied, ...completed, ...activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

function validateOccurrenceId(value, eventId) {
  const result = clean(value, '일정 회차', 120, true);
  const prefix = `${eventId}:`;
  if (!result.startsWith(prefix)) throw new Error('일정 회차가 연결된 일정과 일치하지 않아요.');
  dateParts(result.slice(prefix.length));
  return result;
}
function requireId(value, label) { return id(clean(value, label, 100, true), label); }
function recordObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}의 형식을 확인해 주세요.`);
  return value;
}
function backupList(value, limit, label, optional = false) {
  if (optional && value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) throw new Error(`${label}은 최대 ${limit.toLocaleString('ko-KR')}개까지 가져올 수 있어요.`);
  return value;
}
function uniqueId(value, seen, label) {
  if (seen.has(value)) throw new Error(`${label}에 중복된 식별자가 있어요.`);
  seen.add(value);
}

/** v1 백업을 새 객체로 검증한다. 실패 시 전달받은 상태나 브라우저 저장은 변경하지 않는다. */
export function importBackup(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    if (new TextEncoder().encode(raw).byteLength > 4 * 1024 * 1024) throw new Error('백업 파일은 4 MB 이내로 가져와 주세요.');
    try { data = JSON.parse(raw); } catch { throw new Error('JSON 백업 파일을 읽지 못했어요.'); }
  }
  recordObject(data, '백업');
  if (data.version !== 1) throw new Error('지원하지 않는 백업 버전이에요.');
  const peopleIds = new Set(), eventIds = new Set(), draftIds = new Set(), occurrenceIds = new Set();
  const people = backupList(data.people, 1000, '사람').map(input => {
    recordObject(input, '사람'); requireId(input.id, '사람 식별자');
    const item = makePerson(input); uniqueId(item.id, peopleIds, '사람'); return item;
  });
  if (people.reduce((sum, person) => sum + (person.messageLibrary?.length ?? 0), 0) > 1000) throw new Error('수첩 전체에 문구를 최대 1,000개까지 보관할 수 있어요. 필요 없는 문구를 지운 뒤 저장해 주세요.');
  const events = backupList(data.events, 5000, '일정').map(input => {
    recordObject(input, '일정'); requireId(input.id, '일정 식별자');
    const item = makeEvent(input); uniqueId(item.id, eventIds, '일정');
    if (!peopleIds.has(item.personId)) throw new Error('일정에 연결된 사람이 없어요.');
    return item;
  });
  const byEvent = new Map(events.map(item => [item.id, item]));
  const drafts = backupList(data.drafts, 200, '복사 기록', true).map(input => {
    recordObject(input, '복사 기록');
    const event = byEvent.get(input.eventId);
    const checkin = input.eventId === '' && input.eventType === 'checkin';
    if (!peopleIds.has(input.personId) || (!checkin && (!event || event.personId !== input.personId)) || (event && input.eventType === 'checkin')) throw new Error('복사 기록의 사람과 일정을 확인해 주세요.');
    if (checkin && input.occurrenceId !== undefined) throw new Error('일정 없는 안부에는 행사 회차를 저장할 수 없어요.');
    const item = {
      id: requireId(input.id, '복사 기록 식별자'), personId: input.personId, eventId: checkin ? '' : event.id,
      eventType: checkin ? 'checkin' : choose(input.eventType, Object.keys(EVENT_TYPES), event.type, '복사 기록 일정 종류'), eventTitle: checkin ? MESSAGE_TYPES.checkin : clean(input.eventTitle, '복사 기록 일정 이름', 120) || event.title,
      originalText: clean(input.originalText, '원래 초안', 5000), text: clean(input.text, '복사 문구', 5000, true),
      preferenceNote: clean(input.preferenceNote, '수정 이유', 1000), createdAt: timestamp(input.createdAt, '복사한 시간'),
    };
    uniqueId(item.id, draftIds, '복사 기록');
    if (input.occurrenceId) item.occurrenceId = validateOccurrenceId(input.occurrenceId, event.id);
    return item;
  });
  const completions = backupList(data.completions, 10000, '챙김 기록', true).map(input => {
    recordObject(input, '챙김 기록');
    const event = byEvent.get(input.eventId);
    if (!event || (input.personId !== undefined && input.personId !== event.personId)) throw new Error('챙김 기록의 사람과 일정을 확인해 주세요.');
    const occurrenceId = validateOccurrenceId(input.occurrenceId, event.id);
    uniqueId(occurrenceId, occurrenceIds, '챙김 기록');
    const date = clean(input.date, '챙긴 일정 날짜', 10, true); dateParts(date);
    if (occurrenceId !== `${event.id}:${date}`) throw new Error('챙김 기록의 날짜와 회차가 일치하지 않아요.');
    return {
      eventId: event.id, personId: event.personId, eventType: choose(input.eventType, Object.keys(EVENT_TYPES), event.type, '챙김 기록 일정 종류'),
      eventTitle: clean(input.eventTitle, '챙김 기록 일정 이름', 120) || event.title, occurrenceId, date,
      action: choose(input.action, ['contacted', 'remembered'], 'contacted', '챙긴 방법'), completedAt: timestamp(input.completedAt, '챙김 기록 시간'),
    };
  });
  const sourceIds = new Set(), memoryIds = new Set(), activityIds = new Set();
  const sources = backupList(data.sources, 1000, '보관한 원문', true).map(input => {
    recordObject(input, '보관한 원문'); const item = makeSource(input); uniqueId(item.id, sourceIds, '보관한 원문');
    if (!peopleIds.has(item.personId)) throw new Error('원문에 연결된 사람이 없어요.');
    return item;
  });
  const bySource = new Map(sources.map(item => [item.id, item]));
  const memories = backupList(data.memories, 5000, '확인한 기억', true).map(input => {
    recordObject(input, '확인한 기억'); const item = makeMemory(input); uniqueId(item.id, memoryIds, '확인한 기억');
    const source = bySource.get(item.sourceId);
    if (!source || source.personId !== item.personId || !source.text.includes(item.sourceQuote)) throw new Error('기억의 근거 문장이 보관한 원문과 일치하지 않아요.');
    return item;
  });
  const activities = backupList(data.activities, 10000, '주고받은 기록', true).map(input => {
    recordObject(input, '주고받은 기록'); const item = makeActivity(input); uniqueId(item.id, activityIds, '주고받은 기록');
    if (!peopleIds.has(item.personId) || (item.eventId && byEvent.get(item.eventId)?.personId !== item.personId)) throw new Error('주고받은 기록의 사람과 일정을 확인해 주세요.');
    return item;
  });
  const followupIds = new Set(), preparationIds = new Set();
  const followups = backupList(data.followups, 1000, '후속 챙김', true).map(input => {
    const item = makeFollowup(input); uniqueId(item.id, followupIds, '후속 챙김');
    if (!peopleIds.has(item.personId)) throw new Error('후속 챙김에 연결된 사람이 없어요.');
    const source = item.sourceId ? bySource.get(item.sourceId) : null;
    if (item.sourceId && (!source || source.personId !== item.personId || !source.text.includes(item.sourceQuote))) throw new Error('후속 챙김의 근거 문장이 보관한 원문과 일치하지 않아요.');
    return item;
  });
  const preparations = backupList(data.preparations, 500, '준비 기록', true).map(input => {
    const item = makePreparation(input); uniqueId(item.id, preparationIds, '준비 기록');
    if (!peopleIds.has(item.personId) || (item.eventId !== '' && byEvent.get(item.eventId)?.personId !== item.personId)) throw new Error('준비 기록의 사람과 일정을 확인해 주세요.');
    return item;
  });
  const result = { version: 1, people, events, drafts, completions, sources, memories, activities, followups, preparations };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 4 * 1024 * 1024) throw new Error('백업 자료가 4 MB를 넘어요.');
  return result;
}

/** 확인해 보관한 원문을 포함한다. 녹음·화면 선택 상태·알림 권한은 포함하지 않는다. */
export function exportBackup(state, now = new Date()) {
  return { ...importBackup(state), exportedAt: clock(now).toISOString() };
}

const escapeICS = value => String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
function foldLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = '', bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += size;
  }
  lines.push(current);
  return lines.join('\r\n');
}

/** 다음 1회 일정과 미리 알림을 ICS로 저장한다. 캘린더 앱이 가져오고 알림을 허용해야 동작한다. */
export function toICS(eventInput, personInput, now = new Date(), occurrenceDate) {
  const event = makeEvent(eventInput);
  const person = makePerson(personInput);
  if (person.id !== event.personId) throw new Error('일정과 사람이 일치하지 않아요.');
  if (occurrenceDate) dateParts(occurrenceDate);
  const occurrence = nextOccurrence(event, occurrenceDate ? `${occurrenceDate}T00:00:00+09:00` : now);
  if (!occurrence) throw new Error('캘린더에 저장할 예정 일정이 없어요.');
  if (occurrenceDate && (occurrence.date !== occurrenceDate || occurrenceDate < today(now))) throw new Error('캘린더에 저장할 날짜를 다시 확인해 주세요.');
  const stamp = clock(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const day = occurrence.date.replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SYNK//Relationship Care//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (event.time) lines.push('BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE');
  lines.push('BEGIN:VEVENT', `UID:${event.id}-${day}@care.synk.local`, `DTSTAMP:${stamp}`);
  if (event.time) lines.push(`DTSTART;TZID=Asia/Seoul:${day}T${event.time.replace(':', '')}00`);
  else lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${shiftDate(occurrence.date, 1).replace(/-/g, '')}`);
  lines.push(`SUMMARY:${escapeICS(`${person.name} · ${event.title}`)}`);
  if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);
  const calendarNote = event.calendar === 'lunar' ? `음력 ${event.lunarLeapMonth ? '윤달 ' : ''}${event.date}의 다음 회차를 양력으로 바꿔 저장했습니다. 다음 해 일정은 앱에서 다시 내보내 주세요.` : '양력 일정입니다.';
  lines.push(`DESCRIPTION:${escapeICS(['SYNK 플레저에서 저장한 다음 1회 일정입니다. 한국 시간 기준입니다.', calendarNote, event.notes].filter(Boolean).join('\n'))}`);
  for (const days of event.reminderDays) lines.push('BEGIN:VALARM', `TRIGGER:${days === 0 ? 'PT0M' : `-P${days}D`}`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeICS(`${person.name} · ${event.title}`)}`, 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

/** 후속 챙김 한 건. 시각 미선택은 종일·알림 없음이며 기일/반복 행사로 바꾸지 않는다. */
export function toFollowupICS(state, followupId, options = {}, now = new Date()) {
  exactKeys(options, ['time', 'reminderMinutes'], '후속 챙김 달력 설정');
  const current = importBackup(state);
  const followup = current.followups.find(item => item.id === followupId);
  if (!followup || followup.status !== 'pending') throw new Error('예정된 후속 챙김만 달력에 저장할 수 있어요.');
  if (followup.dueOn < today(now)) throw new Error('지난 후속 챙김은 다시 챙길 날짜를 고른 뒤 달력에 저장해 주세요.');
  const person = current.people.find(item => item.id === followup.personId);
  const time = clean(options.time, '다시 챙길 시각', 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('시각은 00:00~23:59 사이로 직접 골라 주세요.');
  const minutes = options.reminderMinutes ?? [];
  if (!Array.isArray(minutes) || minutes.length > 12 || minutes.some(value => !Number.isSafeInteger(value) || value < 0 || value > 525600)) throw new Error('달력 알림은 0~525,600분 전 사이 정수로 최대 12개까지 골라 주세요.');
  if (!time && minutes.length) throw new Error('알림을 넣으려면 다시 챙길 시각을 먼저 골라 주세요. 종일 일정에는 알림을 자동으로 넣지 않아요.');
  const alarms = [...new Set(minutes)].sort((a, b) => b - a);
  const at = clock(now);
  if (time) {
    const start = Date.parse(`${followup.dueOn}T${time}:00+09:00`);
    if (start <= at.getTime()) throw new Error('아직 지나지 않은 날짜와 시각을 골라 주세요.');
    if (alarms.some(value => start - value * 60000 <= at.getTime())) throw new Error('이미 지난 알림 시각이 있어요. 알림을 더 가까운 시간으로 골라 주세요.');
  }
  const day = followup.dueOn.replace(/-/g, '');
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SYNK//Relationship Care//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  if (time) lines.push('BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE');
  lines.push('BEGIN:VEVENT', `UID:${followup.id}@care-followup.synk.local`, `DTSTAMP:${stamp}`);
  if (time) lines.push(`DTSTART;TZID=Asia/Seoul:${day}T${time.replace(':', '')}00`);
  else lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${shiftDate(followup.dueOn, 1).replace(/-/g, '')}`);
  lines.push(`SUMMARY:${escapeICS(`${person.name} · ${followup.title}`)}`, `DESCRIPTION:${escapeICS('SYNK 플레저에서 내가 정한 후속 챙김 한 번을 저장했어요. 한국 시간 기준이며 반복하지 않아요. 앱에서 날짜를 바꾸거나 완료해도 달력은 자동으로 바뀌지 않으니 직접 확인해 주세요.')}`);
  for (const value of alarms) lines.push('BEGIN:VALARM', `TRIGGER:${value === 0 ? 'PT0M' : `-PT${value}M`}`, 'ACTION:DISPLAY', `DESCRIPTION:${escapeICS(`${person.name} · ${followup.title}`)}`, 'END:VALARM');
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
