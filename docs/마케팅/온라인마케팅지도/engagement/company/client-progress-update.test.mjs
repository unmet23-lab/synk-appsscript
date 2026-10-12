import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientProgressUpdateService} from './client-progress-update.mjs';
import {clientKickoffSources} from './client-kickoff.mjs';
import {applySceneRequestAction,recordSceneReview} from './client-scene-requests.mjs';
import {clientDeliveryIdentity} from './client-closeout.mjs';
import {applyClientChangesAction} from './client-changes.mjs';

const at='2026-10-12T01:00:00.000Z',later='2026-10-13T01:00:00.000Z';
const status=(fn,code)=>assert.throws(fn,error=>error.status===code);
const section=(view,id)=>view.sections.find(item=>item.id===id).lines.join('\n');
const preview=(extra={})=>({id:randomUUID(),kind:'preview',label:'공개 시안',createdAt:at,approvedAt:null,url:'https://example.test/preview',...extra});
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-client-progress-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.includes('synk-client-progress-'));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['reviewer','member','a'],['manager','manager','a'],['viewer','viewer','a'],['other','member','b'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@progress.test',role,teamId});
  let now=at;const clientProjects=createClientProjectsService({store,clock:()=>now}),service=createClientProgressUpdateService({store,clientProjects,clock:()=>now});
  const project=clientProjects.save(users.owner,{title:'진행 안내 합성 프로젝트',customerName:'합성 고객',reviewerId:users.reviewer.id,contact:'PRIVATE-CONTACT',internalNotes:'PRIVATE-NOTE',summary:'공개 요청 내용',terms:'공개 합의 조건',dueDate:'2026-11-10'}).project;
  const read=()=>store.get('clientProjects',project.id),update=fn=>{const row=read();fn(row);store.put('clientProjects',row.id,row);return row;},view=(who=users.owner)=>service.workspace(who,project.id);
  return {store,users,clientProjects,service,project,read,update,view,setNow:value=>now=value};
}

test('read-only generation has four text sections, no AI or persisted draft, and stable text across clock changes',async t=>{
  const f=await fixture(t),before=f.store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all(),tokens=f.store.db.prepare('SELECT * FROM tokens').all(),view=f.view();
  assert.deepEqual(view.sections.map(item=>item.id),['completed','current','customer','schedule']);assert.equal(view.projectId,f.project.id);assert.equal(view.revision,f.read().revision);assert.equal(view.generatedAt,at);assert.equal(view.title,'진행 안내 합성 프로젝트 · 진행 안내');
  assert.ok(view.sections.every(item=>item.lines.every(line=>typeof line==='string')));assert.match(view.text,/합의한 전달일: 2026-11-10/);assert.doesNotMatch(view.text,/PRIVATE|공개 요청 내용|공개 합의 조건/);
  f.setNow(later);assert.equal(f.view().text,view.text);assert.equal(f.view().generatedAt,later);assert.deepEqual(f.store.db.prepare('SELECT * FROM documents ORDER BY kind,id').all(),before);assert.deepEqual(f.store.db.prepare('SELECT * FROM tokens').all(),tokens);
});

test('normal project read ACL allows assigned staff and same-team viewers but rechecks stored access',async t=>{
  const f=await fixture(t);for(const name of ['owner','reviewer','manager','viewer','admin'])assert.equal(f.view(f.users[name]).projectId,f.project.id);
  status(()=>f.view(f.users.other),404);status(()=>f.view(null),401);
  f.store.put('users',f.users.viewer.id,{...f.users.viewer,teamId:'other'});status(()=>f.view(f.users.viewer),404);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.view(f.users.owner),401);
  f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,role:'viewer',teamId:'other'});status(()=>f.view(f.users.reviewer),404);
});

