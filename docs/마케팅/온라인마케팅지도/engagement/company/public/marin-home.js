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
function safeNextAction(value){
  if(value?.type==='messenger')return safeMarinAction(value);
  if(value?.type!=='workspace'||typeof value.label!=='string'||!value.label.trim()||typeof value.href!=='string'||!value.href.startsWith('/?')||/[\\\u0000-\u0020]/.test(value.href))return null;
  try{
    const url=new URL(value.href,location.origin),q=url.searchParams;
    if(url.origin!==location.origin||url.pathname!=='/'||url.hash)return null;
    const valid=q.get('tab')==='workroom'&&(q.get('section')==='clients'&&q.has('project')||q.get('section')==='tools'&&q.get('tool')==='publication')||q.get('tab')==='social'&&['today','fix'].includes(q.get('section'));
    return valid?{type:'workspace',label:value.label.trim().slice(0,100),href:url.pathname+url.search}:null;
  }catch{return null;}
}
function nextActionButton(label,action,extra='',primary=false){return `<button type="button" class="next-button${primary?' next-primary':''}" data-action="${action}" ${extra} ${marinNext.pending?'disabled':''}>${escape(label)}${primary?icon('arrow'):''}</button>`;}
function nextDueText(due){if(!due)return '';const value=due.precision==='instant'&&Number.isFinite(Date.parse(due.value))?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(due.value))+' (한국 시간)':due.value;return [due.label,value].filter(Boolean).join(' · ');}
function nextActionCard(row){
  const action=safeNextAction(row.action),source={messenger:'대화 업무',client:'고객 업무',publication:'게시 · SNS'}[row.source]||'내 업무';
  return `<article class="next-card" aria-labelledby="next-task-title"><div class="next-meta"><span>${escape(source)}</span>${row.due?`<span class="next-due">${escape(nextDueText(row.due))}</span>`:''}</div><h2 id="next-task-title">${escape(row.title)}</h2>${row.context?`<p class="next-context">${escape(row.context)}</p>`:''}<div class="next-reasons"><h3>이 일을 추천하는 이유</h3>${(row.reasons||[]).map(reason=>`<p>${escape(reason.text)}</p>`).join('')}</div>${row.checks?.length?`<div class="next-checks"><h3>열어서 확인할 것</h3><ul>${row.checks.map(check=>`<li>${escape(check)}</li>`).join('')}</ul></div>`:''}<div class="next-actions">${action?nextActionButton(action.label,'next-open',`data-key="${escape(row.key)}"`,true):'<p>원본 연결을 확인하지 못했어요.</p>'}${nextActionButton('다른 일 보기','next-skip')}${nextActionButton('도움받기','next-help',`aria-expanded="${marinNext.help}" aria-controls="next-help"`)}</div>${marinNext.help?`<div id="next-help" class="next-help"><p>막힌 부분과 필요한 자료를 원본에서 확인하고, 담당 크루에게 알려주세요. 기존 대화와 검토 흐름에서 함께 해결할 수 있어요.</p>${action?nextActionButton('원본에서 함께 확인하기','next-open',`data-key="${escape(row.key)}"`):''}</div>`:''}</article>`;
}
function marinNextHtml(){
  const data=marinNext.data;
  if(!marinNext.started)return `<div class="next-start">${nextActionButton('다음 할 일 추천','next-recommend','',true)}<p>마감과 내 차례를 살펴, 지금 할 수 있는 일부터.</p></div>`;
  let html=marinNext.pending?'<p class="next-status" role="status">현재 업무를 확인하고 있어요…</p>':'';
  if(marinNext.error)html+=`<p class="next-warning" role="alert">${escape(marinNext.error)}</p>`;
  if(marinNext.note)html+=`<p class="next-status" role="status">${escape(marinNext.note)}</p>`;
  if(data?.status==='partial'||data?.status==='unknown'){
    const missing=Object.entries(data.coverage||{}).filter(([,value])=>value?.status!=='ok').map(([key])=>({messenger:'대화 업무',client:'고객 업무',publication:'게시 · SNS'}[key]||key));
    html+=`<p class="next-warning">${data.status==='partial'?'일부 업무를 확인하지 못했어요. 확인된 범위에서 추천해요.':'업무를 불러오지 못했어요. 잠시 뒤 다시 확인해 주세요.'}${missing.length?` <span>미확인: ${escape(missing.join(', '))}</span>`:''}</p>`;
  }
  if(data?.next)html+=nextActionCard(data.next);
  else if(data&&data.status!=='unknown'&&!marinNext.pending){
    const skipped=data.totalCount>0&&data.excludedCount===data.totalCount;
    html+=`<div class="next-empty"><h2>${skipped?'지금 보여 드릴 추천을 모두 봤어요':data.status==='empty'?'확인한 업무에 지금 내 차례인 일이 없어요':'확인된 범위에 추천할 일이 없어요'}</h2><p>${skipped?'넘긴 업무는 그대로 남아 있어요. 다시 보거나 전체 목록에서 골라 주세요.':'대화 업무, 고객 업무, 게시·SNS에서 확인해요. 다른 크루를 기다리는 일은 추천에서 빼 두었어요.'}</p></div>`;
  }
  if(data?.unavailableCount)html+=`<p class="next-warning">담당·검토 크루를 확인해야 하는 업무 ${escape(String(data.unavailableCount))}개가 있어요. 전체 업무에서 확인해 주세요.</p>`;
  if(data?.alternatives?.length)html+=`<details class="next-alternatives"><summary>다음 후보 ${escape(String(data.alternatives.length))}개 보기</summary><ul>${data.alternatives.map(row=>`<li><button type="button" data-action="next-open" data-key="${escape(row.key)}" ${marinNext.pending?'disabled':''}><span><strong>${escape(row.title)}</strong><small>${escape(nextDueText(row.due)||row.reasons?.[0]?.text||'원본에서 확인')}</small></span>${icon('arrow')}</button></li>`).join('')}</ul></details>`;
  html+=`<div class="next-footer">${nextActionButton('새로 확인','next-recommend')}${marinNext.excluded.length?nextActionButton('넘긴 추천 다시 보기','next-restore'):''}${nextActionButton('전체 업무 보기','next-all')}</div>`;
  if(data?.generatedAt&&Number.isFinite(Date.parse(data.generatedAt)))html+=`<p class="next-asof">${escape(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit'}).format(new Date(data.generatedAt)))} 확인 · 처리와 완료는 원본에서 직접 해요.</p>`;
  return html;
}
function marinHomePage(){
  ensureMarinSession();ensureMarinNextSession();
  return `${waHome()}<section class="next-home" aria-labelledby="next-heading"><header class="next-heading"><p>오늘의 업무</p><h1 id="next-heading">지금, 무엇부터 할까요?</h1><p>내 차례인 일에서 다음 행동을 골라드려요.</p></header><div id="next-action" aria-busy="${marinNext.pending}">${marinNextHtml()}</div><details class="next-assistant" ${marinNext.asking?'open':''}><summary>마린에게 직접 묻기</summary>${marinConversationPage()}</details></section>`;
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
  if(refresh&&marinNext.started&&!marinNext.pending&&(!marinNext.data&&!marinNext.error||marinNext.needsRefresh||Date.now()-marinNext.checkedAt>60000))void requestMarinNext();
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
  return `<section class="marin-home ${marinHome.entries.length?'has-conversation':''}" id="marin-home" aria-labelledby="marin-heading"><h2 id="marin-heading" class="sr-only">마린에게 물어보기</h2><div class="marin-conversation" id="marin-conversation" tabindex="0" role="log" aria-label="마린과의 대화" aria-live="polite" aria-relevant="additions text">${marinConversationHtml()}</div><div class="marin-compose"><form id="marin-form"><label class="sr-only" for="marin-input">마린에게 물어보기</label><textarea id="marin-input" rows="2" maxlength="1000" placeholder="어떤 업무를 찾고 있나요?" aria-describedby="marin-help">${escape(marinHome.draft)}</textarea><button type="submit" id="marin-send" aria-label="마린에게 보내기" ${marinHome.pending||!marinHome.draft.trim()?'disabled':''}>${icon('arrow')}</button></form><div class="marin-input-foot"><p id="marin-help">회사에 등록된 업무에서 찾아드려요.</p>${marinHome.entries.length?'<button type="button" data-action="marin-clear">대화 비우기</button>':''}</div><div id="marin-error" class="marin-error" role="alert" ${marinHome.error?'':'hidden'}>${marinHome.error?`${escape(marinHome.error)} <button type="button" data-action="marin-retry">다시 시도</button>`:''}</div></div><div class="home-prompt-suggestions" aria-label="질문 예시">${['오늘 처리할 일','자리 비운 동안 바뀐 것','확정된 결정 찾아줘'].map(prompt=>`<button type="button" data-action="marin-suggest" data-prompt="${escape(prompt)}">${escape(prompt)}${icon('right')}</button>`).join('')}</div></section>`;
}
function marinHomeShell(content){return workspaceAppShell(content,{title:'홈'});}

