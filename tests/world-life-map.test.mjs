// Atlas × WORLD 2단계 D(2026-11-08): 생활 한국어 22능력의 Strata 과제 마디 층.
// 원천(strata/world-life.json)이 원고(life-content.mjs)를 빠짐없이 덮고, WORLD 코치 지도만 층을 싣고, 기본 WORLD 지도는 그대로인지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PACKS, LESSONS, CONTENT_VERSION } from '../experiences/synk-world-app/life-content.mjs';
import { CAFE_LESSON_IDS } from '../experiences/synk-world-app/cafe-activity.mjs';
const require = createRequire(import.meta.url);
const strata = require('../strata/index.js');
const life = require('../strata/world-life.js');
const source = require('../strata/world-life.json');
const layer = require('../strata/maps/world-life.json');
const { worldMapData } = require('../strata/world-map.js');
const { RESPONSE_FORMATS } = require('../atlas/learning.js');

const questions = LESSONS.flatMap(lesson => lesson.questions.map(question => ({ lesson, question })));

test('원천의 22줄이 원고의 22능력과 같다 — 팩 · 이름 · 차례', () => {
  const skills = PACKS.flatMap(pack => pack.skills.map(skill => [pack.id, skill.id, skill.title]));
  assert.equal(skills.length, 22);
  assert.deepEqual(source.skills.map(([pack, skill, label]) => [pack, skill, label]), skills);
  assert.equal(source.content_ver, CONTENT_VERSION);
});

test('132문항이 모두 한 측정 칸에 간다 — TOPIK I 읽기 능력 · 난도 1~3 · Core 응답 꼴', () => {
  assert.equal(questions.length, 66);
  const map = strata.createMap(life.withLifeLayer(worldMapData()));
  for (const { lesson, question } of questions) for (const review of [false, true]) {
    const measure = life.lifeMeasure({ skillId: question.skillId, questionId: question.id, lessonId: lesson.id, review });
    assert.ok(measure, `${question.id}${review ? '-transfer' : ''}`);
    const node = map.getNode(measure.skillId);
    assert.equal(node?.kind, 'skill'); assert.equal(node.domain, measure.modality); assert.equal(measure.modality, 'reading');
    assert.ok([1, 2, 3].includes(measure.difficulty)); assert.ok(RESPONSE_FORMATS.includes(measure.responseFormat));
    assert.equal(measure.audioRequired, false);
    // 카페 방문 장면의 본문항만 근거 없음. 그 새 상황 복습은 다른 문항처럼 잰다.
    assert.equal(measure.confounded, !review && CAFE_LESSON_IDS.includes(lesson.id));
  }
});

