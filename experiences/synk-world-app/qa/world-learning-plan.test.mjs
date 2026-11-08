import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PACKS,LESSONS} from '../life-content.mjs';
import {buildWorldLearningCandidates,createWorldLearningPlan,worldLearningSettings} from '../world-learning-plan.mjs';
import {lifeItem,lifeMeasureItem} from '../life-items.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../../korean-runner/listening-check.mjs';
import {RHYTHM_CANDIDATES} from '../../korean-rhythm/personalization.mjs';
import {playState} from '../../brand-opening/play-unlocks.mjs';
import {homeTutorRecommendation} from '../../brand-opening/home-tutor-lines.mjs';
import worldStrings from '../../brand-opening/world-strings.mjs';
const require=createRequire(import.meta.url);
const {createGame,recommendActivities}=require('../../../atlas/game-browser.js');
const NOW=Date.parse('2026-10-13T03:00:00.000Z');
const empty=()=>({version:1,owner:'synthetic',revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{}});
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
const lessonOne=()=>({...empty(),lessons:{[PACKS[0].lessons[0].id]:{completedAt:NOW-86400000,answers:{}}}});
const makeCoach=()=>createGame({gameId:'world-plan-test',storage:store(),clock:()=>new Date(NOW).toISOString()});
const plan=options=>createWorldLearningPlan({now:NOW,recommendActivities,...options});
const complete=(progress,lesson)=>{progress.lessons[lesson.id]={startedAt:NOW-1000,completedAt:NOW-500,answers:{},questionIds:lesson.questions.map(q=>q.id)};};
function review(progress,lesson,{due=NOW,correct=false,helped=false,streak=0,at=NOW-60000}={}){
 const q=lesson.questions[0],answer={correct,helped,at,choiceId:'a'};
 progress.lessons[lesson.id]={startedAt:at-1000,completedAt:at+1,answers:{[q.id]:answer},questionIds:lesson.questions.map(q=>q.id)};
 const value={id:q.review.id,questionId:q.id,lessonId:lesson.id,packId:lesson.packId,skillId:q.skillId,dueAt:due,lastAt:at,
  streak,lapses:!correct||helped?1:0,intervalDays:streak?1:0};
 progress.reviews[value.id]=value;return value;
}

test('each life pack offers its first unfinished canonical lesson; the only games are real WORLD routes, 환승 러시 once a lesson is done',()=>{
 const progress=empty(),first=LESSONS[0];complete(progress,first);
 const candidates=buildWorldLearningCandidates({progress,now:NOW});
 assert.equal(candidates.filter(c=>c.route==='lesson').length,6);
 assert.equal(candidates.find(c=>c.packId===first.packId).lessonId,PACKS[0].lessons[1].id);
 assert.deepEqual(candidates.filter(c=>c.route==='game').map(c=>c.gameId),['runner','rhythm','hangul','subway']);
 assert.deepEqual(buildWorldLearningCandidates({progress:empty(),now:NOW}).filter(c=>c.route==='game').map(c=>c.gameId),['runner','rhythm','hangul']);
 // 11-08(Atlas × WORLD D)부터 레슨 후보는 본문항의 측정을 targets로 갖고(계획이 놓친 칸일 때만 Core에 넘긴다), 카페 방문 장면 레슨은 비운다.
 for(const c of candidates.filter(c=>c.route==='lesson')){
  const lesson=LESSONS.find(l=>l.id===c.lessonId),scene=['cafe-apply','cafe-visit-taste','cafe-visit-soldout','cafe-visit-change','cafe-compose'].includes(lesson.id);
  assert.deepEqual(c.targets.map(t=>t.itemKey),scene?[]:lesson.questions.map(q=>`life.${q.id}`),lesson.id);
  assert.ok(c.targets.every(t=>!t.familyKeys&&t.modality==='reading'&&/^ko\.reading\./.test(t.skillIds[0])),lesson.id);
 }
 assert.equal(candidates.find(c=>c.gameId==='hangul').targets.length,0);
});

