// 말 랠리의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 판 · 고르기 · 답 · 도움 · 전달 · 순간 맞춤을 잇는다.
// 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.mjs는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   판      보통 판은 12공(set.length 12 · 새것 한도 3n — 키트 setPlay). 공마다 recommend를 부른다. 후보는 이 판에 아직 안 나온 말이고,
//           두 종류(묻는 말에 대답 · 이어지는 말)를 4개씩 채울 자리만 남으면 모자란 종류로 좁힌다(core.mjs composeRound와 같은 최소 규칙).
//           처음 판은 쉬운 말(원고 난도 1)만 후보로 둔다(게임 안 단계 — 입구의 「처음이니까 쉬운 말부터」).
//   게임 차례  엔진이 none이면 같은 후보에서 게임 순서(composeRound — 판 번호로 섞은 옛 판)로 골라 present만 한다. 이유 줄은 없다.
//           idle(채우기)은 엔진이 고른 문항이다(키트 setPlay). 소리를 끈 판은 듣기 문항을 고르지 않으므로(audio: false) 게임 차례다.
//   하루 도전  그날 정해진 12번(daily.mjs)이라 recommend 없이 present만 한다. 첫 공의 제시 전에 판 길이(12)를 코치에 넘긴다(키트
//           setPlay.open — 코치 startSet, 새것 한도 3n). 코치에 startSet이 없거나 겉이 닫혔으면 첫 제시가 기본 판으로 연다.
//   답      옛 답 꼴(learning.mjs answerPayload · missedPayload)을 키트 answerOf로 옮긴다. 공은 한 번만 받는다 — 놓친 공은 같은 제시로
//           다시 친다(게임 규칙, app.mjs onMissed).
//   순간 맞춤  공이 오는 시간(live) · 오늘(today). 받아친 결과는 그 공의 제시 번호와 함께 observe한다 — 한 제시가 Flow를 한 번만 움직인다.
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫혀도(RUN_ENDED) 고르기가 실패해도 놀이는 게임 차례로 이어 간다.
// 옛 return-practice · 옛 요약 여섯 상태(skillReport) · events(hasEarlierRecord) · 기록 지우기 · syncPort는 새 길에서 쓰지 않는다(§23-6).
import { ITEMS, KIND_LABEL, ROUND_SIZE, SKILL_LABEL } from './content.mjs';
import { composeRound } from './core.mjs';
import { GAME_ID, candidates } from './learning.mjs';
import { answerOf, openNext, setPlay } from './kit/atlas-next.mjs';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['talk-rally'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['talk-rally']);
// 공 앞에 한 줄로 알리는 이유 — 다시 만나는 말(방금 놓친 말 · 흔들리는 말 · 돌아온 말). 처음 만나는 말은 공마다 말하지 않는다.
export const BALL_REASONS = Object.freeze(['unit.retry', 'unit.shaky', 'unit.due']);
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
// audio(): 지금 소리를 낼 수 있나(소리 끔이면 엔진이 듣기 문항을 고르지 않는다).
export async function openRally({ win = globalThis.window, audio = () => true } = {}) {
  const coach = await openNext({
    win,
    gameId: GAME_ID,
    banks: [...BANKS],
    // 혼자 뜨는 길(개발 깃발)의 능력 이름 — 셸이 넘기는 표와 같은 이름(단위 이름은 지도 조각이 안다).
    label: id => SKILL_LABEL[id] ?? null,
  });
  return coach ? createRally(coach, { audio }) : null;
}

