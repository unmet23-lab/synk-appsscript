import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createClientAddress } from './request-security.mjs';

// Customers use the existing platform contract with a separately registered client.
// This module never reads/writes company users, employee links or employee sessions.
const PRODUCT='platform', CALLBACK='/api/customer/synk-id/callback', COOKIE_PATH='/api/customer';
const SESSION_COOKIE='synk_customer_session', FLOW_COOKIE='synk_customer_flow';
const FLOW_MS=5*60_000, SESSION_MS=8*60*60_000, REFRESH_MS=60_000, MAX_ENTRIES=1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const random=()=>randomBytes(32).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,code,message,retryable=false)=>Object.assign(new Error(message),{status,code:'CUSTOMER_'+code,...(retryable?{retryable:true}:{})});
const rejected=()=>fail(401,'IDENTITY_REJECTED','SYNK ID로 다시 로그인해 주세요.');
const unavailable=()=>fail(503,'IDENTITY_UNAVAILABLE','SYNK ID 연결을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.',true);
const validToken=value=>typeof value==='string'&&value.length>=10&&value.length<=16_384&&!/\s/.test(value);
const claimsOf=value=>{try{return JSON.parse(Buffer.from(value.split('.')[1],'base64url'));}catch{return null;}};
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
function readCookie(req,name){
  const values=String(req.headers?.cookie||'').split(';').map(part=>part.trim()).filter(part=>part.startsWith(name+'=')).map(part=>part.slice(name.length+1));
  return values.length===1&&/^[A-Za-z0-9_-]{43}$/.test(values[0])?values[0]:null;
}
function parsedUrl(value,label,{loopback=false}={}){
  let url;try{url=new URL(value);}catch{throw Error(label+' 설정을 확인해 주세요.');}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(loopback&&local&&url.protocol==='http:'))||(!loopback&&local))throw Error(label+'에는 올바른 HTTPS 주소가 필요합니다.');
  return url;
}
function validateConfig(config){
  if(!config)return null;
  const issuer=parsedUrl(config.issuer,'고객 SYNK ID 로그인 서버');
  const api=parsedUrl(config.accountApiUrl,'고객 SYNK ID 계정 API');
  const redirect=parsedUrl(config.redirectUri,'고객 SYNK ID 콜백',{loopback:true});
  if(issuer.pathname!=='/'||api.origin!==issuer.origin||api.pathname!=='/functions/v1/synk-account')throw Error('고객 SYNK ID 서버와 계정 API의 프로젝트를 맞춰 주세요.');
  if(redirect.pathname!==CALLBACK)throw Error('고객 SYNK ID 전용 콜백을 등록해 주세요.');
  if(typeof config.clientId!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(config.clientId)||config.product&&config.product!==PRODUCT)throw Error('고객 전용 SYNK ID 클라이언트를 확인해 주세요.');
  const key=config.publishableKey, keyClaims=typeof key==='string'?claimsOf(key):null;
  if(typeof key!=='string'||key.length>4096||/\s/.test(key)||!(key.startsWith('sb_publishable_')&&key.length>15||keyClaims?.role==='anon'))throw Error('고객 SYNK ID 공개 publishable 또는 anon 키가 필요합니다.');
  return Object.freeze({issuer:issuer.origin,accountApiUrl:api.href,redirectUri:redirect.href,clientId:config.clientId,publishableKey:key,product:PRODUCT});
}

export function customerIdentityConfig(env=process.env){
  const names=['ACCOUNT_API_URL','PUBLISHABLE_KEY','SUPABASE_URL','CLIENT_ID','REDIRECT_URI'];
  const values=names.map(name=>env['SYNK_ID_CUSTOMER_'+name]);
  if(!values.some(Boolean))return null;
  if(!values.every(Boolean))throw Error('고객 SYNK ID 전용 설정 다섯 개를 모두 등록해 주세요.');
  if(env.SYNK_ID_CUSTOMER_CLIENT_ID===env.SYNK_ID_MESSENGER_CLIENT_ID)throw Error('고객 로그인에는 직원용 클라이언트를 사용할 수 없습니다.');
  return validateConfig({accountApiUrl:values[0],publishableKey:values[1],issuer:values[2],clientId:values[3],redirectUri:values[4]});
}

