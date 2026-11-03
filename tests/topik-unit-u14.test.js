'use strict';
// TOPIK 3→4급 뼈대 U14의 글 원고(experiences/topik-units/u14.json)가 단원 원천 · 판정기 · 문항 묶음과 맞는지 본다(2026-11-03).
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const content = require('../experiences/topik-units/u14.json');
const units = require('../strata/topik-ii.units.json');
const layer = require('../strata/topik-ii.grammar.json');
const types = require('../strata/topik-types.json').types;
const speaking = require('../strata/maps/ko-speaking.json');
const items = require('../experiences/topik-items/items/tii-u14.json').items;
const unit = units.units.find(row => row.id === 'U14');
const judge = () => import(pathToFileURL(path.join(root, 'tools/lib/드라마판정.mjs')).href);
const lines = () => [...content.cafe.frames, content.measure.B, content.measure.C];
const specOf = row => ({ id: row.id, line: row.말, ...row.명세 });

test('content stays unreviewed and matches the U14 unit', () => {
  assert.equal(content.unit, unit.id);
  assert.equal(content.title, unit.title);
  assert.equal(content.status, 'ai_draft');
  assert.equal(content.reviewed, false);
});

test('fictional numbers add up', () => {
  const { A, B, C } = content.data;
  for (const table of A.tables) assert.equal(table.rows.reduce((sum, row) => sum + row[1], 0), 100, table.q);
  for (const table of A.tables) for (const [, percent] of table.rows) assert.ok(Number.isInteger(A.survey.n * percent / 100), table.q);
  assert.deepEqual(B.rows.map(([, before, after]) => after - before), [30, -30]);
  assert.equal(C.rows.length, 2);
});

test('frames: every U14 grammar point gets three, and each model line uses its form', () => {
  const forms = new Map(layer.points.map(point => [point[0], point[1]]));
  const stem = { S460: '따르면', S461: '비해', S343: '반면', S339: '결과' };
  for (const { id } of unit.grammar) {
    const rows = content.cafe.frames.filter(frame => frame.grammar === id);
    assert.equal(rows.length, 3, `${id} ${forms.get(id)}`);
    for (const row of rows) assert.ok(row.말.includes(stem[id]), `${row.id} ${row.말}`);
  }
  assert.equal(new Set(content.cafe.frames.map(frame => frame.id)).size, content.cafe.frames.length);
});

test('frames and measure cards pass the speaking judge: model and variants pass, a dropped key never earns a sure pass', async () => {
  const { judgeLine, checkSpec } = await judge();
  for (const row of lines()) {
    const spec = specOf(row);
    assert.deepEqual(checkSpec(spec), [], `${row.id} spec`);
    assert.equal(judgeLine(spec, { transcript: row.말 }).verdict, 'pass', `${row.id} model`);
    for (const variant of row.명세.variants) assert.equal(judgeLine(spec, { transcript: variant }).verdict, 'pass', `${row.id} ${variant}`);
    // 판정기는 짧은 말을 근사로도 찾아서 빠진 말이 「확신 없는 통과」로 남을 수 있다. 혼자 해냄으로 세는 것은 확실한 통과뿐이다.
    for (const key of row.명세.keys) {
      if (!row.말.includes(key.word)) continue;
      // 같은 말의 허용 표현이 문장에 함께 있으면 그 말은 빠진 것이 아니다.
      const dropped = [key.word, ...(key.alts || [])].reduce((line, word) => line.split(word).join(''), row.말);
      const result = judgeLine(spec, { transcript: dropped });
      assert.equal(result.verdict === 'pass' && result.sure, false, `${row.id} drops ${key.word}`);
    }
  }
});

