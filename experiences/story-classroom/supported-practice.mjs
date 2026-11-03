// 자동 읽기(기본값)로 한 부탁은 Trail에서 독립 근거가 되지 않는다. 여기서는 판정을 다시 하지 않고, 게임 기록에 남은 사실
// (읽어 주기를 들으며 첫 시도로 어떻게 했는가)만 읽어 그 부탁을 다시 해 볼 기회를 건넨다. 쓰지 않고, 요약·난도·추천을 바꾸지 않는다.
// 조작 실수와 언어 오답은 기록에서 구분되지 않고 오답 종류도 남지 않으므로 원인을 말하지 않는다: 일어난 일과 그 부탁만 말한다.
import { EPISODE } from './story.mjs';
import { GAME_ID, missionMetadata } from './learning.mjs';

const DAY = 86400000, RECENT = 30 * DAY, WINDOW = 3, MISSES = 2, SCENES = 2;
const SCENE_COUNT = { 2: '두', 3: '세' };
const KIND = {
  'ko.reading.detail': '누가·무엇을·어디에 옮기는 부탁',
  'ko.reading.negation': '‘~지 말고’·‘~이 아니라’가 들어간 부탁',
  'ko.reading.sequence': '먼저 할 일이 있는 부탁',
};
const SCENE_MISSIONS = [...EPISODE.acts.flatMap(act => act.missions.map(mission => [mission, act.id])), ...EPISODE.review.map(mission => [mission, 'review'])];
// learning.mjs와 서로 가져오므로 모듈을 읽는 동안에는 부르지 않는다.
let byFamily = null;
const familyIndex = () => byFamily ||= new Map(SCENE_MISSIONS.map(([mission, scene]) => { const meta = missionMetadata(mission); return [meta.familyKey, { mission, scene, skillId: meta.skillId }]; }));

/** 부탁마다 가장 최근의 유효한 첫 시도 하나. 답을 알려 주는 도움 뒤의 시도·미평가·무응답·다른 게임·옛 판은 행이 되지 않는다.
 *  lastRepeat: 다시 한 부탁의 시도 가운데 가장 나중 순서(도움을 받아 행에서 빠진 것도 센다). 없으면 -1. */
function firstAttempts(events, now) {
  const byId = new Map(events.map(event => [event.id, event])), latest = new Map();
  const excluded = new Set(events.filter(event => event.type === 'record.excluded').map(event => event.targetId));
  const helps = new Map();
  let lastRepeat = -1;
  events.forEach((event, order) => {
    if (event.type === 'practice.helped') {
      if (!helps.has(event.presentationId)) helps.set(event.presentationId, []);
      helps.get(event.presentationId).push({ ...event, order });
      return;
    }
    if (event.type !== 'practice.attempted' || event.attemptNo !== 1 || !['correct', 'incorrect'].includes(event.verdict)) return;
    const shown = byId.get(event.presentationId), decision = byId.get(shown?.decisionId);
    if (shown?.type !== 'practice.presented' || decision?.type !== 'decision.made' || decision.experienceId !== GAME_ID) return;
    if (shown.measure?.confounded === true || excluded.has(event.id) || excluded.has(shown.id)) return;
    const known = familyIndex().get(shown.measure?.familyKey), at = Date.parse(event.at);
    if (!known || !(now - at <= RECENT)) return;
    if (shown.firstExposure !== true) lastRepeat = order;
    const before = (helps.get(shown.id) || []).filter(help => help.order < order);
    if (before.some(help => help.level !== 'cue' || help.helpId !== 'replay')) { latest.delete(known.mission.id); return; }
    latest.set(known.mission.id, { ...known, id: event.id, order, missed: event.verdict === 'incorrect', heard: before.length > 0, repeat: shown.firstExposure !== true });
  });
  return { rows: [...latest.values()].sort((a, b) => a.order - b.order), lastRepeat };
}

/** 같은 종류의 부탁을 서로 다른 장면에서 두 번 이상 첫 시도에 다르게 한 경우. 최근 3개 안에서만 보아, 다시 해서 맞으면 사라진다. */
function repeatedPattern(rows) {
  const found = [];
  for (const skillId of Object.keys(KIND)) {
    const missed = rows.filter(row => row.skillId === skillId).slice(-WINDOW).filter(row => row.missed);
    if (missed.length >= MISSES && new Set(missed.map(row => row.scene)).size >= SCENES) found.push({ skillId, missed });
  }
  return found.sort((a, b) => b.missed.at(-1).order - a.missed.at(-1).order)[0] || null;
}

/**
 * 입구에 건넬 말과 부탁. 없으면 null.
 * strength 'repeated': 서로 다른 장면에서 같은 종류를 놓친 사실이 있을 때.
 * strength 'gentle': 그만한 근거가 없을 때, 들으며 처음 받은 가장 최근 부탁을 결과를 말하지 않고 건넨다(이미 건넨 행은 호출하는 쪽이 거른다).
 * 그 뒤에 이미 만난 부탁을 다시 했다면 「지난번」은 그 다시 한 판이므로, 더 옛 부탁으로 거슬러 올라가 권하지 않는다.
 */
export function supportedPractice(coach, { now = Date.now() } = {}) {
  if (!coach) return null;
  try {
    const summary = coach.summary();
    if (summary?.storage?.available !== true) return null;
    const { rows, lastRepeat } = firstAttempts(coach.events(), now);
    const pattern = summary.evidenceComplete === true ? repeatedPattern(rows) : null;
    if (pattern) {
      const last = pattern.missed.at(-1), scenes = new Set(pattern.missed.map(row => row.scene)).size;
      const opening = pattern.missed.every(row => row.heard) ? '부탁을 들으며 했던' : '지난 이야기에서 했던';
      return { strength: 'repeated', missionId: last.mission.id, rowId: last.id,
        line: `${opening} ‘${last.mission.text}’처럼 ${KIND[pattern.skillId]}을 ${SCENE_COUNT[scenes] || scenes} 장면에서 첫 번에 다르게 했어요. 이 부탁을 한 번 더 해 볼까요?`,
        action: '이 부탁 한 번 더' };
    }
    const last = rows.filter(row => !row.repeat).at(-1);
    if (!last?.heard || last.order < lastRepeat) return null;
    return { strength: 'gentle', missionId: last.mission.id, rowId: last.id,
      line: `지난번에 들으며 한 부탁이에요. ‘${last.mission.text}’ 다시 해 보고 싶으면 눌러요.`, action: '이 부탁 다시 하기' };
  } catch { return null; }
}
