import { validateState as validatePath } from '../../path-vr/model.mjs';
import { validateArchive, MAX_IMPORT_BYTES } from '../../conversation-rehearsal/domain.mjs';
import { validateAlbum, mediaBytes, LIMITS as ALBUM_LIMITS } from '../../family-album/model.mjs';
import { validatePlatformLibrary } from './platform-library-data.mjs';
import { validateTravelAccountDocument, TRAVEL_ACCOUNT_CONTRACT } from '../../path-travel/planner-account.mjs';

// Product state stays product-owned. This contract never grants roles, creates
// accounts, or treats a device's storage preference as account authorization.
export const PERSONAL_LIMITS = Object.freeze({ path: 64 * 1024, 'path-travel': TRAVEL_ACCOUNT_CONTRACT.maxBytes, rehearsal: MAX_IMPORT_BYTES, 'family-album': ALBUM_LIMITS.export, 'platform-library':64 * 1024 });
export const PERSONAL_RESOURCES = Object.freeze(Object.keys(PERSONAL_LIMITS));
export const FAMILY_MANIFEST_FORMAT = 'synk-family-album-manifest';
export const PERSONAL_MEDIA_LIMITS = Object.freeze({ image: ALBUM_LIMITS.photo, audio: ALBUM_LIMITS.audio, total: ALBUM_LIMITS.total });
const encoder = new TextEncoder();
const fail = (code, message) => { throw Object.assign(new TypeError(message), { code }); };
const invalid = () => fail('PERSONAL_DATA_INVALID', '저장할 개인 기록의 형식을 확인해 주세요.');
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fields = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));
const revision = value => Number.isSafeInteger(value) && value >= 0;
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 100 && !/[\s\u0000-\u001f\u007f]/u.test(value);

function resourceLimit(resource) {
  if (!Object.hasOwn(PERSONAL_LIMITS, resource)) invalid();
  return PERSONAL_LIMITS[resource];
}

// Reject JS values that JSON would silently omit or transform before applying
// the canonical product validators. HTTP callers pass ordinary parsed JSON.
function jsonCopy(value, maxBytes) {
  const ancestors = new Set();
  let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 200000 || depth > 32) invalid();
    if (typeof item === 'string') { if (/\u0000|[\uD800-\uDFFF]/u.test(item)) invalid(); return; }
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number') { if (!Number.isFinite(item)) invalid(); return; }
    if (typeof item !== 'object' || ancestors.has(item)) invalid();
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) invalid();
    ancestors.add(item);
    for (const key of Reflect.ownKeys(item)) {
      if (Array.isArray(item) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== 'string' || /\u0000|[\uD800-\uDFFF]/u.test(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
      if (Array.isArray(item) && !/^(0|[1-9]\d*)$/.test(key)) invalid();
      visit(descriptor.value, depth + 1);
    }
    if (Array.isArray(item) && Object.keys(item).length !== item.length) invalid();
    ancestors.delete(item);
  }
  visit(value, 0);
  const serialized = JSON.stringify(value);
  if (encoder.encode(serialized).length > maxBytes) fail('PERSONAL_DATA_TOO_LARGE', '저장할 개인 기록이 허용 크기를 넘었어요.');
  return JSON.parse(serialized);
}

function pathDocument(value) {
  if (!fields(value, ['version', 'prefsConfirmed', 'prefs', 'zone', 'cursor', 'answers'])) invalid();
  const checked = validatePath({ ...value, consent: true });
  if (checked.answers.some(answer => answer.at.length > 40)) invalid();
  delete checked.consent;
  return checked;
}

export function validatePersonalState(resource, value) {
  const limit = resourceLimit(resource), copy = jsonCopy(value, limit);
  try { return resource === 'path-travel' ? validateTravelAccountDocument(copy) : resource === 'platform-library' ? validatePlatformLibrary(copy) : resource === 'path' ? pathDocument(copy) : resource === 'rehearsal' ? validateArchive(copy) : familyManifest(copy); }
  catch (error) { if (error.code) throw error; invalid(); }
}

export function parsePersonalState(resource, source) {
  const limit = resourceLimit(resource);
  if (typeof source !== 'string') invalid();
  if (encoder.encode(source).length > limit) fail('PERSONAL_DATA_TOO_LARGE', '불러올 개인 기록이 허용 크기를 넘었어요.');
  let value;
  try { value = JSON.parse(source); } catch { invalid(); }
  return validatePersonalState(resource, value);
}

export function serializePersonalState(resource, value) {
  return JSON.stringify(validatePersonalState(resource, value));
}

