'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createMap, validateMap } = require('../strata');
const { loadSources, buildMap, serialize, main } = require('../tools/strata-build');
const saved = require('../strata/maps/ko.json');
const copy = value => JSON.parse(JSON.stringify(value));
const root = path.resolve(__dirname, '..');
const explicitTalkRoot = process.env.SYNK_TALK_ROOT;
if (explicitTalkRoot !== undefined) assert.ok(path.isAbsolute(explicitTalkRoot), 'SYNK_TALK_ROOT must be absolute');
const talkRoot = explicitTalkRoot === undefined ? path.resolve(root, '..', 'SYNK-talk') : explicitTalkRoot;
const localSourcesPresent = ['contents/토픽퀴즈문항.js', 'lib/태그기술표.js'].every(file => fs.existsSync(path.join(talkRoot, file)));

function smallInput() {
  return {
    grammar: [['G001', '-아요', '현재 표현', 1, null, '요'], ['G002', '-았어요', '과거 표현', 1, null, '표'], ['G003', '-더라고요', '회상 표현', 3, null, '요']],
    skills: [{ skill_id: 'skill-present', label_ko: '현재', domain: 'grammar' }, { skill_id: 'skill-past', label_ko: '과거', domain: 'grammar' }, { skill_id: 'skill-vocab', label_ko: '어휘', domain: 'vocab' }],
    grammarBySkill: { 'skill-present': ['G001'], 'skill-past': ['G002'], 'skill-vocab': [] },
    tags: ['mapped', 'missing'], tagToSkill: { mapped: 'skill-present' }, missingTags: ['missing'],
    sources: Object.fromEntries(['grammar_bank', 'skills', 'error_tags', 'tag_links'].map(id => [id, { path: `synthetic/${id}`, sha256: '0'.repeat(64) }])),
  };
}
function prerequisite(from, to, extra = {}) {
  return { from, to, type: 'prerequisite', confidence: 'authored', reviewed: false,
    source_refs: [{ source: 'skills', selector: 'synthetic prerequisite' }], ...extra };
}
function line(key, extra = {}) { return { key, source: 'observed', status: 'unconfirmed', usable: true, ...extra }; }

test('assembled map preserves 30 skills, 91 grammar points and the exact 8/15 tag partition', () => {
  assert.equal(validateMap(saved), true);
  assert.equal(saved.nodes.filter(node => node.kind === 'skill').length, 30);
  assert.equal(saved.nodes.filter(node => node.kind === 'grammar_point').length, 91);
  assert.equal(saved.links.tags.filter(link => link.fit === 'full').length, 8);
  assert.equal(saved.links.tags.filter(link => link.fit === 'none').length, 15);
  assert.equal(saved.tag_vocabulary.length, 23);
  assert.equal(saved.edges.every(edge => edge.type === 'part_of'), true);
  assert.equal(saved.nodes.filter(node => node.material).every(node => node.material.reviewed === false && node.material.status === 'draft'), true);
  const serialized = serialize(saved);
  for (const field of ['learner_id', 'student_id', 'options_shown', 'correct_option_id', '문항들', '정답']) assert.equal(serialized.includes(`"${field}"`), false);
});

test('live canonical sources reproduce the saved map byte for byte, without changing sources', { skip: !localSourcesPresent && explicitTalkRoot === undefined && process.env.SYNK_REQUIRE_TALK_SOURCE !== '1' }, () => {
  const first = loadSources({ talkRoot }), second = loadSources({ talkRoot });
  const output = serialize(buildMap(first));
  assert.equal(output, serialize(buildMap(second)));
  assert.equal(output, fs.readFileSync(path.join(root, 'strata/maps/ko.json'), 'utf8').replace(/\r\n/g, '\n'));
  assert.deepEqual(buildMap(first).nodes.filter(node => node.kind === 'skill').map(node => ({ skill_id: node.id, label_ko: node.label_ko, domain: node.domain })), first.skills);
  assert.deepEqual(first, second);
});

