'use strict';
// 회사 공통 진입 · 회사 창 preload. contextIsolation과 sandbox 아래에서 돌며 페이지에 API를 내보내지 않는다.
// 고정 두 문서에는 메서드 없는 표시 window.synkCompanyEntryHost = {version:1} 하나만 맨 먼저 내보인다. 회사 문서는 이 표시가
// 있을 때만 자동 OAuth 이동 전에 첫 handshake를 최대 15초 기다린다(회사 담당과의 합의). 신원이나 권한의 증명이 아니다.
// 원문: .tmp/solio-quality-20261114/company-entry-native-addendum.md 1~3절, company-entry-contract-v1.md 3절.
// - 고정 회사 최상위 문서 두 개에서만 움직인다. receiver = https://workspace.synk.im/entry/, employee = https://workspace.synk.im/ (쿼리·조각 없음).
// - 같은 window, 정확한 회사 origin, capability(data-synk-company-entry="1"), 기대 role을 모두 확인한 ready와 main의 offer가 있어야 bind를 보낸다.
// - phase는 문서 역할에서만 정한다(receiver → classify, employee → deliver). 페이지나 IPC 입력으로 고르지 않는다.
// - 토큰은 bound를 확인한 뒤 commit을 한 번만 요청해 받고, offer 메시지 하나에 실어 보낸 즉시 버린다.
// - pagehide에서 현재 documentId와 준비 상태를 지운다. 오류 원문과 토큰은 어디에도 기록하지 않는다(console을 쓰지 않는다).
// - receiver가 토큰을 받은 뒤 보낸 분류 실패만 그 원인을 main에 싣는다. code와 retryable이 정해진 짝(INVITE_REJECTED와 false,
//   RATE_LIMITED와 true, TEMPORARY_UNAVAILABLE과 true)일 때만 싣고, 그 밖의 오류와 employee의 오류는 원인 없는 not-received다.
const COMPANY_ORIGIN='https://workspace.synk.im';
const HOST_MARKER='synkCompanyEntryHost';
const CHANNEL='synk.company.entry';
const CAPABILITY='data-synk-company-entry';
const ROLES=new Map([['https://workspace.synk.im/entry/','receiver'],['https://workspace.synk.im/','employee']]);
const PHASES=Object.freeze({receiver:'classify',employee:'deliver'});
const IPC=Object.freeze({offer:'synk:company-invite-offer',commit:'synk:company-invite-commit',result:'synk:company-invite-result'});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HANDOFF_ID=/^[A-Za-z0-9_-]{32}$/;
const TOKEN=/^[A-Za-z0-9_-]{16,200}$/;
const ERROR_CODES=new Set(['INVALID_INPUT','INVITE_REJECTED','TEMPORARY_UNAVAILABLE','RATE_LIMITED','ACCOUNT_CHANGED','ACCOUNT_MISMATCH','BUSY','CANCELLED','HANDOFF_TIMEOUT','HANDOFF_UNAVAILABLE']);
// receiver의 분류 실패 중 main에 원인으로 싣는 code와 retryable의 정확한 짝(company-entry.cjs CLASSIFY_FAILURES와 같다).
const CLASSIFY_FAILURES=new Map([['INVITE_REJECTED',false],['RATE_LIMITED',true],['TEMPORARY_UNAVAILABLE',true]]);
const HEAD=['channel','version','type'];
const KEYS=Object.freeze({
  ready:[...HEAD,'documentId','documentRole'],
  bound:[...HEAD,'requestId','accountGeneration','documentId','phase'],
  classified:[...HEAD,'requestId','accountGeneration','documentId','kind','destination'],
  received:[...HEAD,'requestId','accountGeneration','documentId','kind','destination','state'],
  error:[...HEAD,'requestId','accountGeneration','documentId','code','retryable'],
});
const CLASSIFIED=new Map([['employee','/'],['customer','/pulse-app/']]);

function plain(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
function exact(value,keys){
  if(!plain(value))return false;
  if(Reflect.ownKeys(value).length!==keys.length)return false;
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!('value' in descriptor))return false;}
  return true;
}
const uuid=value=>typeof value==='string'&&UUID.test(value);

