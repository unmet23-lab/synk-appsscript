import { randomBytes, createHash } from 'node:crypto';
import { hash, passwordMatches } from './store.mjs';
import { createClientAddress, createAttemptLimiter } from './request-security.mjs';
import { REAUTH_WINDOW_MS, GRANT_OPS, grantsError, readGrantsResponse } from './admin-grants.mjs';

const FLOW_MS=5*60_000, CHECK_MS=30_000, REFRESH_MS=60_000;
// 관리자 화면의 다시 로그인은 SYNK ID 포털이 지금 로그인을 로컬에서 끊고 실제 로그인을 다시 받은 뒤 승인 주소(next)로 보낸다.
const DEFAULT_PORTAL_URL='https://synk.im/id/';
const fail=(status,code,message)=>Object.assign(new Error(message),{status,code:'SYNK_'+code});
const cookie=(req,name)=>new RegExp('(?:^|;\\s*)'+name+'=([^;]+)').exec(req.headers.cookie||'')?.[1];
const jwtExpiry=value=>{try{const data=JSON.parse(Buffer.from(value.split('.')[1],'base64url'));return Number.isFinite(data.exp)?data.exp*1000:0;}catch{return 0;}};
const random=()=>randomBytes(32).toString('base64url');
// The SYNK ID login email is shown only to its own session (「로그인 정보」). It comes from the access token the central
// account API has just accepted, so a token it rejected never names anyone; a token without the claim names nobody.
const loginEmailOf=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+$/.test(value)?value.toLowerCase():null;
const jwtEmail=value=>{try{return loginEmailOf(JSON.parse(Buffer.from(value.split('.')[1],'base64url')).email);}catch{return null;}};
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
  const portalUrl=issuerUrl?httpsUrl(env.SYNK_ID_PORTAL_URL||DEFAULT_PORTAL_URL,'SYNK ID 포털').href:null;
  return {accountApiUrl,publishableKey:key,issuer:issuerUrl?.origin||null,clientId:clientId||null,portalUrl};
}

