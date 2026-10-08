// Product navigation and calendar suggestions from the host's current public
// projection. No action, authorization, persistence or private preference lookup.
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 180;
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity;
const focus = (kind, title, body, pairId, target, label, appointmentId = null) => ({ kind, title, body, pairId, target, label, appointmentId });
const unavailable = (title = '이용 상태를 먼저 확인해 주세요.', body = '현재 접근할 수 있는 소개와 약속만 안내해요.') =>
  focus('unavailable', title, body, null, 'settings', '내 설정 확인하기');

/** Offer only the shared place and whole-minute duration of the latest busy
 * appointment. The UI must ask before copying and must use a fresh authorized
 * pair projection; this object grants no new proposal or acceptance rights. */
export function getRescheduleDraft(pair, appointmentId) {
  const projected = pair?.view;
  if (!plain(pair) || pair.status !== 'active' || pair.paused === true || !text(pair.pairId) || !text(appointmentId)
    || !plain(projected) || projected.pairId !== pair.pairId || projected.canPropose !== true || projected.currentId != null
    || pair.introduction?.accepted !== true || pair.introduction.current?.status !== 'accepted'
    || !text(projected.me?.id) || !Array.isArray(projected.people) || projected.people.length !== 2
    || new Set(projected.people.map(person => person?.id)).size !== 2
    || projected.people.filter(person => person?.id === projected.me.id).length !== 1
    || !Array.isArray(projected.appointments)) return null;
  const appointment = projected.appointments.at(-1);
  if (!plain(appointment) || appointment.id !== appointmentId || projected.appointments.filter(item => item?.id === appointmentId).length !== 1
    || appointment.status !== 'busy' || appointment.cancelledBy != null || !Array.isArray(appointment.people) || appointment.people.length !== 2
    || appointment.people.some(person => !projected.people.some(p => p.id === person?.id))
    || new Set(appointment.people.map(person => person?.id)).size !== 2) return null;
  const response = appointment.people.find(person => person.id === projected.me.id), proposal = appointment.proposal, schedule = proposal?.schedule;
  if (response?.response !== 'busy' || !Number.isSafeInteger(proposal?.version) || proposal.version < 1
    || !plain(schedule) || !text(schedule.place) || !schedule.place.trim()) return null;
  const start = instant(schedule.startsAt), end = instant(schedule.endsAt), proposed = instant(proposal.proposedAt), responded = instant(response.respondedAt);
  if (![start, end, proposed, responded].every(Number.isFinite) || responded < proposed || instant(appointment.closedAt) !== responded) return null;
  const durationMinutes = (end - start) / 60000;
  // Do not round a shared duration into a different agreement; the current form
  // accepts positive whole minutes. Unsupported values stay manual.
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) return null;
  return { pairId: pair.pairId, appointmentId, proposalVersion: proposal.version, place: schedule.place, durationMinutes };
}

