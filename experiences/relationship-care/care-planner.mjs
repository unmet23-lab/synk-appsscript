/** 사용자가 밝힌 조건으로 행동 준비를 고른다. Core·Ask의 순수 API만 사용한다. */
import * as DomainModule from '../../atlas/domain.js';
import * as AskModule from '../../atlas/ask.js';
import { importBackup, nextOccurrence } from './model.mjs';
import { resolveCareMemory } from './care-personalization.mjs';

const Core = DomainModule.default ?? globalThis.SynkAtlasDomain;
const Ask = AskModule.default ?? globalThis.SynkAsk;
export const CARE_PLANNER_VERSION = 'care-preparation-2';
const ATTENDANCE = ['attend', 'not-attend', 'undecided'];
const TITLE = { contact: '짧은 인사 보내기', attend: '참석 준비하기', gift: '선물 준비하기', remember: '오늘은 조용히 기억하기' };
const QUESTIONS = [
  { id: 'care-time', field: 'timeMinutes', about: 'timeMinutes', kind: 'setting', label: '지금 준비에 몇 분을 쓸 수 있나요?', options: [{ id: 'none', label: '지금은 어려워요', value: 0 }, { id: 'short', label: '3분', value: 3 }, { id: 'enough', label: '15분', value: 15 }] },
  { id: 'care-attendance', field: 'attendance', about: 'attendance', kind: 'setting', label: '직접 참석할 수 있나요?', options: [{ id: 'yes', label: '참석할 수 있어요', value: 'attend' }, { id: 'no', label: '참석하기 어려워요', value: 'not-attend' }] },
  { id: 'care-budget', field: 'budgetWon', about: 'budgetWon', kind: 'setting', label: '따로 쓸 예산이 있나요? 금액을 직접 적어도 돼요.', options: [{ id: 'none', label: '마음만 전할게요', value: 0 }, { id: 'some', label: '1만 원까지 쓸 수 있어요', value: 10000 }] },
];