test('private records, internal sources, draft feedback and all non-agreed dates stay out of the response',async t=>{
  const f=await fixture(t);f.update(row=>{
    row.nextContactDate='2031-01-01';row.followUpHistory=[{note:'PRIVATE-FOLLOWUP'}];row.inviteHash='PRIVATE-TOKEN';row.nextStep='공개된 다음 단계';
    row.intake={requestedDeadline:'2032-02-02',notes:'PRIVATE-INTAKE',files:[{kind:'attachment',id:'intake',fileName:'PRIVATE-FILE'}]};
    row.messages=[{id:'private',author:'staff',visibility:'internal',text:'PRIVATE-STAFF-MESSAGE'},{id:'customer-private',author:'customer',visibility:'internal',action:'feedback',text:'PRIVATE-CUSTOMER-RECORD'}];
    row.kickoffPlan={enabled:true,dueDate:'2033-03-03',requirements:[{id:'r',label:'공개 자료',required:true,sourceKey:'intake:intake',waiver:{reason:'PRIVATE-WAIVER'}}]};
    row.schedulePlan={enabled:true,targets:{kickoff:'2034-04-04',delivery:'2035-05-05'},remainingWorkDays:99,internalReviewDays:1,history:[{note:'PRIVATE-SCHEDULE'}]};
    row.studio={assets:[{id:'private',fileName:'PRIVATE-ASSET',author:'staff'}],scenes:[{id:'private',title:'PRIVATE-SCENE',visibility:'internal',revision:1}],sceneReviews:[{id:'review',sceneId:'private',sceneRevision:1,author:'customer',status:'changes',text:'PRIVATE-REVIEW'}],previews:{items:[{label:'PRIVATE-PREVIEW'}]},feedbackRounds:{drafts:{customer:{text:'PRIVATE-DRAFT'}}},strategy:{revision:1,data:{proposedDeadline:'2036-06-06'}},deliverables:{revision:0,items:[],history:[]}};
    row.sceneRequestWorkflows={review:{status:'review',note:'PRIVATE-WORKFLOW'}};
  });
  const result=JSON.stringify(f.view());assert.doesNotMatch(result,/PRIVATE|203[1-6]|intake:intake|sourceKey|sourceFingerprint|inviteHash|\/api\/client/);assert.match(result,/2026-11-10/);assert.match(result,/다음 단계: 공개된 다음 단계/);
});

test('customer action requires an explicit request for the current plan or spec; confirmation never carries across revisions',async t=>{
  const f=await fixture(t);f.update(row=>row.studio={strategy:{revision:2,data:{},request:{strategyRevision:1,author:'staff',at},confirmation:{strategyRevision:1,author:'customer',at}},deliverables:{revision:2,items:[],request:null,confirmation:null,history:[]}});
  assert.doesNotMatch(section(f.view(),'customer'),/현재 제작 기획을 확인|현재 납품 규격을 확인/);assert.doesNotMatch(section(f.view(),'completed'),/고객 확인 완료/);
  f.update(row=>{row.studio.strategy.request={strategyRevision:2,author:'staff',at};row.studio.deliverables.request={deliverableRevision:2,author:'staff',at};});
  assert.match(section(f.view(),'customer'),/현재 제작 기획을 확인/);assert.match(section(f.view(),'customer'),/현재 납품 규격을 확인/);
  f.update(row=>{row.studio.strategy.confirmation={strategyRevision:2,author:'customer',at};row.studio.deliverables.confirmation={deliverableRevision:2,author:'customer',at};});
  assert.match(section(f.view(),'completed'),/제작 기획 고객 확인 완료/);assert.match(section(f.view(),'completed'),/납품 규격 고객 확인 완료/);assert.doesNotMatch(section(f.view(),'customer'),/현재 제작 기획을 확인|현재 납품 규격을 확인/);
  f.update(row=>{row.studio.strategy.revision++;row.studio.deliverables.revision++;});assert.doesNotMatch(section(f.view(),'completed'),/기획 고객 확인 완료|규격 고객 확인 완료/);
});

