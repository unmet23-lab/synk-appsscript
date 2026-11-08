'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Game = require('../atlas/game-learning'), Temper = require('../atlas/temper');
const { createMap } = require('../strata');
const map = createMap(require('../strata/maps/topik-i.json'));
const DAY = 86400000, ORIGIN = Date.parse('2026-10-01T00:00:00Z');
function fixture(extra = {}) {
  const values = new Map(); let at = ORIGIN;
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const options = { gameId: 'world-practice', map, storage, fold: false, followups: true, clock: () => new Date(at).toISOString(), ...extra };
  let game = Game.createGame(options);
  const play = (id, { correct = false, help = false, metadata = {}, assessable = true, audio = null, after = null } = {}) => {
    const pid = game.present({ id, itemKey: id, familyKey: id, skillId: 'ko.reading.detail', difficulty: 1,
      modality: 'reading', responseFormat: 'single-choice', audioRequired: false, ...metadata });
    if (audio) game.delivery(pid, { audio });
    if (help) game.help(pid, help === true ? 'hint' : help);
    const answer = game.answer(pid, { correct, assessable });
    if (after) game.help(pid, after);
    return { pid, answer };
  };
  return { values, storage, options, play, get game() { return game; },
    at: days => { at = ORIGIN + days * DAY; }, reopen: () => { game = Game.createGame(options); return game; } };
}
const row = (f, window) => f.game.followups().items.find(item => item.window === window);

test('versioned d1/d7/d30 windows are observation opportunities, not treatment/effect claims', () => {
  const f = fixture(), source = f.play('source', { after: 'explanation' });
  let report = f.game.followups();
  assert.equal(report.policy, Temper.FOLLOWUP.version);
  assert.equal(report.observationOpportunities, true);
  assert.equal(report.learningEffectClaim, false); assert.equal(report.causalClaim, false); assert.equal(report.policyPromotion, false);
  assert.deepEqual(report.items.map(r => r.status), ['not_due', 'not_due', 'not_due']);
  assert.deepEqual(report.items.map(r => [Date.parse(r.dueAt) - ORIGIN, Date.parse(r.expiresAt) - ORIGIN]), [[DAY, 3 * DAY], [7 * DAY, 10 * DAY], [30 * DAY, 37 * DAY]]);
  assert.ok(report.items.every(r => r.sourceAttemptId === source.answer.eventId && r.kind === 'recovery'));
  for (const [day, window] of [[1, 'd1'], [7, 'd7'], [30, 'd30']]) { f.at(day); assert.equal(row(f, window).status, 'due'); }
  for (const [day, window] of [[3, 'd1'], [10, 'd7'], [37, 'd30']]) { f.at(day); assert.equal(row(f, window).status, 'missed'); assert.equal(row(f, window).outcome, null); }
});

test('the first observed response stays incorrect or assisted instead of being replaced by later success', () => {
  const f = fixture(); f.play('source', { correct: true }); f.at(1);
  const first = f.play('wrong'), later = f.play('right', { correct: true });
  assert.equal(row(f, 'd1').kind, 'retention');
  assert.equal(row(f, 'd1').outcome, 'independent-incorrect');
  assert.equal(row(f, 'd1').targetAttemptId, first.answer.eventId);
  assert.notEqual(row(f, 'd1').targetAttemptId, later.answer.eventId);
  f.at(7); f.play('helped', { correct: true, help: 'explanation' });
  assert.equal(row(f, 'd7').outcome, 'assisted-correct');
  f.at(30); const independent = f.play('after', { correct: true, after: 'explanation' });
  assert.equal(row(f, 'd30').outcome, 'independent-correct');
  assert.equal(row(f, 'd30').targetAttemptId, independent.answer.eventId);
});

test('an unassessable first new response remains unknown instead of becoming zero or a later success', () => {
  const f = fixture(); f.play('source'); f.at(1);
  const skipped = f.play('skipped', { correct: null, assessable: false }); f.play('right', { correct: true });
  const result = row(f, 'd1');
  assert.equal(result.status, 'unavailable'); assert.equal(result.outcome, null);
  assert.equal(result.targetAttemptId, skipped.answer.eventId);
});