test('measure cards: the likeliest wrong answers never earn a sure pass', async () => {
  const { judgeLine } = await judge();
  const wrong = {
    B: ['설문 결과에 따르면 학생의 절반이 저녁에 커피를 찾습니다.', '설문 결과에 따르면 커피를 찾습니다.'],
    C: ['평소에 비해 시험 기간에는 밤에 손님이 적어요.', '평소에 비해 시험 기간에는 오후에 손님이 많아요.', '평소보다 밤에는 별로 안 많아요.', '평소에 비해 시험 기간에는 밤에 손님이 안 많아요.', '평소에 비해 시험 기간에는 밤에 손님이 많지 않아요.'],
  };
  for (const [name, says] of Object.entries(wrong)) {
    const spec = specOf(content.measure[name]);
    for (const say of says) {
      const result = judgeLine(spec, { transcript: say });
      assert.equal(result.verdict === 'pass' && result.sure, false, `${name} ${say}`);
    }
  }
});

test('a taste choice comes back: the two options each return in a frame', () => {
  const labels = content.cafe.open.taste.options.map(option => option.label).sort();
  const back = content.cafe.frames.filter(frame => frame.앞줄).map(frame => frame.앞줄.when).sort();
  assert.deepEqual(back, labels);
});

test('frames use the listener the cast declares, and the measure data is not shown first in practice', () => {
  for (const row of lines()) assert.equal(row.명세.to, content.cast[row.손님].to, row.id);
  assert.equal(content.cafe.frames.some(frame => frame.data === 'C'), false);
  assert.equal(content.cafe.open.shows, 'A');
  for (const row of content.club) assert.notEqual(row.자료, 'C', row.id);
  for (const row of content.writing) assert.notEqual(row.자료, 'C', row.id);
  const measured = content.measure.C.말;
  for (const frame of content.cafe.frames) assert.notEqual(frame.말, measured);
});

test('measure cards carry a learner-language situation and a real speaking skill', () => {
  const skills = new Set(speaking.nodes.filter(node => node.kind === 'skill').map(node => node.id));
  for (const card of [content.measure.B, content.measure.C]) {
    assert.ok(skills.has(card.능력), card.id);
    for (const lang of ['ko', 'en', 'mn']) assert.ok(card.상황[lang], `${card.id} ${lang}`);
    // 상황 카드는 답을 먼저 주지 않는다(드라마 §3-5).
    for (const key of card.명세.keys) if (!card.손님말.includes(key.word)) assert.equal(card.상황.ko.includes(key.word), false, `${card.id} ${key.word}`);
  }
});

test('reading choice loses nothing, taste choice changes the next visit', () => {
  const { choice, taste } = content.cafe.open;
  assert.deepEqual(choice.options.map(option => option.result).sort(), ['more', 'same']);
  for (const option of taste.options) assert.ok(option.next, option.label);
});

test('club and writing tasks: official types exist, writing models stay within 200~300 characters and in plain style', () => {
  const ids = new Set(types.map(type => type.id));
  for (const row of [...content.club, ...content.writing]) assert.ok(ids.has(row.topik), row.id);
  for (const row of content.club) {
    assert.equal(row.must.length, 3, row.id);
    assert.ok(row.reactions.length >= 3 && row.reactions.length <= 5, row.id);
    assert.equal(row.model.split(/(?<=[.!?])\s+/).length, 3, row.id);
  }
  for (const row of content.writing) {
    assert.ok(row.model.length >= 200 && row.model.length <= 300, `${row.id} ${row.model.length}`);
    for (const sentence of row.model.split(/(?<=[.!?])\s+/)) assert.match(sentence, /다\.$/, `${row.id} ${sentence}`);
    assert.equal(row.course, unit.course.writing === 'W3' && row.주 === 1 ? 'W3' : 'W4', row.id);
  }
});

test('the U14 item batch stays a draft of the listed items, and sets share one text', () => {
  assert.deepEqual(items.map(item => item.id), content.items);
  for (const item of items) {
    assert.ok(unit.skills.includes(item.skillId) || ['ko2.reading.grammar', 'ko2.reading.main', 'ko2.listening.main'].includes(item.skillId), item.id);
    assert.equal(item.answer >= 0 && item.answer < item.choices.length, true, item.id);
  }
  const bySet = new Map();
  for (const item of items) if (item.set) bySet.set(item.set.id, [...(bySet.get(item.set.id) || []), item]);
  for (const members of bySet.values()) assert.equal(new Set(members.map(item => JSON.stringify([item.passage, item.script]))).size, 1);
});
