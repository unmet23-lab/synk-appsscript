// 측정 계약(설계 §5-2) — 지금 atlas/trail.js의 judge를 그대로 옮겼다.
// 「처음 본 계열 + 도움 없음 + 소리 전달 확인 + 제외 없음」인 첫 답만 독립 근거다.
// 달라진 것은 하나 — 판정 unknown(「모르겠어요」)도 correct · incorrect처럼 판정된 답이다(§3-2 「모르겠어요 = 놓침」).
//
//   attempt  { verdict, reason? }
//   p        { firstExposure: true | false | null, measure: { confounded, audioRequired } | null }
//   prior(kinds) — 같은 문항 · 계열에서 이 답보다 먼저 있었나. kinds ⊂ ['attempt', 'answer', 'help']
//                  (answer = 답을 봄, help = 힌트 · 해설 · 답 보기 모두)
//   audio    'pending' | 'completed' | 'failed' — 이 답 앞에 확인된 소리 전달
// 새 판의 접기는 이 판정을 계열의 만남 표(단계 2 src/fold — 첫 만남 · 도움 없음 · 판정됨)로 하고,
// test/record/judge.property.test.mjs가 두 판정이 같다는 것을 임의의 사건 열로 맞댄다.
import { JUDGED } from './events.mjs';

export function judge(attempt, p, prior, audio) {
  const assisted = prior(['help', 'answer']) ? true : p.firstExposure === true ? false : null;
  const exposure =
    prior(['attempt', 'answer']) || p.firstExposure === false
      ? 'repeat'
      : p.firstExposure === true
        ? 'new'
        : 'unknown';
  // 전달은 실제 관측이다 — play()를 부른 것으로 짐작하지 않는다. 답 뒤에 끝난 소리는 그 답을 되살리지 않는다.
  const usableDelivery = usable(p, audio);
  const exclusionReason =
    attempt.reason || (p.measure?.confounded ? 'visual' : !usableDelivery ? 'audio' : null);
  return {
    assisted,
    exposure,
    usableDelivery,
    exclusionReason,
    independent:
      !exclusionReason &&
      usableDelivery &&
      assisted === false &&
      exposure === 'new' &&
      JUDGED.includes(attempt.verdict),
  };
}

// 소리 전달 · 가림만 보는 부분 — 어댑터가 「판정할 수 있는 답인가」를 이것으로 가른다.
export const usable = (p, audio) =>
  !p.measure || (!p.measure.confounded && (!p.measure.audioRequired || audio === 'completed'));

// 판정할 수 있는 답인가(기억의 근거가 되는가) — 쓸 수 있는 전달 · 가림 없음 · 답 사유 없음 · 판정됨.
export const assessable = (attempt, p, audio) =>
  usable(p, audio) && !attempt.reason && !p.measure?.confounded && JUDGED.includes(attempt.verdict);
