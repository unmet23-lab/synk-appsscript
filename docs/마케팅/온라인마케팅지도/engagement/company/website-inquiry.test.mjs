import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
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
const registrationMessage='[TOPIK 4급 온라인 반 관심 등록]\n이름: 합성 학생\n지금 급수: 3급\n4급이 필요한 때: 내년\n토요일 시간: 오후\n들어온 곳: univ-test · 화면 언어 몽골어';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-website-inquiry-')),store=new Store(join(directory,'company'));
  const users={admin:{id:'admin',role:'admin',name:'합성 관리자',active:true},other:{id:'other',role:'member',name:'합성 직원',active:true}};
  for(const user of Object.values(users))store.put('users',user.id,user);
  const integration={origin:'https://workspace.example.test',listUsers:()=>store.all('users'),listTeams:()=>[],authenticate:()=>null};
  const messenger=createMessenger({dataDir:join(directory,'messenger'),port:0,backgroundJobsEnabled:false,integration,
    driveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  await messenger.startMounted();
  let at='2026-10-20T02:00:00.000Z',items=[sample()],pages=null,readHook=null,taskHook=null,verifyHook=null,removeHook=null,google='present',googleHook=null,calls=0;
  const googleCalls=[];
  const tasks={
    options:u=>messenger.taskOptionsForCompanyUser(u.id),
    create(u,input){const result=messenger.createTaskForCompanyUser(u.id,input);taskHook?.(result);return result;},
    find:(u,input)=>messenger.findTaskForCompanyUser(u.id,input),
    get:(u,input)=>messenger.taskForCompanyUser(u.id,input),
    remove(u,input){removeHook?.(u,input);return messenger.removeTaskForCompanyUser(u.id,input);},
  };
  const reader={configured:()=>true,async verify(){await verifyHook?.();return {connected:true,formId:WEBSITE_INQUIRY_FORM_ID,verifiedAt:at};},
    async readPage(input){calls++;await readHook?.(input);return pages?pages(input):{items:structuredClone(items),nextPageToken:null,questionMap:{}};},
    async responseState(input){googleCalls.push(input);await googleHook?.(input);return google;}};
  const make=()=>createWebsiteInquiryService({store,reader,tasks,origin:integration.origin,clock:()=>at,walRetryMs:[30,30,30]});
  let service=make();
  t.after(async()=>{await service.close();await messenger.close();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  return {store,users,messenger,reader,tasks,googleCalls,get service(){return service;},set items(value){items=value;},set pages(value){pages=value;},set at(value){at=value;},
    set readHook(value){readHook=value;},set taskHook(value){taskHook=value;},set verifyHook(value){verifyHook=value;},set removeHook(value){removeHook=value;},
    set google(value){google=value;},set googleHook(value){googleHook=value;},get calls(){return calls;},
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

test('current form choices separate SHIFT services while historical broad inquiries are not relabeled as lectures',()=>{
  const choices=[['SHIFT · 학교·기업·기관 AI 강의','shift-lecture'],['SHIFT · AI 강사·진로 강사 에이전시','shift-agency'],['SHIFT · AI 업무 자동화','shift-automation'],['PATH · 유학·취업 연계','path-career'],['SHIFT · 유학·취업 연계','path-career'],['SHIFT · 기관 강의·기업 컨설팅·브랜딩','shift-business']];
  for(const [type,category]of choices)assert.equal(classifyWebsiteInquiry(sample({type})).category,category);
  const old=classifyWebsiteInquiry(sample({type:choices.at(-1)[0]}));assert.equal(old.label,'SHIFT · 기존 기관·기업 문의');assert.match(old.nextAction,/원문/);
});

test('plain interest registration creates no reply task; notes and corrected emails remain review work',async t=>{
  const f=await fixture(t);f.items=[sample({message:registrationMessage}),sample({responseId:'note',message:registrationMessage+'\n쓰기에서 어려운 점: 단어가 잘 떠오르지 않아요'}),sample({responseId:'resubmit',message:registrationMessage+'\n다시 등록: 이메일을 고쳐 다시 보냄'})];
  await f.enable();await f.service.tick({force:true});f.restart();await f.service.tick({force:true});
  const view=f.service.workspace(f.users.admin),plain=view.items.find(row=>row.responseId==='synthetic-response-1');
  assert.equal(plain.registration.waitlistOnly,true);assert.equal(plain.task,null);assert.equal(plain.replyDraft,'');assert.equal(plain.status,'new');
  assert.equal(f.counts().message_tasks,2);assert.equal(view.registrations.products[0].records,3);assert.equal(view.registrations.products[0].uniqueEmails,1);
  const note=view.items.find(row=>row.responseId==='note');assert.equal(note.registration.hasNote,true);assert.equal(note.task.state,'linked');
  const closed=f.service.update(f.users.admin,plain.id,{revision:plain.revision,status:'closed'}).item;
  assert.equal(closed.registration.productId,'topik4');assert.equal(f.service.workspace(f.users.admin).registrations.products[0].records,2);
  assert.throws(()=>f.service.workspace(f.users.other),{status:403});
});

test('historic categories and registrations project without writing stored rows or replacing existing tasks and drafts',async t=>{
  const f=await fixture(t);f.items=[sample({type:'SHIFT · 유학·취업 연계'})];await f.enable();await f.service.tick({force:true});
  let raw=f.store.all('websiteInquiries')[0];
  const old={...raw,classification:{...raw.classification,category:'shift-career',label:'옛 분류'},status:'reviewing',replyDraft:'직접 검토한 초안',draftEdited:true};
  f.store.put('websiteInquiries',raw.id,old);
  const before=JSON.stringify(f.store.all('websiteInquiries')),view=f.service.get(f.users.admin,raw.id);
  assert.equal(view.classification.category,'path-career');assert.equal(view.replyDraft,'직접 검토한 초안');assert.equal(view.status,'reviewing');assert.equal(view.task.state,'linked');
  assert.equal(JSON.stringify(f.store.all('websiteInquiries')),before,'reading never migrates old data');
  const data={...f.store.decrypt(old.payload),type:'LAB · 한국어 교육',message:registrationMessage};
  f.store.put('websiteInquiries',raw.id,{...old,payload:f.store.encrypt(data),classification:classifyWebsiteInquiry(data)});
  raw=f.store.all('websiteInquiries')[0];const saved=JSON.stringify(raw);
  const projected=f.service.workspace(f.users.admin).items[0];assert.equal(projected.registration.waitlistOnly,true);assert.equal(projected.task.state,'linked');assert.equal(projected.replyDraft,'직접 검토한 초안');
  f.items=[];await f.service.tick({force:true});assert.equal(JSON.stringify(f.store.get('websiteInquiries',raw.id)),saved);assert.equal(f.counts().message_tasks,1);
});

test('a registration that later adds a concern creates one task and removing the concern preserves its reviewed draft and status',async t=>{
  const f=await fixture(t);f.items=[sample({message:registrationMessage})];await f.enable();await f.service.tick({force:true});assert.equal(f.counts().message_tasks,0);
  f.items=[sample({message:registrationMessage+'\n쓰기에서 어려운 점: 논리적인 글을 쓰기 어려워요',submittedAt:'2026-10-20T02:05:00Z'})];
  await f.service.tick({force:true});let row=f.service.workspace(f.users.admin).items[0];assert.equal(f.counts().message_tasks,1);assert.equal(row.registration.hasNote,true);
  f.service.update(f.users.admin,row.id,{revision:row.revision,status:'reviewing',replyDraft:'담당자가 검토한 답장'});
  f.items=[sample({message:registrationMessage,submittedAt:'2026-10-20T02:06:00Z'})];await f.service.tick({force:true});f.restart();await f.service.tick({force:true});
  row=f.service.workspace(f.users.admin).items[0];assert.equal(row.registration.waitlistOnly,true);assert.equal(row.replyDraft,'담당자가 검토한 답장');assert.equal(row.status,'reviewing');assert.equal(row.task.state,'linked');assert.equal(f.counts().message_tasks,1);
});

test('a pending task receipt is repaired even when its registration no longer needs a new reply task',async t=>{
  const f=await fixture(t);f.items=[sample({message:registrationMessage+'\n쓰기에서 어려운 점: 긴 글이 어려워요'})];await f.enable();f.taskHook=()=>{throw new Error('lost synthetic task result');};
  await assert.rejects(f.service.tick({force:true}));const row=f.store.all('websiteInquiries')[0];assert.equal(row.task.state,'pending');assert.equal(f.counts().message_tasks,1);
  f.store.put('websiteInquiries',row.id,{...row,payload:f.store.encrypt({...f.store.decrypt(row.payload),message:registrationMessage})});
  f.taskHook=null;f.items=[];f.restart();await f.service.tick({force:true});
  assert.equal(f.service.get(f.users.admin,row.id).registration.waitlistOnly,true);assert.equal(f.service.get(f.users.admin,row.id).task.state,'linked');assert.equal(f.counts().message_tasks,1);
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

const ERASED='websiteInquiryErasures';
const PRIVATE=/synthetic@example|SYNTHETIC_PRIVATE|SYNTHETIC_UPDATED|synthetic-response|검토한 답변 초안/;
async function collected(f){await f.enable();await f.service.tick({force:true});return f.service.workspace(f.users.admin).items[0];}

test('erasing takes a confirmation, takes back its task and leaves only the row number and the time',async t=>{
  const f=await fixture(t),row=await collected(f),admin=f.users.admin;
  f.service.update(admin,row.id,{revision:row.revision,replyDraft:'검토한 답변 초안',status:'reviewing'});
  const current=f.service.get(admin,row.id);assert.equal(current.task.state,'linked');assert.deepEqual(f.counts(),{messages:1,message_tasks:1,message_send_requests:1});
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:current.revision});
  assert.deepEqual({...erasure,token:typeof erasure.token},{id:row.id,revision:current.revision,google:'present',task:'linked',isTest:false,expiresAt:'2026-10-20T02:10:00.000Z',token:'string'});
  assert.deepEqual(f.googleCalls.map(call=>call.responseId),['synthetic-response-1'],'Google is asked about this one response only');
  assert.equal(f.service.get(admin,row.id).revision,current.revision,'checking changes nothing');assert.equal(f.counts().message_tasks,1);
  for(const input of [{revision:current.revision},{revision:current.revision,token:'1'.repeat(13)+'.'+'0'.repeat(64)},{revision:current.revision,token:erasure.token.replace(/.$/,c=>c==='0'?'1':'0')},{revision:current.revision,token:erasure.token+'0'}])
    assert.throws(()=>f.service.erase(admin,row.id,input),{code:'INQUIRY_ERASE_CONFIRM',status:409});
  assert.throws(()=>f.service.erase(admin,row.id,{revision:current.revision-1,token:erasure.token}),{code:'INQUIRY_REVISION'});
  assert.throws(()=>f.service.erase(admin,row.id,{revision:current.revision,token:erasure.token,force:true}),{code:'INQUIRY_REVISION'});
  assert.throws(()=>f.service.erase(f.users.other,row.id,{revision:current.revision,token:erasure.token}),{status:403});
  assert.equal(f.store.count('websiteInquiries'),1);assert.equal(f.counts().message_tasks,1);
  f.at='2026-10-20T02:03:00.000Z';f.store.db.exec('PRAGMA secure_delete=FAST');// the store sets ON; any other value must come back too
  const done=f.service.erase(admin,row.id,{revision:current.revision,token:erasure.token});
  assert.deepEqual(done,{erased:{id:row.id,erasedAt:'2026-10-20T02:03:00.000Z',task:'removed',wal:'truncated'}});
  assert.equal(f.store.count('websiteInquiries'),0);assert.deepEqual(f.counts(),{messages:0,message_tasks:0,message_send_requests:1},'the task message and its task are gone; the receipt keeps no text');
  assert.deepEqual(f.store.all(ERASED),[{id:row.id,erasedAt:'2026-10-20T02:03:00.000Z'}],'the erasure record is the row number and the time only');
  assert.doesNotMatch(JSON.stringify(f.store.db.prepare("SELECT kind,body FROM documents WHERE kind<>'users'").all()),PRIVATE,'no customer text, email, draft or response number is left in the company store');
  // Only the last revision ever held this draft: the erase zeroed that cell and truncated the WAL, so neither file keeps it.
  assert.equal(statSync(join(f.store.directory,'company.sqlite-wal')).size,0,'the erase truncates the WAL');
  assert.equal(readFileSync(join(f.store.directory,'company.sqlite')).includes(Buffer.from('검토한 답변 초안')),false,'the erased draft is not left in the database file');
  assert.equal(f.store.db.prepare('PRAGMA secure_delete').get().secure_delete,2,'secure_delete goes back to its earlier value');assert.equal(f.store.db.prepare('PRAGMA busy_timeout').get().timeout,5000,'so does busy_timeout');
  assert.throws(()=>f.service.get(admin,row.id),{status:404});assert.equal(f.service.workspace(admin).items.length,0);
  assert.deepEqual(f.service.erase(admin,row.id,{revision:current.revision,token:erasure.token}),{erased:{id:row.id,erasedAt:'2026-10-20T02:03:00.000Z',task:'none',repeated:true}},'a repeat answers from the record');
  await assert.rejects(f.service.checkErase(admin,row.id,{revision:current.revision}),{status:404});
});

test('an older draft freed by a later edit is zeroed at that edit, so an erase leaves no earlier revision in free pages',async t=>{
  // GPT 2차 검수 GA1: a long draft spills into overflow pages; a shorter one frees them. Every row write zeroes what it frees,
  // by itself: here the connection has secure_delete off.
  const f=await fixture(t),admin=f.users.admin;let row=await collected(f);f.store.db.exec('PRAGMA secure_delete=OFF');
  const long='LONG-DRAFT-SECRET-0042 '.repeat(250);assert.ok(long.length<6000);
  row=f.service.update(admin,row.id,{revision:row.revision,replyDraft:long}).item;row=f.service.update(admin,row.id,{revision:row.revision,replyDraft:'짧은 초안'}).item;
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});
  assert.equal(f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}).erased.wal,'truncated');
  const file=readFileSync(join(f.store.directory,'company.sqlite'));
  assert.equal(file.includes(Buffer.from('LONG-DRAFT-SECRET-0042')),false,'the long draft of an earlier revision is not left in free pages');
  assert.equal(file.includes(Buffer.from('짧은 초안')),false);
});

test('a reader holding the WAL leaves the erase reported as pending, and the next try truncates it',async t=>{
  // GPT 2차 검수 GA2: with a reader open, wal_checkpoint(TRUNCATE) returns busy instead of waiting.
  const f=await fixture(t),admin=f.users.admin,row=await collected(f);
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});
  const readerDb=new DatabaseSync(join(f.store.directory,'company.sqlite'),{readOnly:true});readerDb.exec('BEGIN');readerDb.prepare("SELECT COUNT(*) AS n FROM documents").get();
  try{
    assert.equal(f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}).erased.wal,'pending');
    assert.ok(statSync(join(f.store.directory,'company.sqlite-wal')).size>0,'the WAL still holds frames while the reader is open');
  }finally{readerDb.exec('COMMIT');readerDb.close();}
  for(let i=0;i<40&&statSync(join(f.store.directory,'company.sqlite-wal')).size>0;i++)await new Promise(done=>setTimeout(done,25));
  assert.equal(statSync(join(f.store.directory,'company.sqlite-wal')).size,0,'the retry truncates the WAL once the reader is gone');
  assert.equal(f.store.db.prepare('PRAGMA busy_timeout').get().timeout,5000);
});

