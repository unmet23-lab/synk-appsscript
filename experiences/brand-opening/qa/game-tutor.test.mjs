import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_GUIDES,getTutor,tutorLine,tutorFace} from '../game-tutor-lines.mjs';
import {acceptTutorEvent,GAME_EVENTS,TUTOR_GAME_EVENT} from '../game-tutor-contract.mjs';

test('all four real game entrances have three directions in each distinct character voice',()=>{
 assert.deepEqual(Object.keys(GAME_GUIDES),['runner','rhythm','hangul','first']);
 for(const guide of Object.values(GAME_GUIDES))for(const step of guide.steps){
  assert.ok(step.keys&&step.title);
  assert.doesNotMatch(step.text.marin,/[?!？！]/);assert.match(step.text.marin,/수칙|확인|임무|기록|…/);
  assert.match(step.text.kkamong,/이 몸|내|나도/);
  assert.match(step.text.mongle,/[!?]/);assert.match(step.text.mongle,/같이/);
 }
});
test('success, retry, misses and stopping have their own reactions and available approved faces',()=>{
 for(const id of ['marin','kkamong','mongle']){
  const tutor=getTutor(id);
  for(const kind of ['ready','playing','paused','listening','picked','success','combo','retry','unanswered','obstacle','timing','finish','rest']){
   const line=tutorLine(id,kind);assert.ok(line,`${id} ${kind}`);
   assert.ok(tutor.images[tutorFace(id,kind)]);
   if(id==='marin'){assert.doesNotMatch(line,/[?!？！]/);assert.match(line,/확인|완료|기록|임무|…/);}
   if(id==='kkamong')assert.match(line,/이 몸|내|나도/);
   if(id==='mongle')assert.match(line,/[!?]/);
  }
  assert.notEqual(tutorLine(id,'success',0),tutorLine(id,'success',1));
  assert.notEqual(tutorLine(id,'retry',0),tutorLine(id,'retry',1));
  assert.notEqual(tutorLine(id,'finish'),tutorLine(id,'rest'));
  assert.notEqual(tutorLine(id,'retry'),tutorLine(id,'unanswered'));
 }
});
test('frames can signal only their own origin, game and version; payload does not carry account data',()=>{
 const source={},origin='http://127.0.0.1:4314',game='runner';
 const message={source,origin,data:{type:TUTOR_GAME_EVENT,version:1,game,kind:'success',accountId:'should not cross',text:'<script>not dialogue</script>',reason:'invented'}};
 assert.deepEqual(acceptTutorEvent(message,{source,origin,game}),{kind:'success',reason:undefined,completed:true,answer:false});
 for(const change of [{source:{}},{origin:'https://other.invalid'},{data:{...message.data,game:'rhythm'}},{data:{...message.data,version:2}},{data:{...message.data,kind:'award'}}]){
  assert.equal(acceptTutorEvent({...message,...change},{source,origin,game}),null);
 }
 for(const kind of GAME_EVENTS)assert.ok(acceptTutorEvent({...message,data:{...message.data,kind}},{source,origin,game}));
 assert.deepEqual(acceptTutorEvent({...message,data:{...message.data,kind:'finish',completed:false}},{source,origin,game}),{kind:'finish',reason:undefined,completed:false,answer:false});
});
test('unknown mascot identifiers cannot produce a substitute companion',()=>{
 assert.equal(getTutor('not-a-tutor'),null);assert.equal(tutorLine('not-a-tutor','success'),'');assert.equal(tutorFace('not-a-tutor','success'),null);
});
