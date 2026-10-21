'use strict';
// 문의 접수(회사 관리자만) — 제작 도구 13판 A 「목록 + 상세」(2026-10-21). 그리기 도우미(mt*)는 maker-tools.js 앞 절반에 있다.
// 머리(계기판 = 고객 문의 상태별 수) → 수집 줄(연결 · 자동 수집 · 마지막 전체 수집) → 왼쪽 옅은 판: 찾기 · 「처리 중 / 모두」 · 01 새 문의 · 02 검토 중
// (「모두」일 때 03 답변 완료 · 04 종결 · 05 기능 점검) / 오른쪽: 머리(분류 · 근거) → 「지금 할 일」 → 사실 칸 → 01 문의 내용 · 02 답변 초안(저장 · 복사).
// 서버 계약(/api/website-inquiries · data-wi-* · 상태 new/reviewing/replied/closed · 답변은 보내지 않음)은 그대로다. 서버가 준 글(분류 이름 · 근거 · 다음 할 일 · 오류)은 그대로 보인다.
const websiteInquiryState={identity:'',request:0,loading:false,saving:false,attempted:false,data:null,error:'',selected:null,draft:null,dirty:false,query:'',scope:'open',picking:false,folds:{},copied:{},lastTarget:''};
const wiStatus={new:'새 문의',reviewing:'검토 중',replied:'답변 완료',closed:'종결'};
const wiTones={new:'wait',reviewing:'info',replied:'ok',closed:'off'};
const wiRunStatus={'not-connected':'읽기 연결 필요',ready:'자동 수집 켜짐',paused:'자동 수집 꺼짐',running:'수집 중','catching-up':'지난 문의 수집 중',failed:'수집 멈춤'};
function wiIdentity(){return state.user?[state.user.id,state.user.role||''].join(':'):'';}
function websiteInquiriesReset(){Object.assign(websiteInquiryState,{identity:'',request:websiteInquiryState.request+1,loading:false,saving:false,attempted:false,data:null,error:'',selected:null,draft:null,dirty:false,query:'',scope:'open',picking:false,folds:{},copied:{},lastTarget:''});}
function wiActive(){return !!state.user&&state.tab==='workroom'&&typeof wr!=='undefined'&&wr.view==='tools'&&typeof makerTools!=='undefined'&&makerTools.view==='inquiries';}
function websiteInquiriesEnsure(){
  const s=websiteInquiryState;
  if(s.identity!==wiIdentity()){websiteInquiriesReset();s.identity=wiIdentity();}
  if(state.user?.role!=='admin'||!wiActive())return;
  if(!s.attempted&&!s.loading){void wiLoad();return;}
  if(s.data&&wiTarget())wiRender();
}
// 깊은 링크(?inquiryId=…): 처음 보거나 주소가 바뀌었을 때만 그 문의를 연다. 끝난 문의 · 기능 점검 응답이면 「모두」로 넓혀 목록에서도 보이게 한다.
// 쓰던 초안이 있으면 다른 문의로 바꾸지 않는다(떠나기 확인 없이 버리지 않게).
function wiTarget(){
  const s=websiteInquiryState,target=typeof location!=='undefined'?new URLSearchParams(location.search).get('inquiryId'):'';
  if(!target||target===s.lastTarget||!s.data)return false;
  const row=s.data.items.find(item=>item.id===target);if(!row||s.dirty&&s.selected!==target)return false;
  s.lastTarget=target;if(s.selected!==target)wiSelect(target);if(!wiVisibleOpen(row))s.scope='all';s.picking=false;return true;
}
function wiRender(){if(wiActive())render();}
async function wiLoad(){
  const s=websiteInquiryState,identity=wiIdentity(),request=++s.request;
  if(!identity)return;s.loading=true;s.attempted=true;s.error='';wiRender();
  try{
    const data=await api('/api/website-inquiries');
    if(identity!==wiIdentity()||request!==s.request)return;
    if(!Array.isArray(data?.items)||data.draftOnly!==true)throw new Error('받은 문의 접수함의 형식이 맞지 않아요. 새로 읽어 주세요.');
    s.data=data;
    wiTarget();
    if(s.selected&&!s.dirty)wiSelect(s.selected);
    // 첫 화면에 할 일이 오게: 고른 것이 없으면 새 문의 → 검토 중 첫 줄을 연다(기능 점검 응답은 고르지 않는다).
    if(!s.selected){const first=wiOpenRows(data.items)[0];if(first)wiSelect(first.id);}
  }catch(error){if(identity===wiIdentity()&&request===s.request){s.error=error.message;if([401,403].includes(error.status)){s.data=null;s.draft=null;s.selected=null;}}}
  finally{if(identity===wiIdentity()&&request===s.request){s.loading=false;wiRender();}}
}
function wiSelect(id){
  const s=websiteInquiryState,row=s.data?.items.find(item=>item.id===id);
  s.selected=row?.id||null;s.draft=row?{revision:row.revision,status:row.status,replyDraft:row.replyDraft}:null;s.dirty=false;
}
function wiCanLeave(){return !websiteInquiryState.dirty||confirm('저장하지 않은 답변 초안 변경을 버릴까요?');}
const wiTest=row=>row?.classification?.isTest===true;
// 「처리 중」 범위에 보이는 줄: 고객 문의의 새 문의 · 검토 중.
const wiVisibleOpen=row=>!!row&&!wiTest(row)&&['new','reviewing'].includes(row.status);
function wiCustomer(items){return (items||[]).filter(row=>!wiTest(row));}
// 처리할 문의는 오래 기다린 것부터(접수 순), 끝난 문의는 서버 순서(최근에 바꾼 것부터) 그대로.
const wiOldest=rows=>[...rows].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
function wiOpenRows(items){const rows=wiCustomer(items);return [...wiOldest(rows.filter(row=>row.status==='new')),...wiOldest(rows.filter(row=>row.status==='reviewing'))];}
function wiCounts(items){const rows=wiCustomer(items),count=status=>rows.filter(row=>row.status===status).length;return {new:count('new'),reviewing:count('reviewing'),replied:count('replied'),closed:count('closed'),open:count('new')+count('reviewing'),customers:rows.length,tests:(items||[]).length-rows.length,all:(items||[]).length};}
function wiDate(value){const date=new Date(value);return value&&Number.isFinite(date.getTime())?date:null;}
function wiWhen(value,time=true){const date=wiDate(value);if(!date)return '';const year=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric'}).format(d);return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',...(year(date)!==year(new Date())?{year:'numeric'}:{}),month:'long',day:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).format(date);}
// 목록 줄 끝: 오늘이면 시각, 아니면 날짜.
function wiShort(value){const date=wiDate(value);if(!date)return '';const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(d);return day(date)===day(new Date())?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date):wiWhen(value,false);}
function wiTime(value){return wiWhen(value)||'아직 없어요';}
// 수집 줄: 오늘이면 시각만, 아니면 날짜와 시각.
function wiStamp(value){const date=wiDate(value);if(!date)return '';const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(d);return day(date)===day(new Date())?wiClock(value):wiWhen(value);}
function wiEvery(data){const minutes=Number(data?.settings?.intervalMinutes);return Number.isInteger(minutes)&&minutes>0?minutes:null;}
function wiButton(action,label,disabled=false,classes='small'){return `<button class="btn${classes?' '+classes:''}" type="button" data-wi-action="${escape(action)}" ${disabled?'disabled':''}>${escape(label)}</button>`;}
function wiSearchText(row){return [row.email,row.type,row.classification?.label,row.message].filter(Boolean).join(' ').toLowerCase();}
function wiStopped(data){return !!data.settings?.enabled&&data.schedulerEnabled===false&&!['failed','running','not-connected'].includes(data.run?.status);}
// 왼쪽 메뉴 숫자: 불러온 자료가 있을 때만, 새 고객 문의 수(내 차례라 코랄을 쓰지 않는다).
function websiteInquiriesNavCount(){const s=websiteInquiryState;if(!s.data||s.identity!==wiIdentity()||state.user?.role!=='admin')return null;return {value:wiCounts(s.data.items).new,tone:'',label:'새 문의'};}
function wiHead(){
  const s=websiteInquiryState,data=s.data,busy=s.saving||s.loading,counts=data?wiCounts(data.items):null;
  const actions=data?`${wiButton('collect','지금 수집',busy||!data.settings?.enabled||!data.connection?.configured,'')}<button type="button" class="btn icon" data-wi-action="reload" aria-label="새로 읽기" title="새로 읽기" ${busy?'disabled':''}>${mtIcon('refresh')}</button>${data.connection?.formId?`<a class="mt-link" href="https://docs.google.com/forms/d/${escape(data.connection.formId)}/edit#responses" target="_blank" rel="noopener noreferrer">Google 원본 열기</a>`:''}`:'';
  const meter=counts?mtMeter([{label:'새 문의',value:counts.new,unit:'건',tone:counts.new?'wait':''},{label:'검토 중',value:counts.reviewing,unit:'건'},{label:'답변 완료',value:counts.replied,unit:'건'},{label:'종결',value:counts.closed,unit:'건'}]):'';
  return mtHead({tool:'inquiries',title:'문의 접수',desc:'홈페이지 문의를 모아 분류와 답변 초안까지 준비해요. 답장은 직접 보내요.',actions,meter,layout:'desk'});
}
// 수집 줄: 서버 상태 값대로. 주기는 서버 설정(intervalMinutes)에서만 읽는다.
function wiSync(){
  const s=websiteInquiryState,data=s.data,busy=s.saving||s.loading,run=data.run||{},stopped=wiStopped(data),every=wiEvery(data),configured=!!data.connection?.configured;
  const tone=stopped?'off':{'not-connected':'wait',ready:'',paused:'off',running:'info','catching-up':'info',failed:'alert'}[run.status]??'wait';
  const label=stopped?'서버 자동 수집 꺼짐':wiRunStatus[run.status]||'수집 상태 모름';
  const last=run.lastSuccessAt?`마지막 전체 수집 ${wiStamp(run.lastSuccessAt)}`:'아직 끝난 전체 수집이 없어요';
  const next=data.settings?.enabled&&!stopped&&run.nextCheckAt&&['ready','catching-up'].includes(run.status)?` · 다음 수집 ${wiStamp(run.nextCheckAt)}`:'';
  const lines=[`${label}${run.status==='ready'&&!stopped&&every?` · ${every}분마다`:''} · ${last}${next}`];
  if(!configured)lines.push('Google 문의 양식을 읽을 연결이 아직 없어요. 연결 전에는 문의가 없다고 볼 수 없어요.');
  else if(stopped)lines.push('이 서버는 자동 실행이 꺼져 있어 주기적으로 돌지 않아요. 「지금 수집」으로 직접 모아요.');
  else if(run.status==='paused')lines.push(data.schedulerEnabled===false?'이 서버는 자동 실행이 꺼져 있어 설정을 켜도 주기적으로 돌지 않아요. 켠 뒤 「지금 수집」으로 직접 모아요.':every?`켜면 ${every}분마다 새 문의를 모아요.`:'켜면 새 문의를 자동으로 모아요.');
  if(run.error)lines.push(String(run.error));
  const toggle=data.settings?.enabled?'자동 수집 끄기':data.schedulerEnabled===false?'자동 수집 설정 켜기':every?`${every}분마다 자동 수집 켜기`:'자동 수집 켜기';
  return `<div class="wi-sync" data-tone="${tone}"><div class="mt-notice" data-tone="${tone}" role="status">${lines.map((line,index)=>index?`<p>${escape(line)}</p>`:`<strong>${escape(line)}</strong>`).join('')}</div><div class="mt-actions">${wiButton('verify','연결 확인',busy||!configured)}${wiButton('toggle',toggle,busy||!configured)}</div></div>`;
}
function websiteInquiriesPanel(){
  const s=websiteInquiryState;
  if(state.user?.role!=='admin')return `${mtHead({tool:'inquiries',title:'문의 접수',layout:'desk'})}${mtEmpty('회사 관리자만 볼 수 있어요','고객 연락처와 문의 내용이 있어 회사 관리자에게만 보여요.')}`;
  if(s.identity!==wiIdentity())return '<p class="mt-loading" role="status">문의 접수함을 불러오고 있어요.</p>';
  const head=wiHead();
  if(!s.data)return `<div class="wi-panel" aria-busy="${s.loading}">${head}${s.error?mtError(s.error,wiButton('reload','다시 읽기',s.loading)):'<p class="mt-loading" role="status">문의 접수함을 불러오고 있어요.</p>'}</div>`;
  return `<div class="wi-panel" aria-busy="${s.loading}">${head}${s.error?mtError(s.error):''}${wiSync()}<div class="mt-desk${s.picking?' is-picking':''}">${wiBand()}${wiList()}${wiDetail()}</div><p class="mt-note wi-foot">자동 수집은 분류 · 답변 초안 · 내 할 일까지만 만들어요. 고객에게 답하거나 홍보 목록에 넣지 않아요.</p></div>`;
}
// 휴대폰 띠: 고른 문의의 상태와 분류(위 계기판 숫자와 겹치지 않게). 목록보다 앞에 두어 「바꾸기」로 펼친 목록 위에 「닫기」가 남는다(넓은 화면에서는 숨는다).
function wiBand(){
  const s=websiteInquiryState,row=s.data.items.find(item=>item.id===s.selected);
  return `<div class="mt-list-mobile"><span>${row?`<b>${escape(wiTest(row)?'기능 점검':wiStatus[row.status]||'상태 모름')}</b> · ${escape(wiTest(row)?'기능 점검 응답':row.classification?.label||row.email)}`:'고른 문의 없음'}</span>${s.data.items.length?`<button type="button" class="btn small" data-wi-action="pick" aria-expanded="${s.picking}">${s.picking?'닫기':'바꾸기'}</button>`:''}</div>`;
}
function wiList(){
  const s=websiteInquiryState,data=s.data,items=data.items,counts=wiCounts(items),q=s.query.trim().toLowerCase(),hit=row=>!q||wiSearchText(row).includes(q);
  const customers=wiCustomer(items),tests=items.filter(wiTest),all=s.scope==='all';
  const groups=[['new','새 문의',wiOldest(customers.filter(row=>row.status==='new'))],['reviewing','검토 중',wiOldest(customers.filter(row=>row.status==='reviewing'))],...(all?[['replied','답변 완료',customers.filter(row=>row.status==='replied')],['closed','종결',customers.filter(row=>row.status==='closed')],['test','기능 점검 응답',tests]]:[])].filter(([,,rows])=>rows.length);
  // 줄 하나: 첫 줄은 분류(무엇), 둘째 줄은 이메일 · 문의 첫 줄(누가 · 무엇이라고), 끝에 받은 때. 상태는 점 색과 묶음 이름으로 함께 보인다.
  const item=(row,key)=>{const text=wiSearchText(row),test=wiTest(row),tone=test?'off':wiTones[row.status]||'';return `<button type="button" class="mt-item wi-item" data-wi-open="${escape(row.id)}" data-wi-row="${key}" data-search="${escape(text)}" aria-current="${s.selected===row.id}" ${hit(row)?'':'hidden'}>${test?mtLed(tone):mtLed(tone,wiStatus[row.status]||'')}<span><strong>${escape(test?'기능 점검 응답':row.classification?.label||'분류 확인')}</strong><small><span class="mt-item-text">${escape(row.email)} · ${escape(wiShortText(row.message))}</span></small></span><span class="mt-item-end">${escape(wiShort(row.createdAt))}</span></button>`;};
  const html=groups.map(([key,title,rows],index)=>`<h2 class="mt-list-group" data-wi-group="${key}" ${rows.some(hit)?'':'hidden'}><span class="mt-num">${String(index+1).padStart(2,'0')}</span>${escape(title)} <b>${mtNum(rows.length)}</b></h2>${rows.map(row=>item(row,key)).join('')}`).join('');
  const tools=items.length?`<div class="mt-list-tools"><label class="mt-search">${mtIcon('search')}<input type="search" data-wi-search value="${escape(s.query)}" placeholder="이메일 · 유형 · 내용 찾기" aria-label="문의 찾기" autocomplete="off"></label><div class="mt-seg" role="group" aria-label="목록 범위">${[['open','처리 중',counts.open,!all],['all','모두',counts.all,all]].map(([id,label,count,on])=>`<button type="button" data-wi-action="scope" data-scope="${id}" aria-pressed="${on}">${label} <b>${mtNum(count)}</b></button>`).join('')}</div></div>`:'';
  const found=groups.some(([,,rows])=>rows.some(hit));
  const empty=!items.length?`<p class="mt-list-empty">${!data.connection?.configured?'연결 전이라 비어 있어요.':data.run?.lastSuccessAt?`${escape(wiWhen(data.run.lastSuccessAt))} 수집 · 받은 문의가 없어요.`:'첫 수집 결과를 기다리고 있어요.'}</p>`:!groups.length?`<p class="mt-list-empty">처리할 문의가 없어요.</p>`:'';
  const foot=!all&&(counts.replied+counts.closed+counts.tests)?`<p class="mt-note mt-list-foot">답변 완료 · 종결${counts.tests?` · 기능 점검 응답 ${mtNum(counts.tests)}건`:''}은 「모두」에서 봐요.</p>`:'';
  return `<aside class="mt-list" aria-label="문의 목록">${tools}${html}<p class="mt-list-empty" data-wi-none ${q&&groups.length&&!found?'':'hidden'}>찾는 문의가 없어요.</p>${empty}${foot}</aside>`;
}
function wiDetail(){
  const s=websiteInquiryState,data=s.data,row=data.items.find(item=>item.id===s.selected),draft=s.draft;
  if(!row||!draft){
    const configured=!!data.connection?.configured,none=!data.items.length;
    const [title,text]=none?(!configured?['연결하면 여기서 문의를 처리해요','문의를 고르면 분류 · 답변 초안 · 처리 상태가 이 자리에 열려요.']:data.run?.lastSuccessAt?['받은 문의가 없어요','새 문의가 오면 분류와 답변 초안을 함께 준비해 둬요.']:['첫 수집을 기다리고 있어요','수집이 끝나면 받은 문의가 여기에 보여요.']):wiOpenRows(data.items).length?['목록에서 문의를 골라요','새 문의와 검토 중인 문의가 위에 와요.']:['처리할 문의가 없어요','답변 완료 · 종결 문의는 목록의 「모두」에서 봐요.'];
    const more=!none&&!wiOpenRows(data.items).length&&s.scope!=='all'?`<button type="button" class="btn small" data-wi-action="scope" data-scope="all" data-wi-pick>모두 보기</button>`:'';
    return `<div class="mt-detail"><div class="mt-detail-empty"><img src="${mtFelt('inquiries')}" alt="" width="120" height="117" decoding="async"><div><strong>${escape(title)}</strong><p>${escape(text)}</p></div>${more}</div></div>`;
  }
  const test=wiTest(row),c=row.classification||{},key=escape(row.id),lock=s.saving||s.loading?'disabled':'',tone=test?'off':wiTones[row.status]||'';
  const href=wiTaskHref(row);
  const chips=`${mtBadge(wiStatus[row.status]||'상태 모름',tone)}${test?mtBadge('기능 점검 · 고객 문의에서 빠짐','off'):''}${row.draftEdited?'<span>초안 고침</span>':''}`;
  const task=href?`<div class="mt-actions"><a class="mt-link" href="${escape(href)}">내 할 일에서 열기</a></div>`:test?'':`<p class="mt-note">${row.task?.state==='unavailable'?'후속 할 일이 지워져 있어요. 자동으로 다시 만들지 않아요.':'후속 할 일을 잇는 중이에요. 다시 수집하면 겹치지 않게 이어요.'}</p>`;
  const head=`<div class="mt-detail-head is-plain"><div><div class="mt-chips">${chips}</div><h2>${escape(c.label||'분류 확인')}</h2>${c.reason?`<p>${escape(c.reason)}</p>`:''}${task}</div></div>`;
  const facts=`<dl class="mt-facts wi-facts" data-cols="3"><div><dt>답변받을 이메일</dt><dd class="wi-email">${escape(row.email)}</dd></div><div><dt>접수</dt><dd>${escape(wiTime(row.createdAt))}</dd></div><div><dt>고른 문의 유형</dt><dd>${escape(row.type||'—')}</dd></div></dl>`;
  const sec=(name,num,title,sum,body,open)=>mtSec({num,title,sum,open:s.folds[name]??open,body,attrs:`id="wi-sec-${name}-${key}" data-wi-fold="${name}"`});
  const status=`<div class="wi-status" role="radiogroup" aria-label="처리 상태">${Object.entries(wiStatus).map(([id,label])=>`<label><input type="radio" name="status" value="${id}" ${draft.status===id?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
  const copied=s.copied[row.id];
  const reply=`${c.nextAction&&!test&&row.status==='reviewing'?`<p class="mt-note wi-hint">${escape(c.nextAction)}</p>`:''}<div class="wi-draft"><p class="wi-draft-bar"><span>초안 · 저장하거나 복사해도 고객에게 보내지 않아요</span><span data-wi-copied>${copied?escape(wiClock(copied)+'에 복사했어요'):''}</span></p><label class="mt-field"><span class="sr-only">답변 초안</span><textarea name="replyDraft" maxlength="6000" rows="9" data-wi-draft placeholder="${test?'기능 점검 응답이라 초안이 없어요.':'고객에게 보낼 답장 초안'}">${escape(draft.replyDraft)}</textarea></label></div><div class="wi-status-row"><span class="wi-status-label">처리 상태</span>${status}</div><p class="mt-note">답변 완료는 메일을 보낸 뒤, 종결은 더 할 일이 없을 때 골라요.</p>`;
  const body=`<fieldset class="wi-fields" ${lock}>${sec('message','01','문의 내용',wiShortText(row.message),`<pre class="wi-original">${escape(row.message)}</pre>`,true)}${sec('reply','02','답변 초안',draft.replyDraft?`${mtNum(draft.replyDraft.length)}자`:'비어 있어요',reply,true)}</fieldset>`;
  const foot=`<div class="mt-form-foot"><span class="mt-note" data-wi-dirty>${s.dirty?'저장하지 않은 변경이 있어요.':'고객 연락처는 관리자에게만 보여요.'}</span>${wiButton('copy','초안 복사',s.saving||!draft.replyDraft)}<button class="btn primary" type="submit" ${lock}>${s.saving?'저장 중…':'저장'}</button></div>`;
  return `<form class="mt-detail wi-sheet" data-wi-form data-wi-detail="${key}">${head}${wiNow(row,draft)}${facts}${body}${foot}</form>`;
}
function wiShortText(value){const text=value?String(value).replace(/\s+/g,' ').trim():'';return text?text.length>40?text.slice(0,40)+'…':text:'비어 있어요';}
// 「지금 할 일」: 저장된 상태로 고른다 — 새 문의 · 검토 중이면 포스터(흰 알약이 화면의 주 단추), 끝났거나 기능 점검이면 옅은 판.
// 이 화면은 메일을 보내지 않으니, 복사한 뒤 「답변 완료로 표시」를 바로 누르게 하고 복사한 시각만 남긴다(「보냄」이라고 쓰지 않는다).
function wiNow(row,draft){const s=websiteInquiryState,tool='inquiries',attrs='data-wi-now',c=row.classification||{},copied=s.copied[row.id],href=wiTaskHref(row),busy=s.saving||s.loading,empty=!String(draft.replyDraft||'').trim(),lock=busy||empty?'disabled':'',noDraft=busy||!draft.replyDraft?'disabled':'';
  const done=`<button type="button" class="mt-link" data-wi-action="replied" ${lock}>답변 완료로 표시</button>`;
  if(wiTest(row))return mtNow({tool,label:'기능 점검',title:'고객 문의가 아니에요',body:escape(c.nextAction||'기능 점검 응답이라 고객 문의 수에서 빠져요.'),tone:'quiet',attrs});
  if(['new','reviewing'].includes(row.status)&&copied)return mtNow({tool,label:'내 차례',title:'복사한 초안을 메일로 보냈나요?',body:escape(`${wiClock(copied)}에 초안을 복사했어요. 보냈으면 「답변 완료」로 표시해요.`),actions:`${mtPill('답변 완료로 표시',`data-wi-action="replied" ${lock}`)}<button type="button" class="mt-link" data-wi-action="copy" ${noDraft}>다시 복사</button>`,word:'문의',attrs});
  if(row.status==='new')return mtNow({tool,label:'내 차례',title:'답변 초안을 다듬어요',body:escape(c.nextAction||'문의 내용을 읽고 초안을 다듬어요.'),actions:`${mtPill('초안 다듬기','data-wi-action="draft"')}${done}`,word:'문의',attrs});
  if(row.status==='reviewing')return mtNow({tool,label:'내 차례',title:'다듬은 초안을 메일로 보내요',body:escape('초안을 복사해 메일로 보낸 뒤 「답변 완료로 표시」를 눌러요. 이 화면은 메일을 보내지 않아요.'),actions:`${mtPill('초안 복사',`data-wi-action="copy" ${noDraft}`)}${done}`,word:'문의',attrs});
  if(row.status==='replied')return mtNow({tool,label:'답변 완료',title:'답장을 보낸 문의예요',body:escape('더 할 일이 없으면 「종결」로 바꾸고, 내 할 일의 후속 작업도 끝내요.'),actions:href?`<a class="mt-link" href="${escape(href)}">내 할 일에서 열기</a>`:'',tone:'quiet',attrs});
  return mtNow({tool,label:'종결',title:'끝난 문의예요',body:escape('다시 이어 가려면 상태를 「검토 중」으로 바꿔 저장해요.'),tone:'quiet',attrs});
}
function wiClock(value){const date=wiDate(value);return date?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date):'';}
function wiTaskHref(row){return row.task?.href&&/^\/\?tab=messenger&panel=tasks&channelId=[^&]+&messageId=[^&]+$/.test(row.task.href)?row.task.href:'';}
// 찾기: 다시 그리지 않고 줄만 숨긴다(입력 칸 초점 유지). 다시 그릴 때는 wiList가 같은 규칙으로 숨긴다.
function wiFilterList(){if(typeof document.querySelectorAll!=='function')return;const q=websiteInquiryState.query.trim().toLowerCase(),seen=new Set();
  for(const row of document.querySelectorAll('[data-wi-row]')){const show=!q||String(row.dataset.search||'').includes(q);row.hidden=!show;if(show)seen.add(row.dataset.wiRow);}
  for(const head of document.querySelectorAll('[data-wi-group]'))head.hidden=!seen.has(head.dataset.wiGroup);
  const none=document.querySelector('[data-wi-none]');if(none)none.hidden=!q||seen.size>0||!document.querySelector('[data-wi-row]');
}
// 초안을 고칠 때는 다시 그리지 않고(쓰던 자리 · 초점 · 한글 조합 유지) 「저장하지 않은 변경」 줄과 복사 단추만 바꾼다.
function wiChanged(field){const s=websiteInquiryState;if(typeof document.querySelector!=='function')return;
  if(field==='replyDraft'&&s.selected&&s.copied[s.selected]){delete s.copied[s.selected];const copied=document.querySelector('[data-wi-copied]');if(copied)copied.textContent='';}
  const note=document.querySelector('[data-wi-dirty]');if(note)note.textContent='저장하지 않은 변경이 있어요.';
  const sum=document.querySelector('[data-wi-fold="reply"] .mt-sum');if(sum)sum.textContent=s.draft?.replyDraft?`${mtNum(s.draft.replyDraft.length)}자`:'비어 있어요';
  const row=s.data?.items.find(item=>item.id===s.selected),now=document.querySelector('[data-wi-now]');if(row&&s.draft&&now&&'outerHTML' in now)now.outerHTML=wiNow(row,s.draft);
  for(const button of document.querySelectorAll?.('[data-wi-action="copy"]')||[])button.disabled=s.saving||!s.draft?.replyDraft;}
