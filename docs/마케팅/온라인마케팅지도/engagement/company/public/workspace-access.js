'use strict';
const wa={company:'all',userId:null,inviteToken:'',invite:null,inviteError:'',inviteLoading:false,inviteRequest:0,inviteHandoff:null,work:null,workKey:'',workLoading:false,workError:'',workQueued:false,workConflictKey:'',workModal:null,request:0};
function waResetInvite(){wa.inviteRequest++;wa.inviteToken='';wa.invite=null;wa.inviteError='';wa.inviteLoading=false;wa.inviteHandoff=null;}
function waResetWork(){wa.work=null;wa.workKey='';wa.workLoading=false;wa.workError='';wa.workConflictKey='';wa.workModal=null;wa.request++;}
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
  if(view==='admin')return isAdmin()&&!(typeof isDemoMode==='function'&&isDemoMode());
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
  if(!state.user){wa.userId=null;wa.company='all';waResetInvite();waResetWork();return;}
  if(wa.userId!==state.user.id){wa.userId=state.user.id;wa.company='all';waResetInvite();waResetWork();}
  if(wa.company!=='all'&&!waAccess().companies.includes(wa.company))wa.company='all';
  if(typeof wrClearProduction==='function'&&!waFeature('production'))wrClearProduction();
  if(!waViewAllowed(state.tab))state.tab='home';
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
  const access=waAccess();
  const chip=(label,tab,section='')=>`<button type="button" class="wa-tool-chip" data-action="wa-open" data-tab="${tab}" data-section="${section}">${escape(label)}</button>`;
  const actionChip=(label,action,attrs='')=>`<button type="button" class="wa-tool-chip" data-action="${action}" ${attrs}>${escape(label)}</button>`;
  const pulse=(access.admin||access.companies.includes('PULSE'))&&['all','PULSE'].includes(wa.company);
  const common=[
    chip('메신저','messenger'),
    actionChip('내 할 일','marin-workroom-panel','data-panel="tasks"'),
    actionChip('내 업무 카드','marin-profile'),
    chip('사람·조직','members'),
    chip('회사 안내','handbook'),
  ];
  const assigned=[
    isAdmin()&&!(typeof isDemoMode==='function'&&isDemoMode())?chip('관리자','admin'):'',
    waFeature('teaching')?chip('LAB 내 수업','teaching'):'',
    waFeature('path')?chip('PATH 상담·정착','path'):'',
    waFeature('lectures')?chip('SHIFT 강의 일정','lectures'):'',
    pulse&&waFeature('clients')?chip('PULSE 고객 관리','workroom','clients'):'',
    pulse&&waFeature('production')?chip('PULSE 제작 데스크','workroom','desk'):'',
    waFeature('social')?chip('SNS·마케팅','social'):'',
    !pulse&&waFeature('clients')?chip('제작 고객 관리','workroom','clients'):'',
    !pulse&&waFeature('production')?chip('콘텐츠 제작','workroom','desk'):'',
    waFeature('pages')?chip('내 관리 페이지','workroom','pages'):'',
    waFeature('feedback')?'<a class="wa-tool-chip" href="/trial-feedback/">체험 의견</a>':'',
    isAdmin()?chip('회사 설정','settings'):'',
  ].filter(Boolean);
  return `<section class="wa-home-sections" aria-label="배정 업무와 공통 도구">${assigned.length?`<div class="wa-home-tools"><span class="wa-home-tools-label">배정된 업무</span>${assigned.join('')}</div>`:''}<div class="wa-home-tools"><span class="wa-home-tools-label">전사 공통</span>${common.join('')}</div></section>`;
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
  host.innerHTML=`<strong>확인된 초대</strong><p>${escape(wa.invite.name)} 님 · ${escape(companySummary)}</p><small>소속 회사와 직무는 관리자가 지정했어요. 이름과 비밀번호를 정하면 바로 합류해요.</small>`;
  const name=form?.querySelector?.('[name="name"]');if(name&&!name.value)name.value=wa.invite.name;
}
async function waInspectInvite(){
  const token=state.authToken,form=document.getElementById('auth-form');
  if(!token||state.authMode!=='join')return;
  const auth=typeof companyAuthSnapshot==='function'?companyAuthSnapshot():{userId:state.user?.id||null};
  const request=++wa.inviteRequest;wa.inviteToken=token;wa.invite=null;wa.inviteError='';wa.inviteLoading=true;
  waPaintInvite();
  const current=()=>request===wa.inviteRequest&&(typeof companyAuthCurrent==='function'?companyAuthCurrent(auth):(state.user?.id||null)===auth.userId)&&state.authMode==='join'&&state.authToken===token&&form?.isConnected!==false;
  try{const result=await api('/api/workspace-invite/inspect',{token});if(!current())return;wa.invite=result;}
  catch(error){if(error?.code==='SESSION_CHANGED'||!current())return;wa.inviteError=error.message||'초대를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';}
  finally{if(current()){wa.inviteLoading=false;waPaintInvite();}}
}
function waWorkCompany(){return state.tab==='path'?'PATH':'SHIFT';}
function waOwnsCompanyWork(company){
  const userId=state.user?.id||null;
  if(!userId||!company)return false;
  if(['path','lectures'].includes(state.tab))return waWorkCompany()===company;
  return wa.workKey===userId+':'+company;
}
function waWorkPage(){
  const company=waWorkCompany(),isPath=company==='PATH';
  const title=isPath?'상담·정착 업무':'강의 일정';
  const subtitle=isPath
    ?'유학·정착 상담 일정과 지원할 내용을 기록하고 PATH 책임자와 공유해요.'
    :'SHIFT 강의 일정과 준비 내용을 관리해요. 어학당 학급 수업은 LAB 내 수업에서 다뤄요.';
  const key=state.user.id+':'+company;
  if(wa.workKey!==key||wa.workConflictKey===key){wa.workConflictKey='';wa.workKey=key;wa.work=null;wa.workError='';wa.workLoading=false;wa.request++;}
  if(!wa.work&&!wa.workLoading&&!wa.workError&&!wa.workQueued){wa.workQueued=true;queueMicrotask(()=>{wa.workQueued=false;void waLoadWork();});}
  const data=wa.work,items=data?.items||[];
  const openCount=items.filter(row=>row.status!=='done').length,doneCount=items.filter(row=>row.status==='done').length;
  return `<section class="wa-work">${pageHeading(company==='PATH'?'SYNK PATH':'SYNK SHIFT',title,subtitle,!isViewer()?button(isPath?'업무 추가':'강의 추가','wa-work-edit','plus','primary'):'')}<div class="wa-work-meta-bar"><span>내 기록과 ${company} 책임자·관리자만 열람할 수 있어요.</span>${data?`<div class="wa-work-counts"><span>진행 중 <strong>${openCount}</strong></span><span>완료 <strong>${doneCount}</strong></span></div>`:''}</div>${wa.workError?`<div class="form-error" role="alert">${escape(wa.workError)}</div><div class="mt-10">${button('다시 불러오기','wa-work-refresh','refresh','small')}</div>`:''}${!data?(wa.workError&&!wa.workLoading?'':`<p class="muted" role="status">${wa.workLoading?'목록을 불러오고 있어요.':'목록을 준비하고 있어요.'}</p>`):items.length?`<div class="wa-work-list">${items.map(row=>`<article class="wa-work-item"><div class="wa-work-item-body"><div class="wa-work-meta"><span class="status-badge ${row.status==='done'?'good':'running'}"><i class="dot"></i>${row.status==='done'?'완료':'진행 중'}</span><span>${escape(row.date||'일정 미정')}</span><span>담당: ${escape(row.ownerName||'담당자')}</span></div><h2>${escape(row.title)}</h2>${row.note?`<p>${escape(row.note)}</p>`:''}</div>${data.canWrite?button('수정','wa-work-edit','','small',`data-id="${escape(row.id)}"`):''}</article>`).join('')}</div>`:empty(`아직 등록한 ${isPath?'업무가':'강의가'} 없어요`,isViewer()?'등록된 기록이 생기면 여기에 차례로 표시돼요.':'제목과 일정을 적어 첫 기록을 남겨 보세요.',!isViewer()?button(isPath?'첫 업무 추가':'첫 강의 추가','wa-work-edit','plus','primary'):'',false,isPath?'compass':'presentation')}</section>`;
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
  const target=event.target.closest('[data-action]'),action=target?.dataset.action;
  if(!action?.startsWith('wa-')||target.disabled)return;event.preventDefault();event.stopImmediatePropagation();
  const run=async()=>{
    if(target.closest('#ws-tools-drawer')&&typeof setWorkspaceToolsOpen==='function'){document.getElementById('ws-tools-toggle')?.focus({preventScroll:true});setWorkspaceToolsOpen(false,{restoreFocus:false});}
    if(action==='wa-open'){selectWorkspaceView(target.dataset.tab,target.dataset.section);render();window.scrollTo?.(0,0);}
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
      const request=++wa.inviteRequest,details=await api('/api/workspace-invite/inspect',{token});
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
