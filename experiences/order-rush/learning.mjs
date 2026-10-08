// The game owns authored content; Atlas owns the shared evidence and selection.
const SKILLS={o03:'negation',o07:'negation',o09:'negation',o11:'negation',r01:'negation',r03:'negation',o06:'condition',o08:'condition',o10:'condition',o12:'condition',r02:'condition'};
// The TOPIK I grammar each order uses, as Strata's grammarIn (strata/topik-i-forms.js) reads its text:
// -(으)세요 in every order, and -아/어 주세요 where something is taken out or put in (빼 주세요, 넣어 주세요).
// A test keeps this equal to grammarIn (a draft before teacher review).
export const ORDER_GRAMMAR=Object.freeze({o01:['G211'],o02:['G211'],o03:['G211','G404'],o04:['G211'],o05:['G211','G404'],o06:['G211','G404'],o07:['G211'],o08:['G211','G404'],
 o09:['G211'],o10:['G211'],o11:['G211','G404','S226'],o12:['G211'],r01:['G211'],r02:['G211','S107','G404'],r03:['G211']});
// Reword an order or change its cups and its version goes up (learning standard §7-2, order content).
// The family stays, so someone who heard the earlier wording meets a repeat, not a new order.
// 2026-10-08: o08·o09·o11 reworded to sound natural, same cups → version 2.
export const ORDER_VERSION=Object.freeze({o08:2,o09:2,o11:2});
export function orderMetadata(order){
 const skillId=`ko.listening.${SKILLS[order.id]||'detail'}`;
 return {id:`order-rush.${order.id}`,itemKey:`order-rush.${order.id}.v${ORDER_VERSION[order.id]||1}`,familyKey:`order-rush.${order.id}.v1`,skillId,
  difficulty:order.cups.length>1?3:SKILLS[order.id]?2:1,modality:'listening',responseFormat:'cup-compose',audioRequired:true,confounded:false,
  conceptIds:[...(ORDER_GRAMMAR[order.id]||[])]};
}
export function assignmentOrders(orders,target){
 if(!target)return orders;
 return orders.filter(o=>{const m=orderMetadata(o);return m.skillId===target.skillId&&m.difficulty===target.difficulty&&m.modality===target.modality&&m.responseFormat===target.responseFormat&&target.familyKeys?.includes(m.familyKey)&&(!target.itemKeys?.length||target.itemKeys.includes(m.itemKey));});
}
export function orderTargetLabel(target){return `이번 목표: 듣기 · ${{detail:'세부 주문',negation:'빼기·바꾸기',condition:'조건 표현'}[target.skillId.split('.').at(-1)]||'과제 주문'} · 난도 ${target.difficulty}. 과제 주문 ${target.requiredAttempts}개를 만들어 봐요.`;}
export function orderCandidates(orders){return orders.map(order=>{const m=orderMetadata(order);return {...order,skillIds:[m.skillId],difficulty:m.difficulty,modality:m.modality,responseFormat:m.responseFormat,itemKey:m.itemKey,familyKey:m.familyKey,conceptIds:m.conceptIds,label:order.skill};});}
export function chooseOrder(coach,orders){return coach.recommend(orderCandidates(orders),{audioAvailable:true});}
export function orderAnswer(result,ticket){
 // The explicit serve action supplies a semantic response. Timeout supplies none.
 return {correct:result.correct,assessable:ticket.audioCompleted===true,reason:ticket.audioCompleted===true?undefined:'audio'};
}

/* Atlas moment-level challenge (Core flow.js). The rush declares what may change for a person,
 * easiest first; Atlas turns one knob by one step after a response. Values never become a score.
 * Order levels describe the order, not the person: 1 one plain cup, 2 a "without/instead" condition,
 * 3 two cups. The person can switch this off (fixed speed) in the lobby. */
