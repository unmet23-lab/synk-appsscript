// 4-2 WORLD 생활 — 새 길(atlasNext) 판 겉과 「돌아온 복습」 판정(단계 4 계획 §19). 옛 거울(life-trail.mjs)과 같은 겉
// (shown · help · delivery · answer · guided · release · metrics · dispose)을 새 코치(은행 world-life · 경험 world-life)로 잇는다.
// 판정 · 정답 · 진도는 제품이 정한 것 그대로이고, 새 코치에 싣는 값은 엔진의 뜻으로(§19-1 ②):
//   · 답은 늘 assessable: true — 생활 문항은 고르기 · 조립이라 늘 정답이 있다(엔진의 assessable은 「판정할 수 있는 답인가」, L1).
//   · 검수 밖 문항(lifeAssessable 밖) · 제품이 이미 만난 계열(productMet — 다시 하기 판 포함) · 튜터 안내 연습은 firstExposure: false
//     (기억에는 적고 측정에는 안 센다 — B (ㄱ) · M5 · M6).
//   · 카페 장면은 confounded 그대로(lifeMeasureItem) — 기억에 안 선다(C (ㄴ)).
//   · 설정(「한 단계씩 도움받기」)이 답 앞에 편 해설과 함께 낸 답은 시범 답(reason: 'demo') — 기억 · 측정의 근거가 아니다(D).
//     해설을 보인 사실은 그대로 help('explanation')로 적는다. 사람이 직접 연 해설은 사유 없이 — 놓침이다(정본 §3-2).
// 코치가 서기 전의 보임 · 도움 · 소리 · 첫 답은 차례대로 쌓아 두었다가 코치가 서면 그 차례로 흘려보낸다(L8). 코치가 끝내 서지 못하면
// (지금 판으로 정해짐 · 엔진 실패) 버리고 계기에 남긴다 — 그 답의 복습은 lifeDue의 다리(처음 만나는 장면)가 받는다.
// 판이 바뀌어 코치가 닫히면(retired) 슬롯과 쌓인 일을 비운다(M9) — 닫힌 코치의 제시 번호로 답하면 DISPOSED에 삼켜져 답이 사라진다.
import { lifeAssessable, lifeItem, lifeMeasureItem } from './life-items.mjs';
import { productMet } from './life-trail.mjs';

const DAY = 86_400_000;
const HELPS = ['explanation', 'hint', 'text', 'replay'];
const AUDIO = ['pending', 'completed', 'failed'];

