// 입장 검사의 새 길(Atlas 재설계 단계 4 · 4-6d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §23-7). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 근무 · 손님 고르기 · 답 · 도움 · 순간 맞춤을 잇는다.
// 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때) app.mjs는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   근무    손님 6명(set.length 6 · 새것 한도 3n — 키트 setPlay). 손님이 올 때마다 recommend를 부른다. 후보는 그 자리에 와도 근무의 약속이
//           지켜지는 손님이다 — 이미 온 손님을 앞에 두고 그 손님을 다음에 세웠을 때 composeShift(core.mjs)가 같은 차례를 내는가. 그래서
//           규칙마다(알림 규칙 포함) 그 규칙을 어기는 손님 한 명 · 통과 손님 · 알림 전 1명과 뒤 2명 · 도착 시각 차례 · 처음 하는 사람의 쉬운
//           통과 손님이 그대로다. 확인용 손님(followupOnly)은 후보가 아니다(즉시 확인 바꿔 넣기를 새 길에서 쓰지 않는다).
//   게임 차례  엔진이 none이면 게임 순서(composeShift가 지금 세운 줄의 그 자리)로 present만 한다. 이유 줄은 없다. idle(채우기)은 엔진이
//           고른 손님이다(키트 setPlay). 엔진이 고른 손님이 아니면 그 자리에 오는 손님은 게임 순서의 손님이다.
//   보이는 줄  queue는 온 손님과, 게임 순서로 이어질 손님이다. 손님이 올 때마다 고친다(줄 그림 · 목소리 미리 받기가 읽는다).
//   연수 · 한 손님 연습  정해진 손님이라 recommend 없이 present만(연수 — 첫 손님 전에 판 길이를 코치 startSet으로 넘긴다. 키트 setPlay.open),
//           한 손님 연습은 그 손님 한 명을 고를 때만 recommend(set.length 1).
//           한 손님 연습을 건네는 때: 연수를 마쳤고 근무를 해 본 사람에게, 돌아온 단위(due()) · 아직 혼자 못 맞힌 단위 · 끈질긴 단위
//           (summary().units)가 든 손님 가운데 아직 보여 주지 않은 손님(exposures() — 옛 events()로 읽던 「보여 준 손님」)이 열린 근무지에 있을 때.
//   답      옛 답 꼴(learning.mjs answerPayload · 떠날 때의 unanswered)을 키트 answerOf로 옮긴다. 손님마다 도장은 한 번(뒤 답 없음).
//   순간 맞춤  돋보기 시점(live) · stuck · 도움 줄이기 권함은 옛 겉과 같은 이름으로 쓴다. 손님마다 답은 한 번이라 한 제시가 Flow를 한 번만 움직인다.
//   은행 밖  지도(은행)에 없는 손님은 present하지 않는다 — 내면 엔진이 태그 없는 문항으로 받아 하루 새것 한도를 깎는다(itemUnits로 본다).
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫혀도(RUN_ENDED) 고르기가 실패해도 근무는 게임 차례로 이어 간다.
//           판을 다시 정하면(onRetired) 이번 근무는 기록 없이 잇고, app.mjs가 다음 근무 · 한 손님 연습을 열 때 문을 다시 연다.
// 옛 return-practice · 옛 요약 여섯 상태 · 이벤트 읽기 · 즉시 확인 바꿔 넣기 · 짝 맞추기 · 기록 지우기 · 동기 알림은 새 길에서 쓰지 않는다(§23-6).
import { SHIFT_SIZE, SKILL_LABEL, VENUES } from './content.mjs';
import { composeShift, minutes } from './core.mjs';
import { GAME_ID, caseCandidates, caseMetadata } from './learning.mjs';
import { answerOf, nextDoor, openNext, setPlay } from './kit/atlas-next.mjs';

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['entry-check'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['entry-check']);
// 손님 앞에 한 줄로 알리는 이유 — 다시 만나는 단위(방금 놓친 · 흔들리는 · 돌아온). 처음 만나는 단위는 손님마다 말하지 않는다.
export const GUEST_REASONS = Object.freeze(['unit.retry', 'unit.shaky', 'unit.due']);
// 근무 끝 한 줄로 쓰는 엔진 문장 — 엔진이 그 까닭으로 고르지 않았을 때(하루 상한 · 끈질긴 단위의 몫)만.
const HELD = new Set(['day.capped', 'pace.stubborn']);
// 마지막 자리의 결과가 「아직 혼자 못 맞힘」인 단위(summary().units[].last).
const MISSED = new Set(['again', 'hard']);

