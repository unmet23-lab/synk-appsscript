// 예상 성공 확률(설계 §3-4) = 찍기 바닥 + (1 − 찍기 바닥) × 기억 항 × 능력 항.
//   찍기 바닥: 응답 꼴마다(둘 중 0.5 · 넷 중 0.25 · 조립 · 말하기는 거의 0). 「모르겠어요」가 있는 문항은 찍는 답이 줄어 절반(출발값).
//   기억 항: 문항이 묻는 단위 가운데 기억이 있는 것들의 떠올릴 확률의 곱.
//   능력 항: 처음 보는 계열이거나 처음 만나는 단위가 든 문항이면 능력 대 난도, 다 만나 본 문항을 다시 만나면 1(기억이 결과를 정한다).
// 세 항을 따로 돌려준다 — 제시 사건의 expected 칸(§5-1)과 두 대조표(§6)가 따로 읽는다.
//
// 자리 잡기(§3-3): 처음 온 사람의 능력 값은 본인이 고른 연습 수준의 윗 끝 난도에서 출발한 것처럼 본다 — θ_eff = θ + θ₀ / (1 + 답 수).
// θ₀는 고르기의 선행값일 뿐 접기의 출발 상태가 아니다(서버는 수준을 모르고 θ = 0에서 접는다). 답이 쌓이면 사라진다.
import { abilityTerm, floorOf } from '../ability/index.mjs';
import { unitsOf } from '../fold/units.mjs';
import { PARAMS } from '../params.mjs';

export const effectiveTheta = (ability, prior = 0) =>
  (ability?.theta ?? 0) + prior / (1 + (ability?.n ?? 0));

export function predictParts(item, learner, memory, now, params = PARAMS) {
  const floor = floorOf(item.responseFormat, item.unknownOption, params);
  let recall = 1;
  let missing = false;
  for (const unit of unitsOf(item)) {
    const r = memory.retrievability(learner.memory.get(unit), now);
    if (r == null) missing = true;
    else recall *= r;
  }
  const theta = effectiveTheta(learner.ability.get(item.skillId), learner.session?.prior ?? 0);
  const fresh = missing || !learner.met.has(item.familyKey);
  const skill = fresh ? abilityTerm(theta, item.difficulty, params) : 1;
  return { floor, memory: recall, skill, p: floor + (1 - floor) * recall * skill };
}

export const predict = (item, learner, memory, now, params = PARAMS) =>
  predictParts(item, learner, memory, now, params).p;
