/** 가상 학습자 셋의 수준 사다리 — 찻집 골목 세로 조각 설계 §15-1 끝, 학습 개인화 다리 설계 §3-3·§9.
 *
 * 같은 30일 × 마을 씨앗의 「매일 와서 다 받는」 방문(tools/town-sim.mjs의 sceneVisits)마다 만나는 장면을 사다리 엔진
 * (town/language-ladder.mjs)과 대화 장면(dialogue.mjs)으로 그대로 돈다. 학습자의 행동만 여기서 정한다 — 다리 §9의 처음 값:
 * 판 L의 한 줄에서 「무슨 뜻이에요?」는 L − r ≤ 0이면 3%, 0~1이면 25%, 1 넘으면 60%(자주 막히는 사람은 두 배), 같은 줄의 「다시」는
 * 그 절반(두 번까지), 「그만할래요」는 장면마다 2%, 넓히기 제안은 (L+1) − r ≤ 0이면 80%, 0~1이면 40%, 1 넘으면 10%로 받는다.
 * 자리는 읽기 하나, 배치 없이 L1에서 시작하고(학습 기록이 다 읽히지 않은 사람 — 다리 §4-3), 넓히기는 타운 근거(다섯 장면)로만 선다.
 * 시각은 숫자로만 다룬다.
 */
import { createRng } from '../experiences/synk-town/town/rng.mjs';
import { LEVELS, initialLadder, pickSceneLevel, closeScene, markOffer, answerOffer } from '../experiences/synk-town/town/language-ladder.mjs';
import { initialAsks, mayAsk, recordAsk } from '../experiences/synk-town/town/prefs.mjs';
import { paramsFor } from '../experiences/synk-town/town/params.mjs';
import { openDialogue, helpDialogue, dialogueLevel, dialogueOutcome } from '../experiences/synk-town/dialogue.mjs';

const MINUTE = 60_000;
/** 다리 §9의 세 사람. meaning은 「무슨 뜻이에요?」 확률의 배수다. */
export const LEARNERS = Object.freeze([
  { id: 'just-past-1', label: '1급을 막 넘은 사람(r 1.2)', r: 1.2, meaning: 1 },
  { id: 'grade-3', label: '3급(r 3)', r: 3, meaning: 1 },
  { id: 'often-stuck', label: '자주 막히는 사람(r 1, 되묻기 두 배)', r: 1, meaning: 2 },
].map(learner => Object.freeze(learner)));
const meaningShare = (level, r) => (level - r <= 0 ? 0.03 : level - r <= 1 ? 0.25 : 0.6);
const acceptShare = (level, r) => (level + 1 - r <= 0 ? 0.8 : level + 1 - r <= 1 ? 0.4 : 0.1);
const STOP_SHARE = 0.02;
const L = level => LEVELS.indexOf(level) + 1;
/** A visit's scenes (bridge §3-3 읽기 자리): C4's talk when the player took it (offer, taste and the answer to it — the
 * single-choice board), then a tea order while the cafe owner is up (two guests' requests, answered by a cup — cup-compose). */
export const SCENES = Object.freeze({
  c4: Object.freeze({ lines: ['offer', 'taste', 'answer'], responseFormat: 'single-choice' }),
  tea: Object.freeze({ lines: ['a', 'b'], responseFormat: 'cup-compose' }),
});

