import {esc} from './api.mjs';

export function confirmationScope(s){
  if(s.demo||!s.project)return '';
  const st=s.project.studio||{},strategy=st.strategy||{},confirmed=strategy.confirmation?.strategyRevision===strategy.revision&&strategy.revision>0;
  const scopes={
    strategy:['메시지·근거·행동과 납품 규격','제작 설계 확인과 납품 규격 확인은 각각 표시된 버전에 남습니다.','표현 샘플과 콘셉트'],
    direction:['마음에 드는 표현 요소','색감·편집·자막 등 원하는 부분을 골라 주세요. 샘플 전체를 그대로 제작한다는 확정은 아닙니다.','프로젝트에 맞춘 콘셉트'],
    concepts:['함께 만들 콘셉트','선택한 이미지와 이야기의 방향을 확인합니다. 장면과 실제 움직임은 다음에 확인합니다.','장면별 내용과 전체 흐름'],
    storyboard:['이야기·장면과 재생 흐름','임시 음원으로 확인한 흐름과 실제 시험 장면의 확인 범위는 별도로 남습니다.','전체 제작 영상'],
    review:['이번 영상 버전의 수정·승인','수정 의견은 초안에 모아 담당자가 취합해 제출합니다. 최종 시안 승인과 납품 파일 수령은 구분됩니다.','수정본 확인 또는 최종 파일'],
    history:['약속한 결과물과 사용 안내','납품 규격에 연결된 파일을 확인해 주세요. 파일 연결만으로 규격 검수가 완료되지는 않습니다.','파일 수령과 남은 문의']
  };
  const scope=scopes[s.tab];if(!scope)return '';
  return `<section class="production-scope panel-card" aria-label="이번 확인의 범위"><div><strong>지금 확인할 것</strong><p>${esc(scope[0])}</p></div><div><strong>확인 범위</strong><p>${esc(scope[1])}</p></div><div><strong>다음 확인</strong><p>${esc(scope[2])}</p><small>${confirmed?'제작 설계 v'+esc(strategy.revision)+' 확인됨':'제작 설계는 함께 확인 중'}</small></div></section>`;
}
