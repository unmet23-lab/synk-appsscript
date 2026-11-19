// 찰칵 낱말의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 부탁 · 인화 · 약한 낱말을 잇는다. 겉은 learning.mjs createLearning과
// 같은 꼴이라 app.mjs는 옛 길과 같은 자리에서 부른다. 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.mjs는 이 파일을 싣지 않는다.
//   판      장소 한 판(부탁 4 이하 · 인화 3 이하)이 판 하나다. recommend를 부르지 않는 정해진 차례 판이라, 첫 부탁 전에(begin) 판 길이를
//           코치 startSet({ length })으로 넘긴다(키트 setPlay().open() — 새것 한도 3n). 길이 = 부탁 수 + 인화 상한(RECALL_PER_ROUND) —
//           인화 수는 부탁을 찍은 뒤에야 정해진다. 코치에 startSet이 없으면 판은 첫 제시가 연다(코치의 기본 판).
//           판 끝(인화 뒤)과 입구로 나가기에 기록 없이 닫는다(finishSet({ record: false })).
//   고르기  약한 낱말 = 이 장소에서 부탁 정답이 될 수 있는 낱말(뜻 · 소리 · 낱말 부탁 — 안내문 빼고) 가운데 그 문항의 단위가 돌아왔거나(due())
//           끈질긴(summary().units의 stubborn) 것. 돌아온 단위가 먼저(due()의 차례 — 떠올릴 확률이 낮은 것부터), 그다음 끈질긴 단위.
//           부탁의 꼴 · 차례는 게임(core.mjs pickMissions)이 정한다.
//   게임 차례  부탁 · 인화는 present만 한다(제품 차례 — 이유 줄이 없다). 인화는 이름 없는 카드 먼저(core.mjs makeRecall).
//   뒤 답    부탁은 맞힐 때까지 같은 제시에 답한다(attemptNo 1, 2, …). 코치는 둘째부터를 기록만 하고 두뇌 판 상태는 첫 판정 답만
//           움직인다(§23-5). 입구로 나가면 답하지 않은 부탁을 다음 차례 번호로 unanswered 답한다.
//   그 밖    소리 전달은 제시마다 한 번(답을 기다리는 동안만). 은행에 없는 문항은 내지 않는다. 순간 맞춤(live) · 오늘은 쓰지 않는다.
//   옛 것 대신(§23-6): 옛 추천의 focusSkillId · alternatives(약한 낱말)는 due() · summary().units로 바뀐다.
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. RUN_ENDED(겉이 닫힘)면 그 판은 기록 없이 잇고, 판을 다시 정했으면(onRetired)
//           다음 판에서 문을 다시 연다(renew).
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';
import { RECALL_PER_ROUND } from './core.mjs';
import { GAME_ID, createLearning, itemMetadata, missionMetadata, recallMetadata } from './learning.mjs';
import { wordOf } from './words.mjs';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['snap-words'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['snap-words']);
// 약한 낱말 수 — 옛 길(learning.mjs weak)과 같다.
const WEAK_COUNT = 2;

const quietly = (fn) => { try { return fn(); } catch { return null; } };
// 기록 없이 노는 겉(옛 겉과 같은 꼴, 코치 없음).
const offline = () => createLearning(() => null);
const choiceOf = (selectedId, correctId) => ({ selectedId: String(selectedId), correctId: String(correctId) });

/** 이 장소에서 부탁 정답이 될 수 있는 낱말과 그 부탁 문항 — pickMissions의 뜻 · 소리 · 낱말 부탁(안내문 빼고). */
export function missionItems(place) {
  const out = [];
  for (const group of Object.values(place.groups)) {
    if (group.noMission || group.notice) continue;
    for (const word of group.pool) {
      if (wordOf(word)?.ask) out.push({ word, meta: itemMetadata('meaning', word) });
      if (wordOf(word)?.voice) out.push({ word, meta: itemMetadata('sound', word) });
    }
  }
  for (const thing of place.things) out.push({ word: thing.word, meta: itemMetadata('word', thing.word) });
  return out;
}

/** 장소 한 판의 제시 수 — 부탁 수 + 인화 상한(인화 수는 부탁을 찍은 뒤에 정해진다 — core.mjs makeRecall). */
export const roundLength = (missions) => missions.length + RECALL_PER_ROUND;

// 급한 단위의 차례: 돌아온 단위(due()의 차례), 그다음 끈질긴 단위(떠올릴 확률이 낮은 것부터).
function urgentUnits(coach) {
  const due = coach.due().map((row) => row.unit);
  const stubborn = (coach.summary()?.units ?? [])
    .filter((row) => row.stubborn === true)
    .sort((a, b) => (a.recall ?? 1) - (b.recall ?? 1))
    .map((row) => row.unit);
  return [...new Set([...due, ...stubborn])];
}

/**
 * 기록의 길을 연다 — 돌려주는 값은 늘 createLearning과 같은 꼴이다. 새 길이면 새 코치의 겉, 셸이 지금 판이라고 하면(open이 null) old()(옛 코치),
 * 문이 open을 거절하면(RUN_ENDED — 패널이 닫히는 중이거나 틀 문서가 바뀜) 옛 길을 열지 않고 기록 없이 노는 겉이다. 그 밖의 실패도 옛 길을
 * 열지 않는다 — 새 길로 정해진 계정에 옛 동기가 켜지지 않게.
 */
