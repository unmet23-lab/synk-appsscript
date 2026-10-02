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

export function assignmentCandidates(target){
  if(!target)return RACING_CANDIDATES;
  return RACING_CANDIDATES.filter(c=>c.skillIds.includes(target.skillId)&&c.difficulty===target.difficulty&&c.modality===target.modality&&c.responseFormat===target.responseFormat&&target.familyKeys?.includes(c.itemKey)&&(!target.itemKeys?.length||target.itemKeys.includes(c.itemKey)));
}
export function racingTargetLabel(target){const labels={detail:'세부 내용',negation:'부정 표현',condition:'조건 표현',reason:'이유',main:'중심 내용',sequence:'순서',grammar:'문법',vocabulary:'어휘'};return `${target.modality==='reading'?'읽기':'듣기'} · ${labels[target.skillId.split('.').at(-1)]||'지정 표현'} · 난도 ${target.difficulty}`;}
export function personalizedStage(coach,{audioAvailable=true,modality=null}={}){
  const target=coach.assignment?.();
  const pool=assignmentCandidates(target);
  const candidates=modality?pool.filter(c=>c.modality===modality):pool;
  const chosen=[],excluded=[];let reason='';
  for(let i=0;i<Math.min(5,candidates.length);i++){
    const recommendation=coach.recommend(candidates,{audioAvailable,excludeIds:excluded});
    if(recommendation.status!=='ready'||!recommendation.selected)break;
    if(!reason)reason=recommendation.reason;
    chosen.push(recommendation.selected.item);excluded.push(recommendation.selected.id);
  }
  if(!chosen.length)return null;
  return {reason:target?`이번 목표: ${racingTargetLabel(target)}. 지정된 ${target.requiredAttempts}문항에 응답해요.`:reason,stage:{id:'personalized',title:target?`이번 목표 · ${chosen.length}문항`:'나에게 맞는 5문항',campaign:true,review:true,personalized:true,
    chapter:1,level:target?.difficulty||1,scene:'bloom',mode:'mixed',skill:target?racingTargetLabel(target):'기록에 맞춘 듣기·읽기',words:[],items:chosen}};
}
