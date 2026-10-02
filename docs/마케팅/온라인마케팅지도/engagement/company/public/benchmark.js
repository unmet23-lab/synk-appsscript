'use strict';

// Shared research is uploaded by an administrator. Browsing and planning are local.
const bm = {issue:null,request:0,edit:0,raw:'',preview:null};
const bmPlatforms = {instagram:'Instagram',youtube:'YouTube',tiktok:'TikTok',facebook:'Facebook'};
const bmMetricLabels = {views:'조회',likes:'좋아요',comments:'댓글',shares:'공유',saves:'저장',followers:'계정 팔로워'};
const cpPersonalizationFields = [
  ['situation','시청자의 구체적인 상황','예: AI를 처음 써 보며, 긴 회의 메모에서 다음 할 일을 찾기 어려운 팀원'],
  ['choice','상황에 맞춰 고를 수 있는 도움','예: 급하면 3줄 요약, 일을 넘겨야 한다면 담당자·기한 표를 선택'],
  ['nextStep','보고 나서 할 수 있는 다음 행동','예: 내 회의 메모 1개에 맞는 양식을 골라 적용하고 원문과 대조']
];
function bmReset(){bm.request++;bm.edit++;bm.issue=null;bm.raw='';bm.preview=null;}
function bmDateText(value){if(!value)return '미확인';const day=String(value).length===10?String(value):new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));return day.replaceAll('-','.');}
function bmDate(value){return escape(bmDateText(value));}
function bmCurrent(){return bm.issue||cp.data?.benchmark?.current;}
function bmBenchmarks(){
  const issue=bmCurrent(),history=cp.data?.benchmark?.history||[];
  return `<section class="bm-desk"><div class="cp-section-heading"><div><h2>팀 벤치마크</h2><p>조사하고 고른 콘텐츠의 구성과 반응을 살펴보세요.</p></div><div class="bm-actions">${history.length?`<label class="bm-history"><span class="sr-only">조사 보고서 선택</span><select data-bm-history>${history.map(row=>cpOption(row.id,`${bmDateText(row.researchedAt||row.publishedAt)} · ${row.title}`,issue?.id)).join('')}</select></label>`:''}${isAdmin()?cpButton('조사 자료 등록','bm-import','plus','primary'):''}</div></div>${issue?bmIssue(issue):empty('등록된 조사 자료가 없어요','관리자가 원문과 반응을 확인한 자료를 공유하면 함께 볼 수 있어요.','',true,'bookmark')}</section>`;
}
function bmIssue(issue,preview=false){
  return `<section class="bm-issue"><div class="bm-issue-meta"><span class="status-badge ${issue.stale?'warning':'good'}">${preview?'공유 전 미리보기':issue.stale?'새 조사 권장':'등록된 조사 자료'}</span><span>조사 ${bmDate(issue.researchedAt)}</span><span>${number(issue.candidateCount)}개 후보 중 ${issue.items.length}개 선정</span>${!preview&&issue.publishedByName?`<span>${escape(issue.publishedByName)} 등록</span>`:''}</div><h4>${escape(issue.title)}</h4><p class="bm-scope">${escape(issue.scope)}</p><details class="bm-method"><summary>선정 범위와 근거 보기 <span>${bmDate(issue.periodStart)} — ${bmDate(issue.periodEnd)}</span></summary><p>${escape(issue.selectionBasis)}</p><p>수치는 원문을 확인해 보고서에 기록한 관찰값입니다. 서로 다른 플랫폼·게시 경과일·계정 크기의 수치를 같은 조건처럼 비교하지 않아요.</p></details>${issue.stale?'<p class="bm-stale" role="status">조사 후 7일 이상 지났어요. 형식은 참고할 수 있지만 최근 반응은 새로 확인해 주세요.</p>':''}${issue.items.length<5?`<p class="bm-shortlist">확인 가능한 ${issue.items.length}개 사례를 보여드립니다. 미확인 자료로 수를 채우지 않아요.</p>`:''}<div class="bm-cards">${issue.items.map((item,index)=>bmCard(item,issue,preview,index)).join('')}</div></section>`;
}
function bmCard(item,issue,preview,index){
  const metrics=Object.entries(bmMetricLabels).map(([key,label])=>`<div><dt>${label}</dt><dd>${item.metrics?.[key]===null||item.metrics?.[key]===undefined?'—':number(item.metrics[key])}</dd></div>`).join('');
  return `<article class="bm-card"><div class="bm-card-top"><span class="bm-rank">${String(item.rank||index+1).padStart(2,'0')}</span><div><div class="bm-item-meta"><span>${escape(bmPlatforms[item.platform]||item.platform)}</span><span>${escape(item.creator)}</span></div><h4><a href="${escape(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${escape(item.title)}${icon('external')}</a></h4><p>게시 ${bmDate(item.publishedAt)} · 관찰 ${bmDate(item.checkedAt)}</p></div></div><dl class="bm-metrics">${metrics}</dl><p class="bm-evidence"><span>반응 근거</span>${escape(item.evidenceNote)}</p><div class="bm-format">${[['hook','시선을 잡는 도입'],['structure','끝까지 보는 전개'],['payoff','보고 나서 얻는 것']].map(([key,label])=>`<div><span>${label}</span><p>${escape(item[key])}</p></div>`).join('')}</div><details class="bm-adaptation"><summary>우리 콘텐츠로 바꾸는 힌트</summary><h5>우리 방향과 맞는 점</h5><p>${escape(item.brandFit)}</p><h5>제작에 적용하기</h5><p>${escape(item.adaptation)}</p></details><div class="bm-card-bottom"><span>— 는 공개 수치 미확인</span>${!preview&&!isViewer()?cpButton('이 구조로 기획하기','bm-use','arrow','small',`data-issue="${escape(issue.id)}" data-id="${escape(item.id)}"`):''}</div></article>`;
}
function bmSelection(){
  if(!cp.input.benchmarkId)return '';
  const issue=[bm.issue,cp.data?.benchmark?.current].find(row=>row?.id===cp.input.benchmarkId),item=issue?.items.find(row=>row.id===cp.input.benchmarkItemId);
  return `<div class="bm-selection"><div><span class="cp-overline">SELECTED REFERENCE</span><strong>${escape(item?.title||cp.input.reference?.title||'저장된 벤치마크 자료')}</strong><p>참고 영상의 구조를 빌려, 아래에 내 소재와 실제 경험을 적어 주세요.</p></div>${cpButton('선택 해제','bm-clear','','quiet small')}<input type="hidden" name="benchmarkId" value="${escape(cp.input.benchmarkId)}"><input type="hidden" name="benchmarkItemId" value="${escape(cp.input.benchmarkItemId)}"></div>`;
}
function cpPersonalizationInput(){
  return `<details class="cp-auth-input bm-personalization"><summary><span>시청자에 맞게 다듬기</span><small>누구에게, 어떤 도움이 맞을까요?</small></summary><p>이름을 넣는 것보다, 각자의 목표와 상황에 맞는 도움을 주는 것이 중요해요. 개인의 민감한 정보는 적지 않아도 됩니다.</p><div class="bm-personal-fields">${cpPersonalizationFields.map(([id,label,hint])=>`<label class="field">${label}<textarea name="person-${id}" maxlength="2000" rows="2" data-cp-input placeholder="${hint}">${escape(cp.input.personalization?.[id]||'')}</textarea></label>`).join('')}</div></details>`;
}
function cpReviewAxes(plan){
  if(!plan.reviewAxes?.length)return '';
  return `<section class="bm-review"><div class="bm-heading"><div><span class="cp-overline">CREATIVE REVIEW</span><h3>좋은 기획을 위한 네 가지 질문</h3><p>빈 부분을 찾고 검토할 질문을 제안합니다. 점수나 통과 판정은 하지 않아요.</p></div></div><div class="bm-axes">${plan.reviewAxes.map((axis,index)=>`<details class="bm-axis ${axis.status==='needs-input'?'needs-input':''}"><summary><span>${String(index+1).padStart(2,'0')}</span><strong>${escape(axis.label)}</strong><em>${axis.status==='needs-input'?'보완 필요':'직접 검토'}</em></summary><p>${escape(axis.reason)}</p>${axis.evidence?.length?`<h4>작성한 근거</h4>${cpList(axis.evidence)}`:''}${cpList(axis.questions)}<div class="bm-next"><strong>다음 행동</strong><p>${escape(axis.nextAction)}</p></div></details>`).join('')}</div></section>`;
}
function bmImportModal(){
  bm.edit++;bm.preview=null;bm.raw='';
  modal('우리 팀의 다음 벤치마크','Gemini에서 조사하고, 여기에서 함께 활용하세요.',`<div class="bm-import"><div class="bm-import-steps"><span><b>1</b>조사 지시문 복사</span><span><b>2</b>Gemini에서 조사</span><span><b>3</b>검토 후 공유</span></div><div class="bm-import-tools">${cpButton('Gemini 조사 지시문 복사','bm-prompt','bookmark')}${cpButton('JSON 양식 내려받기','bm-template','download','quiet')}<a class="btn quiet" href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">Gemini 열기${icon('external')}</a></div><p class="cp-review-note">유호님의 Google AI Pro 계정에서 직접 조사해 주세요. 계정 연결 없이 결과 파일만 회사에 등록합니다. 크루에게 계정이나 로그인 정보를 공유할 필요가 없어요.</p><form data-bm-form="preview" class="form-stack"><div class="form-error" role="alert"></div><label class="field bm-file">조사한 JSON 파일<input type="file" accept=".json,application/json" data-bm-file><small>최대 100 KB. 파일을 고르거나 아래에 JSON 내용을 붙여 넣으세요.</small></label><label class="field">조사 결과 JSON<textarea name="report" required rows="7" maxlength="100000" spellcheck="false" placeholder='{"version":1,"title":"이번 주 참고 콘텐츠",…}'></textarea></label><button type="submit" class="btn primary">내용 검사하고 미리보기${icon('arrow')}</button></form><div id="bm-preview" aria-live="polite"></div></div>`,true);
}
function bmDownload(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bmPreviewPanel(){
  const {report,warnings=[]}=bm.preview;
  return `<div class="bm-preview-panel">${warnings.length?`<div class="bm-stale">${cpList(warnings)}</div>`:''}<p class="cp-review-note">형식 검사만 완료했습니다. 날짜·출처·반응 수치의 사실 여부는 관리자가 원문과 대조해 주세요.</p>${bmIssue(report,true)}<form data-bm-form="publish" class="bm-publish"><div class="form-error" role="alert"></div><label class="cp-consent"><input type="checkbox" name="reviewConfirmed" required>원문, 게시일, 관찰 수치와 조사 범위를 확인했습니다. 이 자료를 회사 크루에게 공유합니다.</label><button class="btn primary" type="submit">검토한 자료 회사에 공유${icon('check')}</button><p class="cp-review-note">이전 보고서는 조사 기록으로 보관됩니다.</p></form></div>`;
}
document.addEventListener('input',event=>{if(event.target.matches('[data-bm-form="preview"] [name="report"]')){bm.edit++;bm.raw=event.target.value;bm.preview=null;const box=document.querySelector('#bm-preview');if(box)box.innerHTML='';}});
document.addEventListener('change',async event=>{
  const target=event.target,userId=state.user?.id;
  try{
    if(target.matches('[data-bm-file]')){const file=target.files?.[0];if(!file)return;const edit=++bm.edit;bm.preview=null;document.querySelector('#bm-preview').innerHTML='';if(file.size>100000)throw new Error('100 KB 이하의 JSON 파일을 올려 주세요.');const raw=await file.text();if(state.user?.id!==userId||!target.isConnected||edit!==bm.edit)return;bm.raw=raw;document.querySelector('[data-bm-form="preview"] [name="report"]').value=raw;}
    if(target.matches('[data-bm-history]')){target.disabled=true;const request=++bm.request,result=await api('/api/content-benchmarks/'+encodeURIComponent(target.value));if(state.user?.id!==userId||request!==bm.request)return;bm.issue=result.issue;render();}
  }catch(error){notify(error.message);if(target.isConnected)target.disabled=false;}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action^="cp-bm-"]');if(!target||target.disabled)return;
  const action=target.dataset.action.slice(6),userId=state.user?.id;
  try{
    if(action==='import')bmImportModal();
    else if(action==='prompt'){target.disabled=true;const result=await api('/api/content-benchmarks/research-prompt');if(state.user?.id!==userId)return;try{await navigator.clipboard.writeText(result.prompt);notify('조사 지시문을 복사했어요. Gemini에 붙여 넣어 주세요.');}catch{bmDownload('SYNK-Gemini-조사지시문.txt',result.prompt,'text/plain;charset=utf-8');notify('지시문을 파일로 내려받았어요.');}}
    else if(action==='template'){target.disabled=true;const result=await api('/api/content-benchmarks/template');if(state.user?.id!==userId)return;bmDownload('SYNK-벤치마크-작성양식.json',JSON.stringify(result.template,null,2),'application/json');}
    else if(action==='use'){const issue=bmCurrent(),item=issue?.items.find(row=>row.id===target.dataset.id);if(!item||issue.id!==target.dataset.issue)return;cp.input.benchmarkId=issue.id;cp.input.benchmarkItemId=item.id;cp.input.referenceId='';if(item.seriesIds?.length&&cpSeries(item.seriesIds[0]))cp.input.seriesId=item.seriesIds[0];cp.draftId='';cp.ideaId='';cp.view='plan';render();window.scrollTo(0,0);}
    else if(action==='clear'){cp.input.benchmarkId='';cp.input.benchmarkItemId='';render();}
  }catch(error){notify(error.message);}finally{if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-bm-form]');if(!form)return;event.preventDefault();const submit=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),userId=state.user?.id;if(submit.disabled)return;submit.disabled=true;errorBox.textContent='';
  try{
    if(form.dataset.bmForm==='preview'){bm.raw=new FormData(form).get('report');bm.preview=null;const edit=++bm.edit;document.querySelector('#bm-preview').innerHTML='';const result=await api('/api/content-benchmarks/preview',{report:bm.raw});if(state.user?.id!==userId||!form.isConnected||edit!==bm.edit)return;bm.preview=result;document.querySelector('#bm-preview').innerHTML=bmPreviewPanel();document.querySelector('#bm-preview').scrollIntoView({block:'start',behavior:'smooth'});}
    else if(form.dataset.bmForm==='publish'){if(!bm.preview)throw new Error('수정한 자료를 다시 미리보기해 주세요.');await api('/api/content-benchmarks',{report:bm.preview.report,reviewConfirmed:true});if(state.user?.id!==userId)return;const sameForm=form.isConnected;bm.issue=null;if(sameForm){closeModal();cp.view='examples';cp.exampleView='benchmarks';}await loadContentWorkspace();if(state.user?.id!==userId)return;if(sameForm&&state.tab==='content')render();notify('검토한 참고 자료를 팀에 공유했어요.');}
  }catch(error){if(errorBox.isConnected)errorBox.textContent=error.message;else notify(error.message);}finally{if(submit.isConnected)submit.disabled=false;}
});
