/** 사용자가 밝힌 조건으로 행동 준비를 고른다. Core·Ask의 순수 API만 사용한다. */
import * as DomainModule from '../../atlas/domain.js';
import * as AskModule from '../../atlas/ask.js';
import { importBackup, nextOccurrence } from './model.mjs';
import { resolveCareMemory } from './care-personalization.mjs';

const Core = DomainModule.default ?? globalThis.SynkAtlasDomain;
const Ask = AskModule.default ?? globalThis.SynkAsk;
export const CARE_PLANNER_VERSION = 'care-preparation-2';
const ATTENDANCE = ['attend', 'not-attend', 'undecided'];
const TITLE = { contact: '짧게 마음 전하기', attend: '참석할 준비하기', gift: '선물 준비하기', remember: '오늘은 조용히 기억하기' };
const QUESTIONS = [
  { id: 'care-time', field: 'timeMinutes', about: 'timeMinutes', kind: 'setting', label: '지금 준비에 몇 분을 쓸 수 있나요?', options: [{ id: 'none', label: '지금은 어려워요', value: 0 }, { id: 'short', label: '3분', value: 3 }, { id: 'enough', label: '15분', value: 15 }] },
  { id: 'care-attendance', field: 'attendance', about: 'attendance', kind: 'setting', label: '직접 참석할 수 있나요?', options: [{ id: 'yes', label: '참석할 수 있어요', value: 'attend' }, { id: 'no', label: '참석하기 어려워요', value: 'not-attend' }] },
  { id: 'care-budget', field: 'budgetWon', about: 'budgetWon', kind: 'setting', label: '별도로 쓸 예산이 있나요? 원하는 금액을 직접 입력해도 돼요.', options: [{ id: 'none', label: '마음만 전할게요', value: 0 }, { id: 'some', label: '1만 원까지 쓸 수 있어요', value: 10000 }] },
];

function integer(value, max, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${label}은 0~${max.toLocaleString('ko-KR')} 사이의 정수로 입력해 주세요.`);
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
    reason.push(input.timeMinutes === null ? '준비 시간을 아직 정하지 않아, 바로 실행이 필요한 행동은 보류했어요.' : '지금 가능한 준비 시간 안에서 부담이 가장 적은 방법이에요.');
    steps.push(event ? `${person.name} 님의 ${event.title} 날짜를 확인해요.` : `${person.name} 님에게 문득 안부를 전하고 싶었던 마음을 기억해요.`, '지금 연락하기 어렵다면, 다시 챙길 날짜를 직접 골라 후속 챙김으로 남겨요.');
  } else {
    reason.push(`입력한 ${input.timeMinutes}분 안에 시작할 수 있도록 ${spec.minutes}분 분량의 준비 순서를 골랐어요.`);
    if (action === 'contact') {
      reason.push(context.sensitive ? '조심스러운 날에는 답장을 요구하지 않는 짧은 문장부터 준비해요.' : '별도 지출 없이 먼저 마음을 전할 수 있어요.');
      steps.push('아래 초안을 내 말로 고치고 호칭·일정·피할 표현을 확인해요.', context.sensitive ? '답장을 재촉하거나 확인되지 않은 약속을 넣지 않았는지 살펴요.' : '상대에게 맞는 호칭과 마지막 한 줄을 확인해요.', '복사한 뒤 원하는 연락 수단에서 직접 보내요. 실제로 보낸 후 챙긴 기록을 남겨요.');
    }
    if (action === 'attend') {
      reason.push('직접 참석할 수 있다고 알려 주셨어요.', '10분은 일정 확인을 위한 준비 기준이며, 이동·참석에 드는 시간은 별도로 확인해야 해요.');
      steps.push(`${occurrence?.date ?? event.date}${event.time ? ` ${event.time}` : ' · 시간 미정'}에 참석 가능한지 다시 확인해요.`, event.location ? `${event.location}의 위치·이동 시간을 직접 확인해요.` : '장소와 이동 시간을 먼저 확인해요.', '주최 측이나 연락을 맡은 분에게 참석 의사를 직접 전하고 필요한 준비물을 확인해요.');
    }
    if (action === 'gift') {
      reason.push(`직접 정한 ${input.budgetWon.toLocaleString('ko-KR')}원을 상한으로 살펴볼 수 있어요.`, '이 금액은 추천 시세가 아니라 내 예산이에요. 상품 가격·배송비·수령 가능 여부는 구매 전에 확인해요.');
      steps.push('이미 확인한 상대 취향이 있는지 기억 카드를 살펴요. 모르는 취향은 추측하지 않아요.', `배송비를 포함해 ${input.budgetWon.toLocaleString('ko-KR')}원 이내인지 직접 확인해요.`, '받기 편한 방법과 날짜를 확인한 뒤, 짧은 메시지를 함께 준비해요.');
    }
  }
  let memoryApplied = false;
  if (memory && !memory.blockedReasons.length) {
    if (memory.use === 'shared-memory') {
      steps.unshift(action === 'remember' ? `내가 고른 기억 “${memory.text}”을 조용히 떠올려요.` : `내가 함께한 기억으로 고른 “${memory.text}”을 문구에 담을 때, 전달할 내용으로 적절한지 확인해요.`);
      reason.push('이번에 직접 고른 함께한 기억을 준비에 연결했어요.'); memoryApplied = true;
    } else if (action === 'gift') {
      steps[0] = `선물 취향으로 직접 고른 “${memory.text}”을 기준으로 후보를 살펴요. 지금도 맞는 취향인지 먼저 확인해요.`;
      reason.push('이번에 직접 확인한 선물 취향을 준비 순서에 넣었어요.'); memoryApplied = true;
    }
  }
  return { action, title: TITLE[action], reason, steps, timeMinutes: spec.minutes, amountWon: action === 'gift' ? input.budgetWon : null, memoryApplied };
}

/** 순수 추천. 저장·발송·질문 노출 기록은 UI가 명시적으로 처리한다. */
export function prepareCare({ state, personId, eventId, attendance = 'undecided', timeMinutes = null, budgetWon = null, memorySelection = null, now = new Date() } = {}) {
  const current = importBackup(state);
  const person = current.people.find(item => item.id === personId);
  const event = eventId === '' ? null : current.events.find(item => item.id === eventId);
  if (!person || (eventId !== '' && (!event || event.personId !== person.id))) throw new Error('준비할 사람과 일정을 다시 선택해 주세요.');
  if (!ATTENDANCE.includes(attendance)) throw new Error('참석 가능 여부를 확인해 주세요.');
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('준비의 기준 시간을 확인해 주세요.');
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
  if (memory && !memory.blockedReasons.length && !recommendation.memoryApplied) memory.blockedReasons.push('지금 추천한 준비에는 선택한 선물 취향을 사용하지 않았어요. 선물 준비를 고를 때 참고할 수 있어요.');
  return {
    version: CARE_PLANNER_VERSION, status: ask.status === 'ask' ? 'needs-input' : 'ready', personId, eventId,
    occurrenceId: occurrence ? `${event.id}:${occurrence.date}` : null,
    recommendation, alternatives, memory,
    question: usefulQuestions[0] ?? null, questions: usefulQuestions,
    engines: { core: Core.VERSION, ask: Ask.VERSION },
    decision: context.result,
  };
}
