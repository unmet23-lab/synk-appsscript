import test from 'node:test';
import assert from 'node:assert/strict';
import { getMeCard, DAY_MASTER_TRAITS } from '../me.mjs';
import { getSaju } from '../saju-core.mjs';
import { assertGentle } from './fortune-text.mjs';

const today = '2026-10-14';

test('나 카드는 띠·일간·태양 별자리·오행 분포를 모은다', () => {
  const card = getMeCard({ birthDate: '1990-05-17', birthTime: null, today });
  assert.deepEqual(card.animal, { id: 'horse', label: '말띠', name: '말', branch: '오', hanja: '午' });
  assert.equal(card.dayMaster.label, '임수 · 큰 바다');
  assert.equal(card.dayMaster.element, '수');
  assert.match(card.dayMaster.trait, /편이에요\.$/);
  assert.equal(card.zodiac.signId, 'taurus');
  assert.equal(card.zodiac.label, '황소자리');
  assert.deepEqual(card.zodiac.element, { id: 'earth', label: '흙' });
  assert.equal(card.timeKnown, false);
  assert.equal(card.countedCharacters, 6);
  assert.deepEqual(card.elements, getSaju({ birthDate: '1990-05-17', birthTime: null }, today).elements.map(({ id, label, hanja, count }) => ({ id, label, hanja, count })));
  assert.match(card.elementSummary, /^확인된 글자 6개 중 /);
  assert.ok(card.notes.some(note => note.includes('시주를 비워')));
  assert.deepEqual(card, getMeCard({ birthDate: '1990-05-17', birthTime: null, today }));
  assert.equal(Object.isFrozen(card.dayMaster), true);
});

test('띠는 입춘 기준이고, 입춘 당일 시간을 모르면 띠를 정하지 않는다', () => {
  assert.equal(getMeCard({ birthDate: '2000-01-15', today }).animal.label, '토끼띠', '2000년 1월은 앞해(기묘) 토끼띠');
  assert.equal(getMeCard({ birthDate: '2024-02-04', birthTime: '17:26', today }).animal.label, '토끼띠');
  assert.equal(getMeCard({ birthDate: '2024-02-04', birthTime: '17:28', today }).animal.label, '용띠');
  const unknown = getMeCard({ birthDate: '2024-02-04', birthTime: null, today });
  assert.equal(unknown.animal, null);
  assert.match(unknown.animalNote, /입춘 당일/);
  assert.equal(unknown.dayMaster.name, '무토', '일간은 시간 없이도 정해진다');
});

test('오행 요약은 가장 많은 오행과 보이지 않는 오행을 부드럽게 적는다', () => {
  const card = getMeCard({ birthDate: '2005-12-23', birthTime: '08:37', today });
  assert.equal(card.countedCharacters, 8);
  assert.deepEqual(card.dominantElements, ['토', '금', '수']);
  assert.deepEqual(card.missingElements, []);
  assert.equal(card.elementSummary, '확인된 글자 8개 중 토·금·수가 2개로 가장 많아요. 다섯 오행이 모두 한 번 이상 보여요.');
  for (let index = 0; index < 120; index++) {
    const birthDate = new Date(Date.UTC(1950, 0, 1) + index * 211 * 86_400_000).toISOString().slice(0, 10);
    const sample = getMeCard({ birthDate, birthTime: index % 2 ? null : '12:00', today });
    for (const label of sample.missingElements) assert.ok(sample.elementSummary.includes(label));
    if (sample.missingElements.length) assert.match(sample.elementSummary, /없다는 뜻은 아니에요\.$/);
    assertGentle(sample, birthDate);
  }
});

test('일간 열 가지 모두 그림과 한 줄 성향이 있고 서로 다르다', () => {
  assert.equal(DAY_MASTER_TRAITS.length, 10);
  assert.equal(new Set(DAY_MASTER_TRAITS.map(item => item.trait)).size, 10);
  assert.equal(new Set(DAY_MASTER_TRAITS.map(item => item.image)).size, 10);
  assertGentle(DAY_MASTER_TRAITS, '일간 성향');
});

test('잘못된 생년월일·시간·미래 출생을 거부한다', () => {
  assert.throws(() => getMeCard({ birthDate: '1990-02-30', today }), TypeError);
  assert.throws(() => getMeCard({ birthDate: '1990-01-01', birthTime: '7:00', today }), TypeError);
  assert.throws(() => getMeCard({ birthDate: '2026-10-15', today }), RangeError);
  assert.throws(() => getMeCard({ birthDate: '1899-12-31', today }), RangeError);
  assert.throws(() => getMeCard(), TypeError);
});
