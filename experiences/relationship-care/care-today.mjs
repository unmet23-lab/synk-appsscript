/**
 * 오늘 챙길 1~3명. 후보와 순서는 기존 care-focus(오늘 일정 → 내가 정한 후속 → 7일 안 일정 → 안부 주기)를 그대로 쓰고,
 * 여기서는 하루 칸 수·오늘 이미 챙긴 사람·「며칠 뒤에」 미루기·다가오는 날 표시를 더한다.
 * 완료하거나 미룬 사람은 바로 빠지고, 빈자리를 다른 사람으로 채우지 않는다(끝없는 할 일 목록을 만들지 않음).
 * 단, 오늘이 그날인 일정은 칸 수와 미루기에 상관없이 보여 준다.
 */
import { CONTACT_CHANNELS, completeEvent, importBackup, makePerson, recordCareAction, updateFollowup } from './model.mjs';
import { recommendCareFocus } from './care-focus.mjs';
import { upcomingDays, dDayLabel, dateLabel } from './care-upcoming.mjs';
import { koreanDate } from './care-memorial.mjs';

export const CARE_TODAY_VERSION = 'care-today-1';
export const TODAY_LIMIT = 3;
export const SNOOZE_DAYS = 3;
/** 「연락했어요」 단추. how 값으로 recordTodayContact에 넘긴다. */
export const TODAY_ACTIONS = Object.freeze({ call: '전화했어요', message: '문자했어요', meet: '만났어요', gift: '선물했어요', remember: '조용히 기억했어요' });
const DAY = 86400000;
const dayNumber = value => Date.parse(`${value}T00:00:00Z`);
const moveDay = (value, days) => new Date(dayNumber(value) + days * DAY).toISOString().slice(0, 10);
const between = (from, to) => Math.round((dayNumber(to) - dayNumber(from)) / DAY);
const keyDay = value => koreanDate(value);
function exact(input, keys, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) throw new Error(`${label}의 형식을 확인해 주세요.`);
}

/** 사람별 마지막 챙김(내가 한 것만): 보낸 기록·일정 완료·직접 완료한 후속. 미래 시계 기록은 빼고 본다. */
function lastCare(state, today, at) {
  const seen = value => Date.parse(value) <= at.getTime();
  const latest = new Map(), keep = (personId, date) => { if (date <= today && (!latest.has(personId) || latest.get(personId) < date)) latest.set(personId, date); };
  for (const item of state.activities) if (item.direction === 'sent' && seen(item.createdAt)) keep(item.personId, item.occurredOn);
  for (const item of state.completions) if (seen(item.completedAt)) keep(item.personId, keyDay(item.completedAt));
  for (const item of state.followups) if (item.status === 'done' && seen(item.updatedAt)) keep(item.personId, keyDay(item.updatedAt));
  return latest;
}

/** 오늘 이미 챙기거나 미룬 사람. 하루 칸 수에서 뺀다. */
function handledToday(state, today, at) {
  const seen = value => Date.parse(value) <= at.getTime();
  const result = new Map(), mark = (personId, how) => { if (!result.has(personId)) result.set(personId, new Set()); result.get(personId).add(how); };
  for (const item of state.activities) if (item.direction === 'sent' && item.occurredOn === today && seen(item.createdAt)) mark(item.personId, 'cared');
  for (const item of state.completions) if (seen(item.completedAt) && keyDay(item.completedAt) === today) mark(item.personId, 'cared');
  for (const item of state.followups) if (item.status === 'done' && seen(item.updatedAt) && keyDay(item.updatedAt) === today) mark(item.personId, 'cared');
  for (const person of state.people) if (person.careSnooze?.on === today) mark(person.id, 'snoozed');
  return result;
}

function actionsFor(quiet) {
  const order = quiet ? ['remember', 'call', 'message', 'meet'] : ['call', 'message', 'meet', 'gift'];
  return order.map(how => ({ how, label: TODAY_ACTIONS[how] }));
}

/**
 * 오늘 카드. 돌려주는 cards[]는 화면이 그대로 그린다.
 *  status: empty(사람 없음) · ready(카드 있음) · done-for-today(오늘 칸을 다 챙김) · caught-up(지금 권할 사람 없음)
 */