// coach: () => 약속(코치 | null) — 처음 쓸 때 · 닫힌 뒤 다시 쓸 때 부른다. watch(made, fn): 그 코치가 판이 바뀌어 닫힐 때 fn(끊는 함수를 돌려준다).
// note(axis, detail): 계기. assessable: 측정 자격(시험만 바꾼다).
export function createLifeNext({
  coach = () => null,
  watch = () => () => {},
  snapshot = () => null,
  note = () => {},
  onRetired = () => {},
  assessable = lifeAssessable,
} = {}) {
  const slots = new Map();
  let queue = [];
  let made = null;
  let waiting = null;
  let unwatch = () => {};
  let generation = 0;
  let disposed = false;
  const quiet = fn => {
    try {
      return fn();
    } catch (error) {
      try {
        note('save', { ok: false, code: error?.code ?? 'LIFE_NEXT', dependent: true });
      } catch {}
      return null;
    }
  };

  // 판이 바뀌어 코치가 닫혔다 — 슬롯 · 쌓인 일을 비우고 다음 쓰임에서 코치를 다시 받는다. 화면은 안내 한 줄과 함께 닫는다(onRetired).
  function reset() {
    generation += 1;
    unwatch();
    unwatch = () => {};
    made = null;
    waiting = null;
    queue = [];
    slots.clear();
    quiet(() => onRetired());
  }

  function attach() {
    if (made || waiting || disposed) return;
    const at = generation;
    waiting = Promise.resolve()
      .then(() => coach())
      .then(
        value => {
          if (disposed || at !== generation) return;
          waiting = null;
          if (!value || typeof value.present !== 'function') return abandon('LIFE_NO_COACH');
          made = value;
          unwatch = quiet(() => watch(value, reset)) ?? (() => {});
          const work = queue;
          queue = [];
          for (const step of work) quiet(step);
        },
        () => {
          if (disposed || at !== generation) return;
          waiting = null;
          abandon('LIFE_COACH_FAILED');
        },
      );
  }

  // 코치가 끝내 서지 못했다 — 쌓인 일을 버리고 계기에 남긴다(그 답의 복습은 lifeDue의 다리가 받는다).
  function abandon(code) {
    const dropped = queue.length;
    queue = [];
    // 딸린 거절로 센다 — 코치를 못 연 까닭은 입구가 계기에 남기고(load), 버린 일은 그 결과다(연속 실패 수에는 넣지 않는다).
    if (dropped) quiet(() => note('save', { ok: false, code, dropped, dependent: true }));
  }

  // 코치가 있으면 바로, 없으면 쌓아 두고 코치를 청한다.
  function run(step) {
    if (disposed) return;
    if (made) {
      quiet(step);
      return;
    }
    queue.push(step);
    attach();
  }

  function present(slot) {
    if (slot.pid) return slot.pid;
    const first = slot.met === false && quiet(() => assessable(slot.item)) === true && !slot.guided;
    const pid = quiet(() =>
      made.present(lifeMeasureItem(slot.item), first ? {} : { firstExposure: false }),
    );
    if (pid) slot.pid = pid;
    return slot.pid;
  }

  function give(slot, kind) {
    if (slot.helped.has(kind)) return;
    if (present(slot) && quiet(() => made.help(slot.pid, kind)) !== null) slot.helped.add(kind);
  }

  const slotOf = key => (typeof key === 'string' ? (slots.get(key) ?? null) : null);

  return Object.freeze({
    // 문항이 보였다. helped: 제품이 이 문항의 도움을 이미 펼쳤다(설정 · 새로고침 뒤 이어 하기) — 보이자마자 도움으로 적는다.
    // 제품 이력 대조(productMet)는 보인 순간의 진도로 잰다 — 늦게 선 코치로 흘려보낼 때 방금 낸 답이 「이미 만남」으로 읽히지 않게.
    shown(key, item, { helped = false } = {}) {
      if (disposed || typeof key !== 'string' || !item) return null;
      let slot = slots.get(key);
      if (!slot) {
        slot = {
          key,
          item,
          pid: null,
          helped: new Set(),
          answered: false,
          guided: false,
          met: quiet(() => productMet(item, snapshot())),
        };
        slots.set(key, slot);
      }
      const at = slot;
      run(() => {
        present(at);
        // 옛 거울과 같이 — 이 판에 아직 도움이 없을 때만 해설로 적는다(글자로 보기 · 힌트 뒤에 해설을 덧붙이지 않는다).
        if (helped && at.helped.size === 0) give(at, 'explanation');
      });
      return slot.pid;
    },
    // 답하기 전에 연 도움(해설 펼침 'explanation' · 카페 힌트 'hint' · 글자로 보기 'text' · 느리게 'replay').
    help(key, kind = 'explanation') {
      const slot = slotOf(key);
      if (!slot || slot.answered || !HELPS.includes(kind)) return;
      run(() => give(slot, kind));
    },
    // 실제 재생기의 결과(카페 직원 말).
    delivery(key, audio) {
      const slot = slotOf(key);
      if (!slot || slot.answered || !AUDIO.includes(audio)) return;
      run(() => {
        if (present(slot)) quiet(() => made.delivery(slot.pid, { audio }));
      });
    },
    // 첫 답. helped: 제품이 그 답을 도움 받은 답으로 적었는가, helpBy: 그 도움을 누가 열었나('setting' — 설정이 스스로 · 'user').
    // 설정이 편 도움과 함께 낸 답은 시범 답이다(D). 판정 띠가 정답 · 해설을 보이므로 답 뒤 「정답 봄」을 적는다(되짚기).
    answer(key, { correct, choiceId = null, correctId = null, helped = false, helpBy = null } = {}) {
      const slot = slotOf(key);
      if (!slot || slot.answered || typeof correct !== 'boolean') return null;
      slot.answered = true;
      const demo = helped && helpBy === 'setting';
      const choice =
        typeof choiceId === 'string' && typeof correctId === 'string'
          ? { choice: { selectedId: choiceId, correctId } }
          : {};
      run(() => {
        if (!present(slot)) return;
        if (helped && slot.helped.size === 0) give(slot, 'explanation');
        const result = quiet(() =>
          made.answer(slot.pid, {
            correct,
            assessable: true,
            ...(demo ? { reason: 'demo' } : {}),
            ...choice,
          }),
        );
        result?.stored?.then?.(
          ok => {
            if (ok === false) quiet(() => note('save', { ok: false, code: 'LIFE_ANSWER_UNSAVED' }));
          },
          () => {},
        );
        quiet(() => made.help(slot.pid, 'answer'));
      });
      return null;
    },
    // 튜터 「이 표현 같이 연습」: 복습 원고를 미리 보인다 — 보임(처음 아님) + 해설, 답은 없다(M5).
    guided(item) {
      if (disposed || !item) return;
      const key = `guided:${item.itemKey}`;
      if (slots.has(key)) return;
      const slot = {
        key,
        item,
        pid: null,
        helped: new Set(),
        answered: false,
        guided: true,
        met: true,
      };
      slots.set(key, slot);
      run(() => give(slot, 'explanation'));
    },
    // 지금 화면의 판을 놓는다(같은 문항을 새 판으로 다시 보일 때).
    release(key) {
      slots.delete(key);
    },
    metrics: () => ({
      slots: slots.size,
      presented: [...slots.values()].filter(slot => slot.pid).length,
      answered: [...slots.values()].filter(slot => slot.answered).length,
      queued: queue.length,
      coach: made ? 'ready' : waiting ? 'waiting' : 'none',
    }),
    dispose() {
      disposed = true;
      unwatch();
      queue = [];
      slots.clear();
    },
  });
}

