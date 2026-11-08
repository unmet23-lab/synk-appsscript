'use strict';
// WORLD 생활 한국어의 22능력을 Strata 과제 마디로 — 마디마다 그 능력이 겨누는 TOPIK I 능력과 상황 마디(Atlas × WORLD 2단계 D, 2026-11-08).
// 원천은 world-life.json(사람이 쓰고 AI 2중 검수가 확인하는 표), 생성 층은 maps/world-life.json(tools/build-game-learning.js가 출처 해시와 함께 만든다).
// WORLD 코치 지도만 이 층을 싣는다(strata/world-map.js worldMapData({life})) — 게임 묶음의 기본 지도는 그대로다.
// 과제 · 상황 마디는 조회용이다: 학습 증거의 conceptIds는 지금처럼 문법 · 낱말만 받는다(TOPIK II 단원 지도와 같은 원칙).
// 이 모듈은 입출력 · 학습자 기록 · 채점이 없다. 문항의 측정 칸(능력 · 난도 · 응답 꼴)을 원천 그대로 돌려줄 뿐이다.
const SOURCE = 'world-life';
const TASK = 'life.task.';
// Core가 받는 응답 꼴(atlas/learning.js RESPONSE_FORMATS — 시험이 같은지 본다). Strata는 Core를 부르지 않는다.
const FORMATS = Object.freeze(['binary-choice', 'single-choice', 'cup-compose', 'action', 'spoken', 'unknown']);
const ID = /^[a-z][a-z0-9-]{0,79}$/;
const text = value => typeof value === 'string' && value.trim().length > 0;
const fail = message => { throw new TypeError(`Strata life: ${message}`); };
const clone = value => JSON.parse(JSON.stringify(value));
const modalityOf = ability => /^ko\.(reading|listening)\.[a-z]+$/.exec(ability)?.[1] || null;

// 예외 한 칸: 능력 이름 하나, 또는 {skill?, difficulty?, format?}.
function exception(value, abilities, where) {
  const entry = typeof value === 'string' ? { skill: value } : value;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Object.keys(entry).length
    || Object.keys(entry).some(key => !['skill', 'difficulty', 'format'].includes(key))) fail(`invalid exception ${where}`);
  if (entry.skill !== undefined && !abilities.has(entry.skill)) fail(`unknown ability in ${where}`);
  if (entry.difficulty !== undefined && ![1, 2, 3].includes(entry.difficulty)) fail(`invalid difficulty in ${where}`);
  if (entry.format !== undefined && !FORMATS.includes(entry.format)) fail(`invalid format in ${where}`);
  return { ...entry };
}

// 빌드 때: TOPIK I 지도(base)에 비추어 원천을 확인하고 지도 층을 만든다. 능력은 그 지도의 읽기 · 듣기 skill, 상황은 situation 마디다.
function buildLifeLayer({ base, life, source }) {
  if (!base || !Array.isArray(base.nodes)) fail('a base map is required');
  if (!text(life?.version) || !Array.isArray(life.skills) || !life.skills.length || !life.defaults
    || ![1, 2, 3].includes(life.defaults.difficulty) || !FORMATS.includes(life.defaults.format)) fail('invalid source');
  if (!source || !text(source.path) || !/^[a-f0-9]{64}$/.test(source.sha256)) fail('invalid source hash');
  if (!Array.isArray(life.scene_lessons) || new Set(life.scene_lessons).size !== life.scene_lessons.length || life.scene_lessons.some(id => !ID.test(id))) fail('invalid scene lessons');
  const nodes = new Map(base.nodes.map(node => [node.id, node]));
  const abilities = new Set(base.nodes.filter(node => node.kind === 'skill' && modalityOf(node.id) === node.domain).map(node => node.id));
  const seen = new Set(), keys = new Set(), out = [];
  for (const row of life.skills) {
    if (!Array.isArray(row) || row.length !== 6) fail('a row is [pack, skill, label, ability, situations, exceptions]');
    const [pack, skill, label, ability, situations, exceptions] = row;
    if (!ID.test(pack) || !ID.test(skill) || seen.has(skill) || !text(label)) fail(`invalid row ${skill}`);
    if (!abilities.has(ability)) fail(`unknown ability for ${skill}`);
    if (!Array.isArray(situations) || !situations.length || new Set(situations).size !== situations.length
      || situations.some(id => nodes.get(id)?.kind !== 'situation')) fail(`invalid situations for ${skill}`);
    if (!exceptions || typeof exceptions !== 'object' || Array.isArray(exceptions)) fail(`invalid exceptions for ${skill}`);
    const items = {};
    for (const [key, value] of Object.entries(exceptions)) {
      // 문항 열쇠는 원고의 문항 id(본문항) 또는 그 복습 id(<qid>-transfer)다. 한 문항은 한 능력에만 속한다.
      if (!ID.test(key) || keys.has(key)) fail(`invalid or duplicate item ${key}`);
      keys.add(key); items[key] = exception(value, abilities, `${skill}/${key}`);
    }
    seen.add(skill);
    out.push({ id: `${TASK}${skill}`, kind: 'task', label_ko: label, level: null, confidence: 'ai_draft',
      reviewed: life.review?.status === 'passed', ...(life.review?.status === 'passed' ? { review: clone(life.review) } : {}),
      source_refs: [{ source: SOURCE, selector: skill }],
      material: { skill, pack, ability, situations: [...situations], difficulty: life.defaults.difficulty, format: life.defaults.format, items } });
  }
  return { layer_ver: life.version, sources: { [SOURCE]: { path: source.path, sha256: source.sha256 } }, nodes: out, scene_lessons: [...life.scene_lessons] };
}

