// 재확인 성질 시험(설계 관문 §6 남긴 일 ③, 2026-11-17 · docs/_ops/qa/atlas-world-engine-20261108/재확인내구성_설계관문.md §7).
// 무작위 대본을 돌리며 기기가 읽을 때마다 그 기기가 아는 기록 전부(내 기록 + 받은 기록, 가져올 때 건너뛴 것까지)를 시각 순으로 세운
// 전체 기록(접지 않은 Temper)과 줄을 견준다.
//   C4: 한 기기 · 시간 순 기록이면 접은 판 = 전체 기록이다. 서버가 돌려주지 않아 날것에 남는 항목과 동기화 시점은 무작위.
//   성질: 두 기기 + 무작위 동기화 시점 + 시계 되돌림이면, 접은 판이 전체 기록과 갈리는 줄은 반드시 판단 보류(unavailable) · 철회(invalidated)다.
//   판정자가 빼는 것 넷(설계 관문 §2 표의 C4 예외):
//     ① 끝난 사이클에서 갈린 사슬 — 사슬이 그 앵커 앞에서 이미 갈렸으면 그 뒤 앵커는 이 기기 사슬을 따른다(메모 1). 그 앵커를 앵커로 세운
//        전체 기록 읽기와 견준다(창 · 짝 · 결과는 같아야 한다). 사슬이 바로 그 앵커에서 갈렸으면 표시해야 한다.
//     ② 서버에만 남고 키를 모르는 기록 — 가져올 때 건너뛴 기록 가운데 철회와 얼린 행 · 짝 제시의 도움이 아닌 것. 그것을 뺀 전체 기록과 같으면 근사다.
//     ③ 「둘 열어 둔 채」 — 짝이 될 답의 제시가 열린 동안 같은 문항 · 계열이 다시 보였고 그 다시 보기(그 제시 자신)가 이 기기에서 접혔다.
//     ④ 늦은 도움이 접힌 답에 자격을 줌(§7) — 전체 기록의 사이클 시작이 처음 보는 문항이 아니고 제 도움도 없어 이 기기가 접을 때는 앵커 자격이
//        없었는데, 접힌 뒤에야 그보다 앞선(시각) 같은 문항 · 계열의 도움이 들어왔다. 장부는 접힌 제시에 시각을 남기지 않아 다시 읽을 길이 없다.
// 고침 목록(correctionEventIds)은 덜 적는 쪽 근사라 전체 기록의 부분집합이면 된다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Game = require('../atlas/game-learning.js'), Temper = require('../atlas/temper.js'), Trail = require('../atlas/trail.js');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const DAY = 86400000, MIN = 60000, START = Date.parse('2026-12-01T00:00:00Z');
const SCOPE = { domain: 'LAB', workspace: 'learning', subject: 'device' };
const SKILLS = ['ko.reading.detail', 'ko.reading.main'], GAMES = ['world-practice', 'korean-rhythm'];
const item = (name, { family = name, skill = SKILLS[0] } = {}) => ({ id: name, itemKey: `${name}.v1`, familyKey: family, skillId: skill, modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false, confounded: false });
const lcg = seed => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const cellKey = r => JSON.stringify([r.gameId ?? r.g, r.measure?.skillId ?? r.s, r.measure?.difficulty ?? r.d, r.measure?.responseFormat ?? r.f, r.measure?.modality ?? r.m, r.measure?.audioRequired ?? r.a]);
const flagged = r => r.status === 'unavailable' || r.status === 'invalidated';
const FIELDS = ['status', 'outcome', 'reason', 'targetAttemptId', 'kind', 'sourceAt', 'targetAt'];
const same = (mine, whole) => !!whole && FIELDS.every(k => mine[k] === whole[k]) && mine.correctionEventIds.every(id => whole.correctionEventIds.includes(id));

