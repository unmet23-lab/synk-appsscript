import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {emptyStrategy} from './pulse-strategy.mjs';
import {buildSceneRequests,customerSceneRequests,applySceneRequestAction,recordSceneReview} from './client-scene-requests.mjs';

const at='2026-10-12T03:00:00.000Z',owner='owner',reviewer='reviewer';
const status=(fn,code)=>assert.throws(fn,error=>error.status===code);
function raw({reviewerId=reviewer}={}){const sceneId=randomUUID(),requestId=randomUUID();return {id:randomUUID(),title:'합성 장면 프로젝트',revision:1,ownerId:owner,reviewerId,stage:'producing',history:[],messages:[],versions:[],studio:{schemaVersion:1,preferences:{},strategy:emptyStrategy(),assets:[],references:[],concepts:[],scenes:[{id:sceneId,title:'첫 장면',description:'소개',revision:1,visibility:'customer',duration:3}],history:[],conceptSelections:[],comments:[],sceneReviews:[{id:requestId,sceneId,title:'첫 장면',sceneRevision:1,status:'changes',text:'문구를 짧게 바꿔 주세요.',author:'customer',at}]}};}
const report=(row,options={})=>buildSceneRequests(row,{userId:owner,canEdit:true,...options});
const item=row=>report(row).items[0];
function act(row,action,extra={},options={}){return {...row,sceneRequestWorkflows:applySceneRequestAction(row,{action,requestId:row.studio.sceneReviews[0].id,...extra},{actor:owner,at,canEdit:true,reviewerId:row.reviewerId,...options})};}
function edit(row){row=structuredClone(row);row.studio.scenes[0].revision++;row.studio.scenes[0].description+=' 수정';return row;}
function submit(row){return act(row,'submit',{sceneRevision:row.studio.scenes[0].revision,confirmed:true,note:'PRIVATE-SUBMIT'});}
function accept(row){return act(row,'accept',{confirmed:true,note:'PRIVATE-REVIEW'},{actor:reviewer,canEdit:false,canReview:true});}
function customer(row,type='confirmed'){row=structuredClone(row);const scene=row.studio.scenes[0],review={id:randomUUID(),sceneId:scene.id,sceneRevision:scene.revision,title:scene.title,status:type,text:type==='changes'?'다시 수정해 주세요.':'확인',author:'customer',at};row.studio.sceneReviews.push(review);const workflows=recordSceneReview(row,review,{at});if(workflows)row.sceneRequestWorkflows=workflows;return row;}

