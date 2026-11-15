import { createAttemptLimiter, createClientAddress } from './request-security.mjs';

// Public production registration: tools/synk-id/state/bindings-production-20261007-confirmed.json.
// Rechecked against installed Desktop 0.4.90 and active auth.oauth_clients on 2026-11-15.
// This profile never broadens the customer browser or messenger client allowlist.
export const NATIVE_ENTRY_IDENTITY=Object.freeze({
  issuer:'https://qiwxeddwwnzkwalpsuty.supabase.co',
  clientId:'9d7f276d-58bf-4c98-a7fd-9c3da0a40408',product:'platform',
});
const NATIVE='/api/native/entry/destinations',WEB='/api/customer/entry/destinations';
const PORTAL_ORIGIN='https://synk.im';
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

export function createEntryDestinations({origin,customerIdentity,customerConfig=null,synkIdentity,pulseWorkspaces,
  fetch:fetcher=globalThis.fetch,now=()=>Date.now(),body,send,stopping=()=>false,clientAddress=createClientAddress()}){
  const read=createEntryDestinationReader({synkIdentity,pulseWorkspaces});
  const attempts=createAttemptLimiter({limit:60,windowMs:60_000,maxEntries:1000,now});
  // customerConfig has already passed customerIdentityConfig/createCustomerIdentity validation.
  // Reuse only the existing production project's API and public key, not its accepted client ID.
  const nativeConfig=nativeConfiguration(customerConfig);
  const available=()=>{if(stopping())throw unavailable();};
  async function nativeIdentity(req){
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
    if(claims.client_id!==NATIVE_ENTRY_IDENTITY.clientId)throw fault(403,'CLIENT_FORBIDDEN');
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
    const allowPortal=()=>{res.setHeader('Access-Control-Allow-Origin',PORTAL_ORIGIN);res.setHeader('Access-Control-Allow-Credentials','true');};
    if(!native)res.setHeader('Vary','Origin');
    // Only this read-only customer route accepts the portal's existing cookie.
    // Set POST headers before validation so safe errors remain readable there.
    if(portal&&req.method==='POST')allowPortal();
    try{
      if(!native&&req.method==='OPTIONS'){
        if(url.search)throw fault(400,'INVALID_INPUT');
        if(!portal)throw fault(403,'ORIGIN_REJECTED');
        if(req.headers['access-control-request-method']!=='POST'||
          String(req.headers['access-control-request-headers']||'').trim().toLowerCase()!=='content-type'||
          req.headers['access-control-request-private-network']!==undefined)throw fault(400,'INVALID_INPUT');
        allowPortal();res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type');
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
      let synkUserId,auth;
      if(native)synkUserId=await nativeIdentity(req);
      else{
        if(!customerIdentity.status().enabled)throw unavailable();
        try{auth=await customerIdentity.authenticate(req);}catch(error){if(error.status===401)throw fault(401,'LOGIN_REQUIRED');throw unavailable();}
        available();
        if(!customerIdentity.status().enabled)throw unavailable();
        if(!auth||!customerIdentity.isCurrent(auth))throw fault(401,'LOGIN_REQUIRED');
        synkUserId=auth.user.synkUserId;
        if(!UUID.test(synkUserId||''))throw unavailable();
      }
      available();
      if(synkUserId.toLowerCase()!==input.expectedAccountId.toLowerCase())throw fault(409,'ACCOUNT_MISMATCH');
      // No await follows: a logout, superseded customer session, or shutdown cannot
      // interleave with this synchronous own-assignment read and its response.
      if(!native&&!customerIdentity.isCurrent(auth))throw fault(401,'LOGIN_REQUIRED');
      const result=read(synkUserId);
      send(res,200,result);return true;
    }catch(error){
      const safe=error instanceof EntryFault?error:unavailable();
      send(res,safe.status,{error:{code:safe.code,retryable:safe.retryable}});return true;
    }
  };
}
