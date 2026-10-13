import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createPulseStudioService} from './pulse-studio.mjs';
import {emptyStrategyData,applyStrategyAction} from './pulse-strategy.mjs';
import {buildClientChanges,customerClientChanges,applyClientChangesAction} from './client-changes.mjs';

const at='2026-10-12T03:00:00.000Z';
const data=()=>({...emptyStrategyData(),objective:'sales',product:'서비스',audience:'신규 고객',primaryPromise:'쉬운 시작',evidence1:'세 단계 사용 장면',memoryHook:'한 장면',desiredAction:'자료 다 받기',channels:['website'],value1:'빠름',value2:'편리함',durationSeconds:30,subtitles:'자막 원문',screenCopy:'화면 문구'});
function raw(){return {id:randomUUID(),title:'합성 변경 프로젝트',stage:'producing',terms:'영상 1편',dueDate:'2026-10-22',revision:1,versions:[],messages:[],history:[],internalNotes:'PRIVATE-NOTE',intake:{files:[{id:randomUUID(),fileName:'PRIVATE-INTAKE'}]},studio:{schemaVersion:1,preferences:{},strategy:{revision:1,data:data(),confirmation:{strategyRevision:1}},assets:[],references:[],concepts:[],scenes:[],history:[],conceptSelections:[],sceneReviews:[],comments:[]}};}
const run=(row,input)=>({...row,changeControl:applyClientChangesAction(row,input,{actor:'STAFF-ACTOR',at})});
const capture=row=>run(row,{action:'capture',confirmed:true});
const report=row=>buildClientChanges(row,{canEdit:true,now:at});
const status=(fn,code)=>assert.throws(fn,error=>error.status===code);
function change(row,fields={durationSeconds:60}){row=structuredClone(row);row.studio.strategy=applyStrategyAction(row.studio.strategy,{action:'save_strategy',strategy:{...row.studio.strategy.data,...fields}},{author:'staff',authorId:'STAFF-ACTOR',authorName:'합성 직원',at});return row;}
function confirm(row){row=structuredClone(row);row.studio.strategy.confirmation={strategyRevision:row.studio.strategy.revision,author:'customer',at};return row;}
function review(row,id='schedule',more={}){return run(row,{action:'review',changeKey:report(row).changeKey,impactId:id,decision:'unchanged',confirmed:true,...more});}
function reviewed(row){for(const impact of report(row).impacts)row=review(row,impact.id);return row;}
function advance(row){return run(row,{action:'advance',changeKey:report(row).changeKey,confirmed:true});}

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-changes-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','team-a'],['reviewer','member','team-a'],['other','member','team-b'],['manager','manager','team-a'],['viewer','viewer','team-a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@changes.test',role,teamId});
  const service=createClientProjectsService({store}),studio=createPulseStudioService({store,clientProjects:service});
  const project=service.save(users.owner,{title:'합성 변경',customerName:'테스트 고객',terms:'영상 1편',dueDate:'2026-10-22',stage:'producing',reviewerId:users.reviewer.id}).project;
  store.put('clientProjects',project.id,{...store.get('clientProjects',project.id),studio:raw().studio});
  const read=()=>store.get('clientProjects',project.id),call=(input,user=users.owner)=>service.changes(user,project.id,{revision:read().revision,...input}).project;
  const invite=()=>{const result=service.invite(users.owner,project.id,{revision:read().revision});return service.open(result.invite);};
  return {store,service,studio,users,project,read,call,invite};
}

test('legacy projects remain disabled and reads never capture a baseline or alter source data',()=>{
  const row=raw(),serialized=JSON.stringify(row);assert.equal(report(row).status,'disabled');assert.equal(report(row).canCapture,true);assert.equal(report(row).baseline,null);assert.equal(JSON.stringify(row),serialized);
  const started=capture(row);assert.equal(report(started).status,'clean');assert.equal(report(started).enabled,true);assert.equal(row.changeControl,undefined);assert.equal(started.changeControl.baseline.strategyRevision,1);assert.equal(report(started).canCapture,false);
});

