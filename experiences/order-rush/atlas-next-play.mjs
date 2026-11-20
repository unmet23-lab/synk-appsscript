// 주문 폭주의 새 길(단계 4 계획 §23-7 · 4-6d). 게임 진입(app.mjs · beginner.mjs)이 WORLD 셸의 게임 문이나 개발 깃발이 있을 때만 이 파일을
// 동적으로 싣는다 — 꺼진 판은 싣지 않는다. 키트(kit/atlas-next.mjs)로 연 새 코치에 게임을 잇는 얇은 겉 둘:
//   카페(createCafePlay): 손님마다 recommend — 한가한 오픈 8 · 점심 러시 set: {}(시간으로 끝남) · 새 주문 연습 3 · 며칠 뒤 주문 1(due()의
//     단위가 든, 아직 듣지 않은 주문). none이면 게임 차례(덱의 첫 주문)로 present만 하고 이유 줄을 짓지 않는다(키트 setPlay).
//     순간 맞춤은 점심 러시만이다(FLOW_RUSH — 손님 속도 손잡이). 새 길에서 문항 난도는 두뇌가 고르고 Flow는 관찰만 하므로, 손잡이가 문항
//     난도뿐인 FLOW_PRACTICE(한가한 오픈)는 순간 맞춤이 없다. 끄기 단추는 지금처럼 순간 맞춤만 끈다(declared: { mode: 'fixed' }).
//   초급 가게(createShopPlay): 정해진 차례라 present만 한다(recommend 없음). 판의 첫 제시 전에 판 길이(그 판에서 남은 주문 수)를
//     코치 startSet으로 넘긴다 — 60초 러시는 시간으로 끝나 넘기지 않는다. 게임 이름은 같은 order-rush, 은행은 order-rush-beginner다.
// 같은 제시의 뒤 답(고쳐 다시 서빙)은 기록만 되고, 두뇌 판 상태와 Flow는 그 제시의 첫 판정 답만 움직인다(엔진 — §23-4 · 23-5). 오답 뒤
// 떠난 손님의 시간 초과는 observe(관찰, 제시 번호)로 그 제시의 몫을 쓰고, 소리를 다 듣기 전 서빙(flow.outcome 'void')은 몫을 쓰지 않는다.
// 오류는 code로만 가른다 — 겉이 닫혔거나(RUN_ENDED) 끝난 제시(PRESENTATION_GONE)면 기록 없이 잇는다. 판을 다시 정하면(onRetired) 이번 판은
// 기록 없이 잇고, 게임이 다음 판을 열 때 reopen()이 openNext를 다시 부른다('next' 새 겉 · 'old' 지금 판이라 옛 길 · 'ended' 기록 없이).
// 옛 return-practice · recheck · 옛 요약 여섯 상태 · events() · followups · 기록 지우기 · syncPort는 쓰지 않는다(§23-6 「옛 것 대신」).
import { answerOf, ended, nextDoor, openNext, setPlay } from './kit/atlas-next.mjs';
import { orderCandidates, orderMetadata } from './learning.mjs';

export const GAME_ID = 'order-rush';
// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['order-rush'])와 같다 — 코치 하나가 카페와 초급 가게를 함께 받는다.
export const BANKS = Object.freeze(['order-rush', 'order-rush-beginner']);
// 판 길이 — null은 시간으로 끝나는 판(set: {}).
export const SET_LENGTH = Object.freeze({ open: 8, rush: null, review: 3, delayed: 1 });

const GONE = 'PRESENTATION_GONE';

// 답 — 옛 답을 새 꼴로 옮기고 시도 번호는 코치가 그 제시의 답 차례로 매긴다. 게임의 서빙 수는 제시 전(WORLD 문 종 320ms) 서빙까지 세어
// 코치의 차례와 어긋날 수 있다 — 어긋나면 코치가 던져 그 뒤 기록이 모두 멈춘다.
function responseOf(result) {
  const { attemptNo: _attemptNo, ...response } = answerOf(result);
  return response;
}

