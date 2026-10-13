import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {emptyStrategyData} from './pulse-strategy.mjs';
import {buildClientKickoff,customerClientKickoff,clientKickoffSources,applyClientKickoffAction} from './client-kickoff.mjs';

const at='2026-10-12T03:00:00.000Z';
const strategyData=()=>({...emptyStrategyData(),objective:'sales',product:'서비스',audience:'신규 고객',primaryPromise:'쉬운 시작',evidence1:'직접 확인할 수 있는 사용 장면',memoryHook:'한 장면',desiredAction:'자료 다 받기',channels:['website'],value1:'빠름',value2:'편리함',subtitles:'자막 원문',screenCopy:'화면 문구',proposedDeadline:'2026-10-20'});
function raw(){return {id:randomUUID(),title:'합성 착수 프로젝트',stage:'planning',terms:'영상 1편',dueDate:'2026-10-22',versions:[],messages:[],history:[],studio:{schemaVersion:1,preferences:{},strategy:{revision:1,data:strategyData(),confirmation:{strategyRevision:1}},assets:[],references:[],concepts:[],scenes:[],history:[],conceptSelections:[],sceneReviews:[],comments:[]}};}
const run=(row,input,options={})=>({...row,kickoffPlan:applyClientKickoffAction(row,input,{actor:'staff-id',at,...options})});
const configure=(row,requirements=[],extra={})=>run(row,{action:'configure',enabled:true,dueDate:'2026-10-12',requirements,...extra});
const requirement=(label='로고',sourceKey='')=>({label,required:true,sourceKey});
const status=(action,code)=>assert.throws(action,error=>error.status===code);
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-kickoff-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','team-a'],['reviewer','member','team-a'],['other','member','team-b'],['manager','manager','team-a'],['viewer','viewer','team-a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@kickoff.test',role,teamId});
  const service=createClientProjectsService({store}),studio=createPulseStudioService({store,clientProjects:service});
  let project=service.save(users.owner,{title:'합성 착수',customerName:'테스트 고객',terms:'영상 1편',dueDate:'2026-10-22',stage:'planning',reviewerId:users.reviewer.id}).project;
  const template=raw();store.put('clientProjects',project.id,{...store.get('clientProjects',project.id),studio:template.studio});
  const read=()=>store.get('clientProjects',project.id),call=(input,user=users.owner)=>service.kickoff(user,project.id,{revision:read().revision,...input}).project;
  const start=(requirements=[requirement('자막','strategy:subtitles')])=>call({action:'configure',enabled:true,dueDate:'2026-10-12',requirements});
  const invite=()=>{const result=service.invite(users.owner,project.id,{revision:read().revision});return service.open(result.invite);};
  return {store,service,studio,users,project,read,call,start,invite};
}

test('legacy projects remain opt-in; KST due day starts at midnight and completed/archived stages do not become overdue',()=>{
  let row=raw();assert.equal(buildClientKickoff(row).enabled,false);assert.equal(buildClientKickoff(row).status,'disabled');
  row=configure(row,[requirement()]);assert.equal(buildClientKickoff(row,{now:'2026-10-11T14:59:59Z'}).overdue,false);assert.equal(buildClientKickoff(row,{now:'2026-10-11T15:00:00Z'}).overdue,true);
  assert.equal(buildClientKickoff({...row,stage:'delivered'},{now:at}).overdue,false);assert.equal(buildClientKickoff({...row,stage:'archived'},{now:at,canEdit:true}).status,'archived');assert.equal(buildClientKickoff({...row,stage:'archived'},{now:at,canEdit:true}).canEdit,false);
});

test('received sources require explicit exact-fingerprint review, and source edits immediately invalidate approval',()=>{
  let row=configure(raw(),[requirement('자막','strategy:subtitles')]),view=buildClientKickoff(row),item=view.requirements[0];assert.equal(item.status,'received');assert.equal(view.missingCount,1);
  status(()=>run(row,{action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint}),400);
  row=run(row,{action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint,confirmed:true});assert.equal(buildClientKickoff(row).status,'ready');
  row.studio.strategy.data.subtitles='바뀐 자막';assert.equal(buildClientKickoff(row).requirements[0].status,'received');status(()=>run(row,{action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint,confirmed:true}),409);
});

