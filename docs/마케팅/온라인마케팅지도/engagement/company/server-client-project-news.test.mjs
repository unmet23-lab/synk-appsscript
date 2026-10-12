import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {request} from 'node:http';
import {createCompanyApp} from './server.mjs';

const csrf='project-news-test';
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-project-news-api-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=> '2026-10-12T01:00:00.000Z'});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-project-news-api-'));await rm(directory,{recursive:true,force:true});});
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@project-news.test',role:name==='viewer'?'viewer':'member',teamId:name==='other'?'b':'a'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:csrf},30);}
  const project=app.clientProjects.save(users.owner,{title:'프로젝트 새 소식 API',customerName:'합성 고객',internalNotes:'PRIVATE-PROJECT'}).project,id=project.id,row=()=>app.store.get('clientProjects',id);
  const customer=app.clientProjects.open(app.clientProjects.invite(users.owner,id,{revision:row().revision}).invite);
  app.clientProjects.customerAction(customer.session,customer.csrf,{revision:row().revision,action:'support',text:'새 소식 확인용'});
  const path=`/api/client-projects/${id}/news`;
  async function api(name='owner',{url=path,input,method=input===undefined?'GET':'POST',headers={}}={}){
    const response=await fetch(base+url,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})});return {status:response.status,data:await response.json(),headers:response.headers};
  }
  async function slowRead(input,whileReading){
    const body=JSON.stringify(input),arrived=new Promise(resolve=>app.server.once('request',()=>queueMicrotask(resolve)));
    let req;const result=new Promise((resolve,reject)=>{req=request(base+path+'/read',{method:'POST',headers:{Cookie:'synk_company_session='+sessions.owner,Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf,'Content-Length':Buffer.byteLength(body)}},response=>{let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,data:JSON.parse(text)}));});req.on('error',reject);});
    req.write(body.slice(0,5));await arrived;whileReading();req.end(body.slice(5));return result;
  }
  return {app,users,sessions,api,slowRead,row,id,path,customer};
}

test('project news HTTP GET returns only unread source pointers without changing source or receipts',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.row()),read=await f.api();assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/no-store/);assert.equal(read.data.projectId,f.id);assert.equal(read.data.revision,f.row().revision);assert.equal(read.data.unreadCount,1);assert.equal(read.data.items.length,1);assert.equal(read.data.items[0].body,'새 소식 확인용');assert.doesNotMatch(JSON.stringify(read.data),/PRIVATE-PROJECT/);assert.equal(JSON.stringify(f.row()),before);assert.equal(f.app.store.all('clientNotificationReads').length,0);
  const acknowledged=await f.api('owner',{url:f.path+'/read',input:{id:read.data.items[0].id}});assert.equal(acknowledged.status,200);assert.equal(acknowledged.data.unreadCount,0);assert.equal(JSON.stringify(f.row()),before);assert.equal(f.app.store.all('clientNotificationReads').length,1);
  const legacy=await f.api('owner',{url:'/api/pulse-live'});assert.equal(legacy.data.notifications.find(item=>item.id===read.data.items[0].id).unread,false);
});

test('project news authorization, customer isolation and explicit single-item CSRF are enforced',async t=>{
  const f=await fixture(t),id=(await f.api()).data.items[0].id;
  assert.equal((await f.api(null)).status,401);assert.equal((await f.api('other')).status,404);assert.deepEqual((await f.api('viewer')).data.items,[]);assert.equal((await f.api(null,{headers:{Cookie:'synk_pulse_session='+f.customer.session}})).status,401);
  for(const headers of [{'X-CSRF-Token':'bad'},{Origin:'https://foreign.example'}])assert.equal((await f.api('owner',{url:f.path+'/read',input:{id},headers})).status,403);
  for(const input of [{all:true},{ids:[id]},{id,all:true}])assert.equal((await f.api('owner',{url:f.path+'/read',input})).status,400);
  assert.equal((await f.api('viewer',{url:f.path+'/read',input:{id}})).status,404);assert.equal(f.app.store.all('clientNotificationReads').length,0);
});

test('cross-project read, query parameters and unsupported methods leave all source records intact',async t=>{
  const f=await fixture(t),id=(await f.api()).data.items[0].id,other=f.app.clientProjects.save(f.users.owner,{title:'두 번째 프로젝트',customerName:'합성 고객'}).project,before=JSON.stringify(f.app.store.all('clientProjects'));
  assert.equal((await f.api('owner',{url:`/api/client-projects/${other.id}/news/read`,input:{id}})).status,404);
  assert.equal((await f.api('owner',{url:f.path+'?all=1'})).status,400);assert.equal((await f.api('owner',{url:f.path+'/read?project=other',input:{id}})).status,400);assert.equal((await f.api('owner',{input:{id}})).status,405);assert.equal((await f.api('owner',{url:f.path+'/read'})).status,405);
  assert.equal(JSON.stringify(f.app.store.all('clientProjects')),before);assert.equal(f.app.store.all('clientNotificationReads').length,0);
});

test('read rechecks role and source access after request body arrives',async t=>{
  const f=await fixture(t),id=(await f.api()).data.items[0].id,before=JSON.stringify(f.row());
  const response=await f.slowRead({id},()=>f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'}));assert.equal(response.status,404);assert.equal(f.app.store.all('clientNotificationReads').length,0);assert.equal(JSON.stringify(f.row()),before);
});

test('read rejects a revoked session after the body starts arriving',async t=>{
  const f=await fixture(t),id=(await f.api()).data.items[0].id,before=JSON.stringify(f.row());
  const response=await f.slowRead({id},()=>f.app.store.revokeUser(f.users.owner.id));assert.equal(response.status,401);assert.equal(f.app.store.all('clientNotificationReads').length,0);assert.equal(JSON.stringify(f.row()),before);
});

test('archive and deleted source suppress a previously visible notification without acknowledging it',async t=>{
  const f=await fixture(t),id=(await f.api()).data.items[0].id,row=f.row();f.app.store.put('clientProjects',row.id,{...row,stage:'archived'});assert.deepEqual((await f.api()).data.items,[]);assert.equal((await f.api('owner',{url:f.path+'/read',input:{id}})).status,404);
  f.app.store.remove('clientProjects',row.id);assert.equal((await f.api()).status,404);assert.equal(f.app.store.all('clientNotificationReads').length,0);
});
