'use strict';
// 제작 상황판의 작업 목록 · 소재 데스크(13판 A). 인증된 작업 공간 자료만 쓴다 — 바깥 검색 · 가져오기 없음.
// 작업 목록 묶음은 먼저 볼 것부터(도움 필요 → 검토 요청 → 진행 중 → 완성 → 게시 기록 → 보관), 계기판 칸은 누르면 거르는 단추다(sw-board-focus).
const swbStages={idea:'준비',making:'제작 중',review:'검토 요청',ready:'완성',published:'게시 기록',archived:'보관'};
const swbKinds={experience:'직접 경험',question:'받은 질문',discovery:'새로운 발견',reference:'참고 자료'};
const swbActiveStages=new Set(['idea','making','review','ready']);
const swbGroups=[['help','도움 필요'],['review','검토 요청'],['making','준비 · 제작 중'],['ready','완성'],['published','게시 기록'],['archived','보관']];
function swbOption(value,label,selected){return `<option value="${escape(value)}" ${String(value)===String(selected)?'selected':''}>${escape(label)}</option>`;}
function swbRows(){return Array.isArray(sw.data?.productions)?sw.data.productions:[];}
function swbMaterials(){return Array.isArray(sw.data?.materials)?sw.data.materials:[];}
function swbFilters(){return sw.filters||(sw.filters={});}
function swbTeamName(id){return (sw.data?.assignableTeams||[]).find(row=>row.id===id)?.name||'다른 팀';}
function swbSourceUrl(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}}
function swbOverdue(row,today=dateToday()){return swbActiveStages.has(row.stage)&&!!row.dueDate&&row.dueDate<today;}
function swbGroupOf(row){return row.stage==='archived'?'archived':row.stage==='published'?'published':row.blocker&&swbActiveStages.has(row.stage)?'help':row.stage==='review'?'review':row.stage==='ready'?'ready':'making';}
// 내 차례: 내가 검토 담당인 검토 요청(볼 버전이 있을 때), 내가 제작 담당인 작업의 남은 의견.
// 내 차례: 검토 담당은 완성본이 있고 이 버전에 아직 의견을 남기지 않았을 때, 제작 담당은 남은 의견이 있을 때. 상세를 받은 작업은
// 「지금 할 일」과 같은 상세 판정(swReviewed)을, 목록 요약만 있는 작업은 남은 의견 수로 가늠한다.
function swbMine(row){const me=state.user?.id;if(!me)return false;const full=typeof swDetail==='function'&&swDetail()?.id===row.id?swDetail():null;
  const versions=full?full.versions?.length||0:row.versionCount||0,notes=full?(full.notes||[]).filter(note=>!note.resolved).length:row.openNotes||0;
  return row.stage==='review'&&row.reviewerId===me&&versions>0&&(full?!swReviewed(full,me):!notes)||['idea','making','review'].includes(row.stage)&&(row.assigneeId===me||!row.assigneeId&&row.ownerId===me)&&notes>0;}
