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
import {applySceneRequestAction} from './client-scene-requests.mjs';
import {buildClientSchedule,applyClientScheduleAction} from './client-schedule.mjs';

const now='2026-10-12T03:00:00.000Z';
const config=(extra={})=>({action:'configure',enabled:true,calendar:'calendar',targets:{kickoff:'',preview:'',customer:'',revision:'',delivery:''},remainingWorkDays:null,customerWaitDays:3,internalReviewDays:2,...extra});
const status=(fn,code)=>assert.throws(fn,error=>error.status===code);
function raw(){return {id:randomUUID(),title:'합성 일정 프로젝트',ownerId:'owner',reviewerId:'reviewer',stage:'planning',dueDate:'2026-10-30',terms:'합성 조건',revision:1,history:[],messages:[],versions:[],kickoffPlan:{enabled:true,requirements:[],dueDate:''},studio:{schemaVersion:1,strategy:{revision:1,data:{...emptyStrategyData(),primaryPromise:'쉽게 사용',evidence1:'사용 장면',desiredAction:'직접 볼 것'},confirmation:{strategyRevision:1}},assets:[],references:[],concepts:[],scenes:[],history:[],comments:[],sceneReviews:[],conceptSelections:[]}};}
const configure=(row,extra={})=>({...row,schedulePlan:applyClientScheduleAction(row,config(extra),{actor:'PRIVATE-ACTOR',at:now})});
const report=(row,extra={})=>buildClientSchedule(row,{now,canEdit:true,...extra});
const preview=(id='preview-1',more={})=>({id,kind:'preview',label:'합성 시안',createdAt:'2026-10-09T02:00:00Z',approvedAt:null,...more});
const milestone=(view,id)=>view.milestones.find(item=>item.id===id);
function sceneWaiting(row,{reviewerId=null,sceneId=randomUUID(),requestId=randomUUID(),since='2026-10-09T03:00:00Z'}={}){row=structuredClone(row);row.reviewerId=reviewerId;row.studio.scenes.push({id:sceneId,title:'합성 공개 장면',visibility:'customer',revision:2});row.studio.sceneReviews.push({id:requestId,author:'customer',status:'changes',sceneId,sceneRevision:1,text:'장면 수정',at:'2026-10-08T00:00:00Z'});row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'submit',requestId,sceneRevision:2,confirmed:true},{actor:row.ownerId,canEdit:true,reviewerId,at:since});return row;}
async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-schedule-')),store=new Store(directory);t.after(async()=>{store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const users={};for(const [name,role,teamId]of [['owner','member','team-a'],['reviewer','member','team-a'],['other','member','team-b'],['manager','manager','team-a'],['viewer','viewer','team-a'],['admin','admin',null]])users[name]=store.createUser({name,email:name+'@schedule.test',role,teamId});
  const service=createClientProjectsService({store,clock:()=>now}),studio=createPulseStudioService({store,clientProjects:service,clock:()=>now}),project=service.save(users.owner,{title:'합성 일정',customerName:'테스트 고객',terms:'기존 조건',dueDate:'2026-10-30',stage:'planning',reviewerId:users.reviewer.id}).project;
  const read=()=>store.get('clientProjects',project.id),call=(extra={},user=users.owner)=>service.schedule(user,project.id,{...config(extra),revision:read().revision}).project;
  const invite=()=>{const result=service.invite(users.owner,project.id,{revision:read().revision});return service.open(result.invite);};
  return {store,service,studio,users,project,read,call,invite};
}

test('legacy and null plans stay disabled; projections never write source state',()=>{
  const row=raw(),before=JSON.stringify(row),view=report(row);assert.equal(view.enabled,false);assert.equal(view.status,'disabled');assert.equal(view.pendingCount,0);assert.equal(view.remainingWorkDays,null);assert.equal(view.history.length,0);assert.equal(JSON.stringify(row),before);assert.equal(report({...row,schedulePlan:null}).status,'disabled');
});

test('KST midnight changes internal targets from upcoming to due and then overdue',()=>{
  const row=configure(raw(),{targets:{...config().targets,preview:'2026-10-12'}});let view=report(row,{now:'2026-10-11T14:59:59Z'});assert.equal(view.today,'2026-10-11');assert.equal(milestone(view,'preview').status,'upcoming');view=report(row,{now:'2026-10-11T15:00:00Z'});assert.equal(view.today,'2026-10-12');assert.equal(milestone(view,'preview').due,true);view=report(row,{now:'2026-10-12T15:00:00Z'});assert.equal(milestone(view,'preview').overdue,true);
});

