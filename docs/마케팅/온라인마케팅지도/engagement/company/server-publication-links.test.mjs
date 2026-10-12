import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {createStudioService} from './studio-service.mjs';

const NOW='2026-10-11T12:00:00.000Z';
const failed={status:'error',reason:'http-404',detail:'합성 응답: HTTP 404 접속 오류',httpStatus:404};
const reachable={status:'reachable',reason:'http-response',detail:'합성 응답: HTTP 200. 실제 자료 열람은 별도 확인합니다.',httpStatus:200};
async function fixture(t,{schedule=false}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-links-http-'));let app,base,at=Date.parse(NOW),calls=0,probe=async()=>failed;
  async function start(){app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,publicationLinkSchedule:schedule,clock:()=>new Date(at).toISOString(),publicationLinkProbe:async(...args)=>{calls++;return probe(...args);}});const address=await app.start();base=`http://127.0.0.1:${address.port}`;}
  await start();await app.waitForIdle();
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-links-http-'));await rm(directory,{recursive:true,force:true});});
  const users=Object.fromEntries(['owner','other','viewer'].map(name=>[name,app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member',teamId:name==='other'?'b':'a'})]));
  const sessions=Object.fromEntries(Object.entries(users).map(([name,user])=>[name,app.store.mint('session',user.id,{csrfToken:'link-test'},20)]));
  async function request(path,input,user='owner',extra={}){
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'link-test'}),...extra},...(input===undefined?{}:{body:JSON.stringify(input)})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  const studio=createStudioService({store:app.store,clock:()=>new Date(at).toISOString()});
  const production=studio.saveProduction(users.owner,{title:'합성 링크 확인',stage:'ready'}).production;
  const media={id:randomUUID(),productionId:production.id,diskName:randomUUID()+'.mp4',mimeType:'video/mp4',fileName:'video.mp4',byteSize:128,createdAt:NOW,createdById:users.owner.id};
  const version=studio.addMedia(users.owner,production.id,media,'합성 영상').production.versions.at(-1);
  function pack(extra={}){const row={id:randomUUID(),productionId:production.id,versionId:version.id,createdById:users.owner.id,createdAt:new Date(at).toISOString(),title:'합성 링크 확인',body:'합성 원고',channels:['youtube-shorts'],source:{...media,sha256:'0'.repeat(64)},outputs:[],checks:[{label:'자료 링크',status:'pass',detail:'주소 형식'}],state:'prepared',published:false,link:'https://example.test/material',...extra};app.store.put('studioPublicationPackages',row.id,row);return row;}
  const initial=pack();app.store.put('channels','youtube',{id:'youtube',platform:'youtube',displayName:'합성 채널',ownerIds:[users.owner.id],teamId:'a',active:true});
  return {users,sessions,request,pack,initial,production,version,get app(){return app;},calls:()=>calls,setProbe(value){probe=value;},advance(ms){at+=ms;},async restart(){await app.stop();await start();await app.waitForIdle();}};
}
const linkPath=(id,kind='package')=>'/api/publication-links/'+kind+'/'+id;
const reviewPath=id=>'/api/publication-packages/'+id+'/review';
async function items(f,user){const res=await f.request('/api/publication-workflow',undefined,user);assert.equal(res.status,200);return res.data.items;}

test('HTTP link inspection reads without network and permits only authenticated empty-body source checks',async t=>{
  const f=await fixture(t),path=linkPath(f.initial.id),before=await f.request(path);assert.equal(before.status,200);assert.equal(before.data.check.status,'unchecked');assert.match(before.headers.get('cache-control'),/no-store/);assert.equal(f.calls(),0);
  assert.ok([401,403].includes((await f.request(path,{},null)).status));assert.equal((await f.request(path,{},'owner',{'X-CSRF-Token':'wrong'})).status,403);
  for(const body of [{url:'http://127.0.0.1'},[],true])assert.equal((await f.request(path,body)).status,400);
  for(const user of ['other','viewer'])assert.ok([403,404].includes((await f.request(path,{},user)).status));assert.equal(f.calls(),0);
  const checked=await f.request(path,{});assert.equal(checked.status,200);assert.equal(checked.data.check.status,'error');assert.equal(checked.data.check.httpStatus,404);assert.equal(checked.data.check.revision,1);
  await f.request(path,{});assert.equal(f.calls(),1,'repeated clicks honor cooldown');
});