export function pathAccountState(deviceState) {
  const copy = jsonCopy(deviceState, PERSONAL_LIMITS.path);
  if (!fields(copy, ['version', 'consent', 'prefsConfirmed', 'prefs', 'zone', 'cursor', 'answers']) || typeof copy.consent !== 'boolean') invalid();
  delete copy.consent;
  return validatePersonalState('path', copy);
}

export function pathDeviceState(accountState, { consent = false } = {}) {
  if (typeof consent !== 'boolean') invalid();
  return { ...validatePersonalState('path', accountState), consent };
}

export function personalWriteRequest(resource, expectedRevision, state) {
  if (!revision(expectedRevision)) invalid();
  return { action: 'save', resource, expected_revision: expectedRevision, state: validatePersonalState(resource, state) };
}

export function personalDeleteRequest(resource, expectedRevision) {
  resourceLimit(resource);
  if (!revision(expectedRevision)) invalid();
  return { action: 'delete', resource, expected_revision: expectedRevision };
}

export function validatePersonalResponse(value, { resource, accountId } = {}) {
  resourceLimit(resource);
  if (!identity(accountId)) invalid();
  if (!fields(value, ['ok', 'scope', 'resource', 'accountId', 'revision', 'updatedAt', 'state']) || value.ok !== true || value.scope !== 'synk-personal' || value.resource !== resource || !identity(value.accountId) || !revision(value.revision) || !Object.hasOwn(value, 'state') || !(value.updatedAt === null || typeof value.updatedAt === 'string' && value.updatedAt.length <= 40 && Number.isFinite(Date.parse(value.updatedAt)))) invalid();
  if (value.accountId !== accountId) fail('ACCOUNT_CHANGED', '로그인한 계정이 바뀌었어요. 현재 계정의 기록을 다시 불러와 주세요.');
  return { ok: true, scope: 'synk-personal', resource, accountId, revision: value.revision, updatedAt: value.updatedAt, state: value.state === null ? null : validatePersonalState(resource, value.state) };
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const mediaTypes = Object.freeze({ image: ['image/jpeg', 'image/png', 'image/webp'], audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'] });
const mediaKind = slot => slot === 'photo' ? 'image' : 'audio';
const mediaKey = (pageId, slot) => `${pageId}:${slot}`;
// Optional album-level keys carried between the device album and the account
// manifest. validateAlbum owns their rules; absent keys stay absent.
const FAMILY_ALBUM_OPTIONAL = Object.freeze(['storyteller', 'skippedQuestions']);
const familyOptional = value => Object.fromEntries(FAMILY_ALBUM_OPTIONAL.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));

// Shape validation cannot prove ownership or upload completion. The account
// server checks both against its asset registry when committing a manifest.
export function validatePersonalMediaRef(value, { kind } = {}) {
  const copy = jsonCopy(value, 2048);
  if (!fields(copy, ['assetId', 'sha256', 'mime', 'size', 'kind']) || typeof copy.assetId !== 'string' || !uuid.test(copy.assetId) || typeof copy.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(copy.sha256) || !Object.hasOwn(mediaTypes, copy.kind) || !mediaTypes[copy.kind].includes(copy.mime) || !Number.isSafeInteger(copy.size) || copy.size <= 0 || copy.size > PERSONAL_MEDIA_LIMITS[copy.kind] || kind !== undefined && copy.kind !== kind) invalid();
  return copy;
}

function familyManifest(value) {
  if (!fields(value, ['format', 'version', ...FAMILY_ALBUM_OPTIONAL, 'pages']) || value.format !== FAMILY_MANIFEST_FORMAT || value.version !== 1 || !Array.isArray(value.pages) || value.pages.length > ALBUM_LIMITS.pages) invalid();
  let totalBytes = 0, encodedBytes = 0;
  const assets = new Map();
  const pages = value.pages.map(page => {
    if (!record(page)) invalid();
    const next = { ...page };
    for (const slot of ['photo', 'audio']) {
      const media = page[slot];
      if (media !== null) {
        if (!fields(media, ['name', 'mediaRef']) || typeof media.name !== 'string' || media.name.length > 180) invalid();
        const ref = validatePersonalMediaRef(media.mediaRef, { kind: mediaKind(slot) });
        const prior = assets.get(ref.assetId);
        if (prior && ['sha256', 'mime', 'size', 'kind'].some(key => prior[key] !== ref[key])) invalid();
        assets.set(ref.assetId, ref);
        totalBytes += ref.size;
        encodedBytes += 4 * Math.ceil(ref.size / 3);
      }
      next[slot] = null;
    }
    return next;
  });
  if (totalBytes > ALBUM_LIMITS.total) fail('PERSONAL_MEDIA_TOO_LARGE', '앨범의 사진과 음성은 모두 합쳐 20 MB까지 담을 수 있어요.');
  // Reuse every product text/date/recipe rule, then account for base64 without
  // allocating or fetching a single original on the server.
  const textAlbum = validateAlbum({ format: 'synk-family-album', version: 1, ...familyOptional(value), pages });
  const exportShell = { ...textAlbum, pages: textAlbum.pages.map((page, index) => {
    const next = { ...page };
    for (const slot of ['photo', 'audio']) {
      const media = value.pages[index][slot];
      next[slot] = media === null ? null : { name: media.name, type: media.mediaRef.mime, data: `data:${media.mediaRef.mime};base64,` };
    }
    return next;
  }) };
  if (encoder.encode(JSON.stringify(exportShell)).length + encodedBytes > ALBUM_LIMITS.export) fail('PERSONAL_DATA_TOO_LARGE', '원본을 포함한 앨범 내보내기가 32 MB를 넘어요. 앨범을 나눠 보관해 주세요.');
  return { format: FAMILY_MANIFEST_FORMAT, version: 1, ...familyOptional(textAlbum), pages: textAlbum.pages.map((page, index) => ({ ...page, photo: value.pages[index].photo, audio: value.pages[index].audio })) };
}

function decodedMedia(media) {
  const binary = atob(media.data.slice(media.data.indexOf(',') + 1));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
async function digest(bytes) {
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function base64(bytes) {
  const chunks = [];
  // A multiple of three keeps padding exclusively in the final chunk.
  for (let offset = 0; offset < bytes.length; offset += 24576) chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24576))));
  return chunks.join('');
}

