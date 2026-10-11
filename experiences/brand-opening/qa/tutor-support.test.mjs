import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerSupport,rhythmSupport,obstacleSupport,runnerCheckSupport,hangulSupport,firstSupport,normalizeSupport,createSupportLedger,supportKey,supportLine} from '../game-tutor-support.mjs';
import {acceptTutorEvent,TUTOR_GAME_EVENT} from '../game-tutor-contract.mjs';
import {PracticeRun,savePractice,BEAT_AT} from '../tutor-practice-core.mjs';
import {RoundState,TRACKS} from '../../korean-rhythm/core.mjs';
import {LISTENING_CHECKS,listeningCheckFeedback} from '../../korean-runner/listening-check.mjs';
const store=()=>{const map=new Map();return {getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};};
const q=()=>({...new RoundState(TRACKS[0],'easy',12).questions[0],delivered:'completed'});

test('runner timing, different action and no action remain physical observations rather than language diagnoses',()=>{
 const raw={id:'jump-0',steps:[{action:'jump',status:'timing',label:'점프'},{action:'lane',target:1,status:'different',label:'가운데'},{action:'stay',status:'missed',label:'그대로'},{action:'slide',status:'done',label:'숙이기'}]};
 const out=normalizeSupport(runnerSupport(raw),'runner');assert.deepEqual(out.map(e=>[e.type,e.step]),[['timing','jump'],['control','middle'],['control','stay']]);assert.ok(out[0].timed);assert.ok(!out.some(e=>e.type==='language'));
 assert.equal(normalizeSupport(obstacleSupport('barrier'),'runner')[0].step,'jump');assert.equal(normalizeSupport(obstacleSupport('arch'),'runner')[0].step,'slide');
});
test('real rhythm verdicts keep sentence correctness separate from the actual timing quality, including both failures',()=>{
 for(const [correct,quality,expected] of [[true,0,['timing']],[false,1,['language']],[false,0,['language','timing']],[true,1,[]]]){
  const question=q();question.response=correct?question.options.indexOf(question.answer):1-question.options.indexOf(question.answer);
  const before=JSON.stringify(question),out=normalizeSupport(rhythmSupport({q:question,quality,correct}),'rhythm');
  assert.deepEqual(out.map(e=>e.type),expected);assert.equal(JSON.stringify(question),before);
  if(correct&&quality===0){assert.equal(out[0].answerCorrect,true);assert.match(supportLine('marin',out[0]),/문장 답은 맞았다/);}
 }
 const round=new RoundState(TRACKS[0],'easy',4),question=round.questions[0],event=round.input(1-question.options.indexOf(question.answer),question.time);
 assert.equal(event.correct,false);assert.ok(event.quality>0);assert.deepEqual(normalizeSupport(rhythmSupport(event),'rhythm').map(e=>e.type),['language']);
});
test('unanswered and interrupted audio cannot become a fabricated sentence misunderstanding',()=>{
 const question=q();question.response=null;
 assert.deepEqual(normalizeSupport(rhythmSupport({q:question,quality:0,correct:false}),'rhythm').map(e=>e.type),['unanswered']);
 question.delivered='interrupted';assert.deepEqual(normalizeSupport(rhythmSupport({q:question,quality:0,correct:false}),'rhythm').map(e=>e.type),['audio']);
 const h=hangulSupport({id:'hg-1',target:'아',selected:'어',options:['아','어'],heard:false});assert.equal(normalizeSupport(h,'hangul')[0].type,'audio');
});
test('listening checks and server sentence feedback retain the actual selected and verified correct answers',()=>{
 const item=LISTENING_CHECKS[7],choice=(item.correct+1)%3,fb=listeningCheckFeedback(item,choice);
 const entry=normalizeSupport(runnerCheckSupport(item,choice,fb),'runner')[0];assert.equal(entry.type,'language');assert.equal(entry.review.correct,item.correct);assert.equal(entry.hint,fb.correction);
 const question={questionId:'greeting',prompt:'친구를 만났어요.',options:[{optionId:'hello',text:'안녕하세요'},{optionId:'thanks',text:'감사합니다'}]};
 const first=normalizeSupport(firstSupport(question,{correctOptionId:'hello'},'thanks'),'first')[0];assert.equal(first.review.correct,0);assert.equal(first.review.selected,1);assert.equal(first.review.prompt,question.prompt);
});
test('the bridge accepts only bounded support on graded outcomes, strips identity/capabilities, and rejects remote audio or action-as-language',()=>{
 const source={},origin='http://127.0.0.1:4314',game='rhythm',valid=rhythmSupport({q:{...q(),response:0},correct:false,quality:1});
 const event={source,origin,data:{type:TUTOR_GAME_EVENT,version:1,game,kind:'retry',support:valid,accountId:'private',capability:'no'}};
 const accepted=acceptTutorEvent(event,{source,origin,game});assert.ok(accepted.support?.length);assert.equal(accepted.accountId,undefined);assert.equal(accepted.capability,undefined);
 assert.equal(acceptTutorEvent({...event,source:{}},{source,origin,game}),null);assert.equal(acceptTutorEvent({...event,origin:'https://other.invalid'},{source,origin,game}),null);
 assert.equal(acceptTutorEvent({...event,data:{...event.data,kind:'picked'}},{source,origin,game}).support,undefined);
 for(const audio of ['https://other.invalid/record.mp3','korean-rhythm/assets/narration/../../token.mp3','korean-rhythm/assets/narration/%2fsecret.mp3'])assert.equal(normalizeSupport([{...valid[0],review:{...valid[0].review,audio}}],game).length,0);
 assert.equal(normalizeSupport([{id:'run-1',type:'language',review:{prompt:'跳',options:['左','右'],correct:0,selected:1,audio:'korean-runner/assets/voice/left.mp3'}}],'runner').length,0);
});
test('recent difficulties stay separated by owner, tutor and game, and guided success is not an original response',()=>{
 const storage=store(),owner='support-unit-account',ledger=createSupportLedger({storage,owner,tutor:'marin',game:'runner'});
 const entry=ledger.add(runnerSupport({id:'unit-jump',steps:[{action:'jump',status:'timing',label:'점프'}]}))[0];ledger.mark(entry);assert.equal(ledger.pending(),0);
 for(const [other,tutor,game] of [['different-account','marin','runner'],[owner,'mongle','runner'],[owner,'marin','rhythm']])assert.equal(createSupportLedger({storage,owner:other,tutor,game}).list().length,0);
 const saved=JSON.parse(storage.getItem(supportKey(owner,'marin','runner')));assert.equal(saved.entries[0].practised,true);assert.equal(saved.entries[0].review,undefined);
 ledger.add([entry]);assert.equal(ledger.pending(),1);
});
test('focused practice requires the chosen action and timing, and never grants the complete introduction record',()=>{
 const run=new PracticeRun('runner',{steps:['jump'],timed:true});assert.equal(run.fullIntro,false);run.tryIt(0);assert.equal(run.input('slide',BEAT_AT).correct,false);assert.equal(run.input('jump',0).reason,'timing');assert.equal(run.input('jump',BEAT_AT).correct,true);run.next();assert.equal(run.complete,true);assert.equal(savePractice(store(),'guest','marin',run),false);
 assert.throws(()=>new PracticeRun('runner',{steps:['not-a-step']}),TypeError);
});
test('the no-action and held-note rehearsals cannot pass by a quick press or by moving during the waiting window',()=>{
 const quiet=new PracticeRun('runner',{steps:['stay']});quiet.tryIt(0);assert.equal(quiet.wait(1000).accepted,false);assert.equal(quiet.input('jump',1000).correct,false);assert.equal(quiet.wait(2100).accepted,false);assert.equal(quiet.wait(3100).correct,true);
 const held=new PracticeRun('rhythm',{steps:['hold-left']});held.tryIt(0);assert.equal(held.input('left',100).holding,true);assert.equal(held.release('left',300).correct,false);assert.equal(held.input('left',500).holding,true);assert.equal(held.release('left',1800).correct,true);
});
test('all error hints keep the mascot speech signature, including correct-language and missed-beat feedback',()=>{
 const entries=[...normalizeSupport(obstacleSupport('fence'),'runner'),...normalizeSupport(rhythmSupport({q:{...q(),response:0},quality:0,correct:false}),'rhythm'),...normalizeSupport(hangulSupport({id:'unit-hg',target:'아',selected:'어',options:['아','어']}),'hangul')];
 for(const entry of entries){assert.doesNotMatch(supportLine('marin',entry),/[?!？！]/);assert.match(supportLine('marin',entry),/확인|…/);assert.match(supportLine('kkamong',entry),/이 몸|내|나도/);assert.match(supportLine('mongle',entry),/같이/);assert.match(supportLine('mongle',entry),/[!?]/);}
});
