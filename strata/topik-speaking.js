'use strict';
// TOPIK 말하기 평가의 여섯 유형을 WORLD 말하기 연습의 능력 마디로(Atlas × WORLD 2단계 E, 2026-11-08 — docs/_ops/qa/atlas-world-engine-20261108/E_말하기.md).
// 원천은 topik-speaking.json(사람이 쓰고 검수가 확인하는 표), 생성 층은 maps/topik-speaking.json(tools/build-game-learning.js가 출처 해시와 함께 만든다).
// WORLD 코치 지도만 이 층을 싣는다(experiences/synk-world-app/world-learning-map.mjs) — 게임 묶음 · 드라마 지도는 그대로다.
// 말하기 시도는 채점하지 않는다(Trail assessable:false): 이 층은 기록의 자리를 정할 뿐 숙달 · 급수 판정이 아니다.
// 이 모듈은 입출력 · 학습자 기록 · 채점이 없다.
const SOURCE = 'speaking-types';
const ID = /^ko\.speaking\.[a-z]+$/;
const ROLEPLAY = /^[a-z][a-z0-9-]{0,79}$/;
const BANDS = Object.freeze(['beginner', 'intermediate', 'advanced']);
// Core가 받는 응답 꼴(atlas/learning.js RESPONSE_FORMATS — strata/world-life.js FORMATS와 같다, 시험이 본다). Strata는 Core를 부르지 않는다.
const FORMATS = Object.freeze(['binary-choice', 'single-choice', 'cup-compose', 'action', 'spoken', 'unknown']);
const text = value => typeof value === 'string' && value.trim().length > 0;
const seconds = value => Number.isInteger(value) && value > 0 && value <= 600;
const fail = message => { throw new TypeError(`Strata speaking: ${message}`); };
const clone = value => JSON.parse(JSON.stringify(value));

// 빌드 때: 기본 지도(base — WORLD 코치 지도의 바탕)와 드라마 말하기 지도의 원천(drama)에 비추어 원천을 확인하고 층을 만든다.
function buildSpeakingLayer({ base, source, file, drama = null }) {
  if (!base || !Array.isArray(base.nodes)) fail('a base map is required');
  if (!text(source?.version) || !Array.isArray(source.types) || !Array.isArray(source.roleplays) || !source.measure
    || ![1, 2, 3].includes(source.measure.difficulty) || !FORMATS.includes(source.measure.format) || source.measure.format === 'unknown') fail('invalid source');
  if (!text(source.basis?.source) || !text(source.basis?.checked)) fail('a source basis is required');
  if (!file || !text(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256)) fail('invalid source hash');
  const taken = new Set(base.nodes.map(node => node.id));
  // 드라마 지도는 WORLD 코치가 싣지 않는 따로 지도다 — 같은 이름이면 한쪽 결과가 다른 쪽 추천을 움직인다(결정 2026-10-31).
  for (const row of drama?.skills || []) if (Array.isArray(row) && text(row[0])) taken.add(row[0]);
  const types = new Set(), ids = new Set(), nodes = [];
  for (const row of source.types) {
    if (!Array.isArray(row) || row.length !== 6) fail('a type row is [type, skill, label, band, prepSec, answerSec]');
    const [type, id, label, band, prepSec, answerSec] = row;
    if (!Number.isInteger(type) || type < 1 || type > 6 || types.has(type)) fail(`invalid or duplicate type ${type}`);
    if (!ID.test(id) || ids.has(id) || taken.has(id)) fail(`invalid or taken ability id ${id}`);
    if (!text(label) || !BANDS.includes(band) || !seconds(prepSec) || !seconds(answerSec)) fail(`invalid type row ${type}`);
    types.add(type); ids.add(id);
    nodes.push({ id, kind: 'skill', label_ko: label, domain: 'speaking', level: null, difficulty: { authored: null, measured: null, n: 0 },
      confidence: 'authored', reviewed: source.review?.status === 'passed', ...(source.review?.status === 'passed' ? { review: clone(source.review) } : {}),
      source_refs: [{ source: SOURCE, selector: id }], material: { type, band, prepSec, answerSec, roleplays: [] } });
  }
  if (types.size !== 6) fail('the six official types are required');
  const roleplays = new Set();
  for (const row of source.roleplays) {
    if (!Array.isArray(row) || row.length !== 2) fail('a roleplay row is [roleplay, skill]');
    const [roleplay, skill] = row, node = nodes.find(n => n.id === skill);
    if (!ROLEPLAY.test(roleplay) || roleplays.has(roleplay) || !node) fail(`invalid roleplay ${roleplay}`);
    roleplays.add(roleplay); node.material.roleplays.push(roleplay);
  }
  return { layer_ver: source.version, sources: { [SOURCE]: { path: file.path, sha256: file.sha256 } },
    measure: { difficulty: source.measure.difficulty, format: source.measure.format }, nodes };
}

// 실행 때: 생성 층 하나를 읽는다(묶음은 같은 JSON을 싣는다).
let LAYER = null;
const layer = () => LAYER ??= require('./maps/topik-speaking.json');

// 말하기 한 판의 측정 칸: 시험 형식 유형(type 1~6) 또는 역할극(roleplay id). 모르면 null — 제품은 그 판을 기록하지 않는다
// (새 은행과 옛 묶음이 섞일 때 지어내지 않는다).
function speakingMeasure({ type, roleplay } = {}, from = layer()) {
  const node = Number.isInteger(type) ? from.nodes.find(n => n.material.type === type)
    : typeof roleplay === 'string' ? from.nodes.find(n => n.material.roleplays.includes(roleplay)) : null;
  if (!node) return null;
  return { skillId: node.id, modality: 'speaking', difficulty: from.measure.difficulty, responseFormat: from.measure.format, audioRequired: false };
}
// WORLD 코치 지도에 이 층을 싣는다: 마디 · 출처를 더하고 지도판 끝에 층 판을 붙인다. strata/world-map.js는 건드리지 않는다 —
// 3~4급 게임 묶음이 그 파일을 싣기 때문이다.
function withSpeakingLayer(data, from = layer()) {
  if (!data || !Array.isArray(data.nodes) || !data.sources || !from || !Array.isArray(from.nodes)) fail('a map and a speaking layer are required');
  if (Object.keys(from.sources).some(key => Object.hasOwn(data.sources, key))) fail('colliding speaking source');
  const ids = new Set(data.nodes.map(node => node.id));
  if (from.nodes.some(node => ids.has(node.id))) fail('colliding speaking ability');
  return { ...data, map_ver: `${data.map_ver}:${from.layer_ver}`, sources: { ...data.sources, ...from.sources }, nodes: [...data.nodes, ...from.nodes] };
}
// 묶지 않고 읽는 화면 모듈(world-speaking-practice.mjs)에 넘길 조회 부품 — WORLD 코치 지도 모듈이 worldLearning.speaking으로 싣는다.
const speakingEngine = Object.freeze({ measure: input => speakingMeasure(input), version: () => layer().layer_ver });

module.exports = { buildSpeakingLayer, withSpeakingLayer, speakingMeasure, speakingEngine, layer, FORMATS, BANDS, SOURCE };
