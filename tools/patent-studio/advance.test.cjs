'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const core = require('./core.cjs');
const { StudioStore } = require('./store.cjs');
const { verifyExport } = require('./projection-replay.cjs');
const at = ms => new Date(Date.UTC(2026,8,12,0,0,0) + ms).toISOString();
const bounds = (a,b,sourceRef='synthetic-clock-assumption') => ({earliestAt:at(a),latestAt:at(b),basis:'declared-bound',sourceRef});
function fixture() {
  let s=core.createSession({id:'bounds-fixture',createdAt:at(100),exampleId:'unknown-coverage'});
  s=core.applyEvent(s,{id:'known',type:'unknown-set',enabled:false});
  return s;
}
const state = s => Object.fromEntries(core.evaluate(s).cells.map(c=>[c.skill,c.status]));
test('unrecognized help scopes remain explicit and cannot admit independent performance',()=>{
  for(const skills of [['unmapped-skill'],[],['object','typo'],'object',null]) {
    const s=core.applyEvent(fixture(),{id:'bad-scope',type:'help-presented',text:'친구를',skills,at:at(50)});
    assert.deepEqual(state(s),{asr:'accepted',object:'held',past:'held'});
    assert.equal(s.helpEvents[0].scope.status,'unknown');
    assert.deepEqual(s.helpEvents[0].scope.rawSkills,skills);
  }
});
test('scope refinement retains its initial input and restores only an unrelated skill',()=>{
  const before=core.applyEvent(fixture(),{id:'help',type:'help-presented',text:'친구를',skills:['typo'],at:at(50)});
  const after=core.applyEvent(before,{id:'scope-reviewed',type:'help-refined',helpId:'help',skills:['object'],sourceRef:'synthetic-scope-review',at:at(200)});
  assert.deepEqual(state(after),{asr:'accepted',object:'excluded',past:'accepted'});
  assert.deepEqual(after.helpEvents[0].refinements[0].before.scope.rawSkills,['typo']);
  assert.deepEqual(before.original,after.original);
  assert.equal(before.helpEvents[0].scope.status,'unknown');
  assert.throws(()=>core.applyEvent(after,{id:'widen-scope',type:'help-refined',helpId:'help',skills:['all'],sourceRef:'bad'}));
});
test('uncertain time can refine into before, overlap or after without editing original evidence',()=>{
  const before=core.applyEvent(fixture(),{id:'help',type:'help-presented',text:'친구를',skills:['object'],at:at(300),timeBounds:bounds(50,150)});
  assert.deepEqual(state(before),{asr:'accepted',object:'held',past:'accepted'});
  for(const [lo,hi,status] of [[60,80,'excluded'],[100,100,'held'],[120,140,'accepted']]) {
    const after=core.applyEvent(before,{id:'refine',type:'help-refined',helpId:'help',timeBounds:bounds(lo,hi,'synthetic-refinement'),sourceRef:'synthetic-review',at:at(400)});
    assert.equal(state(after).object,status);
    assert.deepEqual(before.original,after.original);
    assert.equal(after.helpEvents[0].refinements.length,1);
    const incremental=core.evaluate(after,{previousProjection:core.evaluate(before).projectionCache});
    assert.deepEqual(incremental.cells,core.evaluate(after,{forceFull:true}).cells);
  }
  assert.throws(()=>core.applyEvent(before,{id:'widen',type:'help-refined',helpId:'help',timeBounds:bounds(0,180),sourceRef:'synthetic-review'}));
});
test('multi-blocker plan is conditional and contrary observation excludes instead of approving',()=>{
  let s=core.applyEvent(fixture(),{id:'help',type:'help-presented',text:'친구를',skills:['object'],at:at(300),timeBounds:bounds(50,150)});
  s=core.applyEvent(s,{id:'task-unknown',type:'task-confirmed',roleConfirmed:false});
  const old=structuredClone(s), evaluated=core.evaluate(s), cell=evaluated.cells.find(c=>c.skill==='object');
  assert.ok(cell.blockers.some(b=>b.code==='help-time-order-unknown'));
  assert.ok(cell.blockers.some(b=>b.code==='role-unconfirmed'));
  assert.equal(evaluated.evidencePlan.projectedQualification.observed,false);
  assert.deepEqual(s,old);
  assert.ok(!evaluated.evidencePlan.selectedActionIds.includes('show-answer-new-response'));
  s=core.applyEvent(s,{id:'unfavorable-time',type:'help-refined',helpId:'help',timeBounds:bounds(50,60),sourceRef:'synthetic-review'});
  assert.equal(state(s).object,'excluded');
  assert.equal(core.evaluate(s).evidencePlan.projectedQualification.qualifiedTargetIds.includes('e0:object'),false);
});
test('store persists refinement, supports restart/replay and rejects invalid refinement atomically',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-bounds-test-')); let store=new StudioStore(dir);
  try {
    let s=store.create({mode:'example',exampleId:'unknown-coverage'});
    s=store.apply(s.id,s.revision,{id:'clear',type:'unknown-set',enabled:false});
    const t=Date.parse(s.createdAt), b=(l,h)=>({earliestAt:new Date(t+l).toISOString(),latestAt:new Date(t+h).toISOString(),basis:'declared-bound',sourceRef:'test-fixture'});
    s=store.apply(s.id,s.revision,{id:'help',type:'help-presented',text:'친구를',skills:['object'],timeBounds:b(-100,100)});
    const before=store.export(s.id);
    assert.throws(()=>store.apply(s.id,s.revision,{id:'bad',type:'help-refined',helpId:'help',timeBounds:b(-200,100),sourceRef:'test'}));
    assert.equal(store.get(s.id).revision,s.revision);
    s=store.apply(s.id,s.revision,{id:'refine',type:'help-refined',helpId:'help',timeBounds:b(50,80),sourceRef:'test'});
    assert.equal(store.verify(s.id).valid,true);
    assert.equal(verifyExport(store.export(s.id)).valid,true);
    assert.deepEqual(store.export(s.id).replay.finalState.original,before.replay.finalState.original);
    store.close();store=new StudioStore(dir);
    assert.equal(store.verify(s.id).valid,true);
  } finally {store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('late explicit time bounds outside a human relative-order review reopen original performance',()=>{
  let s=core.createSession({id:'file-review',mode:'recording',createdAt:at(0)});
  for(const event of [
    {id:'audio',type:'audio-attached',audioRef:'sha256:synthetic',at:at(80)},
    {id:'task',type:'task-confirmed',roleConfirmed:true,pastIndependent:true,exposureScopeConfirmed:true},
    {id:'review',type:'review-original',text:core.TARGET,confirmed:true,performanceTimeConfirmed:true,at:at(100)},
    {id:'help',type:'help-presented',text:'친구를',skills:['object'],at:at(200),timeBounds:bounds(0,50)}
  ]) s=core.applyEvent(s,event);
  assert.equal(state(s).object,'held');
  assert.equal(state(s).asr,'accepted');
  assert.ok(core.evaluate(s).cells.find(c=>c.skill==='object').temporalEvidence.some(t=>t.relation==='unknown'));
});
test('a new response cannot resolve the transcription of original audio in an ASR plan',()=>{
  const s=core.applyEvent(core.createSession({id:'asr-plan'}),{id:'purpose',type:'purpose-set',purpose:'asr-data'});
  const plan=core.evaluate(s).evidencePlan;
  assert.ok(!plan.selectedActionIds.includes('show-answer-new-response'));
  assert.deepEqual(plan.actions.find(a=>a.id==='show-answer-new-response').resolves,[]);
});
