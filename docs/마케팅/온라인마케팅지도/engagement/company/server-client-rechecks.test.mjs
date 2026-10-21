import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createCompanyApp} from './server.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-recheck-api-'));
  let now='2026-10-12T01:00:00.000Z';
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,automationHealthSchedule:false,clock:()=>now});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-recheck-api-'));await rm(directory,{recursive:true,force:true});});
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@recheck-api.example',role:name==='viewer'?'viewer':'member'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'recheck-api'},30);}
  async function api(name,path,method='GET',input,overrides={}){
    const response=await fetch(base+path,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(input?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'recheck-api'}:{}),...overrides},...(input?{body:JSON.stringify(input)}:{})});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  const initial=app.clientProjects.save(users.owner,{title:'개인 날짜 HTTP 시험',customerName:'합성 고객',dueDate:'2026-10-13'}).project;
  const read=()=>app.store.get('clientProjects',initial.id);
  const customer=app.clientProjects.open(app.clientProjects.invite(users.owner,initial.id,{revision:read().revision}).invite);
  app.clientProjects.addVersion(users.owner,initial.id,{revision:read().revision,kind:'preview',label:'합성 확인 시안',url:'https://example.test/recheck.mp4'});
  const request=text=>app.clientProjects.customerAction(customer.session,customer.csrf,{revision:read().revision,action:'support',text});request('PRIVATE_RECHECK_BODY');
  const workspace=async(name='owner')=>(await api(name,'/api/client-workflow')).data;
  const defer=async(item,date='2026-10-19')=>{const current=await workspace();return api('owner','/api/client-workflow/recheck','POST',{action:'defer',itemId:item.id,date,fingerprint:current.rechecks[item.id].fingerprint});};
  return {app,api,users,read,request,workspace,defer,id:initial.id,setNow:value=>{now=value;}};
}

test('HTTP personal date preserves all automation cards, issue/manual counts, full groups and unread customer alerts',async t=>{
  const f=await fixture(t),before=await f.workspace(),item=before.items.find(item=>item.kind==='support'),source=JSON.stringify(f.read()),healthBefore=(await f.api('owner','/api/automation-health')).data,alertsBefore=(await f.api('owner','/api/pulse-live')).data;
  const result=await f.defer(item);assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.deepEqual(result.data.items,before.items);assert.deepEqual(result.data.projectGroups,before.projectGroups);assert.equal(result.data.deferredItems[0].id,item.id);assert.ok(result.data.todayItems.every(value=>value.id!==item.id));
  const health=(await f.api('owner','/api/automation-health')).data,alerts=(await f.api('owner','/api/pulse-live')).data;
  assert.equal(health.cards.length,17);assert.ok(health.cards.some(card=>card.id==='rights'));for(const key of ['cards','issues','manual','counts','projectGroups'])assert.deepEqual(health[key],healthBefore[key],key+' remains complete');
  assert.deepEqual(alerts,alertsBefore);assert.ok(alerts.unreadCount>0);assert.doesNotMatch(JSON.stringify(health),/PRIVATE_RECHECK_BODY|rechecks|deferredItems/);assert.equal(JSON.stringify(f.read()),source);
  const restored=await f.api('owner','/api/client-workflow/recheck','POST',{action:'restore',itemId:item.id});assert.equal(restored.status,200);assert.equal(restored.data.deferredItems.length,0);assert.deepEqual(restored.data.todayItems,before.items);
});

test('HTTP POST enforces login, CSRF, origin and current owner without changing personal/source data on errors',async t=>{
  const f=await fixture(t),state=await f.workspace(),item=state.items.find(item=>item.kind==='support'),input={action:'defer',itemId:item.id,date:'2026-10-19',fingerprint:state.rechecks[item.id].fingerprint},source=JSON.stringify(f.read());
  assert.equal((await f.api(null,'/api/client-workflow')).status,401);
  assert.equal((await f.api(null,'/api/client-workflow/recheck','POST',input)).status,403,'Unauthenticated writes fail the existing CSRF/session guard');
  assert.equal((await f.api('owner','/api/client-workflow/recheck','POST',input,{'X-CSRF-Token':''})).status,403);
  assert.equal((await f.api('owner','/api/client-workflow/recheck','POST',input,{Origin:'https://foreign.example'})).status,403);
  assert.equal((await f.api('other','/api/client-workflow/recheck','POST',input)).status,404);
  assert.equal((await f.api('viewer','/api/client-workflow/recheck','POST',input)).status,403);
  assert.deepEqual(f.app.store.all('clientTaskRechecks'),[]);assert.equal(JSON.stringify(f.read()),source);
  assert.equal((await f.api('owner','/api/client-workflow/recheck','POST',input)).status,200);
  f.app.store.put('clientProjects',f.id,{...f.read(),ownerId:f.users.other.id});
  assert.deepEqual((await f.workspace()).rechecks,{});assert.equal((await f.api('owner','/api/client-workflow/recheck','POST',{action:'restore',itemId:item.id})).status,404);
  const other=await f.workspace('other');assert.equal(other.rechecks[item.id].state,'active');assert.equal(other.deferredItems.length,0);
  f.app.store.put('users',f.users.other.id,{...f.users.other,active:false});assert.equal((await f.api('other','/api/client-workflow')).status,401);assert.equal((await f.api('other','/api/client-workflow/recheck','POST',{action:'restore',itemId:item.id})).status,403);
});

test('HTTP source changes and KST deadline rollover surface deferred work and reject old visible fingerprints',async t=>{
  const f=await fixture(t);let state=await f.workspace();const item=state.items.find(item=>item.kind==='support'),old=state.rechecks[item.id].fingerprint;await f.defer(item);
  f.request('새 고객 문의');state=await f.workspace();assert.equal(state.rechecks[item.id].state,'changed');assert.equal(state.deferredItems.length,0);
  assert.equal((await f.api('owner','/api/client-workflow/recheck','POST',{action:'defer',itemId:item.id,date:'2026-10-19',fingerprint:old})).status,409);
  const current=state.rechecks[item.id].fingerprint;await f.defer(item);f.setNow('2026-10-13T15:00:00.000Z');state=await f.workspace();assert.equal(state.recheckToday,'2026-10-14');assert.equal(state.rechecks[item.id].state,'overdue');
  assert.equal((await f.api('owner','/api/client-workflow/recheck','POST',{action:'defer',itemId:item.id,date:'2026-10-19',fingerprint:current})).status,409);
  assert.equal((await f.defer(state.items.find(value=>value.id===item.id))).status,200);assert.equal((await f.workspace()).deferredItems.length,1);
});
