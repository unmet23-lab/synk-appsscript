// 레이싱의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 판 · 고르기 · 답 · 도움 · 전달 · 순간 맞춤을 잇는다.
// 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.js는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   판      관문 다섯(코스 하나)이 판 하나다. 맞춤 판(나에게 맞는 5문항)만 관문마다 recommend를 부른다(set.length 5 · 새것 한도 15 — 키트
//           setPlay). 관문을 세울 때(앞 관문의 답을 본 뒤) 고르고, 후보는 문장 도전 문항 가운데 이 판에 아직 안 나온 것이다(결승 문항은
//           맞춤에 쓰지 않는다 — 옛 판과 같다). ?learning= 영역이 있으면 그 영역의 문항만 후보다.
//           문장 도전 · 결승 · 어휘 · 복습 · 오늘의 미션 코스는 정해진 차례라 recommend 없이 present만 한다. 이 판과 시연 · 조작 연습 판은
//           판을 열 때(첫 제시 전) 판 길이(관문 수 — 조작 연습은 1)를 코치 startSet으로 넘긴다(키트 setPlay open() · 새것 한도 3n).
//   게임 차례  엔진이 none이면 게임 순서(게임이 권하는 코스의 문항, 그다음 코스 차례)에서 후보에 든 첫 문항을 present만 한다. 이유 줄은 없다.
//           idle(채우기)은 엔진이 고른 문항이다(키트 setPlay).
//   시연 · 조작 연습  기록은 지금처럼 도움 판이다(제시 뒤 곧 도움 answer, 답 없음). 시연은 맞춤 판이어도 엔진에 묻지 않는다.
//   답      옛 답 꼴(race-controller.js judgeGate)을 키트 answerOf로 옮긴다. 관문마다 답은 한 번이다(뒤 답 없음). 결과 화면이 읽는 도움 여부 ·
//           독립 응답은 엔진의 판정과 같은 규칙(처음 만남 · 도움 없음 · 소리 전달 · 판정된 답)으로 이 제시에서 바로 센다.
//   순간 맞춤  달리는 속도(live — FLOW_RACE). 새 길에서 문항 단계(items)는 손잡이가 아니다 — Flow는 낸 문항의 난도를 관찰만 하고(level()은
//           null), 문항은 두뇌가 고른다(pick = recommend). 한 제시는 Flow를 한 번만 움직인다(엔진).
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫혔거나(RUN_ENDED) 끝난 제시(PRESENTATION_GONE)면 기록 없이 잇는다.
//           판을 다시 정하면(onRetired) 이번 판은 기록 없이 잇고, 다음 판을 열 때 reopen()이 문을 다시 연다.
// 옛 판 안 후속 바꿔 넣기 · recheck · 로컬 복습(놓친 문제 바로 연습) · 옛 요약 여섯 상태 · events · 기록 지우기 · syncPort는 새 길에서
// 쓰지 않는다(§23-6 「옛 것 대신」).
import { recommendedStage } from './campaign.js';
import { WORD_BY_ID, makeQuestions } from './learning.js';
import { RACING_CANDIDATES, racingItem } from './personalization.js';
import { answerOf, ended, nextDoor, openNext, setPlay } from './kit/atlas-next.mjs';

export const GAME_ID = 'korean-racing';
// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['korean-racing'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['korean-racing']);
export const PERSONAL_SIZE = 5;
// 관문 앞에 한 줄로 알리는 이유 — 다시 만나는 문항(방금 놓침 · 흔들림 · 돌아옴). 처음 만나는 문항은 관문마다 말하지 않는다.
export const GATE_REASONS = Object.freeze(['unit.retry', 'unit.shaky', 'unit.due']);
const GONE = 'PRESENTATION_GONE';
const JUDGED = new Set(['correct', 'incorrect']);
const SKILL_NAMES = Object.freeze({
  detail: '세부 내용',
  negation: '부정 표현',
  condition: '조건 표현',
  reason: '이유',
  main: '중심 내용',
  sequence: '순서',
  grammar: '문법',
  word: '어휘',
});

const quietly = fn => {
  try {
    return fn();
  } catch {
    return null;
  }
};

