'use strict';
const http=require('node:http'),crypto=require('node:crypto');
const {requestSpec,redact}=require('./account-requests.cjs');
const {projectLibrary}=require('./library-access.cjs');
const MESSAGES={AUTH_CONFIG:'로그인 연결 설정이 아직 준비되지 않았어요.',AUTH_REQUIRED:'SYNK ID로 다시 로그인해 주세요.',AUTH_CANCELLED:'로그인을 취소했어요.',AUTH_TIMEOUT:'로그인 시간이 지났어요. 다시 시작해 주세요.',CALLBACK_UNAVAILABLE:'로그인 도착 주소를 열지 못했어요. 다른 앱을 확인한 뒤 다시 시도해 주세요.',AUTH_FAILED:'로그인 연결을 확인하지 못했어요. 다시 시도해 주세요.',AUTH_CHANGED:'로그인 상태가 바뀌었어요.',SECURE_STORAGE_UNAVAILABLE:'안전한 기기 저장소를 사용할 수 없어요.',NETWORK:'서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.',INVALID_REQUEST:'요청 형식을 확인해 주세요.',AUTH_SERVER_UNAVAILABLE:'로그인 서버를 확인하지 못했어요. 잠시 뒤 다시 시도해 주세요.'};
function fault(code,status,retryable=false){return Object.assign(new Error(MESSAGES[code]||'요청을 완료하지 못했어요.'),{code,status,retryable});}
function publicError(error){return {code:error.code||'AUTH_FAILED',message:MESSAGES[error.code]||'요청을 완료하지 못했어요.',retryable:!!error.retryable,...(error.status?{status:error.status}:{})};}
function createAuthService({config,store,openExternal,fetcher=globalThis.fetch,appVersion='0.1.0',now=Date.now,timeoutMs=12000,loginTimeoutMs=300000,onChange=()=>{}}){
  let status=config?'signed-out':'unconfigured',lastError=null,session=null,account=null,librarySource=null,pending=null,epoch=0,accountLoadSequence=0,refreshing=null,initialized=false;
  const controllers=new Set();
  const snapshot=()=>({configured:!!config,status,signedIn:status==='signed-in'&&!!session,sessionGeneration:epoch,secureStorage:store.available(),account:account?{synk_user_id:account.synk_user_id,display_name:account.profile?.display_name||''}:null,library:projectLibrary(status==='signed-in'&&session?.verified?librarySource:null,now()),error:lastError});
  function emit(){onChange(snapshot());}
  function check(expected){if(expected!==epoch)throw fault('AUTH_CHANGED');}
  async function json(url,options={},maxBytes=33554432){
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeoutMs);controllers.add(abort);
    try{const response=await fetcher(url,{...options,signal:abort.signal,redirect:'error',credentials:'omit',cache:'no-store'});let size=0;const chunks=[];
      if(response.body){for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes){abort.abort();throw fault('AUTH_FAILED');}chunks.push(Buffer.from(chunk));}}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{if(response.status===429||response.status>=500)data=null;else throw fault('AUTH_SERVER_UNAVAILABLE',response.status,true);}
      return {response,data};
    }catch(error){if(error.code&&MESSAGES[error.code])throw error;throw fault('NETWORK',undefined,true);}finally{clearTimeout(timer);controllers.delete(abort);}
  }
  async function tokens(fields){const {response,data}=await json(config.supabaseUrl+'/auth/v1/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)},65536);
    if(!response.ok){if(response.status>=500||response.status===429)throw fault('AUTH_SERVER_UNAVAILABLE',response.status,true);throw fault('AUTH_REQUIRED',response.status);}
    if(typeof data.access_token!=='string'||data.access_token.length>16384||typeof data.refresh_token!=='string'||!data.refresh_token||data.refresh_token.length>16384||!Number.isFinite(data.expires_in)||data.expires_in<=0||data.expires_in>604800||data.token_type?.toLowerCase()!=='bearer')throw fault('AUTH_SERVER_UNAVAILABLE',response.status,true);
    return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:now()+data.expires_in*1000};
  }
  const headers=token=>({apikey:config.publishableKey,Authorization:'Bearer '+token,'X-SYNK-Product':config.product,'X-SYNK-Contract':'1','X-SYNK-App-Version':appVersion});
  async function verify(next,expectedSubject){
    const verified=await json(config.supabaseUrl+'/auth/v1/user',{headers:headers(next.accessToken)},65536);
    if(!verified.response.ok){if([401,403].includes(verified.response.status))throw fault('AUTH_REQUIRED',verified.response.status);throw fault('AUTH_SERVER_UNAVAILABLE',verified.response.status,true);}
    if(typeof verified.data?.id!=='string'||!verified.data.id)throw fault('AUTH_SERVER_UNAVAILABLE',verified.response.status,true);
    if(expectedSubject&&expectedSubject!==verified.data.id)throw fault('AUTH_REQUIRED',verified.response.status);
    const result=await json(config.accountApiUrl+'/functions/v1/synk-account',{headers:headers(next.accessToken)});
    if(!result.response.ok||result.data?.ok!==true||typeof result.data.account?.synk_user_id!=='string'){
      if([401,403].includes(result.response.status)||['SESSION_REVOKED','AUTH_REQUIRED','AUTH_SESSION_MISSING'].includes(result.data?.error?.code))throw fault('AUTH_REQUIRED',result.response.status);
      throw fault('AUTH_SERVER_UNAVAILABLE',result.response.status,true);
    }
    return {next:{...next,subject:verified.data.id,currentSessionId:(result.data.sessions||[]).find(s=>s.current&&!s.revoked)?.id||null},account:result.data.account,librarySource:result.data};
  }
  async function install(next,expected,expectedSubject){
    check(expected);await store.save({refreshToken:next.refreshToken,subject:expectedSubject||null});check(expected);
    session={...next,subject:expectedSubject||null,verified:false};account=null;librarySource=null;status='restoring';lastError=null;emit();
    const verified=await verify(next,expectedSubject);check(expected);await store.save({refreshToken:verified.next.refreshToken,subject:verified.next.subject});check(expected);session={...verified.next,verified:true};account=verified.account;librarySource=verified.librarySource;status='signed-in';lastError=null;emit();
  }
  function closePending(){if(!pending)return;clearTimeout(pending.timer);pending.server.close();pending.server.closeAllConnections?.();pending=null;}
  async function discard(code){epoch++;accountLoadSequence++;closePending();for(const c of controllers)c.abort();session=null;account=null;librarySource=null;status=config?'signed-out':'unconfigured';lastError=code?publicError(fault(code)):null;emit();await store.clear();}
  async function refresh(){
    if(refreshing)return refreshing;
    const expected=epoch,old=session;
    if(!old?.refreshToken)throw fault('AUTH_REQUIRED');
    const promise=(async()=>{try{const next=await tokens({grant_type:'refresh_token',client_id:config.clientId,refresh_token:old.refreshToken});check(expected);await install(next,expected,old.subject);return session.accessToken;}catch(error){if(expected===epoch){if(!error.retryable)await discard(error.code==='SECURE_STORAGE_UNAVAILABLE'?error.code:'AUTH_REQUIRED');else{status='error';account=null;lastError=publicError(error);emit();}}throw error;}finally{if(refreshing===promise)refreshing=null;}})();
    refreshing=promise;return promise;
  }
  async function initialize(){if(initialized)return snapshot();initialized=true;if(!config)return snapshot();if(!store.available()){status='error';lastError=publicError(fault('SECURE_STORAGE_UNAVAILABLE'));emit();return snapshot();}
    const expected=epoch;status='restoring';emit();
    try{const saved=await store.load();check(expected);if(!saved){status='signed-out';emit();return snapshot();}session={...saved,accessToken:null,expiresAt:0};await refresh();}
    catch(error){if(expected===epoch){if(error.retryable){status='error';account=null;lastError=publicError(error);emit();}else await discard(error.code==='SECURE_STORAGE_UNAVAILABLE'?error.code:'AUTH_REQUIRED');}}
    return snapshot();
  }
  async function signIn(){if(!config)throw fault('AUTH_CONFIG');if(!store.available())throw fault('SECURE_STORAGE_UNAVAILABLE');if(pending)return snapshot();
    await discard();const expected=epoch,redirect=new URL(config.redirectUri),state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(32).toString('base64url'),challenge=crypto.createHash('sha256').update(verifier).digest('base64url'),expiresAt=now()+loginTimeoutMs;
    const server=http.createServer({maxHeaderSize:8192},(req,res)=>{
      const reply=(code,text)=>{res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','Connection':'close'});res.end(text);};
      if(!pending||pending.expected!==expected||pending.consumed)return reply(410,'이미 처리되었거나 취소된 로그인입니다.');
      if(now()>expiresAt||now()<expiresAt-loginTimeoutMs){reply(410,'로그인 시간이 지났습니다.');void discard('AUTH_TIMEOUT');return;}
      if(req.method!=='GET'||req.headers.host!==redirect.host||req.socket.remoteAddress!=='127.0.0.1'||typeof req.url!=='string'||!req.url.startsWith(redirect.pathname+'?')||req.url.length>8192)return reply(400,'등록한 로그인 주소가 아닙니다.');
      const incoming=new URL(req.url,redirect.origin),params=incoming.searchParams;
      if(incoming.pathname!==redirect.pathname||incoming.hash||params.getAll('state').length!==1||params.get('state')!==state||[...params.keys()].some(k=>!['state','code','error','error_description'].includes(k))||params.has('code')===params.has('error')||params.getAll('code').length>1||params.getAll('error').length>1)return reply(400,'로그인 요청을 확인하지 못했습니다.');
      const code=params.get('code');if(code&&code.length>4096||!code&&!params.get('error'))return reply(400,'로그인 코드를 확인하지 못했습니다.');
      pending.consumed=true;reply(200,'로그인 응답을 받았습니다. SYNK 앱에서 결과를 확인해 주세요.');server.close();
      if(params.has('error')){void discard(params.get('error')==='access_denied'?'AUTH_CANCELLED':'AUTH_FAILED');return;}
      void (async()=>{try{const next=await tokens({grant_type:'authorization_code',client_id:config.clientId,redirect_uri:config.redirectUri,code,code_verifier:verifier});check(expected);if(now()>expiresAt)throw fault('AUTH_TIMEOUT');await install(next,expected);closePending();}catch(error){if(expected===epoch){if(error.retryable){closePending();status='error';account=null;lastError=publicError(error);emit();}else await discard(error.code||'AUTH_FAILED');}}})();
    });
    server.maxHeadersCount=20;server.requestTimeout=5000;server.headersTimeout=5000;server.on('clientError',(_error,socket)=>socket.destroy());
    pending={server,expected,consumed:false,timer:setTimeout(()=>{void discard('AUTH_TIMEOUT');},loginTimeoutMs)};
    try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:Number(redirect.port),exclusive:true},resolve);});check(expected);status='signing-in';lastError=null;emit();
      const url=new URL(config.supabaseUrl+'/auth/v1/oauth/authorize');url.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,state,code_challenge:challenge,code_challenge_method:'S256',scope:'openid email profile'});await openExternal(url.href);check(expected);return snapshot();
    }catch(error){if(expected===epoch)await discard(error.code==='EADDRINUSE'?'CALLBACK_UNAVAILABLE':'AUTH_FAILED');throw fault(error.code==='EADDRINUSE'?'CALLBACK_UNAVAILABLE':'AUTH_FAILED');}
  }
  async function getAccessToken(){if(!session)throw fault('AUTH_REQUIRED');if(session.expiresAt<=now()+30000)return refresh();
    if(!session.verified){if(refreshing)return refreshing;const expected=epoch,next=session;
      const promise=(async()=>{try{await install(next,expected,next.subject);return session.accessToken;}catch(error){if(expected===epoch){if(error.retryable){status='error';lastError=publicError(error);emit();}else await discard('AUTH_REQUIRED');}throw error;}finally{if(refreshing===promise)refreshing=null;}})();refreshing=promise;return promise;
    }return session.accessToken;
  }
  async function signOut(){const old=session;let localError;try{await discard();}catch(error){localError=error;}
    let refreshRevoked=!old,serverSessionRevoked=!old;
    if(old?.refreshToken){let token=old.accessToken;try{if(old.expiresAt<=now()+5000)token=(await tokens({grant_type:'refresh_token',client_id:config.clientId,refresh_token:old.refreshToken})).accessToken;}catch{token=null;}
      if(token){if(old.currentSessionId){try{const result=await json(config.accountApiUrl+'/functions/v1/synk-account',{method:'POST',headers:{...headers(token),'Content-Type':'application/json'},body:JSON.stringify({action:'revoke-session',session_id:old.currentSessionId})});serverSessionRevoked=result.response.ok&&result.data.ok===true||result.response.status===404;}catch{}}
        try{const response=await fetcher(config.supabaseUrl+'/auth/v1/logout?scope=local',{method:'POST',headers:headers(token),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});refreshRevoked=response.ok||response.status===404||serverSessionRevoked&&response.status===401;}catch{}
      }
    }
    return {ok:!localError,status:snapshot(),serverRevoked:serverSessionRevoked&&refreshRevoked,serverSessionRevoked,refreshRevoked,...(localError?{error:publicError(fault('AUTH_FAILED'))}:{})};
  }
  async function accountRequest(operation,params){let spec,loadSequence,requestEpoch;try{if(config?.product==='messenger'&&!['load','revokeSession'].includes(operation))throw fault('INVALID_REQUEST');spec=requestSpec(operation,params,appVersion,config?.product);const expected=epoch;requestEpoch=expected;if(operation==='load'){loadSequence=++accountLoadSequence;librarySource=null;emit();}let token=await getAccessToken();check(expected);
      const send=t=>json(config.accountApiUrl+'/functions/v1/'+spec.path,{method:spec.body===undefined?'GET':'POST',headers:{...headers(t),...(spec.body===undefined?{}:{'Content-Type':'application/json'})},...(spec.body===undefined?{}:{body:JSON.stringify(spec.body)})});
      let result=await send(token);check(expected);if(result.response.status===401){if(session.accessToken===token)token=await refresh();else token=session.accessToken;check(expected);result=await send(token);check(expected);}
      if(!result.response.ok||result.data?.ok!==true){const code=typeof result.data?.error?.code==='string'&&/^[A-Z_]{1,80}$/.test(result.data.error.code)?result.data.error.code:result.response.status===401?'AUTH_REQUIRED':'ACCOUNT_UNAVAILABLE';if(['AUTH_REQUIRED','SESSION_REVOKED','AUTH_SESSION_MISSING'].includes(code))await discard('AUTH_REQUIRED');else if(loadSequence===accountLoadSequence){librarySource=null;emit();}return {ok:false,error:{code,message:'계정 요청을 완료하지 못했어요.',retryable:result.response.status>=500||result.response.status===429,status:result.response.status},...(Number.isSafeInteger(result.data?.revision)?{revision:result.data.revision}:{})};}
      const data=redact(result.data);if(operation==='load'&&loadSequence===accountLoadSequence){if(typeof data.account?.synk_user_id!=='string'||data.account.synk_user_id!==account?.synk_user_id){await discard('AUTH_REQUIRED');return {ok:false,error:publicError(fault('AUTH_REQUIRED'))};}account=data.account;librarySource=data;emit();}if(operation==='revokeAll'||operation==='revokeSession'&&(data.current===true||data.currentRevoked===true))await discard();return data;
    }catch(error){if(requestEpoch===epoch&&loadSequence===accountLoadSequence){librarySource=null;emit();}return {ok:false,error:publicError(error)};}
  }
  return {status:snapshot,initialize,signIn,cancel:async()=>{if(pending)await discard('AUTH_CANCELLED');return snapshot();},signOut,accountRequest,getAccessToken,dispose:()=>{epoch++;accountLoadSequence++;closePending();for(const c of controllers)c.abort();session=null;account=null;librarySource=null;}};
}
module.exports={createAuthService,publicError};
