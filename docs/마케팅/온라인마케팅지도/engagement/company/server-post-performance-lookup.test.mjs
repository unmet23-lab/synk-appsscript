import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const NOW='2026-10-18T12:00:00.000Z',PUBLISHED='2026-10-18T07:13:00.000Z';
const CHANNEL='UCabcdefghijklmnopqrstuv',VIDEO='abcDEF12345';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-performance-lookup-http-'));
  let calls=0;
  let respond=async url=>Response.json({items:[{id:url.searchParams.get('id'),snippet:{channelId:CHANNEL,publishedAt:PUBLISHED,title:'합성 영상'},contentDetails:{duration:'PT40S'}}]});
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>NOW,
    postPerformanceFetch:async input=>{calls++;const url=new URL(input);assert.equal(url.origin,'https://www.googleapis.com');return respond(url);},
    collector:async()=>{throw Error('Live collection is forbidden in lookup tests');},
  });
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-performance-lookup-http-'));await rm(directory,{recursive:true,force:true});});
  const users=Object.fromEntries(['owner','other','viewer'].map(name=>[name,app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member',teamId:name==='other'?'b':'a'})]));
  const sessions=Object.fromEntries(Object.entries(users).map(([name,user])=>[name,app.store.mint('session',user.id,{csrfToken:'lookup-fixture'},30)]));
  const channel={id:'youtube',platform:'youtube',externalId:CHANNEL,displayName:'합성 채널',ownerIds:[users.owner.id],teamId:'a',active:true};
  app.store.put('channels',channel.id,channel);app.store.setSecret('channel:'+channel.id,{apiKey:'synthetic-lookup-key'});
  const lookup=(postUrl='https://www.youtube.com/shorts/'+VIDEO,channelId=channel.id)=>'/api/post-performance/lookup?'+new URLSearchParams({channelId,url:postUrl});
  async function request(path,input,user='owner'){
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'lookup-fixture'})},...(input===undefined?{}:{body:JSON.stringify(input)})});
    return {status:response.status,headers:response.headers,data:await response.json()};
  }
  return {app,users,sessions,channel,lookup,request,calls:()=>calls,setResponse:value=>{respond=value;}};
}

test('lookup requires a live writer and gives 403 for viewer, foreign, missing and inactive channels before external access',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request(f.lookup(),undefined,null)).status,401);
  for(const user of ['viewer','other'])assert.equal((await f.request(f.lookup(),undefined,user)).status,403);
  assert.equal((await f.request(f.lookup(undefined,'missing'))).status,403);
  f.app.store.put('channels',f.channel.id,{...f.channel,active:false});
  assert.equal((await f.request(f.lookup())).status,403);
  assert.equal(f.calls(),0);
});

test('lookup validates URL and query shape without network and returns the display contract without writes',async t=>{
  const f=await fixture(t);
  for(const url of ['http://127.0.0.1/private','https://www.youtube.com/@somebody','https://youtube.com.evil.test/shorts/'+VIDEO])assert.equal((await f.request(f.lookup(url))).status,400);
  for(const path of ['/api/post-performance/lookup','/api/post-performance/lookup?channelId=youtube',f.lookup()+'&channelId=youtube',f.lookup()+'&extra=1'])assert.equal((await f.request(path)).status,400);
  assert.equal(f.calls(),0);
  const result=await f.request(f.lookup());assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);
  assert.equal(result.data.platform,'youtube');assert.equal(result.data.externalId,VIDEO);assert.equal(result.data.url,'https://www.youtube.com/watch?v='+VIDEO);
  assert.equal(result.data.publishedAt,PUBLISHED);assert.equal(result.data.title,'합성 영상');assert.equal(result.data.ownerMatch,true);assert.equal(result.data.suggestedFormat,'youtube-shorts');assert.equal(result.data.existingEntryId,null);
  assert.equal(result.data.checkpoints['24'].dueAt,'2026-10-19T07:13:00.000Z');assert.equal(result.data.checkpoints['24'].closesAt,'2026-10-19T13:13:00.000Z');assert.equal(result.data.checkpoints['24'].missed,false);
  assert.equal(result.data.checkpoints['72'].dueAt,'2026-10-21T07:13:00.000Z');assert.equal(f.app.store.all('postPerformanceEntries').length,0);
  assert.equal((await f.request('/api/publication-workspace')).data.performance.lookupAvailable,true);
});

test('registration verifies again, uses the platform time, stores external format and remains idempotent',async t=>{
  const f=await fixture(t),input={channelId:'youtube',url:'https://youtu.be/'+VIDEO,publishedAt:'2026-10-18T08:00:00.000Z',publicationFormat:'youtube-shorts',ownerMatch:true};
  await f.request(f.lookup());assert.equal(f.calls(),1);
  const created=await f.request('/api/post-performance',input);assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(f.calls(),2);
  assert.equal(created.data.publishedAtAdjusted,true);assert.equal(created.data.entry.publishedAt,PUBLISHED);assert.equal(created.data.entry.origin,'external');assert.equal(created.data.entry.publicationFormat,'youtube-shorts');assert.equal(created.data.entry.publicationPackageId,null);
  const again=await f.request('/api/post-performance',input);assert.equal(again.status,200);assert.equal(again.data.entry.id,created.data.entry.id);assert.equal(f.app.store.all('postPerformanceEntries').length,1);
  assert.equal((await f.request(f.lookup())).data.existingEntryId,created.data.entry.id);
});

