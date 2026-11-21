import { createAttemptLimiter, createClientAddress } from './request-security.mjs';

// Public production registration: tools/synk-id/state/bindings-production-20261007-confirmed.json.
// Rechecked against installed Desktop 0.4.90 and active auth.oauth_clients on 2026-11-15.
// This profile never broadens the customer browser or messenger client allowlist.
export const NATIVE_ENTRY_IDENTITY=Object.freeze({
  issuer:'https://qiwxeddwwnzkwalpsuty.supabase.co',
  clientId:'9d7f276d-58bf-4c98-a7fd-9c3da0a40408',product:'platform',
});
// synk.im platform page's own browser client (platform-browser in the same production registration, rechecked 2026-11-21).
// It is accepted only on the web route, only from the portal origin, and only as a bearer — never as a native client.
export const PORTAL_ENTRY_IDENTITY=Object.freeze({issuer:NATIVE_ENTRY_IDENTITY.issuer,clientId:'6cde60e1-d9c4-489e-8a36-3a2ff392e077',product:'platform'});
const NATIVE='/api/native/entry/destinations',WEB='/api/customer/entry/destinations';
const PORTAL_ORIGIN='https://synk.im';
// Preflight request headers the portal may ask for: the cookie read, or the platform-login bearer read.
const portalRequestHeaders=value=>{const list=String(value||'').split(',').map(item=>item.trim().toLowerCase()).filter(Boolean).sort().join(',');return list==='content-type'||list==='authorization,content-type'?list:null;};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class EntryFault extends Error {
  constructor(status,code,retryable=false){super(code);this.status=status;this.code=code;this.retryable=retryable;}
}
const fault=(status,code,retryable=false)=>new EntryFault(status,code,retryable);
const unavailable=()=>fault(503,'TEMPORARY_UNAVAILABLE',true);
const claimsOf=token=>{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}catch{return null;}};
function nativeConfiguration(config){
  if(!config)return null;
  try{
    const issuer=new URL(config.issuer),api=new URL(config.accountApiUrl),key=config.publishableKey;
    if(issuer.href!==NATIVE_ENTRY_IDENTITY.issuer+'/'||api.href!==NATIVE_ENTRY_IDENTITY.issuer+'/functions/v1/synk-account'||
      typeof key!=='string'||key.length>4096||/\s/.test(key)||!(key.startsWith('sb_publishable_')&&key.length>15||claimsOf(key)?.role==='anon'))return null;
    return {accountApiUrl:api.href,publishableKey:key};
  }catch{return null;}
}

// Reads only the verified account's two assignment states. Callers authenticate first.
export function createEntryDestinationReader({synkIdentity,pulseWorkspaces}){
  return synkUserId=>{
    if(!UUID.test(synkUserId||''))throw fault(401,'AUTH_REQUIRED');
    const assigned=synkIdentity.hasActiveCompanyAccount(synkUserId);
    const pulse=pulseWorkspaces.entryAssignment(synkUserId);
    if(typeof assigned!=='boolean'||!['assigned','unassigned','unavailable'].includes(pulse))throw unavailable();
    return {version:1,accountMatch:true,workspace:{state:assigned?'assigned':'unassigned',destination:'/'},pulse:{state:pulse,destination:'/pulse-app/'}};
  };
}