test('weekday arithmetic excludes only weekends, including a Friday-to-Monday wait deadline',()=>{
  let row=raw();row.versions=[preview()];row=configure(row,{calendar:'weekdays',remainingWorkDays:1,customerWaitDays:1});const friday=report(row,{now:'2026-10-09T03:00:00Z'});assert.equal(friday.estimatedFinishDate,'2026-10-12');assert.equal(friday.waiting[0].dueDate,'2026-10-12');const monday=report(row);assert.equal(monday.waiting[0].elapsedDays,1);assert.equal(monday.waiting[0].due,true);assert.match(monday.calendarLabel,/평일만/);
  row=configure(row,{calendar:'calendar',remainingWorkDays:1,customerWaitDays:1});assert.equal(report(row,{now:'2026-10-09T03:00:00Z'}).estimatedFinishDate,'2026-10-10');assert.equal(report(row).waiting[0].elapsedDays,3);
});

test('calendar date arithmetic crosses months and years and zero remaining days means today',()=>{
  let row=configure(raw(),{calendar:'weekdays',remainingWorkDays:1});assert.equal(report(row,{now:'2026-12-31T03:00:00Z'}).estimatedFinishDate,'2027-01-01');row=configure(row,{remainingWorkDays:0});assert.equal(report(row,{now:'2026-10-10T03:00:00Z'}).estimatedFinishDate,'2026-10-10');
});

test('internal targets, customer wishes and agreed deadline remain separate from entered work estimates',()=>{
  const row=raw();row.dueDate='2026-10-14';row.studio.strategy.data.proposedDeadline='2026-12-01';const configured=configure(row,{targets:{...config().targets,delivery:'2026-11-01'},remainingWorkDays:5}),view=report(configured);assert.equal(view.agreedDueDate,'2026-10-14');assert.equal(view.estimatedFinishDate,'2026-10-17');assert.equal(view.remainingDays,2);assert.equal(view.risk.status,'at_risk');assert.equal(milestone(view,'delivery').targetDate,'2026-11-01');assert.equal(configured.dueDate,row.dueDate);assert.equal(configured.stage,row.stage);assert.equal(configured.terms,row.terms);
});

test('unknown work estimate and missing agreed date are explicit; elapsed actual deadlines still require attention',()=>{
  let row=configure(raw());assert.equal(report(row).risk.status,'unknown');assert.equal(report(row).estimatedFinishDate,'');row.dueDate='';assert.equal(report(row).risk.status,'undated');assert.equal(report(row).remainingDays,null);row.dueDate='2026-10-11';assert.equal(report(row).risk.status,'overdue');assert.equal(report(row).remainingDays,-1);assert.equal(report(row).pendingCount,1);row.dueDate='2026-10-12';assert.equal(report(row).risk.status,'due');
});

test('only current requested unconfirmed strategy and deliverables start waiting clocks',()=>{
  let row=raw();row.studio.strategy={...row.studio.strategy,revision:2,request:{strategyRevision:2,at:'2026-10-08T15:00:00Z'},confirmation:{strategyRevision:1}};row.studio.deliverables={revision:3,items:[],request:{deliverableRevision:3,at:'2026-10-09T02:00:00Z'},confirmation:{deliverableRevision:2}};row=configure(row,{customerWaitDays:3});let view=report(row);assert.deepEqual(view.waiting.map(item=>item.kind).sort(),['deliverables','strategy']);assert.ok(view.waiting.every(item=>item.dueDate==='2026-10-12'&&item.due));
  row.studio.strategy.request.strategyRevision=1;row.studio.deliverables.confirmation.deliverableRevision=3;view=report(row);assert.equal(view.waiting.length,0);row.studio.strategy.request=null;assert.equal(report(row).waiting.length,0);
});

test('latest preview supersedes old unapproved versions and confirmed current preview removes its wait',()=>{
  let row=raw();row.versions=[preview('old',{createdAt:'2026-01-01T00:00:00Z'}),preview('new',{createdAt:'2026-10-12T00:00:00Z'})];row=configure(row);let view=report(row);assert.equal(view.waiting.length,1);assert.match(view.waiting[0].id,/new$/);assert.equal(view.waiting[0].elapsedDays,0);row.versions[1].approvedAt=now;view=report(row);assert.equal(view.waiting.length,0);assert.equal(milestone(view,'customer').status,'complete');
});

