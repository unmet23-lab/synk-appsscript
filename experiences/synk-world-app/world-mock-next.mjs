// Atlas 새 길의 시험 형식 연습(재설계 단계 4-4d — docs/_ops/qa/atlas-redesign-20261110/단계4_계획.md §21-23의 1). 셸은 이 파일을 부르지 않는다 —
// 입구(world-atlas-next.mjs)가 정적으로 받아 넘기고, 셸은 입구를 기능이 켜졌을 때만 동적 import로 부른다(world-diagnostic-next.mjs와 같다). 구성 고르기
// (selectMock)와 재생 셈(allowedPlays · nextPlay)은 지금 판의 world-exam-form.mjs 것을 셸이 넘긴다 — 브라우저에서 그 파일은 계정 묶음 안에만 있어 이
// 모듈이 따로 부르면 받지 못한다(world-diagnostic-next.mjs와 같은 까닭). 지금 판 시험 형식(world-exam-form.mjs)은 한 글자도 바꾸지 않는다.
//   고르기(selectMockNext): 구성(공식 유형을 번호 순서 · 비율대로 줄인 판, 영역마다 10문항, minShare .6)은 지금 selectMock 그대로다. 「처음 보는 문항」만
//     묶음 만남(coach.exposures()의 met === false)으로 가린다 — 모르면(null) 처음이 아니다. 세트는 한 문항이라도 만났거나 모르면 통째로 처음이 아니다
//     (selectMock의 freshBySet). 기록이 다 오지 않았으면(21-3) 열지 않는다.
//   진행(createMockNextSession): 겉(영역 시작 · 이동 · 재생 · 전달 · 답 · 영역 마치기 · 그만두기 · 결과)은 지금 createMockSession과 같다. 문항 차례를 제품이
//     정하므로 recommend를 부르지 않고 present로 낸다(제품 순서 문항 — 이유 host.order, §3-6). 혼자 맞힘은 저장 뒤의 evidence로 읽는다. 판은 진단처럼
//     기본 판이다 — 새벽 4시를 넘기거나 30분 넘게 쉬면 다음 제시에서 새로 열려, 열어 둔 문항의 제시가 사라진다(PRESENTATION_GONE). 그 문항을 다시 내고
//     끝까지 들은 재생을 새 제시에 이어 남긴 뒤 그 일을 한 번 더 한다. 다시 낸 제시도 첫 노출로 선다 — 측정용 「앞서 만났나」(metBefore)는 띄운 제시를
//     보지 않는다(§21-23의 1 「판」 · 설계 검토 B1). 시험 형식은 허용 재생 수까지만 들려(nextPlay의 'closed') 도움(다시 듣기)이 없다. 코치가
//     닫히면(DISPOSED — 판을 다시 정함) 그 뒤로 아무것도 남기지 않는다. 끝나면 finishSet({ kind: 'mock' })로 닫고, 그만두면 기록 없이(record: false) 닫는다.

export const MOCK_NEXT_POLICY = Object.freeze({
  version: 'world-mock-next-1',
  kind: 'mock',
  sections: Object.freeze(['listening', 'reading']),
});
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// select: 지금 판 selectMock(world-exam-form.mjs — 셸이 넘긴다), pool: 시험 형식 풀(은행 + 빈칸 베기), exposures: 같은 차례의 coach.exposures(pool),
// complete: 기록이 다 왔는가(21-3 — world-position-next.mjs recordsComplete).
export function selectMockNext({
  select,
  forms,
  exam,
  pool = [],
  exposures = [],
  complete = false,
  audioAvailable = true,
  policy = MOCK_NEXT_POLICY,
} = {}) {
  if (typeof select !== 'function') throw TypeError('WORLD mock next needs the form selector');
  if (!Array.isArray(pool) || !Array.isArray(exposures) || exposures.length !== pool.length)
    throw TypeError('WORLD mock next needs the pool and its exposures in the same order');
  if (typeof audioAvailable !== 'boolean') throw TypeError('WORLD mock next needs the sound condition');
  if (complete !== true)
    return {
      policy: policy.version,
      exam: exam ?? null,
      status: 'unavailable',
      reason: 'history.incomplete',
      sections: [],
      minutes: 0,
      total: 0,
      numbers: {},
      learningEffectClaim: false,
      grade: null,
      passClaim: false,
    };
  const met = new Map();
  pool.forEach((item, i) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id)
      throw TypeError('WORLD mock next: invalid item');
    if (met.has(item.id)) throw TypeError('WORLD mock next: duplicate item');
    met.set(item.id, exposures[i]?.met ?? null);
  });
  // 노출 읽기 — 측정용 만남이 없으면 처음(false), 있으면 본 것(true), 모르면 null(처음이 아니다 — freshBySet).
  const seen = item => {
    const value = met.get(item?.id);
    return value === false ? false : value === true ? true : null;
  };
  const plan = select({ forms, exam, pool, seen, audioAvailable });
  return { ...plan, reason: plan?.status === 'ready' ? null : 'mock.none' };
}

