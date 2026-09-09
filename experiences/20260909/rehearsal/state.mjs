export const STORAGE_KEY = 'synk.rehearsal.v1';
export const SCENARIO_ID = 'shift-first-brief-v1';
export const SCHEMA_VERSION = 1;
export const FIELD_LABELS = Object.freeze({
  askGoal: '고객의 목적을 확인하는 질문',
  askScope: '필요한 결과물을 확인하는 질문',
  askTiming: '일정과 예산을 확인하는 질문',
  initialProposal: '첫 제안',
  revisedProposal: '변경 요청을 반영한 제안',
  changeReason: '바꾼 이유와 지킨 기준',
  transferQuestion: '다른 고객에게 먼저 할 질문',
  transferProposal: '다른 고객에게 적용한 제안',
  takeaway: '다음 의뢰에서도 사용할 기준',
  mentorEvidence: '강사 검토: 실제 답에서 확인한 근거',
  mentorNext: '강사 검토: 다음에 연습할 한 가지',
});
export const STEP_FIELDS = Object.freeze([
  [], ['askGoal', 'askScope', 'askTiming'], ['initialProposal'],
  ['revisedProposal', 'changeReason'], ['transferQuestion', 'transferProposal', 'takeaway'], [],
]);
export const STEP_LABELS = ['시작', '먼저 묻기', '첫 제안', '조건이 바뀌면', '다른 고객에게', '함께 검토'];
export const FIELD_LIMIT = 4000;

export const CLIENT = Object.freeze({
  name: '공방 여백',
  request: '다음 토요일에 첫 원데이 클래스를 열어요. 소개 게시물 네 장과 예약 페이지를 만들어 주실 수 있나요?',
  facts: [['준비 기간', '7일'], ['처음 예산', '20만 원'], ['준비된 자료', '로고 · 사진 8장']],
  replies: [
    ['목적', '도예가 처음인 성인에게 첫 수업 예약을 받고 싶어요. 작품 사진만 보고 어려운 수업이라고 생각할까 봐 걱정돼요.'],
    ['결과물', '처음에는 게시물 네 장을 생각했지만, 초보자도 할 수 있다는 설명과 예약 방법이 먼저예요. 예약은 기존 신청 폼을 써도 괜찮아요.'],
    ['일정과 예산', '7일 안에 게시하고 싶어요. 예산은 20만 원이고, 사진과 문구 확인은 제가 할 수 있어요. 수정 확인은 평일 저녁에 가능해요.'],
  ],
  change: '예산을 12만 원으로 줄여야 할 것 같아요. 대신 수업 소개 영상도 하나 추가하고 싶고, 게시일은 그대로였으면 해요.',
  second: '저는 동네 책방을 운영해요. 두 달 뒤 정기 독서모임을 시작하는데, 아직 누구를 위한 모임인지 정하지 못했어요. 먼저 멋진 홍보 영상부터 만들까요?',
});

export function createState(now = new Date().toISOString()) {
  return { schemaVersion: SCHEMA_VERSION, scenarioId: SCENARIO_ID, createdAt: now, updatedAt: now,
    step: 0, furthestStep: 0, completed: false, fields: Object.fromEntries(Object.keys(FIELD_LABELS).map(k => [k, ''])), history: [] };
}

export function validateStep(state, step = state.step) {
  return (STEP_FIELDS[step] || []).filter(key => !state.fields[key].trim());
}

export function updateField(state, key, value, now = new Date().toISOString()) {
  if (!Object.hasOwn(FIELD_LABELS, key)) throw new Error('알 수 없는 입력 항목입니다.');
  if (typeof value !== 'string' || value.length > FIELD_LIMIT) throw new Error('입력은 항목마다 4,000자까지 보관할 수 있습니다.');
  const completed = key.startsWith('mentor') ? state.completed : false;
  return { ...state, fields: { ...state.fields, [key]: value }, completed, updatedAt: now };
}

export function advance(state, now = new Date().toISOString()) {
  const missing = validateStep(state);
  if (missing.length) return { state, missing };
  if (state.step >= 5) return { state, missing: [] };
  const fields = Object.fromEntries(STEP_FIELDS[state.step].map(key => [key, state.fields[key]]));
  const last = [...state.history].reverse().find(item => item.step === state.step);
  const changed = Object.keys(fields).length && (!last || JSON.stringify(last.fields) !== JSON.stringify(fields));
  const history = changed ? [...state.history, { step: state.step, recordedAt: now, fields }] : state.history;
  const step = state.step + 1;
  return { missing: [], state: { ...state, step, furthestStep: Math.max(state.furthestStep, step),
    completed: state.completed || step === 5, updatedAt: now, history } };
}