// ── 돌아온 복습(§19-1 ③ · ④ · ⑤) ──
// lifeDue = ① 방금 놓친 것(그 레슨 시도에서 틀렸거나 사람이 직접 도움을 연 문항의 복습 — 새 장면으로 한 번 답할 때까지)
//         + ② 처음 만나는 장면(복습의 생활 단위에 엔진 기억 줄이 없고 본문항 첫 답에서 하루가 지난 것 — 단위마다 하나, 한 번만)
//         + ③ 돌아온 단위마다 복습 하나(엔진 due — 아직 답하지 않은 것 → 마지막 답이 가장 오래된 것 → 원고 차례).
// 한 단위가 둘 이상에 걸리면 한 번만 센다(①이 먼저). 생활 단위가 없는 복습(19개)은 ①로만 돌아온다(설계 주인 A (가)).
//   snapshot — 진도 exportSnapshot() · lessons — LESSONS(원고 차례) · unitsOf(review) — 그 복습 문항의 지도 생활 단위들
//   memory — 코치 summary().units(기억 줄이 있는 단위: unit → { lastAt, dueAt }) · due — 코치 due()(돌아온 단위, 기억률 낮은 차례)
// 돌려줌: { items: [{ id, unit, why, at }], ids, nextAt, times, upcoming: [{ id, unit, at }], stuck }
//   items[].at — 그 복습이 돌아온 때(방금 놓친 것: 본문항 답 · 다리: 그 하루 뒤 · 엔진: 그 단위의 다음 돌아올 때) — 알림이 「이미 알린 복습」을
//   가르는 고정 시각이다(지금 시각을 쓰면 알림을 보낼 때마다 새 복습으로 읽힌다).
//   nextAt — 지금 열 것이 없을 때 그릴 「다음 복습은 ○일쯤」(앞으로 열릴 때 가운데 가장 이른 것), times — 돌아온 것 · 앞으로 열릴 것의 때 모두(알림),
//   upcoming — 단위마다 그때 열릴 복습(「곧 돌아올 표현」, 6개까지), stuck — 한 번 답했는데도 기억 줄이 없는 복습(다시 열지 않고 계기에).
export function lifeDue({ snapshot, lessons = [], unitsOf, memory = [], due = [], now = Date.now() }) {
  const reviews = Object.values(snapshot?.reviews ?? {}).filter(review => review && typeof review.id === 'string');
  const order = new Map();
  lessons.forEach((lesson, l) =>
    (lesson?.questions ?? []).forEach((question, q) => order.set(question?.review?.id, l * 1000 + q)),
  );
  const mainOf = review => snapshot?.lessons?.[review.lessonId]?.answers?.[review.questionId] ?? null;
  const openSince = review => {
    const main = mainOf(review);
    return main && Number.isFinite(main.at) && !(review.lastAt > main.at) ? main : null;
  };
  const lines = new Map((memory ?? []).map(line => [line.unit, line]));
  const unitsByReview = new Map(reviews.map(review => [review.id, unitsOf(review) ?? []]));
  const items = [];
  const counted = new Set();
  const listed = new Set();
  const take = (review, unit, why, at) => {
    items.push({ id: review.id, unit, why, at });
    listed.add(review.id);
    for (const u of unitsByReview.get(review.id)) counted.add(u);
  };
  // ① 방금 놓친 것
  const missed = reviews
    .filter(review => {
      const main = openSince(review);
      return main && (main.correct === false || (main.helped === true && main.helpSource !== 'setting'));
    })
    .sort((a, b) => mainOf(a).at - mainOf(b).at || a.id.localeCompare(b.id));
  for (const review of missed) take(review, unitsByReview.get(review.id)[0] ?? null, 'soon', mainOf(review).at);
  // ② 처음 만나는 장면 — 단위마다 하나(본문항 답이 가장 이른 것부터)
  const fresh = reviews
    .filter(review => {
      const units = unitsByReview.get(review.id);
      return units.length && units.every(unit => !lines.has(unit)) && openSince(review);
    })
    .sort((a, b) => mainOf(a).at - mainOf(b).at || a.id.localeCompare(b.id));
  const bridging = [];
  for (const review of fresh) {
    if (listed.has(review.id)) continue;
    const units = unitsByReview.get(review.id);
    if (units.some(unit => counted.has(unit))) continue;
    const at = mainOf(review).at + DAY;
    if (at <= now) take(review, units[0], 'first', at);
    else {
      bridging.push({ id: review.id, unit: units[0], at });
      for (const unit of units) counted.add(unit); // 같은 단위의 다른 복습이 다리를 또 세지 않게
    }
  }
  // ③ 돌아온 단위마다 복습 하나 — 아직 답하지 않은 것 → 마지막 답이 가장 오래된 것 → 원고 차례(돌아올 때마다 다른 장면, L5).
  const answered = review => !openSince(review);
  const pickOrder = (a, b) =>
    Number(answered(a)) - Number(answered(b)) ||
    (a.lastAt ?? 0) - (b.lastAt ?? 0) ||
    (order.get(a.id) ?? Number.POSITIVE_INFINITY) - (order.get(b.id) ?? Number.POSITIVE_INFINITY) ||
    a.id.localeCompare(b.id);
  for (const row of due ?? []) {
    if (counted.has(row.unit)) continue;
    const candidates = reviews.filter(
      review => !listed.has(review.id) && unitsByReview.get(review.id).includes(row.unit),
    );
    if (!candidates.length) continue;
    candidates.sort(pickOrder);
    const dueAt = lines.get(row.unit)?.dueAt;
    take(candidates[0], row.unit, 'due', Number.isFinite(dueAt) ? dueAt : now);
  }
  // 앞으로 열릴 때 — 열 수 있는 복습이 있는 생활 단위의 다음 돌아올 때(F) · 다리의 하루. 단위마다 그때 열릴 복습 하나(upcoming).
  const dueNow = new Set((due ?? []).map(row => row.unit));
  const upcoming = [...bridging];
  for (const [unit, line] of lines) {
    if (counted.has(unit) || dueNow.has(unit) || !Number.isFinite(line.dueAt) || line.dueAt <= now) continue;
    const candidates = reviews.filter(review => unitsByReview.get(review.id).includes(unit));
    if (!candidates.length) continue;
    candidates.sort(pickOrder);
    upcoming.push({ id: candidates[0].id, unit, at: line.dueAt });
  }
  upcoming.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const times = [...items.map(item => item.at), ...upcoming.map(row => row.at)].sort((a, b) => a - b);
  const stuck = reviews
    .filter(review => {
      const units = unitsByReview.get(review.id);
      return units.length && units.every(unit => !lines.has(unit)) && mainOf(review) && !openSince(review);
    })
    .map(review => review.id);
  return {
    items,
    ids: items.map(item => item.id),
    nextAt: upcoming[0]?.at ?? null,
    times,
    upcoming: upcoming.slice(0, 6),
    stuck,
  };
}

