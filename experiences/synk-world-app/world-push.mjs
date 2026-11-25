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
// 쓰기 판(SYNK-appsscript 단계4_계획 §24-6의 5, 설계 주인 11-21 「서버가 매기는 compare-and-set」): 판은 서버가 부분(설정 · 요약 · 복습 때)마다 세는
// 쓰기 수다. 기기는 마지막으로 본 서버 판(바탕)을 실어 보내고, 서버는 바탕이 지금 판과 같을 때만 쓴다. 보내지 못한 이 브라우저의 설정 편집은
// localStorage synk.world.push.versions.v1.<계정>({settings:{frequency, hour, base, known, tries}})에 둔다(탭이 함께 쓴다). 학습 자료는 두지 않는다.
export const PUSH_VERSION_KEY='synk.world.push.versions.v1';
const RETRY_MS=[15000,60000,5*60000,30*60000];

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
// 마지막으로 보낸 요약의 표: 무엇(key) · 언제(stamp) · 마지막으로 공부한 날(day) · 보낸 줄(rows) — day·rows가 바뀌면 모으지 않고 바로 보낸다.
// known: 복습 때를 실었나(새 길 판정이 「확인 중」이면 그 칸을 뺀다 — 4-8 §24-2). 모르던 요약 뒤 처음 아는 요약도 바로 보낸다(서버가 옛 때를 쥐고 있다).
const syncMark=(item,stamp)=>({key:JSON.stringify(item),stamp,day:item.digest?.lastStudyDay??null,rows:JSON.stringify(item.handover||[]),known:Array.isArray(item.digest?.reviews)});
const bounded=(promise,ms=REQUEST_MS)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('PUSH_TIMEOUT'),{code:'PUSH_TIMEOUT'})),ms);})]).finally(()=>clearTimeout(timer));};
const positive=value=>Number.isSafeInteger(value)&&value>0?value:null;