test('capture independently requires ready current confirmed strategy, an agreed date, and terms',()=>{
  for(const edit of [row=>row.studio.strategy.data.evidence1='',row=>row.studio.strategy.confirmation=null,row=>row.dueDate='',row=>row.dueDate='2026-02-30',row=>row.terms=' ']){const row=raw();edit(row);assert.equal(report(row).canCapture,false);assert.ok(report(row).captureBlockers.length);status(()=>capture(row),409);}
  status(()=>run(raw(),{action:'capture',confirmed:false}),400);status(()=>capture(capture(raw())),409);status(()=>capture({...raw(),stage:'archived'}),409);
});

test('baseline pins only sanitized strategy and existing public source metadata, never private originals',()=>{
  const row=raw(),privateId=randomUUID(),publicId=randomUUID();row.studio.strategy.data.unknownInternal='PRIVATE-STRATEGY';row.studio.assets=[{id:privateId,fileName:'PRIVATE-FILE',author:'staff',diskName:'PRIVATE-STORAGE'},{id:publicId,fileName:'공유 로고',author:'customer',diskName:'PUBLIC-STORAGE'}];
  const baseline=capture(row).changeControl.baseline,serialized=JSON.stringify(baseline);assert.doesNotMatch(serialized,/PRIVATE|STORAGE|internalNotes|unknownInternal/);assert.equal(baseline.sources.length,1);assert.equal(baseline.sources[0].key,'asset:'+publicId);assert.equal(baseline.sources[0].fingerprint.length,64);assert.equal(baseline.sources[0].url,undefined);
});

test('structured field changes show meaningful before and after values and separate agreed versus desired dates',()=>{
  let row=change(capture(raw()),{durationSeconds:60,channels:['youtube','instagram'],budgetProduction:0,screenCopy:'새 문구',proposedDeadline:'2026-10-25'});row.dueDate='2026-10-29';row.terms='영상 2편';const view=report(row);
  assert.equal(view.status,'pending');assert.equal(view.changes.length,7);assert.deepEqual(view.changes.find(item=>item.id==='strategy:durationSeconds'),{id:'strategy:durationSeconds',kind:'strategy',label:'희망 영상 길이',before:'30초',after:'60초'});assert.equal(view.changes.find(item=>item.id==='strategy:budgetProduction').after,'0원');assert.equal(view.changes.find(item=>item.id==='dueDate').after,'2026-10-29');assert.equal(view.changes.find(item=>item.id==='strategy:proposedDeadline').after,'2026-10-25');assert.match(view.changes.find(item=>item.id==='strategy:channels').after,/유튜브, 인스타그램/);
});

test('casting model and styling changes produce readable before and after summaries from the current catalog',()=>{
  let row=raw();row.studio.strategy.data.castingSelection={...row.studio.strategy.data.castingSelection,modelId:'M01',hair:'long-straight',makeup:'natural',jacket:'none',top:'shirt',bottom:'denim',voice:'A',earrings:'none',ring:'simple',notes:'흰 셔츠'};
  row=change(capture(row),{castingSelection:{...row.studio.strategy.data.castingSelection,modelId:'F01',hair:'bob',voice:'B',notes:'파란 셔츠'}});
  const view=report(row),diff=view.changes.find(item=>item.id==='strategy:castingSelection');assert.equal(view.changes.length,1);assert.equal(diff.label,'모델·스타일 선택');assert.match(diff.before,/모델: 이안 \(M01\)/);assert.match(diff.after,/모델: 유나 \(F01\)/);assert.match(diff.before,/헤어: 긴 생머리/);assert.match(diff.after,/헤어: 단발/);assert.match(diff.before,/목소리: A · 차분한 중저음/);assert.match(diff.after,/목소리: B · 밝고 또렷한/);assert.match(diff.before,/자켓: 없음/);assert.match(diff.before,/상의: 셔츠/);assert.match(diff.before,/하의: 데님/);assert.match(diff.after,/기타·메모: 파란 셔츠/);assert.doesNotMatch(JSON.stringify(diff),/\[object Object\]/);assert.deepEqual(customerClientChanges(row).changes,[diff]);assert.equal(view.status,'pending');
});

