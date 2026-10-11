import {normalizeSupport} from './game-tutor-support.mjs';
export const TUTOR_GAME_EVENT='synk:tutor:game';
export const TUTOR_GAME_COMMAND='synk:tutor:command';
export const GAME_EVENTS=Object.freeze(['ready','lobby','playing','paused','listening','picked','success','retry','finish']);
export function acceptTutorEvent(event,{source,origin,game}){
 const data=event?.data;
 if(!source||event.source!==source||event.origin!==origin||data?.type!==TUTOR_GAME_EVENT||data.version!==1||data.game!==game||!GAME_EVENTS.includes(data.kind))return null;
 // Only bounded, already-answered item text can accompany the actual verdict.
 // No identities, scoring commands, arbitrary HTML or account capabilities.
 const support=['success','retry'].includes(data.kind)?normalizeSupport(data.support,game):[];
 return {kind:data.kind,reason:['unanswered','obstacle','timing'].includes(data.reason)?data.reason:undefined,completed:data.completed!==false,answer:data.answer===true,...(support.length?{support}:{})};
}
