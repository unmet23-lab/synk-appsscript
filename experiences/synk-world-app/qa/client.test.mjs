import test from 'node:test';import assert from 'node:assert/strict';import {WorldClient} from '../world-client.mjs';
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
const snapshot=(accountId='a',revision=1)=>({ok:true,accountId,revision,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[]});
const response=(data,status=200)=>({ok:status===200,status,json:async()=>data});
test('logout invalidates slow decoded responses',async()=>{let release;const decoded=new Promise(r=>release=r);const client=new WorldClient({storage:storage(),fetcher:async url=>url.endsWith('logout')?response({ok:true}):{ok:true,status:200,json:()=>decoded}});const request=client.refresh();await new Promise(r=>setTimeout(r,0));await client.logout();release(snapshot());await assert.rejects(request,{code:'STALE_RESPONSE'});assert.equal(client.snapshot,null);});
test('server snapshot revision never moves backward',()=>{const client=new WorldClient({storage:storage()});client.adopt(snapshot('a',5));client.adopt(snapshot('a',3));assert.equal(client.snapshot.revision,5);assert.throws(()=>client.adopt(snapshot('b',9)),{code:'ACCOUNT_MISMATCH'});});

test('appearance broadcasts only invalidate distinct server state and can be disabled for a receiving bridge',()=>{
  const originalWindow=globalThis.window,originalChannel=globalThis.BroadcastChannel,messages=[];
  try{
    globalThis.window={};globalThis.BroadcastChannel=class{constructor(name){assert.equal(name,'synk-world-appearance-v1');}postMessage(value){messages.push(value);}close(){}};
    const source=new WorldClient({storage:storage(),tabStorage:storage()});source.adopt(snapshot('a',2));source.emit();source.adopt(snapshot('a',2));source.adopt(snapshot('a',3));
    assert.deepEqual(messages,[{type:'refresh'},{type:'refresh'}]);
    const receiver=new WorldClient({storage:storage(),tabStorage:storage(),broadcastAppearance:false});receiver.adopt(snapshot('a',3));receiver.adopt(snapshot('a',4));assert.equal(messages.length,2);
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;globalThis.BroadcastChannel=originalChannel;}
});
test('network failure retains exact outfit request for replay',async()=>{let broken=true,received=[];const client=new WorldClient({storage:storage(),fetcher:async(url,options)=>{received.push(JSON.parse(options.body));if(broken)throw Error();return response(snapshot('a',2));}});client.adopt(snapshot());await assert.rejects(client.equip({body:'mongle-apron-starter',neck:''}),{code:'NETWORK_UNAVAILABLE'});const id=client.pending.requestId;broken=false;await client.sendPending();assert.equal(received[1].requestId,id);assert.equal(client.pending,null);});
test('conflict does not silently rebase and overwrite',async()=>{const client=new WorldClient({storage:storage(),fetcher:async()=>response({error:{code:'REVISION_CONFLICT'},revision:5},409)});client.adopt(snapshot());await assert.rejects(client.equip({body:'',neck:''}),{status:409});assert.equal(client.status,'conflict');assert.equal(client.pending.expectedRevision,1);});
test('failed server logout does not silently re-login on restart',async()=>{const cache=storage(),tab=storage();const client=new WorldClient({storage:cache,tabStorage:tab,fetcher:async()=>{throw Error();}});client.adopt(snapshot());await assert.rejects(client.logout());let calls=0;const next=new WorldClient({storage:cache,tabStorage:tab,fetcher:()=>{calls++;}});assert.equal(await next.restore(),false);assert.equal(calls,0);assert.equal(cache.getItem('synk-world-v1-signed-out'),null);});
test('pending outfit belongs only to its account',async()=>{const cache=storage();cache.setItem('synk-world-v1-pending:a',JSON.stringify({requestId:'a-command'}));const client=new WorldClient({storage:cache});client.adopt(snapshot('b'));client.loadPending();assert.equal(client.pending,null);});

