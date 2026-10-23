// Workspace 「플랫폼의 SYNK ID 연결을 확인하고 있어요.」 mask in real Chrome (2026-10-22 the window stayed on it).
// Real company server (disposable SQLite) + the PC app's own main modules (auth-service, suite follower/publisher,
// company-requests) + a synkDesktop bridge in place of Electron's preload. Fake SYNK ID; no operating servers or accounts.
// node qa/verify-synk-check-mask.mjs --out <folder> [--바탕 <commit>]   → <out>/{전,후}/<width>/<scene>.png·.txt + report.json
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir,homedir} from 'node:os';
import {join,resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';
const require=createRequire(import.meta.url),here=dirname(fileURLToPath(import.meta.url)),company=resolve(here,'..'),root=resolve(here,'../../../../../..');
const {createAuthService}=require(join(root,'desktop/src/auth-service.cjs'));
const {suiteKey,createSuiteStore,createSuitePublisher,createSuiteFollower}=require(join(root,'desktop/src/suite-session.cjs'));
const {createCompanyRequests}=require(join(root,'desktop/src/company-requests.cjs'));
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const arg=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:null;};
const out=resolve(arg('--out')||join(tmpdir(),'synk-check-mask'));
const base=arg('--바탕')||'origin/master';
const beforeSource=execFileSync('git',['show',`${base}:${relative(root,join(company,'public/synk-id.js')).replaceAll('\\','/')}`],{cwd:root,encoding:'utf8',maxBuffer:4<<20});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(done=>{const s=createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>done(p));});});

