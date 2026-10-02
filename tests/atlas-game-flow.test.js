'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap } = require('../strata');
const curriculum = require('../strata/maps/topik-i.json');
const learning = require('../atlas/game-learning');
const { localDay } = require('../atlas/game-flow');

const map = createMap(curriculum);
const memoryStorage = () => { const data = new Map(); return { data, getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; };
const clockFrom = start => { let t = Date.parse(start); return () => new Date(t += 1000).toISOString(); };
const SPEC = { id: 'test.cafe.rush', items: { levels: [1, 2, 3], weight: 2 }, knobs: [
  { id: 'patience', kind: 'pace', values: [60, 52, 45, 38, 32], start: 2 },
  { id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 1 }] };
let serial = 0;
const item = (difficulty = 1, skill = 'ko.listening.detail') => {
  const id = `cafe-${++serial}`;
  return { id, itemKey: `${id}:v1`, skillId: skill, difficulty, modality: skill.split('.')[1], responseFormat: 'cup-compose', audioRequired: false };
};

test('a game uses the challenge in a few lines; settings move with responses and are kept with each decision', () => {
  const storage = memoryStorage(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const coach = learning.createGame({ gameId: 'order-rush', map, storage, clock });
  const live = coach.live(SPEC);
  assert.deepEqual(live.settings().values, { 'item.difficulty': 1, patience: 45, hint: 'normal' });
  const lines = [];
  for (let i = 0; i < 10; i += 1) {
    const pid = live.present(item(live.settings().level));
    const out = live.answer(pid, { correct: true, assessable: true }, { pressure: 0.3 });
    if (out.line) lines.push(out.line.text);
  }
  assert.ok(lines.length >= 2, 'quiet successes made the content harder, and each change has a sentence');
  const decisions = coach.events().filter(e => e.type === 'decision.made');
  assert.equal(decisions.at(-1).candidateSnapshot[0].flow.content, 'test.cafe.rush');
  assert.ok(decisions.at(-1).candidateSnapshot[0].flow.values.patience, 'the settings in force are reviewable later');
  const stored = JSON.parse(storage.getItem(`${learning.KEY}.device.flow`));
  assert.equal(stored.contents['test.cafe.rush'].v, 2);
});

test('the challenge never changes what Trail counts as independent learning evidence', () => {
  const run = withFlow => {
    const coach = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock: clockFrom('2026-10-02T09:00:00.000Z') });
    const live = withFlow ? coach.live(SPEC) : null;
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      const it = { ...item(1), id: `same-${i}`, itemKey: `same-${i}:v1` };
      const pid = withFlow ? live.present(it) : coach.present(it);
      if (i === 2) coach.help(pid, 'hint');
      const answer = { correct: i % 3 !== 1, assessable: true };
      results.push(withFlow ? live.answer(pid, answer).recorded : coach.answer(pid, answer));
    }
    return results.map(r => [r.verdict, r.independent, r.assisted]);
  };
  assert.deepEqual(run(true), run(false));
});

test('help shown before an answer never raises the challenge; Trail decides what was assisted', () => {
  const coach = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock: clockFrom('2026-10-02T09:00:00.000Z') });
  const live = coach.live(SPEC);
  for (let i = 0; i < 12; i += 1) {
    const pid = live.present(item(1));
    coach.help(pid, 'text');
    const out = live.answer(pid, { correct: true, assessable: true }, { pressure: 0.2 });
    assert.equal(out.recorded.assisted, true);
    assert.ok(!out.change || out.change.direction < 0);
  }
});

test('a response without an answer (audio failed, nothing chosen) moves nothing unless the content names it', () => {
  const coach = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock: clockFrom('2026-10-02T09:00:00.000Z') });
  const live = coach.live(SPEC);
  const before = live.settings().indices;
  for (let i = 0; i < 6; i += 1) {
    const pid = live.present(item(1));
    const out = live.answer(pid, { correct: null, assessable: false, reason: 'audio' });
    assert.equal(out.evidence, false);
    assert.equal(out.change, null);
  }
  assert.deepEqual(live.settings().indices, before);
});