// request(action, body, {keepalive, leaving, onWait, onSent}): 이 탭의 SYNK ID로 world-push를 부른다(world-account.mjs pushRequest). 토큰 갱신을 기다리기
// 시작하면 onWait, fetch를 내기 직전에 onSent를 부른다(부르지 않으면 바로 나간 것으로 본다).
// anonymous(action, body, {keepalive}): 로그인 없이(공개 키만) — 누름(opened)과 주소 + 기기 식별자 끄기에만 쓴다.
export function createWorldPush({request,anonymous=()=>Promise.reject(Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'})),env=globalThis,
 storage=env.localStorage,workerUrl,scopeUrl,now=()=>Date.now(),onChange=()=>{}}={}){
 let owner=null,epoch=0,registration=null,subscription=null,publicKey=null,attempt=null,mutation=null,disposed=false,syncTimer=null,pendingSync=null,lastSync=null;
 // 차례: status · sync · subscribe · unsubscribe가 한 번호를 쓴다. 계정 상태(켜짐 · 계획 · 판)는 가장 늦게 시작한 요청의 응답만, 기기 상태는 기기 칸이 있는 응답
 // (status · 켜기 · 끄기 — sync 응답에는 기기 칸이 없다) 가운데 가장 늦게 시작한 것만 적는다. 켜기 · 끄기가 끝나면 그 전에 시작한 요청의 응답은 옛것이다(GPT push-versions-world GA5).
 let order=0;const shown={account:0,device:0};
 // binding: 1단 설정 묶음(world-reminder-device가 건다 — read · adopt · digest). owedDigest: 아직 받히지 않은 요약({item, tries}).
 // jobs: 진행 중인 sync(토큰 갱신을 기다리는 요청은 sent가 거짓). closing: 로그아웃 중 — 계정이 바뀔 때까지 새 요청과 판 키 쓰기를 막는다. leavingNow: flush 안.
 // leftOwner: 막지 않는 logout()(옛 뜻)을 부른 계정 — 계정이 바뀔 때까지 그 계정으로 다시 잇지(reconnect) 않는다. leaves: 그 logout()을 부른 수 —
 // 날아가는 켜기는 시작할 때의 수와 다르면 멈추고 방금 만든 구독을 지운다(설계 검토 push-mix53 P1). 요청과 판 키 쓰기는 막지 않는다.
 // legacyPending: 판을 모르는 옛 서버에 보낼, 앞 설정 요청의 응답을 기다리는 이 페이지의 설정(판 키에 적지 않는다 — 지금 라이브처럼).
 let binding=null,retryTimer=null,retryStep=0,owedDigest=null,closing=false,leavingNow=false,legacyPending=null,claiming=null,claimRead=null,leftOwner=null,leaves=0;
 // noted: 이 페이지가 적은 편집마다 적은 때의 요청 차례(order). 켜기가 날아가는 동안 적은 편집은 그 켜기(attempt.edits)에 적는다.
 const noted=new Map();
 const jobs=new Set(),listeners=new Set([onChange]);
 let state={phase:'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false,versions:null,versioning:false,planId:null,seenSeq:0};
 // 계정이 꺼진 상태를 적으면 미뤄 둔 옛 서버 설정은 끝난 계획의 것이라 버린다 — 상태 읽기 · 켜기 · 끄기 어디서 적든 같다(r6 GA6 · r8 GA4 · r9 GA9 ·
 // r10 GA3 · GA6). 미뤄 두는 것은 켜진 계정에 설정을 보내는 동안뿐이라, 그 뒤 다시 켜진 계획에서 새로 미룬 설정은 그 계획의 것이다(r9 GA3).
 const emit=patch=>{state={...state,...patch};if(!state.account.active)legacyPending=null;const value=snapshot();for(const listener of listeners){try{listener(value);}catch{}}return value;};
 // publicReady: 서비스 워커가 떠 있고 서버 공개 키를 받아 「동의하고 켜기」가 그 동작 안에서 바로 subscribe를 부를 수 있다.
 const snapshot=()=>({...state,support:worldPushSupport(env),owner,waiting:!!attempt,publicReady:!!registration&&!!publicKey&&!state.busy});
 const current=expected=>expected===epoch&&!!owner&&!disposed;
 const guard=expected=>{if(!current(expected))throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
 const readRecord=()=>{try{const value=JSON.parse(storage?.getItem(PUSH_RECORD_KEY)||'null');return value&&typeof value.accountId==='string'&&typeof value.deviceId==='string'&&typeof value.endpoint==='string'?value:null;}catch{return null;}};
 const writeRecord=value=>{try{value?storage?.setItem(PUSH_RECORD_KEY,JSON.stringify(value)):storage?.removeItem(PUSH_RECORD_KEY);}catch{}};
 // 지난 때(요약 모으기 · 6시간 다시 보내기): 기기 시계와 performance.now() 가운데 더 많이 지난 쪽 — 기기 시계를 뒤로 맞춰도, 휴대폰이 잠들어도 묶이지 않는다.
 const mono=()=>{try{const value=env.performance?.now?.();if(Number.isFinite(value))return value;}catch{}return now();};
 const stamp=()=>({at:now(),mono:mono()});
 const elapsed=mark=>mark?Math.max(now()-mark.at,mono()-mark.mono):Infinity;
 // ── 바탕 판(설계 주인 11-21 「서버가 매기는 compare-and-set」) ──
 // 설정 편집은 값과 바탕을 한 덩어리로 한 키에 둔다 — 두 키를 따로 읽으면 다른 탭의 쓰기가 그 사이에 낀다(GA2). base: 편집할 때 알던 서버 설정 판
 // (null = 아직 판이 없음). known: 그 판을 알았나(상태를 읽기 전에 바꾼 것 · 판을 모르는 옛 서버에서 바꾼 것은 거짓 — 판을 아는 상태가 서면 그때 판을
 // 바탕으로 보낸다). tries: 거절된 횟수(0 · 1). id: 편집마다 새로 매긴다 — 바탕을 옮겨도 같은 편집으로 알아본다(r4 GA3). page · at: 그 편집을 쓴
 // 페이지와 쓴 때(아래 「편집의 주인」).
 const versionKey=()=>`${PUSH_VERSION_KEY}.${owner}`;
 const newId=()=>`${now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
 // ── 편집의 주인(설계 검토 11-21 밤 1 · 2) ── 판 키 하나를 모든 탭이 보므로, 편집을 쓴 페이지(page)가 열려 있는 동안은 그 페이지만 그 편집을 보내고
 // 옮기고 지운다(규칙 4 — 열린 탭). 다른 탭은 건드리지 않고, 그동안 1단에 서버 설정을 들이는 것도 미룬다. 쓴 페이지가 닫혔으면 처음 맞추는 탭이 규칙 5
 // (다음에 열 때)를 한 번 쓴다. 페이지는 그 계정으로 열려 있는 동안(로그아웃 · 계정 바꿈 · 닫음 전) 「계정 + 페이지」 이름의 Web Locks 잠금을 쥐고, 다른
 // 탭은 그 잠금을 얻을 수 있는지로 주인이 살아 있는지 본다 — 로그아웃한 탭은 그 계정 편집을 보낼 수 없으니 주인이 아니다. Web Locks가 없는 브라우저는
 // 편집이 OWNER_STALE_MS 넘게 묵었을 때만 주인이 없다고 본다(같은 기기의 시계끼리 견준다).
 const PAGE_LOCK='synk.world.push.page.',OWNER_STALE_MS=5*60000,page=newId();
 let pageHold=null;
 const releasePageHold=()=>{const prev=pageHold;pageHold=null;prev?.release();};
 function holdPage(){
  releasePageHold();
  const locks=env.navigator?.locks;if(!owner||closing||disposed||!locks?.request)return;
  const hold={done:false,resolve:null,release(){hold.done=true;hold.resolve?.();}};pageHold=hold;
  try{Promise.resolve(locks.request(PAGE_LOCK+owner+'.'+page,()=>hold.done?undefined:new Promise(resolve=>{hold.resolve=resolve;}))).catch(()=>{});}catch{}
 }
 async function ownerAlive(edit){
  if(edit.page===page)return !disposed&&!closing;
  const locks=env.navigator?.locks;
  if(edit.page&&locks?.request){try{return await locks.request(PAGE_LOCK+owner+'.'+edit.page,{ifAvailable:true},lock=>!lock);}catch{}}
  const age=now()-(edit.at??-Infinity);return !!edit.page&&age>=0&&age<OWNER_STALE_MS;
 }
 const settingsOf=value=>!value||typeof value!=='object'||!Number.isFinite(value.frequency)?null
  :{frequency:value.frequency,hour:Number.isFinite(value.hour)?value.hour:null,base:positive(value.base),known:value.known===true,tries:value.tries===1?1:0,
   id:typeof value.id==='string'&&value.id.length<=40?value.id:'legacy',page:typeof value.page==='string'&&value.page.length<=40?value.page:null,
   at:Number.isFinite(value.at)?value.at:null,planId:positive(value.planId)};
 const readEdit=()=>{try{return settingsOf(JSON.parse(storage?.getItem(versionKey())||'null')?.settings);}catch{return null;}};
 const writeEdit=next=>{if(closing||!owner)return;try{next?storage?.setItem(versionKey(),JSON.stringify({settings:next})):storage?.removeItem(versionKey());}catch{}};
 const same=(a,b)=>!!a&&!!b&&a.id===b.id&&a.page===b.page&&a.frequency===b.frequency&&a.hour===b.hour&&a.base===b.base&&a.known===b.known&&a.tries===b.tries;
 // 덩어리를 그 덩어리일 때만 고친다(쓰기 직전에 다시 읽어, 다른 탭이 더 새 편집을 적었으면 두지 않는다).
 function rewrite(mine,next){if(same(readEdit(),mine))writeEdit(next);}
 // 편집의 바탕을 옮긴다.
 const rebase=(edit,base,extra={})=>({...edit,base,...extra});
 // 편집이 지금 서버 계획과 다른 계획 때 적은 것인가 — 다른 기기가 마지막 기기를 끄고 다시 켰다. 다시 켜며 고른 설정이 옛 계획 때 편집보다 뒤의 뜻이라
 // 옛 편집은 지난 것으로 본다(설계 주인 11-22 규칙 4 (나), GPT world-r5 GA7 · r4 GA4). 계획은 정체(planId — 계획 줄을 만든 때)로 가린다. 판은 범위를
 // 넘으면 새 시작으로 넘어가므로 쓰지 않는다. 어느 쪽이든 정체를 모르면 같은 계획으로 본다.
 const otherPlan=(edit,planId)=>!!edit?.planId&&!!planId&&edit.planId!==planId;
 const serverVersions=data=>{const v=data?.versions;return v&&typeof v==='object'?{settings:positive(v.settings),digest:positive(v.digest),reviews:positive(v.reviews)}:null;};
 const deviceOf=data=>data.device?.subscribed?{subscribed:true,deviceId:data.device.deviceId}:{subscribed:false};
 // 응답의 차례: 서버는 계획 줄을 잠그고 쓰므로 같은 계정의 응답은 부분마다 판이 함께 커지는 차례로 선다. 판이 하나라도 더 크면(작은 것은 없이) 서버가
 // 지금 적힌 상태보다 뒤에 처리한 응답이고(1), 더 작으면 앞에 처리한 응답이다(-1). 같은 계획 안에서 빈 판(null — 아직 쓰지 않은 부분)은 어떤 숫자보다
 // 앞이다(r4 GA1). 새 계획의 판은 옛 계획의 판보다 크다. 보낸 차례(seq)와 서버에 닿은 차례는 다를 수 있다 — 둘 다 켜진 계정이고 판이 있으면 판으로
 // 가리고, 모르면(0) 보낸 차례를 따른다.
 const comparable=data=>state.versioning&&data?.versioning==='base'&&!!serverVersions(data)&&!!state.versions&&state.account.active&&accountOf(data).active;
 function progress(data){
  if(!comparable(data))return 0;
  const v=serverVersions(data),mine=state.versions;
  let more=false,less=false;
  for(const key of ['settings','digest','reviews']){const a=v[key],b=mine[key];if(a===b)continue;if(b===null||(a!==null&&a>b))more=true;else less=true;}
  // 같은 계획 안에서는 모든 부분이 함께 커져 섞이지 않는다. 섞였으면 계획이 바뀐 것이다 — 새 계획의 판은 옛 계획의 어느 판보다 크므로 가장 큰 판이 큰
  // 쪽이 뒤다(r5 GA1: 다시 켠 새 계획의 빈 복습 때 판 때문에 옛 계획의 늦은 응답이 더 새 것으로 셈해지지 않게).
  if(more&&less){const top=o=>Math.max(-Infinity,...['settings','digest','reviews'].map(key=>o[key]).filter(x=>x!=null));const a=top(v),b=top(mine);return a>b?1:a<b?-1:0;}
  return more?1:less?-1:0;
 }
 // 이 응답을 계정 상태로 적나: 판이 더 크면 보낸 차례가 늦어도 적고, 판이 더 작으면 보낸 차례가 앞서도 적지 않는다.
 const newer=(seq,data)=>{const ahead=progress(data);return ahead>0||(seq>shown.account&&ahead===0);};
 // 학생이 설정을 바꿨다: 값과 그때 알던 서버 판(바탕)을 한 번에 적는다. 2단이 꺼진 계정이면 적지 않는다(보낼 계획이 없다 — 켤 때 1단 설정이 간다).
 function noteSettings(value){
  if(!owner||closing||!Number.isFinite(value?.frequency))return;
  // 2단이 꺼진 계정이면 적지 않는다 — 다만 이 탭의 켜기가 날아가는 동안(권한 창 · 응답 기다림)은 적는다. 1단에만 두면 그사이 다른 탭이 서버 설정을 1단에
  // 들여 지운다(r7 GA4). 켜기 응답이 이 편집을 새 계획 바탕으로 옮기거나 비운다.
  const known=!!state.checkedAt;if(known&&!state.account.active&&!attempt)return;
  const base=known?state.versions?.settings??null:null;
  // 새 편집은 옛 서버에 미뤄 둔 설정보다 새것이다(r5 GA4).
  legacyPending=null;
  const id=newId();
  writeEdit({frequency:value.frequency,hour:Number.isFinite(value.hour)?value.hour:null,base,known,tries:0,id,page,at:now(),planId:known?state.planId:null});
  noted.set(id,order);if(noted.size>20)noted.delete(noted.keys().next().value);
  if(known&&!state.account.active)attempt.edits.add(id);
 }
 // 보낼 설정: 이 페이지가 쓴 편집이고, 바탕이 지금 아는 서버 판과 같다(그사이 다른 쓰기가 없었다). 한 페이지 안에서는 설정을 실은 요청을 하나씩
 // 보낸다 — 앞 응답이 오면 자기 쓰기 사슬로 바탕을 옮긴 뒤 보낸다(자기 요청끼리 거절하지 않게, 설계 검토 3). 떠날 때는 fetch가 나간 요청만 센다 — 토큰
 // 갱신을 기다리는 요청은 떠나며 다시 보낸다(GA1). 깃발로 들지 않고 늘 계산한다 — 늦은 응답 · 실패 · 로그아웃이 따로 지우지 못한다(GA2 · GA6 · GA9).
 function owedSettings(leaving=false){
  if(!state.versioning||closing||!state.checkedAt)return null;
  const mine=readEdit();
  if(!mine||mine.page!==page||!mine.known||mine.base!==(state.versions?.settings??null))return null;
  for(const job of jobs)if(job.carries&&(job.sent||!leaving))return null;
  return mine;
 }
 const digestOut=(digest,leaving=false)=>{for(const job of jobs)if(job.digest===digest&&(job.sent||!leaving))return true;return false;};
 const digestFlying=()=>{for(const job of jobs)if(job.digest)return true;return false;};
 const flying=mine=>{for(const job of jobs)if(job.settings?.id===mine.id)return true;return false;};
 // 설정을 실은 요청이 날아가는 중인가(한 페이지 안에서는 하나씩 보낸다).
 const settingsFlying=()=>{for(const job of jobs)if(job.carries)return true;return false;};
 // 지금 아는 요약 · 복습 때 판(판을 아는 상태일 때만). 요약을 지을 때 잡아 그 요약과 함께 든다(r4 GA2 · GA11).
 const digestBase=()=>state.versioning&&state.checkedAt?{digest:state.versions?.digest??null,reviews:state.versions?.reviews??null}:null;
 // 1단 설정의 지금 값(이 브라우저의 localStorage — 탭이 함께 쓴다). 읽지 못하면 fallback.
 function liveSettings(fallback){
  let live=null;try{live=binding?.read?.()||null;}catch{}
  return live&&Number.isFinite(live.frequency)?{frequency:live.frequency,hour:Number.isFinite(live.hour)?live.hour:null,since:Number.isFinite(live.since)?live.since:(fallback?.since??null)}:fallback;
 }
 // 서버 설정을 1단에 들인다(내용이 다를 때만).
 function adopt(plan){
  if(!binding||!plan||!Number.isFinite(plan.frequency))return;
  const server={frequency:plan.frequency,hour:Number.isFinite(plan.hour)?plan.hour:null,since:Number.isFinite(plan.since)?plan.since:null};
  let local=null;try{local=binding.read();}catch{}
  if(!local||local.frequency!==server.frequency||local.hour!==server.hour||(server.since!==null&&local.since!==server.since)){try{binding.adopt(server);}catch{}}
 }
 // 설정 맞추기(응답마다): 보내지 못한 편집이 없으면 서버 설정을 1단에 들인다. 다른 페이지가 쓴 편집이면 그 주인에게 맡긴다(claim). 이 페이지의 편집이면
 // — 상태를 모를 때 바꾼 것은 지금 판을 바탕으로 보내고(열린 탭의 뜻), 바탕이 지금 판과 같으면 보낸다. 다르면 그사이 다른 쓰기가 있었다는 뜻이라 서버
 // 것을 들이고 편집을 비운다. 우리 요청이 날아가는 중이면 그 응답을 기다린다. 판을 모르는 옛 서버면 지금 라이브처럼 판 키를 쓰지 않는다.
 function reconcile(expected){
  if(!binding||!current(expected)||closing||!state.account.active)return;
  let mine=readEdit();
  if(mine&&mine.page!==page){claim(expected,mine);return;}
  // 옛 서버: 이 페이지가 상태를 모를 때 적은 편집은 버린다 — 지금 라이브 WORLD처럼(설계 주인 규칙 6, 설계 검토 1).
  if(!state.versioning){if(mine&&!flying(mine))rewrite(mine,null);return;}
  if(mine){
   const server=state.versions?.settings??null;
   // 바탕을 모르는 편집은 지금 판을 바탕으로 옮긴다. 저장이 실패하면(용량 초과 따위) 여기서 멈춘다 — 같은 편집으로 되풀이하지 않게(r4 GA7). 계획 정체는
   // 이 상태가 그 편집 뒤에 보낸 요청에서 왔을 때만 붙인다 — 그때는 그 계획(이나 더 옛 계획) 때 편집이 분명하다(r8 GA2). 편집 앞에 보낸 요청의 늦은 응답이면
   // 그 뒤 새 계획 때 편집일 수 있어 모르는 계획으로 두고, 학생이 이 탭에서 방금 고른 것이 이긴다(설계 주인 11-22, r7 GA2).
   const seen=noted.get(mine.id),planId=seen!=null&&state.seenSeq>seen?state.planId:null;
   if(!mine.known){const next=rebase(mine,server,{known:true,...(planId?{planId}:{})});rewrite(mine,next);mine=readEdit();if(!same(mine,next))return;}
   // 편집 앞에 보낸 읽기가 먼저 바탕을 매겼어도, 그 뒤에 보낸 읽기가 같은 판을 확인하면 계획 정체를 붙인다(r9 GA7). 판이 다르면 아래 낡음 갈래가 다룬다.
   else if(!mine.planId&&planId&&mine.base===server){const next={...mine,planId};rewrite(mine,next);mine=readEdit();if(!same(mine,next))return;}
   if(mine.base===server){if(owedSettings())deliver(expected);return;}
   // 이 편집이나 이 페이지의 앞 설정 요청이 날아가는 중이면 그 응답을 기다린다 — 앞 요청이 받혔으면 응답의 자기 쓰기 사슬이 바탕을 옮긴다. 자기 쓰기로
   // 낡은 것을 거절로 세어 다시 보내기를 쓰지 않게(r5 GA3).
   if(flying(mine)||settingsFlying())return;
   // 이 페이지의 편집인데 그사이 다른 쓰기로 바탕이 낡았다(앞 설정 요청을 기다리던 편집 · 상태를 다시 읽음). 열린 탭의 편집이므로 거절된 것과 같이
   // 본다 — 처음이면 지금 판을 바탕으로 옮겨 한 번 보내고, 이미 한 번 거절된 편집이면 비우고 서버 것을 들인다(규칙 4).
   if(mine.tries===0&&!otherPlan(mine,state.planId)){const next=rebase(mine,server,{tries:1});rewrite(mine,next);if(same(readEdit(),next)&&owedSettings())deliver(expected);return;}
   rewrite(mine,null);
  }
  adopt(state.plan);
 }
 // 주인이 닫힌 편집(다른 페이지가 쓰고 닫았다): 다음에 열 때의 규칙 5 — 판을 아는 서버이고 바탕을 알고 지금 서버 판과 같으면 이 페이지가 넘겨받아
 // 보내고, 다르거나 모르면 지우고 서버 것을 들인다(설계 검토 1 · 2). 넘겨받은 편집은 다시 보내기를 이미 쓴 것으로 적는다 — 닫힌 탭의 뜻은 한 번만
 // 가고, 그사이 다른 쓰기로 거절되면 서버 것을 들인다(닫힌 탭의 편집은 그 탭이 보지 못한 쓰기를 이기지 않는다). 주인이 살아 있으면 건드리지 않는다.
 // 한 편집에 한 번에 하나만 본다. 저장이 실패하면 거기서 멈춘다(되풀이 없음).
 // 넘겨받기 전 상태 다시 읽기 — 한 번에 하나만 보낸다(r10 GA4: 다시 시도가 겹쳐 보내면 늦게 끝난 앞 읽기의 실패가 뒤 읽기의 성공 위에 적힌다).
 // 날아가는 동안 온 다시 시도(온라인 · 화면 복귀)는 적어 두고, 그 읽기가 끝난 뒤에도 넘겨받기가 서지 않았으면(읽기가 실패했다) 한 번 더 읽는다(r11 GA3).
 function readClaim(){
  const mark=claimRead,done=()=>{mark.reading=false;if(!mark.again||claimRead!==mark)return;mark.again=false;
   if(!closing&&state.seenSeq<=mark.after&&readEdit()?.id===mark.id)readClaim();};
  mark.reading=true;mark.again=false;void refresh().then(done,done);
 }
 function claim(expected,edit){
  if(claiming===edit.id)return;claiming=edit.id;
  ownerAlive(edit).then(alive=>{
   if(claiming===edit.id)claiming=null;
   if(alive||!current(expected)||closing||!state.account.active||!same(readEdit(),edit))return;
   const server=state.versions?.settings??null;
   // 편집의 바탕이 이 페이지가 아는 서버 판보다 크면(같은 계획) 이 페이지의 상태가 낡았다 — 그 페이지가 더 새 판을 보았다. 편집 하나에 한 번 상태를 다시
   // 읽고 그 뒤 맞추기가 정한다(r6 GA7: 낡은 상태로 다른 탭의 정당한 편집을 지우지 않게).
   // 이 편집 때문에 상태를 다시 읽기 시작했으면, 그 앞에 보낸 요청의 응답(늦은 응답 · 옛 서버 응답)으로는 정하지 않고 다시 읽기나 그 뒤에 보낸 요청의
   // 응답을 기다린다. 다시 읽기가 실패해도 편집은 남는다(r7 GA6 · r8 GA3 · GA6). 그 뒤에도 바탕이 크면(DB 복원 따위) 아래에서 서버 것을 들인다.
   if(claimRead?.id===edit.id&&state.seenSeq<=claimRead.after)return;
   if(claimRead?.id!==edit.id&&edit.known&&edit.base!=null&&server!=null&&edit.base>server&&!otherPlan(edit,state.planId)){claimRead={id:edit.id,after:order};readClaim();return;}
   // 바탕이 서버 판과 다르면 서버 판이 바탕보다 한 칸 위이고 서버 값이 그 탭의 앞 설정과 같아도 들인다 — 그 탭의 앞 요청이 받힌 것인지 다른 기기가 같은
   // 값을 먼저 쓴 것인지 기기만으로는 가를 수 없고, 잘못 짐작하면 다른 기기의 쓰기를 덮는다(설계 주인 11-22 규칙 5 (가), GPT world-r6 GA1 · GA5).
   if(state.versioning&&edit.known&&edit.base===server)rewrite(edit,rebase(edit,server,{page,at:now(),tries:1}));
   else rewrite(edit,null);
   if(same(readEdit(),edit))return;
   reconcile(expected);
  },()=>{if(claiming===edit.id)claiming=null;});
 }
 // 옛 서버에 미뤄 둔 이 페이지의 설정을 보낸다(설정을 실은 앞 요청의 응답 뒤). 그사이 판을 아는 서버로 돌아왔으면 편집으로 적어 맞추기가 보낸다.
 function flushLegacy(expected){
  if(!legacyPending||settingsFlying()||!current(expected)||closing||!state.account.active)return;
  const plain=legacyPending;legacyPending=null;
  if(state.versioning){noteSettings(plain);reconcile(expected);return;}
  deliver(expected,{plain});
 }
 // 다시 보낼 요약: 1단이 지금 기록으로 새로 짓는다(묶음에 digest가 없으면 같은 요약). 거절된 요약은 한 번만 다시 보낸다.
 const rebuilt=(digest,base,tries=1)=>{let item=null;try{item=binding?.digest?.()||null;}catch{}return {item:item&&item.digest?item:digest.item,tries,base};};
 // 보내기: 보낼 설정(덩어리 그대로, 바탕 판과 함께)과 요약(보낼 때 아는 바탕 판과 함께)을 한 요청으로 keepalive로 보낸다(닫아도 끊기지 않는다 — 앞 회차).
 // 실패하면 RETRY_MS 간격으로 다시 보낸다. 진행 중인 요청이 있으면 다시 보내기는 기다린다(keepalive 몫 64KB). leaving: 떠날 때 — 기다림 없이 fetch까지
 // 가고, 만료 전 토큰을 그대로 쓴다. plain: 판을 모르는 서버에 판 없이 한 번 보내는 설정(판 키에 적지 않는다).
 function deliver(expected,{leaving=false,digest=owedDigest,settings=true,plain=null}={}){
  if(!current(expected)||closing||!state.account.active)return null;
  leaving=leaving||leavingNow;
  const mine=plain||!settings?null:owedSettings(leaving),value=plain||mine;
  if(digest&&digestOut(digest,leaving))digest=null;
  // 판을 아는 서버에서는 한 페이지가 요약을 실은 요청도 하나씩 보낸다 — 앞 요약 · 복습 때가 받히면 응답의 자기 쓰기 사슬이 이 요약의 바탕을 그 판으로
  // 옮긴 뒤 간다(자기 요약끼리 거절하지 않게, 설계 검토 3). 떠날 때는 기다리지 않는다.
  if(digest&&!leaving&&!plain&&state.versioning&&digestFlying())digest=null;
  if(!value&&!digest)return null;
  const versions={},body={},based=state.versioning&&!plain;
  if(value){body.settings={frequency:value.frequency,hour:value.hour??null};if(mine)versions.settings=mine.base;}
  // 요약 바탕은 그 요약을 지을 때 잡은 판이다 — 묵은 요약에 나중에 읽은 판이 붙지 않게(r4 GA2). 판을 모를 때 지은 요약은 지금 새로 지어 지금 판을 싣는다.
  if(digest&&based&&!digest.base){const fresh=rebuilt(digest,digestBase(),digest.tries);if(owedDigest===digest)owedDigest=fresh;digest=fresh;}
  if(digest){Object.assign(body,digest.item);if(based){versions.digest=digest.base.digest;if(Array.isArray(digest.item.digest?.reviews))versions.reviews=digest.base.reviews;}}
  if(Object.keys(versions).length)body.versions=versions;
  const seq=++order,job={settings:mine,digest,sent:true,carries:!!value};jobs.add(job);
  clearTimeout(retryTimer);retryTimer=null;
  const run=bounded(Promise.resolve(request('sync',body,{keepalive:true,...(leaving?{leaving:true}:{}),onWait:()=>{job.sent=false;},onSent:()=>{job.sent=true;}})));
  run.then(data=>{
   jobs.delete(job);if(!current(expected))return;
   const active=data?.account?.active===true,applied=data?.applied||{},v=serverVersions(data);
   // 이 응답이 지금 적힌 상태보다 앞에 처리된 것이면 지금 상태의 판이 아는 가장 새 판이다(r4 GA5).
   const older=progress(data)<0,newest=older?state.versions:v;
   // 설정: 받혔으면 그 편집을 비우고, 그사이 이 브라우저에서 같은 바탕으로 한 더 새 편집은 바탕을 방금 쓴 판으로 옮긴다(자기 쓰기 사슬 — 다음 맞추기가
   // 「그사이 다른 쓰기」로 보지 않게). 거절됐으면(그사이 다른 쓰기) 그 편집의 첫 거절이면 아는 가장 새 판을 바탕으로 옮겨 한 번 다시 보내고 — 학생의
   // 마지막 뜻이 이긴다 — 이미 한 번 거절된 편집이면 비워 서버 것을 들이고 멈춘다(설계 주인 규칙 4). 같은 편집은 id로 알아본다 — 자기 쓰기 사슬이 바탕을
   // 옮긴 편집도 같은 편집이다(r4 GA3). 다시 보내기는 아래 맞추기가 한다.
   if(mine&&active&&v){
    const latest=readEdit();
    if(applied.settings===true){
     if(latest?.id===mine.id)rewrite(latest,null);
     else if(latest?.page===page&&latest.known&&latest.base===mine.base)rewrite(latest,rebase(latest,v.settings));
    }else if(latest?.id===mine.id)rewrite(latest,latest.tries>0||otherPlan(latest,older?state.planId:positive(data.planId))?null:rebase(latest,newest.settings,{tries:1}));
   }
   // 요약의 자기 쓰기 사슬: 이 요청의 요약 · 복습 때가 받혔으면, 그 뒤에 지은(모은) 아직 나가지 않은 요약 가운데 같은 바탕인 것의 바탕을 방금 쓴 판으로
   // 옮긴다 — 자기 요약끼리 거절하지 않게(설계 검토 3).
   if(digest?.base&&active&&v){
    const move=item=>{if(!item?.base||item===digest||digestOut(item))return item;const base={...item.base};let moved=false;
     if(applied.digest===true&&base.digest===digest.base.digest){base.digest=v.digest;moved=true;}
     if(applied.reviews===true&&base.reviews===digest.base.reviews){base.reviews=v.reviews;moved=true;}
     return moved?{...item,base}:item;};
    owedDigest=move(owedDigest);pendingSync=move(pendingSync);
   }
   // 요약: 받혔거나 2단이 꺼진 계정이면 끝. 거절됐으면 처음 한 번만 지금 기록으로 새로 지어 아는 가장 새 판을 바탕으로 다시 보낸다.
   if(digest&&owedDigest===digest){
    const rejected=active&&!!v&&!!body.versions&&Object.hasOwn(body.versions,'digest')&&(applied.digest!==true||Object.hasOwn(body.versions,'reviews')&&applied.reviews!==true);
    owedDigest=rejected&&digest.tries===0?rebuilt(digest,{digest:newest.digest,reviews:newest.reviews}):null;
   }
   retryStep=0;
   if(newer(seq,data)){shown.account=Math.max(shown.account,seq);applyStatus(data,expected,{device:false,seq});}else reconcile(expected);
   flushLegacy(expected);
   if(owedDigest&&jobs.size===0)deliver(expected,{settings:false});
   if(owedDigest||owedSettings())later(expected);
  },error=>{
   jobs.delete(job);if(!current(expected))return;
   const status=Number(error?.status),code=error?.code||'PUSH_UNAVAILABLE';
   // 판을 실은 요청이 400 INVALID_ACTION — 판을 모르는 옛 서버로 되돌렸다(옛 서버는 모르는 칸 versions를 이렇게 거절한다). 판 쓰기를 끄고 지금 덩어리와
   // 지금 요약을 판 없이 한 번 다시 보낸다(GA10 · r2 GA1). 다음 status가 다시 정한다.
   if(status===400&&code==='INVALID_ACTION'&&body.versions){
    emit({versioning:false});
    // 이 페이지의 지금 편집(이 요청의 편집이거나 더 새 편집)을 판 없이 한 번 보낸다 — 옛 서버 구간은 판 키를 쓰지 않으므로 편집을 비운다. 설정을 실은
    // 다른 요청이 날아가는 중이면 그 응답 뒤에 보낸다(r4 GA9 · GA12).
    // 미뤄 둔 설정이 이미 있으면 그것이 이 편집보다 새것이다(옛 서버 구간에서 바꿨다). 보내기는 미뤄 둔 몫을 거친다 — 설정을 실은 다른 요청이 날아가는
    // 중이면 그 응답 뒤에, 아니면 바로(r5 GA5 · GA8 · GA10: 앞 400이 미뤄 둔 몫을 뒤 400이 놓치지 않게).
    const latest=readEdit();
    if(latest&&latest.page===page){rewrite(latest,null);if(!legacyPending)legacyPending={frequency:latest.frequency,hour:latest.hour??null};}
    flushLegacy(expected);
    if(owedDigest&&!digestOut(owedDigest))deliver(expected,{settings:false});
    return;
   }
   // 400 · 413: 그 부분을 버린다. 요약이 틀렸으면 설정만 다시 보내고, 설정이 틀렸으면 덩어리를 비운다(맞추기가 1단을 서버 값으로 맞춘다).
   // 401 · 로그인: 다시 로그인한 뒤 상태를 읽으면 맞추기가 보낸다.
   if(status===400||status===413){
    const digestFault=!!digest&&(status===413||code==='INVALID_DIGEST'||code==='INVALID_HANDOVER');
    if(digest&&owedDigest===digest)owedDigest=null;
    if(mine&&!digestFault){const latest=readEdit();if(latest?.id===mine.id)rewrite(latest,null);reconcile(expected);}
    else if(owedSettings())later(expected,0);
   }
   else if(status!==401&&code!=='AUTH_REQUIRED'){
    later(expected);
    // 이 요청의 설정 뒤에 이 페이지가 적은 편집이 기다리고 있었다 — 앞 요청이 끝났으니 맞추기가 그 편집을 다룬다(r6 GA3: 시간 초과 뒤 기다리던 편집이
    // 다음 상태 읽기까지 묶이지 않게). 그 편집의 요청이 또 실패하면 여기 오지 않는다(되풀이 없음 — 다시 보내기는 later).
    if(mine){const latest=readEdit();if(latest&&latest.page===page&&latest.id!==mine.id)reconcile(expected);}
   }
   flushLegacy(expected);
   if(seq>shown.account)emit({error:code});
  });
  return run;
 }
 // 남은 것을 보낸다: 설정이 있으면 설정과 남은 요약을 함께, 없으면 요약만.
 function resend(expected){if(owedSettings())deliver(expected);else if(owedDigest)deliver(expected,{settings:false});}
 function later(expected,delay){
  if(retryTimer||!current(expected)||closing||!state.account.active||!(owedDigest||owedSettings()))return;
  const wait=delay??RETRY_MS[Math.min(retryStep,RETRY_MS.length-1)];if(delay===undefined)retryStep++;
  retryTimer=setTimeout(()=>{retryTimer=null;if(!current(expected))return;if(jobs.size>0){later(expected);return;}resend(expected);},wait);
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
 // 응답을 상태로 적는다. device: 이 응답의 기기 칸을 적나(sync 응답에는 기기 칸이 없다 — 적으면 「이 기기 꺼짐」이 되어 1단을 꺼도 구독이 남는다, 설계 검토 3).
 // 판: 응답에 versioning:'base'가 있으면 바탕 판을 아는 서버다(그때만 바탕을 싣는다). 저장된 판은 응답마다 새로 받는다.
 // seenSeq: 이 상태를 적은 응답의 요청 차례 — 그 요청이 어떤 편집보다 뒤에 나갔는지 가린다(r8 GA2 · GA3).
 function applyStatus(data,expected,{phase='ready',device=true,seq=order}={}){
  guard(expected);
  if(data.enabled===true&&typeof data.publicKey==='string'){try{publicKey=decodeVapidKey(data.publicKey,env.atob||globalThis.atob);}catch{publicKey=null;}}
  else if(data.enabled!==true)publicKey=null;
  const value=emit({phase,enabled:data.enabled===true&&!!publicKey,...(device?{device:deviceOf(data)}:{}),account:accountOf(data),plan:data.plan||null,checkedAt:now(),error:null,
   versions:serverVersions(data),versioning:data.versioning==='base',planId:positive(data.planId),seenSeq:Math.max(state.seenSeq,seq)});
  reconcile(expected);
  return value;
 }
 // 켜기 · 끄기가 끝났다: 그 전에 시작한 요청의 응답은 옛것이다.
 const settled=()=>{shown.account=shown.device=++order;};
 // status 응답을 차례대로 적는다. 돌려주는 값: 기기 칸이 가장 새것인가(이 브라우저 구독 정리는 그때만 한다 — 설계 검토 7).
 // device: 이 읽기를 기기 응답으로 세나. 화면 맞추기 읽기(정리하지 않는 읽기)는 세지 않는다 — 세면 그보다 앞서 보낸 평소 읽기가 늦게 와서 낡은
 // 응답으로 보여 이 브라우저 구독 · 기기 기록 정리를 건너뛴다(r16 GA1: 사라진 구독의 기기 기록과 켜진 계획이 남아 1단이 쉰다).
 function applyRead(seq,data,expected,phase,device=true){
  const fresh=device&&seq>shown.device;if(fresh)shown.device=seq;
  if(newer(seq,data)){shown.account=Math.max(shown.account,seq);applyStatus(data,expected,{phase,device:fresh,seq});}
  // 판으로 견줄 수 있는데 상태로 적지 않은 읽기는 판이 지금 상태보다 크지 않다 — 지금 상태는 서버에서 그 읽기와 같거나 뒤에 처리됐다. 그 읽기를 보낸
  // 때까지 본 것으로 센다(r10 GA1 · GA8: 켜기의 늦은 응답이 차례를 올려 같은 판의 넘겨받기 전 다시 읽기를 적지 않아도 편집이 묶이지 않게).
  else{guard(expected);if(fresh)emit({device:deviceOf(data)});if(seq>state.seenSeq&&comparable(data))emit({seenSeq:seq});reconcile(expected);}
  return fresh;
 }
 // 계정의 2단 상태를 다시 읽는다. 이 브라우저 구독이 이 계정 것인데 서버에 없으면(정리·404·늦은 옛 응답) 새 구독으로 다시 잇는다(reconnect).
 // 이 브라우저가 받을 수 없어도(아이폰·푸시 없는 브라우저) 설정을 열 때와 1단이 띄우기 직전에는 계정 상태만 읽는다 — 다른 기기에서 켜 두었으면
 // 1단이 쉬고 설정에 그 기기로 간다고 적는다. 계정이 바뀐 직후(initial)에는 읽지 않는다(받을 수 없는 기기에서 열 때마다 부르지 않게).
 // tidy: 이 브라우저 구독 · 기기 기록을 정리하는 읽기인가. 화면 맞추기 읽기는 정리하지 않는다 — 읽기가 날아가는 동안 다른 탭이 이 브라우저 알림을 켜면,
 // 늦은 응답이 그 새 구독을 지난 것으로 보고 지운다(r14 GA1). 정리는 평소 읽기(설정 열기 · 1단이 띄우기 직전)가 한다.
 async function refresh({install=false,initial=false,tidy=true}={}){
  const expected=epoch;if(!current(expected)||closing)return snapshot();
  const support=worldPushSupport(env);
  if(!support.supported){
   if(initial||support.reason==='desktop')return emit({phase:'unsupported',enabled:false});
   try{const seq=++order,data=await request('status',{});applyRead(seq,data,expected,'unsupported');return emit({enabled:false});}
   catch(error){if(current(expected))emit({phase:'unsupported',enabled:false,error:error.code||'PUSH_UNAVAILABLE'});return snapshot();}
  }
  try{
   const reg=install?await register(expected):await existing();guard(expected);
   const sub=reg?await bounded(reg.pushManager.getSubscription()):null;guard(expected);subscription=sub;
   const seq=++order,mark=JSON.stringify(readRecord()),data=await request('status',sub?{endpoint:sub.endpoint}:{});
   if(!applyRead(seq,data,expected,'ready',tidy))return snapshot();   // 화면 맞추기 읽기는 기기 응답이 아니라 여기서 멈춘다(정리하지 않는다)
   // 읽기가 날아가는 사이 같은 브라우저의 다른 탭이 기기 기록을 바꿨으면(켜기 · 끄기) 이 응답으로 정리하지 않는다 — 그 탭이 방금 켠 구독의
   // 기록을 지우고 서버에서 끄게 된다(r17 Fable 설계 검토: 화면은 「켜짐」인데 알림이 오지 않는다). 정리는 다음 평소 읽기가 한다.
   const next=snapshot(),record=readRecord();if(JSON.stringify(record)!==mark)return snapshot();
   // 이 브라우저 구독의 주인 기록이 이 계정이면, 기록의 주소가 지금 구독과 달라도(다른 탭의 늦은 등록이 옛 주소를 남겼다) 다시 잇는다 — 다음 평소 읽기가 늘
   // 바로잡는다(GPT r19 GA2, 설계 주인 11-23 불변식 1). 다른 계정 기록이면 그 계정 구독이라 두지 않는다.
   if(sub&&!next.device.subscribed&&record?.accountId===owner)return reconnect(sub,reg,expected);
   else if(!sub&&record?.accountId===owner){writeRecord(null);try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}
   return snapshot();
  }catch(error){if(current(expected))emit({phase:state.phase==='ready'?'ready':'error',error:error.code||'PUSH_UNAVAILABLE'});return snapshot();}
 }
 // 불변식(설계 주인 11-23): 이 브라우저에서 켠 동안에는 어떤 길도 이 브라우저 구독을 지운 채로 끝나지 않는다. 지우기만 하는 것은 끄기 · 로그아웃뿐이다.
 // 상태 읽기가 이 브라우저 구독이 서버에 없다고 하면(만료 · 서버 정리 · 다른 탭이 같은 구독으로 다시 켜기 전에 보낸 늦은 옛 응답) 옛 구독을 지우고 새 구독으로
 // 서버에 다시 올린다(켜기와 같은 길 — 설정은 1단 값, 요약은 1단이 지금 기록으로 짓는다). 그래서 낡은 응답이 와도 끝은 「켜짐 + 서버에 오른 구독」이다.
 // 다시 올린 구독도 서버가 곧바로 없다고 하면 한 번만 더 해 보고 멈춘다 — 켜기가 남긴 오류와 꺼진 기기 칸이 설정 화면에 보여 학생이 다시 켠다.
 // 알림 기능이 꺼졌거나(비상 스위치) 권한이 허용이 아니거나 이 탭이 켜기 · 끄기 중이면 하지 않는다(지우지도 않는다). 1단 설정 묶음이 아직 붙지 않아 보낼
 // 설정 · 요약이 없을 때도 하지 않는다 — 서버가 빈 설정을 거절해 두 번 다 실패하고 구독만 지운다(GPT r18 GA4). 묶음이 붙은 뒤의 평소 읽기가 다시 잇는다.
 // 막지 않는 logout()을 부른 계정이면 하지 않는다 — 끄는 사이나 끈 뒤에 다시 올리면 로그아웃하는 계정의 구독이 서버에 남는다(5-3 섞임 표 4).
 // 옛 구독을 지우는 사이 그 logout()이 돌았으면 켜기를 부르기 전에 멈춘다.
 async function reconnect(sub,reg,expected){
  if(!current(expected)||closing||leftOwner===owner||mutation||attempt||!state.enabled||worldPushSupport(env).permission!=='granted')return snapshot();
  const settings=liveSettings(null);let made=null;try{made=binding?.digest?.()||null;}catch{}
  if(!settings||!made?.digest)return snapshot();
  if(!registration)registration=reg;
  for(let tries=0;tries<2;tries++){
   if(sub){await removeLocal(sub,reg);sub=null;}
   if(!current(expected)||leftOwner===owner)return snapshot();
   // 요약은 켜기를 부르기 바로 앞에 다시 짓는다 — 옛 구독을 지우는 동안 sync가 더 새 요약을 저장했으면, 앞서 지은 옛 요약이 그 뒤의 판을 바탕으로
   // 실려 서버 판 검사를 지나 요약을 되돌린다(GPT r19 GA3). 켜기는 부른 그때의 판을 바탕으로 잡는다.
   try{made=binding?.digest?.()||made;}catch{}
   const value=await api.enable({settings,digest:made.digest,handover:Array.isArray(made.handover)?made.handover:[]});
   if(!current(expected)||value.device?.subscribed)return value;
  }
  return snapshot();
 }
 // 실패한 켜기가 날아가는 동안 적은 편집을 지운다(r8 GA1 — 남기면 나중에 다른 기기가 켠 계획을 덮는다). 그 뒤에 적은 편집(다른 id)은 둔다. 그사이 로그아웃했거나
 // 계정을 바꿨으면 그 계정의 편집은 그때 이미 버렸다(dropEdits) — 지금 계정 키에는 이 켜기의 편집이 없다.
 function dropAttemptEdits(run){const left=readEdit();if(left&&run.edits.has(left.id))writeEdit(null);run.edits.clear();}
 // 로그아웃하거나 계정이 바뀌면 그 계정에서 서버가 확인하지 않은 설정 편집을 버린다 — 탭이 함께 쓰는 판 키에서도 지운다. 다시 로그인하면 서버 설정을 그대로
 // 쓰고, 서버가 이미 받은 것은 서버에 있다(설계 주인 11-23: 확인받지 못한 편집을 로그아웃 너머로 나르지 않는다).
 function dropEdits(){if(owner){try{storage?.removeItem(versionKey());}catch{}}}
 // 이 탭 화면을 서버 설정에 맞춘다(설계 주인 11-23, r13 GA1): 다른 탭이 나눠 쓰는 편집을 지웠거나(로그아웃 · 계정 바꿈) 다시 시도할 때 보낼 것이 없는데
 // 화면(1단 설정)이 이 탭이 마지막으로 받은 서버 설정과 다르면, 상태를 한 번 읽는다 — 맞추기가 그 서버 설정을 들인다. 1단은 탭이 함께 쓰므로 마지막으로
 // 받은 값을 바로 들이지 않는다(다른 탭에서 방금 받힌 더 새 설정을 되돌리지 않게). force: 견주지 않고 읽는다 — 다른 탭이 판 키를 지웠을 때(받힘 ·
 // 로그아웃 · 계정 바꿈)는 늘 그렇게 한다. 마지막으로 받은 값이 화면과 우연히 같아도 서버는 그사이 바뀌었을 수 있고(r14 GA3), 앞 화면 맞추기 읽기가 늦는
 // 사이 다른 탭이 저장했으면 그 뒤에 보낸 읽기가 있어야 늦은 옛 응답을 판의 차례로 버린다(r15 GA1). 다시 시도는 앞 읽기가 실패했을 때 견주지 않는다(r15
 // GA3 — 실패한 읽기 뒤 마지막으로 받은 값이 화면과 같아 묶이지 않게). 보낼 편집이 있으면 하지 않고 쓰기 요청은 내지 않는다(정리하지 않는 읽기). 이 탭이
 // 로그아웃했거나 계정이 바뀌었으면 하지 않는다.
 function showServer(force=false){
  if(!current(epoch)||closing||readEdit()||!state.versioning||!state.account.active||!state.checkedAt||!state.plan)return;
  const live=liveSettings(null),plan=state.plan,hour=Number.isFinite(plan.hour)?plan.hour:null;
  if(!force&&(!live||(live.frequency===plan.frequency&&live.hour===hour)))return;
  void refresh({tidy:false});
 }
 const onStorage=event=>{if(event&&(event.key===null||(event.key===versionKey()&&event.newValue==null)))showServer(true);};
 try{env.addEventListener?.('storage',onStorage);}catch{}
 // 로그아웃의 끄기: 이 브라우저 구독이 이 계정 것이면 서버와 브라우저에서 끈다(옛 logout()의 몸 그대로).
 async function unsubscribeOwner(){
  const record=readRecord();if(record?.accountId!==owner)return {ok:true};
  const reg=await existing(),sub=reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null;
  let server=false;
  try{await request('unsubscribe',{endpoint:record.endpoint});server=true;}
  catch{try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});server=true;}catch{}}
  const removed=sub&&sub.endpoint===record.endpoint?await removeLocal(sub,reg):true;
  if(removed)writeRecord(null);
  return {ok:server||removed};
 }
 const api={
  snapshot,refresh,
  // 상태가 바뀔 때마다 부를 함수(설정 화면의 동의 상자 단추·안내 글). 떼는 함수를 돌려준다.
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  // 이 탭의 계정. 바뀌면 상태를 새로 읽는다(이 브라우저 구독은 지우지 않는다 — 지우는 것은 끄기·로그아웃·다른 계정이 켤 때뿐).
  setAccount(accountId){
   const next=typeof accountId==='string'&&accountId?accountId:null;if(next===owner&&!closing)return Promise.resolve(snapshot());
   if(next!==owner)dropEdits();   // 앞 계정에서 확인받지 못한 편집은 버린다(설계 주인 11-23)
   epoch++;owner=next;closing=false;leftOwner=null;publicKey=null;lastSync=null;clearTimeout(syncTimer);syncTimer=null;pendingSync=null;holdPage();claimRead=null;
   // 앞 계정의 다시 보내기 · 넘겨받기 읽기도 거둔다.
   clearTimeout(retryTimer);retryTimer=null;retryStep=0;owedDigest=null;legacyPending=null;claiming=null;jobs.clear();
   // 앞 계정이 띄운 권한 창 기다리기는 끝낸다(늦게 허용돼도 지운다) — 새 계정이 바로 켤 수 있게.
   if(attempt){attempt.stop();attempt=null;}mutation=null;
   emit({phase:next?'loading':'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false,versions:null,versioning:false,planId:null});
   return next?refresh({initial:true}):Promise.resolve(snapshot());
  },
  // 설정을 열 때: 서비스 워커를 등록해 두고 공개 키를 받아 둔다(「동의하고 켜기」의 subscribe가 그 동작 안에서 바로 부를 수 있게).
  // 받을 수 없는 기기는 등록하지 않고 계정 상태만 읽는다(다른 기기로 간다는 안내).
  ready(){return owner&&!closing?refresh({install:worldPushSupport(env).supported}):Promise.resolve(snapshot());},
  // 마지막으로 읽은 상태가 maxAge보다 오래됐으면 다시 읽는다(1단이 띄우기 직전 — 설계 §6-1). 못 읽으면 마지막으로 안 상태. 기기 시계를 뒤로 맞췄어도 오래된 것으로 본다.
  async fresh(maxAge=10*60000){if(!owner||closing||state.phase==='signed-out')return snapshot();if(Math.abs(now()-state.checkedAt)<=maxAge)return snapshot();return refresh();},
  // 켜기 — 반드시 누른 동작 안에서 부른다. settings·digest·handover는 서버 계획의 시작(설계 §6-3).
  enable({settings,digest,handover=[]}={}){
   // 날아가는 동안 막지 않는 logout()이 돌면 멈춘다 — 로그아웃은 기록의 옛 주소만 끄므로, 그대로 끝나면 방금 만든 구독과 기록이 로그아웃한 계정으로 남는다.
   const expected=epoch,left=leaves,stay=()=>{guard(expected);if(leaves!==left)throw Object.assign(Error('ACCOUNT_CHANGED'),{code:'ACCOUNT_CHANGED'});};
   // 멈춘 켜기의 정리는 다른 계정 기록의 이 브라우저 구독을 두고 간다 — 이 계정의 켜기 요청을 보내기 전이면(asked) 서버에 이 계정의 줄이 없고, 넘겨받기가 그
   // 계정의 서버 줄을 지웠더라도 그 계정의 다음 평소 읽기가 남은 구독을 보고 다시 잇는다(GPT mix53 GA2 · r2). 켜기 요청을 보냈으면 서버에 이 계정의 줄이 있을 수
   // 있어 지운다 — 두면 로그아웃한 계정의 알림이 이 브라우저에 온다.
   const me=owner,theirs=value=>{const record=readRecord();return !!value&&!!record&&record.accountId!==me&&record.endpoint===value.endpoint;};
   if(!current(expected)||closing||mutation||attempt)return Promise.resolve(snapshot());
   // 요약 바탕은 누를 때(요약을 지은 때) 잡는다 — 권한 창 사이에 읽은 새 판이 누를 때의 요약에 붙지 않게(r4 GA11).
   const pressed=digest?digestBase():null;
   if(!registration||!publicKey)return Promise.resolve(emit({error:'PUSH_NOT_READY'}));
   if(worldPushSupport(env).permission==='denied')return Promise.resolve(emit({error:'PUSH_BLOCKED'}));
   let prompt;
   try{prompt=registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});}
   catch(error){return Promise.resolve(emit({error:error?.name==='NotAllowedError'?'PUSH_DENIED':'PUSH_UNAVAILABLE'}));}
   // 권한 창 기다리기: 30초가 지나거나 계정이 바뀌면(stop) 기다림을 끝내 켜기를 바로 「응답 없음」으로 마치고 단추를 다시 쓸 수 있게 한다.
   // 그 뒤에 허용된 구독은 받는 대로 지운다(10-22 화면 검수 — 끝나지 않는 권한 창에 켜기가 영영 묶였다).
   const STOP=Symbol('stop');let stopWait;
   const waiting={cancelled:false,timer:null,edits:new Set(),stop:()=>{waiting.cancelled=true;clearTimeout(waiting.timer);stopWait(STOP);}};attempt=waiting;
   const stopped=new Promise(resolve=>{stopWait=resolve;});
   waiting.timer=setTimeout(()=>waiting.stop(),PERMISSION_WAIT_MS);
   Promise.resolve(prompt).then(late=>{if(waiting.cancelled&&late&&!theirs(late))void removeLocal(late,registration);},()=>{});
   emit({busy:true,error:null});
   let sub=null,asked=false;
   const pending=(async()=>{
    try{
     const first=await Promise.race([prompt,stopped]);clearTimeout(waiting.timer);
     if(first===STOP)throw Object.assign(Error('PUSH_TIMEOUT'),{code:'PUSH_TIMEOUT'});
     sub=first;
     stay();subscription=sub;
     // 이 브라우저 구독이 다른 계정 것이면 그 동작에서 가져간다(앞 계정의 이 브라우저 구독을 서버에서 지운다).
     const record=readRecord();
     if(record&&record.accountId!==owner&&record.endpoint===sub.endpoint){try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}
     stay();   // 넘겨받기 응답을 기다리는 사이 막지 않는 logout이 돌았으면 켜기 요청을 보내지 않는다(GPT mix53 GA1)
     const json=sub.toJSON?sub.toJSON():{endpoint:sub.endpoint,keys:sub.keys};
     // 바탕 판은 보낼 때 아는 요약 · 복습 때 판이다(판을 아는 서버일 때만). 설정 바탕은 싣지 않는다 — 이미 켠 계정이면 서버가 계정 설정을 두고(GA3),
     // 처음 켜는 계정이면 바탕과 상관없이 새 줄을 쓴다. 보내지 못한 편집은 응답 뒤 맞추기가 sync로 보낸다. 요약이 거절되면(권한 창 사이 다른 기기의
     // 요약) 새로 지어 한 번 다시 보낸다.
     // 누를 때 판을 몰랐는데(옛 서버 · 상태 모름) 보낼 때 판을 아는 서버면, 1단이 지금 기록으로 새로 지은 요약을 지금 판과 함께 싣는다 — 누를 때의
     // 요약이 바탕 없이 다른 기기의 더 새 요약을 덮지 않게(r5 GA9). 새로 지을 수 없으면 누를 때의 요약을 판 없이 보낸다(앞과 같다).
     let base=pressed;
     if(state.versioning&&digest&&!pressed){let fresh=null;try{fresh=binding?.digest?.()||null;}catch{}const now=digestBase();
      if(fresh?.digest&&now){digest=fresh.digest;if(Array.isArray(fresh.handover))handover=fresh.handover;base=now;}}
     const item={digest,...(Array.isArray(handover)&&handover.length?{handover}:{})};
     const versions=state.versioning&&base?{digest:base.digest,...(Array.isArray(digest.reviews)?{reviews:base.reviews}:{})}:null;
     // 보낼 설정은 보낼 때의 1단 값이다 — 권한 창이 열린 사이 이 탭이나 다른 탭에서 바꾼 설정이 누를 때의 값에 지지 않게(GPT push-versions-world-r3 GA1).
     const sent=liveSettings(settings);
     const payload={subscription:{endpoint:json.endpoint,keys:{p256dh:json.keys?.p256dh,auth:json.keys?.auth}},settings:sent,digest,handover,consent:1};
     let data,based=!!versions;
     const sentSeq=++order;   // 켜기 요청을 보낸 때의 차례 — 응답을 상태로 적을 때 쓴다(r9 GA4 · GA11)
     asked=true;
     try{data=await request('subscribe',{...payload,...(versions?{versions}:{})});}
     catch(error){
      // 판 때문에 400 INVALID_ACTION — 판을 모르는 옛 서버다(권한 창 사이에 되돌렸을 수 있다 — r2 GA2). 판 없이 한 번 다시 보낸다.
      if(!versions||Number(error?.status)!==400||error?.code!=='INVALID_ACTION')throw error;
      stay();emit({versioning:false});based=false;data=await request('subscribe',payload);
     }
     stay();
     if(data.device?.subscribed!==true)throw Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'});
     const mine={accountId:owner,deviceId:data.device.deviceId,endpoint:sub.endpoint};
     // 요청이 날아가는 사이 이 브라우저 구독이 바뀌었는지 본다(r18). 다른 탭이 새 구독으로 다시 이었으면 그 탭이 기록을 쓴다 — 여기서 옛 주소로 덮으면
     // 로그아웃 · 끄기가 옛 주소만 끄고 새 구독이 남는다. 구독이 아예 없어졌으면 「켜짐」으로 적지 않고 실패로 끝낸다(기록은 남겨 다음 평소 읽기가 서버의
     // 그 기기를 끄게 한다). 구독을 읽지 못하면 그대로 간다.
     let still=sub;try{still=await bounded(registration.pushManager.getSubscription());}catch{}
     stay();
     if(!still){writeRecord(mine);throw Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'});}
     if(still.endpoint===sub.endpoint)writeRecord(mine);
     else{
      // 서버는 한 로그인 세션에 주소 하나를 두고 마지막 subscribe로 덮는다. 이 요청이 그 탭의 새 주소 등록 뒤에 닿았으면 서버에는 옛 주소만 남는다(GPT r18
      // GA2 · GA6). 지금 구독으로 한 번 더 올리고 그 주소로 기록을 쓴다. 실패하면 그 탭의 기록을 둔다.
      subscription=still;
      const now=still.toJSON?still.toJSON():{endpoint:still.endpoint,keys:still.keys};
      try{const again=await request('subscribe',{...payload,subscription:{endpoint:now.endpoint,keys:{p256dh:now.keys?.p256dh,auth:now.keys?.auth}},...(based&&versions?{versions}:{})});
       let cur=still;try{cur=await bounded(registration.pushManager.getSubscription());}catch{}
       stay();if(again.device?.subscribed===true&&cur?.endpoint===still.endpoint)writeRecord({accountId:owner,deviceId:again.device.deviceId,endpoint:still.endpoint});}
      catch(error){if(error?.code==='ACCOUNT_CHANGED')throw error;}
      stay();   // 다시 올리기가 실패해도 그사이 막지 않는 logout이 돌았으면 멈춘다(GPT mix53 GA3)
     }
     // 켜며 보낸 요약을 sync와 같은 표로 적는다 — 켠 바로 뒤 다시 잡기가 같은 요약을 또 보내지 않게(10-22 화면 검수).
     lastSync=digest?syncMark(item,stamp()):null;
     const applied=data.applied||{},rejected=based&&digest&&(applied.digest!==true||Array.isArray(digest.reviews)&&applied.reviews!==true);
     const v=serverVersions(data);
     if(rejected)owedDigest=rebuilt({item,tries:0},v?{digest:v.digest,reviews:v.reviews}:null);
     // 처음 켠 계정이면 서버는 보낸 설정(보낼 때의 1단 값)으로 새 계획을 썼다 — 그 전의 편집은 모두 지난 것이라 비운다(r4 GA4 · GA8). 요청이 날아가는
     // 사이 1단이 바뀌었으면(학생이 이 탭이나 다른 탭에서 바꿨다 — 꺼진 계정이라 편집으로 적히지 않았다) 새 판을 바탕으로 편집으로 적어 결과를 적으며
     // 맞추기가 보낸다(r3 GA1).
     // 다른 페이지가 새 계획을 읽고 쓴 편집(바탕이 새 계획의 판 이상)은 그 페이지 것이라 두고, 1단이 바뀐 것도 그 페이지가 보낸다(r5 GA6). 이 탭이 켜기를
     // 기다리며 바꾼 설정은 편집으로 적혀 있다(r7 GA4). 미뤄 둔 옛 서버 설정은 여기서 버리지 않는다 — 계정이 꺼진 상태를 적을 때 버렸고(emit), 이미 켠 계정에
     // 이 기기를 더한 켜기는 설정을 보내지 않으므로 두고 간다(r7 GA1).
     const kept=readEdit(),after=liveSettings(null),theirs=!!kept&&kept.page!==page&&kept.known&&kept.base!=null&&v?.settings!=null&&kept.base>=v.settings;
     if(applied.settings===true&&!theirs){
      const moved=data.versioning==='base'&&!!v?.settings&&!!after&&!!sent&&(after.frequency!==sent.frequency||after.hour!==sent.hour);
      writeEdit(moved?{frequency:after.frequency,hour:after.hour,base:v.settings,known:true,tries:0,id:newId(),page,at:now(),planId:positive(data.planId)}:null);
     }
     // 차례를 먼저 올린다 — 결과를 적으며 맞추기가 시작한 sync의 응답이 옛것으로 버려지지 않게(r2 GA6).
     if(leftOwner===owner)leftOwner=null;   // 그 logout이 실패해 계정이 그대로이고 학생이 다시 켰다 — 다시 잇기도 다시 한다
     settled();applyStatus(data,expected,{seq:sentSeq});
     if(owedDigest&&jobs.size===0)deliver(expected,{settings:false});
     if(attempt===waiting)attempt=null;
     return emit({busy:false});
    }catch(error){
     clearTimeout(waiting.timer);if(attempt===waiting)attempt=null;
     // 켜기가 날아가는 동안 적은 편집은 지운다 — 계정은 여전히 꺼져 있고 1단 값은 다음 켜기가 보낸다. 남기면 나중에 다른 기기가 켠 계획을 덮는다(r8 GA1).
     // 계정이 바뀌었으면 그 계정의 편집은 바꿀 때 이미 버렸다(dropEdits).
     dropAttemptEdits(waiting);
     // 서버 저장 실패·응답 유실·늦은 허용: 방금 만든 구독은 지운다(서버에 남았어도 이 브라우저는 그 알림을 못 띄운다).
     const removed=theirs(sub)&&!asked?true:await removeLocal(sub);
     const denied=error?.name==='NotAllowedError'||worldPushSupport(env).permission==='denied';
     // 막지 않는 logout()이 멈춘 켜기는 오류를 보이지 않는다 — 학생이 고른 로그아웃이다.
     if(current(expected))emit({busy:false,error:!removed?'PUSH_LOCAL_CLEANUP':leaves!==left?null:denied?'PUSH_DENIED':error?.code||'PUSH_UNAVAILABLE'});
     return snapshot();
    }finally{if(attempt===waiting)attempt=null;if(mutation===pending)mutation=null;}
   })();
   mutation=pending;return pending;
  },
  // 이 기기 끄기. 마지막 기기였으면 서버가 돌려준 보낸 기록·설정을 함께 돌려준다(기기 쪽이 1단 기록에 넣는다).
  // 돌려주는 값: {removed(이 브라우저 구독을 지웠다), handover?, settings?, account?}. 다른 켜기·끄기가 도는 중이면 null(아무것도 하지 않았다).
  async disable(){
   const expected=epoch;if(!current(expected)||closing||mutation)return null;
   emit({busy:true,error:null});
   const run=(async()=>{
    // 지금 브라우저 구독을 먼저 읽는다 — 다른 탭이 새 구독으로 다시 이었으면 이 탭이 기억한 옛 구독만 끄고 새 구독이 남는다(r18). 읽지 못하면 기억한 구독.
    // 기록이 다른 계정 것이면(다른 탭이 다른 계정으로 이 브라우저 구독을 켰다) 그 구독과 기록은 건드리지 않는다. 이 계정이 끌 것은 이 탭이 기억한 다른 주소뿐이고,
    // 이 브라우저에는 이 계정 구독이 없다(GPT r18 GA1 — 그 탭의 서버 구독 · 브라우저 구독 · 기록을 지웠다).
    const reg=await existing(),fresh=reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null,record=readRecord(),theirs=!!record&&record.accountId!==owner;
    const sub=theirs?(subscription&&subscription.endpoint!==record.endpoint?subscription:null):fresh||subscription;
    let result=null;
    if(sub){try{result=await request('unsubscribe',{endpoint:sub.endpoint});}catch{if(!theirs&&record?.endpoint===sub.endpoint){try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}}}
    // 끄기 요청이 날아가는 사이 다른 계정 탭이 이 브라우저 구독을 가져갔으면(기록이 그 계정 것으로 바뀌었다) 그 구독과 기록을 지우지 않는다(GPT r19 GA1).
    const after=readRecord(),taken=!theirs&&!!after&&after.accountId!==owner;
    const removed=theirs||taken?true:await removeLocal(sub,reg);
    if(removed&&!theirs&&!taken)writeRecord(null);
    let keep=false;
    if(current(expected)){
     settled();
     emit({busy:false,device:{subscribed:false},error:removed?null:'PUSH_LOCAL_CLEANUP'});
     if(result){
      const account=accountOf(result);emit({account,plan:account.active?state.plan:null});
      // 마지막 기기였다 — 기기 쪽이 서버 설정을 1단에 넣는다. 그때 이 브라우저에 보내지 못한 편집이 있으면(끄기 직전의 편집 · 다른 탭의 편집) 편집을
      // 두고 서버 설정을 돌려주지 않는다 — 1단이 그 편집을 지킨다(설계 검토 6 · r2 GA4).
      keep=!account.active&&!!result.settings&&!!readEdit();
     }
    }
    const {settings:returned,...rest}=result||{};
    return {...rest,...(returned!==undefined&&!keep?{settings:returned}:{}),removed};
   })();
   mutation=run;try{return await run;}finally{if(mutation===run)mutation=null;}
  },
  // 요약·설정 보내기(2단이 켜진 계정만). 요약에는 이 기기 1단이 보낸 줄(handover)도 싣는다 — 2단을 켜는 사이·비상 스위치로 1단이 띄운 알림도
  // 서버의 7일 창·하루 하나에 들어가게(설계 §6-3). 설정은 바로(모아 둔 요약이 있으면 함께). 요약은 바뀌었을 때 5분에 한 번까지(모인 것 중 마지막)
  // · 「오늘 공부함」이나 보낸 줄이 새로 서면 바로 · 같아도 6시간마다 한 번. 보낸 것과 같은 요약으로 돌아오면 모아 둔 것을 버린다.
  sync({settings,digest,handover}={}){
   if(!owner||closing)return;
   // 판을 모르는 옛 서버면 이 탭이 바꾼 설정을 판 없이 한 번 보낸다(다시 보내지 않는다 — 다시 열 때마다 옛 값이 받은 때로 덮지 않게).
   // 그 밖에는 설정 편집을 덩어리로 적어 둔다 — 상태를 몰라도(망이 끊김 · 상태를 아직 못 읽음) 상태가 서면 맞추기가 보낸다(설계 검토 P2-7).
   const legacy=!!state.checkedAt&&!state.versioning;
   if(settings&&!legacy)noteSettings(settings);
   if(!state.account.active)return;
   const expected=epoch,time=stamp();
   // 요약 · 설정 요청은 모두 keepalive로 보낸다(deliver). 보낸 뒤 응답 전에 앱을 닫아도 계정 정리(stop)가 끊지 않는다(11-20 GPT 끝 판 GA1 ·
   // 다시 검수 GA1 · GA2 · GA3). 받히지 않으면 받을 때까지 다시 보낸다. 보낸 차례(seq)를 붙여 늦게 온 앞 응답은 뒤 응답이 그린 계획을 덮지 않는다.
   const make=value=>({item:value,tries:0,base:digestBase()});
   const send=value=>{if(value)owedDigest=value;return deliver(expected,{digest:value});};
   const drop=()=>{clearTimeout(syncTimer);syncTimer=null;pendingSync=null;};
   const item=digest?{digest,...(Array.isArray(handover)&&handover.length?{handover}:{})}:null;
   if(settings){
    const value=item?make(item):pendingSync;drop();if(value)lastSync=syncMark(value.item,time);
    // 판을 모르는 옛 서버: 지금 라이브처럼 이 페이지가 바꾼 설정을 판 없이 한 번 보내고 판 키에 적지 않는다(설계 주인 규칙 6, 설계 검토 1). 설정을 실은
    // 앞 요청이 날아가는 중이면 그 응답 뒤에 모은 요약과 함께 보낸다 — 이 페이지 안의 두 설정이 서버에 거꾸로 닿지 않게(r3 GA5 · GA10).
    if(legacy){if(value)owedDigest=value;
     const plain={frequency:settings.frequency,hour:settings.hour??null};
     if(settingsFlying()){legacyPending=plain;return null;}
     return deliver(expected,{digest:value,plain});}
    return send(value);
   }
   if(!item)return;
   // 「바뀌었나 · 급한가」는 보낸 것(진행 중 포함)과 견준다. 실패해도 lastSync를 되돌리지 않고 다시 보내기에 맡긴다 — 실패 → 오류 → 1단 다시 잡기
   // (400ms) → 다시 보냄의 고리가 없다(설계 검토 P2-3). 지난 때는 기기 시계와 performance.now() 가운데 더 많이 지난 쪽이다.
   const next=syncMark(item,time),changed=next.key!==lastSync?.key,urgent=next.day!==lastSync?.day||next.rows!==lastSync?.rows||next.known&&lastSync?.known===false;
   if(!changed&&elapsed(lastSync.stamp)<SYNC_REFRESH_MS){drop();return;}
   if(!lastSync||urgent||!changed||elapsed(lastSync.stamp)>=SYNC_GAP_MS){drop();lastSync=next;return send(make(item));}
   pendingSync=make(item);
   if(!syncTimer)syncTimer=setTimeout(()=>{syncTimer=null;const value=pendingSync;pendingSync=null;if(value&&current(expected)&&!closing&&state.account.active){lastSync=syncMark(value.item,stamp());send(value);}},Math.max(0,SYNC_GAP_MS-elapsed(lastSync.stamp)));
  },
  // 페이지를 떠날 때(pagehide · 화면 숨김): prepare(1단의 모으던 다시 잡기)를 「떠나는 중」으로 돌려 그 안에서 나가는 요청도 기다림 없이 가게 하고(GA1),
  // 아직 못 보낸 요약과 보낼 설정을 keepalive로 보낸다. 만료 전 토큰은 갱신하지 않고 그대로 쓴다(설계 검토 P2-5). 나가지 못해도 설정은 덩어리로 남아
  // 다음에 열 때 맞추기가 보낸다(GA3 · GA5). fetch가 이미 나간 설정 · 요약은 다시 보내지 않는다(앞 회차: 다른 탭의 새 설정을 덮었다).
  flush(prepare){
   leavingNow=true;
   try{
    try{prepare?.();}catch{}
    if(!owner||closing||!state.account.active)return;
    const expected=epoch;
    if(pendingSync){const value=pendingSync;pendingSync=null;clearTimeout(syncTimer);syncTimer=null;lastSync=syncMark(value.item,stamp());owedDigest=value;}
    const settings=!!owedSettings(true),digest=owedDigest&&!digestOut(owedDigest,true)?owedDigest:null;
    if(!settings&&!digest)return;
    try{deliver(expected,{leaving:true,digest,settings});}catch{}
   }finally{leavingNow=false;}
  },
  // 망이 돌아오거나 화면이 다시 보일 때: 남은 것을 바로 다시 보낸다(진행 중이면 기다린다). 상태를 모르면(한 번도 못 읽음 · 오류) 상태부터 읽는다 —
  // 읽으면 맞추기가 보낸다(GA9). 보낼 것이 없거나 2단이 꺼진 계정이면 부르지 않는다(받을 수 없는 기기에서 화면을 켤 때마다 부르지 않게).
  retry(){
   const expected=epoch;if(!current(expected)||closing)return;
   if(!readEdit()&&!owedDigest){showServer(!!state.error);return;}   // 보낼 것이 없으면 화면만 서버 설정에 맞춘다(r13 GA1 · 앞 읽기 실패면 r15 GA3)
   if(!state.checkedAt||state.phase==='error'){void refresh();return;}
   // 넘겨받을 편집 때문에 상태를 다시 읽다가 실패했으면 다시 읽는다 — 그 읽기의 응답이 정한다(r9 GA2 · GA8: 실패 뒤 편집이 묶이지 않게).
   if(claimRead&&state.seenSeq<=claimRead.after&&readEdit()?.id===claimRead.id){if(claimRead.reading)claimRead.again=true;else readClaim();return;}
   if(!state.account.active||jobs.size>0)return;
   clearTimeout(retryTimer);retryTimer=null;retryStep=0;reconcile(expected);if(jobs.size===0)resend(expected);
  },
  // 이 브라우저에 보내지 못한 설정 편집이 있나 — 기기 쪽이 끄기 결과의 서버 설정을 1단에 넣기 바로 앞에 한 번 더 본다(r4 GA10).
  hasEdit(){return !!owner&&!!readEdit();},
  // 1단 설정 묶음(world-reminder-device): read()는 이 브라우저의 1단 설정({frequency, hour, since}), adopt(값)은 서버 설정을 1단 설정에 넣는다
  // (설정 보내기를 부르지 않는다), digest()는 지금 기록으로 지은 요약({digest, handover?} — 거절된 요약을 다시 보낼 때). 떼는 함수를 돌려준다.
  bindSettings(value){binding=value&&typeof value.read==='function'&&typeof value.adopt==='function'?value:null;if(binding)reconcile(epoch);const bound=binding;return ()=>{if(binding===bound)binding=null;};},
  // 알림을 눌러 들어왔을 때 누름을 한 번 더 알린다(워커가 오프라인이라 못 알렸을 때 — 서버는 토큰을 한 번만 쓴다).
  ack(token){if(typeof token==='string'&&/^[A-Za-z0-9_-]{22}$/.test(token)){try{void anonymous('opened',{token}).catch(()=>{});}catch{}}},
  // 로그아웃 단추: 이 브라우저 구독이 이 계정 것이면 서버와 브라우저에서 끈다(로그아웃 전에, 토큰이 살아 있을 때).
  // hold(새 셸만 넘긴다): 시작부터 계정이 바뀔 때(setAccount)까지 새 요청과 판 키 쓰기를 막는다 — 그 사이(app-shell이 Atlas 표지 · client.logout을
  // 기다린다) 1단 다시 잡기의 요청이나 늦은 응답이 판 키를 다시 쓰지 않게(GA12 · 설계 검토 4). 앞서 시작한 요청의 응답은 버린다. 로그아웃이 실패하면
  // 셸이 resume()으로 막기를 푼다. 옵션 없는 logout()은 옛 뜻 그대로 끄기만 한다 — 캐시에 남은 옛 셸은 실패해도 resume을 부르지 않으므로, 막으면 그 탭의
  // 2단 요청이 멈춘다(「옛 이름은 옛 뜻, 새 뜻은 새 이름」, 5-3 섞임 표 4). 다만 날아가는 켜기는 멈추고, 계정이 바뀔 때까지 다시 잇지 않는다.
  async logout({hold=false}={}){
   if(!owner)return {ok:true};
   if(hold===true){
    // 확인받지 못한 편집 · 다시 보내기 · 넘겨받기 읽기를 버리고, 계정이 바뀌거나 resume()까지 그 계정으로 요청을 내지 않는다(설계 주인 11-23).
    dropEdits();closing=true;epoch++;releasePageHold();claimRead=null;
    clearTimeout(retryTimer);retryTimer=null;owedDigest=null;legacyPending=null;clearTimeout(syncTimer);syncTimer=null;pendingSync=null;jobs.clear();
    if(attempt){attempt.stop();attempt=null;}
    return unsubscribeOwner();
   }
   leftOwner=owner;leaves++;
   return unsubscribeOwner();
  },
  // 로그아웃이 실패해 계정이 그대로다: 막기를 풀고 상태를 다시 읽는다(맞추기가 남은 설정을 보낸다). 멈춘 켜기 · 끄기는 busy를 풀지 못하므로 여기서 푼다.
  resume(){if(!closing)return Promise.resolve(snapshot());closing=false;holdPage();emit({busy:false});return owner?refresh():Promise.resolve(snapshot());},
  dispose(){disposed=true;epoch++;releasePageHold();try{env.removeEventListener?.('storage',onStorage);}catch{}clearTimeout(syncTimer);syncTimer=null;clearTimeout(retryTimer);retryTimer=null;jobs.clear();binding=null;if(attempt){attempt.stop();attempt=null;}mutation=null;},
 };
 return api;
}
