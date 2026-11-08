// 이 프로젝트의 모델을 어떻게 정했는지 한 곳에서 본다(2026-11-09 다국어 · 고객 전용 인물 판 1, 기획 12-2 「선택 값」).
// 서버(pulse-requests.mjs)와 고객 방(room-view.mjs) · 직원 화면이 같은 판단을 쓰게 순수 함수로 둔다 — DOM · 저장소를 만지지 않는다.
//
// kind: 'catalog'(캐스팅북 모델) · 'persona'(이 프로젝트에 붙인 전용 인물) · 'custom'(새 전용 인물을 바람) ·
//       'ask'(추천해 주세요) · 'none'(사람 없이 제품만) · ''(아직 정하지 않음).
// agreed: 손님이 모델을 받아들였는지(글 콘티를 보내도 되는지). 직원이 제작 설계에만 넣은 카탈로그 모델은 손님 확인 전이다.
// 전용 인물 참조(castingSelection.personaRef)는 손님이 그 인물의 사용을 승인한 뒤에만 서버가 붙인다(판 3). 그래서 붙어 있으면 agreed다.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MODEL_CHOICE_KINDS=Object.freeze(['ask','none','custom','persona']);
// 손님이 카탈로그 모델 없이 가겠다고 고른 것(사람 없이 · 전용 인물). 방향 제안에 카탈로그 모델을 함께 보내지 않아도 된다.
export const MODEL_OPTIONAL_CHOICES=Object.freeze(['none','custom','persona']);
// 전용 인물 참조의 모양만 본다(어느 인물 · 어느 판). 소유 · 공개 판 · 기간은 서버가 따로 다시 본다.
export function personaRefOf(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const {personaId,revisionId}=value;
  return typeof personaId==='string'&&typeof revisionId==='string'&&UUID.test(personaId)&&UUID.test(revisionId)?{personaId,revisionId}:null;
}
export function castingOf(request,selection){
  const answers=request?.answers||{},proposal=request?.modelProposal,none=answers.modelChoice==='none';
  const personaRef=personaRefOf(selection?.personaRef);
  if(personaRef)return {kind:'persona',modelId:'',personaRef,agreed:true};
  // 손님이 고르거나 받아들인 모델. 방향을 고르면 그 모델이 답에도 옮겨지므로(chooseDirection) 방향은 따로 보지 않는다.
  const agreedId=(proposal?.status==='accepted'&&typeof proposal.modelId==='string'&&proposal.modelId)||(Array.isArray(answers.models)&&typeof answers.models[0]==='string'&&answers.models[0])||'';
  const chosenId=typeof selection?.modelId==='string'?selection.modelId:'';
  const modelId=chosenId||agreedId;
  if(modelId)return {kind:'catalog',modelId,personaRef:null,agreed:!!agreedId||none};
  const kind=MODEL_CHOICE_KINDS.includes(answers.modelChoice)?answers.modelChoice:'';
  return {kind,modelId:'',personaRef:null,agreed:none};
}
