'use strict';
// Example sentences for the situations a learning reason leads to (Strata's example layer): the
// "예문" of the learning-reasons contract. Every situation has sentences, a sentence taken from a
// game is that game's own text, the map's form reader reads their grammar, and the account summary
// carries them only when the host asks. Drafts say they are drafts.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createMap } = require('../strata');
const { topikMap } = require('../strata/topik-i');
const { situationExamples, MAX_LENGTH } = require('../strata/topik-i-examples');
const { grammarIn } = require('../strata/topik-i-forms');
const source = require('../strata/topik-i.situation-examples.json');
const situations = require('../strata/topik-i.situations.json');
const raw = require('../strata/maps/topik-i.json');
const { summarizeAccount } = require('../atlas/account-summary');

const map = createMap(topikMap({ includeWords: false }));
const layer = situationExamples(map, { grammarIn });
const asOf = '2026-10-05T12:00:00.000Z';
const load = rel => import(pathToFileURL(path.join(__dirname, '..', rel)).href);

test('every situation has three sentences under ids that name it, and the layer follows the situations it was written for', () => {
  assert.equal(source.situations_ver, situations.version);
  assert.deepEqual(Object.keys(source.examples), situations.situations.map(([id]) => id), 'the situations file\'s order');
  const all = layer.all();
  assert.equal(all.length, situations.situations.length);
  for (const { situation, examples } of all) {
    assert.equal(examples.length, 3, situation);
    examples.forEach((e, i) => assert.equal(e.id, `ex-${situation.slice(4)}-${i + 1}`));
  }
  const sentences = all.flatMap(s => s.examples.map(e => e.ko));
  assert.equal(new Set(sentences).size, sentences.length, 'no sentence twice');
  assert.ok(sentences.every(ko => /[.?!]$/.test(ko) && ko.length <= MAX_LENGTH && !/[a-zA-Z]/.test(ko)), 'short Korean sentences');
  assert.deepEqual(layer.examplesFor('sit-nowhere'), [], 'an unknown situation has no sentences');
  assert.deepEqual(layer.examplesFor('ko.reading.grammar'), [], 'an ability is not a situation');
});

test('the sentences are drafts until a teacher reviews them, and say so one by one', () => {
  assert.equal(source.review.confidence, 'ai_draft');
  const all = layer.all().flatMap(s => s.examples);
  assert.ok(all.every(e => e.confidence === 'ai_draft' && e.reviewed === source.review.reviewed.includes(e.id)));
  const one = structuredClone(source); one.review.reviewed = ['ex-travel-order-1'];
  const marked = situationExamples(map, { data: one }).examplesFor('sit-travel-order');
  assert.deepEqual(marked.map(e => e.reviewed), [true, false, false]);
});

test('a sentence taken from a game is that game\'s own text', async () => {
  const [{ ORDERS, REVIEW }, { VENUES }, runner] = await Promise.all([
    load('experiences/order-rush/core.mjs'), load('experiences/entry-check/content.mjs'), load('experiences/korean-runner/instructions.mjs')]);
  const orders = new Map([...(ORDERS || []), ...(REVIEW || [])].map(o => [o.id, o.text]));
  const rules = new Map(VENUES.flatMap(v => v.notice.rules.map(r => [`${v.id}.${r.id}`, r.text])));
  const instructions = new Map((runner.INSTRUCTIONS || runner.default || []).map(i => [i.id, i.text]));
  const origin = { 'order-rush': orders, 'entry-check': rules, 'korean-runner': instructions };
  const taken = layer.all().flatMap(s => s.examples).filter(e => e.from);
  assert.equal(taken.length, 7, 'orders, notices and a spoken direction');
  for (const e of taken) {
    const [game, item] = e.from.split('/');
    const text = origin[game]?.get(item);
    assert.ok(typeof text === 'string', `${e.id}: ${e.from} exists`);
    // The whole item, or one whole sentence of it.
    assert.ok(text === e.ko || text.split(/(?<=[.?!])\s+/).includes(e.ko), `${e.id}: 「${e.ko}」 is in 「${text}」`);
  }
});

test('the map\'s form reader reads each sentence, and every point it names is a TOPIK I grammar point', () => {
  const all = layer.all().flatMap(s => s.examples);
  for (const e of all) {
    assert.deepEqual([...e.grammar], grammarIn(e.ko), e.id);
    for (const point of e.grammar) assert.equal(map.getNode(point)?.kind, 'grammar_point', `${e.id}: ${point}`);
  }
  assert.deepEqual([...layer.examplesFor('sit-travel-order')[1].grammar], ['G404'], '설탕은 빼 주세요');
  assert.deepEqual([...layer.examplesFor('sit-work-instructions')[2].grammar], ['G406', 'G211'], '끄기 전에 확인하세요');
  // Forms the reader used to misread on these sentences (topik-i-forms.js, 2026-10-05).
  assert.deepEqual([...layer.examplesFor('sit-travel-lodging')[2].grammar], ['G211'], '더 주세요 is not -아/어 주세요');
  assert.deepEqual([...layer.examplesFor('sit-study-lecture')[2].grammar], [], '모르겠어요 is not a past');
  assert.deepEqual([...layer.examplesFor('sit-study-professor-email')[0].grammar], [], '안녕하십니까 is not -(으)니까');
  assert.ok(all.filter(e => e.grammar.length).length >= all.length / 2, 'most sentences show a point the map can name');
});

