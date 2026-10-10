// Local UI lifecycle regression only. Account transport and game session responses
// are in-memory stubs; the app shell and Maru home are the real served modules.
// Run with the dedicated rehearsal server: node <this file>
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const base=new URL(process.env.SYNK_WORLD_QA_URL||'http://127.0.0.1:4310/');
const output=path.join(__dirname,'lifecycle-races.json');
const appRoot=path.resolve(__dirname,'../..');
const scenarios=[
 'prepare-close',
 'prepare-close-reopen',
 'resolve-normal',
 'resolve-close-reopen-success',
 'resolve-close-reopen-failure'
];
const report={checkedAt:new Date().toISOString(),base:base.href,passed:0,cases:[],errors:[],blockedRequests:[],sourceHashes:{},limits:[
 'Real app-shell.mjs and brand-opening/home.mjs execute in isolated Edge contexts.',
 'world-account.bundle.mjs is replaced only in browser routing with an in-memory account stub. No credentials, OAuth, or server account writes are used.',
 'Only GET requests to the selected loopback origin are allowed; all other requests are blocked.',
 'Same-task close and immediate settings reopening deliberately exercise a queued dialog close event. This is a synthetic ordering test, not physical-device timing evidence.',
 'Game entry and panel lifecycle only; no playthrough, purchases, or learning effects are tested.'
]};

function accountStub(scenario){return `
export async function loadWorldConfig(){return {mode:'account',basePath:'/',account:{}};}
export function createWorldAccount(){
 const audit=window.__lifecycleAudit={scenario:${JSON.stringify(scenario)},prepares:0,disposes:0,closes:0,phase:${JSON.stringify(scenario.startsWith('prepare-')?'synced':'conflict')}};
 return {
  restore:async()=>false,stop(){},preferences(){return null;},assertActive(){},
  prepareGame(){
   audit.prepares++;
   const session={
    status:()=>({play:{phase:audit.phase,code:'REVISION_CONFLICT'}}),
    resolve(){return new Promise((resolve,reject)=>{audit.releaseResolution=fail=>{
     if(fail)reject(Object.assign(Error('Synthetic network failure'),{code:'NETWORK_UNAVAILABLE'}));
     else{audit.phase='synced';resolve({play:{phase:'synced'}});}
    };});},
    dispose(){audit.disposes++;},closeGame(){audit.closes++;}
   };
   if(audit.scenario.startsWith('prepare-'))return new Promise(resolve=>{audit.releasePreparation=()=>resolve(session);});
   return Promise.resolve(session);
  }
 };
}`;}

async function snapshot(page){return page.evaluate(()=>({
 title:document.querySelector('#panel-title').textContent,
 kind:window.__synkHome.openPanel(),screen:window.__synkWorld.screen(),
 open:document.querySelector('#world-panel').open,
 frames:document.querySelectorAll('#panel-content iframe').length,
 toast:!document.querySelector('#home-toast').hidden,
 prepares:window.__lifecycleAudit.prepares,
 disposes:window.__lifecycleAudit.disposes
}));}

async function runCase(browser,name){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const errors=[];
 try{
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==base.origin||request.method()!=='GET'){
    report.blockedRequests.push({scenario:name,origin:url.origin,pathname:url.pathname,method:request.method()});
    return route.abort();
   }
   if(url.pathname.endsWith('/world-account.bundle.mjs'))return route.fulfill({contentType:'text/javascript',body:accountStub(name)});
   return route.continue();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const entry=new URL(base);entry.searchParams.set('opening','off');
  await page.goto(entry.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkWorld&&window.__synkHome);
  await page.evaluate(()=>{
   // A synthetic snapshot enables the UI gate without logging in or persisting credentials.
   window.__synkWorld.client.snapshot={accountId:'lifecycle-qa',revision:1,looks:[],inventory:[],avatar:{slots:{}}};
   window.__synkWorld.client.emit();
  });
  await page.locator('.adventure-button').click();
  await page.locator('[data-game=runner]').click();
  if(name.startsWith('prepare-')){
   await page.waitForFunction(()=>window.__lifecycleAudit.releasePreparation);
   if(name==='prepare-close')await page.locator('#panel-close').click();
   else await page.evaluate(()=>{document.querySelector('#panel-close').click();document.querySelector('#settings-open').click();});
   // Let the native queued close event run after an already reopened panel.
   await page.waitForTimeout(100);
   const before=await snapshot(page);
   await page.evaluate(()=>window.__lifecycleAudit.releasePreparation());
   await page.waitForTimeout(150);
   const after=await snapshot(page);
   assert.equal(after.frames,0,'A cancelled preparation must not create a game iframe');
   assert.equal(after.disposes,1,'The late prepared session must be disposed');
   assert.equal(after.prepares,1);
   if(name==='prepare-close')assert.equal(after.open,false);
   else assert.equal(after.title,'편안하게 머물러요.');
   assert.equal(after.toast,false);
   assert.deepEqual(errors,[]);
   report.cases.push({name,passed:true,before,after,errors});
  }else{
   await page.locator('[data-choice=remote]').click();
   await page.waitForFunction(()=>window.__lifecycleAudit.releaseResolution);
   if(name!=='resolve-normal'){
    await page.evaluate(()=>{document.querySelector('#panel-close').click();document.querySelector('#settings-open').click();});
    await page.waitForTimeout(100);
   }
   const before=await snapshot(page);
   await page.evaluate(fail=>window.__lifecycleAudit.releaseResolution(fail),name.endsWith('failure'));
   await page.waitForTimeout(150);
   const after=await snapshot(page);
   if(name==='resolve-normal'){
    assert.equal(after.frames,1,'Normal resolution must reenter exactly one game');
    assert.equal(after.prepares,2);
    assert.equal(after.kind,'game');
   }else{
    assert.equal(after.frames,0,'A late resolution must not replace the newly opened settings');
    assert.equal(after.prepares,1);
    assert.equal(after.title,'편안하게 머물러요.');
    assert.equal(after.toast,false,'A stale failure must not add a toast to the new panel');
   }
   assert.deepEqual(errors,[]);
   report.cases.push({name,passed:true,before,after,errors});
  }
  report.passed++;
  console.log(`PASS ${name}`);
 }catch(error){
  report.cases.push({name,passed:false,error:error.stack,errors});
  throw error;
 }finally{await context.close();}
}

(async()=>{
 assert(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Only a loopback rehearsal server is permitted');
 const health=await fetch(new URL('/health',base)).then(response=>response.json());
 assert.equal(health.mode,'rehearsal','A dedicated local rehearsal server is required');
 for(const file of ['app-shell.mjs','../brand-opening/home.mjs'])report.sourceHashes[file]=createHash('sha256').update(fs.readFileSync(path.resolve(appRoot,file))).digest('hex');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const scenario of scenarios)await runCase(browser,scenario);
  assert.deepEqual(report.blockedRequests,[],'The scenarios should not attempt external or mutating requests');
 }finally{await browser.close();}
})().catch(error=>{report.errors.push(error.stack);process.exitCode=1;console.error(error.message);}).finally(()=>{
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,total:scenarios.length,output}));
});
