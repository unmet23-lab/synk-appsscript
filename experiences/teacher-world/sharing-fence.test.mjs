import test from 'node:test';
import assert from 'node:assert/strict';
import {applySharingFence} from './sharing-fence.mjs';
const learner=(id,extra={})=>({id,name:id,accountConnected:true,revoked:false,sharing:{enabled:true,revision:2},skills:[{n:3}],evidence:[{id:'e-'+id}],excludedEvidence:[{id:'x-'+id}],recommendation:{title:'연습'},recommendations:[{title:'연습'}],observations:[{learnerId:id}],careTasks:[{learnerId:id}],gameTargets:{reading:{}},lastEventAt:'2026-10-09T00:00:00Z',activity:{world:{status:'shared',eventCount:12,lastReceivedAt:'2026-10-09T00:00:00Z'},town:{status:'shared',activityCount:3,lastReceivedAt:'2026-10-09T00:00:00Z',recent:[{id:'visit'}],sharing:{enabled:true,revision:4}}},...extra});
const permission=(id,extra={})=>({id,revision:2,enabled:true,connected:true,revoked:false,townRevision:4,townEnabled:true,...extra});
const snapshot=(a=learner('a'),b=learner('b'))=>({classes:[{id:'class',learners:[a,b]}],assignments:[],observations:[{learnerId:'a',note:'a'},{learnerId:'b',note:'b'}],care:[{learnerId:'a',title:'a'},{learnerId:'b',title:'b'}]});
test('known newer sharing-off clears only A private cache and preserves B row, care and external draft',()=>{
  const a=learner('a'),b=learner('b'),workspace=snapshot(a,b),before=structuredClone(workspace),draft={learnerId:'b',sharingRevision:2,text:'작성 중'};
  const result=applySharingFence(workspace,[permission('a',{revision:3,enabled:false}),permission('b')]),rows=result.workspace.classes[0].learners;
  assert.deepEqual(result.changedLearnerIds,['a']);assert.deepEqual(result.revokedLearnerIds,['a']);assert.equal(rows[0].sharing.revision,3);assert.equal(rows[0].sharing.enabled,false);assert.deepEqual(rows[0].skills,[]);assert.equal(rows[0].activity.world.eventCount,0);assert.equal(rows[0].activity.town.activityCount,0);assert.equal(rows[0].recommendation,null);assert.deepEqual(rows[0].careTasks,[]);
  assert.equal(rows[1],b);assert.equal(result.workspace.care[0],workspace.care[1]);assert.equal(draft.text,'작성 중');assert.equal(rows[1].sharing.revision,draft.sharingRevision);assert.deepEqual(workspace,before);
});
test('lower revisions do not roll back a newer child result or restore disabled sharing',()=>{
  const a=learner('a',{sharing:{revision:5,enabled:false},skills:[],activity:{world:{eventCount:0},town:{activityCount:0,sharing:{revision:6,enabled:false}}}}),workspace=snapshot(a);
  const result=applySharingFence(workspace,[permission('a',{revision:4,enabled:true,townRevision:5,townEnabled:true}),permission('b')]);assert.equal(result.workspace,workspace);assert.deepEqual(result.changedLearnerIds,[]);
});
test('same revision denies access conservatively; account withdrawal and roster removal cannot retain private fields',()=>{
  const workspace=snapshot();const result=applySharingFence(workspace,[permission('a',{connected:false,revoked:true})]);assert.deepEqual(result.changedLearnerIds,['a','b']);assert.deepEqual(result.revokedLearnerIds,['a','b']);assert.equal(result.workspace.classes[0].learners.length,1);assert.equal(result.workspace.classes[0].learners[0].accountConnected,false);assert.equal(result.workspace.classes[0].learners[0].activity.world.eventCount,0);assert.deepEqual(result.workspace.observations,[]);
});
test('higher enabled sharing revision still discards the older consent cache pending a fresh read',()=>{
  const result=applySharingFence(snapshot(),[permission('a',{revision:3}),permission('b')]);const a=result.workspace.classes[0].learners[0];assert.equal(a.sharing.enabled,true);assert.equal(a.sharing.revision,3);assert.equal(a.activity.world.status,'pending');assert.deepEqual(a.evidence,[]);assert.deepEqual(result.revokedLearnerIds,[]);
});
test('Town-only withdrawal clears only Town and keeps A learning, care and draft references',()=>{
  const a=learner('a'),b=learner('b'),workspace=snapshot(a,b);const result=applySharingFence(workspace,[permission('a',{townRevision:5,townEnabled:false}),permission('b')]),next=result.workspace.classes[0].learners[0];
  assert.equal(next.sharing,a.sharing);assert.equal(next.skills,a.skills);assert.equal(next.evidence,a.evidence);assert.equal(next.careTasks,a.careTasks);assert.equal(next.activity.world,a.activity.world);assert.equal(result.workspace.assignments,workspace.assignments);assert.equal(result.workspace.care,workspace.care);assert.equal(result.workspace.classes[0].learners[1],b);assert.equal(next.activity.town.sharing.revision,5);assert.equal(next.activity.town.sharing.enabled,false);assert.deepEqual(next.activity.town.recent,[]);assert.equal(next.activity.town.activityCount,0);assert.deepEqual(result.revokedLearnerIds,[]);assert.deepEqual(result.changedTownLearnerIds,['a']);
});
test('same Town revision false wins and lower Town revision cannot undo newer Town knowledge',()=>{
  const workspace=snapshot();const closed=applySharingFence(workspace,[permission('a',{townEnabled:false}),permission('b')]);assert.equal(closed.workspace.classes[0].learners[0].activity.town.sharing.enabled,false);
  const result=applySharingFence(closed.workspace,[permission('a',{townRevision:3,townEnabled:true}),permission('b')]);assert.equal(result.workspace,closed.workspace);
});
test('mixed assignments preserve remaining B and its exact submission while A-only records are removed',()=>{
  const aResult={learnerId:'a',correct:3,total:3},bResult={learnerId:'b',correct:2,total:3},group={id:'group',learnerIds:['a','b'],assignedCount:2,completedCount:2,status:'submitted',submissions:[aResult,bResult],submission:aResult,result:{correct:5,total:6},runs:[{learnerId:'a'},{learnerId:'b'}],targets:{a:{skill:'private-a'},b:{skill:'b'}},recommendations:[{learnerId:'a'},{learnerId:'b'}]};
  const workspace=snapshot();workspace.assignments=[group,{id:'a-only',learnerId:'a',submission:aResult},{id:'b-only',learnerId:'b',submission:bResult}];
  const result=applySharingFence(workspace,[permission('a',{revision:3,enabled:false}),permission('b')]),assignments=result.workspace.assignments;
  assert.equal(assignments.length,2);assert.deepEqual(assignments[0].learnerIds,['b']);assert.equal(assignments[0].submissions[0],bResult);assert.equal(assignments[0].submissions.length,1);assert.equal(assignments[0].assignedCount,1);assert.equal(assignments[0].completedCount,1);assert.equal(assignments[1],workspace.assignments[2]);assert.equal(Object.hasOwn(assignments[0],'submission'),false);assert.equal(Object.hasOwn(assignments[0],'result'),false);assert.deepEqual(Object.keys(assignments[0].targets),['b']);assert.equal(group.submissions.length,2);
});
test('unknown authority does not wipe records, empty verified roster does, and malformed metadata is rejected',()=>{
  const workspace=snapshot();assert.equal(applySharingFence(workspace,null).workspace,workspace);assert.deepEqual(applySharingFence(workspace,[]).workspace.classes[0].learners,[]);assert.throws(()=>applySharingFence(workspace,[permission('a',{revision:'3'})]),TypeError);assert.throws(()=>applySharingFence(workspace,[permission('a'),permission('a')]),TypeError);
});
