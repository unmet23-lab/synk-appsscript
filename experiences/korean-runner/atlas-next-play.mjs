// 바람길의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 판 · 고르기 · 답 · 도움 · 전달 · 순간 맞춤을 잇는다.
// 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.mjs는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   달리기    90초 판(set: {} — 시간으로 끝난다). 달리기 부탁은 장면을 보고도 할 수 있는 동작 답이라(늘 판정하지 않음) 엔진에 묻지 않고
//             게임 차례로 present만 한다 — 동작 답이 session.blank로 후보를 태워 none이 되던 것을 막는다(카본 A2 · 설계 주인 11-19 밤).
//             게임 차례는 아직 못 들어 본 부탁 먼저, 그다음 원고 차례다(exposures — 만남 사실만 읽는다). 놓친 부탁은 두 부탁 뒤 다시 낸다
//             (core.mjs 게임 규칙 — 새 제시). 답은 판정하지 않는 동작 답(answerOf — reason visual · motor), 끝까지 못 간 부탁은 unanswered.
//             판 끝 · 그만두기에 기록 없이 닫는다(run().end).
//   듣기 확인 3문항 판(set.length 3 · 새것 한도 9 — 키트 setPlay). 문항마다 recommend, 엔진이 고른 문항(ready · idle)의 이유는 why.line이다.
//             엔진이 none이면 게임 차례(아직 못 들어 본 확인 먼저, 이 판에 아직 없는 듣기 꼴 먼저, 그다음 원고 차례)로 present만 하고 이유 줄을
//             두지 않는다. 뒤 답은 없다(답한 뒤 다시 듣기는 복습 — 기록하지 않는다, listening-check.mjs).
//   순간 맞춤 달리기 속도(live) · 오늘(today). 부탁의 결과는 그 부탁의 제시 번호와 함께 observe한다 — 한 제시가 Flow를 한 번만 움직인다.
//   옛 것 대신(§23-6) return-practice(missedCheck) · 소리가 실패한 확인 다시 열기(events) · recheck · 옛 요약(skillReport · runReason) ·
//             기록 지우기 · syncPort는 새 길에서 쓰지 않는다(엔진의 판정 못 한 답 · 「다시」가 맡는다).
//   오류      문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫히면(RUN_ENDED) 그 판은 기록 없이 잇고, 판을 다시 정했으면(onRetired)
//             다음 판을 열 때 app.mjs가 문을 다시 연다(stale).
import { INSTRUCTIONS } from './instructions.mjs';
import { instructionMetadata } from './learning.mjs';
import { LISTENING_CHECKS, checkMetadata } from './listening-check.mjs';
import { SKILL_LABEL } from './report.mjs?v=runner-next-way-20261104';
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';

export const GAME_ID = 'korean-runner';
// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['korean-runner'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['korean-runner']);
export const CHECK_LENGTH = 3;
// 기록이 남지 않은 확인 답(겉이 닫혔거나 제시가 없다) — 화면은 「듣기 기록에는 넣지 않았어요」로 말한다(listening-check-ui.mjs).
const UNRECORDED = Object.freeze({ verdict: 'unassessed', eventId: null });

const quietly = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};

// 새 길 코치를 연다. 문이 없고 개발 깃발도 없거나 셸이 지금 판이라고 하면 null(옛 길). RUN_ENDED는 그대로 던진다 — 옛 길을 열지 않는다.
export async function openRunner({ win = globalThis.window } = {}) {
  const coach = await openNext({
    win,
    gameId: GAME_ID,
    banks: [...BANKS],
    // 혼자 뜨는 길(개발 깃발)의 능력 이름 — 셸이 넘기는 표 대신 이 게임의 이름(단위 이름은 지도 조각이 안다).
    label: id => SKILL_LABEL[id] ?? null,
  });
  return coach ? createRunner(coach) : null;
}

// 게임 차례로 줄 세운다 — 아직 못 들어 본 것(만남 false) 먼저, 그다음 원고 차례. seen[i]가 null(모름)이면 들어 본 것과 같이 둔다.
export function freshFirst(items, seen) {
  return [...items.filter((_, i) => seen[i] === false), ...items.filter((_, i) => seen[i] !== false)];
}

