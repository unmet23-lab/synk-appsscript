// 한글 만나기의 새 길(Atlas 재설계 단계 4 · 4-7 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §26). WORLD 셸이 연 게임 코치를
// 문(window.SYNKAtlasGame)으로 받아(키트 kit/atlas-next.mjs) 이 게임의 기록과 회차를 잇는다. 스위치가 꺼졌을 때(문도 개발 깃발도 없을 때)
// app.mjs는 이 파일을 싣지 않고 옛 코치를 지금처럼 만든다.
//   나눔    엔진은 「어느 글자를 언제」만 정한다. 처음 만날 글자의 차례 · 회차의 짜임 · 꼴 · 난도(단)는 제품(core.mjs)이 정한다(§26-1).
//           간격표(진도의 step · due)는 읽지 않는다. 밀린 글자는 코치 due()의 한글 단위다.
//   판      회차 하나가 판 하나다. 첫 제시 전에 코치 startSet으로 연다(제품 차례 문항이 먼저여도 기본 판이 서지 않게). 판 길이는 제시 수의
//           위 끝(분량 + 짝 맞추기 두 판의 나머지 카드 6)이다 — 분량을 그대로 넘기면 회차 가운데 새 판이 열려 기다리던 「다시」가 사라진다
//           (§26-3). 고를 때는 판 옵션을 다시 넘기지 않는다 — 넘기면 30분 넘게 쉰 뒤 엔진이 그 판을 낡았다고 보고 새 판을 연다(검수 GB1).
//           회차 끝 · 그만두기 · 틀을 떠날 때 기록 없이 닫는다.
//   회차    복습(밀린 글자) → 새 글자(만나기 카드 · 확인) → 섞어 연습. 문항은 앞 문항을 푼 뒤 하나씩 정한다(step).
//   고르기  꼴을 먼저 정하고(core.mjs pickType), 그 꼴의 문항을 만난 글자마다 미리 지어 후보로 넘긴다 — 후보와 지은 문항이 늘 같다.
//           놓치고 아직 못 맞힌 글자는 단 − 1로 짓는다. 직전 문항의 글자는 후보에서 뺀다(제품 차례도 같다 — 확인 두 문항만 이어서 묻는다).
//           소리가 나지 않은 뒤에는 보고 고르기다. 엔진이 ready면 그 문항, idle · none이면 제품 차례(섞어 연습)다.
//   다시    회차 안 다시 내기는 엔진의 「다시」 하나다(core.mjs retryItem은 지금 판만).
//   짝 맞추기  겨눈 글자가 후보이고, 그 카드를 먼저 제시한다(고른 줄이 그 제시에 적힌다). 나머지 카드는 제품 차례 제시다.
//   낱말    낱말 문항은 계열 줄이 없어 후보가 아니다 — 제품 차례로만 낸다(§26-2).
//   오류    문을 거친 오류는 셸 창의 것이라 code로만 가른다. 겉이 닫혀도(RUN_ENDED) 회차는 제품 차례로, 기록 없이 이어 간다.
//           levels 밖 난도처럼 제시가 던지면 그 문항만 기록 없이 낸다.
import { answerOf, ended, openNext, setPlay } from './kit/atlas-next.mjs';
import {
  SETTINGS, TYPES, coreIds, hardByEar, localDay, makeItem, makeWordItem, metIds, newCount, nextLetters, pickType, readProgress, reasonLine, rng, seedOf,
  shuffle, weakPairs,
} from './core.mjs?v=atlas-47';
import { GAME_ID, itemMetadata } from './learning.mjs?v=atlas-47';   // 앱(app.mjs)과 같은 판 표시 — 한 판만 실린다

// 셸의 게임 은행 표(synk-world-app/world-atlas-game.mjs GAME_BANKS['hangul-stage'])와 같다 — 시험이 견준다.
export const BANKS = Object.freeze(['hangul-stage']);
const UNIT = 'ko.hangul.';
// 짝 맞추기는 회차에 두 판까지(core.mjs LIMIT), 한 판에 글자가 넷까지라 제시가 문항보다 많아야 여섯 많다.
export const EXTRA_PRESENTS = 6;
/** 판 길이 — 회차 제시 수의 위 끝. */
export const setLength = amount => amount + EXTRA_PRESENTS;

