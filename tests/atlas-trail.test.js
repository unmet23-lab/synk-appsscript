'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../atlas/trail.js');
const scope = { domain: 'LAB', workspace: 'practice', subject: 'synthetic' };
const origin = Date.parse('2026-09-30T00:00:00Z');
const at = n => new Date(origin + n * 1000).toISOString();
function fixture(overrides = {}) {
  let n = 0;
  const events = [];
  const push = (type, fields) => {
    n += 1;
    const e = { schema: 1, id: `e${n}`, scope: { ...scope, ...overrides }, at: at(n), recordedAt: at(n), type, ...fields };
    if (T.TYPES.includes(type)) T.checkLink(events, e);
    events.push(e); return e;
  };
  const decision = (fields = {}) => push('decision.made', fields);
  const present = (fields = {}, decisionFields = {}) => push('practice.presented', { decisionId: decision(decisionFields).id, taskId: 'tense', taskVersion: 'v1', itemKey: 'hash1', conceptIds: ['tense.past'], firstExposure: true, ...fields });
  const help = (p, fields = {}) => push('practice.helped', { presentationId: p.id, helpId: 'review', level: 'cue', contentRef: 'hint.v1', ...fields });
  const attempt = (p, fields = {}) => push('practice.attempted', { presentationId: p.id, attemptNo: events.filter(e => e.type === 'practice.attempted' && e.presentationId === p.id).length + 1, verdict: 'correct', errorTags: [], ...fields });
  return { events, push, present, help, attempt, summary: options => T.summarize(events, { scope: { ...scope, ...overrides }, asOf: at(100), ...options }) };
}

test('independent evidence needs a verified first exposure; seen or unknown history never counts', () => {
  const f = fixture();
  const p = f.present(); f.attempt(p);
  const a = f.summary().attempts[0];
  assert.equal(a.independent, true); assert.equal(a.assisted, false); assert.equal(a.exposure, 'new');
  assert.equal(a.at, f.events.at(-1).at); assert.equal(a.recordedAt, f.events.at(-1).recordedAt);
  assert.equal(f.summary().presentations[0].firstExposure, true);
  const seen = fixture(); seen.attempt(seen.present({ firstExposure: false }));
  assert.deepEqual(['assisted', 'exposure', 'independent'].map(k => seen.summary().attempts[0][k]), [null, 'repeat', false]);
  const unknown = fixture(); unknown.attempt(unknown.present({ firstExposure: null }));
  assert.deepEqual(['assisted', 'exposure', 'independent'].map(k => unknown.summary().attempts[0][k]), [null, 'unknown', false]);
  assert.throws(() => T.validate({ ...p, answerText: 'private' }), /field/);
  assert.throws(() => T.validate({ ...p, conceptIds: ['a', 'a'] }), /presentation/);
  assert.throws(() => T.validate({ ...p, firstExposure: undefined }), /presentation/);
  const { firstExposure, ...legacy } = p;
  assert.throws(() => T.validate({ ...legacy, helpKnown: true }), /field/, 'the old ambiguous flag is not accepted');
});

test('cue/explanation/answer change assistance; no help after an attempt rewrites that attempt', () => {
  for (const level of ['cue', 'explanation', 'answer']) {
    const f = fixture(); const p = f.present(); f.help(p, { level }); f.attempt(p);
    const a = f.summary().attempts[0];
    assert.equal(a.assisted, true); assert.equal(a.independent, false);
    assert.equal(a.exposure, level === 'answer' ? 'repeat' : 'new');
  }
  const f = fixture(); const p = f.present(); f.attempt(p, { verdict: 'incorrect' }); f.help(p); f.attempt(p);
  assert.deepEqual(f.summary().attempts.map(a => [a.assisted, a.exposure, a.independent]), [[false, 'new', true], [true, 'repeat', false]]);
});

