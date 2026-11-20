'use strict';
// 검정 구 얼굴 흐름 시험(orb-face-browser-qa.cjs)의 합성 다리. 제품은 이 파일을 싣지 않는다.
// 토큰, 실제 계정 요청, 앱 실행, 네트워크는 없다. 시험이 window.__orbFixture로 인증 · 배정 · 초대 · 구독 자료를 바꾼다.
const {contextBridge}=require('electron');
// WebGL이 없는 판은 창을 만들 때 넘긴 인자로 고른다. 새 얼굴은 이 값이 참이면 2D 대체로 그린다
if(process.argv.includes('--orb-qa-no-webgl'))contextBridge.exposeInMainWorld('__synkOrbNoWebGL',true);
if(process.argv.includes('--orb-qa-no-canvas'))contextBridge.exposeInMainWorld('__synkOrbNoCanvas',true);
const GUEST_GEN='90000000-0000-4000-8000-000000000009';
let auth={configured:true,status:'restoring',signedIn:false,sessionGeneration:0,accountGeneration:GUEST_GEN};
let env={platform:'win32',arch:'x64',version:'0.4.95',mode:'development',publicAppsAvailable:[],qaGuestEntry:false};
let assignment={status:'resolved',destinations:[],unavailable:[]},inviteMode='received',subs=null,subsFail=0,checkResult=null,tray=[],visits=null,health=null,backup=null;
const listeners=new Set(),subsListeners=new Set(),calls=[];
// 계정 관리 방(2단계 둘째 조각)이 부르는 구독 다리. 부른 것을 적고, 저장은 이 창의 합성 자료에만 고쳐 넣는다(실제 로그인 · 설치 · 브라우저 열기는 없다)
let subsSeq=100;
const emitSubs=()=>{for(const fn of subsListeners){try{fn(subs);}catch{}}};
const nextSubs=mutate=>{const base=subs?JSON.parse(JSON.stringify(subs)):{ok:true,rows:[]};mutate(base);subsSeq=Math.max(subsSeq,Number(base.seq)||0)+1;base.seq=subsSeq;subs=base;return base;};
// 모델별 토큰(2단계 둘째 조각 3절). 켜기 · 끄기 · 세기 · 실시간 부탁을 적고, 판에 순서 번호를 붙여 알린다(본체 ai-tokens.cjs처럼 늦은 판이 새 판을 덮지 않게)
let tokens={ok:true,enabled:false,epoch:1,seq:1};const tokenListeners=new Set();
const emitTokens=()=>{for(const fn of tokenListeners){try{fn(tokens);}catch{}}};
const nextTokens=patch=>{tokens={...tokens,...patch,ok:true,epoch:1,seq:(tokens.seq||1)+1};return tokens;};
// 내 계정(2단계 둘째 조각 5절). 합성 회원 하나의 자료다. 바꾸는 요청은 이 창의 자료만 고치고, 모든 곳 로그아웃은 본체처럼 이 PC의 로그인도 끝낸다
const iso=ms=>new Date(Date.now()-ms).toISOString();
const qaAccount=()=>({ok:true,account:{synk_user_id:'20000000-0000-4000-8000-000000000002',status:'active',profile:{display_name:'합성 회원',locale:'ko',time_zone:'Asia/Seoul'},profile_revision:3},
  memberships:[{kind:'learner',role:'student',student_code:'S-01'}],learning:{enabled:false,revision:1},capabilities:{learningSync:true},
  sessions:[{id:'s-now',product:'platform',label:'',current:true,last_seen:iso(0)},{id:'s-phone',product:'world',label:'휴대폰',current:false,last_seen:iso(26*3600e3)},{id:'s-laptop',product:'platform',label:'집 노트북',current:false,last_seen:iso(4*86400e3)}],dataRequests:[]});
