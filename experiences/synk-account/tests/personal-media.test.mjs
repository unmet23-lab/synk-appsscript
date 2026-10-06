import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { requestPersonalMedia } from '../src/personal-media.mjs';
const ownerId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222';
const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);
const ref = { assetId, sha256: createHash('sha256').update(bytes).digest('hex'), mime: 'image/png', size: bytes.length, kind: 'image' };
const wrap = body => ({ ok: true, scope: 'synk-personal', resource: 'family-album', accountId: ownerId, ...body });
const uploadUrl = `https://auth.example.test/storage/v1/object/upload/sign/personal-media/staging/${ownerId}/${assetId}?token=fixture`;
const url = `https://auth.example.test/storage/v1/object/sign/personal-media/objects/${ownerId}/${assetId}?token=fixture`;
function fixture(overrides={}) {
  const calls = [], transfers = []; let active = true;
  const options = { ownerId, origin: 'https://auth.example.test', cryptoAPI: webcrypto, controllers: new Set(), guard() { if (!active) throw Object.assign(Error('changed'), { code:'ACCOUNT_CHANGED' }); },
    async api(body) { calls.push(body); return wrap(body.action === 'media-upload' ? { assetId, uploadUrl } : body.action === 'media-confirm' ? { mediaRef:ref } : body.action === 'media-delete' ? { deleted:true } : { mediaRef:ref,url }); },
    async fetcher(input, init) { transfers.push({input,init}); return init.method==='PUT' ? new Response('{}') : new Response(bytes,{headers:{'Content-Type':ref.mime,'Content-Length':String(bytes.length)}}); }, ...overrides };
  return { calls, transfers, options, change:()=>{active=false;}, run:(operation,values)=>requestPersonalMedia({...options,operation,values}) };
}
test('browser originals upload to staging without account headers and confirm the exact immutable digest',async()=>{
  const f=fixture(), result=await f.run('assetUpload',{kind:'image',mime:'image/png',bytes});
  assert.deepEqual(result.mediaRef,ref);assert.deepEqual(f.calls.map(x=>x.action),['media-upload','media-confirm']);
  assert.equal(f.calls[0].sha256,ref.sha256);assert.equal(f.transfers[0].input,uploadUrl);
  assert.equal(f.transfers[0].init.redirect,'error');assert.equal(f.transfers[0].init.credentials,'omit');
  assert.deepEqual(Object.keys(f.transfers[0].init.headers).sort(),['Content-Type','x-upsert']);assert.equal(f.options.controllers.size,0);
});
test('read returns original bytes and strips signed addresses from the result',async()=>{
  const f=fixture(), result=await f.run('assetRead',{assetId});assert.deepEqual(new Uint8Array(result.bytes),bytes);assert.equal(result.url,undefined);assert.equal(result.uploadUrl,undefined);
});

test('media failure preserves a validated missing asset id without copying provider fields',async()=>{
  for(const [code,id,expected] of [['ASSET_NOT_FOUND',assetId,assetId],['ASSET_NOT_CONFIRMED',assetId,assetId],['ASSET_NOT_FOUND','private/invalid',undefined],['NETWORK',assetId,undefined]]){
    const f=fixture({api:async()=>({ok:false,error:{code,assetId:id,private:'not returned'}})});
    await assert.rejects(f.run('assetRead',{assetId}),error=>error.code===code&&error.assetId===expected&&error.private===undefined);assert.equal(f.transfers.length,0);
  }
});
test('signed URL origin, owner, stage, query and redirect traps are rejected before a transfer',async()=>{
  for(const bad of [url.replace('auth.example','evil.example'),url.replace(ownerId,assetId),url.replace('/objects/','/staging/'),url+'&extra=x',url+'&token=another',url+'#fragment',url.replace('https:','http:'),url.replace('https://','https://user:pass@')]) {
    const f=fixture({api:async()=>wrap({mediaRef:ref,url:bad})});await assert.rejects(f.run('assetRead',{assetId}));assert.equal(f.transfers.length,0,bad);
  }
});
test('invalid owner, asset, upload confirmation and unchanged-length byte tampering never reach the album',async()=>{
  for(const body of [wrap({mediaRef:{...ref,assetId:ownerId},url}),{...wrap({mediaRef:ref,url}),accountId:assetId}]) {const f=fixture({api:async()=>body});await assert.rejects(f.run('assetRead',{assetId}));assert.equal(f.transfers.length,0);}
  const f=fixture({fetcher:async()=>new Response(new Uint8Array(bytes.length),{headers:{'Content-Type':ref.mime}})});await assert.rejects(f.run('assetRead',{assetId}),{code:'INVALID_RESPONSE'});
  const u=fixture({api:async b=>wrap(b.action==='media-upload'?{assetId,uploadUrl}:{mediaRef:{...ref,sha256:'0'.repeat(64)}})});await assert.rejects(u.run('assetUpload',{kind:'image',mime:ref.mime,bytes}));
});
test('stream overflow, short body and wrong MIME are rejected',async()=>{
  for(const [body,mime] of [[new Uint8Array(bytes.length+1),ref.mime],[bytes.slice(1),ref.mime],[bytes,'text/html']]){const f=fixture({fetcher:async()=>new Response(body,{headers:{'Content-Type':mime}})});await assert.rejects(f.run('assetRead',{assetId}));assert.equal(f.options.controllers.size,0);}
});
test('late upload cannot confirm after account change and source mutations cannot alter copied bytes',async()=>{
  const original=bytes.slice(), f=fixture();f.options.fetcher=async(input,init)=>{original[0]=0;assert.equal(init.body[0],137);f.change();return new Response('{}');};
  await assert.rejects(f.run('assetUpload',{kind:'image',mime:ref.mime,bytes:original}),{code:'ACCOUNT_CHANGED'});assert.equal(f.calls.length,1);
});
test('media request rejects foreign routing parameters, excess size and unsupported types',async()=>{
  for(const [op,values] of [['assetRead',{assetId,accountId:ownerId}],['assetDelete',{assetId:'wrong'}],['assetUpload',{kind:'image',mime:'image/svg+xml',bytes}],['assetUpload',{kind:'image',mime:ref.mime,bytes:new Uint8Array(6*1024*1024+1)}]]){const f=fixture();await assert.rejects(f.run(op,values));assert.equal(f.calls.length,0);}
});