export function createEntryDestinations({origin,customerIdentity,customerConfig=null,synkIdentity,pulseWorkspaces,readStaffSession=()=>null,
  fetch:fetcher=globalThis.fetch,now=()=>Date.now(),body,send,stopping=()=>false,clientAddress=createClientAddress()}){
  const read=createEntryDestinationReader({synkIdentity,pulseWorkspaces});
  const attempts=createAttemptLimiter({limit:60,windowMs:60_000,maxEntries:1000,now});
  // customerConfig has already passed customerIdentityConfig/createCustomerIdentity validation.
  // Reuse only the existing production project's API and public key, not its accepted client ID.
  const nativeConfig=nativeConfiguration(customerConfig);
  const available=()=>{if(stopping())throw unavailable();};
  async function bearerIdentity(req,clientId){
    const token=/^Bearer ([^\s]+)$/i.exec(req.headers.authorization||'')?.[1];
    if(!token||token.length>16_384)throw fault(401,'AUTH_REQUIRED');
    if(!nativeConfig)throw unavailable();
    let response,data;
    try{
      response=await fetcher(nativeConfig.accountApiUrl,{headers:{Authorization:'Bearer '+token,apikey:nativeConfig.publishableKey,
        'X-SYNK-Product':'platform','X-SYNK-Contract':'1','X-SYNK-App-Version':'0.2.0'},redirect:'error',signal:AbortSignal.timeout(8000)});
    }catch{throw unavailable();}
    available();
    if(response.status===401)throw fault(401,'AUTH_REQUIRED');
    if(response.status===403)throw fault(403,'CLIENT_FORBIDDEN');
    if(!response.ok)throw unavailable();
    try{data=await response.json();}catch{throw unavailable();}
    available();
    // Central Auth accepts this exact bearer before any decoded claim grants access.
    const claims=claimsOf(token),stamp=now();
    if(!claims||claims.iss!==NATIVE_ENTRY_IDENTITY.issuer+'/auth/v1'||!UUID.test(claims.sub||'')||!UUID.test(claims.session_id||'')||
      !Number.isSafeInteger(claims.iat)||claims.iat>Math.floor(stamp/1000)+60||!Number.isSafeInteger(claims.exp)||claims.exp*1000<=stamp)throw fault(401,'AUTH_REQUIRED');
    if(claims.client_id!==clientId)throw fault(403,'CLIENT_FORBIDDEN');
    if(data?.ok!==true||!UUID.test(data.account?.synk_user_id||'')||!['active','deletion-requested','disabled','deleted'].includes(data.account.status)||!Array.isArray(data.sessions))throw unavailable();
    if(data.account.status!=='active')throw fault(403,'ACCOUNT_UNAVAILABLE');
    const current=data.sessions.filter(row=>row?.current===true);
    if(current.length===0||current.length===1&&current[0].revoked===true)throw fault(401,'AUTH_REQUIRED');
    if(current.length!==1||current[0].revoked!==false||!UUID.test(current[0].id||''))throw unavailable();
    if(current[0].product!=='platform')throw fault(403,'CLIENT_FORBIDDEN');
    return data.account.synk_user_id;
  }
  return async function entryDestinations(req,res,url){
    const native=url.pathname===NATIVE;
    if(!native&&url.pathname!==WEB)return false;
    const portal=!native&&req.headers.origin===PORTAL_ORIGIN;
    // 11-21: the portal may identify with its own SYNK platform login instead of a company cookie, so an assigned member
    // whose company session lapsed still learns their own assignments. Cookies are not read on that path.
    const portalBearer=portal&&req.method==='POST'&&req.headers.authorization!==undefined;
    const allowPortal=()=>{res.setHeader('Access-Control-Allow-Origin',PORTAL_ORIGIN);res.setHeader('Access-Control-Allow-Credentials','true');};
    if(!native)res.setHeader('Vary','Origin');
    // Only this read-only route accepts the portal origin for existing browser sessions.
    // Set POST headers before validation so safe errors remain readable there.
    if(portal&&req.method==='POST')allowPortal();
    try{
      if(!native&&req.method==='OPTIONS'){
        if(url.search)throw fault(400,'INVALID_INPUT');
        if(!portal)throw fault(403,'ORIGIN_REJECTED');
        const requested=portalRequestHeaders(req.headers['access-control-request-headers']);
        if(req.headers['access-control-request-method']!=='POST'||!requested||
          req.headers['access-control-request-private-network']!==undefined)throw fault(400,'INVALID_INPUT');
        allowPortal();res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers',requested==='content-type'?'Content-Type':'Authorization, Content-Type');
        available();send(res,204,null);return true;
      }
      available();
      if(req.method!=='POST')throw fault(405,'METHOD_NOT_ALLOWED');
      if(url.search)throw fault(400,'INVALID_INPUT');
      if(String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json')throw fault(400,'INVALID_INPUT');
      if(!native&&req.headers.origin!==origin&&!portal)throw fault(403,'ORIGIN_REJECTED');
      try{attempts.reserve(clientAddress(req));}catch(error){if(error.status===429)throw fault(429,'RATE_LIMITED',true);throw error;}
      let input;
      try{input=await body(req,{maxBytes:1024,maxChars:1024});}catch(error){throw fault(error.status===413?413:400,'INVALID_INPUT');}
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||!Object.hasOwn(input,'expectedAccountId')||
        typeof input.expectedAccountId!=='string'||!UUID.test(input.expectedAccountId))throw fault(400,'INVALID_INPUT');
      available();
      let synkUserId,auth,staff;
      if(native)synkUserId=await bearerIdentity(req,NATIVE_ENTRY_IDENTITY.clientId);
      else if(portalBearer)synkUserId=await bearerIdentity(req,PORTAL_ENTRY_IDENTITY.clientId);
      else{
        if(!customerIdentity.status().enabled)throw unavailable();
        const companySession=readStaffSession(req);
        if(companySession?.body.synkIdentity){
          // A company password session alone proves no central account identity.
          const valid=await synkIdentity.validateSession(companySession,{allowMissing:true});
          if(valid===false)throw fault(401,'LOGIN_REQUIRED');
          if(valid)staff=companySession;
        }
        try{auth=await customerIdentity.authenticate(req);}catch(error){if(error.status===401)throw fault(401,'LOGIN_REQUIRED');throw unavailable();}
        available();
        if(staff&&!synkIdentity.sessionAllowed(staff)){
          // A customer round trip can cross the employee identity recheck interval.
          if(!await synkIdentity.validateSession(staff))throw fault(401,'LOGIN_REQUIRED');
          available();
        }
        if(!customerIdentity.status().enabled)throw unavailable();
        if(!staff&&!auth)throw fault(401,'LOGIN_REQUIRED');
        if(staff&&!synkIdentity.sessionAllowed(staff)||auth&&!customerIdentity.isCurrent(auth))throw fault(401,'LOGIN_REQUIRED');
        const staffId=staff?.body.synkIdentity,customerId=auth?.user.synkUserId;
        if(staff&&!UUID.test(staffId||'')||auth&&!UUID.test(customerId||''))throw unavailable();
        if(staff&&auth&&staffId.toLowerCase()!==customerId.toLowerCase())throw fault(409,'ACCOUNT_MISMATCH');
        synkUserId=staffId||customerId;
      }
      available();
      if(synkUserId.toLowerCase()!==input.expectedAccountId.toLowerCase())throw fault(409,'ACCOUNT_MISMATCH');
      // Both session checks and the assignment read finish synchronously after authentication.
      if(auth&&!customerIdentity.isCurrent(auth))throw fault(401,'LOGIN_REQUIRED');
      const result=read(synkUserId);
      send(res,200,result);return true;
    }catch(error){
      const safe=error instanceof EntryFault?error:unavailable();
      send(res,safe.status,{error:{code:safe.code,retryable:safe.retryable}});return true;
    }
  };
}
