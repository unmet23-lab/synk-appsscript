import {createHash} from 'node:crypto';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const remoteId=value=>typeof value==='string'&&/^\d{1,50}(?:_\d{1,50})?$/.test(value);
export const replySetHash=ids=>digest([...new Set(ids)].sort());

// A remote observation is evidence of a reply, never evidence that SYNK sent it.
export function observedReply(row,channel){
  const evidence=row?.externalReplyEvidence;
  if(!channel||!evidence||row.source!=='api:'+channel.platform||row.parentExternalId||
    evidence.source!=='meta-read'||evidence.method!=='author-id-match'||
    evidence.sourceAccountId!==channel.externalId||row.sourceAccountId!==channel.externalId||
    evidence.connectionVersion!==channel.connectionVersion||!Number.isFinite(Date.parse(evidence.observedAt)))return null;
  const ids=Array.isArray(evidence.replyIds)?[...new Set(evidence.replyIds.filter(remoteId))].sort():[];
  if(!Number.isInteger(evidence.replyCount)||evidence.replyCount<1||!remoteId(evidence.latestReplyExternalId)||!ids.length)return null;
  return {replyCount:evidence.replyCount,replyIds:ids.slice(0,20),latestReplyExternalId:evidence.latestReplyExternalId,
    latestReplyAt:Number.isFinite(Date.parse(evidence.latestReplyAt))?evidence.latestReplyAt:null,
    observedAt:evidence.observedAt,complete:evidence.complete===true,
    replySetHash:/^[a-f0-9]{64}$/.test(evidence.replySetHash||'')?evidence.replySetHash:replySetHash(ids)};
}

export function observedReplyAcknowledgmentKey(row,channel){
  const evidence=observedReply(row,channel);
  return evidence?digest([row.id,channel.id,channel.externalId,channel.connectionVersion,evidence.replySetHash,evidence.replyCount]):null;
}

export function inboxReplyState(row,channel){
  const evidence=observedReply(row,channel),proof=row.metaAccountReply;
  const isAccountReply=Boolean(channel&&row.source==='api:'+channel.platform&&remoteId(row.parentExternalId)&&row.sourceAccountId===channel.externalId&&proof?.connectionVersion===channel.connectionVersion&&proof.confirmed===true&&proof.hidden!==true);
  const answered=row.outboundSent===true||Boolean(evidence)||isAccountReply;
  return {alreadyAnswered:answered,isAccountReply,effectiveStatus:row.status==='resolved'?'resolved':answered?'answered':row.status||'open',
    observedReply:evidence,observedReplyAcknowledgmentKey:observedReplyAcknowledgmentKey(row,channel)};
}
