'use strict';
const wa={company:'all',userId:null,inviteToken:'',invite:null,inviteError:'',inviteLoading:false,work:null,workKey:'',workLoading:false,workError:'',request:0};
function waAccess(){return state.user?.workspaceAccess||{legacy:true,features:[],memberships:[],duties:[],companies:[]};}
function waCatalog(){return state.data?.workspaceCatalog||{companies:[],duties:[],classification:[]};}
function waFeature(feature){
  const access=waAccess();
  if(!state.user)return false;
  if(!access.admin&&!(access.legacy&&!['path','lectures'].includes(feature))&&!access.features.includes(feature))return false;
  if(wa.company==='all')return true;
  if(waCatalog().duties.some(row=>access.duties.includes(row.id)&&row.features.includes(feature)))return true;
  const company=waCatalog().companies.find(row=>row.id===wa.company),member=access.memberships.find(row=>row.company===wa.company);
  if(feature==='pages'||feature==='social')return false;
  if(feature==='teaching'&&member?.role==='operations'||feature==='lectures'&&member?.role==='automation')return false;
  return Boolean(company?.features.includes(feature));
}
function waWorkroomViews(){return [['desk','제작 데스크'],['trends','트렌드·레퍼런스'],['tools','제작 도구'],['clients','고객 관리'],['pages','내 관리 페이지']].filter(([id])=>waFeature(id==='clients'?'clients':id==='pages'?'pages':'production')).map(([id])=>id);}
function waViewAllowed(view){
  if(!state.user)return true;
  if(view==='workroom')return waWorkroomViews().length>0;
  if(['teaching','lectures','path'].includes(view))return waFeature(view);
  if(['content','studio'].includes(view))return waFeature('production');
  if(['social','marketing','mine','team','all','overview','analysis','history','summary','channels','collection'].includes(view))return waFeature('social');
  if(view==='members')return canManageTeam();if(view==='settings')return isAdmin();
  return true;
}
function workspaceAvailableTabs(){return workspacePrimaryTabs.filter(([id])=>waViewAllowed(id));}
function waNavigationAllowed(view){
  if(waViewAllowed(view))return true;
  // A permitted source link may belong to another concurrently held company.
  const previous=wa.company;wa.company='all';
  if(waViewAllowed(view))return true;
  wa.company=previous;return false;
}
function waNormalizeView(){
  if(!state.user){wa.userId=null;wa.company='all';wa.work=null;wa.workKey='';wa.workLoading=false;wa.request++;return;}
  if(wa.userId!==state.user.id){wa.userId=state.user.id;wa.company='all';wa.work=null;wa.workKey='';wa.request++;}
  if(wa.company!=='all'&&!waAccess().companies.includes(wa.company))wa.company='all';
  if(!waViewAllowed(state.tab))state.tab='home';
  if(state.tab==='workroom'&&typeof wr!=='undefined'&&!waWorkroomViews().includes(wr.view))wr.view=waWorkroomViews()[0]||'desk';
}
function waMembershipText(access){
  if(access?.admin&&!access.memberships?.length)return '관리자 · 전체 회사';
  if(!access?.configured)return '회사·직무 미지정';
  return access.memberships.map(row=>{const company=waCatalog().companies.find(item=>item.id===row.company);return row.company+' · '+(company?.roles.find(([id])=>id===row.role)?.[1]||row.role);}).join(' / ')||'전사 공통 업무';
}
function waHome(){
  const access=waAccess(),companies=waCatalog().companies.filter(row=>access.companies.includes(row.id));
  const link=(label,tab,section='')=>button(label,'wa-open','arrow','small quiet',`data-tab="${tab}" data-section="${section}"`);
  const pulse=(access.admin||access.companies.includes('PULSE'))&&['all','PULSE'].includes(wa.company);
  const companyLinks=[waFeature('teaching')?link('LAB 수업','teaching'):'',waFeature('path')?link('PATH 상담·정착','path'):'',waFeature('lectures')?link('SHIFT 강의','lectures'):'',pulse&&waFeature('production')?link('PULSE 제작실','workroom','desk'):'',pulse&&waFeature('clients')?link('PULSE 고객 관리','workroom','clients'):''].filter(Boolean);
  const dutyLinks=[waFeature('social')?link('SNS·마케팅','social'):'',!pulse&&waFeature('production')?link('콘텐츠 제작','workroom','desk'):'',!pulse&&waFeature('clients')?link('고객 관리','workroom','clients'):'',waFeature('pages')?link('페이지 관리','workroom','pages'):'',waFeature('feedback')?'<a class="btn small quiet" href="/trial-feedback/">체험 의견</a>':'',canManageTeam()?link('팀·크루','members'):'',isAdmin()?link('회사 설정','settings'):''].filter(Boolean);
  return `<section class="wa-context" aria-label="내 소속과 업무"><div><span class="wa-eyebrow">내 워크스페이스</span><strong>${escape(waMembershipText(access))}</strong>${!access.configured&&!access.admin?'<p>기존 계정의 권한을 유지하고 있어요. 관리자에게 회사와 담당 업무 지정을 요청해 주세요.</p>':'<p>전사 공통 도구와 배정된 업무를 함께 사용해요.</p>'}</div>${companies.length>1?`<label>회사별로 보기<select data-wa-company><option value="all">겸임 업무 모두</option>${companies.map(row=>`<option value="${row.id}" ${wa.company===row.id?'selected':''}>${row.name}</option>`).join('')}</select></label>`:''}</section><div class="wa-groups"><section><h2>전사 공통</h2><div>${link('메신저','messenger')}${button('내 할 일','marin-workroom-panel','','small quiet','data-panel="tasks"')}${button('내 업무 카드','marin-profile','','small quiet')}${link('회사 안내','handbook')}</div></section>${companyLinks.length?`<section><h2>회사별</h2><div>${companyLinks.join('')}</div></section>`:''}${dutyLinks.length?`<section><h2>담당자 전용</h2><div>${dutyLinks.join('')}</div></section>`:''}</div>`;
}
function waFields(access={memberships:[],duties:[]}){
  return `<fieldset class="wa-companies"><legend>소속 회사와 직무</legend><p>겸임이면 여러 회사를 골라 주세요.</p>${waCatalog().companies.map(company=>{const member=access.memberships.find(row=>row.company===company.id);return `<div class="wa-company-row"><label class="check-row"><input type="checkbox" name="waCompany" value="${company.id}" ${member?'checked':''}><span>${company.name}</span></label><label class="field"><span class="sr-only">${company.name} 직무</span><select name="waRole_${company.id}" aria-label="${company.name} 직무" ${member?'':'disabled'}>${company.roles.map(([id,label])=>`<option value="${id}" ${member?.role===id?'selected':''}>${label}</option>`).join('')}</select></label></div>`;}).join('')}</fieldset><fieldset class="wa-duties"><legend>추가 담당 업무</legend><p>소속에서 제공하는 기능 외에 맡을 업무를 골라 주세요.</p>${waCatalog().duties.map(row=>`<label class="check-row"><input type="checkbox" name="waDuty" value="${row.id}" ${access.duties.includes(row.id)?'checked':''}><span>${row.label}</span></label>`).join('')}</fieldset>`;
}
function waReadFields(form){const fields=new FormData(form);return {memberships:fields.getAll('waCompany').map(company=>({company,role:fields.get('waRole_'+company)})),duties:fields.getAll('waDuty')};}
function waMemberModal(id){
  const member=state.data.members.find(row=>row.id===id);if(!member||!isAdmin())return;
  const access=member.workspaceAccess||{memberships:[],duties:[],revision:0};
  modal('회사·직무·담당 업무',escape(member.name),`<form data-form="wa-member" data-id="${escape(id)}" data-revision="${access.revision||0}" class="form-stack"><div class="form-error" role="alert"></div>${waFields(access)}<p class="notice">저장하면 다음 로그인부터 적용돼요. 다른 기기의 로그인은 종료됩니다. 소속을 모두 해제하면 전사 공통 기능만 남아요.</p><div class="modal-actions">${button('취소','close-modal')}<button type="submit" class="btn primary">저장</button></div></form>`);
}
async function waInvites(){
  modal('초대 관리','초대는 3일 동안 한 번만 사용할 수 있어요.','<p role="status">초대를 불러오고 있어요.</p>',true);
  const request=state.modalRequest,userId=state.user.id,result=await api('/api/workspace-invites');
  if(request!==state.modalRequest||state.user?.id!==userId)return;
  document.querySelector('.modal-body').innerHTML=`<div class="wa-invites">${result.invites.length?result.invites.map(row=>`<article><div><strong>${escape(row.name)}</strong><p>${escape(row.email)}</p><p>${escape(row.memberships.map(item=>item.company).join(' · '))} · ${escape(({pending:'초대 중',accepted:'입장 완료',expired:'만료',revoked:'취소'})[row.status])}</p><small>만료 ${escape(new Date(row.expiresAt).toLocaleString('ko-KR'))}</small></div>${row.status==='pending'?button('초대 취소','wa-revoke','','small',`data-id="${escape(row.id)}"`):''}</article>`).join(''):'<p>아직 만든 초대가 없어요.</p>'}</div>`;
}
function waAuthMount(join){
  if(!state.user)waNormalizeView();
  if(join){
    const form=document.getElementById('auth-form');if(!form)return;
    form.insertAdjacentHTML('afterbegin','<div id="wa-invite-summary" role="status">초대를 확인하고 있어요.</div>');
    form.querySelector('[type="submit"]').disabled=true;
    if(wa.inviteToken!==state.authToken){wa.inviteToken=state.authToken;wa.invite=null;wa.inviteError='';wa.inviteLoading=false;}
    if(wa.invite||wa.inviteError)waPaintInvite();else if(!wa.inviteLoading)void waInspectInvite();
  }else if(state.authMode==='login'){
    document.querySelector('.auth-form-card')?.insertAdjacentHTML('beforeend','<details class="wa-code-entry"><summary>초대 코드로 입장</summary><form data-form="wa-code" class="form-stack"><div class="form-error" role="alert"></div><label class="field">초대 코드 또는 링크<input name="code" required maxlength="600" autocomplete="off" placeholder="관리자에게 받은 코드를 붙여 넣으세요"></label><button type="submit" class="btn primary">초대 확인</button></form></details>');
  }
}
function waPaintInvite(){
  const host=document.getElementById('wa-invite-summary'),form=document.getElementById('auth-form');if(!host||!form)return;
  const submit=form.querySelector('[type="submit"]');submit.disabled=!wa.invite;
  if(wa.inviteError){host.textContent=wa.inviteError;host.setAttribute('role','alert');return;}
  if(!wa.invite)return;
  host.innerHTML=`<strong>${escape(wa.invite.name)} 님의 초대</strong><p>${escape(wa.invite.memberships.map(row=>row.company).join(' · ')||'기존 팀 초대')} · 회사와 직무는 관리자가 지정했어요.</p>`;
  const name=form.querySelector('[name="name"]');if(name&&!name.value)name.value=wa.invite.name;
}
async function waInspectInvite(){
  const token=state.authToken;wa.inviteLoading=true;
  try{const result=await api('/api/workspace-invite/inspect',{token});if(state.authMode!=='join'||state.authToken!==token)return;wa.invite=result;}
  catch(error){if(state.authToken===token)wa.inviteError=error.message;}
  finally{if(state.authToken===token){wa.inviteLoading=false;waPaintInvite();}}
}
function waWorkCompany(){return state.tab==='path'?'PATH':'SHIFT';}
function waWorkPage(){
  const company=waWorkCompany(),title=company==='PATH'?'상담·정착 업무':'강의',key=state.user.id+':'+company;
  if(wa.workKey!==key){wa.workKey=key;wa.work=null;wa.workError='';wa.workLoading=false;wa.request++;queueMicrotask(()=>waLoadWork());}
  const data=wa.work;
  return `<section class="wa-work">${pageHeading('',title,company==='PATH'?'내 상담과 정착 지원 업무를 기록하고 이어가요.':'강의 일정과 준비할 내용을 관리해요.',!isViewer()?button(company==='PATH'?'업무 추가':'강의 추가','wa-work-edit','plus','primary'):'')}<p class="wa-scope">SYNK ${company} · 내 기록과 회사 책임자가 확인할 수 있어요.</p>${wa.workError?`<p role="alert">${escape(wa.workError)}</p>${button('다시 불러오기','wa-work-refresh','refresh')}`:''}${!data?`<p role="status">${wa.workLoading?'업무를 불러오고 있어요.':'업무를 준비하고 있어요.'}</p>`:data.items.length?`<div class="wa-work-list">${data.items.map(row=>`<article><div><span class="wa-eyebrow">${row.status==='done'?'완료':'진행 중'} · ${escape(row.date||'일정 미정')} · ${escape(row.ownerName)}</span><h2>${escape(row.title)}</h2><p>${escape(row.note)}</p></div>${data.canWrite?button('수정','wa-work-edit','','small',`data-id="${escape(row.id)}"`):''}</article>`).join('')}</div>`:`<div class="empty"><h2>아직 등록한 ${company==='PATH'?'업무가':'강의가'} 없어요.</h2><p>제목과 일정을 적어 첫 기록을 만들어 보세요.</p></div>`}</section>`;
}
async function waLoadWork(){
  if(!['path','lectures'].includes(state.tab)||wa.workLoading)return;
  const company=waWorkCompany(),key=wa.workKey,request=++wa.request;wa.workLoading=true;wa.workError='';
  try{const result=await api('/api/company-work/'+company);if(request===wa.request&&key===wa.workKey)wa.work=result;}
  catch(error){if(request===wa.request)wa.workError=error.message;}
  finally{if(request===wa.request){wa.workLoading=false;if(['path','lectures'].includes(state.tab))renderBackground();}}
}
function waWorkModal(id){
  const row=wa.work?.items.find(item=>item.id===id),company=waWorkCompany();
  if(id&&!row)return;
  modal(company==='PATH'?'상담·정착 업무':'강의 일정',row?'기록을 수정해요.':'제목과 일정을 정해 주세요.',`<form class="form-stack" data-form="wa-work" data-id="${escape(id||'')}" data-company="${company}" data-revision="${row?.revision||0}"><div class="form-error" role="alert"></div><label class="field">제목<input name="title" required maxlength="160" value="${escape(row?.title||'')}"></label><label class="field">일정<input name="date" type="date" value="${escape(row?.date||'')}"></label><label class="field">준비할 내용<textarea name="note" maxlength="2000" rows="5">${escape(row?.note||'')}</textarea></label><label class="field">진행 상태<select name="status"><option value="open">진행 중</option><option value="done" ${row?.status==='done'?'selected':''}>완료</option></select></label><div class="modal-actions">${button('취소','close-modal')}<button type="submit" class="btn primary">저장</button></div></form>`);
}
document.addEventListener('change',event=>{
  if(event.target.name==='waCompany'){const select=event.target.form.elements.namedItem('waRole_'+event.target.value);if(select)select.disabled=!event.target.checked;}
  if(event.target.matches('[data-wa-company]')){wa.company=event.target.value;waNormalizeView();render();document.querySelector('[data-wa-company]')?.focus();}
});
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]'),action=target?.dataset.action;
  if(!action?.startsWith('wa-'))return;event.preventDefault();event.stopImmediatePropagation();
  const run=async()=>{if(action==='wa-open'){selectWorkspaceView(target.dataset.tab,target.dataset.section);render();}if(action==='wa-member')waMemberModal(target.dataset.id);if(action==='wa-invites')await waInvites();if(action==='wa-revoke'){target.disabled=true;await api('/api/workspace-invites/'+encodeURIComponent(target.dataset.id)+'/revoke',{});await waInvites();notify('초대를 취소했어요.');}if(action==='wa-work-edit')waWorkModal(target.dataset.id);if(action==='wa-work-refresh')await waLoadWork();};
  void run().catch(error=>{target.disabled=false;notify(error.message);});
},true);
document.addEventListener('submit',event=>{
  const form=event.target;if(!form.dataset.form?.startsWith('wa-'))return;
  event.preventDefault();event.stopImmediatePropagation();const submit=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error'),values=Object.fromEntries(new FormData(form));submit.disabled=true;error.textContent='';
  const run=async()=>{
    if(form.dataset.form==='wa-code'){
      let token=values.code.trim();if(token.includes('#')){try{token=new URL(token,location.origin).hash.slice(1);token=new URLSearchParams(token).get('invite')||'';}catch{token='';}}
      if(!/^[A-Za-z0-9_-]{32,200}$/.test(token))throw new Error('받은 초대 코드나 링크를 다시 확인해 주세요.');
      const details=await api('/api/workspace-invite/inspect',{token});wa.inviteToken=token;wa.invite=details;wa.inviteError='';state.authMode='join';state.authToken=token;renderAuth();
    }else if(form.dataset.form==='wa-member'){
      await api('/api/members/'+encodeURIComponent(form.dataset.id)+'/workspace-profile',{revision:Number(form.dataset.revision),workspaceProfile:waReadFields(form)});closeModal();await loadState();notify('회사와 담당 업무를 저장했어요.');
    }else if(form.dataset.form==='wa-work'){
      await api('/api/company-work/'+form.dataset.company+(form.dataset.id?'/'+encodeURIComponent(form.dataset.id):''),{...values,revision:Number(form.dataset.revision)});closeModal();await waLoadWork();notify('저장했어요.');
    }
  };
  void run().catch(err=>{error.textContent=err.message;}).finally(()=>{if(form.isConnected)submit.disabled=false;});
},true);
