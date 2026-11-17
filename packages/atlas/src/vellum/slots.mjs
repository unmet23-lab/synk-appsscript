// 설명(describe) 문장의 근거 칸 표(단계 4 계획 §21-23의 3 — 설계 주인 11-17 답 4). 코드마다 칸 이름 → 꼴을 이 한 곳에 둔다. 두뇌
// (select/plan.mjs)가 제품이 넘긴 칸을 이 표로 검사하고, Vellum(render)이 같은 표로 다시 본다. 제품은 표를 따로 들지 않는다.
//   { enum: [열쇠…] }      그 열쇠 가운데 하나(글자). 표 밖의 값은 받지 않는다.
//   { min, max? }          Number.isSafeInteger이고 min 이상(max가 있으면 max 이하). 글자로 넘긴 수는 받지 않는다.
// 칸이 하나라도 빠지거나 표에 없는 칸이 오면 받지 않는다. 칸이 없는 코드(빈 표)는 근거 없는 정상 경로의 문장이다 — 쓰기의 한 가지
// 고치기가 아직 없을 때와 말하기에서 이 기기에 안 해 본 유형이 없을 때(설계 검토 카본 B3 · 다시 검수 Opus 대체 FA3). 모든 언어 줄은 그
// 코드의 칸을 빠짐없이, 그 칸만 쓴다(시험이 세 언어 줄을 이 표와 맞댄다). 의존이 없는 잎 파일이다.

// TOPIK 말하기 시험의 여섯 유형 — 열쇠는 WORLD 말하기 항목(world-speaking-practice.mjs SPEAKING_SKILLS)의 능력 이름 끝 마디, 차례는 유형 번호(1 ~ 6).
export const SPEAKING_TYPES = Object.freeze([
  'answer',
  'roleplay',
  'narrate',
  'respond',
  'interpret',
  'opinion',
]);
// TOPIK 쓰기의 한 가지 고치기 — WORLD 쓰기 연습의 고칠 거리(world-writing-focus.mjs FOCUS_ID). 지금은 53번 글의 끝맺음 하나다.
export const WRITING_FOCUSES = Object.freeze(['ending-53']);
// 한 가지 고치기의 상태 — 다시 놓침(retry) · 도움을 받아 고침(assisted)(world-writing-focus.mjs focusNeed의 kind).
export const WRITING_NEEDS = Object.freeze(['retry', 'assisted']);

const oneOf = keys => Object.freeze({ enum: keys });
export const DESCRIBE_SLOTS = Object.freeze({
  'host.writing': Object.freeze({ focus: oneOf(WRITING_FOCUSES), need: oneOf(WRITING_NEEDS) }),
  'host.writing.start': Object.freeze({}),
  // 안 해 본 유형 수는 이번 주에 이 기기의 기록만 센 수다(이번 주 계획의 speakingNeeds와 같은 셈 — 문장도 「이번 주에 이 기기에서」로
  // 말한다). 유형의 수를 넘을 수 없다.
  'host.speaking': Object.freeze({
    type: oneOf(SPEAKING_TYPES),
    untried: Object.freeze({ min: 1, max: SPEAKING_TYPES.length }),
  }),
  'host.speaking.again': Object.freeze({}),
});

const isPlain = value =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const slotOk = (form, value) =>
  form.enum
    ? typeof value === 'string' && form.enum.includes(value)
    : Number.isSafeInteger(value) && value >= form.min && (form.max == null || value <= form.max);

// 그 코드의 칸을 표로 검사한다. 맞으면 표의 칸만 담은 새 객체(얼림), 틀리면 null. 표에 없는 코드는 null이다.
export function describeSlots(code, slots = {}) {
  const table =
    typeof code === 'string' && Object.hasOwn(DESCRIBE_SLOTS, code) ? DESCRIBE_SLOTS[code] : null;
  if (!table || !isPlain(slots)) return null;
  const names = Object.keys(table);
  if (Object.keys(slots).length !== names.length) return null;
  const out = {};
  for (const name of names) {
    if (!Object.hasOwn(slots, name) || !slotOk(table[name], slots[name])) return null;
    out[name] = slots[name];
  }
  return Object.freeze(out);
}
