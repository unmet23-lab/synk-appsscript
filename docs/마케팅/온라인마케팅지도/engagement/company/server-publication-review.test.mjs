import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createCompanyApp} from './server.mjs';

const run=promisify(execFile),NOW='2026-10-11T12:00:00.000Z';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-publication-review-http-'));let app,base,calls=0;
  const deny=async()=>{calls++;throw Error('No external calls in publication review tests.');};
  async function start(){app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,clock:()=>NOW,collector:deny,contentFetch:deny});const address=await app.start();base=`http://127.0.0.1:${address.port}`;}
  await start();
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-publication-review-http-'));await rm(directory,{recursive:true,force:true});});
  const users=Object.fromEntries(['owner','other','viewer'].map(name=>[name,app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member'})]));
  const sessions=Object.fromEntries(Object.entries(users).map(([name,user])=>[name,app.store.mint('session',user.id,{csrfToken:'review-test'},20)]));
  async function request(path,input,user='owner',extra={}){
    const response=await fetch(base+path,{method:input===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(input===undefined?{}:{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'review-test'}),...extra},...(input===undefined?{}:{body:JSON.stringify(input)})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  const video=join(directory,'source.mp4');
  await run(process.env.SYNK_FFMPEG_EXE||'ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=1080x1920:r=5','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.6','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-movflags','+faststart','-y',video],{windowsHide:true,timeout:30000});
  const bytes=await readFile(video),production=(await request('/api/studio-productions',{title:'게시 전 점검 합성 자료',stage:'ready'})).data.production;
  async function upload(label='검토할 최종본'){
    const response=await fetch(base+'/api/studio-productions/'+production.id+'/media',{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'X-CSRF-Token':'review-test','Content-Type':'video/mp4','X-File-Name':'source.mp4','X-Version-Label':encodeURIComponent(label)},body:bytes});
    assert.equal(response.status,201);return (await response.json()).production.versions.at(-1);
  }
  const version=await upload(),input={productionId:production.id,versionId:version.id,title:'정확한 묶음 점검',body:'합성 게시 원고입니다.',link:'https://example.test/material',language:'ko',channels:['youtube-shorts'],mode:'original',subtitleFileName:'ko.srt',subtitleText:'1\n00:00:00,000 --> 00:00:00,400\n안녕하세요.\n'};
  async function makePackage(extra={}){const response=await request('/api/publication-packages',{...input,...extra});assert.ok([200,201].includes(response.status),JSON.stringify(response.data));return response.data.package;}
  const pack=await makePackage();
  return {directory,users,sessions,request,production,version,input,pack,upload,makePackage,bytes,get app(){return app;},calls:()=>calls,async restart(){await app.stop();await start();}};
}
const reviewPath=id=>'/api/publication-packages/'+id+'/review';
async function review(f,id=f.pack.id){const result=await f.request(reviewPath(id));assert.equal(result.status,200,JSON.stringify(result.data));return result.data.review;}
async function complete(f,id=f.pack.id){
  let result=await review(f,id);
  for(const check of result.manual){
    if(check.locked||check.status==='not-applicable')continue;
    const saved=await f.request(reviewPath(id),{revision:result.revision,checkId:check.id,status:'confirmed',note:'합성 시험: 해당 묶음의 영상·소리·원고·권리·자막·링크를 직접 확인한 기록'});
    assert.equal(saved.status,200,JSON.stringify(saved.data));result=saved.data.review;
  }
  return result;
}

test('exact publication package keeps automatic results distinct from explicit human checks and saves no review on read',async t=>{
  const f=await fixture(t),path=reviewPath(f.pack.id),before=f.app.store.all('publicationPackageReviews').length;
  const first=await f.request(path);assert.equal(first.status,200,JSON.stringify(first.data));assert.match(first.headers.get('cache-control'),/no-store/);
  const initial=first.data.review;assert.equal(initial.revision,0);assert.equal(initial.summary.status,'pending');assert.ok(initial.manual.some(row=>row.id==='video'&&row.status==='pending'));assert.ok(initial.manual.some(row=>row.id==='audio'&&row.status==='pending'));assert.ok(initial.automatic.length>0);
  assert.equal(f.app.store.all('publicationPackageReviews').length,before,'reading an automatically assembled report must not create a manual confirmation');
  const automatic=JSON.stringify(initial.automatic),saved=await f.request(path,{revision:0,checkId:'video',status:'confirmed',note:'합성 시험: 전체 영상 재생 확인'});
  assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.review.revision,1);assert.equal(saved.data.review.manual.find(row=>row.id==='video').status,'confirmed');assert.equal(saved.data.review.manual.find(row=>row.id==='audio').status,'pending');assert.equal(JSON.stringify(saved.data.review.automatic),automatic);
  assert.ok(JSON.stringify(saved.data.review.manual.find(row=>row.id==='video')).includes('합성 시험: 전체 영상 재생 확인'));
  assert.ok(!JSON.stringify(saved.data.review).includes(f.directory),'private storage paths must not enter the response');
  assert.equal((await f.request(path,{revision:1,checkId:'source-integrity',status:'confirmed',note:'cannot forge automatic checks'})).status,400);
  assert.equal((await f.request(path,{revision:1,checkId:'rights',status:'not-applicable',note:'rights cannot be skipped'})).status,400);
  assert.equal((await f.request(path,{revision:1,checkId:'audio',status:'not-applicable',note:''})).status,400);
  assert.equal((await f.request(path,{revision:1,checkId:'copy',status:'needs-work',note:''})).status,400);
  const issue=await f.request(path,{revision:1,checkId:'copy',status:'needs-work',note:'합성 시험: 원고의 날짜 확인 필요'});assert.equal(issue.status,200);assert.equal(issue.data.review.summary.status,'needs-work');
  const withoutLink=await f.makePackage({link:''}),link=(await review(f,withoutLink.id)).manual.find(row=>row.id==='link');assert.equal(link.status,'not-applicable');assert.equal(link.locked,true);assert.equal(link.reviewerId,null);assert.equal(link.reviewedAt,null);
  assert.equal((await f.request(reviewPath(withoutLink.id),{revision:0,checkId:'link',status:'confirmed',note:'no link to confirm'})).status,400);
  assert.equal(f.app.store.get('studioPublicationPackages',f.pack.id).published,false);assert.equal(f.calls(),0);
});

test('publication review HTTP routes enforce authentication, Origin, CSRF and current production access',async t=>{
  const f=await fixture(t),path=reviewPath(f.pack.id),input={revision:0,checkId:'video',status:'confirmed',note:'synthetic confirmation'};
  assert.equal((await f.request(path,undefined,null)).status,401);
  assert.equal((await f.request(path,undefined,'other')).status,404);
  assert.equal((await f.request(path,input,'other')).status,404);
  assert.equal((await f.request(path,input,'owner',{Origin:'https://other.invalid'})).status,403);
  assert.equal((await f.request(path,input,'owner',{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await f.request(path,undefined,'owner',{'X-SYNK-Demo':'1'})).status,400);
  assert.equal((await f.request(path,{...input,reviewerId:f.users.other.id})).status,400,'the request cannot forge another reviewer');
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.request(path)).data.review.canEdit,false);assert.equal((await f.request(path,input)).status,403);f.app.store.put('users',f.users.owner.id,f.users.owner);
  const row=f.app.store.get('studioProductions',f.production.id);f.app.store.put('studioProductions',row.id,{...row,reviewerId:f.users.viewer.id});
  assert.equal((await f.request(path,undefined,'viewer')).status,200,'a designated reader can see the exact package review');
  assert.equal((await f.request(path,input,'viewer')).status,403);
  f.app.store.put('studioProductions',row.id,{...row,ownerId:f.users.other.id,assigneeId:f.users.other.id});
  assert.equal((await f.request(path)).status,404);assert.equal((await f.request(path,input)).status,404);
  assert.equal(f.app.store.all('publicationPackageReviews').length,0);
  f.app.store.put('users',f.users.other.id,{...f.users.other,active:false});assert.equal((await f.request(path,undefined,'other')).status,401);assert.equal(f.calls(),0);
});

test('concurrent review edits conflict instead of overwriting and the saved revision survives a server restart',async t=>{
  const f=await fixture(t),path=reviewPath(f.pack.id);
  const results=await Promise.all(['video','audio'].map(checkId=>f.request(path,{revision:0,checkId,status:'confirmed',note:'synthetic concurrent confirmation'})));
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  const saved=results.find(result=>result.status===200).data.review;assert.equal(saved.revision,1);assert.equal(saved.manual.filter(row=>row.status==='confirmed').length,1);
  const raw=f.app.store.get('publicationPackageReviews',f.pack.id);assert.ok(raw);assert.ok(JSON.stringify(raw).includes(f.users.owner.id));
  await f.restart();const restored=await review(f);assert.deepEqual(restored,saved);
  assert.equal((await f.request(path,{revision:0,checkId:'copy',status:'confirmed',note:'stale browser'})).status,409);
  assert.equal((await f.request(path,{revision:1,checkId:'audio',status:'not-applicable',note:'합성 시험: 게시용 영상은 의도한 무음 영상임'})).status,200);assert.equal(f.calls(),0);
});

test('new video version, copy or subtitles require separate human confirmation while an identical package retains it',async t=>{
  const f=await fixture(t),done=await complete(f);assert.equal(done.summary.status,'complete');assert.equal(done.summary.pendingCount,0);
  const repeated=await f.makePackage();assert.equal(repeated.id,f.pack.id);assert.deepEqual(await review(f,repeated.id),done);
  const version=await f.upload('변경한 최종본'),changed=[await f.makePackage({body:f.input.body+' 수정 원고'}),await f.makePackage({subtitleText:'1\n00:00:00,000 --> 00:00:00,400\n다시 만나요.\n'}),await f.makePackage({versionId:version.id})];
  for(const pack of changed){assert.notEqual(pack.id,f.pack.id);const fresh=await review(f,pack.id);assert.equal(fresh.revision,0);assert.equal(fresh.summary.status,'pending');assert.equal(fresh.manual.filter(row=>row.status==='confirmed').length,0);}
  const previous=await review(f);assert.deepEqual(previous.manual,done.manual,'a new version must neither inherit nor erase an old package confirmation');assert.equal(previous.revision,done.revision);assert.equal(previous.summary.status,'complete');assert.equal(previous.isLatestVersion,false);assert.equal(previous.latestVersionId,version.id);
  assert.equal(f.app.store.all('publicationPackageReviews').length,1);assert.equal(f.calls(),0);
});