const quietly = fn => { try { return fn(); } catch { return null; } };

// 새 길을 연다. 문이 없고 개발 깃발도 없거나 셸이 지금 판이라고 하면 null(옛 길). RUN_ENDED는 그대로 던진다 — 옛 길을 열지 않는다.
export async function openHangul({ win = globalThis.window } = {}) {
  const coach = await openNext({ win, gameId: GAME_ID, banks: [...BANKS] });
  return coach ? createHangul(coach, { win }) : null;
}

/** 키트로 연 코치 하나. coach: 키트가 감싼 게임 겉(openNext의 값). */
export function createHangul(coach, { win = globalThis.window } = {}) {
  let live = coach;   // RUN_ENDED를 보거나 판을 다시 정하면 null — 그 회차는 기록 없이 제품 차례로 잇는다
  let retired = false;
  let run = null;     // 지금 회차의 상태 { set, soundless, missed }
  const open = new Map();        // 답을 기다리는 제시 번호 → 글자(낱말 문항이면 null)
  const matches = new WeakMap(); // 짝 맞추기 문항 → Map(글자 → 제시 번호)
  quietly(() => coach.onRetired?.(() => { retired = true; live = null; }));
  // 코치 부르기 하나. 기록이 거절돼도 놀이는 멈추지 않는다 — RUN_ENDED면 이 겉을 더 부르지 않고, 그 밖의 오류는 그 부르기만 버린다.
  const call = fn => {
    if (!live) return null;
    try { return fn(live); } catch (error) { if (ended(error)) live = null; return null; }
  };

  // ── 기록(learning.mjs createRecorder와 같은 꼴) ──
  const show = (item, letter) => {
    const pid = call(c => c.present(itemMetadata(item, item.type === 'match' ? letter : null))) ?? null;
    if (pid) open.set(pid, letter ?? null);
    return pid;
  };
  function presentMatch(item, letter) {
    if (!matches.has(item)) {
      const first = item.target.letter;
      const order = [first, ...item.cards.map(c => c.letter).filter(id => id !== first)];
      matches.set(item, new Map(order.map(id => [id, show(item, id)])));
    }
    return matches.get(item).get(letter) ?? null;
  }
  const reply = (pid, old) => {
    call(c => c.answer(pid, answerOf(old)));
    open.delete(pid);
  };
  const recorder = Object.freeze({
    present: (item, pairLetter) => (item.type === 'match' ? presentMatch(item, pairLetter) : show(item, item.target.letter)),
    delivered(pid, ok) {
      if (!pid) return;
      // 답하기 전에 소리가 끝까지 나지 않았다 — 다음 문항은 보고 고르기다. 소리가 한 번 나면 푼다(sounded).
      if (ok) sounded(); else if (run && open.has(pid)) run.soundless = true;
      call(c => c.delivery(pid, { audio: ok ? 'completed' : 'failed' }));
    },
    replay: pid => { if (pid) call(c => c.help(pid, 'replay')); },
    helped: pid => { if (pid) call(c => c.help(pid, 'hint')); },
    shown: pid => { if (pid) call(c => c.help(pid, 'answer')); },
    answer(pid, correct) {
      if (!pid) return;
      const letter = open.get(pid) ?? null;
      if (run && letter) { if (correct) run.missed.delete(letter); else run.missed.add(letter); }
      reply(pid, { correct, assessable: true });
    },
    leave: pid => { if (pid && open.has(pid)) reply(pid, { correct: null, assessable: false, reason: 'unanswered' }); },
    flush() {},
  });
  const sounded = () => { if (run) run.soundless = false; };
  // 판을 기록 없이 닫는다. 답하지 않은 제시는 unanswered로 먼저 닫는다.
  function close() {
    for (const pid of [...open.keys()]) recorder.leave(pid);
    if (!run) return;
    const { set } = run;
    run = null;
    quietly(() => set?.end());
  }
  // 틀을 떠날 때(패널 닫힘 · 다시 싣기)도 그만두기와 같다. 키트가 먼저 건 leave가 셸의 판 닫기를 셸의 다음 차례로 미루므로 이 답이 먼저 든다.
  quietly(() => win?.addEventListener?.('pagehide', close));

  // 돌아온 한글 단위 — 엔진이 「밀렸다」고 하는 글자(급한 것부터).
  const dueLetters = () => (call(c => c.due()) ?? []).map(row => row.unit).filter(unit => unit.startsWith(UNIT)).map(unit => unit.slice(UNIT.length));

  return Object.freeze({
    recorder,
    get retired() { return retired; },
    /** 회차 하나 — { plan, total, step(), sounded(), end() }. plan은 core.mjs planSession과 같은 칸이고 steps는 빈 목록이다(문항은 step이 하나씩). */
    session({ progress, pack, now, scope = 'device', sessionNo = 0 }) {
      close();
      const shape = shapeOf(progress, pack, { now, scope, sessionNo, due: dueLetters() });
      run = { set: null, soundless: false, missed: new Set() };
      const state = run;
      if (live) {
        const set = setPlay(live, { length: setLength(shape.amount) });
        state.set = set;
        call(() => set.open());
      }
      // 엔진이 고른 문항 — 할 것이 있을 때(ready)만. 채우기(idle)와 낼 것이 없음(none)은 제품 차례다. 판은 startSet이 연 판 그대로다.
      const ask = made => {
        if (!live || !state.set) return null;
        try {
          const result = live.recommend([...made.keys()]);
          return result?.status === 'ready' && result.selected ? made.get(result.selected) ?? null : null;
        } catch (error) {
          if (ended(error)) live = null;
          return null;
        }
      };
      const steps = stepsOf(shape, pack, { ask, state });
      const { plan } = shape;
      // 이유 한 줄과 복습 글자는 엔진이 실제로 고른 글자로 보인다 — 첫 걸음을 미리 정해 그 글자를 칩으로 쓰고, 복습 글자는 회차가 가며 는다
      // (그 뒤의 복습은 앞 문항의 답을 보고 엔진이 정하므로 미리 말하지 않는다, 검수 Fable F1).
      const pull = () => {
        const next = steps.next().value ?? null;
        if (next?.review) plan.reviews.push(next.item.target.letter);
        return next;
      };
      const ahead = [pull()];
      plan.reason = reasonOf(shape, pack, ahead[0]);
      return Object.freeze({
        plan,
        total: shape.amount,
        /** 다음 걸음({ kind: 'item' | 'meet' }) — 회차가 끝났으면 null. */
        step: () => (ahead.length ? ahead.pop() : pull()),
        /** 소리가 났다 — 보고 고르기로 돌린 꼴을 푼다. */
        sounded: () => { state.soundless = false; },
        /** 회차 끝 · 그만두기 — 판을 기록 없이 닫는다. */
        end: () => { if (run === state) close(); },
      });
    },
  });
}

