'use strict';
// The unit source enters the existing Strata/Core/Trail path without changing default maps or storage.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { createMap, validateMap } = require('../strata');
const { buildUnitMap, unitPath, CONTAINERS } = require('../strata/topik-ii');
const Game = require('../atlas/game-learning');
const base = require('../strata/maps/topik-ii.json');
const saved = require('../strata/maps/topik-ii-units.json');
const units = require('../strata/topik-ii.units.json');
const grammar = require('../strata/topik-ii.grammar.json');
const types = require('../strata/topik-types.json');
const root = path.resolve(__dirname, '..');
const map = createMap(saved);
const input = () => structuredClone({ base, grammar, units, types,
  sources: Object.fromEntries(Object.entries(saved.sources).filter(([key]) => key.startsWith('unit-'))) });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const versioned = data => ({ ...data, map_ver: `${data.map_ver}-${hash(JSON.stringify(data)).slice(0, 12)}` });

test('unit map uses the existing envelope, preserves abilities and has a separate reproducible version', () => {
  assert.equal(validateMap(saved), true);
  assert.deepEqual(versioned(buildUnitMap(input())), saved);
  assert.match(saved.map_ver, /^topik-ii-units-1-[a-f0-9]{12}$/);
  assert.notEqual(saved.map_ver, base.map_ver);
  assert.deepEqual(saved.nodes.filter(node => node.kind === 'skill'), base.nodes);
  assert.deepEqual(saved.edges, base.edges);
  assert.deepEqual(saved.links.tags, base.links.tags);
  assert.equal(saved.nodes.filter(node => node.kind === 'topic').length, 4);
  assert.equal(saved.nodes.filter(node => node.kind === 'task').length, 22);
  assert.equal(saved.nodes.filter(node => node.kind === 'grammar_point').length, 15);
  assert.equal(saved.nodes.filter(node => node.kind === 'word').length, 61);
  for (const source of Object.values(saved.sources)) {
    assert.equal(source.sha256, hash(fs.readFileSync(path.join(root, source.path), 'utf8').replace(/\r\n/g, '\n')), source.path);
  }
});

test('existing goal/node queries load U13~U16 in source order and only the tasks actually specified', () => {
  assert.deepEqual(map.forGoal('topik-4').map(node => node.id), ['ko2.unit.U13', 'ko2.unit.U14', 'ko2.unit.U15', 'ko2.unit.U16']);
  for (const source of units.units) {
    const found = unitPath(map, source.id);
    const { word_ids, task_ids, ...material } = found.unit.material;
    assert.deepEqual(material, source, 'course/dream/roots/measurement and review-versus-repeat flags survive intact');
    assert.deepEqual(found.tasks, map.forGoal(source.id));
    assert.deepEqual(found.tasks.map(node => node.material.container), CONTAINERS.filter(key => source.containers[key] !== null));
    assert.deepEqual(found.skills.map(node => node.id), source.skills);
    assert.deepEqual(found.grammar.map(node => node.id), source.grammar.map(item => item.id));
    assert.deepEqual(found.words.map(node => node.label_ko), source.words.map(word => word.word));
    for (const task of found.tasks) {
      assert.equal(task.material.unit_id, source.id);
      assert.equal(task.material.brief, source.containers[task.material.container]);
      assert.deepEqual(map.prerequisites(task.id), []);
    }
    assert.deepEqual(map.prerequisites(found.unit.id), []);
  }
  assert.equal(map.getNode('ko2.task.U16.reading'), null);
  assert.equal(map.getNode('ko2.task.U16.writing'), null);
  for (const unknown of ['U01', 'U17', 'u13', 'ko2.unit.U13', null, {}]) assert.equal(unitPath(map, unknown), null);
  assert.deepEqual(map.forGoal('topik-3'), []);
  assert.equal(unitPath(createMap(base), 'U13'), null);
});

test('draft status is retained on every added node and goal, without inventing prerequisite or ability links', () => {
  for (const item of [...saved.nodes.filter(node => node.kind !== 'skill'), ...saved.links.goals]) {
    assert.equal(item.confidence, 'ai_draft');
    assert.equal(item.reviewed, false);
  }
  assert.deepEqual(map.forSkill('ko2.reading.grammar').grammar, [], 'unit membership is not an authored grammar-to-skill assessment');
  const draft = map.candidates({ lines: [{ key: 'need:node.ko2.unit.U14', usable: true, source: 'observed' }] });
  assert.deepEqual(draft[0].blocked_by, []);
  // Word ids use the standard's grade and per-grade number, not TOPIK I's different word list.
  for (const source of units.units) for (const word of source.words) {
    const node = map.getNode(`ko2.word.${word.level}.${word.no}`);
    assert.equal(node.level.intro, Number(word.level));
    assert.equal(node.level.basis, 'standard_curriculum');
  }
});

