import test from 'node:test';
import assert from 'node:assert/strict';
import Domain from '../atlas/domain.js';
import Ask from '../atlas/ask.js';
import Personalization from '../atlas/personalization.js';
import ConditionalPreference from '../atlas/conditional-preference.js';
import { createDiscoveryAdapter } from '../experiences/atlas-lab/discovery.mjs';
import { getCandidateHighlights } from '../experiences/atlas-lab/candidate-highlights.mjs';

const START='2026-10-10T03:00:00.000Z';
const clone=value=>structuredClone(value);
function host({values={},answers={},priorities=['wants.pace','wants.plan'],target='baseline',until}={}) {
  const published={consent:true,availability:'weekend','self.pace':'lead','self.plan':'planned','self.contact':'daily','self.notice':'advance',...values};
  for(const key of Object.keys(published))if(published[key]===undefined)delete published[key];
  const api=createDiscoveryAdapter({Domain,Ask,Personalization,ConditionalPreference,synthetic:false,ownerId:'synthetic-owner',contextId:'synthetic-context',
    candidates:[{id:'synthetic-peer',label:'공개 합성 후보',values:published,required:[]}]});
  let time=Date.parse(START),state=api.create('first',{at:START});
  const next=()=>new Date(++time).toISOString();
  const record=action=>{state=api.record(state,{...action,at:next()});};
  for(const[field,value]of Object.entries({consent:true,availability:'weekend','wants.pace':'lead','wants.plan':'planned','wants.contact':'daily',...answers}))record({kind:'set',field,value});
  if(priorities.length)record({kind:'priorities',fields:priorities,target,...(until?{until}:{})});
  const view=(at=new Date(time).toISOString())=>({...api.inspect(state,{at}),asOf:at});
  const apply=action=>{const preview=api.preview(state,action,{at:next()});state=api.applyPreview(state,preview,{at:next()});};
  return {api,record,view,apply,now:()=>time,raw:()=>clone(state)};
}
const highlights=discovery=>getCandidateHighlights(discovery,discovery.candidates[0]);
const reason=(discovery,field)=>discovery.candidates[0].reasonDetails.find(item=>item.field===field&&item.owner==='self');
const ownField=(discovery,id)=>discovery.fields.find(field=>field.id===id);

