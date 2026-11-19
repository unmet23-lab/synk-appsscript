// 게임 문(단계 4 계획 §23-2 · 4-6c). 셸이 게임 틀을 열 때(app-shell.mjs launchGame) 새 길 입구가 있으면 window.SYNKAtlasGame에 둔다.
// 틀의 게임(키트 kit/atlas-next.mjs)은 open({ gameId, banks })으로 셸 창의 게임 코치를 겉(facade)으로 받는다 — 판(손님 · 계정 · 지금 판)과
// 세대는 입구의 gameCoach 한 길(faceCoach · coachFor · retire)이 정한다. 코치는 셸 창의 것이라 틀이 사라져도 판 일지와 마지막 답의 저장이 남는다.
// 규칙(§23-2 · 설계 주인 조건 넷 · 설계 검토 두 차례):
//   - 문은 그 게임 하나만 받는다 — gameId는 launchGame이 연 게임, banks는 GAME_BANKS에 있는 것만.
//   - open은 지금 판이면 null(게임은 옛 길로), 새 길이면 겉. 패널이 닫히거나 틀 문서가 바뀌어 취소된 open은 null이 아니라 RUN_ENDED로
//     거절한다 — 게임은 옛 길을 열지 않고 멈춘다(카본 다시 검토 A2).
//   - 겉은 틀 문서의 실행 번호에 묶인다. 같은 패널에서 open이 다시 오면(틀 다시 싣기) 앞 겉을 닫고 그 판을 finishSet({ record: false })로
//     닫은 뒤 새 겉을 준다. 앞 문서의 늦은 호출 · 늦게 끝난 open은 새 판을 건드리지 않는다(GA6).
//   - 틀의 pagehide(키트가 겉의 leave를 부른다)는 셸 창의 다음 차례에 겉과 판을 닫는다 — 같은 pagehide에서 게임이 떠나며 내는 마지막 답이
// 먼저 들어간다(다시 검토 F1).
//   - 판을 다시 정하면(입구의 retired) 틀에 onRetired로 알리고 겉을 닫는다. 게임은 다음 판을 열 때 open을 다시 부른다.
//   - 인수는 셸 창의 structuredClone으로 옮긴 뒤 부른다 — 옮기지 못하는 인수(함수 · DOM)는 DOOR_ARGUMENT 오류다. 닫힌 겉 · 손잡이는
//     RUN_ENDED로 던진다. 오류는 셸 창의 것이라 틀에서 instanceof Error가 거짓이다 — 게임은 code로만 가른다.
//   - 패널이 닫히면 겉을 닫고 그 판을 finishSet({ record: false })로 닫는다 — 기록부의 쓰기는 차례대로라 직전 답의 저장 뒤에 선다.
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
// 엔진의 순간 맞춤 내용 기억 열쇠 앞마디(packages/atlas/src/coach/flow-memory.mjs FLOW_MEMORY_PREFIX와 같다 — 시험이 견준다). 입구의 앞 판 쓸기가 쓴다.
export const FLOW_MEMORY_PREFIX = 'synk.atlas.next.flow.';
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

// 닫히면 RUN_ENDED로 던지는 함수 묶음.
function guarded(target, names, isOpen, wrapResult = {}) {
  const out = {};
  for (const name of names) {
    if (typeof target?.[name] !== 'function') continue;
    out[name] = (...args) => {
      if (!isOpen()) throw ended();
      const result = target[name](...moved(args));
      return wrapResult[name] ? wrapResult[name](result) : result;
    };
  }
  return out;
}

// 겉 하나 — 그 틀 문서의 실행 하나. close()는 다시 부를 수 없게 막고, 손잡이(live)도 같은 규칙으로 감싼다(설계 주인 조건 ①).
function makeFacade(coach, { leave, onRetired }) {
  let open = true;
  const isOpen = () => open;
  const live = (...args) => {
    if (!open) throw ended();
    const handle = coach.live(...moved(args));
    return Object.freeze({ spec: handle.spec, ...guarded(handle, LIVE_METHODS, isOpen) });
  };
  const api = Object.freeze({
    ...guarded(coach, COACH_METHODS, isOpen),
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

// entry: 입구(gameCoach(gameId, banks) · retired(coach, fn)). gameId: launchGame이 연 게임.
// later(fn): 셸 창의 다음 차례 — 시험만 바꾼다.
export function createGameDoor({ entry, gameId, later = fn => setTimeout(fn, 0) }) {
  const allowed = new Set(GAME_BANKS[gameId] ?? []);
  let closed = false;
  let runs = 0;
  let current = null; // { coach, facade, run, stopRetired, listeners }

  // 그 코치의 판을 기록 없이 닫는다. 던져도(이미 닫은 코치 — 판을 다시 정함) 문은 그대로 간다.
  function endSet(coach) {
    try {
      coach.finishSet({ record: false });
    } catch {
      // 닫을 판이 없다
    }
  }
  // 지금 겉을 닫고 그 판을 닫는다.
  function retireCurrent() {
    const slot = current;
    current = null;
    if (!slot) return;
    slot.facade.close();
    slot.stopRetired?.();
    endSet(slot.coach);
  }

  function checkAsk(asked, banks) {
    if (asked !== gameId) throw coded('DOOR_GAME', `이 문은 ${gameId}만 받는다`);
    if (!Array.isArray(banks) || !banks.length || banks.some(bank => !allowed.has(bank)))
      throw coded('DOOR_BANK', `${gameId}의 은행이 아니다`);
  }

  function seat(coach, run) {
    const listeners = new Set();
    const slot = { coach, run, listeners, stopRetired: null, facade: null };
    slot.facade = makeFacade(coach, {
      leave: () =>
        later(() => {
          if (current === slot) retireCurrent();
        }),
      onRetired: fn => {
        if (typeof fn !== 'function') return () => {};
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    });
    // 판을 다시 정했다 — 틀에 알리고 겉을 닫는다(코치는 입구가 닫는다 — finishSet은 부르지 않는다).
    slot.stopRetired = entry.retired?.(coach, detail => {
      if (current !== slot) return;
      current = null;
      slot.facade.close();
      for (const fn of [...listeners])
        try {
          fn({ reason: detail?.reason ?? 'retired' });
        } catch {
          // 틀의 정리는 문을 막지 않는다
        }
    });
    current = slot;
    return slot.facade.api;
  }

  async function open({ gameId: asked, banks } = {}) {
    if (closed) throw ended();
    checkAsk(asked, banks);
    runs += 1;
    const run = runs;
    retireCurrent(); // 같은 패널의 다시 open — 앞 문서의 겉을 닫고 그 판을 닫는다
    const coach = await entry.gameCoach(gameId, [...banks].sort());
    // 기다리는 사이 패널이 닫혔거나 틀 문서가 바뀌었다 — 겉을 주지 않고 RUN_ENDED(카본 다시 검토 A2). 받은 코치의 판은 닫는다 — 같은
    // 코치를 새 문서가 이미 받아 판을 열었으면 건드리지 않는다(셸은 판 · 은행 조합마다 코치를 다시 쓴다).
    if (closed || run !== runs) {
      if (coach && current?.coach !== coach) endSet(coach);
      throw ended();
    }
    return coach ? seat(coach, run) : null;
  }

  return Object.freeze({
    api: Object.freeze({ open }),
    // 패널이 닫힌다(attachPanelResource) — 문을 치우고 겉과 판을 닫는다.
    dispose() {
      closed = true;
      retireCurrent();
    },
    get closed() {
      return closed;
    },
  });
}
