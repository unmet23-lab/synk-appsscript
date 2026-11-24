'use strict';
const WA_WORK_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const waLocationHref=()=>typeof location!=='undefined'&&location?(location.pathname||'/')+(location.search||'')+(location.hash||''):'';
const wa={company:'all',userId:null,inviteToken:'',invite:null,inviteError:'',inviteLoading:false,inviteRequest:0,inviteHandoff:null,work:null,workKey:'',workLoading:false,workError:'',workQueued:false,workConflictKey:'',workModal:null,request:0,mine:null,mineUserId:null,mineLoading:false,mineQueued:false,mineError:'',mineCheckedAt:0,mineNeedsRefresh:false,mineExpanded:false,mineRequest:0,workTarget:null,workTargetNotice:'',workFocusQueued:false,pendingHref:waLocationHref()};
function waResetInvite(){wa.inviteRequest++;wa.inviteToken='';wa.invite=null;wa.inviteError='';wa.inviteLoading=false;wa.inviteHandoff=null;}
function waResetWork(){wa.work=null;wa.workKey='';wa.workLoading=false;wa.workError='';wa.workConflictKey='';wa.workModal=null;wa.workTarget=null;wa.workTargetNotice='';wa.workFocusQueued=false;wa.request++;}
function waResetMine(){wa.mineRequest++;wa.mine=null;wa.mineUserId=null;wa.mineLoading=false;wa.mineQueued=false;wa.mineError='';wa.mineCheckedAt=0;wa.mineNeedsRefresh=false;wa.mineExpanded=false;}
function waClearWorkTarget(){wa.workTarget=null;}
const waKstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function waParseWorkHref(href){
  if(typeof href!=='string'||!href.startsWith('/?')||/[\\\u0000-\u0020]/.test(href))return null;
  try{
    const origin=typeof location!=='undefined'&&location?.origin?location.origin:'http://localhost';
    const url=new URL(href,origin),q=url.searchParams,tab=q.get('tab'),workId=q.get('workId');
    if(url.origin!==origin||url.pathname!=='/'||url.hash)return null;
    if(!['lectures','path'].includes(tab)||[...q.keys()].length!==2||q.getAll('tab').length!==1||q.getAll('workId').length!==1||!WA_WORK_ID_RE.test(workId||''))return null;
    const canonical=`/?tab=${tab}&workId=${workId}`;
    return url.pathname+url.search===canonical?{tab,company:tab==='path'?'PATH':'SHIFT',workId,href:canonical}:null;
  }catch{return null;}
}
function waInspectWorkLocation(href){
  if(typeof href!=='string'||!href)return{kind:'none'};
  try{
    const origin=typeof location!=='undefined'&&location?.origin?location.origin:'http://localhost';
    const url=new URL(href,origin),q=url.searchParams,tab=q.get('tab');
    if(url.origin!==origin||url.pathname!=='/'||!['lectures','path'].includes(tab))return{kind:'none'};
    if(!q.has('workId'))return{kind:'plain',tab,company:tab==='path'?'PATH':'SHIFT'};
    const parsed=waParseWorkHref(url.pathname+url.search+url.hash);
    return parsed?{kind:'target',...parsed}:{kind:'invalid',tab,company:tab==='path'?'PATH':'SHIFT'};
  }catch{return{kind:'none'};}
}
function waReplaceHref(href){
  if(typeof history!=='undefined'&&typeof history.replaceState==='function')history.replaceState(null,'',href);
}
function waActivateWorkTarget({tab,company,workId,invalid=false}){
  const userId=state.user?.id||null;
  const same=wa.workTarget&&wa.workTarget.userId===userId&&wa.workTarget.tab===tab&&wa.workTarget.company===company&&wa.workTarget.workId===(workId||'')&&Boolean(wa.workTarget.invalid)===Boolean(invalid);
  if(same)return;
  wa.workTarget={userId,tab,company,workId:workId||'',invalid:Boolean(invalid),focused:Boolean(invalid)};
  wa.workTargetNotice='';
  wa.workFocusQueued=false;
  if(!invalid){wa.work=null;wa.workError='';wa.workLoading=false;wa.request++;}
}
function waApplyWorkLocation(info){
  if(!state.user||info.kind==='none'||info.kind==='plain')return false;
  if(!waNavigationAllowed(info.tab)){
    wa.workTarget=null;
    wa.workTargetNotice=info.company==='PATH'
      ?'PATH 상담·정착 업무 열람 권한이 없거나 다른 회사의 업무예요.'
      :'SHIFT 강의 일정 열람 권한이 없거나 다른 회사의 업무예요.';
    state.tab='home';
    waReplaceHref('/?tab=home');
    return true;
  }
  state.tab=info.tab;
  if(info.kind==='invalid'){
    waActivateWorkTarget({tab:info.tab,company:info.company,workId:'',invalid:true});
    waReplaceHref(`/?tab=${info.tab}`);
    return true;
  }
  waActivateWorkTarget(info);
  if(waLocationHref()!==info.href)waReplaceHref(info.href);
  return true;
}
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
function waViewAllowed(view,section=''){
  if(!state.user)return true;
  if(view==='workroom'){
    const target=section==='practice'?'desk':section;
    if(['desk','trends','tools','pages','clients'].includes(target))return waWorkroomViews().includes(target);
    return waWorkroomViews().length>0;
  }
  if(view==='marketing'&&['mine','team','all','overview','analysis','history','content','channels'].includes(section))return waViewAllowed(section);
  if(['teaching','lectures','path'].includes(view))return waFeature(view);
  if(['content','studio'].includes(view))return waFeature('production');
  if(['social','marketing','mine','team','all','overview','analysis','history','summary','channels','collection'].includes(view))return waFeature('social');
  if(view==='admin'||view==='tips')return isAdmin()&&!(typeof isDemoMode==='function'&&isDemoMode());
  if(view==='members')return Boolean(state.user);if(view==='settings')return isAdmin();
  return true;
}
function workspaceAvailableTabs(){return workspacePrimaryTabs.filter(([id])=>waViewAllowed(id));}
function waNavigationAllowed(view,section=''){
  if(waViewAllowed(view,section))return true;
  // A permitted source link may belong to another concurrently held company.
  const previous=wa.company;wa.company='all';
  if(waViewAllowed(view,section))return true;
  wa.company=previous;return false;
}
function waApplyBareLanding(){
  if(!state.user||!state.pendingBareLanding)return false;
  state.pendingBareLanding=false;
  if(typeof isDemoMode==='function'&&isDemoMode())return false;
  if(location.search!==''||location.hash!=='')return false;
  const access=waAccess();
  if(!access?.configured||access.admin||access.companies?.length!==1)return false;
  const domainIds=['workroom','social','teaching','path','lectures'];
  const domains=workspaceAvailableTabs().map(([id])=>id).filter(id=>domainIds.includes(id));
  if(domains.length!==1)return false;
  if(domains[0]==='workroom'){
    const views=waWorkroomViews();
    const section=waFeature('clients')&&waViewAllowed('workroom','clients')&&views.includes('clients')?'clients':waFeature('production')&&waViewAllowed('workroom','desk')&&views.includes('desk')?'desk':views[0]||'desk';
    selectWorkspaceView('workroom',section);
  }else selectWorkspaceView(domains[0]);
  return true;
}
function waNormalizeView(){
  if(!state.user){if(wa.userId)wa.pendingHref='';wa.userId=null;wa.company='all';waResetInvite();waResetWork();waResetMine();return;}
  const firstEntry=wa.userId!==state.user.id;
  if(firstEntry){wa.userId=state.user.id;wa.company='all';waResetInvite();waResetWork();waResetMine();}
  if(wa.company!=='all'&&!waAccess().companies.includes(wa.company))wa.company='all';
  if(typeof wrClearProduction==='function'&&!waFeature('production'))wrClearProduction();
  const liveInfo=firstEntry?waInspectWorkLocation(waLocationHref()):{kind:'none'};
  const pendingInfo=wa.pendingHref?waInspectWorkLocation(wa.pendingHref):{kind:'none'};
  wa.pendingHref='';
  const chosen=liveInfo.kind==='target'||liveInfo.kind==='invalid'?liveInfo:pendingInfo.kind==='target'||pendingInfo.kind==='invalid'?pendingInfo:liveInfo;
  if(chosen.kind==='target'||chosen.kind==='invalid')waApplyWorkLocation(chosen);
  else{
    if(!waViewAllowed(state.tab))state.tab='home';
    if(wa.workTarget&&state.tab!==wa.workTarget.tab)wa.workTarget=null;
    if(!wa.workTarget&&typeof syncWorkspaceLocation==='function'&&typeof location!=='undefined'&&new URLSearchParams(location.search).has('workId'))syncWorkspaceLocation();
  }
  if(state.tab!=='home'&&wa.workTargetNotice)wa.workTargetNotice='';
  if(typeof wr!=='undefined'&&!waWorkroomViews().includes(wr.view))wr.view=waWorkroomViews()[0]||'desk';
}
function waMembershipText(access){
  if(access?.admin&&!access.memberships?.length)return '관리자 · 전체 회사';
  if(!access?.configured)return '회사·직무 미지정';
  const base=access.memberships.map(row=>{const company=waCatalog().companies.find(item=>item.id===row.company);return row.company+' · '+(company?.roles.find(([id])=>id===row.role)?.[1]||row.role);}).join(' / ');
  const duties=(access.duties||[]).map(id=>waCatalog().duties.find(item=>item.id===id)?.label||id).join(', ');
  return [base,duties].filter(Boolean).join(' · ')||'전사 공통 업무';
}
function waScopeBar(){
  const access=waAccess(),companies=waCatalog().companies.filter(row=>access.companies.includes(row.id));
  const legacyBanner=!access.configured&&!access.admin?`<aside class="wa-unassigned-banner" role="note"><strong>기존 계정의 업무 권한을 유지하고 있어요</strong><span>신규 회사별 업무(PATH 상담·정착, SHIFT 강의)가 필요하면 관리자에게 소속 회사·직무 지정을 요청해 주세요.</span></aside>`:'';
  return `<section class="wa-scope-bar" aria-label="내 소속과 보기 범위"><div class="wa-scope-identity"><span class="wa-scope-label">내 소속</span><strong class="wa-scope-summary">${escape(waMembershipText(access))}</strong></div>${companies.length>1?`<label class="wa-company-switch"><span>화면 범위</span><select data-wa-company aria-label="화면에 표시할 회사 범위"><option value="all">겸임 업무 모두</option>${companies.map(row=>`<option value="${escape(row.id)}" ${wa.company===row.id?'selected':''}>${escape(row.name)}</option>`).join('')}</select></label>`:''}</section>${legacyBanner}`;
}
function waHomeTools(){
  const access=waAccess(),demoMode=typeof isDemoMode==='function'&&isDemoMode();
  const arrow=typeof icon==='function'?icon('arrow'):'',chevron=typeof icon==='function'?icon('right'):'';
  const entry=(label,tab,section='',primary=false)=>`<button type="button" class="wa-entry-card${primary?' is-primary':''}" data-action="wa-open" data-tab="${tab}" data-section="${section}"><span class="wa-entry-copy"><strong>${escape(label)}</strong></span>${arrow}</button>`;
  const adminAllowed=isAdmin()&&!demoMode;
  const pulse=(access.admin||access.companies.includes('PULSE'))&&['all','PULSE'].includes(wa.company);
  const explicitFeedback=!access.admin&&!access.legacy&&waFeature('feedback');
  const domains=[
    waFeature('teaching')?entry('LAB 내 수업','teaching'):'',
    waFeature('path')?entry('PATH 상담·정착','path'):'',
    waFeature('lectures')?entry('SHIFT 강의 일정','lectures'):'',
    pulse&&waFeature('clients')?entry('PULSE 고객 관리','workroom','clients'):'',
    pulse&&waFeature('production')?entry('PULSE 제작 데스크','workroom','desk'):'',
    waFeature('social')?entry('SNS·마케팅','social'):'',
    !pulse&&waFeature('clients')?entry('제작 고객 관리','workroom','clients'):'',
    !pulse&&waFeature('production')?entry('콘텐츠 제작','workroom','desk'):'',
    waFeature('pages')?entry('내 관리 페이지','workroom','pages'):'',
    explicitFeedback?`<a class="wa-entry-card" href="/trial-feedback/"><span class="wa-entry-copy"><strong>체험 의견</strong></span>${arrow}</a>`:'',
  ].filter(Boolean);
  if(adminAllowed){
    const adminPrimary=`<div class="wa-primary-entry">${entry('관리자','admin','',true)}</div>`;
    const domainSection=!domains.length?'':wa.company==='all'
      ?`<details class="wa-domain-details"><summary><span>회사별 업무</span>${chevron}</summary><div class="wa-entry-grid">${domains.join('')}</div></details>`
      :`<div class="wa-entry-grid">${domains.join('')}</div>`;
    return `<section class="wa-home-sections" aria-label="내 업무">${adminPrimary}${domainSection}</section>`;
  }
  if(domains.length)return `<section class="wa-home-sections" aria-label="내 업무"><div class="wa-entry-grid">${domains.join('')}</div></section>`;
  const statusCopy=wa.company!=='all'
    ?'선택한 회사 범위에 열린 업무 화면이 없어요. 내 할 일에서 맡은 업무를 확인해 주세요.'
    :'지정된 회사별 업무 화면이 없어요. 내 할 일에서 맡은 업무를 확인해 주세요.';
  return `<section class="wa-home-sections" aria-label="내 업무"><div class="wa-common-only"><p class="wa-common-only-copy">${statusCopy}</p><button type="button" class="wa-entry-card is-primary" data-action="marin-workroom-panel" data-panel="tasks"><span class="wa-entry-copy"><strong>내 할 일</strong></span>${arrow}</button></div></section>`;
}
function waHome(){
  return waScopeBar()+waHomeTools();
}
function waFields(access={memberships:[],duties:[]}){
  return `<fieldset class="wa-fields"><legend>소속 회사와 직무</legend><p class="wa-help">겸임하는 직원은 소속 회사를 여러 곳 선택하고 각 회사의 직무를 골라 주세요.</p>${waCatalog().companies.map(company=>{const member=access.memberships.find(row=>row.company===company.id);return `<div class="wa-company-row"><label class="wa-check"><input type="checkbox" name="waCompany" value="${escape(company.id)}" ${member?'checked':''}><span>${escape(company.name)}<small>${escape(company.summary||'')}</small></span></label><label class="wa-role"><span>${escape(company.name)} 직무</span><select name="waRole_${escape(company.id)}" aria-label="${escape(company.name)} 직무" ${member?'':'disabled'}>${company.roles.map(([id,label])=>`<option value="${escape(id)}" ${member?.role===id?'selected':''}>${escape(label)}</option>`).join('')}</select></label></div>`;}).join('')}</fieldset><fieldset class="wa-fields"><legend>추가 담당 업무</legend><p class="wa-help">소속 회사의 기본 기능 외에 별도로 맡는 전사 담당 업무가 있을 때만 선택해 주세요.</p><div class="wa-duties">${waCatalog().duties.map(row=>`<label class="wa-check"><input type="checkbox" name="waDuty" value="${escape(row.id)}" ${access.duties.includes(row.id)?'checked':''}><span>${escape(row.label)}</span></label>`).join('')}</div></fieldset>`;
}
function waReadFields(form){const fields=new FormData(form);return {memberships:fields.getAll('waCompany').map(company=>({company,role:fields.get('waRole_'+company)})),duties:fields.getAll('waDuty')};}
function waMemberModal(id){
  const member=(state.data?.members||[]).find(row=>row.id===id);if(!member||!isAdmin())return;
  const access=member.workspaceAccess||{memberships:[],duties:[],revision:0};
  const stoppedNote=member.active===false?'<div class="note-box warn"><div><strong>현재 이용 중지된 계정이에요.</strong>배정 내용은 명부에 저장되지만, 이용을 다시 허용하기 전까지 실제 접근 권한은 열리지 않아요.</div></div>':'';
  modal('회사·직무·담당 업무',escape(member.name),`<form data-form="wa-member" data-id="${escape(id)}" data-revision="${access.revision||0}" class="form-stack"><div class="form-error" role="alert"></div>${stoppedNote}${waFields(access)}<p class="notice">저장하면 이 직원의 다른 기기 로그인은 정리되고 새 권한이 적용돼요. 모든 소속과 담당을 해제하면 전사 공통 도구(오늘·메신저·사람·회사 안내)만 남아요.</p><div class="modal-actions">${button('취소','close-modal')}<button type="submit" class="btn primary">배정 저장</button></div></form>`,true);
}
async function waInvites(){
  if(!state.user)return;
  const stamp=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():{userId:state.user.id};
  const current=()=>typeof companyAuthCurrent==='function'?companyAuthCurrent(stamp):state.user?.id===stamp.userId;
  modal('초대 관리','초대 링크와 코드는 3일 동안 한 번만 사용할 수 있어요.','<p class="muted" role="status">초대 내역을 불러오고 있어요.</p>',true);
  if(typeof adminNoteInvitesModalOpened==='function')adminNoteInvitesModalOpened();
  const request=state.modalRequest;
  const findBody=()=>(typeof overlay!=='undefined'&&overlay?.querySelector?.('.modal-body'))||document.querySelector?.('.modal-body')||null;
  try{
    const result=await api('/api/workspace-invites');
    if(request!==state.modalRequest||!current())return;
    const body=findBody();if(!body)return;
    const recoveredRaw=typeof takePendingInviteRecovery==='function'?takePendingInviteRecovery(stamp):null;
    const recovered=recoveredRaw&&(!recoveredRaw.id||!result.invites.some(row=>row.id===recoveredRaw.id&&row.status!=='pending'))?recoveredRaw:null;
    const recoveredHtml=recovered&&typeof inviteResultMarkup==='function'?inviteResultMarkup(recovered):'';
    const listHtml=result.invites.length?`<div class="wa-invites-list">${result.invites.map(row=>{const statusText=({pending:'대기 중',accepted:'수락 완료',expired:'만료됨',revoked:'취소됨'})[row.status]||row.status;return `<article class="wa-invite-row"><div><strong>${escape(row.name)}</strong><span>${escape(row.email)}</span><p>${escape(row.memberships.map(item=>item.company).join(' · ')||'전사 공통')} · ${escape(statusText)}</p><small>만료 시각: ${escape(new Date(row.expiresAt).toLocaleString('ko-KR'))}</small></div>${row.status==='pending'?button('초대 취소','wa-revoke','','small danger',`data-id="${escape(row.id)}"`):''}</article>`;}).join('')}</div>`:empty('아직 발급한 초대가 없어요','설정이나 사람·조직에서 직원을 초대하면 대기 중인 초대를 여기서 관리할 수 있어요.','',true,'users');
    body.innerHTML=recoveredHtml+listHtml;
  }catch(error){
    if(error?.code==='SESSION_CHANGED')return;
    if(request===state.modalRequest&&current()){
      const body=findBody();
      if(body)body.innerHTML=`<div class="wa-invites-error"><p class="form-error" role="alert">${escape(error.message||'초대 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')}</p><div class="modal-actions"><button type="button" class="btn small" data-action="wa-invites">다시 불러오기</button></div></div>`;
    }
  }
}
function waAuthMount(join){
  const handoff=join&&!state.user&&wa.inviteHandoff?.token===state.authToken?wa.inviteHandoff.details:null;
  if(!state.user)waNormalizeView();
  waResetInvite();
  if(join){
    const form=document.getElementById('auth-form');if(!form)return;
    if(!document.getElementById('wa-invite-summary'))form.insertAdjacentHTML('afterbegin','<div id="wa-invite-summary" class="wa-invite-summary" role="status">초대를 확인하고 있어요.</div>');
    const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
    wa.inviteToken=state.authToken;
    if(handoff){wa.invite=handoff;waPaintInvite();}
    else void waInspectInvite();
  }else if(state.authMode==='login'){
    const card=document.querySelector('.auth-form-card');
    if(card&&!card.querySelector('.wa-code-entry'))card.insertAdjacentHTML('beforeend','<details class="wa-code-entry"><summary>초대 코드로 합류하기</summary><form data-form="wa-code" class="form-stack"><div class="form-error" role="alert"></div><label class="field">초대 코드 또는 초대 링크<input name="code" required maxlength="600" autocomplete="off" placeholder="관리자에게 받은 초대 코드나 링크를 붙여 넣어 주세요"></label><button type="submit" class="btn">초대 확인</button></form></details>');
  }
}
function waPaintInvite(){
  const host=document.getElementById('wa-invite-summary'),form=document.getElementById('auth-form');
  const submit=form?.querySelector?.('[type="submit"]');if(submit)submit.disabled=!wa.invite||wa.inviteLoading;
  if(!host)return;
  if(wa.inviteLoading){
    host.className='wa-invite-summary';
    host.setAttribute('role','status');
    host.textContent='초대를 확인하고 있어요.';
    host.innerHTML='초대를 확인하고 있어요.';
    return;
  }
  if(wa.inviteError){
    host.className='wa-invite-summary is-error';
    host.setAttribute('role','alert');
    host.textContent=wa.inviteError;
    host.innerHTML=`<p>${escape(wa.inviteError)}</p><div class="wa-invite-retry-row"><button type="button" class="btn small" data-action="wa-invite-retry">${icon('refresh')}초대 다시 확인</button></div>`;
    return;
  }
  if(!wa.invite)return;
  host.className='wa-invite-summary';
  host.setAttribute('role','status');
  const companySummary=wa.invite.memberships.map(row=>row.company).join(' · ')||'전사 공통 초대';
  host.textContent=`${wa.invite.name} 님 · ${companySummary}`;
  host.innerHTML=`<strong>확인된 초대</strong><p>${escape(wa.invite.name)} 님 · ${escape(companySummary)}</p>`;
  const name=form?.querySelector?.('[name="name"]');if(name&&!name.value)name.value=wa.invite.name;
}
// 직원 입구에 PULSE 고객 초대를 넣은 손님을 고객 방으로 보낸다.
// 직원 초대 확인이 거절(403)한 뒤에만 부른다. 공통 초대 조회가 「고객」과 고정 목적지 하나를 답할 때만 옮기고, 그 밖에는 원래 오류를 그대로 보인다.
// 초대 값은 주소의 # 뒤에만 싣는다(서버 기록과 리퍼러에 남지 않는다). 수락과 세션 생성은 고객 방의 기존 API가 다시 검증한다.
async function waRouteCustomerInvite(token,still=()=>true){
  let result;
  try{result=await api('/api/invite/inspect',{token});}catch{return false;}
  if(!result||result.version!==1||result.kind!=='customer'||result.destination!=='/pulse-app/'||!still())return false;
  const target=new URL('/pulse-app/#invite='+encodeURIComponent(token),location.href).href;
  if(typeof location.assign==='function')location.assign(target);else location.href=target;
  return true;
}
async function waInspectInvite(){
  const token=state.authToken,form=document.getElementById('auth-form');
  if(!token||state.authMode!=='join')return;
  const auth=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():{userId:state.user?.id||null};
  const request=++wa.inviteRequest;wa.inviteToken=token;wa.invite=null;wa.inviteError='';wa.inviteLoading=true;
  waPaintInvite();
  const current=()=>request===wa.inviteRequest&&(typeof companyAuthCurrent==='function'?companyAuthCurrent(auth):(state.user?.id||null)===auth.userId)&&state.authMode==='join'&&state.authToken===token&&form?.isConnected!==false;
  try{const result=await api('/api/workspace-invite/inspect',{token});if(!current())return;wa.invite=result;}
  catch(error){
    if(error?.code==='SESSION_CHANGED'||!current())return;
    if(error?.status===403&&await waRouteCustomerInvite(token,current))return;
    if(!current())return;
    wa.inviteError=error.message||'초대를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
  finally{if(current()){wa.inviteLoading=false;waPaintInvite();}}
}
function waWorkCompany(){return state.tab==='path'?'PATH':'SHIFT';}
function waOwnsCompanyWork(company){
  const userId=state.user?.id||null;
  if(!userId||!company)return false;
  if(['path','lectures'].includes(state.tab))return waWorkCompany()===company;
  return wa.workKey===userId+':'+company;
}
function waWorkTargetNoticeHtml(){
  if(!wa.workTargetNotice||state.tab!=='home')return '';
  return `<div class="note-box warn wa-work-target-banner" role="status"><span>${escape(wa.workTargetNotice)}</span><button type="button" class="btn small quiet" data-action="wa-dismiss-notice">확인</button></div>`;
}
function waMineCompanies(){
  const access=waAccess();
  if(!state.user||typeof isDemoMode==='function'&&isDemoMode())return [];
  if(isAdmin()||access.admin){
    return ['SHIFT','PATH'].filter(company=>access.memberships?.some(row=>row.company===company&&(company!=='SHIFT'||row.role!=='automation')));
  }
  const list=[];
  if(access.features?.includes('lectures')||access.memberships?.some(row=>row.company==='SHIFT'&&row.role!=='automation'))list.push('SHIFT');
  if(access.features?.includes('path')||access.memberships?.some(row=>row.company==='PATH'))list.push('PATH');
  return list;
}
function waMineVisibleCompanies(){
  if(!state.user||typeof isDemoMode==='function'&&isDemoMode())return [];
  const base=wa.mine&&Array.isArray(wa.mine.companies)?wa.mine.companies.filter(c=>c==='SHIFT'||c==='PATH'):waMineCompanies();
  return base.filter(company=>wa.company==='all'||wa.company===company);
}
function waMineDateInfo(date,today){
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return{bucket:'undated',urgent:false,badge:'일정 미정',dateText:''};
  if(date<today)return{bucket:'overdue',urgent:true,badge:'지난 일정',dateText:date};
  if(date===today)return{bucket:'today',urgent:true,badge:'오늘',dateText:date};
  return{bucket:'upcoming',urgent:false,badge:'예정',dateText:date};
}
function waMineItemHtml(row,today){
  const info=waMineDateInfo(row.date,today);
  const kind=row.company==='PATH'?'PATH 상담·정착 지원':'SHIFT 강의';
  const parsed=waParseWorkHref(row.href);
  const validTarget=parsed&&parsed.company===row.company&&parsed.workId===row.id?parsed:null;
  const arrow=typeof icon==='function'?icon('arrow'):'';
  const meta=`<span class="wa-mine-item-meta"><span class="wa-mine-badge is-${info.bucket}">${escape(info.badge)}</span>${info.dateText?`<span class="wa-mine-date">${escape(info.dateText)}</span>`:''}<span class="wa-mine-kind">${escape(kind)}</span></span>`;
  const body=`<span class="wa-mine-item-copy">${meta}<strong class="wa-mine-title">${escape(row.title||'제목 없음')}</strong></span>`;
  if(!validTarget)return `<li class="wa-mine-row${info.urgent?' is-urgent':''}"><div class="wa-mine-item is-static">${body}</div></li>`;
  return `<li class="wa-mine-row${info.urgent?' is-urgent':''}"><button type="button" class="wa-mine-item" data-action="wa-mine-open" data-company="${validTarget.company}" data-work-id="${validTarget.workId}">${body}${arrow}</button></li>`;
}
function waMineInnerHtml(){
  const companies=waMineVisibleCompanies();
  if(!companies.length)return '';
  const heading=companies.length===1?(companies[0]==='PATH'?'내 상담·정착 지원 일정':'내 강의 일정'):'내 강의·상담 일정';
  const today=wa.mine?.date||waKstDate();
  const data=wa.mine;
  const items=(data?.items||[]).filter(row=>row&&companies.includes(row.company)).slice().sort((a,b)=>(a.date?0:1)-(b.date?0:1)||(a.date||'').localeCompare(b.date||''));
  const counts={today:0,overdue:0,upcoming:0,undated:0};
  for(const row of items)counts[waMineDateInfo(row.date,today).bucket]++;
  const summaryParts=data?[
    `미완료 ${items.length}건`,
    counts.today?`오늘 ${counts.today}`:'',
    counts.overdue?`지난 일정 ${counts.overdue}`:'',
    counts.upcoming?`예정 ${counts.upcoming}`:'',
    counts.undated?`일정 미정 ${counts.undated}`:'',
  ].filter(Boolean):[];
  const header=`<div class="wa-mine-head"><div class="wa-mine-head-copy"><h2 id="wa-mine-heading">${escape(heading)}</h2>${summaryParts.length?`<span class="wa-mine-summary">${escape(summaryParts.join(' · '))}</span>`:''}</div><button type="button" class="wa-mine-refresh" data-action="wa-mine-refresh" ${wa.mineLoading?'aria-disabled="true"':''}>새로 확인</button></div>`;
  const readonlyNote=data&&(data.canAct===false||isViewer())?'<p class="wa-mine-readonly">보기 전용 권한이에요. 일정을 열어 내용을 확인할 수 있어요.</p>':'';
  if(wa.mineError&&!data){
    return `${header}<div class="wa-mine-error" role="alert"><p>${escape(wa.mineError)}</p><button type="button" class="next-button" data-action="wa-mine-refresh" ${wa.mineLoading?'aria-disabled="true"':''}>다시 불러오기</button></div>`;
  }
  if(!data){
    return `${header}<p class="wa-mine-status" role="status">미완료 일정을 불러오고 있어요…</p>`;
  }
  const errBanner=wa.mineError?`<div class="wa-mine-error" role="alert"><p>${escape(wa.mineError)}</p></div>`:'';
  if(!items.length){
    const emptyCopy=companies.length===1?(companies[0]==='PATH'?'남은 미완료 상담 일정이 없어요.':'남은 미완료 강의 일정이 없어요.'):'남은 미완료 강의·상담 일정이 없어요.';
    return `${header}${errBanner}${readonlyNote}<p class="wa-mine-empty">${escape(emptyCopy)}</p>`;
  }
  const urgentCount=counts.today+counts.overdue;
  const limit=Math.max(5,urgentCount);
  const visible=items.slice(0,limit),extra=items.slice(limit);
  const list=`<ul class="wa-mine-list">${visible.map(row=>waMineItemHtml(row,today)).join('')}</ul>`;
  const more=extra.length?`<details class="wa-mine-more" ${wa.mineExpanded?'open':''}><summary>이후·미정 일정 ${escape(String(extra.length))}건 더 보기</summary><ul class="wa-mine-list is-more">${extra.map(row=>waMineItemHtml(row,today)).join('')}</ul></details>`:'';
  return `${header}${errBanner}${readonlyNote}${list}${more}`;
}
function waQueueMineLoad(){
  if(state.tab!=='home'||!state.user||!waMineCompanies().length)return;
  if(wa.mineUserId&&wa.mineUserId!==state.user.id)waResetMine();
  const shouldLoad=(!wa.mine&&!wa.mineError)||wa.mineNeedsRefresh;
  if(shouldLoad&&!wa.mineLoading&&!wa.mineQueued){
    wa.mineQueued=true;
    queueMicrotask(()=>{wa.mineQueued=false;if(state.tab==='home'&&state.user&&waMineVisibleCompanies().length)void waLoadMine();});
  }
}
function waMineHomeHtml(){
  if(wa.mineUserId&&wa.mineUserId!==state.user?.id)waResetMine();
  const companies=waMineVisibleCompanies();
  if(!companies.length)return '';
  waQueueMineLoad();
  return `<section id="wa-mine-work" class="wa-mine-work" aria-labelledby="wa-mine-heading" aria-busy="${wa.mineLoading}">${waMineInnerHtml()}</section>`;
}
function waCaptureMineView(){
  const root=typeof document!=='undefined'?document.getElementById('wa-mine-work'):null;if(!root)return null;
  const active=document.activeElement,inside=Boolean(active&&root.contains(active));
  const focused=inside?(active.closest?.('[data-action]')||(active.dataset?.action?active:null)):null;
  const focusRetry=Boolean(focused&&(focused.closest?.('.wa-mine-error')||focused.classList?.contains?.('next-button')));
  return{expanded:Boolean(root.querySelector('.wa-mine-more')?.open),focusAction:focused?.dataset.action,focusCompany:focused?.dataset.company,focusWorkId:focused?.dataset.workId,focusRetry,summary:Boolean(inside&&active.matches?.('.wa-mine-more>summary'))};
}
function waRestoreMineView(view){
  const root=typeof document!=='undefined'?document.getElementById('wa-mine-work'):null;if(!root||!view)return;
  const more=root.querySelector('.wa-mine-more');if(more&&(view.expanded||wa.mineExpanded))more.open=true;
  const actions=[...root.querySelectorAll('[data-action]')].filter(el=>!el.disabled);
  const refreshFallback=actions.find(el=>el.dataset.action==='wa-mine-refresh')||root.querySelector('[data-action="wa-mine-refresh"]:not(:disabled)');
  if(view.focusAction){
    const match=actions.find(el=>el.dataset.action===view.focusAction&&(el.dataset.company||'')===(view.focusCompany||'')&&(el.dataset.workId||'')===(view.focusWorkId||'')&&(!view.focusRetry||Boolean(el.closest?.('.wa-mine-error'))||el.classList?.contains?.('next-button')));
    (match||refreshFallback)?.focus({preventScroll:true});
  }else if(view.summary)(root.querySelector('.wa-mine-more>summary')||refreshFallback)?.focus({preventScroll:true});
}
function waSyncMine({refresh=true}={}){
  if(state.tab!=='home'||!state.user)return;
  if(wa.mineUserId&&wa.mineUserId!==state.user.id)waResetMine();
  const companies=waMineVisibleCompanies(),root=typeof document!=='undefined'?document.getElementById('wa-mine-work'):null;
  if(!companies.length){if(root)root.remove();return;}
  if(root){
    const view=waCaptureMineView();
    root.innerHTML=waMineInnerHtml();
    root.setAttribute('aria-busy',String(wa.mineLoading));
    waRestoreMineView(view);
  }
  if(refresh&&!wa.mineLoading&&((!wa.mine&&!wa.mineError)||wa.mineNeedsRefresh||(wa.mineCheckedAt>0&&Date.now()-wa.mineCheckedAt>60000)))void waLoadMine();
  if(typeof workspaceTurnPaint==='function')workspaceTurnPaint();
}
async function waLoadMine({force=false}={}){
  if(!state.user||state.tab!=='home'||!waMineCompanies().length)return null;
  if(wa.mineUserId&&wa.mineUserId!==state.user.id)waResetMine();
  if(wa.mineLoading&&!force)return null;
  const userId=state.user.id,stamp=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():{userId};
  const sameSession=()=>(typeof companyAuthCurrent==='function'?companyAuthCurrent(stamp):state.user?.id===userId)&&wa.mineUserId===userId;
  wa.mineUserId=userId;
  const request=++wa.mineRequest;
  wa.mineLoading=true;wa.mineError='';wa.mineNeedsRefresh=false;
  waSyncMine({refresh:false});
  try{
    const result=await api('/api/company-work/mine');
    if(request!==wa.mineRequest||!sameSession())return null;
    if(!result||!Array.isArray(result.items)||!Array.isArray(result.companies))throw new Error('내 일정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
    wa.mine={
      companies:result.companies.filter(c=>c==='SHIFT'||c==='PATH'),
      date:typeof result.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(result.date)?result.date:waKstDate(),
      items:result.items.filter(row=>row&&typeof row==='object'&&(row.company==='SHIFT'||row.company==='PATH')&&WA_WORK_ID_RE.test(row.id||'')).map(row=>({
        id:row.id,
        company:row.company,
        title:typeof row.title==='string'?row.title:'',
        date:typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)?row.date:'',
        revision:typeof row.revision==='number'?row.revision:0,
        href:typeof row.href==='string'?row.href:'',
      })),
      canAct:result.canAct!==false,
    };
    wa.mineCheckedAt=Date.now();
    return wa.mine;
  }catch(error){
    if(error?.code==='SESSION_CHANGED'||request!==wa.mineRequest||!sameSession())return null;
    wa.mine=null;
    wa.mineError=error.message||'내 일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
    wa.mineCheckedAt=Date.now();
    return null;
  }finally{
    if(request===wa.mineRequest){
      wa.mineLoading=false;
      if(sameSession()){
        if(state.tab==='home')waSyncMine({refresh:false});
      }else if(state.user?.id===userId){
        wa.mine=null;wa.mineError='';wa.mineCheckedAt=0;wa.mineNeedsRefresh=true;
        if(state.tab==='home')waSyncMine({refresh:true});
      }
    }
  }
}
function waOpenMineWork(company,workId){
  if(!state.user||!['SHIFT','PATH'].includes(company)||!WA_WORK_ID_RE.test(workId||''))return false;
  const tab=company==='PATH'?'path':'lectures',href=`/?tab=${tab}&workId=${workId}`;
  if(!waNavigationAllowed(tab)){
    const msg=company==='PATH'?'PATH 상담·정착 업무 열람 권한이 없어요.':'SHIFT 강의 일정 열람 권한이 없어요.';
    wa.workTargetNotice=msg;if(typeof notify==='function')notify(msg);if(state.tab==='home')render();
    return false;
  }
  wa.mineNeedsRefresh=true;
  selectWorkspaceView(tab);
  waActivateWorkTarget({tab,company,workId});
  if(typeof history!=='undefined'){
    if(typeof history.pushState==='function')history.pushState(null,'',href);
    else if(typeof history.replaceState==='function')history.replaceState(null,'',href);
  }
  render();if(typeof window!=='undefined')window.scrollTo?.(0,0);
  return true;
}
function waQueueTargetWorkFocus(target){
  if(!target||target.focused||!target.workId||wa.workFocusQueued)return;
  wa.workFocusQueued=true;
  queueMicrotask(()=>{
    wa.workFocusQueued=false;
    if(!state.user||wa.workTarget!==target||target.focused||state.tab!==target.tab||typeof document==='undefined')return;
    const heading=document.getElementById('wa-work-heading-'+target.workId);
    if(!heading)return;
    target.focused=true;
    heading.scrollIntoView?.({block:'nearest'});
    heading.focus?.({preventScroll:true});
  });
}
function waWorkPage(){
  const company=waWorkCompany(),isPath=company==='PATH';
  const title=isPath?'상담·정착 업무':'강의 일정';
  const subtitle=isPath
    ?'유학·정착 상담 일정과 지원할 내용을 기록하고 PATH 책임자와 공유해요.'
    :'SHIFT 강의 일정과 준비 내용을 관리해요. 어학당 학급 수업은 LAB 내 수업에서 다뤄요.';
  const key=state.user.id+':'+company;
  if(wa.workKey!==key||wa.workConflictKey===key){wa.workConflictKey='';wa.workKey=key;wa.work=null;wa.workError='';wa.workLoading=false;wa.request++;}
  const activeTarget=wa.workTarget&&wa.workTarget.userId===state.user.id&&wa.workTarget.company===company&&wa.workTarget.tab===state.tab?wa.workTarget:null;
  if(activeTarget&&!activeTarget.invalid&&activeTarget.workId){
    const expectedHref=`/?tab=${activeTarget.tab}&workId=${activeTarget.workId}`;
    if(waLocationHref()!==expectedHref)waReplaceHref(expectedHref);
  }
  if(!wa.work&&!wa.workLoading&&!wa.workError&&!wa.workQueued){wa.workQueued=true;queueMicrotask(()=>{wa.workQueued=false;void waLoadWork();});}
  const data=wa.work,items=data?.items||[];
  const openCount=items.filter(row=>row.status!=='done').length,doneCount=items.filter(row=>row.status==='done').length;
  const matched=activeTarget&&!activeTarget.invalid&&activeTarget.workId&&data?items.find(row=>row.id===activeTarget.workId)||null:null;
  let targetBanner='';
  if(activeTarget?.invalid)targetBanner='<div class="note-box warn wa-work-target-banner" role="status">유효하지 않은 업무 연결이에요. 아래 목록에서 항목을 선택해 주세요.</div>';
  else if(activeTarget&&data&&!matched)targetBanner='<div class="note-box warn wa-work-target-banner" role="status">찾으시는 일정이 없거나 삭제·권한 변경으로 열람할 수 없어요. 다른 회사의 업무이거나 담당이 바뀌었는지 확인해 주세요.</div>';
  else if(matched&&matched.status==='done')targetBanner='<div class="note-box wa-work-target-banner" role="status">선택한 일정은 이미 완료된 기록이에요. 아래 카드에서 내용을 확인할 수 있어요.</div>';
  if(matched&&!activeTarget.focused)waQueueTargetWorkFocus(activeTarget);
  return `<section class="wa-work">${pageHeading(company==='PATH'?'SYNK PATH':'SYNK SHIFT',title,subtitle,!isViewer()?button(isPath?'업무 추가':'강의 추가','wa-work-edit','plus','primary'):'')}<div class="wa-work-meta-bar"><span>내 기록과 ${company} 책임자·관리자만 열람할 수 있어요.</span>${data?`<div class="wa-work-counts"><span>진행 중 <strong>${openCount}</strong></span><span>완료 <strong>${doneCount}</strong></span></div>`:''}</div>${targetBanner}${wa.workError?`<div class="form-error" role="alert">${escape(wa.workError)}</div><div class="mt-10">${button('다시 불러오기','wa-work-refresh','refresh','small')}</div>`:''}${!data?(wa.workError&&!wa.workLoading?'':`<p class="muted" role="status">${wa.workLoading?'목록을 불러오고 있어요.':'목록을 준비하고 있어요.'}</p>`):items.length?`<div class="wa-work-list">${items.map(row=>{const isTarget=Boolean(matched&&row.id===matched.id);return `<article class="wa-work-item${isTarget?' is-target':''}"${isTarget?` id="wa-work-item-${escape(row.id)}"`:''}><div class="wa-work-item-body"><div class="wa-work-meta">${isTarget?'<span class="wa-work-target-chip">선택한 일정</span>':''}<span class="status-badge ${row.status==='done'?'good':'running'}"><i class="dot"></i>${row.status==='done'?'완료':'진행 중'}</span><span>${isPath?'PATH 상담·정착 지원':'SHIFT 강의'}</span><span>${escape(row.date||'일정 미정')}</span><span>담당: ${escape(row.ownerName||'담당자')}</span></div><h2${isTarget?` id="wa-work-heading-${escape(row.id)}" tabindex="-1"`:''}>${escape(row.title)}</h2>${row.note?`<p>${escape(row.note)}</p>`:''}</div>${data.canWrite?button('수정','wa-work-edit','','small',`data-id="${escape(row.id)}"`):''}</article>`;}).join('')}</div>`:empty(`아직 등록한 ${isPath?'업무가':'강의가'} 없어요`,isViewer()?'등록된 기록이 생기면 여기에 차례로 표시돼요.':'제목과 일정을 적어 첫 기록을 남겨 보세요.',!isViewer()?button(isPath?'첫 업무 추가':'첫 강의 추가','wa-work-edit','plus','primary'):'',false,isPath?'compass':'presentation')}</section>`;
}
async function waLoadWork({force=false,company}={}){
  if(!state.user||(!force&&!['path','lectures'].includes(state.tab))){if(!wa.work&&!wa.workLoading)wa.workKey='';return;}
  const targetCompany=company||(state.tab==='path'?'PATH':state.tab==='lectures'?'SHIFT':'');
  if(!targetCompany){if(!wa.work&&!wa.workLoading)wa.workKey='';return;}
  if(!force&&wa.workLoading)return;
  const userId=state.user.id,expectedKey=userId+':'+targetCompany;
  if(wa.workKey&&wa.workKey!==expectedKey){
    if(!['path','lectures'].includes(state.tab)||waWorkCompany()!==targetCompany)return;
  }
  wa.workKey=expectedKey;
  if(wa.workConflictKey===expectedKey)wa.workConflictKey='';
  const key=wa.workKey,request=++wa.request;wa.workLoading=true;wa.workError='';
  try{
    const result=await api('/api/company-work/'+targetCompany);
    if(request===wa.request&&state.user?.id===userId&&key===wa.workKey)wa.work=result;
  }catch(error){
    if(error?.code!=='SESSION_CHANGED'&&request===wa.request&&state.user?.id===userId&&key===wa.workKey)wa.workError=error.message||'업무를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  }finally{
    if(request===wa.request){
      wa.workLoading=false;
      if(state.user?.id===userId&&key===wa.workKey&&['path','lectures'].includes(state.tab)&&waWorkCompany()===targetCompany)renderBackground();
    }
  }
}
function waWorkModal(id,{row:loadedRow=null,company:targetCompany='',conflict=false}={}){
  const company=targetCompany||waWorkCompany(),row=loadedRow||(id?wa.work?.items.find(item=>item.id===id):null);
  if(id&&!row)return;
  const requestId=!id&&typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():'';
  modal(company==='PATH'?'상담·정착 업무':'강의 일정',row?'기록 내용을 수정해요.':'제목과 예정 일정을 입력해 주세요.',`<form class="form-stack" data-form="wa-work" data-id="${escape(id||'')}" data-company="${company}" data-revision="${row?.revision||0}"${requestId?` data-request-id="${escape(requestId)}"`:''}><div class="form-error" role="alert"></div>${conflict?'<p class="notice" role="status">최신 기록을 불러왔어요. 내용을 확인하고 다시 수정해 주세요.</p>':''}<label class="field">제목<input name="title" required maxlength="160" value="${escape(row?.title||'')}" placeholder="${company==='PATH'?'예: 신입생 체류 서류 안내 상담':'예: 직무 자동화 실습 1회차'}"></label><div class="field-row"><label class="field">일정<input name="date" type="date" value="${escape(row?.date||'')}"></label><label class="field">진행 상태<select name="status"><option value="open">진행 중</option><option value="done" ${row?.status==='done'?'selected':''}>완료</option></select></label></div><label class="field">${company==='PATH'?'상담·지원 메모':'준비할 내용'}<textarea name="note" maxlength="2000" rows="5" placeholder="진행 상황이나 인계할 메모를 적어 주세요">${escape(row?.note||'')}</textarea></label><div class="modal-actions"><button type="button" class="btn quiet" data-action="wa-work-reload" data-id="${escape(id||'')}" data-company="${company}"${row?'':' hidden'}>최신 내용 다시 읽기</button>${button('취소','close-modal')}<button type="submit" class="btn primary">저장</button></div></form>`);
  wa.workModal={id:id||'',company,modalRequest:state.modalRequest};
}
async function waReloadWorkModal(target,fromPage=false){
  const current=!fromPage&&wa.workModal?.modalRequest===state.modalRequest?wa.workModal:null;
  const id=current?current.id:target.dataset.id||'',company=current?current.company:target.dataset.company||waWorkCompany(),modalRequest=state.modalRequest,userId=state.user?.id;
  if(!userId)return;
  const auth=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():null;
  const sameSession=()=>auth?companyAuthCurrent(auth):state.user?.id===userId;
  const key=userId+':'+company,sameScope=waOwnsCompanyWork(company);
  const request=sameScope?++wa.request:wa.request;
  if(sameScope){wa.workKey=key;wa.workConflictKey='';wa.workLoading=true;wa.workError='';}
  try{
    const result=await api('/api/company-work/'+company);
    if(waOwnsCompanyWork(company)&&request===wa.request&&wa.workKey===key&&sameSession())wa.work=result;
    if(!sameSession()||state.modalRequest!==modalRequest)return;
    const row=id?result.items?.find(item=>item.id===id):null;
    if(id&&!row){if(!fromPage)closeModal();notify('이미 삭제된 기록이라 목록을 새로 불러왔어요.');return;}
    waWorkModal(id,{row,company,conflict:!fromPage});
    if(!fromPage)notify('최신 기록을 불러왔어요. 내용을 확인하고 다시 수정해 주세요.');
  }finally{
    if(sameScope&&request===wa.request){wa.workLoading=false;if(['path','lectures'].includes(state.tab)&&waWorkCompany()===company)renderBackground();}
  }
}
document.addEventListener('change',event=>{
  if(event.target.name==='waCompany'){const select=event.target.form.elements.namedItem('waRole_'+event.target.value);if(select)select.disabled=!event.target.checked;}
  if(event.target.matches('[data-wa-company]')){const inDrawer=Boolean(event.target.closest('#ws-tools-drawer'));wa.company=event.target.value;waNormalizeView();render();(document.querySelector(inDrawer?'#ws-tools-drawer [data-wa-company]':'[data-wa-company]'))?.focus();}
});
document.addEventListener('click',event=>{
  const target=event.target?.closest?.('[data-action]'),action=target?.dataset.action;
  if(action==='tab'&&!target.disabled){waClearWorkTarget();wa.workTargetNotice='';return;}
  if(!action?.startsWith('wa-')||target.disabled)return;event.preventDefault();event.stopImmediatePropagation();
  const run=async()=>{
    if(target.closest('#ws-tools-drawer')&&typeof setWorkspaceToolsOpen==='function'){document.getElementById('ws-tools-toggle')?.focus({preventScroll:true});setWorkspaceToolsOpen(false,{restoreFocus:false});}
    if(action==='wa-open'){waClearWorkTarget();selectWorkspaceView(target.dataset.tab,target.dataset.section);if(typeof syncWorkspaceLocation==='function')syncWorkspaceLocation();render();if(typeof window!=='undefined')window.scrollTo?.(0,0);}
    if(action==='wa-member')waMemberModal(target.dataset.id);
    if(action==='wa-invites')await waInvites();
    if(action==='wa-invite-retry'){target.disabled=true;await waInspectInvite();if(target.isConnected!==false)target.disabled=false;}
    if(action==='wa-revoke'){
      const modalRequest=state.modalRequest,stamp=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():{userId:state.user?.id||null};
      const sameSession=()=>typeof companyAuthCurrent==='function'?companyAuthCurrent(stamp):state.user?.id===stamp.userId;
      target.disabled=true;
      await api('/api/workspace-invites/'+encodeURIComponent(target.dataset.id)+'/revoke',{});
      if(!sameSession())return;
      notify('초대를 취소했어요.');
      if(state.modalRequest===modalRequest)await waInvites();
    }
    if(action==='wa-work-edit'){
      if(wa.workConflictKey&&wa.workConflictKey===state.user?.id+':'+waWorkCompany())await waReloadWorkModal(target,true);
      else waWorkModal(target.dataset.id);
    }
    if(action==='wa-work-reload'){target.disabled=true;await waReloadWorkModal(target,false);if(target.isConnected!==false)target.disabled=false;}
    if(action==='wa-work-refresh')await waLoadWork({force:true});
    if(action==='wa-mine-open')waOpenMineWork(target.dataset.company,target.dataset.workId);
    if(action==='wa-mine-refresh'){
      if(wa.mineLoading&&wa.mineUserId===state.user?.id)return;
      await waLoadMine({force:true});
    }
    if(action==='wa-dismiss-notice'){wa.workTargetNotice='';render();}
  };
  void run().catch(error=>{if(target.isConnected!==false)target.disabled=false;if(error?.code!=='SESSION_CHANGED')notify(error.message);});
},true);
document.addEventListener('submit',event=>{
  const form=event.target;if(!form.dataset.form?.startsWith('wa-'))return;
  event.preventDefault();event.stopImmediatePropagation();const submit=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error'),values=Object.fromEntries(new FormData(form));
  if(submit.disabled)return;submit.disabled=true;error.textContent='';
  const startUserId=state.user?.id||null,startAuth=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():null,startModalRequest=state.modalRequest;
  const sameSession=()=>startAuth?companyAuthCurrent(startAuth):(state.user?.id||null)===startUserId;
  const ownsModal=()=>sameSession()&&form.isConnected!==false&&state.modalRequest===startModalRequest;
  const run=async()=>{
    if(form.dataset.form==='wa-code'){
      let token=values.code.trim();if(token.includes('#')){try{token=new URL(token,location.origin).hash.slice(1);token=new URLSearchParams(token).get('invite')||'';}catch{token='';}}
      if(!/^[A-Za-z0-9_-]{32,200}$/.test(token))throw new Error('받은 초대 코드나 링크를 다시 확인해 주세요.');
      const request=++wa.inviteRequest;let details;
      try{details=await api('/api/workspace-invite/inspect',{token});}
      catch(inspectError){
        if(inspectError?.status===403&&await waRouteCustomerInvite(token,()=>request===wa.inviteRequest&&ownsModal()&&!state.user&&state.authMode==='login'))return;
        throw inspectError;
      }
      if(request!==wa.inviteRequest||!ownsModal()||state.user||state.authMode!=='login')return;
      wa.inviteHandoff={token,details};state.authMode='join';state.authToken=token;renderAuth();
    }else if(form.dataset.form==='wa-member'){
      const result=await api('/api/members/'+encodeURIComponent(form.dataset.id)+'/workspace-profile',{revision:Number(form.dataset.revision),workspaceProfile:waReadFields(form)});
      if(!sameSession())return;
      const message=result.warnings?.length?result.warnings.join(' '):'회사와 담당 업무를 저장했어요.';
      if(ownsModal())closeModal();
      try{await loadState();if(sameSession())notify(message);}
      catch(refreshError){if(refreshError?.code!=='SESSION_CHANGED'&&sameSession())notify(`${(/[.!?]$/.test(message)?message:message+'.')} 화면 목록은 새로 불러오지 못했어요. 새로고침해 확인해 주세요.`);}
    }else if(form.dataset.form==='wa-work'){
      const isCreate=!form.dataset.id;
      if(isCreate&&!form.dataset.requestId&&typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')form.dataset.requestId=crypto.randomUUID();
      const payload={...values,revision:Number(form.dataset.revision),...(isCreate&&form.dataset.requestId?{requestId:form.dataset.requestId}:{})};
      const targetCompany=form.dataset.company;
      await api('/api/company-work/'+targetCompany+(form.dataset.id?'/'+encodeURIComponent(form.dataset.id):''),payload);
      if(!sameSession())return;
      if(wa.workConflictKey===startUserId+':'+targetCompany)wa.workConflictKey='';
      if(ownsModal())closeModal();
      wa.mineNeedsRefresh=true;
      if(waOwnsCompanyWork(targetCompany)){
        wa.request++;wa.work=null;wa.workError='';wa.workLoading=false;wa.workKey=startUserId+':'+targetCompany;
        try{await waLoadWork({force:true,company:targetCompany});}catch{}
      }
      if(sameSession())notify('저장했어요.');
    }
  };
  void run().catch(err=>{
    if(err?.code==='SESSION_CHANGED'||!sameSession())return;
    if(form.dataset.form==='wa-work'&&err?.status===409){
      if(!form.dataset.id){
        if(waOwnsCompanyWork(form.dataset.company))void waLoadWork({force:true,company:form.dataset.company}).catch(()=>{});
      }else if(startUserId){
        const key=startUserId+':'+form.dataset.company;wa.workConflictKey=key;
        if(!(['path','lectures'].includes(state.tab)&&waWorkCompany()===form.dataset.company)&&wa.workKey===key){wa.request++;wa.work=null;wa.workKey='';wa.workLoading=false;}
        if(ownsModal()){const reloadBtn=form.querySelector?.('[data-action="wa-work-reload"]');if(reloadBtn)reloadBtn.hidden=false;}
      }
    }
    if(ownsModal()){
      const message=form.dataset.form==='wa-work'&&form.dataset.id&&err?.status===409?`${(/[.!?]$/.test(err.message)?err.message:err.message+'.')} 최신 내용을 불러온 뒤 다시 저장해 주세요.`:err.message;
      if(error)error.textContent=message;
    }else if(form.dataset.form!=='wa-code'){
      notify(err.message);
    }
  }).finally(()=>{if(ownsModal())submit.disabled=false;});
},true);
document.addEventListener('toggle',event=>{if(event.target?.matches?.('.wa-mine-more'))wa.mineExpanded=event.target.open;},true);
if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
  window.addEventListener('popstate',()=>{
    const href=waLocationHref();
    if(!state.user){wa.pendingHref=href;return;}
    wa.pendingHref='';
    const info=waInspectWorkLocation(href);
    if(info.kind==='target'||info.kind==='invalid'){
      if(waNavigationAllowed(info.tab)&&typeof selectWorkspaceView==='function')selectWorkspaceView(info.tab);
      wa.workTarget=null;
      waApplyWorkLocation(info);
    }else if(info.kind==='plain'){
      waClearWorkTarget();
      wa.workTargetNotice='';
      if(typeof selectWorkspaceView==='function')selectWorkspaceView(info.tab);else state.tab=info.tab;
    }else{
      waClearWorkTarget();
      try{
        const origin=typeof location!=='undefined'&&location?.origin?location.origin:'http://localhost';
        const url=new URL(href,origin),q=url.searchParams,hash=new URLSearchParams(url.hash.slice(1));
        if(['launch','invite','setup'].some(key=>hash.has(key)))return;
        if(url.origin===origin&&url.pathname==='/'){
          const tab=q.get('tab')||'home';
          if(tab!=='home')wa.workTargetNotice='';
          if(typeof selectWorkspaceView==='function')selectWorkspaceView(tab,q.get('section')||'',q.has('teamId')?q.get('teamId')||'':undefined,q.has('draftId')?q.get('draftId')||'':undefined);
          else state.tab=tab;
          // 받은편지함(section=inbox)의 방은 주소에서 다시 읽는다 — 뒤로 가기가 사무실 · 다른 방으로 돌아간다.
          if(typeof workspaceInboxFromLocation==='function')workspaceInboxFromLocation();
        }
      }catch{}
    }
    if(typeof render==='function')render();
  },true);
}