test('runner and rhythm targets stay equal to their shipped content and retain response formats',()=>{
 const candidates=buildWorldLearningCandidates({now:NOW});
 const runner=candidates.find(c=>c.gameId==='runner');
 assert.deepEqual(runner.targets.map(t=>t.itemKey),LISTENING_CHECKS.map(item=>checkMetadata(item).itemKey));
 assert.ok(runner.targets.every(t=>t.responseFormat==='single-choice'&&t.modality==='listening'));
 assert.deepEqual(candidates.find(c=>c.gameId==='rhythm').targets,RHYTHM_CANDIDATES);
});

test('declared travel, work and exam goals select different real activities without inventing skill evidence',()=>{
 const travel=plan({settings:{reasons:['travel']}}),work=plan({settings:{reasons:['work']}}),exam=plan({settings:{reasons:['exam']}});
 assert.equal(travel.selected.packId,'cafe');assert.equal(work.selected.packId,'plans');assert.equal(exam.selected.gameId,'runner');
 for(const result of [travel,work,exam]){assert.equal(result.basis,'declared');assert.deepEqual(result.evidence,[]);assert.equal(result.grade,null);assert.equal(result.abilityClaim,false);}
 assert.equal(plan({settings:{}}).selected.lessonId,LESSONS[0].id);
});

test('the primary declared reason guides the choice while settings and presentation remain reversible',()=>{
 const settings={reasons:['travel','work'],primaryReason:'work',minutes:8,support:'independent',audio:'off',explanation:'brief',textSize:'large'};
 const before=JSON.stringify(settings),result=plan({settings});
 assert.equal(result.selected.packId,'plans');assert.deepEqual(result.settings.goals,['work']);
 assert.deepEqual(result.presentation,{support:'independent',audio:'off',explanation:'brief',textSize:'large',motion:'full'});
 assert.equal(JSON.stringify(settings),before);
 assert.deepEqual(worldLearningSettings({reasons:['unknown'],minutes:-1,audio:'invalid',support:'invalid'}),{goals:[],support:'choose',audioAvailable:true});
});

test('real independent listening errors outrank an unrelated declared life interest',()=>{
 const coach=makeCoach();
 for(let i=0;i<3;i++){
  const pid=coach.present({id:`binary-${i}`,itemKey:`binary-${i}`,familyKey:`binary-${i}`,skillId:'ko.listening.negation',difficulty:1,
   modality:'listening',responseFormat:'binary-choice',audioRequired:true,confounded:false});
  coach.delivery(pid,{audio:'completed'});coach.answer(pid,{correct:false,assessable:true});
 }
 const result=plan({summary:coach.summary(),settings:{reasons:['travel']}});
 assert.equal(result.selected.gameId,'rhythm');assert.equal(result.focusSkillId,'ko.listening.negation');assert.equal(result.state,'practice');
 assert.equal(result.evidence.length,3);assert.equal(result.grade,null);
});

test('audio off excludes all listening games and keeps readable life content even with exam preference',()=>{
 const result=plan({summary:makeCoach().summary(),settings:{reasons:['exam'],audio:'off'}});
 assert.equal(result.selected.route,'lesson');assert.equal(result.selected.modality,'reading');
 assert.equal(result.alternatives.some(c=>c.route==='game'),false);
 for(const game of ['runner','rhythm','hangul'])assert.ok(result.excluded.find(c=>c.id===`world.play.${game}`).reasons.includes('audio.unavailable'));
 const cafe=result.candidates.find(c=>c.packId==='cafe'&&c.route==='lesson');assert.equal(cafe.audioRequired,false);
});

test('an insufficient time limit produces unavailable instead of promising an activity that will not fit',()=>{
 const result=plan({settings:{minutes:1}});
 assert.equal(result.selected,null);assert.equal(result.status,'unavailable');assert.ok(result.excluded.every(c=>c.reasons.includes('time.limit')));
});

test('future reviews are not opened early; the exact due time enables the canonical lesson review',()=>{
 const progress=empty(),r=review(progress,LESSONS[0],{due:NOW+1});
 const before=JSON.stringify(progress),early=plan({progress,settings:{reasons:['exam']}});
 assert.equal(early.candidates.some(c=>c.route==='review'),false);
 const due=plan({progress,now:NOW+1,settings:{reasons:['exam']}});
 assert.equal(due.selected.route,'review');assert.equal(due.selected.lessonId,LESSONS[0].id);assert.deepEqual(due.selected.reviewIds,[r.id]);
 assert.equal(due.selected.reviewAt,new Date(r.dueAt).toISOString());assert.deepEqual(due.evidence,[]);
 assert.equal(due.hostEvidence.kind,'retry');assert.equal(JSON.stringify(progress),before);
});