const quietly = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
const ordinary = venue => venue.cases.filter(c => !c.followupOnly);

// 새 길 코치를 연다. 문이 없고 개발 깃발도 없거나 셸이 지금 판이라고 하면 null(옛 길). RUN_ENDED는 그대로 던진다 — 옛 길을 열지 않는다.
// 계정 코치로 문을 거쳤을 때만 「WORLD 계정에 이어진다」(hosted) — 손님 코치(동의를 끈 계정의 기기 길 포함)는 이 브라우저의 기록이다.
export async function openShiftCoach({ win = globalThis.window } = {}) {
  const viaDoor = nextDoor(win) != null;
  const coach = await openNext({
    win,
    gameId: GAME_ID,
    banks: [...BANKS],
    // 혼자 뜨는 길(개발 깃발)의 능력 이름 — 셸이 넘기는 표와 같은 이름(단위 이름은 지도 조각이 안다).
    label: id => SKILL_LABEL[id] ?? null,
  });
  if (!coach) return null;
  const hosted = viaDoor && quietly(() => coach.summary()?.storage?.guest === false, false) === true;
  return createShiftCoach(coach, { hosted });
}

// coach: 키트가 감싼 게임 겉(openNext의 값). hosted: 그 코치의 기록이 WORLD 계정의 것인가(app.mjs의 기록 안내).
export function createShiftCoach(coach, { hosted = false } = {}) {
  let retired = false;
  // 판을 다시 정했다 — 이번 근무는 기록 없이 잇고 다음 근무에서 문을 다시 연다(§23-2).
  quietly(() =>
    coach.onRetired?.(() => {
      retired = true;
    }),
  );
  // 은행에 있는 손님인가(문항 열쇠마다 한 번 묻는다). 물을 수 없으면(겉이 닫힘) 내지 않는 쪽 — 어차피 기록되지 않는다.
  const banked = new Map();
  const inBank = meta => {
    const key = meta?.itemKey;
    if (!banked.has(key)) {
      const units = quietly(() => coach.itemUnits(key), null);
      if (units == null) return false;
      banked.set(key, units.length > 0);
    }
    return banked.get(key);
  };
  // 순간 맞춤 손잡이 — 옛 겉의 꼴(present(meta) · answer(pid, 옛 답, { latencyMs }))을 새 겉에 잇는다.
  const liveOf = handle =>
    Object.freeze({
      ...handle,
      present: meta => (inBank(meta) ? handle.present(meta) : null),
      answer: (pid, old, flow) => (pid == null ? null : handle.answer(pid, answerOf(old), flow)),
    });
  return Object.freeze({
    // app.mjs가 쓰는 옛 겉의 꼴. 은행 밖 손님은 제시하지 않고(pid null), 그 손님의 도움 · 답은 기록하지 않는다.
    coach: Object.freeze({
      present: meta => (inBank(meta) ? coach.present(meta) : null),
      help: (pid, kind) => (pid == null ? null : coach.help(pid, kind)),
      answer: (pid, old) => (pid == null ? null : coach.answer(pid, answerOf(old))),
      live: (content, options) => liveOf(coach.live(content, options)),
      summary: () => coach.summary(),
    }),
    get retired() {
      return retired;
    },
    hosted,
    // 정규 근무 — 손님이 올 때마다 고른다.
    shift: (venue, options = {}) => shiftOf(coach, inBank, venue, options),
    // 정해진 손님(연수) — recommend 없이 present만, 근무 끝에 판을 닫는다.
    fixed: queue => fixedOf(coach, queue, null, inBank),
    // 입구 · 결과의 추천 근무지 — 열린 근무지의 손님 가운데 엔진이 고른 손님이 있는 근무지와 그 이유 줄(엔진이 고를 때만).
    venue: venueIds => venueOf(coach, inBank, venueIds),
    // 한 손님 연습을 건넬 수 있나(입구 단추) — 고르지는 않는다.
    canDrill: (venueIds, progress) => Boolean(drillRows(coach, inBank, venueIds, progress)),
    // 한 손님 연습의 손님을 고른다(누른 때). { venueId, item, why, plan } 또는 null.
    drill: (venueIds, progress) => drillOf(coach, inBank, venueIds, progress),
  });
}

