import test from 'node:test';
import assert from 'node:assert/strict';
import * as tea from './town/activities/tea-order.mjs';
const now = Date.parse('2026-10-28T03:00:00Z');
const ctx = { id:'T-1',villageSeed:'synthetic-town',lifeDay:20754,band:'day',level:'L2',nowMs:now,location:'cafe',busy:()=>false,
  raining:false,learning:{enabled:true,revision:1} };
const cup = request => ({ vessel:request.temp || 'warm',tea:request.tea || 'barley',honey:request.sweet ?? 1 });
const open = () => tea.apply(tea.initial(),{type:'TEA_OPEN',payload:{}},ctx).slot;
const send = (slot,type,payload={},host=ctx) => tea.apply(slot,{type,payload:{order:slot.open?.id,guest:'a',...payload}},host);
test('open without actual display writes no learning; visible acknowledgement occurs once',()=>{
  const slot=open();assert.equal(slot.open.guests[0].practice,undefined);
  assert.ok(send(slot,'TEA_PRESENT',{visible:false}).error);
  const shown=send(slot,'TEA_PRESENT',{visible:true});assert.equal(shown.learning.length,1);
  assert.equal(shown.learning[0].kind,'presented');assert.equal(shown.learning[0].practice.assessed,false);
  assert.deepEqual(send(shown.slot,'TEA_PRESENT',{visible:true}).learning,[]);
});
test('wrong first cup, explanation, retry are distinct facts; life outcome keeps its own rule',()=>{
  let slot=send(open(),'TEA_PRESENT',{visible:true}).slot;
  const g=slot.open.guests[0],correct=cup(g.request),wrong={...correct};
  const axis=Object.keys(g.request)[0],key={tea:'tea',temp:'vessel',sweet:'honey'}[axis];
  wrong[key]=tea.VALUES[axis].find(v=>v!==g.request[axis]);
  let result=send(slot,'TEA_SERVE',{cup:wrong,mode:'make'});slot=result.slot;
  assert.equal(result.learning[0].attemptNo,1);assert.equal(result.learning[0].correct,false);assert.equal(result.events.length,0);
  result=send(slot,'TEA_HELP',{kind:'meaning'});slot=result.slot;
  assert.equal(result.learning[0].help,'meaning');assert.equal(slot.open.dialogue.level,'L2');assert.equal(slot.open.dialogue.turns.a.level,'L1');
  result=send(slot,'TEA_SERVE',{cup:correct,mode:'make'});
  assert.equal(result.learning[0].attemptNo,2);assert.equal(result.learning[0].assessable,false);
  assert.equal(result.events[0].result,'made');assert.equal(result.events[0].tries,1);
  assert.equal(result.slot.open.guests[0].done.by,'player');
});
test('consent off preserves life; re-enable/reload never backfills displayed work',()=>{
  const off={...ctx,learning:{enabled:false,revision:2}},shown=send(open(),'TEA_PRESENT',{visible:true},off);
  assert.deepEqual(shown.learning,[]);assert.equal(shown.slot.open.guests[0].displayedAt,now);
  const enabled={...ctx,learning:{enabled:true,revision:3}},again=send(structuredClone(shown.slot),'TEA_PRESENT',{visible:true},enabled);
  assert.deepEqual(again.learning,[]);
  const result=send(again.slot,'TEA_SERVE',{cup:cup(again.slot.open.guests[0].request),mode:'make'},enabled);
  assert.deepEqual(result.learning,[]);assert.equal(result.events[0].result,'made');
});
test('consent revision changes fence late attempts, while stop is not failure evidence',()=>{
  let slot=send(open(),'TEA_PRESENT',{visible:true}).slot;
  const changed=send(slot,'TEA_SERVE',{cup:cup(slot.open.guests[0].request),mode:'make'},{...ctx,learning:{enabled:true,revision:2}});
  assert.deepEqual(changed.learning,[]);
  const stopped=send(slot,'TEA_CLOSE');assert.equal(stopped.scene.outcome,'stopped');
  assert.equal(stopped.learning.length,1);assert.equal(stopped.learning[0].kind,'closed');
});
test('legacy attempted order does not get reclassified as a first measured answer',()=>{
  let slot=open();slot.open.guests[0].tries=2;
  const shown=send(slot,'TEA_PRESENT',{visible:true});assert.deepEqual(shown.learning,[]);
});
test('changing stable level at the host cannot change an open scene',()=>{
  const slot=open(),shown=send(slot,'TEA_PRESENT',{visible:true},{...ctx,level:'L4'});
  assert.equal(shown.slot.open.level,'L2');assert.equal(shown.learning[0].practice.level,'L2');
});