async function harness({synkIdSource=null,viewport={width:1440,height:900}}={}){
  process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED='0';
  let skew=0;const now=()=>Date.now()+skew,userId='11111111-1111-4111-8111-111111111111';
  const idp={tokens:new Map(),refresh:new Map(),down:false};
  const issue=sid=>{const a='acc-'+randomBytes(12).toString('hex'),r='ref-'+randomBytes(12).toString('hex');idp.tokens.set(a,{sub:userId,exp:now()+3600_000,sid});idp.refresh.set(r,{sid});return {access_token:a,refresh_token:r,expires_in:3600,token_type:'bearer'};};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
  async function idpFetch(url,options={}){
    if(idp.down)throw new TypeError('fetch failed');const u=new URL(url);
    if(u.pathname==='/auth/v1/oauth/token'){const p=new URLSearchParams(String(options.body)),rec=idp.refresh.get(p.get('refresh_token'));if(!rec)return reply(400,{error:'invalid_grant'});idp.refresh.delete(p.get('refresh_token'));return reply(200,issue(rec.sid));}
    const t=idp.tokens.get(String(options.headers?.Authorization||'').replace(/^Bearer /,''));if(!t||t.exp<=now())return reply(401,{error:{code:'AUTH_REQUIRED'}});
    if(u.pathname==='/auth/v1/user')return reply(200,{id:t.sub});
    if(u.pathname==='/functions/v1/synk-account')return reply(200,{ok:true,account:{synk_user_id:t.sub,status:'active',profile:{display_name:'합성 직원'}},sessions:[{id:t.sid,current:true,revoked:false}]});
    return reply(404,{});
  }
  const verifyIdentity=async token=>{if(idp.down)throw Object.assign(Error('down'),{status:503});const t=idp.tokens.get(token);if(!t||t.exp<=now())throw Object.assign(Error('rejected'),{status:401});return {synkUserId:t.sub,expiresAt:t.exp,currentSessionId:t.sid};};
  const dir=await mkdtemp(join(tmpdir(),'synk-check-mask-')),port=await freePort();
  const app=createCompanyApp({dataDir:join(dir,'company'),port,allowTestHost:true,schedule:false,synkIdentityConfig:{accountApiUrl:'https://identity.example.test/functions/v1/synk-account',publishableKey:'fixture-public',issuer:null,clientId:null},synkIdentityVerifier:verifyIdentity,synkIdentityNow:now,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  await app.start();const origin=`http://127.0.0.1:${port}`;
  const staff=app.store.createUser({name:'합성 크루',email:'crew@example.test',password:'fixture-company-password-2026',role:'admin'});
  app.store.db.prepare('INSERT INTO synk_identity_links VALUES(?,?,?,?)').run(userId,staff.id,randomBytes(16).toString('base64url'),new Date().toISOString());
  const config={supabaseUrl:'https://idp.example.test',accountApiUrl:'https://idp.example.test',publishableKey:'fixture-public',product:'messenger',clientId:'desktop-fixture',redirectUri:'http://127.0.0.1:1/callback',clientKey:'messenger',fingerprint:'fixture'};
  const key=suiteKey(config,'development'),suiteDir=join(dir,'suite');
  const vault=seed=>{let saved=seed;return {available:()=>true,load:async()=>saved,save:async v=>{saved=v;},clear:async()=>{saved=null;}};};
  // The platform app publishes the selected account; the Workspace app follows it with its own vault.
  const platformAuth=createAuthService({config:{...config,clientKey:'platform'},store:vault({refreshToken:issue('platform').refresh_token,subject:userId}),fetcher:idpFetch,now,onChange:state=>publisher.publish(state)});
  const publisher=createSuitePublisher({store:createSuiteStore({directory:suiteDir,key}),key,now});await publisher.initialize(platformAuth);
  let page=null;const emit=state=>{if(page&&!page.isClosed())page.evaluate(s=>window.__synkEmit?.(s),state).catch(()=>{});};
  const auth=createAuthService({config,store:vault({refreshToken:issue('workspace').refresh_token,subject:userId}),fetcher:idpFetch,now,onChange:emit});
  const follower=createSuiteFollower({store:createSuiteStore({directory:suiteDir,key}),auth});await follower.start();
  const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport});
  const net={down:false};
  const companyRequest=createCompanyRequests({entry:origin+'/?tab=messenger',clientId:'messenger',auth,session:{fetch:async(url,{method,headers,body})=>{if(net.down)throw new TypeError('fetch failed');const r=await context.request.fetch(url,{method,headers,data:body,maxRedirects:0,failOnStatusCode:false,timeout:12000});return {ok:r.ok(),status:r.status(),text:()=>r.text()};}}});
  const main={authStatus:()=>auth.status(),accountRequest:(o,p)=>auth.accountRequest(o,p),companyRequest:(o,p)=>companyRequest(o,p),authSignIn:()=>auth.status(),authCancelSignIn:()=>auth.cancel(),authSignOut:()=>auth.signOut()};
  await context.exposeBinding('__synkMain',async(_source,op,args)=>JSON.parse(JSON.stringify(await main[op](...(args||[]))??null)));
  await context.addInitScript(()=>{
    const listeners=new Set();window.__synkEmit=s=>{for(const fn of [...listeners])try{fn(s);}catch{}};const call=(op,...args)=>window.__synkMain(op,args);
    window.synkDesktop=Object.freeze({authStatus:()=>call('authStatus'),accountRequest:(o,p)=>call('accountRequest',o,p),companyRequest:(o,p)=>call('companyRequest',o,p),authSignIn:()=>call('authSignIn'),authCancelSignIn:()=>call('authCancelSignIn'),authSignOut:()=>call('authSignOut'),onAuthChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);}});
    window.__hidden=null;const hd=Object.getOwnPropertyDescriptor(Document.prototype,'hidden');Object.defineProperty(Document.prototype,'hidden',{configurable:true,get(){return window.__hidden===null?hd.get.call(this):window.__hidden;}});
  });
  if(synkIdSource)await context.route('**/synk-id.js*',route=>route.fulfill({status:200,contentType:'text/javascript; charset=utf-8',body:synkIdSource}));
  page=await context.newPage();const consoleErrors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('pageerror',e=>consoleErrors.push(String(e)));
  const state=()=>page.evaluate(()=>{const note=[...document.querySelectorAll('.initial-loading[role="status"]')].find(n=>/SYNK ID/.test(n.textContent));return {masked:!!note&&document.querySelector('#app')?.style.display==='none',text:note?.innerText||'',button:!!note?.querySelector('button'),user:typeof state!=='undefined'&&!!state.user,timer:typeof synkRenewTimer!=='undefined'&&synkRenewTimer!==null,overflow:document.documentElement.scrollWidth>innerWidth};});
  const waitFor=async(test,label,timeout=20000)=>{const end=Date.now()+timeout;let last;while(Date.now()<end){last=await state();if(test(last))return last;await sleep(150);}throw Error(`${label}: ${JSON.stringify(last)}`);};
  await page.goto(origin+'/?tab=messenger');await waitFor(v=>v.user&&!v.masked,'boot');
  return {page,net,idp,advance:ms=>{skew+=ms;},state,waitFor,consoleErrors,async close(){await browser.close().catch(()=>{});follower.dispose();auth.dispose();publisher.dispose();platformAuth.dispose();await app.stop();await rm(dir,{recursive:true,force:true});}};
}
const chatFocus=h=>h.page.evaluate(()=>{const frame=document.querySelector('iframe');const input=frame?.contentDocument?.createElement('input');if(input){frame.contentDocument.body.append(input);input.focus();}return !!input;});
// The Windows window comes back into view; a focused chat frame gets focus again, the top window gets no focus event.
const shown=h=>h.page.evaluate(()=>{window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.__hidden=null;document.dispatchEvent(new Event('visibilitychange'));});
async function shot(h,side,width,name){const dirName=join(out,side,String(width));mkdirSync(dirName,{recursive:true});await h.page.screenshot({path:join(dirName,name+'.png')});writeFileSync(join(dirName,name+'.txt'),(await h.page.evaluate(()=>document.body.innerText)).trim()+'\n');}