// Yield one bounded original at a time. Callers upload and confirm it before
// requesting the next item; raw originals never enter personalWriteRequest.
export async function* familyMediaEntries(album) {
  const checked = validateAlbum(album);
  for (const page of checked.pages) for (const slot of ['photo', 'audio']) {
    const media = page[slot];
    if (media === null) continue;
    const bytes = decodedMedia(media);
    yield { key: mediaKey(page.id, slot), pageId: page.id, slot, name: media.name, kind: mediaKind(slot), mime: media.type, size: bytes.byteLength, sha256: await digest(bytes), bytes };
  }
}

// references maps the deterministic page/slot key to the server-confirmed ref.
// Validate digest again so edits made during upload cannot silently pair a new
// local file with a previously confirmed server object.
export async function createFamilyManifest(album, references) {
  if (!record(references)) invalid();
  const checked = validateAlbum(album), refs = new Map();
  for await (const media of familyMediaEntries(checked)) {
    if (!Object.hasOwn(references, media.key)) invalid();
    const ref = validatePersonalMediaRef(references[media.key], { kind: media.kind });
    if (['sha256', 'mime', 'size'].some(key => ref[key] !== media[key])) fail('PERSONAL_MEDIA_MISMATCH', '올린 원본과 현재 앨범 파일이 달라요. 해당 파일을 다시 확인해 주세요.');
    refs.set(media.key, ref);
  }
  if (Reflect.ownKeys(references).length !== refs.size) invalid();
  const pages = checked.pages.map(page => {
    const next = { ...page };
    for (const slot of ['photo', 'audio']) next[slot] = page[slot] === null ? null : { name: page[slot].name, mediaRef: refs.get(mediaKey(page.id, slot)) };
    return next;
  });
  return validatePersonalState('family-album', { format: FAMILY_MANIFEST_FORMAT, version: 1, ...familyOptional(checked), pages });
}

export async function restoreFamilyAlbum(manifest, readMedia) {
  if (typeof readMedia !== 'function') invalid();
  const checked = validatePersonalState('family-album', manifest), pages = [];
  for (const page of checked.pages) {
    const next = { ...page };
    for (const slot of ['photo', 'audio']) {
      const media = page[slot];
      if (media === null) { next[slot] = null; continue; }
      const ref = media.mediaRef, source = await readMedia({ ...ref });
      const bytes = source instanceof Uint8Array ? source : source instanceof ArrayBuffer ? new Uint8Array(source) : null;
      if (!bytes || bytes.byteLength !== ref.size || await digest(bytes) !== ref.sha256) fail('PERSONAL_MEDIA_MISMATCH', '보관한 원본 파일의 크기나 내용이 일치하지 않아요. 다시 불러와 주세요.');
      next[slot] = { name: media.name, type: ref.mime, data: `data:${ref.mime};base64,${base64(bytes)}` };
      mediaBytes(next[slot], slot);
    }
    pages.push(next);
  }
  return validateAlbum({ format: 'synk-family-album', version: 1, ...familyOptional(checked), pages });
}
