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
// (지금 판으로 정해짐 · 엔진 실패) 버리고 계기에 남긴다. 그 답이 본문항 답이면 그 복습은 lifeDue가 진도 기록으로 받고(놓쳤으면 ①, 맞혔으면
// ② 다리), 놓친 복습 답이면 ①이 붙든다. 혼자 맞힌 복습 답이 버려지면 그 표현은 기억 줄 없이 stuck으로 남는다(받아들인 틈 — 계획 §2 4-8 줄).
// 판이 바뀌어 코치가 닫히면(retired) 슬롯과 쌓인 일을 비운다(M9) — 닫힌 코치의 제시 번호로 답하면 DISPOSED에 삼켜져 답이 사라진다.
// 코치의 기본 판이 낡아(30분 쉼 · 새벽 4시) 새로 열리며 앞 제시를 놓았으면(PRESENTATION_GONE) 그 문항을 다시 보이고 잇는다(onSlot).
import { lifeAssessable, lifeItem, lifeMeasureItem } from './life-items.mjs';
import { productMet } from './life-trail.mjs';

const DAY = 86_400_000;
const SOON = 60_000; // 지금 판의 「조금 뒤」 — 진도가 놓친 답에 주는 다음 때(life-progress.mjs MINUTE)
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

  // 코치가 끝내 서지 못했다 — 쌓인 일을 버리고 계기에 남긴다(그 답의 복습은 lifeDue가 진도 기록으로 받는다 — 맨 위 주석).
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

  // 코치의 기본 판이 낡아(30분 쉼 · 새벽 4시) 새로 열리며 앞 판의 제시 번호를 놓았다 — 문서 동안 들고 있던 이 문항의 번호로는 도움 · 소리 ·
  // 답이 「끝났거나 모르는 제시」로 던져져 엔진에 안 남았다(Fable 5.2 합친 끝 판 F4). 엔진의 판 수명 규칙은 그대로 두고, 그 자리에서 문항을
  // 다시 보이고(처음 아님) 앞 제시에 실었던 도움을 다시 실은 뒤(도움 받은 답이 혼자 맞힘으로 적히지 않게) 그 일을 한 번 더 한다.
  // 답 없는 앞 제시는 그대로 둔다. 다시 보여 이은 수는 계기에 따로(LIFE_REPRESENTED).
  function onSlot(slot, call) {
    try {
      return call(slot.pid);
    } catch (error) {
      if (error?.code !== 'PRESENTATION_GONE' || disposed || !made) throw error;
      const kinds = [...slot.helped];
      slot.pid = null;
      slot.helped = new Set();
      slot.pid = made.present(lifeMeasureItem(slot.item), { firstExposure: false }) ?? null;
      if (!slot.pid) throw error;
      for (const kind of kinds) if (made.help(slot.pid, kind) !== null) slot.helped.add(kind);
      quiet(() => note('save', { ok: false, code: 'LIFE_REPRESENTED', dependent: true }));
      return call(slot.pid);
    }
  }

  function give(slot, kind) {
    if (slot.helped.has(kind)) return;
    if (present(slot) && quiet(() => onSlot(slot, pid => made.help(pid, kind))) !== null) slot.helped.add(kind);
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
        if (present(slot)) quiet(() => onSlot(slot, pid => made.delivery(pid, { audio })));
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
          onSlot(slot, pid =>
            made.answer(pid, {
              correct,
              assessable: true,
              ...(demo ? { reason: 'demo' } : {}),
              ...choice,
            }),
          ),
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
    // 화면이 이 겉으로 시도를 열었다 — 코치를 미리 청해 판 바뀜(retired)을 듣는다. 첫 문항 전(소개 · 이야기 장면 · 카페 인사)에 판이 지금
    // 판으로 내려가도 화면이 닫히고 다음 시도는 그때의 판으로 기록부를 고른다(Fable 5.2 합친 끝 판 F7 — 첫 보임 때에야 청하면 그 전의
    // 판 바뀜을 못 들어, 그 레슨의 보임 · 답이 어느 기록부에도 안 갔다).
    prepare() {
      if (!disposed) attach();
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
// 앞 상태는 진도의 복습 기록(lapses · streak · lastAt · dueAt — 레슨을 다시 하기로 열어 본문항 답이 비워져도 남는 줄)에서 읽는다(Fable 5.2
// 합친 끝 판 F2 — 본문항 답이 지금 레슨 기록에 있는가로 가르면 마친 레슨을 다시 열기만 해도 ① · ②의 대기가 사라졌다). 진도의 저장 꼴은 그대로다.
//   놓친 것 — 놓친 적이 있고(lapses > 0) 그 뒤 아직 혼자 못 맞혔다(streak 0): 본문항을 틀렸거나 직접 도움을 연 답, 새 장면 복습을 틀렸거나
//            도움 받고 낸 답(설정이 편 도움과 함께 맞힌 본문항은 놓침이 아니다 — 진도가 lapses를 세지 않는다).
//   처음   — 놓친 적도 복습한 적도 없다(lapses 0 · streak 0): 본문항만 맞혔다. 그 lastAt이 본문항 답 시각이다(복습 답은 lapses나 streak를 남긴다).
// lifeDue = ① 방금 놓친 것(놓친 것 — 혼자 맞힐 때까지, Fable 5.2 합친 끝 판 F1 · 설계 주인 11-13)
//         + ② 처음 만나는 장면(처음이고 그 생활 단위에 엔진 기억 줄이 없으며 본문항 답에서 하루가 지난 것 — 단위마다 하나)
//         + ③ 돌아온 단위마다 복습 하나(엔진 due — 아직 복습하지 않은 것 → 마지막 답이 가장 오래된 것 → 원고 차례).
// ①이 돌아오는 때는 지금 판의 값(마지막 답 1분 뒤 — 같은 「조금 뒤」) 그대로다 — 엔진 dueAt · 기억 줄을 읽지 않는다(방금 놓친 것의
// 차례는 제품이 정한다, 정본 §3-5). 그때가 아직이면 「앞으로 열릴 것」에 든다. 그래서 틀린 복습 · 단위 없는 복습(19개)도 혼자 맞힐 때까지
// 「조금 뒤」 돌아온다(화면 글 「조금 뒤 (새 장면에서) 다시 나와요」가 참이 된다). ①은 놓친 문항마다(여는 수 · 목록 — 같은 단위의 놓친 복습
// 둘은 둘, 화면이 말하는 「표현 N개」는 진도 요약이 표현 글로 묶는다 — F5), ② · ③은 단위마다 하나. 한 단위가 ①과 ② · ③에 함께 걸리면
// ①로 한 번만 센다(①의 때가 아직이어도 — GPT 합친 끝 판 GC3). 생활 단위가 없는 복습은 ①로만 돌아온다(설계 주인 A (가)).
// stuck — 혼자 맞혔는데도 생활 단위에 기억 줄이 없는 복습(옛 진도 · 지금 판 문서에서 복습까지 답한 표현, 코치가 서기 전에 버려진 · 저장이
// 거절된 맞힌 복습 답 — 받아들인 틈, 4-8 켜기 전에 메움: 계획 §2 4-8 줄). 다시 열지 않고 계기에(watchLifeDue).
//   snapshot — 진도 exportSnapshot() · lessons — LESSONS(원고 차례) · unitsOf(review) — 그 복습 문항의 지도 생활 단위들
//   memory — 코치 summary().units(기억 줄이 있는 단위: unit → { lastAt, dueAt }) · due — 코치 due()(돌아온 단위, 기억률 낮은 차례)
// 돌려줌: { items: [{ id, unit, why, at }], ids, nextAt, times, upcoming: [{ id, unit, at }], stuck }
//   items[].at — 그 복습이 돌아온 때(방금 놓친 것: 마지막 답 1분 뒤 · 다리: 본문항 답 하루 뒤 · 엔진: 그 단위의 다음 돌아올 때) — 알림이 「이미 알린
//   복습」을 가르는 고정 시각이다(지금 시각을 쓰면 알림을 보낼 때마다 새 복습으로 읽힌다).
//   nextAt — 지금 열 것이 없을 때 그릴 「다음 복습은 ○일쯤」(앞으로 열릴 때 가운데 가장 이른 것), times — 돌아온 것 · 앞으로 열릴 것의 때 모두(알림),
//   upcoming — 그때 열릴 복습(아직 때가 안 된 ① · 다리 · 단위마다 하나 — 「곧 돌아올 표현」, 6개까지), stuck — 위.
export function lifeDue({ snapshot, lessons = [], unitsOf, memory = [], due = [], now = Date.now() }) {
  const reviews = Object.values(snapshot?.reviews ?? {}).filter(review => review && typeof review.id === 'string');
  const order = new Map();
  lessons.forEach((lesson, l) =>
    (lesson?.questions ?? []).forEach((question, q) => order.set(question?.review?.id, l * 1000 + q)),
  );
  const missed = review => review.lapses > 0 && !(review.streak > 0);
  const fresh = review => !(review.lapses > 0) && !(review.streak > 0);
  const timeOf = value => (Number.isFinite(value) ? value : 0);
  const lines = new Map((memory ?? []).map(line => [line.unit, line]));
  const unitsByReview = new Map(reviews.map(review => [review.id, unitsOf(review) ?? []]));
  const items = [];
  const upcoming = [];
  const counted = new Set();
  const listed = new Set();
  const hold = review => {
    listed.add(review.id);
    for (const u of unitsByReview.get(review.id)) counted.add(u);
  };
  const take = (review, unit, why, at) => {
    items.push({ id: review.id, unit, why, at });
    hold(review);
  };
  // ① 방금 놓친 것 — 혼자 맞힐 때까지. 마지막 답에서 「조금 뒤」(SOON)가 지나면 돌아온 것, 아직이면 앞으로 열릴 것(그 단위는 이미 ①이 센다).
  // 진도의 간격 칸(dueAt · intervalDays)은 읽지 않는다(L7) — 지금 판이 놓친 답에 주는 값(1분)을 그 답 시각에 더한다.
  const soonAt = review => timeOf(review.lastAt) + SOON;
  const soon = reviews.filter(missed).sort((a, b) => soonAt(a) - soonAt(b) || a.id.localeCompare(b.id));
  for (const review of soon) {
    const unit = unitsByReview.get(review.id)[0] ?? null;
    const at = soonAt(review);
    if (at <= now) take(review, unit, 'soon', at);
    else {
      upcoming.push({ id: review.id, unit, at });
      hold(review);
    }
  }
  // ② 처음 만나는 장면 — 단위마다 하나(본문항 답이 가장 이른 것부터)
  const first = reviews
    .filter(review => {
      const units = unitsByReview.get(review.id);
      return units.length && units.every(unit => !lines.has(unit)) && fresh(review) && Number.isFinite(review.lastAt);
    })
    .sort((a, b) => a.lastAt - b.lastAt || a.id.localeCompare(b.id));
  for (const review of first) {
    if (listed.has(review.id)) continue;
    const units = unitsByReview.get(review.id);
    if (units.some(unit => counted.has(unit))) continue;
    const at = review.lastAt + DAY;
    if (at <= now) take(review, units[0], 'first', at);
    else {
      upcoming.push({ id: review.id, unit: units[0], at });
      for (const unit of units) counted.add(unit); // 같은 단위의 다른 복습이 다리를 또 세지 않게
    }
  }
  // ③ 돌아온 단위마다 복습 하나 — 아직 복습하지 않은 것 → 마지막 답이 가장 오래된 것 → 원고 차례(돌아올 때마다 다른 장면, L5).
  // 놓친 것은 ①이 단위째 세었으므로 여기 후보에 들지 않는다.
  const pickOrder = (a, b) =>
    Number(!fresh(a)) - Number(!fresh(b)) ||
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
  // 때가 지났나는 호스트 판정(요약 줄의 due — 서버로 맞춘 시각으로 잰 것)으로 잰다. 기기 시계로 재면 기기가 서버보다 앞설 때 그 사이의
  // 단위가 지금 것(due()는 호스트 시계)에도 앞으로의 것에도 없어 날짜 · 알림에서 사라졌다. 판정이 없는 줄만 기기 시계로. 지났는데 돌아온
  // 목록에 없는 단위는 그대로 세지 않는다(위 규칙). 한 복습은 한 번만 — 단위가 여럿인 복습이 두 번 들지 않게(카본 합친 끝 판 C4).
  const past = line => (typeof line.due === 'boolean' ? line.due : line.dueAt <= now);
  const dueNow = new Set((due ?? []).map(row => row.unit));
  const picked = new Set(upcoming.map(row => row.id));
  // 이른 때부터 고른다 — 단위가 둘인 복습은 그 가운데 이른 때에 한 번 든다. 기억 줄 차례로 고르면 늦은 단위가 그 복습을 먼저 가져가 이른
  // 때가 날짜 · 알림에서 빠졌다(카본 A1 · GPT GA3 처리 판). 아직 때가 안 된 ① · 다리의 복습은 그 단위를 이미 세어 아래 후보와 겹치지 않는다.
  const ahead = [...lines]
    .filter(([unit, line]) => !(counted.has(unit) || dueNow.has(unit) || !Number.isFinite(line.dueAt) || past(line)))
    .sort((a, b) => a[1].dueAt - b[1].dueAt);
  for (const [unit, line] of ahead) {
    const candidates = reviews.filter(
      review => !picked.has(review.id) && unitsByReview.get(review.id).includes(unit),
    );
    if (!candidates.length) continue;
    candidates.sort(pickOrder);
    picked.add(candidates[0].id);
    upcoming.push({ id: candidates[0].id, unit, at: line.dueAt });
  }
  upcoming.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const times = [...items.map(item => item.at), ...upcoming.map(row => row.at)].sort((a, b) => a - b);
  const stuck = reviews
    .filter(review => {
      const units = unitsByReview.get(review.id);
      return units.length && units.every(unit => !lines.has(unit)) && review.streak > 0;
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
//   풀렸다고 알리거나(reopened — 지금 판을 준 뒤 새 길 코치를 주게 되면 까닭이 무엇이든: 일시 실패 뒤 다시 읽음 · 낮춘 판 되돌림 · 꺼짐 표지 뒤
//   켜짐 · 엔진을 못 받은 뒤 됨, 계정 · 손님 모두 — Fable 5.2 끝 판 둘째 F2) 화면이 코치를 청하면(coach()
//   — 레슨 · 복습을 열 때마다) 판을 다시 묻고, 묻는 동안은 지금 판 그대로 그린다. 새 길이면 확인 중 → 엔진으로 간다.
// 엔진의 보기가 바뀐 것(요약 받기 · 다른 코치의 쓰기)을 제품에 알리는 코치 겉은 없다 — 판정은 진도가 그릴 때마다 다시 재고, 확인 중으로
// 잰 동안만 every(늘려 가며 한도까지)마다 다시 보아 엔진이 되면 그리기를 부른다.
//   open() — 생활 코치 약속(셸의 lifeCoach — 없으면 null), retired(coach, fn) — 그 코치가 판이 바뀌어 닫힐 때, reopened(fn) — 입구가
//   지금 판이 풀렸다고 알릴 때(끊는 함수를 돌려준다), progress — 생활 진도(setDueSource),
//   lessons — 원고 차례(LESSONS), note(kind, outcome) — 계기, noted — LIFE_BRIDGE_STUCK을 센 복습(기본은 이 기기의 주인마다 — stuckBook),
//   timers — 시험만.
// 돌려줌: { judge(snapshot, now) — 진도와 같은 판정(null이면 지금 판), coach() — 지금 생활 코치 약속, nextAt(reviewId) — 그 복습의 생활 단위가
//   다음에 돌아올 때(엔진 상태가 아니거나 기억 줄이 없으면 null — 복습 결과 글 M4), state(), dispose() }.
const STUCK_GRACE = 120_000;
// LIFE_BRIDGE_STUCK을 이미 센 복습 — 이 기기 · 이 주인에서 한 번(F8). 복습 번호만 담는다(학습자 신원 · 답은 없다, 진도 기록 밖의 열쇠라
// 진도의 저장 꼴은 그대로다). 저장소를 못 쓰면 이 문서 동안만 센다.
// 저장소는 부를 때마다 읽는다 — 같은 기기의 다른 탭이 그 사이 센 것도 본다(만들 때 한 번만 읽으면 탭마다 한 번씩 세었다, GPT Fable 처리 다시
// 검수 GC3). 저장소에 닿는 것 자체가 던지는 문서(막힌 저장소 · 보안 오류 — localStorage 속성 읽기가 던진다)는 이 문서 동안만 메모리에(GC2).
const localStore = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
export function stuckBook(owner, storage = localStore()) {
  const key = `synk.life.stuck.v1:${encodeURIComponent(String(owner ?? 'guest'))}`;
  const mine = new Set(); // 이 문서가 센 것 — 저장소를 못 읽거나 못 써도 이 문서 안에서는 한 번
  const stored = () => {
    try {
      const list = JSON.parse(storage?.getItem?.(key) ?? '[]');
      return Array.isArray(list) ? list.filter(id => typeof id === 'string').slice(-400) : [];
    } catch {
      return [];
    }
  };
  return Object.freeze({
    has: id => mine.has(id) || stored().includes(id),
    add(id) {
      mine.add(id);
      try {
        storage?.setItem?.(key, JSON.stringify([...new Set([...stored(), id])].slice(-400)));
      } catch {}
    },
  });
}

export function watchLifeDue({
  open,
  retired = () => () => {},
  reopened = () => () => {},
  progress,
  lessons = [],
  note = () => {},
  noted = stuckBook(progress?.owner),
  every = 3000,
  most = 60_000,
  timers = globalThis,
}) {
  const CHECKING = Object.freeze({ state: 'checking' });
  let coach = null;
  let unitsOf = null;
  let opening = Promise.resolve(null);
  let asking = null; // 지금 판에서 다시 묻는 중(그동안은 지금 판 그대로 그린다)
  // 묻는 사이(확인 중 · 다시 묻는 중)에 판이 풀렸다는 알림이 왔다 — 그 물음이 지금 판으로 끝나면 한 번 더 묻는다(알림을 버리면 입구는 이미
  // 새 길을 줬다고 보고 다시 알리지 않아 생활 판정이 지금 판에 남았다 — GPT · 카본 합친 끝 판 GC4 · C3 ①).
  let again = false;
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
    // 혼자 맞혔는데도 기억 줄이 없는 복습은 다시 열지 않고 계기에 — 복습마다 이 기기 · 이 주인에서 한 번(문항 번호는 계기에 싣지 않는다).
    // 방금(STUCK_GRACE 안) 적힌 답은 판 겉이 아직 코치에 넘기는 중일 수 있어 다음 판정에서 다시 잰다 — 진도가 저장을 알리는 때(onChange)가
    // 코치에 답이 가기 전이라 정상인 첫 복습 답마다 거짓으로 세어졌고, 문서마다 같은 복습을 다시 세어 4-8의 틈 크기를 못 쟀다(Fable 5.2 합친 끝 판 F8).
    for (const id of out.stuck) {
      if (stuck.has(id)) continue;
      if (!(now - snapshot?.reviews?.[id]?.lastAt >= STUCK_GRACE)) continue;
      stuck.add(id);
      if (quiet(() => noted.has(id)) === true) continue;
      quiet(() => noted.add(id));
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
    again = false;
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
    again = false;
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
          return settleOld();
        }
        return adopt(made, at);
      });
    return opening;
  }
  // 물음이 지금 판으로 끝났다 — 묻는 사이에 판이 풀렸다는 알림이 왔으면 한 번 더 묻는다.
  function settleOld() {
    if (!again || disposed || phase !== 'old') return null;
    again = false;
    return reask();
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
        if (disposed || at !== generation || phase !== 'old') return null;
        if (!usable(made)) return settleOld();
        return adopt(made, at);
      });
    asking = pending;
    opening = pending;
    return pending;
  }
  const unreopen =
    quiet(() =>
      reopened(() => {
        if (disposed || phase === 'engine') return;
        if (phase === 'old' && !asking) void reask();
        else again = true; // 확인 중 · 다시 묻는 중 — 그 물음이 지금 판으로 끝나면 한 번 더
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
