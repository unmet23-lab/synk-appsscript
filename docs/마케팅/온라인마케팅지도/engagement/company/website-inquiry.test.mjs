import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {Store} from './store.mjs';
import {createMessenger} from '../../../../../tools/company-messenger/server.mjs';
import {createWebsiteInquiryService,classifyWebsiteInquiry,websiteInquiryClassificationView} from './website-inquiry-service.mjs';
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
  assert.equal(row.email,'synthetic@example.test');assert.equal(row.classification.category,'lab');assert.match(row.classification.reason,/「LAB · 한국어 교육」 유형을 직접 골랐어요/);assert.doesNotMatch(row.classification.reason,/선택했습니다/);
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
  assert.equal(privacy.category,'privacy');assert.match(privacy.nextAction,/자동으로 지우거나 답하지 않아요/);assert.doesNotMatch(privacy.nextAction,/수행하지 않습니다/);
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

// 관리자 화면에 뜨는 서버 글: 10-21 아침(HEAD) 문장 → 지금 문장. 옛 문장은 사라지고 새 문장이 그대로 있다.
// 옛 분류 글 맵 줄(CLASSIFICATION_COPY_20261021)은 저장된 옛 기록을 보일 때만 쓰므로 옛 문장이 남아 있어 뺀다.
const COPY_PAIRS_20261021={
 "website-inquiry-service.mjs": [
  [
   "학습 목표·현재 수준·희망 방식을 확인하고 답변을 검토해 주세요.",
   "학습 목표 · 지금 수준 · 원하는 수업 방식을 보고 초안을 다듬어요."
  ],
  [
   "협업 목적·대상·희망 일정·범위를 확인하고 답변을 검토해 주세요.",
   "협업 목적 · 대상 · 원하는 일정 · 범위를 보고 초안을 다듬어요."
  ],
  [
   "관심 과정·국가·희망 시기를 확인하고 확정된 안내만 답변에 넣어 주세요.",
   "관심 과정 · 나라 · 원하는 시기를 보고, 확정된 안내만 초안에 넣어요."
  ],
  [
   "제작물·이용 범위·매체·일정 확인 후 권리와 견적을 검토해 주세요.",
   "제작물 · 이용 범위 · 매체 · 일정을 보고 권리와 견적을 정해요."
  ],
  [
   "관심 제품과 후속 연락 목적을 확인해 주세요. 자동 홍보 목록에는 추가하지 않습니다.",
   "관심 제품과 연락받고 싶은 까닭을 봐요. 홍보 목록에 저절로 넣지 않아요."
  ],
  [
   "을 확인해 주세요.",
   " 칸이 비었거나 형식이 맞지 않아요. Google 원본에서 그 응답을 봐 주세요."
  ],
  [
   "문의의 답변 이메일·접수 시각을 확인해 주세요.",
   "문의의 답변 이메일이나 접수 시각 형식이 맞지 않아요. Google 원본에서 그 응답을 봐 주세요."
  ],
  [
   "개인정보 동의 답변을 확인할 수 없어 수집을 중단했습니다.",
   "개인정보 동의 답변이 양식의 동의 문장과 달라 수집을 멈췄어요. 문의 양식의 동의 문장이 바뀌었는지 봐 주세요."
  ],
  [
   "응답 식별자",
   "응답 번호"
  ],
  [
   "응답 식별자가 올바르지 않습니다.",
   "응답 번호 형식이 맞지 않아요. Google 원본에서 그 응답을 봐 주세요."
  ],
  [
   "문의 내용에 기존 기능 점검 표식이 있습니다.",
   "문의 내용에 기능 점검 표식이 있어요."
  ],
  [
   "기능 점검 응답입니다. 고객 문의나 실적으로 집계하지 않습니다.",
   "기능 점검 응답이라 고객 문의와 실적에서 빠져요."
  ],
  [
   "문의 내용에 개인정보 삭제·열람 또는 동의 철회 표현이 있습니다. 운영자가 원문을 확인해야 합니다.",
   "문의 내용에 개인정보 삭제 · 열람이나 동의 철회 표현이 있어요. 원문을 직접 읽어 봐야 해요."
  ],
  [
   "원문의 요청 범위와 본인 확인 방법을 검토해 주세요. 자동 삭제·외부 답변은 수행하지 않습니다.",
   "원문에서 요청 범위와 본인 확인 방법을 보고 답을 정해요. 자동으로 지우거나 답하지 않아요."
  ],
  [
   "등록된 문의 유형과 일치하지 않습니다. 운영자의 확인이 필요합니다.",
   "등록된 문의 유형과 맞지 않아요. 직접 읽고 분류해야 해요."
  ],
  [
   "문의 원문과 유형을 확인한 뒤 답변을 작성해 주세요.",
   "원문과 고른 유형을 읽고 초안을 써요."
  ],
  [
   "응답자가 「",
   "문의 양식에서 「"
  ],
  [
   "」를 직접 선택했습니다.",
   "」 유형을 직접 골랐어요."
  ],
  [
   "홈페이지 문의는 회사 관리자만 확인할 수 있습니다.",
   "홈페이지 문의는 회사 관리자만 볼 수 있어요."
  ],
  [
   "관리자의 나에게 대화방을 확인하지 못했습니다.",
   "할 일을 받을 「나에게」 대화방을 찾지 못했어요. 이 관리자 계정이 메신저 계정과 이어져 있는지 봐 주세요."
  ],
  [
   "문의 기록을 찾을 수 없습니다.",
   "문의 기록을 찾지 못했어요. 새로 읽어 주세요."
  ],
  [
   "현재 설정을 새로 불러와 주세요.",
   "그사이 설정이 바뀌었어요. 새로 읽어 주세요."
  ],
  [
   "설정이 변경되었습니다.",
   "그사이 설정이 바뀌었어요. 새로 읽어 주세요."
  ],
  [
   "문의가 바뀌었습니다. 다시 불러와 주세요.",
   "그사이 문의가 바뀌었어요. 새로 읽어 주세요."
  ],
  [
   "문의 처리 상태를 확인해 주세요.",
   "처리 상태 값이 맞지 않아요. 상태를 다시 골라 주세요."
  ],
  [
   "답변 초안을 확인해 주세요.",
   "답변 초안이 너무 길거나 쓸 수 없는 글자가 있어요. 6,000자 안으로 줄여 주세요."
  ],
  [
   "기존 접수 업무를 생성한 관리자 계정을 확인해 주세요.",
   "다른 관리자가 이 문의의 할 일을 만들던 중이에요. 그 관리자 계정으로 다시 모아 주세요."
  ],
  [
   "문의 후속 업무의 권한이 변경되었습니다.",
   "문의 후속 할 일을 받을 대화방이 바뀌었어요. 새로 읽은 뒤 다시 모아 주세요."
  ],
  [
   "문의 원문과 분류 근거를 확인하고 답변 초안을 검토해 주세요.\\n외부 발송은 담당자가 별도로 진행합니다.\\n\\n문의 접수함: ",
   "문의 원문과 분류 근거를 읽고 답변 초안을 다듬어요.\\n고객에게 보내는 일은 담당자가 따로 해요.\\n\\n문의 접수함: "
  ],
  [
   "후속 업무 등록 결과를 확인하지 못했습니다.",
   "후속 할 일이 만들어졌는지 확인하지 못했어요. 다음 수집 때 다시 확인해요."
  ],
  [
   "문의 수집기가 종료 중입니다.",
   "문의 수집을 멈추는 중이에요. 잠시 뒤 다시 해 주세요."
  ],
  [
   "문의 수집 설정이 변경되어 중단했습니다.",
   "수집하는 동안 설정이 바뀌어 멈췄어요. 새로 읽은 뒤 다시 모아 주세요."
  ],
  [
   "문의 수집 결과 형식을 확인할 수 없습니다.",
   "Google에서 받은 문의 형식이 맞지 않아 멈췄어요. 잠시 뒤 다시 모아 주세요."
  ],
  [
   "문의 수집 또는 후속 업무 연결을 완료하지 못했습니다. 연결·권한을 확인해 주세요.",
   "문의 수집이나 후속 할 일 연결을 끝내지 못했어요. 「연결 확인」으로 Google 연결과 권한을 봐 주세요."
  ]
 ],
 "website-inquiry-google.mjs": [
  [
   "문의 양식의 질문·응답 읽기 권한으로 Google 계정을 연결해 주세요.",
   "Google 계정에 문의 양식을 읽을 권한이 없어요. 질문 · 응답 읽기 권한으로 다시 연결해 주세요."
  ],
  [
   "설정된 문의 양식에 접근할 수 없습니다.",
   "정해 둔 문의 양식을 열 수 없어요. 양식을 가진 계정의 권한을 봐 주세요."
  ],
  [
   "Google 문의 양식을 읽지 못했습니다. 다음 점검에서 다시 확인합니다.",
   "Google 문의 양식을 읽지 못했어요. 다음 수집 때 다시 읽어요."
  ],
  [
   "홈페이지 문의 양식 식별자가 일치하지 않습니다.",
   "열린 양식이 홈페이지 문의 양식과 달라요. 「Google 원본 열기」로 양식 주소를 봐 주세요."
  ],
  [
   "문의 양식의 답변받을 이메일 수집 설정을 확인해 주세요. 이메일을 받을 수 있어야 문의 수집을 시작합니다.",
   "문의 양식이 답변받을 이메일을 모으지 않아요. 양식 설정에서 이메일 모으기를 켜 주세요."
  ],
  [
   "문의 양식 질문이 바뀌었습니다. 문의 유형·내용·동의 질문을 확인해 주세요.",
   "문의 양식 질문이 바뀌었어요. 문의 유형 · 내용 · 동의 질문이 그대로인지 봐 주세요."
  ],
  [
   "필수 답변이 없는 문의 응답입니다. 원본 양식을 확인해 주세요.",
   "꼭 받아야 할 답이 빠진 응답이 있어요. Google 원본에서 그 응답을 봐 주세요."
  ],
  [
   "문의 응답의 식별자·시각을 확인해 주세요.",
   "응답 번호나 접수 시각이 빠진 응답이 있어요. Google 원본에서 그 응답을 봐 주세요."
  ],
  [
   "홈페이지 문의용 Google 읽기 연결이 아직 없습니다.",
   "홈페이지 문의를 읽을 Google 연결이 아직 없어요. 연결을 마친 뒤 「연결 확인」을 눌러 주세요."
  ],
  [
   "문의 계정 연결이 변경되어 수집을 중단했습니다.",
   "문의 계정 연결이 바뀌어 수집을 멈췄어요. 「연결 확인」을 다시 눌러 주세요."
  ],
  [
   "Google 인증 서버에 연결하지 못했습니다.",
   "Google 인증 서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요."
  ],
  [
   "문의용 Google 읽기 연결을 다시 확인해 주세요.",
   "Google 읽기 연결이 풀렸어요. 계정을 다시 연결한 뒤 「연결 확인」을 눌러 주세요."
  ],
  [
   "Google 문의 양식에 연결하지 못했습니다.",
   "Google 문의 양식에 연결하지 못했어요. 잠시 뒤 다시 해 주세요."
  ],
  [
   "문의 응답이 너무 커서 수집을 중단했습니다.",
   "문의 응답이 너무 커서 수집을 멈췄어요. Google 원본에서 그 응답을 봐 주세요."
  ],
  [
   "Google 문의 응답 형식을 확인할 수 없습니다.",
   "Google 문의 응답 형식이 맞지 않아요. 잠시 뒤 다시 모아 주세요."
  ],
  [
   "문의 수집 시각이 올바르지 않습니다.",
   "이어 모을 시각을 읽지 못했어요. 잠시 뒤 다시 모아 주세요."
  ],
  [
   "문의 수집 위치가 올바르지 않습니다.",
   "이어 모을 자리를 읽지 못했어요. 잠시 뒤 다시 모아 주세요."
  ],
  [
   "Google 문의 목록 형식을 확인해 주세요.",
   "Google에서 받은 문의 목록 형식이 맞지 않아요. 잠시 뒤 다시 모아 주세요."
  ]
 ],
 "studio-service.mjs": [
  [
   "처음 제작할 때만 조사 원문을 함께 저장할 수 있습니다.",
   "조사 원문은 작업을 처음 만들 때만 함께 저장할 수 있어요."
  ]
 ]
};
test('admin-facing server copy moved from the 10-21 morning wording to the new wording, pair by pair',()=>{
  for(const [name,list] of Object.entries(COPY_PAIRS_20261021)){
    const source=readFileSync(new URL('./'+name,import.meta.url),'utf8').split(/\r?\n/).filter(line=>!line.includes('CLASSIFICATION_COPY_20261021')).join('\n');
    for(const [old,next] of list){assert.ok(source.includes(`'${next}'`),name+': '+next);assert.ok(!source.includes(`'${old}'`),name+': '+old);}
  }
  // 관리자 화면에 뜨는 오류 글 전부: 내부 말 · 「확인해 주세요」 투가 없다.
  const google=readFileSync(new URL('./website-inquiry-google.mjs',import.meta.url),'utf8'),service=readFileSync(new URL('./website-inquiry-service.mjs',import.meta.url),'utf8');
  const messages=[...(google+service).matchAll(/fail\('[A-Z_]+',(?:label\+)?'([^']*)'/g)].map(match=>match[1]);assert.ok(messages.length>30,String(messages.length));
  for(const message of messages)assert.doesNotMatch(message,/식별자|확인해 주세요|다시 이어요|다시 모아요\.$/,message);
});

test('classification text stored before the 10-21 copy change is shown in the new wording without changing the classification or the customer draft',async t=>{
  const old={category:'lab',label:'한국어 교육',reason:'응답자가 「LAB · 한국어 교육」를 직접 선택했습니다.',nextAction:'학습 목표·현재 수준·희망 방식을 확인하고 답변을 검토해 주세요.',draft:'한국어 교육 문의를 남겨 주셔서 감사합니다.',isTest:false};
  const view=websiteInquiryClassificationView(old);
  assert.equal(view.reason,'문의 양식에서 「LAB · 한국어 교육」 유형을 직접 골랐어요.');assert.equal(view.nextAction,'학습 목표 · 지금 수준 · 원하는 수업 방식을 보고 초안을 다듬어요.');
  assert.equal(view.category,'lab');assert.equal(view.isTest,false);assert.equal(view.draft,old.draft,'the customer reply draft keeps its formal wording');
  for(const [reason,nextAction] of [['문의 내용에 기존 기능 점검 표식이 있습니다.','기능 점검 응답입니다. 고객 문의나 실적으로 집계하지 않습니다.'],['문의 내용에 개인정보 삭제·열람 또는 동의 철회 표현이 있습니다. 운영자가 원문을 확인해야 합니다.','원문의 요청 범위와 본인 확인 방법을 검토해 주세요. 자동 삭제·외부 답변은 수행하지 않습니다.'],['등록된 문의 유형과 일치하지 않습니다. 운영자의 확인이 필요합니다.','문의 원문과 유형을 확인한 뒤 답변을 작성해 주세요.']]){
    const next=websiteInquiryClassificationView({reason,nextAction});assert.doesNotMatch(next.reason+next.nextAction,/습니다|합니다/);
  }
  assert.deepEqual({...websiteInquiryClassificationView({reason:'운영자가 직접 적은 근거',nextAction:'그대로 둘 글'})},{reason:'운영자가 직접 적은 근거',nextAction:'그대로 둘 글'},'unknown text passes through');
  assert.equal(websiteInquiryClassificationView(null),null);
  // A row imported by the old wording is shown in the new wording through the workspace response.
  const f=await fixture(t);await f.enable();await f.service.tick({force:true});
  const stored=f.store.all('websiteInquiries')[0];f.store.put('websiteInquiries',stored.id,{...stored,classification:old});
  const row=f.service.workspace(f.users.admin).items[0];assert.equal(row.classification.reason,view.reason);assert.equal(f.store.get('websiteInquiries',stored.id).classification.reason,old.reason,'the stored record is not rewritten');
});
