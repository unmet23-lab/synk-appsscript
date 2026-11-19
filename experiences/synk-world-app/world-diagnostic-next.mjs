// Atlas 새 길의 짧은 진단(재설계 단계 4-4a — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-5). 셸은 이 파일을 부르지 않는다 —
// 입구(world-atlas-next.mjs)가 정적으로 받아 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다(world-today.mjs와 같다). 재생 셈
// (allowedPlays · nextPlay)은 지금 판과 같은 것을 셸이 넘긴다 — 브라우저에서 그 파일(world-exam-form.mjs)은 계정 묶음 안에만 있어 이 모듈이
// 따로 부르면 받지 못한다(world-practice-next.mjs와 같은 까닭). 지금 판 진단(world-position.mjs)은 한 글자도 바꾸지 않는다.
//   고르기(selectDiagnosticNext): 능력마다 하나 — 측정용 만남이 없는 문항(coach.exposures()의 met === false)만, 모르면(null) 고르지 않는다. 세트는
//     같은 세트의 다른 문항을 만났으면(또는 모르면) 처음이 아니다. 처음 볼 난도는 새 칸이 혼자 해냄이 아닌 가장 쉬운 난도다. 형식 차례와 소리를
//     끈 날의 규칙은 지금과 같다. 기록이 다 오지 않았으면(21-3) 열지 않는다. 진단용 레이싱 조각이 서기 전에는 그 문항을 뺀다(21-2).
//   진행(createDiagnosticNextSession): 겉(다음 · 다시 듣기 · 전달 · 답 · 건너뛰기 · 그만두기 · 결과)은 지금 진단과 같다. 문항 차례를 제품이 정하므로
//     recommend를 부르지 않고 present로 낸다(제품 순서 문항 — 이유 host.order, §3-6). 혼자 맞힘은 저장 뒤의 evidence로 읽는다. 끝나면
// finishSet({ kind: 'diagnostic' })로 닫고, 그만두면 기록 없이(record: false) 닫는다(끝 판 F2).

export const DIAGNOSTIC_NEXT_POLICY = Object.freeze({
  version: 'world-diagnostic-next-1',
  // TOPIK 보기 고르기에 가까운 형식부터 — 지금 진단(DIAGNOSTIC_POLICY.formats)과 같다.
  formats: Object.freeze(['single-choice', 'binary-choice', 'action', 'cup-compose', 'unknown']),
  // 진단용 조각이 서기 전에 새 길 진단이 빼는 은행(21-2 — 설계 주인 11-15). 조각을 지도 쪽(atlas-1b)이 내고 홈 코치가 그 조각을 열면 비운다.
  // 진단 풀의 단위 풀림 시험이 이 목록으로 뺀 문항을 안다 — 그 밖의 문항이 이름 없는 family: 단위로 떨어지면 실패한다.
  withheld: Object.freeze(['korean-racing']),
});
const FORMATS = new Set(['binary-choice', 'single-choice', 'cup-compose', 'action', 'unknown']);
const TOKEN = /^[a-zA-Z0-9_.:-]{1,120}$/;
const TOPIK_SKILL = /^ko2?\.(listening|reading)\.[a-z]+$/;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const token = value => typeof value === 'string' && TOKEN.test(value);
const listeningOf = item => item.audioRequired ?? item.modality === 'listening';
// 문항 열쇠의 앞마디가 은행이다(점이나 쌍점 — 레이싱은 korean-racing:w0001:v1).
export const bankOfItem = item => String(item?.itemKey ?? '').split(/[.:]/)[0];
export const withheldItem = (item, policy = DIAGNOSTIC_NEXT_POLICY) =>
  policy.withheld.includes(bankOfItem(item));

function checked(item) {
  if (
    !isRecord(item) ||
    !token(item.id) ||
    !token(item.itemKey) ||
    !token(item.familyKey || item.itemKey) ||
    !TOPIK_SKILL.test(item.skillId || '') ||
    !['listening', 'reading'].includes(item.modality) ||
    item.skillId.split('.')[1] !== item.modality ||
    ![1, 2, 3].includes(item.difficulty) ||
    !FORMATS.has(item.responseFormat ?? 'unknown') ||
    (item.audioRequired != null && typeof item.audioRequired !== 'boolean')
  )
    throw TypeError('WORLD diagnostic next: invalid item');
  return item;
}

// 처음 볼 난도 — 새 칸(world-position-next.mjs의 levels)이 혼자 해냄이 아닌 가장 쉬운 난도.
function targetOf(skill) {
  for (const level of skill.levels ?? []) if (level.cell !== 'independent') return level.difficulty;
  return 3;
}

