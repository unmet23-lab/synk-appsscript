export function instructionMetadata(item){
 const skill=item.steps.length>1?'sequence':item.skill.includes('부정')?'negation':'detail';
 return {id:`korean-runner.${item.id}`,itemKey:`korean-runner.${item.id}.v4`,familyKey:`korean-runner.${item.id}.v4`,
  skillId:`ko.listening.${skill}`,difficulty:item.steps.length>1?2:1,modality:'listening',responseFormat:'action',audioRequired:true,confounded:true};
}
export function instructionCandidates(items){return items.map(item=>{const m=instructionMetadata(item);return {...item,skillIds:[m.skillId],difficulty:m.difficulty,modality:m.modality,responseFormat:m.responseFormat,itemKey:m.itemKey,label:item.skill};});}
export function chooseInstruction(coach,items){return coach.recommend(instructionCandidates(items),{audioAvailable:true});}
export function actionEvidence(mission,correct){
 // Obstacles show the required action. Neither success nor collision proves language ability.
 return {correct,assessable:false,reason:mission.steps.some(s=>s.status==='timing')?'motor':'visual'};
}

/* Atlas moment-level challenge (Core flow.js) for the run's pace only: how fast it starts and how much it
 * speeds up. Instructions, obstacles and the recorded evidence never change. Values run easiest first and
 * start at the original game. A performed request is a success; a request with no move at all, or an
 * obstacle the runner could not react to in time, is time running out; a different or late move is a
 * miss within time. None of these is language evidence (the run is confounded; see actionEvidence). */
export const FLOW_RUN={id:'korean-runner.run',version:1,target:0.8,knobs:[
 {id:'speed',kind:'pace',label:'처음 달리는 속도',values:[11,12,13,14,15],start:2},
 {id:'ramp',kind:'pace',label:'갈수록 빨라지는 정도',values:[0,.025,.04,.055,.07],start:3,weight:.5}]};
// A tired day keeps the run from speeding up at all (Atlas design §4-9: nothing gets harder today).
export const TIRED_RUN={knobs:{ramp:0}};
export const FLOW_WORDS={'raise.pace':'바람이 조금 빨라져요.','ease.pace':'바람이 조금 느긋해져요.','start.memory':'','start.prior':'',
 'start.tired':'오늘은 바람이 빨라지지 않아요.','start.returning':'오랜만이라 바람이 느긋하게 불어요.'};
export function paceOf(values={}){return {speed:values.speed,ramp:values.ramp};}
export function runObservation(notice){
 if(notice?.type==='correct')return {outcome:'success'};
 if(notice?.type==='wrong'){const steps=notice.record?.steps||[];return {outcome:steps.length&&steps.every(s=>s.status==='missed')?'timeout':'fail'};}
 // A collision during a request is part of that request's result; only other obstacles say more.
 if(notice?.type==='hit'&&!notice.mission)return {outcome:'timeout'};
 return null;
}
