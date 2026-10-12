import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientDeliveryService} from './client-delivery.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';
import {createWeeklySummaryService} from './weekly-summary.mjs';

const NOW='2026-10-12T03:00:00.000Z';
const input={title:'납품 점검 업무 연결',customerName:'합성 고객',contact:'PRIVATE_CONTACT',summary:'PRIVATE_SUMMARY',internalNotes:'PRIVATE_NOTE',nextStep:'납품 준비',dueDate:'2026-10-15',nextContactDate:''};
const revisions=value=>({projectRevision:value.projectRevision,draftRevision:value.draftRevision,approvedPreviewId:value.approvedPreview.id});
const related=(f,user=f.users.owner)=>f.workflow.workspace(user).items.filter(row=>row.kind==='client_delivery_check');
const deliveries=(f,user=f.users.owner)=>f.workflow.workspace(user).items.filter(row=>row.kind==='delivery');
const attention=(f,user=f.users.owner)=>f.weekly.get(user).sections.find(row=>row.id==='attention').items.filter(row=>row.kind==='client_delivery_check');
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-delivery-check-flow-'));let store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const[name,role,teamId]of[['owner','member','a'],['nextOwner','member','a'],['reviewer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b']])users[name]=store.createUser({name,email:name+'@check-workflow.test',role,teamId});
  let projects,delivery,workflow,weekly,sha='a'.repeat(64);function build(){const clock=()=>NOW;projects=createClientProjectsService({store,clock});delivery=createClientDeliveryService({store,clientProjects:projects,clock,fileInspector:{inspect:async()=>({status:'inspected',sha256:sha,metadata:{kind:'video',duration:30,displayAspectRatio:9/16,width:1080,height:1920}})}});workflow=createClientWorkflowService({store,clientProjects:projects,clientDelivery:delivery,clock});weekly=createWeeklySummaryService({store,clientProjects:projects,clientWorkflow:workflow,clock});}build();
  let row=projects.save(users.owner,{...input,reviewerId:users.reviewer.id}).project;const invite=projects.invite(users.owner,row.id,{revision:row.revision}),session=projects.open(invite.invite);row=projects.project(users.owner,row.id);const id=randomUUID();row=projects.addVersion(users.owner,row.id,{revision:row.revision,kind:'preview',label:'승인 시안'},{id,diskName:id+'.mp4',fileName:'합성 영상.mp4',mimeType:'video/mp4',byteSize:100}).project;projects.customerAction(session.session,session.csrf,{revision:row.revision,action:'approve',versionId:row.versions.at(-1).id});const projectId=row.id,specId=randomUUID();
  function configure(confirmed=true){const current=store.get('clientProjects',projectId),revision=(current.studio?.deliverables?.revision||0)+1;store.put('clientProjects',projectId,{...current,revision:current.revision+1,studio:{schemaVersion:1,deliverables:{revision,items:[{id:specId,label:'영상 1편',kind:'video',quantity:1,durationSeconds:30,aspectRatio:'9:16',fileFormat:'mp4',subtitles:'none',language:'한국어'}],confirmation:confirmed?{deliverableRevision:revision}:null}}});}
  function act(action,extra={},user=users.owner){return delivery.mutate(user,projectId,{...revisions(delivery.get(user,projectId)),action,...extra});}
  async function ready(user=users.owner){if(!delivery.get(user,projectId).items.length)act('use_approved',{requirementId:'video',label:'최종 영상',deliverableItemId:specId},user);let view=await delivery.refreshChecks(user,projectId);view=act('update_item',{itemId:view.items[0].id,confirmed:true,confirmationToken:view.items[0].confirmationToken},user);return view;}
  return {users,id:projectId,specId,configure,act,ready,get store(){return store;},get projects(){return projects;},get delivery(){return delivery;},get workflow(){return workflow;},get weekly(){return weekly;},setSha(value){sha=value;},restart(){store.close();store=new Store(directory);build();}};
}

