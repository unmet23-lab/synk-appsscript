import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildClientSchedule} from './client-schedule.mjs';
import {buildClientCloseout,clientDeliveryIdentity,clientCloseoutWorkKey} from './client-closeout.mjs';
import {buildClientDeadlineOverlaps} from './client-deadline-overlaps.mjs';

const now='2026-10-12T03:00:00.000Z';
const targets={kickoff:'',preview:'',customer:'',revision:'',delivery:''};
const raw=(extra={})=>({id:randomUUID(),title:'합성 프로젝트',ownerId:'owner',reviewerId:'reviewer',stage:'planning',dueDate:'',revision:1,versions:[],messages:[],history:[],schedulePlan:{enabled:true,calendar:'calendar',targets:{...targets},remainingWorkDays:null,customerWaitDays:null,internalReviewDays:null},...extra});
const scheduled=(dates={},extra={})=>raw({...extra,schedulePlan:{enabled:true,calendar:'calendar',targets:{...targets,...dates},remainingWorkDays:null,customerWaitDays:null,internalReviewDays:null,...extra.schedulePlan}});
const preview=(id=randomUUID(),extra={})=>({id,kind:'preview',label:'현재 시안',createdAt:'2026-10-10T03:00:00Z',approvedAt:null,...extra});
const projection=(row,at=now,options={})=>({...row,schedule:buildClientSchedule(row,{now:at,...options}),closeout:buildClientCloseout(row,{now:at})});
const report=(rows,at=now)=>buildClientDeadlineOverlaps(rows.map(row=>projection(row,at)),{now:at});
const rejects=fn=>assert.throws(fn,error=>error.status===500);

test('same-date deadlines from different projects are grouped without combining titles or source kinds',()=>{
  const a=scheduled({preview:'2026-10-15',delivery:'2026-10-15'},{title:'동일 제목',dueDate:'2026-10-15'}),b=scheduled({customer:'2026-10-15'},{title:'동일 제목'}),before=JSON.stringify([a,b]);
  const view=report([a,b]);assert.equal(view.days.length,1);const day=view.days[0];assert.equal(day.date,'2026-10-15');assert.equal(day.projectCount,2);assert.equal(day.milestoneCount,4);assert.equal(day.projects.length,2);
  const pa=day.projects.find(row=>row.projectId===a.id);assert.equal(pa.milestones.find(row=>row.id==='agreed:delivery').dateType,'agreed');assert.equal(pa.milestones.find(row=>row.id==='target:delivery').dateType,'internal');assert.equal(pa.milestones.find(row=>row.id==='agreed:delivery').dateTypeLabel,'합의한 전달일');
  assert.equal(pa.milestones.find(row=>row.id==='target:preview').href,projection(a).schedule.milestones.find(row=>row.id==='preview').href);assert.equal(JSON.stringify([a,b]),before);
  assert.deepEqual(view.counts,{visibleProjectCount:2,eligibleProjectCount:2,rangeProjectCount:2,rangeMilestoneCount:4,overlapDayCount:1,overlapProjectCount:2,overlapMilestoneCount:4});
});

test('one project with multiple deadlines is never a cross-project overlap',()=>{
  const view=report([scheduled({preview:'2026-10-15',customer:'2026-10-15',delivery:'2026-10-15'},{dueDate:'2026-10-15'})]);assert.deepEqual(view.days,[]);assert.equal(view.counts.rangeMilestoneCount,4);assert.equal(view.counts.overlapProjectCount,0);assert.equal(view.counts.rangeProjectCount,1);
});

test('Korean midnight and both inclusive window boundaries are exact and past dates stay separate',()=>{
  const rows=[1,2].map(()=>scheduled({preview:'2026-10-11',customer:'2026-10-12',delivery:'2026-11-11'},{dueDate:'2026-11-12'}));
  let view=report(rows,'2026-10-11T15:00:00Z');assert.equal(view.period.startDate,'2026-10-12');assert.equal(view.period.endDate,'2026-11-11');assert.equal(view.period.daysAhead,30);assert.equal(view.period.inclusive,true);assert.deepEqual(view.days.map(row=>row.date),['2026-10-12','2026-11-11']);assert.equal(view.observations.overdue.projectCount,2);assert.equal(view.observations.overdue.milestoneCount,2);assert.equal(view.observations.outsideWindow.milestoneCount,2);
  view=report(rows,'2026-10-11T14:59:59Z');assert.equal(view.period.startDate,'2026-10-11');assert.equal(view.period.endDate,'2026-11-10');assert.deepEqual(view.days.map(row=>row.date),['2026-10-11','2026-10-12']);assert.equal(view.observations.overdue.projectCount,0);assert.equal(view.observations.outsideWindow.milestoneCount,4);
});