// ── 전체 기록 읽기 ─────────────────────────────────────────────
// keep: 원래 읽기(제외 전)의 시도 가운데 사슬에 넣을 것. 한 앵커를 세울 때 그 칸의 앞선 시도만 뺀다(창 · 짝 · 늦은 표시는 같은 기록으로 읽는다).
const summariesOf = (log, asOf) => ({ summary: Trail.summarize(log, { scope: SCOPE, asOf }), original: Trail.summarize(log.filter(e => e.type !== 'record.excluded'), { scope: SCOPE, asOf }) });
function readWhole(log, asOf, { summary, original } = summariesOf(log, asOf), keep = null) {
  return Temper.followups({ events: log, summary, original: keep ? { ...original, attempts: original.attempts.filter(keep) } : original, prior: null, complete: true, asOf });
}
// 칸마다 사이클 시작 사슬(앞 사이클들 pc · ps와 읽은 시작들).
function chains(report) {
  const out = new Map();
  for (const list of report.sealing.starts) if (list.length) out.set(cellKey(list[0]), [...(list[0].pc || []), ...(Number.isFinite(list[0].ps) ? [list[0].ps] : []), ...list.map(s => s.at)]);
  return out;
}
function wholeView(log, asOf) {
  const sums = summariesOf(log, asOf), report = readWhole(log, asOf, sums);
  const starts = new Map(report.sealing.starts.filter(list => list.length).map(list => [cellKey(list[0]), list]));
  return { log, asOf, sums, rows: new Map(report.items.map(r => [r.id, r])), chains: chains(report), starts, byId: new Map(log.map(e => [e.id, e])), forced: new Map() };
}
// 이 기기 줄 하나의 기대값: 전체 기록이 같은 앵커를 세웠으면 그 줄, 사슬이 그 앵커 앞에서 이미 갈렸으면(①) 그 앵커를 세운 읽기의 줄.
// 사슬이 바로 그 앵커에서 갈렸으면 null — 접은 쪽이 표시해야 했다.
function expected(view, row, mine) {
  const at = Date.parse(row.sourceAt), cell = cellKey(row), theirs = new Set(view.chains.get(cell) || []);
  if (theirs.has(at)) return { how: 'row', row: view.rows.get(row.id) || null };
  const pred = mine.filter(s => s < at).at(-1);
  if (pred === undefined || theirs.has(pred)) return { how: 'anchor', row: null };
  const tupleOf = a => JSON.stringify([view.byId.get(a.decisionId)?.experienceId, a.measure?.skillId, a.measure?.difficulty, a.measure?.responseFormat, a.measure?.modality, a.measure?.audioRequired]);
  const key = `${cell}|${at}`;
  if (!view.forced.has(key)) view.forced.set(key, readWhole(view.log, view.asOf, view.sums, a => !(tupleOf(a) === cell && Date.parse(a.at) < at)));
  return { how: 'inherited', row: view.forced.get(key).items.find(r => r.id === row.id) || null };
}
// ③: 기대한 짝의 제시가 열린 동안 같은 문항 · 계열이 다시 보였고, 그 다시 보기(제시 q 자신)가 이 기기에서 접혔다 — 이 기기 로그에 들어왔다가
// 지금 날것에 없다. 같은 키의 다른 제시가 접힌 것만으로는 빼지 않는다.
function twoOpen(view, want, mine, foldedHere) {
  const target = want?.targetAttemptId && view.byId.get(want.targetAttemptId);
  if (!target || mine.targetAttemptId === target.id) return false;
  const p = view.byId.get(target.presentationId), keys = e => [`item:${e.itemKey}`, `family:${e.measure?.familyKey || e.itemKey}`];
  return view.log.some(q => q.type === 'practice.presented' && q.id !== p.id && keys(q).some(k => keys(p).includes(k))
    && Date.parse(q.at) >= Date.parse(p.at) && Date.parse(q.at) <= Date.parse(target.at) && foldedHere(q.id));
}
// ④: 전체 기록이 이 앵커를 세우지 않은 까닭이 그 앞의 사이클 시작 S이고, S는 이 기기에서 접힌 뒤에야 자격을 얻었다 — S를 도움 받은 답으로
// 만드는 앞선(시각) 같은 문항 · 계열 도움이 모두 S가 접힌 것을 본 읽기 뒤에 이 기기 로그에 들어왔다(S는 처음 보는 문항이 아니고 제 도움도 없다).
function requalified(view, row, d) {
  const at = Date.parse(row.sourceAt), start = (view.starts.get(cellKey(row)) || []).filter(s => s.at < at && at <= s.at + 45 * DAY).at(-1);
  if (!start || !d.absentT.has(start.id)) return false;
  const a = view.byId.get(start.id), p = view.byId.get(a.presentationId), read = view.sums.original.attempts.find(x => x.eventId === start.id);
  if (read?.assisted !== true || p.firstExposure === true) return false;
  const keys = e => [`item:${e.itemKey}`, `family:${e.measure?.familyKey || e.itemKey}`];
  const helps = view.log.filter(e => e.type === 'practice.helped' && Date.parse(e.at) < Date.parse(a.at) && keys(view.byId.get(e.presentationId)).some(k => keys(p).includes(k)));
  return helps.length > 0 && helps.every(h => h.presentationId !== p.id && d.appendT.get(h.id) > d.absentT.get(start.id));
}

