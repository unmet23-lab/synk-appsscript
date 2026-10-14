import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAlbum, validateAlbum } from '../model.mjs';
import { timeline, peopleIndex, splitPeople } from '../timeline.mjs';

const at = '2026-10-14T00:00:00.000Z';
const page = (id, extra = {}) => ({ id, title: `이야기 ${id}`, date: '', person: '', author: '나', story: '직접 들은 이야기', photo: null, audio: null, details: {}, skipped: [], contributions: [], createdAt: at, updatedAt: at, ...extra });
const mother = { name: '김순자', relation: 'mother', callName: '어머니', birthYear: 1942, hometown: '강릉' };
const deepFreeze = value => { for (const item of Object.values(value)) if (item && typeof item === 'object') deepFreeze(item); return Object.freeze(value); };
const album = deepFreeze(validateAlbum({ ...emptyAlbum(), storyteller: mother, pages: [
  page('wedding', { title: '결혼식 날', date: '1966-04-10', person: '아버지', questionId: 'marriage-wedding' }),
  page('refuge', { title: '피난길', date: '1950-07-01', person: '외할머니와 외삼촌', questionId: 'war-refuge' }),
  page('first-pay', { title: '첫 월급', date: '1961-03-25', person: '' }),
  page('grandpa', { title: '외할아버지 젊을 때', date: '1938-05-05', person: '외할아버지' }),
  page('child', { title: '첫아이', date: '1968-01-20', person: '아버지, 큰딸' }),
  page('recipe', { title: '된장찌개', person: '외할머니', recipe: { servings: '', learnedFrom: '외할머니', ingredients: '된장', steps: '끓인다', attempts: [], revisedAt: at } }),
  page('undated', { title: '가나다 이야기', person: ' 큰 이모 ' }),
] }));

test('decade timeline orders dated pages and places the storyteller age next to each year', () => {
  const view = timeline(album);
  assert.equal(view.by, 'decade');
  assert.equal(view.birthYear, 1942);
  assert.deepEqual(view.groups.map(g => g.label), ['1930년대', '1950년대', '1960년대']);
  assert.deepEqual(view.groups.map(g => g.pages.map(p => p.id)), [['grandpa'], ['refuge'], ['first-pay', 'wedding', 'child']]);
  const sixties = view.groups[2];
  assert.deepEqual([sixties.from, sixties.to, sixties.ageLabel], [1961, 1968, '19~26살 무렵']);
  assert.deepEqual(view.groups[1].pages[0], { id: 'refuge', title: '피난길', date: '1950-07-01', year: 1950, age: 8, beforeBirth: false, questionId: 'war-refuge', recipe: false, hasPhoto: false, hasAudio: false });
  assert.equal(view.groups[0].ageLabel, '태어나기 전');
  assert.equal(view.groups[0].pages[0].beforeBirth, true);
  assert.equal(view.groups[0].pages[0].age, null);
  assert.deepEqual(view.undated.map(p => p.id), ['undated', 'recipe'], 'undated pages are listed separately, by title');
  assert.equal(view.undated[1].recipe, true);
});

test('age timeline groups by life decade and falls back to decades without a birth year', () => {
  const byAge = timeline(album, undefined, { by: 'age' });
  assert.equal(byAge.by, 'age');
  assert.deepEqual(byAge.groups.map(g => g.label), ['태어나기 전', '열 살 전', '10대', '20대']);
  assert.deepEqual(byAge.groups.find(g => g.label === '20대').pages.map(p => p.id), ['wedding', 'child']);
  const birthAlbum = validateAlbum({ ...emptyAlbum(), pages: [page('born', { date: '1942-02-01' })] });
  assert.equal(timeline(birthAlbum, mother).groups[0].ageLabel, '태어난 해 무렵');
  const unknown = timeline(album, { ...mother, birthYear: null }, { by: 'age' });
  assert.equal(unknown.by, 'decade');
  assert.equal(unknown.birthYear, null);
  assert.ok(unknown.groups.every(g => g.ageLabel === null && g.pages.every(p => p.age === null)));
  assert.equal(timeline(album, null).birthYear, null, 'explicit null ignores the album storyteller');
  assert.deepEqual(timeline(null), { by: 'decade', birthYear: null, groups: [], undated: [] });
  const mixed = timeline(validateAlbum({ ...emptyAlbum(), pages: [page('a', { date: '1941-06-01' }), page('b', { date: '1945-06-01' })] }), mother);
  assert.equal(mixed.groups[0].ageLabel, '태어나기 전부터 3살 무렵');
});

test('people index splits the free text 「함께한 사람」 field without guessing beyond separators', () => {
  assert.deepEqual(splitPeople('할머니와 손주'), ['할머니', '손주']);
  assert.deepEqual(splitPeople('엄마, 아빠 · 동생'), ['엄마', '아빠', '동생']);
  assert.deepEqual(splitPeople('아빠랑 엄마랑'), ['아빠', '엄마']);
  assert.deepEqual(splitPeople('동생이랑 나'), ['동생', '나']);
  assert.deepEqual(splitPeople('큰 이모'), ['큰 이모']);
  assert.deepEqual(splitPeople('김사랑'), ['김사랑']);
  assert.deepEqual(splitPeople('할머니 그리고 할아버지'), ['할머니', '할아버지']);
  assert.deepEqual(splitPeople('엄마, 엄마'), ['엄마']);
  assert.deepEqual(splitPeople(''), []);
  assert.deepEqual(splitPeople(null), []);
});

test('people index gathers pages per person, busiest first, dated pages before undated ones', () => {
  const index = peopleIndex(album);
  assert.deepEqual(index.people.map(p => [p.name, p.count]), [['아버지', 2], ['외할머니', 2], ['외삼촌', 1], ['외할아버지', 1], ['큰 이모', 1], ['큰딸', 1]]);
  assert.deepEqual(index.people.find(p => p.name === '외할머니').pages.map(p => p.id), ['refuge', 'recipe']);
  assert.deepEqual(index.people.find(p => p.name === '아버지').pages.map(p => p.id), ['wedding', 'child']);
  assert.deepEqual(index.withoutPerson.map(p => p.id), ['first-pay']);
  assert.equal(index.people.find(p => p.name === '아버지').pages[0].questionId, 'marriage-wedding');
  const variants = peopleIndex(validateAlbum({ ...emptyAlbum(), pages: [page('a', { person: '큰  이모' }), page('b', { person: '큰 이모' })] }));
  assert.deepEqual(variants.people.map(p => [p.name, p.count]), [['큰 이모', 2]]);
  assert.deepEqual(peopleIndex(emptyAlbum()), { people: [], withoutPerson: [] });
});
