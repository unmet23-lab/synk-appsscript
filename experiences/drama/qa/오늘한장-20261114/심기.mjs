// 「오늘」 시연 · 시험용 기록 심기(11-14). 실제 기록기와 같은 호출로 지난날의 기록을 남긴다 — 드라마는 pilot/learning-entry.cjs의
// createRecorder(장면 · 테이크 2 · 새 상황, 판정 갈래 · 코치 노트 도움), 입장 검사는 그 게임 묶음 엔진(SynkLearning)으로 app.mjs와 같은
// present(caseMetadata) · answer(answerPayload). 시계만 지난날로 바꾼다(틀시험 ?c=1과 같은 방식). 합성 계정에만 쓴다 — 운영 계정 · 서버를 건드리지 않는다.
// Node(시험 · 시안 값 뽑기)와 브라우저(WORLD 대역 부모 창) 둘 다에서 돈다.

const DAY = 86400000;
// 시각: day(며칠 전 날짜, 1 = 어제) + hour(그날 기기 시각)로 적거나, daysAgo(지금으로부터 며칠 전)로 적는다. 지금보다 늦으면 지금 1분 전으로.
function when(now, t) {
 if (t.day == null) return now - t.daysAgo * DAY;
 const d = new Date(now); d.setHours(0, 0, 0, 0);
 return Math.min(d.getTime() - t.day * DAY + (t.hour ?? 21) * 3600000, now - 60000);
}
// 판정 갈래 → 기록기가 받는 테이크 결과(talk take 응답의 꼴). 장면 · 테이크 2는 판정 없음(correct null), 새 상황 첫 판정은 서버 trail이 정한다.
const take = (choice, { solo = null } = {}) => {
 const observation = choice === 'pass' ? { kind: 'pass', note: null } : { kind: 'note', note: { kind: choice.slice(5) } };
 const trail = solo == null ? { correct: null, assessable: false } : { correct: solo, assessable: true };
 return { kind: 'result', data: { status: 'ok', observation, trail } };
};

/** 시나리오. day · hour: 며칠 전 날짜의 몇 시(기기 시각). */
export const SCENARIOS = Object.freeze({
 // A: 어제 1화 — 6번 줄 끝 '요'를 세 번 놓쳐 코치 노트, 테이크 2에서 통과, 새 상황(B)은 하지 않고 닫음. 그제 · 어제 입장 검사에서 세부 내용 두 번 놓침.
 A: {
  drama: [
   { day: 1, hour: 21, phase: 'scene', lineId: 's1e01-6', skill: 'ko.speaking.explain', helps: ['text'], takes: ['note-ending', 'note-ending', 'note-ending'], after: ['explanation'] },
   { day: 1, hour: 21.05, phase: 'scene', lineId: 's1e01-7', skill: 'ko.speaking.ask', helps: ['text'], takes: ['pass'] },
   { day: 1, hour: 21.1, phase: 'scene', lineId: 's1e01-8', skill: 'ko.speaking.thank', helps: ['text'], takes: ['pass'] },
   { day: 1, hour: 21.15, phase: 'retake', lineId: 's1e01-6', skill: 'ko.speaking.explain', helps: ['answer'], takes: ['pass'] },
  ],
  entry: { progress: { v: 1, stars: { pool: 2, library: 1 }, plays: 3, tutorial: true, doneDay: null, motion: true },
   shifts: [
    // 세부 내용(detail) 손님: pool-01 맞힘 · pool-04 놓침 · library-01 맞힘 · library-05 놓침 → 최근 셋 가운데 서로 다른 손님 둘을 놓침.
    { day: 2, hour: 20, cases: [['pool-01', true], ['pool-02', true], ['pool-04', false], ['pool-03', true], ['pool-07', true], ['pool-05', true]] },
    { day: 1, hour: 22, cases: [['library-03', true], ['library-01', true], ['library-06', true], ['library-05', false], ['library-04', true]] },
   ] },
 },
 // B: 8일 전 1화를 다 하고 새 상황(B)을 혼자 해냄(C 차례), 그 뒤 기록 없음. 입장 검사는 안 함.
 B: {
  drama: [
   { day: 8, hour: 20, phase: 'scene', lineId: 's1e01-6', skill: 'ko.speaking.explain', helps: ['text'], takes: ['pass'] },
   { day: 8, hour: 20.05, phase: 'scene', lineId: 's1e01-7', skill: 'ko.speaking.ask', helps: ['text'], takes: ['pass'] },
   { day: 8, hour: 20.1, phase: 'scene', lineId: 's1e01-8', skill: 'ko.speaking.thank', helps: ['text'], takes: ['note-length', 'pass'] },
   { day: 8, hour: 20.2, phase: 'transfer', lineId: 's1e01-t9', skill: 'ko.speaking.ask', lazy: 'transcribed', takes: [['pass', true]] },
  ],
  entry: null,
 },
 // F: 첫날 — 오늘 처음 1화를 하는 중(오늘 기록뿐).
 F: {
  drama: [{ daysAgo: 0.01, phase: 'scene', lineId: 's1e01-6', skill: 'ko.speaking.explain', helps: ['text'], takes: ['note-ending'] }],
  entry: null,
 },
});