export function createSynkIdentity({store,origin,config=null,fetch:fetcher=globalThis.fetch,now=()=>Date.now(),verifyIdentity=null,onRevoked=()=>{},clientAddress=createClientAddress()}){
  const enabled=Boolean(config),sessions=new Map(),flows=new Map(),attempts=createAttemptLimiter({limit:30,windowMs:FLOW_MS,maxEntries:1000,now});
  const portalUrl=config?.issuer?httpsUrl(config.portalUrl||DEFAULT_PORTAL_URL,'SYNK ID 포털').href:null;
  const secure=new URL(origin).protocol==='https:'?'; Secure':'';
  store.db.exec('CREATE TABLE IF NOT EXISTS synk_identity_links (synk_user_id TEXT PRIMARY KEY, company_user_id TEXT NOT NULL UNIQUE, revision TEXT NOT NULL, linked_at TEXT NOT NULL)');
  store.db.exec('CREATE TABLE IF NOT EXISTS synk_identity_sessions (session_hash TEXT PRIMARY KEY REFERENCES tokens(hash) ON DELETE CASCADE, ciphertext TEXT NOT NULL)');
  const configuration=hash(JSON.stringify([origin,config?.accountApiUrl,config?.publishableKey,config?.issuer,config?.clientId]));
  let closing=false,closed=false,closeTask=null;
  const byCompany=id=>store.db.prepare('SELECT * FROM synk_identity_links WHERE company_user_id=?').get(id);
  const bySynk=id=>store.db.prepare('SELECT * FROM synk_identity_links WHERE synk_user_id=?').get(id);
  function hasActiveCompanyAccount(synkUserId){
    const link=bySynk(synkUserId);if(!link)return false;
    const user=store.get('users',link.company_user_id);
    if(!user||user.id!==link.company_user_id)throw fail(503,'LINK_UNAVAILABLE','회사 계정 연결을 확인할 수 없습니다.');
    return Boolean(user.active);
  }
  const requireEnabled=()=>{if(closing)throw unavailable();if(!enabled)throw fail(503,'NOT_CONFIGURED','SYNK ID 연결은 아직 설정 전입니다. 기존 회사 계정으로 로그인해 주세요.');};
  function rate(req){attempts.reserve(clientAddress(req));}
  function requireOrigin(req){if(req.headers.origin!==origin)throw fail(403,'ORIGIN','회사 로그인 화면에서 다시 시작해 주세요.');}
  function binding(req){return cookie(req,'synk_company_flow');}
  function clearFlowCookie(res){res.setHeader('Set-Cookie',`synk_company_flow=; HttpOnly; SameSite=Lax; Path=/api/synk-id; Max-Age=0${secure}`);}
  function status(auth){const link=auth&&byCompany(auth.user.id),synkUserId=auth?.body?.synkIdentity&&sessionAllowed(auth)?auth.body.synkIdentity.toLowerCase():null;return {enabled,browserEnabled:enabled&&Boolean(config.issuer&&config.clientId),linked:Boolean(link),canLink:Boolean(auth?.user?.passwordHash),session:auth?.body?.synkIdentity?'synk':'company',synkUserId,loginEmail:synkUserId?sessions.get(auth.hash)?.loginEmail||null:null,reauthNeeded:Boolean(synkUserId)&&!recentInteractive(auth)};}
  // 관리자 직접부여 설계 2절: 쓰기와 관리자 올리기는 최근 15분 안에 SYNK ID에 실제로 로그인한 세션만 한다.
  // interactiveAt은 중앙 admin-reauth-claim이 bound:true로 답한 브라우저 로그인에서만 그 loginAt으로 적는다(Fable 설계 검토 P1-2).
  // 포털은 옛 로그인으로도 승인을 자동으로 내주므로, 회사 로그인을 마친 것만으로는 적지 않는다.
  // interactiveAt은 메모리에만 있다(저장하지 않는다). 회사 서버가 다시 켜지면 다시 확인해야 한다. /api/launch 세션은 늘 거절한다.
  function recentInteractive(row){if(!row?.body?.synkIdentity||row.body.via==='launch'||!sessionAllowed(row))return false;const entry=sessions.get(row.hash),at=entry?.interactiveAt,stamp=now();return Number.isFinite(at)&&at<=stamp&&stamp-at<REAUTH_WINDOW_MS;}
  async function challenge(req,res,input,auth,getAuth=()=>auth){
    requireEnabled();requireOrigin(req);rate(req);
    const action=input.action;if(!['login','link','unlink'].includes(action))throw fail(400,'ACTION','로그인 동작을 확인해 주세요.');
    let expectedAccountId=null;
    if(Object.hasOwn(input,'expectedAccountId')){
      if(action!=='login'||typeof input.expectedAccountId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.expectedAccountId))throw fail(400,'EXPECTED_ACCOUNT','플랫폼에서 선택한 SYNK ID를 확인해 주세요.');
      expectedAccountId=input.expectedAccountId.toLowerCase();
    }
    // 관리자 화면의 「SYNK ID로 다시 확인」은 로그인을 마치면 관리자 화면으로 돌아온다. 다른 값은 받지 않는다.
    let returnTo=null;
    if(Object.hasOwn(input,'returnTo')){if(action!=='login'||input.returnTo!=='admin')throw fail(400,'RETURN_TO','돌아갈 화면을 확인해 주세요.');returnTo='admin';}
    if(action!=='login'){
      if(!auth||req.headers['x-csrf-token']!==auth.body.csrfToken)throw fail(403,'CSRF','기존 회사 계정으로 로그인한 뒤 연결해 주세요.');
      if(!auth.user.passwordHash)throw fail(409,'PASSWORD_REQUIRED','회사 비밀번호를 먼저 설정한 뒤 SYNK ID를 연결해 주세요.');
      if(!await passwordMatches(input.currentPassword,auth.user.passwordHash))throw fail(403,'REAUTH_REQUIRED','현재 회사 비밀번호를 확인해 주세요.');
      currentForFlow({action,sessionHash:auth.hash,passwordHash:auth.user.passwordHash,role:auth.user.role},getAuth);
      if(input.confirm!==true)throw fail(400,'CONFIRM_REQUIRED','SYNK ID 연결 변경을 직접 확인해 주세요.');
    }
    const stamp=now();for(const [key,flow]of flows)if(flow.expiresAt<=stamp)flows.delete(key);
    if(flows.size>=1000)throw fail(429,'BUSY','로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    const value=random(),browser=random(),expiresAt=stamp+FLOW_MS;
    // Browser proof and OAuth verifier remain ephemeral. Session credentials are encrypted separately.
    flows.set(hash(value),{action,expectedAccountId,returnTo,browserHash:hash(browser),sessionHash:auth?.hash||null,userId:auth?.user.id||null,passwordHash:auth?.user.passwordHash||null,role:auth?.user.role||null,expiresAt});
    res.setHeader('Set-Cookie',`synk_company_flow=${browser}; HttpOnly; SameSite=Lax; Path=/api/synk-id; Max-Age=300${secure}`);
    return {challenge:value,expiresAt:new Date(expiresAt).toISOString()};
  }
  function takeFlow(req,value){
    if(typeof value!=='string'||value.length>100)throw fail(403,'FLOW','로그인 확인이 만료됐습니다. 다시 시작해 주세요.');
    const key=hash(value),flow=flows.get(key),proof=binding(req);
    if(!flow||!proof||flow.browserHash!==hash(proof)||flow.expiresAt<=now())throw fail(403,'FLOW','로그인 확인이 만료됐습니다. 다시 시작해 주세요.');
    flows.delete(key);return flow;
  }
  function currentForFlow(flow,getAuth){if(closing)throw unavailable();const latest=getAuth();if(flow.sessionHash!==latest?.hash){if(flow.sessionHash||latest)throw fail(409,'ACCOUNT_CHANGED','회사 로그인 계정이 바뀌었습니다. 처음부터 다시 연결해 주세요.');}if(flow.action!=='login'&&(!latest||latest.user.passwordHash!==flow.passwordHash||latest.user.role!==flow.role))throw fail(401,'REAUTH_REQUIRED','회사 로그인 상태가 변경되었습니다. 다시 확인해 주세요.');return latest;}
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
    return {...identity,loginEmail:verifyIdentity?loginEmailOf(identity.loginEmail):jwtEmail(accessToken)};
  }
  function linkStillValid(row,entry){const link=byCompany(row.userId),user=store.get('users',row.userId);return user?.active&&link?.synk_user_id===entry.synkUserId&&link.revision===entry.revision;}
  function storedSession(sessionHash){if(closed)return null;const row=store.db.prepare("SELECT * FROM tokens WHERE hash=? AND purpose='session' AND expiresAt>?").get(sessionHash,new Date(now()).toISOString());if(!row)return null;try{return {...row,body:JSON.parse(row.body)};}catch{return null;}}
  function removeSession(sessionHash){sessions.delete(sessionHash);if(closed)return;store.db.prepare('DELETE FROM tokens WHERE hash=?').run(sessionHash);if(!closing)onRevoked();}
  function persist(row,entry){
    if(!entryIsCurrent(row,entry))throw fail(401,'ACCOUNT_CHANGED','회사 로그인 상태가 변경되었습니다.');
    const {accessToken,synkUserId,revision,expiresAt,currentSessionId,source,refreshToken,pendingAccessToken,loginEmail}=entry;
    const ciphertext=store.encrypt({version:1,configuration,sessionHash:row.hash,companyUserId:row.userId,accessToken,synkUserId,revision,expiresAt,currentSessionId,source,refreshToken,pendingAccessToken,loginEmail:loginEmail||null});
    store.db.prepare('INSERT INTO synk_identity_sessions VALUES (?,?) ON CONFLICT(session_hash) DO UPDATE SET ciphertext=excluded.ciphertext').run(row.hash,ciphertext);
  }
  // interactiveAt은 complete()가 claim으로 확인한 로그인 시각(없으면 null)이다. 넘기지 않으면(renew) 같은 세션의 이전 값을 이어 받고 올리지 않는다.
  function attachSession(sessionHash,accessToken,identity,link,browserTokens=null,loginAt=undefined){
    if(closing)throw unavailable();
    const previous=sessions.get(sessionHash),interactiveAt=loginAt!==undefined?(Number.isFinite(loginAt)?loginAt:null):previous&&previous.synkUserId===identity.synkUserId&&Number.isFinite(previous.interactiveAt)?previous.interactiveAt:null;
    const entry={interactiveAt,accessToken,synkUserId:identity.synkUserId,revision:link.revision,expiresAt:identity.expiresAt,currentSessionId:identity.currentSessionId||null,checkedAt:now(),checking:null,source:browserTokens?'browser':'desktop',refreshToken:typeof browserTokens?.refresh_token==='string'&&browserTokens.refresh_token.length<=16_384?browserTokens.refresh_token:null,pendingAccessToken:null,loginEmail:identity.loginEmail||null};
    sessions.set(sessionHash,entry);
    try{const row=storedSession(sessionHash);if(!row)throw unavailable();persist(row,entry);}catch(error){removeSession(sessionHash);throw error;}
  }
  function sessionAllowed(row){if(!row.body.synkIdentity)return true;if(closing)return false;const entry=sessions.get(row.hash);return Boolean(enabled&&entry&&!entry.blocked&&entry.synkUserId===row.body.synkIdentity&&entry.expiresAt>now()&&entry.checkedAt+CHECK_MS>now()&&entryIsCurrent(row,entry));}
  function entryIsCurrent(row,entry){if(closed||sessions.get(row.hash)!==entry)return false;const current=storedSession(row.hash);return Boolean(current&&current.userId===row.userId&&current.body.synkIdentity===entry.synkUserId&&row.body.synkIdentity===entry.synkUserId&&linkStillValid(current,entry));}
  const credential=value=>typeof value==='string'&&value.length>=10&&value.length<=16_384&&!/\s/.test(value);
  // Restored credentials are never restored authorization: the first use must verify centrally.
  for(const saved of store.db.prepare('SELECT * FROM synk_identity_sessions').all()){
    let entry,row;
    try{
      row=storedSession(saved.session_hash);entry=store.decrypt(saved.ciphertext);
      if(!enabled||!row||entry.version!==1||entry.configuration!==configuration||entry.sessionHash!==row.hash||entry.companyUserId!==row.userId||entry.synkUserId!==row.body.synkIdentity||!linkStillValid(row,entry)||!credential(entry.accessToken)||!Number.isFinite(entry.expiresAt)||!['browser','desktop'].includes(entry.source)||entry.refreshToken!==null&&(typeof entry.refreshToken!=='string'||entry.refreshToken.length>16_384)||entry.pendingAccessToken!==null&&!credential(entry.pendingAccessToken))throw Error('invalid saved identity');
      sessions.set(row.hash,{...entry,loginEmail:loginEmailOf(entry.loginEmail),checkedAt:0,checking:null,blocked:true});
    }catch{store.db.prepare('DELETE FROM tokens WHERE hash=?').run(saved.session_hash);}
  }
  const unavailable=()=>Object.assign(fail(503,'IDENTITY_UNAVAILABLE','SYNK ID 연결을 확인할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'),{retryable:true});
  async function refreshBrowser(row,entry){
    let data;
    try{
      const response=await fetcher(new URL('/auth/v1/oauth/token',config.issuer),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',apikey:config.publishableKey},body:new URLSearchParams({grant_type:'refresh_token',client_id:config.clientId,refresh_token:entry.refreshToken}).toString(),redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok){if([400,401,403].includes(response.status))throw fail(401,'IDENTITY_REJECTED','SYNK ID로 다시 로그인해 주세요.');throw unavailable();}data=await response.json();
    }catch(error){if(error.code?.startsWith('SYNK_'))throw error;throw unavailable();}
    if(!entryIsCurrent(row,entry))throw fail(401,'ACCOUNT_CHANGED','회사 로그인 상태가 변경되었습니다.');
    // Save a rotated credential before central verification, which may be temporarily unavailable.
    if(typeof data.refresh_token==='string'&&data.refresh_token&&data.refresh_token.length<=16_384){entry.refreshToken=data.refresh_token;persist(row,entry);}
    if(typeof data.access_token!=='string'||data.access_token.length<10||data.access_token.length>16_384||/\s/.test(data.access_token)||!verifyIdentity&&jwtExpiry(data.access_token)<=now())throw unavailable();
    entry.pendingAccessToken=data.access_token;persist(row,entry);
  }
  // Optional callers can distinguish a credential already unusable at lookup
  // from a session revoked while its central verification was pending.
  async function validateSession(row,{force=false,allowMissing=false}={}){
    if(!row?.body.synkIdentity)return true;
    if(closing)return false;
    const entry=sessions.get(row.hash),canRefresh=entry?.source==='browser'&&Boolean(entry.refreshToken&&config?.issuer);
    if(!enabled||!entry||!entryIsCurrent(row,entry)||entry.expiresAt<=now()&&!canRefresh&&!entry.pendingAccessToken){removeSession(row.hash);return allowMissing?null:false;}
    if(entry.pendingAccessToken&&jwtExpiry(entry.pendingAccessToken)>0&&jwtExpiry(entry.pendingAccessToken)<=now())entry.pendingAccessToken=null;
    const needsRefresh=canRefresh&&entry.expiresAt<=now()+REFRESH_MS;
    if(!force&&!entry.blocked&&!entry.pendingAccessToken&&!needsRefresh&&entry.checkedAt+CHECK_MS>now())return true;
    if(entry.checking)return entry.checking;
    entry.checking=(async()=>{try{
      if(needsRefresh&&!entry.pendingAccessToken)await refreshBrowser(row,entry);
      const candidate=entry.pendingAccessToken||entry.accessToken,identity=await verify(candidate);
      if(!entryIsCurrent(row,entry)||identity.synkUserId!==entry.synkUserId)throw fail(401,'ACCOUNT_CHANGED','회사 로그인 상태가 변경되었습니다.');
      entry.accessToken=candidate;entry.pendingAccessToken=null;entry.loginEmail=identity.loginEmail||entry.loginEmail||null;entry.currentSessionId=identity.currentSessionId||entry.currentSessionId;entry.checkedAt=now();entry.expiresAt=identity.expiresAt;entry.blocked=false;persist(row,entry);return true;
    }catch(error){if(sessions.get(row.hash)===entry){if(error.retryable){entry.blocked=true;onRevoked();throw error;}removeSession(row.hash);}return sessionAllowed(row);}finally{entry.checking=null;}})();return entry.checking;
  }
  async function refreshSessions(){for(const [sessionHash,entry]of sessions){if(closing)return;const stored=storedSession(sessionHash);if(!stored){removeSession(sessionHash);continue;}if(entry.blocked||entry.checkedAt+CHECK_MS/2<=now()||entry.expiresAt<=now()+REFRESH_MS)await validateSession(stored,{force:true}).catch(()=>{});}if(!closing)onRevoked();}
  async function searchMemberDirectory(row,query){
    const denied=()=>fail(403,'DIRECTORY_FORBIDDEN','전체 명부를 볼 권한이 있는 SYNK ID로 로그인해 주세요.');
    if(!row?.body.synkIdentity||store.get('users',row.userId)?.role!=='admin'||!sessionAllowed(row))throw denied();
    const entry=sessions.get(row.hash);
    let response,data;
    try{
      response=await fetcher(config.accountApiUrl,{method:'POST',headers:{Authorization:'Bearer '+entry.accessToken,apikey:config.publishableKey,'X-SYNK-Product':'messenger','X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0','Content-Type':'application/json'},body:JSON.stringify({...query,action:'admin-member-directory'}),redirect:'error',signal:AbortSignal.timeout(8000)});
      if(response.ok)data=await response.json();
    }catch{throw unavailable();}
    if(!entryIsCurrent(row,entry)||!sessionAllowed(row)||store.get('users',row.userId)?.role!=='admin')throw denied();
    if(response.status===401||response.status===403)throw denied();
    if(!response.ok||data?.ok!==true||data.page!==query.page||data.pageSize!==25||!Number.isSafeInteger(data.total)||data.total<0||!Array.isArray(data.rows)||data.rows.length>25)throw unavailable();
    const expectedRows=Math.min(25,Math.max(0,data.total-(query.page-1)*25));
    if(data.rows.length!==expectedRows)throw unavailable();
    const rows=data.rows.map(item=>{
      if(!item||typeof item.id!=='string'||typeof item.name!=='string'||typeof item.loginId!=='string'||!['active','disabled','deletion-requested'].includes(item.status)||typeof item.createdAt!=='string')throw unavailable();
      return {id:item.id,name:item.name,loginId:item.loginId,status:item.status,createdAt:item.createdAt};
    });
    return {total:data.total,page:data.page,pageSize:data.pageSize,rows};
  }
  // 관리자 직접부여(설계 4절): 관리자 본인의 SYNK ID 토큰과 공개 키로만 중앙 action admin-workspace-grants를 부른다. 서버 키는 쓰지 않는다.
  // 앞뒤 검사는 명부와 같다. 쓰기는 자동으로 다시 보내지 않는다. 화면이 같은 requestId로 다시 보낼 수 있다.
  async function callAdminGrants(row,op,payload){
    const allowed=()=>{const user=row&&store.get('users',row.userId);return Boolean(row?.body?.synkIdentity&&row.body.via!=='launch'&&user?.active===true&&user.role==='admin'&&sessionAllowed(row));};
    if(closing)throw grantsError(503,'GRANTS_UNAVAILABLE',{retryable:true});
    if(!enabled||!allowed())throw grantsError(403,'GRANTS_FORBIDDEN');
    const entry=sessions.get(row.hash);
    let response,data=null;
    try{
      response=await fetcher(config.accountApiUrl,{method:'POST',headers:{Authorization:'Bearer '+entry.accessToken,apikey:config.publishableKey,'X-SYNK-Product':'messenger','X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0','Content-Type':'application/json'},body:JSON.stringify({...payload,action:'admin-workspace-grants',op}),redirect:'error',signal:AbortSignal.timeout(8000)});
      try{data=await response.json();}catch{data=null;}
    }catch{throw grantsError(503,'GRANTS_UNAVAILABLE',{retryable:true});}
    if(!entryIsCurrent(row,entry)||!allowed()){
      // 쓰기는 중앙이 이미 반영했을 수 있다. 결과를 바뀐 세션에 넘기지 않고 「결과 확인 필요」(같은 requestId로 다시 확인)로 답한다.
      // 2xx이고 꼴이 맞으면 applied에 결과를 실어 회사 기록은 반영으로 남긴다. 읽기는 지금처럼 거절한다.
      if(GRANT_OPS[op]?.write){let applied=null;if(response.ok)try{applied=readGrantsResponse(op,response.status,data,payload);}catch{applied=null;}throw Object.assign(grantsError(503,'GRANTS_UNCONFIRMED',{retryable:true}),applied?{applied}:{});}
      throw grantsError(403,'GRANTS_FORBIDDEN');
    }
    return readGrantsResponse(op,response.status,data,payload);
  }
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
  // 브라우저 login 흐름의 교환 직후 새 Messenger 토큰으로 중앙 admin-reauth-claim을 부른다. 답이 bound:true이고 loginAt이 15분 안(미래 쪽 1분 여유)일 때만
  // 그 시각을 돌려준다. bound:false · 오류 · 시간 초과(8초)는 null이고 로그인 자체는 막지 않는다(쓰기와 ④는 REAUTH_REQUIRED).
  async function claimReauth(accessToken,{code,verifier}){
    try{
      const response=await fetcher(config.accountApiUrl,{method:'POST',headers:{Authorization:'Bearer '+accessToken,apikey:config.publishableKey,'X-SYNK-Product':'messenger','X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0','Content-Type':'application/json'},body:JSON.stringify({action:'admin-reauth-claim',code,codeVerifier:verifier}),redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok)return null;
      const data=await response.json();
      if(data?.ok!==true||data.bound!==true||typeof data.loginAt!=='string'||data.loginAt.length>40||!/^\d{4}-\d{2}-\d{2}T/.test(data.loginAt))return null;
      const at=Date.parse(data.loginAt),stamp=now();
      if(!Number.isFinite(at)||at>stamp+60_000||stamp-at>=REAUTH_WINDOW_MS)return null;
      return Math.min(at,stamp);
    }catch{return null;}
  }
  async function complete(req,res,flow,accessToken,getAuth,setSession,browserTokens=null,proof=null){
    if(closing)throw unavailable();currentForFlow(flow,getAuth);const identity=await verify(accessToken);if(closing)throw unavailable();const auth=currentForFlow(flow,getAuth);
    // The starting account is a match condition, never permission to link or replace a company user.
    if(flow.expectedAccountId&&identity.synkUserId.toLowerCase()!==flow.expectedAccountId)throw fail(409,'PLATFORM_ACCOUNT_MISMATCH','플랫폼에서 선택한 SYNK ID와 로그인 계정이 달라요. 플랫폼에서 다시 열어 주세요.');
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
    // 계정 대조를 마친 뒤, 세션을 붙이기 전에 claim한다. 기다리는 사이 회사 세션 · 연결 · 계정이 바뀌었으면 마치지 않는다.
    // interactiveAt을 쓰는 곳(반 · 이용 권한 쓰기, ④ 관리자 올리기)은 관리자만 들어가므로 관리자 로그인에서만 부른다. 관리자로 올리면 세션이 끊겨 다시 로그인한다.
    let loginAt=null;
    if(flow.action==='login'&&browserTokens&&proof&&user.role==='admin'){
      loginAt=await claimReauth(accessToken,proof);
      currentForFlow(flow,getAuth);
      const latest=bySynk(identity.synkUserId);
      if(!latest||latest.company_user_id!==user.id||latest.revision!==link.revision||!store.get('users',user.id)?.active)throw fail(409,'ACCOUNT_CHANGED','회사 계정 연결이 바뀌었습니다. 다시 로그인해 주세요.');
    }
    clearFlowCookie(res);
    if(flow.action==='unlink'){dropUserSynkSessions(user.id);return {ok:true,linked:false,...setSession(res,user)};}
    if(auth?.hash)removeSession(auth.hash);
    const result=setSession(res,user,{synkIdentity:identity.synkUserId});
    // 데스크톱 교환(exchange) · 재시작 복원 · 자동 들어가기는 claim을 부르지 않으므로 loginAt이 null이다.
    attachSession(result.sessionHash,accessToken,identity,link,browserTokens,loginAt);
    const {sessionHash,...publicResult}=result;return {ok:true,linked:true,...publicResult};
  }
  async function exchange(req,res,input,getAuth,setSession){requireEnabled();requireOrigin(req);rate(req);if(input.confirm!==true)throw fail(400,'CONFIRM_REQUIRED','SYNK ID 연결을 확인해 주세요.');const flow=takeFlow(req,input.challenge),access=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1];return complete(req,res,flow,access,getAuth,setSession);}
  async function renew(req,input,getAuth){requireEnabled();requireOrigin(req);const auth=getAuth();if(!auth?.body.synkIdentity||req.headers['x-csrf-token']!==auth.body.csrfToken)throw fail(403,'CSRF','회사 로그인을 다시 진행해 주세요.');const sessionHash=auth.hash,entry=sessions.get(sessionHash);if(!entry)throw fail(401,'IDENTITY_REJECTED','회사 로그인을 다시 진행해 주세요.');const access=/^Bearer (\S+)$/.exec(req.headers.authorization||'')?.[1],identity=await verify(access);if(closing)throw unavailable();const latest=getAuth(),link=byCompany(auth.user.id);if(!latest||latest.hash!==sessionHash||!entryIsCurrent(latest,entry)||identity.synkUserId!==auth.body.synkIdentity||link?.synk_user_id!==identity.synkUserId)throw fail(409,'ACCOUNT_CHANGED','SYNK ID 계정이 변경되었습니다. 다시 로그인해 주세요.');attachSession(sessionHash,access,identity,link);return {ok:true};}
  // 관리자 화면의 「SYNK ID로 다시 로그인」(reauth:true)은 지금 SYNK ID 세션의 같은 계정 로그인만 받는다. 승인 주소를 포털로 감싸
  // 포털이 지금 로그인을 끊고 실제 로그인을 다시 받게 한다(중앙은 OAuth 승인만 다시 받은 것을 로그인으로 치지 않는다). 콜백은 같다.
  function reauthAllowed(req,input,auth){
    if(!Object.hasOwn(input,'reauth'))return false;
    requireOrigin(req);
    const synkUserId=auth?.body?.synkIdentity;
    if(input.reauth!==true||input.action!=='login'||typeof input.expectedAccountId!=='string'||!synkUserId||auth.body.via==='launch'||!sessionAllowed(auth)||synkUserId.toLowerCase()!==input.expectedAccountId.toLowerCase())
      throw fail(400,'REAUTH_START','SYNK ID로 로그인한 화면에서 같은 SYNK ID로 다시 로그인을 시작해 주세요.');
    return true;
  }
  async function start(req,res,input,auth,getAuth=()=>auth){requireEnabled();if(!config.issuer||!config.clientId)throw fail(503,'BROWSER_NOT_CONFIGURED','브라우저 SYNK ID 로그인이 설정 전입니다.');const reauth=reauthAllowed(req,input,auth),result=await challenge(req,res,input,auth,getAuth),flow=flows.get(hash(result.challenge)),verifier=random();flow.verifier=verifier;const url=new URL('/auth/v1/oauth/authorize',config.issuer);url.search=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:origin+'/api/synk-id/callback',scope:'openid profile',state:result.challenge,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return {...result,authorizationUrl:reauth?portalUrl+'?reauth=1&next='+encodeURIComponent(url.href):url.href};}
  async function callback(req,res,url,getAuth,setSession){requireEnabled();const allowed=['state','code','error','error_description'];if(url.hash||[...url.searchParams.keys()].some(key=>!allowed.includes(key)||url.searchParams.getAll(key).length!==1)||url.searchParams.has('code')&&url.searchParams.has('error'))throw fail(403,'CALLBACK','SYNK ID 콜백 주소를 확인해 주세요.');const flow=takeFlow(req,url.searchParams.get('state'));try{currentForFlow(flow,getAuth);const code=url.searchParams.get('code');if(!flow.verifier||!code||code.length>4000||url.searchParams.has('error'))throw fail(403,'FLOW','SYNK ID 로그인을 완료하지 못했습니다. 다시 시작해 주세요.');let data;try{const response=await fetcher(new URL('/auth/v1/oauth/token',config.issuer),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',apikey:config.publishableKey},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:config.clientId,redirect_uri:origin+'/api/synk-id/callback',code_verifier:flow.verifier}).toString(),redirect:'error',signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('exchange');data=await response.json();}catch{throw fail(401,'EXCHANGE_FAILED','SYNK ID 로그인을 완료하지 못했습니다. 다시 시작해 주세요.');}return {...await complete(req,res,flow,data.access_token,getAuth,setSession,data,{code,verifier:flow.verifier}),returnTo:flow.returnTo||null};}catch(error){if(flow.returnTo&&error&&typeof error==='object')error.returnTo=flow.returnTo;throw error;}}
  let interval=null;
  return {status,hasActiveCompanyAccount,searchMemberDirectory,callAdminGrants,recentInteractive,challenge,exchange,renew,start,callback,sessionAllowed,validateSession,refreshSessions,dropUserSynkSessions,logout,
    startChecks(){if(!closing&&!interval){interval=setInterval(()=>refreshSessions().catch(()=>{}),CHECK_MS/2);interval.unref();}},
    close(){if(!closeTask){closing=true;clearInterval(interval);interval=null;flows.clear();closeTask=Promise.allSettled([...sessions.values()].map(entry=>entry.checking).filter(Boolean));}return closeTask;},
    // HTTP logout may finish while listeners drain. Keep its credentials and DB access until then.
    dispose(){closed=true;sessions.clear();flows.clear();},
  };
}
