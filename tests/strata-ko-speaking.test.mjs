// Strata 말하기 지도(strata/maps/ko-speaking.json, 2026-10-31) — 드라마 대사가 학습 기록에 남을 자리.
// 지도가 TOPIK II 능력과 같은 이름으로 엮이는지, WORLD 지도와 이름이 섞이지 않는지, 대본의 모든 줄이 지도의 능력·문형·낱말을 가리키는지,
// 그 지도로 만든 코치가 spoken 테이크를 실제로 받는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import ep01 from '../experiences/drama/s1/ep01.mjs';

const require = createRequire(import.meta.url);
const { createMap, validateMap } = require('../strata');
const Game = require('../atlas/game-learning');
const speaking = require('../strata/maps/ko-speaking.json');
const source = require('../strata/ko-speaking.json');
const topik2 = require('../strata/maps/topik-ii.json');
const topik1 = require('../strata/topik-i').topikMap();
const map = createMap(speaking);
const nodes = new Map(speaking.nodes.map(node => [node.id, node]));
const lines = [...ep01.촬영일.flatMap(day => (day.줄 || []).filter(row => row.누가 === '학생').map(row => ({ ...row, kind: 'scene' }))),
  ...ep01.처음보는대사.map(row => ({ ...row, kind: 'unseen' }))];

test('말하기 지도: 유효한 지도이고 TOPIK II 능력 15칸을 같은 이름 · 이름표로 싣는다', () => {
  assert.equal(validateMap(speaking), true);
  assert.match(speaking.map_ver, /^ko-speaking-1-[0-9a-f]{12}$/);
  for (const node of topik2.nodes) assert.deepEqual(nodes.get(node.id), node, node.id);
  const own = speaking.nodes.filter(node => !topik2.nodes.some(t => t.id === node.id));
  assert.deepEqual([...new Set(own.map(node => node.kind))].sort(), ['grammar_point', 'skill', 'word']);
  for (const node of own.filter(node => node.kind === 'skill')) { assert.match(node.id, /^ko\.speaking\.[a-z-]+$/); assert.equal(node.domain, 'speaking'); }
  assert.equal(own.filter(node => node.kind === 'skill').length, source.skills.length);
});

test('문형은 말하기 능력과 TOPIK II 「문법 표현 읽기」에 초안(ai_draft)으로만 잇는다 — 급수 판정이 아니다', () => {
  for (const [id, , , skills] of source.grammar) {
    const to = speaking.edges.filter(edge => edge.from === id).map(edge => edge.to).sort();
    assert.deepEqual(to, [...skills, 'ko2.reading.grammar'].sort(), id);
  }
  assert.ok(speaking.edges.every(edge => edge.type === 'part_of' && edge.confidence === 'ai_draft' && edge.reviewed === false));
  assert.ok(speaking.nodes.filter(node => ['grammar_point', 'word'].includes(node.kind)).every(node => node.level === null), '단계·급수를 적지 않는다');
  const grammarReading = map.forSkill('ko2.reading.grammar');
  assert.equal(grammarReading.grammar.length, source.grammar.length);
});

test('WORLD 지도와 이름이 섞이지 않는다 — 겹치는 것은 TOPIK II 능력 15칸뿐, WORLD 지도에는 말하기 능력이 없다', () => {
  const world = new Set([...topik1.nodes, ...topik2.nodes].map(node => node.id));
  const shared = speaking.nodes.filter(node => world.has(node.id)).map(node => node.id).sort();
  assert.deepEqual(shared, topik2.nodes.map(node => node.id).sort());
  assert.equal([...world].some(id => id.startsWith('ko.speaking.')), false, 'WORLD 말하기 연습의 ko.speaking.* 기록 동작을 바꾸지 않는다');
});

test('대본의 모든 줄이 지도의 말하기 능력을 가리키고, 「문법」·「어휘」 글이 지도의 문형·낱말과 글자 그대로 같다(남는 내용 없음)', () => {
  const grammarByLabel = new Map(speaking.nodes.filter(node => node.kind === 'grammar_point').map(node => [node.label_ko, node.id]));
  const wordByLabel = new Map(speaking.nodes.filter(node => node.kind === 'word').map(node => [node.label_ko, node.id]));
  const used = new Set();
  for (const line of lines) {
    assert.equal(nodes.get(line.능력)?.domain, 'speaking', `${line.id} 능력 ${line.능력}`);
    for (const label of line.문법 || []) { assert.ok(grammarByLabel.has(label), `${line.id} 문법 ${label}`); used.add(grammarByLabel.get(label)); }
    for (const label of line.어휘 || []) { assert.ok(wordByLabel.has(label), `${line.id} 어휘 ${label}`); used.add(wordByLabel.get(label)); }
  }
  assert.deepEqual([...grammarByLabel.values(), ...wordByLabel.values()].filter(id => !used.has(id)), [], '대본이 쓰지 않는 문형·낱말이 지도에 남아 있다');
  // 처음 보는 대사는 같은 목적의 장면 대사와 같은 능력이다 — 다시 확인(Temper)이 같은 능력의 다른 줄을 본다.
  const sceneSkills = new Set(lines.filter(line => line.kind === 'scene').map(line => line.능력));
  for (const line of lines.filter(line => line.kind === 'unseen')) assert.ok(sceneSkills.has(line.능력), `${line.id} ${line.능력}`);
});

test('이 지도로 만든 코치가 장면 테이크(채점 안 함)와 처음 보는 대사(규칙이 확신한 통과)를 spoken으로 받는다', () => {
  const values = new Map(); let at = Date.parse('2026-11-02T00:00:00Z');
  const coach = Game.createGame({ gameId: 'drama-s1', map, storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    clock: () => new Date(at += 1000).toISOString() });
  const content = line => [...(line.문법 || []).map(label => speaking.nodes.find(node => node.label_ko === label && node.kind === 'grammar_point').id),
    ...(line.어휘 || []).map(label => speaking.nodes.find(node => node.label_ko === label && node.kind === 'word').id)];
  const present = line => coach.present({ id: line.id, itemKey: line.id, familyKey: line.id, skillId: line.능력, modality: 'speaking', difficulty: 1,
    responseFormat: 'spoken', audioRequired: false, conceptIds: content(line) });
  const scene = lines.find(line => line.id === 's1e01-3'), unseen = lines.find(line => line.id === 's1e01-t1');
  coach.answer(present(scene), { correct: null, assessable: false });
  coach.answer(present(unseen), { correct: true, assessable: true });
  const purpose = coach.summary().skills.find(skill => skill.id === 'ko.speaking.purpose').levels[1].formats.spoken;
  assert.deepEqual([purpose.n, purpose.correct, purpose.unassessed], [1, 1, 1]);
  const presented = coach.events().filter(event => event.type === 'practice.presented');
  assert.deepEqual(presented[0].conceptIds, ['ko.speaking.purpose', ...content(scene)]);
  assert.ok(presented.every(event => event.measure.responseFormat === 'spoken' && event.measure.modality === 'speaking'));
});