test('feedback waiting deduplicates the exact current preview and preserves its earliest actual waiting date',()=>{
  let row=raw();row.versions=[preview()];row.messages=[1,2].map(n=>({id:'feedback-'+n,author:'customer',visibility:'customer',action:'feedback',resolved:false,workflow:{status:'waiting_customer',resultVersionId:'preview-1',updatedAt:'2026-10-11T01:00:00Z',history:[{action:'submit_review',at:'2026-10-10T00:00:00Z'},{action:'accept',at:'2026-10-11T01:00:00Z'}]}}));row=configure(row);let view=report(row);assert.equal(view.waiting.length,1);assert.equal(view.waiting[0].since,'2026-10-09T02:00:00Z');assert.equal(view.waiting[0].dueDate,'2026-10-12');
  row.messages[0].workflow.status='review';row.messages[0].workflow.history=[{action:'submit_review',at:'2026-10-10T00:00:00Z'}];view=report(row);assert.equal(view.waiting.length,2);assert.equal(view.waiting.find(item=>item.audience==='internal').dueDate,'2026-10-12');assert.equal(report(row,{reviewerId:null}).waiting.filter(item=>item.audience==='internal').length,0);
});

test('old feedback result versions, general comments and resolved feedback never start wait clocks',()=>{
  let row=raw();row.versions=[preview('latest',{approvedAt:now})];row.messages=[{id:'old',author:'customer',action:'feedback',resolved:false,workflow:{status:'review',resultVersionId:'previous',updatedAt:'2026-01-01T00:00:00Z'}},{id:'done',author:'customer',action:'feedback',resolved:true,workflow:{status:'review',resultVersionId:'latest',updatedAt:now}},{id:'support',author:'customer',action:'support',workflow:{status:'review',resultVersionId:'latest',updatedAt:now}}];row.studio.comments=[{text:'일반 댓글',at:'2026-01-01T00:00:00Z'}];row=configure(row);assert.equal(report(row).waiting.length,0);assert.notEqual(milestone(report(row),'revision').status,'complete');
});

test('scene waits deduplicate exact result revisions and hide private or stale submissions',()=>{
  let row=sceneWaiting(raw()),sceneId=row.studio.scenes[0].id,second=randomUUID();row.studio.sceneReviews.push({...row.studio.sceneReviews[0],id:second,text:'추가 수정'});row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'submit',requestId:second,sceneRevision:2,confirmed:true},{actor:row.ownerId,canEdit:true,reviewerId:null,at:'2026-10-10T03:00:00Z'});row=configure(row);let view=report(row);assert.equal(view.waiting.length,1);assert.equal(view.waiting[0].since,'2026-10-09T03:00:00Z');assert.equal(view.waiting[0].kind,'scene');assert.ok(view.waiting[0].id.includes(sceneId));
  row.studio.scenes[0].visibility='internal';view=report(row);assert.equal(view.waiting.length,0);assert.notEqual(milestone(view,'revision').status,'complete');row.studio.scenes[0].visibility='customer';row.studio.scenes[0].revision=3;assert.equal(report(row).waiting.length,0);
});

test('scene internal review clock uses submission and customer wait uses actual acceptance',()=>{
  let row=sceneWaiting(raw(),{reviewerId:'reviewer',since:'2026-10-08T03:00:00Z'});row=configure(row);let view=report(row);assert.equal(view.waiting[0].audience,'internal');assert.equal(view.waiting[0].dueDate,'2026-10-10');assert.equal(view.waiting[0].overdue,true);row.sceneRequestWorkflows=applySceneRequestAction(row,{action:'accept',requestId:row.studio.sceneReviews[0].id,confirmed:true},{actor:'reviewer',canReview:true,reviewerId:'reviewer',at:'2026-10-11T03:00:00Z'});view=report(row);assert.equal(view.waiting[0].audience,'customer');assert.equal(view.waiting[0].since,'2026-10-11T03:00:00Z');assert.equal(view.waiting[0].dueDate,'2026-10-14');assert.equal(report(row,{reviewerId:null}).waiting.length,0);
});

