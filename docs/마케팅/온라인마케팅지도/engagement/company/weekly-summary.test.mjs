import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {createStudioService} from './studio-service.mjs';
import {createClientProjectsService} from './client-projects.mjs';
import {createClientWorkflowService} from './client-workflow.mjs';
import {createPostPerformanceService} from './post-performance.mjs';
import {createPublicationLearningService} from './publication-learning.mjs';
import {createContentService} from './content-service.mjs';
import {createWeeklySummaryService} from './weekly-summary.mjs';

const NOW='2026-10-12T00:00:00.000Z',IN_WEEK='2026-10-06T02:00:00.000Z';
function fixture(t,overrides={}){
  const directory=mkdtempSync(join(tmpdir(),'synk-weekly-summary-'));let store=new Store(directory),at=NOW,service,studio,clientProjects,clientWorkflow,postPerformance,publicationLearning,contentService;
  const users={};for(const [name,role,teamId]of [['owner','member','a'],['peer','member','a'],['other','member','b'],['manager','manager','a'],['admin','admin',null],['viewer','viewer','a']])users[name]=store.createUser({name,email:name+'@weekly.example',role,teamId});
  const channel={id:'youtube',platform:'youtube',active:true,ownerIds:[users.owner.id],teamId:'a',displayName:'합성 채널'};store.put('channels',channel.id,channel);
  function build(){
    const clock=()=>at;studio=createStudioService({store,clock});clientProjects=createClientProjectsService({store,clock});clientWorkflow=createClientWorkflowService({store,clientProjects,clock});postPerformance=createPostPerformanceService({store,clock,isConnected:()=>false});
    publicationLearning=createPublicationLearningService({store,studio,postPerformance,clock,publicationPackages:{get(){throw Object.assign(new Error('not found'),{status:404});}}});contentService=createContentService({store,clock});
    service=createWeeklySummaryService({store,studio,clientProjects,clientWorkflow,postPerformance,publicationLearning,contentService,clock,publicationWorkflow:{workspace(){return {items:[]};}},...overrides});
  }build();
  t.after(async()=>{await postPerformance.stop();store.close();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(directory.startsWith(join(tmpdir(),'synk-weekly-summary-')));rmSync(directory,{recursive:true,force:true});});
  function source({user=users.owner,createdAt=IN_WEEK,title='확정 영상',stage='ready',dueDate=null}={}){
    const previous=at;at=createdAt;
    let production=studio.saveProduction(user,{title,stage,dueDate}).production;
    const media={id:randomUUID(),mimeType:'video/mp4',fileName:'video.mp4',diskName:randomUUID()+'.mp4',byteSize:10};
    production=studio.addMedia(user,production.id,media,'확정본').production;
    const version=production.versions.at(-1),receipt={id:randomUUID(),ownerId:user.id,status:'ready',title,productionId:production.id,versionId:version.id,createdAt,draft:{body:'PRIVATE-POST-BODY'}};
    store.put('publicationInboxEntries',receipt.id,receipt);at=previous;return {production,version,receipt,media};
  }
  function project({user=users.owner,...extra}={}){
    return clientProjects.save(user,{title:'합성 고객 업무',customerName:'고객',summary:'PRIVATE-CUSTOMER-BODY',internalNotes:'PRIVATE-INTERNAL',dueDate:'2026-10-15',nextContactDate:'2026-10-14',...extra}).project;
  }
  function post({publishedAt='2026-10-05T01:00:00.000Z',url='https://www.youtube.com/watch?v=abcdefghijk'}={}){return postPerformance.register(users.owner,{channelId:'youtube',url,title:'합성 게시 기록',publishedAt}).entry;}
  return {users,source,project,post,get store(){return store;},get service(){return service;},get studio(){return studio;},get projects(){return clientProjects;},get performance(){return postPerformance;},setTime(value){at=value;},async restart(){await postPerformance.stop();store.close();store=new Store(directory);build();}};
}
const section=(result,id)=>result.sections.find(row=>row.id===id);

test('next-week social reservations use current permission and personal assignment, with KST boundaries',t=>{
  let rows=[];const f=fixture(t,{socialPublishing:{workspace:user=>({jobs:user.id===f.users.owner.id?rows:[]})}});
  rows=[{id:'next-social',postId:'source-post',channelId:'youtube',publisherId:f.users.owner.id,scheduledAt:'2026-10-11T15:30:00Z',status:'scheduled',contentSummary:{title:'다음 주 SNS 예약'}},{id:'last-social',postId:'source-post',channelId:'youtube',publisherId:f.users.owner.id,scheduledAt:'2026-10-11T14:59:59Z',status:'scheduled',contentSummary:{title:'지난 주'}}];
  let items=section(f.service.get(f.users.owner),'upcoming').items;assert.equal(items.filter(row=>row.kind==='social_schedule').length,1);assert.equal(items.find(row=>row.kind==='social_schedule').dueDate,'2026-10-12');assert.match(items.find(row=>row.kind==='social_schedule').text,/00:30 한국 시간/);
  assert.equal(section(f.service.get(f.users.viewer),'upcoming').items.length,0);assert.equal(section(f.service.get(f.users.other),'upcoming').items.length,0);
  rows=[];assert.equal(section(f.service.get(f.users.owner),'upcoming').items.filter(row=>row.kind==='social_schedule').length,0);
});