function swbStageTone(stage){return {review:'wait',ready:'ok',published:'ok',archived:'off'}[stage]||'';}
function swbTone(row){return swbGroupOf(row)==='help'||swbOverdue(row)?'alert':swbMine(row)?'wait':row.stage==='review'?'info':['ready','published'].includes(row.stage)?'ok':row.stage==='archived'?'off':'';}
// 목록 점의 읽는 이름(색만으로 갈리지 않게) · 휴대폰 띠의 상태 말.
function swbLedLabel(row){return swbGroupOf(row)==='help'?'도움 필요':swbOverdue(row)?'기한 지남':swbMine(row)?'내 차례':swbStages[row.stage]||'';}
function swbWord(row){return swbGroupOf(row)==='help'?'도움 필요':swbStages[row.stage]||'단계 모름';}
function swbDay(value){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return match?`${Number(match[2])}월 ${Number(match[3])}일`:'';}
function swbDueText(row){const day=swbDay(row.dueDate);return !day?'기한 없음':swbOverdue(row)?`기한 지남 · ${day}`:`${day}까지`;}
function swbBoardFiltered(){
  const filters=swbFilters(),stage=filters.boardStage||'active',today=dateToday();
  return swbRows().filter(row=>(stage==='all'||(stage==='active'?swbActiveStages.has(row.stage):row.stage===stage))&&(!filters.boardAssignee||(filters.boardAssignee==='unassigned'?!row.assigneeId:row.assigneeId===filters.boardAssignee))&&(!filters.boardBlocker||filters.boardBlocker==='all'||(filters.boardBlocker==='blocked'?!!row.blocker:!row.blocker))&&(!filters.boardOverdue||swbOverdue(row,today)));
}
function swbBoardModel(){const rows=swbBoardFiltered(),groups=swbGroups.map(([key,label])=>[key,label,rows.filter(row=>swbGroupOf(row)===key)]).filter(([,,list])=>list.length),shown=groups.flatMap(([,,list])=>list),query=swbFilters().boardSearch||'';return {rows,groups,shown,visible:shown.filter(row=>swHit(swbSearchText(row),query))};}
// 계기판에서 누른 칸: 열린 작업(기본) · 검토 요청 · 도움 필요 · 기한 지남. 범위를 「모두」로 넓히면 어느 칸도 눌리지 않는다. 담당 고르기와는 따로 걸린다.
function swbFocus(){const filters=swbFilters();return filters.boardOverdue?'overdue':filters.boardBlocker==='blocked'?'blocked':filters.boardStage==='review'?'review':filters.boardStage==='all'?'':'active';}
function swbMeter(){
  const rows=swbRows(),today=dateToday(),active=rows.filter(row=>swbActiveStages.has(row.stage)),focus=swbFocus();
  const review=rows.filter(row=>row.stage==='review').length,help=active.filter(row=>row.blocker).length,late=active.filter(row=>swbOverdue(row,today)).length;
  const cell=(value,label,count,tone)=>({label,value:count,unit:'개',tone,attrs:`data-action="sw-board-focus" data-value="${value}"`,pressed:focus===value});
  return mtMeter([cell('active','열린 작업',active.length,''),cell('review','검토 요청',review,review?'wait':''),cell('blocked','도움 필요',help,help?'alert':''),cell('overdue','기한 지남',late,late?'alert':'')]);
}
// 거르기를 바꾼 뒤 고른 작업이 조건 밖이면 비워 목록 첫 줄을 다시 고르게 한다.
function swbRepick(){if(sw.productionId&&!swbBoardModel().visible.some(row=>row.id===sw.productionId)){if(typeof swResetReview==='function')swResetReview();sw.productionId='';sw.folds={};}}
function swbSearchText(row){return [row.title,row.nextAction,row.blocker,row.assigneeName,row.reviewerName].filter(Boolean).join(' ').toLowerCase();}
function swbBoardItem(row,current,group,query){
  const id=escape(row.id),text=swbSearchText(row),overdue=swbOverdue(row),word=group==='help'?'도움 필요':swbStages[row.stage]||'단계 모름',tone=group==='help'?'alert':row.stage==='review'&&swbMine(row)?'wait':row.stage==='ready'?'ok':'';
  const detail=[group==='help'?swbStages[row.stage]||'':'',row.assigneeName||'담당 없음',row.dueDate&&!overdue?swbDay(row.dueDate)+'까지':'',row.openNotes?`의견 ${mtNum(row.openNotes)}`:''].filter(Boolean).join(' · ');
  return `<button type="button" class="mt-item is-two" data-action="sw-open-production" data-id="${id}" data-production="${id}" data-sw-row="${group}" data-search="${escape(text)}" aria-current="${current?.id===row.id}" ${swHit(text,query)?'':'hidden'}>${mtLed(swbTone(row),swbLedLabel(row))}<span><strong>${escape(row.title)}</strong><small><em${tone?` data-tone="${tone}"`:''}>${escape(word)}</em>${overdue?'<em data-tone="alert">기한 지남</em>':''}<span class="mt-item-text">${escape(detail)}</span></small></span></button>`;
}
function swbBoardList(model,current){
  const rows=swbRows(),filters=swbFilters(),query=filters.boardSearch||'',members=new Map();let unassigned=false;
  for(const row of rows){if(row.assigneeId)members.set(row.assigneeId,row.assigneeName||'담당');else unassigned=true;}
  const people=[...members].sort((a,b)=>a[1].localeCompare(b[1],'ko-KR'));
  if(!rows.length)return `<aside class="mt-list" aria-label="작업 목록" data-sw-list="board"><p class="mt-list-empty">작업을 만들면 여기에 쌓여요.</p></aside>`;
  const all=(filters.boardStage||'active')==='all',active=rows.filter(row=>swbActiveStages.has(row.stage)).length;
  const scope=`<div class="mt-seg" role="group" aria-label="목록 범위">${[['active','열린 작업',active,!all],['all','모두',rows.length,all]].map(([id,label,count,on])=>`<button type="button" data-action="sw-board-scope" data-value="${id}" aria-pressed="${on}">${label} <b>${mtNum(count)}</b></button>`).join('')}</div>`;
  const assignee=members.size+(unassigned?1:0)>1?`<label class="sw-select"><span class="sr-only">담당</span><select data-swb-filter="boardAssignee">${swbOption('','모든 담당',filters.boardAssignee||'')}${unassigned?swbOption('unassigned','담당 없음',filters.boardAssignee):''}${people.map(([id,name])=>swbOption(id,name,filters.boardAssignee)).join('')}</select></label>`:'';
  const tools=`<div class="mt-list-tools">${swSearchBox('data-swb-filter="boardSearch"',query,'제목 · 다음 할 일 · 담당 찾기','작업 찾기')}${scope}${assignee}</div>`;
  const groups=model.groups.map(([key,label,list],index)=>swGroupHead(key,index+1,label,list.length,list.some(row=>swHit(swbSearchText(row),query)))+list.map(row=>swbBoardItem(row,current,key,query)).join('')).join('');
  const found=model.shown.some(row=>swHit(swbSearchText(row),query));
  const foot=!all&&rows.length>active?`<p class="mt-note mt-list-foot">게시 기록 · 보관 ${mtNum(rows.length-active)}개는 「모두」에서 봐요.</p>`:'';
  return `<aside class="mt-list" aria-label="작업 목록" data-sw-list="board">${tools}${groups}<p class="mt-list-empty" data-sw-none ${query&&model.shown.length&&!found?'':'hidden'}>찾는 작업이 없어요.</p>${model.shown.length?'':'<p class="mt-list-empty">조건에 맞는 작업 0개</p>'}${foot}</aside>`;
}
function swbBoardEmpty(model){
  if(!swbRows().length)return `<div class="mt-detail"><div class="mt-detail-empty"><img src="${mtFelt('productions')}" alt="" width="120" height="145" decoding="async"><div><strong>${isViewer()?'함께 보는 작업이 아직 없어요':'아직 작업이 없어요'}</strong><p>${isViewer()?'팀에 공유된 작업이 생기면 여기에 보여요.':'제목 하나로 시작해도 돼요. 다음 할 일과 완성본, 검토 의견을 한곳에 모아요.'}</p></div>${!isViewer()?`<button type="button" class="btn primary" data-action="sw-new-production">${mtIcon('plus')}첫 작업 만들기</button>`:''}</div></div>`;
  return `<div class="mt-detail"><div class="mt-detail-empty"><div><strong>고른 조건에 맞는 작업이 없어요</strong><p>계기판 칸이나 담당 고르기를 풀면 다시 보여요.</p></div>${swBtn('조건 지우기','board-reset')}</div></div>`;
}

