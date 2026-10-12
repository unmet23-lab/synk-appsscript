import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

const draft={title:'합성 의견 취합 시험',customerName:'합성 고객',contact:'SYNTHETIC-PRIVATE-CONTACT',summary:'로컬 통합시험',terms:'범위·조건은 합의 원문 유지',internalNotes:'SYNTHETIC-PRIVATE-STAFF',nextStep:'시안 확인',dueDate:'2026-12-01',nextContactDate:''};
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-feedback-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,teachingConfig:null};
  let app,base;async function start(){app=createCompanyApp(options);const address=await app.start();base='http://127.0.0.1:'+address.port;}await start();
  const users={},tokens={};for(const [name,role,teamId]of [['owner','member','a'],['other','member','b'],['viewer','viewer','a'],['reviewer','member','a']]){users[name]=app.store.createUser({name,email:name+'@rounds-synthetic.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'staff-csrf'},10);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer=null,headers={},method=body===undefined?'GET':'POST'}={}){
    const response=await fetch(base+path,{method,headers:{...(customer?{Cookie:customer.cookie}:user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'staff-csrf'})}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const text=await response.text();return {status:response.status,headers:response.headers,text,data:response.headers.get('content-type')?.startsWith('application/json')&&text?JSON.parse(text):null};
  }
  async function create(user='owner',extra={}){const result=await request('/api/client-projects',{user,body:{...draft,...extra}});assert.equal(result.status,201,result.text);return result.data.project;}
  async function addPreview(row,label='시안 1',extra={}){const result=await request('/api/client-projects/'+row.id+'/versions',{body:{revision:row.revision,kind:'preview',label,url:'https://example.test/'+encodeURIComponent(label)},...extra});assert.equal(result.status,200,result.text);return result.data.project;}
  async function invite(row,user='owner'){const issued=await request('/api/client-projects/'+row.id+'/invite',{user,body:{revision:row.revision}});assert.equal(issued.status,200,issued.text);const opened=await request('/pulse/api/open',{user:null,body:{invite:issued.data.invite}});assert.equal(opened.status,200,opened.text);return {cookie:opened.headers.get('set-cookie').split(';')[0],csrf:opened.data.csrf,project:opened.data.project};}
  const studio=(row,body,extra={})=>request('/api/client-projects/'+row.id+'/studio',{body:{revision:row.revision,...body},...extra});
  const customerStudio=(customer,row,body,extra={})=>request('/pulse/api/studio',{customer,body:{revision:row.revision,...body},...extra});
  async function setup({reviewer=false}={}){let row=await create('owner',reviewer?{reviewerId:users.reviewer.id}:{});row=await addPreview(row);const customer=await invite(row);return {row:customer.project,customer};}
  async function save(customer,row,text='PRIVATE-CUSTOMER-UNSENT-DRAFT',extra={}){const result=await customerStudio(customer,row,{action:'save_feedback_draft',versionId:row.versions.filter(value=>value.kind==='preview').at(-1).id,text,seconds:3.5,...extra});assert.equal(result.status,200,result.text);return result.data.project;}
  function submission(row){const current=row.studio.feedbackRounds.drafts.find(value=>value.current);return {action:'submit_feedback_round',draftId:current.id,versionId:current.versionId,representativeName:'합성 취합 담당자',confirmed:true};}
  const approve=(customer,row)=>request('/pulse/api/action',{customer,body:{action:'approve',revision:row.revision,versionId:row.versions.filter(value=>value.kind==='preview').at(-1).id}});
  return {get app(){return app;},users,tokens,request,create,addPreview,invite,studio,customerStudio,setup,save,submission,approve,async restart(){await app.stop();await start();}};
}

test('saved customer drafts stay private in every staff projection and survive restart without creating feedback tasks',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();const notifications=f.app.store.get('clientProjects',row.id).notificationEvents.length;
  row=await f.save(customer,row);
  for(const [path,extra]of [['/api/client-projects',{}],['/api/client-projects/'+row.id+'/studio',{}],['/api/client-workflow',{}],['/api/pulse-live',{}]]){
    const result=await f.request(path,extra);assert.equal(result.status,200,result.text);assert.doesNotMatch(result.text,/PRIVATE-CUSTOMER-UNSENT-DRAFT/);
  }
  assert.equal(row.messages.length,0);assert.equal(f.app.store.get('clientProjects',row.id).notificationEvents.length,notifications);
  const privateState=row.studio.feedbackRounds;await f.restart();
  const refreshed=await f.request('/pulse/api/project',{customer});assert.equal(refreshed.status,200);assert.deepEqual(refreshed.data.project.studio.feedbackRounds,privateState);
  assert.doesNotMatch(refreshed.text,/SYNTHETIC-PRIVATE-STAFF|SYNTHETIC-PRIVATE-CONTACT|authorId/);
  const staff=await f.request('/api/client-projects');assert.doesNotMatch(staff.text,/PRIVATE-CUSTOMER-UNSENT-DRAFT/);
});

test('round routes enforce customer versus staff roles, current project revisions, origin and CSRF',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();const save={action:'save_feedback_draft',versionId:row.versions[0].id,text:'의견',seconds:null};
  for(const headers of [{'X-Pulse-CSRF':''},{'X-Pulse-CSRF':'wrong'},{Origin:'https://wrong.test'}])assert.equal((await f.customerStudio(customer,row,save,{headers})).status,403);
  assert.equal((await f.request('/pulse/api/studio',{body:{...save,revision:row.revision}})).status,401);
  assert.equal((await f.studio(row,save)).status,403);
  assert.equal((await f.studio(row,save,{user:'other'})).status,404);
  assert.equal((await f.studio(row,save,{user:'viewer'})).status,403);
  const stale=row;row=await f.save(customer,row,'명시적으로 저장한 의견');
  assert.equal((await f.customerStudio(customer,stale,save)).status,409);
  assert.equal((await f.customerStudio(customer,row,{...save,classification:'included'})).status,400);
  const response=await f.customerStudio(customer,row,f.submission(row));assert.equal(response.status,200,response.text);row=response.data.project;
  const round=row.studio.feedbackRounds.rounds[0],classify={action:'classify_feedback_round',roundId:round.id,itemId:round.items[0].id,classification:'included',scopeNote:'문구 타이밍 조정',scheduleNote:'합의한 일정 유지'};
  assert.equal((await f.customerStudio(customer,row,classify)).status,403);
  assert.equal((await f.studio(row,classify,{headers:{'X-CSRF-Token':'wrong'}})).status,403);
  assert.equal((await f.studio(row,classify,{user:'other'})).status,404);
  assert.equal((await f.studio(row,classify,{user:'viewer'})).status,403);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.studio(row,classify)).status,403);
});

