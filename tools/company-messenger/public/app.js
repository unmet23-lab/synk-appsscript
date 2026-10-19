const moduleBase=location.pathname.startsWith('/messenger/')?'/messenger':'';
const moduleUrl=path=>moduleBase&&path.startsWith('/')&&!path.startsWith(moduleBase+'/')?moduleBase+path:path;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const app = $('#app');
const modal = $('#modal');
const icons = {
  chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  hash:'<path d="M4 9h16M3 15h16M10 3 6 21M18 3l-4 18"/>',
  note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7zM22 2 11 13"/>',
  attach:'<path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5L13.6 2.4a4 4 0 1 1 5.7 5.7l-9.9 9.9a2 2 0 0 1-2.8-2.8l9.2-9.2"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
  settings:'<path d="m12 3 2 3 3-.3.8 3 2.7 1.8-1.3 3 1.3 3-2.7 1.8-.8 3-3-.3-2 3-2-3-3 .3-.8-3L3.5 16l1.3-3-1.3-3L6.2 8.2l.8-3 3 .3z" transform="translate(1 -1) scale(.85)"/><circle cx="12" cy="12" r="3"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6zM13 6l5 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  logout:'<path d="M9 21H3V3h6M9 12h13m-5-5 5 5-5 5"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  upload:'<path d="M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  cloud:'<path d="M20 16.6A4.5 4.5 0 0 0 18 8a6 6 0 0 0-11.4-1.7A5 5 0 0 0 7 17h11"/><path d="m10 14 2-2 2 2M12 12v8"/>',
  globe:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  reply:'<path d="m9 10-5 5 5 5M4 15h9a7 7 0 0 0 0-14" transform="translate(1 2) scale(.9)"/>',
  pin:'<path d="m16 3 5 5-4 2-3 6-2-2-6 6m4-8-2-2 6-3z"/>',
  project:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M8 6V3h8v3M3 12h18M10 12v3h4v-3"/>',
  unread:'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m3 7 9 6 9-6"/>',
  announcement:'<path d="M4 9v6h4l11 4V5L8 9H4zM8 15l2 6h3l-2-5M22 9v6"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  task:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
};
const icon = (name) => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.chat}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id = value => encodeURIComponent(value);
const initials = name => [...(name || '?')].slice(0,2).join('');
const color = name => [...(name || '')].reduce((sum,c) => sum + c.charCodeAt(0),0) % 5;
const avatar = user => `<span class="avatar" data-color="${color(user.name)}" aria-hidden="true">${esc(initials(user.name))}</span>`;
const bytes = value => {
  const amount=Number(value);
  if(value===null||value===undefined||!Number.isFinite(amount)||amount<0)return '확인 필요';
  if(amount<1024)return `${amount} B`;
  if(amount<1048576)return `${(amount/1024).toFixed(1)} KB`;
  if(amount<1073741824)return `${(amount/1048576).toFixed(1)} MB`;
  if(amount<1099511627776)return `${(amount/1073741824).toFixed(2)} GB`;
  return `${(amount/1099511627776).toFixed(2).replace(/\.00$/,'')} TB`;
};
const dateLabel = date => new Date(date).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'short'});
const shortDate = date => new Date(date).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'});
const timeLabel = date => new Date(date).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false});
const state = {user:null,workspace:{name:'SYNK'},storage:{provider:'local'},integrated:null,channels:[],members:[],channelId:null,messages:[],hasMore:false,mode:'chat',drawer:null,queues:new Map(),events:null,loadSeq:0,connected:false,sending:false,needsSetup:false,fileBytes:104857600,searchSeq:0,refreshSeq:0};
Object.assign(state,{navFilter:'all',roomQuery:'',chatCategory:'personal',categoryFilters:{personal:'all',team:'all',all:'all'},categoryChannels:{},navigationSeq:0,replyTarget:null,thread:null,threadSeq:0,pins:[],pinsSeq:0,filesSeq:0,fileQuery:'',fileType:'all',fileScope:'channel',fileOffset:0,sharedFiles:[],teams:[],directoryQuery:'',directoryTeam:'all'});
Object.assign(state,{unavailableChannels:new Set(),deletingChannels:new Set(),leavingChannels:new Set(),restoringChannels:new Set(),channelsSeq:0});
const chatCategories=[['personal','개인채팅','chat'],['team','팀채팅','users'],['all','전체채팅','globe']];
const systemRoomMeta={announcements:{icon:'announcement',description:'회사 일정·결정·필수 안내',intro:'회사 일정과 결정, 꼭 알아야 할 안내를 확인하세요.'},info:{icon:'note',description:'업무 자료와 정보 공유',intro:'업무에 필요한 자료, 링크와 유용한 정보를 함께 나누세요.'},social:{icon:'chat',description:'가벼운 이야기와 일상',intro:'가벼운 안부부터 오늘의 이야기까지 편하게 나누세요.'}};
Object.assign(state,{mentionIds:[],workspaceLink:null,ackRequired:false,mentionPicker:null,personalTab:'workday',savedView:'saved',taskFilter:'all',taskScope:'mine',shareSeq:0,personalSeq:0,personalItems:[],notificationCount:0,searchMessages:[],searchOffset:0,decisionQuery:'',decisionCurrent:true,decisionKind:'all',customerWork:[],catchUp:null});
Object.assign(state,{scheduledNotifications:{enabled:null},workNotificationSession:0,workNotificationRevision:0,deadlineSettings:undefined,deadlineSettingsUser:null});
Object.assign(state,{publicationWork:[],workdaySnapshot:null,workdayBody:null});
Object.assign(state,{transferSession:0,sendAttempts:new Map(),transferFocusRevision:0});
function sortedPublicChannels(channels){const order=Object.keys(systemRoomMeta);return channels.map((channel,index)=>({channel,index,rank:order.includes(channel.systemKey)?order.indexOf(channel.systemKey):order.length})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(item=>item.channel);}
function channelCategory(channel){return channel?.kind==='self'||channel?.kind==='dm'?'personal':channel?.scope==='team'?'team':'all';}
function selectedConversation(){const channel=currentChannel();return channel&&channelCategory(channel)===state.chatCategory?channel:null;}
function categoryLabel(){return chatCategories.find(([key])=>key===state.chatCategory)?.[1]||'개인채팅';}
let eventTimer, searchTimer, modalReturnFocus, composition = false, dragDepth = 0, modalVersion = 0;
let workdayTimer=null,workdayTimerVersion=0;
const pendingUpdates = new Set();
const mobileLayout=window.matchMedia('(max-width: 680px)');
const directoryWide=window.matchMedia('(min-width: 1000px)');
let sidebarReturnFocus=null,drawerReturnFocus=null,moduleVisible=!moduleBase||window.parent===window,moduleReady=false;
function announceWorkspaceReady(){moduleReady=true;parentMessage('messenger:ready');}
const bootRecovery={generation:0,attempt:0,phase:'idle',timer:null,timeout:null,controller:null,resumeOnRestore:false};
// Calls live in voice.js (loaded as its own module) so chat re-rendering never owns the SDK Room.
let voice=null;
function voiceController(){
  if(voice||typeof window.SynkVoice?.createVoice!=='function')return voice;
  voice=window.SynkVoice.createVoice({api,toast,esc,openModal,modal,embedded:Boolean(moduleBase&&window.parent!==window),parentMessage,members:()=>state.members||[],channels:()=>state.channels||[],selectedChannelId:()=>selectedConversation()?.id||null,openChannel:channelId=>{if(state.channelId!==channelId||!selectedConversation())void selectChannel(channelId);}});
  return voice;
}

function toast(message, error = false){
  const item = document.createElement('div'); item.className = `toast${error?' error':''}`; item.textContent = message;
  $('#toasts').append(item); setTimeout(() => item.remove(),5500);
}
function companySessionRecovery(){
  if(!moduleBase||window.parent===window)return null;
  let parent;try{parent=window.parent;if(parent.location?.origin!==location.origin||typeof parent.ensureNativeSynkCompanySession!=='function')return null;}catch{return null;}
  const owner=state.integrated?.companyUserId,context=state.user?transferContext():null,initial=state.integrated;
  const recovery=parent.ensureNativeSynkCompanySession();if(!recovery)return null;
  return Promise.resolve(recovery).then(session=>{
    if(!session)return;
    if(initial!==state.integrated||context&&!transferContextCurrent(context)||owner&&owner!==session.companyUserId||typeof session.csrfToken!=='string')throw new Error('로그인이 바뀌어 이전 요청을 종료했어요.');
    if(state.integrated){const changed=state.integrated.csrfToken!==session.csrfToken;state.integrated.csrfToken=session.csrfToken;if(changed&&state.events)connectEvents();}
  });
}
async function api(path, options = {}){
  const recovery=companySessionRecovery();if(recovery)await recovery;
  if(options.signal?.aborted)throw options.signal.reason||Object.assign(new Error('취소한 요청이에요.'),{name:'AbortError'});
  const identity={userId:state.user?.id,integrated:state.integrated,csrf:state.integrated?.csrfToken};
  const opts = {...options,credentials:'same-origin',headers:{...options.headers}};
  const recoveryContext=opts.recoveryContext;delete opts.recoveryContext;
  if(options.body !== undefined && typeof options.body !== 'string'){opts.body = JSON.stringify(options.body);opts.headers['Content-Type']='application/json';}
  if(state.integrated?.csrfToken&&opts.method&&opts.method!=='GET')opts.headers['X-CSRF-Token']=state.integrated.csrfToken;
  const controller=recoveryContext&&typeof AbortController==='function'?new AbortController():null;
  if(controller)opts.signal=controller.signal;const timeout=controller?setTimeout(()=>controller.abort(),30000):null;
  let response,data;try{response=await fetch(moduleUrl(path),opts);data=await response.json().catch(()=>({}));}finally{if(controller)clearTimeout(timeout);}
  if(opts.signal?.aborted)throw opts.signal.reason||Object.assign(new Error('취소한 요청이에요.'),{name:'AbortError'});
  if(identity.userId!==state.user?.id||identity.integrated!==state.integrated||identity.csrf!==state.integrated?.csrfToken)throw new Error('로그인이 바뀌어 이전 요청을 종료했어요.');
  if(recoveryContext&&!transferContextCurrent(recoveryContext))throw new Error('로그인이 바뀌어 이전 요청을 종료했어요.');
  if(!response.ok){
    if(response.status===401&&moduleBase){returnToCompanyLogin();throw new Error('회사 계정으로 다시 로그인해 주세요.');}
    if(response.status===401 && state.user){state.events?.close();state.user=null;state.queues.forEach(q=>q.forEach(f=>f.xhr?.abort()));state.queues.clear();if(modal.open)modal.close();renderAuth('login');}
    const error = new Error(data.error || `요청을 처리하지 못했어요. (${response.status})`);error.status=response.status;error.code=data.code;throw error;
  }
  return data;
}
function draftKey(channelId = state.channelId){return `synk-messenger:draft:${state.user?.id}:${channelId}`;}
function readDraft(){try{return localStorage.getItem(draftKey()) || '';}catch{return '';}}
function saveDraft(){const box=$('#composer-input');if(!box||!state.user||!state.channelId||state.unavailableChannels.has(state.channelId))return;try{localStorage.setItem(draftKey(),box.value);}catch{}saveComposeExtras();}
function currentChannel(){return state.channels.find(c=>c.id===state.channelId);}
function attachmentKey(channelId,userId=state.user?.id){return `synk-messenger:attachments:${userId}:${channelId}`;}
function queue(channelId = state.channelId){
  if(!channelId||state.unavailableChannels.has(channelId))return[];
  if(!state.queues.has(channelId)){
    let restored=[];
    if(state.user&&channelId)try{
      const saved=JSON.parse(localStorage.getItem(attachmentKey(channelId))||'[]');
      if(Array.isArray(saved))restored=saved.flatMap(item=>{
        if(item?.file&&typeof item.file.id==='string'&&item.file.channelId===channelId&&item.file.uploaderId===state.user.id)return[{key:item.key||crypto.randomUUID(),name:item.file.name,size:item.file.size,status:item.cancelPending?'error':'done',progress:100,cancelled:Boolean(item.cancelPending),cancelPending:Boolean(item.cancelPending),errorCode:item.errorCode||null,file:{...item.file,url:moduleUrl(`/api/files/${id(item.file.id)}`)}}];
        if(item?.userId===state.user.id&&item.channelId===channelId&&typeof item.key==='string'&&/^[0-9a-f-]{36}$/i.test(item.key)&&typeof item.name==='string'&&Number.isFinite(item.size))return[{key:item.key,name:item.name,size:item.size,status:'error',progress:0,cancelled:Boolean(item.cancelPending),cancelPending:Boolean(item.cancelPending),rawFile:null,errorCode:item.errorCode||null}];return[];
      }).slice(0,5);
    }catch{}
    state.queues.set(channelId,restored);
  }
  return state.queues.get(channelId);
}
function persistQueue(channelId=state.channelId){
  if(!state.user||!channelId||state.unavailableChannels.has(channelId))return;
  const completed=(state.queues.get(channelId)||[]).filter(item=>!item.cancelled||item.cancelPending).map(item=>item.status==='done'&&!item.cancelPending?{key:item.key,file:item.file}:{key:item.key,name:item.name,size:item.size,userId:state.user.id,channelId,cancelPending:Boolean(item.cancelPending),errorCode:item.errorCode||null,...(item.file?{file:item.file}:{})});
  try{if(completed.length)localStorage.setItem(attachmentKey(channelId),JSON.stringify(completed));else localStorage.removeItem(attachmentKey(channelId));}catch{toast('첨부 파일의 임시 기록을 보관하지 못했어요. 새로고침 전에 전송해 주세요.',true);}
}
function channelIcon(channel){return systemRoomMeta[channel.systemKey]?.icon||(channel.kind==='self'?'note':channel.kind==='dm'?'chat':channel.category==='project'?'project':'hash');}
function textBody(text){return esc(text).replace(/https?:\/\/[^\s<>]+/g,url=>{const clean=url.replace(/&amp;/g,'&');return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${url}</a>`;});}


function isDrive(){return state.storage?.provider==='google-drive';}
function storageSentence(){return isDrive()?'대화는 이 PC에, 새 파일은 Google Drive에 저장돼요.':'대화와 파일은 이 PC에 저장돼요.';}
function uploadDestination(){return isDrive()?'새 파일은 Drive에 저장':'새 파일은 이 PC에 저장';}
function updateStorageProvider(provider){
  state.storage={provider:provider==='google-drive'?'google-drive':'local'};
  if($('#connection'))setConnection(state.connected);
  if($('#composer-storage'))$('#composer-storage').textContent=`${uploadDestination()} · 파일당 최대 ${bytes(state.fileBytes)}`;
  if($('#settings-storage-note'))$('#settings-storage-note').innerHTML=storageNote();
  if($('#composer-input'))updateSend();
}
async function refreshStorageProvider(){
  const userId=state.user?.id,session=state.workNotificationSession,revision=++state.workNotificationRevision,data=await api('/api/bootstrap');
  if(!userId||userId!==state.user?.id||session!==state.workNotificationSession||(data.user&&data.user.id!==userId))return;
  const previousWrite=canWriteMessages(),previousScheduler=state.scheduledNotifications.enabled;
  // A bootstrap refresh of the same login must not invalidate concurrent reads.
  // Replacing the identity still cancels requests when the company account or CSRF changes.
  if(data.integrated){if(state.integrated&&state.integrated.companyUserId===data.integrated.companyUserId&&state.integrated.csrfToken===data.integrated.csrfToken)Object.assign(state.integrated,data.integrated);else state.integrated=data.integrated;}if(data.user)state.user=data.user;if(revision===state.workNotificationRevision)setWorkNotificationStatus(data.scheduledNotifications?.enabled);if(data.storage)updateStorageProvider(data.storage.provider);
  const permissionsChanged=previousWrite!==canWriteMessages();
  if(permissionsChanged){applyIntegratedUI();syncComposerAccess();}
  if(permissionsChanged||previousScheduler!==state.scheduledNotifications.enabled){renderMessages({preserve:true});await refreshDetailViews();}
}
function storageNote(){return `${storageSentence()} 파일은 자동으로 삭제되지 않아요. 중요한 자료는 별도로 백업해 주세요.${state.user?.role==='member'?'<br>위 수치는 내가 볼 수 있는 대화 기준이에요.':''}`;}

function stopBootRecovery(phase='idle'){
  bootRecovery.generation++;clearTimeout(bootRecovery.timer);clearTimeout(bootRecovery.timeout);bootRecovery.controller?.abort();
  Object.assign(bootRecovery,{attempt:0,phase,timer:null,timeout:null,controller:null,resumeOnRestore:false});
}
function bootRecoveryVisible(){return !document.hidden&&(!moduleBase||window.parent===window||moduleVisible);}
function scheduleBootRecovery(delay){
  clearTimeout(bootRecovery.timer);bootRecovery.timer=null;
  if(bootRecovery.phase!=='waiting'||!bootRecoveryVisible())return;
  const generation=bootRecovery.generation;
  bootRecovery.timer=setTimeout(()=>{bootRecovery.timer=null;if(generation===bootRecovery.generation&&bootRecovery.phase==='waiting'&&bootRecoveryVisible())void boot();},delay);
}
function resumeBootRecovery(){if(bootRecovery.phase==='waiting'&&bootRecoveryVisible())scheduleBootRecovery(0);}
async function boot(){
  if(bootRecovery.phase==='loading'||bootRecovery.phase==='closed')return;
  clearTimeout(bootRecovery.timer);bootRecovery.timer=null;
  if(bootRecovery.attempt||bootRecovery.phase==='failed')app.innerHTML='<div class="boot"><span class="spinner"></span><p role="status">메신저에 다시 연결하고 있어요.</p></div>';
  moduleReady=false;bootRecovery.phase='loading';
  const generation=++bootRecovery.generation,controller=new AbortController();bootRecovery.controller=controller;
  const deadline=new Promise((_,reject)=>{bootRecovery.timeout=setTimeout(()=>{const error=Object.assign(new Error('응답이 늦어 자동으로 다시 연결할게요.'),{name:'TimeoutError'});controller.abort(error);reject(error);},10000);});
  try {
    const data=await Promise.race([api('/api/bootstrap',{signal:controller.signal}),deadline]);
    if(generation!==bootRecovery.generation)return;
    stopBootRecovery();state.platformUrl=data.platformUrl||null;state.needsSetup=data.needsSetup;state.workspace=data.workspace;state.storage=data.storage||{provider:'local'};state.integrated=data.integrated||null;
    if(data.user)enterWorkspace(data);else renderAuth(data.needsSetup?'setup':'login');
  }catch(error){
    if(generation!==bootRecovery.generation)return;
    clearTimeout(bootRecovery.timeout);bootRecovery.timeout=null;bootRecovery.controller=null;
    const transient=error.name==='TimeoutError'||(!error.status&&error.name==='TypeError')||error.status===429||error.status>=500&&error.status<=599;
    bootRecovery.phase=transient?'waiting':'failed';if(transient)bootRecovery.attempt++;
    const delay=Math.min(30000,2000*2**Math.min(bootRecovery.attempt-1,4));
    app.innerHTML=`<div class="boot"><div class="page-error"><h2>${transient?'잠시 연결을 기다리고 있어요':'메신저에 연결하지 못했어요'}</h2><p class="muted" role="status">${transient?`${delay/1000}초 뒤 자동으로 다시 연결할게요.`:'로그인 상태와 접근 권한을 확인해 주세요.'}</p><p class="tiny muted">${esc(error.message)}</p><button class="button primary" id="retry-boot">지금 다시 연결</button></div></div>`;
    $('#retry-boot').onclick=()=>void boot();announceWorkspaceReady();if(transient)scheduleBootRecovery(delay);
  }
}
function renderAuth(mode='login'){
  stopBootRecovery();
  voice?.dispose('auth');resetTransfers();
  resetWorkNotificationState();
  if(moduleBase){returnToCompanyLogin();return;}
  const setup=mode==='setup',join=mode==='join';
  const title=setup?'우리 팀의 첫 공간 만들기':join?'팀에 함께하기':'다시 만나서 반가워요';
  const subtitle=setup?'첫 관리자 계정을 만들고 우리 팀의 공간을 시작하세요.':join?'관리자에게 받은 초대 코드로 계정을 만들 수 있어요.':`${state.workspace?.name || '우리 팀'}의 대화를 이어가세요.`;
  app.innerHTML=`<main class="auth-page"><header class="auth-brand"><img class="brand-logo" src="assets/synk-ko.svg" alt="싱ㅋ"><span>팀 메신저</span></header><div class="auth-layout"><section class="auth-story"><img class="auth-wordmark" src="assets/synk-ko.svg" alt="싱ㅋ"><div class="auth-story-copy"><h1>우리 팀의 대화,<br>한곳에서.</h1><p>이야기를 나누고, 파일을 공유하고.<br>함께 일하는 데 필요한 것만 담았어요.</p></div><div class="auth-points"><span>${icon('chat')}채널과 1:1 대화</span><span>${icon('attach')}파일 공유</span><span>${icon('lock')}초대 전용 공간</span></div></section><section class="auth-card" aria-labelledby="auth-title"><div class="card-eyebrow">${setup?'처음 시작하기':join?'초대받은 공간':'로그인'}</div><h2 id="auth-title">${title}</h2><p class="intro">${esc(subtitle)}</p><form id="auth-form">${setup?'<label class="field"><span>팀 이름</span><input id="workspace-name" name="workspaceName" value="SYNK" required maxlength="60" autocomplete="organization"></label>':''}${join?'<label class="field"><span>초대 코드</span><input id="invite-code" name="code" placeholder="전달받은 코드를 입력하세요" required autocomplete="off" spellcheck="false"></label>':''}${setup||join?'<label class="field"><span>표시 이름</span><input id="display-name" name="name" placeholder="팀에서 부를 이름" required maxlength="40" autocomplete="name"></label>':''}<label class="field"><span>아이디</span><input id="username" name="username" required minlength="3" maxlength="32" pattern="[a-zA-Z0-9_.\\-]{3,32}" placeholder="영문, 숫자 등 3자 이상" autocomplete="username" autocapitalize="none" spellcheck="false"></label><label class="field"><span>비밀번호</span><input id="password" name="password" type="password" required ${setup||join?'minlength="10"':''} maxlength="128" placeholder="${setup||join?'10자 이상으로 만들어 주세요':'비밀번호를 입력하세요'}" autocomplete="${setup||join?'new-password':'current-password'}">${setup||join?'<small>이 비밀번호로 로그인해요. 잊지 않도록 보관해 주세요.</small>':''}</label><div id="auth-error" class="form-error hidden" role="alert"></div><button class="button primary submit-auth" id="auth-submit" type="submit">${setup?'내 공간 시작하기':join?'가입하고 시작하기':'로그인'}${icon('arrow')}</button></form>${!setup?`<div class="auth-links"><span>${join?'이미 계정이 있나요?':'초대 코드를 받았나요?'}</span><button class="text-button" id="switch-auth">${join?'로그인':'초대로 가입'}</button></div>`:''}</section></div><footer class="auth-footer"><span>${icon('globe')} 이 PC에서 사용하는 개인 테스트 공간</span><span>${storageSentence()}</span></footer></main>`;
  if(state.platformUrl)$('.auth-brand').insertAdjacentHTML('beforeend',platformEntry());
  $('#auth-form').onsubmit=async event=>{event.preventDefault();const submit=$('#auth-submit');const errorBox=$('#auth-error');errorBox.classList.add('hidden');submit.disabled=true;try{const data=await api(`/api/${setup?'setup':join?'join':'login'}`,{method:'POST',body:Object.fromEntries(new FormData(event.currentTarget))});enterWorkspace(data);}catch(error){errorBox.textContent=error.message;errorBox.classList.remove('hidden');submit.disabled=false;}};
  $('#switch-auth')?.addEventListener('click',()=>renderAuth(join?'login':'join'));
  announceWorkspaceReady();
}
function enterWorkspace(data){
  stopBootRecovery();
  resetTransfers();state.sendRecovery={messages:data.sendRecovery?.messages===true,uploads:data.sendRecovery?.uploads===true};
  resetWorkNotificationState();setWorkNotificationStatus(data.scheduledNotifications?.enabled);
  document.body.classList.toggle('integrated-module',Boolean(data.integrated));
  document.body.classList.toggle('viewer-mode',data.integrated?.canWrite===false);
  Object.assign(state,{platformUrl:data.platformUrl||null,user:data.user,workspace:data.workspace,storage:data.storage||{provider:'local'},integrated:data.integrated||null,channels:data.channels,members:data.members,teams:data.teams||[],fileBytes:data.limits?.fileBytes || 104857600,channelId:null,mode:'chat',messages:[],drawer:null,needsSetup:false,navFilter:'all',roomQuery:'',replyTarget:null,thread:null,pins:[],sharedFiles:[],directoryQuery:'',directoryTeam:'all'});
  Object.assign(state,{chatCategory:'personal',categoryFilters:{personal:'all',team:'all',all:'all'},categoryChannels:{},navigationSeq:state.navigationSeq+1,unavailableChannels:new Set(),deletingChannels:new Set(),leavingChannels:new Set(),restoringChannels:new Set()});
  renderShell();void voiceController()?.init(data);
  let last;try{last=localStorage.getItem(`synk-messenger:last:${state.user.id}`);}catch{}
  const channel=state.channels.find(c=>c.id===last)||state.channels.find(c=>c.kind==='self')||state.channels[0];
  const initialMessages=channel?selectChannel(channel.id):clearChannelSelection();
  // The shell and its message loader are usable before history/read receipts
  // finish. Keeping the parent hidden until those requests settle looks blank.
  announceWorkspaceReady();
  const user=state.user;
  // Invitations and live updates must not wait for history or read receipts.
  connectEvents();
  Promise.resolve(initialMessages).catch(error=>{if(state.user===user)toast(error.message,true);});
}
function renderShell(){
  app.innerHTML=`<div class="shell"><button class="mobile-scrim" id="mobile-scrim" aria-label="메뉴 닫기"></button><aside class="sidebar" id="sidebar"><div class="sidebar-brand"><img class="brand-logo" src="assets/synk-ko.svg" alt="싱ㅋ"><span class="brand-context">팀 메신저</span></div><div class="workspace-card"><span class="workspace-symbol">${esc(initials(state.workspace.name).slice(0,1))}</span><div class="workspace-info"><strong>${esc(state.workspace.name)}</strong><span>워크스페이스</span></div>${icon('lock')}</div><button class="sidebar-search" id="global-search">${icon('search')}<span>대화 검색</span><kbd>Ctrl K</kbd></button><nav class="sidebar-scroll" aria-label="대화 목록"><section class="nav-section"><div class="section-label">내 공간</div><div id="self-nav"></div></section><section class="nav-section"><div class="section-label">채널<button class="icon-button small" id="create-channel" aria-label="채널 만들기">${icon('plus')}</button></div><div id="channel-nav"></div></section><section class="nav-section"><div class="section-label">다이렉트 메시지<button class="icon-button small" id="new-dm" aria-label="새 다이렉트 메시지">${icon('plus')}</button></div><div id="dm-nav"></div></section></nav><div class="sidebar-bottom"><div id="connection" class="connection offline"><span class="dot"></span><span>실시간 연결 중</span></div><button class="profile-button" id="workspace-settings">${avatar(state.user)}<span><strong>${esc(state.user.name)}</strong><small>${state.user.role==='owner'?'워크스페이스 관리자':'팀 멤버'}</small></span>${icon('settings')}</button></div></aside><main class="main"><header class="main-header"><button class="icon-button mobile-menu" id="mobile-menu" aria-label="대화 목록 열기">${icon('menu')}</button><div class="header-title"><div class="header-breadcrumb"><span>${esc(state.workspace.name)}</span>${icon('chevron')}<span id="breadcrumb-type">채널</span></div><h1 id="channel-title"></h1></div><div class="header-actions"><button class="member-count" id="channel-members" aria-label="팀 멤버 보기">${icon('users')}<span id="member-number"></span></button><button class="icon-button" id="channel-search" aria-label="이 대화 검색">${icon('search')}</button></div></header><div class="channel-bar"><button class="tab-button active" id="tab-chat">${icon('chat')}대화</button><button class="tab-button" id="tab-files">${icon('folder')}공유한 파일</button><span class="channel-about" id="channel-about"></span></div><div class="content-body"><section class="chat-area" id="chat-area" aria-label="대화"><div class="message-scroll" id="message-scroll"><div id="message-list"></div></div><button class="jump-latest hidden" id="jump-latest">${icon('down')}최근 메시지</button><div class="composer-wrap"><form class="composer" id="composer-form"><div class="upload-queue hidden" id="upload-queue"></div><textarea id="composer-input" aria-label="메시지 입력" rows="2" maxlength="8000" placeholder="메시지를 남겨 보세요"></textarea><div class="composer-bottom"><button class="icon-button" type="button" id="attach-file" aria-label="파일 첨부">${icon('plus')}</button><button class="icon-button" type="button" id="composer-emoji" aria-label="이모지 넣기">${icon('smile')}</button><span class="composer-hint">Enter로 전송 · Shift + Enter로 줄바꿈</span><button class="send-button" type="submit" id="send-message" aria-label="메시지 보내기" disabled>${icon('send')}</button></div><input id="file-input" class="hidden" type="file" multiple></form><div class="composer-footnote"><span id="composer-status">파일을 이곳에 끌어다 놓아도 좋아요.</span><span id="composer-storage">${uploadDestination()} · 파일당 최대 ${bytes(state.fileBytes)}</span></div></div><div class="drop-overlay hidden" id="drop-overlay">${icon('upload')}<strong>이 대화에 파일 놓기</strong><span>한 번에 5개 · 파일당 최대 ${bytes(state.fileBytes)}</span></div></section><section class="files-view hidden" id="files-view" aria-label="공유한 파일"></section><aside class="drawer hidden" id="drawer"></aside></div></main></div>`;
  enhanceConversationShell();
  installMessengerDesign();
  renderNavigation();
  syncSidebarAccess();
  applyIntegratedUI();
  $('#sidebar').onclick=handleSidebarAction;
  $('#mobile-menu').onclick=()=>setMobileMenu(true);$('#mobile-scrim').onclick=()=>setMobileMenu(false);
  $('#create-channel').onclick=createChannelDialog;$('#channel-members').onclick=focusDirectory;
  $('#global-search').onclick=()=>openDrawer('search',false);
  $('#workspace-settings').onclick=settingsDialog;$('#invite-button')?.addEventListener('click',inviteDialog);
  $('#tab-chat').onclick=()=>setMode('chat');$('#tab-files').onclick=()=>setMode('files');
  $('#composer-form').onsubmit=sendMessage;
  $('#composer-input').addEventListener('input',()=>{saveDraft();resizeComposer();updateSend();updateMentionPicker();});
  $('#composer-input').addEventListener('compositionstart',()=>composition=true);$('#composer-input').addEventListener('compositionend',()=>{composition=false;updateMentionPicker();});
  $('#composer-input').addEventListener('keydown',event=>{if(mentionKeyboard(event))return;if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!composition&&event.keyCode!==229){event.preventDefault();if(!$('#send-message').disabled)$('#composer-form').requestSubmit();}});
  $('#attach-file').onclick=()=>$('#file-input').click();$('#file-input').onchange=event=>{addFiles([...event.target.files]);event.target.value='';};
  $('#composer-emoji').onclick=()=>reactionDialog(null);
  $('#upload-queue').onclick=event=>{const retry=event.target.closest('[data-upload-retry]');if(retry)return retryUpload(retry.dataset.uploadRetry);const btn=event.target.closest('[data-upload-remove]');if(btn)removeUpload(btn.dataset.uploadRemove);};
  $('#message-list').onclick=handleMessageAction;
  $('#jump-latest').onclick=()=>scrollToBottom();
  $('#message-scroll').onscroll=()=>{const box=$('#message-scroll');$('#jump-latest').classList.toggle('hidden',box.scrollHeight-box.scrollTop-box.clientHeight<200);};
  const area=$('#chat-area');area.addEventListener('dragenter',event=>{if(canPostToChannel()&&[...event.dataTransfer.types].includes('Files')){event.preventDefault();dragDepth++;$('#drop-overlay').classList.remove('hidden');}});area.addEventListener('dragover',event=>{if(canPostToChannel()&&[...event.dataTransfer.types].includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});area.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#drop-overlay').classList.add('hidden');});area.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;$('#drop-overlay').classList.add('hidden');addFiles([...event.dataTransfer.files]);});
}
function syncSidebarAccess(){
  const sidebar=$('#sidebar');if(!sidebar)return;
  const mobile=mobileLayout.matches,open=mobile&&sidebar.classList.contains('open');
  const main=$('.main');
  if(mobile&&!open&&sidebar.contains(document.activeElement)){if(main)main.inert=false;$('#mobile-menu')?.focus({preventScroll:true});}
  sidebar.inert=mobile&&!open;
  if(mobile&&!open)sidebar.setAttribute('aria-hidden','true');else sidebar.removeAttribute('aria-hidden');
  if(main)main.inert=open;
  $('#mobile-menu')?.setAttribute('aria-expanded',String(open));
  $('#mobile-menu')?.setAttribute('aria-controls','sidebar');
}
function setMobileMenu(open,{restoreFocus=true}={}){
  const sidebar=$('#sidebar');if(!sidebar)return;
  const wasOpen=sidebar.classList.contains('open');
  open=Boolean(open&&mobileLayout.matches);
  if(open&&!wasOpen)sidebarReturnFocus=document.activeElement;
  sidebar.classList.toggle('open',open);$('#mobile-scrim')?.classList.toggle('open',open);syncSidebarAccess();
  if(!open)sidebar.classList.remove('directory-focus');
  if(open&&!wasOpen)$('#global-search')?.focus({preventScroll:true});
  else if(wasOpen&&restoreFocus){const target=sidebarReturnFocus?.isConnected?sidebarReturnFocus:$('#mobile-menu');if(target&&!target.closest('[inert]'))target.focus({preventScroll:true});}
  if(wasOpen&&!open&&state.messages.length)markRead(state.channelId);
}
mobileLayout.addEventListener('change',()=>{setMobileMenu(false,{restoreFocus:false});syncSidebarAccess();});
directoryWide.addEventListener('change',()=>{applyDirectoryLayout();syncDrawerAccess();});
function matchesRoomQuery(room){
  const query=state.roomQuery?.trim().toLocaleLowerCase();if(!query)return true;
  const person=room.kind==='dm'?state.members.find(member=>member.id!==state.user.id&&room.memberIds?.includes(member.id)):null;
  return [room.name,room.description,systemRoomMeta[room.systemKey]?.description,person?.name,person?.teamName].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
}
function conversationNavItem(channel){
  const person=channel.kind==='dm'?state.members.find(m=>channel.memberIds.includes(m.id)&&m.id!==state.user.id):null,room=systemRoomMeta[channel.systemKey];
  const detail=room?.description||(channel.kind==='self'?'메모 · 아이디어 · 파일':person?.teamName||channel.description||(channel.scope==='team'?'우리 팀의 업무 대화':isProject(channel)?'프로젝트 함께 진행하기':'함께 나누는 이야기'));
  const symbol=person?avatar(person):`<span class="room-symbol" data-room-kind="${esc(channel.systemKey||(channel.kind==='self'?'self':channel.scope==='team'?'team':'project'))}">${icon(channel.scope==='team'?'users':channelIcon(channel))}</span>`;
  const button=`<button class="nav-item${room?' system-room':''}${channel.id===state.channelId?' active':''}" data-channel="${esc(channel.id)}" ${room?`data-system-key="${esc(channel.systemKey)}"`:''} ${channel.id===state.channelId?'aria-current="page"':''}>${symbol}<span class="nav-name"><strong>${esc(channel.name)}</strong><small>${esc(detail)}</small></span>${isProject(channel)&&channel.scope==='private'?`<span class="project-private-mark" aria-label="선택한 크루만 참여">${icon('lock')}</span>`:''}${channel.unread?`<span class="unread" aria-label="안 읽은 메시지 ${channel.unread}개">${channel.unread>99?'99+':channel.unread}</span>`:''}${channel.kind==='self'?'<span class="tiny muted">나</span>':''}</button>`;
  return isProject(channel)?`<div class="project-nav-row${channel.id===state.channelId?' active':''}">${button}${canLeaveProject(channel)?`<button type="button" class="project-leave-button" data-project-leave="${esc(channel.id)}" title="${esc(channel.name)} 대화방 나가기" aria-label="${esc(channel.name)} 대화방 나가기">${icon('close')}</button>`:''}</div>`:button;
}
function handleSidebarAction(event){
  const leave=event.target.closest('[data-project-leave]');if(leave){event.preventDefault();event.stopPropagation();leaveProjectDialog(leave.dataset.projectLeave);return;}
  const button=event.target.closest('[data-channel]');if(button)selectChannel(button.dataset.channel);const team=event.target.closest('[data-team-open]');if(team)openTeamConversation(team.dataset.teamOpen,team);if(event.target.closest('[data-team-manage]'))inviteDialog();
}
function renderNavigation(){
  if(!state.user||!$('#channel-nav'))return;
  const focusedChannel=document.activeElement?.closest('[data-channel]')?.dataset.channel,focusedLeave=document.activeElement?.closest('[data-project-leave]')?.dataset.projectLeave;
  const item=conversationNavItem;
  const categoryChannels=state.channels.filter(c=>channelCategory(c)===state.chatCategory);
  const shown=categoryChannels.filter(c=>(state.navFilter!=='unread'||c.unread>0)&&matchesRoomQuery(c));
  const groups=conversationGroups(shown);
  $('#self-nav').innerHTML=groups.personal.filter(c=>c.kind==='self').map(item).join('');
  const publicRooms=groups.public.filter(channel=>channel.category!=='project'),projects=groups.public.filter(channel=>channel.category==='project');
  $('#channel-nav').innerHTML=sortedPublicChannels(publicRooms).map(item).join('')+(projects.length?'<div class="project-nav-heading">프로젝트</div>'+projects.map(item).join(''):'')||(state.navFilter==='all'?'<p class="sidebar-hint">참여 중인 대화방이 없어요.</p>':'');
  const unopened=state.teams.filter(team=>team.canOpen&&!state.channels.some(channel=>channel.scope==='team'&&channel.teamId===team.id)&&matchesRoomQuery(team));
  $('#team-nav').innerHTML=groups.team.map(item).join('')+(state.navFilter==='all'?unopened.map(team=>canWriteMessages()?`<button class="nav-item team-open" data-team-open="${esc(team.id)}">${icon('users')}<span class="nav-name">${esc(team.name)}</span>${icon('plus')}</button>`:`<p class="sidebar-hint">${esc(team.name)} 대화방은<br>팀원이 개설하면 표시돼요.</p>`).join(''):'');
  if(state.navFilter==='all'&&!groups.team.length&&!unopened.length)$('#team-nav').innerHTML=`<p class="sidebar-hint team-empty">${state.user.teamId?'소속 팀 정보를 확인하고 있어요.':'아직 배정된 팀이 없어요.'}${state.integrated?.canManage?'<button class="text-button" data-team-manage>팀 관리에서 배정하기</button>':''}</p>`;
  const dms=groups.personal.filter(c=>c.kind==='dm');$('#dm-nav').innerHTML=dms.length?dms.map(item).join(''):(state.navFilter==='all'?'<p class="sidebar-hint">크루 목록에서 개인 대화를 시작하세요.</p>':'');
  $('#create-channel').classList.toggle('hidden',!canWriteMessages());
  const unread=categoryChannels.reduce((count,c)=>count+(c.unread||0),0);
  $('#nav-unread-count').textContent=unread>99?'99+':String(unread);
  $('#nav-unread-count').classList.toggle('hidden',!unread);
  $('#unread-empty').classList.toggle('hidden',state.navFilter!=='unread'||shown.length>0||Boolean(state.roomQuery?.trim()));
  $('#room-filter-empty')?.classList.toggle('hidden',!state.roomQuery?.trim()||shown.length>0||(state.chatCategory==='team'&&unopened.length>0));
  $('#clear-room-filter')?.classList.toggle('hidden',!state.roomQuery);
  for(const section of $$('[data-chat-section]'))section.classList.toggle('hidden',section.dataset.chatSection!==state.chatCategory||(state.navFilter==='unread'&&section.dataset.chatSection!=='all'&&!section.querySelector('[data-channel]')));
  for(const button of $$('[data-chat-category]')){
    const active=button.dataset.chatCategory===state.chatCategory,count=state.channels.filter(c=>channelCategory(c)===button.dataset.chatCategory).reduce((sum,c)=>sum+(c.unread||0),0);
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    const badge=$('.category-unread',button);badge.textContent=count>99?'99+':String(count);badge.classList.toggle('hidden',!count);badge.setAttribute('aria-label',`안 읽은 메시지 ${count}개`);
  }
  $('.main')?.setAttribute('aria-labelledby',`chat-category-${state.chatCategory}`);
  $$('[data-nav-filter]').forEach(button=>{button.classList.toggle('active',button.dataset.navFilter===state.navFilter);button.setAttribute('aria-pressed',String(button.dataset.navFilter===state.navFilter));});
  $('#member-number').textContent=String(state.members.length);
  renderDirectory();
  if(focusedLeave)$(`[data-project-leave="${CSS.escape(focusedLeave)}"]`)?.focus({preventScroll:true});
  else if(focusedChannel)$(`[data-channel="${CSS.escape(focusedChannel)}"]`)?.focus({preventScroll:true});
}
async function refreshChannels(){
  const previousCanPost=canPostToChannel(),sequence=++state.channelsSeq,result=await api('/api/channels');if(sequence!==state.channelsSeq)return;
  const missing=state.channels.filter(channel=>!result.channels.some(next=>next.id===channel.id));for(const channel of missing)forgetChannelState(channel.id);
  state.channels=result.channels;for(const channel of state.channels)state.unavailableChannels.delete(channel.id);
  if(state.channelId&&!selectedConversation()){const next=state.channels.find(channel=>channelCategory(channel)===state.chatCategory);if(next)await selectChannel(next.id,{preserveFilter:true});else clearChannelSelection();}
  renderNavigation();syncChannelHeader();syncComposerAccess();refreshProjectPicker();
  if(!selectedConversation())renderEmptyChannel();else if(previousCanPost!==canPostToChannel())renderMessages({preserve:true});
  if(missing.length||previousCanPost!==canPostToChannel()){await refreshDetailViews();if(state.drawer==='search')await runSearch();}
  parentMessage('messenger:unread');
}
function syncChannelHeader(){
  const channel=selectedConversation();syncProjectParticipation();voice?.syncChannel(channel?.id||null);if(!$('#channel-title'))return;
  if(!channel){$('#channel-title').textContent=categoryLabel();$('#breadcrumb-type').textContent=categoryLabel();$('#channel-about').textContent='대화방을 선택해 주세요';$('#channel-options')?.classList.add('hidden');return;}
  $('#channel-title').innerHTML=`${icon(channelIcon(channel))}<span>${esc(channel.name)}</span>${canLeaveProject(channel)?`<button type="button" class="project-leave-button current-project-leave" id="current-project-leave" title="${esc(channel.name)} 대화방 나가기" aria-label="${esc(channel.name)} 대화방 나가기">${icon('close')}</button>`:''}`;
  $('#current-project-leave')?.addEventListener('click',()=>leaveProjectDialog(channel.id));
  $('#breadcrumb-type').textContent=categoryLabel();
  $('#channel-about').textContent=systemRoomMeta[channel.systemKey]?.description||channel.description||(channel.kind==='self'?'나만 볼 수 있는 대화':'함께 이야기를 나누는 곳');
  $('#channel-options')?.classList.toggle('hidden',channel.kind!=='channel'||!channel.canManage||!canWriteMessages());
}
function conversationGroups(channels){return{public:channels.filter(channel=>channel.kind==='channel'&&channel.scope!=='team'),team:channels.filter(channel=>channel.kind==='channel'&&channel.scope==='team'),personal:channels.filter(channel=>channel.kind==='dm'||channel.kind==='self')};}
function syncComposerAccess(){
  const channel=selectedConversation(),selected=Boolean(channel),writable=canPostToChannel(channel),box=$('#composer-input');
  const notice=state.leavingChannels.has(channel?.id)?'대화방에서 나가는 중이에요.':state.deletingChannels.has(channel?.id)?'대화방을 삭제하는 중이에요.':selected&&!writable?(channel.systemKey==='announcements'?'공지는 관리자만 작성할 수 있어요. 내용을 확인하거나 파일을 내려받을 수 있어요.':'조회 전용 계정입니다. 대화와 공유된 파일을 확인할 수 있어요.') : '';
  if(box){box.disabled=!selected;box.readOnly=!writable;box.setAttribute('aria-label',!selected?'메시지 입력 · 대화방을 선택해 주세요':!writable?'메시지 입력 · 조회 전용':'메시지 입력');box.placeholder=!selected?'대화방을 선택한 뒤 메시지를 보내세요':!writable?(channel.systemKey==='announcements'?'관리자만 공지를 작성할 수 있어요':'조회 전용 계정입니다.'):channel.kind==='self'?'메모, 아이디어, 보관할 파일을 남겨 보세요':`${channel.name}에 메시지 보내기`;}
  const noticeBox=$('#channel-write-notice');if(noticeBox){noticeBox.textContent=notice;noticeBox.classList.toggle('hidden',!notice);}
  for(const selector of ['#attach-file','#composer-emoji','#composer-mention','#file-input']){const button=$(selector);if(button)button.disabled=!writable;}
  for(const selector of ['#channel-search','#channel-notifications','#tab-files','#tab-pins']){const button=$(selector);if(button)button.disabled=!selected;}
  $('.main')?.classList.toggle('no-conversation',!selected);$('.main')?.classList.toggle('channel-readonly',selected&&!writable);if(!writable)closeMentionPicker();renderComposeExtras();updateSend();
}
function renderEmptyChannel(){
  const list=$('#message-list');if(!list)return;
  const category=state.chatCategory,teams=state.teams.filter(team=>team.canOpen),rooms=state.channels.filter(channel=>channelCategory(channel)===category);
  let title='대화방을 선택해 주세요',copy='대화 목록에서 이야기를 나눌 곳을 선택하세요.';
  if(!rooms.length&&category==='personal'){title='개인 대화를 시작하세요';copy='크루 목록에서 이름을 누르면 둘만의 대화가 열려요.';}
  if(!rooms.length&&category==='all'){title='아직 전체 대화방이 없어요';copy=canWriteMessages()?'대화 목록의 새 대화방에서 공용 대화나 프로젝트를 시작하세요.':'회사 구성원이 대화방을 개설하면 여기에 표시돼요.';}
  if(!rooms.length&&category==='team'){
    title=teams.length?'팀 대화를 시작하세요':'아직 소속 팀 대화방이 없어요';copy=teams.length?(canWriteMessages()?'대화 목록에서 소속 팀을 선택해 시작하세요.':'소속 팀의 크루가 대화방을 개설하면 여기에 표시돼요.'):'팀 배정 후 소속 팀의 대화를 시작할 수 있어요.';
  }
  list.classList.add('empty');list.innerHTML=`<section class="category-empty" aria-live="polite"><span class="category-empty-icon">${icon(chatCategories.find(([key])=>key===category)?.[2]||'chat')}</span><h2>${title}</h2><p>${copy}</p></section>`;
}
function clearChannelSelection(){
  saveDraft();state.navigationSeq++;state.directSequence=(state.directSequence||0)+1;
  state.channelId=null;state.messages=[];state.hasMore=false;state.replyTarget=null;state.mentionIds=[];state.workspaceLink=null;state.ackRequired=false;closeMentionPicker();renderComposeExtras();state.pins=[];state.sharedFiles=[];
  state.loadSeq++;state.refreshSeq++;state.filesSeq++;state.pinsSeq++;state.threadSeq++;state.searchSeq++;clearTimeout(state.fileSearchTimer);
  closeDrawer();setMode('chat');const box=$('#composer-input');if(box){box.value='';box.placeholder='대화방을 선택한 뒤 메시지를 보내세요';resizeComposer();}
  renderReplyContext();renderQueue();renderNavigation();syncChannelHeader();syncComposerAccess();renderEmptyChannel();$('#jump-latest')?.classList.add('hidden');
}
async function selectChatCategory(category){
  if(!chatCategories.some(([key])=>key===category))return;
  state.navigationSeq++;state.directSequence=(state.directSequence||0)+1;
  if(state.chatCategory===category){setMobileMenu(false);return;}
  saveDraft();state.categoryFilters[state.chatCategory]=state.navFilter;
  if(selectedConversation())state.categoryChannels[state.chatCategory]=state.channelId;
  state.chatCategory=category;state.navFilter=state.categoryFilters[category]||'all';$('#sidebar')?.classList.remove('directory-focus');
  const available=state.channels.filter(channel=>channelCategory(channel)===category),channels=category==='all'?sortedPublicChannels(available):available,next=channels.find(channel=>channel.id===state.categoryChannels[category])||channels[0];
  if(next)await selectChannel(next.id,{preserveFilter:true});else{clearChannelSelection();setMobileMenu(false);}
}
async function selectChannel(channelId, {keepDrawer=false,preserveFilter=false} = {}){
  const target=state.channels.find(c=>c.id===channelId);if(!target)return;
  state.roomQuery='';if($('#room-filter'))$('#room-filter').value='';
  saveDraft();state.navigationSeq++;state.directSequence=(state.directSequence||0)+1;state.categoryFilters[state.chatCategory]=state.navFilter;state.chatCategory=channelCategory(target);state.navFilter=preserveFilter?(state.categoryFilters[state.chatCategory]||'all'):'all';state.categoryFilters[state.chatCategory]=state.navFilter;state.categoryChannels[state.chatCategory]=channelId;
  state.channelId=channelId;state.messages=[];state.hasMore=false;state.mode='chat';state.loadSeq++;state.refreshSeq++;state.filesSeq++;state.pinsSeq++;const seq=state.loadSeq;
  state.fileQuery='';state.fileType='all';state.fileScope='channel';state.sharedFiles=[];state.pins=[];restoreReply();restoreComposeExtras();renderReplyContext();
  setMobileMenu(false);if(!keepDrawer)closeDrawer();
  try{localStorage.setItem(`synk-messenger:last:${state.user.id}`,channelId);}catch{}
  renderNavigation();const channel=currentChannel();syncChannelHeader();
  $('#composer-input').value=readDraft();$('#composer-input').placeholder=channel.kind==='self'?'메모, 아이디어, 보관할 파일을 남겨 보세요':`${channel.name}에 메시지 보내기`;resizeComposer();renderQueue();updateSend();setMode('chat');if(!canWriteMessages())$('#composer-input').placeholder='조회 전용 계정입니다.';
  syncComposerAccess();
  $('#channel-options')?.classList.toggle('hidden',channel.kind!=='channel'||!channel.canManage||!canWriteMessages());
  $('#message-list').classList.remove('empty');$('#message-list').innerHTML='<div class="message-loading"><span class="spinner"></span>대화를 불러오고 있어요.</div>';
  // An SSE refresh can finish while this first request is pending. Only replace
  // the initial snapshot; a failed refresh still leaves it available as fallback.
  let expectedMessages=state.messages;
  try{const result=await api(`/api/channels/${id(channelId)}/messages`);if(seq!==state.loadSeq||state.messages!==expectedMessages)return;state.messages=expectedMessages=result.messages;state.hasMore=result.hasMore;renderMessages();scrollToBottom();void markRead(channelId);}catch(error){if(seq!==state.loadSeq||state.messages!==expectedMessages)return;$('#message-list').innerHTML=`<div class="large-empty"><strong>대화를 불러오지 못했어요</strong><p>${esc(error.message)}</p><button class="button" data-action="retry">다시 불러오기</button></div>`;}
}
async function markRead(channelId){
  const messageId=state.messages.at(-1)?.id;
  if(!messageId||channelId!==state.channelId||document.hidden||!moduleVisible||state.mode!=='chat'||(!directoryWide.matches&&state.drawer)||(mobileLayout.matches&&$('#sidebar')?.classList.contains('open')))return;
  try{await api(`/api/channels/${id(channelId)}/read`,{method:'POST',body:{messageId}});await refreshChannels();}catch{}
}
function introHtml(){
  const channel=currentChannel();if(!channel||state.messages.length)return '';
  const self=channel.kind==='self',title=self?'기록을 시작해 보세요':'아직 메시지가 없어요';
  const description=canPostToChannel(channel)?'메시지와 파일을 아래에 남겨 보세요.':'새 메시지가 등록되면 여기에 표시돼요.';
  return `<section class="channel-intro is-empty"><div class="intro-copy"><h2>${title}</h2><p class="intro-description">${description}</p></div><div class="intro-collage" aria-hidden="true"><div class="collage-arch"><img class="collage-mascot" src="assets/marin-smile.webp" alt="" width="960" height="1400"></div><img class="collage-sticker" src="assets/${self?'sticker-book.webp':'sticker-envelope.webp'}" alt="" width="192" height="133"><span class="collage-mark">${icon('spark')}</span></div></section>`;
}
function messageHtml(message,{panel=false}={}){
  const writable=canPostMessage(message),own=canWriteMessages()&&message.user.id===state.user.id,canDelete=canWriteMessages()&&(own||(state.user.role==='owner'&&currentChannel()?.kind==='channel'));
  const reply=message.replyTo?.deleted?null:message.replyTo;
  return `<article class="message${message.user.id===state.user.id?' is-own':''}${message.pinned?' is-pinned':''}" ${panel?'':`id="message-${esc(message.id)}"`} data-message-id="${esc(message.id)}">${avatar(message.user)}<div class="message-content"><div class="message-meta"><span class="message-name">${esc(message.user.name)}</span><time class="message-time" datetime="${esc(message.createdAt)}" title="${esc(dateLabel(message.createdAt))}">${timeLabel(message.createdAt)}</time>${message.editedAt?'<span class="edited">수정됨</span>':''}${message.pinned?`<span class="message-pinned" title="고정 메시지">${icon('pin')}고정</span>`:''}</div>${reply?`<button class="reply-preview" data-action="reply-origin"><span>${icon('reply')}${esc(reply.user?.name||'원래 메시지')}</span><p>${esc(messagePreview(reply))}</p></button>`:message.replyToId?'<p class="reply-unavailable">원래 메시지가 삭제됐어요.</p>':''}${message.body?`<div class="message-text">${textBody(message.body)}</div>`:''}${message.files?.length?`<div class="message-files">${message.files.map(fileHtml).join('')}</div>`:''}${message.reactions?.length?`<div class="reaction-list">${message.reactions.map(r=>`<button class="reaction${r.mine?' mine':''}" data-action="react" data-emoji="${esc(r.emoji)}" aria-label="${esc(r.emoji)} 반응 ${r.count}개${r.mine?', 나도 반응함':''}" aria-pressed="${r.mine}">${esc(r.emoji)}<span>${r.count}</span></button>`).join('')}</div>`:''}${messageProductivityHtml(message)}${message.replyCount?`<button class="thread-link" data-action="thread">${icon('reply')}답글 ${message.replyCount}개${icon('chevron')}</button>`:''}${panel?`<button class="message-jump" data-action="jump">대화에서 보기 ${icon('arrow')}</button>`:''}</div><div class="message-tools">${messageProductivityTools(message)}${writable?`<button class="icon-button" data-action="reply" aria-label="답글 쓰기">${icon('reply')}</button><button class="icon-button" data-action="pin" aria-label="${message.pinned?'메시지 고정 해제':'메시지 고정'}" aria-pressed="${Boolean(message.pinned)}">${icon('pin')}</button>`:''}${canWriteMessages()?`<button class="icon-button reaction-add" data-action="reaction-picker" aria-label="메시지에 반응">${icon('smile')}</button>`:''}${own&&writable?`<button class="icon-button" data-action="edit" aria-label="메시지 수정">${icon('edit')}</button>`:''}${canDelete?`<button class="icon-button" data-action="delete" aria-label="메시지 삭제">${icon('trash')}</button>`:''}<button type="button" class="icon-button message-more" data-action="message-more" aria-label="추가 메시지 작업" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button></div></article>`;
}
function fileHtml(file){return `<a class="file-card" href="${esc(file.url || moduleUrl(`/api/files/${id(file.id)}`))}" download="${esc(file.name)}"><span class="file-icon">${icon('file')}</span><span class="file-details"><span class="file-name" title="${esc(file.name)}">${esc(file.name)}</span><span class="file-meta">${bytes(file.size)} · ${shortDate(file.createdAt)}${file.storageProvider==='google-drive'?`<span class="file-cloud" aria-label="Google Drive에 보관">${icon('cloud')}Drive</span>`:''}</span></span>${icon('download')}</a>`;}
function renderMessages({preserve=false}={}){
  if(!selectedConversation()){renderEmptyChannel();return;}
  const focused=document.activeElement;
  const focusedAction=focused?.closest('#message-list [data-action]');
  const focusKey=focusedAction?{messageId:focusedAction.closest('[data-message-id]')?.dataset.messageId,action:focusedAction.dataset.action,emoji:focusedAction.dataset.emoji}:null;
  const focusedFile=focused?.closest('#message-list .file-card')?.getAttribute('href');
  const scroller=$('#message-scroll');if(!scroller)return;const oldHeight=scroller.scrollHeight,oldTop=scroller.scrollTop,atBottom=oldHeight-oldTop-scroller.clientHeight<160;
  let lastDate='';let html=state.hasMore?'<button class="load-earlier" data-action="earlier">이전 대화 불러오기</button>':introHtml();

  for(const message of state.messages){const day=new Date(message.createdAt).toDateString();if(day!==lastDate){html+=`<div class="date-separator">${dateLabel(message.createdAt)}</div>`;lastDate=day;}html+=messageHtml(message);}
  $('#message-list').classList.toggle('empty',!state.messages.length&&!state.hasMore);
  $('#message-list').innerHTML=html;
  if(preserve&&!atBottom)scroller.scrollTop=oldTop;else if(preserve)scrollToBottom();
  if(focusKey){const scope=focusKey.messageId?document.getElementById(`message-${focusKey.messageId}`):$('#message-list');scope?.querySelector(`[data-action="${CSS.escape(focusKey.action)}"]${focusKey.emoji?`[data-emoji="${CSS.escape(focusKey.emoji)}"]`:''}`)?.focus({preventScroll:true});}
  else if(focusedFile)$('#message-list')?.querySelector(`.file-card[href="${CSS.escape(focusedFile)}"]`)?.focus({preventScroll:true});
}
function scrollToBottom(){const scroller=$('#message-scroll');if(scroller)scroller.scrollTop=state.messages.length?scroller.scrollHeight:0;$('#jump-latest')?.classList.add('hidden');}
async function refreshMessages(){
  const channelId=state.channelId,seq=state.loadSeq,refresh=++state.refreshSeq,target=Math.max(50,state.messages.length);
  if(!channelId)return;
  let result=await api(`/api/channels/${id(channelId)}/messages?limit=100`),messages=result.messages;
  // Reconcile loaded history too, including edits or deletions in older pages.
  while(result.hasMore&&messages.length<target&&messages.length){
    result=await api(`/api/channels/${id(channelId)}/messages?limit=100&before=${id(messages[0].id)}`);
    messages=[...result.messages,...messages];
  }
  if(seq!==state.loadSeq||refresh!==state.refreshSeq)return;
  state.messages=messages;state.hasMore=result.hasMore;renderMessages({preserve:true});void markRead(channelId);
}
async function loadEarlier(button){if(!state.messages.length)return;button.disabled=true;const seq=state.loadSeq,box=$('#message-scroll'),oldHeight=box.scrollHeight;try{const result=await api(`/api/channels/${id(state.channelId)}/messages?before=${id(state.messages[0].id)}`);if(seq!==state.loadSeq)return;state.messages=[...result.messages,...state.messages];state.hasMore=result.hasMore;renderMessages();box.scrollTop=box.scrollHeight-oldHeight;}catch(error){toast(error.message,true);button.disabled=false;}}
function resizeComposer(){const box=$('#composer-input');if(!box)return;box.style.height='auto';box.style.height=`${Math.min(box.scrollHeight,190)}px`;}
function transferContext(){return{userId:state.user?.id,session:state.transferSession};}
function transferContextCurrent(context){return Boolean(context.userId&&context.userId===state.user?.id&&context.session===state.transferSession);}
function resetTransfers(){
  state.transferSession++;state.sending=false;state.sendAttempts.clear();
  for(const uploads of state.queues.values())for(const upload of uploads){upload.cancelled=true;upload.rawFile=null;upload.xhr?.abort();}
  state.queues.clear();
}
function sendAttemptKey(channelId,userId=state.user?.id){return `synk-messenger:send:${userId}:${channelId}`;}
function sendAttempt(channelId=state.channelId){
  if(!channelId||!state.user||state.unavailableChannels.has(channelId))return null;
  const key=sendAttemptKey(channelId);if(state.sendAttempts.has(key))return state.sendAttempts.get(key);
  let attempt=null;try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.userId===state.user.id&&saved.channelId===channelId&&typeof saved.clientMessageId==='string'&&/^[0-9a-f-]{36}$/i.test(saved.clientMessageId)&&typeof saved.payload?.body==='string'&&Array.isArray(saved.payload.fileIds))attempt={...saved,busy:false,status:'unknown'};}catch{}
  state.sendAttempts.set(key,attempt);return attempt;
}
function persistSendAttempt(attempt){
  const {busy,status,...saved}=attempt;
  try{localStorage.setItem(sendAttemptKey(attempt.channelId,attempt.userId),JSON.stringify(saved));return true;}
  catch{return false;}
}
function forgetSendAttempt(attempt){
  const key=sendAttemptKey(attempt.channelId,attempt.userId);
  if(state.sendAttempts.get(key)===attempt)state.sendAttempts.set(key,null);
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.clientMessageId===attempt.clientMessageId)localStorage.removeItem(key);}catch{}
}
function currentComposeSnapshot(){return{body:$('#composer-input')?.value||'',replyToId:state.replyTarget?.id||null,fileIds:queue().filter(item=>item.file&&!item.cancelled).map(item=>item.file.id),...composePayload()};}
function beginTransferFocus(selector){
  const focused=document.activeElement;if(!focused?.matches?.(selector))return null;
  return{...transferContext(),channelId:state.channelId,navigation:state.navigationSeq,revision:state.transferFocusRevision,selector};
}
function finishTransferFocus(saved){
  if(!saved||!transferContextCurrent(saved)||saved.channelId!==state.channelId||saved.navigation!==state.navigationSeq||saved.revision!==state.transferFocusRevision)return;
  const focused=document.activeElement;if(focused&&focused!==document.body&&focused!==document.documentElement&&focused.isConnected!==false)return;
  const action=document.querySelector(saved.selector),target=action&&!action.disabled?action:$('#composer-input');if(target&&!target.disabled)target.focus({preventScroll:true});
}
document.addEventListener('focusin',event=>{if(event.target!==document.body&&event.target!==document.documentElement)state.transferFocusRevision++;});
document.addEventListener('pointerdown',()=>{state.transferFocusRevision++;});
window.addEventListener('blur',()=>{state.transferFocusRevision++;});
document.addEventListener('keydown',event=>{if(event.key==='Tab')state.transferFocusRevision++;});
function renderSendRecovery(){
  const form=$('#composer-form');if(!form)return;
  let wrap=$('#send-recovery');if(!wrap){form.insertAdjacentHTML('afterbegin','<section id="send-recovery" class="send-recovery hidden" aria-label="메시지 전송 확인" aria-live="polite"></section>');wrap=$('#send-recovery');}if(!wrap)return;
  const focused=document.activeElement,focusAction=['data-send-check','data-send-retry','data-send-cancel'].find(action=>focused?.hasAttribute?.(action)&&wrap.contains(focused));
  const attempt=sendAttempt();wrap.classList.toggle('hidden',!attempt);if(!attempt){if(wrap.innerHTML)wrap.innerHTML='';delete wrap.dataset.recoveryContent;return;}
  const changed=JSON.stringify(currentComposeSnapshot())!==JSON.stringify(attempt.payload);
  const heading=attempt.busy?(attempt.status==='checking'?'전송 결과를 확인하고 있어요':'메시지를 보내고 있어요'):'전송 결과를 확인해 주세요';
  const preview=attempt.payload.body||`${attempt.payload.fileIds.length?`첨부파일 ${attempt.payload.fileIds.length}개`:''}${attempt.payload.workspaceLink?' 공유 카드':''}`;
  const content=`<strong>${heading}</strong><p class="send-recovery-preview">${esc(preview.slice(0,160))}${preview.length>160?'…':''}</p><p>${changed?'수정한 초안은 그대로 남겨 둘게요. 위 내용의 전송 결과를 먼저 확인하거나 전송을 취소해 주세요.':'연결이 끊겨도 이미 보내졌을 수 있어요. 같은 내용으로 다시 시도해도 한 번만 보내요.'}</p>${attempt.notice?`<p class="send-recovery-notice">${esc(attempt.notice)}</p>`:''}<div class="send-recovery-actions"><button type="button" class="button" data-send-check ${attempt.busy?'disabled':''}>전송 확인</button><button type="button" class="button primary" data-send-retry ${attempt.busy||!canPostToChannel()?'disabled':''}>같은 내용 다시 보내기</button><button type="button" class="button" data-send-cancel ${attempt.busy?'disabled':''}>전송 취소</button></div>`;
  if(wrap.dataset.recoveryContent!==content){wrap.innerHTML=content;wrap.dataset.recoveryContent=content;}
  wrap.onclick=event=>{if(event.target.closest('[data-send-check]'))checkSendAttempt();else if(event.target.closest('[data-send-retry]'))retrySendAttempt();else if(event.target.closest('[data-send-cancel]'))cancelSendAttempt();};
  const focusTarget=focusAction?wrap.querySelector(`[${focusAction}]`):null;if(focusTarget&&!focusTarget.disabled)focusTarget.focus({preventScroll:true});
}
function updateSend(){
  const box=$('#composer-input'),button=$('#send-message');if(!box||!button)return;
  const allUploads=queue(),uploads=allUploads.filter(item=>!item.cancelled),attempt=sendAttempt(),busy=Boolean(attempt?.busy);
  $$('[data-upload-remove]').forEach(item=>item.disabled=busy||Boolean(allUploads.find(file=>file.key===item.dataset.uploadRemove)?.checking)||Boolean(attempt?.payload.fileIds.includes(uploads.find(file=>file.key===item.dataset.uploadRemove)?.file?.id)));
  button.disabled=!canPostToChannel()||Boolean(attempt)||!selectedConversation()||uploads.some(f=>f.status!=='done')||(!box.value.trim()&&!uploads.length&&!state.workspaceLink);
  $('#composer-status').textContent=!selectedConversation()?'대화방을 선택한 뒤 메시지를 보낼 수 있어요.':!canPostToChannel()?'이 대화방은 읽기 전용입니다.':attempt?'앞선 메시지의 전송 결과를 확인해 주세요.':uploads.some(f=>f.status==='uploading')?'파일을 올리고 있어요. 완료 후 전송할 수 있어요.':uploads.some(f=>f.status==='error')?'실패한 파일에서 다시 시도를 눌러 주세요.':`파일을 끌어다 놓아 보세요. ${uploadDestination()}.`;
  renderSendRecovery();
}
async function sendMessage(event){
  event.preventDefault();if(!canPostToChannel()||!selectedConversation()||$('#send-message').disabled||sendAttempt())return;
  if(state.sendRecovery?.messages!==true){toast('전송 정보를 확인하지 못했어요. 새로고침한 뒤 다시 보내 주세요.',true);return;}
  saveDraft();saveReply();
  const attempt={...transferContext(),channelId:state.channelId,clientMessageId:crypto.randomUUID(),payload:currentComposeSnapshot(),savedExtras:{mentionIds:[...state.mentionIds],workspaceLink:state.workspaceLink,ackRequired:state.ackRequired},busy:false,status:'unknown'};
  if(!persistSendAttempt(attempt)){toast('전송 기록을 보관하지 못했어요. 브라우저 저장 공간을 확인한 뒤 다시 보내 주세요.',true);return;}
  state.sendAttempts.set(sendAttemptKey(attempt.channelId),attempt);await postSendAttempt(attempt);
}
function attemptCurrent(attempt,context){return transferContextCurrent(context)&&!state.unavailableChannels.has(attempt.channelId)&&state.sendAttempts.get(sendAttemptKey(attempt.channelId,attempt.userId))===attempt;}
function completeSendAttempt(attempt,result,{deleted=false}={}){
  const channelId=attempt.channelId,payload=attempt.payload,active=state.channelId===channelId;
  const uploads=state.queues.get(channelId)||[];
  const sameFiles=JSON.stringify(uploads.filter(upload=>!upload.cancelled).map(upload=>upload.file?.id||null))===JSON.stringify(payload.fileIds);
  const unchanged=active&&sameFiles&&JSON.stringify(currentComposeSnapshot())===JSON.stringify(payload);
  for(const upload of uploads)if(payload.fileIds.includes(upload.file?.id))upload.rawFile=null;
  state.queues.set(channelId,uploads.filter(upload=>!payload.fileIds.includes(upload.file?.id)));persistQueue(channelId);
  forgetSendAttempt(attempt);
  if(active){
    if(unchanged){$('#composer-input').value='';state.mentionIds=[];state.workspaceLink=null;state.ackRequired=currentChannel()?.systemKey==='announcements';clearReply();saveDraft();resizeComposer();renderComposeExtras();closeMentionPicker();}
    if(result?.message&&!state.messages.some(message=>message.id===result.message.id)){state.messages.push(result.message);state.messages.sort((a,b)=>Number(a.id)-Number(b.id));}
    renderMessages({preserve:true});renderQueue();updateSend();
  }else{
    try{const sameBody=localStorage.getItem(draftKey(channelId))===payload.body,sameExtras=localStorage.getItem(composeExtrasKey(channelId))===JSON.stringify(attempt.savedExtras),reply=JSON.parse(localStorage.getItem(replyDraftKey(channelId))||'null');if(sameBody&&sameExtras&&sameFiles&&(reply?.id||null)===payload.replyToId){localStorage.removeItem(draftKey(channelId));localStorage.removeItem(composeExtrasKey(channelId));localStorage.removeItem(replyDraftKey(channelId));}}catch{}
  }
  if(deleted)toast('앞선 메시지는 전송된 뒤 삭제됐어요. 다시 보내지 않았어요.');else if(result?.unavailable===true)toast('전송은 완료됐어요. 공유 자료를 더 이상 확인할 수 없어요.');
}
async function postSendAttempt(attempt){
  if(attempt.busy)return;const context=transferContext();if(!attemptCurrent(attempt,context))return;
  const focusReturn=beginTransferFocus('[data-send-retry]');attempt.busy=true;attempt.status='sending';attempt.notice='';state.sending=true;updateSend();
  try{
    const result=await api(`/api/channels/${id(attempt.channelId)}/messages`,{method:'POST',body:{...attempt.payload,clientMessageId:attempt.clientMessageId},recoveryContext:context});
    if(!attemptCurrent(attempt,context))return;
    if(!result.message&&!(result.status==='sent'&&result.unavailable===true))throw new Error('전송 결과를 확인하지 못했어요.');
    completeSendAttempt(attempt,result);refreshChannels().catch(()=>{});if(state.channelId===attempt.channelId)markRead(attempt.channelId).catch(()=>{});
  }catch(error){
    if(!attemptCurrent(attempt,context))return;
    if(error.code==='MESSAGE_DELETED')completeSendAttempt(attempt,null,{deleted:true});
    else if(error.code==='MESSAGE_CANCELLED'){forgetSendAttempt(attempt);toast('전송이 취소됐어요. 작성 중인 초안은 남겨 뒀어요.');}
    else{attempt.status='unknown';attempt.notice=error.code==='MESSAGE_REQUEST_CONFLICT'?'이 전송 기록의 내용을 확인할 수 없어요. 전송 확인을 눌러 주세요.':'연결을 확인한 뒤 전송 확인 또는 같은 내용 다시 보내기를 눌러 주세요.';}
  }finally{if(transferContextCurrent(context)){attempt.busy=false;state.sending=false;updateSend();finishTransferFocus(focusReturn);}}
}
async function checkSendAttempt(){
  const attempt=sendAttempt();if(!attempt||attempt.busy)return;const context=transferContext(),focusReturn=beginTransferFocus('[data-send-check]');attempt.busy=true;attempt.status='checking';attempt.notice='';updateSend();
  try{const result=await api(`/api/channels/${id(attempt.channelId)}/messages/requests/${id(attempt.clientMessageId)}`,{recoveryContext:context});if(attemptCurrent(attempt,context)){if(!result.message&&!(result.status==='sent'&&result.unavailable===true))throw new Error('전송 결과를 확인하지 못했어요.');completeSendAttempt(attempt,result);}}
  catch(error){if(attemptCurrent(attempt,context)){if(error.code==='MESSAGE_DELETED')completeSendAttempt(attempt,null,{deleted:true});else if(error.code==='MESSAGE_CANCELLED'){forgetSendAttempt(attempt);toast('전송이 취소됐어요. 작성 중인 초안은 남겨 뒀어요.');}else attempt.notice=error.status===404?'아직 전송 완료를 확인하지 못했어요. 같은 내용 다시 보내기나 전송 취소로 이어갈 수 있어요.':'전송 결과를 확인하지 못했어요. 연결이 돌아오면 다시 확인해 주세요.';}}
  finally{if(transferContextCurrent(context)){attempt.busy=false;attempt.status='unknown';updateSend();finishTransferFocus(focusReturn);}}
}
async function retrySendAttempt(){const attempt=sendAttempt();if(!attempt||attempt.busy||!canPostToChannel()||state.sendRecovery?.messages!==true)return;await postSendAttempt(attempt);}
async function cancelSendAttempt(){
  const attempt=sendAttempt();if(!attempt||attempt.busy||state.sendRecovery?.messages!==true)return;const context=transferContext(),focusReturn=beginTransferFocus('[data-send-cancel]');attempt.busy=true;attempt.status='checking';attempt.notice='';updateSend();
  try{const result=await api(`/api/channels/${id(attempt.channelId)}/messages/requests/${id(attempt.clientMessageId)}`,{method:'DELETE',recoveryContext:context});if(!attemptCurrent(attempt,context))return;if(result.status==='cancelled'){forgetSendAttempt(attempt);toast('전송이 취소됐어요. 작성 중인 초안은 남겨 뒀어요.');}else if(result.status==='sent'&&(result.message||result.unavailable===true)){completeSendAttempt(attempt,result);if(!result.unavailable)toast('이미 전송된 메시지예요. 대화에서 확인할 수 있어요.');}else throw new Error('취소 결과를 확인하지 못했어요.');}
  catch(error){if(attemptCurrent(attempt,context)){if(error.code==='MESSAGE_DELETED')completeSendAttempt(attempt,null,{deleted:true});else if(error.code==='MESSAGE_CANCELLED'){forgetSendAttempt(attempt);toast('전송이 취소됐어요. 작성 중인 초안은 남겨 뒀어요.');}else attempt.notice='취소 여부를 확인하지 못했어요. 연결이 돌아오면 다시 확인해 주세요.';}}
  finally{if(transferContextCurrent(context)){attempt.busy=false;attempt.status='unknown';updateSend();finishTransferFocus(focusReturn);}}
}
function addFiles(files){
  if(!canPostToChannel()||!selectedConversation())return;const channelId=state.channelId,selected=queue(channelId);
  for(const file of files){if(selected.length>=5){toast('한 메시지에는 파일을 최대 5개까지 첨부할 수 있어요.',true);break;}if(file.size===0||file.size>state.fileBytes){toast(`${file.name}: 0 B보다 크고 ${bytes(state.fileBytes)} 이하인 파일을 골라 주세요.`,true);continue;}
    const upload={key:crypto.randomUUID(),name:file.name,size:file.size,status:'error',progress:0,xhr:null,cancelled:false,rawFile:file,...transferContext()};selected.push(upload);uploadFile(upload,file,channelId);
  }persistQueue(channelId);renderQueue();updateSend();
}
function uploadCurrent(upload,channelId,context){return transferContextCurrent(context)&&!upload.cancelled&&!upload.channelUnavailable&&!state.unavailableChannels.has(channelId)&&(state.queues.get(channelId)||[]).includes(upload);}
function uploadFailure(upload,error,code){upload.status='error';upload.error=error;upload.errorCode=code||null;upload.checking=false;}
async function uploadFile(upload,file,channelId){
  if(upload.status==='uploading'||upload.checking||upload.cancelled)return;const context=transferContext();if(!uploadCurrent(upload,channelId,context))return;
  upload.status='uploading';upload.progress=0;upload.error=null;upload.errorCode=null;upload.rawFile=file;
  try{const recovery=companySessionRecovery();if(recovery)await recovery;}catch(error){if(uploadCurrent(upload,channelId,context)){uploadFailure(upload,error.message);persistQueue(channelId);if(channelId===state.channelId){renderQueue();updateSend();}finishTransferFocus(upload.focusReturn);upload.focusReturn=null;}return;}
  if(!uploadCurrent(upload,channelId,context))return;
  const xhr=new XMLHttpRequest();upload.xhr=xhr;xhr.open('POST',moduleUrl(`/api/channels/${id(channelId)}/files`));xhr.timeout=0;
  if(state.integrated?.csrfToken)xhr.setRequestHeader('X-CSRF-Token',state.integrated.csrfToken);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.setRequestHeader('X-Upload-Id',upload.key);
  const active=()=>upload.xhr===xhr&&uploadCurrent(upload,channelId,context);
  let inactivityTimer=null,lastLoaded=0;const clearInactivity=()=>{clearTimeout(inactivityTimer);inactivityTimer=null;};
  const repaint=()=>{persistQueue(channelId);if(channelId===state.channelId){renderQueue();updateSend();}finishTransferFocus(upload.focusReturn);upload.focusReturn=null;};
  const armInactivity=delay=>{clearInactivity();inactivityTimer=setTimeout(()=>{if(!active())return;upload.xhr=null;xhr.abort();uploadFailure(upload,'업로드가 멈췄어요. 연결을 확인한 뒤 다시 시도해 주세요.');repaint();},delay);};
  xhr.upload.onprogress=event=>{if(!active())return;if(event.loaded>lastLoaded){lastLoaded=event.loaded;armInactivity(120000);}if(event.lengthComputable){upload.progress=Math.round(event.loaded/event.total*100);if(channelId===state.channelId)renderQueue();}};
  xhr.upload.onload=()=>{if(active())armInactivity(300000);};
  xhr.onload=()=>{
    clearInactivity();
    let data;try{data=JSON.parse(xhr.responseText);}catch{data={};}
    if(!active())return;
    upload.xhr=null;if(xhr.status>=200&&xhr.status<300&&data.file){upload.file=data.file;upload.status='done';upload.progress=100;upload.rawFile=null;}
    else uploadFailure(upload,data.error||'업로드하지 못했어요.',data.code);repaint();
  };
  const failed=()=>{clearInactivity();if(!active())return;upload.xhr=null;uploadFailure(upload,'연결이 끊겼어요. 같은 파일로 다시 시도할 수 있어요.');repaint();};
  xhr.onerror=failed;xhr.ontimeout=failed;xhr.onabort=clearInactivity;
  try{armInactivity(120000);xhr.send(file);}catch{failed();}
}
async function retryUpload(key){
  const channelId=state.channelId,upload=queue(channelId).find(item=>item.key===key);if(!upload||upload.status!=='error'||upload.checking||upload.cancelled||!canPostToChannel()||state.sendRecovery?.uploads!==true)return;
  const context=transferContext();upload.focusReturn=beginTransferFocus(`[data-upload-retry="${CSS.escape(key)}"]`);upload.checking=true;renderQueue();updateSend();
  try{const result=await api(`/api/channels/${id(channelId)}/files/requests/${id(upload.key)}`,{recoveryContext:context});if(!uploadCurrent(upload,channelId,context))return;if(!result.file)throw new Error('파일을 확인하지 못했어요.');upload.file=result.file;upload.status='done';upload.progress=100;upload.rawFile=null;}
  catch(error){
    if(!uploadCurrent(upload,channelId,context))return;
    upload.checking=false;
    if(error.status===404&&upload.rawFile){uploadFile(upload,upload.rawFile,channelId);}
    else if(error.status===404)uploadFailure(upload,'이 창에 파일 원본이 없어요. 첨부를 취소하고 파일을 다시 골라 주세요.','FILE_NOT_AVAILABLE');
    else uploadFailure(upload,error.message,error.code);
  }finally{if(uploadCurrent(upload,channelId,context)){upload.checking=false;persistQueue(channelId);if(channelId===state.channelId){renderQueue();updateSend();}if(upload.status!=='uploading'){finishTransferFocus(upload.focusReturn);upload.focusReturn=null;}}}
}
function renderQueue(){
  const wrap=$('#upload-queue');if(!wrap)return;const uploads=queue(),attempt=sendAttempt();wrap.classList.toggle('hidden',!uploads.length);
  const focused=document.activeElement,focusAction=['uploadRetry','uploadRemove'].find(action=>focused?.dataset?.[action]&&wrap.contains(focused)),focusKey=focusAction?focused.dataset[focusAction]:null;
  wrap.innerHTML=uploads.map(file=>{
    const terminal=['UPLOAD_CONSUMED','UPLOAD_DELETED','UPLOAD_CANCELLED','UPLOAD_REQUEST_CONFLICT','UPLOAD_UNCERTAIN'].includes(file.errorCode),missing=file.status==='error'&&!file.rawFile;
    const status=file.cancelPending?(file.checking?'첨부 취소 확인 중':file.errorCode==='UPLOAD_UNCERTAIN'?'취소 여부를 확인할 수 없어요. 관리자에게 파일 확인을 요청해 주세요.':'첨부 취소를 확인하지 못했어요. 취소 확인을 눌러 주세요.'):file.checking?'업로드 결과 확인 중':file.status==='uploading'?(file.progress===100?'처리 중':`${file.progress}% 업로드`):file.status==='error'?(file.errorCode==='UPLOAD_UNCERTAIN'?'이전 업로드 결과를 확인할 수 없어요. 첨부를 취소하고 다시 골라 주세요.':terminal?'다시 올릴 수 없는 파일이에요. 첨부를 취소해 주세요.':file.errorCode==='FILE_NOT_AVAILABLE'?'파일을 다시 골라 주세요.':missing?'파일 원본이 이 창에 없어요. 업로드 결과를 확인해 주세요.':file.error||'업로드 실패'):bytes(file.size);
    return `<div class="upload-chip${file.status==='error'?' error':''}">${icon('file')}<div class="upload-chip-copy"><strong title="${esc(file.name)}">${esc(file.name)}</strong><small>${esc(status)}</small></div>${file.status==='error'&&!terminal&&!file.cancelPending?`<button type="button" class="button upload-retry" data-upload-retry="${file.key}" aria-label="${esc(file.name)} ${missing?'업로드 확인':'다시 시도'}" ${file.checking?'disabled':''}>${missing?'업로드 확인':'다시 시도'}</button>`:''}<button type="button" class="${file.cancelPending?'button upload-retry':'icon-button'}" data-upload-remove="${file.key}" aria-label="${esc(file.name)} 첨부 취소" ${file.checking||attempt?.busy||attempt?.payload.fileIds.includes(file.file?.id)?'disabled':''}>${file.cancelPending?'취소 확인':icon('close')}</button>${file.status==='uploading'?`<progress class="upload-progress" max="100" value="${file.progress}" aria-label="업로드 진행률"></progress>`:''}</div>`;
  }).join('');
  const focusTarget=focusAction?wrap.querySelector(`[${focusAction==='uploadRetry'?'data-upload-retry':'data-upload-remove'}="${CSS.escape(focusKey)}"]`):null;if(focusTarget&&!focusTarget.disabled)focusTarget.focus({preventScroll:true});
}
async function removeUpload(key){
  const channelId=state.channelId,uploads=queue(channelId),upload=uploads.find(item=>item.key===key),attempt=sendAttempt(channelId);if(!upload||upload.checking||attempt?.busy||attempt?.payload.fileIds.includes(upload.file?.id))return;
  const context=transferContext(),knownFile=upload.file,focusReturn=beginTransferFocus(`[data-upload-remove="${CSS.escape(key)}"]`);upload.cancelled=true;upload.cancelPending=true;upload.checking=true;upload.status='error';upload.rawFile=null;upload.xhr?.abort();persistQueue(channelId);renderQueue();updateSend();
  const current=()=>transferContextCurrent(context)&&!state.unavailableChannels.has(channelId)&&(state.queues.get(channelId)||[]).includes(upload);
  const complete=()=>{upload.cancelPending=false;state.queues.set(channelId,(state.queues.get(channelId)||[]).filter(item=>item!==upload));persistQueue(channelId);};
  try{const result=await api(knownFile?`/api/files/${id(knownFile.id)}`:`/api/channels/${id(channelId)}/files/requests/${id(upload.key)}`,{method:'DELETE',recoveryContext:context});if(!current())return;if(knownFile?result.ok!==true:result.status!=='cancelled')throw new Error('취소 결과를 확인하지 못했어요.');complete();}
  catch(error){if(current()){if(['UPLOAD_CANCELLED','UPLOAD_DELETED','UPLOAD_CONSUMED'].includes(error.code)){complete();if(error.code==='UPLOAD_CONSUMED')toast('이미 전송된 첨부파일은 대화에 그대로 남겨 뒀어요.');}else{upload.errorCode=error.code||null;upload.error='첨부 취소를 확인하지 못했어요. 연결이 돌아오면 취소 확인을 눌러 주세요.';}}}
  finally{if(transferContextCurrent(context)){upload.checking=false;persistQueue(channelId);if(channelId===state.channelId){renderQueue();updateSend();}finishTransferFocus(focusReturn);}}
}
async function handleMessageAction(event){
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action,messageId=button.closest('[data-message-id]')?.dataset.messageId;
  if(action==='message-more'){const tools=button.closest('.message-tools');const expanded=tools.classList.toggle('is-expanded');button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',expanded?'추가 메시지 작업 접기':'추가 메시지 작업');return;}
  if(action==='category-list'){if(mobileLayout.matches)setMobileMenu(true);else $('#global-search')?.focus();return;}
  if(action==='category-people')return focusDirectory();if(action==='category-create')return createChannelDialog('generic');if(action==='category-manage')return inviteDialog();if(action==='category-team')return openTeamConversation(button.dataset.teamId,button);
  const message=[...state.messages,...state.pins,...state.personalItems.map(item=>item.message||item),...(state.thread?.messages||[]),state.thread?.parent].find(m=>m?.id===messageId);
  if(action==='retry')return selectChannel(state.channelId);if(action==='earlier')return loadEarlier(button);if(action==='focus'){if(canPostToChannel())$('#composer-input').focus();return;}if(action==='attach'){if(canPostToChannel())$('#file-input').click();return;}if(action==='invite')return inviteDialog();
  if(!message)return;
  if(['save','remind','task','decision','ack','ack-list','workspace-link'].includes(action))return handleProductivityAction(action,message,button);
  if(action==='reply')return startReply(message);if(action==='thread')return openThread(message);if(action==='reply-origin')return openThread({...message.replyTo,channelId:message.channelId});if(action==='jump')return openSearchMessage(message);if(action==='pin')return togglePin(message,button);
  if(action==='reaction-picker')return reactionDialog(message);if(action==='react')return toggleReaction(message,button.dataset.emoji);if(action==='edit')return editMessageDialog(message);if(action==='delete')return deleteMessageDialog(message);
}
async function toggleReaction(message,emoji){if(!canWriteMessages())return;try{const result=await api(`/api/messages/${id(message.id)}/reactions`,{method:'POST',body:{emoji}});const index=state.messages.findIndex(m=>m.id===message.id);if(index>=0){state.messages[index]=result.message;renderMessages({preserve:true});}}catch(error){toast(error.message,true);}}
function connectEvents(){
  state.events?.close();clearTimeout(eventTimer);pendingUpdates.clear();
  const source=new EventSource(moduleUrl('/api/events'));state.events=source;
  source.onopen=()=>{setConnection(true);voice?.reconnected();Promise.all([refreshChannels(),refreshMessages(),refreshStorageProvider(),refreshDirectory(),refreshNotificationCount()]).then(refreshDetailViews).catch(()=>{});};
  source.onerror=()=>setConnection(false);
  source.addEventListener('update',event=>{
    let update;try{update=JSON.parse(event.data);}catch{return;}
    if(update.type==='read'){refreshChannels().catch(()=>{});return;}
    if(['voice','voice_invitation','voice_preferences'].includes(update.type)){voice?.handleUpdate(update);return;}if(update.type==='notification')voice?.handleUpdate(update);
    pendingUpdates.add(update.type);clearTimeout(eventTimer);
    eventTimer=setTimeout(async()=>{
      const types=new Set(pendingUpdates);pendingUpdates.clear();
      try{if(types.has('notification')){await refreshNotificationCount();if(state.drawer==='personal')await loadPersonalPanel();}await refreshChannels();if(types.has('storage')){await refreshStorageProvider();if($('#drive-storage-panel'))await refreshDriveStatus();}if(types.has('member')){await refreshDirectory();await refreshStorageProvider();}if(types.has('channel'))renderMessages({preserve:true});if(types.has('message')){await refreshMessages();await refreshDetailViews();}}
      catch(error){if(error.status!==401)setConnection(false);}
    },100);
  });
}
function setConnection(connected){state.connected=connected;const el=$('#connection');if(!el)return;el.classList.toggle('offline',!connected);el.innerHTML=`<span class="dot"></span><span>${connected?`실시간 연결됨 · ${isDrive()?'파일은 Drive':'이 PC에 저장'}`:'연결이 끊겼어요 · 자동 재연결 중'}</span>`;}
async function refreshDetailViews(){
  if(state.drawer==='personal')await loadPersonalPanel();
  if(state.mode==='files')await loadFiles({preserve:true});if(state.mode==='pins')await loadPins({preserve:true});
  if(state.drawer==='thread'&&state.thread?.parent)await loadThread(state.thread.parent.id,{preserve:true});

}
function setMode(mode){
  if(mode!=='chat'&&!selectedConversation())return;
  state.mode=mode;
  for(const name of ['chat','files','pins']){const button=$(`#tab-${name}`);button?.setAttribute('aria-pressed',String(mode===name));button?.classList.toggle('active',mode===name);}
  $('#chat-area')?.classList.toggle('hidden',mode!=='chat');$('#files-view')?.classList.toggle('hidden',mode!=='files');$('#pins-view')?.classList.toggle('hidden',mode!=='pins');
  if(mode==='files'){closeDrawer();renderFilesShell();loadFiles();}
  if(mode==='pins'){closeDrawer();loadPins();}
  if(mode==='chat'&&state.messages.length)markRead(state.channelId);
}
function renderFilesShell(){
  const wrap=$('#files-view');if(!wrap)return;
  wrap.innerHTML=`<div class="files-view-title"><div><h2>공유한 파일</h2><p class="view-description">대화 속 자료를 파일 이름과 종류로 찾으세요.</p></div><span class="tag" id="files-count"></span></div><div class="file-toolbar"><label class="file-search">${icon('search')}<input id="file-search-input" aria-label="파일 이름 검색" type="search" placeholder="파일 이름 검색" value="${esc(state.fileQuery)}" maxlength="200"></label><label class="file-select"><span class="sr-only">파일 검색 범위</span><select id="file-scope"><option value="channel" ${state.fileScope==='channel'?'selected':''}>이 대화방</option><option value="all" ${state.fileScope==='all'?'selected':''}>모든 대화방</option></select></label><label class="file-select"><span class="sr-only">파일 종류</span><select id="file-type">${[['all','모든 파일'],['document','문서'],['image','이미지'],['video','영상'],['audio','음성'],['archive','압축 파일'],['other','기타']].map(([value,label])=>`<option value="${value}" ${state.fileType===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div id="file-results"></div>`;
  $('#file-search-input').oninput=event=>{state.fileQuery=event.target.value;clearTimeout(state.fileSearchTimer);state.filesSeq++;state.fileSearchTimer=setTimeout(()=>loadFiles(),220);};
  $('#file-type').onchange=event=>{state.fileType=event.target.value;loadFiles();};
  $('#file-scope').onchange=event=>{state.fileScope=event.target.value;loadFiles();};
}
async function loadFiles({append=false,preserve=false}={}){
  const channelId=state.channelId,wrap=$('#file-results'),seq=++state.filesSeq;if(!channelId||!wrap||state.mode!=='files')return;
  const offset=append?state.sharedFiles.length:0,target=preserve?Math.max(50,state.sharedFiles.length):50,query=new URLSearchParams({limit:'50',offset:String(offset)});
  if(state.fileScope==='channel')query.set('channelId',channelId);if(state.fileQuery.trim())query.set('q',state.fileQuery.trim());if(state.fileType!=='all')query.set('type',state.fileType);
  if(!append&&!preserve)wrap.innerHTML='<div class="message-loading"><span class="spinner"></span>파일을 불러오고 있어요.</div>';
  try{let result=await api(`/api/files?${query}`),files=result.files;
    while(preserve&&result.hasMore&&result.files.length&&files.length<target){if(seq!==state.filesSeq||channelId!==state.channelId||state.mode!=='files')return;query.set('offset',String(files.length));result=await api(`/api/files?${query}`);files.push(...result.files);}
    if(seq!==state.filesSeq||channelId!==state.channelId||state.mode!=='files')return;state.sharedFiles=append?[...state.sharedFiles,...files]:files;
    $('#files-count').textContent=`${state.sharedFiles.length}개${result.hasMore?' 이상':''}`;
    wrap.innerHTML=state.sharedFiles.length?`<div class="file-grid">${state.sharedFiles.map(file=>`<div class="shared-file">${fileHtml(file)}<div class="shared-file-context"><span>${esc(state.members.find(person=>person.id===file.uploaderId)?.name||'팀 멤버')} · ${esc(state.channels.find(channel=>channel.id===file.channelId)?.name||'대화방')}</span>${file.messageId?`<button class="text-button" data-file-message="${esc(file.id)}" aria-label="${esc(file.name)} 공유 대화 보기">대화 보기 ${icon('arrow')}</button>`:''}</div></div>`).join('')}</div>${result.hasMore?'<button class="button load-more-files" id="load-more-files">파일 더 보기</button>':''}`:`<div class="large-empty"><div class="empty-tile">${icon('folder')}</div><strong>${state.fileQuery||state.fileType!=='all'?'조건에 맞는 파일이 없어요':'아직 공유한 파일이 없어요'}</strong><p>${state.fileQuery||state.fileType!=='all'?'다른 검색어나 파일 종류로 찾아보세요.':'대화에 첨부한 문서, 사진, 영상을<br>여기서 한 번에 확인할 수 있어요.'}</p>${canPostToChannel()?`<button class="button" id="files-to-chat">${icon('attach')}파일 공유하기</button>`:''}</div>`;
    $('#files-to-chat')?.addEventListener('click',()=>{setMode('chat');$('#file-input').click();});
    $('#load-more-files')?.addEventListener('click',event=>{event.currentTarget.disabled=true;loadFiles({append:true});});
    $$('[data-file-message]',wrap).forEach(button=>button.onclick=()=>{const file=state.sharedFiles.find(item=>item.id===button.dataset.fileMessage);if(file)openSearchMessage({id:String(file.messageId),channelId:file.channelId});});
  }catch(error){if(seq!==state.filesSeq||state.mode!=='files')return;wrap.innerHTML=`<div class="large-empty"><p>${esc(error.message)}</p><button class="button" id="retry-files">다시 불러오기</button></div>`;$('#retry-files').onclick=()=>loadFiles();}
}
function syncDrawerAccess(){
  const blocked=Boolean(state.drawer&&!directoryWide.matches),areas=['#chat-area','#files-view','#pins-view'].map(selector=>$(selector)).filter(Boolean);
  if(blocked&&!modal.open&&areas.some(area=>area.contains?.(document.activeElement)))$('#close-drawer')?.focus({preventScroll:true});
  for(const area of areas)area.inert=blocked;
}
function closeDrawer(){cancelWorkdayRefresh();const hadDrawer=Boolean(state.drawer),focusedInDrawer=$('#drawer')?.contains(document.activeElement);state.drawer=null;state.threadSeq++;state.thread=null;$('#drawer')?.classList.add('hidden');syncDrawerAccess();state.searchSeq++;state.personalSeq++;if(hadDrawer&&focusedInDrawer){const target=drawerReturnFocus?.isConnected&&!drawerReturnFocus.closest('[inert]')?drawerReturnFocus:$('#mobile-menu');target?.focus({preventScroll:true});}if(hadDrawer&&state.messages.length)markRead(state.channelId);}
function openDrawer(kind,scoped=false){scoped=Boolean(scoped&&selectedConversation());drawerReturnFocus=document.activeElement;setMobileMenu(false,{restoreFocus:false});state.drawer=kind;const drawer=$('#drawer');drawer.classList.remove('hidden');if(kind==='people'){drawer.innerHTML=`<div class="drawer-head"><h2>팀 멤버</h2><button class="icon-button" id="close-drawer" aria-label="패널 닫기">${icon('close')}</button></div><div class="drawer-body" id="drawer-body"></div>`;renderPeople();}else{drawer.innerHTML=`<div class="drawer-head"><h2>대화 검색</h2><button class="icon-button" id="close-drawer" aria-label="패널 닫기">${icon('close')}</button></div><div class="search-box">${icon('search')}<input id="search-input" aria-label="대화 검색어" placeholder="기억나는 단어를 입력하세요" maxlength="200" autocomplete="off"></div><label class="search-scope"><input type="checkbox" id="search-scope" ${scoped?'checked':''} ${!selectedConversation()?'disabled':''}>지금 대화에서만 찾기</label><div class="drawer-body" id="drawer-body"><div class="drawer-empty">${icon('search')}대화 속 필요한 내용을 찾아보세요.<br>나에게 남긴 메모도 검색할 수 있어요.</div></div>`;$('#search-input').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,280);});$('#search-scope').onchange=runSearch;installAdvancedSearch();$('#search-input').focus();}$('#close-drawer').onclick=closeDrawer;if(kind==='people')$('#close-drawer').focus();syncDrawerAccess();}
function renderPeople(){const body=$('#drawer-body');if(!body||state.drawer!=='people')return;body.innerHTML=`<p class="modal-description">${state.members.length}명의 멤버가 함께하고 있어요.<br>이름을 눌러 1:1 대화를 시작하세요.</p><div class="people-list">${state.members.map(person=>`<button class="person-row" data-person="${esc(person.id)}">${avatar(person)}<span class="person-info"><strong>${esc(person.name)}${person.id===state.user.id?' (나)':''}</strong><small>${person.role==='owner'?'관리자':'멤버'} · @${esc(person.username)}</small></span>${icon('chevron')}</button>`).join('')}</div>${state.members.length===1&&state.user.role==='owner'?'<div class="drawer-empty">팀원과 함께할 준비가 되면<br>초대 코드를 발급해 주세요.<button class="button" id="people-invite">팀원 초대</button></div>':''}`;$$('[data-person]',body).forEach(button=>button.onclick=()=>openDirectMessage(button.dataset.person,button));$('#people-invite')?.addEventListener('click',inviteDialog);}
function installAdvancedSearch(){
  $('.search-scope').insertAdjacentHTML('afterend',`<details class="advanced-search" id="advanced-search"><summary>작성자 · 날짜 · 파일 종류</summary><div class="search-filter-grid"><label>작성자<select id="search-author"><option value="">모든 크루</option>${state.members.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></label><label>파일 종류<select id="search-file-type">${[['','모든 메시지'],['image','이미지'],['video','영상'],['audio','음성'],['document','문서'],['archive','압축 파일'],['other','기타 파일']].map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>시작일<input type="date" id="search-from" aria-label="검색 시작일"></label><label>종료일<input type="date" id="search-to" aria-label="검색 종료일"></label></div></details>`);
  for(const selector of ['#search-author','#search-file-type','#search-from','#search-to'])$(selector).onchange=()=>runSearch();
}
async function runSearch({append=false}={}){
  if(state.drawer!=='search')return;const q=$('#search-input').value.trim(),scope=$('#search-scope').checked,seq=++state.searchSeq,body=$('#drawer-body');if(!body)return;
  if(scope&&!selectedConversation()){body.innerHTML='<div class="drawer-empty">먼저 검색할 대화방을 선택해 주세요.</div>';return;}
  const authorId=$('#search-author')?.value||'',from=$('#search-from')?.value||'',to=$('#search-to')?.value||'',fileType=$('#search-file-type')?.value||'';
  if(from&&to&&from>to){body.innerHTML='<div class="drawer-empty">종료일을 시작일 이후로 선택해 주세요.</div>';return;}
  if(!q&&!authorId&&!from&&!to&&!fileType){body.innerHTML=`<div class="drawer-empty">${icon('search')}단어를 입력하거나 작성자·날짜·파일 종류를 선택하세요.</div>`;return;}
  const offset=append?state.searchMessages.length:0,query=new URLSearchParams({q,offset:String(offset),limit:'30'});if(scope)query.set('channelId',state.channelId);for(const [key,value]of Object.entries({authorId,from,to,fileType}))if(value)query.set(key,value);
  if(!append)body.innerHTML='<div class="message-loading"><span class="spinner"></span>찾고 있어요.</div>';
  try{const result=await api(`/api/search?${query}`);if(seq!==state.searchSeq||state.drawer!=='search')return;state.searchMessages=append?[...state.searchMessages,...result.messages]:result.messages;
    body.innerHTML=state.searchMessages.length?`<p class="tiny muted search-count">${state.searchMessages.length}개의 결과${result.hasMore?' 이상':''}</p>${state.searchMessages.map(message=>`<button class="search-result" data-result="${esc(message.id)}"><div class="result-channel">${esc(state.channels.find(c=>c.id===message.channelId)?.name||'대화')}</div><div class="result-author">${esc(message.user.name)}</div><p>${esc(message.body||message.workspaceLink?.title||message.files.map(f=>f.name).join(', '))}</p><div class="result-footer">${shortDate(message.createdAt)} · ${timeLabel(message.createdAt)}</div></button>`).join('')}${result.hasMore?'<button class="button personal-more" id="search-more">검색 결과 더 보기</button>':''}`:`<div class="drawer-empty">${icon('search')}일치하는 대화가 없어요.<br>다른 단어나 검색 조건을 선택해 보세요.</div>`;
    $$('[data-result]',body).forEach(button=>button.onclick=()=>openSearchMessage(state.searchMessages.find(m=>m.id===button.dataset.result)));$('#search-more')?.addEventListener('click',event=>{event.currentTarget.disabled=true;runSearch({append:true});});
  }catch(error){if(seq===state.searchSeq&&state.drawer==='search'){body.innerHTML=`<div class="drawer-empty">${esc(error.message)}<button class="button" id="retry-search">다시 검색</button></div>`;$('#retry-search')?.addEventListener('click',()=>runSearch());}}
}
async function openSearchMessage(message,{isCurrent=()=>true}={}){
  try{
    await selectChannel(message.channelId);const seq=state.loadSeq;if(state.channelId!==message.channelId||!isCurrent())return;
    let attempts=0;
    while(!state.messages.some(m=>m.id===message.id)&&state.hasMore&&state.messages.length&&attempts++<20){
      const result=await api(`/api/channels/${id(message.channelId)}/messages?limit=100&before=${id(state.messages[0].id)}`);
      if(seq!==state.loadSeq||!isCurrent())return;
      state.messages=[...result.messages,...state.messages];state.hasMore=result.hasMore;
    }
    renderMessages();const element=document.getElementById(`message-${message.id}`);
    if(element){element.scrollIntoView({block:'center'});element.classList.add('highlight');}
    else toast('오래된 검색 결과예요. 이전 대화를 더 불러오면 확인할 수 있어요.');
  }catch(error){if(isCurrent())toast(error.message,true);}
}
function openModal(title,body){modalVersion++;state.projectPicker=null;modal.classList.remove('project-dialog','task-detail-dialog');modal.classList.toggle('workspace-modal',title==='워크스페이스');if(!modal.open)modalReturnFocus=document.activeElement;modal.innerHTML=`<div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="icon-button" id="close-modal" aria-label="창 닫기">${icon('close')}</button></div><div class="modal-body">${body}</div>`;if(!modal.open)modal.showModal();$('#close-modal').onclick=()=>modal.close();}
modal.addEventListener('close',()=>modalReturnFocus?.isConnected&&modalReturnFocus.focus());modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
function formError(message){const el=$('#modal-error');if(el){el.textContent=message;el.classList.remove('hidden');}else toast(message,true);}
function canManageCrew(){return state.integrated?Boolean(state.integrated.canManage):state.user?.role==='owner';}
function isProject(channel){return channel?.kind==='channel'&&channel.category==='project';}
function projectParticipantCount(channel){return Number.isSafeInteger(channel?.activeMemberCount)&&channel.activeMemberCount>=0?channel.activeMemberCount:channel?.memberIds?.length||0;}
function canLeaveProject(channel){return isProject(channel)&&!channel.deletedAt&&channel.canLeave===true&&channel.memberIds?.includes(state.user?.id);}
function canDeleteProject(channel){return isProject(channel)&&!channel.deletedAt&&channel.canDelete===true&&canWriteMessages()&&channel.memberIds?.includes(state.user?.id);}
function canRestoreProject(channel){return isProject(channel)&&Boolean(channel.deletedAt)&&channel.canRestore===true&&(channel.archivedByLeave||(canWriteMessages()&&channel.memberIds?.includes(state.user?.id)));}
function canManageProject(channel){return isProject(channel)&&!channel.deletedAt&&channel.canManage===true&&canWriteMessages()&&channel.memberIds?.includes(state.user?.id);}
function canInviteProject(channel){return isProject(channel)&&channel.canInvite===true&&canWriteMessages()&&channel.memberIds?.includes(state.user?.id);}
function projectCrewIds(selection,existing=[]){return state.members.filter(person=>selection.has(person.id)&&!existing.includes(person.id)).map(person=>person.id);}
function projectCrewListHtml({selected=new Set(),existing=[],query='',members=state.members}={}){
  const needle=query.trim().toLocaleLowerCase(),people=members.filter(person=>`${person.name} ${person.teamName||''}`.toLocaleLowerCase().includes(needle));
  return people.length?people.map(person=>{const joined=existing.includes(person.id),checked=joined||selected.has(person.id);return `<label class="project-crew-option${joined?' is-joined':''}"><input type="checkbox" data-project-crew="${esc(person.id)}" ${checked?'checked':''} ${joined?'disabled':''}>${avatar(person)}<span><strong>${esc(person.name)}${person.id===state.user.id?' <small>(나)</small>':''}</strong><small>${esc(person.teamName||'팀 미배정')}</small></span>${joined?'<span class="project-member-status">참여 중</span>':''}</label>`;}).join(''):'<p class="project-crew-empty">검색에 맞는 크루가 없어요.</p>';
}
function projectRegistrationHtml(){return canManageCrew()?`<div class="project-registration"><span>${state.members.length<2?'먼저 크루를 등록하세요.':'아직 회사에 등록하지 않은 크루가 있나요?'}</span><button class="text-button" type="button" data-project-register>${state.integrated?'팀·크루 관리':'크루 등록'}</button></div>`:state.members.length<2?'<p class="project-crew-empty">함께할 크루가 아직 없어요. 관리자에게 크루 등록을 요청하세요.</p>':'';}
function bindProjectRegistration(){for(const button of $$('[data-project-register]',modal))button.onclick=()=>{modal.close();inviteDialog();};}
function channelCreationPayload(values,selected){const project=values.category==='project',scope=project&&values.scope!=='public'?'private':'public';return{name:values.name,description:values.description||'',category:project?'project':'team',scope,...(scope==='private'?{memberIds:projectCrewIds(selected)}:{})};}
function createChannelDialog(category='team'){
  if(!canWriteMessages())return;const selected=new Set([state.user.id]),projectEntry=category==='project',descriptionField='<label class="field"><span>설명 <span class="muted">(선택)</span></span><input name="description" placeholder="이곳에서 어떤 이야기를 나눌까요?" maxlength="200"></label>';
  if(category!=='project')category='team';
  openModal(projectEntry?'새 프로젝트 대화방':'새 대화방 만들기',`<form id="channel-form"><fieldset class="room-category${projectEntry?' hidden':''}"><legend>대화방 구분</legend><label><input type="radio" name="category" value="team" ${category==='team'?'checked':''}>${icon('hash')}공용 대화</label><label><input type="radio" name="category" value="project" ${category==='project'?'checked':''}>${icon('project')}프로젝트</label></fieldset><label class="field"><span>대화방 이름</span><input id="new-channel-name" name="name" placeholder="예: 가을 캠페인" maxlength="40" required></label>${projectEntry?'':descriptionField}<div id="project-create-options">${projectEntry?'<details class="project-extra-settings" id="project-extra-settings"><summary id="project-scope-summary">참여 범위·설명 설정</summary>':''}<label class="field"><span>참여 범위</span><select id="project-access" name="scope"><option value="private">선택한 크루만 참여</option><option value="public">전체 크루가 참여하는 공개 프로젝트</option></select></label>${projectEntry?descriptionField+'</details>':''}<p class="project-access-note" id="project-access-note"></p><section id="project-create-picker"><div class="project-picker-heading"><h3>함께할 크루</h3><span>나는 자동으로 참여해요</span></div><label class="project-crew-search">${icon('search')}<input id="project-crew-search" type="search" placeholder="이름 또는 팀으로 검색" aria-label="함께할 크루 검색" autocomplete="off"></label><div class="project-crew-list" id="project-crew-list"></div>${projectRegistrationHtml()}</section></div><p class="project-access-note" id="public-channel-note">회사 구성원 모두가 자동으로 참여하는 공용 대화방이에요.</p><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions project-picker-footer"><span id="project-selection-count" aria-live="polite"></span><button class="button" type="button" id="cancel-channel">취소</button><button class="button primary" type="submit" id="create-project-submit">대화방 만들기</button></div></form>`);
  modal.classList.add('project-dialog');const version=modalVersion,form=$('#channel-form'),list=$('#project-crew-list'),scope=$('#project-access');
  const render=()=>{const project=$('input[name="category"]:checked',form)?.value==='project',privateProject=project&&scope.value==='private';const summary=$('#project-scope-summary');if(summary)summary.textContent=scope.value==='private'?'참여 범위·설명 설정':'전체 공개 · 설정 변경';$('#project-create-options').classList.toggle('hidden',!project);$('#public-channel-note').classList.toggle('hidden',project);$('#project-create-picker').classList.toggle('hidden',!privateProject);$('#project-access-note').textContent=privateProject?'선택한 크루만 대화와 파일을 볼 수 있어요. 나 혼자 시작한 뒤 초대해도 좋아요.':'전체 크루가 자동으로 참여해요. 개별 초대는 필요하지 않아요.';list.innerHTML=projectCrewListHtml({selected,existing:[state.user.id],query:$('#project-crew-search').value});$('#project-selection-count').textContent=privateProject?`나 포함 ${projectCrewIds(selected).length}명 참여`:'전체 크루 참여';};
  for(const radio of $$('input[name="category"]',form))radio.onchange=render;scope.onchange=render;$('#project-crew-search').oninput=render;list.onchange=event=>{const box=event.target.closest('[data-project-crew]');if(!box||box.disabled)return;if(box.checked)selected.add(box.dataset.projectCrew);else selected.delete(box.dataset.projectCrew);$('#project-selection-count').textContent=`나 포함 ${projectCrewIds(selected).length}명 참여`;};
  bindProjectRegistration();render();$('#new-channel-name').focus();$('#cancel-channel').onclick=()=>modal.close();
  form.onsubmit=async event=>{event.preventDefault();if(!canWriteMessages())return;const button=$('button[type=submit]',form),sequence=++state.navigationSeq;button.disabled=true;try{const payload=channelCreationPayload(Object.fromEntries(new FormData(form)),selected),data=await api('/api/channels',{method:'POST',body:payload});await refreshChannels();if(sequence!==state.navigationSeq||version!==modalVersion||!modal.open)return;modal.close();await selectChannel(data.channel.id);toast('새 대화방을 만들었어요.');}catch(error){if(version===modalVersion&&modal.open){formError(error.message);button.disabled=false;}}};
}
function syncProjectParticipation(){
  const wrap=$('#project-participation'),channel=selectedConversation();$('#channel-notifications')?.classList.toggle('hidden',isProject(channel));if(!wrap)return;wrap.classList.toggle('hidden',!isProject(channel));if(!isProject(channel)){wrap.innerHTML='';return;}
  const count=projectParticipantCount(channel);wrap.innerHTML=`<span class="project-access-badge">${icon(channel.scope==='private'?'lock':'globe')}${channel.scope==='private'?'선택한 크루만 참여':'전체 공개'}</span><button type="button" class="text-button" data-project-members>참여 크루 ${count}명 ${icon('chevron')}</button>${canInviteProject(channel)?'<button type="button" class="button project-invite-button" data-project-invite>크루 초대</button>':''}<button type="button" class="text-button project-settings-button" data-project-settings>${icon('settings')}대화방 설정</button>`;
  $('[data-project-members]',wrap).onclick=()=>projectMembersDialog(channel.id);$('[data-project-invite]',wrap)?.addEventListener('click',()=>projectMembersDialog(channel.id,{invite:true}));$('[data-project-settings]',wrap)?.addEventListener('click',roomSettingsDialog);
}
function projectMembersDialog(channelId,{invite=false}={}){
  const channel=state.channels.find(room=>room.id===channelId);if(!isProject(channel)||!channel.memberIds?.includes(state.user.id))return;
  const writable=canInviteProject(channel),publicRoom=channel.scope!=='private',selected=new Set();
  openModal(`${channel.name} · 참여 크루`,`<p class="modal-description">${publicRoom?'전체 공개 프로젝트예요. 현재 참여 중인 크루를 확인하세요. 나간 크루는 관리자가 다시 초대할 수 있어요.':'선택한 크루만 참여하는 프로젝트예요.'}${writable?'<br>추가된 크루는 이 방의 이전 대화와 공유 파일도 볼 수 있어요.':''}</p><form id="project-invite-form"><div class="project-picker-heading"><h3>${writable?'참여 중인 크루와 초대할 크루':'참여 중인 크루'}</h3><span id="project-member-total"></span></div><label class="project-crew-search">${icon('search')}<input id="project-crew-search" type="search" placeholder="이름 또는 팀으로 검색" aria-label="프로젝트 크루 검색" autocomplete="off"></label><div class="project-crew-list" id="project-crew-list"></div>${!publicRoom&&!writable?'<p class="project-access-note">추가 초대는 이 방을 만든 크루나 관리자에게 요청하세요.</p>':''}${projectRegistrationHtml()}${publicRoom&&canWriteMessages()?'<button type="button" class="text-button project-create-private" id="project-create-private">선택한 크루와 새 프로젝트 시작</button>':''}<div id="modal-error" class="form-error hidden" role="alert"></div>${writable?'<div class="modal-actions project-picker-footer"><span id="project-selection-count" aria-live="polite">0명 선택</span><button type="submit" class="button primary" id="project-invite-submit" disabled>선택한 크루 초대</button></div>':''}</form>`);
  modal.classList.add('project-dialog');const version=modalVersion,list=$('#project-crew-list');
  const render=()=>{const latest=state.channels.find(room=>room.id===channelId);if(!latest||!latest.memberIds?.includes(state.user.id)){modal.close();return;}const allowed=canInviteProject(latest),existing=latest.memberIds||[],chosen=projectCrewIds(selected,existing);list.innerHTML=projectCrewListHtml({selected,existing,query:$('#project-crew-search').value,members:allowed?state.members:state.members.filter(person=>existing.includes(person.id))});$('#project-member-total').textContent=`${projectParticipantCount(latest)}명 참여 중`;const count=$('#project-selection-count'),button=$('#project-invite-submit');if(count)count.textContent=`${chosen.length}명 선택`;if(button){button.disabled=!allowed||!chosen.length;button.textContent=chosen.length?`선택 ${chosen.length}명 초대`:'선택한 크루 초대';}};
  state.projectPicker={channelId,version,render};$('#project-crew-search').oninput=render;list.onchange=event=>{const box=event.target.closest('[data-project-crew]');if(!box||box.disabled)return;if(box.checked)selected.add(box.dataset.projectCrew);else selected.delete(box.dataset.projectCrew);const latest=state.channels.find(room=>room.id===channelId),chosen=projectCrewIds(selected,latest?.memberIds||[]),button=$('#project-invite-submit');if(button){button.disabled=!canInviteProject(latest)||!chosen.length;button.textContent=chosen.length?`선택 ${chosen.length}명 초대`:'선택한 크루 초대';$('#project-selection-count').textContent=`${chosen.length}명 선택`;}};
  bindProjectRegistration();$('#project-create-private')?.addEventListener('click',()=>createChannelDialog('project'));render();if(invite)$('#project-crew-search').focus();
  $('#project-invite-form').onsubmit=async event=>{event.preventDefault();const latest=state.channels.find(room=>room.id===channelId),memberIds=projectCrewIds(selected,latest?.memberIds||[]);if(!canInviteProject(latest)||!memberIds.length)return;const button=$('#project-invite-submit');button.disabled=true;try{await api(`/api/channels/${id(channelId)}/members`,{method:'POST',body:{memberIds}});await refreshChannels();if(version!==modalVersion||!modal.open)return;selected.clear();render();toast('선택한 크루를 프로젝트에 초대했어요.');}catch(error){if(version===modalVersion&&modal.open){formError(error.message);render();}}};
}
function refreshProjectPicker(){const picker=state.projectPicker;if(picker&&modal.open&&picker.version===modalVersion)picker.render();}
function editChannelDialog(){
  const channel=currentChannel();if(!canWriteMessages()||!channel?.canManage||channel.kind!=='channel')return;
  openModal('대화방 설정',`<p class="modal-description">${channel.scope==='private'?'선택한 크루만 참여하는 프로젝트예요. 이름과 설명을 바꿔도 참여 범위는 그대로 유지돼요.':(isProject(channel)?'현재 참여한 크루가 함께 보는 공개 프로젝트예요.':'회사 구성원 모두가 함께 보는 대화방이에요.')+' 이름과 설명을 바꿔도 대화와 파일은 유지돼요.'}</p><form id="channel-edit-form"><fieldset ${isProject(channel)?'disabled class="room-category hidden"':'class="room-category"'}><legend>대화방 구분</legend><label><input type="radio" name="category" value="team" ${channel.category!=='project'?'checked':''}>${icon('hash')}공용 대화</label><label><input type="radio" name="category" value="project" ${channel.category==='project'?'checked':''}>${icon('project')}프로젝트</label></fieldset><label class="field"><span>대화방 이름</span><input name="name" id="channel-edit-name" value="${esc(channel.name)}" required maxlength="40"></label><label class="field"><span>설명</span><input name="description" value="${esc(channel.description)}" maxlength="200"></label><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button" type="button" id="cancel-channel-edit">닫기</button><button class="button primary" type="submit">저장</button></div></form><button type="button" class="room-notification-link text-button" id="room-notification-settings">${icon('bell')}이 대화방 알림 설정</button>${canDeleteProject(channel)?'<section class="project-delete-section"><div><h3>대화방 삭제</h3><p>모든 참여자의 목록에서 제외돼요.<br>대화와 파일은 삭제된 대화방에서 복원할 수 있어요.</p></div><button type="button" class="button danger" id="delete-project">대화방 삭제</button></section>':''}`);
  const version=modalVersion;$('#room-notification-settings').onclick=channelNotificationsDialog;$('#channel-edit-name').focus();$('#cancel-channel-edit').onclick=()=>modal.close();$('#delete-project')?.addEventListener('click',()=>deleteProjectDialog(channel.id));
  $('#channel-edit-form').onsubmit=async event=>{event.preventDefault();const button=$('button[type=submit]',event.currentTarget);button.disabled=true;try{await api(`/api/channels/${id(channel.id)}`,{method:'PATCH',body:Object.fromEntries(new FormData(event.currentTarget))});await refreshChannels();if(version!==modalVersion||!modal.open)return;modal.close();if(state.channelId===channel.id){syncChannelHeader();renderMessages({preserve:true});}toast('대화방 정보를 저장했어요.');}catch(error){if(version===modalVersion&&modal.open){formError(error.message);button.disabled=false;}}};
}
function forgetChannelState(channelId){
  const attempt=sendAttempt(channelId);if(attempt)forgetSendAttempt(attempt);
  state.unavailableChannels.add(channelId);state.searchSeq++;state.personalSeq++;state.filesSeq++;
  if(state.thread?.parent?.channelId===channelId)closeDrawer();
  for(const upload of state.queues.get(channelId)||[]){upload.channelUnavailable=true;upload.xhr?.abort();}state.queues.delete(channelId);
  for(const key of Object.keys(state.categoryChannels))if(state.categoryChannels[key]===channelId)delete state.categoryChannels[key];
  try{for(const key of [draftKey(channelId),replyDraftKey(channelId),composeExtrasKey(channelId),attachmentKey(channelId)])localStorage.removeItem(key);const lastKey=`synk-messenger:last:${state.user?.id}`;if(localStorage.getItem(lastKey)===channelId)localStorage.removeItem(lastKey);}catch{}
  state.searchMessages=state.searchMessages.filter(message=>message.channelId!==channelId);state.personalItems=state.personalItems.filter(item=>(item.channelId||item.message?.channelId)!==channelId);
}
async function removeChannelFromWorkspace(channelId){
  const active=state.channelId===channelId;state.channelsSeq++;forgetChannelState(channelId);state.channels=state.channels.filter(channel=>channel.id!==channelId);
  if(active){const next=sortedPublicChannels(state.channels.filter(channel=>channelCategory(channel)===state.chatCategory))[0];clearChannelSelection();if(next)await selectChannel(next.id,{preserveFilter:true});}
  else{if(state.thread?.parent?.channelId===channelId)closeDrawer();renderNavigation();syncChannelHeader();syncComposerAccess();}
}
function deleteProjectDialog(channelId){
  const channel=state.channels.find(room=>room.id===channelId);if(!canDeleteProject(channel))return;
  openModal('대화방을 삭제할까요?',`<div class="project-delete-summary"><strong>${esc(channel.name)}</strong><span>참여 크루 ${projectParticipantCount(channel)}명</span></div><p class="modal-description">모든 참여자의 대화방 목록에서 제외돼요.<br>대화와 파일은 보관되며, <strong>전체채팅 → 삭제된 대화방</strong>에서 복원할 수 있어요.</p><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button" id="cancel-delete-project">취소</button><button class="button danger" id="confirm-delete-project">대화방 삭제</button></div>`);
  const version=modalVersion;$('#cancel-delete-project').onclick=()=>modal.close();$('#confirm-delete-project').onclick=event=>deleteProjectChannel(channelId,event.currentTarget,version);
}
async function deleteProjectChannel(channelId,button,version=modalVersion){
  const channel=state.channels.find(room=>room.id===channelId);if(!canDeleteProject(channel)||state.deletingChannels.has(channelId))return;
  state.deletingChannels.add(channelId);if(button)button.disabled=true;syncComposerAccess();
  try{await api(`/api/channels/${id(channelId)}`,{method:'DELETE'});if(version===modalVersion&&modal.open)modal.close();await removeChannelFromWorkspace(channelId);toast('대화방을 삭제했어요. 삭제된 대화방에서 복원할 수 있어요.');}
  catch(error){if(version===modalVersion&&modal.open)formError(error.message);else toast(error.message,true);}
  finally{state.deletingChannels.delete(channelId);syncComposerAccess();if(button?.isConnected)button.disabled=false;}
}
function leaveProjectDialog(channelId){
  const channel=state.channels.find(room=>room.id===channelId);if(!canLeaveProject(channel))return;
  openModal('대화방에서 나갈까요?',`<div class="project-delete-summary"><strong>${esc(channel.name)}</strong><span>참여 크루 ${projectParticipantCount(channel)}명</span></div><p class="modal-description">내 대화방 목록에서만 빠져요.<br>다른 크루의 대화와 파일은 지워지지 않아요.${projectParticipantCount(channel)===1?'<br>혼자 남은 방은 보관되며 삭제된 대화방에서 복원할 수 있어요.':'<br>다시 참여하려면 초대가 필요해요.'}</p><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button" id="cancel-leave-project">취소</button><button class="button primary" id="confirm-leave-project">나가기</button></div>`);
  const version=modalVersion;$('#cancel-leave-project').onclick=()=>modal.close();$('#confirm-leave-project').onclick=event=>leaveProjectChannel(channelId,event.currentTarget,version);
}
async function leaveProjectChannel(channelId,button,version=modalVersion){
  const channel=state.channels.find(room=>room.id===channelId);if(!canLeaveProject(channel)||state.leavingChannels.has(channelId))return;
  state.leavingChannels.add(channelId);if(button)button.disabled=true;syncComposerAccess();
  try{const result=await api(`/api/channels/${id(channelId)}/leave`,{method:'POST',body:{}}),returnFocus=version===modalVersion&&modal.open;if(returnFocus)modal.close();await removeChannelFromWorkspace(channelId);if(returnFocus)(state.channelId?$(`[data-channel="${CSS.escape(state.channelId)}"]`):$('#global-search'))?.focus({preventScroll:true});toast(result.archived?'혼자 남은 방을 보관했어요. 삭제된 대화방에서 복원할 수 있어요.':'대화방에서 나왔어요. 다른 크루의 대화는 유지돼요.');}
  catch(error){if(version===modalVersion&&modal.open)formError(error.message);else toast(error.message,true);}
  finally{state.leavingChannels.delete(channelId);syncComposerAccess();if(button?.isConnected)button.disabled=false;}
}
function deletedProjectRows(channels){return channels.length?`<div class="deleted-project-list">${channels.map(channel=>`<article class="deleted-project-row"><div><strong>${esc(channel.name)}</strong><span>${channel.scope==='private'?'선택 참여':'전체 공개'} · 참여 크루 ${projectParticipantCount(channel)}명</span><small>${esc(dateLabel(channel.deletedAt))} ${channel.archivedByLeave?'보관 · 마지막 참여자가 나간 방':'삭제'}</small></div><button type="button" class="button" data-restore-project="${esc(channel.id)}">복원</button></article>`).join('')}</div>`:'<div class="drawer-empty"><strong>삭제·보관된 대화방이 없어요.</strong><p>내가 복원할 수 있는 프로젝트방이 여기에 표시돼요.</p></div>';}
async function deletedProjectsDialog(){
  openModal('삭제된 대화방','<p class="modal-description">삭제했거나 마지막으로 나간 프로젝트방이에요.<br>복원하면 참여 크루가 이전 대화와 파일을 다시 볼 수 있어요.</p><div id="deleted-project-list"><div class="message-loading"><span class="spinner"></span>불러오고 있어요.</div></div><div id="modal-error" class="form-error hidden" role="alert"></div>');const version=modalVersion;
  try{const result=await api('/api/channels/deleted');if(version!==modalVersion||!modal.open)return;const channels=result.channels.filter(canRestoreProject);$('#deleted-project-list').innerHTML=deletedProjectRows(channels);for(const button of $$('[data-restore-project]',modal))button.onclick=()=>restoreProjectChannel(channels.find(channel=>channel.id===button.dataset.restoreProject),button,version);}
  catch(error){if(version===modalVersion&&modal.open){$('#deleted-project-list').innerHTML='<button class="button" id="retry-deleted-projects">다시 불러오기</button>';$('#retry-deleted-projects').onclick=deletedProjectsDialog;formError(error.message);}}
}
async function restoreProjectChannel(channel,button,version=modalVersion){
  if(!canRestoreProject(channel)||state.restoringChannels.has(channel.id))return;const navigation=state.navigationSeq;state.restoringChannels.add(channel.id);if(button)button.disabled=true;
  try{const result=await api(`/api/channels/${id(channel.id)}/restore`,{method:'POST',body:{}});state.channelsSeq++;state.unavailableChannels.delete(channel.id);state.channels=state.channels.filter(room=>room.id!==channel.id);state.channels.push(result.channel);renderNavigation();if(version===modalVersion&&modal.open&&navigation===state.navigationSeq){modal.close();await selectChannel(result.channel.id);}toast('대화방을 복원했어요. 이전 대화와 파일을 다시 볼 수 있어요.');}
  catch(error){if(version===modalVersion&&modal.open)formError(error.message);else toast(error.message,true);}
  finally{state.restoringChannels.delete(channel.id);if(button?.isConnected)button.disabled=false;}
}
function editMessageDialog(message){if(!canPostMessage(message))return;openModal('메시지 수정',`<p class="modal-description">수정한 메시지에는 ‘수정됨’이 표시돼요.</p><form id="edit-message-form"><label class="field"><span>메시지</span><textarea id="edit-message-text" name="body" maxlength="8000" ${message.files.length||message.workspaceLink?'':'required'}>${esc(message.body)}</textarea></label><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button" type="button" id="cancel-edit">취소</button><button class="button primary" type="submit">수정 저장</button></div></form>`);$('#edit-message-text').focus();$('#cancel-edit').onclick=()=>modal.close();$('#edit-message-form').onsubmit=async event=>{event.preventDefault();if(!canPostMessage(message)){formError('이 대화방의 메시지를 수정할 권한이 없어요.');return;}const button=$('button[type=submit]',event.currentTarget);button.disabled=true;try{const result=await api(`/api/messages/${id(message.id)}`,{method:'PATCH',body:{body:$('#edit-message-text').value}});const index=state.messages.findIndex(m=>m.id===message.id);if(index>=0)state.messages[index]=result.message;modal.close();renderMessages({preserve:true});}catch(error){formError(error.message);button.disabled=false;}};}
function deleteMessageDialog(message){if(!canWriteMessages())return;openModal('메시지를 삭제할까요?',`<p class="modal-description">${message.files.length?'메시지와 첨부한 파일이 함께 삭제돼요.':'삭제한 메시지는 다시 복구할 수 없어요.'}</p><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button" id="cancel-delete">취소</button><button class="button danger" id="confirm-delete">삭제하기</button></div>`);$('#cancel-delete').onclick=()=>modal.close();$('#confirm-delete').onclick=async event=>{event.target.disabled=true;try{await api(`/api/messages/${id(message.id)}`,{method:'DELETE'});state.messages=state.messages.filter(m=>m.id!==message.id);modal.close();renderMessages({preserve:true});toast('메시지를 삭제했어요.');}catch(error){formError(error.message);event.target.disabled=false;}};}
function reactionDialog(message){if(message?!canWriteMessages():!canPostToChannel())return;openModal(message?'가볍게 반응하기':'이모지 넣기',`<div class="reaction-picker">${['👍','❤️','✅','👀','🎉'].map(emoji=>`<button data-picker="${emoji}" aria-label="${emoji}">${emoji}</button>`).join('')}</div>`);$$('[data-picker]',modal).forEach(button=>button.onclick=()=>{modal.close();if(message)toggleReaction(message,button.dataset.picker);else{if(!canPostToChannel())return;const box=$('#composer-input'),start=box.selectionStart;box.setRangeText(button.dataset.picker,start,box.selectionEnd,'end');box.focus();saveDraft();resizeComposer();updateSend();}});}
async function settingsDialog(){
  openModal('워크스페이스',`<div class="message-loading"><span class="spinner"></span>현황을 불러오고 있어요.</div>`);
  const version=modalVersion;
  try{
    const data=await api('/api/storage');if(!modal.open||version!==modalVersion)return;
    updateStorageProvider(data.provider||state.storage.provider);
    openModal('워크스페이스',`<div class="workspace-heading"><span class="workspace-symbol">${esc(initials(state.workspace.name).slice(0,1))}</span><div><h3>${esc(state.workspace.name)}</h3><p>${state.user.role==='owner'?'관리자':'멤버'} · @${esc(state.user.username)}</p></div></div><div class="stats-grid"><div class="stat"><span>파일 용량</span><strong>${bytes(data.bytes)}</strong></div><div class="stat"><span>공유 파일</span><strong>${data.fileCount}<small>개</small></strong></div><div class="stat"><span>메시지</span><strong>${data.messageCount}<small>개</small></strong></div><div class="stat"><span>멤버</span><strong>${data.memberCount}<small>명</small></strong></div></div><div class="settings-note" id="settings-storage-note">${storageNote()}</div>${state.user.role==='owner'?'<section id="drive-storage-panel" class="drive-panel" aria-label="파일 저장소 설정"></section>':''}<div class="settings-actions">${state.user.role==='owner'?`<button class="button" id="settings-invite">${icon('users')}팀원 초대</button>`:''}<button class="button" id="logout-button">${icon('logout')}로그아웃</button></div>`);
    if(state.user.role==='owner'){
      if(data.drive)renderDrivePanel(data.drive);
      else await refreshDriveStatus();
    }
    if(state.integrated){$('#logout-button')?.remove();const invite=$('#settings-invite');if(invite)invite.textContent='팀 관리';}
    $('#settings-invite')?.addEventListener('click',inviteDialog);
    $('#logout-button')?.addEventListener('click',async event=>{
      const button=event.currentTarget;button.disabled=true;saveDraft();
      try{await api('/api/logout',{method:'POST',body:{}});state.events?.close();state.queues.forEach(q=>q.forEach(f=>f.xhr?.abort()));state.queues.clear();state.user=null;modal.close();renderAuth('login');}
      catch(error){toast(error.message,true);button.disabled=false;}
    });
  }catch(error){
    if(!modal.open||version!==modalVersion)return;
    openModal('워크스페이스',`<p class="modal-description">${esc(error.message)}</p><button class="button" id="retry-settings">다시 불러오기</button>`);$('#retry-settings').onclick=settingsDialog;
  }
}
function renderDrivePanel(status){
  const panel=$('#drive-storage-panel');if(!panel||state.user?.role!=='owner')return;
  const connections=Array.isArray(status.connections)?status.connections:[];
  const active=connections.find(connection=>connection.id===status.activeConnectionId);
  const drive=status.provider==='google-drive';
  const healthy=drive&&status.status==='connected';
  const account=status.account;
  const usage=account?.usedBytes,limit=account?.limitBytes;
  const knownUsage=usage!==null&&usage!==undefined&&Number.isFinite(Number(usage))&&Number(usage)>=0;
  const knownLimit=limit!==null&&limit!==undefined&&Number.isFinite(Number(limit))&&Number(limit)>0;
  const percent=knownUsage&&knownLimit?Math.min(100,Math.max(0,Number(usage)/Number(limit)*100)):null;
  let folderUrl=null;
  try{const url=new URL(active?.folderUrl||'');if(url.protocol==='https:'&&url.hostname==='drive.google.com')folderUrl=url.href;}catch{}
  updateStorageProvider(status.provider);
  panel.innerHTML=`<div class="drive-panel-heading"><div>${icon(drive?'cloud':'globe')}<h3>파일 저장소</h3></div><span id="drive-connection-status" class="storage-status${status.status==='error'?' storage-error':''}"><span class="dot"></span>${status.status==='error'?'연결 확인 필요':healthy?'Drive 연결됨':'이 PC'}</span></div>${drive?`<div class="drive-account"><span>현재 연결한 Google 계정</span><strong id="drive-account-email">${esc(account?.email||active?.email||'계정 확인 중')}</strong></div>`:'<p class="drive-local-copy">새 파일은 이 PC에 저장돼요. 연결해 둔 Drive 계정이 있으면 아래에서 선택할 수 있어요.</p>'}${healthy&&account?`<div class="drive-quota"><div class="quota-heading"><span>Google 계정 전체 사용량</span><strong id="drive-quota-value">${knownUsage?bytes(usage):'확인 필요'} / ${knownLimit?bytes(limit):'한도 확인 필요'}</strong></div>${percent!==null?`<progress id="drive-quota-progress" class="quota-progress" max="100" value="${percent}" aria-label="Google 계정 전체 저장용량 사용률">${Math.round(percent)}%</progress>`:''}<p>Drive·Gmail·Google 포토를 포함한 계정 전체 용량이에요.</p></div>`:''}${status.status==='error'?`<div class="storage-alert" role="alert"><strong>Drive 상태를 확인하지 못했어요.</strong><p>${esc(status.error||'연결 상태를 다시 확인해 주세요.')}</p><p>Drive가 선택된 동안에는 파일을 이 PC로 대신 저장하지 않아요.</p></div>`:''}${Number(status.pendingDeletions)>0?`<div class="storage-alert pending-deletions" id="drive-pending-deletions"><strong>파일 ${Number(status.pendingDeletions)}개 정리 대기 중</strong><p>메신저에서 삭제한 파일을 Drive 휴지통으로 옮기는 중이에요. 연결이 복구되면 자동으로 다시 시도해요.</p></div>`:''}<div class="drive-status-actions">${folderUrl?`<a id="drive-folder-link" href="${esc(folderUrl)}" target="_blank" rel="noopener noreferrer">${icon('folder')}전용 폴더 열기</a>`:''}<button id="drive-refresh" type="button" class="text-button">상태 새로고침</button></div>${status.verifiedAt?`<p class="drive-verified">마지막 확인 · ${esc(dateLabel(status.verifiedAt))} ${esc(timeLabel(status.verifiedAt))}</p>`:''}<form id="storage-provider-form" class="storage-choice"><label for="drive-account-select">새 파일을 저장할 곳</label><div class="storage-select-row"><select id="drive-account-select" name="connectionId"><option value="" ${!status.activeConnectionId?'selected':''}>이 PC에 저장</option>${connections.map(connection=>`<option value="${esc(connection.id)}" ${connection.id===status.activeConnectionId?'selected':''}>${esc(connection.email)}${connection.id===status.activeConnectionId?' · 현재':''}</option>`).join('')}</select><button class="button" id="drive-apply" type="submit" disabled>적용</button></div><p>새로 올릴 파일부터 적용돼요. 기존 파일의 저장 위치는 유지돼요.</p>${connections.length<2?'<p>다른 Google 계정은 등록 후 이 목록에서 선택할 수 있어요.</p>':''}<div id="drive-action-error" class="form-error hidden" role="alert"></div></form>`;
  const selected=$('#drive-account-select');const apply=$('#drive-apply');
  selected.onchange=()=>{apply.disabled=selected.value===(status.activeConnectionId||'');$('#drive-action-error').classList.add('hidden');};
  $('#drive-refresh').onclick=refreshDriveStatus;
  $('#storage-provider-form').onsubmit=async event=>{
    event.preventDefault();if(apply.disabled)return;
    const requested=selected.value||null;apply.disabled=true;selected.disabled=true;
    try{const updated=await api('/api/storage/drive/active',{method:'POST',body:{connectionId:requested}});if(!panel.isConnected)return;renderDrivePanel(updated);toast(requested?'이후 파일은 선택한 Drive 계정에 저장돼요.':'이후 파일은 이 PC에 저장돼요.');}
    catch(error){if(!panel.isConnected)return;const box=$('#drive-action-error');box.textContent=error.message;box.classList.remove('hidden');apply.disabled=false;selected.disabled=false;}
  };
}
async function refreshDriveStatus(){
  const panel=$('#drive-storage-panel');if(!panel||state.user?.role!=='owner')return;
  const button=$('#drive-refresh');if(button){button.disabled=true;button.textContent='확인 중…';}
  else panel.innerHTML='<div class="message-loading"><span class="spinner"></span>파일 저장소를 확인하고 있어요.</div>';
  try{const status=await api('/api/storage/drive');if(panel.isConnected)renderDrivePanel(status);}
  catch(error){
    if(!panel.isConnected)return;
    const existing=$('#drive-action-error');
    if(existing){existing.textContent=error.message;existing.classList.remove('hidden');if(button){button.disabled=false;button.textContent='상태 새로고침';}}
    else{panel.innerHTML=`<div class="storage-alert" role="alert">${esc(error.message)}</div><button class="text-button" id="drive-retry">저장소 상태 다시 확인</button>`;$('#drive-retry').onclick=refreshDriveStatus;}
  }
}
async function inviteDialog(){if(state.integrated){parentMessage('messenger:team');return;}openModal('팀원 초대하기',`<p class="modal-description">초대 코드를 받은 팀원은 자신의 아이디와 비밀번호를 만들 수 있어요. 코드는 7일 동안 한 번만 사용할 수 있어요.</p><div class="settings-note">현재는 이 PC에서 테스트 중이에요. 다른 기기에서 접속하려면 서버 연결 설정을 먼저 준비해야 해요.</div><button class="button primary full" id="generate-invite">${icon('plus')}새 초대 코드 발급</button><div id="generated-invite"></div><div id="modal-error" class="form-error hidden" role="alert"></div><div class="invite-list" id="invite-list"></div>`);$('#generate-invite').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{const result=await api('/api/invites',{method:'POST',body:{}});$('#generated-invite').innerHTML=`<div class="code-display"><code id="new-invite-code">${esc(result.code)}</code><button class="icon-button" id="copy-code" aria-label="초대 코드 복사">${icon('copy')}</button></div><p class="tiny muted invite-expiry">${shortDate(result.expiresAt)}까지 유효해요. 이 코드는 지금만 볼 수 있으니 복사해서 보관해 주세요.</p>`;$('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(result.code);toast('초대 코드를 복사했어요.');}catch{const range=document.createRange();range.selectNodeContents($('#new-invite-code'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);toast('코드를 선택했어요. Ctrl+C로 복사해 주세요.');}};await loadInvites();}catch(error){formError(error.message);}finally{button.disabled=false;}};await loadInvites();}
async function loadInvites(){try{const result=await api('/api/invites');const list=$('#invite-list');if(!list)return;list.innerHTML=`<h3>발급한 초대</h3>${result.invites.length?result.invites.map(inv=>{const expired=new Date(inv.expiresAt)<new Date(),inactive=inv.usedAt||inv.revokedAt||expired;const status=inv.usedAt?'가입 완료':inv.revokedAt?'취소됨':expired?'만료됨':'사용 가능';return `<div class="invite-row"><div><strong>${shortDate(inv.createdAt)} 발급 · ${status}</strong><span>${shortDate(inv.expiresAt)} 만료</span></div>${!inactive?`<button class="text-button" data-revoke="${esc(inv.id)}">초대 취소</button>`:''}</div>`;}).join(''):'<p class="tiny muted">아직 발급한 코드가 없어요.</p>'}`;$$('[data-revoke]',list).forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api(`/api/invites/${id(button.dataset.revoke)}`,{method:'DELETE'});await loadInvites();toast('초대 코드를 취소했어요.');}catch(error){formError(error.message);button.disabled=false;}});}catch(error){formError(error.message);}}
document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&state.user){event.preventDefault();if(!modal.open)openDrawer('search');}
  if(event.key==='Escape'&&!modal.open){setMobileMenu(false);closeDrawer();}
  if(event.key==='Tab'&&mobileLayout.matches&&$('#sidebar')?.classList.contains('open')&&!modal.open){
    const targets=[...$$('[data-chat-category][aria-selected="true"]'),$('#mobile-scrim'),...$$('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)',$('#sidebar'))].filter(element=>element?.getClientRects().length);
    if(!targets.length)return;const first=targets[0],last=targets.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{resumeBootRecovery();if(!document.hidden&&state.user){refreshChannels().catch(()=>{});refreshMessages().catch(()=>{});refreshVisibleWorkday().catch(()=>{});}else cancelWorkdayRefresh();});
window.addEventListener('online',resumeBootRecovery);
window.addEventListener('pagehide',()=>{const resume=bootRecovery.phase==='loading'||bootRecovery.phase==='waiting';stopBootRecovery('closed');bootRecovery.resumeOnRestore=resume;});
// A restored page resumes an unfinished bootstrap; any other restored screen
// keeps working buttons (a permanent-failure screen can still retry manually).
window.addEventListener('pageshow',event=>{if(!event.persisted||bootRecovery.phase!=='closed')return;if(bootRecovery.resumeOnRestore){stopBootRecovery('waiting');resumeBootRecovery();}else stopBootRecovery();});
window.addEventListener('beforeunload',saveDraft);
for(const eventType of ['dragover','drop'])window.addEventListener(eventType,event=>{if(state.user&&[...(event.dataTransfer?.types||[])].includes('Files'))event.preventDefault();});

function canWriteMessages(){return state.integrated?.canWrite!==false;}
function canPostToChannel(channel=selectedConversation()){return Boolean(channel)&&!state.unavailableChannels.has(channel.id)&&!state.deletingChannels.has(channel.id)&&!state.leavingChannels.has(channel.id)&&canWriteMessages()&&channel.canPost!==false;}
function canPostMessage(message){const channel=message?.channelId?state.channels.find(item=>item.id===message.channelId):selectedConversation();return canPostToChannel(channel||null);}
function installDirectory(){
  $('.shell').insertAdjacentHTML('beforeend',`<aside class="employee-directory" id="employee-directory" aria-label="회사 크루 목록"><div class="directory-heading"><div><span class="directory-eyebrow">PEOPLE</span><h2>크루 목록 <span id="directory-count"></span></h2></div>${icon('users')}</div><label class="directory-search">${icon('search')}<input id="employee-search" type="search" placeholder="이름·팀으로 검색" aria-label="크루 검색" autocomplete="off"></label><label class="directory-team-select"><span class="sr-only">팀별 크루 보기</span><select id="directory-team" aria-label="팀별 크루 보기"></select></label><div class="directory-list" id="directory-list"></div><p class="directory-footnote">이름을 누르면 개인 대화가 열려요.</p></aside>`);
  $('#employee-search').oninput=event=>{state.directoryQuery=event.target.value;renderDirectory();};
  $('#directory-team').onchange=event=>{state.directoryTeam=event.target.value;renderDirectory();};
  $('#employee-directory').onclick=event=>{const filter=event.target.closest('[data-directory-filter]');if(filter){state.directoryTeam=filter.dataset.directoryFilter;renderDirectory();}const person=event.target.closest('[data-contact]');if(person)openDirectMessage(person.dataset.contact,person);};
  $('.directory-heading').insertAdjacentHTML('beforeend',`<button class="icon-button directory-back" id="directory-back" aria-label="대화 목록으로 돌아가기" title="대화 목록으로 돌아가기">${icon('arrow')}</button>`);
  $('#directory-back').onclick=()=>{$('.shell').classList.remove('directory-open');$('#sidebar').classList.remove('directory-focus');$('#global-search')?.focus({preventScroll:true});};
  $('#channel-members').setAttribute('aria-label','크루 목록 보기');
  applyDirectoryLayout();renderDirectory();
}
function applyDirectoryLayout(){
  const directory=$('#employee-directory'),shell=$('.shell'),sidebar=$('#sidebar');if(!directory||!shell||!sidebar)return;
  const wide=directoryWide.matches;shell.classList.toggle('directory-wide',wide);sidebar.classList.toggle('directory-inside',!wide);
  if(wide)sidebar.classList.remove('directory-focus');
  if(wide){if(directory.parentElement!==shell)shell.append(directory);}else if(directory.parentElement!==sidebar)sidebar.insertBefore(directory,$('.sidebar-bottom',sidebar));
  syncSidebarAccess();
}
function focusDirectory(){
  $('.shell')?.classList.add('directory-open');
  if(mobileLayout.matches)setMobileMenu(true);closeDrawer();if(!directoryWide.matches)$('#sidebar')?.classList.add('directory-focus');$('#employee-search')?.focus({preventScroll:true});
}
function directoryMembers(){
  const teamId=state.directoryTeam==='mine'?state.user?.teamId:state.directoryTeam.startsWith('team:')?state.directoryTeam.slice(5):null;
  if(state.directoryTeam==='mine'&&!teamId)return[];
  const query=state.directoryQuery.trim().toLocaleLowerCase();
  return state.members.filter(person=>(!teamId||person.teamId===teamId)&&(!query||`${person.name} ${person.teamName||''}`.toLocaleLowerCase().includes(query))).sort((a,b)=>(a.id===state.user?.id?-1:b.id===state.user?.id?1:a.name.localeCompare(b.name,'ko')));
}
function personDirectoryHtml(person){
  const self=person.id===state.user.id,room=state.channels.find(channel=>self?channel.kind==='self':channel.kind==='dm'&&channel.memberIds.includes(person.id));
  return `<button class="directory-person${room?.id===state.channelId?' active':''}" data-contact="${esc(person.id)}" aria-label="${esc(person.name)}${self?' 나에게 메모 열기':' 개인 대화 열기'}">${avatar(person)}<span class="directory-person-info"><strong>${esc(person.name)}${self?'<small>나</small>':''}</strong><span>${esc(person.teamName||'팀 미배정')}${person.role==='owner'?' · 관리자':''}</span></span>${room?.unread?`<span class="unread">${room.unread>99?'99+':room.unread}</span>`:icon(self?'note':'chat')}</button>`;
}
function renderDirectory(){
  const list=$('#directory-list');if(!list||!state.user)return;
  const focused=document.activeElement?.closest('[data-contact]')?.dataset.contact;
  $('#directory-count').textContent=String(state.members.length);
  const select=$('#directory-team');select.innerHTML=`<option value="all">전체 크루</option><option value="mine">내 팀</option>${state.teams.map(team=>`<option value="team:${esc(team.id)}">${esc(team.name)} · ${team.memberCount}명</option>`).join('')}`;select.value=state.directoryTeam;
  select.closest('.directory-team-select').classList.remove('hidden');
  $$('[data-directory-filter]').forEach(button=>{button.classList.toggle('active',button.dataset.directoryFilter===state.directoryTeam);button.setAttribute('aria-pressed',String(button.dataset.directoryFilter===state.directoryTeam));});
  const people=directoryMembers(),groups=new Map();for(const person of people){const key=person.teamId||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(person);}
  list.innerHTML=people.length?[...groups].map(([teamId,members])=>`<section class="directory-group"><h3>${esc(members[0].teamName||state.teams.find(team=>team.id===teamId)?.name||'팀 미배정')}<span>${members.length}</span></h3>${members.map(personDirectoryHtml).join('')}</section>`).join(''):`<div class="directory-empty">${icon('users')}<strong>${state.directoryTeam==='mine'&&!state.user.teamId?'아직 소속 팀이 없어요':'일치하는 크루가 없어요'}</strong><span>${state.directoryTeam==='mine'&&!state.user.teamId?'팀 배정 후 내 팀의 크루가 표시돼요.':'이름이나 팀을 다시 확인해 주세요.'}</span></div>`;
  if(focused)$(`[data-contact="${CSS.escape(focused)}"]`,list)?.focus({preventScroll:true});
}
async function refreshDirectory(){
  const data=await api('/api/directory');state.members=data.members;state.teams=data.teams||[];
  const me=state.members.find(person=>person.id===state.user?.id);if(me)state.user={...state.user,...me};renderNavigation();refreshProjectPicker();if(!selectedConversation())renderEmptyChannel();if(state.drawer==='people')renderPeople();
}
async function openDirectMessage(personId,button){
  const person=state.members.find(member=>member.id===personId);if(!person)return;
  const sequence=++state.navigationSeq;state.directSequence=(state.directSequence||0)+1;
  let channel=state.channels.find(room=>personId===state.user.id?room.kind==='self':room.kind==='dm'&&room.memberIds.includes(personId));
  if(channel){const loading=selectChannel(channel.id),selection=state.navigationSeq;await loading;return selection===state.navigationSeq&&state.channelId===channel.id?channel.id:null;}
  if(!canWriteMessages()){toast('조회 전용 계정은 새 개인 대화를 만들 수 없어요.');return;}
  if(button)button.disabled=true;
  try{const result=await api('/api/dms',{method:'POST',body:{userId:personId}});await refreshChannels();if(sequence!==state.navigationSeq)return;const loading=selectChannel(result.channel.id),selection=state.navigationSeq;await loading;if(selection===state.navigationSeq&&state.channelId===result.channel.id){$('#composer-input')?.focus({preventScroll:true});return result.channel.id;}return null;}
  catch(error){toast(error.message,true);}finally{if(button?.isConnected)button.disabled=false;}
}
async function openTeamConversation(teamId,button){
  const team=state.teams.find(item=>item.id===teamId);if(!team?.canOpen||!canWriteMessages())return;if(button)button.disabled=true;
  const sequence=++state.navigationSeq;
  try{const result=await api(`/api/teams/${id(teamId)}/channel`,{method:'POST',body:{}});await refreshChannels();await refreshDirectory();if(sequence!==state.navigationSeq)return;await selectChannel(result.channel.id);}
  catch(error){toast(error.message,true);}finally{if(button?.isConnected)button.disabled=false;}
}
function platformEntry(){
  return state.platformUrl?`<a class="platform-entry" href="${esc(state.platformUrl)}" target="_top" rel="noreferrer" referrerpolicy="no-referrer" aria-label="SYNK 플랫폼으로 이동">SYNK 플랫폼</a>`:'';
}
function installMessengerDesign(){
  const tabs=$('#chat-category-tabs');
  const wordmark='<img src="assets/synk-ko.svg" alt="싱ㅋ" width="560" height="328">';
  tabs.insertAdjacentHTML('beforebegin',`<div class="messenger-topbar"><div class="messenger-brand">${moduleBase?`<a href="/?tab=home" target="_top" aria-label="홈으로 이동">${wordmark}</a>`:wordmark}<strong>메신저</strong></div><div class="messenger-quick-tools" aria-label="내 업무 바로가기"></div></div>`);
  $('.messenger-topbar').insertBefore(tabs,$('.messenger-quick-tools'));
  for(const button of $$('[data-chat-category]'))button.insertAdjacentHTML('afterbegin',icon(chatCategories.find(([key])=>key===button.dataset.chatCategory)?.[2]));
  const bell=$('#personal-bell');bell.classList.remove('icon-button');bell.classList.add('quick-tool');bell.insertAdjacentHTML('beforeend','<span>내 업무</span>');bell.setAttribute('title','내 업무 · 알림, 할 일, 저장');bell.setAttribute('aria-label','내 업무 · 알림, 할 일, 저장');$('.messenger-quick-tools').append(bell);

  if(!moduleBase&&state.platformUrl)$('.messenger-quick-tools').insertAdjacentHTML('afterbegin',platformEntry());
  if(moduleBase){
    $('#sidebar').insertBefore(tabs,$('#global-search'));
    $('.header-actions').prepend($('.messenger-quick-tools'));
    $('.messenger-topbar').remove();
  }
  $('#global-search').insertAdjacentHTML('afterend',`<label class="room-filter-label">${icon('search')}<input type="search" id="room-filter" aria-label="대화방 찾기" placeholder="대화방 찾기" autocomplete="off"><button type="button" id="clear-room-filter" class="icon-button small hidden" aria-label="대화방 검색 지우기">${icon('close')}</button></label>`);
  $('.sidebar-scroll').insertAdjacentHTML('beforeend','<p class="sidebar-hint hidden" id="room-filter-empty" role="status">일치하는 대화방이 없어요.<br>다른 이름이나 팀을 찾아보세요.</p>');
  $('#room-filter').oninput=event=>{state.roomQuery=event.target.value;renderNavigation();};
  $('#clear-room-filter').onclick=()=>{state.roomQuery='';$('#room-filter').value='';renderNavigation();$('#room-filter').focus();};
  $('.header-title').append($('#channel-about'));
  $('#channel-members').insertAdjacentHTML('beforeend','<span class="member-button-label">크루</span>');
  $('#channel-search').remove();
  $('#global-search').innerHTML=`${icon('search')}<span>메시지 검색</span><kbd>Ctrl K</kbd>`;
  $('#channel-notifications').setAttribute('title','대화방 설정');
  $('#attach-file').innerHTML=`${icon('attach')}<span>파일</span>`;$('#attach-file').classList.add('composer-tool');
  $('#composer-emoji').classList.add('composer-tool');$('#composer-emoji').setAttribute('title','이모지 넣기');
  $('#composer-emoji').insertAdjacentHTML('afterend','<button class="composer-tool" type="button" id="composer-mention" aria-label="크루 멘션 넣기" title="크루 멘션 넣기"><span aria-hidden="true">@</span></button>');
  $('#composer-mention').onclick=()=>{if(!canPostToChannel())return;const box=$('#composer-input');box.focus();const before=box.value.slice(0,box.selectionStart);box.setRangeText((before&&!/\s$/.test(before)?' ':'')+'@',box.selectionStart,box.selectionEnd,'end');saveDraft();resizeComposer();updateSend();updateMentionPicker();};
  $('#send-message').innerHTML=`<span>보내기</span>${icon('send')}`;
  $('.directory-footnote').innerHTML=`${icon('chat')}<span>크루를 선택하면<br>개인 대화를 바로 시작해요.</span>`;
}
function enhanceConversationShell(){
  $('.shell').insertAdjacentHTML('afterbegin',`<div class="chat-categories" id="chat-category-tabs" role="tablist" aria-label="채팅 종류">${chatCategories.map(([key,label])=>`<button type="button" role="tab" id="chat-category-${key}" data-chat-category="${key}" aria-controls="conversation-panel" aria-selected="${key===state.chatCategory}" tabindex="${key===state.chatCategory?0:-1}"><span>${label}</span><span class="category-unread hidden"></span></button>`).join('')}</div>`);
  $('.main').id='conversation-panel';$('.main').setAttribute('role','tabpanel');
  $('#chat-category-tabs').onclick=event=>{const button=event.target.closest('[data-chat-category]');if(button)selectChatCategory(button.dataset.chatCategory);};
  $('#chat-category-tabs').onkeydown=event=>{const button=event.target.closest('[data-chat-category]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=chatCategories.findIndex(([key])=>key===button.dataset.chatCategory),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;const key=chatCategories[next][0];selectChatCategory(key);$(`[data-chat-category="${key}"]`)?.focus({preventScroll:true});};
  $('#global-search').insertAdjacentHTML('afterend',`<div class="conversation-filters" role="group" aria-label="대화 필터"><button class="active" data-nav-filter="all" aria-pressed="true">전체</button><button data-nav-filter="unread" aria-pressed="false">안 읽음 <span id="nav-unread-count" class="filter-count hidden"></span></button></div>`);
  $('.sidebar-scroll').innerHTML=`<div id="unread-empty" class="unread-empty hidden">${icon('check')}<strong>모두 확인했어요</strong><span>새 메시지가 오면 여기에 모여요.</span></div><section class="nav-section" data-chat-section="personal" aria-label="개인 대화방"><div id="self-nav"></div><div id="dm-nav"></div></section><section class="nav-section hidden" data-chat-section="team" aria-label="소속 팀 대화방"><div id="team-nav"></div></section><section class="nav-section hidden" data-chat-section="all" aria-label="공용·프로젝트 대화방"><div class="section-label"><button class="create-project-link" id="create-channel" type="button" aria-label="새 대화방 만들기">새 대화방 ${icon('plus')}</button></div><div id="channel-nav"></div><button class="deleted-projects-link" id="deleted-projects">${icon('trash')}삭제된 대화방</button></section>`;
  $('.channel-bar').insertAdjacentHTML('afterend','<div class="project-participation hidden" id="project-participation" aria-label="프로젝트 참여 크루"></div>');
  $('#tab-files').insertAdjacentHTML('afterend',`<button class="tab-button" id="tab-pins" aria-pressed="false">${icon('pin')}고정 메시지</button>`);
  $('#files-view').insertAdjacentHTML('afterend','<section class="pins-view hidden" id="pins-view" aria-label="고정 메시지"></section>');
  $('#composer-form').insertAdjacentHTML('beforebegin','<p class="channel-write-notice hidden" id="channel-write-notice" role="status"></p>');
  $('#composer-form').insertAdjacentHTML('afterbegin','<div class="reply-context hidden" id="reply-context"></div>');
  $$('[data-nav-filter]').forEach(button=>button.onclick=()=>{state.navFilter=button.dataset.navFilter;state.categoryFilters[state.chatCategory]=state.navFilter;renderNavigation();});
  $('#deleted-projects').onclick=deletedProjectsDialog;
  $('#tab-pins').onclick=()=>setMode('pins');
  $('#reply-context').onclick=event=>{if(event.target.closest('[data-cancel-reply]'))clearReply();};
  $('#pins-view').onclick=handleMessageAction;
  installDirectory();installProductivityUI();
}
function replyDraftKey(channelId=state.channelId){return `synk-messenger:reply:${state.user?.id}:${channelId}`;}
function restoreReply(){state.replyTarget=null;try{const reply=JSON.parse(localStorage.getItem(replyDraftKey())||'null');if(reply?.channelId===state.channelId&&reply.id&&reply.user)state.replyTarget=reply;}catch{}}
function saveReply(){if(!state.user||!state.channelId||state.unavailableChannels.has(state.channelId))return;try{if(state.replyTarget)localStorage.setItem(replyDraftKey(),JSON.stringify(state.replyTarget));else localStorage.removeItem(replyDraftKey());}catch{}}
function messagePreview(message){return message?.body||message?.files?.map(file=>file.name).join(', ')||'첨부 파일';}
function renderReplyContext(){
  const wrap=$('#reply-context');if(!wrap)return;
  const target=state.replyTarget;wrap.classList.toggle('hidden',!target);
  wrap.innerHTML=target?`${icon('reply')}<div><strong>${esc(target.user.name)} 님에게 답글</strong><span>${esc(messagePreview(target))}</span></div><button type="button" class="icon-button" data-cancel-reply aria-label="답글 취소">${icon('close')}</button>`:'';
}
function clearReply(){state.replyTarget=null;saveReply();renderReplyContext();}
function startReply(message){
  if(!canPostMessage(message)||message.channelId!==state.channelId)return;
  state.replyTarget={id:message.id,channelId:message.channelId,body:message.body,user:message.user,files:message.files?.map(file=>({name:file.name}))};saveReply();renderReplyContext();setMode('chat');closeDrawer();$('#composer-input').focus();
}
async function togglePin(message,button){
  if(!canPostMessage(message))return;button.disabled=true;
  try{await api(`/api/messages/${id(message.id)}/pin`,{method:message.pinned?'DELETE':'POST',...(message.pinned?{}:{body:{}})});await refreshMessages();if(state.mode==='pins')await loadPins();if(state.drawer==='thread'&&state.thread?.parent)await loadThread(state.thread.parent.id);toast(message.pinned?'메시지 고정을 해제했어요.':'중요한 메시지를 고정했어요.');}
  catch(error){toast(error.message,true);}finally{if(button.isConnected)button.disabled=false;}
}
async function loadPins({preserve=false}={}){
  const channelId=state.channelId,seq=++state.pinsSeq,wrap=$('#pins-view');if(!channelId||!wrap)return;
  if(!preserve)wrap.innerHTML='<div class="message-loading"><span class="spinner"></span>고정 메시지를 불러오고 있어요.</div>';
  try{const result=await api(`/api/channels/${id(channelId)}/pins`);if(seq!==state.pinsSeq||channelId!==state.channelId||state.mode!=='pins')return;state.pins=result.messages;wrap.innerHTML=`<div class="files-view-title"><div><h2>고정 메시지</h2><p class="view-description">다시 찾을 공지와 결정 사항을 모아 두세요.</p></div><span class="tag">${state.pins.length}개</span></div>${state.pins.length?`<div class="pinned-messages">${state.pins.map(message=>messageHtml(message,{panel:true})).join('')}</div>`:`<div class="large-empty"><div class="empty-tile">${icon('pin')}</div><strong>중요한 내용을 가까이에</strong><p>메시지 위의 고정 버튼을 누르면<br>이 대화방에서 함께 확인할 수 있어요.</p><button class="button" data-pins-chat>대화로 돌아가기</button></div>`}`;$('[data-pins-chat]',wrap)?.addEventListener('click',()=>setMode('chat'));}
  catch(error){if(seq!==state.pinsSeq)return;wrap.innerHTML=`<div class="large-empty"><p>${esc(error.message)}</p><button class="button" data-retry-pins>다시 불러오기</button></div>`;$('[data-retry-pins]',wrap)?.addEventListener('click',loadPins);}
}
async function openThread(message){
  if(!message?.id)return;drawerReturnFocus=document.activeElement;setMobileMenu(false,{restoreFocus:false});state.drawer='thread';state.thread={parent:message,messages:[]};
  const drawer=$('#drawer');drawer.classList.remove('hidden');drawer.innerHTML=`<div class="drawer-head"><h2>답글 모아보기</h2><button class="icon-button" id="close-drawer" aria-label="패널 닫기">${icon('close')}</button></div><div class="drawer-body thread-body" id="drawer-body"></div>`;
  $('#close-drawer').onclick=closeDrawer;$('#drawer-body').onclick=handleMessageAction;$('#close-drawer').focus({preventScroll:true});syncDrawerAccess();await loadThread(message.id);
}
async function loadThread(messageId,{before=null,preserve=false}={}){
  const channelId=state.channelId,seq=++state.threadSeq,body=$('#drawer-body');if(state.drawer!=='thread'||!body)return;
  const previous=before?state.thread?.messages||[]:[],target=preserve?Math.max(50,state.thread?.messages.length||0):50,scrollTop=body.scrollTop;
  if(!before&&!preserve)body.innerHTML='<div class="message-loading"><span class="spinner"></span>답글을 불러오고 있어요.</div>';
  try{let result=await api(`/api/messages/${id(messageId)}/replies${before?`?before=${id(before)}`:''}`),messages=result.messages;
    while(preserve&&result.hasMore&&messages.length&&messages.length<target){if(seq!==state.threadSeq||state.drawer!=='thread'||channelId!==state.channelId)return;result=await api(`/api/messages/${id(messageId)}/replies?before=${id(messages[0].id)}`);if(!result.messages.length)break;messages=[...result.messages,...messages];}
    if(seq!==state.threadSeq||state.drawer!=='thread'||channelId!==state.channelId)return;state.thread={parent:result.parent,messages:[...messages,...previous],hasMore:result.hasMore};renderThread();if(preserve)body.scrollTop=scrollTop;}
  catch(error){if(seq!==state.threadSeq||state.drawer!=='thread')return;body.innerHTML=`<div class="drawer-empty">${esc(error.message)}<button class="button" data-retry-thread>다시 불러오기</button></div>`;$('[data-retry-thread]',body)?.addEventListener('click',()=>loadThread(messageId));}
}
function renderThread(){
  if(state.drawer!=='thread'||!state.thread?.parent)return;
  const {parent,messages,hasMore}=state.thread,body=$('#drawer-body');
  body.innerHTML=`<div class="thread-parent">${messageHtml(parent,{panel:true})}</div><div class="thread-divider">답글 ${parent.replyCount||messages.length}개</div>${hasMore?'<button class="load-earlier" data-thread-earlier>이전 답글 불러오기</button>':''}${messages.length?messages.map(message=>messageHtml(message,{panel:true})).join(''):'<p class="drawer-empty">이 메시지에 이어서 이야기를 나눠 보세요.</p>'}${canPostMessage(parent)?`<button class="button thread-compose" data-thread-reply>${icon('reply')}답글 쓰기</button>`:''}`;
  $('[data-thread-reply]',body)?.addEventListener('click',()=>startReply(parent));
  $('[data-thread-earlier]',body)?.addEventListener('click',event=>{event.currentTarget.disabled=true;loadThread(parent.id,{before:messages[0]?.id});});
}
function parentMessage(type,payload={}){
  if(!moduleBase||window.parent===window)return;
  window.parent.postMessage({type,...payload},location.origin);
}
function returnToCompanyLogin(){
  stopBootRecovery();
  voice?.dispose('auth');resetTransfers();state.events?.close();state.user=null;resetWorkNotificationState();if(modal.open)modal.close();
  app.innerHTML='<div class="boot"><p>회사 계정 로그인이 필요해요.</p><a class="button primary" href="/" target="_top">워크스페이스 로그인</a></div>';
  if(window.parent!==window)parentMessage('messenger:auth-expired');
  else location.replace('/');
}
function applyIntegratedUI(){
  if(!state.integrated)return;
  const brand=$('.sidebar-brand');if(brand)brand.innerHTML='<div class="sidebar-heading"><span class="sidebar-eyebrow">CONVERSATIONS</span><strong class="module-sidebar-title">대화 목록</strong></div>';
  $('.workspace-card')?.remove();
  const profile=$('#workspace-settings');
  if(profile){if(state.integrated.canManage){profile.innerHTML=`${icon('folder')}<span><strong>파일 저장소</strong><small>Drive 연결과 보관 현황</small></span>${icon('settings')}`;profile.setAttribute('aria-label','메신저 파일 저장소 설정');}else profile.classList.add('hidden');}
  const invite=$('#invite-button');if(invite){invite.innerHTML=`${icon('users')}<span>팀 관리</span>`;invite.setAttribute('aria-label','회사 팀 관리');}
  document.body.classList.toggle('viewer-mode',!canWriteMessages());
  for(const selector of ['#create-channel','#create-project','#new-dm']){const button=$(selector);if(button)button.disabled=!canWriteMessages();}
  syncComposerAccess();
}
async function handleWorkspaceOpen(value){
  if(!state.user||!moduleVisible||typeof value.requestId!=='string'||state.workspaceOpenId===value.requestId)return;
  const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_. -]{1,100}$/.test(value);
  if(value.channelId&&value.userId||value.channelId&&!validId(value.channelId)||value.userId&&!validId(value.userId)||value.panel&&!['files','tasks','saved','workday','catchup','decisions','notifications'].includes(value.panel)||value.messageId!=null&&(!value.channelId||!/^\d{1,16}$/.test(String(value.messageId))||Number(value.messageId)<1)||value.fileId&&(!value.channelId||!validId(value.fileId)))return;
  state.workspaceOpenId=value.requestId;const request=++state.navigationSeq,userId=state.user.id;state.workspaceOpenPending=true;
  const active=()=>moduleVisible&&state.user?.id===userId&&state.workspaceOpenId===value.requestId;
  try{
    await refreshChannels();if(!active()||request!==state.navigationSeq)return;
    if(value.userId){await refreshDirectory();if(!active()||request!==state.navigationSeq)return;if(!state.members.some(person=>person.id===value.userId))throw new Error('현재 참여 중인 크루를 찾을 수 없어요.');const channelId=await openDirectMessage(value.userId);if(!active()||!channelId)return;}
    else if(value.channelId){if(!state.channels.some(channel=>channel.id===value.channelId))throw new Error('이 대화방에 접근할 수 없어요.');if(value.messageId){await openSearchMessage({id:String(value.messageId),channelId:value.channelId},{isCurrent:active});return;}const loading=selectChannel(value.channelId),navigation=state.navigationSeq;await loading;if(!active()||navigation!==state.navigationSeq)return;}
    if(!active())return;
    if(value.panel==='files'){
      if(!selectedConversation()){const self=state.channels.find(channel=>channel.kind==='self');if(self){const loading=selectChannel(self.id),navigation=state.navigationSeq;await loading;if(!active()||navigation!==state.navigationSeq)return;}}
      state.fileScope=value.channelId?'channel':'all';state.fileQuery='';state.fileType='all';setMode('files');
    }else if(['tasks','saved','workday','catchup','decisions','notifications'].includes(value.panel)){
      if(value.panel==='tasks'){state.taskScope='mine';state.taskFilter='all';}
      else state.savedView='saved';
      openPersonalPanel(value.panel==='tasks'?'workday':value.panel);
    }
    else{setMode('chat');closeDrawer();}
    setMobileMenu(false);
  }catch(error){if(active())toast(error.message,true);}
  finally{if(state.workspaceOpenId===value.requestId)state.workspaceOpenPending=false;parentMessage('messenger:open-received',{requestId:value.requestId});}
}
window.addEventListener('message',async event=>{
  if(!moduleBase||event.origin!==location.origin||event.source!==window.parent||!event.data||typeof event.data!=='object')return;
  if(event.data.type==='workspace:ready-check'){if(moduleReady)parentMessage('messenger:ready');return;}
  if(event.data.type==='workspace:visible'){const wasVisible=moduleVisible;moduleVisible=Boolean(event.data.visible);if(moduleVisible&&!wasVisible)resumeBootRecovery();if(!moduleVisible&&state.workspaceOpenPending){state.navigationSeq++;state.workspaceOpenId=null;state.workspaceOpenPending=false;}if(moduleVisible&&state.user){refreshVisibleWorkday().catch(()=>{});await refreshChannels().catch(()=>{});await refreshMessages().catch(()=>{});}else cancelWorkdayRefresh();return;}
  if(event.data.type==='workspace:open'){await handleWorkspaceOpen(event.data);return;}
  if(event.data.type==='workspace:voice'){voice?.parentAction(event.data);return;}
  if(event.data.type==='workspace:share'&&state.user&&canWriteMessages()){
    const link=safeWorkspaceLink(event.data.workspaceLink||{title:event.data.title,url:event.data.url});if(!link)return;const share=++state.shareSeq;
    let requested=event.data.channelId?state.channels.find(channel=>channel.id===event.data.channelId&&canPostToChannel(channel)):null;
    if(event.data.userId){const opened=await openDirectMessage(event.data.userId);if(share!==state.shareSeq||!opened)return;requested=state.channels.find(channel=>channel.id===opened);}
    if(event.data.channelId&&!requested){toast('선택한 대화방을 열 수 없어요. 공유할 방을 다시 선택해 주세요.',true);return;}
    if(requested&&requested.id!==state.channelId){const loading=selectChannel(requested.id),navigation=state.navigationSeq;await loading;if(share!==state.shareSeq||navigation!==state.navigationSeq)return;}
    if(!canPostToChannel()){const self=state.channels.find(channel=>channel.kind==='self'&&canPostToChannel(channel));if(!self){toast('공유할 대화방을 먼저 선택해 주세요.');return;}const loading=selectChannel(self.id),navigation=state.navigationSeq;await loading;if(share!==state.shareSeq||navigation!==state.navigationSeq)return;}
    if(share!==state.shareSeq||!canPostToChannel())return;
    setMode('chat');closeDrawer();state.workspaceLink=link;saveDraft();renderComposeExtras();updateSend();$('#composer-input').focus();
    toast('공유 카드를 초안에 넣었어요. 내용을 확인한 뒤 보내 주세요.');parentMessage('messenger:share-received',{requestId:event.data.requestId});
  }
});


function safeWorkspaceLink(value){
  if(!value||typeof value.title!=='string'||!value.title.trim()||typeof value.url!=='string')return null;
  try{const url=new URL(value.url,location.origin),view=new URLSearchParams(url.hash.slice(1)).get('view');if(url.origin!==location.origin||url.pathname!=='/'||url.search||!['overview','analysis','history','content','studio','channels'].includes(view))return null;return{title:value.title.trim().slice(0,160),url:url.href,kind:typeof value.kind==='string'?value.kind.slice(0,40):'workspace'};}catch{return null;}
}
function composeExtrasKey(channelId=state.channelId){return `synk-messenger:compose:${state.user?.id}:${channelId}`;}
function saveComposeExtras(){if(!state.user||!state.channelId||state.unavailableChannels.has(state.channelId))return;try{localStorage.setItem(composeExtrasKey(),JSON.stringify({mentionIds:state.mentionIds,workspaceLink:state.workspaceLink,ackRequired:state.ackRequired}));}catch{}}
function restoreComposeExtras(){
  let saved={};try{saved=JSON.parse(localStorage.getItem(composeExtrasKey())||'{}')||{};}catch{}
  state.mentionIds=Array.isArray(saved.mentionIds)?saved.mentionIds.filter(value=>typeof value==='string'):[];state.workspaceLink=safeWorkspaceLink(saved.workspaceLink);state.ackRequired=typeof saved.ackRequired==='boolean'?saved.ackRequired:currentChannel()?.systemKey==='announcements';closeMentionPicker();renderComposeExtras();
}
function conversationCrew(){const room=currentChannel();return state.members.filter(person=>room?.memberIds?.includes(person.id));}
function composePayload(){
  const body=$('#composer-input')?.value||'',members=conversationCrew();return{mentionIds:state.mentionIds.filter(memberId=>members.some(person=>person.id===memberId&&body.includes('@'+person.name))),workspaceLink:safeWorkspaceLink(state.workspaceLink),ackRequired:currentChannel()?.systemKey==='announcements'&&Boolean(state.ackRequired)};
}
function workspaceCardHtml(link,{draft=false}={}){
  const safe=safeWorkspaceLink(link);if(!safe)return'';
  return `<div class="workspace-link-card">${icon(safe.kind==='content-review'?'task':'project')}<span><small>${safe.kind==='content-review'?'콘텐츠 검토 요청':'워크스페이스 공유'}</small><strong>${esc(safe.title)}</strong></span>${draft?`<button type="button" class="icon-button" data-compose-remove-link aria-label="공유 카드 제거">${icon('close')}</button>`:`<button type="button" class="text-button" data-action="workspace-link">열기 ${icon('arrow')}</button>`}</div>`;
}
function renderComposeExtras(){
  const wrap=$('#compose-extras');if(!wrap)return;
  wrap.innerHTML=workspaceCardHtml(state.workspaceLink,{draft:true})+(currentChannel()?.systemKey==='announcements'&&canPostToChannel()?`<label class="ack-compose"><input type="checkbox" id="ack-required" ${state.ackRequired?'checked':''}>이 공지의 확인 여부 받기</label>`:'');wrap.classList.toggle('hidden',!wrap.innerHTML);
  $('[data-compose-remove-link]',wrap)?.addEventListener('click',()=>{state.workspaceLink=null;saveDraft();renderComposeExtras();updateSend();});$('#ack-required',wrap)?.addEventListener('change',event=>{state.ackRequired=event.target.checked;saveComposeExtras();});
}
function closeMentionPicker(){state.mentionPicker=null;const wrap=$('#mention-picker');if(wrap){wrap.classList.add('hidden');wrap.innerHTML='';}const box=$('#composer-input');box?.removeAttribute?.('aria-activedescendant');box?.setAttribute?.('aria-expanded','false');}
function updateMentionPicker(){
  const box=$('#composer-input');if(!box||composition||!canPostToChannel())return closeMentionPicker();
  const before=box.value.slice(0,box.selectionStart),match=/(?:^|\s)@([^@\n]{0,40})$/.exec(before);if(!match)return closeMentionPicker();
  const query=match[1].toLocaleLowerCase(),people=conversationCrew().filter(person=>person.id!==state.user.id&&`${person.name} ${person.teamName||''}`.toLocaleLowerCase().includes(query)).slice(0,7);
  if(!people.length)return closeMentionPicker();state.mentionPicker={people,index:0,start:before.length-query.length-1,end:box.selectionStart};renderMentionPicker();
}
function renderMentionPicker(){
  const picker=state.mentionPicker,wrap=$('#mention-picker');if(!picker||!wrap)return;wrap.classList.remove('hidden');wrap.innerHTML=`<span class="mention-heading">이 대화의 크루 멘션</span>${picker.people.map((person,index)=>`<button type="button" role="option" id="mention-option-${index}" aria-selected="${index===picker.index}" data-mention-index="${index}">${avatar(person)}<span><strong>${esc(person.name)}</strong><small>${esc(person.teamName||'팀 미배정')}</small></span></button>`).join('')}`;
  $('#composer-input')?.setAttribute('aria-expanded','true');$('#composer-input')?.setAttribute('aria-activedescendant',`mention-option-${picker.index}`);
}
function chooseMention(index){const picker=state.mentionPicker,person=picker?.people[index],box=$('#composer-input');if(!person||!box||!canPostToChannel())return;box.setRangeText(`@${person.name} `,picker.start,picker.end,'end');state.mentionIds=[...new Set([...state.mentionIds,person.id])];closeMentionPicker();box.focus();saveDraft();resizeComposer();updateSend();}
function mentionKeyboard(event){
  const picker=state.mentionPicker;if(!picker||event.isComposing||composition)return false;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMentionPicker();return true;}
  if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();picker.index=(picker.index+(event.key==='ArrowDown'?1:picker.people.length-1))%picker.people.length;renderMentionPicker();return true;}
  if(event.key==='Enter'||event.key==='Tab'){event.preventDefault();chooseMention(picker.index);return true;}return false;
}
function messageProductivityHtml(message){
  const task=message.task,reminder=message.reminder;
  return workspaceCardHtml(message.workspaceLink)+(task?`<button class="message-task" data-action="task">${icon('task')}<span><strong>${esc(task.title)}</strong><small>${esc(task.assignee?.name||'담당 미정')} · ${taskStatusLabel(taskStage(task))}${task.dueDate?' · '+esc(task.dueDate):''}</small></span>${icon('chevron')}</button>`:'')+(message.ackRequired?`<div class="message-ack"><button type="button" class="ack-button${message.acknowledged?' checked':''}" data-action="ack" ${message.acknowledged?'disabled':''}>${icon('check')}${message.acknowledged?'확인 완료':'확인했어요'}</button><button class="text-button" data-action="ack-list">확인 ${Number(message.ackCount)||0}명 · 명단 보기</button></div>`:'')+(reminder?`<span class="message-reminder">${icon('clock')}${esc(new Date(reminder.remindAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))} ${reminderStatusHtml(reminder)}</span>`:'');
}
function messageProductivityTools(message){return `<button class="icon-button" data-action="save" aria-label="${message.saved?'저장 해제':'메시지 저장'}" aria-pressed="${Boolean(message.saved)}">${icon('bookmark')}</button><button class="icon-button" data-action="remind" aria-label="나중에 다시 알림">${icon('clock')}</button>${canPostMessage(message)||message.task?`<button class="icon-button" data-action="task" aria-label="${message.task?'할 일 보기':'할 일로 만들기'}">${icon('task')}</button>`:''}${canPostMessage(message)?`<button class="icon-button" data-action="decision" aria-label="결정·최종본으로 기록">${icon('note')}</button>`:''}`;}
function installProductivityUI(){
  $('.header-actions').insertAdjacentHTML('afterbegin',`<button type="button" class="icon-button personal-bell" id="personal-bell" aria-label="알림함">${icon('bell')}<span id="personal-unread" hidden></span></button>`);
  $('#channel-search').insertAdjacentHTML('afterend',`<button type="button" class="icon-button" id="channel-notifications" aria-label="대화방 설정" title="대화방 설정">${icon('settings')}</button>`);
  $('#composer-input').insertAdjacentHTML('beforebegin','<div id="compose-extras" class="compose-extras hidden"></div><div id="mention-picker" class="mention-picker hidden" role="listbox" aria-label="멘션할 크루"></div>');
  $('#composer-input').setAttribute('aria-controls','mention-picker');$('#composer-input').setAttribute('aria-autocomplete','list');$('#composer-input').setAttribute('aria-expanded','false');
  $('#mention-picker').onmousedown=event=>event.preventDefault();$('#mention-picker').onclick=event=>{const button=event.target.closest('[data-mention-index]');if(button)chooseMention(Number(button.dataset.mentionIndex));};
  $('#composer-input').addEventListener('click',updateMentionPicker);$('#personal-bell').onclick=()=>openPersonalPanel('workday');$('#channel-notifications').onclick=roomSettingsDialog;
}
async function refreshNotificationCount(){const seq=state.notificationSeq=(state.notificationSeq||0)+1,userId=state.user?.id;try{const data=await api('/api/notifications?unread=1&limit=1');if(seq!==state.notificationSeq||userId!==state.user?.id)return;state.notificationCount=data.unreadCount||0;const badge=$('#personal-unread');if(badge){badge.hidden=!state.notificationCount;badge.textContent=state.notificationCount>99?'99+':String(state.notificationCount);}$('#personal-bell')?.setAttribute('aria-label',`내 업무 · 안 읽은 알림 ${state.notificationCount}개`);}catch{}}
const notificationLabels={dm:'개인 대화',mention:'나를 멘션',reply:'내 메시지에 답글',message:'대화방 새 메시지',reminder:'다시 볼 시간',task:'할 일 업데이트',client_workflow:'고객 업무',automation_health:'자동화 상태',social_publishing:'SNS 게시',due_digest:'오늘의 마감 알림'};
function taskStatusLabel(value){return{todo:'할 일',requested:'수락 대기',accepted:'수락함',doing:'진행 중',review:'검토 요청',changes:'수정 요청',done:'완료'}[value]||'할 일';}
function taskStage(task){return task?.stage||({todo:'requested',doing:'doing',done:'done'}[task?.status])||'requested';}
function workdayRefreshActive(){return Boolean(state.user&&state.drawer==='personal'&&state.personalTab==='workday'&&!document.hidden&&moduleVisible);}
function cancelWorkdayRefresh(){clearTimeout(workdayTimer);workdayTimer=null;workdayTimerVersion++;}
function scheduleWorkdayRefresh(delay){
  cancelWorkdayRefresh();if(!workdayRefreshActive()||!Number.isInteger(delay)||delay<1001||delay>86401000)return;
  const version=workdayTimerVersion,userId=state.user.id,session=state.workNotificationSession;
  workdayTimer=setTimeout(()=>{
    if(version!==workdayTimerVersion||userId!==state.user?.id||session!==state.workNotificationSession)return;
    workdayTimer=null;if(workdayRefreshActive())loadPersonalPanel({background:true}).catch(()=>{});
  },delay);
}
async function refreshVisibleWorkday(){if(workdayRefreshActive())await loadPersonalPanel({background:true});else cancelWorkdayRefresh();}
function openPersonalPanel(tab='workday'){
  state.notificationOpenSeq=(state.notificationOpenSeq||0)+1;
  closeDrawer();drawerReturnFocus=document.activeElement;setMobileMenu(false,{restoreFocus:false});state.drawer='personal';state.personalTab=tab;state.personalItems=[];
  const drawer=$('#drawer');drawer.classList.remove('hidden');drawer.innerHTML=`<div class="drawer-head"><h2>내 업무</h2><button class="icon-button" id="close-drawer" aria-label="패널 닫기">${icon('close')}</button></div><div class="personal-tabs productivity-tabs" role="group" aria-label="개인 도구">${[['workday','오늘 할 일'],['catchup','바뀐 것'],['tasks','전체 할 일'],['decisions','결정·최종본'],['notifications','알림'],['saved','저장']].map(([key,label])=>`<button type="button" data-personal-tab="${key}" aria-pressed="${tab===key}">${label}</button>`).join('')}</div><div class="drawer-body personal-body" id="personal-body" aria-live="polite"></div>`;
  $('#close-drawer').onclick=closeDrawer;$$('[data-personal-tab]',drawer).forEach(button=>button.onclick=()=>{state.notificationOpenSeq=(state.notificationOpenSeq||0)+1;state.personalTab=button.dataset.personalTab;state.personalItems=[];$$('[data-personal-tab]',drawer).forEach(item=>item.setAttribute('aria-pressed',String(item===button)));loadPersonalPanel();});$('#close-drawer').focus({preventScroll:true});syncDrawerAccess();loadPersonalPanel();
}
async function loadPersonalPanel({append=false,background=false}={}){
  cancelWorkdayRefresh();const body=$('#personal-body'),tab=state.personalTab,seq=++state.personalSeq;if(state.drawer!=='personal'||!body)return;const offset=append?state.personalItems.length:0;
  if(tab!=='workday'){state.workdaySnapshot=null;state.workdayBody=null;}
  if(background&&tab==='workday'&&workdayInteractionActive(body)){scheduleWorkdayRefresh(10000);return;}
  if(!append&&!(tab==='workday'&&state.workdayBody===body&&state.workdaySnapshot))body.innerHTML=`<div class="message-loading" role="status"><span class="spinner"></span>${tab==='workday'?'오늘 할 일을 확인하고 있습니다.':'불러오고 있어요.'}</div>`;
  if(['workday','catchup','decisions'].includes(tab))return loadProductivityPanel({tab,seq,append,background});
  try{
    const endpoint=tab==='notifications'?`/api/notifications?offset=${offset}&limit=30`:tab==='tasks'?`/api/tasks?scope=${state.taskScope==='channel'&&!selectedConversation()?'all':state.taskScope}&offset=${offset}&limit=30${state.taskScope==='channel'&&selectedConversation()?'&channelId='+id(state.channelId):''}${state.taskFilter==='all'?'':'&status='+state.taskFilter}`:state.savedView==='reminders'?`/api/reminders?status=pending&offset=${offset}&limit=30`:`/api/saved?offset=${offset}&limit=30`,data=await api(endpoint);if(seq!==state.personalSeq||state.drawer!=='personal'||state.personalTab!==tab)return;
    const items=tab==='notifications'?data.items:tab==='tasks'?data.tasks:state.savedView==='reminders'?data.reminders.map(item=>({...item,message:{...item.message,reminder:{id:item.id,remindAt:item.remindAt}}})):data.messages;state.personalItems=append?[...state.personalItems,...items]:items;
    if(tab==='notifications'){state.notificationCount=data.unreadCount||0;refreshNotificationCount();}
    const header=tab==='notifications'?'<div class="personal-toolbar notification-toolbar"><span>대화 · 고객 업무 · 마감 · 자동화</span><button class="text-button" id="notifications-read-all">모두 읽음</button></div><div class="personal-toolbar" role="group" aria-label="알림 설정"><button class="text-button deadline-settings-entry" type="button" id="deadline-settings" hidden>마감 알림 설정</button><button class="text-button deadline-settings-entry" type="button" id="voice-preferences-entry" hidden>통화 알림 설정</button>'+ (moduleBase?'<button class="text-button deadline-settings-entry" type="button" id="device-notifications-entry">이 기기의 알림 설정</button>':'')+'</div>':tab==='tasks'?`<div class="personal-toolbar"><select id="personal-task-scope" aria-label="할 일 범위"><option value="mine" ${state.taskScope==='mine'?'selected':''}>내게 배정됨</option><option value="channel" ${state.taskScope==='channel'?'selected':''} ${selectedConversation()?'':'disabled'}>이 대화방</option><option value="all" ${state.taskScope==='all'?'selected':''}>참여한 모든 방</option></select><select id="personal-task-filter" aria-label="할 일 상태">${[['all','전체 상태'],['todo','할 일'],['doing','진행 중'],['done','완료']].map(([key,label])=>`<option value="${key}" ${state.taskFilter===key?'selected':''}>${label}</option>`).join('')}</select></div>`:`<div class="personal-toolbar"><span>나만의 보관함</span><select id="personal-saved-filter" aria-label="저장과 예약한 알림"><option value="saved" ${state.savedView==='saved'?'selected':''}>저장한 메시지</option><option value="reminders" ${state.savedView==='reminders'?'selected':''}>예약한 알림</option></select></div>`;
    body.innerHTML=header+(state.personalItems.length?state.personalItems.map((item,index)=>personalItemHtml(item,index,tab)).join(''):`<div class="drawer-empty">${icon(tab==='notifications'?'bell':tab==='tasks'?'task':'bookmark')}<strong>${tab==='notifications'?'아직 알림이 없어요':tab==='tasks'?'배정된 할 일이 없어요':'저장한 메시지가 없어요'}</strong><p>${tab==='saved'?'메시지의 책갈피를 눌러 보관하세요.':tab==='tasks'?'메시지에서 ‘할 일로 만들기’를 누르고 담당자를 지정하면 여기에 모여요.':'관련 소식이 생기면 여기에 모여요.'}</p></div>`)+(data.hasMore?'<button class="button personal-more" id="personal-more">더 보기</button>':'')+(tab==='tasks'?taskSelectionHtml():'');
    $('#personal-task-scope')?.addEventListener('change',event=>{state.taskScope=event.target.value;loadPersonalPanel();});$('#personal-task-filter')?.addEventListener('change',event=>{state.taskFilter=event.target.value;loadPersonalPanel();});$('#personal-saved-filter')?.addEventListener('change',event=>{state.savedView=event.target.value;loadPersonalPanel();});
    $('#personal-more')?.addEventListener('click',event=>{event.currentTarget.disabled=true;loadPersonalPanel({append:true});});$('#notifications-read-all')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await api('/api/notifications/read-all',{method:'POST',body:{}});await loadPersonalPanel();await refreshNotificationCount();}catch(error){toast(error.message,true);event.currentTarget.disabled=false;}});
    if(tab==='notifications'){attachDeadlineSettings();const voiceEntry=$('#voice-preferences-entry');if(voiceEntry&&voice?.enabled()){voiceEntry.hidden=false;voiceEntry.onclick=()=>voice.preferencesDialog();}$('#device-notifications-entry')?.addEventListener('click',()=>parentMessage('messenger:device-notifications'));}
    body.onclick=async event=>{const target=event.target.closest('[data-personal-index]');if(!target)return;const item=state.personalItems[Number(target.dataset.personalIndex)];if(!item)return;if(tab==='notifications')return openPersonalNotification(item);const message=tab==='tasks'?taskMessage(item):item.message||item;if(!message)return;const action=target.dataset.personalAction;
      if(action==='task')return openTaskDetail(message);if(action==='remind')return reminderDialog(message);if(action==='save')return handleProductivityAction('save',message,target);
      try{const navigation=state.navigationSeq;if(tab==='notifications'&&!item.readAt){await api(`/api/notifications/${id(item.id)}/read`,{method:'POST',body:{}});refreshNotificationCount();}if(navigation!==state.navigationSeq||state.drawer!=='personal'||state.personalTab!==tab)return;await openSearchMessage(message);}catch(error){toast(error.message,true);}};
  }catch(error){if(seq===state.personalSeq&&state.drawer==='personal'){body.innerHTML=`<div class="drawer-empty">${esc(error.message)}<button class="button" id="personal-retry">다시 불러오기</button></div>`;$('#personal-retry').onclick=()=>loadPersonalPanel();}}
}
function personalItemHtml(item,index,tab){
  if(tab==='notifications'&&item.kind==='voice_invitation')return voiceNotificationHtml(item,index);
  if(tab==='notifications'&&['client_workflow','automation_health','social_publishing','due_digest'].includes(item.kind))return workflowNotificationHtml(item,index);
  const task=tab==='tasks'?item:null,message=task?null:item.message||item,channel=state.channels.find(room=>room.id===(task?.channelId||message?.channelId));
  return `<article class="personal-item${tab==='notifications'&&!item.readAt?' is-unread':''}"><button type="button" class="personal-item-main" data-personal-index="${index}" data-personal-action="${task?'task':'open'}"><span class="personal-item-meta">${esc(task?taskStatusLabel(taskStage(task)):tab==='notifications'?notificationLabels[item.kind]||'알림':message?.user?.name||'저장한 메시지')}<time>${esc(shortDate(item.createdAt||message?.createdAt))}</time></span><strong>${esc(task?.title||message?.body||message?.workspaceLink?.title||'첨부 파일')}</strong><small>${esc(channel?.name||'대화방')}${task?` · ${esc(task.dueDate||'기한 없음')}`:message?.reminder?` · ${esc(new Date(message.reminder.remindAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))} ${reminderStatusHtml(message.reminder)}`:''}</small>${task?'<span class="notification-open-label">할 일 상세 보기 '+icon('arrow')+'</span>':''}</button><div class="personal-item-actions">${task?`<button type="button" class="text-button" data-personal-index="${index}" data-personal-action="open">원문 대화 열기</button>`:tab==='saved'?`<button class="icon-button" data-personal-index="${index}" data-personal-action="remind" aria-label="다시 볼 시간 설정">${icon('clock')}</button><button class="text-button" data-personal-index="${index}" data-personal-action="save">${message.saved?'저장 해제':'저장'}</button>`:''}</div></article>`;
}
function voiceNotificationHtml(item,index){
  const invitation=item.voiceInvitation||{},from=state.members.find(member=>member.id===invitation.fromUserId)?.name||'동료',room=state.channels.find(channel=>channel.id===invitation.channelId)?.name||'대화방',open=invitation.state==='pending'&&Date.parse(item.expiresAt||invitation.expiresAt)>Date.now();
  return `<article class="personal-item workflow-notification${!item.readAt?' is-unread':''}"><button type="button" class="personal-item-main" data-personal-index="${index}" data-personal-action="open"><span class="personal-item-meta">통화 초대<time>${esc(shortDate(item.createdAt))}</time></span><strong>${esc(from)}님이 통화에 불렀어요</strong><p>${esc(room)} · ${open?'응답을 기다리고 있어요':'끝난 초대예요'}</p><small>알림을 열어도 자동으로 참가하거나 마이크를 켜지 않아요.</small><span class="notification-open-label">${open?'초대 확인하기':'상태 확인하기'} ${icon('arrow')}</span></button></article>`;
}
function taskSelectionHtml(){
  const scope=state.taskScope==='mine'?'현재는 나를 담당자로 지정한 업무만 보여요.':state.taskScope==='channel'&&selectedConversation()?'현재 대화방에 등록된 업무를 보여요.':'내가 참여하고 열람할 수 있는 대화방의 업무를 보여요.';
  return `<details class="task-selection"><summary>이 목록은 어떤 기준인가요?</summary><p>대화 메시지에서 사람이 ‘할 일로 만들기’를 누르고 담당자와 기한을 정한 업무예요. AI가 자동으로 선정하거나 배정하지 않아요.</p><p>${scope} ‘전체 상태’에는 완료된 일도 포함돼요.</p><p>기한이 있는 일부터 가까운 기한 순으로, 같은 기한이면 최근에 만든 일부터 보여요. 기한이 없는 일은 그 뒤에 최근 생성 순으로 보여요.</p></details>`;
}
function workflowNotificationHtml(item,index){
  if(item.kind==='social_publishing')return `<article class="personal-item workflow-notification${!item.readAt?' is-unread':''}"><button type="button" class="personal-item-main" data-personal-index="${index}" data-personal-action="open"><span class="personal-item-meta">SNS 게시<time>${esc(shortDate(item.createdAt))}</time></span><strong>${esc(item.title||'SNS 발행 확인')}</strong><p>${esc(item.text||'발행 상태를 확인해 주세요.')}</p><span class="notification-open-label">SNS 대기열 열기 ${icon('arrow')}</span></button></article>`;
  if(item.kind==='automation_health')return `<article class="personal-item workflow-notification${!item.readAt?' is-unread':''}"><button type="button" class="personal-item-main" data-personal-index="${index}" data-personal-action="open"><span class="personal-item-meta">자동화 상태<time>${esc(shortDate(item.createdAt))}</time></span><strong>${esc(item.title||'자동화 확인 필요')}</strong><p>${esc(item.text||'현재 자동화의 처리 상태를 확인해 주세요.')}</p><small>작업실 안에서만 표시 · 읽음은 문제 해결과 별개</small><span class="notification-open-label">자동화 상태 열기 ${icon('arrow')}</span></button></article>`;
  const due=item.kind==='due_digest',digest=item.digest||{},tasks=digest.tasks||[],title=due?`${digest.date||'오늘'} 마감 업무 ${Number(digest.taskCount??tasks.length)}개`:item.title||'고객 업무가 바뀌었어요';
  const text=due?`${Number(digest.overdueCount)||0}개 기한 지남 · 현재 남아 있는 업무를 확인하세요.`:item.text||item.body||'',detail=due?'마감 업무·원문 보기':`${item.projectTitle||'고객 프로젝트'}${Number.isFinite(item.seconds)?' · '+Math.floor(item.seconds/60)+':'+String(Math.floor(item.seconds%60)).padStart(2,'0')+' 장면':''}`;
  return `<article class="personal-item workflow-notification${!item.readAt?' is-unread':''}"><button type="button" class="personal-item-main" data-personal-index="${index}" data-personal-action="open"><span class="personal-item-meta">${notificationLabels[item.kind]}<time>${esc(shortDate(item.createdAt))}</time></span><strong>${esc(title)}</strong><p>${esc(text)}</p><small>${esc(detail)}</small><span class="notification-open-label">${due?'업무 묶음 열기':'고객 의견·검토 열기'} ${icon('arrow')}</span></button></article>`;
}
async function openPersonalNotification(item){
  const navigation=state.navigationSeq,seq=state.notificationOpenSeq=(state.notificationOpenSeq||0)+1,userId=state.user?.id;
  const current=()=>navigation===state.navigationSeq&&seq===state.notificationOpenSeq&&userId===state.user?.id&&state.drawer==='personal'&&state.personalTab==='notifications';
  try{
    if(item.kind==='voice_invitation'){if(!item.readAt){await api(`/api/notifications/${id(item.id)}/read`,{method:'POST',body:{}});item.readAt=new Date().toISOString();refreshNotificationCount();}if(current())await voice?.openInvitation(item.voiceInvitation?.id);return;}
    const customer=item.kind==='client_workflow',due=item.kind==='due_digest',automation=item.kind==='automation_health',social=item.kind==='social_publishing',href=customer?safeClientWorkflowHref(item.href):null;
    if(customer&&!href)throw new Error('이 고객 업무의 연결을 확인할 수 없어요. 목록을 새로 불러와 주세요.');
    if(automation&&!moduleBase)throw new Error('자동화 상태는 기존 작업실에서 확인해 주세요.');
    if(social&&!moduleBase)throw new Error('SNS 게시는 회사 워크스페이스에서 확인해 주세요.');
    if(!customer&&!due&&!automation&&!social&&(!item.message?.id||!item.message?.channelId))throw new Error('원래 대화에 접근할 수 없어요. 목록을 새로 불러와 주세요.');
    if(!item.readAt){await api(`/api/notifications/${id(item.id)}/read`,{method:'POST',body:{}});item.readAt=new Date().toISOString();refreshNotificationCount();}
    if(!current())return;
    if(social){if(moduleVisible)parentMessage('messenger:social-open');return;}
    if(automation){if(moduleVisible)parentMessage('messenger:automation-open');return;}
    if(customer){if(moduleBase)parentMessage('messenger:client-open',{url:href});else location.assign(href);return;}
    if(due){showDeadlineDigest(item);return;}
    await openSearchMessage(item.message);
  }catch(error){if(current())toast(error.message,true);}
}
function showDeadlineDigest(item){
  const digest=item.digest||{},tasks=Array.isArray(digest.tasks)?digest.tasks:[];
  openModal('마감 업무 묶음',`<p class="modal-description">${esc(digest.date||'오늘')}에 모은 업무 중 현재 남아 있는 ${tasks.length}개예요. 기한이나 진행 상황은 업무를 열어 확인하세요.</p><div class="deadline-digest-list">${tasks.length?tasks.map((task,index)=>workdayTaskHtml(task,index,digest.date||'').replace('data-workday-task=','data-digest-task=')).join(''):'<p class="workday-empty">지금 남아 있는 마감 업무가 없어요.</p>'}</div><div class="modal-actions"><button class="button primary" type="button" id="digest-today">오늘 업무함 열기</button></div>`);
  $('.modal-body',modal).onclick=event=>{const source=event.target.closest('[data-source-message]'),taskButton=event.target.closest('[data-digest-task]');if(source){modal.close();openProductivitySource(source);}else if(taskButton){const task=tasks[Number(taskButton.dataset.digestTask)];if(task)openTaskDetail(taskMessage(task));}};
  $('#digest-today').onclick=()=>{modal.close();openPersonalPanel('workday');};
}
async function attachDeadlineSettings(){
  const button=$('#deadline-settings');if(!button)return;const userId=state.user?.id,session=state.workNotificationSession;
  if(state.deadlineSettingsUser!==userId){state.deadlineSettings=undefined;state.deadlineSettingsUser=userId;}
  try{
    const settings=await loadWorkNotificationSettings();
    if(!settings||userId!==state.user?.id||session!==state.workNotificationSession||!button.isConnected)return;
    button.hidden=false;button.onclick=async()=>{
      button.disabled=true;
      try{const settings=await loadWorkNotificationSettings();if(settings&&userId===state.user?.id&&session===state.workNotificationSession&&button.isConnected)deadlineSettingsDialog();}
      catch(error){if(userId===state.user?.id&&session===state.workNotificationSession){toast('업무 알림 가동 여부를 확인하지 못했어요. 다시 열어 주세요.',true);}}
      finally{if(button.isConnected)button.disabled=false;}
    };
  }catch(error){if(error.status===404&&userId===state.user?.id&&session===state.workNotificationSession)state.deadlineSettings=null;}
}
function setWorkNotificationStatus(enabled,{invalidatePending=false}={}){if(invalidatePending)state.workNotificationRevision++;state.scheduledNotifications={enabled:typeof enabled==='boolean'?enabled:null};$$('[data-reminder-status]').forEach(label=>{label.textContent=reminderStatusLabel({deliveredAt:label.dataset.reminderDelivered==='1'});});}
function resetWorkNotificationState(){cancelWorkdayRefresh();state.personalSeq++;state.workNotificationSession++;setWorkNotificationStatus(null,{invalidatePending:true});state.deadlineSettings=undefined;state.deadlineSettingsUser=null;state.publicationWork=[];state.customerWork=[];state.clientRechecks={};state.clientRecheckToday=null;state.customerGroupIdentity=null;state.workdaySnapshot=null;state.workdayBody=null;}
async function loadWorkNotificationSettings(){
  const userId=state.user?.id,session=state.workNotificationSession,revision=++state.workNotificationRevision;
  try{const settings=await api('/api/workday/notifications');if(!userId||userId!==state.user?.id||session!==state.workNotificationSession||revision!==state.workNotificationRevision)return null;state.deadlineSettings=settings;state.deadlineSettingsUser=userId;setWorkNotificationStatus(settings.schedulerEnabled);return settings;}
  catch(error){if(userId!==state.user?.id||session!==state.workNotificationSession||revision!==state.workNotificationRevision)return null;setWorkNotificationStatus(null);throw error;}
}
function reminderStatusLabel(reminder){return reminder.deliveredAt?'알림함에 도착':state.scheduledNotifications.enabled===true?'알림 예정':state.scheduledNotifications.enabled===false?'알림 중지 중':'알림 가동 확인 필요';}
function reminderStatusHtml(reminder){return `<span data-reminder-status data-reminder-delivered="${reminder.deliveredAt?'1':'0'}">${reminderStatusLabel(reminder)}</span>`;}
function workNotificationStatusText(enabled){return enabled===true?'회사 업무 알림이 실행 중이에요.':enabled===false?'현재 업무 알림이 중지되어 있어 예약할 수 없습니다. 회사 관리자에게 문의해 주세요.':'업무 알림 가동 여부를 확인할 수 없어 예약할 수 없어요. 잠시 후 다시 열어 주세요.';}
function deadlineSettingsDialog(){
  const preferences=state.deadlineSettings;if(!preferences)return;
  let schedulerEnabled=typeof preferences.schedulerEnabled==='boolean'?preferences.schedulerEnabled:null;
  const statusText=()=>schedulerEnabled===true?'회사 업무 알림이 실행 중이에요.':schedulerEnabled===false?'회사 업무 알림이 중지되어 있어요. 개인 설정이 켜져 있어도 마감 알림은 전달되지 않아요. 설정을 끄는 것은 가능해요.':'회사 업무 알림의 가동 여부를 확인할 수 없어요. 알림을 켜는 것은 확인 후 가능하며, 기존 설정을 끄는 것은 가능해요.';
  openModal('마감 알림 설정',`<p class="modal-description">한국 시간 오전 9시 이후, 오늘까지 마감인 내 업무를 하루 한 번 모아 알림함에 남겨요.</p><p class="workflow-help" id="deadline-scheduler-status" role="status">${esc(statusText())}</p><form id="deadline-settings-form" class="workflow-form"><label class="workflow-checkbox"><input type="checkbox" name="enabled" ${preferences.enabled?'checked':''} ${schedulerEnabled!==true&&!preferences.enabled?'disabled':''}><span><strong>내 마감 업무 알림 받기</strong><small>오늘 마감이거나 기한이 지난 내 업무를 모아요.</small></span></label><label class="workflow-checkbox"><input type="checkbox" name="includeWeekends" ${preferences.includeWeekends?'checked':''}><span><strong>주말에도 받기</strong><small>기본은 월요일부터 금요일까지예요.</small></span></label><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button primary" type="submit" ${schedulerEnabled!==true&&preferences.enabled?'disabled':''}>설정 저장</button></div></form>`);
  const version=modalVersion,userId=state.user?.id,session=state.workNotificationSession,form=$('#deadline-settings-form'),enabledControl=$('input[name=enabled]',form),button=$('button[type=submit]',form),active=()=>modal.open&&version===modalVersion&&userId===state.user?.id&&session===state.workNotificationSession;
  const update=()=>{if(!active())return;const status=$('#deadline-scheduler-status');if(status)status.textContent=statusText();if(enabledControl&&schedulerEnabled!==true&&!enabledControl.checked)enabledControl.disabled=true;button.disabled=schedulerEnabled!==true&&Boolean(enabledControl?.checked);};
  if(enabledControl)enabledControl.onchange=update;
  form.onsubmit=async event=>{
    event.preventDefault();if(!active())return;const values=new FormData(form),enabled=values.has('enabled');
    if(enabled&&schedulerEnabled!==true){formError('업무 알림이 실행 중일 때 마감 알림을 켤 수 있어요. 지금은 설정을 끌 수 있어요.');return;}
    button.disabled=true;
    try{const data=await api('/api/workday/notifications',{method:'PATCH',body:{enabled,includeWeekends:values.has('includeWeekends')}});if(userId!==state.user?.id||session!==state.workNotificationSession||state.deadlineSettingsUser!==userId)return;state.deadlineSettings=data;setWorkNotificationStatus(data.schedulerEnabled,{invalidatePending:true});if(active())modal.close();refreshNotificationCount();toast('마감 알림 설정을 저장했어요.');}
    catch(error){if(active()){if(error.code==='SYNK_WORK_NOTIFICATIONS_PAUSED'){schedulerEnabled=false;setWorkNotificationStatus(false,{invalidatePending:true});}formError(error.message);update();}}
  };
}
const workdayGroups=[['reply','내가 답할 요청','담당자로 지정된 요청을 확인하고 수락하세요.'],['due','오늘·지난 마감','오늘 마감이거나 기한을 넘긴 내 일이에요.'],['review','내가 검토할 결과','결과물을 보고 승인하거나 수정을 요청하세요.'],['waiting','내 요청의 진행 상황','다른 크루에게 맡긴 일과 검토를 기다리는 일이에요.']];
const todayWorkdayGroups=[['reply','요청 확인·수정 대응','새 요청을 수락하거나 수정 요청에 답해야 합니다.'],['due','오늘 마감·기한 지난 작업','오늘까지 마쳐야 하거나 기한을 넘긴 내 작업입니다.'],['review','내가 검토할 결과','내가 결과물을 보고 승인하거나 수정을 요청해야 합니다.'],['recovery','검토자 지정 필요','검토할 수 없는 크루를 대신할 새 검토자를 지정해야 합니다.']];
const remainingWorkdayGroups=[['upcoming','이후 마감','오늘 이후에 마감되는 내 작업입니다.'],['undated','기한 미정','남아 있는 내 작업이지만 기한이 정해져 있지 않습니다.'],['waiting','내 요청의 진행 상황','다른 크루의 작업이나 검토 답변을 기다리는 업무입니다.']];
function hasWorkdayClassification(work){return Boolean(work?.today?.groups&&work?.remaining?.groups&&todayWorkdayGroups.every(([key])=>Array.isArray(work.today.groups[key]))&&remainingWorkdayGroups.every(([key])=>Array.isArray(work.remaining.groups[key])));}
function workdayCustomerCount(client,waiting=false){return new Set((client?.data?.items||[]).filter(item=>waiting?item.group==='waiting':['reply','review','next'].includes(item.group)).map(item=>item.id)).size;}
function workdaySummaryHtml(work,client,publication={data:{items:[]}}){
  if(!hasWorkdayClassification(work))return '<section class="workday-status workday-unverified" role="status"><h3>오늘 할 일을 정확히 분류할 수 없습니다</h3><p>업무 분류 정보를 확인하지 못했습니다. 표시된 기록을 확인하거나 다시 불러와 주세요. 할 일이 없다는 뜻은 아닙니다.</p></section>';
  const todayTasks=[...new Map(Object.values(work.today.groups).flat().map(task=>[task.id,task])).values()],pending=[...new Map([...work.remaining.groups.upcoming,...work.remaining.groups.undated].map(task=>[task.id,task])).values()],customers=[...new Map((client?.data?.items||[]).filter(item=>['reply','review','next'].includes(item.group)).map(item=>[item.id,item])).values()],publications=publicationWorkflowItems(publication.data?.items),count=todayTasks.length+customers.length+publications.length,tasks=count?todayTasks:pending,remaining=work.remaining.counts||{},customerWaiting=workdayCustomerCount(client,true),clientComplete=!client?.error&&(!state.integrated||Array.isArray(client?.data?.items)),publicationComplete=!publication?.error&&(!publicationWorkflowAvailable()||Array.isArray(publication?.data?.items)),complete=clientComplete&&publicationComplete;
  const title=!complete?(count?`확인된 오늘 할 일 ${count}개`:'오늘 할 일 확인이 완료되지 않았습니다'):count?`오늘 처리할 일 ${count}개`:pending.length?`남아 있는 내 업무 ${pending.length}개`:'오늘 처리할 일이 없습니다';
  const deferredCount=client?.data?.deferredItems?.length||0;
  const parts=[deferredCount?`다시 볼 날짜를 정한 일 ${deferredCount}개`:'',remaining.upcoming?`이후 마감 ${remaining.upcoming}개`:'',remaining.undated?`기한 미정 ${remaining.undated}개`:'',remaining.waiting||customerWaiting?`대기 중 ${(remaining.waiting||0)+customerWaiting}개`:''].filter(Boolean);
  const quick=tasks.map(task=>`<button type="button" class="workday-quick-task" data-workday-task-id="${esc(task.id)}"><strong>${esc(task.title)}</strong><span>${esc(count?workdayActionText(task):task.dueDate?`마감 ${task.dueDate} · 진행 상태를 확인하세요.`:'기한 미정 · 오늘 진행할 내용과 기한을 확인하세요.')}</span></button>`).join('')+(Array.isArray(client?.data?.projectGroups)?[]:customers).map(item=>{const href=safeClientWorkflowHref(item.href),index=state.customerWork.findIndex(row=>row.id===item.id),content=`<strong>${esc(item.kind==='follow_up'&&item.projectTitle?item.title+' · '+item.projectTitle:item.title)}</strong><span>${esc(item.text||item.statusLabel||'요청 내용과 현재 상태를 확인하세요.')}</span>`;return href&&index>=0?`<a class="workday-quick-task" href="${esc(href)}" target="_top" data-client-open="${index}">${content}</a>`:`<p class="workday-quick-task">${content}</p>`;}).join('')+publications.map(item=>{const href=safePublicationWorkflowHref(item.href),content=`<strong>${esc(item.title)}</strong><span>${esc(item.text||item.statusLabel||'게시 단계의 다음 할 일을 확인하세요.')}</span>`;return href?`<a class="workday-quick-task" href="${esc(href)}" target="_top" data-publication-open="${esc(item.id)}">${content}</a>`:`<p class="workday-quick-task">${content}</p>`;}).join('');
  const unchecked=[!clientComplete?'고객 업무':'',!publicationComplete?'게시 업무':''].filter(Boolean).join('와 ');
  return `<section class="workday-status${count?' has-work':''}${!complete?' workday-unverified':''}" role="status"><h3>${title}</h3><p>${!complete?`${unchecked}를 확인하지 못했습니다. 전체 할 일이 없다고 판단할 수 없습니다.`:count?'아래 업무를 지금 처리하세요.':pending.length?'오늘 마감·응답·검토 대상은 없습니다. 남은 업무의 기한과 진행 상황을 확인해 주세요.':deferredCount?'다시 볼 날짜를 정한 미완료 업무가 있습니다. 아래 목록에서 언제든 다시 열 수 있어요.':parts.length?'다른 사람의 작업이나 답변을 기다리는 업무가 있습니다.':'내게 배정된 미완료 업무와 내가 처리할 고객·게시 업무도 없습니다.'}</p>${parts.length?`<p class="workday-remaining-counts">${parts.join(' · ')}</p>`:''}${quick?`<div class="workday-quick-list" aria-label="${count?'지금 처리할 업무':'남아 있는 내 업무'}">${quick}</div>`:''}<details class="workday-criteria"><summary>오늘 할 일 기준</summary><p>지금 답할 요청·수정 요청, 오늘까지 마칠 작업, 내가 검토하거나 검토자를 지정할 업무입니다.${publicationWorkflowAvailable()?' 내 완성본의 게시 준비, 게시 주소 기록, 확인 시각이 지난 성과 보완도 함께 보여 줍니다. 게시 업무는 원본 상태가 바뀌면 자동으로 갱신됩니다.':''} 회사에 등록된 업무와 현재 담당·검토 역할을 기준으로 확인했습니다. 완료된 업무는 ‘전체 할 일’에서 볼 수 있습니다. 다시 볼 날짜를 정한 고객 업무는 별도 목록에 보관되며 원래 기한과 자동화 점검은 유지됩니다.</p></details></section>`;
}
function workdayActionText(task){
  const stage=taskStage(task),mine=task.assignee?.id===state.user?.id,reviewer=taskReviewerId(task)===state.user?.id;
  if(stage==='done'&&(task.assigneeUnavailable||task.reviewerUnavailable))return '완료 기록과 결과물은 유지됩니다. 추가 작업은 기존 담당·검토자의 참여 권한을 확인하거나 새 업무로 요청하세요.';
  if(task.assigneeUnavailable||!task.assignee?.id)return '현재 담당 크루를 확인할 수 없습니다. 요청자에게 담당 크루를 확인해 주세요.';
  if(task.canManage===false)return '현재 계정은 이 업무의 상태를 변경할 수 없습니다. 요청자에게 담당·권한을 확인하세요.';
  if(task.canReassignReviewer)return stage==='review'?'같은 결과물을 검토할 새 크루를 지정하세요.':'기존 요청과 담당자를 유지하고 새 검토 크루를 지정하세요.';
  if(task.reviewerUnavailable&&stage!=='done')return '기존 검토자가 검토할 수 없습니다. 담당자가 아닌 요청자나 관리자에게 새 검토자 지정을 요청하세요.';
  if(stage==='review')return reviewer?'제출된 결과물을 확인하고 승인하거나 수정을 요청하세요.':'지정된 검토 크루의 답변을 기다리는 상태입니다.';
  if(!mine)return `${task.assignee?.name||'담당 크루'}의 작업 결과를 기다리는 상태입니다.`;
  return {requested:'요청 내용과 기한을 확인하고 수락하세요.',changes:'원문 답글의 수정 의견을 반영해 결과물을 보완하세요.',accepted:'작업을 시작하고 진행 상태를 진행 중으로 바꾸세요.',doing:'요청한 작업을 마치고 결과물 파일이나 링크를 등록하세요.',done:'완료된 결과물을 확인할 수 있습니다.'}[stage]||'요청 원문과 현재 상태를 확인하세요.';
}
const catchUpLabels={task_reviewer_reassigned:'검토자 다시 지정',task_created:'새 업무 요청',task_stage:'업무 상태 변경',task_due:'기한 변경',task_assignment:'담당·검토 크루 변경',task_updated:'업무 내용·결과물 변경',decision:'새 결정·최종본',decision_replaced:'결정·최종본 변경'};
function personName(person){return person?.name||state.members.find(member=>member.id===person)?.name||'크루';}
function taskMessage(task){return {...task.message,id:task.messageId,channelId:task.channelId,body:task.message?.body||task.title,task};}
function sourceButton(message,label='원래 대화',attributes=''){
  return message?.id&&message.channelId?`<button type="button" class="text-button" data-source-message="${esc(message.id)}" data-source-channel="${esc(message.channelId)}" ${attributes}>${esc(label)} ${icon('arrow')}</button>`:'';
}
async function openProductivitySource(button){
  try{await openSearchMessage({id:button.dataset.sourceMessage,channelId:button.dataset.sourceChannel});}catch(error){toast(error.message,true);}
}
function workdayTaskHtml(task,index,date,{remaining=false}={}){
  const stage=taskStage(task),overdue=task.dueDate&&task.dueDate<date,room=state.channels.find(channel=>channel.id===task.channelId);
  return `<article class="workday-item"><span class="workday-meta"><span class="workflow-stage" data-stage="${esc(stage)}">${taskStatusLabel(stage)}</span><span class="${overdue?'overdue':''}">${esc(task.dueDate?(overdue?'기한 지남 · ':'')+task.dueDate:'기한 없음')}</span></span><h4>${esc(task.title)}</h4><p>${esc((task.assignee?.name||'담당 미정')+(task.assigneeUnavailable||!task.assignee?.id?' · 담당 확인 필요':''))}${task.reviewer?' · 검토 '+esc(task.reviewer.name)+(task.reviewerUnavailable?' · 검토 불가':''):task.reviewerUnavailable?' · 기존 검토자 · 검토 불가':''} · ${esc(room?.name||'대화방')}</p><p class="workday-request-preview">${task.message?.body?esc(task.message.body.slice(0,180)):'구체적인 작업 설명이 등록되어 있지 않습니다. 요청 원문을 확인하세요.'}</p><p class="workday-next-action"><strong>${remaining?(['review','done'].includes(stage)||task.assignee?.id!==state.user?.id?'현재 상태':'작업할 때 할 행동'):'지금 할 행동'}</strong> ${esc(workdayActionText(task))}</p><div class="workday-actions"><button class="button" type="button" data-workday-task="${index}">${remaining?'상태 확인':task.canReassignReviewer?'검토자 다시 지정':stage==='requested'?'요청 확인':stage==='review'?'결과물 검토':'업무 열기'}</button>${sourceButton(taskMessage(task))}</div></article>`;
}
function safeClientWorkflowHref(value){
  try{const url=new URL(value,location.origin),contexts=['followUp','delivery','closeout','kickoff','changes','requests','schedule','rights'],allowed=new Set(['tab','section','project','version','message','seconds','rightsTarget',...contexts]);if(url.origin!==location.origin||url.username||url.password||url.hash||url.pathname!=='/'||url.searchParams.get('tab')!=='workroom'||url.searchParams.get('section')!=='clients'||!url.searchParams.get('project'))return null;for(const key of url.searchParams.keys())if(!allowed.has(key)||url.searchParams.getAll(key).length!==1)return null;const rightsTarget=url.searchParams.get('rightsTarget');if(url.searchParams.has('rights')||rightsTarget!==null){const keys=[...url.searchParams.keys()];if(url.searchParams.get('rights')!=='1'||keys.length!==(rightsTarget?5:4)||keys.some(key=>!['tab','section','project','rights','rightsTarget'].includes(key))||rightsTarget!==null&&rightsTarget!=='portfolio'&&!/^material:(?:intake|asset|reference|concept|scene|version):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rightsTarget)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(url.searchParams.get('project')))return null;return url.href;}const selected=contexts.filter(key=>url.searchParams.has(key));if(selected.length&&(selected.length!==1||url.searchParams.get(selected[0])!=='1'||[...url.searchParams.keys()].length!==4))return null;const seconds=url.searchParams.get('seconds');if(seconds!==null&&(!/^(?:\d+)(?:\.\d+)?$/.test(seconds)||!Number.isFinite(Number(seconds))))return null;return url.href;}catch{return null;}
}
function publicationWorkflowAvailable(){return Boolean(moduleBase&&state.integrated);}
function safeDeadlineOverlapHref(value,projectId){
  if(typeof value!=='string'||!value||typeof projectId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId))return null;
  try{const url=new URL(value,location.origin),params=url.searchParams;if(url.origin!==location.origin||url.username||url.password||url.hash||params.get('project')!==projectId)return null;for(const key of params.keys())if(params.getAll(key).length!==1)return null;if(url.pathname==='/')return safeClientWorkflowHref(value);if(url.pathname!=='/pulse-app/'||params.get('mode')!=='staff'||!['strategy','review'].includes(params.get('tab'))||[...params.keys()].some(key=>!['mode','project','tab','scene'].includes(key))||params.has('scene')&&!params.get('scene'))return null;return url.href;}catch{return null;}
}
function validDeadlineOverlaps(data){
  const number=value=>Number.isSafeInteger(value)&&value>=0,period=data?.period,counts=data?.counts,observations=data?.observations;
  if(!period||!clientRecheckDate(period.startDate)||!clientRecheckDate(period.endDate)||Date.parse(period.endDate)-Date.parse(period.startDate)!==30*86400000||period.daysAhead!==30||period.inclusive!==true||period.timezone!=='Asia/Seoul'||!counts||!['visibleProjectCount','eligibleProjectCount','rangeProjectCount','rangeMilestoneCount','overlapDayCount','overlapProjectCount','overlapMilestoneCount'].every(key=>number(counts[key]))||!Array.isArray(data.days)||!observations?.excluded||!['disabled','archived','closed','complete'].every(key=>number(observations.excluded[key])))return false;
  if(counts.eligibleProjectCount>counts.visibleProjectCount||counts.rangeProjectCount>counts.eligibleProjectCount||counts.overlapProjectCount>counts.rangeProjectCount||counts.overlapMilestoneCount>counts.rangeMilestoneCount||counts.visibleProjectCount!==counts.eligibleProjectCount+Object.values(observations.excluded).reduce((sum,value)=>sum+value,0))return false;
  const dates=new Set(),projects=new Set();let total=0;
  for(const day of data.days){
    if(!day||!clientRecheckDate(day.date)||day.date<period.startDate||day.date>period.endDate||dates.has(day.date)||!Array.isArray(day.projects)||day.projects.length<2||day.projectCount!==day.projects.length)return false;dates.add(day.date);const seen=new Set();let items=0;
    for(const project of day.projects){if(!project||seen.has(project.projectId)||typeof project.title!=='string'||!safeDeadlineOverlapHref(project.href,project.projectId)||!Array.isArray(project.milestones)||!project.milestones.length)return false;seen.add(project.projectId);projects.add(project.projectId);const ids=new Set();for(const item of project.milestones){if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.label!=='string'||typeof item.dateTypeLabel!=='string'||!['internal','check','agreed'].includes(item.dateType)||item.date!==day.date||!safeDeadlineOverlapHref(item.href,project.projectId))return false;ids.add(item.id);items++;}}
    if(day.milestoneCount!==items)return false;total+=items;
  }
  if(counts.overlapDayCount!==dates.size||counts.overlapProjectCount!==projects.size||counts.overlapMilestoneCount!==total)return false;
  for(const key of ['undated','overdue','outsideWindow']){const row=observations[key];if(!row||!number(row.projectCount)||!number(row.milestoneCount)||!Array.isArray(row.projects)||row.projects.length!==row.projectCount||row.projectCount>counts.eligibleProjectCount)return false;const seen=new Set();let total=0;for(const project of row.projects){if(!project||seen.has(project.projectId)||typeof project.title!=='string'||!number(project.count)||project.count<1||!safeDeadlineOverlapHref(project.href,project.projectId))return false;seen.add(project.projectId);total+=project.count;}if(row.milestoneCount!==total)return false;}
  return true;
}
function deadlineOverlapsResult(client){
  if(client?.error)return {error:'고객 프로젝트를 불러오지 못해 기한 겹침도 확인하지 못했습니다.'};
  const result=client?.data?.deadlineOverlaps;if(result?.error&&typeof result.error==='string')return {error:result.error};
  return validDeadlineOverlaps(result?.data)?{data:result.data}:{error:'프로젝트 기한 정보를 확인하지 못했습니다. 다시 불러와 주세요.'};
}
function deadlineOverlapsHtml(result){
  if(!state.integrated)return '';
  const heading='<div class="workday-section-head"><h3>여러 프로젝트의 기한 겹침</h3>';
  if(result.error)return `<section class="workday-section deadline-overlaps">${heading}<span>확인 필요</span></div><p class="productivity-error" role="alert">${esc(result.error)} 겹치는 기한이 없다는 뜻은 아닙니다.</p><button class="button" type="button" data-productivity-refresh>다시 불러오기</button></section>`;
  const data=result.data,{counts,period,observations}=data,link=(href,projectId,label,key)=>`<a href="${esc(safeDeadlineOverlapHref(href,projectId))}" target="_top" data-deadline-open data-deadline-project="${esc(projectId)}" data-client-focus="${esc('overlap:'+key)}">${esc(label)}</a>`;
  const days=data.days.map(day=>`<details class="deadline-overlap-day" data-client-group="${esc('overlap:'+day.date)}"><summary data-client-focus="${esc('overlap:'+day.date+':summary')}"><strong>${esc(day.date)}</strong><span>${day.projectCount}개 프로젝트 · 기한 항목 ${day.milestoneCount}개</span></summary>${day.projects.map(project=>`<article class="deadline-overlap-project"><h4>${link(project.href,project.projectId,project.title,day.date+':'+project.projectId+':project')}</h4><ul>${project.milestones.map(item=>`<li><span class="deadline-overlap-type" data-type="${esc(item.dateType)}">${esc(item.dateTypeLabel)}</span>${link(item.href,project.projectId,item.label,day.date+':'+project.projectId+':'+item.id)}</li>`).join('')}</ul></article>`).join('')}</details>`).join('');
  const empty=!counts.eligibleProjectCount?'지금 일정 점검 중인 프로젝트가 없습니다.':!counts.rangeProjectCount?'이 기간 안에 등록된 미완료 기한이 없습니다.':'등록된 미완료 기한 중 같은 날 겹치는 프로젝트가 없습니다.';
  const missing=[['undated','기한 미입력'],['overdue','오늘 이전 기한'],['outsideWindow','30일 뒤 이후 기한']].map(([key,label])=>{const row=observations[key];return `<div><h4>${label} · ${row.projectCount}개 프로젝트 / ${row.milestoneCount}개 항목</h4>${row.projects.length?`<ul>${row.projects.map(project=>`<li>${link(project.href,project.projectId,project.title+' · '+project.count+'개','observation:'+key+':'+project.projectId)}</li>`).join('')}</ul>`:'<p>해당 항목 없음</p>'}</div>`;}).join('');
  return `<section class="workday-section deadline-overlaps">${heading}<span>${counts.overlapDayCount}일 · ${counts.overlapProjectCount}개 프로젝트</span></div><p class="workday-section-description">내가 처리할 일과 별도로, 현재 열람 권한이 있는 프로젝트 ${counts.visibleProjectCount}개를 확인합니다. 오늘 ${esc(period.startDate)}부터 ${esc(period.endDate)}까지 양 끝 날짜를 포함합니다 · 한국 시간.</p><p class="deadline-overlap-boundary">같은 날 2개 이상 프로젝트의 미완료 기한이 있으면 표시합니다. 합의 기한·내부 목표일·확인 점검일을 구분하며, 실제 작업 시간이나 과부하를 뜻하지 않습니다.</p>${days||`<p class="workday-empty">${empty}</p>`}<details class="deadline-overlap-observations" data-client-group="overlap:observations"><summary data-client-focus="overlap:observations:summary">겹침에서 제외한 날짜 정보 · 기한 미입력 ${observations.undated.milestoneCount}개 / 지난 기한 ${observations.overdue.milestoneCount}개 / 기간 이후 ${observations.outsideWindow.milestoneCount}개</summary>${missing}<p>일정 점검 꺼짐 ${observations.excluded.disabled}개 · 보관 ${observations.excluded.archived}개 · 마감 확정 ${observations.excluded.closed}개 · 현재 납품 완료 ${observations.excluded.complete}개 프로젝트는 제외했습니다.</p></details></section>`;
}
function safePublicationWorkflowHref(value){
  try{
    if(typeof value!=='string'||!value)return null;
    const url=new URL(value,location.origin),params=url.searchParams,action=params.get('publicationAction'),fields=action==='prepare'?(params.has('inboxId')?['inboxId']:['productionId','versionId']):action==='review'?['packageId']:action==='publish'?['packageId',...(params.has('publicationFormat')?['publicationFormat']:[])]:action==='performance'?['entryId','checkpoint']:action==='link'?(params.has('packageId')&&!params.has('entryId')?['packageId']:params.has('entryId')&&!params.has('packageId')?['entryId']:null):null;
    if(params.get('tab')==='social'){const allowed=new Set(['tab','section']);if(url.origin!==location.origin||url.username||url.password||url.hash||url.pathname!=='/'||!['queue','compose'].includes(params.get('section'))||[...params.keys()].some(key=>!allowed.has(key)||params.getAll(key).length!==1))return null;return url.href;}
    if(!fields||url.origin!==location.origin||url.username||url.password||url.hash||url.pathname!=='/'||params.get('tab')!=='workroom'||params.get('section')!=='tools'||params.get('tool')!=='publication')return null;
    const allowed=new Set(['tab','section','tool','publicationAction',...fields]);for(const key of params.keys())if(!allowed.has(key)||params.getAll(key).length!==1)return null;
    for(const key of fields){const field=params.get(key);if(key==='checkpoint'?!['24h','72h'].includes(field):key==='publicationFormat'?!['youtube-shorts','youtube-video','instagram-reels'].includes(field):key==='entryId'?!/^[0-9a-f]{64}$/i.test(field||''):!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(field||''))return null;}
    return url.href;
  }catch{return null;}
}
async function publicationWorkflowApi(){
  const recovery=companySessionRecovery();if(recovery)await recovery;
  const userId=state.user?.id,session=state.workNotificationSession,integrated=state.integrated;
  const response=await fetch('/api/publication-workflow',{credentials:'same-origin'}),data=await response.json().catch(()=>({}));
  if(userId!==state.user?.id||session!==state.workNotificationSession||integrated!==state.integrated)throw new Error('로그인이 바뀌어 이전 요청을 종료했어요.');
  if(!response.ok){const error=new Error(data.error||`게시 업무를 불러오지 못했어요. (${response.status})`);error.status=response.status;throw error;}
  if(!Array.isArray(data.items)||!data.items.every(isPublicationWorkflowItem))throw new Error('게시 업무 목록을 확인하지 못했어요. 다시 불러와 주세요.');
  return data;
}
function isPublicationWorkflowItem(item){return Boolean(item&&typeof item.id==='string'&&item.id&&['publication_prepare','publication_review','publication_publish','publication_performance','publication_link','publication_social'].includes(item.kind)&&['next','reply'].includes(item.group));}
function publicationWorkflowItems(items){return [...new Map((Array.isArray(items)?items:[]).filter(isPublicationWorkflowItem).map(item=>[item.id,item])).values()];}
function publicationWorkHtml(items,error){
  if(!publicationWorkflowAvailable())return '';
  return `<section class="workday-section publication-work"><div class="workday-section-head"><h3>게시의 다음 할 일</h3><span>${error?'확인 필요':items.length}</span></div><p class="workday-section-description">내 완성본·게시 묶음·성과 기록의 현재 상태를 보여 줍니다. 원본에서 처리하면 목록도 갱신됩니다.</p>${error?`<p class="productivity-error" role="alert">${esc(error)}</p><button class="button" type="button" data-productivity-refresh>다시 불러오기</button>`:items.map(item=>{const href=safePublicationWorkflowHref(item.href);return `<article class="workday-item"><span class="workday-meta">${esc(item.statusLabel||'다음 단계')}</span><h4>${esc(item.title)}</h4><p class="customer-work-text">${esc(item.text)}</p><div class="workday-actions">${href?`<a class="button" href="${esc(href)}" target="_top" data-publication-open="${esc(item.id)}">${esc(item.actionLabel||'게시 준비 열기')}</a>`:'<span>원본 연결을 확인해 주세요.</span>'}</div></article>`;}).join('')}</section>`;
}
function workdayInteractionActive(body){
  if(modal.open)return true;
  const focused=document.activeElement;if(body.contains?.(focused)&&focused?.matches?.('input,textarea,select,[contenteditable="true"]'))return true;
  const selection=window.getSelection?.();return Boolean(selection&&!selection.isCollapsed&&(body.contains?.(selection.anchorNode)||body.contains?.(selection.focusNode)));
}
function renderWorkdayBody(body,html){
  const identity=state.user?.id+':'+state.workNotificationSession,expanded=state.customerGroupIdentity===identity?[...(body.querySelectorAll?.('[data-client-group]')||[])].filter(node=>node.open).map(node=>node.dataset.clientGroup):[],scrollTop=body.scrollTop,focused=document.activeElement,focusInside=Boolean(focused&&body.contains?.(focused)),focusAttributes=['data-client-focus','id','data-workday-task-id','data-workday-task','data-publication-open','data-client-open','data-task-create','data-productivity-refresh','data-source-message'],focusAttribute=focusInside?focusAttributes.find(name=>focused?.hasAttribute?.(name)):null,focusValue=focusAttribute?focused.getAttribute(focusAttribute):null,focusTop=focusInside?focused.getBoundingClientRect?.().top:null,criteriaOpen=$('.workday-criteria',body)?.open;
  body.innerHTML=html;
  state.customerGroupIdentity=identity;for(const node of body.querySelectorAll?.('[data-client-group]')||[])if(expanded.includes(node.dataset.clientGroup))node.open=true;
  const criteria=$('.workday-criteria',body);if(criteria&&criteriaOpen)criteria.open=true;
  if(Number.isFinite(scrollTop))body.scrollTop=scrollTop;
  if(focusAttribute){const selector=`[${focusAttribute}="${CSS.escape(focusValue)}"]`,replacement=$(selector,body);replacement?.focus({preventScroll:true});const nextTop=replacement?.getBoundingClientRect?.().top;if(Number.isFinite(focusTop)&&Number.isFinite(nextTop))body.scrollTop+=nextTop-focusTop;}
}
async function clientWorkflowApi(options={}){
  const userId=state.user?.id,session=state.workNotificationSession,integrated=state.integrated;
  const headers={};if(options.body!==undefined){headers['Content-Type']='application/json';if(state.integrated?.csrfToken)headers['X-CSRF-Token']=state.integrated.csrfToken;}
  const response=await fetch('/api/client-workflow'+(options.recheck?'/recheck':''),{method:options.method||'GET',credentials:'same-origin',headers,...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
  const data=await response.json().catch(()=>({}));if(userId!==state.user?.id||session!==state.workNotificationSession||integrated!==state.integrated)throw new Error('로그인이 바뀌어 이전 요청을 종료했어요.');if(!response.ok){const error=new Error(data.error||`고객 업무를 불러오지 못했어요. (${response.status})`);error.status=response.status;throw error;}
  if((options.method||'GET')==='GET'&&(!Array.isArray(data.items)||data.projectGroups!==undefined&&!validClientProjectGroups(data.projectGroups,data.items)||!validClientRechecks(data)))throw new Error('고객 프로젝트 업무 목록을 확인하지 못했어요. 다시 불러와 주세요.');return data;
}
function clientRecheckDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function clientRecheckAfter(today,days){return new Date(Date.parse(today+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
function validClientRechecks(data){
  const fields=['todayItems','todayProjectGroups','deferredItems','rechecks','recheckToday'];if(fields.every(key=>data[key]===undefined))return true;
  if(!Array.isArray(data.todayItems)||!Array.isArray(data.deferredItems)||!validClientProjectGroups(data.todayProjectGroups,data.todayItems)||!clientRecheckDate(data.recheckToday)||!data.rechecks||typeof data.rechecks!=='object'||Array.isArray(data.rechecks))return false;
  const source=new Map(data.items.map(item=>[item.id,item])),seen=new Set();
  if(Object.keys(data.rechecks).length!==source.size)return false;
  return [[data.todayItems,false],[data.deferredItems,true]].every(([items,deferred])=>items.every(item=>{
    const original=source.get(item?.id),meta=data.rechecks[item?.id];
    if(!original||seen.has(item.id)||item.projectId!==original.projectId||item.group!==original.group||!meta||!/^[a-f0-9]{64}$/.test(meta.fingerprint)||!['active','deferred','due','changed','overdue'].includes(meta.state)||meta.date!==null&&!clientRecheckDate(meta.date)||(meta.state==='deferred')!==deferred||deferred&&!(meta.date>data.recheckToday))return false;
    seen.add(item.id);return true;
  }))&&seen.size===source.size;
}
function customerRecheckHtml(item,index){
  const meta=state.clientRechecks?.[item.id];if(!meta||index<0)return '';
  const label={due:'다시 볼 날짜가 됐어요.',changed:'새 요청이나 변경이 있어 다시 표시했어요.',overdue:'기한이 지나 다시 표시했어요.'}[meta.state];
  return `${label?`<p class="customer-recheck-notice">${esc(label)}</p>`:''}<div class="customer-recheck-actions">${meta.state==='deferred'?`<span>${esc(meta.date)} 다시 확인</span><button type="button" class="text-button" data-client-restore="${index}" data-client-focus="${esc(item.id+':restore')}">지금 다시 보기</button>`:`<button type="button" class="text-button" data-client-recheck="${index}" data-client-focus="${esc(item.id+':recheck')}">다시 볼 날짜</button>`}</div>`;
}
function customerDeferredHtml(items){
  if(!items.length)return '';
  return `<section class="workday-section customer-deferred"><details data-client-group="personal-rechecks"><summary data-client-focus="personal-rechecks:summary">다시 볼 날짜를 정한 일 ${items.length}개</summary><p class="workday-section-description">내 오늘 목록에서만 잠시 접어 두었어요. 원래 기한과 미완료 상태, 자동화 점검은 유지됩니다. 새 요청·변경·기한 경과가 생기면 다시 표시해요.</p>${items.map(item=>`<div class="customer-deferred-item"><p class="customer-project-counts">${esc(item.projectTitle)}</p>${customerWorkItemHtml(item)}</div>`).join('')}</details></section>`;
}
async function submitClientRecheck(item,input){
  const userId=state.user?.id,session=state.workNotificationSession;
  await clientWorkflowApi({method:'POST',recheck:true,body:{...input,itemId:item.id,fingerprint:input.fingerprint??state.clientRechecks?.[item.id]?.fingerprint}});
  return userId===state.user?.id&&session===state.workNotificationSession;
}
function openClientRecheck(item){
  const today=state.clientRecheckToday,meta=state.clientRechecks?.[item.id];if(!meta||!clientRecheckDate(today))return;
  const tomorrow=clientRecheckAfter(today,1),nextWeek=clientRecheckAfter(today,7),max=clientRecheckAfter(today,365),userId=state.user?.id,session=state.workNotificationSession,fingerprint=meta.fingerprint;
  openModal('다시 볼 날짜',`<p class="modal-description">${esc(item.projectTitle)} · ${esc(item.title)}</p><p class="modal-description">내 오늘 목록에 다시 나타날 날짜예요. 원래 기한과 미완료 상태, 자동화 점검은 그대로 유지됩니다.</p><form id="client-recheck-form"><fieldset class="customer-recheck-options"><legend>언제 다시 확인할까요?</legend>${[['tomorrow','내일',tomorrow],['week','다음 주',nextWeek],['custom','직접 선택','']].map(([value,label,date],index)=>`<label><input type="radio" name="choice" value="${value}" ${index===0?'checked':''}><span>${label}${date?' · '+date:''}</span></label>`).join('')}<label class="field"><span>직접 선택 날짜 (한국시간 기준)</span><input name="date" type="date" aria-label="다시 확인할 날짜" min="${tomorrow}" max="${max}" value="${tomorrow}"></label></fieldset><p class="modal-description">새 고객 요청·내용 변경·기한 경과가 생기면 이 날짜 전에도 다시 표시해요.</p><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button type="submit" class="button primary">날짜 저장</button></div></form>`);
  const version=modalVersion,form=$('#client-recheck-form');
  const current=()=>userId===state.user?.id&&session===state.workNotificationSession&&version===modalVersion&&modal.open;
  const dateInput=$('input[name="date"]',form);dateInput?.addEventListener('input',()=>{const choice=$('input[value="custom"]',form);if(choice)choice.checked=true;});
  form.onsubmit=async event=>{
    event.preventDefault();if(!current())return;const values=new FormData(form),choice=values.get('choice'),date=choice==='tomorrow'?tomorrow:choice==='week'?nextWeek:String(values.get('date')||'');
    if(!clientRecheckDate(date)||date<tomorrow||date>max){formError('내일부터 1년 이내 날짜를 선택해 주세요.');return;}
    const button=$('button[type="submit"]',form),fieldset=$('fieldset',form);button.disabled=true;fieldset.disabled=true;
    try{if(!await submitClientRecheck(item,{action:'defer',date,fingerprint})||!current())return;modal.close();await loadPersonalPanel();if(userId===state.user?.id&&session===state.workNotificationSession)toast(date+'에 다시 확인하도록 저장했어요.');}
    catch(error){if(!current())return;if(error.status===409){modal.close();await loadPersonalPanel();if(userId===state.user?.id&&session===state.workNotificationSession)toast('업무가 변경됐어요. 최신 내용을 확인한 뒤 날짜를 다시 정해 주세요.',true);}else{formError(error.message);button.disabled=false;fieldset.disabled=false;}}
  };
}
function validClientProjectGroups(groups,items){
  if(!Array.isArray(groups)||!Array.isArray(items))return false;
  const projects=new Set(),seen=new Set(),source=new Map(items.map(item=>[item.id,item]));
  return groups.every(group=>{
    if(!group||typeof group.projectId!=='string'||!group.projectId||projects.has(group.projectId)||typeof group.projectTitle!=='string'||typeof group.reason!=='string'||!['overdue','today','upcoming','undated','waiting'].includes(group.urgency)||!group.counts||!['total','actionable','waiting','customerWaiting','staffWaiting'].every(key=>Number.isInteger(group.counts[key])&&group.counts[key]>=0)||!Array.isArray(group.items)||!group.items.length)return false;
    projects.add(group.projectId);
    if(!group.items.every(item=>{const original=source.get(item?.id);if(!item||typeof item.id!=='string'||!item.id||seen.has(item.id)||item.projectId!==group.projectId||!['reply','review','next','waiting'].includes(item.group)||!original||original.projectId!==item.projectId||original.group!==item.group)return false;seen.add(item.id);return true;}))return false;
    const waiting=group.items.filter(item=>item.group==='waiting').length;
    return group.counts.total===group.items.length&&group.counts.waiting===waiting&&group.counts.actionable===group.items.length-waiting&&(group.primary===null?waiting===group.items.length:group.items.some(item=>item.id===group.primary?.id&&item.group!=='waiting'));
  })&&seen.size===source.size;
}
function customerWorkItemHtml(item,{primary=false,grouped=false,index=state.customerWork.findIndex(row=>row.id===item.id)}={}){
  const href=safeClientWorkflowHref(item.href),labels={reply:'답할 요청',review:'검토할 결과',waiting:item.statusLabel||(item.status==='review'||item.waitingFor==='staff'?'내부 검토 대기':item.status==='waiting_customer'||item.waitingFor==='customer'?'고객 답변·승인 대기':'답변·확인 대기'),next:'다음 단계'};
  return `<article class="workday-item${primary?' customer-project-primary':''}" data-client-item="${esc(item.id)}"><span class="workday-meta">${esc(item.kind==='follow_up'?item.statusLabel:labels[item.group]||'고객 업무')}${item.dueDate?' · '+esc(item.dueDate):''}${Number.isFinite(item.seconds)?` · ${esc(Math.floor(item.seconds/60)+':'+String(Math.floor(item.seconds%60)).padStart(2,'0'))} 장면`:''}</span><h${grouped?'5':'4'}>${esc(item.title)}</h${grouped?'5':'4'}>${!grouped&&item.kind==='follow_up'?`<p>${esc(item.projectTitle||'')} · ${esc(item.customerName||'')}</p>`:''}<p class="customer-work-text">${esc(item.text)}</p><div class="workday-actions">${href&&index>=0?`<a class="button" href="${esc(href)}" target="_top" data-client-open="${index}" data-client-focus="${esc(item.id+':open')}">${esc(item.actionLabel||(item.kind==='follow_up'?'연락 기록 열기':item.group==='review'?'검토 화면 열기':'고객 의견·시안 열기'))}</a>`:'<span>원문 연결을 확인해 주세요.</span>'}${index>=0?(item.actions||[]).map(action=>`<button type="button" class="text-button" data-client-work="${index}" data-client-action="${esc(action.action)}" data-client-focus="${esc(item.id+':'+action.action)}">${esc(action.label)}</button>`).join(''):''}</div>${customerRecheckHtml(item,index)}</article>`;
}
function customerProjectGroupsHtml(groups,heading='프로젝트별 먼저 할 일'){
  if(!state.integrated||!groups.length)return '';
  const source=new Map(state.customerWork.map((item,index)=>[item.id,{item,index}])),count=groups.reduce((sum,group)=>sum+group.counts.total,0),labels={overdue:'기한 지남',today:'오늘 기한',upcoming:'이후 기한',undated:'기한 미정',waiting:'대기 중'};
  return `<section class="workday-section customer-projects"><div class="workday-section-head"><h3>${esc(heading)}</h3><span>${groups.length}개 프로젝트 · 할 일 항목 ${count}개</span></div><p class="workday-section-description">프로젝트마다 먼저 처리할 일과 그 이유를 모았어요. 관련 업무와 대기 중인 항목도 같은 카드에서 확인하세요.</p>${groups.map(group=>{
    const items=group.items.map(item=>source.get(item.id)?.item).filter(Boolean),primary=group.primary&&items.find(item=>item.id===group.primary.id),related=items.filter(item=>item.id!==primary?.id&&item.group!=='waiting'),waiting=items.filter(item=>item.group==='waiting');
    return `<article class="customer-project" data-client-project="${esc(group.projectId)}"><header><h4>${esc(group.projectTitle||'고객 프로젝트')}</h4><span class="customer-project-urgency" data-urgency="${esc(group.urgency)}">${labels[group.urgency]}</span></header><p class="customer-project-counts">처리할 일 ${group.counts.actionable}개 · 대기 ${group.counts.waiting}개</p>${primary?`<p class="customer-project-reason"><strong>먼저 할 일</strong> ${esc(group.reason)}</p>${customerWorkItemHtml(primary,{primary:true,grouped:true,index:source.get(primary.id).index})}`:`<p class="customer-project-reason">${esc(group.reason||'고객 또는 내부 담당자의 답변·승인을 기다리고 있어요. 지금 처리할 일은 없어요.')}</p>`}${related.length||waiting.length?`<details class="customer-project-related" data-client-group="${esc(group.projectId)}"><summary data-client-focus="${esc(group.projectId+':related')}">${primary?'같은 프로젝트의 나머지':'대기 중인'} ${related.length+waiting.length}개 항목 보기</summary>${related.length?`<h5>함께 처리할 일 ${related.length}개</h5>${related.map(item=>customerWorkItemHtml(item,{grouped:true,index:source.get(item.id).index})).join('')}`:''}${waiting.length?`<h5>답변·확인 대기 ${waiting.length}개</h5>${waiting.map(item=>customerWorkItemHtml(item,{grouped:true,index:source.get(item.id).index})).join('')}`:''}</details>`:''}</article>`;
  }).join('')}</section>`;
}
function customerWorkHtml(items,error,heading='고객 연락·요청·승인'){
  if(!state.integrated)return '';
  return `<section class="workday-section customer-work"><div class="workday-section-head"><h3>${esc(heading)}</h3><span>${items.length}</span></div>${error?`<p class="productivity-error" role="alert">${esc(error)}</p><button class="button" type="button" data-productivity-refresh>다시 불러오기</button>`:items.length?items.map((item,position)=>{
    const found=state.customerWork.indexOf(item),index=found<0?position:found,href=safeClientWorkflowHref(item.href),labels={reply:'답할 요청',review:'검토할 결과',waiting:'답변·승인 대기',next:'다음 단계'};
    return `<article class="workday-item"><span class="workday-meta">${esc(item.kind==='follow_up'?item.statusLabel:labels[item.group]||'고객 업무')}${item.kind==='follow_up'&&item.dueDate?' · '+esc(item.dueDate):''}${Number.isFinite(item.seconds)?` · ${esc(Math.floor(item.seconds/60)+':'+String(Math.floor(item.seconds%60)).padStart(2,'0'))} 장면`:''}</span><h4>${esc(item.title)}</h4>${item.kind==='follow_up'?`<p>${esc(item.projectTitle||'')} · ${esc(item.customerName||'')}</p>`:''}<p class="customer-work-text">${esc(item.text)}</p><div class="workday-actions">${href?`<a class="button" href="${esc(href)}" target="_top" data-client-open="${index}">${esc(item.actionLabel||(item.kind==='follow_up'?'연락 기록 열기':item.group==='review'?'검토 화면 열기':'고객 의견·시안 열기'))}</a>`:''}${(item.actions||[]).map(action=>`<button type="button" class="text-button" data-client-work="${index}" data-client-action="${esc(action.action)}">${esc(action.label)}</button>`).join('')}</div></article>`;
  }).join(''):'<p class="workday-empty">지금 확인할 고객 요청이 없어요.</p>'}</section>`;
}
function catchUpChangeText(event){
  const change=event.changes||{},from=change.from,to=change.to;
  if(event.kind==='task_stage')return `${taskStatusLabel(from)} → ${taskStatusLabel(to)}`;
  if(event.kind==='task_due')return `${from||'기한 없음'} → ${to||'기한 없음'}`;
  if(event.kind==='task_reviewer_reassigned')return `검토 ${personName(from)} → ${personName(to)} · 기존 업무 상태를 유지했어요.`;
  if(event.kind==='task_assignment')return `담당 ${personName(from?.assigneeId)} → ${personName(to?.assigneeId)} · 검토 ${from?.reviewerId?personName(from.reviewerId):'미지정'} → ${to?.reviewerId?personName(to.reviewerId):'미지정'}`;
  if(event.kind==='task_updated')return '업무 제목 또는 연결된 결과물이 변경됐어요. 원문에서 현재 내용을 확인하세요.';
  if(event.kind==='decision_replaced')return '이전 기록을 새 결정·최종본으로 대체했어요.';
  return event.decision?`${event.decision.effectiveDate}부터 적용`:event.task?`${event.task.assignee?.name||'담당 크루'}에게 요청했어요.`:'원문에서 변경 내용을 확인하세요.';
}
function catchUpEventHtml(event,index){
  const message=event.message||event.task?.message||event.decision?.message;
  return `<article class="workday-item"><span class="workday-meta">${esc(catchUpLabels[event.kind]||'업무 변경')}<time>${esc(shortDate(event.createdAt))} ${esc(timeLabel(event.createdAt))}</time></span><h3>${esc(event.decision?.summary||event.task?.title||message?.body||'업무 변경')}</h3><p>${esc(catchUpChangeText(event))}</p><small>${esc(event.actor?.name||'크루')} · ${esc(state.channels.find(room=>room.id===message?.channelId)?.name||'대화방')}</small><div class="workday-actions">${sourceButton(message,'변경의 원문')}${event.task?`<button class="text-button" type="button" data-catchup-task="${index}">지금 업무 상태</button>`:''}${event.decision?`<button class="text-button" type="button" data-decision-id="${esc(event.decision.id)}">기록 보기</button>`:''}</div></article>`;
}
function decisionHtml(decision){
  const room=state.channels.find(channel=>channel.id===decision.channelId),current=decision.isCurrent!==false;
  return `<article class="workday-item decision-item"><span class="workday-meta"><span class="workflow-stage">${decision.kind==='final'?'최종본':'결정'}</span><span>${current?'현재 기록':'대체된 기록'}</span></span><h3>${esc(decision.summary)}</h3><p>${esc(personName(decision.confirmedBy))} 확정 · ${esc(decision.effectiveDate)}부터 적용</p><small>${esc(room?.name||'대화방')} · ${esc(shortDate(decision.confirmedAt))} 기록</small><div class="workday-actions">${sourceButton(decision.message||{id:decision.messageId,channelId:decision.channelId},'확정한 원문')}${decision.resultMessageId?sourceButton(decision.resultMessage||{id:decision.resultMessageId,channelId:decision.channelId},'연결된 결과물'):''}${decision.replacesId?`<button class="text-button" type="button" data-decision-id="${esc(decision.replacesId)}">이전 기록</button>`:''}${decision.replacedById?`<button class="text-button" type="button" data-decision-id="${esc(decision.replacedById)}">후속 기록</button>`:''}</div></article>`;
}
async function showDecision(decisionId){
  openModal('결정·최종본 기록','<div class="message-loading"><span class="spinner"></span>기록을 불러오고 있어요.</div>');const version=modalVersion;
  try{const data=await api(`/api/decisions/${id(decisionId)}`);if(!modal.open||version!==modalVersion)return;$('.modal-body',modal).innerHTML=decisionHtml(data.decision);$('.modal-body',modal).onclick=event=>{const source=event.target.closest('[data-source-message]'),related=event.target.closest('[data-decision-id]');if(source){modal.close();openProductivitySource(source);}else if(related)showDecision(related.dataset.decisionId);};}
  catch(error){if(modal.open&&version===modalVersion){$('.modal-body',modal).innerHTML=`<p class="form-error" role="alert">${esc(error.message)}</p><button type="button" class="button" id="decision-retry">다시 불러오기</button>`;$('#decision-retry').onclick=()=>showDecision(decisionId);}}
}
async function loadProductivityPanel({tab,seq,append=false,background=false}){
  const body=$('#personal-body'),userId=state.user?.id,session=state.workNotificationSession,current=()=>state.drawer==='personal'&&state.personalTab===tab&&userId===state.user?.id&&session===state.workNotificationSession&&$('#personal-body')===body,active=()=>seq===state.personalSeq&&current();
  try{
    if(tab==='workday'){
      const [work,client,publication]=await Promise.all([api('/api/workday'),state.integrated?clientWorkflowApi().then(data=>({data})).catch(error=>({error:error.message})):Promise.resolve({data:{items:[]}}),publicationWorkflowAvailable()?publicationWorkflowApi().then(data=>({data})).catch(error=>({error:error.message})):Promise.resolve({data:{items:[]}})]);if(!active()||(background||publicationWorkflowAvailable())&&!workdayRefreshActive())return;
      const delay=work.nextDayRefreshAfterMs;scheduleWorkdayRefresh(publicationWorkflowAvailable()?Math.min(Number.isInteger(delay)&&delay>=1001&&delay<=86401000?delay:10000,10000):delay);
      if(background&&workdayInteractionActive(body))return;
      const overlaps=deadlineOverlapsResult(client),{checkedAt,...overlapContent}=overlaps.data||{},{deadlineOverlaps,...clientContent}=client.data||{}, {nextDayRefreshAfterMs,serverNow,...workContent}=work,snapshot=JSON.stringify({work:workContent,client:client.error?{error:client.error}:{data:clientContent},overlaps:overlaps.error?{error:overlaps.error}:overlapContent,publication:publication.error?{error:publication.error}:{items:publication.data.items}});
      if(state.workdayBody===body&&state.workdaySnapshot===snapshot)return;
      state.personalItems=[];state.customerWork=[...new Map((client.data?.items||[]).map(item=>[item.id,item])).values()];state.publicationWork=publicationWorkflowItems(publication.data?.items);state.clientRechecks=client.data?.rechecks||{};state.clientRecheckToday=client.data?.recheckToday||null;
      const visibleIds=new Set((client.data?.todayItems||state.customerWork).map(item=>item.id)),visibleCustomerWork=state.customerWork.filter(item=>visibleIds.has(item.id)),deferredItems=state.customerWork.filter(item=>state.clientRechecks[item.id]?.state==='deferred'),visibleClient=client.data?.todayItems?{...client,data:{...client.data,items:visibleCustomerWork,projectGroups:client.data.todayProjectGroups}}:client;
      const classified=hasWorkdayClassification(work),seen=new Set();
      const sectionHtml=(specs,groups,legacy=false,later=false)=>specs.map(([key,label,description])=>{
        const tasks=(groups?.[key]||[]).filter(task=>{if(legacy)return true;if(seen.has(task.id))return false;seen.add(task.id);return true;}),start=state.personalItems.length;state.personalItems.push(...tasks);
        return {count:tasks.length,html:tasks.length?`<section class="workday-section"><div class="workday-section-head"><h3>${label}</h3><span>${tasks.length}</span></div><p class="workday-section-description">${description}</p>${tasks.map((task,index)=>workdayTaskHtml(task,start+index,work.date,{remaining:later})).join('')}</section>`:`<section class="workday-empty-row"><h3>${label}</h3><span>0 · 없음</span></section>`};
      });
      const sections=sectionHtml(classified?todayWorkdayGroups:workdayGroups,classified?work.today.groups:work.groups,!classified),remaining=classified?sectionHtml(remainingWorkdayGroups,work.remaining.groups,false,true):[];
      const customerNow=visibleCustomerWork.filter(item=>['reply','review','next'].includes(item.group)),customerWaiting=visibleCustomerWork.filter(item=>item.group==='waiting'),projectGroups=visibleClient.data?.projectGroups,grouped=Array.isArray(projectGroups),activeProjects=grouped?projectGroups.filter(group=>group.primary):[],waitingProjects=grouped?projectGroups.filter(group=>!group.primary):[];
      const html=`<div class="productivity-heading"><strong>${esc(work.date||'')} · 오늘 할 일</strong><button class="text-button" type="button" data-productivity-refresh>새로고침</button></div>`+workdaySummaryHtml(work,visibleClient,publication)+taskCreateEntryHtml(work.date)+`<button class="text-button deadline-settings-entry" type="button" id="deadline-settings" hidden>마감 알림 설정</button>`+sections.filter(section=>section.count).map(section=>section.html).join('')+(grouped?customerProjectGroupsHtml(activeProjects):customerNow.length||client.error?customerWorkHtml(customerNow,client.error,'내가 처리할 고객 업무'):'')+(state.publicationWork.length||publication.error?publicationWorkHtml(state.publicationWork,publication.error):'')+(remaining.some(section=>section.count)||(grouped?waitingProjects.length:customerWaiting.length)?'<h3 class="workday-remaining-heading">이후 마감·기한 미정·대기 중</h3>':'')+remaining.filter(section=>section.count).map(section=>section.html).join('')+(grouped?customerProjectGroupsHtml(waitingProjects,'답변·확인을 기다리는 프로젝트'):customerWaiting.length?customerWorkHtml(customerWaiting,null,'고객 답변·승인 대기'):'')+customerDeferredHtml(deferredItems)+(!classified?`<div class="workday-clear-groups">${sections.filter(section=>!section.count).map(section=>section.html).join('')}${state.integrated&&!state.customerWork.length&&!client.error?'<section class="workday-empty-row"><h3>고객 요청·승인</h3><span>0 · 없음</span></section>':''}</div>`:'');
      renderWorkdayBody(body,html+deadlineOverlapsHtml(overlaps));state.workdayBody=body;state.workdaySnapshot=snapshot;
    }else if(tab==='catchup'){
      const data=await api('/api/catch-up');if(!active())return;state.catchUp=data;state.personalItems=data.events||[];
      body.innerHTML=`<div class="productivity-heading"><strong>마지막 확인 이후 바뀐 것</strong><button class="text-button" type="button" data-productivity-refresh>새로고침</button></div><p class="productivity-description">${data.since?'이전에 확인한 변경 이후의':'아직 확인하지 않은'} 업무·결정을 원문과 함께 모았어요. 확인해도 업무 상태는 바뀌지 않아요.</p>${state.personalItems.length?state.personalItems.map(catchUpEventHtml).join(''):'<div class="drawer-empty">'+icon('check')+'<strong>모두 확인했어요</strong><p>새 요청이나 변경이 생기면 여기에 모여요.</p></div>'}${state.personalItems.length?`<div class="catchup-confirm"><p>${data.hasMore?'앞선 변경이 더 있어요. 이 목록을 확인한 뒤 다음 묶음을 이어서 볼 수 있어요.':'현재 목록의 변경을 모두 확인했다면 눌러 주세요.'}</p><button class="button primary" type="button" id="catchup-read">${data.hasMore?'이 목록 확인하고 다음 보기':'이 목록 확인했어요'}</button></div>`:''}`;
      $('#catchup-read')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await api('/api/catch-up/read',{method:'POST',body:{through:data.through}});if(active())await loadPersonalPanel();toast('표시된 변경을 확인했어요.');}catch(error){toast(error.message,true);if(button.isConnected)button.disabled=false;}});
    }else{
      const query=new URLSearchParams({q:state.decisionQuery,current:state.decisionCurrent?'1':'0',offset:String(append?state.personalItems.length:0),limit:'25'});if(state.decisionKind!=='all')query.set('kind',state.decisionKind);
      const data=await api('/api/decisions?'+query);if(!active())return;state.personalItems=append?[...state.personalItems,...data.decisions]:data.decisions;
      body.innerHTML=`<form id="decisions-search" class="decisions-search"><label class="field"><span>결정·최종본 검색</span><div class="productivity-search-row"><input name="q" type="search" aria-label="결정·최종본 검색어" placeholder="확정한 내용으로 찾기" maxlength="200" value="${esc(state.decisionQuery)}"><button class="button" type="submit">검색</button></div></label><div class="personal-toolbar"><select name="kind" aria-label="기록 종류">${[['all','결정·최종본 모두'],['decision','결정'],['final','최종본']].map(([key,label])=>`<option value="${key}" ${state.decisionKind===key?'selected':''}>${label}</option>`).join('')}</select><label class="checkbox-field"><input name="history" type="checkbox" ${state.decisionCurrent?'':'checked'}>이전 기록 포함</label></div></form><p class="productivity-description">대화의 ‘결정·최종본으로 기록’에서 확정 내용과 근거를 남길 수 있어요.</p>${state.personalItems.length?state.personalItems.map(decisionHtml).join(''):'<div class="drawer-empty">'+icon('note')+'<strong>해당하는 기록이 없어요</strong><p>검색 조건을 바꾸거나 대화에서 결정·최종본을 기록해 보세요.</p></div>'}${data.hasMore?'<button class="button personal-more" id="productivity-more" type="button">기록 더 보기</button>':''}`;
      $('#decisions-search').onsubmit=event=>{event.preventDefault();const values=new FormData(event.currentTarget);state.decisionQuery=String(values.get('q')||'').trim();state.decisionKind=values.get('kind')||'all';state.decisionCurrent=!values.has('history');loadPersonalPanel();};
      $('#productivity-more')?.addEventListener('click',event=>{event.currentTarget.disabled=true;loadPersonalPanel({append:true});});
    }
    if(tab==='workday')attachDeadlineSettings();
    body.onclick=async event=>{
      const createTask=event.target.closest('[data-task-create]');if(createTask)return openTaskCreateDialog({date:createTask.dataset.taskCreateDate});
      const source=event.target.closest('[data-source-message]');if(source)return openProductivitySource(source);
      const quickTask=event.target.closest('[data-workday-task-id]');if(quickTask){const task=state.personalItems.find(item=>item.id===quickTask.dataset.workdayTaskId);if(task)return openTaskDetail(taskMessage(task));}
      const taskButton=event.target.closest('[data-workday-task]');if(taskButton){const task=state.personalItems[Number(taskButton.dataset.workdayTask)];if(task)return openTaskDetail(taskMessage(task));}
      const changedTask=event.target.closest('[data-catchup-task]');if(changedTask){const task=state.personalItems[Number(changedTask.dataset.catchupTask)]?.task;if(task)return openTaskDetail(taskMessage(task));}
      const decisionButton=event.target.closest('[data-decision-id]');if(decisionButton)return showDecision(decisionButton.dataset.decisionId);
      if(event.target.closest('[data-productivity-refresh]'))return loadPersonalPanel();
      const deadlineOpen=event.target.closest('[data-deadline-open]');if(deadlineOpen){const href=safeDeadlineOverlapHref(deadlineOpen.getAttribute('href'),deadlineOpen.dataset.deadlineProject);if(!href){event.preventDefault();return;}if(moduleBase&&new URL(href).pathname==='/'){event.preventDefault();parentMessage('messenger:client-open',{url:href});}return;}
      const publicationOpen=event.target.closest('[data-publication-open]');if(publicationOpen&&moduleBase){event.preventDefault();const href=safePublicationWorkflowHref(state.publicationWork.find(item=>item.id===publicationOpen.dataset.publicationOpen)?.href);if(href)parentMessage('messenger:publication-open',{url:href});return;}
      const clientOpen=event.target.closest('[data-client-open]');if(clientOpen&&moduleBase){event.preventDefault();const href=safeClientWorkflowHref(state.customerWork[Number(clientOpen.dataset.clientOpen)]?.href);if(href)parentMessage('messenger:client-open',{url:href});return;}
      const recheckButton=event.target.closest('[data-client-recheck]');if(recheckButton){const item=state.customerWork[Number(recheckButton.dataset.clientRecheck)];if(item)openClientRecheck(item);return;}
      const restoreButton=event.target.closest('[data-client-restore]');if(restoreButton){const item=state.customerWork[Number(restoreButton.dataset.clientRestore)];if(!item)return;restoreButton.disabled=true;try{if(await submitClientRecheck(item,{action:'restore'})&&current()){await loadPersonalPanel();if(current())toast('오늘 목록에 다시 표시했어요.');}}catch(error){if(!current())return;toast(error.message,true);if(error.status===409)await loadPersonalPanel();else if(restoreButton.isConnected)restoreButton.disabled=false;}return;}
      const clientAction=event.target.closest('[data-client-work]');if(clientAction){const item=state.customerWork[Number(clientAction.dataset.clientWork)];if(!item)return;clientAction.disabled=true;try{await clientWorkflowApi({method:'POST',body:{projectId:item.projectId,messageId:item.messageId,versionId:item.versionId,revision:item.revision,action:clientAction.dataset.clientAction}});if(!current())return;await loadPersonalPanel();if(current())toast('고객 업무를 업데이트했어요.');}catch(error){if(!current())return;toast(error.status===409?'다른 크루가 먼저 변경했어요. 최신 상태를 다시 확인해 주세요.':error.message,true);if(error.status===409&&current())await loadPersonalPanel();else if(clientAction.isConnected)clientAction.disabled=false;}}
    };
  }catch(error){if(active()&&(!background||workdayRefreshActive())){if(tab==='workday'&&publicationWorkflowAvailable())scheduleWorkdayRefresh(10000);if(background&&workdayInteractionActive(body))return;state.workdaySnapshot=null;state.workdayBody=null;body.innerHTML=`<div class="drawer-empty">${tab==='workday'?'<strong>할 일을 확인하지 못했습니다</strong><p>현재 업무를 조회하지 못했습니다. 할 일이 없다는 뜻은 아닙니다.</p>':''}<p role="alert">${esc(error.message)}</p><button class="button" data-productivity-refresh>다시 불러오기</button></div>`;body.onclick=event=>{if(event.target.closest('[data-productivity-refresh]'))loadPersonalPanel();};}}
}
function roomSettingsDialog(){const channel=selectedConversation();if(!channel)return;if(isProject(channel)&&canManageProject(channel))editChannelDialog();else channelNotificationsDialog();}
async function channelNotificationsDialog(){
  const channel=selectedConversation();if(!channel)return;openModal('대화방 설정',`<p class="modal-description">${esc(channel.name)}의 알림함 수신 범위를 정하세요.</p><form id="notification-form"><div class="notification-options">${[['mentions','나와 관련된 소식','개인 대화·멘션·답글·할 일'],['all','모든 새 메시지','이 방의 새 메시지를 모두 알림함에 모아요'],['mute','알림 받지 않기','직접 예약한 다시 알림은 유지돼요']].map(([mode,label,description])=>`<label><input type="radio" name="mode" value="${mode}" ${mode===(channel.notificationMode||'mentions')?'checked':''}><span><strong>${label}</strong><small>${description}</small></span></label>`).join('')}</div><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions">${channel.canManage&&canWriteMessages()?'<button class="button" type="button" id="notification-room-settings">대화방 정보 수정</button>':''}<button class="button primary" type="submit">저장</button></div></form>`);
  $('#notification-room-settings')?.addEventListener('click',()=>{modal.close();editChannelDialog();});
  $('#notification-form').onsubmit=async event=>{event.preventDefault();const button=$('button[type=submit]',event.currentTarget);button.disabled=true;try{const mode=new FormData(event.currentTarget).get('mode');await api(`/api/channels/${id(channel.id)}/notifications`,{method:'PATCH',body:{mode}});channel.notificationMode=mode;modal.close();toast('이 대화방의 알림 설정을 저장했어요.');}catch(error){formError(error.message);button.disabled=false;}};
}
async function handleProductivityAction(action,message,button){
  if(action==='task')return openTaskDetail(message);if(action==='decision')return decisionDialog(message);if(action==='remind')return reminderDialog(message);if(action==='ack-list')return ackListDialog(message);
  if(action==='workspace-link'){const link=safeWorkspaceLink(message.workspaceLink);if(link){if(moduleBase)parentMessage('messenger:navigate',{url:link.url});else window.open(link.url,'_blank','noopener');}return;}
  if(button)button.disabled=true;
  try{if(action==='save'){await api(`/api/messages/${id(message.id)}/save`,{method:message.saved?'DELETE':'POST',body:{}});message.saved=!message.saved;toast(message.saved?'나만 볼 수 있게 저장했어요.':'저장을 해제했어요.');}if(action==='ack'){await api(`/api/messages/${id(message.id)}/ack`,{method:'POST',body:{}});message.acknowledged=true;message.ackCount=(message.ackCount||0)+1;}await refreshMessages();await refreshDetailViews();}
  catch(error){toast(error.message,true);}finally{if(button?.isConnected)button.disabled=false;}
}
async function ackListDialog(message){
  openModal('공지 확인 현황','<div class="message-loading"><span class="spinner"></span>확인 현황을 불러오고 있어요.</div>');const version=modalVersion;
  try{const data=await api(`/api/messages/${id(message.id)}/acks`);if(!modal.open||version!==modalVersion)return;$('.modal-body',modal).innerHTML=`<p class="modal-description">${data.acknowledged.length} / ${data.total}명 확인<br>대화를 읽은 기록과 별개로, ‘확인했어요’를 누른 크루예요.</p><div class="ack-roster"><section><h3>확인한 크루 ${data.acknowledged.length}</h3>${data.acknowledged.map(item=>`<p>${esc(item.user.name)}<time>${esc(shortDate(item.acknowledgedAt))} ${esc(timeLabel(item.acknowledgedAt))}</time></p>`).join('')||'<p class="muted">아직 확인한 크루가 없어요.</p>'}</section><section><h3>아직 확인하지 않은 크루 ${data.pending.length}</h3>${data.pending.map(user=>`<p>${esc(user.name)}</p>`).join('')||'<p class="muted">모두 확인했어요.</p>'}</section></div>`;}catch(error){if(version===modalVersion)formError(error.message);}
}
async function openTaskDetail(message){
  if(!message.task)return taskDialog(message);
  openModal('할 일 상세','<div class="message-loading" role="status"><span class="spinner"></span>최신 요청과 진행 상황을 불러오고 있어요.</div>');
  const version=modalVersion,userId=state.user?.id,active=()=>modal.open&&version===modalVersion&&userId===state.user?.id;
  try{
    const data=await api(`/api/messages/${id(message.id)}`);if(!active())return;
    if(!data.message?.task)throw new Error('이 메시지는 더 이상 할 일로 등록되어 있지 않아요.');
    taskDialog(data.message);
  }catch(error){
    if(!active())return;
    $('.modal-body',modal).innerHTML=`<p class="form-error" role="alert">${esc(error.message)}</p><button type="button" class="button" id="task-detail-retry">다시 불러오기</button>`;
    $('#task-detail-retry').onclick=()=>openTaskDetail(message);
  }
}
function taskNextSteps(task){
  if(taskStage(task)==='done'&&(task.assigneeUnavailable||task.reviewerUnavailable))return ['완료된 기록과 연결된 결과물은 그대로 유지돼요. 요청 원문과 결과물을 확인하세요.','추가 작업이 필요하면 기존 담당·검토자의 참여 권한을 확인하거나 새 업무를 요청하세요. 현재 완료 기록의 진행 상태는 바꾸지 마세요.'];
  if(task.assigneeUnavailable||!task.assignee?.id)return ['현재 담당 크루를 확인할 수 없어요. 요청자에게 담당 크루를 확인해 주세요.','요청 원문과 연결된 결과물을 확인하세요. 현재 담당이 확인되기 전에는 진행 상태를 바꾸지 마세요.'];
  if(task.canManage===false)return ['현재 계정은 이 업무의 상태를 변경할 수 없어요. 요청 원문과 연결된 결과물을 확인하세요.','진행 상태나 담당자를 바꿔야 한다면 요청자에게 담당·권한을 확인해 주세요.'];
  const current=taskStage(task),assignee=task.assignee?.id===state.user?.id,reviewer=taskReviewerId(task)===state.user?.id,hasReviewer=Boolean(taskReviewerId(task));
  if(task.reviewerUnavailable&&current!=='done'){
    if(task.canReassignReviewer)return ['기존 검토자가 검토할 수 없어요. 아래에서 새 검토 크루를 지정하세요.',current==='review'?'제출한 결과물을 유지한 채 새 검토자에게 다시 검토를 요청해요.':'기존 요청·담당·기한·진행 상태와 연결된 결과물은 그대로 유지해요.'];
    return ['기존 검토자가 검토할 수 없어요. 담당자가 아닌 요청자나 관리자에게 새 검토자 지정을 요청하세요.','요청 원문과 연결된 결과물을 확인하세요. 검토자가 다시 지정되기 전에는 검토나 완료로 바꾸지 마세요.'];
  }
  if(current==='done')return ['완료된 업무예요. 연결된 결과물과 요청 원문을 확인하세요.','추가 작업이 필요하면 담당자나 요청자가 진행 중으로 바꾸고 저장한 뒤 업무를 다시 열어요.'];
  if(current==='review'){
    return reviewer?['연결된 결과물을 열고 요청 내용과 대조하세요.','수정할 부분이 있으면 원문에 구체적인 의견을 남기고 수정 요청으로 바꾸세요.','요청을 충족하면 완료로 바꾸고 변경을 저장하세요.']:['검토 크루에게 결과물 검토를 요청한 상태예요. 현재는 검토 결과를 기다리세요.','검토 의견은 요청 원문과 답글에서 확인하세요.'];
  }
  if(!assignee)return [`${task.assignee?.name||'담당 크루'}가 ${current==='requested'?'요청을 확인하고 수락할':'요청 내용에 맞춰 작업할'} 차례예요.`, '추가 조건이나 변경 사항은 요청 원문의 답글에 남겨 주세요.'];
  if(current==='requested')return ['요청 내용과 기한, 참고 자료를 확인하세요.','범위나 전달할 결과가 불분명하면 요청 원문에 질문을 남기세요.','작업할 수 있으면 진행 상태를 수락함으로 바꾸고 변경을 저장하세요.'];
  const steps=current==='changes'?['원문 답글의 수정 의견을 확인하고 결과물을 보완하세요.']:current==='accepted'?['요청 내용에 맞춰 작업을 시작하고, 진행 상태를 진행 중으로 바꿔 저장하세요.']:['요청 내용을 기준으로 작업 범위와 필요한 결과물을 확인하고 제작하세요.'];
  steps.push('완성한 파일이나 링크를 이 대화방에 메시지로 올리고, 아래 결과물 메시지에서 선택하세요.');
  steps.push(hasReviewer?'진행 상태를 검토 요청으로 바꾸고 저장하세요. 지정된 검토 크루가 확인해요.':'검토가 필요하면 검토 크루를 지정하고 검토 요청으로 바꾸세요. 검토자가 없으면 요청 수락 후 담당자가 완료로 바꿀 수 있어요.');
  return steps;
}
function taskWorkdayBasisHtml(task){
  const basis=task.workday,todayKeys=['reply','due','review','recovery'],remainingKeys=['upcoming','undated','waiting'];
  const valid=basis&&/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(basis.date||'')&&Array.isArray(basis.todayReasons)&&Array.isArray(basis.remainingReasons)&&basis.todayReasons.every(key=>todayKeys.includes(key))&&basis.remainingReasons.every(key=>remainingKeys.includes(key));
  if(!valid)return '<section class="task-detail-section task-workday-basis"><h4>오늘 처리 여부 확인 필요</h4><p>서버의 오늘 분류 근거를 확인하지 못했습니다. 오늘 처리 대상이 없다는 뜻은 아닙니다. 최신 상태를 다시 불러와 주세요.</p></section>';
  const today=[...new Set(basis.todayReasons)],remaining=[...new Set(basis.remainingReasons)];
  const waitingReason=task.assigneeUnavailable||!task.assignee?.id?'현재 담당 크루를 확인할 수 없거나 참여 권한이 없어 진행 상태를 확인해야 하는 업무입니다.':task.reviewerUnavailable?'기존 검토자가 검토할 수 없어 검토가 멈춘 업무입니다. 담당자가 아닌 요청자나 관리자에게 새 검토자 지정을 요청하세요.':taskStage(task)==='review'?'결과물을 제출했고 지정된 검토자의 답변을 기다리는 업무입니다.':`${task.assignee?.name||'담당 크루'}의 요청 확인이나 작업 결과를 기다리는 업무입니다.`;
  const explanations={reply:taskStage(task)==='changes'?'수정 요청을 받은 업무라 수정 의견을 확인하고 대응해야 합니다.':'아직 수락하지 않은 요청이므로 마감일과 관계없이 지금 요청을 확인해야 합니다.',due:task.dueDate<basis.date?`마감일 ${task.dueDate}이 지났고 내 작업이 남아 있습니다.`:'오늘 마감인 내 작업입니다.',review:'내가 검토자로 지정되어 있으며 제출한 결과물이 검토를 기다리고 있습니다.',recovery:'기존 검토자가 검토할 수 없어 내가 새 검토자를 지정해야 합니다.',upcoming:`마감일은 ${task.dueDate}이며 오늘 이후에 마칠 내 작업입니다.`,undated:'남아 있는 내 작업이지만 기한이 정해지지 않아 오늘 마감으로 분류하지 않았습니다.',waiting:waitingReason};
  const reasons=(today.length?today:remaining).map(key=>explanations[key]);
  if(!reasons.length)reasons.push(taskStage(task)==='done'?'완료된 업무라 오늘 처리 대상에서 제외했습니다.':'현재 계정이 오늘 직접 처리할 대상으로 분류되지 않았습니다. 요청 내용과 현재 담당·검토 역할을 확인하세요.');
  return `<section class="task-detail-section task-workday-basis"><h4>${today.length?'오늘 할 일에 포함되는 이유':'오늘 처리 대상이 아닌 이유'}</h4><p class="workflow-help">서버 기준 ${esc(basis.date)} · 한국 시간</p><ul>${reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul></section>`;
}
function taskManagementEntryHtml(message){
  return message.task&&message.task.canManage!==false&&canPostMessage(message)?'<div class="task-management-entry"><button type="button" class="button primary" data-task-manage-entry aria-expanded="false" aria-controls="task-management">상태·담당·기한·결과물 관리</button><p class="workflow-help">변경할 내용을 확인한 뒤 ‘변경 저장’을 눌러야 적용됩니다.</p></div>':'';
}
function bindTaskManagementEntry(message,version){
  const entry=$('[data-task-manage-entry]',modal),management=$('.task-management',modal);if(!entry||!management)return;
  const userId=state.user?.id,session=state.workNotificationSession;
  entry.onclick=()=>{
    if(!modal.open||version!==modalVersion||userId!==state.user?.id||session!==state.workNotificationSession||!entry.isConnected||!management.isConnected||message.task?.canManage===false||!canPostMessage(message))return;
    management.open=true;entry.setAttribute('aria-expanded','true');
    const form=$('#task-form'),targets=[...(message.task?.canReassignReviewer?[$('#replacement-reviewer',management)]:[]),...(message.task?.allowedStages?.length?[$('select[name=stage]',form)]:[]),$('input[name=dueDate]',form),$('input[name=title]',form),$('summary',management)];targets.find(target=>target&&!target.disabled)?.focus();
  };
  management.addEventListener('toggle',()=>{if(entry.isConnected)entry.setAttribute('aria-expanded',String(management.open));});
}
function taskDetailHtml(message){
  const task=message.task;if(!task)return '';
  const source=task.message||message,room=state.channels.find(channel=>channel.id===message.channelId),mine=task.assignee?.id===state.user?.id;
  const reason=mine?(task.createdBy?.id===state.user?.id?'내가 요청한 업무이고 현재 담당 크루도 나예요.':`현재 내가 담당 크루로 지정된 업무예요. 요청자는 ${task.createdBy?.name||'현재 확인할 수 없는 크루'}예요.`):taskReviewerId(task)===state.user?.id?`내가 검토 크루로 지정된 업무예요. 담당자는 ${task.assignee?.name||'현재 확인할 수 없는 크루'}예요.`:task.createdBy?.id===state.user?.id?`내가 ${task.assignee?.name||'담당 크루'}에게 요청한 업무예요.`:`${task.assignee?.name||'담당 크루'}에게 배정된 업무예요. 내가 열람할 수 있는 대화방의 업무라 확인할 수 있어요.`;
  const completion=taskReviewerId(task)?'결과물 메시지를 연결하고 검토를 요청한 뒤, 지정된 검토 크루가 완료로 바꿔야 해요.':'검토 크루가 지정되지 않았어요. 요청을 수락한 뒤 담당자가 완료로 바꿀 수 있어요. 파일·링크를 결과물 메시지로 남기면 완료한 내용을 함께 확인할 수 있어요.';
  return `<section class="task-detail" aria-label="할 일 상세"><div class="task-detail-heading"><span class="workflow-stage" data-stage="${esc(taskStage(task))}">${taskStatusLabel(taskStage(task))}</span><h3>${esc(task.title)}</h3></div><dl class="task-detail-meta"><div><dt>요청자</dt><dd>${esc(task.createdBy?.name||'현재 확인할 수 없는 크루')}</dd></div><div><dt>담당 크루</dt><dd>${esc((task.assignee?.name||'현재 확인할 수 없는 크루')+(task.assigneeUnavailable||!task.assignee?.id?' · 담당 확인 필요':''))}</dd></div><div><dt>검토 크루</dt><dd>${esc(task.reviewerUnavailable?(task.reviewer?.name||'기존 검토자')+' · 검토 불가':task.reviewer?.name||'미지정')}</dd></div><div><dt>기한</dt><dd>${esc(task.dueDate||'기한 없음')}</dd></div><div><dt>대화방</dt><dd>${esc(room?.name||'요청 원문 대화방')}</dd></div></dl>${taskWorkdayBasisHtml(task)}<section class="task-detail-section"><h4>요청 내용</h4><p class="task-request-body">${source.body?esc(source.body):'본문 없이 자료만 연결된 요청이에요. 참고 자료와 원문을 확인하세요.'}</p>${source.files?.length||source.workspaceLink?`<div class="task-reference"><h4>참고 자료</h4>${workspaceCardHtml(source.workspaceLink)}${(source.files||[]).map(fileHtml).join('')}</div>`:''}<p class="workflow-help">구체적인 작업 범위와 전달할 결과는 이 요청을 기준으로 확인하세요. 부족한 설명은 원문 답글로 요청자에게 물어볼 수 있어요.</p><div class="task-detail-source">${sourceButton(message,'요청 원문·답글 열기')}</div></section><section class="task-detail-section"><h4>지금 할 일</h4><ol>${taskNextSteps(task).map(step=>`<li>${esc(step)}</li>`).join('')}</ol>${taskManagementEntryHtml(message)}</section>${task.resultMessage?`<section class="task-detail-section"><h4>제출한 결과물</h4><p class="task-request-body">${esc(linkedMessageTitle(task.resultMessage))}</p><div class="task-detail-source">${sourceButton({...task.resultMessage,channelId:message.channelId},'결과물·첨부 열기')}</div></section>`:''}<section class="task-detail-section"><h4>완료 조건</h4><p>${completion}</p></section><details class="task-selection"><summary>이 할 일이 표시된 이유</summary><p>${esc(reason)}</p><p>사람이 메시지를 할 일로 등록하고 담당자를 정한 기록이에요. AI가 자동으로 선정하거나 배정하지 않아요.</p></details></section>`;
}
function taskReviewerId(task){return task?.reviewerId||task?.reviewer?.id||null;}
function reviewerRecoveryHtml(task,people){
  if(!task||taskStage(task)==='done'||!task.reviewerUnavailable)return '';
  const reviewing=taskStage(task)==='review',preserved=reviewing?'기존 검토자가 이 대화방에서 검토할 수 없는 상태예요. 제출한 결과물은 그대로 유지돼요.':'기존 검토자가 이 대화방에서 검토할 수 없는 상태예요. 요청·담당·기한·진행 상태와 연결된 결과물은 그대로 유지돼요.',confirmation=reviewing?'같은 결과물로 새 검토자에게 다시 검토를 요청할게요.':'기존 요청과 담당자를 그대로 두고 새 검토자를 지정할게요.',completion=reviewing?'새 검토자가 결과물을 확인하고 승인해야 완료할 수 있어요.':'현재 진행 상태·기한·선택한 결과물을 유지하고 검토자만 바꿔요. 결과물이 아직 없어도 지정할 수 있어요.',buttonLabel=reviewing?'새 검토자에게 다시 요청':'새 검토자 지정';
  const candidates=people.filter(person=>person.id!==task.assignee?.id&&person.id!==(task.reviewerId||task.reviewer?.id));
  return `<section class="reviewer-recovery" aria-labelledby="reviewer-recovery-title"><h3 id="reviewer-recovery-title">검토자를 다시 지정해야 해요</h3><p>${esc(preserved)}</p>${task.canReassignReviewer?`<label class="field"><span>새 검토 크루</span><select id="replacement-reviewer" aria-describedby="reviewer-recovery-note"><option value="">검토할 크루를 선택하세요</option>${candidates.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></label><label class="workflow-checkbox"><input id="reviewer-recovery-confirm" type="checkbox"><span>${esc(confirmation)}</span></label><p id="reviewer-recovery-note" class="workflow-help">${esc(completion)}${!candidates.length?' 먼저 이 대화방에 검토할 크루를 초대해 주세요.':''}</p><button type="button" class="button" id="reassign-reviewer" ${candidates.length?'':'disabled'}>${esc(buttonLabel)}</button>`:'<p class="workflow-help">담당자가 아닌 업무 요청자나 관리자가 새 검토자를 지정할 수 있어요.</p>'}</section>`;
}
function bindReviewerRecovery(message,version){
  const button=$('#reassign-reviewer');if(!button||!message.task?.canReassignReviewer)return;
  const context={userId:state.user?.id,session:state.workNotificationSession},sessionCurrent=()=>context.userId===state.user?.id&&context.session===state.workNotificationSession;
  button.onclick=async()=>{
    if(!sessionCurrent()||!canPostMessage(message))return;const reviewerId=$('#replacement-reviewer').value,confirmed=$('#reviewer-recovery-confirm').checked,submit=$('button[type=submit]',$('#task-form'));
    if(!reviewerId){formError('새 검토자를 선택해 주세요.');$('#replacement-reviewer').focus();return;}
    if(!confirmed){formError(taskStage(message.task)==='review'?'같은 결과물로 다시 검토를 요청하는지 확인해 주세요.':'기존 요청과 담당자를 유지한 채 새 검토자를 지정하는지 확인해 주세요.');$('#reviewer-recovery-confirm').focus();return;}
    button.disabled=true;if(submit)submit.disabled=true;
    try{
      const result=await api(`/api/messages/${id(message.id)}/task`,{method:'PATCH',body:{revision:message.task.revision,reviewerId,reassignReviewer:true}});
      if(!sessionCurrent())return;if(modal.open&&version===modalVersion)taskDialog({...message,task:result.task});await refreshTaskViews(context,taskStage(message.task)==='review'?'새 검토자에게 같은 결과물의 검토를 다시 요청했어요.':'기존 업무를 유지하고 새 검토자를 지정했어요.');
    }catch(error){if(sessionCurrent()&&modal.open&&version===modalVersion){formError(error.status===409?'다른 크루가 먼저 변경했어요. 선택은 보존했어요. 최신 상태를 다시 불러온 뒤 검토자를 지정해 주세요.':error.message);$('#task-reload').classList.toggle('hidden',error.status!==409);button.disabled=error.status===409;if(submit)submit.disabled=error.status===409;}}
  };
}
async function refreshTaskViews(context,successMessage){
  const current=()=>context.userId===state.user?.id&&context.session===state.workNotificationSession;
  if(!current())return;
  const results=await Promise.allSettled([refreshMessages(),refreshDetailViews()]);
  if(!current())return;
  const failed=results.map((result,index)=>result.status==='rejected'?(index?'업무 화면':'대화 내용'):null).filter(Boolean);
  toast(failed.length?`${successMessage} ${failed.join('과 ')}을 새로 불러오지 못했습니다. 새로고침해 주세요.`:successMessage,Boolean(failed.length));
}
function taskCreateEntryHtml(date){
  return state.user&&canWriteMessages()?`<div class="task-create-entry"><button class="button primary" type="button" data-task-create data-task-create-date="${esc(date||'')}">할 일 등록</button><p>나만 볼 업무나 함께할 업무를 직접 기록하세요.</p></div>`:'';
}
async function openTaskCreateDialog({date=''}={}){
  if(!state.user||!canWriteMessages())return;
  openModal('할 일 등록','<div class="message-loading" role="status"><span class="spinner"></span>등록할 대화방과 담당 크루를 확인하고 있어요.</div>');modal.classList.add('task-detail-dialog');
  const version=modalVersion,context={userId:state.user.id,session:state.workNotificationSession},sessionCurrent=()=>context.userId===state.user?.id&&context.session===state.workNotificationSession,active=()=>sessionCurrent()&&modal.open&&version===modalVersion;
  let options;
  try{options=await api('/api/tasks/create-options');}catch(error){if(active()){$('.modal-body',modal).innerHTML=`<p class="form-error" role="alert">${esc(error.message)}</p><button class="button" type="button" id="task-create-retry">다시 불러오기</button>`;$('#task-create-retry').onclick=()=>openTaskCreateDialog({date});}return;}
  if(!active())return;
  if(!canWriteMessages()){$('.modal-body',modal).innerHTML='<p class="form-error" role="alert">현재 계정은 열람만 할 수 있어 할 일을 등록할 수 없습니다.</p>';return;}
  const roomAvailable=room=>!room.deletedAt&&canPostToChannel(state.channels.find(item=>item.id===room.id)||room),rooms=(options.channels||[]).filter(roomAvailable),self=rooms.find(room=>room.kind==='self'),day=/^\d{4}-\d{2}-\d{2}$/.test(options.date||'')?options.date:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'';
  if(!rooms.length){$('.modal-body',modal).innerHTML='<p class="modal-description">할 일을 등록할 수 있는 대화방이 없습니다. 대화방 참여와 작성 권한을 확인해 주세요.</p>';return;}
  $('.modal-body',modal).innerHTML=`<p class="modal-description">무엇을 해야 하는지 구체적으로 적어 주세요. 요청 내용은 선택한 대화방에 메시지로 함께 남습니다.</p><form id="task-create-form" class="workflow-form"><label class="field"><span>할 일 제목</span><input name="title" maxlength="200" placeholder="예: 캐러셀 표지와 본문 3장 만들기" required></label><label class="field"><span>요청 내용 · 완료 기준</span><textarea name="body" rows="5" maxlength="8000" placeholder="해야 할 작업, 참고할 자료, 완료할 때 남길 결과물을 적어 주세요." required></textarea></label><label class="field"><span>기록할 대화방</span><select name="channelId" required><option value="">대화방을 선택하세요</option>${rooms.map(room=>`<option value="${esc(room.id)}" ${room.id===self?.id?'selected':''}>${esc(room.kind==='self'?'나에게 메모 · 나만 보기':room.name)}</option>`).join('')}</select></label><p id="task-create-scope" class="workflow-help" aria-live="polite"></p><div id="task-create-people" class="field-row"><label class="field"><span>담당 크루</span><select name="assigneeId" required></select></label><label class="field"><span>검토 크루 · 선택</span><select name="reviewerId"></select></label></div><label class="field"><span>기한 · 한국 시간</span><input name="dueDate" type="date" value="${esc(day)}"></label><p class="workflow-help">오늘 기한으로 시작합니다. 기한을 비우면 ‘기한 미정’으로 기록해요. 다른 크루에게 맡기면 그 크루의 할 일에, 내 화면에는 진행 상황으로 표시됩니다.</p><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button primary" id="task-create-submit" type="submit">등록하고 상세 확인</button></div></form>`;
  const form=$('#task-create-form'),roomSelect=$('select[name=channelId]',form),assignee=$('select[name=assigneeId]',form),reviewer=$('select[name=reviewerId]',form),button=$('#task-create-submit'),scope=$('#task-create-scope'),requests=new Map();let busy=false;
  const chosenRoom=()=>rooms.find(room=>room.id===roomSelect.value),people=()=>{const room=chosenRoom();return room&&roomAvailable(room)?room.taskAssignees||[]:[];};
  const updatePeople=()=>{
    const candidates=people(),priorAssignee=assignee.value,priorReviewer=reviewer.value,assigned=candidates.some(person=>person.id===priorAssignee)?priorAssignee:candidates.some(person=>person.id===context.userId)?context.userId:'';
    assignee.innerHTML='<option value="">담당 크루를 선택하세요</option>'+candidates.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('');assignee.value=assigned;
    reviewer.innerHTML='<option value="">검토자 없이 담당자가 완료</option>'+candidates.filter(person=>person.id!==assigned).map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('');reviewer.value=candidates.some(person=>person.id===priorReviewer&&person.id!==assigned)?priorReviewer:'';
    const room=chosenRoom();scope.textContent=!room?'요청을 기록할 대화방을 먼저 선택하세요.':room.kind==='self'?'나에게 메모에 기록하며 나만 볼 수 있어요.':`${room.name}의 참여 크루가 요청 원문과 담당·기한을 함께 볼 수 있어요.`;button.disabled=busy||!room||!roomAvailable(room)||!candidates.length;
  };
  roomSelect.onchange=updatePeople;
  assignee.onchange=()=>{const selected=assignee.value,prior=reviewer.value;reviewer.innerHTML='<option value="">검토자 없이 담당자가 완료</option>'+people().filter(person=>person.id!==selected).map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('');reviewer.value=prior!==selected&&people().some(person=>person.id===prior)?prior:'';};
  updatePeople();$('input[name=title]',form).focus();
  form.onsubmit=async event=>{
    event.preventDefault();if(!active()||busy)return;
    if(!canWriteMessages()){formError('현재 계정은 열람만 할 수 있어 할 일을 등록할 수 없습니다.');return;}
    const values=Object.fromEntries(new FormData(form)),room=chosenRoom(),candidates=people();values.title=String(values.title||'').trim();values.body=String(values.body||'').trim();values.dueDate=values.dueDate||null;values.reviewerId=values.reviewerId||null;
    if(!room||!roomAvailable(room)){formError('이 대화방에 등록할 권한이 없습니다. 다른 대화방을 선택해 주세요.');return;}
    if(!values.title||!values.body){formError('할 일 제목과 구체적인 요청 내용을 모두 적어 주세요.');return;}
    if(!candidates.some(person=>person.id===values.assigneeId)||values.reviewerId&&(!candidates.some(person=>person.id===values.reviewerId)||values.reviewerId===values.assigneeId)){formError('이 대화방에서 업무를 처리할 담당·검토 크루를 선택해 주세요.');return;}
    const fingerprint=JSON.stringify(values);if(!requests.has(fingerprint))requests.set(fingerprint,crypto.randomUUID());values.requestId=requests.get(fingerprint);busy=true;const controls=$$('input,textarea,select,button',form),disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);$('#modal-error').classList.add('hidden');
    try{
      const result=await api('/api/tasks',{method:'POST',body:values});if(!sessionCurrent())return;
      await refreshTaskViews(context,'할 일을 등록했어요.');if(active())taskDialog({...result.message,task:result.task||result.message.task});
    }catch(error){if(active())formError(error.message);}
    finally{busy=false;if(active()){controls.forEach((control,index)=>control.disabled=disabled[index]);button.disabled=!chosenRoom()||!roomAvailable(chosenRoom())||!people().length;}}
  };
}
function taskDialog(message){
  const task=message.task,editable=task?task.canManage!==false&&canPostMessage(message):canPostMessage(message),channel=state.channels.find(room=>room.id===message.channelId),people=state.members.filter(person=>channel?.memberIds?.includes(person.id)&&person.companyRole!=='viewer');
  const current=taskStage(task),stages=[...new Set([current,...(task?.allowedStages||[])])],manager=state.user.role==='owner'||state.integrated?.canManage;
  const metadataEditable=editable&&(!task||manager||[task.createdBy?.id,task.assignee?.id].includes(state.user.id)),reviewerEditable=editable&&(!task||(!taskReviewerId(task)&&task.assignee?.id===state.user.id)||((manager||task.createdBy?.id===state.user.id)&&task.assignee?.id!==state.user.id)),resultEditable=editable&&(!task||task.assignee?.id===state.user.id)&&!['review','done'].includes(current);
  let selectedResult=task?.resultMessage|| (task?.resultMessageId?{id:task.resultMessageId,channelId:message.channelId}:null);
  openModal(task?'할 일 상세':'메시지를 할 일로',`${taskDetailHtml(message)}${task?'<details class="task-management" id="task-management"><summary>상태·담당·기한·결과물 관리</summary>':''}<p class="modal-description">요청 수락 → 작업 → 검토 요청 → 완료로 이어져요. 수정이 필요하면 결과물을 보완해 다시 검토받으세요.${!editable?' 담당자·검토자·요청자만 변경할 수 있어요.':''}</p>${reviewerRecoveryHtml(task,people)}<form id="task-form" class="workflow-form"><label class="field"><span>할 일</span><input name="title" maxlength="200" required value="${esc(task?.title||message.body?.slice(0,200)||message.workspaceLink?.title||'첨부 자료 확인')}" ${metadataEditable?'':'disabled'}></label><div class="field-row"><label class="field"><span>담당 크루</span><select name="assigneeId" required ${metadataEditable&&!['review','done'].includes(current)?'':'disabled'}>${task&&(task.assigneeUnavailable||!task.assignee?.id)?'<option value="" disabled selected>담당 크루를 다시 선택하세요</option>':''}${people.map(person=>`<option value="${esc(person.id)}" ${person.id===(task?task.assigneeUnavailable?null:task.assignee?.id:state.user.id)?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label><label class="field"><span>검토 크루</span><select name="reviewerId" ${reviewerEditable&&!['review','done'].includes(current)?'':'disabled'}><option value="">검토 요청 전에 지정</option>${task?.reviewerUnavailable&&taskReviewerId(task)?`<option value="${esc(taskReviewerId(task))}" selected>검토 불가 · ${esc(task.reviewer?.name||'기존 검토자')}</option>`:''}${people.filter(person=>!task?.reviewerUnavailable||person.id!==taskReviewerId(task)).map(person=>`<option value="${esc(person.id)}" ${person.id===taskReviewerId(task)?'selected':''}>${esc(person.name)}</option>`).join('')}</select></label></div><div class="field-row"><label class="field"><span>기한</span><input name="dueDate" type="date" value="${esc(task?.dueDate||'')}" ${metadataEditable?'':'disabled'}></label><label class="field"><span>진행 상태</span><select name="stage" ${editable&&task?'':'disabled'}>${stages.map(value=>`<option value="${esc(value)}" ${value===current?'selected':''}>${taskStatusLabel(value)}</option>`).join('')}</select></label></div><p class="workflow-help" id="workflow-stage-help">${workflowStageHelp(current)}</p><fieldset class="message-picker" id="task-result-picker"><legend>결과물 메시지</legend>${messagePickerHtml(Boolean(resultEditable))}</fieldset><div class="workflow-source-actions">${sourceButton(message,'요청 원문 열기')}${task&&canPostMessage(message)?'<button type="button" class="text-button" id="task-add-reply">원문에 의견·수정 사유 남기기</button>':''}</div><div id="modal-error" class="form-error hidden" role="alert"></div><button type="button" class="button hidden" id="task-reload">최신 상태 다시 불러오기</button>${editable?`<div class="modal-actions"><button class="button primary" type="submit">${task?'변경 저장':'업무 요청 만들기'}</button></div>`:''}</form>${task?'</details>':''}`);
  if(task)modal.classList.add('task-detail-dialog');
  const version=modalVersion,context={userId:state.user?.id,session:state.workNotificationSession},sessionCurrent=()=>context.userId===state.user?.id&&context.session===state.workNotificationSession,form=$('#task-form');
  bindTaskManagementEntry(message,version);
  $('.task-detail',modal)?.addEventListener('click',event=>{const source=event.target.closest('[data-source-message]');if(source){modal.close();openProductivitySource(source);}else if(event.target.closest('[data-action=workspace-link]'))handleProductivityAction('workspace-link',message);});
  bindReviewerRecovery(message,version);
  bindMessagePicker($('#task-result-picker'),{channelId:message.channelId,selected:selectedResult,editable:resultEditable,onChange:value=>{selectedResult=value;}});
  $('.workflow-source-actions',form).onclick=event=>{const source=event.target.closest('[data-source-message]');if(source){modal.close();openProductivitySource(source);}};
  $('#task-add-reply')?.addEventListener('click',async()=>{modal.close();await openSearchMessage(message);if(state.channelId===message.channelId)startReply(message);});
  $('select[name=stage]',form).onchange=event=>{$('#workflow-stage-help').textContent=workflowStageHelp(event.target.value);};
  $('#task-reload').onclick=async event=>{if(!sessionCurrent())return;event.currentTarget.disabled=true;try{const data=await api(`/api/messages/${id(message.id)}`);if(sessionCurrent()&&modal.open&&version===modalVersion)taskDialog(data.message);}catch(error){if(sessionCurrent()&&modal.open&&version===modalVersion){formError(error.message);$('#task-reload').disabled=false;}}};
  if(!editable)return;
  form.onsubmit=async event=>{
    event.preventDefault();if(!sessionCurrent()||!canPostMessage(message))return;const button=$('button[type=submit]',form);button.disabled=true;
    try{
      const values=Object.fromEntries(new FormData(form));if(Object.hasOwn(values,'dueDate'))values.dueDate=values.dueDate||null;values.reviewerId=Object.hasOwn(values,'reviewerId')?(values.reviewerId||null):taskReviewerId(task);values.resultMessageId=selectedResult?.id||null;
      if(task)values.revision=task.revision;else values.stage='requested';
      if(values.stage==='review'&&(!values.reviewerId||!values.resultMessageId))throw new Error('검토 크루와 결과물 메시지를 선택해 주세요.');
      await api(`/api/messages/${id(message.id)}/task`,{method:task?'PATCH':'POST',body:values});
      if(!sessionCurrent())return;if(modal.open&&version===modalVersion)modal.close();await refreshTaskViews(context,task?'업무를 업데이트했어요.':'업무 요청을 만들었어요.');
    }catch(error){if(sessionCurrent()&&modal.open&&version===modalVersion){formError(error.status===409?'다른 크루가 먼저 변경했어요. 입력 내용은 보존했어요. 최신 상태를 다시 불러온 뒤 변경해 주세요.':error.message);$('#task-reload').classList.toggle('hidden',error.status!==409);button.disabled=error.status===409;}}
  };
}
function workflowStageHelp(stage){return{requested:'담당 크루가 요청을 확인한 뒤 수락할 수 있어요.',accepted:'요청을 수락했어요. 작업을 시작하면 진행 중으로 바꾸세요.',doing:'결과물을 이 대화방에 올린 뒤 아래에서 골라 검토를 요청하세요.',review:'지정된 검토 크루가 결과물을 보고 완료 또는 수정 요청으로 바꿀 수 있어요.',changes:'수정 의견은 요청 원문의 답글에서 확인하세요. 결과물을 보완한 뒤 다시 검토를 요청하세요.',done:'완료된 업무예요. 담당자·결과물을 변경하려면 먼저 진행 중으로 바꾸고 저장한 뒤 다시 열어 주세요.'}[stage]||'';}
function messagePickerHtml(editable=true){
  return `<div class="message-picker-selected" data-picker-selected></div>${editable?'<p class="workflow-help">이 대화방의 메시지에서 결과물을 고르세요. 첨부 파일이나 공유 링크도 함께 연결돼요.</p><div class="productivity-search-row"><input type="search" data-picker-query aria-label="결과물 메시지 검색어" maxlength="200" placeholder="메시지 내용으로 찾기"><button class="button" type="button" data-picker-search>찾기</button></div><div class="message-picker-results" data-picker-results aria-live="polite"></div>':''}`;
}
function linkedMessageTitle(message){return message?.body||message?.workspaceLink?.title||message?.files?.map(file=>file.name).join(', ')||'연결된 결과물 메시지';}
function bindMessagePicker(root,{channelId,selected=null,onChange,editable=true,excludeId=null}){
  const version=modalVersion;let request=0,offset=0,query='',items=[],hasMore=false,chosen=selected;
  const active=()=>modal.open&&version===modalVersion&&root.isConnected;
  const renderChosen=()=>{$('[data-picker-selected]',root).innerHTML=chosen?`<div class="selected-result"><strong>${esc(linkedMessageTitle(chosen))}</strong><small>${esc(chosen.user?.name||'선택한 메시지')}${chosen.files?.length?' · 첨부 '+chosen.files.length+'개':''}</small><div class="workday-actions">${sourceButton({...chosen,channelId},'결과물 열기')}${editable?'<button class="text-button" type="button" data-picker-clear>선택 해제</button>':''}</div></div>`:'<p class="workday-empty">아직 선택한 결과물이 없어요.</p>';};
  const load=async(append=false)=>{
    const seq=++request,target=$('[data-picker-results]',root);if(!target)return;target.innerHTML='<p class="workflow-help">메시지를 찾고 있어요.</p>';
    try{
      const data=await api('/api/search?'+new URLSearchParams({channelId,q:query,offset:String(append?offset:0),limit:'12'}));if(!active()||seq!==request)return;
      items=append?[...items,...data.messages]:data.messages;offset=data.nextOffset??items.length;hasMore=data.hasMore;
      const candidates=items.filter(item=>String(item.id)!==String(excludeId));
      target.innerHTML=candidates.length?candidates.map(item=>`<button type="button" class="message-choice" data-picker-message="${esc(item.id)}" aria-pressed="${String(chosen?.id)===String(item.id)}"><strong>${esc(linkedMessageTitle(item))}</strong><small>${esc(item.user?.name||'크루')} · ${esc(shortDate(item.createdAt))}${item.files?.length?' · 첨부 '+item.files.length+'개':''}</small></button>`).join(''):'<p class="workday-empty">결과물 메시지가 없어요. 먼저 대화방에 결과물이나 링크를 올려 주세요.</p>';
      if(hasMore)target.insertAdjacentHTML('beforeend','<button type="button" class="text-button" data-picker-more>이전 메시지 더 보기</button>');
    }catch(error){if(active()&&seq===request)target.innerHTML=`<p class="productivity-error" role="alert">${esc(error.message)}</p><button type="button" class="button" data-picker-search>다시 찾기</button>`;}
  };
  root.onclick=event=>{
    const source=event.target.closest('[data-source-message]');if(source){modal.close();openProductivitySource(source);return;}
    if(event.target.closest('[data-picker-search]')){query=$('[data-picker-query]',root).value.trim();load();return;}
    if(event.target.closest('[data-picker-more]')){load(true);return;}
    if(event.target.closest('[data-picker-clear]')){chosen=null;onChange(null);renderChosen();$$('[data-picker-message]',root).forEach(button=>button.setAttribute('aria-pressed','false'));return;}
    const button=event.target.closest('[data-picker-message]');if(button){chosen=items.find(item=>String(item.id)===button.dataset.pickerMessage);if(!chosen)return;onChange(chosen);renderChosen();$$('[data-picker-message]',root).forEach(item=>item.setAttribute('aria-pressed',String(item===button)));}
  };
  $('[data-picker-query]',root)?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();query=event.target.value.trim();load();}});
  renderChosen();if(editable)load();
}
function decisionDialog(message){
  if(!canPostMessage(message))return;let selectedResult=null,replacesId=null,candidates=[];
  openModal('결정·최종본으로 기록',`<p class="modal-description">이미 확정한 내용만 기록하세요. 확정자는 현재 크루 <strong>${esc(state.user.name)}</strong>로 남고, 원래 대화가 함께 연결돼요.</p><form id="decision-form" class="workflow-form"><label class="field"><span>확정 내용</span><textarea name="summary" rows="3" maxlength="2000" required>${esc(message.body||message.workspaceLink?.title||'')}</textarea></label><div class="field-row"><label class="field"><span>종류</span><select name="kind"><option value="decision">결정</option><option value="final">최종본</option></select></label><label class="field"><span>적용일</span><input name="effectiveDate" type="date" required value="${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})}"></label></div><fieldset class="message-picker" id="decision-result-picker"><legend>연결할 결과물 · 최종본일 때 필수</legend>${messagePickerHtml()}</fieldset><fieldset class="decision-replacement"><legend>이전 기록 대체 · 선택</legend><p class="workflow-help">같은 대화방·같은 종류의 현재 기록만 대체할 수 있어요. 이전 기록도 연결되어 남아요.</p><div class="productivity-search-row"><input type="search" id="replacement-query" maxlength="200" placeholder="이전 확정 내용으로 찾기" aria-label="대체할 이전 기록 검색어"><button class="button" type="button" id="replacement-search">찾기</button></div><div id="replacement-results" aria-live="polite"><p class="workday-empty">이전 기록을 대체하지 않고 새로 남겨요.</p></div></fieldset><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions"><button class="button primary" type="submit">확정 기록 남기기</button></div></form>`);
  const version=modalVersion,form=$('#decision-form'),requestId=crypto.randomUUID();let replacementSeq=0;
  bindMessagePicker($('#decision-result-picker'),{channelId:message.channelId,selected:message.files?.length||message.workspaceLink?message:null,onChange:value=>{selectedResult=value;}});
  if(message.files?.length||message.workspaceLink)selectedResult=message;
  const search=async()=>{replacesId=null;const seq=++replacementSeq,kind=$('select[name=kind]',form).value;$('#replacement-results').innerHTML='<p class="workflow-help">이전 기록을 찾고 있어요.</p>';try{const data=await api('/api/decisions?'+new URLSearchParams({channelId:message.channelId,kind,current:'1',q:$('#replacement-query').value.trim(),limit:'50'}));if(!modal.open||version!==modalVersion||seq!==replacementSeq)return;candidates=data.decisions;$('#replacement-results').innerHTML=`<label class="replacement-option"><input type="radio" name="replacesId" value="" ${replacesId?'':'checked'}><span>대체 없이 새 기록</span></label>`+candidates.map(item=>`<label class="replacement-option"><input type="radio" name="replacesId" value="${esc(item.id)}" ${replacesId===item.id?'checked':''}><span><strong>${esc(item.summary)}</strong><small>${esc(item.effectiveDate)} · ${esc(personName(item.confirmedBy))}</small></span></label>`).join('')+(data.hasMore?'<p class="workflow-help">검색 결과가 많아요. 확정 내용을 더 구체적으로 입력해 주세요.</p>':'');}catch(error){if(modal.open&&version===modalVersion&&seq===replacementSeq)$('#replacement-results').innerHTML=`<p class="productivity-error" role="alert">${esc(error.message)}</p>`;}};
  $('#replacement-search').onclick=search;$('#replacement-query').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();search();}};
  $('#replacement-results').onchange=event=>{if(event.target.name==='replacesId')replacesId=event.target.value||null;};
  $('select[name=kind]',form).onchange=()=>{replacementSeq++;replacesId=null;candidates=[];$('#replacement-results').innerHTML='<p class="workday-empty">종류가 바뀌었어요. 대체할 이전 기록을 다시 찾아 주세요.</p>';};
  form.onsubmit=async event=>{event.preventDefault();const button=$('button[type=submit]',form);button.disabled=true;try{const values=Object.fromEntries(new FormData(form));values.messageId=message.id;values.resultMessageId=selectedResult?.id||null;values.replacesId=replacesId;values.requestId=requestId;if(values.kind==='final'&&!values.resultMessageId)throw new Error('최종본으로 기록할 결과물 메시지를 선택해 주세요.');await api('/api/decisions',{method:'POST',body:values});if(modal.open&&version===modalVersion)modal.close();await refreshDetailViews();toast('확정 내용과 원문을 함께 기록했어요.');}catch(error){if(modal.open&&version===modalVersion){formError(error.status===409?'선택한 이전 기록이 이미 변경됐어요. 다시 검색해서 현재 기록을 선택해 주세요.':error.message);button.disabled=false;}}};
}
function tomorrowReminder(){const date=new Date();date.setDate(date.getDate()+1);date.setHours(9,0,0,0);return date;}
function localDateTime(date){const value=new Date(date);return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}T${String(value.getHours()).padStart(2,'0')}:${String(value.getMinutes()).padStart(2,'0')}`;}
function reminderDialog(message){
  openModal('나중에 다시 보기',`<p class="modal-description">정한 시간에 내 알림함에 남기는 개인 예약이에요. 다른 크루에게는 보이지 않아요.</p><p class="workflow-help" id="reminder-scheduler-status" role="status">${esc(state.scheduledNotifications.enabled===false?workNotificationStatusText(false):'업무 알림 가동 여부를 확인하고 있어요.')}</p><button type="button" class="button reminder-tomorrow" id="remind-tomorrow" disabled>${icon('clock')}내일 오전 9시</button><form id="reminder-form"><label class="field"><span>다시 볼 시간</span><input type="datetime-local" name="remindAt" value="${localDateTime(message.reminder?.remindAt||tomorrowReminder())}" required></label><div id="modal-error" class="form-error hidden" role="alert"></div><div class="modal-actions">${message.reminder?'<button type="button" class="button" id="remove-reminder">예약 취소</button>':''}<button type="submit" class="button primary" disabled>알림 예약</button></div></form>`);
  const version=modalVersion,userId=state.user?.id,session=state.workNotificationSession,form=$('#reminder-form'),tomorrow=$('#remind-tomorrow'),submit=$('button[type=submit]',form),remove=$('#remove-reminder'),active=()=>modal.open&&version===modalVersion&&userId===state.user?.id&&session===state.workNotificationSession;
  let schedulerEnabled=null,busy=false;
  const update=()=>{if(!active())return;$('#reminder-scheduler-status').textContent=workNotificationStatusText(schedulerEnabled);tomorrow.disabled=submit.disabled=busy||schedulerEnabled!==true;if(remove)remove.disabled=busy;};
  const save=async date=>{
    if(!active()||busy||schedulerEnabled!==true)return;busy=true;update();
    try{if(!Number.isFinite(date.getTime())||date<=new Date())throw new Error('현재보다 나중 시간을 선택해 주세요.');await api(`/api/messages/${id(message.id)}/reminder`,{method:'PUT',body:{remindAt:date.toISOString()}});if(!active())return;modal.close();await refreshMessages();await refreshDetailViews();if(userId===state.user?.id&&session===state.workNotificationSession)toast('다시 볼 시간을 예약했어요.');}
    catch(error){if(active()){if(error.code==='SYNK_WORK_NOTIFICATIONS_PAUSED'){schedulerEnabled=false;setWorkNotificationStatus(false,{invalidatePending:true});}formError(error.message);}}
    finally{busy=false;update();}
  };
  tomorrow.onclick=()=>save(tomorrowReminder());form.onsubmit=event=>{event.preventDefault();return save(new Date(new FormData(form).get('remindAt')));};
  remove?.addEventListener('click',async()=>{if(!active()||busy)return;busy=true;update();try{await api(`/api/messages/${id(message.id)}/reminder`,{method:'DELETE'});if(!active())return;modal.close();await refreshMessages();await refreshDetailViews();}catch(error){if(active())formError(error.message);}finally{busy=false;update();}});
  loadWorkNotificationSettings().then(settings=>{if(!active())return;schedulerEnabled=typeof settings?.schedulerEnabled==='boolean'?settings.schedulerEnabled:null;update();}).catch(()=>{if(active()){schedulerEnabled=null;update();}});
}

boot();
