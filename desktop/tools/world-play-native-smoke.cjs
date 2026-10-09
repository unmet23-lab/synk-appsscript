'use strict';
// Runs only the selected frozen WORLD candidate with a loopback synthetic
// provider. No production credentials, real profile, account or process access.
const {app,BrowserWindow,ipcMain,safeStorage,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const candidate=path.resolve(process.argv.find(x=>x.startsWith('--candidate='))?.slice(12)||'');
const packaged=process.argv.includes('--packaged');
if(!path.basename(candidate).startsWith('world-play-candidate-')||!fs.existsSync(path.join(candidate,'candidate-summary.json')))throw Error('FROZEN_WORLD_CANDIDATE_REQUIRED');
const summary=JSON.parse(fs.readFileSync(path.join(candidate,'candidate-summary.json')));
const sourceRoot=packaged?path.join(candidate,'dist/preview/win32/x64/world/win-unpacked/resources/app.asar'):candidate;
const {configuration}=require(path.join(sourceRoot,'src/auth-config.cjs'));
const {createAuthService,publicError}=require(path.join(sourceRoot,'src/auth-service.cjs'));
const {createTokenStore}=require(path.join(sourceRoot,'src/auth-store.cjs'));
const {preferences,assertSender,contentSecurityPolicy}=require(path.join(sourceRoot,'src/security.cjs'));
const runId=Date.now()+'-'+process.pid,out=path.join(candidate,'artifacts','native-play-'+(packaged?'asar-':'source-')+runId);
fs.mkdirSync(out,{recursive:true});
app.enableSandbox();app.setPath('appData',path.join(out,'isolated-appdata'));app.setPath('userData',path.join(out,'isolated-appdata','world-play-qa'));app.setPath('sessionData',path.join(out,'isolated-session'));
app.on('window-all-closed',()=>{});
const checks=[],errors=[],requests=[];let provider,window,auth,config,store,entry,serial=0,owner='synthetic-account-a',revision=0,refreshCount=0,playQueue=[],wallet={coins:80,owned:[]},records={};
const codes=new Map(),tokens=new Map(),refreshes=new Map();
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(fn,label){for(let i=0;i<200;i++){if(await fn())return;await pause(25);}throw Error('TIMEOUT_'+label);}
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
async function close(server){if(!server)return;server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
const run=code=>window.webContents.executeJavaScript(code,true);
const request=(operation,params={})=>run('window.synkDesktop.accountRequest('+JSON.stringify(operation)+','+JSON.stringify(params)+')');
const state=()=>({ok:true,scope:'synk-play',accountId:owner,revision,state:{wallet,records},nested:{access_token:'synthetic-redact',refresh_token:'synthetic-redact'}});
const makeAuth=()=>createAuthService({config,store,appVersion:'0.4.0',timeoutMs:2000,openExternal:async url=>{const u=new URL(url);if(u.hostname!=='127.0.0.1')throw Error('NON_LOOPBACK_AUTH');const response=await fetch(url);check('real loopback PKCE callback '+serial,response.status===200);}});
async function login(){await run('window.synkDesktop.authSignIn()');await waitFor(()=>auth.status().signedIn,'LOGIN');}
const deadline=setTimeout(()=>{errors.push('GLOBAL_TIMEOUT');finish(false);},45000);
let finishing=false;
async function finish(ok){if(finishing)return;finishing=true;clearTimeout(deadline);auth?.dispose();window?.destroy();await close(provider);const report={checkedAt:new Date().toISOString(),ok:ok&&errors.length===0,candidate,sourceHash:summary.sourceHash,packagedModules:packaged,electron:process.versions.electron,checks,errors,requests:requests.map(x=>({path:x.path,method:x.method,product:x.product})),limitations:{provider:'synthetic loopback HTTP',wallet:'synthetic protocol fixture; not database validation',realNativeAuth:true,realDPAPI:true,realPreloadIPC:true,mainEntryProcess:false,productionLogin:false,physicalDevices:false,normalProfileRead:false,installerExecuted:false}};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,passed:checks.filter(x=>x.ok).length,report:path.join(out,'result.json'),errors}));app.exit(report.ok?0:1);}
app.whenReady().then(async()=>{try{
  const probe=http.createServer(),callbackPort=await listen(probe);await close(probe);
  provider=http.createServer(async(req,res)=>{try{
    const u=new URL(req.url,'http://127.0.0.1'),chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString();
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    if(u.pathname==='/synk-account/client.html'||u.pathname==='/child.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><head><title>WORLD native synthetic QA</title></head><body>합성 WORLD 계정 검사</body></html>');return;}
    if(u.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(u.pathname==='/auth/v1/oauth/authorize'){
      const code=crypto.randomUUID();codes.set(code,Object.fromEntries(u.searchParams));const target=new URL(u.searchParams.get('redirect_uri'));target.search=new URLSearchParams({code,state:u.searchParams.get('state')});res.writeHead(302,{Location:target.href});res.end();return;
    }
    if(u.pathname==='/auth/v1/oauth/token'){
      const form=new URLSearchParams(body),client=form.get('client_id');
      if(form.get('grant_type')==='authorization_code'){const saved=codes.get(form.get('code'));if(!saved||saved.client_id!==client||saved.redirect_uri!==form.get('redirect_uri')||saved.code_challenge!==crypto.createHash('sha256').update(form.get('code_verifier')).digest('base64url'))return reply(400,{error:'invalid_grant'});codes.delete(form.get('code'));}
      else{if(refreshes.get(form.get('refresh_token'))!==owner)return reply(400,{error:'invalid_grant'});refreshes.delete(form.get('refresh_token'));refreshCount++;}
      serial++;const access='synthetic-access-'+serial,refresh='synthetic-refresh-'+serial;tokens.set(access,owner);refreshes.set(refresh,owner);return reply(200,{token_type:'bearer',access_token:access,refresh_token:refresh,expires_in:3600});
    }
    const token=req.headers.authorization?.replace(/^Bearer /,'');
    if(!tokens.has(token))return reply(401,{ok:false,error:{code:'AUTH_REQUIRED'}});
    if(u.pathname==='/auth/v1/user')return reply(200,{id:'synthetic-auth-user'});
    if(u.pathname==='/auth/v1/logout'){tokens.delete(token);res.writeHead(204);res.end();return;}
    if(u.pathname==='/functions/v1/synk-account'){
      if(body&&JSON.parse(body).action==='revoke-session')return reply(200,{ok:true,current:true});
      return reply(200,{ok:true,account:{synk_user_id:owner,status:'active',profile:{display_name:'합성 계정'}},memberships:[],entitlements:[],sessions:[{id:'00000000-0000-4000-8000-000000000001',current:true,revoked:false}]});
    }
    if(u.pathname==='/functions/v1/synk-play'){
      requests.push({path:u.pathname,method:req.method,product:req.headers['x-synk-product']});
      const queued=playQueue.shift();if(queued){await queued.wait;if(queued.disconnect){res.destroy();return;}if(queued.raw){res.writeHead(queued.status||503,{'Content-Type':'text/html'});res.end(queued.raw);return;}return reply(queued.status||200,queued.data||state());}
      if(body){const command=JSON.parse(body);if(command.action==='wallet'){wallet={coins:60,owned:['magic-toys-picnic']};}else if(command.action==='progress'){for(const change of command.changes)records[change.key]=change.value;}revision++;}
      return reply(200,state());
    }
    reply(404,{ok:false});
  }catch(error){errors.push('SYNTHETIC_SERVER_'+error.message);if(!res.headersSent){res.writeHead(500);res.end('{}');}}});
  const base='http://127.0.0.1:'+await listen(provider);entry=base+'/synk-account/client.html?product=world';
  config=configuration({version:1,supabaseUrl:base,accountApiUrl:base,supabasePublishableKey:'sb_publishable_synthetic',clients:{world:{clientId:'synthetic-world',redirectUri:'http://127.0.0.1:'+callbackPort+'/synk/oauth/world/callback'}}},'world','development');
  check('WORLD route key derived from existing public auth identity',config.clientKey==='world');
  store=createTokenStore({directory:path.join(out,'synthetic-vault'),safeStorage,scope:'synthetic-world-play',configFingerprint:config.fingerprint});check('Windows DPAPI available',store.available());auth=makeAuth();await auth.initialize();
  const partition='persist:world-play-qa-'+runId,ses=session.fromPartition(partition);let deniedNetwork=0;
  ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{const allowed=new URL(details.url).origin===base;if(!allowed)deniedNetwork++;callback({cancel:!allowed});});
  ses.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[contentSecurityPolicy(details.resourceType)]}}));
  window=new BrowserWindow({show:false,width:900,height:700,webPreferences:{...preferences(path.join(sourceRoot,'src/preload.cjs'),partition),backgroundThrottling:false}});
  window.webContents.on('render-process-gone',()=>errors.push('RENDER_PROCESS_GONE'));
  window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  for(const [name,handler]of Object.entries({'synk:auth-status':()=>auth.status(),'synk:auth-sign-in':()=>auth.signIn(),'synk:auth-sign-out':()=>auth.signOut(),'synk:account-request':(operation,params)=>auth.accountRequest(operation,params)}))ipcMain.handle(name,async(event,...args)=>{assertSender(event,window,entry,'world');try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}});
  await window.loadURL(entry);
  check('isolated hidden sandboxed renderer',!window.isVisible()&&await run("typeof require==='undefined'&&typeof window.synkDesktop==='object'")&&app.getPath('userData').startsWith(out+path.sep));
  check('initial signed-out state',!(await run('window.synkDesktop.authStatus()')).signedIn);
  await login();check('PKCE verified native identity',(await run('window.synkDesktop.authStatus()')).signedIn);
  const loaded=await request('playLoad');check('native GET wallet uses WORLD contract',loaded.ok&&loaded.scope==='synk-play'&&loaded.state.wallet.coins===80&&requests.at(-1).product==='world');
  check('native renderer receives no token fields',Object.keys(loaded.nested).length===0&&!JSON.stringify(await run('window.synkDesktop.authStatus()')).includes('synthetic-access'));
  const id='00000000-0000-4000-8000-000000000010';
  const bought=await request('playMutate',{action:'wallet',id,method:'buyItem',args:['magic-toys-picnic']});check('fixed native wallet command reaches protocol fixture',bought.ok&&bought.state.wallet.coins===60&&bought.state.wallet.owned.includes('magic-toys-picnic'));
  const progress=await request('playMutate',{action:'progress',id,changes:[{key:'synk.word-magic.progress.v1',previous:null,value:'{"level":2}'}]});check('fixed native progress reaches protocol fixture',progress.ok&&progress.state.records['synk.word-magic.progress.v1']==='{"level":2}');
  check('renderer cannot override owner or URL',(await request('playLoad',{url:'https://invalid.example'})).error.code==='INVALID_REQUEST'&&(await request('playMutate',{action:'wallet',id,method:'save',args:[{coins:999}]})).error.code==='INVALID_REQUEST');
  auth.dispose();auth=makeAuth();await auth.initialize();const restored=await request('playLoad');check('real DPAPI vault restores native session and account state',auth.status().signedIn&&refreshCount===1&&restored.state.wallet.coins===60);
  playQueue.push({status:401,data:{ok:false,error:{code:'AUTH_REQUIRED'}}});check('401 refresh retries with newly verified native session',(await request('playLoad')).ok&&refreshCount===2);
  for(const status of [429,500,502,503,504])for(const format of ['gateway-json','html']){playQueue.push(format==='html'?{status,raw:'<html>temporary gateway failure</html>'}:{status,data:{code:'BOOT_ERROR',message:'worker unavailable'}});const failure=await request('playLoad');check('gateway '+status+' '+format+' stays retryable without logout',failure.error.code==='SERVICE_UNAVAILABLE'&&failure.error.retryable===true&&auth.status().signedIn);}
  check('native play recovers after gateway outage',(await request('playLoad')).ok);
  playQueue.push({status:403,data:{ok:false,error:{code:'ACCOUNT_UNAVAILABLE'}}});const inactive=await request('playLoad');check('explicit inactive account code remains terminal contract',inactive.error.code==='ACCOUNT_UNAVAILABLE'&&inactive.error.retryable===false);
  playQueue.push({status:409,data:{ok:false,error:{code:'REVISION_CONFLICT'},revision:9}});const conflict=await request('playLoad');check('revision conflict crosses native bridge intact',conflict.error.code==='REVISION_CONFLICT'&&conflict.revision===9);
  playQueue.push({disconnect:true});check('temporary network failure preserves login',(await request('playLoad')).error.code==='NETWORK'&&auth.status().signedIn);check('native read recovers after temporary failure',(await request('playLoad')).ok);
  let release;const before=requests.length;playQueue.push({wait:new Promise(resolve=>{release=resolve;}),data:state()});const pending=request('playLoad');await waitFor(()=>requests.length>before,'PENDING_PLAY');await run('window.synkDesktop.authSignOut()');release();check('logout fences a delayed play reply',!(await pending).ok&&!auth.status().signedIn);
  await login();playQueue.push({data:{...state(),accountId:'synthetic-account-b'}});const wrong=await request('playLoad');check('different owner response clears native identity without leaking data',!wrong.ok&&!wrong.state&&!auth.status().signedIn);
  await login();playQueue.push({status:403,data:{ok:false,error:{code:'SESSION_REVOKED'}}});check('revoked server session stops native play',(await request('playLoad')).error.code==='SESSION_REVOKED'&&!auth.status().signedIn);
  await window.loadURL(base+'/synk-account/client.html?product=platform');check('sibling product cannot use WORLD IPC',await run("window.synkDesktop.accountRequest('playLoad').then(()=>false,()=>true)"));
  check('no remote request or renderer error',deniedNetwork===0&&errors.length===0);
  await finish(true);
}catch(error){errors.push(error.message);await finish(false);}});