test('staff-written or unstamped confirmation metadata cannot claim customer confirmation',async t=>{
  const f=await fixture(t);f.update(row=>row.studio={strategy:{revision:1,data:{},request:{strategyRevision:1,author:'staff',at},confirmation:{strategyRevision:1,author:'staff',at}},deliverables:{revision:1,items:[],request:{deliverableRevision:1,author:'staff',at},confirmation:{deliverableRevision:1,author:'customer'},history:[]}});
  assert.doesNotMatch(section(f.view(),'completed'),/고객 확인 완료/);assert.match(section(f.view(),'customer'),/현재 제작 기획을 확인/);assert.match(section(f.view(),'customer'),/현재 납품 규격을 확인/);
});

test('agreement or material changes remain visible even while the current production plan is confirmed',async t=>{
  const f=await fixture(t);let row=f.update(row=>row.studio={strategy:{revision:1,data:{primaryPromise:'제품 특징',evidence1:'제품 자료',desiredAction:'사이트 방문'},request:{strategyRevision:1,author:'staff',at},confirmation:{strategyRevision:1,author:'customer',at}}});
  row.changeControl=applyClientChangesAction(row,{action:'capture',confirmed:true},{actor:f.users.owner.id,at});row.terms='변경된 합의 조건';f.store.put('clientProjects',row.id,row);
  assert.match(section(f.view(),'completed'),/현재 제작 기획 고객 확인 완료/);assert.match(section(f.view(),'current'),/제작 기준 이후 변경된 내용/);assert.doesNotMatch(section(f.view(),'customer'),/현재 제작 기획을 확인/);
});

test('missing, received, approved and waived materials are distinguished without leaking private source names',async t=>{
  const f=await fixture(t);f.update(row=>{
    row.intake={files:[{id:'source',kind:'attachment',fileName:'PRIVATE-SOURCE'}]};
    row.kickoffPlan={enabled:true,requirements:[{id:'missing',required:true,label:'브랜드 로고'},{id:'received',required:true,label:'제품 영상',sourceKey:'intake:source'},{id:'ready',required:true,label:'제품 사진',sourceKey:'intake:source'},{id:'waived',required:true,label:'제외된 자료',waiver:{reason:'PRIVATE-WAIVER'}},{id:'optional',required:false,label:'선택 자료'}]};
    row.kickoffPlan.requirements[2].review={sourceFingerprint:clientKickoffSources(row).find(item=>item.key==='intake:source').fingerprint};
  });
  const view=f.view();assert.match(section(view,'customer'),/브랜드 로고/);assert.doesNotMatch(section(view,'customer'),/제품 영상|제품 사진|제외된 자료|선택 자료/);assert.match(section(view,'current'),/제품 영상.*다시 보내지 않으셔도/);assert.match(section(view,'completed'),/제품 사진/);assert.doesNotMatch(JSON.stringify(view),/PRIVATE/);
  f.update(row=>row.intake.files[0].fileName='PRIVATE-CHANGED-SOURCE');assert.doesNotMatch(section(f.view(),'completed'),/제품 사진/);assert.match(section(f.view(),'current'),/제품 사진/);
});

test('pending staff revision work does not become a customer approval task; current submitted revision does',async t=>{
  const f=await fixture(t),old=preview({approvedAt:at,label:'이전 승인 시안'}),current=preview({label:'현재 수정 시안'});
  f.update(row=>{row.versions=[old,current];row.messages=[{id:'feedback',author:'customer',visibility:'customer',action:'feedback',resolved:false,versionId:old.id,workflow:{status:'review',resultVersionId:current.id,note:'PRIVATE-REVIEW'}}];});
  assert.match(section(f.view(),'current'),/담당자가 확인·반영/);assert.doesNotMatch(section(f.view(),'customer'),/현재 시안을 확인/);assert.doesNotMatch(section(f.view(),'completed'),/승인 완료/);
  f.update(row=>row.messages[0].workflow.status='waiting_customer');assert.match(section(f.view(),'customer'),/현재 시안을 확인.*현재 수정 시안/);
  f.update(row=>row.versions.push(preview({label:'새 시안'})));assert.doesNotMatch(section(f.view(),'customer'),/현재 시안을 확인/);
});

