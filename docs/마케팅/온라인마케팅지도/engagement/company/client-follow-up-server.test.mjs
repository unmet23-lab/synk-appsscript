import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {Store} from './store.mjs';
import {backupWorkspace} from './workspace-backup.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';

async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'synk-follow-up-http-')),directory=join(root,'source');
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,clock:()=> '2026-10-11T03:00:00.000Z'});
  const address=await app.start(),base='http://127.0.0.1:'+address.port,users={},tokens={};let stopped=false;
  const stop=async()=>{if(!stopped){stopped=true;await app.stop();}};
  t.after(async()=>{await stop();assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});});
  for(const [name,role,teamId] of [['owner','member','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]]){
    users[name]=app.store.createUser({name,email:name+'@follow-up.example.test',role,teamId});
    tokens[name]=app.store.mint('session',users[name].id,{csrfToken:'follow-up-test'},10);
  }
  async function request(path,{body,user='owner',headers={}}={}){
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(user?{Cookie:'synk_company_session='+tokens[user]}:{}),...(body===undefined?{}:{Origin:app.origin,'X-CSRF-Token':'follow-up-test','Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();return {status:response.status,data,headers:response.headers};
  }
  const created=await request('/api/client-projects',{body:{title:'합성 후속 연락',customerName:'합성 고객',nextStep:'시안 일정 확인',nextContactDate:'2026-10-10'}});assert.equal(created.status,201);
  return {root,directory,app,users,request,stop,row:created.data.project};
}

test('follow-up HTTP uses current staff rights, CSRF and one revision for simultaneous completion',async t=>{
  const f=await fixture(t),url='/api/client-projects/'+f.row.id+'/follow-up',body={revision:f.row.revision,note:'내부 연락 결과',disposition:'done'};
  for(const [user,status] of [[null,403],['viewer',403],['other',404]])assert.equal((await f.request(url,{body,user})).status,status);
  for(const headers of [{Origin:'https://outside.example'},{'X-CSRF-Token':'invalid'},{Origin:''}])assert.equal((await f.request(url,{body,headers})).status,403);
  assert.equal((await f.request('/api/client-workflow')).data.items.filter(x=>x.kind==='follow_up').length,1);
  const results=await Promise.all([f.request(url,{body}),f.request(url,{body})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const row=f.app.store.get('clientProjects',f.row.id);assert.equal(row.followUpHistory.length,1);assert.equal(row.nextContactDate,'');assert.equal(row.nextStep,'시안 일정 확인');
  assert.equal((await f.request('/api/client-workflow')).data.items.filter(x=>x.kind==='follow_up').length,0);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.request(url,{body})).status,403);
});

test('rescheduling keeps the customer next step and never returns internal contact notes in the lounge',async t=>{
  const f=await fixture(t),invite=await f.request('/api/client-projects/'+f.row.id+'/invite',{body:{revision:f.row.revision}});
  const opened=await f.request('/pulse/api/open',{user:null,body:{invite:invite.data.invite}});assert.equal(opened.status,200);
  const row=f.app.store.get('clientProjects',f.row.id),url='/api/client-projects/'+row.id+'/follow-up';
  assert.equal((await f.request(url,{body:{revision:row.revision,note:'PRIVATE-FOLLOW-UP',disposition:'schedule',nextContactDate:'2026-10-12'}})).status,200);
  const customer=await f.request('/pulse/api/project',{user:null,headers:{Cookie:opened.headers.get('set-cookie').split(';')[0]}});
  assert.equal(customer.status,200);assert.doesNotMatch(JSON.stringify(customer.data),/PRIVATE-FOLLOW-UP|followUpHistory|nextContactDate/);assert.equal(customer.data.project.nextStep,'시안 일정 확인');
  assert.equal((await f.request('/api/client-workflow')).data.items.filter(x=>x.kind==='follow_up').length,0);
  const current=f.app.store.get('clientProjects',row.id);assert.equal(current.followUpHistory[0].nextContactDate,'2026-10-12');assert.equal(current.followUpHistory[0].actor,f.users.owner.id);
});

test('saved follow-up history survives real workspace backup and its next date becomes due after restart',async t=>{
  const f=await fixture(t),result=await f.request('/api/client-projects/'+f.row.id+'/follow-up',{body:{revision:f.row.revision,note:'백업할 내부 연락 결과',disposition:'schedule',nextContactDate:'2026-10-12'}});assert.equal(result.status,200);
  const expected=f.app.store.get('clientProjects',f.row.id);await f.stop();
  const backup=await backupWorkspace({destination:join(f.root,'backup'),companyDataDir:f.directory,messengerDataDir:join(f.directory,'messenger')});
  assert.ok(resolve(backup).startsWith(resolve(f.root)+ '/'.replace('/',process.platform==='win32'?'\\':'/')));
  const restored=new Store(join(backup,'company'));
  try{
    assert.deepEqual(restored.get('clientProjects',f.row.id),expected);
    const projects=createClientProjectsService({store:restored}),workflow=createClientWorkflowService({store:restored,clientProjects:projects,clock:()=> '2026-10-11T15:00:00.000Z'});
    const tasks=workflow.workspace(f.users.owner).items.filter(x=>x.kind==='follow_up');assert.equal(tasks.length,1);assert.equal(tasks[0].dueDate,'2026-10-12');assert.match(tasks[0].href,/followUp=1/);
  }finally{restored.close();}
});
