'use strict';
// TOPIK II 연습 지도와 공식 유형 대응표(strata/topik-types.json)의 짜임을 본다(2026-10-20).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateMap } = require('../strata');

const root = path.resolve(__dirname, '..');
const topik2 = require('../strata/maps/topik-ii.json');
const topik1 = require('../strata/maps/topik-i.json');
const types = require('../strata/topik-types.json');

test('TOPIK II map: fifteen abilities, listening 5 · reading 7 · writing 3, ids that carry their domain', () => {
  assert.equal(validateMap(topik2), true);
  const skills = topik2.nodes.filter(node => node.kind === 'skill');
  assert.equal(skills.length, 15);
  const count = domain => skills.filter(node => node.domain === domain).length;
  assert.deepEqual([count('listening'), count('reading'), count('writing')], [5, 7, 3]);
  for (const node of skills) {
    // WORLD reads the domain from the second segment (world-position.mjs); TOPIK I's /^ko\./ must not match.
    assert.match(node.id, /^ko2\.(listening|reading|writing)\.[a-z]+$/);
    assert.equal(node.id.split('.')[1], node.domain);
    assert.equal(node.level, null);
  }
  assert.ok(topik2.map_ver.startsWith('topik-ii-practice-1-'));
  assert.deepEqual(topik2.edges, []);
});

test('maps and game copies are what the generator makes (--check)', () => {
  const run = spawnSync(process.execPath, [path.join(root, 'tools/build-game-learning.js'), '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /verified strata[\\/]maps[\\/]topik-ii\.json/);
});

const skillIds = exam => new Set((exam === 'topik-i' ? topik1 : topik2).nodes.filter(node => node.kind === 'skill').map(node => node.id));

test('every official type points at abilities of its own exam (or a named pending one)', () => {
  const pending = new Set(Object.keys(types.pending || {}));
  for (const id of pending) assert.equal(skillIds('topik-i').has(id) || skillIds('topik-ii').has(id), false, `${id} is in a map: drop it from pending`);
  const ids = new Set();
  for (const type of types.types) {
    assert.equal(ids.has(type.id), false, `duplicate ${type.id}`); ids.add(type.id);
    assert.ok(['topik-i', 'topik-ii'].includes(type.exam));
    assert.ok(Array.isArray(type.skills) && type.skills.length, type.id);
    for (const skill of type.skills) {
      assert.ok(skillIds(type.exam).has(skill) || pending.has(skill), `${type.id} → ${skill}`);
      if (type.section !== 'writing') assert.equal(skill.split('.')[1], type.section, `${type.id} → ${skill}`);
    }
  }
  // A set is two or three questions on one script or passage: same exam and section, consecutive numbers,
  // named after its first and last number.
  const sets = new Map();
  for (const type of types.types.filter(t => t.set)) { if (!sets.has(type.set)) sets.set(type.set, []); sets.get(type.set).push(type); }
  for (const [name, members] of sets) {
    assert.ok(members.length >= 2 && members.length <= 3, name);
    assert.equal(new Set(members.map(m => `${m.exam}/${m.section}`)).size, 1, name);
    const numbers = members.flatMap(m => m.numbers).sort((a, b) => a - b), lo = numbers[0], hi = numbers.at(-1);
    assert.equal(name, `${members[0].id.split('-').slice(0, 2).join('-')}-${String(lo).padStart(2, '0')}-${String(hi).padStart(2, '0')}`);
    assert.equal(hi - lo + 1, members.reduce((n, m) => n + m.numbers[1] - m.numbers[0] + 1, 0), name);
  }
});

test('official numbers are covered exactly once per exam and section', () => {
  const ranges = { 'topik-i': { listening: [1, 30], reading: [31, 70] }, 'topik-ii': { listening: [1, 50], reading: [1, 50], writing: [51, 54] } };
  for (const [exam, sections] of Object.entries(ranges)) for (const [section, [from, to]] of Object.entries(sections)) {
    const seen = new Map();
    for (const type of types.types.filter(t => t.exam === exam && t.section === section)) {
      for (let n = type.numbers[0]; n <= type.numbers[1]; n++) {
        assert.equal(seen.has(n), false, `${exam} ${section} ${n}: ${seen.get(n)} and ${type.id}`); seen.set(n, type.id);
      }
    }
    for (let n = from; n <= to; n++) assert.ok(seen.has(n), `${exam} ${section} ${n} has no type`);
    assert.equal(seen.size, to - from + 1);
  }
});

test('listening play counts follow the official rule: TOPIK I twice; TOPIK II once for 1~20, twice for 21~50', () => {
  for (const type of types.types.filter(t => t.section === 'listening')) {
    const expected = type.exam === 'topik-i' ? 2 : type.numbers[1] <= 20 ? 1 : 2;
    assert.equal(type.plays, expected, type.id);
    assert.ok(/audio/.test(type.media), type.id);
  }
  for (const type of types.types.filter(t => t.section !== 'listening')) assert.equal(type.plays, undefined, type.id);
});
