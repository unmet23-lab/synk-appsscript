// WORLD 「짧은 연습」의 새 판(Atlas 재설계 단계 4-1 — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §7). 개발 깃발 atlasNext 뒤에서만 돈다.
// 지금 판(world-reading-practice.mjs createPracticeSession)은 한 글자도 바꾸지 않고, 같은 겉(next · replay · delivery · answer · skip · stop ·
// results)을 여기 따로 둔다. 달라진 것:
//   ① 다음 문항은 엔진(코치 3판 recommend)이 고른다 — 그 항목의 연습 문항 전부가 후보이고, 놓친 단위는 다른 문항으로 다시, 돌아온 단위는
//      돌아온 것으로 나온다. 측정(처음 본 문항의 혼자 낸 첫 답)은 지금 계약 그대로라 「내 위치」 근거는 같은 답에서만 선다.
//   ② 판은 길이 n(3 · 5 · 7)으로 열고 새것 한도는 단위로 3n이다(TOPIK 문항은 단위가 둘 · 셋인 것이 많다 — 계획 §7 · 아르곤 A1).
//   ③ 엔진이 낼 것이 없다(none)고 하면 판을 끝낸다. 할 것이 없다(idle)고 하면 처음 보는 문항으로 잇는다 — 처음 보는 문항은 측정
//      기회다(그 항목의 새 문항으로 확인하는 연습의 약속). 엔진의 채우기 차례는 「한 번도 안 본 문항」을 앞세우지 않으므로, 맨 앞 채우기가
//      이미 본 문항이면 후보를 처음 보는 문항으로 좁혀 한 번 더 묻고(엔진이 그 안에서 고른다), 그것도 없을 때만 끝낸다(Fable 설계 P1-1).
//      끝난 까닭(ending)은 그 판의 사실에서 고르고, 끝 문장에 엔진 문장을 쓰는 것은 그 까닭이 엔진의 것(capped · stubborn)일 때뿐이다
//      — 돌아온 것을 안 낸 판에 「오늘 돌아온 것은 다 만났어요」를 쓰지 않고, idle로 끝난 판도 제품 문장을 쓴다(카본 A1).
//   ⑥ 판이 끝나거나 그만두면 코치의 판을 닫는다(finishSet record: false — 판 기록은 셸이 응답과 함께 남긴다). 닫지 않으면 다음 판의
//      같은 뜻 set이 「이미 열린 판」으로 이어진다(코치는 문항이 나간 판에 같은 set이 또 오면 다시 열지 않는다).
//   ④ 문항마다 이유(why) · 끈질긴 단위 표시(stubborn) · 「모르겠어요」(unknown)를 보기에 싣고, 문항 앞 해설(preHelp)을 받는다.
//   ⑤ 혼자 맞힘(independent)은 저장이 끝난 뒤의 값이다 — settled()가 판의 답이 모두 저장된 뒤 풀린다(판 끝 화면은 그 뒤에 그린다).
// 듣기 · 허용 재생 · 건너뛰기 · 그만두기 · 답 뒤 「정답 보기」 도움은 지금 판과 같다(같은 시험을 두 모듈에 건다).
// 재생 셈(allowedPlays · nextPlay)은 지금 판과 같은 것(world-exam-form.mjs)을 셸이 넘긴다 — 브라우저에서 그 파일은 계정 묶음 안에만 있어
// 이 모듈이 따로 부르면 받지 못한다(리허설 화면 확인에서 잡음).

export const NEXT_POLICY = Object.freeze({
  version: 'world-practice-next-1',
  newPerItem: 3,
});
const listeningOf = item => item.audioRequired ?? item.modality === 'listening';

// 엔진 문장이 그 끝 까닭을 말하는 이유 종류 — 이 둘일 때만 엔진의 문장을 판 끝 줄에 쓴다. idle(「오늘 돌아온 것은 다 만났어요. 가볍게
// 이어가요.」)은 채우기로 이어 가는 판의 말이라, 판이 idle로 끝나는 때(돌아온 것을 냈고 처음 보는 문항도 다 쓴 때)에는 제품 문장을 쓴다
// (11-12 화면 검수 카본 A1 — 「가볍게 이어가요」와 「N문항 더 하기」가 0문항 판으로 이어졌다).
const IDLE = 'idle';
export const ENGINE_ENDINGS = Object.freeze({
  capped: 'day.capped',
  stubborn: 'pace.stubborn',
});