let account=qaAccount();
const accountOps={
  accountView:()=>JSON.parse(JSON.stringify(account)),
  updateProfile:params=>{account.account.profile={...account.account.profile,...params?.profile};account.account.profile_revision++;return {ok:true};},
  revokeSession:params=>{account.sessions=account.sessions.filter(s=>s.id!==params?.session_id);return {ok:true};},
  setLearning:params=>{account.learning={enabled:params?.enabled===true,revision:account.learning.revision+1};return {ok:true};},
  requestDeletion:()=>{const due=new Date(Date.now()+7*86400e3).toISOString();account.account.status='deletion-requested';account.learning={enabled:false,revision:account.learning.revision+1};account.dataRequests=[{kind:'delete',status:'pending',request_id:'qa-delete',due_at:due}];return {ok:true,request:{due_at:due}};},
  cancelDeletion:()=>{account.account.status='active';account.dataRequests=[];return {ok:true};},
};
// 설정 방(2단계 둘째 조각 6절)이 부르는 PC 다리. 본체(desktop-preferences.cjs, draft-recovery-ipc.cjs, 업데이트)의 답 모양만 흉내 내고 부른 것을 적는다.
// 실제로 자동 시작을 등록하거나, 단축키를 잡거나, 새 판을 받거나, 설치 파일을 열지 않는다. 시험이 __orbFixture.setUpdate로 업데이트 판을 바꿔 알린다
let prefs={closeToTray:true,launchAtLogin:false,startHidden:false,globalShortcut:'',zoomFactor:1},drafts={enabled:false},diag=null;
let update={ok:true,state:'current',currentVersion:'0.4.97',latestVersion:null,progress:0,code:null,automatic:false};
const prefListeners=new Set(),draftListeners=new Set(),updateListeners=new Set(),careListeners=new Set();
// 플레저 PC 알림(PC 0.5.0 설계 4.5 R7): 본체(care-notifications.cjs view)의 답 모양만 흉내 낸다. 로그인한 회원만 켤 수 있다
let care={enabled:false,hour:9,minute:0};
const careStatus=()=>({ok:true,available:true,signedIn:auth.signedIn===true,enabled:auth.signedIn===true&&care.enabled,hour:care.hour,minute:care.minute,timeZone:'Asia/Seoul'});
const tell=(set,value)=>{for(const fn of set){try{fn(value);}catch{}}};
const prefSnap=()=>({ok:true,preferences:{...prefs},capabilities:{launchAtLogin:true,globalShortcut:true,tray:true,encryptedDrafts:true}});
// 본체처럼 다른 앱이 잡은 단축키는 거절한다. 시험에서는 Ctrl+Alt+K를 그런 단축키로 친다
const prefUpdate=patch=>{if(patch?.globalShortcut==='Ctrl+Alt+K')return {ok:false,code:'SHORTCUT_UNAVAILABLE'};prefs={...prefs,...patch};const snap=prefSnap();setTimeout(()=>tell(prefListeners,snap),0);return snap;};
const draftStatus=owner=>({ok:true,available:true,enabled:Boolean(owner)&&auth.signedIn===true&&drafts.enabled});
const setUpdate=patch=>{update={...update,...patch};tell(updateListeners,{...update});return {...update};};
// 솔리오 「사무실」(사무실 구현설계 14.2): 본체(main.cjs synk:office-*)의 답 모양만 흉내 낸다. 세션은 짧은 꼴(sessions)로 받아, 읽을 때마다 지금 시각에 맞춰
// 상태 규칙(office-model.mjs)이 읽는 칸으로 짓는다. 폴더 고르기 창은 열지 않고 정해 둔 가짜 폴더를 고른 것으로 친다. 정하지 않으면 볼 계정이 아닌 답이다
let office=null;const officeListeners=new Set(),officeSeen={};let officeSeq=0;
const officeEmit=()=>setTimeout(()=>{for(const fn of officeListeners){try{fn();}catch{}}},0);
const officeNorm=p=>String(p||'').replace(/[\\/]+/g,'\\').replace(/\\+$/,'').toLowerCase();
const officeDeptOf=spec=>{if(Object.hasOwn(office?.assignments||{},spec.id))return office.assignments[spec.id];const here=officeNorm(spec.cwd);let best=null,depth=-1;for(const d of office?.departments||[]){const f=officeNorm(d.folder);if(f&&(here===f||here.startsWith(f+'\\'))&&f.length>depth){best=d.id;depth=f.length;}}return best;};
// kind: work(일하는 중) · ask(승인을 물음) · done(2분 넘게 걸려 끝냄) · rest(쉬는 중) · silent(소식 없음). Codex는 훅 소식이 없는 세션이다(기록만)
function officeSession(spec,t){
  const at=t-(Number(spec.ago)||0),hooked=spec.tool!=='codex'&&spec.hooked!==false;
  const s={id:spec.id,tool:spec.tool==='codex'?'codex':'claude',cwd:spec.cwd||null,model:spec.model||null,hooked,firstAt:at-600e3,hookedAt:null,lastHookAt:null,lastRecordAt:null,postAt:null,askAt:null,clearAt:null,idleAt:null,stopAt:null,turnStartAt:null,doneLong:false,seenAt:null,endedAt:null,agents:{},anonAgents:0,lastTool:spec.toolName?{name:spec.toolName,detail:spec.detail||''}:null,lastToolAt:spec.toolName?at:null};
  for(let i=0;i<(Number(spec.helpers)||0);i++)s.agents['qa-agent-'+i]=true;
  if(!hooked){s.lastRecordAt=at;return s;}
  s.hookedAt=s.firstAt;s.lastHookAt=at;
  if(spec.kind==='ask')s.askAt=at;
  else if(spec.kind==='done'){s.postAt=at-240e3;s.clearAt=at;s.stopAt=at;s.doneLong=true;const seen=officeSeen[spec.id];s.seenAt=Number.isFinite(seen)?seen:null;}
  else if(spec.kind==='rest'){s.postAt=at-240e3;s.clearAt=at;s.stopAt=at;s.seenAt=at+1;}
  else{s.postAt=at;s.clearAt=at;s.turnStartAt=at-60e3;}
  return s;
}
const officeSnap=()=>{if(!office||office.available!==true)return {ok:true,available:false};const t=Date.now();const sessions={};for(const spec of office.sessions||[])sessions[spec.id]=officeSession(spec,t);
  return {ok:true,available:true,state:{sessions,ignored:{}},departments:JSON.parse(JSON.stringify(office.departments||[])),assignments:{...(office.assignments||{})},settings:{view:'tilted',manualCap:null,...(office.settings||{})},roots:JSON.parse(JSON.stringify(office.roots||{claude:[],codex:[],added:[]})),pc:office.pc===undefined?{cores:16,totalMemGb:31.7,freeMemGb:19,cpuPercent:38}:office.pc,hooks:{on:false,available:false},readAt:t};};
