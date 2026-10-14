// The customer receives this decision, never the internal workflow or its notes.
// Keep the API approval guard and the rendered action based on this same record.
export function buildCustomerPreviewApproval(row){
  const latest=(row.versions||[]).filter(version=>version.kind==='preview').at(-1);
  const decision=(status,reason,waitingFor=null)=>({versionId:latest?.id||null,canApprove:status==='ready',status,reason,waitingFor});
  if(!latest)return decision('unavailable','확인할 시안을 준비하고 있어요.','team');
  if(row.stage==='archived')return decision('unavailable','보관된 프로젝트예요.');
  if(latest.approvedAt)return decision('approved','이 시안의 승인을 마쳤어요.');
  if((row.studio?.feedbackRounds?.drafts||[]).some(draft=>draft.versionId===latest.id&&draft.items?.length))return decision('draft_pending','모은 수정 의견을 먼저 제출하거나 초안에서 지운 뒤 승인해 주세요.','customer');
  const unresolved=(row.messages||[]).filter(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved);
  if(unresolved.some(message=>message.versionId===latest.id))return decision('feedback_pending','이 시안에 전달한 수정 의견이 있어요. 담당자가 준비할 수정본을 기다려 주세요.','team');
  // A newly uploaded preview is visible immediately, but every previous request
  // must be linked and reviewed for that exact preview before it can be approved.
  if(unresolved.some(message=>message.workflow?.status!=='waiting_customer'||message.workflow.resultVersionId!==latest.id))return decision('team_review','이전 시안의 수정 의견을 최신 수정본에 연결하고 검토하는 중이에요. 준비가 끝나면 승인할 수 있어요.','team');
  return decision('ready','시안의 내용과 표현을 확인한 뒤 최종 제작 진행에 동의할 수 있어요.','customer');
}