export function todayCards({ state, now = new Date(), limit = TODAY_LIMIT } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('오늘 카드는 1~5명 사이로 골라 주세요.');
  const current = importBackup(state), at = new Date(now);
  if (!Number.isFinite(at.getTime())) throw new Error('기준 시간을 확인해 주세요.');
  const today = koreanDate(at);
  const focus = recommendCareFocus({ state: current, now: at });
  const base = { version: CARE_TODAY_VERSION, date: today, dateLabel: dateLabel(today), basisPolicy: focus.basisPolicy, limit };
  if (!current.people.length) return { ...base, status: 'empty', cards: [], handled: [], snoozed: [], message: '먼저 챙기고 싶은 사람을 한 명 더해 주세요.' };
  const people = new Map(current.people.map(person => [person.id, person]));
  const days = new Map(upcomingDays(current, { now: at, days: 7, includeCompleted: false }).items.map(item => [item.occurrenceId, item]));
  const followups = new Map(current.followups.map(item => [item.id, item]));
  const last = lastCare(current, today, at), handled = handledToday(current, today, at);
  const ranked = [focus.recommendation, ...focus.alternatives].filter(Boolean);
  const rows = [], snoozed = [];
  for (const item of ranked) {
    const person = people.get(item.personId);
    const day = item.kind === 'event' ? days.get(item.occurrenceId) ?? null : null;
    const date = day?.date ?? (item.kind === 'followup' ? followups.get(item.followupId)?.dueOn ?? null : null);
    const dueToday = item.kind === 'event' && date === today;
    const snooze = person.careSnooze && person.careSnooze.until > today ? person.careSnooze : null;
    if (snooze && !dueToday) { snoozed.push({ personId: person.id, personName: person.name, until: snooze.until, untilLabel: dateLabel(snooze.until, today) }); continue; }
    if (handled.has(person.id) && !dueToday) continue;
    const lastOn = last.get(person.id) ?? null, daysSince = lastOn ? between(lastOn, today) : null;
    // care-focus는 후속 챙김을 차분한 말투로 표시(quiet)하지만, 오늘 카드의 단추는 일정의 성격(부고·기일)과 고인 여부로만 고른다.
    const quiet = person.deceased === true || (item.kind === 'event' && item.quiet === true);
    rows.push({
      key: item.key, personId: person.id, personName: person.name, relationship: person.relationship, deceased: person.deceased === true,
      kind: item.kind, eventId: item.eventId, followupId: item.followupId, occurrenceId: item.occurrenceId,
      title: item.title, reason: item.reason, detail: item.detail, actionLabel: item.actionLabel, quiet,
      date, daysUntil: date ? between(today, date) : null, dDayLabel: date ? dDayLabel(between(today, date)) : null, dueToday,
      headline: day?.headline ?? `${person.name} · ${item.title}`, nthLabel: day?.nthLabel ?? null, ageLabel: day?.ageLabel ?? null,
      emoji: quiet ? null : day?.emoji ?? null, notice: day?.notice ?? null,
      lastCareOn: lastOn, daysSinceLastCare: daysSince,
      lastCareLabel: lastOn ? (daysSince === 0 ? '오늘 챙겼어요' : `마지막 챙김 ${dateLabel(lastOn, today)} · ${daysSince}일 전`) : '아직 챙김 기록이 없어요',
      checkinIntervalDays: person.checkinIntervalDays ?? 30,
      canSnooze: !dueToday, snoozeDays: SNOOZE_DAYS, snoozeUntil: moveDay(today, SNOOZE_DAYS),
      actions: actionsFor(quiet),
    });
  }
  const due = rows.filter(row => row.dueToday), others = rows.filter(row => !row.dueToday);
  const shownDue = new Set(due.map(row => row.personId));
  const handledCount = [...handled.keys()].filter(personId => !shownDue.has(personId)).length;
  const room = Math.max(0, limit - handledCount - due.length);
  const cards = [...due, ...others.slice(0, room)].slice(0, limit);
  const handledList = [...handled].map(([personId, how]) => ({ personId, personName: people.get(personId)?.name ?? '', how: how.has('cared') ? 'cared' : 'snoozed' }))
    .filter(item => item.personName);
  const status = cards.length ? 'ready' : handledList.length ? 'done-for-today' : 'caught-up';
  const message = status === 'ready' ? '' : status === 'done-for-today' ? '오늘 챙길 사람은 여기까지예요. 내일 다시 골라 드릴게요.'
    : '지금 권할 사람이 없어요. 모든 챙김을 마쳤다는 뜻은 아니에요.';
  return { ...base, status, cards, handled: handledList, snoozed, message, waiting: Math.max(0, others.length - room) };
}

/**
 * 「연락했어요」 기록. how: call·message·meet(연락) · gift(선물) · remember(조용히 기억).
 * 오늘 날짜의 보낸 기록을 남겨 그 사람의 안부 주기를 다시 시작한다.
 * 카드가 일정이면 그 회차를 완료하고, 후속이면 완료로 바꾼다. 미뤄 둔 표시는 지운다. 새 상태를 돌려준다.
 */
