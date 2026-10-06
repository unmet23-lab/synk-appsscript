import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, recordAnswer } from '../experiences/path-vr/model.mjs';
import { archive, createSession, appendTurn } from '../experiences/conversation-rehearsal/domain.mjs';
import { emptyAlbum, upsertPage, LIMITS as ALBUM_LIMITS } from '../experiences/family-album/model.mjs';
import { PERSONAL_LIMITS, validatePersonalState, parsePersonalState, serializePersonalState, pathAccountState, pathDeviceState, personalWriteRequest, personalDeleteRequest, validatePersonalResponse, FAMILY_MANIFEST_FORMAT, validatePersonalMediaRef, familyMediaEntries, createFamilyManifest, restoreFamilyAlbum } from '../experiences/synk-account/src/personal-data.mjs';

const now = '2026-10-06T03:00:00.000Z';
function rehearsal() {
  let session = createSession({ scenario: 'interview', counterpart: '면접관', goal: '실제 경험 말하기', at: now, id: 'session-1' });
  for (let i = 0; i < 3; i++) session = appendTurn(session, { answer: `직접 쓴 답변 ${i}`, focus: 'specific', review: 'easy' });
  return archive([session], now);
}
const response = (resource, state) => ({ ok: true, scope: 'synk-personal', resource, accountId: 'account-1', revision: 3, updatedAt: now, state });

test('PATH account roundtrip preserves current practice without enabling device storage', () => {
  const source = recordAnswer(initialState(), 'welcome', 0, 2, true, now);
  source.cursor = { step: 0, choice: 2, helped: true, showResults: false };
  const network = pathAccountState(source);
  assert.equal(Object.hasOwn(network, 'consent'), false);
  assert.deepEqual(pathDeviceState(network), source);
  assert.equal(pathDeviceState(network, { consent: true }).consent, true);
  assert.equal(source.consent, false);
  assert.throws(() => validatePersonalState('path', source));
  assert.throws(() => pathDeviceState(network, { consent: 'yes' }));
});

test('PATH canonical choices and count bounds apply to account records', () => {
  const good = pathAccountState(initialState());
  for (const mutate of [v => v.zone = 'invented', v => v.prefs.goal = 'admin', v => v.cursor.choice = 4, v => v.answers = Array.from({ length: 61 }, () => ({ zone: 'welcome', step: 0, choice: 0, helped: false, at: now })), v => v.role = 'teacher']) {
    const value = structuredClone(good); mutate(value); assert.throws(() => validatePersonalState('path', value));
  }
  assert.throws(() => parsePersonalState('path', ' '.repeat(PERSONAL_LIMITS.path + 1)), { code: 'PERSONAL_DATA_TOO_LARGE' });
});

test('rehearsal uses the existing completed-session archive and byte limit', () => {
  const saved = rehearsal();
  assert.deepEqual(parsePersonalState('rehearsal', serializePersonalState('rehearsal', saved)), saved);
  assert.equal(PERSONAL_LIMITS.rehearsal, 500000);
  const partial = structuredClone(saved); partial.sessions[0].turns.pop();
  assert.throws(() => validatePersonalState('rehearsal', partial));
  const duplicate = structuredClone(saved); duplicate.sessions.push(duplicate.sessions[0]);
  assert.throws(() => validatePersonalState('rehearsal', duplicate));
  assert.throws(() => parsePersonalState('rehearsal', '가'.repeat(166667)), { code: 'PERSONAL_DATA_TOO_LARGE' });
});

test('JSON-only contract rejects silent data loss and does not invoke getters', () => {
  const good = pathAccountState(initialState());
  const cycle = structuredClone(good); cycle.cursor = cycle;
  const getter = structuredClone(good); let accessed = false;
  Object.defineProperty(getter, 'zone', { enumerable: true, get() { accessed = true; return 'welcome'; } });
  const hole = structuredClone(good); hole.answers = new Array(1);
  for (const value of [{ ...good, unknown: undefined }, { ...good, unknown: NaN }, { ...good, unknown: 1n }, { ...good, unknown: new Date() }, { ...good, [Symbol('hidden')]: 1 }, cycle, getter, hole]) assert.throws(() => validatePersonalState('path', value));
  assert.equal(accessed, false);
});

