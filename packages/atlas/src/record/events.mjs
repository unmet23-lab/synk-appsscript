// 사건 2판(설계 §5-1 · 단계 3 계획 §2). 단계 2(제시 사건의 엔진 칸)와 단계 3(기록 · 서버 접기)이 같은 이름을 쓰도록 한 곳에 둔다.
// 서버(SYNK-talk의 engine.synk_learning_events)와 맞대 확정한 이름이다 — 꼴 번호는 지금 사건의 schema 칸(옛 꼴 1 · 새 꼴 2),
// 만든 때의 동의 판 번호는 revision(서버 · 요청 · 표의 열 이름이 모두 revision이다).
//
// 지키는 것(지금 계약 그대로): 사건 꼴의 뼈대(제시 → 소리 전달 → 도움 → 답), 제외와 철회, 답 글과 신원을 싣지 않는 규칙.
// 응답 시간 · 글 · 음성은 넣지 않는다(§14-1). 학습자에게서 새로 받는 것은 본인 말 둘과 「모르겠어요」뿐이다.
// 2판에는 scope · recordedAt이 없다 — 새 길은 계정의 학습 기록 하나뿐이고 기기 시각은 at 하나로 단조다.

// 사건의 schema 칸. 서버와 기기가 옛 꼴(1)과 새 꼴(2)을 갈라 읽는다(§5-6).
export const EVENT_FORM = Object.freeze({ legacy: 1, current: 2 });

export const EVENT_TYPES = Object.freeze({
  presented: 'practice.presented',
  delivery: 'practice.delivery',
  helped: 'practice.helped',
  attempted: 'practice.attempted',
  excluded: 'record.excluded',
  // 새 사건 둘
  stated: 'unit.stated',
  carried: 'record.carried',
  // 연습 한 판 단위로만 남는다 — 문항마다 붙던 decision.made · experience.completed는 없앤다
  setDecided: 'decision.made',
  setCompleted: 'experience.completed',
  feedback: 'feedback.given',
});

// 2판 사건이면 모두 싣는 칸.
export const COMMON_FIELDS_V2 = Object.freeze(['schema', 'id', 'type', 'at', 'revision']);

// 제시 사건에 더하는 칸(엔진이 낸 값이다). 나머지 칸은 문항 색인과 같은 이름이다(단계 2 계획 §2-1).
export const PRESENTED_FIELDS_V2 = Object.freeze({
  // 판 이름 — 매개변수 · 기억 · 난도 · 고르기 · 문항 색인
  editions: Object.freeze(['params', 'memory', 'ability', 'select', 'index']),
  // 예상 성공 확률 — 찍기 바닥 · 기억 항 · 능력 항을 따로(§3-4)
  expected: Object.freeze(['floor', 'memory', 'skill']),
  // 회차 구분 — 맞춤 / 기본 / 채우기
  // host — 제품이 순서를 정한 제시(시험 형식 · 진단 · 레슨 안 문항, reason.code 'host.order'). 단계 5 판 비교에서 adaptive와 가른다(단계 4 요청 11-11).
  arm: Object.freeze(['adaptive', 'baseline', 'filler', 'host']),
  // 보여 준 이유 — 종류와 근거 칸, 겨눈 단위 · 층 · 이 제시로 처음 낸 단위들(실패를 적을 단위와 하루 한도를 사건만 보고 안다)
  reason: Object.freeze(['code', 'slots', 'evidence', 'target', 'tier', 'introduced']),
  // 연습 한 판 번호
  set: Object.freeze(['setId']),
});

// 답 사건의 판정 — 「모르겠어요」(제품이 그 선택지를 둔 고르는 꼴 문항에서만)가 하나 더 있다. 놓침으로 친다(§3-2).
export const ATTEMPT_UNKNOWN = 'unknown';
export const VERDICTS = Object.freeze([
  'correct',
  'incorrect',
  ATTEMPT_UNKNOWN,
  'unassessed',
  'skipped',
]);
export const JUDGED = Object.freeze(['correct', 'incorrect', ATTEMPT_UNKNOWN]);
// 답을 판정하지 못한 까닭(지금 계약 그대로 — storage는 저장 실패).
export const ATTEMPT_REASONS = Object.freeze([
  'motor',
  'audio',
  'unanswered',
  'demo',
  'visual',
  'storage',
]);
export const HELP_LEVELS = Object.freeze(['cue', 'explanation', 'answer']);
export const AUDIO = Object.freeze(['pending', 'completed', 'failed']);
export const RESPONSE_FORMATS = Object.freeze([
  'binary-choice',
  'single-choice',
  'cup-compose',
  'action',
  'spoken',
  'unknown',
]);
export const FEEDBACK_VALUES = Object.freeze(['helpful', 'too_much', 'want_more', 'not_fit']);