export function goToStep(state, step) {
  if (!Number.isInteger(step) || step < 0 || step > state.furthestStep) return state;
  if (step > state.step && STEP_FIELDS.slice(1, step).flat().some(key => !state.fields[key].trim())) return state;
  return { ...state, step };
}

export function parseState(text) {
  const parsed = JSON.parse(text);
  const source = parsed?.format === 'synk-rehearsal-export' ? parsed.record : parsed;
  if (!source || source.schemaVersion !== SCHEMA_VERSION || source.scenarioId !== SCENARIO_ID) throw new Error('이 리허설에서 만든 저장 파일이 아닙니다.');
  if (!Number.isInteger(source.step) || source.step < 0 || source.step > 5 || !Number.isInteger(source.furthestStep)
      || source.furthestStep < source.step || source.furthestStep > 5 || typeof source.completed !== 'boolean') throw new Error('진행 기록을 읽을 수 없습니다.');
  const dates = [source.createdAt, source.updatedAt];
  if (dates.some(value => typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new Error('기록 날짜를 읽을 수 없습니다.');
  if (!source.fields || typeof source.fields !== 'object') throw new Error('입력 기록이 없습니다.');
  const fields = {};
  for (const key of Object.keys(FIELD_LABELS)) {
    if (typeof source.fields[key] !== 'string' || source.fields[key].length > FIELD_LIMIT) throw new Error('입력 항목의 형식이 올바르지 않습니다.');
    fields[key] = source.fields[key];
  }
  if (!Array.isArray(source.history)) throw new Error('단계별 원본 기록을 읽을 수 없습니다.');
  const history = source.history.map(item => {
    if (!item || !Number.isInteger(item.step) || item.step < 1 || item.step > 4 || typeof item.recordedAt !== 'string' || !Number.isFinite(Date.parse(item.recordedAt)) || !item.fields) throw new Error('단계별 원본 기록의 형식이 올바르지 않습니다.');
    const recorded = {};
    for (const key of STEP_FIELDS[item.step]) {
      if (typeof item.fields[key] !== 'string' || item.fields[key].length > FIELD_LIMIT) throw new Error('단계별 원문을 읽을 수 없습니다.');
      recorded[key] = item.fields[key];
    }
    return { step: item.step, recordedAt: item.recordedAt, fields: recorded };
  });
  // A completed record must contain the actual learner answers, not just a status flag.
  if (source.completed && STEP_FIELDS.slice(1, 5).flat().some(k => !fields[k].trim())) throw new Error('마친 기록에 필요한 답이 비어 있습니다.');
  return { schemaVersion: SCHEMA_VERSION, scenarioId: SCENARIO_ID, createdAt: source.createdAt,
    updatedAt: source.updatedAt, step: source.step, furthestStep: source.furthestStep,
    completed: source.completed, fields, history };
}

export function makeExport(state, now = new Date().toISOString()) {
  return { format: 'synk-rehearsal-export', exportedAt: now,
    description: '가상 고객을 이용한 실전 리허설. 학습자의 입력 원문과 단계별 제출 기록이며 점수·자격·실제 고객 성과를 뜻하지 않습니다.',
    scenario: CLIENT, labels: FIELD_LABELS, record: state };
}

export function textExport(state) {
  const parts = ['SYNK SHIFT · 실전 리허설', '가상 의뢰 연습 · 자동 점수/인증 없음',
    `시작: ${state.createdAt}`, `최근 저장: ${state.updatedAt}`, `진행: ${STEP_LABELS[state.step]}`,
    '\n고객 의뢰', CLIENT.request, '\n고객의 예시 답장', ...CLIENT.replies.map(([key,value]) => `${key}: ${value}`),
    '\n변경 요청', CLIENT.change, '\n다른 고객', CLIENT.second, '\n현재 입력 원문'];
  for (const [key,label] of Object.entries(FIELD_LABELS)) parts.push(`\n[${label}]`, state.fields[key] || '(아직 작성하지 않음)');
  parts.push('\n단계별 제출 원본');
  state.history.forEach((item, i) => {
    parts.push(`\n${i+1}. ${STEP_LABELS[item.step]} · ${item.recordedAt}`);
    Object.entries(item.fields).forEach(([key,value]) => parts.push(`[${FIELD_LABELS[key]}]`, value));
  });
  return parts.join('\n');
}