// coach: 키트가 감싼 게임 겉(openNext의 값).
export function createRunner(coach) {
  let live = coach; // RUN_ENDED를 보거나 판을 다시 정하면 null — 그 판은 기록 없이 잇는다
  let retired = false;
  quietly(() =>
    coach.onRetired?.(() => {
      retired = true;
      live = null;
    }),
  );
  // 코치 부르기 하나. 기록이 거절돼도 놀이는 멈추지 않는다 — RUN_ENDED면 이 겉을 더 부르지 않고, 그 밖의 오류는 그 부르기만 버린다.
  const call = fn => {
    if (!live) return null;
    try {
      return fn(live);
    } catch (error) {
      if (ended(error)) live = null;
      return null;
    }
  };
  // 은행에 없는 문항(지도 밖)은 내지 않는다 — 내면 엔진이 태그 없는 문항으로 받아 그 계열을 새 단위로 센다.
  const banked = new Map();
  const inBank = item => {
    const key = item?.itemKey;
    if (typeof key !== 'string') return false;
    if (!banked.has(key)) {
      const units = call(c => c.itemUnits(key));
      if (!units) return false;
      banked.set(key, units.length > 0);
    }
    return banked.get(key);
  };
  // 문항마다 만남(seen) — 읽지 못하면 모두 모름(null).
  const seenOf = list => {
    const rows = call(c => c.exposures(list));
    return list.map((_, i) => rows?.[i]?.seen ?? null);
  };

  // learning.mjs · listening-check.mjs · app.mjs가 쓰는 옛 겉의 꼴. 답은 answerOf로 옮기고, 부르지 못하면 기록 없이 지나간다.
  const facade = Object.freeze({
    present: item => (inBank(item) ? call(c => c.present(item)) : null),
    delivery: (pid, delivered) => (pid ? call(c => c.delivery(pid, delivered)) : null),
    help: (pid, kind) => (pid ? call(c => c.help(pid, kind)) : null),
    answer: (pid, old) =>
      (pid ? call(c => c.answer(pid, answerOf(old))) : null) ?? { ...UNRECORDED, correct: old?.correct ?? null },
    today: () => call(c => c.today()),
    live: (content, options) => call(c => c.live(content, options)),
    summary: () => call(c => c.summary()),
  });

  // 달리기 한 판 — 엔진에 묻지 않는다. instruction(후보)는 RunnerModel의 chooseInstruction(이 판에 아직 안 나온 부탁 가운데 게임 차례의 첫째).
  function run() {
    const order = freshFirst(INSTRUCTIONS, seenOf(INSTRUCTIONS.map(instructionMetadata))).map(item => item.id);
    const set = setPlay(coach);
    let closed = false;
    return Object.freeze({
      order,
      instruction: candidates => order.map(id => candidates.find(item => item.id === id)).find(Boolean) ?? candidates[0] ?? null,
      // 판 끝 · 그만두기 — 기록 없이 닫는다(겉이 닫혔으면 조용히 지나간다).
      end() {
        if (closed) return;
        closed = true;
        quietly(() => set.end());
      },
    });
  }

  // 듣기 확인 한 판 — listening-check-ui.mjs의 판 꼴(total · next() → { status, item, note, index, total, followup }).
  function checks() {
    const set = setPlay(coach, { length: CHECK_LENGTH });
    const total = Math.min(CHECK_LENGTH, LISTENING_CHECKS.length);
    const byKey = new Map(LISTENING_CHECKS.map(item => [checkMetadata(item).itemKey, item]));
    const used = [];
    const kinds = [];
    let closed = false;
    // 게임 차례 — 아직 못 들어 본 확인 먼저, 이 판에 아직 없는 듣기 꼴(세부 · 부정 · 순서) 먼저, 그다음 원고 차례.
    const gameTurn = list => {
      const seen = seenOf(list);
      const shapes = new Set(used.map(item => checkMetadata(item).skillId));
      const rank = (row, i) => (seen[i] === false ? 0 : 2) + (shapes.has(row.skillId) ? 1 : 0);
      return list.reduce((best, row, i) => (best == null || rank(row, i) < best.rank ? { row, rank: rank(row, i) } : best), null)?.row ?? null;
    };
    return Object.freeze({
      total,
      kinds: () => [...kinds],
      next() {
        if (used.length >= total) return { status: 'finished', item: null };
        // 후보는 자료만(문을 지난다) — 이 판에 아직 안 낸 확인.
        const list = LISTENING_CHECKS.filter(item => !used.includes(item)).map(item => ({ ...checkMetadata(item), checkId: item.id }));
        let got = null;
        if (live) {
          try {
            got = set.next(list, gameTurn);
          } catch (error) {
            // 겉이 닫혔거나(RUN_ENDED) 고르기가 실패했다 — 기록 없이 게임 차례로 잇는다.
            if (ended(error)) live = null;
          }
        }
        if (!got) {
          const row = gameTurn(list);
          got = row ? { item: row, why: null, engine: false } : null;
        }
        const item = got ? byKey.get(got.item?.itemKey) : null;
        if (!item) return { status: 'unavailable', item: null, note: '' };
        used.push(item);
        kinds.push(got.engine ? (got.idle ? 'idle' : 'engine') : 'game');
        return {
          status: 'ready',
          item,
          note: got.engine ? (got.why?.line ?? '') : '',
          engine: got.engine,
          idle: got.idle === true,
          followup: null,
          index: used.length - 1,
          total,
        };
      },
      // 판 끝 · 닫기 — 기록 없이 닫는다(낸 문항이 있을 때 한 번).
      end() {
        if (closed || !used.length) return;
        closed = true;
        quietly(() => set.end());
      },
    });
  }

  return Object.freeze({
    coach: facade,
    // 겉이 닫혔다(판을 다시 정함 · RUN_ENDED) — 다음 판을 열 때 문을 다시 연다.
    get stale() {
      return retired || !live;
    },
    get retired() {
      return retired;
    },
    run,
    checks,
    // 부탁의 결과를 순간 맞춤에 — 그 부탁의 제시 번호와 함께(제시가 있는 관찰, §23-4). 부탁 밖의 장애물은 제시 없이.
    observe: (flow, observation, pid = null) => flow.observe(observation, pid ?? null),
  });
}