test('verified registration fills omitted publication time and never trusts client ownerMatch after a lookup',async t=>{
  const f=await fixture(t),input={channelId:'youtube',url:'https://youtu.be/'+VIDEO,publicationFormat:'youtube-shorts'};
  assert.equal((await f.request(f.lookup())).data.ownerMatch,true);
  f.setResponse(async url=>Response.json({items:[{id:url.searchParams.get('id'),snippet:{channelId:'UCforeignxxxxxxxxxxxxxxx',publishedAt:PUBLISHED,title:'다른 계정'},contentDetails:{duration:'PT40S'}}]}));
  const foreign=await f.request(f.lookup());assert.equal(foreign.status,200);assert.equal(foreign.data.ownerMatch,false);assert.ok(foreign.data.reason);
  const rejected=await f.request('/api/post-performance',{...input,ownerMatch:true,publishedAt:PUBLISHED});assert.ok(rejected.status>=400);assert.equal(f.app.store.all('postPerformanceEntries').length,0);
  f.setResponse(async url=>Response.json({items:[{id:url.searchParams.get('id'),snippet:{channelId:CHANNEL,publishedAt:PUBLISHED,title:'합성 영상'},contentDetails:{duration:'PT40S'}}]}));
  const accepted=await f.request('/api/post-performance',input);assert.equal(accepted.status,201,JSON.stringify(accepted.data));assert.equal(accepted.data.entry.publishedAt,PUBLISHED);
});

test('unconnected YouTube cannot bypass verification, while manual platforms retain manual registration',async t=>{
  const f=await fixture(t);f.app.store.setSecret('channel:youtube',{});
  const unknown=await f.request(f.lookup());assert.equal(unknown.status,200);assert.equal(unknown.data.ownerMatch,null);assert.equal(unknown.data.publishedAt,null);assert.ok(unknown.data.reason);
  assert.ok((await f.request('/api/post-performance',{channelId:'youtube',url:'https://youtu.be/'+VIDEO,publishedAt:PUBLISHED,ownerMatch:true})).status>=400);assert.equal(f.calls(),0);
  const channel={id:'threads',platform:'threads',handle:'synthetic',ownerIds:[f.users.owner.id],active:true};f.app.store.put('channels',channel.id,channel);
  const input={channelId:'threads',url:'https://www.threads.com/@synthetic/post/ABC_123',publishedAt:PUBLISHED};
  const lookup=await f.request(f.lookup(input.url,'threads'));assert.equal(lookup.status,200);assert.equal(lookup.data.ownerMatch,null);assert.ok(lookup.data.reason);
  assert.equal((await f.request('/api/post-performance',input)).status,201);assert.equal(f.calls(),0);
});

for(const operation of ['lookup','register']){
  test(`${operation} rejects an in-flight result after session revocation`,async t=>{
    const f=await fixture(t);let begin,release;const started=new Promise(resolve=>begin=resolve),gate=new Promise(resolve=>release=resolve);
    f.setResponse(async url=>{begin();await gate;return Response.json({items:[{id:url.searchParams.get('id'),snippet:{channelId:CHANNEL,publishedAt:PUBLISHED,title:'합성'},contentDetails:{duration:'PT40S'}}]});});
    const pending=operation==='lookup'?f.request(f.lookup()):f.request('/api/post-performance',{channelId:'youtube',url:'https://youtu.be/'+VIDEO,publishedAt:PUBLISHED});
    try{await started;f.app.store.revokeUser(f.users.owner.id);}finally{release();}
    assert.equal((await pending).status,401);assert.equal(f.app.store.all('postPerformanceEntries').length,0);
  });
}

test('registration rejects changed channel ownership while the platform request is pending',async t=>{
  const f=await fixture(t);let begin,release;const started=new Promise(resolve=>begin=resolve),gate=new Promise(resolve=>release=resolve);
  f.setResponse(async url=>{begin();await gate;return Response.json({items:[{id:url.searchParams.get('id'),snippet:{channelId:CHANNEL,publishedAt:PUBLISHED,title:'합성'},contentDetails:{duration:'PT40S'}}]});});
  const pending=f.request('/api/post-performance',{channelId:'youtube',url:'https://youtu.be/'+VIDEO,publishedAt:PUBLISHED});
  try{await started;f.app.store.put('channels',f.channel.id,{...f.channel,ownerIds:[f.users.other.id],teamId:'b'});}finally{release();}
  assert.equal((await pending).status,403);assert.equal(f.app.store.all('postPerformanceEntries').length,0);
});
