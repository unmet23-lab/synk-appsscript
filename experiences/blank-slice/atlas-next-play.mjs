// 빈칸 베기의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 판 · 고르기 · 답 · 순간 맞춤을 잇는다.
// 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.mjs는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   판      12문장(set.length 12 · 새것 한도 3n — 키트 setPlay). 문장마다 recommend를 부른다. 후보는 이 판에 아직 안 나온 문장이고,
//           두 학습 항목(낱말 · 조사와 문형)을 4문장씩 채울 자리만 남으면 모자란 항목으로 좁힌다(core.mjs composeRound와 같은 최소 규칙).
//           처음 판은 쉬운 문장(원고 난도 1)만 후보로 둔다(게임 안 단계 — 입구의 「처음이라 쉬운 문장부터」).
//           은행에 없는 문장(지도 밖)은 후보에 넣지 않는다 — 내면 엔진이 태그 없는 문항으로 받아 새 단위로 센다.
//   게임 차례  엔진이 none이면 같은 후보에서 게임 순서(composeRound — 판 번호로 섞은 옛 판)로 골라 present만 한다. 이유 줄은 없다.
//           idle(채우기)은 엔진이 고른 문항이다(키트 setPlay).
//   답      옛 답 꼴(learning.mjs answerPayload · missedPayload)을 키트 answerOf로 옮긴다. 문장마다 답은 하나 — 벤 말, 또는 두 번 던져도
//           못 벤 문장의 멈춘 보기에서 고른 답(게임 규칙 그대로). 연습 문장은 기록하지 않는다.
//   순간 맞춤  조각이 떠 있는 시간(live) · 오늘(today). 던질 때마다의 결과는 그 문장의 제시 번호와 함께 observe한다 — 한 제시가 Flow를
//           한 번만 움직인다(두 번째 던지기의 결과는 몫이 없다).
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫혀도(RUN_ENDED) 고르기가 실패해도 놀이는 게임 차례로 이어 간다.
// 옛 return-practice · 옛 요약 여섯 상태(skillReport) · rankItems · events · 기록 지우기 · syncPort · WORLD 과제(assignment)는 새 길에서 쓰지
// 않는다(§23-6 · §23-8 — 과제 틀은 위 창에 옛 학습 호스트가 있어 옛 길이다).
import { ITEMS, ROUND_SIZE, SKILL_LABEL } from './content.mjs';
import { composeRound } from './core.mjs';
import { GAME_ID, candidates, itemMetadata } from './learning.mjs';
import { answerOf, openNext, setPlay } from './kit/atlas-next.mjs';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['blank-slice'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['blank-slice']);
// 문장 앞에 한 줄로 알리는 이유 — 다시 만나는 말(방금 놓친 말 · 흔들리는 말 · 돌아온 말). 처음 만나는 말은 문장마다 말하지 않는다.
export const SENTENCE_REASONS = Object.freeze(['unit.retry', 'unit.shaky', 'unit.due']);
// 판 끝 한 줄로 쓰는 엔진 문장 — 엔진이 그 까닭으로 고르지 않았을 때(하루 상한 · 끈질긴 말의 몫)만.
const HELD = new Set(['day.capped', 'pace.stubborn']);

const quietly = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};

// 새 길 코치를 연다. 문이 없고 개발 깃발도 없거나 셸이 지금 판이라고 하면 null(옛 길). RUN_ENDED는 그대로 던진다 — 옛 길을 열지 않는다.
export async function openSlice({ win = globalThis.window } = {}) {
  const coach = await openNext({
    win,
    gameId: GAME_ID,
    banks: [...BANKS],
    // 혼자 뜨는 길(개발 깃발)의 능력 이름 — 셸이 넘기는 표와 같은 이름(단위 이름은 지도 조각이 안다).
    label: id => SKILL_LABEL[id] ?? null,
  });
  return coach ? createSlice(coach) : null;
}

// coach: 키트가 감싼 게임 겉(openNext의 값).
export function createSlice(coach) {
  let retired = false;
  // 판을 다시 정했다 — 이번 판은 기록 없이 잇고 다음 판에서 문을 다시 연다(§23-2).
  quietly(() =>
    coach.onRetired?.(() => {
      retired = true;
    }),
  );
  return Object.freeze({
    // learning.mjs createReadingConfirmation · app.mjs가 쓰는 옛 겉의 꼴. 답은 answerOf로 옮긴다. assignment는 없다(과제는 옛 길).
    coach: Object.freeze({
      present: item => coach.present(item),
      answer: (pid, old) => coach.answer(pid, answerOf(old)),
      today: () => coach.today(),
      live: (content, options) => coach.live(content, options),
      summary: () => coach.summary(),
    }),
    get retired() {
      return retired;
    },
    round: (options = {}) => roundOf(coach, options),
    // 던진 결과를 순간 맞춤에 — 그 문장의 제시 번호와 함께(제시가 있는 관찰, §23-4).
    observe: (flow, pid, observation) => flow.observe(observation, pid ?? null),
  });
}