test('new presentation of an already attempted or revealed item is not independent transfer', () => {
  const f = fixture(); const p = f.present(); f.attempt(p); const q = f.present(); f.attempt(q);
  assert.equal(f.summary().attempts[1].independent, false); assert.equal(f.summary().attempts[1].exposure, 'repeat');
  const g = fixture(); const a = g.present(); g.help(a, { level: 'answer' }); const b = g.present(); g.attempt(b);
  assert.equal(g.summary().attempts[0].assisted, true); assert.equal(g.summary().attempts[0].exposure, 'repeat');
  const c = g.present({ itemKey: 'new-hash' }); g.attempt(c);
  assert.equal(g.summary().attempts[1].independent, true);
});

test('analytical exclusions cannot erase actual help exposure or prior attempts', () => {
  const f = fixture(); const p = f.present(); const h = f.help(p, { level: 'answer' });
  f.push('record.excluded', { targetId: h.id }); f.attempt(p);
  assert.equal(f.summary().help.length, 0); assert.equal(f.summary().attempts[0].independent, false);
  const g = fixture(); const a = g.present(); const first = g.attempt(a);
  g.push('record.excluded', { targetId: first.id }); const b = g.present(); g.attempt(b);
  const s = g.summary(); assert.equal(s.excludedAttempts, 1); assert.equal(s.attempts.length, 1);
  assert.equal(s.attempts[0].independent, false);
  g.push('record.excluded', { targetId: a.id });
  assert.equal(g.summary().attempts[0].independent, false);
});

test('causal links require same account/content, prior decision, and consecutive attempts', () => {
  const f = fixture(); const p = f.present(); const a = f.attempt(p);
  assert.equal(T.checkLink(f.events, a), a, 'idempotent copy is accepted');
  assert.throws(() => T.checkLink(f.events, { ...a, verdict: 'incorrect' }), /conflicting/);
  assert.throws(() => T.checkLink(f.events, { ...a, id: 'other', attemptNo: 3 }), /consecutive/);
  assert.throws(() => T.checkLink(f.events, { ...a, id: 'other', scope: { ...scope, subject: 'another' }, attemptNo: 2 }), /same scope/);
  assert.throws(() => T.checkLink(f.events, { ...a, id: 'other', scope: { ...scope, workspace: 'another' }, attemptNo: 2 }), /same scope/);
  assert.throws(() => T.checkLink([], p), /prior parent/);
  assert.throws(() => T.validate({ ...p, scope: { ...scope, domain: 'PULSE' } }), /scope/);
});

test('as-of and recorded-as-of cutoffs prevent future/late evidence and deduplicate exact retries', () => {
  const f = fixture(); const p = f.present(); const a = f.attempt(p);
  assert.equal(f.summary({ asOf: p.at }).attempts.length, 0);
  const late = f.events.map(e => e.id === a.id ? { ...e, recordedAt: at(20) } : e);
  assert.equal(T.summarize(late, { scope, asOf: at(30), recordedAsOf: at(10) }).attempts.length, 0);
  assert.equal(T.summarize([...f.events, a], { scope, asOf: at(30) }).attempts.length, 1);
  const foreign = fixture({ subject: 'other' }); const q = foreign.present(); foreign.help(q, { level: 'answer' });
  assert.equal(T.summarize([...foreign.events, ...f.events], { scope, asOf: at(30) }).attempts[0].independent, true);
});

test('skips and unassessed attempts cannot become independent success or failure', () => {
  const f = fixture(); const p = f.present({ conceptIds: [] }); f.attempt(p, { verdict: 'unassessed' });
  const q = f.present({ itemKey: 'another' }); f.attempt(q, { verdict: 'skipped' });
  assert.ok(f.summary().attempts.every(a => !a.independent));
  assert.deepEqual(f.summary().attempts.map(a => a.verdict), ['unassessed', 'skipped']);
});

