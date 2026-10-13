import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService,emptyPulseStudio} from './pulse-studio.mjs';
import {createClientStartupService} from './client-startup.mjs';

const at='2026-10-11T15:00:00.000Z';
const status=(fn,code)=>assert.throws(fn,error=>error.status===code);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-startup-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId] of [['owner','member','a'],['reviewer','member','a'],['other','member','b'],['manager','manager','a'],['viewer','viewer','a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@startup.test',role,teamId});
  const clientProjects=createClientProjectsService({store,clock:()=>at}),studio=createPulseStudioService({store,clientProjects,clock:()=>at}),service=createClientStartupService({store,clientProjects,clock:()=>at});
  const project=clientProjects.save(users.owner,{title:'시작 설정 합성 프로젝트',customerName:'시작 설정 합성 고객',contact:'PRIVATE-CONTACT',internalNotes:'PRIVATE-NOTE',summary:'고객이 요청한 원문',terms:'영상 한 편 협의',dueDate:'2026-11-01',nextStep:'고객과 일정 협의',reviewerId:users.reviewer.id}).project;
  const read=()=>store.get('clientProjects',project.id);
  const preview=(extra={},user=users.owner)=>service.preview(user,project.id,{action:'preview',revision:read().revision,presetId:'short_ad',referenceDate:'2026-10-12',calendar:'weekdays',...extra});
  const apply=(view=preview(),selected=['kickoff','schedule','deliverables'],extra={},user=users.owner)=>service.apply(user,project.id,{action:'apply',revision:view.revision,presetId:view.presetId,referenceDate:view.referenceDate,calendar:view.calendar,sections:selected,draft:Object.fromEntries(selected.map(key=>[key,view.draft[key]])),...extra});
  return {store,clientProjects,studio,service,users,project,read,preview,apply};
}

test('workspace uses KST today and preset previews make no durable writes or copied customer details',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read()),workspace=f.service.workspace(f.users.owner,f.project.id);
  assert.equal(workspace.today,'2026-10-12');assert.deepEqual(workspace.presets.map(item=>item.id),['short_ad','product_intro','interview']);
  for(const preset of workspace.presets){const view=f.preview({presetId:preset.id});assert.equal(view.projectId,f.project.id);assert.ok(Object.values(view.sections).every(section=>section.available));assert.equal(view.draft.schedule.remainingWorkDays,null);assert.doesNotMatch(JSON.stringify(view),/PRIVATE|시작 설정 합성 고객|고객이 요청한 원문/);}
  assert.equal(JSON.stringify(f.read()),before);
});

test('relative dates skip weekends including a weekend reference; calendar dates remain literal',async t=>{
  const f=await fixture(t),weekdays=f.preview({referenceDate:'2026-10-16'}).draft.schedule.targets;
  assert.deepEqual(weekdays,{kickoff:'2026-10-16',preview:'2026-10-20',customer:'2026-10-21',revision:'2026-10-22',delivery:'2026-10-23'});
  assert.equal(f.preview({referenceDate:'2026-10-17'}).draft.kickoff.dueDate,'2026-10-19');
  assert.equal(f.preview({referenceDate:'2026-10-17',calendar:'calendar'}).draft.schedule.targets.delivery,'2026-10-22');
  assert.equal(f.preview({referenceDate:'2028-02-28',calendar:'calendar'}).draft.schedule.targets.preview,'2028-03-01');
  for(const referenceDate of ['2026-02-30','2026-13-01','tomorrow','9999-12-31'])status(()=>f.preview({referenceDate}),400);
  status(()=>f.preview({calendar:'holidays'}),400);status(()=>f.preview({presetId:'copied-project'}),400);
});