// 혼자 뜨는 길(개발 깃발)의 이름 표 — 낱말 단위는 이 게임의 낱말(은행 조각에 낱말 줄이 실리지 않는다), 능력은 영역 · 갈래.
// 셸이 연 코치는 셸이 넘기는 표와 낱말 표(words.json)를 쓴다.
export function raceLabel(id) {
  const word = /^ko\.word\.(w\d{4})$/.exec(String(id ?? ''));
  if (word) return WORD_BY_ID[word[1]]?.word ?? null;
  const skill = /^ko\.(listening|reading)\.([a-z]+)$/.exec(String(id ?? ''));
  return skill && SKILL_NAMES[skill[2]]
    ? `${skill[1] === 'reading' ? '읽기' : '듣기'} · ${SKILL_NAMES[skill[2]]}`
    : null;
}

// 게임 순서 — 게임이 권하는 코스(아직 통과하지 못한, 또는 가장 덜 익숙한 문장 도전 코스)의 문항, 그다음 코스 차례.
// modality가 있으면 그 영역의 문항만.
export function gameOrder(progress, modality = null) {
  const lead = recommendedStage(progress ?? { stages: {} })?.items ?? [];
  const seen = new Set();
  const order = [];
  for (const question of [...lead, ...RACING_CANDIDATES.map(candidate => candidate.item)]) {
    if (seen.has(question.id)) continue;
    seen.add(question.id);
    if (!modality || racingItem(question).modality === modality) order.push(question);
  }
  return order;
}

// 맞춤 판(나에게 맞는 5문항)의 코스 — 입구 · 결과가 그리는 꼴은 옛 판과 같다. 문항 자리는 게임 순서로 채워 두고(시연은 이대로 달린다),
// 달릴 때 관문마다 다시 고른다. 놓친 문제를 첫 자리에 두는 옛 길(lead)은 없다. 엔진에 묻지 않는다.
export function personalStage({ progress = null, modality = null, size = PERSONAL_SIZE } = {}) {
  const items = gameOrder(progress, modality).slice(0, size);
  if (!items.length) return null;
  return {
    reason: '다섯 관문의 문항은 달리는 동안 하나씩 골라요.',
    stage: {
      id: 'personalized',
      title: '나에게 맞는 5문항',
      campaign: true,
      review: true,
      personalized: true,
      chapter: 1,
      level: 1,
      scene: 'bloom',
      mode: 'mixed',
      skill: '기록에 맞춘 듣기·읽기',
      words: [],
      items,
      modality,
    },
  };
}