function integer(value, max, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label}에는 0부터 ${max.toLocaleString('ko-KR')}까지 숫자를 적어 주세요.`);
  return value;
}

function decision(event, person, input, at, occurrence, memory) {
  const type = event?.type ?? 'checkin';
  const hasAttendance = occurrence !== null && ['wedding', 'condolence', 'memorial'].includes(type);
  const sensitive = ['condolence', 'memorial'].includes(type);
  const canSpend = input.budgetWon !== null && input.budgetWon > 0;
  const scope = { domain: 'SYNK', workspace: 'relationship-care', subject: `person:${person.id}` };
  const contract = {
    id: 'care-preparation', version: '2', purpose: 'prepare-next-action',
    fields: [{ id: 'timeMinutes', kind: 'number', range: [0, 1440] }, { id: 'budgetWon', kind: 'number', range: [0, 1000000000] }, { id: 'attendance', kind: 'enum', values: ATTENDANCE }, { id: 'memoryUse', kind: 'enum', values: ['none', 'shared-memory', 'gift-preference'] }],
    criteria: [
      { id: 'within-preparation-time', field: 'timeMinutes', feature: 'minutes', weight: 0, required: input.timeMinutes !== null, prefer: 'at-most' },
      { id: 'within-own-budget', field: 'budgetWon', feature: 'cost', weight: 0, required: input.budgetWon !== null, prefer: 'at-most' },
      { id: 'attendance-compatible', field: 'attendance', feature: 'attendance', weight: 0, required: input.attendance !== 'undecided', prefer: 'match' },
      { id: 'confirmed-memory-use', field: 'memoryUse', feature: 'memoryUse', weight: 0.15, required: false, prefer: 'match' },
    ],
    objectives: [{ id: 'care-policy', feature: 'priority', range: [0, 100], weight: 1, prefer: 'higher' }],
  };
  const declared = { ...input, ...(memory && !memory.blockedReasons.length ? { memoryUse: memory.use } : {}) };
  const observations = Object.entries(declared).filter(([, value]) => value !== null && value !== 'undecided').map(([field, value]) => ({
    id: `declared:${field}`, scope, contract: { id: contract.id, version: contract.version, purpose: contract.purpose }, field, value, source: 'declared', at,
  }));
  // 아래 준비 시간과 순서는 제품의 공개된 기준이다. 이동 시간·물건 가격·상대 마음의 추정이 아니다.
  const specs = [
    { id: 'remember', minutes: 0, cost: 0, priority: 10, eligible: true },
    { id: 'contact', minutes: 3, cost: 0, priority: 60, eligible: input.timeMinutes !== null },
    { id: 'attend', minutes: 10, cost: 0, priority: 90, eligible: hasAttendance && input.attendance === 'attend' && input.timeMinutes !== null },
    { id: 'gift', minutes: 15, cost: input.budgetWon ?? 0, priority: 70, eligible: !!event && !sensitive && canSpend && input.timeMinutes !== null },
  ];
  const candidates = specs.map(item => ({ id: item.id, eligible: item.eligible, features: { minutes: item.minutes, cost: item.cost, priority: item.priority, attendance: item.id === 'attend' ? 'attend' : input.attendance, memoryUse: item.id === 'contact' ? 'shared-memory' : item.id === 'gift' ? 'gift-preference' : 'none' } }));
  const result = Core.decide({ contract, scope, observations, at, candidates });
  return { result, specs, sensitive, hasAttendance };
}

function card(action, context, input, person, event, occurrence, memory) {
  const spec = context.specs.find(item => item.id === action);
  const reason = [], steps = [];
  if (action === 'remember') {
    reason.push(input.timeMinutes === null ? '준비할 시간을 아직 고르지 않아서 바로 해야 하는 일은 빼 두었어요.' : '지금 쓸 수 있는 시간으로 가장 부담 없는 방법이에요.');
    steps.push(event ? `「${event.title}」 날짜를 기억해 둬요.` : `${person.name} 님께 안부를 전하고 싶었던 마음을 기억해 둬요.`, '지금 연락하기 어렵다면 다시 챙길 날을 정해 둬요.');
  } else {
    reason.push(`쓸 수 있는 ${input.timeMinutes}분 안에 끝나는 ${spec.minutes}분짜리 준비예요.`);
    if (action === 'contact') {
      reason.push(context.sensitive ? '조심스러운 날이라 답장을 바라지 않는 짧은 문장으로 준비해요.' : '돈을 쓰지 않고 먼저 마음을 전할 수 있어요.');
      steps.push('아래 문구를 내 말로 고치고 호칭과 날짜가 맞는지 봐요.', context.sensitive ? '답장을 재촉하거나 지키기 어려운 약속이 들어가지 않았는지 봐요.' : '마지막 한 줄은 내 말로 더해요.', '복사해서 문자나 메신저로 직접 보내고, 보낸 뒤 기록을 남겨요.');
    }
    if (action === 'attend') {
      reason.push('참석할 수 있다고 고르셨어요.', '10분은 일정을 확인하는 데 드는 시간이에요. 오가는 시간은 따로 잡아 두세요.');
      steps.push(`${occurrence?.date ?? event.date}${event.time ? ` ${event.time}` : ''} 일정에 갈 수 있는지 봐요.`, event.location ? `${event.location}까지 가는 길과 걸리는 시간을 알아봐요.` : '장소와 가는 데 걸리는 시간을 먼저 알아봐요.', '주최하는 분께 참석한다고 알리고, 챙겨 갈 것이 있는지 물어봐요.');
    }
    if (action === 'gift') {
      reason.push(`직접 정한 ${input.budgetWon.toLocaleString('ko-KR')}원 안에서 고르면 돼요.`, '이 금액은 시세가 아니라 내가 정한 예산이에요. 가격과 배송비는 살 때 다시 봐요.');
      steps.push('「선물과 마음 메모」에 적어 둔 취향이 있는지 봐요.', `배송비까지 ${input.budgetWon.toLocaleString('ko-KR')}원 안인지 봐요.`, '받기 편한 날과 방법을 정하고, 짧은 메시지도 함께 준비해요.');
    }
  }
  let memoryApplied = false;
  if (memory && !memory.blockedReasons.length) {
    if (memory.use === 'shared-memory') {
      steps.unshift(action === 'remember' ? `고른 기억을 조용히 떠올려요. “${memory.text}”` : `고른 기억을 문구에 담아요. 상대에게 전해도 괜찮은 내용인지 한 번 더 봐요. “${memory.text}”`);
      reason.push('고른 기억을 준비에 넣었어요.'); memoryApplied = true;
    } else if (action === 'gift') {
      steps[0] = `고른 취향을 기준으로 선물을 골라요. 지금도 좋아하는지 먼저 떠올려 봐요. “${memory.text}”`;
      reason.push('고른 선물 취향을 준비에 넣었어요.'); memoryApplied = true;
    }
  }
  return { action, title: TITLE[action], reason, steps, timeMinutes: spec.minutes, amountWon: action === 'gift' ? input.budgetWon : null, memoryApplied };
}

/** 순수 추천. 저장·발송·질문 노출 기록은 UI가 명시적으로 처리한다. */
export function prepareCare({ state, personId, eventId, attendance = 'undecided', timeMinutes = null, budgetWon = null, memorySelection = null, now = new Date() } = {}) {
  const current = importBackup(state);
  const person = current.people.find(item => item.id === personId);
  const event = eventId === '' ? null : current.events.find(item => item.id === eventId);
  if (!person || (eventId !== '' && (!event || event.personId !== person.id))) throw new Error('준비할 사람과 일정을 다시 골라 주세요.');
  if (!ATTENDANCE.includes(attendance)) throw new Error('참석할 수 있는지 골라 주세요.');
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('준비할 시각을 읽지 못했어요.');
  const at = date.toISOString();
  const input = { attendance, timeMinutes: integer(timeMinutes, 1440, '준비 시간'), budgetWon: integer(budgetWon, 1000000000, '예산') };
  const occurrence = event ? nextOccurrence(event, now) : null;
  const memory = resolveCareMemory({ state: current, personId: person.id, eventType: event?.type ?? 'checkin', memorySelection });
  const context = decision(event, person, input, at, occurrence, memory);
  const answers = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null && value !== 'undecided'));
  const questions = QUESTIONS.filter(question => question.field !== 'attendance' || context.hasAttendance).filter(question => question.field !== 'budgetWon' || event && !context.sensitive);
  const ask = Ask.choose({ questions, answers, now: at, decide(values) {
    const hypothetical = { ...input, ...values };
    const evaluated = decision(event, person, hypothetical, at, occurrence, memory).result;
    return { content: evaluated.selected?.id ?? null, shape: null };
  } });
  const usefulQuestions = ask.ranked.filter(item => !item.skippable).map(item => structuredClone(questions.find(question => question.id === item.id)));
  const recommendation = card(context.result.selected.id, context, input, person, event, occurrence, memory);
  const alternatives = context.result.ranked.slice(1).map(item => card(item.id, context, input, person, event, occurrence, memory));
  if (memory && recommendation.memoryApplied) memory.appliedTo.push('steps');
  if (memory && !memory.blockedReasons.length && !recommendation.memoryApplied) memory.blockedReasons.push('지금 추천한 준비에는 고른 선물 취향을 쓰지 않았어요. 선물을 준비할 때 참고해 주세요.');
  return {
    version: CARE_PLANNER_VERSION, status: ask.status === 'ask' ? 'needs-input' : 'ready', personId, eventId,
    occurrenceId: occurrence ? `${event.id}:${occurrence.date}` : null,
    recommendation, alternatives, memory,
    question: usefulQuestions[0] ?? null, questions: usefulQuestions,
    engines: { core: Core.VERSION, ask: Ask.VERSION },
    decision: context.result,
  };
}
