'use strict';
const crypto = require('node:crypto');
const { assertProductSender, productDocument } = require('./product-preview.cjs');
const { publicError } = require('./auth-service.cjs');
const { RESOURCES, MIME, MEDIA_LIMITS, uuid } = require('./personal-requests.cjs');
const fault = code => Object.assign(new Error('개인 자료 연결을 확인해 주세요.'), { code });
const OPERATIONS = new Set(['personalLoad', 'personalSave', 'personalDelete', 'assetUpload', 'assetRead', 'assetDelete']);
function createPersonalBroker({ auth, resource, config, fetcher = globalThis.fetch, timeoutMs = 30000 }) {
  if (!RESOURCES.includes(resource)) throw fault('INVALID_REQUEST');
  const controllers = new Set(); let disposed = false;
  const current = () => { const status = auth.status(); if (!status.signedIn || typeof status.account?.synk_user_id !== 'string') throw fault('AUTH_REQUIRED'); return { id: status.account.synk_user_id, generation: status.sessionGeneration }; };
  const guard = owner => { const status = current(); if (disposed || status.id !== owner.id || status.generation !== owner.generation) throw fault('AUTH_CHANGED'); };
  const own = (data, owner) => { guard(owner); if (data?.ok !== true) throw Object.assign(fault(data?.error?.code || 'ACCOUNT_UNAVAILABLE'), { status: data?.error?.status, revision: data?.revision, ...(uuid(data?.error?.assetId) && ['ASSET_NOT_FOUND','ASSET_NOT_CONFIRMED'].includes(data?.error?.code) ? {assetId:data.error.assetId} : {}) }); if (data.scope !== 'synk-personal' || data.resource !== resource || data.accountId !== owner.id) throw fault('AUTH_CHANGED'); return data; };
  function mediaRef(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['assetId', 'sha256', 'mime', 'size', 'kind'].includes(key)) || !uuid(value.assetId) || !Object.hasOwn(MIME, value.kind) || !MIME[value.kind].includes(value.mime) || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > MEDIA_LIMITS[value.kind] || !/^[a-f0-9]{64}$/.test(value.sha256)) throw fault('INVALID_RESPONSE');
    return { assetId: value.assetId, sha256: value.sha256, mime: value.mime, size: value.size, kind: value.kind };
  }
  function signedUrl(value, owner, assetId, upload) {
    let url, origin; try { url = new URL(value); origin = new URL(config.supabaseUrl); } catch { throw fault('INVALID_RESPONSE'); }
    const expected = `/storage/v1/object/${upload ? 'upload/sign' : 'sign'}/personal-media/${upload ? 'staging' : 'objects'}/${owner.id}/${assetId}`;
    if (url.origin !== origin.origin || !['https:', 'http:'].includes(url.protocol) || url.protocol === 'http:' && url.hostname !== '127.0.0.1' || url.username || url.password || url.hash || url.pathname !== expected || !url.searchParams.get('token') || [...url.searchParams.keys()].some(key => key !== 'token' || url.searchParams.getAll(key).length !== 1)) throw fault('INVALID_RESPONSE');
    return url.href;
  }
  async function transfer(url, owner, { bytes, mime, size }) {
    guard(owner); const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs); controllers.add(controller);
    try {
      const response = await fetcher(url, { method: bytes ? 'PUT' : 'GET', signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', ...(bytes ? { headers: { 'Content-Type': mime, 'x-upsert': 'false' }, body: bytes } : {}) }); guard(owner);
      if (!response.ok) { await response.body?.cancel?.(); throw fault('MEDIA_TRANSFER_FAILED'); }
      if (bytes) { await response.body?.cancel?.(); return null; }
      const declared = response.headers.get('content-length'), contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (declared !== null && Number(declared) !== size || contentType !== mime) { await response.body?.cancel?.(); throw fault('INVALID_RESPONSE'); }
      let length = 0; const chunks = [];
      if (!response.body) throw fault('INVALID_RESPONSE');
      for await (const chunk of response.body) { guard(owner); length += chunk.length; if (length > size) { controller.abort(); throw fault('INVALID_RESPONSE'); } chunks.push(Buffer.from(chunk)); }
      if (length !== size) throw fault('INVALID_RESPONSE'); guard(owner); return Buffer.concat(chunks);
    } catch (error) { guard(owner); throw error.code ? error : fault('MEDIA_TRANSFER_FAILED'); }
    finally { clearTimeout(timer); controllers.delete(controller); }
  }
  async function request(operation, params = {}) {
    try {
      if (!OPERATIONS.has(operation) || !params || typeof params !== 'object' || Array.isArray(params)) throw fault('INVALID_REQUEST');
      if (operation.startsWith('personal')) return await auth.accountRequest(operation, params);
      if (resource !== 'family-album') throw fault('INVALID_REQUEST');
      const owner = current();
      if (operation === 'assetUpload') {
        if (Object.keys(params).some(key => !['kind', 'mime', 'bytes'].includes(key)) || !Object.hasOwn(MIME, params.kind) || !MIME[params.kind].includes(params.mime)) throw fault('INVALID_REQUEST');
        const value = params.bytes;
        if (!(value instanceof ArrayBuffer) && !(ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer)) throw fault('INVALID_REQUEST');
        const length = value.byteLength;
        if (length < 1 || length > MEDIA_LIMITS[params.kind]) throw fault('INVALID_REQUEST');
        const bytes = Buffer.from(new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer, value instanceof ArrayBuffer ? 0 : value.byteOffset, length));
        const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        const prepared = own(await auth.accountRequest('personalAssetPrepare', { kind: params.kind, mime: params.mime, size: length, sha256 }), owner);
        if (!uuid(prepared.assetId)) throw fault('INVALID_RESPONSE');
        await transfer(signedUrl(prepared.uploadUrl, owner, prepared.assetId, true), owner, { bytes, mime: params.mime, size: length });
        const confirmed = own(await auth.accountRequest('personalAssetConfirm', { assetId: prepared.assetId }), owner), ref = mediaRef(confirmed.mediaRef);
        if (ref.assetId !== prepared.assetId || ref.sha256 !== sha256 || ref.size !== length || ref.mime !== params.mime || ref.kind !== params.kind) throw fault('INVALID_RESPONSE');
        return { ok: true, scope: 'synk-personal', resource, accountId: owner.id, mediaRef: ref };
      }
      if (Object.keys(params).some(key => key !== 'assetId') || !uuid(params.assetId)) throw fault('INVALID_REQUEST');
      if (operation === 'assetDelete') { const result = own(await auth.accountRequest('personalAssetDelete', params), owner); if (result.deleted !== true) throw fault('INVALID_RESPONSE'); return { ok: true, scope: 'synk-personal', resource, accountId: owner.id, deleted: true }; }
      const read = own(await auth.accountRequest('personalAssetRead', params), owner), ref = mediaRef(read.mediaRef);
      if (ref.assetId !== params.assetId) throw fault('INVALID_RESPONSE');
      const bytes = await transfer(signedUrl(read.url, owner, ref.assetId, false), owner, { mime: ref.mime, size: ref.size });
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== ref.sha256) throw fault('INVALID_RESPONSE'); guard(owner);
      return { ok: true, scope: 'synk-personal', resource, accountId: owner.id, mediaRef: ref, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
    } catch (error) { return { ok: false, error: publicError(error), ...(Number.isSafeInteger(error.revision) ? { revision: error.revision } : {}) }; }
  }
  return { request, dispose() { disposed = true; for (const controller of controllers) controller.abort(); } };
}
function bindPersonalIPC({ ipcMain, getWindow, auth, resource, config, fetcher }) {
  const broker = createPersonalBroker({ auth, resource, config, fetcher });
  const handlers = { 'synk-personal:auth-status': () => auth.status(), 'synk-personal:auth-sign-in': () => auth.signIn(), 'synk-personal:auth-sign-out': () => auth.signOut(), 'synk-personal:request': (operation, params) => broker.request(operation, params) };
  for (const [channel, handler] of Object.entries(handlers)) { ipcMain.removeHandler(channel); ipcMain.handle(channel, async (event, ...args) => { assertProductSender(event, getWindow(), resource); try { return await handler(...args); } catch (error) { return { ok: false, error: publicError(error) }; } }); }
  return () => { broker.dispose(); for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel); };
}
function sendPersonalAuth(window, resource, state) { if (window && !window.isDestroyed() && productDocument(resource, window.webContents.getURL())) window.webContents.send('synk-personal:auth-changed', state); }
module.exports = { createPersonalBroker, bindPersonalIPC, sendPersonalAuth };