export function recordTodayContact(state, input, now = new Date()) {
  exact(input, ['personId', 'how', 'eventId', 'occurrenceId', 'followupId', 'note', 'item', 'amountWon'], '연락 기록');
  if (!Object.hasOwn(TODAY_ACTIONS, input.how)) throw new Error('어떻게 챙겼는지 골라 주세요.');
  const current = importBackup(state), person = current.people.find(item => item.id === input.personId);
  if (!person) throw new Error('사람을 다시 선택해 주세요.');
  const today = koreanDate(now), how = input.how;
  const eventId = input.eventId || '', occurrenceId = input.occurrenceId || '', followupId = input.followupId || '';
  if (Boolean(eventId) !== Boolean(occurrenceId)) throw new Error('일정과 회차를 함께 확인해 주세요.');
  // 두 번 누른 경우: 이미 완료한 회차·후속이면 기록을 더하지 않고 그대로 돌려준다.
  if (eventId && current.completions.some(item => item.occurrenceId === occurrenceId && item.eventId === eventId)) return current;
  if (followupId) {
    const followup = current.followups.find(item => item.id === followupId);
    if (followup?.personId === person.id && followup.status === 'done') return current;
    if (!followup || followup.personId !== person.id || followup.status !== 'pending') throw new Error('완료할 후속 챙김이 없어요. 목록을 다시 확인해 주세요.');
  }
  const kind = Object.hasOwn(CONTACT_CHANNELS, how) ? 'contact' : how;
  let next = recordCareAction(current, {
    personId: person.id, eventId, kind, direction: 'sent', occurredOn: today, note: input.note ?? '',
    ...(kind === 'contact' ? { channel: how } : {}),
    ...(kind === 'gift' && input.item ? { item: input.item } : {}),
    ...(kind === 'gift' && input.amountWon != null ? { amountWon: input.amountWon } : {}),
  }, now);
  // 같은 시각으로 기록해 연락 맥락(care-context)이 기록과 완료를 한 번으로 보여 준다.
  if (eventId) next = completeEvent(next, eventId, now, occurrenceId, { action: how === 'remember' ? 'remembered' : 'contacted' });
  if (followupId) next = updateFollowup(next, followupId, { status: 'done' }, now);
  next = clearSnooze(next, person.id);
  return importBackup(next);
}

/**
 * 「3일 뒤에」. 그 사람을 days일(1~14, 기본 3) 동안 오늘 카드에서 뺀다. 그사이 그날이 되는 일정은 그날 다시 보여 준다.
 * 후속 카드면 후속의 날짜도 다시 볼 날로 옮긴다(기존 「다음에」와 같은 동작). 오늘이 그날인 일정은 미루지 않는다.
 */
export function snoozeTodayCard(state, input, now = new Date()) {
  exact(input, ['personId', 'days', 'followupId', 'eventId', 'occurrenceId'], '미루기');
  const days = input.days ?? SNOOZE_DAYS;
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error('미루기는 1~14일 사이로 골라 주세요.');
  const current = importBackup(state), person = current.people.find(item => item.id === input.personId);
  if (!person) throw new Error('사람을 다시 선택해 주세요.');
  const today = koreanDate(now), until = moveDay(today, days);
  if (input.occurrenceId && String(input.occurrenceId).endsWith(`:${today}`)) throw new Error('오늘이 그날이라 미룰 수 없어요. 「조용히 기억했어요」나 연락 기록으로 남길 수 있어요.');
  let next = { ...current, people: current.people.map(item => item.id === person.id ? makePerson({ ...item, careSnooze: { on: today, until } }) : item) };
  if (input.followupId) {
    const followup = current.followups.find(item => item.id === input.followupId);
    if (!followup || followup.personId !== person.id || followup.status !== 'pending') throw new Error('미룰 후속 챙김이 없어요. 목록을 다시 확인해 주세요.');
    if (followup.dueOn < until) next = updateFollowup(next, followup.id, { dueOn: until }, now);
  }
  return importBackup(next);
}

/** 미뤄 둔 사람을 오늘 다시 보기. */
export function clearTodaySnooze(state, personId) {
  const current = importBackup(state);
  if (!current.people.some(item => item.id === personId)) throw new Error('사람을 다시 선택해 주세요.');
  return importBackup(clearSnooze(current, personId));
}

function clearSnooze(state, personId) {
  return { ...state, people: state.people.map(item => {
    if (item.id !== personId || !Object.hasOwn(item, 'careSnooze')) return item;
    const { careSnooze: _snooze, ...rest } = item;
    return rest;
  }) };
}
