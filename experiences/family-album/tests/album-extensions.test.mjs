// Optional version-1 extensions: storyteller, skippedQuestions and page.questionId.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAlbum, emptyRecipe, validateAlbum, parseAlbum, serializeAlbum, upsertPage, makeStoryteller, setStoryteller, skipQuestion, unskipQuestion, isQuestionRef, STORYTELLER_RELATIONS, LIMITS } from '../model.mjs';
import { buildAlbumArchive } from '../takehome.mjs';
import { FAMILY_MANIFEST_FORMAT, validatePersonalState, parsePersonalState, serializePersonalState, personalWriteRequest, familyMediaEntries, createFamilyManifest, restoreFamilyAlbum } from '../../synk-account/src/personal-data.mjs';

const at = '2026-10-14T00:00:00.000Z';
const page = extra => ({ id: 'page-1', title: '우리의 추석', date: '2025-10-06', person: '할머니', author: '나', story: '송편을 함께 빚었다.', photo: null, audio: null, details: {}, skipped: [], contributions: [], createdAt: at, updatedAt: at, ...extra });
const mother = { name: '김순자', relation: 'mother', callName: '어머니', birthYear: 1942, hometown: '강릉' };
function original(type, size = 80) {
  const bytes = Buffer.alloc(size);
  if (type === 'audio/wav') { bytes.write('RIFF'); bytes.write('WAVE', 8); } else { bytes[0] = 137; bytes.write('PNG', 1); }
  return { name: type === 'audio/wav' ? '어머니 목소리.wav' : '고향 집.png', type, data: `data:${type};base64,${bytes.toString('base64')}` };
}
const uuid = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function confirmed(album) {
  const references = {}, files = new Map(); let n = 0;
  for await (const media of familyMediaEntries(album)) { references[media.key] = { assetId: uuid(++n), sha256: media.sha256, mime: media.mime, size: media.size, kind: media.kind }; files.set(uuid(n), media.bytes); }
  return { files, manifest: await createFamilyManifest(album, references) };
}

test('version 1 files without the new keys round-trip byte for byte and gain no keys', () => {
  const legacyJson = JSON.stringify({ format: 'synk-family-album', version: 1, pages: [page(), page({ id: 'recipe-1', title: '할머니 식혜', recipe: { ...emptyRecipe(at), learnedFrom: '할머니', ingredients: '엿기름', steps: '삭힌다' } })] });
  const read = parseAlbum(legacyJson);
  assert.equal(serializeAlbum(read), legacyJson);
  assert.deepEqual(Object.keys(read), ['format', 'version', 'pages']);
  assert.ok(read.pages.every(p => !Object.hasOwn(p, 'questionId')));
  assert.equal(Object.hasOwn(read.pages[0], 'recipe'), false);
  const edited = upsertPage(read, { ...read.pages[0], story: '송편을 같이 빚었다.' });
  assert.deepEqual(Object.keys(edited), ['format', 'version', 'pages']);
  assert.equal(edited.version, 1);
  assert.deepEqual(Object.keys(emptyAlbum()), ['format', 'version', 'pages']);
  assert.throws(() => validateAlbum({ ...emptyAlbum(), version: 2 }), 'version stays 1');
});

test('storyteller, skipped questions and question links round-trip through JSON', () => {
  const album = validateAlbum({ ...emptyAlbum(), storyteller: mother, skippedQuestions: ['war-meals', 'hard-imf'], pages: [page({ questionId: 'holiday-childhood' })] });
  const json = serializeAlbum(album);
  assert.deepEqual(parseAlbum(json), album);
  assert.equal(serializeAlbum(parseAlbum(json)), json);
  assert.deepEqual(Object.keys(album), ['format', 'version', 'storyteller', 'skippedQuestions', 'pages']);
  assert.deepEqual(album.storyteller, mother);
  assert.equal(album.pages[0].questionId, 'holiday-childhood');
  assert.deepEqual(validateAlbum({ ...emptyAlbum(), skippedQuestions: [] }).skippedQuestions, [], 'an explicit empty list is kept as given');
  assert.deepEqual(validateAlbum({ ...emptyAlbum(), storyteller: { ...mother, name: '  김순자 ', hometown: ' 강릉 ' } }).storyteller, mother, 'text is trimmed like other album text');
});

