// 30일째 문장의 계정 길 — 학습일 답(단계4_계획 §21-22 · 「설계 검토로 고친 것」 · 「설계 다시 검수로 고친 것」). 서버 길 계정은 기기에 이틀 치만
// 있어 코치가 세지 못하므로(coach.lookback() null) 서버의 돌아보기 읽기(learning?view=trail-lookback)로 묻고, 그 답을 계정마다 localStorage 열쇠
// 하나에 둔다.
//   값: 학습일 · 동의 판 · 물을 때의 기기 자리(askedFrom) · 서버가 셀 때의 자리(at = 답의 summaryAt) · 창 · 단위마다 id와 숫자(misses ·
//   reviews · last). 문항 글이나 답 글은 두지 않는다. 읽기와 쓰기는 모두 try/catch로 감싸고, 읽지 못하면 서버에 다시 묻는다.
//   보일 때는 기기가 지금 받은 요약의 자리(coach summary().storage.sync.received)와 답의 자리를 견준다(verdictOf). 캐시 값만 믿고 문장을
//   짓지 않는다. 서버 접기가 단위 줄을 바꾸는 내 사건(답 · 도움 · 본인 말 · 제외)이 아직 접혀 돌아오지 않았으면(storage.unfoldedRows > 0)
//   묻지도, 적지도, 짓지도 않는다(heldBack — 설계 주인 11-17).
//   지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 연습 기록 비우기)은 열쇠를 지우고 세대 수를 올린다. 답이 오면 적기 직전에 물을 때의 세대 수가
//   지금과 같은지 본다 — 다른 탭에서 로그아웃했거나 같은 계정에서 동의를 끈 뒤의 늦은 답이 적히지 않게. 다른 열쇠의 물음(학습일 경계 · 새 판의
//   코치)에 밀려난 물음과 물은 사이 학습일이 넘어간 물음의 답 · 실패도 버린다.
// 묻기 · 받기 · 다시 그리기(createMonthAsker)는 셸(world-learning-ui.mjs)이 판을 그릴 때 부른다. 상한이 셋이다(설계 주인 11-16 밤 조건 1 · 2).
//   묻기 — 물은 뒤 기기 자리가 바뀌었을 때만 다시 묻는다. 완결되지 않았거나 실패한 답 뒤에도 기기 자리가 그대로면 다시 묻지 않는다.
//   받기(coach.pull) — 기기가 답의 자리보다 뒤처졌을 때 그 답의 자리마다 한 번. 받기가 실패해도 그 자리에서는 다시 부르지 않는다.
//   다시 그리기 — 적은 답의 자리가 기기 자리와 같을 때만 한 번. 쓸 수 없는 답(완결되지 않음 · 뒤처짐)으로는 다시 그리지 않는다.
// 규칙마다 qa/position-mutants.mjs에 깬 변형이 있고, qa/atlas-next-month-answer.test.mjs의 셈 시험이 잡는다.
// 예상 급수의 근거 상자(4-4d — 단계4_계획 §21-23의 2)도 이 상자를 쓴다. 열쇠 머리 · 값의 꼴 · 받은 답 읽기 · 묻는 함수 · 까닭 코드 · 내는 꼴만
// 종류(kind — MONTH_KIND · FIRST_KIND)로 받고, 묻기 · 받기 · 다시 그리기의 상한과 자리 견주기는 같다(설계 검토 Fable F5). 지우는 길은 두 종류의
// 열쇠를 함께 지운다.
const VERSION = 1;
const GEN = /^(\d{13})\.[0-9a-z]{1,16}$/;
const finite = value => Number.isFinite(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// 학습일 답을 막는 내 사건이 있나 — 서버 접기가 단위 줄을 바꾸는 내 사건(답 · 도움 · 본인 말 · 제외) 가운데 아직 접혀 돌아오지 않은 것
// (코치 summary().storage.unfoldedRows — 설계 주인 11-17, 4-4c 끝 판 Fable F4). 응답을 지우거나 「이미 알아요」를 말한 뒤 그 사건이 접혀
// 돌아오기 전에는 30일째 문장의 수와 조건이 그 사건을 모른다. 그 칸이 정수가 아니면(칸이 없는 엔진) 칸 밖의 내 답 · 도움 수(unfolded)로 본다.
const heldBack = storage => (Number.isInteger(storage.unfoldedRows) ? storage.unfoldedRows : (storage.unfolded ?? 0)) > 0;

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
// 시각이 같고 gen이 다르면(같은 밀리초에 지은 머리 · 꼴이 아닌 gen끼리) 앞에 준 쪽(next)을 새 머리로 본다 — 엔진도 받은 머리를 새것으로
// 얹으므로(log.mjs newer · summary.mjs fitOf), 셸이 그 답을 뒤처짐으로 보고 한 번 받으면 기기가 그 머리로 와 같은 자리가 된다. 셸만 다르게
// 가리면 기기는 새 머리를 얹는데 셸은 다시 묻는 어긋남이 생긴다(4-4c 끝 판 카본 B2 — 안함의 까닭).
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

// 이 문서가 든 답(kept)과 저장소의 답 가운데 견줄 답 — 저장소 것이 이 문서 것보다 앞설 때만(다른 탭이 더 새 답을 적었다) 저장소 것이다. 쓰기만
// 막혀(용량 초과 따위) 저장소에 앞 답이 남았으면 이 문서의 새 답으로 견준다. 앞 답으로 견주면 같은 자리에서 묻기와 다시 그리기가 끝없이 돈다
// (4-4c 끝 판 GPT GB1).
function fresherOf(kept, stored) {
  if (!kept || !stored) return kept ?? stored;
  return aheadOf(stored.at, kept.at) ? stored : kept;
}

// 학습일 답의 줄 — 서버(엔진 lookbackOfStore)는 조건을 넘은 단위를 자르지 않고 모두 낸다(지도 단위는 293개다). 문장은 점수(misses + reviews)가 큰
// 단위에서 고르므로(world-lookback-next.mjs pickMonth), 받은 답이 64줄을 넘으면 점수 차례로 앞의 64줄만 둔다. 예전에는 64줄을 넘는 답을 통째로
// 버려, 가장 열심히 한 학습자에게 문장이 서지 않았다(4-4c 끝 판 Fable F5). 받는 꼴 검사는 그보다 넉넉한 MONTH_LIMIT까지 본다.
const MONTH_ROWS = 64;
const MONTH_LIMIT = 4096;
const byScore = (a, b) =>
  b.misses + b.reviews - (a.misses + a.reviews) || (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0);
const keptRows = rows => (rows.length <= MONTH_ROWS ? rows : [...rows].sort(byScore).slice(0, MONTH_ROWS));

function validMonth(rows) {
  return (
    Array.isArray(rows) &&
    rows.length <= MONTH_LIMIT &&
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

// 답의 꼴 — 저장소에 적는 값과 이 문서가 들고 있는 답(createMonthAsker의 kept)이 같은 꼴이다(단위 id와 숫자만, 문항 글이나 근거 글은 두지 않는다).
const shapeOf = ({ askedFrom, at, windows, month }) => ({
  askedFrom,
  at,
  windows: {
    monthAgo: { from: windows.monthAgo.from, to: windows.monthAgo.to },
    since: { from: windows.since.from, to: windows.since.to },
    last7: { from: windows.last7.from, to: windows.last7.to },
  },
  month: month.map(row => ({ unit: row.unit, misses: row.misses, reviews: row.reviews, last: row.last ?? null })),
});

// 세대 수 — 이 문서의 모든 저장소가 함께 쓴다(로그아웃 · 동의 끔은 셸의 다른 자리에서 clearMonthAnswer로 지운다). 상자의 종류(학습일 답 · 근거)와
// 상관없이 하나다 — 지우는 길 한 번이 두 종류의 물음 모두를 늦은 답으로 만든다.
let generation = 0;
const keyOf = (kind, account) => `${kind.prefix}${account}`;

// 지우는 길(로그아웃 · 동의 끔 · 계정 바꿈 · 연습 기록 비우기) — 그 계정의 두 열쇠(학습일 답 · 근거)를 지우고 세대 수를 올린다(물은 뒤의 늦은
// 답을 적지 않게). 한 열쇠를 지우다 저장소가 던져도 다른 열쇠는 지운다.
export function clearMonthAnswer(storage, account) {
  generation += 1;
  for (const kind of KINDS) {
    try {
      if (account) storage?.removeItem(keyOf(kind, account));
    } catch {
      // 저장소가 막혀도 세대 수는 올렸다 — 다음 읽기는 판 · 학습일로 다시 거른다
    }
  }
}

// 저장소 — 계정마다 열쇠 하나(종류마다). storage는 localStorage 꼴(getItem · setItem · removeItem). kind는 상자의 종류(없으면 학습일 답).
export function createMonthAnswers({ storage = globalThis.localStorage, kind = MONTH_KIND } = {}) {
  return {
    generation: () => generation,
    // 적어 둔 답 — 계정 · 동의 판 · 학습일이 맞고 꼴이 맞을 때만. 아니면 null(다시 묻는다). 늘 저장소에서 바로 읽는다(다른 탭이 덮었으면 그 값).
    read(account, { revision, day }) {
      let value = null;
      try {
        value = JSON.parse(storage?.getItem(keyOf(kind, account)) ?? 'null');
      } catch {
        return null;
      }
      if (!plain(value) || value.v !== VERSION || value.revision !== revision || value.day !== day) return null;
      const askedFrom = positionOf(value.askedFrom);
      const at = positionOf(value.at);
      if (!askedFrom || !at || !kind.valid(value)) return null;
      return { askedFrom, at, ...kind.body(value) };
    },
    // 답을 적는다 — 물을 때의 세대 수가 지금과 같고 저장소가 있을 때만(지우는 길이 그 사이에 돌았으면 적지 않는다). 적었나를 돌려준다.
    write(account, { revision, day, since, ...answer }) {
      if (since !== generation) return false;
      if (!storage) return false;
      const value = { v: VERSION, revision, day, ...kind.shape(answer) };
      try {
        storage.setItem(keyOf(kind, account), JSON.stringify(value));
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

// 상자의 종류 — 학습일 답(30일째 문장). 받은 답의 줄은 점수 차례로 64줄까지만 둔다(keptRows).
//   prefix 열쇠 머리 · valid(값) 저장소 값의 몸이 꼴인가 · body(값) 값의 몸 · parse(답) 받은 답의 몸(꼴이 아니면 null) · shape(답) 적는 꼴 ·
//   use(적은 답) 셸에 내는 꼴 · code(까닭) 완결되지 않은 답의 계기 코드 · failed 실패의 계기 코드 · query(줄, offsetOf) 묻는 함수 ·
//   redrawMissed 그 자리에서 묻기를 그만두면(실패 · 완결되지 않은 답 뒤의 상한) 열린 판을 한 번 다시 그린다 — 「확인 중」을 그리는 종류만 둔다
export const MONTH_KIND = Object.freeze({
  prefix: 'synk:world:month-answer:',
  valid: value => validWindows(value.windows) && validMonth(value.month),
  body: value => ({ windows: value.windows, month: value.month }),
  parse: got => {
    const windows = got.lookback?.windows;
    const month = got.lookback?.month;
    return validWindows(windows) && validMonth(month) ? { windows, month: keptRows(month) } : null;
  },
  shape: shapeOf,
  use: stored => ({ month: monthOfAnswer(stored) }),
  code: lookbackCode,
  failed: 'LOOKBACK_FAILED',
  query: (line, offsetOf) => line.ask(offsetOf()),
});

// ── 예상 급수의 근거 상자(4-4d — 단계4_계획 §21-23의 2, 설계 주인 11-17 답 2) ──
// 서버 길 계정은 기기에 이틀 치만 있어 코치가 근거를 세지 못한다(coach.firstAnswers() null). 서버의 근거 읽기(learning?view=trail-first-answers)로
// 묻고, 그 답(능력 id마다의 근거 수)을 계정마다 열쇠 하나에 둔다. 근거 답은 능력마다의 수라 자르지 않는다. 학습일 열쇠는 학습일 답처럼 하루에 한 번
// 다시 묻는 경계일 뿐이다 — 창은 서버가 답할 때의 시각에서 days × 24시간을 뺀 때이고 답에 since로 싣는다(학습일 경계로 맞추지 않는다).
// 근거를 세는 판의 게임 이름 — 새 길의 시험 형식 연습 코치가 이 이름으로 열린다(입구 world-atlas-next.mjs mockCoach가 가져다 쓴다 — 한 곳에만
// 적는다. 두 곳에 따로 적으면 한쪽만 바뀔 때 근거 수가 말없이 0이 된다 — Fable 끝 판 F15).
export const FIRST_GAME = 'world-mock';
export const FIRST_DAYS = 90; // 창의 날 수 — 제품 상수(설계 주인 11-17 답 2 · world-position.mjs ESTIMATE_POLICY.recentDays와 같다)
const FIRST_SKILL = /^[A-Za-z0-9_.:-]{1,120}$/;
const FIRST_LIMIT = 4096;
const validBySkill = value =>
  plain(value) &&
  Object.keys(value).length <= FIRST_LIMIT &&
  Object.entries(value).every(([skill, n]) => FIRST_SKILL.test(skill) && Number.isSafeInteger(n) && n >= 0);
// 받은 답의 몸(서버 firstAnswers — 창의 시작 since) · 적은 값의 몸(창의 시작 from) — 물은 게임 · 날 수와 같고, 창의 시작이 수이고, 능력마다의
// 수가 꼴일 때만. 상자 안에서는 창의 시작을 from에 둔다 — 쓰기의 since는 세대 수라(write) 이름이 겹치면 창의 시작을 덮는다.
const validFirst = (value, start) =>
  value?.game === FIRST_GAME && value.days === FIRST_DAYS && finite(value[start]) && validBySkill(value.bySkill);
const bySkillCopy = bySkill =>
  Object.fromEntries(
    Object.keys(bySkill)
      .sort()
      .map(skill => [skill, bySkill[skill]]),
  );
const FIRST_CODES = Object.freeze({
  'fold-failed': 'FIRST_ANSWERS_FOLD_FAILED',
  'events-remain': 'FIRST_ANSWERS_EVENTS_REMAIN',
  rebuilding: 'FIRST_ANSWERS_REBUILDING',
});
export const firstAnswersCode = reason => FIRST_CODES[reason] ?? 'FIRST_ANSWERS_FAILED';
export const FIRST_KIND = Object.freeze({
  prefix: 'synk:world:first-answers:',
  valid: value => validFirst(value, 'from'),
  body: value => ({ game: value.game, days: value.days, from: value.from, bySkill: value.bySkill }),
  parse: got => {
    const body = got.firstAnswers;
    return validFirst(body, 'since') ? { game: body.game, days: body.days, from: body.since, bySkill: body.bySkill } : null;
  },
  shape: ({ askedFrom, at, game, days, from, bySkill }) => ({ askedFrom, at, game, days, from, bySkill: bySkillCopy(bySkill) }),
  use: stored => ({ since: stored.from, bySkill: Object.freeze(bySkillCopy(stored.bySkill)) }),
  code: firstAnswersCode,
  failed: 'FIRST_ANSWERS_FAILED',
  query: line => line.ask({ game: FIRST_GAME, days: FIRST_DAYS }),
  // 근거를 읽지 못한 자리에서는 한 번 다시 그린다 — 예상 급수 칸이 「기록 확인 중」으로 남지 않고 근거 수 없이 그린다(설계 주인 11-17 저녁 답 4 나).
  redrawMissed: true,
});
const KINDS = Object.freeze([MONTH_KIND, FIRST_KIND]);

// 학습일 답의 묻기 · 받기 · 다시 그리기 — 셸이 판을 그릴 때마다 month(coach)를 부른다. 쓸 수 있는 답이면 { month }, 아니면 null(문장 없이
// 그린다 — 필요하면 묻거나 받기를 한 번 부른다). 근거 상자(kind FIRST_KIND)는 같은 함수를 answer(coach)로 부르고 { since, bySkill }을 받는다
// (null이면 근거 수를 그리지 않고 「확인 중」). 셸이 주는 것:
//   answers   createMonthAnswers의 저장소
//   account   지금 계정 id(손님이면 null) — 부를 때마다 지금 값
//   lineOf    코치 → { revision, ask(offset) } 그 코치를 연 판의 돌아보기 읽기(손님 · 기기 길 · 읽기가 없는 판이면 null)
//   dayOf     지금 학습일 열쇠 · offsetOf 기기의 현지 시각 − UTC(분)
//   redraw    열린 판을 다시 그린다 · note 계기 코드를 남긴다 · alive(account) 답이 왔을 때 아직 그 계정 · 문서인가
//   kind      상자의 종류(없으면 학습일 답 — answers도 같은 종류로 만든다)
export function createMonthAsker({ answers, account, lineOf, dayOf, offsetOf, redraw, note, alive, kind = MONTH_KIND }) {
  // asking 묻는 중인 열쇠 · tried 완결되지 않았거나 실패한 물음의 열쇠와 기기 자리 · pulled 받기를 부른 답의 자리 · kept 이 문서가 들고 있는 답 ·
  // coach 이 상자가 마지막으로 그린 코치 · ahead 닫힌 코치에 온 완결되지 않은 답의 앞선 자리(열쇠와 함께 — 다음 그리기의 코치가 받는다) ·
  // missed 마지막 그리기가 묻기를 그만둔 자리에서 멈춘 코치(아니면 null — 셸이 「확인 중」 대신 읽지 못함으로 그린다).
  // owner · generation — 상자가 지금 따르는 계정과 세대 수(바뀌면 위를 모두 비운다).
  const state = { owner: null, generation: null, asking: null, tried: null, pulled: new Set(), kept: null, coach: null, ahead: null, missed: null };
  const reset = () => {
    state.asking = null;
    state.tried = null;
    state.pulled.clear();
    state.kept = null;
    state.coach = null;
    state.ahead = null;
    state.missed = null;
  };
  // 계정이 바뀌었거나 지우는 길(로그아웃 · 동의 바꿈 · 비우기)이 세대 수를 올렸으면 상자를 비운다 — 앞 계정 · 앞 세대의 상한과 받은 자리가 다시
  // 들어온 같은 계정의 물음과 받기를 막지 않게(카본 다시 보기 A1).
  const follow = owner => {
    const now = answers.generation();
    if (state.owner === owner && state.generation === now) return;
    reset();
    state.owner = owner;
    state.generation = now;
  };
  // 이 문서가 들고 있는 답 — 저장소가 막혀(없음 · 읽기가 던짐 · 쓰기가 말없이 버림 · 쓰기가 던짐) 적은 답이 다시 읽히지 않아도, 같은 계정 · 동의 판
  // · 학습일 · 세대 안에서는 이 답으로 견준다. 그래야 완결된 답 뒤의 상한이 저장소에 기대지 않는다(Fable 다시 보기 FA1).
  const keptFor = key => (state.kept?.key === key ? state.kept.answer : null);
  const storageOf = coach => {
    try {
      return coach.summary().storage ?? null;
    } catch {
      return null; // 닫힌 코치
    }
  };
  // 답을 들일 코치 — 물은 코치가 열려 있으면 그 코치다. 닫혔으면(물은 사이 판을 다시 정해 같은 판의 새 코치가 열렸다) 이 상자가 마지막으로 그린
  // 코치가 같은 동의 판으로 열려 있을 때 그 코치다. 받기 · 다시 묻기 · 다시 그리기가 닫힌 코치로 가면 열린 판이 문장을 잃고, 같은 자리에서 다시
  // 묻는다(4-4c 끝 판 카본 -c B1). 둘 다 아니면 열린 코치가 없다(storage null).
  const holderOf = (asked, askedLine) => {
    const own = storageOf(asked);
    const last = state.coach;
    if (own || !last || last === asked) return { coach: asked, line: askedLine, storage: own };
    let line = null;
    try {
      line = lineOf(last) || null;
    } catch {
      line = null;
    }
    const storage = line?.revision === askedLine.revision ? storageOf(last) : null;
    return storage ? { coach: last, line, storage } : { coach: asked, line: askedLine, storage: null };
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
    if (state.asking?.key === key) return;
    if (state.tried?.key === key && samePosition(state.tried.from, device)) return;
    // 물음마다 표지 — 이 물음이 아직 지금 물음인지 가린다. 상자를 비웠거나(reset) 다른 열쇠의 물음(학습일 04:00 경계 · 동의 판이 바뀐 새 코치)이
    // 이 물음을 밀어냈으면, 늦은 답과 실패는 「묻는 중」도, 이 문서의 답 · 저장소 · 상한 · 받은 자리도 건드리지 않는다. 밀려난 어제 물음의 답이
    // 오늘 답을 덮으면 다시 그리기에서 오늘 답이 사라져 같은 자리에서 다시 묻고, 옛 판 물음의 실패가 새 코치의 상한을 덮는다(4-4c 끝 판 카본 B2).
    const token = {};
    state.asking = { key, token };
    const since = answers.generation();
    // 이 물음이 지금 물음이면 「묻는 중」을 비우고 참을 낸다.
    const settle = () => {
      if (state.asking?.token !== token) return false;
      state.asking = null;
      return true;
    };
    // 답이 왔을 때 아직 그 계정 · 문서 · 세대 · 학습일인가. 물은 사이 학습일이 넘어갔으면 어제 열쇠의 답은 쓸 데가 없고, 적으면 다른 탭이 적은
    // 오늘 답을 덮는다(카본 B2). 동의 판은 코치마다 하나라(판이 바뀌면 새 코치가 새 열쇠로 묻는다) 표지가 가린다.
    const still = () => {
      if (!alive(owner) || since !== answers.generation()) return false;
      try {
        return dayOf() === day;
      } catch {
        return false;
      }
    };
    const missed = code => {
      state.tried = { key, from: device };
      try {
        note(code);
      } catch {
        // 계기는 그리기를 막지 않는다
      }
    };
    // 이 자리에서 묻기를 그만두었다 — 「확인 중」을 그리는 종류(redrawMissed)면 열린 판을 한 번 다시 그려 읽지 못함으로 바꾼다(설계 주인 11-17 저녁
    // 답 4 나). 다시 그린 판은 같은 자리에서 다시 묻지 않으므로(상한) 다시 그리기도 묻기 수로 묶인다.
    const drawMissed = () => {
      if (kind.redrawMissed !== true) return;
      try {
        redraw();
      } catch {
        // 다시 그리기는 묻기를 막지 않는다
      }
    };
    const reply = got => {
      // 밀려난 물음이거나, 그 계정 · 문서가 아니거나, 물은 사이 지우는 길(로그아웃 · 동의 바꿈 · 비우기)이 돌았거나 학습일이 넘어갔으면, 늦은 답은
      // 완결이든 아니든 들지도 적지도 다시 그리지도 않고 상한 · 받은 자리도 건드리지 않는다 — 앞 세대 답이 새 세대의 tried · pulled를 채우면 지금
      // 코치가 꼭 해야 할 받기를 건너뛴다(카본 다시 보기 A1 · 4-4c 끝 판 GPT GB2 · 카본 B2).
      if (!settle() || !still()) return;
      const at = positionOf(got?.summaryAt);
      if (state.ahead?.key === key) state.ahead = null;
      const holder = holderOf(coach, line);
      const storage = holder.storage;
      if (got?.complete !== true) {
        missed(kind.code(got?.reason));
        // 열린 코치가 없다(물은 코치가 닫혔고 같은 판의 새 코치를 아직 그리지 않았다) — 닫힌 코치로 받지 않는다(받은 자리를 먼저 채우면 뒤 코치의
        // 받기를 막는다 — 4-4c 끝 판 카본 B1). 서버의 자리는 남겨, 다음 그리기의 코치가 그 자리로 한 번 받게 한다(카본 -c B1).
        if (!storage) {
          if (at) state.ahead = { key, at };
          return;
        }
        // 물을 때의 자리가 아니라 지금 기기 자리와 견준다 — 묻는 사이 받기 알림이 기기를 올렸어도 그 다시 그리기는 「묻는 중」에 막혔다. 접혀
        // 돌아오지 않은 내 사건이 있으면 멈춘다(4-4c 끝 판 카본 B1 · 설계 주인 11-17).
        if (heldBack(storage)) return;
        const current = positionOf(storage.sync?.received);
        if (!current) return;
        // 서버의 자리가 지금 기기보다 앞서면 그 자리로 한 번 받는다 — 받으면 기기 자리가 바뀌어 다음 그리기가 다시 묻는다.
        if (at && aheadOf(at, current)) pullOnce(holder.coach, at);
        // 묻는 사이 기기 자리가 바뀌었다 — 그 자리에서 한 번 다시 묻는다(완결된 답의 FA2와 같은 셈 — 묻기 ≤ 기기 자리가 바뀐 수 + 1).
        else if (!samePosition(current, device)) ask(holder.coach, holder.line, { owner, revision, day, device: current });
        // 받을 것도 다시 물을 것도 없다 — 이 자리에서 묻기를 그만두었다.
        else drawMissed();
        return;
      }
      const body = kind.parse(got);
      if (!at || !body) {
        missed(kind.failed);
        drawMissed();
        return;
      }
      if (storage && heldBack(storage)) return; // 물은 사이 접혀 돌아오지 않은 내 사건이 섰다 — 그 사건이 접힌 뒤 다시 묻는다
      const answer = kind.shape({ askedFrom: device, at, ...body });
      state.kept = { key, answer };
      answers.write(owner, { revision, day, ...answer, since }); // 막힌 저장소면 이 문서의 답(kept)만 남는다
      // 열린 코치가 없으면 적기만 한다 — 다음 그리기의 코치가 이 답으로 견준다(버리면 같은 자리에서 다시 묻는다 — 카본 -c B1). 접혀 돌아오지
      // 않은 내 사건이 있었는지는 다음 그리기가 본다(month는 heldBack이면 이 답을 쓰지 않는다).
      if (!storage) return;
      const current = positionOf(storage.sync?.received);
      if (samePosition(current, at)) redraw();
      else if (current) {
        const verdict = verdictOf(current, answer);
        if (verdict === 'behind') pullOnce(holder.coach, at);
        // 묻는 사이 기기가 답의 자리를 지나 앞섰다 — 그 자리에서 한 번 다시 묻는다. 물은 뒤 기기 자리가 바뀐 수로 묶인다(Fable 다시 보기 FA2).
        else if (verdict === 'ask') ask(holder.coach, holder.line, { owner, revision, day, device: current });
      }
    };
    void Promise.resolve()
      .then(() => kind.query(line, offsetOf))
      .then(reply, () => {
        // 로그아웃 · 계정 바꿈으로 끊긴 물음(감싸개의 ACCOUNT_CHANGED), 물은 사이 지우는 길이 돈 물음, 밀려난 물음 · 학습일이 넘어간 물음은 실패로
        // 적지 않는다 — 다른 계정 · 새 세대 · 새 열쇠의 계기와 상한을 덮지 않게(카본 다시 보기 A1 · 4-4c 끝 판 GPT GB2 · 카본 B2).
        if (settle() && still()) {
          missed(kind.failed);
          drawMissed();
        }
      })
      .catch(() => {
        // 다시 그리기 · 받기의 예외는 묻기를 막지 않는다
      });
  }

  const box = {
    month(coach) {
      state.missed = null;
      const owner = account();
      if (!owner) return null;
      follow(owner);
      state.coach = coach; // 답이 왔을 때 물은 코치가 닫혔으면 이 코치로 들인다(holderOf — 카본 -c B1)
      let line = null;
      try {
        line = lineOf(coach) || null;
      } catch {
        line = null;
      }
      if (!line) return null;
      const storage = storageOf(coach);
      if (storage?.guest !== false || heldBack(storage)) return null;
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
      const key = `${owner}|${revision}|${day}`;
      const stored = fresherOf(keptFor(key), answers.read(owner, { revision, day }));
      const verdict = stored ? verdictOf(device, stored) : 'ask';
      if (verdict === 'use') return kind.use(stored);
      if (verdict === 'behind') pullOnce(coach, stored.at);
      else {
        // 닫힌 코치에 온 완결되지 않은 답의 앞선 자리 — 그때 받지 못했으면 이 코치로 한 번 받는다(4-4c 끝 판 카본 -c B1).
        if (state.ahead?.key === key && aheadOf(state.ahead.at, device)) pullOnce(coach, state.ahead.at);
        ask(coach, line, { owner, revision, day, device });
        // 묻지 않았고 묻는 중도 아니다 — 이 자리에서 묻기를 그만두었다(실패하거나 완결되지 않은 답 뒤의 상한). 셸은 「확인 중」 대신 읽지 못함으로 그린다.
        if (state.asking?.key !== key && state.tried?.key === key && samePosition(state.tried.from, device)) state.missed = coach;
      }
      return null;
    },
    // 마지막 그리기(month · answer)가 이 코치로 묻기를 그만둔 자리에서 멈췄는가(설계 주인 11-17 저녁 답 4 나 — 셸이 「확인 중」 대신 읽지 못함으로 그린다).
    missed: coach => state.missed !== null && state.missed === coach,
    // 묻는 중 · 상한 · 받은 자리 · 이 문서의 답을 비운다. 계정이나 세대 수가 바뀌면 month()가 스스로 부른다.
    reset,
  };
  // 근거 상자는 같은 함수를 answer로 부른다 — 무엇을 내는지는 상자의 종류가 정한다(학습일 답 { month } · 근거 { since, bySkill }).
  return Object.freeze({ ...box, answer: box.month });
}