test('every local source hash identifies the normalized actual file', () => {
  for (const source of Object.values(saved.sources).filter(source => source.path.startsWith('SYNK-appsscript/'))) {
    const value = fs.readFileSync(path.join(root, source.path.slice('SYNK-appsscript/'.length)), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(source.sha256, crypto.createHash('sha256').update(value, 'utf8').digest('hex'));
  }
});

test('tag lookup never invents a precise past-tense skill for the broad tense tag', () => {
  const map = createMap(saved);
  assert.equal(map.forTag('높임:주체').status, 'exact');
  assert.equal(map.forTag('높임:주체').node.id, 'skill-ko-grammar-honorific');
  assert.equal(map.forTag('어미:시제').status, 'missing');
  assert.equal(map.forTag('어미:시제').node, null);
  assert.equal(map.forTag('typo').status, 'unknown');
  assert.equal(map.forTag('오류없음').status, 'unknown');
  assert.equal(map.getNode('G999'), null);
});

test('skill level follows mapped grammar maximum and keeps absent levels separate', () => {
  const map = createMap(saved);
  const reason = map.forSkill('skill-ko-grammar-connective-reason');
  assert.deepEqual(reason.grammar.map(node => node.id), ['G308', 'G410']);
  assert.equal(reason.level.intro, 2);
  assert.equal(reason.level.coverage, 'mapped_grammar_only');
  assert.equal(reason.sources.some(ref => ref.source === 'grammar_bank' && ref.selector === 'GRAMMAR_BANK:G308'), true);
  assert.equal(new Set(reason.sources.map(ref => JSON.stringify(ref))).size, reason.sources.length);
  assert.equal(map.forSkill('skill-ko-vocab-place').level, null);
  assert.equal(map.forSkill('skill-ko-grammar-particle-range').level, null);
  assert.equal(map.forSkill('G308'), null);
});

test('map and lookup results are isolated from caller mutation', () => {
  const input = buildMap(smallInput()), map = createMap(input);
  input.nodes[0].label_ko = 'changed';
  assert.equal(map.getNode('G001').label_ko, '-아요');
  assert.throws(() => { map.getNode('G001').label_ko = 'changed'; }, TypeError);
  assert.throws(() => { map.forSkill('skill-present').grammar.push({}); }, TypeError);
  assert.equal(map.getNode('G001').label_ko, '-아요');
});

test('missing nodes, duplicate tags, broken evidence and incomplete partitions are explicit errors', () => {
  const edits = [
    data => { data.edges[0].from = 'missing'; },
    data => { data.links.tags.push(copy(data.links.tags[0])); },
    data => { data.links.tags.pop(); },
    data => { data.nodes[0].source_refs[0].source = 'missing'; },
    data => { data.links.tags[0].fit = 'partial'; },
    data => { data.edges[0].reviewed = 'true'; },
  ];
  for (const edit of edits) { const data = buildMap(smallInput()); edit(data); assert.throws(() => createMap(data), /Strata:/); }
});

test('prerequisites reject cycles, missing references and inverted introduction levels', () => {
  const data = buildMap(smallInput());
  data.edges.push(prerequisite('G001', 'G002'), prerequisite('G002', 'G001', { confidence: 'ai_draft' }));
  assert.throws(() => createMap(data), /cycle/);
  data.edges.splice(-2, 2, prerequisite('G003', 'G002'));
  assert.throws(() => createMap(data), /level inversion/);
  data.edges.splice(-1, 1, prerequisite('missing', 'G002'));
  assert.throws(() => createMap(data), /endpoint/);
});

test('unreviewed AI prerequisite is advisory and cannot block a candidate', () => {
  const data = buildMap(smallInput());
  data.edges.push(prerequisite('G001', 'G002', { confidence: 'ai_draft' }));
  let map = createMap(data);
  assert.equal(map.prerequisites('G002')[0].blocking, false);
  let candidate = map.candidates({ lines: [line('need:node.G002')] })[0];
  assert.deepEqual(candidate.blocked_by, []);
  assert.deepEqual(candidate.advisory, ['G001']);
  data.edges.at(-1).reviewed = true;
  map = createMap(data);
  candidate = map.candidates({ lines: [line('need:node.G002')] })[0];
  assert.deepEqual(candidate.blocked_by, ['G001']);
  assert.deepEqual(map.candidates({ lines: [line('need:node.G002')], mastered: ['G001'] })[0].blocked_by, []);
});

test('candidate selection preserves usable evidence keys, is deterministic and ignores guesses/denials', () => {
  const map = createMap(saved);
  const lines = [line('need:tag.높임:주체'), line('due:skill.skill-ko-grammar-honorific'), line('need:tag.어미:시제'),
    line('need:node.G201', { usable: false }), line('need:node.G202', { status: 'denied' }),
    line('need:node.G203', { source: 'estimated' }), line('trait:node.G204'), line('need:node.unknown')];
  const result = map.candidates({ lines });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'skill-ko-grammar-honorific');
  assert.deepEqual(result[0].targets, ['due:skill.skill-ko-grammar-honorific', 'need:tag.높임:주체']);
  assert.deepEqual(result, map.candidates({ lines: [...lines].reverse() }));
  assert.deepEqual(map.candidates(), []);
  assert.throws(() => map.candidates({ lines }, { limit: -1 }), /invalid candidate/);
});

test('builder rejects partial or invented source mappings and versions content changes', () => {
  const first = smallInput();
  const original = buildMap(first);
  first.grammar[0][2] = 'changed explanation';
  assert.notEqual(original.map_ver, buildMap(first).map_ver);
  first.missingTags = [];
  assert.throws(() => buildMap(first), /partition/);
  const next = smallInput(); next.tagToSkill.mapped = 'invented';
  assert.throws(() => buildMap(next), /unknown skill/);
  const orphan = smallInput(); orphan.grammarBySkill['skill-past'] = ['G999'];
  assert.throws(() => buildMap(orphan), /missing grammar/);
  assert.throws(() => main(['--unknown']), /Usage/);
});

test('an empty valid map keeps baseline lookup available without fabricating content', () => {
  const map = createMap({ map_ver: 'empty-1', subject: 'ko', sources: {}, nodes: [], edges: [], tag_vocabulary: [], links: { tags: [] } });
  assert.equal(map.getNode('G001'), null);
  assert.equal(map.forSkill('skill-present'), null);
  assert.deepEqual(map.prerequisites('G001'), []);
  assert.deepEqual(map.candidates({ lines: [line('need:node.G001')] }), []);
});