test('a helped first answer is host evidence, and an independently resolved review is no longer labelled difficult',()=>{
 const progress=empty(),r=review(progress,LESSONS[0],{correct:true,helped:true});
 const assisted=plan({progress});assert.equal(assisted.hostEvidence.kind,'assisted');assert.deepEqual(assisted.evidence,[]);
 r.streak=1;r.intervalDays=1;r.lastAt=NOW-100;
 const resolved=plan({progress});assert.equal(resolved.selected.route,'review');assert.equal(resolved.selected.practiceNeed,undefined);
 assert.equal(resolved.hostEvidence,undefined);assert.ok(resolved.reasons.includes('review.due'));
});

test('unknown question ids, mismatched skills and future answer times cannot create host needs or review links',()=>{
 const progress=empty(),r=review(progress,LESSONS[0]);
 r.questionId='not-in-content';assert.equal(plan({progress}).candidates.some(c=>c.route==='review'),false);
 r.questionId=LESSONS[0].questions[0].id;r.skillId='ko.listening.detail';assert.equal(plan({progress}).candidates.some(c=>c.route==='review'),false);
 r.skillId=LESSONS[0].questions[0].skillId;r.lastAt=NOW+1000;assert.equal(plan({progress}).candidates.some(c=>c.route==='review'),false);
});

test('unfinished lessons keep their actual position as first choice, while a too-short budget preserves but does not select them',()=>{
 const progress=empty(),lesson=LESSONS.find(l=>l.type==='story');
 progress.activeLessonId=lesson.id;progress.lessons[lesson.id]={startedAt:NOW-2000,completedAt:null,answers:{},stage:{phase:'story',sceneIndex:2,questionIndex:0}};
 const before=JSON.stringify(progress),result=plan({progress,settings:{reasons:['exam']}});
 assert.equal(result.selected.lessonId,lesson.id);assert.equal(result.selected.resume,true);assert.equal(result.basis,'host-progress');
 assert.ok(result.alternatives.some(c=>c.gameId==='runner'));assert.equal(result.alternatives.some(c=>c.lessonId===lesson.id&&c.route==='lesson'),false);
 const short=plan({progress,settings:{minutes:2}});assert.notEqual(short.selected.lessonId,lesson.id);assert.equal(short.resume,null);
 assert.equal(JSON.stringify(progress),before);
});

test('an existing cross-lesson review batch resumes its pending ids without offering misleading replacement batches',()=>{
 const progress=empty(),a=review(progress,LESSONS[0]),b=review(progress,LESSONS.find(l=>l.packId==='cafe'));
 progress.activeReview={id:'review-batch',startedAt:NOW-10,ids:[a.id,b.id],answers:{[a.id]:{correct:true,helped:false,at:NOW-5}}};
 const before=JSON.stringify(progress),result=plan({progress,settings:{reasons:['exam']}});
 assert.equal(result.selected.resume,true);assert.equal(result.selected.route,'review');assert.equal(result.selected.lessonId,b.lessonId);
 assert.deepEqual(result.selected.reviewIds,[b.id]);assert.equal(result.alternatives.some(c=>c.route==='review'),false);
 assert.equal(JSON.stringify(progress),before);
});

test('completed life content with no due review and no sound remains unavailable without silently replaying completed lessons',()=>{
 const progress=empty();for(const lesson of LESSONS)complete(progress,lesson);
 const result=plan({progress,settings:{audio:'off'}});assert.equal(result.status,'unavailable');assert.equal(result.selected,null);
 assert.ok(result.candidates.every(c=>c.route==='game'));
});

test('cold or partial summaries cannot manufacture ability cells and inputs remain unchanged',()=>{
 const progress=empty(),summary={skills:[],evidenceComplete:false,asOf:new Date(NOW).toISOString()},settings={reasons:['exam'],support:'step',explanation:'detailed'};
 const before=JSON.stringify({progress,summary,settings}),result=plan({progress,summary,settings});
 assert.equal(result.selected.gameId,'runner');assert.ok(result.candidates.every(c=>c.targets.length===0));assert.equal(result.state,'unseen');
 assert.equal(result.presentation.support,'step');assert.equal(result.presentation.explanation,'detailed');assert.equal(result.learningEffectClaim,false);
 assert.equal(JSON.stringify({progress,summary,settings}),before);
});

