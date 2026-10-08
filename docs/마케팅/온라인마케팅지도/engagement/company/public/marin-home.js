'use strict';

const marinHome={userId:null,entries:[],draft:'',pending:false,error:'',request:0,composing:false};
const marinSessionKey=userId=>`synk-marin:session:${userId}`;
function safeMarinAction(value){
  if(!value||typeof value!=='object'||typeof value.label!=='string'||!value.label.trim())return null;
  const label=value.label.trim().slice(0,100),validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_. -]{1,100}$/.test(id);
  if(value.type==='profile'){
    const draft={};for(const key of ['skills','preferredTasks'])if(Array.isArray(value.draft?.[key]))draft[key]=[...new Set(value.draft[key].filter(id=>typeof id==='string'&&/^[a-z-]{1,40}$/.test(id)))].slice(0,12);
    const hours=value.draft?.availableHours;if(typeof hours==='number'&&Number.isFinite(hours)&&hours>=0&&hours<=80&&Number.isInteger(hours*2))draft.availableHours=hours;
    return{type:'profile',label,...(Object.keys(draft).length?{draft}:{})};
  }
  if(value.type==='team-builder')return{type:'team-builder',label};
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
function resetMarinHome({clearStorage=true}={}){
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
function marinHomePage(){
  ensureMarinSession();
  return `<section class="marin-home ${marinHome.entries.length?'has-conversation':''}" id="marin-home" aria-labelledby="marin-heading"><header class="marin-welcome"><img class="marin-mascot" src="/messenger/assets/marin-smile.webp" alt="마린" width="86" height="112"><div><span>업무 도우미</span><h1 id="marin-heading">마린에게 물어보세요</h1><p>오늘 처리할 일과 확정된 결정, 놓친 변경을 확인하세요.</p></div></header><div class="marin-conversation" id="marin-conversation" tabindex="0" role="log" aria-label="마린과의 대화" aria-live="polite" aria-relevant="additions text">${marinConversationHtml()}</div><div class="marin-compose"><form id="marin-form"><label class="sr-only" for="marin-input">마린에게 물어보기</label><textarea id="marin-input" rows="2" maxlength="1000" placeholder="어떤 업무를 찾고 있나요?" aria-describedby="marin-help">${escape(marinHome.draft)}</textarea><button type="submit" id="marin-send" aria-label="마린에게 보내기" ${marinHome.pending||!marinHome.draft.trim()?'disabled':''}>${icon('arrow')}</button></form><div class="marin-input-foot"><p id="marin-help">회사에 등록된 업무에서 찾아드려요.</p>${marinHome.entries.length?'<button type="button" data-action="marin-clear">대화 비우기</button>':''}</div><div id="marin-error" class="marin-error" role="alert" ${marinHome.error?'':'hidden'}>${marinHome.error?`${escape(marinHome.error)} <button type="button" data-action="marin-retry">다시 시도</button>`:''}</div></div><div class="home-prompt-suggestions" aria-label="질문 예시">${['오늘 처리할 일','자리 비운 동안 바뀐 것','확정된 결정 찾아줘'].map(prompt=>`<button type="button" data-action="marin-suggest" data-prompt="${escape(prompt)}">${escape(prompt)}${icon('right')}</button>`).join('')}</div></section>`;
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
  selectWorkspaceView(action.view,action.section,action.teamId);state.error='';state.report=null;render();window.scrollTo(0,0);if(reportTabs())await loadReport();if(state.tab==='content')await loadContentWorkspace();return true;
}
function marinAccountDialog(){modal('내 워크스페이스',escape(state.user?.name||''),`<div class="marin-account-actions">${workspaceUtilityTabs().map(([id,label,glyph])=>button(label,'command-tab',glyph,'',`data-tab="${id}"`)).join('')}${button('SYNK ID 연결','synk-id-account','link')}${button('로그아웃','logout','logout','quiet')}</div>`);}
document.addEventListener('input',event=>{if(event.target.id!=='marin-input')return;marinHome.draft=event.target.value;saveMarinSession();resizeMarinInput(event.target);const send=document.getElementById('marin-send');if(send)send.disabled=marinHome.pending||!marinHome.draft.trim();});
window.addEventListener('resize',()=>{if(typeof state!=='undefined'&&state.tab==='home')resizeMarinInput();});
document.addEventListener('compositionstart',event=>{if(event.target.id==='marin-input')marinHome.composing=true;});
document.addEventListener('compositionend',event=>{if(event.target.id==='marin-input')marinHome.composing=false;});
document.addEventListener('keydown',event=>{if(event.target.id==='marin-input'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.keyCode!==229&&!marinHome.composing){event.preventDefault();void submitMarinMessage();}});
document.addEventListener('submit',event=>{if(event.target.id==='marin-form'){event.preventDefault();void submitMarinMessage();}});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action]');if(!target||target.disabled)return;const action=target.dataset.action;if(action==='marin-retry')void submitMarinMessage(true);if(action==='marin-action')void dispatchMarinAction(target.dataset.entry,target.dataset.index).catch(error=>notify(error.message));if(action==='marin-account')marinAccountDialog();if(action==='marin-workroom-panel'&&['tasks','saved'].includes(target.dataset.panel))openWorkspaceDestination({type:'messenger',label:target.dataset.panel==='tasks'?'내 할 일':'저장한 메시지',panel:target.dataset.panel});if(action==='marin-profile'&&typeof openMarinProfile==='function')void openMarinProfile();if(action==='marin-clear'){resetMarinHome();ensureMarinSession();render();document.getElementById('marin-input')?.focus();}});

document.addEventListener('click',event=>{const target=event.target.closest?.('[data-action="marin-suggest"]');if(!target||!state.user)return;ensureMarinSession();marinHome.draft=target.dataset.prompt||'';saveMarinSession();const input=document.getElementById('marin-input');if(input){input.value=marinHome.draft;input.focus();}syncMarinHome();});
