// 낱말 마법(말의 마법사)의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7).
// WORLD 밖(학습 허브 · LAB)에서 열리는 게임이라 4-6에서는 로컬 개발 깃발(?atlas=next — 키트 devFlag)로 혼자 뜨는 손님 코치를 받는다. 위 창에
// 게임 문(window.SYNKAtlasGame)이 있으면 같은 키트 길(openNext)로 그 겉을 받는다.
// app.mjs는 문이나 개발 깃발이 있을 때만 이 파일을 동적으로 싣는다 — 꺼진 판은 이 파일을 싣지 않고 옛 코치(learning.mjs MagicLearning)를 지금처럼 만든다.
//   판      장마다 소리 확인 둘이 판 하나다. 차례는 지금처럼 게임이 정한다(core.mjs checkpointRound) — recommend 없이 present만 한다(제품 차례).
//           판의 첫 제시 바로 앞에서 키트 setPlay의 open()으로 판 길이 2(새것 한도 6)를 코치 startSet에 넘긴다(설계 주인 11-19 밤).
//           코치에 startSet이 없으면(지금 엔진) 첫 제시가 코치의 기본 판을 연다. 이어 하기로 둘째 확인부터 내도 판을 열 때는 모르니
//           상한 2로 연다. 둘째 확인 뒤 · 그만둘 때 기록 없이 닫는다(키트 setPlay의 end).
//   답      옛 겉(MagicLearning)과 같은 꼴이다 — 첫 고르기만 답으로 보낸다. 틀린 뒤 다시 고르기는 게임 규칙이라 코치에 보내지 않는다(뒤 답 없음).
//           답하기 전에 떠나면 옛 길은 reason 'skip'을 보내는데, 키트 answerOf가 skipped(correct null · assessable true)로 옮긴다(GPT 다시 검토 GA7).
//   회상 판  기록하지 않는다(app.mjs가 부르지 않는다).
//   은행    지도에 없는 문항은 내지 않는다(itemUnits가 비면) — 내면 엔진이 태그 없는 문항으로 받아 새 단위로 센다.
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫혔거나(RUN_ENDED) 판을 다시 정하면(onRetired) 이번 판은 기록 없이 잇고,
//           그 판이 끝나면(stale) app.mjs가 다음 판 앞에서 openMagic을 다시 부른다.
// 이 게임은 옛 return-practice · 옛 요약 · 기록 지우기 · syncPort를 원래 쓰지 않는다. live도 쓰지 않는다.
import { GAME_ID, checkpointMetadata } from './learning.mjs';
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['word-magic'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['word-magic']);
// 판 하나 — 장마다 소리 확인 둘(core.mjs checkpointRound).
export const SET_LENGTH = 2;
// 답하기 전에 떠남 — 옛 겉(MagicLearning abandon)이 보내던 답 그대로. answerOf가 skipped로 옮긴다.
const LEFT = Object.freeze({ correct: false, assessable: false, reason: 'skip' });

const quietly = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};

/**
 * 기록의 길을 연다. 새 길이면 이 파일의 겉(createMagic), 셸이 지금 판이라고 하면(문의 open이 null · 문도 깃발도 없음) old()(옛 코치),
 * 열지 못하면 null — 문이 open을 거절했거나(RUN_ENDED — 패널이 닫히는 중이거나 틀 문서가 바뀜) 다른 오류여도 옛 길을 열지 않는다(§23-2).
 */
export async function openMagic({ win = globalThis.window, old = () => null } = {}) {
  let coach;
  try {
    coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  } catch (error) {
    if (!ended(error)) console.error(error);
    return null;
  }
  return coach ? createMagic(coach) : old();
}

/**
 * 키트로 연 코치(openNext의 값) 하나로 소리 확인을 기록한다. 옛 겉(MagicLearning)과 같은 메서드라 app.mjs 본문은 그대로 부른다.
 *   present(check) · delivery(ok) · help(kind) · answer(correct) · abandon(keep) — keep이 참이면 같은 장의 다음 확인이 바로 이어진다(판을 닫지 않는다).
 *   stale — 판을 다시 정했거나 겉이 닫혔고 이번 판도 끝났다. app.mjs가 다음 판 앞에서 문을 다시 연다.
 */
export function createMagic(coach) {
  let live = coach; // RUN_ENDED를 보거나 판을 다시 정하면 null — 그 판은 기록 없이 잇는다
  let retired = false;
  let set = null; // { chapter, count, opened, play }
  let id = null;
  let heard = false;
  let answered = false;
  const stop = () => {
    live = null;
    retired = true;
  };
  quietly(() => coach.onRetired?.(stop));
  // 코치 부르기 하나. 기록이 거절돼도 놀이는 멈추지 않는다 — RUN_ENDED면 이 겉을 더 부르지 않고, 그 밖의 오류는 그 부르기만 버린다.
  const call = fn => {
    if (!live) return null;
    try {
      return fn(live);
    } catch (error) {
      if (ended(error)) stop();
      return null;
    }
  };
  // 판을 기록 없이 닫는다. 겉이 닫혔으면 셸 코치에 닿지 않는다.
  function endSet() {
    const was = set;
    set = null;
    if (was) call(() => was.play.end());
  }

  return Object.freeze({
    get stale() {
      return retired && !set;
    },
    present(check) {
      const meta = checkpointMetadata(check);
      // 새 판 — 판이 없거나, 다른 장이거나, 이 판에서 이미 둘을 냈다.
      if (!set || set.chapter !== check.chapter || set.count >= SET_LENGTH) {
        endSet();
        set = { chapter: check.chapter, count: 0, opened: false, play: setPlay(coach, { length: SET_LENGTH }) };
      }
      set.count += 1;
      const banked = call(c => c.itemUnits(meta.itemKey).length > 0);
      // 판의 첫 제시 앞에서 한 번 판 길이를 넘긴다. 지도에 없는 문항만 낸 판은 열지 않는다. 거절돼도 제시는 기본 판으로 간다.
      if (banked && !set.opened) {
        set.opened = true;
        call(() => set.play.open());
      }
      id = banked ? call(c => c.present(meta)) : null;
      heard = false;
      answered = false;
      return id;
    },
    delivery(ok) {
      if (heard) return;
      if (id) call(c => c.delivery(id, { audio: ok ? 'completed' : 'failed' }));
      if (ok) heard = true;
    },
    help(kind) {
      if (id) call(c => c.help(id, kind));
    },
    // 첫 고르기만 — 다시 고르기는 코치에 보내지 않는다.
    answer(correct) {
      if (!id || answered) return null;
      answered = true;
      return call(c =>
        c.answer(id, answerOf({ correct, assessable: heard, reason: heard ? undefined : 'audio' })),
      );
    },
    abandon(keep = false) {
      if (id && !answered) call(c => c.answer(id, answerOf(LEFT)));
      id = null;
      answered = false;
      heard = false;
      if (!keep) endSet();
    },
  });
}