test('a new erase starts the WAL retries again from the shortest wait',async t=>{
  // 아르곤 델타 검수 A1 · 마지막 델타의 아르곤 A1·GPT GA1: after the waits reached a long one, a new busy erase must not
  // leave the next try that far away. Here the second wait is a minute, so only a restart truncates within the test.
  const f=await fixture(t),admin=f.users.admin,wal=()=>statSync(join(f.store.directory,'company.sqlite-wal')).size;
  f.items=[sample(),sample({responseId:'synthetic-response-9',createdAt:'2026-10-20T01:30:00.000Z',submittedAt:'2026-10-20T01:30:00.000Z'})];
  await f.enable();await f.service.tick({force:true});
  const service=createWebsiteInquiryService({store:f.store,reader:f.reader,tasks:f.tasks,origin:'https://workspace.example.test',clock:()=>'2026-10-20T02:00:00.000Z',walRetryMs:[30,60000]});
  t.after(()=>service.close());
  const [first,second]=service.workspace(admin).items;
  const tokens=[];for(const row of [first,second])tokens.push((await service.checkErase(admin,row.id,{revision:row.revision})).erasure.token);
  const readerDb=new DatabaseSync(join(f.store.directory,'company.sqlite'),{readOnly:true});readerDb.exec('BEGIN');readerDb.prepare('SELECT COUNT(*) AS n FROM documents').get();
  try{
    assert.equal(service.erase(admin,first.id,{revision:first.revision,token:tokens[0]}).erased.wal,'pending');
    await new Promise(done=>setTimeout(done,150));assert.ok(wal()>0,'the first try failed and the next one is a minute away');
    assert.equal(service.erase(admin,second.id,{revision:second.revision,token:tokens[1]}).erased.wal,'pending');
  }finally{readerDb.exec('COMMIT');readerDb.close();}
  for(let i=0;i<40&&wal()>0;i++)await new Promise(done=>setTimeout(done,25));
  assert.equal(wal(),0,'the later erase started the waits again from the shortest');
});