test('asset replacement, reference changes and source removal all invalidate the matching source review',()=>{
  for(const kind of ['asset','reference','intake']){
    let row=raw(),id=randomUUID(),key=kind+':'+id;
    if(kind==='asset')row.studio.assets.push({id,fileName:'logo.png',mimeType:'image/png',byteSize:10,diskName:'old.bin',author:'customer'});
    if(kind==='reference')row.studio.references.push({id,label:'브랜드 참고',url:'https://example.test/old',reason:'참고',author:'customer'});
    if(kind==='intake')row.intake={files:[{id,kind:'attachment',fileName:'logo.png',sha256:'old'}]};
    row=configure(row,[requirement('로고',key)]);let item=buildClientKickoff(row).requirements[0];row=run(row,{action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint,confirmed:true});assert.equal(buildClientKickoff(row).status,'ready');
    if(kind==='asset')row.studio.assets[0].diskName='replacement.bin';if(kind==='reference')row.studio.references[0].url='https://example.test/new';if(kind==='intake')row.intake.files[0].sha256='new';assert.equal(buildClientKickoff(row).requirements[0].status,'received');
    if(kind==='asset')row.studio.assets=[];if(kind==='reference')row.studio.references=[];if(kind==='intake')row.intake.files=[];assert.equal(buildClientKickoff(row).requirements[0].status,'missing');
  }
});

test('current strategy confirmation, real agreed deadline and stated terms are independent readiness checks',()=>{
  let row=configure(raw());assert.equal(buildClientKickoff(row).status,'ready');
  row.studio.strategy.revision=2;row.dueDate='';row.terms='';let report=buildClientKickoff(row);assert.equal(report.missingCount,3);assert.equal(report.requestedDeadline,'2026-10-20');assert.equal(report.confirmedDeadline,'');
  row.studio.strategy.data.primaryPromise='';report=buildClientKickoff(row);assert.equal(report.missingCount,4);assert.match(report.checks[0].text,/핵심 약속/);
});

test('optional items do not block readiness; explicit waiver and reset preserve the received-versus-reviewed distinction',()=>{
  let row=configure(raw(),[{...requirement('선택 사진'),required:false},requirement('필수 로고')]),item=buildClientKickoff(row).requirements[1];assert.equal(buildClientKickoff(row).missingCount,1);
  status(()=>run(row,{action:'waive',requirementId:item.id,reason:' '}),400);row=run(row,{action:'waive',requirementId:item.id,reason:'이번 제작에 사용하지 않음'});assert.equal(buildClientKickoff(row).status,'ready');assert.equal(buildClientKickoff(row).requirements[1].status,'waived');
  row=run(row,{action:'reset',requirementId:item.id});assert.equal(buildClientKickoff(row).requirements[1].status,'missing');status(()=>run(row,{action:'reset',requirementId:item.id}),409);
});

test('customer projection never exposes private asset/intake filenames, storage keys, staff actors or waiver reasons',()=>{
  let row=raw(),privateId=randomUUID(),publicId=randomUUID(),intakeId=randomUUID();row.studio.assets=[{id:privateId,fileName:'PRIVATE-FILE',diskName:'PRIVATE-STORAGE',author:'staff'},{id:publicId,fileName:'고객 로고',diskName:'PUBLIC-STORAGE',author:'customer'}];row.intake={requestedDeadline:'INTERNAL-INTAKE-DATE',files:[{id:intakeId,kind:'attachment',fileName:'INTAKE-PRIVATE',diskName:'INTAKE-STORAGE'},{id:randomUUID(),kind:'document',fileName:'ORIGINAL-DOCUMENT'}]};
  row=configure(row,[requirement('로고','asset:'+privateId),requirement('사진','intake:'+intakeId)]);row=run(row,{action:'waive',requirementId:row.kickoffPlan.requirements[1].id,reason:'PRIVATE-WAIVER'});
  const customer=customerClientKickoff(row),serialized=JSON.stringify(customer);assert.doesNotMatch(serialized,/PRIVATE|STORAGE|staff-id|ORIGINAL-DOCUMENT|requestText|waiverReason/);assert.equal(customer.requirements[0].sourceKey,'');assert.equal(customer.requirements[1].status,'waived');assert.equal(customer.sources.length,3);
  assert.equal(clientKickoffSources(row).some(source=>source.label==='ORIGINAL-DOCUMENT'),false);assert.equal(row.studio.assets[0].author,'staff');
});