// 본인이 직접 누른 말 — 「이미 알아요」 · 「다시 배울래요」. 다른 사건처럼 record.excluded로 거둘 수 있다.
export const STATED_SAYS = Object.freeze(['known', 'relearn']);

// 옮겨 온 장부 — 이번에 새로 든 계열 · 문항의 만난 표(세 비트) · 앞 장부를 뜬 때(처음이면 null) · 칸 요약(처음 옮길 때만).
export const CARRIED_FIELDS = Object.freeze(['families', 'items', 'after', 'cells']);
// 만난 표의 세 비트(지금 trail.js BITS 그대로) — 답함 · 답을 봄 · 도움 받음.
export const BITS = Object.freeze({ attempt: 1, answer: 2, help: 4 });

const ID = /^[a-zA-Z0-9_.:-]{1,120}$/;
const TAG = /^[a-z0-9]{8}$/;
const MODALITY = /^[a-z][a-z0-9_-]{0,40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_UNITS = 32;
const MAX_KEYS = 4096;
const MAX_REASON_BYTES = 2048;

export const isId = value => typeof value === 'string' && ID.test(value);
const isKey = value => isId(value) && !BAD_KEYS.has(value);
const isTime = value =>
  typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value));
const isBool = value => typeof value === 'boolean';
const isUnit = value => typeof value === 'number' && value >= 0 && value <= 1;
const isPlain = value =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
const uniqueIds = (list, max) =>
  Array.isArray(list) &&
  list.length <= max &&
  list.every(isKey) &&
  new Set(list).size === list.length;

function fail(message, event) {
  const shown = JSON.stringify(event)?.slice(0, 160);
  throw new TypeError(`Atlas record: ${message} — ${shown}`);
}

// 사건 번호 — 만든 차례대로 커진다: a.<만든 시각 13자리>.<기기 안 순번 4자리>.<기기 꼬리 8자>(설계 §5-3 「시각과 차례」).
export function eventId(atMs, seq, tag) {
  if (!Number.isSafeInteger(atMs) || atMs < 0 || atMs > 9_999_999_999_999)
    throw new RangeError('Atlas record: 사건 번호의 시각이 범위 밖이다');
  if (!Number.isSafeInteger(seq) || seq < 0 || seq > 9999)
    throw new RangeError('Atlas record: 사건 번호의 순번이 범위 밖이다');
  if (!TAG.test(tag)) throw new TypeError('Atlas record: 기기 꼬리는 소문자 · 숫자 8자다');
  return `a.${String(atMs).padStart(13, '0')}.${String(seq).padStart(4, '0')}.${tag}`;
}

// 엔진이 낸 칸 — 값의 꼴만 본다(이유의 종류 표는 단계 2 reason이 정한다). 이유는 작은 JSON이어야 한다.
function reasonOk(reason) {
  if (!isPlain(reason) || !isId(reason.code)) return false;
  if (!isPlain(reason.slots) || !isPlain(reason.evidence)) return false;
  if (!(reason.target == null || isKey(reason.target))) return false;
  if (!(reason.tier == null || Number.isInteger(reason.tier))) return false;
  if (!uniqueIds(reason.introduced, MAX_UNITS)) return false;
  return JSON.stringify(reason).length <= MAX_REASON_BYTES;
}

const editionsOk = editions =>
  isPlain(editions) && PRESENTED_FIELDS_V2.editions.every(key => isId(editions[key]));
const expectedOk = expected =>
  isPlain(expected) && PRESENTED_FIELDS_V2.expected.every(key => isUnit(expected[key]));

function itemOk(event) {
  if (![event.setId, event.itemKey, event.familyKey, event.skillId].every(isKey)) return false;
  if (![1, 2, 3].includes(event.difficulty) || !RESPONSE_FORMATS.includes(event.responseFormat))
    return false;
  if (typeof event.modality !== 'string' || !MODALITY.test(event.modality)) return false;
  if (!isBool(event.audioRequired) || !isBool(event.confounded)) return false;
  if (!uniqueIds(event.units, MAX_UNITS)) return false;
  return [true, false, null].includes(event.firstExposure);
}

const presentedOk = event =>
  itemOk(event) &&
  editionsOk(event.editions) &&
  expectedOk(event.expected) &&
  PRESENTED_FIELDS_V2.arm.includes(event.arm) &&
  reasonOk(event.reason) &&
  (event.unknownOption === undefined || isBool(event.unknownOption));

function bitsOk(table) {
  if (!isPlain(table)) return false;
  const keys = Object.keys(table);
  return (
    keys.length <= MAX_KEYS &&
    keys.every(
      key => isKey(key) && Number.isInteger(table[key]) && table[key] >= 1 && table[key] <= 7,
    )
  );
}