test('a reader that outlasts every listed wait still gets the WAL truncated once it closes, with no other erase',async t=>{
  // GPT 델타 검수 GA1: past the last listed wait the tries used to stop for good.
  const f=await fixture(t),admin=f.users.admin,row=await collected(f),wal=()=>statSync(join(f.store.directory,'company.sqlite-wal')).size;
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});
  const readerDb=new DatabaseSync(join(f.store.directory,'company.sqlite'),{readOnly:true});readerDb.exec('BEGIN');readerDb.prepare('SELECT COUNT(*) AS n FROM documents').get();
  try{
    assert.equal(f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}).erased.wal,'pending');
    await new Promise(done=>setTimeout(done,300));assert.ok(wal()>0,'the reader outlasted the three listed waits');
  }finally{readerDb.exec('COMMIT');readerDb.close();}
  for(let i=0;i<40&&wal()>0;i++)await new Promise(done=>setTimeout(done,25));
  assert.equal(wal(),0,'it keeps trying at the last wait until the reader is gone');
  await f.service.close();await new Promise(done=>setTimeout(done,80));assert.equal(f.store.db.prepare('PRAGMA busy_timeout').get().timeout,5000);
});

test('an erased response never comes back — next run, full re-read or edit — while a new response from the same person does',async t=>{
  const f=await fixture(t),row=await collected(f),admin=f.users.admin;
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token});
  f.at='2026-10-20T02:10:00.000Z';await f.service.tick({force:true});assert.equal(f.store.count('websiteInquiries'),0);
  const state=f.store.get('settings','websiteInquiryState');f.store.put('settings','websiteInquiryState',{...state,watermark:null,continuation:null});
  f.items=[sample({message:'SYNTHETIC_UPDATED_CONTENT',submittedAt:'2026-10-20T02:09:00.000Z'})];
  f.at='2026-10-20T02:20:00.000Z';const run=await f.service.tick({force:true});assert.equal(run.completed,true);
  assert.equal(f.store.count('websiteInquiries'),0,'a full re-read of the edited response is blocked');assert.equal(f.counts().messages,0,'and no task is made again');
  f.items=[sample({message:'SYNTHETIC_UPDATED_CONTENT',submittedAt:'2026-10-20T02:09:00.000Z'}),sample({responseId:'synthetic-response-2',createdAt:'2026-10-20T02:15:00.000Z',submittedAt:'2026-10-20T02:15:00.000Z'})];
  f.at='2026-10-20T02:30:00.000Z';await f.service.tick({force:true});
  const items=f.service.workspace(admin).items;assert.equal(items.length,1);assert.notEqual(items[0].id,row.id);assert.equal(items[0].task.state,'linked');assert.equal(f.counts().message_tasks,1);
});

