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