const cellOk = cell =>
  isPlain(cell) &&
  isKey(cell.skillId) &&
  [1, 2, 3].includes(cell.difficulty) &&
  ['independent', 'correct', 'helped'].every(
    key => Number.isSafeInteger(cell[key]) && cell[key] >= 0,
  ) &&
  (cell.lastAt == null || isTime(cell.lastAt));

const carriedOk = event =>
  bitsOk(event.families) &&
  bitsOk(event.items) &&
  (event.after === null || isTime(event.after)) &&
  (event.cells === undefined ||
    (Array.isArray(event.cells) && event.cells.length <= MAX_KEYS && event.cells.every(cellOk)));

// 사건 종류마다 [꼭 있는 칸, 있어도 되는 칸, 값 검사].
const SHAPES = {
  [EVENT_TYPES.presented]: [
    [
      'setId',
      'itemKey',
      'familyKey',
      'skillId',
      'difficulty',
      'responseFormat',
      'modality',
      'audioRequired',
      'confounded',
      'units',
      'firstExposure',
      'editions',
      'expected',
      'arm',
      'reason',
    ],
    ['unknownOption'],
    presentedOk,
  ],
  [EVENT_TYPES.delivery]: [
    ['presentationId', 'audio'],
    [],
    event => isId(event.presentationId) && AUDIO.includes(event.audio),
  ],
  [EVENT_TYPES.helped]: [
    ['presentationId', 'helpId', 'level', 'contentRef'],
    [],
    event =>
      [event.presentationId, event.helpId, event.contentRef].every(isId) &&
      HELP_LEVELS.includes(event.level),
  ],
  [EVENT_TYPES.attempted]: [
    ['presentationId', 'attemptNo', 'verdict', 'errorTags'],
    ['reason', 'choice'],
    attemptOk,
  ],
  [EVENT_TYPES.excluded]: [['targetId'], [], event => isId(event.targetId)],
  [EVENT_TYPES.stated]: [
    ['unit', 'say'],
    [],
    event => isKey(event.unit) && STATED_SAYS.includes(event.say),
  ],
  [EVENT_TYPES.carried]: [['families', 'items', 'after'], ['cells'], carriedOk],
  // 판 단위 사건은 그 판의 번호(setId — 제시의 setId와 같은 값)를 실을 수 있다: 단계 5 판 비교가 끝까지 함 · 판 끝 응답을 그 판의
  // 제시들과 잇는다(단계 4 Fable 설계 검토 P2-1 라, 11-11).
  [EVENT_TYPES.setDecided]: [
    ['experienceId', 'variant'],
    ['setId'],
    event =>
      isId(event.experienceId) &&
      isId(event.variant) &&
      (event.setId === undefined || isId(event.setId)),
  ],
  [EVENT_TYPES.setCompleted]: [
    ['decisionId', 'experienceId', 'variant'],
    ['setId'],
    event =>
      [event.decisionId, event.experienceId, event.variant].every(isId) &&
      (event.setId === undefined || isId(event.setId)),
  ],
  [EVENT_TYPES.feedback]: [
    ['completionId', 'value'],
    ['decisionId'],
    event =>
      isId(event.completionId) &&
      FEEDBACK_VALUES.includes(event.value) &&
      (event.decisionId === undefined || isId(event.decisionId)),
  ],
};

const tag = value =>
  typeof value === 'string' &&
  value.trim() === value &&
  value.length > 0 &&
  value.length <= 120 &&
  !/[\r\n]/.test(value);
const optionId = value =>
  typeof value === 'string' &&
  /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value) &&
  !BAD_KEYS.has(value);
const choiceOk = choice =>
  isPlain(choice) &&
  Object.keys(choice).length === 2 &&
  optionId(choice.selectedId) &&
  optionId(choice.correctId);

function attemptOk(event) {
  if (!isId(event.presentationId) || !Number.isInteger(event.attemptNo) || event.attemptNo < 1)
    return false;
  if (!VERDICTS.includes(event.verdict)) return false;
  if (!Array.isArray(event.errorTags) || event.errorTags.length > 24 || !event.errorTags.every(tag))
    return false;
  if (new Set(event.errorTags).size !== event.errorTags.length) return false;
  if (event.reason !== undefined && !ATTEMPT_REASONS.includes(event.reason)) return false;
  return event.choice === undefined || choiceOk(event.choice);
}

function fieldsOk(event, required, optional) {
  const allowed = new Set([...COMMON_FIELDS_V2, ...required, ...optional]);
  return (
    Object.keys(event).every(key => allowed.has(key)) &&
    [...COMMON_FIELDS_V2, ...required].every(key => Object.hasOwn(event, key))
  );
}

