import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatingAccount } from '../experiences/atlas-lab/dating-account.mjs';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k), entries: () => [...m] }; };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const cfg = { version: 1, supabaseUrl: 'https://identity.example.test', supabasePublishableKey: 'sb_publishable_fixture', accountApiUrl: 'https://identity.example.test', portalUrl: 'https://identity.example.test/id/', clients: { platform: { clientId: 'dating-fixture', redirectUri: 'http://localhost/atlas-lab/dating.html' } } };
const binding = c => [c.supabaseUrl,c.accountApiUrl,c.clients.platform.clientId,c.clients.platform.redirectUri].join('|');
function stored(storage, session = { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_at: Date.now() + 3600000 }, config = cfg) { storage.setItem('synk.oauth.session.dating', JSON.stringify({ binding: binding(config), session })); }
const location = () => ({ href: 'http://localhost/atlas-lab/dating.html', assign() {} });

test('receipt checkpoint binding uses only the public registration or demo surface and excludes OAuth secrets and query parameters', async () => {
  const storage=memory();stored(storage);
  const client=createDatingAccount({storage,location:{href:'http://localhost/atlas-lab/dating.html?demo=sample-1&code=fixture-secret',assign(){}},
    fetcher:async()=>json({ok:true,accountConfig:{...cfg,clients:{platform:{...cfg.clients.platform,redirectUri:'http://localhost/atlas-lab/other.html'}}},mode:'account'})});
  // A separate clean location is used for a normal stored-session bootstrap.
  const account=createDatingAccount({storage,location:location(),fetcher:async()=>json({ok:true,accountConfig:cfg,mode:'account'})});
  await account.start(); assert.equal(account.checkpointBinding(),`v1|account|${binding(cfg)}`);
  assert.doesNotMatch(account.checkpointBinding(),/fixture-access|fixture-refresh/);
  assert.equal(client.checkpointBinding({demo:true}),'v1|demo|http://localhost|/atlas-lab/dating.html');
  assert.doesNotMatch(client.checkpointBinding({demo:true}),/sample-1|fixture-secret/);
  account.dispose();client.dispose();
});