test('source and target exclusions withdraw outcomes without silently choosing replacement evidence', () => {
  for (const which of ['source', 'target', 'completion', 'presentation']) {
    const f = fixture(), source = f.play('source'); f.at(1);
    const target = f.play('target', { correct: true }); f.play('replacement', { correct: true });
    const events = f.game.events(), attempted = events.find(e => e.id === target.answer.eventId);
    const decision = events.find(e => e.id === attempted.presentationId).decisionId;
    const id = which === 'source' ? source.answer.eventId : which === 'target' ? target.answer.eventId
      : which === 'presentation' ? target.pid : events.find(e => e.type === 'experience.completed' && e.decisionId === decision).id;
    f.game.exclude(id);
    const result = row(f, 'd1');
    assert.equal(result.status, 'invalidated', which); assert.equal(result.outcome, null);
    assert.equal(result.sourceAttemptId, source.answer.eventId); assert.equal(result.targetAttemptId, target.answer.eventId);
  }
});

test('correction IDs are actual explanation/answer deliveries between the source and target', () => {
  const f = fixture(), source = f.play('source');
  const correction = f.game.help(source.pid, 'explanation'); f.at(1);
  const target = f.play('target', { correct: true }); f.game.help(target.pid, 'explanation');
  assert.deepEqual(row(f, 'd1').correctionEventIds, [correction.id]);
  f.game.exclude(correction.id); assert.deepEqual(row(f, 'd1').correctionEventIds, []);
});

test('withdrawn pre-answer help or audio cannot upgrade an observed result to independent success', () => {
  for (const kind of ['help', 'audio']) {
    const f = fixture(), metadata = kind === 'audio' ? { skillId: 'ko.listening.detail', modality: 'listening', audioRequired: true } : {};
    f.play('source', { metadata, audio: kind === 'audio' ? 'completed' : null }); f.at(1);
    const target = f.play('target', { metadata, correct: true, help: kind === 'help', audio: kind === 'audio' ? 'completed' : null });
    assert.equal(row(f, 'd1').status, 'observed');
    const proof = f.game.events().find(e => e.presentationId === target.pid && e.type === (kind === 'help' ? 'practice.helped' : 'practice.delivery'));
    f.game.exclude(proof.id);
    assert.equal(row(f, 'd1').status, 'invalidated'); assert.equal(row(f, 'd1').outcome, null);
    assert.equal(row(f, 'd1').targetAttemptId, target.answer.eventId);
  }
});

test('different format, difficulty, game, repeated family and earlier display never supply the target', () => {
  const f = fixture(), source = f.play('source');
  f.game.present({ id: 'shown', itemKey: 'shown', familyKey: 'shown', skillId: 'ko.reading.detail', difficulty: 1,
    modality: 'reading', responseFormat: 'single-choice', audioRequired: false });
  f.at(1);
  f.play('format', { correct: true, metadata: { responseFormat: 'action' } });
  f.play('hard', { correct: true, metadata: { difficulty: 2 } });
  f.play('repeat', { correct: true, metadata: { familyKey: 'source' } });
  f.play('shown', { correct: true });
  const other = Game.createGame({ ...f.options, gameId: 'another-game' });
  const pid = other.present({ id: 'other', itemKey: 'other', familyKey: 'other', skillId: 'ko.reading.detail', difficulty: 1,
    modality: 'reading', responseFormat: 'single-choice', audioRequired: false }); other.answer(pid, { correct: true, assessable: true });
  assert.equal(f.game.followups().items.find(r => r.sourceAttemptId === source.answer.eventId && r.window === 'd1').status, 'due');
});

test('time is occurrence time; future receipts and reverse clocks cannot create early results', () => {
  const f = fixture(); f.play('source'); f.at(3); f.play('outside', { correct: true });
  assert.equal(row(f, 'd1').status, 'missed');
  f.at(7); f.play('later', { correct: true });
  const report = row(f, 'd7'); assert.equal(report.status, 'observed');
  const raw = JSON.parse(f.storage.getItem(`${Game.KEY}.device`));
  for (const e of raw.events) if (e.at >= new Date(7 * DAY + ORIGIN).toISOString()) e.recordedAt = new Date(9 * DAY + ORIGIN).toISOString();
  f.storage.setItem(`${Game.KEY}.device`, JSON.stringify(raw)); f.reopen();
  assert.equal(row(f, 'd7').status, 'due'); f.at(9); assert.equal(row(f, 'd7').status, 'observed');
});

