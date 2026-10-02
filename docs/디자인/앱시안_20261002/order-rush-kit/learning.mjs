// The game owns authored content; Atlas owns the shared evidence and selection.
const SKILLS={o03:'negation',o07:'negation',o09:'negation',o11:'negation',r01:'negation',r03:'negation',o06:'condition',o08:'condition',o10:'condition',o12:'condition',r02:'condition'};
export function orderMetadata(order){
 const skillId=`ko.listening.${SKILLS[order.id]||'detail'}`;
 return {id:`order-rush.${order.id}`,itemKey:`order-rush.${order.id}.v1`,familyKey:`order-rush.${order.id}.v1`,skillId,
  difficulty:order.cups.length>1?3:SKILLS[order.id]?2:1,modality:'listening',audioRequired:true,confounded:false};
}
export function orderCandidates(orders){return orders.map(order=>{const m=orderMetadata(order);return {...order,skillIds:[m.skillId],difficulty:m.difficulty,modality:m.modality,itemKey:m.itemKey,label:order.skill};});}
export function chooseOrder(coach,orders){return coach.recommend(orderCandidates(orders),{audioAvailable:true});}
export function orderAnswer(result,ticket){
 // The explicit serve action supplies a semantic response. Timeout supplies none.
 return {correct:result.correct,assessable:ticket.audioCompleted===true,reason:ticket.audioCompleted===true?undefined:'audio'};
}