test('KST Monday rollover, exclusive boundaries and only 52 completed weeks',t=>{
  const f=fixture(t);f.setTime('2026-10-11T14:59:59.999Z');let result=f.service.get(f.users.owner);
  assert.equal(result.period.startDate,'2026-09-28');
  f.setTime('2026-10-11T15:00:00.000Z');result=f.service.get(f.users.owner);
  assert.equal(result.period.startDate,'2026-10-05');assert.equal(result.period.endDate,'2026-10-11');
  assert.equal(result.period.startAt,'2026-10-04T15:00:00.000Z');assert.equal(result.period.endAt,'2026-10-11T15:00:00.000Z');
  assert.equal(result.period.nextStartDate,'2026-10-12');assert.equal(result.period.nextEndDate,'2026-10-18');
  assert.equal(result.schedule.nextRunAt,'2026-10-18T15:00:00.000Z');
  for(const week of ['2026-10-12','2026-10-19','2026-10-06','2026-02-30','2026-10-5','',null,[],{}])assert.throws(()=>f.service.get(f.users.owner,{week}),{status:400});
  assert.equal(f.service.get(f.users.owner,{week:result.schedule.oldestWeek}).period.startDate,result.schedule.oldestWeek);
  const tooOld=new Date(Date.parse(result.schedule.oldestWeek)-7*86400000).toISOString().slice(0,10);assert.throws(()=>f.service.get(f.users.owner,{week:tooOld}),{status:400});
});

test('generation persists metadata once and restart catches up only the latest week',async t=>{
  const f=fixture(t);assert.equal(f.service.get(f.users.owner).generatedAt,null);assert.equal(f.store.all('weeklyWorkSummaries').length,0);
  assert.equal(f.service.scanDue().created,5);assert.equal(f.service.scanDue().created,0);
  const row=f.store.get('weeklyWorkSummaries',f.users.owner.id+':2026-10-05');assert.deepEqual(Object.keys(row).sort(),['generatedAt','id','ownerId','schema','week']);
  await f.restart();assert.equal(f.service.scanDue().created,0);assert.equal(f.service.get(f.users.owner).generatedAt,NOW);
  f.setTime('2026-11-02T00:00:00Z');assert.equal(f.service.scanDue().created,5);
  assert.deepEqual([...new Set(f.store.all('weeklyWorkSummaries').map(row=>row.week))].sort(),['2026-10-05','2026-10-26']);
});

test('only owned or assigned readable production is counted, including after permission withdrawal',t=>{
  const f=fixture(t),own=f.source(),other=f.source({user:f.users.other});
  assert.equal(section(f.service.get(f.users.owner),'completed').total,1);
  for(const name of ['peer','manager','admin','viewer'])assert.equal(section(f.service.get(f.users[name]),'completed').total,0);
  f.store.put('studioProductions',own.production.id,{...f.store.get('studioProductions',own.production.id),ownerId:f.users.other.id,assigneeId:f.users.other.id});
  assert.equal(section(f.service.get(f.users.owner),'completed').total,0);
  f.store.put('users',f.users.owner.id,{...f.users.owner,active:false});assert.throws(()=>f.service.get(f.users.owner),{status:401});
  assert.ok(other.production.id);
});

test('receipts deduplicate by source version before period filtering and do not invent ready timestamps',t=>{
  const f=fixture(t),s=f.source({createdAt:'2026-10-04T14:59:59.999Z'});
  f.store.put('publicationInboxEntries','duplicate',{...s.receipt,id:'duplicate',status:'duplicate',createdAt:IN_WEEK});
  f.studio.saveProduction(f.users.owner,{title:'새 메모로 수정',stage:'ready'},s.production.id);
  assert.equal(section(f.service.get(f.users.owner),'completed').total,0);
  f.source({createdAt:'2026-10-04T15:00:00.000Z'});f.source({createdAt:'2026-10-11T14:59:59.999Z'});f.source({createdAt:'2026-10-11T15:00:00.000Z'});
  assert.equal(section(f.service.get(f.users.owner),'completed').total,2);
});