// 복습 문항 → 지도의 생활 단위(코치 itemUnits(itemKey)에서 — 제품이 단위를 짓지 않는다).
export function lifeUnitsOf(coach, lessons) {
  const byId = new Map();
  for (const lesson of lessons ?? []) for (const question of lesson?.questions ?? []) byId.set(question?.review?.id, { lesson, question });
  const cache = new Map();
  return review => {
    if (cache.has(review.id)) return cache.get(review.id);
    const found = byId.get(review.id);
    const item = found ? lifeItem({ lesson: found.lesson, question: found.question, review: true }) : null;
    const units = item
      ? (coach.itemUnits(item.itemKey) ?? []).filter(row => row.kind === 'life').map(row => row.unit)
      : [];
    cache.set(review.id, units);
    return units;
  };
}

// ── 셸의 판정 넣기(§19-1 ⑤ M7) ──
// 새 길 깃발이 켜진 WORLD 문서의 생활 진도에 「돌아온 복습」 판정(lifeDue)을 넣고, 문서 시작 때 생활 코치를 연다(M7 — 홈의 첫 그림을 막지 않는다).
//   확인 중 — 코치를 여는 중 · 이 기기에 그 판의 요약이 없음 · 보기가 아무것도 얹지 못함(waitAll): 수 · 날짜를 그리지 않는다.
//   엔진 — lifeDue. 지금 판으로 정해지면(코치가 null — 판 정하기 · 엔진 받기 실패) 판정을 거둔다: 이 문서는 진도 간격 그대로다
//   (첫 받기를 못 한 문서를 그 문서 동안 지금 판으로 두는 짧은 연습과 같다 — 다시 열면 · 주인이 바뀌면 다시 정한다).
//   판이 바뀌면(retired) 확인 중으로 두고 코치를 다시 받는다. 지금 판도 붙들지 않는다(§19-3 7 — 설계 주인 11-13): 입구가 지금 판이
//   풀렸다고 알리거나(reopened — 계정을 못 읽은 일시 실패 뒤 다시 읽음 · 낮춘 판 되돌림 · 꺼짐 표지 뒤 켜짐) 화면이 코치를 청하면(coach()
//   — 레슨 · 복습을 열 때마다) 판을 다시 묻고, 묻는 동안은 지금 판 그대로 그린다. 새 길이면 확인 중 → 엔진으로 간다.
// 엔진의 보기가 바뀐 것(요약 받기 · 다른 코치의 쓰기)을 제품에 알리는 코치 겉은 없다 — 판정은 진도가 그릴 때마다 다시 재고, 확인 중으로
// 잰 동안만 every(늘려 가며 한도까지)마다 다시 보아 엔진이 되면 그리기를 부른다.
//   open() — 생활 코치 약속(셸의 lifeCoach — 없으면 null), retired(coach, fn) — 그 코치가 판이 바뀌어 닫힐 때, reopened(fn) — 입구가
//   지금 판이 풀렸다고 알릴 때(끊는 함수를 돌려준다), progress — 생활 진도(setDueSource),
//   lessons — 원고 차례(LESSONS), note(kind, outcome) — 계기, timers — 시험만.
// 돌려줌: { judge(snapshot, now) — 진도와 같은 판정(null이면 지금 판), coach() — 지금 생활 코치 약속, nextAt(reviewId) — 그 복습의 생활 단위가
//   다음에 돌아올 때(엔진 상태가 아니거나 기억 줄이 없으면 null — 복습 결과 글 M4), state(), dispose() }.
export function watchLifeDue({
  open,
  retired = () => () => {},
  reopened = () => () => {},
  progress,
  lessons = [],
  note = () => {},
  every = 3000,
  most = 60_000,
  timers = globalThis,
}) {
  const CHECKING = Object.freeze({ state: 'checking' });
  let coach = null;
  let unitsOf = null;
  let opening = Promise.resolve(null);
  let asking = null; // 지금 판에서 다시 묻는 중(그동안은 지금 판 그대로 그린다)
  let phase = 'checking'; // 'checking' | 'engine' | 'old'
  let generation = 0;
  let disposed = false;
  let unwatch = () => {};
  let timer = null;
  let wait = every;
  const stuck = new Set();
  const quiet = fn => {
    try {
      return fn();
    } catch {
      return null;
    }
  };

  // 이 기기에 그 판의 요약이 있고 보기가 얹을 수 있는가 — 아니면 확인 중이다.
  const settled = summary => summary?.storage?.base === true && summary.storage.waiting !== true;

  function judge(snapshot, now = Date.now()) {
    if (disposed || phase === 'old') return null;
    if (!coach) return CHECKING;
    const summary = quiet(() => coach.summary());
    const due = settled(summary) ? quiet(() => coach.due()) : null;
    if (!Array.isArray(due)) {
      schedule();
      return CHECKING;
    }
    const out = lifeDue({ snapshot, lessons, unitsOf, memory: summary.units, due, now });
    // 한 번 답했는데도 기억 줄이 없는 복습은 다시 열지 않고 계기에(복습마다 한 번 — 문항 번호는 싣지 않는다).
    for (const id of out.stuck)
      if (!stuck.has(id)) {
        stuck.add(id);
        quiet(() => note('save', { ok: false, code: 'LIFE_BRIDGE_STUCK', dependent: true }));
      }
    return { state: 'engine', ...out };
  }
  const source = (state, now) => judge(state, now);

  // 확인 중으로 잰 동안 — 얹을 수 있게 되면 그리기를 부른다(진도가 화면에 알린다).
  function schedule() {
    if (timer || disposed || !coach) return;
    timer = timers.setTimeout(() => {
      timer = null;
      if (disposed || !coach) return;
      if (settled(quiet(() => coach.summary()))) {
        wait = every;
        quiet(() => progress.setDueSource(source));
      } else {
        wait = Math.min(most, wait * 2);
        schedule();
      }
    }, wait);
  }
  function stop() {
    if (timer) timers.clearTimeout(timer);
    timer = null;
  }

  const usable = made => Boolean(made) && typeof made.summary === 'function';
  // 받은 코치로 엔진 판정을 넣는다 — 판이 바뀌어 그 코치가 닫히면(retired) 다시 받는다.
  function adopt(made, at) {
    coach = made;
    unitsOf = lifeUnitsOf(made, lessons);
    phase = 'engine';
    unwatch =
      quiet(() =>
        retired(made, () => {
          if (!disposed && at === generation) attach();
        }),
      ) ?? (() => {});
    quiet(() => progress.setDueSource(source));
    return made;
  }
  function attach() {
    const at = ++generation;
    stop();
    unwatch();
    unwatch = () => {};
    coach = null;
    unitsOf = null;
    asking = null;
    phase = 'checking';
    wait = every;
    quiet(() => progress.setDueSource(source));
    opening = Promise.resolve()
      .then(() => open())
      .catch(() => null)
      .then(made => {
        if (disposed || at !== generation) return null;
        if (!usable(made)) {
          phase = 'old';
          quiet(() => progress.setDueSource(null));
          return null;
        }
        return adopt(made, at);
      });
    return opening;
  }
  // 지금 판에서 판을 다시 묻는다(§19-3 7) — 묻는 동안은 지금 판 그대로(진도 간격), 새 길이면 엔진 판정을 넣는다. 겹친 물음은 한 번.
  function reask() {
    if (disposed || phase !== 'old') return opening;
    if (asking) return asking;
    const at = generation;
    const pending = Promise.resolve()
      .then(() => open())
      .catch(() => null)
      .then(made => {
        if (asking === pending) asking = null;
        if (disposed || at !== generation || phase !== 'old' || !usable(made)) return null;
        return adopt(made, at);
      });
    asking = pending;
    opening = pending;
    return pending;
  }
  const unreopen =
    quiet(() =>
      reopened(() => {
        if (!disposed && phase === 'old') void reask();
      }),
    ) ?? (() => {});
  attach();

  return Object.freeze({
    judge,
    // 화면이 코치를 청할 때(레슨 · 복습을 열 때) — 지금 판이면 판을 다시 묻는다(§19-3 7).
    coach: () => (phase === 'old' ? reask() : opening),
    nextAt(reviewId) {
      if (disposed || phase !== 'engine' || !coach || typeof reviewId !== 'string') return null;
      const summary = quiet(() => coach.summary());
      if (!settled(summary)) return null;
      const units = new Set(unitsOf({ id: reviewId }));
      const times = (summary.units ?? [])
        .filter(line => units.has(line.unit) && Number.isFinite(line.dueAt))
        .map(line => line.dueAt);
      return times.length ? Math.min(...times) : null;
    },
    state: () => (disposed ? 'disposed' : phase),
    dispose() {
      disposed = true;
      generation += 1;
      stop();
      unwatch();
      unreopen();
      asking = null;
      coach = null;
    },
  });
}