// 실행 때: 생성 층 하나를 읽는다(묶음은 같은 JSON을 싣는다).
let LAYER = null;
const layer = () => LAYER ??= require('./maps/world-life.json');
const taskOf = skillId => layer().nodes.find(node => node.material.skill === skillId) || null;

// 한 문항의 측정 칸. review면 그 문항의 새 상황 복습(<qid>-transfer). 장면 레슨의 본문항은 confounded(근거 없음).
// 모르는 능력이거나 그 능력의 팩 · 레슨 꼴에 맞지 않는 문항이면 null — 제품은 그 문항을 거울에 남기지 않는다(새 판 원고와 옛 묶음이 섞일 때
// 지어내지 않는다). 원고의 이름 꼴: 레슨 id는 `<팩>-…`, 문항 id는 `<레슨>-…`(tests/world-life-map.test.mjs가 원고 전체로 본다). 문항이 원고에
// 실제로 있는지는 부르는 쪽(experiences/synk-world-app/life-items.mjs)이 원고에서 꺼낸 문항으로만 부르는 것으로 지킨다.
function lifeMeasure({ skillId, questionId, lessonId, review = false } = {}) {
  const task = typeof skillId === 'string' ? taskOf(skillId) : null;
  if (!task || typeof questionId !== 'string' || !ID.test(questionId) || typeof lessonId !== 'string'
    || !lessonId.startsWith(`${task.material.pack}-`) || !questionId.startsWith(`${lessonId}-`)) return null;
  const own = task.material.items[review ? `${questionId}-transfer` : questionId] || {};
  const ability = own.skill ?? task.material.ability, modality = modalityOf(ability);
  if (!modality) return null;
  return { skillId: ability, modality, difficulty: own.difficulty ?? task.material.difficulty, responseFormat: own.format ?? task.material.format,
    audioRequired: false, confounded: !review && layer().scene_lessons.includes(lessonId) };
}
// 여러 생활 능력의 상황 마디(원천 차례, 겹치지 않게).
function lifeSituations(skillIds = []) {
  const out = [];
  for (const id of skillIds) for (const situation of taskOf(id)?.material.situations || []) if (!out.includes(situation)) out.push(situation);
  return out;
}
const lifeTaskId = skillId => `${TASK}${skillId}`;
// WORLD 코치 지도에 이 층을 싣는다: 과제 마디 · 출처를 더하고 지도판 끝에 층 판을 붙인다. strata/world-map.js는 건드리지 않는다 —
// 3~4급 게임 묶음이 그 파일을 싣기 때문에, 고치면 게임 묶음까지 바뀐다(기본 지도는 바이트 그대로 둔다).
function withLifeLayer(data, life = layer()) {
  if (!data || !Array.isArray(data.nodes) || !data.sources || !life || !Array.isArray(life.nodes)) fail('a map and a life layer are required');
  if (Object.keys(life.sources).some(key => Object.hasOwn(data.sources, key))) fail('colliding life source');
  return { ...data, map_ver: `${data.map_ver}:${life.layer_ver}`, sources: { ...data.sources, ...life.sources }, nodes: [...data.nodes, ...life.nodes] };
}

module.exports = { buildLifeLayer, withLifeLayer, lifeMeasure, lifeSituations, lifeTaskId, layer, FORMATS, SOURCE };