test('all sections apply in one project revision with editable content, preserving agreed fields and PULSE strategy',async t=>{
  const f=await fixture(t),original=f.read(),existingStudio=emptyPulseStudio();
  existingStudio.strategy={revision:2,data:{primaryPromise:'기존 기획'},request:{strategyRevision:2},confirmation:{strategyRevision:2},history:[{revision:1,data:{primaryPromise:'이전'}}]};
  existingStudio.assets.push({id:randomUUID(),author:'staff',fileName:'private-source.png',diskName:'secret'});
  f.store.put('clientProjects',original.id,{...original,studio:existingStudio});
  const preview=f.preview();preview.draft.kickoff.requirements[0].label='담당자가 수정한 필수 자료';preview.draft.schedule.targets.preview='2026-10-23';preview.draft.deliverables.items[0].durationSeconds=45;preview.draft.deliverables.items[0].subtitles='separate';
  const response=f.apply(preview),after=f.read();
  assert.equal(after.revision,original.revision+1);assert.equal(after.history.length,original.history.length+1);assert.equal(response.project.kickoff.canEdit,true);assert.equal(after.kickoffPlan.requirements[0].label,'담당자가 수정한 필수 자료');assert.equal(after.schedulePlan.targets.preview,'2026-10-23');
  for(const field of ['title','customerName','contact','internalNotes','summary','terms','dueDate','nextStep','stage','versions','messages','ownerId','reviewerId'])assert.deepEqual(after[field],original[field],field);
  for(const field of Object.keys(existingStudio))assert.deepEqual(after.studio[field],existingStudio[field],field);
  assert.equal(after.studio.deliverables.revision,1);assert.equal(after.studio.deliverables.items[0].durationSeconds,45);assert.equal(after.studio.deliverables.confirmation,null);assert.equal(after.studio.deliverables.request,null);assert.deepEqual(after.studio.deliverables.links,[]);
  assert.ok(after.kickoffPlan.requirements.every(item=>item.sourceKey===''&&!item.review&&!item.waiver));assert.deepEqual(f.store.all('clientDeliveryDrafts'),[]);
});

test('existing section settings and recorded confirmations are never overwritten; other blank sections remain usable',async t=>{
  const f=await fixture(t);f.apply(f.preview(),['kickoff']);let row=f.read();row.kickoffPlan.requirements[0].review={sourceFingerprint:'old-fingerprint',actor:'old',at};f.store.put('clientProjects',row.id,row);
  const preview=f.preview(),before=JSON.stringify(f.read());assert.equal(preview.sections.kickoff.available,false);assert.match(preview.sections.kickoff.reason,/그대로 둬요/);status(()=>f.apply(preview),409);assert.equal(JSON.stringify(f.read()),before);
  f.apply(preview,['schedule','deliverables']);assert.deepEqual(f.read().kickoffPlan,row.kickoffPlan);
  assert.ok(Object.values(f.service.workspace(f.users.owner,row.id).sections).every(section=>!section.available));
  status(()=>f.apply(f.preview(),['deliverables']),409);
});

test('even disabled, emptied or unknown prior plans are treated as configured and preserved',async t=>{
  const f=await fixture(t),row=f.read();f.store.put('clientProjects',row.id,{...row,kickoffPlan:{enabled:false,requirements:[]},schedulePlan:{enabled:false},studio:{...emptyPulseStudio(),deliverables:{revision:1,items:[],notes:'',history:[],confirmation:{deliverableRevision:1}}}});
  assert.ok(Object.values(f.preview().sections).every(section=>!section.available));const before=JSON.stringify(f.read());status(()=>f.apply(),409);assert.equal(JSON.stringify(f.read()),before);
});

test('empty canonical PULSE state can be initialized while unknown studio schema cannot be overwritten',async t=>{
  const f=await fixture(t),row=f.read();f.store.put('clientProjects',row.id,{...row,studio:{...emptyPulseStudio(),deliverables:{revision:0,items:[],notes:'',request:null,confirmation:null,links:[],history:[]}}});
  assert.equal(f.preview().sections.deliverables.available,true);f.apply(f.preview(),['deliverables']);assert.equal(f.read().studio.deliverables.revision,1);
  f.store.put('clientProjects',row.id,{...row,studio:{schemaVersion:9,unknown:'preserve'}});const before=JSON.stringify(f.read());assert.equal(f.preview().sections.deliverables.available,false);status(()=>f.apply(f.preview(),['deliverables']),409);assert.equal(JSON.stringify(f.read()),before);
});

test('invalid later sections cannot partially create kickoff or schedule records',async t=>{
  const f=await fixture(t),preview=f.preview(),before=JSON.stringify(f.read());preview.draft.deliverables.items[0].quantity=0;status(()=>f.apply(preview),400);assert.equal(JSON.stringify(f.read()),before);
  preview.draft.deliverables.items[0].quantity=1;preview.draft.schedule.targets.delivery='2026-02-31';status(()=>f.apply(preview),400);assert.equal(JSON.stringify(f.read()),before);
});

