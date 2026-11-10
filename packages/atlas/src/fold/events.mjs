// 접기 사건의 꼴(단계 2 · 3의 계약 — docs/_ops/qa/atlas-redesign-20261110/단계2_계획.md §2-2).
// 단계 3의 어댑터는 2판 사건(제시 · 전달 · 도움 · 답 · 제외 · 본인 말 · 옮겨 온 장부)과 옛 꼴 사건을 이 꼴로 바꾸고,
// 그 시험과 이 패키지의 임의 시험이 같은 검사기(checkFoldEvent)를 쓴다 — 꼴이 어긋나면 접기 전에 던진다.
//   답           { kind: 'answer', id, at, item, answer: { correct, assisted, answerShown, unknown, assessable, target } }
//   도움         { kind: 'help',   id, at, item } — 제시에 도움(힌트 · 해설 · 답 보기)이 하나라도 있으면 그 제시의 첫 도움 시각에
//                하나(답 없이 나간 제시도, 답한 뒤 해설을 본 제시도). 만남이고, 판정이 없어도 「이어서 혼자 맞힌 수」를 끊는다
//                (server.mjs skillRowsOf — grade null · unaided false 줄). 단계 3 어댑터가 이렇게 낸다(단계3_계획.md §11).
//   본인 말      { kind: 'say',    id, at, unit, say: 'known' | 'relearn' }
//   제외         { kind: 'exclude', id, at, ref, touches? }      touches = { units, skills }
//   옮겨 온 장부 { kind: 'carry',  id, at, families, after? }
//   item = { itemKey, familyKey, skillId, difficulty, responseFormat, units?, unknownOption? }
// id는 같은 시각의 차례를 가르는 열쇠다 — 한 열의 id는 모두 글자이거나 모두 수다(fold/order.mjs).
// 요약의 met(계열 → 첫 만남 시각)에서 처음 옮긴 장부의 계열은 −∞다(어떤 만남보다 먼저). JSON · 서버 표에는 −∞가 없으므로 null로 두고,
// 받는 쪽은 null을 −∞로 읽는다 — 기기의 얹기(device.mjs meet)는 null과 −∞를 같게 다룬다(Fable 끝 판 P3-1, 시험 stage2 ⑳).
export const FOLD_KINDS = Object.freeze(['answer', 'help', 'say', 'exclude', 'carry']);
const SAYS = Object.freeze(['known', 'relearn']);
const FORMATS = Object.freeze([
  'binary-choice',
  'single-choice',
  'cup-compose',
  'action',
  'spoken',
  'unknown',
]);

const text = value => typeof value === 'string' && value.length > 0;
const key = value => text(value) || Number.isFinite(value);
const texts = value => Array.isArray(value) && value.every(text);
const optionalBool = value => value == null || typeof value === 'boolean';

function itemOk(item) {
  if (!item || !text(item.itemKey) || !text(item.familyKey) || !text(item.skillId)) return false;
  if (![1, 2, 3].includes(item.difficulty) || !FORMATS.includes(item.responseFormat)) return false;
  return (item.units == null || texts(item.units)) && optionalBool(item.unknownOption);
}

function answerOk(answer) {
  if (!answer || ![true, false, null].includes(answer.correct ?? null)) return false;
  const flags = [answer.assisted, answer.answerShown, answer.unknown, answer.assessable];
  return flags.every(optionalBool) && (answer.target == null || text(answer.target));
}

const CHECKS = {
  answer: event => itemOk(event.item) && answerOk(event.answer),
  help: event => itemOk(event.item),
  say: event => text(event.unit) && SAYS.includes(event.say),
  exclude: event =>
    key(event.ref) &&
    (event.touches == null || (texts(event.touches.units) && texts(event.touches.skills))),
  carry: event => texts(event.families) && (event.after == null || Number.isFinite(event.after)),
};

// 접기 사건 하나를 본다. 맞으면 그대로 돌려주고, 아니면 TypeError.
export function checkFoldEvent(event) {
  const ok =
    event &&
    FOLD_KINDS.includes(event.kind) &&
    key(event.id) &&
    Number.isFinite(event.at) &&
    CHECKS[event.kind](event);
  if (!ok)
    throw new TypeError(`Atlas: 접기 사건의 꼴이 아니다 — ${JSON.stringify(event)?.slice(0, 200)}`);
  return event;
}