test('approved current preview only counts revision work completed for that exact preview',async t=>{
  const f=await fixture(t),old=preview({approvedAt:at}),current=preview({approvedAt:later,label:'현재 승인 시안'});
  f.update(row=>{row.versions=[old,current];row.messages=[old,current].map(version=>({id:randomUUID(),author:'customer',visibility:'customer',action:'feedback',resolved:true,workflow:{status:'done',resultVersionId:version.id}}));});
  assert.match(section(f.view(),'completed'),/현재 시안 고객 승인 완료: 현재 승인 시안/);assert.match(section(f.view(),'completed'),/수정 요청 1건 고객 확인 완료/);
});

test('scene status binds the public current scene, actual customer review and live reviewer authority',async t=>{
  const f=await fixture(t),sceneId=randomUUID(),requestId=randomUUID();let row=f.update(row=>{row.studio={scenes:[{id:sceneId,title:'제품 강조 장면',revision:2,visibility:'customer'}],sceneReviews:[{id:requestId,sceneId,sceneRevision:1,author:'customer',status:'changes',text:'고객 수정 의견',at}]};});
  row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'submit',requestId,sceneRevision:2,confirmed:true},{actor:f.users.owner.id,at,canEdit:true,reviewerId:f.users.reviewer.id});f.store.put('clientProjects',row.id,row);
  assert.doesNotMatch(section(f.view(),'customer'),/수정 장면을 확인/);assert.match(section(f.view(),'current'),/장면 수정 요청 1건/);
  row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'accept',requestId,confirmed:true},{actor:f.users.reviewer.id,at,canReview:true,reviewerId:f.users.reviewer.id});f.store.put('clientProjects',row.id,row);assert.match(section(f.view(),'customer'),/수정 장면을 확인.*제품 강조 장면/);
  const proof={id:randomUUID(),sceneId,sceneRevision:2,author:'customer',status:'confirmed',at:later};row.sceneRequestWorkflows=recordSceneReview(row,proof);row.studio.sceneReviews.push(proof);f.store.put('clientProjects',row.id,row);assert.match(section(f.view(),'completed'),/수정 장면 고객 확인 완료/);
  f.store.put('users',f.users.reviewer.id,{...f.users.reviewer,active:false});assert.doesNotMatch(section(f.view(),'completed'),/수정 장면 고객 확인 완료/);
  f.update(row=>row.studio.scenes[0].visibility='internal');assert.doesNotMatch(JSON.stringify(f.view()),/제품 강조 장면|고객 수정 의견/);
});

test('a workflow done flag alone is not evidence that a customer confirmed a scene',async t=>{
  const f=await fixture(t),sceneId=randomUUID(),requestId=randomUUID();let row=f.update(row=>{row.studio={scenes:[{id:sceneId,title:'공개 장면',revision:2,visibility:'customer'}],sceneReviews:[{id:requestId,sceneId,sceneRevision:1,author:'customer',status:'changes',at}]};});
  row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'submit',requestId,sceneRevision:2,confirmed:true},{actor:f.users.owner.id,at,canEdit:true,reviewerId:f.users.reviewer.id});row.sceneRequestWorkflows[requestId].status='done';f.store.put('clientProjects',row.id,row);
  assert.doesNotMatch(section(f.view(),'completed'),/수정 장면 고객 확인 완료/);
});

