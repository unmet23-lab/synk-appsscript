'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateMap } = require('../strata');
const { intermediateMap } = require('../strata/topik-ii');
const { buildMap, serialize, read, DESTINATION } = require('../tools/build-topik-ii');
const root = path.resolve(__dirname, '..');
const saved = require('../strata/maps/topik-ii.json');
const beginner = require('../strata/topik-i.skills.json');
const design = fs.readFileSync(path.join(root, 'docs/디자인/싱크타운_TOPIK4_학습설계와_원고.md'), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const sources = () => [read('strata/topik-i.skills.json'), read('strata/topik-ii.skills.json')];

test('the saved intermediate map is rebuilt byte for byte from its two sources', () => {
  assert.equal(serialize(buildMap()), fs.readFileSync(path.join(root, DESTINATION), 'utf8').replace(/\r\n/g, '\n'));
  assert.equal(validateMap(saved), true);
  assert.deepEqual(Object.keys(saved.sources).sort(), ['intermediate-taxonomy', 'practice-taxonomy']);
});

test('TOPIK I abilities are carried unchanged and no intermediate ability reuses one of their ids', () => {
  const map = intermediateMap();
  const carried = map.allNodes().filter(node => !node.stages).map(node => [node.id, node.domain, node.label_ko]);
  assert.deepEqual(carried, beginner.skills);
  const topikI = require('../strata/maps/topik-i.json').nodes.filter(node => node.kind === 'skill').map(node => node.id);
  assert.deepEqual(carried.map(([id]) => id), topikI);
  assert.equal(map.added().some(node => topikI.includes(node.id)), false);
  const [first, second] = sources();
  second.json.skills.push(['ko.reading.main', 'reading', '핵심을 중급으로', ['D'], [], ['D01']]);
  assert.throws(() => buildMap(first, second), /already a TOPIK I ability/);
});

test('the added abilities are the design\'s intermediate abilities and writing forms, each tied to its draft tasks and units', () => {
  const added = intermediateMap().added();
  assert.deepEqual(added.map(node => node.id), ['ko.listening.intent', 'ko.listening.long', 'ko.listening.inference',
    'ko.reading.inference', 'ko.reading.attitude', 'ko.reading.multi_source', 'ko.reading.context', 'ko.reading.structure', 'ko.reading.long',
    'ko.writing.note', 'ko.writing.sentence', 'ko.writing.data', 'ko.writing.opinion']);
  // §3 names T05, T06, T11-b, T12 and T13-T20 as needing new map items; every one is placed exactly once.
  const tasks = added.flatMap(node => node.design.tasks);
  assert.deepEqual([...tasks].sort(), ['T05', 'T06', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20']);
  for (const task of tasks) assert.match(design, new RegExp(`^### ${task} · `, 'm'), task);
  for (const unit of new Set(added.flatMap(node => node.design.units))) assert.match(design, new RegExp(`^\\| ${unit} \\|`, 'm'), unit);
});

test('no node carries a TOPIK grade, a score or learner data', () => {
  assert.equal(saved.nodes.every(node => node.level === null), true);
  assert.equal(saved.nodes.filter(node => node.stages).every(node => node.stages.every(stage => 'ABCD'.includes(stage))), true);
  const text = serialize(saved);
  for (const field of ['learner_id', 'student_id', 'score', 'grade', 'mastered', 'measured_at']) assert.equal(text.includes(`"${field}"`), false, field);
  assert.equal(saved.nodes.every(node => node.difficulty.measured === null && node.difficulty.n === 0), true);
});

test('draft prerequisites lower nothing to a block: a learner with no record still gets every intermediate candidate', () => {
  const map = intermediateMap();
  assert.equal(saved.edges.every(edge => edge.type === 'prerequisite' && edge.confidence === 'ai_draft' && edge.reviewed === false), true);
  const lines = map.added().map(node => ({ key: `need:skill.${node.id}`, source: 'observed', status: 'unconfirmed', usable: true }));
  const result = map.candidates({ lines }, { limit: 100 });
  assert.equal(result.length, 13);
  assert.equal(result.every(item => item.blocked_by.length === 0), true);
  assert.equal(result.find(item => item.id === 'ko.writing.opinion').advisory.join(), 'ko.reading.attitude,ko.writing.sentence');
});

test('leadsTo names the next intermediate abilities, stays deterministic and invents nothing for an unknown id', () => {
  const map = intermediateMap();
  assert.deepEqual(map.leadsTo('ko.listening.main').map(item => item.node.id), ['ko.listening.inference', 'ko.listening.intent', 'ko.listening.long']);
  assert.equal(map.leadsTo('ko.listening.main').every(item => item.blocking === false), true);
  assert.deepEqual(map.leadsTo('ko.listening.word'), []);
  assert.deepEqual(map.leadsTo('ko.reading.nope'), []);
  assert.deepEqual(map.leadsTo('ko.reading.main'), intermediateMap(copy(saved)).leadsTo('ko.reading.main'));
});

test('a cycle, an unknown endpoint or a stage outside A-D is refused at build time', () => {
  let [first, second] = sources();
  second.json.prerequisites.push(['ko.writing.opinion', 'ko.writing.note']);
  assert.throws(() => buildMap(first, second), /prerequisite cycle/);
  [first, second] = sources();
  second.json.prerequisites.push(['ko.speaking.free', 'ko.writing.note']);
  assert.throws(() => buildMap(first, second), /invalid edge endpoint/);
  [first, second] = sources();
  second.json.skills[0][3] = ['4급'];
  assert.throws(() => buildMap(first, second), /invalid stages/);
});
