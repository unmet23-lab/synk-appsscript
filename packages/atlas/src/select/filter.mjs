// 본인 설정이 후보를 먼저 거른다(설계 §3-5 끝 「본인 말이 먼저다」). 거른 문항은 「내지 않음」이 아니라 후보에서 빠질 뿐이다 —
// 고르기의 불변식은 남은 후보 위에서 선다.
//   audio: false   소리를 낼 수 없는 자리 — 소리가 있어야 하는 문항(audioRequired)을 뺀다
//   notNow         「지금은 아니에요」라고 한 것들(단위 · 계열 · 주제 열쇠) — 그것을 묻는 문항을 밀지 않는다
import { unitsOf } from '../fold/units.mjs';

export function filterCandidates(items, { audio = true, notNow = [] } = {}) {
  const muted = new Set(notNow);
  const asks = item =>
    muted.has(item.familyKey) ||
    (item.topic != null && muted.has(item.topic)) ||
    unitsOf(item).some(unit => muted.has(unit));
  return items.filter(item => !(audio === false && item.audioRequired) && !asks(item));
}
