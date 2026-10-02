'use strict';

const creatorSources={userId:null,request:0,data:null,loading:false,error:'',attempted:false,category:'all',query:'',limit:6};
const creatorSourceCategories={logo:'로고',mascot:'마스코트',felt:'펠트 부품',font:'서체'};
function creatorSourcesReset(){Object.assign(creatorSources,{userId:null,request:creatorSources.request+1,data:null,loading:false,error:'',attempted:false,category:'all',query:'',limit:6});}
function creatorSourcesActive(){return state.user&&state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools';}
async function creatorSourcesEnsure(force=false){
  if(!creatorSourcesActive())return;
  if(creatorSources.userId!==state.user.id){creatorSourcesReset();creatorSources.userId=state.user.id;}
  if(creatorSources.loading||creatorSources.attempted&&!force)return;
  const userId=state.user.id,request=++creatorSources.request;
  creatorSources.loading=true;creatorSources.attempted=true;creatorSources.error='';
  try{
    const result=await api('/api/creator-sources');
    if(state.user?.id!==userId||creatorSources.userId!==userId||request!==creatorSources.request)return;
    creatorSources.data=result;
  }catch(error){if(state.user?.id===userId&&request===creatorSources.request)creatorSources.error=error.message||'제작 자료를 불러오지 못했어요.';}
  finally{if(state.user?.id===userId&&request===creatorSources.request){creatorSources.loading=false;if(creatorSourcesActive())render();}}
}
function creatorSourceButton(label,action,attrs='',style='small quiet'){return `<button type="button" class="btn ${style}" data-creator-source-action="${escape(action)}" ${attrs}>${escape(label)}</button>`;}
function creatorSourceBytes(value){if(!Number.isFinite(value))return '파일 미확인';return value<1024*1024?Math.max(1,Math.round(value/1024))+' KB':(value/(1024*1024)).toFixed(1)+' MB';}
function creatorSourceLocalUrl(value){return typeof value==='string'&&/^\/api\/creator-sources\/assets\/[a-z0-9-]+(?:\?download=1)?$/.test(value)?value:'#';}
function creatorSourceExternalUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'#';}catch{return '#';}}
function creatorSourcesFiltered(){
  const query=creatorSources.query.trim().toLocaleLowerCase();
  return (creatorSources.data?.assets||[]).filter(row=>(creatorSources.category==='all'||row.category===creatorSources.category)&&(!query||[row.title,row.variant,row.usage,row.fileName].join(' ').toLocaleLowerCase().includes(query)));
}
function creatorSourcePreview(row){
  if(!row.available)return '<p class="cs-unavailable">원본 파일 확인이 필요해요</p>';
  if(row.preview==='image')return `<img src="${escape(creatorSourceLocalUrl(row.previewUrl))}" alt="${escape(row.title)} 미리보기" loading="lazy" decoding="async">`;
  if(row.preview==='font')return `<p class="cs-font-sample cs-font-${escape(['hangul','latin','mono'].includes(row.sampleRole)?row.sampleRole:'hangul')}">${escape(row.sample||row.title)}</p>`;
  return '';
}
function creatorSourceCard(row){
  return `<article class="cs-card"><div class="cs-preview ${row.background==='dark'?'cs-preview-dark':''}">${creatorSourcePreview(row)}</div><div class="cs-card-body"><span class="cs-kind">${escape(creatorSourceCategories[row.category]||'제작 자료')} · ${escape(row.variant||'')}</span><h3>${escape(row.title)}</h3><p class="cs-use">${escape(row.usage)}</p><div class="cs-file-meta"><span>${escape(row.fileName)}</span><span>${creatorSourceBytes(row.byteSize)}</span></div><div class="cs-card-actions">${row.available?`<a class="btn small" href="${escape(creatorSourceLocalUrl(row.downloadUrl))}" download>${icon('download')}파일 받기</a>`:''}${creatorSourceButton('사용 기준','detail',`data-id="${escape(row.id)}"`)}</div></div></article>`;
}
function creatorSourcesResults(){
  const rows=creatorSourcesFiltered();
  return `<p class="cs-result-count" aria-live="polite">${rows.length}개 자료${rows.length>creatorSources.limit?' · 먼저 '+Math.min(rows.length,creatorSources.limit)+'개 표시':''}</p>${rows.length?`<div class="cs-grid">${rows.slice(0,creatorSources.limit).map(creatorSourceCard).join('')}</div>${rows.length>creatorSources.limit?`<div class="cs-more">${creatorSourceButton('자료 더 보기','more','','small')}</div>`:''}`:'<p class="cs-empty">검색어를 바꾸거나 다른 종류를 선택해 보세요.</p>'}`;
}
function creatorSourcesPanel(){
  if(creatorSources.userId!==state.user?.id)return '<section class="cs-panel" data-creator-sources><h2>제작 소스</h2><p class="cs-empty">승인 자료를 불러오고 있어요.</p></section>';
  const data=creatorSources.data;
  return `<section class="cs-panel" data-creator-sources aria-label="제작 소스"><header class="cs-heading"><div><h2>제작 소스</h2><p>승인 자산을 내려받고, 외부 자료의 사용 조건을 확인하세요.</p></div>${creatorSourceButton(creatorSources.loading?'불러오는 중…':'새로 읽기','reload',creatorSources.loading?'disabled':'')}</header>${creatorSources.error?`<p class="cs-error" role="alert">${escape(creatorSources.error)}</p>`:''}${!data?`<p class="cs-empty">${creatorSources.loading?'승인 자료를 불러오고 있어요.':'자료를 불러오지 못했어요. 새로 읽기를 눌러 주세요.'}</p>`:`<div class="cs-filters"><label>자료 찾기<input type="search" data-creator-source-query maxlength="80" value="${escape(creatorSources.query)}" placeholder="예: LAB, 마린, 서체"></label><label>종류<select data-creator-source-category><option value="all" ${creatorSources.category==='all'?'selected':''}>전체 자료</option>${Object.entries(creatorSourceCategories).map(([id,label])=>`<option value="${id}" ${creatorSources.category===id?'selected':''}>${label}</option>`).join('')}</select></label></div><div data-creator-source-results>${creatorSourcesResults()}</div><details class="cs-guides"><summary>외부 사진·영상·음악 소스와 사용권 <span>공식 안내 4곳</span></summary><p class="cs-guide-intro">무료 자료도 초상·상표·음악과 사용 목적에 따라 조건이 달라집니다. 실제 사용한 항목의 원문과 라이선스를 확인하세요.</p><div class="cs-guide-list">${(data.guides||[]).map(row=>`<article><h3>${escape(row.title)}</h3><p>${escape(row.note)}</p><div><a class="btn small quiet" href="${escape(creatorSourceExternalUrl(row.url))}" target="_blank" rel="noopener noreferrer">자료 찾기${icon('external')}</a><a class="btn small quiet" href="${escape(creatorSourceExternalUrl(row.licenseUrl))}" target="_blank" rel="noopener noreferrer">공식 사용 조건${icon('external')}</a></div></article>`).join('')}</div><div class="cs-rights-note"><p>원문 URL·작성자·라이선스·확인일·필수 크레딧을 기존 경험·소재 메모에 함께 남기면 다음 제작자가 조건을 다시 확인할 수 있어요.</p>${creatorSourceButton('사용권 기록 양식 복사','copy-rights','','small')}</div></details>`}</section>`;
}
function creatorSourceDetail(id){
  const row=creatorSources.data?.assets.find(asset=>asset.id===id);if(!row)return;
  modal(escape(row.title),'승인 원천과 사용하는 파일을 구분해 확인하세요.',`<article class="cs-detail"><div class="cs-preview ${row.background==='dark'?'cs-preview-dark':''}">${creatorSourcePreview(row)}</div><p>${escape(row.usage)}</p><dl><dt>받는 파일</dt><dd>${escape(row.fileName)} · ${creatorSourceBytes(row.byteSize)}</dd><dt>형식</dt><dd>${escape(row.variant||'')}</dd><dt>사용 기준</dt><dd>${escape(row.sourcePath)}</dd>${row.originPath?`<dt>원천 파일</dt><dd>${escape(row.originPath)}</dd>`:''}<dt>제공 파일</dt><dd>${escape(row.assetPath)}</dd><dt>파일 갱신</dt><dd>${row.updatedAt?escape(new Date(row.updatedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})):'확인 필요'}</dd></dl>${row.license?`<section class="cs-license"><h3>${escape(row.license.label)}</h3><p>${escape(row.license.notice)}</p><a class="btn small quiet" href="${escape(creatorSourceLocalUrl(row.license.url))}" target="_blank" rel="noopener noreferrer">라이선스 원문</a><a class="btn small quiet" href="${escape(creatorSourceLocalUrl(row.license.downloadUrl))}" download>라이선스 받기</a></section>`:''}<div class="modal-actions">${row.available?`<a class="btn" href="${escape(creatorSourceLocalUrl(row.downloadUrl))}" download>${icon('download')}파일 받기</a>`:''}${creatorSourceButton('파일·사용 기준 복사','copy-asset',`data-id="${escape(row.id)}"`)}</div></article>`,true);
}
document.addEventListener('input',event=>{
  if(!creatorSourcesActive()||!event.target.matches('[data-creator-source-query]'))return;
  creatorSources.query=event.target.value.slice(0,80);creatorSources.limit=6;
  const results=document.querySelector('[data-creator-source-results]');if(results)results.innerHTML=creatorSourcesResults();
});
document.addEventListener('change',event=>{
  if(!creatorSourcesActive()||!event.target.matches('[data-creator-source-category]'))return;
  creatorSources.category=Object.hasOwn(creatorSourceCategories,event.target.value)?event.target.value:'all';creatorSources.limit=6;render();
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-creator-source-action]');if(!target||!creatorSourcesActive()||creatorSources.userId!==state.user.id)return;
  const userId=state.user.id;
  try{
    const action=target.dataset.creatorSourceAction;
    if(action==='reload'){await creatorSourcesEnsure(true);return;}
    if(action==='more'){creatorSources.limit+=6;render();return;}
    if(action==='detail'){creatorSourceDetail(target.dataset.id);return;}
    let text='';
    if(action==='copy-rights')text=creatorSources.data?.rightsTemplate||'';
    if(action==='copy-asset'){
      const row=creatorSources.data?.assets.find(asset=>asset.id===target.dataset.id);if(!row)return;
      text=[row.title,'제공 파일: '+row.assetPath,'사용 기준: '+row.sourcePath,row.originPath?'원천: '+row.originPath:'','사용 방법: '+row.usage,row.license?'라이선스: '+row.license.label+'\n'+row.license.notice:''].filter(Boolean).join('\n');
    }
    if(text){await navigator.clipboard.writeText(text);if(state.user?.id===userId)notify('기록할 내용을 복사했어요.');}
  }catch(error){if(state.user?.id===userId)notify(error.message||'자료 작업을 완료하지 못했어요.');}
});