// 판 끝 줄의 엔진 문장 — 끝 까닭과 엔진 이유가 같은 말일 때만(아니면 null, 화면은 제품 문장을 쓴다).
export const endingLine = (kind, why) =>
  why?.line && ENGINE_ENDINGS[kind] === why.code ? why.line : null;

// 판이 끝난 까닭 — 그 판에서 실제로 일어난 일에서 고른다(돌아온 것을 만나지 않은 판에 「다 만났어요」를 쓰지 않는다).
// 엔진이 낼 것이 없다(none)고 해도 그 판의 사실이 먼저다 — 하루 새 단위 한도를 다 쓴 날 새 항목의 판은 한 문항도 못 내고 none이지만
// 끝 까닭은 limited(「이번 판의 새 말은 여기까지예요」 + 「새 말 더 배우기」)다(계획 §7, Fable 5.2 최종 F2). none은 사실이 없을 때만.
export function endingOf(picked, served) {
  if (!picked) return { kind: 'done' };
  const facts = picked.facts ?? {};
  if (facts.held === 'day') return { kind: 'capped' };
  if (facts.held === 'stubborn') return { kind: 'stubborn' };
  if (facts.limited) return { kind: 'limited' };
  if (picked.status === 'none') return { kind: 'none' };
  if (facts.servedDue || served.due) return { kind: 'idle' };
  return { kind: 'exhausted' };
}

// 같은 지문 세트의 다른 문항을 이미 봤으면 처음 보는 문항이 아니다(world-exam-form.mjs freshBySet과 같은 생각).
function setSeen(pool, item, seen) {
  if (!item.setId) return false;
  return pool.some(other => other !== item && other.setId === item.setId && seen(other) === true);
}

