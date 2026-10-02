// Executable activities. Language evidence remains in Atlas; this manifest owns delivery.
import {RACING_CANDIDATES} from '../korean-racing/personalization.js';
import {rhythmItem} from '../korean-rhythm/personalization.mjs';
import {TRACKS} from '../korean-rhythm/core.mjs';
import {ORDERS,REVIEW} from '../order-rush/core.mjs';
import {orderMetadata} from '../order-rush/learning.mjs';
import {VENUES} from '../entry-check/content.mjs';
import {caseMetadata} from '../entry-check/learning.mjs';
import {EPISODE} from '../story-classroom/story.mjs';
import {missionMetadata} from '../story-classroom/learning.mjs';
import {LISTENING_CHECKS,checkMetadata} from '../korean-runner/listening-check.mjs';
import {READING_CHECKS,readingMetadata} from '../synk-town/understanding.mjs';
const asCandidate=m=>({id:m.id,skillIds:[m.skillId],difficulty:m.difficulty,modality:m.modality,responseFormat:m.responseFormat,familyKey:m.familyKey,itemKey:m.itemKey});
const game=(id,gameId,title,modality,responseFormat,skills,extra={})=>Object.freeze({id,gameId,title,kind:'game',modality,responseFormat,skillIds:skills.map(s=>`ko.${modality}.${s}`),difficulty:1,assignable:true,requiredAttempts:3,minutes:5,href:`/${gameId}/`,questions:[],note:'서로 다른 언어 문항 3개에 답하면 완료됩니다. 도움과 반복은 독립 수행과 구분합니다.',...extra});
export const GAME_CONTENT=Object.freeze([
  game('racing-listening','korean-racing','레이싱 · 듣고 이해하기','listening','single-choice',['word','detail','negation','sequence'],{href:'/korean-racing/?learning=listening'}),
  game('racing-reading','korean-racing','레이싱 · 읽고 이해하기','reading','single-choice',['detail','negation','condition'],{href:'/korean-racing/?learning=reading'}),
  game('rhythm-listening','korean-rhythm','리듬 · 나레이션 이해하기','listening','binary-choice',['detail','negation','reason','condition','main']),
  game('runner-listening','korean-runner','바람길 · 지시 듣기 확인','listening','single-choice',['detail','negation','sequence'],{note:'달리기 점수는 세지 않습니다. 별도 듣기 확인에서 서로 다른 지시 3개에 답해요.'}),
  game('order-listening','order-rush','주문 폭주 · 주문 이해하기','listening','cup-compose',['detail','negation','condition']),
  game('entry-reading','entry-check','입장 검사 · 안내문 판단','reading','single-choice',['detail','negation','condition']),
  game('story-reading','story-classroom','선생님이 돌아왔다 · 읽고 행동하기','reading','action',['detail','negation','sequence']),
  game('town-reading','synk-town','Town · 생활 안내 읽기 확인','reading','single-choice',['detail','negation','sequence'],{href:'/synk-town/linked.html',note:'개발용 생활 체험과 별도 읽기 확인입니다. 꾸미기·이동·호감도는 실력으로 계산하지 않습니다.'}),
]);
export const gameContent=id=>GAME_CONTENT.find(c=>c.id===id);
const authored={
  'korean-racing':RACING_CANDIDATES,
  'korean-rhythm':TRACKS.flatMap(t=>t.questions.flatMap((q,i)=>[0,1].map(variant=>rhythmItem(t.id,{...q,sourceIndex:i,variant})).map(asCandidate))),
  'order-rush':[...ORDERS,...REVIEW].map(orderMetadata).map(asCandidate),
  'entry-check':VENUES.flatMap(v=>v.cases).map(caseMetadata).map(asCandidate),
  'story-classroom':[...EPISODE.acts.flatMap(a=>a.missions),...EPISODE.review].map(missionMetadata).map(asCandidate),
  'korean-runner':LISTENING_CHECKS.map(checkMetadata).map(asCandidate),
  'synk-town':READING_CHECKS.map(readingMetadata).map(asCandidate),
};
// Compare each authored level and response format. A broad game label must not
// pretend that all its questions are beginner questions in the same skill.
export function gameProfiles(content){
  const rows=(authored[content.gameId]||[content]).filter(c=>c.modality===content.modality),groups=new Map();
  for(const r of rows)for(const skill of r.skillIds){const key=`${skill}:${r.difficulty}:${r.responseFormat}`,group=groups.get(key)||{difficulty:r.difficulty,responseFormat:r.responseFormat,skillIds:[skill],familyKeys:[]};group.familyKeys=[...new Set([...group.familyKeys,r.familyKey||r.itemKey])];groups.set(key,group);}
  return [...groups.values()].map((p,i)=>({...content,...p,...(!p.familyKeys.length?{familyKeys:undefined}:{}),id:`${content.id}.level-${i}`,contentId:content.id}));
}
// Exact authored pairs are needed for task completion. A made-up family carrying
// a valid skill label is not a question in this content.
export function gameItems(content){return (authored[content.gameId]||[]).filter(c=>c.modality===content.modality).flatMap(c=>c.skillIds.map(skillId=>({itemKey:c.itemKey,familyKey:c.familyKey||c.itemKey,skillId,difficulty:c.difficulty,modality:c.modality,responseFormat:c.responseFormat})));}
export function supportsMeasure(content,m){return gameProfiles(content).some(p=>p.skillIds.includes(m.skillId)&&p.difficulty===m.difficulty&&p.responseFormat===m.responseFormat&&p.modality===m.modality);}
