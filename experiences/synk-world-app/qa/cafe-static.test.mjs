import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {emptyPlayState} from '../../play-common/play-data.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='11111111-1111-4111-8111-111111111111';
test('frozen /world cafe completes and restores the physical checkpoint through the official account transport',{timeout:90000},async()=>{
 const payload=path.resolve(process.env.SYNK_CAFE_PUBLIC_PAYLOAD||'.tmp/world-app-cafe-20261010-r2/world');
 const config=JSON.parse(fs.readFileSync(path.join(payload,'world-config.json'),'utf8')).account;
 const output=path.resolve('experiences/synk-world-app/qa/cafe-pack-20261010',process.env.SYNK_CAFE_STATIC_QA_RUN||'account-static-r3');fs.mkdirSync(output,{recursive:true});
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.mp4':'video/mp4','.wav':'audio/wav'};
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(!u.pathname.startsWith('/world/')){res.writeHead(404).end();return;}const name=decodeURIComponent(u.pathname.slice(7))||'index.html',target=path.resolve(payload,name),rel=path.relative(payload,target);if(rel.startsWith('..')||path.isAbsolute(rel)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const state=emptyPlayState(),originalWallet=JSON.stringify(state.wallet),commands=new Map(),calls=[],errors=[],assets=[],unexpected=[],checks=[];let revision=0,browser,context,page;
 const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
 const snapshot={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[],activeRun:null};
 let failure;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});page=await context.newPage();page.setDefaultTimeout(15000);
  await context.addInitScript(()=>{sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-cafe-static',refresh_token:null,expires_at:Date.now()+3600000}));localStorage.setItem('synk.world.tutor.v1:11111111-1111-4111-8111-111111111111',JSON.stringify({version:1,completed:true,tutor:'kkamong'}));});
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());if(u.origin===base)return route.continue();
   if(u.origin!==new URL(config.accountApiUrl).origin){unexpected.push(request.url());return route.abort();}
   const body=request.postDataJSON();calls.push({path:u.pathname,action:body?.action||null});let data;
   if(u.pathname.endsWith('/synk-account'))data={ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[]};
   else if(u.pathname.endsWith('/synk-world-v1/bootstrap'))data=snapshot;
   else if(u.pathname.endsWith('/synk-play')){
    if(body){assert.equal(body.action,'progress');if(commands.has(body.id))data=commands.get(body.id);else{for(const change of body.changes){assert.equal(change.key,'synk.life-korean.progress.v1');assert.equal(change.previous,state.records[change.key]??null);state.records[change.key]=change.value;}revision++;data={ok:true,scope:'synk-play',accountId:A,revision,state:structuredClone(state)};commands.set(body.id,data);}}
    else data={ok:true,scope:'synk-play',accountId:A,revision,state:structuredClone(state)};
   }else{unexpected.push(u.pathname);return route.abort();}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)assets.push({url:r.url(),status:r.status()});});
  const key='synk.life-korean.progress.v1',entry=base+'/world/mobile.html?opening=off&cafe=1';
  const open=async()=>{await page.locator('.cafe-pack-preview [data-life-lesson=cafe-apply]').click();};
  const next=async()=>{if(await page.locator('.cafe-welcome [data-life-cafe-mode=read]').count())await page.locator('[data-life-cafe-mode=read]').click();await page.locator('[data-life-cafe-next]').click();},choose=id=>page.locator(`[data-life-cafe-choice=${id}]`).click();
  const synced=()=>page.waitForFunction(()=>document.querySelector('.life-save-status')?.dataset.savePhase==='synced');
  await page.goto(entry);await page.waitForFunction(()=>window.__synkWorld?.life()?.owner==='11111111-1111-4111-8111-111111111111');await open();await next();await choose('a');await synced();
  let stored=JSON.parse(state.records[key]).lessons['cafe-apply'];const attempt=stored.attemptId;
  check('first wrong response and one-cup repair checkpoint saved together',stored.stage.cafe.phase==='repair'&&!stored.answers['cafe-apply-order'].correct);
  await page.reload();await open();check('frozen account page reload restores the same unreceived order',await page.locator('[data-cafe-count="1"][data-cafe-received=false]').count()===1&&await page.evaluate(id=>window.__synkWorld.life().progress.lessons['cafe-apply'].attemptId===id,attempt));
  await choose('b');await next();await choose('c');await page.locator('[data-life-cafe-seat=garden]').click();await next();
  check('choosing a seat and receiving cups creates a real table checkpoint',await page.locator('.cafe-scene-table[data-cafe-seat=garden] [data-cafe-received=true]').count()===1);
  await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>document.documentElement.dataset.layout==='landscape');check('rotation keeps the received two-cup visit',await page.locator('[data-cafe-count="2"][data-cafe-received=true]').count()===1);await page.screenshot({path:path.join(output,'table-landscape.png')});
  await next();await choose('a');await synced();stored=JSON.parse(state.records[key]).lessons['cafe-apply'];check('all language responses remain incomplete before actual tea pickup',Object.keys(stored.answers).length===3&&stored.completedAt===null&&stored.stage.cafe.phase==='response');
  await page.reload();await open();check('fresh frozen page preserves tea awaiting pickup',await page.locator('[data-cafe-drink=takeout][data-cafe-received=false]').count()===1);await next();await synced();stored=JSON.parse(state.records[key]).lessons['cafe-apply'];check('explicit takeaway pickup completes exactly once with the first error retained',stored.stage.cafe.phase==='complete'&&stored.completedAt!==null&&!stored.answers['cafe-apply-order'].correct);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.dataset.layout==='portrait');await page.screenshot({path:path.join(output,'complete-portrait.png')});
  const {lessonById}=await import('../life-content.mjs');
  for(const id of ['cafe-visit-taste','cafe-visit-soldout','cafe-visit-change']){
   // The new compose visit can be the completion CTA. Visit cards remain the
   // deliberate entry for testing a particular story independent of ordering.
   await page.locator('[data-life-home]').click();await page.locator('[data-view=cafe]').click();
   await page.locator(`.cafe-visit-list [data-life-lesson="${id}"]`).click();await next();
   const l=lessonById(id),wrong=l.questions[0].choices.find(c=>c.id!==l.questions[0].answerId).id;await choose(wrong);await synced();
   let visit=JSON.parse(state.records[key]).lessons[id];const attemptId=visit.attemptId;
   check(id+' first error and physical order are saved atomically',visit.stage.cafe.phase==='repair'&&!visit.answers[l.questions[0].id].correct);
   await page.reload();await page.locator(`.cafe-pack-preview [data-life-lesson="${id}"]`).click();
   check(id+' fresh static page restores its own attempt',await page.evaluate(({id,attemptId})=>window.__synkWorld.life().progress.lessons[id].attemptId===attemptId,{id,attemptId})&&await page.locator('[data-life-cafe-next]').isDisabled());
   await choose(l.questions[0].answerId);await next();await choose(l.questions[1].answerId);await next();await choose(l.questions[2].answerId);await synced();
   visit=JSON.parse(state.records[key]).lessons[id];check(id+' all responses still wait for actual pickup',visit.completedAt===null&&visit.stage.cafe.phase==='response'&&Object.keys(visit.answers).length===3);
   await next();await synced();visit=JSON.parse(state.records[key]).lessons[id];
   check(id+' account completion retains the immutable first error',visit.completedAt!==null&&visit.stage.cafe.phase==='complete'&&!visit.answers[l.questions[0].id].correct);
   await page.screenshot({path:path.join(output,id+'-complete.png')});
  }
  check('four visit records are completed independently in the frozen account app',Object.values(JSON.parse(state.records[key]).lessons).filter(l=>l.completedAt!==null).length===4);
  check('the frozen app includes the complete local staff-question bank',await page.evaluate(()=>window.__synkWorld.life().speech.available));
  await page.locator('.life-actions [data-life-lesson=cafe-compose]').click();await next();
  const word=(field,value)=>page.locator(`[data-life-cafe-word="${field}"][data-cafe-value="${value}"]`).click();
  await word('drink','tea');await word('temperature','cold');await word('count',3);await page.locator('[data-life-cafe-submit]').click();await synced();let composed=JSON.parse(state.records[key]).lessons['cafe-compose'];
  check('assembled components and repair checkpoint share one official account write',composed.stage.cafe.phase==='repair'&&composed.answers['cafe-compose-order'].order.temperature==='cold'&&composed.answers['cafe-compose-order'].order.count===3);
  await page.reload();await page.locator('.cafe-pack-preview [data-life-lesson=cafe-compose]').click();await word('temperature','warm');await word('count',2);await page.locator('[data-life-cafe-submit]').click();await next();await choose('b');await next();await choose('a');await synced();composed=JSON.parse(state.records[key]).lessons['cafe-compose'];
  check('restored assembly corrects the current order and retains its first composition',composed.completedAt===null&&composed.stage.cafe.order.temperature==='warm'&&composed.stage.cafe.order.count===2&&composed.answers['cafe-compose-order'].order.temperature==='cold');
  await next();await synced();composed=JSON.parse(state.records[key]).lessons['cafe-compose'];check('the fifth visit finishes only on pickup through the official account transport',composed.completedAt!==null&&composed.stage.cafe.phase==='complete'&&Object.values(JSON.parse(state.records[key]).lessons).filter(l=>l.completedAt!==null).length===5);await page.screenshot({path:path.join(output,'compose-complete-portrait.png')});
  check('only scoped progress was written and the account wallet remains unchanged',JSON.stringify(state.wallet)===originalWallet&&calls.filter(c=>c.action).every(c=>c.action==='progress'));
  check('frozen runtime modules, tutor dependencies, art and CSS load without errors',!errors.length&&!assets.length&&!unexpected.length);
 }catch(error){failure=error;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});throw error;}
 finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({ok:!failure,payload,checkedAt:new Date().toISOString(),checks,calls,errors,assets,unexpected,...(failure?{failure:failure.stack}:{}),scope:{frozenStatic:true,officialAccountTransport:true,syntheticProvider:true,liveOAuth:false,remoteDatabase:false,published:false}},null,2)+'\n');
  await context?.close();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 }
});