// 그날 낼 것이 있는 짧은 연습(§21-23의 1 「화면」 — 끝 한 장의 「다음 연습」). 처음 보는 짧은 연습 문항(묶음 만남의 seen === false — 내 위치 판의
// 「지금 낼 새 문항」과 같은 거름)이 남은 능력 가운데, 두뇌의 하루 계획(coach.plan)이 낼 것 없음(none — 하루 새 단위 한도에 막힘 · 낼 문항 없음)으로
// 보지 않는 것만 잇는다. 시험 형식으로 그날 새 단위를 다 연 날, 끝 한 장이 열어도 0문항인 연습을 잇지 않게. 소리를 끈 날은 듣기 문항을 세지 않는다.
// coach: 짧은 연습 풀의 은행을 다 받은 코치(홈 코치). 내는 것: 능력 id → { route: 'practice', skillId }. 못 셈하면 빈 표다(잇지 않는다).
export function todayPractice({ coach, pool = [], audioAvailable = true } = {}) {
  const routes = new Map();
  if (typeof coach?.exposures !== 'function' || typeof coach.plan !== 'function' || !Array.isArray(pool)) return routes;
  try {
    const met = coach.exposures(pool);
    const bySkill = new Map();
    pool.forEach((item, i) => {
      const listening = item?.audioRequired ?? item?.modality === 'listening';
      if (met[i]?.seen !== false || (listening && !audioAvailable)) return;
      if (typeof item.itemKey !== 'string' || typeof item.skillId !== 'string') return;
      if (!bySkill.has(item.skillId)) bySkill.set(item.skillId, []);
      bySkill.get(item.skillId).push({ itemKey: item.itemKey });
    });
    const planned = coach.plan([...bySkill].map(([id, candidates]) => ({ id, candidates, facts: {} })));
    for (const entry of Array.isArray(planned) ? planned : [])
      if (entry && entry.none !== true && entry.locked !== true && bySkill.has(entry.id))
        routes.set(entry.id, { route: 'practice', skillId: entry.id });
  } catch {
    routes.clear();
  }
  return routes;
}

