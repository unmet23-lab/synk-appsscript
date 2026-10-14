/** 오늘의 한 사람. 보관한 사실을 Core로 정렬하며 저장·연락·개인 성향 추론은 하지 않는다. */
import * as DomainModule from '../../atlas/domain.js';
import { importBackup, upcomingEvents, nextOccurrence } from './model.mjs';
import { followupRows, SUPPORT_ENGINES } from './care-support.mjs';

const monthDay = date => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

const Core = DomainModule.default ?? globalThis.SynkAtlasDomain;
const DAY = 86400000;
const QUIET = new Set(['condolence', 'memorial']);
export const CARE_FOCUS_VERSION = 'care-focus-1';
export const FOCUS_POLICY = '오늘 일정 → 내가 정한 후속 챙김 → 7일 안 일정 → 최근 챙김 기록을 기준으로 살펴봐요.';
const CONTRACT = {
  id: 'care-focus', version: '1', purpose: 'choose-next-care',
  fields: [{ id: 'daysUntil', kind: 'number', range: [-109600, 109600] }], criteria: [],
  // 제품의 순서 기준이다. 관계 점수나 사람이 선언한 선호로 만들지 않는다.
  objectives: [{ id: 'due-and-record-order', feature: 'priority', range: [0, 1000], weight: 1, prefer: 'higher' }],
};
const dayNumber = value => Date.parse(`${value}T00:00:00Z`);
const moveDay = (value, days) => new Date(dayNumber(value) + days * DAY).toISOString().slice(0, 10);
const short = text => [...text].length > 100 ? [...text].slice(0, 100).join('') + '…' : text;
function koreanDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('추천의 기준 시간을 확인해 주세요.');
  const result = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  if (result < '1900-01-01' || result > '2199-12-31') throw new Error('1900~2199년 사이의 기준 날짜를 확인해 주세요.');
  return result;
}

