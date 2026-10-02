import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const at='2026-10-02T01:00:00.000Z',id='7522423151142551568',url=`https://ads.tiktok.com/business/creativecenter/topads/${id}/pc/en?countryCode=US&period=30`;
const adResponse=()=>new Response('<script id="__NEXT_DATA__">'+JSON.stringify({props:{pageProps:{data:{baseDetail:{id,adTitle:'공개 광고',countryCode:['KR'],like:20,comment:0,share:2,ctr:.08,cost:1}}}}})+'</script>',{headers:{'Content-Type':'text/html'}});
const fb={source:'facebook',kind:'reel',title:'실제 사례',sourceUrl:'https://www.facebook.com/reel/1234567890/',region:'KR'};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function fixture(t,fetchImpl=async()=>adResponse()){
  const directory=await mkdtemp(join(tmpdir(),'synk-api-creative-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>at,creativeResearchFetch:fetchImpl}),address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-api-creative-'));await rm(directory,{recursive:true,force:true});});
  app.store.put('teams','a',{id:'a',name:'a',active:true});
  const admin=app.store.createUser({name:'Admin',email:'admin@example.test',role:'admin'}),owner=app.store.createUser({name:'Owner',email:'owner@example.test',role:'member',teamId:'a'}),other=app.store.createUser({name:'Other',email:'other@example.test',role:'member'}),viewer=app.store.createUser({name:'Viewer',email:'viewer@example.test',role:'viewer',teamId:'a'}),sessions=new Map([admin,owner,other,viewer].map(user=>[user.id,app.store.mint('session',user.id,{csrfToken:'creative-csrf'},10)]));
  async function call(path,input,user=owner,headers={}){const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions.get(user.id)}:{}),...(input===undefined?{}:{'Content-Type':'application/json',Origin:app.origin,'X-CSRF-Token':'creative-csrf'}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json()};}
  return {app,admin,owner,other,viewer,call};
}

test('creative APIs authenticate, isolate private data and enforce CSRF Origin and viewer permissions',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/creative-research',undefined,null)).status,401);assert.equal((await f.call('/api/creative-research',fb,f.owner,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await f.call('/api/creative-research',fb,f.owner,{Origin:'https://evil.example'})).status,403);assert.equal((await f.call('/api/creative-research',fb,f.viewer)).status,403);
  const saved=await f.call('/api/creative-research',fb);assert.equal(saved.status,201);assert.equal(saved.data.entry.visibility,'private');const mine=await f.call('/api/creative-research');assert.equal(mine.data.sources.length,4);assert.equal(mine.data.entries.length,1);assert.equal(mine.data.canCreate,true);assert.equal((await f.call('/api/creative-research',undefined,f.other)).data.entries.length,0);assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{hook:'other'},f.other)).status,404);
  assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{visibility:'company'})).status,400);assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{visibility:'company',shareConfirmed:true})).status,200);assert.equal((await f.call('/api/creative-research',undefined,f.viewer)).data.entries[0].canEdit,false);
});

test('official Top Ads import endpoint preserves metric semantics and supports archive history and restore',async t=>{
  const f=await fixture(t),saved=await f.call('/api/creative-research/import-top-ad',{url});assert.equal(saved.status,201);assert.equal(saved.data.entry.ctrTopPercent,8);assert.equal(saved.data.entry.metrics.views,null);assert.equal(saved.data.entry.metrics.comments,0);assert.equal(saved.data.entry.provenance,'official-page');assert.equal(saved.data.entry.filterRegion,'US');assert.deepEqual(saved.data.entry.actualRegions,['KR']);const entryId=saved.data.entry.id;
  assert.equal((await f.call('/api/creative-research/'+entryId+'/archive',{})).status,200);assert.equal((await f.call('/api/creative-research')).data.entries.length,0);assert.equal((await f.call('/api/creative-research?includeArchived=1')).data.entries[0].archived,true);assert.equal((await f.call('/api/creative-research?includeArchived=1',undefined,f.other)).data.entries.length,0);assert.equal((await f.call('/api/creative-research?includeArchived=bad')).status,400);assert.equal((await f.call('/api/creative-research/'+entryId,{archived:false})).status,200);assert.equal((await f.call('/api/creative-research')).data.entries.length,1);assert.equal((await f.call('/api/creative-research/import-top-ad',{url:url.replace('US','CN')})).data.existing,true);
});

test('revoked sessions cannot persist an in-flight imported record even when account remains active',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,async()=>{entered.resolve();await release.promise;return adResponse();}),pending=f.call('/api/creative-research/import-top-ad',{url});await entered.promise;f.app.store.revokeUser(f.owner.id);release.resolve();const result=await pending;assert.equal(result.status,401);assert.equal(f.app.store.all('creativeResearchEntries').length,0);assert.equal(f.app.store.all('audit').filter(row=>row.action==='creative-research-imported').length,0);
});

test('current channel permissions are reapplied to reads after ownership or archive changes',async t=>{
  const f=await fixture(t),channel={id:'youtube-context',platform:'youtube',displayName:'관찰 계정',canonicalUrl:'https://www.youtube.com/@example',ownerIds:[f.owner.id],teamId:'a',active:true};f.app.store.put('channels',channel.id,channel);const saved=await f.call('/api/creative-research',{source:'youtube-trends',kind:'top-search',title:'시청자 검색',sourceUrl:'https://studio.youtube.com/channel/UCabcdefghijklmnopqrstuv/analytics/tab-trends/period-default',channelId:channel.id,periodDays:28,interest:'high'});assert.equal(saved.status,201);assert.equal(saved.data.entry.channelName,'관찰 계정');assert.equal((await f.call('/api/creative-research')).data.channels[0].canEdit,true);f.app.store.put('channels',channel.id,{...channel,active:false});assert.equal((await f.call('/api/creative-research')).data.entries.length,0);assert.equal((await f.call('/api/creative-research/'+saved.data.entry.id,{hook:'이전 접근'})).status,404);
});

test('app shutdown waits for import settlement before closing database or writing audits',async t=>{
  const entered=gate(),release=gate(),f=await fixture(t,async()=>{entered.resolve();await release.promise;return adResponse();}),pending=f.call('/api/creative-research/import-top-ad',{url});await entered.promise;let stopped=false;const stop=f.app.stop().then(()=>stopped=true);await Promise.resolve();assert.equal(stopped,false);release.resolve();assert.equal((await pending).status,503);await stop;assert.equal(stopped,true);
});