// ── 대본 ────────────────────────────────────────────────────────
function world(seed, { names = ['A', 'B'], late = true } = {}) {
  const rand = lcg(seed), pick = list => list[Math.floor(rand() * list.length)];
  let T = START + 9 * 3600000, seq = 0;
  const server = [], order = new Map(), devices = {};
  for (const name of names) {
    // appendT: 이 기기 로그에 들어온 때(대본의 실제 시각), absentT: 접혀 날것에서 빠진 것을 처음 본 읽기의 때(④).
    const mem = new Map(), d = devices[name] = { name, mem, offset: 0, back: 0, produced: [], own: new Set(), sent: 0, received: new Map(), unknown: new Set(), held: new Set(), offline: 0,
      appendT: new Map(), absentT: new Map() };
    d.storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
    d.clock = () => new Date(T + d.offset).toISOString();
  }
  const open = (d, gameId = 'world-practice') => {
    const coach = Game.createGame({ gameId, map, storage: d.storage, clock: d.clock, followups: true, fold: { remote: true, max: 40, keep: 20, ageMs: 1 },
      learnerKey: 'device', storageScope: 'account', accountKey: 'acct', historyComplete: false });
    coach.syncPort.markComplete(true);
    return coach;
  };
  // 판 하나 안에서는 시계 어긋남이 바뀌지 않는다: 만든 때 = 기록한 때 - 어긋남.
  const capture = (d, coach) => { for (const e of coach.events()) if (!d.own.has(e.id) && !d.received.has(e.id)) { d.own.add(e.id); d.produced.push(e); order.set(e.id, seq++); d.appendT.set(e.id, Date.parse(e.recordedAt) - d.offset); } };
  // 기록이 많은 계정 저장소는 쪽으로 나뉘어 장부가 data 아래에 있다(learning-pages.js).
  const stored = d => { const value = JSON.parse(d.mem.get(`${Game.KEY}.device`) || '{}'); return value.paged === 1 ? value.data : value; };
  // 얼린 행 · 짝의 제시: 서버에만 남은 그 제시의 도움은 가져올 때 표가 안다(lateHelp).
  const framed = d => { const table = stored(d).ledger?.followups, out = new Set(); for (const row of table?.rows || []) { if (row.p) out.add(row.p); for (const pair of Object.values(row.t || {})) out.add(pair.p); } return out; };
  function sync(d, coach, { split = false } = {}) {
    // 보내기: 만든 차례대로. 묶음 경계가 한 항목 안에 떨어질 수 있다.
    const upto = split ? d.sent + Math.floor(rand() * (d.produced.length - d.sent + 1)) : d.produced.length;
    for (; d.sent < upto; d.sent++) server.push({ e: d.produced[d.sent], from: d.name });
    const incoming = server.filter(s => s.from !== d.name && !d.received.has(s.e.id)).map(s => s.e);
    if (incoming.length) {
      const known = framed(d), { skipped } = coach.syncPort.importEvents(incoming);
      for (const e of incoming) { d.received.set(e.id, e); d.appendT.set(e.id, T); }
      for (const id of skipped) { const e = d.received.get(id); if (!(e.type === 'record.excluded' || e.type === 'practice.helped' && known.has(e.presentationId))) d.unknown.add(id); }
    }
    // 서버가 돌려준 것만 접힐 수 있다: 보낸 내 기록과 받은 기록, 돌려주지 않는 항목은 빼고.
    const back = new Set([...d.produced.slice(0, d.sent).map(e => e.id), ...d.received.keys()]);
    coach.syncPort.settle(coach.events().filter(e => back.has(e.id) && ![e.id, e.presentationId, e.decisionId].some(id => d.held.has(id))).map(e => e.id));
  }
  function play(d, coach, it, { open: twoOpenGame = null } = {}) {
    const pid = coach.present(it);
    if (twoOpenGame) {
      // ③ 같은 계열을 다른 판에서 잠깐 보이고 풀어 그쪽이 접힌 뒤 이 제시를 푼다.
      const tab = open(d, twoOpenGame); T += 30000;
      const glimpse = tab.present(item(`${it.id}-glimpse`, { family: it.familyKey, skill: pick(SKILLS) })); T += 5000;
      tab.answer(glimpse, { correct: true, assessable: true }); capture(d, tab); tab.flush(); tab.dispose();
      if (d.offline <= 0) sync(d, coach); T += 2 * MIN;
    }
    if (rand() < 0.12) coach.help(pid, 'hint');
    T += 5000;
    const answer = coach.answer(pid, rand() < 0.03 ? { correct: null, assessable: false, reason: 'unanswered' } : { correct: rand() < 0.7, assessable: true });
    if (rand() < 0.2) { T += 1000; coach.help(pid, rand() < 0.5 ? 'explanation' : 'answer'); }
    if (rand() < 0.02) coach.exclude(answer.eventId);
    // 서버가 끝내 돌려주지 않는 항목: 날것에 남는다(① — 그 답이 다음 사이클들의 앵커를 앞서 보이면 안 된다).
    if (rand() < 0.04) { d.held.add(pid); d.held.add(coach.events().find(e => e.id === pid).decisionId); }
    return answer;
  }
  function session(d, n) {
    const coach = open(d, pick(GAMES));
    for (let i = 0; i < n; i++) {
      T += 20000 + Math.floor(rand() * 40000);
      // 두 기기가 함께 보는 계열: 오래 되풀이되는 다섯(r) · 사흘마다 새로 열리는 셋(s — 대본 끝까지 두 기기의 첫 노출이 서로 늦게 온다) · 이 판에만 있는 것.
      const r = rand(), repeat = r < 0.4;
      const family = r < 0.25 ? `r${Math.floor(rand() * 5)}` : repeat ? `s${Math.floor((T - START) / (3 * DAY))}-${Math.floor(rand() * 3)}` : `${d.name}-${seq}-${i}`;
      play(d, coach, item(`${family}-${d.name}-${seq}-${i}`, { family, skill: pick(SKILLS) }), { open: late && !repeat && rand() < 0.03 ? pick(GAMES) : null });
    }
    // 앞 판에서 푼 내 답을 나중에 거둔다(철회는 다른 기기에서 늦게 올 수 있다).
    if (rand() < 0.05) { const answers = coach.events().filter(e => e.type === 'practice.attempted' && d.own.has(e.id)); if (answers.length) coach.exclude(pick(answers).id); }
    capture(d, coach);
    if (d.offline <= 0 && rand() < 0.6) sync(d, coach, { split: late && rand() < 0.3 });
    coach.flush(); coach.dispose();
  }
  return { devices, rand, pick, open, capture, sync, session, order, stored,
    get T() { return T; }, advance(ms) { T += ms; } };
}

