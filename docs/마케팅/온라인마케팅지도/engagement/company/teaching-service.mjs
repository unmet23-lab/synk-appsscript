import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {createClientAddress} from './request-security.mjs';

// WORLD teacher credentials have their own client, cookie and encrypted rows.
// This service never reads company users or employee identity/session links.
const PREFIX='/api/teaching',CALLBACK=PREFIX+'/callback',PRODUCT='world';
const SESSION_COOKIE='synk_teaching_session',FLOW_COOKIE='synk_teaching_flow',BROWSER_COOKIE='synk_teaching_browser';
const FLOW_MS=300000,SESSION_MS=28800000,REFRESH_MS=60000,MAX=1000;
const BOOTSTRAP_MS=60000,BOOTSTRAP_MAX=60;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const random=()=>randomBytes(32).toString('base64url');
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,code,message,retryable=false)=>Object.assign(new Error(message),{status,code:'TEACHING_'+code,...(retryable?{retryable:true}:{})});
const rejected=()=>fail(401,'AUTH_REQUIRED','내 수업의 SYNK ID로 다시 로그인해 주세요.');
const unavailable=()=>fail(503,'UNAVAILABLE','수업 연결을 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.',true);
const credential=value=>typeof value==='string'&&value.length>=10&&value.length<=16384&&!/\s/.test(value);
const claims=value=>{try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url'));}catch{return null;}};
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function cookie(req,name){const values=String(req.headers?.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'=')).map(x=>x.slice(name.length+1));return values.length===1&&/^[A-Za-z0-9_-]{43}$/.test(values[0])?values[0]:null;}
function urlOf(value,label,local=false){let url;try{url=new URL(value);}catch{throw Error(label+' 설정을 확인해 주세요.');}const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(local&&loopback&&url.protocol==='http:')||!local&&loopback)throw Error(label+'에는 올바른 HTTPS 주소가 필요합니다.');return url;}
function configuration(value,origin){
  if(!value)return null;
  const issuer=urlOf(value.issuer,'교사 로그인 서버'),api=urlOf(value.accountApiUrl,'교사 계정 API');
  if(issuer.pathname!=='/'||api.origin!==issuer.origin||api.pathname!=='/functions/v1/synk-account')throw Error('교사 로그인 서버와 계정 API의 프로젝트를 맞춰 주세요.');
  const key=value.publishableKey,keyClaims=typeof key==='string'?claims(key):null;
  if(typeof key!=='string'||key.length>4096||/\s/.test(key)||!(key.startsWith('sb_publishable_')&&key.length>15||keyClaims?.role==='anon'))throw Error('교사 로그인에는 공개 publishable 또는 anon 키가 필요합니다.');
  if(typeof value.clientId!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(value.clientId))throw Error('교사 전용 SYNK ID 클라이언트를 확인해 주세요.');
  if(value.product&&value.product!==PRODUCT)throw Error('교사 로그인은 WORLD 제품을 사용합니다.');
  const redirectUri=origin+CALLBACK;if(value.redirectUri&&value.redirectUri!==redirectUri)throw Error('교사 전용 콜백이 회사 주소와 다릅니다.');
  return Object.freeze({issuer:issuer.origin,accountApiUrl:api.href,publishableKey:key,clientId:value.clientId,redirectUri,product:PRODUCT});
}
export function teachingServiceConfig(env=process.env){
  const clientId=env.SYNK_ID_TEACHER_CLIENT_ID;if(!clientId)return null;
  if(clientId===env.SYNK_ID_MESSENGER_CLIENT_ID||clientId===env.SYNK_ID_CUSTOMER_CLIENT_ID)throw Error('내 수업에는 별도로 등록한 교사용 클라이언트가 필요합니다.');
  if(!env.SYNK_ID_ACCOUNT_API_URL||!env.SYNK_ID_PUBLISHABLE_KEY||!env.SYNK_ID_SUPABASE_URL)throw Error('교사 로그인에 필요한 SYNK ID 공개 서버 설정을 확인해 주세요.');
  return {clientId,accountApiUrl:env.SYNK_ID_ACCOUNT_API_URL,publishableKey:env.SYNK_ID_PUBLISHABLE_KEY,issuer:env.SYNK_ID_SUPABASE_URL};
}