test('personal writes are resource-bound CAS commands with no caller supplied identity', () => {
  const source = rehearsal(), request = personalWriteRequest('rehearsal', 4, source);
  assert.deepEqual(request, { action: 'save', resource: 'rehearsal', expected_revision: 4, state: source });
  request.state.sessions[0].goal = '수정'; assert.notEqual(request.state.sessions[0].goal, source.sessions[0].goal);
  assert.deepEqual(personalDeleteRequest('path', 0), { action: 'delete', resource: 'path', expected_revision: 0 });
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2']) assert.throws(() => personalWriteRequest('rehearsal', value, source));
  for (const resource of ['care', 'messenger', '__proto__', 'unknown']) assert.throws(() => personalDeleteRequest(resource, 0));
});

test('response checks account and resource before accepting records or deletion tombstone', () => {
  const source = response('rehearsal', rehearsal()), scope = { resource: 'rehearsal', accountId: 'account-1' };
  assert.deepEqual(validatePersonalResponse(source, scope), source);
  assert.equal(validatePersonalResponse({ ...source, state: null, revision: 4 }, scope).state, null);
  assert.throws(() => validatePersonalResponse({ ...source, accountId: 'account-2' }, scope), { code: 'ACCOUNT_CHANGED' });
  for (const patch of [{ scope: 'synk-care' }, { resource: 'path' }, { revision: -1 }, { updatedAt: 'never' }, { access_token: 'not-accepted' }]) assert.throws(() => validatePersonalResponse({ ...source, ...patch }, scope));
  assert.throws(() => validatePersonalResponse(source, { resource: 'rehearsal' }));
});

const id = index => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const page = extra => ({ id: 'page-1', title: '우리의 이야기', date: '2026-10-06', person: '가족', author: '나', story: '직접 기억하는 이야기', photo: null, audio: null, details: {}, skipped: [], contributions: [], createdAt: now, updatedAt: now, ...extra });
function original(type, size = 80) {
  const bytes = Buffer.alloc(size);
  if (type === 'audio/wav') { bytes.write('RIFF'); bytes.write('WAVE', 8); }
  else { bytes[0] = 137; bytes.write('PNG', 1); }
  return { name: type === 'audio/wav' ? '가족의 원음.wav' : '추억.png', type, data: `data:${type};base64,${bytes.toString('base64')}` };
}
async function confirmed(album) {
  const references = {}, files = new Map(); let n = 0;
  for await (const media of familyMediaEntries(album)) {
    references[media.key] = { assetId: id(++n), sha256: media.sha256, mime: media.mime, size: media.size, kind: media.kind };
    files.set(id(n), media.bytes);
  }
  return { references, files, manifest: await createFamilyManifest(album, references) };
}

test('family legacy album separates originals deterministically and restores exact bytes', async () => {
  const source = upsertPage(emptyAlbum(), page({ photo: original('image/png'), audio: original('audio/wav'), contributions: [{ id: 'memory-1', name: '가족에게 들음', text: '같은 날 함께 있었다.', createdAt: now }] }));
  const { references, files, manifest } = await confirmed(source);
  assert.equal(manifest.format, FAMILY_MANIFEST_FORMAT);
  assert.deepEqual(Object.keys(references), ['page-1:photo', 'page-1:audio']);
  assert.equal(manifest.pages[0].photo.mediaRef.kind, 'image');
  assert.equal(JSON.stringify(manifest).includes('base64'), false);
  assert.deepEqual(await createFamilyManifest(source, references), manifest);
  const fetched = [];
  const restored = await restoreFamilyAlbum(manifest, async ref => { fetched.push(ref.assetId); return files.get(ref.assetId); });
  assert.deepEqual(fetched, [id(1), id(2)]);
  assert.deepEqual(restored, source);
  assert.throws(() => validatePersonalState('family-album', source));
  assert.deepEqual(personalWriteRequest('family-album', 0, manifest).state, manifest);
});

test('family refs reject caller paths, unsupported MIME, forged kind, size and malformed ids', async () => {
  const { manifest } = await confirmed(upsertPage(emptyAlbum(), page({ photo: original('image/png') })));
  const ref = manifest.pages[0].photo.mediaRef;
  for (const patch of [{ assetId: '../file' }, { sha256: 'x'.repeat(64) }, { mime: 'image/gif' }, { mime: 'image/svg+xml' }, { mime: 'image/png;evil=true' }, { size: 0 }, { size: ALBUM_LIMITS.photo + 1 }, { kind: 'audio' }, { path: 'other-person/original.png' }, { uploadUrl: 'https://example.invalid' }]) assert.throws(() => validatePersonalMediaRef({ ...ref, ...patch }, { kind: 'image' }));
  const wrongSlot = structuredClone(manifest); wrongSlot.pages[0].audio = wrongSlot.pages[0].photo; wrongSlot.pages[0].photo = null;
  assert.throws(() => validatePersonalState('family-album', wrongSlot));
});

