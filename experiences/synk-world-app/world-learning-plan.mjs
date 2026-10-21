import {PACKS,LESSONS} from './life-content.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../korean-runner/listening-check.mjs';
import {RHYTHM_CANDIDATES} from '../korean-rhythm/personalization.mjs';
import {planTokens} from './world-exam-plan.mjs';

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

// 배우는 이유가 가리키는 넓은 목표(atlas/personalization.js REASON_GOAL과 같다 — 시험이 대조한다). 「시험·자격 준비」(exam)와
// 넓은 목표 prepare는 한 목표의 두 표현이라, 둘을 함께 넘기면 둘 다 단 후보(바람길·리듬·읽기 짧은 연습)가 목표를 두 개 맞춘 것으로
// 세어 순위가 두 번 오른다(10-20 검수 3차 「이중 가산」). 이유로 이미 정해진 넓은 목표는 다시 더하지 않는다.
export const REASON_BROAD_GOAL=Object.freeze({culture:'explore',travel:'expression',people:'expression',life:'expression',study:'study',work:'work',career:'work',exam:'prepare',hobby:'explore',other:null});
// planGoals: 시험 계획(world-exam-plan.mjs)이 이번 주 초점으로 넘기는 토큰(plan.*). Core가 같은 급한 정도 안에서만 순서를 바꾼다.
export function worldLearningSettings(settings={},{planGoals=[]}={}){
 const value=record(settings)?settings:{};
 const reasons=Array.isArray(value.reasons)?[...new Set(value.reasons.filter(reason=>REASONS.includes(reason)))]:[];
 const goals=value.primaryReason&&reasons.includes(value.primaryReason)?[value.primaryReason]:reasons;
 const implied=new Set(goals.map(reason=>REASON_BROAD_GOAL[reason]).filter(Boolean));
 if(BROAD_GOALS.includes(value.goal)&&!goals.includes(value.goal)&&!implied.has(value.goal))goals.push(value.goal);
 for(const token of Array.isArray(planGoals)?planGoals:[])if(typeof token==='string'&&/^plan\.[a-z]+\.[a-zA-Z0-9_.-]{1,80}$/.test(token)&&!goals.includes(token))goals.push(token);
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
 // A lesson only opened (no answered question, still at its intro) is not 「하던 자리」: it must not jump ahead of a returned review.
 // A lesson read into its story or questions is (life-progress stage starts at {phase:'intro',sceneIndex:0,questionIndex:0}).
 const answered=record(saved?.answers)&&Object.keys(saved.answers).length>0;
 const stage=record(saved?.stage)?saved.stage:null;
 const moved=!!stage&&(stage.phase==='story'||stage.phase==='questions'||stage.sceneIndex>0||stage.questionIndex>0);
 if(lesson&&saved&&(answered||moved)&&time(saved.startedAt)&&saved.startedAt<=now){
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

// 「이번 주 계획」·「내 위치」가 여는 후보: 짧은 연습(route 'practice', world-reading-practice.mjs가 만든다 — 읽기·듣기)과 시험 형식 연습(route 'mock')과
// 짧은 진단(route 'position', 학습 항목을 겨누지 않는 넓은 확인 — 급한 연습을 앞지르지 않게 targets를 비운다).
// 호출하는 쪽(world-learning-ui.mjs)이 그 사람의 노출 기록으로 새 문항이 남은 것만 넘긴다.
function extraCandidate(candidate,settings){
 if(!record(candidate)||!['practice','position','writing','mock'].includes(candidate.route)||typeof candidate.id!=='string')return null;
 return {...candidate,targets:Array.isArray(candidate.targets)?candidate.targets:[],goals:Array.isArray(candidate.goals)?[...candidate.goals]:[],
  supports:Array.isArray(candidate.supports)?[...candidate.supports]:[...supports],presentation:presentationFor(settings)};
}
// WORLD가 직접 쓰는 이유(10-20 검수 #17): 학습 항목을 겨누지 않는 후보(생활 레슨·복습)가 뽑히면 Core·Vellum은 「아직 연습 기록이 적어요」라고
// 말한다(practice.unseen — 그 후보가 볼 항목이 없다는 뜻). 기록이 쌓인 사람에게 그 말은 틀리므로 그 후보를 고른 까닭을 말한다.
// 짧은 진단은 이번 주 계획의 다시 확인이라 그 까닭을 쓴다. 다른 이유(복습 시기·놓친 항목·목표)는 Vellum 문장 그대로다.
// 짧은 진단 후보(이번 주 계획의 시작점·다시 확인): 학습 항목을 겨누지 않는 넓은 확인이라 targets를 비운다(급한 연습을 앞지르지 않게).
export function positionCheckCandidate(){
 return {id:'world.position.check',label:'짧은 진단',route:'position',minutes:5,minutesEstimated:true,targets:[],goals:['exam','prepare'],audioRequired:false,modality:'reading'};
}
// labels: 항목 id → 한국어 이름(Strata). 시험 계획의 숙제 항목을 고른 까닭을 그 항목 이름으로 말할 때 쓴다.
function hostReason(chosen,{history,plan,labels}){
 const selected=chosen.selected;
 if(!selected)return null;
 // 이번 주 계획의 숙제(다시 볼 항목)를 Core가 같은 급한 정도 안에서 앞세웠는데, 고른 새 문항의 칸이 아직 기록 없는 칸이라
 // Vellum 문장이 목표 한 줄뿐일 때: 그 숙제 항목과 까닭(놓친 답·다시 볼 때)을 말한다. 기록에 있는 사실만 말한다.
 const generic=!(chosen.reasons||[]).some(reason=>reason.startsWith('practice.')&&reason!=='practice.unseen'||['review.due','activity.retry','activity.assisted'].includes(reason));
 if(plan&&generic&&['practice','game'].includes(selected.route)){
  // 읽기 짧은 연습은 그 항목, 게임은 Core가 그 게임에서 먼저 낼 문항의 항목(focusSkillId)일 때만 — 이유가 실제 첫 문항과 같은 항목을 말하게.
  const skillId=selected.route==='practice'?selected.skillId:chosen.focusSkillId;
  const homework=(plan.homework||[]).find(row=>!row.shortage&&row.skillId===skillId);
  const label=homework&&labels?.[homework.skillId];
  if(label)return {reason:homework.status==='review'?`이번 주 숙제예요. ${label} 기록이 오래돼 새 문항으로 다시 확인해요.`:`이번 주 숙제예요. ${label}에서 놓친 답이 있어 새 문항으로 다시 확인해요.`,reasons:['plan.homework'],focusSkillId:homework.skillId};
 }
 // 시험 형식 연습: 실제 구성을 줄인 판을 시간 안에 처음 보는 문항으로(급수는 매기지 않는다).
 if(selected.route==='mock')return {reason:'시험처럼 처음 보는 문항을 정해진 시간 안에 풀어 봐요. 점수나 급수로 바꾸지 않아요.',reasons:['exam.form']};
 if(selected.route==='position')return {reason:plan?.notes?.includes('start')?'시험 목표에 맞춰 짧은 진단으로 시작점을 먼저 확인해요.':'이번 주 계획의 다시 확인이에요. 처음 보는 문항으로 지금 위치를 확인해요.',reasons:['plan.recheck']};
 const unseen=(chosen.reasons||[]).includes('practice.unseen')&&!(chosen.reasons||[]).includes('goal.declared');
 if(!unseen||!history||(selected.targets||[]).length)return null;
 if(selected.route==='lesson')return {reason:'생활 팩의 다음 레슨이에요. 진도 순서대로 이어서 배워요.',reasons:['progress.next']};
 return null;
}
// `answers` ({interested, notNow}: worldTopicAnswers) are the person's own answers on 「내 성향」.
// extra: 읽기 짧은 연습·짧은 진단 후보(extraCandidate). examPlan: 시험 계획(world-exam-plan.mjs buildExamPlan) — 있으면 후보마다 계획 토큰(planTokens)을
// 붙이고 그 주 초점 토큰을 목표로 넘긴다. 순위는 그대로 Core가 정한다.
export function createWorldLearningPlan({summary=null,progress={},settings={},now=Date.now(),recommendActivities,answers=null,openGames=null,extra=[],examPlan=null}={}){
 if(typeof recommendActivities!=='function')throw TypeError('WORLD learning plan needs Core recommendActivities');
 const at=clock(now),source=record(progress)?progress:{},planned=record(examPlan)&&Array.isArray(examPlan.goals)?examPlan:null;
 const normalized=worldLearningSettings(settings,{planGoals:planned?.goals||[]}),told=answersOf(answers);
 const profile=record(summary)&&Array.isArray(summary.skills)&&typeof summary.evidenceComplete==='boolean'?summary:{skills:[],evidenceComplete:false,asOf:iso(at)};
 const skills=new Set(profile.skills.map(skill=>skill.id));
 const resumes=resumeCandidates(source,settings,at),resumingReview=resumes.some(candidate=>candidate.route==='review');
 const added=(Array.isArray(extra)?extra:[]).map(candidate=>extraCandidate(candidate,settings)).filter(Boolean);
 const candidates=[...resumes,...buildWorldLearningCandidates({progress:source,settings,now:at,openGames}).filter(candidate=>
  !(resumingReview&&candidate.route==='review')&&!resumes.some(resume=>candidate.route==='lesson'&&resume.route==='lesson'&&resume.lessonId===candidate.lessonId)),...added];
 // A partial/empty host summary cannot manufacture missing ability cells. The
 // activities remain available through declared goals, without a skill claim.
 const ready=candidates.map(candidate=>{
  const targets=candidate.targets.filter(target=>target.skillIds.every(id=>skills.has(id)));
  const goals=planned?[...new Set([...(candidate.goals||[]),...planTokens({...candidate,targets})])]:candidate.goals;
  return withAnswers({...candidate,targets,goals},told);
 });
 const ranking=told.interested.length?{...normalized,goals:[...new Set([...normalized.goals,...told.interested.map(id=>`interest.${id}`)])]}:normalized;
 const chosen=recommendActivities({profile,candidates:ready,settings:ranking,at:iso(at)});
 // When an interest the person gave is what put this activity first, say so in their words.
 const interest=(chosen.matchedGoals||[]).find(goal=>goal.startsWith('interest.'));
 const pushed=interest&&!(chosen.reasons||[]).some(reason=>['review.due','activity.retry','activity.assisted'].includes(reason)||reason.startsWith('practice.'));
 const label=interest?(profile.concepts||[]).find(concept=>concept?.id===interest.slice(9))?.label:null;
 // 기록이 있는 사람: 혼자 낸 첫 답이 하나라도 있거나 마친 생활 레슨이 있다.
 const history=(Number.isFinite(profile.independent)&&profile.independent>0)||Object.values(record(source.lessons)?source.lessons:{}).some(lesson=>time(lesson?.completedAt));
 const labels=Object.fromEntries(profile.skills.filter(skill=>typeof skill?.label==='string').map(skill=>[skill.id,skill.label]));
 const own=pushed?null:hostReason(chosen,{history,plan:planned,labels});
 const ranked=pushed?{...chosen,reason:typeof label==='string'&&label.trim()?`더 배우고 싶다고 알려 준 ‘${label}’ 연습이에요.`:'더 배우고 싶다고 알려 준 내용이 들어 있는 연습이에요.',
  reasons:[...chosen.reasons,'interest.declared']}:own?{...chosen,reason:own.reason,reasons:[...chosen.reasons,...own.reasons],...(own.focusSkillId?{planSkillId:own.focusSkillId}:{})}:chosen;
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
 return {...result,candidates:ready,resume:offered,prerequisite,presentation:presentationFor(settings),settings:normalized,answers:told,examPlan:planned,
  learningEffectClaim:false,abilityClaim:false,grade:null};
}