export function getJourneyFocus(view) {
  if (!plain(view) || view.status !== 'active' || !text(view.accountId)) return unavailable();
  const choices = [];
  const add = (priority, when, pair, value) => choices.push({ priority, when: instant(when), pairId: pair.pairId, value });
  for (const pair of Array.isArray(view.pairs) ? view.pairs : []) {
    const projected = pair?.view;
    if (pair?.status !== 'active' || !plain(projected) || !text(pair.pairId) || pair.pairId !== projected.pairId
      || !Array.isArray(projected.people) || projected.people.length !== 2 || new Set(projected.people.map(person => person?.id)).size !== 2
      || projected.people.filter(person => person?.id === view.accountId).length !== 1) continue;
    const other = projected.people.find(person => person.id !== view.accountId);
    if (!text(other?.id) || !text(other.label)) continue;
    const paused = view.paused === true || pair.paused === true;
    const intro = pair.introduction, current = intro?.current;
    const appointments = (Array.isArray(projected.appointments) ? projected.appointments : []).filter(item => plain(item) && text(item.id));
    if (!paused && intro?.canRespond === true && current?.status === 'pending' && current.to === view.accountId)
      add(0, current.expiresAt, pair, focus('introduction-response', `${other.label}님의 소개 요청이 있어요.`, '소개를 살펴보고 받을지 직접 정해 주세요. 일정 수락과는 별개예요.', pair.pairId, 'inbox', '받은 소개 확인하기'));
    for (const appointment of appointments) {
      if (!paused && appointment.status === 'pending' && appointment.canRespond === true)
        add(1, appointment.proposal?.expiresAt, pair, focus('schedule-response', `${other.label}님과의 일정을 확인해 주세요.`, '날짜·시간·장소를 확인한 뒤 수락하거나 다른 시간을 준비할 수 있어요.', pair.pairId, 'inbox', '제안된 일정 확인하기', appointment.id));
      if (['confirmed', 'awaiting-completion', 'partially-completed'].includes(appointment.status)) {
        const complete = appointment.canComplete === true;
        add(3, appointment.proposal?.schedule?.startsAt, pair, focus(complete ? 'appointment-completion' : 'confirmed-schedule',
          complete ? `${other.label}님과의 만남을 마쳤나요?` : `${other.label}님과 확인한 약속이 있어요.`,
          complete ? '실제로 만남을 마쳤다면 내 완료를 확인하고 나만 보는 회고를 남길 수 있어요.' : '함께 수락한 날짜·시간·장소를 다시 확인할 수 있어요.',
          pair.pairId, 'inbox', complete ? '만남 완료 확인하기' : '확정한 약속 확인하기', appointment.id));
      }
    }
    const openAppointment = appointments.some(item => ['pending', 'confirmed', 'awaiting-completion', 'partially-completed'].includes(item.status));
    if (!paused && intro?.accepted === true && current?.status === 'accepted' && projected.canPropose === true && !openAppointment)
      add(2, current.respondedAt, pair, focus('prepare-schedule', `${other.label}님과 서로 소개를 수락했어요.`, '아직 구체적인 약속은 정하지 않았어요. 날짜·시간·장소를 준비해 보세요.', pair.pairId, 'inbox', '함께 만날 일정 준비하기'));
    if (!paused && current?.status === 'pending' && current.from === view.accountId)
      add(4, current.expiresAt, pair, focus('introduction-waiting', `${other.label}님의 소개 응답을 기다리고 있어요.`, '무응답을 거절로 판단하지 않아요. 보낸 요청의 상태를 확인할 수 있어요.', pair.pairId, 'inbox', '보낸 소개 상태 보기'));
    // The other person may already have replied to the introduction while an
    // outgoing concrete schedule is still unanswered. Do not send them back to
    // recommendations as though this ongoing pair disappeared.
    const pending = appointments.find(item => item.status === 'pending' && item.canRespond !== true);
    if (!paused && pending)
      add(4, pending.proposal?.expiresAt, pair, focus('schedule-waiting', `${other.label}님의 일정 응답을 기다리고 있어요.`, '내가 확인한 일정과 상대의 응답 상태를 다시 볼 수 있어요.', pair.pairId, 'inbox', '보낸 일정 상태 보기', pending.id));
  }
  choices.sort((a, b) => a.priority - b.priority || (a.when === b.when ? 0 : a.when < b.when ? -1 : 1) || a.pairId.localeCompare(b.pairId)
    || (a.value.appointmentId || '').localeCompare(b.value.appointmentId || ''));
  if (choices.length) return choices[0].value;
  if (view.paused === true) return unavailable('지금은 새로운 만남 준비를 쉬고 있어요.', '이미 정한 약속은 초대·약속에서 확인할 수 있어요. 다시 시작할지는 직접 정해 주세요.');
  return focus('recommendation', '지금 내 기준으로 한 사람을 살펴볼까요?', '공개된 소개와 추천 근거를 보고 알아가고 싶은 사람을 직접 골라요.', null, 'discover', '오늘의 추천 살펴보기');
}

const AVAILABILITY = new Set(['weekend', 'weekday', 'any']);
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const LIMITATIONS = ['서로 현재 공개한 요일만 참고한 날짜 후보예요. 실제 가능한 시간이나 약속이 확정된 것은 아니에요.',
  '날짜만 제안하며 시간·길이·장소는 자동으로 채우지 않아요. 입력한 시간대에서 직접 확인해 주세요.',
  'Intl이 지원하는 시간대의 달력을 사용해요. 서머타임으로 실제 시각이 중복되거나 사라지는 경우는 시간 입력 단계에서 따로 확인해야 해요.'];