const report={checkedAt:new Date().toISOString(),synthetic:true,base,scenes:{},consoleErrors:[]};
for(const [side,source] of [['전',beforeSource],['후',null]]){
  for(const [width,height] of [[1440,900],[390,844]]){
    const h=await harness({synkIdSource:source,viewport:{width,height}});
    try{
      const inChat=await chatFocus(h)&&(await h.state()).timer;
      h.net.down=true;await shown(h);// the company server cannot be reached from the app
      await h.waitFor(v=>v.masked,'mask',15000);await sleep(300);await shot(h,side,width,'가림막-확인중');
      await sleep(24000);const later=await h.state();await shot(h,side,width,'가림막-20초뒤');
      h.net.down=false;await sleep(35000);const recovered=await h.state();
      report.scenes[`${side}-${width}`]={renewalKeptWhileInChat:inChat,maskedAfter24s:later.masked,exitShown:later.button,text:later.text,recoveredWithoutClick:recovered.user&&!recovered.masked,overflow:later.overflow};
      report.consoleErrors.push(...h.consoleErrors.map(e=>`${side}-${width}: ${e}`));
    }finally{await h.close();}
  }
}
{
  const h=await harness();
  try{h.net.down=true;await h.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await h.page.waitForSelector('.initial-loading[role="status"] button',{timeout:40000});h.net.down=false;await h.page.click('.initial-loading[role="status"] button');await sleep(4000);const s=await h.state();report.scenes.reconnect={masked:s.masked,user:s.user};}
  finally{await h.close();}
}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,1)+'\n');
const after=report.scenes;
for(const width of [1440,390]){const s=after[`후-${width}`];assert.equal(s.renewalKeptWhileInChat,true);assert.equal(s.exitShown,true,'the mask says why and offers a reconnect');assert.equal(s.recoveredWithoutClick,true);assert.equal(s.overflow,false);}
assert.equal(after.reconnect.masked,false);assert.equal(after.reconnect.user,true);
console.log(JSON.stringify(report.scenes,null,1));