test('calendar window crosses a year and leap February without changing recorded deadlines',()=>{
  const rows=[1,2].map(()=>scheduled({preview:'2027-01-10'}));let view=report(rows,'2026-12-11T01:00:00Z');assert.equal(view.period.endDate,'2027-01-10');assert.equal(view.days[0].date,'2027-01-10');
  view=report([1,2].map(()=>scheduled({preview:'2028-02-29'})),'2028-01-30T01:00:00Z');assert.equal(view.period.endDate,'2028-02-29');assert.equal(view.days.length,1);
});

test('disabled and archived projects are excluded even with an agreed deadline',()=>{
  const active=scheduled({preview:'2026-10-15'}),disabled=scheduled({preview:'2026-10-15'},{dueDate:'2026-10-15',schedulePlan:{enabled:false}}),archived=scheduled({preview:'2026-10-15'},{stage:'archived',dueDate:'2026-10-15'});const view=report([active,disabled,archived]);assert.deepEqual(view.days,[]);assert.deepEqual(view.observations.excluded,{disabled:1,archived:1,closed:0,complete:0});assert.equal(view.counts.eligibleProjectCount,1);
});

test('completed first-preview and no-request revision targets do not create conflicts',()=>{
  const date='2026-10-15',a=scheduled({preview:date,revision:date},{versions:[preview()]}),b=scheduled({preview:date}),view=report([a,b]);assert.deepEqual(view.days,[]);assert.equal(view.counts.rangeMilestoneCount,1);assert.equal(view.observations.undated.milestoneCount,7);
});

test('current delivery completion and a valid closure are excluded, not the stage label alone',()=>{
  const pv=preview(undefined,{approvedAt:now}),final={id:randomUUID(),kind:'final',label:'최종',approvedPreviewId:pv.id,createdAt:now};
  const complete=scheduled({delivery:'2026-10-15'},{stage:'delivered',dueDate:'2026-10-15',versions:[pv,final]}),closed=structuredClone(complete);closed.id=randomUUID();
  const identity=clientDeliveryIdentity(closed),receipt={id:randomUUID(),deliveryKey:identity.deliveryKey,confirmedAt:now};closed.deliveryReceipts=[receipt];closed.closureHistory=[{deliveryKey:identity.deliveryKey,receiptId:receipt.id,workKey:clientCloseoutWorkKey(closed,identity),closedAt:now}];
  const stageOnly=scheduled({delivery:'2026-10-15'},{stage:'delivered'}),active=scheduled({preview:'2026-10-15'}),view=report([complete,closed,stageOnly,active]);assert.equal(view.observations.excluded.complete,1);assert.equal(view.observations.excluded.closed,1);assert.equal(view.days[0].projectCount,2);assert.ok(view.days[0].projects.some(row=>row.projectId===stageOnly.id));
});

test('old approved final does not complete a newer preview and historical closure cannot hide new work',()=>{
  const pv=preview(undefined,{approvedAt:now}),row=scheduled({delivery:'2026-10-15'},{stage:'delivered',versions:[pv,{id:randomUUID(),kind:'final',label:'이전 최종',approvedPreviewId:pv.id,createdAt:now}]});
  const identity=clientDeliveryIdentity(row),receipt={id:randomUUID(),deliveryKey:identity.deliveryKey,confirmedAt:now};row.deliveryReceipts=[receipt];row.closureHistory=[{deliveryKey:identity.deliveryKey,receiptId:receipt.id,workKey:clientCloseoutWorkKey(row,identity),closedAt:now}];row.versions.push(preview());
  const view=report([row,scheduled({preview:'2026-10-15'})]);assert.equal(view.days[0].projectCount,2);assert.equal(view.observations.excluded.complete,0);assert.equal(view.observations.excluded.closed,0);assert.ok(view.days[0].projects.find(value=>value.projectId===row.id).milestones.some(value=>value.id==='target:delivery'));
});