const officeGate=()=>auth.signedIn!==true?{ok:false,code:'SIGN_IN_REQUIRED'}:!office||office.available!==true?{ok:false,code:'NOT_ALLOWED'}:null;
const officeChange=work=>{const refused=officeGate();if(refused)return refused;const res=work();if(res?.ok!==false)officeEmit();return res||{ok:true};};
let release=null;let restoring=new Promise(resolve=>{release=resolve;});
let configured=null;const ready=new Promise(resolve=>{configured=resolve;});
const emit=()=>{for(const fn of listeners){try{fn(auth);}catch{}}};
const echo=(req,extra)=>({ok:true,requestId:req.requestId,accountGeneration:req.accountGeneration,...extra});
const invite=(req,destination)=>inviteMode==='fail'?{ok:false,code:'INVALID_INPUT',requestId:req.requestId,accountGeneration:req.accountGeneration}:echo(req,{state:'received',destination,keepOpen:true});
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>{await ready;return {...env};},
  getClients:async()=>[],
  authStatus:async()=>{await restoring;return auth;},
  onAuthChanged:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},
  onClientsChanged:()=>()=>{},onClientProgress:()=>()=>{},onOpenView:()=>()=>{},
  getWindowState:async()=>({maximized:false}),onWindowStateChanged:()=>()=>{},
  windowAction:async action=>{calls.push('window:'+action);return {ok:true};},
  authSignIn:async()=>{calls.push('signIn');auth={configured:true,status:'signing-in',signedIn:false,sessionGeneration:auth.sessionGeneration+1,accountGeneration:GUEST_GEN};emit();return {ok:true};},
  authSignUp:async()=>{calls.push('signUp');return {ok:true};},
  authCancelSignIn:async()=>{calls.push('cancelSignIn');auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1,accountGeneration:GUEST_GEN};emit();return {ok:true};},
  authSignOut:async()=>{calls.push('signOut');auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1,accountGeneration:GUEST_GEN};emit();return {ok:true,serverRevoked:true,serverSessionRevoked:true};},
  accountRequest:async(operation,params)=>{calls.push(operation+(params?.outcome?':'+params.outcome:'')+(params?.session_id?':'+params.session_id:''));if(operation==='completePurposeOnboarding')return {ok:true};if(operation==='load')return {ok:true};
    if(operation==='revokeAll'){auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1,accountGeneration:GUEST_GEN};setTimeout(emit,0);return {ok:true};}
    if(auth.signedIn===true&&Object.hasOwn(accountOps,operation))return accountOps[operation](params);return {ok:false,error:{code:'QA_OPERATION_DISABLED'}};},
  accountIdentity:async()=>{calls.push('identity');if(auth.signedIn!==true)return {ok:false,error:{code:'AUTH_REQUIRED'}};return {ok:true,email:'member@example.com',newEmail:null,createdAt:'2026-03-02T00:00:00Z',identities:[{provider:'email'},{provider:'google'}]};},
  authSecurity:async section=>{calls.push('security:'+section);return {ok:true};},
  resolveCompanyEntryDestinations:async req=>{calls.push('resolve');return echo(req,{result:assignment});},
  openAssignedCompanyDestination:async req=>{calls.push('open:'+req.destination);return echo(req,{destination:req.destination});},
  cancelCompanyEntry:async()=>null,
  inspectCompanyInviteCode:async req=>{calls.push('invite-code');return invite(req,'/');},
  handoffCompanyInviteLink:async req=>{calls.push('invite-link');return invite(req,'/');},
  openPulseAppInvite:async req=>{calls.push('invite-pulse');return invite(req,'/pulse-app/');},
  authSignUpUrl:undefined,
  getDesktopPreferences:async()=>{calls.push('prefs-get');return prefSnap();},
  updateDesktopPreferences:async patch=>{calls.push('prefs-update:'+JSON.stringify(patch));return prefUpdate(patch);},
  onDesktopPreferences:fn=>{prefListeners.add(fn);return ()=>prefListeners.delete(fn);},
  draftRecoveryStatus:async owner=>{calls.push('drafts-status');return draftStatus(owner);},
  setDraftRecoveryEnabled:async(value,owner)=>{calls.push('drafts-set:'+value);if(!owner||auth.signedIn!==true)return {ok:false,available:true,code:'AUTH_REQUIRED'};drafts={enabled:value===true};setTimeout(()=>tell(draftListeners,{}),0);return draftStatus(owner);},
  onDraftRecoveryChanged:fn=>{draftListeners.add(fn);return ()=>draftListeners.delete(fn);},
  draftRecoveryLoad:async()=>({ok:true,enabled:drafts.enabled,draft:null}),
  draftRecoverySave:async()=>({ok:true}),
  draftRecoveryClear:async()=>({ok:true}),
  updateStatus:async()=>{calls.push('update-status');return {...update};},
  checkForUpdate:async()=>{calls.push('update-check');setTimeout(()=>setUpdate({state:'current',code:null}),300);return setUpdate({state:'checking',code:null});},
  downloadUpdate:async()=>{calls.push('update-download');return setUpdate({state:'downloading',progress:35});},
  installUpdate:async()=>{calls.push('update-install');return setUpdate({state:'opening'});},
  onUpdateChanged:fn=>{updateListeners.add(fn);return ()=>updateListeners.delete(fn);},
  careNotifications:Object.freeze({
    status:async()=>{calls.push('care-status');return careStatus();},
    configure:async patch=>{calls.push('care-configure:'+JSON.stringify(patch));if(auth.signedIn!==true)return {ok:false,available:true,code:'AUTH_REQUIRED'};care={...care,...patch};const value=careStatus();setTimeout(()=>tell(careListeners,value),0);return value;},
    test:async()=>({ok:false,code:'TEST_RATE_LIMITED'}),
    onChanged:fn=>{careListeners.add(fn);return ()=>careListeners.delete(fn);},
  }),
  copyPlatformDiagnostics:async summary=>{calls.push('diag-copy');diag=summary;return {ok:true};},
  // 트레이 목록은 본체가 짓는다(PC 0.5.0 설계 1절). 화면이 부르면 흐름 시험 9번이 잡도록 남긴 덫이다
  setTrayShortcuts:async items=>{tray=items;return {ok:true};},
  // 본체(main.cjs subscriptionCall)처럼 계정이 signed-in이 아니면 구독 호출을 거절한다(Fable 다시 검수 -c)
  subscriptions:Object.freeze({
    snapshot:async()=>{calls.push('subs-snapshot');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};if(subsFail>0){subsFail--;return {ok:false,code:'BOARD_BUSY'};}return subs||{ok:false,code:'READ_FAILED'};},
    check:async ids=>{calls.push(Array.isArray(ids)?'subs-check:'+ids.join(','):'subs-check');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};if(checkResult)return checkResult;return subs?{...subs,seq:(subs.seq||1)+1,check:{...(subs.check||{}),at:Date.now()}}:{ok:false,code:'READ_FAILED'};},
    onChanged:fn=>{subsListeners.add(fn);return ()=>subsListeners.delete(fn);},
    save:async patch=>{calls.push('subs-save:'+JSON.stringify(patch));if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return nextSubs(b=>{if(patch?.remove)b.rows=b.rows.filter(x=>x.id!==patch.remove);if(patch?.row)b.rows=b.rows.map(x=>x.id===patch.row.id?{...x,...patch.row}:x);if(patch?.add)b.rows.push({id:'m-'+(subsSeq+1),source:'manual',...patch.add});if(patch?.settings)b.settings={...(b.settings||{}),...patch.settings};});},
    login:async(service,options)=>{calls.push('subs-login:'+service+(options?.console?':console':'')+(options?.email?':'+options.email:''));return {ok:true,id:'l-qa'};},
    cancel:async id=>{calls.push('subs-cancel:'+id);return {ok:true};},
    useExisting:async service=>{calls.push('subs-existing:'+service);return {ok:false,code:'NOT_LOGGED_IN'};},
    install:async service=>{calls.push('subs-install:'+service);return {ok:true};},
    help:async key=>{calls.push('subs-help:'+key);return {ok:true};},
    connectKey:async(service,key,options)=>{
      calls.push('subs-key:'+service+(options?.replace?':'+options.replace:''));
      return key==='orb-qa-accepted-key'?{ok:true}:{ok:false,code:'INVALID_KEY'};
    },
    submitCode:async id=>{calls.push('subs-code:'+id);return {ok:true};},
    openLoginUrl:async id=>{calls.push('subs-open-url:'+id);return {ok:true};},
    tokens:async()=>{calls.push('subs-tokens');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return tokens;},
    tokensScan:async options=>{calls.push('subs-tokens-scan:'+(options?.force?'force':'soft'));if(!tokens.enabled)return tokens;return options?.force?nextTokens({scanning:true}):tokens;},
    tokensEnable:async on=>{calls.push('subs-tokens-enable:'+on);const next=on?nextTokens({enabled:true,scanning:true,scannedAt:null,progress:{done:0,total:40},cells:[],live:false}):nextTokens({enabled:false,scanning:false,scannedAt:null,progress:null,cells:[],live:false});emitTokens();return next;},
    tokensLive:async on=>{calls.push('subs-tokens-live:'+on);return tokens.enabled?nextTokens({live:on===true}):tokens;},
    onTokens:fn=>{tokenListeners.add(fn);return ()=>tokenListeners.delete(fn);},
  }),
  // 본체(main.cjs siteVisitsCall)처럼 로그인한 회원에게만 답한다. 정하지 않으면 볼 계정이 아닌 답(available:false)이다
  siteVisits:Object.freeze({snapshot:async()=>{calls.push('visits-snapshot');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return visits||{ok:true,available:false};}}),
  // 계정 건강(main.cjs snsHealthCall)도 같다. 정하지 않으면 볼 계정이 아닌 답이다
  snsHealth:Object.freeze({snapshot:async()=>{calls.push('health-snapshot');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return health||{ok:true,available:false};}}),
  // 솔리오 백업(main.cjs solioBackupCall)도 같다. 정하지 않으면 실제 입구가 없는 계정의 답이다. 단추는 부른 것만 적는다
  solioBackup:Object.freeze({
    snapshot:async()=>{calls.push('backup-snapshot');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return backup||{ok:true,available:false};},
    start:async mode=>{calls.push('backup-start:'+mode);return {ok:true};},
    open:async topic=>{calls.push('backup-open:'+topic);return {ok:true};},
    dismiss:async()=>{calls.push('backup-dismiss');return {ok:true};},
  }),
  // 솔리오 「사무실」(main.cjs synk:office-*). 로그인한 회원에게만 답하고, 정하지 않으면 볼 계정이 아닌 답이다
  office:Object.freeze({
    snapshot:async()=>{calls.push('office-snapshot');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return officeSnap();},
    watch:async on=>{calls.push('office-watch:'+(on===true));return officeGate()||{ok:true,watching:on===true};},
    saveDepartment:async input=>{calls.push('office-save:'+JSON.stringify(input));return officeChange(()=>{
      const name=String(input?.name||'').trim(),id=input?.id??null,list=office.departments||(office.departments=[]);
      if(!name||[...name].length>20)return {ok:false,code:'NAME'};
      if(list.some(d=>d.id!==id&&d.name.toLowerCase()===name.toLowerCase()))return {ok:false,code:'NAME_TAKEN'};
      let folder;
      if(input?.folder==='choose'){if(office.cancelChoose)return {ok:false,code:'CANCELLED'};folder='C:\\qa\\고른 폴더\\'+name;}
      else if(input?.folder&&typeof input.folder==='object'){const spec=(office.sessions||[]).find(s=>s.id===input.folder.fromSession);if(!spec?.cwd)return {ok:false,code:'NOT_FOUND'};folder=spec.cwd;}
      else if(input?.folder===undefined&&id!==null){const d=list.find(x=>x.id===id);if(!d)return {ok:false,code:'NOT_FOUND'};folder=d.folder;}
      else return {ok:false,code:'VALUE'};
      if(id!==null){const d=list.find(x=>x.id===id);if(!d)return {ok:false,code:'NOT_FOUND'};d.name=name;d.folder=folder;}
      else{if(list.length>=24)return {ok:false,code:'LIMIT'};list.push({id:'qd'+(++officeSeq).toString().padStart(3,'0'),name,folder});}
      return {ok:true};});},
    removeDepartment:async id=>{calls.push('office-remove:'+id);return officeChange(()=>{const list=office.departments||[],at=list.findIndex(d=>d.id===id);if(at<0)return {ok:false,code:'NOT_FOUND'};list.splice(at,1);for(const [k,v] of Object.entries(office.assignments||{}))if(v===id)delete office.assignments[k];return {ok:true};});},
    assign:async(sessionId,departmentId)=>{calls.push('office-assign:'+sessionId+':'+departmentId);return officeChange(()=>{if(!(office.sessions||[]).some(s=>s.id===sessionId))return {ok:false,code:'NOT_FOUND'};office.assignments={...(office.assignments||{})};if(departmentId===null)delete office.assignments[sessionId];else office.assignments[sessionId]=departmentId;return {ok:true};});},
    saveSettings:async patch=>{calls.push('office-settings:'+JSON.stringify(patch));return officeChange(()=>{office.settings={...(office.settings||{}),...patch};return {ok:true};});},
    addRoot:async()=>{calls.push('office-root-add');return officeChange(()=>{const r=office.roots||(office.roots={claude:[],codex:[],added:[]}),dir='C:\\qa\\.claude-work';if(r.added.includes(dir))return {ok:true};r.added.push(dir);r.claude.push(dir);return {ok:true};});},
    removeRoot:async dir=>{calls.push('office-root-remove:'+dir);return officeChange(()=>{const r=office.roots;if(!r?.added?.includes(dir))return {ok:false,code:'NOT_FOUND'};r.added=r.added.filter(d=>d!==dir);r.claude=r.claude.filter(d=>d!==dir);return {ok:true};});},
    seen:async departmentId=>{calls.push('office-seen:'+departmentId);return officeChange(()=>{const t=Date.now();for(const spec of office.sessions||[])if(spec.kind==='done'&&officeDeptOf(spec)===(departmentId??null))officeSeen[spec.id]=t;return {ok:true};});},
    onChanged:fn=>{officeListeners.add(fn);return ()=>officeListeners.delete(fn);},
  }),
}));
contextBridge.exposeInMainWorld('__orbFixture',Object.freeze({
  configure:value=>{if(value?.env)env={...env,...value.env};if(value?.assignment)assignment=value.assignment;if(value?.invite)inviteMode=value.invite;if(value?.subs!==undefined)subs=value.subs;if(value?.subsFail)subsFail=value.subsFail;if(value?.visits!==undefined)visits=value.visits;if(value?.backup!==undefined)backup=value.backup;if(value?.health!==undefined)health=value.health;if(value?.office!==undefined)office=value.office;if(value?.tokens)tokens=value.tokens;configured();},
  // 사무실의 판을 바꾸고 본체처럼 바뀜을 알린다. office()는 지금 판(짧은 꼴)이다
  setOffice:value=>{office=value||null;officeEmit();},
  office:()=>(office?JSON.parse(JSON.stringify(office)):null),
  // 모델별 토큰의 새 판을 알린다(세는 중의 진행, 다 센 판). 순서 번호는 이 창이 붙인다
  setTokens:value=>{nextTokens(value||{});emitTokens();},
  tokens:()=>JSON.parse(JSON.stringify(tokens)),
  // 내 계정의 합성 자료(지금 판)를 읽는다
  account:()=>JSON.parse(JSON.stringify(account)),
  restore:snapshot=>{auth=snapshot;release();emit();},
  // 다음 계정 확인을 붙잡아 둔다(다시 시도 뒤 확인 단계를 보려고). restore가 다시 풀어 준다
  holdAuth:()=>{restoring=new Promise(resolve=>{release=resolve;});},
  setAuth:snapshot=>{auth=snapshot;emit();},
  setAssignment:value=>{assignment=value;},
  // 「다시 읽기」(subs.check)의 답을 정한다. null이면 지금 자료를 새로 읽은 것처럼 돌려준다
  setCheckResult:value=>{checkResult=value||null;},
  setInvite:value=>{inviteMode=value;},
  setSubs:value=>{subs=value;emitSubs();},
  // 지금 구독 자료에 로그인 단계 하나를 얹어 알린다(계정 더하기의 단계를 흉내 낸다)
  setLogin:login=>{nextSubs(b=>{b.login=login||null;});emitSubs();},
  subs:()=>JSON.parse(JSON.stringify(subs)),
  // 방문자 분석 요약의 답을 바꾼다(다음 읽기부터)
  setVisits:value=>{visits=value||null;},
  // 계정 건강 요약의 답을 바꾼다(다음 읽기부터)
  setHealth:value=>{health=value||null;},
  // 솔리오 백업의 답을 바꾼다(다음 읽기부터)
  setBackup:value=>{backup=value||null;},
  // 설정 방: 업데이트 판을 바꿔 알리고, 데스크톱 설정 · 쓰던 글 되살리기 · 복사한 진단 정보를 읽는다
  setUpdate:value=>setUpdate(value||{}),
  prefs:()=>({...prefs}),
  drafts:()=>({...drafts}),
  diag:()=>(diag?JSON.parse(JSON.stringify(diag)):null),
  calls:()=>[...calls],
  tray:()=>JSON.parse(JSON.stringify(tray)),
}));