// 문(또는 혼자 뜨는 길)으로 연 코치 하나와 그 상태 — 겉이 닫힘(closed) · 판을 다시 정함(retired) · 다시 열기(reopen).
function connect(first, win) {
  const state = { coach: null, retired: false, closed: false, reopening: null };
  const seat = coach => {
    state.coach = coach;
    state.retired = false;
    coach.onRetired?.(() => {
      if (state.coach === coach) state.retired = true;
    });
  };
  seat(first);

  async function reopen() {
    if (state.closed) return 'ended';
    if (!state.retired) return 'next';
    // 문이 치워졌다(패널이 닫힘) — openNext가 null을 주더라도 옛 길로 가지 않는다.
    if (!nextDoor(win)) {
      state.closed = true;
      return 'ended';
    }
    try {
      const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
      if (!coach) return 'old';
      seat(coach);
      return 'next';
    } catch {
      state.closed = true; // RUN_ENDED(패널이 닫힘 · 틀 문서가 바뀜)든 다른 실패든 옛 길을 열지 않고 기록 없이 잇는다
      return 'ended';
    }
  }

  return {
    state,
    get retired() {
      return state.retired && !state.closed;
    },
    // 판을 다시 정한 뒤 다음 판에서 한 번 — 같이 부른 쪽은 같은 결과를 받는다.
    reopen() {
      state.reopening ??= reopen().finally(() => {
        state.reopening = null;
      });
      return state.reopening;
    },
    // 코치에 한 번. 닫혔거나 판을 다시 정한 뒤면 부르지 않고, RUN_ENDED · PRESENTATION_GONE이면 fallback(기록 없이 잇는다).
    call(fallback, act) {
      if (state.retired || state.closed) return fallback;
      try {
        return act(state.coach);
      } catch (error) {
        if (ended(error)) {
          state.closed = true; // 판을 다시 정한 알림 없이 닫혔다 — 패널이 닫히거나 틀 문서가 바뀌는 중이다
          return fallback;
        }
        if (error?.code === GONE) return fallback;
        throw error;
      }
    },
  };
}

// 계정의 기록인가 — 연 코치의 저장소가 손님이 아니다(storage.guest === false). 혼자 뜨는 길(개발 깃발)은 늘 손님이다.
function accountOf(coach) {
  try {
    return coach.summary()?.storage?.guest === false;
  } catch {
    return false;
  }
}

