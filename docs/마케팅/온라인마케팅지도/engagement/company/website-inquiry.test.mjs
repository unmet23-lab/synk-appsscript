import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {Store} from './store.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';
import {createWebsiteInquiryService,classifyWebsiteInquiry} from './website-inquiry-service.mjs';
import {createGoogleFormsInquiryReader,inquiryQuestionMap,WEBSITE_INQUIRY_FORM_ID} from './website-inquiry-google.mjs';
import {connectWebsiteInquiry} from './website-inquiry-connect.mjs';

const consent='위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.';
const form={formId:WEBSITE_INQUIRY_FORM_ID,settings:{emailCollectionType:'RESPONDER_INPUT'},items:[['type','문의 유형'],['message','문의 내용'],['consent','개인정보 수집·이용 동의']].map(([id,title])=>({title,questionItem:{question:{questionId:id}}}))};
const sample=(patch={})=>({responseId:'synthetic-response-1',email:'synthetic@example.test',type:'LAB · 한국어 교육',message:'SYNTHETIC_PRIVATE_CONTENT',consent,createdAt:'2026-10-20T01:00:00.000Z',submittedAt:'2026-10-20T01:00:00.000Z',...patch});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-website-inquiry-')),store=new Store(join(directory,'company'));
  const users={admin:{id:'admin',role:'admin',name:'합성 관리자',active:true},other:{id:'other',role:'member',name:'합성 직원',active:true}};
  for(const user of Object.values(users))store.put('users',user.id,user);
  const integration={origin:'https://workspace.example.test',listUsers:()=>store.all('users'),listTeams:()=>[],authenticate:()=>null};
  const messenger=createMessenger({dataDir:join(directory,'messenger'),port:0,backgroundJobsEnabled:false,integration,
    driveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  await messenger.startMounted();
  let at='2026-10-20T02:00:00.000Z',items=[sample()],pages=null,readHook=null,taskHook=null,verifyHook=null,calls=0;
  const tasks={
    options:u=>messenger.taskOptionsForCompanyUser(u.id),
    create(u,input){const result=messenger.createTaskForCompanyUser(u.id,input);taskHook?.(result);return result;},
    find:(u,input)=>messenger.findTaskForCompanyUser(u.id,input),
    get:(u,input)=>messenger.taskForCompanyUser(u.id,input),
  };
  const reader={configured:()=>true,async verify(){await verifyHook?.();return {connected:true,formId:WEBSITE_INQUIRY_FORM_ID,verifiedAt:at};},
    async readPage(input){calls++;await readHook?.(input);return pages?pages(input):{items:structuredClone(items),nextPageToken:null,questionMap:{}};}};
  const make=()=>createWebsiteInquiryService({store,reader,tasks,origin:integration.origin,clock:()=>at});
  let service=make();
  t.after(async()=>{await service.close();await messenger.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  return {store,users,messenger,reader,tasks,get service(){return service;},set items(value){items=value;},set pages(value){pages=value;},set at(value){at=value;},
    set readHook(value){readHook=value;},set taskHook(value){taskHook=value;},set verifyHook(value){verifyHook=value;},get calls(){return calls;},
    restart(){service=make();},enable:()=>service.configure(users.admin,{enabled:true,revision:0}),
    counts:()=>Object.fromEntries(['messages','message_tasks','message_send_requests'].map(table=>[table,messenger.db.prepare('SELECT COUNT(*) AS n FROM '+table).get().n]))};
}

test('actual messenger lifecycle receives one personal task without copying private customer material',async t=>{
  const f=await fixture(t);await f.enable();assert.equal((await f.service.tick({force:true})).completed,true);
  const view=f.service.workspace(f.users.admin),row=view.items[0];
  assert.equal(row.email,'synthetic@example.test');assert.equal(row.classification.category,'lab');assert.match(row.classification.reason,/직접 선택/);
  assert.equal(row.task.state,'linked');assert.equal(row.status,'new');assert.equal(view.draftOnly,true);
  assert.deepEqual(f.counts(),{messages:1,message_tasks:1,message_send_requests:1});
  const message=f.messenger.db.prepare('SELECT * FROM messages').get();
  assert.match(message.body,/문의 접수함:/);assert.doesNotMatch(message.body,/synthetic@example|SYNTHETIC_PRIVATE/);
  const stored=JSON.stringify(f.store.all('websiteInquiries'));assert.doesNotMatch(stored,/synthetic@example|SYNTHETIC_PRIVATE/);
  assert.equal(f.messenger.db.prepare('SELECT kind FROM channels WHERE id=?').get(message.channel_id).kind,'self');
});

test('repeated pages, concurrent runs and process restart preserve the same actual task',async t=>{
  const f=await fixture(t);await f.enable();await Promise.all([f.service.tick({force:true}),f.service.tick({force:true})]);
  f.restart();await f.service.tick({force:true});assert.equal(f.service.workspace(f.users.admin).items.length,1);
  assert.deepEqual(f.counts(),{messages:1,message_tasks:1,message_send_requests:1});
});

test('lost result after durable task creation is recovered using the original messenger receipt',async t=>{
  const f=await fixture(t);await f.enable();f.taskHook=()=>{throw new Error('synthetic response lost');};
  await assert.rejects(f.service.tick({force:true}));assert.equal(f.counts().message_tasks,1);assert.equal(f.store.all('websiteInquiries')[0].task.state,'pending');
  f.taskHook=null;f.items=[];f.restart();await f.service.tick({force:true});
  assert.equal(f.counts().message_tasks,1);assert.equal(f.store.all('websiteInquiries')[0].task.state,'linked');
});

test('read and mutation authority is checked live and revocation during provider read leaves no customer rows',async t=>{
  const f=await fixture(t);
  assert.throws(()=>f.service.workspace(f.users.other),{status:403});
  await assert.rejects(f.service.configure(f.users.other,{enabled:true,revision:0}),{status:403});
  await f.enable();f.readHook=()=>f.store.put('users','admin',{...f.users.admin,role:'viewer'});
  await assert.rejects(f.service.tick({force:true}),{status:403});assert.equal(f.store.count('websiteInquiries'),0);assert.equal(f.counts().messages,0);
  assert.throws(()=>f.service.workspace(f.users.admin),{status:403});
});

test('pausing while a read is in progress blocks the returned page and preserves paused state',async t=>{
  const f=await fixture(t);await f.enable();
  f.readHook=()=>f.service.configure(f.users.admin,{enabled:false,revision:1});
  await assert.rejects(f.service.tick({force:true}),{code:'INQUIRY_CONFIG_CHANGED'});
  assert.equal(f.store.count('websiteInquiries'),0);assert.equal(f.service.workspace(f.users.admin).run.status,'paused');
});

test('edited response revises source without replacing an operator draft or duplicating the task',async t=>{
  const f=await fixture(t);await f.enable();await f.service.tick({force:true});
  let row=f.service.workspace(f.users.admin).items[0];
  f.service.update(f.users.admin,row.id,{revision:row.revision,replyDraft:'검토한 답변 초안',status:'reviewing'});
  f.items=[sample({message:'SYNTHETIC_UPDATED_CONTENT',submittedAt:'2026-10-20T02:05:00.000Z'})];
  await f.service.tick({force:true});row=f.service.get(f.users.admin,row.id);
  assert.equal(row.message,'SYNTHETIC_UPDATED_CONTENT');assert.equal(row.replyDraft,'검토한 답변 초안');assert.equal(row.status,'reviewing');assert.equal(f.counts().message_tasks,1);
  assert.throws(()=>f.service.update(f.users.admin,row.id,{revision:1,status:'replied'}),{status:409});
  assert.throws(()=>f.service.update(f.users.admin,row.id,{revision:row.revision,send:true}),{status:409});
});

test('synthetic checks stay separate, unknown types require review and privacy requests make no deletion',async t=>{
  const f=await fixture(t);f.items=[sample({message:'[SYNK 기능 점검 · 실제 문의 아님] synthetic'})];await f.enable();await f.service.tick({force:true});
  assert.equal(f.counts().message_tasks,0);assert.equal(f.service.workspace(f.users.admin).items[0].classification.isTest,true);
  assert.equal(classifyWebsiteInquiry(sample({type:'변경된 유형'})).category,'other');
  const privacy=classifyWebsiteInquiry(sample({message:'개인정보 삭제를 요청합니다.'}));
  assert.equal(privacy.category,'privacy');assert.match(privacy.nextAction,/자동 삭제.*수행하지/);
  const row=f.service.workspace(f.users.admin).items[0];
  assert.equal(f.service.update(f.users.admin,row.id,{revision:row.revision,status:'closed',replyDraft:''}).item.status,'closed');
  const health=f.service.health(f.users.admin);assert.equal(health.configured,true);assert.equal(health.status,'ready');
  assert.doesNotMatch(JSON.stringify(health),/synthetic@example|기능 점검|continuation|pageToken/);
});

test('invalid consent or malformed page rejects the entire page before storage or cursor advancement',async t=>{
  const f=await fixture(t);f.items=[sample(),sample({responseId:'invalid',consent:'동의하지 않음'})];await f.enable();
  await assert.rejects(f.service.tick({force:true}),{code:'INQUIRY_CONSENT_CHANGED'});
  assert.equal(f.store.count('websiteInquiries'),0);assert.equal(f.service.workspace(f.users.admin).run.watermark,undefined);
});

test('paginated collection preserves its filter and resumes a bounded pass without claiming whole success',async t=>{
  const f=await fixture(t);const requests=[];
  f.pages=input=>{requests.push(input);const n=Number(input.pageToken||0);return {items:[sample({responseId:'page-'+n})],nextPageToken:n<10?String(n+1):null,questionMap:{}};};
  await f.enable();const first=await f.service.tick({force:true});assert.equal(first.completed,false);assert.equal(f.service.workspace(f.users.admin).run.lastSuccessAt,null);
  const second=await f.service.tick({force:true});assert.equal(second.completed,true);assert.equal(requests[10].pageToken,'10');
  assert.ok(requests.every(input=>input.after===undefined));assert.equal(f.counts().message_tasks,11);
});

test('disabled or not-due runs never access the provider, and closed workers never run',async t=>{
  const f=await fixture(t);assert.equal((await f.service.tick()).reason,'paused');assert.equal(f.calls,0);
  await f.enable();await f.service.tick();assert.equal((await f.service.tick()).reason,'not-due');assert.equal(f.calls,1);
  await f.service.close();await assert.rejects(f.service.tick(),{code:'INQUIRY_STOPPED'});
});

function googleFixture(overrides={}){
  let creds={client_id:'synthetic-client',client_secret:'synthetic-secret',refresh_token:'synthetic-refresh'},hook=overrides.hook;
  const calls=[],fetchImpl=async(url,options={})=>{
    calls.push({url,method:options.method||'GET'});
    if(hook){const result=await hook(url,options);if(result)return result;}
    if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access',expires_in:3600});
    const parsed=new URL(url);
    if(parsed.pathname.endsWith('/responses')){
      if(parsed.searchParams.get('fields'))return Response.json({responses:[{responseId:'metadata-only'}]});
      return Response.json({responses:[{responseId:'api-response',respondentEmail:'synthetic@example.test',createTime:'2026-10-20T01:00:00Z',
        answers:Object.fromEntries([['type','LAB · 한국어 교육'],['message','합성 문의'],['consent',consent]].map(([id,value])=>[id,{textAnswers:{answers:[{value}]}}]))}]});
    }
    return Response.json(form);
  };
  const reader=createGoogleFormsInquiryReader({getCredentials:()=>creds,fetchImpl});
  return {reader,calls,set hook(value){hook=value;},set credentials(value){creds=value;}};
}
test('official Forms reader verifies question schema and response-ID-only permission without reading customer text',async()=>{
  const f=googleFixture();assert.equal((await f.reader.verify()).connected,true);
  assert.ok(new URL(f.calls[1].url).searchParams.get('fields').includes('settings(emailCollectionType)'));
  const probe=f.calls.find(call=>call.url.includes('/responses'));assert.equal(new URL(probe.url).searchParams.get('fields'),'responses(responseId),nextPageToken');
  assert.equal(f.calls.filter(call=>call.method==='POST').length,1);
});
test('disabled, missing or unknown email collection blocks verification and collection before any responses request',async()=>{
  for(const emailCollectionType of [undefined,'DO_NOT_COLLECT','EMAIL_COLLECTION_TYPE_UNSPECIFIED','unknown']){
    const f=googleFixture({hook:async url=>url.includes('/v1/forms/')&&!url.includes('/responses')?Response.json({...form,settings:{emailCollectionType}}):null});
    await assert.rejects(f.reader.verify(),{code:'FORM_EMAIL_COLLECTION_REQUIRED'});
    await assert.rejects(f.reader.readPage(),{code:'FORM_EMAIL_COLLECTION_REQUIRED'});
    assert.equal(f.calls.some(call=>call.url.includes('/responses')),false);
  }
  assert.ok(inquiryQuestionMap({...form,settings:{emailCollectionType:'VERIFIED'}}).message);
});
test('official Forms reader normalizes typed answers and keeps filter/pageToken across requests',async()=>{
  const f=googleFixture(),data=await f.reader.readPage({after:'2026-10-20T00:00:00Z',pageToken:'synthetic-next'});
  assert.equal(data.items[0].type,'LAB · 한국어 교육');assert.equal(data.items[0].email,'synthetic@example.test');
  const call=f.calls.find(call=>call.url.includes('/responses')),url=new URL(call.url);
  assert.equal(url.searchParams.get('filter'),'timestamp >= 2026-10-20T00:00:00.000Z');assert.equal(url.searchParams.get('pageToken'),'synthetic-next');
  assert.ok(f.calls.every(call=>call.url.startsWith('https://forms.googleapis.com/')||call.url==='https://oauth2.googleapis.com/token'));
});
test('missing connection, denied access and schema changes never look like an empty success',async()=>{
  const f=googleFixture();f.credentials=null;assert.equal(f.reader.configured(),false);await assert.rejects(f.reader.verify(),{code:'FORMS_NOT_CONNECTED'});
  const denied=googleFixture({hook:async url=>url.includes('/responses')?new Response('sensitive provider error',{status:403}):null});
  await assert.rejects(denied.reader.verify(),error=>error.code==='FORMS_AUTH_REQUIRED'&&!error.message.includes('sensitive'));
  assert.throws(()=>inquiryQuestionMap({...form,items:form.items.slice(1)}),{code:'FORM_SCHEMA_CHANGED'});
  assert.throws(()=>inquiryQuestionMap({...form,formId:'another-form'}),{code:'FORM_ID_MISMATCH'});
});
test('changing credential binding or cancellation during an await discards the result',async()=>{
  const f=googleFixture();f.hook=async url=>{if(url.includes('/v1/forms/'))f.credentials={client_id:'new-client',client_secret:'new-secret',refresh_token:'new-refresh'};};
  await assert.rejects(f.reader.verify(),{code:'FORMS_CONNECTION_CHANGED'});
  const controller=new AbortController();controller.abort();const cancelled=googleFixture();
  await assert.rejects(cancelled.reader.verify({signal:controller.signal}),{name:'AbortError'});assert.equal(cancelled.calls.length,0);
});

test('connection verification is read-only and installation stores an encrypted secret only after permission checks',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-inquiry-connect-')),dataDir=join(directory,'data'),credentialsPath=join(directory,'private.json'),store=new Store(dataDir);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  await writeFile(credentialsPath,JSON.stringify({client_id:'synthetic-client',client_secret:'synthetic-secret',refresh_token:'synthetic-refresh'}),{mode:0o600});
  let denied=false;const urls=[];
  const fetchImpl=async url=>{urls.push(url);if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access'});
    if(url.includes('/responses'))return denied?new Response('private provider error',{status:403}):Response.json({});
    return Response.json(form);};
  const check=await connectWebsiteInquiry({dataDir,credentialsPath,fetchImpl});
  assert.equal(check.installed,false);assert.equal(check.customerDataRead,false);assert.equal(store.secret('website-inquiries:google'),null);
  denied=true;await assert.rejects(connectWebsiteInquiry({dataDir,credentialsPath,execute:true,fetchImpl}),{code:'FORMS_AUTH_REQUIRED'});
  assert.equal(store.secret('website-inquiries:google'),null);denied=false;
  const installed=await connectWebsiteInquiry({dataDir,credentialsPath,execute:true,fetchImpl});assert.equal(installed.installed,true);
  const ciphertext=store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('website-inquiries:google').ciphertext;
  assert.doesNotMatch(ciphertext,/synthetic/);
  store.db.prepare('INSERT INTO tokens VALUES(?,?,?,?,?)').run('synthetic-old','test','admin','{}','2000-01-01T00:00:00Z');
  const current=await connectWebsiteInquiry({dataDir,fetchImpl});assert.equal(current.verified,true);assert.equal(current.installed,false);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE hash=?').get('synthetic-old').n,1,'read-only verification must not run Store constructor maintenance');
  assert.ok(urls.filter(url=>url.includes('/responses')).every(url=>new URL(url).searchParams.get('fields')==='responses(responseId),nextPageToken'));
});