test('the confirmation fits one admin, one revision and ten minutes',async t=>{
  const f=await fixture(t),row=await collected(f),admin=f.users.admin,second={id:'admin-2',role:'admin',name:'합성 관리자 2',active:true};f.store.put('users',second.id,second);
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});
  assert.throws(()=>f.service.erase(second,row.id,{revision:row.revision,token:erasure.token}),{code:'INQUIRY_ERASE_CONFIRM'},'another admin needs a confirmation of their own');
  f.at='2026-10-20T02:10:00.000Z';assert.throws(()=>f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}),{code:'INQUIRY_ERASE_CONFIRM'},'ten minutes later it has run out');
  f.at='2026-10-20T02:11:00.000Z';const fresh=(await f.service.checkErase(admin,row.id,{revision:row.revision})).erasure;
  const edited=f.service.update(admin,row.id,{revision:row.revision,status:'reviewing'}).item;
  assert.throws(()=>f.service.erase(admin,row.id,{revision:edited.revision,token:fresh.token}),{code:'INQUIRY_ERASE_CONFIRM'},'a token for the earlier revision does not fit the new one');
  assert.throws(()=>f.service.erase(admin,row.id,{revision:row.revision,token:fresh.token}),{code:'INQUIRY_REVISION'});
  await assert.rejects(f.service.checkErase(admin,row.id,{revision:row.revision}),{code:'INQUIRY_REVISION'});
  await assert.rejects(f.service.checkErase(admin,row.id,{revision:edited.revision,token:fresh.token}),{code:'INQUIRY_REVISION'},'the check takes the revision only');
  await assert.rejects(f.service.checkErase(f.users.other,row.id,{revision:edited.revision}),{status:403});assert.equal(f.googleCalls.length,2,'a member never reaches Google');
  // Authority is checked again after the Google await: a revoked admin gets no token.
  f.googleHook=()=>f.store.put('users','admin',{...admin,role:'viewer'});
  await assert.rejects(f.service.checkErase(admin,row.id,{revision:edited.revision}),{status:403});
});

