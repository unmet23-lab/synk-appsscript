'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { configuration } = require('../src/auth-config.cjs');
const { requestSpec } = require('../src/account-requests.cjs');
const { createPersonalBroker, bindPersonalIPC } = require('../src/personal-account.cjs');
const { PRODUCT_PREVIEWS } = require('../src/product-preview.cjs');
const accountId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222';
const bytes = Buffer.from('synthetic verified media'), sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const mediaRef = { assetId, sha256, size: bytes.length, mime: 'image/png', kind: 'image' };
function fixture({ resource = 'family-album', changedResult, response } = {}) {
  const config = { supabaseUrl: 'https://synthetic.supabase.co' }, calls = [], transfers = [];
  let status = { signedIn: true, sessionGeneration: 1, account: { synk_user_id: accountId } };
  const envelope = extra => ({ ok: true, scope: 'synk-personal', resource, accountId, ...extra });
  const auth = { status: () => status, accountRequest: async (operation, params) => {
    calls.push({ operation, params });
    let result;
    if (operation === 'personalAssetPrepare') result = envelope({ assetId, uploadUrl: `${config.supabaseUrl}/storage/v1/object/upload/sign/personal-media/staging/${accountId}/${assetId}?token=synthetic-signed` });
    else if (operation === 'personalAssetConfirm') result = envelope({ mediaRef });
    else if (operation === 'personalAssetRead') result = envelope({ mediaRef, url: `${config.supabaseUrl}/storage/v1/object/sign/personal-media/objects/${accountId}/${assetId}?token=synthetic-signed` });
    else if (operation === 'personalAssetDelete') result = envelope({ deleted: true });
    else result = envelope({ revision: 0, state: null });
    return changedResult?.(operation, result) || result;
  } };
  const fetcher = async (url, options) => { transfers.push({ url, options }); if (response) return response(url, options); return options.method === 'PUT' ? new Response(null, { status: 200 }) : new Response(bytes, { headers: { 'Content-Type': mediaRef.mime, 'Content-Length': String(bytes.length) } }); };
  const broker = createPersonalBroker({ auth, resource, config, fetcher });
  return { broker, auth, config, calls, transfers, logout: () => { status = { signedIn: false, sessionGeneration: 2, account: null }; }, switchAccount: () => { status = { signedIn: true, sessionGeneration: 2, account: { synk_user_id: 'different-account' } }; } };
}

test('three personal apps use isolated OAuth registration and vault fingerprints in platform', () => {
  const clients = Object.fromEntries(['rehearsal', 'family-album', 'path'].map((id, index) => [id, { clientId: 'public-' + id, redirectUri: `http://127.0.0.1:${43827 + index}/synk/oauth/${id}/callback` }]));
  const raw = { version: 1, supabaseUrl: 'https://synthetic.supabase.co', supabasePublishableKey: 'sb_publishable_synthetic', clients };
  const configs = Object.keys(clients).map(id => configuration(raw, id, 'development'));
  assert.ok(configs.every(item => item.product === 'platform')); assert.equal(new Set(configs.map(item => item.fingerprint)).size, 3);
  assert.deepEqual(configs.map(item => item.clientKey), ['rehearsal', 'family-album', 'path']);
  assert.throws(() => configuration({ ...raw, clients: { ...clients, path: { ...clients.path, clientId: clients.rehearsal.clientId } } }, 'path', 'development'));
});

test('main clientKey fixes resource for every personal request and bounds state snapshots', () => {
  for (const resource of ['path', 'rehearsal', 'family-album']) {
    assert.deepEqual(requestSpec('personalLoad', {}, '1', 'platform', resource), { path: 'synk-personal?resource=' + resource });
    const input = { expected_revision: 3, state: { version: 1, sample: [] } }, spec = requestSpec('personalSave', input, '1', 'platform', resource);
    input.state.sample.push('late mutation'); assert.deepEqual(spec.body, { resource, action: 'save', expected_revision: 3, state: { version: 1, sample: [] } });
    assert.throws(() => requestSpec('personalLoad', { resource: 'family-album' }, '1', 'platform', resource));
    assert.throws(() => requestSpec('personalSave', { expected_revision: 0, state: { bad: undefined } }, '1', 'platform', resource));
    assert.throws(() => requestSpec('personalDelete', { expected_revision: -1 }, '1', 'platform', resource));
  }
  assert.throws(() => requestSpec('personalSave', { expected_revision: 0, state: { text: 'x'.repeat(65536) } }, '1', 'platform', 'path'));
  for (const scope of [['platform', undefined], ['world', 'path'], ['platform', 'care']]) assert.throws(() => requestSpec('personalLoad', {}, '1', ...scope));
  assert.throws(() => requestSpec('personalAssetPrepare', { ...mediaRef }, '1', 'platform', 'path'));
  assert.equal(requestSpec('personalAssetPrepare', { kind: 'image', mime: mediaRef.mime, size: bytes.length, sha256 }, '1', 'platform', 'family-album').body.action, 'media-upload');
});

