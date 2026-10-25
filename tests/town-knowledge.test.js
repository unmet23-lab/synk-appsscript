'use strict';
// 싱크타운 전해 듣기(세로 조각 설계 §9-2·§9-3, W5, 시험 §15-5 town-knowledge) — 목격·쌍 만남·마을 소식, 주민당 최근 열여섯,
// 플레이어와 한 일은 당사자의 비밀로만(G6), 인사로 한 번 말하기, 나눠 닫아도 같은 결과.
const test = require('node:test');
const assert = require('node:assert/strict');
const { townModule } = require('./lib/town.js');

const LIFE = 20748, MIN = 60000, HOUR = 60 * MIN, TZ = 540;
const DAY0 = Date.UTC(2026, 9, 22, 5, 0) - TZ * MIN;
const line = (card, extra = {}) => ({ ref: `${LIFE}.day.${card}`, card, key: `${LIFE}.day.0`, path: 'self', actors: ['cafe-owner'], place: 'cafe', atMs: DAY0 + 7 * HOUR, public: true, ...extra });
const at = places => npc => places[npc] ?? null;

test('목격 — 공개된 결과는 그 순간 그 장소에 있던 주민이 직접 알고, 당사자와 다른 곳의 주민은 목격으로 알지 않는다', async () => {
  const k = await townModule('knowledge'), v = {};
  k.learnBand(v, { lifeDay: LIFE, resolved: [line('C1')], scenes: [] }, at({ 'cafe-owner': 'cafe', 'workshop-owner': 'cafe', researcher: 'greenhouse' }));
  assert.deepEqual(v.knowledge.known['workshop-owner'].map(e => [e.ref, e.how]), [[`${LIFE}.day.C1`, 'direct']]);
  assert.equal(v.knowledge.known['cafe-owner'], undefined, '당사자');
  assert.equal(v.knowledge.known.researcher, undefined, '다른 장소');
  assert.deepEqual(v.happened.map(e => e.ref), [`${LIFE}.day.C1`]);
  assert.deepEqual(Object.keys(v.knowledge.known['workshop-owner'][0]).sort(), ['actors', 'card', 'how', 'path', 'place', 'ref'], '앎은 내용을 그대로 든다(F10)');
});

test('쌍 만남 — 상대가 모르는 가장 최근 공개 사건을 하나씩, 주민당 생활일 둘까지, 그 일을 한 주민에게는 전하지 않는다', async () => {
  const k = await townModule('knowledge'), v = {};
  const seen = ['C1', 'C3', 'C5'].map((card, i) => line(card, { atMs: DAY0 + (7 + i) * HOUR }));
  k.learnBand(v, { lifeDay: LIFE, resolved: seen, scenes: [] }, at({ 'workshop-owner': 'cafe' }));
  const scene = (a, b, h) => ({ pair: 'x', family: 'chat', members: [a, b], atMs: DAY0 + h * HOUR });
  k.learnBand(v, { lifeDay: LIFE, resolved: [], scenes: [scene('workshop-owner', 'researcher', 11), scene('workshop-owner', 'researcher', 11.5), scene('workshop-owner', 'researcher', 12)] }, at({}));
  assert.deepEqual(v.knowledge.known.researcher.map(e => [e.card, e.how, e.from]), [['C5', 'heard', 'workshop-owner'], ['C3', 'heard', 'workshop-owner']], '최근 것부터, 하루 둘');
  k.learnBand(v, { lifeDay: LIFE, resolved: [], scenes: [scene('workshop-owner', 'cafe-owner', 13)] }, at({}));
  assert.equal(v.knowledge.known['cafe-owner'], undefined, '그 일을 한 주민에게는 전하지 않는다');
  k.learnBand(v, { lifeDay: LIFE + 1, resolved: [], scenes: [scene('workshop-owner', 'researcher', 34)] }, at({}));
  assert.deepEqual(v.knowledge.known.researcher.map(e => e.card), ['C5', 'C3', 'C1'], '새 생활일에는 다시 들을 수 있다');
});

test('마을 소식 — 새 생활일에 지난날의 소식 카드 둘까지(흔적 > 새 차 > 합의), 당사자 빼고 모두, 쪽지는 최근 셋만 날짜 없이', async () => {
  const k = await townModule('knowledge'), v = {};
  const day = [line('W3', { actors: ['workshop-owner'], place: 'lane' }), line('C3', { atMs: DAY0 + 8 * HOUR }), line('C2'), line('C1', { atMs: DAY0 + 9 * HOUR })];
  k.learnBand(v, { lifeDay: LIFE, resolved: day, scenes: [] }, at({}));
  assert.equal(k.morningNews(v, LIFE), 2);
  assert.deepEqual(v.news.map(n => n.card), ['C1', 'C3'], '흔적(C1) 다음 새 차(C3) — 합의(W3)와 소식 아닌 C2는 빠진다');
  for (const npc of ['workshop-owner', 'researcher']) assert.deepEqual(v.knowledge.known[npc].map(e => [e.card, e.how]), [['C1', 'news'], ['C3', 'news']]);
  assert.equal(v.knowledge.known['cafe-owner'], undefined, '자기 일을 소식으로 다시 알지 않는다');
  assert.equal(k.morningNews(v, LIFE), 0, '같은 날의 소식은 한 번');
  for (let d = 1; d <= 3; d++) { k.learnBand(v, { lifeDay: LIFE + d, resolved: [line('R1', { ref: `${LIFE + d}.day.R1`, actors: ['researcher'], place: 'greenhouse' })], scenes: [] }, at({})); k.morningNews(v, LIFE + d); }
  const note = k.noteOf(v);
  assert.deepEqual(note.map(n => n.ref), [`${LIFE + 3}.day.R1`, `${LIFE + 2}.day.R1`, `${LIFE + 1}.day.R1`], '최근 셋, 새것부터');
  assert.ok(note.every(n => !('lifeDay' in n) && !('atMs' in n)), '날짜 없이(G3)');
});

