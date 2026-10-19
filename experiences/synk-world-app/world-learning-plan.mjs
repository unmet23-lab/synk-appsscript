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
// The Strata situations each pack is about (strata/maps/topik-i.json). Game items carry their own
// concept ids; a practised topic the person answered about on 「내 성향」 matches either.
const PACK_SITUATIONS={greetings:['sit-people-greeting'],cafe:['sit-travel-order'],store:['sit-travel-shopping'],
 directions:['sit-travel-directions'],transit:['sit-travel-transport'],plans:['sit-career-schedule','sit-people-messenger']};
const conceptId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(value);
const ANSWER_DAYS=30;

// 「내 성향」 answers about practised topics (member-understanding learning-topic facets), read only.
// 「더 배우고 싶어요」 is an interest; 「지금은 아니에요」 asks WORLD not to push that topic now. An
// earlier "맞아요" counts as interest while it is recent. Notes, statements and other facets are ignored.
export function worldTopicAnswers(state,{now=Date.now()}={}){
 const interested=new Set(),notNow=new Set(),answered=new Set();
 if(!record(state)||!Array.isArray(state.overrides)||!Array.isArray(state.reviews))return {interested:[],notNow:[]};
 const at=clock(now);
 for(const row of state.overrides){
  const id=typeof row?.facetId==='string'&&row.facetId.startsWith('learning-topic:')?row.facetId.slice(15):null;
  if(!conceptId(id)||!Array.isArray(row.values))continue;answered.add(id);
  if(row.values[0]==='interested')interested.add(id);else if(row.values[0]==='not-now')notNow.add(id);
 }
 for(const row of state.reviews){
  const id=typeof row?.facetId==='string'&&row.facetId.startsWith('learning-topic:')?row.facetId.slice(15):null;
  const when=Date.parse(row?.at);
  if(!conceptId(id)||answered.has(id)||row.verdict!=='agree'||!Number.isFinite(when)||when>at||at-when>ANSWER_DAYS*86400000)continue;
  interested.add(id);
 }
 return {interested:[...interested].slice(0,50),notNow:[...notNow].slice(0,50)};
}
function answersOf(value){
 const pick=list=>Array.isArray(list)?[...new Set(list.filter(conceptId))].slice(0,50):[];
 const interested=pick(value?.interested),notNow=pick(value?.notNow).filter(id=>!interested.includes(id));
 return {interested,notNow};
}
// An interest is a declared goal Core already ranks by: it orders equally urgent activities and
// never moves one past a more urgent need. "Not now" stops that topic from pushing an activity
// forward, its own missed items included, because the person put that topic off: a lesson of that
// situation loses its goals, a game loses the items of that topic, and everything stays available
// to choose. Other topics' needs and a review that is due (an activity's own schedule) stay as they are.
function withAnswers(candidate,answers){
 if(!answers.interested.length&&!answers.notNow.length)return candidate;
 const situations=PACK_SITUATIONS[candidate.packId]||[];
 const items=new Set(candidate.targets.flatMap(target=>Array.isArray(target.conceptIds)?target.conceptIds:[]));
 const wanted=answers.interested.filter(id=>situations.includes(id)||items.has(id));
 const later=candidate.route==='lesson'&&situations.some(id=>answers.notNow.includes(id));
 const targets=candidate.targets.filter(target=>!(target.conceptIds||[]).some(id=>answers.notNow.includes(id)));
 return {...candidate,targets,goals:later?[]:[...new Set([...candidate.goals,...wanted.map(id=>`interest.${id}`)])]};
}

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

// openGames: 지금 열 수 있는 게임 ID 목록(null이면 전부). 공개판(계정 모드) 손님은 10-19 결정으로 한글 만나기만 열고
// 바람길·리듬은 로그인부터 연다. 열 수 없는 게임은 「지금 열 수 없음」으로 넘겨 Core가 빼게 하고(activity.unavailable)
// 다음 후보를 고르게 한다 — 손님이 같은 로그인 창을 맴돌지 않게.
export function buildWorldLearningCandidates({progress={},settings={},now=Date.now(),openGames=null}={}){
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
 const access=id=>!Array.isArray(openGames)||openGames.includes(id)?{}:{available:false,accountRequired:true};
 candidates.push(
  {id:'world.play.runner',label:'바람길 · 짧은 지시 듣기',route:'game',gameId:'runner',minutes:3,minutesEstimated:true,targets:runnerTargets,
   goals:['exam','prepare','listening','travel'],audioRequired:true,modality:'listening',presentation:presentationFor(settings),...access('runner')},
  {id:'world.play.rhythm',label:'말의 리듬 · 듣고 내용 확인',route:'game',gameId:'rhythm',minutes:4,minutesEstimated:true,targets:copy(RHYTHM_CANDIDATES),
   goals:['exam','prepare','listening','culture','hobby','explore'],audioRequired:true,modality:'listening',presentation:presentationFor(settings),...access('rhythm')},
  {id:'world.play.hangul',label:'한글 만나기 · 소리와 글자',route:'game',gameId:'hangul',minutes:5,minutesEstimated:true,targets:[],
   goals:['study','culture','hobby','explore'],audioRequired:true,modality:'listening',presentation:presentationFor(settings),...access('hangul')},
 );
 return candidates;
}