// ── 한 대본 돌리기 · 판정 ───────────────────────────────────────
function run(seed, { names = ['A', 'B'], late = true, days = late ? 100 : 110 } = {}) {
  const w = world(seed, { names, late }), stats = { reads: 0, rows: 0, same: 0, flagged: 0, flaggedClean: 0, inherited: 0, unknown: 0, twoOpen: 0, requalified: 0, backReads: 0, incomplete: 0, held: 0, strays: 0, back: 0 };
  const problems = [];
  const check = d => {
    const coach = w.open(d), report = coach.followups(); w.capture(d, coach);
    const raw = new Set(coach.events().map(e => e.id)); coach.dispose();
    for (const id of d.appendT.keys()) if (!raw.has(id) && !d.absentT.has(id)) d.absentT.set(id, w.T);
    stats.reads += 1; if (report.evidenceComplete !== true) { stats.incomplete += 1; return; }
    // 표 ③: 시계를 되돌린 동안은 접힌 앞날의 이력이 「모든 것보다 앞」으로 읽히고 앞날의 짝은 지켜 두기만 한다 — 그 시각의 전체 기록과 견주지
    // 않고, 앞날의 행 · 짝이 하나도 보이지 않는지만 본다. 시계가 돌아온 뒤에는 늦은 기록처럼 견준다.
    if (d.offset < 0) {
      stats.backReads += 1; const now = Date.parse(report.asOf);
      for (const row of report.items) if (Date.parse(row.sourceAt) > now || row.targetAt && Date.parse(row.targetAt) > now) problems.push({ seed, device: d.name, asOf: report.asOf, how: 'future', mine: row, whole: null });
      return;
    }
    const log = [...d.produced, ...d.received.values()].sort((x, y) => Date.parse(x.at) - Date.parse(y.at) || Date.parse(x.recordedAt) - Date.parse(y.recordedAt) || w.order.get(x.id) - w.order.get(y.id));
    const view = wholeView(log, report.asOf), mineChains = chains(report);
    let cut = null;
    const foldedHere = id => d.appendT.has(id) && !raw.has(id);
    // C4(한 기기 · 시간 순): 줄마다 전체 기록과 똑같고(판단 보류 · 철회 줄과 고침 목록까지) 빠진 줄도 없다.
    if (!late) {
      const ids = new Set(report.items.map(r => r.id));
      for (const [id, whole] of view.rows) if (!ids.has(id)) problems.push({ seed, device: d.name, asOf: report.asOf, how: 'missing', mine: { id }, whole });
      for (const row of report.items) {
        stats.rows += 1; const whole = view.rows.get(row.id);
        if (same(row, whole) && row.correctionEventIds.length === whole.correctionEventIds.length) { stats.same += 1; if (flagged(row)) stats.flagged += 1; }
        else problems.push({ seed, device: d.name, asOf: report.asOf, how: 'c4', mine: row, whole });
      }
      return;
    }
    for (const row of report.items) {
      stats.rows += 1;
      const mine = mineChains.get(cellKey(row)) || [];
      // 판단 보류 · 철회는 늘 안전하다. 전체 기록으로는 멀쩡한 줄이면 보수 쪽으로 센다.
      if (flagged(row)) { stats.flagged += 1; const whole = view.rows.get(row.id); if (whole && !flagged(whole)) stats.flaggedClean += 1; continue; }
      const want = expected(view, row, mine);
      if (same(row, want.row)) { stats.same += 1; if (want.how === 'inherited') stats.inherited += 1; continue; }
      // ② 키를 모르는 서버 기록을 뺀 전체 기록과 같으면 근사.
      if (d.unknown.size) {
        cut ??= wholeView(log.filter(e => !d.unknown.has(e.id)), report.asOf);
        if (same(row, expected(cut, row, mine).row)) { stats.unknown += 1; continue; }
      }
      if (twoOpen(view, want.row, row, foldedHere)) { stats.twoOpen += 1; continue; }
      if (want.how === 'anchor' && requalified(view, row, d)) { stats.requalified += 1; continue; }
      problems.push({ seed, device: d.name, asOf: report.asOf, how: want.how, mine: row, whole: want.row });
    }
  };
  const order = names.slice();
  for (let day = 0; day < days; day++) {
    w.advance(DAY - (w.T - START - 9 * 3600000) % DAY);
    for (const d of Object.values(w.devices)) {
      if (d.offline > 0) d.offline -= 1;
      else if (late && w.rand() < 0.03) d.offline = 3 + Math.floor(w.rand() * 33); // 오래 꺼 둔 기기(묶음이 30일 넘게 끊기면 키 모르는 기록이 생긴다)
      // 시계 되돌림: 며칠 앞으로 돌렸다가 몇 판 뒤에 돌아온다.
      if (late && d.back <= 0 && w.rand() < 0.04) { d.offset = -Math.floor((0.5 + w.rand() * 50) * DAY); d.back = 1 + Math.floor(w.rand() * 3); stats.back += 1; }
    }
    if (w.rand() < 0.5) order.reverse();
    for (const name of order) {
      const d = w.devices[name];
      if (w.rand() < 0.12) continue;
      for (let s = 1 + Math.floor(w.rand() * 2); s > 0; s--) { w.session(d, 2 + Math.floor(w.rand() * 4)); w.advance(15 * MIN + Math.floor(w.rand() * 60 * MIN)); }
      if (d.back > 0 && (d.back -= 1) === 0) d.offset = 0;
      if (d.offline <= 0 && w.rand() < 0.5) { const coach = w.open(d); w.sync(d, coach); coach.flush(); coach.dispose(); }
      check(d);
    }
  }
  for (const d of Object.values(w.devices)) { stats.held += d.held.size / 2; stats.strays += d.unknown.size; }
  return { stats, problems };
}