// Browser tabs share the rehearsal cookie, while each open app must keep its own account.
// This transport models that browser behavior and the server's Bearer-first identity lookup.
function sharedCookieTransport(){
  const accounts=new Map([['a',snapshot('a')],['b',snapshot('b')]]),tokens=new Map(),calls=[];
  const cookies=new Map();let sequence=0,delaySession=null,delayLogout=null;
  const fetcher=async(url,options={})=>{
    const route=url.split('/api/world/')[1],headers=new Headers(options.headers),authorization=headers.get('authorization'),tab=headers.get('x-synk-rehearsal-tab')||'native';
    const token=authorization?.replace(/^Bearer /,'')||cookies.get(tab),owner=tokens.get(token);
    calls.push({route,owner,hasBearer:!!authorization,tab});
    if(route==='rehearsal/session'){
      const {accountKey}=JSON.parse(options.body),next=`synthetic-${accountKey}-${++sequence}`;
      tokens.set(next,accountKey);
      const gate=delaySession;delaySession=null;if(gate)await gate;
      cookies.set(tab,next);
      return response({ok:true,accessToken:next});
    }
    if(route==='rehearsal/status')return response({ok:true,authenticated:!!owner,...(owner?{accessToken:token}:{})});
    if(route==='rehearsal/logout'){
      const clearCookie=token===cookies.get(tab);tokens.delete(token);
      const gate=delayLogout;delayLogout=null;if(gate)await gate;
      if(clearCookie)cookies.delete(tab);
      return response({ok:true});
    }
    if(!owner)return response({error:{code:'AUTH_REQUIRED'}},401);
    const current=accounts.get(owner);
    if(route==='avatar/outfit'){
      const command=JSON.parse(options.body);
      if(command.expectedRevision!==current.revision)return response({error:{code:'REVISION_CONFLICT'},revision:current.revision},409);
      current.avatar.slots=command.slots;current.revision++;
    }
    return response(structuredClone(current));
  };
  return {fetcher,accounts,calls,delayNextSession:gate=>{delaySession=gate;},delayNextLogout:gate=>{delayLogout=gate;}};
}

test('a different tab login cannot redirect an existing tab outfit write to the shared-cookie account',async()=>{
  const transport=sharedCookieTransport(),cache=storage();
  const a=new WorldClient({fetcher:transport.fetcher,storage:cache}),b=new WorldClient({fetcher:transport.fetcher,storage:cache});
  await a.signIn('a');await b.signIn('b');
  await a.equip({body:'mongle-apron-starter',neck:''});
  assert.equal(a.snapshot.accountId,'a');assert.equal(b.snapshot.accountId,'b');
  assert.equal(transport.accounts.get('a').avatar.slots.body,'mongle-apron-starter');
  assert.equal(transport.accounts.get('b').avatar.slots.body,'');
  assert.deepEqual(transport.calls.filter(call=>call.route==='avatar/outfit').map(({owner,hasBearer})=>({owner,hasBearer})),[{owner:'a',hasBearer:true}]);
  assert.ok([...cache.data.values()].every(value=>!value.includes('synthetic-')),'credentials must not enter localStorage');
});

test('a restored tab pins its restored identity before another tab changes the cookie',async()=>{
  const transport=sharedCookieTransport(),tab=storage();
  const first=new WorldClient({fetcher:transport.fetcher,storage:storage(),tabStorage:tab});await first.signIn('a');
  const restored=new WorldClient({fetcher:transport.fetcher,storage:storage(),tabStorage:tab});assert.equal(await restored.restore(),true);
  const other=new WorldClient({fetcher:transport.fetcher,storage:storage()});await other.signIn('b');
  await restored.equip({body:'mongle-apron-starter',neck:''});
  assert.equal(restored.snapshot.accountId,'a');
  assert.equal(transport.accounts.get('b').avatar.slots.body,'');
  assert.equal(transport.calls.at(-1).hasBearer,true);
});

test('a late superseded login cookie cannot replace the latest identity before or after reload',async()=>{
  const transport=sharedCookieTransport(),tab=storage();let release;
  transport.delayNextSession(new Promise(resolve=>{release=resolve;}));
  const client=new WorldClient({fetcher:transport.fetcher,storage:storage(),tabStorage:tab});
  const stale=client.signIn('a');const rejection=assert.rejects(stale,{code:'STALE_RESPONSE'});
  await client.signIn('b');release();await rejection;
  await client.equip({body:'mongle-apron-starter',neck:''});
  assert.equal(client.snapshot.accountId,'b');
  assert.equal(transport.accounts.get('a').avatar.slots.body,'');
  assert.equal(transport.accounts.get('b').avatar.slots.body,'mongle-apron-starter');
  const reloaded=new WorldClient({fetcher:transport.fetcher,storage:storage(),tabStorage:tab});
  assert.equal(await reloaded.restore(),true);assert.equal(reloaded.snapshot.accountId,'b');
});

