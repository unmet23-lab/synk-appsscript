import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeTutorKind,lifeTutorLine,lifeTutorDifficulties,lifeTutorExercise} from '../life-tutor-lines.mjs';
import {LESSONS,PACKS} from '../../synk-world-app/life-content.mjs';
import {createLifeProgress} from '../../synk-world-app/life-progress.mjs';
test('each tutor keeps its canonical speech through life, cafe and guided feedback',()=>{
 const phases=['library','cafe','intro','story','question','listen','compose','success','assisted','retry','break','complete','review','help','practice','practiceSuccess','practiceRetry','hint'];
 for(const kind of phases){
  const marin=lifeTutorLine('marin',kind),kkamong=lifeTutorLine('kkamong',kind),mongle=lifeTutorLine('mongle',kind);
  assert.ok(marin&&!/[!?？！]/.test(marin)&&/수칙|확인|기록|임무|준비/.test(marin),kind);
  assert.match(kkamong,/이 몸|내|나도|네가/);assert.match(mongle,/[!?]/);
  assert.equal(new Set([marin,kkamong,mongle]).size,3);
 }
 for(const l of LESSONS)for(const question of l.questions)for(const id of ['marin','kkamong','mongle']){
  const line=lifeTutorLine(id,'retry',{question});assert.ok(line);if(id==='marin')assert.doesNotMatch(line,/[!?]/);
 }
});
test('listening never announces an answer and assisted success is distinct from a first error',()=>{
 assert.equal(lifeTutorKind({phase:'choose',requiresHearing:true}),'listen');
 assert.equal(lifeTutorKind({phase:'choose',compose:true}),'compose');
 assert.equal(lifeTutorKind({phase:'repair'}),'retry');
 assert.equal(lifeTutorKind({phase:'response',helped:true}),'assisted');
 assert.equal(lifeTutorKind({phase:'review',feedback:{correct:false,helped:true}}),'retry');
 assert.equal(lifeTutorKind({phase:'review',feedback:{correct:true,helped:false}}),'success');
 assert.equal(lifeTutorKind({phase:'response',listening:true}),'listen');
 assert.equal(lifeTutorKind({phase:'repair',practiceCompleted:true}),'practiceSuccess');
});
test('every guided exercise uses the existing transfer context and its own authored answer',()=>{
 for(const lesson of LESSONS)for(const q of lesson.questions){
  const value=lifeTutorExercise(lesson,q.id);assert.ok(value,q.id);
  assert.equal(value.prompt,q.review.prompt);assert.equal(value.context,q.review.context);assert.equal(value.answerId,q.review.answerId);assert.deepEqual(value.choices,q.review.choices);assert.equal(value.explanation,q.review.explanation);
  assert.deepEqual(lifeTutorExercise(lesson,q.review.id),value);
  value.choices[0].text='mutated';assert.notEqual(q.review.choices[0].text,'mutated');
 }
 assert.equal(lifeTutorExercise(null,'missing'),null);
});
test('difficulty selection reuses owner progress and never reschedules the first response or transfer appointment',()=>{
 const storage=new Map(),port={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},lesson=LESSONS.find(l=>l.id==='greetings-expressions'),cafe=LESSONS.find(l=>l.id==='cafe-apply');let now=100000;
 const progress=createLifeProgress({storage:port,owner:'test-life-tutor',now:()=>now,uuid:()=>`attempt-${now++}`});progress.summary(PACKS,LESSONS);
 for(const l of [lesson,cafe]){progress.startLesson(l);const q=l.questions[0];progress.recordAnswer({lessonId:l.id,questionId:q.id,correct:false,choiceId:q.choices.find(c=>c.id!==q.answerId).id});}
 const before=progress.exportSnapshot(),life=lifeTutorDifficulties(before,LESSONS),onlyCafe=lifeTutorDifficulties(before,LESSONS,'cafe');
 assert.equal(life.length,2);assert.equal(onlyCafe.length,1);assert.equal(onlyCafe[0].lessonId,cafe.id);
 for(const item of life)assert.ok(lifeTutorExercise(LESSONS.find(l=>l.id===item.lessonId),item.id));
 assert.deepEqual(progress.exportSnapshot(),before);
 assert.equal(lifeTutorDifficulties({reviews:{}},LESSONS).length,0);
 now+=61000;assert.equal(progress.dueReviews().length,2);
 const scheduled=progress.startReview();progress.answerReview({id:scheduled.ids[0],runId:scheduled.id,correct:true});assert.equal(progress.exportSnapshot().reviews[scheduled.ids[0]].intervalDays,1);
});