const show = problems => problems.slice(0, 4).map(p => `${p.device} ${p.asOf} ${p.how}: mine ${JSON.stringify([p.mine.id, p.mine.status, p.mine.outcome, p.mine.reason, p.mine.targetAttemptId, p.mine.kind])} whole ${p.whole ? JSON.stringify([p.whole.status, p.whole.outcome, p.whole.reason, p.whole.targetAttemptId, p.whole.kind]) : null}`).join('\n');

// 판정자 ③은 다시 보기 제시 자신이 이 기기에서 접혔을 때만 뺀다(같은 키의 다른 제시가 접힌 것만으로는 빼지 않는다).
test('the judge excuses two open presentations only when the re-sight itself folded on this device', () => {
  const at = days => new Date(START + days * DAY).toISOString(), shown = (id, itemKey, days) => ({ id, type: 'practice.presented', itemKey, measure: { familyKey: 'F' }, at: at(days) });
  const log = [shown('r', 'R.v1', 0.5), shown('p', 'P.v1', 1), shown('q', 'Q.v1', 1.2), { id: 't', type: 'practice.attempted', presentationId: 'p', at: at(1.5) }];
  const view = { log, byId: new Map(log.map(e => [e.id, e])) }, want = { targetAttemptId: 't' }, here = ids => id => ids.includes(id);
  assert.equal(twoOpen(view, want, { targetAttemptId: null }, here(['r'])), false);
  assert.equal(twoOpen(view, want, { targetAttemptId: null }, here(['q'])), true);
  assert.equal(twoOpen(view, want, { targetAttemptId: 't' }, here(['q'])), false);
});

