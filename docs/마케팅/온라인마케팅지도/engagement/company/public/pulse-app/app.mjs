import {request as networkRequest,parseInvite,PulseError,clock} from './api.mjs';
import {refreshCasting,takeCastingValues,syncCastingChoices,readCastingCode,applyCastingItem,castingCodeResult} from './casting-view.mjs';
import {snapshotDeliverableRows,restoreDeliverableRows} from './deliverables-view.mjs';
import {productionUI,feedbackDraftChanged,addProductionDraftReset} from './production-ui.mjs';
import {kickoffSubmission} from './kickoff-view.mjs';
import {previewApprovalState} from './production-context.mjs';
import {strategySaveMessage,strategyUnsavedReviewMessage,strategyReviewState,castingCodeSaveMessage} from './strategy-view.mjs';
import {sceneConfirmation} from './scene-requests-view.mjs';
import {header,headerCrumb,welcome,login,picker,projectView,dialogContent,liveView} from './views.mjs';
import {createLiveConnection,projectRevision} from './live.mjs';
import {publicBackend,projectBackend} from './request-backend.mjs';
import {mountRequestFlow} from './request-flow.mjs';
import {mountEntry,mountRoom,mountDraft} from './film-views.mjs';
import {draftModel,deskModel,roomState} from './room-view.mjs';
import {withDeviceDeadline,deviceAvailability,deviceConnectionNote,deviceKey,canMigrateDevice,foregroundProjectOptions,rejectedDeviceRegistration} from './push.mjs';
import {installationEnvironment,installationGuide,devicePermissionTimeout} from './install.mjs';

