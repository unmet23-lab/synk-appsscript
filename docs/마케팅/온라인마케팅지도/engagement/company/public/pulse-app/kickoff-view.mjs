import {esc,safeUrl,PulseError} from './api.mjs';

const sourceKinds=new Set(['asset','reference','strategy']);
const sourceLabels={asset:'올린 파일',reference:'참고자료',strategy:'제작 설계'};
const statuses={missing:'자료가 없어요',received:'받았어요',ready:'쓸 수 있어요',waived:'이번에는 안 써요'};
const sourcesOf=kickoff=>(kickoff?.sources||[]).filter(source=>sourceKinds.has(source.kind));
const button=(label,action)=>`<button type="button" class="button quiet small-button" data-action="${action}">${label}</button>`;

export function kickoffView(s){
  const p=s.project,k=p?.kickoff;if(!k?.enabled)return '';
  const sources=sourcesOf(k),canSubmit=s.mode==='customer'&&!s.demo&&p.stage!=='archived'&&k.status!=='archived';
  const ready=k.status==='ready',archived=k.status==='archived'||p.stage==='archived';
  const requirements=(k.requirements||[]).map(requirement=>{
    const source=sources.find(item=>item.key===requirement.sourceKey),url=source?.url?safeUrl(source.url):'';
    const selector=canSubmit&&requirement.status!=='waived'?`<form data-form="kickoff-source" data-id="${esc(requirement.id)}" data-revision="${esc(p.revision)}"><label class="field">${esc(requirement.label)}에 쓸 자료<select name="sourceKey" required ${sources.length?'':'disabled'}><option value="">올린 자료 중에서 고르기</option>${sources.map(item=>`<option value="${esc(item.key)}">${esc(sourceLabels[item.kind])} · ${esc(item.label)}</option>`).join('')}</select></label><button type="submit" class="button ${requirement.status==='ready'?'':'primary'}" data-mutate ${sources.length?'':'disabled'}>이 자료 보내기</button><p class="small">${requirement.status==='ready'?'다른 자료를 보내면 담당자가 다시 확인해요.':'보내면 「받았어요」로 바뀌고, 담당자가 확인하면 「쓸 수 있어요」가 돼요.'}</p></form>`:'';
    return `<article class="kickoff-requirement"><div class="kickoff-item-heading"><h4>${esc(requirement.label)} <span class="small">${requirement.required?'필수':'선택'}</span></h4><span class="tag ${requirement.status==='ready'?'green':requirement.status==='received'?'berry':''}">${esc(statuses[requirement.status]||'자료가 없어요')}</span></div>${requirement.sourceLabel?`<p class="kickoff-source-name">연결한 자료 · ${esc(requirement.sourceLabel)}${url?` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">자료 열기 ↗</a>`:''}</p>`:''}${requirement.status==='ready'&&selector?`<details class="kickoff-replace"><summary>자료 바꾸기</summary>${selector}</details>`:selector}</article>`;
  }).join('');
  const checks=(k.checks||[]).map(check=>`<li><span class="tag ${check.status==='ready'?'green':''}">${check.status==='ready'?'확인 완료':'확인 필요'}</span><div><strong>${esc(check.label)}</strong><p>${esc(check.text)}</p></div></li>`).join('');
  return `<section class="kickoff-card panel-card" aria-labelledby="kickoff-title"><div class="kickoff-heading"><div><span class="eyebrow ko">제작 전 준비</span><h3 id="kickoff-title">제작 전에 챙길 자료</h3></div><span class="tag ${ready?'green':'berry'}">${esc(k.statusLabel|| (ready?'제작 준비 완료':'준비 확인 중'))}</span></div><p class="kickoff-intro">${archived?'보관된 프로젝트의 준비 기록이에요.':ready?'필요한 자료와 정할 것을 모두 확인했어요. 정한 일정대로 만들어요.':'아래 자료를 보내 주세요. 받으면 담당자가 제작에 쓸 수 있는지 확인해요.'}</p><dl class="kickoff-dates"><div><dt>자료 확인일</dt><dd>${esc(k.dueDate||'담당자와 정하는 중')}</dd></div><div><dt>희망 전달일</dt><dd>${esc(k.requestedDeadline||'아직 없음')}</dd></div><div><dt>정한 전달일</dt><dd>${esc(k.confirmedDeadline||'아직 정하지 않았어요')}</dd></div></dl>${checks?`<ul class="kickoff-checks" aria-label="정할 것 확인">${checks}</ul>`:''}<div class="kickoff-requirements">${requirements||'<p class="small">챙길 자료가 없어요.</p>'}</div>${canSubmit?`<div class="kickoff-help"><p>새 이미지나 링크는 취향 보드에 먼저 올린 뒤 여기서 골라 주세요. 문구는 제작 설계에 저장한 내용도 고를 수 있어요.</p><div class="button-row">${button('이미지·참고 링크 추가','kickoff-reference')}${button('제작 설계에 문구 쓰기','kickoff-strategy')}</div><p class="small">이미지는 PNG·JPEG로 올릴 수 있어요. 다른 파일은 담당자도 열 수 있는 링크로 보내 주세요.</p></div>`:''}${s.mode==='staff'?`<p class="small">자료가 왔는지, 쓸 수 있는지는 작업실 고객 관리에서 확인해요.</p><a class="button quiet small-button" href="/?tab=workroom&amp;section=clients&amp;project=${encodeURIComponent(p.id)}&amp;kickoff=1" target="_blank" rel="noopener noreferrer">고객 관리에서 준비 확인 ↗</a>`:''}</section>`;
}

export function kickoffSubmission(s,dataset,sourceKey){
  const p=s.project,k=p?.kickoff;
  if(s.mode!=='customer'||s.demo||!k?.enabled||p.stage==='archived'||k.status==='archived')throw new PulseError('지금은 자료를 보낼 수 없어요. 최신 내용을 불러와 주세요.');
  if(Number(dataset.revision)!==p.revision)throw new PulseError('준비할 자료가 바뀌었어요. 최신 내용을 불러온 뒤 다시 골라 주세요.',409);
  const requirement=k.requirements?.find(item=>item.id===dataset.id);
  if(!requirement||requirement.status==='waived')throw new PulseError('이 준비 항목이 바뀌었어요. 최신 내용을 불러와 주세요.',409);
  if(!sourceKey||!sourcesOf(k).some(item=>item.key===sourceKey))throw new PulseError('올린 자료 중에서 골라 주세요. 새 자료는 취향 보드나 제작 설계에 먼저 올려 주세요.');
  if(requirement.sourceKey===sourceKey)throw new PulseError('이미 이 항목에 보낸 자료예요. 다른 자료로 바꿀 때만 다시 보내 주세요.');
  return {action:'submit_kickoff_source',revision:p.revision,requirementId:requirement.id,sourceKey};
}
