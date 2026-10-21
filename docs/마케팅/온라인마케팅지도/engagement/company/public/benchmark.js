'use strict';

// Shared research is uploaded by an administrator. Browsing and planning are local.
const bm = {issue:null,request:0,edit:0,raw:'',preview:null};
const bmPlatforms = {instagram:'Instagram',youtube:'YouTube',tiktok:'TikTok',facebook:'Facebook'};
const bmMetricLabels = {views:'조회',likes:'좋아요',comments:'댓글',shares:'공유',saves:'저장',followers:'계정 팔로워'};
const cpPersonalizationFields = [
  ['situation','보는 사람의 상황','예: AI를 처음 써 보는데, 긴 회의 메모에서 할 일을 못 찾는 팀원'],
  ['choice','상황마다 고를 수 있는 도움','예: 급하면 3줄 요약, 일을 넘겨야 하면 담당자·기한 표'],
  ['nextStep','보고 나서 바로 할 일','예: 내 회의 메모 하나에 맞는 양식을 골라 써 보고 원문과 견주기']
];
function bmReset(){bm.request++;bm.edit++;bm.issue=null;bm.raw='';bm.preview=null;}
function bmDateText(value){if(!value)return '날짜 모름';const day=String(value).length===10?String(value):new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));return day.replaceAll('-','.');}
function bmDate(value){return escape(bmDateText(value));}
function bmCurrent(){return bm.issue||cp.data?.benchmark?.current;}
function bmBenchmarks(){
  const issue=bmCurrent(),history=cp.data?.benchmark?.history||[];
  return `<section class="bm-desk"><div class="cp-section-heading"><div><h2>팀 벤치마크</h2><p>조사해서 고른 콘텐츠가 어떻게 짜였고 반응이 어땠는지 봐요.</p></div><div class="bm-actions">${history.length?`<label class="bm-history"><span class="sr-only">조사 자료 고르기</span><select data-bm-history>${history.map(row=>cpOption(row.id,`${bmDateText(row.researchedAt||row.publishedAt)} · ${row.title}`,issue?.id)).join('')}</select></label>`:''}${isAdmin()?cpButton('조사 자료 올리기','bm-import','plus','primary'):''}</div></div>${issue?bmIssue(issue):empty('아직 조사 자료가 없어요','관리자가 원문과 반응을 확인한 자료를 올리면 여기서 같이 봐요.','',true,'bookmark')}</section>`;
}
function bmIssue(issue,preview=false){
  return `<section class="bm-issue"><div class="bm-issue-meta"><span class="status-badge ${issue.stale?'warning':'good'}">${preview?'공유 전 미리 보기':issue.stale?'다시 조사해야 함':'올린 조사 자료'}</span><span>조사 ${bmDate(issue.researchedAt)}</span><span>${number(issue.candidateCount)}개 후보 가운데 ${issue.items.length}개 고름</span>${!preview&&issue.publishedByName?`<span>${escape(issue.publishedByName)} 올림</span>`:''}</div><h4>${escape(issue.title)}</h4><p class="bm-scope">${escape(issue.scope)}</p><details class="bm-method"><summary>고른 범위와 근거 <span>${bmDate(issue.periodStart)} — ${bmDate(issue.periodEnd)}</span></summary><p>${escape(issue.selectionBasis)}</p><p>수치는 조사할 때 원문에서 본 값이에요. 플랫폼, 게시하고 지난 날, 계정 크기가 다른 수치를 같은 조건처럼 견주지 않아요.</p></details>${issue.stale?'<p class="bm-stale" role="status">조사한 지 7일이 넘었어요. 짜임은 참고해도 되지만 반응 수치는 새로 봐 주세요.</p>':''}${issue.items.length<5?`<p class="bm-shortlist">확인한 사례 ${issue.items.length}개만 보여 드려요. 확인하지 않은 자료로 수를 채우지 않아요.</p>`:''}<div class="bm-cards">${issue.items.map((item,index)=>bmCard(item,issue,preview,index)).join('')}</div></section>`;
}
function bmCard(item,issue,preview,index){
  const metrics=Object.entries(bmMetricLabels).map(([key,label])=>`<div><dt>${label}</dt><dd>${item.metrics?.[key]===null||item.metrics?.[key]===undefined?'—':number(item.metrics[key])}</dd></div>`).join('');
  return `<article class="bm-card"><div class="bm-card-top"><span class="bm-rank">${String(item.rank||index+1).padStart(2,'0')}</span><div><div class="bm-item-meta"><span>${escape(bmPlatforms[item.platform]||item.platform)}</span><span>${escape(item.creator)}</span></div><h4><a href="${escape(safeUrl(item.url))}" target="_blank" rel="noopener noreferrer">${escape(item.title)}${icon('external')}</a></h4><p>게시 ${bmDate(item.publishedAt)} · 확인 ${bmDate(item.checkedAt)}</p></div></div><dl class="bm-metrics">${metrics}</dl><p class="bm-evidence"><span>반응 근거</span>${escape(item.evidenceNote)}</p><div class="bm-format">${[['hook','시선을 잡는 도입'],['structure','끝까지 보는 전개'],['payoff','보고 나서 얻는 것']].map(([key,label])=>`<div><span>${label}</span><p>${escape(item[key])}</p></div>`).join('')}</div><details class="bm-adaptation"><summary>우리 콘텐츠로 가져오려면</summary><h5>우리 방향과 맞는 점</h5><p>${escape(item.brandFit)}</p><h5>만들 때 적용할 점</h5><p>${escape(item.adaptation)}</p></details><div class="bm-card-bottom"><span>—는 확인하지 못한 공개 수치예요</span>${!preview&&!isViewer()?cpButton('이 구조로 기획하기','bm-use','arrow','small',`data-issue="${escape(issue.id)}" data-id="${escape(item.id)}"`):''}</div></article>`;
}
function bmSelection(){
  if(!cp.input.benchmarkId)return '';
  const issue=[bm.issue,cp.data?.benchmark?.current].find(row=>row?.id===cp.input.benchmarkId),item=issue?.items.find(row=>row.id===cp.input.benchmarkItemId);
  return `<div class="bm-selection"><div><span class="cp-overline">고른 벤치마크</span><strong>${escape(item?.title||cp.input.reference?.title||'저장된 벤치마크 자료')}</strong><p>참고 영상의 짜임을 빌려, 아래에 내 소재와 실제 경험을 적어 주세요.</p></div>${cpButton('선택 풀기','bm-clear','','quiet small')}<input type="hidden" name="benchmarkId" value="${escape(cp.input.benchmarkId)}"><input type="hidden" name="benchmarkItemId" value="${escape(cp.input.benchmarkItemId)}"></div>`;
}
function cpPersonalizationInput(){
  return `<details class="cp-auth-input bm-personalization"><summary><span>시청자에 맞게 다듬기</span><small>누구에게, 어떤 도움이 맞을까요?</small></summary><p>이름을 넣기보다 각자의 목표와 상황에 맞는 도움을 주는 게 중요해요. 민감한 개인 정보는 적지 않아도 돼요.</p><div class="bm-personal-fields">${cpPersonalizationFields.map(([id,label,hint])=>`<label class="field">${label}<textarea name="person-${id}" maxlength="2000" rows="2" data-cp-input placeholder="${hint}">${escape(cp.input.personalization?.[id]||'')}</textarea></label>`).join('')}</div></details>`;
}
function cpReviewAxes(plan){
  if(!plan.reviewAxes?.length)return '';
  return `<section class="bm-review"><div class="bm-heading"><div><span class="cp-overline">재미 · 도움 · 진정성 · 개인화</span><h3>좋은 기획을 위한 네 가지 질문</h3><p>빈 곳을 찾아 검토할 질문을 드려요. 점수를 매기거나 통과를 정하지는 않아요.</p></div></div><div class="bm-axes">${plan.reviewAxes.map((axis,index)=>`<details class="bm-axis ${axis.status==='needs-input'?'needs-input':''}"><summary><span>${String(index+1).padStart(2,'0')}</span><strong>${escape(axis.label)}</strong><em>${axis.status==='needs-input'?'채울 것 있음':'직접 볼 것'}</em></summary><p>${escape(axis.reason)}</p>${axis.evidence?.length?`<h4>적은 근거 · 확인 전</h4>${cpList(axis.evidence)}`:''}${cpList(axis.questions)}<div class="bm-next"><strong>다음에 할 일</strong><p>${escape(axis.nextAction)}</p></div></details>`).join('')}</div></section>`;
}
function bmImportModal(){
  bm.edit++;bm.preview=null;bm.raw='';
  modal('조사 자료 올리기','지시문을 조사 도구에 넣고, 나온 결과 파일을 여기에 올려요.',`<div class="bm-import"><div class="bm-import-steps"><span><b>1</b>조사 지시문 복사</span><span><b>2</b>조사 도구에 붙여 넣기</span><span><b>3</b>검토하고 크루에게 공유</span></div><div class="bm-import-tools">${cpButton('조사 지시문 복사','bm-prompt','bookmark')}${cpButton('결과 양식 내려받기','bm-template','download','quiet')}<a class="btn quiet" href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">조사 도구 열기${icon('external')}</a></div><p class="cp-review-note">조사는 관리자 계정에서 직접 하고, 결과 파일만 여기에 올려요. 크루에게 계정이나 로그인 정보를 나눌 필요가 없어요.</p><form data-bm-form="preview" class="form-stack"><div class="form-error" role="alert"></div><label class="field bm-file">조사 결과 파일(.json)<input type="file" accept=".json,application/json" data-bm-file><small>100KB까지예요. 파일을 고르거나 아래에 내용을 붙여 넣어 주세요.</small></label><label class="field">조사 결과 내용<textarea name="report" required rows="7" maxlength="100000" spellcheck="false" placeholder='{"version":1,"title":"이번 주 참고 콘텐츠",…}'></textarea></label><button type="submit" class="btn primary">검사하고 미리 보기${icon('arrow')}</button></form><div id="bm-preview" aria-live="polite"></div></div>`,true);
}
function bmDownload(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bmPreviewPanel(){
  const {report,warnings=[]}=bm.preview;
  return `<div class="bm-preview-panel">${warnings.length?`<div class="bm-stale">${cpList(warnings)}</div>`:''}<p class="cp-review-note">형식만 검사했어요. 날짜·출처·반응 수치가 맞는지는 원문과 직접 견줘 주세요.</p>${bmIssue(report,true)}<form data-bm-form="publish" class="bm-publish"><div class="form-error" role="alert"></div><label class="cp-consent"><input type="checkbox" name="reviewConfirmed" required>원문, 게시일, 수치, 조사 범위를 직접 확인했어요. 이 자료를 크루에게 공유해요.</label><button class="btn primary" type="submit">크루에게 공유${icon('check')}</button><p class="cp-review-note">전에 올린 자료는 조사 기록에 남아요.</p></form></div>`;
}
document.addEventListener('input',event=>{if(event.target.matches('[data-bm-form="preview"] [name="report"]')){bm.edit++;bm.raw=event.target.value;bm.preview=null;const box=document.querySelector('#bm-preview');if(box)box.innerHTML='';}});
document.addEventListener('change',async event=>{
  const target=event.target,userId=state.user?.id;
  try{
    if(target.matches('[data-bm-file]')){const file=target.files?.[0];if(!file)return;const edit=++bm.edit;bm.preview=null;document.querySelector('#bm-preview').innerHTML='';if(file.size>100000)throw new Error('파일이 100KB를 넘어요. 100KB 이하의 결과 파일(.json)을 올려 주세요.');const raw=await file.text();if(state.user?.id!==userId||!target.isConnected||edit!==bm.edit)return;bm.raw=raw;document.querySelector('[data-bm-form="preview"] [name="report"]').value=raw;}
    if(target.matches('[data-bm-history]')){target.disabled=true;const request=++bm.request,result=await api('/api/content-benchmarks/'+encodeURIComponent(target.value));if(state.user?.id!==userId||request!==bm.request)return;bm.issue=result.issue;render();}
  }catch(error){notify(error.message);if(target.isConnected)target.disabled=false;}
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action^="cp-bm-"]');if(!target||target.disabled)return;
  const action=target.dataset.action.slice(6),userId=state.user?.id;
  try{
    if(action==='import')bmImportModal();
    else if(action==='prompt'){target.disabled=true;const result=await api('/api/content-benchmarks/research-prompt');if(state.user?.id!==userId)return;try{await navigator.clipboard.writeText(result.prompt);notify('조사 지시문을 복사했어요. 조사 도구에 붙여 넣어 주세요.');}catch{bmDownload('SYNK-조사지시문.txt',result.prompt,'text/plain;charset=utf-8');notify('지시문을 파일로 내려받았어요.');}}
    else if(action==='template'){target.disabled=true;const result=await api('/api/content-benchmarks/template');if(state.user?.id!==userId)return;bmDownload('SYNK-벤치마크-작성양식.json',JSON.stringify(result.template,null,2),'application/json');}
    else if(action==='use'){const issue=bmCurrent(),item=issue?.items.find(row=>row.id===target.dataset.id);if(!item||issue.id!==target.dataset.issue)return;cp.input.benchmarkId=issue.id;cp.input.benchmarkItemId=item.id;cp.input.referenceId='';if(item.seriesIds?.length&&cpSeries(item.seriesIds[0]))cp.input.seriesId=item.seriesIds[0];cp.draftId='';cp.ideaId='';cp.view='plan';render();window.scrollTo(0,0);}
    else if(action==='clear'){cp.input.benchmarkId='';cp.input.benchmarkItemId='';render();}
  }catch(error){notify(error.message);}finally{if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-bm-form]');if(!form)return;event.preventDefault();const submit=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),userId=state.user?.id;if(submit.disabled)return;submit.disabled=true;errorBox.textContent='';
  try{
    if(form.dataset.bmForm==='preview'){bm.raw=new FormData(form).get('report');bm.preview=null;const edit=++bm.edit;document.querySelector('#bm-preview').innerHTML='';const result=await api('/api/content-benchmarks/preview',{report:bm.raw});if(state.user?.id!==userId||!form.isConnected||edit!==bm.edit)return;bm.preview=result;document.querySelector('#bm-preview').innerHTML=bmPreviewPanel();document.querySelector('#bm-preview').scrollIntoView({block:'start',behavior:'smooth'});}
    else if(form.dataset.bmForm==='publish'){if(!bm.preview)throw new Error('내용을 고쳤으면 「검사하고 미리 보기」를 다시 눌러 주세요.');await api('/api/content-benchmarks',{report:bm.preview.report,reviewConfirmed:true});if(state.user?.id!==userId)return;const sameForm=form.isConnected;bm.issue=null;if(sameForm){closeModal();cp.view='examples';cp.exampleView='benchmarks';}await loadContentWorkspace();if(state.user?.id!==userId)return;if(sameForm&&state.tab==='content')render();notify('검토한 참고 자료를 팀에 공유했어요.');}
  }catch(error){if(errorBox.isConnected)errorBox.textContent=error.message;else notify(error.message);}finally{if(submit.isConnected)submit.disabled=false;}
});
