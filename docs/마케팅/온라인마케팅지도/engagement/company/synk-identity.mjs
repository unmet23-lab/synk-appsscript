import { randomBytes, createHash } from 'node:crypto';
import { hash, passwordMatches } from './store.mjs';

const FLOW_MS=5*60_000, CHECK_MS=30_000, REFRESH_MS=60_000;
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code:'SYNK_'+code});
const cookie=(req,name)=>new RegExp('(?:^|;\\s*)'+name+'=([^;]+)').exec(req.headers.cookie||'')?.[1];
const jwtExpiry=value=>{try{const data=JSON.parse(Buffer.from(value.split('.')[1],'base64url'));return Number.isFinite(data.exp)?data.exp*1000:0;}catch{return 0;}};
const random=()=>randomBytes(32).toString('base64url');
function httpsUrl(value,label){let url;try{url=new URL(value);}catch{throw Error(label+' 설정을 확인해 주세요.');}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error(label+'에는 외부 HTTPS 주소가 필요합니다.');return url;}

export function synkIdentityConfig(env=process.env){
  const api=env.SYNK_ID_ACCOUNT_API_URL,key=env.SYNK_ID_PUBLISHABLE_KEY,issuer=env.SYNK_ID_SUPABASE_URL,clientId=env.SYNK_ID_MESSENGER_CLIENT_ID;
  if(![api,key,issuer,clientId].some(Boolean))return null;
  if(!api||!key)throw Error('SYNK ID 계정 API 주소와 공개 키를 함께 설정해 주세요.');
  const accountApiUrl=httpsUrl(api,'SYNK ID 계정 API').href;
  if(typeof key!=='string'||key.startsWith('sb_secret_')||key.length>4096)throw Error('SYNK ID 공개 키를 확인해 주세요.');
  try{if(JSON.parse(Buffer.from(key.split('.')[1]||'','base64url')).role==='service_role')throw Error('secret');}catch(error){if(error.message==='secret')throw Error('SYNK ID 서비스 역할 키는 사용할 수 없습니다.');}
  if(Boolean(issuer)!==Boolean(clientId))throw Error('브라우저 SYNK ID 로그인 서버와 클라이언트를 함께 설정해 주세요.');
  const issuerUrl=issuer?httpsUrl(issuer,'SYNK ID 로그인 서버'):null;
  if(issuerUrl&&issuerUrl.pathname!=='/')throw Error('SYNK ID 로그인 서버에는 경로를 넣지 마세요.');
  if(clientId&&(typeof clientId!=='string'||clientId.length>200||/[\s]/.test(clientId)))throw Error('SYNK ID 클라이언트 ID를 확인해 주세요.');
  return {accountApiUrl,publishableKey:key,issuer:issuerUrl?.origin||null,clientId:clientId||null};
}