test('unset wait limits remain undated and invalid or future source timestamps do not create invented overdue dates',()=>{
  let row=raw();row.versions=[preview()];row=configure(row,{customerWaitDays:null});let view=report(row);assert.equal(view.waiting[0].status,'undated');assert.equal(view.waiting[0].dueDate,'');assert.equal(view.waiting[0].elapsedDays,3);row.versions[0].createdAt='invalid';view=report(row);assert.equal(view.waiting[0].elapsedDays,null);assert.equal(view.waiting[0].since,'');row.versions[0].createdAt='2026-10-20T00:00:00Z';assert.equal(report(row).waiting[0].elapsedDays,0);
});

test('milestones derive current facts and never treat a producing or delivered stage as evidence',()=>{
  let row=configure(raw());let view=report(row);assert.equal(milestone(view,'kickoff').status,'complete');assert.equal(milestone(view,'revision').status,'not_required');assert.equal(milestone(view,'preview').status,'undated');row.stage='delivered';assert.notEqual(milestone(report(row),'delivery').status,'complete');assert.notEqual(report(row).status,'complete');row.kickoffPlan.enabled=false;assert.notEqual(milestone(report(row),'kickoff').status,'complete');assert.match(milestone(report(row),'kickoff').reason,/자료 챙기기를 켜/);
});

test('other current customer confirmation requests prevent customer milestone completion despite preview approval',()=>{
  let row=raw();row.versions=[preview('current',{approvedAt:now})];row.studio.strategy.request={strategyRevision:1,at:'2026-10-10T00:00:00Z'};row.studio.strategy.confirmation=null;row=configure(row);let view=report(row);assert.notEqual(milestone(view,'customer').status,'complete');assert.match(milestone(view,'customer').reason,/1건/);row.studio.strategy.confirmation={strategyRevision:1};assert.equal(milestone(report(row),'customer').status,'complete');
});

test('customer milestone opens the actual pending planning or scene confirmation instead of an already approved preview',()=>{
  let row=raw();row.versions=[preview('current',{approvedAt:now})];row.studio.strategy.request={strategyRevision:1,at:'2026-10-10T00:00:00Z'};row.studio.strategy.confirmation=null;row=configure(row);let view=report(row);assert.equal(milestone(view,'customer').href,view.waiting.find(item=>item.kind==='strategy').href);assert.equal(new URL(milestone(view,'customer').href,'http://local.test').searchParams.get('tab'),'strategy');
  row.studio.strategy.confirmation={strategyRevision:1};row=sceneWaiting(row);view=report(row);assert.equal(milestone(view,'customer').href,view.waiting.find(item=>item.kind==='scene').href);assert.match(milestone(view,'customer').href,/requests=1$/);
});

test('revision milestone opens the exact timed video feedback when no scene request needs processing',()=>{
  let row=raw();const versionId=randomUUID(),messageId=randomUUID();row.versions=[preview(versionId)];row.messages=[{id:messageId,author:'customer',action:'feedback',versionId,seconds:15.5,resolved:false,text:'15초 자막 수정'}];row=configure(row);let url=new URL(milestone(report(row),'revision').href,'http://local.test');assert.equal(url.searchParams.get('project'),row.id);assert.equal(url.searchParams.get('version'),versionId);assert.equal(url.searchParams.get('message'),messageId);assert.equal(url.searchParams.get('seconds'),'15.5');assert.equal(url.searchParams.has('requests'),false);
  row=sceneWaiting(row);url=new URL(milestone(report(row),'revision').href,'http://local.test');assert.equal(url.searchParams.get('requests'),'1');
});

test('only finals matching the latest approved preview complete delivery and current pending work reactivates attention',()=>{
  let row=raw();row.dueDate='2026-10-01';row.versions=[preview('current',{approvedAt:now}),{id:'old-final',kind:'final',approvedPreviewId:'old',createdAt:now}];row=configure(row,{targets:{...config().targets,preview:'2026-10-01'}});assert.notEqual(milestone(report(row),'delivery').status,'complete');row.versions.push({id:'final',kind:'final',approvedPreviewId:'current',createdAt:now});let view=report(row);assert.equal(view.status,'complete');assert.equal(view.pendingCount,0);assert.equal(view.risk.status,'complete');row.messages=[{id:'pending',author:'customer',action:'feedback',resolved:false}];view=report(row);assert.equal(view.status,'attention');assert.equal(view.pendingCount,1);row.versions.push(preview('new'));assert.notEqual(milestone(report(row),'delivery').status,'complete');
});

