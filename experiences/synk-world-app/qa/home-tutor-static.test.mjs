import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {emptyPlayState} from '../../play-common/play-data.mjs';
import {lessonById} from '../life-content.mjs';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const A='11111111-1111-4111-8111-111111111111',LIFE='synk.life-korean.progress.v1';
const core=value=>JSON.stringify({owner:value.owner,version:value.version,lessons:value.lessons,reviews:value.reviews,activeLessonId:value.activeLessonId,activeReview:value.activeReview});

test('frozen /world home tutor uses actual owner history, preserves guided progress and clears it on logout',{timeout:120000},async()=>{
 const payload=path.resolve(process.env.SYNK_HOME_TUTOR_STATIC_PAYLOAD||'.tmp/world-app-home-tutor-20261011/world');
 const config=JSON.parse(fs.readFileSync(path.join(payload,'world-config.json'),'utf8')).account;
 const out=path.resolve('experiences/synk-world-app/qa/home-tutor-20261011',process.env.SYNK_HOME_TUTOR_STATIC_RUN||'account');fs.mkdirSync(out,{recursive:true});
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.mp4':'video/mp4','.wav':'audio/wav','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname.slice(7))||'index.html',standalone=name==='brand-opening/home.html';
  const file=standalone?path.resolve('experiences/brand-opening/home.html'):path.resolve(payload,name),rel=path.relative(payload,file);
  if(!u.pathname.startsWith('/world/')||!standalone&&(rel.startsWith('..')||path.isAbsolute(rel))||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const state=emptyPlayState(),wallet=JSON.stringify(state.wallet),commands=new Map(),checks=[],calls=[],errors=[],assets=[],outside=[];
 let revision=0,browser,context,page,failure,releaseRead,holdRead=true;
 const readGate=new Promise(resolve=>releaseRead=resolve),check=(name,value)=>{assert.ok(value,name);checks.push(name);};
 const home=()=>page.evaluate(()=>window.__synkHome.homeTutor()),read=()=>page.evaluate(()=>window.__synkWorld.life());
 const snapshot={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[],activeRun:null};
 async function newContext({signedIn=true,corruptGuest=false}={}){
  context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(15000);
  await context.addInitScript(({account,signedIn,corruptGuest})=>{
   if(!location.pathname.startsWith('/world/'))return;
   if(signedIn)sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-home-tutor-static',refresh_token:null,expires_at:Date.now()+3600000}));
   localStorage.setItem('synk-world-v1-welcomed','1');
   localStorage.setItem('synk.world.tutor.v1:guest',JSON.stringify({version:1,completed:true,tutor:'marin'}));
   localStorage.setItem('synk.world.tutor.v1:'+account,JSON.stringify({version:1,completed:true,tutor:'kkamong'}));
   if(corruptGuest)localStorage.setItem('synk.life-korean.progress.v1:guest','unreadable synthetic history');
  },{account:A,signedIn,corruptGuest});
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());if(u.origin===base)return route.continue();
   if(u.origin!==new URL(config.accountApiUrl).origin){outside.push(u.pathname);return route.abort();}
   const body=request.postDataJSON();calls.push({path:u.pathname,action:body?.action||null});let data;
   if(u.pathname.endsWith('/synk-account'))data={ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[]};
   else if(u.pathname.endsWith('/synk-world-v1/bootstrap'))data=snapshot;
   else if(u.pathname==='/auth/v1/logout')data={};
   else if(u.pathname.endsWith('/synk-play')){
    if(body){assert.equal(body.action,'progress');if(commands.has(body.id))data=commands.get(body.id);else{
     for(const change of body.changes){assert.equal(change.key,LIFE);assert.equal(change.previous,state.records[change.key]??null);state.records[change.key]=change.value;}
     data={ok:true,scope:'synk-play',accountId:A,revision:++revision,state:structuredClone(state)};commands.set(body.id,data);
    }}else{if(holdRead)await readGate;data={ok:true,scope:'synk-play',accountId:A,revision,state:structuredClone(state)};}
   }else{outside.push(u.pathname);return route.abort();}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)assets.push({path:new URL(r.url()).pathname,status:r.status()});});
 }
 async function closeContext(){if(page&&!page.isClosed()){await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank').catch(()=>{});}await context?.close();context=null;page=null;}
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});await newContext();
  await page.goto(base+'/world/mobile.html?opening=off',{waitUntil:'commit'});
  await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.owner==='11111111-1111-4111-8111-111111111111'&&window.__synkHome.homeTutor().recommendation.kind==='loading');
  check('account history loading hides memory claims and disables the home action',await page.locator('#home-tutor .home-tutor-action').isDisabled()&&!(await home()).recommendation.id);
  holdRead=false;releaseRead();
  await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='start');
  check('account choice overrides the different guest tutor on the home itself',(await home()).tutor==='kkamong');
  check('first visit suggests a real first lesson without inventing a previous confusion',!(await home()).recommendation.id&&(await home()).recommendation.title===lessonById('greetings-expressions').title);
  await page.locator('#home-tutor .home-tutor-action').click();await page.locator('[data-life-begin]').click();
  while(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();
  const q=lessonById('greetings-expressions').questions[0],wrong=q.choices.find(c=>c.id!==q.answerId).id;
  await page.locator(`[data-life-choice="${wrong}"]`).click();
  await page.waitForFunction(()=>document.querySelector('.life-save-status')?.dataset.savePhase==='synced');
  await page.locator('#panel-close').click();
  check('an actual first wrong answer becomes today\'s matching expression recommendation',(await home()).recommendation.id===q.id&&(await home()).recommendation.kind==='difficult'&&(await read()).progress.lessons['greetings-expressions'].answers[q.id].correct===false);
  await page.screenshot({path:path.join(out,'account-home-memory.png')});
  const checkpoint=(await read()).progress,writeCount=calls.filter(c=>c.action).length;
  await page.reload();await page.waitForFunction(id=>window.__synkHome?.homeTutor()?.recommendation.id===id,q.id);
  check('reload restores the chosen tutor and the same remembered expression from account progress',(await home()).tutor==='kkamong'&&JSON.stringify((await read()).progress)===JSON.stringify(checkpoint));
  await page.locator('#home-tutor .home-tutor-action').click();
  check('home action opens the canonical transfer directly without opening the lesson panel',await page.locator('.life-expression-question h4').textContent()===q.review.prompt&&!await page.locator('#world-panel').evaluate(el=>el.open));
  await page.locator(`[data-expression-choice="${q.review.choices.find(c=>c.id!==q.review.answerId).id}"]`).click();
  check('wrong guided response keeps the practice available with the chosen tutor reaction',await page.locator('.life-expression-practice').getAttribute('data-correct')==='false'&&await page.locator('.life-expression-return').isDisabled());
  await page.locator(`[data-expression-choice="${q.review.answerId}"]`).click();await page.waitForFunction(()=>window.__synkLife.summary().status.phase==='synced');
  const guided=(await read()).progress,stored=JSON.parse(state.records[LIFE]),day=Object.values(stored.daily?.days||{}).map(day=>day.items[q.id]).find(item=>item?.guidedAt);
  check('guided success is account-saved at the successful choice before leaving practice',day?.tutorId==='kkamong'&&day.lessonId==='greetings-expressions'&&day.outcome==='retry'&&JSON.stringify(stored)===JSON.stringify(guided)&&await page.locator('.life-expression-practice[open]').count()===1);
  await page.locator('.life-expression-return').click();
  check('guided success returns to a celebrating home without replacing the original first response',(await home()).completed===q.id&&(await home()).companion.kind==='practiceSuccess'&&core((await read()).progress)===core(checkpoint)&&core(stored)===core(checkpoint));
  check('guided completion adds one life progress write without any mastery or wallet mutation',calls.filter(c=>c.action).length===writeCount+1&&JSON.stringify(state.wallet)===wallet&&calls.filter(c=>c.action).every(c=>c.action==='progress'));
  await page.screenshot({path:path.join(out,'account-home-success.png')});
  await page.locator('[data-view=me]').first().click();await page.locator('[data-world=logout]').click();await page.waitForFunction(()=>window.__synkWorld.life()?.owner==='guest');
  if(await page.locator('[data-world=guest]').count())await page.locator('[data-world=guest]').click();
  check('logout restores the guest tutor without account memory, celebration or practice',(await home()).owner==='guest'&&(await home()).tutor==='marin'&&(await home()).recommendation.kind==='start'&&!(await home()).completed&&!(await home()).recommendation.id&&await page.locator('.life-expression-practice').count()===0);
  await page.goto(base+'/world/brand-opening/home.html?opening=off');await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='start');
  check('standalone home loads the same bundled guest recommendation before any lesson is opened',(await home()).tutor==='marin'&&await page.evaluate(()=>!!window.__synkLife)&&!await page.locator('#world-panel').evaluate(el=>el.open));
  await page.screenshot({path:path.join(out,'standalone-first-home.png')});
  await closeContext();await newContext({signedIn:false,corruptGuest:true});
  await page.goto(base+'/world/brand-opening/home.html?opening=off');await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='unavailable');
  check('standalone unreadable history shows connection guidance without a false memory or practice',(await home()).tutor==='marin'&&!(await home()).recommendation.id&&await page.locator('#home-tutor .home-tutor-action').textContent()==='연결 상태 보기');
  check('unreadable guest source remains byte-for-byte intact',await page.evaluate(()=>localStorage.getItem('synk.life-korean.progress.v1:guest'))==='unreadable synthetic history');
  await closeContext();state.records[LIFE]=JSON.stringify({version:999,owner:A});await newContext();
  await page.goto(base+'/world/mobile.html?opening=off');await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.owner==='11111111-1111-4111-8111-111111111111'&&window.__synkHome.homeTutor().recommendation.kind==='unavailable');
  check('unreadable account history cannot become an invented home recommendation',(await home()).tutor==='kkamong'&&!(await home()).recommendation.id&&state.records[LIFE]===JSON.stringify({version:999,owner:A}));
  check('home modules, tutor images, bundle and fonts resolve beneath the frozen /world mount',!errors.length&&!assets.length&&!outside.length);
 }catch(error){failure=error;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{
  releaseRead();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,payload,at:new Date().toISOString(),checks,calls,errors,assets,outside,...(failure?{failure:failure.stack}:{}),scope:{frozenStatic:true,standaloneHtml:'source',syntheticAccount:true,realOAuth:false,remoteDatabase:false,published:false}},null,2)+'\n');
  await closeContext();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 }
});
