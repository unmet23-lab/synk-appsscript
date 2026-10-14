import {PACKS,LESSONS} from './life-content.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../korean-runner/listening-check.mjs';
import {RHYTHM_CANDIDATES} from '../korean-rhythm/personalization.mjs';

// Product routes and authored content live here. Core owns the ranking; this
// adapter neither assesses a person nor writes a profile, answer or schedule.
const PACK_GOALS={
 greetings:['life','people','expression'],cafe:['life','travel','culture','expression'],
 store:['life','travel','expression'],directions:['life','travel','expression'],
 transit:['travel','study','expression'],plans:['people','study','work','career','expression'],
};
const REASONS=['culture','travel','people','life','study','work','career','exam','hobby','other'];
const BROAD_GOALS=['explore','study','work','clarity','expression','prepare'];
const supports=['choose','step','independent'];
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value||{},key);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const time=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const copy=value=>JSON.parse(JSON.stringify(value));
const knownLessons=new Map(LESSONS.map(lesson=>[lesson.id,lesson]));
const iso=value=>new Date(value).toISOString();
function clock(value){const at=value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):value;if(!time(at))throw TypeError('WORLD learning plan needs a valid time');return at;}

export function worldLearningSettings(settings={}){
 const value=record(settings)?settings:{};
 const reasons=Array.isArray(value.reasons)?[...new Set(value.reasons.filter(reason=>REASONS.includes(reason)))]:[];
 const goals=value.primaryReason&&reasons.includes(value.primaryReason)?[value.primaryReason]:reasons;
 if(BROAD_GOALS.includes(value.goal)&&!goals.includes(value.goal))goals.push(value.goal);
 return {goals, ...(Number.isInteger(value.minutes)&&value.minutes>0&&value.minutes<=240?{minutes:value.minutes}:{}),
  support:supports.includes(value.support)?value.support:value.experience==='new'?'step':'choose',audioAvailable:value.audio!=='off'};
}
function presentationFor(settings){
 const normalized=worldLearningSettings(settings);
 return {support:normalized.support,explanation:['brief','standard','detailed'].includes(settings?.explanation)?settings.explanation:'standard',
  audio:normalized.audioAvailable?'available':'off',textSize:settings?.textSize==='large'?'large':'standard',motion:settings?.motion==='reduced'?'reduced':'full'};
}
const lessonMinutes=lesson=>lesson.id==='cafe-compose'?4:lesson.type==='story'?3:2;
function lessonCandidate(lesson,index,settings){
 const cafe=lesson.id==='cafe-apply'||lesson.id.startsWith('cafe-visit-')||lesson.id==='cafe-compose';
 return {id:`world.life.${String(index+1).padStart(2,'0')}.${lesson.packId}`,label:lesson.title,route:'lesson',lessonId:lesson.id,packId:lesson.packId,
  minutes:lessonMinutes(lesson),minutesEstimated:true,targets:[],goals:[...PACK_GOALS[lesson.packId]],supports:[...supports],audioRequired:false,
  modality:'reading',presentation:presentationFor(settings),...(cafe?{inputMode:settings?.audio==='off'?'read':'choice',canReadWithoutAudio:true}:{})};
}
function verifiedReviews(progress){
 return Object.values(record(progress?.reviews)?progress.reviews:{}).flatMap(review=>{
  const lesson=knownLessons.get(review?.lessonId),question=lesson?.questions.find(q=>q.id===review.questionId&&q.review.id===review.id);
  if(!question||review.packId!==lesson.packId||review.skillId!==question.skillId||!time(review.dueAt)||!time(review.lastAt))return [];
  return [{...review,lesson,question}];
 });
}
function practiceNeed(review,progress,now){
 if(!(review.lapses>0&&review.streak===0))return null;
 const observations=[];
 const answer=progress.lessons?.[review.lessonId]?.answers?.[review.questionId];
 if(answer&&typeof answer.correct==='boolean'&&typeof answer.helped==='boolean')observations.push({at:answer.at,kind:answer.correct?(answer.helped?'assisted':'independent'):'retry'});
 const repeated=progress.activeReview?.answers?.[review.id];
 if(repeated&&typeof repeated.correct==='boolean'&&typeof repeated.helped==='boolean')observations.push({at:repeated.at,kind:repeated.correct?(repeated.helped?'assisted':'independent'):'retry'});
 for(const day of Object.values(progress.daily?.days||{})){
  const item=day?.items?.[review.questionId];
  if(item?.lessonId===review.lessonId&&['retry','assisted','independent'].includes(item.outcome))observations.push({at:item.observedAt,kind:item.outcome});
 }
 const latest=observations.filter(value=>time(value.at)&&value.at<=now).sort((a,b)=>b.at-a.at)[0];
 // An old first error cannot stand in for an unrecorded newer outcome.
 if(!latest||latest.at<review.lastAt||!['retry','assisted'].includes(latest.kind))return null;
 return {kind:latest.kind,at:iso(latest.at),evidenceRefs:[`life.${review.lessonId}.${review.questionId}`]};
}