test('casting clearing and legacy absent defaults distinguish real selection changes from schema additions',()=>{
  let row=capture(raw());delete row.changeControl.baseline.strategy.castingSelection;assert.equal(report(row).changes.length,0);assert.equal(report(row).status,'clean');
  row=change(row,{castingSelection:{...row.studio.strategy.data.castingSelection,modelId:'F04',hair:'wave'}});let diff=report(row).changes.find(item=>item.id==='strategy:castingSelection');assert.equal(diff.before,'미선택');assert.match(diff.after,/모델: 지유 \(F04\)/);assert.match(diff.after,/헤어: 웨이브/);
  row=advance(reviewed(confirm(row)));row=change(row,{castingSelection:emptyStrategyData().castingSelection});diff=report(row).changes.find(item=>item.id==='strategy:castingSelection');assert.match(diff.before,/지유/);assert.equal(diff.after,'미선택');
});

test('legacy structured values use faithful JSON instead of object coercion in change summaries',()=>{
  let row=raw();row.studio.strategy.data.notes={parts:[{label:'첫 장면',count:0}],enabled:false};row=capture(row);row.studio.strategy.data.notes={parts:[{label:'둘째 장면',count:2}],enabled:true};const diff=report(row).changes.find(item=>item.id==='strategy:notes');assert.deepEqual(JSON.parse(diff.before),{parts:[{label:'첫 장면',count:0}],enabled:false});assert.deepEqual(JSON.parse(diff.after),{parts:[{label:'둘째 장면',count:2}],enabled:true});assert.doesNotMatch(diff.before+diff.after,/\[object Object\]/);
});

test('only old-strategy scenes are candidate impacts, including internal scenes for staff',()=>{
  let row=raw();const old=randomUUID(),legacy=randomUUID(),current=randomUUID();row.studio.scenes=[{id:old,title:'이전 장면',strategyRevision:1,visibility:'customer'},{id:legacy,title:'PRIVATE-SCENE',visibility:'internal'},{id:current,title:'새 기획 장면',strategyRevision:2,visibility:'customer'}];row=change(capture(row));const view=report(row);
  assert.deepEqual(view.impacts.filter(item=>item.kind==='scene').map(item=>item.sceneId),[old,legacy]);assert.ok(view.impacts.every(item=>item.checked===false));assert.equal(view.pendingCount,5);assert.doesNotMatch(JSON.stringify(customerClientChanges(row)),/PRIVATE-SCENE|sceneId|impacts/);
});

test('shared reference and asset changes find referencing scenes even without strategy changes',()=>{
  let row=raw(),assetId=randomUUID(),referenceId=randomUUID(),sceneId=randomUUID();row.studio.assets=[{id:assetId,fileName:'logo.png',author:'customer'}];row.studio.references=[{id:referenceId,label:'로고 참고',assetId,reason:'기존 의미'}];row.studio.scenes=[{id:sceneId,title:'로고 장면',assetId,strategyRevision:1}];row=capture(row);row.studio.references[0].reason='새 의미';
  const view=report(row);assert.equal(view.changes.length,1);assert.equal(view.changes[0].kind,'source');assert.equal(view.impacts[0].sceneId,sceneId);assert.equal(view.pendingCount,3);assert.match(view.impacts[0].reason,/공유 자료/);
  row.studio.assets[0].diskName='new-bytes.bin';assert.equal(report(row).changes.length,2);
});

