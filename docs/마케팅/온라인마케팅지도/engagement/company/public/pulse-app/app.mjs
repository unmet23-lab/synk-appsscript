import {request as networkRequest,parseInvite,PulseError} from './api.mjs';
import {refreshCasting,takeCastingValues} from './casting-view.mjs';
import {snapshotDeliverableRows,restoreDeliverableRows} from './deliverables-view.mjs';
import {productionUI,feedbackDraftChanged,addProductionDraftReset} from './production-ui.mjs';
import {kickoffSubmission} from './kickoff-view.mjs';
import {sceneConfirmation} from './scene-requests-view.mjs';
import {header,welcome,login,picker,projectView,dialogContent,liveView} from './views.mjs';
import {createLiveConnection,projectRevision} from './live.mjs';
import {withDeviceDeadline,deviceAvailability,deviceConnectionNote,deviceKey,canMigrateDevice,foregroundProjectOptions,rejectedDeviceRegistration} from './push.mjs';
import {installationEnvironment,installationGuide,devicePermissionTimeout} from './install.mjs';

// Live project contents, credentials and drafts stay in memory. Only the
// explicitly selected demo persists its own fictional project in localStorage.
// The service worker stores the public shell, never project/API responses.
let initialInvite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
const demoMode=!initialInvite&&new URLSearchParams(location.search).get('demo')==='coffee';
const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;
const request=(path,settings={})=>demo?demo.request(path,settings):networkRequest(path,foregroundProjectOptions(path,settings,document.visibilityState==='visible'));
const openNotificationsOnStart=new URLSearchParams(location.search).get('notifications')==='1';
const staffMode=!demoMode&&new URLSearchParams(location.search).get('mode')==='staff';
let initialStaffProject=staffMode?new URLSearchParams(location.search).get('project')||'':'';
const initialStaffTab=staffMode?new URLSearchParams(location.search).get('tab')||'strategy':'strategy';
let initialStaffScene=staffMode?new URLSearchParams(location.search).get('scene')||'':'';
let initialStaffHistory=staffMode?readStaffHistoryTarget(location.search):null;
let pendingInitialScene='';
history.replaceState({},'',location.pathname+(demoMode?'?demo=coffee':staffMode?'?mode=staff':''));
const s={demo:demoMode,demoGuide:null,demoPersistent:true,mode:staffMode?'staff':'customer',user:null,workspace:null,project:null,canEdit:false,csrf:'',tab:'strategy',editor:null,versionId:'',compare:false,showVersion:false,inviteUrl:'',newProject:false,installPrompt:null,error:'',conflict:false,workflow:[]};
const main=document.querySelector('#main'),dialog=document.querySelector('#app-dialog');
const wiredMedia=new WeakSet();
const drafts=new Map();let epoch=0,busy=false,loading=false,noticeTimer,leaveAction,confirmAction;
let pendingInvite='',inviteNavigationPrompt=false,inviteNavigationScheduled=false;
let deviceState=null,deviceBusy=false,deviceOperation=0,deviceRefresh=0;
const deviceMigrations=new Set();
let live=null,liveIdentity='',liveSnapshot=null,pendingRemote=null,autoFetching=false,autoAgain=false,composing=false,applyTimer;
s.live={status:'connecting',notifications:[],unreadCount:0,open:false,pending:false,deviceEnabled:false};
const identity=()=>`${s.mode}:${s.user?.id||'customer'}:${s.project?.id||'new'}`;
const draftKey=form=>[identity(),form.dataset.form,form.dataset.id||form.dataset.messageId||''].join(':');
const latestPreview=()=>s.project?.versions?.filter(v=>v.kind==='preview').at(-1);
const staffPath=(suffix='')=>`/api/client-projects/${encodeURIComponent(s.project.id)}${suffix}`;
const options=()=>({csrf:s.csrf,staff:s.mode==='staff'});
const projectStamp=()=>({epoch,id:s.project?.id,user:s.user?.id});
const current=stamp=>stamp.epoch===epoch&&(!stamp.id||stamp.id===s.project?.id)&&stamp.user===s.user?.id;
const editable=()=>s.project&&(s.mode!=='staff'||s.canEdit);
const hasDraft=type=>Array.from(drafts.entries()).some(([key,entry])=>key.startsWith(identity()+':'+type+':')&&(type!=='round-draft'||feedbackDraftChanged(s.project,entry)));
const production=productionUI({s,mutate,studioAction,notice,remember,request,options,staffPath,accept,current,projectStamp,hasDraft});