// 회차의 뼈대 — 새 글자 몫 · 복습 자리. 밀린 글자는 due(코치)에서 온다 — 진도의 간격표(step · due)는 읽지 않는다.
// plan.reviews는 빈 목록으로 시작해 복습 문항이 설 때마다 그 글자가 붙고, plan.reason은 첫 걸음을 정한 뒤 reasonOf가 채운다.
export function shapeOf(progress, pack, { now, scope, sessionNo, due }) {
  const p = readProgress(progress);
  const t = Date.parse(now), day = localDay(now), key = `${scope}|${day}|${sessionNo}`;
  const met = metIds(p, pack);
  const back = due.filter(id => met.includes(id)); // 제품이 만난 글자만 복습 자리에 선다
  const amount = p.graduated ? Math.min(p.amount, SETTINGS.warmup) : p.amount;
  let fresh = nextLetters(p, pack, Math.min(newCount(p, due.length), Math.floor(amount / 2)));
  if (!met.length && fresh.length < 2) fresh = nextLetters(p, pack, 2); // 처음 회차는 두 글자 이상이어야 문항이 선다
  const weak = weakPairs(p, t);
  // 헷갈린 짝의 두 글자가 모두 돌아왔으면 첫 복습 자리에 짝 문항 꼴을 먼저 묻는다(어느 글자를 낼지는 엔진이 정한다).
  const told = weak.find(pair => pair.every(id => back.includes(id))) ?? null;
  const reviewSlots = Math.max(0, Math.min(back.length, fresh.length ? Math.min(3, amount - fresh.length * 2) : amount));
  return {
    key, amount, met, fresh, weak, told, reviewSlots, difficulty: p.difficulty, progress: p, at: t,
    allCoreMet: coreIds(pack).every(id => met.includes(id) || fresh.includes(id)),
    plan: { day, sessionNo, fresh, reviews: [], difficulty: p.difficulty, steps: [], warmup: !!p.graduated, reason: null },
  };
}

