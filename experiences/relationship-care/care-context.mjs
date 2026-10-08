/** 연락 전에 현재 수첩에서 꺼내는 사실. 문구 생성·저장·완료 처리는 하지 않는다. */
import { MESSAGE_TYPES } from './model.mjs';

const DAY = 86400000;
const ACTION_LABELS = Object.freeze({ contact: '연락', attend: '참석', gift: '선물', money: '경조금', remember: '조용히 기억' });
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31') return NaN;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : NaN;
}

function koreanDay(value) {
  const at = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(at)) return '';
  // All model timestamps have an explicit zone. Read the UTC instant in KST.
  const shifted = new Date(at + 9 * 60 * 60 * 1000);
  if (!Number.isFinite(shifted.getTime())) return '';
  const result = shifted.toISOString().slice(0, 10);
  return Number.isFinite(dayNumber(result)) ? result : '';
}

const recent = (a, b) => compare(b.date, a.date) || Date.parse(b.recordedAt) - Date.parse(a.recordedAt)
  || compare(a.sourceKind, b.sourceKind) || compare(a.id, b.id);

/**
 * `today` is a Korean calendar date, not an instant. Records dated after that
 * day are excluded; no claim is made about clock order within the same day.
 * Input normally comes from model.importBackup. Ownership and source evidence
 * are checked again here so a removed or changed source cannot remain visible.
 * Returned rows contain only the selected person's display data, not full sources.
 */
