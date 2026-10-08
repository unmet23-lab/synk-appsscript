import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createDatingStore } from '../experiences/atlas-lab/dating-store.mjs';
import { createDatingService } from '../experiences/atlas-lab/dating-service.mjs';
import { createDatingAccount } from '../experiences/atlas-lab/dating-account.mjs';
import { createDatingDelivery } from '../experiences/atlas-lab/dating-delivery.mjs';
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'synk-receipt-'));
  const store = createDatingStore({ path: path.join(dir, 'fixture.sqlite'), mode: 'account' });
  const service = createDatingService({ store, verify: async token => { if (!['actor-a','actor-b'].includes(token)) throw Object.assign(new Error('synthetic auth'), { status: 401 }); return { accountId: token }; } });
  let wait = null, entered = null;
  const server = http.createServer(async (req,res) => { if (wait && req.url.endsWith('/action')) { const blocked = wait; wait = null; entered?.(); await blocked; } await service.handle(req,res); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir())); assert.ok(path.basename(dir).startsWith('synk-receipt-')); await fs.rm(dir,{recursive:true,force:true}); });
  const call = async (route, body, token = 'actor-a', overrides = {}) => { const r = await fetch(origin + '/api/atlas-dating' + route, { method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type':'application/json' }), ...overrides }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { httpStatus:r.status, ...await r.json() }; };
  const state = async token => (await call('/state', undefined, token)).view;
  const envelope = async (action = { kind:'profile', profile:{ nickname:'소거 대상 비공개 초안',region:'합성',intro:'비공개 입력',values:{},required:[] } }) => ({ requestId:randomUUID(),expectedRevision:(await state()).revision,action });
  return {store,call,state,envelope,origin,delay:promise=>{wait=promise;return new Promise(resolve=>{entered=resolve;});}};
}
test('receipts reveal only the authenticated actor’s outcome, keep current view separate from applied revision, and never return the action body', async t => {
  const f = await fixture(t), body = await f.envelope(); const written = await f.call('/action', body); assert.equal(written.httpStatus,200);
  const later = await f.envelope({kind:'pause',paused:true}); await f.call('/action',later);
  const receipt = await f.call(`/receipt?requestId=${body.requestId}`); assert.equal(receipt.status,'applied'); assert.equal(receipt.appliedRevision,written.appliedRevision); assert.ok(receipt.view.revision > receipt.appliedRevision); assert.equal(receipt.requestId,body.requestId);
  assert.equal(Object.hasOwn(receipt,'action'),false); assert.equal(Object.hasOwn(receipt,'digest'),false); assert.equal(Object.hasOwn(receipt,'actor'),false);
  assert.equal((await f.call(`/receipt?requestId=${body.requestId}`,undefined,'actor-b')).status,'not-found');
  assert.equal((await f.call(`/receipt?requestId=${randomUUID()}`)).status,'not-found');
  assert.equal((await f.call(`/receipt?requestId=${body.requestId}`,undefined,'bad')).httpStatus,401);
});
test('receipt queries and methods are strict and cross-origin calls cannot read outcomes', async t => {
  const f = await fixture(t), id = randomUUID();
  for (const query of ['', '?requestId=bad', `?requestId=${id}&requestId=${id}`, `?requestId=${id}&actorId=actor-b`]) assert.equal((await f.call('/receipt'+query)).httpStatus,400);
  assert.equal((await f.call(`/receipt?requestId=${id}`,{})).httpStatus,405);
  assert.equal((await f.call(`/receipt?requestId=${id}`,undefined,'actor-a',{Origin:'http://foreign.example'})).httpStatus,403);
});
test('old receipts cannot bypass current suspended/deleted account gates or revive a mutation', async t => {
  const f = await fixture(t), body = await f.envelope(); await f.call('/action',body);
  f.store.transaction(tx => { const row=tx.account('actor-a'); tx.updateAccount(row,row.document,'suspended'); });
  assert.equal((await f.call(`/receipt?requestId=${body.requestId}`)).httpStatus,403);
  const revision=(await f.state()).revision, replay=await f.call('/action',body); assert.equal(replay.httpStatus,200); assert.equal(replay.replayed,true); assert.equal(replay.view.status,'suspended'); assert.equal(replay.view.revision,revision); assert.equal(replay.view.operator,false);
  const remove = await f.envelope({kind:'delete'}); assert.equal((await f.call('/action',remove)).httpStatus,200);
  assert.equal((await f.call(`/receipt?requestId=${remove.requestId}`)).httpStatus,410); assert.equal((await f.call('/action',body)).httpStatus,410);
});
test('a missing receipt during a delayed POST never proves absence; one explicit retry commits the same envelope once', async t => {
  const f = await fixture(t); await f.state(); let release; const entered=f.delay(new Promise(resolve=>{release=resolve;})); const body = await f.envelope();
  const initial = f.call('/action',body); await entered;
  const missing = await f.call(`/receipt?requestId=${body.requestId}`); assert.equal(missing.status,'not-found');
  const retry = await f.call('/action',body); assert.equal(retry.httpStatus,200); release(); const delayed = await initial; assert.equal(delayed.replayed,true); assert.equal(delayed.appliedRevision,retry.appliedRevision); assert.equal(delayed.view.revision,retry.view.revision);
  assert.equal((await f.call(`/receipt?requestId=${body.requestId}`)).status,'applied');
});
test('real HTTP lost response is classified by account client and resolved by delivery receipt without replaying the private mutation', async t => {
  const f = await fixture(t), view = await f.state(), cfg={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/id/',clients:{platform:{clientId:'synthetic',redirectUri:f.origin+'/atlas-lab/dating.html'}}};
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},binding=[cfg.supabaseUrl,cfg.accountApiUrl,cfg.clients.platform.clientId,cfg.clients.platform.redirectUri].join('|');
  storage.setItem('synk.oauth.session.dating',JSON.stringify({binding,session:{access_token:'actor-a',refresh_token:'synthetic',expires_at:Date.now()+3600000}}));
  let writes=0; const account=createDatingAccount({storage,location:{href:cfg.clients.platform.redirectUri},fetcher:async(url,options)=>{ if (String(url).endsWith('/config')) return new Response(JSON.stringify({ok:true,mode:'account',accountConfig:cfg})); const r=await fetch(f.origin+url,{...options,headers:{...options.headers,Origin:f.origin}}); if(String(url).endsWith('/action') && ++writes===1){await r.text();throw new TypeError('synthetic response lost after commit');} return r;}}); await account.start();
  const delivery=createDatingDelivery({request:account.request}); await assert.rejects(delivery.send({actorId:view.accountId,expectedRevision:view.revision,action:{kind:'adult',declared:true}}),{outcomeUnknown:true}); assert.ok(delivery.snapshot());
  const recovered=await delivery.check({actorId:view.accountId}); assert.equal(recovered.status,'applied'); assert.equal(recovered.currentView.adult.selfDeclared,true); assert.equal(delivery.snapshot(),null); assert.equal(writes,1); assert.equal(map.size,1); assert.doesNotMatch([...map.values()].join(''),/requestId|declared/); account.dispose();
});
