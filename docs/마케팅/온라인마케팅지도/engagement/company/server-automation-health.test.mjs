import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-automation-api-'));let at='2026-10-12T01:00:00.000Z',external=0;
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,publicationInboxSchedule:true,automationHealthSchedule:true,clock:()=>at,collector:async()=>{external++;throw Error('forbidden');},...options});
  await app.start();const base=`http://127.0.0.1:${app.server.address().port}`,users={},sessions={};
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-automation-api-'));await rm(directory,{recursive:true,force:true});});
  async function api(name,path,method='GET',input,csrf='automation-api'){
    const response=await fetch(base+path,{method,headers:{...(name?{Cookie:'synk_company_session='+sessions[name]}:{}),...(input!==undefined?{Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(input!==undefined?{body:JSON.stringify(input)}:{})});
    return {status:response.status,headers:response.headers,data:await response.json()};
  }
  for(const name of ['owner','other','viewer']){users[name]=app.store.createUser({name,email:name+'@example.test',role:name==='viewer'?'viewer':'member'});sessions[name]=app.store.mint('session',users[name].id,{csrfToken:'automation-api'},30);await api(name,'/messenger/api/bootstrap');}
  function receipt(name='owner',status='error'){
    const user=users[name],id='00000000-0000-4000-8000-000000000001',key=user.id+':'+id;
    app.store.put('publicationInboxSettings',user.id,{id:user.id,ownerId:user.id,active:true,revision:1,lastScanAt:at});
    app.store.put('publicationInboxEntries',key,{id,ownerId:user.id,status,title:name+' 전용 합성 전달',createdAt:at,updatedAt:at,message:'PRIVATE PROVIDER PATH C:/secret/token',draft:{body:'PRIVATE ORIGINAL BODY'}});
    return {key,id};
  }
  return {app,api,base,users,receipt,external:()=>external,setClock:value=>at=value};
}
const card=(report,id)=>report.cards.find(row=>row.id===id);

test('a composed health read shares projections only for that read and immediately observes changed ownership and source failures',async t=>{
  const f=await fixture(t,{automationHealthSchedule:false}),owner=f.users.owner,other=f.users.other;
  const saved=f.app.clientProjects.save(owner,{title:'Scoped synthetic project',customerName:'Synthetic customer',stage:'review'}).project;
  const raw=f.app.store.get('clientProjects',saved.id);
  f.app.store.put('clientProjects',saved.id,{...raw,versions:[{id:'approved-preview',kind:'preview',label:'Synthetic approval',createdAt:'2026-10-12T00:00:00.000Z',approvedAt:'2026-10-12T00:00:00.000Z'}]});
  const original=f.app.store.all.bind(f.app.store);let reads=0,broken=false;
  f.app.store.all=kind=>{if(kind==='clientProjects'){reads++;if(broken)throw Error('PRIVATE scoped source failure');}return original(kind);};
  let report=f.app.automationHealth.get(owner);assert.equal(reads,1);assert.equal(card(report,'delivery').counts.targets,1);
  reads=0;f.app.automationHealth.get(owner);assert.equal(reads,1);
  const current=f.app.store.get('clientProjects',saved.id);f.app.store.put('clientProjects',saved.id,{...current,ownerId:other.id});
  report=f.app.automationHealth.get(owner);assert.equal(card(report,'delivery').counts.targets,0);assert.doesNotMatch(JSON.stringify(report),/Scoped synthetic project/);
  report=f.app.automationHealth.get(other);assert.equal(card(report,'delivery').counts.targets,1);
  broken=true;reads=0;report=f.app.automationHealth.get(other);assert.equal(reads,1);assert.equal(card(report,'delivery').status,'partial');assert.equal(card(report,'weekly').status,'partial');assert.doesNotMatch(JSON.stringify(report),/PRIVATE scoped/);
  broken=false;report=f.app.automationHealth.get(other);assert.notEqual(card(report,'delivery').status,'partial');assert.equal(card(report,'delivery').counts.targets,1);
});

test('scheduled scans coalesce and server shutdown waits for their cancellation before closing the store',async t=>{
  const f=await fixture(t,{automationHealthSchedule:false});f.receipt();
  const scan=f.app.scanAutomationHealthScheduled();assert.equal(f.app.scanAutomationHealthScheduled(),scan);
  await f.app.stop();assert.equal((await scan).cancelled,true);assert.equal(f.app.scanAutomationHealthScheduled(),null);
});

test('automation HTTP reuses current personal permissions and read-only sources without exposing paths or bodies',async t=>{
  const f=await fixture(t),row=f.receipt();
  assert.equal((await f.api(null,'/api/automation-health')).status,401);
  assert.equal((await f.api('owner','/api/automation-health?userId=other')).status,400);
  const source=JSON.stringify(f.app.store.get('publicationInboxEntries',row.key));
  const result=await f.api('owner','/api/automation-health');assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);
  assert.equal(result.data.cards.length,17);assert.equal(card(result.data,'inbox').status,'failed');assert.ok(result.data.issues.some(row=>row.title==='owner 전용 합성 전달'));
  assert.doesNotMatch(JSON.stringify(result.data),/PRIVATE|C:\/secret|token|ORIGINAL BODY/);
  assert.doesNotMatch(JSON.stringify((await f.api('other','/api/automation-health')).data),/owner 전용/);
  assert.equal((await f.api('viewer','/api/automation-health')).data.issues.length,0);
  await f.api('owner','/api/automation-health');assert.equal(JSON.stringify(f.app.store.get('publicationInboxEntries',row.key)),source);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.equal((await f.api('owner','/api/automation-health')).status,401);assert.equal(f.external(),0);
});

test('one current incident becomes one existing messenger notification; read does not resolve and recovery/reappearance starts a new episode',async t=>{
  const f=await fixture(t),row=f.receipt();
  f.app.scanAutomationHealth();const saved=JSON.stringify(f.app.store.all('automationNotificationStates'));
  f.app.scanAutomationHealth();assert.equal(JSON.stringify(f.app.store.all('automationNotificationStates')),saved);
  const listed=await f.api('owner','/messenger/api/notifications'),items=listed.data.items.filter(row=>row.kind==='automation_health');assert.equal(items.length,1);
  assert.equal(items[0].href,'/?tab=workroom&section=tools&tool=automation');assert.equal(items[0].readAt,null);
  assert.equal((await f.api('other','/messenger/api/notifications')).data.items.filter(row=>row.kind==='automation_health').length,0);
  assert.equal((await f.api('owner',`/messenger/api/notifications/${encodeURIComponent(items[0].id)}/read`,'POST',{},'wrong')).status,403);
  assert.equal((await f.api('owner',`/messenger/api/notifications/${encodeURIComponent(items[0].id)}/read`,'POST',{})).status,200);
  assert.equal((await f.api('owner','/api/automation-health')).data.issues.length,1);
  assert.ok((await f.api('owner','/messenger/api/notifications')).data.items.find(row=>row.id===items[0].id).readAt);
  f.receipt('owner','ready');f.app.scanAutomationHealth();assert.equal((await f.api('owner','/messenger/api/notifications')).data.items.filter(row=>row.kind==='automation_health').length,0);
  assert.equal(f.app.store.all('automationNotificationStates')[0].state,'resolved');
  f.setClock('2026-10-12T01:01:00.000Z');f.receipt();f.app.scanAutomationHealth();
  const reopened=(await f.api('owner','/messenger/api/notifications')).data.items.find(row=>row.kind==='automation_health');assert.notEqual(reopened.id,items[0].id);assert.equal(reopened.readAt,null);
  assert.doesNotMatch(JSON.stringify(f.app.store.all('automationNotificationStates')),/전용|PRIVATE|title|body|href/);
  f.app.store.put('users',f.users.owner.id,{...f.users.owner,role:'viewer'});assert.equal((await f.api('owner','/messenger/api/notifications')).data.items.filter(row=>row.kind==='automation_health').length,0);
  assert.equal(f.external(),0);
});

test('disabled jobs stay disabled, idle work is not called missing, and Marin opens the same status screen',async t=>{
  const f=await fixture(t,{publicationInboxSchedule:false,automationHealthSchedule:false});
  const result=(await f.api('owner','/api/automation-health')).data;
  assert.equal(result.monitor.enabled,false);assert.equal(result.monitor.inAppOnly,true);assert.equal(result.issues.length,0);
  for(const id of ['performance','inbox','links','weekly','deliveryCheck'])assert.equal(card(result,id).status,'paused');
  const ask=await f.api('owner','/api/assistant','POST',{message:'자동화 상태 확인해줘'});
  assert.equal(ask.status,200);assert.equal(ask.data.intent,'automation-health');assert.equal(ask.data.actions[0].type,'automation-health');assert.equal(ask.data.externalCalls,false);
  assert.equal(f.external(),0);
});

function deliveryProject(f,name='owner'){
  const user=f.users[name],projects=f.app.clientProjects;
  let row=projects.save(user,{title:name+' 납품 점검',customerName:'합성 고객'}).project;
  const invite=projects.invite(user,row.id,{revision:row.revision}),customer=projects.open(invite.invite);
  row=projects.project(user,row.id);const mediaId=randomUUID(),media={id:mediaId,diskName:mediaId+'.mp4',mimeType:'video/mp4',fileName:'합성 영상.mp4',byteSize:128};
  row=projects.addVersion(user,row.id,{revision:row.revision,kind:'preview',label:'합성 시안'},media).project;
  projects.customerAction(customer.session,customer.csrf,{revision:row.revision,action:'approve',versionId:row.versions.at(-1).id});row=projects.project(user,row.id);
  const item={id:randomUUID(),label:'확정 합성 영상',kind:'video',durationSeconds:3,aspectRatio:'16:9',quantity:1,subtitles:'none',fileFormat:'MP4',language:'한국어'};
  f.app.store.put('clientProjects',row.id,{...row,studio:{schemaVersion:1,deliverables:{revision:1,items:[item],confirmation:{deliverableRevision:1}}}});
  const view=f.app.clientDelivery.get(user,row.id);
  f.app.clientDelivery.mutate(user,row.id,{action:'use_approved',projectRevision:view.projectRevision,draftRevision:view.draftRevision,approvedPreviewId:view.approvedPreview.id,requirementId:'video',deliverableItemId:item.id,label:'최종 합성 영상'});
  return {id:row.id,media,item,user};
}
const goodInspection=media=>({status:'inspected',code:'inspected',sha256:'a'.repeat(64),byteSize:media.byteSize,metadata:{kind:'video',duration:3,width:160,height:90,displayAspectRatio:16/9,videoCodec:'h264',audioCodecs:[]}});
const deliveryIssues=report=>report.issues.filter(row=>row.automationId==='deliveryCheck');

test('delivery background scans isolate project failures, record real recovery, and status reads never inspect or mutate source data',async t=>{
  const control={calls:0,failedMedia:null},inspector={async inspect(media){control.calls++;if(media.id===control.failedMedia)throw Error('PRIVATE ERROR C:/secret/customer');return goodInspection(media);},async close(){}};
  const f=await fixture(t,{deliveryCheckSchedule:true,deliveryFileInspector:inspector});await f.app.waitForIdle();
  const own=deliveryProject(f),other=deliveryProject(f,'other');control.failedMedia=own.media.id;
  f.setClock('2026-10-12T01:01:00.000Z');assert.deepEqual(await f.app.scanDeliveryChecks(),{checked:1,failed:1});
  let owner=(await f.api('owner','/api/automation-health')).data,unrelated=(await f.api('other','/api/automation-health')).data;
  assert.equal(card(owner,'deliveryCheck').status,'failed');assert.equal(deliveryIssues(owner).length,1);assert.equal(deliveryIssues(unrelated).length,0);
  assert.equal(card(owner,'deliveryCheck').lastSuccessAt,null);assert.equal(card(unrelated,'deliveryCheck').lastSuccessAt,'2026-10-12T01:01:00.000Z');assert.doesNotMatch(JSON.stringify(owner),/PRIVATE ERROR|C:\/secret/);
  f.app.scanAutomationHealth();const notifications=(await f.api('owner','/messenger/api/notifications')).data.items.filter(row=>row.kind==='automation_health');assert.equal(notifications.length,1);
  const before=JSON.stringify(['clientProjects','clientDeliveryDrafts','clientDeliveryChecks'].map(kind=>f.app.store.all(kind))),calls=control.calls;
  await f.api('owner','/api/automation-health');await f.api('owner','/api/automation-health');assert.equal(control.calls,calls);assert.equal(JSON.stringify(['clientProjects','clientDeliveryDrafts','clientDeliveryChecks'].map(kind=>f.app.store.all(kind))),before);
  f.setClock('2026-10-12T01:02:00.000Z');control.failedMedia=null;assert.deepEqual(await f.app.scanDeliveryChecks(),{checked:2,failed:0});
  owner=(await f.api('owner','/api/automation-health')).data;assert.equal(deliveryIssues(owner).length,0);assert.equal(card(owner,'deliveryCheck').lastSuccessAt,'2026-10-12T01:02:00.000Z');assert.ok(owner.manual.some(row=>row.automationId==='deliveryCheck'));
  f.app.scanAutomationHealth();assert.equal((await f.api('owner','/messenger/api/notifications')).data.items.filter(row=>row.kind==='automation_health').length,0);assert.equal(f.external(),0);assert.ok(other.id);
});

test('delivery scans share one in-flight check and revoked owners are skipped without retaining an error or publishing a stale inspection',async t=>{
  let begin,release;const started=new Promise(resolve=>begin=resolve),gate=new Promise(resolve=>release=resolve);let gated=false,calls=0;
  const f=await fixture(t,{deliveryCheckSchedule:true,deliveryFileInspector:{async inspect(media){calls++;if(gated){begin();await gate;}return goodInspection(media);},async close(){}}});await f.app.waitForIdle();
  const own=deliveryProject(f);gated=true;const first=f.app.scanDeliveryChecks(),second=f.app.scanDeliveryChecks();assert.equal(first,second);await started;
  let report;try{report=(await f.api('owner','/api/automation-health')).data;assert.equal(card(report,'deliveryCheck').status,'running');assert.equal(calls,1);f.app.store.put('users',own.user.id,{...own.user,active:false});}finally{release();}
  assert.deepEqual(await first,{checked:0,failed:0});assert.equal(f.app.store.all('clientDeliveryChecks').length,0);
  f.app.store.put('users',own.user.id,own.user);report=(await f.api('owner','/api/automation-health')).data;assert.equal(deliveryIssues(report).length,0);assert.equal(card(report,'deliveryCheck').lastSuccessAt,null);
  const row=f.app.store.get('clientProjects',own.id);f.app.store.put('clientProjects',own.id,{...row,stage:'archived'});assert.deepEqual(await f.app.scanDeliveryChecks(),{checked:0,failed:0});assert.equal(deliveryIssues((await f.api('owner','/api/automation-health')).data).length,0);
});

test('stale delivery failures do not follow a changed specification and global scanner errors become unknown instead of customer failures',async t=>{
  let fail=true;const f=await fixture(t,{deliveryCheckSchedule:true,deliveryFileInspector:{async inspect(media){if(fail)throw Error('PRIVATE transport');return goodInspection(media);},async close(){}}});await f.app.waitForIdle();
  const own=deliveryProject(f);await f.app.scanDeliveryChecks();assert.equal(deliveryIssues((await f.api('owner','/api/automation-health')).data).length,1);
  const row=f.app.store.get('clientProjects',own.id),deliverables=row.studio.deliverables;
  f.app.store.put('clientProjects',own.id,{...row,studio:{...row.studio,deliverables:{...deliverables,revision:2,confirmation:{deliverableRevision:2},items:deliverables.items.map(item=>({...item,durationSeconds:4}))}}});
  let report=(await f.api('owner','/api/automation-health')).data;assert.equal(deliveryIssues(report).length,0);assert.equal(card(report,'deliveryCheck').lastSuccessAt,null);
  const all=f.app.store.all.bind(f.app.store);f.app.store.all=kind=>{if(kind==='clientProjects')throw Error('PRIVATE database C:/secret');return all(kind);};
  f.setClock('2026-10-12T01:01:00.000Z');assert.deepEqual(await f.app.scanDeliveryChecks(),{failed:true});f.app.store.all=all;
  report=(await f.api('owner','/api/automation-health')).data;assert.equal(card(report,'deliveryCheck').status,'partial');assert.equal(deliveryIssues(report).length,0);assert.doesNotMatch(JSON.stringify(report),/PRIVATE database|C:\/secret/);
  fail=false;f.setClock('2026-10-12T01:02:00.000Z');await f.app.scanDeliveryChecks();report=(await f.api('owner','/api/automation-health')).data;assert.notEqual(card(report,'deliveryCheck').status,'partial');assert.equal(deliveryIssues(report).length,0);
});

test('delivery scan scheduling accepts only explicit booleans',()=>{
  for(const value of ['true',1,{},[]])assert.throws(()=>createCompanyApp({deliveryCheckSchedule:value}),/자동 실행 설정/);
});

test('runtime scans distinguish invocation from outcome and return honest per-process attempt/success timestamps',async t=>{
  const f=await fixture(t,{weeklySummarySchedule:true});
  f.app.scanWeeklySummary();f.app.scanAutomationHealth();
  let weekly=card((await f.api('owner','/api/automation-health')).data,'weekly');
  assert.equal(weekly.lastAttemptAt,'2026-10-12T01:00:00.000Z');assert.equal(weekly.lastSuccessAt,weekly.lastAttemptAt);assert.ok(weekly.lastResultAt);
  assert.match(weekly.lastSuccessLabel,/점검/);assert.equal(weekly.nextRunAt,'2026-10-12T01:01:00.000Z');
  for(const file of ['automation-health.js','automation-health.css']){const res=await fetch(f.base+'/'+file);assert.equal(res.status,200);assert.ok((await res.text()).length>100);}
  assert.equal(f.external(),0);
});