function installCompanyEntryPreload({ipcRenderer,contextBridge,window:win}={}){
  if(!ipcRenderer||!win)return null;
  let expectedUrl=null;
  try{if(win.top===win&&ROLES.has(win.location.href))expectedUrl=win.location.href;}catch{expectedUrl=null;}
  if(!expectedUrl)return null;
  // 리스너보다 먼저 표시를 내보인다. 페이지 스크립트는 preload 뒤에 돌므로 첫 줄부터 이 표시를 본다.
  if(contextBridge&&typeof contextBridge.exposeInMainWorld==='function'){try{contextBridge.exposeInMainWorld(HOST_MARKER,Object.freeze({version:1}));}catch{}}
  const role=ROLES.get(expectedUrl),phase=PHASES[role];
  // 한 문서에 offer는 하나만 받는다. 나머지 상태는 그 offer와 문서 수명에 묶인다.
  let offerSeen=false,offer=null,documentId=null,bind=null,commitStarted=false,committed=null,aborted=false,finished=false,life=0;

  const topDocument=()=>{try{return win.top===win&&win.location.href===expectedUrl;}catch{return false;}};
  const capable=()=>{try{return win.document.documentElement.getAttribute(CAPABILITY)==='1';}catch{return false;}};
  const post=message=>{try{win.postMessage(message,COMPANY_ORIGIN);return true;}catch{return false;}};

  // main에 결과를 한 번 보낸다. documentId는 commit 전 실패에만 null이다.
  function report(outcome,reportedDocumentId,extra){
    if(!offer||finished)return;
    finished=true;
    const payload={id:offer.id,requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId:reportedDocumentId,outcome,...extra};
    offer=null;bind=null;committed=null;
    try{ipcRenderer.send(IPC.result,payload);}catch{}
  }

  function bindIfReady(){
    if(!offer||finished||bind||documentId===null)return;
    if(!topDocument()||!capable()){report('unavailable',null);return;}
    bind={requestId:offer.requestId,accountGeneration:offer.accountGeneration,documentId,phase};
    if(!post({channel:CHANNEL,version:1,type:'bind',requestId:bind.requestId,accountGeneration:bind.accountGeneration,documentId:bind.documentId,phase:bind.phase,expectedAccountId:offer.expectedAccountId}))report('unavailable',null);
  }

  function onOffer(event,payload){
    // main만 보낸다. 다른 renderer가 보낸 흔적(senderId)이 있으면 받지 않는다.
    if(offerSeen||(event&&event.senderId))return;
    if(!exact(payload,['id','requestId','accountGeneration','expectedAccountId']))return;
    const {id,requestId,accountGeneration,expectedAccountId}=payload;
    if(typeof id!=='string'||!HANDOFF_ID.test(id)||!uuid(requestId)||!uuid(accountGeneration)||(expectedAccountId!==null&&!uuid(expectedAccountId)))return;
    offerSeen=true;
    offer={id,requestId,accountGeneration,expectedAccountId};
    if(!topDocument()){report('unavailable',null);return;}
    bindIfReady();
  }

  function onReady(message){
    // documentId는 이 문서 수명에 고정한다. 첫 정확한 ready만 받는다.
    if(documentId!==null||!exact(message,KEYS.ready)||!uuid(message.documentId)||message.documentRole!==role)return;
    if(!topDocument()||!capable())return;
    documentId=message.documentId;
    bindIfReady();
  }

  async function onBound(message){
    if(!bind||commitStarted||finished||!exact(message,KEYS.bound))return;
    if(message.requestId!==bind.requestId||message.accountGeneration!==bind.accountGeneration||message.documentId!==bind.documentId||message.phase!==bind.phase)return;
    if(!topDocument()||!capable()){report('unavailable',null);return;}
    commitStarted=true;
    const started=life,request={id:offer.id,requestId:bind.requestId,accountGeneration:bind.accountGeneration,documentId:bind.documentId};
    let response=null;
    try{response=await ipcRenderer.invoke(IPC.commit,request);}catch{response=null;}
    const accepted=exact(response,['id','requestId','accountGeneration','documentId','token'])&&response.id===request.id&&response.requestId===request.requestId&&response.accountGeneration===request.accountGeneration&&response.documentId===request.documentId&&typeof response.token==='string'&&TOKEN.test(response.token);
    let token=accepted?response.token:null;
    response=null;
    // 기다리는 사이 문서가 숨겨졌거나 결과를 이미 보냈으면 토큰을 버린다(pagehide가 결과를 보냈다).
    if(started!==life||finished){token=null;return;}
    if(!accepted){report('not-received',null);return;}
    if(aborted||!topDocument()||!capable()||documentId!==request.documentId){token=null;report('not-received',request.documentId);return;}
    committed=request.documentId;
    const sent=post({channel:CHANNEL,version:1,type:'offer',requestId:request.requestId,accountGeneration:request.accountGeneration,documentId:request.documentId,token});
    token=null;
    if(!sent)report('not-received',request.documentId);
  }

  const sameCommitted=message=>message.requestId===offer.requestId&&message.accountGeneration===offer.accountGeneration&&message.documentId===committed;

  function onClassified(message){
    // receiver만 classified를 보낸다. 정확한 두 조합만 받는다. 분류는 최종 성공이 아니며 main이 다음 단계를 정한다.
    if(role!=='receiver'||committed===null||finished||!exact(message,KEYS.classified)||!sameCommitted(message))return;
    if(typeof message.kind!=='string'||!CLASSIFIED.has(message.kind)||CLASSIFIED.get(message.kind)!==message.destination||!topDocument())return;
    report('classified',committed,{kind:message.kind,destination:message.destination});
  }

  function onReceived(message){
    // employee의 실제 메모리 큐에 들어간 뒤의 received만 delivered로 바꾼다. receiver는 received를 보내지 않는다.
    if(role!=='employee'||committed===null||finished||!exact(message,KEYS.received)||!sameCommitted(message))return;
    if(message.kind!=='employee'||message.destination!=='/'||message.state!=='queued'||!topDocument())return;
    report('delivered',committed);
  }

  function onError(message){
    if(!bind||finished||!exact(message,KEYS.error)||!ERROR_CODES.has(message.code)||typeof message.retryable!=='boolean')return;
    if(message.requestId!==bind.requestId||message.accountGeneration!==bind.accountGeneration||message.documentId!==bind.documentId)return;
    if(committed!==null){
      // 토큰을 받은 receiver의 분류 실패는 정해진 짝일 때만 그 code와 retryable을 싣는다. 원본 문구나 다른 키는 싣지 않는다.
      // main은 같은 요청, 문서, 프레임, 계정 세대, commit한 documentId인지와 그 짝을 다시 확인한다.
      if(role==='receiver'&&CLASSIFY_FAILURES.get(message.code)===message.retryable&&topDocument())report('classify-failed',committed,{code:message.code,retryable:message.retryable});
      else report('not-received',committed);
      return;
    }
    // commit 응답을 기다리는 중이면 응답이 온 뒤 토큰을 보내지 않고 끝낸다.
    if(commitStarted){aborted=true;return;}
    report('not-received',null);
  }

  function onPageHide(){
    life+=1;
    if(offer&&!finished){
      if(committed!==null)report('not-received',committed);
      else if(commitStarted&&bind)report('not-received',bind.documentId);
      else report('not-received',null);
    }
    documentId=null;offer=null;bind=null;committed=null;commitStarted=false;aborted=false;
  }

  win.addEventListener('message',event=>{
    try{
      if(!event||event.source!==win||event.origin!==COMPANY_ORIGIN)return;
      const message=event.data;
      if(!plain(message)||message.channel!==CHANNEL||message.version!==1)return;
      if(message.type==='ready')onReady(message);
      else if(message.type==='bound')onBound(message).catch(()=>{});
      else if(message.type==='classified')onClassified(message);
      else if(message.type==='received')onReceived(message);
      else if(message.type==='error')onError(message);
      // bind, offer, cancel은 이 preload가 보내는 쪽이므로 받지 않는다.
    }catch{}
  });
  win.addEventListener('pagehide',onPageHide);
  ipcRenderer.on(IPC.offer,onOffer);
  return Object.freeze({role});
}

// Electron preload에서만 스스로 설치한다. node 시험에서 require('electron')은 실행 파일 경로 문자열이거나 없다.
(function install(){
  if(typeof window==='undefined')return;
  let electron=null;
  try{electron=require('electron');}catch{return;}
  if(!electron||typeof electron!=='object'||!electron.ipcRenderer)return;
  installCompanyEntryPreload({ipcRenderer:electron.ipcRenderer,contextBridge:electron.contextBridge,window});
})();

if(typeof module==='object'&&module&&module.exports)module.exports={installCompanyEntryPreload};