test('all staff reviews cannot replace the current customer strategy confirmation',()=>{
  let row=reviewed(change(capture(raw())));assert.equal(report(row).status,'pending');assert.equal(report(row).pendingCount,1);assert.equal(report(row).canAdvance,false);status(()=>advance(row),409);
  const key=report(row).changeKey;row=confirm(row);assert.equal(report(row).changeKey,key);assert.equal(report(row).status,'reviewed');assert.equal(report(row).canAdvance,true);const before=structuredClone(row),updated=advance(row);
  assert.equal(report(updated).status,'clean');assert.equal(updated.changeControl.pastBaselines.length,1);assert.equal(updated.changeControl.pastBaselines[0].checks.length,2);assert.equal(updated.changeControl.baseline.strategyRevision,2);assert.equal(updated.stage,before.stage);assert.equal(updated.terms,before.terms);assert.deepEqual(updated.messages,before.messages);
});

test('explicit review decision, confirmation, strict fields and current impact keys are required',()=>{
  const row=change(capture(raw())),key=report(row).changeKey;
  for(const values of [{confirmed:false},{decision:'maybe'},{note:'x'.repeat(601)},{note:12},{note:'\u0001'}])status(()=>review(row,'schedule',values),400);
  status(()=>review(row,'schedule',{actor:'forged'}),400);status(()=>review(row,'nonexistent'),404);status(()=>review(row,'schedule',{changeKey:key+'x'}),409);status(()=>run(row,{action:'invent'}),400);status(()=>advance(row),409);
  const done=review(row,'schedule',{decision:'updated',note:'범위 확인'});assert.equal(report(done).impacts[0].decision,'updated');assert.equal(report(done).impacts[0].note,'범위 확인');status(()=>review(done),409);
});

test('review reset retains audit evidence and requires a fresh explicit review',()=>{
  let row=review(change(capture(raw())));row=run(row,{action:'reset',changeKey:report(row).changeKey,impactId:'schedule'});assert.equal(report(row).impacts[0].checked,false);assert.equal(row.changeControl.checks[0].resetAt,at);assert.equal(row.changeControl.checks[0].resetBy,'STAFF-ACTOR');status(()=>run(row,{action:'reset',changeKey:report(row).changeKey,impactId:'schedule'}),409);
  row=review(row);assert.equal(row.changeControl.checks.length,2);assert.equal(report(row).impacts[0].checked,true);
});

test('changing any scene after review invalidates old checks, including updated-strategy scenes leaving candidate list',()=>{
  let row=raw(),sceneId=randomUUID();row.studio.scenes=[{id:sceneId,title:'장면',strategyRevision:1,revision:1,narration:'기존'}];row=reviewed(confirm(change(capture(row))));const oldKey=report(row).changeKey;assert.equal(report(row).status,'reviewed');
  row.studio.scenes[0].narration='새 설명';row.studio.scenes[0].revision=2;row.studio.scenes[0].strategyRevision=2;const next=report(row);assert.notEqual(next.changeKey,oldKey);assert.equal(next.impacts.length,2);assert.ok(next.impacts.every(item=>!item.checked));status(()=>run(row,{action:'advance',changeKey:oldKey,confirmed:true}),409);
});

test('source edits and strategy revisions invalidate checks but confirmation and unrelated messages do not',()=>{
  let row=raw();row.studio.assets=[{id:randomUUID(),fileName:'로고',author:'customer',diskName:'first.bin'}];row=reviewed(confirm(change(capture(row))));const key=report(row).changeKey;
  row.messages.push({text:'새 댓글'});row.internalNotes='새 내부 메모';assert.equal(report(row).changeKey,key);assert.equal(report(row).status,'reviewed');
  row.studio.assets[0].diskName='second.bin';assert.notEqual(report(row).changeKey,key);assert.ok(report(row).impacts.every(item=>!item.checked));row=reviewed(row);row=change(row,{durationSeconds:60});assert.ok(report(row).impacts.every(item=>!item.checked));
});

