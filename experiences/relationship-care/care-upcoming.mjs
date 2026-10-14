/**
 * 다가오는 날 목록. 오늘(한국 날짜)부터 N일 안의 생일·기념일·기일·결혼·부고를 D-day 순으로 펼친다.
 * 양력·음력(윤달·작은달 정책 포함) 매년 반복은 model.nextOccurrence를 그대로 쓴다.
 * 연도를 안다고 표시한 일정(yearKnown)만 「○○번째 생신」·만 나이·「결혼 ○주년」·「○주기」를 붙인다.
 * 순수 함수다. 저장·발송하지 않는다.
 */
import { EVENT_TYPES, importBackup, nextOccurrence } from './model.mjs';
import { lunarToSolar, normalizeLunarDate } from './lunar.mjs';
import { callName, josa, koreanDate, memorialNotice, JESA_NOTE } from './care-memorial.mjs';

export const CARE_UPCOMING_VERSION = 'care-upcoming-1';
const DAY = 86400000;
const WEEKDAYS = '일월화수목금토';
const EMOJI = Object.freeze({ birthday: '🎂', wedding: '💍', anniversary: '💐' });
// 「생신」은 표시 낱말만 바꾼다. 관계나 나이를 추정해 다른 판단에 쓰지 않는다.
const ELDER = /(?:어머니|아버지|어머님|아버님|엄마|아빠|부모|할머니|할아버지|장인|장모|시어머니|시아버지|선생님|은사|교수님)/u;
const MILESTONES = Object.freeze({ 1: '첫 돌', 60: '환갑', 70: '칠순', 80: '팔순', 90: '구순' });
const OLD_COUNT = Object.freeze({ 69: '칠순', 79: '팔순', 89: '구순' });
const dayNumber = value => Date.parse(`${value}T00:00:00Z`);
const moveDay = (value, days) => new Date(dayNumber(value) + days * DAY).toISOString().slice(0, 10);
const between = (from, to) => Math.round((dayNumber(to) - dayNumber(from)) / DAY);
const isLeap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const pad = value => String(value).padStart(2, '0');

export function dDayLabel(daysUntil) {
  if (daysUntil === 0) return '오늘';
  if (daysUntil === 1) return '내일';
  return daysUntil > 0 ? `D-${daysUntil}` : `D+${-daysUntil}`;
}
// 「지민 생일」처럼 일정 이름에 사람 이름이 들어 있으면 「지민 · 생일」로 한 번만 쓴다.
const withoutName = (label, name) => (name && label.startsWith(name) && label.slice(name.length).replace(/^[\s·:,-]+/u, '')) || label;
export function dateLabel(date, today = '') {
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const head = today && date.slice(0, 4) !== today.slice(0, 4) ? `${Number(date.slice(0, 4))}년 ` : '';
  return `${head}${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${weekday})`;
}

/** 만 나이. 2월 29일생은 평년에 일정의 윤일 규칙(기본 2월 28일, 또는 3월 1일)에 나이를 더한다. */
export function ageOn(birthDate, day, leapDayPolicy = 'feb28') {
  const [by, bm, bd] = birthDate.split('-').map(Number), year = Number(day.slice(0, 4));
  const birthday = bm === 2 && bd === 29 && !isLeap(year) ? (leapDayPolicy === 'mar1' ? '03-01' : '02-28') : `${pad(bm)}-${pad(bd)}`;
  const age = year - by - (day.slice(5) < birthday ? 1 : 0);
  return age >= 0 ? age : null;
}

function lunarInfo(event, occurrence) {
  const original = normalizeLunarDate(event.date, event.lunarLeapMonth);
  const lunarDate = occurrence.lunarDate ?? event.date;
  const leapMonth = occurrence.lunarLeapMonth ?? event.lunarLeapMonth;
  const [, month, day] = lunarDate.split('-').map(Number);
  const notes = [];
  if (original.leapMonth && !leapMonth) notes.push('올해는 그 윤달이 없어 평달 같은 날로 챙겨요.');
  if (day < original.day) notes.push(`올해 음력 ${leapMonth ? '윤' : ''}${month}월은 ${day}일까지라 ${day}일로 챙겨요.`);
  return { date: lunarDate, leapMonth, label: `음력 ${leapMonth ? '윤' : ''}${month}월 ${day}일`, original: event.date, originalLeapMonth: original.leapMonth, notes };
}

