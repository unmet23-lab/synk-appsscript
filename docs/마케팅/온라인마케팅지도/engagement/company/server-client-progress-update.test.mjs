import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-progress-api-')),app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=> '2026-10-12T01:00:00.000Z'});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-progress-api-'));await rm(directory,{recursive:true,force:true});});
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@progress-api.test',role:name==='viewer'?'viewer':'member',teamId:name==='other'?'b':'a'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'progress-api'},30);}
  const project=app.clientProjects.save(users.owner,{title:'진행 안내 API 합성 프로젝트',customerName:'합성 고객',dueDate:'2026-11-10',internalNotes:'PRIVATE-API-MEMO'}).project;
  const read=()=>app.store.get('clientProjects',project.id),path=`/api/client-projects/${project.id}/progress-update`;
  async function api(name,method='GET',headers={}){const response=await fetch(base+path,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(method==='POST'?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'progress-api'}:{}),...headers},...(method==='POST'?{body:'{}'}:{})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,data,headers:response.headers};}
  return {app,api,users,read,id:project.id,path};
}

test('HTTP progress text is fresh, no-store and read-only for project owners and same-team viewers',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read()),response=await f.api('owner');assert.equal(response.status,200);assert.equal(response.data.projectId,f.id);assert.equal(response.data.revision,f.read().revision);assert.match(response.headers.get('cache-control'),/no-store/);assert.doesNotMatch(JSON.stringify(response.data),/PRIVATE/);assert.equal(response.data.sections.length,4);
  assert.equal((await f.api('viewer')).status,200);assert.equal(JSON.stringify(f.read()),before);assert.deepEqual(f.app.store.all('clientProgressUpdates'),[]);
  f.app.clientProjects.message(f.users.owner,f.id,{revision:f.read().revision,text:'PRIVATE-NEW-MEMO',visibility:'internal'});const next=await f.api('owner');assert.equal(next.data.revision,response.data.revision+1);assert.equal(next.data.text,response.data.text);
});

test('HTTP current identity, team access and deleted project are rechecked on every generation',async t=>{
  const f=await fixture(t);assert.equal((await f.api(null)).status,401);assert.equal((await f.api('other')).status,404);
  f.app.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'other'});assert.equal((await f.api('viewer')).status,404);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.api('owner')).status,401);f.app.store.put('users',f.users.owner.id,f.users.owner);
  f.app.store.remove('clientProjects',f.id);assert.equal((await f.api('owner')).status,404);
});

test('customer PULSE sessions and invitation tokens cannot access the staff generation route',async t=>{
  const f=await fixture(t),invitation=f.app.clientProjects.invite(f.users.owner,f.id,{revision:f.read().revision}),customer=f.app.clientProjects.open(invitation.invite),before=JSON.stringify(f.read());
  assert.equal((await f.api(null,'GET',{Cookie:'synk_pulse_session='+customer.session})).status,401);assert.equal((await f.api(null,'GET',{Cookie:'synk_company_session='+customer.session})).status,401);assert.equal((await f.api(null,'GET',{Authorization:'Bearer '+invitation.invite})).status,401);assert.equal(JSON.stringify(f.read()),before);
});

test('progress preparation adds no POST mutation or outbound customer message',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read()),response=await f.api('owner','POST');assert.notEqual(response.status,200);assert.equal(JSON.stringify(f.read()),before);assert.equal(f.read().messages.length,0);
});