test('source order, language changes and review state cannot silently drift under an old unit version', () => {
  const changed = input(); changed.units.units[1].containers.club += ' (수정)';
  assert.notEqual(versioned(buildUnitMap(changed)).map_ver, saved.map_ver);
  const altered = input(); altered.grammar.points.find(point => point[0] === 'S461')[2].push('검증용 관련형');
  assert.notEqual(versioned(buildUnitMap(altered)).map_ver, saved.map_ver);
  const broken = mutate => { const data = input(); mutate(data); return () => buildUnitMap(data); };
  for (const [mutate, message] of [
    [d => { d.units.reviewed = true; }, /unreviewed/],
    [d => { d.units.status = 'authored'; }, /unreviewed/],
    [d => { d.units.units.reverse(); }, /invalid unit/],
    [d => { d.units.units[1].id = 'U13'; }, /invalid unit/],
    [d => { d.units.units[1].skills[0] = 'ko.reading.main'; }, /invalid skills/],
    [d => { d.units.units[1].topik_types[0] = 'TI-R-01'; }, /invalid exam types/],
    [d => { d.units.units[1].grammar[0].form = 'wrong'; }, /invalid grammar reference/],
    [d => { d.units.units[1].grammar[0].review = true; }, /invalid grammar reference/],
    [d => { d.units.units[2].grammar[0].again = false; }, /invalid grammar reference/],
    [d => { d.units.units[1].words[0].level = '5'; }, /invalid word/],
    [d => { d.units.units[0].words[0].review = false; }, /invalid word/],
    [d => { d.units.units[1].words[0] = { ...d.units.units[0].words[0], word: '다른 낱말' }; }, /conflicting word/],
    [d => { delete d.units.units[1].containers.cafe; }, /invalid containers/],
    [d => { d.units.units[1].containers.cafe = ''; }, /invalid containers/],
    [d => { d.units.units[1].measure.C = ''; }, /missing material/],
    [d => { delete d.sources['unit-curriculum']; }, /missing or colliding sources/],
    [d => { d.sources['practice-taxonomy'] = d.sources['unit-curriculum']; }, /missing or colliding sources/],
  ]) assert.throws(broken(mutate), message);
});

test('builder and lookup isolate caller mutations, including nested task, dream and measurement data', () => {
  const source = input(), before = structuredClone(source), result = buildUnitMap(source);
  assert.deepEqual(source, before);
  const immutable = createMap(result), found = unitPath(immutable, 'U16');
  source.units.units[3].dream.idol = 'changed';
  result.nodes.find(node => node.id === 'ko2.unit.U16').material.measure.C = 'changed';
  assert.equal(found.unit.material.dream.idol, units.units[3].dream.idol);
  assert.equal(found.unit.material.measure.C, units.units[3].measure.C);
  assert.throws(() => { found.unit.material.dream.idol = 'changed'; }, TypeError);
  assert.throws(() => found.tasks.pop(), TypeError);
  assert.throws(() => { found.words[0].label_ko = 'changed'; }, TypeError);
  assert.throws(() => unitPath(null, 'U13'), /a map is required/);
});

test('existing WORLD composition can opt into units; the default WORLD, games and speaking maps stay unchanged', async () => {
  const { worldMapData, worldMap } = await import(pathToFileURL(path.join(root, 'experiences/synk-world-app/world-learning-map.mjs')).href);
  const widened = createMap(worldMapData({ second: saved }));
  assert.ok(unitPath(widened, 'U14'));
  assert.equal(unitPath(worldMap, 'U14'), null);
  assert.equal(widened.getNode('ko.reading.main').kind, 'skill');
  assert.equal(widened.getNode('ko2.reading.main').kind, 'skill');
  assert.equal(require('../atlas/game-browser').SKILLS.some(node => node.id.startsWith('ko2.')), false);
  const speaking = require('../strata/maps/ko-speaking.json');
  assert.equal(speaking.nodes.some(node => node.kind === 'topic' || node.kind === 'task'), false);
});

test('Core and Trail load unit material through their existing contract and round-trip the same v1 history', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let now = Date.parse('2026-11-02T00:00:00Z');
  const clock = () => new Date(now += 1000).toISOString();
  const config = { gameId: 'topik-unit-contract', storage, clock };
  const item = (id, conceptIds = []) => ({ id, itemKey: `${id}.first`, familyKey: `${id}.family`, skillId: 'ko2.reading.detail',
    modality: 'reading', difficulty: 1, responseFormat: 'single-choice', audioRequired: false, conceptIds });
  const original = Game.createGame({ ...config, map: createMap(base) });
  original.answer(original.present(item('existing-item')), { correct: true, assessable: true });
  const oldEvents = original.events(); original.dispose();
  const widened = Game.createGame({ ...config, map });
  assert.deepEqual(widened.events(), oldEvents);
  const found = unitPath(map, 'U14'), task = found.tasks.find(node => node.material.container === 'reading');
  const content = [found.grammar[0].id, found.words[0].id];
  widened.answer(widened.present(item(task.id, content)), { correct: false, assessable: true });
  const all = widened.events(), presented = all.filter(event => event.type === 'practice.presented').at(-1);
  assert.equal(presented.taskId, task.id);
  assert.equal(presented.taskVersion, saved.map_ver);
  assert.deepEqual(presented.conceptIds, ['ko2.reading.detail', ...content]);
  assert.deepEqual(all.slice(0, oldEvents.length), oldEvents, 'old immutable events are never rewritten');
  const summary = widened.summary();
  assert.equal(summary.skills.find(skill => skill.id === 'ko2.reading.detail').n, 2);
  assert.equal(summary.learningEffectClaim, false); assert.equal(summary.grade, null);
  assert.ok(summary.concepts.some(node => node.id === content[0]));
  widened.dispose();
  const persisted = JSON.parse(values.get('synk.atlas.learning.v1.device'));
  assert.equal(persisted.version, 1);
  const oldAgain = Game.createGame({ ...config, map: createMap(base) });
  assert.deepEqual(oldAgain.events(), all, 'an older consumer retains events naming the new content');
  assert.equal(oldAgain.summary().skills.find(skill => skill.id === 'ko2.reading.detail').n, 2);
  oldAgain.dispose();
  const restored = Game.createGame({ ...config, map });
  assert.deepEqual(restored.events(), all);
  assert.equal(restored.summary().skills.find(skill => skill.id === 'ko2.reading.detail').n, 2);
  restored.dispose();
});