test('excluding a decision hides its analytics, but its previously seen answer still affects later evidence', () => {
  const f = fixture(); const p = f.present(); f.help(p, { level: 'answer' }); f.attempt(p);
  f.push('record.excluded', { targetId: p.decisionId });
  const q = f.present(); f.attempt(q);
  const s = f.summary();
  assert.equal(s.presentations.length, 1); assert.equal(s.help.length, 0); assert.equal(s.attempts.length, 1);
  assert.equal(s.attempts[0].independent, false); assert.equal(s.attempts[0].assisted, true);
});

test('a late-recorded earlier hint remains earlier provenance and does not mutate the provided log', () => {
  const f = fixture(); const p = f.present(); f.attempt(p);
  f.help(p);
  const log = f.events.map(e => e.type === 'practice.helped' ? { ...e, at: p.at } : e);
  const original = JSON.stringify(log);
  const s = T.summarize(log, { scope, asOf: at(30) });
  assert.equal(s.attempts[0].assisted, true); assert.equal(s.attempts[0].independent, false);
  assert.equal(JSON.stringify(log), original);
});

test('each attempt carries the comparison arm recorded on its decision', () => {
  const f = fixture();
  f.attempt(f.present({}, { arm: 'baseline' }));
  f.attempt(f.present({ itemKey: 'hash2' }, { arm: 'adapted' }));
  f.attempt(f.present({ itemKey: 'hash3' }));
  assert.deepEqual(f.summary().attempts.map(a => a.arm), ['baseline', 'adapted', null]);
});

test('a stored history opens once: complete, partial or unreadable decide what a first exposure can be', () => {
  const r = { itemKey: 'old-item', conceptIds: ['tense.past'], at: '2026-09-20T00:00:00Z', verdict: 'incorrect' };
  const complete = T.openHistory({ records: [r], partial: false });
  assert.deepEqual([complete.firstExposure('old-item'), complete.firstExposure('new-item')], [false, true]);
  const partial = T.openHistory({ records: [r], partial: true });
  assert.deepEqual([partial.firstExposure('old-item'), partial.firstExposure('new-item')], [false, null]);
  for (const broken of [null, undefined, 'x', { records: [r] }, { records: [{ ...r, verdict: 'maybe' }], partial: false },
    { records: [r, r], partial: false }, { records: [{ ...r, itemKey: 'bad key' }], partial: false },
    { records: [{ ...r, answerText: 'private' }], partial: false }]) {
    const h = T.openHistory(broken);
    assert.equal(h.readable, false); assert.equal(h.firstExposure('old-item'), null); assert.equal(h.firstExposure('new-item'), null);
  }
  assert.equal(T.openHistory({ records: [], partial: false }).firstExposure('bad key'), null);
});

test('remember adds only items first met now, excluded or revealed ones included, without text or help', () => {
  const f = fixture();
  const a = f.present({ itemKey: 'a' }); f.attempt(a, { verdict: 'incorrect' }); f.attempt(a);
  const b = f.present({ itemKey: 'b' }); f.help(b, { level: 'answer' }); f.attempt(b);
  const c = f.present({ itemKey: 'c' }); f.help(c); // a cue alone is not meeting the item
  const d = f.present({ itemKey: 'old-item' }); f.attempt(d);
  const e = f.present({ itemKey: 'e' }); const hidden = f.attempt(e); f.push('record.excluded', { targetId: hidden.id });
  const s = f.summary();
  assert.deepEqual(s.met.map(m => [m.itemKey, m.verdict]), [['a', 'incorrect'], ['b', null], ['old-item', 'correct'], ['e', null]]);
  const old = { itemKey: 'old-item', conceptIds: ['tense.past'], at: '2026-09-20T00:00:00Z', verdict: 'incorrect' };
  const stored = T.remember(T.openHistory({ records: [old], partial: false }), s);
  assert.deepEqual(stored.records.map(m => m.itemKey), ['old-item', 'a', 'b', 'e']);
  assert.equal(stored.records[0].verdict, 'incorrect', 'an earlier record is never rewritten');
  assert.equal(stored.partial, false);
  assert.deepEqual(Object.keys(stored.records[1]).sort(), ['at', 'conceptIds', 'itemKey', 'verdict']);
  assert.equal(T.remember(T.openHistory(null), s), null, 'an unreadable store is never replaced');
  assert.equal(T.remember(T.openHistory({ records: [{ ...old, extra: 1 }], partial: false }), s), null, 'nor is one written in a newer format');
  assert.throws(() => T.remember(null, s), /open the history/);
  assert.throws(() => T.remember({ records: [{ ...old, answerText: 'private' }], partial: false }, s), /open the history/, 'a raw stored value is never trusted');
});