/**
 * host: WORLD 학습 호스트(createGame(options, factory, sync)). drama: 드라마 묶음(DramaLearning — createRecorder · engine).
 * entry: 입장 검사 묶음(SynkLearning — engine) · entryLearning: entry-check/learning.mjs(caseMetadata · answerPayload) · VENUES.
 * playStorage: 입장 검사 진도 저장(WORLD 밖이면 localStorage). now: 기준 시각(ms).
 */
export async function seed({ host, drama, entry = null, entryLearning = null, VENUES = null, playStorage = null, scenario, now = Date.now(), settle = async () => {} }) {
 const S = typeof scenario === 'string' ? SCENARIOS[scenario] : scenario;
 if (!S) throw new Error('scenario');
 // 드라마: 차례마다 그 시각의 시계로 기록기를 새로 세운다(기록기는 게임 하나를 잡아 둔다).
 for (const turn of S.drama) {
  const at = when(now, turn);
  let tick = 0;
  const clock = () => new Date(at + (tick++) * 1000).toISOString();
  const owner = { createGame: (opts, f, s) => host.createGame({ ...opts, clock }, f, s) };
  const rec = drama.createRecorder({ win: null, owner });
  await settle();
  const P = rec.open({ lineId: turn.lineId, skillId: turn.skill, phase: turn.phase, ...(turn.lazy ? { lazy: turn.lazy } : {}) });
  for (const k of turn.helps || []) P.help(k);
  for (const t of turn.takes) { const [choice, solo] = Array.isArray(t) ? t : [t, null]; P.take(take(choice, { solo })); }
  for (const k of turn.after || []) P.help(k);
  rec.flush();
 }
 if (!S.entry || !entry || !entryLearning || !VENUES) return;
 if (playStorage) playStorage.setItem('synk.entry-check.v1', JSON.stringify(S.entry.progress));
 const byId = new Map(VENUES.flatMap((v) => v.cases.map((c) => [c.id, c])));
 for (const shift of S.entry.shifts) {
  const at = when(now, shift);
  let tick = 0;
  const clock = () => new Date(at + (tick++) * 20000).toISOString();
  const g = host.createGame({ gameId: 'entry-check', clock }, entry.engine.createGame, entry.engine.createLearningSync);
  await settle();
  for (const [id, correct] of shift.cases) {
   const c = byId.get(id);
   const pid = g.present(entryLearning.caseMetadata(c));
   const choice = correct ? { selectedId: c.answer, correctId: c.answer } : { selectedId: c.answer === 'pass' ? 'reject' : 'pass', correctId: c.answer };
   g.answer(pid, entryLearning.answerPayload(correct, choice));
  }
  g.flush?.(); g.dispose?.();
 }
}