test('a missed customer eases time without counting as a language error', () => {
  const coach = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock: clockFrom('2026-10-02T09:00:00.000Z') });
  const live = coach.live(SPEC);
  const pid = live.present(item(1));
  const out = live.answer(pid, { correct: null, assessable: false, reason: 'unanswered' }, { outcome: 'timeout' });
  assert.equal(out.recorded.verdict, 'unassessed');
  assert.equal(out.change.kind, 'pace');
  assert.equal(out.settings.values.patience, 52);
});

test('memory resumes on the next visit; another content starts from independent practice elsewhere', () => {
  const storage = memoryStorage(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const first = learning.createGame({ gameId: 'g', map, storage, clock });
  const live = first.live(SPEC);
  for (let i = 0; i < 12; i += 1) { const pid = live.present(item(live.settings().level)); live.answer(pid, { correct: true, assessable: true }, { pressure: 0.3 }); }
  const reached = live.settings().indices;
  const second = learning.createGame({ gameId: 'g', map, storage, clock });
  const again = second.live(SPEC);
  assert.equal(again.intro().code, 'start.memory');
  assert.deepEqual(again.settings().indices, reached);
  assert.equal(again.intro().line.text, '지난번에 하던 데서 이어 갈게요.');
  // Five independent first answers at level 1 in another game, in the same response format.
  const reading = second.live({ id: 'test.reading.gate', items: { levels: [1, 2, 3] }, knobs: [{ id: 'choices', values: [2, 3, 4], start: 1 }] }, { skillIds: ['ko.reading.detail'] });
  assert.equal(reading.intro().code, 'start.default', 'no reading practice yet: the content default');
  for (let i = 0; i < 5; i += 1) {
    const pid = second.present({ ...item(1, 'ko.reading.detail'), responseFormat: 'single-choice' });
    second.answer(pid, { correct: true, assessable: true });
  }
  const other = second.live({ id: 'test.reading.gate2', items: { levels: [1, 2, 3] }, knobs: [{ id: 'choices', values: [2, 3, 4], start: 1 }] }, { skillIds: ['ko.reading.detail'] });
  assert.equal(other.intro().code, 'start.prior');
  assert.equal(other.settings().level, 2);
  assert.equal(other.intro().line.text, '다른 연습 기록에 맞춰 시작할게요.');
});

test("today's condition lasts for the local day and reset clears every trace of the challenge", () => {
  const storage = memoryStorage();
  let now = Date.parse('2026-10-02T03:00:00.000Z');
  const clock = () => new Date(now += 1000).toISOString();
  const coach = learning.createGame({ gameId: 'g', map, storage, clock });
  assert.equal(coach.today(), null);
  coach.setToday('tired');
  assert.equal(coach.today(), 'tired');
  assert.equal(coach.live(SPEC).intro().code, 'start.tired');
  assert.throws(() => coach.setToday('sad'), /invalid condition/);
  now += 2 * 86400000;
  assert.equal(coach.today(), null, 'a condition never carries into another day');
  assert.notEqual(localDay(new Date(now).toISOString()), localDay('2026-10-02T03:00:00.000Z'));
  coach.setToday('good');
  coach.live(SPEC).observe({ outcome: 'success', pressure: 0.2 });
  coach.reset();
  assert.equal(storage.getItem(`${learning.KEY}.device.flow`), null);
  assert.equal(storage.getItem(`${learning.KEY}.device.today`), null);
});

test('when the challenge picks another item, the reason shown is that item\'s own', () => {
  const coach = learning.createGame({ gameId: 'g', map, storage: memoryStorage(), clock: clockFrom('2026-10-02T09:00:00.000Z') });
  // Set by hand to the second level; Core's priority alone would start with the plain item.
  const live = coach.live(SPEC, { declared: { knobs: { 'item.difficulty': 1 } } });
  const plain = { ...item(1, 'ko.listening.detail'), skillIds: ['ko.listening.detail'] };
  const harder = { ...item(2, 'ko.listening.negation'), skillIds: ['ko.listening.negation'] };
  const top = coach.recommend([plain, harder]);
  assert.equal(top.selected, plain);
  const picked = live.pick([plain, harder]);
  assert.equal(picked.selected, harder);
  assert.equal(picked.flowLevel, 2);
  const own = coach.recommend([harder]);
  assert.equal(picked.focusSkillId, 'ko.listening.negation');
  assert.equal(picked.reason, own.reason);
  assert.deepEqual(picked.alternatives, [plain]);
});

test('a reset in one tab is not undone by a round still open in another', () => {
  const storage = memoryStorage(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const here = learning.createGame({ gameId: 'g', map, storage, clock });
  const there = learning.createGame({ gameId: 'g', map, storage, clock });
  const open = there.live(SPEC);
  for (let i = 0; i < 6; i += 1) open.observe({ outcome: 'success', pressure: 0.2 });
  assert.ok(JSON.parse(storage.getItem(`${learning.KEY}.device.flow`)).contents[SPEC.id]);
  here.reset();
  open.observe({ outcome: 'success', pressure: 0.2 });
  open.declineLessHelp();
  open.end();
  const stored = JSON.parse(storage.getItem(`${learning.KEY}.device.flow`) || 'null');
  assert.ok(!stored || (!stored.contents[SPEC.id] && !stored.declined[SPEC.id]), 'nothing from before the reset was written back');
  assert.equal(here.live(SPEC).intro().code, 'start.default');
  // A round begun after the reset remembers again.
  const fresh = there.live(SPEC);
  fresh.observe({ outcome: 'success', pressure: 0.2 });
  assert.ok(JSON.parse(storage.getItem(`${learning.KEY}.device.flow`)).contents[SPEC.id]);
});

test('less help is offered after quiet successes, accepted one step at a time, and a no is remembered', () => {
  const storage = memoryStorage(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const coach = learning.createGame({ gameId: 'g', map, storage, clock });
  const HELP = { id: 'test.help', items: { levels: [1, 2, 3] }, knobs: [{ id: 'hint', kind: 'support', values: ['early', 'normal', 'late'], start: 0 }] };
  const three = live => { for (let i = 0; i < 3; i += 1) { const pid = live.present(item(1)); live.answer(pid, { correct: true, assessable: true }); } };
  // Offers wait for a calm moment: not in the response that just changed something. Only real
  // answers count toward that pause; a skipped one does not.
  const calm = live => { for (let i = 0; i < 6 && !live.offerLessHelp().offer; i += 1) { const pid = live.present(item(1)); live.answer(pid, { correct: true, assessable: true }); } };
  const visit = coach.live(HELP);
  three(visit); calm(visit);
  assert.deepEqual(visit.offerLessHelp(), { offer: true, from: 0, to: 1, reason: 'quiet-streak' });
  visit.declineLessHelp();
  const next = coach.live(HELP);
  three(next);
  assert.equal(next.offerLessHelp().reason, 'declined-recently', 'a no keeps the offer quiet for two weeks');
  const later = learning.createGame({ gameId: 'g', map, storage, clock: clockFrom('2026-10-20T09:00:00.000Z') }).live(HELP);
  three(later); calm(later);
  assert.equal(later.offerLessHelp().offer, true);
  const accepted = later.acceptLessHelp();
  assert.equal(accepted.because, 'accepted-less-help');
  assert.equal(accepted.line.text, '말씀하신 대로 도움을 조금 늦게 보여 드릴게요.');
  assert.equal(later.settings().values.hint, 'normal');
});

test('a game passes the settings the person chose; a lock the content set for itself still wins', () => {
  const storage = memoryStorage(), clock = clockFrom('2026-10-02T09:00:00.000Z');
  const coach = learning.createGame({ gameId: 'g', map, storage, clock });
  assert.equal(coach.live(SPEC, { presentation: { support: 'step' } }).settings().values.hint, 'early');
  assert.equal(coach.live(SPEC, { presentation: { support: 'independent' } }).settings().values.hint, 'late');
  assert.equal(coach.live(SPEC, { presentation: { support: 'choose' } }).settings().values.hint, 'normal');
  assert.equal(coach.live(SPEC, { presentation: { support: 'step' }, declared: { knobs: { hint: 2 } } }).settings().values.hint, 'late');
  assert.equal(coach.live(SPEC, { presentation: { support: 'step' }, declared: { mode: 'fixed' } }).settings().mode, 'fixed');
  assert.throws(() => coach.live(SPEC, { presentation: { minutes: 5 } }), /presentation accepts only/);
});
