import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CAMPAIGN} from '../campaign.js';
import {racingItem,personalizedStage,RACING_CANDIDATES} from '../personalization.js';
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