export function buildWorldLearningCandidates({progress={},settings={},now=Date.now()}={}){
 const at=clock(now),source=record(progress)?progress:{},candidates=[];
 PACKS.forEach((pack,index)=>{
  const next=pack.lessons.find(lesson=>!time(source.lessons?.[lesson.id]?.completedAt));
  if(next)candidates.push(lessonCandidate(knownLessons.get(next.id),index,settings));
 });
 const reviews=verifiedReviews(source).filter(review=>review.dueAt<=at&&review.lastAt<=at);
 const groups=new Map();for(const review of reviews){if(!groups.has(review.lessonId))groups.set(review.lessonId,[]);groups.get(review.lessonId).push(review);}
 for(const [lessonId,rows]of groups){
  rows.sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id));
  const need=rows.map(review=>practiceNeed(review,source,at)).filter(Boolean).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
  candidates.push({id:`world.review.${lessonId}`,label:`${rows[0].lesson.title} · 새 상황 복습`,route:'review',lessonId,packId:rows[0].packId,
   minutes:Math.max(1,Math.ceil(rows.length/3)),minutesEstimated:true,targets:[],goals:[...PACK_GOALS[rows[0].packId]],supports:[...supports],audioRequired:false,modality:'reading',
   reviewIds:rows.map(review=>review.id),reviewAt:iso(rows[0].dueAt),presentation:presentationFor(settings),...(need?{practiceNeed:need}:{})});
 }
 const runnerTargets=LISTENING_CHECKS.map(item=>{const target=checkMetadata(item);return {id:target.id,skillIds:[target.skillId],difficulty:target.difficulty,
  modality:target.modality,responseFormat:target.responseFormat,familyKeys:[target.familyKey],itemKey:target.itemKey,conceptIds:[...target.conceptIds]};});
 candidates.push(
  {id:'world.play.runner',label:'바람길 · 짧은 지시 듣기',route:'game',gameId:'runner',minutes:3,minutesEstimated:true,targets:runnerTargets,
   goals:['exam','prepare','listening','travel'],audioRequired:true,modality:'listening',presentation:presentationFor(settings)},
  {id:'world.play.rhythm',label:'말의 리듬 · 듣고 내용 확인',route:'game',gameId:'rhythm',minutes:4,minutesEstimated:true,targets:copy(RHYTHM_CANDIDATES),
   goals:['exam','prepare','listening','culture','hobby','explore'],audioRequired:true,modality:'listening',presentation:presentationFor(settings)},
  {id:'world.play.hangul',label:'한글 만나기 · 소리와 글자',route:'game',gameId:'hangul',minutes:5,minutesEstimated:true,targets:[],
   goals:['study','culture','hobby','explore'],audioRequired:true,modality:'listening',presentation:presentationFor(settings)},
 );
 return candidates;
}