export function createSynkIdentity({store,origin,config=null,fetch:fetcher=globalThis.fetch,now=()=>Date.now(),verifyIdentity=null,onRevoked=()=>{}}){
  const enabled=Boolean(config),sessions=new Map(),flows=new Map(),attempts=new Map();
  const secure=new URL(origin).protocol==='https:'?'; Secure':'';
  store.db.exec('CREATE TABLE IF NOT EXISTS synk_identity_links (synk_user_id TEXT PRIMARY KEY, company_user_id TEXT NOT NULL UNIQUE, revision TEXT NOT NULL, linked_at TEXT NOT NULL)');
  const byCompany=id=>store.db.prepare('SELECT * FROM synk_identity_links WHERE company_user_id=?').get(id);
  const bySynk=id=>store.db.prepare('SELECT * FROM synk_identity_links WHERE synk_user_id=?').get(id);
  const requireEnabled=()=>{if(!enabled)throw fail(503,'NOT_CONFIGURED','SYNK ID 연결은 아직 설정 전입니다. 기존 회사 계정으로 로그인해 주세요.');};
  function rate(req){const key=req.socket?.remoteAddress||'unknown',stamp=now(),old=attempts.get(key);const row=old&&stamp-old.at<FLOW_MS?old:{at:stamp,count:0};if(++row.count>30)throw fail(429,'RATE_LIMITED','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');attempts.set(key,row);if(attempts.size>1000)for(const [k,v]of attempts)if(stamp-v.at>FLOW_MS)attempts.delete(k);}
  function requireOrigin(req){if(req.headers.origin!==origin)throw fail(403,'ORIGIN','회사 로그인 화면에서 다시 시작해 주세요.');}
  function binding(req){return cookie(req,'synk_company_flow');}
  function clearFlowCookie(res){res.setHeader('Set-Cookie',`synk_company_flow=; HttpOnly; SameSite=Lax; Path=/api/synk-id; Max-Age=0${secure}`);}
  function status(auth){const link=auth&&byCompany(auth.user.id);return {enabled,browserEnabled:enabled&&Boolean(config.issuer&&config.clientId),linked:Boolean(link),canLink:Boolean(auth?.user?.passwordHash),session:auth?.body?.synkIdentity?'synk':'company'};}
  function challenge(req,res,input,auth){
    requireEnabled();requireOrigin(req);rate(req);
    const action=input.action;if(!['login','link','unlink'].includes(action))throw fail(400,'ACTION','로그인 동작을 확인해 주세요.');
    if(action!=='login'){
      if(!auth||req.headers['x-csrf-token']!==auth.body.csrfToken)throw fail(403,'CSRF','기존 회사 계정으로 로그인한 뒤 연결해 주세요.');
      if(!auth.user.passwordHash)throw fail(409,'PASSWORD_REQUIRED','회사 비밀번호를 먼저 설정한 뒤 SYNK ID를 연결해 주세요.');
      if(!passwordMatches(input.currentPassword,auth.user.passwordHash))throw fail(403,'REAUTH_REQUIRED','현재 회사 비밀번호를 확인해 주세요.');
      if(input.confirm!==true)throw fail(400,'CONFIRM_REQUIRED','SYNK ID 연결 변경을 직접 확인해 주세요.');
    }
    const stamp=now();for(const [key,flow]of flows)if(flow.expiresAt<=stamp)flows.delete(key);
    if(flows.size>=1000)throw fail(429,'BUSY','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    const value=random(),browser=random(),expiresAt=stamp+FLOW_MS;
    // The browser proof and OAuth verifier are short-lived memory only. No token enters SQLite.
    flows.set(hash(value),{action,browserHash:hash(browser),sessionHash:auth?.hash||null,userId:auth?.user.id||null,passwordHash:auth?.user.passwordHash||null,role:auth?.user.role||null,expiresAt});
    res.setHeader('Set-Cookie',`synk_company_flow=${browser}; HttpOnly; SameSite=Lax; Path=/api/synk-id; Max-Age=300${secure}`);
    return {challenge:value,expiresAt:new Date(expiresAt).toISOString()};
  }
  function takeFlow(req,value){
    if(typeof value!=='string'||value.length>100)throw fail(403,'FLOW','로그인 확인이 만료됐습니다. 다시 시작해 주세요.');
    const key=hash(value),flow=flows.get(key),proof=binding(req);
    if(!flow||!proof||flow.browserHash!==hash(proof)||flow.expiresAt<=now())throw fail(403,'FLOW','로그인 확인이 만료됐습니다. 다시 시작해 주세요.');
    flows.delete(key);return flow;
  }
  function currentForFlow(flow,getAuth){const latest=getAuth();if(flow.sessionHash!==latest?.hash){if(flow.sessionHash||latest)throw fail(409,'ACCOUNT_CHANGED','회사 로그인 계정이 바뀌었습니다. 처음부터 다시 연결해 주세요.');}if(flow.action!=='login'&&(!latest||latest.user.passwordHash!==flow.passwordHash||latest.user.role!==flow.role))throw fail(401,'REAUTH_REQUIRED','회사 로그인 상태가 변경되었습니다. 다시 확인해 주세요.');return latest;}
  async function verify(accessToken){
    if(typeof accessToken!=='string'||accessToken.length<10||accessToken.length>16_384||/\s/.test(accessToken))throw fail(401,'TOKEN','SYNK ID 로그인을 다시 진행해 주세요.');
    let identity;
    try{
      if(verifyIdentity)identity=await verifyIdentity(accessToken);
      else {
        const response=await fetcher(config.accountApiUrl,{headers:{Authorization:'Bearer '+accessToken,apikey:config.publishableKey,'X-SYNK-Product':'messenger','X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0'},redirect:'error',signal:AbortSignal.timeout(8000)});
        if(!response.ok){if([401,403].includes(response.status))throw fail(401,'IDENTITY_REJECTED','SYNK ID 로그인을 다시 진행해 주세요.');throw Object.assign(fail(503,'IDENTITY_UNAVAILABLE','SYNK ID 연결을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'),{retryable:true});}const data=await response.json();
        if(data.ok!==true||data.account?.status!=='active')throw fail(401,'IDENTITY_REJECTED','현재 사용할 수 없는 SYNK ID입니다.');identity={synkUserId:data.account.synk_user_id,expiresAt:jwtExpiry(accessToken),currentSessionId:data.sessions?.find(item=>item.current&&!item.revoked)?.id||null};
      }
    }catch(error){if(error.code?.startsWith('SYNK_'))throw error;if([401,403].includes(error.status))throw fail(401,'IDENTITY_REJECTED','SYNK ID 로그인을 다시 진행해 주세요.');throw Object.assign(fail(503,'IDENTITY_UNAVAILABLE','SYNK ID 연결을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'),{retryable:true});}
    if(!identity||typeof identity.synkUserId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.synkUserId)||!Number.isFinite(identity.expiresAt)||identity.expiresAt<=now())throw fail(401,'IDENTITY_REJECTED','SYNK ID 로그인이 만료되었습니다. 다시 로그인해 주세요.');
    return identity;
  }
  function linkStillValid(row,entry){const link=byCompany(row.userId),user=store.get('users',row.userId);return user?.active&&link?.synk_user_id===entry.synkUserId&&link.revision===entry.revision;}
  function removeSession(sessionHash){sessions.delete(sessionHash);store.db.prepare('DELETE FROM tokens WHERE hash=?').run(sessionHash);onRevoked();}
  function attachSession(sessionHash,accessToken,identity,link,browserTokens=null){sessions.set(sessionHash,{accessToken,synkUserId:identity.synkUserId,revision:link.revision,expiresAt:identity.expiresAt,currentSessionId:identity.currentSessionId||null,checkedAt:now(),checking:null,source:browserTokens?'browser':'desktop',refreshToken:typeof browserTokens?.refresh_token==='string'&&browserTokens.refresh_token.length<=16_384?browserTokens.refresh_token:null,pendingAccessToken:null});}
  function sessionAllowed(row){if(!row.body.synkIdentity)return true;const entry=sessions.get(row.hash);return Boolean(enabled&&entry&&!entry.blocked&&entry.synkUserId===row.body.synkIdentity&&entry.expiresAt>now()&&entry.checkedAt+CHECK_MS>now()&&linkStillValid(row,entry));}
  function entryIsCurrent(row,entry){return sessions.get(row.hash)===entry&&Boolean(store.db.prepare("SELECT 1 FROM tokens WHERE hash=? AND purpose='session' AND expiresAt>?").get(row.hash,new Date(now()).toISOString()))&&row.body.synkIdentity===entry.synkUserId&&linkStillValid(row,entry);}
  const unavailable=()=>Object.assign(fail(503,'IDENTITY_UNAVAILABLE','SYNK ID 연결을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'),{retryable:true});
  async function refreshBrowser(row,entry){
    let data;
    try{
      const response=await fetcher(new URL('/auth/v1/oauth/token',config.issuer),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',apikey:config.publishableKey},body:new URLSearchParams({grant_type:'refresh_token',client_id:config.clientId,refresh_token:entry.refreshToken}).toString(),redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok){if([400,401,403].includes(response.status))throw fail(401,'IDENTITY_REJECTED','SYNK ID로 다시 로그인해 주세요.');throw unavailable();}data=await response.json();
    }catch(error){if(error.code?.startsWith('SYNK_'))throw error;throw unavailable();}
    if(!entryIsCurrent(row,entry))throw fail(401,'ACCOUNT_CHANGED','회사 로그인 상태가 변경되었습니다.');
    // Save a rotated credential before central verification, which may be temporarily unavailable.
    if(typeof data.refresh_token==='string'&&data.refresh_token&&data.refresh_token.length<=16_384)entry.refreshToken=data.refresh_token;
    if(typeof data.access_token!=='string'||data.access_token.length<10||data.access_token.length>16_384||/\s/.test(data.access_token)||!verifyIdentity&&jwtExpiry(data.access_token)<=now())throw unavailable();
    entry.pendingAccessToken=data.access_token;
  }
  async function validateSession(row,{force=false}={}){
    if(!row?.body.synkIdentity)return true;
    const entry=sessions.get(row.hash),canRefresh=entry?.source==='browser'&&Boolean(entry.refreshToken&&config?.issuer);
    if(!enabled||!entry||!entryIsCurrent(row,entry)||entry.expiresAt<=now()&&!canRefresh&&!entry.pendingAccessToken){removeSession(row.hash);return false;}
    if(entry.pendingAccessToken&&jwtExpiry(entry.pendingAccessToken)>0&&jwtExpiry(entry.pendingAccessToken)<=now())entry.pendingAccessToken=null;
    const needsRefresh=canRefresh&&entry.expiresAt<=now()+REFRESH_MS;
    if(!force&&!entry.blocked&&!entry.pendingAccessToken&&!needsRefresh&&entry.checkedAt+CHECK_MS>now())return true;
    if(entry.checking)return entry.checking;
    entry.checking=(async()=>{try{
      if(needsRefresh&&!entry.pendingAccessToken)await refreshBrowser(row,entry);
      const candidate=entry.pendingAccessToken||entry.accessToken,identity=await verify(candidate);
      if(!entryIsCurrent(row,entry)||identity.synkUserId!==entry.synkUserId)throw fail(401,'ACCOUNT_CHANGED','회사 로그인 상태가 변경되었습니다.');
      entry.accessToken=candidate;entry.pendingAccessToken=null;entry.currentSessionId=identity.currentSessionId||entry.currentSessionId;entry.checkedAt=now();entry.expiresAt=identity.expiresAt;entry.blocked=false;return true;
    }catch(error){if(sessions.get(row.hash)===entry){if(error.retryable){entry.blocked=true;onRevoked();throw error;}removeSession(row.hash);}return sessionAllowed(row);}finally{entry.checking=null;}})();return entry.checking;
  }
  async function refreshSessions(){for(const [sessionHash,entry]of sessions){const stored=store.db.prepare("SELECT * FROM tokens WHERE hash=? AND purpose='session' AND expiresAt>?").get(sessionHash,new Date(now()).toISOString());if(!stored){sessions.delete(sessionHash);continue;}if(entry.blocked||entry.checkedAt+CHECK_MS/2<=now()||entry.expiresAt<=now()+REFRESH_MS)await validateSession({...stored,body:JSON.parse(stored.body)},{force:true}).catch(()=>{});}onRevoked();}
  async function logout(sessionHash){
    const entry=sessions.get(sessionHash);removeSession(sessionHash);
    if(entry?.source!=='browser')return {ok:true,localSignedOut:true};
    const access=entry.pendingAccessToken||entry.accessToken,headers={Authorization:'Bearer '+access,apikey:config.publishableKey,'X-SYNK-Product':'messenger','X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0'};
    let serverSessionRevoked=false,refreshRevoked=false;
    if(entry.currentSessionId)try{const response=await fetcher(config.accountApiUrl,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({action:'revoke-session',session_id:entry.currentSessionId}),redirect:'error',signal:AbortSignal.timeout(8000)});serverSessionRevoked=response.status===404||response.ok&&(await response.json()).ok===true;}catch{}
    try{const response=await fetcher(new URL('/auth/v1/logout?scope=local',config.issuer),{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(8000)});refreshRevoked=response.ok||response.status===404||response.status===401&&serverSessionRevoked;}catch{}
    return {ok:true,localSignedOut:true,serverRevoked:serverSessionRevoked&&refreshRevoked,serverSessionRevoked,refreshRevoked};
  }
  function dropUserSynkSessions(userId){for(const [sessionHash]of sessions){const row=store.db.prepare('SELECT userId FROM tokens WHERE hash=?').get(sessionHash);if(row?.userId===userId)removeSession(sessionHash);}}
  async function complete(req,res,flow,accessToken,getAuth,setSession,browserTokens=null){
    currentForFlow(flow,getAuth);const identity=await verify(accessToken);const auth=currentForFlow(flow,getAuth);
    let user,link;
    store.transaction(()=>{
      if(flow.action==='link'){
        user=auth.user;const mine=byCompany(user.id),other=bySynk(identity.synkUserId);
        if((mine&&mine.synk_user_id!==identity.synkUserId)||(other&&other.company_user_id!==user.id))throw fail(409,'LINK_CONFLICT','이미 다른 계정에 연결되어 있습니다. 기존 연결을 먼저 해제해 주세요.');
        if(!mine)store.db.prepare('INSERT INTO synk_identity_links VALUES(?,?,?,?)').run(identity.synkUserId,user.id,random(),new Date(now()).toISOString());
        link=byCompany(user.id);
      }else if(flow.action==='unlink'){
        user=auth.user;link=byCompany(user.id);if(!link||link.synk_user_id!==identity.synkUserId)throw fail(403,'LINK_MISMATCH','현재 연결된 SYNK ID로 인증해 주세요.');
        store.db.prepare('DELETE FROM synk_identity_links WHERE company_user_id=?').run(user.id);
      }else{
        link=bySynk(identity.synkUserId);user=link&&store.get('users',link.company_user_id);
        if(!user?.active)throw fail(403,'NOT_LINKED','기존 회사 계정에서 SYNK ID를 먼저 연결해 주세요. 직원 초대가 없는 계정은 들어갈 수 없습니다.');
        if(auth&&auth.user.id!==user.id)throw fail(409,'ACCOUNT_CHANGED','다른 회사 계정에 로그인되어 있습니다. 먼저 로그아웃해 주세요.');
      }
      if(!store.get('users',user.id)?.active)throw fail(403,'INACTIVE','현재 이용할 수 없는 회사 계정입니다.');
    });
    clearFlowCookie(res);
    if(flow.action==='unlink'){dropUserSynkSessions(user.id);return {ok:true,linked:false,...setSession(res,user)};}
    if(auth?.hash)removeSession(auth.hash);
    const result=setSession(res,user,{synkIdentity:identity.synkUserId});
    attachSession(result.sessionHash,accessToken,identity,link,browserTokens);
    const {sessionHash,...publicResult}=result;return {ok:true,linked:true,...publicResult};
  }
  async function exchange(req,res,input,getAuth,setSession){requireEnabled();requireOrigin(req);rate(req);if(input.confirm!==true)throw fail(400,'CONFIRM_REQUIRED','SYNK ID 연결을 확인해 주세요.');const flow=takeFlow(req,input.challenge),access=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1];return complete(req,res,flow,access,getAuth,setSession);}
  async function renew(req,input,getAuth){requireEnabled();requireOrigin(req);const auth=getAuth();if(!auth?.body.synkIdentity||req.headers['x-csrf-token']!==auth.body.csrfToken)throw fail(403,'CSRF','회사 로그인을 다시 진행해 주세요.');const sessionHash=auth.hash,entry=sessions.get(sessionHash);if(!entry)throw fail(401,'IDENTITY_REJECTED','회사 로그인을 다시 진행해 주세요.');const access=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1],identity=await verify(access),latest=getAuth(),link=byCompany(auth.user.id);if(!latest||latest.hash!==sessionHash||!entryIsCurrent(latest,entry)||identity.synkUserId!==auth.body.synkIdentity||link?.synk_user_id!==identity.synkUserId)throw fail(409,'ACCOUNT_CHANGED','SYNK ID 계정이 변경되었습니다. 다시 로그인해 주세요.');attachSession(sessionHash,access,identity,link);return {ok:true};}
  function start(req,res,input,auth){requireEnabled();if(!config.issuer||!config.clientId)throw fail(503,'BROWSER_NOT_CONFIGURED','브라우저 SYNK ID 로그인이 설정 전입니다.');const result=challenge(req,res,input,auth),flow=flows.get(hash(result.challenge)),verifier=random();flow.verifier=verifier;const url=new URL('/auth/v1/oauth/authorize',config.issuer);url.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:origin+'/api/synk-id/callback',scope:'openid profile',state:result.challenge,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return {...result,authorizationUrl:url.href};}
  async function callback(req,res,url,getAuth,setSession){requireEnabled();const allowed=['state','code','error','error_description'];if(url.hash||[...url.searchParams.keys()].some(key=>!allowed.includes(key)||url.searchParams.getAll(key).length!==1)||url.searchParams.has('code')&&url.searchParams.has('error'))throw fail(403,'CALLBACK','SYNK ID 콜백 주소를 확인해 주세요.');const flow=takeFlow(req,url.searchParams.get('state'));currentForFlow(flow,getAuth);const code=url.searchParams.get('code');if(!flow.verifier||!code||code.length>4000||url.searchParams.has('error'))throw fail(403,'FLOW','SYNK ID 로그인을 완료하지 못했습니다. 다시 시작해 주세요.');let data;try{const response=await fetcher(new URL('/auth/v1/oauth/token',config.issuer),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',apikey:config.publishableKey},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:config.clientId,redirect_uri:origin+'/api/synk-id/callback',code_verifier:flow.verifier}).toString(),redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('exchange');data=await response.json();}catch{throw fail(401,'EXCHANGE_FAILED','SYNK ID 로그인을 완료하지 못했습니다. 다시 시작해 주세요.');}return complete(req,res,flow,data.access_token,getAuth,setSession,data);}
  let interval=null;
  return {status,challenge,exchange,renew,start,callback,sessionAllowed,validateSession,refreshSessions,dropUserSynkSessions,logout,
    startChecks(){if(!interval){interval=setInterval(()=>refreshSessions().catch(()=>{}),CHECK_MS/2);interval.unref();}},
    close(){clearInterval(interval);interval=null;sessions.clear();flows.clear();},
  };
}
