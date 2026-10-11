import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {lessonById} from '../life-content.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='11111111-1111-4111-8111-111111111111';
const core=value=>JSON.stringify({owner:value.owner,version:value.version,lessons:value.lessons,reviews:value.reviews,activeLessonId:value.activeLessonId,activeReview:value.activeReview});
test('frozen /world tutor follows owner choice, preserves guided records and disposes on logout',{timeout:90000},async()=>{
 const payload=path.resolve(process.env.SYNK_LIFE_TUTOR_STATIC_PAYLOAD||'.tmp/world-app-life-tutor-20261011-r2/world'),config=JSON.parse(fs.readFileSync(path.join(payload,'world-config.json'),'utf8')).account;
 const out=path.resolve('experiences/synk-world-app/qa/life-tutor-20261011',process.env.SYNK_LIFE_TUTOR_STATIC_RUN||'account');fs.mkdirSync(out,{recursive:true});
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.mp4':'video/mp4','.wav':'audio/wav','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname.slice(7))||'index.html',standalone=name==='brand-opening/home.html',file=standalone?path.resolve('experiences/brand-opening/home.html'):path.resolve(payload,name),rel=path.relative(payload,file);if(!u.pathname.startsWith('/world/')||!standalone&&(rel.startsWith('..')||path.isAbsolute(rel))||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const state=emptyPlayState(),wallet=JSON.stringify(state.wallet),commands=new Map(),checks=[],calls=[],errors=[],assets=[],outside=[];let revision=0,browser,context,page,failure;
 const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
 const read=()=>page.evaluate(()=>window.__synkWorld.life());
 const synced=()=>page.waitForFunction(()=>document.querySelector('.life-save-status')?.dataset.savePhase==='synced');
 const snapshot={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[],activeRun:null};
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(15000);
  await context.addInitScript(account=>{sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-life-tutor-static',refresh_token:null,expires_at:Date.now()+3600000}));localStorage.setItem('synk.world.tutor.v1:guest',JSON.stringify({version:1,completed:true,tutor:'marin'}));localStorage.setItem('synk.world.tutor.v1:'+account,JSON.stringify({version:1,completed:true,tutor:'kkamong'}));},A);
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());if(u.origin===base)return route.continue();
   if(u.origin!==new URL(config.accountApiUrl).origin){outside.push(u.pathname);return route.abort();}
   const body=request.postDataJSON();calls.push({path:u.pathname,action:body?.action||null});let data;
   if(u.pathname.endsWith('/synk-account'))data={ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[]};
   else if(u.pathname.endsWith('/synk-world-v1/bootstrap'))data=snapshot;
   else if(u.pathname==='/auth/v1/logout')data={};
   else if(u.pathname.endsWith('/synk-play')){
    if(body){assert.equal(body.action,'progress');if(commands.has(body.id))data=commands.get(body.id);else{for(const change of body.changes){assert.equal(change.key,'synk.life-korean.progress.v1');assert.equal(change.previous,state.records[change.key]??null);state.records[change.key]=change.value;}data={ok:true,scope:'synk-play',accountId:A,revision:++revision,state:structuredClone(state)};commands.set(body.id,data);}}
    else data={ok:true,scope:'synk-play',accountId:A,revision,state:structuredClone(state)};
   }else{outside.push(u.pathname);return route.abort();}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)assets.push({path:new URL(r.url()).pathname,status:r.status()});});
  await page.goto(base+'/world/mobile.html?opening=off&cafe=1');await page.waitForFunction(()=>window.__synkWorld?.life()?.owner==='11111111-1111-4111-8111-111111111111');
  check('account choice overrides the different guest tutor',(await read()).tutor.tutor==='kkamong');
  await page.locator('.cafe-visit-list [data-life-lesson=cafe-visit-soldout]').click();await page.locator('[data-life-cafe-mode=read]').click();await page.locator('[data-life-cafe-next]').click();
  const q=lessonById('cafe-visit-soldout').questions[0];await page.locator(`[data-life-cafe-choice=${q.choices.find(c=>c.id!==q.answerId).id}]`).click();await synced();
  const before=await read(),writeCount=calls.filter(c=>c.action).length;await page.locator('[data-life-tutor-retry]').click();await page.locator(`[data-expression-choice=${q.review.answerId}]`).click();await synced();
  const stored=JSON.parse(state.records['synk.life-korean.progress.v1']),guided=Object.values(stored.daily?.days||{}).map(day=>day.items[q.id]).find(item=>item?.guidedAt);
  check('guided answer adds one account life record at success while keeping first error and repair checkpoint',calls.filter(c=>c.action).length===writeCount+1&&core(stored)===core(before.progress)&&core((await read()).progress)===core(before.progress)&&guided?.tutorId==='kkamong'&&guided.lessonId==='cafe-visit-soldout'&&guided.outcome==='retry'&&await page.locator('.life-expression-practice[open]').count()===1);
  await page.locator('.life-expression-return').click();
  await page.reload();await page.locator('.cafe-pack-preview [data-life-lesson=cafe-visit-soldout]').click();
  check('frozen account page restores selected tutor and the actual repair checkpoint',(await read()).tutor.tutor==='kkamong'&&(await read()).cafe.phase==='repair'&&!(await read()).progress.lessons['cafe-visit-soldout'].answers[q.id].correct);
  await page.locator('[data-life-cafe-pause],[data-life-pause]').first().click();await page.locator('[data-life-library]').click();await page.locator('[data-life-pack=plans]').click();await page.locator('[data-life-lesson=plans-story]').click();await page.locator('[data-life-begin]').click();
  check('story keeps its three distinct actors beside the selected mentor',await page.locator('.life-cast .life-friend').count()===3&&(await read()).tutor.tutor==='kkamong');await page.screenshot({path:path.join(out,'account-story.png')});
  await page.locator('[data-life-pause]').click();await page.locator('[data-view=me]').first().click();await page.locator('[data-world=logout]').click();await page.waitForFunction(()=>window.__synkWorld.life()?.owner==='guest');
  await page.locator('[data-world=guest]').click();await page.locator('[data-view=cafe]').click();await page.locator('.life-tutor-help').click();
  check('logout restores guest tutor and does not leak account difficulties',(await read()).owner==='guest'&&(await read()).tutor.tutor==='marin'&&await page.locator('.life-tutor-difficulties [data-life-expression]').count()===0);await page.locator('.life-tutor-resume').click();await page.locator('#panel-close').click();
  check('owner change released account guide and draft view',!(await read()).tutor&&await page.locator('.life-expression-practice,.life-tutor-guide').count()===0);
  await page.goto(base+'/world/brand-opening/home.html?opening=off');await page.waitForFunction(()=>window.__synkHome);await page.locator('[data-life-library]').click();await page.locator('[data-life-pack=greetings]').click();await page.locator('[data-life-lesson=greetings-expressions]').click();
  check('bundled standalone home uses the same guest tutor',await page.evaluate(()=>window.__synkLife.metrics().tutor.tutor==='marin'));
  await page.locator('[data-life-begin]').click();while(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();await page.locator('[data-life-choice=b]').click();await page.locator('[data-life-tutor-retry]').click();
  check('standalone bundle offers the canonical transfer exercise',await page.locator('.life-expression-question h4').textContent()===lessonById('greetings-expressions').questions[0].review.prompt);await page.screenshot({path:path.join(out,'standalone-practice.png')});await page.locator('.life-expression-cancel').click();
  check('only life progress was written and no wallet mutation occurred',JSON.stringify(state.wallet)===wallet&&calls.filter(c=>c.action).every(c=>c.action==='progress'));
  check('all new modules, art and fonts resolve under the mounted public path',!errors.length&&!assets.length&&!outside.length);
 }catch(error){failure=error;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,payload,at:new Date().toISOString(),checks,calls,errors,assets,outside,...(failure?{failure:failure.stack}:{}),scope:{frozenStatic:true,standaloneHtml:'source',syntheticAccount:true,realOAuth:false,remoteDatabase:false,published:false}},null,2)+'\n');if(page&&!page.isClosed()){await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank').catch(()=>{});}await context?.close();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
