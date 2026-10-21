import {TRACKS} from './core.mjs';
import {josa} from './kit/josa.mjs';
// 대표 능력과 언어 난도는 문항마다(곡 번호가 아니라). 10-21 문항 검수 판정: 바뀐 시간을 듣는 t0q4는 부정·변경, 값을 듣는 t1q1과
// 한 문장을 바꿔 말한 t2q2·t2q4는 세부. 난도는 작성 기준 §3대로 — 한 문장·1급 문형인 t1q1·t1q3과, 두 문장·정보 둘을 1단계 「그래서」로
// 잇는 t1q0(같은 날 재검수)은 1, 2단계 문형(-(으)려고·-(으)니까)으로 까닭을 듣는 t1q2·t1q4와 셋째 곡은 모두 2(3은 쓰지 않는 칸).
const SKILLS=[['detail','detail','negation','negation','negation'],['reason','detail','reason','detail','reason'],['condition','detail','detail','detail','detail']];
export const DIFFICULTY=Object.freeze([[1,1,1,1,1],[1,1,2,1,2],[2,2,2,2,2]].map(row=>Object.freeze(row)));
// The TOPIK I grammar (strata/topik-i.grammar.json) each spoken passage uses, as Strata's grammarIn
// (strata/topik-i-forms.js) reads it: [passage, recall passage] per question. What is understood is the
// passage, not the O/X claim. A test keeps this equal to grammarIn (a draft before teacher review).
export const RHYTHM_GRAMMAR=[[[['G302'],[]],[['G409'],['G406','G409']],[['G307'],['G307']],[['G208'],['G208']],[['G208'],['G208']]],[[['G208'],['G208']],[['G307','G402'],['G307']],[['G208'],['G208']],[['G409'],['G208']],[['G410','G211'],['G410','G211']]],[[['G402'],['G304','G402']],[['G208'],['G208']],[['G208'],['G208']],[[],['G208']],[['G208'],['G409']]]];
// Reword a spoken line and that item's version goes up (learning standard §7-2); its family stays.
// 2026-10-08: t1q2's recall claim ‘배우러 등록했나요?’ → ‘배우려고 등록했나요?’ (-(으)러 goes with 가다·오다) → version 2.
// 2026-10-21 (item review): t1q0's X claim asks the reason (‘날씨가 추워서 …취소했나요?’, it asked whether the picnic happened);
// t2q2's claims and recall claim match the story's past tense (‘동의했나요?’·‘반대했나요?’) → version 2, re-recorded.
// Same day, second review: t2q2 says it with TOPIK I words (‘새 방법이 좋다고 했어요’ — 찬성하다·동의하다 are intermediate) → version 3;
// t2q3 asks about the same thing the story names (‘일정을 바꾸기 힘든가요?’, it asked about ‘날짜’) → version 2. Both re-recorded.
export const ITEM_VERSION=Object.freeze({t1q2r:2,t1q0v1:2,t2q2v0:3,t2q2v1:3,t2q2r:3,t2q3v0:2,t2q3v1:2,t2q3r:2});
export function rhythmItem(trackId,question,{recall=false}={}){
  const sourceIndex=question.sourceIndex??Number(question.id.match(/q(\d+)/)?.[1]||0);
  // A recall only swaps a number or a time and follows the answer and explanation at once,
  // so it shares the original's family: practice, never a new independent first try.
  const familyKey=`korean-rhythm:t${trackId}q${sourceIndex}:v1`;
  const id=`t${trackId}q${sourceIndex}${recall?'r':`v${question.variant??0}`}`,version=ITEM_VERSION[id];
  return {id,
    itemKey:(recall?`${familyKey}:recall`:`${familyKey}:claim${question.variant??0}`)+(version?`:v${version}`:''),familyKey,
    skillId:`ko.listening.${SKILLS[trackId][sourceIndex]}`,difficulty:DIFFICULTY[trackId][sourceIndex],
    modality:'listening',responseFormat:'binary-choice',audioRequired:true,confounded:false,
    conceptIds:[...(RHYTHM_GRAMMAR[trackId]?.[sourceIndex]?.[recall?1:0]||[])]};
}
// A song names its question families, so a song already played through goes behind
// songs that can still give a first try (its recall questions share these families).
// A song's difficulty for Core is its hardest question's (a song is played whole); a task picks questions by their own.
export const RHYTHM_CANDIDATES=TRACKS.map(track=>({id:`track-${track.id}`,trackId:track.id,
  label:track.title,skillIds:[...new Set(SKILLS[track.id].map(s=>`ko.listening.${s}`))],
  difficulty:Math.max(...DIFFICULTY[track.id]),modality:'listening',responseFormat:'binary-choice',
  familyKeys:track.questions.map((_,i)=>`korean-rhythm:t${track.id}q${i}:v1`),
  conceptIds:[...new Set((RHYTHM_GRAMMAR[track.id]||[]).flatMap(([passage])=>passage))]}));

export function assignmentTracks(target){
 if(!target)return RHYTHM_CANDIDATES;
 return RHYTHM_CANDIDATES.filter(c=>c.modality===target.modality&&c.responseFormat===target.responseFormat&&c.familyKeys.some((key,i)=>{const m=rhythmItem(c.trackId,{sourceIndex:i});return target.familyKeys?.includes(key)&&m.skillId===target.skillId&&m.difficulty===target.difficulty&&(!target.itemKeys?.length||[0,1].some(v=>target.itemKeys.includes(rhythmItem(c.trackId,{sourceIndex:i,variant:v}).itemKey)));}));
}
export function rhythmTargetLabel(target){return `이번 목표: 듣기 · ${{detail:'세부 내용',negation:'부정 표현',condition:'조건 표현',reason:'이유',main:'중심 내용'}[target.skillId.split('.').at(-1)]||'과제 표현'} · 난도 ${target.difficulty}. 과제 문항 ${target.requiredAttempts}개에 답해요.`;}
// The results line naming the next song: the object particle follows the title's last syllable (‘해안선’을, ‘네 시’를).
export function nextTrackLine(label,reason){return `다음 곡으로 ‘${label}’${josa(label,'을','를')} 추천해요.${reason?` ${reason}`:''}`;}
// Preserve a complete song and its timing while selecting only authorized claim
// variants for its target families. Other questions still belong to the song.
export function assignmentTrack(track,target){
 if(!target)return track;
 if(!assignmentTracks(target).some(c=>c.trackId===track.id))return null;
 const variantChoices={};
 track.questions.forEach((q,i)=>{const m=rhythmItem(track.id,{sourceIndex:i});if(target.familyKeys?.includes(m.familyKey)&&m.skillId===target.skillId&&m.difficulty===target.difficulty)variantChoices[i]=[0,1].filter(v=>!target.itemKeys?.length||target.itemKeys.includes(rhythmItem(track.id,{sourceIndex:i,variant:v}).itemKey));});
 return {...track,variantChoices};
}

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