export function buildCareContext(state, { personId, today, eventType = 'checkin', followupId = '' } = {}) {
  const currentDay = dayNumber(today);
  if (!Number.isFinite(currentDay)) throw new Error('맥락을 살펴볼 한국 날짜를 확인해 주세요.');
  if (!Object.hasOwn(MESSAGE_TYPES, eventType)) throw new Error('맥락을 살펴볼 일정 종류를 확인해 주세요.');
  const who = list(state?.people).find(item => item?.id === personId);
  const result = { personId: who?.id ?? null, today, lastCare: null, selectedFollowup: null, followups: [], memories: [], exchanges: [], previousDraft: null };
  if (!who) return result;
  const observed = value => { const date = koreanDay(value); return !!date && date <= today; };
  const events = new Map(list(state.events).filter(item => item?.personId === personId).map(item => [item.id, item]));
  const sources = new Map(list(state.sources).filter(item => item?.personId === personId && observed(item.createdAt)).map(item => [item.id, item]));
  const evidence = item => {
    const source = sources.get(item.sourceId);
    return source && typeof source.text === 'string' && typeof item.sourceQuote === 'string' && item.sourceQuote.trim()
      && source.text.includes(item.sourceQuote) ? { sourceId: source.id, sourceTitle: text(source.title), sourceQuote: item.sourceQuote } : null;
  };

  const activities = list(state.activities).filter(item => item?.personId === personId && Object.hasOwn(ACTION_LABELS, item.kind)
    && Number.isFinite(dayNumber(item.occurredOn)) && item.occurredOn <= today && observed(item.createdAt)
    && (!item.eventId || events.has(item.eventId))).map(item => ({
    sourceKind: 'activity', id: item.id, personId, kind: item.kind, date: item.occurredOn, recordedAt: item.createdAt,
    label: `${item.direction === 'received' ? '받은 마음' : '전한 마음'} · ${ACTION_LABELS[item.kind]}`,
    direction: item.direction, amountWon: item.amountWon ?? null, note: text(item.note), eventId: text(item.eventId),
  }));
  // A saved care-log can add both an activity and a completion in one operation.
  // That completion's timestamp is when the record was entered, whereas the
  // companion activity has the explicitly chosen day and story. Only exact
  // same-operation companions replace it; an older activity for the same annual
  // event must not hide a later, independent completion.
  const activityReceipts = new Set(activities.filter(item => item.eventId && item.direction === 'sent')
    .map(item => `${item.eventId}:${Date.parse(item.recordedAt)}:${item.kind === 'remember' ? 'remembered' : 'contacted'}`));
  const completions = list(state.completions).filter(item => item?.personId === personId && events.has(item.eventId)
    && observed(item.completedAt) && ['contacted', 'remembered'].includes(item.action)
    && !activityReceipts.has(`${item.eventId}:${Date.parse(item.completedAt)}:${item.action}`)).map(item => ({
    sourceKind: 'completion', id: item.occurrenceId, personId, kind: item.action,
    date: koreanDay(item.completedAt), recordedAt: item.completedAt,
    label: item.action === 'remembered' ? '조용히 기억한 날' : '직접 챙김 완료',
    eventId: item.eventId, eventTitle: text(item.eventTitle) || text(events.get(item.eventId)?.title), scheduledDate: item.date,
  }));
  const followups = list(state.followups).filter(item => item?.personId === personId && observed(item.createdAt)
    && observed(item.updatedAt) && Number.isFinite(dayNumber(item.dueOn)) && typeof item.title === 'string' && item.title.trim())
    .map(item => ({ item, source: item.sourceId || item.sourceQuote ? evidence(item) : { sourceId: '', sourceTitle: '', sourceQuote: '' } }))
    .filter(({ source }) => source !== null);
  const done = followups.filter(({ item }) => item.status === 'done').map(({ item }) => ({
    sourceKind: 'followup', id: item.id, personId, kind: 'done', date: koreanDay(item.updatedAt), recordedAt: item.updatedAt,
    label: '후속 챙김 완료', title: item.title, dueOn: item.dueOn,
  }));
  result.lastCare = [...activities, ...completions, ...done].sort(recent)[0] ?? null;
  result.exchanges = activities.filter(item => item.kind === 'gift' || item.kind === 'money').sort(recent).slice(0, 3);

  const pending = followups.filter(({ item }) => item.status === 'pending').map(({ item, source }) => {
    const daysUntil = Math.round((dayNumber(item.dueOn) - currentDay) / DAY);
    return { sourceKind: 'followup', id: item.id, personId, kind: 'pending', label: '직접 정한 다음 챙김',
      title: item.title, date: item.dueOn, dueOn: item.dueOn, recordedAt: item.updatedAt,
      phase: daysUntil < 0 ? 'overdue' : daysUntil === 0 ? 'today' : 'upcoming', daysUntil,
      selected: item.id === followupId, ...source };
  });
  result.selectedFollowup = pending.find(item => item.selected) ?? null;
  const phaseOrder = { today: 0, overdue: 1, upcoming: 2 };
  result.followups = pending.sort((a, b) => Number(b.selected) - Number(a.selected)
    || phaseOrder[a.phase] - phaseOrder[b.phase] || compare(a.dueOn, b.dueOn) || compare(a.id, b.id)).slice(0, 3);
  result.memories = list(state.memories).filter(item => item?.personId === personId && observed(item.createdAt)
    && typeof item.text === 'string' && item.text.trim()).flatMap(item => {
    const source = evidence(item);
    return source ? [{ sourceKind: 'memory', id: item.id, personId, kind: item.kind,
      label: item.kind === 'preference' ? '확인한 취향과 표현' : '함께한 기억', text: item.text,
      date: koreanDay(item.createdAt), recordedAt: item.createdAt, ...source }] : [];
  }).sort(recent).slice(0, 3);
  result.previousDraft = list(state.drafts).filter(item => item?.personId === personId && item.eventType === eventType
    && observed(item.createdAt) && typeof item.text === 'string' && item.text.trim()
    && (eventType === 'checkin' ? item.eventId === '' : events.has(item.eventId))).map(item => ({
    sourceKind: 'draft', id: item.id, personId, kind: 'copied', label: '복사한 문구',
    text: item.text, eventType, eventId: item.eventId, date: koreanDay(item.createdAt), recordedAt: item.createdAt,
  })).sort(recent)[0] ?? null;
  return result;
}
