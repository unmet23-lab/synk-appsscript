// 게임의 새 길(단계 4 계획 §23-6 · 4-6c). WORLD 셸이 연 게임 코치를 문(window.SYNKAtlasGame — synk-world-app/world-atlas-game.mjs)으로 받는다.
// 맨 위는 상수 · 함수 선언뿐이다 — 꺼진 판에도 실리고, 부를 때까지 아무것도 하지 않는다(꺼진 판 시험이 맨 위 문장을 본다).
// 원본은 play-common/kit/ — 게임마다 kit/에 바이트로 복사한다(build-kit.mjs). 사본은 고치지 않는다.
//   const door = nextDoor(window);            // 없으면 지금 코드 그대로 옛 코치를 동기로 만든다
//   const next = await openNext({ gameId, banks });   // null이면 옛 길. RUN_ENDED로 거절하면 옛 길을 열지 않고 멈춘다
//   const set = setPlay(next, { length: 12 });         // 판 — next(후보, 게임 차례) · end()
// 오류는 셸 창의 것이라 틀에서 instanceof Error가 거짓이다 — code로만 가른다(ended(error)).

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;
// 옛 기기 흐름 열쇠(오늘 · 표시 설정) — 혼자 뜨는 길이 읽기만 한다.
const DEVICE_KEY = 'synk.atlas.learning.v1.device';
// 옛 겉의 판정 못 한 까닭 — 새 겉의 assessable: false로 넘긴다. 'skip'은 본인이 건너뛴 답이라 skipped로 옮긴다(GPT 다시 검토 GA7).
const UNJUDGED = new Set(['motor', 'visual', 'unanswered', 'audio', 'demo', 'storage']);
const OPTION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

// 문을 거친 게임 코치가 닫혔거나(RUN_ENDED) 판이 끝났다 — 게임은 기록 없이 이어 간다.
export function ended(error) {
  return error?.code === 'RUN_ENDED';
}

// 같은 출처 위 창(부모 · 맨 위)의 게임 문. 없거나 다른 출처면 null.
export function nextDoor(win = globalThis.window) {
  for (const up of [win?.parent, win?.top]) {
    if (!up || up === win) continue;
    try {
      const door = up.SYNKAtlasGame;
      if (door && typeof door.open === 'function') return door;
    } catch {
      // 다른 출처 — 문이 없다
    }
  }
  return null;
}

// 개발 깃발(혼자 뜨는 길 — §23-6): 로컬 주소에서만 ?atlas=next를 받는다. 위 창에 옛 학습 호스트가 있으면(계정 과제 · 교사 앱 틀) 깃발이
// 있어도 옛 길이다.
export function devFlag(win = globalThis.window) {
  try {
    if (!LOCAL_HOST.test(win.location.hostname)) return false;
    if (new URLSearchParams(win.location.search).get('atlas') !== 'next') return false;
    return !(win.parent && win.parent !== win && win.parent.SYNKLearningHost);
  } catch {
    return false;
  }
}