test('a broken layer is refused', () => {
  const broken = mutate => { const data = structuredClone(source); mutate(data); return () => situationExamples(map, { data }); };
  assert.throws(broken(d => { d.examples['sit-nowhere'] = d.examples['sit-travel-order']; }), /unknown situation/);
  assert.throws(broken(d => { delete d.examples['sit-travel-order']; }), /has no examples/);
  assert.throws(broken(d => { d.examples['sit-travel-order'][1][0] = 'ex-travel-order-1'; }), /invalid or duplicate example id/);
  assert.throws(broken(d => { d.examples['sit-travel-order'][0][0] = 'ex-travel-shopping-9'; }), /invalid or duplicate example id/);
  assert.throws(broken(d => { d.examples['sit-travel-order'][0][1] = '커피 주세요'; }), /invalid sentence/);
  assert.throws(broken(d => { d.examples['sit-travel-order'][0][1] = `${'아주 '.repeat(12)}좋아요.`; }), /invalid sentence/);
  assert.throws(broken(d => { d.review.reviewed = ['ex-nowhere-1']; }), /is not an example/);
  assert.throws(broken(d => { d.review.confidence = 'authored'; }), /invalid review status/);
  assert.throws(() => situationExamples(null), /a map is required/);
  assert.throws(() => situationExamples(map, { grammarIn: 'reader' }), /invalid form reader/);
  assert.throws(() => situationExamples(map, { grammarIn: () => ['G999'] }), /unknown grammar/);
});

test('a host that only shows sentences carries no form reader: the layer requires nothing but its sentences', () => {
  const shown = situationExamples(map);
  assert.deepEqual(shown.examplesFor('sit-travel-order').map(e => [e.id, e.ko, e.grammar, e.reviewed]), [
    ['ex-travel-order-1', '따뜻한 커피 한 잔 주세요.', null, false], ['ex-travel-order-2', '설탕은 빼 주세요.', null, false], ['ex-travel-order-3', '따뜻한 커피 대신 차 한 잔 주세요.', null, false]]);
  const code = require('node:fs').readFileSync(require.resolve('../strata/topik-i-examples'), 'utf8');
  assert.deepEqual([...code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]), ['./topik-i.situation-examples.json']);
});

test('the layer stays out of the games\' map: no node, edge or version of the built map names an example', () => {
  const text = JSON.stringify(raw);
  assert.ok(!text.includes('ex-travel-order-1') && !text.includes('situation-examples'));
  assert.ok(!Object.keys(raw.sources).some(key => /example/.test(key)));
});

test('the account summary carries a situation\'s sentences only when the host passes the layer', () => {
  const plain = summarizeAccount({ events: [], map, asOf, reasons: ['travel'] });
  assert.deepEqual(plain.forReasons[0].situations[1], { id: 'sit-travel-order', label: '주문', line: '주문할 때 쓰는 말이라 골랐어요.' }, 'as before');
  const summary = summarizeAccount({ events: [], map, asOf, reasons: ['travel', 'people', 'exam'], examples: layer.examplesFor });
  assert.deepEqual(summary.forReasons.map(r => r.reason), ['travel', 'people']);
  assert.deepEqual(summary.forReasons[0].situations[1], { id: 'sit-travel-order', label: '주문', line: '주문할 때 쓰는 말이라 골랐어요.', examples: [
    { id: 'ex-travel-order-1', ko: '따뜻한 커피 한 잔 주세요.', reviewed: false },
    { id: 'ex-travel-order-2', ko: '설탕은 빼 주세요.', reviewed: false },
    { id: 'ex-travel-order-3', ko: '따뜻한 커피 대신 차 한 잔 주세요.', reviewed: false }] });
  assert.equal(summary.forReasons[1].situations[0].examples[0].ko, '오랜만이에요!');
  // Sentences are where practice happens, in words: no evidence, ability or grade comes from them.
  assert.equal(summary.basis, 'self-declared');
  assert.deepEqual([summary.abilityClaim, summary.learningEffectClaim, summary.grade], [false, false, null]);
  assert.throws(() => summarizeAccount({ events: [], map, asOf, reasons: ['travel'], examples: {} }), /invalid examples/);
  // A host layer that knows nothing of a situation leaves it without sentences.
  const none = summarizeAccount({ events: [], map, asOf, reasons: ['travel'], examples: () => [] });
  assert.deepEqual(none.forReasons[0].situations[0].examples, []);
});