function calendar(timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' });
  return { timeZone: formatter.resolvedOptions().timeZone, date: value => {
    const parts = Object.fromEntries(formatter.formatToParts(value).filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => [part.type, part.value]));
    return `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`;
  } };
}

export function getSchedulePreparation(input) {
  const empty = (status, reason, summary, timeZone = null) => ({ status, reason, timeZone, dates: [], summary, timeHint: null, limitations: [...LIMITATIONS] });
  if (!plain(input) || input.source !== 'public-profile') return empty('unavailable', 'public-context-required', '현재 서로 공개한 일정을 먼저 확인해 주세요.');
  const now = instant(input.nowISO), requestedZone = input.timeZone ?? 'Asia/Seoul';
  if (!Number.isFinite(now) || new Date(now).toISOString() !== input.nowISO) return empty('unavailable', 'invalid-time', '현재 시각을 확인한 뒤 날짜를 다시 살펴봐 주세요.');
  let local;
  try { if (!text(requestedZone)) throw new TypeError(); local = calendar(requestedZone); }
  catch { return empty('unavailable', 'invalid-time-zone', '입력 시간대를 확인한 뒤 날짜를 다시 살펴봐 주세요.'); }
  const { myAvailability: mine, partnerAvailability: theirs } = input;
  if (mine != null && !AVAILABILITY.has(mine) || theirs != null && !AVAILABILITY.has(theirs))
    return empty('unavailable', 'invalid-availability', '공개한 일정 답을 다시 확인해 주세요.', local.timeZone);
  if (!mine || !theirs) return empty('unknown', 'availability-missing', !mine && !theirs ? '두 사람 모두 공개한 가능 요일이 아직 없어요. 날짜는 직접 이야기해 정해 주세요.'
    : !mine ? '내가 공개한 가능 요일이 아직 없어요. 상대의 답만으로 공통 날짜를 정하지 않아요.' : '상대가 공개한 가능 요일이 아직 없어요. 내 답으로 상대 일정을 대신 정하지 않아요.', local.timeZone);
  if (mine !== 'any' && theirs !== 'any' && mine !== theirs)
    return empty('no-overlap', 'availability-conflict', '한 사람은 주말, 다른 사람은 평일 저녁을 공개했어요. 먼저 함께 가능한 날을 이야기해 주세요.', local.timeZone);
  const common = mine === 'any' ? theirs : mine, today = local.date(now), dates = [];
  const day = new Date(`${today}T12:00:00.000Z`);
  for (let count = 0; count < 22 && dates.length < 3; count++) {
    // Civil calendar arithmetic avoids moving a requested day by a DST hour.
    day.setUTCDate(day.getUTCDate() + 1);
    const date = day.toISOString().slice(0, 10), weekday = day.getUTCDay(), weekend = weekday === 0 || weekday === 6;
    if (common === 'weekend' && !weekend || common === 'weekday' && weekend) continue;
    // A whole civil date can disappear after a timezone date-line change. Only
    // return days represented by actual instants in this supported Intl zone.
    let exists = false;
    for (let hours = -36; hours <= 36 && !exists; hours += 3) exists = local.date(day.getTime() + hours * 3600000) === date;
    if (!exists) continue;
    dates.push({ date, label: `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 (${WEEKDAYS[weekday]})`, weekday });
  }
  return { status: 'ready', reason: null, timeZone: local.timeZone, dates,
    summary: '서로 공개한 요일이 겹치는 내일 이후 날짜예요. 고른 날짜도 제안 전 직접 확인해 주세요.',
    timeHint: common === 'weekday' ? '두 사람의 답이 겹치는 범위는 평일 저녁이에요. 실제 시작·종료 시각은 직접 정해 주세요.' : '실제 시작·종료 시각은 아직 확인하지 않았어요.', limitations: [...LIMITATIONS] };
}