// position: world-position-next.mjs buildPositionNext()의 판, items: 진단 문항 풀, exposures: 같은 차례의 coach.exposures(items).
export function selectDiagnosticNext({
  position,
  items = [],
  exposures = [],
  audioAvailable = true,
  policy = DIAGNOSTIC_NEXT_POLICY,
} = {}) {
  if (!position || !Array.isArray(position.skills))
    throw TypeError('WORLD diagnostic next needs the position board');
  if (!Array.isArray(items) || !Array.isArray(exposures) || exposures.length !== items.length)
    throw TypeError('WORLD diagnostic next needs items and their exposures in the same order');
  if (typeof audioAvailable !== 'boolean')
    throw TypeError('WORLD diagnostic next needs the sound condition');
  const pool = items.map(checked);
  const ids = new Set();
  for (const item of pool) {
    if (ids.has(item.id)) throw TypeError('WORLD diagnostic next: duplicate item');
    ids.add(item.id);
  }
  const common = {
    policy: policy.version,
    exam: position.exam,
    total: position.skills.length,
    learningEffectClaim: false,
    grade: null,
  };
  if (!position.complete)
    return {
      ...common,
      status: 'unavailable',
      reason: 'history.incomplete',
      items: [],
      missing: position.skills.map(skill => ({ skillId: skill.id, reason: 'history' })),
    };
  const met = new Map(pool.map((item, i) => [item.id, exposures[i]?.met ?? null]));
  const open = pool.filter(item => !withheldItem(item, policy));
  // 세트 — 한 문항이라도 만났거나 모르면 그 세트 전체가 처음이 아니다(지문을 읽었다 — freshBySet과 같다).
  const touched = new Set(
    open.filter(item => item.setId && met.get(item.id) !== false).map(item => item.setId),
  );
  const fresh = new Set(
    open
      .filter(item => met.get(item.id) === false && !(item.setId && touched.has(item.setId)))
      .map(item => item.id),
  );
  const format = item => policy.formats.indexOf(item.responseFormat ?? 'unknown');
  const chosen = [];
  const missing = [];
  const usedSets = new Set();
  for (const skill of position.skills) {
    const mine = open.filter(item => item.skillId === skill.id);
    if (!mine.length) {
      const held = pool.some(item => item.skillId === skill.id && withheldItem(item, policy));
      missing.push({ skillId: skill.id, reason: held ? 'withheld' : 'no-item' });
      continue;
    }
    const playable = audioAvailable ? mine : mine.filter(item => !listeningOf(item));
    if (!playable.length) {
      missing.push({ skillId: skill.id, reason: 'audio' });
      continue;
    }
    const left = playable.filter(
      item => fresh.has(item.id) && !(item.setId && usedSets.has(item.setId)),
    );
    if (!left.length) {
      const unknown = playable.some(item => met.get(item.id) == null);
      missing.push({ skillId: skill.id, reason: unknown ? 'unknown' : 'all-seen' });
      continue;
    }
    const target = targetOf(skill);
    left.sort(
      (a, b) =>
        Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) ||
        a.difficulty - b.difficulty ||
        format(a) - format(b) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    if (left[0].setId) usedSets.add(left[0].setId);
    chosen.push({ skillId: skill.id, target, item: left[0] });
  }
  return {
    ...common,
    status: chosen.length ? 'ready' : 'unavailable',
    reason: chosen.length ? null : 'diagnostic.none',
    items: chosen,
    missing,
  };
}

function playable(row) {
  const item = checked(row?.item ?? row);
  if (
    !Array.isArray(item.choices) ||
    item.choices.length < 2 ||
    item.choices.some(choice => !isRecord(choice) || !token(choice.id) || typeof choice.label !== 'string' || !choice.label) ||
    new Set(item.choices.map(choice => choice.id)).size !== item.choices.length ||
    !item.choices.some(choice => choice.id === item.correctId)
  )
    throw TypeError('WORLD diagnostic next: an item needs its choices and answer');
  return item;
}