test('환승 러시: 레슨 하나 전에는 후보가 아니고, 마치면 듣기 놀이 후보가 된다(놀이 해금 표와 같다)',()=>{
 assert.equal(buildWorldLearningCandidates({progress:empty(),settings:{},now:NOW}).some(c=>c.gameId==='subway'),false,'잠긴 학생에게 권하지 않는다');
 // 표에 없는 값(지난 판 기록 · 시각이 망가진 기록)으로는 열리지 않는다.
 assert.equal(buildWorldLearningCandidates({progress:{...empty(),lessons:{[PACKS[0].lessons[0].id]:{completedAt:null}}},settings:{},now:NOW}).some(c=>c.gameId==='subway'),false);
 assert.equal(buildWorldLearningCandidates({progress:{...empty(),lessons:{'없는-레슨':{completedAt:NOW-1000}}},settings:{},now:NOW}).some(c=>c.gameId==='subway'),false);
 const open=buildWorldLearningCandidates({progress:lessonOne(),settings:{},now:NOW}).find(c=>c.gameId==='subway');
 assert.ok(open,'레슨 하나를 마치면 후보');
 assert.equal(open.id,'world.play.subway');assert.equal(open.route,'game');assert.equal(open.modality,'listening');assert.equal(open.audioRequired,true);assert.equal(open.available,undefined);
 assert.ok(open.targets.length>=30);
 assert.ok(open.targets.every(t=>t.skillIds.every(id=>id.startsWith('ko.'))),'목표 급을 고르지 않은 학생은 1~2급 문항만 겨눈다');
 assert.ok(open.targets.every(t=>t.itemKey&&t.familyKeys.length===1&&t.responseFormat==='single-choice'));
 assert.equal(playState('subway',{lessons:1}).open,true);assert.equal(playState('subway',{lessons:0}).open,false);
});
test('환승 러시: 3급 이상을 목표로 고른 학생에게만 3~4급 문항을 겨눈다',()=>{
 const of=settings=>buildWorldLearningCandidates({progress:lessonOne(),settings,now:NOW}).find(c=>c.gameId==='subway').targets;
 assert.ok(of({examType:'topik2',targetGrade:3}).some(t=>t.skillIds.includes('ko2.listening.detail')));
 assert.ok(!of({examType:'topik1',targetGrade:2}).some(t=>t.skillIds[0].startsWith('ko2.')));
});
test('환승 러시: 손님에게 닫혀 있으면 Core가 빼고, 열려 있으면 계획이 고를 수 있고 튜터가 그 이름으로 권한다',()=>{
 const guest=plan({progress:lessonOne(),settings:{},openGames:['hangul']});
 assert.deepEqual(guest.excluded.find(row=>row.id==='world.play.subway')?.reasons,['activity.unavailable']);
 assert.equal(guest.candidates.find(c=>c.id==='world.play.subway').accountRequired,true);
 const signed=plan({progress:lessonOne(),settings:{reasons:['exam'],primaryReason:'exam'}});
 const offered=[signed.selected,...signed.alternatives].find(c=>c.id==='world.play.subway');
 assert.ok(offered,'놀이 후보에 든다');
 const line=homeTutorRecommendation({owner:'o',summary:{owner:'o',education:{selected:offered,reason:'이유'},status:{}},snapshot:{owner:'o'}});
 assert.equal(line.title,'환승 러시 · 안내방송 듣고 갈아타기');assert.equal(line.command,'learn');
 const name=worldStrings['plan.game.subway'];
 assert.ok(name?.ko&&name.en&&name.mn,'계획 줄 이름이 세 언어 다 있다');
});

// Atlas × WORLD D(11-08): 생활 레슨의 targets는 놓친 칸을 당길 때만 싣고, 돌아온 복습이 있는 동안은 싣지 않는다(검수 Fable F1 · FA1 · FA3).
const lessonById=id=>LESSONS.find(lesson=>lesson.id===id);
function answerLesson(coach,id,{help=false,correct=()=>true}={}){
 lessonById(id).questions.forEach((question,index)=>{
  const item=lifeItem({lesson:lessonById(id),question});if(!item||item.confounded)return;
  const pid=coach.present(lifeMeasureItem(item));if(help)coach.help(pid,'explanation');coach.answer(pid,{correct:correct(index),assessable:true});
 });
}
const lessonTargets=(result,id)=>result.candidates.find(c=>c.route==='lesson'&&c.lessonId===id)?.targets.map(t=>t.skillIds[0]);