// ── 소재 데스크 ──
function swbMaterialFiltered(){const filters=swbFilters();return swbMaterials().filter(row=>(filters.materialStatus==='all'||(row.status||'active')===(filters.materialStatus||'active'))&&(!filters.materialKind||row.kind===filters.materialKind));}
function swbMaterialModel(){const rows=swbMaterialFiltered(),groups=[...Object.entries(swbKinds),['other','그 밖의 소재']].map(([key,label])=>[key,label,rows.filter(row=>key==='other'?!Object.hasOwn(swbKinds,row.kind):row.kind===key)]).filter(([,,list])=>list.length),shown=groups.flatMap(([,,list])=>list),query=swbFilters().materialSearch||'';return {rows,groups,shown,visible:shown.filter(row=>swHit(swbMaterialSearch(row),query))};}
function swbMaterialMeter(){const rows=swbMaterials().filter(row=>(row.status||'active')!=='archived'),kind=swbFilters().materialKind||'';return mtMeter(Object.entries(swbKinds).map(([id,label])=>({label,value:rows.filter(row=>row.kind===id).length,unit:'개',tone:'',attrs:`data-action="sw-material-kind" data-value="${id}"`,pressed:kind===id})));}
function swbScope(row){return row.visibility==='company'?'회사 전체':row.visibility==='team'?swbTeamName(row.teamId):'비공개';}
function swbMaterialSearch(row){return [row.title,row.body,row.ownerName,...(row.tags||[])].filter(Boolean).join(' ').toLowerCase();}
function swbCurrentMaterial(model){let row=model.shown.find(item=>item.id===sw.materialId)||null;if(!row){row=model.visible[0]||null;sw.materialId=row?.id||'';}return row;}
function swMaterialsDesk(){
  const model=swbMaterialModel(),current=swbCurrentMaterial(model);
  const summary=current?`<b>${escape(swbKinds[current.kind]||'소재')}</b> · ${escape(current.title)}`:'고른 소재 없음';
  return `<div class="mt-desk${sw.picking?' is-picking':''}">${swBand(summary)}${swbMaterialList(model,current)}${current?swbMaterialDetail(current):swbMaterialEmpty()}</div>`;
}
function swbMaterialList(model,current){
  const all=swbMaterials(),filters=swbFilters(),query=filters.materialSearch||'',status=filters.materialStatus||'active';
  if(!all.length)return `<aside class="mt-list" aria-label="소재 목록" data-sw-list="materials"><p class="mt-list-empty">소재를 남기면 여기에 쌓여요.</p></aside>`;
  const archived=all.filter(row=>row.status==='archived').length,active=all.length-archived;
  const seg=archived||status!=='active'?`<div class="mt-seg" role="group" aria-label="보관 상태">${[['active','쓰는 중',active],['archived','보관',archived],['all','모두',all.length]].map(([id,label,count])=>`<button type="button" data-action="sw-material-status" data-value="${id}" aria-pressed="${status===id}">${label} <b>${mtNum(count)}</b></button>`).join('')}</div>`:'';
  const tools=`<div class="mt-list-tools">${swSearchBox('data-swb-filter="materialSearch"',query,'제목 · 내용 · 남긴 사람 · 태그 찾기','소재 찾기')}${seg}</div>`;
  const item=(row,key)=>{const text=swbMaterialSearch(row),id=escape(row.id);return `<button type="button" class="mt-item sw-two" data-action="sw-material-pick" data-id="${id}" data-sw-row="${key}" data-search="${escape(text)}" aria-current="${current?.id===row.id}" ${swHit(text,query)?'':'hidden'}><span class="mt-tile" aria-hidden="true">${mtIcon('file')}</span><span><strong>${escape(row.title)}</strong><small><em>${escape(swbScope(row))}</em><span class="mt-item-text">${escape(row.ownerName||'남긴 사람 모름')}</span></small></span><span class="mt-item-end">${escape(row.updatedAt?swbDay(String(row.updatedAt).slice(0,10)):'')}</span></button>`;};
  const groups=model.groups.map(([key,label,list],index)=>swGroupHead(key,index+1,label,list.length,list.some(row=>swHit(swbMaterialSearch(row),query)))+list.map(row=>item(row,key)).join('')).join('');
  const found=model.shown.some(row=>swHit(swbMaterialSearch(row),query));
  return `<aside class="mt-list" aria-label="소재 목록" data-sw-list="materials">${tools}${groups}<p class="mt-list-empty" data-sw-none ${query&&model.shown.length&&!found?'':'hidden'}>찾는 소재가 없어요.</p>${model.shown.length?'':'<p class="mt-list-empty">조건에 맞는 소재 0개</p>'}</aside>`;
}
function swbMaterialEmpty(){
  if(!swbMaterials().length)return `<div class="mt-detail"><div class="mt-detail-empty"><img src="${mtFelt('productions')}" alt="" width="120" height="145" decoding="async"><div><strong>사소한 경험도 다음 콘텐츠가 돼요</strong><p>${isViewer()?'팀이나 회사에 공유된 경험 · 질문이 여기에 모여요.':'겪은 일, 자주 받은 질문, 새로 안 것을 짧게 남겨 둬요. 처음에는 남긴 사람과 관리자만 봐요.'}</p></div>${!isViewer()?`<button type="button" class="btn primary" data-action="sw-new-material">${mtIcon('plus')}첫 소재 남기기</button>`:''}</div></div>`;
  return `<div class="mt-detail"><div class="mt-detail-empty"><div><strong>고른 조건에 맞는 소재가 없어요</strong><p>종류나 보관 상태 고르기를 풀면 다시 보여요.</p></div>${swBtn('조건 지우기','materials-reset')}</div></div>`;
}
function swbMaterialDetail(row){
  const id=escape(row.id),viewer=isViewer(),active=row.status!=='archived',source=swbSourceUrl(row.sourceUrl);
  const chips=`${mtBadge(swbKinds[row.kind]||'소재')}<span>${escape(swbScope(row))}</span>${active?'':mtBadge('보관','off')}`;
  const actions=[!viewer&&active?`<button type="button" class="btn primary small" data-action="sw-plan-material" data-id="${id}">${mtIcon('arrow')}기획 만들기</button>`:'',!viewer&&active?swBtn('이 소재로 작업 만들기','new-production',{attrs:`data-material="${id}"`}):'',row.canEdit&&!viewer?swBtn('고치기','edit-material',{attrs:`data-id="${id}"`}):''].filter(Boolean).join('');
  const head=`<div class="mt-detail-head is-plain"><div><div class="mt-chips">${chips}</div><h2>${escape(row.title)}</h2><p>${escape([row.ownerName||'남긴 사람 모름',row.updatedAt?`${swbDay(String(row.updatedAt).slice(0,10))} 고침`:''].filter(Boolean).join(' · '))}</p>${actions?`<div class="mt-actions">${actions}</div>`:''}</div></div>`;
  const tags=row.tags?.length?`<ul class="sw-tags" aria-label="태그">${row.tags.map(tag=>`<li>#${escape(tag)}</li>`).join('')}</ul>`:'';
  const body=`<div class="sw-material-body"><p class="sw-text">${escape(row.body||'')}</p>${tags}${source?`<a class="mt-link" href="${escape(source)}" target="_blank" rel="noopener noreferrer">출처 열기</a>`:''}</div>`;
  return `<div class="mt-detail sw-detail" data-sw-material="${id}">${head}${body}<p class="mt-note sw-foot">공유한 소재로 기획을 만들어도 그 기획은 저절로 공개되지 않아요.</p></div>`;
}
function swMaterialModal(id){
  if(isViewer())return;
  const row=id?swbMaterials().find(item=>item.id===id):null;
  if(id&&(!row||!row.canEdit)){notify('이 소재는 고칠 수 없어요. 남긴 사람이나 관리자에게 부탁해 주세요.');return;}
  const visibility=row?.visibility||'private',teams=sw.data?.assignableTeams||[],teamOptions=teams.map(team=>swbOption(team.id,team.name,row?.teamId)).join('');
  modal(row?'소재 고치기':'소재 남기기','경험 · 질문 · 발견을 짧게 남겨 두고, 필요할 때 기획으로 이어 가요.',`<form class="form-stack swb-material-form" data-swb-form="material" data-id="${escape(id||'')}"><div class="form-error" role="alert"></div><label class="field">한 줄 제목<input name="title" required maxlength="200" value="${escape(row?.title||'')}" placeholder="예: 회의 메모에서 담당자를 빠뜨렸던 순간"></label><label class="field">어떤 소재인가요?<select name="kind">${Object.entries(swbKinds).map(([key,label])=>swbOption(key,label,row?.kind||'experience')).join('')}</select></label><label class="field">기억해 둘 내용<textarea name="body" required maxlength="5000" rows="6" placeholder="무슨 일이 있었는지, 무엇이 궁금했는지, 무엇이 달라졌는지 적어요.">${escape(row?.body||'')}</textarea><small>직접 겪은 일과 다른 데서 본 정보는 나눠서 적어요.</small></label><details class="swb-material-options" ${visibility!=='private'||row?.sourceUrl||row?.tags?.length?'open':''}><summary>출처 · 태그 · 공유 범위 <span>고를 때만</span></summary><div class="form-stack"><label class="field">출처 주소<input type="url" name="sourceUrl" maxlength="2048" value="${escape(row?.sourceUrl||'')}" placeholder="https://"><small>원문이 있을 때만 넣어요. 주소를 열어 보지는 않아요.</small></label><label class="field">태그<input name="tags" maxlength="400" value="${escape((row?.tags||[]).join(', '))}" placeholder="회의, AI 활용, 첫 시도"><small>쉼표로 나눠 8개까지, 하나에 40자까지 넣을 수 있어요.</small></label><label class="field">누가 볼 수 있나요?<select name="visibility" data-swb-visibility>${swbOption('private','비공개 · 남긴 사람과 관리자',visibility)}${swbOption('team','고른 팀',visibility)}${swbOption('company','회사 전체',visibility)}</select><small>제목 · 내용 · 출처 · 태그가 고른 범위에 함께 보여요. 관리자는 모든 소재를 볼 수 있어요.</small></label><label class="field" data-swb-team ${visibility==='team'?'':'hidden'}>공유할 팀<select name="teamId" ${visibility==='team'?'required':'disabled'}>${swbOption('','팀을 골라 주세요',row?.teamId||'')}${teamOptions}</select><small>${teams.length?'고른 팀이 볼 수 있게 저장해요.':'공유할 팀이 없어요. 「비공개」로 저장하거나 관리자에게 팀 배정을 부탁해 주세요.'}</small></label><label class="swb-consent" data-swb-company ${visibility==='company'?'':'hidden'}><input type="checkbox" name="shareConfirmed" ${visibility==='company'?'required':'disabled'}><span>이 소재의 제목 · 내용 · 출처 · 태그를 회사의 모든 계정에 공유해요.</span></label></div></details><p class="swb-scope-hint" data-swb-scope-hint>${visibility==='private'?'남긴 사람과 관리자만 봐요.':visibility==='team'?'고른 팀이 소재 전체를 봐요.':'회사 전체가 소재 전체를 봐요.'}</p><div class="modal-actions swb-material-actions">${row?swButton(row.status==='archived'?'다시 꺼내기':'보관','archive-material','','quiet',`data-id="${escape(row.id)}" data-status="${row.status==='archived'?'active':'archived'}"`):button('닫기','close-modal')}<button type="submit" class="btn primary">저장${icon('check')}</button></div></form>`);
  swbSetVisibility(document.querySelector('form[data-swb-form="material"]'));
}
// 찾기 칸은 다시 그리지 않고 줄만 숨긴다. 그 밖의 거르기는 목록을 다시 그린다.
function swbRefreshResults(){swFilterRows('board',swbFilters().boardSearch);swFilterRows('materials',swbFilters().materialSearch);}
function swbSetVisibility(form){
  const visibility=form.elements.visibility.value,team=form.querySelector('[data-swb-team]'),company=form.querySelector('[data-swb-company]'),teamInput=form.elements.teamId,consent=form.elements.shareConfirmed;
  team.hidden=visibility!=='team';teamInput.disabled=visibility!=='team';teamInput.required=visibility==='team';
  const original=swbMaterials().find(row=>row.id===form.dataset.id),needsConfirmation=visibility==='company'&&original?.visibility!=='company';
  company.hidden=!needsConfirmation;consent.disabled=!needsConfirmation;consent.required=needsConfirmation;consent.checked=false;
  form.querySelector('[data-swb-scope-hint]').textContent=visibility==='private'?'남긴 사람과 관리자만 봐요.':visibility==='team'?'고른 팀이 소재 전체를 봐요.':'회사 전체가 소재 전체를 봐요.';
}
const swbSearchFilters=new Set(['boardSearch','materialSearch']);
document.addEventListener('input',event=>{const input=event.target.closest?.('[data-swb-filter]');if(!input||!swbSearchFilters.has(input.dataset.swbFilter))return;swbFilters()[input.dataset.swbFilter]=input.value;swbRefreshResults();});
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.matches('[data-swb-filter]')){const name=target.dataset.swbFilter;swbFilters()[name]=target.value;if(swbSearchFilters.has(name))swbRefreshResults();else{if(name.startsWith('board'))swbRepick();render();}}
  if(target.matches('[data-swb-visibility]'))swbSetVisibility(target.form);
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;
  if(action==='sw-new-material'){swMaterialModal();return;}
  if(action==='sw-edit-material'){swMaterialModal(target.dataset.id);return;}
  if(action==='sw-board-focus'||action==='sw-board-reset'){
    const filters=swbFilters(),value=action==='sw-board-focus'?target.dataset.value:'active',next=value!=='active'&&swbFocus()===value?'active':value;
    Object.assign(filters,{boardStage:next==='review'?'review':'active',boardBlocker:next==='blocked'?'blocked':'all',boardOverdue:next==='overdue'});
    if(action==='sw-board-reset')Object.assign(filters,{boardSearch:'',boardAssignee:''});
    swbRepick();render();return;
  }
  if(action==='sw-board-scope'){const filters=swbFilters();filters.boardStage=target.dataset.value==='all'?'all':'active';filters.boardBlocker='all';filters.boardOverdue=false;swbRepick();render();return;}
  if(action==='sw-materials-reset'){Object.assign(swbFilters(),{materialSearch:'',materialKind:'',materialStatus:'active'});sw.materialId='';render();return;}
  if(action==='sw-material-status'||action==='sw-material-kind'){const filters=swbFilters();if(action==='sw-material-status')filters.materialStatus=['active','archived','all'].includes(target.dataset.value)?target.dataset.value:'active';else filters.materialKind=filters.materialKind===target.dataset.value?'':target.dataset.value;if(!swbMaterialModel().visible.some(row=>row.id===sw.materialId))sw.materialId='';render();return;}
  if(action==='sw-material-pick'){sw.materialId=target.dataset.id;sw.picking=false;render();return;}
  if(action!=='sw-archive-material'||isViewer())return;
  const row=swbMaterials().find(item=>item.id===target.dataset.id);if(!row?.canEdit)return;
  const token=swGuard(),form=target.closest('form'),errorBox=form?.querySelector('.form-error');
  if(form?.dataset.busy==='true')return;if(form)form.dataset.busy='true';target.disabled=true;if(errorBox)errorBox.textContent='';
  try{
    await api('/api/studio-materials/'+encodeURIComponent(row.id),{status:target.dataset.status});
    if(!swAlive(token))return;const stillOpen=form?.isConnected;if(stillOpen)closeModal();await swReload();
    if(state.user?.id===token.userId)notify(target.dataset.status==='archived'?'소재를 보관했어요. 「보관」에서 다시 꺼낼 수 있어요.':'소재를 다시 꺼냈어요.');
  }catch(error){if(swAlive(token)){if(errorBox?.isConnected)errorBox.textContent=error.message;else notify(error.message);}}
  finally{if(form?.isConnected)form.dataset.busy='false';if(target.isConnected)target.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-swb-form="material"]');if(!form)return;event.preventDefault();if(isViewer()||form.dataset.busy==='true')return;
  const submit=form.querySelector('[type="submit"]'),errorBox=form.querySelector('.form-error'),token=swGuard(),fields=new FormData(form),visibility=fields.get('visibility');
  form.dataset.busy='true';submit.disabled=true;errorBox.textContent='';
  try{
    const tags=[...new Set(String(fields.get('tags')||'').split(',').map(tag=>tag.trim()).filter(Boolean))];
    if(tags.length>8||tags.some(tag=>tag.length>40))throw new Error('태그는 8개까지, 하나에 40자까지 넣을 수 있어요.');
    const sourceUrl=String(fields.get('sourceUrl')||'').trim();if(sourceUrl&&!swbSourceUrl(sourceUrl))throw new Error('출처는 https://로 시작하는 주소로 넣어 주세요. 아이디 · 비밀번호가 든 주소는 넣을 수 없어요.');
    const payload={title:fields.get('title'),kind:fields.get('kind'),body:fields.get('body'),sourceUrl,tags,visibility,teamId:visibility==='team'?fields.get('teamId'):null,...(visibility==='company'?{shareConfirmed:fields.get('shareConfirmed')==='on'}:{})};
    const result=await api('/api/studio-materials'+(form.dataset.id?'/'+encodeURIComponent(form.dataset.id):''),payload);
    if(!swAlive(token))return;const stillOpen=form.isConnected;if(stillOpen)closeModal();if(result?.material?.id)sw.materialId=result.material.id;await swReload();
    if(state.user?.id===token.userId)notify('소재를 저장했어요.');
  }catch(error){if(swAlive(token)&&form.isConnected){errorBox.textContent=error.message;errorBox.scrollIntoView({block:'nearest'});}}
  finally{if(form.isConnected){form.dataset.busy='false';submit.disabled=false;}}
});
