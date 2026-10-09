const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {randomUUID,createHash}=require('node:crypto');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.SYNK_WORLD_QA_URL||'http://127.0.0.1:4396';
assert.equal(new URL(base).hostname,'127.0.0.1','Only the isolated local QA host is allowed');
assert.equal(new URL(base).port,'4396','Do not mutate the user-facing 4296 fixture');
const mode=process.argv.includes('--after-restart')?'after-restart':'before-restart';
const file=path.join(__dirname,'town-connection-api.json'),checkpoint=path.join(__dirname,'town-connection-api-checkpoint.json');
const checks=[],errors=[];const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
async function request(route,{session,method='GET',body}={}){
 const response=await fetch(base+'/api/world/'+route,{method,headers:{'Content-Type':'application/json','Origin':base,'X-Synk-Product':'world','X-Synk-Contract':'1','X-Synk-Rehearsal':'1',...(session?{'X-Synk-Rehearsal-Tab':session.tab,Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json()};
}
async function login(account){const session={tab:randomUUID()};const result=await request('rehearsal/session',{session,method:'POST',body:{accountKey:account}});assert.equal(result.status,200);return {...session,token:result.body.accessToken,accountId:result.body.accountId};}
async function read(session){const result=await request('town/state',{session});assert.equal(result.status,200);return result.body;}
async function browserBridge(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/mobile.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld&&window.__synkHome.sceneAvailable(),null,{timeout:60000});
  const unowned=await page.evaluate(async()=>{
   const client=window.__synkWorld.client;await client.signIn('player-b');
   const {confirmedAppearance}=await import('/world-town-client.mjs');
   const forged=structuredClone(client.snapshot);forged.avatar.slots.neck='mongle-scarf-first-steps';
   const appearance=confirmedAppearance(forged);window.__synkHome.setEquipment(appearance.slots);
   return {serverOwnsScarf:client.snapshot.inventory.some(item=>item.itemId==='mongle-scarf-first-steps'),appearance,rendered:window.__synkHome.sceneMetrics().outfit};
  });
  check('unowned neck item is removed before the actual home renderer receives appearance',!unowned.serverOwnsScarf&&unowned.appearance.slots.neck===''&&!unowned.rendered.includes('scarf'));
  await page.evaluate(async()=>{
   const client=window.__synkWorld.client;await client.signIn('player-a');
   const {connectTownWorld}=await import('/world-town-client.mjs');window.__townApiQa={appearances:[],errors:[],original:{...client.snapshot.avatar.slots}};
   window.__townApiQa.bridge=await connectTownWorld({onAppearance:value=>window.__townApiQa.appearances.push(value),onError:error=>window.__townApiQa.errors.push(error.code)});
  });
  check('browser bridge restores its own tab account and server-confirmed inventory',await page.evaluate(()=>{const actual=window.__townApiQa.bridge.appearance(),snap=window.__synkWorld.client.snapshot;return actual.verified&&actual.revision===snap.revision&&actual.slots.neck===snap.avatar.slots.neck;}));
  await page.evaluate(()=>{const client=window.__synkWorld.client;return client.equip({...client.snapshot.avatar.slots,body:client.snapshot.avatar.slots.body?'':'mongle-apron-starter'});});
  await page.waitForFunction(()=>window.__townApiQa.bridge.appearance().revision===window.__synkWorld.client.snapshot.revision);
  check('appearance invalidation refreshes the receiver from the server',await page.evaluate(()=>window.__townApiQa.bridge.appearance().slots.body===window.__synkWorld.client.snapshot.avatar.slots.body));
  const publications=await page.evaluate(()=>window.__townApiQa.appearances.length);
  await page.evaluate(()=>{const channel=new BroadcastChannel('synk-world-appearance-v1');channel.postMessage({type:'refresh',slots:{body:'unowned-body',neck:'unowned-neck'},revision:999999});channel.close();});
  await page.waitForFunction(count=>window.__townApiQa.appearances.length>count,publications);
  check('forged broadcast contents never grant or render items',await page.evaluate(()=>{const bridge=window.__townApiQa.bridge.appearance(),snap=window.__synkWorld.client.snapshot;return bridge.revision===snap.revision&&bridge.slots.body===snap.avatar.slots.body&&bridge.slots.neck===snap.avatar.slots.neck;}));
  await page.evaluate(()=>window.__synkWorld.client.equip(window.__townApiQa.original));
  await page.waitForFunction(()=>window.__townApiQa.bridge.appearance().revision===window.__synkWorld.client.snapshot.revision);
  const rejected=await page.evaluate(async()=>{
   const client=window.__synkWorld.client,token=client.accessToken,tab=client.tabId;await client.logout();
   const response=await fetch('/api/world/town/state',{headers:{Authorization:`Bearer ${token}`,'X-Synk-Rehearsal-Tab':tab}});return response.status;
  });
  check('browser token is rejected by the town API after logout',rejected===401);
  await page.waitForFunction(()=>!window.__townApiQa.bridge.appearance().verified);
  check('receiver clears appearance and blocks commands after logout',await page.evaluate(async()=>{try{await window.__townApiQa.bridge.request('state');return false;}catch(error){return error.code==='AUTH_REQUIRED'&&window.__townApiQa.bridge.appearance().outfit==='none';}}));
  await page.evaluate(()=>window.__townApiQa.bridge.dispose());
  check('browser bridge has no runtime errors',errors.length===0);
  await context.close();
 }finally{await browser.close();}
}
(async()=>{
 if(mode==='before-restart'){
  check('anonymous town reads are rejected', (await request('town/state')).status===401);
  check('anonymous town writes are rejected', (await request('town/command',{method:'POST',body:{id:randomUUID(),type:'LEAVE',payload:{},expectedRevision:0}})).status===401);
  const a=await login('player-a'),b=await login('player-b');const beforeA=await read(a),beforeB=await read(b);
  check('town snapshots are explicitly scoped synthetic-account previews',beforeA.rehearsal&&beforeA.accountScoped&&beforeB.rehearsal&&beforeB.accountScoped);
  check('wrong town operation method is rejected',(await request('town/command',{session:a})).status===405);
  const spoofedRead=await request('town/state?accountId='+b.accountId,{session:a});
  check('query account ID cannot select another account town',digest(spoofedRead.body.state)===digest(beforeA.state));
  const command={id:'town-api-'+randomUUID(),type:beforeA.state.phase==='away'?'VISIT':'LEAVE',payload:{},expectedRevision:beforeA.state.revision,accountId:b.accountId};
  const changed=await request('town/command',{session:a,method:'POST',body:command});assert.equal(changed.status,200);
  check('authenticated mutation only changes account A despite forged owner field',changed.body.state.revision===beforeA.state.revision+1&&digest((await read(b)).state)===digest(beforeB.state));
  const duplicate=await request('town/command',{session:a,method:'POST',body:command});
  check('town duplicate command is idempotent',duplicate.status===200&&duplicate.body.duplicate===true&&digest(duplicate.body.state)===digest(changed.body.state));
  const stale=await request('town/command',{session:a,method:'POST',body:{...command,id:'stale-'+randomUUID()}});
  check('town stale revision cannot overwrite a newer state',stale.status===409&&digest((await read(a)).state)===digest(changed.body.state));
  const bootB=await request('bootstrap',{session:b});assert.equal(bootB.status,200);
  const unowned=await request('avatar/outfit',{session:b,method:'PUT',body:{slots:{...bootB.body.avatar.slots,neck:'mongle-scarf-first-steps'},expectedRevision:bootB.body.revision,requestId:randomUUID()}});
  check('server rejects equipping an unowned neck item',[400,403].includes(unowned.status)&&(await request('bootstrap',{session:b})).body.avatar.slots.neck==='');
  await browserBridge();
  const states={a:await read(a),b:await read(b)};
  fs.writeFileSync(checkpoint,JSON.stringify({savedAt:new Date().toISOString(),digests:{a:digest(states.a.state),b:digest(states.b.state)},revisions:{a:states.a.state.revision,b:states.b.state.revision},commandId:command.id},null,2));
  await request('rehearsal/logout',{session:a,method:'POST',body:{}});
  check('logged-out API session cannot read or write its town',(await request('town/state',{session:a})).status===401&&(await request('town/command',{session:a,method:'POST',body:command})).status===401);
  check('other account remains authenticated and unchanged after A logout',digest((await read(b)).state)===digest(states.b.state));
  await request('rehearsal/logout',{session:b,method:'POST',body:{}});
  const sourceSha256=Object.fromEntries(['server.mjs','town-host.mjs','world-client.mjs','world-town-client.mjs'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',name))).digest('hex')]));
  fs.writeFileSync(file,JSON.stringify({checkedAt:new Date().toISOString(),base,checks,passed:checks.length,errors,sourceSha256,restartVerified:false,limits:['API and browser bridge only; Town scene integration is a separate verification','Synthetic local accounts, not production identity or TOPIK access','Not physical-device or Unity performance proof']},null,2));
 }else{
  const saved=JSON.parse(fs.readFileSync(checkpoint)),report=JSON.parse(fs.readFileSync(file));
  const a=await login('player-a'),b=await login('player-b'),states={a:await read(a),b:await read(b)};
  check('actual server restart restores account A town state byte-equivalently after canonicalization',digest(states.a.state)===saved.digests.a);
  check('actual server restart restores separate account B town state',digest(states.b.state)===saved.digests.b);
  check('committed town command survives restart',states.a.state.commands.some(command=>command.id===saved.commandId));
  await request('rehearsal/logout',{session:a,method:'POST',body:{}});await request('rehearsal/logout',{session:b,method:'POST',body:{}});
  report.checks.push(...checks);report.passed=report.checks.length;report.restartVerified=true;report.restartedCheckedAt=new Date().toISOString();fs.writeFileSync(file,JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify({phase:mode,passed:checks.length,errors}));
})().catch(error=>{fs.writeFileSync(path.join(__dirname,'town-connection-api-failure.json'),JSON.stringify({phase:mode,error:String(error),checks,errors},null,2));console.error(error);process.exit(1);});
