import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {Store} from './store.mjs';
import {WEBSITE_INQUIRY_FORM_ID,WEBSITE_INQUIRY_SECRET} from './website-inquiry-google.mjs';
import {authorizeWebsiteInquiry,readWebsiteInquiryOAuthClient,WEBSITE_INQUIRY_AUTH_SCOPES} from './website-inquiry-authorize.mjs';

const ownerEmail='owner@example.test',sentinel={old:'preserve-until-verified'};
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'synk-inquiry-auth-')),dataDir=join(root,'company'),clientConfigPath=join(root,'oauth.json');
  const store=new Store(dataDir);store.setSecret(WEBSITE_INQUIRY_SECRET,sentinel);store.close();
  const credentials={client_id:'synthetic.apps.googleusercontent.com',client_secret:'synthetic-client-secret',refresh_token:'original-refresh-must-not-be-reused',access_token:'original-access-must-not-be-reused'};
  await writeFile(clientConfigPath,JSON.stringify({tokens:{default:credentials}}),{mode:0o600});
  const original=await readFile(clientConfigPath);
  t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));await rm(root,{recursive:true,force:true});});
  const calls=[],json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
  let behavior={};
  const fetchImpl=async(url,options)=>{
    const href=String(url);calls.push({url:href,options});
    assert.equal(options.redirect,'error');assert.ok(options.signal);
    if(href==='https://oauth2.googleapis.com/token'){
      const grant=options.body.get('grant_type');
      if(grant==='authorization_code'){
        assert.equal(options.body.get('code'),'synthetic-authorized-code');
        await behavior.onToken?.();
        if(behavior.providerError)return new Response(JSON.stringify({error_description:'PRIVATE_TOKEN_DO_NOT_PRINT'}),{status:400});
        return json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',token_type:'Bearer',scope:behavior.scopes??WEBSITE_INQUIRY_AUTH_SCOPES.join(' ')});
      }
      assert.equal(grant,'refresh_token');assert.equal(options.body.get('refresh_token'),'synthetic-refresh');
      return json({access_token:'synthetic-refreshed-access',expires_in:3600});
    }
    if(href==='https://openidconnect.googleapis.com/v1/userinfo'){
      assert.equal(options.headers.Authorization,'Bearer synthetic-access');
      return json({sub:'synthetic-owner-sub',email:behavior.email??ownerEmail,email_verified:behavior.verified??true});
    }
    const parsed=new URL(href);
    assert.equal(parsed.origin,'https://forms.googleapis.com');assert.ok(parsed.pathname.startsWith('/v1/forms/'+WEBSITE_INQUIRY_FORM_ID));
    if(behavior.formDenied)return new Response('{}',{status:403});
    if(parsed.pathname.endsWith('/responses')){
      assert.equal(parsed.searchParams.get('fields'),'responses(responseId),nextPageToken');
      return json({responses:[]});
    }
    return json({formId:WEBSITE_INQUIRY_FORM_ID,settings:{emailCollectionType:'RESPONDER_INPUT'},items:['문의 유형','문의 내용','개인정보 수집·이용 동의'].map((title,index)=>({title,questionItem:{question:{questionId:'q'+index}}}))});
  };
  async function onAuthorizationUrl(value){
    const url=new URL(value),callback=new URL(url.searchParams.get('redirect_uri'));callback.search=new URLSearchParams({code:'synthetic-authorized-code',state:url.searchParams.get('state')}).toString();
    await behavior.onAuthorize?.(url,callback);
    if(behavior.noCallback)return;
    const response=await fetch(callback);assert.equal(response.status,200);await response.text();
  }
  function secret(){const store=new Store(dataDir);try{return store.secret(WEBSITE_INQUIRY_SECRET);}finally{store.close();}}
  return {root,dataDir,clientConfigPath,original,calls,secret,behavior,run:options=>authorizeWebsiteInquiry({dataDir,ownerEmail,clientConfigPath,fetchImpl,onAuthorizationUrl,...options})};
}

test('default consent plan reads only client metadata and never opens a listener, calls Google or writes a secret',async t=>{
  const f=await fixture(t),client=await readWebsiteInquiryOAuthClient(f.clientConfigPath);
  assert.deepEqual(Object.keys(client).sort(),['client_id','client_secret']);
  const result=await f.run();assert.equal(result.consentStarted,false);assert.equal(result.installed,false);assert.equal(f.calls.length,0);
  assert.deepEqual(f.secret(),sentinel);assert.deepEqual(await readFile(f.clientConfigPath),f.original);
});

