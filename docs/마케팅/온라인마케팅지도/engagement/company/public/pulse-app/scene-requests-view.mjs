import {esc,stamp,PulseError} from './api.mjs';

const statuses={open:'수정 요청',in_progress:'고치는 중',review:'제작팀 검토 중',changes_requested:'다시 고치는 중',waiting_customer:'고친 장면 확인 전',done:'확인 완료',stale:'장면이 바뀌어 다시 확인',unavailable:'장면 확인 필요',archived:'보관된 요청'};
const records=value=>Array.isArray(value)?value:[];
const requestItems=s=>records(s.project?.sceneRequests?.items).filter(item=>s.mode==='staff'||records(s.project?.studio?.scenes).some(scene=>scene.id===item.sceneId));
const deskLink=p=>`/?tab=workroom&amp;section=clients&amp;project=${encodeURIComponent(p.id)}&amp;requests=1`;
const currentWaiting=(item,scene)=>item.status==='waiting_customer'&&Number(item.resultRevision)===scene.revision&&Number(item.currentRevision)===scene.revision;

export function sceneRequestsSummary(s){
  const items=requestItems(s);if(!items.length)return '';
  const pending=items.filter(item=>!['done','archived'].includes(item.status)).length,done=items.filter(item=>item.status==='done').length;
  const missing=s.mode==='staff'?items.filter(item=>!records(s.project.studio?.scenes).some(scene=>scene.id===item.sceneId)):[];
  return `<section class="scene-requests-summary" aria-label="장면 수정 요청 현황"><div><strong>장면별 수정 요청</strong><p>진행 중인 요청 ${pending}개${done?' · '+(s.mode==='staff'?'고객 확인 완료':'확인 완료')+' '+done+'개':''}</p><p class="small">${s.mode==='staff'?'고객의 수정 요청과 고친 장면을 여기서 같이 봐요. 반영 제출과 내부 검토는 고객 관리에서 해요.':'요청마다 어디까지 고쳤는지 보여 드려요. 고친 장면이 오면 보고 확인해 주세요.'}</p></div>${s.mode==='staff'?`<a class="button quiet small-button" href="${deskLink(s.project)}" target="_blank" rel="noopener noreferrer">고객 관리에서 수정 요청 처리 ↗</a>`:''}${missing.length?`<ul class="scene-requests-unavailable">${missing.map(item=>`<li>${esc(item.title||'장면')} · ${esc(statuses[item.status]||'상태 확인 필요')}</li>`).join('')}</ul>`:''}</section>`;
}

export function sceneRequestView(s,scene){
  const items=requestItems(s).filter(item=>item.sceneId===scene.id);if(!items.length)return '';
  return `<section class="scene-request-list" aria-label="이 장면의 수정 요청"><h4>요청한 수정</h4>${items.map(item=>{
    const waiting=currentWaiting(item,scene);
    return `<article class="scene-request" data-scene-request-id="${esc(item.id)}"><div class="scene-request-heading"><span class="tag ${item.status==='done'&&!item.reason?'green':'berry'}">${esc(statuses[item.status]||'상태 확인 필요')}</span><time>${esc(stamp(item.createdAt))}</time></div><p class="scene-request-text">${esc(item.text)}</p>${s.mode==='staff'?`<dl class="scene-request-versions"><div><dt>요청한 장면</dt><dd>v${esc(item.requestedRevision)}</dd></div><div><dt>반영 제출한 장면</dt><dd>${item.resultRevision?'v'+esc(item.resultRevision):'아직 제출 전'}</dd></div><div><dt>현재 장면</dt><dd>v${esc(scene.revision)}</dd></div></dl>`:''}${item.reason?`<p class="scene-request-reason">${esc(item.reason)}</p>`:''}${item.status==='done'?`<p class="scene-request-reason">${s.mode==='staff'?'고객이 고친 장면을 확인했어요.':'고친 장면을 확인했어요.'}</p>`:''}${waiting&&s.mode==='customer'?'<p class="scene-request-reason">고친 내용을 보고 위 「고친 장면 확인」을 눌러 주세요.</p>':''}</article>`;
  }).join('')}</section>`;
}

// A rendered confirmation belongs to the scene and project version the person
// actually saw. Navigation never confirms a newer replacement in its place.
export function sceneConfirmation(s,dataset){
  const p=s.project;if(s.mode!=='customer'||!p||p.stage==='archived')throw new PulseError('지금은 장면을 확인할 수 없어요. 최신 내용을 불러와 주세요.',409);
  const scene=records(p.studio?.scenes).find(item=>item.id===dataset.id);
  if(!scene||Number(dataset.revision)!==scene.revision||Number(dataset.projectRevision)!==p.revision)throw new PulseError('장면이나 프로젝트가 바뀌었어요. 최신 내용을 살펴본 뒤 다시 확인해 주세요.',409);
  if(dataset.requestId){const request=requestItems(s).find(item=>item.id===dataset.requestId&&item.sceneId===scene.id);if(!request||!currentWaiting(request,scene))throw new PulseError('이 수정 요청의 확인 상태가 바뀌었어요. 최신 내용을 불러와 주세요.',409);}
  return {sceneId:scene.id,sceneRevision:scene.revision,status:'confirmed',text:''};
}
