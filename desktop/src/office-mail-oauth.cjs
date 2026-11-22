'use strict';
const http=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {fail,grantText,addressValid,current,jsonRequest,bearer}=require('./office-mail-http.cjs');
const gmailScope='https://www.googleapis.com/auth/gmail.readonly';
const endpoints=Object.freeze({
  gmail:{auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'openid email '+gmailScope,host:'127.0.0.1'},
  outlook:{auth:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',scope:'offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read',host:'localhost'}
});
function checkedScopes(provider,scope) {
  if(typeof scope!=='string')throw fail('MAIL_SCOPE');
  const granted=new Set(scope.trim().split(/\s+/).map(s=>provider==='outlook'?s.toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//,''):s));
  if(provider==='gmail'){
    const email='https://www.googleapis.com/auth/userinfo.email';
    if(!granted.has(gmailScope)||!granted.has('openid')||(!granted.has('email')&&!granted.has(email))||
      [...granted].some(s=>![gmailScope,'openid','email',email].includes(s)))throw fail('MAIL_SCOPE');
  } else if(!granted.has('mail.read')||!granted.has('user.read')||
    [...granted].some(s=>!['user.read','mail.read','offline_access','openid','email','profile'].includes(s)))throw fail('MAIL_SCOPE');
}
function equal(a,b) {
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
}
async function browserCode({provider,client,open,signal,timeoutMs=180000}) {
  const config=endpoints[provider];
  const verifier=randomBytes(48).toString('base64url'),state=randomBytes(32).toString('base64url');
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  let redirect,settled=false,timer,finish;
  const outcome=new Promise(resolve=>{finish=value=>{if(!settled){settled=true;resolve(value);}};});
  const aborted=()=>finish({error:'MAIL_CANCELLED'});
  const server=http.createServer({maxHeaderSize:8192},(req,res)=>{
    res.setHeader('Connection','close');res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    const reject=()=>{res.statusCode=400;res.end('이 요청으로 연결할 수 없습니다.');};
    if(settled||!redirect||req.method!=='GET'||req.headers.host!==redirect.host||!req.url?.startsWith('/?')||req.url.length>8192)return reject();
    const url=new URL(req.url,redirect);
    if(url.origin!==redirect.origin || url.pathname!=='/' || url.searchParams.getAll('state').length!==1 || !equal(url.searchParams.get('state'),state))return reject();
    const codes=url.searchParams.getAll('code'),errors=url.searchParams.getAll('error');
    if(errors.length===1&&!codes.length){
      res.end('메일 연결을 마치지 않았습니다. 솔리오로 돌아가 주세요.');
      finish({error:errors[0]==='access_denied'?'MAIL_CANCELLED':'MAIL_CONFIG'});return;
    }
    if(errors.length||codes.length!==1||!grantText(codes[0]))return reject();
    res.end('솔리오가 메일 연결을 확인하고 있습니다. 사무실로 돌아가 주세요.');finish({code:codes[0]});
  });
  server.requestTimeout=6000;server.headersTimeout=6000;
  try {
    current(signal);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:0,exclusive:true},resolve);});
    redirect=new URL('http://'+config.host+':'+server.address().port+'/');
    current(signal);
    signal?.addEventListener('abort',aborted,{once:true});
    timer=setTimeout(()=>finish({error:'MAIL_TIMEOUT'}),timeoutMs);
    const auth=new URL(config.auth);
    auth.search=new URLSearchParams({client_id:client.id,response_type:'code',redirect_uri:redirect.href,scope:config.scope,state,code_challenge:challenge,code_challenge_method:'S256',prompt:provider==='gmail'?'consent select_account':'select_account'});
    if(provider==='gmail')auth.searchParams.set('access_type','offline');
    void Promise.resolve().then(()=>open(auth.href)).catch(()=>finish({error:'MAIL_NETWORK'}));
    const result=await outcome;if(result.error)throw fail(result.error);
    return {code:result.code,verifier,redirect:redirect.href};
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',aborted);
    server.close();server.closeAllConnections();
  }
}
async function tokens({provider,client,fields,fetch,signal,previousScope}) {
  const params=new URLSearchParams({...fields,client_id:client.id});
  if(provider==='gmail'&&client.secret)params.set('client_secret',client.secret);
  if(provider==='outlook')params.set('scope',endpoints.outlook.scope);
  const data=await jsonRequest(fetch,endpoints[provider].token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params},signal);
  // An omitted scope in a successful OAuth response means it is identical to the requested scope.
  const scope=data.scope??previousScope??endpoints[provider].scope;
  checkedScopes(provider,scope);
  if(!grantText(data.access_token) || !/^bearer$/i.test(data.token_type||'') || (data.refresh_token!=null&&!grantText(data.refresh_token)))throw fail('MAIL_RECONNECT');
  return {access:data.access_token,refreshToken:data.refresh_token,scope};
}
async function profile(provider,access,fetch,signal) {
  const url=provider==='gmail'?'https://gmail.googleapis.com/gmail/v1/users/me/profile':'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName';
  const data=await jsonRequest(fetch,url,{headers:bearer(access)},signal);
  const address=provider==='gmail'?data.emailAddress:data.mail||data.userPrincipalName;
  let subject=data.id;
  if(provider==='gmail'){
    const info=await jsonRequest(fetch,'https://openidconnect.googleapis.com/v1/userinfo',{headers:bearer(access)},signal);
    if(info.email_verified!==true||!addressValid(info.email)||info.email.toLowerCase()!==address?.toLowerCase())throw fail('MAIL_CHANGED');
    subject=info.sub;
  }
  if(!addressValid(address)||typeof subject!=='string'||!subject.trim()||subject.length>320)throw fail('MAIL_RECONNECT');
  return {address,subject};
}
async function authorize({provider,client,open,fetch=globalThis.fetch,signal,timeoutMs}) {
  if(!endpoints[provider]||!client?.id)throw fail('MAIL_CONFIG');
  const {code,verifier,redirect}=await browserCode({provider,client,open,signal,timeoutMs});
  const data=await tokens({provider,client,fields:{grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirect},fetch,signal});
  if(!data.refreshToken)throw fail('MAIL_RECONNECT');
  const identity=await profile(provider,data.access,fetch,signal);
  if(provider==='outlook'){
    try{
      const inbox=await jsonRequest(fetch,'https://graph.microsoft.com/v1.0/me/mailFolders/inbox?$select=id',{headers:bearer(data.access)},signal);
      if(typeof inbox.id!=='string'||!inbox.id)throw fail('MAIL_NO_MAILBOX');
    }catch(e){if(e.code==='MAIL_NOT_FOUND')throw fail('MAIL_NO_MAILBOX');throw e;}
  }
  return {...identity,refreshToken:data.refreshToken,scope:data.scope};
}
async function refreshGrant({provider,client,grant,fetch=globalThis.fetch,signal}) {
  const data=await tokens({provider,client,fields:{grant_type:'refresh_token',refresh_token:grant.refreshToken},fetch,signal,previousScope:grant.scope});
  const identity=await profile(provider,data.access,fetch,signal);
  if(identity.subject!==grant.subject || identity.address.toLowerCase()!==grant.address.toLowerCase())throw fail('MAIL_CHANGED');
  return {...data,refreshToken:data.refreshToken||grant.refreshToken};
}
module.exports={authorize,refreshGrant,checkedScopes};