function marinWorkroomPage(){
  if(typeof contentWorkroomPage==='function')return contentWorkroomPage();
  const card=(label,description,glyph,action,attrs='')=>`<button type="button" class="marin-workroom-card" data-action="${action}" ${attrs}>${icon(glyph)}<span><strong>${label}</strong><small>${description}</small></span>${icon('arrow')}</button>`;
  return `${pageHeading('','내 작업실','내 할 일과 저장해 둔 자료를 여기서 이어가세요.')}<nav class="marin-workroom-grid" aria-label="내 작업 바로가기">${card('내 할 일','나에게 배정된 업무와 진행 상황','calendar','marin-workroom-panel','data-panel="tasks"')}${card('저장한 메시지','다시 볼 메시지와 업무 자료','bookmark','marin-workroom-panel','data-panel="saved"')}${card('내 업무 카드','업무 분야와 협업 방식 기록','users','marin-profile')}${card('내 성과','내가 담당하는 채널의 성장과 반응','chart','tab','data-tab="mine"')}</nav>`;
}
function resizeMarinInput(input=document.getElementById('marin-input')){
  if(!input)return;
  input.style.height='auto';const height=input.scrollHeight;
  input.style.height=`${Math.min(144,Math.max(27,height))}px`;
  input.style.overflowY=height>144?'auto':'hidden';
}
function syncMarinHome({scroll=false}={}){
  if(state.tab!=='home'||!state.user)return;
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
  // 레일 계정(11-06 새 판): 위 막대가 빠지며 플랫폼 링크 · 회사 이름 · 내 업무 카드가 이 메뉴로 왔다. 찾기는 휴대폰 아래 막대에 없어서 여기에도 둔다(넓은 화면은 레일에 있다).
  const descriptions={handbook:'직원 안내 · 학생 복지 · 수업 · 상담',members:'크루와 팀 관리',settings:'회사 정보와 수집 설정'};
  const entry=(label,description,action,view,extra='')=>`<button type="button" class="workspace-settings-link${extra}" data-action="${action}" ${action==='command-tab'?`data-tab="${view}"`:''}>${workspaceFeltIcon(view)}<span><strong>${escape(label)}</strong><small>${escape(description)}</small></span>${icon('right')}</button>`;
  const company=state.data?.companyName&&state.data.companyName!=='SYNK'?` · ${state.data.companyName}`:'';
  const platform=state.platformUrl?`<a class="workspace-settings-link" href="${escape(state.platformUrl)}" rel="noreferrer" referrerpolicy="no-referrer">${workspaceFeltIcon('marketing')}<span><strong>SYNK 플랫폼</strong><small>플랫폼 앱으로 이동</small></span>${icon('external')}</a>`:'';
  modal('계정',escape((state.user?.name||'')+company),`<nav class="workspace-settings-list" aria-label="계정과 워크스페이스">${entry('찾기','프로젝트 · 자료 · 메뉴','command','marketing',' account-find')}${typeof openMarinProfile==='function'?entry('내 업무 카드','맡은 일과 소개','marin-profile','members'):''}${workspaceUtilityTabs().map(([id,label])=>entry(id==='settings'?'워크스페이스 관리':label,descriptions[id],'command-tab',id)).join('')}${entry('로그인 정보','내 아이디 확인과 비밀번호','account-login-info','settings')}${entry('SYNK ID','계정 연결과 로그인 관리','synk-id-account','settings')}${platform}</nav><div class="workspace-settings-footer">${button('로그아웃','logout','logout','quiet')}</div>`);
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
  if(action==='next-all')openWorkspaceDestination({type:'messenger',label:'전체 업무 보기',panel:'workday'});
});
document.addEventListener('toggle',event=>{if(event.target.matches?.('.next-assistant')){marinNext.asking=event.target.open;if(event.target.open)resizeMarinInput();}},true);
window.addEventListener('focus',()=>{if(state.user&&state.tab==='home'&&marinNext.started)syncMarinNext();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&state.tab==='home'&&marinNext.started)syncMarinNext();});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action]');if(!target||target.disabled)return;const action=target.dataset.action;if(action==='marin-retry')void submitMarinMessage(true);if(action==='marin-action')void dispatchMarinAction(target.dataset.entry,target.dataset.index).catch(error=>notify(error.message));if(action==='marin-account')marinAccountDialog();if(action==='marin-workroom-panel'&&['tasks','saved'].includes(target.dataset.panel))openWorkspaceDestination({type:'messenger',label:target.dataset.panel==='tasks'?'내 할 일':'저장한 메시지',panel:target.dataset.panel});if(action==='marin-profile'&&typeof openMarinProfile==='function')void openMarinProfile();if(action==='marin-clear'){Object.assign(marinHome,{entries:[],draft:'',error:'',pending:false,request:marinHome.request+1});saveMarinSession();render();document.getElementById('marin-input')?.focus();}});

document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action="marin-suggest"]');if(!target||!state.user)return;ensureMarinSession();marinHome.draft=target.dataset.prompt||'';saveMarinSession();const input=document.getElementById('marin-input');if(input){input.value=marinHome.draft;input.focus();}syncMarinHome();});
