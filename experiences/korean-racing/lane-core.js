// 차선 레이스의 셈(2026-11-04): 트랙 판과 「어느 길인가 · 언제 기다리나 · 얼마나 빨리 가나」. DOM · THREE · 저장을 모른다.
// race-controller.js가 이 셈을 부른다. LAB은 CAR_TRACK(10-23까지의 숫자 그대로), WORLD의 MT 자전거 레이스는 RIDE_TRACK이다.
// 판정 · 대기 · 맞춤 속도 · Atlas 압박은 코스 단위(자동차 때 숫자)로 셈하고, 화면에 놓을 때만 courseToRoad로 줄인다 —
// 그래서 문제 사이 시간과 듣고 고를 시간이 두 판에서 똑같다(설계 qa/world-mt-20261104/설계.md 7절).
export const LANE_GAP = 3.45;
export const LANES = Object.freeze([-LANE_GAP, 0, LANE_GAP]);
export const OFFSET_LIMIT = 5.05, OFFSET_EDGE = 4.95, COURSE_START = 75;
export const STEER_RATE = 5.8;   // 좌우 꺾기(m/s). 게이트에 닿을 때의 차선을 정하는 입력이라 탈것이 바뀌어도 그대로다.
export const HOLD_DISTANCE = 65;   // 음성 · 선택을 기다리는 멈춤선(게이트 앞 코스 거리)

export const CAR_TRACK = Object.freeze({ id: 'car', speedScale: 1, origin: COURSE_START, stopForReview: true, raceMusic: null, listenRoll: null, rivalsMakeRoom: false, rivalHover: null,
  contact: Object.freeze({ halfWidth: 1.16, halfLength: 2.3 }),
  coast: Object.freeze({ open: 42, edge: 32, contact: 28 }),
  words: Object.freeze({ boost: '부스터', boostClip: 'boost', tutorialCorrect: 'tutorial-correct', tutorialBoost: 'tutorial-boost', expandedHelp: '펼친 동안 차가 기다려요. 답 꼬리표를 누르거나 접고 달려요.' }) });

// 자전거: 코스 1m = 길 위 0.4m, 그래서 94km/h가 37km/h, 부스터 151km/h가 60km/h(내리막 질주)로 보인다.
// 접촉 상자의 반 길이는 코스 단위라 길 위에서 0.92m(자전거 반 길이), 반 폭은 좌우 그대로의 0.45m.
// 도착 뒤 천천히 달리는 바닷길은 26(37km/h)으로 낮춘다. 틀려도 멈추지 않고(유호님 조건), 음악은 레이스 동안 낮게 깐다.
// 문제를 듣는 동안은 13km/h로 천천히 구르고 상대도 같은 비율로 늦춘다(시안에서 15초씩 서 있어 속도감이 죽었다). 음성이 멈춤선까지 안 끝나면 그때는 LAB처럼 선다.
// 상대는 같은 길에서 가까워지면 옆 길로 비켜 준다(1인칭에서 앞사람이 화면을 다 가리고 자꾸 부딪혔다).
// 상대는 맞힌 수만큼 뒤로 밀려나는 자리에 머문다(rivalHover = [처음 자리, 정답 하나당], 내 앞이 음수, 코스 단위): 1인칭에서는 내 뒤에 있는 사람이 안 보인다 —
// 첫 정답 뒤 내내 혼자 달렸다(시안 실측). 옆 길 사람은 세로 화면(가로 시야 좁음)에서 10m 안이면 틀 밖이라 14m 넘게 앞에 둔다. 처음엔 둘 다 앞에 보이고, 맞힐수록 차례로 앞질러 넷째 · 다섯째엔 둘 다 뒤로 간다. 끝 순위가 마지막 한 문제가 아니라 맞힌 수를 따른다.
export const RIDE_TRACK = Object.freeze({ id: 'ride', speedScale: .4, origin: COURSE_START, stopForReview: false, raceMusic: Object.freeze({ level: .3, duckLevel: .12 }), listenRoll: 9, rivalsMakeRoom: true, rivalHover: Object.freeze([[-42, 14], [-60, 16]]),
  contact: Object.freeze({ halfWidth: .45, halfLength: 2.3 }),
  coast: Object.freeze({ open: 26, edge: 21, contact: 18 }),
  words: Object.freeze({ boost: '질주', boostClip: 'ride-boost', tutorialCorrect: 'ride-tutorial-correct', tutorialBoost: 'ride-tutorial-boost', expandedHelp: '펼친 동안 자전거가 기다려요. 답 꼬리표를 누르거나 접고 달려요.' }) });

/** 상대 속도 배율: 머물 자리보다 뒤처지면 빨라지고(질주 42보다는 느리게) 앞서면 늦춘다. gap = 내 자리 − 상대 자리. */
export function rivalBandFactor(gap, hover, correct) {
  const target = hover[0] + hover[1] * correct;
  return Math.max(.78, Math.min(1.45, 1 + (gap - target) / 60));
}

/** 코스 거리 → 길 위 거리. 판정은 코스 단위, 3D에 놓을 때만 이 값을 쓴다. */
export const courseToRoad = (s, track) => track.origin + (s - COURSE_START) * track.speedScale;
/** 화면에 적는 km/h. */
export const displaySpeed = (velocity, track) => Math.round(velocity * 3.6 * track.speedScale);

/** 지금 있는 길(월드 순서 0 · 1 · 2). 답은 게이트를 지날 때의 이 길로 정해진다. */
export function laneOf(offset) { return Math.max(0, Math.min(2, Math.round((offset + LANE_GAP) / LANE_GAP))); }

/**
 * 게이트 앞에서 기다리나. 문제 음성이 끝날 때까지(voice), 문장 코스는 길을 고를 때까지(choice), 글을 펼친 동안(expanded) 멈춘다.
 * 상대도 함께 기다리므로 듣는 시간이 순위 불이익이 되지 않는다.
 */
export function gateWait({ announced, judged, distance, hearing, campaign, auto, chosen, expanded }) {
  const open = !!announced && !judged, near = distance < HOLD_DISTANCE;
  const voice = !!(open && hearing && near), choice = !!(campaign && open && !auto && !chosen && near);
  return { voice, choice, waiting: voice || choice || !!expanded };
}

/** 지금 가려는 속도(코스 단위). 기다림 0 · 접촉 22 · 갓길 21 · 부스터 · 모두 답한 뒤 42 · 그 밖 cruise, 듣는 동안 구르기(rollSpeed, 부스터가 끝난 뒤). 맞춤 속도 비율은 함께 곱한다. */
export function targetSpeed({ waiting, contactTimer, edge, boost, allAnswered, cruise, baseCruise, rollSpeed = null }) {
  const pace = cruise / baseCruise;
  if (waiting) return 0;
  if (contactTimer > .5) return 22 * pace;
  if (edge) return 21 * pace;
  if (boost > 0 || allAnswered) return 42 * pace;
  return rollSpeed ? Math.min(cruise, rollSpeed * pace) : cruise;
}

/** 듣는 동안 구르는가: 트랙이 허락하고, 음성 중이고, 멈춤선 앞이고, 부스터가 끝났을 때. 상대 속도 비율은 그때 rollSpeed / baseCruise다. */
export const listeningRoll = ({ hearing, waiting, boost }, track) => (track.listenRoll && hearing && !waiting && boost <= 0 ? track.listenRoll : null);
