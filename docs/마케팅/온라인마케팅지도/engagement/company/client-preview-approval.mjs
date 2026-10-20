// The customer receives this decision, never the internal workflow or its notes.
// Keep the API approval guard and the rendered action based on this same record.
export function buildCustomerPreviewApproval(row){
  const latest=(row.versions||[]).filter(version=>version.kind==='preview').at(-1);
  const decision=(status,reason,waitingFor=null)=>({versionId:latest?.id||null,canApprove:status==='ready',status,reason,waitingFor});
  if(!latest)return decision('unavailable','확인할 시안을 준비하고 있어요.','team');
  if(row.stage==='archived')return decision('unavailable','보관된 프로젝트예요.');
  if(latest.approvedAt)return decision('approved','이 시안의 승인을 마쳤어요.');
  if((row.studio?.feedbackRounds?.drafts||[]).some(draft=>draft.versionId===latest.id&&draft.items?.length))return decision('draft_pending','모은 수정 의견을 먼저 보내거나 초안에서 지운 뒤 승인해 주세요.','customer');
  const unresolved=(row.messages||[]).filter(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved);
  if(unresolved.some(message=>message.versionId===latest.id))return decision('feedback_pending','이 시안에 보낸 수정 의견이 있어요. 수정본이 오면 그때 승인해 주세요.','team');
  // A newly uploaded preview is visible immediately, but every previous request
  // must be linked and reviewed for that exact preview before it can be approved.
  if(unresolved.some(message=>message.workflow?.status!=='waiting_customer'||message.workflow.resultVersionId!==latest.id))return decision('team_review','보낸 의견이 이번 수정본에 잘 들어갔는지 제작팀이 보고 있어요. 끝나면 승인할 수 있어요.','team');
  return decision('ready','시안이 마음에 들면 승인해 주세요. 이 시안으로 최종본을 만들어요.','customer');
}
