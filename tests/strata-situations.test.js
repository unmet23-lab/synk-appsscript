'use strict';
// A declared learning reason leads to situations (Strata links.goals), sourced from the
// learning-reasons contract; Vellum names the situation beside practice picked for it, and the
// account summary carries both to other SYNK products. Reasons never move difficulty or a level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMap, validateMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const source = require('../strata/topik-i.situations.json');
const contract = require('../계약/배우는이유_선택응답_계약.json');
const raw = require('../strata/maps/topik-i.json');
const { situationLine } = require('../atlas/vellum');
const { summarizeAccount } = require('../atlas/account-summary');

const map = createMap(topikMap({ includeWords: false }));
const asOf = '2026-10-03T12:00:00.000Z';

test('each reason\'s situations are the contract\'s 상황 pieces, in its order, under ids that do not change', () => {
  assert.equal(source.contract_ver, contract.판, 'the situations follow the contract version they were made from');
  const values = contract.배우는이유.보기.map(option => option.값);
  assert.deepEqual(Object.keys(source.without_situations).sort(), ['exam', 'hobby', 'other']);
  for (const option of contract.배우는이유.보기) {
    const mine = source.situations.filter(([, reason]) => reason === option.값);
    if (Object.hasOwn(source.without_situations, option.값)) { assert.equal(mine.length, 0, option.값); continue; }
    assert.deepEqual(mine.map(([, , label]) => label), option.상황.split(', '), `${option.값}: 계약 「상황」과 같은 조각·순서`);
  }
  assert.ok(source.situations.every(([, reason]) => values.includes(reason)), 'only reasons the contract has');
  const ids = source.situations.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^sit-[a-z]+(-[a-z]+)+$/.test(id)), 'situation ids are sit-…');
  assert.ok(source.situations.every(([, , , when]) => typeof when === 'string' && when.trim() && !/[.。]$/.test(when)));
});

test('the map leads a reason to its situations; other reasons and unknown goals lead nowhere', () => {
  assert.deepEqual(map.forGoal('travel').map(n => n.id), ['sit-travel-directions', 'sit-travel-order', 'sit-travel-transport', 'sit-travel-lodging', 'sit-travel-shopping']);
  assert.deepEqual(map.forGoal('life').map(n => n.label_ko), ['주민센터·병원·은행', '공공 안내문 읽기']);
  for (const goal of ['exam', 'hobby', 'other', 'study_abroad', '']) assert.deepEqual(map.forGoal(goal), [], goal);
  const situations = map.allNodes().filter(n => n.kind === 'situation');
  assert.equal(situations.length, source.situations.length);
  assert.ok(situations.every(n => n.level === null), 'a situation is where practice happens, not a level');
  assert.ok(raw.edges.every(e => !e.from.startsWith('sit-') && !e.to.startsWith('sit-')), 'no ability or prerequisite edges to situations');
  assert.ok(raw.links.goals.every(link => link.confidence === 'authored' && link.reviewed === true
    && link.source_refs.every(ref => ref.source === 'practice-situations')), 'the grouping is the approved contract');
  assert.equal(raw.sources['practice-situations'].path, 'strata/topik-i.situations.json');
});

test('a map refuses goal links that lead to unknown nodes, repeat a goal or lack evidence', () => {
  const broken = mutate => { const data = structuredClone(raw); mutate(data); return () => validateMap(data); };
  assert.throws(broken(d => { d.links.goals[0].nodes.push('sit-nowhere'); }), /goal must lead to known nodes/);
  assert.throws(broken(d => { d.links.goals.push(structuredClone(d.links.goals[0])); }), /duplicate goal/);
  assert.throws(broken(d => { d.links.goals[0].nodes = []; }), /goal must lead to known nodes/);
  assert.throws(broken(d => { delete d.links.goals[0].reviewed; }), /invalid evidence status/);
  assert.throws(broken(d => { d.links.goals[0].source_refs = [{ source: 'nowhere', selector: 'travel' }]; }), /unknown source reference/);
  assert.throws(broken(d => { d.nodes.find(n => n.kind === 'skill').when_ko = '주문할 때'; }), /invalid situation words/);
  const none = structuredClone(raw); delete none.links.goals;
  assert.equal(validateMap(none), true, 'a map without goal links stays valid');
  assert.deepEqual(createMap(none).forGoal('travel'), []);
});

test('Vellum names the situation in the reason line, and nothing else', () => {
  assert.equal(situationLine({ when: '주문할 때' }), '주문할 때 쓰는 말이라 골랐어요.');
  assert.equal(situationLine({ when: '주민센터·병원·은행에서' }), '주민센터·병원·은행에서 쓰는 말이라 골랐어요.');
  for (const when of [undefined, '', '  ', 3]) assert.throws(() => situationLine({ when }), /invalid situation line/);
});

test('the account summary carries each declared reason\'s situations; a reason without them claims nothing', () => {
  const summary = summarizeAccount({ events: [], map, asOf, reasons: ['travel', 'exam', 'other'] });
  assert.deepEqual(summary.forReasons.map(r => r.reason), ['travel'], 'exam·other lead to no situation');
  assert.deepEqual(summary.forReasons[0].situations[1], { id: 'sit-travel-order', label: '주문', line: '주문할 때 쓰는 말이라 골랐어요.' });
  assert.deepEqual(summarizeAccount({ events: [], map, asOf }).forReasons, [], 'no declared reason, no situation');
  assert.deepEqual(summarizeAccount({ events: [], map, asOf, reasons: ['hobby'] }).forReasons, []);
  // An older map without goal links (or a host's own map) gives the same summary as before.
  const plain = structuredClone(raw); delete plain.links.goals;
  assert.deepEqual(summarizeAccount({ events: [], map: createMap(plain), asOf, reasons: ['travel'] }).forReasons, []);
  // Reasons are a declaration: they do not turn into practice evidence, an ability or a grade.
  assert.equal(summary.basis, 'self-declared');
  assert.deepEqual(summary.practice.skills, []);
  assert.deepEqual([summary.abilityClaim, summary.learningEffectClaim, summary.grade], [false, false, null]);
});