// 문(또는 혼자 뜨는 길)으로 연 겉 하나와 그 상태 — 판을 다시 정함(retired) · 겉이 닫힘(closed) · 다시 열기(reopen).
function connect(first, win) {
  const state = { coach: null, retired: false, closed: false, reopening: null };
  const seat = coach => {
    state.coach = coach;
    state.retired = false;
    quietly(() =>
      coach.onRetired?.(() => {
        if (state.coach === coach) state.retired = true;
      }),
    );
  };
  seat(first);

  async function reopen() {
    if (state.closed) return 'ended';
    if (!state.retired) return 'next';
    // 문이 치워졌다(패널이 닫힘) — 옛 길로 가지 않고 기록 없이 잇는다.
    if (!nextDoor(win)) {
      state.closed = true;
      return 'ended';
    }
    try {
      const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS], label: raceLabel });
      if (!coach) return 'old';
      seat(coach);
      return 'next';
    } catch {
      state.closed = true; // RUN_ENDED(패널이 닫힘 · 틀 문서가 바뀜)든 다른 실패든 옛 길을 열지 않는다
      return 'ended';
    }
  }

  return {
    state,
    get open() {
      return !state.retired && !state.closed;
    },
    reopen() {
      state.reopening ??= reopen().finally(() => {
        state.reopening = null;
      });
      return state.reopening;
    },
    // 겉에 한 번. 닫혔거나 판을 다시 정한 뒤면 부르지 않고, RUN_ENDED · PRESENTATION_GONE이면 fallback(기록 없이 잇는다).
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

/**
 * 키트로 연 겉 하나로 레이싱을 기록한다. app.js는 coach를 옛 코치 자리에 두고 learn((c) => …)으로 부른다.
 *   coach   summary · live · present · help · delivery · answer — 옛 겉과 같은 꼴(답은 answerOf로 옮기고 assisted · independent를 얹는다).
 *   personal({ progress, modality }) — 맞춤 판의 코스(personalStage).
 *   begin(코스, { demo, tutorial, progress, audio, random }) — 판 하나. at(i): i번째 관문의 문제(맞춤 판만 — 그때 고른다, 아니면 null) ·
 *           line(문제 id): 관문 앞 이유 한 줄 · kinds(): 관문마다 engine · game · end(): 기록 없이 닫기(finishSet({ record: false })).
 *   retired · reopen(): 판을 다시 정한 뒤 다음 판에서 — 'next' 새 겉 · 'old' 지금 판(옛 길) · 'ended' 기록 없이.
 */
export function createRace(first, { win = globalThis.window, hosted = false } = {}) {
  const line = connect(first, win);
  const banked = new Map(); // itemKey → 은행에 있나
  const shown = new Map(); // 제시 번호 → { audioRequired, met, helped, audio, answered }
  // setPlay에 넘기는 코치 — 판을 다시 정해 다시 연 겉으로도 간다. startSet은 지금 겉에 있을 때만 있다(없으면 키트 open()이 null).
  const seat = {
    recommend: (candidates, options) => line.state.coach.recommend(candidates, options),
    get startSet() {
      const coach = line.state.coach;
      return typeof coach?.startSet === 'function' ? options => coach.startSet(options) : undefined;
    },
    finishSet: options => line.state.coach.finishSet(options),
  };

  // 은행에 없는 문항(지도 밖)은 내지 않는다 — 내면 엔진이 태그 없는 새 단위로 세어 하루 새것 한도를 깎는다.
  const inBank = (c, meta) => {
    if (!banked.has(meta.itemKey)) banked.set(meta.itemKey, c.itemUnits(meta.itemKey).length > 0);
    return banked.get(meta.itemKey);
  };
  // 제시 하나(코치 present 또는 순간 맞춤 겉 present). 처음 만남(met)은 내기 전에 본다 — 엔진의 독립 응답 규칙과 같은 때.
  function presented(meta, via) {
    return line.call(null, c => {
      if (!inBank(c, meta)) return null;
      const met = quietly(() => c.exposure(meta)?.met) ?? null;
      const pid = via(c, meta);
      if (pid)
        shown.set(pid, {
          audioRequired: meta.audioRequired === true,
          met,
          helped: false,
          audio: null,
          answered: false,
        });
      return pid;
    });
  }
  // 답 뒤 — 결과 화면이 읽는 도움 여부 · 독립 응답(처음 만남 · 도움 없음 · 소리 전달 · 판정된 답)을 얹는다. 던지지 않는다.
  function settled(pid, recorded) {
    const seen = shown.get(pid);
    if (!recorded) return recorded;
    if (!seen) return { ...recorded, assisted: null, independent: false };
    seen.answered = true;
    const heard = !seen.audioRequired || seen.audio === 'completed';
    return {
      ...recorded,
      assisted: seen.helped,
      independent: JUDGED.has(recorded.verdict) && !seen.helped && seen.met === false && heard,
    };
  }

  // 순간 맞춤 겉. 제시 · 답은 코치와 같은 규칙(은행 · 닫힘 · 끝난 제시)으로 가고, 그 밖의 메서드는 닫힌 겉이면 RUN_ENDED를 던진다
  // (app.js가 받아 순간 맞춤만 끈다).
  function liveOf(spec, options) {
    const handle = line.call(null, c => c.live(spec, options));
    if (!handle) return null;
    const still = { recorded: null, change: null, settings: null, line: null };
    return Object.freeze({
      spec: handle.spec,
      settings: () => handle.settings(),
      intro: () => handle.intro(),
      level: () => handle.level(),
      end: () => handle.end(),
      trace: () => handle.trace(),
      observe: (input, pid = null) => handle.observe(input, pid),
      present: meta => presented(meta, (_c, item) => handle.present(item)),
      // 기록 먼저(코치의 답), 같은 응답이 속도를 움직인다 — 한 제시에 한 번(엔진). 닫혔거나 끝난 제시면 기록 없이 { recorded: null }.
      answer(pid, old, flow) {
        if (pid == null) return still;
        const response = answerOf(old);
        const out = line.call(null, () => handle.answer(pid, response, flow));
        return out ? { ...out, recorded: settled(pid, out.recorded ?? null) } : still;
      },
    });
  }

  const coach = Object.freeze({
    summary: () => line.call(null, c => c.summary()),
    live: (spec, options) => liveOf(spec, options),
    present: meta => presented(meta, (c, item) => c.present(item)),
    help(pid, kind) {
      if (pid == null) return null;
      const event = line.call(null, c => c.help(pid, kind));
      const seen = shown.get(pid);
      if (event && seen && !seen.answered) seen.helped = true;
      return event;
    },
    delivery(pid, delivered) {
      if (pid == null) return null;
      const event = line.call(null, c => c.delivery(pid, delivered));
      const seen = shown.get(pid);
      if (event && seen && !seen.answered) seen.audio = delivered?.audio ?? null;
      return event;
    },
    answer(pid, old) {
      if (pid == null) return null;
      const response = answerOf(old);
      return settled(pid, line.call(null, c => c.answer(pid, response)));
    },
  });

  // 판 하나. 맞춤 판은 관문마다 고르고, 그 밖의 판(정해진 차례 · 시연 · 조작 연습)은 고르지 않는다.
  // 앞 판은 부른 쪽이 먼저 end()로 닫는다(app.js beginPlan) — 열린 판이 있으면 코치가 새 판을 열지 않는다.
  function begin(stage, { demo = false, tutorial = false, progress = null, audio = () => true, random = Math.random } = {}) {
    const personal = Boolean(stage?.personalized) && !demo && !tutorial;
    // 판 길이 = 이 판의 제시 수. 관문마다 한 번 내고(판 안 후속 바꿔 넣기 없음) 관문 수는 코스의 문항 수다(복습은 1~5) · 조작 연습은 하나.
    const size = tutorial ? 1 : Math.max(1, stage?.items?.length || stage?.words?.length || PERSONAL_SIZE);
    const set = setPlay(seat, { length: size });
    // recommend 없이 present만 하는 판은 지금(첫 제시 전) 판 길이를 넘긴다. 겉이 닫혔거나 startSet이 없으면 첫 제시가 기본 판으로 연다 —
    // 놀이는 그대로 간다.
    if (!personal && line.open) quietly(() => set.open());
    const order = personal ? gameOrder(progress, stage.modality ?? null) : [];
    const picked = []; // { question, kind, line }
    let closed = false;

    // 게임 차례 — 후보 목록은 게임 순서대로라 맨 앞이 그 차례다.
    const gameTurn = list => list[0] ?? null;
    function pick() {
      const used = new Set(picked.map(one => one.question.id));
      const rest = order.filter(question => !used.has(question.id));
      if (!rest.length) return null;
      const list = rest.map(question => racingItem(question));
      let got = null;
      if (line.open)
        try {
          got = set.next(list, gameTurn, { audio: audio() !== false });
        } catch (error) {
          if (ended(error)) line.state.closed = true; // 겉이 닫혔다 — 기록 없이 게임 차례로 잇는다
          got = null;
        }
      if (!got) {
        const row = gameTurn(list);
        got = row ? { item: row, why: null, engine: false } : null;
      }
      const source = got ? rest.find(question => question.id === got.item?.id) : null;
      if (!source) return null;
      const engine = got.engine === true;
      const question = makeQuestions({ campaign: true, items: [source] }, random)[0];
      picked.push({
        question,
        kind: engine ? 'engine' : 'game',
        line: engine && GATE_REASONS.includes(got.why?.code) ? (got.why.line ?? null) : null,
      });
      return question;
    }

    return Object.freeze({
      personal,
      size,
      at(index) {
        if (!personal || closed) return null;
        if (index < picked.length) return picked[index].question;
        if (index !== picked.length || picked.length >= size) return null;
        return pick();
      },
      line: id => picked.find(one => one.question.id === id)?.line ?? null,
      kinds: () => picked.map(one => one.kind),
      end() {
        if (closed) return;
        closed = true;
        if (line.open) quietly(() => set.end());
      },
    });
  }

  return Object.freeze({
    coach,
    hosted,
    get retired() {
      return line.state.retired && !line.state.closed;
    },
    reopen: () => line.reopen(),
    personal: ({ progress = null, modality = null } = {}) => personalStage({ progress, modality }),
    begin,
  });
}

// 새 길을 연다 — 문이 없고 개발 깃발도 없거나 셸이 지금 판이라고 하면 null(옛 길). 문의 open이 RUN_ENDED로 거절하면 그대로 던진다
// (게임은 옛 길을 열지 않는다). 계정 코치로 문을 거쳤을 때만 「WORLD 계정에 이어진다」(hosted) — 손님 코치는 이 브라우저의 손님 기록이다.
export async function openRace({ win = globalThis.window } = {}) {
  const viaDoor = nextDoor(win) != null;
  const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS], label: raceLabel });
  if (!coach) return null;
  const hosted = viaDoor && quietly(() => coach.summary()?.storage?.guest === false) === true;
  return createRace(coach, { win, hosted });
}
