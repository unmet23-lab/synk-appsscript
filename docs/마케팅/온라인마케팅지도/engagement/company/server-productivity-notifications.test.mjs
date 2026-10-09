import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-productivity-notifications-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false});
  const address=await app.start(),base='http://127.0.0.1:'+address.port,users={},tokens={};
  for(const [name,role,teamId]of [['owner','member','team-a'],['next','member','team-a'],['reviewer','member','team-a'],['other','member','team-b'],['admin','admin',null]]){users[name]=app.store.createUser({name,email:name+'@notifications.example.test',role,teamId});tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'test-csrf'},10);}
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  async function request(path,{body,user='owner',customer,method=body===undefined?'GET':'POST',status=200,headers={}}={}){
    const response=await fetch(base+path,{method,headers:{Cookie:customer?.cookie??(user?'synk_company_session='+tokens[user]:''),...(body===undefined?{}:{Origin:app.origin,'Content-Type':'application/json',...(customer?{'X-Pulse-CSRF':customer.csrf}:{'X-CSRF-Token':'test-csrf'})}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();assert.equal(response.status,status,method+' '+path+' '+JSON.stringify(data));return {data,response};
  }
  const draft={title:'알림 통합 시험',customerName:'합성 고객',summary:'시안 검토',internalNotes:'PRIVATE INTERNAL'};
  let project=(await request('/api/client-projects',{body:{...draft,reviewerId:users.reviewer.id},status:201})).data.project;
  const invitation=(await request(`/api/client-projects/${project.id}/invite`,{body:{revision:project.revision}})).data;
  const opened=await request('/pulse/api/open',{user:null,body:{invite:invitation.invite}}),customer={cookie:opened.response.headers.get('set-cookie').split(';')[0],csrf:opened.data.csrf};
  const current=async()=> (await request('/api/client-projects')).data.projects.find(p=>p.id===project.id);
  const version=async(label)=>{project=await current();project=(await request(`/api/client-projects/${project.id}/versions`,{body:{revision:project.revision,kind:'preview',label,url:'https://files.example.test/'+label}})).data.project;return project.versions.at(-1);};
  const action=async(action,extra={})=>{project=await current();return request('/pulse/api/action',{customer,body:{revision:project.revision,action,...extra}});};
  async function events(user){const abort=new AbortController(),response=await fetch(base+'/messenger/api/events',{headers:{Cookie:'synk_company_session='+tokens[user]},signal:abort.signal});assert.equal(response.status,200);const reader=response.body.getReader(),decoder=new TextDecoder();let text='';t.after(()=>abort.abort());return {abort,async until(predicate){const timer=setTimeout(()=>abort.abort(),5000);try{while(!predicate(text)){const row=await reader.read();assert.equal(row.done,false);text+=decoder.decode(row.value);}return text;}finally{clearTimeout(timer);}}};}
  return {app,base,users,tokens,request,customer,draft,current,version,action,events,projectId:project.id};
}

test('customer feedback and approval reach the existing messenger inbox and live stream without creating chat messages',async t=>{
  const f=await fixture(t),v1=await f.version('v1'),boot=(await f.request('/messenger/api/bootstrap')).data;
  const initial=(await f.request('/messenger/api/notifications')).data.items;
  const stream=await f.events('owner');await stream.until(text=>text.includes(': connected'));
  const received=await f.action('feedback',{versionId:v1.id,text:'12초 장면 수정',seconds:12});
  assert.doesNotMatch(JSON.stringify(received.data),/PRIVATE INTERNAL|notificationReads|notificationEvents/);
  const signal=await stream.until(text=>text.includes('"type":"notification"'));assert.doesNotMatch(signal,/12초|합성 고객|PRIVATE INTERNAL/);stream.abort.abort();
  const after=(await f.request('/messenger/api/notifications')).data;
  const notice=after.items.find(row=>row.kind==='client_workflow'&&!initial.some(old=>old.id===row.id)&&new URL(row.href,f.base).searchParams.get('seconds')==='12');
  assert.ok(notice,'Customer scene request reaches owner inbox');assert.match(notice.id,/^client:/);assert.equal(notice.message,null);
  assert.equal((await f.request('/messenger/api/bootstrap')).data.notificationUnread,after.unreadCount);
  assert.equal((await f.request('/messenger/api/notifications',{user:'other'})).data.items.some(row=>row.id===notice.id),false);
  const beforeRead=await f.current();await f.request(`/messenger/api/notifications/${encodeURIComponent(notice.id)}/read`,{body:{}});
  assert.deepEqual(await f.current(),beforeRead,'Reading an alert never accepts or completes a customer request');
  assert.ok((await f.request('/messenger/api/notifications')).data.items.find(row=>row.id===notice.id).readAt);
  const work=(await f.request('/api/client-workflow')).data.items.find(row=>row.kind==='feedback');
  await f.request('/api/client-workflow',{body:{projectId:f.projectId,messageId:work.messageId,action:'start',revision:beforeRead.revision}});
  const v2=await f.version('v2');let project=await f.current();
  await f.request('/api/client-workflow',{body:{projectId:f.projectId,messageId:work.messageId,action:'submit_review',versionId:v2.id,revision:project.revision}});
  project=await f.current();await f.request('/api/client-workflow',{user:'reviewer',body:{projectId:f.projectId,messageId:work.messageId,action:'accept',revision:project.revision}});
  const oldIds=new Set((await f.request('/messenger/api/notifications')).data.items.map(row=>row.id));await f.action('approve',{versionId:v2.id});
  const approved=(await f.request('/messenger/api/notifications')).data.items.filter(row=>row.kind==='client_workflow'&&!oldIds.has(row.id));
  assert.ok(approved.some(row=>new URL(row.href,f.base).searchParams.get('version')===v2.id));
  assert.equal(f.app.messenger.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,0);
  assert.equal((await f.request('/messenger/api/bootstrap')).data.user.id,boot.user.id);
});

test('customer notification reads enforce current recipient, CSRF, reassignment and inactive sessions',async t=>{
  const f=await fixture(t),v=await f.version('v1');await f.action('feedback',{versionId:v.id,text:'권한 시험'});
  const notice=(await f.request('/messenger/api/notifications')).data.items.find(row=>row.kind==='client_workflow');assert.ok(notice);
  await f.request(`/messenger/api/notifications/${encodeURIComponent(notice.id)}/read`,{body:{},headers:{'X-CSRF-Token':'wrong'},status:403});
  await f.request(`/messenger/api/notifications/${encodeURIComponent(notice.id)}/read`,{user:'other',body:{},status:404});
  const prior=await f.current();await f.request(`/api/client-projects/${f.projectId}`,{user:'admin',body:{...f.draft,revision:prior.revision,ownerId:f.users.next.id,reviewerId:f.users.reviewer.id}});
  assert.equal((await f.request('/messenger/api/notifications')).data.items.some(row=>row.id===notice.id),false);
  const next=(await f.request('/messenger/api/notifications',{user:'next'})).data.items;assert.ok(next.some(row=>row.kind==='client_workflow'));
  await f.request(`/messenger/api/notifications/${encodeURIComponent(notice.id)}/read`,{body:{},status:404});
  await f.request('/messenger/api/notifications/read-all',{user:'next',body:{}});assert.equal((await f.request('/messenger/api/notifications',{user:'next'})).data.unreadCount,0);
  f.app.store.put('users',f.users.next.id,{...f.users.next,active:false});await f.request('/messenger/api/notifications',{user:'next',status:401});
});
