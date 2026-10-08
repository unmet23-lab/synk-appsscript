'use strict';

// A persistent same-origin module keeps conversations and drafts alive across tabs.
const workspaceModule={userId:null,host:null,frame:null,ready:false,share:null,open:null,summary:null,timer:null,unreadTimer:null,observer:null,slot:null};
const workspaceViewNames={overview:'마케팅 현황',analysis:'성과 분석',history:'전체 추이',content:'콘텐츠 기획'};
const workspacePrimaryTabs=[['workroom','내 작업실','bookmark'],['handbook','회사 안내','info'],['marketing','마케팅','grid'],['messenger','메신저','chat']];
// One application frame for every workspace; only its contextual menu changes.
function workspaceHasContextMenu(){return typeof state!=='undefined'&&['workroom','handbook','marketing'].includes(workspacePrimaryView());}
function workspaceSidebarExpanded(){if(!workspaceHasContextMenu())return false;return window.matchMedia('(max-width:700px)').matches?Boolean(state.workspaceSidebarOpen):!state.workspaceSidebarCollapsed;}
function workspaceGlyph(kind){return kind==='search'?'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>':'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';}
function workspaceContextMenu(){
  const view=workspacePrimaryView(),link=(id,label,glyph,action='tab',attrs='',active=false)=>`<button type="button" class="nav-item ${active?'active':''}" data-action="${action}" ${attrs||`data-tab="${id}"`} aria-current="${active?'page':'false'}" ${typeof isDemoMode==='function'&&isDemoMode()&&action==='marketing-section'&&['content','channels'].includes(id)?'disabled title="실제 데이터 화면에서 사용할 수 있어요"':''}>${icon(glyph)}<span>${escape(label)}</span>${id==='messenger'?'<b class="messenger-unread nav-count" hidden></b>':''}</button>`;
  let title={home:'홈',workroom:'내 작업실',handbook:'회사 안내',marketing:'마케팅',messenger:'메신저',members:'팀·크루',settings:'설정'}[view]||'워크스페이스',items='',extra='';
  if(view==='workroom'){
    items=[['desk','제작 데스크','bookmark'],['trends','트렌드·레퍼런스','chart'],['tools','제작 도구','check'],['clients','고객 관리','users'],['practice','AI 업무 연습','bookmark'],['pages','내 관리 페이지','link']].map(([id,label,glyph])=>link(id,label,glyph,'workroom-view','',typeof wr!=='undefined'&&wr.view===id)).join('');
    extra=link('tasks','내 할 일','calendar','marin-workroom-panel','data-panel="tasks"')+link('saved','저장한 메시지','bookmark','marin-workroom-panel','data-panel="saved"')+link('profile','내 업무 카드','users','marin-profile')+link('mine','내 성과','chart');
  }else if(view==='handbook'){
    const categories=typeof cg!=='undefined'?cg.data?.categories||[]:[];
    items=[{id:'all',label:'한눈에'},...categories].map(row=>link(row.id,row.label,'info','company-guide-category',`data-id="${escape(row.id)}"`,typeof cg!=='undefined'&&!cg.selected&&cg.category===row.id)).join('');
  }else if(view==='marketing'){
    const selected=state.tab==='overview'&&state.marketingView==='channels'?'channels':['overview','analysis','history'].includes(state.tab)?marketingScope():state.tab;
    items=workspaceMarketingTabs.map(([id,label,glyph])=>link(id,label,glyph,'marketing-section','',selected===id)).join('');

  }
  return `<div class="context-menu-scroll"><nav class="nav-list" aria-label="${title} 세부 메뉴">${items}</nav>${extra?`<p class="context-section-label">개인 업무</p><nav class="nav-list" aria-label="${title} 바로가기">${extra}</nav>`:''}</div>`;
}
function workspaceFeltIcon(view){
  const file={home:'sticker-check.webp',workroom:'laptop-felt.webp',handbook:'sticker-book.webp',marketing:'sticker-search.webp',messenger:'sticker-envelope.webp',members:'sticker-person.webp',settings:'sticker-adapt.webp'}[view]||'sticker-search.webp';
  return `<span class="workspace-felt-icon" aria-hidden="true"><img src="/messenger/assets/${file}" alt="" width="40" height="40"></span>`;
}
function workspaceChrome(){
  const view=workspacePrimaryView(),open=workspaceSidebarExpanded(),hasSidebar=workspaceHasContextMenu();
  return `<header class="workspace-appbar"><a class="workspace-wordmark" href="/?tab=home" data-action="tab" data-tab="home" aria-label="홈" aria-current="${state.tab==='home'?'page':'false'}"><img src="/wordmark.svg" alt="싱ㅋ"></a>${!hasSidebar?'':`<button type="button" class="workspace-sidebar-toggle" id="workspace-sidebar-toggle" data-action="workspace-sidebar-toggle" aria-controls="workspace-sidebar-content" aria-expanded="${open}" aria-label="${open?'공통 메뉴 접기':'공통 메뉴 열기'}">${workspaceGlyph('menu')}</button>`}${state.data?.companyName&&state.data.companyName!=='SYNK'?`<span class="appbar-company">${escape(state.data.companyName)}</span>`:''}<button type="button" class="workspace-global-search" data-action="command" aria-label="채널과 메뉴 검색">${workspaceGlyph('search')}<span>검색하거나 메뉴로 이동</span><kbd>Ctrl K</kbd></button>${state.platformUrl?`<a class="workspace-platform-entry" href="${escape(state.platformUrl)}" rel="noreferrer" referrerpolicy="no-referrer" aria-label="SYNK 플랫폼으로 이동">플랫폼</a>`:''}<button type="button" class="appbar-account" data-action="marin-account" aria-label="${escape(state.user?.name||'내')} 계정과 워크스페이스 관리"><span>${escape(state.user?.name||'내 계정')}</span>${icon('settings')}</button></header><nav class="workspace-rail" aria-label="주요 공간">${workspacePrimaryTabs.map(([id,label,glyph])=>`<button type="button" class="rail-item ${view===id?'active':''}" data-action="tab" data-tab="${id}" aria-label="${label}" ${id==='messenger'&&typeof isDemoMode==='function'&&isDemoMode()?'aria-description="데모를 나가 실제 계정의 메신저를 엽니다."':''} aria-current="${view===id?'page':'false'}">${workspaceFeltIcon(id)}<span>${label}</span>${id==='messenger'?'<b class="messenger-unread rail-unread" hidden></b>':''}</button>`).join('')}</nav>${!hasSidebar?'':`<aside class="sidebar" id="workspace-sidebar" aria-label="공통 메뉴"><div class="workspace-sidebar-content" id="workspace-sidebar-content" ${open?'':'hidden inert aria-hidden="true"'}>${workspaceContextMenu()}</div></aside><button type="button" class="workspace-sidebar-scrim" id="workspace-sidebar-scrim" data-action="workspace-sidebar-close" aria-label="공통 메뉴 닫기" hidden></button>`}`;
}
function workspaceAppShell(content,{entering=false,title=''}={}){
  const share=isMarketingWorkspace()&&typeof isDemoMode==='function'&&!isDemoMode()&&typeof workspaceShareButton==='function'?workspaceShareButton():'';
  const demo=isMarketingWorkspace()&&typeof demoBanner==='function'?demoBanner():'',demoMode=typeof isDemoMode==='function'&&isDemoMode();
  const tools=demoMode?demo:(demo||share?`<div class="workspace-page-tools">${demo}${share}</div>`:'');
  return `<div class="app-shell synk-workspace" data-sidebar-open="${workspaceSidebarExpanded()}" data-view="${state.tab}" data-demo="${demoMode}" data-growth-home="${state.tab==='overview'&&state.marketingView!=='channels'}">${workspaceChrome()}<main class="main" id="main" tabindex="-1" aria-busy="${Boolean(state.loading)}">${state.error?`<div class="page-error" role="alert">${escape(state.error)}</div>`:''}<div class="page-body ${entering?'is-entering':''}">${tools}${content}</div></main></div>`;
}
function workspaceSidebarBlocksContent(){return workspaceHasContextMenu()&&Boolean(state.workspaceSidebarOpen&&window.matchMedia('(max-width:700px)').matches);}
function syncWorkspaceSidebar(){
  if(!workspaceHasContextMenu()){const main=document.getElementById('main');if(main)main.inert=false;syncWorkspaceModuleGeometry();return;}
  const shell=document.querySelector('.app-shell'),content=document.getElementById('workspace-sidebar-content'),toggle=document.getElementById('workspace-sidebar-toggle');if(!shell||!content||!toggle)return;
  const open=workspaceSidebarExpanded(),blocked=workspaceSidebarBlocksContent();
  if(!open&&content.contains(document.activeElement))toggle.focus({preventScroll:true});
  shell.setAttribute('data-sidebar-open',String(open));content.hidden=!open;content.inert=!open;content.setAttribute('aria-hidden',String(!open));
  toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'공통 메뉴 접기':'공통 메뉴 열기');toggle.title=open?'공통 메뉴 접기':'공통 메뉴 열기';toggle.innerHTML=workspaceGlyph('menu');
  const scrim=document.getElementById('workspace-sidebar-scrim');if(scrim){scrim.hidden=!blocked;scrim.inert=!blocked;}
  const main=document.getElementById('main');if(main){if(blocked&&!document.getElementById('overlay')?.children.length&&!document.getElementById('workspace-sidebar')?.contains(document.activeElement))toggle.focus({preventScroll:true});main.inert=blocked;}
  if(workspaceModule.host){workspaceModule.host.inert=state.tab!=='messenger'||blocked||Boolean(document.getElementById('overlay')?.children.length);if(workspaceModule.sidebarBlocked!==blocked){workspaceModule.sidebarBlocked=blocked;sendWorkspaceMessage({type:'workspace:visible',visible:state.tab==='messenger'&&!blocked});}}
  syncWorkspaceModuleGeometry();
}
function setWorkspaceSidebar(open,{focus=true}={}){
  state.workspaceSidebarOpen=Boolean(open);if(!window.matchMedia('(max-width:700px)').matches)state.workspaceSidebarCollapsed=!open;syncWorkspaceSidebar();
  if(focus)document.getElementById('workspace-sidebar-toggle')?.focus({preventScroll:true});
  requestAnimationFrame(syncWorkspaceModuleGeometry);
}
document.addEventListener('keydown',event=>{
  if(!workspaceHasContextMenu()||!state.workspaceSidebarOpen||document.getElementById('overlay')?.children.length)return;
  if(event.key==='Escape'){event.preventDefault();setWorkspaceSidebar(false);return;}
  if(event.key!=='Tab'||!workspaceSidebarBlocksContent())return;
  const sidebar=document.getElementById('workspace-sidebar'),targets=[...(sidebar?.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled)')||[])].filter(element=>element.getClientRects().length);
  if(!targets.length)return;const first=targets[0],last=targets.at(-1);
  const toggle=document.getElementById('workspace-sidebar-toggle');
  if(document.activeElement===toggle){event.preventDefault();(event.shiftKey?last:first).focus();return;}
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
window.addEventListener('resize',syncWorkspaceSidebar);
const workspaceMarketingTabs=[['mine','내 현황','grid'],['team','팀 현황','users'],['all','전체 현황','grid'],['content','콘텐츠 기획','bookmark'],['channels','채널·수집','link']];
function isMarketingWorkspace(){return ['overview','analysis','history','content'].includes(state.tab);}
function workspacePrimaryView(){return isMarketingWorkspace()?'marketing':state.tab;}
function workspaceUtilityTabs(){return [...(canManageTeam()?[['members','팀·크루','users']]:[]),...(isAdmin()?[['settings','설정','settings']]:[])];}
function marketingScope(){return state.scope==='mine'?'mine':state.scope==='team'||state.scope==='all'&&state.teamId?'team':state.scope==='all'?'all':'mine';}
function marketingScopeTitle(){return {mine:'내 현황',team:'팀 현황',all:'전체 현황'}[marketingScope()];}
function resetGrowthHistoryRange(){state.historyRange='all';state.historyStart='';state.historyEnd='';state.historyDate='';}
function invalidateMarketingReport(){resetGrowthHistoryRange();state.comparisonGroup='';state.comparisonExpanded=false;state.ownerId='';state.platform='';state.channel='';state.analysisView='daily';state.report=null;state.loading=false;state.reportRequest=(Number(state.reportRequest)||0)+1;}
function normalizeMarketingScope(){
  const before=`${state.scope}:${state.teamId||''}`,scope=marketingScope();state.scope=scope;
  if(scope!=='team')state.teamId='';
  else if(state.data){
    const teams=(state.data.teams||[]).filter(team=>team.active!==false&&(isAdmin()||team.id===state.user?.teamId));
    const own=teams.find(team=>team.id===state.user?.teamId);
    state.teamId=teams.find(team=>team.id===state.teamId)?.id||own?.id||(isAdmin()?teams[0]?.id:'')||'';
  }
  if(scope==='team'&&state.teamId)state.lastMarketingTeamId=state.teamId;
  if(before!==`${state.scope}:${state.teamId||''}`)invalidateMarketingReport();
  return scope;
}
function selectWorkspaceView(view,section='',teamId=undefined,draftId=undefined){
  if(isMarketingWorkspace()){
    state.lastMarketingTab=state.tab;
    if(['analysis','history'].includes(state.tab)||state.tab==='overview'&&state.marketingView!=='channels'){
      state.lastMarketingScope=marketingScope();
      if(marketingScope()==='team'&&state.teamId)state.lastMarketingTeamId=state.teamId;
    }
  }
  if(!view)view='home';
  if(view!=='messenger'){workspaceModule.open=null;}
  if(view==='home'){state.tab='home';state.workspaceSidebarOpen=false;state.reportRequest=(Number(state.reportRequest)||0)+1;state.loading=false;return;}
  if(view==='marketing'){
    if(['mine','team','all','overview','analysis','history','content','channels'].includes(section))return selectWorkspaceView(section,'',teamId);
    state.tab=['overview','analysis','history','content'].includes(state.lastMarketingTab)?state.lastMarketingTab:'overview';
    if(['analysis','history'].includes(state.tab)||state.tab==='overview'&&state.marketingView!=='channels'){
      state.scope=state.lastMarketingScope||marketingScope();state.teamId=state.scope==='team'?state.lastMarketingTeamId||'':'';normalizeMarketingScope();
    }
  }else if(['mine','team','all'].includes(view)){
    state.tab='overview';state.marketingView='summary';state.scope=view;
    state.teamId=view==='team'?(teamId===undefined?state.teamId||state.lastMarketingTeamId||'':teamId):'';
    normalizeMarketingScope();invalidateMarketingReport();
  }else if(view==='channels'||view==='collection'){
    state.tab='overview';state.marketingView='channels';state.scope='all';state.teamId='';invalidateMarketingReport();
    state.channelStatus=view==='collection'?'attention':'all';
  }else if(view==='studio'){
    state.tab='content';cp.view='examples';
  }else if(view==='overview'||view==='analysis'||view==='history'||view==='summary'){
    state.tab=['analysis','history'].includes(view)?view:'overview';state.marketingView=section==='channels'?'channels':'summary';
    if(section==='channels'){state.scope='all';state.teamId='';invalidateMarketingReport();}
    else if(['mine','team','all','summary'].includes(section)){
      const scope=section==='summary'?'all':section;
      state.scope=scope;state.teamId=scope==='team'?(teamId===undefined?state.teamId||state.lastMarketingTeamId||'':teamId):'';
      normalizeMarketingScope();invalidateMarketingReport();
    }else normalizeMarketingScope();
  }else if([...workspacePrimaryTabs,...workspaceMarketingTabs,['members'],['settings']].some(row=>row[0]===view)){
    state.tab=view;
    if(view==='workroom'&&typeof wr!=='undefined'&&['desk','trends','tools','practice','pages','clients'].includes(section))wr.view=section;
    if(view==='content'&&['library','plan','examples'].includes(section))cp.view=section;
    if(view==='content'&&draftId!==undefined){cp.detailRequest=(Number(cp.detailRequest)||0)+1;cp.draftId=String(draftId);cp.pendingDraftId=String(draftId);cp.activeDraft=null;cp.ideaId='';cp.view='plan';}
  }
  if(isMarketingWorkspace()||['messenger','workroom','handbook'].includes(state.tab)||workspaceSidebarBlocksContent())state.workspaceSidebarOpen=false;
}
function workspaceSection(){return state.tab==='overview'&&state.marketingView==='channels'?'channels':['overview','analysis','history'].includes(state.tab)?marketingScope():state.tab==='content'?cp.view:state.tab==='workroom'&&typeof wr!=='undefined'?wr.view:'';}
function syncWorkspaceLocation(){
  if(!state.user)return;
  const url=new URL(location.href),hash=new URLSearchParams(url.hash.slice(1));
  if(['launch','invite','setup'].some(key=>hash.has(key)))return;
  url.searchParams.set('tab',state.tab);
  const section=workspaceSection();if(section)url.searchParams.set('section',section);else url.searchParams.delete('section');
  if(state.tab==='workroom'&&section==='tools'&&typeof makerTools!=='undefined')url.searchParams.set('tool',makerTools.view);else url.searchParams.delete('tool');
  if(['overview','analysis','history'].includes(state.tab)&&section==='team'&&state.teamId)url.searchParams.set('teamId',state.teamId);else url.searchParams.delete('teamId');
  if(state.tab==='content'&&section==='plan'&&cp.draftId)url.searchParams.set('draftId',cp.draftId);else url.searchParams.delete('draftId');
  if(hash.has('view'))url.hash='';
  if(url.href!==location.href)history.replaceState(null,'',url.pathname+url.search+url.hash);
}
function marketingNavigation(){
  const active=state.tab==='overview'&&state.marketingView==='channels'?'channels':['overview','analysis','history'].includes(state.tab)?marketingScope():state.tab;
  return `<nav class="workspace-sections" aria-label="마케팅 메뉴">${workspaceMarketingTabs.map(([id,label])=>`<button type="button" data-action="marketing-section" data-tab="${id}" ${typeof isDemoMode==='function'&&isDemoMode()&&['content','channels'].includes(id)?'disabled title="실제 데이터 화면에서 사용할 수 있어요" ':''}class="${active===id?'active':''}" aria-current="${active===id?'page':'false'}">${label}</button>`).join('')}</nav>`;
}
function workspaceHomeActions(){return '';}
function messengerWorkspacePage(){return `<section id="messenger-module-slot" class="messenger-module-slot" aria-label="메신저" aria-busy="${!workspaceModule.ready}"><div class="messenger-module-loading"${workspaceModule.ready?' hidden aria-hidden="true"':''}><span class="loading-line"></span><p>팀의 대화를 열고 있어요.</p><button class="btn small" type="button" data-action="messenger-retry">다시 연결</button></div></section>`;}
function syncWorkspaceLoading(){
  const slot=document.getElementById('messenger-module-slot');if(!slot)return;
  slot.setAttribute('aria-busy',String(!workspaceModule.ready));
  const loading=slot.querySelector('.messenger-module-loading');
  if(loading){loading.hidden=workspaceModule.ready;loading.setAttribute('aria-hidden',String(workspaceModule.ready));loading.inert=workspaceModule.ready;}
}
function workspaceShareButton(){return !isViewer()&&workspaceViewNames[state.tab]?'<button type="button" class="btn small workspace-share" data-action="share-workspace" aria-label="현재 화면을 대화 초안으로 공유">'+icon('chat')+'<span>대화로 공유</span></button>':'';}
function resetWorkspaceModule(){
  clearInterval(workspaceModule.timer);clearTimeout(workspaceModule.unreadTimer);workspaceModule.observer?.disconnect();workspaceModule.host?.remove();
  Object.assign(workspaceModule,{userId:null,host:null,frame:null,ready:false,share:null,open:null,summary:null,timer:null,unreadTimer:null,observer:null,slot:null});
}
function mountWorkspaceModule(){
  if(!state.user)return resetWorkspaceModule();
  if(workspaceModule.userId&&workspaceModule.userId!==state.user.id)resetWorkspaceModule();
  workspaceModule.userId=state.user.id;
  const shown=state.tab==='messenger';
  if(shown){
    const url=new URL(location.href);
    if(url.searchParams.get('panel')==='notifications'){
      workspaceModule.open={type:'workspace:open',requestId:crypto.randomUUID(),panel:'notifications'};
      url.searchParams.delete('panel');history.replaceState(null,'',url.pathname+url.search+url.hash);
      if(workspaceModule.ready)sendWorkspaceMessage(workspaceModule.open);
    }
  }
  if(shown&&!workspaceModule.host){
    const host=document.createElement('section');host.id='workspace-messenger';host.className='workspace-messenger';host.setAttribute('aria-label','팀 메신저');
    const frame=document.createElement('iframe');frame.id='messenger-frame';frame.title='싱ㅋ 팀 메신저';frame.src='/messenger/';frame.setAttribute('referrerpolicy','same-origin');
    host.append(frame);document.body.append(host);workspaceModule.host=host;workspaceModule.frame=frame;
    frame.addEventListener('load',()=>{syncWorkspaceModuleGeometry();sendWorkspaceMessage({type:'workspace:visible',visible:state.tab==='messenger'&&!workspaceSidebarBlocksContent()});});
  }
  workspaceModule.slot=document.getElementById('messenger-module-slot');workspaceModule.observer?.disconnect();
  if(workspaceModule.slot){workspaceModule.observer=new ResizeObserver(syncWorkspaceModuleGeometry);workspaceModule.observer.observe(workspaceModule.slot);}
  if(workspaceModule.host){workspaceModule.host.hidden=!shown;workspaceModule.host.inert=!shown||workspaceSidebarBlocksContent()||Boolean(document.getElementById('overlay')?.children.length);workspaceModule.host.setAttribute('aria-hidden',String(!shown));sendWorkspaceMessage({type:'workspace:visible',visible:shown&&!workspaceSidebarBlocksContent()});}
  syncWorkspaceLoading();syncWorkspaceModuleGeometry();renderWorkspaceUnread();requestAnimationFrame(syncWorkspaceModuleGeometry);
}
function syncWorkspaceModuleGeometry(){
  const {host,slot}=workspaceModule;if(!host||!slot||state.tab!=='messenger')return;
  const rect=slot.getBoundingClientRect();
  if(rect.width<1||rect.height<1)return;
  Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${Math.max(160,rect.height)}px`});
}
function sendWorkspaceMessage(message){if(workspaceModule.frame?.contentWindow)workspaceModule.frame.contentWindow.postMessage(message,location.origin);}
function retryWorkspaceModule(){if(workspaceModule.frame){workspaceModule.ready=false;syncWorkspaceLoading();workspaceModule.frame.src='/messenger/';}else mountWorkspaceModule();}
function openWorkspaceDestination(value){
  const action=typeof safeMarinAction==='function'?safeMarinAction(value):null;if(!action||action.type!=='messenger'||!state.user)return false;
  workspaceModule.open={type:'workspace:open',requestId:crypto.randomUUID(),...(action.channelId?{channelId:action.channelId}:{}),...(action.userId?{userId:action.userId}:{}),...(action.messageId?{messageId:action.messageId}:{}),...(action.fileId?{fileId:action.fileId}:{}),...(action.panel?{panel:action.panel}:{})};
  selectWorkspaceView('messenger');state.error='';render();window.scrollTo(0,0);if(workspaceModule.ready)sendWorkspaceMessage(workspaceModule.open);return true;
}
async function refreshWorkspaceSummary(){
  if(!state.user)return;const userId=state.user.id;
  try{const result=await api('/api/workspace-summary');if(state.user?.id!==userId)return;workspaceModule.summary=result;renderWorkspaceUnread();}catch{/* The normal auth handler handles expired company sessions. */}
}
function renderWorkspaceUnread(){
  const value=Math.max(0,Number(workspaceModule.summary?.messenger?.unread)||0);
  document.querySelectorAll('.messenger-unread').forEach(badge=>{badge.hidden=!value;badge.textContent=value>99?'99+':String(value);badge.setAttribute('aria-label',`안 읽은 메시지 ${value}개`);});
}
function startWorkspaceSummary(){
  clearInterval(workspaceModule.timer);void refreshWorkspaceSummary();
  workspaceModule.timer=setInterval(()=>{if(state.user&&!document.hidden)void refreshWorkspaceSummary();},20000);
}
function workspaceLinkDestination(value){
  if(typeof value!=='string'||value.length>1800)return null;
  let url;try{url=new URL(value,location.origin);}catch{return null;}
  if(url.origin!==location.origin||url.pathname!=='/'||url.username||url.password||url.search&&url.hash)return null;
  const params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),view=params.get('view')||params.get('tab');
  if(!['overview','analysis','history','content','channels','marketing'].includes(view))return null;
  const keys=[...params.keys()];if(keys.some(key=>!['view','tab','section','teamId','draftId'].includes(key))||new Set(keys).size!==keys.length||params.has('view')&&params.has('tab'))return null;
  const section=params.get('section')||'',teamId=params.get('teamId')||'',draftId=params.get('draftId')||'';
  if(teamId&&!/^[a-zA-Z0-9_. -]{1,100}$/.test(teamId)||draftId&&!/^[a-zA-Z0-9_-]{1,100}$/.test(draftId))return null;
  if(view==='content'){if(section&&!['library','plan','examples'].includes(section)||teamId||draftId&&section!=='plan')return null;}
  else if(draftId||section&&!['mine','team','all','summary','channels'].includes(section)||teamId&&section!=='team')return null;
  return{view,section,teamId:teamId||undefined,draftId:draftId||undefined};
}
async function navigateWorkspaceLink(value){
  const destination=workspaceLinkDestination(value);if(!destination||!state.user)return false;
  selectWorkspaceView(destination.view,destination.section,destination.teamId,destination.draftId);
  state.reportRequest=(Number(state.reportRequest)||0)+1;state.report=null;state.error='';render();window.scrollTo(0,0);
  if(state.tab==='content')await loadContentWorkspace();else if(['overview','analysis','history'].includes(state.tab)&&state.marketingView!=='channels')await loadReport();
  return true;
}
function prepareWorkspaceShare(workspaceLink,target={}){
  if(isViewer()||!workspaceLinkDestination(workspaceLink?.url))return false;
  workspaceModule.share={type:'workspace:share',title:workspaceLink.title,url:new URL(workspaceLink.url,location.origin).href,workspaceLink,requestId:crypto.randomUUID(),...(target.channelId?{channelId:target.channelId}:{}),...(target.userId?{userId:target.userId}:{})};
  selectWorkspaceView('messenger');state.error='';render();window.scrollTo(0,0);
  if(workspaceModule.ready)sendWorkspaceMessage(workspaceModule.share);
  return true;
}
function shareWorkspaceView(){
  if(isViewer()||!workspaceViewNames[state.tab])return;
  // Share the permitted screen title/link only. Private drafts and assets never enter a message.
  const section=workspaceSection(),reportView=['overview','analysis','history'].includes(state.tab)&&section!=='channels';
  const title=reportView?marketingScopeTitle()+(state.tab==='analysis'?' · 상세 분석':state.tab==='history'?' · 전체 추이':''):workspaceViewNames[state.tab]+(section==='channels'?' · 채널·수집 관리':state.tab==='content'&&cp.view==='examples'?' · 좋은 콘텐츠':'');
  const url=new URL('/',location.origin);url.hash=new URLSearchParams({view:state.tab,...(section?{section}:{}),...(reportView&&section==='team'&&state.teamId?{teamId:state.teamId}:{})}).toString();
  prepareWorkspaceShare({title,url:url.pathname+url.hash,kind:reportView?'report':'screen'});
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==workspaceModule.frame?.contentWindow||!event.data||typeof event.data!=='object')return;
  const type=event.data.type;
  if(type==='messenger:device-notifications'){if(state.user)void window.SynkDeviceNotifications?.open();return;}
  if(type==='messenger:client-open'){
    if(state.user&&typeof openClientWorkflowLink==='function')void Promise.resolve(openClientWorkflowLink(event.data.url)).catch(error=>notify(error.message));
    return;
  }
  if(type==='messenger:navigate'){void navigateWorkspaceLink(event.data.url).catch(error=>notify(error.message));return;}
  if(type==='messenger:ready'){workspaceModule.ready=true;syncWorkspaceLoading();sendWorkspaceMessage({type:'workspace:visible',visible:state.tab==='messenger'&&!workspaceSidebarBlocksContent()});if(workspaceModule.share)sendWorkspaceMessage(workspaceModule.share);if(state.tab==='messenger'&&workspaceModule.open)sendWorkspaceMessage(workspaceModule.open);return;}
  if(type==='messenger:open-received'){if(event.data.requestId===workspaceModule.open?.requestId)workspaceModule.open=null;return;}
  if(type==='messenger:share-received'){if(event.data.requestId===workspaceModule.share?.requestId)workspaceModule.share=null;return;}
  if(type==='messenger:unread'){clearTimeout(workspaceModule.unreadTimer);workspaceModule.unreadTimer=setTimeout(()=>void refreshWorkspaceSummary(),400);return;}
  if(type==='messenger:team'){if(canManageTeam()){state.tab='members';render();}return;}
  if(type==='messenger:auth-expired'){
    state.user=null;state.data=null;state.report=null;state.authMode='login';state.hypeRequest++;state.hype=null;
    if(typeof resetContentWorkspace==='function')resetContentWorkspace();if(typeof resetStudioWorkspace==='function')resetStudioWorkspace();
    closeModal();renderAuth();notify('로그인이 만료됐어요. 회사 계정으로 다시 로그인해 주세요.');
  }
});
window.addEventListener('resize',syncWorkspaceModuleGeometry);
globalThis.navigator?.serviceWorker?.addEventListener('message',event=>{
  const stamp=companyAuthSnapshot();
  void (async()=>{
    if(!stamp.userId||!await window.SynkDeviceNotifications?.isTrustedWorkerMessage(event)||!companyAuthCurrent(stamp))return;
    const me=await api('/api/me');
    if(!companyAuthCurrent(stamp)||me.user?.id!==stamp.userId||me.csrfToken!==state.csrf)return;
    openWorkspaceDestination({type:'messenger',label:'알림',panel:'notifications'});
  })().catch(()=>{});
});
window.addEventListener('scroll',syncWorkspaceModuleGeometry,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user)void refreshWorkspaceSummary();});

const workspaceOverlayObserver=new MutationObserver(()=>{if(workspaceModule.host)workspaceModule.host.inert=state.tab!=='messenger'||workspaceSidebarBlocksContent()||Boolean(document.getElementById('overlay')?.children.length);});
if(document.getElementById('overlay'))workspaceOverlayObserver.observe(document.getElementById('overlay'),{childList:true});
