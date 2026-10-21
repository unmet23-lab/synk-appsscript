import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PACKS,LESSONS} from '../life-content.mjs';
import {buildWorldLearningCandidates,createWorldLearningPlan,worldLearningSettings} from '../world-learning-plan.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../../korean-runner/listening-check.mjs';
import {RHYTHM_CANDIDATES} from '../../korean-rhythm/personalization.mjs';
const require=createRequire(import.meta.url);
const {createGame,recommendActivities}=require('../../../atlas/game-browser.js');
const NOW=Date.parse('2026-10-13T03:00:00.000Z');
const empty=()=>({version:1,owner:'synthetic',revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{}});
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
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

test('each life pack offers its first unfinished canonical lesson; the only games are the three real WORLD routes',()=>{
 const progress=empty(),first=LESSONS[0];complete(progress,first);
 const candidates=buildWorldLearningCandidates({progress,now:NOW});
 assert.equal(candidates.filter(c=>c.route==='lesson').length,6);
 assert.equal(candidates.find(c=>c.packId===first.packId).lessonId,PACKS[0].lessons[1].id);
 assert.deepEqual(candidates.filter(c=>c.route==='game').map(c=>c.gameId),['runner','rhythm','hangul']);
 assert.ok(candidates.filter(c=>c.route==='lesson').every(c=>!c.targets.length));
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