function readDevice(storage, name) {
  try {
    const raw = storage?.getItem(`${DEVICE_KEY}.${name}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 혼자 뜨는 길의 오늘 · 표시 설정 — 옛 기기 흐름 열쇠를 읽기만 한다(오늘은 그 기기의 하루 안의 값만).
function devicePrefs(win) {
  let storage = null;
  try {
    storage = win.localStorage;
  } catch {
    storage = null;
  }
  const localDay = date =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    today: () => {
      const value = readDevice(storage, 'today');
      return value?.day === localDay(new Date()) ? value.condition : null;
    },
    presentation: () => readDevice(storage, 'presentation')?.presentation ?? null,
    seed: () => readDevice(storage, 'flow'),
  };
}

// 혼자 뜨는 길 — 입구(/atlas/loader.js)를 싣고 손님 코치를 연다.
async function soloCoach(win, { gameId, banks, label }) {
  const loaded = await import('/atlas/loader.js');
  const SynkAtlas = loaded?.SynkAtlas ?? win.SynkAtlas;
  const coach = SynkAtlas.coach({
    gameId,
    banks,
    host: { guest: true, prefs: devicePrefs(win) },
    ...(label ? { label } : {}),
  });
  await coach.ready;
  return coach;
}

// 고른 후보를 게임이 넘긴 원래 후보로 되맞춘다 — 문을 거친 값은 셸 창의 사본이다(Fable 5.2 다시 검토 F2).
function originals(result, candidates) {
  if (!result?.selected) return result;
  const byKey = new Map((candidates ?? []).map(candidate => [candidate?.itemKey, candidate]));
  const back = candidate => byKey.get(candidate?.itemKey) ?? candidate;
  return {
    ...result,
    selected: back(result.selected),
    ...(Array.isArray(result.alternatives) ? { alternatives: result.alternatives.map(back) } : {}),
  };
}

// 게임이 쓰는 꼴로 감싼다 — 고른 후보 되맞춤, 손잡이(live)의 pick도 같다.
function wrapCoach(coach) {
  const live = (...args) => {
    const handle = coach.live(...args);
    return Object.freeze({
      ...handle,
      pick: (candidates, options) => originals(handle.pick(candidates, options), candidates),
    });
  };
  return Object.freeze({
    ...Object.fromEntries(
      Object.keys(coach)
        .filter(name => typeof coach[name] === 'function')
        .map(name => [name, (...args) => coach[name](...args)]),
    ),
    recommend: (candidates, options) => originals(coach.recommend(candidates, options), candidates),
    live,
  });
}

// 새 길 코치를 연다. 문이 있으면 그 겉(null이면 지금 판 — 옛 길로), 개발 깃발이면 혼자 뜨는 손님 코치, 둘 다 없으면 null.
// 문의 open이 RUN_ENDED로 거절하면 그대로 던진다 — 게임은 옛 길을 열지 않고 멈춘다(§23-2 · 카본 다시 검토 A2).
// 문을 거친 겉은 틀이 떠날 때(pagehide) 셸에 알린다 — 셸이 다음 차례에 판을 닫는다(같은 pagehide의 마지막 답이 먼저).
export async function openNext({ win = globalThis.window, gameId, banks, label = null } = {}) {
  const door = nextDoor(win);
  if (door) {
    const facade = await door.open({ gameId, banks });
    if (!facade) return null;
    try {
      win.addEventListener?.('pagehide', () => facade.leave?.(), { once: true });
    } catch {
      // 듣지 못해도 패널 닫기가 판을 닫는다
    }
    return wrapCoach(facade);
  }
  if (!devFlag(win)) return null;
  return wrapCoach(await soloCoach(win, { gameId, banks, label }));
}

// 판 하나(§23-6 「판」). length가 정해진 판은 새것 한도를 4-1과 같은 3n으로 넘기고, 시간으로 끝나는 판은 set: {}(길이 모름)이다.
// next(후보, 게임 차례): 엔진이 고르면 { item, why, engine: true }, none이면 게임 차례로 고른 것을 { item, why: null, engine: false }로 준다 —
// 엔진의 none이 놀이를 멈추게 하지 않는다(설계 주인 11-19 밤). 게임 차례 문항에는 이유 줄이 없다. 게임 차례가 고를 것이 없으면 null.
// end(): 판 끝 · 그만두기 — 기록 없이 판을 닫는다(겉이 닫혔으면 조용히 지나간다).
export function setPlay(coach, { length = null } = {}) {
  const set = Number.isInteger(length) && length > 0 ? { length, newLimit: 3 * length } : {};
  return Object.freeze({
    next(candidates, gameTurn) {
      const result = coach.recommend(candidates, { set });
      if (result?.status === 'ready' && result.selected)
        return { item: result.selected, why: result.why ?? null, engine: true };
      const item = typeof gameTurn === 'function' ? gameTurn(candidates) : null;
      return item ? { item, why: null, engine: false } : null;
    },
    end() {
      try {
        coach.finishSet({ record: false });
      } catch (error) {
        if (!ended(error)) throw error;
      }
    },
  });
}

// 옛 겉의 답을 새 겉의 꼴로 옮긴다. 화면 값(correct)은 그대로, 판정 못 한 까닭은 assessable: false, 본인이 건너뛴 답(reason 'skip')은
// correct: null · assessable: true(skipped).
export function answerOf(old = {}) {
  if (old.reason === 'skip') return { correct: null, assessable: true };
  if (UNJUDGED.has(old.reason) || old.assessable === false)
    return { correct: null, assessable: false, ...(UNJUDGED.has(old.reason) ? { reason: old.reason } : {}) };
  const out = { correct: old.correct ?? null, assessable: true };
  if (old.unknown === true) out.unknown = true;
  if (Number.isInteger(old.attemptNo)) out.attemptNo = old.attemptNo;
  const choice = old.choice;
  if (choice && OPTION.test(String(choice.selectedId)) && OPTION.test(String(choice.correctId)))
    out.choice = { selectedId: String(choice.selectedId), correctId: String(choice.correctId) };
  return out;
}