// 판을 닫는다(기록 없이). 겉이 닫혔거나 닫을 판이 없어도 놀이는 그대로다.
function closer(set) {
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    quietly(() => set.end());
  };
}

// 은행에 있는 문장만(지도 밖 문장은 새 길에서 내지 않는다). 겉이 닫혔으면 전부 — 어차피 기록되지 않는다.
function banked(coach, items) {
  const known = quietly(() => items.filter(item => coach.itemUnits(itemMetadata(item).itemKey).length > 0));
  return known ?? items;
}

// 보통 판 — 문장마다 recommend. at(i)는 i번째 문장을 그때 고른다(앞 문장의 답을 본 뒤). size · queue(낸 문장, 차례대로) ·
// pool(고를 수 있는 문장) · line(i)(문장 앞 이유 한 줄) · kinds(문장마다 engine · game) · end()(판 끝 한 줄 — 없으면 null).
function roundOf(coach, { firstTime = false, seed = 0, size = ROUND_SIZE } = {}) {
  const pool = banked(coach, firstTime ? ITEMS.filter(item => item.difficulty === 1) : ITEMS);
  // 게임 순서 — 옛 판이 아틀라스 순서 없이 짜던 판, 그다음 나머지(같은 섞기).
  const order = [
    ...new Set([
      ...composeRound(pool, { firstTime, seed, size }),
      ...composeRound(pool, { firstTime, seed, size: pool.length }),
    ]),
  ];
  const skills = Object.keys(SKILL_LABEL);
  const length = Math.min(size, pool.length);
  const minEach = Math.min(4, Math.floor(length / 3));
  const queue = [];
  const lines = [];
  const picks = [];
  let last = null;
  let held = null;
  const set = setPlay(
    {
      recommend: (list, options) => {
        last = coach.recommend(list, options);
        return last;
      },
      finishSet: options => coach.finishSet(options),
    },
    { length: size },
  );
  const end = closer(set);

  // 남은 문장 — 모자란 항목을 채울 자리만 남으면 그 항목으로 좁힌다.
  function left() {
    const rest = pool.filter(item => !queue.includes(item));
    const owed = skills
      .map(skill => [skill, Math.max(0, minEach - queue.filter(item => item.skill === skill).length)])
      .filter(([, n]) => n > 0);
    const due = owed.reduce((sum, [, n]) => sum + n, 0);
    if (!due || due < length - queue.length) return rest;
    const narrowed = rest.filter(item => owed.some(([skill]) => skill === item.skill));
    return narrowed.length ? narrowed : rest;
  }
  // 게임 차례 — 게임 순서에서 후보에 든 첫 문장.
  const gameTurn = list => {
    const next = order.find(item => list.some(row => row.itemId === item.id));
    return next ? list.find(row => row.itemId === next.id) : null;
  };

  function pick() {
    const rest = left();
    if (!rest.length) return null;
    const list = candidates(rest);
    last = null;
    let got;
    try {
      got = set.next(list, gameTurn);
    } catch {
      // 겉이 닫혔거나(RUN_ENDED) 고르기가 실패했다 — 기록 없이 게임 차례로 잇는다.
      const row = gameTurn(list);
      got = row ? { item: row, why: null, engine: false } : null;
    }
    const item = got?.item ? rest.find(one => one.id === got.item.itemId) : null;
    if (!item) return null;
    if (last?.status === 'none' && HELD.has(last.why?.code) && last.why.line) held = last.why.line;
    queue.push(item);
    picks.push(got.engine ? 'engine' : 'game');
    lines.push(got.engine && SENTENCE_REASONS.includes(got.why?.code) ? (got.why.line ?? null) : null);
    return item;
  }

  return Object.freeze({
    size: length,
    queue,
    pool,
    at(index) {
      if (index < queue.length) return queue[index];
      if (index !== queue.length || queue.length >= length) return null;
      return pick();
    },
    line: index => lines[index] ?? null,
    kinds: () => [...picks],
    end() {
      if (queue.length) end();
      return held;
    },
  });
}
