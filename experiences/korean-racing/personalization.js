import { CAMPAIGN } from './campaign.js';
import { FINALES } from './finales.js';

// Authored practice tags, not official TOPIK grade assignments.
const SKILLS = [
  ['detail','detail','detail','detail','detail'],
  ['detail','detail','detail','detail','detail'],
  ['grammar','grammar','grammar','grammar','grammar'],
  ['reason','main','vocabulary','sequence','reason'],
  ['detail','detail','detail','detail','detail'],
  ['detail','detail','negation','detail','detail'],
  ['detail','negation','main','detail','detail'],
  ['main','main','negation','detail','main'],
  ['detail','detail','detail','detail','negation'],
  ['detail','detail','detail','detail','detail'],
  ['reason','negation','negation','sequence','negation'],
  ['condition','detail','condition','condition','detail']
];
const indexed = new Map(CAMPAIGN.flatMap((stage,i)=>stage.items.map((item,j)=>[
  item.id,{stage,item,skillId:`ko.${item.mode==='reading'?'reading':'listening'}.${SKILLS[i][j]}`}
])));

// Finale questions retain their real input modality. They are assessable when
// independently answered, but never recycled into personalized practice before
// a learner reaches the chapter finale's new situations.
const FINALE_SKILLS = [
  ['detail','detail','detail','detail','detail'],
  ['grammar','grammar','reason','grammar','detail'],
  ['detail','detail','detail','detail','detail'],
  ['detail','detail','main','detail','negation'],
  ['condition','detail','negation','detail','detail'],
  ['reason','condition','negation','condition','sequence']
];
FINALES.forEach((stage,i)=>stage.items.forEach((item,j)=>indexed.set(item.id,{
  stage,item,skillId:`ko.${item.mode==='reading'?'reading':'listening'}.${FINALE_SKILLS[i][j]}`
})));

// The grammar point a question turns on (strata/topik-i.grammar.json; a draft before teacher
// review, like that layer). Only questions whose right answer depends on that one form are
// linked: the particle in a blank, or the form the right choice rests on. Comprehension
// questions stay unlinked, so a missed word is never read as a missed form.
const GRAMMAR = {
  c03q1: ['G207'], c03q2: ['G206'], c03q3: ['G310'], c03q4: ['G206'], c03q5: ['G207'],
  f02q1: ['G207'], f02q2: ['G210'],
  c09q5: ['G402'], f05q3: ['G402'], c11q3: ['G405'], f06q3: ['G405'], c11q5: ['G305'], c11q2: ['G307'],
};

export function racingItem(item){
  const found=indexed.get(item.id),reading=item.mode==='reading';
  const itemKey=`korean-racing:${item.id||item.answer}:v1`;
  return {id:item.id||item.answer,itemKey,familyKey:itemKey,
    skillId:found?.skillId||'ko.listening.word',difficulty:found?Math.min(3,Math.ceil(found.stage.chapter/2)):1,
    modality:reading?'reading':'listening',responseFormat:'single-choice',audioRequired:!reading,confounded:false,
    conceptIds:found?[...(GRAMMAR[item.id]||[])]:/^w\d{4}$/.test(item.answer||'')?[`ko.word.${item.answer}`]:[]};
}

export const RACING_CANDIDATES = CAMPAIGN.flatMap(stage=>stage.items.map(item=>{
  const meta=racingItem(item);
  return {id:item.id,itemKey:meta.itemKey,skillIds:[meta.skillId],difficulty:meta.difficulty,
    modality:meta.modality,responseFormat:meta.responseFormat,conceptIds:meta.conceptIds,label:`${stage.title} · ${item.prompt}`,item};
}));

// 순간 맞춤(docs/아틀라스_순간맞춤_20261002.md §5, 2026-10-03). Two things follow the person: the item level the
// personalized five draw from (a course the person picks keeps its own sentences), and the speed the car
// cruises at. The number of choices and the road between gates stay as authored: the gates, their lane
// narration and the course length are built for three lanes and this spacing.
export const FLOW_RACE={id:'korean-racing.race',version:1,target:0.8,items:{levels:[1,2,3],weight:2},
  knobs:[{id:'cruise',kind:'pace',label:'달리는 속도',values:[20,23,26,29,32],start:2}]};