test('delivery and receipt completion binds the latest approved preview and entire final file set',async t=>{
  const f=await fixture(t),approved=preview({approvedAt:at}),final={id:randomUUID(),kind:'final',label:'현재 최종 영상',approvedPreviewId:approved.id,url:'https://example.test/final',guide:'공개 안내',createdAt:at};
  let row=f.update(row=>{row.stage='delivered';row.versions=[approved,final];row.nextStep='최종 파일과 사용 안내를 확인해 주세요. 추가로 궁금한 점은 후속 문의에 남겨 주세요.';});assert.match(section(f.view(),'customer'),/파일과 안내 확인했어요/);assert.match(section(f.view(),'schedule'),/프로젝트에 기록된 다음 단계/);
  row.deliveryReceipts=[{id:randomUUID(),deliveryKey:clientDeliveryIdentity(row).deliveryKey,actor:'customer',confirmedAt:later}];f.store.put('clientProjects',row.id,row);assert.match(section(f.view(),'completed'),/고객 수령 확인 완료/);assert.doesNotMatch(section(f.view(),'customer'),/파일과 안내 확인했어요/);assert.doesNotMatch(section(f.view(),'schedule'),/최종 파일과 사용 안내를 확인해 주세요/);
  f.update(row=>row.versions.push({...final,id:randomUUID(),label:'자막 파일'}));assert.doesNotMatch(section(f.view(),'completed'),/고객 수령 확인 완료/);assert.match(section(f.view(),'customer'),/파일과 안내 확인했어요/);
  f.update(row=>row.versions.push(preview({label:'새 미승인 시안'})));assert.doesNotMatch(section(f.view(),'completed'),/시안 고객 승인 완료|최종 파일 등록 완료|고객 수령 확인 완료/);assert.doesNotMatch(section(f.view(),'customer'),/파일과 안내 확인했어요/);
});

test('staff receipt metadata, internal closure and manual delivered stage cannot manufacture customer completion',async t=>{
  const f=await fixture(t),approved=preview({approvedAt:at});let row=f.update(row=>{row.stage='delivered';row.versions=[approved,{id:randomUUID(),kind:'final',approvedPreviewId:approved.id,label:'공개 최종본',createdAt:at}];row.closureHistory=[{note:'PRIVATE-CLOSURE'}];});
  row.deliveryReceipts=[{deliveryKey:clientDeliveryIdentity(row).deliveryKey,actor:'staff',confirmedAt:at}];f.store.put('clientProjects',row.id,row);assert.doesNotMatch(section(f.view(),'completed'),/고객 수령 확인 완료|마감 완료/);
  f.update(row=>row.versions=[]);assert.doesNotMatch(section(f.view(),'completed'),/납품|최종 파일 등록 완료|고객 수령 확인 완료/);
});

test('archived projects remain readable without actionable customer requests and missing agreement stays explicit',async t=>{
  const f=await fixture(t);f.update(row=>{row.stage='archived';row.dueDate='';row.versions=[preview()];row.kickoffPlan={enabled:true,requirements:[{id:'missing',required:true,label:'브랜드 로고'}]};row.studio={strategy:{revision:1,data:{proposedDeadline:'2030-01-01'},request:{strategyRevision:1,author:'staff',at}}};});
  assert.match(section(f.view(),'current'),/보관 중/);assert.doesNotMatch(section(f.view(),'customer'),/올리거나|확인해 주세요|승인을 남겨/);assert.match(section(f.view(),'schedule'),/아직 기록되지 않았습니다/);assert.doesNotMatch(f.view().text,/2030-01-01/);
});

test('fresh generation immediately reflects source edits without changing project revision itself',async t=>{
  const f=await fixture(t),before=f.view();f.clientProjects.message(f.users.owner,f.project.id,{revision:f.read().revision,text:'PRIVATE-INTERNAL-EDIT',visibility:'internal'});const view=f.view();assert.equal(view.revision,before.revision+1);assert.equal(view.text,before.text);assert.equal(f.read().revision,view.revision);
});