test('logging out one tab leaves a different tab account usable',async()=>{
  const transport=sharedCookieTransport(),cache=storage(),tabA=storage(),tabB=storage();
  const a=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabA}),b=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabB});
  await a.signIn('a');await b.signIn('b');await a.logout();
  await b.equip({body:'mongle-apron-starter',neck:''});
  assert.equal(a.snapshot,null);assert.equal(a.accessToken,null);assert.equal(b.snapshot.accountId,'b');
  assert.equal(transport.accounts.get('a').avatar.slots.body,'');
  const reloadedA=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabA}),reloadedB=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabB});
  assert.equal(await reloadedA.restore(),false);assert.equal(await reloadedB.restore(),true);assert.equal(reloadedB.snapshot.accountId,'b');
});

test('a late old logout must not clear a newly signed-in account token',async()=>{
  const transport=sharedCookieTransport();let release;
  const client=new WorldClient({fetcher:transport.fetcher,storage:storage()});await client.signIn('a');
  transport.delayNextLogout(new Promise(resolve=>{release=resolve;}));
  const stale=client.logout();const rejection=assert.rejects(stale,{code:'STALE_RESPONSE'});
  await client.signIn('b');release();await rejection;
  await client.equip({body:'mongle-apron-starter',neck:''});
  assert.equal(client.snapshot.accountId,'b');
  assert.equal(transport.calls.at(-1).hasBearer,true);
  assert.equal(transport.accounts.get('a').avatar.slots.body,'');
});

test('default browser fetch keeps its Window receiver',async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=function(){assert.equal(this,globalThis);return Promise.resolve(response(snapshot('a')));};
    const client=new WorldClient({storage:storage(),tabStorage:storage()});
    await client.refresh();assert.equal(client.snapshot.accountId,'a');
  }finally{globalThis.fetch=original;}
});

test('tab identifiers survive reload without placing credentials in either storage',async()=>{
  const transport=sharedCookieTransport(),cache=storage(),tabA=storage(),tabB=storage();
  const a=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabA}),b=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabB});
  await a.signIn('a');await b.signIn('b');assert.notEqual(a.tabId,b.tabId);
  const restoredA=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabA}),restoredB=new WorldClient({fetcher:transport.fetcher,storage:cache,tabStorage:tabB});
  assert.equal(restoredA.tabId,a.tabId);assert.equal(restoredB.tabId,b.tabId);
  await Promise.all([restoredA.restore(),restoredB.restore()]);
  assert.equal(restoredA.snapshot.accountId,'a');assert.equal(restoredB.snapshot.accountId,'b');
  for(const value of [...cache.data.values(),...tabA.data.values(),...tabB.data.values()])assert.ok(!value.includes('synthetic-'));
});

