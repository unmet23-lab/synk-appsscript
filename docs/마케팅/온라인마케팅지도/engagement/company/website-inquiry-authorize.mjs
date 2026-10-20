import {createServer} from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {Store} from './store.mjs';
import {websiteInquiryCredentialInput} from './website-inquiry-connect.mjs';
import {createGoogleFormsInquiryReader,WEBSITE_INQUIRY_SCOPES,WEBSITE_INQUIRY_SECRET} from './website-inquiry-google.mjs';

// Official desktop OAuth: https://developers.google.com/identity/protocols/oauth2/native-app
// Owner identity is verified by Google's authenticated UserInfo endpoint, never
// by decoding an unverified ID token. Neither grants nor customer text are logged.
const AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL='https://oauth2.googleapis.com/token';
const USERINFO_URL='https://openidconnect.googleapis.com/v1/userinfo';
export const WEBSITE_INQUIRY_AUTH_SCOPES=Object.freeze(['openid','email',...WEBSITE_INQUIRY_SCOPES]);
const fail=(code,message)=>Object.assign(new Error(message),{code});
const safeEqual=(left,right)=>typeof left==='string'&&typeof right==='string'&&Buffer.byteLength(left)===Buffer.byteLength(right)&&timingSafeEqual(Buffer.from(left),Buffer.from(right));
const secretText=value=>typeof value==='string'&&value.length>0&&value.length<16384&&!/[\r\n\0]/.test(value);

export async function readWebsiteInquiryOAuthClient(clientConfigPath=join(homedir(),'.clasprc.json')){
  const source=await realpath(resolve(clientConfigPath)),repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../../../..');
  const comparable=process.platform==='win32'?source.toLowerCase():source,root=process.platform==='win32'?repo.toLowerCase():repo;
  if(comparable===root||comparable.startsWith(root+'/')||comparable.startsWith(root+'\\'))throw fail('INQUIRY_OAUTH_CLIENT','OAuth 원본 파일은 저장소 밖 비공개 경로를 사용해 주세요.');
  const info=await stat(source);
  if(!info.isFile()||info.size>65536||process.platform!=='win32'&&(info.mode&0o077))throw fail('INQUIRY_OAUTH_CLIENT','기존 OAuth 파일의 형식과 소유자 전용 권한을 확인해 주세요.');
  let data;try{data=JSON.parse(await readFile(source,'utf8'));}catch{throw fail('INQUIRY_OAUTH_CLIENT','기존 OAuth 파일을 읽지 못했습니다.');}
  const saved=data?.tokens?.default||data?.installed||data;
  if(!secretText(saved?.client_id)||!saved.client_id.endsWith('.apps.googleusercontent.com')||!secretText(saved?.client_secret))throw fail('INQUIRY_OAUTH_CLIENT','기존 Google OAuth 클라이언트를 확인해 주세요.');
  return {client_id:saved.client_id,client_secret:saved.client_secret};
}

async function checkedJSON(fetchImpl,url,options,signal){
  signal.throwIfAborted();
  let response;
  try{response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});}
  catch{signal.throwIfAborted();throw fail('INQUIRY_OAUTH_NETWORK','Google 연결을 완료하지 못했습니다.');}
  if(!response.ok){await response.body?.cancel?.().catch(()=>{});throw fail('INQUIRY_OAUTH_RESPONSE','Google의 승인 또는 계정 확인을 완료하지 못했습니다.');}
  let text;try{text=await response.text();}catch{throw fail('INQUIRY_OAUTH_RESPONSE','Google 응답을 읽지 못했습니다.');}
  signal.throwIfAborted();
  if(Buffer.byteLength(text)>65536)throw fail('INQUIRY_OAUTH_RESPONSE','Google 응답 형식을 확인해 주세요.');
  let data;try{data=JSON.parse(text);}catch{throw fail('INQUIRY_OAUTH_RESPONSE','Google 응답 형식을 확인해 주세요.');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw fail('INQUIRY_OAUTH_RESPONSE','Google 응답 형식을 확인해 주세요.');
  return data;
}

function checkGrantedScopes(value){
  if(typeof value!=='string')throw fail('INQUIRY_OAUTH_SCOPE','승인된 읽기 권한을 확인할 수 없습니다.');
  const scopes=new Set(value.split(/\s+/).filter(Boolean).map(scope=>scope==='https://www.googleapis.com/auth/userinfo.email'?'email':scope));
  if(WEBSITE_INQUIRY_AUTH_SCOPES.some(scope=>!scopes.has(scope))||[...scopes].some(scope=>!WEBSITE_INQUIRY_AUTH_SCOPES.includes(scope)))
    throw fail('INQUIRY_OAUTH_SCOPE','문의 양식 읽기와 계정 확인 권한만 승인해야 합니다.');
}