function resumeCandidates(progress,settings,now){
 const result=[];
 const lesson=knownLessons.get(progress?.activeLessonId),saved=lesson&&progress.lessons?.[lesson.id];
 if(lesson&&saved&&time(saved.startedAt)&&saved.startedAt<=now){
  const index=PACKS.findIndex(pack=>pack.id===lesson.packId);
  result.push({...lessonCandidate(lesson,index,settings),id:`world.resume.lesson.${lesson.id}`,resume:true,label:`${lesson.title} · 이어 하기`});
 }
 const session=progress?.activeReview;
 if(!session||!Array.isArray(session.ids)||!time(session.startedAt)||session.startedAt>now)return result;
 const pending=session.ids.filter(id=>!own(session.answers,id)),reviews=verifiedReviews(progress),first=reviews.find(review=>review.id===pending[0]);
 if(!first)return result;
 // Preserve the existing batch, even when it crosses lesson boundaries.
 result.push({id:'world.resume.review',label:'하던 새 상황 복습 · 이어 하기',route:'review',lessonId:first.lessonId,packId:first.packId,resume:true,
  reviewIds:pending.filter(id=>reviews.some(review=>review.id===id)),minutes:Math.max(1,Math.ceil(pending.length/3)),minutesEstimated:true,
  targets:[],goals:[...PACK_GOALS[first.packId]],supports:[...supports],audioRequired:false,modality:'reading',reviewAt:iso(session.startedAt),presentation:presentationFor(settings)});
 return result;
}

export function createWorldLearningPlan({summary=null,progress={},settings={},now=Date.now(),recommendActivities}={}){
 if(typeof recommendActivities!=='function')throw TypeError('WORLD learning plan needs Core recommendActivities');
 const at=clock(now),source=record(progress)?progress:{},normalized=worldLearningSettings(settings);
 const profile=record(summary)&&Array.isArray(summary.skills)&&typeof summary.evidenceComplete==='boolean'?summary:{skills:[],evidenceComplete:false,asOf:iso(at)};
 const skills=new Set(profile.skills.map(skill=>skill.id));
 const resumes=resumeCandidates(source,settings,at),resumingReview=resumes.some(candidate=>candidate.route==='review');
 const candidates=[...resumes,...buildWorldLearningCandidates({progress:source,settings,now:at}).filter(candidate=>
  !(resumingReview&&candidate.route==='review')&&!resumes.some(resume=>candidate.route==='lesson'&&resume.route==='lesson'&&resume.lessonId===candidate.lessonId))];
 // A partial/empty host summary cannot manufacture missing ability cells. The
 // activities remain available through declared goals, without a skill claim.
 const ready=candidates.map(candidate=>({...candidate,targets:candidate.targets.filter(target=>target.skillIds.every(id=>skills.has(id)))}));
 const ranked=recommendActivities({profile,candidates:ready,settings:normalized,at:iso(at)});
 const excluded=new Set((ranked.excluded||[]).map(item=>item.id));
 const offered=resumes.find(resume=>!excluded.has(resume.id)&&[ranked.selected,...(ranked.alternatives||[])].some(item=>item?.id===resume.id))||null;
 const result=offered?{...ranked,status:'ready',selected:offered,alternatives:[ranked.selected,...(ranked.alternatives||[])].filter(item=>item&&item.id!==offered.id),
  reason:'하던 학습의 같은 자리에서 이어가요. 다른 활동을 골라도 지금 진도는 남아 있어요.',reasons:['progress.resume'],basis:'host-progress',
  id:offered.id,evidence:[],hostEvidence:null,reviewAt:offered.reviewAt||null,reviewSource:offered.reviewAt?'host-schedule':null,
  focusSkillId:null,state:null,matchedGoals:offered.goals.filter(goal=>normalized.goals.includes(goal))}:ranked;
 return {...result,candidates:ready,resume:offered,presentation:presentationFor(settings),settings:normalized,
  learningEffectClaim:false,abilityClaim:false,grade:null};
}