test('consent uses narrow scopes, exact owner hint, PKCE and one loopback callback then verifies before encrypted installation',async t=>{
  const f=await fixture(t);let auth;
  f.behavior.onAuthorize=url=>{auth=url;assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('login_hint'),ownerEmail);
    assert.equal(url.searchParams.get('include_granted_scopes'),'false');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    assert.deepEqual(new Set(url.searchParams.get('scope').split(' ')),new Set(WEBSITE_INQUIRY_AUTH_SCOPES));const callback=new URL(url.searchParams.get('redirect_uri'));
    assert.equal(callback.hostname,'127.0.0.1');assert.equal(callback.pathname,'/');assert.equal(url.searchParams.get('redirect_uri'),callback.origin);};
  const result=await f.run({execute:true});
  assert.equal(result.installed,true);assert.equal(result.ownerVerified,true);assert.equal(result.customerDataRead,false);
  const exchange=f.calls[0].options.body,verifier=exchange.get('code_verifier');
  assert.match(verifier,/^[\w-]{43,128}$/);assert.equal(auth.searchParams.get('code_challenge'),createHash('sha256').update(verifier).digest('base64url'));
  assert.equal(exchange.get('redirect_uri'),auth.searchParams.get('redirect_uri'));
  assert.equal(f.secret().refresh_token,'synthetic-refresh');assert.deepEqual(await readFile(f.clientConfigPath),f.original);
  assert.doesNotMatch(JSON.stringify(result),/synthetic-access|synthetic-refresh|client_secret|owner@example/);
  assert.deepEqual((await readdir(f.root)).sort(),['company','oauth.json']);
  assert.equal((await readFile(join(f.dataDir,'company.sqlite'))).includes(Buffer.from('synthetic-refresh')),false);
});

test('wrong state, path, host, method and duplicated callback parameters cannot consume the valid approval',async t=>{
  const f=await fixture(t);
  f.behavior.onAuthorize=async(auth,callback)=>{
    for(const variant of ['state','path','host','method','duplicate']){
      const bad=new URL(callback),options={};
      if(variant==='state')bad.searchParams.set('state','wrong');
      if(variant==='path')bad.pathname='/other';
      if(variant==='host')options.headers={Host:'attacker.example.test'};
      if(variant==='method')options.method='POST';
      if(variant==='duplicate')bad.searchParams.append('code','another');
      if(variant==='host'){
        const status=await new Promise((done,reject)=>{const request=httpRequest(bad,options,response=>{response.resume();response.on('end',()=>done(response.statusCode));});request.on('error',reject);request.end();});
        assert.equal(status,400,variant);
      }else{const response=await fetch(bad,options);assert.equal(response.status,400,variant);await response.text();}
      assert.equal(f.calls.length,0);
    }
  };
  assert.equal((await f.run({execute:true})).installed,true);
});

for(const [name,behavior,code]of [
  ['wrong account',{email:'other@example.test'},'INQUIRY_OAUTH_OWNER'],
  ['unverified identity',{verified:false},'INQUIRY_OAUTH_OWNER'],
  ['missing read scope',{scopes:'openid email'},'INQUIRY_OAUTH_SCOPE'],
  ['extra broad scope',{scopes:WEBSITE_INQUIRY_AUTH_SCOPES.join(' ')+' https://www.googleapis.com/auth/cloud-platform'},'INQUIRY_OAUTH_SCOPE'],
  ['provider diagnostic',{providerError:true},'INQUIRY_OAUTH_RESPONSE'],
  ['form access denied',{formDenied:true},'FORMS_AUTH_REQUIRED'],
])test(`${name} preserves the previous secret and emits only a safe error`,async t=>{
  const f=await fixture(t);Object.assign(f.behavior,behavior);
  await assert.rejects(f.run({execute:true}),error=>{assert.equal(error.code,code);assert.doesNotMatch(error.message,/PRIVATE|synthetic-access|synthetic-refresh|other@example/);return true;});
  assert.deepEqual(f.secret(),sentinel);assert.deepEqual(await readFile(f.clientConfigPath),f.original);
});

test('an explicit consent denial terminates without token exchange or installation',async t=>{
  const f=await fixture(t);f.behavior.noCallback=true;
  f.behavior.onAuthorize=async(auth,callback)=>{callback.searchParams.delete('code');callback.searchParams.set('error','access_denied');const response=await fetch(callback);assert.equal(response.status,400);await response.text();};
  await assert.rejects(f.run({execute:true}),{code:'INQUIRY_OAUTH_DENIED'});assert.equal(f.calls.length,0);assert.deepEqual(f.secret(),sentinel);
});

