'use strict';

const marinHome={userId:null,entries:[],draft:'',pending:false,error:'',request:0,composing:false};
const marinSessionKey=userId=>`synk-marin:session:${userId}`;
const marinNext={userId:null,date:'',started:false,pending:false,request:0,data:null,error:'',note:'',excluded:[],needsRefresh:false,checkedAt:0,help:false,asking:false};
const marinNextSessionKey=userId=>`synk-next-action:session:${userId}`;
const marinNextDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function resetMarinNext(clearStorage=true){
  if(clearStorage&&marinNext.userId)try{sessionStorage.removeItem(marinNextSessionKey(marinNext.userId));}catch{}
  Object.assign(marinNext,{userId:null,date:'',started:false,pending:false,request:marinNext.request+1,data:null,error:'',note:'',excluded:[],needsRefresh:false,checkedAt:0,help:false,asking:false});
}
function ensureMarinNextSession(){
  const userId=state.user?.id,date=marinNextDate();if(!userId)return;
  if(marinNext.userId!==userId){
    resetMarinNext(false);marinNext.userId=userId;marinNext.date=date;
    try{const saved=JSON.parse(sessionStorage.getItem(marinNextSessionKey(userId))||'{}');marinNext.started=saved.started===true;if(saved.date===date&&Array.isArray(saved.excluded))marinNext.excluded=saved.excluded.filter(key=>typeof key==='string'&&key.length<=2000).slice(-100);}catch{}
  }
  if(marinNext.date!==date){marinNext.date=date;marinNext.excluded=[];marinNext.data=null;marinNext.needsRefresh=marinNext.started;saveMarinNext();}
}
function saveMarinNext(){if(marinNext.userId)try{sessionStorage.setItem(marinNextSessionKey(marinNext.userId),JSON.stringify({date:marinNext.date,started:marinNext.started,excluded:marinNext.excluded}));}catch{}}
const NEXT_SOURCE_LABELS={messenger:'대화 업무',client:'고객 업무',publication:'게시 · SNS',lectures:'강의 일정',path:'상담·정착 지원 일정',company:'강의·상담 일정'};
const nextSourceLabel=key=>NEXT_SOURCE_LABELS[key]||key;
const NEXT_WORK_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeNextAction(value){
  if(value?.type==='messenger')return safeMarinAction(value);
  if(value?.type!=='workspace'||typeof value.label!=='string'||!value.label.trim()||typeof value.href!=='string'||!value.href.startsWith('/?')||/[\\\u0000-\u0020]/.test(value.href))return null;
  try{
    const url=new URL(value.href,location.origin),q=url.searchParams,tab=q.get('tab'),workId=q.get('workId');
    if(url.origin!==location.origin||url.pathname!=='/'||url.hash)return null;
    const companyWork=['lectures','path'].includes(tab)&&[...q.keys()].length===2&&q.getAll('tab').length===1&&q.getAll('workId').length===1&&NEXT_WORK_ID_RE.test(workId||'')&&url.search===`?tab=${tab}&workId=${workId}`;
    const valid=companyWork||tab==='workroom'&&(q.get('section')==='clients'&&q.has('project')||q.get('section')==='tools'&&q.get('tool')==='publication')||tab==='social'&&['today','fix'].includes(q.get('section'));
    return valid?{type:'workspace',label:value.label.trim().slice(0,100),href:url.pathname+url.search}:null;
  }catch{return null;}
}
function nextActionButton(label,action,extra='',primary=false){return `<button type="button" class="next-button${primary?' next-primary':''}" data-action="${action}" ${extra} ${marinNext.pending?'disabled':''}>${escape(label)}${primary?icon('arrow'):''}</button>`;}
const NEXT_COMPANY_KIND_RE=/^(?:SYNK\s+)?(?:SHIFT\s*|PATH\s*)?(?:유학·정착\s*)?(?:강의|상담|정착)(?:[·/\s]*(?:강의|상담|정착|지원|일정|일|업무))*$/i;
function nextDueValue(due){return !due?'':due.precision==='instant'&&Number.isFinite(Date.parse(due.value))?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(due.value))+' (한국 시간)':due.value||'';}
function nextDueText(due,sourceKey=''){
  if(!due)return '';
  const value=nextDueValue(due),rawLabel=(due.label||'').trim();
  const label=rawLabel==='상담 일정'||rawLabel==='PATH 상담'?'상담·정착 지원 일정':rawLabel;
  const skipLabel=Boolean(sourceKey)&&label&&(label===nextSourceLabel(sourceKey)||['lectures','path','company'].includes(sourceKey)&&NEXT_COMPANY_KIND_RE.test(label));
  return [skipLabel?'':label,value].filter(Boolean).join(' · ');
}
function nextContextText(row){
  const raw=typeof row?.context==='string'?row.context.trim():'';
  if(!raw)return '';
  const sourceKey=row.source||'',sourceLabel=nextSourceLabel(sourceKey),isCompany=['lectures','path','company'].includes(sourceKey);
  const dueRaw=(row.due?.value||'').trim(),dueFmt=nextDueValue(row.due).trim(),dueLabel=(row.due?.label||'').trim();
  const dueDates=[dueRaw,dueFmt,/^\d{4}-\d{2}-\d{2}/.test(dueRaw)?dueRaw.slice(0,10):''].filter(Boolean);
  const isDupPart=part=>{
    if(!part||part===sourceLabel||dueDates.includes(part))return true;
    if(!isCompany)return false;
    if(dueLabel&&part===dueLabel)return true;
    const hasDate=dueDates.some(d=>part.includes(d));
    let rest=part;
    for(const d of dueDates)rest=rest.split(d).join(' ');
    rest=rest.replace(/[()[\]·,/:|-]+/g,' ').trim();
    return NEXT_COMPANY_KIND_RE.test(rest)||hasDate&&(!rest||/^(?:일정|날짜|예정|예정일|당일|오늘)$/.test(rest));
  };
  return raw.split(/\s*·\s*/).map(s=>s.trim()).filter(part=>!isDupPart(part)).join(' · ');
}
function nextActionCard(row){
  const action=safeNextAction(row.action),source=NEXT_SOURCE_LABELS[row.source]||'내 업무',dueText=nextDueText(row.due,row.source),contextText=nextContextText(row);
  return `<article class="next-card" aria-labelledby="next-task-title"><div class="next-meta"><span class="next-source-chip">${escape(source)}</span>${dueText?`<span class="next-due">${escape(dueText)}</span>`:''}</div><h2 id="next-task-title">${escape(row.title)}</h2>${contextText?`<p class="next-context">${escape(contextText)}</p>`:''}<div class="next-reasons"><h3>이 일을 먼저 추천하는 이유</h3>${(row.reasons||[]).map(reason=>`<p>${escape(reason.text)}</p>`).join('')}</div>${row.checks?.length?`<div class="next-checks"><h3>열어서 확인할 것</h3><ul>${row.checks.map(check=>`<li>${escape(check)}</li>`).join('')}</ul></div>`:''}<div class="next-actions">${action?nextActionButton(action.label,'next-open',`data-key="${escape(row.key)}"`,true):'<p class="muted">원본 연결을 확인하지 못했어요.</p>'}${nextActionButton('다른 일 보기','next-skip')}${nextActionButton('도움받기','next-help',`aria-expanded="${marinNext.help}" aria-controls="next-help"`)}</div>${marinNext.help?`<div id="next-help" class="next-help"><p>막힌 부분과 필요한 자료를 원본 화면에서 확인하고 담당 동료에게 알려 주세요. 기존 대화와 검토 흐름에서 함께 해결할 수 있어요.</p>${action?nextActionButton('원본에서 함께 확인하기','next-open',`data-key="${escape(row.key)}"`):''}</div>`:''}</article>`;
}
function marinNextHtml(){
  const data=marinNext.data;
  if(!marinNext.started)return `<div class="next-start"><button type="button" class="next-button next-recommend-bar" data-action="next-recommend" ${marinNext.pending?'disabled':''}><span>다음 할 일 추천받기</span>${icon('arrow')}</button></div>`;
  let html=marinNext.pending?'<p class="next-status" role="status">현재 업무를 확인하고 있어요…</p>':'';
  if(marinNext.error)html+=`<p class="next-warning is-error" role="alert">${escape(marinNext.error)}</p>`;
  if(marinNext.note)html+=`<p class="next-status" role="status">${escape(marinNext.note)}</p>`;
  if(data?.status==='partial'||data?.status==='unknown'){
    const entries=Object.entries(data.coverage||{});
    const checked=entries.filter(([,value])=>value?.status==='ok').map(([key])=>nextSourceLabel(key));
    const missing=entries.filter(([,value])=>value?.status!=='ok').map(([key])=>nextSourceLabel(key));
    const scopeNote=[data.status==='partial'&&checked.length?`확인: ${checked.join(', ')}`:'',missing.length?`미확인: ${missing.join(', ')}`:''].filter(Boolean).join(' · ');
    html+=`<p class="next-warning">${data.status==='partial'?'일부 업무를 확인하지 못했어요. 확인된 범위에서 먼저 추천해요.':'업무를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.'}${scopeNote?` <span>${escape(scopeNote)}</span>`:''}</p>`;
  }
  if(data?.next)html+=nextActionCard(data.next);
  else if(data&&data.status!=='unknown'&&!marinNext.pending){
    const skipped=data.totalCount>0&&data.excludedCount===data.totalCount;
    const checked=Object.entries(data.coverage||{}).filter(([,value])=>value?.status==='ok').map(([key])=>nextSourceLabel(key));
    const emptyDetail=skipped
      ?'넘긴 업무는 원본에 그대로 남아 있어요. 다시 보거나 각 업무 화면에서 골라 주세요.'
      :checked.length
        ?`${checked.join(', ')}에서 확인했어요. 다른 동료를 기다리는 일은 추천에서 빼 두었어요.`
        :'현재 확인된 업무 범위에서 바로 내 차례인 일이 없어요.';
    html+=`<div class="next-empty"><h2>${skipped?'지금 보여 드릴 추천을 모두 확인했어요':data.status==='empty'?'확인한 업무 중 지금 내 차례인 일이 없어요':'확인된 범위에 추천할 일이 없어요'}</h2><p>${escape(emptyDetail)}</p></div>`;
  }
  const domainSpecs=[
    (typeof waFeature==='function'&&waFeature('lectures')||data?.coverage?.lectures)?{label:'강의 일정 보기',tab:'lectures'}:null,
    (typeof waFeature==='function'&&waFeature('path')||data?.coverage?.path)?{label:'상담·정착 지원 일정 보기',tab:'path'}:null,
  ].filter(Boolean);
  if(data?.unavailableCount){
    const viewLabels=[...domainSpecs.map(item=>item.label),'대화 업무 보기'];
    html+=`<p class="next-warning">읽기 전용이거나 담당·검토자를 확인해야 하는 업무 ${escape(String(data.unavailableCount))}건이 있어요. ${escape(viewLabels.join(', '))}에서 확인해 주세요.</p>`;
  }
  if(Array.isArray(data?.today)&&data.today.length){
    const extraToday=data.today.filter(row=>row&&typeof row.key==='string'&&row.key!==data.next?.key);
    if(extraToday.length)html+=`<div class="next-today-list"><h3>오늘 내 일정</h3><ul>${extraToday.map(row=>`<li><button type="button" data-action="next-open" data-key="${escape(row.key)}" ${marinNext.pending?'disabled':''}><span><strong>${escape(row.title)}</strong><small>${escape([nextSourceLabel(row.source),nextDueText(row.due,row.source)||nextContextText(row)].filter(Boolean).join(' · ')||'원본에서 확인')}</small></span>${icon('arrow')}</button></li>`).join('')}</ul></div>`;
  }
  if(data?.alternatives?.length)html+=`<details class="next-alternatives"><summary>다음 후보 ${escape(String(data.alternatives.length))}건 보기</summary><ul>${data.alternatives.map(row=>`<li><button type="button" data-action="next-open" data-key="${escape(row.key)}" ${marinNext.pending?'disabled':''}><span><strong>${escape(row.title)}</strong><small>${escape(nextDueText(row.due)||row.reasons?.[0]?.text||'원본에서 확인')}</small></span>${icon('arrow')}</button></li>`).join('')}</ul></details>`;
  const domainLinks=domainSpecs.map(item=>nextActionButton(item.label,'next-domain',`data-tab="${item.tab}"`)).join('');
  html+=`<div class="next-footer">${nextActionButton('새로 확인','next-recommend')}${marinNext.excluded.length?nextActionButton('넘긴 추천 다시 보기','next-restore'):''}${domainLinks}${nextActionButton('대화 업무 보기','next-all')}</div>`;
  if(data?.generatedAt&&Number.isFinite(Date.parse(data.generatedAt)))html+=`<p class="next-asof">${escape(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}).format(new Date(data.generatedAt)))} 확인 · 처리와 완료는 각 원본 화면에서 직접 진행해요.</p>`;
  return html;
}
const staffStoriesAssets={css:null,js:null,pending:null,error:false};
function sameOriginStaffAssetUrl(raw){
  if(!raw||typeof location==='undefined'||!location.origin||location.origin==='null')return '';
  try{
    const url=new URL(raw,location.href||location.origin);
    return (url.protocol==='http:'||url.protocol==='https:')&&url.origin===location.origin?url.pathname+url.search:'';
  }catch{return '';}
}
function getStaffStoriesTemplate(){
  if(typeof document==='undefined'||typeof document.getElementById!=='function')return null;
  const tpl=document.getElementById('staff-stories-assets');
  return tpl?.content&&typeof tpl.content.querySelector==='function'?tpl:null;
}
function readStaffStoriesUrls(tpl){
  const link=tpl.content.querySelector('link[rel="stylesheet"][href], link[href]');
  const script=tpl.content.querySelector('script[src]');
  const rawCss=typeof link?.getAttribute==='function'?link.getAttribute('href'):link?.href;
  const rawJs=typeof script?.getAttribute==='function'?script.getAttribute('src'):script?.src;
  const css=sameOriginStaffAssetUrl(rawCss),js=sameOriginStaffAssetUrl(rawJs);
  return css&&js?{css,js}:null;
}
let omittedStaffTpl=null;
function isOmittedStaffStories(urls){
  const hasV=/^[^?]*\?(?:[^&]*&)*v(?:[=&]|$)/;
  if(!urls||hasV.test(urls.css)||hasV.test(urls.js))return false;
  const app=typeof document!=='undefined'?document.querySelector?.('script[src^="/app.js?v="]'):null;
  const src=typeof app?.getAttribute==='function'?app.getAttribute('src'):app?.src;
  return typeof src==='string'&&/^\/app\.js\?v=[A-Za-z0-9_-]{43}$/.test(src);
}
let staffStoriesRetrySlot=null;
function staffStoriesPlaceholderHtml(){
  if(staffStoriesAssets.error)return '<section id="staff-stories-placeholder" class="next-card" data-staff-stories-placeholder="1" aria-live="polite"><p class="next-warning">내 글감을 불러오지 못했어요.</p><div class="next-actions"><button type="button" class="next-button" data-action="staff-stories-retry">다시 시도</button></div></section>';
  return '<section id="staff-stories-placeholder" data-staff-stories-placeholder="1" aria-busy="true" aria-live="polite"><p class="next-asof">내 글감을 불러오는 중이에요.</p></section>';
}
function getStaffStoriesPlaceholder(){
  if(typeof state==='undefined'||!state.user||state.tab!=='home')return null;
  if(typeof document==='undefined'||typeof document.getElementById!=='function')return null;
  const slot=document.getElementById('staff-stories-placeholder');
  if(!slot||!slot.parentNode)return null;
  const marker=typeof slot.getAttribute==='function'?slot.getAttribute('data-staff-stories-placeholder'):slot.dataset?.staffStoriesPlaceholder;
  return marker==='1'?slot:null;
}
function syncStaffStoriesPlaceholder(){
  const slot=getStaffStoriesPlaceholder();
  if(slot)slot.outerHTML=staffStoriesPlaceholderHtml();
}
function loadStaffStoriesAssets(urls){
  if(staffStoriesAssets.pending)return staffStoriesAssets.pending;
  const parent=typeof document!=='undefined'?(document.head||document.documentElement||document.body):null;
  if(!urls||!parent||typeof parent.appendChild!=='function'||typeof document.createElement!=='function'){
    staffStoriesAssets.error=true;
    return null;
  }
  if(!staffStoriesAssets.css){
    staffStoriesAssets.css=new Promise((resolve,reject)=>{
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.onload=()=>resolve();
      link.onerror=()=>{link.remove?.();staffStoriesAssets.css=null;reject(new Error('staff-stories css failed'));};
      link.href=urls.css;
      parent.appendChild(link);
    });
  }
  if(!staffStoriesAssets.js){
    staffStoriesAssets.js=typeof globalThis.staffStoriesSection==='function'
      ?Promise.resolve()
      :new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.onload=()=>{
          if(typeof globalThis.staffStoriesSection==='function')resolve();
          else{script.remove?.();staffStoriesAssets.js=null;reject(new Error('staff-stories js invalid'));}
        };
        script.onerror=()=>{script.remove?.();staffStoriesAssets.js=null;reject(new Error('staff-stories js failed'));};
        script.src=urls.js;
        parent.appendChild(script);
      });
  }
  const settle=ready=>{
    if(staffStoriesAssets.pending===pending)staffStoriesAssets.pending=null;
    staffStoriesAssets.error=!ready;
    const slot=getStaffStoriesPlaceholder();
    const restoreFocus=Boolean(slot&&slot===staffStoriesRetrySlot&&typeof document!=='undefined'&&document.activeElement===slot);
    staffStoriesRetrySlot=null;
    if(!slot)return;
    slot.outerHTML=ready?globalThis.staffStoriesSection():staffStoriesPlaceholderHtml();
    if(!restoreFocus)return;
    if(!ready){
      getStaffStoriesPlaceholder()?.querySelector?.('[data-action="staff-stories-retry"]')?.focus?.({preventScroll:true});
      return;
    }
    const heading=document.getElementById('ss-heading');
    if(heading){
      if(!heading.hasAttribute?.('tabindex'))heading.setAttribute?.('tabindex','-1');
      heading.focus?.({preventScroll:true});
    }
  };
  const pending=Promise.all([staffStoriesAssets.css,staffStoriesAssets.js]).then(
    ()=>{
      const ready=typeof globalThis.staffStoriesSection==='function';
      if(!ready)staffStoriesAssets.js=null;
      settle(ready);
    },
    ()=>settle(false)
  );
  staffStoriesAssets.pending=pending;
  return pending;
}
function retryStaffStoriesAssets(){
  if(typeof state==='undefined'||!state.user||state.tab!=='home'||staffStoriesAssets.pending)return;
  const tpl=getStaffStoriesTemplate();
  if(!tpl)return;
  const slot=getStaffStoriesPlaceholder();
  const retryBtn=slot?.querySelector?.('[data-action="staff-stories-retry"]');
  const shouldFocus=Boolean(retryBtn&&typeof document!=='undefined'&&document.activeElement===retryBtn);
  staffStoriesRetrySlot=null;
  const urls=readStaffStoriesUrls(tpl);
  staffStoriesAssets.error=!urls;
  syncStaffStoriesPlaceholder();
  if(urls&&shouldFocus){
    const loadingSlot=getStaffStoriesPlaceholder();
    if(loadingSlot){
      loadingSlot.setAttribute?.('tabindex','-1');
      loadingSlot.focus?.({preventScroll:true});
      staffStoriesRetrySlot=loadingSlot;
    }
  }
  if(!urls||!loadStaffStoriesAssets(urls)){
    staffStoriesRetrySlot=null;
    if(urls)syncStaffStoriesPlaceholder();
    if(shouldFocus)getStaffStoriesPlaceholder()?.querySelector?.('[data-action="staff-stories-retry"]')?.focus?.({preventScroll:true});
  }
}
function staffStoriesHomeHtml(){
  if(typeof state==='undefined'||!state.user)return '';
  if(typeof globalThis.staffStoriesSection==='function'&&!staffStoriesAssets.pending&&!staffStoriesAssets.error)return globalThis.staffStoriesSection();
  const tpl=getStaffStoriesTemplate();
  if(!tpl){omittedStaffTpl=null;return '';}
  if(!staffStoriesAssets.error&&!staffStoriesAssets.pending){
    if(tpl===omittedStaffTpl)return '';
    const urls=readStaffStoriesUrls(tpl);
    if(isOmittedStaffStories(urls)){omittedStaffTpl=tpl;return '';}
    omittedStaffTpl=null;
    loadStaffStoriesAssets(urls);
  }
  return staffStoriesPlaceholderHtml();
}
// ── 사무실과 「내 차례」(2026-11-24 유호님 「A와 E 섞기」 시안 F) ─────────────────────────
// 첫 화면은 사무실 그림이고, 방을 누르면 그 방으로 거른 받은편지함(?tab=home&section=inbox&room=…)이 열린다.
// 수는 받은편지함과 같은 자료 한 벌로 센다. 모든 「내 차례」 항목은 방 하나에 들어가므로 방 수의 합 = 받은편지함 전체 수다.
// 무리마다 권한(waFeature · isAdmin · 모듈 유무)을 먼저 보고, 권한 없는 API는 부르지 않는다. 403은 무리를 숨기고, 5xx · 통신 실패는 「못 불러왔어요 · 다시」.
// SNS 게시물 검토는 AI가 검토 링크로 확인하는 일이라 「알아 둘 것 · AI가 확인 중」에 두고 내 차례 수에서 뺀다(설계 12절).
const WS_ROOMS=[
  {id:'lab',name:'LAB 한국어 교실',short:'LAB 교실',co:'LAB',alt:'LAB 한국어 교실: 강사가 칠판 앞에서 학생들에게 가르치는 방'},
  {id:'shift',name:'SHIFT AI 강의실',short:'SHIFT 강의',co:'SHIFT',alt:'SHIFT AI 강의실: 강사가 단상에서 강의하는 방'},
  {id:'pulse',name:'PULSE 영상 스튜디오',short:'PULSE 촬영',co:'PULSE',alt:'PULSE 영상 스튜디오: 카메라 앞에서 촬영하는 방'},
  {id:'path',name:'PATH 유학 상담실',short:'PATH 상담',co:'PATH',alt:'PATH 유학 상담실: 상담사와 학생이 탁자에서 이야기하는 방'},
  {id:'lounge',name:'라운지 · 메신저',short:'라운지',co:'',alt:'라운지: 소파에서 동료 둘이 이야기하는 방'},
  {id:'desk',name:'제작 책상 · 만들기',short:'제작 책상',co:'',alt:'제작 책상: 모니터 두 대 앞에서 편집하는 방'},
];
const WS_GROUPS={tips:'공유하신 게시물 · 시안',clients:'PULSE 영상 제작 · 고객 일',messenger:'메신저 · 내 할 일',schedule:'SHIFT · PATH 일정',sns:'SNS 게시물 검토'};
const WS_WHEN=[['now','지금','기한이 지났거나 바로 볼 일'],['today','오늘','오늘 안에'],['week','이번 주','7일 안에']];
const WS_FILTERS=[['all','전체'],['tips','시안'],['messenger','대화'],['clients','고객'],['schedule','일정']];
const WS_TURN_STALE=60000;
const wsCss=value=>typeof CSS!=='undefined'&&typeof CSS.escape==='function'?CSS.escape(value):String(value).replace(/["\\]/g,'\\$&');
const workspaceTurn={userId:null,messenger:{status:'idle',data:null,at:0,request:0,loading:false},clients:{status:'idle',data:null,at:0,request:0,loading:false},busy:new Set(),timer:null,note:''};
const wsDemo=()=>typeof isDemoMode==='function'&&isDemoMode();
function wsTurnIdentity(){
  const id=state.user?.id||null;if(workspaceTurn.userId===id)return;
  workspaceTurn.userId=id;workspaceTurn.busy=new Set();workspaceTurn.note='';
  for(const key of ['messenger','clients'])Object.assign(workspaceTurn[key],{status:'idle',data:null,at:0,request:workspaceTurn[key].request+1,loading:false});
  Object.assign(workspaceInbox,{sel:'',detail:false,noteFor:''});
}
function wsCan(group){
  if(!state.user||wsDemo())return false;
  if(group==='tips')return typeof tipSharesAllowed==='function'&&tipSharesAllowed();
  if(group==='messenger')return true;
  if(group==='clients')return typeof waFeature==='function'&&waFeature('clients');
  if(group==='schedule')return typeof waMineVisibleCompanies==='function'&&waMineVisibleCompanies().length>0;
  if(group==='sns')return typeof snsSimple!=='undefined'&&typeof waFeature==='function'&&waFeature('social')&&(typeof waViewAllowed!=='function'||waViewAllowed('social'));
  return false;
}
// 메신저 할 일은 회사 화면이 처음 읽는 메신저 API다. api()를 거치지 않아 401이 회사 로그아웃으로 번지지 않고, 그 무리만 「못 불러옴」이 된다.
async function wsLoadMessenger(){
  const slot=workspaceTurn.messenger;if(slot.loading||!wsCan('messenger'))return;
  const userId=state.user.id,request=++slot.request;slot.loading=true;if(!slot.data)slot.status='loading';
  try{
    const response=await fetch('/messenger/api/workday',{credentials:'same-origin',headers:{Accept:'application/json'}});
    if(request!==slot.request||state.user?.id!==userId)return;
    if([403,404].includes(response.status)){slot.status='hidden';slot.data=null;return;}
    if(!response.ok)throw new Error('messenger '+response.status);
    const data=await response.json();
    if(request!==slot.request||state.user?.id!==userId)return;
    slot.data=data&&typeof data==='object'?data:null;slot.status=slot.data?'ready':'failed';
  }catch{if(request===slot.request&&state.user?.id===userId){slot.status='failed';slot.data=null;}}
  finally{if(request===slot.request){slot.loading=false;slot.at=Date.now();workspaceTurnPaint();}}
}
async function wsLoadClients(){
  const slot=workspaceTurn.clients;if(slot.loading||!wsCan('clients'))return;
  const userId=state.user.id,request=++slot.request;slot.loading=true;if(!slot.data)slot.status='loading';
  try{
    const data=await api('/api/client-workflow');
    if(request!==slot.request||state.user?.id!==userId)return;
    slot.data=data&&Array.isArray(data.items)?data:{items:[]};slot.status='ready';
  }catch(error){if(error?.code==='SESSION_CHANGED'||request!==slot.request||state.user?.id!==userId)return;slot.status=error?.status===403?'hidden':'failed';slot.data=null;}
  finally{if(request===slot.request){slot.loading=false;slot.at=Date.now();workspaceTurnPaint();}}
}
// 화면을 열 때 · 창이 다시 보일 때 · 동작 뒤 · 60초 넘는 주기로만 읽는다. 무거운 SNS 자료는 사무실 · 받은편지함에서만, SNS 화면과 같은 snsSimple 한 벌을 쓴다.
function workspaceTurnEnsure({force=false}={}){
  if(!state.user||wsDemo())return;
  wsTurnIdentity();
  const now=Date.now(),stale=at=>force||!at||now-at>WS_TURN_STALE;
  if(wsCan('messenger')&&!workspaceTurn.messenger.loading&&stale(workspaceTurn.messenger.at))void wsLoadMessenger();
  if(wsCan('clients')&&!workspaceTurn.clients.loading&&stale(workspaceTurn.clients.at))void wsLoadClients();
  if(wsCan('tips')&&typeof tipSharesLoad==='function'&&!tipShares.loading&&stale(Math.max(tipShares.loadedAt||0,tipShares.triedAt||0)))void tipSharesLoad({quiet:true});
  if(state.tab==='home'){
    if(wsCan('sns')&&typeof snsSimpleLoad==='function'){if(typeof snsSimpleIdentity==='function')snsSimpleIdentity();if(!snsSimple.loading&&(force||!snsSimple.attempted||now-snsSimple.attemptedAt>WS_TURN_STALE))void snsSimpleLoad();}
    if(force&&typeof wa!=='undefined'&&typeof waSyncMine==='function'&&wsCan('schedule')){wa.mineNeedsRefresh=true;waSyncMine();}
  }
  if(!workspaceTurn.timer&&typeof setInterval==='function'){workspaceTurn.timer=setInterval(()=>{if(typeof state!=='undefined'&&state.user&&typeof document!=='undefined'&&!document.hidden)workspaceTurnEnsure();},WS_TURN_STALE+5000);workspaceTurn.timer?.unref?.();}
}
function wsKstDate(offsetDays=0){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offsetDays*86400000));}
function wsWhen(date,today,week,fallback){
  const day=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(date)?date.slice(0,10):'';
  if(!day)return fallback;
  return day<today?'now':day===today?'today':day<=week?'week':'later';
}
function wsShortDate(date){const m=/^\d{4}-(\d{2})-(\d{2})/.exec(String(date||''));return m?`${Number(m[1])}.${Number(m[2])}`:'';}
// SNS 판의 계정 → 방: /api/social/simple의 accounts[](business · brand)에 판의 손잡이를 맞춘다. LAB 계정이면 LAB 교실, 아니면 제작 책상.
function wsSnsRoom(review,accounts){
  const lab=(review.plates||[]).some(plate=>(accounts||[]).some(account=>account.platform===plate.platform&&account.handle===plate.handle&&(account.business==='LAB'||/^LAB\b/i.test(account.brand||''))));
  return lab?'lab':'desk';
}
function workspaceTurnModel(){
  const today=wsKstDate(),week=wsKstDate(6),items=[],notes=[],groups={},uid=state.user?.id;
  const gate=(group,status)=>{groups[group]=wsCan(group)?status():'hidden';return groups[group]==='ready';};
  if(gate('tips',()=>tipShares.data?'ready':tipShares.error||tipShares.readFailed?'failed':'loading')){
    for(const row of tipShares.data.rows||[]){
      const base={group:'tips',kind:'tip',room:'desk',key:`tip:${row.row}`,row,title:row.summary||'요약이 없어요.',ctx:row.note||'',time:wsShortDate(row.sharedAt)||(typeof tipDate==='function'?tipDate(row.sharedAt):'')};
      if(row.decidable&&!row.pending)items.push({...base,when:'today'});
      else if(row.pending&&!row.pending.claimed)notes.push({...base,when:'done'});
    }
  }
  if(gate('clients',()=>workspaceTurn.clients.status==='hidden'?'hidden':workspaceTurn.clients.data?'ready':workspaceTurn.clients.status==='failed'?'failed':'loading')){
    for(const item of workspaceTurn.clients.data.items||[]){
      const mine=item.group==='review'?item.reviewerId===uid:['reply','next'].includes(item.group)&&item.ownerId===uid;
      if(!mine||!item.id)continue;
      const when=item.status==='overdue'||wsWhen(item.dueDate,today,week,'today')==='now'?'now':'today';
      items.push({group:'clients',kind:'client',room:'pulse',key:`client:${item.id}`,when,data:item,title:item.title||'고객 일',ctx:[item.projectTitle,item.text].filter(Boolean).join(' · '),time:wsShortDate(item.dueDate)});
    }
  }
  if(gate('messenger',()=>workspaceTurn.messenger.status==='hidden'?'hidden':workspaceTurn.messenger.data?'ready':workspaceTurn.messenger.status==='failed'?'failed':'loading')){
    const D=workspaceTurn.messenger.data,seen=new Map();
    for(const reason of ['reply','review','due','recovery'])for(const task of D.today?.groups?.[reason]||[]){if(!task?.id)continue;if(!seen.has(task.id))seen.set(task.id,{task,reasons:[]});seen.get(task.id).reasons.push(reason);}
    for(const {task,reasons} of seen.values()){
      const when=wsWhen(task.dueDate,today,week,'today')==='now'?'now':'today';
      items.push({group:'messenger',kind:'chat',room:'lounge',key:`chat:${task.id}`,when,task,reasons,title:task.title||'대화 속 할 일',ctx:wsChatContext(task,reasons),time:wsShortDate(task.dueDate)});
    }
    for(const task of D.remaining?.groups?.upcoming||[]){
      if(!task?.id||seen.has(task.id))continue;seen.set(task.id,{task,reasons:['upcoming']});
      if(wsWhen(task.dueDate,today,week,'later')==='week')items.push({group:'messenger',kind:'chat',room:'lounge',key:`chat:${task.id}`,when:'week',task,reasons:['upcoming'],title:task.title||'대화 속 할 일',ctx:wsChatContext(task,['upcoming']),time:wsShortDate(task.dueDate)});
    }
  }
  if(gate('schedule',()=>typeof wa!=='undefined'&&wa.mine?'ready':typeof wa!=='undefined'&&wa.mineError?'failed':'loading')){
    const companies=waMineVisibleCompanies();
    for(const row of wa.mine.items||[]){
      if(!companies.includes(row.company))continue;
      const when=wsWhen(row.date,today,week,'later'),room=row.company==='PATH'?'path':'shift';
      const entry={group:'schedule',kind:'schedule',room,key:`work:${row.id}`,when,row,title:row.title||'제목 없는 일정',ctx:row.company==='PATH'?'PATH 유학 · 정착 상담 일정':'SHIFT AI 강의 일정',time:wsShortDate(row.date)||'일정 미정'};
      if(when==='now'||when==='today')items.push(entry);else notes.push(entry);
    }
  }
  if(gate('sns',()=>snsSimple.data?'ready':snsSimple.errorStatus===403?'hidden':snsSimple.error?'failed':'loading')&&typeof ssReviewSplit==='function'){
    const D=snsSimple.data,{waiting,late}=ssReviewSplit(D);
    for(const [list,isLate] of [[late,true],[waiting,false]])for(const review of list){
      const handles=[...new Set((review.plates||[]).map(plate=>plate.handle).filter(Boolean))];
      notes.push({group:'sns',kind:'sns',room:wsSnsRoom(review,D.accounts),key:`sns:${review.postId}:${review.at}`,when:isLate?'late':'ai',review,late:isLate,title:review.title||'제목 없는 게시물',ctx:handles.join(' · '),time:String(review.at||'').slice(11,16)});
    }
  }
  const order={now:0,today:1,week:2};
  items.sort((a,b)=>order[a.when]-order[b.when]||String(a.time).localeCompare(String(b.time)));
  return {items,notes,groups,total:items.length,today};
}
function wsChatContext(task,reasons){
  const who=task.createdBy?.name?`${task.createdBy.name} 님이 맡김`:'';
  const why=reasons.includes('review')?'검토할 차례':reasons.includes('reply')?'받을지 답할 차례':reasons.includes('recovery')?'검토자를 다시 정할 차례':reasons.includes('due')?'오늘까지':'';
  return [why,who].filter(Boolean).join(' · ');
}
function workspaceTurnTotal(){try{return state.user?workspaceTurnModel().total:0;}catch{return 0;}}
function wsRoomCount(model,room){return model.items.filter(item=>item.room===room).length;}
function wsRoomEnabled(room){
  if(!state.user)return false;
  if(room.id==='lounge')return true;
  if(isAdmin())return true;
  const access=typeof waAccess==='function'?waAccess():{companies:[]};
  if(room.id==='desk')return (typeof waFeature==='function'&&(waFeature('production')||waFeature('social')))||wsCan('tips');
  const feature={lab:'teaching',shift:'lectures',pulse:'clients',path:'path'}[room.id];
  return (access.companies||[]).includes(room.co)||(typeof waFeature==='function'&&waFeature(feature));
}
function wsGreeting(){
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hour12:false}).format(new Date()));
  return hour<11?'좋은 아침이에요':hour<17?'안녕하세요':'오늘도 수고 많으셨어요';
}
function wsDateLabel(){
  const parts=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  return `${escape(parts)} · <span class="ws-mono">${escape(time)}</span>`;
}
const WS_KO_NUM=['','한','두','세','네','다섯'];
function wsHelloHtml(model){
  const name=escape(state.user?.name||'');
  const kinds=['tips','clients','messenger','schedule'].filter(group=>model.items.some(item=>item.group===group)).length;
  const failed=Object.values(model.groups).includes('failed'),loading=Object.values(model.groups).includes('loading');
  const line=kinds?`오늘 손댈 일은 ${WS_KO_NUM[kinds]||kinds} 가지예요.`:failed?'불러오지 못한 일이 있어요.':loading?'내 차례를 확인하고 있어요.':'지금 손댈 일이 없어요.';
  return `${wsGreeting()}, ${name}님.<b>${line}</b>`;
}
// 오른쪽 열: 무리별 한 줄. 꽉 찬 단추는 첫째 무리 하나만(이 화면에서 먼저 할 일).
function wsGroupLine(group,model){
  const list=model.items.filter(item=>item.group===group),n=list.length;
  const rooms=[...new Set(list.map(item=>item.room))];
  const room=group==='tips'?'desk':group==='clients'?'pulse':group==='messenger'?'lounge':rooms.length===1?rooms[0]:'';
  if(group==='tips')return {group,n,room,go:'고르기',k:WS_GROUPS.tips,t:`시안 <span class="ws-num">${n}</span>개를 골라 주세요`,d:'텔레그램으로 보내신 글로 만든 시안이에요'};
  if(group==='clients')return {group,n,room,go:'보기',k:`${workspaceCompanyMark('PULSE')}${WS_GROUPS.clients}`,t:n===1?escape(list[0].title):`고객 일 <span class="ws-num">${n}</span>개가 기다려요`,d:escape(list.slice(0,2).map(item=>item.data?.projectTitle||item.title).join(' · '))};
  if(group==='messenger')return {group,n,room,go:'대화 열기',k:WS_GROUPS.messenger,t:`<span class="ws-num">${n}</span>개가 내 답을 기다려요`,d:list.slice(0,2).map(item=>`${escape(item.title)}${item.time?` · <span class="ws-mono">${escape(item.time)}</span>까지`:''}`).join('<br>')};
  return {group,n,room,go:'열기',k:WS_GROUPS.schedule,t:`오늘 일정 <span class="ws-num">${n}</span>개`,d:escape(list.slice(0,2).map(item=>item.title).join(' · '))};
}
function wsOfficeTurnHtml(model){
  const order=['tips','clients','messenger','schedule'].filter(group=>model.groups[group]!=='hidden');
  const lines=order.filter(group=>model.items.some(item=>item.group===group)).map(group=>wsGroupLine(group,model));
  const failed=order.filter(group=>model.groups[group]==='failed');
  const loading=order.filter(group=>model.groups[group]==='loading');
  const lead=lines[0];
  const leadHtml=lead
    ?`<li class="ws-turn-lead"><span class="ws-turn-k">${lead.k}</span><p class="ws-turn-t">${lead.t}</p><p class="ws-turn-d">${lead.d}</p><span class="ws-turn-a"><a class="ws-btn ws-btn-primary" href="/?tab=home&section=inbox${lead.room?`&room=${lead.room}`:''}" data-action="ws-inbox" data-room="${lead.room}">${escape(lead.go)}</a></span></li>`
    :`<li class="ws-turn-lead is-done"><span class="ws-turn-k">내 차례</span><p class="ws-turn-t">${loading.length&&!failed.length?'내 차례를 확인하고 있어요':'지금 손댈 일이 없어요'}</p><p class="ws-turn-d">${loading.length?'잠시만 기다려 주세요':'새 일이 오면 여기에 보여요'}</p></li>`;
  return {lead:leadHtml,rest:lines.slice(1).map(line=>`<li><a class="ws-trow" href="/?tab=home&section=inbox${line.room?`&room=${line.room}`:''}" data-action="ws-inbox" data-room="${line.room}"><span class="ws-turn-k">${line.k}</span><span class="ws-turn-t">${line.t}</span><span class="ws-turn-d">${line.d}</span><span class="ws-go">${escape(line.go)}${workspaceShellGlyph('chev')}</span></a></li>`).join('')
    +failed.map(group=>`<li><div class="ws-trow is-failed" role="status"><span class="ws-turn-k">${WS_GROUPS[group]}</span><span class="ws-turn-t">못 불러왔어요</span><span class="ws-turn-d">이 무리의 수는 아직 몰라요. 0개라는 뜻이 아니에요.</span><button type="button" class="ws-go" data-action="ws-turn-retry" data-group="${group}">다시${workspaceShellGlyph('chev')}</button></div></li>`).join('')
    +wsOfficeSnsLine(model)};
}
function wsOfficeSnsLine(model){
  if(model.groups.sns==='hidden')return '';
  if(model.groups.sns==='failed')return `<li><div class="ws-trow is-failed is-ai" role="status"><span class="ws-turn-k">알아 둘 것 · ${WS_GROUPS.sns}</span><span class="ws-turn-t">못 불러왔어요</span><button type="button" class="ws-go" data-action="ws-turn-retry" data-group="sns">다시${workspaceShellGlyph('chev')}</button></div></li>`;
  const sns=model.notes.filter(note=>note.group==='sns');if(!sns.length)return '';
  const late=sns.filter(note=>note.late).length;
  return `<li><a class="ws-trow is-ai" href="/?tab=home&section=inbox" data-action="ws-inbox" data-room=""><span class="ws-turn-k">알아 둘 것 · AI가 확인 중</span><span class="ws-turn-t">SNS 게시물 <span class="ws-num">${sns.length}</span>개를 검토하고 있어요</span><span class="ws-turn-d">AI가 텔레그램 검토 링크로 승인해요.${late?` 나갈 시각이 지난 것 ${late}개`:''}</span><span class="ws-go">보기${workspaceShellGlyph('chev')}</span></a></li>`;
}
function wsOfficeRoomsHtml(model){
  return WS_ROOMS.map(room=>{
    const n=wsRoomCount(model,room.id),enabled=wsRoomEnabled(room);
    const label=`${room.name} ${enabled?(n?`· 내 차례 ${n}개`:'· 지금 내 차례 없음'):'· 내 소속이 아니에요'}`;
    return `<button type="button" class="ws-room" data-room="${room.id}" data-action="ws-inbox"${enabled?'':' disabled aria-disabled="true"'} aria-label="${escape(label)}"><span class="ws-nametag${n?'':' is-solo'}">${workspaceCompanyMark(room.co)}<span class="ws-full">${escape(room.name)}</span><span class="ws-short">${escape(room.short)}</span>${n?`<span class="ws-pill">${n}</span>`:''}</span></button>`;
  }).join('');
}
// 오늘 나가는 SNS · 운영 상태 — SNS를 볼 수 있는 사람에게만, SNS 화면과 같은 자료로.
function wsOfficeExtraHtml(){
  if(!wsCan('sns')||!snsSimple.data)return '';
  const D=snsSimple.data,tonight=D.tonight||[],H=D.health||{};
  const slots=new Map();for(const row of tonight){const key=row.time||'시각 미정';slots.set(key,(slots.get(key)||0)+1);}
  const late=typeof ssReviewSplit==='function'?ssReviewSplit(D).late.length:0;
  const going=tonight.length?`<h3>오늘 나가는 SNS 게시물 <span class="ws-num">${tonight.length}</span>개</h3><div class="ws-going">${[...slots.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([time,n])=>`<a href="/?tab=social&section=today" data-action="wa-open" data-tab="social" data-section="today"><span class="ws-mono">${escape(time)}</span><span><b class="ws-num">${n}</b>개</span></a>`).join('')}</div>`:'<h3>오늘 나가는 SNS 게시물은 없어요</h3>';
  const health=[['예약 문제',`${(D.problems||[]).length}건`,(D.problems||[]).length>0],['나갈 시각이 지난 검토',`${late}개`,late>0],['오늘 수집한 SNS 계정',`${Number(H.collectOk)||0} / ${Number(H.collectTotal)||0}`,false],['다시 연결할 계정',`${Number(H.needsReconnect)||0}개`,Number(H.needsReconnect)>0]];
  return `${going}<h3>운영 상태</h3><dl class="ws-health">${health.map(([label,value,warn])=>`<div><dt>${escape(label)}</dt><dd class="${warn?'is-warn':''}">${escape(value)}</dd></div>`).join('')}</dl>`;
}
function wsOfficeHtml(){
  const model=workspaceTurnModel(),turn=wsOfficeTurnHtml(model),name=escape(state.user?.name||'');
  // 소속 글 · 미지정 안내 띠 · 업무 링크 안내는 인사 아래에 둔다. 회사별 업무 입구(예전 waHomeTools)는 왼쪽 메뉴 · 「더보기」 시트가 맡는다.
  const scope=typeof waScopeBar==='function'?waScopeBar():'',notice=typeof waWorkTargetNoticeHtml==='function'?waWorkTargetNoticeHtml():'';
  return `<section class="next-home ws-office" id="ws-office" aria-labelledby="ws-office-hello">
    <div class="ws-office-hello"><h1 id="ws-office-hello" class="ws-hello">${wsHelloHtml(model)}</h1><div class="ws-office-notes">${scope}${notice}</div></div>
    <div class="ws-office-t1"><h2 class="ws-office-date">${wsDateLabel()}</h2><ol class="ws-turn" id="ws-office-lead" aria-label="내 차례">${turn.lead}</ol></div>
    <div class="ws-office-map">
      <div class="ws-office-figure" id="ws-office-rooms" role="group" aria-label="사무실 그림. 위층에 LAB 한국어 교실, SHIFT AI 강의실, PULSE 영상 스튜디오, 아래층에 PATH 유학 상담실, 라운지, 제작 책상이 있어요."><span class="ws-office-img" aria-hidden="true"></span>${wsOfficeRoomsHtml(model)}</div>
      <p class="ws-office-cap">방을 누르면 그 방의 일이 열려요. 검은 숫자는 ${name}님 차례인 일이에요.</p>
    </div>
    <div class="ws-office-t2">
      <ol class="ws-turn ws-turn-rest" id="ws-office-rest" aria-label="내 차례 이어서">${turn.rest}</ol>
      <div class="ws-office-next"><div id="next-action" aria-busy="${marinNext.pending}">${marinNextHtml()}</div></div>
      <div class="ws-office-extra" id="ws-office-extra">${wsOfficeExtraHtml()}</div>
    </div>
    <div class="ws-office-more">${staffStoriesHomeHtml()}<details class="next-assistant" ${marinNext.asking?'open':''}><summary><span class="next-assistant-title"><span class="marin-assistant-avatar" aria-hidden="true">${icon('chat')}</span><span>마린에게 직접 묻기</span></span>${icon('right')}</summary>${marinConversationPage()}</details></div>
  </section>`;
}
// ── 받은편지함 ──
function wsInboxItems(model){
  const room=workspaceInbox.room,filter=room?'all':workspaceInbox.filter;
  return {
    items:model.items.filter(item=>(!room||item.room===room)&&(filter==='all'||item.group===filter)),
    notes:model.notes.filter(note=>(!room||note.room===room)&&(filter==='all'||note.group===filter||filter==='tips'&&note.group==='tips')),
  };
}
function wsLead(item){
  if(item.kind==='sns'&&item.review?.thumb?.src){
    const thumb=item.review.thumb;
    return thumb.kind==='video'?'<span class="ws-r-thumb is-video" aria-hidden="true"></span>':`<img class="ws-r-thumb" src="${escape(thumb.src)}" alt="" loading="lazy" decoding="async">`;
  }
  const glyph={tip:'tip',client:'file',chat:'chat',schedule:'office',sns:'sns'}[item.kind]||'inbox';
  return `<span class="ws-r-ic">${workspaceShellGlyph(glyph)}</span>`;
}
function wsSourceLabel(item){
  if(item.kind==='tip')return '시안 고르기';
  if(item.kind==='client')return `${workspaceCompanyMark('PULSE')}고객 · PULSE`;
  if(item.kind==='chat')return '메신저 · 할 일';
  if(item.kind==='schedule')return `${workspaceCompanyMark(item.row.company)}${item.row.company==='PATH'?'PATH 상담 일정':'SHIFT 강의 일정'}`;
  return `${item.room==='lab'?workspaceCompanyMark('LAB'):''}SNS 검토 · AI가 확인 중`;
}
function wsRowHtml(item,selected){
  const tag=item.kind==='sns'&&item.late?'<span class="ws-tag is-warn">시각 지남</span>':item.kind==='tip'&&item.row?.pending?'<span class="ws-tag">고름</span>':item.when==='now'?'<span class="ws-tag is-warn">지남</span>':'';
  return `<button type="button" class="ws-row${item.group==='sns'?' is-note':''}" data-action="ws-inbox-select" data-key="${escape(item.key)}" ${selected?'aria-current="true"':''} aria-controls="ws-inbox-detail">${`<span class="ws-r-lead">${wsLead(item)}</span>`}<span class="ws-r-main"><span class="ws-r-src">${wsSourceLabel(item)}</span><span class="ws-r-title">${escape(item.title)}</span>${item.ctx?`<span class="ws-r-ctx">${escape(item.ctx)}</span>`:''}</span><span class="ws-r-time"><span class="ws-mono">${escape(item.time||'')}</span>${tag}</span></button>`;
}
function wsInboxSelectable(model){const {items,notes}=wsInboxItems(model);return [...items,...notes];}
function wsInboxCurrent(model){
  const list=wsInboxSelectable(model);
  let item=list.find(entry=>entry.key===workspaceInbox.sel)||null;
  if(!item&&workspaceInbox.sel){item=model.items.find(entry=>entry.key===workspaceInbox.sel)||model.notes.find(entry=>entry.key===workspaceInbox.sel)||null;}
  if(!item){item=list[0]||null;workspaceInbox.sel=item?.key||'';}
  return item;
}
function wsInboxHeadHtml(model){
  const room=WS_ROOMS.find(entry=>entry.id===workspaceInbox.room),{items}=wsInboxItems(model),n=items.length,name=escape(state.user?.name||'');
  const count=n?` <span class="ws-coral-n">${n}</span>`:'';
  if(room){
    const line={lab:'LAB 계정 SNS 게시물과 LAB 수업 일이 여기에 모여요.',shift:'SHIFT 강의 일정 가운데 오늘 볼 것이 여기에 모여요.',pulse:'PULSE 고객이 보낸 요청과 검토가 여기에 모여요.',path:'PATH 상담 일정 가운데 오늘 볼 것이 여기에 모여요.',lounge:'메신저 대화에서 나에게 온 할 일이 여기에 모여요.',desk:'공유하신 게시물로 만든 시안과 그 밖의 SNS 게시물이 여기에 모여요.'}[room.id];
    return `<div class="ws-lh-nav"><a class="ws-backlink" href="/?tab=home" data-action="ws-office">${workspaceShellGlyph('left')}사무실로</a><a class="ws-alllink" href="/?tab=home&section=inbox" data-action="ws-inbox" data-room="">모든 내 차례 보기${workspaceShellGlyph('chev')}</a></div>
      <div class="ws-roomstrip" data-room="${room.id}" role="img" aria-label="${escape(room.alt)}"></div>
      <h1 class="ws-lh-title" id="ws-inbox-title">${workspaceCompanyMark(room.co)}${escape(room.name)}${count}</h1><p class="ws-lh-sum">${n?`이 방에서 ${name}님 차례인 일이 ${n}개예요.`:'이 방에는 지금 손댈 일이 없어요.'} ${line}</p>`;
  }
  const by=when=>model.items.filter(item=>item.when===when).length;
  const parts=[by('now')?`지금 ${by('now')}개`:'',by('today')?`오늘 안에 ${by('today')}개`:'',by('week')?`이번 주에 ${by('week')}개`:''].filter(Boolean);
  const filters=WS_FILTERS.filter(([id])=>id==='all'||model.groups[id]&&model.groups[id]!=='hidden');
  return `<span class="ws-lh-date">${wsDateLabel()}</span><h1 class="ws-lh-title" id="ws-inbox-title">${name}님 차례${count}</h1><p class="ws-lh-sum">${parts.length?`${parts.join(', ')}예요.`:'지금 손댈 일이 없어요.'}</p>
    ${filters.length>2?`<div class="ws-tabs" role="toolbar" aria-label="무리로 거르기">${filters.map(([id,label])=>{const c=id==='all'?model.total:model.items.filter(item=>item.group===id).length;return `<button type="button" class="ws-tabchip" data-action="ws-inbox-filter" data-filter="${id}" aria-pressed="${workspaceInbox.filter===id}">${escape(label)} <span class="ws-num">${c}</span></button>`;}).join('')}</div>`:''}`;
}
function wsInboxBodyHtml(model,current){
  const room=workspaceInbox.room,{items,notes}=wsInboxItems(model);
  const groupsShown=room?{lab:['sns'],shift:['schedule'],pulse:['clients'],path:['schedule'],lounge:['messenger'],desk:['tips','sns']}[room]:['tips','clients','messenger','schedule','sns'];
  const failed=groupsShown.filter(group=>model.groups[group]==='failed'&&(workspaceInbox.filter==='all'||room||workspaceInbox.filter===group));
  const loading=groupsShown.filter(group=>model.groups[group]==='loading');
  let html=failed.map(group=>`<div class="ws-grp is-failed" role="status"><b>${WS_GROUPS[group]}</b><span>못 불러왔어요. 0개라는 뜻이 아니에요.</span><button type="button" class="ws-linkbtn" data-action="ws-turn-retry" data-group="${group}">다시</button></div>`).join('');
  if(room==='lounge')html+=`<div class="ws-lounge-open"><a class="ws-btn ws-btn-line" href="/?tab=messenger" data-action="tab" data-tab="messenger">${workspaceShellGlyph('chat')}메신저 열기</a></div>`;
  for(const [when,label,hint] of WS_WHEN){
    const list=items.filter(item=>item.when===when);if(!list.length)continue;
    html+=`<div class="ws-grp"><b>${label}</b><span>${hint}</span></div>${list.map(item=>wsRowHtml(item,item.key===current?.key)).join('')}`;
  }
  if(!items.length)html+=`<p class="ws-empty">${loading.length?'내 차례를 확인하고 있어요.':room?'이 방에는 지금 손댈 일이 없어요.':'지금 손댈 일이 없어요. 새 일이 오면 여기에 올라와요.'}</p>`;
  const noteGroups=[['tips','방금 고른 시안','곧 장부에 옮겨요'],['schedule','다가오는 일정','오늘 뒤 · 날짜 미정'],['sns','알아 둘 것 · AI가 확인 중','AI가 검토 링크로 승인해요']];
  for(const [group,label,hint] of noteGroups){
    const list=notes.filter(note=>note.group===group);if(!list.length)continue;
    html+=`<div class="ws-grp is-note"><b>${label}</b><span>${hint}</span></div>${list.slice(0,40).map(note=>wsRowHtml(note,note.key===current?.key)).join('')}${list.length>40?`<p class="ws-empty">그 밖에 ${list.length-40}개는 SNS 화면에서 볼 수 있어요.</p>`:''}`;
  }
  return html;
}
function wsMeta(rows){const list=rows.filter(([,value])=>value);return list.length?`<dl class="ws-meta">${list.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${value}</dd>`).join('')}</dl>`:'';}
const WS_STAGE={requested:'수락 전',accepted:'수락함',doing:'진행 중',review:'검토 중',changes:'수정 요청'};
function wsDetailHtml(item,model){
  if(!item)return `<div class="ws-dpad"><h2 class="ws-d-title">${workspaceInbox.room?'이 방에는 지금 손댈 일이 없어요':'내 차례를 다 끝냈어요'}</h2><p class="ws-d-lead">새로 들어오면 왼쪽 목록에 올라와요.</p></div>`;
  const busy=workspaceTurn.busy.has(item.key);
  if(item.kind==='tip'){
    const row=item.row,data=tipShares.data||{},link=typeof tipLink==='function';
    const draft=row.draft?.url&&link?tipLink(row.draft.url,'시안 보기'):'',source=link?tipLink(row.url,'원본'):'';
    let acts;
    if(row.pending)acts=`<div class="ws-sent" role="status"><span class="ws-tag">${escape(typeof tipChoiceLabel==='function'?tipChoiceLabel(row.pending.to):'')} 정했어요</span><p>${row.pending.claimed?'장부에 옮기는 중이에요.':'곧 장부에 옮겨요. 그 전에는 되돌릴 수 있어요.'}</p></div>${row.pending.claimed?'':`<div class="ws-acts"><button type="button" class="ws-btn ws-btn-line" data-tip-action="undo" data-tip-row="${row.row}" ${tipShares.busy?.has(String(row.row))?'disabled':''}>되돌리기</button></div>`}`;
    else if(!data.canDecide)acts='<p class="ws-d-lead">이 계정은 장부를 올리는 자동화 계정이라 고를 수 없어요.</p>';
    else acts=`<div class="ws-acts"><button type="button" class="ws-btn ws-btn-decide" data-tip-action="decide" data-tip-to="적용 중" data-tip-row="${row.row}" ${tipShares.busy?.has(String(row.row))?'disabled':''}>적용해</button><button type="button" class="ws-btn ws-btn-line" data-tip-action="decide" data-tip-to="버림" data-tip-row="${row.row}" ${tipShares.busy?.has(String(row.row))?'disabled':''}>버림</button></div>`;
    return `<div class="ws-dpad"><div class="ws-src">${workspaceShellGlyph('tip')}공유한 게시물 · ${escape(row.target||'시안')}${item.time?` · ${escape(item.time)}`:''}</div><h2 class="ws-d-title" id="ws-detail-title" tabindex="-1">${escape(item.title)}</h2>${row.note?`<p class="ws-d-lead">${escape(row.note)}</p>`:''}${wsMeta([['받은 곳','텔레그램'],['시안',draft],['원본',source]])}${acts}</div>`;
  }
  if(item.kind==='client'){
    const data=item.data,note=workspaceInbox.noteFor===item.key;
    const actions=(data.actions||[]).filter(action=>['start','complete','accept','request_changes','reopen'].includes(action.action));
    const decide=new Set(['accept','complete']);
    const buttons=actions.map(action=>action.action==='request_changes'?`<button type="button" class="ws-btn ws-btn-line" data-action="ws-client-note" data-key="${escape(item.key)}" ${busy?'disabled':''}>${escape(action.label||'더 고치기')}</button>`:`<button type="button" class="ws-btn ${decide.has(action.action)?'ws-btn-decide':'ws-btn-line'}" data-action="ws-client-act" data-key="${escape(item.key)}" data-workflow="${escape(action.action)}" ${busy?'disabled':''}>${escape(action.label||action.action)}</button>`).join('');
    const open=data.href?`<button type="button" class="ws-btn ws-btn-text" data-action="ws-client-open" data-key="${escape(item.key)}">${escape(data.actionLabel||'고객 화면에서 열기')}${workspaceShellGlyph('chev')}</button>`:'';
    const form=note?`<div class="ws-fb"><label for="ws-client-note">무엇을 더 고칠지 적어 주세요</label><textarea id="ws-client-note" class="ws-ta" rows="4" maxlength="3000" placeholder="예: 두 번째 장면의 자막을 빼 주세요."></textarea><div class="ws-acts"><button type="button" class="ws-btn ws-btn-primary" data-action="ws-client-act" data-key="${escape(item.key)}" data-workflow="request_changes" ${busy?'disabled':''}>고칠 점 보내기</button><button type="button" class="ws-btn ws-btn-text" data-action="ws-client-note-cancel">그만두기</button></div></div>`:'';
    return `<div class="ws-dpad"><div class="ws-src">${workspaceCompanyMark('PULSE')}PULSE 영상 제작 · 고객 일${data.projectTitle?` · ${escape(data.projectTitle)}`:''}</div><h2 class="ws-d-title" id="ws-detail-title" tabindex="-1">${escape(item.title)}</h2>${data.text?`<p class="ws-d-lead">${escape(data.text)}</p>`:''}${wsMeta([['상태',escape(data.statusLabel||'')],['기한',data.dueDate?`<span class="ws-mono">${escape(data.dueDate)}</span>`:''],['내 몫',escape(data.group==='review'?'검토':'담당')]])}${form||`<div class="ws-acts">${buttons}${open}</div>`}</div>`;
  }
  if(item.kind==='chat'){
    const task=item.task,body=String(task.message?.body||'').slice(0,400);
    const open=task.channelId?`<button type="button" class="ws-btn ws-btn-primary" data-action="ws-chat-open" data-key="${escape(item.key)}">${workspaceShellGlyph('chat')}대화 열기</button>`:'';
    return `<div class="ws-dpad"><div class="ws-src">${workspaceShellGlyph('chat')}메신저 · ${escape(wsChatContext(task,item.reasons)||'할 일')}</div><h2 class="ws-d-title" id="ws-detail-title" tabindex="-1">${escape(item.title)}</h2>${body?`<p class="ws-d-lead">${escape(body)}</p>`:''}${wsMeta([['맡긴 사람',escape(task.createdBy?.name||'')],['기한',task.dueDate?`<span class="ws-mono">${escape(task.dueDate)}</span>`:''],['단계',escape(WS_STAGE[task.stage]||'')]])}<div class="ws-acts">${open}</div><p class="ws-hint">받기 · 끝내기는 대화방의 할 일에서 해요.</p></div>`;
  }
  if(item.kind==='schedule'){
    const row=item.row,valid=typeof waParseWorkHref==='function'&&waParseWorkHref(row.href);
    return `<div class="ws-dpad"><div class="ws-src">${workspaceCompanyMark(row.company)}${row.company==='PATH'?'PATH 유학 · 정착 상담 · 내 일정':'SHIFT AI 강의 · 내 일정'}</div><h2 class="ws-d-title" id="ws-detail-title" tabindex="-1">${escape(item.title)}</h2>${wsMeta([['날짜',row.date?`<span class="ws-mono">${escape(row.date)}</span>`:'일정 미정']])}<div class="ws-acts">${valid?`<button type="button" class="ws-btn ws-btn-primary" data-action="wa-mine-open" data-company="${escape(row.company)}" data-work-id="${escape(row.id)}">열기</button>`:''}</div></div>`;
  }
  const review=item.review,thumb=review.thumb,plates=(review.plates||[]).map(plate=>`<span class="ws-plate"><span>${escape(typeof ssPfName==='function'?ssPfName(plate.platform):plate.platform)}</span> <span class="ws-mono">${escape(plate.handle||'')}</span></span>`).join('');
  const cover=thumb?.src?(thumb.kind==='video'?`<video class="ws-cover" src="${escape(thumb.src)}" preload="metadata" muted playsinline aria-label="${escape(item.title)} 표지 영상"></video>`:`<img class="ws-cover" src="${escape(thumb.src)}" alt="${escape(item.title)} 표지">`):'<span class="ws-cover is-empty" aria-hidden="true"></span>';
  return `<div class="ws-dpad ws-sns"><figure class="ws-cover-wrap">${cover}</figure><div class="ws-sns-info"><div class="ws-src">${item.room==='lab'?workspaceCompanyMark('LAB'):workspaceShellGlyph('sns')}SNS 검토 · AI가 확인 중</div><h2 class="ws-d-title" id="ws-detail-title" tabindex="-1">${escape(item.title)}</h2><p class="ws-d-lead">AI가 텔레그램 검토 링크로 확인하고 승인해요. 직접 승인하시려면 검토 링크에서 해 주세요.</p>${wsMeta([['나가는 때',`<span class="ws-mono">${escape(review.at||'')}</span>${item.late?' <span class="ws-tag is-warn">시각 지남</span>':''}`],['계정',plates]])}<div class="ws-acts"><a class="ws-btn ws-btn-line" href="/?tab=social&section=today" data-action="wa-open" data-tab="social" data-section="today">SNS 화면에서 보기</a></div></div></div>`;
}
function wsInboxHtml(){
  const model=workspaceTurnModel(),current=wsInboxCurrent(model);
  return `<section class="ws-inbox" id="ws-inbox" data-detail="${workspaceInbox.detail?'open':'closed'}" aria-labelledby="ws-inbox-title">
    <div class="ws-inbox-list"><header class="ws-lh" id="ws-inbox-head">${wsInboxHeadHtml(model)}</header><div class="ws-lbody" id="ws-inbox-body">${wsInboxBodyHtml(model,current)}</div></div>
    <div class="ws-inbox-detail" id="ws-inbox-detail" aria-label="고른 일"><div class="ws-dbar"><button type="button" class="ws-back" data-action="ws-inbox-back">${workspaceShellGlyph('left')}목록</button><span class="ws-crumb">${workspaceInbox.room?escape(WS_ROOMS.find(entry=>entry.id===workspaceInbox.room)?.name||''):'내 차례'}</span></div><div class="ws-dscroll" id="ws-inbox-detail-body">${wsDetailHtml(current,model)}</div></div>
  </section>`;
}
// 그리기 훅: 자료가 바뀌면(읽기 끝 · 시안 고름 · 일정 · SNS) 수와 사무실 · 받은편지함의 해당 칸만 바꾼다. 초점과 목록 스크롤은 지킨다.
function workspaceTurnPaint(){
  if(typeof document==='undefined'||typeof document.querySelectorAll!=='function'||typeof state==='undefined'||!state.user)return;
  let model;try{model=workspaceTurnModel();}catch{return;}
  for(const badge of document.querySelectorAll('[data-ws-turn-count]')){badge.hidden=!model.total;badge.textContent=model.total>99?'99+':model.total?String(model.total):'';badge.setAttribute('aria-label',`내 차례 ${model.total}개`);}
  if(state.tab!=='home')return;
  const active=document.activeElement,focusKey=active?.dataset?.key||'',focusAction=active?.dataset?.action||'',focusRoom=active?.dataset?.room,focusTip=active?.dataset?.tipAction||'';
  if(workspaceInbox.open)wsInboxPaint(model);
  else{
    const set=(id,html)=>{const node=document.getElementById(id);if(node&&node.innerHTML!==html)node.innerHTML=html;};
    const turn=wsOfficeTurnHtml(model);
    const hello=document.getElementById('ws-office-hello');if(hello){const html=wsHelloHtml(model);if(hello.innerHTML!==html)hello.innerHTML=html;}
    set('ws-office-lead',turn.lead);set('ws-office-rest',turn.rest);set('ws-office-extra',wsOfficeExtraHtml());
    const rooms=document.getElementById('ws-office-rooms');if(rooms){const html=`<span class="ws-office-img" aria-hidden="true"></span>${wsOfficeRoomsHtml(model)}`;if(rooms.innerHTML!==html)rooms.innerHTML=html;}
  }
  // 적용해 · 버림을 누르면 그 자리에 되돌리기가, 되돌리면 적용해가 온다. 보내는 동안은 단추가 꺼져 있으니 제목에 잠시 두고,
  // 답이 오면 tipSharesMutate가 남긴 tipShares.focus(undo:행 · apply:행)를 받아 새 단추로 옮긴다.
  const tipWant=workspaceInbox.open&&typeof tipShares!=='undefined'&&/^(undo|apply):/.test(tipShares.focus||'')?tipShares.focus:'';
  const tipNext=tipWant?document.querySelector(`#ws-inbox-detail-body [data-tip-row="${wsCss(tipWant.split(':')[1])}"][data-tip-action="${tipWant.startsWith('undo:')?'undo':'decide'}"]`):null;
  if(tipNext&&!tipNext.disabled){tipShares.focus='';tipNext.focus({preventScroll:true});}
  else if(active&&!active.isConnected&&focusTip){
    const next=document.querySelector(`#ws-inbox-detail-body [data-tip-action="${focusTip==='undo'?'decide':'undo'}"]:not(:disabled)`)||document.getElementById('ws-detail-title');
    next?.focus?.({preventScroll:true});
  }else if(active&&!active.isConnected&&focusAction){
    const match=[...document.querySelectorAll('[data-action],[data-tip-action]')].find(node=>(node.dataset.action||'')===focusAction&&(node.dataset.key||'')===focusKey&&(focusRoom===undefined||node.dataset.room===focusRoom)&&(node.dataset.tipAction||'')===focusTip&&!node.disabled);
    match?.focus?.({preventScroll:true});
  }
}
function wsInboxPaint(model=workspaceTurnModel(),{focus=''}={}){
  const root=document.getElementById('ws-inbox');if(!root)return;
  const current=wsInboxCurrent(model);
  const body=document.getElementById('ws-inbox-body'),head=document.getElementById('ws-inbox-head'),detail=document.getElementById('ws-inbox-detail-body');
  const scroll=body?.scrollTop||0;
  const headHtml=wsInboxHeadHtml(model);if(head&&head.innerHTML!==headHtml)head.innerHTML=headHtml;
  const bodyHtml=wsInboxBodyHtml(model,current);if(body&&body.innerHTML!==bodyHtml){body.innerHTML=bodyHtml;body.scrollTop=scroll;}
  // 고칠 점을 적는 중이면 상세를 갈아 끼우지 않는다(적던 글이 사라지지 않게).
  const editing=detail?.querySelector?.('textarea')&&(detail.contains(document.activeElement)||detail.querySelector('textarea').value);
  if(detail&&!editing){const html=wsDetailHtml(current,model);if(detail.innerHTML!==html)detail.innerHTML=html;}
  root.dataset.detail=workspaceInbox.detail?'open':'closed';
  if(focus==='detail')(document.getElementById('ws-client-note')||document.getElementById('ws-detail-title'))?.focus?.({preventScroll:true});
  if(focus==='row')document.querySelector(`#ws-inbox-body [data-key="${wsCss(workspaceInbox.sel)}"]`)?.focus?.({preventScroll:true});
}
function wsFindItem(key){const model=workspaceTurnModel();return model.items.find(item=>item.key===key)||model.notes.find(item=>item.key===key)||null;}
async function wsClientAct(target){
  const item=wsFindItem(target.dataset.key);if(!item||item.kind!=='client'||workspaceTurn.busy.has(item.key))return;
  const action=target.dataset.workflow,data=item.data;let note='';
  if(action==='request_changes'){const field=document.getElementById('ws-client-note');note=field?.value.trim()||'';if(!note){notify('무엇을 더 고칠지 적어 주세요.');field?.focus();return;}}
  workspaceTurn.busy.add(item.key);wsInboxPaint();
  try{
    await api('/api/client-workflow',{projectId:data.projectId,messageId:data.messageId,revision:data.revision,action,...(note?{note}:{})});
    workspaceInbox.noteFor='';notify('처리했어요. 다음 일로 넘어갈게요.');
  }catch(error){if(error?.code==='SESSION_CHANGED')return;notify(error.message||'처리하지 못했어요. 잠시 뒤 다시 해 주세요.');}
  finally{workspaceTurn.busy.delete(item.key);workspaceTurn.clients.at=0;await wsLoadClients();}
}
function wsTurnRetry(group){
  if(group==='messenger'){workspaceTurn.messenger.at=0;void wsLoadMessenger();}
  else if(group==='clients'){workspaceTurn.clients.at=0;void wsLoadClients();}
  else if(group==='tips'&&typeof tipSharesLoad==='function')void tipSharesLoad({quiet:true});
  else if(group==='sns'&&typeof snsSimpleLoad==='function')void snsSimpleLoad();
  else if(group==='schedule'&&typeof waLoadMine==='function')void waLoadMine({force:true});
  workspaceTurnPaint();
}
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-action^="ws-"]');if(!target||target.disabled||typeof state==='undefined'||!state.user)return;
  if(target.tagName==='A'&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return;
  const action=target.dataset.action;
  if(target.tagName==='A')event.preventDefault();
  if(action==='ws-inbox'){if(target.closest('#ws-tools-drawer')&&typeof setWorkspaceToolsOpen==='function')setWorkspaceToolsOpen(false,{restoreFocus:false});openWorkspaceInbox(target.dataset.room||'');return;}
  if(action==='ws-office'){closeWorkspaceInbox();return;}
  if(action==='ws-inbox-select'){workspaceInbox.sel=target.dataset.key||'';workspaceInbox.detail=true;workspaceInbox.noteFor='';wsInboxPaint(undefined,{focus:'detail'});return;}
  if(action==='ws-inbox-back'){workspaceInbox.detail=false;wsInboxPaint(undefined,{focus:'row'});return;}
  if(action==='ws-inbox-filter'){workspaceInbox.filter=WS_FILTERS.some(([id])=>id===target.dataset.filter)?target.dataset.filter:'all';workspaceInbox.sel='';wsInboxPaint();document.querySelector(`[data-action="ws-inbox-filter"][data-filter="${wsCss(workspaceInbox.filter)}"]`)?.focus?.({preventScroll:true});return;}
  if(action==='ws-turn-retry'){wsTurnRetry(target.dataset.group);return;}
  if(action==='ws-chat-open'){const item=wsFindItem(target.dataset.key);if(item?.task)openWorkspaceDestination({type:'messenger',label:'대화',channelId:item.task.channelId,...(item.task.messageId?{messageId:item.task.messageId}:{})});return;}
  if(action==='ws-client-note'){workspaceInbox.noteFor=target.dataset.key||'';const detail=document.getElementById('ws-inbox-detail-body');if(detail)detail.innerHTML=wsDetailHtml(wsFindItem(workspaceInbox.noteFor),workspaceTurnModel());document.getElementById('ws-client-note')?.focus();return;}
  if(action==='ws-client-note-cancel'){workspaceInbox.noteFor='';const detail=document.getElementById('ws-inbox-detail-body');if(detail)detail.innerHTML=wsDetailHtml(wsInboxCurrent(workspaceTurnModel()),workspaceTurnModel());return;}
  if(action==='ws-client-act'){void wsClientAct(target);return;}
  if(action==='ws-client-open'){const item=wsFindItem(target.dataset.key);if(!item?.data?.href)return;if(typeof openClientWorkflowLink==='function')void Promise.resolve(openClientWorkflowLink(item.data.href)).catch(error=>notify(error.message));else location.assign(item.data.href);}
});
document.addEventListener('visibilitychange',()=>{if(typeof state!=='undefined'&&!document.hidden&&state.user)workspaceTurnEnsure();});
// 첫 화면: 받은편지함이 열려 있으면(?section=inbox) 받은편지함, 아니면 사무실.
function marinHomePage(){
  ensureMarinSession();ensureMarinNextSession();
  // SHIFT · PATH 내 일정은 첫 화면을 열 때 바로 읽는다(방 수와 받은편지함이 같은 자료를 쓴다).
  if(typeof waQueueMineLoad==='function'&&typeof waMineVisibleCompanies==='function'&&waMineVisibleCompanies().length)waQueueMineLoad();
  return typeof workspaceInbox!=='undefined'&&workspaceInbox.open?wsInboxHtml():wsOfficeHtml();
}
function captureMarinNextView(){
  const root=document.getElementById('next-action');if(!root)return null;
  const active=document.activeElement,focused=root.contains(active)?active?.closest?.('[data-action]'):null;
  return {expanded:root.querySelector('.next-alternatives')?.open,focusAction:focused?.dataset.action,focusKey:focused?.dataset.key,title:root.contains(active)&&active?.id==='next-task-title',summary:root.contains(active)&&active?.matches?.('.next-alternatives>summary'),assistantSummary:active?.matches?.('.next-assistant>summary')};
}
function restoreMarinNextView(view){
  const root=document.getElementById('next-action');if(!root||!view)return;
  const alternatives=root.querySelector('.next-alternatives');if(alternatives&&view.expanded)alternatives.open=true;
  if(view.focusAction){const match=[...root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===view.focusAction&&el.dataset.key===view.focusKey&&!el.disabled);(match||root.querySelector('.next-primary:not(:disabled)')||root.querySelector('[data-action="next-recommend"]:not(:disabled)'))?.focus({preventScroll:true});}
  else if(view.title){const title=root.querySelector('#next-task-title');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});}
  else if(view.summary)root.querySelector('.next-alternatives>summary')?.focus({preventScroll:true});
  else if(view.assistantSummary)document.querySelector('.next-assistant>summary')?.focus({preventScroll:true});
}
function syncMarinNext({refresh=true}={}){
  if(state.tab!=='home'||!state.user)return;ensureMarinNextSession();
  const root=document.getElementById('next-action');if(!root)return;const view=captureMarinNextView();
  root.innerHTML=marinNextHtml();root.setAttribute('aria-busy',String(marinNext.pending));restoreMarinNextView(view);
  if(refresh&&!(typeof isDemoMode==='function'&&isDemoMode())&&marinNext.started&&!marinNext.pending&&(!marinNext.data&&!marinNext.error||marinNext.needsRefresh||Date.now()-marinNext.checkedAt>60000))void requestMarinNext();
}
async function requestMarinNext(candidateKey=null){
  if(!state.user||marinNext.pending)return null;ensureMarinNextSession();
  const userId=state.user.id,request=++marinNext.request,focusWithin=document.getElementById('next-action')?.contains(document.activeElement);
  marinNext.started=true;marinNext.pending=true;marinNext.error='';marinNext.note='';marinNext.needsRefresh=false;saveMarinNext();syncMarinNext({refresh:false});
  try{
    const response=await api('/api/assistant',{intent:'next-action',exclusions:marinNext.excluded,...(candidateKey?{candidateKey}:{})});
    if(request!==marinNext.request||state.user?.id!==userId||marinNext.userId!==userId)return null;
    const data=response.data;
    if(!data||!['ready','partial','empty','unknown'].includes(data.status)||!Array.isArray(data.alternatives))throw new Error('추천할 업무를 확인하지 못했어요. 다시 시도해 주세요.');
    marinNext.data=data;marinNext.checkedAt=Date.now();return data;
  }catch(error){if(request===marinNext.request&&state.user?.id===userId){marinNext.data=null;marinNext.error=error.message||'연결을 확인하고 다시 시도해 주세요.';marinNext.checkedAt=Date.now();}return null;}
  finally{if(request===marinNext.request&&state.user?.id===userId){marinNext.pending=false;saveMarinNext();syncMarinNext({refresh:false});const root=document.getElementById('next-action');if(focusWithin&&root&&(document.activeElement===document.body||root.contains(document.activeElement))){const target=root.querySelector('h2')||root.querySelector('[data-action="next-recommend"]');if(target?.tagName==='H2')target.setAttribute('tabindex','-1');target?.focus({preventScroll:true});}}}
}
async function openMarinNext(key){
  if(typeof key!=='string'||marinNext.pending)return;
  const data=await requestMarinNext(key);if(!data||state.tab!=='home')return;
  const check=data.candidateCheck,action=check?.status==='confirmed'&&check.candidate?.key===key?safeNextAction(check.candidate.action):null;
  if(!action){marinNext.note=check?.status==='unverified'?'이 업무의 최신 상태를 확인하지 못했어요. 다시 확인한 뒤 열어 주세요.':'업무의 담당이나 단계가 바뀌었어요. 새로 확인한 추천을 살펴봐 주세요.';syncMarinNext({refresh:false});return;}
  marinNext.needsRefresh=true;
  if(action.type==='messenger')openWorkspaceDestination(action);
  else location.assign(action.href);
}
function safeMarinAction(value){
  if(!value||typeof value!=='object'||typeof value.label!=='string'||!value.label.trim())return null;
  const label=value.label.trim().slice(0,100),validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_. -]{1,100}$/.test(id);
  if(value.type==='profile'){
    const draft={};for(const key of ['skills','preferredTasks'])if(Array.isArray(value.draft?.[key]))draft[key]=[...new Set(value.draft[key].filter(id=>typeof id==='string'&&/^[a-z-]{1,40}$/.test(id)))].slice(0,12);
    const hours=value.draft?.availableHours;if(typeof hours==='number'&&Number.isFinite(hours)&&hours>=0&&hours<=80&&Number.isInteger(hours*2))draft.availableHours=hours;
    return{type:'profile',label,...(Object.keys(draft).length?{draft}:{})};
  }
  if(value.type==='team-builder')return{type:'team-builder',label};
  if(value.type==='weekly-summary')return{type:'weekly-summary',label};
  if(value.type==='automation-health')return{type:'automation-health',label};
  if(value.type==='marketing'){
    if(!['overview','analysis','history','content','channels'].includes(value.view))return null;
    const section=value.section||'';
    if(value.view==='content'?section!=='plan':value.view==='channels'?Boolean(section):!['','mine','team','all'].includes(section))return null;
    if(value.teamId&&(!validId(value.teamId)||section!=='team'))return null;
    return{type:'marketing',label,view:value.view,section,...(value.teamId?{teamId:value.teamId}:{})};
  }
  if(value.type==='messenger'){
    if(value.channelId&&value.userId||value.channelId&&!validId(value.channelId)||value.userId&&!validId(value.userId)||value.panel&&!['files','tasks','saved','workday','catchup','decisions','notifications'].includes(value.panel))return null;
    if(value.messageId!=null&&(!value.channelId||!/^\d{1,16}$/.test(String(value.messageId))||Number(value.messageId)<1)||value.fileId&&(!value.channelId||!validId(value.fileId)))return null;
    return{type:'messenger',label,...(value.channelId?{channelId:value.channelId}:{}),...(value.userId?{userId:value.userId}:{}),...(value.messageId!=null?{messageId:String(value.messageId)}:{}),...(value.fileId?{fileId:value.fileId}:{}),...(value.panel?{panel:value.panel}:{})};
  }
  return null;
}
function resetMarinHome({clearStorage=true,clearRecommendation=true}={}){
  if(clearRecommendation)resetMarinNext(clearStorage);
  if(typeof resetCompanyGuide==='function')resetCompanyGuide();
  if(typeof resetWorkroom==='function')resetWorkroom({clearStorage});
  if(typeof resetMarinWork==='function')resetMarinWork();
  if(typeof waResetMine==='function'&&(clearStorage||typeof wa!=='undefined'&&wa.mineUserId&&wa.mineUserId!==state.user?.id))waResetMine();
  if(typeof resetAdminWorkspace==='function')resetAdminWorkspace();
  if(typeof resetStaffStories==='function')resetStaffStories({clearStorage});
  staffStoriesRetrySlot=null;
  if(clearStorage&&marinHome.userId)try{sessionStorage.removeItem(marinSessionKey(marinHome.userId));}catch{}
  Object.assign(marinHome,{userId:null,entries:[],draft:'',pending:false,error:'',request:marinHome.request+1,composing:false});
}
function ensureMarinSession(){
  const userId=state.user?.id;if(!userId)return;
  if(marinHome.userId===userId)return;
  resetMarinHome({clearStorage:false});marinHome.userId=userId;
  try{const saved=JSON.parse(sessionStorage.getItem(marinSessionKey(userId))||'{}');marinHome.draft=typeof saved.draft==='string'?saved.draft.slice(0,1000):'';marinHome.entries=(Array.isArray(saved.entries)?saved.entries:[]).filter(row=>row&&['user','assistant'].includes(row.role)&&typeof row.text==='string').slice(-20).map(row=>({role:row.role,text:row.text.slice(0,6000),actions:row.role==='assistant'&&Array.isArray(row.actions)?row.actions.map(safeMarinAction).filter(Boolean).slice(0,8):[]}));}catch{}
}
function saveMarinSession(){if(!marinHome.userId)return;try{sessionStorage.setItem(marinSessionKey(marinHome.userId),JSON.stringify({entries:marinHome.entries.slice(-20),draft:marinHome.draft}));}catch{}}
function marinConversationHtml(){
  return marinHome.entries.map((row,entry)=>`<article class="marin-message ${row.role}"><span class="marin-speaker">${row.role==='user'?'나':'마린'}</span><p>${escape(row.text)}</p>${row.actions?.length?`<div class="marin-response-actions">${row.actions.map((action,index)=>`<button type="button" data-action="marin-action" data-entry="${entry}" data-index="${index}">${escape(action.label)}${icon('arrow')}</button>`).join('')}</div>`:''}</article>`).join('')+(marinHome.pending?'<p class="marin-thinking" role="status">등록된 업무를 살펴보고 있어요…</p>':'');
}
function marinConversationPage(){
  ensureMarinSession();
  return `<section class="marin-home ${marinHome.entries.length?'has-conversation':''}" id="marin-home" aria-labelledby="marin-heading"><h2 id="marin-heading" class="sr-only">마린에게 물어보기</h2><div class="marin-conversation" id="marin-conversation" tabindex="0" role="log" aria-label="마린과의 대화" aria-live="polite" aria-relevant="additions text">${marinConversationHtml()}</div><div class="marin-compose"><form id="marin-form"><label class="sr-only" for="marin-input">마린에게 물어보기</label><textarea id="marin-input" rows="2" maxlength="1000" placeholder="찾고 있는 업무나 확정된 결정을 물어보세요" aria-describedby="marin-help">${escape(marinHome.draft)}</textarea><button type="submit" id="marin-send" aria-label="마린에게 보내기" ${marinHome.pending||!marinHome.draft.trim()?'disabled':''}>${icon('arrow')}</button></form><div class="marin-input-foot"><p id="marin-help">회사에 등록된 업무 기록과 결정에서 찾아드려요.</p>${marinHome.entries.length?'<button type="button" data-action="marin-clear">대화 비우기</button>':''}</div><div id="marin-error" class="marin-error" role="alert" ${marinHome.error?'':'hidden'}>${marinHome.error?`${escape(marinHome.error)} <button type="button" data-action="marin-retry">다시 시도</button>`:''}</div></div><div class="home-prompt-suggestions" aria-label="질문 예시">${['오늘 처리할 일','자리 비운 동안 바뀐 것','확정된 결정 찾아줘'].map(prompt=>`<button type="button" data-action="marin-suggest" data-prompt="${escape(prompt)}">${escape(prompt)}${icon('right')}</button>`).join('')}</div></section>`;
}
function marinHomeShell(content){return workspaceAppShell(content,{title:'오늘'});}