test('native upload computes digest itself and only returns a confirmed media reference', async () => {
  const f = fixture(); const result = await f.broker.request('assetUpload', { kind: 'image', mime: 'image/png', bytes: new Uint8Array(bytes) });
  assert.deepEqual(result, { ok: true, scope: 'synk-personal', resource: 'family-album', accountId, mediaRef });
  assert.deepEqual(f.calls.map(call => call.operation), ['personalAssetPrepare', 'personalAssetConfirm']);
  assert.equal(f.calls[0].params.sha256, sha256); assert.equal(f.calls[0].params.size, bytes.length);
  assert.deepEqual(f.transfers[0].options.headers, { 'Content-Type': 'image/png', 'x-upsert': 'false' });
  assert.equal(f.transfers[0].options.redirect, 'error'); assert.equal(f.transfers[0].options.credentials, 'omit');
  assert.equal(JSON.stringify(result).includes('synthetic-signed'), false); f.broker.dispose();
});

test('native read checks length, MIME and sha256 before returning bytes', async () => {
  const f = fixture(); const result = await f.broker.request('assetRead', { assetId });
  assert.equal(result.ok, true); assert.deepEqual(Buffer.from(result.bytes), bytes); assert.deepEqual(result.mediaRef, mediaRef);
  assert.equal(result.url, undefined); assert.equal(f.transfers[0].options.headers, undefined); f.broker.dispose();
  for (const response of [
    () => new Response(Buffer.from('x'.repeat(bytes.length)), { headers: { 'Content-Type': 'image/png' } }),
    () => new Response(bytes, { headers: { 'Content-Type': 'text/html' } }),
    () => new Response(Buffer.concat([bytes, bytes]), { headers: { 'Content-Type': 'image/png' } }),
    () => new Response(bytes.subarray(1), { headers: { 'Content-Type': 'image/png' } }),
    () => new Response(null, { status: 302, headers: { Location: 'https://untrusted.invalid/' } }),
  ]) { const bad = fixture({ response }); assert.equal((await bad.broker.request('assetRead', { assetId })).ok, false); bad.broker.dispose(); }
});

test('native media errors retain only a validated missing asset id without raw provider data', async () => {
  for(const [code,id,expected] of [['ASSET_NOT_FOUND',assetId,assetId],['ASSET_NOT_CONFIRMED',assetId,assetId],['ASSET_NOT_FOUND','private/invalid',undefined],['NETWORK',assetId,undefined]]){
    const f=fixture({changedResult:()=>({ok:false,error:{code,assetId:id,raw:'private'}})});
    const result=await f.broker.request('assetRead',{assetId});assert.equal(result.error.code,code);assert.equal(result.error.assetId,expected);assert.equal(result.error.raw,undefined);assert.equal(f.transfers.length,0);f.broker.dispose();
  }
});

test('signed media URLs cannot redirect native fetch to other owners, buckets, servers or arbitrary paths', async () => {
  const urls = [
    `https://untrusted.invalid/storage/v1/object/sign/personal-media/objects/${accountId}/${assetId}?token=x`,
    `https://synthetic.supabase.co/storage/v1/object/sign/personal-media/objects/other/${assetId}?token=x`,
    `https://synthetic.supabase.co/storage/v1/object/sign/other-bucket/objects/${accountId}/${assetId}?token=x`,
    `https://synthetic.supabase.co/storage/v1/object/sign/personal-media/objects/${accountId}/${assetId}?token=x&token=y`,
    `https://synthetic.supabase.co/auth/v1/user?token=x`,
  ];
  for (const url of urls) { const f = fixture({ changedResult: (op, result) => op === 'personalAssetRead' ? { ...result, url } : result }); assert.equal((await f.broker.request('assetRead', { assetId })).ok, false); assert.equal(f.transfers.length, 0); f.broker.dispose(); }
});