test('public reference exposes its already-public asset but connecting a private asset never publishes it',()=>{
  let row=raw(),id=randomUUID();row.studio.assets=[{id,fileName:'staff.png',author:'staff'}];row=configure(row,[requirement('로고','asset:'+id)]);assert.equal(customerClientKickoff(row).sources.some(source=>source.key==='asset:'+id),false);
  row.studio.references=[{id:randomUUID(),label:'고객 공유 참고',assetId:id}];assert.equal(customerClientKickoff(row).sources.some(source=>source.key==='asset:'+id),true);assert.ok(customerClientKickoff(row).sources.every(source=>!source.url||!source.url.startsWith('/api/')));
});

test('configure retains unchanged review and waiver, resets changed meaning, and validates duplicate/unknown inputs',()=>{
  let row=configure(raw(),[requirement('자막','strategy:subtitles')]),item=buildClientKickoff(row).requirements[0];row=run(row,{action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint,confirmed:true});
  const values=()=>row.kickoffPlan.requirements.map(({id,label,required,sourceKey})=>({id,label,required,sourceKey}));row=configure(row,values(),{dueDate:'2026-10-13'});assert.equal(buildClientKickoff(row).requirements[0].status,'ready');
  row=configure(row,values().map(item=>({...item,label:'수정 자막'})));assert.equal(buildClientKickoff(row).requirements[0].status,'received');
  status(()=>configure(row,[requirement('중복'),requirement('중복')]),400);status(()=>configure(row,Array.from({length:21},(_,i)=>requirement('자료'+i))),400);status(()=>configure(row,[{...requirement(),id:randomUUID()}]),409);status(()=>configure(row,[{...requirement(),review:{sourceFingerprint:'forged'}}]),400);status(()=>configure(row,values(),{dueDate:'2026-02-30'}),400);status(()=>run(row,{action:'configure',enabled:true,dueDate:'',requirements:[],sourceFingerprint:'forged'}),400);
});

test('request text asks only for missing sources and distinguishes received items pending staff review',()=>{
  const row=configure(raw(),[requirement('로고'),requirement('자막','strategy:subtitles')]),report=buildClientKickoff(row);assert.match(report.requestText,/보내 주실 자료: 로고/);assert.match(report.requestText,/받았고 저희가 보는 중: 자막/);assert.match(report.requestText,/다시 보내지 않으셔도/);assert.doesNotMatch(report.requestText,/필요한 자료: 로고, 자막/);
});

test('service enforces current staff permission, one project revision, strict fields and archived-write lock',async t=>{
  const f=await fixture(t),project=f.start(),item=project.kickoff.requirements[0],review={action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint,confirmed:true};
  for(const [who,code]of [['viewer',403],['reviewer',403],['other',404]])status(()=>f.call(review,f.users[who]),code);
  status(()=>f.call({...review,ownerId:f.users.owner.id}),400);status(()=>f.call({...review,revision:project.revision-1}),409);
  const updated=f.call(review,f.users.manager);assert.equal(updated.kickoff.status,'ready');assert.equal(updated.revision,project.revision+1);assert.equal(f.read().messages.length,0);assert.equal(updated.stage,'planning');assert.equal(updated.kickoff.canEdit,true);
  status(()=>f.call(review),409);f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.call({action:'reset',requirementId:item.id}),401);
  f.store.put('clientProjects',project.id,{...f.read(),stage:'archived'});status(()=>f.call({action:'reset',requirementId:item.id},f.users.admin),409);
});