test('batch submission reuses the existing correction workflow through reviewer acceptance and customer approval',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup({reviewer:true});row=await f.save(customer,row,'제품 이름을 더 크게', {seconds:0});row=await f.save(customer,row,'마지막 행동 안내를 오래', {seconds:8.4});
  assert.equal((await f.approve(customer,row)).status,409,'saved unsubmitted drafts block approval');
  const submit=await f.customerStudio(customer,row,f.submission(row));assert.equal(submit.status,200,submit.text);row=submit.data.project;
  const round=row.studio.feedbackRounds.rounds[0];assert.equal(round.items.length,2);assert.equal(round.number,1);assert.equal(row.messages.filter(value=>value.action==='feedback').length,2);
  assert.equal((await f.approve(customer,row)).status,409,'submitted requests block the reviewed version');
  const work=(await f.request('/api/client-workflow')).data.items.filter(value=>value.kind==='feedback');assert.equal(work.length,2);assert.deepEqual(new Set(work.map(value=>value.messageId)),new Set(round.items.map(value=>value.messageId)));
  row=await f.addPreview(row,'수정본 2');const corrected=row.versions.at(-1);
  async function blockedUntilAllReviewsReady(){
    const before=f.app.store.get('clientProjects',row.id),result=await f.approve(customer,row);
    assert.equal(result.status,409,result.text);assert.match(result.data.error,/최신 수정본에 연결하고 검토/);
    assert.deepEqual(f.app.store.get('clientProjects',row.id),before,'approval guard is read-only and never resolves submitted feedback');
  }
  await blockedUntilAllReviewsReady();
  for(const item of round.items){
    const sent=await f.request('/api/client-workflow',{body:{projectId:row.id,revision:row.revision,messageId:item.messageId,action:'submit_review',versionId:corrected.id}});assert.equal(sent.status,200,sent.text);row=sent.data.project;
    assert.equal(row.messages.find(value=>value.id===item.messageId).workflow.status,'review');
    await blockedUntilAllReviewsReady();
    const accepted=await f.request('/api/client-workflow',{user:'reviewer',body:{projectId:row.id,revision:row.revision,messageId:item.messageId,action:'accept',note:'수정본 확인 완료'}});assert.equal(accepted.status,200,accepted.text);row=accepted.data.project;
    assert.equal(row.messages.find(value=>value.id===item.messageId).workflow.status,'waiting_customer');
    if(item!==round.items.at(-1))await blockedUntilAllReviewsReady();
  }
  const approved=await f.approve(customer,row);assert.equal(approved.status,200,approved.text);row=approved.data.project;
  assert.ok(row.versions.at(-1).approvedAt);assert.ok(row.studio.feedbackRounds.rounds[0].items.every(value=>value.resolved));
  for(const item of round.items){const message=row.messages.find(value=>value.id===item.messageId);assert.equal(message.resolved,true);assert.equal(message.workflow,undefined);}
  assert.equal(row.terms,draft.terms);assert.equal(row.dueDate,draft.dueDate);
  const delivered=await f.request('/api/client-projects/'+row.id+'/versions',{body:{revision:row.revision,kind:'final',label:'최종 납품',url:'https://example.test/final',guide:'합의한 용도로 사용하는 최종 파일'}});
  assert.equal(delivered.status,200,delivered.text);assert.equal(delivered.data.project.stage,'delivered');assert.equal(delivered.data.project.versions.at(-1).approvedPreviewId,corrected.id);
  await f.restart();const reopened=(await f.request('/pulse/api/project',{customer})).data.project;assert.deepEqual(reopened.studio.feedbackRounds.rounds,row.studio.feedbackRounds.rounds);
});

