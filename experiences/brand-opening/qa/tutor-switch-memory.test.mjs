import test from 'node:test';
import assert from 'node:assert/strict';
import {createLifeProgress} from '../../synk-world-app/life-progress.mjs';
import {PACKS,LESSONS} from '../../synk-world-app/life-content.mjs';
import {homeTutorDays,homeTutorDayLine} from '../home-tutor-days.mjs';
import {homeTutorRecommendation,homeTutorLine} from '../home-tutor-lines.mjs';

const START=Date.parse('2026-10-11T10:00:00+09:00'),DAY=86400000;
const tutors={marin:'마린',kkamong:'까몽',mongle:'몽글'};
const lesson=LESSONS.find(value=>value.id==='greetings-expressions'),question=lesson.questions[0];

function fixture({correct=false,helped=false,tutorId}={}){
 const owner='tutor-switch-memory-test',values=new Map();let at=START,writes=0,progress;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,String(value));}};
 const create=()=>{const value=createLifeProgress({owner,storage,now:()=>at});value.summary(PACKS,LESSONS);return value;};
 progress=create();progress.startLesson(lesson);
 progress.recordAnswer({lessonId:lesson.id,questionId:question.id,correct,helped,choiceId:correct?question.answerId:question.choices.find(value=>value.id!==question.answerId).id});
 if(tutorId){at++;progress.recordGuidedPractice({questionId:question.id,tutorId});}
 return {
  get progress(){return progress;},now:()=>at,
  nextDay(){at+=DAY;progress.stop();progress=create();},
  advance(ms){at+=ms;},
  input(snapshot=progress.exportSnapshot()){return {owner,summary:progress.summary(PACKS,LESSONS),snapshot,lessons:LESSONS,now:at};},
  evidence:()=>({snapshot:progress.exportSnapshot(),stored:[...values],writes})
 };
}
const falseSelfMemory=/나랑 같이 봤지|이 몸과 다시 보기로 했지|내가 같이 봤지/;
function readLines(f,snapshot){
 const recommendation=homeTutorRecommendation(f.input(snapshot));
 assert.ok(recommendation.memory,'there is an actual previous learning observation');
 const lines=Object.fromEntries(Object.keys(tutors).map(id=>[id,homeTutorLine(id,recommendation)]));
 return {recommendation,lines};
}

test('all nine tutor pairs attribute a saved guided memory to the tutor who actually took part',()=>{
 for(const [originalId,originalName] of Object.entries(tutors)){
  const f=fixture({tutorId:originalId});f.progress.markDayComplete();f.nextDay();
  const before=f.evidence(),{recommendation,lines}=readLines(f);
  assert.equal(recommendation.kind,'recall');assert.equal(recommendation.memory.tutorId,originalId);
  for(const [selectedId,line] of Object.entries(lines)){
   assert.ok(line.includes(recommendation.memory.title),`${originalId} to ${selectedId} recalls the actual expression`);
   assert.ok(line.includes('어제'));assert.match(line,/함께|같이/);
   if(selectedId!==originalId){
    assert.ok(line.includes(originalName),`${selectedId} credits ${originalName}`);
    assert.doesNotMatch(line,falseSelfMemory,`${selectedId} does not claim somebody else's guided work`);
   }else{
    for(const [otherId,otherName] of Object.entries(tutors))if(otherId!==originalId)assert.ok(!line.includes(otherName));
   }
  }
  assert.equal(new Set(Object.values(lines)).size,3,'the selected tutor keeps its own voice');
  assert.deepEqual(f.evidence(),before,'reading a new tutor voice preserves scores, schedule, memories and stored bytes');
 }
});

test('ordinary assistance and a later assisted answer do not inherit a stale guided tutor identity',()=>{
 for(const earlierGuide of [false,true]){
  const f=fixture(earlierGuide?{tutorId:'marin'}:{correct:true,helped:true});
  if(earlierGuide){
   f.advance(60001);const run=f.progress.startReview();
   f.progress.answerReview({id:question.review.id,runId:run.id,correct:true});
   const item=f.progress.exportSnapshot().daily.days['2026-10-11'].items[question.id];
   assert.equal(item.tutorId,'marin');assert.ok(item.observedAt>item.guidedAt);
  }
  f.nextDay();const before=f.evidence(),{recommendation,lines}=readLines(f);
  assert.equal(recommendation.memory.kind,'assisted');assert.equal(recommendation.memory.tutorId,undefined);
  for(const line of Object.values(lines)){
   assert.match(line,/도움/);assert.doesNotMatch(line,falseSelfMemory);
   for(const name of Object.values(tutors))assert.ok(!line.includes(name),'unnamed help does not guess a tutor');
  }
  assert.deepEqual(f.evidence(),before);
 }
});

test('missing or unknown attribution never names a tutor or copies the unknown value into dialogue',()=>{
 for(const tutorId of [undefined,'unknown-tutor']){
  const f=fixture({tutorId:'marin'});f.nextDay();const before=f.evidence(),snapshot=f.progress.exportSnapshot();
  if(tutorId===undefined)delete snapshot.daily.days['2026-10-11'].items[question.id].tutorId;
  else snapshot.daily.days['2026-10-11'].items[question.id].tutorId=tutorId;
  const {recommendation,lines}=readLines(f,snapshot);
  assert.equal(recommendation.memory.tutorId,undefined);
  for(const line of Object.values(lines)){
   assert.match(line,/도움/);assert.doesNotMatch(line,falseSelfMemory);assert.doesNotMatch(line,/unknown-tutor/);
   for(const name of Object.values(tutors))assert.ok(!line.includes(name));
  }
  assert.deepEqual(f.evidence(),before,'projection of an unattributed snapshot has no persistence side effects');
 }
});

test('retry memories and completed-day summaries do not claim the newly selected tutor was there',()=>{
 const f=fixture();f.progress.markDayComplete();const today=homeTutorDays(f.progress.exportSnapshot(),LESSONS,f.now()).today;
 const recap=homeTutorDayLine('kkamong',today),finished=homeTutorDayLine('kkamong',today,{finished:true});
 for(const text of [recap,finished])assert.doesNotMatch(text,/이 몸과 오늘|나도 같이 봐서 좋았어/);
 for(const id of Object.keys(tutors))assert.doesNotMatch(homeTutorLine(id,{kind:'resume',title:lesson.title},{day:today}),/이 몸과 다 봤지|오늘의 기록도 같이 봤어|함께한 표현을 돌아봤다/);
 f.nextDay();const before=f.evidence(),{recommendation,lines}=readLines(f);
 assert.equal(recommendation.memory.kind,'retry');assert.equal(recommendation.memory.tutorId,undefined);
 for(const line of Object.values(lines))assert.doesNotMatch(line,falseSelfMemory);
 assert.deepEqual(f.evidence(),before);
});