export function createCustomerIdentity({store,origin,config=null,fetch:fetcher=globalThis.fetch,now=()=>Date.now(),clientAddress=createClientAddress()}={}){
  const originUrl=parsedUrl(origin,'고객 서비스 주소',{loopback:true});
  if(originUrl.pathname!=='/')throw Error('고객 서비스에는 경로 없는 origin을 설정해 주세요.');
  origin=originUrl.origin;config=validateConfig(config);
  if(config&&config.redirectUri!==origin+CALLBACK)throw Error('고객 SYNK ID 콜백이 현재 회사 주소와 다릅니다.');
  const enabled=Boolean(config),secure=originUrl.protocol==='https:'?'; Secure':'';
  const sessions=new Map(),flows=new Map(),attempts=new Map(),authRefs=new WeakMap(),userRefs=new WeakMap();
  if(!store?.db||typeof store.encrypt!=='function'||typeof store.decrypt!=='function')throw Error('고객 로그인에는 암호화 영구 저장소가 필요합니다.');
  store.db.exec('CREATE TABLE IF NOT EXISTS customer_identity_sessions (session_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, ciphertext TEXT NOT NULL)');
  const configuration=digest(JSON.stringify({origin,config}));
  const removeRow=store.db.prepare('DELETE FROM customer_identity_sessions WHERE session_hash=?');
  const existingRow=store.db.prepare('SELECT expires_at FROM customer_identity_sessions WHERE session_hash=?');
  const updateRow=store.db.prepare('UPDATE customer_identity_sessions SET ciphertext=? WHERE session_hash=? AND expires_at=?');
  let closing=false,closed=false,closeTask=null;
  function removeSession(key){removeRow.run(key);sessions.delete(key);}
  function encrypted(entry){return store.encrypt({version:1,configuration,hash:entry.hash,synkUserId:entry.synkUserId,name:entry.user.name,csrfToken:entry.csrfToken,createdAt:entry.createdAt,expiresAt:entry.expiresAt,accessToken:entry.accessToken,refreshToken:entry.refreshToken,accessExpiresAt:entry.accessExpiresAt,currentSessionId:entry.currentSessionId,pendingAccessToken:entry.pendingAccessToken});}
  function persist(entry){if(!current(entry)||updateRow.run(encrypted(entry),entry.hash,entry.expiresAt).changes!==1)throw rejected();}
  // A restored bearer never authorizes locally: the first and every later request
  // still has to complete the central account check.
  if(enabled){
    store.db.prepare('DELETE FROM customer_identity_sessions WHERE expires_at<=?').run(now());
    for(const row of store.db.prepare('SELECT * FROM customer_identity_sessions').all()){
      try{
        const data=store.decrypt(row.ciphertext);
        if(sessions.size>=MAX_ENTRIES||data?.version!==1||data.configuration!==configuration||data.hash!==row.session_hash||!/^[a-f0-9]{64}$/.test(data.hash)||!UUID.test(data.synkUserId||'')||!UUID.test(data.currentSessionId||'')||!/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken||'')||!Number.isSafeInteger(data.createdAt)||data.createdAt>now()||data.expiresAt!==row.expires_at||data.expiresAt!==data.createdAt+SESSION_MS||data.expiresAt<=now()||!Number.isSafeInteger(data.accessExpiresAt)||!validToken(data.accessToken)||!validToken(data.refreshToken)||data.pendingAccessToken!==null&&!validToken(data.pendingAccessToken)||typeof data.name!=='string'||data.name.length>100)throw rejected();
        const user=Object.freeze({id:'synk:'+data.synkUserId,kind:'customer',synkUserId:data.synkUserId,name:data.name});
        const entry={...data,user,blocked:true,checking:null};sessions.set(entry.hash,entry);userRefs.set(user,entry);
      }catch{removeRow.run(row.session_hash);}
    }
  }
  const requireEnabled=()=>{if(!enabled||closing)throw fail(503,'NOT_CONFIGURED','고객 SYNK ID 로그인이 아직 준비되지 않았습니다.');};
  const requireOrigin=req=>{if(req.headers?.origin!==origin)throw fail(403,'ORIGIN','고객 상담 화면에서 다시 시작해 주세요.');};
  const sessionHash=req=>{const value=readCookie(req,SESSION_COOKIE);return value?digest(value):null;};
  function setCookie(res,name,value,maxAge){
    const previous=res.getHeader?.('Set-Cookie');
    const next=`${name}=${value}; HttpOnly; SameSite=Lax; Path=${COOKIE_PATH}; Max-Age=${maxAge}${secure}`;
    res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:previous?[previous]:[]),next]);
  }
  function prune(){
    const stamp=now();
    for(const [key,entry]of sessions)if(entry.expiresAt<=stamp)removeSession(key);
    for(const [key,flow]of flows)if(flow.expiresAt<=stamp)flows.delete(key);
    for(const [key,row]of attempts)if(row.expiresAt<=stamp)attempts.delete(key);
  }
  function rate(req){
    prune();const key=clientAddress(req);let row=attempts.get(key);
    if(!row){if(attempts.size>=MAX_ENTRIES)throw fail(429,'BUSY','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');row={count:0,expiresAt:now()+FLOW_MS};attempts.set(key,row);}
    if(++row.count>30)throw fail(429,'RATE_LIMITED','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  }
  const current=entry=>Boolean(!closed&&enabled&&entry&&sessions.get(entry.hash)===entry&&entry.expiresAt>now()&&existingRow.get(entry.hash)?.expires_at===entry.expiresAt);
  const allowed=entry=>!closing&&current(entry)&&!entry.blocked&&entry.accessExpiresAt>now();
  function publicAuth(entry){const auth=Object.freeze({user:entry.user,csrfToken:entry.csrfToken,expiresAt:new Date(entry.expiresAt).toISOString()});authRefs.set(auth,entry);return auth;}
  const isCurrent=auth=>Boolean(auth&&allowed(authRefs.get(auth)));
  const isCurrentUser=user=>Boolean(user&&allowed(userRefs.get(user)));
  function requireCsrf(req,auth){requireOrigin(req);if(!isCurrent(auth)||sessionHash(req)!==authRefs.get(auth).hash||!same(req.headers?.['x-csrf-token'],auth.csrfToken))throw fail(403,'CSRF','고객 로그인 상태를 다시 확인해 주세요.');}
  const headers=access=>({Authorization:'Bearer '+access,apikey:config.publishableKey,'X-SYNK-Product':PRODUCT,'X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0'});
  async function request(url,options){
    try{return await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw unavailable();}
  }
  async function verify(accessToken){
    if(!validToken(accessToken))throw rejected();
    const response=await request(config.accountApiUrl,{headers:headers(accessToken)});
    if(!response.ok)throw [401,403].includes(response.status)?rejected():unavailable();
    let data;try{data=await response.json();}catch{throw unavailable();}
    // Central authorization accepts this exact bearer first; decoded claims alone never grant access.
    const claims=claimsOf(accessToken),expectedIssuer=config.issuer+'/auth/v1';
    const currentSessions=Array.isArray(data.sessions)?data.sessions.filter(row=>row.current===true&&row.revoked===false&&row.product===PRODUCT):[];
    if(data.ok!==true||data.account?.status!=='active'||!UUID.test(data.account?.synk_user_id||'')||currentSessions.length!==1||!UUID.test(currentSessions[0].id||'')||claims?.client_id!==config.clientId||claims?.iss!==expectedIssuer||!Number.isSafeInteger(claims?.exp)||claims.exp*1000<=now())throw rejected();
    return {synkUserId:data.account.synk_user_id,currentSessionId:currentSessions[0].id,expiresAt:claims.exp*1000,name:typeof data.account.profile?.display_name==='string'?data.account.profile.display_name.trim().slice(0,100):''};
  }
  function tokenSet(data){
    if(!validToken(data?.access_token)||!validToken(data?.refresh_token)||data.token_type&&String(data.token_type).toLowerCase()!=='bearer')throw rejected();
    return {accessToken:data.access_token,refreshToken:data.refresh_token};
  }
  async function exchangeData(body){
    const response=await request(new URL('/auth/v1/oauth/token',config.issuer),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',apikey:config.publishableKey},body:new URLSearchParams(body).toString()});
    if(!response.ok)throw [400,401,403].includes(response.status)?rejected():unavailable();
    try{return await response.json();}catch{throw unavailable();}
  }
  function start(req,res){
    requireEnabled();requireOrigin(req);rate(req);
    if(flows.size>=MAX_ENTRIES)throw fail(429,'BUSY','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    const state=random(),browser=random(),verifier=random(),key=digest(state),previousHash=sessionHash(req);
    flows.set(key,{key,browserHash:digest(browser),verifier,previousHash,previousEntry:sessions.get(previousHash)||null,expiresAt:now()+FLOW_MS,consumed:false});
    setCookie(res,FLOW_COOKIE,browser,300);
    const url=new URL('/auth/v1/oauth/authorize',config.issuer);
    url.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:config.redirectUri,scope:'openid profile',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
    return {authorizationUrl:url.href,expiresAt:new Date(now()+FLOW_MS).toISOString()};
  }
  const flowCurrent=flow=>!closing&&flows.get(flow.key)===flow&&flow.expiresAt>now()&&(!flow.previousEntry||current(flow.previousEntry));
  async function callback(req,res,url){
    requireEnabled();
    const permitted=['state','code','error','error_description'];
    if(url.origin!==origin||url.pathname!==CALLBACK||url.hash||[...url.searchParams.keys()].some(key=>!permitted.includes(key)||url.searchParams.getAll(key).length!==1)||url.searchParams.has('code')&&url.searchParams.has('error'))throw fail(403,'CALLBACK','고객 SYNK ID 콜백 주소를 확인해 주세요.');
    const state=url.searchParams.get('state'),proof=readCookie(req,FLOW_COOKIE);
    const flow=typeof state==='string'&&/^[A-Za-z0-9_-]{43}$/.test(state)?flows.get(digest(state)):null;
    if(!flow||!proof||flow.consumed||flow.browserHash!==digest(proof)||flow.previousHash!==sessionHash(req)||!flowCurrent(flow))throw fail(403,'FLOW','고객 로그인 확인이 만료됐습니다. 다시 시작해 주세요.');
    flow.consumed=true;
    try{
      const code=url.searchParams.get('code');
      if(!code||code.length>4000||url.searchParams.has('error'))throw fail(403,'FLOW','고객 SYNK ID 로그인을 완료하지 못했습니다.');
      const tokens=tokenSet(await exchangeData({grant_type:'authorization_code',code,client_id:config.clientId,redirect_uri:config.redirectUri,code_verifier:flow.verifier}));
      if(!flowCurrent(flow))throw rejected();
      const identity=await verify(tokens.accessToken);
      if(!flowCurrent(flow))throw rejected();
      prune();if(sessions.size>=MAX_ENTRIES)throw fail(429,'BUSY','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
      const value=random(),hash=digest(value),user=Object.freeze({id:'synk:'+identity.synkUserId,kind:'customer',synkUserId:identity.synkUserId,name:identity.name||'고객'});
      const createdAt=now(),entry={hash,user,synkUserId:identity.synkUserId,csrfToken:random(),createdAt,expiresAt:createdAt+SESSION_MS,accessToken:tokens.accessToken,refreshToken:tokens.refreshToken,accessExpiresAt:identity.expiresAt,currentSessionId:identity.currentSessionId,pendingAccessToken:null,blocked:false,checking:null};
      store.transaction(()=>{
        store.db.prepare('INSERT INTO customer_identity_sessions VALUES (?,?,?)').run(hash,entry.expiresAt,encrypted(entry));
        if(flow.previousHash)removeRow.run(flow.previousHash);
      });
      if(flow.previousHash)sessions.delete(flow.previousHash);
      sessions.set(hash,entry);userRefs.set(user,entry);setCookie(res,SESSION_COOKIE,value,SESSION_MS/1000);
      return {ok:true,...publicAuth(entry)};
    }finally{flows.delete(flow.key);setCookie(res,FLOW_COOKIE,'',0);}
  }
  async function validate(entry){
    if(!current(entry))return false;
    if(entry.checking)return entry.checking;
    entry.checking=(async()=>{
      try{
        if(entry.pendingAccessToken&&Number(claimsOf(entry.pendingAccessToken)?.exp)*1000<=now()){entry.pendingAccessToken=null;persist(entry);}
        if(!entry.pendingAccessToken&&entry.accessExpiresAt<=now()+REFRESH_MS){
          const tokens=await exchangeData({grant_type:'refresh_token',client_id:config.clientId,refresh_token:entry.refreshToken});
          if(!current(entry)){if(entry.revoking&&validToken(tokens?.access_token))entry.logoutAccessToken=tokens.access_token;return false;}
          // Save a rotated refresh before inspecting the access response or making
          // another network request. A transient failure must not lose the new key.
          if(!validToken(tokens?.refresh_token))throw unavailable();
          entry.refreshToken=tokens.refresh_token;persist(entry);
          const accessExpiry=claimsOf(tokens.access_token)?.exp;
          if(!validToken(tokens.access_token)||!Number.isSafeInteger(accessExpiry)||accessExpiry*1000<=now()||tokens.token_type&&String(tokens.token_type).toLowerCase()!=='bearer')throw unavailable();
          entry.pendingAccessToken=tokens.access_token;persist(entry);
        }
        const candidate=entry.pendingAccessToken||entry.accessToken,identity=await verify(candidate);
        if(!current(entry))return false;
        if(identity.synkUserId!==entry.synkUserId)throw rejected();
        const changed=entry.accessToken!==candidate||entry.pendingAccessToken!==null||entry.accessExpiresAt!==identity.expiresAt||entry.currentSessionId!==identity.currentSessionId;
        entry.accessToken=candidate;entry.pendingAccessToken=null;entry.accessExpiresAt=identity.expiresAt;entry.currentSessionId=identity.currentSessionId;entry.blocked=false;
        if(changed)persist(entry);
        return true;
      }catch(error){
        if(current(entry)){if(error.retryable){entry.blocked=true;throw error;}removeSession(entry.hash);}
        return false;
      }finally{entry.checking=null;}
    })();return entry.checking;
  }
  async function authenticate(req){
    if(!enabled||closing)return null;
    const key=sessionHash(req),entry=sessions.get(key);
    if(!current(entry)){if(key)removeSession(key);return null;}
    // No time-based authorization cache: every request must complete a central check.
    return await validate(entry)&&allowed(entry)?publicAuth(entry):null;
  }
  async function logout(req,res){
    requireOrigin(req);
    const key=sessionHash(req),entry=sessions.get(key);
    if(entry&&!same(req.headers?.['x-csrf-token'],entry.csrfToken))throw fail(403,'CSRF','고객 로그인 상태를 다시 확인해 주세요.');
    if(entry)entry.revoking=true;
    if(key)removeSession(key);
    const proof=readCookie(req,FLOW_COOKIE);
    for(const [id,flow]of flows)if(flow.previousHash&&flow.previousHash===key||proof&&flow.browserHash===digest(proof))flows.delete(id);
    setCookie(res,SESSION_COOKIE,'',0);setCookie(res,FLOW_COOKIE,'',0);
    if(!entry)return {ok:true,localSignedOut:true,serverRevoked:false};
    // A refresh already in flight can rotate after local removal. Revoke using its
    // newest bearer without making that removed session current again.
    if(entry.checking)await entry.checking.catch(()=>{});
    const access=entry.logoutAccessToken||entry.pendingAccessToken||entry.accessToken;
    let serverSessionRevoked=false,refreshRevoked=false;
    try{const response=await request(config.accountApiUrl,{method:'POST',headers:{...headers(access),'Content-Type':'application/json'},body:JSON.stringify({action:'revoke-session',session_id:entry.currentSessionId})});serverSessionRevoked=response.status===404||response.ok&&(await response.json()).ok===true;}catch{}
    try{const response=await request(new URL('/auth/v1/logout?scope=local',config.issuer),{method:'POST',headers:headers(access)});refreshRevoked=response.ok||response.status===404||response.status===401&&serverSessionRevoked;}catch{}
    return {ok:true,localSignedOut:true,serverRevoked:serverSessionRevoked&&refreshRevoked,serverSessionRevoked,refreshRevoked};
  }
  return {status:()=>({enabled:enabled&&!closing,browserEnabled:enabled&&!closing}),start,callback,authenticate,requireCsrf,isCurrent,isCurrentUser,logout,
    close(){if(!closeTask){closing=true;flows.clear();attempts.clear();closeTask=Promise.allSettled([...sessions.values()].map(entry=>entry.checking).filter(Boolean));}return closeTask;},
    // Existing HTTP logout requests may finish while the listeners drain.
    dispose(){closing=true;closed=true;sessions.clear();flows.clear();attempts.clear();},
  };
}