// Live project contents, credentials and drafts stay in memory. Only the
// explicitly selected demo persists its own fictional project in localStorage.
// The service worker stores the public shell, never project/API responses.
let initialInvite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
// 옛 체험의 주소는 ?demo=gift다. 옛 링크와 설치된 PC 앱(허용 목록이 ?demo=coffee만 받는다)을 위해 옛 주소도 같은 체험으로 잇는다.
const demoMode=!initialInvite&&['gift','coffee'].includes(new URLSearchParams(location.search).get('demo'));
const demo=demoMode?(await import('./demo.mjs')).createDemoSession():null;
const request=(path,settings={})=>demo?demo.request(path,settings):networkRequest(path,foregroundProjectOptions(path,settings,document.visibilityState==='visible'));
const openNotificationsOnStart=new URLSearchParams(location.search).get('notifications')==='1';
const staffMode=!demoMode&&new URLSearchParams(location.search).get('mode')==='staff';
// 새 예시(?demo=film)와 바로 의뢰(?start=request · synk.im에서 넘어오는 길). 둘 다 render() 밖 전용 칸에서 돈다.
const filmDemo=!initialInvite&&!demoMode&&!staffMode&&new URLSearchParams(location.search).get('demo')==='film';
const startRequest=!initialInvite&&!demoMode&&!staffMode&&new URLSearchParams(location.search).get('start')==='request';
let initialStaffProject=staffMode?new URLSearchParams(location.search).get('project')||'':'';
const initialStaffTab=staffMode?new URLSearchParams(location.search).get('tab')||'strategy':'strategy';
let initialStaffScene=staffMode?new URLSearchParams(location.search).get('scene')||'':'';
let initialStaffHistory=staffMode?readStaffHistoryTarget(location.search):null;
let pendingInitialScene='';
history.replaceState({},'',location.pathname+(demoMode?(/\bElectron\//.test(navigator.userAgent||'')?'?demo=coffee':'?demo=gift'):staffMode?'?mode=staff':filmDemo?'?demo=film':''));
const s={demo:demoMode,demoGuide:null,demoPersistent:true,mode:staffMode?'staff':'customer',user:null,workspace:null,project:null,canEdit:false,csrf:'',tab:'strategy',editor:null,versionId:'',compare:false,showVersion:false,inviteUrl:'',newProject:false,installPrompt:null,error:'',conflict:false,workflow:[],castingCode:null,castingCodeOpen:null};
// PC 앱은 PULSE를 자기 창(Electron)으로 연다. 그 창에서는 설치 안내 단추와 기기 알림 켜기를 두지 않고(views.mjs header·liveView), 기억하기·체험 글은 「이 브라우저」 대신 「이 PC 앱」이라 쓴다.
// 표시는 install.mjs installationEnvironment와 같다. 맨 위에서는 가져온 함수를 부르지 않는다 — 운영 후보의 vm 시험(git 밖 파일 포함)이 import 없이 이 줄까지 돌린다.
s.desktopApp=/\bElectron\//.test(navigator.userAgent||'');
const main=document.querySelector('#main'),dialog=document.querySelector('#app-dialog');
const wiredMedia=new WeakSet();
const drafts=new Map();let epoch=0,busy=false,loading=false,noticeTimer,leaveAction,confirmAction;
let pendingInvite='',inviteNavigationPrompt=false,inviteNavigationScheduled=false;
// 고객 화면은 프로젝트를 확인하는 동안 「초대 링크 붙여 넣기」 첫 화면 대신 확인 중 표시를 둔다(10-19 검수: 링크를 눌렀는데 붙여 넣기 화면이 먼저 보였다).
let booting=!demo&&!filmDemo;
// 연결이 끝나 프로젝트를 닫을 때 쓰던 글을 이 창의 메모리에만 잠시 보관했다가, 같은 프로젝트로 다시 연결되면 되살린다(저장소에는 쓰지 않는다).
let keptDrafts=null;
// 담당자가 「캐스팅북 코드로 채우기」에서 저장을 누른 조합. 저장 알림을 그 조합으로 말하고, 저장 뒤에도 그 글을 칸에 남겨 「지금 저장된 조합」을 그 자리에서 보인다.
let castingCodeSave=null;
const LOADING_VIEW='<div class="loading" role="status"><span class="loading-mark"></span>프로젝트를 확인하고 있어요.</div>';
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

function notice(message){if(demo&&/의견을 보냈|고객에게|시안을 승인했/.test(message))message='체험 기록에 남겼어요.';const box=document.querySelector('#notice');box.textContent=message;box.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>box.hidden=true,6500);}
function remember(event){const field=event.target,form=field.closest?.('form[data-form]');if(!form||!field.name||['invite','login'].includes(form.dataset.form))return;const key=draftKey(form),entry=drafts.get(key)||{values:{},revision:0};if(form.dataset.form==='feedback'&&!entry.versionId){entry.versionId=s.versionId||latestPreview()?.id||'';if(entry.versionId)s.versionId=entry.versionId;if(form.elements.action)entry.values.action=form.elements.action.value;}entry.values[field.name]=field.type==='file'?Array.from(field.files||[]):field.type==='checkbox'?Array.from(form.elements).filter(el=>el.name===field.name&&el.checked).map(el=>el.value):field.value;if(form.dataset.form==='deliverables'){entry.deliverableRows=snapshotDeliverableRows(form);entry.values.deliverableRevision??=form.elements.deliverableRevision.value;}if(/^(round-|preview-)/.test(form.dataset.form))entry.boundData??={...form.dataset};entry.revision++;drafts.set(key,entry);if(form.dataset.form==='feedback'&&s.mode!=='staff'){const submit=form.querySelector('button[type=submit]');if(submit&&!busy)submit.disabled=!!(entry.versionId&&entry.versionId!==latestPreview()?.id&&entry.values.action!=='support');}}
function restore(scope=document){for(const form of scope.querySelectorAll('form[data-form]')){const entry=drafts.get(draftKey(form));if(!entry)continue;if(entry.boundData){Object.assign(form.dataset,entry.boundData);addProductionDraftReset(form);}if(form.dataset.form==='deliverables'&&entry.deliverableRows){restoreDeliverableRows(form,entry.deliverableRows);addProductionDraftReset(form);}for(const [name,value] of Object.entries(entry.values)){const fields=Array.from(form.elements).filter(el=>el.name===name);for(const field of fields){if(field.type==='file'){try{const transfer=new DataTransfer();for(const file of value)transfer.items.add(file);field.files=transfer.files;}catch{}}else if(field.type==='checkbox')field.checked=Array.isArray(value)&&value.includes(field.value);else if(field.type==='radio')field.checked=field.value===value;else field.value=value;const details=field.closest('details');if(details)details.open=true;}}const details=form.closest('details');if(details)details.open=true;}}
function clearDraft(key,revision){if(drafts.get(key)?.revision===revision)drafts.delete(key);}
function setBusy(value){busy=value;document.documentElement.classList.toggle('is-busy',value);for(const button of document.querySelectorAll('button[type=submit],[data-mutate]')){if(value){if(button.dataset.wasDisabled===undefined)button.dataset.wasDisabled=String(button.disabled);button.disabled=true;}else if(button.dataset.wasDisabled!==undefined){button.disabled=button.dataset.wasDisabled==='true';delete button.dataset.wasDisabled;}}main.setAttribute('aria-busy',String(value));if(!value){scheduleApply();scheduleInviteNavigation();}}
// 첫 화면이 길어 입장 칸이 화면 밖일 수 있다 — 어느 길로 왔든 새 알림이 나면 그 자리를 보인다. 같은 알림으로 다시 그릴 때는 읽던 자리를 두고 움직이지 않는다.
let shownEntryError=null;
function render({remote=false}={}){loadDesk();s.feedbackDraftVersion=drafts.get([identity(),'feedback',''].join(':'))?.versionId||'';s.feedbackDraftAction=drafts.get([identity(),'feedback',''].join(':'))?.values.action||'';if(demo){s.demoGuide=demo.guide();s.demoPersistent=demo.snapshot().demo.persistent;}const files=remote?Array.from(main.querySelectorAll('input[type=file]')).filter(node=>node.files?.length).map(node=>({node,key:draftKey(node.form),name:node.name})):[];const previousFocus=remote&&main.contains(document.activeElement)?document.activeElement:null,focusKey=previousFocus?{action:previousFocus.dataset.action,id:previousFocus.dataset.id,tab:previousFocus.dataset.tab,href:previousFocus.getAttribute('href'),room:previousFocus.dataset.roomGo||previousFocus.dataset.roomDo||previousFocus.dataset.draftDo||''}:null;const media=remote?Array.from(main.querySelectorAll('video,audio')).map(node=>({node,playing:!node.paused,time:node.currentTime})):[],details=remote?Array.from(main.querySelectorAll('details')).map((node,index)=>node.open?index:-1):[],scroll=remote?{x:scrollX,y:scrollY}:null;document.querySelector('#header-actions').innerHTML=header(s);const crumb=document.querySelector('#header-crumb');if(crumb)crumb.innerHTML=headerCrumb(s);main.innerHTML=s.project?projectView(s):booting?LOADING_VIEW:s.mode==='staff'?(s.user?picker(s):login()):welcome(s);if(s.project||!s.entryError)shownEntryError=null;else if(s.entryError!==shownEntryError){shownEntryError=s.entryError;main.querySelector('.entry-alert')?.scrollIntoView?.({block:'nearest'});}restore(main);mountScreens();placeTimeline();wireCompare();const strategyForm=main.querySelector('[data-form=strategy]');if(strategyForm)syncCastingChoices(strategyForm,drafts.get(draftKey(strategyForm))?.values);refreshCasting(strategyForm);if(remote){for(const old of files){const form=Array.from(main.querySelectorAll('form[data-form]')).find(node=>draftKey(node)===old.key);const input=form&&Array.from(form.elements).find(node=>node.type==='file'&&node.name===old.name);if(input)input.replaceWith(old.node);}for(const fresh of main.querySelectorAll('video,audio')){const index=media.findIndex(old=>old.node.dataset.version===fresh.dataset.version&&old.node.getAttribute('src')===fresh.getAttribute('src')&&old.node.id===fresh.id);if(index!==-1){const old=media.splice(index,1)[0];fresh.replaceWith(old.node);if(old.playing&&old.node.paused)old.node.play().catch(()=>{});}}for(const [index,node] of Array.from(main.querySelectorAll('details')).entries())if(details.includes(index))node.open=true;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});else if(focusKey){const replacement=Array.from(main.querySelectorAll('button,a')).find(node=>node.offsetParent!==null&&(focusKey.room?[node.dataset.roomGo,node.dataset.roomDo,node.dataset.draftDo].includes(focusKey.room):focusKey.action?node.dataset.action===focusKey.action&&node.dataset.id===focusKey.id&&node.dataset.tab===focusKey.tab:focusKey.href&&node.getAttribute('href')===focusKey.href));replacement?.focus({preventScroll:true});}if(scroll)window.scrollTo(scroll.x,scroll.y);}const inviteField=document.querySelector('[name="invite-url"]');if(inviteField)inviteField.readOnly=true;wireMedia();production.render();if(busy)setBusy(true);syncLive();renderLive();focusInitialStaffScene();focusInitialStaffHistory();}
// 슬레이트 판 화면(첫 화면 · 고객 방 · 1차안): 움직임과 듣개는 새로 그린 칸에 붙인다. 같은 화면을 다시 그릴 때는 다시 움직이지 않는다.
let screenKey='',draftHandle=null,resumeChecked=false;
function mountScreens(){
  draftHandle?.unmount();draftHandle=null;
  const entry=main.querySelector('.entry'),draft=main.querySelector('.draft'),room=main.querySelector('.room,.project-shell.is-room');
  const classes=document.documentElement.classList;classes.toggle('view-entry',!!entry);classes.toggle('view-draft',!!draft);
  const model=draft?draftModel(s.project):null,key=entry?'entry':model?`draft:${model.round}`:room?`room:${s.tab}:${roomState(s.project)}`:'',animate=key!==screenKey;screenKey=key;
  // PC 앱 창은 예시 주소로 옮겨 가지 못한다(desktop/src/pulse-app.cjs 허용 목록) — 그 창에서는 제자리에서 연다.
  if(entry){mountEntry(main,{animate,onStart:openPublicRequest,onDemo:s.desktopApp?openFilmDemo:null});checkResume();}
  if(model)mountDraftScreen(model,animate);
  if(room)mountRoom(main,{animate,onGo:goRoom,onEdit:()=>openProjectRequest('review'),onContact:()=>goRoom('contact'),onModel:answerModel,onFiles:sendMoreFiles});
}
// 쓰던 의뢰서가 있으면 첫 화면 단추가 「이어 쓰기」로 바뀐다. 한 번만 물어본다.
async function checkResume(){if(resumeChecked||s.mode!=='customer'||demo||filmDemo)return;resumeChecked=true;try{const {draft}=await networkRequest('/pulse/api/request'),resume=!!(draft?.status==='draft'&&(draft.step||draft.answers?.name||draft.files?.length));if(resume!==!!s.requestResume){s.requestResume=resume;if(!s.project&&canApplyRemote())render();}}catch{}}
function goRoom(stage){
  if(stage==='write'){openProjectRequest();return;}
  if(stage==='contact'){s.tab='review';s.error='';render();const target=main.querySelector('.review-form');target?.scrollIntoView({block:'start',behavior:'auto'});target?.querySelector('textarea')?.focus({preventScroll:true});return;}
  s.tab=['draft','review','history','films'].includes(stage)?stage:'overview';s.error='';render();
  if(stage==='request')main.querySelector('[data-room-brief]')?.scrollIntoView({block:'start',behavior:'auto'});else if(typeof window.scrollTo==='function')window.scrollTo(0,0);
}
function mountDraftScreen(model,animate){
  const key=[identity(),'draft-review',model.round].join(':'),kept=drafts.get(key);
  draftHandle=mountDraft(main,model,{animate,state:kept?.state,at:kept?.at||0,
    onChange:(state,at)=>{if(state.some(item=>item.react||item.note.trim()))drafts.set(key,{values:{},revision:(drafts.get(key)?.revision||0)+1,state,at});else drafts.delete(key);},
    onBack:()=>goRoom('overview'),
    onRecast:()=>openDialog('recast'),
    onSend:state=>{const items=model.cuts.map((cut,i)=>({cut,item:state[i]})).filter(({item})=>item.react).map(({cut,item})=>({sceneId:cut.id,status:item.react==='fix'?'changes':'confirmed',text:item.react==='fix'?item.note.trim():''}));return mutate(()=>studioAction('submit_draft_review',{round:model.round,items}),{message:'의견을 보냈어요. 반영한 판을 다시 보내 드릴게요.',after:()=>{drafts.delete(key);s.tab='overview';}});},
    onApprove:state=>{
      const send=()=>mutate(()=>studioAction('approve_draft',{round:model.round}),{message:model.kind==='script'?'글 콘티를 확인했어요. 장면 이미지를 만들어 보내 드릴게요.':'장면 이미지를 확인했어요. 이 컷으로 제작을 시작해요.',after:()=>{drafts.delete(key);closeDialog();s.tab='overview';}});
      if(model.kind==='script')return send();
      const rest=(state||[]).filter(item=>!item.react).length;
      confirmAction=send;openDialog('confirm',{title:'이대로 제작을 시작할까요?',text:`${rest?`아직 확인하지 않은 컷 ${rest}개도 이대로 만들어요. `:''}이 장면 이미지로 소리와 영상을 만들어요. 장면 이미지는 영상의 첫 장면이라, 움직이는 동안 작은 부분은 달라질 수 있어요.`,button:'제작 시작'});
    }});
}
const requestFileUpload=(file,slot)=>request('/pulse/api/studio/request-file',{...options(),file,headers:{'Content-Type':file.type||'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-Request-Slot':slot}});
function answerModel(values){return mutate(()=>studioAction('answer_model',values),{message:values.accept||values.modelId?'모델을 정했어요. 글 콘티를 준비해 보내 드릴게요.':'담당자에게 전했어요. 다시 제안해 드릴게요.'});}
function sendMoreFiles(list){return mutate(async()=>{let last=null;for(const file of list){last=await requestFileUpload(file,'etc');accept(last);}return last||{};},{message:list.length>1?`자료 ${list.length}개를 보냈어요.`:'자료를 보냈어요.'});}
// 의뢰서는 render()가 건드리지 않는 전용 칸에서 돈다. 쓰는 동안 실시간 갱신이 화면을 다시 그리지 않게 하고, 뒤의 화면은 잠근다.
let flow=null,flowOpening=false;
function overlayState(open){const overlay=document.querySelector('#request-root');overlay.hidden=!open;if(!open)overlay.innerHTML='';for(const node of document.querySelectorAll('.app-header,#main,.skip-link'))node.inert=open;return overlay;}
function closeFlow(){if(!flow)return;flow.unmount();flow=null;overlayState(false);resumeChecked=false;main.focus?.({preventScroll:true});}
async function openFlow(load,after){
  if(flow||flowOpening)return;flowOpening=true;
  try{
    const backend=await load();
    // 보내고 응답을 받지 못한 채 다시 왔을 때: 같은 의뢰로 바로 잇는다.
    if(backend.alreadySent){await backend.submit({});await after();return;}
    flow=mountRequestFlow(overlayState(true),{backend,onRoom:()=>{closeFlow();after();},onExit:()=>{closeFlow();render();}});
  }catch(error){notice(error.message);}finally{flowOpening=false;}
}
function openPublicRequest(){return openFlow(publicBackend,async()=>{resetContext();s.user=null;s.workspace=null;s.csrf='';booting=true;render();await start('');});}
function openProjectRequest(step=''){return openFlow(async()=>projectBackend({project:()=>s.project,csrf:()=>s.csrf,accept,step}),async()=>{s.tab='overview';s.error='';render();if(typeof window.scrollTo==='function')window.scrollTo(0,0);});}
async function openFilmDemo(){try{const {mountFilmDemo}=await import('./demo-film.mjs');document.documentElement.classList.add('has-demo-nav');const overlay=overlayState(true);overlay.innerHTML='<div></div>';mountFilmDemo(overlay.firstElementChild,{onLeave:()=>location.assign('./')});}catch(error){notice(error.message);}}
// 내부 확인 화면은 직원이 그 탭을 열 때만 불러온다(손님 묶음에 넣지 않는다).
let deskLoading=null;
function loadDesk(){if(s.mode!=='staff'||s.tab!=='desk'||s.deskView||deskLoading)return;deskLoading=import('./desk-view.mjs').then(module=>{s.deskView=module.deskView;deskLoading=null;render();}).catch(()=>{deskLoading=null;notice('내부 확인 화면을 불러오지 못했어요. 새로 고쳐 주세요.');});}
// 05 영상 확인: 의견 점을 영상 길이에 맞춰 타임라인에 놓고, 재생 위치 선이 따라간다(위치는 CSSOM으로만 — 페이지 CSP가 style 속성을 막는다).
function placeTimeline(){const video=main.querySelector('#review-video'),track=main.querySelector('[data-timeline] .timeline-track');if(!video||!track)return;const head=track.querySelector('.timeline-head'),pct=t=>Math.min(100,Math.max(0,t/video.duration*100))+'%';
  // 시간 글자가 40px 안으로 붙으면 앞 점의 글자만 보인다(10-19 검수: 「0:020:03」).
  const declutter=()=>{const width=track.getBoundingClientRect().width;if(!width||!Number.isFinite(video.duration)||video.duration<=0)return;let last=-Infinity;for(const mark of Array.from(track.querySelectorAll('.timeline-mark')).sort((a,b)=>Number(a.dataset.seconds)-Number(b.dataset.seconds))){const x=(Number(mark.dataset.seconds)||0)/video.duration*width;const crowded=x-last<40;mark.classList.toggle('is-crowded',crowded);if(!crowded)last=x;}};
  const place=()=>{if(!Number.isFinite(video.duration)||video.duration<=0)return;for(const mark of track.querySelectorAll('.timeline-mark'))mark.style.left=pct(Number(mark.dataset.seconds)||0);if(head)head.style.left=pct(video.currentTime);track.classList.add('is-ready');declutter();};
  if(video.readyState>=1)place();else video.addEventListener('loadedmetadata',place,{once:true});video.addEventListener('timeupdate',()=>{if(head&&track.classList.contains('is-ready'))head.style.left=pct(video.currentTime);});
  if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(declutter);observer.observe(track);}}
