// 고객 전용 인물 저장소의 이름과 판 1 검사(2026-11-09 다국어 · 고객 전용 인물 판 1, 기획 12-2 「저장」 · 「90일 정리」).
// 접수 · 직원 검토 · 승인 · 공개 판은 판 3이 이 모듈에 더한다. 판 1은 이름과 「정리가 건드리지 않을 것」 · 「다시 볼 것」만 둔다 —
// 그래서 지금은 어떤 인물 문서도 쓰이지 않고, 아래 검사는 인물 문서가 생긴 뒤에도 같은 뜻으로 돈다.
import {personaRefOf} from './public/pulse-app/casting-choice.mjs';

export const PERSONA_KINDS=Object.freeze({
  workspaces:'customerWorkspaces',personas:'pulsePersonas',revisions:'pulsePersonaRevisions',
  sources:'pulsePersonaSources',consents:'pulsePersonaConsents',approvals:'pulsePersonaApprovals',
});
// 더 검토 · 승인할 것이 없는 인물. 그 밖의 상태(모르는 값 포함)는 열린 요청으로 보고, 90일 정리가 그 프로젝트를 건너뛴다(자료를 남기는 쪽).
export const PERSONA_SETTLED=Object.freeze(['ready','retired','expired','withdrawn']);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
// 열린 인물 요청이 걸린 프로젝트. 인물은 처음에 그 요청을 낸 프로젝트(originProjectId)에 묶인다.
export function openPersonaProjectIds(store){
  return new Set(store.all(PERSONA_KINDS.personas).filter(persona=>!PERSONA_SETTLED.includes(persona?.status)).map(persona=>persona?.originProjectId).filter(id=>typeof id==='string'&&id));
}
// 방향 제안 · 제작 시작 때 붙은 전용 인물을 다시 본다: 그 인물이 이 프로젝트에서 시작됐고(고객 브랜드로 넓히는 것은 판 4),
// 참조한 판이 그 인물의 공개된 판이며, 인물이 쓸 수 있는 상태(ready)인지. 하나라도 어긋나면 409로 최신 내용을 읽게 한다.
// 판 1에는 인물 문서가 없으므로 어떤 참조도 통과하지 않는다(참조를 붙이는 길도 없다).
export function createPersonaGuard(store){
  return function assertPersonaUsable(ref,row){
    const valid=personaRefOf(ref),changed=()=>fail('전용 인물 판이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
    if(!valid)throw changed();
    const persona=store.get(PERSONA_KINDS.personas,valid.personaId),revision=store.get(PERSONA_KINDS.revisions,valid.revisionId);
    if(!persona||persona.status!=='ready'||persona.deletedAt||persona.originProjectId!==row?.id)throw changed();
    if(!revision||revision.personaId!==persona.id||revision.status!=='published'||revision.deletedAt)throw changed();
    return {persona,revision};
  };
}