function resumeCandidates(progress,settings,now){
 const result=[];
 const lesson=knownLessons.get(progress?.activeLessonId),saved=lesson&&progress.lessons?.[lesson.id];
 // A lesson only opened (no answered question) is not 「하던 자리」: it must not jump ahead of a returned review.
 const answered=record(saved?.answers)&&Object.keys(saved.answers).length>0;
 if(lesson&&saved&&answered&&time(saved.startedAt)&&saved.startedAt<=now){
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

// `answers` ({interested, notNow}: worldTopicAnswers) are the person's own answers on 「내 성향」.
export function createWorldLearningPlan({summary=null,progress={},settings={},now=Date.now(),recommendActivities,answers=null,openGames=null}={}){
 if(typeof recommendActivities!=='function')throw TypeError('WORLD learning plan needs Core recommendActivities');
 const at=clock(now),source=record(progress)?progress:{},normalized=worldLearningSettings(settings),told=answersOf(answers);
 const profile=record(summary)&&Array.isArray(summary.skills)&&typeof summary.evidenceComplete==='boolean'?summary:{skills:[],evidenceComplete:false,asOf:iso(at)};
 const skills=new Set(profile.skills.map(skill=>skill.id));
 const resumes=resumeCandidates(source,settings,at),resumingReview=resumes.some(candidate=>candidate.route==='review');
 const candidates=[...resumes,...buildWorldLearningCandidates({progress:source,settings,now:at,openGames}).filter(candidate=>
  !(resumingReview&&candidate.route==='review')&&!resumes.some(resume=>candidate.route==='lesson'&&resume.route==='lesson'&&resume.lessonId===candidate.lessonId))];
 // A partial/empty host summary cannot manufacture missing ability cells. The
 // activities remain available through declared goals, without a skill claim.
 const ready=candidates.map(candidate=>withAnswers({...candidate,targets:candidate.targets.filter(target=>target.skillIds.every(id=>skills.has(id)))},told));
 const ranking=told.interested.length?{...normalized,goals:[...new Set([...normalized.goals,...told.interested.map(id=>`interest.${id}`)])]}:normalized;
 const chosen=recommendActivities({profile,candidates:ready,settings:ranking,at:iso(at)});
 // When an interest the person gave is what put this activity first, say so in their words.
 const interest=(chosen.matchedGoals||[]).find(goal=>goal.startsWith('interest.'));
 const pushed=interest&&!(chosen.reasons||[]).some(reason=>['review.due','activity.retry','activity.assisted'].includes(reason)||reason.startsWith('practice.'));
 const label=interest?(profile.concepts||[]).find(concept=>concept?.id===interest.slice(9))?.label:null;
 const ranked=pushed?{...chosen,reason:typeof label==='string'&&label.trim()?`더 배우고 싶다고 알려 준 ‘${label}’ 연습이에요.`:'더 배우고 싶다고 알려 준 내용이 들어 있는 연습이에요.',
  reasons:[...chosen.reasons,'interest.declared']}:chosen;
 const excluded=new Set((ranked.excluded||[]).map(item=>item.id));
 const listed=[ranked.selected,...(ranked.alternatives||[])].filter(Boolean);
 const offered=resumes.find(resume=>!excluded.has(resume.id)&&listed.some(item=>item.id===resume.id))||null;
 // 한글부터(첫 실행에 「아직 못 읽어요」를 고른 사람, 10-19): 생활 레슨과 듣기 게임은 한글을 읽는다고 보고 짜여 있어
 // WORLD가 한글 만나기를 선행 단계로 Core 순위보다 먼저 둔다. 한글 만나기를 마치거나 건너뛰면 답이 reads로 바뀌어 끝난다.
 // 사람이 시작한 하던 학습은 그보다 먼저이고, 한글 만나기를 지금 열 수 없으면(손님·소리 꺼짐) Core 순위를 그대로 쓴다.
 const prerequisite=!offered&&source.hangul?.answer==='new'?listed.find(item=>item.route==='game'&&item.gameId==='hangul')||null:null;
 const lead=offered||prerequisite;
 const result=lead?{...ranked,status:'ready',selected:lead,alternatives:listed.filter(item=>item.id!==lead.id),
  ...(offered?{reason:'하던 학습의 같은 자리에서 이어가요. 다른 활동을 골라도 지금 진도는 남아 있어요.',reasons:['progress.resume'],basis:'host-progress'}
   :{reason:'한글부터 만나요. 소리를 듣고 글자를 고르며 읽는 법을 익혀요.',reasons:['progress.prerequisite'],basis:'host-prerequisite'}),
  id:lead.id,evidence:[],hostEvidence:null,reviewAt:lead.reviewAt||null,reviewSource:lead.reviewAt?'host-schedule':null,
  focusSkillId:null,state:null,matchedGoals:lead.goals.filter(goal=>normalized.goals.includes(goal))}:ranked;
 return {...result,candidates:ready,resume:offered,prerequisite,presentation:presentationFor(settings),settings:normalized,answers:told,
  learningEffectClaim:false,abilityClaim:false,grade:null};
}
