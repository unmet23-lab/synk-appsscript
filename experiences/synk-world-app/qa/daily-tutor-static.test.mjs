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

test('frozen /world daily tutor stores assisted practice and recap, resumes on a fresh visit and isolates owner history',{timeout:120000},async()=>{
 const payload=path.resolve(process.env.SYNK_DAILY_TUTOR_STATIC_PAYLOAD||'.tmp/world-app-daily-tutor-20261011/world');
 const config=JSON.parse(fs.readFileSync(path.join(payload,'world-config.json'),'utf8')).account;
 const out=path.resolve('experiences/synk-world-app/qa/daily-tutor-20261011',process.env.SYNK_DAILY_TUTOR_STATIC_QA_RUN||'account');fs.mkdirSync(out,{recursive:true});
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
   const clockNow=Date.now.bind(Date);Date.now=()=>clockNow()+(window.__dailyClockOffset||0);
   if(signedIn)sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-daily-tutor-static',refresh_token:null,expires_at:Date.now()+3600000}));
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
 async function saved(){
  const expected=(await read()).progress.revision,deadline=Date.now()+10000;
  while((JSON.parse(state.records[LIFE]||'{}').revision??-1)<expected){assert.ok(Date.now()<deadline,'account daily save was not acknowledged');await new Promise(resolve=>setTimeout(resolve,25));}
 }
 async function noOverflow(width){
  await page.setViewportSize({width,height:844});
  return page.evaluate(()=>{const dialog=document.querySelector('.home-day-recap[open]'),box=dialog?.getBoundingClientRect(),buttons=dialog?[...dialog.querySelectorAll('button')].filter(button=>!button.hidden&&button.getBoundingClientRect().height):[];
   return document.documentElement.scrollWidth<=innerWidth+1&&(!dialog||box.left>=-1&&box.right<=innerWidth+1&&dialog.scrollWidth<=dialog.clientWidth+1&&buttons.every(button=>{const r=button.getBoundingClientRect();return r.height>=44&&r.left>=-1&&r.right<=innerWidth+1;}));});
 }
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
  const checkpoint=(await read()).progress,first=checkpoint.lessons['greetings-expressions'].answers[q.id],spacing=structuredClone(checkpoint.reviews);
  check('guided exercise starts before the due time without an active regular review',checkpoint.activeReview===null&&spacing[q.review.id].dueAt>Date.now());
  await page.reload();await page.waitForFunction(id=>window.__synkHome?.homeTutor()?.recommendation.id===id,q.id);
  check('reload restores the chosen tutor and the same remembered expression from account progress',(await home()).tutor==='kkamong'&&JSON.stringify((await read()).progress)===JSON.stringify(checkpoint));
  await page.locator('#home-tutor .home-tutor-action').click();
  check('home action opens the canonical transfer directly without opening the lesson panel',await page.locator('.life-expression-question h4').textContent()===q.review.prompt&&!await page.locator('#world-panel').evaluate(el=>el.open));
  await page.locator(`[data-expression-choice="${q.review.choices.find(c=>c.id!==q.review.answerId).id}"]`).click();
  check('wrong guided response keeps the practice available with the chosen tutor reaction',await page.locator('.life-expression-practice').getAttribute('data-correct')==='false'&&await page.locator('.life-expression-return').isDisabled());
  await page.locator(`[data-expression-choice="${q.review.answerId}"]`).click();
  await page.waitForFunction(id=>window.__synkWorld?.life()?.progress?.daily?.days?.[new Date(Date.now()+9*3600000).toISOString().slice(0,10)]?.items?.[id]?.guidedAt>0,q.id);
  const dayKey=(await home()).days.date;await saved();
  check('guided success is persisted before the return button so a tab close cannot lose it',JSON.parse(state.records[LIFE]).daily.days[dayKey].items[q.id].guidedAt>0&&await page.locator('.life-expression-return').isEnabled());
  await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.days?.today?.together?.length===1);
  const guided=(await read()).progress;
  check('fresh visit recalls guided success but never replaces the immutable wrong first answer',JSON.stringify(guided.lessons['greetings-expressions'].answers[q.id])===JSON.stringify(first)&&JSON.stringify(guided.lessons)===JSON.stringify(checkpoint.lessons));
  check('guided memory preserves review spacing and the wallet',JSON.stringify(guided.reviews)===JSON.stringify(spacing)&&JSON.stringify(state.wallet)===wallet);
  check('fresh visit stops recommending the same guided expression as a new confusion',(await home()).recommendation.id!==q.id&&(await home()).days.today.together[0].id===q.id&&(await home()).days.today.independent.length===0);
  await page.locator('#home-tutor .home-tutor-day').click();await page.locator('.home-day-recap[open]').waitFor();
  check('the account recap names the chosen tutor and separates helped success from independent success',await page.locator('.home-day-tutor [data-tutor="kkamong"]').count()===1&&await page.locator('.home-day-content').textContent().then(text=>text.includes('함께 확인한 말')&&!text.includes('혼자 맞힌 말')));
  check('the recap and touch targets fit a 390 px account screen',await noOverflow(390));
  await page.screenshot({path:path.join(out,'account-recap-390.png')});
  check('the recap and touch targets fit a 320 px account screen',await noOverflow(320));
  await page.screenshot({path:path.join(out,'account-recap-320.png')});
  await page.locator('.home-day-finish').click();await page.waitForFunction(()=>document.querySelector('.home-day-recap')?.dataset.finished==='true');await saved();
  const closed=(await read()).progress;
  check('day completion is persisted to the account record with the tutor guided memory',JSON.parse(state.records[LIFE]).daily.days[dayKey].closedAt>=guided.daily.days[dayKey].items[q.id].guidedAt&&JSON.parse(state.records[LIFE]).daily.days[dayKey].items[q.id].tutorId==='kkamong');
  check('day completion preserves the lesson checkpoint and review appointments',JSON.stringify(closed.lessons)===JSON.stringify(checkpoint.lessons)&&JSON.stringify(closed.reviews)===JSON.stringify(spacing)&&closed.activeLessonId===checkpoint.activeLessonId);
  check('the finished recap disables duplicate completion',await page.locator('.home-day-finish').isDisabled()&&(await home()).days.today.closed);
  await page.locator('.home-day-close').click();await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.days?.today?.closed===true);
  check('account reload restores day completion and offers its recap',(await home()).tutor==='kkamong'&&await page.locator('#home-tutor .home-tutor-day').textContent()==='오늘 기록 다시 보기');
  await page.locator('#home-tutor .home-tutor-day').click();await page.locator('.home-day-recap[open]').waitFor();
  check('restored recap retains completion and no open expression practice',await page.locator('.home-day-recap').getAttribute('data-finished')==='true'&&await page.locator('.life-expression-practice').count()===0);
  await page.locator('.home-day-close').click();await page.setViewportSize({width:390,height:844});
  check('reload did not invent a pending regular review or help flag',(await read()).progress.activeReview===null);
  await page.evaluate(()=>{window.__dailyClockOffset=120000;});
  await page.locator('[data-view="review"]').click();await page.locator('[data-life-review-start]').click();
  await page.locator(`[data-life-choice="${q.review.answerId}"]`).click();await saved();
  const reviewed=(await read()).progress,reviewResult=reviewed.activeReview.answers[q.review.id];
  check('same-day guided exposure survives reload and marks the later regular correct answer as assisted',reviewResult.correct&&reviewResult.helped&&reviewed.reviews[q.review.id].streak===0&&reviewed.reviews[q.review.id].intervalDays===0);
  check('the regular review feedback and selected tutor agree with persisted assistance',(await read()).tutor.kind==='assisted'&&await page.locator('.life-feedback strong').textContent()==='함께 확인해요.');
  check('another study action reopens the completed day without changing the original lesson answer',!(await home()).days.today.closed&&JSON.stringify(reviewed.lessons['greetings-expressions'].answers[q.id])===JSON.stringify(first));
  await page.screenshot({path:path.join(out,'account-assisted-review-after-reload.png')});
  await page.locator('#panel-close').click();
  await page.locator('[data-view=me]').first().click();await page.locator('[data-world=logout]').click();await page.waitForFunction(()=>window.__synkWorld.life()?.owner==='guest');
  if(await page.locator('[data-world=guest]').count())await page.locator('[data-world=guest]').click();
  check('logout restores the guest tutor without account daily memory or an old recap',(await home()).owner==='guest'&&(await home()).tutor==='marin'&&(await home()).recommendation.kind==='start'&&!(await home()).completed&&!(await home()).recommendation.id&&(await home()).days.today.count===0&&!(await home()).recapOpen&&await page.locator('.home-day-recap').count()===0&&await page.locator('.life-expression-practice').count()===0);
  await page.goto(base+'/world/brand-opening/home.html?opening=off');await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='start');
  check('standalone home loads the same bundled empty guest day before any lesson is opened',(await home()).tutor==='marin'&&(await home()).days.today.count===0&&await page.evaluate(()=>!!window.__synkLife)&&!await page.locator('#world-panel').evaluate(el=>el.open));
  await page.screenshot({path:path.join(out,'standalone-first-home.png')});
  await closeContext();await newContext({signedIn:false,corruptGuest:true});
  await page.goto(base+'/world/brand-opening/home.html?opening=off');await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='unavailable');
  check('standalone unreadable history shows connection guidance without a false memory or recap',(await home()).tutor==='marin'&&!(await home()).recommendation.id&&await page.locator('#home-tutor .home-tutor-action').textContent()==='연결 상태 보기'&&await page.locator('.home-tutor-day').isHidden());
  check('unreadable guest source remains byte-for-byte intact',await page.evaluate(()=>localStorage.getItem('synk.life-korean.progress.v1:guest'))==='unreadable synthetic history');
  await closeContext();state.records[LIFE]=JSON.stringify({version:999,owner:A});await newContext();
  await page.goto(base+'/world/mobile.html?opening=off');await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.owner==='11111111-1111-4111-8111-111111111111'&&window.__synkHome.homeTutor().recommendation.kind==='unavailable');
  check('unreadable account history cannot become an invented daily recommendation or recap',(await home()).tutor==='kkamong'&&!(await home()).recommendation.id&&state.records[LIFE]===JSON.stringify({version:999,owner:A})&&await page.locator('.home-tutor-day').isHidden());
  check('home modules, tutor images, bundle and fonts resolve beneath the frozen /world mount',!errors.length&&!assets.length&&!outside.length);
 }catch(error){failure=error;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{
  releaseRead();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,payload,at:new Date().toISOString(),checks,calls,errors,assets,outside,...(failure?{failure:failure.stack}:{}),scope:{frozenStatic:true,standaloneHtml:'source',syntheticAccount:true,realOAuth:false,remoteDatabase:false,published:false}},null,2)+'\n');
  await closeContext();await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
 }
});