export function recommendCareFocus({ state, now = new Date() } = {}) {
  const current = importBackup(state), at = new Date(now), date = koreanDate(at);
  const observed = value => Number.isFinite(Date.parse(value)) && Date.parse(value) <= at.getTime();
  // 미래 시계로 남긴 완료가 오늘의 일정이나 실제 챙김을 가리지 않도록 한다.
  const usable = { ...current, completions: current.completions.filter(item => observed(item.completedAt)),
    activities: current.activities.filter(item => observed(item.createdAt) && item.occurredOn <= date),
    followups: current.followups.filter(item => observed(item.createdAt) && observed(item.updatedAt)) };
  const people = new Map(current.people.map(person => [person.id, person]));
  const output = { version: CARE_FOCUS_VERSION, date, status: current.people.length ? 'caught-up' : 'empty', recommendation: null, alternatives: [],
    basisPolicy: FOCUS_POLICY, engines: { core: Core.VERSION, trail: SUPPORT_ENGINES.followup } };
  if (!current.people.length) return output;
  const latest = new Map(), keepLatest = (personId, when) => { if (!latest.has(personId) || latest.get(personId) < when) latest.set(personId, when); };
  for (const activity of usable.activities) keepLatest(activity.personId, activity.occurredOn);
  for (const completion of usable.completions) keepLatest(completion.personId, koreanDate(completion.completedAt));
  // '직접 챙겼어요'로 끝낸 후속 챙김도 실제 행동이다. 미루기·중단은 완료로 세지 않는다.
  for (const followup of usable.followups) if (followup.status === 'done') keepLatest(followup.personId, koreanDate(followup.updatedAt));
  const detail = person => {
    const memories = current.memories.filter(item => item.personId === person.id && observed(item.createdAt));
    const memory = memories.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))[0];
    return memory ? `직접 남긴 기억 · ${short(memory.text)}` : person.notes ? `수첩에 남긴 이야기 · ${short(person.notes)}` : '준비 화면에서 내 말투로 다듬어 주세요. 연락과 기록은 직접 선택해요.';
  };
  const candidates = [];
  const add = (item, priority) => candidates.push({ ...item, priority });
  for (const { person, event, occurrence } of upcomingEvents(usable, at)) {
    if (occurrence.daysUntil > 7) continue;
    // 고인으로 표시한 사람의 생일·기념일도 축하 대신 조용한 안내로 보여 준다.
    const quiet = QUIET.has(event.type) || person.deceased === true;
    add({ key: `event:${event.id}:${occurrence.date}`, personId: person.id, personName: person.name, kind: 'event', eventId: event.id, followupId: '', occurrenceId: occurrence.occurrenceId,
      title: event.title, reason: occurrence.daysUntil === 0 ? `오늘(${monthDay(occurrence.date)}) 기억해 둔 날이에요.` : `${occurrence.daysUntil}일 뒤(${monthDay(occurrence.date)})로 남겨 둔 일정이에요.`,
      detail: quiet ? '연락 없이 조용히 기억해도 괜찮아요. 마음을 전한다면 답장을 재촉하지 않는 표현부터 준비해요.' : detail(person),
      actionLabel: quiet ? '조용한 문구 준비하기' : '문구 준비하기', quiet }, occurrence.daysUntil === 0 ? 1000 : 700 - occurrence.daysUntil);
  }
  for (const followup of followupRows(usable, { today: date }).pending) {
    if (!followup.person || followup.daysUntil > 0) continue;
    add({ key: `followup:${followup.id}`, personId: followup.person.id, personName: followup.person.name, kind: 'followup', eventId: '', followupId: followup.id, occurrenceId: '',
      title: followup.title, reason: `내가 다시 챙기기로 정한 날은 ${followup.dueOn}이에요.${followup.daysUntil < 0 ? ' 지금도 필요한지 먼저 확인해 주세요.' : ''}`,
      detail: '남겨 둔 내용과 지난 이야기를 보며 안부를 준비해요. 날짜를 바꾸거나 그만 챙기려면 우리의 기록을 열어 주세요.', actionLabel: '이 안부 준비하기', quiet: true }, followup.daysUntil === 0 ? 900 : 850 + Math.min(30, Math.abs(followup.daysUntil)));
  }
  const quietPeople = new Set();
  // 기일·부고 주변에는 기록 간격만으로 평범한 안부를 권하지 않는다.
  const start = moveDay(date, -30), end = moveDay(date, 7);
  for (const event of current.events) {
    if (!QUIET.has(event.type)) continue;
    const occurrence = nextOccurrence(event, `${start < '1900-01-01' ? '1900-01-01' : start}T00:00:00+09:00`);
    if (occurrence && occurrence.date <= end) quietPeople.add(event.personId);
  }
  // 직접 정한 다음 챙김 날보다 앞서 일반 안부로 다시 재촉하지 않는다.
  const plannedPeople = new Set(usable.followups.filter(item => item.status === 'pending' && item.dueOn > date).map(item => item.personId));
  for (const person of people.values()) {
    // 고인에게는 일반 안부를 권하지 않는다. 기일·생전 생신은 위의 일정으로만 보여 준다.
    if (person.deceased === true || quietPeople.has(person.id) || plannedPeople.has(person.id)) continue;
    const interval = person.checkinIntervalDays ?? 30;
    if (interval === 0) continue;
    const last = latest.get(person.id), days = last ? Math.round((dayNumber(date) - dayNumber(last)) / DAY) : null;
    if (days !== null && days < interval) continue;
    const intervalReason = Object.hasOwn(person, 'checkinIntervalDays') ? ` 직접 정한 ${interval}일 간격으로 안부를 살펴보고 있어요.` : '';
    add({ key: `checkin:${person.id}`, personId: person.id, personName: person.name, kind: 'checkin', eventId: '', followupId: '', occurrenceId: '',
      title: '가볍게 안부를 준비해 볼까요?',
      reason: (last ? `수첩에 마지막으로 남긴 챙김은 ${last}(${days}일 전)이에요. 실제로 나눈 연락과 다를 수 있어요.` : '아직 이 사람의 챙김 기록을 남기지 않았어요. 첫 안부부터 준비해 볼 수 있어요.') + intervalReason,
      detail: detail(person), actionLabel: '안부 문구 준비하기', quiet: false }, last ? 400 + Math.min(days, 3650) / 100 : 200);
  }
  // 한 사람의 여러 일감은 가장 가까운 제안 하나로 묶는다. 연락 횟수를 늘리기 위한 순위가 아니다.
  const byPerson = new Map();
  for (const item of candidates) {
    const old = byPerson.get(item.personId);
    if (!old || item.priority > old.priority || item.priority === old.priority && item.key.localeCompare(old.key) < 0) byPerson.set(item.personId, item);
  }
  const values = [...byPerson.values()], byKey = new Map(values.map(item => [item.key, item]));
  if (!values.length) return output;
  const decision = Core.decide({ contract: CONTRACT, scope: { domain: 'SYNK', workspace: 'relationship-care', subject: 'current-notebook' }, observations: [], at: at.toISOString(),
    candidates: values.map(item => ({ id: item.key, features: { priority: item.priority } })) });
  const ranked = decision.ranked.map(row => { const { priority, ...item } = byKey.get(row.id);return item; });
  return { ...output, status: 'ready', recommendation: ranked[0], alternatives: ranked.slice(1) };
}
