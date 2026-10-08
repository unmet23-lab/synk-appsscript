import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import {createDiscoveryAdapter} from '../experiences/atlas-lab/discovery.mjs';
import {getDiscoveryGuidance,getDiscoveryReadiness} from '../experiences/atlas-lab/discovery-guidance.mjs';
import {getDisclosureDifferences,getPreferenceSummary} from '../experiences/atlas-lab/dating-insights.mjs';
import {getLiveChange} from '../experiences/atlas-lab/dating-live.mjs';

const at='2026-10-07T00:00:00.000Z';
const clone=value=>structuredClone(value);
function fixture(publicRegions){
  const values={consent:true,availability:'weekend',...(publicRegions?{'self.meetingRegions':publicRegions}:{})};
  const api=createDiscoveryAdapter({Domain,Ask,Personalization,ownerId:'fit-own',contextId:'fit-context',synthetic:false,candidates:[{id:'fit-peer',label:'가상 공개 상대',values,required:[]}]});
  let state=api.create(),clock=Date.parse(at);
  const act=action=>{clock+=1000;state=api.record(state,{...action,at:new Date(clock).toISOString()});};
  act({kind:'set',field:'consent',value:true});act({kind:'set',field:'availability',value:'weekend'});
  const view=(time=new Date(clock).toISOString())=>({mode:'account',synthetic:false,status:'active',paused:false,adult:{selfDeclared:true},onboarding:{complete:true},
    profile:{nickname:'가상 본인',values:{}},consents:{storePreferences:true,profilePublic:true,receiveInvitations:true},
    discovery:api.inspect(state,{at:time}),candidates:[{accountId:'fit-peer',nickname:'가상 공개 상대',values:clone(values),required:[]}],pairs:[],experience:{records:[]}});
  return {act,view};
}

test('public meeting regions require my own actual answer and cannot mark preparation confirmed',()=>{
  const f=fixture(['seoul-center']),view=f.view();
  assert.equal(view.discovery.candidates[0].status,'pending');
  assert.equal(getDiscoveryGuidance(view).id,'own-meeting-regions-missing');
  const result=getDiscoveryReadiness(view);
  assert.equal(result.status,'needs-action');assert.equal(result.preparation.status,'needed');assert.equal(result.recommendation.status,'blocked');
  assert.equal(result.preparation.items[0].action.field,'self.meetingRegions');
  assert.equal(view.discovery.fields.find(field=>field.id==='self.meetingRegions').value,null);
});

test('missing public region attribution uses my confirmed array and current authorized public profile without private data',()=>{
  const f=fixture();f.act({kind:'set',field:'self.meetingRegions',value:['busan','seoul-center'],target:'baseline'});
  const view=f.view(),before=clone(view);
  for(const key of ['private','feedback','records'])Object.defineProperty(view.candidates[0],key,{get(){throw new Error('must not read peer private data');}});
  const result=getDiscoveryReadiness(view);
  assert.equal(result.preparation.status,'confirmed');assert.equal(result.recommendation.status,'waiting');
  assert.deepEqual(result.pending.public.map(item=>item.field),['self.meetingRegions']);assert.equal(result.pending.unclassified,false);
  assert.match(getDiscoveryGuidance(view).body,/만남 가능|만날/);
  assert.doesNotMatch(JSON.stringify(result),/fit-peer|부산|seoul-center/);
  assert.deepEqual({...view,candidates:before.candidates},before);
});

test('ambiguous stale and malformed public region proof is not presented as a known missing public answer',()=>{
  const f=fixture();f.act({kind:'set',field:'self.meetingRegions',value:['seoul-center'],target:'baseline'});
  const original=f.view();
  for(const change of [
    view=>view.candidates.push(clone(view.candidates[0])),
    view=>{view.candidates[0].values['self.meetingRegions']=[];},
    view=>{view.discovery.candidates[0].reasonDetails.find(detail=>detail.field==='self.meetingRegions').value=['busan'];},
    view=>{view.discovery.fields.find(field=>field.id==='self.meetingRegions').value=['서울 소개만'];},
  ]){
    const view=clone(original);change(view);const result=getDiscoveryReadiness(view);
    assert.deepEqual(result.pending.public,[]);assert.notEqual(result.recommendation.status,'ready');
  }
});

