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
let assignment={status:'resolved',destinations:[],unavailable:[]},inviteMode='received',subs=null,subsFail=0,checkResult=null,tray=[],visits=null;
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
const prefListeners=new Set(),draftListeners=new Set(),updateListeners=new Set();
const tell=(set,value)=>{for(const fn of set){try{fn(value);}catch{}}};
const prefSnap=()=>({ok:true,preferences:{...prefs},capabilities:{launchAtLogin:true,globalShortcut:true,tray:true,encryptedDrafts:true}});
// 본체처럼 다른 앱이 잡은 단축키는 거절한다. 시험에서는 Ctrl+Alt+K를 그런 단축키로 친다
const prefUpdate=patch=>{if(patch?.globalShortcut==='Ctrl+Alt+K')return {ok:false,code:'SHORTCUT_UNAVAILABLE'};prefs={...prefs,...patch};const snap=prefSnap();setTimeout(()=>tell(prefListeners,snap),0);return snap;};
const draftStatus=owner=>({ok:true,available:true,enabled:Boolean(owner)&&auth.signedIn===true&&drafts.enabled});
const setUpdate=patch=>{update={...update,...patch};tell(updateListeners,{...update});return {...update};};
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
  copyPlatformDiagnostics:async summary=>{calls.push('diag-copy');diag=summary;return {ok:true};},
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
    connectKey:async(service,_key,options)=>{calls.push('subs-key:'+service+(options?.replace?':'+options.replace:''));return {ok:false,code:'INVALID_KEY'};},
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
}));
contextBridge.exposeInMainWorld('__orbFixture',Object.freeze({
  configure:value=>{if(value?.env)env={...env,...value.env};if(value?.assignment)assignment=value.assignment;if(value?.invite)inviteMode=value.invite;if(value?.subs!==undefined)subs=value.subs;if(value?.subsFail)subsFail=value.subsFail;if(value?.visits!==undefined)visits=value.visits;if(value?.tokens)tokens=value.tokens;configured();},
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
  // 설정 방: 업데이트 판을 바꿔 알리고, 데스크톱 설정 · 쓰던 글 되살리기 · 복사한 진단 정보를 읽는다
  setUpdate:value=>setUpdate(value||{}),
  prefs:()=>({...prefs}),
  drafts:()=>({...drafts}),
  diag:()=>(diag?JSON.parse(JSON.stringify(diag)):null),
  calls:()=>[...calls],
  tray:()=>JSON.parse(JSON.stringify(tray)),
}));