/** One learner's thirty life days in one village. visits: [fromMs, lifeDayIndex, teaOpen 0|1, tookC4 0|1]. */
export function learnerLife(learner, villageSeed, visits, params = paramsFor()) {
  const rng = createRng('town-sim', 'learner', learner.id, villageSeed), chance = share => rng.below(1_000_000) < Math.round(share * 1_000_000);
  const near = level => Math.abs(L(level) - learner.r) <= 0.5;
  let ladder = initialLadder({}, visits[0]?.[0] ?? 0), asks = initialAsks();
  const out = { scenes: 0, reachedAt: near(ladder.reading.stable) ? 0 : null, nearScenes: 0, above: 0, offers: 0, accepted: 0, declined: 0,
    fallbacks: 0, eased: 0, stopped: 0, drops: 0, acceptedThenDropped: 0, levels: {} };
  let sinceAccept = null;
  for (const [fromMs, day, tea, c4] of visits) {
    let t = fromMs + 2 * MINUTE;
    for (const kind of [...(c4 ? ['c4'] : []), ...(tea ? ['tea'] : [])]) {
      const scene = SCENES[kind], board = { versions: LEVELS, responseFormat: scene.responseFormat };
      const pick = pickSceneLevel({ channel: 'reading', ladder, summary: null, settings: {}, today: {}, scene: board, now: t, day });
      if (pick.why === 'authored-fallback') out.fallbacks++;
      let d = openDialogue({ id: `${kind}:${day}`, level: pick.level, responseFormat: scene.responseFormat });
      out.scenes++; out.levels[d.level] = (out.levels[d.level] || 0) + 1;
      if (L(d.level) > learner.r + 1) out.above++;
      if (near(d.level)) out.nearScenes++;
      const stopAt = chance(STOP_SHARE) ? rng.below(scene.lines.length) : -1;
      for (const [i, turn] of scene.lines.entries()) {
        if (i === stopAt) { d = helpDialogue(d, turn, 'stop'); break; }
        const p = Math.min(1, meaningShare(L(dialogueLevel(d, turn)), learner.r) * learner.meaning);
        if (chance(p)) d = helpDialogue(d, turn, 'meaning');
        for (let k = 0; k < 2 && chance(p / 2); k++) d = helpDialogue(d, turn, 'repeat');
      }
      const outcome = dialogueOutcome(d), before = ladder.reading.stable;
      if (outcome === 'eased') out.eased++;
      if (outcome === 'stopped') out.stopped++;
      ladder = closeScene({ ladder, channel: 'reading', level: d.level, outcome, now: t });
      if (L(ladder.reading.stable) < L(before)) {
        out.drops++;
        if (sinceAccept !== null && sinceAccept < 3) out.acceptedThenDropped++;
        sinceAccept = null;
      } else if (sinceAccept !== null) sinceAccept = sinceAccept + 1 >= 3 ? null : sinceAccept + 1;
      // The widening question as the scene ends (core offerWiden): the day's one mascot question, not the same one too soon.
      t += 5 * MINUTE;
      const choice = pickSceneLevel({ channel: 'reading', ladder, summary: null, settings: {}, today: {}, scene: board, now: t, day });
      const key = choice.offer ? `widen:reading:${choice.offer.to}` : null;
      if (key && mayAsk(asks, { lifeDay: day, key, secondsIntoVisit: (t - fromMs) / 1000 }, params)) {
        ladder = markOffer(ladder, 'reading', t, ladder.reading.evidence || 0, day);
        asks = recordAsk(asks, { lifeDay: day, key });
        out.offers++;
        const yes = chance(acceptShare(L(ladder.reading.stable), learner.r));
        ladder = answerOffer(ladder, 'reading', yes ? 'accepted' : 'declined', t + MINUTE);
        if (yes) { out.accepted++; sinceAccept = 0; } else out.declined++;
      }
      if (out.reachedAt === null && near(ladder.reading.stable)) out.reachedAt = out.scenes;
      t += 5 * MINUTE;
    }
  }
  return out;
}

const quantile = (list, q) => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const pct = (n, d) => (d ? Math.round(n / d * 1000) / 10 : 0);

/** The three learners over every village's daily visits: villages [{ villageSeed, visits }]. */
export function runLearners(villages, params = paramsFor()) {
  return LEARNERS.map(learner => {
    const lives = villages.map(v => learnerLife(learner, v.villageSeed, v.visits, params));
    const sum = key => lives.reduce((n, life) => n + life[key], 0);
    const reached = lives.filter(life => life.reachedAt !== null).map(life => life.reachedAt);
    const levels = {};
    for (const life of lives) for (const [level, n] of Object.entries(life.levels)) levels[level] = (levels[level] || 0) + n;
    return { learner: learner.id, label: learner.label, r: learner.r, villages: lives.length, scenes: sum('scenes'),
      reachedShare: pct(reached.length, lives.length), reachedMedian: quantile(reached, 0.5), reachedP90: quantile(reached, 0.9),
      nearShare: pct(sum('nearScenes'), sum('scenes')), aboveShare: pct(sum('above'), sum('scenes')),
      offers: sum('offers'), declineShare: pct(sum('declined'), sum('offers')), accepted: sum('accepted'),
      droppedAfterAccept: pct(sum('acceptedThenDropped'), sum('accepted')), fallbacks: sum('fallbacks'),
      eased: pct(sum('eased'), sum('scenes')), stopped: pct(sum('stopped'), sum('scenes')), drops: sum('drops'),
      levels: Object.fromEntries(LEVELS.map(level => [level, pct(levels[level] || 0, sum('scenes'))])) };
  });
}
