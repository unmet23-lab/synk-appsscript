import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'synk-inquiry-http-'));
  let readHook=null,message='SYNTHETIC_HTTP_PRIVATE';
  const reader={configured:()=>true,verify:async()=>({connected:true,verifiedAt:new Date().toISOString()}),async readPage(){
    await readHook?.();return {items:[{responseId:'synthetic-http-response',email:'synthetic@example.test',type:'LAB · 한국어 교육',
      message,consent:'위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.',
      createdAt:'2026-10-20T01:00:00Z',submittedAt:'2026-10-20T01:00:00Z'}],nextPageToken:null};
  },responseState:async()=>'deleted'};
  const app=createCompanyApp({dataDir:root,port:0,allowTestHost:true,schedule:false,websiteInquiryReader:reader});
  const address=await app.start(),base='http://127.0.0.1:'+address.port,users={},tokens={};
  for(const [name,role]of[['admin','admin'],['member','member'],['viewer','viewer']]){
    users[name]=app.store.createUser({name:'합성 '+name,email:name+'@inquiry.example.test',role});
    tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'synthetic-csrf'},10);
  }
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});});
  async function request(path,{body,user='admin',headers={}}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{
      ...(user?{Cookie:'synk_company_session='+tokens[user]}:{}),
      ...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'synthetic-csrf','Content-Type':'application/json'}),...headers},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  }
  return {app,users,request,base,set readHook(value){readHook=value;},set message(value){message=value;}};
}
test('existing inbox route exposes registration metadata and email-free totals only to the current admin',async t=>{
  const f=await fixture(t);f.message='[TOPIK 4급 온라인 반 관심 등록]\n이름: 합성\n지금 급수: 3급\n4급이 필요한 때: 내년\n토요일 시간: 오후\n들어온 곳: http-test · 화면 언어 한국어';
  await f.request('/api/website-inquiries/configure',{body:{enabled:true,revision:0}});await f.request('/api/website-inquiries/collect',{body:{}});
  const {data,status}=await f.request('/api/website-inquiries');assert.equal(status,200);assert.equal(data.items[0].registration.productId,'topik4');assert.equal(data.items[0].task,null);
  assert.equal(data.registrations.products[0].uniqueEmails,1);assert.doesNotMatch(JSON.stringify(data.registrations),/synthetic@example|합성/);
  for(const user of ['member','viewer'])assert.equal((await f.request('/api/website-inquiries',{user})).status,403);
  f.app.store.put('users',f.users.admin.id,{...f.users.admin,role:'member'});
  assert.equal((await f.request('/api/website-inquiries')).status,403,'existing session loses access after role revocation');
});
test('company HTTP routes enforce admin, CSRF and live sessions while collection links a single task',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/website-inquiries',{user:null})).status,401);
  for(const user of ['member','viewer'])assert.equal((await f.request('/api/website-inquiries',{user})).status,403);
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://external.example.test'}])
    assert.equal((await f.request('/api/website-inquiries/configure',{body:{enabled:true,revision:0},headers})).status,403);
  const enabled=await f.request('/api/website-inquiries/configure',{body:{enabled:true,revision:0}});assert.equal(enabled.status,200);
  assert.equal((await f.request('/api/website-inquiries/collect',{body:{}})).status,200);
  assert.equal((await f.request('/api/website-inquiries/collect',{body:{}})).status,200);
  const inbox=await f.request('/api/website-inquiries');assert.equal(inbox.status,200);assert.equal(inbox.data.items.length,1);
  const row=inbox.data.items[0];assert.equal(row.task.state,'linked');
  const saved=await f.request('/api/website-inquiries/'+row.id,{body:{revision:row.revision,replyDraft:'검토한 합성 답변',status:'reviewing'}});
  assert.equal(saved.status,200);assert.equal(saved.data.item.status,'reviewing');
  assert.equal((await f.request('/api/website-inquiries/'+row.id,{user:'member'})).status,403);
  const html=await (await fetch(f.base+'/')).text();assert.match(html,/website-inquiries.js/);assert.match(html,/website-inquiries.css/);
  assert.equal((await fetch(f.base+'/website-inquiries.js')).status,200);
});
test('HTTP erase is admin-only, needs its check first, audits the row number and the time, and keeps the response out',async t=>{
  const f=await fixture(t),PRIVATE=/SYNTHETIC_HTTP_PRIVATE|synthetic@example|synthetic-http-response/,tasks=()=>f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM message_tasks').get().n;
  await f.request('/api/website-inquiries/configure',{body:{enabled:true,revision:0}});await f.request('/api/website-inquiries/collect',{body:{}});
  const row=(await f.request('/api/website-inquiries')).data.items[0],base='/api/website-inquiries/'+row.id;assert.equal(tasks(),1);
  for(const user of ['member','viewer'])assert.equal((await f.request(base+'/erase-check',{body:{revision:row.revision},user})).status,403);
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://external.example.test'}])assert.equal((await f.request(base+'/erase-check',{body:{revision:row.revision},headers})).status,403);
  assert.equal((await f.request(base+'/erase',{body:{revision:row.revision}})).status,409,'no check, no erasure');
  const check=await f.request(base+'/erase-check',{body:{revision:row.revision}});assert.equal(check.status,200);
  assert.equal(check.data.erasure.google,'deleted');assert.equal(check.data.erasure.task,'linked');assert.doesNotMatch(JSON.stringify(check.data),PRIVATE);
  const confirm={revision:row.revision,token:check.data.erasure.token};
  assert.equal((await f.request(base+'/erase',{body:confirm,user:'member'})).status,403);assert.equal((await f.request(base+'/erase',{body:confirm,headers:{'X-CSRF-Token':'bad'}})).status,403);
  assert.equal(f.app.store.count('websiteInquiries'),1);
  const erased=await f.request(base+'/erase',{body:confirm});assert.equal(erased.status,200);assert.equal(erased.data.erased.task,'removed');assert.equal(tasks(),0);
  const audit=()=>f.app.store.all('audit').filter(entry=>entry.action==='website-inquiry-erased');
  assert.equal(audit().length,1);assert.deepEqual(Object.keys(audit()[0]).sort(),['action','at','id','subject','userId']);assert.equal(audit()[0].subject,row.id);assert.equal(audit()[0].userId,f.users.admin.id);
  assert.equal((await f.request(base+'/erase',{body:confirm})).data.erased.repeated,true);assert.equal(audit().length,1,'a repeat is not a second erasure');
  assert.equal((await f.request('/api/website-inquiries/collect',{body:{}})).status,200);
  assert.equal((await f.request('/api/website-inquiries')).data.items.length,0,'the next collection does not bring it back');assert.equal((await f.request(base)).status,404);
  assert.doesNotMatch(JSON.stringify(f.app.store.db.prepare("SELECT kind,body FROM documents WHERE kind<>'users'").all()),PRIVATE);
});
test('HTTP revocation during Google read rejects the response and stores no customer data',async t=>{
  const f=await fixture(t);await f.request('/api/website-inquiries/configure',{body:{enabled:true,revision:0}});
  f.readHook=()=>f.app.store.put('users',f.users.admin.id,{...f.users.admin,role:'viewer'});
  const result=await f.request('/api/website-inquiries/collect',{body:{}});
  assert.equal(result.status,403);assert.equal(f.app.store.count('websiteInquiries'),0);assert.doesNotMatch(JSON.stringify(result.data),/SYNTHETIC_HTTP_PRIVATE/);
});
