// 재확인 내구성(temper-followup-3, 2026-11-08 · docs/_ops/qa/atlas-world-engine-20261108/재확인내구성_설계.md).
// 접을 때 앵커 · 짝을 장부 표에 얼린다 — 같은 사건이면 접은 판과 접지 않은 판의 줄이 같고(C4), 칸이 많거나 다른 기기 기록이 늦게 와도 재확인이 통째로 끊기지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { followupRows } from '../experiences/synk-world-app/world-learning-followups.mjs';
import { lifeFollowupRows } from '../experiences/synk-world-app/life-followups.mjs';
const require = createRequire(import.meta.url);
const Game = require('../atlas/game-learning.js'), Temper = require('../atlas/temper.js');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const DAY = 86400000, MIN = 60000, START = Date.parse('2026-12-01T00:00:00Z'), KEY = `${Game.KEY}.device`;
const item = (name, { family = name, skill = 'ko.reading.detail', difficulty = 1, format = 'single-choice' } = {}) => ({ id: name, itemKey: `${name}.v1`, familyKey: family, skillId: skill, modality: skill.includes('listening') ? 'listening' : 'reading', difficulty, responseFormat: format, audioRequired: skill.includes('listening'), confounded: false });
function bench({ fold = { max: 40, keep: 20, ageMs: 1 }, account = false, connected = false } = {}) {
  let now = START; const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const clock = () => new Date(now).toISOString();
  const open = (gameId = 'world-practice', { followups = true, module = Game } = {}) => {
    const coach = module.createGame({ gameId, map, storage, clock, followups, fold, ...(account ? { learnerKey: 'device', storageScope: 'account', accountKey: 'acct', historyComplete: !connected } : {}) });
    if (connected) coach.syncPort.markComplete(true);
    return coach;
  };
  return { mem, storage, open, at: days => { now = START + days * DAY; }, step: ms => { now += ms; }, get now() { return now; },
    stored: () => JSON.parse(mem.get(KEY)), store: value => mem.set(KEY, JSON.stringify(value)) };
}
const play = (coach, it, { correct = true, help = false, after = null, step } = {}) => {
  const pid = coach.present(it);
  if (it.audioRequired) coach.delivery(pid, { audio: 'completed' });
  if (help) coach.help(pid, 'hint');
  step?.(1000);
  const answer = coach.answer(pid, { correct, assessable: true });
  if (after) coach.help(pid, after);
  return { pid, answer };
};
const fill = (b, coach, from, count) => { for (let n = 0; n < count; n++) { b.step(1000); play(coach, item(`filler-${from}-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); } };
const copyOf = value => JSON.parse(JSON.stringify(value));
const rowsOf = (report, id) => report.items.filter(r => r.sourceAttemptId === id);
const windowOf = (report, id, window) => rowsOf(report, id).find(r => r.window === window);

// ── C4: 같은 대본을 접는 장부와 접지 않는 장부에 ─────────────────
function makeScript(seed, days) {
  let s = seed >>> 0; const rand = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const skills = ['ko.reading.detail', 'ko.reading.main', 'ko.listening.detail'], games = ['world-practice', 'korean-rhythm', 'order-rush', 'blank-slice'], actions = [];
  let n = 0;
  for (let day = 0; day < days; day++) {
    let t = START + day * DAY + 9 * 3600000;
    if (rand() < 0.08 || (day > 30 && day < 36)) continue; // 쉬는 날 · 쉬었다 돌아오는 구간
    for (let session = 1 + Math.floor(rand() * 2); session > 0; session--) {
      const game = games[Math.floor(rand() * games.length)];
      actions.push({ t, kind: 'open', game });
      for (let i = 3 + Math.floor(rand() * 6); i > 0; i--) {
        t += 20000; n += 1;
        const repeat = game !== 'world-practice' && rand() < 0.6, family = repeat ? `${game}.r${Math.floor(rand() * 4)}` : `${game}.f${n}`;
        actions.push({ t, kind: 'play', it: item(family, { family, skill: skills[Math.floor(rand() * skills.length)], difficulty: 1 + Math.floor(rand() * 2) }),
          help: rand() < 0.12, correct: rand() < 0.7, after: rand() < 0.2 ? (rand() < 0.5 ? 'explanation' : 'answer') : null, unanswered: rand() < 0.03, excludeNow: rand() < 0.02 });
      }
      t += 15 * MIN + Math.floor(rand() * 40 * MIN);
    }
    actions.push({ t: t + MIN, kind: 'read', day });
  }
  return actions;
}
function replay(actions, mode) {
  const b = bench({ fold: mode === 'whole' ? false : mode === 'remote' ? { remote: true, max: 60, keep: 30, ageMs: DAY } : { max: 60, keep: 30, ageMs: 10 * MIN }, account: mode === 'remote', connected: mode === 'remote' });
  let coach = null; const reads = [];
  const close = () => { if (!coach) return; coach.flush(); if (mode === 'remote') coach.syncPort.settle(coach.events().map(e => e.id)); coach.dispose(); coach = null; };
  const line = r => [r.gameId, r.measure.skillId, r.measure.difficulty, r.window, r.status, r.outcome, r.reason, r.kind, r.sourceAt, r.targetAt, r.correctionEventIds.length].join('|');
  for (const a of actions) {
    b.step(a.t - b.now);
    if (a.kind === 'open') { close(); coach = b.open(a.game); }
    else if (a.kind === 'play') {
      const pid = coach.present(a.it);
      if (a.it.audioRequired) coach.delivery(pid, { audio: 'completed' });
      if (a.help) coach.help(pid, 'hint');
      b.step(5000);
      const res = coach.answer(pid, a.unanswered ? { correct: null, assessable: false, reason: 'unanswered' } : { correct: a.correct, assessable: true });
      b.step(1000);
      if (a.after) coach.help(pid, a.after);
      if (a.excludeNow) coach.exclude(res.eventId);
    } else { close(); coach = b.open(); reads.push({ day: a.day, rows: coach.followups().items.map(line).sort() }); close(); }
  }
  close();
  return { reads, folded: b.stored().ledger?.folded || 0, table: JSON.stringify(b.stored().ledger?.followups || null).length, bytes: b.mem.get(KEY).length };
}
for (const [mode, seed] of [['device', 3], ['remote', 5]]) {
  test(`C4 ${mode}: a folding log and a whole log give the same rows every day (seed ${seed})`, () => {
    const actions = makeScript(seed * 7919, 100), whole = replay(actions, 'whole'), folded = replay(actions, mode);
    assert.ok(folded.folded > 500, `folds happen: ${folded.folded}`);
    assert.ok(whole.reads.some(r => r.day >= 46 && r.rows.length), 'the script runs past the first cycle');
    assert.ok(whole.reads.some(r => r.rows.some(x => x.includes('|observed|'))) && whole.reads.some(r => r.rows.some(x => x.includes('|missed|'))), 'rows of every kind');
    for (let i = 0; i < whole.reads.length; i++) assert.deepEqual(folded.reads[i].rows, whole.reads[i].rows, `day ${whole.reads[i].day}`);
    assert.ok(folded.bytes < whole.bytes / 2, 'the folded store stays small');
  });
}

// ── 사이클 ─────────────────────────────────────────────────────
test('the next anchor is the first answer after the cycle, even when a newer anchor is not frozen yet', () => {
  const b = bench(), coach = b.open(), cell = { skill: 'ko.reading.detail' };
  const first = play(coach, item('first', cell));
  b.at(44); const inside = play(coach, item('inside', cell));
  b.at(46); const next = play(coach, item('next', cell));
  fill(b, coach, 'a', 25); // 앞의 것만 접혀 44일 시도는 날것에 남을 수 있다
  const report = coach.followups();
  assert.ok(report.coverage.folded > 0);
  assert.equal(rowsOf(report, inside.answer.eventId).length, 0, 'an answer inside a cycle never anchors');
  assert.equal(rowsOf(report, first.answer.eventId).length, 0, 'the old cycle is over');
  assert.equal(rowsOf(report, next.answer.eventId).length, 3);
});

test('a learner back after weeks: the start survives, so the same anchor as a whole log', () => {
  // 0일 앵커가 접혀 표에 있고 44일 · 88일 시도가 날것에 남은 채 96일에 읽는다(설계 검토 GA3 · Fable F1).
  const run = fold => {
    const b = bench({ fold }), coach = b.open(), cell = { skill: 'ko.reading.detail' };
    play(coach, item('a', cell)); b.step(1000); fill(b, coach, 'a', 25);
    b.at(44); play(coach, item('b', cell));
    b.at(88); const late = play(coach, item('c', cell));
    b.at(96);
    const report = coach.followups();
    return { d7: windowOf(report, late.answer.eventId, 'd7')?.status, others: report.items.filter(r => r.measure.skillId === cell.skill && r.sourceAttemptId !== late.answer.eventId).length, folded: report.coverage.folded };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.ok(folded.folded > 0);
  assert.deepEqual([folded.d7, folded.others], [whole.d7, whole.others]);
  assert.equal(folded.d7, 'due');
});

test('a fold freezes only what is at or before its cutoff: newer answers stay read from the log', () => {
  const b = bench({ fold: { max: 40, keep: 20, ageMs: 10 * MIN } }), coach = b.open(), cell = { skill: 'ko.reading.detail' };
  const early = play(coach, item('early', cell));
  b.at(1); const pair = play(coach, item('pair', cell));
  b.at(2); fill(b, coach, 'a', 12);
  b.at(8); const recent = play(coach, item('recent', { skill: 'ko.reading.reason' })), week = play(coach, item('week', cell));
  fill(b, coach, 'b', 12);
  const { ledger, events } = b.stored(), { rows } = ledger.followups;
  assert.ok(ledger.folded > 0);
  for (const row of rows) { assert.ok(row.at <= ledger.cutoff, 'no row past the cutoff'); for (const held of Object.values(row.t || {})) assert.ok(held.at <= ledger.cutoff, 'no pair past the cutoff'); }
  assert.ok(rows.some(row => row.id === early.answer.eventId && row.t.d1.id === pair.answer.eventId), 'what is before the cutoff is frozen');
  assert.ok(events.some(e => e.id === recent.answer.eventId), 'the newer answer is still in the log');
  assert.equal(rows.some(row => row.id === recent.answer.eventId), false, 'and is not in the table');
  assert.equal(rows.find(row => row.id === early.answer.eventId).t.d7, undefined, 'a pair after the cutoff is not frozen');
  assert.equal(windowOf(coach.followups(), early.answer.eventId, 'd7').targetAttemptId, week.answer.eventId, 'it is read from the log');
});
test('a pair answered past the cutoff survives the fold of a later encounter with its family', () => {
  // 짝을 연 뒤 같은 계열을 다른 판에서 잠깐 열었다 닫고 짝을 풀었다. 그 잠깐이 접히고 짝은 날것에 남는다 — 접힌 이력이 짝을 가리면 안 된다(끝 판 검수 GPT).
  const run = fold => {
    const b = bench({ fold }), coach = b.open(), cell = { skill: 'ko.reading.detail' }, anchor = play(coach, item('anchor', cell));
    fill(b, coach, 'pre', 4);
    b.at(1); const pid = coach.present(item('pair', { ...cell, family: 'shared' }));
    b.step(1000); const tab = b.open('other-game'); tab.present(item('glimpse', { skill: 'ko.reading.reason', family: 'shared' })); tab.flush(); tab.dispose();
    b.step(1000); const pair = coach.answer(pid, { correct: true, assessable: true });
    fill(b, coach, 'post', 4);
    const report = coach.followups(), stored = b.stored();
    return { d1: windowOf(report, anchor.answer.eventId, 'd1'), pair: pair.eventId, cutoff: stored.ledger?.cutoff ?? null, folded: report.coverage.folded, inLog: stored.events.some(e => e.id === pair.eventId) };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.ok(folded.folded > 0); assert.equal(folded.inLog, true, 'the pair is still in the log');
  assert.ok(Date.parse(folded.d1.targetAt ?? 0) > folded.cutoff || folded.d1.targetAt === null, 'the pair came after the cutoff');
  assert.deepEqual([whole.d1.status, whole.d1.outcome], ['observed', 'independent-correct']);
  assert.deepEqual([folded.d1.status, folded.d1.outcome, folded.d1.targetAt], [whole.d1.status, whole.d1.outcome, whole.d1.targetAt]);
});
test('frozen rows keep their pairs past the fold of what came after them, and a repeated item costs nothing', () => {
  const b = bench(), coach = b.open(), repeat = item('song', { family: 'song', skill: 'ko.listening.detail' });
  const anchor = play(coach, repeat);
  b.at(1); const pair = play(coach, item('new-1', { skill: 'ko.listening.detail' }));
  for (let day = 2; day < 35; day++) { b.at(day); for (let n = 0; n < 6; n++) { b.step(1000); play(coach, repeat); } }
  const report = coach.followups();
  assert.equal(coach.events().some(e => e.id === anchor.answer.eventId), false, 'nothing keeps the first answer alive');
  assert.deepEqual([windowOf(report, anchor.answer.eventId, 'd1').status, windowOf(report, anchor.answer.eventId, 'd1').targetAttemptId], ['observed', pair.answer.eventId]);
  assert.ok(b.stored().events.length <= 60, `the log stays small: ${b.stored().events.length}`);
  assert.equal(windowOf(report, anchor.answer.eventId, 'd30').status, 'due');
});

// ── 다른 기기의 늦은 기록 ───────────────────────────────────────
function twoDevices() {
  const a = bench({ fold: { remote: true, max: 40, keep: 20, ageMs: 1 }, account: true, connected: true }), b = bench({ fold: false, account: true, connected: true });
  return { a, b, coachA: a.open(), coachB: b.open(), settle: coach => coach.syncPort.settle(coach.events().map(e => e.id)) };
}
const importLate = (coach, events) => coach.syncPort.importEvents(events);
test('a late entry marks only the cell it overtakes; other cells and new cycles go on', () => {
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' }, other = { skill: 'ko.reading.reason' };
  b.at(0); play(coachB, item('b-early', cell));
  a.at(1); const mine = play(coachA, item('a-first', cell)), kept = play(coachA, item('a-other', other));
  a.at(2); const pairOther = play(coachA, item('a-other-2', other)); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(4); fill(a, coachA, 'y', 20); settle(coachA);
  const before = coachA.followups(); assert.ok(before.coverage.folded > 0);
  assert.equal(coachA.events().some(e => e.id === mine.answer.eventId), false, 'the anchor is frozen');
  importLate(coachA, coachB.events());
  const report = coachA.followups();
  assert.equal(report.evidenceComplete, true, 'one late entry does not stop the whole store');
  assert.ok(report.coverage.adjusted > 0);
  assert.deepEqual(rowsOf(report, mine.answer.eventId).map(r => [r.status, r.reason]), [['unavailable', 'adjusted-history'], ['unavailable', 'adjusted-history'], ['unavailable', 'adjusted-history']]);
  assert.deepEqual([windowOf(report, kept.answer.eventId, 'd1').status, windowOf(report, kept.answer.eventId, 'd1').targetAttemptId], ['observed', pairOther.answer.eventId], 'the other cell is untouched');
  assert.equal(report.items.some(r => r.sourceAttemptId === coachB.events().find(e => e.type === 'practice.attempted').id), false, 'the late answer does not replace the anchor');
  // 표시는 늦은 기록이 접힌 뒤에도 남고, 그 사이클이 끝나면 다음 답이 새 앵커가 된다.
  settle(coachA); a.at(6); fill(a, coachA, 'z', 40); settle(coachA); fill(a, coachA, 'w', 40); settle(coachA);
  assert.deepEqual(rowsOf(coachA.followups(), mine.answer.eventId).map(r => r.status), ['unavailable', 'unavailable', 'unavailable']);
  a.at(47); const again = play(coachA, item('a-next', cell));
  assert.deepEqual(rowsOf(coachA.followups(), again.answer.eventId).map(r => r.status), ['not_due', 'not_due', 'not_due']);
});
test('a late entry marks its own cycle only: the next cycle opens clean while it is still in the log', () => {
  // 늦은 기록이 아직 날것인 채 45일이 지나 새 사이클이 열린다(설계 검토 아르곤 A1 — 칸 단위 표시가 새 앵커까지 막았다).
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  b.at(0); play(coachB, item('b-early', cell));
  a.at(1); const mine = play(coachA, item('a-first', cell));
  a.at(2); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(4); fill(a, coachA, 'y', 20); settle(coachA);
  importLate(coachA, coachB.events());
  assert.equal(rowsOf(coachA.followups(), mine.answer.eventId)[0].reason, 'adjusted-history');
  a.at(47); const next = play(coachA, item('a-next', cell));
  assert.ok(coachA.events().some(e => e.type === 'practice.attempted' && e.id === coachB.events().find(x => x.type === 'practice.attempted').id), 'the late answer is still in the log');
  assert.deepEqual(rowsOf(coachA.followups(), next.answer.eventId).map(r => [r.status, r.reason]), [['not_due', null], ['not_due', null], ['not_due', null]]);
});
test('a late attempt on the family of a frozen anchor withdraws it: the ledger no longer counts it as a first answer', () => {
  const { a, b, coachA, coachB, settle } = twoDevices();
  b.at(0); play(coachB, item('b-same', { family: 'a-first', skill: 'ko.reading.reason' }));
  a.at(1); const mine = play(coachA, item('a-first')); a.at(2); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(4); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(rowsOf(coachA.followups(), mine.answer.eventId)[0].kind, 'retention');
  importLate(coachA, coachB.events());
  assert.deepEqual(rowsOf(coachA.followups(), mine.answer.eventId).map(r => [r.status, r.reason]), [['invalidated', 'source-withdrawn'], ['invalidated', 'source-withdrawn'], ['invalidated', 'source-withdrawn']]);
});
test('a late help before a frozen pair withdraws it; while the pair is still in the log it is read again', () => {
  const late = keepPair => {
    const { a, b, coachA, coachB } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-first', cell));
    a.at(1.5); const pid = coachA.present(item('a-pair', cell));
    a.at(1.55); const pair = { pid, answer: copyOf(coachA.answer(pid, { correct: true, assessable: true })) };
    // 계정 장부는 서버가 돌려준 것만 접는다 — 짝만 안 돌아왔으면 cutoff 앞이어도 날것에 남고 표에도 얼어 있다.
    const mark = new Set([pair.pid, coachA.events().find(e => e.id === pair.pid).decisionId]);
    const settle = () => coachA.syncPort.settle(coachA.events().filter(e => !keepPair || !mark.has(e.id) && !mark.has(e.presentationId) && !mark.has(e.decisionId)).map(e => e.id));
    a.at(2); fill(a, coachA, 'x', 20); settle();
    a.at(4); fill(a, coachA, 'y', 20); settle();
    fill(a, coachA, 'z', 20); settle();
    const gone = coachA.events().some(e => e.id === pair.answer.eventId) === false;
    assert.equal(a.stored().ledger.followups.rows.find(r => r.id === mine.answer.eventId)?.t.d1?.id, pair.answer.eventId, 'the pair is frozen');
    const before = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    assert.deepEqual([before.outcome, before.targetAttemptId], ['independent-correct', pair.answer.eventId]);
    // 짝을 보인 뒤 · 풀기 전에 다른 기기에서 같은 계열의 도움을 봤다.
    b.at(1.52); const other = coachB.present(item('b-same', { family: 'a-pair', skill: 'ko.reading.reason' })); b.step(1000); coachB.help(other, 'hint');
    importLate(coachA, coachB.events());
    return { gone, row: windowOf(coachA.followups(), mine.answer.eventId, 'd1') };
  };
  const folded = late(false);
  assert.equal(folded.gone, true, 'the pair left the log');
  assert.deepEqual([folded.row.status, folded.row.reason, folded.row.outcome], ['invalidated', 'target-withdrawn', null]);
  const kept = late(true);
  assert.equal(kept.gone, false, 'the pair is still in the log');
  assert.equal(kept.row.outcome, 'assisted-correct', 'read again from the log');
});
test('an earlier answer arriving under a floor still marks the frozen row it overtakes', () => {
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  b.at(0); play(coachB, item('b-early', cell));
  a.at(1); const mine = play(coachA, item('a-first', cell)); a.at(2); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(4); fill(a, coachA, 'y', 20); settle(coachA);
  coachA.flush(); coachA.dispose();
  const raw = a.stored();
  raw.ledger.folded += 10; a.store(raw); // 옛 판이 얼리지 않고 더 접은 자리
  const again = a.open();
  assert.equal(Date.parse(again.followups().coverage.floor), raw.ledger.cutoff);
  importLate(again, coachB.events());
  assert.deepEqual(rowsOf(again.followups(), mine.answer.eventId).map(r => r.reason), ['adjusted-history', 'adjusted-history', 'adjusted-history']);
});
test('a late sight of the pair counts even when the pair was shown again since, and a late candidate counts under a floor', () => {
  // 끝 판 검수 GPT: 늦은 제시는 로그 끝에 붙어 로그 차례로는 못 본다 · 바닥이 늦은 후보를 가리면 안 된다.
  {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-first', cell));
    a.at(1.5); play(coachA, item('a-pair', cell));
    a.at(2); fill(a, coachA, 'x', 20); settle(coachA);
    a.at(4); fill(a, coachA, 'y', 20); settle(coachA);
    a.step(1000); coachA.present(item('a-pair', cell)); // 같은 문항을 다시 보임
    b.at(0.5); coachB.present(item('b-sight', { family: 'a-pair', skill: 'ko.reading.reason' }));
    assert.equal(windowOf(coachA.followups(), mine.answer.eventId, 'd1').status, 'observed');
    importLate(coachA, coachB.events());
    const row = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    assert.deepEqual([row.status, row.reason], ['unavailable', 'adjusted-history']);
  }
  {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-first', cell));
    a.at(1.7); play(coachA, item('a-pair', cell));
    a.at(2); fill(a, coachA, 'x', 20); settle(coachA);
    a.at(4); fill(a, coachA, 'y', 20); settle(coachA);
    coachA.flush(); coachA.dispose();
    const raw = a.stored(); raw.ledger.folded += 10; a.store(raw); // 옛 판이 얼리지 않고 더 접은 자리
    const again = a.open();
    b.at(1.2); play(coachB, item('b-candidate', cell), { correct: false });
    assert.equal(windowOf(again.followups(), mine.answer.eventId, 'd1').status, 'observed');
    importLate(again, coachB.events());
    const row = windowOf(again.followups(), mine.answer.eventId, 'd1');
    assert.deepEqual([row.status, row.reason], ['unavailable', 'adjusted-history']);
  }
});
test('an answer inside the cycle before a frozen anchor does not overtake it, on one device or from another', () => {
  // 끝 판 검수 Fable F1: 계정 장부에서 앞 사이클 안의 답이 서버에서 늦게 돌아와 날것에 남은 채 뒤 앵커가 접혔다 · 다른 기기에서 앞 사이클 안의 답이 늦게 왔다.
  const run = ({ hold, late }) => {
    const { a, b, coachA, coachB } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); play(coachA, item('start', cell));
    a.at(30); const mid = play(coachA, item('mid', cell));
    a.at(46); const anchor = play(coachA, item('anchor', cell));
    a.at(47); const pair = play(coachA, item('pair', cell));
    const keepMid = new Set([mid.pid, coachA.events().find(e => e.id === mid.pid).decisionId]);
    const settle = () => coachA.syncPort.settle(coachA.events().filter(e => !hold || !keepMid.has(e.id) && !keepMid.has(e.presentationId) && !keepMid.has(e.decisionId)).map(e => e.id));
    a.at(48); fill(a, coachA, 'x', 20); settle(); a.at(50); fill(a, coachA, 'y', 20); settle(); fill(a, coachA, 'z', 20); settle();
    assert.equal(coachA.events().some(e => e.id === anchor.answer.eventId), false, 'the anchor folded');
    if (hold) assert.equal(coachA.events().some(e => e.id === mid.answer.eventId), true, 'the answer inside the earlier cycle is still in the log');
    if (late != null) { b.at(late); play(coachB, item('late', cell)); importLate(coachA, coachB.events()); }
    return rowsOf(coachA.followups(), anchor.answer.eventId).map(r => [r.window, r.status, r.reason, r.targetAttemptId === pair.answer.eventId]);
  };
  const clean = [['d1', 'observed', null, true], ['d7', 'not_due', null, false], ['d30', 'not_due', null, false]];
  assert.deepEqual(run({ hold: true }), clean, 'one device: an unsettled answer from the earlier cycle');
  assert.deepEqual(run({ hold: false, late: 20 }), clean, 'another device: a late answer inside the earlier cycle');
  assert.deepEqual(run({ hold: false, late: 45.5 }).map(r => r[2]), ['adjusted-history', 'adjusted-history', 'adjusted-history'], 'a late answer that would have started this cycle still marks it');
});
test('an answer the server never sends back stays inside its own cycle, however many cycles later', () => {
  // 설계 관문 §6 남긴 일 ①(셋째 사슬 Fable 최종 P2): 계정 장부에서 0일 답이 끝내 안 돌아와 날것에 남은 채 46 · 92일 앵커가 접히면, 표에는 칸마다
  // 마지막 사이클 시작과 그 앞 하나(ps)만 남아 0일 답이 늦은 기록으로 읽혔다 — 살아 있는 앵커와 그 칸의 다음 앵커가 모두 판단 보류가 됐다.
  const run = fold => {
    const b = bench({ fold, account: true, connected: true }), coach = b.open(), cell = { skill: 'ko.reading.detail' }, reads = [];
    b.at(0); const first = play(coach, item('first', cell));
    const hold = new Set([first.pid, coach.events().find(e => e.id === first.pid).decisionId]);
    const settle = () => coach.syncPort.settle(coach.events().filter(e => !hold.has(e.id) && !hold.has(e.presentationId) && !hold.has(e.decisionId)).map(e => e.id));
    for (let k = 1; k <= 4; k++) {
      b.at(46 * k); const anchor = play(coach, item(`c-${k}`, cell));
      b.at(46 * k + 2); fill(b, coach, `f-${k}`, 25); settle(); fill(b, coach, `g-${k}`, 25); settle();
      b.at(46 * k + 3); reads.push(rowsOf(coach.followups(), anchor.answer.eventId).map(r => [r.window, r.status, r.reason]));
    }
    return { reads, raw: coach.events().some(e => e.id === first.answer.eventId), folded: coach.followups().coverage.folded, row: b.stored().ledger?.followups.rows.find(r => r.s === cell.skill) };
  };
  const whole = run(false), folded = run({ remote: true, max: 40, keep: 20, ageMs: 1 });
  assert.ok(folded.folded > 0); assert.equal(folded.raw, true, 'the first answer is still in the log');
  assert.deepEqual(whole.reads, Array(4).fill([['d1', 'missed', null], ['d7', 'not_due', null], ['d30', 'not_due', null]]));
  assert.deepEqual(folded.reads, whole.reads);
  assert.deepEqual([folded.row.at, folded.row.ps, folded.row.pc], [START + 184 * DAY, START + 138 * DAY, [START, START + 46 * DAY, START + 92 * DAY]],
    'the frozen row keeps every earlier cycle start');
});
test('a late answer from another device inside any earlier cycle marks nothing; one that would start a cycle still marks the live row', () => {
  const run = late => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); play(coachA, item('c-0', cell)); a.at(46); play(coachA, item('c-46', cell)); a.at(90.8); play(coachA, item('c-inside', cell));
    a.at(92); const live = play(coachA, item('c-92', cell));
    a.at(93); fill(a, coachA, 'x', 20); settle(coachA); a.at(94); fill(a, coachA, 'y', 20); settle(coachA); fill(a, coachA, 'z', 20); settle(coachA);
    assert.equal(coachA.events().some(e => e.id === live.answer.eventId), false, 'the live anchor folded');
    b.at(late); play(coachB, item('late', cell)); importLate(coachA, coachB.events());
    a.at(95); return rowsOf(coachA.followups(), live.answer.eventId).map(r => r.status + (r.reason ? `/${r.reason}` : ''));
  };
  assert.deepEqual(run(20), ['missed', 'not_due', 'not_due'], 'inside the first cycle, two before the live one');
  assert.deepEqual(run(60), ['missed', 'not_due', 'not_due'], 'inside the cycle just before it');
  // 45.5일 답은 전체 기록에서 둘째 사이클을 열고, 90.8일 답이 셋째를 열어 92일 답은 앵커가 아니다.
  assert.deepEqual(run(45.5), Array(3).fill('unavailable/adjusted-history'), 'between the first two cycles');
});
// ── 늦게 온 앵커(성질 시험이 찾은 길, 11-17 · 설계 관문 §7) ─────────────────
test('a late anchor from another device pairs with the first answer this device logged in its window before it arrived', () => {
  // 다른 기기의 답이 늦게 와 새 사이클을 열면 로그 맨 뒤에 붙는다. 「뒤에 온 제시」를 로그 차례로 보면 이 기기가 먼저 적어 둔 창 안의 답이
  // 후보에서 빠져, 그 답이 접힌 뒤 더 뒤의 답이 짝이 됐다(창의 첫 답이 아님).
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  b.at(0); const anchor = play(coachB, item('b-anchor', cell));
  a.at(1.5); const first = play(coachA, item('a-first', cell)); a.at(1.6); play(coachA, item('a-second', cell));
  a.at(1.7); importLate(coachA, coachB.events());
  assert.equal(windowOf(coachA.followups(), anchor.answer.eventId, 'd1').targetAttemptId, first.answer.eventId, 'read before the fold');
  a.at(2); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === first.answer.eventId), false, 'the first answer folded');
  const d1 = windowOf(coachA.followups(), anchor.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.targetAttemptId], ['observed', first.answer.eventId], 'and kept through it');
});
test('a late anchor whose window lost its first answer to a fold marks that window instead of pairing a later answer', () => {
  // 늦은 앵커가 열 창의 첫 답(채점할 수 없는 답 — 사슬에는 안 들지만 짝 후보다)이 그 앵커가 오기 전에 접혔다. 접힌 이력에서는 그 답을 찾을 길이
  // 없으니, 바닥 앞에 열린 창처럼 뒤 답이 대신하지 않는다(lf — 그 창 안에서 처음 보인 계열이 접혔을 때만).
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  b.at(0); const anchor = play(coachB, item('b-anchor', cell));
  a.at(1.5); const pid = coachA.present(item('a-unanswered', cell)); coachA.answer(pid, { correct: null, assessable: false, reason: 'unanswered' });
  a.at(1.6); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === pid), false, 'the unanswered item folded');
  a.at(2.5); const later = play(coachA, item('a-later', cell));
  a.at(2.6); importLate(coachA, coachB.events());
  const rows = Object.fromEntries(rowsOf(coachA.followups(), anchor.answer.eventId).map(r => [r.window, r]));
  assert.deepEqual([rows.d1.status, rows.d1.reason, rows.d1.targetAttemptId], ['unavailable', 'adjusted-history', null], 'not the later answer');
  assert.notEqual(rows.d1.targetAttemptId, later.answer.eventId);
  assert.deepEqual([rows.d7.status, rows.d30.status], ['not_due', 'not_due'], 'a window opened after the fold reads as usual');
  // 앵커가 접혀 표에 얼어도 그대로다.
  a.at(3); fill(a, coachA, 'z', 20); settle(coachA); fill(a, coachA, 'w', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === anchor.answer.eventId), false, 'the anchor folded');
  assert.deepEqual(['status', 'reason'].map(k => windowOf(coachA.followups(), anchor.answer.eventId, 'd1')[k]), ['unavailable', 'adjusted-history']);
});
test('a late anchor whose family this device folded since is marked: the fold reads as met before it', () => {
  // Trail은 접힌 이력을 모두 로그 앞으로 본다. 늦게 온 앵커의 계열을 이 기기가 그 뒤에 보고 접었으면, 전체 기록으로는 새 문항인 답이 여기서는
  // 다시 본 문항으로 읽힌다(kind가 갈린다) — 짝처럼 접힌 같은 계열이 없는 답만 전체 기록처럼 읽는다.
  const run = shared => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    b.at(0); const anchor = play(coachB, item('b-anchor', { ...cell, family: 'F' }));
    // 이 기기가 접은 이력은 모두 앵커의 1일 창 앞이다(창 안에서 처음 보인 계열이 접히면 그 창은 따로 표시된다 — 앞 시험).
    a.at(0.5); play(coachA, item('a-sight', { skill: 'ko.reading.reason', family: shared ? 'F' : 'G' }));
    a.at(0.6); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
    assert.ok(a.stored().ledger.cutoff >= START, 'the anchor is older than the fold');
    a.at(0.9); importLate(coachA, coachB.events());
    return rowsOf(coachA.followups(), anchor.answer.eventId).map(r => [r.status, r.reason, r.kind]);
  };
  assert.deepEqual(run(true), Array(3).fill(['unavailable', 'adjusted-history', 'recovery']));
  assert.deepEqual(run(false), Array(3).fill(['not_due', null, 'retention']), 'a family this device never folded reads as usual');
});
// ── 로그 차례와 시각이 어긋난 답 · 시계 되돌림 동안 접힌 것(씨앗 탐침이 찾은 길, 11-17 · 설계 관문 §7) ─────
test('a late anchor read as helped or a repeat only by log order is marked; one the whole log reads the same way is not', () => {
  // Trail은 같은 문항 · 계열의 도움 · 시도를 로그 차례나 시각 어느 쪽으로든 앞이면 앞선 기록으로 본다. 다른 기기의 답이 늦게 와 이 기기가 그 뒤에
  // 같은 계열을 본 기록 뒤에 붙으면, 전체 기록(시각 순)으로는 처음 본 문항인 답이 여기서는 다시 본 문항이 된다(kind가 갈린다).
  const run = mode => {
    const { a, b, coachA, coachB } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    if (mode === 'already') { a.at(-1); play(coachA, item('a-before', { skill: 'ko.reading.reason', family: 'F' })); }
    b.at(0); const anchor = play(coachB, item('b-anchor', { ...cell, family: 'F' }), { correct: mode !== 'wrong' });
    a.at(0.5); play(coachA, item('a-after', { skill: 'ko.reading.reason', family: mode === 'other' ? 'G' : 'F' }));
    a.at(0.6); importLate(coachA, coachB.events());
    return rowsOf(coachA.followups(), anchor.answer.eventId).map(r => [r.status, r.reason, r.kind]);
  };
  assert.deepEqual(run('shared'), Array(3).fill(['unavailable', 'adjusted-history', 'recovery']));
  assert.deepEqual(run('other'), Array(3).fill(['not_due', null, 'retention']), 'a family this device never met');
  // 시각 순으로 읽어도 자격과 종류가 같으면 표시하지 않는다(이미 다시 본 문항 · 틀린 답은 어느 쪽으로 읽어도 recovery).
  assert.deepEqual(run('already'), Array(3).fill(['not_due', null, 'recovery']), 'already a repeat by time');
  assert.deepEqual(run('wrong'), Array(3).fill(['not_due', null, 'recovery']), 'a wrong answer reads as a recovery either way');
});
test('a late pair read as helped only by log order is marked', () => {
  // 짝 후보(다른 기기 1.5일 · 계열 P 첫 제시)보다 시각은 뒤 · 로그 위치는 앞에 이 기기가 같은 계열에서 힌트를 봤다. Trail은 그 짝을 도움 받은 답으로
  // 읽고(assisted-correct), 전체 기록은 혼자 맞힌 답으로 읽는다.
  const run = shared => {
    const { a, b, coachA, coachB } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-anchor', cell));
    b.at(1.5); play(coachB, item('b-pair', { ...cell, family: 'P' }));
    a.at(1.6); const open = coachA.present(item('a-open', { skill: 'ko.reading.reason', family: shared ? 'P' : 'Q' })); a.step(1000); coachA.help(open, 'hint');
    a.at(1.7); importLate(coachA, coachB.events());
    const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    return [d1.status, d1.reason, d1.outcome];
  };
  assert.deepEqual(run(true), ['unavailable', 'adjusted-history', null]);
  assert.deepEqual(run(false), ['observed', null, 'independent-correct']);
});
test('a late pair whose family has folded help only from a withdrawn presentation is marked: Trail and the time order both read that help as before it', () => {
  // 카본 검수: 철회한 제시는 장부의 presented에 들지 않아 그 계열이 「접혀 보인 것」이 아니지만, 그 제시의 도움 비트는 keys에 남는다. 다른 기기의 1.5일
  // 답(계열 F)이 늦게 오면 짝 후보가 되고, Trail은 접힌 도움을 모두 앞으로 보아 도움 받은 답으로 읽는다. 전체 기록에서는 그 힌트(1.6일)가 뒤다.
  const run = withdraw => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-anchor', cell));
    b.at(1.5); play(coachB, item('b-pair', { ...cell, family: 'F' }));
    a.at(1.6); const q = coachA.present(item('a-hinted', { skill: 'ko.reading.reason', family: withdraw ? 'F' : 'G' })); a.step(1000); coachA.help(q, 'hint');
    a.step(1000); coachA.exclude(q); coachA.flush(); coachA.dispose();
    // 계정 저장소는 답 없는 문항을 30일 동안 접지 않는다(다른 기기에서 답이 올 수 있다).
    a.at(32); const again = a.open(); fill(a, again, 'x', 20); settle(again); fill(a, again, 'y', 20); settle(again);
    assert.equal(again.events().some(e => e.id === q), false, 'the withdrawn presentation folded');
    a.at(33); importLate(again, coachB.events());
    const d1 = windowOf(again.followups(), mine.answer.eventId, 'd1');
    return [d1.status, d1.reason, d1.outcome];
  };
  assert.deepEqual(run(true), ['unavailable', 'adjusted-history', null]);
  assert.deepEqual(run(false), ['observed', null, 'independent-correct']);
});
test('a late anchor whose family has folded help only from a withdrawn presentation is marked as well', () => {
  // 5일에 계열 F 힌트를 본 제시를 철회하고 접은 뒤 시계를 3일로 되돌려 계열 F를 맞히면, Trail은 접힌 힌트를 앞으로 보아 도움 받은 답(recovery)으로
  // 읽는다. 전체 기록은 혼자 맞힌 답(retention)이다. d1은 그 뒤에 처음 보인 계열이 접혀 어차피 판단 보류지만, d7 · d30은 종류만 갈린다.
  const run = withdraw => {
    const b = bench({ fold: { max: 40, keep: 20, ageMs: 1 } }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    b.at(5); const q = coach.present(item('hinted', { skill: 'ko.reading.reason', family: withdraw ? 'F' : 'G' })); b.step(1000); coach.help(q, 'hint');
    b.step(1000); coach.exclude(q); coach.flush(); coach.dispose();
    b.at(5.1); coach = b.open(); fill(b, coach, 'x', 45); coach.flush(); coach.dispose();
    assert.equal(b.stored().events.some(e => e.id === q), false, 'the withdrawn presentation folded');
    b.at(3); coach = b.open(); const anchor = play(coach, item('anchor', { ...cell, family: 'F' })); coach.flush(); coach.dispose();
    b.at(6); return rowsOf(b.open().followups(), anchor.answer.eventId).map(r => [r.window, r.status, r.reason, r.kind]);
  };
  assert.deepEqual(run(true).map(([window, status, reason]) => [window, status, reason]), ['d1', 'd7', 'd30'].map(w => [w, 'unavailable', 'adjusted-history']));
  assert.deepEqual(run(false).slice(1), [['d7', 'not_due', null, 'retention'], ['d30', 'not_due', null, 'retention']]);
});
test('a presentation an older version logged without a measure has no family to Trail: an answer whose family key is its item key is read as Trail reads it', () => {
  // 한 기기 · 시간 순 기록. 옛 판이 측정 정보 없이 남긴 제시(문항 old.v1)는 Trail에서 문항 키만 지닌다. 새 문항의 계열 키가 그 문항 키와 같아도
  // Trail은 새 답을 처음 보는 문항의 혼자 맞힌 답으로 읽으므로, 앞선 도움 · 시도로 보고 판단 보류를 달지 않는다.
  const b = bench({ fold: false }); let coach = b.open();
  const old = play(coach, item('old'), { help: true }); coach.flush(); coach.dispose();
  const stored = b.stored(); for (const e of stored.events) if (e.id === old.pid) delete e.measure; b.store(stored);
  b.at(1); coach = b.open(); const fresh = play(coach, item('new', { family: 'old.v1' })); coach.flush(); coach.dispose();
  b.at(3); const report = b.open().followups();
  assert.deepEqual(rowsOf(report, fresh.answer.eventId).map(r => [r.window, r.kind, r.status, r.reason]),
    [['d1', 'retention', 'due', null], ['d7', 'retention', 'not_due', null], ['d30', 'retention', 'not_due', null]]);
});
test('a late first answer the log no longer reads as new marks its window, whether a later answer is found or none', () => {
  // 1일 창의 첫 답(다른 기기 1.5일 · 계열 Q)이 늦게 왔는데, 이 기기는 그 사이 계열 Q를 보고 접었다. 그 답은 여기서 새 문항으로 읽히지 않아
  // 짝이 되지 못하지만 전체 기록은 그 답을 짝으로 고른다 — 더 뒤의 답(1.8일)이 대신하지 않고, 뒤 답이 없어도 그 창은 판단 보류다.
  const run = later => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-anchor', cell));
    b.at(1.5); const first = play(coachB, item('b-first', { ...cell, family: 'Q' }));
    a.at(1.6); play(coachA, item('a-sight', { skill: 'ko.reading.reason', family: 'Q' })); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
    assert.equal(a.stored().ledger.presented.some(([, , family]) => family === 'Q'), true, 'this device folded its sight of the family');
    if (later) { a.at(1.8); play(coachA, item('a-later', cell)); }
    a.at(1.9); importLate(coachA, coachB.events());
    const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    // 그 늦은 답까지 접혀도 창은 판단 보류로 남는다(씨앗 탐침 8201 — 짝이 없으면 그 답을 표시한 짝으로 얼린다).
    a.at(2); fill(a, coachA, 'z', 20); settle(coachA); fill(a, coachA, 'w', 20); settle(coachA);
    const gone = !coachA.events().some(e => e.id === first.answer.eventId), after = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    return [d1.status, d1.reason, d1.targetAttemptId === first.answer.eventId, gone, after.status, after.reason];
  };
  assert.deepEqual(run(true), ['unavailable', 'adjusted-history', false, true, 'unavailable', 'adjusted-history'], 'not the later answer');
  assert.deepEqual(run(false), ['unavailable', 'adjusted-history', true, true, 'unavailable', 'adjusted-history'], 'and not an open window either: the late answer stands as a marked pair');
});
test('a pair marked for a late first answer stays marked when that answer folds before the pair does', () => {
  // Fable 최종 검수: 지금 고른 짝(9.5일 X)에 단 「앞선 후보」 표시는 앞선 답(다른 기기 7.2일 · 계열 Q)이 날것에 있는 동안만 살았다. 하루 지난
  // 항목만 접는 저장소에서 앞선 답이 먼저 접히고 X는 cutoff 뒤에 남으면, 표시된 짝이 얼지 않아 다음 읽기에서 X가 표시 없는 관측이 됐다.
  const DAYFOLD = { remote: true, max: 40, keep: 20, ageMs: DAY };
  const a = bench({ fold: DAYFOLD, account: true, connected: true }), b = bench({ fold: false, account: true, connected: true });
  const coachA = a.open(), coachB = b.open(), settle = coach => coach.syncPort.settle(coach.events().map(e => e.id)), cell = { skill: 'ko.reading.detail' };
  a.at(0); const anchor = play(coachA, item('a-anchor', cell));
  b.at(7.2); const early = play(coachB, item('b-first', { ...cell, family: 'Q' }), { correct: false });
  a.at(7.5); play(coachA, item('a-sight', { skill: 'ko.reading.reason', family: 'Q' })); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(8.8); fill(a, coachA, 'y', 3); settle(coachA); fill(a, coachA, 'y2', 1);
  assert.equal(a.stored().events.some(e => e.itemKey === 'a-sight.v1'), false, 'this device folded its sight of the family');
  a.at(9.5); const later = play(coachA, item('a-later', cell));
  a.at(9.6); importLate(coachA, coachB.events());
  const d7 = () => ['status', 'reason'].map(k => windowOf(coachA.followups(), anchor.answer.eventId, 'd7')[k]);
  assert.deepEqual(d7(), ['unavailable', 'adjusted-history']);
  settle(coachA); a.at(9.7); fill(a, coachA, 'z', 12); settle(coachA); fill(a, coachA, 'z2', 1);
  const events = a.stored().events;
  assert.deepEqual([events.some(e => e.id === early.answer.eventId), events.some(e => e.id === later.answer.eventId)], [false, true], 'the early answer folded first; the pair is still in the log');
  assert.deepEqual(d7(), ['unavailable', 'adjusted-history'], 'still marked');
  a.at(12); fill(a, coachA, 'w', 12); settle(coachA); fill(a, coachA, 'w2', 1);
  assert.deepEqual(d7(), ['unavailable', 'adjusted-history'], 'and once the pair folds too');
});
test('a late answer that overtakes a frozen row keeps its cycle: a clock set back inside it starts no anchor', () => {
  // 얼린 50일 행을 다른 기기의 20일 답이 추월해 표시한다. 그 답이 접혀도 사슬은 그 시각을 사이클 시작으로 남겨(ps), 30일로 되돌려 같은 칸을 풀어도
  // 새 사이클을 열지 않는다 — 전체 기록에서도 30일 답은 20일 사이클 안이다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(50); const row = play(coachA, item('a-row', cell)); a.at(51); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
  b.at(20); play(coachB, item('b-late', cell)); importLate(coachA, coachB.events());
  a.at(52); fill(a, coachA, 'z', 20); settle(coachA); fill(a, coachA, 'w', 20); settle(coachA);
  const stored = a.stored().ledger.followups.rows.find(r => r.id === row.answer.eventId);
  assert.deepEqual([stored.l, stored.ps], [1, START + 20 * DAY], 'marked, and the late start kept in its chain');
  coachA.flush(); coachA.dispose();
  a.at(30); const back = a.open(), answer = play(back, item('a-back', cell));
  assert.equal(rowsOf(back.followups(), answer.answer.eventId).length, 0, 'inside the late cycle while the clock is back');
  back.flush(); back.dispose();
  a.at(53); const report = a.open().followups();
  assert.equal(rowsOf(report, answer.answer.eventId).length, 0);
  assert.deepEqual(rowsOf(report, row.answer.eventId).map(r => r.reason), Array(3).fill('adjusted-history'));
});
test('a clock set back inside any earlier cycle of a frozen row starts no anchor there, not only the one just before it', () => {
  // 돌연변이 P3: 시계 너머의 행은 ps만이 아니라 pc의 사이클들로도 막는다. 0 · 46 · 92일 앵커를 접어 {92일, ps 46일, pc [0일]}을 남기고
  // 30일로 되돌려 같은 칸을 풀면, 첫 사이클(0~45일) 안의 그 답은 전체 기록에서도 앵커가 아니다.
  const run = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    for (const day of [0, 46, 92]) { b.at(day); play(coach, item(`c-${day}`, cell)); fill(b, coach, `f-${day}`, 45); }
    coach.flush(); coach.dispose();
    const row = fold && b.stored().ledger.followups.rows.find(r => r.s === cell.skill);
    b.at(30); coach = b.open(); const back = play(coach, item('c-back', cell)), during = rowsOf(coach.followups(), back.answer.eventId).length;
    for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
    coach.flush(); coach.dispose();
    b.at(93.5); const after = rowsOf(b.open().followups(), back.answer.eventId).length;
    return { during, after, chain: row && [row.at, row.ps, row.pc] };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.deepEqual(folded.chain, [START + 92 * DAY, START + 46 * DAY, [START]]);
  assert.deepEqual([whole.during, whole.after], [0, 0]);
  assert.deepEqual([folded.during, folded.after], [0, 0]);
});
test('a late start whose cycle ended before the fold it came after marks the next start: what folded there was read by another chain', () => {
  // 씨앗 탐침(3037 · 3231): 10일 앵커의 사이클 안이라 시작이 아니던 50일 답이 접힌 뒤, 시계를 1일로 되돌려 같은 칸을 풀면 1일 답이 사슬 머리가
  // 된다(10일 행은 그 사이클 안). 전체 기록은 1일 · 50일을 시작으로 읽지만 50일 답은 이미 접혀, 이 기기는 그 뒤 첫 답(60일)을 시작으로 세운다 —
  // 그 시작을 판단 보류로 둔다. 1일 행은 줄이 끝나 시작점만 남아도 lf를 지닌다.
  const run = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    b.at(10); play(coach, item('c-10', cell)); fill(b, coach, 'a', 45);
    b.at(50); play(coach, item('c-50', cell)); fill(b, coach, 'b', 45);
    coach.flush(); coach.dispose();
    b.at(1); coach = b.open(); play(coach, item('c-1', cell));
    for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
    coach.flush(); coach.dispose();
    // 51일(cutoff 뒤)에 접으면 1일 행은 45일이 지나 시작점만 남는다.
    b.at(51); coach = b.open(); fill(b, coach, 'c', 45); coach.flush(); coach.dispose();
    const start = fold && b.stored().ledger.followups.rows.find(r => r.at === START + DAY);
    b.at(60); coach = b.open(); const next = play(coach, item('c-60', cell));
    return { rows: rowsOf(coach.followups(), next.answer.eventId).map(r => r.reason), start: start && [start.lf > START + 50 * DAY, 'p' in start] };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.deepEqual(whole.rows, [], 'the whole log reads 60 days inside the cycle the 50-day answer opened');
  assert.deepEqual(folded.start, [true, false], 'the 1-day start is kept as a start only, with its lf');
  assert.deepEqual(folded.rows, Array(3).fill('adjusted-history'));
});
test('a frozen start right after a late start whose cycle ended before the fold it came after is marked too', () => {
  // 카본 검수: 10 · 60일 앵커(50일 답은 10일 사이클 안)를 접어 {60일, ps 10일}을 남긴 뒤 시계를 1일로 되돌려 같은 칸을 풀고 되돌린 채로 접으면
  // 1일 행(lf)과 60일 행이 함께 얼어 있다. 전체 기록은 1 · 50일을 시작으로 읽어 60일 답은 앵커가 아니다. 얼린 행끼리 이을 때도 다음 시작을 판단 보류로 둔다.
  const run = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    b.at(10); play(coach, item('c-10', cell)); fill(b, coach, 'a', 45);
    b.at(50); play(coach, item('c-50', cell)); fill(b, coach, 'b', 45);
    b.at(60); const row = play(coach, item('c-60', cell)); fill(b, coach, 'c', 45); coach.flush(); coach.dispose();
    b.at(1); coach = b.open(); play(coach, item('c-1', cell));
    for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
    coach.flush(); coach.dispose();
    const rows = fold && b.stored().ledger.followups.rows.filter(r => r.s === cell.skill).map(r => [r.at, Number.isFinite(r.lf)]);
    b.at(61); return { rows, reasons: rowsOf(b.open().followups(), row.answer.eventId).map(r => r.reason) };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.deepEqual(whole.reasons, [], 'the whole log reads 60 days inside the cycle the 50-day answer opened');
  assert.deepEqual(folded.rows, [[START + DAY, true], [START + 60 * DAY, false]], 'both rows frozen, the 1-day one with its lf');
  assert.deepEqual(folded.reasons, Array(3).fill('adjusted-history'));
});
test('a clock set back before a frozen row keeps the cycles before that row: a later clock set back inside them starts no anchor', () => {
  // 카본 검수: 0 · 55일 앵커를 접어 {55일, ps 0일}을 남긴 뒤 48일로 되돌려 같은 칸을 풀고 접으면 48일 행이 사슬 머리가 된다(55일 행은 그 사이클 안).
  // 48일 행도 0일 사이클을 지녀, 55일 행이 표에서 빠진 뒤 20일로 되돌려 푼 답이 새 사이클을 열지 않는다. 전체 기록에서도 20일 답은 0일 사이클 안이다.
  const run = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    const back = (day, name) => { b.at(day); coach = b.open(); const answer = play(coach, item(name, cell));
      for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`${name}-back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
      coach.flush(); coach.dispose(); return answer; };
    b.at(0); play(coach, item('c-0', cell)); fill(b, coach, 'a', 45);
    b.at(55); play(coach, item('c-55', cell)); fill(b, coach, 'b', 45); coach.flush(); coach.dispose();
    back(48, 'c-48');
    b.at(56); coach = b.open(); fill(b, coach, 'c', 45); coach.flush(); coach.dispose();
    const row = fold && b.stored().ledger.followups.rows.find(r => r.s === cell.skill);
    const late = back(20, 'c-20');
    b.at(57); return { chain: row && [row.at, row.ps ?? null], rows: rowsOf(b.open().followups(), late.answer.eventId).length };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.equal(whole.rows, 0, 'the whole log reads 20 days inside the 0-day cycle');
  assert.deepEqual(folded.chain, [START + 48 * DAY, START], 'the 48-day row keeps the 0-day start');
  assert.equal(folded.rows, 0);
});
test('a late anchor whose window lost to a fold a first answer shown before the window opened marks that window too', () => {
  // 카본 검수: 창 안의 첫 답이 창이 열리기 전에 보인 문항이면 그 계열의 처음 시각(fs)은 창 앞이다. 앵커 뒤에 처음 보인 계열은 창 안에서 답했을 수 있다.
  // 앵커 뒤에 처음 보인 계열이 하나도 접히지 않았으면(채움 문항은 창이 닫힌 뒤) 그 창은 전체 기록과 같게 읽는다.
  const run = early => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    b.at(0); const anchor = play(coachB, item('b-anchor', cell));
    const pid = early && (a.at(0.99), coachA.present(item('a-early', cell)));
    if (early) { a.at(1.01); coachA.answer(pid, { correct: null, assessable: false, reason: 'unanswered' }); }
    a.at(3.1); fill(a, coachA, 'x', 20); settle(coachA); fill(a, coachA, 'y', 20); settle(coachA);
    if (early) assert.equal(coachA.events().some(e => e.id === pid), false, 'the early item folded');
    a.at(3.2); importLate(coachA, coachB.events());
    const d1 = windowOf(coachA.followups(), anchor.answer.eventId, 'd1');
    return [d1.status, d1.reason];
  };
  assert.deepEqual(run(true), ['unavailable', 'adjusted-history']);
  assert.deepEqual(run(false), ['missed', null]);
});
test('a fold while the clock is set back marks a frozen row it would have read as met before', () => {
  // 시계 너머의 행은 읽지 않지만, 되돌린 동안의 기록이 그 행 앞(시각)의 같은 계열 시도면 표시해 둔다 — 그 기록이 시계가 돌아오기 전에 접혀도 남는다.
  // (설계 관문 §2 「앵커 k × ③」의 「되돌린 동안 접혔으면 못 봄」을 닫음.)
  const run = (fold, shared) => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    b.at(10); const row = play(coach, item('r', { ...cell, family: 'F' })); fill(b, coach, 'a', 45);
    coach.flush(); coach.dispose();
    b.at(5); coach = b.open(); const back = play(coach, item('f-back', { skill: 'ko.reading.reason', family: shared ? 'F' : 'G' }));
    for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
    coach.flush(); coach.dispose();
    if (fold) assert.equal(b.stored().events.some(e => e.id === back.answer.eventId), false, 'the attempt folded while the clock was back');
    b.at(10.5); return rowsOf(b.open().followups(), row.answer.eventId).map(r => [r.status, r.reason, r.kind]);
  };
  assert.deepEqual(run(false, true), Array(3).fill(['not_due', null, 'recovery']), 'the whole log reads it as a repeat');
  assert.deepEqual(run({ max: 40, keep: 20, ageMs: 1 }, true), Array(3).fill(['unavailable', 'adjusted-history', 'retention']));
  assert.deepEqual(run({ max: 40, keep: 20, ageMs: 1 }, false), Array(3).fill(['not_due', null, 'retention']), 'another family marks nothing');
});
test('a fold while the clock is set back marks a frozen pair whose family it showed before that pair', () => {
  // 10일 앵커의 1일 창 짝(11.5일 · 계열 P)이 얼었다. 5일로 되돌려 계열 P를 보고 접으면, 전체 기록에서 그 짝은 처음 보인 계열이 아니다(짝이 아님).
  const run = (fold, shared) => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    b.at(10); const row = play(coach, item('r', cell)); b.at(11.5); const pair = play(coach, item('p', { ...cell, family: 'P' })); fill(b, coach, 'a', 45);
    coach.flush(); coach.dispose();
    b.at(5); coach = b.open(); const back = play(coach, item('p-back', { skill: 'ko.reading.reason', family: shared ? 'P' : 'Q' }));
    for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`back-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
    coach.flush(); coach.dispose();
    if (fold) assert.equal(b.stored().events.some(e => e.id === back.pid), false, 'the sight folded while the clock was back');
    b.at(12); const d1 = windowOf(b.open().followups(), row.answer.eventId, 'd1');
    return [d1.status, d1.reason, d1.targetAttemptId === pair.answer.eventId];
  };
  assert.deepEqual(run(false, true), ['due', null, false], 'the whole log pairs nothing there');
  assert.deepEqual(run({ max: 40, keep: 20, ageMs: 1 }, true), ['unavailable', 'adjusted-history', true]);
  assert.deepEqual(run({ max: 40, keep: 20, ageMs: 1 }, false), ['observed', null, true], 'another family marks nothing');
});
test('a clock set back before a frozen pair keeps that pair and its marks: a late answer in its window never replaces it', () => {
  // 끝 판 둘째 사슬 GPT: 시계를 앵커와 짝 사이로 되돌린 동안 늦은 답이 같은 창에 오면, 그 답이 짝을 대신해 얼려졌다.
  const run = clockBack => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-first', cell));
    a.at(2); const pair = play(coachA, item('a-pair', cell));
    a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
    assert.equal(coachA.events().some(e => e.id === pair.answer.eventId), false, 'the pair is frozen');
    coachA.flush(); coachA.dispose();
    b.at(1.5); const late = play(coachB, item('b-late', cell));
    if (clockBack) a.at(1.75);
    let coach = a.open(); importLate(coach, coachB.events());
    const back = windowOf(coach.followups(), mine.answer.eventId, 'd1');
    if (clockBack) assert.deepEqual([back.status, back.targetAttemptId], ['due', null], 'a pair past this clock is not shown yet');
    for (let n = 0; n < 40; n++) play(coach, item(`z-${n}`, { skill: 'ko.reading.main', difficulty: 3 }), { step: a.step });
    settle(coach); fill(a, coach, 'w', 20); settle(coach);
    assert.equal(coach.events().some(e => e.id === late.answer.eventId), false, 'the late answer has folded');
    coach.flush(); coach.dispose();
    a.at(18); coach = a.open();
    const d1 = windowOf(coach.followups(), mine.answer.eventId, 'd1');
    return [d1.targetAttemptId === pair.answer.eventId, d1.status, d1.reason];
  };
  const straight = run(false);
  assert.deepEqual(straight, [true, 'unavailable', 'adjusted-history']);
  assert.deepEqual(run(true), straight);
});
test('a help left on the server for a folded presentation still marks the frozen pair it came before', () => {
  // 끝 판 둘째 사슬 GPT A: 짝이 접힌 뒤 그 짝 제시의 도움이 늦게 오면 건너뛰어 adjusted만 늘고, 짝은 혼자 맞힘으로 남았다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(0); const mine = play(coachA, item('a-first', cell)), other = play(coachA, item('a-other', { skill: 'ko.reading.reason' }));
  a.at(1.6); const otherPair = play(coachA, item('a-other-pair', { skill: 'ko.reading.reason' }));
  b.at(1.5); const pid = coachB.present(item('b-pair', cell)); b.at(1.53); coachB.help(pid, 'hint'); b.at(1.55); const pair = coachB.answer(pid, { correct: true, assessable: true });
  const help = coachB.events().find(e => e.type === 'practice.helped');
  a.at(2); importLate(coachA, coachB.events().filter(e => e.id !== help.id));
  assert.equal(windowOf(coachA.followups(), mine.answer.eventId, 'd1').outcome, 'independent-correct', 'the help has not arrived');
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === pid), false, 'the pair is folded');
  assert.deepEqual(importLate(coachA, [help]).skipped, [help.id], 'the help stays on the server');
  const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.reason, d1.targetAttemptId], ['unavailable', 'adjusted-history', pair.eventId]);
  const kept = windowOf(coachA.followups(), other.answer.eventId, 'd1');
  assert.deepEqual([kept.outcome, kept.targetAttemptId], ['independent-correct', otherPair.answer.eventId], 'only the pair on that presentation');
  coachA.flush(); coachA.dispose(); a.at(18);
  assert.equal(windowOf(a.open().followups(), mine.answer.eventId, 'd1').reason, 'adjusted-history', 'the mark is kept');
});
test('a help left on the server for a folded anchor presentation marks the row it called a retention', () => {
  // 11-10 GPT GA2(talk-atlas-vellum-sync): 기준 답의 제시가 접힌 뒤 그 제시의 도움이 늦게 오면 건너뛰어 adjusted만 늘고, 전체 기록으로는
  // 도움 받은 답(recovery)인데 접힌 표의 줄은 retention · observed로 남았다 — lateHelp가 짝(row.t)만 봤다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' }, other = { skill: 'ko.reading.reason' };
  b.at(0); const pid = coachB.present(item('b-anchor', cell)); b.at(0.01); coachB.help(pid, 'hint'); b.at(0.02); const anchor = coachB.answer(pid, { correct: true, assessable: true });
  const help = coachB.events().find(e => e.type === 'practice.helped');
  a.at(0.5); importLate(coachA, coachB.events().filter(e => e.id !== help.id));
  const kept = play(coachA, item('a-other', other));
  a.at(1.5); const pair = play(coachA, item('a-pair', cell)), keptPair = play(coachA, item('a-other-pair', other));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === pid), false, 'the anchor presentation is folded');
  const before = rowsOf(coachA.followups(), anchor.eventId);
  assert.deepEqual([before[0].kind, before[0].status, before[0].outcome, before[0].targetAttemptId], ['retention', 'observed', 'independent-correct', pair.answer.eventId], 'the help has not arrived');
  assert.deepEqual(importLate(coachA, [help]).skipped, [help.id], 'the help stays on the server');
  assert.deepEqual(rowsOf(coachA.followups(), anchor.eventId).map(r => [r.status, r.reason]), [['unavailable', 'adjusted-history'], ['unavailable', 'adjusted-history'], ['unavailable', 'adjusted-history']]);
  const control = windowOf(coachA.followups(), kept.answer.eventId, 'd1');
  assert.deepEqual([control.kind, control.outcome, control.targetAttemptId], ['retention', 'independent-correct', keptPair.answer.eventId], 'only the row on that presentation');
  // 표시는 표에 굳어 다시 열어도 남고, 그 사이클이 끝나면 다음 답이 새 앵커가 된다.
  coachA.flush(); coachA.dispose(); a.at(18);
  const again = a.open();
  assert.deepEqual(rowsOf(again.followups(), anchor.eventId).map(r => r.reason), ['adjusted-history', 'adjusted-history', 'adjusted-history'], 'the mark is kept');
  a.at(47); const next = play(again, item('a-next', cell));
  assert.deepEqual(rowsOf(again.followups(), next.answer.eventId).map(r => [r.status, r.reason]), [['not_due', null], ['not_due', null], ['not_due', null]]);
});
test('a help on the server before an anchor already read as helped or wrong changes nothing', () => {
  // 도움 받은 답 · 틀린 답은 이미 recovery다 — 늦은 도움이 더 바꿀 것이 없어 줄을 판단 보류로 돌리지 않는다.
  for (const [correct, helped] of [[false, false], [true, true]]) {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    b.at(0); const pid = coachB.present(item('b-anchor', cell)); b.at(0.005); if (helped) coachB.help(pid, 'text'); b.at(0.01); coachB.help(pid, 'hint'); b.at(0.02); const anchor = coachB.answer(pid, { correct, assessable: true });
    const help = coachB.events().filter(e => e.type === 'practice.helped').at(-1);
    a.at(0.5); importLate(coachA, coachB.events().filter(e => e.id !== help.id));
    a.at(1.5); const pair = play(coachA, item('a-pair', cell));
    a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
    assert.equal(coachA.events().some(e => e.id === pid), false, 'the anchor presentation is folded');
    assert.deepEqual(importLate(coachA, [help]).skipped, [help.id]);
    const d1 = windowOf(coachA.followups(), anchor.eventId, 'd1');
    assert.deepEqual([d1.kind, d1.status, d1.targetAttemptId], ['recovery', 'observed', pair.answer.eventId], `correct ${correct} helped ${helped}`);
  }
});
test('a help left on the server that came after the frozen answer marks nothing', () => {
  // 답 뒤에 본 해설 · 정답은 그 답을 도운 것이 아니다 — 서버에만 남아 늦게 와도 앵커 행 · 짝을 판단 보류로 돌리지 않는다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  const answered = (name, level) => { const pid = coachB.present(item(name, cell)); b.step(1000); const answer = coachB.answer(pid, { correct: true, assessable: true }); b.step(1000); coachB.help(pid, level); return { pid, answer }; };
  b.at(0); const anchor = answered('b-anchor', 'explanation');
  b.at(1.5); const pair = answered('b-pair', 'answer');
  const helps = coachB.events().filter(e => e.type === 'practice.helped');
  a.at(2); importLate(coachA, coachB.events().filter(e => e.type !== 'practice.helped'));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === anchor.pid || e.id === pair.pid), false, 'both presentations are folded');
  assert.deepEqual(importLate(coachA, helps).skipped, helps.map(h => h.id), 'both helps stay on the server');
  const d1 = windowOf(coachA.followups(), anchor.answer.eventId, 'd1');
  assert.deepEqual([d1.kind, d1.status, d1.outcome, d1.reason, d1.targetAttemptId], ['retention', 'observed', 'independent-correct', null, pair.answer.eventId]);
});
test('a late help or attempt in the log before a frozen retention anchor marks its row, whether or not the ledger still counts that answer', () => {
  // GA2의 날것 길: 다른 기기가 같은 계열을 앵커 답보다 먼저 도움 받았거나 풀었고 그 기록이 늦게 왔다 — 전체 기록으로는 그 답이 혼자 푼 새 문항이
  // 아니다(recovery). 앵커 답이 장부 최근 증거(칸마다 12개)에 있으면 demote가 거둬 invalidated가 먼저 보이고, 같은 칸을 더 풀어 최근 증거에서
  // 빠졌거나 답이 아직 날것이면 표시가 판단 보류로 돌린다. 틀린 답(이미 recovery)은 늦은 기록이 줄을 바꾸지 않는다.
  const run = ({ more, hold, late, correct = true }) => {
    const { a, b, coachA, coachB } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(1); const mine = play(coachA, item('a-first', cell), { correct });
    const mark = new Set([mine.pid, coachA.events().find(e => e.id === mine.pid).decisionId]);
    const settle = () => coachA.syncPort.settle(coachA.events().filter(e => !hold || !mark.has(e.id) && !mark.has(e.presentationId) && !mark.has(e.decisionId)).map(e => e.id));
    a.at(1.2); for (let n = 0; n < more; n++) { a.step(1000); play(coachA, item(`same-${n}`, cell)); }
    a.at(2); fill(a, coachA, 'x', 20); settle(); a.at(4); fill(a, coachA, 'y', 20); settle(); fill(a, coachA, 'z', 20); settle();
    assert.equal(coachA.events().some(e => e.id === mine.answer.eventId), hold, hold ? 'the anchor answer is still in the log' : 'the anchor answer is folded');
    const kind = correct ? 'retention' : 'recovery';
    assert.ok(a.stored().ledger.followups.rows.some(r => r.id === mine.answer.eventId && r.k === kind), `the row is frozen as a ${kind}`);
    assert.deepEqual(rowsOf(coachA.followups(), mine.answer.eventId).map(r => r.kind), [kind, kind, kind]);
    // 다른 칸(능력)의 같은 계열이라 앵커 사슬의 추월(같은 칸의 앞선 답)로는 잡히지 않는다.
    b.at(0.5); const other = item('b-same', { family: 'a-first', skill: 'ko.reading.reason' });
    if (late === 'help') { const seen = coachB.present(other); b.step(1000); coachB.help(seen, 'hint'); } else play(coachB, other, { step: b.step });
    importLate(coachA, coachB.events());
    return rowsOf(coachA.followups(), mine.answer.eventId).map(r => [r.status, r.reason]);
  };
  const withdrawn = Array(3).fill(['invalidated', 'source-withdrawn']), held = Array(3).fill(['unavailable', 'adjusted-history']);
  for (const late of ['help', 'attempt']) {
    assert.deepEqual(run({ more: 0, hold: false, late }), withdrawn, `${late}: still among the recent answers, the ledger withdraws it`);
    assert.deepEqual(run({ more: 25, hold: false, late }), held, `${late}: no longer among the recent answers`);
    assert.deepEqual(run({ more: 0, hold: true, late }), held, `${late}: frozen while its answer is still in the log`);
    assert.deepEqual(run({ more: 25, hold: false, late, correct: false }), [['missed', null], ['not_due', null], ['not_due', null]], `${late}: a wrong answer was a recovery already`);
  }
});
test('a late help or attempt before a frozen pair marks it after the ledger no longer keeps that pair among its recent answers', () => {
  // 끝 판 둘째 사슬 GPT B: 같은 칸을 25문항 더 풀어 짝이 장부의 최근 증거에서 빠지면, 다른 기기의 늦은 도움이 짝을 거두지 못했다.
  // 11-10: 짝을 보인 뒤 · 풀기 전 다른 기기의 같은 계열 시도도 같다(설계 관문 메모 2 — 전체 기록으로는 그 짝이 새 문항이 아니다).
  for (const late of ['help', 'attempt']) {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-first', cell));
    a.at(1.5); const pid = coachA.present(item('a-pair', cell)); a.at(1.55); const pair = coachA.answer(pid, { correct: true, assessable: true });
    a.at(1.6); for (let n = 0; n < 25; n++) { a.step(1000); play(coachA, item(`same-${n}`, cell)); }
    a.at(2); fill(a, coachA, 'x', 20); settle(coachA); a.at(4); fill(a, coachA, 'y', 20); settle(coachA); fill(a, coachA, 'z', 20); settle(coachA);
    assert.equal(coachA.events().some(e => e.id === pair.eventId), false, 'the pair is folded');
    assert.equal(windowOf(coachA.followups(), mine.answer.eventId, 'd1').outcome, 'independent-correct');
    b.at(1.52); const other = coachB.present(item('b-same', { family: 'a-pair', skill: 'ko.reading.reason' }));
    b.at(1.53); if (late === 'help') coachB.help(other, 'hint'); else coachB.answer(other, { correct: true, assessable: true });
    importLate(coachA, coachB.events());
    const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    assert.deepEqual([d1.status, d1.reason, d1.targetAttemptId], ['unavailable', 'adjusted-history', pair.eventId], late);
  }
});
test('a late help before a pair the log can no longer read again marks it', () => {
  // 끝 판 둘째 사슬 GPT B: 짝을 연 사이 다른 판에서 같은 계열을 잠깐 열었다 닫고 짝만 서버에 안 닿은 채 나머지가 접히면, 짝은 날것에 남아도 다시 읽히지 않는다.
  const { a, b, coachA, coachB } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(0); const mine = play(coachA, item('a-first', cell));
  a.at(1.5); const pid = coachA.present(item('a-pair', cell));
  a.at(1.52); const tab = a.open('other-game'); tab.present(item('glimpse', { skill: 'ko.reading.reason', family: 'a-pair' })); tab.flush(); tab.dispose();
  a.at(1.55); const pair = coachA.answer(pid, { correct: true, assessable: true });
  const mark = new Set([pid, coachA.events().find(e => e.id === pid).decisionId]);
  const settle = () => coachA.syncPort.settle(coachA.events().filter(e => !mark.has(e.id) && !mark.has(e.presentationId) && !mark.has(e.decisionId)).map(e => e.id));
  // 계정 장부는 끝나지 않은 판을 30일 뒤에야 접는다.
  a.at(32); fill(a, coachA, 'x', 20); settle(); a.at(33); fill(a, coachA, 'y', 20); settle(); fill(a, coachA, 'z', 20); settle();
  assert.equal(coachA.events().some(e => e.id === pair.eventId), true, 'the pair is still in the log');
  assert.ok(a.stored().ledger.presented.some(([, item]) => item === 'glimpse.v1'), 'the glimpse folded');
  assert.equal(windowOf(coachA.followups(), mine.answer.eventId, 'd1').outcome, 'independent-correct');
  b.at(1.53); const other = coachB.present(item('b-same', { family: 'a-pair', skill: 'ko.reading.reason' })); b.step(1000); coachB.help(other, 'hint');
  importLate(coachA, coachB.events());
  const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.reason], ['unavailable', 'adjusted-history']);
});
test('a clock set back inside the cycle before a frozen row starts no anchor there', () => {
  // 끝 판 둘째 사슬 GPT A: 0일 · 46일 앵커를 접어 {46일, ps 0일}을 남기고 44일로 되돌려 같은 칸을 풀면, 앞 사이클 안의 그 답이 새 앵커로 얼었다.
  const run = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }; let coach = b.open();
    b.at(0); play(coach, item('c-0', cell)); fill(b, coach, 'a', 45);
    b.at(46); const second = play(coach, item('c-46', cell)); fill(b, coach, 'b', 45);
    coach.flush(); coach.dispose();
    // 되돌린 동안 1분 넘게 띄워 풀어야 접는다(접기 재시도 1분).
    b.at(44); coach = b.open(); const back = play(coach, item('c-44', cell));
    for (let n = 0; n < 45; n++) { b.step(61000); play(coach, item(`c-${n}`, { skill: 'ko.reading.main', difficulty: 3 })); }
    coach.flush(); coach.dispose();
    b.at(47.5); coach = b.open(); const report = coach.followups();
    return { second: rowsOf(report, second.answer.eventId).map(r => [r.window, r.status]), back: rowsOf(report, back.answer.eventId).length };
  };
  const whole = run(false), folded = run({ max: 40, keep: 20, ageMs: 1 });
  assert.deepEqual(whole, { second: [['d1', 'due'], ['d7', 'not_due'], ['d30', 'not_due']], back: 0 });
  assert.deepEqual(folded, whole);
});
test('a late candidate earlier than a frozen pair marks its window even when this device met its family later', () => {
  // Fable 설계 관문(11-09) 지적 1: 다른 기기의 늦은 짝 후보 X(1.2일)를, 이 기기가 같은 계열을 시간은 뒤 · 로그 위치는 앞에 보였거나(날것)
  // 이미 접었다는(접힘) 까닭으로 「처음 보는 문항」에서 걸러 표시 없이 지나쳤다 — 늦은 후보는 시각으로 찾는다(접힌 첫 제시는 표의 fs 시각).
  const run = later => {
    const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
    a.at(0); const mine = play(coachA, item('a-first', cell));
    a.at(1.5); play(coachA, item('a-pair', { ...cell, family: 'fp' }));
    if (later === 'folded') { a.at(2); play(coachA, item('a-fx', { ...cell, family: 'fx' })); }
    a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA); fill(a, coachA, 'z', 20); settle(coachA);
    if (later === 'raw') { a.at(5.5); play(coachA, item('a-fx', { ...cell, family: 'fx' })); }
    if (later === 'folded') assert.ok(Number.isFinite(a.stored().ledger.followups.fs?.['family:fx']), 'the fold froze when fx was first seen');
    b.at(1.2); play(coachB, item('b-x', { ...cell, family: 'fx' }));
    a.at(6); importLate(coachA, coachB.events());
    const d1 = windowOf(coachA.followups(), mine.answer.eventId, 'd1');
    return [d1.status, d1.reason];
  };
  for (const later of [null, 'folded', 'raw']) assert.deepEqual(run(later), ['unavailable', 'adjusted-history'], `this device met the family: ${later}`);
});
test('a family seen long ago and seen again never gets its later sight frozen as its first: no late mark in a plain log', () => {
  // 셋째 사슬 GPT GA1 · GF1 · GI1: 45일 넘은 첫 시각이 표에서 빠진 뒤, 같은 계열을 다시 본 시각이 「처음 보인 시각」으로 얼어
  // 다시 본 답이 앞선 후보처럼 읽혀 정상 짝에 판단 보류가 붙었다(시계 되돌림 · 늦은 기록 없음).
  const run = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' }, coach = b.open(), other = n => item('fill-' + n, { skill: 'ko.reading.main', difficulty: 3 });
    b.at(0); play(coach, item('f-0', { ...cell, family: 'F' }));
    b.at(1); for (let n = 0; n < 15; n++) { b.step(61000); play(coach, other('old-' + n)); }
    b.at(50); const anchor = play(coach, item('a', cell));
    b.at(51); const again = play(coach, item('f-1', { ...cell, family: 'F' }));
    b.step(60000); const pair = play(coach, item('t', cell));
    b.step(60000); coach.help(again.pid, 'explanation');
    const raw = id => b.stored().events.some(e => e.id === id);
    // 10분 지난 짝 T는 접히고, 해설로 늦게 닫힌 F의 다시 보기는 아직 10분이 안 돼 날것에 남는 자리.
    b.step(570000); for (let n = 0; n < 30 && raw(pair.answer.eventId); n++) { b.step(1000); play(coach, other('new-' + n)); }
    return { d1: windowOf(coach.followups(), anchor.answer.eventId, 'd1'), again: raw(again.answer.eventId), paired: raw(pair.answer.eventId), fs: b.stored().ledger?.followups?.fs?.['family:F'] };
  };
  const whole = run(false), folded = run({ max: 12, keep: 2, ageMs: 600000 });
  assert.deepEqual([folded.paired, folded.again], [false, true], 'the pair has folded and the answer that saw F again is still in the log');
  assert.deepEqual([whole.d1.status, whole.d1.outcome], ['observed', 'independent-correct']);
  assert.deepEqual([folded.d1.status, folded.d1.outcome, folded.d1.reason], [whole.d1.status, whole.d1.outcome, whole.d1.reason]);
  assert.equal(folded.fs, undefined, 'the later sight of F is not frozen as its first');
});
test('a mark a late help made on one tab survives another tab writing the same fold', () => {
  // 셋째 사슬 아르곤 A2: 주 인스턴스가 서버에만 남은 도움으로 표에 판단 보류를 달고 닫힌 뒤, 옛 장부를 든 다른 게임 코치가 같은 접힘으로
  // 장부를 합치며 제 표를 골라 저장하자 그 표시가 영영 사라졌다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(0); const mine = play(coachA, item('a-first', cell));
  b.at(1.5); const pid = coachB.present(item('b-pair', cell)); b.at(1.53); coachB.help(pid, 'hint'); b.at(1.55); coachB.answer(pid, { correct: true, assessable: true });
  const help = coachB.events().find(e => e.type === 'practice.helped');
  a.at(2); importLate(coachA, coachB.events().filter(e => e.id !== help.id));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === pid), false, 'the pair is folded');
  const game = a.open('other-game');
  importLate(coachA, [help]); coachA.flush(); coachA.dispose();
  a.step(1000); play(game, item('g-1', { skill: 'ko.reading.reason' })); game.flush(); game.dispose();
  a.at(18);
  const d1 = windowOf(a.open().followups(), mine.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.reason], ['unavailable', 'adjusted-history']);
});
test('a mark a late help made on a frozen anchor row survives another tab writing the same fold', () => {
  // 서버에만 남은 도움이 단 행 표시는 다시 만들 수 없다 — 옛 표를 든 다른 코치가 같은 접힘으로 저장해도 남아야 한다(carryMarks의 행 표시).
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  b.at(0); const pid = coachB.present(item('b-anchor', cell)); b.at(0.01); coachB.help(pid, 'hint'); b.at(0.02); const anchor = coachB.answer(pid, { correct: true, assessable: true });
  const help = coachB.events().find(e => e.type === 'practice.helped');
  a.at(0.5); importLate(coachA, coachB.events().filter(e => e.id !== help.id));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === pid), false, 'the anchor presentation is folded');
  const game = a.open('other-game');
  importLate(coachA, [help]); coachA.flush(); coachA.dispose();
  a.step(1000); play(game, item('g-1', { skill: 'ko.reading.reason' })); game.flush(); game.dispose();
  a.at(18);
  assert.deepEqual(rowsOf(a.open().followups(), anchor.eventId).map(r => r.reason), ['adjusted-history', 'adjusted-history', 'adjusted-history']);
});
test('a fold keeps a family\'s first sight only while it is the earliest one and still inside the live window', () => {
  // 셋째 사슬 아르곤 E1 · G1: 계열마다 가장 이른 시각을 고르기 전에 45일 넘은 것을 걸러, 이번 접기에서 빠지는 옛 처음 시각 자리를
  // 다시 본 시각이 채웠다 — 가장 이른 것을 먼저 고른 뒤 버린다(문항 키는 얼리지 않는다).
  const now = START + 60 * DAY, report = {};
  const sights = [['family:F', START], ['family:F', now - 2 * DAY], ['family:G', now - 3 * DAY], ['family:G', now - 4 * DAY], ['item:x.v1', now - 3 * DAY], ['family:H', now]];
  Object.defineProperty(report, 'sealing', { value: { rows: [], starts: [], floor: -Infinity, now, later: [], sights } });
  assert.deepEqual(Temper.sealFollowups(report, { cutoff: now - DAY, folded: 10 }).fs, { 'family:G': now - 4 * DAY });
});
test('after a clock set back two rows of one cell: the earlier starts the cycle, as a whole log reads it', () => {
  // 끝 판 검수 Fable F2.
  const script = fold => {
    const b = bench({ fold }), cell = { skill: 'ko.reading.detail' };
    b.at(10); let coach = b.open(); const later = play(coach, item('later', cell));
    fill(b, coach, 'a', 30); coach.flush(); coach.dispose();
    b.at(0); coach = b.open(); const earlier = play(coach, item('earlier', cell));
    for (let n = 0; n < 40; n++) { if (n === 30) b.step(2 * MIN); play(coach, item(`back-${n}`, { skill: 'ko.reading.reason', difficulty: 2 }), { step: b.step }); }
    coach.flush(); coach.dispose();
    b.at(13);
    const report = b.open().followups();
    return { earlier: rowsOf(report, earlier.answer.eventId).map(r => [r.window, r.status]), later: rowsOf(report, later.answer.eventId).length, folded: report.coverage.folded };
  };
  const whole = script(false), folded = script({ max: 40, keep: 20, ageMs: 1 });
  assert.ok(folded.folded > 0);
  assert.equal(whole.earlier.length, 3); assert.equal(whole.later, 0);
  // 사슬은 전체 기록과 같다. 되돌린 동안의 0일 답은 늦은 앵커(lf)라, 그 뒤에 처음 보여 접힌 계열이 있는 d1 · d7 창은 첫 답을 잃었을 수 있어
  // 판단 보류다(카본 검수 11-17 — 창이 열리기 전에 보인 문항도 창 안에서 답할 수 있다).
  assert.equal(folded.later, whole.later);
  assert.deepEqual(folded.earlier, [['d1', 'unavailable'], ['d7', 'unavailable'], whole.earlier[2]]);
});
test('a late set response touches no row', () => {
  const { a, b, coachA, coachB, settle } = twoDevices();
  b.at(0); const set = coachB.finishSet({ kind: 'short' }); coachB.feedback(set, 'helpful');
  a.at(1); const mine = play(coachA, item('a-first')); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(3); fill(a, coachA, 'y', 20); settle(coachA);
  const pick = report => report.items.map(r => [r.id, r.status, r.outcome, r.reason]), before = pick(coachA.followups());
  assert.equal(rowsOf(coachA.followups(), mine.answer.eventId).length, 3);
  importLate(coachA, coachB.events());
  const report = coachA.followups();
  assert.ok(report.coverage.adjusted > 0, 'the ledger counts it');
  assert.equal(report.evidenceComplete, true); assert.deepEqual(pick(report), before);
});
test('a late candidate or an earlier sight of the pair marks that window only', () => {
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(0); const mine = play(coachA, item('a-first', cell));
  a.at(1.5); const pair = play(coachA, item('a-pair', cell));
  a.at(8); const week = play(coachA, item('a-week', cell));
  a.at(9); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(11); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(windowOf(coachA.followups(), mine.answer.eventId, 'd1').status, 'observed');
  b.at(1.2); play(coachB, item('b-candidate', cell));
  b.at(7.5); const shown = coachB.present(item('a-week', { skill: 'ko.reading.main', family: 'a-week' })); assert.ok(shown);
  importLate(coachA, coachB.events());
  const report = coachA.followups(), rows = Object.fromEntries(rowsOf(report, mine.answer.eventId).map(r => [r.window, r]));
  assert.deepEqual([rows.d1.status, rows.d1.reason], ['unavailable', 'adjusted-history']);
  assert.deepEqual([rows.d7.status, rows.d7.reason], ['unavailable', 'adjusted-history'], 'the pair had already been shown on the other device');
  assert.equal(week.answer.eventId, rows.d7.targetAttemptId);
  assert.equal(rows.d30.status, 'not_due');
  assert.equal(pair.answer.eventId, rows.d1.targetAttemptId);
});
test('another device withdrawing a frozen answer invalidates its row', () => {
  const { a, b, coachA, coachB, settle } = twoDevices();
  a.at(0); const mine = play(coachA, item('a-first'));
  importLate(coachB, coachA.events());
  const excluded = coachB.exclude(mine.answer.eventId);
  a.at(1); fill(a, coachA, 'x', 20); settle(coachA);
  a.at(3); fill(a, coachA, 'y', 20); settle(coachA);
  assert.equal(coachA.events().some(e => e.id === mine.answer.eventId), false);
  importLate(coachA, [excluded]);
  assert.deepEqual(rowsOf(coachA.followups(), mine.answer.eventId).map(r => [r.status, r.reason]), [['invalidated', 'source-withdrawn'], ['invalidated', 'source-withdrawn'], ['invalidated', 'source-withdrawn']]);
});

// ── 옛 판과 섞임 · 표 ───────────────────────────────────────────
test('an older writer folding over the table leaves a floor; frozen rows stay and only windows it may have cut go unavailable', () => {
  const b = bench(), coach = b.open(), cell = { skill: 'ko.reading.detail' };
  const frozen = play(coach, item('frozen', cell));
  b.at(1); const pair = play(coach, item('frozen-pair', cell));
  b.at(2); fill(b, coach, 'a', 25); coach.flush(); coach.dispose();
  // 옛 작성자: fold는 표를 그대로 옮기고 folded · cutoff만 늘리며 얼리지 않는다.
  const raw = b.stored(), oldCutoff = START + 8 * DAY;
  raw.ledger.folded += 10; raw.ledger.cutoff = oldCutoff; raw.ledger.followupsPreserved = false; b.store(raw);
  b.at(8.5);
  const next = b.open(); play(next, item('after-floor-same-window', cell)); // 그 창의 첫 답을 잃었을 수 있다 — 뒤 답이 대신하지 않는다(설계 검토 GPT)
  const report = next.followups();
  assert.equal(report.evidenceComplete, true); assert.equal(Date.parse(report.coverage.floor), oldCutoff);
  assert.equal(windowOf(report, frozen.answer.eventId, 'd1').targetAttemptId, pair.answer.eventId, 'what was frozen stays');
  assert.deepEqual([windowOf(report, frozen.answer.eventId, 'd7').status, windowOf(report, frozen.answer.eventId, 'd7').reason], ['unavailable', 'older-source-unavailable'], 'the d7 window opened before the floor: its first answer may be gone');
  assert.equal(windowOf(report, frozen.answer.eventId, 'd7').targetAttemptId, null);
  assert.equal(windowOf(report, frozen.answer.eventId, 'd30').status, 'not_due');
});
test('an older opted-in ledger without a table is read from its log, then frozen by the next fold', () => {
  const b = bench(), coach = b.open(), first = play(coach, item('first'));
  b.at(1); const pair = play(coach, item('pair'));
  coach.flush(); coach.dispose();
  const raw = b.stored();
  raw.ledger = { version: 'learning-ledger-1', cutoff: START - DAY, folded: 8, keys: {}, presented: [], cells: {}, content: {}, counts: null, followupsPreserved: true }; b.store(raw);
  const next = b.open(); let report = next.followups();
  assert.equal(report.coverage.floor, null); assert.equal(windowOf(report, first.answer.eventId, 'd1').targetAttemptId, pair.answer.eventId);
  b.at(2); fill(b, next, 'a', 30);
  report = next.followups();
  assert.equal(next.events().some(e => e.id === first.answer.eventId), false);
  assert.equal(windowOf(report, first.answer.eventId, 'd1').targetAttemptId, pair.answer.eventId);
  assert.equal(b.stored().ledger.followups.v, Temper.FOLLOWUP.table);
});
test('a table of another version is not read and does not stop anything', () => {
  const b = bench(), coach = b.open(); play(coach, item('first')); b.at(1); fill(b, coach, 'a', 30); coach.flush(); coach.dispose();
  const raw = b.stored(); raw.ledger.followups = { v: 99, rows: 'future' }; b.store(raw);
  b.at(2);
  const next = b.open(), report = next.followups(), later = play(next, item('after', { skill: 'ko.reading.reason' }));
  assert.equal(Date.parse(report.coverage.floor), raw.ledger.cutoff);
  assert.equal(rowsOf(next.followups(), later.answer.eventId).length, 3);
});
test('a damaged table counts as none: reads, the next fold and later answers all go on', () => {
  const b = bench(), coach = b.open(); play(coach, item('first')); b.at(1); fill(b, coach, 'a', 30); coach.flush(); coach.dispose();
  const raw = b.stored(), row = raw.ledger.followups.rows.find(r => r.p);
  assert.ok(row);
  row.t = { d1: null }; b.store(raw);
  b.at(2);
  const next = b.open(), report = next.followups();
  assert.equal(Date.parse(report.coverage.floor), raw.ledger.cutoff, 'the table is not read');
  fill(b, next, 'b', 60);
  const after = b.stored().ledger, later = play(next, item('after', { skill: 'ko.reading.reason' }));
  assert.ok(after.folded > raw.ledger.folded, 'the fold goes on');
  assert.equal(after.followups.floor, raw.ledger.cutoff);
  assert.equal(rowsOf(next.followups(), later.answer.eventId).length, 3);
});
test('a new ledger keeps older readings from offering rows and passes an older validator shape', () => {
  const b = bench(), coach = b.open(); play(coach, item('first')); b.at(1); fill(b, coach, 'a', 30);
  const { ledger } = b.stored();
  assert.equal(ledger.followupsPreserved, false, 'older readings refuse instead of reading what is left');
  assert.equal(ledger.followupsLost, undefined, 'the older validator caps its anchors at 24: never written now');
});
test('a follow-up reading that fails never stops the learning write', () => {
  const temperPath = require.resolve('../atlas/temper.js'), gamePath = require.resolve('../atlas/game-learning.js');
  const saved = require.cache[temperPath], savedGame = require.cache[gamePath];
  const broken = { ...Temper, followups: () => { throw new Error('broken reading'); } };
  require.cache[temperPath] = { ...saved, exports: broken }; delete require.cache[gamePath];
  try {
    const Broken = require(gamePath), mem = new Map(); let now = START;
    const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
    const coach = Broken.createGame({ gameId: 'world-practice', map, storage, clock: () => new Date(now += 1000).toISOString(), fold: { max: 40, keep: 20, ageMs: 1 } });
    for (let n = 0; n < 30; n++) { const pid = coach.present(item(`i-${n}`)); coach.answer(pid, { correct: true, assessable: true }); }
    const { ledger, events } = JSON.parse(mem.get(KEY));
    assert.ok(ledger.folded > 0); assert.ok(events.length > 0);
    assert.equal(ledger.followups.floor, ledger.cutoff); assert.deepEqual(ledger.followups.rows, []);
    assert.equal(coach.summary().storage.available, true);
  } finally { require.cache[temperPath] = saved; if (savedGame) require.cache[gamePath] = savedGame; else delete require.cache[gamePath]; }
});
// 읽기가 예외를 내는 Temper로 Core를 다시 불러 그 모듈로 코치를 연다(저장소와 시계는 그대로).
function withBrokenReading(fn) {
  const temperPath = require.resolve('../atlas/temper.js'), gamePath = require.resolve('../atlas/game-learning.js');
  const saved = require.cache[temperPath], savedGame = require.cache[gamePath];
  require.cache[temperPath] = { ...saved, exports: { ...Temper, followups: () => { throw new Error('broken reading'); } } }; delete require.cache[gamePath];
  try { return fn(require(gamePath)); } finally { require.cache[temperPath] = saved; if (savedGame) require.cache[gamePath] = savedGame; else delete require.cache[gamePath]; }
}
test('a fold whose reading fails keeps the first sights it froze: a late candidate in a family seen since is still found', () => {
  // 설계 관문 §6 남긴 일 ②(셋째 사슬 Fable 최종 P3): 읽기가 예외를 낸 접기는 앞 표의 행만 두고 계열의 처음 시각(fs)을 버려, 그 뒤에 온 늦은 짝 후보를 놓쳤다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(0); const mine = play(coachA, item('a-first', cell));
  a.at(1.5); play(coachA, item('a-pair', { ...cell, family: 'fp' }));
  a.at(2); play(coachA, item('a-fx', { ...cell, family: 'fx' }));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA); fill(a, coachA, 'z', 20); settle(coachA);
  const sight = a.stored().ledger.followups.fs?.['family:fx'];
  assert.ok(Number.isFinite(sight), 'the fold froze when fx was first seen');
  coachA.flush(); coachA.dispose();
  withBrokenReading(Broken => {
    const coach = a.open('world-practice', { module: Broken }), before = a.stored().ledger.folded;
    a.at(6); fill(a, coach, 'w', 40); settle(coach); fill(a, coach, 'v', 40); settle(coach);
    assert.ok(a.stored().ledger.folded > before, 'it folded while its reading failed');
    coach.flush(); coach.dispose();
  });
  const { ledger } = a.stored();
  assert.equal(ledger.followups.floor, ledger.cutoff, 'the failed reading left a floor');
  assert.equal(ledger.followups.fs?.['family:fx'], sight, 'and kept the first sight it had frozen');
  b.at(1.2); play(coachB, item('b-x', { ...cell, family: 'fx' }));
  a.at(7); const again = a.open(); importLate(again, coachB.events());
  const d1 = windowOf(again.followups(), mine.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.reason], ['unavailable', 'adjusted-history']);
});
test('a fold whose reading fails and takes a family for the first time still lets a late first answer of it mark the pair', () => {
  // 카본 검수: 읽기가 예외를 낸 접기가 처음 접은 계열(fy)은 표에 처음 시각이 없다. 바닥(floor)이 선 표에서는 그런 계열이 바닥 때까지 처음 보였을 수
  // 있는 것으로 읽어, 그보다 앞서 늦게 온 같은 계열 답을 앞선 후보로 찾는다.
  const { a, b, coachA, coachB, settle } = twoDevices(), cell = { skill: 'ko.reading.detail' };
  a.at(0); const mine = play(coachA, item('a-first', cell));
  a.at(1.5); play(coachA, item('a-pair', { ...cell, family: 'fp' }));
  a.at(3); fill(a, coachA, 'x', 20); settle(coachA); a.at(5); fill(a, coachA, 'y', 20); settle(coachA); fill(a, coachA, 'z', 20); settle(coachA);
  a.at(5.5); const fy = play(coachA, item('a-fy', { skill: 'ko.reading.reason', family: 'fy' })); settle(coachA);
  assert.equal(a.stored().ledger.followups.fs?.['family:fy'], undefined, 'fy has not folded yet');
  coachA.flush(); coachA.dispose();
  withBrokenReading(Broken => {
    const coach = a.open('world-practice', { module: Broken });
    a.at(6); fill(a, coach, 'w', 40); settle(coach); fill(a, coach, 'v', 40); settle(coach);
    coach.flush(); coach.dispose();
  });
  assert.equal(a.stored().events.some(e => e.id === fy.pid), false, 'the failed fold took fy');
  b.at(1.2); play(coachB, item('b-y', { ...cell, family: 'fy' }));
  a.at(7); const again = a.open(); importLate(again, coachB.events());
  const d1 = windowOf(again.followups(), mine.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.reason], ['unavailable', 'adjusted-history']);
});
test('a clock set back does not show a frozen row or pair from its future', () => {
  const b = bench(), coach = b.open(); const first = play(coach, item('first'));
  b.at(1); play(coach, item('pair')); b.at(2); fill(b, coach, 'a', 30); coach.flush(); coach.dispose();
  const raw = b.stored(); assert.equal(raw.ledger.followups.rows.find(r => r.id === first.answer.eventId).t.d1.at > START, true);
  for (const row of raw.ledger.followups.rows) if (row.t?.d1) row.t.d1.at = START + 500 * DAY; // 앞으로 찍힌 짝
  b.store(raw);
  const next = b.open(), report = next.followups(), d1 = windowOf(report, first.answer.eventId, 'd1');
  assert.equal(d1.targetAttemptId, null, 'a pair from the future is not read');
});

test('a fold while the clock is set back keeps the frozen rows from its future', () => {
  const b = bench(), coach = b.open(), first = play(coach, item('first'));
  b.at(1); const pair = play(coach, item('pair'));
  b.at(2); fill(b, coach, 'a', 30); coach.flush(); coach.dispose();
  assert.equal(b.stored().events.some(e => e.id === first.answer.eventId), false, 'the anchor left the log');
  // 시계를 앵커보다 앞으로 돌리고 다른 칸을 풀어 다시 접는다.
  b.at(-1); const back = b.open(); assert.equal(rowsOf(back.followups(), first.answer.eventId).length, 0, 'not shown while the clock is back');
  const foldedBefore = b.stored().ledger.folded;
  for (let n = 0; n < 40; n++) { if (n === 30) b.step(2 * MIN); play(back, item(`back-${n}`, { skill: 'ko.reading.reason', difficulty: 2 }), { step: b.step }); }
  back.flush(); back.dispose();
  assert.ok(b.stored().ledger.folded > foldedBefore, 'it folded while the clock was back');
  assert.ok(b.stored().ledger.followups.rows.some(r => r.id === first.answer.eventId), 'the table keeps it');
  b.at(3);
  const again = b.open(), d1 = windowOf(again.followups(), first.answer.eventId, 'd1');
  assert.deepEqual([d1.status, d1.targetAttemptId], ['observed', pair.answer.eventId]);
});

// ── 소비 ───────────────────────────────────────────────────────
const skills = map.allNodes().filter(n => n.kind === 'skill');
const cells = count => Array.from({ length: count }, (_, i) => item(`c${i}`, { skill: skills[i % skills.length].id, difficulty: 1 + Math.floor(i / skills.length) % 3, format: ['single-choice', 'binary-choice'][Math.floor(i / (skills.length * 3))] }));
for (const count of [24, 25, 40, 62]) {
  test(`${count} cells: every cell anchors and WORLD practice still offers its due rows`, () => {
    const b = bench({ fold: false }), coach = b.open(), its = cells(count);
    assert.equal(new Set(its.map(i => [i.skillId, i.difficulty, i.responseFormat].join())).size, count);
    for (const it of its) { b.step(1000); play(coach, it); }
    b.at(2);
    const projection = coach.followups(), pool = its.map(it => ({ ...it, id: `n-${it.id}`, itemKey: `n-${it.itemKey}`, familyKey: `n-${it.familyKey}` }));
    assert.equal(projection.items.length, count * 3); assert.equal(projection.coverage.limited, false);
    const rows = followupRows({ projection, pool, seen: () => false, taskVersion: map.map_ver });
    assert.equal(rows.limited, false); assert.equal(rows.rows.length, 12); assert.equal(rows.rows.filter(r => r.available).length, 12);
  });
}
test('over its share a game keeps every anchor whole: rows appear as older ones end, the same as a whole log', () => {
  const skillsAll = map.allNodes().filter(n => n.kind === 'skill'), formats = ['single-choice', 'binary-choice', 'cup-compose', 'action', 'spoken'], every = [];
  for (const node of skillsAll) for (const difficulty of [1, 2, 3]) for (const format of formats) every.push({ skill: node.id, difficulty, format });
  const share = Temper.FOLLOWUP.maxAnchorsPerGame;
  const run = fold => {
    const b = bench({ fold }), coach = b.open();
    every.slice(0, share).forEach((cell, n) => { b.step(1000); play(coach, item(`old-${n}`, cell)); });
    b.at(40); const over = every.slice(share, share + 3).map((cell, n) => { b.step(1000); return [cell, play(coach, item(`over-${n}`, cell))]; });
    fill(b, coach, 'x', 30);
    const during = coach.followups();
    assert.ok(during.coverage.excludedAnchors >= 3);
    b.at(41.5); const pair = play(coach, item('over-pair', over[0][0]));
    fill(b, coach, 'y', 30);
    b.at(47);
    const report = coach.followups();
    return { folded: report.coverage.folded, limited: report.coverage.limited, rows: report.items.map(r => [r.sourceAt, r.window, r.status, r.outcome, r.targetAt].join('|')).sort(), pair: windowOf(report, over[0][1].answer.eventId, 'd1')?.targetAttemptId === pair.answer.eventId };
  };
  const whole = run(false), folded = run({ max: 60, keep: 30, ageMs: 1 });
  assert.ok(folded.folded > 0); assert.equal(whole.pair, true);
  assert.equal(folded.pair, true, 'the pair of an anchor over the share survived the fold');
  assert.deepEqual(folded.rows, whole.rows);
});
test('the anchor cap never stops supply: only incomplete evidence or a retention limit from an older engine does', () => {
  const measure = { skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false, taskVersion: 'v1' };
  const row = { id: 'r:d1', gameId: 'world-practice', status: 'due', window: 'd1', dueAt: '2026-12-02T00:00:00Z', measure, current: true };
  const fresh = { id: 'n', itemKey: 'n', familyKey: 'n', skillId: measure.skillId, difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false };
  const run = (extra, coverage) => followupRows({ projection: { evidenceComplete: true, coverage, items: [row], ...extra }, pool: [fresh], seen: () => false, taskVersion: 'v1' });
  assert.equal(run({}, { limited: true, excludedAnchors: 5 }).rows[0].available, true);
  assert.equal(run({}, { limited: true, excludedAnchors: 5 }).limited, false);
  assert.equal(run({}, { retentionLimited: true }).rows[0].available, false);
  assert.equal(run({ evidenceComplete: false }, {}).limited, true);
});
test('rows that can be opened now come first, so rows without an item never push them off the list', () => {
  const measureOf = n => ({ skillId: `ko.reading.s${n}`, difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false, taskVersion: 'v1' });
  const rows = Array.from({ length: 13 }, (_, n) => ({ id: `r${n}:d1`, gameId: 'world-practice', status: 'due', window: 'd1', dueAt: new Date(START + n * MIN).toISOString(), measure: measureOf(n), current: true }));
  const last = { id: 'n', itemKey: 'n', familyKey: 'n', ...measureOf(12) }; delete last.taskVersion;
  const out = followupRows({ projection: { evidenceComplete: true, coverage: {}, items: rows }, pool: [last], seen: () => false, taskVersion: 'v1' });
  assert.equal(out.rows[0].id, 'r12:d1'); assert.equal(out.rows[0].available, true);
  assert.equal(out.rows.length, 12);
});
test('life rows follow the same rule', () => {
  const life = { lifeItems: () => [{ packId: 'p', lessonId: 'l', questionId: 'q', review: false, itemKey: 'q', familyKey: 'q', skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false, confounded: false }], productMet: () => false, lifeAssessable: () => true };
  const row = { id: 'r:d1', gameId: 'world-life', status: 'due', window: 'd1', dueAt: '2026-12-02T00:00:00Z', current: true, measure: { skillId: 'ko.reading.detail', difficulty: 1, responseFormat: 'single-choice', modality: 'reading', audioRequired: false, taskVersion: 'v1' } };
  const run = extra => lifeFollowupRows({ projection: { evidenceComplete: true, coverage: {}, items: [row], ...extra }, seen: () => false, snapshot: {}, life, taskVersion: 'v1' });
  assert.equal(run({ coverage: { limited: true } }).rows[0].available, true);
  assert.equal(run({ coverage: { retentionLimited: true } }).rows[0].available, false);
  assert.equal(run({ evidenceComplete: false }).limited, true);
});
