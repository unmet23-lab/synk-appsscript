// WORLD 학습 알림 2단 — 이 브라우저의 서버 푸시 구독(앱을 닫아도 받기, 설계 qa/push-reminders-20261022/설계.md).
// 무엇을 언제 보낼지는 서버가 1단과 같은 계획기 사본으로 정한다. 여기서는 이 브라우저의 구독을 만들고 지우고, 계정의 2단 상태를 읽고,
// 1단 기기 쪽(world-reminder-device.mjs)이 만든 요약을 서버(SYNK-talk world-push 함수)에 보낸다. 서비스 워커는 world-push-sw.js다
// (가져오기를 가로채지 않고 페이지·학습 기록·토큰을 저장하지 않는다). 글은 없다 — 화면 글은 기기 쪽이 까닭 코드로 고른다.
// · 권한 창은 「동의하고 켜기」를 누른 그 동작 안에서 pushManager.subscribe로만 연다(사파리는 그 동작 밖이면 창이 안 뜬다). 그래서 등록과
//   서버 공개 키는 설정을 열 때 미리 준비한다(ready). 응답 없는 권한 창은 30초 뒤 기다리지 않고, 늦게 허용된 구독은 지운다(Care 꼴).
// · 이 브라우저의 구독 주인은 localStorage synk.world.push.v1({accountId, deviceId, endpoint})에 둔다 — 로그인이 풀린 탭에서도 끌 수 있게
//   (서버는 주소 + 기기 식별자가 맞으면 지운다). 다른 계정으로 로그인만 해서는 지우지 않는다(WORLD 로그인은 탭마다라 두 탭이 다른 계정일 수 있다).
//   다른 계정이 켜면 그 동작에서 앞 계정의 이 브라우저 구독을 지우고 가져간다(브라우저 구독은 하나뿐이다).
export const PUSH_RECORD_KEY='synk.world.push.v1';
const PERMISSION_WAIT_MS=30000,REQUEST_MS=12000,SYNC_GAP_MS=5*60000,SYNC_REFRESH_MS=6*3600000;
// 쓰기 판(SYNK-appsscript 단계4_계획 §24-6의 5, 설계 주인 11-21 「이대로 짓는다」): 이 브라우저에서 매긴 가장 큰 판과 이 계정의 설정 판을
// localStorage synk.world.push.versions.v1.<계정>({issued, settings, dirtyAt})에 둔다(탭이 함께 쓴다). 학습 자료는 두지 않는다.
export const PUSH_VERSION_KEY='synk.world.push.versions.v1';
const CLOCK_JUMP_MS=2000,REMEASURE_MS=5*60000,RETRY_MS=[15000,60000,5*60000,30*60000];

// 이 기기에서 앱을 닫은 채 받을 수 있는지. 아이폰·아이패드는 홈 화면 웹앱만 되는데 WORLD는 아직 매니페스트를 두지 않아(설계 §10-1) 늘 안 된다.
export function worldPushSupport(env=globalThis){
 const nav=env.navigator||{},ua=nav.userAgent||'';
 if(typeof env.synkDesktop?.accountRequest==='function')return {supported:false,reason:'desktop'};
 const ios=/iPad|iPhone|iPod/.test(ua)||/Macintosh/.test(ua)&&Number(nav.maxTouchPoints)>1;
 const standalone=nav.standalone===true||env.matchMedia?.('(display-mode: standalone)')?.matches===true;
 if(ios&&!(standalone&&env.PushManager))return {supported:false,reason:'ios'};
 if(env.isSecureContext===false||!nav.serviceWorker||!env.PushManager||!env.Notification)return {supported:false,reason:'unsupported'};
 if(!deviceTimeZone(env))return {supported:false,reason:'unsupported'};
 let permission='default';try{permission=env.Notification.permission||'default';}catch{}
 return {supported:true,reason:permission==='denied'?'blocked':'ok',permission};
}
// 기기 시간대 이름(IANA). 못 주는 기기는 정수 시간 오프셋을 Etc/GMT±N으로(부호가 거꾸로다 — 서울 +9는 Etc/GMT-9). 30·45분이면 없다.
export function deviceTimeZone(env=globalThis){
 try{const zone=new Intl.DateTimeFormat().resolvedOptions().timeZone;if(typeof zone==='string'&&/^(?:UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/.test(zone))return zone;}catch{}
 const minutes=-new (env.Date||Date)().getTimezoneOffset();
 if(!Number.isInteger(minutes)||minutes%60)return null;
 return minutes===0?'UTC':`Etc/GMT${minutes>0?'-':'+'}${Math.abs(minutes/60)}`;
}
// 서버 VAPID 공개 키(base64url 87자 = 65바이트, 0x04로 시작) → applicationServerKey.
export function decodeVapidKey(value,decode=globalThis.atob){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(value))throw Object.assign(Error('PUSH_KEY'),{code:'PUSH_KEY'});
 const bytes=Uint8Array.from(decode(value.replace(/-/g,'+').replace(/_/g,'/')+'='),char=>char.charCodeAt(0));
 if(bytes.length!==65||bytes[0]!==4)throw Object.assign(Error('PUSH_KEY'),{code:'PUSH_KEY'});
 return bytes;
}
// 마지막으로 보낸 요약의 표: 무엇(key) · 언제(at) · 마지막으로 공부한 날(day) · 보낸 줄(rows) — day·rows가 바뀌면 모으지 않고 바로 보낸다.
// known: 복습 때를 실었나(새 길 판정이 「확인 중」이면 그 칸을 뺀다 — 4-8 §24-2). 모르던 요약 뒤 처음 아는 요약도 바로 보낸다(서버가 옛 때를 쥐고 있다).
const syncMark=(item,at)=>({key:JSON.stringify(item),at,day:item.digest?.lastStudyDay??null,rows:JSON.stringify(item.handover||[]),known:Array.isArray(item.digest?.reviews)});
const bounded=(promise,ms=REQUEST_MS)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('PUSH_TIMEOUT'),{code:'PUSH_TIMEOUT'})),ms);})]).finally(()=>clearTimeout(timer));};