// 판을 닫는다(기록 없이). 겉이 닫혔거나 닫을 판이 없어도 근무는 그대로다.
function closer(set) {
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    quietly(() => set.end());
  };
}

// 정규 근무. at(i)는 i번째 손님을 그때 고른다(앞 손님의 답을 본 뒤). size · queue(보이는 줄 — 온 손님 + 게임 순서로 이어질 손님) ·
// pool(올 수 있는 손님 — 목소리를 미리 받는다) · line(i)(손님 앞 이유 한 줄) · kinds(손님마다 engine · game) · end()(근무 끝 한 줄 — 없으면 null).
function shiftOf(coach, inBank, venue, { firstTime = false } = {}) {
  const authored = ordinary(venue);
  const size = Math.min(SHIFT_SIZE, authored.length);
  const picked = [];
  const queue = composeShift(venue, { firstTime });
  const lines = [];
  const picks = [];
  let last = null;
  let held = null;
  const set = setPlay(
    {
      recommend: (list, options) => {
        last = coach.recommend(list, options);
        return last;
      },
      finishSet: options => coach.finishSet(options),
    },
    { length: size },
  );
  const end = closer(set);
  const later = (guest, except = null) =>
    authored.filter(c => !picked.includes(c) && c !== except && (!guest || minutes(c.at) > minutes(guest.at)));
  // 온 손님을 앞에, (next가 있으면) 그다음 next를, 그 뒤 늦게 오는 손님을 원고 차례로 둔 필요 순서로 근무를 짠다.
  const shiftWith = next =>
    composeShift(venue, {
      ranked: [...picked, ...(next ? [next] : []), ...later(next ?? picked.at(-1), next)].map(c => c.id),
      firstTime,
    });
  const keeps = (shift, prefix) => prefix.every((c, i) => shift[i] === c);
  // 이 자리에 올 수 있는 손님 — 다음에 와도 composeShift가 온 손님과 그 손님을 그대로 앞에 세운다.
  const fitting = () => {
    const after = picked.length ? minutes(picked.at(-1).at) : -Infinity;
    return authored.filter(c => !picked.includes(c) && minutes(c.at) > after && keeps(shiftWith(c), [...picked, c]));
  };
  // 보이는 줄을 고친다 — 온 손님 + 게임 순서로 이어질 손님.
  const reproject = () => {
    const next = shiftWith(null);
    queue.splice(0, queue.length, ...(keeps(next, picked) ? next : [...picked, ...next.filter(c => !picked.includes(c))]).slice(0, size));
  };

  function pick() {
    const index = picked.length;
    const fit = fitting();
    // 게임 차례 — 지금 줄의 그 자리 손님(게임 순서). 그 손님이 올 수 없게 됐으면 올 수 있는 첫 손님.
    const game = fit.includes(queue[index]) ? queue[index] : (fit[0] ?? queue[index] ?? null);
    if (!game) return null;
    const rows = fit.filter(c => inBank(caseMetadata(c)));
    last = null;
    let got = null;
    if (rows.length) {
      try {
        got = set.next(caseCandidates(rows), list => list.find(row => row.caseId === game.id) ?? null);
      } catch {
        // 겉이 닫혔거나(RUN_ENDED) 고르기가 실패했다 — 기록 없이 게임 차례로 잇는다.
        got = null;
      }
    }
    const item = (got && authored.find(c => c.id === got.item?.caseId)) || game;
    if (last?.status === 'none' && HELD.has(last.why?.code) && last.why.line) held = last.why.line;
    picked.push(item);
    picks.push(got?.engine ? 'engine' : 'game');
    lines.push(got?.engine && GUEST_REASONS.includes(got.why?.code) ? (got.why.line ?? null) : null);
    reproject();
    return item;
  }

  return Object.freeze({
    size,
    queue,
    pool: authored,
    at(index) {
      if (index < picked.length) return picked[index];
      if (index !== picked.length || picked.length >= size) return null;
      return pick();
    },
    line: index => lines[index] ?? null,
    kinds: () => [...picks],
    end() {
      if (picked.length) end();
      return held;
    },
  });
}