// 시험 형식 연습 한 번. sections: selectMockNext의 'ready' 영역들(듣기 먼저 — 실제 시험 순서). plays: { allowedPlays, nextPlay }(지금 판 재생 셈).
// clock(): 지금(ms). 화면 계약(current · parts · results)은 지금 createMockSession과 같고, disposed · represented · settled · finish를 더한다.
export function createMockNextSession({ coach, sections = [], exam, plays, clock = () => Date.now() } = {}) {
  if (
    !coach ||
    ['present', 'delivery', 'answer', 'finishSet'].some(name => typeof coach[name] !== 'function') ||
    !Array.isArray(sections) ||
    !sections.length
  )
    throw TypeError('WORLD mock next needs the engine coach and its sections');
  if (typeof plays?.allowedPlays !== 'function' || typeof plays?.nextPlay !== 'function')
    throw TypeError('WORLD mock next needs the play rules');
  const { allowedPlays, nextPlay } = plays;
  const parts = sections.map(row => {
    if (
      !MOCK_NEXT_POLICY.sections.includes(row?.section) ||
      !Array.isArray(row.items) ||
      !row.items.length ||
      !Number.isFinite(row.minutes) ||
      row.minutes <= 0
    )
      throw TypeError('WORLD mock next: invalid section');
    for (const item of row.items)
      if (
        item?.modality !== row.section ||
        !Array.isArray(item.choices) ||
        !item.choices.some(choice => choice?.id === item.correctId)
      )
        throw TypeError('WORLD mock next: an item needs its section, choices and answer');
    // 세트 듣기는 대본 하나를 세트 문항이 함께 쓴다(지금 판과 같다): 재생 셈 · 들음은 세트에 하나다.
    const tracks = new Map();
    const trackOf = item => {
      const key = item.setId ? `set:${item.setId}` : `item:${item.id}`;
      if (!tracks.has(key))
        tracks.set(key, {
          heard: item.modality !== 'listening',
          audio: 'none',
          plays: { allowed: allowedPlays(item), completed: 0 },
        });
      return tracks.get(key);
    };
    return {
      section: row.section,
      items: row.items,
      minutes: row.minutes,
      startedAt: null,
      endedAt: null,
      ended: null,
      // delivered: 이 문항의 지금 제시에 남긴 끝까지 들은 전달 수 — 제시가 사라지면 새 제시에 그만큼 이어 남긴다.
      cells: row.items.map(item => ({
        item,
        pid: null,
        track: trackOf(item),
        delivered: 0,
        choiceId: null,
        result: null,
        shownAt: null,
      })),
    };
  });
  let partIndex = 0;
  let cursor = 0;
  let finished = false;
  let sounding = null;
  let disposed = false;
  let presented = false;
  let represented = 0;
  let closedSet = null;
  const pending = [];
  const part = () => parts[partIndex] || null;
  const deadline = row => (row.startedAt === null ? null : row.startedAt + row.minutes * 60000);
  const end = () => {
    disposed = true;
    sounding = null;
  };

  // 문항 하나에 일 하나 — 제시가 사라졌으면 그 문항을 다시 내고 끝까지 들은 전달을 이어 남긴 뒤 한 번 더, 코치가 닫혔으면 아무것도 남기지 않는다(null).
  function onCell(cell, call) {
    if (disposed) return null;
    try {
      return call(cell.pid);
    } catch (error) {
      if (error?.code === 'DISPOSED') {
        end();
        return null;
      }
      if (error?.code !== 'PRESENTATION_GONE') throw error;
      try {
        cell.pid = coach.present(cell.item);
        represented += 1;
        for (let n = 0; n < cell.delivered; n += 1) coach.delivery(cell.pid, { audio: 'completed' });
        return call(cell.pid);
      } catch (again) {
        if (again?.code === 'DISPOSED') {
          end();
          return null;
        }
        throw again;
      }
    }
  }
  const deliver = (cell, audio) => {
    const out = onCell(cell, pid => coach.delivery(pid, { audio }) ?? true);
    if (out !== null && audio === 'completed') cell.delivered += 1;
    return out !== null;
  };
  // 답 하나의 결과 — 저장 뒤의 evidence로 혼자 맞힘을 채운다(저장에 실패한 답은 혼자 맞힘이 아니다).
  function settle(cell, out) {
    const result = {
      verdict: out?.verdict ?? null,
      eventId: out?.eventId ?? null,
      independent: false,
      assisted: null,
      stored: null,
    };
    cell.result = result;
    pending.push(
      Promise.resolve(out?.evidence).then(
        evidence => {
          result.independent = evidence?.independent === true;
          result.assisted = evidence?.assisted ?? null;
          result.stored = evidence?.stored !== false;
        },
        () => {
          result.independent = false;
          result.stored = false;
        },
      ),
    );
    return result;
  }
  function show(row, index) {
    const cell = row.cells[index];
    if (cell.pid || disposed) return cell;
    try {
      cell.pid = coach.present(cell.item);
    } catch (error) {
      if (error?.code !== 'DISPOSED') throw error;
      end();
      return cell;
    }
    cell.shownAt = clock();
    presented = true;
    if (cell.item.modality === 'listening') {
      // 다 들은 대본의 세트 문항은 그 전달을 한 번 남긴다(대본은 이미 들었다).
      if (cell.track.heard) deliver(cell, 'completed');
      else if (cell.track.audio === 'none') cell.track.audio = 'pending';
    }
    return cell;
  }
  const setRange = (row, cell) => {
    if (!cell.item.setId) return null;
    const at = row.cells
      .map((entry, index) => (entry.item.setId === cell.item.setId ? index : -1))
      .filter(index => index >= 0);
    return at.length > 1 ? { first: at[0] + 1, last: at[at.length - 1] + 1 } : null;
  };
  // 시간을 넘겼으면 그 영역을 닫는다(답 · 이동 때마다 확인한다).
  function expire() {
    const row = part();
    if (row && row.startedAt !== null && row.ended === null && clock() >= deadline(row)) close(row, 'time');
  }
  // 영역을 닫는다 — 열어 보고 답하지 않은 문항은 평가할 수 없는 답(이유 unanswered · audio)으로 남긴다. 열어 보지 않은 문항은 기록하지 않는다.
  function close(row, reason) {
    if (row.ended !== null) return;
    for (const cell of row.cells)
      if (cell.pid && !cell.result && !disposed) {
        const reasonOf = cell.track.heard ? 'unanswered' : 'audio';
        const out = onCell(cell, pid => coach.answer(pid, { correct: null, assessable: false, reason: reasonOf }));
        if (out) settle(cell, out);
      }
    row.ended = reason;
    row.endedAt = clock();
  }
  const view = () => {
    expire();
    const row = part();
    if (!row || finished || disposed) return null;
    if (row.startedAt === null)
      return {
        section: row.section,
        partIndex,
        parts: parts.length,
        between: true,
        started: false,
        ended: null,
        total: row.cells.length,
        minutes: row.minutes,
      };
    if (row.ended !== null)
      return { section: row.section, ended: row.ended, partIndex, parts: parts.length, between: true, started: true };
    const cell = row.cells[cursor];
    return {
      section: row.section,
      partIndex,
      parts: parts.length,
      index: cursor,
      total: row.cells.length,
      item: cell.item,
      heard: cell.track.heard,
      audio: cell.track.audio,
      plays: { ...cell.track.plays },
      answered: !!cell.result,
      choiceId: cell.choiceId,
      started: true,
      deadline: deadline(row),
      remainingMs: Math.max(0, deadline(row) - clock()),
      set: setRange(row, cell),
      sounding: sounding && sounding.row === row ? row.cells.indexOf(sounding.cell) : null,
      marks: row.cells.map(entry => (entry.result ? 'answered' : entry.pid ? 'opened' : 'new')),
    };
  };
  const closeSet = record => {
    if (closedSet !== null || disposed || !presented) return closedSet;
    try {
      closedSet = coach.finishSet(record ? { kind: MOCK_NEXT_POLICY.kind } : { kind: MOCK_NEXT_POLICY.kind, record: false }) ?? null;
    } catch {
      closedSet = null;
    }
    return closedSet;
  };

  return Object.freeze({
    get parts() {
      return parts.map(row => ({ section: row.section, total: row.cells.length, minutes: row.minutes, ended: row.ended }));
    },
    get current() {
      return view();
    },
    // 판을 다시 정해 코치가 닫혔나 — 참이면 화면이 안내 한 줄과 함께 연습을 닫는다.
    get disposed() {
      return disposed;
    },
    // 기본 판이 낡아 다시 낸 문항 수(계기용).
    get represented() {
      return represented;
    },
    // 문항을 하나라도 냈나 — 그만둔 판도 기기 판 기록(주기 셈)에 적는다(§21-23의 3).
    get presented() {
      return presented;
    },
    get finished() {
      return finished;
    },
    // 영역 시작: 시계를 켜고 첫 문항을 연다.
    start() {
      if (finished || disposed) return null;
      const row = part();
      if (!row || row.startedAt !== null) return view();
      row.startedAt = clock();
      cursor = 0;
      show(row, 0);
      return view();
    },
    // 같은 영역 안에서 다른 문항으로(번호). 처음 여는 문항은 그때 낸다.
    go(index) {
      expire();
      const row = part();
      if (
        disposed ||
        !row ||
        row.startedAt === null ||
        row.ended !== null ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= row.cells.length
      )
        return view();
      cursor = index;
      show(row, index);
      return view();
    },
    // 재생 한 번 시작 — 'first' · 'allowed'. 허용 횟수를 넘긴 재생('closed')은 받지 않는다. 한 번에 소리 하나다.
    play() {
      expire();
      const row = part();
      const cell = row?.cells[cursor];
      if (!cell || disposed || row.ended !== null || cell.result || cell.item.modality !== 'listening' || sounding)
        return false;
      const kind = nextPlay(cell.track.plays, { heard: cell.track.heard, exam: true });
      if (kind === 'closed') return false;
      if (kind === 'first') {
        cell.track.audio = 'pending';
        if (!deliver(cell, 'pending')) return false;
      }
      sounding = { row, cell };
      return kind;
    },
    // 재생기의 끝(completed) · 실패(failed): 시작한 문항의 대본(track)에 남긴다. 끝까지 들은 재생은 열어 둔 세트 문항 모두에 남긴다. 영역이 닫힌
    // 뒤에 끝난 재생은 세지 않는다.
    delivery(status) {
      if (!['completed', 'failed'].includes(status)) throw TypeError('WORLD mock next: invalid audio state');
      expire();
      const now = sounding;
      sounding = null;
      if (!now || disposed || now.row.ended !== null) return false;
      const { row, cell } = now;
      const track = cell.track;
      if (status === 'completed') {
        track.plays.completed += 1;
        track.heard = true;
        track.audio = 'completed';
        for (const entry of row.cells)
          if (entry.track === track && entry.pid && !entry.result && !disposed) deliver(entry, 'completed');
      } else if (!track.heard) {
        track.audio = 'failed';
        if (!cell.result) deliver(cell, 'failed');
      }
      return !disposed;
    },
    // 고른 답은 바로 첫 답으로 남기고 바꾸지 않는다(혼자 낸 첫 답만 근거다). 끝까지 듣기 전에는 받지 않는다.
    answer(choiceId) {
      expire();
      const row = part();
      const cell = row?.cells[cursor];
      if (!cell || disposed || row.ended !== null || cell.result || !cell.track.heard) return null;
      if (!cell.item.choices.some(choice => choice.id === choiceId)) throw TypeError('WORLD mock next: unknown choice');
      const out = onCell(cell, pid =>
        coach.answer(pid, {
          correct: choiceId === cell.item.correctId,
          assessable: true,
          choice: { selectedId: choiceId, correctId: cell.item.correctId },
        }),
      );
      if (!out) return null;
      cell.choiceId = choiceId;
      const result = settle(cell, out);
      return { verdict: result.verdict };
    },
    // 영역을 마친다(학생이 「제출」했거나 시간이 다 됐을 때). 다음 영역이 있으면 그 영역은 학생이 시작할 때 시계가 돈다.
    finishSection() {
      const row = part();
      if (!row || finished || disposed) return null;
      if (row.startedAt === null) row.startedAt = clock();
      close(row, row.ended ?? 'submitted');
      sounding = null;
      partIndex += 1;
      cursor = 0;
      if (partIndex >= parts.length) finished = true;
      return view();
    },
    // 그만두기: 지금 영역을 닫고(열어 본 문항은 답하지 않음) 남은 영역은 시작하지 않는다. 문항을 냈으면 판을 기록 없이 한 번 닫고 그 결과
    // (folded 포함)를 돌려준다 — 닫지 않으면 손님 요약이 그 답으로 다시 접히지 않는다(진단 끝 판 F2와 같다). 닫힌 코치의 예외는 삼킨다.
    stop() {
      if (!finished) {
        const row = part();
        if (row && row.startedAt !== null) close(row, 'stopped');
        sounding = null;
        finished = true;
      }
      return closeSet(false);
    },
    // 판을 닫는다(한 번) — finishSet({ kind: 'mock' })의 결과(folded 포함). record: false — 판 기록 없이 닫기만 한다(학습자 응답이 꺼졌거나 손님).
    // 코치가 닫혔거나 문항을 낸 적이 없거나 닫지 못하면 null.
    finish({ record = true } = {}) {
      return closeSet(record);
    },
    // 판의 답이 모두 저장된 뒤 풀린다 — 끝 화면은 그 뒤의 evidence로 그린다.
    settled: () => Promise.all(pending).then(() => undefined),
    results() {
      return parts.map(row => ({
        section: row.section,
        minutes: row.minutes,
        ended: row.ended,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        items: row.cells.map(cell => ({
          itemId: cell.item.id,
          itemKey: cell.item.itemKey,
          officialType: cell.item.officialType,
          skillId: cell.item.skillId,
          opened: !!cell.pid,
          choiceId: cell.choiceId,
          verdict: cell.result?.verdict ?? null,
          independent: cell.result?.independent === true,
          assisted: cell.result?.assisted ?? null,
          stored: cell.result?.stored ?? null,
          eventId: cell.result?.eventId ?? null,
          plays: { ...cell.track.plays },
        })),
      }));
    },
  });
}