test('historical receipt stays completed while current reopened state is explicit',t=>{
  const f=fixture(t),s=f.source();f.studio.saveProduction(f.users.owner,{title:s.production.title,stage:'making',dueDate:'2026-10-13'},s.production.id);
  const result=f.service.get(f.users.owner);assert.match(section(result,'completed').items[0].statusLabel,/현재 진행 중/);assert.equal(section(result,'upcoming').items[0].dueDate,'2026-10-13');
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-POST-BODY/);
});

test('72h zero is a measured number while missing and not-yet-due measurements remain distinct',t=>{
  const f=fixture(t),post=f.post();
  f.performance.manualCheckpoint(f.users.owner,post.id,72,{measuredAt:'2026-10-08T01:00:00Z',metrics:{views:0,likes:2}});
  let rows=section(f.service.get(f.users.owner),'performance').items;assert.equal(rows.length,1);assert.match(rows[0].text,/조회 0회/);assert.match(rows[0].text,/좋아요 2회/);assert.doesNotMatch(rows[0].text,/댓글 0/);
  f.post({url:'https://www.youtube.com/watch?v=bcdefghijkl',publishedAt:'2026-10-06T01:00:00Z'});f.post({url:'https://www.youtube.com/watch?v=cdefghijklm',publishedAt:'2026-10-11T01:00:00Z'});
  rows=section(f.service.get(f.users.owner),'performance').items;assert.equal(rows.filter(row=>row.statusLabel==='수치 미확인').length,1);assert.equal(rows.filter(row=>row.statusLabel==='72시간 관측 대기').length,1);
});

test('channel assignment is authoritative even for admin and old metadata cannot preserve access',t=>{
  const f=fixture(t);f.post();f.service.scanDue();assert.equal(section(f.service.get(f.users.owner),'performance').total,1);assert.equal(section(f.service.get(f.users.admin),'performance').total,0);
  f.store.put('channels','youtube',{...f.store.get('channels','youtube'),ownerIds:[f.users.other.id]});
  assert.equal(section(f.service.get(f.users.owner),'performance').total,0);assert.ok(f.service.get(f.users.owner).generatedAt);
});

test('client followup and request history omit bodies and preserve reopened evidence',t=>{
  const f=fixture(t),p=f.project(),raw=f.store.get('clientProjects',p.id),messageId=randomUUID();
  f.store.put('clientProjects',p.id,{...raw,followUpHistory:[{id:'follow',at:IN_WEEK,note:'PRIVATE-CONTACT-NOTE',disposition:'schedule'}],messages:[{id:messageId,author:'customer',action:'support',text:'PRIVATE-REQUEST-BODY',at:IN_WEEK,resolved:false,resolvedAt:null,workflow:{status:'open',updatedAt:NOW,note:'PRIVATE-WORKFLOW-NOTE',history:[{action:'complete',at:IN_WEEK,note:'PRIVATE-OLD-NOTE'},{action:'reopen',at:NOW}]}}]});
  const result=f.service.get(f.users.owner);assert.equal(section(result,'completed').total,2);assert.match(section(result,'completed').items.find(row=>row.kind==='client_resolved').statusLabel,/현재 진행 중/);assert.equal(section(result,'attention').total,1);assert.equal(section(result,'upcoming').total,2);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE-|inviteHash|customerName|"contact"/);
  for(const name of ['peer','manager','admin','viewer'])assert.equal(section(f.service.get(f.users[name]),'completed').total,0);
});

test('next-week dates are inclusive and archived, delivered and unassigned work is excluded',t=>{
  const f=fixture(t),p=f.project({dueDate:'2026-10-12',nextContactDate:'2026-10-18'});
  let rows=section(f.service.get(f.users.owner),'upcoming').items;assert.equal(rows.length,2);
  const raw=f.store.get('clientProjects',p.id);f.store.put('clientProjects',p.id,{...raw,stage:'delivered'});rows=section(f.service.get(f.users.owner),'upcoming').items;assert.equal(rows.length,1);assert.equal(rows[0].kind,'client_follow_up');
  f.store.put('clientProjects',p.id,{...raw,stage:'archived'});assert.equal(section(f.service.get(f.users.owner),'upcoming').total,0);
});

test('stored experiment notes are linked without copying private text or guessing an execution date',t=>{
  const f=fixture(t),id=randomUUID();f.store.put('contentDrafts',id,{id,ownerId:f.users.owner.id,title:'다음 영상 실험',createdAt:IN_WEEK,status:'draft',input:{editorialNote:'PRIVATE-EXPERIMENT-TEXT'},plan:{ideas:[]}});
  const result=f.service.get(f.users.owner),row=section(result,'upcoming').items[0];assert.equal(row.kind,'content_experiment');assert.equal(row.dueDate,undefined);assert.match(row.statusLabel,/날짜 미지정/);assert.match(row.href,/draftId=/);assert.doesNotMatch(JSON.stringify(result),/PRIVATE-/);
  f.store.put('contentDrafts',id,{...f.store.get('contentDrafts',id),ownerId:f.users.other.id});assert.equal(section(f.service.get(f.users.owner),'upcoming').total,0);
});