test('actionable counts exclude future unfinished work and disabled or archived projects retain configuration without attention',()=>{
  const targets={kickoff:'2026-10-01',preview:'2026-10-12',customer:'2026-10-11',revision:'2026-10-01',delivery:'2026-10-30'};let row=configure(raw(),{targets,remainingWorkDays:30});const view=report(row);assert.equal(view.pendingCount,3);assert.equal(view.status,'attention');assert.equal(milestone(view,'kickoff').overdue,false);row=configure(row,{enabled:false,targets,remainingWorkDays:30});assert.equal(report(row).pendingCount,0);assert.deepEqual(report(row).targets,targets);row=configure(row,{targets,remainingWorkDays:30});row.stage='archived';assert.equal(report(row).pendingCount,0);assert.equal(report(row).canEdit,false);assert.equal(report(row).status,'archived');
});

test('configure enforces exact fields, real dates, full target keys, integer bounds and no-op semantics',()=>{
  for(const extra of [{enabled:1},{calendar:'holidays'},{targets:{...config().targets,preview:'2026-02-30'}},{targets:{...config().targets,preview:'2026-10-12T00:00:00Z'}},{targets:{preview:''}},{targets:{...config().targets,secret:''}},{remainingWorkDays:-1},{remainingWorkDays:366},{remainingWorkDays:1.5},{remainingWorkDays:'2'},{customerWaitDays:0},{customerWaitDays:61},{internalReviewDays:undefined},{dueDate:'2026-10-20'}])status(()=>configure(raw(),extra),400);
  const row=configure(raw());status(()=>configure(row),409);status(()=>applyClientScheduleAction(row,{...config(),action:'approve'},{actor:'x',at:now}),400);status(()=>configure({...row,stage:'archived'},{enabled:false}),409);assert.equal(report(configure(raw(),{remainingWorkDays:365,customerWaitDays:60,internalReviewDays:1})).remainingWorkDays,365);
});

test('bounded history retains previous configurations and excludes actor ids from the report',()=>{
  let row=configure(raw());row=configure(row,{remainingWorkDays:4});assert.equal(row.schedulePlan.history.length,2);assert.equal(report(row).history[0].remainingWorkDays,null);assert.equal(report(row).history[1].remainingWorkDays,4);assert.doesNotMatch(JSON.stringify(report(row).history),/PRIVATE-ACTOR|updatedBy/);row.schedulePlan.history=Array.from({length:100},()=>({...config(),at:now,actor:'PRIVATE-ACTOR'}));const before=JSON.stringify(row);status(()=>configure(row,{remainingWorkDays:5}),409);assert.equal(JSON.stringify(row),before);
});

test('service checks current permissions and project revision without modifying source agreements or confirmations',async t=>{
  const f=await fixture(t);for(const [who,code]of [['viewer',403],['reviewer',403],['other',404]])status(()=>f.call({},f.users[who]),code);const before=f.read();status(()=>f.service.schedule(f.users.owner,f.project.id,{...config(),revision:0}),409);const p=f.call({remainingWorkDays:4},f.users.manager);assert.equal(p.revision,before.revision+1);assert.equal(p.schedule.canEdit,true);assert.equal(p.dueDate,before.dueDate);assert.equal(p.stage,before.stage);assert.equal(p.terms,before.terms);assert.deepEqual(p.messages,before.messages);assert.equal(f.read().history.at(-1).action,'일정 목표일 바꿈');f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});status(()=>f.call({remainingWorkDays:5}),401);f.store.put('clientProjects',p.id,{...f.read(),stage:'archived'});status(()=>f.call({remainingWorkDays:5},f.users.admin),409);
});

test('customer project and PULSE responses never include internal target dates, estimates, configuration or schedule history',async t=>{
  const f=await fixture(t);f.call({targets:{...config().targets,preview:'2199-11-22'},remainingWorkDays:123,customerWaitDays:17});const customer=f.invite();for(const project of [customer.project,f.service.read(customer.session).project,f.studio.customerState(customer.session).project])assert.doesNotMatch(JSON.stringify(project),/schedulePlan|"schedule"|2199-11-22|remainingWorkDays|customerWaitDays|estimatedFinishDate|internalReviewDays/);assert.equal(f.studio.staffState(f.users.owner,f.project.id).project.schedule.remainingWorkDays,123);assert.equal(f.service.workspace(f.users.viewer).projects[0].schedule.canEdit,false);
});
