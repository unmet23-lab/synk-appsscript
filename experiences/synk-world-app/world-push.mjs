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
const syncMark=(item,at)=>({key:JSON.stringify(item),at,day:item.digest?.lastStudyDay??null,rows:JSON.stringify(item.handover||[])});
const bounded=(promise,ms=REQUEST_MS)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('PUSH_TIMEOUT'),{code:'PUSH_TIMEOUT'})),ms);})]).finally(()=>clearTimeout(timer));};

// request(action, body, {keepalive}): 이 탭의 SYNK ID로 world-push를 부른다(world-account.mjs pushRequest).
// anonymous(action, body, {keepalive}): 로그인 없이(공개 키만) — 누름(opened)과 주소 + 기기 식별자 끄기에만 쓴다.
export function createWorldPush({request,anonymous=()=>Promise.reject(Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'})),env=globalThis,
 storage=env.localStorage,workerUrl,scopeUrl,now=()=>Date.now(),onChange=()=>{}}={}){
 let owner=null,epoch=0,registration=null,subscription=null,publicKey=null,attempt=null,mutation=null,disposed=false,syncTimer=null,pendingSync=null,lastSync=null;
 const listeners=new Set([onChange]);
 let state={phase:'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false};
 const emit=patch=>{state={...state,...patch};const value=snapshot();for(const listener of listeners){try{listener(value);}catch{}}return value;};
 // publicReady: 서비스 워커가 떠 있고 서버 공개 키를 받아 「동의하고 켜기」가 그 동작 안에서 바로 subscribe를 부를 수 있다.
 const snapshot=()=>({...state,support:worldPushSupport(env),owner,waiting:!!attempt,publicReady:!!registration&&!!publicKey&&!state.busy});
 const current=expected=>expected===epoch&&!!owner&&!disposed;
 const guard=expected=>{if(!current(expected))throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 const readRecord=()=>{try{const value=JSON.parse(storage?.getItem(PUSH_RECORD_KEY)||'null');return value&&typeof value.accountId==='string'&&typeof value.deviceId==='string'&&typeof value.endpoint==='string'?value:null;}catch{return null;}};
 const writeRecord=value=>{try{value?storage?.setItem(PUSH_RECORD_KEY,JSON.stringify(value)):storage?.removeItem(PUSH_RECORD_KEY);}catch{}};
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
  return emit({phase,enabled:data.enabled===true&&!!publicKey,device:data.device?.subscribed?{subscribed:true,deviceId:data.device.deviceId}:{subscribed:false},
   account:accountOf(data),plan:data.plan||null,checkedAt:now(),error:null});
 }
 // 계정의 2단 상태를 다시 읽는다. 이 브라우저 구독이 이 계정 것인데 서버에 없으면(정리·404·다른 기기에서 로그아웃시킴) 이 브라우저 구독도 지운다.
 // 이 브라우저가 받을 수 없어도(아이폰·푸시 없는 브라우저) 설정을 열 때와 1단이 띄우기 직전에는 계정 상태만 읽는다 — 다른 기기에서 켜 두었으면
 // 1단이 쉬고 설정에 그 기기로 간다고 적는다. 계정이 바뀐 직후(initial)에는 읽지 않는다(받을 수 없는 기기에서 열 때마다 부르지 않게).
 async function refresh({install=false,initial=false}={}){
  const expected=epoch;if(!current(expected))return snapshot();
  const support=worldPushSupport(env);
  if(!support.supported){
   if(initial||support.reason==='desktop')return emit({phase:'unsupported',enabled:false});
   try{const data=await request('status',{});applyStatus(data,expected,'unsupported');return emit({enabled:false});}
   catch(error){if(current(expected))emit({phase:'unsupported',enabled:false,error:error.code||'PUSH_UNAVAILABLE'});return snapshot();}
  }
  try{
   const reg=install?await register(expected):await existing();guard(expected);
   const sub=reg?await bounded(reg.pushManager.getSubscription()):null;guard(expected);subscription=sub;
   const data=await request('status',sub?{endpoint:sub.endpoint}:{});
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
   // 앞 계정이 띄운 권한 창 기다리기는 끝낸다(늦게 허용돼도 지운다) — 새 계정이 바로 켤 수 있게.
   if(attempt){attempt.stop();attempt=null;}mutation=null;
   emit({phase:next?'loading':'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false});
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
     const data=await request('subscribe',{subscription:{endpoint:json.endpoint,keys:{p256dh:json.keys?.p256dh,auth:json.keys?.auth}},settings,digest,handover,consent:1});
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
   if(!owner||!state.account.active)return;
   const time=now();
   const send=(body,options)=>{
    const expected=epoch;
    return request('sync',body,options).then(data=>{if(current(expected))applyStatus(data,expected);},error=>{if(current(expected))emit({error:error.code||'PUSH_UNAVAILABLE'});});
   };
   const drop=()=>{clearTimeout(syncTimer);syncTimer=null;pendingSync=null;};
   const mark=item=>{lastSync=syncMark(item,time);};
   const item=digest?{digest,...(Array.isArray(handover)&&handover.length?{handover}:{})}:null;
   if(settings){const value=item||pendingSync;drop();if(value)mark(value);return send({settings,...(value||{})});}
   if(!item)return;
   const next=syncMark(item,time),changed=next.key!==lastSync?.key,urgent=next.day!==lastSync?.day||next.rows!==lastSync?.rows;
   if(!changed&&time-lastSync.at<SYNC_REFRESH_MS){drop();return;}
   if(!lastSync||urgent||!changed||time-lastSync.at>=SYNC_GAP_MS){drop();lastSync=next;return send(item);}
   pendingSync=item;
   if(!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;const value=pendingSync;pendingSync=null;if(value&&owner&&state.account.active){lastSync=syncMark(value,now());send(value);}},Math.max(0,lastSync.at+SYNC_GAP_MS-time));
  },
  // 페이지를 떠날 때: 아직 못 보낸 요약을 keepalive로 보낸다.
  flush(){
   if(!pendingSync||!owner||!state.account.active)return;
   const item=pendingSync;pendingSync=null;clearTimeout(syncTimer);syncTimer=null;
   lastSync=syncMark(item,now());
   try{void request('sync',item,{keepalive:true}).catch(()=>{});}catch{}
  },
  // 알림을 눌러 들어왔을 때 누름을 한 번 더 알린다(워커가 오프라인이라 못 알렸을 때 — 서버는 토큰을 한 번만 쓴다).
  ack(token){if(typeof token==='string'&&/^[A-Za-z0-9_-]{22}$/.test(token)){try{void anonymous('opened',{token}).catch(()=>{});}catch{}}},
  // 로그아웃 단추: 이 브라우저 구독이 이 계정 것이면 서버와 브라우저에서 끈다(로그아웃 전에, 토큰이 살아 있을 때).
  async logout(){
   if(!owner)return {ok:true};
   const record=readRecord();if(record?.accountId!==owner)return {ok:true};
   const reg=await existing(),sub=reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null;
   let server=false;
   try{await request('unsubscribe',{endpoint:record.endpoint});server=true;}
   catch{try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});server=true;}catch{}}
   const removed=sub&&sub.endpoint===record.endpoint?await removeLocal(sub,reg):true;
   if(removed)writeRecord(null);
   return {ok:server||removed};
  },
  dispose(){disposed=true;epoch++;clearTimeout(syncTimer);syncTimer=null;if(attempt){attempt.stop();attempt=null;}mutation=null;},
 };
}