test('demo credentials are memory-only, distinct from a real SYNK session', async () => {
  const storage = memory(), calls = [];
  const client = createDatingAccount({ storage, location: location(), fetcher: async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/config')) return json({ ok: true, mode: 'demo', demoEnabled: true });
    if (String(url).endsWith('/demo/session')) return json({ ok: true, token: 'demo-fixture', accountId: 'adult-a' });
    return json({ ok: true, view: { accountId: 'adult-a' } });
  } });
  await client.start(); await client.demo('adult-a'); await client.request('/state', undefined, { demo: true });
  assert.equal(calls.at(-1).options.headers.Authorization, 'Bearer demo-fixture');
  assert.deepEqual(storage.entries(), []); await assert.rejects(client.request('/state'), /로그인/); client.dispose();
});
test('an OAuth session is bound to its registered identity origin and product client', async () => {
  const storage = memory(); stored(storage, undefined, { ...cfg, clients: { platform: { ...cfg.clients.platform, clientId: 'other-client' } } });
  const client = createDatingAccount({ storage, location: location(), fetcher: async () => json({ ok: true, accountConfig: cfg, mode: 'account' }) });
  await client.start(); assert.equal(client.snapshot().signedIn, false); assert.equal(storage.getItem('synk.oauth.session.dating'), null);
  await assert.rejects(client.request('/state'), /로그인/); client.dispose();
});
test('account requests use SYNK bearer but never send private records to the identity host', async () => {
  const storage = memory(); stored(storage); const calls = [];
  const client = createDatingAccount({ storage, location: location(), fetcher: async (url, options) => {
    calls.push([String(url),options]); return json(String(url).endsWith('/config') ? { ok: true, accountConfig: cfg, mode: 'account' } : { ok: true, appliedRevision: 1, result: {}, view: { revision: 1 } });
  } });
  await client.start(); const body = { requestId: 'fixture', expectedRevision: 0, action: { kind: 'profile', profile: { nickname: '나' } } };
  await client.request('/action', body);
  assert.equal(calls.at(-1)[0], '/api/atlas-dating/action'); assert.equal(calls.at(-1)[1].headers.Authorization, 'Bearer fixture-access'); assert.equal(calls.at(-1)[1].body, JSON.stringify(body));
  assert.equal(storage.entries().length, 1); assert.doesNotMatch(storage.entries()[0][1], /nickname/); client.dispose();
});
test('revoked identity clears stored credentials and does not retry the mutation', async () => {
  const storage = memory(); stored(storage); let writes = 0;
  const client = createDatingAccount({ storage, location: location(), fetcher: async url => {
    if (String(url).endsWith('/config')) return json({ ok: true, accountConfig: cfg, mode: 'account' });
    writes++; return json({ ok: false, error: { code: 'AUTH_REQUIRED' } }, 401);
  } });
  await client.start(); await assert.rejects(client.request('/action', {}), { status: 401 });
  assert.equal(writes, 1); assert.equal(storage.getItem('synk.oauth.session.dating'), null); assert.equal(client.snapshot().signedIn, false); client.dispose();
});
test('logout rejects a late response from the prior identity', async () => {
  const storage = memory(); stored(storage); let release;
  const client = createDatingAccount({ storage, location: location(), fetcher: async url => {
    if (String(url).endsWith('/config')) return json({ ok: true, accountConfig: cfg, mode: 'account' });
    if (String(url).includes('/auth/v1/logout')) return json({ ok: true });
    return new Promise(resolve => { release = () => resolve(json({ ok: true, view: { private: 'old' } })); });
  } });
  await client.start(); const pending = client.request('/state'); await client.signOut(); release(); await assert.rejects(pending, /바뀌었어요/); client.dispose();
});
test('dating PKCE uses its own pending namespace without overwriting platform login', async () => {
  const storage = memory(); storage.setItem('synk.oauth.pending.platform', 'keep-other-app'); const loc = location(); let destination;
  loc.assign = url => { destination = url; };
  const client = createDatingAccount({ storage, location: loc, fetcher: async () => json({ ok: true, accountConfig: cfg, mode: 'account' }) });
  await client.start(); await client.signIn();
  assert.equal(storage.getItem('synk.oauth.pending.platform'), 'keep-other-app'); assert.ok(storage.getItem('dating.synk.oauth.pending.platform'));
  const redirect = new URL(destination); assert.equal(redirect.searchParams.get('client_id'), 'dating-fixture'); assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256'); client.dispose();
});
test('renewal is single-flight and a logout during refresh cannot restore a session', async () => {
  const storage = memory(); stored(storage, { access_token: 'old', refresh_token: 'refresh', expires_at: 0 }); let release, renewals = 0;
  const client = createDatingAccount({ storage, location: location(), fetcher: async url => {
    if (String(url).endsWith('/config')) return json({ ok: true, accountConfig: cfg, mode: 'account' });
    if (String(url).endsWith('/oauth/token')) { renewals++; return new Promise(resolve => { release = () => resolve(json({ access_token: 'new', expires_in: 3600 })); }); }
    return json({ ok: true });
  } });
  await client.start(); const requests = [client.request('/state'), client.request('/state')]; const rejected = Promise.all(requests.map(p => assert.rejects(p, /바뀌었어요/)));
  await client.signOut(); release(); await rejected; assert.equal(renewals, 1); assert.equal(storage.getItem('synk.oauth.session.dating'), null); client.dispose();
});
test('a revoked refresh credential clears the session; a transient provider outage preserves it', async () => {
  for (const revoked of [true,false]) {
    const storage = memory(); stored(storage, { access_token: 'old', refresh_token: 'refresh', expires_at: 0 });
    const client = createDatingAccount({ storage, location: location(), fetcher: async url => String(url).endsWith('/config') ? json({ ok: true, accountConfig: cfg, mode: 'account' }) : json({ error: revoked ? 'invalid_grant' : 'temporarily_unavailable' }, revoked ? 400 : 503) });
    await client.start(); await assert.rejects(client.request('/state'));
    assert.equal(client.snapshot().signedIn, !revoked); assert.equal(!!storage.getItem('synk.oauth.session.dating'), !revoked); client.dispose();
  }
});
test('only dispatched action uncertainty is marked: transport, unreadable JSON/body and server outage; definitive rejection and GET are separate', async () => {
  for (const mode of ['network','timeout','read','json','shape','empty-success','false-success','large','server','bad-request','bad-json','get']) {
    const storage=memory(); stored(storage); let writes=0;
    const client=createDatingAccount({storage,location:location(),fetcher:async url=>{
      if(String(url).endsWith('/config')) return json({ok:true,accountConfig:cfg,mode:'account'}); writes++;
      if(['network','get'].includes(mode)) throw new TypeError('synthetic offline');
      if(mode==='timeout') throw new DOMException('synthetic timeout','TimeoutError');
      if(mode==='read') return {status:200,ok:true,text:async()=>{throw new TypeError('synthetic body failure');}};
      if(mode==='large') return {status:200,ok:true,text:async()=> 'x'.repeat(1048577)};
      if(mode==='json') return new Response('{'); if(mode==='shape') return json(null);
      if(mode==='empty-success') return json({ok:true});
      if(mode==='false-success') return json({ok:false});
      if(mode==='server') return json({ok:false,error:{code:'service-error'}},503);
      if(mode==='bad-json') return new Response('{',{status:400});
      return json({ok:false,error:{code:'invalid-envelope'}},400);
    }});
    await client.start(); let error; try {await client.request(mode==='get'?'/state':'/action',mode==='get'?undefined:{requestId:'synthetic'});} catch(e){error=e;}
    assert.ok(error,mode); assert.equal(error.outcomeUnknown===true,!['bad-request','bad-json','get'].includes(mode),mode); assert.equal(writes,1,mode); client.dispose();
  }
});
test('logout or disposal during a dispatched mutation does not turn a stale response into a recoverable write', async () => {
  for(const close of ['signOut','dispose']) {
    const storage=memory(); stored(storage); let release;
    const client=createDatingAccount({storage,location:location(),fetcher:async url=>{
      if(String(url).endsWith('/config')) return json({ok:true,accountConfig:cfg,mode:'account'});
      if(String(url).includes('/auth/v1/logout')) return json({ok:true});
      return new Promise((resolve,reject)=>{release=()=>reject(new TypeError('synthetic late network failure'));});
    }});
    await client.start(); const write=client.request('/action',{}); const rejected=assert.rejects(write,e=>e.outcomeUnknown!==true && /바뀌었어요/.test(e.message)); await client[close](); release(); await rejected; client.dispose();
  }
});
test('a malformed authentication rejection clears credentials and never remains uncertain', async () => {
  const storage=memory(); stored(storage); const client=createDatingAccount({storage,location:location(),fetcher:async url=>String(url).endsWith('/config')?json({ok:true,accountConfig:cfg,mode:'account'}):new Response('{',{status:401})});
  await client.start(); await assert.rejects(client.request('/action',{}),error=>error.status===401 && error.outcomeUnknown!==true); assert.equal(client.snapshot().signedIn,false); assert.equal(storage.getItem('synk.oauth.session.dating'),null); client.dispose();
});