test('a Google check that fails shows unknown and never blocks; a test response erases with no task',async t=>{
  const f=await fixture(t);f.items=[sample({message:'[SYNK 기능 점검 · 실제 문의 아님] SYNTHETIC_PRIVATE_CONTENT'})];const row=await collected(f),admin=f.users.admin;
  assert.equal(row.task,null);f.googleHook=()=>{throw Object.assign(new Error('synthetic provider failure'),{code:'FORMS_UNAVAILABLE',status:503});};
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});assert.equal(erasure.google,'unknown');assert.equal(erasure.task,null);assert.equal(erasure.isTest,true);
  f.googleHook=null;f.google='deleted';assert.equal((await f.service.checkErase(admin,row.id,{revision:row.revision})).erasure.google,'deleted');
  f.google='something else';assert.equal((await f.service.checkErase(admin,row.id,{revision:row.revision})).erasure.google,'unknown');
  assert.deepEqual(f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}).erased.task,'none');assert.equal(f.store.count('websiteInquiries'),0);
  const controller=new AbortController();f.googleHook=()=>controller.abort();f.items=[sample({responseId:'synthetic-response-3'})];await f.service.tick({force:true});
  const next=f.service.workspace(admin).items[0];
  await assert.rejects(f.service.checkErase(admin,next.id,{revision:next.revision},{signal:controller.signal}),{name:'AbortError'},'a cancelled request gets no token');
});