export function createTeachingService({store,origin,config=null,fetch:fetcher=globalThis.fetch,now=()=>Date.now(),clientAddress=createClientAddress()}={}){
  const serviceUrl=urlOf(origin,'내 수업 주소',true);if(serviceUrl.pathname!=='/')throw Error('내 수업 주소에는 경로를 넣지 마세요.');origin=serviceUrl.origin;config=configuration(config,origin);
  const enabled=Boolean(config),secure=serviceUrl.protocol==='https:'?'; Secure':'',binding=hash(JSON.stringify({origin,config}));
  const sessions=new Map(),flows=new Map(),browsers=new Map(),attempts=new Map(),bootstraps=new Map();let closed=false,closing=false,closeTask=null,generation=now();
  store.db.exec('CREATE TABLE IF NOT EXISTS teaching_identity_sessions (session_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, ciphertext TEXT NOT NULL)');
  const removeRow=store.db.prepare('DELETE FROM teaching_identity_sessions WHERE session_hash=?'),existing=store.db.prepare('SELECT expires_at FROM teaching_identity_sessions WHERE session_hash=?');
  const current=entry=>Boolean(!closed&&enabled&&entry&&sessions.get(entry.hash)===entry&&entry.expiresAt>now()&&existing.get(entry.hash)?.expires_at===entry.expiresAt);
  function remove(key){if(key){removeRow.run(key);sessions.delete(key);}}
  const sessionHash=req=>{const value=cookie(req,SESSION_COOKIE);return value?hash(value):null;};
  function save(entry){if(!current(entry))throw rejected();const {hash:entryHash,synkUserId,csrfToken,createdAt,expiresAt,accessToken,refreshToken,accessExpiresAt,currentSessionId,pendingAccessToken,sessionGeneration}=entry;const encrypted=store.encrypt({version:1,binding,hash:entryHash,synkUserId,csrfToken,createdAt,expiresAt,accessToken,refreshToken,accessExpiresAt,currentSessionId,pendingAccessToken,sessionGeneration});store.db.prepare('UPDATE teaching_identity_sessions SET ciphertext=? WHERE session_hash=? AND expires_at=?').run(encrypted,entryHash,expiresAt);}
  function setCookie(res,name,value,seconds){const previous=res.getHeader?.('Set-Cookie');res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:previous?[previous]:[]),`${name}=${value}; HttpOnly; SameSite=Lax; Path=${PREFIX}; Max-Age=${seconds}${secure}`]);}
  function prune(){const time=now();for(const [key,row]of sessions)if(row.expiresAt<=time)remove(key);for(const map of [flows,browsers,attempts,bootstraps])for(const [key,row]of map)if(row.expiresAt<=time)map.delete(key);}
  function requireEnabled(){if(!enabled||closing)throw fail(503,'NOT_CONFIGURED','내 수업의 SYNK ID 로그인 연결을 준비하고 있어요.');}
  function requireOrigin(req){if(req.headers?.origin!==origin)throw fail(403,'ORIGIN','내 수업 화면에서 다시 시작해 주세요.');}
  function bootstrapRate(req){
    const key=clientAddress(req);let row=bootstraps.get(key);
    if(!row){if(bootstraps.size>=MAX)bootstraps.delete(bootstraps.keys().next().value);row={count:0,expiresAt:now()+BOOTSTRAP_MS};bootstraps.set(key,row);}
    if(++row.count>BOOTSTRAP_MAX)throw fail(429,'RATE_LIMITED','로그인 화면 요청이 많습니다. 잠시 뒤 다시 시도해 주세요.');
  }
  function browser(req,res){
    prune();const key=cookie(req,BROWSER_COOKIE),prior=key&&browsers.get(hash(key));
    if(prior){browsers.delete(prior.key);browsers.set(prior.key,prior);return prior;}
    // Limit only creation of anonymous proof rows. Existing login/session and
    // logout checks never consume this bucket. Bound both caches under new IPs.
    bootstrapRate(req);
    if(browsers.size>=MAX){const protectedKeys=new Set([...flows.values()].map(flow=>flow.bootstrapKey));const oldest=[...browsers.keys()].find(value=>!protectedKeys.has(value));if(oldest)browsers.delete(oldest);}
    if(browsers.size>=MAX)throw fail(429,'BUSY','로그인 요청이 많습니다. 잠시 뒤 다시 시도해 주세요.');
    const value=random(),row={key:hash(value),csrfToken:random(),expiresAt:now()+SESSION_MS};browsers.set(row.key,row);setCookie(res,BROWSER_COOKIE,value,SESSION_MS/1000);return row;
  }
  function csrf(req){requireOrigin(req);prune();const entry=sessions.get(sessionHash(req)),browserKey=cookie(req,BROWSER_COOKIE),bootstrap=browserKey&&browsers.get(hash(browserKey)),expected=current(entry)?entry.csrfToken:bootstrap?.csrfToken;if(!equal(req.headers?.['x-csrf-token'],expected))throw fail(403,'CSRF','내 수업의 로그인 상태를 다시 확인해 주세요.');return {entry:current(entry)?entry:null,bootstrap};}
  function rate(req){prune();const key=clientAddress(req);let row=attempts.get(key);if(!row){if(attempts.size>=MAX)throw fail(429,'BUSY','로그인 요청이 많습니다.');row={count:0,expiresAt:now()+FLOW_MS};attempts.set(key,row);}if(++row.count>30)throw fail(429,'RATE_LIMITED','로그인 요청이 많습니다. 잠시 뒤 다시 시도해 주세요.');}
  const upstreamHeaders=access=>({Authorization:'Bearer '+access,apikey:config.publishableKey,'X-SYNK-Product':PRODUCT,'X-SYNK-Contract':'1','X-SYNK-App-Version':'1.0.0'});
  async function remote(url,options){try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw unavailable();}}
  async function verify(access){
    if(!credential(access))throw rejected();const response=await remote(config.accountApiUrl,{headers:upstreamHeaders(access)});if(!response.ok)throw [401,403].includes(response.status)?rejected():unavailable();let data;try{data=await response.json();}catch{throw unavailable();}
    const token=claims(access),active=Array.isArray(data.sessions)?data.sessions.filter(row=>row.current===true&&row.revoked===false&&row.product===PRODUCT):[];
    if(data.ok!==true||data.account?.status!=='active'||!UUID.test(data.account?.synk_user_id||'')||active.length!==1||!UUID.test(active[0].id||'')||token?.iss!==config.issuer+'/auth/v1'||token?.client_id!==config.clientId||!Number.isSafeInteger(token?.exp)||token.exp*1000<=now())throw rejected();
    return {synkUserId:data.account.synk_user_id,expiresAt:token.exp*1000,currentSessionId:active[0].id};
  }
  async function exchange(body){const response=await remote(new URL('/auth/v1/oauth/token',config.issuer),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',apikey:config.publishableKey},body:new URLSearchParams(body).toString()});if(!response.ok)throw [400,401,403].includes(response.status)?rejected():unavailable();try{return await response.json();}catch{throw unavailable();}}
  if(enabled)for(const row of store.db.prepare('SELECT * FROM teaching_identity_sessions').all()){
    try{const data=store.decrypt(row.ciphertext);if(sessions.size>=MAX||data?.version!==1||data.binding!==binding||data.hash!==row.session_hash||!/^[a-f0-9]{64}$/.test(data.hash)||!UUID.test(data.synkUserId||'')||!UUID.test(data.currentSessionId||'')||!/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken||'')||!Number.isSafeInteger(data.createdAt)||data.createdAt>now()||data.expiresAt!==row.expires_at||data.expiresAt!==data.createdAt+SESSION_MS||data.expiresAt<=now()||!Number.isSafeInteger(data.sessionGeneration)||!Number.isSafeInteger(data.accessExpiresAt)||!credential(data.accessToken)||!credential(data.refreshToken)||data.pendingAccessToken!==null&&!credential(data.pendingAccessToken))throw rejected();sessions.set(data.hash,{...data,blocked:true,checking:null});generation=Math.max(generation,data.sessionGeneration);}catch{removeRow.run(row.session_hash);}
  }
  async function validate(entry){
    if(!current(entry)||closing)return false;if(entry.checking)return entry.checking;
    entry.checking=(async()=>{try{
      if(entry.pendingAccessToken&&Number(claims(entry.pendingAccessToken)?.exp)*1000<=now()){entry.pendingAccessToken=null;save(entry);}
      if(!entry.pendingAccessToken&&entry.accessExpiresAt<=now()+REFRESH_MS){
        const tokens=await exchange({grant_type:'refresh_token',client_id:config.clientId,refresh_token:entry.refreshToken});if(!current(entry)){if(entry.revoking&&credential(tokens.access_token))entry.logoutAccessToken=tokens.access_token;return false;}
        if(!credential(tokens.refresh_token))throw unavailable();entry.refreshToken=tokens.refresh_token;save(entry);
        if(!credential(tokens.access_token)||tokens.token_type&&String(tokens.token_type).toLowerCase()!=='bearer'||!Number.isSafeInteger(claims(tokens.access_token)?.exp)||claims(tokens.access_token).exp*1000<=now())throw unavailable();entry.pendingAccessToken=tokens.access_token;save(entry);
      }
      const candidate=entry.pendingAccessToken||entry.accessToken,identity=await verify(candidate);if(!current(entry)||closing)return false;if(identity.synkUserId!==entry.synkUserId)throw rejected();entry.accessToken=candidate;entry.pendingAccessToken=null;entry.accessExpiresAt=identity.expiresAt;entry.currentSessionId=identity.currentSessionId;entry.blocked=false;save(entry);return true;
    }catch(error){if(current(entry)){if(error.retryable){entry.blocked=true;throw error;}remove(entry.hash);}return false;}finally{entry.checking=null;}})();return entry.checking;
  }
  const publicStatus=entry=>({configured:true,signedIn:true,status:'signed-in',account:{synk_user_id:entry.synkUserId},sessionGeneration:entry.sessionGeneration,csrfToken:entry.csrfToken});
  const restoringStatus=(entry,error=unavailable())=>({...publicStatus(entry),signedIn:false,status:'restoring',error:{code:error.code,message:error.message,retryable:true,status:503}});
  async function status(req,res){
    const initial={configured:enabled&&!closing,signedIn:false,status:enabled&&!closing?'signed-out':'unconfigured'};let entry=sessions.get(sessionHash(req));
    if(closing&&current(entry))return restoringStatus(entry);
    if(!enabled||closing)return initial;
    try{if(await validate(entry))return publicStatus(entry);}catch(error){if(current(entry))return restoringStatus(entry,error);}
    if(closing&&current(entry))return restoringStatus(entry);
    const bootstrap=browser(req,res),proof=cookie(req,FLOW_COOKIE);if(proof&&[...flows.values()].some(flow=>flow.browserHash===hash(proof)&&flow.expiresAt>now()))initial.status='signing-in';return {...initial,csrfToken:bootstrap.csrfToken};
  }
  function start(req,res){
    requireEnabled();const {entry,bootstrap}=csrf(req);rate(req);if(flows.size>=MAX)throw fail(429,'BUSY','로그인 요청이 많습니다.');
    const previousHash=sessionHash(req),proof=cookie(req,FLOW_COOKIE);for(const [key,row]of flows)if(row.previousHash===previousHash&&previousHash||bootstrap&&row.bootstrapKey===bootstrap.key||proof&&row.browserHash===hash(proof))flows.delete(key);
    const state=random(),browserProof=random(),verifier=random(),key=hash(state);flows.set(key,{key,verifier,browserHash:hash(browserProof),bootstrapKey:bootstrap?.key,previousHash,previousEntry:entry,expiresAt:now()+FLOW_MS,consumed:false});setCookie(res,FLOW_COOKIE,browserProof,FLOW_MS/1000);
    const target=new URL('/auth/v1/oauth/authorize',config.issuer);target.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:config.redirectUri,scope:'openid profile',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return {authorizationUrl:target.href};
  }
  const flowCurrent=flow=>!closing&&flows.get(flow.key)===flow&&flow.expiresAt>now()&&(!flow.previousEntry||current(flow.previousEntry));
  async function callback(req,res,url){
    requireEnabled();const allowed=['state','code','error','error_description'];if(url.origin!==origin||url.pathname!==CALLBACK||url.hash||[...url.searchParams.keys()].some(key=>!allowed.includes(key)||url.searchParams.getAll(key).length!==1)||url.searchParams.has('code')&&url.searchParams.has('error'))throw fail(403,'CALLBACK','내 수업의 로그인 콜백을 확인해 주세요.');
    const state=url.searchParams.get('state'),proof=cookie(req,FLOW_COOKIE),flow=state&&/^[A-Za-z0-9_-]{43}$/.test(state)?flows.get(hash(state)):null;
    if(!flow||flow.consumed||!proof||flow.browserHash!==hash(proof)||flow.previousHash!==sessionHash(req)||!flowCurrent(flow))throw fail(403,'FLOW','수업 로그인 확인이 만료됐습니다. 다시 시작해 주세요.');flow.consumed=true;
    try{
      const code=url.searchParams.get('code');if(!code||code.length>4000||url.searchParams.has('error'))throw fail(403,'CANCELLED','수업 로그인을 완료하지 못했어요.');
      const tokens=await exchange({grant_type:'authorization_code',code,client_id:config.clientId,redirect_uri:config.redirectUri,code_verifier:flow.verifier});if(!flowCurrent(flow))throw rejected();if(!credential(tokens.access_token)||!credential(tokens.refresh_token)||tokens.token_type&&String(tokens.token_type).toLowerCase()!=='bearer')throw rejected();const identity=await verify(tokens.access_token);if(!flowCurrent(flow))throw rejected();prune();if(sessions.size>=MAX)throw fail(429,'BUSY','로그인 요청이 많습니다.');
      const value=random(),key=hash(value),createdAt=now(),entry={hash:key,...identity,accessExpiresAt:identity.expiresAt,csrfToken:random(),createdAt,expiresAt:createdAt+SESSION_MS,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,currentSessionId:identity.currentSessionId,pendingAccessToken:null,sessionGeneration:++generation,blocked:false,checking:null};
      sessions.set(key,entry);try{store.transaction(()=>{store.db.prepare('INSERT INTO teaching_identity_sessions VALUES(?,?,?)').run(key,entry.expiresAt,'');save(entry);if(flow.previousHash)removeRow.run(flow.previousHash);});}catch(error){sessions.delete(key);throw error;}if(flow.previousHash)sessions.delete(flow.previousHash);setCookie(res,SESSION_COOKIE,value,SESSION_MS/1000);return publicStatus(entry);
    }finally{if(flows.get(flow.key)===flow){flows.delete(flow.key);setCookie(res,FLOW_COOKIE,'',0);}}
  }
  function cancel(req,res){csrf(req);const proof=cookie(req,FLOW_COOKIE),key=sessionHash(req);for(const [id,flow]of flows)if(key&&flow.previousHash===key||proof&&flow.browserHash===hash(proof))flows.delete(id);setCookie(res,FLOW_COOKIE,'',0);return {ok:true};}
  async function logout(req,res){
    requireOrigin(req);prune();const key=sessionHash(req);
    // With no actual persisted session, local logout is already complete. No
    // CSRF exemption may delete a stored row or another browser's pending flow.
    if(!key||!existing.get(key)){setCookie(res,SESSION_COOKIE,'',0);setCookie(res,FLOW_COOKIE,'',0);return {ok:true,localSignedOut:true,serverRevoked:true};}
    const {entry}=csrf(req);cancel(req,res);if(entry)entry.revoking=true;remove(sessionHash(req));setCookie(res,SESSION_COOKIE,'',0);if(!entry)return {ok:true,localSignedOut:true,serverRevoked:false};if(entry.checking)await entry.checking.catch(()=>{});
    const access=entry.logoutAccessToken||entry.pendingAccessToken||entry.accessToken;let accountRevoked=false,refreshRevoked=false;
    try{const response=await remote(config.accountApiUrl,{method:'POST',headers:{...upstreamHeaders(access),'Content-Type':'application/json'},body:JSON.stringify({action:'revoke-session',session_id:entry.currentSessionId})});accountRevoked=response.status===404||response.ok&&(await response.json()).ok===true;}catch{}
    try{const response=await remote(new URL('/auth/v1/logout?scope=local',config.issuer),{method:'POST',headers:upstreamHeaders(access)});refreshRevoked=response.ok||response.status===404||response.status===401&&accountRevoked;}catch{}
    return {ok:true,localSignedOut:true,serverRevoked:accountRevoked&&refreshRevoked};
  }
  const routes={classes:['/api/classes'],teacherOverview:['/api/teacher/overview'],workspace:['/api/workspace'],care:['/api/teacher/care'],careSave:['/api/teacher/care','POST'],enrollmentInvite:['/api/teacher/invites','POST'],assignments:['/api/assignments','POST'],assignmentUpdate:['/api/assignments/update','POST'],assignmentCancel:['/api/assignments/cancel','POST'],observations:['/api/observations','POST']};
  async function classroom(req,input){
    requireEnabled();const {entry}=csrf(req);if(!entry||!current(entry))throw rejected();if(closing)throw unavailable();const verified=await validate(entry);if(!current(entry))throw rejected();if(closing||entry.blocked)throw unavailable();if(!verified)throw rejected();
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['operation','classId','body'].includes(key)))throw fail(400,'REQUEST','수업 요청을 확인해 주세요.');
    const {operation,classId,body}=input,route=Object.hasOwn(routes,operation)&&routes[operation];if(!route)throw fail(403,'OPERATION','지원하지 않는 수업 요청입니다.');
    const unscoped=['classes','teacherOverview'].includes(operation);
    if(unscoped&&(classId!==undefined||body!==undefined)||!unscoped&&(typeof classId!=='string'||!classId||classId.length>120)||route[1]&&(!body||typeof body!=='object'||Array.isArray(body))||!route[1]&&body!==undefined||body?.classId&&body.classId!==classId)throw fail(400,'CLASS_SCOPE','담당 수업의 요청 범위를 확인해 주세요.');
    const guard=()=>{if(!current(entry))throw rejected();if(closing||entry.blocked)throw unavailable();};
    async function call(path,method='GET',payload){guard();const target=new URL(config.accountApiUrl);target.pathname='/functions/v1/synk-classroom'+path;if(classId&&path!=='/api/classes')target.searchParams.set('classId',classId);const response=await remote(target,{method,headers:{...upstreamHeaders(entry.accessToken),...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(payload)}:{})});guard();let data;try{data=await response.json();}catch{throw unavailable();}guard();if(!response.ok||data?.ok===false){if(response.status===401)remove(entry.hash);throw fail([400,401,403,404,409,429].includes(response.status)?response.status:503,'CLASSROOM',data?.error?.message||'담당 수업을 확인하지 못했어요.',response.status>=500);}return data;}
    if(operation==='teacherOverview')return call(route[0]);
    const memberships=await call('/api/classes');if(memberships?.mode!=='account-linked'||!Array.isArray(memberships.classes)||memberships.classes.some(row=>typeof row.id!=='string'||typeof row.name!=='string'||!['teacher','learner'].includes(row.role)))throw unavailable();
    const teacherClasses=memberships.classes.filter(row=>row.role==='teacher');if(operation==='classes')return {...memberships,classes:teacherClasses};
    if(!teacherClasses.some(row=>row.id===classId))throw fail(403,'NOT_TEACHER','이 수업의 교사 권한을 확인하지 못했어요.');return call(route[0],route[1],body);
  }
  return {status,start,callback,cancel,logout,request:classroom,close(){if(!closeTask){closing=true;flows.clear();browsers.clear();attempts.clear();bootstraps.clear();closeTask=Promise.allSettled([...sessions.values()].map(entry=>entry.checking).filter(Boolean));}return closeTask;},dispose(){closed=true;closing=true;sessions.clear();flows.clear();browsers.clear();attempts.clear();bootstraps.clear();}};
}