// coach: 키트가 감싼 게임 겉(openNext의 값).
export function createRally(coach, { audio = () => true } = {}) {
  let retired = false;
  // 판을 다시 정했다 — 이번 판은 기록 없이 잇고 다음 판에서 문을 다시 연다(§23-2).
  quietly(() =>
    coach.onRetired?.(() => {
      retired = true;
    }),
  );
  const engine = {
    recommend: (list, options) => coach.recommend(list, { ...options, audio: audio() !== false }),
    finishSet: options => coach.finishSet(options),
    // 판 열기 — 코치에 있을 때만 건넨다(없으면 키트 setPlay.open이 null을 내고 첫 제시가 기본 판으로 연다).
    ...(typeof coach.startSet === 'function' ? { startSet: options => coach.startSet(options) } : {}),
  };
  return Object.freeze({
    // learning.mjs createExchange · app.mjs가 쓰는 옛 겉의 꼴. 답은 answerOf로 옮긴다.
    coach: Object.freeze({
      present: item => coach.present(item),
      delivery: (pid, delivered) => coach.delivery(pid, delivered),
      help: (pid, kind) => coach.help(pid, kind),
      answer: (pid, old) => coach.answer(pid, answerOf(old)),
      today: () => coach.today(),
      live: (content, options) => coach.live(content, options),
      summary: () => coach.summary(),
    }),
    get retired() {
      return retired;
    },
    round: (options = {}) => roundOf(engine, options),
    fixed: queue => fixedOf(engine, queue),
    // 받아친 결과를 순간 맞춤에 — 그 공의 제시 번호와 함께(제시가 있는 관찰, §23-4).
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

// 보통 판 — 공마다 recommend. at(i)는 i번째 공을 그때 고른다(앞 공의 답을 본 뒤). size · queue(낸 말, 차례대로) · pool(고를 수 있는 말 —
// 소리를 미리 받는다) · line(i)(공 앞 이유 한 줄) · kinds(공마다 engine · game) · end()(판 끝 한 줄 — 없으면 null).
function roundOf(engine, { firstTime = false, seed = 0, size = ROUND_SIZE } = {}) {
  const pool = firstTime ? ITEMS.filter(item => item.difficulty === 1) : ITEMS;
  // 게임 순서 — 옛 판이 아틀라스 순서 없이 짜던 판, 그다음 나머지(같은 섞기).
  const order = [
    ...new Set([
      ...composeRound(pool, { firstTime, seed, size }),
      ...composeRound(pool, { firstTime, seed, size: pool.length }),
    ]),
  ];
  const kinds = Object.keys(KIND_LABEL);
  const minEach = Math.min(4, Math.floor(Math.min(size, pool.length) / 3));
  const queue = [];
  const lines = [];
  const picks = [];
  let last = null;
  let held = null;
  const set = setPlay(
    {
      recommend: (list, options) => {
        last = engine.recommend(list, options);
        return last;
      },
      finishSet: options => engine.finishSet(options),
    },
    { length: size },
  );
  const end = closer(set);

  // 남은 말 — 모자란 종류를 채울 자리만 남으면 그 종류로 좁힌다.
  function left() {
    const rest = pool.filter(item => !queue.includes(item));
    const owed = kinds
      .map(kind => [kind, Math.max(0, minEach - queue.filter(item => item.kind === kind).length)])
      .filter(([, n]) => n > 0);
    const due = owed.reduce((sum, [, n]) => sum + n, 0);
    if (!due || due < size - queue.length) return rest;
    const narrowed = rest.filter(item => owed.some(([kind]) => kind === item.kind));
    return narrowed.length ? narrowed : rest;
  }
  // 게임 차례 — 게임 순서에서 후보에 든 첫 말.
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
    lines.push(got.engine && BALL_REASONS.includes(got.why?.code) ? (got.why.line ?? null) : null);
    return item;
  }

  return Object.freeze({
    size,
    queue,
    pool,
    at(index) {
      if (index < queue.length) return queue[index];
      if (index !== queue.length || queue.length >= size) return null;
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

// 하루 도전 — 그날 정해진 차례라 recommend 없이 present만(제품 차례). 첫 공을 꺼낼 때(그 공의 제시 전) 판을 열어 길이를 넘기고,
// 판 끝에 판을 닫는다. 앞 판은 app.mjs가 이 판을 만들기 전에 닫는다(endPlan) — 열린 판이 있으면 코치가 새 판을 열지 않는다.
// 판 열기가 실패해도(겉이 닫힘 · 코치 오류) 놀이는 그대로다.
function fixedOf(engine, queue) {
  const set = setPlay(engine, { length: queue.length });
  const end = closer(set);
  let started = false;
  return Object.freeze({
    size: queue.length,
    queue,
    pool: queue,
    at(index) {
      if (!started) {
        started = true;
        quietly(() => set.open());
      }
      return queue[index] ?? null;
    },
    line: () => null,
    kinds: () => queue.map(() => 'game'),
    end() {
      if (started) end();
      return null;
    },
  });
}