test('a task that cannot be taken back keeps the inquiry whole; a pending task goes; a closed room does not block',async t=>{
  const f=await fixture(t),row=await collected(f),admin=f.users.admin;
  const {erasure}=await f.service.checkErase(admin,row.id,{revision:row.revision});
  f.removeHook=()=>{throw Object.assign(new Error('synthetic messenger fault'),{status:500});};
  assert.throws(()=>f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}),{code:'INQUIRY_TASK_REMOVE',status:502});
  f.removeHook=()=>{throw Object.assign(new Error('synthetic result message'),{status:409});};
  assert.throws(()=>f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}),{code:'INQUIRY_TASK_REMOVE',status:409});
  assert.equal(f.store.count('websiteInquiries'),1);assert.equal(f.store.count(ERASED),0);assert.equal(f.counts().message_tasks,1);
  // The task goes, then the row's transaction fails: the row stays, marked so the screen shows no dead task link.
  f.removeHook=null;f.store.db.exec('PRAGMA secure_delete=OFF');const transaction=f.store.transaction;f.store.transaction=()=>{throw Object.assign(new Error('synthetic disk fault'),{code:'ERR_SQLITE_ERROR'});};
  try{assert.throws(()=>f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}),{message:'synthetic disk fault'});}finally{f.store.transaction=transaction;}
  assert.equal(f.counts().message_tasks,0);assert.equal(f.service.get(admin,row.id).task.state,'unavailable');assert.equal(f.store.count(ERASED),0);
  assert.equal(f.store.db.prepare('PRAGMA secure_delete').get().secure_delete,0,'secure_delete is put back after a failure too');
  assert.equal(f.service.erase(admin,row.id,{revision:row.revision,token:erasure.token}).erased.task,'none','the same confirmation finishes the row');
  assert.equal(f.store.count('websiteInquiries'),0);
  // A task whose link was lost after the messenger stored it is found by its receipt.
  f.taskHook=()=>{throw new Error('synthetic response lost');};f.items=[sample({responseId:'synthetic-response-4'})];
  await assert.rejects(f.service.tick({force:true}));f.taskHook=null;
  const pending=f.store.all('websiteInquiries')[0];assert.equal(pending.task.state,'pending');assert.equal(f.counts().message_tasks,1);
  let removed;f.removeHook=(u,input)=>{removed=input;};
  const check=(await f.service.checkErase(admin,pending.id,{revision:pending.revision})).erasure;assert.equal(check.task,'pending');
  assert.equal(f.service.erase(admin,pending.id,{revision:pending.revision,token:check.token}).erased.task,'removed');assert.equal(f.counts().message_tasks,0);
  assert.deepEqual(Object.keys(removed),['requestId'],'a pending task is looked up by its receipt alone');
  // Another admin erases a row whose task sits in the personal room of an admin who has left.
  f.removeHook=null;f.items=[sample({responseId:'synthetic-response-5'})];f.at='2026-10-20T02:30:00.000Z';await f.service.tick({force:true});
  const last=f.service.workspace(admin).items[0],second={id:'admin-2',role:'admin',name:'합성 관리자 2',active:true};f.store.put('users',second.id,second);
  const token=(await f.service.checkErase(second,last.id,{revision:last.revision})).erasure.token;f.store.put('users','admin',{...admin,active:false});
  assert.equal((await f.service.checkErase(second,last.id,{revision:last.revision})).erasure.task,'unreachable','the check says the task stays');
  assert.equal(f.service.erase(second,last.id,{revision:last.revision,token}).erased.task,'unreachable');assert.equal(f.store.count('websiteInquiries'),0);assert.equal(f.counts().message_tasks,1,'that room keeps its link-only message');
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
test('the erase check asks Google about one response by its id field only, and a 404 after the form opens means deleted',async()=>{
  const f=googleFixture({hook:async url=>{const path=new URL(url).pathname;
    if(path.endsWith('/responses/gone'))return new Response('{"error":{"status":"NOT_FOUND"}}',{status:404});
    if(path.endsWith('/responses/kept'))return Response.json({responseId:'kept'});
    if(path.endsWith('/responses/other'))return Response.json({responseId:'different'});return null;}});
  assert.equal(await f.reader.responseState({responseId:'kept'}),'present');
  const probe=f.calls.find(call=>call.url.includes('/responses/kept'));assert.equal(new URL(probe.url).searchParams.get('fields'),'responseId');
  assert.equal(await f.reader.responseState({responseId:'gone'}),'deleted');
  await assert.rejects(f.reader.responseState({responseId:'other'}),{code:'FORMS_RESPONSE_INVALID'});
  const before=f.calls.length;await assert.rejects(f.reader.responseState({responseId:'../x'}),{code:'FORMS_RESPONSE_INVALID'});assert.equal(f.calls.length,before);
  const missing=googleFixture({hook:async url=>new URL(url).hostname==='forms.googleapis.com'?new Response('{}',{status:404}):null});
  await assert.rejects(missing.reader.responseState({responseId:'kept'}),{code:'FORMS_NOT_FOUND'},'a form that does not open is not a deleted response');
  assert.equal(missing.calls.some(call=>call.url.includes('/responses/')),false);
  const denied=googleFixture({hook:async url=>url.includes('/responses/')?new Response('private provider error',{status:403}):null});
  await assert.rejects(denied.reader.responseState({responseId:'kept'}),error=>error.code==='FORMS_AUTH_REQUIRED'&&!error.message.includes('private'));
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
   "이전 문의 유형이에요. 원문에서 강의 · 컨설팅 · 브랜딩 가운데 어떤 요청인지 먼저 확인해요."
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
