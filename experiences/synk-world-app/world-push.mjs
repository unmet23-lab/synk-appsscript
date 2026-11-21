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
 let binding=null,retryTimer=null,retryStep=0,owedDigest=null,closing=false,leavingNow=false;
 const jobs=new Set(),listeners=new Set([onChange]);
 let state={phase:'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false,versions:null,versioning:false};
 const emit=patch=>{state={...state,...patch};const value=snapshot();for(const listener of listeners){try{listener(value);}catch{}}return value;};
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
 // (null = 아직 판이 없음). known: 그 판을 알았나(상태를 읽기 전에 바꾼 것은 거짓 — 상태가 서면 그때 판을 바탕으로 보낸다). tries: 거절된 횟수(0 · 1).
 const versionKey=()=>`${PUSH_VERSION_KEY}.${owner}`;
 const settingsOf=value=>!value||typeof value!=='object'||!Number.isFinite(value.frequency)?null
  :{frequency:value.frequency,hour:Number.isFinite(value.hour)?value.hour:null,base:positive(value.base),known:value.known===true,tries:value.tries===1?1:0};
 const readEdit=()=>{try{return settingsOf(JSON.parse(storage?.getItem(versionKey())||'null')?.settings);}catch{return null;}};
 const writeEdit=next=>{if(closing||!owner)return;try{next?storage?.setItem(versionKey(),JSON.stringify({settings:next})):storage?.removeItem(versionKey());}catch{}};
 const same=(a,b)=>!!a&&!!b&&a.frequency===b.frequency&&a.hour===b.hour&&a.base===b.base&&a.known===b.known&&a.tries===b.tries;
 // 덩어리를 그 덩어리일 때만 고친다(쓰기 직전에 다시 읽어, 다른 탭이 더 새 편집을 적었으면 두지 않는다).
 function rewrite(mine,next){if(same(readEdit(),mine))writeEdit(next);}
 const serverVersions=data=>{const v=data?.versions;return v&&typeof v==='object'?{settings:positive(v.settings),digest:positive(v.digest),reviews:positive(v.reviews)}:null;};
 const deviceOf=data=>data.device?.subscribed?{subscribed:true,deviceId:data.device.deviceId}:{subscribed:false};
 // 응답의 차례: 서버는 계획 줄을 잠그고 쓰므로 같은 계정의 응답은 부분마다 판이 함께 커지는 차례로 선다. 판이 하나라도 더 크면(작은 것은 없이) 서버가
 // 지금 적힌 상태보다 뒤에 처리한 응답이고(1), 더 작으면 앞에 처리한 응답이다(-1). 새 계획의 판은 받은 때라 옛 계획의 판보다 크다. 보낸 차례(seq)와
 // 서버에 닿은 차례는 다를 수 있다 — 둘 다 켜진 계정이고 판이 있으면 판으로 가리고, 모르면(0) 보낸 차례를 따른다.
 function progress(data){
  const v=serverVersions(data),mine=state.versions;
  if(!state.versioning||data?.versioning!=='base'||!v||!mine||!state.account.active||!accountOf(data).active)return 0;
  let more=false,less=false;
  for(const key of ['settings','digest','reviews']){if(v[key]===null||mine[key]===null)continue;if(v[key]>mine[key])more=true;else if(v[key]<mine[key])less=true;}
  return more&&!less?1:less&&!more?-1:0;
 }
 // 이 응답을 계정 상태로 적나: 판이 더 크면 보낸 차례가 늦어도 적고, 판이 더 작으면 보낸 차례가 앞서도 적지 않는다.
 const newer=(seq,data)=>{const ahead=progress(data);return ahead>0||(seq>shown.account&&ahead===0);};
 // 학생이 설정을 바꿨다: 값과 그때 알던 서버 판(바탕)을 한 번에 적는다. 2단이 꺼진 계정이면 적지 않는다(보낼 계획이 없다 — 켤 때 1단 설정이 간다).
 function noteSettings(value){
  if(!owner||closing||!Number.isFinite(value?.frequency))return;
  const known=!!state.checkedAt;if(known&&!state.account.active)return;
  writeEdit({frequency:value.frequency,hour:Number.isFinite(value.hour)?value.hour:null,base:known?state.versions?.settings??null:null,known,tries:0});
 }
 // 보낼 설정: 바탕이 지금 아는 서버 판과 같은 편집(그사이 다른 쓰기가 없었다). 떠날 때는 fetch가 나간 요청만 센다 — 토큰 갱신을 기다리는 요청은 떠나며
 // 다시 보낸다(GA1). 깃발로 들지 않고 늘 계산한다 — 늦은 응답 · 실패 · 로그아웃이 따로 지우지 못한다(GA2 · GA6 · GA9).
 function owedSettings(leaving=false){
  if(!state.versioning||closing||!state.checkedAt)return null;
  const mine=readEdit();
  if(!mine||!mine.known||mine.base!==(state.versions?.settings??null))return null;
  for(const job of jobs)if(same(job.settings,mine)&&(job.sent||!leaving))return null;
  return mine;
 }
 const digestOut=(digest,leaving=false)=>{for(const job of jobs)if(job.digest===digest&&(job.sent||!leaving))return true;return false;};
 const flying=mine=>{for(const job of jobs)if(same(job.settings,mine))return true;return false;};
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
 // 설정 맞추기(응답마다): 보내지 못한 편집이 없으면 서버 설정을 1단에 들인다. 편집이 있으면 — 상태를 모를 때 바꾼 것은 지금 판을 바탕으로 보내고,
 // 바탕이 지금 판과 같으면 보낸다(다음에 열 때의 보통 경우 — GA3 · GA5). 다르면 그사이 다른 쓰기가 있었다는 뜻이라 서버 것을 들이고 편집을 비운다
 // (설계 주인 규칙 5). 우리 요청이 날아가는 중이면 그 응답을 기다린다. 판을 모르는 옛 서버면 상태를 몰랐을 때 바꾼 편집을 판 없이 한 번 보낸다.
 function reconcile(expected){
  if(!binding||!current(expected)||closing||!state.account.active)return;
  const mine=readEdit();
  if(!state.versioning){if(mine&&!flying(mine)&&jobs.size===0)deliver(expected,{plain:mine,plainFrom:mine});return;}
  if(mine){
   const server=state.versions?.settings??null;
   if(!mine.known){rewrite(mine,{...mine,base:server,known:true});reconcile(expected);return;}
   if(mine.base===server){if(owedSettings()){if(jobs.size===0)deliver(expected);else later(expected);}return;}
   if(flying(mine))return;
   rewrite(mine,null);
  }
  adopt(state.plan);
 }
 // 다시 보낼 요약: 1단이 지금 기록으로 새로 짓는다(묶음에 digest가 없으면 같은 요약). 거절된 요약은 한 번만 다시 보낸다.
 const rebuilt=digest=>{let item=null;try{item=binding?.digest?.()||null;}catch{}return {item:item&&item.digest?item:digest.item,tries:1};};
 // 보내기: 보낼 설정(덩어리 그대로, 바탕 판과 함께)과 요약(보낼 때 아는 바탕 판과 함께)을 한 요청으로 keepalive로 보낸다(닫아도 끊기지 않는다 — 앞 회차).
 // 실패하면 RETRY_MS 간격으로 다시 보낸다. 진행 중인 요청이 있으면 다시 보내기는 기다린다(keepalive 몫 64KB). leaving: 떠날 때 — 기다림 없이 fetch까지
 // 가고, 만료 전 토큰을 그대로 쓴다. plain: 판을 모르는 서버에 판 없이 한 번 보내는 설정(plainFrom: 그 설정의 덩어리 — 받히면 비운다).
 function deliver(expected,{leaving=false,digest=owedDigest,settings=true,plain=null,plainFrom=null}={}){
  if(!current(expected)||closing||!state.account.active)return null;
  leaving=leaving||leavingNow;
  const mine=plain||!settings?null:owedSettings(leaving),value=plain||mine;
  if(digest&&digestOut(digest,leaving))digest=null;
  if(!value&&!digest)return null;
  const versions={},body={},based=state.versioning&&!plain;
  if(value){body.settings={frequency:value.frequency,hour:value.hour??null};if(mine)versions.settings=mine.base;}
  if(digest){Object.assign(body,digest.item);if(based){versions.digest=state.versions?.digest??null;if(Array.isArray(digest.item.digest?.reviews))versions.reviews=state.versions?.reviews??null;}}
  if(Object.keys(versions).length)body.versions=versions;
  const seq=++order,job={settings:mine,digest,sent:true,carries:!!value};jobs.add(job);
  clearTimeout(retryTimer);retryTimer=null;
  const run=bounded(Promise.resolve(request('sync',body,{keepalive:true,...(leaving?{leaving:true}:{}),onWait:()=>{job.sent=false;},onSent:()=>{job.sent=true;}})));
  run.then(data=>{
   jobs.delete(job);if(!current(expected))return;
   const active=data?.account?.active===true,applied=data?.applied||{},v=serverVersions(data);
   // 판 없이(옛 서버에) 받힌 설정은 덩어리를 비운다 — 그 덩어리 그대로일 때만.
   if(plainFrom&&active)rewrite(plainFrom,null);
   // 설정: 받혔으면 비운다. 거절됐으면(그사이 다른 쓰기가 있었다) 처음이면 응답의 새 판을 바탕으로 한 번 다시 보내고 — 학생의 마지막 뜻이 이긴다 —
   // 두 번째면 비워 서버 것을 들이고 멈춘다(설계 주인 규칙 4). 다시 보내기는 아래 맞추기가 한다(바탕이 지금 판과 같다).
   if(mine&&active&&v){
    const latest=readEdit();
    // 받혔는데 그사이 이 브라우저에서 같은 바탕으로 더 새 편집을 했으면, 그 편집의 바탕을 방금 쓴 판으로 옮긴다(앞 편집도 우리 것이다 — 다음 맞추기가
    // 「그사이 다른 쓰기」로 보고 서버 것을 들이지 않게).
    if(applied.settings===true&&!same(latest,mine)&&latest?.known&&latest.base===mine.base)rewrite(latest,{...latest,base:v.settings});
    else if(applied.settings===true||mine.tries>0)rewrite(mine,null);
    else rewrite(mine,{...mine,base:v.settings,tries:1});
   }
   // 요약: 받혔거나 2단이 꺼진 계정이면 끝. 거절됐으면 처음 한 번만 새로 지어 다시 보낸다.
   if(digest&&owedDigest===digest){
    const rejected=active&&!!v&&!!body.versions&&Object.hasOwn(body.versions,'digest')&&(applied.digest!==true||Object.hasOwn(body.versions,'reviews')&&applied.reviews!==true);
    owedDigest=rejected&&digest.tries===0?rebuilt(digest):null;
   }
   retryStep=0;
   if(newer(seq,data)){shown.account=Math.max(shown.account,seq);applyStatus(data,expected,{device:false});}else reconcile(expected);
   if(owedDigest&&jobs.size===0)deliver(expected,{settings:false});
   if(owedDigest||owedSettings())later(expected);
  },error=>{
   jobs.delete(job);if(!current(expected))return;
   const status=Number(error?.status),code=error?.code||'PUSH_UNAVAILABLE';
   // 판을 실은 요청이 400 INVALID_ACTION — 판을 모르는 옛 서버로 되돌렸다(옛 서버는 모르는 칸 versions를 이렇게 거절한다). 판 쓰기를 끄고 지금 덩어리와
   // 지금 요약을 판 없이 한 번 다시 보낸다(GA10 · r2 GA1). 다음 status가 다시 정한다.
   if(status===400&&code==='INVALID_ACTION'&&body.versions){
    emit({versioning:false});
    const latest=readEdit();
    deliver(expected,{digest:owedDigest,settings:false,plain:latest,plainFrom:latest});
    return;
   }
   // 400 · 413: 그 부분을 버린다. 요약이 틀렸으면 설정만 다시 보내고, 설정이 틀렸으면 덩어리를 비운다(맞추기가 1단을 서버 값으로 맞춘다).
   // 401 · 로그인: 다시 로그인한 뒤 상태를 읽으면 맞추기가 보낸다.
   if(status===400||status===413){
    const digestFault=!!digest&&(status===413||code==='INVALID_DIGEST'||code==='INVALID_HANDOVER');
    if(digest&&owedDigest===digest)owedDigest=null;
    if(mine&&!digestFault){rewrite(mine,null);reconcile(expected);}
    else if(owedSettings())later(expected,0);
   }
   else if(status!==401&&code!=='AUTH_REQUIRED')later(expected);
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
 function applyStatus(data,expected,{phase='ready',device=true}={}){
  guard(expected);
  if(data.enabled===true&&typeof data.publicKey==='string'){try{publicKey=decodeVapidKey(data.publicKey,env.atob||globalThis.atob);}catch{publicKey=null;}}
  else if(data.enabled!==true)publicKey=null;
  const value=emit({phase,enabled:data.enabled===true&&!!publicKey,...(device?{device:deviceOf(data)}:{}),account:accountOf(data),plan:data.plan||null,checkedAt:now(),error:null,
   versions:serverVersions(data),versioning:data.versioning==='base'});
  reconcile(expected);
  return value;
 }
 // 켜기 · 끄기가 끝났다: 그 전에 시작한 요청의 응답은 옛것이다.
 const settled=()=>{shown.account=shown.device=++order;};
 // status 응답을 차례대로 적는다. 돌려주는 값: 기기 칸이 가장 새것인가(이 브라우저 구독 정리는 그때만 한다 — 설계 검토 7).
 function applyRead(seq,data,expected,phase){
  const fresh=seq>shown.device;if(fresh)shown.device=seq;
  if(newer(seq,data)){shown.account=Math.max(shown.account,seq);applyStatus(data,expected,{phase,device:fresh});}
  else{guard(expected);if(fresh)emit({device:deviceOf(data)});reconcile(expected);}
  return fresh;
 }
 // 계정의 2단 상태를 다시 읽는다. 이 브라우저 구독이 이 계정 것인데 서버에 없으면(정리·404·다른 기기에서 로그아웃시킴) 이 브라우저 구독도 지운다.
 // 이 브라우저가 받을 수 없어도(아이폰·푸시 없는 브라우저) 설정을 열 때와 1단이 띄우기 직전에는 계정 상태만 읽는다 — 다른 기기에서 켜 두었으면
 // 1단이 쉬고 설정에 그 기기로 간다고 적는다. 계정이 바뀐 직후(initial)에는 읽지 않는다(받을 수 없는 기기에서 열 때마다 부르지 않게).
 async function refresh({install=false,initial=false}={}){
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
   const seq=++order,data=await request('status',sub?{endpoint:sub.endpoint}:{});
   if(!applyRead(seq,data,expected,'ready'))return snapshot();
   const next=snapshot(),record=readRecord();
   if(sub&&!next.device.subscribed&&record?.accountId===owner&&record.endpoint===sub.endpoint){await removeLocal(sub,reg);writeRecord(null);}
   else if(!sub&&record?.accountId===owner){writeRecord(null);try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}
   return snapshot();
  }catch(error){if(current(expected))emit({phase:state.phase==='ready'?'ready':'error',error:error.code||'PUSH_UNAVAILABLE'});return snapshot();}
 }
 // 판 키는 보낼 것이 없을 때만(편집이 없을 때) 지운다 — 같은 계정의 다른 탭이 아직 보내지 못한 편집을 지우지 않는다(설계 검토 5).
 function forget(){if(!readEdit()){try{storage?.removeItem(versionKey());}catch{}}}
 return {
  snapshot,refresh,
  // 상태가 바뀔 때마다 부를 함수(설정 화면의 동의 상자 단추·안내 글). 떼는 함수를 돌려준다.
  subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
  // 이 탭의 계정. 바뀌면 상태를 새로 읽는다(이 브라우저 구독은 지우지 않는다 — 지우는 것은 끄기·로그아웃·다른 계정이 켤 때뿐).
  setAccount(accountId){
   const next=typeof accountId==='string'&&accountId?accountId:null;if(next===owner&&!closing)return Promise.resolve(snapshot());
   epoch++;owner=next;closing=false;publicKey=null;lastSync=null;clearTimeout(syncTimer);syncTimer=null;pendingSync=null;
   // 앞 계정의 다시 보내기는 거둔다(그 계정의 설정 편집은 그 계정 키에 남아 다음에 그 계정으로 열 때 맞춘다).
   clearTimeout(retryTimer);retryTimer=null;retryStep=0;owedDigest=null;jobs.clear();
   // 앞 계정이 띄운 권한 창 기다리기는 끝낸다(늦게 허용돼도 지운다) — 새 계정이 바로 켤 수 있게.
   if(attempt){attempt.stop();attempt=null;}mutation=null;
   emit({phase:next?'loading':'signed-out',enabled:false,device:{subscribed:false},account:{active:false,devices:0},plan:null,checkedAt:0,error:null,busy:false,versions:null,versioning:false});
   return next?refresh({initial:true}):Promise.resolve(snapshot());
  },
  // 설정을 열 때: 서비스 워커를 등록해 두고 공개 키를 받아 둔다(「동의하고 켜기」의 subscribe가 그 동작 안에서 바로 부를 수 있게).
  // 받을 수 없는 기기는 등록하지 않고 계정 상태만 읽는다(다른 기기로 간다는 안내).
  ready(){return owner&&!closing?refresh({install:worldPushSupport(env).supported}):Promise.resolve(snapshot());},
  // 마지막으로 읽은 상태가 maxAge보다 오래됐으면 다시 읽는다(1단이 띄우기 직전 — 설계 §6-1). 못 읽으면 마지막으로 안 상태. 기기 시계를 뒤로 맞췄어도 오래된 것으로 본다.
  async fresh(maxAge=10*60000){if(!owner||closing||state.phase==='signed-out')return snapshot();if(Math.abs(now()-state.checkedAt)<=maxAge)return snapshot();return refresh();},
  // 켜기 — 반드시 누른 동작 안에서 부른다. settings·digest·handover는 서버 계획의 시작(설계 §6-3).
  enable({settings,digest,handover=[]}={}){
   const expected=epoch;
   if(!current(expected)||closing||mutation||attempt)return Promise.resolve(snapshot());
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
     // 바탕 판은 보낼 때 아는 요약 · 복습 때 판이다(판을 아는 서버일 때만). 설정 바탕은 싣지 않는다 — 이미 켠 계정이면 서버가 계정 설정을 두고(GA3),
     // 처음 켜는 계정이면 바탕과 상관없이 새 줄을 쓴다. 보내지 못한 편집은 응답 뒤 맞추기가 sync로 보낸다. 요약이 거절되면(권한 창 사이 다른 기기의
     // 요약) 새로 지어 한 번 다시 보낸다.
     const item={digest,...(Array.isArray(handover)&&handover.length?{handover}:{})};
     const versions=state.versioning&&digest?{digest:state.versions?.digest??null,...(Array.isArray(digest.reviews)?{reviews:state.versions?.reviews??null}:{})}:null;
     // 보낼 설정은 보낼 때의 1단 값이다 — 권한 창이 열린 사이 이 탭이나 다른 탭에서 바꾼 설정이 누를 때의 값에 지지 않게(GPT push-versions-world-r3 GA1).
     const sent=liveSettings(settings);
     const payload={subscription:{endpoint:json.endpoint,keys:{p256dh:json.keys?.p256dh,auth:json.keys?.auth}},settings:sent,digest,handover,consent:1};
     let data,based=!!versions;
     try{data=await request('subscribe',{...payload,...(versions?{versions}:{})});}
     catch(error){
      // 판 때문에 400 INVALID_ACTION — 판을 모르는 옛 서버다(권한 창 사이에 되돌렸을 수 있다 — r2 GA2). 판 없이 한 번 다시 보낸다.
      if(!versions||Number(error?.status)!==400||error?.code!=='INVALID_ACTION')throw error;
      guard(expected);emit({versioning:false});based=false;data=await request('subscribe',payload);
     }
     guard(expected);
     if(data.device?.subscribed!==true)throw Object.assign(Error('PUSH_UNAVAILABLE'),{code:'PUSH_UNAVAILABLE'});
     writeRecord({accountId:owner,deviceId:data.device.deviceId,endpoint:sub.endpoint});
     // 켜며 보낸 요약을 sync와 같은 표로 적는다 — 켠 바로 뒤 다시 잡기가 같은 요약을 또 보내지 않게(10-22 화면 검수).
     lastSync=digest?syncMark(item,stamp()):null;
     const applied=data.applied||{},rejected=based&&digest&&(applied.digest!==true||Array.isArray(digest.reviews)&&applied.reviews!==true);
     if(rejected)owedDigest=rebuilt({item,tries:0});
     // 처음 켠 계정이면 서버는 보낸 설정으로 새 계획을 썼다. 요청이 날아가는 사이 1단이 바뀌었으면(학생이 이 탭이나 다른 탭에서 바꿨다 — 꺼진 계정이라
     // 편집으로 적히지 않았다) 새 판을 바탕으로 편집으로 적는다. 결과를 적으며 맞추기가 보낸다(r3 GA1).
     const after=liveSettings(null),fresh=serverVersions(data)?.settings;
     if(applied.settings===true&&data.versioning==='base'&&fresh&&after&&sent&&(after.frequency!==sent.frequency||after.hour!==sent.hour))
      writeEdit({frequency:after.frequency,hour:after.hour,base:fresh,known:true,tries:0});
     // 차례를 먼저 올린다 — 결과를 적으며 맞추기가 시작한 sync의 응답이 옛것으로 버려지지 않게(r2 GA6).
     settled();applyStatus(data,expected);
     if(owedDigest&&jobs.size===0)deliver(expected,{settings:false});
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
   const expected=epoch;if(!current(expected)||closing||mutation)return null;
   emit({busy:true,error:null});
   const run=(async()=>{
    const reg=await existing(),sub=subscription||(reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null),record=readRecord();
    let result=null;
    if(sub){try{result=await request('unsubscribe',{endpoint:sub.endpoint});}catch{if(record?.endpoint===sub.endpoint){try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});}catch{}}}}
    const removed=await removeLocal(sub,reg);
    if(removed)writeRecord(null);
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
   const make=value=>({item:value,tries:0});
   const send=value=>{if(value)owedDigest=value;return deliver(expected,{digest:value});};
   const drop=()=>{clearTimeout(syncTimer);syncTimer=null;pendingSync=null;};
   const item=digest?{digest,...(Array.isArray(handover)&&handover.length?{handover}:{})}:null;
   if(settings){
    const value=item?make(item):pendingSync;drop();if(value)lastSync=syncMark(value.item,time);
    // 판을 모르는 옛 서버: 설정을 실은 앞 요청이 날아가는 중이면 편집으로 적어 두고(모은 요약은 남겨 둔다) 그 응답 뒤 맞추기가 함께 보낸다 — 판 없는
    // 두 설정 요청이 서버에 거꾸로 닿아 앞 값이 남지 않게(GPT push-versions-world-r3 GA5 · GA10).
    if(legacy){if(value)owedDigest=value;
     if([...jobs].some(job=>job.carries)){writeEdit({frequency:settings.frequency,hour:settings.hour??null,base:null,known:false,tries:0});return null;}
     return deliver(expected,{digest:value,plain:{frequency:settings.frequency,hour:settings.hour??null}});}
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
   if(!readEdit()&&!owedDigest)return;
   if(!state.checkedAt||state.phase==='error'){void refresh();return;}
   if(!state.account.active||jobs.size>0)return;
   clearTimeout(retryTimer);retryTimer=null;retryStep=0;reconcile(expected);if(jobs.size===0)resend(expected);
  },
  // 1단 설정 묶음(world-reminder-device): read()는 이 브라우저의 1단 설정({frequency, hour, since}), adopt(값)은 서버 설정을 1단 설정에 넣는다
  // (설정 보내기를 부르지 않는다), digest()는 지금 기록으로 지은 요약({digest, handover?} — 거절된 요약을 다시 보낼 때). 떼는 함수를 돌려준다.
  bindSettings(value){binding=value&&typeof value.read==='function'&&typeof value.adopt==='function'?value:null;if(binding)reconcile(epoch);const bound=binding;return ()=>{if(binding===bound)binding=null;};},
  // 알림을 눌러 들어왔을 때 누름을 한 번 더 알린다(워커가 오프라인이라 못 알렸을 때 — 서버는 토큰을 한 번만 쓴다).
  ack(token){if(typeof token==='string'&&/^[A-Za-z0-9_-]{22}$/.test(token)){try{void anonymous('opened',{token}).catch(()=>{});}catch{}}},
  // 로그아웃 단추: 이 브라우저 구독이 이 계정 것이면 서버와 브라우저에서 끈다(로그아웃 전에, 토큰이 살아 있을 때).
  // 시작부터 계정이 바뀔 때(setAccount)까지 새 요청과 판 키 쓰기를 막는다 — 그 사이(app-shell이 Atlas 표지 · client.logout을 기다린다) 1단 다시 잡기의
  // 요청이나 늦은 응답이 판 키를 다시 쓰지 않게(GA12 · 설계 검토 4). 앞서 시작한 요청의 응답은 버린다. 로그아웃이 실패하면 resume()이 막기를 푼다.
  async logout(){
   if(!owner)return {ok:true};
   forget();closing=true;epoch++;
   clearTimeout(retryTimer);retryTimer=null;owedDigest=null;clearTimeout(syncTimer);syncTimer=null;pendingSync=null;jobs.clear();
   if(attempt){attempt.stop();attempt=null;}
   const record=readRecord();if(record?.accountId!==owner)return {ok:true};
   const reg=await existing(),sub=reg?await bounded(reg.pushManager.getSubscription()).catch(()=>null):null;
   let server=false;
   try{await request('unsubscribe',{endpoint:record.endpoint});server=true;}
   catch{try{await anonymous('unsubscribe',{endpoint:record.endpoint,deviceId:record.deviceId});server=true;}catch{}}
   const removed=sub&&sub.endpoint===record.endpoint?await removeLocal(sub,reg):true;
   if(removed)writeRecord(null);
   return {ok:server||removed};
  },
  // 로그아웃이 실패해 계정이 그대로다: 막기를 풀고 상태를 다시 읽는다(맞추기가 남은 설정을 보낸다).
  resume(){if(!closing)return Promise.resolve(snapshot());closing=false;return owner?refresh():Promise.resolve(snapshot());},
  dispose(){disposed=true;epoch++;clearTimeout(syncTimer);syncTimer=null;clearTimeout(retryTimer);retryTimer=null;jobs.clear();binding=null;if(attempt){attempt.stop();attempt=null;}mutation=null;},
 };
}
