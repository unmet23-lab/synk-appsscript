'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const { fault } = require('./estimate-domain.cjs');
const { SCOPE } = require('./estimate-gmail.cjs');

const services = Object.freeze({
  gmail: { authorize:'https://accounts.google.com/o/oauth2/v2/auth', token:'https://oauth2.googleapis.com/token', scope:SCOPE },
  outlook: { authorize:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token:'https://login.microsoftonline.com/common/oauth2/v2.0/token', scope:'offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read' },
});

async function readClientConfig({ filename }) {
  if (!filename) return {};
  try {
    const stat=await fs.stat(filename);
    if (!stat.isFile()||stat.size>32768) return {};
    const data=JSON.parse(await fs.readFile(filename,'utf8')), config={};
    if (/^[\w.-]{8,255}\.apps\.googleusercontent\.com$/.test(data.gmail?.clientId) &&
      typeof data.gmail?.clientSecret==='string' && data.gmail.clientSecret.length>0 && data.gmail.clientSecret.length<=1024) {
      config.gmail={clientId:data.gmail.clientId,clientSecret:data.gmail.clientSecret};
    }
    if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(data.outlook?.clientId)) config.outlook={clientId:data.outlook.clientId};
    return config;
  } catch(error){ if(error.code==='ENOENT') return {}; throw fault('CONFIG','업무 메일 연결 설정을 읽지 못했어요.'); }
}

function configPath(env=process.env, platform=process.platform, userData='') {
  return env.SYNK_ESTIMATE_MAIL_CONFIG || (platform==='win32' && env.LOCALAPPDATA
    ? path.join(env.LOCALAPPDATA,'synk','estimate','mail-clients.json') : path.join(userData,'estimate','mail-clients.json'));
}
async function tokenRequest(provider,client,body,fetcher=fetch,signal) {
  if (!client?.clientId || !Object.hasOwn(services,provider)) throw fault('CONFIG','메일 서비스 연결 설정이 필요해요.');
  const fields=new URLSearchParams({...body,client_id:client.clientId});
  if (provider==='gmail') fields.set('client_secret',client.clientSecret);
  if (provider==='outlook'&&body.grant_type==='refresh_token') fields.set('scope',services.outlook.scope);
  const timeout=AbortSignal.timeout(30000);
  const response=await fetcher(services[provider].token,{method:'POST',redirect:'error',body:fields,
    signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok) throw fault('MAIL_AUTH','메일 읽기 동의를 다시 확인해 주세요.');
  const out=await response.json();
  if(typeof out.access_token!=='string'||out.access_token.length>32768||!out.access_token) throw fault('MAIL_AUTH','메일 서비스가 연결을 확인하지 못했어요.');
  if(out.scope) {
    const scopes=String(out.scope).toLowerCase().split(/\s+/);
    const allowed=provider==='gmail' ? scopes.includes(SCOPE.toLowerCase()) : scopes.some(s=>s==='mail.read'||s==='https://graph.microsoft.com/mail.read');
    if(!allowed) throw fault('MAIL_AUTH','메일 읽기 권한이 필요해요.');
  }
  if(out.refresh_token!=null && (typeof out.refresh_token!=='string'||out.refresh_token.length>32768)) throw fault('MAIL_AUTH','메일 연결 정보를 확인하지 못했어요.');
  return {accessToken:out.access_token,refresh:out.refresh_token||null,expiresAt:Date.now()+Math.max(1,Number(out.expires_in)||3600)*1000};
}
async function authorize({provider,client,openExternal,fetcher=fetch,signal}) {
  const spec=services[provider];
  if (!spec || !client?.clientId) throw fault('CONFIG','이 메일 서비스의 앱 연결 설정이 필요해요.');
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  let receive, fail;
  const codePromise=new Promise((resolve,reject)=>{receive=resolve;fail=reject;});
  codePromise.catch(()=>{});
  let redirect;
  const server=http.createServer((req,res)=>{
    const finish=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'","Referrer-Policy":"no-referrer"});res.end(text);};
    if(!redirect||req.method!=='GET'||req.headers.host!==new URL(redirect).host){finish(400,'요청을 확인해 주세요.');return;}
    let url; try {url=new URL(req.url,redirect);} catch {finish(400,'요청을 확인해 주세요.');return;}
    const value=url.searchParams.get('state')||'';
    if(url.origin!==new URL(redirect).origin||url.pathname!==new URL(redirect).pathname||Buffer.byteLength(value)!==Buffer.byteLength(state)||
      !timingSafeEqual(Buffer.from(value),Buffer.from(state))){finish(400,'연결 요청을 확인하지 못했어요.');return;}
    const code=url.searchParams.get('code');
    if(!code||code.length>8192){finish(200,'솔리오로 돌아가 주세요.'); fail(fault('CANCELLED','메일 연결을 마치지 않았어요.'));return;}
    finish(200,'메일 연결 요청을 받았어요. 솔리오로 돌아가 주세요.');receive(code);
  });
  const cancel=()=>fail(fault('CANCELLED','메일 연결이 중단됐어요.'));
  const timer=setTimeout(cancel,300000);timer.unref();
  try {
    signal?.throwIfAborted(); signal?.addEventListener('abort',cancel,{once:true});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:0,exclusive:true},resolve);});
    // Entra ignores ephemeral ports for registered localhost redirects. Google uses the loopback IP.
    redirect=provider==='outlook' ? 'http://localhost:'+server.address().port+'/estimate/callback'
      : 'http://127.0.0.1:'+server.address().port+'/';
    const login=new URL(spec.authorize);
    login.search=new URLSearchParams({client_id:client.clientId,redirect_uri:redirect,response_type:'code',scope:spec.scope,
      state,code_challenge:challenge,code_challenge_method:'S256',...(provider==='gmail'?{access_type:'offline',prompt:'consent select_account'}:{prompt:'select_account'})});
    await openExternal(login.href);
    const code=await codePromise;
    const tokens=await tokenRequest(provider,client,{grant_type:'authorization_code',redirect_uri:redirect,code,code_verifier:verifier},fetcher,signal);
    if(!tokens.refresh)throw fault('MAIL_AUTH','메일 서비스가 다음 검사에 필요한 연결을 허용하지 않았어요.');
    return tokens;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);server.closeAllConnections?.();if(server.listening)server.close();}
}
module.exports={readClientConfig,configPath,tokenRequest,authorize};