/** 몇 번째 생신·몇 주년·몇 주기. 연도를 모르면(yearKnown 없음) 모두 null. */
function countFor(event, person, occurrence, today) {
  const none = { nth: null, nthLabel: null, ageToday: null, ageLabel: null, milestone: null, milestoneNote: null };
  if (event.yearKnown !== true || event.repeat !== 'yearly') return none;
  const lunar = event.calendar === 'lunar';
  const originYear = Number(event.date.slice(0, 4));
  const occurrenceYear = Number((lunar ? occurrence.lunarDate : occurrence.date).slice(0, 4));
  const nth = occurrenceYear - originYear;
  if (nth < 1) return none;
  if (event.type === 'birthday') {
    if (person.deceased === true) return none;
    const birthSolar = lunar ? lunarToSolar({ ...normalizeLunarDate(event.date, event.lunarLeapMonth) }) : event.date;
    const ageToday = birthSolar ? ageOn(birthSolar, today, lunar ? 'feb28' : event.leapDayPolicy) : null;
    const word = nth >= 60 || ELDER.test(`${person.relationship} ${person.name}`) ? '생신' : '생일';
    return { nth, nthLabel: nth === 1 ? '첫 돌' : `${nth}번째 ${word}`,
      ageToday, ageLabel: ageToday === null ? null : `만 ${ageToday}세`, milestone: MILESTONES[nth] ?? null,
      milestoneNote: [70, 80, 90].includes(nth) ? `${MILESTONES[nth]}은 집안에 따라 한 해 이르게(예전 나이로 ${nth}세) 챙기기도 해요.`
        : OLD_COUNT[nth] ? `예전 나이로 셈하면 올해가 ${OLD_COUNT[nth]}이에요. 집안마다 챙기는 해가 달라요.` : null };
  }
  if (event.type === 'anniversary') return { ...none, nth, nthLabel: /결혼|웨딩/u.test(event.title) ? `결혼 ${nth}주년` : `${nth}주년` };
  if (event.type === 'memorial') return { ...none, nth, nthLabel: `${nth}주기` };
  return none;
}

function describe(event, person, occurrence, today, completion) {
  const daysUntil = between(today, occurrence.date);
  const deceased = person.deceased === true;
  const quiet = deceased || event.type === 'condolence' || event.type === 'memorial';
  const count = countFor(event, person, occurrence, today);
  const lunar = event.calendar === 'lunar' ? lunarInfo(event, occurrence) : null;
  const fortyNinth = event.type === 'memorial' && event.repeat === 'none' && (/49재/u.test(event.title) || (person.diedOn && occurrence.date === moveDay(person.diedOn, 48)));
  const kindLabel = deceased && event.type === 'birthday' ? '생전 생신' : fortyNinth ? '49재' : event.title;
  const noticeKind = fortyNinth ? 'forty-ninth' : event.type === 'memorial' ? 'memorial' : event.type === 'condolence' ? 'condolence' : event.type === 'birthday' ? 'birthday' : 'other';
  const reminders = event.reminderDays.map(days => ({ daysBefore: days, date: moveDay(occurrence.date, -days) }))
    .map(item => ({ ...item, passed: item.date < today })).sort((a, b) => a.date.localeCompare(b.date));
  const extras = [count.nthLabel && count.nthLabel !== kindLabel ? count.nthLabel : '', count.milestone && count.milestone !== count.nthLabel ? count.milestone : ''].filter(Boolean);
  return {
    key: occurrence.occurrenceId, occurrenceId: occurrence.occurrenceId, eventId: event.id, personId: person.id, personName: person.name,
    relationship: person.relationship, deceased, type: event.type, typeLabel: EVENT_TYPES[event.type], title: event.title, kindLabel,
    date: occurrence.date, time: event.time, location: event.location, weekday: WEEKDAYS[new Date(`${occurrence.date}T00:00:00Z`).getUTCDay()],
    dateLabel: dateLabel(occurrence.date, today), daysUntil, dDayLabel: dDayLabel(daysUntil),
    calendar: event.calendar, lunar, repeat: event.repeat, yearKnown: event.yearKnown === true, ...count,
    headline: `${person.name} · ${withoutName(kindLabel, person.name)}${extras.length ? ` · ${extras.join(' · ')}` : ''}`,
    tone: quiet ? 'quiet' : 'celebrate', emoji: quiet ? null : EMOJI[event.type] ?? null,
    notice: quiet ? memorialNotice({ person, kind: noticeKind, date: occurrence.date, today, nth: count.nth, title: event.title }) : null,
    jesa: event.type === 'memorial' && !fortyNinth ? { eveDate: moveDay(occurrence.date, -1), date: occurrence.date, note: JESA_NOTE } : null,
    completed: !!completion, completedAt: completion?.completedAt ?? null,
    reminderDue: event.reminderDays.includes(daysUntil), reminders,
    nextReminderOn: reminders.find(item => !item.passed)?.date ?? null,
  };
}

