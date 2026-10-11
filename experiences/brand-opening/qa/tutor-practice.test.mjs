import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeRun,PRACTICES,BEAT_AT,BEAT_PERIOD,BEAT_WINDOW,inputForKey,readPractice,savePractice,practiceKey} from '../tutor-practice-core.mjs';
import {practiceLine} from '../tutor-practice-lines.mjs';
import {KEY_ACTIONS} from '../../korean-runner/controls.mjs';
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};};
function complete(game){const run=new PracticeRun(game);while(!run.complete){run.tryIt(100,{heard:true});assert.equal(run.input(run.step.action,100+(run.step.timed?BEAT_AT:0)).correct,true);assert.equal(run.next(),true);}return run;}

test('the demonstration, finished audio and actual correct action are all required before advancing',()=>{
 for(const game of Object.keys(PRACTICES)){
  const run=new PracticeRun(game);
  assert.equal(run.next(),false);assert.equal(run.input(run.step.action,0).accepted,false);
  if(run.step.audio){assert.equal(run.tryIt(0),false);assert.equal(run.heard,false);}
  assert.equal(run.tryIt(0,{heard:true}),true);
  assert.equal(run.input('wrong control',0).correct,false);assert.equal(run.next(),false);
  assert.equal(run.input(run.step.action,0).correct,true);
  assert.equal(run.input(run.step.action,0).accepted,false);assert.equal(run.complete,false);
  assert.equal(run.next(),true);
  const done=complete(game);assert.equal(done.passed.length,PRACTICES[game].steps.length);
 }
});
test('early and late rhythm input can retry the next note; the right lane alone cannot pass',()=>{
 const run=new PracticeRun('rhythm');for(let i=0;i<2;i++){run.tryIt(0);run.input(run.step.action,0);run.next();}
 assert.equal(run.tryIt(0),false);run.tryIt(100,{heard:true});
 assert.equal(run.input('right',100+BEAT_AT).reason,'direction');
 assert.equal(run.input('left',100).reason,'timing');
 assert.equal(run.input('left',100+BEAT_AT+BEAT_WINDOW+1).reason,'timing');
 assert.equal(run.input('left',100+BEAT_PERIOD+BEAT_AT).correct,true);run.next();assert.equal(run.complete,false);
 run.tryIt(100,{heard:true});assert.equal(run.input('left',100+BEAT_AT).reason,'direction');
 assert.equal(run.input('right',100+BEAT_AT).correct,true);run.next();assert.equal(run.complete,true);
});
test('completion is saved only after every step, and cannot leak between owners, tutors or games',()=>{
 const data=storage(),run=new PracticeRun('runner');assert.equal(savePractice(data,'guest','marin',run),false);
 assert.equal(readPractice(data,'guest','marin','runner'),false);
 const done=complete('runner');assert.equal(savePractice(data,'guest','marin',done),true);
 assert.equal(readPractice(data,'guest','marin','runner'),true);
 for(const [owner,tutor,game] of [['account-a','marin','runner'],['guest','mongle','runner'],['guest','marin','rhythm']])assert.equal(readPractice(data,owner,tutor,game),false);
 for(const record of ['broken','null','{"version":1,"completed":false,"tutor":"marin","game":"runner"}','{"version":2,"completed":true,"tutor":"marin","game":"runner"}','{"version":1,"completed":true,"tutor":"mongle","game":"runner"}']){data.setItem(practiceKey('guest','marin','runner'),record);assert.equal(readPractice(data,'guest','marin','runner'),false);}
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(readPractice(blocked,'guest','marin','runner'),false);assert.equal(savePractice(blocked,'guest','marin',done),false);assert.equal(done.complete,true);
});
test('runner keyboard practice uses the real controls, including Space and physical key alternatives',()=>{
 for(const [code,action] of Object.entries(KEY_ACTIONS))assert.equal(inputForKey('runner',code),action);
 assert.equal(inputForKey('rhythm','KeyF'),'left');assert.equal(inputForKey('rhythm','KeyJ'),'right');assert.equal(inputForKey('rhythm','Space'),null);
 assert.equal(inputForKey('runner','KeyQ'),null);
});
test('each instructional and feedback line preserves the chosen tutor speech signature',()=>{
 const kinds=['demo','left','right','jump','slide','listen','beat','beat-x','hangul','choose','next','success','retry','timing','waiting','audioError','finish'];
 for(const kind of kinds){
  assert.doesNotMatch(practiceLine('marin',kind),/[?!？！]/);assert.match(practiceLine('marin',kind),/수칙|확인|시범|완료|…/);
  assert.match(practiceLine('kkamong',kind),/이 몸|내|나도/);
  assert.match(practiceLine('mongle',kind),/[!?]/);assert.match(practiceLine('mongle',kind),/같이|해냈어/);
 }
});
