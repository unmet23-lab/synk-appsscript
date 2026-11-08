// Atlas × WORLD 2단계 E(2026-11-08): TOPIK 말하기 평가 여섯 유형의 Strata 능력 층(docs/_ops/qa/atlas-world-engine-20261108/E_말하기.md §4-2).
// 원천(strata/topik-speaking.json)이 말하기 은행(world-speaking-items.json)의 유형 · 문항 · 역할극을 빠짐없이 덮고, WORLD 코치 지도만 층을 싣고,
// 기본 WORLD 지도 · 드라마 말하기 지도는 그대로이며, 측정은 모두 난도 1 · spoken(채점하지 않는다)인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const strata = require('../strata/index.js');
const speaking = require('../strata/topik-speaking.js');
const life = require('../strata/world-life.js');
const coach = require('../strata/world-coach.js');
const source = require('../strata/topik-speaking.json');
const layer = require('../strata/maps/topik-speaking.json');
const drama = require('../strata/ko-speaking.json');
const dramaMap = require('../strata/maps/ko-speaking.json');
const { worldMapData } = require('../strata/world-map.js');
const { RESPONSE_FORMATS } = require('../atlas/learning.js');
const bank = JSON.parse(fs.readFileSync(new URL('../experiences/synk-world-app/world-speaking-items.json', import.meta.url), 'utf8'));
const BAND = { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' };
const coachBase = () => life.withLifeLayer(worldMapData());

test('원천의 여섯 유형이 은행의 공식 유형과 같다 — 이름 · 수준 · 준비 · 대답 초', () => {
  assert.deepEqual(source.types.map(([type]) => type), [1, 2, 3, 4, 5, 6]);
  for (const [type, , label, band, prepSec, answerSec] of source.types) {
    const official = bank.types[type];
    assert.deepEqual([label, band, prepSec, answerSec], [official.name, BAND[official.band], official.prepSec, official.answerSec], `유형 ${type}`);
  }
  assert.equal(source.basis.source, bank.basis.source, '은행과 같은 공식 근거');
});

test('생성 층은 원천을 지금 빌드한 결과와 같다(지도판 · 출처 해시 · 마디)', () => {
  const bytes = fs.readFileSync(new URL('../strata/topik-speaking.json', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const built = speaking.buildSpeakingLayer({ base: coachBase(), source, file: { path: 'strata/topik-speaking.json', sha256: sha }, drama });
  built.layer_ver += `-${sha.slice(0, 12)}`;
  assert.deepEqual(layer, built);
  assert.equal(layer.nodes.length, 6);
  for (const node of layer.nodes) {
    assert.deepEqual([node.kind, node.domain, node.level, node.confidence], ['skill', 'speaking', null, 'authored']);
    assert.match(node.id, /^ko\.speaking\.[a-z]+$/);
    assert.deepEqual(node.source_refs, [{ source: 'speaking-types', selector: node.id }]);
  }
});

test('은행의 시험 문항 · 역할극이 모두 측정 칸을 받는다 — 유형의 능력 · 난도 1 · spoken · 소리 필요 없음', () => {
  assert.ok(bank.items.length >= 6);
  for (const item of bank.items) {
    const want = source.types.find(([type]) => type === item.type)[1];
    assert.deepEqual(speaking.speakingMeasure({ type: item.type }), { skillId: want, modality: 'speaking', difficulty: 1, responseFormat: 'spoken', audioRequired: false }, item.id);
  }
  assert.ok(bank.roleplays.length >= 1);
  for (const roleplay of bank.roleplays) assert.equal(speaking.speakingMeasure({ roleplay: roleplay.id })?.skillId, 'ko.speaking.roleplay', roleplay.id);
  assert.deepEqual(source.roleplays.map(([id]) => id).sort(), bank.roleplays.map(r => r.id).sort(), '원천이 은행의 역할극을 빠짐없이 적는다');
});

test('모르는 유형 · 역할극은 측정 칸을 지어내지 않는다', () => {
  for (const input of [{ type: 0 }, { type: 7 }, { type: '1' }, { roleplay: 'rp-unknown' }, { roleplay: 1 }, {}, undefined]) assert.equal(speaking.speakingMeasure(input), null, JSON.stringify(input));
});

test('이름이 기본 WORLD 지도 · 생활 층 · 드라마 말하기 지도와 겹치지 않는다 — 겹치면 빌드가 거절한다', () => {
  const ids = new Set(layer.nodes.map(node => node.id));
  for (const node of [...coachBase().nodes, ...dramaMap.nodes]) assert.ok(!ids.has(node.id), node.id);
  for (const [id] of drama.skills) assert.ok(!ids.has(id), id);
  const file = { path: 'strata/topik-speaking.json', sha256: 'b'.repeat(64) };
  assert.throws(() => speaking.buildSpeakingLayer({ base: coachBase(), source, file, drama: { skills: [['ko.speaking.answer', '겹친 이름']] } }), /taken ability id/);
  const moved = JSON.parse(JSON.stringify(source)); moved.types[0][1] = 'ko.reading.detail';
  assert.throws(() => speaking.buildSpeakingLayer({ base: coachBase(), source: moved, file, drama }), /invalid or taken ability id/);
  const short = JSON.parse(JSON.stringify(source)); short.types.pop();
  assert.throws(() => speaking.buildSpeakingLayer({ base: coachBase(), source: short, file, drama }), /six official types/);
  const banded = JSON.parse(JSON.stringify(source)); banded.measure.format = 'unknown';
  assert.throws(() => speaking.buildSpeakingLayer({ base: coachBase(), source: banded, file, drama }), /invalid source/);
});

test('WORLD 코치 지도만 층을 싣는다 — 기본 지도 · 드라마 지도는 그대로이고 합친 지도는 검증을 지난다', async () => {
  const { worldMap, worldLearning } = await import('../experiences/synk-world-app/world-learning-map.mjs');
  const base = strata.createMap(worldMapData());
  assert.equal(worldMap.map_ver, `${base.map_ver}:layers-${coach.fingerprint([life.layer().layer_ver, layer.layer_ver].join('|'))}`);
  for (const node of layer.nodes) {
    assert.equal(worldMap.getNode(node.id)?.domain, 'speaking', node.id);
    assert.equal(base.getNode(node.id), null, `기본 WORLD 지도(게임 묶음)에는 없다: ${node.id}`);
  }
  assert.ok(!dramaMap.nodes.some(node => layer.nodes.some(n => n.id === node.id)));
  assert.equal(worldLearning.speaking.measure({ type: 6 }).skillId, 'ko.speaking.opinion');
  assert.equal(worldLearning.speaking.version(), layer.layer_ver);
  assert.doesNotThrow(() => strata.validateMap(speaking.withSpeakingLayer(coachBase())));
  assert.throws(() => speaking.withSpeakingLayer(speaking.withSpeakingLayer(coachBase())), /colliding speaking/, '두 번 싣지 않는다');
});

// WORLD 코치 지도판은 그 지도로 낸 모든 제시의 taskVersion이다 — Trail 식별자(120자, atlas/trail.js id)를 넘으면 present가 모두 던진다.
test('코치 지도판은 층이 늘어도 120자 안이고, 층 판을 이어 붙이던 꼴(126자)은 Trail이 거절한다', () => {
  const Trail = require('../atlas/trail.js');
  const joined = `${worldMapData().map_ver}:${life.layer().layer_ver}:${layer.layer_ver}`;
  assert.ok(joined.length > 120, `이어 붙인 꼴은 ${joined.length}자`);
  const data = coach.coachMapData(worldMapData(), [[life.withLifeLayer, life.layer()], [speaking.withSpeakingLayer, layer]]);
  assert.equal(data.map_ver, `${worldMapData().map_ver}:layers-${coach.fingerprint(joined.split(':').slice(-2).join('|'))}`);
  assert.deepEqual(data.layers, [life.layer().layer_ver, layer.layer_ver]);
  assert.ok(data.map_ver.length <= coach.LIMIT);
  // 층이 열 개여도 길이가 같다(지문 하나).
  const many = Array.from({ length: 10 }, (_, i) => [(d, l) => ({ ...d, map_ver: `${d.map_ver}:${l.layer_ver}` }), { layer_ver: `future-layer-${i}-0123456789ab` }]);
  assert.equal(coach.coachMapData(worldMapData(), many).map_ver.length, data.map_ver.length);
  assert.deepEqual(coach.coachMapData(worldMapData(), []).map_ver, worldMapData().map_ver, '층이 없으면 기본판 그대로');
  assert.notEqual(coach.coachMapData(worldMapData(), [[speaking.withSpeakingLayer, layer]]).map_ver, data.map_ver, '층이 다르면 지문도 다르다(공개본은 말하기 층만)');
  // 실제 제시가 지나간다: 합친 지도로 present → Trail 검증 통과.
  const { createGame } = require('../atlas/game-learning.js');
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) };
  const shown = { id: 'speaking-s1-weekend', itemKey: 'speaking.s1-weekend', familyKey: 'speaking.s1-weekend', ...speaking.speakingMeasure({ type: 1 }) };
  const game = createGame({ gameId: 'world-speaking', map: strata.createMap(data), storage, clock: () => '2026-11-08T03:00:00.000Z' });
  assert.ok(game.present(shown));
  assert.equal(game.events().find(e => e.type === 'practice.presented').taskVersion, data.map_ver);
  const long = createGame({ gameId: 'world-speaking', map: strata.createMap({ ...data, map_ver: joined }), storage: { getItem: () => null, setItem() {}, removeItem() {} }, clock: () => '2026-11-08T03:00:00.000Z' });
  assert.throws(() => long.present(shown), /Trail: invalid presentation/, '이어 붙인 지도판은 제시 자체가 막힌다');
  assert.equal(typeof Trail.summarize, 'function');
});

test('Strata의 응답 꼴 목록 = Core RESPONSE_FORMATS', () => assert.deepEqual(speaking.FORMATS, RESPONSE_FORMATS));

// 생성 층은 WORLD 계정 묶음 · 공개 엔진 판에 그대로 실린다 — synk.im에는 AI 도구 · 모델 이름을 두지 않는다(10-21 원칙, D 11-08의 교훈).
test('생성 층(묶음에 실리는 JSON)에 AI 도구 · 모델 이름이 없다', () => {
  const text = JSON.stringify(layer);
  for (const name of ['Opus', 'Fable', 'GPT', 'Claude', 'Gemini', 'Argon', 'Grok', 'Codex', '아르곤', '그록', '페이블', '클로드', '제미나이', '오퍼스', '아스트라'])
    assert.ok(!text.includes(name), name);
});
