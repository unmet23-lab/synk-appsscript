// 예상 급수의 근거 셈(단계 4 계획 §21-23의 2 — 설계 주인 11-17 답 1 · 2). 손님 코치(coach.firstAnswers)와 서버 읽기(SYNK-talk · 리허설 서버의
// learning?view=trail-first-answers)가 같은 셈(firstAnswersOf)을 부른다. 엔진은 게임 이름을 모른다 — 어느 게임의 근거를 셀지는 제품이 넘긴다.
//
// 근거 하나 = 한 계열의 첫 만남(lead)이 다섯을 모두 채울 때다. lead는 그 계열의 만남 줄(meet · carry — 처음부터) 가운데 접기 차례(시각 →
// 사건 번호, 장부 만남은 어떤 만남보다 먼저 — fold/order.mjs byTime)로 맨 앞 하나다. 요약의 칸(rows.mjs cellLines)과 코치의 측정(measured)이
// 쓰는 첫 만남과 같다.
//   ① 옮겨 온 장부의 만남(carry)이 아니다.
//   ② 그 만남이 답이다 — 답 전에 도움을 보았으면 첫 만남은 도움이라 근거가 아니다.
//   ③ 혼자 낸 채점된 답이다(unaided, 맞힘이나 틀림). 응답을 지운 답과 거둔 제시에 온 답은 만남으로 남고 채점만 빈다(fold/evidence.mjs) —
//      그 계열의 첫 만남이 그 답이라 뒤에 다시 낸 답도 근거가 아니다(이미 본 문항의 뒤 답은 처음 보고 낸 답이 아니다).
//   ④ 그 답의 제시가 그 게임의 판이다 — 제시가 실은 판 번호(setId)에서 읽은 게임 이름(coach/set-id.mjs gameOfSet). 꼴이 틀린 번호 · 판
//      번호가 없는 옛 꼴 제시는 근거가 아니다.
//   ⑤ 그 답의 시각이 창(since 이상) 안이다. 창은 lead를 고른 뒤 마지막에 건다 — 창 안의 줄만 먼저 자르면 창 앞에 이미 만난 계열의 창 안
//      답이 첫 만남으로 서고, 창 바로 앞에 낸 제시에 창 안에서 한 답이 제시를 잃는다(설계 검토 카본 B6).
// 내는 것은 능력 id마다의 근거 수다(줄은 내지 않는다). 시험 · 영역으로 묶는 것과 문턱(전체 30 · 영역별 10)은 제품이 한다.
import { gameOfSet, isGameId } from '../coach/set-id.mjs';
import { byTime } from '../fold/order.mjs';
import { toMark } from './rows.mjs';

// 묻는 값(끝 판 검수 카본 F1) — 게임 이름은 판 번호의 게임 이름 꼴만, 창의 시작은 유한한 수(ms)만 받고 그 밖은 던진다. 꼴이 틀린 값으로 부르면
// 판 번호를 읽지 못한 만남(null)과 「물은 게임 null」이 같다고 세거나, 창이 전체 기간으로 풀린다. 제품의 입구(코치 · talk · 리허설 서버)도 검사한다.
function askOf({ game, since } = {}) {
  if (!isGameId(game)) throw new TypeError('Atlas record: firstAnswers의 game은 게임 이름이다');
  if (!Number.isFinite(since))
    throw new TypeError('Atlas record: firstAnswers의 since는 유한한 수다');
  return { game, since };
}

// 한 계열의 만남 줄(meet · carry — 처음부터, 차례는 상관없다) → 첫 만남이 혼자 낸 채점된 답이면 그 줄(①②③), 아니면 null.
export function soloLead(rows) {
  let lead = null;
  let mark = null;
  for (const row of rows ?? []) {
    if (row?.kind !== 'meet' && row?.kind !== 'carry') continue;
    const next = toMark(row);
    if (mark === null || byTime(next, mark) < 0) {
      lead = row;
      mark = next;
    }
  }
  if (lead?.kind !== 'meet') return null;
  return lead.unaided === true && lead.grade != null ? lead : null;
}

// 능력 id마다의 근거 수 — 차례가 정해진 보통 객체(능력 id 차례). families는 계열마다의 만남 줄 묶음들(Map의 값 · 배열), setOf(key)는
// 그 만남(답)의 제시가 실은 판 번호(없으면 null)다. 손님 코치는 기록부의 묶음에서, 서버는 사건 표에서 setOf를 짓는다.
export function firstAnswersOf(families, setOf, ask) {
  const { game, since } = askOf(ask);
  const counts = new Map();
  for (const rows of families) {
    const lead = soloLead(rows);
    if (!lead || !(lead.at >= since)) continue; // ⑤ — lead를 고른 뒤에 건다
    if (gameOfSet(setOf(lead.key)) !== game) continue; // ④
    counts.set(lead.skill, (counts.get(lead.skill) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// 서버 저장소(server.mjs의 store 포트)에서 센다. 첫 걸음: 이 계정 · 이 판 묶음의 만남 줄 전부(meetRows). 둘째 걸음: 창 안에 선 혼자 낸
// lead 답의 사건과 그 제시 사건을 사건 번호 묶음으로 한 번씩 찾아 판 번호를 읽는다(eventsByIds — 계정 · 사건 번호 유일 색인). 셋째: 셈.
// 옛 꼴 답은 접기 번호가 사건 번호가 아니라(adapt.mjs serverKey) 찾지 못하고, 옛 꼴 제시에는 판 번호가 없다 — 둘 다 근거가 아니다. 기기 쪽
// (record/log.mjs setOfSource)은 제시 종류와 2판 여부를 따로 보지만, 서버 셈은 이 두 사실에 기댄다. 지금 결과는 두 쪽이 같다(Fable 끝 판 F3 —
// 임의 장면 720번 대조에서 어긋남 0). 옛 꼴 제시가 판 번호를 싣게 되면 두 쪽에 같은 검사를 두고 시험을 더한다.
// 묻는 값은 저장소를 읽기 전에 검사한다(꼴이 틀리면 읽지 않고 던진다).
export async function firstAnswersOfStore(store, ask) {
  const { game, since } = askOf(ask);
  const families = await store.meetRows();
  const keys = [];
  for (const rows of families.values()) {
    const lead = soloLead(rows);
    if (lead && lead.at >= since) keys.push(lead.key);
  }
  const answers = keys.length ? await store.eventsByIds(keys) : new Map();
  const presentationOf = key => {
    const id = answers.get(key)?.event?.presentationId;
    return typeof id === 'string' ? id : null;
  };
  const ids = [...new Set(keys.map(presentationOf).filter(Boolean))];
  const presentations = ids.length ? await store.eventsByIds(ids) : new Map();
  const setOf = key => {
    const event = presentations.get(presentationOf(key))?.event;
    return typeof event?.setId === 'string' ? event.setId : null;
  };
  return firstAnswersOf(families.values(), setOf, { game, since });
}
