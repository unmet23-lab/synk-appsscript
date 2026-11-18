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
  accountRequest:async(operation,params)=>{calls.push(operation+(params?.outcome?':'+params.outcome:''));if(operation==='completePurposeOnboarding')return {ok:true};if(operation==='load')return {ok:true};return {ok:false,error:{code:'QA_OPERATION_DISABLED'}};},
  resolveCompanyEntryDestinations:async req=>{calls.push('resolve');return echo(req,{result:assignment});},
  openAssignedCompanyDestination:async req=>{calls.push('open:'+req.destination);return echo(req,{destination:req.destination});},
  cancelCompanyEntry:async()=>null,
  inspectCompanyInviteCode:async req=>{calls.push('invite-code');return invite(req,'/');},
  handoffCompanyInviteLink:async req=>{calls.push('invite-link');return invite(req,'/');},
  openPulseAppInvite:async req=>{calls.push('invite-pulse');return invite(req,'/pulse-app/');},
  authSignUpUrl:undefined,
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
    tokens:async()=>({ok:true,enabled:false}),tokensScan:async()=>({ok:true,enabled:false}),tokensEnable:async on=>{calls.push('subs-tokens-enable:'+on);return {ok:true,enabled:on===true};},tokensLive:async on=>{calls.push('subs-tokens-live:'+on);return {ok:true};},onTokens:()=>()=>{},
  }),
  // 본체(main.cjs siteVisitsCall)처럼 로그인한 회원에게만 답한다. 정하지 않으면 볼 계정이 아닌 답(available:false)이다
  siteVisits:Object.freeze({snapshot:async()=>{calls.push('visits-snapshot');if(auth.signedIn!==true)return {ok:false,code:'SIGN_IN_REQUIRED'};return visits||{ok:true,available:false};}}),
}));
contextBridge.exposeInMainWorld('__orbFixture',Object.freeze({
  configure:value=>{if(value?.env)env={...env,...value.env};if(value?.assignment)assignment=value.assignment;if(value?.invite)inviteMode=value.invite;if(value?.subs!==undefined)subs=value.subs;if(value?.subsFail)subsFail=value.subsFail;if(value?.visits!==undefined)visits=value.visits;configured();},
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
  calls:()=>[...calls],
  tray:()=>JSON.parse(JSON.stringify(tray)),
}));
