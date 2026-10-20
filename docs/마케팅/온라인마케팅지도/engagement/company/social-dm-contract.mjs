import dmTools from '../../../../../tools/lib/sns-dm.js';
export function normalizePublicationDm(raw,channel,options){
  if(raw==null)return null;
  const dm=dmTools.normalizeDm(raw,options);
  if(channel?.platform!=='instagram'||channel.externalId!==dm.account_id)throw Object.assign(new Error('댓글 DM 자료의 Instagram 계정과 게시 계정이 달라요.'),{status:400});
  // Each publication gets its own deterministic campaign. An imported campaign
  // ID may describe an old post and must never select that old campaign.
  delete dm.campaign_id;
  return dm;
}