test('current effective priority order selects at most two canonical own labels without changing any source',()=>{
  const h=host({priorities:['wants.plan','wants.pace']}),d=h.view();d.candidates[0].reasonDetails.reverse();const before=clone(d),raw=h.raw();
  const rows=highlights(d);assert.deepEqual(rows.map(row=>row.field),['wants.plan','wants.pace']);assert.equal(rows.length,2);
  assert.deepEqual(rows.map(row=>row.comparison),['match','match']);assert.match(rows[0].text,/공개 답이 맞아요/);assert.notEqual(rows[0].label,'wants.plan');
  assert.deepEqual(d,before);assert.deepEqual(h.raw(),raw);rows[0].text='changed';assert.notEqual(highlights(d)[0].text,'changed');
});
test('no priority declaration returns no highlights and never promotes existing matched reasons',()=>{
  const d=host({priorities:[]}).view();assert.ok(d.candidates[0].matched.length);assert.deepEqual(highlights(d),[]);
});
test('a known difference stays different even if arbitrary reason copy says perfect agreement',()=>{
  const d=host({values:{'self.pace':'listen'},priorities:['wants.pace']}).view();reason(d,'wants.pace').text='완벽하게 맞아요. 비공개 원문은 복사하면 안 돼요.';
  const rows=highlights(d);assert.equal(rows[0].comparison,'different');assert.match(rows[0].text,/공개 답은 달라요/);assert.doesNotMatch(JSON.stringify(rows),/완벽|비공개 원문/);
});
test('a missing public answer remains explicitly unconfirmed rather than matched',()=>{
  const d=host({values:{'self.pace':undefined},priorities:['wants.pace']}).view(),rows=highlights(d);
  assert.equal(rows[0].comparison,'unknown');assert.match(rows[0].text,/미확인|비교하지 못/);assert.doesNotMatch(rows[0].text,/맞아요/);
});
test('an explicit any declaration is neutral and does not imply a stronger fit',()=>{
  const rows=highlights(host({answers:{'wants.pace':'any'},priorities:['wants.pace']}).view());assert.equal(rows[0].comparison,'any');assert.match(rows[0].text,/더 맞는 사람을 구분하지/);
});
test('only a current satisfied contact allowance is labelled conditional, distinct from matching the preference',()=>{
  const h=host({values:{'self.contact':'few-days'},priorities:['wants.contact']});h.apply({kind:'conditional-set',ruleId:'contact-with-notice',target:'context'});
  const d=h.view(),rows=highlights(d);assert.equal(rows[0].comparison,'conditional');assert.match(rows[0].text,/같은 일치는 아니지만/);
  reason(d,'wants.contact').conditionStatus='unknown';assert.deepEqual(highlights(d),[]);
});
test('unknown public allowance evidence stays different; a stale or unsupported allowance cannot become conditional',()=>{
  const h=host({values:{'self.contact':'few-days','self.notice':undefined},priorities:['wants.contact']});h.apply({kind:'conditional-set',ruleId:'contact-with-notice',target:'context'});
  const d=h.view();assert.equal(highlights(d)[0].comparison,'different');reason(d,'wants.contact').comparison='conditional';reason(d,'wants.contact').conditionStatus='satisfied';
  d.conditionalPreference.effective.status='inactive';assert.deepEqual(highlights(d),[]);d.conditionalPreference.effective.status='active';reason(d,'wants.contact').conditionalRuleId='invented';assert.deepEqual(highlights(d),[]);
});
test('only current known own wants declarations qualify; explicit unknown and expired values are not filled from history',()=>{
  const h=host();h.record({kind:'mark-unknown',field:'wants.pace'});let d=h.view();assert.deepEqual(highlights(d).map(row=>row.field),['wants.plan']);
  d=host().view();ownField(d,'wants.pace').effective.state='expired';assert.deepEqual(highlights(d).map(row=>row.field),['wants.plan']);
});
test('partner-owned, non-editable and ambiguous own reasons cannot be used as a highlight',()=>{
  for(const edit of [d=>{reason(d,'wants.pace').owner='partner';},d=>{reason(d,'wants.pace').editable=false;},d=>{d.candidates[0].reasonDetails.push(clone(reason(d,'wants.pace')));}]){
    const d=host().view();edit(d);assert.deepEqual(highlights(d).map(row=>row.field),['wants.plan']);
  }
});
test('own reason value, source and provenance must agree with the current effective declaration',()=>{
  for(const edit of [r=>{r.value='listen';},r=>{r.source='context';},r=>{r.at=START;},r=>{r.until='2026-10-11T00:00:00.000Z';},r=>{r.priority=false;}]){
    const d=host().view();edit(reason(d,'wants.pace'));assert.deepEqual(highlights(d).map(row=>row.field),['wants.plan']);
  }
});
test('an independently supplied stale candidate reason cannot replace the current public projection',()=>{
  const d=host().view(),old=clone(d.candidates[0]);old.reasonDetails.find(item=>item.field==='wants.pace'&&item.owner==='self').comparison='different';
  assert.deepEqual(getCandidateHighlights(d,old).map(row=>row.field),['wants.plan']);assert.equal(getCandidateHighlights(d,clone(d.candidates[0])).length,2);
  old.id='unlisted';assert.deepEqual(getCandidateHighlights(d,old),[]);
});
test('current temporary answer provenance is labelled context and past source expiry is excluded at the exact boundary',()=>{
  const h=host({priorities:['wants.pace']}),end='2026-10-10T04:00:00.000Z';h.record({kind:'set',field:'wants.pace',value:'listen',target:'context',until:end});
  const d=h.view(),rows=highlights(d);assert.equal(rows[0].source,'context');assert.equal(rows[0].until,end);d.asOf=end;assert.deepEqual(highlights(d),[]);
});
test('expired baseline importance cannot be shown through stale effective priorities',()=>{
  const end='2026-10-10T04:00:00.000Z',d=host({until:end}).view();d.asOf=end;assert.deepEqual(highlights(d),[]);
  d.asOf=START;d.priorities.expired.baseline=true;assert.deepEqual(highlights(d),[]);
});
test('temporary importance ends at its declared boundary and a fresh projection uses only the valid baseline order',()=>{
  const h=host({priorities:['wants.plan']}),end='2026-10-10T04:00:00.000Z';h.record({kind:'priorities',fields:['wants.pace'],target:'context',until:end});
  const d=h.view();assert.equal(highlights(d)[0].prioritySource,'context');d.asOf=end;assert.deepEqual(highlights(d),[]);
  const rows=highlights(h.view(end));assert.deepEqual(rows.map(row=>row.field),['wants.plan']);assert.equal(rows[0].prioritySource,'baseline');
});
test('dated declarations require the explicit server clock and never consult the device clock',()=>{
  const end='2026-10-10T04:00:00.000Z',d=host({until:end}).view();delete d.asOf;assert.deepEqual(highlights(d),[]);
  const plain=host().view();delete plain.asOf;assert.equal(highlights(plain).length,2);
  const saved=Date.now;try{Date.now=()=>{throw new Error('device clock must not be read');};assert.equal(highlights(plain).length,2);}finally{Date.now=saved;}
});
test('closed, withdrawn, malformed and duplicate-priority projections fail closed without inventing reasons',()=>{
  for(const edit of [d=>{d.context.closed=true;},d=>{ownField(d,'consent').value=false;},d=>{d.priorities.effective=['wants.pace','wants.pace'];},d=>{d.priorities.effective=['self.pace'];},d=>{d.priorities.effective=['wants.purpose'];},d=>{d.candidates.push(clone(d.candidates[0]));}]){
    const d=host().view();edit(d);assert.deepEqual(highlights(d),[]);
  }
  assert.deepEqual(getCandidateHighlights(null,null),[]);
});
test('unrelated private metadata and accessor properties are neither read nor echoed',()=>{
  const d=host().view();let reads=0;Object.defineProperty(d.candidates[0],'privateSettings',{get(){reads++;throw new Error('private');}});
  d.candidates[0].privateNote='SECRET_OTHER_PERSON';reason(d,'wants.pace').label='SECRET_OTHER_LABEL';const rows=highlights(d);
  assert.equal(reads,0);assert.doesNotMatch(JSON.stringify(rows),/SECRET/);assert.equal(rows.length,2);
});
test('required own comparison keeps its baseline authority and is omitted during a conflicting temporary answer',()=>{
  const h=host({priorities:['wants.pace']});h.record({kind:'set',field:'wants.pace',value:'lead',required:true});let rows=highlights(h.view());assert.equal(rows[0].required,true);assert.equal(rows[0].source,'baseline');
  h.record({kind:'set',field:'wants.pace',value:'listen',target:'context'});assert.deepEqual(highlights(h.view()),[]);
});