async function fixture(t,{withReviewer=true}={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-scene-requests-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','team-a'],['reviewer','member','team-a'],['other','member','team-b'],['manager','manager','team-a'],['viewer','viewer','team-a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@scene-request.test',role,teamId});
  const service=createClientProjectsService({store}),studio=createPulseStudioService({store,clientProjects:service});const project=service.save(users.owner,{title:'합성 장면 수정',customerName:'테스트 고객',terms:'영상 1편',stage:'producing',reviewerId:withReviewer?users.reviewer.id:null}).project;
  const template=raw();store.put('clientProjects',project.id,{...store.get('clientProjects',project.id),studio:template.studio});
  const read=()=>store.get('clientProjects',project.id),call=(action,extra={},user=users.owner)=>service.sceneRequests(user,project.id,{revision:read().revision,requestId:read().studio.sceneReviews[0].id,action,...extra}).project;
  const invite=()=>{const result=service.invite(users.owner,project.id,{revision:read().revision});return service.open(result.invite);};
  const sceneEdit=()=>{const scene=read().studio.scenes[0];return studio.staffMutate(users.owner,project.id,{action:'save_scene',revision:read().revision,id:scene.id,title:scene.title,description:scene.description+' 새 수정',duration:3,visibility:'customer'}).project;};
  const review=(opened,status='confirmed')=>studio.customerMutate(opened.session,opened.csrf,{action:'review_scene',revision:read().revision,sceneId:read().studio.scenes[0].id,sceneRevision:read().studio.scenes[0].revision,status,text:status==='changes'?'다시 수정':'확인'}).project;
  return {store,service,studio,users,project,read,call,invite,sceneEdit,review};
}

test('only explicit customer scene changes become requests and reads remain pure',()=>{
  const row=raw();row.studio.comments=[{targetType:'scene',text:'일반 댓글'}];row.studio.sceneReviews.push({id:randomUUID(),sceneId:row.studio.scenes[0].id,status:'comment',author:'customer'},{id:randomUUID(),sceneId:row.studio.scenes[0].id,status:'changes',author:'staff'});const before=JSON.stringify(row),view=report(row);
  assert.equal(view.items.length,1);assert.equal(view.items[0].status,'open');assert.equal(view.items[0].canSubmit,false);assert.equal(view.pendingCount,1);assert.equal(JSON.stringify(row),before);assert.equal(row.sceneRequestWorkflows,undefined);
});

test('submit requires a newer current public scene and explicit source inspection',()=>{
  const row=raw();status(()=>submit(row),409);let edited=edit(row);status(()=>act(edited,'submit',{sceneRevision:2}),400);status(()=>act(edited,'submit',{sceneRevision:1,confirmed:true}),409);edited.studio.scenes[0].visibility='internal';status(()=>submit(edited),409);
  const ready=edit(row);assert.equal(item(ready).canSubmit,true);const submitted=submit(ready);assert.equal(item(submitted).status,'review');assert.equal(item(submitted).resultRevision,2);status(()=>submit(submitted),409);
});

test('no reviewer means direct customer waiting, never automatic completion',()=>{
  const row=submit(edit(raw({reviewerId:null})));assert.equal(item(row).status,'waiting_customer');assert.equal(report(row).doneCount,0);const done=customer(row);assert.equal(item(done).status,'done');assert.equal(done.stage,'producing');assert.equal(done.messages.length,0);assert.equal(done.sceneRequestWorkflows[item(done).id].customerReviewId,done.studio.sceneReviews.at(-1).id);
});

test('designated reviewer alone accepts or requests changes and the submitter cannot self-review',()=>{
  const row=submit(edit(raw()));status(()=>act(row,'accept',{confirmed:true}),403);status(()=>act(row,'accept',{confirmed:true},{actor:owner,canReview:true}),409);status(()=>act(row,'accept',{}, {actor:reviewer,canReview:true}),400);assert.equal(item(accept(row)).status,'waiting_customer');status(()=>accept(accept(row)),409);
  const view=report(row,{userId:reviewer,canEdit:false,canReview:true});assert.deepEqual(view.items[0].actions.map(action=>action.action),['accept','request_changes']);
});

test('customer confirmations before submission or before internal acceptance are never applied retroactively',()=>{
  let row=customer(edit(raw()));assert.equal(item(row).status,'open');row=submit(row);assert.equal(item(row).status,'review');row=customer(row);assert.equal(item(row).status,'review');row=accept(row);assert.equal(item(row).status,'waiting_customer');assert.equal(report(row).doneCount,0);row=customer(row);assert.equal(item(row).status,'done');
});

test('only the linked exact current version can complete; newer scene edits become stale',()=>{
  let row=accept(submit(edit(raw())));row=edit(row);assert.equal(item(row).status,'stale');row=customer(row);assert.equal(item(row).status,'stale');assert.equal(report(row).doneCount,0);row=accept(submit(row));assert.equal(item(row).resultRevision,3);assert.equal(item(customer(row)).status,'done');
});

test('new customer changes restart existing waiting and internal review requests and require another revision',()=>{
  for(const pending of [submit(edit(raw())),accept(submit(edit(raw())))]){
    const changed=customer(pending,'changes');assert.equal(report(changed).items.length,2);assert.equal(item(changed).status,'changes_requested');assert.equal(item(changed).canSubmit,false);status(()=>submit(changed),409);const edited=edit(changed);assert.equal(item(edited).canSubmit,true);assert.equal(item(submit(edited)).status,'review');
  }
});

test('internal reject requires a memo and a new version before resubmitting',()=>{
  const row=submit(edit(raw()));status(()=>act(row,'request_changes',{}, {actor:reviewer,canReview:true}),400);let changed=act(row,'request_changes',{note:'문구가 남았습니다.'},{actor:reviewer,canReview:true});assert.equal(item(changed).status,'changes_requested');status(()=>submit(changed),409);changed=act(changed,'start');assert.equal(item(changed).status,'in_progress');status(()=>act(changed,'start'),409);assert.equal(item(submit(edit(changed))).status,'review');
});

test('material metadata changes and missing assets invalidate an already verified submission',()=>{
  let row=raw(),assetId=randomUUID();row.studio.assets=[{id:assetId,fileName:'image.png',diskName:'one.bin'}];row.studio.scenes[0].assetId=assetId;row=accept(submit(edit(row)));row.studio.assets[0].diskName='two.bin';assert.equal(item(row).status,'stale');assert.equal(item(customer(row)).status,'stale');row.studio.assets=[];assert.equal(item(row).status,'unavailable');status(()=>submit(row),409);
});

test('archive, hidden scenes and deleted scenes cannot falsely complete customer requests',()=>{
  const original=accept(submit(edit(raw())));for(const mutation of [row=>row.stage='archived',row=>row.studio.scenes[0].visibility='internal',row=>row.studio.scenes=[]]){const row=structuredClone(original);mutation(row);const view=item(row);assert.ok(['archived','unavailable'].includes(view.status));assert.equal(view.canSubmit,false);assert.equal(report(row).doneCount,0);}
  const hidden=structuredClone(original);hidden.studio.scenes[0].visibility='internal';assert.equal(customerSceneRequests(hidden).items.length,0);status(()=>act({...original,stage:'archived'},'reopen'),409);
});

test('reviewer or owner reassignment invalidates old submission and disabled reviewer cannot be silently bypassed',()=>{
  let row=accept(submit(edit(raw())));row.reviewerId='new-reviewer';assert.equal(item(row).status,'stale');assert.equal(item(submit(row)).status,'review');
  row=accept(submit(edit(raw())));row.ownerId='new-owner';assert.equal(item(row).status,'stale');
  row=edit(raw());const view=report(row,{reviewerId:null});assert.equal(view.items[0].canSubmit,false);assert.equal(view.items[0].status,'stale');status(()=>act(row,'submit',{sceneRevision:2,confirmed:true},{reviewerId:null}),409);
});

test('done applies only to the exact submitted version and reopening preserves history while requiring a new version',()=>{
  let row=customer(accept(submit(edit(raw()))));assert.equal(item(row).status,'done');const oldHistory=row.sceneRequestWorkflows[item(row).id].history.length;row=act(row,'reopen');assert.equal(item(row).status,'open');assert.equal(item(row).canSubmit,false);assert.equal(row.sceneRequestWorkflows[item(row).id].history.length,oldHistory+1);status(()=>act(row,'reopen'),409);assert.equal(item(submit(edit(row))).status,'review');
});

test('one exact customer scene confirmation completes all requests linked to that revision',()=>{
  let row=raw({reviewerId:null});row.studio.sceneReviews.push({...row.studio.sceneReviews[0],id:randomUUID(),text:'두 번째 요청'});row=submit(edit(row));const second=row.studio.sceneReviews[1].id;row=act(row,'submit',{requestId:second,sceneRevision:2,confirmed:true});assert.equal(report(row).pendingCount,2);row=customer(row);assert.equal(report(row).doneCount,2);assert.equal(report(row).pendingCount,0);
});

test('customer projection exposes original public request and status but no internal processing notes or identifiers',()=>{
  const row=accept(submit(edit(raw()))),value=customerSceneRequests(row),serialized=JSON.stringify(value);assert.match(serialized,/문구를 짧게/);assert.doesNotMatch(serialized,/PRIVATE|submittedBy|resultFingerprint|reviewerId|ownerId|actor|history|actions|canSubmit|note/);assert.equal(value.items[0].resultRevision,2);
});

test('strict fields, memo limits, unknown requests and full history reject without dropping records',()=>{
  const row=edit(raw());for(const extra of [{note:'x'.repeat(601)},{note:3},{note:'\u0001'},{ownerId:'forged'}])status(()=>act(row,'start',extra),400);status(()=>act(row,'invent'),400);status(()=>act(row,'start',{requestId:randomUUID()}),404);
  const full=structuredClone(row);full.sceneRequestWorkflows={[item(full).id]:{status:'open',history:Array.from({length:100},()=>({action:'old',at}))}};const before=JSON.stringify(full);status(()=>act(full,'start'),409);assert.equal(JSON.stringify(full),before);
});

test('service checks current ownership roles, exact project revision and allows only designated reviewer inspection',async t=>{
  const f=await fixture(t);for(const [who,code]of [['other',404],['viewer',403],['reviewer',403]])status(()=>f.call('start',{},f.users[who]),code);status(()=>f.call('start',{revision:0}),409);f.sceneEdit();let project=f.call('submit',{sceneRevision:2,confirmed:true});assert.equal(project.sceneRequests.items[0].status,'review');status(()=>f.call('accept',{confirmed:true},f.users.admin),403);project=f.call('accept',{confirmed:true},f.users.reviewer);assert.equal(project.sceneRequests.items[0].status,'waiting_customer');assert.equal(project.sceneRequests.canReview,true);assert.equal(project.sceneRequests.canEdit,false);assert.equal(project.stage,'producing');
});

test('service completion occurs only inside a fresh authenticated customer review transaction',async t=>{
  const f=await fixture(t),opened=f.invite();f.sceneEdit();f.review(opened);f.call('submit',{sceneRevision:2,confirmed:true});f.call('accept',{confirmed:true},f.users.reviewer);assert.equal(f.service.read(opened.session).project.sceneRequests.items[0].status,'waiting_customer');const done=f.review(opened);assert.equal(done.sceneRequests.items[0].status,'done');assert.equal(f.read().sceneRequestWorkflows[f.read().studio.sceneReviews[0].id].customerReviewId,done.studio.sceneReviews.at(-1).id);assert.doesNotMatch(JSON.stringify(done),/sceneRequestWorkflows|resultFingerprint|submittedBy|waitingAt|acceptedBy/);
});

test('live reviewer deactivation blocks acceptance and customer completion until reassigned and resubmitted',async t=>{
  const f=await fixture(t),opened=f.invite();f.sceneEdit();f.call('submit',{sceneRevision:2,confirmed:true});f.call('accept',{confirmed:true},f.users.reviewer);f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,active:false});assert.equal(f.service.workspace(f.users.owner).projects[0].sceneRequests.items[0].status,'stale');assert.equal(f.review(opened).sceneRequests.items[0].status,'stale');status(()=>f.call('accept',{confirmed:true},f.users.reviewer),401);status(()=>f.call('submit',{sceneRevision:2,confirmed:true}),409);
});