test('customer submission stays in session project, checks current CSRF/revision and never counts arrival as content approval',async t=>{
  const f=await fixture(t);f.start([requirement('자막')]);const opened=f.invite(),item=opened.project.kickoff.requirements[0],input={action:'submit_kickoff_source',revision:opened.project.revision,requirementId:item.id,sourceKey:'strategy:subtitles'};
  status(()=>f.service.customerAction(opened.session,'bad',input),403);status(()=>f.service.customerAction(opened.session,opened.csrf,{...input,projectId:randomUUID()}),400);status(()=>f.service.customerAction(opened.session,opened.csrf,{...input,revision:input.revision-1}),409);
  const before=f.read(),submitted=f.studio.customerAction(opened.session,opened.csrf,input).project;assert.equal(submitted.kickoff.requirements[0].status,'received');assert.equal(submitted.revision,before.revision+1);assert.equal(submitted.messages.length,0);assert.equal(submitted.stage,before.stage);assert.equal(f.read().kickoffPlan.requirements[0].review,undefined);assert.equal(submitted.studio.strategy.data.subtitles,'자막 원문');
  status(()=>f.service.customerAction(opened.session,opened.csrf,{...input,revision:submitted.revision}),409);status(()=>f.service.customerAction(opened.session,opened.csrf,input),409);
});

test('customer cannot link private files or forge a review, and revocation prevents later writes',async t=>{
  const f=await fixture(t),privateId=randomUUID();f.store.put('clientProjects',f.project.id,{...f.read(),studio:{...f.read().studio,assets:[{id:privateId,fileName:'PRIVATE-ASSET',author:'staff'}]}});f.start([requirement('로고')]);const opened=f.invite(),item=opened.project.kickoff.requirements[0],input={action:'submit_kickoff_source',revision:opened.project.revision,requirementId:item.id,sourceKey:'asset:'+privateId};
  status(()=>f.service.customerAction(opened.session,opened.csrf,input),404);status(()=>f.service.customerAction(opened.session,opened.csrf,{...input,sourceKey:'strategy:subtitles',confirmed:true}),400);assert.doesNotMatch(JSON.stringify(opened.project),/PRIVATE-ASSET|sourceFingerprint|waiverReason|updatedBy/);
  f.service.revoke(f.users.owner,f.project.id,{revision:f.read().revision});status(()=>f.service.customerAction(opened.session,opened.csrf,{...input,revision:f.read().revision,sourceKey:'strategy:subtitles'}),401);
});

test('server projection recalculates after new strategy and disabling removes overdue status without erasing requirements',async t=>{
  const f=await fixture(t),started=f.start(),item=started.kickoff.requirements[0];f.call({action:'review',requirementId:item.id,sourceFingerprint:item.sourceFingerprint,confirmed:true});assert.equal(f.service.workspace(f.users.owner).projects[0].kickoff.status,'ready');
  const strategy={...f.read().studio.strategy,revision:2,confirmation:null,data:{...f.read().studio.strategy.data,subtitles:'두 번째 자막'}};f.store.put('clientProjects',f.project.id,{...f.read(),studio:{...f.read().studio,strategy}});const changed=f.service.workspace(f.users.owner).projects[0].kickoff;assert.equal(changed.requirements[0].status,'received');assert.equal(changed.missingCount,2);
  const disabled=f.call({action:'configure',enabled:false,dueDate:'2026-10-12',requirements:f.read().kickoffPlan.requirements.map(({id,label,required,sourceKey})=>({id,label,required,sourceKey}))});assert.equal(disabled.kickoff.status,'disabled');assert.equal(disabled.kickoff.overdue,false);assert.equal(disabled.kickoff.requirements.length,1);assert.equal(f.studio.staffState(f.users.owner,f.project.id).project.kickoff.status,'disabled');assert.equal(f.service.workspace(f.users.viewer).projects[0].kickoff.canEdit,false);
});