// 카페. 게임 본문(app.mjs)은 이 겉을 옛 코치 자리(coach)에 두고 learn(이름, …)으로 부른다 — 던지면 지금처럼 learningFailed로 간다.
//   hosted: 지금 연 코치가 WORLD 계정의 기록인가. 판을 다시 정해 다른 코치를 받으면(reopen) 그 코치로 다시 정한다(끝 판 C1).
//   begin(판) · end(): 판을 열고 닫는다(판 끝 · 그만두기에 finishSet({ record: false })).
//   pick(주문들) → { selected, why, engine }: 엔진이 고른 주문, 아니면 게임 차례. 코치는 마지막에 고른 줄 하나만 들므로 게임은 고른 주문을
//     곧바로 낸다 — 러시는 손님이 줄에 설 때가 아니라 그 손님을 들을 때 고른다(app.mjs chooseLate · 다시 보기 GB3). reason(주문들): 입구 · 결과에 쓸 다음 이유 한 줄(없으면 null).
//   live(내용, 옵션): 순간 맞춤을 열고 settings · intro · end · trace를 준다. present(meta) · delivery · help · answer(pid, 옛 답, flow) · observe(관찰, pid).
//   delayed(주문들): 며칠 뒤 주문 후보. summary(): 확인 도구용.
export function createCafePlay(coach, { win = globalThis.window, hosted = false } = {}) {
  const line = connect(coach, win);
  let set = null;
  let flow = null;
  let tokens = 0;
  let account = hosted;
  let accountFor = coach; // account를 정한 코치 — 다시 연 코치가 앉으면 읽을 때 다시 정한다
  // 답을 기다리는 제시 — 들었지만 아직 맞게 서빙하지도, 응답 없이 닫지도, 떠나지도 않은 손님. 이런 제시가 있는 동안에는 판 옵션(set) 없이
  // 고른다: 오래 쉰 뒤(30분 · 날이 바뀜)의 set은 코치가 새 판을 열어 그 제시를 지운다(PRESENTATION_GONE — GC2). 열린 판은 판 옵션 없는
  // 고르기에 그대로 남는다. 기다리는 제시가 없으면 지금처럼 set으로 고르고, 쉼 · 날이 판을 가른다(§23-6).
  const waiting = new Set();
  // setPlay에 넘기는 코치 — 판을 다시 정해 다시 연 겉으로도 간다.
  const seat = {
    recommend: (candidates, options) => line.state.coach.recommend(candidates, options),
    finishSet: options => line.state.coach.finishSet(options),
  };
  // 판 옵션을 빼고 고르는 판(열린 판을 잇는다) — next만 쓴다.
  const keep = setPlay({
    recommend: (candidates, { set: _set, ...options } = {}) => line.state.coach.recommend(candidates, options),
    finishSet: () => {},
  });
  const turnOf = (candidates, gameTurn) => (waiting.size ? keep : set).next(candidates, gameTurn);
  // 게임 차례: 덱 차례의 첫 주문(지금 기본 순서와 같다).
  const gameTurn = candidates => candidates[0] ?? null;

  function end() {
    flow = null;
    waiting.clear();
    const current = set;
    set = null;
    if (current) line.call(null, () => current.end());
  }

  return Object.freeze({
    get hosted() {
      if (line.state.coach !== accountFor) {
        accountFor = line.state.coach;
        account = accountOf(accountFor);
      }
      return account;
    },
    get retired() {
      return line.retired;
    },
    reopen: () => line.reopen(),
    begin(kind) {
      end();
      set = setPlay(seat, { length: SET_LENGTH[kind] ?? null });
    },
    end,
    pick(orders) {
      const candidates = orderCandidates(orders);
      set ??= setPlay(seat, {});
      const turn = line.call(null, () => turnOf(candidates, gameTurn));
      if (!turn) return candidates.length ? { selected: gameTurn(candidates), why: null, engine: false, idle: false } : null;
      return { selected: turn.item, why: turn.why, engine: turn.engine, idle: turn.idle === true };
    },
    // 판 밖(입구) · 판 끝(결과 — 닫기 전)에서 다음 이유 한 줄. 판 옵션 없이 묻는다 — 열린 판이 있으면 그 판의 상태로 답한다.
    reason(orders) {
      const result = line.call(null, c => c.recommend(orderCandidates(orders)));
      return result && result.status !== 'none' ? (result.why?.line ?? null) : null;
    },
    live(spec, options) {
      flow = null;
      const handle = line.call(null, c => c.live(spec, options));
      if (!handle) return null;
      flow = handle;
      return Object.freeze({
        settings: () => line.call(null, () => handle.settings()),
        intro: () => line.call({ line: null }, () => handle.intro()),
        end: () => line.call(null, () => handle.end()),
        trace: () => line.call([], () => handle.trace()),
      });
    },
    // 제시 번호 — 겉이 닫혔으면 기록 없는 자리표(어느 코치도 모르는 번호)를 준다. 게임은 그대로 듣기 · 서빙을 잇는다.
    present(meta) {
      const pid = line.call(null, c => (flow ? flow.present(meta) : c.present(meta)));
      if (pid) waiting.add(pid);
      return pid ?? `ended:${(tokens += 1)}`;
    },
    delivery: (pid, options) => line.call(null, c => c.delivery(pid, options)),
    help: (pid, kind) => line.call(null, c => c.help(pid, kind)),
    // 답 하나. 러시면 순간 맞춤 겉이 같은 응답으로 Flow를 움직인다(한 제시에 한 번 — 엔진). { recorded, settings, line } 또는 null.
    // 맞게 서빙했거나 응답 없이 닫으면(떠남 · 판 끝) 그 제시는 더 답을 기다리지 않는다.
    answer(pid, result, flowOptions = {}) {
      const response = responseOf(result);
      if (result?.correct === true || result?.reason === 'unanswered') waiting.delete(pid);
      return line.call(null, c => {
        if (!flow) return { recorded: c.answer(pid, response), settings: null, line: null };
        const out = flow.answer(pid, response, flowOptions);
        return { recorded: out.recorded, settings: out.settings ?? null, line: out.line ?? null };
      });
    },
    // 문항이 아닌 관찰(떠난 손님). 제시 번호를 주면 그 제시의 한 번 몫을 쓴다 — 그 손님은 떠났으니 답을 기다리지 않는다. 순간 맞춤이 없으면 null.
    observe(input, pid = null) {
      if (pid != null) waiting.delete(pid);
      if (!flow) return null;
      const handle = flow;
      return line.call(null, () => {
        const out = handle.observe(input, pid);
        return { settings: out.settings ?? null, line: out.line ?? null };
      });
    },
    // 며칠 뒤 주문: 아직 듣지 않았고(seen false) 돌아온 단위(due())가 든 주문.
    delayed(orders) {
      return line.call([], c => {
        const due = new Set(c.due().map(row => row.unit));
        if (!due.size) return [];
        const metas = orders.map(orderMetadata);
        const met = c.exposures(metas);
        return orders.filter(
          (_, at) =>
            met[at]?.seen === false &&
            c.itemUnits(metas[at].itemKey).some(row => due.has(row.unit)),
        );
      });
    },
    summary: () => line.call(null, c => c.summary()),
  });
}