test('family rejects unconfirmed mapping mismatch and changed original during upload', async () => {
  const source = upsertPage(emptyAlbum(), page({ photo: original('image/png') }));
  const { references } = await confirmed(source);
  await assert.rejects(createFamilyManifest(source, {}));
  await assert.rejects(createFamilyManifest(source, { ...references, unrelated: references['page-1:photo'] }));
  const changed = structuredClone(references); changed['page-1:photo'].sha256 = '0'.repeat(64);
  await assert.rejects(createFamilyManifest(source, changed), { code: 'PERSONAL_MEDIA_MISMATCH' });
  const edited = upsertPage(emptyAlbum(), page({ photo: original('image/png', 81) }));
  await assert.rejects(createFamilyManifest(edited, references), { code: 'PERSONAL_MEDIA_MISMATCH' });
});

test('family restore verifies digest and byte length before returning a complete album', async () => {
  const { manifest, files } = await confirmed(upsertPage(emptyAlbum(), page({ audio: original('audio/wav') })));
  const broken = Uint8Array.from(files.get(id(1))); broken[broken.length - 1] = 1;
  await assert.rejects(restoreFamilyAlbum(manifest, async () => broken), { code: 'PERSONAL_MEDIA_MISMATCH' });
  await assert.rejects(restoreFamilyAlbum(manifest, async () => new Uint8Array(81)), { code: 'PERSONAL_MEDIA_MISMATCH' });
  await assert.rejects(restoreFamilyAlbum(manifest, async () => 'data:audio/wav;base64,'), { code: 'PERSONAL_MEDIA_MISMATCH' });
  const intact = await restoreFamilyAlbum(manifest, async () => files.get(id(1)).buffer);
  assert.equal(intact.pages.length, 1);
});

test('family reference limits preserve legacy export budget without loading original bytes', () => {
  const ref = (asset, size) => ({ name: 'original.wav', mediaRef: { assetId: id(asset), sha256: '1'.repeat(64), mime: 'audio/wav', size, kind: 'audio' } });
  const value = { format: FAMILY_MANIFEST_FORMAT, version: 1, pages: [1, 2, 3].map(n => page({ id: `page-${n}`, audio: ref(n, 8 * 1024 * 1024) })) };
  assert.throws(() => validatePersonalState('family-album', value), { code: 'PERSONAL_MEDIA_TOO_LARGE' });
  value.pages[2].audio.mediaRef.size = 4 * 1024 * 1024;
  assert.equal(validatePersonalState('family-album', value).pages.length, 3);
  const conflicting = structuredClone(value); conflicting.pages[1].audio.mediaRef.assetId = id(1); conflicting.pages[1].audio.mediaRef.sha256 = '2'.repeat(64);
  assert.throws(() => validatePersonalState('family-album', conflicting));
  value.pages = Array.from({ length: 30 }, (_,i) => page({ id: `page-${i}`, audio: i < 3 ? ref(i + 1, (i < 2 ? 8 : 4) * 1024 * 1024) : null, story: '가'.repeat(10000), contributions: Array.from({ length: 40 }, (_,j) => ({ id: `memory-${j}`, name: '가족', text: '가'.repeat(2000), createdAt: now })) }));
  assert.throws(() => validatePersonalState('family-album', value), { code: 'PERSONAL_DATA_TOO_LARGE' });
  for (const item of value.pages) item.audio = null;
  assert.equal(validatePersonalState('family-album', value).pages.length, 30);
  assert.ok(Buffer.byteLength(JSON.stringify(value)) > 2 * 1024 * 1024, 'valid existing metadata can exceed 2 MiB');
});

test('family manifest reuses product text, provenance and date validation', () => {
  const good = { format: FAMILY_MANIFEST_FORMAT, version: 1, pages: [page()] };
  for (const mutate of [v => v.pages[0].date = '2026-02-30', v => v.pages[0].author = '', v => v.pages[0].story = '', v => v.pages[0].contributions = [{ id: 'c1', name: '', text: '근거 없음', createdAt: now }], v => v.pages[0].details = { invented: '값' }, v => v.pages.push(v.pages[0])]) {
    const value = structuredClone(good); mutate(value); assert.throws(() => validatePersonalState('family-album', value));
  }
});