test('customer approval requires the exact latest correction link while resolved history and support stay nonblocking',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();row=await f.save(customer,row,'이전 시안의 수정 의견');
  let result=await f.customerStudio(customer,row,f.submission(row));assert.equal(result.status,200,result.text);row=result.data.project;
  const feedbackId=row.studio.feedbackRounds.rounds[0].items[0].messageId;
  row=await f.addPreview(row,'수정본 2');
  result=await f.request('/api/client-workflow',{body:{projectId:row.id,revision:row.revision,messageId:feedbackId,action:'submit_review',versionId:row.versions.at(-1).id}});
  assert.equal(result.status,200,result.text);row=result.data.project;assert.equal(row.messages.find(message=>message.id===feedbackId).workflow.status,'waiting_customer');
  row=await f.addPreview(row,'수정본 3');
  const before=f.app.store.get('clientProjects',row.id),blocked=await f.approve(customer,row);
  assert.equal(blocked.status,409,blocked.text);assert.match(blocked.data.error,/최신 수정본에 연결/);assert.deepEqual(f.app.store.get('clientProjects',row.id),before);
  result=await f.request('/api/client-workflow',{body:{projectId:row.id,revision:row.revision,messageId:feedbackId,action:'reopen'}});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await f.request('/api/client-workflow',{body:{projectId:row.id,revision:row.revision,messageId:feedbackId,action:'submit_review',versionId:row.versions.at(-1).id}});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await f.request('/pulse/api/action',{customer,body:{action:'support',revision:row.revision,text:'승인과 별도로 남기는 일정 문의'}});assert.equal(result.status,200,result.text);row=result.data.project;
  result=await f.approve(customer,row);assert.equal(result.status,200,result.text);row=result.data.project;
  assert.equal(row.messages.find(message=>message.id===feedbackId).resolved,true);assert.equal(row.messages.find(message=>message.action==='support').resolved,false);
  row=await f.addPreview(row,'후속 시안 4');result=await f.approve(customer,row);assert.equal(result.status,200,result.text);
  assert.equal(result.data.project.messages.find(message=>message.id===feedbackId).resolved,true,'resolved earlier feedback needs no redundant link to later previews');
});

test('concurrent repeat submissions commit only one round and one set of legacy feedback messages',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();row=await f.save(customer,row,'일괄 제출 의견');const input=f.submission(row);
  const responses=await Promise.all([f.customerStudio(customer,row,input),f.customerStudio(customer,row,input)]);assert.deepEqual(responses.map(value=>value.status).sort(),[200,409]);
  row=responses.find(value=>value.status===200).data.project;assert.equal(row.studio.feedbackRounds.rounds.length,1);assert.equal(row.messages.filter(value=>value.action==='feedback').length,1);
  assert.equal((await f.customerStudio(customer,row,input)).status,409);
  const stored=f.app.store.get('clientProjects',row.id);assert.equal(stored.studio.feedbackRounds.rounds.length,1);assert.equal(stored.messages.length,1);
});