// 초급 가게 — 정해진 차례라 present만 한다. 게임 본문(beginner.mjs)이 옛 코치 자리(coach)에 두고 learn(이름, …)으로 부른다.
// begin(n): 제시마다 그 직전에 부른다. 열린 판이 없으면(판의 첫 제시) 키트 setPlay의 open()으로 판 길이 n을 코치에 넘긴다(startSet —
//   새것 한도 3n). 열린 판이 있으면 아무것도 하지 않는다. 코치에 startSet이 없거나 겉이 닫혔으면 null이고, 첫 제시가 기본 판으로 연다.
// end(): 장 · 복습이 끝나거나 입구로 갈 때 판을 닫는다(판 길이를 넘겼거나 낸 것이 있을 때만).
export function createShopPlay(coach, { win = globalThis.window } = {}) {
  const line = connect(coach, win);
  let open = false;
  return Object.freeze({
    get retired() {
      return line.retired;
    },
    reopen: () => line.reopen(),
    begin(length) {
      if (open) return null;
      const started = line.call(null, c => setPlay(c, { length }).open());
      if (started) open = true; // 코치가 이미 열린 판을 알려도({ opened: false }) 그 판은 end()가 닫는다
      return started;
    },
    present(meta) {
      const pid = line.call(null, c => c.present(meta));
      if (pid) open = true;
      return pid;
    },
    delivery: (pid, options) => line.call(null, c => c.delivery(pid, options)),
    help: (pid, kind) => line.call(null, c => c.help(pid, kind)),
    answer: (pid, result) => line.call(null, c => c.answer(pid, responseOf(result))),
    end() {
      if (!open) return;
      open = false;
      line.call(null, c => c.finishSet({ record: false }));
    },
  });
}

// 카페를 연다 — null이면 지금 판(옛 길). 문의 open이 RUN_ENDED로 거절하면 그대로 던진다(게임은 옛 길을 열지 않고 멈춘다).
// 계정 코치로 문을 거쳤을 때만 「WORLD 계정에 이어진다」(hosted) — 손님 코치는 이 브라우저의 손님 기록이다.
export async function openCafe({ win = globalThis.window } = {}) {
  const viaDoor = nextDoor(win) != null;
  const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  if (!coach) return null;
  return createCafePlay(coach, { win, hosted: viaDoor && accountOf(coach) });
}

// 초급 가게를 연다 — null이면 지금 판(옛 길), RUN_ENDED는 그대로 던진다.
export async function openShop({ win = globalThis.window } = {}) {
  const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  return coach ? createShopPlay(coach, { win }) : null;
}