// 이유 한 줄 — 글은 첫 걸음을 따른다. 「다시 볼 글자」는 엔진이 첫 복습으로 고른 문항이 있을 때, 「헷갈린 글자예요」는 그 첫 문항이 헷갈린
// 짝의 두 글자를 묻는 짝 문항일 때만 말한다. 첫 걸음이 복습이 아니면(새 글자 · 연습) 돌아온 글자를 말하지 않는다(검수 Fable F1).
// 칩은 이 회차가 만나기 카드로 먼저 가르치는 새 글자만 보인다. 돌아온 글자 · 헷갈린 짝은 첫 평가 전에 글자를 보이지 않는다 — 이유 화면이
// 첫 복습 문항의 답을 미리 보이면 그 답이 도움 없는 정답으로 적힌다(검수 -d GA1, 「5-3 게임」 GE1과 같은 규칙). 옛 길은 지금 판 그대로다.
export function reasonOf(shape, pack, first) {
  const item = first?.review ? first.item : null;
  const asked = item?.type === 'pair' ? item.options.map(o => o.letter) : [];
  const weak = asked.length === 2 ? shape.weak.find(pair => asked.every(id => pair.includes(id))) ?? null : null;
  const line = reasonLine({ p: shape.progress, pack, fresh: shape.fresh, weak, due: item ? [item.target.letter] : [], now: shape.at });
  const taught = line.kind === 'new' || line.kind === 'mixed' ? shape.fresh : [];
  return { ...line, letters: taught.map(id => pack.byId.get(id).glyph), finals: taught.map(id => pack.byId.get(id).role === 'final') };
}