test('reverting every compared value returns to clean without artificial completion or baseline changes',()=>{
  let row=capture(raw()),id=row.changeControl.baseline.id;row=review(change(row));row=change(row,{durationSeconds:30});const view=report(row);assert.equal(view.status,'clean');assert.equal(view.changes.length,0);assert.equal(view.impacts.length,0);assert.equal(view.pendingCount,0);assert.equal(view.canAdvance,false);assert.equal(row.changeControl.baseline.id,id);assert.equal(row.changeControl.checks.length,1);
});

test('pinned baseline survives more than 20 strategy edits without truncating the comparison source',()=>{
  let row=capture(raw());const original=row.changeControl.baseline.id;for(let i=0;i<25;i++)row=change(row,{durationSeconds:31+i});assert.equal(row.studio.strategy.history.length,20);assert.equal(row.studio.strategy.history.some(item=>item.revision===1),false);assert.equal(row.changeControl.baseline.id,original);assert.equal(report(row).changes.find(item=>item.id==='strategy:durationSeconds').before,'30초');assert.equal(report(row).changes.find(item=>item.id==='strategy:durationSeconds').after,'55초');
});

test('disabling and resuming preserves baseline, diffs and confirmations',()=>{
  const initial=review(confirm(change(capture(raw())))),disabled=run(initial,{action:'set_enabled',enabled:false});assert.equal(report(disabled).status,'disabled');assert.deepEqual(disabled.changeControl.baseline,initial.changeControl.baseline);assert.deepEqual(disabled.changeControl.checks,initial.changeControl.checks);status(()=>review(disabled,'terms'),409);
  const resumed=run(disabled,{action:'set_enabled',enabled:true});assert.equal(report(resumed).status,'pending');assert.equal(report(resumed).impacts[0].checked,true);status(()=>run(resumed,{action:'set_enabled',enabled:true}),409);status(()=>run(raw(),{action:'set_enabled',enabled:true}),409);
});

test('customer change response omits previous private or deleted material labels, internal scene ids, checks and actors',()=>{
  let row=raw(),assetId=randomUUID(),referenceId=randomUUID(),sceneId=randomUUID();row.studio.assets=[{id:assetId,fileName:'REMOVED-SECRET-NAME',author:'staff',diskName:'SECRET-STORAGE'}];row.studio.references=[{id:referenceId,label:'REMOVED-REFERENCE',assetId}];row.studio.scenes=[{id:sceneId,title:'PRIVATE-SCENE',visibility:'internal',strategyRevision:1}];row=capture(row);row.studio.references=[];row=reviewed(change(row));const value=customerClientChanges(row),serialized=JSON.stringify(value);
  for(const forbidden of ['REMOVED-SECRET-NAME','REMOVED-REFERENCE','SECRET-STORAGE','PRIVATE-SCENE',assetId,referenceId,sceneId,'STAFF-ACTOR','fingerprint','checks','changeKey','note','impacts','history','requestText'])assert.ok(!serialized.includes(forbidden),forbidden);
  assert.doesNotMatch(report(row).requestText,/REMOVED-SECRET-NAME|REMOVED-REFERENCE|PRIVATE-SCENE/);assert.match(report(row).requestText,/공유 자료/);assert.equal(value.changes.filter(item=>item.kind==='source').length,1);assert.equal(value.changes.find(item=>item.kind==='source').id,'shared-materials');assert.equal(value.changes.find(item=>item.id==='strategy:durationSeconds').before,'30초');
});

test('baseline history and review history limits reject without silently dropping evidence',()=>{
  let row=reviewed(confirm(change(capture(raw()))));row.changeControl.pastBaselines=Array.from({length:30},(_,i)=>({id:'old-'+i,at,strategyRevision:i+1,changeCount:1}));const before=JSON.stringify(row);assert.equal(report(row).canAdvance,false);status(()=>advance(row),409);assert.equal(JSON.stringify(row),before);
  row=change(capture(raw()));row.changeControl.checks=Array.from({length:600},()=>({changeKey:'old',impactId:'schedule',actor:'STAFF-ACTOR',at}));status(()=>review(row),409);assert.equal(row.changeControl.checks.length,600);
});