test('G6 — 플레이어와 한 일은 당사자의 비밀로만: 목격·쌍 만남·소식·인사로 퍼지지 않는다', async () => {
  const k = await townModule('knowledge'), v = {};
  const mine = line('C1', { path: 'player', public: false, actors: ['cafe-owner', 'workshop-owner', 'player'] });
  k.learnPrivate(v, mine);
  assert.deepEqual(['cafe-owner', 'workshop-owner'].map(npc => v.knowledge.known[npc].map(e => e.how)), [['private'], ['private']]);
  k.learnBand(v, { lifeDay: LIFE, resolved: [mine], scenes: [{ pair: 'x', family: 'chat', members: ['workshop-owner', 'researcher'], atMs: DAY0 + 9 * HOUR }] }, at({ researcher: 'cafe' }));
  assert.equal(v.knowledge.known.researcher, undefined, '그 자리에 있어도, 쌍 만남으로도 모른다');
  assert.equal(k.morningNews(v, LIFE), 0);
  assert.equal(k.hearsayFor(v, 'workshop-owner'), null, '인사로도 말하지 않는다');
  assert.deepEqual(k.privateOf(v, 'cafe-owner').map(e => e.ref), [mine.ref]);
  assert.deepEqual(k.privateOf(v, 'cafe-owner', [{ npc: 'cafe-owner', target: mine.ref }]), [], '잊어 달라고 하면 빠진다');
});

test('인사 — 그 주민이 아는 것 가운데 아직 말하지 않은 가장 최근 것 하나, 한 번만 · 주민당 최근 열여섯 · 망가진 앎은 막는다', async () => {
  const k = await townModule('knowledge'), v = {};
  const many = Array.from({ length: 20 }, (_, i) => line('C1', { ref: `${LIFE + i}.day.C1`, atMs: DAY0 + i * 24 * HOUR }));
  for (const [i, item] of many.entries()) k.learnBand(v, { lifeDay: LIFE + i, resolved: [item], scenes: [] }, at({ researcher: 'cafe' }));
  assert.equal(v.knowledge.known.researcher.length, 16, '최근 열여섯');
  assert.equal(v.knowledge.known.researcher[0].ref, many[4].ref);
  const first = k.hearsayFor(v, 'researcher');
  assert.equal(first.ref, many[19].ref);
  assert.ok(k.tell(v, 'researcher', first.ref) && !k.tell(v, 'researcher', first.ref), '한 번만');
  assert.equal(k.hearsayFor(v, 'researcher').ref, many[18].ref);
  assert.ok(k.validKnowledge(v));
  assert.equal(k.validKnowledge({ ...v, knowledge: { ...v.knowledge, known: { researcher: [{ ref: 'x', how: 'gossip' }] } } }), false);
});

test('인사 — 말로 전할 수 있는 것만(W5b): 소식 줄이 없는 카드나 소식이 되지 않는 길은 주민끼리만 알고 플레이어에게는 건너뛴다', async () => {
  const k = await townModule('knowledge'), v = {};
  // C1 혼자(소식 ○) → C2 혼자(소식 없음) → C4 혼자(소식은 둘이 길만) 순으로 연구원이 봤다 — 인사는 가장 최근의 말할 수 있는 것.
  const seen = [line('C1', { atMs: DAY0 + 7 * HOUR }), line('C2', { atMs: DAY0 + 8 * HOUR }), line('C4', { atMs: DAY0 + 9 * HOUR })];
  k.learnBand(v, { lifeDay: LIFE, resolved: seen, scenes: [] }, at({ researcher: 'cafe' }));
  assert.deepEqual(v.knowledge.known.researcher.map(e => e.card), ['C1', 'C2', 'C4'], '셋 다 안다');
  assert.equal(k.hearsayFor(v, 'researcher').card, 'C1');
  assert.deepEqual(['C1', 'C2', 'C3', 'W2', 'R4'].map(card => k.tellable({ card, path: 'self' })), [true, false, true, false, true]);
  assert.deepEqual(['self', 'pair'].map(path => k.tellable({ card: 'C4', path })), [false, true]);
  k.tell(v, 'researcher', `${LIFE}.day.C1`);
  assert.equal(k.hearsayFor(v, 'researcher'), null, '말할 것이 더 없다 — 남은 둘은 말로 못 전한다');
});

test('결산 결합 — 마을을 여러 번 나눠 닫아도 한 번에 닫은 것과 지식·소식·일어난 일·카드가 같다', async () => {
  const village = await townModule('village');
  const base = { seed: 'knowledge-split', offsetMin: TZ, revision: 3 }, end = DAY0 + 4 * 24 * HOUR;
  const once = village.initialVillage(), split = village.initialVillage();
  village.closeBands(once, { ...base, nowMs: DAY0 }); village.closeBands(split, { ...base, nowMs: DAY0 });
  village.closeBands(once, { ...base, nowMs: end });
  for (let t = DAY0 + 3 * HOUR; t <= end; t += 5 * HOUR + 17 * MIN) village.closeBands(split, { ...base, nowMs: t });
  village.closeBands(split, { ...base, nowMs: end });
  assert.deepEqual(split, once);
  assert.ok(once.happened?.length > 0 && once.news?.length > 0, '나흘에 일어난 일과 소식이 있다');
});