// 씨앗을 더 돌리려면 ATLAS_FOLLOWUP_SEEDS=<수>(두 기기 대본을 그만큼 더한다 — 탐침).
const extra = Math.max(0, Number(process.env.ATLAS_FOLLOWUP_SEEDS) || 0);
for (const seed of [11, 23, 37]) {
  test(`C4 under random syncs and answers the server never sends back: a folding store reads as the whole log every day (seed ${seed})`, t => {
    const { stats, problems } = run(seed, { names: ['A'], late: false });
    t.diagnostic(JSON.stringify(stats));
    assert.ok(stats.reads > 80 && stats.rows > 200, JSON.stringify(stats));
    assert.ok(stats.held > 3, `answers held back: ${stats.held}`);
    assert.equal(stats.incomplete, 0);
    assert.equal(problems.length, 0, `${problems.length} rows differ ${JSON.stringify(stats)}\n${show(problems)}`);
  });
}
for (const seed of [101, 202, 303, 404, ...Array.from({ length: extra }, (_, i) => 1000 + 97 * i)]) {
  test(`two devices, random syncs and clocks set back: every row that parts from the whole log is marked (seed ${seed})`, t => {
    const { stats, problems } = run(seed);
    t.diagnostic(JSON.stringify(stats));
    // 고정 씨앗은 대본이 늦은 기록 · 시계 되돌림 · 돌려주지 않는 항목을 실제로 거치는지도 본다(탐침 씨앗은 갈림만 본다).
    if (seed < 1000) {
      assert.ok(stats.reads > 150 && stats.rows > 400, JSON.stringify(stats));
      assert.ok(stats.back > 0 && stats.backReads > 0 && stats.held > 3 && stats.flagged > 0 && stats.inherited > 0, JSON.stringify(stats));
    }
    assert.equal(stats.incomplete, 0);
    assert.equal(problems.length, 0, `${problems.length} rows part unmarked ${JSON.stringify(stats)}\n${show(problems)}`);
  });
}
