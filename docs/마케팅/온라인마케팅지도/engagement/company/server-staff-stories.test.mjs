import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='synthetic-staff-story-csrf';
let sequence=0;
const rid=()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`;
const draft=(extra={})=>({title:'첫 강의에서 배운 것',body:'학교 강의 뒤에 남은 질문',displayName:'합성 강사',note:'PRIVATE-HTTP-NOTE',...extra});
const shiftOnly={version:1,memberships:[{company:'SHIFT',role:'instructor'}],duties:[]};

async function fixture(t,extra={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-staff-story-http-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,...extra});
  await app.start();
  const base='http://127.0.0.1:'+app.server.address().port,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-staff-story-http-'));await rm(directory,{recursive:true,force:true});});
  for(const [name,role] of [['a','member'],['b','member'],['manager','manager'],['admin','admin'],['viewer','viewer']]){
    users[name]=app.store.createUser({name:'합성 '+name,email:name+'@staff-story-http.test',role});
    sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);
  }
  // A: SHIFT 강사로만 지정 — SNS · 페이지 · 제작 담당이 아니다.
  app.store.put('users',users.a.id,{...app.store.get('users',users.a.id),workspaceProfile:shiftOnly});
  async function api(path,{user='a',input,method=input===undefined?'GET':'POST',headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(user?{Cookie:'synk_company_session='+sessions[user]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
    const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{data=text;}
    return {status:response.status,data,headers:response.headers};
  }
  // 방문자: 쿠키 없음, 같은 출처 Origin만.
  async function guest(path,{input,method=input===undefined?'GET':'POST',headers={}}={}){
    const response=await fetch(base+path,{method,headers:{...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json'}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});
    const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{data=text;}
    return {status:response.status,data,headers:response.headers};
  }
  const create=async(user='a',value=draft())=>(await api('/api/my-stories',{user,input:{action:'create',requestId:rid(),draft:value}})).data.story;
  const act=async(story,action,extra={},user='a')=>api('/api/my-stories/'+story.id,{user,input:{action,requestId:rid(),expectedRevision:story.revision,...extra}});
  const publish=async(story,user='a')=>(await act(story,'publish',{confirmations:{peopleConsent:true,noPromise:true}},user)).data.story;
  const inquiry=(extra={})=>({requestId:rid(),name:'방문자',email:'visitor-private@example.test',message:'PRIVATE-HTTP-MESSAGE',consent:true,website:'',...extra});
  async function slow(path,payload,mutate){
    const body=JSON.stringify(payload),arrived=new Promise(done=>app.server.once('request',()=>setImmediate(done)));let req;
    const finished=new Promise((done,fail)=>{req=request(base+path,{method:'POST',headers:{Cookie:'synk_company_session='+sessions.a,Origin:app.origin,'X-CSRF-Token':csrf,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}},response=>{let data='';response.setEncoding('utf8');response.on('data',chunk=>data+=chunk);response.on('end',()=>done({status:response.statusCode,data:JSON.parse(data)}));});req.on('error',fail);});
    req.write(body.slice(0,10));await arrived;mutate();req.end(body.slice(10));return finished;
  }
  return {app,base,users,sessions,api,guest,create,act,publish,inquiry,slow};
}

test('HTTP: a SHIFT instructor with no SNS duty records, publishes, shares and sees a cookieless visitor’s real inquiry',async t=>{
  const f=await fixture(t);
  assert.equal((await f.api('/api/social/workspace')).status,403,'the story feature grants no SNS access');
  const empty=await f.api('/api/my-stories');assert.equal(empty.status,200);assert.deepEqual(empty.data.totals,{stories:0,live:0,received:0,open:0});assert.match(empty.headers.get('cache-control'),/no-store/);
  const story=await f.create();assert.equal(story.status,'draft');assert.equal(story.public,null);
  const live=await f.publish(story);assert.equal(live.public.url,f.app.origin+'/story/'+live.public.publicId);assert.match(f.app.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
  const page=await f.guest('/story/'+live.public.publicId+'/content');
  assert.equal(page.status,200);assert.equal(page.data.story.title,'첫 강의에서 배운 것');assert.equal(page.headers.get('set-cookie'),null);assert.equal(page.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.doesNotMatch(JSON.stringify(page.data),/PRIVATE-HTTP-NOTE|staff-story-http\.test|합성 a/);
  for(let i=0;i<3;i++)await f.guest('/story/'+live.public.publicId+'/content');
  assert.equal((await f.api('/api/my-stories')).data.totals.received,0,'opening the page is not an inquiry');
  const sent=await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()});
  assert.equal(sent.status,201);assert.equal(sent.data.accepted,true);assert.equal(sent.headers.get('set-cookie'),null);
  const mine=await f.api('/api/my-stories');assert.equal(mine.data.totals.received,1);assert.equal(mine.data.stories[0].inquiries.received,1);assert.equal(mine.data.inquiries.length,1);
  assert.doesNotMatch(JSON.stringify(mine.data.inquiries),/visitor-private|PRIVATE-HTTP-MESSAGE/);
  const detail=await f.api('/api/my-stories/inquiries/'+mine.data.inquiries[0].id);
  assert.equal(detail.status,200);assert.equal(detail.data.inquiry.email,'visitor-private@example.test');assert.equal(detail.data.inquiry.message,'PRIVATE-HTTP-MESSAGE');
});

test('HTTP: other employees, managers and admins get 404 for A’s stories and inquiries; viewers cannot write; login, demo, CSRF and origin are enforced',async t=>{
  const f=await fixture(t),live=await f.publish(await f.create());
  await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()});
  const inquiryId=(await f.api('/api/my-stories')).data.inquiries[0].id;
  for(const user of ['b','manager','admin']){
    const listed=await f.api('/api/my-stories',{user});assert.deepEqual(listed.data.stories,[]);assert.deepEqual(listed.data.inquiries,[]);
    assert.equal((await f.api('/api/my-stories/inquiries/'+inquiryId,{user})).status,404);
    assert.equal((await f.act(live,'unpublish',{},user)).status,404);
    assert.equal((await f.api('/api/my-stories/inquiries/'+inquiryId,{user,input:{action:'delete'}})).status,404);
  }
  assert.deepEqual((await f.api('/api/my-stories/held-inquiries',{user:'admin'})).data.inquiries,[]);
  assert.equal((await f.api('/api/my-stories/held-inquiries',{user:'manager'})).status,403);
  assert.equal((await f.api('/api/my-stories',{user:'viewer'})).status,200);
  const viewerWrite=await f.api('/api/my-stories',{user:'viewer',input:{action:'create',requestId:rid(),draft:draft()}});assert.equal(viewerWrite.status,403);assert.equal(viewerWrite.data.code,'SYNK_STORY_READONLY');
  assert.equal((await f.api('/api/my-stories',{user:null})).status,401);
  assert.equal((await f.api('/api/my-stories',{headers:{'x-synk-demo':'1'}})).status,403);
  assert.equal((await f.api('/api/my-stories',{input:{action:'create',requestId:rid(),draft:draft()},headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal((await f.api('/api/my-stories',{input:{action:'create',requestId:rid(),draft:draft()},headers:{Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await f.api('/api/my-stories?x=1')).status,400);
  assert.equal((await f.api('/api/my-stories/unknown')).status,404);
  assert.equal((await f.api('/api/my-stories',{method:'PUT'})).status,405);
  assert.equal((await f.api('/api/my-stories',{input:{action:'create',requestId:rid(),draft:draft()},headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await f.api('/api/my-stories',{input:{action:'create',requestId:rid(),draft:draft({body:'x'.repeat(90000)})}})).status,413);
  assert.equal((await f.api('/api/my-stories')).data.stories.length,1,'no rejected request wrote a story');
});

test('HTTP: visitor intake accepts only same-origin JSON POSTs and resolves lost responses by request ID or receipt',async t=>{
  const f=await fixture(t),live=await f.publish(await f.create()),path='/story/'+live.public.publicId+'/inquiries';
  assert.equal((await f.guest(path,{input:f.inquiry(),headers:{Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await f.guest(path,{input:f.inquiry(),headers:{Origin:''}})).status,403);
  assert.equal((await f.guest(path+'?from=x',{input:f.inquiry()})).status,400);
  assert.equal((await f.guest(path,{input:f.inquiry(),headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await f.guest(path)).status,405);
  assert.equal((await f.guest(path,{input:f.inquiry({consent:false})})).data.field,'consent');
  assert.equal((await f.guest(path,{input:f.inquiry({website:'spam'})})).status,400);
  const input=f.inquiry(),first=await f.guest(path,{input}),again=await f.guest(path,{input});
  assert.equal(first.status,201);assert.equal(again.status,200);assert.equal(again.data.duplicate,true);assert.equal(again.data.receiptId,first.data.receiptId);
  assert.equal((await f.guest(path,{input:{...input,message:'다른 내용'}})).status,409);
  const looked=await f.guest('/story/inquiry-receipt',{input:{requestId:input.requestId}});assert.equal(looked.data.state,'received');assert.doesNotMatch(JSON.stringify(looked.data),/visitor-private|PRIVATE/);
  const removed=await f.guest('/story/inquiry-delete',{input:{receiptId:first.data.receiptId,deleteToken:first.data.deleteToken}});assert.deepEqual(removed.data,{ok:true,deleted:true});
  const revived=await f.guest(path,{input});assert.equal(revived.status,200);assert.equal(revived.data.deleted,true);
  const mine=(await f.api('/api/my-stories')).data;assert.equal(mine.inquiries.length,0);assert.equal(mine.totals.received,1);
  assert.equal(f.app.store.secret('staff-story-inquiry:'+first.data.receiptId),null);
});

test('HTTP: drafts, unpublished, missing, deleted and suspended-owner stories are the same 404; only admins open held inquiries',async t=>{
  const f=await fixture(t),draftStory=await f.create(),live=await f.publish(await f.create());
  const missing='A'.repeat(22),content=id=>f.guest('/story/'+id+'/content');
  assert.equal((await content(missing)).status,404);
  assert.equal((await f.guest('/story/'+missing)).status,404);
  assert.equal(draftStory.public,null);
  await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()});
  const down=(await f.act(live,'unpublish')).data.story;
  assert.equal((await fetch(f.base+'/story/'+live.public.publicId+'?utm_source=sns',{redirect:'manual'})).status,404);
  const closed=await content(live.public.publicId);assert.equal(closed.status,404);assert.deepEqual(closed.data,(await content(missing)).data);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()})).status,404);
  assert.equal((await f.api('/api/my-stories')).data.inquiries.length,1,'earlier inquiries stay visible after unpublish');
  assert.equal((await f.act(down,'delete')).data.code,'SYNK_STORY_HAS_INQUIRIES');
  const again=(await f.act(down,'publish',{confirmations:{peopleConsent:true,noPromise:true}})).data.story;assert.equal(again.public.publicId,live.public.publicId);
  assert.equal((await content(live.public.publicId)).status,200);
  f.app.store.put('users',f.users.a.id,{...f.app.store.get('users',f.users.a.id),active:false});
  assert.equal((await content(live.public.publicId)).status,404);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()})).status,404);
  const held=await f.api('/api/my-stories/held-inquiries',{user:'admin'});assert.equal(held.data.inquiries.length,1);
  assert.equal((await f.api('/api/my-stories/held-inquiries/'+held.data.inquiries[0].id,{user:'admin'})).data.inquiry.message,'PRIVATE-HTTP-MESSAGE');
  assert.equal((await f.api('/api/my-stories/held-inquiries/'+held.data.inquiries[0].id,{user:'manager'})).status,403);
});

test('HTTP: after the owner is suspended the old story URL is 404, but the fixed receipt page still lets a cookieless visitor check and delete their inquiry',async t=>{
  const f=await fixture(t);
  // 글이 하나도 없을 때의 접수증 화면 — 아래 응답과 똑같아야 글 · 계정 상태가 화면에 실리지 않는다.
  const before=await f.guest('/story/receipt');assert.equal(before.status,200);
  const live=await f.publish(await f.create()),sent=await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()});assert.equal(sent.status,201);
  f.app.store.put('users',f.users.a.id,{...f.app.store.get('users',f.users.a.id),active:false});
  assert.equal((await f.guest('/story/'+live.public.publicId)).status,404);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/content')).status,404);
  const page=await f.guest('/story/receipt');
  assert.equal(page.status,200);assert.equal(page.data,before.data);
  assert.match(page.headers.get('content-type'),/^text\/html/);
  assert.equal(page.headers.get('content-security-policy'),"default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  assert.equal(page.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(page.headers.get('cache-control'),'no-store');assert.equal(page.headers.get('set-cookie'),null);
  assert.doesNotMatch(page.data,new RegExp([live.public.publicId,sent.data.receiptId,sent.data.deleteToken,'PRIVATE-HTTP','visitor-private','합성 강사','첫 강의에서 배운 것'].join('|')));
  for(const file of ['/staff-story.js','/staff-story.css'])assert.ok(page.data.includes(file),file);
  const head=await fetch(f.base+'/story/receipt',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('cache-control'),'no-store');
  const signedIn=await f.api('/story/receipt',{user:'b'});assert.equal(signedIn.status,200);assert.equal(signedIn.data,before.data);assert.equal(signedIn.headers.get('set-cookie'),null);
  assert.equal((await f.guest('/story/receipt?receiptId='+sent.data.receiptId)).status,404,'receipt values never travel in the URL');
  assert.ok([403,405].includes((await f.guest('/story/receipt',{input:{}})).status));
  const credentials={receiptId:sent.data.receiptId,deleteToken:sent.data.deleteToken};
  const looked=await f.guest('/story/inquiry-receipt',{input:credentials});assert.equal(looked.status,200);assert.equal(looked.data.state,'received');
  assert.deepEqual((await f.guest('/story/inquiry-delete',{input:credentials})).data,{ok:true,deleted:true});
  assert.deepEqual((await f.api('/api/my-stories/held-inquiries',{user:'admin'})).data.inquiries,[]);
  assert.equal(f.app.store.secret('staff-story-inquiry:'+sent.data.receiptId),null);
});

test('HTTP: stale tabs get 409 with the latest copy, inquiries never cause that 409, and a lost create is one story',async t=>{
  const f=await fixture(t),requestId=rid(),input={action:'create',requestId,draft:draft()};
  const first=await f.api('/api/my-stories',{input}),retry=await f.api('/api/my-stories',{input});
  assert.equal(first.status,201);assert.equal(retry.status,200);assert.equal(retry.data.duplicate,true);assert.equal((await f.api('/api/my-stories')).data.stories.length,1);
  const live=await f.publish(first.data.story);
  await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()});
  const tabs=await Promise.all(['탭 하나','탭 둘'].map(title=>f.act(live,'save',{draft:draft({title})})));
  assert.deepEqual(tabs.map(row=>row.status).sort(),[200,409]);
  const conflict=tabs.find(row=>row.status===409).data;assert.equal(conflict.code,'SYNK_STORY_CONFLICT');assert.equal(conflict.story.revision,live.revision+1);
  assert.equal(conflict.story.public.title,'첫 강의에서 배운 것');
});

test('HTTP: link first, external post later — the self-registered URL never changes the link or the count',async t=>{
  const f=await fixture(t),live=await f.publish(await f.create());
  assert.equal(live.external,null);
  assert.equal((await f.act(live,'link',{externalUrl:'http://insecure.example/p'})).status,400);
  const linked=(await f.act(live,'link',{externalUrl:'https://www.instagram.com/p/SYNTHETIC/'})).data.story;
  assert.equal(linked.external.source,'self');assert.equal(linked.public.url,live.public.url);assert.equal(linked.inquiries.received,0);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/content')).status,200);
});

test('HTTP: a story save rechecks the account after the body arrives and stores nothing for a revoked writer',async t=>{
  const f=await fixture(t);
  const result=await f.slow('/api/my-stories',{action:'create',requestId:rid(),draft:draft()},()=>f.app.store.put('users',f.users.a.id,{...f.app.store.get('users',f.users.a.id),role:'viewer'}));
  assert.equal(result.status,403);assert.equal(f.app.store.all('staffStories').length,0);
});

test('HTTP: the share URL follows the registered production origin, not the request host',async t=>{
  const f=await fixture(t,{origin:'https://workspace.example.test'});
  const live=await f.publish(await f.create());
  assert.equal(live.public.url,'https://workspace.example.test/story/'+live.public.publicId);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry(),headers:{Origin:'http://127.0.0.1'}})).status,403);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/inquiries',{input:f.inquiry()})).status,201);
});

// 설치 두 상태는 실제 작업 사본에 어떤 화면 파일이 있든 독립적으로 시험한다.
test('HTTP: installing the optional screens enables only live stories, with strict CSP and noindex',{timeout:90000},async()=>{
  const run=async function(){
    const {mock}=await import('node:test'),{default:assert}=await import('node:assert/strict');
    const {mkdtemp,rm,writeFile}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,dirname,resolve}=await import('node:path');
    const serverUrl=process.argv[1],optionalUrl=new URL('./optional-feature-modules.mjs',serverUrl).href;
    const real=await import(optionalUrl+'?real'),{createStaticSet}=await import(new URL('./static-set.mjs',serverUrl).href);
    const installed=process.argv[2]==='installed';
    mock.module(optionalUrl,{exports:{loadOptionalFeature:async(name,modules,base)=>name==='staffStoryScreens'?(installed?modules.map(()=>null):null):real.loadOptionalFeature(name,modules,base??serverUrl)}});
    const {createCompanyApp}=await import(serverUrl);
    const directory=await mkdtemp(join(tmpdir(),'synk-staff-story-page-')),screens=join(directory,'screens');
    await (await import('node:fs/promises')).mkdir(screens);
    const names=['staff-story.html','staff-story.js','staff-story.css','staff-stories.js','staff-stories.css'];
    for(const name of names)await writeFile(join(screens,name),name.endsWith('.html')?'<!doctype html><title>SYNTHETIC-STORY-PAGE</title><script src="/staff-story.js"></script>':'/* synthetic */');
    const here=dirname((await import('node:url')).fileURLToPath(serverUrl)),realSet=createStaticSet({root:'',repository:resolve(here,'../../../../..')});
    const staticSet={...realSet,file:absolute=>{const name=names.find(file=>resolve(absolute)===resolve(here,'public',file));return name?join(screens,name):realSet.file(absolute);}};
    let app;
    try{
      app=createCompanyApp({dataDir:join(directory,'data'),port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null,staticSet});
      await app.start();const base='http://127.0.0.1:'+app.server.address().port;
      const user=app.store.createUser({name:'합성 직원',email:'page@staff-story.test',role:'member'});
      const created=app.staffStories.create(user,{action:'create',requestId:'00000000-0000-4000-8000-000000000001',draft:{title:'제목',body:'',displayName:'이름',note:'PRIVATE'}}).story;
      const publish={action:'publish',requestId:'00000000-0000-4000-8000-000000000002',expectedRevision:1,confirmations:{peopleConsent:true,noPromise:true}};
      if(!installed){
        // 화면이 없으면 새 공개를 막고, 화면이 있던 때 공개한 글도 공유 주소 · 방문자 쪽을 닫는다. 초안 저장은 된다.
        assert.throws(()=>app.staffStories.mutate(user,created.id,publish),error=>error.status===503&&error.code==='SYNK_STORY_PAGES_OFF');
        const {createStaffStories}=await import(new URL('./staff-stories.mjs',serverUrl).href);
        const earlier=createStaffStories({store:app.store,origin:app.origin}).mutate(user,created.id,publish).story,publicId=earlier.public.publicId;
        const mine=app.staffStories.workspace(user),shown=mine.stories[0];
        assert.equal(mine.canPublish,false);assert.equal(shown.public.publicId,publicId);assert.equal(shown.public.url,null);assert.equal(shown.public.open,false);
        assert.equal(app.staffStories.mutate(user,created.id,{action:'save',requestId:'00000000-0000-4000-8000-000000000004',expectedRevision:2,draft:{title:'고친 제목',body:'',displayName:'이름',note:''}}).story.revision,3);
        for(const path of ['/story/'+publicId+'/content','/story/'+publicId,'/story/receipt','/staff-story.js','/staff-stories.css'])assert.equal((await fetch(base+path)).status,404,path);
        const sent=await fetch(base+'/story/'+publicId+'/inquiries',{method:'POST',headers:{Origin:app.origin,'Content-Type':'application/json'},body:JSON.stringify({requestId:'00000000-0000-4000-8000-000000000005',email:'v@example.test',message:'m',consent:true})});
        assert.equal(sent.status,404);assert.equal(app.store.all('staffStoryInquiries').length,0);
        console.log('absent screens verified');return;
      }
      const live=app.staffStories.mutate(user,created.id,publish).story;
      assert.equal(app.staffStories.workspace(user).canPublish,true);assert.equal(live.public.url,app.origin+'/story/'+live.public.publicId);assert.equal(live.public.open,true);
      const page=await fetch(base+'/story/'+live.public.publicId),html=await page.text();
      assert.equal(page.status,200);assert.match(html,/SYNTHETIC-STORY-PAGE/);assert.doesNotMatch(html,/PRIVATE/);
      assert.match(page.headers.get('content-security-policy'),/^default-src 'none'; script-src 'self';.*form-action 'none'$/);
      assert.equal(page.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(page.headers.get('cache-control'),'no-store');assert.equal(page.headers.get('set-cookie'),null);
      for(const asset of ['/staff-story.js','/staff-story.css','/staff-stories.js','/staff-stories.css'])assert.equal((await fetch(base+asset)).status,200,asset);
      const missing=await fetch(base+'/story/'+'B'.repeat(22));assert.equal(missing.status,404);assert.equal(await missing.text(),'이 글은 지금 볼 수 없어요.');assert.equal(missing.headers.get('x-robots-tag'),'noindex, nofollow');
      const referred=await fetch(base+'/story/'+live.public.publicId+'?from=x');
      assert.equal(referred.status,200);assert.equal(new URL(referred.url).search,'');assert.equal(await referred.text(),html);
      assert.ok([403,405].includes((await fetch(base+'/story/'+live.public.publicId,{method:'POST',headers:{Origin:base}})).status));
      app.staffStories.mutate(user,created.id,{action:'unpublish',requestId:'00000000-0000-4000-8000-000000000003',expectedRevision:2});
      assert.equal((await fetch(base+'/story/'+live.public.publicId)).status,404);
      app.store.put('users',user.id,{...app.store.get('users',user.id),active:false});
      const receipt=await fetch(base+'/story/receipt'),receiptHtml=await receipt.text();
      assert.equal(receipt.status,200);assert.equal(receiptHtml,html,'the receipt page is the same file with nothing stored added');
      assert.equal(receipt.headers.get('content-security-policy'),page.headers.get('content-security-policy'));
      assert.equal(receipt.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(receipt.headers.get('cache-control'),'no-store');assert.equal(receipt.headers.get('set-cookie'),null);
      assert.equal((await fetch(base+'/story/receipt',{method:'HEAD'})).status,200);
      console.log('staff story page verified');
    }finally{
      await app?.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-staff-story-page-'));await rm(directory,{recursive:true,force:true});
    }
  };
  const {execFile}=await import('node:child_process'),{promisify}=await import('node:util');
  for(const [mode,expected] of [['installed',/staff story page verified/],['absent',/absent screens verified/]]){
    const result=await promisify(execFile)(process.execPath,['--experimental-test-module-mocks','--input-type=module','-e','('+run.toString()+')()',new URL('./server.mjs',import.meta.url).href,mode],{encoding:'utf8',timeout:40000,maxBuffer:1024*1024});
    assert.match(result.stdout,expected);
  }
});

test('HTTP: the shipped public page loads its own script and style',async t=>{
  const f=await fixture(t),live=await f.publish(await f.create());
  const tagged=f.base+'/story/'+live.public.publicId+'?utm_source=sns&fbclid=synthetic-tag';
  const canonical=await fetch(tagged,{redirect:'manual'});
  assert.equal(canonical.status,302);
  assert.equal(canonical.headers.get('location'),'/story/'+live.public.publicId);
  assert.equal(canonical.headers.get('referrer-policy'),'no-referrer');
  assert.equal(canonical.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(tagged)).status,200);
  assert.equal((await fetch(tagged,{method:'HEAD'})).status,200);
  assert.equal((await f.guest('/story/'+live.public.publicId+'/content')).status,200);
  const page=await f.guest('/story/'+live.public.publicId);
  assert.equal(page.status,200);
  for(const file of ['/staff-story.js','/staff-story.css']){
    assert.ok(page.data.includes(file));assert.equal((await f.guest(file)).status,200);
  }
});

test('HTTP: logout still works next to the story routes and ends story access',async t=>{
  const f=await fixture(t);
  const logout=await f.api('/api/logout',{input:{}});assert.equal(logout.status,200);
  assert.equal((await f.api('/api/my-stories')).status,401);
});
