// 게임 문(단계 4 계획 §23-2 · 4-6c). 셸이 게임 틀을 열 때(app-shell.mjs launchGame) 새 길 입구가 있으면 window.SYNKAtlasGame에 둔다.
// 틀의 게임(키트 kit/atlas-next.mjs)은 open({ gameId, banks })으로 셸 창의 게임 코치를 겉(facade)으로 받는다 — 판(손님 · 계정 · 지금 판)과
// 세대는 입구의 gameCoach 한 길(faceCoach · coachFor · retire)이 정한다. 코치는 셸 창의 것이라 틀이 사라져도 판 일지와 마지막 답의 저장이 남는다.
// 규칙(§23-2 · 설계 주인 조건 넷 · 설계 검토 두 차례):
//   - 문은 그 게임 하나만 받는다 — gameId는 launchGame이 연 게임, banks는 GAME_BANKS에 있는 것만.
//   - open은 지금 판이면 null(게임은 옛 길로), 새 길이면 겉. 패널이 닫히거나 틀 문서가 바뀌어 취소된 open은 null이 아니라 RUN_ENDED로
//     거절한다 — 게임은 옛 길을 열지 않고 멈춘다(다시 검토 A2).
//   - 겉은 틀 문서의 실행 번호에 묶인다. 같은 패널에서 open이 다시 오면(틀 다시 싣기) 앞 겉을 닫고 그 판을 finishSet({ record: false })로
//     닫은 뒤 새 겉을 준다. 앞 문서의 늦은 호출 · 늦게 끝난 open은 새 판을 건드리지 않는다(GA6).
//   - 틀의 pagehide(키트가 겉의 leave를 부른다)는 셸 창의 다음 차례에 겉과 판을 닫는다 — 같은 pagehide에서 게임이 떠나며 내는 마지막 답이
// 먼저 들어간다(다시 검토 F1).
//   - 판을 다시 정하면(입구의 retired) 틀에 onRetired로 알리고 겉을 닫는다. 게임은 다음 판을 열 때 open을 다시 부른다.
//   - 인수는 셸 창의 structuredClone으로 옮긴 뒤 부른다 — 옮기지 못하는 인수(함수 · DOM)는 DOOR_ARGUMENT 오류다. 닫힌 겉 · 손잡이는
//     RUN_ENDED로 던진다. 오류는 셸 창의 것이라 틀에서 instanceof Error가 거짓이다 — 게임은 code로만 가른다.
//   - 패널이 닫히면 겉을 닫고 그 판을 finishSet({ record: false })로 닫는다 — 기록부의 쓰기는 차례대로라 직전 답의 저장 뒤에 선다.
//   - 판의 한 수(§25-3 불변식 나): 겉을 지나는 답(일반 answer의 돌려줌 · 손잡이 answer의 recorded)을 겉의 한 함수(noteAnswer)가 같은 꼴로
//     받아 둔다. 판이 닫힐 때(겉의 finishSet · 같은 패널의 다시 open · 패널 닫힘과 틀이 떠남) 입구의 판 끝 함수(entry.ended)를 한 번 부른다 —
//     센 첫 답의 형식(countedModalities)과 그 판의 다시 접기(finishSet의 folded)를 싣는다. 판을 다시 정해 닫힌 겉(retired)은 부르지 않는다.
// 겉에 주지 않는 것: dispose · reset · tell · guestRecords · clearPractice류(셸 · 「나」의 일).

// 게임마다 받는 은행(지도 index.json의 bank). 열쇠 앞마디로 미루지 않는다 — 레이싱 · 낱말 마법 · 초급 주문(§23-0).
export const GAME_BANKS = Object.freeze({
  'blank-slice': Object.freeze(['blank-slice']),
  'entry-check': Object.freeze(['entry-check']),
  'korean-racing': Object.freeze(['korean-racing']),
  'korean-rhythm': Object.freeze(['korean-rhythm']),
  'korean-runner': Object.freeze(['korean-runner']),
  'order-rush': Object.freeze(['order-rush', 'order-rush-beginner']),
  'story-classroom': Object.freeze(['story-classroom']),
  'subway-rush': Object.freeze(['subway-rush']),
  'talk-rally': Object.freeze(['talk-rally']),
  'word-magic': Object.freeze(['word-magic']),
  'snap-words': Object.freeze(['snap-words']),
  // 한글 만나기(4-7 — 단계 4 계획 §26-3). 문이 서도 한글 앱이 새 길 모듈로 문을 찾기 전까지는 옛 길 그대로다(게임 세션 몫).
  'hangul-stage': Object.freeze(['hangul-stage']),
});

