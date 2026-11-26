// 게임의 새 길(단계 4 계획 §23-6 · 4-6c). WORLD 셸이 연 게임 코치를 문(window.SYNKAtlasGame — synk-world-app/world-atlas-game.mjs)으로 받는다.
// 맨 위는 상수 · 함수 선언뿐이다 — 부를 때까지 아무것도 하지 않는다(꺼진 판 시험이 맨 위 문장을 본다).
// 게임 앱은 이 키트를 정적으로 부르지 않는다. 새 길 차례는 앱 안의 문 확인(play-common/atlas-gate.mjs의 atlasGate — nextDoor || devFlag와
// 같은 조건)이 보고, 키트는 새 길 모듈(atlas-next-play.mjs)이 부른다. 꺼진 판에는 실리지 않는다(5-3 게임).
// 원본은 play-common/kit/ — 게임마다 kit/에 바이트로 복사한다(build-kit.mjs). 사본은 고치지 않는다.
//   const door = nextDoor(window);            // 새 길 모듈 안에서 — 없으면 null
//   const next = await openNext({ gameId, banks });   // null이면 옛 길. RUN_ENDED로 거절하면 옛 길을 열지 않고 멈춘다
//   const set = setPlay(next, { length: 12 });         // 판 — next(후보, 게임 차례) · end()
// 오류는 셸 창의 것이라 틀에서 instanceof Error가 거짓이다 — code로만 가른다(ended(error)).

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost)$/;
// 옛 기기 흐름 열쇠(오늘 · 표시 설정) — 혼자 뜨는 길이 읽기만 한다.
const DEVICE_KEY = 'synk.atlas.learning.v1.device';
// 옛 겉의 판정 못 한 까닭 — 새 겉의 assessable: false로 넘긴다. 'skip'은 본인이 건너뛴 답이라 skipped로 옮긴다(다시 검토 GA7).
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
    // 이유 줄이 낱말 이름을 말하려면 낱말 표가 든다 — 조각이 낱말 줄을 싣지 않는 큰 은행(레이싱)도(셸과 같다).
    words: true,
    host: { guest: true, prefs: devicePrefs(win) },
    ...(label ? { label } : {}),
  });
  await coach.ready;
  return coach;
}

// 고른 후보를 게임이 넘긴 원래 후보로 되맞춘다 — 문을 거친 값은 셸 창의 사본이다(다시 검토 F2).
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

// 이유 줄은 그 판이 평가할 단위를 그 단위의 첫 평가 전에 이름으로 말하지 않는다(5-3 게임 GE1 — 설계 주인 11-26). 게임의 문항은 그 단위를
// 묻는다 — 첫 평가 전에 이름을 보이면 답을 미리 알려 주고, 그 답이 「도움 없이 맞힘」 근거로 남는다. 그 자리는 이름 없는 제품 문장이다.
// 돌아온 · 흔들리는 · 방금 놓친 단위는 GAME_NAMELESS(셸 world-today.mjs와 같은 글), 처음 만나는 단위는 이름 없는 처음 문장(몽골어는 검수 전이라
// 없음), 그 밖(다시 배우기 · 난도 · 숨 고르기 · 목표)은 줄 없음 — 게임은 기본 안내를 둔다. 평가 = 엔진이 등급을 매긴 답(grade). 판(startSet · finishSet)이
// 바뀌면 다시 센다. 감싼 코치의 recommend · live().pick 한 자리라 아홉 게임이 함께 받는다(입구의 곡 · 손님 추천처럼 판 밖 recommend도).
const GAME_NAMELESS = Object.freeze({
  ko: '게임에서 만난 말이 돌아왔어요. 잊기 전에 한 번 더 만나요.',
  en: 'Something you met in a game is back. Let’s review it once more before it fades.',
  mn: 'Тоглоомд үзсэн үг хэллэг эргэн ирлээ. Мартахаасаа өмнө дахин нэг давтъя.',
});
const FIRST_NAMELESS = Object.freeze({ ko: '새로운 말을 처음 만나요.', en: 'Meeting something new for the first time.' });
const NAMELESS = Object.freeze({ 'unit.due': GAME_NAMELESS, 'unit.shaky': GAME_NAMELESS, 'unit.retry': GAME_NAMELESS, 'unit.new': FIRST_NAMELESS });
// 줄의 언어 — 셸이 화면 언어로 지은 줄의 글자로 가른다. 단위 이름은 어느 언어 줄에서나 한국어라(‘그대로’ · «그대로» · 「그대로」) 따옴표 안을 빼고
// 본다(키릴 · 한글 · 그 밖은 영어).
const NAME_QUOTE = /「[^」]*」|‘[^’]*’|«[^»]*»|“[^”]*”/g;
const lineLang = line => {
  const rest = line.replace(NAME_QUOTE, '');
  return /[\u0400-\u04FF]/.test(rest) ? 'mn' : /[\uAC00-\uD7A3]/.test(rest) ? 'ko' : 'en';
};
// 이름 없는 자리의 줄 — 이 판에서 아직 평가하지 않은 단위를 겨눈 이유의 줄을 바꾼 것(namesGuard가 부른다). 단위 칸이나 줄이 없으면 그대로다.
export function namelessLine(why) {
  if (typeof why?.slots?.unit !== 'string' || typeof why.line !== 'string') return why?.line ?? null;
  if (why.slots.relearn) return null; // 다시 배우기(「다시 배울래요」로 비운 단위)는 처음 만나는 말이 아니다 — 줄 없음
  return NAMELESS[why.code]?.[lineLang(why.line)] ?? null;
}
function namesGuard() {
  const graded = new Set(); // 이 판에서 등급이 매겨진 단위
  const named = new Map(); // 고른 문항(itemKey) → 이유 줄이 겨눈 단위
  const shown = new Map(); // 제시(pid) → 그 단위
  return {
    picked(result) {
      const unit = result?.why?.slots?.unit;
      if (!result?.selected || typeof unit !== 'string') return result;
      if (typeof result.selected.itemKey === 'string') named.set(result.selected.itemKey, unit);
      if (graded.has(unit) || typeof result.why.line !== 'string') return result;
      return { ...result, why: { ...result.why, line: namelessLine(result.why) } };
    },
    presented(item, pid) {
      const unit = named.get(item?.itemKey);
      if (unit && pid != null) shown.set(pid, unit);
      return pid;
    },
    answered(pid, out) {
      const recorded = out && typeof out === 'object' && 'recorded' in out ? out.recorded : out; // 손잡이(live)의 답은 { recorded, … }
      if (recorded?.grade != null && shown.has(pid)) graded.add(shown.get(pid));
      return out;
    },
    reset() {
      graded.clear();
      named.clear();
      shown.clear();
    },
  };
}