test('growth needs an earlier wrong first attempt and a new independent correct item on the same primary concept', () => {
  const before = '2026-09-20T00:00:00Z';
  const wrongBefore = { itemKey: 'old-item', conceptIds: ['tense.past'], at: before, verdict: 'incorrect' };
  const history = records => T.openHistory({ records, partial: false });
  const f = fixture(); const now = f.attempt(f.present({ itemKey: 'new-item' }));
  assert.deepEqual(T.growth(f.summary(), history([wrongBefore])), [{ conceptId: 'tense.past',
    before: { itemKey: 'old-item', at: before }, now: { attemptId: now.id, itemKey: 'new-item', at: now.at } }]);
  // No fact without every condition: right before, another concept, the same item, a later "before".
  for (const prior of [{ ...wrongBefore, verdict: 'correct' }, { ...wrongBefore, verdict: 'unassessed' }, { ...wrongBefore, verdict: null },
    { ...wrongBefore, conceptIds: ['tense.future'] }, { ...wrongBefore, itemKey: 'new-item' }, { ...wrongBefore, at: at(99) }]) {
    assert.deepEqual(T.growth(f.summary(), history([prior])), []);
  }
  // No fact when today's success was helped, seen before, unknown or wrong.
  for (const [present, help, verdict] of [[{}, true, 'correct'], [{ firstExposure: false }, false, 'correct'],
    [{ firstExposure: null }, false, 'correct'], [{}, false, 'incorrect']]) {
    const g = fixture(); const p = g.present({ itemKey: 'new-item', ...present });
    if (help) g.help(p); g.attempt(p, { verdict });
    assert.deepEqual(T.growth(g.summary(), history([wrongBefore])), []);
  }
  // One fact per concept, pointing at the most recent earlier error.
  const g = fixture(); g.attempt(g.present({ itemKey: 'a' })); g.attempt(g.present({ itemKey: 'b' }));
  const facts = T.growth(g.summary(), history([wrongBefore, { ...wrongBefore, itemKey: 'older', at: '2026-09-10T00:00:00Z' }]));
  assert.equal(facts.length, 1); assert.equal(facts[0].before.itemKey, 'old-item');
  assert.deepEqual(T.growth(g.summary(), T.openHistory(null)), [], 'an unreadable history tells nothing');
  assert.throws(() => T.growth({ attempts: [] }, history([])), /summary/);
  assert.throws(() => T.growth(g.summary(), { records: [wrongBefore], partial: false }), /open the history/);
});

