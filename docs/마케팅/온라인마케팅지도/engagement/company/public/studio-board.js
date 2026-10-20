'use strict';

// These views only use the authenticated workspace. No external search or fetching.
const swbStages={idea:'준비',making:'제작 중',review:'검토 요청',ready:'완성',published:'게시 기록',archived:'보관'};
const swbKinds={experience:'직접 경험',question:'받은 질문',discovery:'새로운 발견',reference:'참고 자료'};
const swbActiveStages=new Set(['idea','making','review','ready']);
function swbOption(value,label,selected){return `<option value="${escape(value)}" ${String(value)===String(selected)?'selected':''}>${escape(label)}</option>`;}
function swbRows(){return Array.isArray(sw.data?.productions)?sw.data.productions:[];}
function swbMaterials(){return Array.isArray(sw.data?.materials)?sw.data.materials:[];}
function swbFilters(){return sw.filters||(sw.filters={});}
function swbTeamName(id){return (sw.data?.assignableTeams||[]).find(row=>row.id===id)?.name||'다른 팀';}
function swbSourceUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
function swbDue(row){
  if(!row.dueDate)return '<span class="swb-date">기한 없음</span>';
  const overdue=swbActiveStages.has(row.stage)&&row.dueDate<dateToday();
  return `<span class="swb-date ${overdue?'overdue':''}">${icon('clock')}${escape(row.dueDate.replaceAll('-','.'))}${overdue?' · 기한 지남':''}</span>`;
}
function swbBoardFiltered(){
  const filters=swbFilters(),stage=filters.boardStage||'active';
  return swbRows().filter(row=>(stage==='all'||(stage==='active'?swbActiveStages.has(row.stage):row.stage===stage))&&(!filters.boardAssignee||(filters.boardAssignee==='unassigned'?!row.assigneeId:row.assigneeId===filters.boardAssignee))&&(!filters.boardBlocker||filters.boardBlocker==='all'||(filters.boardBlocker==='blocked'?!!row.blocker:!row.blocker)));
}
function swbBoardCard(row){
  const attrs=`data-id="${escape(row.id)}"`,stage=swbStages[row.stage]||'상태 모름';
  return `<article class="swb-production" data-production="${escape(row.id)}"><div class="swb-production-main"><div class="swb-production-meta"><span class="swb-stage ${Object.hasOwn(swbStages,row.stage)?row.stage:''}">${escape(stage)}</span><span>${escape(row.teamId?swbTeamName(row.teamId):'지정한 사람만')}</span>${row.versionCount?`<span>완성본 ${number(row.versionCount)}개</span>`:'<span>완성본 없음</span>'}</div><h3>${swButton(escape(row.title),'open-production','','swb-title',attrs)}</h3><p class="swb-next"><span>다음 할 일</span><strong class="${row.nextAction?'':'not-set'}">${escape(row.nextAction||'아직 정하지 않았어요')}</strong></p>${row.blocker?`<p class="swb-blocker">${icon('info')}<span><b>도움이 필요해요</b>${escape(row.blocker)}</span></p>`:''}</div><div class="swb-production-side"><div class="swb-people"><span>담당 <strong>${escape(row.assigneeName||'없음')}</strong></span><span>검토 <strong>${escape(row.reviewerName||'없음')}</strong></span></div>${swbDue(row)}<span class="swb-feedback ${row.openNotes?'has-notes':''}">남은 의견 ${number(row.openNotes??0)}개</span><div class="swb-card-actions">${swButton('열기','open-production','arrow','quiet small',attrs)}${row.canEdit&&!isViewer()?swButton('수정','edit-production','','quiet small',attrs):''}</div></div></article>`;
}
function swbBoardList(){
  const rows=swbBoardFiltered(),all=swbRows();
  if(!all.length)return `<div class="swb-empty"><span class="swb-empty-icon">${icon('video')}</span><h3>아직 작업이 없어요</h3><p>${isViewer()?'팀에 공유된 작업이 생기면 여기에 보여요.':'제목 하나로 시작해도 돼요. 다음 할 일과 완성본을 한곳에 모아요.'}</p>${!isViewer()?swButton('첫 작업 시작','new-production','plus','primary'):''}</div>`;
  return `<div class="swb-result-label" role="status">조건에 맞는 작업 <strong>${number(rows.length)}개</strong></div>${rows.length?`<div class="swb-production-list">${rows.map(swbBoardCard).join('')}</div>`:`<div class="swb-empty compact"><h3>조건에 맞는 작업이 없어요</h3><p>단계나 담당자를 바꿔 보세요.</p>${swButton('조건 지우기','board-reset','','quiet')}</div>`}`;
}
function swBoardPage(){
  const rows=swbRows(),active=rows.filter(row=>swbActiveStages.has(row.stage)),filters=swbFilters(),members=new Map();
  for(const row of rows)if(row.assigneeId)members.set(row.assigneeId,row.assigneeName||'담당자');
  const counts=[['active','진행 중',active.length,'준비부터 완성까지'],['review','검토 요청',rows.filter(row=>row.stage==='review').length,'같이 볼 완성본'],['blocked','도움 필요',active.filter(row=>row.blocker).length,'막힌 이유 보기']];
  return `<section class="swb-board"><div class="swb-heading"><div><h2>지금 만드는 것</h2><p>볼 수 있는 작업 ${number(rows.length)}개 · 다음 할 일과 필요한 도움을 같이 봐요.</p></div>${!isViewer()?swButton('새 작업','new-production','plus','primary'):''}</div><div class="swb-overview">${counts.map(([id,label,count,description])=>`<button type="button" data-action="sw-board-focus" data-value="${id}" class="swb-overview-item"><span>${label}</span><strong>${number(count)}<small>개</small></strong><p>${description}${icon('arrow')}</p></button>`).join('')}</div><div class="swb-filters"><label><span>단계</span><select data-swb-filter="boardStage">${swbOption('active','진행 중인 것',filters.boardStage||'active')}${swbOption('all','모든 단계',filters.boardStage)}${Object.entries(swbStages).map(([id,label])=>swbOption(id,label,filters.boardStage)).join('')}</select></label><label><span>담당자</span><select data-swb-filter="boardAssignee">${swbOption('','모든 담당자',filters.boardAssignee||'')}${swbOption('unassigned','담당 없음',filters.boardAssignee)}${[...members].map(([id,name])=>swbOption(id,name,filters.boardAssignee)).join('')}</select></label><label><span>도움 요청</span><select data-swb-filter="boardBlocker">${swbOption('all','모든 작업',filters.boardBlocker||'all')}${swbOption('blocked','도움이 필요한 작업',filters.boardBlocker)}${swbOption('clear','막힌 것 없는 작업',filters.boardBlocker)}</select></label></div><div id="swb-board-results">${swbBoardList()}</div><p class="swb-footnote">「게시 기록」은 손으로 바꾼 단계예요. 실제로 올라갔는지는 원문에서 확인해 주세요.</p></section>`;
}
function swbMaterialFiltered(){
  const filters=swbFilters(),query=(filters.materialSearch||'').trim().toLocaleLowerCase('ko-KR');
  return swbMaterials().filter(row=>(filters.materialStatus==='all'||(row.status||'active')===(filters.materialStatus||'active'))&&(!filters.materialKind||row.kind===filters.materialKind)&&(!query||[row.title,row.body,row.ownerName,...(row.tags||[])].join(' ').toLocaleLowerCase('ko-KR').includes(query)));
}
function swbMaterialCard(row){
  const attrs=`data-id="${escape(row.id)}"`,source=swbSourceUrl(row.sourceUrl),body=String(row.body||''),scope=row.visibility==='company'?'회사 전체':row.visibility==='team'?swbTeamName(row.teamId):'작성자·관리자';
  return `<article class="swb-material"><div class="swb-material-meta"><span>${escape(swbKinds[row.kind]||'소재')}</span><span>${row.visibility==='private'?icon('lock'):icon('users')}${escape(scope)}</span>${row.status==='archived'?'<span class="swb-archived">보관됨</span>':''}</div><h3>${escape(row.title)}</h3><p class="swb-material-body">${escape(body.length>320?body.slice(0,320)+'…':body)}</p>${body.length>320?`<details class="swb-material-full"><summary>전부 읽기</summary><p>${escape(body)}</p></details>`:''}${row.tags?.length?`<div class="swb-tags">${row.tags.map(tag=>`<span>#${escape(tag)}</span>`).join('')}</div>`:''}${source?`<a class="swb-source" href="${escape(source)}" target="_blank" rel="noopener noreferrer">원문 보기${icon('external')}</a>`:''}<div class="swb-material-footer"><p><span>${escape(row.ownerName||'작성자 모름')}</span><time>${row.updatedAt?escape(time(row.updatedAt)):'날짜 모름'}</time></p><div class="swb-card-actions">${!isViewer()&&row.status!=='archived'?swButton('이 소재로 기획','plan-material','arrow','quiet small',attrs):''}${row.canEdit&&!isViewer()?swButton('수정','edit-material','','quiet small',attrs):''}</div></div></article>`;
}
function swbMaterialList(){
  const rows=swbMaterialFiltered(),all=swbMaterials();
  if(!all.length)return `<div class="swb-empty"><span class="swb-empty-icon">${icon('bookmark')}</span><h3>사소한 경험도 다음 콘텐츠가 돼요</h3><p>${isViewer()?'팀이나 회사에 공유된 경험·질문이 여기에 모여요.':'겪은 일, 자주 받은 질문, 새로 안 것을 짧게 남겨 두세요. 처음에는 작성자와 관리자만 봐요.'}</p>${!isViewer()?swButton('첫 소재 남기기','new-material','plus','primary'):''}</div>`;
  return `<div class="swb-result-label" role="status">조건에 맞는 소재 <strong>${number(rows.length)}개</strong></div>${rows.length?`<div class="swb-material-grid">${rows.map(swbMaterialCard).join('')}</div>`:`<div class="swb-empty compact"><h3>찾는 소재가 없어요</h3><p>다른 검색어를 쓰거나 종류·보관 상태를 바꿔 보세요.</p>${swButton('조건 지우기','materials-reset','','quiet')}</div>`}`;
}
function swMaterialsPage(){
  const filters=swbFilters();
  return `<section class="swb-materials"><div class="swb-heading"><div><h2>경험과 소재</h2><p>정리된 원고가 아니어도 돼요. 잊기 전에 소재부터 남겨 두세요.</p></div>${!isViewer()?swButton('소재 남기기','new-material','plus','primary'):''}</div><div class="swb-filters material-filters"><label class="swb-search"><span>소재 찾기</span><input type="search" data-swb-filter="materialSearch" value="${escape(filters.materialSearch||'')}" placeholder="제목, 내용, 작성자, 태그 검색" maxlength="200"></label><label><span>종류</span><select data-swb-filter="materialKind">${swbOption('','모든 종류',filters.materialKind||'')}${Object.entries(swbKinds).map(([id,label])=>swbOption(id,label,filters.materialKind)).join('')}</select></label><label><span>보관 상태</span><select data-swb-filter="materialStatus">${swbOption('active','사용 중',filters.materialStatus||'active')}${swbOption('archived','보관한 소재',filters.materialStatus)}${swbOption('all','전체',filters.materialStatus)}</select></label></div><div id="swb-material-results">${swbMaterialList()}</div><p class="swb-footnote">공유된 소재로 기획을 만들어도 그 기획은 저절로 공개되지 않아요.</p></section>`;
}
function swMaterialModal(id){
  if(isViewer())return;
  const row=id?swbMaterials().find(item=>item.id===id):null;
  if(id&&(!row||!row.canEdit)){notify('이 소재는 고칠 권한이 없어요. 작성자나 관리자에게 부탁해 주세요.');return;}
  const visibility=row?.visibility||'private',teams=sw.data?.assignableTeams||[],teamOptions=teams.map(team=>swbOption(team.id,team.name,row?.teamId)).join('');
  modal(row?'소재 수정':'소재 남기기','경험·질문·발견을 짧게 남겨 두고 필요할 때 기획으로 이어 가요.',`<form class="form-stack swb-material-form" data-swb-form="material" data-id="${escape(id||'')}"><div class="form-error" role="alert"></div><label class="field">한 줄 제목<input name="title" required maxlength="200" value="${escape(row?.title||'')}" placeholder="예: 회의 메모에서 담당자를 빠뜨렸던 순간"></label><label class="field">어떤 소재인가요?<select name="kind">${Object.entries(swbKinds).map(([key,label])=>swbOption(key,label,row?.kind||'experience')).join('')}</select></label><label class="field">기억해 둘 내용<textarea name="body" required maxlength="5000" rows="6" placeholder="무슨 일이 있었는지, 무엇이 궁금했는지, 어떤 점이 달라졌는지 적어 주세요.">${escape(row?.body||'')}</textarea><small>직접 겪은 일과 다른 데서 본 정보는 나눠서 적어 주세요.</small></label><details class="swb-material-options" ${visibility!=='private'||row?.sourceUrl||row?.tags?.length?'open':''}><summary>출처·태그·공유 범위 <span>선택</span></summary><div class="form-stack"><label class="field">출처 주소<input type="url" name="sourceUrl" maxlength="2048" value="${escape(row?.sourceUrl||'')}" placeholder="https://"><small>원문이 있을 때만 넣어 주세요. 주소를 열어 보지는 않아요.</small></label><label class="field">태그<input name="tags" maxlength="400" value="${escape((row?.tags||[]).join(', '))}" placeholder="회의, AI 활용, 첫 시도"><small>쉼표로 나눠 최대 8개, 각 40자까지 입력할 수 있어요.</small></label><label class="field">누가 볼 수 있나요?<select name="visibility" data-swb-visibility>${swbOption('private','작성자·관리자',visibility)}${swbOption('team','고른 팀',visibility)}${swbOption('company','회사 전체',visibility)}</select><small>제목·내용·출처·태그가 고른 범위에 함께 보여요. 관리자는 모든 소재를 볼 수 있어요.</small></label><label class="field" data-swb-team ${visibility==='team'?'':'hidden'}>공유할 팀<select name="teamId" ${visibility==='team'?'required':'disabled'}>${swbOption('','팀을 골라 주세요',row?.teamId||'')}${teamOptions}</select><small>${teams.length?'고른 팀이 볼 수 있게 저장해요.':'공유할 팀이 없어요. 「작성자·관리자」로 저장하거나 관리자에게 팀 배정을 부탁해 주세요.'}</small></label><label class="swb-consent" data-swb-company ${visibility==='company'?'':'hidden'}><input type="checkbox" name="shareConfirmed" ${visibility==='company'?'required':'disabled'}><span>이 소재의 제목·내용·출처·태그를 회사의 모든 계정에 공유해요.</span></label></div></details><p class="swb-scope-hint" data-swb-scope-hint>${visibility==='private'?'작성자와 관리자만 봐요.':visibility==='team'?'고른 팀이 소재 전체를 봐요.':'회사 전체가 소재 전체를 봐요.'}</p><div class="modal-actions swb-material-actions">${row?swButton(row.status==='archived'?'꺼내기':'보관','archive-material','','quiet',`data-id="${escape(row.id)}" data-status="${row.status==='archived'?'active':'archived'}"`):button('취소','close-modal')}<button type="submit" class="btn primary">저장${icon('check')}</button></div></form>`);
  swbSetVisibility(document.querySelector('form[data-swb-form="material"]'));
}
function swbRefreshResults(){
  const board=document.getElementById('swb-board-results'),materials=document.getElementById('swb-material-results');
  if(board)board.innerHTML=swbBoardList();if(materials)materials.innerHTML=swbMaterialList();
}
function swbSetVisibility(form){
  const visibility=form.elements.visibility.value,team=form.querySelector('[data-swb-team]'),company=form.querySelector('[data-swb-company]'),teamInput=form.elements.teamId,consent=form.elements.shareConfirmed;
  team.hidden=visibility!=='team';teamInput.disabled=visibility!=='team';teamInput.required=visibility==='team';
  const original=swbMaterials().find(row=>row.id===form.dataset.id),needsConfirmation=visibility==='company'&&original?.visibility!=='company';
  company.hidden=!needsConfirmation;consent.disabled=!needsConfirmation;consent.required=needsConfirmation;consent.checked=false;
  form.querySelector('[data-swb-scope-hint]').textContent=visibility==='private'?'작성자와 관리자만 봐요.':visibility==='team'?'고른 팀이 소재 전체를 봐요.':'회사 전체가 소재 전체를 봐요.';
}
document.addEventListener('input',event=>{const input=event.target.closest('[data-swb-filter="materialSearch"]');if(!input)return;swbFilters().materialSearch=input.value;swbRefreshResults();});
document.addEventListener('change',event=>{
  const target=event.target;if(target.matches('[data-swb-filter]')){swbFilters()[target.dataset.swbFilter]=target.value;swbRefreshResults();}
  if(target.matches('[data-swb-visibility]'))swbSetVisibility(target.form);
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;
  if(action==='sw-new-material'){swMaterialModal();return;}
  if(action==='sw-edit-material'){swMaterialModal(target.dataset.id);return;}
  if(action==='sw-board-focus'||action==='sw-board-reset'){
    const filters=swbFilters();filters.boardStage=action==='sw-board-focus'&&target.dataset.value==='review'?'review':'active';filters.boardAssignee='';filters.boardBlocker=target.dataset.value==='blocked'?'blocked':'all';render();return;
  }
  if(action==='sw-materials-reset'){Object.assign(swbFilters(),{materialSearch:'',materialKind:'',materialStatus:'active'});render();return;}
  if(action!=='sw-archive-material'||isViewer())return;
  const row=swbMaterials().find(item=>item.id===target.dataset.id);if(!row?.canEdit)return;
  const token=swGuard(),form=target.closest('form'),errorBox=form?.querySelector('.form-error');
  if(form?.dataset.busy==='true')return;if(form)form.dataset.busy='true';target.disabled=true;if(errorBox)errorBox.textContent='';
  try{
    await api('/api/studio-materials/'+encodeURIComponent(row.id),{status:target.dataset.status});
    if(!swAlive(token))return;const stillOpen=form?.isConnected;if(stillOpen)closeModal();await swReload();
    if(state.user?.id===token.userId)notify(target.dataset.status==='archived'?'소재를 보관했어요. 「보관한 소재」에서 다시 꺼낼 수 있어요.':'소재를 다시 꺼냈어요.');
  }catch(error){if(swAlive(token)){if(errorBox?.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(form?.isConnected)form.dataset.busy='false';if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-swb-form="material"]');if(!form)return;event.preventDefault();if(isViewer()||form.dataset.busy==='true')return;
  const submit=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),token=swGuard(),fields=new FormData(form),visibility=fields.get('visibility');
  form.dataset.busy='true';submit.disabled=true;errorBox.textContent='';
  try{
    const tags=[...new Set(String(fields.get('tags')||'').split(',').map(tag=>tag.trim()).filter(Boolean))];
    if(tags.length>8||tags.some(tag=>tag.length>40))throw new Error('태그는 최대 8개, 각 40자까지 입력해 주세요.');
    const sourceUrl=String(fields.get('sourceUrl')||'').trim();if(sourceUrl&&!swbSourceUrl(sourceUrl))throw new Error('출처는 https://로 시작하는 주소로 넣어 주세요. 아이디·비밀번호가 든 주소는 안 돼요.');
    const payload={title:fields.get('title'),kind:fields.get('kind'),body:fields.get('body'),sourceUrl,tags,visibility,teamId:visibility==='team'?fields.get('teamId'):null,...(visibility==='company'?{shareConfirmed:fields.get('shareConfirmed')==='on'}:{})};
    await api('/api/studio-materials'+(form.dataset.id?'/'+encodeURIComponent(form.dataset.id):''),payload);
    if(!swAlive(token))return;const stillOpen=form.isConnected;if(stillOpen)closeModal();await swReload();
    if(state.user?.id===token.userId)notify('소재를 저장했어요.');
  }catch(error){if(swAlive(token)&&form.isConnected){errorBox.textContent=error.message;errorBox.scrollIntoView({block:'nearest'});}}
  finally{if(form.isConnected){form.dataset.busy='false';submit.disabled=false;}}
});
