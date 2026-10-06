import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CAMPAIGN} from '../campaign.js';
import {racingItem,personalizedStage,RACING_CANDIDATES,racingFollowUp,racingRecheck,linkRacingRecheck} from '../personalization.js';
import {answerFeedback, WORD_BY_ID} from '../learning.js';
const {createGame}=createRequire(import.meta.url)('../../../atlas/game-browser.js');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};

test('recorded independent listening responses change the actual next five questions to reading',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()});
  const initial=personalizedStage(coach).stage;
  assert(initial.items.every(q=>q.mode==='sentence'));
  assert(initial.items.every(q=>racingItem(q).responseFormat==='single-choice'));
  assert(RACING_CANDIDATES.every(q=>q.responseFormat==='single-choice'));
  for(const q of initial.items){const pid=coach.present(racingItem(q));coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:true,assessable:true});}
  const next=personalizedStage(coach).stage;
  assert.equal(next.items[0].mode,'reading');
  assert.notDeepEqual(next.items.map(q=>q.id),initial.items.map(q=>q.id));
  assert.equal(new Set(next.items.map(q=>q.id)).size,5);
});
test('audio-unavailable recommendations only select authored reading items',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()});
  const selected=personalizedStage(coach,{audioAvailable:false});
  assert.equal(selected.stage.items.length,5);
  assert(selected.stage.items.every(q=>racingItem(q).modality==='reading'));
});
test('a hub-requested modality filters actual questions even when audio is available',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()});
  for(const modality of ['reading','listening']){
    const selected=personalizedStage(coach,{audioAvailable:true,modality});
    assert.equal(selected.stage.items.length,5);
    assert(selected.stage.items.every(q=>racingItem(q).modality===modality));
  }
});
test('text help, missing audio and motor-confounded choices cannot become independent listening evidence',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()});
  const items=CAMPAIGN[0].items;
  for(const [index,kind] of ['text','audio','motor'].entries()){
    const pid=coach.present(racingItem(items[index]));
    if(kind!=='audio')coach.delivery(pid,{audio:'completed'});
    if(kind==='text')coach.help(pid,'text');
    const result=coach.answer(pid,{correct:true,assessable:kind!=='motor',reason:kind==='motor'?'motor':undefined});
    assert.equal(result.independent,false);
  }
  assert.equal(coach.summary().independent,0);
});

test('wrong-choice feedback preserves the chosen label and authored reason',()=>{
  const item=CAMPAIGN[0].items[0],wrong=item.options.find(id=>id!==item.answer);
  assert.ok(answerFeedback(item,wrong).includes(WORD_BY_ID[wrong].word));
  assert.ok(answerFeedback(item,wrong).includes(item.explanation));
  assert.equal(answerFeedback(item,item.answer),item.explanation);
});

test('same-course follow-up preserves total, content scope and excludes previously answered items',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()}),stage=CAMPAIGN[0],current=stage.items[0];
  const pid=coach.present(racingItem(current));coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:false,assessable:true});
  const out=racingFollowUp(coach,{current,remaining:stage.items.slice(1),stage});
  assert.equal(out.status,'new');assert.equal(out.remaining.length,4);
  assert.equal(new Set(out.remaining.map(x=>x.id)).size,4);
  assert(stage.items.includes(out.remaining[0]));
  assert.equal(racingItem(out.remaining[0]).skillId,racingItem(current).skillId);
  coach.exposure=()=>({seen:null});
  assert.equal(racingFollowUp(coach,{current,remaining:stage.items.slice(1),stage}).status,'unavailable');
});

test('personalized follow-up cannot leave the teacher exact item scope or append a sixth item',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()}),current=CAMPAIGN[0].items[0],m=racingItem(current);
  coach.assignment=()=>({skillId:m.skillId,difficulty:m.difficulty,modality:m.modality,responseFormat:m.responseFormat,itemKeys:[m.itemKey],familyKeys:[m.familyKey],requiredAttempts:1});
  assert.equal(racingFollowUp(coach,{current,remaining:[CAMPAIGN[0].items[1]],stage:{personalized:true}}).status,'unavailable');
  assert.equal(racingFollowUp(coach,{current,remaining:[],stage:{personalized:true}}).status,'complete');
});

test('an explicit racing follow-up compares real answers without carrying links into unrelated questions',()=>{
  const coach=createGame({gameId:'korean-racing',storage:storage()}),stage=CAMPAIGN[0];
  const answer=(q,correct,help=false)=>{const pid=coach.present(racingItem(q));coach.delivery(pid,{audio:'completed'});if(help)coach.help(pid,'replay');return coach.answer(pid,{correct,assessable:true});};
  const source=answer(stage.items[0],false);
  const original=racingFollowUp(coach,{current:stage.items[0],remaining:stage.items.slice(1),stage});
  const linked=linkRacingRecheck(original,source),q=linked.remaining[0];
  assert.equal(q.recheckSourceAttemptId,source.eventId);
  assert.equal(original.remaining[0].recheckSourceAttemptId,undefined);
  assert.equal(linked.remaining.filter(x=>x.recheckSourceAttemptId).length,1);
  const target=answer(q,true,true),check=racingRecheck(coach,q,target);
  assert.equal(check.status,'assisted-correct');
  assert.equal(racingRecheck(coach,linked.remaining[1],target),null);
  const unavailable=linkRacingRecheck({status:'unavailable',remaining:linked.remaining},source);
  assert.ok(unavailable.remaining.every(x=>!x.recheckSourceAttemptId));
  assert.equal(racingRecheck({},q,target),null);
  assert.equal(racingRecheck({recheck(){throw Error('RUN_ENDED');}},q,target),null);
});
