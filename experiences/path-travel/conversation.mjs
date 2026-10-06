import * as InterpretationModule from '../../atlas/interpretation.js';
import {
  ALL_FIELDS, EXECUTION_FIELDS, PREFERENCE_CONTRACT, DOMAIN_SCOPE,
  setPreference, validatePersonalization, valueLabel,
} from './profile.mjs';
import { extractTravelText } from './extractor.mjs';

const Interpretation = InterpretationModule.default ?? globalThis.SynkAtlasInterpretation;
export const CONVERSATION_VERSION = 'path-travel-conversation-1';
const fields = new Map(ALL_FIELDS.map(field=>[field.id,field]));
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const canonical = value => JSON.stringify(value, (_key,item)=>plain(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const fail = message => { throw new TypeError(message); };
const time = value => {
  const at=value??new Date().toISOString();
  if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)fail('문장 확인 시각을 확인해 주세요.');
  return at;
};

function validateDraft(draft, at) {
  if(!plain(draft)||draft.version!==CONVERSATION_VERSION||typeof draft.id!=='string'||!/^path-text-[a-zA-Z0-9_.:-]{1,80}$/.test(draft.id)
    ||!/^seoul-trip-[1-9]\d*$/.test(draft.encounterId)||!plain(draft.packet)
    ||canonical(draft.packet.contract)!==canonical(PREFERENCE_CONTRACT)||canonical(draft.packet.scope)!==canonical(DOMAIN_SCOPE)
    ||!plain(draft.hints)||!Array.isArray(draft.reviews)||!Array.isArray(draft.unhandled))fail('확인할 문장 제안을 다시 만들어 주세요.');
  for(const proposal of draft.packet.proposals??[]){
    const hint=draft.hints[proposal.id];
    if(!fields.has(proposal.field)||!hint||!['prefer','require','ignore'].includes(hint.mode)||!['once','ongoing'].includes(hint.duration)
      ||!Number.isInteger(hint.importance)||hint.importance<1||hint.importance>5)fail('제안의 조건·중요도·기간을 확인해 주세요.');
  }
  return Interpretation.resolve({...draft.packet,reviews:draft.reviews,at});
}

function present(draft, at) {
  const resolved=validateDraft(draft,at);
  return clone({...draft,at,proposals:resolved.proposals.map(proposal=>{
    const value=proposal.review?.action==='correct'?proposal.review.value:proposal.value;
    return {...proposal,value,label:fields.get(proposal.field).label,labelValue:valueLabel(proposal.field,value),...draft.hints[proposal.id]};
  })});
}

/** Local extraction is a proposal only: preparing never creates a preference. */
export function prepareConversation(text,{at,encounterId='seoul-trip-1'}={}) {
  const now=time(at), extracted=extractTravelText(text,{at:now,encounterId});
  Interpretation.prepare({...extracted.packet,at:now});
  const draft={version:CONVERSATION_VERSION,id:`path-text-${extracted.packet.sources[0].id}`,encounterId,
    packet:clone(extracted.packet),reviews:[],hints:clone(extracted.hints),unhandled:clone(extracted.unhandled)};
  return present(draft,now);
}

/** Review and preference recording are one pure transaction. The caller commits
 * both returned values only after the resulting recommendation succeeds.
 * Unconfirmed/rejected drafts remain in memory. Accepted records retain the
 * immutable source packet needed to verify Core's review basis on reload. */
export function reviewConversation(personalization,draft,{proposalId,action,value,mode,importance,duration,at}={}) {
  const now=time(at), original=validatePersonalization(personalization,{at:now}), resolved=validateDraft(draft,now);
  if(draft.encounterId!==original.encounterId)fail('이 문장은 이전 여행에서 만든 제안이에요. 현재 여행에서 다시 확인해 주세요.');
  if(!['confirm','correct','reject'].includes(action))fail('제안을 확인·수정·거절 중 하나로 골라 주세요.');
  const proposal=resolved.proposals.find(row=>row.id===proposalId);
  if(!proposal)fail('확인할 제안을 찾지 못했어요.');
  if(proposal.review)fail('이미 검토한 제안이에요. 조건 카드에서 직접 수정해 주세요.');
  if(action==='confirm'&&proposal.status!=='pending')fail('뜻이 충돌하거나 보류된 문장은 그대로 확인할 수 없어요. 조건을 직접 고쳐 주세요.');
  if(action==='confirm'&&value!==undefined&&value!==proposal.value)fail('제안 값을 바꾸려면 수정으로 확인해 주세요.');
  const review=Interpretation.review({...draft.packet,reviews:draft.reviews,
    id:`path-review-${original.serial+1}-${draft.packet.sources[0].id}-${draft.reviews.length+1}`,
    proposalId,action,at:now,...(action==='correct'?{value}:{})});
  const nextDraft=clone(draft);nextDraft.reviews.push(review);
  if(action==='reject')return {personalization:original,draft:present(nextDraft,now)};

  const hint=draft.hints[proposalId], accepted=action==='correct'?value:proposal.value;
  const chosen={mode:mode??hint.mode,importance:importance??hint.importance,duration:duration??hint.duration};
  // These controls are part of the user's review, never fabricated observations.
  if(EXECUTION_FIELDS.includes(proposal.field)){chosen.mode='require';chosen.importance=3;}
  if(accepted==='any')chosen.mode='ignore';
  let next=setPreference(original,{field:proposal.field,value:accepted,...chosen,at:now});
  const recorded=next.events.slice(-3);
  const binding={field:proposal.field,reviewId:review.id,eventId:recorded[0].id,
    modeEventId:recorded[1].id,importanceEventId:recorded[2].id,duration:chosen.duration};
  const rawProposal=draft.packet.proposals.find(row=>row.id===proposalId);
  const sourceIds=new Set(rawProposal.evidence.map(evidence=>evidence.sourceId));
  const archive={id:`path-text-${binding.eventId}`,encounterId:original.encounterId,
    packet:{contract:clone(PREFERENCE_CONTRACT),scope:clone(DOMAIN_SCOPE),
      sources:clone(draft.packet.sources.filter(source=>sourceIds.has(source.id))),proposals:[clone(rawProposal)]},
    reviews:[clone(review)],bindings:[binding]};
  next.interpretations=[...(next.interpretations??[]),archive];
  next=validatePersonalization(next,{at:now});
  nextDraft.hints[proposalId]=chosen;
  return {personalization:next,draft:present(nextDraft,now)};
}
