import {TRACKS} from './core.mjs?v=20261001-listen';
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