test('incomplete history and a game over its anchor share are explicit, and another game keeps its own', () => {
  const f = fixture(); f.play('source'); f.at(1); f.game.syncPort.markComplete(false);
  assert.equal(f.game.mapVersion, map.map_ver);
  assert.equal(f.game.followups().evidenceComplete, false); assert.equal(row(f, 'd1').status, 'unavailable');
  assert.equal(f.game.followups().coverage.reason, 'incomplete-history');
  const g = fixture(), skills = map.allNodes().filter(n => n.kind === 'skill').map(n => n), formats = ['single-choice', 'binary-choice', 'cup-compose', 'action', 'spoken'];
  const cells = [];
  for (const node of skills) for (const difficulty of [1, 2, 3]) for (const responseFormat of formats) cells.push({ skillId: node.id, modality: node.domain, difficulty, responseFormat });
  assert.ok(cells.length > Temper.FOLLOWUP.maxAnchorsPerGame + 3, 'the map has more cells than one game may anchor');
  const answer = (coach, n, cell) => { const pid = coach.present({ id: `item-${n}`, itemKey: `item-${n}`, audioRequired: false, ...cell }); coach.answer(pid, { correct: false, assessable: true }); };
  const greedy = g.game;
  cells.slice(0, Temper.FOLLOWUP.maxAnchorsPerGame + 3).forEach((cell, n) => answer(greedy, n, cell));
  // A game started afterwards still anchors: the first game cannot use up its share.
  const late = Game.createGame({ ...g.options, gameId: 'later-game' });
  answer(late, 'late', cells[0]);
  const report = g.game.followups(), by = id => report.items.filter(r => r.gameId === id).length / Temper.FOLLOWUP.windows.length;
  assert.equal(by('world-practice'), Temper.FOLLOWUP.maxAnchorsPerGame); assert.equal(by('later-game'), 1);
  assert.equal(report.coverage.limited, true); assert.equal(report.coverage.excludedAnchors, 3);
  assert.equal(report.evidenceComplete, true, 'the share leaves cells out; it does not make the others untrue');
});

test('a writer without the option folds and the follow-up rows stay', () => {
  const f = fixture({ followups: false, fold: { max: 40, keep: 20, ageMs: 1 } });
  const source = f.play('source'); f.at(1);
  const target = f.play('next-0', { correct: true });
  for (let n = 1; n < 30; n++) f.play(`next-${n}`, { correct: true });
  f.at(2); f.play('flush-trigger', { correct: true });
  f.options.followups = true; f.reopen();
  const report = f.game.followups();
  assert.ok(report.coverage.folded > 0); assert.equal(report.evidenceComplete, true); assert.equal(report.coverage.reason, null);
  assert.equal(f.game.events().some(e => e.id === source.answer.eventId), false, 'the anchor itself folded');
  assert.equal(row(f, 'd1').sourceAttemptId, source.answer.eventId);
  assert.deepEqual([row(f, 'd1').status, row(f, 'd1').targetAttemptId], ['observed', target.answer.eventId]);
});

// 옛 판 작성자가 표 없이 접은 장부: 무엇을 잃었는지 모르므로 그 시각까지의 답은 앵커가 되지 않고, 그 뒤 답은 바로 앵커가 된다.
test('a ledger an older writer folded has a floor: nothing before it anchors, the next answer does', () => {
  for (const legacy of [{ followupsPreserved: false }, { followupsPreserved: true, followupsLost: { anchors: 3, at: ORIGIN } }]) {
    const f = fixture({ fold: { max: 40, keep: 20, ageMs: 1 } });
    f.play('early'); f.at(1);
    for (let n = 0; n < 30; n++) f.play(`next-${n}`, { correct: true });
    f.at(2); f.play('flush-trigger', { correct: true });
    const key = `${Game.KEY}.device`, raw = JSON.parse(f.storage.getItem(key));
    assert.ok(raw.ledger.folded > 0);
    delete raw.ledger.followups; Object.assign(raw.ledger, legacy);
    const cutoff = raw.ledger.cutoff;
    f.storage.setItem(key, JSON.stringify(raw)); f.reopen();
    let report = f.game.followups();
    assert.equal(report.evidenceComplete, true); assert.equal(report.coverage.reason, 'older-source-unavailable');
    assert.equal(Date.parse(report.coverage.floor), cutoff);
    assert.ok(report.items.every(r => Date.parse(r.sourceAt) > cutoff), 'no answer up to the floor anchors');
    f.at(3); const fresh = f.play('after-floor', { metadata: { difficulty: 2 } });
    report = f.game.followups();
    assert.ok(report.items.some(r => r.sourceAttemptId === fresh.answer.eventId), 'the next answer anchors at once');
    // 다음 접기가 바닥을 표에 굳히고 다시 어긋나지 않는다.
    f.at(4); for (let n = 30; n < 80; n++) f.play(`next-${n}`, { correct: true });
    const later = JSON.parse(f.storage.getItem(key));
    assert.equal(later.ledger.followups.floor, cutoff); assert.equal(later.ledger.followups.folded, later.ledger.folded);
  }
});

