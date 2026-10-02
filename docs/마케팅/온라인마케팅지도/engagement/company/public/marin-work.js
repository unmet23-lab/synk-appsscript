'use strict';

const marinWork={userId:null,profile:null,revision:null,catalog:null,draft:null,step:1,roster:null,selected:new Set(),criteria:{requiredSkills:[],minAvailableHours:0,projectName:''},result:null,pending:false,request:0};
function resetMarinWork(){Object.assign(marinWork,{userId:null,profile:null,revision:null,catalog:null,draft:null,step:1,roster:null,selected:new Set(),criteria:{requiredSkills:[],minAvailableHours:0,projectName:''},result:null,pending:false,request:marinWork.request+1});}
function workOptions(key){return Array.isArray(marinWork.catalog?.[key])?marinWork.catalog[key].map(row=>({value:row.id||row.value,label:row.label})).filter(row=>typeof row.value==='string'&&typeof row.label==='string'):[];}
function workLabel(value,key='skills'){return workOptions(key).find(row=>row.value===value)?.label||'미확인';}
function workIds(values,key='skills'){const allowed=new Set(workOptions(key).map(row=>row.value));return [...new Set(Array.isArray(values)?values.filter(value=>allowed.has(value)):[])].slice(0,12);}
function workHours(value){if(value==null||value==='')return null;const hours=Number(value);if(!Number.isFinite(hours)||hours<0||hours>80||Math.round(hours*2)!==hours*2)throw new Error('주당 가능 시간은 0~80시간, 0.5시간 단위로 입력해 주세요.');return hours;}
function workActive(version,userId){return state.user?.id===userId&&marinWork.userId===userId&&state.modalRequest===version;}
function workError(message){const box=document.getElementById('marin-work-error');if(box){box.textContent=message;box.hidden=!message;}}
function workTags(key,selected=[],prefix=key){return `<div class="work-tag-options">${workOptions(key).map(row=>`<label><input type="checkbox" name="${escape(prefix)}" value="${escape(row.value)}" ${selected.includes(row.value)?'checked':''}><span>${escape(row.label)}</span></label>`).join('')}</div>`;}
function workSelect(key,value){return `<select name="${key}"><option value="">아직 정하지 않았어요</option>${workOptions(key).map(row=>`<option value="${escape(row.value)}" ${row.value===value?'selected':''}>${escape(row.label)}</option>`).join('')}</select>`;}
function profileDraftFrom(profile={},suggestion=null){
  return{skills:workIds([...(profile.skills||[]),...(suggestion?.skills||[])]),preferredTasks:workIds([...(profile.preferredTasks||[]),...(suggestion?.preferredTasks||[])],'preferredTasks'),communication:workOptions('communication').some(row=>row.value===profile.communication)?profile.communication:null,workMode:workOptions('workMode').some(row=>row.value===profile.workMode)?profile.workMode:null,availableHours:workHours(suggestion?.availableHours??profile.availableHours),participates:Boolean(profile.participates),confirmed:false};
}
async function openMarinProfile(suggestion=null){
  if(!state.user)return;const userId=state.user.id;resetMarinWork();marinWork.userId=userId;
  modal('내 업무 카드','내가 확인한 업무 정보만 담아요.','<p class="work-loading" role="status">내 업무 카드를 불러오고 있어요.</p>');const version=state.modalRequest;
  try{const data=await api('/api/crew-profile');if(!workActive(version,userId))return;marinWork.profile=data.profile||null;marinWork.revision=data.revision??null;marinWork.catalog=data.catalog||{};marinWork.draft=profileDraftFrom(data.profile||{},suggestion);renderMarinProfile(Boolean(suggestion));}
  catch(error){if(workActive(version,userId))document.querySelector('#overlay .modal-body').innerHTML=`<p class="work-error" role="alert">${escape(error.message)}</p><button type="button" class="btn" data-marin-work="profile-retry">다시 불러오기</button>`;}
}
function renderMarinProfile(proposed=false){
  const draft=marinWork.draft;if(!draft)return;const second=marinWork.step===2;
  document.querySelector('#overlay .modal-body').innerHTML=`<form id="marin-profile-form" data-marin-form="profile" class="work-profile"><div class="work-step"><span>${second?'02':'01'} / 02</span><strong>${second?'협업과 가능한 시간':'내가 할 수 있는 일'}</strong></div>${proposed?'<p class="work-notice">직접 말한 업무 정보를 초안에 담았어요. 아직 저장하지 않았으니 내용을 확인해 주세요.</p>':''}${!second?`<fieldset><legend>업무 역량</legend>${workTags('skills',draft.skills)}</fieldset><details class="work-detail" ${draft.preferredTasks.length?'open':''}><summary>선호하는 업무 <span>선택</span></summary>${workTags('preferredTasks',draft.preferredTasks)}</details><p class="work-help">선택하지 않은 항목은 미확인으로 남아요. 성격이나 심리 정보는 수집하지 않아요.</p>`:`<div class="work-field-pair"><label class="field">소통 방식${workSelect('communication',draft.communication)}</label><label class="field">일하는 방식${workSelect('workMode',draft.workMode)}</label></div><label class="field">주당 참여 가능한 시간<div class="work-hours"><input type="number" name="availableHours" min="0" max="80" step="0.5" inputmode="decimal" value="${draft.availableHours??''}" placeholder="미확인"><span>시간 / 주</span></div><small>전체 근무시간이 아닌, 함께할 업무에 쓸 수 있는 시간이에요. 지금 여유가 없으면 0시간으로 남기세요.</small></label><label class="work-consent"><input type="checkbox" name="participates" ${draft.participates?'checked':''}><span>업무 카드를 관리자·내 팀장에게 공유하고 직접 팀 구성 검토에 사용하는 데 동의해요.</span></label><label class="work-confirm"><input type="checkbox" name="confirmed" required><span>현재 내 업무 정보가 맞는지 직접 확인했어요.</span></label>`}<div id="marin-work-error" class="work-error" role="alert" hidden></div><div class="work-form-footer">${second?'<button type="button" class="btn quiet" data-marin-work="profile-back">이전</button>':marinWork.profile?`<div class="work-own-controls">${marinWork.profile.participates?'<button type="button" class="text-button" data-marin-work="profile-withdraw">공유 철회</button>':''}<button type="button" class="text-button" data-marin-work="profile-delete">카드 삭제</button></div>`:'<small>기본은 나만 보관해요.</small>'}<button type="submit" class="btn primary">${second?'확인한 정보 저장':'다음'}${icon('arrow')}</button></div>${marinWork.profile?.confirmedAt?`<p class="work-confirmed-date">본인 확인 ${escape(time(marinWork.profile.confirmedAt))} · ${marinWork.profile.participates?'공유 중':'비공유'}</p>`:''}</form>`;
}
function captureMarinProfile(form){
  const data=new FormData(form),draft=marinWork.draft;
  if(marinWork.step===1){draft.skills=workIds(data.getAll('skills'));draft.preferredTasks=workIds(data.getAll('preferredTasks'),'preferredTasks');}
  else{draft.communication=data.get('communication')||null;draft.workMode=data.get('workMode')||null;draft.availableHours=workHours(data.get('availableHours'));draft.participates=data.get('participates')==='on';draft.confirmed=data.get('confirmed')==='on';}
  return draft;
}
function marinProfilePayload(draft){
  if(draft.confirmed!==true)throw new Error('내 업무 정보가 맞는지 확인해 주세요.');
  for(const key of ['communication','workMode'])if(draft[key]!=null&&!workOptions(key).some(row=>row.value===draft[key]))throw new Error('협업 방식을 다시 선택해 주세요.');
  return{skills:workIds(draft.skills),preferredTasks:workIds(draft.preferredTasks,'preferredTasks'),communication:draft.communication||null,workMode:draft.workMode||null,availableHours:workHours(draft.availableHours),participates:Boolean(draft.participates),confirmed:true};
}
async function saveMarinProfile(form){
  if(marinWork.pending||marinWork.userId!==state.user?.id)return;
  try{captureMarinProfile(form);if(marinWork.step===1){marinWork.step=2;renderMarinProfile();document.querySelector('#marin-profile-form select')?.focus();return;}const payload=marinProfilePayload(marinWork.draft);await mutateMarinProfile('/api/crew-profile',payload,'내 업무 카드를 저장했어요.');}catch(error){workError(error.message);}
}
async function mutateMarinProfile(path,payload,message){
  if(marinWork.pending||marinWork.userId!==state.user?.id)return;const userId=state.user.id,version=state.modalRequest,request=++marinWork.request;marinWork.pending=true;
  document.querySelectorAll('#overlay [data-marin-work],#overlay button[type="submit"]').forEach(button=>button.disabled=true);
  try{await api(path,{...payload,expectedRevision:marinWork.revision});if(!workActive(version,userId)||request!==marinWork.request)return;closeModal();notify(message);}
  catch(error){if(workActive(version,userId)&&request===marinWork.request){if(error.status===409){const loading=openMarinProfile(),latestVersion=state.modalRequest;await loading;if(workActive(latestVersion,userId)&&document.getElementById('marin-profile-form'))workError('다른 화면에서 변경된 최신 카드를 다시 불러왔어요. 공유 여부와 내용을 다시 확인해 주세요.');return;}workError(error.message);document.querySelectorAll('#overlay [data-marin-work],#overlay button[type="submit"]').forEach(button=>button.disabled=false);}}
  finally{if(marinWork.userId===userId&&request===marinWork.request)marinWork.pending=false;}
}
function confirmMarinProfileDelete(){
  if(!marinWork.profile||marinWork.pending)return;
  modal('내 업무 카드를 삭제할까요?','저장한 업무 정보와 공유 동의를 지워요.',`<p class="work-help">나중에 새 업무 카드를 직접 만들 수 있어요. 기존 회사 소속이나 대화는 바뀌지 않아요.</p><div id="marin-work-error" class="work-error" role="alert" hidden></div><div class="modal-actions"><button type="button" class="btn" data-marin-work="profile-retry">취소</button><button type="button" class="btn danger" data-marin-work="profile-delete-confirm">내 카드 삭제</button></div>`);
}
async function openMarinTeamBuilder(){
  if(!state.user||!canManageTeam()){notify('팀 구성은 관리자와 팀장이 살펴볼 수 있어요.');return;}
  const userId=state.user.id;resetMarinWork();marinWork.userId=userId;
  modal('팀 구성 살펴보기','공유에 동의한 업무 카드를 보고 직접 골라보세요.','<p class="work-loading" role="status">열람 가능한 크루를 불러오고 있어요.</p>',true);const version=state.modalRequest;
  try{const [data,own]=await Promise.all([api('/api/crew-work/roster'),api('/api/crew-profile')]);if(!workActive(version,userId))return;marinWork.roster=data;marinWork.catalog=own.catalog||{};renderMarinTeamBuilder();}
  catch(error){if(workActive(version,userId))document.querySelector('#overlay .modal-body').innerHTML=`<p class="work-error" role="alert">${escape(error.message)}</p><button type="button" class="btn" data-marin-work="team-retry">다시 불러오기</button>`;}
}
function crewWorkCard(person){
  const profile=person.profile,shared=person.shared===true&&Boolean(profile),hours=profile?.availableHours;
  const missingLabels={skills:'업무 역량',preferredTasks:'선호 업무',communication:'소통 방식',workMode:'일하는 방식',availableHours:'참여 시간'},missing=(Array.isArray(person.completeness?.missing)?person.completeness.missing:[]).filter(key=>Object.hasOwn(missingLabels,key)).map(key=>missingLabels[key]);
  return `<label class="crew-work-card ${shared?'shared':'unshared'}"><input type="checkbox" data-work-member="${escape(person.id)}" ${marinWork.selected.has(person.id)?'checked':''} ${shared?'':'disabled'}><span class="crew-work-card-content"><span class="crew-work-person"><strong>${escape(person.name)}</strong><small>${escape(person.teamName||'팀 미배정')}</small>${shared?`<span class="work-capacity">${hours==null?'시간 미확인':`${number(hours)}시간 / 주`}</span>`:'<span class="work-capacity">미등록 또는 미공유</span>'}</span>${shared?`<span class="crew-work-skills">${profile.skills?.length?profile.skills.map(value=>escape(workLabel(value))).join(' · '):'역량 미확인'}</span>${profile.preferredTasks?.length?`<small>선호 · ${profile.preferredTasks.map(value=>escape(workLabel(value,'preferredTasks'))).join(' · ')}</small>`:''}<small>${escape(workLabel(profile.communication,'communication'))} · ${escape(workLabel(profile.workMode,'workMode'))}</small><small class="crew-work-confirmed">본인 확인 ${profile.confirmedAt?escape(time(profile.confirmedAt)):'미확인'}</small>${missing.length?`<small class="crew-work-missing">미입력: ${escape(missing.join(' · '))}</small>`:''}`:'<small>본인이 공유에 동의하면 업무 정보를 볼 수 있어요.</small>'}</span></label>`;
}
function renderMarinTeamBuilder(){
  const data=marinWork.roster;if(!data)return;const criteria=marinWork.criteria;
  document.querySelector('#overlay .modal-body').innerHTML=`<form id="marin-team-form" data-marin-form="team" class="crew-work-builder"><div class="crew-work-scope"><strong>${data.scope?.type==='team'?escape(data.scope.teamName||'내 팀'):'회사 전체'}</strong><span>공유 ${data.summary?.sharedCount||0} / ${data.summary?.activeCount||0}명</span></div>${data.summary?.sharedCount===0?'<div class="crew-work-onboarding"><p class="work-help">아직 공유된 업무 카드가 없어요. 각 크루가 업무 카드를 작성하고 공유하면 이곳에서 선택할 수 있어요.</p><button type="button" class="btn quiet" data-marin-work="profile-open">내 업무 카드 작성</button></div>':''}<details class="work-detail crew-work-conditions" ${criteria.requiredSkills.length?'open':''}><summary>필요한 역할·시간 정하기</summary><label class="field">프로젝트 이름 <small>선택</small><input name="projectName" maxlength="80" value="${escape(criteria.projectName)}" placeholder="예: 가을 캠페인"></label><fieldset><legend>필요한 역할·역량</legend>${workTags('skills',criteria.requiredSkills,'requiredSkills')}</fieldset><label class="field work-min-hours">한 사람당 필요한 시간<div class="work-hours"><input type="number" name="minAvailableHours" min="0" max="80" step="0.5" value="${criteria.minAvailableHours}" inputmode="decimal"><span>시간 / 주</span></div></label></details><p class="work-help">크루를 직접 선택하세요. 선택한 조합의 역할·시간 조건만 비교하며, 사람을 자동으로 고르거나 배정하지 않아요.</p><div class="crew-work-list">${data.members?.length?data.members.map(crewWorkCard).join(''):'<p class="work-empty">현재 범위에 크루가 없어요.</p>'}</div><div id="marin-work-error" class="work-error" role="alert" hidden></div><div class="work-form-footer crew-work-footer"><span id="crew-work-selected" aria-live="polite">${marinWork.selected.size}명 선택</span><button type="submit" class="btn primary">선택한 구성 확인${icon('arrow')}</button></div><div id="crew-work-result" aria-live="polite">${marinWork.result?crewWorkResultHtml(marinWork.result):''}</div></form>`;
}
function crewWorkPayload(values){
  const requiredSkills=workIds(values.requiredSkills);if(!requiredSkills.length)throw new Error('‘필요한 역할·시간 정하기’에서 필요한 역할을 선택해 주세요.');
  const visible=new Set((marinWork.roster?.members||[]).filter(person=>person.shared===true).map(person=>person.id));
  const memberIds=[...marinWork.selected].filter(id=>visible.has(id));if(!memberIds.length)throw new Error('함께할 크루를 한 명 이상 직접 선택해 주세요.');if(memberIds.length>20)throw new Error('한 번에 20명까지 구성을 확인할 수 있어요.');
  return{requiredSkills,memberIds,minAvailableHours:workHours(values.minAvailableHours)??0};
}
async function evaluateMarinTeam(form){
  if(marinWork.pending||!canManageTeam()||marinWork.userId!==state.user?.id)return;
  let payload;try{const values=new FormData(form);marinWork.criteria={projectName:String(values.get('projectName')||'').slice(0,80),requiredSkills:workIds(values.getAll('requiredSkills')),minAvailableHours:workHours(values.get('minAvailableHours'))??0};payload=crewWorkPayload(marinWork.criteria);}catch(error){workError(error.message);document.querySelector('.crew-work-conditions')?.setAttribute('open','');return;}
  const userId=state.user.id,version=state.modalRequest,request=++marinWork.request;marinWork.pending=true;workError('');form.querySelector('button[type="submit"]').disabled=true;
  try{const result=await api('/api/crew-work/evaluate',payload);if(!workActive(version,userId)||request!==marinWork.request)return;marinWork.result=result;const target=document.getElementById('crew-work-result');if(target){target.innerHTML=crewWorkResultHtml(result);target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}}
  catch(error){if(workActive(version,userId)&&request===marinWork.request)workError(error.message);}
  finally{if(workActive(version,userId)&&request===marinWork.request){marinWork.pending=false;const submit=document.querySelector('#marin-team-form button[type="submit"]');if(submit)submit.disabled=false;}}
}
function crewWorkResultHtml(result){
  const selected=Array.isArray(result.selected)?result.selected:[],availability=Array.isArray(result.availability)?result.availability:[];
  const statusText=row=>row.status==='available'?'시간 조건 충족':row.status==='zero'?'현재 가능 시간 0':row.status==='insufficient'?`${number(row.shortfall)}시간 부족`:'가능 시간 미확인';
  return `<section class="crew-work-review"><header><h3>${escape(marinWork.criteria.projectName||'선택한 구성')} 검토</h3><p>${selected.length}명을 그대로 검토했어요. 업무 카드의 같은 역할과 가능 시간을 대조한 결과예요.</p></header><ul class="crew-work-coverage">${(result.coverage||[]).map(row=>`<li class="${row.covered?'covered':'missing'}"><strong>${escape(workLabel(row.skill))}</strong><span>${row.covered?`본인 기재 · ${(row.memberIds||[]).map(id=>selected.find(person=>person.id===id)?.name||'선택한 크루').join(', ')}`:'업무 카드에서 아직 확인되지 않음'}</span></li>`).join('')}</ul><div class="crew-work-availability">${availability.map(row=>{const person=selected.find(person=>person.id===row.userId);return `<p><strong>${escape(person?.name||'선택한 크루')}</strong><span>${escape(statusText(row))}</span></p>`;}).join('')}</div>${result.warnings?.length?`<ul class="crew-work-warnings">${result.warnings.map(note=>`<li>${escape(note)}</li>`).join('')}</ul>`:''}<p class="work-help">실제 참여는 크루와 다시 확인하세요. 팀을 바꾸려면 팀 관리에서 직접 진행해 주세요.</p><button type="button" class="btn small" data-action="command-tab" data-tab="members">팀 관리 열기${icon('arrow')}</button></section>`;
}
document.addEventListener('submit',event=>{const form=event.target.closest?.('[data-marin-form]');if(!form)return;event.preventDefault();if(form.dataset.marinForm==='profile')void saveMarinProfile(form);if(form.dataset.marinForm==='team')void evaluateMarinTeam(form);});
document.addEventListener('change',event=>{const member=event.target.closest?.('[data-work-member]');if(member&&!member.disabled){if(member.checked)marinWork.selected.add(member.dataset.workMember);else marinWork.selected.delete(member.dataset.workMember);const count=document.getElementById('crew-work-selected');if(count)count.textContent=`${marinWork.selected.size}명 선택`;}
  if(event.target.closest?.('#marin-team-form')){marinWork.request++;marinWork.pending=false;marinWork.result=null;const result=document.getElementById('crew-work-result');if(result)result.innerHTML='';const submit=document.querySelector('#marin-team-form button[type="submit"]');if(submit)submit.disabled=false;}
});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-marin-work]');if(!target||target.disabled)return;const action=target.dataset.marinWork;
  if(action==='profile-retry'||action==='profile-open')void openMarinProfile();if(action==='team-retry')void openMarinTeamBuilder();
  if(action==='profile-back'){try{captureMarinProfile(document.getElementById('marin-profile-form'));marinWork.step=1;renderMarinProfile();}catch(error){workError(error.message);}}
  if(action==='profile-withdraw'&&marinWork.profile)void mutateMarinProfile('/api/crew-profile',marinProfilePayload({...marinWork.profile,participates:false,confirmed:true}),'업무 카드 공유를 철회했어요.');
  if(action==='profile-delete')confirmMarinProfileDelete();if(action==='profile-delete-confirm')void mutateMarinProfile('/api/crew-profile/delete',{},'내 업무 카드를 삭제했어요.');
});