test('생활 레슨: 「한 단계씩」 도움으로 칸이 supported여도 돌아온 복습이 생활 레슨보다 앞이고, 복습이 없으면 그 칸 레슨이 당겨진다(FA1)',()=>{
 const coach=makeCoach();answerLesson(coach,'greetings-expressions',{help:true});
 const settings={reasons:['travel'],support:'step'};
 const waiting=empty();review(waiting,lessonById('greetings-expressions'),{due:NOW-1000,correct:true,helped:true,at:NOW-86400000});
 const first=plan({progress:waiting,summary:coach.summary(),settings});
 assert.equal(first.selected.route,'review','돌아온 인사 복습이 먼저');
 assert.deepEqual(lessonTargets(first,'cafe-expressions'),[],'복습이 기다리는 동안 레슨은 당기지 않는다');
 const later=empty();review(later,lessonById('greetings-expressions'),{due:NOW+86400000,correct:true,helped:true,at:NOW-86400000});
 const next=plan({progress:later,summary:coach.summary(),settings});
 assert.deepEqual(lessonTargets(next,'cafe-expressions'),['ko.reading.vocabulary','ko.reading.vocabulary'],'도움으로만 푼 칸(supported)만 당긴다 — 처음인 세부 칸은 싣지 않는다');
 assert.equal(next.selected.route,'lesson');
});

test('생활 레슨: 혼자 잘 풀수록 진도가 밀리지 않는다 — 첫 레슨 뒤 · 같은 칸 넷 혼자 맞힌 뒤에도 다음 레슨이 처음 보는 듣기 게임보다 앞(F1)',()=>{
 const coach=makeCoach();answerLesson(coach,'greetings-expressions');
 const progress=empty();complete(progress,lessonById('greetings-expressions'));
 const after=plan({progress,summary:coach.summary(),settings:{reasons:['travel']}});
 assert.equal(after.selected.route,'lesson','첫 레슨 뒤에도 생활 레슨이 먼저');
 assert.ok(after.candidates.filter(c=>c.route==='lesson').every(c=>!c.targets.length),'확인 중(틀림 없음) · 처음 칸은 당기지 않는다');
 // 같은 표현 계열(인사 이야기 · 적용의 「안녕하세요」)은 반복이라 넷이 되려면 다른 표현이 필요하다 — 카페 표현 레슨의 낱말 둘.
 answerLesson(coach,'cafe-expressions');complete(progress,lessonById('cafe-expressions'));
 const cell=coach.summary().skills.find(s=>s.id==='ko.reading.vocabulary').levels[1].formats['single-choice'];
 assert.equal(cell.status,'recent-independent');
 const more=plan({progress,summary:coach.summary(),settings:{reasons:['travel']}});
 assert.equal(more.selected.route,'lesson','최근 혼자 수행한 칸을 겨누는 레슨도 진도 순서로 앞');
});

test('생활 레슨: 틀린 답이 있는 확인 중 칸은 당기고(같은 줄 안에서 점수로 앞섬), 틀림 없는 확인 중 칸은 당기지 않는다(FA3)',()=>{
 const wrong=makeCoach();answerLesson(wrong,'greetings-expressions',{correct:index=>index!==0});
 const cell=wrong.summary().skills.find(s=>s.id==='ko.reading.vocabulary').levels[1].formats['single-choice'];
 assert.equal(cell.status,'checking');assert.ok(cell.incorrect>0);
 const pulled=plan({progress:empty(),summary:wrong.summary(),settings:{reasons:['travel']}});
 assert.deepEqual(lessonTargets(pulled,'cafe-expressions'),['ko.reading.vocabulary','ko.reading.vocabulary']);
 const right=makeCoach();answerLesson(right,'greetings-expressions');
 assert.deepEqual(lessonTargets(plan({progress:empty(),summary:right.summary(),settings:{reasons:['travel']}}),'cafe-expressions'),[]);
});