test('PULSE size limit rolls back all initial sections instead of stranding existing studio history',async t=>{
  const f=await fixture(t),row=f.read(),studio={...emptyPulseStudio(),legacyPreserved:'x'.repeat(1499400)};f.store.put('clientProjects',row.id,{...row,studio});const before=JSON.stringify(f.read());status(()=>f.apply(),409);assert.equal(JSON.stringify(f.read()),before);
});

test('unknown fields, copied identifiers, approvals and source links are rejected without writes',async t=>{
  const f=await fixture(t),before=JSON.stringify(f.read());status(()=>f.preview({force:true}),400);
  const cases=[p=>p.draft.kickoff.requirements[0].id=randomUUID(),p=>p.draft.kickoff.requirements[0].sourceKey='asset:old',p=>p.draft.kickoff.requirements[0].review={at},p=>p.draft.schedule.ownerId='other',p=>p.draft.deliverables.confirmation={at},p=>p.draft.deliverables.items[0].id=randomUUID()];
  for(const change of cases){const preview=f.preview();change(preview);status(()=>f.apply(preview),400);assert.equal(JSON.stringify(f.read()),before);}
  status(()=>f.apply(f.preview(),['kickoff','kickoff']),400);status(()=>f.apply(f.preview(),[]),400);status(()=>f.apply(f.preview(),['kickoff'],{force:true}),400);
});

test('permissions are rechecked for owner, same-team manager and admin; stale identity and archived projects reject',async t=>{
  const f=await fixture(t);for(const [name,code] of [['viewer',403],['reviewer',403],['other',404]]){status(()=>f.service.workspace(f.users[name],f.project.id),code);status(()=>f.preview({},f.users[name]),code);status(()=>f.apply(f.preview(),['kickoff'],{},f.users[name]),code);}
  for(const name of ['manager','admin'])assert.equal(f.service.workspace(f.users[name],f.project.id).projectId,f.project.id);
  const preview=f.preview();f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.apply(preview),401);f.store.put('users',f.users.owner.id,{...f.users.owner,active:true,role:'viewer'});status(()=>f.apply(preview),403);f.store.put('users',f.users.owner.id,f.users.owner);
  f.store.put('clientProjects',f.project.id,{...f.read(),stage:'archived'});status(()=>f.apply(preview),409);
});

test('stale preview and replay reject; a failed durable transaction leaves every source unchanged',async t=>{
  const f=await fixture(t),preview=f.preview();f.clientProjects.message(f.users.owner,f.project.id,{revision:f.read().revision,visibility:'internal',text:'다른 창의 변경'});const before=JSON.stringify(f.read());status(()=>f.apply(preview),409);assert.equal(JSON.stringify(f.read()),before);
  const broken=createClientStartupService({store:f.store,clock:()=>at,clientProjects:{...f.clientProjects,commitWorkflow(row){f.clientProjects.commitWorkflow(row);throw new Error('simulated storage rollback');}}});
  const fresh=f.preview();assert.throws(()=>broken.apply(f.users.owner,f.project.id,{action:'apply',revision:fresh.revision,presetId:fresh.presetId,referenceDate:fresh.referenceDate,calendar:fresh.calendar,sections:['kickoff'],draft:{kickoff:fresh.draft.kickoff}}),/simulated storage rollback/);assert.equal(JSON.stringify(f.read()),before);
  f.apply(fresh);status(()=>f.apply(fresh),409);
});

test('customer sees only normal unconfirmed PULSE spec and kickoff projection, never internal schedule or contacts',async t=>{
  const f=await fixture(t);f.apply();const invite=f.clientProjects.invite(f.users.owner,f.project.id,{revision:f.read().revision}),session=f.clientProjects.open(invite.invite),view=f.studio.customerState(session.session).project;
  assert.doesNotMatch(JSON.stringify(view),/PRIVATE-CONTACT|PRIVATE-NOTE|schedulePlan|remainingWorkDays|internalReviewDays|presetId|startup/);assert.equal(view.studio.deliverables.revision,1);assert.equal(view.studio.deliverables.request,null);assert.equal(view.studio.deliverables.confirmation,null);assert.equal(view.dueDate,'2026-11-01');assert.equal(view.versions.length,0);assert.equal(view.messages.length,0);
  status(()=>f.studio.customerMutate(session.session,session.csrf,{action:'confirm_deliverables',revision:f.read().revision,deliverableRevision:1}),409);
});