test('removed agreed conditions remain pending even after staff reviews so the work cannot disappear as ready',()=>{
  let row=capture(raw());row.terms='';row=reviewed(row);assert.equal(report(row).pendingCount,1);assert.equal(report(row).status,'pending');assert.equal(report(row).canAdvance,false);status(()=>advance(row),409);
});

test('service checks current ACL, project revision, archived status and preserves one authoritative project',async t=>{
  const f=await fixture(t),input={action:'capture',confirmed:true};for(const [who,code]of [['viewer',403],['reviewer',403],['other',404]])status(()=>f.call(input,f.users[who]),code);status(()=>f.call({...input,revision:0}),409);status(()=>f.call({...input,baseline:{}}),400);
  const before=f.read(),saved=f.call(input,f.users.manager);assert.equal(saved.revision,before.revision+1);assert.equal(saved.changes.canEdit,true);assert.equal(saved.stage,before.stage);assert.deepEqual(saved.messages,before.messages);assert.equal(f.read().history.at(-1).action,'바뀐 것 기준 잡음');status(()=>f.call(input),409);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.call({action:'set_enabled',enabled:false}),401);f.store.put('clientProjects',saved.id,{...f.read(),stage:'archived'});status(()=>f.call({action:'set_enabled',enabled:false},f.users.admin),409);
});

test('staff projections use live edit roles; customer project and studio projections never expose controls or staff checks',async t=>{
  const f=await fixture(t);f.call({action:'capture',confirmed:true});let row=change(f.read());row=review(row,'schedule',{note:'SECRET-CHECK-NOTE'});f.store.put('clientProjects',row.id,row);
  assert.equal(f.service.workspace(f.users.owner).projects[0].changes.canEdit,true);assert.equal(f.service.workspace(f.users.viewer).projects[0].changes.canEdit,false);assert.equal(f.studio.staffState(f.users.owner,row.id).project.changes.status,'pending');
  const opened=f.invite();for(const project of [opened.project,f.service.read(opened.session).project,f.studio.customerState(opened.session).project]){assert.equal(project.changes.status,'pending');assert.doesNotMatch(JSON.stringify(project),/changeControl|SECRET-CHECK-NOTE|STAFF-ACTOR|changeKey|pastBaselines/);}
  status(()=>f.service.customerAction(opened.session,opened.csrf,{action:'capture',revision:f.read().revision,confirmed:true}),400);
});

test('service detects stale checks after another studio edit and captures no automatic customer confirmation',async t=>{
  const f=await fixture(t);f.call({action:'capture',confirmed:true});const changed=f.studio.staffMutate(f.users.owner,f.project.id,{action:'save_strategy',revision:f.read().revision,strategy:{...f.read().studio.strategy.data,durationSeconds:60}}).project;
  const key=changed.changes.changeKey;f.call({action:'review',changeKey:key,impactId:'schedule',decision:'unchanged',confirmed:true});const reviewedAt=f.read().revision;f.studio.staffMutate(f.users.owner,f.project.id,{action:'save_strategy',revision:reviewedAt,strategy:{...f.read().studio.strategy.data,durationSeconds:90}});
  status(()=>f.call({action:'review',changeKey:key,impactId:'terms',decision:'unchanged',confirmed:true}),409);status(()=>f.call({action:'review',changeKey:report(f.read()).changeKey,impactId:'terms',decision:'unchanged',confirmed:true,revision:reviewedAt}),409);assert.equal(f.read().studio.strategy.confirmation,null);assert.equal(report(f.read()).pendingCount,3);
});