// 계열 = 「한 문항의 답이 다른 문항의 답을 알려 주는가」의 연결 덩어리(experiences/synk-world-app/life-items.mjs, 설계 3판).
// 원고가 바뀌어도 이 불변식이 깨지면 여기서 잡힌다 — 같은 정답 글 · 같은 표현의 낱말 뜻 · 문형 · 같은 보기 묶음 복습은 한 계열.
test('계열 불변식: 정답 글이 같으면 한 계열 · 같은 표현의 낱말 뜻 · 문형은 한 계열 · 같은 보기 묶음 복습은 본문항 계열', async () => {
  const { lifeItem, sameChoices } = await import('../experiences/synk-world-app/life-items.mjs');
  const norm = text => String(text ?? '').normalize('NFC').replace(/[\s.,?!·…~'"‘’“”]+/g, '');
  const rows = questions.flatMap(({ lesson, question }) => [false, true].map(review => {
    const item = review ? question.review : question;
    return { lesson, question, review, own: lifeItem({ lesson, question, review }), answer: norm(item.choices.find(choice => choice.id === item.answerId)?.text) };
  }));
  assert.equal(rows.length, 132);
  const same = (key, list) => { const keys = new Map(); for (const row of list) { const k = key(row); if (k == null) continue; if (!keys.has(k)) keys.set(k, row.own.familyKey); assert.equal(row.own.familyKey, keys.get(k), `${row.own.itemKey} (${k})`); } };
  same(row => row.answer, rows);
  same(row => ['ko.reading.vocabulary', 'ko.reading.grammar'].includes(row.own.skillId) ? row.question.expressionId : null, rows);
  for (const row of rows.filter(row => row.review && sameChoices(row.question))) assert.equal(row.own.familyKey, lifeItem({ lesson: row.lesson, question: row.question }).familyKey, row.own.itemKey);
  const measured = rows.filter(row => !row.own.confounded);
  // 11-15: 인사 레슨 이름 소개 표현을 마스코트 대신 「저는 수진이에요」로 바꿔, 표현 레슨 이름 문항과 적용 레슨 이름 문항의 정답 글이 같아졌다 — 한 계열로 합쳐져 66 → 65.
  // 11-22: 인사 이야기를 서하 · 지호 · 태오로 바꿔 이야기 감사 문항(태오가 이름표를 찾아 줌)과 그 복습(준호가 책을 주워 줌)의 정답 글이 갈라지고,
  // 이름 복습의 정답이 「저는 준영이에요」가 되어 두 계열이 늘었다 — 65 → 67.
  // 11-26: 길 이야기의 위치 복습(지호가 책을 빌리려고 길을 묻는다)이 장소 낱말을 고르는 문항이라 능력을 낱말 뜻으로 바꿨다. 같은 표현의 낱말 뜻 계열에 들어가 한 계열이 준다 — 67 → 66.
  // 11-26: 버스 이야기의 카드 복습을 「지하철을 탈 때 교통카드를 찍으세요」의 뜻을 고르는 문항으로 바꿔 능력을 낱말 뜻으로 돌렸다. 같은 표현의 낱말 뜻 계열에 들어가 한 계열이 준다 — 66 → 65.
  // 11-27: 버스 표현 레슨의 「다음 정류장」 문항도 「다음」의 뜻을 묻는 문항이라 능력을 낱말 뜻으로 돌렸다(문항 검수 판정). 같은 표현의 낱말 뜻 계열에 들어가 한 계열이 준다 — 65 → 64.
  // 11-27: 버스 적용 레슨의 학교 복습을 「정류장에 버스가 왔어요. 기사님에게 무엇을 물어요?」로 바꿔 능력을 세부 이해로 돌렸다. 낱말 뜻 계열에서 빠져 한 계열이 는다 — 64 → 65.
  assert.deepEqual([measured.length, new Set(measured.map(row => row.own.familyKey)).size], [117, 65]);
  // 정답 · 보기가 바뀐 새 상황 복습은 새 계열(재확인 짝이 될 수 있다).
  const order = rows.find(row => row.own.itemKey === 'life.cafe-expressions-order-transfer'), main = rows.find(row => row.own.itemKey === 'life.cafe-expressions-order');
  assert.notEqual(order.own.familyKey, main.own.familyKey);
  // 식별자에는 한글이 없다(Atlas 식별자 규칙).
  for (const row of rows) assert.match(row.own.familyKey, /^life\.(?:expr\.[a-z0-9-]+|ans\.[0-9a-f]{8})$/);
});

test('예외 열쇠는 그 능력의 문항(본문항 · 복습)만 가리킨다', () => {
  const owner = new Map(questions.flatMap(({ question }) => [[question.id, question.skillId], [question.review.id, question.skillId]]));
  for (const [, skill, , , , exceptions] of source.skills) for (const key of Object.keys(exceptions)) assert.equal(owner.get(key), skill, key);
});

test('장면 레슨 = 카페 방문 레슨(cafe-activity.mjs CAFE_LESSON_IDS)', () => {
  assert.deepEqual(source.scene_lessons, CAFE_LESSON_IDS);
  assert.deepEqual(layer.scene_lessons, CAFE_LESSON_IDS);
});

test('팩마다 상황 합집합이 옛 PACK_SITUATIONS와 같다 — 「내 성향」 관심 · 지금은 아니에요 동작 그대로', () => {
  const old = { greetings: ['sit-people-greeting'], cafe: ['sit-travel-order'], store: ['sit-travel-shopping'],
    directions: ['sit-travel-directions'], transit: ['sit-travel-transport'], plans: ['sit-career-schedule', 'sit-people-messenger'] };
  for (const pack of PACKS) assert.deepEqual(life.lifeSituations(pack.skills.map(skill => skill.id)).sort(), [...old[pack.id]].sort(), pack.id);
});

test('WORLD 코치 지도만 층을 싣는다 — 기본 worldMapData()는 그대로, 층을 실은 지도도 Strata 검증을 지난다', () => {
  const plain = worldMapData(), withLife = life.withLifeLayer(plain);
  assert.ok(!plain.nodes.some(node => node.kind === 'task' && node.id.startsWith('life.task.')));
  assert.equal(withLife.nodes.length, plain.nodes.length + 22);
  assert.equal(withLife.map_ver, `${plain.map_ver}:${layer.layer_ver}`);
  assert.ok(strata.validateMap(withLife));
  const map = strata.createMap(withLife), task = map.getNode('life.task.cafe-order-detail');
  assert.equal(task.kind, 'task'); assert.equal(task.material.ability, 'ko.reading.detail'); assert.deepEqual(task.material.situations, ['sit-travel-order']);
  assert.throws(() => life.withLifeLayer(withLife), /colliding life source/);
});

test('Strata의 응답 꼴 목록 = Core RESPONSE_FORMATS', () => assert.deepEqual(life.FORMATS, RESPONSE_FORMATS));

// 생성 층은 WORLD 계정 묶음 · 공개 엔진 판에 그대로 실린다 — synk.im에는 AI 도구 · 모델 이름을 두지 않는다(10-21 원칙, 검수 요약 글이 마디마다 복사돼 실렸던 일 11-08).
test('생성 층(묶음에 실리는 JSON)에 AI 도구 · 모델 이름이 없다', () => {
  const text = JSON.stringify(layer); // 원천 strata/world-life.json의 설명 글은 묶음에 실리지 않는다(저장소 문서)
  for (const name of ['Opus', 'Fable', 'GPT', 'Claude', 'Gemini', 'Argon', 'Grok', 'Codex', '아르곤', '그록', '페이블', '클로드', '제미나이', '오퍼스', '아스트라'])
    assert.ok(!text.includes(name), name);
});

test('모르는 능력 · 문항은 측정 칸을 지어내지 않는다', () => {
  assert.equal(life.lifeMeasure({ skillId: 'cafe-unknown', questionId: 'cafe-expressions-order', lessonId: 'cafe-expressions' }), null);
  assert.equal(life.lifeMeasure({ skillId: 'cafe-order-detail', questionId: 'Bad Id', lessonId: 'cafe-expressions' }), null);
  assert.equal(life.lifeMeasure({}), null);
  // 그 능력의 팩 · 레슨 꼴에 맞지 않는 문항(끝 판 검수 GPT GB2): 다른 레슨 접두 · 다른 팩의 레슨 · 레슨 없음.
  assert.equal(life.lifeMeasure({ skillId: 'cafe-order-detail', questionId: 'not-a-real-question', lessonId: 'cafe-expressions' }), null);
  assert.equal(life.lifeMeasure({ skillId: 'cafe-order-detail', questionId: 'store-expressions-price', lessonId: 'store-expressions' }), null);
  assert.equal(life.lifeMeasure({ skillId: 'cafe-order-detail', questionId: 'cafe-expressions-order' }), null);
});

test('원고의 이름 꼴: 레슨 id는 <팩>-…, 문항 id는 <레슨>-…, 복습 id는 <문항>-transfer(lifeMeasure가 이 꼴로 모르는 문항을 거른다)', () => {
  for (const pack of PACKS) for (const lesson of pack.lessons) {
    assert.ok(lesson.id.startsWith(`${pack.id}-`), lesson.id);
    for (const question of lesson.questions) { assert.ok(question.id.startsWith(`${lesson.id}-`), question.id); assert.equal(question.review.id, `${question.id}-transfer`); }
  }
});

test('빌더는 잘못된 원천을 거절한다', () => {
  const base = require('../strata/maps/topik-i.json'), src = { path: 'strata/world-life.json', sha256: 'a'.repeat(64) };
  const bad = rows => ({ ...source, skills: rows });
  assert.throws(() => life.buildLifeLayer({ base, life: bad([['cafe', 'x', '이름', 'ko.speaking.x', ['sit-travel-order'], {}]]), source: src }), /unknown ability/);
  assert.throws(() => life.buildLifeLayer({ base, life: bad([['cafe', 'x', '이름', 'ko.reading.detail', ['ko.reading.main'], {}]]), source: src }), /invalid situations/);
  assert.throws(() => life.buildLifeLayer({ base, life: bad([['cafe', 'x', '이름', 'ko.reading.detail', ['sit-travel-order'], { a: { difficulty: 4 } }]]), source: src }), /invalid difficulty/);
  assert.throws(() => life.buildLifeLayer({ base, life: bad([['cafe', 'x', '이름', 'ko.reading.detail', ['sit-travel-order'], { a: 'ko.reading.x' }]]), source: src }), /unknown ability/);
  assert.throws(() => life.buildLifeLayer({ base, life: bad([['cafe', 'x', '이름', 'ko.reading.detail', ['sit-travel-order'], {}], ['cafe', 'x', '이름', 'ko.reading.detail', ['sit-travel-order'], {}]]), source: src }), /invalid row/);
});
