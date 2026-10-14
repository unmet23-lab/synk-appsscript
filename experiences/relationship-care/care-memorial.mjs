/**
 * 고인·기일 모드. 고인으로 표시한 사람에게는 생일 축하·이모지를 내지 않고,
 * 돌아가신 날(양력)에서 기일·제사·49재 날짜와 조용한 안내 문장을 계산한다.
 * 순수 함수다. 일정 저장은 사용자가 고른 것만 addMemorialEvents로 더한다.
 */
import { importBackup, makeEvent, makePerson, nextOccurrence } from './model.mjs';
import { solarToLunar } from './lunar.mjs';

const DAY = 86400000;
const dayNumber = value => Date.parse(`${value}T00:00:00Z`);
const moveDay = (value, days) => new Date(dayNumber(value) + days * DAY).toISOString().slice(0, 10);
const between = (from, to) => Math.round((dayNumber(to) - dayNumber(from)) / DAY);
const pad = value => String(value).padStart(2, '0');
export const JESA_NOTE = '제사는 집안에 따라 기일 전날 밤이나 기일 저녁에 지내요.';
export const FORTY_NINTH_NOTE = '돌아가신 날을 1일로 세어 49일째 되는 날이에요.';
// 이름 자리에 가족 호칭을 적은 경우 「님」을 붙이지 않는다(「아버지 님」 방지). 표시 문장에만 쓴다.
const FAMILY_WORD = /^(?:어머니|아버지|어머님|아버님|엄마|아빠|할머니|할아버지|외할머니|외할아버지|친할머니|친할아버지|장인어른|장모님|장인|장모|시어머니|시아버지|이모|고모|삼촌|외삼촌|큰아버지|작은아버지|큰어머니|작은어머니|형|누나|오빠|언니|동생|남편|아내|아들|딸|조카|사촌|손자|손녀|며느리|사위|형부|매형|매부|처남|처제|올케|시누이|동서)$/u;

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31'
    || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error(`${label}을 YYYY-MM-DD로 확인해 주세요.`);
  return value;
}
export function koreanDate(now = new Date()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('기준 시간을 확인해 주세요.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export const isDeceased = person => person?.deceased === true;

/** 받침에 맞는 조사. josa('김영희 님', '과', '와') → '과' */
export function josa(word, withFinal, withoutFinal) {
  const last = String(word ?? '').trim().replace(/[)\]」』"'”’\s]+$/u, '').slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code < 11172) return code % 28 ? withFinal : withoutFinal;
  return /[0136780LMNRlmnr]$/u.test(last) ? withFinal : withoutFinal;
}
const copula = word => josa(word, '이에요', '예요');

/** 문장 속 호칭. 「김영희 님」, 이름 대신 「아버지」를 적었으면 그대로. */
export function callName(person) {
  const name = String(person?.name ?? '').trim();
  if (!name) return '';
  return /(?:님|씨)$/u.test(name) || FAMILY_WORD.test(name) ? name : `${name} 님`;
}

/** 한국어 날짜 머리말. 오늘은 / 내일은 / 10월 17일은 */
export function whenPhrase(date, today) {
  const days = between(today, date);
  if (days === 0) return '오늘은';
  if (days === 1) return '내일은';
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일은`;
}
const tail = (date, today) => { const days = between(today, date); return days > 1 ? ` ${days}일 남았어요.` : ''; };

/**
 * 조용한 안내 한 문장. kind: memorial(기일) · forty-ninth(49재) · birthday(생전 생신) · anniversary · condolence · other.
 * 축하·이모지·느낌표를 넣지 않는다.
 */
export function memorialNotice({ person, kind, date, today, nth = null, title = '' }) {
  validDate(date, '날짜'); validDate(today, '오늘 날짜');
  const who = callName(person), when = whenPhrase(date, today), left = tail(date, today);
  if (kind === 'forty-ninth') return `${when} ${who}의 49재예요. 조용히 마음을 모아도 괜찮아요.${left}`;
  if (kind === 'memorial') return `${when} ${who}의 ${nth ? `${nth}주기 ` : ''}기일이에요. ${JESA_NOTE}${left}`;
  if (kind === 'birthday') return `${when} ${who}의 생전 생신이에요. 조용히 기억해도 괜찮아요.${left}`;
  if (kind === 'condolence') return `${when} 기억해 둔 ${title || '부고'} 날이에요. 위로는 짧고 차분하게 전해도 충분해요.${left}`;
  const what = title || '날';
  return `${when} ${who}${josa(who, '과', '와')} 함께 기억하는 ${what}${copula(what)}. 조용히 마음을 모아도 괜찮아요.${left}`;
}

// 돌아가신 바로 그날은 「1주기」가 아니므로 다음 해로 넘긴다.
function nextYearly(event, today, diedOn) {
  const occurrence = nextOccurrence(event, `${today}T00:00:00+09:00`);
  return occurrence && occurrence.date === diedOn ? nextOccurrence(event, `${moveDay(today, 1)}T00:00:00+09:00`) : occurrence;
}

/**
 * 돌아가신 날(양력 YYYY-MM-DD)에서 49재·다음 양력 기일·다음 음력 기일을 계산한다.
 * 음력은 lunar.mjs 범위(양력 1900-01-31~2050-12-31) 안에서만 계산하고, 밖이면 null.
 */
export function memorialSchedule({ diedOn, now = new Date() } = {}) {
  validDate(diedOn, '돌아가신 날');
  const today = koreanDate(now);
  if (diedOn > today) throw new Error('돌아가신 날이 오늘보다 뒤예요. 날짜를 확인해 주세요.');
  const fortyNinth = moveDay(diedOn, 48);
  const solarEvent = makeEvent({ personId: 'memorial', type: 'memorial', date: diedOn, repeat: 'yearly', yearKnown: true });
  const solarNext = nextYearly(solarEvent, today, diedOn);
  const solar = solarNext ? {
    date: solarNext.date, daysUntil: between(today, solarNext.date), nth: Number(solarNext.date.slice(0, 4)) - Number(diedOn.slice(0, 4)),
    eveDate: moveDay(solarNext.date, -1),
  } : null;
  const lunarDeath = solarToLunar(diedOn);
  let lunar = null;
  if (lunarDeath) {
    const lunarDate = `${lunarDeath.year}-${pad(lunarDeath.month)}-${pad(lunarDeath.day)}`;
    const lunarEvent = makeEvent({ personId: 'memorial', type: 'memorial', date: lunarDate, calendar: 'lunar', lunarLeapMonth: lunarDeath.leapMonth, repeat: 'yearly', yearKnown: true });
    const next = nextYearly(lunarEvent, today, diedOn);
    lunar = {
      lunarDate, leapMonth: lunarDeath.leapMonth,
      label: `음력 ${lunarDeath.leapMonth ? '윤' : ''}${lunarDeath.month}월 ${lunarDeath.day}일`,
      next: next ? { date: next.date, lunarDate: next.lunarDate, leapMonth: next.lunarLeapMonth, daysUntil: between(today, next.date),
        nth: Number(next.lunarDate.slice(0, 4)) - lunarDeath.year, eveDate: moveDay(next.date, -1) } : null,
    };
  }
  return {
    diedOn, today, daysSince: between(diedOn, today),
    fortyNinth: { date: fortyNinth, daysUntil: between(today, fortyNinth), passed: fortyNinth < today, note: FORTY_NINTH_NOTE },
    solar, lunar,
    notes: [JESA_NOTE, '양력과 음력 중 집안에서 지내는 날을 골라 기일로 저장해 주세요.', ...(lunarDeath?.leapMonth ? ['윤달에 돌아가셨어요. 윤달이 없는 해에는 평달 같은 날로 지내는 경우가 많아요.'] : [])],
  };
}

function personOf(state, personId) {
  const person = state.people.find(item => item.id === personId);
  if (!person) throw new Error('사람을 다시 선택해 주세요.');
  return person;
}

/**
 * 고인으로 표시한다. 돌아가신 날은 선택이며, 표시하면 일반 안부 추천·오늘 카드 미루기가 멈춘다.
 * diedOn을 생략하면 이미 적어 둔 날을 유지하고, ''를 주면 지운다.
 */
export function markDeceased(state, personId, { diedOn } = {}, now = new Date()) {
  const current = importBackup(state), person = personOf(current, personId);
  if (diedOn === undefined) diedOn = person.diedOn ?? '';
  if (diedOn) { validDate(diedOn, '돌아가신 날'); if (diedOn > koreanDate(now)) throw new Error('돌아가신 날이 오늘보다 뒤예요. 날짜를 확인해 주세요.'); }
  const { careSnooze: _snooze, diedOn: _diedOn, ...rest } = person;
  const updated = makePerson({ ...rest, deceased: true, ...(diedOn ? { diedOn } : {}) });
  return importBackup({ ...current, people: current.people.map(item => item.id === personId ? updated : item) });
}

/** 고인 표시를 거둔다. 돌아가신 날도 함께 지운다. 기일 일정은 그대로 둔다. */
export function unmarkDeceased(state, personId) {
  const current = importBackup(state), person = personOf(current, personId);
  const { deceased: _deceased, diedOn: _diedOn, ...rest } = person;
  return importBackup({ ...current, people: current.people.map(item => item.id === personId ? makePerson(rest) : item) });
}

/**
 * 저장 전에 보여 줄 기일·49재 일정 후보. 저장하지 않는다.
 * calendar: 'lunar'(음력 기일, 기본) | 'solar'. 같은 날짜·달력의 기일이 이미 있으면 빼고 이유를 남긴다.
 */
export function suggestMemorialEvents(state, personId, { calendar = 'lunar', now = new Date() } = {}) {
  if (!['lunar', 'solar'].includes(calendar)) throw new Error('기일을 양력·음력 중에서 골라 주세요.');
  const current = importBackup(state), person = personOf(current, personId);
  if (!isDeceased(person) || !person.diedOn) throw new Error('고인으로 표시하고 돌아가신 날을 적으면 기일을 계산할 수 있어요.');
  const schedule = memorialSchedule({ diedOn: person.diedOn, now });
  const existing = current.events.filter(item => item.personId === personId && item.type === 'memorial');
  const same = (date, cal) => existing.some(item => item.date === date && item.calendar === cal);
  const events = [], skipped = [];
  if (calendar === 'lunar' && !schedule.lunar) skipped.push({ key: 'memorial-yearly', reason: '음력 변환 범위(1900~2050년) 밖이라 양력 기일만 저장할 수 있어요.' });
  else {
    const lunar = calendar === 'lunar';
    const date = lunar ? schedule.lunar.lunarDate : person.diedOn;
    if (same(date, calendar)) skipped.push({ key: 'memorial-yearly', reason: '같은 날짜의 기일이 이미 있어요.' });
    else events.push({ key: 'memorial-yearly', personId, type: 'memorial', title: '기일', date, calendar, lunarLeapMonth: lunar ? schedule.lunar.leapMonth : false,
      lunarLeapPolicy: 'regular', repeat: 'yearly', yearKnown: true, reminderDays: [7, 1, 0],
      preview: lunar ? schedule.lunar.next : schedule.solar });
  }
  if (schedule.fortyNinth.passed) skipped.push({ key: 'forty-ninth', reason: '49재가 이미 지났어요.' });
  else if (same(schedule.fortyNinth.date, 'solar')) skipped.push({ key: 'forty-ninth', reason: '같은 날짜의 49재가 이미 있어요.' });
  else events.push({ key: 'forty-ninth', personId, type: 'memorial', title: '49재', date: schedule.fortyNinth.date, calendar: 'solar', repeat: 'none', reminderDays: [3, 1, 0],
    preview: { date: schedule.fortyNinth.date, daysUntil: schedule.fortyNinth.daysUntil } });
  return { personId, schedule, events, skipped };
}

/** 사용자가 고른 후보(key)만 일정으로 더한다. 저장 직전에 다시 계산해 어긋난 후보는 넣지 않는다. */
export function addMemorialEvents(state, personId, keys, { calendar = 'lunar', now = new Date() } = {}) {
  if (!Array.isArray(keys) || !keys.length || keys.some(key => !['memorial-yearly', 'forty-ninth'].includes(key))) throw new Error('더할 기일·49재를 직접 골라 주세요.');
  const current = importBackup(state);
  const { events } = suggestMemorialEvents(current, personId, { calendar, now });
  const chosen = events.filter(item => keys.includes(item.key));
  if (chosen.length !== new Set(keys).size) throw new Error('고른 일정이 이미 있거나 날짜가 지났어요. 목록을 다시 확인해 주세요.');
  const added = chosen.map(({ key, preview, ...input }) => makeEvent(input));
  return importBackup({ ...current, events: [...current.events, ...added] });
}