test('region publication compares ongoing baseline instead of current context and returns detached arrays',()=>{
  const f=fixture();f.act({kind:'set',field:'self.meetingRegions',value:['busan','seoul-center'],target:'baseline'});
  f.act({kind:'set',field:'self.meetingRegions',value:['incheon'],target:'context'});
  const view=f.view();view.profile.values['self.meetingRegions']=['daegu'];view.consents.profilePublic=false;
  const before=clone(view),result=getDisclosureDifferences(view),item=result.differences.find(item=>item.field==='self.meetingRegions');
  assert.deepEqual(item.baselineValue,['seoul-center','busan']);assert.deepEqual(item.publicValue,['daegu']);
  assert.match(item.baselineLabel,/부산/);assert.doesNotMatch(item.baselineLabel,/인천/);assert.equal(result.canEnablePublic,false);
  item.baselineValue.push('jeju');item.publicValue.push('busan');assert.deepEqual(view,before);
});

test('expired or malformed private region answers and malformed public arrays do not become publishable answers',()=>{
  const f=fixture();f.act({kind:'set',field:'self.meetingRegions',value:['seoul-center'],target:'baseline',until:'2026-10-07T00:01:00.000Z'});
  const earlier=f.view();assert.ok(getDisclosureDifferences(earlier).differences.some(item=>item.field==='self.meetingRegions'));
  const expired=f.view('2026-10-07T00:01:00.000Z');assert.equal(getDisclosureDifferences(expired).differences.some(item=>item.field==='self.meetingRegions'),false);
  for(const invalid of [[],['busan','busan'],['private sentinel text']]){
    const view=clone(earlier);view.profile.values['self.meetingRegions']=invalid;
    const result=getDisclosureDifferences(view);assert.equal(result.differences.some(item=>item.field==='self.meetingRegions'),false);assert.doesNotMatch(JSON.stringify(result),/sentinel/);
  }
});

test('legacy mixed answers do not add unknown question burden or publish as new relationship axes',()=>{
  const f=fixture(),view=f.view(),result=getPreferenceSummary(view);
  assert.equal(result.status,'ready');assert.equal(result.groups.some(group=>group.items.some(item=>item.field==='self.purpose'||item.field==='wants.purpose')),false);
  for(const name of ['self.relationshipGoal','wants.relationshipGoal','self.relationshipSpeed','wants.relationshipSpeed'])
    assert.ok(result.groups.some(group=>group.items.some(item=>item.field===name)));
  assert.equal(getDisclosureDifferences(view).differences.some(item=>item.field==='self.purpose'),false);
});

test('expired context importance describes the current baseline and only its valid deadline',()=>{
  const f=fixture();f.act({kind:'set',field:'wants.plan',value:'planned',target:'baseline'});
  f.act({kind:'priorities',fields:['wants.plan'],target:'baseline',until:'2026-10-07T00:02:00.000Z'});
  f.act({kind:'priorities',fields:['wants.plan'],target:'context',until:'2026-10-07T00:01:00.000Z'});
  const active=getPreferenceSummary(f.view()).groups.find(group=>group.id==='priorities').items[0];
  assert.match(active.detail,/이번 회차/);assert.equal(active.until,'2026-10-07T00:01:00.000Z');
  const restored=getPreferenceSummary(f.view('2026-10-07T00:01:00.000Z')).groups.find(group=>group.id==='priorities').items[0];
  assert.match(restored.detail,/평소/);assert.equal(restored.until,'2026-10-07T00:02:00.000Z');
  assert.equal(getPreferenceSummary(f.view('2026-10-07T00:02:00.000Z')).groups.find(group=>group.id==='priorities').items.length,0);
});

test('changed or withdrawn own criterion review invalidates an old draft without returning its private content',()=>{
  const f=fixture(),before=f.view();before.accountId='fit-own';before.revision=1;
  before.pairs=[{pairId:'fit-pair',status:'active',paused:false,criterionReviews:[{appointmentId:'fit-meeting',selectedField:'wants.plan',response:'more-important',canPreview:true,reviewCriterion:{label:'나만 보는 기준',valueLabel:'private sentinel'}}]}];
  for(const mutate of [after=>{after.pairs[0].criterionReviews[0].canPreview=false;},after=>{after.pairs[0].criterionReviews=[];},after=>{after.pairs[0].criterionReviews[0].selectedField='wants.notice';}]){
    const after=clone(before);mutate(after);const result=getLiveChange(before,after);assert.equal(result.kind,'invalidate');
    assert.doesNotMatch(JSON.stringify(result),/sentinel|fit-pair|fit-meeting/);
  }
  assert.equal(before.pairs[0].criterionReviews[0].canPreview,true);
});