test('storyteller rules reject invalid names, relations, years and shapes', () => {
  const year = new Date().getFullYear();
  for (const patch of [{ name: '' }, { name: '   ' }, { name: '가'.repeat(31) }, { relation: 'cousin' }, { relation: undefined }, { callName: '가'.repeat(21) }, { hometown: '가'.repeat(41) }, { birthYear: 1899 }, { birthYear: year + 1 }, { birthYear: 1950.5 }, { birthYear: '1950' }, { extra: true }]) {
    assert.throws(() => validateAlbum({ ...emptyAlbum(), storyteller: { ...mother, ...patch } }), /이야기 주인/, JSON.stringify(patch));
  }
  const { hometown, ...missing } = mother;
  assert.throws(() => validateAlbum({ ...emptyAlbum(), storyteller: missing }), /이야기 주인/);
  for (const value of [null, [], 'mother', undefined]) assert.throws(() => validateAlbum({ ...emptyAlbum(), storyteller: value }));
  assert.equal(validateAlbum({ ...emptyAlbum(), storyteller: { ...mother, birthYear: null } }).storyteller.birthYear, null);
  assert.equal(validateAlbum({ ...emptyAlbum(), storyteller: { ...mother, birthYear: year } }).storyteller.birthYear, year);
  assert.equal(validateAlbum({ ...emptyAlbum(), storyteller: { ...mother, name: '가'.repeat(30), hometown: '가'.repeat(40), callName: '' } }).storyteller.name.length, 30);
  assert.ok(STORYTELLER_RELATIONS.some(r => r.id === 'self') && STORYTELLER_RELATIONS.some(r => r.id === 'maternal-grandmother'));
});

test('makeStoryteller and setStoryteller accept form input and can return the album to the plain shape', () => {
  assert.deepEqual(makeStoryteller({ name: ' 박영수 ', relation: 'father', birthYear: '1948 ' }), { name: '박영수', relation: 'father', callName: '아버지', birthYear: 1948, hometown: '' });
  assert.deepEqual(makeStoryteller({ name: '나', relation: 'self', birthYear: '' }), { name: '나', relation: 'self', callName: '', birthYear: null, hometown: '' });
  assert.equal(makeStoryteller({ name: '이모님', callName: '이모' }).relation, 'other');
  assert.throws(() => makeStoryteller({ name: '김', birthYear: '48년' }), /이야기 주인/);
  assert.throws(() => makeStoryteller(null), /이야기 주인/);
  const withTeller = setStoryteller(emptyAlbum(), { name: '김순자', relation: 'mother', birthYear: '1942', hometown: '강릉' });
  assert.deepEqual(withTeller.storyteller, mother);
  const cleared = setStoryteller(withTeller, null);
  assert.deepEqual(Object.keys(cleared), ['format', 'version', 'pages']);
});

test('skipQuestion and unskipQuestion keep a unique bounded list and remove the field when emptied', () => {
  let album = skipQuestion(emptyAlbum(), 'war-meals');
  album = skipQuestion(album, 'war-meals');
  album = skipQuestion(album, 'hard-imf');
  assert.deepEqual(album.skippedQuestions, ['war-meals', 'hard-imf']);
  album = unskipQuestion(album, 'war-meals');
  assert.deepEqual(album.skippedQuestions, ['hard-imf']);
  album = unskipQuestion(album, 'hard-imf');
  assert.equal(Object.hasOwn(album, 'skippedQuestions'), false);
  assert.deepEqual(unskipQuestion(emptyAlbum(), 'none'), emptyAlbum());
  for (const bad of ['', 'War-Meals', '../x', 'a b', 'a--b', '-a', 'a'.repeat(61), 7, null]) {
    assert.equal(isQuestionRef(bad), false, String(bad));
    assert.throws(() => skipQuestion(emptyAlbum(), bad));
    assert.throws(() => validateAlbum({ ...emptyAlbum(), pages: [page({ questionId: bad })] }), /질문 기록/);
  }
  assert.throws(() => validateAlbum({ ...emptyAlbum(), skippedQuestions: ['a', 'a'] }), /건너뛴 질문/);
  assert.throws(() => validateAlbum({ ...emptyAlbum(), skippedQuestions: 'war-meals' }), /건너뛴 질문/);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => validateAlbum({ ...emptyAlbum(), skippedQuestions: [, 'a'] }), /건너뛴 질문/);
  const full = Array.from({ length: LIMITS.skippedQuestions }, (_, i) => `q-${i}`);
  assert.equal(validateAlbum({ ...emptyAlbum(), skippedQuestions: full }).skippedQuestions.length, 300);
  assert.throws(() => skipQuestion({ ...emptyAlbum(), skippedQuestions: full }, 'q-300'), /300개/);
  assert.throws(() => validateAlbum({ ...emptyAlbum(), pages: [page({ question: 'x' })] }), 'unknown page keys stay rejected');
  assert.throws(() => validateAlbum({ ...emptyAlbum(), profile: {} }), 'unknown album keys stay rejected');
});

