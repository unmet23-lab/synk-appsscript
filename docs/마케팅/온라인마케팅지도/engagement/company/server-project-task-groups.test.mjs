import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-project-group-api-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=> '2026-10-12T01:00:00.000Z'});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-project-group-api-'));await rm(directory,{recursive:true,force:true});});
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@groups-api.example',role:name==='viewer'?'viewer':'member'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'groups-api'},30);}
  async function api(name,path,method='GET',input){
    const response=await fetch(base+path,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(input?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'groups-api'}:{})},...(input?{body:JSON.stringify(input)}:{})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  const initial=app.clientProjects.save(users.owner,{title:'그룹 API 합성 프로젝트',customerName:'합성 고객',dueDate:'2026-10-12'}).project;
  const read=()=>app.clientProjects.project(users.owner,initial.id);
  const customer=app.clientProjects.open(app.clientProjects.invite(users.owner,initial.id,{revision:read().revision}).invite);
  app.clientProjects.addVersion(users.owner,initial.id,{revision:read().revision,kind:'preview',label:'그룹 시안',url:'https://example.test/group.mp4'});
  app.clientProjects.customerAction(customer.session,customer.csrf,{revision:read().revision,action:'support',text:'PRIVATE_CUSTOMER_BODY'});
  return {app,api,users,read,id:initial.id};
}
const identity=groups=>groups.map(group=>({projectId:group.projectId,primaryId:group.primary?.id||null,href:group.href,reason:group.reason,urgency:group.urgency,counts:group.counts,items:group.items.map(row=>({id:row.id,href:row.href}))}));

test('both HTTP views share source grouping and links; completing work updates both without creating tasks',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.app.store.get('clientProjects',f.id));
  const workflow=await f.api('owner','/api/client-workflow'),health=await f.api('owner','/api/automation-health');
  assert.equal(workflow.status,200);assert.equal(health.status,200);assert.match(health.headers.get('cache-control'),/no-store/);
  assert.deepEqual(identity(health.data.projectGroups),identity(workflow.data.projectGroups));
  const group=workflow.data.projectGroups[0];assert.equal(group.counts.total,2);assert.equal(group.counts.actionable,1);assert.equal(group.counts.customerWaiting,1);assert.equal(group.primary.kind,'support');
  assert.equal(new URL(group.primary.href,'http://local.test').searchParams.get('message'),group.primary.messageId);
  assert.doesNotMatch(JSON.stringify(health.data),/PRIVATE_CUSTOMER_BODY/);assert.match(JSON.stringify(workflow.data),/PRIVATE_CUSTOMER_BODY/);
  assert.equal(health.data.cards.length,17);assert.ok(health.data.cards.some(card=>card.id==='rights'));assert.ok(health.data.manual.some(row=>row.automationId==='delivery'&&row.waitingFor==='customer'),'Existing manual customer waiting list remains visible');
  assert.equal(JSON.stringify(f.app.store.get('clientProjects',f.id)),before,'Reading either view preserves the source');
  const completed=await f.api('owner','/api/client-workflow','POST',{projectId:f.id,messageId:group.primary.messageId,revision:f.read().revision,action:'complete'});
  assert.equal(completed.status,200);
  const after=(await f.api('owner','/api/client-workflow')).data,afterHealth=(await f.api('owner','/api/automation-health')).data;
  assert.deepEqual(identity(afterHealth.projectGroups),identity(after.projectGroups));assert.equal(after.projectGroups[0].primary,null);assert.equal(after.projectGroups[0].counts.total,1);assert.equal(after.projectGroups[0].urgency,'waiting');
});

test('current permissions apply to both grouped endpoints after ownership, archival and user changes',async t=>{
  const f=await fixture(t);
  for(const path of ['/api/client-workflow','/api/automation-health']){
    assert.equal((await f.api(null,path)).status,401);assert.deepEqual((await f.api('other',path)).data.projectGroups,[]);assert.deepEqual((await f.api('viewer',path)).data.projectGroups,[]);
  }
  const raw=f.app.store.get('clientProjects',f.id);f.app.store.put('clientProjects',f.id,{...raw,ownerId:f.users.other.id});
  for(const path of ['/api/client-workflow','/api/automation-health']){
    assert.doesNotMatch(JSON.stringify((await f.api('owner',path)).data),/그룹 API 합성 프로젝트/);assert.equal((await f.api('other',path)).data.projectGroups.length,1);
  }
  f.app.store.put('clientProjects',f.id,{...raw,ownerId:f.users.other.id,stage:'archived'});
  for(const path of ['/api/client-workflow','/api/automation-health'])assert.deepEqual((await f.api('other',path)).data.projectGroups,[]);
  f.app.store.put('users',f.users.other.id,{...f.users.other,active:false});
  for(const path of ['/api/client-workflow','/api/automation-health'])assert.equal((await f.api('other',path)).status,401);
});

test('an unreadable source is explicit rather than an empty all-clear group, then recovers on the next read',async t=>{
  const f=await fixture(t),all=f.app.store.all.bind(f.app.store);let broken=true;
  f.app.store.all=kind=>{if(broken&&kind==='clientProjects')throw Error('PRIVATE_SOURCE_FAILURE');return all(kind);};
  const failed=await f.api('owner','/api/automation-health');assert.equal(failed.status,200);assert.equal(failed.data.projectGroups,null);assert.match(failed.data.projectGroupsError,/불러오지 못/);assert.equal(failed.data.cards.find(row=>row.id==='today').status,'partial');assert.doesNotMatch(JSON.stringify(failed.data),/PRIVATE_SOURCE_FAILURE/);
  broken=false;const recovered=(await f.api('owner','/api/automation-health')).data;assert.equal(recovered.projectGroups.length,1);assert.equal(recovered.projectGroupsError,undefined);
});