function notice(message){if(demo&&/의견을 보냈|고객에게|최종 제작을 진행하도록/.test(message))message='체험 기록에 저장했어요. 실제 의뢰나 승인은 전송되지 않습니다.';const box=document.querySelector('#notice');box.textContent=message;box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>box.hidden=true,6500);}
function remember(event){const field=event.target,form=field.closest?.('form[data-form]');if(!form||!field.name||['invite','login'].includes(form.dataset.form))return;const key=draftKey(form),entry=drafts.get(key)||{values:{},revision:0};if(form.dataset.form==='feedback'&&!entry.versionId){entry.versionId=s.versionId||latestPreview()?.id||'';if(entry.versionId)s.versionId=entry.versionId;if(form.elements.action)entry.values.action=form.elements.action.value;}entry.values[field.name]=field.type==='file'?Array.from(field.files||[]):field.type==='checkbox'?Array.from(form.elements).filter(el=>el.name===field.name&&el.checked).map(el=>el.value):field.value;if(form.dataset.form==='deliverables'){entry.deliverableRows=snapshotDeliverableRows(form);entry.values.deliverableRevision??=form.elements.deliverableRevision.value;}if(/^(round-|preview-)/.test(form.dataset.form))entry.boundData??={...form.dataset};entry.revision++;drafts.set(key,entry);if(form.dataset.form==='feedback'&&s.mode!=='staff'){const submit=form.querySelector('button[type=submit]');if(submit&&!busy)submit.disabled=!!(entry.versionId&&entry.versionId!==latestPreview()?.id&&entry.values.action!=='support');}}
function restore(scope=document){for(const form of scope.querySelectorAll('form[data-form]')){const entry=drafts.get(draftKey(form));if(!entry)continue;if(entry.boundData){Object.assign(form.dataset,entry.boundData);addProductionDraftReset(form);}if(form.dataset.form==='deliverables'&&entry.deliverableRows){restoreDeliverableRows(form,entry.deliverableRows);addProductionDraftReset(form);}for(const [name,value] of Object.entries(entry.values)){const fields=Array.from(form.elements).filter(el=>el.name===name);for(const field of fields){if(field.type==='file'){try{const transfer=new DataTransfer();for(const file of value)transfer.items.add(file);field.files=transfer.files;}catch{}}else if(field.type==='checkbox')field.checked=Array.isArray(value)&&value.includes(field.value);else if(field.type==='radio')field.checked=field.value===value;else field.value=value;const details=field.closest('details');if(details)details.open=true;}}const details=form.closest('details');if(details)details.open=true;}}
function clearDraft(key,revision){if(drafts.get(key)?.revision===revision)drafts.delete(key);}
function setBusy(value){busy=value;document.documentElement.classList.toggle('is-busy',value);for(const button of document.querySelectorAll('button[type=submit],[data-mutate]')){if(value){if(button.dataset.wasDisabled===undefined)button.dataset.wasDisabled=String(button.disabled);button.disabled=true;}else if(button.dataset.wasDisabled!==undefined){button.disabled=button.dataset.wasDisabled==='true';delete button.dataset.wasDisabled;}}main.setAttribute('aria-busy',String(value));if(!value){scheduleApply();scheduleInviteNavigation();}}
function render({remote=false}={}){s.feedbackDraftVersion=drafts.get([identity(),'feedback',''].join(':'))?.versionId||'';s.feedbackDraftAction=drafts.get([identity(),'feedback',''].join(':'))?.values.action||'';if(demo){s.demoGuide=demo.guide();s.demoPersistent=demo.snapshot().demo.persistent;}const files=remote?Array.from(main.querySelectorAll('input[type=file]')).filter(node=>node.files?.length).map(node=>({node,key:draftKey(node.form),name:node.name})):[];const previousFocus=remote&&main.contains(document.activeElement)?document.activeElement:null,focusKey=previousFocus?{action:previousFocus.dataset.action,id:previousFocus.dataset.id,tab:previousFocus.dataset.tab,href:previousFocus.getAttribute('href')}:null;const media=remote?Array.from(main.querySelectorAll('video,audio')).map(node=>({node,playing:!node.paused,time:node.currentTime})):[],details=remote?Array.from(main.querySelectorAll('details')).map((node,index)=>node.open?index:-1):[],scroll=remote?{x:scrollX,y:scrollY}:null;document.querySelector('#header-actions').innerHTML=header(s);main.innerHTML=s.project?projectView(s):s.mode==='staff'?(s.user?picker(s):login()):welcome(s);restore(main);refreshCasting(main.querySelector('[data-form=strategy]'));if(remote){for(const old of files){const form=Array.from(main.querySelectorAll('form[data-form]')).find(node=>draftKey(node)===old.key);const input=form&&Array.from(form.elements).find(node=>node.type==='file'&&node.name===old.name);if(input)input.replaceWith(old.node);}for(const fresh of main.querySelectorAll('video,audio')){const index=media.findIndex(old=>old.node.dataset.version===fresh.dataset.version&&old.node.getAttribute('src')===fresh.getAttribute('src')&&old.node.id===fresh.id);if(index!==-1){const old=media.splice(index,1)[0];fresh.replaceWith(old.node);if(old.playing&&old.node.paused)old.node.play().catch(()=>{});}}for(const [index,node] of Array.from(main.querySelectorAll('details')).entries())if(details.includes(index))node.open=true;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});else if(focusKey){const replacement=Array.from(main.querySelectorAll('button,a')).find(node=>focusKey.action?node.dataset.action===focusKey.action&&node.dataset.id===focusKey.id&&node.dataset.tab===focusKey.tab:focusKey.href&&node.getAttribute('href')===focusKey.href);replacement?.focus({preventScroll:true});}if(scroll)window.scrollTo(scroll.x,scroll.y);}const inviteField=document.querySelector('[name="invite-url"]');if(inviteField)inviteField.readOnly=true;wireMedia();production.render();if(busy)setBusy(true);syncLive();renderLive();focusInitialStaffScene();focusInitialStaffHistory();}
function wireMedia(){for(const media of main.querySelectorAll('video,img')){if(wiredMedia.has(media))continue;wiredMedia.add(media);media.addEventListener('error',()=>{if(media.id==='review-video'){const error=document.querySelector('#video-error');if(error)error.hidden=false;}else if(media.tagName==='IMG'&&!media.closest('.welcome-art')){media.hidden=true;const parent=media.closest('[data-action=image]');if(parent){parent.disabled=true;parent.textContent='이미지를 불러오지 못했어요';parent.classList.add('empty-visual');}}},{once:true});}}
function openDialog(type,item={}){if(dialog.open)dialog.close();dialog.dataset.installGuide=String(type==='install');dialog.className=type==='image'?'app-dialog image-dialog':'app-dialog';dialog.innerHTML=(demo?'<p class="demo-dialog-note">체험 프로젝트 · 실제 의뢰·승인으로 전송되지 않아요.</p>':'')+dialogContent(type,item);restore(dialog);dialog.showModal();}
function closeDialog(){if(dialog.open)dialog.close();scheduleApply();}
function showMutationError(message){
  if(!dialog.open)return;
  let alert=dialog.querySelector('[data-mutation-error]');
  if(!alert){alert=document.createElement('p');alert.className='inline-alert';alert.dataset.mutationError='true';alert.setAttribute('role','alert');alert.tabIndex=-1;dialog.prepend(alert);}
  alert.textContent=message;alert.focus({preventScroll:true});alert.scrollIntoView({block:'nearest'});
}
function installEnvironment(){return installationEnvironment({userAgent:navigator.userAgent,platform:navigator.platform,maxTouchPoints:navigator.maxTouchPoints,standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone,secure:window.isSecureContext});}
function showInstallGuide(){openDialog('install',{guide:installationGuide(installEnvironment(),{connected:!demo&&!!(s.project||s.user),enabled:s.live.deviceEnabled,canPrompt:!!s.installPrompt}),installed:!!s.installed});dialog.dataset.installGuide='true';}
function updateInstallGuide(){document.querySelector('#header-actions').innerHTML=header(s);if(dialog.open&&dialog.dataset.installGuide==='true')showInstallGuide();}
// Reused PWA windows can receive a new invitation without a page reload.
// Keep the capability only in memory while an edit or request finishes.
function cancelInviteNavigation(){pendingInvite='';if(inviteNavigationPrompt)leaveAction=null;inviteNavigationPrompt=false;}
function queueInviteNavigation(){
  const params=new URLSearchParams(location.hash.slice(1));if(!params.has('invite'))return;
  const invite=parseInvite(params.get('invite'));history.replaceState({},'',location.pathname+location.search);
  if(!invite){notice('받은 초대 링크를 다시 확인해 주세요.');return;}
  pendingInvite=invite;
  if(busy||loading||dialog.open||composing)notice('새 초대 링크를 받았어요. 현재 작업이나 확인을 마치면 연결합니다.');
  scheduleInviteNavigation();
}
function scheduleInviteNavigation(){
  if(!pendingInvite||inviteNavigationScheduled)return;inviteNavigationScheduled=true;
  queueMicrotask(()=>{inviteNavigationScheduled=false;if(!pendingInvite||inviteNavigationPrompt||busy||loading||dialog.open||composing)return;
    inviteNavigationPrompt=!!drafts.size;
    withLeave(()=>{inviteNavigationPrompt=false;const invite=pendingInvite;pendingInvite='';if(!invite)return;
      if(demo||s.mode!=='customer'){location.assign(location.pathname+'#invite='+encodeURIComponent(invite));return;}
      resetContext();s.user=null;s.workspace=null;s.csrf='';render();void start(invite);
    });
  });
}
function withLeave(action){if(busy||loading){notice('현재 요청이 끝난 뒤 이동해 주세요.');return;}if(drafts.size){leaveAction=action;openDialog('leave');}else action();}
function resetContext({preserveInvite=false}={}){production.reset();pendingInitialScene='';if(!preserveInvite)cancelInviteNavigation();live?.stop();live=null;liveIdentity='';liveSnapshot=null;deviceState=null;deviceOperation++;deviceRefresh++;deviceBusy=false;s.live.deviceBusy=false;setBusy(false);epoch++;drafts.clear();pendingRemote=null;closeDialog();Object.assign(s,{project:null,canEdit:false,editor:null,versionId:'',compare:false,showVersion:false,inviteUrl:'',error:'',conflict:false,workflow:[],historyTarget:null,tab:'strategy'});}
function accept(result){if(!result.project&&result.id&&Number.isFinite(result.revision))result={...result,project:result};if(result.project&&!result.project.studio&&result.project.id===s.project?.id)result.project.studio=s.project.studio;if(result.csrf)s.csrf=result.csrf;if(result.csrfToken)s.csrf=result.csrfToken;if(result.project){if(!s.project&&!result.project.studio?.strategy?.revision){const versions=result.project.versions||[];if(versions.some(v=>v.kind==='final')&&result.project.stage==='delivered')s.tab='history';else if(versions.some(v=>v.kind==='preview'))s.tab='review';}s.project=result.project;if(!s.project.studio)s.project.studio={preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[]};if(result.canEdit!==undefined)s.canEdit=!!result.canEdit;}}
function renderLive(){const box=document.querySelector('#pulse-live');if(!box)return;box.hidden=!!demo||!(s.project||s.user);if(box.hidden)return;const active=box.contains(document.activeElement)?document.activeElement.dataset?.id:null;box.innerHTML=liveView(s);if(active)Array.from(box.querySelectorAll('[data-action=open-notification]')).find(node=>node.dataset.id===active)?.focus({preventScroll:true});const badge=document.querySelector('[data-action=notifications]');if(badge){badge.textContent=`알림${s.live.unreadCount?' '+s.live.unreadCount:''}`;badge.setAttribute('aria-expanded',String(s.live.open));}}
function syncLive(){if(demo)return;const key=s.mode==='staff'?(s.user?`staff:${s.user.id}`:''):(s.project?`customer:${s.project.id}`:'');if(key===liveIdentity)return;live?.stop();live=null;liveIdentity=key;liveSnapshot=null;pendingRemote=null;deviceState=null;s.live={...s.live,deviceEnabled:false,deviceReady:false,deviceNote:'기기 알림 상태를 확인하고 있어요.',deviceIssue:'',deviceProgress:'',deviceUncertain:false,notifications:[],unreadCount:0,open:openNotificationsOnStart,pending:false,status:'connecting'};if(!key)return;refreshDevice();live=createLiveConnection({mode:s.mode,request,options,onSnapshot:snapshot=>{if(key!==liveIdentity)return;if((s.mode==='staff'&&snapshot.userId&&snapshot.userId!==s.user?.id)||(s.mode==='customer'&&snapshot.projectId&&snapshot.projectId!==s.project?.id)){connectionExpired();return;}liveSnapshot=snapshot;s.live.notifications=snapshot.notifications||[];s.live.unreadCount=snapshot.unreadCount||0;renderLive();fetchRemote();},onFresh:items=>{if(key!==liveIdentity)return;notice(items.length===1?items[0].title:`새 알림 ${items.length}개가 도착했어요.`);},onStatus:status=>{s.live.status=status;renderLive();},onExpired:connectionExpired});}
const devicePath=()=>s.mode==='staff'?'/api/pulse-device-notifications':'/pulse/api/device-notifications';
const deviceScope=()=>'/pulse-app/push-'+s.mode+'/';
function pushSupport(){return deviceAvailability({...installEnvironment(),serviceWorker:'serviceWorker' in navigator,pushManager:'PushManager' in window,notification:'Notification' in window,permission:globalThis.Notification?.permission});}
async function deviceRequest(path,settings={}){const controller=new AbortController();return withDeviceDeadline(request(path,{...settings,signal:controller.signal}),{onTimeout:()=>controller.abort()});}
async function localPush(){return withDeviceDeadline((async()=>{const registration=await navigator.serviceWorker.getRegistration(deviceScope());if(!registration||new URL(registration.scope).pathname!==deviceScope())return {registration:null,subscription:null,hash:''};const subscription=await registration.pushManager.getSubscription();const digest=subscription?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint)):null;return {registration,subscription,hash:digest?Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join(''):''};})());}
async function refreshDevice(){
  const key=liveIdentity,requestEpoch=epoch,refreshId=++deviceRefresh,csrf=s.csrf,mode=s.mode,path=devicePath();
  if(!key||demo||deviceBusy)return;
  const valid=()=>key===liveIdentity&&requestEpoch===epoch&&refreshId===deviceRefresh&&csrf===s.csrf;
  const unsupported=pushSupport();
  if(unsupported){s.live.deviceEnabled=false;s.live.deviceNote=unsupported;s.live.deviceReady=false;renderLive();return;}
  try{
    let [server,local]=await Promise.all([deviceRequest(path),localPush()]);if(!valid())return;
    const existing=server.subscriptions?.find(item=>item.endpointHash===local.hash),migrationKey=key+':'+local.hash;
    // Carry forward only this recipient's previously explicit device opt-in.
    // Browser permission or a subscription belonging to someone else is not consent.
    if(canMigrateDevice({mode,server,local,permission:Notification.permission})&&!deviceMigrations.has(migrationKey)){
      deviceMigrations.add(migrationKey);
      try{await deviceRequest(path,{csrf,body:{subscription:local.subscription.toJSON(),label:existing.label||'PULSE · 고객 · 내 브라우저'}});if(!valid())return;server=await deviceRequest(path);if(!valid())return;}
      catch(error){deviceMigrations.delete(migrationKey);if(!valid())return;s.live.deviceIssue='기억한 기기 연결을 갱신하지 못했어요. 알림함을 다시 열면 재시도합니다.';}
    }
    deviceState={server,local};
    const row=server.subscriptions?.find(item=>item.endpointHash===local.hash);
    s.live.deviceEnabled=!!(server.configured&&row?.enabled&&row.currentSession&&Notification.permission==='granted');
    if(s.live.deviceUncertain&&s.live.deviceEnabled&&(mode==='staff'||server.deviceConnection?.remembered)){s.live.deviceUncertain=false;s.live.deviceIssue='';notice('이 기기의 PULSE 알림 연결을 확인했어요.');}
    s.live.deviceReady=!!server.configured;
    s.live.deviceNote=deviceConnectionNote({mode:s.mode,enabled:s.live.deviceEnabled,configured:server.configured,connection:server.deviceConnection});
    if(s.mode==='customer'&&s.live.deviceEnabled&&server.deviceConnection?.remembered&&server.deviceConnection.expiresAt)s.live.deviceNote+=' 현재 연결 유효 시각: '+new Date(server.deviceConnection.expiresAt).toLocaleString('ko-KR');
    renderLive();
  }catch(error){if(valid()){s.live.deviceReady=false;s.live.deviceNote=error.message;renderLive();}}
}
async function activePushRegistration(registration){if(registration.active)return registration;const worker=registration.installing||registration.waiting;if(!worker)throw new PulseError('기기 알림을 준비하지 못했어요. 다시 시도해 주세요.');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(new PulseError('기기 알림 준비가 지연되고 있어요. 다시 시도해 주세요.'));},12000);function check(){if(worker.state==='activated'||worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',check);worker.state==='activated'?resolve():reject(new PulseError('기기 알림을 준비하지 못했어요.'));}}worker.addEventListener('statechange',check);check();});return registration;}
async function enableDeviceNotices(){
  if(deviceBusy||!deviceState||!s.live.deviceReady)return;
  const key=liveIdentity,csrf=s.csrf,requestEpoch=epoch,operation=++deviceOperation,state=deviceState,mode=s.mode,path=devicePath(),scope=deviceScope(),disabling=s.live.deviceEnabled;
  const valid=()=>operation===deviceOperation&&key===liveIdentity&&csrf===s.csrf&&requestEpoch===epoch;
  const settings={csrf,staff:mode==='staff'};
  let created=null;
  // Invoke permission synchronously within the user's click, before any await.
  let permission;
  try{permission=disabling?null:Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();}catch(error){s.live.deviceIssue=error.message;renderLive();return;}
  deviceBusy=true;s.live.deviceBusy=true;s.live.deviceIssue='';s.live.deviceUncertain=false;s.live.deviceProgress=disabling?'이 기기의 알림을 끄고 있어요.':'브라우저의 알림 허용 창을 확인해 주세요.';renderLive();
  try{
    if(disabling){
      const row=state.server.subscriptions?.find(item=>item.endpointHash===state.local.hash);
      if(row)await deviceRequest(path+'/'+encodeURIComponent(row.id),{...settings,method:'DELETE'});
      if(!valid())return;
      await withDeviceDeadline(state.local.subscription?.unsubscribe());
      notice('이 기기의 PULSE 알림을 껐어요. 앱 알림함은 계속 사용할 수 있어요.');
    }else{
      const granted=await withDeviceDeadline(permission,{message:devicePermissionTimeout(installEnvironment())});
      if(!valid())return;
      if(granted!=='granted'){s.live.deviceIssue='알림이 허용되지 않았어요. 브라우저의 알림 설정을 확인한 뒤 다시 켜 주세요.';notice(s.live.deviceIssue);return;}
      s.live.deviceProgress='이 기기의 알림을 연결하고 있어요.';renderLive();
      const applicationServerKey=deviceKey(state.server.publicKey);
      const registration=await activePushRegistration(state.local.registration||await withDeviceDeadline(navigator.serviceWorker.register('./push-sw.js?mode='+mode,{scope,updateViaCache:'none'})));
      if(!valid())return;
      let subscription=await withDeviceDeadline(registration.pushManager.getSubscription());
      if(!valid())return;
      if(!subscription){subscription=await withDeviceDeadline(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey}));created=subscription;}
      if(!valid())return;
      await deviceRequest(path,{...settings,body:{subscription:subscription.toJSON(),label:'PULSE · '+(mode==='staff'?'제작자':'고객')+' · '+(/Windows/.test(navigator.userAgent)?'Windows PC':'내 브라우저')}});
      created=null;
      if(valid())notice('이 기기에서 PULSE 알림을 켰어요.');
    }
  }catch(error){
    if(created&&valid()&&rejectedDeviceRegistration(error))try{await withDeviceDeadline(created.unsubscribe());}catch{}
    if(valid()){s.live.deviceUncertain=!!created&&!rejectedDeviceRegistration(error);s.live.deviceIssue=error.message;notice(error.message);}
  }finally{
    if(operation===deviceOperation){deviceBusy=false;s.live.deviceBusy=false;s.live.deviceProgress='';renderLive();if(liveIdentity)await refreshDevice();}
  }
}
navigator.serviceWorker?.addEventListener('message',async event=>{if(event.origin!==location.origin||event.data?.type!=='pulse:open-notifications'||event.data.mode!==s.mode||demo)return;const registration=await navigator.serviceWorker.getRegistration(deviceScope());if(event.source!==registration?.active)return;s.live.open=true;renderLive();live?.pull();refreshDevice();});
function canApplyRemote(){const active=document.activeElement;return !busy&&!loading&&!composing&&!dialog.open&&!document.hidden&&!active?.matches('input,textarea,select,[contenteditable=true]')&&!document.fullscreenElement&&!document.pictureInPictureElement&&!document.querySelector('[data-animatic-player][data-preview-playing="true"]')&&!Array.from(document.querySelectorAll('[data-preview-test]')).some(video=>!video.paused&&!video.ended);}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(()=>{if(canApplyRemote()){if(pendingRemote)applyRemote();else fetchRemote();}},180);}
function applyRemote(){if(!pendingRemote||!canApplyRemote())return;const pending=pendingRemote;pendingRemote=null;s.live.pending=false;if(!current(pending.stamp))return;if(pending.result?.project){if(Number(pending.result.project.revision)<Number(s.project?.revision)){renderLive();return;}const showing=main.querySelector('#review-video')?.dataset.version||s.versionId;if(showing)s.versionId=showing;accept(pending.result);if(pending.workflow)s.workflow=pending.workflow;}if(pending.workspace)s.workspace=pending.workspace;s.live.pending=false;s.error='';s.conflict=false;render({remote:true});}
async function fetchRemote(){if(!liveSnapshot||demo)return;if(busy||loading||autoFetching){autoAgain=true;return;}const stamp=projectStamp(),target=s.project?projectRevision(liveSnapshot,s.project.id,s.mode):null;if(s.project&&(target===undefined||Number(target)<=Number(s.project.revision))){if(target===undefined&&s.mode==='staff')connectionExpired();return;}const workspaceSignature=s.mode==='staff'&&!s.project?JSON.stringify(liveSnapshot.projects||[]):null;if(workspaceSignature!==null&&s.live.workspaceSignature===workspaceSignature)return;autoFetching=true;autoAgain=false;try{if(s.project){const result=await request(s.mode==='staff'?staffPath('/studio'):'/pulse/api/project');if(!current(stamp))return;if(result.project?.id!==s.project.id){connectionExpired();return;}if(Number(result.project?.revision)<Number(s.project.revision))return;let workflow=null;if(s.mode==='staff'){const response=await request('/api/client-workflow');if(!current(stamp))return;workflow=response.items||[];}pendingRemote={stamp,result,workflow};}else if(s.mode==='staff'&&s.user){const workspace=await request('/api/client-projects');if(!current(stamp))return;pendingRemote={stamp,workspace};s.live.workspaceSignature=workspaceSignature;}s.live.pending=!!pendingRemote;renderLive();applyRemote();}catch(error){if(current(stamp)){if(error.status===401||error.status===403||error.status===404)connectionExpired();else{s.live.status='reconnecting';renderLive();}}}finally{autoFetching=false;if(autoAgain){autoAgain=false;scheduleApply();}}}
document.addEventListener('compositionstart',()=>{composing=true;});document.addEventListener('compositionend',()=>{composing=false;scheduleApply();});document.addEventListener('focusout',scheduleApply);dialog.addEventListener('close',scheduleApply);document.addEventListener('visibilitychange',scheduleApply);window.addEventListener('focus',scheduleApply);document.addEventListener('fullscreenchange',scheduleApply);document.addEventListener('leavepictureinpicture',scheduleApply,true);
async function fetchWorkflow(){if(s.mode!=='staff')return;try{const stamp=projectStamp(),result=await request('/api/client-workflow');if(current(stamp))s.workflow=result.items||[];}catch{if(s.project)notice('내부 검토 상태를 불러오지 못했어요. 새로 불러오기를 눌러 주세요.');}}
async function loadProject(id){const requestEpoch=epoch;const result=await request(s.mode==='staff'?`/api/client-projects/${encodeURIComponent(id)}/studio`:'/pulse/api/project');if(requestEpoch!==epoch)return;if(s.mode==='customer'&&s.project&&result.project?.id!==s.project.id){resetContext({preserveInvite:true});accept(result);render();notice('다른 프로젝트로 연결되어 이전 프로젝트와 작성 내용을 닫았어요.');return;}accept(result);if(s.mode==='staff')await fetchWorkflow();}
async function loadWorkspace(){const requestEpoch=epoch,result=await request('/api/client-projects');if(requestEpoch!==epoch)return;s.workspace=result;}
function readStaffHistoryTarget(search){
  const params=new URLSearchParams(search),keys=[...params.keys()],uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const kind=params.has('comment')?'comment':params.has('review')?'review':'';
  if(!kind||params.get('mode')!=='staff'||params.get('tab')!=='history'||keys.length!==4||new Set(keys).size!==keys.length||keys.some(key=>!['mode','project','tab',kind].includes(key))||!uuid.test(params.get('project')||'')||!uuid.test(params.get(kind)||''))return null;
  return {projectId:params.get('project'),kind,id:params.get(kind)};
}
function staffHistoryRecordId(project,target){
  if(!target||project?.id!==target.projectId||!['comment','review'].includes(target.kind))return '';
  const records=target.kind==='comment'?project.studio?.comments:project.studio?.sceneReviews;
  return Array.isArray(records)&&records.some(record=>record.id===target.id)?'pulse-history-'+target.kind+'-'+target.id:'';
}
function focusInitialStaffHistory(){
  const target=s.historyTarget;s.historyTarget=null;
  if(s.mode!=='staff'||s.tab!=='history'||!target)return;
  const id=staffHistoryRecordId(s.project,target),record=id&&main.querySelector('#'+id);
  if(!record){notice('연결한 의견을 찾지 못했어요. 현재 프로젝트의 이력을 확인해 주세요.');return;}
  record.classList.add('notification-target');record.focus({preventScroll:true});record.scrollIntoView({block:'center',behavior:'auto'});
}
async function openInitialStaffProject(){const id=initialStaffProject;if(!id||s.mode!=='staff'||!s.user)return;initialStaffProject='';const requestEpoch=epoch,userId=s.user.id,sceneId=initialStaffScene,historyTarget=initialStaffHistory;initialStaffScene='';initialStaffHistory=null;if(!s.workspace?.projects?.some(project=>project.id===id)){notice('이 프로젝트를 찾을 수 없거나 열람 권한이 없어요. 현재 프로젝트 목록에서 선택해 주세요.');return;}await loadProject(id);if(requestEpoch!==epoch||s.user?.id!==userId)return;s.tab=initialStaffTab==='scenes'?'storyboard':['strategy','direction','concepts','storyboard','review','history'].includes(initialStaffTab)?initialStaffTab:'strategy';if(historyTarget&&s.tab==='history'){if(staffHistoryRecordId(s.project,historyTarget))s.historyTarget=historyTarget;else notice('연결한 의견을 찾지 못했어요. 현재 프로젝트의 이력을 확인해 주세요.');}if(sceneId&&s.tab==='storyboard'){if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sceneId)&&s.project?.id===id&&s.project.studio?.scenes?.some(scene=>scene.id===sceneId))pendingInitialScene=sceneId;else notice('연결한 장면을 찾지 못했어요. 현재 프로젝트의 장면 목록을 확인해 주세요.');}}
function focusInitialStaffScene(){if(!pendingInitialScene)return;const id=pendingInitialScene;pendingInitialScene='';if(s.mode!=='staff'||s.tab!=='storyboard'||!s.project?.studio?.scenes?.some(scene=>scene.id===id))return;const card=main.querySelector('#scene-'+id);if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}}
async function start(invite=''){if(busy||loading)return;loading=true;const requestEpoch=epoch;try{if(s.mode==='staff'){const result=await request('/api/me');if(requestEpoch!==epoch)return;if(!result.user){s.user=null;s.csrf='';render();return;}if(s.user&&s.user.id!==result.user.id)resetContext();s.user=result.user;s.csrf=result.csrfToken||'';await loadWorkspace();if(requestEpoch!==epoch)return;await openInitialStaffProject();}else{const result=invite?await request('/pulse/api/open',{body:{invite}}):await request('/pulse/api/project');if(requestEpoch!==epoch)return;accept(result);}s.error='';s.conflict=false;render();}catch(error){if(requestEpoch!==epoch)return;if(error.status===401||error.status===403){s.user=null;s.project=null;s.csrf='';}render();if(invite||error.status!==401)notice(error.message);}finally{loading=false;scheduleInviteNavigation();}}
function connectionExpired(){resetContext();s.user=null;s.workspace=null;s.csrf='';render();notice('연결이 만료되었거나 권한이 바뀌어 프로젝트를 닫았어요. 다시 연결해 주세요.');}
async function refresh(){if(busy||loading)return;loading=true;const stamp=projectStamp();try{if(s.mode==='staff'){const me=await request('/api/me');if(!current(stamp))return;if(!me.user||me.user.id!==s.user?.id){resetContext();s.user=me.user||null;s.csrf=me.csrfToken||'';if(s.user)await loadWorkspace();render();notice('로그인 계정이 바뀌어 이전 프로젝트를 닫았어요.');return;}s.csrf=me.csrfToken||s.csrf;}if(s.project)await loadProject(s.project.id);else if(s.user)await loadWorkspace();if(!current(stamp))return;s.error='';s.conflict=false;render();notice('최신 내용을 불러왔어요. 작성 중인 내용은 유지됩니다.');}catch(error){if(current(stamp)){if(error.status===401||error.status===403)connectionExpired();else{s.error=error.message;render();notice(error.message);}}}finally{loading=false;scheduleInviteNavigation();}}
async function mutate(operation,{form=null,message='저장했어요.',after,workflowAction=null}={}){if(busy||loading)return false;if(!editable()&&s.project&&!(s.mode==='staff'&&workflowAction&&s.workflow.some(row=>row.projectId===s.project.id&&row.messageId===workflowAction.messageId&&row.actions?.some(action=>action.action===workflowAction.action)))){notice('이 프로젝트는 열람만 할 수 있어요.');return false;}const stamp=projectStamp(),key=form?draftKey(form):'',revision=drafts.get(key)?.revision;setBusy(true);dialog.querySelector('[data-mutation-error]')?.remove();let committed=false;try{const result=await operation();if(!current(stamp))return false;committed=true;accept(result||{});if(key)clearDraft(key,revision);s.error='';s.conflict=false;if(after)await after(result||{});if(!current(stamp))return true;if(s.mode==='staff'&&s.project)await loadProject(s.project.id);render();notice(message);return true;}catch(error){if(current(stamp)){if(error.status===401||error.status===403)connectionExpired();else{s.error=committed?'변경은 저장됐지만 최신 화면을 불러오지 못했어요. 새로 불러오기를 눌러 주세요.':error.message;s.conflict=error.status===409;render();notice(s.error);showMutationError(s.error);}}return false;}finally{if(stamp.epoch===epoch)setBusy(false);}}
function studioAction(action,values={}){return request(s.mode==='staff'?staffPath('/studio'):'/pulse/api/studio',{...options(),body:{...values,action,revision:s.project.revision}});}
function projectAction(action,values={}){return request('/pulse/api/action',{...options(),body:{...values,action,revision:s.project.revision}});}
function validateFile(file,{imageOnly=false}={}){if(!file?.size)return;if(file.size>100*1024*1024)throw new PulseError('파일은 100MiB 이하여야 해요.');const types=imageOnly?['image/png','image/jpeg']:['image/png','image/jpeg','video/mp4','video/webm'];if(!types.includes(file.type))throw new PulseError(imageOnly?'PNG 또는 JPEG 이미지를 선택해 주세요.':'MP4·WebM 영상 또는 PNG·JPEG 이미지를 선택해 주세요.');}
async function attachImage(values){const file=values.file;delete values.file;if(file?.size){validateFile(file,{imageOnly:true});const stamp=projectStamp(),result=await request(s.mode==='staff'?staffPath('/studio/media'):'/pulse/api/studio/media',{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Project-Revision':String(s.project.revision)}});if(!current(stamp))throw new PulseError('프로젝트가 변경됐어요.');accept(result);values.assetId=result.asset.id;values.imageUrl='';}return values;}

document.addEventListener('input',remember);document.addEventListener('change',remember);
document.addEventListener('input',event=>{if(event.target.name==='cast_notes')refreshCasting(event.target.form);});
document.addEventListener('change',event=>{if(event.target.name?.startsWith('cast_'))refreshCasting(event.target.form,{modelChanged:event.target.name==='cast_modelId'});});
document.addEventListener('play',event=>{if(event.target.matches('audio,video'))for(const media of document.querySelectorAll('audio,video'))if(media!==event.target)media.pause();},true);
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();if(busy||loading)return;const type=form.dataset.form,values=Object.fromEntries(new FormData(form));
  if(type==='invite'){const invite=parseInvite(values.invite);if(!invite){notice('받은 초대 링크를 다시 확인해 주세요.');return;}resetContext();await start(invite);return;}
  if(type==='login'){setBusy(true);try{const result=await request('/api/login',{body:values});resetContext();s.user=result.user;s.csrf=result.csrfToken||'';await loadWorkspace();await openInitialStaffProject();render();}catch(error){notice(error.message);}finally{setBusy(false);}return;}
  if(type==='new-project'){await mutate(()=>request('/api/client-projects',{...options(),body:{...values,ownerId:s.user.id}}),{form,message:'프로젝트를 만들었어요.',after:async result=>{s.newProject=false;accept(result);if(!s.project&&result.id)await loadProject(result.id);if(s.project)await loadProject(s.project.id);s.tab='strategy';}});return;}
  if(!s.project)return;
  if(await production.submit(form))return;
  if(type==='kickoff-source'){await mutate(()=>request('/pulse/api/action',{...options(),body:kickoffSubmission(s,form.dataset,values.sourceKey)}),{form,message:'자료가 도착했어요. 담당자가 사용 가능 여부를 확인합니다.'});return;}
  if(type==='confirm-delivery'){if(s.mode!=='customer'||!s.project.closeout?.canConfirm||values.confirmed!=='yes')return;if(form.dataset.id!==s.project.closeout.deliveryKey||Number(form.dataset.revision)!==s.project.revision){drafts.delete(draftKey(form));closeDialog();notice('납품 내용이 바뀌었어요. 최신 파일과 안내를 다시 확인해 주세요.');return;}await mutate(()=>request('/pulse/api/action',{...options(),body:{action:'confirm_delivery',confirmed:true,revision:Number(form.dataset.revision),deliveryKey:form.dataset.id}}),{form,message:'이 파일과 안내의 수령 확인을 남겼어요.',after:closeDialog});return;}
  if(type==='strategy'){values.castingSelection=takeCastingValues(values);values.channels=new FormData(form).getAll('channels');for(const key of ['durationSeconds','budgetProduction','budgetMedia'])values[key]=values[key]===''||values[key]===undefined?null:Number(values[key]);await mutate(()=>studioAction('save_strategy',{strategy:values}),{form,message:'제작 설계를 저장했어요. 변경한 방향은 다시 함께 확인할 수 있습니다.'});return;}
  if(type==='preferences')await mutate(()=>studioAction('save_preferences',{preferences:values}),{form});
  if(type==='reference')await mutate(async()=>{await attachImage(values);delete values.imageUrl;return studioAction('save_reference',values);},{form,message:'참고자료를 함께 볼 수 있게 저장했어요.'});
  if(type==='reference-opinion')await mutate(()=>{const ref=s.project.studio.references.find(r=>r.id===form.dataset.id);if(!ref)throw new PulseError('참고자료를 다시 불러와 주세요.');return studioAction('save_reference',{id:ref.id,label:ref.label,url:ref.url,assetId:ref.assetId,preference:values.preference,reason:values.reason});},{form,message:'참고자료에 대한 생각을 저장했어요.',after:closeDialog});
  if(type==='concept'||type==='scene')await mutate(async()=>{await attachImage(values);if(form.dataset.id)values.id=form.dataset.id;if(type==='scene'){values.duration=values.duration===''?'':Number(values.duration);values.valueNumbers=new FormData(form).getAll('valueNumbers').map(Number);}return studioAction(type==='concept'?'save_concept':'save_scene',values);},{form,message:'자료를 저장했어요.',after:()=>{s.editor=null;}});
  if(type==='select-concept')await mutate(()=>studioAction('select_concept',{conceptId:form.dataset.id,conceptRevision:Number(form.dataset.revision),text:values.text}),{form,message:'함께 만들 콘셉트를 선택했어요.',after:closeDialog});
  if(type==='review-scene')await mutate(()=>studioAction('review_scene',{sceneId:form.dataset.id,sceneRevision:Number(form.dataset.revision),...values}),{form,message:'장면에 의견을 남겼어요.',after:closeDialog});
  if(type==='comment')await mutate(()=>studioAction('comment',{targetType:form.dataset.target,targetId:form.dataset.id,targetRevision:Number(form.dataset.revision),text:values.text}),{form,message:'의견을 보냈어요.',after:closeDialog});
  if(type==='feedback')await mutate(()=>{if(s.mode==='staff')return request(staffPath('/messages'),{...options(),body:{revision:s.project.revision,text:values.text,visibility:'customer'}});const latest=latestPreview(),version=s.project.versions.find(v=>v.id===s.versionId)||s.project.versions.at(-1),bound=drafts.get(draftKey(form))?.versionId;if((bound&&bound!==latest?.id&&values.action!=='support')||(values.action==='feedback'&&(!latest||version?.id!==latest.id||latest.approvedAt||(bound&&bound!==latest.id))))throw new PulseError('작성하던 의견은 이전 시안에 연결되어 있어요. 최신 시안을 먼저 확인해 주세요. 글은 그대로 남아 있습니다.');return projectAction(values.action,{text:values.text,...(values.action==='feedback'?{versionId:latest.id,seconds:values.seconds===''?(document.querySelector('#review-video')?Math.round(document.querySelector('#review-video').currentTime*10)/10:null):Number(values.seconds)}:{})});},{form,message:'의견을 보냈어요.'});
  if(type==='project')await mutate(()=>request(staffPath(),{...options(),body:{contact:s.project.contact||'',internalNotes:s.project.internalNotes||'',nextContactDate:s.project.nextContactDate||'',...values,revision:s.project.revision}}),{form,after:async()=>loadProject(s.project.id)});
  if(type==='version')await mutate(async()=>{const file=values.file;delete values.file;if(file?.size){validateFile(file);return request(staffPath('/media'),{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Version-Label':encodeURIComponent(values.label),'X-Version-Kind':values.kind,'X-Version-Guide':encodeURIComponent(values.guide),'X-Project-Revision':String(s.project.revision)}});}if(!values.url)throw new PulseError('파일 또는 자료 링크를 넣어 주세요.');return request(staffPath('/versions'),{...options(),body:{...values,revision:s.project.revision}});},{form,message:'고객이 확인할 자료를 전달했어요.',after:async()=>{s.showVersion=false;s.versionId='';await loadProject(s.project.id);}});
  if(type==='workflow')await mutate(()=>request('/api/client-workflow',{...options(),body:{...values,projectId:s.project.id,messageId:form.dataset.messageId,revision:s.project.revision}}),{form,workflowAction:{messageId:form.dataset.messageId,action:values.action},message:'검토 요청을 저장했어요.',after:async()=>loadProject(s.project.id)});
});

document.addEventListener('change',event=>{const target=event.target;if(target.matches('[data-action=version]')){s.versionId=target.value;render();}if(target.matches('[data-form=review-scene] [name=status]')){const text=target.form.elements.text;text.required=target.value!=='confirmed';}});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.id;
  if(['close-dialog','leave-cancel'].includes(action)){closeDialog();return;}
  if(action==='leave-confirm'){drafts.clear();closeDialog();const next=leaveAction;leaveAction=null;next?.();return;}
  if(action==='confirm-action'){if(!busy)await confirmAction?.();return;}
  if(action==='install'){showInstallGuide();return;}
  if(action==='install-now'){const prompt=s.installPrompt;if(!prompt){showInstallGuide();return;}button.disabled=true;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')notice('설치 요청을 보냈어요. 완료되면 홈 화면의 PULSE를 열어 주세요.');}catch{notice('브라우저 메뉴에서 앱 설치 또는 홈 화면 추가를 선택해 주세요.');}finally{if(s.installPrompt===prompt)s.installPrompt=null;if(dialog.open&&dialog.dataset.installGuide==='true')showInstallGuide();}return;}
  if(action==='install-notifications'){closeDialog();s.live.open=true;renderLive();document.querySelector('#pulse-notifications h2')?.focus();refreshDevice();return;}
  if(action==='retry'||action==='check-login'){await start();return;}
  if(action==='refresh'){await refresh();return;}
  if(action==='reset-production-draft'){if(busy||loading)return;const form=button.closest('form');if(!form||!(/^(round-|preview-)/.test(form.dataset.form)||form.dataset.form==='deliverables'))return;const stamp=projectStamp();drafts.delete(draftKey(form));await refresh();if(current(stamp)&&!s.error)notice('이 양식의 작성 내용을 지우고 최신 내용을 불러왔어요. 새 내용에서 다시 선택·확인해 주세요.');return;}
  if(action==='notifications'){s.live.open=!s.live.open;renderLive();if(s.live.open){document.querySelector('#pulse-notifications h2')?.focus();refreshDevice();}return;}
  if(action==='close-notifications'){s.live.open=false;renderLive();document.querySelector('[data-action=notifications]')?.focus();return;}
  if(action==='device-notifications'){await enableDeviceNotices();return;}
  if(action==='read-notifications'){try{await live?.read('all');}catch(error){notice(error.message);}return;}
  if(action==='open-notification'){const item=s.live.notifications.find(row=>row.id===id);if(!item)return;try{await live?.read([id]);}catch(error){notice(error.message);}const move=async()=>{s.live.open=false;if(item.projectId!==s.project?.id){if(s.mode!=='staff')return;resetContext();loading=true;try{await loadProject(item.projectId);}catch(error){notice(error.message);return;}finally{loading=false;scheduleInviteNavigation();}}s.tab=['strategy','direction','concepts','storyboard','review','history','manage'].includes(item.tab)?item.tab:'history';if(item.versionId)s.versionId=item.versionId;render();const target=item.messageId&&Array.from(main.querySelectorAll('[data-message-id]')).find(node=>node.dataset.messageId===item.messageId&&node.matches('article'));if(target){target.classList.add('notification-target');target.focus({preventScroll:true});target.scrollIntoView({block:'center'});setTimeout(()=>target.classList.remove('notification-target'),5000);}else main.querySelector('.section-intro h2')?.scrollIntoView({block:'start'});};if(item.projectId!==s.project?.id)withLeave(move);else await move();return;}
  if(action==='latest-version'){s.versionId=latestPreview()?.id||'';render();return;}
  if(action==='move-feedback-draft'){const form=main.querySelector('[data-form=feedback]'),entry=form&&drafts.get(draftKey(form));if(entry){entry.versionId=latestPreview()?.id||'';entry.values.seconds='';entry.values.action='feedback';entry.revision++;s.versionId=entry.versionId;render();notice('작성한 글을 최신 시안에 옮겼어요. 내용을 다시 확인하고 필요한 영상 시간을 넣어 주세요.');}return;}
  if(action==='demo-next'&&demo){if(busy||loading)return;if(drafts.size){notice('작성 중인 내용을 먼저 저장한 뒤 다음 단계로 가 주세요.');return;}const guide=demo.guide();if(guide.canAdvance){await mutate(async()=>demo.advance(),{message:'다음 체험 단계를 준비했어요.',after:result=>{s.tab=result.tab||demo.guide().tab;s.versionId='';}});}else{s.tab=guide.tab;render();}main.querySelector('.section-intro h2')?.scrollIntoView({block:'start'});return;}
  if(action==='demo-reset'&&demo){withLeave(()=>{confirmAction=async()=>{const result=demo.reset();resetContext();accept(result);s.tab='direction';render();notice('체험 프로젝트만 처음 상태로 되돌렸어요.');};openDialog('confirm',{title:'이 체험을 처음부터 다시 할까요?',text:'이 브라우저에 저장한 모루 체험의 선택·의견·승인만 지웁니다. 실제 프로젝트와 로그인은 그대로 유지됩니다.',button:'체험 처음부터 시작'});});return;}
  if(action==='logout'){withLeave(async()=>{setBusy(true);try{await request(s.mode==='staff'?'/api/logout':'/pulse/api/logout',{...options(),body:{}});resetContext();s.user=null;s.workspace=null;s.csrf='';render();notice(s.mode==='staff'?'로그아웃했어요.':'프로젝트 연결을 닫았어요.');}catch(error){notice(error.message);}finally{setBusy(false);}});return;}
  if(action==='projects'){withLeave(async()=>{resetContext();try{await loadWorkspace();render();}catch(error){render();notice(error.message);}});return;}
  if(action==='open-project'){withLeave(async()=>{resetContext();loading=true;try{await loadProject(id);render();}catch(error){notice(error.message);}finally{loading=false;scheduleInviteNavigation();}});return;}
  if(action==='new-project'){s.newProject=true;render();main.querySelector('[data-form=new-project] input')?.focus();return;}
  if(action==='cancel-new'){withLeave(()=>{s.newProject=false;render();});return;}
  if(!s.project)return;
  if((action.startsWith('round-')||action.startsWith('deliverable-'))&&(busy||loading))return;
  if(await production.click(button))return;
  if(['request-strategy-review','confirm-strategy','confirm-strategy-save'].includes(action)){
    if(drafts.has([identity(),'strategy',''].join(':'))){notice('작성 중인 제작 설계를 먼저 저장한 뒤 확인해 주세요.');s.tab='strategy';closeDialog();render();return;}
    if(action==='request-strategy-review')await mutate(()=>studioAction('request_strategy_review'),{message:'저장된 제작 설계의 확인을 요청했어요.'});
    if(action==='confirm-strategy')openDialog('strategy-confirm',s.project.studio.strategy);
    if(action==='confirm-strategy-save')await mutate(()=>studioAction('confirm_strategy',{strategyRevision:Number(button.dataset.revision)}),{message:'이 버전의 제작 방향을 확인했어요.',after:closeDialog});
    return;
  }
  if(action==='kickoff-reference'||action==='kickoff-strategy'){if(busy||loading)return;s.tab=action==='kickoff-reference'?'direction':'strategy';render();const form=main.querySelector(action==='kickoff-reference'?'[data-form=reference]':'[data-form=strategy]');if(form){const details=form.closest('details');if(details)details.open=true;const input=form.querySelector('input:not([type=hidden]),textarea,select');const group=input?.closest('details');if(group)group.open=true;form.scrollIntoView({block:'start',behavior:'auto'});input?.focus({preventScroll:true});}return;}
  if(action==='changes-strategy'){if(busy||loading)return;s.tab='strategy';render();const agreement=main.querySelector('.strategy-agreement');if(agreement){agreement.setAttribute('tabindex','-1');agreement.focus({preventScroll:true});agreement.scrollIntoView({block:'center',behavior:'auto'});}return;}
  if(action==='changes-scene'){if(busy||loading||s.mode!=='staff')return;if(!s.project.studio?.scenes?.some(scene=>scene.id===id)){notice('이 장면이 바뀌었어요. 최신 내용을 불러와 주세요.');return;}s.tab='storyboard';render();const card=Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+id);if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}return;}
  if(action==='casting-open'){const section=main.querySelector('.casting-configurator');const group=section?.closest('details');if(group)group.open=true;if(section){section.scrollIntoView({block:'start',behavior:'auto'});section.querySelector('input')?.focus({preventScroll:true});}return;}
  if(action==='tab'){s.tab=button.dataset.tab;s.error='';render();main.querySelector('.section-intro h2')?.scrollIntoView({block:'start',behavior:'auto'});return;}
  if(action==='mood'){const field=button.closest('form').elements.mood;const moods=field.value.split(',').map(v=>v.trim()).filter(Boolean),value=button.dataset.value;field.value=moods.includes(value)?moods.filter(v=>v!==value).join(', '):[...moods,value].join(', ');button.setAttribute('aria-pressed',String(!moods.includes(value)));field.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(action==='image'){openDialog('image',{src:button.dataset.src,label:button.dataset.label});return;}
  if(action==='choose-concept'){const item=s.project.studio.concepts.find(c=>c.id===id);if(item)openDialog('choose',item);return;}
  if(action==='edit-concept'||action==='edit-scene'){s.editor={type:action==='edit-concept'?'concept':'scene',id:id||''};render();document.querySelector(`[data-form=${s.editor.type}]`)?.scrollIntoView({block:'start'});return;}
  if(action==='cancel-editor'||action==='close-editor'){s.editor=null;render();return;}
  if(action==='review-scene'){const item=s.project.studio.scenes.find(c=>c.id===id);if(item)openDialog('scene',item);return;}
  if(action==='confirm-scene'||action==='confirm-scene-request'){await mutate(()=>studioAction('review_scene',sceneConfirmation(s,button.dataset)),{message:'장면 확인을 남겼어요.'});return;}
  if(action==='comment'){const type=button.dataset.target,item=s.project.studio[type==='concept'?'concepts':'scenes'].find(c=>c.id===id);if(item)openDialog('comment',{...item,type});return;}
  if(action==='move-scene'){const ids=s.project.studio.scenes.map(c=>c.id),from=ids.indexOf(id),to=from+Number(button.dataset.direction);if(from>=0&&to>=0&&to<ids.length){[ids[from],ids[to]]=[ids[to],ids[from]];await mutate(()=>studioAction('reorder_scenes',{ids}),{message:'장면 순서를 바꿨어요.'});}return;}
  if(action==='reference-opinion'){const ref=s.project.studio.references.find(r=>r.id===id);if(ref)openDialog('reference',ref);return;}
  if(action==='remove-reference'){confirmAction=()=>mutate(()=>studioAction('remove_reference',{id}),{message:'참고자료를 지웠어요.',after:closeDialog});openDialog('confirm',{title:'이 참고자료를 지울까요?',text:'프로젝트에서 이 참고자료와 설명을 지웁니다.',button:'참고자료 지우기'});return;}
  if(action==='show-version'||action==='hide-version'){s.showVersion=action==='show-version';render();if(s.showVersion)document.querySelector('#version-form')?.scrollIntoView({block:'start'});return;}
  if(action==='compare'){s.compare=!s.compare;render();return;}
  if(action==='use-time'){const video=document.querySelector('#review-video'),field=document.querySelector('[name=seconds]');if(video&&field){video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));notice('지금 장면의 시간을 의견에 넣었어요.');if(button.dataset.focusComment==='true'){const text=document.querySelector('[data-form=feedback] [name=text]');text?.scrollIntoView({block:'center'});text?.focus({preventScroll:true});}}return;}
  if(action==='review-approval'){const card=document.querySelector('.approval-card');card?.scrollIntoView({block:'center'});const heading=card?.querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}return;}
  if(action==='seek'){s.versionId=button.dataset.version||s.versionId;render();const video=document.querySelector('#review-video');if(video){const seek=()=>{video.currentTime=Math.min(Number(button.dataset.seconds)||0,Number.isFinite(video.duration)?video.duration:86400);video.pause();};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});video.scrollIntoView({block:'center'});}return;}
  if(action==='confirm-delivery'){if(busy||loading||s.mode!=='customer'||!s.project.closeout?.canConfirm)return;const c=s.project.closeout;const files=c.files.map(file=>({...file,guide:s.project.versions.find(version=>version.id===file.id)?.guide||''}));drafts.delete([identity(),'confirm-delivery',c.deliveryKey].join(':'));openDialog('delivery-confirm',{deliveryKey:c.deliveryKey,revision:s.project.revision,files});return;}
  if(action==='approve'){const latest=latestPreview();if(s.versionId&&s.versionId!==latest?.id){notice('승인할 최신 시안을 먼저 확인해 주세요.');return;}const roundDrafts=s.project.studio?.feedbackRounds?.drafts||[];if(roundDrafts.some(d=>d.current&&d.items?.length)||hasDraft('round-draft')){notice('수정 초안을 취합해 제출하거나 비운 뒤 승인해 주세요.');return;}const form=document.querySelector('[data-form=feedback]');if(form?.elements.text?.value.trim()){notice('작성 중인 의견을 먼저 보내거나 비운 뒤 승인해 주세요.');return;}if(latest&&latest.id===id)openDialog('approve',{...latest,revision:s.project.revision});return;}
  if(action==='approve-confirm'){if(busy)return;if(id!==latestPreview()?.id){notice('새 시안이 있어요. 최신 시안을 확인한 뒤 승인해 주세요.');closeDialog();return;}await mutate(()=>request('/pulse/api/action',{...options(),body:{action:'approve',versionId:id,revision:Number(button.dataset.revision)}}),{message:'이 시안을 기준으로 최종 제작을 진행하도록 승인했어요.',after:closeDialog});return;}
  if(action==='resolve'){await mutate(()=>request(staffPath('/resolve'),{...options(),body:{revision:s.project.revision,messageId:id}}),{message:'의견을 처리 완료했어요.',after:async()=>loadProject(s.project.id)});return;}
  if(action==='workflow'){await mutate(()=>request('/api/client-workflow',{...options(),body:{projectId:s.project.id,messageId:id,revision:s.project.revision,action:button.dataset.workflow}}),{workflowAction:{messageId:id,action:button.dataset.workflow},message:'검토 상태를 변경했어요.',after:async()=>loadProject(s.project.id)});return;}
  if(action==='invite'){await mutate(()=>request(staffPath('/invite'),{...options(),body:{revision:s.project.revision}}),{message:'고객에게 전달할 초대 링크를 만들었어요.',after:async result=>{s.inviteUrl=location.origin+'/pulse-app/#invite='+encodeURIComponent(result.invite);await loadProject(s.project.id);}});return;}
  if(action==='revoke'){confirmAction=()=>mutate(()=>request(staffPath('/revoke'),{...options(),body:{revision:s.project.revision}}),{message:'고객 접근을 종료했어요.',after:async()=>{s.inviteUrl='';closeDialog();await loadProject(s.project.id);}});openDialog('confirm',{title:'현재 고객 접근을 종료할까요?',text:'전달한 초대 링크와 연결된 고객 화면의 접근이 종료됩니다. 다시 공유하려면 새 초대를 만들어 주세요.',button:'고객 접근 종료'});return;}
  if(action==='copy-invite'){try{await navigator.clipboard.writeText(s.inviteUrl);notice('초대 링크를 복사했어요.');}catch{const field=document.querySelector('[name="invite-url"]');field?.focus();field?.select();notice('복사를 허용하지 않는 환경이에요. 선택된 링크를 직접 복사해 주세요.');}}
});

window.addEventListener('hashchange',queueInviteNavigation);
dialog.addEventListener('close',()=>{if(inviteNavigationPrompt&&!dialog.open)cancelInviteNavigation();scheduleInviteNavigation();});
document.addEventListener('compositionend',scheduleInviteNavigation);
document.addEventListener('pulse-preview-playback',scheduleApply);
document.addEventListener('pause',scheduleApply,true);
document.addEventListener('ended',scheduleApply,true);
window.addEventListener('beforeunload',event=>{if(drafts.size||busy){event.preventDefault();event.returnValue='';}});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();s.installPrompt=event;updateInstallGuide();});
window.addEventListener('appinstalled',()=>{s.installPrompt=null;s.installed=true;notice('PULSE를 설치했어요. 홈 화면에서 열고 기기 알림을 켜 주세요.');updateInstallGuide();});
const connectivity=()=>{document.querySelector('#connection-banner').hidden=navigator.onLine;};
window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);connectivity();
if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start(parseInvite(initialInvite));}initialInvite='';
if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'/pulse-app/'}).catch(()=>{});


