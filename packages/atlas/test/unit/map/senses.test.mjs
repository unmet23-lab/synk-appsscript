// 낱말 뜻 고르기(src/map/senses.mjs · map/senses.json, 11-11): 단위 id는 그대로 품사 · 뜻만 바꾸고, 자리를 빼앗긴 뜻은 원천 끝
// 다음 번호로 덧붙이고, 원천이 바뀌어 낡은 고르기 · 같은 글을 가를 수 없는 단위는 멈춘다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT, subject } from '../../support/subject.mjs';

const { applySenses, SENSES_FORMAT } = await subject('map/senses.mjs');
const { openMap } = await subject('map/index.mjs');

const SOURCE = [
  ['w0001', '개', '의', 'A', '개10'],
  ['w0002', '주다', '보', 'A', '주다01'],
  ['w0003', '배', '명', 'A', '배02'],
];
const senses = (words = {}, added = []) => ({ format: SENSES_FORMAT, words, added });

test('고르기가 없으면 원천 줄 그대로(표제어 칸은 빼고)', () => {
  assert.deepEqual(applySenses(SOURCE), [
    ['w0001', '개', '의', 'A'],
    ['w0002', '주다', '보', 'A'],
    ['w0003', '배', '명', 'A'],
  ]);
});

test('품사 · 뜻을 바꿔도 id는 그대로이고, 풀이만 있는 줄은 뜻만 붙는다', () => {
  const out = applySenses(
    SOURCE,
    senses({
      w0002: { pos: '동', sense: '건네다', from: { pos: '보', entry: '주다01' } },
      w0003: { entry: '배02', sense: '타는 배' },
    }),
  );
  assert.deepEqual(out[1], ['w0002', '주다', '동', 'A', '건네다']);
  assert.deepEqual(out[2], ['w0003', '배', '명', 'A', '타는 배']);
});

test('자리를 빼앗긴 뜻은 원천 끝 다음 번호로 덧붙고, 같은 글 둘은 뜻으로 갈린다', () => {
  const out = applySenses(
    SOURCE,
    senses(
      { w0001: { pos: '명', entry: '개03', sense: '동물 개', from: { pos: '의', entry: '개10' } } },
      [{ id: 'w0004', word: '개', pos: '의', band: 'A', entry: '개10', sense: '물건을 세는 말' }],
    ),
  );
  assert.deepEqual(out[0], ['w0001', '개', '명', 'A', '동물 개']);
  assert.deepEqual(out[3], ['w0004', '개', '의', 'A', '물건을 세는 말']);
});

test('멈춤 — 원천에 없는 낱말 · 원천과 다른 from · from 없는 품사 바꾸기 · 다른 표제어 풀이', () => {
  const stops = [
    { w0099: { sense: '없다' } },
    { w0002: { pos: '동', from: { pos: '동', entry: '주다01' } } },
    { w0002: { pos: '동' } },
    { w0003: { entry: '배01', sense: '몸의 배' } },
  ];
  for (const words of stops)
    assert.throws(() => applySenses(SOURCE, senses(words)), /Atlas map/, JSON.stringify(words));
});

test('멈춤 — 덧붙인 번호가 원천과 겹침 · 빈틈 · 뜻 없음, 같은 글인데 뜻이 없거나 같음', () => {
  // 번호 · 뜻 칸만 보는 경우는 원천에 없는 글(눈)로 — 같은 글 검사가 먼저 멈춰 번호 검사를 가리지 않게(변형이 잡도록).
  const add = (id, extra = {}) => ({
    id,
    word: '눈',
    pos: '명',
    band: 'A',
    sense: '보는 눈',
    ...extra,
  });
  assert.equal(applySenses(SOURCE, senses({}, [add('w0004')])).length, 4);
  const stops = [
    senses({}, [add('w0003')]),
    senses({}, [add('w0005')]),
    senses({}, [add('w0004', { sense: '' })]),
    senses({}, [add('w0004', { word: '배', sense: '몸의 배' })]),
    senses({ w0003: { entry: '배02', sense: '몸의 배' } }, [
      add('w0004', { word: '배', sense: '몸의 배' }),
    ]),
    { format: 'atlas-map-senses/0', words: {}, added: [] },
  ];
  for (const given of stops)
    assert.throws(() => applySenses(SOURCE, given), /Atlas map/, JSON.stringify(given));
});

test('커밋된 지도 — 뜻 고르기가 낱말 단위에 실려 있다(주제 단계 · 보조 용언 · 덧붙인 뜻)', () => {
  const read = name => JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'map', name), 'utf8'));
  const picks = read('senses.json');
  const map = openMap({
    index: read('index.json'),
    units: read('units.json'),
    words: read('words.json'),
  });
  for (const [id, pick] of Object.entries(picks.words)) {
    const unit = map.unit(`ko.word.${id}`);
    assert.equal(unit.sense, pick.sense ?? null, id);
    if (pick.pos) assert.equal(unit.pos, pick.pos, id);
  }
  for (const word of picks.added) {
    const unit = map.unit(`ko.word.${word.id}`);
    assert.deepEqual([unit.label, unit.pos, unit.sense], [word.word, word.pos, word.sense]);
  }
  // 보조 용언(보)은 본용언이 없는 싶다만 남는다.
  const aux = read('words.json').units.filter(([, , pos]) => pos === '보');
  assert.deepEqual(
    aux.map(([, label]) => label),
    ['싶다'],
  );
});