// 이전 시안과 비교: 두 영상을 함께 재생·멈춤·이동한다(소리는 왼쪽 영상만).
const compareWiring=new WeakMap();
function wireCompare(){const videos=Array.from(main.querySelectorAll('.compare-grid video'));if(videos.length!==2)return;const [a,b]=videos;if(compareWiring.get(a)?.partner===b)return;for(const node of [a,b])compareWiring.get(node)?.controller.abort();const controller=new AbortController();compareWiring.set(a,{partner:b,controller});compareWiring.set(b,{partner:a,controller});b.muted=true;let lock=false;const follow=(source,target)=>{for(const type of ['play','pause','seeked'])source.addEventListener(type,()=>{if(lock)return;lock=true;try{if(type==='play'){if(Math.abs(target.currentTime-source.currentTime)>0.2)target.currentTime=source.currentTime;target.play().catch(()=>{});}else if(type==='pause')target.pause();else if(Math.abs(target.currentTime-source.currentTime)>0.2)target.currentTime=source.currentTime;}finally{setTimeout(()=>{lock=false;},0);}},{signal:controller.signal});};follow(a,b);follow(b,a);}
// 의견 초안을 쓰기 시작하면 보던 장면에서 멈추고 그 시간을 넣는다(Frame.io 방식). 이미 적힌 시간은 건드리지 않는다.
document.addEventListener('focusin',event=>{const area=event.target;if(!area?.matches?.('form[data-form="round-draft"] textarea[name="text"]'))return;const field=area.form?.elements?.seconds,video=document.querySelector('#review-video');if(!field||!video||field.value!==''||!(video.currentTime>0))return;video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));},true);
// 장면·콘셉트·참고 그림과 현황판의 지금 할 일 그림·시안은 자르지 않고 다 보인다(11-02) — 세로면 칸에 .is-portrait를 단다.
// 실시간 갱신은 옛 영상 노드를 새로 그린 칸에 다시 끼우므로, 잴 때마다 지금 칸을 찾고 이미 단 노드도 다시 잰다.
const FIT_BOXES='.scene-image,.concept-image,.reference-media,.focus-media',measuring=new WeakSet();
function fitBox(media){if(!media.closest(FIT_BOXES))return;const video=media.tagName==='VIDEO',fit=()=>media.closest(FIT_BOXES)?.classList.toggle('is-portrait',video?media.videoHeight>media.videoWidth*1.05:media.naturalHeight>media.naturalWidth*1.05);if(video?media.readyState>=1:media.complete&&media.naturalWidth)fit();else if(!measuring.has(media)){measuring.add(media);media.addEventListener(video?'loadedmetadata':'load',()=>{measuring.delete(media);fit();},{once:true});}}
function wireMedia(){for(const media of main.querySelectorAll('video,img')){fitBox(media);if(wiredMedia.has(media))continue;wiredMedia.add(media);media.addEventListener('error',()=>{if(media.id==='review-video'){const error=document.querySelector('#video-error');if(error)error.hidden=false;}else if(media.tagName==='IMG'&&!media.closest('.welcome-art')){media.hidden=true;const parent=media.closest('[data-action=image]');if(parent){parent.disabled=true;parent.textContent='이미지를 불러오지 못했어요';parent.classList.add('empty-visual');}}},{once:true});}}
function openDialog(type,item={}){if(dialog.open)dialog.close();dialog.dataset.installGuide=String(type==='install');dialog.className=type==='image'?'app-dialog image-dialog':'app-dialog';dialog.innerHTML=(demo?'<p class="demo-dialog-note">체험이라 실제 의뢰나 승인으로 이어지지 않아요.</p>':'')+dialogContent(type,item);restore(dialog);dialog.showModal();}
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
  if(busy||loading||dialog.open||composing)notice('새 초대 링크를 받았어요. 하던 일을 마치면 연결할게요.');
  scheduleInviteNavigation();
}
function scheduleInviteNavigation(){
  if(!pendingInvite||inviteNavigationScheduled)return;inviteNavigationScheduled=true;
  queueMicrotask(()=>{inviteNavigationScheduled=false;if(!pendingInvite||inviteNavigationPrompt||busy||loading||dialog.open||composing)return;
    inviteNavigationPrompt=!!drafts.size;
    withLeave(()=>{inviteNavigationPrompt=false;const invite=pendingInvite;pendingInvite='';if(!invite)return;
      if(demo||s.mode!=='customer'){location.assign(location.pathname+'#invite='+encodeURIComponent(invite));return;}
      resetContext();s.user=null;s.workspace=null;s.csrf='';booting=true;render();void start(invite);
    });
  });
}
function withLeave(action){if(busy||loading){notice('처리 중이에요. 끝난 뒤 이동해 주세요.');return;}if(drafts.size){leaveAction=action;openDialog('leave');}else action();}
function resetContext({preserveInvite=false}={}){loading=false;production.reset();pendingInitialScene='';if(!preserveInvite)cancelInviteNavigation();live?.stop();live=null;liveIdentity='';liveSnapshot=null;deviceState=null;deviceOperation++;deviceRefresh++;deviceBusy=false;s.live.deviceBusy=false;setBusy(false);epoch++;drafts.clear();pendingRemote=null;closeDialog();Object.assign(s,{project:null,canEdit:false,editor:null,versionId:'',compare:false,showVersion:false,inviteUrl:'',error:'',conflict:false,workflow:[],historyTarget:null,notificationCommentId:null,tab:'strategy',castingCode:null,castingCodeOpen:null});castingCodeSave=null;}
function accept(result){if(!result.project&&result.id&&Number.isFinite(result.revision))result={...result,project:result};if(result.project&&!result.project.studio&&result.project.id===s.project?.id)result.project.studio=s.project.studio;if(result.csrf)s.csrf=result.csrf;if(result.csrfToken)s.csrf=result.csrfToken;if(result.project){if(!s.project&&s.mode==='customer'&&!demo)s.tab='overview';else if(!s.project&&s.mode==='staff'&&result.project.studio?.request&&['received','planning'].includes(result.project.stage))s.tab='desk';else if(!s.project&&!result.project.studio?.strategy?.revision){const versions=result.project.versions||[];if(versions.some(v=>v.kind==='final')&&result.project.stage==='delivered')s.tab='history';else if(versions.some(v=>v.kind==='preview'))s.tab='review';}s.project=result.project;if(!s.project.studio)s.project.studio={preferences:{},assets:[],references:[],concepts:[],scenes:[],sceneReviews:[],comments:[]};if(result.canEdit!==undefined)s.canEdit=!!result.canEdit;}}
function renderLive(){const box=document.querySelector('#pulse-live');if(!box)return;box.hidden=!!demo||!(s.project||s.user);if(box.hidden)return;const active=box.contains(document.activeElement)?document.activeElement.dataset?.id:null;box.innerHTML=liveView(s);if(active)Array.from(box.querySelectorAll('[data-action=open-notification]')).find(node=>node.dataset.id===active)?.focus({preventScroll:true});const badge=document.querySelector('[data-action=notifications]');if(badge){badge.textContent=`알림${s.live.unreadCount?' '+s.live.unreadCount:''}`;badge.setAttribute('aria-expanded',String(s.live.open));}}
function syncLive(){if(demo)return;const key=s.mode==='staff'?(s.user?`staff:${s.user.id}`:''):(s.project?`customer:${s.project.id}`:'');if(key===liveIdentity)return;live?.stop();live=null;liveIdentity=key;liveSnapshot=null;pendingRemote=null;deviceState=null;s.live={...s.live,deviceEnabled:false,deviceReady:false,deviceNote:'기기 알림 상태를 확인하고 있어요.',deviceIssue:'',deviceProgress:'',deviceUncertain:false,notifications:[],unreadCount:0,open:openNotificationsOnStart,pending:false,status:'connecting'};if(!key)return;refreshDevice();live=createLiveConnection({mode:s.mode,request,options,onSnapshot:snapshot=>{if(key!==liveIdentity)return;if((s.mode==='staff'&&snapshot.userId&&snapshot.userId!==s.user?.id)||(s.mode==='customer'&&snapshot.projectId&&snapshot.projectId!==s.project?.id)){connectionExpired();return;}liveSnapshot=snapshot;s.live.notifications=snapshot.notifications||[];s.live.unreadCount=snapshot.unreadCount||0;renderLive();fetchRemote();},onFresh:items=>{if(key!==liveIdentity)return;notice(items.length===1?items[0].title:`새 알림 ${items.length}개가 도착했어요.`);},onStatus:status=>{s.live.status=status;renderLive();},onExpired:connectionExpired});}
const devicePath=()=>s.mode==='staff'?'/api/pulse-device-notifications':'/pulse/api/device-notifications';
const deviceScope=()=>'/pulse-app/push-'+s.mode+'/';
function pushSupport(){return deviceAvailability({...installEnvironment(),serviceWorker:'serviceWorker' in navigator,pushManager:'PushManager' in window,notification:'Notification' in window,permission:globalThis.Notification?.permission});}
async function deviceRequest(path,settings={}){const controller=new AbortController();return withDeviceDeadline(request(path,{...settings,signal:controller.signal}),{onTimeout:()=>controller.abort()});}
async function localPush(){return withDeviceDeadline((async()=>{const registration=await navigator.serviceWorker.getRegistration(deviceScope());if(!registration||new URL(registration.scope).pathname!==deviceScope())return {registration:null,subscription:null,hash:''};const subscription=await registration.pushManager.getSubscription();const digest=subscription?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subscription.endpoint)):null;return {registration,subscription,hash:digest?Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join(''):''};})());}
// 「이 기기 기억하기」: 서버가 알려 준 기억 상태를 보이고, 아직 아니면 현황판에 한 번 제안한다(닫으면 이 프로젝트에서는 다시 안 묻는다).
const rememberDismissKey=()=>'synk-pulse-remember-dismissed:'+(s.project?.id||'');
function rememberDismissed(){try{return localStorage.getItem(rememberDismissKey())==='1';}catch{return false;}}
function applyRemember(server){if(s.mode!=='customer'||demo)return;const before=s.rememberOffer;s.live.rememberKnown=true;s.live.remembered=!!server?.deviceConnection?.remembered;s.rememberOffer=!s.live.remembered&&!rememberDismissed();if(before!==s.rememberOffer&&s.tab==='overview'&&canApplyRemote())render({remote:true});}
async function refreshDevice(){
  const key=liveIdentity,requestEpoch=epoch,refreshId=++deviceRefresh,csrf=s.csrf,mode=s.mode,path=devicePath();
  if(!key||demo||deviceBusy)return;
  const valid=()=>key===liveIdentity&&requestEpoch===epoch&&refreshId===deviceRefresh&&csrf===s.csrf;
  const unsupported=pushSupport();
  if(unsupported){s.live.deviceEnabled=false;s.live.deviceNote=unsupported;s.live.deviceReady=false;if(mode==='customer'){try{const server=await deviceRequest(path);if(valid())applyRemember(server);}catch{}}renderLive();return;}
  try{
    let [server,local]=await Promise.all([deviceRequest(path),localPush()]);if(!valid())return;
    const existing=server.subscriptions?.find(item=>item.endpointHash===local.hash),migrationKey=key+':'+local.hash;
    // Carry forward only this recipient's previously explicit device opt-in.
    // Browser permission or a subscription belonging to someone else is not consent.
    if(canMigrateDevice({mode,server,local,permission:Notification.permission})&&!deviceMigrations.has(migrationKey)){
      deviceMigrations.add(migrationKey);
      try{await deviceRequest(path,{csrf,body:{subscription:local.subscription.toJSON(),label:existing.label||'PULSE · 고객 · 내 브라우저'}});if(!valid())return;server=await deviceRequest(path);if(!valid())return;}
      catch(error){deviceMigrations.delete(migrationKey);if(!valid())return;s.live.deviceIssue='기억한 기기 연결을 새로 하지 못했어요. 알림함을 다시 열면 다시 해 볼게요.';}
    }
    deviceState={server,local};applyRemember(server);
    const row=server.subscriptions?.find(item=>item.endpointHash===local.hash);
    s.live.deviceEnabled=!!(server.configured&&row?.enabled&&row.currentSession&&Notification.permission==='granted');
    if(s.live.deviceUncertain&&s.live.deviceEnabled&&(mode==='staff'||server.deviceConnection?.remembered)){s.live.deviceUncertain=false;s.live.deviceIssue='';notice('이 기기의 PULSE 알림 연결을 확인했어요.');}
    s.live.deviceReady=!!server.configured;
    s.live.deviceNote=deviceConnectionNote({mode:s.mode,enabled:s.live.deviceEnabled,configured:server.configured,connection:server.deviceConnection});
    if(s.mode==='customer'&&s.live.deviceEnabled&&server.deviceConnection?.remembered&&server.deviceConnection.expiresAt)s.live.deviceNote+=' 지금 연결은 '+new Date(server.deviceConnection.expiresAt).toLocaleString('ko-KR')+'까지예요.';
    renderLive();
  }catch(error){if(valid()){s.live.deviceReady=false;s.live.deviceNote=error.message;renderLive();}}
}
async function activePushRegistration(registration){if(registration.active)return registration;const worker=registration.installing||registration.waiting;if(!worker)throw new PulseError('기기 알림을 준비하지 못했어요. 다시 시도해 주세요.');await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.removeEventListener('statechange',check);reject(new PulseError('기기 알림 준비가 늦어지고 있어요. 다시 시도해 주세요.'));},12000);function check(){if(worker.state==='activated'||worker.state==='redundant'){clearTimeout(timer);worker.removeEventListener('statechange',check);worker.state==='activated'?resolve():reject(new PulseError('기기 알림을 준비하지 못했어요.'));}}worker.addEventListener('statechange',check);check();});return registration;}
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
      notice('이 기기의 PULSE 알림을 껐어요. 앱 안 알림함은 그대로 쓸 수 있어요.');
    }else{
      const granted=await withDeviceDeadline(permission,{message:devicePermissionTimeout(installEnvironment())});
      if(!valid())return;
      if(granted!=='granted'){s.live.deviceIssue='알림이 허용되지 않았어요. 브라우저 알림 설정에서 허용한 뒤 다시 켜 주세요.';notice(s.live.deviceIssue);return;}
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
function canApplyRemote(){const active=document.activeElement;return !busy&&!loading&&!composing&&!dialog.open&&!document.hidden&&!active?.matches('input,textarea,select,[contenteditable=true]')&&!document.fullscreenElement&&!document.pictureInPictureElement&&!document.querySelector('[data-animatic-player][data-preview-playing="true"]')&&!document.querySelector('.draft[data-playing="true"]')&&!Array.from(document.querySelectorAll('[data-preview-test],[data-film-player]')).some(video=>!video.paused&&!video.ended);}
function scheduleApply(){clearTimeout(applyTimer);applyTimer=setTimeout(()=>{if(canApplyRemote()){if(pendingRemote)applyRemote();else fetchRemote();}},180);}
function applyRemote(){if(!pendingRemote||!canApplyRemote())return;const pending=pendingRemote;pendingRemote=null;s.live.pending=false;if(!current(pending.stamp))return;if(pending.result?.project){if(Number(pending.result.project.revision)<Number(s.project?.revision)){renderLive();return;}const showing=main.querySelector('#review-video')?.dataset.version||s.versionId;if(showing)s.versionId=showing;accept(pending.result);if(pending.workflow)s.workflow=pending.workflow;}if(pending.workspace)s.workspace=pending.workspace;s.live.pending=false;s.error='';s.conflict=false;s.reloadFailed=false;render({remote:true});}
async function fetchRemote(){if(!liveSnapshot||demo)return;if(busy||loading||autoFetching){autoAgain=true;return;}const stamp=projectStamp(),target=s.project?projectRevision(liveSnapshot,s.project.id,s.mode):null;if(s.project&&(target===undefined||Number(target)<=Number(s.project.revision))){if(target===undefined&&s.mode==='staff')connectionExpired();return;}const workspaceSignature=s.mode==='staff'&&!s.project?JSON.stringify(liveSnapshot.projects||[]):null;if(workspaceSignature!==null&&s.live.workspaceSignature===workspaceSignature)return;autoFetching=true;autoAgain=false;try{if(s.project){const result=await request(s.mode==='staff'?staffPath('/studio'):'/pulse/api/project');if(!current(stamp))return;if(result.project?.id!==s.project.id){connectionExpired();return;}if(Number(result.project?.revision)<Number(s.project.revision))return;let workflow=null;if(s.mode==='staff'){const response=await request('/api/client-workflow');if(!current(stamp))return;workflow=response.items||[];}pendingRemote={stamp,result,workflow};}else if(s.mode==='staff'&&s.user){const workspace=await request('/api/client-projects');if(!current(stamp))return;pendingRemote={stamp,workspace};s.live.workspaceSignature=workspaceSignature;}s.live.pending=!!pendingRemote;renderLive();applyRemote();}catch(error){if(current(stamp)){if(error.status===401||error.status===403||error.status===404)connectionExpired();else{s.live.status='reconnecting';renderLive();}}}finally{autoFetching=false;if(autoAgain){autoAgain=false;scheduleApply();}}}
document.addEventListener('compositionstart',()=>{composing=true;});document.addEventListener('compositionend',()=>{composing=false;scheduleApply();});document.addEventListener('focusout',scheduleApply);dialog.addEventListener('close',scheduleApply);document.addEventListener('visibilitychange',scheduleApply);window.addEventListener('focus',scheduleApply);document.addEventListener('fullscreenchange',scheduleApply);document.addEventListener('leavepictureinpicture',scheduleApply,true);
async function fetchWorkflow(){if(s.mode!=='staff')return;try{const stamp=projectStamp(),result=await request('/api/client-workflow');if(current(stamp))s.workflow=result.items||[];}catch{if(s.project)notice('내부 검토 상태를 불러오지 못했어요. 「최신 내용 불러오기」를 눌러 주세요.');}}
async function loadProject(id){const requestEpoch=epoch;const result=await request(s.mode==='staff'?`/api/client-projects/${encodeURIComponent(id)}/studio`:'/pulse/api/project');if(requestEpoch!==epoch)return;if(s.mode==='customer'&&s.project&&result.project?.id!==s.project.id){resetContext({preserveInvite:true});accept(result);render();notice('다른 프로젝트로 연결돼서 이전 프로젝트와 쓰던 글을 닫았어요.');return;}accept(result);if(s.mode==='staff')await fetchWorkflow();}
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
  if(!record){notice('연결한 의견을 찾지 못했어요. 이 프로젝트의 기록에서 찾아봐 주세요.');return;}
  record.classList.add('notification-target');record.focus({preventScroll:true});record.scrollIntoView({block:'center',behavior:'auto'});
}
async function openInitialStaffProject(){const id=initialStaffProject;if(!id||s.mode!=='staff'||!s.user)return;initialStaffProject='';const requestEpoch=epoch,userId=s.user.id,sceneId=initialStaffScene,historyTarget=initialStaffHistory;initialStaffScene='';initialStaffHistory=null;if(!s.workspace?.projects?.some(project=>project.id===id)){notice('이 프로젝트를 찾을 수 없거나 볼 권한이 없어요. 목록에서 골라 주세요.');return;}await loadProject(id);if(requestEpoch!==epoch||s.user?.id!==userId)return;s.tab=initialStaffTab==='scenes'?'storyboard':['desk','strategy','direction','concepts','storyboard','review','history'].includes(initialStaffTab)?initialStaffTab:'strategy';if(historyTarget&&s.tab==='history'){if(staffHistoryRecordId(s.project,historyTarget))s.historyTarget=historyTarget;else notice('연결한 의견을 찾지 못했어요. 이 프로젝트의 기록에서 찾아봐 주세요.');}if(sceneId&&s.tab==='storyboard'){if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sceneId)&&s.project?.id===id&&s.project.studio?.scenes?.some(scene=>scene.id===sceneId))pendingInitialScene=sceneId;else notice('연결한 장면을 찾지 못했어요. 장면 목록에서 찾아봐 주세요.');}}
function focusInitialStaffScene(){if(!pendingInitialScene)return;const id=pendingInitialScene;pendingInitialScene='';if(s.mode!=='staff'||s.tab!=='storyboard'||!s.project?.studio?.scenes?.some(scene=>scene.id===id))return;const card=main.querySelector('#scene-'+id);if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}}
async function start(invite='',{manual=false}={}){if(filmDemo)return;if(busy||loading)return;if(invite)closeFlow();loading=true;const requestEpoch=epoch;try{if(s.mode==='staff'){const result=await request('/api/me');if(requestEpoch!==epoch)return;booting=false;if(!result.user){s.user=null;s.csrf='';render();return;}if(s.user&&s.user.id!==result.user.id)resetContext();s.user=result.user;s.csrf=result.csrfToken||'';await loadWorkspace();if(requestEpoch!==epoch)return;await openInitialStaffProject();}else{const result=invite?await request('/pulse/api/open',{body:{invite}}):await request('/pulse/api/project');if(requestEpoch!==epoch)return;accept(result);s.entryError=null;}booting=false;s.error='';s.conflict=false;s.reloadFailed=false;const restored=restoreKeptDrafts();render();if(restored)notice('다시 연결했어요. 쓰던 글이 그대로 남아 있어요.');}catch(error){if(requestEpoch!==epoch)return;booting=false;if(error.status===401||error.status===403){s.user=null;s.project=null;s.csrf='';}if(s.mode==='customer'){if(invite)s.entryError=error.status===401||error.status===403?{title:'이 초대 링크로는 열 수 없어요',text:'링크가 끝났거나 새 링크로 바뀌었을 수 있어요. 담당자에게 새 링크를 요청해 주세요.'}:{title:'프로젝트를 열지 못했어요',text:error.message};else if(manual)s.entryError=error.status===401?{title:'이 기기에 연결된 프로젝트가 없어요',text:'담당자에게 받은 초대 링크를 누르거나 아래 칸에 붙여 넣어 주세요. 「이 기기 기억하기」를 켜 둔 기기라면 30일 동안 링크 없이 열려요.'}:{title:'연결을 확인하지 못했어요',text:error.message};}render();if((invite||error.status!==401)&&!s.entryError)notice(error.message);}finally{loading=false;scheduleInviteNavigation();if(booting){booting=false;render();}}}
// 같은 프로젝트로 다시 연결되면 보관해 둔 쓰던 글을 되살린다. 다른 프로젝트면 버린다.
function restoreKeptDrafts(){const kept=keptDrafts;keptDrafts=null;if(!kept||s.mode!=='customer'||kept.projectId!==s.project?.id||!kept.entries.size)return false;for(const [key,entry] of kept.entries)if(!drafts.has(key))drafts.set(key,entry);return true;}
function connectionExpired(){closeFlow();const keep=s.mode==='customer'&&!demo&&s.project&&drafts.size?{projectId:s.project.id,entries:new Map(drafts)}:null;resetContext();s.user=null;s.workspace=null;s.csrf='';if(s.mode==='customer'){keptDrafts=keep;s.entryError={title:'연결이 끝나 프로젝트를 닫았어요',text:keep?'받은 초대 링크를 아래 칸에 붙여 넣어 다시 열면, 쓰던 글이 그대로 남아 있어요. 이 창을 닫으면 쓰던 글은 사라져요.':'받은 초대 링크를 다시 누르거나 아래 칸에 붙여 넣어 주세요.'};}render();if(s.mode!=='customer')notice('연결이 끝났거나 권한이 바뀌어 프로젝트를 닫았어요. 다시 로그인해 주세요.');}
async function refresh(){if(busy||loading)return;loading=true;const stamp=projectStamp();try{if(s.mode==='staff'){const me=await request('/api/me');if(!current(stamp))return;if(!me.user||me.user.id!==s.user?.id){resetContext();s.user=me.user||null;s.csrf=me.csrfToken||'';if(s.user)await loadWorkspace();render();notice('로그인 계정이 바뀌어 이전 프로젝트를 닫았어요.');return;}s.csrf=me.csrfToken||s.csrf;}if(s.project)await loadProject(s.project.id);else if(s.user)await loadWorkspace();if(!current(stamp))return;s.error='';s.conflict=false;s.reloadFailed=false;render();notice('최신 내용을 불러왔어요. 쓰던 글은 그대로 있어요.');}catch(error){if(current(stamp)){if(error.status===401||error.status===403)connectionExpired();else{s.error=error.message;s.reloadFailed=true;render();notice(error.message);}}}finally{loading=false;scheduleInviteNavigation();}}
async function mutate(operation,{form=null,message='저장했어요.',after,workflowAction=null}={}){if(busy||loading)return false;if(!editable()&&s.project&&!(s.mode==='staff'&&workflowAction&&s.workflow.some(row=>row.projectId===s.project.id&&row.messageId===workflowAction.messageId&&row.actions?.some(action=>action.action===workflowAction.action)))){notice('이 프로젝트는 보기만 할 수 있어요.');return false;}const stamp=projectStamp(),key=form?draftKey(form):'',revision=drafts.get(key)?.revision;setBusy(true);dialog.querySelector('[data-mutation-error]')?.remove();let committed=false;try{const result=await operation();if(!current(stamp))return false;committed=true;accept(result||{});if(key)clearDraft(key,revision);s.error='';s.conflict=false;s.reloadFailed=false;if(after)await after(result||{});if(!current(stamp))return true;if(s.mode==='staff'&&s.project)await loadProject(s.project.id);render();notice(typeof message==='function'?message(result||{}):message);return true;}catch(error){if(current(stamp)){if(error.status===401||error.status===403)connectionExpired();else{s.error=committed?'저장은 됐지만 최신 화면을 불러오지 못했어요. 「최신 내용 불러오기」를 눌러 주세요.':s.mode==='customer'&&/그사이 다른 창이나 고객이 내용을 바꿨어요/.test(error.message)?'그사이 새 소식이 생겼어요(답이 도착했거나 담당자가 내용을 바꿨어요). 「최신 내용 불러오기」를 누른 뒤 다시 보내 주세요. 쓰던 글은 그대로 있어요.':error.message;s.conflict=error.status===409;s.reloadFailed=!!committed;render();notice(s.error);showMutationError(s.error);}}return false;}finally{if(stamp.epoch===epoch)setBusy(false);}}
function studioAction(action,values={}){return request(s.mode==='staff'?staffPath('/studio'):'/pulse/api/studio',{...options(),body:{...values,action,revision:s.project.revision}});}
function projectAction(action,values={}){return request('/pulse/api/action',{...options(),body:{...values,action,revision:s.project.revision}});}
function validateFile(file,{imageOnly=false}={}){if(!file?.size)return;if(file.size>100*1024*1024)throw new PulseError('파일은 100MB까지 올릴 수 있어요.');const types=imageOnly?['image/png','image/jpeg']:['image/png','image/jpeg','video/mp4','video/webm'];if(!types.includes(file.type))throw new PulseError(imageOnly?'PNG나 JPEG 이미지를 골라 주세요.':'MP4·WebM 영상이나 PNG·JPEG 이미지를 골라 주세요.');}
async function attachImage(values){const file=values.file;delete values.file;if(file?.size){validateFile(file,{imageOnly:true});const stamp=projectStamp(),result=await request(s.mode==='staff'?staffPath('/studio/media'):'/pulse/api/studio/media',{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Project-Revision':String(s.project.revision)}});if(!current(stamp))throw new PulseError('프로젝트가 바뀌었어요.');accept(result);values.assetId=result.asset.id;values.imageUrl='';}return values;}

document.addEventListener('input',remember);document.addEventListener('change',remember);
document.addEventListener('input',event=>{const field=event.target;if(field?.name!=='seconds')return;const out=field.closest('form')?.querySelector('.round-clock');if(out)out.textContent=field.value===''?'':clock(Number(field.value));});
document.addEventListener('input',event=>{if(event.target.name==='cast_notes')refreshCasting(event.target.form);});
// 「캐스팅북 코드로 채우기」(담당자): 붙여 넣는 대로 읽은 조합을 보인다. 저장은 고른 조합의 단추로만 한다.
// 결과가 같으면 다시 쓰지 않는다(aria-live 칸이라 글자마다 같은 문장을 다시 읽지 않게), 담당자가 접은 칸은 다시 그려도 접힌 채로 둔다.
const castingCodeShown=new WeakMap();
document.addEventListener('input',event=>{const field=event.target;if(!field?.matches?.('[data-casting-code]'))return;s.castingCode=field.value;const result=field.closest('.casting-code')?.querySelector('[data-casting-code-result]'),strategy=s.project?.studio?.strategy;if(!result)return;const html=castingCodeResult({text:field.value,saved:strategy?.data?.castingSelection,review:strategyReviewState(strategy)});if(castingCodeShown.get(result)!==html){result.innerHTML=html;castingCodeShown.set(result,html);}});
document.addEventListener('toggle',event=>{if(event.target?.matches?.('details.casting-code'))s.castingCodeOpen=event.target.open;},true);
document.addEventListener('change',event=>{if(event.target.name?.startsWith('cast_'))refreshCasting(event.target.form,{modelChanged:event.target.name==='cast_modelId'});});
document.addEventListener('play',event=>{if(event.target.matches('audio,video'))for(const media of document.querySelectorAll('audio,video'))if(media!==event.target&&!(event.target.closest('.compare-grid')&&media.closest('.compare-grid')))media.pause();},true);
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();if(busy||loading)return;const type=form.dataset.form,values=Object.fromEntries(new FormData(form));
  if(type==='invite'){const invite=parseInvite(values.invite);if(!invite){s.entryError={title:'초대 링크를 읽지 못했어요',text:'담당자에게 받은 링크 전체(https://… #invite=…)를 붙여 넣어 주세요.'};render();return;}const kept=keptDrafts;resetContext();keptDrafts=kept;booting=true;render();await start(invite);return;}
  if(type==='login'){setBusy(true);try{const result=await request('/api/login',{body:values});resetContext();s.user=result.user;s.csrf=result.csrfToken||'';await loadWorkspace();await openInitialStaffProject();render();}catch(error){notice(error.message);}finally{setBusy(false);}return;}
  if(type==='new-project'){await mutate(()=>request('/api/client-projects',{...options(),body:{...values,ownerId:s.user.id}}),{form,message:'프로젝트를 만들었어요.',after:async result=>{s.newProject=false;accept(result);if(!s.project&&result.id)await loadProject(result.id);if(s.project)await loadProject(s.project.id);s.tab='strategy';}});return;}
  if(!s.project)return;
  if(await production.submit(form))return;
  if(type==='kickoff-source'){await mutate(()=>request('/pulse/api/action',{...options(),body:kickoffSubmission(s,form.dataset,values.sourceKey)}),{form,message:'자료를 보냈어요. 담당자가 제작에 쓸 수 있는지 확인해요.'});return;}
  if(type==='confirm-delivery'){if(s.mode!=='customer'||!s.project.closeout?.canConfirm||values.confirmed!=='yes')return;if(form.dataset.id!==s.project.closeout.deliveryKey||Number(form.dataset.revision)!==s.project.revision){drafts.delete(draftKey(form));closeDialog();notice('납품 내용이 바뀌었어요. 최신 파일과 안내를 다시 확인해 주세요.');return;}await mutate(()=>request('/pulse/api/action',{...options(),body:{action:'confirm_delivery',confirmed:true,revision:Number(form.dataset.revision),deliveryKey:form.dataset.id}}),{form,message:'수령 확인을 남겼어요.',after:closeDialog});return;}
  if(type==='strategy'){const fromCode=castingCodeSave;castingCodeSave=null;values.castingSelection=takeCastingValues(values);values.channels=new FormData(form).getAll('channels');for(const key of ['durationSeconds','budgetProduction','budgetMedia'])values[key]=values[key]===''||values[key]===undefined?null:Number(values[key]);const before=s.project.studio?.strategy;await mutate(()=>studioAction('save_strategy',{strategy:values}),{form,message:()=>fromCode?castingCodeSaveMessage(fromCode.item,before,s.project?.studio?.strategy,{otherEdits:fromCode.otherEdits}):strategySaveMessage(before,s.mode,s.project?.studio?.strategy),after:()=>{if(fromCode)s.castingCode=fromCode.text;}});return;}
  if(type==='ask'){const text=String(values.text||'').trim(),file=values.file?.size?values.file:null;if(!text&&!file){notice('글을 적거나 파일을 골라 주세요.');form.elements.text.focus();return;}await mutate(async()=>{let fileId='';if(file){const uploaded=await requestFileUpload(file,'etc');accept(uploaded);fileId=uploaded.file.id;}return studioAction('request_answer',{askId:form.dataset.id,text,fileId});},{form,message:'답을 보냈어요. 확인해 볼게요.'});return;}
  if(type==='model-say'){const note=String(values.note||'').trim();if(!note){form.elements.note.focus();return;}await mutate(()=>studioAction('answer_model',{note}),{form,message:'담당자에게 전했어요. 다시 제안해 드릴게요.'});return;}
  if(type==='recast'){if(!values.modelId&&!values.note?.trim()){notice('모델을 고르거나 바라는 점을 적어 주세요.');return;}await mutate(()=>studioAction('answer_model',values.modelId?{modelId:values.modelId,note:values.note||''}:{note:values.note}),{form,message:'담당자에게 전했어요. 반영해서 다시 보내 드릴게요.',after:closeDialog});return;}
  if(type==='desk-ask'){const items=String(values.items||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{const [label,...why]=line.split(' — ');return {label:label.trim().slice(0,120),why:why.join(' — ').trim().slice(0,300)};});if(!items.length||items.length>8){notice('물어볼 것을 한 줄에 하나씩, 8개까지 적어 주세요.');return;}await mutate(()=>studioAction('request_ask',{items}),{form,message:'고객에게 물어봤어요.',after:closeDialog});return;}
  if(type==='desk-propose'){await mutate(()=>studioAction('propose_model',{modelId:values.modelId,note:values.note||''}),{form,message:'고객에게 모델을 제안했어요.',after:closeDialog});return;}
  if(type==='desk-send'){await mutate(()=>studioAction('send_draft',{oneLine:values.oneLine,note:values.note||''}),{form,message:'고객에게 보냈어요.',after:closeDialog});return;}
  if(type==='preferences')await mutate(()=>studioAction('save_preferences',{preferences:values}),{form});
  if(type==='reference')await mutate(async()=>{await attachImage(values);delete values.imageUrl;return studioAction('save_reference',values);},{form,message:'참고자료를 올렸어요.'});
  if(type==='reference-opinion')await mutate(()=>{const ref=s.project.studio.references.find(r=>r.id===form.dataset.id);if(!ref)throw new PulseError('참고자료를 찾지 못했어요. 최신 내용을 불러와 주세요.');return studioAction('save_reference',{id:ref.id,label:ref.label,url:ref.url,assetId:ref.assetId,preference:values.preference,reason:values.reason});},{form,message:'생각을 저장했어요.',after:closeDialog});
  if(type==='concept'||type==='scene')await mutate(async()=>{await attachImage(values);if(form.dataset.id)values.id=form.dataset.id;if(type==='scene'){values.duration=values.duration===''?'':Number(values.duration);values.valueNumbers=new FormData(form).getAll('valueNumbers').map(Number);}return studioAction(type==='concept'?'save_concept':'save_scene',values);},{form,message:'자료를 저장했어요.',after:()=>{s.editor=null;}});
  if(type==='select-concept')await mutate(()=>studioAction('select_concept',{conceptId:form.dataset.id,conceptRevision:Number(form.dataset.revision),text:values.text}),{form,message:'콘셉트를 골랐어요.',after:closeDialog});
  if(type==='review-scene')await mutate(()=>studioAction('review_scene',{sceneId:form.dataset.id,sceneRevision:Number(form.dataset.revision),...values}),{form,message:'장면에 의견을 남겼어요.',after:closeDialog});
  if(type==='comment')await mutate(()=>studioAction('comment',{targetType:form.dataset.target,targetId:form.dataset.id,targetRevision:Number(form.dataset.revision),text:values.text}),{form,message:'의견을 보냈어요.',after:closeDialog});
  if(type==='feedback')await mutate(()=>{if(s.mode==='staff')return request(staffPath('/messages'),{...options(),body:{revision:s.project.revision,text:values.text,visibility:'customer'}});const latest=latestPreview(),version=s.project.versions.find(v=>v.id===s.versionId)||s.project.versions.at(-1),bound=drafts.get(draftKey(form))?.versionId;if((bound&&bound!==latest?.id&&values.action!=='support')||(values.action==='feedback'&&(!latest||version?.id!==latest.id||latest.approvedAt||(bound&&bound!==latest.id))))throw new PulseError('쓰던 의견은 이전 시안에 붙어 있어요. 최신 시안을 먼저 열어 주세요. 글은 그대로 있어요.');return projectAction(values.action,{text:values.text,...(values.action==='feedback'?{versionId:latest.id,seconds:values.seconds===''?(document.querySelector('#review-video')?Math.round(document.querySelector('#review-video').currentTime*10)/10:null):Number(values.seconds)}:{})});},{form,message:'의견을 보냈어요.'});
  if(type==='project')await mutate(()=>request(staffPath(),{...options(),body:{contact:s.project.contact||'',internalNotes:s.project.internalNotes||'',nextContactDate:s.project.nextContactDate||'',...values,revision:s.project.revision}}),{form,after:async()=>loadProject(s.project.id)});
  if(type==='version')await mutate(async()=>{const file=values.file;delete values.file;if(file?.size){validateFile(file);return request(staffPath('/media'),{...options(),file,headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Version-Label':encodeURIComponent(values.label),'X-Version-Kind':values.kind,'X-Version-Guide':encodeURIComponent(values.guide),'X-Project-Revision':String(s.project.revision)}});}if(!values.url)throw new PulseError('파일이나 자료 링크를 넣어 주세요.');return request(staffPath('/versions'),{...options(),body:{...values,revision:s.project.revision}});},{form,message:'고객에게 자료를 보냈어요.',after:async()=>{s.showVersion=false;s.versionId='';await loadProject(s.project.id);}});
  if(type==='workflow')await mutate(()=>request('/api/client-workflow',{...options(),body:{...values,projectId:s.project.id,messageId:form.dataset.messageId,revision:s.project.revision}}),{form,workflowAction:{messageId:form.dataset.messageId,action:values.action},message:'검토 요청을 저장했어요.',after:async()=>loadProject(s.project.id)});
});

document.addEventListener('change',event=>{const target=event.target;if(target.matches('[data-action=version]')){s.versionId=target.value;render();}if(target.matches('[data-form=review-scene] [name=status]')){const text=target.form.elements.text;text.required=target.value!=='confirmed';}});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.id;
  if(['close-dialog','leave-cancel'].includes(action)){closeDialog();return;}
  if(action==='leave-confirm'){drafts.clear();closeDialog();const next=leaveAction;leaveAction=null;next?.();return;}
  if(action==='confirm-action'){if(!busy)await confirmAction?.();return;}
  if(action==='install'){showInstallGuide();return;}
  if(action==='install-now'){const prompt=s.installPrompt;if(!prompt){showInstallGuide();return;}button.disabled=true;try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')notice('설치를 시작했어요. 끝나면 홈 화면의 PULSE를 열어 주세요.');}catch{notice('브라우저 메뉴에서 ‘앱 설치’나 ‘홈 화면에 추가’를 골라 주세요.');}finally{if(s.installPrompt===prompt)s.installPrompt=null;if(dialog.open&&dialog.dataset.installGuide==='true')showInstallGuide();}return;}
  if(action==='install-notifications'){closeDialog();s.live.open=true;renderLive();document.querySelector('#pulse-notifications h2')?.focus();refreshDevice();return;}
  if(action==='retry'||action==='check-login'){await start('',{manual:action==='retry'});return;}
  if(action==='refresh'){await refresh();return;}
  if(action==='reset-production-draft'){if(busy||loading)return;const form=button.closest('form');if(!form||!(/^(round-|preview-)/.test(form.dataset.form)||form.dataset.form==='deliverables'))return;const stamp=projectStamp();drafts.delete(draftKey(form));await refresh();if(current(stamp)&&!s.error)notice('쓰던 내용을 지우고 최신 내용을 불러왔어요. 새 내용에서 다시 골라 주세요.');return;}
  if(action==='notifications'){s.live.open=!s.live.open;renderLive();if(s.live.open){document.querySelector('#pulse-notifications h2')?.focus();refreshDevice();}return;}
  if(action==='close-notifications'){s.live.open=false;renderLive();document.querySelector('[data-action=notifications]')?.focus();return;}
  if(action==='device-notifications'){await enableDeviceNotices();return;}
  if(action==='read-notifications'){try{await live?.read('all');}catch(error){notice(error.message);}return;}
  if(action==='open-notification'){
    if(busy||loading)return;
    const item=s.live.notifications.find(row=>row.id===id);if(!item)return;
    const sourceEpoch=epoch,sourceIdentity=identity(),valid=()=>sourceEpoch===epoch&&sourceIdentity===identity();
    try{await live?.read(Array.isArray(item.ids)&&item.ids.length?item.ids:[id]);}catch(error){if(valid()){notice(error.message);live?.pull();}return;}
    if(!valid())return;
    const move=async()=>{
      if(!valid()||busy||loading)return;
      if(item.projectId!==s.project?.id){if(s.mode!=='staff')return;resetContext();}
      const moveEpoch=epoch,moveIdentity=identity();loading=true;
      try{await loadProject(item.projectId);}catch(error){if(moveEpoch===epoch)notice(error.message);return;}
      finally{if(moveEpoch===epoch){loading=false;scheduleInviteNavigation();}}
      if(moveEpoch!==epoch||moveIdentity!==identity()&&s.project?.id!==item.projectId||s.project?.id!==item.projectId)return;
      s.live.open=false;s.notificationCommentId=item.commentId||null;
      s.tab=['overview','draft','desk','strategy','direction','concepts','storyboard','review','history','manage'].includes(item.tab)?item.tab:'history';
      if(item.versionId)s.versionId=item.versionId;
      render();
      const pointer=item.messageId||item.commentId;
      const target=pointer&&Array.from(main.querySelectorAll('[data-message-id]')).find(node=>node.dataset.messageId===pointer&&node.matches('article'))
        ||item.requestId&&Array.from(main.querySelectorAll('[data-scene-request-id]')).find(node=>node.dataset.sceneRequestId===item.requestId)
        ||item.sceneId&&Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+item.sceneId)
        ||item.conceptId&&Array.from(main.querySelectorAll('.concept-card')).find(node=>node.id==='concept-'+item.conceptId)
        ||item.target==='deliverables'&&main.querySelector('.deliverables-panel')
        ||item.target==='kickoff'&&main.querySelector('.kickoff-card')
        ||item.target==='approval'&&main.querySelector('#review-approval');
      if(target){for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;target.setAttribute('tabindex','-1');target.classList.add('notification-target');target.focus({preventScroll:true});target.scrollIntoView({block:'center'});setTimeout(()=>target.classList.remove('notification-target'),5000);}
      else main.querySelector('[data-stage-content]')?.scrollIntoView({block:'start'});
    };
    if(item.projectId!==s.project?.id)withLeave(move);else await move();return;
  }

  if(action==='latest-version'){s.versionId=latestPreview()?.id||'';render();return;}
  if(action==='move-feedback-draft'){const form=main.querySelector('[data-form=feedback]'),entry=form&&drafts.get(draftKey(form));if(entry){entry.versionId=latestPreview()?.id||'';entry.values.seconds='';entry.values.action='feedback';entry.revision++;s.versionId=entry.versionId;render();notice('쓴 글을 최신 시안으로 옮겼어요. 영상 시간은 다시 넣어 주세요.');}return;}
  if(action==='demo-next'&&demo){if(busy||loading)return;if(drafts.size){notice('쓰던 내용을 먼저 저장한 뒤 다음 단계로 가 주세요.');return;}const guide=demo.guide();if(guide.canAdvance){await mutate(async()=>demo.advance(),{message:'다음 단계를 열었어요.',after:result=>{s.tab=result.tab||demo.guide().tab;s.versionId='';}});}else{s.tab=guide.tab;render();}main.querySelector('.canvas-head h1,.hello h1')?.scrollIntoView({block:'start'});return;}
  if(action==='demo-reset'&&demo){withLeave(()=>{confirmAction=async()=>{const result=demo.reset();resetContext();accept(result);s.tab='direction';render();notice('체험을 처음으로 되돌렸어요.');};openDialog('confirm',{title:'이 체험을 처음부터 다시 할까요?',text:`${s.desktopApp?'이 PC 앱':'이 브라우저'}에 남은 체험 기록(고른 것·의견·승인)만 지워요. 실제 프로젝트에는 영향이 없어요.`,button:'다시 시작'});});return;}
  if(action==='logout'){const runLogout=()=>withLeave(async()=>{setBusy(true);try{await request(s.mode==='staff'?'/api/logout':'/pulse/api/logout',{...options(),body:{}});resetContext();keptDrafts=null;s.user=null;s.workspace=null;s.csrf='';s.entryError=null;render();notice(s.mode==='staff'?'로그아웃했어요.':'이 기기에서 프로젝트 연결을 닫았어요.');}catch(error){notice(error.message);}finally{setBusy(false);}});if(s.mode==='customer'&&!demo){confirmAction=async()=>{closeDialog();runLogout();};openDialog('confirm',{title:'이 기기에서 연결을 닫을까요?',text:'다시 열려면 담당자에게 받은 초대 링크가 필요해요. 이 기기에 켜 둔 알림과 「이 기기 기억하기」도 함께 꺼져요.',button:'연결 닫기'});return;}runLogout();return;}
  if(action==='remember-device'){if(busy||loading||s.mode!=='customer'||demo||!s.project)return;button.disabled=true;try{const result=await deviceRequest('/pulse/api/remember-device',{csrf:s.csrf,body:{}});s.live.rememberKnown=true;s.live.remembered=!!result?.deviceConnection?.remembered;s.rememberOffer=false;render();renderLive();notice(`이 기기를 기억했어요. 30일 동안 초대 링크 없이 ${s.desktopApp?'이 PC 앱':'이 브라우저'}에서 열려요.`);}catch(error){notice(error.message);}finally{button.disabled=false;}return;}
  if(action==='remember-dismiss'){s.rememberOffer=false;try{localStorage.setItem(rememberDismissKey(),'1');}catch{}render();return;}
  if(action==='projects'){withLeave(async()=>{resetContext();try{await loadWorkspace();render();}catch(error){render();notice(error.message);}});return;}
  if(action==='open-project'){withLeave(async()=>{resetContext();loading=true;try{await loadProject(id);render();}catch(error){notice(error.message);}finally{loading=false;scheduleInviteNavigation();}});return;}
  if(action==='new-project'){s.newProject=true;render();main.querySelector('[data-form=new-project] input')?.focus();return;}
  if(action==='cancel-new'){withLeave(()=>{s.newProject=false;render();});return;}
  if(!s.project)return;
  if(action==='desk-confirm'){confirmAction=()=>mutate(()=>studioAction('request_confirm'),{message:'확인을 마쳤어요. 답을 제작 설계로 옮겼어요.',after:closeDialog});openDialog('confirm',{title:'의뢰서 확인을 끝낼까요?',text:'답을 제작 설계로 옮기고, 고객 화면은 「1차안을 만들고 있어요」로 바뀌어요.',button:'확인 끝'});return;}
  if(action==='desk-ask'){const model=deskModel(s.project);openDialog('desk-ask',{suggested:(model?.checks||[]).filter(item=>!item.ok&&/없어요$/.test(item.label)).map(item=>item.label.replace(/[이가]? ?없어요$/,'').trim()).join('\n')});return;}
  if(action==='desk-propose'){openDialog('desk-propose',{kind:s.project.studio?.request?.answers?.kind||'',modelId:s.project.studio?.request?.modelProposal?.modelId||''});return;}
  if(action==='desk-send'){const st=s.project.studio||{},scenes=(st.scenes||[]).filter(scene=>scene.visibility==='customer'),round=st.request?.rounds?.at(-1);openDialog('desk-send',{count:scenes.length,kind:scenes.length&&scenes.every(scene=>scene.assetId||scene.imageUrl)?'images':'script',oneLine:round?.oneLine||st.strategy?.data?.primaryPromise||deskModel(s.project)?.note?.lines?.[0]||''});return;}
  if(action==='open-round-submit'){const box=main.querySelector('.round-submit');if(box){box.open=true;box.scrollIntoView({block:'center'});box.querySelector('[name=representativeName]')?.focus({preventScroll:true});}return;}
  if((action.startsWith('round-')||action.startsWith('deliverable-'))&&(busy||loading))return;
  if(await production.click(button))return;
  if(action==='strategy-discard'){if(busy||loading)return;drafts.delete([identity(),'strategy',''].join(':'));closeDialog();render();notice('쓰던 내용을 되돌렸어요. 저장된 제작 설계가 보여요.');return;}
  if(['request-strategy-review','confirm-strategy','confirm-strategy-save'].includes(action)){
    if(drafts.has([identity(),'strategy',''].join(':'))){notice(strategyUnsavedReviewMessage(s.project.studio?.strategy));s.tab='strategy';closeDialog();render();return;}
    if(action==='request-strategy-review')await mutate(()=>studioAction('request_strategy_review'),{message:'고객에게 제작 설계 확인을 요청했어요.'});
    if(action==='confirm-strategy')openDialog('strategy-confirm',s.project.studio.strategy);
    if(action==='confirm-strategy-save')await mutate(()=>studioAction('confirm_strategy',{strategyRevision:Number(button.dataset.revision)}),{message:'제작 설계를 확인했어요.',after:closeDialog});
    return;
  }
  if(action==='kickoff-reference'||action==='kickoff-strategy'){if(busy||loading)return;s.tab=action==='kickoff-reference'?'direction':'strategy';render();const form=main.querySelector(action==='kickoff-reference'?'[data-form=reference]':'[data-form=strategy]');if(form){const details=form.closest('details');if(details)details.open=true;const input=form.querySelector('input:not([type=hidden]),textarea,select');const group=input?.closest('details');if(group)group.open=true;form.scrollIntoView({block:'start',behavior:'auto'});input?.focus({preventScroll:true});}return;}
  if(action==='changes-strategy'){if(busy||loading)return;s.tab='strategy';render();const agreement=main.querySelector('.strategy-agreement');if(agreement){agreement.setAttribute('tabindex','-1');agreement.focus({preventScroll:true});agreement.scrollIntoView({block:'center',behavior:'auto'});}return;}
  if(action==='changes-scene'){if(busy||loading||s.mode!=='staff')return;if(!s.project.studio?.scenes?.some(scene=>scene.id===id)){notice('이 장면이 바뀌었어요. 최신 내용을 불러와 주세요.');return;}s.tab='storyboard';render();const card=Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+id);if(card){card.setAttribute('tabindex','-1');card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:'auto'});}return;}
  if(action==='casting-code-save'){if(busy||loading)return;const form=main.querySelector('[data-form=strategy]'),item=readCastingCode(button.dataset.code).items[0],otherEdits=!!form&&Object.keys(drafts.get(draftKey(form))?.values||{}).some(name=>!name.startsWith('cast_'));if(!form||!applyCastingItem(form,item)){notice('모델·스타일 칸을 찾지 못했어요. 「최신 내용 불러오기」를 누른 뒤 다시 저장해 주세요.');return;}const invalid=form.querySelector('input:invalid,textarea:invalid,select:invalid');if(invalid){for(let group=invalid.closest('details');group;group=group.parentElement?.closest('details'))group.open=true;invalid.scrollIntoView({block:'center'});invalid.reportValidity();notice('조합은 채웠어요. 제작 설계에서 표시한 칸을 고친 뒤 저장해 주세요.');return;}castingCodeSave={item,otherEdits,text:button.closest('.casting-code')?.querySelector('[data-casting-code]')?.value??''};form.requestSubmit();return;}
  if(action==='casting-open'){const section=main.querySelector('.casting-configurator');const group=section?.closest('details');if(group)group.open=true;if(section){section.scrollIntoView({block:'start',behavior:'auto'});section.querySelector('input')?.focus({preventScroll:true});}return;}
  if(action==='tab'){const toContent=button.dataset.scroll==='content',toInquiry=button.dataset.scroll==='inquiry',toDeliverables=button.dataset.scroll==='deliverables';s.tab=button.dataset.tab;s.error='';render();const target=main.querySelector(toContent?'[data-stage-content]':toInquiry?'.review-form':toDeliverables?'.deliverables-panel':'.tab-panel');if(toContent||toInquiry||toDeliverables){target?.scrollIntoView({block:'start',behavior:'auto'});if(toInquiry)target?.querySelector('textarea')?.focus({preventScroll:true});}else if(typeof window.scrollTo==='function')window.scrollTo(0,0);return;}
  if(action==='mood'){const field=button.closest('form').elements.mood;const moods=field.value.split(',').map(v=>v.trim()).filter(Boolean),value=button.dataset.value;field.value=moods.includes(value)?moods.filter(v=>v!==value).join(', '):[...moods,value].join(', ');button.setAttribute('aria-pressed',String(!moods.includes(value)));field.dispatchEvent(new Event('input',{bubbles:true}));return;}
  if(action==='image'){openDialog('image',{src:button.dataset.src,label:button.dataset.label});return;}
  if(action==='choose-concept'){const item=s.project.studio.concepts.find(c=>c.id===id);if(item)openDialog('choose',item);return;}
  if(action==='edit-concept'||action==='edit-scene'){s.editor={type:action==='edit-concept'?'concept':'scene',id:id||''};render();document.querySelector(`[data-form=${s.editor.type}]`)?.scrollIntoView({block:'start'});return;}
  if(action==='cancel-editor'||action==='close-editor'){s.editor=null;render();return;}
  if(action==='review-scene'){const item=s.project.studio.scenes.find(c=>c.id===id);if(item)openDialog('scene',item);return;}
  if(action==='confirm-scene'||action==='confirm-scene-request'){if(await mutate(()=>studioAction('review_scene',sceneConfirmation(s,button.dataset)),{message:'장면 확인을 남겼어요.'}))Array.from(main.querySelectorAll('.scene-card')).find(node=>node.id==='scene-'+id)?.querySelector('[data-action=review-scene]')?.focus({preventScroll:true});return;}
  if(action==='comment'){const type=button.dataset.target,item=s.project.studio[type==='concept'?'concepts':'scenes'].find(c=>c.id===id);if(item)openDialog('comment',{...item,type});return;}
  if(action==='move-scene'){const ids=s.project.studio.scenes.map(c=>c.id),from=ids.indexOf(id),to=from+Number(button.dataset.direction);if(from>=0&&to>=0&&to<ids.length){[ids[from],ids[to]]=[ids[to],ids[from]];await mutate(()=>studioAction('reorder_scenes',{ids}),{message:'장면 순서를 바꿨어요.'});}return;}
  if(action==='reference-opinion'){const ref=s.project.studio.references.find(r=>r.id===id);if(ref)openDialog('reference',ref);return;}
  if(action==='remove-reference'){confirmAction=()=>mutate(()=>studioAction('remove_reference',{id}),{message:'참고자료를 지웠어요.',after:closeDialog});openDialog('confirm',{title:'이 참고자료를 지울까요?',text:'이 참고자료와 남긴 설명이 프로젝트에서 사라져요.',button:'지우기'});return;}
  if(action==='show-version'||action==='hide-version'){s.showVersion=action==='show-version';render();if(s.showVersion)document.querySelector('#version-form')?.scrollIntoView({block:'start'});return;}
  if(action==='compare'){s.compare=!s.compare;render();return;}
  if(action==='use-time'){const video=document.querySelector('#review-video'),field=document.querySelector('[name=seconds]');if(video&&field){video.pause();field.value=String(Math.round(video.currentTime*10)/10);field.dispatchEvent(new Event('input',{bubbles:true}));notice('지금 장면의 시간을 의견에 넣었어요.');if(button.dataset.focusComment==='true'){const text=document.querySelector('[data-form=feedback] [name=text]');text?.scrollIntoView({block:'center'});text?.focus({preventScroll:true});}}return;}
  if(action==='review-approval'){const card=document.querySelector('.approval-card');card?.scrollIntoView({block:'center'});const heading=card?.querySelector('h3');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}return;}
  if(action==='seek'){s.versionId=button.dataset.version||s.versionId;render();const video=document.querySelector('#review-video');if(video){const seek=()=>{video.currentTime=Math.min(Number(button.dataset.seconds)||0,Number.isFinite(video.duration)?video.duration:86400);video.pause();};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});video.scrollIntoView({block:'center'});}if(button.dataset.text)notice(clock(Number(button.dataset.seconds)||0)+' · '+button.dataset.text);return;}
  if(action==='confirm-delivery'){if(busy||loading||s.mode!=='customer'||!s.project.closeout?.canConfirm)return;const c=s.project.closeout;const files=c.files.map(file=>({...file,guide:s.project.versions.find(version=>version.id===file.id)?.guide||''}));drafts.delete([identity(),'confirm-delivery',c.deliveryKey].join(':'));openDialog('delivery-confirm',{deliveryKey:c.deliveryKey,revision:s.project.revision,files});return;}
  if(action==='approve'){const approval=previewApprovalState(s.project,{demo:!!demo});if(!approval.canApprove){notice(approval.reason);return;}const latest=latestPreview();if(s.versionId&&s.versionId!==latest?.id){notice('최신 시안을 먼저 열어 주세요.');return;}const roundDrafts=s.project.studio?.feedbackRounds?.drafts||[];if(roundDrafts.some(d=>d.current&&d.items?.length)||hasDraft('round-draft')){notice('모은 수정 의견을 보내거나 초안을 비운 뒤 승인해 주세요.');return;}const form=document.querySelector('[data-form=feedback]');if(form?.elements.text?.value.trim()){notice('쓰던 의견을 먼저 보내거나 지운 뒤 승인해 주세요.');return;}if(latest&&latest.id===id)openDialog('approve',{...latest,revision:s.project.revision});return;}
  if(action==='approve-confirm'){if(busy)return;const approval=previewApprovalState(s.project,{demo:!!demo});if(!approval.canApprove){notice(approval.reason);closeDialog();return;}if(id!==latestPreview()?.id){notice('새 시안이 왔어요. 최신 시안을 보고 승인해 주세요.');closeDialog();return;}await mutate(()=>request('/pulse/api/action',{...options(),body:{action:'approve',versionId:id,revision:Number(button.dataset.revision)}}),{message:'시안을 승인했어요. 이 시안으로 최종본을 만들어요.',after:closeDialog});return;}
  if(action==='resolve'){await mutate(()=>request(staffPath('/resolve'),{...options(),body:{revision:s.project.revision,messageId:id}}),{message:'의견을 처리했어요.',after:async()=>loadProject(s.project.id)});return;}
  if(action==='workflow'){await mutate(()=>request('/api/client-workflow',{...options(),body:{projectId:s.project.id,messageId:id,revision:s.project.revision,action:button.dataset.workflow}}),{workflowAction:{messageId:id,action:button.dataset.workflow},message:'검토 상태를 바꿨어요.',after:async()=>loadProject(s.project.id)});return;}
  if(action==='invite'){await mutate(()=>request(staffPath('/invite'),{...options(),body:{revision:s.project.revision}}),{message:'초대 링크를 만들었어요. 고객에게 보내 주세요.',after:async result=>{s.inviteUrl=location.origin+'/pulse-app/#invite='+encodeURIComponent(result.invite);await loadProject(s.project.id);}});return;}
  if(action==='revoke'){confirmAction=()=>mutate(()=>request(staffPath('/revoke'),{...options(),body:{revision:s.project.revision}}),{message:'고객 접근을 끊었어요.',after:async()=>{s.inviteUrl='';closeDialog();await loadProject(s.project.id);}});openDialog('confirm',{title:'고객 접근을 끊을까요?',text:'보낸 초대 링크로는 더 이상 열리지 않아요. 다시 열어 주려면 새 초대 링크를 만들어 주세요.',button:'접근 끊기'});return;}
  if(action==='copy-invite'){try{await navigator.clipboard.writeText(s.inviteUrl);notice('초대 링크를 복사했어요.');}catch{const field=document.querySelector('[name="invite-url"]');field?.focus();field?.select();notice('여기서는 자동 복사가 안 돼요. 선택된 링크를 직접 복사해 주세요.');}}
});

// 「캐스팅북 코드로 채우기」 접힘: toggle은 한 박자 뒤에 와서, 접자마자 탭을 옮기면 떨어져 나간 칸에서 울려 놓친다 — 누르는 순간에도 적어 둔다.
document.addEventListener('click',event=>{const details=event.target?.closest?.('details.casting-code>summary')?.parentElement;if(details?.matches?.('details.casting-code'))s.castingCodeOpen=!details.open;},true);
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
if(filmDemo)void openFilmDemo();if(startRequest)void openPublicRequest();
if(demo){accept(demo.snapshot());s.tab=demo.guide().tab;render();}else{render();await start(parseInvite(initialInvite));}initialInvite='';
if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'/pulse-app/'}).catch(()=>{});