function wiShowDraft(){const s=websiteInquiryState;s.folds.reply=true;render();const go=()=>{const box=document.querySelector?.('[data-wi-draft]');box?.scrollIntoView?.({block:'center',behavior:'smooth'});box?.focus?.({preventScroll:true});};if(typeof requestAnimationFrame==='function')requestAnimationFrame(go);}
// 저장한 문의를 판에 바로 넣는다. 「처리 중」에서 끝낸 문의는 목록에서 사라지지 않게 「모두」로 넓힌다.
function wiAccept(result){const s=websiteInquiryState,item=result?.item;if(!item?.id||!s.data)return;s.data.items=s.data.items.map(row=>row.id===item.id?item:row);if(s.selected!==item.id)return;wiSelect(item.id);if(s.scope==='open'&&!wiVisibleOpen(item))s.scope='all';}
async function wiMutate(action,body){
  const s=websiteInquiryState,identity=wiIdentity(),request=++s.request;s.saving=true;s.loading=false;s.error='';wiRender();
  try{const result=await api('/api/website-inquiries/'+action,body);if(identity!==wiIdentity()||request!==s.request)return null;s.dirty=false;return result||{};}
  catch(error){if(identity===wiIdentity()&&request===s.request){s.error=error.message;if([401,403].includes(error.status)){s.data=null;s.draft=null;s.selected=null;}}return null;}
  finally{if(identity===wiIdentity()&&request===s.request){s.saving=false;wiRender();}}
}
document.addEventListener('input',event=>{
  if(event.target.matches?.('[data-wi-search]')){websiteInquiryState.query=event.target.value;wiFilterList();return;}
  const form=event.target.closest?.('[data-wi-form]'),s=websiteInquiryState;if(!form||s.saving||!s.draft||s.identity!==wiIdentity())return;
  s.draft.replyDraft=String(new FormData(form).get('replyDraft')||'');s.dirty=true;wiChanged(event.target.name);
});
document.addEventListener('change',event=>{
  const form=event.target.closest?.('[data-wi-form]'),s=websiteInquiryState;if(!form||s.saving||!s.draft||s.identity!==wiIdentity())return;
  s.draft.status=String(new FormData(form).get('status')||'new');s.dirty=true;wiChanged(event.target.name);
});
document.addEventListener('submit',async event=>{
  if(!event.target.matches?.('[data-wi-form]'))return;event.preventDefault();
  const s=websiteInquiryState;if(s.saving||s.loading||!s.selected||!s.draft||s.identity!==wiIdentity())return;
  const values=new FormData(event.target),body={...s.draft,replyDraft:String(values.get('replyDraft')||''),status:String(values.get('status')||'')};
  const result=await wiMutate(encodeURIComponent(s.selected),body);if(result){wiAccept(result);await wiLoad();}
});
// 접는 번호 구역의 열림을 기억한다(toggle은 거품이 없어 잡기 단계에서 듣는다).
document.addEventListener('toggle',event=>{const node=event.target;if(node?.matches?.('[data-wi-fold]'))websiteInquiryState.folds[node.dataset.wiFold]=node.open;},true);
document.addEventListener('click',async event=>{
  const link=event.target.closest?.('[data-wi-form] a[href]');if(link){if(!wiCanLeave())event.preventDefault();return;}
  const open=event.target.closest?.('[data-wi-open]'),button=event.target.closest?.('[data-wi-action]'),s=websiteInquiryState;
  if((!open&&!button)||s.saving||!wiActive()||s.identity!==wiIdentity())return;
  if(open){if(s.selected===open.dataset.wiOpen){s.picking=false;wiRender();return;}if(wiCanLeave()){wiSelect(open.dataset.wiOpen);s.picking=false;s.folds={};wiRender();}return;}
  if(button.disabled)return;
  const action=button.dataset.wiAction;
  if(s.loading&&!['pick','scope','draft','copy'].includes(action))return;
  if(action==='copy'){try{await navigator.clipboard.writeText(s.draft.replyDraft);if(s.selected)s.copied[s.selected]=new Date().toISOString();notify('답변 초안을 복사했어요.');wiRender();}catch{s.error='복사하지 못했어요. 초안 칸에서 글을 골라 직접 복사해요.';wiRender();}return;}
  if(action==='draft'){wiShowDraft();return;}
  if(action==='pick'){s.picking=!s.picking;wiRender();return;}
  // 복사해 메일로 보낸 뒤: 지금 고친 초안과 함께 「답변 완료」로 저장한다(버리는 게 아니라 저장이라 떠나기 확인을 거치지 않는다).
  if(action==='replied'){if(!s.selected||!s.draft||!String(s.draft.replyDraft||'').trim())return;const id=s.selected,body={revision:s.draft.revision,status:'replied',replyDraft:s.draft.replyDraft};const result=await wiMutate(encodeURIComponent(id),body);if(result){delete s.copied[id];wiAccept(result);notify('「답변 완료」로 바꿨어요.');await wiLoad();}return;}
  if(action==='scope'){s.scope=button.dataset.scope==='all'?'all':'open';if(button.hasAttribute?.('data-wi-pick'))s.picking=true;wiRender();return;}
  if(!wiCanLeave())return;
  if(action==='reload'){if(s.dirty&&s.selected)wiSelect(s.selected);s.dirty=false;await wiLoad();return;}
  if(action==='toggle'){if(await wiMutate('configure',{enabled:!s.data.settings.enabled,revision:s.data.settings.revision}))await wiLoad();}
  if(action==='verify'||action==='collect'){if(await wiMutate(action,{}))await wiLoad();}
});