// 2판 사건 하나의 꼴을 본다(부모가 있는지는 checkLinks). 맞으면 그대로 돌려주고, 아니면 TypeError.
export function checkEvent(event) {
  if (!isPlain(event) || event.schema !== EVENT_FORM.current || !isId(event.id))
    fail('2판 사건이 아니다', event);
  const shape = SHAPES[event.type];
  if (!shape) fail('모르는 사건 종류다', event);
  if (!isTime(event.at)) fail('시각(at)이 ISO 밀리초가 아니다', event);
  // 손님(동의 판 없음)은 0 — 계정으로 옮길 때 그 계정의 지금 판으로 도장을 찍는다(서버는 지금 판과 같은 것만 받는다).
  if (!Number.isSafeInteger(event.revision) || event.revision < 0)
    fail('동의 판 번호(revision)가 없다', event);
  const [required, optional, valuesOk] = shape;
  if (!fieldsOk(event, required, optional)) fail('칸이 모자라거나 남는다', event);
  if (!valuesOk(event)) fail('칸의 값이 꼴에 맞지 않는다', event);
  return event;
}

// 2판 사건을 만든다. at은 기기의 단조 시계가 낸 밀리초, id는 eventId로 만든 번호다.
export function createEvent(type, fields, { id, atMs, revision }) {
  const event = {
    schema: EVENT_FORM.current,
    id,
    type,
    at: new Date(atMs).toISOString(),
    revision,
    ...fields,
  };
  return checkEvent(JSON.parse(JSON.stringify(event)));
}

// 부모를 가리키는 칸 — 서버와 기기가 같은 「묶음」을 짓는 데 쓴다.
// 응답(feedback.given)의 부모는 마침(completionId)이다 — 결정(decisionId)을 함께 실어도 그것은 부모가 아니다(아르곤 끝 판 C1).
export const parentOf = event =>
  event.type === EVENT_TYPES.feedback
    ? (event.completionId ?? null)
    : (event.presentationId ?? event.targetId ?? event.decisionId ?? event.completionId ?? null);

const PARENT_TYPES = {
  [EVENT_TYPES.delivery]: [EVENT_TYPES.presented],
  [EVENT_TYPES.helped]: [EVENT_TYPES.presented],
  [EVENT_TYPES.attempted]: [EVENT_TYPES.presented],
  [EVENT_TYPES.setCompleted]: [EVENT_TYPES.setDecided],
  [EVENT_TYPES.feedback]: [EVENT_TYPES.setCompleted],
};

function linkOk(event, find, attempts) {
  if (event.type === EVENT_TYPES.excluded) {
    const target = find(event.targetId);
    return Boolean(target) && target.type !== EVENT_TYPES.excluded;
  }
  const wanted = PARENT_TYPES[event.type];
  if (!wanted) return true;
  const parent = find(parentOf(event));
  if (!parent || parent.schema !== EVENT_FORM.current || !wanted.includes(parent.type))
    return false;
  if (Date.parse(parent.at) > Date.parse(event.at)) return false;
  // 응답이 결정도 실었다면 그 마침의 결정과 같아야 한다.
  if (event.type === EVENT_TYPES.feedback && event.decisionId !== undefined)
    return event.decisionId === parent.decisionId;
  if (event.type !== EVENT_TYPES.attempted) return true;
  const count = attempts.get(event.presentationId) ?? 0;
  attempts.set(event.presentationId, count + 1);
  return event.attemptNo === count + 1;
}

// 2판 사건 묶음의 부모를 본다(설계 §5-3 「받을 때 같은 Trail 코드로 검증」). 묶음은 보낸 차례(만든 차례)대로 본다.
//   find(id) = 이미 저장된 사건(옛 꼴 · 2판 모두)에서 찾는다. attemptCount(presentationId) = 저장된 그 제시의 답 수.
// 2판의 부모는 2판이다(제외만 옛 꼴 사건도 겨눌 수 있다 — 옛 기록의 답을 거두는 길).
export function checkLinks(events, { find, attemptCount = () => 0 }) {
  const batch = new Map();
  const attempts = new Map();
  const lookup = id => batch.get(id) ?? find(id);
  for (const event of events) {
    checkEvent(event);
    // 같은 번호는 한 묶음에 한 번 — 묶음 안의 뒤 사건이 앞 사건을 가리지 못한다(아르곤 끝 판 C3). 이미 저장된 번호와의 충돌은
    // 받는 쪽(서버)이 저장된 사건과 맞대어 먼저 거른다(같으면 다시 받지 않고, 다르면 409).
    if (batch.has(event.id)) fail('같은 번호의 사건이 한 묶음에 둘이다', event);
    if (event.type === EVENT_TYPES.attempted && !attempts.has(event.presentationId))
      attempts.set(event.presentationId, attemptCount(event.presentationId));
    if (!linkOk(event, lookup, attempts)) fail('부모가 없거나 차례가 맞지 않는다', event);
    batch.set(event.id, event);
  }
  return events;
}