const COACH_METHODS = Object.freeze([
  'recommend',
  'present',
  'help',
  'delivery',
  'answer',
  'exposure',
  'exposures',
  'summary',
  'due',
  'itemUnits',
  'startSet',
  'finishSet',
  'today',
  'presentation',
]);
const LIVE_METHODS = Object.freeze([
  'settings',
  'intro',
  'level',
  'pick',
  'present',
  'answer',
  'observe',
  'stuck',
  'offerLessHelp',
  'acceptLessHelp',
  'declineLessHelp',
  'floor',
  'end',
  'trace',
]);

// 게임 코치가 읽는 오늘 · 표시 설정 · 옛 내용 기억(코치 host.prefs — §23-4 (나)). 바꾸기는 지금처럼 WORLD 화면 · 옛 길이 한다.
//   today: 이 기기의 옛 흐름 열쇠(그 기기의 하루 안 값만). presentation: 셸의 학습 설정(education.presentation — 도움 · 설명 방식).
//   seed: 손님만 — 이 기기의 옛 손님 내용 기억(읽기만). 계정의 옛 내용 기억은 옛 학습 호스트(드라마 묶음)를 고쳐야 읽히므로 씨앗 없이 연다
//   (설계 주인 11-19 조건).
const DEVICE_FLOW = 'synk.atlas.learning.v1.device';
// 엔진의 순간 맞춤 내용 기억 열쇠 앞마디(packages/atlas/src/coach/flow-memory.mjs FLOW_MEMORY_PREFIX와 같다 — 시험이 견준다). 입구의 앞 판 쓸기와
// 세대 쓸기가 쓴다.
export const FLOW_MEMORY_PREFIX = 'synk.atlas.next.flow.';
// 엔진 내용 기억의 비운 세대 표지 열쇠 뒷마디(flow-memory.mjs FLOW_CLEARED_SUFFIX와 같다 — 시험이 견준다). 입구의 세대 쓸기는 이 열쇠를 남긴다 —
// 비운 것을 모르는 탭을 막는 것이 이 표지다(§25-3 · 4c 20beea9ed).
export const FLOW_CLEARED_SUFFIX = '#cleared';
const localDay = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function readJson(storage, name) {
  try {
    const raw = storage?.getItem(name);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function gamePrefs({ storage, presentation = () => null, now = () => new Date() }) {
  return Object.freeze({
    today: () => {
      const value = readJson(storage, `${DEVICE_FLOW}.today`);
      return value?.day === localDay(now()) ? value.condition : null;
    },
    presentation: () => {
      const value = presentation();
      return value && Object.keys(value).length ? value : null;
    },
    seed: () => readJson(storage, `${DEVICE_FLOW}.flow`),
  });
}

const coded = (code, message) => Object.assign(new Error(`Atlas game door: ${message}`), { code });
const ended = () => coded('RUN_ENDED', '이 판의 겉은 닫혔다');

// 셸 창으로 옮긴 인수 — 옮기지 못하면(함수 · DOM) 조용히 빼지 않고 코드가 있는 오류로 던진다(설계 주인 조건 ③).
function moved(args) {
  try {
    return structuredClone(args);
  } catch (error) {
    throw Object.assign(coded('DOOR_ARGUMENT', '셸로 옮기지 못하는 인수다'), { cause: error });
  }
}

// 닫히면 RUN_ENDED로 던지는 함수 묶음. after[name](돌려줌, 옮긴 인수) — 부른 뒤 겉이 볼 것(판의 한 수 · 판 끝).
function guarded(target, names, isOpen, after = {}) {
  const out = {};
  for (const name of names) {
    if (typeof target?.[name] !== 'function') continue;
    out[name] = (...args) => {
      if (!isOpen()) throw ended();
      const given = moved(args);
      const result = target[name](...given);
      after[name]?.(result, given);
      return result;
    };
  }
  return out;
}

// 판정된 답(§25-3 불변식 나 — 맞음 · 틀림). 건너뜀(skipped) · 판정 못 함(unassessed) · 「모르겠어요」(unknown)는 세지 않는다(옛 길의 「처음 낸 답」과 같다).
const JUDGED = new Set(['correct', 'incorrect']);
// 판의 한 수 — 이 판에서 겉을 지난 답(answers: [{ pid, recorded }])의 센 첫 답 형식들(이름 차례). 센 첫 답은 제시마다 판정이 맞음 · 틀림이고
// 저장 뒤 evidence가 「기록됨 · 전달됨」(stored · delivered)인 첫 답이다 — 판정 못 한 첫 답 뒤의 첫 판정 답도 센다. 형식(modality)과 전달은
// 코치가 돌려준 값이다 — 게임이 넘긴 modality · audioRequired는 읽지 않는다(셋째 판 확인 N2). 전달은 엔진이 기록부에 든 사건으로 정한다(가림은
// 보지 않는다 — 바람길 지시 문항처럼 가려진 답을 빼면 옛 길보다 적게 센다). 코치가 형식이나 evidence를 돌려주지 않는 엔진 판이면 null —
// 판을 적지 않는다(지금과 같다).
export async function countedModalities(answers) {
  const list = Array.isArray(answers) ? answers : [];
  if (list.some(({ recorded }) => typeof recorded?.modality !== 'string' || typeof recorded?.evidence?.then !== 'function')) return null;
  const counted = new Set();
  const kinds = new Set();
  for (const { pid, recorded } of list) {
    if (counted.has(pid) || !JUDGED.has(recorded.verdict)) continue;
    let evidence = null;
    try {
      evidence = await recorded.evidence;
    } catch {
      evidence = null;
    }
    if (evidence?.stored !== true || evidence?.delivered !== true) continue;
    counted.add(pid);
    kinds.add(recorded.modality);
  }
  return [...kinds].sort();
}

// 겉 하나 — 그 틀 문서의 실행 하나. close()는 다시 부를 수 없게 막고, 손잡이(live)도 같은 규칙으로 감싼다(설계 주인 조건 ①).
// noteAnswer(pid, recorded): 겉을 지난 답 — 일반 길은 돌려줌 그대로, 손잡이 길은 돌려줌의 recorded를 같은 꼴로 넘긴다. touch(): 제시 · 도움 ·
// 전달 · 판 열기 · 관찰(이 판에 무언가 있었다). finished(folded): 게임이 판을 닫았다(finishSet).
function makeFacade(coach, { leave, onRetired, noteAnswer, touch, finished }) {
  let open = true;
  const isOpen = () => open;
  const touched = Object.fromEntries(['present', 'help', 'delivery', 'startSet', 'observe'].map(name => [name, () => touch()]));
  const live = (...args) => {
    if (!open) throw ended();
    const handle = coach.live(...moved(args));
    return Object.freeze({
      spec: handle.spec,
      ...guarded(handle, LIVE_METHODS, isOpen, {
        ...touched,
        answer: (result, [pid]) => noteAnswer(pid, result?.recorded),
      }),
    });
  };
  const api = Object.freeze({
    ...guarded(coach, COACH_METHODS, isOpen, {
      ...touched,
      answer: (result, [pid]) => noteAnswer(pid, result),
      finishSet: result => finished(result?.folded ?? null),
    }),
    live,
    // 틀이 떠난다(pagehide) — 셸 창의 다음 차례에 겉과 판을 닫는다.
    leave,
    // 판을 다시 정해 겉이 닫힐 때 부를 함수. 돌려준 함수로 끊는다.
    onRetired,
    get closed() {
      return !open;
    },
  });
  return {
    api,
    close() {
      open = false;
    },
    get open() {
      return open;
    },
  };
}

// 문 여럿이 셸의 같은 코치를 받을 수 있다 — 셸은 판 · 은행 조합마다 코치를 다시 쓰므로 패널을 닫고 다시 연 같은 게임의 문은 앞 문과 같은
// 코치를 받는다. 코치마다 앉힌 겉의 수를 세어, 다른 문이 앉혀 쓰는 코치의 판은 닫지 않는다(끝 판 GD1).
const holders = new WeakMap();
const hold = (coach, by) => {
  const count = Math.max(0, (holders.get(coach) ?? 0) + by);
  holders.set(coach, count);
  return count;
};
// 코치 → 다음 차례에 닫기로 한 앞 겉의 닫기들. 다른 문이 같은 코치를 앉히기 전에 먼저 닫는다 — 미룬 닫기가 돌기 전에 새 문이 앉으면 앞 판이
// 닫히지 않고 새 틀에 넘어갔다(다시 보기 C2). 새 틀이 문을 열 때는 앞 틀이 이미 내려가 그 마지막 답도 들어 있다.
const retiring = new WeakMap();

// entry: 입구(gameCoach(gameId, banks) · retired(coach, fn) · ended(coach, end)). gameId: launchGame이 연 게임.
//   ended(coach, { gameId, counted, folded }) — 판이 닫힐 때 한 번: counted는 센 첫 답 형식들의 약속(countedModalities — 엔진 판에 형식 ·
//   전달 칸이 없으면 null로 풀린다), folded는 그 판의 다시 접기(코치 finishSet의 folded — 판을 닫지 못했으면 null)다.
// later(fn): 셸 창의 다음 차례 — 시험만 바꾼다.
export function createGameDoor({ entry, gameId, later = fn => setTimeout(fn, 0) }) {
  const allowed = new Set(GAME_BANKS[gameId] ?? []);
  let closed = false;
  let runs = 0;
  let current = null; // { coach, facade, run, stopRetired, listeners, answers, touched }

  // 그 코치의 판을 기록 없이 닫는다 — 그 판의 다시 접기(folded)를 돌려준다. 던져도(이미 닫은 코치 — 판을 다시 정함) 문은 그대로 간다(null).
  function endSet(coach) {
    try {
      return coach.finishSet({ record: false })?.folded ?? null;
    } catch {
      return null; // 닫을 판이 없다
    }
  }
  // 그 겉의 판이 닫혔다 — 이 판에 무언가 있었으면(제시 · 답 · 도움 · 전달 · 판 열기) 입구의 판 끝 함수를 한 번 부르고 판의 답을 비운다. 센 첫
  // 답이 없어도 부른다 — 답 없이 문항만 보고 닫은 판도 셸이 묶음 만남을 다시 묻게(§25-3).
  function closeSet(slot, folded) {
    if (!slot.touched) return;
    const answers = slot.answers;
    slot.answers = [];
    slot.touched = false;
    try {
      entry.ended?.(slot.coach, { gameId, counted: countedModalities(answers), folded: folded ?? null });
    } catch {
      // 입구의 실패는 문을 막지 않는다 — 그 판을 세지 못할 뿐이다
    }
  }
  // 지금 겉을 닫고 그 판을 닫는다 — 코치의 판은 그 코치를 앉혀 쓰는 다른 문이 없을 때만 닫는다. 판 끝은 이 겉의 판으로 알린다.
  function retireCurrent() {
    const slot = current;
    current = null;
    if (!slot) return;
    slot.facade.close();
    slot.stopRetired?.();
    closeSet(slot, hold(slot.coach, -1) === 0 ? endSet(slot.coach) : null);
  }

  // 그 겉을 셸 창의 다음 차례에 닫는다 — 그 전에 다른 문이 같은 코치를 앉히면 그때 닫는다(위 retiring).
  function retireLater(slot) {
    const finish = () => {
      retiring.get(slot.coach)?.delete(finish);
      if (current === slot) retireCurrent();
    };
    if (!retiring.has(slot.coach)) retiring.set(slot.coach, new Set());
    retiring.get(slot.coach).add(finish);
    later(finish);
  }

  // 틀이 넘긴 은행 목록을 먼저 셸 창의 사본으로 옮기고 그 사본을 본다 — 본 목록과 입구에 넘기는 목록이 같다(끝 판 GD6).
  function checkAsk(asked, banks) {
    if (asked !== gameId) throw coded('DOOR_GAME', `이 문은 ${gameId}만 받는다`);
    const list = Array.isArray(banks) ? Array.from(banks) : null;
    if (!list?.length || list.some(bank => typeof bank !== 'string' || !allowed.has(bank)))
      throw coded('DOOR_BANK', `${gameId}의 은행이 아니다`);
    return list;
  }

  function seat(coach, run) {
    const listeners = new Set();
    const slot = { coach, run, listeners, stopRetired: null, facade: null, retired: null, answers: [], touched: false };
    const tell = (fn, detail) => {
      try {
        fn(detail);
      } catch {
        // 틀의 정리는 문을 막지 않는다
      }
    };
    slot.facade = makeFacade(coach, {
      // 판의 한 수 — 겉을 지난 답을 같은 꼴(코치가 돌려준 recorded)로 받아 둔다.
      noteAnswer: (pid, recorded) => {
        slot.touched = true;
        slot.answers.push({ pid, recorded });
      },
      touch: () => {
        slot.touched = true;
      },
      finished: folded => closeSet(slot, folded),
      leave: () => retireLater(slot),
      // 겉을 받은 틀이 듣개를 걸기 전에 판을 다시 정했으면(받은 뒤 await 사이) 건 때 다음 차례로 알린다(끝 판 D1).
      onRetired: fn => {
        if (typeof fn !== 'function') return () => {};
        if (slot.retired) {
          let live = true;
          later(() => {
            if (live) tell(fn, slot.retired);
          });
          return () => {
            live = false;
          };
        }
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    });
    for (const finish of [...(retiring.get(coach) ?? [])]) finish();
    current = slot;
    hold(coach, 1);
    // 판을 다시 정했다 — 틀에 알리고 겉을 닫는다(코치는 입구가 닫는다 — finishSet은 부르지 않는다). 그 판의 답은 적지 않는다(§25-3).
    slot.stopRetired = entry.retired?.(coach, detail => {
      if (current !== slot) return;
      current = null;
      hold(coach, -1);
      slot.answers = [];
      slot.touched = false;
      slot.retired = { reason: detail?.reason ?? 'retired' };
      slot.facade.close();
      for (const fn of [...listeners]) tell(fn, slot.retired);
      listeners.clear();
    });
    return slot.facade.api;
  }

  async function open({ gameId: asked, banks } = {}) {
    if (closed) throw ended();
    const list = checkAsk(asked, banks);
    runs += 1;
    const run = runs;
    retireCurrent(); // 같은 패널의 다시 open — 앞 문서의 겉을 닫고 그 판을 닫는다
    const coach = await entry.gameCoach(gameId, list.sort());
    // 기다리는 사이 패널이 닫혔거나 틀 문서가 바뀌었다 — 겉을 주지 않고 RUN_ENDED(다시 검토 A2). 받은 코치의 판은 닫는다 — 같은
    // 코치를 이 문이나 다른 문(다시 연 패널)이 앉혀 쓰고 있으면 건드리지 않는다(끝 판 GD1).
    if (closed || run !== runs) {
      if (coach && !holders.get(coach)) endSet(coach);
      throw ended();
    }
    return coach ? seat(coach, run) : null;
  }

  return Object.freeze({
    api: Object.freeze({ open }),
    // 패널이 닫힌다(attachPanelResource) — 문을 치우고(새 open은 바로 RUN_ENDED) 겉과 판은 셸 창의 다음 차례에 닫는다. 셸은 틀을 내리기
    // 전에 이것을 부르므로, 틀이 내려가며(pagehide) 내는 마지막 답이 겉 닫기보다 먼저 든다(끝 판 GD5 — 키트의 leave와 같은 차례).
    dispose() {
      if (closed) return;
      closed = true;
      if (current) retireLater(current);
    },
    get closed() {
      return closed;
    },
  });
}