test('foreign account, unconfirmed metadata and non-media app access never reach a transfer', async () => {
  const foreign = fixture({ changedResult: (_op, result) => ({ ...result, accountId: 'another' }) });
  assert.equal((await foreign.broker.request('assetRead', { assetId })).ok, false); assert.equal(foreign.transfers.length, 0); foreign.broker.dispose();
  const wrong = fixture({ changedResult: (op, result) => op === 'personalAssetConfirm' ? { ...result, mediaRef: { ...mediaRef, sha256: '0'.repeat(64) } } : result });
  assert.equal((await wrong.broker.request('assetUpload', { kind: 'image', mime: 'image/png', bytes })).ok, false); wrong.broker.dispose();
  for (const resource of ['path', 'rehearsal']) { const f = fixture({ resource }); assert.equal((await f.broker.request('assetRead', { assetId })).error.code, 'INVALID_REQUEST'); assert.equal(f.calls.length, 0); f.broker.dispose(); }
});

test('logout and disposal fence in-flight media before any bytes reach the renderer', async () => {
  for (const end of ['logout', 'switchAccount', 'dispose']) {
    let release; const waiting = new Promise(resolve => { release = resolve; });
    const f = fixture({ response: async () => { await waiting; return new Response(bytes, { headers: { 'Content-Type': 'image/png' } }); } });
    const promise = f.broker.request('assetRead', { assetId }); await new Promise(resolve => setImmediate(resolve));
    end === 'dispose' ? f.broker.dispose() : f[end](); release();
    const result = await promise; assert.equal(result.ok, false); assert.equal(result.bytes, undefined); f.broker.dispose();
  }
});

test('native media input and operation allowlists block arbitrary requests before auth dispatch', async () => {
  const f = fixture();
  for (const [operation, params] of [['revokeAll', {}], ['assetPrepare', {}], ['assetUpload', { kind: 'image', mime: 'image/svg+xml', bytes }], ['assetUpload', { kind: 'image', mime: 'image/png', bytes: 'not-binary' }], ['assetUpload', { kind: 'image', mime: 'image/png', bytes: new Uint8Array(6 * 1024 * 1024 + 1) }], ['assetRead', { assetId, url: 'https://untrusted.invalid' }]]) assert.equal((await f.broker.request(operation, params)).ok, false);
  assert.equal(f.calls.length, 0); f.broker.dispose();
});

test('personal IPC checks exact product, owning window and main frame before request dispatch', async () => {
  const f = fixture({ resource: 'path' }), handlers = new Map(), frame = { url: PRODUCT_PREVIEWS.path.entry }, webContents = { mainFrame: frame }, window = { webContents, isDestroyed: () => false };
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn), removeHandler: name => handlers.delete(name) };
  const unbind = bindPersonalIPC({ ipcMain, getWindow: () => window, auth: f.auth, resource: 'path', config: f.config });
  const handler = handlers.get('synk-personal:request'), trusted = { sender: webContents, senderFrame: frame };
  assert.equal((await handler(trusted, 'personalLoad', {})).ok, true);
  for (const event of [{ sender: {}, senderFrame: frame }, { sender: webContents, senderFrame: { url: frame.url } }]) await assert.rejects(handler(event, 'personalLoad', {}), /UNTRUSTED_SENDER/);
  frame.url = PRODUCT_PREVIEWS.rehearsal.entry; await assert.rejects(handler(trusted, 'personalLoad', {}), /UNTRUSTED_SENDER/);
  assert.equal(f.calls.length, 1); unbind(); assert.equal(handlers.size, 0); f.broker.dispose();
});

test('personal preload has no token getters, caller-defined resources or raw IPC surface', () => {
  const exposed = {}, calls = [], listeners = new Map();
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/personal-preload.cjs'), 'utf8'), { require: name => { assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld: (key, value) => { exposed[key] = value; } }, ipcRenderer: { invoke: (...args) => { calls.push(args); }, on: (name, listener) => listeners.set(name, listener), removeListener: name => listeners.delete(name) } }; } });
  assert.deepEqual(Object.keys(exposed.synkPersonalAccount).sort(), ['getEnvironment', 'authStatus', 'authSignIn', 'authSignOut', 'request', 'onAuthChanged'].sort());
  assert.ok(Object.isFrozen(exposed.synkPersonalAccount)); exposed.synkPersonalAccount.request('personalLoad'); assert.equal(calls[0][0], 'synk-personal:request');
  const stop = exposed.synkPersonalAccount.onAuthChanged(() => {}); assert.equal(listeners.size, 1); stop(); assert.equal(listeners.size, 0);
});