test('pending records from an interrupted round count as met; an unreadable pending list makes the history partial', () => {
  const stored = { records: [{ itemKey: 'a', conceptIds: ['c1'], at: '2026-09-20T00:00:00Z', verdict: 'incorrect' }], partial: false };
  const pending = [{ itemKey: 'b', conceptIds: ['c1'], at: '2026-09-21T00:00:00Z', verdict: 'correct' },
    { itemKey: 'a', conceptIds: ['c1'], at: '2026-09-22T00:00:00Z', verdict: 'correct' }];
  const h = T.openHistory(stored, pending);
  assert.deepEqual([h.firstExposure('a'), h.firstExposure('b'), h.firstExposure('c')], [false, false, true]);
  assert.equal(h.records.find(r => r.itemKey === 'a').verdict, 'incorrect', 'the stored record wins over a pending duplicate');
  const f = fixture(); f.attempt(f.present({ itemKey: 'c' }));
  assert.deepEqual(T.remember(h, f.summary()).records.map(r => r.itemKey), ['a', 'b', 'c'], 'saving folds the pending records in');
  const broken = T.openHistory(stored, [{ itemKey: 'x' }]);
  assert.deepEqual([broken.readable, broken.partial, broken.firstExposure('a'), broken.firstExposure('c')], [true, true, false, null]);
  assert.equal(T.openHistory(stored, 'garbage').partial, true);
});

test('one session, two rounds: the round filter reports only its own attempts and growth never repeats a fact', () => {
  const wrongBefore = { itemKey: 'old', conceptIds: ['tense.past'], at: '2026-09-20T00:00:00Z', verdict: 'incorrect' };
  let stored = { records: [wrongBefore], partial: false };
  const f = fixture();
  const round = itemKey => {
    const history = T.openHistory(stored);
    const p = f.present({ itemKey, firstExposure: history.firstExposure(itemKey) }); f.attempt(p);
    const summary = f.summary({ decisions: [p.decisionId] });
    const facts = T.growth(summary, history);
    stored = T.remember(history, summary);
    return { summary, facts };
  };
  const one = round('a'), two = round('b');
  assert.deepEqual(one.facts.map(x => x.now.itemKey), ['a']);
  assert.deepEqual(two.facts.map(x => x.now.itemKey), ['b'], 'round two tells about b, not a again');
  assert.deepEqual(two.summary.attempts.map(a => a.itemKey), ['b']);
  assert.deepEqual(stored.records.map(r => r.itemKey), ['old', 'a', 'b']);
  // Growth with a history that already holds an item never tells about that item again.
  assert.deepEqual(T.growth(f.summary(), T.openHistory(stored)), []);
  // The filter hides earlier rounds from the report, never from what came before.
  const g = fixture(); const first = g.present({ itemKey: 'same' }); g.attempt(first);
  const again = g.present({ itemKey: 'same' }); g.attempt(again);
  const later = g.summary({ decisions: [again.decisionId] });
  assert.deepEqual(later.attempts.map(a => [a.exposure, a.independent]), [['repeat', false]]);
  assert.deepEqual(later.met.map(m => m.itemKey), ['same'], 'met covers the whole log');
  assert.throws(() => g.summary({ decisions: 'd1' }), /decision filter/);
});

test('a device clock stepping back cannot turn help or an earlier attempt into independent evidence', () => {
  const f = fixture(); const p = f.present(); f.help(p);
  // The cue was appended first, but the device clock now reads earlier than when it was shown.
  f.push('practice.attempted', { presentationId: p.id, attemptNo: 1, verdict: 'correct', errorTags: [], at: p.at, recordedAt: p.at });
  const a = f.summary().attempts[0];
  assert.deepEqual([a.assisted, a.exposure, a.independent], [true, 'new', false]);
  const g = fixture(); const q = g.present({ itemKey: 'k' }); g.attempt(q, { verdict: 'incorrect' }); g.help(q, { level: 'answer' });
  // The clock steps back to when q was first shown; the same item is shown again and answered.
  const early = { at: q.at, recordedAt: q.at };
  const r = g.present({ itemKey: 'k', ...early }, early);
  g.push('practice.attempted', { presentationId: r.id, attemptNo: 1, verdict: 'correct', errorTags: [], ...early });
  const later = g.summary().attempts.at(-1);
  assert.deepEqual([later.exposure, later.independent], ['repeat', false]);
  assert.equal(g.summary().met.find(m => m.itemKey === 'k').verdict, 'incorrect', 'the first attempt stays the first');
});