export async function openLearning({ win = globalThis.window, old = offline } = {}) {
  let coach;
  try {
    coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  } catch (error) {
    if (!ended(error)) console.error(error);
    return offline();
  }
  return coach ? createNextLearning(coach, { win, old }) : old();
}

/** 키트로 연 코치 하나로 판을 기록한다. coach: 키트가 감싼 게임 겉(openNext의 값). */
export function createNextLearning(coach, { win = globalThis.window, old = offline } = {}) {
  let live = coach; // RUN_ENDED를 보거나 판을 다시 정하면 null — 그 판은 기록 없이 잇는다
  let retired = false;
  let opened = false; // 이 판이 코치에 열려 있다(startSet이 열었거나 낸 제시가 있다) — 판 끝 · 나가기에 닫는다
  const open = new Map(); // 답을 기다리는 부탁: 제시 번호 → 기록된 답의 수
  const heard = new Set(); // 소리 전달을 남긴 제시
  const unhear = quietly(() => coach.onRetired?.(() => { retired = true; live = null; }));
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
  // 은행에 있는 문항만 낸다 — 없는 문항을 내면 엔진이 태그 없는 문항으로 받아 새 단위로 센다.
  const show = (meta) => {
    if (call((c) => c.itemUnits(meta.itemKey).length > 0) !== true) return null;
    const pid = call((c) => c.present(meta)) ?? null;
    if (pid) opened = true;
    return pid;
  };
  // 답 하나 — 옛 답 꼴을 키트로 옮긴다. 차례 번호는 이 제시에 기록된 답의 다음이다(게임의 tries + 1과 같고, 기록이 거절된 답은 세지 않는다).
  const reply = (pid, payload, attemptNo) => call((c) => c.answer(pid, { ...answerOf(payload), attemptNo }));
  // 판 끝 · 그만두기 — 기록 없이 닫는다(겉이 닫혔으면 조용히 지나간다).
  function end() {
    open.clear();
    heard.clear();
    if (!opened) return;
    opened = false;
    call((c) => c.finishSet({ record: false }));
  }

  return Object.freeze({
    available: () => Boolean(live),
    get retired() {
      return retired;
    },
    /** 약한 낱말 몇 개 — 그 낱말의 부탁 문항 단위가 돌아왔거나 끈질기다. 없으면 빈 목록(그때는 앨범 차례대로 고른다). */
    weak(place, count = WEAK_COUNT) {
      const ranked = call(urgentUnits) ?? [];
      if (!ranked.length) return [];
      const rows = missionItems(place).map(({ word, meta }) => ({ word, units: new Set((call((c) => c.itemUnits(meta.itemKey)) ?? []).map((u) => u.unit)) }));
      const out = [];
      for (const unit of ranked) for (const row of rows) if (row.units.has(unit) && !out.includes(row.word)) out.push(row.word);
      return out.slice(0, count);
    },
    /**
     * 장소 한 판의 부탁을 시작한다(첫 부탁의 제시 전) — 판 길이(roundLength)를 코치 startSet으로 넘긴다. 닫지 않은 앞 판이 있으면 먼저
     * 닫는다(열린 판이 있으면 코치가 새 판을 열지 않는다). 코치에 startSet이 없거나 겉이 닫혔으면 아무것도 하지 않는다 — 판은 첫 제시가 연다.
     */
    begin(missions) {
      if (opened) end();
      if (call((c) => setPlay(c, { length: roundLength(missions) }).open())) opened = true;
    },
    /** 부탁을 내보였다(게임 차례 — present만). */
    present(m) {
      m.pid = show(missionMetadata(m));
      if (m.pid) open.set(m.pid, 0);
    },
    /** 소리 부탁의 소리를 끝까지 들었다 — 제시마다 한 번, 답을 기다리는 동안만. */
    heard(m) {
      const pid = m?.pid;
      if (!open.has(pid) || heard.has(pid)) return;
      if (call((c) => c.delivery(pid, { audio: 'completed' }))) heard.add(pid);
    },
    /** 정답 낱말이나 자리를 보여 줬다. */
    helped(m) {
      const pid = m?.pid;
      if (open.has(pid)) call((c) => c.help(pid, 'answer'));
    },
    /** 찍어서 답했다 — 맞힐 때까지 같은 제시의 다음 차례. */
    answer(m, { correct, selected }) {
      const pid = m?.pid;
      if (!open.has(pid)) return;
      const attemptNo = open.get(pid) + 1;
      if (reply(pid, { correct, assessable: true, choice: choiceOf(selected, m.word) }, attemptNo)) open.set(pid, attemptNo);
      if (correct) open.delete(pid);
    },
    /** 인화 한 문제(내보이고 바로 답). */
    recall(q, selected) {
      const pid = show(recallMetadata(q));
      if (pid) reply(pid, { correct: selected === q.answer, assessable: true, choice: choiceOf(selected, q.answer) }, 1);
    },
    /** 판을 그만두었다(입구로) — 답하지 않은 부탁을 다음 차례 번호로 닫고 판을 닫는다. */
    leave() {
      for (const [pid, answered] of open) reply(pid, { correct: null, reason: 'unanswered' }, answered + 1);
      end();
    },
    /** 판 끝(인화 뒤) — 판을 기록 없이 닫는다. */
    end,
    /** 판을 다시 정해 겉이 닫힌 뒤 다음 판에서 문을 다시 연다 — openLearning과 같은 꼴을 돌려준다. */
    renew() {
      quietly(() => unhear?.());
      return openLearning({ win, old });
    },
  });
}