test('real browser tabs retain separate accounts across reload and logout',{skip:!process.env.SYNK_WORLD_QA_URL,timeout:180000},async t=>{
  const {createRequire}=await import('node:module'),{default:path}=await import('node:path'),{homedir}=await import('node:os');
  const require=createRequire(import.meta.url);let playwright;
  try{playwright=require('playwright');}catch{playwright=require(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
  const base=process.env.SYNK_WORLD_QA_URL,errors=[],requests=[];
  const browserServer=await playwright.chromium.launchServer({channel:'msedge',headless:true,timeout:45000});
  t.signal.addEventListener('abort',()=>browserServer.process()?.kill('SIGKILL'),{once:true});
  let browser;
  let step='launch';
  async function bounded(name,work,timeout=30000){
    step=name;let timer;
    try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`Browser account test timed out at: ${name}`)),timeout);})]);}
    finally{clearTimeout(timer);}
  }
  const ready=page=>page.waitForFunction(()=>window.__synkWorld?.client.status==='ready',null,{timeout:30000,polling:100});
  try{
    browser=await bounded('connect browser',()=>playwright.chromium.connect(browserServer.wsEndpoint(),{timeout:30000}));
    const context=await bounded('create context',()=>browser.newContext({viewport:{width:390,height:844}}));
    context.setDefaultTimeout(30000);context.setDefaultNavigationTimeout(45000);
    const [a,b]=await bounded('create tabs',()=>Promise.all([context.newPage(),context.newPage()]));
    for(const [index,page]of [a,b].entries()){
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.url().includes('/api/world/'))requests.push({tab:index,route:new URL(response.url()).pathname,status:response.status()});});
    }
    await bounded('initial navigation',()=>Promise.all([a.goto(base+'/mobile.html',{waitUntil:'domcontentloaded'}),b.goto(base+'/mobile.html',{waitUntil:'domcontentloaded'})]),47000);
    await bounded('client initialization',()=>Promise.all([a,b].map(page=>page.waitForFunction(()=>window.__synkWorld,null,{timeout:30000,polling:100}))));
    await bounded('sign in A',()=>a.evaluate(()=>window.__synkWorld.client.signIn('player-a')),45000);
    await bounded('sign in B',()=>b.evaluate(()=>window.__synkWorld.client.signIn('player-b')),45000);
    const beforeA=await a.evaluate(()=>({account:window.__synkWorld.client.snapshot.accountId,tab:window.__synkWorld.client.tabId}));
    const beforeB=await b.evaluate(()=>({account:window.__synkWorld.client.snapshot.accountId,tab:window.__synkWorld.client.tabId}));
    assert.notEqual(beforeA.account,beforeB.account);assert.notEqual(beforeA.tab,beforeB.tab);
    const cookies=await context.cookies();
    for(const tab of [beforeA.tab,beforeB.tab])assert.ok(cookies.some(cookie=>cookie.name===`synk_world_rehearsal_${tab}`&&cookie.httpOnly&&cookie.sameSite==='Strict'));
    await bounded('reload both accounts',()=>Promise.all([a.reload({waitUntil:'domcontentloaded'}),b.reload({waitUntil:'domcontentloaded'})]),47000);
    await bounded('restore both accounts',()=>Promise.all([ready(a),ready(b)]));
    assert.equal(await a.evaluate(()=>window.__synkWorld.client.snapshot.accountId),beforeA.account);
    assert.equal(await b.evaluate(()=>window.__synkWorld.client.snapshot.accountId),beforeB.account);
    await bounded('logout A',()=>a.evaluate(()=>window.__synkWorld.client.logout()),45000);
    await bounded('reload after logout',()=>Promise.all([a.reload({waitUntil:'domcontentloaded'}),b.reload({waitUntil:'domcontentloaded'})]),47000);
    await bounded('restore B while A stays signed out',()=>Promise.all([ready(b),a.waitForFunction(()=>window.__synkWorld?.client.status==='welcome',null,{timeout:30000,polling:100})]));
    assert.equal(await a.evaluate(()=>window.__synkWorld.client.snapshot),null);
    assert.equal(await b.evaluate(()=>window.__synkWorld.client.snapshot.accountId),beforeB.account);
    for(const page of [a,b])assert.equal(await page.evaluate(()=>Object.entries({...localStorage,...sessionStorage}).some(([key,value])=>/accessToken|refreshToken|Bearer|access_token/.test(key+value))),false);
    assert.deepEqual(errors,[]);
    // One owned browser shutdown below closes the context too. Closing it twice
    // can obscure the useful phase when renderer teardown itself stalls.
  }catch(error){throw new Error(`${error.message}\nLast step: ${step}\nAPI status trace: ${JSON.stringify(requests)}\nBrowser errors: ${JSON.stringify(errors)}`,{cause:error});}
  finally{
    // The owned BrowserServer exposes only this test's process. If graceful
    // shutdown stalls, terminate that process without touching other Edge tabs.
    try{await bounded('close browser',()=>browserServer.close(),10000);}
    catch{t.diagnostic('Owned Edge shutdown exceeded 10 seconds; terminated only this test browser process.');browserServer.process()?.kill('SIGKILL');}
  }
});