// 진단 한 바퀴. 문항마다 제시 → (듣기면) 끝까지 들음 → 첫 답의 차례로만 새 코치에 남긴다. 끝까지 듣기 전에는 답을 받지 않는다. 다시 듣기는 허용
// 횟수(시험형 문항)까지 혼자 들은 것이고, 그 뒤에 더 들은 것만 도움이다(지금 진단과 같은 규칙 — 셸이 넘긴 plays). 건너뛰거나 그만두면 그 문항은
// 평가할 수 없는 답으로 남는다(그 계열은 만난 것이 되고 칸에는 들지 않는다 — 검토 C5).
// 판이 바뀌는 때(검토 C4 · 카본 A7): 코치가 닫히면(DISPOSED — 판을 다시 정함) 그 뒤로는 아무것도 남기지 않고 disposed가 참이 된다(화면이 안내 한
// 줄과 함께 진단을 닫는다). 기본 판이 낡아 제시가 사라지면(PRESENTATION_GONE) 그 문항을 다시 내고, 앞 제시에서 끝까지 들은 재생과 허용을 넘긴 다시
// 듣기(도움)를 새 제시에 이어 남긴 뒤 그 일을 한 번 더 한다 — 도움을 받은 문항이 다시 낸 뒤 혼자 낸 첫 답으로 적히지 않게.
export function createDiagnosticNextSession({ coach, items, plays } = {}) {
  if (
    !coach ||
    ['present', 'delivery', 'help', 'answer', 'finishSet'].some(name => typeof coach[name] !== 'function') ||
    !Array.isArray(items)
  )
    throw TypeError('WORLD diagnostic next needs the engine coach and its items');
  if (typeof plays?.allowedPlays !== 'function' || typeof plays?.nextPlay !== 'function')
    throw TypeError('WORLD diagnostic next needs the play rules');
  const { allowedPlays, nextPlay } = plays;
  const queue = items.map(playable);
  const results = [];
  const pending = [];
  let index = -1;
  let current = null;
  let stopped = false;
  let disposed = false;
  let finished = null;
  let represented = 0;

  const view = () =>
    current && {
      index,
      total: queue.length,
      item: current.item,
      heard: current.heard,
      answered: current.answered,
      replayed: current.replayed,
      audio: current.audio,
      plays: { ...current.plays },
      next: nextPlay(current.plays, { heard: current.heard }),
    };
  const end = () => {
    disposed = true;
    current = null;
  };
  // 지금 문항의 제시에 일 하나 — 제시가 사라졌으면 다시 내고 이어 남긴 뒤 한 번 더, 코치가 닫혔으면 그 뒤로 아무것도 남기지 않는다.
  function onCurrent(call) {
    try {
      return call(current.pid);
    } catch (error) {
      if (error?.code === 'DISPOSED') {
        end();
        return null;
      }
      if (error?.code !== 'PRESENTATION_GONE') throw error;
      const helped = current.plays.extra > 0;
      try {
        current.pid = coach.present(current.item, helped ? { firstExposure: false } : {});
        for (let n = 0; n < current.plays.completed; n += 1)
          coach.delivery(current.pid, { audio: 'completed' });
        for (let n = 0; n < current.plays.extra; n += 1) coach.help(current.pid, 'replay');
        represented += 1;
        return call(current.pid);
      } catch (again) {
        if (again?.code === 'DISPOSED') {
          end();
          return null;
        }
        throw again;
      }
    }
  }
  const close = (out, choiceId, skipped) => {
    current.answered = true;
    const row = {
      skillId: current.item.skillId,
      itemId: current.item.id,
      itemKey: current.item.itemKey,
      choiceId,
      skipped,
      verdict: out.verdict ?? null,
      independent: false,
      assisted: null,
      stored: null,
      eventId: out.eventId ?? null,
      plays: { ...current.plays },
    };
    results.push(row);
    pending.push(
      Promise.resolve(out.evidence).then(
        evidence => {
          row.independent = evidence?.independent === true;
          row.assisted = evidence?.assisted ?? null;
          row.stored = evidence?.stored !== false;
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
    if (!current || current.answered || disposed) return null;
    const out = onCurrent(pid =>
      coach.answer(pid, { correct: null, assessable: false, reason: current.heard ? 'unanswered' : 'audio' }),
    );
    return out ? close(out, null, true) : null;
  };

  return Object.freeze({
    get total() {
      return queue.length;
    },
    get current() {
      return view();
    },
    // 판을 다시 정해 코치가 닫혔나 — 참이면 화면이 안내 한 줄과 함께 진단을 닫는다.
    get disposed() {
      return disposed;
    },
    // 기본 판이 낡아 다시 낸 문항 수(계기용).
    get represented() {
      return represented;
    },
    results: () => results.map(row => ({ ...row, plays: { ...row.plays } })),
    // 판의 답이 모두 저장된 뒤 풀린다 — 끝 화면은 그 뒤의 evidence로 그린다(칸이 아직 그 답을 모를 수 있다 — §21-3 판 끝 칸 견주기).
    settled: () => Promise.all(pending).then(() => undefined),
    // 다음 문항을 낸다. 앞 문항을 답하거나 건너뛰기 전에는 넘어가지 않는다.
    next() {
      if (stopped || disposed) return null;
      if (current && !current.answered)
        throw Error('WORLD diagnostic next: answer or skip the current item first');
      index += 1;
      if (index >= queue.length) {
        current = null;
        return null;
      }
      const item = queue[index];
      let pid = null;
      try {
        pid = coach.present(item);
      } catch (error) {
        if (error?.code !== 'DISPOSED') throw error;
        end();
        return null;
      }
      const listening = listeningOf(item);
      current = {
        item,
        pid,
        audio: listening ? 'pending' : 'none',
        heard: !listening,
        answered: false,
        replayed: false,
        plays: { allowed: allowedPlays(item), completed: 0, extra: 0 },
      };
      return view();
    },
    // 실제 재생기의 결과만 받는다. 끝까지 들은 재생은 처음이든 다시든 매번 남긴다(실제 재생 수). 다 들은 뒤의 실패는 앞서 들은 사실을 지우지 않는다.
    delivery(status) {
      if (!current || current.answered || disposed || !listeningOf(current.item)) return false;
      if (!['pending', 'completed', 'failed'].includes(status))
        throw TypeError('WORLD diagnostic next: invalid audio state');
      if (current.heard) {
        if (status !== 'completed') return true;
        if (onCurrent(pid => coach.delivery(pid, { audio: 'completed' }) ?? true) === null) return false;
        current.plays.completed += 1;
        return true;
      }
      if (onCurrent(pid => coach.delivery(pid, { audio: status }) ?? true) === null) return false;
      current.audio = status;
      if (status === 'completed') {
        current.heard = true;
        current.plays.completed += 1;
      }
      return true;
    },
    // 듣기 한 번 시작 — 'first'(아직 다 못 들음) · 'allowed'(허용 횟수 안 — 도움 아님) · 'extra'(허용을 넘김 — 도움).
    replay() {
      if (!current || current.answered || disposed || !listeningOf(current.item)) return false;
      const kind = nextPlay(current.plays, { heard: current.heard });
      if (kind === 'first') {
        current.audio = 'pending';
        if (onCurrent(pid => coach.delivery(pid, { audio: 'pending' }) ?? true) === null) return false;
        return kind;
      }
      if (kind === 'extra') {
        if (onCurrent(pid => coach.help(pid, 'replay') ?? true) === null) return false;
        current.replayed = true;
        current.plays.extra += 1;
      }
      return kind;
    },
    answer(choiceId) {
      if (!current || current.answered || disposed || !current.heard) return null;
      if (!current.item.choices.some(choice => choice.id === choiceId))
        throw TypeError('WORLD diagnostic next: unknown choice');
      const out = onCurrent(pid =>
        coach.answer(pid, {
          correct: choiceId === current.item.correctId,
          assessable: true,
          choice: { selectedId: choiceId, correctId: current.item.correctId },
        }),
      );
      return out ? close(out, choiceId, false) : null;
    },
    skip,
    // 진단을 그만둔다. 보이던 문항은 건너뛴 것으로 남기고, 아직 안 보인 문항은 기록하지 않는다. 문항을 냈으면 판을 기록 없이 닫고(finishSet
    // record: false) 그 결과(folded 포함)를 돌려준다. 닫지 않으면 손님 요약이 그만둔 답으로 다시 접히지 않아 칸이 「따라오는 중」에 머물고, 다음
    // 진단이 같은 기본 판으로 묶였다(끝 판 F2 — 새 판 짧은 연습 ⑥과 같다). 이미 닫았거나 코치가 닫혔으면 두고, 닫힌 코치의 예외는 삼킨다.
    stop() {
      if (stopped) return null;
      skip();
      stopped = true;
      current = null;
      if (finished === null && !disposed && index >= 0) {
        try {
          finished = coach.finishSet({ kind: 'diagnostic', record: false }) ?? null;
        } catch {
          finished = null;
        }
      }
      return finished;
    },
    // 판을 닫는다(한 번) — finishSet({ kind: 'diagnostic' })의 결과(folded 포함)를 돌려준다. 코치가 닫혔거나 닫지 못하면 null.
    // record: false — 판 기록 없이 닫기만 한다(학습자 응답이 꺼졌거나 손님 — 지금 판도 그때 판 기록을 남기지 않는다, world-learning-ui.mjs finishSet).
    finish({ record = true } = {}) {
      if (finished !== null) return finished;
      if (disposed) return null;
      try {
        finished = coach.finishSet(record ? { kind: 'diagnostic' } : { kind: 'diagnostic', record: false }) ?? null;
      } catch {
        finished = null;
      }
      return finished;
    },
  });
}
