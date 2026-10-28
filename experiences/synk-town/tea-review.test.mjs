import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {teaAssessmentMetadata,teaReviewUnitHash} from '../../tools/lib/town-tea-review-unit.mjs';
import * as tea from './town/activities/tea-order.mjs';
const source=JSON.parse(fs.readFileSync(new URL('./town/data/lines/tea.json',import.meta.url))),axes=JSON.parse(fs.readFileSync(new URL('./town/data/tea.json',import.meta.url))).axes;
const review=JSON.parse(fs.readFileSync(new URL('../topik-items/review/atlas-world-learning-20261028-tea.json',import.meta.url)));
const now=Date.parse('2026-10-28T03:00:00Z'),ctx={id:'reviewed-1',villageSeed:'synthetic-reviewed',lifeDay:20754,band:'day',level:'L2',nowMs:now,location:'cafe',busy:()=>false,raining:false,learning:{enabled:true,revision:1}};
const open=()=>tea.apply(tea.initial(),{type:'TEA_OPEN',payload:{}},ctx).slot;
function show(slot,guest='a',contentKey){return tea.apply(slot,{type:'TEA_PRESENT',payload:{order:slot.open.id,guest,visible:true,...(contentKey?{contentKey}:{})}},ctx);}
test('fixed independent review authorizes only matching units; a changed word, axis or authorization does not pass',()=>{
  const meta=teaAssessmentMetadata(source,axes,review);assert.equal(Object.values(meta).filter(r=>r.levels.length===2).length,12);
  const changed=structuredClone(source);changed.find(f=>f.id==='guest.tea.req-tea.1').levels.L1+=' 바뀜';
  assert.deepEqual(teaAssessmentMetadata(changed,axes,review)['guest.tea.req-tea.1'].levels,[]);
  assert.deepEqual(teaAssessmentMetadata(source,{...axes,temp:{...axes.temp,warm:{...axes.temp.warm,adv:'차갑게'}}},review)['guest.tea.req-tea.1'].levels,[]);
  assert.equal(Object.values(teaAssessmentMetadata(source,axes,{...review,authorization:'not-approved'})).some(r=>r.levels.length),false);
  for(const row of review.results)assert.equal(teaReviewUnitHash(source.find(f=>f.id===row.id),axes),row.hash);
});
test('actual displayed edition is necessary: matching L2 is assessed; missing/old key and L3 remain unassessed',()=>{
  const slot=open(),g=slot.open.guests[0],key=tea.presentationKey(g.frame,'L2');assert.ok(key,'root must build current reviewed data');
  assert.equal(show(slot,'a',key).learning[0].practice.assessed,true);
  assert.equal(show(slot).learning[0].practice.assessed,false);
  assert.equal(show(slot,'a','old-edition').learning[0].practice.assessed,false);
  slot.open.level='L3';slot.open.dialogue.level='L3';slot.open.dialogue.sceneLevel='L3';
  assert.equal(show(slot,'a',key).learning[0].practice.assessed,false);
});
test('same-tea reference requires its predecessor displayed, and remembered preferences remain unassessed',()=>{
  const slot=open(),a=slot.open.guests[0],b=slot.open.guests[1];a.frame='guest.tea.req-tea.1';a.request={tea:'barley'};
  b.frame='guest.tea.req-same-temp.1';b.request={tea:'barley',temp:'warm'};
  const key=tea.presentationKey(b.frame,'L2');assert.equal(show(slot,'b',key).learning[0].practice.measure.confounded,true);
  const first=show(slot,'a',tea.presentationKey(a.frame,'L2')).slot;
  assert.equal(show(first,'b',key).learning[0].practice.assessed,true);
  a.note=a.frame;a.frame=tea.USUAL;assert.equal(show(slot,'a',tea.presentationKey(a.note,'L2')).learning[0].practice.assessed,false);
});
test('choosing a prebuilt cup keeps the life success but cannot claim cup-composition evidence',()=>{
  let slot=open();const g=slot.open.guests[0];slot=show(slot,'a',tea.presentationKey(g.frame,'L2')).slot;
  const cup={vessel:g.request.temp||'warm',tea:g.request.tea||'barley',honey:g.request.sweet??1};
  const result=tea.apply(slot,{type:'TEA_SERVE',payload:{order:slot.open.id,guest:'a',cup,mode:'preview'}},ctx);
  assert.equal(result.events[0].result,'made');assert.equal(result.learning[0].assessable,false);assert.equal(result.learning[0].reason,'visual');
});
