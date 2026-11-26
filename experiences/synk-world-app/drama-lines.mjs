// 드라마 1화 학습 기록 훑기(Atlas 사건 → 보임마다 시도 · 도움). 두 곳이 함께 쓴다.
//  · 1화 learning-entry.cjs의 revisitFacts — 다시 만나기의 재료(드라마 설계 §18-1). 1화 묶음(atlas-learning.js)에 함께 실린다.
//  · 서울행 seoul-entry.mjs — 「내 팬」 대사별 칭찬(experiences/seoul-arrival/팬설계.md 13-2). WORLD 부모 창은 1화 묶음을 싣지 않아 이 모듈만 읽는다.
// 의존이 없는 순수 함수다. 기록에는 받아 적은 글 · 소리가 원래 없다.
export const GAME_ID = 'drama-s1';
// 판정된 시도의 갈래(choice). hold(판정 보류) · unclear(한국어인지 · 말 빠르기를 못 가림)는 판정이 아니라 건너뛴다.
export const JUDGED = Object.freeze(['pass', 'note-ending', 'note-length', 'note-missing']);
// 튜터 코치 노트와 같은 차례(pilot.mjs pickNote): 끝맺음 → 길이 → 빠진 말.
export const NOTE_ORDER = Object.freeze(['ending', 'length', 'missing']);
const TASK = /^drama-s1\.(scene|retake|transfer|review)\.([a-zA-Z0-9_.:-]+)$/;
const noteKind = (choice) => (typeof choice === 'string' && choice.startsWith('note-') ? choice.slice(5) : null);

// 보임(practice.presented)마다 {id, lineId, phase, at, attempts, answers, dropped}. 이 게임의 결정 → 보임 → 시도를 잇는다.
// attempts는 사건 차례대로 [{no, choice, unanswered, at, k}], answers는 대사 전체(answer 도움)를 본 사건 자리 k.
// 「그 시도 전에 도움을 봤나」는 사건 차례(배열 자리 k)로 가른다 — 시각은 ms가 같을 수 있다(결과 화면이 판정 바로 뒤 도움을 남긴다).
// 「제가 한 말과 달라요」로 뺀 보임은 없고, 뺀 시도는 attempts에 넣지 않고 dropped로 센다.
export function scanPresentations(events) {
  const list = Array.isArray(events) ? events : [];
  const byId = new Map(list.map((e) => [e?.id, e]));
  const gone = new Set(list.filter((e) => e?.type === 'record.excluded').map((e) => e.targetId));
  const out = new Map();
  for (const e of list) {
    if (e?.type !== 'practice.presented' || gone.has(e.id)) continue;
    const d = byId.get(e.decisionId), m = TASK.exec(e.taskId || '');
    if (d?.type !== 'decision.made' || d.experienceId !== GAME_ID || !m || m[2] !== e.itemKey) continue;
    out.set(e.id, { id: e.id, lineId: e.itemKey, phase: m[1], at: Date.parse(e.at), attempts: [], answers: [], dropped: 0 });
  }
  list.forEach((e, k) => {
    const p = out.get(e?.presentationId); if (!p) return;
    if (gone.has(e.id)) { if (e.type === 'practice.attempted') p.dropped += 1; return; }
    const at = Date.parse(e.at); if (!Number.isFinite(at)) return;
    if (e.type === 'practice.helped' && e.level === 'answer') p.answers.push(k);
    if (e.type === 'practice.attempted') p.attempts.push({ no: e.attemptNo, choice: e.choice?.selectedId ?? null, unanswered: e.reason === 'unanswered', at, k });
  });
  return out;
}

// 한 보임의 결과(팬설계 13-2 표). 마지막 판정이 고칠 점이면 칭찬하지 않고 todo다.
//  clean: 시도 1이 pass이고, 그 앞에 대사 전체를 보지 않았고, 같은 보임에 뺀 시도가 없다.
//  fixed: 판정된 첫 시도가 note-<kind>이고, 뒤에 pass가 있으며, 그 pass 앞에 대사 전체를 보지 않았다.
//  heard: 시도 1이 안 들림(unanswered)이고, 판정된 첫 시도가 대사 전체를 보지 않은 pass다.
//  todo: 마지막 판정이 note-<kind>다(끝내 못 고친 줄).
export function judgePresentation(p) {
  const judged = (p?.attempts || []).filter((a) => JUDGED.includes(a.choice)).sort((a, b) => a.no - b.no || a.k - b.k);
  if (!judged.length) return null;
  const first = judged[0], last = judged.at(-1), sawAnswer = (k) => p.answers.some((x) => x < k);
  if (noteKind(last.choice)) return { result: 'todo', kind: noteKind(last.choice) };
  const one = p.attempts.find((a) => a.no === 1);
  if (one?.choice === 'pass' && !sawAnswer(one.k) && !p.dropped) return { result: 'clean' };
  if (noteKind(first.choice)) {
    const pass = judged.find((a) => a.choice === 'pass' && a.no > first.no);
    if (pass && !sawAnswer(pass.k)) return { result: 'fixed', kind: noteKind(first.choice) };
  }
  if (one?.unanswered && first.choice === 'pass' && !sawAnswer(first.k)) return { result: 'heard' };
  return null;
}

// 한 판의 줄 결과: (since, until] 사이에 보인 장면(scene) 보임 가운데 줄마다 마지막 것. 같은 패널에서 「처음부터 다시」를 하면 판이 바뀌므로
// 여는 시각이 아니라 완주 시각으로 가른다 — since는 앞 완주, until은 이번 완주. 완주하지 않은 판은 부르는 쪽이 부르지 않는다.
// 테이크 2(retake)는 노트를 보고 말한 것이라 넣지 않는다. 결과는 보인 차례(대본 차례)로 [{line, result, kind?}], 결과 없는 줄은 뺀다.
export function lineResults(events, { since = -Infinity, until = Infinity } = {}) {
  const last = new Map();
  for (const p of scanPresentations(events).values()) {
    if (p.phase !== 'scene' || !Number.isFinite(p.at) || !(p.at > since && p.at <= until)) continue;
    const was = last.get(p.lineId); if (!was || p.at >= was.at) last.set(p.lineId, p);
  }
  return [...last.values()].sort((a, b) => a.at - b.at).flatMap((p) => {
    const r = judgePresentation(p);
    return r ? [{ line: p.lineId, ...r }] : [];
  });
}

// 말하는 팬의 줄(팬설계 13-2 「누가 무엇을 말하나」). praise: fixed(대본 차례) → clean(목표 줄, 다음 대본 차례) → heard.
// todo: 튜터 pickNote와 같은 차례(끝맺음 → 길이 → 빠진 말, 목표 줄, 대본 차례). 대본 차례는 results의 차례다.
export function pickLines(results, { goal = null } = {}) {
  const list = Array.isArray(results) ? results : [], at = new Map(list.map((r, i) => [r, i]));
  const goalFirst = (a, b) => (b.line === goal) - (a.line === goal) || at.get(a) - at.get(b);
  const praise = list.find((r) => r.result === 'fixed')
    || list.filter((r) => r.result === 'clean').sort(goalFirst)[0]
    || list.find((r) => r.result === 'heard') || null;
  const todo = list.filter((r) => r.result === 'todo' && NOTE_ORDER.includes(r.kind))
    .sort((a, b) => NOTE_ORDER.indexOf(a.kind) - NOTE_ORDER.indexOf(b.kind) || goalFirst(a, b))[0] || null;
  return { praise, todo };
}
