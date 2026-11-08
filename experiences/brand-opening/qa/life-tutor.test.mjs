import test from 'node:test';
import assert from 'node:assert/strict';
import {lifeTutorKind,lifeTutorLine,lifeTutorDifficulties,lifeTutorExercise} from '../life-tutor-lines.mjs';
import {LESSONS,PACKS} from '../../synk-world-app/life-content.mjs';
import {createLifeProgress} from '../../synk-world-app/life-progress.mjs';
test('each tutor keeps its canonical speech through life, cafe and guided feedback',()=>{
 const phases=['library','cafe','intro','story','question','listen','compose','success','assisted','retry','break','complete','review','reviewDue','reviewNext','reviewEmpty','help','practice','practiceSuccess','practiceRetry','hint'];
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

// 11-08 프론트 검수 A4: 복습 요약 화면에 배우기 첫 화면과 같은 줄(「생활 속 말이 이렇게 많아」)이 나왔다 — 복습이 돌아왔는지 · 곧 돌아오는지 · 아직 없는지를 말한다.
test('the review summary speaks about the review, not the library',()=>{
 for(const phase of ['reviewDue','reviewNext','reviewEmpty']){
  assert.equal(lifeTutorKind({phase,scope:'life'}),phase);
  for(const id of ['marin','kkamong','mongle']){
   const line=lifeTutorLine(id,phase);
   assert.ok(line,`${id} ${phase}`);
   assert.notEqual(line,lifeTutorLine(id,'library'));assert.notEqual(line,lifeTutorLine(id,'review'));
   assert.ok([...line].length<=48,`${id} ${phase}: 튜터 띠 두 줄 안(${[...line].length}자)`);
  }
 }
 assert.equal(lifeTutorKind({phase:'complete',scope:'life'}),'complete','복습 결과는 문제 수칙이 아니라 마친 말');
 assert.equal(lifeTutorKind({scope:'life'}),'library','요약이 아닌 배우기 화면은 그대로');
});

test('돌아온 복습은 표현마다 한 줄 — 레슨 · 이야기에서 따로 잡혀도 겹쳐 보이지 않고 새 장면 수로 묶인다',async()=>{
 // 생활 화면 모듈은 불러올 때 스타일 자리를 찾는다 — 그 한 번만 빈 문서로 넘긴다.
 const had=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,writable:true,value:{querySelector:()=>({})}});
 let reviewRowsByExpression;
 try{({reviewRowsByExpression}=await import('../../synk-world-app/life-ui.mjs'));}
 finally{if(had)Object.defineProperty(globalThis,'document',had);else delete globalThis.document;}
 const rows=reviewRowsByExpression([{korean:'안녕하세요.',origin:'a',soon:false},{korean:'감사합니다.',origin:'b',soon:false},{korean:'안녕하세요.',origin:'c',soon:true},{korean:'',origin:'d'},{korean:'감사합니다.',origin:'e',soon:false}]);
 assert.deepEqual(rows.map(row=>[row.korean,row.scenes,row.origin,row.soon]),[['안녕하세요.',2,'a',true],['감사합니다.',2,'b',false]],'첫 줄 자리 · 곧 다시 나올 장면이 하나라도 있으면 soon');
 assert.equal(rows.reduce((sum,row)=>sum+row.scenes,0),4,'글이 없는 줄만 빠지고 장면 수는 그대로');
});