test('old preview drafts remain intact, cannot be rebound, and do not prevent approval of a later preview',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();row=await f.save(customer,row,'이전 시안의 개인 초안');const pending=f.submission(row),oldDraft=row.studio.feedbackRounds.drafts[0];
  row=await f.addPreview(row,'후속 시안');
  assert.equal((await f.customerStudio(customer,row,pending)).status,409);
  assert.equal((await f.customerStudio(customer,row,{...pending,versionId:row.versions.at(-1).id})).status,409);
  const current=(await f.request('/pulse/api/project',{customer})).data.project;assert.equal(current.studio.feedbackRounds.drafts[0].current,false);assert.equal(current.studio.feedbackRounds.drafts[0].items[0].text,oldDraft.items[0].text);
  const result=await f.approve(customer,current);assert.equal(result.status,200,result.text);assert.equal(result.data.project.studio.feedbackRounds.drafts.length,1);
});

test('public staff classifications preserve submitted text and expose neither internal workflow notes nor actor IDs',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();row=await f.save(customer,row,'제출 원문');let result=await f.customerStudio(customer,row,f.submission(row));assert.equal(result.status,200);row=result.data.project;const round=row.studio.feedbackRounds.rounds[0];
  result=await f.studio(row,{action:'classify_feedback_round',roundId:round.id,itemId:round.items[0].id,classification:'direction_change',scopeNote:'새로운 이야기는 추가 협의합니다.',scheduleNote:'범위 확인 후 새 일정을 안내합니다.'});assert.equal(result.status,200,result.text);row=result.data.project;
  const publicState=await f.request('/pulse/api/project',{customer}),item=publicState.data.project.studio.feedbackRounds.rounds[0].items[0];assert.equal(item.text,'제출 원문');assert.equal(item.classification.classification,'direction_change');assert.equal(item.resolved,false);
  assert.doesNotMatch(publicState.text,/SYNTHETIC-PRIVATE|authorId/);assert.equal(publicState.data.project.terms,draft.terms);assert.equal(publicState.data.project.dueDate,draft.dueDate);
  const work=await f.request('/api/client-workflow',{body:{projectId:row.id,revision:row.revision,messageId:item.messageId,action:'start',note:'PRIVATE-WORKFLOW-NOTE'}});assert.equal(work.status,200,work.text);
  const after=await f.request('/pulse/api/project',{customer});assert.doesNotMatch(after.text,/PRIVATE-WORKFLOW-NOTE/);assert.equal(after.data.project.studio.feedbackRounds.rounds[0].items[0].classification.scopeNote,item.classification.scopeNote);
});

test('customer capabilities are project scoped and rejected writes preserve other projects and drafts',async t=>{
  const f=await fixture(t);let a=await f.setup(),other=await f.create('other');other=await f.addPreview(other,'다른 시안',{user:'other'});const b=await f.invite(other,'other');a.row=await f.save(a.customer,a.row,'PRIVATE-A-DRAFT');
  const alienDraft=a.row.studio.feedbackRounds.drafts[0];
  for(const input of [{action:'remove_feedback_draft_item',draftId:alienDraft.id,itemId:alienDraft.items[0].id},{action:'submit_feedback_round',draftId:alienDraft.id,versionId:b.project.versions[0].id,representativeName:'다른 고객',confirmed:true}]){const result=await f.customerStudio(b,b.project,input);assert.equal(result.status,409,result.text);assert.doesNotMatch(result.text,/PRIVATE-A-DRAFT/);}
  const aAfter=await f.request('/pulse/api/project',{customer:a.customer});assert.equal(aAfter.data.project.studio.feedbackRounds.drafts[0].items[0].text,'PRIVATE-A-DRAFT');
  const bAfter=await f.request('/pulse/api/project',{customer:b});assert.doesNotMatch(bAfter.text,/PRIVATE-A-DRAFT/);
  const revoke=await f.request('/api/client-projects/'+a.row.id+'/revoke',{body:{revision:a.row.revision}});assert.equal(revoke.status,200);assert.equal((await f.customerStudio(a.customer,a.row,{action:'remove_feedback_draft_item',draftId:alienDraft.id,itemId:alienDraft.items[0].id})).status,401);
});

test('message-capacity failure rolls back both batch metadata and existing request content',async t=>{
  const f=await fixture(t);let {row,customer}=await f.setup();row=await f.save(customer,row,'첫 의견');row=await f.save(customer,row,'둘째 의견');
  const raw=f.app.store.get('clientProjects',row.id);raw.messages=Array.from({length:299},(_,i)=>({id:'synthetic-'+i,author:'staff',visibility:'customer',text:'보존할 기존 대화',at:'2026-10-12T00:00:00Z'}));f.app.store.put('clientProjects',row.id,raw);const before=f.app.store.get('clientProjects',row.id);
  const result=await f.customerStudio(customer,row,f.submission(row));assert.equal(result.status,409,result.text);assert.deepEqual(f.app.store.get('clientProjects',row.id),before);
});