// 게임이 쓰는 꼴로 감싼다 — 고른 후보 되맞춤, 손잡이(live)의 pick도 같다. 이유 줄의 이름은 namesGuard가 본다.
function wrapCoach(coach) {
  const names = namesGuard();
  const has = name => typeof coach[name] === 'function';
  const live = (...args) => {
    const handle = coach.live(...args);
    return Object.freeze({
      ...handle,
      pick: (candidates, options) => names.picked(originals(handle.pick(candidates, options), candidates)),
      ...(typeof handle.answer === 'function' ? { answer: (pid, ...rest) => names.answered(pid, handle.answer(pid, ...rest)) } : {}),
    });
  };
  return Object.freeze({
    ...Object.fromEntries(
      Object.keys(coach)
        .filter(name => typeof coach[name] === 'function')
        .map(name => [name, (...args) => coach[name](...args)]),
    ),
    recommend: (candidates, options) => names.picked(originals(coach.recommend(candidates, options), candidates)),
    ...(has('present') ? { present: (item, ...rest) => names.presented(item, coach.present(item, ...rest)) } : {}),
    ...(has('answer') ? { answer: (pid, ...rest) => names.answered(pid, coach.answer(pid, ...rest)) } : {}),
    ...(has('startSet') ? { startSet: (...args) => (names.reset(), coach.startSet(...args)) } : {}),
    ...(has('finishSet') ? { finishSet: (...args) => (names.reset(), coach.finishSet(...args)) } : {}),
    live,
  });
}

// 새 길 코치를 연다. 문이 있으면 그 겉(null이면 지금 판 — 옛 길로), 개발 깃발이면 혼자 뜨는 손님 코치, 둘 다 없으면 null.
// 문의 open이 RUN_ENDED로 거절하면 그대로 던진다 — 게임은 옛 길을 열지 않고 멈춘다(§23-2 · 다시 검토 A2).
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
// options: 판 내내 recommend에 더할 옵션(예: pool).
// next(후보, 게임 차례, more): 엔진이 고르면(ready, 또는 idle — 「다시」를 기다리는 사이의 채우기) { item, why, engine: true, idle },
// none이면 게임 차례로 고른 것을 { item, why: null, engine: false }로 준다 — 엔진의 none이 놀이를 멈추게 하지 않는다(설계 주인 11-19 밤).
// 게임 차례 문항에는 이유 줄이 없다. 게임 차례가 고를 것이 없으면 null. more는 이번 고르기에만 더하는 옵션(예: audio: false — 소리를 끈 사람).
// open(): recommend 없이 present만 하는 판(정해진 차례)이 첫 제시 전에 부른다 — 코치 startSet({ length })으로 판 길이와 새것 한도(3n)를
// 넘긴다(설계 주인 11-19 밤). 길이가 없는 판(시간으로 끝남)은 부르지 않는다. 열린 판이 있으면 코치가 새 판을 열지 않는다. 겉이 닫혔거나
// 코치에 startSet이 없으면(혼자 뜨는 길이 실은 앞 판 입구) null — 판은 첫 제시가 기본 판으로 연다.
// end(): 판 끝 · 그만두기 — 기록 없이 판을 닫는다(겉이 닫혔으면 조용히 지나간다).
const PICKED = new Set(['ready', 'idle']);
export function setPlay(coach, { length = null, options = {} } = {}) {
  const set = Number.isInteger(length) && length > 0 ? { length, newLimit: 3 * length } : {};
  return Object.freeze({
    next(candidates, gameTurn, more = {}) {
      const result = coach.recommend(candidates, { ...options, ...more, set });
      if (PICKED.has(result?.status) && result.selected)
        return {
          item: result.selected,
          why: result.why ?? null,
          engine: true,
          idle: result.status === 'idle',
        };
      const item = typeof gameTurn === 'function' ? gameTurn(candidates) : null;
      return item ? { item, why: null, engine: false } : null;
    },
    open() {
      if (!set.length || typeof coach.startSet !== 'function') return null;
      try {
        return coach.startSet({ length: set.length });
      } catch (error) {
        if (ended(error)) return null;
        throw error;
      }
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
  // 고른 보기 · 맞는 보기의 번호 — 글자나 유한한 수만 받는다(null · undefined · 참거짓이 'null' · 'true' 같은 글로 바뀌어 통과하지 않게).
  const id = value => (typeof value === 'string' || Number.isFinite(value)) && OPTION.test(String(value)) ? String(value) : null;
  const selectedId = id(old.choice?.selectedId), correctId = id(old.choice?.correctId);
  if (selectedId && correctId) out.choice = { selectedId, correctId };
  return out;
}
