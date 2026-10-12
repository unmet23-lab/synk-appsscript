import {esc,safeUrl,PulseError} from './api.mjs';

const sourceKinds=new Set(['asset','reference','strategy']);
const sourceLabels={asset:'올린 파일',reference:'참고자료',strategy:'제작 설계'};
const statuses={missing:'자료 대기',received:'도착 · 담당자 확인 대기',ready:'사용 가능',waived:'이번 제작에서 제외'};
const sourcesOf=kickoff=>(kickoff?.sources||[]).filter(source=>sourceKinds.has(source.kind));
const button=(label,action)=>`<button type="button" class="button quiet small-button" data-action="${action}">${label}</button>`;

export function kickoffView(s){
  const p=s.project,k=p?.kickoff;if(!k?.enabled)return '';
  const sources=sourcesOf(k),canSubmit=s.mode==='customer'&&!s.demo&&p.stage!=='archived'&&k.status!=='archived';
  const ready=k.status==='ready',archived=k.status==='archived'||p.stage==='archived';
  const requirements=(k.requirements||[]).map(requirement=>{
    const source=sources.find(item=>item.key===requirement.sourceKey),url=source?.url?safeUrl(source.url):'';
    const selector=canSubmit&&requirement.status!=='waived'?`<form data-form="kickoff-source" data-id="${esc(requirement.id)}" data-revision="${esc(p.revision)}"><label class="field">${esc(requirement.label)}에 사용할 자료<select name="sourceKey" required ${sources.length?'':'disabled'}><option value="">공유한 자료 선택</option>${sources.map(item=>`<option value="${esc(item.key)}">${esc(sourceLabels[item.kind])} · ${esc(item.label)}</option>`).join('')}</select></label><button type="submit" class="button ${requirement.status==='ready'?'':'primary'}" data-mutate ${sources.length?'':'disabled'}>이 자료로 제출</button><p class="small">${requirement.status==='ready'?'다른 자료를 제출하면 담당자가 새 자료의 사용 가능 여부를 다시 확인합니다.':'제출하면 도착으로 표시되고, 담당자가 내용을 확인한 뒤 사용 가능으로 바뀝니다.'}</p></form>`:'';
    return `<article class="kickoff-requirement"><div class="kickoff-item-heading"><h4>${esc(requirement.label)} <span class="small">${requirement.required?'필수':'선택'}</span></h4><span class="tag ${requirement.status==='ready'?'green':requirement.status==='received'?'berry':''}">${esc(statuses[requirement.status]||'자료 대기')}</span></div>${requirement.sourceLabel?`<p class="kickoff-source-name">연결한 자료 · ${esc(requirement.sourceLabel)}${url?` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">자료 열기 ↗</a>`:''}</p>`:''}${requirement.status==='ready'&&selector?`<details class="kickoff-replace"><summary>자료 바꾸기</summary>${selector}</details>`:selector}</article>`;
  }).join('');
  const checks=(k.checks||[]).map(check=>`<li><span class="tag ${check.status==='ready'?'green':''}">${check.status==='ready'?'확인 완료':'확인 필요'}</span><div><strong>${esc(check.label)}</strong><p>${esc(check.text)}</p></div></li>`).join('');
  return `<section class="kickoff-card panel-card" aria-labelledby="kickoff-title"><div class="kickoff-heading"><div><span class="eyebrow">BEFORE PRODUCTION</span><h3 id="kickoff-title">제작 시작 전 준비</h3></div><span class="tag ${ready?'green':'berry'}">${esc(k.statusLabel|| (ready?'제작 준비 완료':'준비 확인 중'))}</span></div><p class="kickoff-intro">${archived?'보관된 프로젝트의 준비 기록입니다.':ready?'필수 자료와 확정사항을 확인했어요. 제작 일정은 담당자와 정한 내용을 따라 진행합니다.':'필요한 자료와 함께 정할 내용을 확인해 주세요. 자료가 도착하면 담당자가 제작에 사용할 수 있는지 확인합니다.'}</p><dl class="kickoff-dates"><div><dt>준비 확인일</dt><dd>${esc(k.dueDate||'담당자와 협의 중')}</dd></div><div><dt>희망 전달일</dt><dd>${esc(k.requestedDeadline||'아직 미정')}</dd></div><div><dt>확정 전달일</dt><dd>${esc(k.confirmedDeadline||'아직 미확정')}</dd></div></dl>${checks?`<ul class="kickoff-checks" aria-label="확정사항 확인">${checks}</ul>`:''}<div class="kickoff-requirements">${requirements||'<p class="small">등록된 준비 자료가 없습니다.</p>'}</div>${canSubmit?`<div class="kickoff-help"><p>새 이미지나 참고 링크는 취향 보드에 먼저 공유한 뒤, 이곳에서 필요한 항목에 연결해 주세요. 문구는 제작 설계에 저장한 내용도 선택할 수 있어요.</p><div class="button-row">${button('이미지·참고 링크 추가','kickoff-reference')}${button('제작 설계·문구 입력','kickoff-strategy')}</div><p class="small">이미지 업로드는 PNG·JPEG를 지원합니다. 그 외 원본 파일은 고객과 담당자가 열 수 있는 참고 링크로 공유해 주세요.</p></div>`:''}${s.mode==='staff'?`<p class="small">자료 도착과 사용 가능 여부는 기존 작업실에서 확인합니다.</p><a class="button quiet small-button" href="/?tab=workroom&amp;section=clients&amp;project=${encodeURIComponent(p.id)}&amp;kickoff=1" target="_blank" rel="noopener noreferrer">고객 관리에서 준비 확인 ↗</a>`:''}</section>`;
}

export function kickoffSubmission(s,dataset,sourceKey){
  const p=s.project,k=p?.kickoff;
  if(s.mode!=='customer'||s.demo||!k?.enabled||p.stage==='archived'||k.status==='archived')throw new PulseError('지금은 준비 자료를 제출할 수 없어요. 최신 내용을 불러와 주세요.');
  if(Number(dataset.revision)!==p.revision)throw new PulseError('준비 내용이 바뀌었어요. 최신 내용을 불러온 뒤 선택한 자료를 확인해 주세요.',409);
  const requirement=k.requirements?.find(item=>item.id===dataset.id);
  if(!requirement||requirement.status==='waived')throw new PulseError('이 준비 항목이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
  if(!sourceKey||!sourcesOf(k).some(item=>item.key===sourceKey))throw new PulseError('현재 공유된 자료를 선택해 주세요. 새 자료는 취향 보드나 제작 설계에 먼저 저장할 수 있어요.');
  if(requirement.sourceKey===sourceKey)throw new PulseError('이미 이 항목에 연결된 자료예요. 다른 자료로 바꿀 때만 새로 제출해 주세요.');
  return {action:'submit_kickoff_source',revision:p.revision,requirementId:requirement.id,sourceKey};
}
