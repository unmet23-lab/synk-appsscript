import { PERSONAL_MEDIA_LIMITS, validatePersonalMediaRef } from './personal-data.mjs';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fault = (code = 'INVALID_RESPONSE') => Object.assign(new Error('앨범 원본 파일을 확인하지 못했어요. 현재 앨범을 유지하고 다시 시도해 주세요.'), { code });
const types = { image: ['image/jpeg', 'image/png', 'image/webp'], audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'] };
const buffer = value => value instanceof ArrayBuffer ? new Uint8Array(value) : ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;

export function validateMediaRequest(operation, values) {
  if (!['assetUpload', 'assetRead', 'assetDelete'].includes(operation) || !values || typeof values !== 'object' || Array.isArray(values)) throw fault('INVALID_REQUEST');
  if (operation === 'assetUpload') {
    const bytes = buffer(values.bytes);
    if (Object.keys(values).some(key => !['kind', 'mime', 'bytes'].includes(key)) || !Object.hasOwn(types, values.kind) || !types[values.kind].includes(values.mime) || !bytes || !bytes.length || bytes.length > PERSONAL_MEDIA_LIMITS[values.kind]) throw fault('INVALID_REQUEST');
  } else if (Object.keys(values).some(key => key !== 'assetId') || !uuid(values.assetId)) throw fault('INVALID_REQUEST');
}
function own(data, ownerId) {
  if (data?.ok !== true) throw Object.assign(fault(data?.error?.code || 'MEDIA_TRANSFER_FAILED'), ['ASSET_NOT_FOUND','ASSET_NOT_CONFIRMED'].includes(data?.error?.code) && uuid(data?.error?.assetId) ? {assetId:data.error.assetId} : {});
  if (data.scope !== 'synk-personal' || data.resource !== 'family-album' || data.accountId !== ownerId) throw fault('ACCOUNT_CHANGED');
  return data;
}
export function validateMediaResponse(data, { operation, values, ownerId }) {
  own(data, ownerId);
  const base = { ok: true, scope: 'synk-personal', resource: 'family-album', accountId: ownerId };
  if (operation === 'assetDelete') { if (data.deleted !== true) throw fault(); return { ...base, deleted: true }; }
  const ref = validatePersonalMediaRef(data.mediaRef);
  if (operation === 'assetRead' && ref.assetId !== values.assetId || operation === 'assetUpload' && (ref.kind !== values.kind || ref.mime !== values.mime || ref.size !== values.bytes.byteLength)) throw fault();
  if (operation === 'assetRead') {
    const bytes = buffer(data.bytes); if (!bytes || bytes.length !== ref.size) throw fault();
    return { ...base, mediaRef: ref, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  return { ...base, mediaRef: ref };
}
function signedUrl(value, { origin, ownerId, assetId, upload }) {
  let url, host; try { url = new URL(value); host = new URL(origin); } catch { throw fault(); }
  const path = `/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/personal-media/${upload ? 'staging' : 'objects'}/${ownerId}/${assetId}`;
  if (url.origin !== host.origin || !['https:', 'http:'].includes(url.protocol) || url.protocol === 'http:' && url.hostname !== '127.0.0.1' || url.username || url.password || url.hash || url.pathname !== path || !url.searchParams.get('token') || [...url.searchParams.keys()].some(key => key !== 'token' || url.searchParams.getAll(key).length !== 1)) throw fault();
  return url.href;
}

/** Transfer only signed files in the verified owner's fixed private bucket. */
export async function requestPersonalMedia({ operation, values, ownerId, api, fetcher, guard, cryptoAPI, controllers, origin }) {
  validateMediaRequest(operation, values); guard();
  const hash = async bytes => { const value = await cryptoAPI.subtle.digest('SHA-256', bytes); guard(); return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join(''); };
  const invoke = async body => { const result = await api(body); guard(); return own(result, ownerId); };
  async function transfer(url, { bytes, mime, size }) {
    guard(); const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000); controllers.add(controller);
    try {
      const response = await fetcher(url, { method: bytes ? 'PUT' : 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal, ...(bytes ? { headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes } : {}) }); guard();
      if (!response.ok) { await response.body?.cancel?.(); throw fault('MEDIA_TRANSFER_FAILED'); }
      if (bytes) { await response.body?.cancel?.(); return null; }
      const length = response.headers.get('content-length'), type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (length !== null && Number(length) !== size || type !== mime || !response.body?.getReader) { await response.body?.cancel?.(); throw fault(); }
      const reader = response.body.getReader(), result = new Uint8Array(size); let offset = 0;
      try {
        for (;;) { const { done, value } = await reader.read(); guard(); if (done) break; if (offset + value.byteLength > size) { await reader.cancel(); throw fault(); } result.set(value, offset); offset += value.byteLength; }
      } finally { reader.releaseLock(); }
      if (offset !== size) throw fault(); return result;
    } catch (error) { guard(); throw error.code ? error : fault('MEDIA_TRANSFER_FAILED'); }
    finally { clearTimeout(timer); controllers.delete(controller); }
  }
  if (operation === 'assetUpload') {
    // Copy before yielding: a later form edit cannot change an in-flight upload.
    const bytes = buffer(values.bytes).slice(), sha256 = await hash(bytes);
    const prepared = await invoke({ action: 'media-upload', kind: values.kind, mime: values.mime, size: bytes.length, sha256 });
    if (!uuid(prepared.assetId)) throw fault();
    await transfer(signedUrl(prepared.uploadUrl, { origin, ownerId, assetId: prepared.assetId, upload: true }), { bytes, mime: values.mime, size: bytes.length });
    const confirmed = await invoke({ action: 'media-confirm', assetId: prepared.assetId });
    const result = validateMediaResponse(confirmed, { operation, values, ownerId });
    if (result.mediaRef.assetId !== prepared.assetId || result.mediaRef.sha256 !== sha256) throw fault();
    return result;
  }
  if (operation === 'assetDelete') return validateMediaResponse(await invoke({ action: 'media-delete', assetId: values.assetId }), { operation, values, ownerId });
  const data = await invoke({ action: 'media-read', assetId: values.assetId }), ref = validatePersonalMediaRef(data.mediaRef);
  if (ref.assetId !== values.assetId) throw fault();
  const bytes = await transfer(signedUrl(data.url, { origin, ownerId, assetId: ref.assetId, upload: false }), { mime: ref.mime, size: ref.size });
  if (await hash(bytes) !== ref.sha256) throw fault(); guard();
  return validateMediaResponse({ ...data, bytes }, { operation, values, ownerId });
}