// 정해진 손님 — 제품 차례라 recommend 없이 present만(연수). 첫 손님을 부를 때(첫 present 전) 판 길이를 코치에 넘긴다(open — 코치
// startSet). 길이는 이 판에서 낼 제시 수(은행에 있는 손님 수)다. 앞 판은 app.mjs가 이 판을 짓기 전에 닫는다(endPlan).
// set을 주면(한 손님 연습 — 고를 때 recommend로 연 판) 열지 않고 그 판을 닫기만 한다. 그 판은 손님을 부르기 전(근무 전 안내에서 그만두기 ·
// 연수 다시 보기)에도 이미 열려 있어 그때도 닫는다(4-6 끝 판 A1). 입구 · 결과의 근무지 추천(venueOf)이 판 옵션 없이
// 고르며 기본 판을 열어 두었으면 코치가 { opened: false }를 낸다 — 그 판(제시 없음)을 기록 없이 닫고 다시 연다(4-6 끝 판 F4).
function fixedOf(coach, queue, given = null, inBank = () => true) {
  const set = given ?? setPlay(coach, { length: queue.filter(c => inBank(caseMetadata(c))).length });
  const end = closer(set);
  let started = false;
  return Object.freeze({
    size: queue.length,
    queue,
    pool: queue,
    at(index) {
      if (!started && !given)
        quietly(() => {
          if (set.open()?.opened !== false) return;
          set.end();
          set.open();
        });
      started = true;
      return queue[index] ?? null;
    },
    line: () => null,
    kinds: () => queue.map(() => 'game'),
    end() {
      if (started || given) end();
      return null;
    },
  });
}

// 열린 근무지의 손님 후보(근무지 이름을 붙인 자료).
function venueRows(inBank, venueIds) {
  return VENUES.filter(venue => venueIds.includes(venue.id)).flatMap(venue =>
    ordinary(venue)
      .filter(c => inBank(caseMetadata(c)))
      .map(c => ({ venue, c })),
  );
}
const candidatesOf = rows => caseCandidates(rows.map(row => row.c)).map((row, i) => ({ ...row, venueId: rows[i].venue.id }));

function venueOf(coach, inBank, venueIds) {
  const rows = venueRows(inBank, venueIds);
  if (!rows.length) return null;
  const result = quietly(() => coach.recommend(candidatesOf(rows), {}));
  if (result?.status !== 'ready' || !result.selected?.venueId) return null;
  return { venueId: result.selected.venueId, line: result.why?.line ?? null };
}

// 한 손님 연습의 후보 — 연수를 마쳤고 근무를 해 본 사람에게만. 돌아온 단위 · 아직 혼자 못 맞힌 단위 · 끈질긴 단위가 든 손님 가운데 아직
// 보여 주지 않은 손님(exposures().seen === false — 모르면 건네지 않는다).
function drillRows(coach, inBank, venueIds, progress) {
  if (!progress?.tutorial || !(progress.plays > 0)) return null;
  return quietly(() => {
    const weak = new Set((coach.due() ?? []).map(row => row.unit));
    for (const unit of coach.summary()?.units ?? []) if (unit.stubborn || MISSED.has(unit.last)) weak.add(unit.unit);
    if (!weak.size) return null;
    const rows = venueRows(inBank, venueIds).filter(row =>
      coach.itemUnits(caseMetadata(row.c).itemKey).some(unit => weak.has(unit.unit)),
    );
    if (!rows.length) return null;
    const seen = coach.exposures(rows.map(row => caseMetadata(row.c)));
    const fresh = rows.filter((_, i) => seen[i]?.seen === false);
    return fresh.length ? fresh : null;
  });
}

function drillOf(coach, inBank, venueIds, progress) {
  const rows = drillRows(coach, inBank, venueIds, progress);
  if (!rows) return null;
  const set = setPlay(coach, { length: 1 });
  let got = null;
  try {
    got = set.next(candidatesOf(rows), list => list[0] ?? null);
  } catch {
    // 겉이 닫혔거나(RUN_ENDED) 고르기가 실패했다 — 게임 차례(첫 후보)로, 기록 없이.
    got = null;
  }
  const row = (got && rows.find(one => one.c.id === got.item?.caseId)) || rows[0];
  return {
    venueId: row.venue.id,
    item: row.c,
    // 다시 만나는 단위일 때만 엔진의 이유 한 줄(근무 전 안내에 싣는다). 채우기 · 처음 만남 · 게임 차례는 이유를 짓지 않는다.
    why: got?.engine && GUEST_REASONS.includes(got.why?.code) ? (got.why.line ?? null) : null,
    plan: fixedOf(coach, [row.c], set),
  };
}