test('busy and explicit restart rejections preserve login and allow only an explicit new attempt', async () => {
  for (const [status,code] of [[429,'account-busy'],[503,'service-restarting']]) {
    const storage=memory(); stored(storage); const initial=storage.getItem('synk.oauth.session.dating'); let calls=0;
    const client=createDatingAccount({storage,location:location(),fetcher:async url=>{
      if(String(url).endsWith('/config'))return json({ok:true,accountConfig:cfg,mode:'account'});
      calls++;return calls===1?json({ok:false,error:{code}},status):json({ok:true,result:{},appliedRevision:1,view:{revision:1}});
    }});
    await client.start();await assert.rejects(client.request('/action',{requestId:'synthetic'}),error=>error.status===status&&error.code===code&&error.outcomeUnknown!==true&&/잠시 뒤 다시 시도/.test(error.message));
    assert.equal(calls,1);assert.equal(client.snapshot().signedIn,true);assert.equal(storage.getItem('synk.oauth.session.dating'),initial);
    assert.equal((await client.request('/action',{requestId:'explicit-synthetic'})).appliedRevision,1);assert.equal(calls,2);client.dispose();
  }
});

test('only a complete explicit 503 restart envelope removes action uncertainty', async () => {
  for(const [status,body] of [[500,JSON.stringify({ok:false,error:{code:'service-restarting'}})],[503,JSON.stringify({ok:false,error:{code:'service-error'}})],[503,JSON.stringify({ok:true,error:{code:'service-restarting'}})],[503,JSON.stringify({error:{code:'service-restarting'}})],[503,'{"ok":false,"error":{"code":"service-restarting"}'],[503,'<h1>Service unavailable</h1>']]) {
    const storage=memory();stored(storage);let calls=0;
    const client=createDatingAccount({storage,location:location(),fetcher:async url=>String(url).endsWith('/config')?json({ok:true,accountConfig:cfg,mode:'account'}):(calls++,new Response(body,{status}))});
    await client.start();await assert.rejects(client.request('/action',{}),error=>error.outcomeUnknown===true);assert.equal(calls,1);assert.equal(client.snapshot().signedIn,true);client.dispose();
  }
});

test('storage unavailability preserves uncertain actions and login without automatic replay', async () => {
  const storage=memory();stored(storage);const before=storage.getItem('synk.oauth.session.dating');let calls=0;
  const client=createDatingAccount({storage,location:location(),fetcher:async url=>String(url).endsWith('/config')
    ?json({ok:true,accountConfig:cfg,mode:'account'}):(calls++,json({ok:false,error:{code:'storage-unavailable'}},503))});
  await client.start();
  await assert.rejects(client.request('/action',{}),error=>error.status===503&&error.code==='storage-unavailable'
    &&error.outcomeUnknown===true&&/기록을 저장하거나 확인하기 어려워요/.test(error.message));
  assert.equal(calls,1);assert.equal(client.snapshot().signedIn,true);assert.equal(storage.getItem('synk.oauth.session.dating'),before);
  await assert.rejects(client.request('/receipt?requestId=synthetic'),error=>error.status===503&&error.outcomeUnknown!==true);
  assert.equal(calls,2);assert.equal(storage.getItem('synk.oauth.session.dating'),before);client.dispose();
});

test('state retrieval failures do not claim that a change failed to save', async () => {
  for(const code of ['account-busy','service-restarting','service-error']) {
    const storage=memory();stored(storage);const client=createDatingAccount({storage,location:location(),fetcher:async url=>String(url).endsWith('/config')?json({ok:true,accountConfig:cfg,mode:'account'}):json({ok:false,error:{code}},code==='account-busy'?429:503)});
    await client.start();await assert.rejects(client.request('/state'),error=>error.outcomeUnknown!==true&&/잠시 뒤 다시 시도/.test(error.message)&&!error.message.includes('저장'));assert.equal(client.snapshot().signedIn,true);client.dispose();
  }
});
