import {esc,keepDots} from './api.mjs';

export function previewApprovalState(project,{demo=false}={}){
  const latest=(project?.versions||[]).filter(version=>version.kind==='preview').at(-1);
  const decision=(status,reason,waitingFor=null)=>({versionId:latest?.id||null,canApprove:status==='ready',status,reason,waitingFor});
  if(!latest)return decision('unavailable','확인할 시안을 준비하고 있어요.','team');
  if(latest.approvedAt)return decision('approved','이 시안의 승인을 마쳤어요.');
  // Live customer responses already contain the authoritative server decision.
  if(!demo&&project.previewApproval?.versionId===latest.id)return project.previewApproval;
  // Demo and staff views retain their local records. Missing live projection
  // cannot turn an unresolved earlier request into an enabled approval button.
  if((project.studio?.feedbackRounds?.drafts||[]).some(draft=>draft.versionId===latest.id&&draft.items?.length))return decision('draft_pending','모은 수정 의견을 먼저 제출하거나 초안에서 지운 뒤 승인해 주세요.','customer');
  const pending=(project.messages||[]).filter(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved);
  if(pending.some(message=>message.versionId===latest.id))return decision('feedback_pending','이 시안에 전달한 수정 의견이 있어요. 담당자가 준비할 수정본을 기다려 주세요.','team');
  if(!demo&&pending.some(message=>message.workflow?.status!=='waiting_customer'||message.workflow.resultVersionId!==latest.id))return decision('team_review','이전 시안의 수정 의견을 최신 수정본에 연결하고 검토하는 중이에요. 준비가 끝나면 승인할 수 있어요.','team');
  return decision('ready','시안의 내용과 표현을 확인한 뒤 최종 제작 진행에 동의할 수 있어요.','customer');
}

export function confirmationScope(s){
  if(s.demo||!s.project)return '';
  const st=s.project.studio||{},strategy=st.strategy||{},confirmed=strategy.confirmation?.strategyRevision===strategy.revision&&strategy.revision>0;
  const scopes={
    strategy:['메시지·근거·행동과 납품 규격','설계와 납품 규격은 각각 버전으로 남아요.','표현 샘플과 콘셉트'],
    direction:['마음에 드는 표현 요소','색감·편집·자막처럼 마음에 드는 부분만 골라 주세요. 샘플 그대로 만든다는 뜻은 아니에요.','프로젝트에 맞춘 콘셉트'],
    concepts:['함께 만들 콘셉트','이미지와 이야기의 방향을 정해요. 장면과 움직임은 다음 단계에서 봐요.','장면별 내용과 전체 흐름'],
    storyboard:['이야기·장면과 재생 흐름','임시 음원으로 흐름을 봐요. 실제 시험 장면 확인은 따로 남아요.','전체 제작 영상'],
    review:['이번 영상 버전의 수정·승인','수정 의견은 초안에 모아 한 번에 보내요. 최종 승인과 파일 수령은 따로 해요.','수정본 확인 또는 최종 파일'],
    history:['약속한 결과물과 사용 안내','규격에 연결된 파일을 확인해 주세요. 연결이 검수를 대신하지는 않아요.','파일 수령과 남은 문의']
  };
  const scope=scopes[s.tab];if(!scope)return '';
  return `<section class="production-scope" aria-label="이번 확인의 범위"><div class="scope-now"><span class="scope-label">지금 확인할 것</span><strong>${keepDots(esc(scope[0]))}</strong></div><div class="scope-range"><span class="scope-label">확인 범위</span><p>${keepDots(esc(scope[1]))}</p>${confirmed?`<small>제작 설계 v${esc(strategy.revision)} 확인됨</small>`:'<small class="is-pending">제작 설계는 함께 확인 중</small>'}</div><div class="scope-next"><span class="scope-label">다음 확인</span><strong>${keepDots(esc(scope[2]))}</strong></div></section>`;
}
