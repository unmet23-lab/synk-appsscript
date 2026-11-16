// 30일째 문장의 계정 길 — 학습일 답(단계4_계획 §21-22 · 「설계 검토로 고친 것」 · 「설계 다시 검수로 고친 것」). 서버 길 계정은 기기에 이틀 치만
// 있어 코치가 세지 못하므로(coach.lookback() null) 서버의 돌아보기 읽기(learning?view=trail-lookback)로 묻고, 그 답을 계정마다 localStorage 열쇠
// 하나에 둔다.
//   값: 학습일 · 동의 판 · 물을 때의 기기 자리(askedFrom) · 서버가 셀 때의 자리(at = 답의 summaryAt) · 창 · 단위마다 id와 숫자(misses ·
//   reviews · last). 문항 글이나 답 글은 두지 않는다. 읽기와 쓰기는 모두 try/catch로 감싸고, 읽지 못하면 서버에 다시 묻는다.
//   보일 때는 기기가 지금 받은 요약의 자리(coach summary().storage.sync.received)와 답의 자리를 견준다(verdictOf). 캐시 값만 믿고 문장을
//   짓지 않는다. 아직 칸에 들지 않은 답이 있으면(storage.unfolded > 0) 묻지도, 적지도, 짓지도 않는다.
//   지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 연습 기록 비우기)은 열쇠를 지우고 세대 수를 올린다. 답이 오면 적기 직전에 물을 때의 세대 수가
//   지금과 같은지 본다 — 다른 탭에서 로그아웃했거나 같은 계정에서 동의를 끈 뒤의 늦은 답이 적히지 않게.
// 묻기 · 받기 · 다시 그리기(createMonthAsker)는 셸(world-learning-ui.mjs)이 판을 그릴 때 부른다. 상한이 셋이다(설계 주인 11-16 밤 조건 1 · 2).
//   묻기 — 물은 뒤 기기 자리가 바뀌었을 때만 다시 묻는다. 완결되지 않았거나 실패한 답 뒤에도 기기 자리가 그대로면 다시 묻지 않는다.
//   받기(coach.pull) — 기기가 답의 자리보다 뒤처졌을 때 그 답의 자리마다 한 번. 받기가 실패해도 그 자리에서는 다시 부르지 않는다.
//   다시 그리기 — 적은 답의 자리가 기기 자리와 같을 때만 한 번. 쓸 수 없는 답(완결되지 않음 · 뒤처짐)으로는 다시 그리지 않는다.
// 규칙마다 qa/position-mutants.mjs에 깬 변형이 있고, qa/atlas-next-month-answer.test.mjs의 셈 시험이 잡는다.
const PREFIX = 'synk:world:month-answer:';
const VERSION = 1;
const GEN = /^(\d{13})\.[0-9a-z]{1,16}$/;
const finite = value => Number.isFinite(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// 자리 { edition, gen, foldedUntil } — 꼴이 아니면 null.
export function positionOf(value) {
  if (!plain(value) || typeof value.edition !== 'string' || !value.edition) return null;
  if (!Number.isSafeInteger(value.foldedUntil) || value.foldedUntil < 0) return null;
  const gen = value.gen ?? null;
  if (gen !== null && typeof gen !== 'string') return null;
  return { edition: value.edition, gen, foldedUntil: value.foldedUntil };
}
export const samePosition = (a, b) =>
  Boolean(a && b) && a.edition === b.edition && (a.gen ?? null) === (b.gen ?? null) && a.foldedUntil === b.foldedUntil;

// 머리 차례 — 엔진 record/summary.mjs headOrder와 같은 규칙(gen에 든 머리 만든 서버 시각이 큰 쪽이 새 머리, gen이 없거나 꼴이 아니면 가장 작다).
const genTime = gen => {
  const match = typeof gen === 'string' ? GEN.exec(gen) : null;
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
};
export function headOrder(next, current) {
  const a = next?.gen ?? null;
  const b = current?.gen ?? null;
  if (a === b) return 0;
  return genTime(a) < genTime(b) ? -1 : 1;
}

// 서버의 자리(at)가 기기의 자리보다 앞서나 — 답의 머리가 새것이거나, 같은 머리에서 foldedUntil이 크다.
export function aheadOf(at, device) {
  const order = headOrder(at, device);
  return order > 0 || (order === 0 && at.edition === device.edition && at.foldedUntil > device.foldedUntil);
}

// 적어 둔 답을 지금 쓸 수 있나 — 'use'(쓴다) · 'behind'(기기가 뒤처졌다 — 다시 묻지 않고 받기를 한 번 부른다) · 'ask'(다시 묻는다).
//   device: 기기가 지금 받은 요약의 자리. stored: { askedFrom, at }.
//   같은 자리면 쓴다. 답의 자리가 앞서면(머리 차례 · 같은 머리의 foldedUntil) 뒤처짐이다. 기기가 앞섰거나 머리 차례를 가리지 못하면, 물은 뒤 기기
//   자리가 바뀌었을 때만 다시 묻는다 — 그대로면 서버의 자리는 앞으로만 가므로 뒤처짐으로 본다(상한).
export function verdictOf(device, stored) {
  if (samePosition(device, stored.at)) return 'use';
  if (aheadOf(stored.at, device)) return 'behind';
  return samePosition(device, stored.askedFrom) ? 'behind' : 'ask';
}

function validMonth(rows) {
  return (
    Array.isArray(rows) &&
    rows.length <= 64 &&
    rows.every(
      row =>
        plain(row) &&
        typeof row.unit === 'string' &&
        row.unit.length <= 200 &&
        Number.isSafeInteger(row.misses) &&
        Number.isSafeInteger(row.reviews) &&
        (row.last === null || finite(row.last)),
    )
  );
}
const validWindows = windows =>
  plain(windows) &&
  ['monthAgo', 'since', 'last7'].every(
    name => plain(windows[name]) && finite(windows[name].from) && finite(windows[name].to),
  );

// 세대 수 — 이 문서의 모든 저장소가 함께 쓴다(로그아웃 · 동의 끔은 셸의 다른 자리에서 clearMonthAnswer로 지운다).
let generation = 0;
const keyOf = account => `${PREFIX}${account}`;

// 지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 연습 기록 비우기) — 그 계정의 열쇠를 지우고 세대 수를 올린다(물은 뒤의 늦은 답을 적지 않게).
export function clearMonthAnswer(storage, account) {
  generation += 1;
  try {
    if (account) storage?.removeItem(keyOf(account));
  } catch {
    // 저장소가 막혀도 세대 수는 올렸다 — 다음 읽기는 판 · 학습일로 다시 거른다
  }
}

// 저장소 — 계정마다 열쇠 하나. storage는 localStorage 꼴(getItem · setItem · removeItem).
export function createMonthAnswers({ storage = globalThis.localStorage } = {}) {
  return {
    generation: () => generation,
    // 적어 둔 답 — 계정 · 동의 판 · 학습일이 맞고 꼴이 맞을 때만. 아니면 null(다시 묻는다). 늘 저장소에서 바로 읽는다(다른 탭이 덮었으면 그 값).
    read(account, { revision, day }) {
      let value = null;
      try {
        value = JSON.parse(storage?.getItem(keyOf(account)) ?? 'null');
      } catch {
        return null;
      }
      if (!plain(value) || value.v !== VERSION || value.revision !== revision || value.day !== day) return null;
      const askedFrom = positionOf(value.askedFrom);
      const at = positionOf(value.at);
      if (!askedFrom || !at || !validWindows(value.windows) || !validMonth(value.month)) return null;
      return { askedFrom, at, windows: value.windows, month: value.month };
    },
    // 답을 적는다 — 물을 때의 세대 수가 지금과 같을 때만(지우는 길이 그 사이에 돌았으면 적지 않는다). 적었나를 돌려준다.
    write(account, { revision, day, askedFrom, at, windows, month, since }) {
      if (since !== generation) return false;
      const value = {
        v: VERSION,
        revision,
        day,
        askedFrom,
        at,
        windows: {
          monthAgo: { from: windows.monthAgo.from, to: windows.monthAgo.to },
          since: { from: windows.since.from, to: windows.since.to },
          last7: { from: windows.last7.from, to: windows.last7.to },
        },
        month: month.map(row => ({ unit: row.unit, misses: row.misses, reviews: row.reviews, last: row.last ?? null })),
      };
      try {
        storage?.setItem(keyOf(account), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    clear: account => clearMonthAnswer(storage, account),
  };
}

// 적어 둔 답의 단위 줄 → 손님 코치 lookback()의 month 꼴(근거 evidence는 창과 숫자로 다시 짓는다).
export const monthOfAnswer = answer =>
  answer.month.map(row =>
    Object.freeze({
      unit: row.unit,
      misses: row.misses,
      reviews: row.reviews,
      last: row.last,
      evidence: Object.freeze({ ...answer.windows, misses: row.misses, reviews: row.reviews, last: row.last }),
    }),
  );

// 완결되지 않은 답의 까닭 → 계기 코드(접기가 계속 실패하면 문장이 영영 서지 않는데, 그것이 계기에 보여야 한다 — 설계 주인 11-16 조건 2).
const LOOKBACK_CODES = Object.freeze({
  'fold-failed': 'LOOKBACK_FOLD_FAILED',
  'events-remain': 'LOOKBACK_EVENTS_REMAIN',
  rebuilding: 'LOOKBACK_REBUILDING',
});
export const lookbackCode = reason => LOOKBACK_CODES[reason] ?? 'LOOKBACK_FAILED';

// 학습일 답의 묻기 · 받기 · 다시 그리기 — 셸이 판을 그릴 때마다 month(coach)를 부른다. 쓸 수 있는 답이면 { month }, 아니면 null(문장 없이
// 그린다 — 필요하면 묻거나 받기를 한 번 부른다). 셸이 주는 것:
//   answers   createMonthAnswers의 저장소
//   account   지금 계정 id(손님이면 null) — 부를 때마다 지금 값
//   lineOf    코치 → { revision, ask(offset) } 그 코치를 연 판의 돌아보기 읽기(손님 · 기기 길 · 읽기가 없는 판이면 null)
//   dayOf     지금 학습일 열쇠 · offsetOf 기기의 현지 시각 − UTC(분)
//   redraw    열린 판을 다시 그린다 · note 계기 코드를 남긴다 · alive(account) 답이 왔을 때 아직 그 계정 · 문서인가
export function createMonthAsker({ answers, account, lineOf, dayOf, offsetOf, redraw, note, alive }) {
  const state = { asking: null, tried: null, pulled: new Set() };
  const storageOf = coach => {
    try {
      return coach.summary().storage ?? null;
    } catch {
      return null; // 닫힌 코치
    }
  };

  // 받기 — 그 답의 자리마다 한 번(같은 자리로 거듭 부르지 않는다 — 받기가 실패해도). 코치가 받지 않으면(null) 다음 받기를 기다린다.
  function pullOnce(coach, at) {
    const key = JSON.stringify([at.edition, at.gen ?? null, at.foldedUntil]);
    if (state.pulled.has(key)) return;
    if (state.pulled.size >= 64) state.pulled.clear();
    state.pulled.add(key);
    try {
      void Promise.resolve(coach.pull?.()).catch(() => {});
    } catch {
      // 닫힌 코치 — 다음 받기를 기다린다
    }
  }

  // 묻기 — 같은 계정 · 동의 판 · 학습일로 묻는 중이면 다시 묻지 않는다. 완결되지 않았거나 실패한 답 뒤에는 기기 자리가 바뀌기 전까지 다시
  // 묻지 않는다(상한). 답이 오면 적기 직전에 그 계정 · 문서가 그대로인지와 아직 칸에 들지 않은 답이 없는지 본다.
  function ask(coach, line, { owner, revision, day, device }) {
    const key = `${owner}|${revision}|${day}`;
    if (state.asking === key) return;
    if (state.tried?.key === key && samePosition(state.tried.from, device)) return;
    state.asking = key;
    const since = answers.generation();
    const settle = () => {
      if (state.asking === key) state.asking = null;
    };
    const missed = code => {
      state.tried = { key, from: device };
      try {
        note(code);
      } catch {
        // 계기는 그리기를 막지 않는다
      }
    };
    const reply = got => {
      settle();
      if (!alive(owner)) return;
      const at = positionOf(got?.summaryAt);
      if (got?.complete !== true) {
        missed(lookbackCode(got?.reason));
        // 서버의 자리가 기기보다 앞서면 그 자리로 한 번 받는다 — 받으면 기기 자리가 바뀌어 다음 그리기가 다시 묻는다.
        if (at && aheadOf(at, device)) pullOnce(coach, at);
        return;
      }
      const windows = got.lookback?.windows;
      const month = got.lookback?.month;
      if (!at || !validWindows(windows) || !validMonth(month)) {
        missed('LOOKBACK_FAILED');
        return;
      }
      const storage = storageOf(coach);
      if (!storage || (storage.unfolded || 0) > 0) return; // 물은 사이 칸 밖의 내 답이 섰다 — 그 답이 접힌 뒤 다시 묻는다
      if (!answers.write(owner, { revision, day, askedFrom: device, at, windows, month, since })) return;
      const current = positionOf(storage.sync?.received);
      if (samePosition(current, at)) redraw();
      else if (current && verdictOf(current, { askedFrom: device, at }) === 'behind') pullOnce(coach, at);
    };
    void Promise.resolve()
      .then(() => line.ask(offsetOf()))
      .then(reply, () => {
        settle();
        missed('LOOKBACK_FAILED');
      })
      .catch(() => {
        // 다시 그리기 · 받기의 예외는 묻기를 막지 않는다
      });
  }

  return {
    month(coach) {
      const owner = account();
      if (!owner) return null;
      let line = null;
      try {
        line = lineOf(coach) || null;
      } catch {
        line = null;
      }
      if (!line) return null;
      const storage = storageOf(coach);
      if (storage?.guest !== false || (storage.unfolded || 0) > 0) return null;
      const device = positionOf(storage.sync?.received);
      if (!device) return null; // 첫 받기 전 — 받기 알림이 다시 그린다
      let day = null;
      try {
        day = dayOf();
      } catch {
        return null;
      }
      if (day == null) return null;
      const revision = line.revision;
      const stored = answers.read(owner, { revision, day });
      const verdict = stored ? verdictOf(device, stored) : 'ask';
      if (verdict === 'use') return { month: monthOfAnswer(stored) };
      if (verdict === 'behind') pullOnce(coach, stored.at);
      else ask(coach, line, { owner, revision, day, device });
      return null;
    },
    // 계정이 바뀌거나 지우는 길이 돌면 묻는 중 · 상한 · 받은 자리를 비운다(새 계정은 처음부터 묻는다).
    reset() {
      state.asking = null;
      state.tried = null;
      state.pulled.clear();
    },
  };
}