test('customer re-request updates old workflow and creates one separate original request in the same revision write',async t=>{
  const f=await fixture(t,{withReviewer:false}),opened=f.invite();f.sceneEdit();f.call('submit',{sceneRevision:2,confirmed:true});const revision=f.read().revision,changed=f.review(opened,'changes');assert.equal(changed.revision,revision+1);assert.equal(changed.sceneRequests.items.length,2);assert.equal(changed.sceneRequests.items[0].status,'changes_requested');assert.equal(changed.sceneRequests.items[1].status,'open');status(()=>f.call('submit',{sceneRevision:2,confirmed:true}),409);assert.equal(f.read().messages.length,0);
});

test('staff and customer projections honor current private-scene visibility and readonly access',async t=>{
  const f=await fixture(t),opened=f.invite();f.sceneEdit();f.call('submit',{sceneRevision:2,confirmed:true,note:'PRIVATE-PROCESS'});const row=f.read();row.studio.scenes[0].visibility='internal';f.store.put('clientProjects',row.id,row);const customer=f.studio.customerState(opened.session).project;assert.equal(customer.sceneRequests.items.length,0);assert.equal(customer.studio.sceneReviews.length,0);assert.doesNotMatch(JSON.stringify(customer),/PRIVATE-PROCESS|sceneRequestWorkflows/);assert.equal(f.studio.staffState(f.users.viewer,row.id).project.sceneRequests.canEdit,false);assert.equal(f.service.workspace(f.users.owner).projects[0].sceneRequests.items[0].status,'unavailable');
});