// 회차의 걸음을 하나씩 낸다. ask(후보 Map — 메타 → 문항): 엔진이 고른 문항 또는 null. state: { soundless, missed }.
export function* stepsOf(shape, pack, { ask, state }) {
  const { key, amount, fresh, weak, told, reviewSlots, difficulty, allCoreMet } = shape;
  const rand = rng(seedOf(`${key}|next`));
  const known = new Set(shape.met);
  const items = [];
  const base = { pack, progress: null, rand, difficulty, weak, fresh: new Set(fresh) };
  const last = () => items.at(-1)?.target.letter ?? null;
  // 문항 하나를 짓는다. 글자마다 씨앗이 따로라 후보가 몇이든 그 글자의 문항은 같다. 놓치고 아직 못 맞힌 글자는 한 단 쉽게.
  const build = (type, letter, more = {}, salt = '') => makeItem(type, letter, known, {
    ...base, rand: rng(seedOf(`${key}|${items.length}|${type}|${letter}${salt}`)),
    difficulty: Math.max(1, difficulty - (state.missed.has(letter) ? 1 : 0)), ...more,
  });
  const put = item => {
    item.n = items.length + 1;
    item.id = `hg-${seedOf(key).toString(36)}-${item.n}`;
    items.push(item);
    return { kind: 'item', item };
  };
  // 꼴 하나 — 소리가 나지 않은 뒤에는 보고 고르기, 그 밖에는 회차 꼴 규칙. tried에 든 꼴만 남았으면 null.
  const formOf = (tried, review, prefer = null) => {
    const type = state.soundless ? 'see_pick' : prefer && !tried.has(prefer) ? prefer : pickType(items, base, known, { review, exclude: tried });
    return tried.has(type) ? null : type;
  };
  // 그 꼴의 후보 — 만난 글자마다 하나(직전 글자는 뺀다). 메타(기록 · 후보의 열쇠) → 지은 문항.
  const candidates = type => {
    const made = new Map();
    for (const id of known) {
      if (id === last()) continue;
      const item = build(type, id);
      if (item) made.set(itemMetadata(item, item.type === 'match' ? id : null), item);
    }
    return made;
  };

  const chosen = type => { const made = candidates(type); return made.size ? ask(made) : null; };

  // 1. 복습 — 엔진이 고른 글자. 엔진이 할 것이 없다고 하면(모든 꼴에서) 복습을 마친다. 그 꼴로 지을 수 없는 글자는 다른 꼴에서 선다.
  const teachAt = reviewSlots >= 2 ? 1 : 0;
  for (let n = 0; n < reviewSlots; n += 1) {
    const taught = items.some(i => i.type === 'teach');
    const prefer = n === 0 && told ? 'pair' : n === teachAt && known.size >= 6 && !taught ? 'teach' : null;
    const tried = new Set(n < teachAt ? ['teach'] : []); // 가르쳐 주기 자리 앞에서는 아껴 둔다(회차에 한 번)
    let item = null;
    while (!item) {
      const type = formOf(tried, true, prefer);
      if (!type) break;
      tried.add(type);
      item = chosen(type);
    }
    if (!item) break;
    yield { ...put(item), review: true };
  }

  // 2. 새 글자 — 만나기 카드 → 확인(듣고 고르기 · 보고 고르기, 1단). 제품 차례다. 비교할 글자가 아직 없으면 다음 카드 뒤로 미룬다.
  let pending = [];
  for (const id of fresh) {
    yield { kind: 'meet', letter: id };
    known.add(id);
    pending.push(id);
    const still = [];
    for (const target of pending) {
      let made = 0;
      for (const type of ['listen_pick', 'see_pick']) {
        if (type === 'listen_pick' && (state.soundless || hardByEar(pack, target))) continue;
        const item = build(type, target, { difficulty: 1, check: true });
        if (item) { made += 1; yield put(item); }
      }
      if (!made) still.push(target);
    }
    pending = still;
  }

  // 3. 섞어 연습 — 분량을 채운다. 낱말 자리(제품 차례) → 엔진이 고른 글자 → 제품 차례(오늘의 글자 → 나머지 아는 글자).
  const order = [...new Set([...fresh, ...shuffle([...known], rand)])];
  const wordLimit = allCoreMet ? 4 : 2, wordChance = allCoreMet ? 0.5 : 0.3;
  while (items.length < amount) {
    const wordy = (difficulty >= 2 || allCoreMet) && items.filter(i => i.word).length < wordLimit && rand() < wordChance;
    const word = wordy ? makeWordItem(state.soundless ? 'see_pick' : pickType(items, base, known, { only: ['listen_pick', 'see_pick'] }), known, base) : null;
    if (word && word.target.text !== items.at(-1)?.target.text) { yield put(word); continue; } // 같은 낱말을 바로 다시 내지 않는다
    const type = formOf(new Set(), false);
    const item = chosen(type) ?? productTurn(type);
    if (!item) return;
    yield put(item);
  }

  // 제품 차례 — 정한 꼴부터, 그 꼴로 낼 글자가 없으면 다른 꼴로. 직전 글자만 남았을 때만 그 글자를 다시 낸다(놀이가 멈추지 않게).
  function productTurn(first) {
    for (const avoid of [last(), null]) {
      const tried = new Set();
      for (let type = first; type && !tried.has(type); type = tried.size < TYPES.length ? formOf(tried, false) : null) {
        tried.add(type);
        for (let i = 0; i < order.length; i += 1) {
          const id = order[(items.length + i) % order.length];
          if (id === avoid || !known.has(id)) continue;
          const item = build(type, id, {}, '|turn'); // 엔진의 채우기 후보와 다른 씨앗 — 같은 열쇠면 제시가 채우기로 적힌다
          if (item) return item;
        }
        if (state.soundless) break;
      }
    }
    return null;
  }
}
