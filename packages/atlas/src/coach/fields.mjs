// 제시 사건의 엔진 칸(단계 4 계획 §3-5 · §3-6). 고르기가 낸 줄에서 2판 practice.presented의 칸을 채운다.
//   editions  매개변수 판(PARAMS.editions) + 문항 색인 판(map.editions.index)
//   expected  예상 성공 확률의 세 항(찍기 바닥 · 기억 · 능력)
//   arm       회차 — adaptive(엔진이 고름) · filler(채우기) · host(제품이 순서를 정한 문항, §3-6)
//   reason    { code, slots, evidence, target(겨눈 단위), tier(층), introduced(이 제시로 처음 낸 단위들 — 두뇌의 brandNew) }
// 제품이 순서를 정한 문항(시험 형식 · 진단 · 레슨 안 문항)은 그 문항 하나로 고른 줄을 쓰되, 층이 9(내지 않음)면 두뇌가 겨눈 단위를
// 내지 않으므로 같은 차례(다시 낼 차례 → 돌아온 단위 → 기억 없는 단위 → 주 단위)로 채운다 — 두뇌 aimOf의 정의를 옮긴 것이고,
// test/coach가 층 0~2인 문항에서 choose의 값과 같은지 견준다.
import { unitsOf } from '../fold/units.mjs';
import { PARAMS } from '../params.mjs';

export const HOST_ARM = 'host';
export const HOST_ORDER = 'host.order';

// 두뇌 choose의 「돌아온 단위」 — 이 판에서 만나지 않았고 돌아올 때가 됐다. 밀린 것이 많으면 살릴 수 있는 것부터.
function dueOf(units, learner, memory, now, params) {
  const met = learner.session?.met ?? new Set();
  const dueNow = unit => !met.has(unit) && memory.isDue(learner.memory.get(unit), now);
  let backlog = 0;
  for (const unit of learner.memory.keys()) if (dueNow(unit)) backlog += 1;
  const rescue = backlog > params.backlog;
  return units
    .filter(unit => memory.has(learner.memory.get(unit)) && dueNow(unit))
    .map(unit => [unit, memory.retrievability(learner.memory.get(unit), now)])
    .sort((a, b) => (rescue ? b[1] - a[1] : a[1] - b[1]))
    .map(([unit]) => unit);
}

// 겨눌 단위(두뇌 aimOf와 같은 차례). 채우기 문항(겨눌 것이 없다)이면 주 단위다 — 놓치면 주 단위에 적힌다(creditedOf).
export function aimedUnit(item, learner, memory, now, params = PARAMS) {
  const units = unitsOf(item);
  const retries = learner.session?.retries ?? new Map();
  const again = units
    .filter(unit => retries.get(unit)?.pending)
    .sort((a, b) => retries.get(a).position - retries.get(b).position);
  const gap = unit => learner.shown.length - retries.get(unit).position;
  const waiting = again.find(unit => gap(unit) < params.retryGap);
  const ready = again.find(unit => gap(unit) >= params.retryGap);
  if (waiting ?? ready) return waiting ?? ready;
  const due = dueOf(units, learner, memory, now, params);
  if (due.length) return due[0];
  const unseen = units.find(unit => !memory.has(learner.memory.get(unit)));
  return unseen ?? units[0];
}

// 제품이 순서를 정한 문항의 줄 — 그 문항 하나로 고른 줄에 회차 host · 이유 host.order를 얹고, 층 9면 겨눈 단위를 채운다.
export function hostRow(row, learner, memory, now, params = PARAMS) {
  const target = row.target ?? aimedUnit(row.item, learner, memory, now, params);
  return {
    ...row,
    target,
    arm: HOST_ARM,
    why: { code: HOST_ORDER, slots: {}, evidence: { tier: row.tier } },
  };
}

// 제품 문항의 영역(사건의 modality 칸) — 제품이 주면 그 값, 아니면 능력 id의 둘째 마디(ko.listening.detail → listening).
const modalityOf = (product, item) => product.modality ?? item.skillId.split('.')[1] ?? 'unknown';

// 고른 줄 → 2판 제시 사건 칸(createEvent에 그대로 넘긴다).
export function presentedFields({ row, product = {}, setId, editions, firstExposure }) {
  const item = row.item;
  return {
    setId,
    itemKey: item.itemKey,
    familyKey: item.familyKey,
    skillId: item.skillId,
    difficulty: item.difficulty,
    responseFormat: item.responseFormat,
    modality: modalityOf(product, item),
    audioRequired: Boolean(item.audioRequired ?? product.audioRequired),
    confounded: product.confounded === true,
    units: [...unitsOf(item)],
    firstExposure,
    editions: { ...editions },
    expected: { ...row.expected },
    arm: row.arm,
    reason: {
      code: row.why.code,
      slots: { ...row.why.slots },
      evidence: { ...row.why.evidence },
      target: row.target ?? null,
      tier: row.tier,
      introduced: [...row.brandNew],
    },
    ...(item.unknownOption ? { unknownOption: true } : {}),
  };
}
