import test from 'node:test';
import assert from 'node:assert/strict';
import engine from '../../../atlas/game-browser.js';
import {emptyProgress,meet,graduate} from '../../hangul-stage/core.mjs';
import {createWorldEducation} from '../world-learning-ui.mjs';
import {worldPosition} from '../world-position-kit.mjs';

function fixture(readHangulProgress){
 const panels=[],messages=[];let owner='account-a';
 const progress={get owner(){return owner;},learningProfile:()=>({profile:{status:'active'}}),learningProfileValues:()=>({audio:'available'}),
  status:()=>({scoped:true}),hangulReading:()=>({version:1,answer:'new',at:1,via:'question'})};
 const home={updateStudy(){},toast:message=>messages.push(message),showPanel:(_title,html)=>panels.push(html)};
 const target={localStorage:{getItem(){throw Error('an account must not read legacy device progress');}},
  document:{querySelector:()=>null},addEventListener(){},removeEventListener(){}};
 const education=createWorldEducation({home,getProgress:()=>progress,engine,createPlan:()=>null,position:worldPosition,
  readHangulProgress,target,launchGame(){},startLesson(){},startReview(){}});
 return {education,panels,messages,switchAccount(){owner='account-b';}};
}

test('home position reloads account Hangul after another session graduates, without an installed game host',async()=>{
 const started=meet(emptyProgress(),['v-a'],'2026-10-20T00:00:00.000Z');let raw=JSON.stringify(started),reads=0;
 const f=fixture(async()=>{reads++;return raw;});
 try{
  await f.education.position();assert.match(f.panels.at(-1),/data-position-board="hangul"/);
  assert.match(f.panels.at(-1),/만난 글자 1 \/ 49/);
  raw=JSON.stringify(graduate(started,'2026-10-20T01:00:00.000Z'));
  await f.education.position();assert.doesNotMatch(f.panels.at(-1),/data-position-board="hangul"/);
  assert.match(f.panels.at(-1),/data-skill="ko.reading.main"/);assert.equal(reads,2);
 }finally{f.education.dispose();}
});

test('a failed private account read preserves the current panel instead of displaying a false fresh start',async()=>{
 const f=fixture(async()=>{throw Error('계정 진도를 확인하지 못했어요.');});
 try{await f.education.position();assert.deepEqual(f.panels,[]);assert.deepEqual(f.messages,['계정 진도를 확인하지 못했어요.']);}
 finally{f.education.dispose();}
});

test('an account switch while loading private Hangul cannot render the previous owner record',async()=>{
 let release;const f=fixture(()=>new Promise(resolve=>release=resolve));
 try{
  const opening=f.education.position();
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  f.switchAccount();release(JSON.stringify(emptyProgress()));
  await assert.rejects(opening,/학습 계정이 바뀌었어요/);assert.deepEqual(f.panels,[]);
 }finally{f.education.dispose();}
});
