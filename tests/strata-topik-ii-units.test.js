'use strict';
// TOPIK 3→4급 뼈대의 문형 층(strata/topik-ii.grammar.json)과 단원 원천(strata/topik-ii.units.json)의 짜임을 본다(2026-11-02).
// 원자료 엑셀과의 대조(등급 · 번호 · 대표형)는 저장소 밖 파일이 있어야 해서 tools/build-topik-ii-grammar.py --check가 맡는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const layer = require('../strata/topik-ii.grammar.json');
const units = require('../strata/topik-ii.units.json');
const bank = require('../strata/grammar-bank.json').GRAMMAR_BANK;
const topik2 = require('../strata/maps/topik-ii.json');
const types = require('../strata/topik-types.json').types;

const points = new Map(layer.points.map(point => [point[0], point]));
const bankIds = new Set(bank.map(row => row[0]));

test('grammar layer: the standard list grades 3 and 4, 67 each, ids from grade and per-grade number', () => {
  assert.deepEqual(layer.fields, ['id', 'form', 'related', 'level', 'category', 'meaning', 'bank']);
  assert.equal(points.size, 134);
  for (const level of [3, 4]) assert.equal(layer.points.filter(point => point[3] === level).length, 67);
  for (const [id, form, related, level] of layer.points) {
    assert.match(id, /^S[34]\d{2}$/);
    assert.equal(Number(id[1]), level);
    assert.ok(form && Array.isArray(related), id);
  }
  assert.match(layer.standard.sha256, /^[0-9a-f]{64}$/);
});

test('bank links point at real bank rows, one official item per bank row', () => {
  const linked = layer.points.filter(point => point[6]).map(point => point[6]);
  assert.equal(linked.length, new Set(linked).size);
  for (const id of linked) assert.ok(bankIds.has(id), id);
  for (const [id, , level] of layer.bank_elsewhere) {
    assert.ok(bankIds.has(id), id);
    assert.equal(linked.includes(id), false, `${id} is both linked and listed elsewhere`);
    assert.ok(level === null || /^[1-6]급$/.test(level), id);
  }
  // 은행이 3~5단계에 둔 문형은 공식 3 · 4급 짝이 있거나, 없다는 것(공식 급 · 목록 밖)이 적혀 있어야 한다.
  const elsewhere = new Set(layer.bank_elsewhere.map(row => row[0]));
  for (const [id, , , step] of bank) if (step >= 3 && step <= 5) assert.ok(linked.includes(id) || elsewhere.has(id), `${id} is neither linked nor listed elsewhere`);
});

test('units: U13~U16 first, grammar from the layer at the unit level (review from below, again from an earlier unit)', () => {
  assert.deepEqual(units.units.map(unit => unit.id), ['U13', 'U14', 'U15', 'U16']);
  assert.equal(units.reviewed, false);
  const seen = new Set();
  for (const unit of units.units) {
    assert.equal(unit.level, 4);
    assert.ok(unit.grammar.length >= 2 && unit.grammar.length <= 5, unit.id);
    for (const item of unit.grammar) {
      const point = points.get(item.id);
      assert.ok(point, `${unit.id} ${item.id}`);
      assert.equal(point[1], item.form, `${unit.id} ${item.id}`);
      if (item.review) assert.ok(point[3] < unit.level, `${unit.id} ${item.id} review must come from a lower grade`);
      else assert.equal(point[3], unit.level, `${unit.id} ${item.id}`);
      assert.equal(Boolean(item.again), !item.review && seen.has(item.id), `${unit.id} ${item.id} again marks exactly the repeats`);
    }
    assert.ok(unit.grammar.some(item => !item.review && !item.again), `${unit.id} needs a new item of its own grade`);
    for (const item of unit.grammar) seen.add(item.id);
  }
});

test('units: words carry an official grade and per-grade number, skills and types exist in TOPIK II', () => {
  const skills = new Set(topik2.nodes.filter(node => node.kind === 'skill').map(node => node.id));
  const ii = new Map(types.filter(type => type.exam === 'topik-ii').map(type => [type.id, type]));
  for (const unit of units.units) {
    assert.ok(unit.words.length >= 12, unit.id);
    assert.equal(new Set(unit.words.map(word => word.word)).size, unit.words.length, unit.id);
    for (const word of unit.words) {
      assert.match(word.level, /^[1-6]$/);
      // 단원의 새 낱말은 3 · 4급, 1 · 2급은 복습 표시를 단다.
      assert.equal(Boolean(word.review), Number(word.level) < 3, `${unit.id} ${word.word}`);
      assert.ok(Number(word.level) <= 4, `${unit.id} ${word.word} is above grade 4`);
      assert.ok(Number.isInteger(word.no) && word.no > 0, `${unit.id} ${word.word}`);
    }
    for (const skill of unit.skills) assert.ok(skills.has(skill), `${unit.id} ${skill}`);
    for (const id of unit.topik_types) assert.ok(ii.has(id), `${unit.id} ${id}`);
  }
});

test('units: course weeks exist in the online class, dream beats are the agreed three, containers keep one shape', () => {
  const writing = fs.readFileSync(path.join(root, 'docs/온라인반_TOPIK4급/쓰기과제.md'), 'utf8');
  const keys = ['drama', 'cafe', 'club', 'reading', 'listening', 'writing'];
  for (const unit of units.units) {
    if (unit.course) assert.ok(writing.includes(`<a id="${unit.course.writing.toLowerCase()}"></a>`), `${unit.id} ${unit.course.writing}`);
    if (unit.dream) {
      assert.ok(['pr', 'schedule', 'opinion'].includes(unit.dream.beat), unit.id);
      assert.ok(unit.dream.idol && unit.dream.actor, unit.id);
    }
    assert.deepEqual(Object.keys(unit.containers), keys, unit.id);
    assert.ok(unit.measure.B && unit.measure.C, unit.id);
  }
});