test('source failures are partial rather than falsely empty, without exposing exception details',t=>{
  const f=fixture(t,{publicationWorkflow:{workspace(){throw new Error('SECRET-CONNECTION-STRING');}},taskSummary(){throw new Error('SECRET-CHAT-BODY');}});
  const result=f.service.get(f.users.owner);for(const id of ['completed','attention','upcoming'])assert.equal(section(result,id).status,'partial');assert.doesNotMatch(JSON.stringify(result),/SECRET-/);assert.match(section(result,'attention').note,/일부 원문/);
});

test('messenger callback receives exact period and only whitelisted output is retained',t=>{
  let received;const f=fixture(t,{taskSummary(user,period){received={user,period};return {completed:[{id:'task:one',kind:'task',title:'업무 완료',text:'완료 이력 · 현재 다시 진행',statusLabel:'완료 기록',href:'/?tab=messenger',occurredAt:IN_WEEK,privateBody:'PRIVATE-BODY'}],attention:[],upcoming:[{id:'task:two',kind:'task',title:'기한',href:'https://external.example/',dueDate:'2026-10-13'}]};}});
  const result=f.service.get(f.users.owner);assert.equal(received.user.id,f.users.owner.id);assert.equal(received.period.endAt,'2026-10-11T15:00:00.000Z');assert.doesNotMatch(JSON.stringify(result),/PRIVATE-BODY/);assert.equal(section(result,'upcoming').items[0].href,null);
});

test('inactive users and viewers receive no scheduled copy and viewer reads remain personal-empty',t=>{
  const f=fixture(t);f.source();f.post();f.store.put('users',f.users.other.id,{...f.users.other,active:false});assert.equal(f.service.scanDue().created,4);assert.equal(f.store.all('weeklyWorkSummaries').some(row=>row.ownerId===f.users.viewer.id),false);
  assert.ok(f.service.get(f.users.viewer).sections.every(row=>row.total===0));
});

test('existing learning comparisons are reused with source timing and units intact',t=>{
  const f=fixture(t);
  for(const [id,publishedAt,views]of [['abcdefghijk','2026-09-01T01:00:00Z',0],['bcdefghijkl','2026-09-08T01:00:00Z',0],['cdefghijklm','2026-09-15T01:00:00Z',0],['defghijklmn','2026-10-05T01:00:00Z',20]]){
    const entry=f.post({url:'https://www.youtube.com/watch?v='+id,publishedAt});
    f.store.put('postPerformanceEntries',entry.id,{...f.store.get('postPerformanceEntries',entry.id),publicationFormat:'youtube-video'});
    f.performance.manualCheckpoint(f.users.owner,entry.id,72,{measuredAt:new Date(Date.parse(publishedAt)+72*3600000).toISOString(),metrics:{views}});
  }
  const row=section(f.service.get(f.users.owner),'performance').items[0];assert.match(row.text,/조회 20회/);assert.match(row.text,/이전 3편 중앙값 0회/);assert.match(row.text,/변화율 계산 안 함/);assert.doesNotMatch(row.text,/Infinity/);
});

test('client response waiting is not counted as an action assigned to the current user',t=>{
  const f=fixture(t),p=f.project({nextContactDate:'',dueDate:''}),raw=f.store.get('clientProjects',p.id);
  f.store.put('clientProjects',p.id,{...raw,versions:[{id:randomUUID(),kind:'preview',label:'시안',createdAt:IN_WEEK}],messages:[]});
  assert.equal(section(f.service.get(f.users.owner),'attention').total,0);
});

test('experiment notes saved during the following week are visible while archived plans are omitted',t=>{
  const f=fixture(t),id=randomUUID();f.store.put('contentDrafts',id,{id,ownerId:f.users.owner.id,title:'이번 주 선택',createdAt:NOW,status:'ready',input:{editorialNote:'PRIVATE-NOTE'},plan:{ideas:[]}});
  assert.equal(section(f.service.get(f.users.owner),'upcoming').total,1);
  f.store.put('contentDrafts',id,{...f.store.get('contentDrafts',id),status:'archived'});assert.equal(section(f.service.get(f.users.owner),'upcoming').total,0);
});

test('missing source arrays do not disguise a read failure as a valid empty section',t=>{
  const f=fixture(t,{postPerformance:{list(){return {};}}});
  const result=f.service.get(f.users.owner);assert.equal(section(result,'completed').status,'partial');assert.equal(section(result,'performance').status,'partial');
});
