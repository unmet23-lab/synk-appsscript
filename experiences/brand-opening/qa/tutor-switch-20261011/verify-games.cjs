const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {finishPractice}=require('../practice-browser-helpers.cjs');
const base='http://127.0.0.1:4314',out=path.join(__dirname,'games');fs.mkdirSync(out,{recursive:true});
const checks=[],errors=[],missing=[],external=[],blockedWrites=[],screens=[];let browser,context,page,currentId,roundIndex,models;
const check=(name,pass,detail)=>{checks.push({round:roundIndex,tutor:currentId,name,pass:!!pass,...(detail===undefined?{}:{detail})});console.log((pass?'PASS ':'FAIL ')+currentId+' '+name);assert.ok(pass,name);};
const metrics=()=>page.evaluate(()=>window.__synkGameTutor.metrics());
async function shot(name){const file=path.join(out,`${roundIndex}-${currentId}-${name}.png`);await page.locator('.game-tutor img,.game-tutor-guide img,.tutor-practice img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:file});screens.push(file);}
async function closePanel(){if(await page.locator('#world-panel').evaluate(p=>p.open))await page.locator('#panel-close').click();}
async function staleCheck(){const data=await page.evaluate(()=>({listeners:window.__switchProbe.listeners.size,old:window.__switchProbe.old.map(v=>({mutations:v.mutations,connected:v.element.isConnected,audioPlaying:v.audio.some(a=>!a.paused)}))}));check('disposed earlier game has no later face/text/audio activity',data.old.every(v=>!v.mutations&&!v.connected&&!v.audioPlaying),data);}
async function closeGame(){
 await page.evaluate(()=>{const p=window.__switchProbe,element=window.__synkGameTutor.element,row={element,mutations:0,audio:[...p.audio]};const observer=new MutationObserver(()=>row.mutations++);observer.observe(element,{subtree:true,attributes:true,childList:true,characterData:true});row.observer=observer;p.old.push(row);});
 await closePanel();await page.waitForTimeout(30);
 await page.evaluate(()=>window.__switchProbe.old.at(-1).mutations=0);
 check('closing game removes companion and game message listener',await page.evaluate(()=>!window.__synkGameTutor&&window.__switchProbe.listeners.size===0)&&await page.locator('.game-tutor[data-tutor-game],.tutor-practice,.game-frame').count()===0);
 await staleCheck();
}
async function choose(id){
 currentId=id;
 if(roundIndex){await closePanel();await page.locator('#settings-open').click();await page.locator('[data-tutor-open]').click();}
 await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();
 check('actual settings choice saved only for this guest',await page.evaluate(id=>window.__synkHome.tutor().owner==='guest'&&window.__synkHome.tutor().tutor===id&&JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor===id,currentId));
 await closePanel();await staleCheck();
}
async function assertFace(kind,label){
 const face=models.tutorFace(currentId,kind),profile=models.getTutor(currentId);
 await page.waitForFunction(({id,face})=>{const el=document.querySelector('.game-tutor[data-tutor-game]');return el?.dataset.tutor===id&&el.dataset.face===face;},{id:currentId,face});
 const actual=await page.locator('.game-tutor[data-tutor-game]').evaluate(el=>({id:el.dataset.tutor,face:el.dataset.face,body:el.querySelector('.game-tutor-body').src,src:el.querySelector('.game-tutor-face').src,line:el.querySelector('.game-tutor-line').textContent}));
 check(label+': exact new character face and base image',actual.id===currentId&&actual.face===face&&decodeURIComponent(actual.src).endsWith('/'+profile.images[face])&&decodeURIComponent(actual.body).endsWith('/'+profile.images.기본),actual);
 const bank=[...Array.from({length:12},(_,i)=>models.tutorLine(currentId,kind,i)),...(await metrics()).difficulties.map(entry=>models.supportLine(currentId,entry))];
 await page.waitForFunction(bank=>bank.includes(document.querySelector('.game-tutor[data-tutor-game] .game-tutor-line')?.textContent),bank);
 check(label+': exact authored new tutor wording',bank.includes(await page.locator('.game-tutor[data-tutor-game] .game-tutor-line').textContent()));
}
async function openGame(game,active){
 await page.locator('[data-view=play]').click();await page.locator(`[data-game=${game}]`).click();await page.locator(`.game-tutor[data-tutor-game=${game}]`).waitFor();
 await page.waitForTimeout(80);
 const practice=await page.locator('.tutor-practice[open]').count();
 check(game+': practice remains isolated by tutor and game',roundIndex===3?!practice:!!practice,{practice});
 if(practice){
  check(game+': demonstrated tutor is the newly selected character',await page.locator('.tutor-practice').getAttribute('data-tutor')===currentId);
  await finishPractice(page,{onStep:async state=>{const expected=models.practiceLine(currentId,game==='hangul'&&state.step==='listen'?'hangul':state.step);check(game+' practice '+state.step+': exact tutor directions',await page.locator('.practice-line').textContent()===expected);},onSuccess:async()=>{const face=models.tutorFace(currentId,'success'),profile=models.getTutor(currentId);check(game+': successful rehearsal uses new face',await page.locator('.tutor-practice').getAttribute('data-face')===face&&await page.locator('.tutor-practice .game-tutor-face').first().getAttribute('src').then(src=>decodeURIComponent(src).endsWith('/'+profile.images[face])));}});
 }
 if(!await page.locator('.game-tutor-guide[open]').count())await page.locator('.game-tutor[data-tutor-game] .game-tutor-help').click();
 await page.locator('.game-tutor-guide[open]').waitFor();
 const text=await page.locator('.game-tutor-guide').textContent(),guide=models.GAME_GUIDES[game];
 check(game+': three authored operation directions use selected tutor',guide.steps.every(s=>text.includes(s.text[currentId]))&&text.includes(models.tutorLine(currentId,'hint')));
 check(game+': one live game message listener',await page.evaluate(()=>window.__switchProbe.listeners.size===1));
 if(await page.locator('.game-tutor-sound').getAttribute('aria-pressed')==='false')await page.locator('.game-tutor-sound').click();
 if(active)await shot(game+'-guide');
 await page.locator('.game-tutor-continue').click();
 if(active)await page.locator('.game-frame').evaluate((frame,qa)=>{const u=new URL(frame.src);u.searchParams.set('qa',qa);frame.src=u.href;},game==='hangul'?'silent':'1');
 const frame=page.frameLocator('.game-frame');await frame.locator(`body[data-game-tutor=${currentId}]`).waitFor();
 check(game+': actual game frame receives new tutor identity',(await metrics()).tutor===currentId&&(await metrics()).game===game);
 await staleCheck();return frame;
}
async function hangulAnswer(frame,wrong){
 for(let i=0;i<20;i++){await frame.locator('#stage').evaluate(async el=>{while(el.inert)await new Promise(r=>setTimeout(r,50));});const step=await frame.locator('body').evaluate(()=>window.__hangulQA.step());if(['reason','meet'].includes(step.kind)){await frame.locator('#dock .felt-cta').click();continue;}const item=step.item;assert.ok(['listen_pick','pair','teach','see_pick'].includes(item.type));const n=item.options.findIndex(o=>wrong?o.text!==item.target.text:o.text===item.target.text);await frame.locator('.options .opt').nth(n).click();if(item.type==='see_pick')await frame.locator('#dock .felt-cta').click();return;}throw Error('No Hangul answer reached');
}
async function reaction(frame,game){
 if(game==='hangul'){
  await frame.locator('#start').click();await hangulAnswer(frame,true);await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='retry');await assertFace('retry',game+' actual wrong answer');await shot(game+'-retry');
  await frame.locator('#dock .felt-cta').click();await hangulAnswer(frame,false);await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='success');await assertFace('success',game+' actual right answer');await shot(game+'-success');
 }else if(game==='runner'){
  await frame.locator('body').evaluate(()=>{window.__runner.plan(['ok','miss','ok']);window.__runner.auto();window.__runner.fast(4);});await frame.locator('#start').click();
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='success',null,{timeout:40000});await assertFace('success','runner resolved mission');check('runner success is an actual completed mission',await frame.locator('body').evaluate(()=>window.__runner.state().answers[0]?.correct===true));await shot(game+'-success');
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='retry',null,{timeout:40000});await assertFace('retry','runner missed mission');check('runner retry is an actual missed mission',await frame.locator('body').evaluate(()=>window.__runner.state().answers[1]?.correct===false));await shot(game+'-retry');await frame.locator('body').evaluate(()=>window.__runner.fast(0));
 }else{
  await frame.locator('body').evaluate(()=>{window.__rhythm.plan(['wrong','right']);window.__rhythm.autoplay();});await frame.locator('#start-button').click();await frame.locator('body').evaluate(async()=>{while(window.__rhythm.state().loading)await new Promise(r=>setTimeout(r,50));window.__rhythm.seek(window.__rhythm.state().questions[0].showTime-.3);});
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='retry',null,{timeout:40000});await assertFace('retry','rhythm actual O/X wrong answer');check('rhythm wrong answer is judged by actual game',await frame.locator('body').evaluate(()=>{const q=window.__rhythm.state().questions[0];return q.state==='answered'&&!q.correct;}));await shot(game+'-retry');
  await frame.locator('body').evaluate(()=>window.__rhythm.seek(window.__rhythm.state().questions[1].showTime-.3));await frame.locator('body').evaluate(async()=>{while(window.__rhythm.state().questions[1].state==='pending')await new Promise(r=>setTimeout(r,50));});await page.waitForFunction(()=>['success','combo'].includes(window.__synkGameTutor.metrics().kind));const kind=(await metrics()).kind;await assertFace(kind,'rhythm actual O/X right answer');check('rhythm right answer is judged by actual game',await frame.locator('body').evaluate(()=>window.__rhythm.state().questions[1].correct));await shot(game+'-success');
 }
 check(game+': no reaction audio interrupts active game listening',!(await metrics()).reactionAudioPlaying);
 await page.locator('.game-tutor[data-tutor-game] .game-tutor-help').click();await page.locator('.game-tutor-guide[open]').waitFor();
 const entries=(await metrics()).difficulties;
 check(game+': real game difficulties are retained only by current tutor',entries.length>0&&await page.locator('.tutor-support-item').count()===entries.length);
 const hints=await page.locator('.tutor-support-item').allTextContents();check(game+': exact selected tutor hints',entries.every(e=>hints.some(t=>t.includes(models.supportLine(currentId,e)))));
 await page.waitForTimeout(2900);check(game+': reaction returns to approved base face',await page.locator('.game-tutor[data-tutor-game]').getAttribute('data-face')==='기본');
 await shot(game+'-hint');await page.locator('.game-tutor-continue').click();
}
(async()=>{
 models={...await import(pathToFileURL(path.resolve(__dirname,'../../game-tutor-lines.mjs'))),...await import(pathToFileURL(path.resolve(__dirname,'../../game-tutor-support.mjs'))),...await import(pathToFileURL(path.resolve(__dirname,'../../tutor-practice-lines.mjs')))};
 browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(20000);
 await context.route('**/*',route=>{const req=route.request(),url=req.url();if(!url.startsWith(base+'/')){external.push(url);return route.abort();}if(!['GET','HEAD'].includes(req.method())){blockedWrites.push({method:req.method(),url});return route.abort();}return route.continue();});
 await context.addInitScript(()=>{const p=window.__switchProbe={listeners:new Set(),old:[],audio:[],plays:[]};const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;EventTarget.prototype.addEventListener=function(type,fn,opts){if(this===window&&type==='message'&&String(fn).includes('acceptTutorEvent'))p.listeners.add(fn);return add.call(this,type,fn,opts);};EventTarget.prototype.removeEventListener=function(type,fn,opts){if(this===window&&type==='message')p.listeners.delete(fn);return remove.call(this,type,fn,opts);};const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.includes('/assets/tutors/')){if(!p.audio.includes(this))p.audio.push(this);p.plays.push({src:this.src,tutor:window.__synkHome?.tutor().tutor,phase:window.__synkGameTutor?.metrics().phase});}return play.call(this);};});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))missing.push({url:r.url(),status:r.status()});});
 let failure;
 try{
  await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);
  const sequence=['marin','kkamong','mongle','marin'];
  for(roundIndex=0;roundIndex<sequence.length;roundIndex++){await choose(sequence[roundIndex]);const activeGame=['hangul','runner','rhythm','hangul'][roundIndex];for(const game of ['hangul','runner','rhythm']){const active=game===activeGame;const frame=await openGame(game,active);if(active)await reaction(frame,game);await closeGame();}}
  await page.waitForTimeout(7000);await staleCheck();
  const audio=await page.evaluate(()=>window.__switchProbe.plays);check('reaction audio belongs to its selected mascot only',audio.length>0&&audio.every(p=>Object.values(models.getTutor(p.tutor).sounds).flat().some(file=>decodeURIComponent(p.src).endsWith('/'+file))),audio);check('no mascot reaction audio starts during active game',audio.every(p=>p.phase!=='playing'));
  check('no browser exceptions',errors.length===0,errors);check('no missing runtime assets',missing.length===0,missing);check('no external requests',external.length===0,external);check('no server writes',blockedWrites.length===0,blockedWrites);
 }catch(error){failure=error;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:!failure,at:new Date().toISOString(),base,scope:'One guest context, real settings choice sequence marin→kkamong→mongle→marin; all three game guides/practices each time; actual feedback sampled across Hangul, Runner, Rhythm and returned Marine Hangul. Runner/rhythm existing QA drivers send actions through real game judgment; Hangul uses actual option clicks. No synthetic tutor events.',checks,errors,missing,external,blockedWrites,screens,...(failure?{failure:failure.stack}:{})},null,2));
 await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await context.close();await browser.close();if(failure)throw failure;console.log(JSON.stringify({ok:true,passed:checks.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