// setPool: 같은 지문 세트를 찾을 문항 전체(기본은 pool) — 세트의 다른 문항이 다른 항목일 수 있어 셸은 은행 전체를 넘긴다.
export function createPracticeNextSession({
  coach,
  pool,
  setPool = pool,
  length = 5,
  audioAvailable = true,
  more = false,
  lang = 'ko',
  plays: { allowedPlays, nextPlay } = {},
} = {}) {
  if (
    !coach ||
    ['recommend', 'present', 'answer', 'help', 'delivery', 'exposure'].some(
      name => typeof coach[name] !== 'function',
    )
  )
    throw TypeError('WORLD practice next needs the Atlas coach');
  if (typeof allowedPlays !== 'function' || typeof nextPlay !== 'function')
    throw TypeError('WORLD practice next needs the play counters (allowedPlays · nextPlay)');
  if (!Array.isArray(pool) || !pool.length || !Number.isInteger(length) || length < 1)
    throw TypeError('WORLD practice next needs its pool and a length');
  // 측정용 「앞서 만났나」 — 처음 보는 문항 고르기와 같은 지문 세트 판정은 측정 자격의 일이라 화면용 seen이 아니라 met을 쓴다
  // (띄우기만 하고 닫힌 문항은 아직 측정 기회다 — 아르곤 끝 판). 모르면(null) 만난 것으로 친다(측정을 부풀리지 않게).
  const met = item => {
    const exposure = coach.exposure(item);
    return exposure.met ?? exposure.seen ?? true;
  };
  const fresh = item => met(item) === false && !setSeen(setPool, item, met);
  const results = [];
  const pending = [];
  const served = { due: false };
  let index = -1;
  let current = null;
  let stopped = false;
  let ending = null;
  const view = () =>
    current && {
      index,
      total: length,
      item: current.item,
      answered: current.answered,
      feedback: current.feedback,
      heard: current.heard,
      audio: current.audio,
      plays: { ...current.plays },
      next: nextPlay(current.plays, { heard: current.heard }),
      why: current.why,
      fresh: current.fresh,
      stubborn: current.stubborn,
      targetLabel: current.targetLabel,
      preHelped: current.preHelped,
      unknown: current.unknown,
    };
  const close = (out, choiceId, skipped) => {
    current.answered = true;
    const row = {
      skillId: current.item.skillId,
      itemId: current.item.id,
      itemKey: current.item.itemKey,
      choiceId,
      skipped,
      verdict: out.verdict,
      independent: false,
      assisted: null,
      stored: null, // 저장 결과가 오기 전 — 오면 true · false
      eventId: out.eventId ?? null,
      plays: { ...current.plays },
    };
    results.push(row);
    // 근거 약속이 거부되면 저장 실패로 센다 — 거부를 그대로 두면 미처리 거부가 나고, 판 끝 Promise.all이 다른 답의 저장을
    // 기다리지 않고 끊기며, 그 행이 「다시 만나 맞힘」에 들었다(11-12 화면 검수 카본 A5).
    pending.push(
      Promise.resolve(out.evidence).then(
        evidence => {
          row.independent = evidence.independent === true;
          row.assisted = evidence.assisted ?? null;
          row.stored = evidence.stored !== false;
        },
        () => {
          row.independent = false;
          row.stored = false;
        },
      ),
    );
    return { ...row };
  };
  const skip = () => {
    if (!current || current.answered) return null;
    return close(
      coach.answer(current.pid, {
        correct: null,
        assessable: false,
        reason: current.heard ? 'unanswered' : 'audio',
      }),
      null,
      true,
    );
  };
  function pick() {
    const options = { audio: audioAvailable, lang };
    if (index === 0) options.set = { length, newLimit: NEXT_POLICY.newPerItem * length, more };
    return coach.recommend(pool, options);
  }
  // 할 것이 없을 때(idle) 처음 보는 문항으로 좁혀 한 번 더 묻는다. 없으면 null.
  // 처음 보는 문항 — 만난 적 없고 같은 지문 세트의 다른 문항도 만나지 않은 것(그래야 그 답이 측정 근거가 된다 — 아르곤 끝 판).
  function pickFresh() {
    const candidates = pool.filter(fresh);
    if (!candidates.length) return null;
    // pool: 'unseen' — 그 제시의 근거 칸에 「제품이 처음 보는 문항으로 좁힘」을 남긴다(단계 5가 측정 문항과 보통 채우기를 가른다).
    const again = coach.recommend(candidates, { audio: audioAvailable, lang, pool: 'unseen' });
    return again.status !== 'none' && fresh(again.selected) ? again : { ...again, fresh: false };
  }
  // 판을 닫는다(판 기록은 셸이 응답과 함께 — 여기서는 닫기만).
  function closeSet() {
    try {
      coach.finishSet?.({ kind: 'short', record: false });
    } catch {
      /* 판을 닫지 못해도 답은 이미 남았다 */
    }
  }
  // 끝 까닭의 사실은 전체 풀의 답과 처음 보는 문항으로 좁힌 답을 합친다 — 이미 본 문항이 채우기(idle)로 남아 있어도 처음 보는 문항이
  // 하루 상한 · 끈질긴 보류에 걸렸으면 그 사실이 끝 까닭이고 그 문장이 끝 줄이다(11-12 화면 검수 카본 A2 — 좁힌 답의 held · why를 버려
  // 새 문항이 남았는데 「새 문항은 여기까지」라고 하거나 끝 줄이 비었다).
  function end(picked, narrowed = null) {
    const facts = {
      ...picked.facts,
      held: picked.facts?.held ?? narrowed?.facts?.held,
      limited: picked.facts?.limited || narrowed?.facts?.limited,
    };
    const kind = endingOf({ ...picked, facts }, served).kind;
    ending = { kind, why: endingLine(kind, picked.why) ?? endingLine(kind, narrowed?.why) };
    closeSet();
    return null;
  }
  return Object.freeze({
    get total() {
      return length;
    },
    get current() {
      return view();
    },
    get ending() {
      return ending;
    },
    results: () => results.map(row => ({ ...row })),
    // 이 항목에 남은 처음 보는 문항 수 — 판 끝의 「N문항 더 하기」는 이것이 있을 때만(다음 판이 0문항으로 끝나지 않게, 카본 A1).
    freshLeft: () => pool.filter(fresh).length,
    // 판의 답이 모두 저장된 뒤 풀린다 — 혼자 맞힘은 그때의 값이다.
    settled: () => Promise.all(pending).then(() => results.map(row => ({ ...row }))),
    next() {
      if (stopped || ending) return null;
      if (current && !current.answered)
        throw Error('WORLD practice: answer or skip the current item first');
      index += 1;
      current = null;
      if (index >= length) {
        ending = { kind: 'done' };
        closeSet();
        return null;
      }
      // idle이면 늘 처음 보는 문항으로 좁혀 다시 묻는다 — 맨 앞 채우기가 우연히 처음 보는 문항이어도 같은 길로(그 제시의 근거 칸에
      // pool: 'unseen'이 늘 붙게 — Fable 다시 확인 N5).
      let picked = pick();
      let freshFill = false;
      if (picked.status === 'idle') {
        const narrowed = pickFresh();
        if (!narrowed || narrowed.fresh === false) return end(picked, narrowed);
        picked = narrowed;
        freshFill = picked.status === 'idle';
      }
      if (picked.status !== 'ready' && !freshFill) return end(picked);
      const item = picked.selected;
      if (picked.tier === 1) served.due = true;
      const pid = coach.present(item, setSeen(setPool, item, met) ? { firstExposure: false } : {});
      const listening = listeningOf(item);
      current = {
        item,
        pid,
        answered: false,
        feedback: null,
        heard: !listening,
        audio: listening ? 'pending' : 'none',
        plays: { allowed: allowedPlays(item), completed: 0, extra: 0 },
        // 처음 보는 채우기 문항에는 엔진의 「다 만났어요」를 쓰지 않는다 — 돌아온 것을 만나지 않은 판일 수 있다(아르곤 A1).
        // 놓친 단위의 「다시」가 차례를 기다리는 사이의 채우기(status ready · 이유 idle)에도 달지 않는다(Fable 5.2 최종 F3).
        why: freshFill || picked.why?.code === IDLE ? null : (picked.why?.line ?? null),
        fresh: freshFill,
        stubborn: picked.stubborn === true,
        targetLabel: picked.targetLabel ?? null,
        preHelped: false,
        // 「모르겠어요」는 지도 문항에 그 표지가 있을 때만(코치가 실어 준다 — 제품 문항 객체의 칸이 아니다).
        unknown: picked.unknownOption === true,
      };
      return view();
    },
    // 끈질긴 단위 문항의 힌트 먼저(설계 §3-5) — 「자꾸 놓치는 말 「…」 — 문제 속에서 먼저 찾아보세요」를 보인 것은 도움(hint)으로 남아
    // 그 답은 도움받은 답이다(근거를 부풀리지 않는다). 문항의 해설은 정답을 말하므로 답 뒤에만 보인다.
    preHelp() {
      if (!current || current.answered || current.preHelped) return false;
      coach.help(current.pid, 'hint');
      current.preHelped = true;
      return true;
    },
    replay() {
      if (!current || current.answered || !listeningOf(current.item)) return false;
      const kind = nextPlay(current.plays, { heard: current.heard });
      if (kind === 'first') {
        current.audio = 'pending';
        coach.delivery(current.pid, { audio: 'pending' });
      } else if (kind === 'extra') {
        coach.help(current.pid, 'replay');
        current.plays.extra += 1;
      }
      return kind;
    },
    delivery(status) {
      if (!current || current.answered || !listeningOf(current.item)) return false;
      if (!['pending', 'completed', 'failed'].includes(status))
        throw TypeError('WORLD practice: invalid audio state');
      if (current.heard) {
        if (status === 'completed') {
          current.plays.completed += 1;
          coach.delivery(current.pid, { audio: 'completed' });
        }
        return true;
      }
      current.audio = status;
      if (status === 'completed') {
        current.heard = true;
        current.plays.completed += 1;
      }
      coach.delivery(current.pid, { audio: status });
      return true;
    },
    answer(choiceId) {
      if (!current || current.answered || !current.heard) return null;
      if (!current.item.choices.some(choice => choice.id === choiceId))
        throw TypeError('WORLD practice: unknown choice');
      const out = coach.answer(current.pid, {
        correct: choiceId === current.item.correctId,
        assessable: true,
        choice: { selectedId: choiceId, correctId: current.item.correctId },
      });
      const row = close(out, choiceId, false);
      try {
        coach.help(current.pid, 'answer');
      } catch {
        /* The answer itself is already recorded. */
      }
      current.feedback = {
        verdict: row.verdict,
        choiceId,
        correctId: current.item.correctId,
      };
      return { ...row, correctId: current.item.correctId };
    },
    // 「모르겠어요」 — 그 선택지를 둔 문항(지도의 unknownOption)에서만. 놓침으로 적힌다.
    unknown() {
      if (!current || current.answered || !current.heard || !current.unknown) return null;
      const out = coach.answer(current.pid, {
        correct: null,
        unknown: true,
        assessable: true,
      });
      const row = close(out, null, false);
      try {
        coach.help(current.pid, 'answer');
      } catch {
        /* The answer itself is already recorded. */
      }
      current.feedback = {
        verdict: row.verdict,
        choiceId: null,
        correctId: current.item.correctId,
      };
      return { ...row, correctId: current.item.correctId };
    },
    skip,
    stop() {
      if (stopped) return;
      skip();
      stopped = true;
      current = null;
      if (!ending) closeSet();
    },
  });
}
