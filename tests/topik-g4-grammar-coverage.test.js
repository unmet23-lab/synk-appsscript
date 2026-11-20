'use strict';
// 국립국어원 등급 목록의 4급 연결어미 17개와 표현 26개, 모두 43개 문형마다 「AI 2중 검수를 통과했고 그 문형이 주 단위로 적힌 문항」이
// 서로 다른 계열로 둘 이상 있는지 센다. 놓친 문형은 다른 문항으로 한 번 더 내야 하기 때문이다
// (docs/WORLD_TOPIK4급_기출반영_설계_20261120.md 6절). 주 단위는 지도 색인(packages/atlas/map/index.json)의 units 첫째다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const grammar = require('../strata/topik-ii.grammar.json');
const index = require('../packages/atlas/map/index.json');

const field = name => grammar.fields.indexOf(name);
const TARGETS = grammar.points.filter(point => point[field('level')] === 4 && ['연결어미', '표현'].includes(point[field('category')]));

test('4급 연결어미와 표현은 43개다(S414~S430 · S442~S467)', () => {
  const ids = TARGETS.map(point => point[field('id')]);
  const wanted = [];
  for (let n = 414; n <= 430; n += 1) wanted.push(`S${n}`);
  for (let n = 442; n <= 467; n += 1) wanted.push(`S${n}`);
  assert.deepEqual(ids, wanted);
});

test('43개 문형마다 그 문형이 주 단위인 검수 통과 문항이 서로 다른 계열로 둘 이상 있다', async () => {
  const bank = await import(pathToFileURL(path.join(root, 'experiences/topik-items/bank.mjs')));
  const reviewed = new Set(bank.REVIEWED_ITEMS.map(bank.itemKeyOf));
  const col = name => index.fields.indexOf(name);
  const families = new Map();
  for (const row of index.items) {
    if (row[col('bank')] !== 'topik-items' || !reviewed.has(row[col('itemKey')])) continue;
    const main = row[col('units')][0];
    if (!main) continue;
    if (!families.has(main)) families.set(main, new Set());
    families.get(main).add(row[col('f')]);
  }
  const short = TARGETS
    .map(point => ({ id: point[field('id')], form: point[field('form')], items: families.get(`ko.grammar.${point[field('id')]}`)?.size || 0 }))
    .filter(row => row.items < 2);
  assert.deepEqual(short, [], `통과 문항이 둘보다 적은 문형: ${short.map(row => `${row.id} ${row.form}(${row.items})`).join(' · ')}`);
});