/** --execute is the only path that starts consent or installs credentials.
 * The callback URL is shown to the operator; this CLI never controls a browser.
 * Credentials stay in memory and go directly into the existing encrypted store. */
export async function authorizeWebsiteInquiry({dataDir,installCredentials,ownerEmail,clientConfigPath,execute=false,onAuthorizationUrl,
  fetchImpl=globalThis.fetch,signal,timeoutMs=300000}={}){
  const owner=typeof ownerEmail==='string'?ownerEmail.trim().toLowerCase():'';
  if(!/^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]+$/.test(owner))throw fail('INQUIRY_OAUTH_OWNER','확인된 문의 양식 소유자 이메일을 --owner로 지정해 주세요.');
  if((Boolean(dataDir)?1:0)+(typeof installCredentials==='function'?1:0)!==1||installCredentials!==undefined&&typeof installCredentials!=='function')
    throw fail('INQUIRY_OAUTH_DATA','기존 회사 데이터 경로 또는 비공개 설치 연결 중 하나를 지정해 주세요.');
  let directory;
  if(dataDir){
    directory=await realpath(resolve(dataDir));
    const [db,key]=await Promise.all([stat(join(directory,'company.sqlite')),stat(join(directory,'encryption.key'))]);
    if(!db.isFile()||!key.isFile()||key.size!==32)throw fail('INQUIRY_OAUTH_DATA','기존 회사 데이터와 암호화 키를 확인해 주세요.');
  }
  const client=await readWebsiteInquiryOAuthClient(clientConfigPath);
  if(!execute)return {ready:true,consentStarted:false,installed:false,destination:directory?'local':'external',scopes:WEBSITE_INQUIRY_AUTH_SCOPES,ownerMustMatch:true,customerDataRead:false};
  if(typeof onAuthorizationUrl!=='function')throw fail('INQUIRY_OAUTH_PRESENT','승인 주소를 전달할 방법이 필요합니다.');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>600000)throw fail('INQUIRY_OAUTH_TIMEOUT','승인 대기 시간을 확인해 주세요.');
  const deadline=AbortSignal.timeout(timeoutMs),active=signal?AbortSignal.any([signal,deadline]):deadline;
  active.throwIfAborted();
  const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('base64url');
  // Google documents a bare loopback origin with a random port for desktop
  // clients; do not assume an arbitrary callback path is registered.
  const callbackPath='/';
  let redirect,used=false,finish,rejectCallback;
  const callback=new Promise((done,reject)=>{finish=done;rejectCallback=reject;});
  // Attach immediately: a timeout during presenter work must not become an
  // unhandled rejection. Awaiting callback below still receives the error.
  callback.catch(()=>{});
  const server=createServer((req,res)=>{
    const send=(status,message)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Connection':'close'});res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><p>'+message+'</p></html>');};
    let url;
    try{url=new URL(req.url,redirect);}catch{send(400,'승인 응답 주소를 확인해 주세요.');return;}
    if(used||req.method!=='GET'||req.headers.host!==new URL(redirect).host||url.origin!==new URL(redirect).origin||url.pathname!==callbackPath||url.hash){send(400,'이 승인 요청의 응답 주소가 아닙니다.');return;}
    if(url.searchParams.getAll('state').length!==1||!safeEqual(url.searchParams.get('state'),state)){send(400,'승인 요청이 일치하지 않습니다.');return;}
    if(url.searchParams.has('error')){
      used=true;send(400,'Google 승인이 완료되지 않았습니다. 연결은 저장하지 않았습니다.');
      rejectCallback(fail('INQUIRY_OAUTH_DENIED','Google 승인이 취소되었거나 거절되었습니다.'));return;
    }
    const code=url.searchParams.get('code');
    if(url.searchParams.getAll('code').length!==1||!secretText(code)||code.length>4096){send(400,'승인 응답 형식을 확인해 주세요.');return;}
    used=true;send(200,'승인 응답을 받았습니다. 계정과 읽기 권한 확인 결과는 명령 창에서 확인해 주세요.');finish(code);
  });
  const abort=()=>rejectCallback(fail('INQUIRY_OAUTH_CANCELLED','승인 대기가 끝났거나 취소되었습니다. 연결은 저장하지 않았습니다.'));
  active.addEventListener('abort',abort,{once:true});
  try{
    await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
    active.throwIfAborted();
    redirect='http://127.0.0.1:'+server.address().port;
    const auth=new URL(AUTH_URL);auth.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirect,response_type:'code',
      scope:WEBSITE_INQUIRY_AUTH_SCOPES.join(' '),access_type:'offline',prompt:'consent select_account',login_hint:owner,include_granted_scopes:'false',
      code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state}).toString();
    await onAuthorizationUrl(auth.href);
    const code=await callback;active.throwIfAborted();
    const tokens=await checkedJSON(fetchImpl,TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({...client,code,grant_type:'authorization_code',redirect_uri:redirect,code_verifier:verifier})},active);
    if(!secretText(tokens.access_token)||!secretText(tokens.refresh_token)||tokens.token_type?.toLowerCase()!=='bearer')throw fail('INQUIRY_OAUTH_TOKEN','Google 읽기 연결에 필요한 승인을 다시 확인해 주세요.');
    checkGrantedScopes(tokens.scope);
    const identity=await checkedJSON(fetchImpl,USERINFO_URL,{headers:{Authorization:'Bearer '+tokens.access_token}},active);
    if(identity.email_verified!==true||typeof identity.sub!=='string'||!identity.sub||typeof identity.email!=='string'||identity.email.toLowerCase()!==owner)
      throw fail('INQUIRY_OAUTH_OWNER','승인한 Google 계정이 지정한 문의 양식 소유자와 다릅니다. 연결은 저장하지 않았습니다.');
    const credentials=websiteInquiryCredentialInput({...client,refresh_token:tokens.refresh_token});
    const reader=createGoogleFormsInquiryReader({getCredentials:()=>credentials,fetchImpl});
    const result=await reader.verify({signal:active});active.throwIfAborted();
    if(installCredentials){
      let receipt;
      try{receipt=await installCredentials(Object.freeze(credentials),{signal:active});}
      catch{throw fail('INQUIRY_OAUTH_INSTALL','운영 서버 연결 저장 결과를 확인하지 못했습니다. 재시도 전에 서버 연결 상태를 확인해 주세요.');}
      if(receipt?.verified!==true||receipt?.installed!==true)throw fail('INQUIRY_OAUTH_INSTALL','운영 서버 연결 저장을 확인하지 못했습니다. 서버 연결 상태를 확인해 주세요.');
    }else{
      const store=new Store(directory);
      try{store.setSecret(WEBSITE_INQUIRY_SECRET,credentials);if(JSON.stringify(store.secret(WEBSITE_INQUIRY_SECRET))!==JSON.stringify(credentials))throw fail('INQUIRY_OAUTH_INSTALL','연결 저장을 확인하지 못했습니다.');}
      finally{store.close();}
    }
    return {verified:true,installed:true,ownerVerified:true,verifiedAt:result.verifiedAt,customerDataRead:false};
  }finally{
    active.removeEventListener('abort',abort);
    if(server.listening)await new Promise(done=>{server.close(done);server.closeAllConnections();});
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const usage='node website-inquiry-authorize.mjs --data-dir "<기존 회사 데이터 경로>" --owner "<확인된 소유자 이메일>" [--client-config "<기존 비공개 OAuth 파일>"] [--execute]';
  if(args.includes('--help'))process.stdout.write(usage+'\n기본은 준비 확인입니다. --execute를 붙였을 때만 Google 승인 주소를 만들고 검증 후 암호화해 저장합니다.\n');
  else try{
    const allowed=new Set(['--data-dir','--owner','--client-config','--execute']),values={};
    for(let i=0;i<args.length;i++){const key=args[i];if(!allowed.has(key)||Object.hasOwn(values,key))throw fail('INQUIRY_OAUTH_ARGUMENT','명령 인자를 확인해 주세요.');if(key==='--execute')values[key]=true;else{if(!args[i+1]||args[i+1].startsWith('--'))throw fail('INQUIRY_OAUTH_ARGUMENT','명령 인자를 확인해 주세요.');values[key]=args[++i];}}
    const result=await authorizeWebsiteInquiry({dataDir:values['--data-dir'],ownerEmail:values['--owner'],clientConfigPath:values['--client-config'],execute:values['--execute']===true,
      onAuthorizationUrl:url=>process.stdout.write('지정한 문의 양식 소유자 계정으로 아래 주소에서 승인해 주세요.\n'+url+'\n')});
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){process.stderr.write((error?.code?.startsWith('INQUIRY_OAUTH_')?error.message:'문의 Google 연결을 완료하지 못했습니다. 연결 상태를 확인해 주세요.')+'\n');process.exitCode=1;}
}
