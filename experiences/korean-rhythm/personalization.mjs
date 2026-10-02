import {TRACKS} from './core.mjs?v=20261002-flow';
const SKILLS=[['detail','detail','negation','negation','detail'],['reason','negation','reason','detail','reason'],['condition','detail','main','detail','main']];
export function rhythmItem(trackId,question,{recall=false}={}){
  const sourceIndex=question.sourceIndex??Number(question.id.match(/q(\d+)/)?.[1]||0);
  // A recall only swaps a number or a time and follows the answer and explanation at once,
  // so it shares the original's family: practice, never a new independent first try.
  const familyKey=`korean-rhythm:t${trackId}q${sourceIndex}:v1`;
  return {id:`t${trackId}q${sourceIndex}${recall?'r':`v${question.variant??0}`}`,
    itemKey:recall?`${familyKey}:recall`:`${familyKey}:claim${question.variant??0}`,familyKey,
    skillId:`ko.listening.${SKILLS[trackId][sourceIndex]}`,difficulty:trackId+1,
    modality:'listening',responseFormat:'binary-choice',audioRequired:true,confounded:false};
}
// A song names its question families, so a song already played through goes behind
// songs that can still give a first try (its recall questions share these families).
export const RHYTHM_CANDIDATES=TRACKS.map(track=>({id:`track-${track.id}`,trackId:track.id,
  label:track.title,skillIds:[...new Set(SKILLS[track.id].map(s=>`ko.listening.${s}`))],
  difficulty:track.id+1,modality:'listening',responseFormat:'binary-choice',
  familyKeys:track.questions.map((_,i)=>`korean-rhythm:t${track.id}q${i}:v1`)}));

/* Atlas moment-level challenge for the beat (Core flow.js). Only the timing windows move, within the
 * level the person chose; notes, songs and the O/X listening answers never change. 1 is the level's own
 * window; larger is more forgiving. Rhythm results are not evidence of Korean ability. */
export const FLOW_RHYTHM={id:'korean-rhythm.timing',version:1,target:0.8,knobs:[
 {id:'window',kind:'pace',label:'판정 폭',values:[1.35,1.22,1.1,1,0.92,0.85],start:3}]};
// A beat event as a challenge observation. Perfect timing is comfortable; an edge hit is tight.
// Letting go of a held note early (or holding through a pause) is not about the window, so it says nothing.
export function timingObservation(event){
 if(!event||!['tap','hold-start','miss'].includes(event.type))return null;
 if(event.type==='miss')return {outcome:'timeout'};
 return {outcome:'success',pressure:event.quality>=1?.3:event.quality>=.8?.6:.9};
}
export function timingSummary(start,end){
 if(start==null||end==null||start===end)return '이번 곡은 판정 폭을 바꾸지 않았어요.';
 return end>start?'이번 곡은 판정 폭을 조금 넓혀서 맞췄어요. 다음 곡도 이어서 맞춰요.':'이번 곡은 판정 폭을 조금 좁혀서 맞췄어요. 다음 곡도 이어서 맞춰요.';
}