export const FLOW_RUSH={id:'order-rush.rush',version:1,target:0.75,items:{levels:[1,2,3],weight:2},knobs:[
 {id:'patience',kind:'pace',label:'손님이 기다리는 시간',values:[60,54,48,42,36,30],start:3},
 {id:'spawnEvery',kind:'pace',label:'손님이 오는 간격',values:[15,13,11,10,8,7],start:3},
 {id:'queueMax',kind:'pace',label:'한 번에 기다리는 손님',values:[2,3,4],start:1,weight:1.5}]};
export const FLOW_PRACTICE={id:'order-rush.practice',version:1,target:0.8,items:{levels:[1,2,3],weight:2}};
export const FLOW_SKILLS=['ko.listening.detail','ko.listening.negation','ko.listening.condition'];
// The same changes said inside the cafe (Vellum line keys).
export const FLOW_WORDS={
 'raise.pace':'손님이 조금 더 바빠져요.','ease.pace':'손님이 조금 더 여유 있게 기다려요.',
 'raise.content':'조금 더 까다로운 주문도 들어와요.','ease.content':'간단한 주문부터 다시 받아요.',
 'start.memory':'지난번 영업에 맞춰 문을 열어요.','start.prior':'다른 게임 기록에 맞춰 문을 열어요.',
 'start.returning':'오늘은 가볍게 문을 열어요.','start.tired':'오늘은 더 바빠지지 않게 영업해요.',
 'start.fixed':'정해진 속도로 영업해요.','start.baseline':'이번 영업은 기본 속도로 해요.'};
export const LEVEL_WORDS={1:'한 잔 기본 주문',2:'빼기·바꾸기가 있는 주문',3:'두 잔 주문'};
// The rush kept easing (or had no easier step left) and the shift was mostly missed: point to the calmer mode.
export function easierSuggestion(spec,end,stats){
 const eased=(end?.changes||[]).filter(c=>c.kind==='pace'&&c.direction<0).length;
 if(spec?.id!=='order-rush.rush'||!(end?.floor?.includes('pace')||eased>=2)||!stats?.answered&&!stats?.unanswered)return null;
 const tried=stats.answered+stats.unanswered;return tried>0&&stats.firstCorrect/tried<0.5?'손님 속도를 가장 여유 있게 해도 바빴어요. 한가한 오픈에서 시간 제한 없이 먼저 익혀 보면 좋아요.':null;
}
// What a finished ticket still owes the challenge. A customer who left unserved ran out of time, and so
// did one who left while a wrong cup was being fixed (that wrong serve already counted as a miss).
export function closingObservation(t){
 if(t.presentationId&&!t.attempts)return t.learningClosed?null:{answer:true,outcome:t.outcome==='missed'?'timeout':'skip'};
 return t.outcome==='missed'&&!t.flowClosed?{answer:false,outcome:'timeout'}:null;
}
export function tuningFrom(values={}){return {patience:values.patience,spawnEvery:values.spawnEvery,queueMax:values.queueMax};}
export function chooseOrderLive(live,orders){return live.pick(orderCandidates(orders),{audioAvailable:true});}
// The share of the customer's patience used when the cup was served (rush only).
export function pressureOf(ticket,session){return session.mode==='rush'&&ticket.patience?Math.min(1.5,Math.max(0,(session.time-ticket.born)/ticket.patience)):null;}
// What changed in this shift, in the cafe's words. Only the settings, never a judgement of the person.
export function describeChanges(spec,start,end){
 const lines=[];
 for(const knob of spec.knobs||[]){const a=start?.[knob.id],b=end?.[knob.id];if(a!==b&&a!=null&&b!=null)lines.push(`${knob.label} ${a}${knob.id==='queueMax'?'명':'초'} → ${b}${knob.id==='queueMax'?'명':'초'}`);}
 const a=start?.['item.difficulty'],b=end?.['item.difficulty'];
 if(a!==b&&a!=null&&b!=null)lines.push(`주문 종류 ${LEVEL_WORDS[a]} → ${LEVEL_WORDS[b]}`);
 return lines;
}