test('a package link error replaces review work, survives restart, and recovery never confirms human review',async t=>{
  const f=await fixture(t),id=f.initial.id;assert.equal((await items(f))[0].kind,'publication_review');
  await f.request(linkPath(id),{});let work=await items(f);assert.equal(work.length,1);assert.equal(work[0].kind,'publication_link');assert.equal(work[0].packageId,id);assert.match(work[0].href,/publicationAction=link&packageId=/);
  let review=(await f.request(reviewPath(id))).data.review;assert.equal(review.summary.status,'needs-work');assert.equal(review.manual.find(row=>row.id==='link').status,'pending');
  await f.restart();assert.equal((await f.request(linkPath(id))).data.check.revision,1);assert.equal((await items(f))[0].kind,'publication_link');assert.equal(f.calls(),1);
  f.advance(61000);f.setProbe(async()=>reachable);await f.request(linkPath(id),{});work=await items(f);assert.equal(work.length,1);assert.equal(work[0].kind,'publication_review');
  review=(await f.request(reviewPath(id))).data.review;assert.equal(review.summary.status,'pending');assert.equal(review.manual.find(row=>row.id==='link').status,'pending');assert.equal(review.automatic.find(row=>row.id==='resource-link-response').status,'pass');assert.equal(f.app.store.all('publicationPackageReviews').length,0);assert.equal(f.app.store.all('publicationLinkChecks')[0].history.length,2);
});

test('published links remain actionable separately from measurement and follow the current channel owner',async t=>{
  const f=await fixture(t),registered=await f.request('/api/post-performance',{channelId:'youtube',url:'https://www.youtube.com/shorts/abcdefghijk',publishedAt:NOW,title:'합성 게시',publicationPackageId:f.initial.id,publicationFormat:'youtube-shorts'});assert.equal(registered.status,201);const entry=registered.data.entry;
  await f.request(linkPath(entry.id,'post'),{});let work=await items(f);assert.equal(work.length,1);assert.equal(work[0].entryId,entry.id);assert.match(work[0].href,/publicationAction=link&entryId=/);
  f.advance(24*3600000);work=await items(f);assert.ok(work.some(row=>row.kind==='publication_link'));assert.ok(work.some(row=>row.kind==='publication_performance'));
  const channel=f.app.store.get('channels','youtube');f.app.store.put('channels','youtube',{...channel,ownerIds:[f.users.other.id],teamId:'b'});assert.ok(!(await items(f)).some(row=>row.entryId===entry.id));assert.ok((await items(f,'other')).some(row=>row.entryId===entry.id&&row.kind==='publication_link'));
  f.setProbe(async()=>({status:'manual-required',reason:'http-403',detail:'합성 차단 응답: 직접 확인 필요',httpStatus:403}));assert.equal((await f.request(linkPath(entry.id,'post'),{},'other')).status,200);assert.ok(!(await items(f,'other')).some(row=>row.kind==='publication_link'));
});

test('late HTTP result cannot save after session revocation or a source URL replacement',async t=>{
  const f=await fixture(t),path=linkPath(f.initial.id);let finish,started;
  let entered=new Promise(resolve=>{started=resolve;});f.setProbe(()=>new Promise(resolve=>{finish=resolve;started();}));
  let request=f.request(path,{});await entered;f.app.store.revokeUser(f.users.owner.id);finish(failed);assert.equal((await request).status,401);assert.equal(f.app.store.all('publicationLinkChecks').length,0);
  f.sessions.owner=f.app.store.mint('session',f.users.owner.id,{csrfToken:'link-test'},20);entered=new Promise(resolve=>{started=resolve;});request=f.request(path,{});await entered;
  f.app.store.put('studioPublicationPackages',f.initial.id,{...f.initial,link:'https://example.test/changed'});finish(failed);assert.equal((await request).status,409);assert.equal(f.app.store.all('publicationLinkChecks').length,0);assert.equal((await f.request(path)).data.check.status,'unchecked');
});

test('newest package links retire older errors and an already published resource still gets an error task',async t=>{
  const f=await fixture(t);await f.request(linkPath(f.initial.id),{});f.advance(1000);const next=f.pack({link:''});let work=await items(f);assert.ok(!work.some(row=>row.packageId===f.initial.id));assert.equal(work[0].packageId,next.id);
  f.advance(1000);const latest=f.pack();await f.request(linkPath(latest.id),{});await f.request('/api/post-performance',{channelId:'youtube',url:'https://www.youtube.com/shorts/abcdefghijk',publishedAt:NOW,title:'합성 게시',publicationPackageId:latest.id,publicationFormat:'youtube-shorts'});
  work=await items(f);assert.equal(work.length,1);assert.equal(work[0].packageId,latest.id);assert.equal(work[0].kind,'publication_link');assert.equal(f.app.store.all('messengerTasks').length,0);
});

test('local schedule checks newly registered links then waits six hours before checking them again',async t=>{
  const f=await fixture(t,{schedule:true});const response=await f.request('/api/post-performance',{channelId:'youtube',url:'https://www.youtube.com/shorts/abcdefghijk',publishedAt:NOW,title:'합성 게시'});assert.equal(response.status,201);await f.app.waitForIdle();assert.equal(f.calls(),2);assert.equal((await f.request(linkPath(response.data.entry.id,'post'))).data.check.status,'error');
  await f.app.scanPublicationLinks();assert.equal(f.calls(),2);f.advance(6*3600000);await f.app.scanPublicationLinks();assert.equal(f.calls(),4);await f.restart();assert.equal(f.calls(),4);
});