test('one derived owner item replaces the generic delivery item only while confirmed-spec checks are pending',async t=>{
  const f=await fixture(t);assert.equal(deliveries(f).length,1);assert.equal(related(f).length,0);f.configure(false);assert.equal(deliveries(f).length,1);assert.equal(related(f).length,0);f.configure(true);
  const before=f.store.all('clientProjects'),first=related(f);assert.equal(first.length,1);assert.equal(first[0].group,'next');assert.match(first[0].href,/delivery=1$/);assert.match(first[0].title,/납품 규격·파일 누락 확인/);assert.equal(deliveries(f).length,0);assert.deepEqual(related(f),first);assert.deepEqual(f.store.all('clientProjects'),before);assert.equal(f.store.all('clientDeliveryChecks').length,0);
});
test('reviewers, managers, viewers and unrelated users do not receive another owner delivery-check task',async t=>{
  const f=await fixture(t);f.configure();assert.equal(related(f).length,1);for(const name of ['reviewer','manager','viewer','other','nextOwner']){assert.equal(related(f,f.users[name]).length,0);assert.equal(attention(f,f.users[name]).length,0);}
});
test('resolving checks removes only the check task, restores delivery preparation and publication clears both',async t=>{
  const f=await fixture(t);f.configure();assert.equal(related(f).length,1);await f.ready();assert.equal(related(f).length,0);assert.equal(deliveries(f).length,1);assert.equal(attention(f).length,0);f.act('publish',{confirmed:true});assert.equal(related(f).length,0);assert.equal(deliveries(f).length,0);
});
test('changed specifications or measured file identity bring check work back without duplicate task records',async t=>{
  const f=await fixture(t);f.configure();await f.ready();assert.equal(related(f).length,0);f.configure();assert.equal(related(f).length,1);assert.equal(related(f)[0].status,'needs_check');await f.ready();assert.equal(related(f).length,0);f.setSha('b'.repeat(64));await f.delivery.refreshChecks(f.users.owner,f.id);assert.equal(related(f).length,1);assert.equal(related(f)[0].status,'manual');assert.equal(deliveries(f).length,0);assert.equal(f.store.all('clientDeliveryDrafts').length,1);assert.equal(f.store.all('clientDeliveryChecks').length,1);
});
test('reassignment moves the same derived work to the new owner and current role withdrawal removes it',async t=>{
  const f=await fixture(t);f.configure();const prior=related(f)[0],row=f.projects.project(f.users.manager,f.id);f.projects.save(f.users.manager,{...input,revision:row.revision,ownerId:f.users.nextOwner.id,reviewerId:f.users.reviewer.id},f.id);assert.equal(related(f).length,0);const next=related(f,f.users.nextOwner);assert.equal(next.length,1);assert.equal(next[0].id,prior.id);assert.equal(next[0].ownerId,f.users.nextOwner.id);f.store.put('users',f.users.nextOwner.id,{...f.users.nextOwner,role:'viewer'});assert.equal(related(f,f.users.nextOwner).length,0);
});
test('weekly attention uses the same current work and hides private project details and inspection metadata',async t=>{
  const f=await fixture(t);f.configure();const current=related(f)[0],weekly=attention(f);assert.equal(weekly.length,1);assert.equal(weekly[0].href,current.href);assert.equal(weekly[0].kind,'client_delivery_check');assert.doesNotMatch(JSON.stringify(f.weekly.get(f.users.owner)),/PRIVATE_|diskName|sha256|confirmationToken/);await f.ready();assert.equal(attention(f).length,0);
});
test('server restart retains inspection evidence without duplicates and archived projects have no check reminders',async t=>{
  const f=await fixture(t);f.configure();f.act('use_approved',{requirementId:'video',label:'최종 영상',deliverableItemId:f.specId});await f.delivery.refreshChecks(f.users.owner,f.id);const before=related(f);f.restart();assert.deepEqual(related(f),before);assert.equal(related(f).length,1);assert.equal(f.store.all('clientDeliveryChecks').length,1);const row=f.projects.project(f.users.owner,f.id);f.projects.save(f.users.owner,{...input,revision:row.revision,stage:'archived'},f.id);assert.equal(related(f).length,0);assert.equal(attention(f).length,0);assert.equal(f.store.all('clientDeliveryChecks').length,1);
});
test('existing workflows without the optional delivery-check dependency keep the original approved delivery task',async t=>{
  const f=await fixture(t);f.configure();const legacy=createClientWorkflowService({store:f.store,clientProjects:f.projects,clock:()=>NOW});assert.equal(legacy.workspace(f.users.owner).items.filter(row=>row.kind==='delivery').length,1);assert.equal(legacy.workspace(f.users.owner).items.some(row=>row.kind==='client_delivery_check'),false);
});
test('old final files added directly outside delivery preparation do not create missing-file or weekly false alarms',async t=>{
  const f=await fixture(t);f.configure();const row=f.projects.project(f.users.owner,f.id);f.projects.addVersion(f.users.owner,f.id,{revision:row.revision,kind:'final',label:'과거 직접 납품 파일',url:'https://files.example.test/legacy',guide:'기존 안내'});assert.equal(f.delivery.get(f.users.owner,f.id).deliveryCheck.status,'existing_delivery');assert.equal((await f.delivery.refreshChecks(f.users.owner,f.id)).deliveryCheck.checkedAt,'');assert.equal(related(f).length,0);assert.equal(deliveries(f).length,0);assert.equal(attention(f).length,0);assert.equal(f.store.all('clientDeliveryDrafts').length,0);assert.equal(f.store.all('clientDeliveryChecks').length,0);
});