/**
 * state: 플레저 수첩(v1). options:
 *  - now: 기준 시각(한국 날짜로 바꿔 씀) · days: 0~730(기본 30, 오늘 포함 오늘+days까지)
 *  - types: ['birthday', …] 일부만 · personId: 한 사람만 · includeCompleted: 이미 챙긴 회차도 표시(기본 true)
 * 돌려주는 items는 날짜·시각·이름 순이며 화면이 그대로 쓴다.
 */
export function upcomingDays(state, { now = new Date(), days = 30, types = null, personId = null, includeCompleted = true } = {}) {
  if (!Number.isInteger(days) || days < 0 || days > 730) throw new Error('다가오는 날은 0~730일 범위로 살펴볼 수 있어요.');
  if (types !== null && (!Array.isArray(types) || types.some(type => !Object.hasOwn(EVENT_TYPES, type)))) throw new Error('살펴볼 일정 종류를 확인해 주세요.');
  const current = importBackup(state), today = koreanDate(now);
  const end = moveDay(today, days) > '2199-12-31' ? '2199-12-31' : moveDay(today, days);
  const people = new Map(current.people.map(person => [person.id, person]));
  const done = new Map(current.completions.map(item => [item.occurrenceId, item]));
  const items = [];
  for (const event of current.events) {
    if (personId && event.personId !== personId) continue;
    if (types && !types.includes(event.type)) continue;
    const person = people.get(event.personId);
    if (!person) continue;
    let cursor = today;
    // 730일 안에는 매년 일정이 최대 3번 온다. 음력은 같은 양력 해에 두 번 올 수도 있어 커서로 하나씩 넘긴다.
    for (let guard = 0; guard < 4; guard++) {
      const occurrence = nextOccurrence(event, `${cursor}T00:00:00+09:00`);
      if (!occurrence || occurrence.date > end) break;
      const completion = done.get(occurrence.occurrenceId);
      if (includeCompleted || !completion) items.push(describe(event, person, occurrence, today, completion));
      if (event.repeat !== 'yearly' || occurrence.date >= '2199-12-31') break;
      cursor = moveDay(occurrence.date, 1);
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.personName.localeCompare(b.personName, 'ko') || a.eventId.localeCompare(b.eventId));
  return { version: CARE_UPCOMING_VERSION, today, until: end, days, items,
    counts: { total: items.length, today: items.filter(item => item.daysUntil === 0).length, quiet: items.filter(item => item.tone === 'quiet').length, completed: items.filter(item => item.completed).length } };
}

/** 가장 가까운 생일 하나(Birthdays 앱의 첫 화면처럼). 올해 회차를 이미 챙겼으면 다음 해 것. 고인의 생전 생신은 뺀다. 없으면 null. */
export function nextBirthday(state, { now = new Date(), days = 400 } = {}) {
  return upcomingDays(state, { now, days, types: ['birthday'], includeCompleted: false }).items.find(item => !item.deceased) ?? null;
}

/** 한 줄 안내. 「엄마 · 60번째 생신 · 환갑 · D-3」 / 고인·기일은 조용한 문장. */
export function upcomingSentence(item) {
  if (item.notice) return item.notice;
  const who = callName({ name: item.personName });
  const what = item.nthLabel ?? item.kindLabel;
  const when = item.daysUntil === 0 ? '오늘' : item.daysUntil === 1 ? '내일' : `${item.daysUntil}일 뒤`;
  return `${when} ${who}의 ${what}${josa(what, '이에요', '예요')}.`;
}