// request(action, body, {keepalive}): 이 탭의 SYNK ID로 world-push를 부른다(world-account.mjs pushRequest).
// anonymous(action, body, {keepalive}): 로그인 없이(공개 키만) — 누름(opened)과 주소 + 기기 식별자 끄기에만 쓴다.
export function createWorldPush({request,anonymous=()=>Promise.reject(Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'})),env=globalThis,
 storage=env.localStorage,workerUrl,scopeUrl,now=()=>Date.now(),onChange=()=>{}}={}){
 let owner=null,epoch=0,registration=null,subscription=null,publicKey=null,attempt=null,mutation=null,disposed=false,syncTimer=null,pendingSync=null,lastSync=null,syncSeq=0,appliedSeq=0;
 // 판: 서버 시계와의 차이(offset)와 그 재기의 왕복 · 기기 시계 닻 · 잰 때. 1단 설정 묶음(binding — world-reminder-device가 건다).
 // owed: 아직 서버가 받지 않은 것(설정 · 요약) — 받을 때까지 다시 보낸다(retryTimer, RETRY_MS 간격). inflight: 진행 중인 요청 수.
 let offset=null,bestRtt=Infinity,anchorAt=null,measuredAt=-Infinity,aheadAt=-Infinity,binding=null,retryTimer=null,retryStep=0,inflight=0,owed={settings:false,digest:null},flying={settings:0,digests:new Set()};
 const listeners=new Set([onChange]);
 let state={phase:'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false,versions:null,versioning:false};
 const emit=patch=>{state={...state,...patch};const value=snapshot();for(const listener of listeners){try{listener(value);}catch{}}return value;};
 // publicReady: 서비스 워커가 떠 있고 서버 공개 키를 받아 「동의하고 켜기」가 그 동작 안에서 바로 subscribe를 부를 수 있다.
 const snapshot=()=>({...state,support:worldPushSupport(env),owner,waiting:!!attempt,publicReady:!!registration&&!!publicKey&&!state.busy});
 const current=expected=>expected===epoch&&!!owner&&!disposed;
 const guard=expected=>{if(!current(expected))throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 const readRecord=()=>{try{const value=JSON.parse(storage?.getItem(PUSH_RECORD_KEY)||'null');return value&&typeof value.accountId==='string'&&typeof value.deviceId==='string'&&typeof value.endpoint==='string'?value:null;}catch{return null;}};
 const writeRecord=value=>{try{value?storage?.setItem(PUSH_RECORD_KEY,JSON.stringify(value)):storage?.removeItem(PUSH_RECORD_KEY);}catch{}};
 // ── 쓰기 판(단계4 계획 §24-6의 5, 설계 주인 11-21) ──
 // 서버는 설정 · 요약 · 복습 때마다 판이 더 클 때만 쓴다(talk world-push). 판 = max(서버 시계로 맞춘 지금, 이 브라우저에서 매긴 가장 큰 판 + 1,
 // 서버가 알려 준 판 + 1). 서버 시계와의 차이를 안 뒤에만 매기고, 판을 모르는 서버(응답에 serverTime 없음)에는 싣지 않는다 — 그 서버는 versions를
 // 400으로 거절한다. 판이 같은 두 탭은 서버가 앞의 것만 받고, 뒤의 탭은 응답의 설정을 들인다(reconcile).
 const versionKey=()=>`${PUSH_VERSION_KEY}.${owner}`;
 const readVersions=()=>{try{const value=JSON.parse(storage?.getItem(versionKey())||'null');const pos=v=>Number.isSafeInteger(v)&&v>0?v:null;
  return {issued:pos(value?.issued)||0,settings:pos(value?.settings),dirtyAt:Number.isFinite(value?.dirtyAt)?value.dirtyAt:null};}catch{return {issued:0,settings:null,dirtyAt:null};}};
 const writeVersions=patch=>{try{storage?.setItem(versionKey(),JSON.stringify({...readVersions(),...patch}));}catch{}};
 const serverVersions=data=>{const v=data?.versions,n=x=>Number.isSafeInteger(x)&&x>0?x:null;return v&&typeof v==='object'?{settings:n(v.settings),digest:n(v.digest),reviews:n(v.reviews)}:null;};
 // 기기 시계 닻: 지금 - performance.now(). 기기 시계를 바꾸면(또는 휴대폰이 잠든 동안 performance.now()가 멈추면) 움직인다.
 const clockAnchor=()=>{try{const value=env.performance?.now?.();return Number.isFinite(value)?now()-value:null;}catch{return null;}};
 // 서버 시계와의 차이: (보낸 때 + 받은 때) / 2와 서버 시각의 차이 가운데 왕복이 가장 짧았던 값. 닻이 2초 넘게 움직였으면 새 값을 쓴다.
 function measure(sentAt,recvAt,serverTime){
  if(!Number.isSafeInteger(serverTime))return;
  const rtt=Math.max(0,recvAt-sentAt),mark=clockAnchor(),moved=anchorAt!==null&&mark!==null&&Math.abs(mark-anchorAt)>CLOCK_JUMP_MS;
  if(offset===null||moved||rtt<=bestRtt){offset=serverTime-Math.round((sentAt+recvAt)/2);bestRtt=rtt;anchorAt=mark;}
  measuredAt=now();
 }
 const timed=(action,body,options)=>{const sentAt=now();return Promise.resolve(request(action,body,options)).then(data=>{measure(sentAt,now(),data?.serverTime);return data;});};
 // 시계가 움직였으면 status로 다시 잰다 — 계정마다 5분에 한 번으로 묶는다(설계 주인 11-21 조건 3: 휴대폰은 깰 때마다 움직인 것으로 보인다).
 function checkClock(){
  const mark=clockAnchor();
  if(anchorAt===null||mark===null||Math.abs(mark-anchorAt)<=CLOCK_JUMP_MS||now()-measuredAt<REMEASURE_MS)return;
  measuredAt=now();void refresh();
 }
 function mint(){
  if(!state.versioning||offset===null)return null;
  checkClock();
  const seen=Math.max(0,...Object.values(state.versions||{}).filter(Number.isSafeInteger)),{issued}=readVersions();
  const value=Math.max(Math.round(now()+offset),issued+1,seen+1);writeVersions({issued:value});return value;
 }
 // 학생이 설정을 바꿨다: 판을 매겨 적는다. 시계 차이를 아직 모르면(상태를 못 읽음 · 판을 모르는 서버) 바꾼 때만 적어 두고, 차이를 안 뒤에 판으로
 // 바꾼다 — 그 판은 「서버 판 + 1」을 붙이지 않는다(그 사이 다른 기기의 쓰기를 본 뒤의 쓰기가 아니다).
 function noteSettings(){
  if(!owner)return;
  const value=mint();
  if(value!==null)writeVersions({settings:value,dirtyAt:null});else writeVersions({settings:null,dirtyAt:now()});
 }
 function settleDirty(){
  const local=readVersions();
  if(local.dirtyAt===null||offset===null||!state.versioning)return local;
  const value=Math.max(Math.round(local.dirtyAt+offset),local.issued+1);writeVersions({issued:value,settings:value,dirtyAt:null});return readVersions();
 }
 // 설정 맞추기: 서버 판이 이 브라우저 판 이상이면 서버 설정을 1단 설정에 들이고(내용이 다를 때만 — 판이 같고 내용이 다른 두 탭도 여기서 맞는다),
 // 이 브라우저 판이 크면 보낸다(보내지 못한 설정 · 상태를 몰랐을 때 바꾼 설정이 다음에 연 때 간다).
 function reconcile(expected){
  if(!binding||!current(expected)||!state.versioning||!state.account.active)return;
  const local=settleDirty(),server=state.versions?.settings??null,plan=state.plan;
  if(server!==null&&(local.settings===null||server>=local.settings)){
   if(plan&&Number.isFinite(plan.frequency)){
    let mine=null;try{mine=binding.read();}catch{}
    if(!mine||mine.frequency!==plan.frequency||mine.hour!==(plan.hour??null)||(Number.isFinite(plan.since)&&mine.since!==plan.since)){try{binding.adopt({frequency:plan.frequency,hour:plan.hour??null,since:plan.since??null});}catch{}}
   }
   if(local.settings!==server)writeVersions({settings:server});
   owed.settings=false;return;
  }
  if(local.settings!==null&&(server===null||local.settings>server)&&!owed.settings){
   let mine=null;try{mine=binding.read();}catch{}
   if(mine){owed.settings=mine;if(inflight===0)deliver(expected);else later(expected);}
  }
 }
 // 보내기: 아직 받히지 않은 설정(1단 설정을 지금 읽는다)과 요약을 한 요청으로 keepalive로 보낸다(닫아도 끊기지 않는다 — 앞 회차).
 // 받았거나 더 새 것이 이미 있으면 끝, 실패하면 RETRY_MS 간격으로 다시 보낸다. 진행 중인 요청이 있으면 다시 보내기는 기다린다(keepalive 몫 64KB).
 // leaving: 떠날 때 — 기다림 없이 fetch까지 가고, 만료 전 토큰은 갱신하지 않고 그대로 쓴다(world-account pushRequest).
 function deliver(expected,{leaving=false,digest=owed.digest,settings=true}={}){
  if(!current(expected)||!state.account.active)return null;
  // 설정은 보낼 때 1단 설정을 새로 읽는다(그 사이 다른 탭이 바꿨을 수 있다). 묶음이 없으면 맡긴 값 그대로.
  let mine=null;if(owed.settings&&settings){if(binding){try{mine=binding.read();}catch{}}mine=mine||(typeof owed.settings==='object'?owed.settings:null);}
  if(!mine&&!digest)return null;
  const versions={},body={};
  if(mine){body.settings={frequency:mine.frequency,hour:mine.hour??null};const v=state.versioning?readVersions().settings:null;if(v!==null)versions.settings=v;}
  if(digest){Object.assign(body,digest.item);if(state.versioning&&digest.version!==null)versions.digest=digest.version;}
  if(Object.keys(versions).length)body.versions=versions;
  const seq=++syncSeq;inflight++;if(mine)flying.settings++;if(digest)flying.digests.add(digest);
  const land=()=>{inflight--;if(mine)flying.settings--;if(digest)flying.digests.delete(digest);};
  clearTimeout(retryTimer);retryTimer=null;
  const run=bounded(timed('sync',body,{keepalive:true,...(leaving?{leaving:true}:{})}));
  run.then(data=>{
   land();if(!current(expected))return;
   // 2단이 꺼진 계정(마지막 기기가 빠짐)이면 더 보낼 곳이 없다 — 다시 보내기를 멈춘다(설계 검토 P2-2).
   if(data?.account?.active!==true)owed={settings:false,digest:null};
   else{
    // 설정이 아직 이 브라우저 판보다 옛것인지는 아래 applyStatus의 맞추기가 본다(그 사이 다른 탭이 더 새 설정을 적었으면 그것을 보낸다).
    // 서버는 판을 깎지 않는다 — 앞선 판은 409 VERSION_AHEAD로 거절하고(아래 오류 갈래), 받으면 보낸 판 그대로 적는다.
    if(mine)owed.settings=false;
    if(digest&&owed.digest===digest)owed.digest=null;
    retryStep=0;
   }
   if(seq>appliedSeq){appliedSeq=seq;applyStatus(data,expected);}
   if(owed.digest)later(expected);
  },error=>{
   land();if(!current(expected))return;
   const status=Number(error?.status),code=error?.code||'PUSH_UNAVAILABLE';
   // 이 브라우저 판이 서버 시각보다 30초 넘게 앞섰다(시계 차이를 잰 뒤 기기 시계가 앞으로 바뀜) — 서버는 거절했다(talk VERSION_AHEAD). 시계를 다시 재고,
   // 받히지 않은 설정은 「지금 바꾼 것」으로 다시 적어 새 판으로 보낸다(맞추기가 보낸다). 앞선 요약은 버린다 — 다음 다시 잡기가 새로 짓는다.
   // 가장 큰 판도 지운다(앞선 값이 남으면 새 판도 앞선다). 1분 안에 또 앞서면 더 하지 않는다(고리를 막는다).
   if(code==='VERSION_AHEAD'){
    if(digest&&owed.digest===digest)owed.digest=null;
    if(now()-aheadAt>=60000){
     aheadAt=now();offset=null;bestRtt=Infinity;anchorAt=null;
     writeVersions({issued:0,...(mine?{settings:null,dirtyAt:now()}:{})});if(mine)owed.settings=false;
     void refresh();
    }
    if(seq>appliedSeq)emit({error:code});
    return;
   }
   // 400 · 413: 그 부분을 버린다(요약이 틀렸으면 설정만 다시). 401 · 로그인: 다시 로그인한 뒤 상태를 읽으면 맞추기가 보낸다.
   if(status===400||status===413){if(code==='INVALID_SETTINGS'||!digest)owed.settings=false;if(digest&&owed.digest===digest)owed.digest=null;if(owed.settings)later(expected,0);}
   else if(status!==401&&code!=='AUTH_REQUIRED')later(expected);
   if(seq>appliedSeq)emit({error:code});
  });
  return run;
 }
 function later(expected,delay){
  if(retryTimer||!current(expected)||!(owed.settings||owed.digest))return;
  const wait=delay??RETRY_MS[Math.min(retryStep,RETRY_MS.length-1)];if(delay===undefined)retryStep++;
  retryTimer=setTimeout(()=>{retryTimer=null;if(!current(expected))return;if(inflight>0){later(expected);return;}deliver(expected);},wait);
 }
 async function existing(){
  if(registration)return registration;
  if(!env.navigator?.serviceWorker?.getRegistration)return null;
  const reg=await bounded(env.navigator.serviceWorker.getRegistration(scopeUrl)).catch(()=>null);
  return reg&&reg.scope===scopeUrl?reg:null;
 }
 async function register(expected){
  const reg=await bounded(env.navigator.serviceWorker.register(workerUrl,{scope:scopeUrl,updateViaCache:'none'}));guard(expected);
  if(!reg.active)await bounded(new Promise((resolve,reject)=>{
   const worker=reg.installing||reg.waiting;if(!worker){reject(Object.assign(Error('PUSH_WORKER'),{code:'PUSH_WORKER'}));return;}
   const change=()=>{if(worker.state==='activated'){worker.removeEventListener('statechange',change);resolve();}else if(worker.state==='redundant'){worker.removeEventListener('statechange',change);reject(Object.assign(Error('PUSH_WORKER'),{code:'PUSH_WORKER'}));}};
   worker.addEventListener('statechange',change);change();
  }));
  guard(expected);registration=reg;return reg;
 }
 // 이 브라우저의 구독을 지운다. unsubscribe가 false를 돌려줘도 실제로 없어졌는지 다시 본다(다른 탭이 먼저 지웠을 수 있다).
 async function removeLocal(sub,reg=registration){
  let removed=!sub;
  if(sub){try{removed=await bounded(sub.unsubscribe());}catch{removed=false;}}
  if(!removed&&reg?.pushManager?.getSubscription){try{removed=(await bounded(reg.pushManager.getSubscription()))===null;}catch{}}
  if(removed&&subscription===sub)subscription=null;
  return removed;
 }
 // 서버 기능이 꺼져 있으면(비상 스위치 — 보내기 회차도 멈춘다) 계정의 2단도 꺼진 것으로 본다: 열린 기기의 1단이 다시 맡는다(설계 §6).
 const accountOf=data=>({active:data.enabled===true&&data.account?.active===true,devices:Number(data.account?.devices)||0});
 function applyStatus(data,expected,phase='ready'){
  guard(expected);
  if(data.enabled===true&&typeof data.publicKey==='string'){try{publicKey=decodeVapidKey(data.publicKey,env.atob||globalThis.atob);}catch{publicKey=null;}}
  else if(data.enabled!==true)publicKey=null;
  // 판: 응답에 서버 시각이 있으면 판을 아는 서버다(그때만 판을 싣는다). 저장된 판은 응답마다 새로 받는다.
  const value=emit({phase,enabled:data.enabled===true&&!!publicKey,device:data.device?.subscribed?{subscribed:true,deviceId:data.device.deviceId}:{subscribed:false},
   account:accountOf(data),plan:data.plan||null,checkedAt:now(),error:null,versions:serverVersions(data),versioning:Number.isSafeInteger(data.serverTime)&&offset!==null});
  reconcile(expected);
  return value;
 }
 // 계정의 2단 상태를 다시 읽는다. 이 브라우저 구독이 이 계정 것인데 서버에 없으면(정리·404·다른 기기에서 로그아웃시킴) 이 브라우저 구독도 지운다.
 // 이 브라우저가 받을 수 없어도(아이폰·푸시 없는 브라우저) 설정을 열 때와 1단이 띄우기 직전에는 계정 상태만 읽는다 — 다른 기기에서 켜 두었으면
 // 1단이 쉬고 설정에 그 기기로 간다고 적는다. 계정이 바뀐 직후(initial)에는 읽지 않는다(받을 수 없는 기기에서 열 때마다 부르지 않게).
 async function refresh({install=false,initial=false}={}){
  const expected=epoch;if(!current(expected))return snapshot();
  const support=worldPushSupport(env);
  if(!support.supported){
   if(initial||support.reason==='desktop')return emit({phase:'unsupported',enabled:false});
   try{const data=await timed('status',{});applyStatus(data,expected,'unsupported');return emit({enabled:false});}
   catch(error){if(current(expected))emit({phase:'unsupported',enabled:false,error:error.code||'PUSH_UNAVAILABLE'});return snapshot();}
  }
  try{
   const reg=install?await register(expected):await existing();guard(expected);
   const sub=reg?await bounded(reg.pushManager.getSubscription()):null;guard(expected);subscription=sub;
   const data=await timed('status',sub?{endpoint:sub.endpoint}:{});
   const next=applyStatus(data,expected),record=readRecord();
   if(sub&&!next.device.subscribed&&record?.accountId===owner&&record.endpoint===sub.endpoint){await removeLocal(sub,reg);writeRecord(null);}
   else if(!sub&&record?.accountId===owner){writeRecord(null);try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}
   return snapshot();
  }catch(error){if(current(expected))emit({phase:state.phase==='ready'?'ready':'error',error:error.code||'PUSH_UNAVAILABLE'});return snapshot();}
 }
 return {
  snapshot,refresh,
  // 상태가 바뀔 때마다 부를 함수(설정 화면의 동의 상자 단추·안내 글). 떼는 함수를 돌려준다.
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  // 이 탭의 계정. 바뀌면 상태를 새로 읽는다(이 브라우저 구독은 지우지 않는다 — 지우는 것은 끄기·로그아웃·다른 계정이 켤 때뿐).
  setAccount(accountId){
   const next=typeof accountId==='string'&&accountId?accountId:null;if(next===owner)return Promise.resolve(snapshot());
   epoch++;owner=next;publicKey=null;lastSync=null;clearTimeout(syncTimer);syncTimer=null;pendingSync=null;
   // 앞 계정의 다시 보내기는 거둔다(그 계정의 설정 판은 그 계정 키에 남아 다음에 그 계정으로 열 때 맞춘다). 시계 차이는 이 브라우저 것이라 둔다.
   clearTimeout(retryTimer);retryTimer=null;retryStep=0;owed={settings:false,digest:null};
   // 앞 계정이 띄운 권한 창 기다리기는 끝낸다(늦게 허용돼도 지운다) — 새 계정이 바로 켤 수 있게.
   if(attempt){attempt.stop();attempt=null;}mutation=null;
   emit({phase:next?'loading':'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false,versions:null,versioning:false});
   return next?refresh({initial:true}):Promise.resolve(snapshot());
  },
  // 설정을 열 때: 서비스 워커를 등록해 두고 공개 키를 받아 둔다(「동의하고 켜기」의 subscribe가 그 동작 안에서 바로 부를 수 있게).
  // 받을 수 없는 기기는 등록하지 않고 계정 상태만 읽는다(다른 기기로 간다는 안내).
  ready(){return owner?refresh({install:worldPushSupport(env).supported}):Promise.resolve(snapshot());},
  // 마지막으로 읽은 상태가 maxAge보다 오래됐으면 다시 읽는다(1단이 띄우기 직전 — 설계 §6-1). 못 읽으면 마지막으로 안 상태.
  async fresh(maxAge=10*60000){if(!owner||state.phase==='signed-out')return snapshot();if(now()-state.checkedAt<=maxAge)return snapshot();return refresh();},
  // 켜기 — 반드시 누른 동작 안에서 부른다. settings·digest·handover는 서버 계획의 시작(설계 §6-3).
  enable({settings,digest,handover=[]}={}){
   const expected=epoch;
   if(!current(expected)||mutation||attempt)return Promise.resolve(snapshot());
   if(!registration||!publicKey)return Promise.resolve(emit({error:'PUSH_NOT_READY'}));
   if(worldPushSupport(env).permission==='denied')return Promise.resolve(emit({error:'PUSH_BLOCKED'}));
   let prompt;
   try{prompt=registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});}
   catch(error){return Promise.resolve(emit({error:error?.name==='NotAllowedError'?'PUSH_DENIED':'PUSH_UNAVAILABLE'}));}
   // 권한 창 기다리기: 30초가 지나거나 계정이 바뀌면(stop) 기다림을 끝내 켜기를 바로 「응답 없음」으로 마치고 단추를 다시 쓸 수 있게 한다.
   // 그 뒤에 허용된 구독은 받는 대로 지운다(10-22 화면 검수 — 끝나지 않는 권한 창에 켜기가 영영 묶였다).
   const STOP=Symbol('stop');let stopWait;
   const waiting={cancelled:false,timer:null,stop:()=>{waiting.cancelled=true;clearTimeout(waiting.timer);stopWait(STOP);}};attempt=waiting;
   const stopped=new Promise(resolve=>{stopWait=resolve;});
   waiting.timer=setTimeout(()=>waiting.stop(),PERMISSION_WAIT_MS);
   Promise.resolve(prompt).then(late=>{if(waiting.cancelled&&late)void removeLocal(late,registration);},()=>{});
   emit({busy:true,error:null});
   let sub=null;
   const pending=(async()=>{
    try{
     const first=await Promise.race([prompt,stopped]);clearTimeout(waiting.timer);
     if(first===STOP)throw Object.assign(Error('PUSH_TIMEOUT'),{code:'PUSH_TIMEOUT'});
     sub=first;
     guard(expected);subscription=sub;
     // 이 브라우저 구독이 다른 계정 것이면 그 동작에서 가져간다(앞 계정의 이 브라우저 구독을 서버에서 지운다).
     const record=readRecord();
     if(record&&record.accountId!==owner&&record.endpoint===sub.endpoint){try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}
     const json=sub.toJSON?sub.toJSON():{endpoint:sub.endpoint,keys:sub.keys};
     // 판을 아는 서버면 판을 싣는다 — 설정은 이 브라우저의 설정 판(없으면 지금 매김), 요약은 지금 매긴 판. 계정에 이미 계획이 있으면(다른 기기)
     // 서버가 설정은 계정 것을 두고 요약만 판으로 견준다.
     let versions=null;
     if(state.versioning){const local=settleDirty();let sv=local.settings;if(sv===null){sv=mint();if(sv!==null)writeVersions({settings:sv});}
      const dv=digest?mint():null;versions={...(sv!==null?{settings:sv}:{}),...(dv!==null?{digest:dv}:{})};if(!Object.keys(versions).length)versions=null;}
     const data=await timed('subscribe',{subscription:{endpoint:json.endpoint,keys:{p256dh:json.keys?.p256dh,auth:json.keys?.auth}},settings,digest,handover,consent:1,...(versions?{versions}:{})});
     guard(expected);
     if(data.device?.subscribed!==true)throw Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'});
     writeRecord({accountId:owner,deviceId:data.device.deviceId,endpoint:sub.endpoint});
     // 켜며 보낸 요약을 sync와 같은 표로 적는다 — 켠 바로 뒤 다시 잡기가 같은 요약을 또 보내지 않게(10-22 화면 검수).
     lastSync=digest?syncMark({digest,...(Array.isArray(handover)&&handover.length?{handover}:{})},now()):null;
     applyStatus(data,expected);
     if(attempt===waiting)attempt=null;
     return emit({busy:false});
    }catch(error){
     clearTimeout(waiting.timer);if(attempt===waiting)attempt=null;
     // 서버 저장 실패·응답 유실·늦은 허용: 방금 만든 구독은 지운다(서버에 남았어도 이 브라우저는 그 알림을 못 띄운다).
     const removed=await removeLocal(sub);
     const denied=error?.name==='NotAllowedError'||worldPushSupport(env).permission==='denied';
     if(current(expected))emit({busy:false,error:!removed?'PUSH_LOCAL_CLEANUP':denied?'PUSH_DENIED':error?.code||'PUSH_UNAVAILABLE'});
     return snapshot();
    }finally{if(attempt===waiting)attempt=null;if(mutation===pending)mutation=null;}
   })();
   mutation=pending;return pending;
  },
  // 이 기기 끄기. 마지막 기기였으면 서버가 돌려준 보낸 기록·설정을 함께 돌려준다(기기 쪽이 1단 기록에 넣는다).
  // 돌려주는 값: {removed(이 브라우저 구독을 지웠다), handover?, settings?, account?}. 다른 켜기·끄기가 도는 중이면 null(아무것도 하지 않았다).
  async disable(){
   const expected=epoch;if(!current(expected)||mutation)return null;
   emit({busy:true,error:null});
   const run=(async()=>{
    const reg=await existing(),sub=subscription||(reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null),record=readRecord();
    let result=null;
    if(sub){try{result=await request('unsubscribe',{endpoint:sub.endpoint});}catch{if(record?.endpoint===sub.endpoint){try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}}}
    const removed=await removeLocal(sub,reg);
    if(removed)writeRecord(null);
    if(current(expected)){
     emit({busy:false,device:{subscribed:false},error:removed?null:'PUSH_LOCAL_CLEANUP'});
     if(result){const account=accountOf(result);emit({account,plan:account.active?state.plan:null});}
    }
    return {...(result||{}),removed};
   })();
   mutation=run;try{return await run;}finally{if(mutation===run)mutation=null;}
  },
  // 요약·설정 보내기(2단이 켜진 계정만). 요약에는 이 기기 1단이 보낸 줄(handover)도 싣는다 — 2단을 켜는 사이·비상 스위치로 1단이 띄운 알림도
  // 서버의 7일 창·하루 하나에 들어가게(설계 §6-3). 설정은 바로(모아 둔 요약이 있으면 함께). 요약은 바뀌었을 때 5분에 한 번까지(모인 것 중 마지막)
  // · 「오늘 공부함」이나 보낸 줄이 새로 서면 바로 · 같아도 6시간마다 한 번. 보낸 것과 같은 요약으로 돌아오면 모아 둔 것을 버린다.
  sync({settings,digest,handover}={}){
   if(!owner)return;
   // 설정은 상태를 몰라도(망이 끊김 · 상태를 아직 못 읽음) 바꾼 것을 판으로 적어 둔다 — 상태가 서면 맞추기가 보낸다(설계 검토 P2-7).
   if(settings)noteSettings();
   if(!state.account.active)return;
   const time=now(),expected=epoch;
   // 요약 · 설정 요청은 모두 keepalive로 보낸다(deliver). 보낸 뒤 응답 전에 앱을 닫아도 계정 정리(stop)가 끊지 않는다(11-20 GPT 끝 판 GA1 ·
   // 다시 검수 GA1 · GA2 · GA3). 받히지 않으면 받을 때까지 다시 보낸다. 보낸 차례(seq)를 붙여 늦게 온 앞 응답은 뒤 응답이 그린 계획을 덮지 않는다.
   // 요약의 판은 지은 때다 — 5분 모은 뒤에 보내도 지은 때의 판으로 간다(그 사이 다른 탭이 지은 더 새 요약을 덮지 않게).
   const versioned=value=>({item:value,version:state.versioning?mint():null});
   const send=value=>{if(value)owed.digest=value;return deliver(expected,{digest:value});};
   const drop=()=>{clearTimeout(syncTimer);syncTimer=null;pendingSync=null;};
   const item=digest?{digest,...(Array.isArray(handover)&&handover.length?{handover}:{})}:null;
   if(settings){owed.settings=settings;const value=item?versioned(item):pendingSync;drop();if(value)lastSync=syncMark(value.item,time);return send(value);}
   if(!item)return;
   // 「바뀌었나 · 급한가」는 보낸 것(진행 중 포함)과 견준다. 실패해도 lastSync를 되돌리지 않고 다시 보내기에 맡긴다 — 실패 → 오류 → 1단 다시 잡기
   // (400ms) → 다시 보냄의 고리가 없다(설계 검토 P2-3).
   const next=syncMark(item,time),changed=next.key!==lastSync?.key,urgent=next.day!==lastSync?.day||next.rows!==lastSync?.rows||next.known&&lastSync?.known===false;
   if(!changed&&time-lastSync.at<SYNC_REFRESH_MS){drop();return;}
   if(!lastSync||urgent||!changed||time-lastSync.at>=SYNC_GAP_MS){drop();lastSync=next;return send(versioned(item));}
   pendingSync=versioned(item);
   if(!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;const value=pendingSync;pendingSync=null;if(value&&current(expected)&&state.account.active){lastSync=syncMark(value.item,now());send(value);}},Math.max(0,lastSync.at+SYNC_GAP_MS-time));
  },
  // 페이지를 떠날 때(pagehide · 화면 숨김): 아직 못 보낸 요약과 받히지 않은 설정을 keepalive로 보낸다. 기다림 없이 fetch까지 가고, 만료 전 토큰은
  // 갱신하지 않고 그대로 쓴다(설계 검토 P2-5). 나가지 못해도 설정은 판으로 남아 다음에 열 때 맞추기가 보낸다(GA3 · GA5).
  flush(){
   if(!owner||!state.account.active)return;
   const expected=epoch;
   if(pendingSync){const value=pendingSync;pendingSync=null;clearTimeout(syncTimer);syncTimer=null;lastSync=syncMark(value.item,now());owed.digest=value;}
   // 이미 날아가는 중인 설정 · 요약은 다시 보내지 않는다 — keepalive라 닫아도 끝까지 간다(앞 회차: 떠날 때 다시 보내기가 다른 탭의 새 설정을 덮었다).
   const settings=!!owed.settings&&flying.settings===0,digest=owed.digest&&!flying.digests.has(owed.digest)?owed.digest:null;
   if(!settings&&!digest)return;
   try{deliver(expected,{leaving:true,digest,settings});}catch{}
  },
  // 망이 돌아오거나 화면이 다시 보일 때: 받히지 않은 것을 바로 다시 보낸다(진행 중이면 기다린다).
  retry(){const expected=epoch;if(!current(expected)||!(owed.settings||owed.digest)||inflight>0)return;clearTimeout(retryTimer);retryTimer=null;retryStep=0;deliver(expected);},
  // 1단 설정 묶음(world-reminder-device): read()는 이 브라우저의 1단 설정({frequency, hour, since}), adopt(값)은 서버 설정을 1단 설정에 넣는다
  // (설정 보내기를 부르지 않는다). 떼는 함수를 돌려준다.
  bindSettings(value){binding=value&&typeof value.read==='function'&&typeof value.adopt==='function'?value:null;if(binding)reconcile(epoch);const bound=binding;return ()=>{if(binding===bound)binding=null;};},
  // 알림을 눌러 들어왔을 때 누름을 한 번 더 알린다(워커가 오프라인이라 못 알렸을 때 — 서버는 토큰을 한 번만 쓴다).
  ack(token){if(typeof token==='string'&&/^[A-Za-z0-9_-]{22}$/.test(token)){try{void anonymous('opened',{token}).catch(()=>{});}catch{}}},
  // 로그아웃 단추: 이 브라우저 구독이 이 계정 것이면 서버와 브라우저에서 끈다(로그아웃 전에, 토큰이 살아 있을 때).
  async logout(){
   if(!owner)return {ok:true};
   // 그 계정의 판 키(가장 큰 판 · 설정 판)를 지운다 — 다시 로그인하면 서버 설정을 들이며 새로 맞춘다. 다시 보내기도 거둔다.
   try{storage?.removeItem(versionKey());}catch{}
   clearTimeout(retryTimer);retryTimer=null;owed={settings:false,digest:null};
   const record=readRecord();if(record?.accountId!==owner)return {ok:true};
   const reg=await existing(),sub=reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null;
   let server=false;
   try{await request('unsubscribe',{endpoint:record.endpoint});server=true;}
   catch{try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});server=true;}catch{}}
   const removed=sub&&sub.endpoint===record.endpoint?await removeLocal(sub,reg):true;
   if(removed)writeRecord(null);
   return {ok:server||removed};
  },
  dispose(){disposed=true;epoch++;clearTimeout(syncTimer);syncTimer=null;clearTimeout(retryTimer);retryTimer=null;binding=null;if(attempt){attempt.stop();attempt=null;}mutation=null;},
 };
}