export const BASE_CRUISE=26;
// The road from where a question is announced (220 before the gate) to the line where a sentence course
// stops the car and waits for a choice (65).
export const APPROACH=155;
export const FLOW_WORDS={'raise.pace':'차가 조금 빨라져요.','ease.pace':'차가 조금 느긋하게 달려요.',
  // A changed item level shows in the next personalized five, so the results screen tells it.
  'raise.content':'','ease.content':'',
  'start.memory':'','start.prior':'','start.returning':'오랜만이라 조금 느긋하게 달려요.','start.tired':'오늘은 차가 더 빨라지지 않아요.'};
/** The share of the decision time used, from when the question was fully heard (or shown) to the lane
 * chosen. A sentence course stops the car at the line and waits, so the share is of the designed approach
 * at this speed; a word course does not wait, so it is of the road that was left. Kept under 1: a chosen
 * answer is never late in a race, so a wrong one stays a miss about the question (flow.js reads a miss at
 * the limit as a rush). null when a moment is unknown (the voice never finished, nothing was chosen). */
export function racePressure({readyAt,choseAt,cruise,campaign,roadLeft=null}){
  if(!Number.isFinite(readyAt)||!Number.isFinite(choseAt)||!(cruise>0))return null;
  const allowed=campaign?APPROACH/cruise:Math.max(1,(Number.isFinite(roadLeft)?roadLeft:APPROACH)/cruise);
  return Math.min(.95,Math.max(0,choseAt-readyAt)/allowed);
}
/** What this race changed, in the race's words (results screen). Only the settings, never a judgement. */
export function describeRace(start,end){
  const lines=[];
  if(start?.cruise!=null&&end?.cruise!=null&&start.cruise!==end.cruise)lines.push(`달리는 속도 ${Math.round(start.cruise*3.6)} → ${Math.round(end.cruise*3.6)}km/h`);
  const a=start?.['item.difficulty'],b=end?.['item.difficulty'];
  // Only the direction: the five are drawn from what Core leads with, so a level may not be there (no level-2 reading).
  if(a!=null&&b!=null&&a!==b)lines.push(b>a?'다음 맞춤 5문항은 조금 더 어려운 문장도 골라요':'다음 맞춤 5문항은 조금 더 쉬운 문장부터 골라요');
  return lines;
}

export function assignmentCandidates(target){
  if(!target)return RACING_CANDIDATES;
  return RACING_CANDIDATES.filter(c=>c.skillIds.includes(target.skillId)&&c.difficulty===target.difficulty&&c.modality===target.modality&&c.responseFormat===target.responseFormat&&target.familyKeys?.includes(c.itemKey)&&(!target.itemKeys?.length||target.itemKeys.includes(c.itemKey)));
}
export function racingTargetLabel(target){const labels={detail:'세부 내용',negation:'부정 표현',condition:'조건 표현',reason:'이유',main:'중심 내용',sequence:'순서',grammar:'문법',vocabulary:'어휘'};return `${target.modality==='reading'?'읽기':'듣기'} · ${labels[target.skillId.split('.').at(-1)]||'지정 표현'} · 난도 ${target.difficulty}`;}
// `live` (coach.live(FLOW_RACE)) draws free practice at the item level the races reached, among Core's
// leading choices (game-flow.js pick). A teacher's target sets its own level, so it keeps Core's choice.
export function personalizedStage(coach,{audioAvailable=true,modality=null,live=null}={}){
  const target=coach.assignment?.();
  const pool=assignmentCandidates(target);
  const candidates=modality?pool.filter(c=>c.modality===modality):pool;
  const pick=!target&&live?(list,options)=>live.pick(list,options):(list,options)=>coach.recommend(list,options);
  const chosen=[],excluded=[];let reason='';
  for(let i=0;i<Math.min(5,candidates.length);i++){
    const recommendation=pick(candidates,{audioAvailable,excludeIds:excluded});
    if(recommendation.status!=='ready'||!recommendation.selected)break;
    if(!reason)reason=recommendation.reason;
    chosen.push(recommendation.selected.item);excluded.push(recommendation.selected.id);
  }
  if(!chosen.length)return null;
  return {reason:target?`이번 목표: ${racingTargetLabel(target)}. 지정된 ${target.requiredAttempts}문항에 응답해요.`:reason,stage:{id:'personalized',title:target?`이번 목표 · ${chosen.length}문항`:'나에게 맞는 5문항',campaign:true,review:true,personalized:true,
    chapter:1,level:target?.difficulty||1,scene:'bloom',mode:'mixed',skill:target?racingTargetLabel(target):'기록에 맞춘 듣기·읽기',words:[],items:chosen}};
}