test('folding keeps complete source/target proof through d30 without keeping their entries, and a cycle ends after 45 days', () => {
  const f = fixture({ fold: { max: 40, keep: 20, ageMs: 1 } });
  const source = f.play('source', { after: 'explanation' });
  for (const day of [1, 7, 30]) { f.at(day); f.play(`target-${day}`, { correct: true, after: 'answer' }); }
  const expected = f.game.followups();
  f.at(31);
  for (let n = 0; n < 80; n++) f.play(`filler-${n}`, { correct: false });
  f.at(32); f.play('flush-trigger');
  const report = f.reopen().followups();
  assert.ok(report.coverage.folded > 0); assert.equal(report.items.length, 3);
  assert.deepEqual(report.items.map(r => [r.targetAttemptId, r.outcome, r.correctionEventIds]), expected.items.map(r => [r.targetAttemptId, r.outcome, r.correctionEventIds]));
  assert.equal(f.game.events().some(e => e.id === source.answer.eventId), false, 'no entry is held back for the rows');
  assert.ok(Buffer.byteLength([...f.values.values()].join('')) < 2 * 1024 * 1024);
  f.at(46);
  assert.deepEqual(f.game.followups().items, [], 'the cycle ended and nothing newer is more than 45 days after it');
  const next = f.play('next-cycle');
  assert.deepEqual(f.game.followups().items.map(r => r.sourceAttemptId), [next.answer.eventId, next.answer.eventId, next.answer.eventId]);
});

test('later encounters with an item or family fold without turning the frozen rows', () => {
  const f = fixture({ fold: { max: 40, keep: 20, ageMs: 1 } });
  const source = f.play('source', { correct: true, after: 'explanation' });
  f.at(1); const target = f.play('target', { correct: true });
  f.at(2);
  f.play('source-repeat', { help: 'answer', metadata: { familyKey: 'source' } });
  f.play('source-repeat', { metadata: { familyKey: 'linked-family' } });
  f.play('linked-next', { help: 'explanation', metadata: { familyKey: 'linked-family' } });
  f.play('target-repeat', { help: 'explanation', metadata: { familyKey: 'target' } });
  const before = f.game.followups();
  f.at(3);
  for (let n = 0; n < 30; n++) f.play(`filler-${n}`);
  f.at(4); f.play('fold-trigger'); f.reopen();
  assert.ok(f.game.followups().coverage.folded > 0);
  assert.equal(f.game.events().some(e => e.itemKey === 'target-repeat'), false, 'the encounters folded');
  assert.equal(row(f, 'd1').sourceAttemptId, source.answer.eventId);
  assert.equal(row(f, 'd1').targetAttemptId, target.answer.eventId);
  assert.equal(row(f, 'd1').outcome, 'independent-correct');
  assert.equal(row(f, 'd1').kind, 'retention');
  const pick = report => report.items.map(r => [r.id, r.kind, r.outcome, r.targetAttemptId, r.correctionEventIds]);
  assert.deepEqual(pick(f.game.followups()), pick(before));
});

test('an attempt and its completion reach the store in one call', () => {
  const f = fixture(), { answer } = f.play('source');
  const events = JSON.parse(f.storage.getItem(`${Game.KEY}.device`)).events, attempt = events.find(e => e.id === answer.eventId);
  const decision = events.find(e => e.id === attempt.presentationId).decisionId;
  assert.ok(events.some(e => e.type === 'experience.completed' && e.decisionId === decision), 'an unfinished earlier attempt never waits in the log');
});