test('actual internal review and customer waiting deadlines keep the existing current-version links',()=>{
  const pv=preview(),messageId=randomUUID(),a=scheduled({revision:'2026-10-13'},{versions:[pv],messages:[{id:messageId,author:'customer',visibility:'customer',action:'feedback',versionId:pv.id,seconds:15.5,resolved:false,workflow:{status:'review',resultVersionId:pv.id,updatedAt:'2026-10-10T03:00:00Z',history:[{action:'submit_review',at:'2026-10-10T03:00:00Z'}]}}],schedulePlan:{customerWaitDays:2,internalReviewDays:2}}),b=scheduled({preview:'2026-10-12',delivery:'2026-10-13'});
  const projectionA=projection(a),view=buildClientDeadlineOverlaps([projectionA,projection(b)],{now}),today=view.days.find(row=>row.date==='2026-10-12').projects.find(row=>row.projectId===a.id);
  assert.equal(today.milestones.length,2);assert.deepEqual(today.milestones.map(row=>row.audience).sort(),['customer','internal']);assert.ok(today.milestones.every(row=>row.dateType==='check'));
  for(const item of today.milestones)assert.equal(item.href,projectionA.schedule.waiting.find(wait=>'waiting:'+wait.id===item.id).href);
  const revision=view.days.find(row=>row.date==='2026-10-13').projects.find(row=>row.projectId===a.id).milestones[0];const url=new URL(revision.href,'https://local.test');assert.equal(url.searchParams.get('message'),messageId);assert.equal(url.searchParams.get('seconds'),'15.5');assert.equal(url.searchParams.get('version'),pv.id);
});

test('missing dates are explicit and never become today or a claim of spare capacity',()=>{
  const rows=[scheduled(),scheduled({preview:'2026-10-11'},{dueDate:'2026-12-01'})],view=report(rows);assert.deepEqual(view.days,[]);assert.equal(view.observations.undated.projectCount,2);assert.equal(view.observations.undated.milestoneCount,6);assert.equal(view.observations.overdue.projectCount,1);assert.equal(view.observations.outsideWindow.projectCount,1);assert.match(view.note,/일이 얼마나 많은지를 뜻하지는 않아요/);assert.ok(view.observations.undated.projects.every(project=>project.href.endsWith('&schedule=1')));
});

test('the report returns only minimal permitted labels and links, never customer bodies or estimates',()=>{
  const rows=[1,2].map(()=>scheduled({preview:'2026-10-15'},{summary:'PRIVATE-SUMMARY',internalNotes:'PRIVATE-NOTES',contact:'PRIVATE-CONTACT',schedulePlan:{remainingWorkDays:123}})),view=report(rows);assert.doesNotMatch(JSON.stringify(view),/PRIVATE-|remainingWorkDays|estimatedFinishDate|ownerId|reviewerId|history|messages|versions/);assert.equal(view.days[0].projectCount,2);
});

test('input order cannot change deterministic output or mutate the projections',()=>{
  const rows=[scheduled({preview:'2026-10-17',customer:'2026-10-15'}),scheduled({preview:'2026-10-15',delivery:'2026-10-17'})].map(row=>projection(row)),before=JSON.stringify(rows),first=buildClientDeadlineOverlaps(rows,{now}),second=buildClientDeadlineOverlaps([...rows].reverse(),{now});assert.deepEqual(first,second);assert.equal(JSON.stringify(rows),before);
});

test('malformed dates, duplicate projects, foreign source links and failed reads are not reported as no conflicts',()=>{
  rejects(()=>buildClientDeadlineOverlaps(null,{now}));rejects(()=>buildClientDeadlineOverlaps([],{now:'invalid'}));const p=projection(scheduled({preview:'2026-10-15'}));rejects(()=>buildClientDeadlineOverlaps([p,p],{now}));
  for(const mutate of [row=>delete row.schedule,row=>row.schedule.milestones[1].targetDate='2026-02-30',row=>row.schedule.milestones[1].href='https://other.test/',row=>row.schedule.milestones[1].href='/?tab=workroom&section=clients&project='+randomUUID(),row=>row.schedule.milestones[1].status='unknown',row=>row.schedule.milestones=[],row=>row.schedule.milestones.push(row.schedule.milestones[1]),row=>row.schedule.waiting=null]){const altered=structuredClone(p);mutate(altered);rejects(()=>buildClientDeadlineOverlaps([altered],{now}));}
});

test('large projection is computed in one pass without extra schedule computation or per-project source reads',()=>{
  const base=projection(scheduled({preview:'2026-10-15'})),rows=Array.from({length:5000},(_,index)=>({...base,id:'00000000-0000-4000-8000-'+String(index).padStart(12,'0')}));
  for(const row of rows)row.schedule={...base.schedule,milestones:base.schedule.milestones.map(item=>({...item,href:item.href.replace(base.id,row.id)}))};
  const start=performance.now(),view=buildClientDeadlineOverlaps(rows,{now}),elapsed=performance.now()-start;assert.equal(view.days.length,1);assert.equal(view.days[0].projectCount,5000);assert.equal(view.counts.rangeMilestoneCount,5000);assert.ok(Number.isFinite(elapsed));
});
