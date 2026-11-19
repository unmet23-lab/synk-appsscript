// 환승 러시의 새 길(Atlas 재설계 단계 4 §23-7 · 4-6d). WORLD 셸이 연 게임 코치를 키트(kit/atlas-next.mjs)의 문으로 받아 기록한다.
// app.mjs가 문(또는 로컬 개발 깃발)이 있을 때만 동적으로 싣는다 — 꺼진 판은 이 파일을 싣지 않는다.
//   판: 여정 하나가 판 하나다(set: {} — 여정의 길이는 생성기가 정한다). 여정을 고를 때 판을 열고, 여정이 끝나면 기록 없이 닫는다.
//   고르기: 후보 여정들의 결정 문항 가운데 recommend가 고른 문항이 든 여정. 엔진이 고르지 않으면(none · idle) 게임 차례로 첫 후보 여정이고,
//     그 여정에는 이유 줄이 없다(지어내지 않는다).
//   결정 · 만남: 여정의 차례대로 present만 부른다(제품 차례). 은행에 없는 문항(찍어도 맞는 「그대로」)은 내지 않는다 — 내면 엔진이 태그 없는
//     문항으로 받아 그 계열을 새 단위로 센다.
//   떠날 때(pagehide) 답을 기다리는 제시는 answer(unanswered)로 닫는다. 키트가 먼저 건 leave가 셸의 판 닫기를 셸의 다음 차례로 미루므로 이 답이 먼저 든다.
//   옛 것 대신(§23-6): return-practice · 입구 한 줄(entryNote) · events · summary는 쓰지 않는다. 다음 여정의 이유는 recommend의 why.line이다.
//   오류는 code로만 가른다. RUN_ENDED(겉이 닫힘)면 그 판은 기록 없이 잇고, 판을 다시 정했으면(onRetired) 다음 여정에서 문을 다시 연다.
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';
import { GAME_ID, decisionMeta } from './learning.mjs?v=return-20261105';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['subway-rush'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['subway-rush']);
const UNANSWERED = Object.freeze({ correct: null, reason: 'unanswered' });

// 그 여정에 그 문항(근거로 세는 결정)이 드는가.
const holds = (journey, item) => journey.decisions.some((d) => d.assessable && decisionMeta(d).itemKey === item?.itemKey);
// 후보 여정들의 근거 결정 문항(겹치지 않게, 여정 차례대로).
function candidatesOf(journeys) {
  const seen = new Map();
  for (const journey of journeys) for (const d of journey.decisions) if (d.assessable && !seen.has(d.id)) seen.set(d.id, decisionMeta(d));
  return [...seen.values()];
}

/**
 * 기록의 길을 연다. 새 길이면 { coach: null, nextPlay }, 지금 판(문의 open이 null)이면 옛 코치 { coach: old(), nextPlay: null },
 * 문이 open을 거절하면(RUN_ENDED — 패널이 닫히는 중이거나 틀 문서가 바뀜) 옛 길을 열지 않고 { coach: null, nextPlay: null }(기록 없이 논다).
 * 그 밖의 오류도 옛 길을 열지 않는다 — 새 길로 정해진 계정에 옛 동기가 켜지지 않게.
 */
export async function openLearning({ win = globalThis.window, old = () => null } = {}) {
  let coach;
  try {
    coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  } catch (error) {
    if (!ended(error)) console.error(error);
    return { coach: null, nextPlay: null };
  }
  if (!coach) return { coach: old(), nextPlay: null };
  return { coach: null, nextPlay: createNextPlay(coach, { win, old }) };
}

/** 키트로 연 코치 하나로 여정을 기록한다. */
export function createNextPlay(coach, { win = globalThis.window, old = () => null } = {}) {
  let live = coach; // RUN_ENDED를 보거나 판을 다시 정하면 null — 그 판은 기록 없이 잇는다
  let retired = false;
  let open = null; // 답을 기다리는 제시
  const set = setPlay(coach);
  const unhear = typeof coach.onRetired === 'function' ? coach.onRetired(() => { retired = true; live = null; }) : null;
  // 코치 부르기 하나. 기록이 거절돼도 게임은 멈추지 않는다 — RUN_ENDED면 이 겉을 더 부르지 않고, 그 밖의 오류는 그 부르기만 버린다.
  const call = (fn) => {
    if (!live) return null;
    try {
      return fn(live);
    } catch (error) {
      if (ended(error)) live = null;
      return null;
    }
  };
  try {
    win?.addEventListener?.('pagehide', () => open?.cancel());
  } catch {
    // 듣지 못해도 셸이 패널을 닫을 때 판을 닫는다
  }

  return Object.freeze({
    get retired() {
      return retired;
    },
    /** 다음 여정. 돌려줌 { journey, note(이유 줄 — 게임 차례면 null), engine }. */
    pick(journeys) {
      const first = journeys[0];
      const items = candidatesOf(journeys);
      const turn = call(() => set.next(items, (list) => list.find((item) => holds(first, item)) ?? null));
      const chosen = turn?.engine ? journeys.find((j) => holds(j, turn.item)) : null;
      return { journey: chosen || first, note: chosen ? turn.why?.line ?? null : null, engine: Boolean(chosen) };
    },
    /** 결정 · 만남 하나의 기록 — 옛 createExchange와 같은 꼴(heard · help · answer · cancel). 은행에 없는 문항이면 아무것도 남기지 않는다. */
    exchange(meta) {
      const banked = call((c) => c.itemUnits(meta.itemKey).length > 0);
      const pid = banked ? call((c) => c.present(meta)) : null;
      let closed = !pid, delivered = false;
      const close = () => { closed = true; if (open === ex) open = null; };
      const ex = {
        pid,
        heard(ok) { if (closed || delivered) return null; delivered = true; return call((c) => c.delivery(pid, { audio: ok ? 'completed' : 'failed' })); },
        help(kind) { if (closed) return null; return call((c) => c.help(pid, kind)); },
        answer(payload) { if (closed) return null; close(); return call((c) => c.answer(pid, answerOf(payload))); },
        cancel() { if (closed) return null; close(); return call((c) => c.answer(pid, answerOf(UNANSWERED))); },
      };
      if (pid) open = ex;
      return ex;
    },
    /** 여정 끝 — 판을 기록 없이 닫는다. 닫지 못해도 놀이는 잇는다(셸이 패널을 닫을 때 닫는다). */
    end() {
      if (!live) return;
      try {
        set.end();
      } catch {
        // 판을 닫지 못했다 — 다음 여정의 recommend가 새 판을 연다
      }
    },
    /** 판을 다시 정해 겉이 닫힌 뒤 다음 여정에서 문을 다시 연다 — openLearning과 같은 꼴을 돌려준다. */
    renew() {
      unhear?.();
      return openLearning({ win, old });
    },
  });
}