test('take-home archive restoration file carries the new keys unchanged', async () => {
  const album = validateAlbum({ ...emptyAlbum(), storyteller: mother, skippedQuestions: ['hard-imf'], pages: [page({ questionId: 'holiday-childhood' })] });
  const { bytes } = await buildAlbumArchive(album);
  assert.ok(Buffer.from(bytes).toString('utf8').includes(serializeAlbum(album)));
});

test('account manifest keeps legacy documents unchanged and carries the new keys both ways', async () => {
  const legacy = upsertPage(emptyAlbum(), page({ photo: original('image/png') }));
  const { manifest: legacyManifest, files: legacyFiles } = await confirmed(legacy);
  assert.deepEqual(Object.keys(legacyManifest), ['format', 'version', 'pages']);
  assert.equal(Object.hasOwn(legacyManifest.pages[0], 'questionId'), false);
  assert.deepEqual(await restoreFamilyAlbum(legacyManifest, async ref => legacyFiles.get(ref.assetId)), legacy);

  const source = validateAlbum({ ...emptyAlbum(), storyteller: mother, skippedQuestions: ['war-meals'], pages: [page({ questionId: 'holiday-childhood', photo: original('image/png'), audio: original('audio/wav') })] });
  const { manifest, files } = await confirmed(source);
  assert.equal(manifest.format, FAMILY_MANIFEST_FORMAT);
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.storyteller, mother);
  assert.deepEqual(manifest.skippedQuestions, ['war-meals']);
  assert.equal(manifest.pages[0].questionId, 'holiday-childhood');
  assert.equal(JSON.stringify(manifest).includes('base64'), false);
  assert.deepEqual(parsePersonalState('family-album', serializePersonalState('family-album', manifest)), manifest);
  assert.deepEqual(personalWriteRequest('family-album', 3, manifest).state, manifest);
  assert.deepEqual(await restoreFamilyAlbum(manifest, async ref => files.get(ref.assetId)), source);
});

test('account manifest validation applies the album rules to the new keys', async () => {
  const { manifest } = await confirmed(validateAlbum({ ...emptyAlbum(), storyteller: mother, pages: [page({ questionId: 'holiday-childhood' })] }));
  for (const mutate of [v => { v.storyteller.birthYear = 1800; }, v => { v.storyteller.relation = 'boss'; }, v => { v.storyteller = null; }, v => { v.skippedQuestions = ['../x']; }, v => { v.skippedQuestions = Array.from({ length: 301 }, (_, i) => `q-${i}`); }, v => { v.pages[0].questionId = 'Not Valid'; }, v => { v.owner = 'someone'; }]) {
    const value = structuredClone(manifest); mutate(value);
    assert.throws(() => validatePersonalState('family-album', value), { code: 'PERSONAL_DATA_INVALID' });
  }
  const trimmed = structuredClone(manifest); trimmed.storyteller.name = ' 김순자 ';
  assert.equal(validatePersonalState('family-album', trimmed).storyteller.name, '김순자');
});
