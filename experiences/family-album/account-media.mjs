import { familyMediaEntries, createFamilyManifest, restoreFamilyAlbum } from '../synk-account/src/personal-data.mjs';

const signature = ref => [ref.kind, ref.mime, ref.size, ref.sha256].join(':');
const manifestIds = value => new Set((value?.pages || []).flatMap(page => [page.photo?.mediaRef?.assetId, page.audio?.mediaRef?.assetId].filter(Boolean)));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Server references live until a successful document save removes them. A
 * failed conversion/save must not evict healthy originals and upload them twice. */
export function createFamilyAccountMedia() {
  const refs = new Map(), uploads = new Map();
  let committed = new Set(), generation = 0;
  function clear() { generation++; refs.clear(); uploads.clear(); committed.clear(); }
  function didSave(manifest) {
    const next = manifestIds(manifest);
    for (const [key, ref] of refs) if (committed.has(ref.assetId) && !next.has(ref.assetId)) refs.delete(key);
    committed = next;
  }
  function prepareRetry({ error } = {}) {
    if (!['ASSET_NOT_FOUND', 'ASSET_NOT_CONFIRMED'].includes(error?.code) || !uuid(error.assetId)) return false;
    for (const [key, ref] of refs) if (ref.assetId === error.assetId) refs.delete(key);
    // A preceding save ACK may already have removed this cache entry while an
    // undo manifest was queued. Rebuild that manifest even when no key remains.
    return true;
  }
  async function toDocument(value, account) {
    const references = {}, expected = generation;
    for await (const media of familyMediaEntries(value)) {
      const key = signature(media);
      let ref = refs.get(key);
      if (!ref) {
        let pending = uploads.get(key);
        if (!pending) {
          pending = account.request('assetUpload', { kind: media.kind, mime: media.mime, bytes: media.bytes }).then(uploaded => uploaded.mediaRef || uploaded);
          uploads.set(key, pending);
        }
        try {
          ref = await pending;
          if (expected !== generation) throw Object.assign(new Error('계정이 바뀌어 이전 원본 작업을 멈췄어요.'), { code: 'ACCOUNT_CHANGED' });
          refs.set(key, ref);
        } finally { if (uploads.get(key) === pending) uploads.delete(key); }
      }
      references[media.key] = ref;
    }
    if (expected !== generation) throw Object.assign(new Error('계정이 바뀌어 이전 원본 작업을 멈췄어요.'), { code: 'ACCOUNT_CHANGED' });
    return createFamilyManifest(value, references);
  }
  async function fromDocument(value, account) {
    const expected = generation, readRefs = [];
    const restored = await restoreFamilyAlbum(value, async ref => {
      const result = await account.request('assetRead', { assetId: ref.assetId });
      readRefs.push(ref);
      return result.bytes || result;
    });
    if (expected !== generation) throw Object.assign(new Error('계정이 바뀌어 이전 원본 작업을 멈췄어요.'), { code: 'ACCOUNT_CHANGED' });
    for (const ref of readRefs) refs.set(signature(ref), ref);
    didSave(value);
    return restored;
  }
  return { toDocument, fromDocument, didSave, prepareRetry, clear };
}