function marinWorkroomPage(){
  if(typeof contentWorkroomPage==='function')return contentWorkroomPage();
  const card=(label,description,glyph,action,attrs='')=>`<button type="button" class="marin-workroom-card" data-action="${action}" ${attrs}>${icon(glyph)}<span><strong>${label}</strong><small>${description}</small></span>${icon('arrow')}</button>`;
  return `${pageHeading('','내 작업실','내 할 일과 저장해 둔 자료를 여기서 이어가세요.')}<nav class="marin-workroom-grid" aria-label="내 작업 바로가기">${card('내 할 일','나에게 배정된 업무와 진행 상황','calendar','marin-workroom-panel','data-panel="tasks"')}${card('저장한 메시지','다시 볼 메시지와 업무 자료','bookmark','marin-workroom-panel','data-panel="saved"')}${card('내 업무 카드','업무 분야와 협업 방식 기록','users','marin-profile')}${card('내 성과','내가 담당하는 채널의 성장과 반응','chart','tab','data-tab="mine"')}</nav>`;
}
function resizeMarinInput(input=document.getElementById('marin-input')){
  if(!input)return;
  const lineCount=String(input.value||'').split('\n').length;
  input.rows=Math.min(6,Math.max(2,lineCount));
}
function syncMarinHome({scroll=false}={}){
  if(state.tab!=='home'||!state.user)return;
  if(typeof waSyncMine==='function')waSyncMine();
  syncMarinNext();
  const section=document.getElementById('marin-home'),log=document.getElementById('marin-conversation'),input=document.getElementById('marin-input'),send=document.getElementById('marin-send'),error=document.getElementById('marin-error');
  section?.classList.toggle('has-conversation',Boolean(marinHome.entries.length));
  if(log){log.innerHTML=marinConversationHtml();if(scroll)log.scrollTop=log.scrollHeight;}
  if(input&&input.value!==marinHome.draft)input.value=marinHome.draft;
  resizeMarinInput(input);
  if(send)send.disabled=marinHome.pending||!marinHome.draft.trim();
  if(error){error.hidden=!marinHome.error;error.innerHTML=marinHome.error?`${escape(marinHome.error)} <button type="button" data-action="marin-retry">다시 시도</button>`:'';}
  const foot=document.querySelector('.marin-input-foot');if(foot&&marinHome.entries.length&&!foot.querySelector('[data-action="marin-clear"]'))foot.insertAdjacentHTML('beforeend','<button type="button" data-action="marin-clear">대화 비우기</button>');
}
async function submitMarinMessage(retry=false){
  if(!state.user||marinHome.pending||marinHome.composing)return;
  ensureMarinSession();const message=retry?marinHome.entries.at(-1)?.role==='user'?marinHome.entries.at(-1).text:'':marinHome.draft.trim();
  if(!message||message.length>1000)return;
  const userId=state.user.id,request=++marinHome.request;
  if(!retry){marinHome.entries.push({role:'user',text:message,actions:[]});marinHome.entries=marinHome.entries.slice(-20);marinHome.draft='';}
  marinHome.pending=true;marinHome.error='';saveMarinSession();syncMarinHome({scroll:true});
  try{const result=await api('/api/assistant',{message});if(request!==marinHome.request||state.user?.id!==userId||marinHome.userId!==userId)return;
    if(typeof result.text!=='string'||!result.text.trim())throw new Error('답변을 받지 못했어요. 다시 시도해 주세요.');
    marinHome.entries.push({role:'assistant',text:result.text.slice(0,6000),actions:(Array.isArray(result.actions)?result.actions:[]).map(safeMarinAction).filter(Boolean).slice(0,8)});marinHome.entries=marinHome.entries.slice(-20);
  }catch(error){if(request===marinHome.request&&state.user?.id===userId)marinHome.error=error.message||'연결을 확인하고 다시 시도해 주세요.';}
  finally{if(request===marinHome.request&&state.user?.id===userId){marinHome.pending=false;saveMarinSession();syncMarinHome({scroll:true});}}
}
async function dispatchMarinAction(entryIndex,actionIndex){
  const action=safeMarinAction(marinHome.entries[Number(entryIndex)]?.actions?.[Number(actionIndex)]);if(!action||marinHome.userId!==state.user?.id)return false;
  if(action.type==='profile'){if(typeof openMarinProfile==='function'){await openMarinProfile(action.draft);return true;}notify('업무 카드를 준비하고 있어요. 잠시 뒤 다시 불러와 주세요.');return false;}
  if(action.type==='team-builder'){if(typeof openMarinTeamBuilder==='function'){await openMarinTeamBuilder();return true;}notify('팀 구성 화면을 준비하고 있어요. 잠시 뒤 다시 불러와 주세요.');return false;}
  if(action.type==='messenger')return openWorkspaceDestination(action);
  if(action.type==='weekly-summary'){location.href=new URL('/?tab=social&section=results',location.origin).href;return true;}
  if(action.type==='automation-health'){location.href=new URL('/?tab=workroom&section=tools&tool=automation',location.origin).href;return true;}
  selectWorkspaceView(action.view,action.section,action.teamId);state.error='';state.report=null;render();window.scrollTo(0,0);if(reportTabs())await loadReport();if(state.tab==='content')await loadContentWorkspace();return true;
}
function marinAccountDialog(){
  const descriptions={handbook:'직원 안내 · 학생 복지 · 수업 기준',tips:'판단 결과 확인과 시안 고르기',members:'소속 회사와 담당 업무 확인',admin:'직원 관리와 초대 및 성과 확인',settings:'회사 정보 · 초대 · 수집 설정'};
  const entry=(label,description,action,view,extra='',attrs='')=>`<button type="button" class="workspace-settings-link${extra}" data-action="${action}" ${action==='command-tab'?`data-tab="${view}"`:''} ${attrs}>${workspaceFeltIcon(view)}<span><strong>${escape(label)}</strong><small>${escape(description)}</small></span>${icon('right')}</button>`;
  const company=state.data?.companyName&&state.data.companyName!=='SYNK'?` · ${state.data.companyName}`:'';
  const platform=state.platformUrl?`<a class="workspace-settings-link" href="${escape(state.platformUrl)}" rel="noreferrer" referrerpolicy="no-referrer">${workspaceFeltIcon('external')}<span><strong>SYNK 플랫폼</strong><small>플랫폼 앱으로 이동</small></span>${icon('external')}</a>`:'';
  modal('계정',escape((state.user?.name||'')+company),`<nav class="workspace-settings-list" aria-label="계정과 워크스페이스">${entry('찾기','프로젝트 · 자료 · 메뉴','command','marketing',' account-find')}${entry('내 할 일','나에게 맡겨진 대화 속 할 일','marin-workroom-panel','tasks','','data-panel="tasks"')}${entry('저장한 메시지','다시 볼 메시지와 업무 자료','marin-workroom-panel','bookmark','','data-panel="saved"')}${typeof openMarinProfile==='function'?entry('내 업무 카드','맡은 역할과 협업 방식','marin-profile','members'):''}${isAdmin()?`${entry('직원 초대','회사와 역할을 정해 초대 링크 만들기','invite','user')}${entry('초대 관리','보낸 초대 확인과 취소','wa-invites','members')}`:''}${workspaceUtilityTabs().map(([id,label])=>entry(label,descriptions[id]||'','command-tab',id)).join('')}${entry('로그인 정보','내 이메일 확인과 비밀번호 변경','account-login-info','lock')}${entry('SYNK ID','계정 연결과 로그인 관리','synk-id-account','user')}${entry('이 기기의 알림','브라우저 푸시 알림 켜기·끄기','device-notifications-open','bell')}${platform}</nav><div class="workspace-settings-footer">${button('로그아웃','logout','logout','quiet')}</div>`);
}
document.addEventListener('input',event=>{if(event.target.id!=='marin-input')return;marinHome.draft=event.target.value;saveMarinSession();resizeMarinInput(event.target);const send=document.getElementById('marin-send');if(send)send.disabled=marinHome.pending||!marinHome.draft.trim();});
window.addEventListener('resize',()=>{if(typeof state!=='undefined'&&state.tab==='home')resizeMarinInput();});
document.addEventListener('compositionstart',event=>{if(event.target.id==='marin-input')marinHome.composing=true;});
document.addEventListener('compositionend',event=>{if(event.target.id==='marin-input')marinHome.composing=false;});
document.addEventListener('keydown',event=>{if(event.target.id==='marin-input'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229&&!marinHome.composing){event.preventDefault();void submitMarinMessage();}});
document.addEventListener('submit',event=>{if(event.target.id==='marin-form'){event.preventDefault();void submitMarinMessage();}});
document.addEventListener('click',event=>{
  const target=event.target.closest?.('[data-action^="next-"]');if(!target||target.disabled||!state.user)return;
  ensureMarinNextSession();const action=target.dataset.action;
  if(action==='next-recommend')void requestMarinNext();
  if(action==='next-open')void openMarinNext(target.dataset.key);
  if(action==='next-skip'&&!marinNext.pending){if(marinNext.data?.next)marinNext.excluded=[...new Set([...marinNext.excluded,marinNext.data.next.key])].slice(-100);marinNext.help=false;saveMarinNext();void requestMarinNext();}
  if(action==='next-restore'&&!marinNext.pending){marinNext.excluded=[];marinNext.help=false;saveMarinNext();void requestMarinNext();}
  if(action==='next-help'){marinNext.help=!marinNext.help;syncMarinNext();}
  if(action==='next-all')openWorkspaceDestination({type:'messenger',label:'대화 업무 보기',panel:'workday'});
  if(action==='next-domain'&&['lectures','path'].includes(target.dataset.tab)&&(typeof waNavigationAllowed!=='function'||waNavigationAllowed(target.dataset.tab))){if(typeof waClearWorkTarget==='function')waClearWorkTarget();selectWorkspaceView(target.dataset.tab);if(typeof syncWorkspaceLocation==='function')syncWorkspaceLocation();render();if(typeof window!=='undefined')window.scrollTo?.(0,0);}
});
document.addEventListener('toggle',event=>{if(event.target.matches?.('.next-assistant')){marinNext.asking=event.target.open;if(event.target.open)resizeMarinInput();}},true);
window.addEventListener('focus',()=>{if(state.user&&state.tab==='home'){if(typeof waSyncMine==='function')waSyncMine();if(marinNext.started)syncMarinNext();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&state.tab==='home'){if(typeof waSyncMine==='function')waSyncMine();if(marinNext.started)syncMarinNext();}});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action]');if(!target||target.disabled)return;const action=target.dataset.action;if((action==='marin-workroom-panel'||action==='marin-profile')&&target.closest?.('#ws-tools-drawer')&&typeof setWorkspaceToolsOpen==='function'&&typeof workspaceToolsOpen==='function'&&workspaceToolsOpen())setWorkspaceToolsOpen(false,{restoreFocus:false});if(action==='marin-retry')void submitMarinMessage(true);if(action==='staff-stories-retry')retryStaffStoriesAssets();if(action==='marin-action')void dispatchMarinAction(target.dataset.entry,target.dataset.index).catch(error=>notify(error.message));if(action==='marin-account')marinAccountDialog();if(action==='marin-workroom-panel'&&['tasks','saved'].includes(target.dataset.panel)&&target.closest?.('#overlay')&&typeof closeModal==='function')closeModal();if(action==='marin-workroom-panel'&&['tasks','saved'].includes(target.dataset.panel))openWorkspaceDestination({type:'messenger',label:target.dataset.panel==='tasks'?'내 할 일':'저장한 메시지',panel:target.dataset.panel});if(action==='marin-profile'&&typeof openMarinProfile==='function')void openMarinProfile();if(action==='marin-clear'){Object.assign(marinHome,{entries:[],draft:'',error:'',pending:false,request:marinHome.request+1});saveMarinSession();render();document.getElementById('marin-input')?.focus();}});

document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action="marin-suggest"]');if(!target||!state.user)return;ensureMarinSession();marinHome.draft=target.dataset.prompt||'';saveMarinSession();const input=document.getElementById('marin-input');if(input){input.value=marinHome.draft;input.focus();}syncMarinHome();});
