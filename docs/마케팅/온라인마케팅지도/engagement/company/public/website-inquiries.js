'use strict';
const websiteInquiryState={identity:'',request:0,loading:false,saving:false,attempted:false,data:null,error:'',selected:null,draft:null,dirty:false};
const wiStatus={new:'새 문의',reviewing:'검토 중',replied:'답변 완료',closed:'종결'};
const wiRunStatus={'not-connected':'읽기 연결 필요',ready:'수집 준비됨',paused:'자동 수집 꺼짐',running:'수집 중','catching-up':'지난 문의 수집 중',failed:'확인 필요'};
function wiIdentity(){return state.user?[state.user.id,state.user.role||''].join(':'):'';}
function websiteInquiriesReset(){Object.assign(websiteInquiryState,{identity:'',request:websiteInquiryState.request+1,loading:false,saving:false,attempted:false,data:null,error:'',selected:null,draft:null,dirty:false});}
function wiActive(){return !!state.user&&state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools'&&typeof makerTools!=='undefined'&&makerTools.view==='inquiries';}
function websiteInquiriesEnsure(){
  if(websiteInquiryState.identity!==wiIdentity()){websiteInquiriesReset();websiteInquiryState.identity=wiIdentity();}
  if(wiActive()&&!websiteInquiryState.attempted&&!websiteInquiryState.loading)void wiLoad();
}
function wiRender(){if(wiActive())render();}
async function wiLoad(){
  const s=websiteInquiryState,identity=wiIdentity(),request=++s.request;
  if(!identity)return;s.loading=true;s.attempted=true;s.error='';wiRender();
  try{
    const data=await api('/api/website-inquiries');
    if(identity!==wiIdentity()||request!==s.request)return;
    if(!Array.isArray(data?.items)||data.draftOnly!==true)throw new Error('문의 접수함 응답을 확인할 수 없습니다.');
    s.data=data;
    const target=new URLSearchParams(location.search).get('inquiryId');
    if(!s.selected&&target&&data.items.some(row=>row.id===target))wiSelect(target);
    if(s.selected&&!s.dirty)wiSelect(s.selected);
  }catch(error){if(identity===wiIdentity()&&request===s.request){s.error=error.message;if([401,403].includes(error.status)){s.data=null;s.draft=null;s.selected=null;}}}
  finally{if(identity===wiIdentity()&&request===s.request){s.loading=false;wiRender();}}
}
function wiSelect(id){
  const s=websiteInquiryState,row=s.data?.items.find(item=>item.id===id);
  s.selected=row?.id||null;s.draft=row?{revision:row.revision,status:row.status,replyDraft:row.replyDraft}:null;s.dirty=false;
}
function wiCanLeave(){return !websiteInquiryState.dirty||confirm('저장하지 않은 답변 초안 변경을 닫을까요?');}
function wiTime(value){return value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'아직 확인하지 않음';}
function wiButton(action,label,disabled=false){return `<button class="btn small" type="button" data-wi-action="${escape(action)}" ${disabled?'disabled':''}>${escape(label)}</button>`;}
function wiItem(row){return `<button class="wi-list-item${websiteInquiryState.selected===row.id?' selected':''}" type="button" data-wi-open="${escape(row.id)}"><span>${escape(wiStatus[row.status]||'확인 필요')} · ${escape(row.classification?.label||'분류 확인')}</span><strong>${escape(row.email)}</strong><small>${escape(wiTime(row.createdAt))}</small>${row.classification?.isTest?'<em>기능 점검 · 고객 문의에서 제외</em>':''}</button>`;}
function wiEditor(row){
  const s=websiteInquiryState,draft=s.draft;if(!draft)return '';
  const href=row.task?.href&&/^\/\?tab=messenger&panel=tasks&channelId=[^&]+&messageId=[^&]+$/.test(row.task.href)?row.task.href:'';
  return `<article class="wi-detail"><div class="wi-detail-head"><h3>${escape(row.classification.label)}</h3>${wiButton('close','목록으로',s.saving)}</div>
    <dl><dt>답변받을 이메일</dt><dd>${escape(row.email)}</dd><dt>접수</dt><dd>${escape(wiTime(row.createdAt))}</dd><dt>선택한 문의 유형</dt><dd>${escape(row.type)}</dd></dl>
    <h4>문의 원문</h4><pre class="wi-original">${escape(row.message)}</pre>
    <div class="wi-reason"><strong>분류 근거</strong><p>${escape(row.classification.reason)}</p><p>${escape(row.classification.nextAction)}</p></div>
    ${href?`<a class="btn small" href="${escape(href)}">연결한 내 할 일 열기</a>`:row.classification.isTest?'':`<p class="wi-note">${row.task?.state==='unavailable'?'기존 후속 업무가 삭제되었습니다. 자동으로 다시 만들지 않습니다.':'후속 업무 연결을 확인 중입니다. 수집을 다시 확인하면 중복 없이 이어집니다.'}</p>`}
    <form data-wi-form><fieldset ${s.saving?'disabled':''}><label>답변 초안<textarea name="replyDraft" maxlength="6000" rows="8" ${row.classification.isTest?'':'required'}>${escape(draft.replyDraft)}</textarea></label>
    <p class="wi-note">원문에 이미 적힌 내용을 확인하고 초안을 다듬어 주세요. 여기서 저장하거나 복사해도 고객에게 발송되지 않습니다.</p>
    <label>처리 상태<select name="status">${Object.entries(wiStatus).map(([id,label])=>`<option value="${id}" ${draft.status===id?'selected':''}>${label}</option>`).join('')}</select></label>
    <p class="wi-note">실제로 답변을 보낸 다음 ‘답변 완료’로 표시해 주세요.</p><div class="wi-actions"><button class="btn" type="submit">${s.saving?'저장 중…':'초안·상태 저장'}</button>${wiButton('copy','초안 복사',s.saving||!draft.replyDraft)}</div></fieldset></form></article>`;
}
function websiteInquiriesPanel(){
  const s=websiteInquiryState;
  if(s.identity!==wiIdentity())return '<p class="maker-loading">문의 접수함을 불러오고 있어요.</p>';
  if(state.user?.role!=='admin')return '<section class="wi-panel"><h2>홈페이지 문의</h2><p>고객의 연락처와 문의가 있어 회사 관리자만 확인할 수 있습니다.</p></section>';
  const data=s.data,row=data?.items.find(item=>item.id===s.selected),busy=s.saving||s.loading;
  return `<section class="wi-panel" aria-label="홈페이지 문의 접수함"><div class="maker-section-head"><div><h2>홈페이지 문의</h2><p>문의 분류와 답변 초안을 확인하고, 내 할 일에서 후속 처리를 이어가세요.</p></div>${wiButton('reload','새로 읽기',busy)}</div>
    ${s.error?`<p class="maker-error" role="alert">${escape(s.error)}</p>`:''}
    ${!data?`<p class="maker-loading">${s.loading?'불러오는 중…':'접수함을 불러오지 못했습니다. 새로 읽기를 눌러 주세요.'}</p>`:
    `<div class="wi-connection"><strong>${escape(data.settings.enabled&&data.schedulerEnabled===false&&!['failed','running','not-connected'].includes(data.run.status)?'서버 자동 수집 꺼짐':wiRunStatus[data.run.status]||'상태 확인')}</strong><p>마지막 전체 수집 완료: ${escape(wiTime(data.run.lastSuccessAt))}</p>
      ${data.schedulerEnabled===false?'<p role="status">이 서버의 예약 점검이 꺼져 있습니다. 자동 수집 설정을 켜도 지금은 주기적으로 실행되지 않습니다. ‘지금 수집 확인’으로 직접 확인할 수 있습니다.</p>':''}
      ${data.run.error?`<p role="status">${escape(data.run.error)}</p>`:''}
      ${!data.connection.configured?'<p>Google 문의 양식의 질문·응답 읽기 연결이 필요합니다. 연결 전에는 접수된 문의가 없다고 판단하지 않습니다.</p>':''}
      <div class="wi-actions">${wiButton('verify','읽기 연결 확인',busy||!data.connection.configured)}${wiButton('toggle',data.settings.enabled?'자동 수집 끄기':data.schedulerEnabled===false?'자동 수집 설정 켜기':'5분마다 자동 수집 켜기',busy||!data.connection.configured)}${wiButton('collect','지금 수집 확인',busy||!data.settings.enabled)}
      <a href="https://docs.google.com/forms/d/${escape(data.connection.formId)}/edit#responses" target="_blank" rel="noopener noreferrer">Google 원본 열기 ↗</a></div>
      <p class="wi-note">자동 수집은 분류·초안·관리자 개인 할 일까지만 만듭니다. 외부 답변이나 홍보 목록 등록은 하지 않습니다.</p></div>
      <div class="wi-workspace"><aside class="wi-list" aria-label="접수 목록">${data.items.length?data.items.map(wiItem).join(''):`<p>${data.run.lastSuccessAt?'마지막 확인에서 수집된 문의가 없습니다.':'첫 수집 결과를 기다리고 있습니다.'}</p>`}</aside>
      ${row?wiEditor(row):'<div class="wi-detail"><p>왼쪽 문의를 선택하면 원문, 분류 근거, 답변 초안을 볼 수 있습니다.</p></div>'}</div>`}</section>`;
}
async function wiMutate(action,body){
  const s=websiteInquiryState,identity=wiIdentity(),request=++s.request;s.saving=true;s.error='';wiRender();
  try{await api('/api/website-inquiries/'+action,body);if(identity!==wiIdentity()||request!==s.request)return false;s.dirty=false;return true;}
  catch(error){if(identity===wiIdentity()&&request===s.request){s.error=error.message;if([401,403].includes(error.status)){s.data=null;s.draft=null;s.selected=null;}}return false;}
  finally{if(identity===wiIdentity()&&request===s.request){s.saving=false;wiRender();}}
}
document.addEventListener('input',event=>{
  const form=event.target.closest?.('[data-wi-form]'),s=websiteInquiryState;if(!form||s.saving||!s.draft||s.identity!==wiIdentity())return;
  s.draft.replyDraft=String(new FormData(form).get('replyDraft')||'');s.dirty=true;
});
document.addEventListener('change',event=>{
  const form=event.target.closest?.('[data-wi-form]'),s=websiteInquiryState;if(!form||s.saving||!s.draft||s.identity!==wiIdentity())return;
  s.draft.status=String(new FormData(form).get('status')||'new');s.dirty=true;
});
document.addEventListener('submit',async event=>{
  if(!event.target.matches?.('[data-wi-form]'))return;event.preventDefault();
  const s=websiteInquiryState;if(s.saving||!s.selected||!s.draft||s.identity!==wiIdentity())return;
  const values=new FormData(event.target),body={...s.draft,replyDraft:String(values.get('replyDraft')||''),status:String(values.get('status')||'')};
  if(await wiMutate(encodeURIComponent(s.selected),body))await wiLoad();
});
document.addEventListener('click',async event=>{
  const open=event.target.closest?.('[data-wi-open]'),button=event.target.closest?.('[data-wi-action]'),s=websiteInquiryState;
  if((!open&&!button)||s.saving||!wiActive()||s.identity!==wiIdentity())return;
  if(open){if(wiCanLeave()){wiSelect(open.dataset.wiOpen);wiRender();}return;}
  const action=button.dataset.wiAction;
  if(action==='copy'){try{await navigator.clipboard.writeText(s.draft.replyDraft);notify('답변 초안을 복사했어요.');}catch{s.error='복사하지 못했습니다. 초안 내용을 직접 선택해 복사해 주세요.';wiRender();}return;}
  if(action==='close'){if(wiCanLeave()){wiSelect(null);wiRender();}return;}
  if(!wiCanLeave())return;
  if(action==='reload'){s.dirty=false;await wiLoad();return;}
  if(action==='toggle'){if(await wiMutate('configure',{enabled:!s.data.settings.enabled,revision:s.data.settings.revision}))await wiLoad();}
  if(action==='verify'||action==='collect'){if(await wiMutate(action,{}))await wiLoad();}
});
