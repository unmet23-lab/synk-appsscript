const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const Work = require('../atlas/work.js');
const catalog = [{ id: 'planning', label: '기획' }, { id: 'design', label: '디자인' }, { id: 'filming', label: '촬영' }];
const declaration = { skills: ['planning'], preferredTasks: ['design'], communication: 'async', workMode: 'solo', availableHours: 4, participates: true, confirmed: true };
function card(id, changes = {}) { return { id, name: id, shared: true, profile: { ...Work.normalizeProfile({ ...declaration, ...changes }, catalog), confirmedAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z' } }; }

test('Atlas work loads independently in CommonJS and browser without learning state or external capabilities', () => {
  assert.equal(Work.VERSION, 'atlas-work-1');
  const sandbox = {}; vm.runInNewContext(readFileSync(join(__dirname, '../atlas/work.js'), 'utf8'), sandbox);
  assert.deepEqual(Object.keys(sandbox), ['SynkAtlasWork']); assert.equal(sandbox.SynkAtlasWork.VERSION, Work.VERSION);
  assert.equal(typeof sandbox.SynkAtlasWork.evaluate, 'function');
});

test('profile input uses explicit confirmation and injected catalog only; descriptive personal data is rejected', () => {
  assert.throws(() => Work.normalizeProfile({ ...declaration, confirmed: false }, catalog), /본인이/);
  for (const input of [{ ...declaration, skills: ['MBTI-INTJ'] }, { ...declaration, personality: 'outgoing' }, { ...declaration, communication: 'introvert' }, { ...declaration, availableHours: -1 }, { ...declaration, availableHours: 3.2 }, { ...declaration, participates: 'true' }]) assert.throws(() => Work.normalizeProfile(input, catalog));
  assert.deepEqual(Work.normalizeProfile({ ...declaration, skills: ['planning', 'planning'] }, catalog).skills, ['planning']);
  const missing = Work.normalizeProfile({ skills: [], preferredTasks: [], participates: false, confirmed: true }, catalog);
  assert.deepEqual(Work.information(missing).missing, ['skills', 'preferredTasks', 'communication', 'workMode', 'availableHours']);
  assert.equal(Work.information({ ...missing, availableHours: 0 }).missing.includes('availableHours'), false, 'declared zero is information, not unknown');
});

test('manual selection preserves order, deduplicates people and skills, and never includes a stronger unselected card', () => {
  const cards = [card('a'), card('b'), card('not-selected', { skills: ['planning', 'design', 'filming'], availableHours: 80 })];
  const before = JSON.stringify(cards), result = Work.evaluate({ requiredSkills: ['planning', 'planning', 'design'], memberIds: ['b', 'a', 'b'], minAvailableHours: 4 }, cards, catalog);
  assert.deepEqual(result.selected.map(person => person.id), ['b', 'a']); assert.equal(result.coverage.length, 2); assert.deepEqual(result.coverage[0].memberIds, ['b', 'a']); assert.deepEqual(result.missingSkills, ['design']);
  assert.equal(JSON.stringify(cards), before); assert.equal(result.metadata.automaticSelection, false); assert.equal(result.metadata.automaticAssignment, false);
  assert.equal(Object.hasOwn(result, 'score'), false); assert.equal(Object.hasOwn(result, 'rank'), false);
  assert.throws(() => Work.evaluate({ requiredSkills: ['planning'], memberIds: [], minAvailableHours: 0 }, cards, catalog));
});

test('zero hours, missing hours and low hours remain selected and are distinguished without filling unknown collaboration', () => {
  const cards = [card('zero', { availableHours: 0 }), card('unknown', { availableHours: null, communication: null, workMode: null }), card('low', { availableHours: 1, communication: 'live', workMode: 'pair' })];
  const result = Work.evaluate({ requiredSkills: ['planning'], memberIds: cards.map(person => person.id), minAvailableHours: 2 }, cards, catalog);
  assert.equal(result.selected.length, 3); assert.deepEqual(result.availability.map(item => item.status), ['zero', 'unknown', 'insufficient']); assert.equal(result.availability[1].shortfall, null); assert.equal(result.availability[1].meetsMinimum, null);
  assert.equal(result.collaboration.communication.unknown, 1); assert.equal(result.collaboration.communication.flexible, 0); assert.equal(result.collaboration.workMode.unknown, 1); assert.equal(result.complete, false);
  const noMinimum = Work.evaluate({ requiredSkills: ['planning'], memberIds: ['zero', 'unknown'], minAvailableHours: 0 }, cards, catalog);
  assert.deepEqual(noMinimum.availability.map(item => item.status), ['zero', 'unknown']); assert.equal(noMinimum.availability[0].meetsMinimum, true); assert.equal(noMinimum.complete, false);
});

test('unshared, unconfirmed and unsupported-schema cards cannot be evaluated', () => {
  const input = { requiredSkills: ['planning'], memberIds: ['a'], minAvailableHours: 1 };
  for (const value of [{ ...card('a'), shared: false }, card('a', { participates: false }), { ...card('a'), profile: { ...card('a').profile, confirmedAt: null } }, { ...card('a'), profile: { ...card('a').profile, schemaVersion: 2 } }]) assert.throws(() => Work.evaluate(input, [value], catalog));
  assert.throws(() => Work.evaluate({ ...input, requiredSkills: ['personality'] }, [card('a')], catalog));
});