test('an accepted callback is single-use while owner and permissions are still being checked',async t=>{
  const f=await fixture(t);f.behavior.noCallback=true;
  f.behavior.onAuthorize=async(auth,callback)=>{
    const first=await fetch(callback);assert.equal(first.status,200);await first.text();
    const replay=await fetch(callback);assert.equal(replay.status,400);await replay.text();
  };
  assert.equal((await f.run({execute:true})).installed,true);
  assert.equal(f.calls.filter(call=>call.url==='https://oauth2.googleapis.com/token'&&call.options.body.get('grant_type')==='authorization_code').length,1);
});

test('Google canonical email scope is accepted without permitting unrelated identity profile access',async t=>{
  const f=await fixture(t);f.behavior.scopes=WEBSITE_INQUIRY_AUTH_SCOPES.map(scope=>scope==='email'?'https://www.googleapis.com/auth/userinfo.email':scope).join(' ');
  assert.equal((await f.run({execute:true})).installed,true);
});

test('timeout and cancellation close the callback server without installing credentials',async t=>{
  for(const mode of ['timeout','cancel']){
    const f=await fixture(t),controller=new AbortController();let callback;
    f.behavior.noCallback=true;f.behavior.onAuthorize=async(auth,url)=>{callback=url;if(mode==='cancel')controller.abort();};
    await assert.rejects(f.run({execute:true,signal:controller.signal,timeoutMs:mode==='timeout'?30:1000}),{code:'INQUIRY_OAUTH_CANCELLED'});
    await assert.rejects(fetch(callback));assert.equal(f.calls.length,0);assert.deepEqual(f.secret(),sentinel);
  }
});

test('cancellation while checking the owner cannot install an already returned token',async t=>{
  const f=await fixture(t),controller=new AbortController();f.behavior.onToken=()=>controller.abort();
  await assert.rejects(f.run({execute:true,signal:controller.signal}));assert.deepEqual(f.secret(),sentinel);
  assert.equal(f.calls.length,1);
});

test('external installation needs no company DB on the consenting PC and passes only memory credentials after verification',async t=>{
  const f=await fixture(t);let installs=0;
  const installCredentials=async(credentials,{signal})=>{
    installs++;assert.equal(signal.aborted,false);assert.equal(Object.isFrozen(credentials),true);
    assert.deepEqual(Object.keys(credentials).sort(),['client_id','client_secret','refresh_token']);
    assert.equal(credentials.refresh_token,'synthetic-refresh');
    assert.ok(f.calls.some(call=>call.url.includes('/responses')));
    return {verified:true,installed:true};
  };
  const plan=await f.run({dataDir:undefined,installCredentials});assert.equal(plan.destination,'external');assert.equal(installs,0);
  assert.equal((await f.run({dataDir:undefined,installCredentials,execute:true})).installed,true);assert.equal(installs,1);
  assert.deepEqual(f.secret(),sentinel);assert.deepEqual(await readFile(f.clientConfigPath),f.original);
});

test('exactly one installation destination is required before consent',async t=>{
  const f=await fixture(t);
  for(const options of [{dataDir:undefined},{installCredentials:async()=>({})},{dataDir:undefined,installCredentials:true}])
    await assert.rejects(f.run(options),{code:'INQUIRY_OAUTH_DATA'});
  assert.equal(f.calls.length,0);
});

test('external failures and ambiguous receipts never claim installation or echo sink diagnostics',async t=>{
  const f=await fixture(t);
  for(const installCredentials of [async()=>{throw Error('PRIVATE_REMOTE_TOKEN');},async()=>({installed:true})])
    await assert.rejects(f.run({dataDir:undefined,installCredentials,execute:true}),error=>{assert.equal(error.code,'INQUIRY_OAUTH_INSTALL');assert.doesNotMatch(error.message,/PRIVATE|바꾸지 않았/);return true;});
  assert.deepEqual(f.secret(),sentinel);
});

test('profile aliases and unrelated API permissions remain outside the requested identity contract',async t=>{
  const f=await fixture(t);
  for(const extra of ['profile','https://www.googleapis.com/auth/userinfo.profile']){
    f.behavior.scopes=WEBSITE_INQUIRY_AUTH_SCOPES.join(' ')+' '+extra;
    await assert.rejects(f.run({execute:true}),{code:'INQUIRY_OAUTH_SCOPE'});
  }
  assert.deepEqual(f.secret(),sentinel);
});
