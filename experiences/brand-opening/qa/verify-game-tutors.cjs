const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {finishPractice}=require('./practice-browser-helpers.cjs');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4314';
const output=process.env.SYNK_TUTOR_QA_OUTPUT||path.join(__dirname,'game-tutors-20261010');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],httpErrors=[],external=[];let browser;
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name);};
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.game-tutor img,.game-tutor-guide img')].every(i=>i.complete&&i.naturalWidth));await page.screenshot({path:path.join(output,name+'.png')});}
async function complete(page,id){await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();await page.locator('[data-tutor-action="finish"]').click();}
async function setup(id,viewport={width:390,height:844},reducedMotion='reduce'){
 const ctx=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:true,reducedMotion});
 ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))httpErrors.push({url:r.url(),status:r.status()});});});
 await ctx.route('**/*',r=>{const url=r.request().url();if(url.startsWith(base)||/^(data|blob):/.test(url))return r.continue();external.push(url);return r.abort();});
 await ctx.addInitScript(()=>{
  window.__tutorSound=[];const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.src.includes('/assets/tutors/'))window.__tutorSound.push({src:this.src,phase:document.querySelector('.game-tutor')?.dataset.phase});return play.call(this);};
 });
 const page=await ctx.newPage();await page.goto(base+'/mobile.html?opening=off&tutor=choose');
 await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);await complete(page,id);
 return {ctx,page};
}
async function closePanel(page){if(await page.locator('#world-panel').evaluate(p=>p.open))await page.locator('#panel-close').click();}
async function open(page,id,qa=false){
 await closePanel(page);await page.locator('[data-view="play"]').click();await page.locator(`[data-game="${id}"]`).click();
 await page.locator('.game-tutor').waitFor();if(await page.locator('.tutor-practice[open]').count())await finishPractice(page);
 await page.locator('.game-tutor-help').click();
 await page.locator('.game-tutor-guide[open]').waitFor();
 const tutor=await page.evaluate(()=>window.__synkGameTutor.metrics().tutor);
 const text=await page.locator('.game-tutor-guide').textContent();
 check(`${tutor}/${id}: actual character directions before play`,text.includes(id==='runner'?'길 바꾸기':id==='rhythm'?'끝까지 듣고':'소리부터')&&(tutor==='marin'?text.includes('수칙'):tutor==='kkamong'?text.includes('이 몸'):text.includes('같이')));
 if((tutor==='marin'&&id==='runner')||(tutor==='kkamong'&&id==='rhythm')||(tutor==='mongle'&&id==='hangul'))await shot(page,`${tutor}-${id}-guide`);
 if(qa&&await page.locator('.game-tutor-sound').getAttribute('aria-pressed')==='false')await page.locator('.game-tutor-sound').click();
 await page.locator('.game-tutor-continue').click();
 if(qa)await page.locator('.game-frame').evaluate((frame,value)=>{const url=new URL(frame.src);url.searchParams.set('qa',value);frame.src=url.href;},id==='hangul'?'silent':'1');
 const frame=page.frameLocator('.game-frame');
 await frame.locator(`body[data-game-tutor="${tutor}"]`).waitFor();
 check(`${tutor}/${id}: chosen companion reaches the real frame`,await page.locator('.game-tutor').getAttribute('data-tutor')===tutor);
 return frame;
}
async function waitReaction(page,kinds){await page.waitForFunction(ks=>ks.includes(window.__synkGameTutor?.metrics().kind),kinds,{timeout:30000});}
async function stablePause(page,frame,snapshot,button){
 await page.locator('.game-tutor-help').click();await page.locator('.game-tutor-guide[open]').waitFor();
 await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='paused');
 const before=await snapshot(frame);await page.waitForTimeout(300);const after=await snapshot(frame);
 check('help pauses the real clock while directions are open',before===after,{before,after});
 await page.locator('.game-tutor-continue').click();await frame.locator(button).click();
 await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');
 check('help returns to the same game and real resume button',true);
}
async function hangulAnswer(page,frame,wrong){
 for(let i=0;i<20;i++){
  await frame.locator('#stage').evaluate(async n=>{while(n.inert)await new Promise(r=>setTimeout(r,80));});
  const step=await frame.locator('body').evaluate(()=>window.__hangulQA.step());
  if(step.kind==='reason'||step.kind==='meet'){await frame.locator('#dock .felt-cta').click();continue;}
  const item=step.item;
  if(['listen_pick','pair','teach'].includes(item.type)){
   const idx=item.options.findIndex(o=>wrong?o.text!==item.target.text:o.text===item.target.text);
   await frame.locator('.options .opt').nth(idx).click();return;
  }
  if(item.type==='see_pick'){
   const idx=item.options.findIndex(o=>wrong?o.text!==item.target.text:o.text===item.target.text);
   await frame.locator('.options .opt').nth(idx).click();await frame.locator('#dock .felt-cta').click();return;
  }
  throw Error('Unexpected early Hangul item: '+item.type);
 }
 throw Error('No Hangul answer reached');
}
(async()=>{
 browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const tutor of ['marin','kkamong','mongle']){
   const {ctx,page}=await setup(tutor);
   for(const game of ['runner','rhythm','hangul']){
    const active=(tutor==='marin'&&game==='runner')||(tutor==='kkamong'&&game==='rhythm')||(tutor==='mongle'&&game==='hangul');
    const frame=await open(page,game,active);
    if(!active)continue;
    const bodySrc=await page.locator('.game-tutor .game-tutor-body').getAttribute('src');
    if(game==='runner'){
     await frame.locator('body').evaluate(()=>{window.__runner.plan(['ok','miss','ok','ok','ok','ok','ok','ok','ok','ok']);window.__runner.auto();window.__runner.fast(4);});
     await frame.locator('#start').click();
     await waitReaction(page,['success']);check('runner success comes from a resolved real mission',await frame.locator('body').evaluate(()=>window.__runner.state().answers[0]?.correct===true));
     check('runner pauses enabled reaction audio during active listening play',await page.evaluate(()=>window.__synkGameTutor.metrics().sound&&!window.__synkGameTutor.metrics().reactionAudioPlaying));
     await shot(page,'marin-runner-success');
     await waitReaction(page,['retry']);check('runner retry comes from the next actual missed mission',await frame.locator('body').evaluate(()=>window.__runner.state().answers[1]?.correct===false));await shot(page,'marin-runner-retry');
     const controls=await frame.locator('#moves').evaluate(n=>{const r=n.getBoundingClientRect();return {bottom:r.bottom,width:r.width,height:innerHeight};});
     check('390px runner controls stay in the frame',controls.bottom<=controls.height+1,controls);
     await stablePause(page,frame,f=>f.locator('body').evaluate(()=>window.__runner.state().elapsed),'#resume');
     await frame.locator('body').evaluate(()=>window.__runner.fast(12));
     await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='results');await shot(page,'marin-runner-finish');
     await frame.locator('#result-listening-check').click();
     await frame.locator('body').evaluate(async()=>{while(window.__runner.check()?.audio!=='completed')await new Promise(r=>setTimeout(r,100));});
     check('separate listening check keeps reaction audio quiet during its actual recording',await page.evaluate(()=>window.__synkGameTutor.metrics().phase==='playing'&&!window.__synkGameTutor.metrics().reactionAudioPlaying));
     const checkItem=await frame.locator('body').evaluate(()=>window.__runner.check());
     await frame.locator('#check-choices button').nth((checkItem.correct+1)%3).click();await waitReaction(page,['retry']);
     check('separate listening check responds to its actual wrong answer',await frame.locator('body').evaluate(()=>window.__runner.check().answered&&window.__runner.check().rightCount===0));await shot(page,'marin-listening-check-retry');
     await frame.locator('#check-next').click();await frame.locator('body').evaluate(async()=>{while(window.__runner.check()?.audio!=='completed')await new Promise(r=>setTimeout(r,100));});
     const nextCheck=await frame.locator('body').evaluate(()=>window.__runner.check());await frame.locator('#check-choices button').nth(nextCheck.correct).click();await waitReaction(page,['success']);
     check('separate listening check responds to its actual correct answer',await frame.locator('body').evaluate(()=>window.__runner.check().rightCount===1));
     await frame.locator('#check-close').click();
    }else if(game==='rhythm'){
     await frame.locator('body').evaluate(()=>{window.__rhythm.plan(['wrong','right','none','right','right']);window.__rhythm.autoplay();});
     await frame.locator('#start-button').click();await frame.locator('body').evaluate(async()=>{while(window.__rhythm.state().loading)await new Promise(r=>setTimeout(r,100));window.__rhythm.seek(window.__rhythm.state().questions[0].showTime-.3);});
     await waitReaction(page,['retry']);check('rhythm retry uses an actual wrong O/X answer',await frame.locator('body').evaluate(()=>{const q=window.__rhythm.state().questions[0];return q.state==='answered'&&!q.correct;}));await shot(page,'kkamong-rhythm-retry');
     await frame.locator('body').evaluate(()=>window.__rhythm.seek(window.__rhythm.state().questions[1].showTime-.3));
     await frame.locator('body').evaluate(async()=>{while(window.__rhythm.state().questions[1].state==='pending')await new Promise(r=>setTimeout(r,100));});
     await waitReaction(page,['success','combo']);check('rhythm success uses an actual right O/X answer',await frame.locator('body').evaluate(()=>window.__rhythm.state().questions[1].correct));await shot(page,'kkamong-rhythm-success');
     check('rhythm pauses enabled reaction audio during active listening play',await page.evaluate(()=>window.__synkGameTutor.metrics().sound&&!window.__synkGameTutor.metrics().reactionAudioPlaying));
     await stablePause(page,frame,f=>f.locator('body').evaluate(()=>window.__rhythm.state().time),'#resume-button');
     await frame.locator('body').evaluate(()=>window.__rhythm.seek(window.__rhythm.state().duration-.1));
     await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='results');
     check('rhythm finish stays with chosen Kkamong',await page.locator('.game-tutor').getAttribute('data-tutor')==='kkamong');
    }else{
     await frame.locator('#start').click();await hangulAnswer(page,frame,true);await waitReaction(page,['retry']);await shot(page,'mongle-hangul-retry');
     check('Hangul wrong selection changes face without changing body',await page.locator('.game-tutor').getAttribute('data-face')==='민망'&&await page.locator('.game-tutor .game-tutor-body').getAttribute('src')===bodySrc);
     await frame.locator('#dock .felt-cta').click();await hangulAnswer(page,frame,false);await waitReaction(page,['success']);await shot(page,'mongle-hangul-success');
     check('Hangul pauses enabled reaction audio during active listening play',await page.evaluate(()=>window.__synkGameTutor.metrics().sound&&!window.__synkGameTutor.metrics().reactionAudioPlaying));
     const before=await frame.locator('body').evaluate(()=>window.__hangulQA.step().item.id);
     await page.locator('.game-tutor-help').click();await page.locator('.game-tutor-guide[open]').waitFor();await page.locator('.game-tutor-continue').click();
     check('Hangul directions preserve the current untimed exercise',await frame.locator('body').evaluate(()=>window.__hangulQA.step().item.id)===before);
    }
    check(`${game}: reaction swaps only the face, retaining the approved body`,await page.locator('.game-tutor .game-tutor-body').getAttribute('src')===bodySrc);
    check(`${game}: reduced motion retains expression and dialogue`,await page.locator('.game-tutor').getAttribute('data-reduced')==='true'&&(await page.locator('.game-tutor-line').textContent()).length>0);
   }
   await closePanel(page);
   check(`${tutor}: closing removes companion and reaction resources`,await page.evaluate(()=>!window.__synkGameTutor)&&await page.locator('.game-tutor,.game-tutor-guide').count()===0);
   check(`${tutor}: enabled mascot sound is used outside active play`,await page.evaluate(()=>window.__tutorSound.length>0));
   check(`${tutor}: no mascot sound starts during active play`,await page.evaluate(()=>window.__tutorSound.every(e=>e.phase!=='playing')));
   await ctx.close();
  }
  // Browser sizes check both initial guide and real running controls.
  for(const viewport of [{width:320,height:668},{width:740,height:320},{width:844,height:390},{width:1440,height:900}]){
   const {ctx,page}=await setup('marin',viewport);const frame=await open(page,'runner',true);
   await frame.locator('#start').click();await frame.locator('body').evaluate(async()=>{while(!window.__runner.state().running)await new Promise(r=>setTimeout(r,50));});
   const layout=await frame.locator('#moves').evaluate(n=>{const r=n.getBoundingClientRect();return {bottom:r.bottom,height:innerHeight,width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth};});
   check(`${viewport.width}x${viewport.height}: running controls fit with companion`,layout.bottom<=layout.height+1&&layout.overflow<=1,layout);
   await shot(page,`runner-${viewport.width}x${viewport.height}`);await ctx.close();
  }
  const {ctx,page}=await setup('marin');
  await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="login-a"]').click();await page.waitForFunction(()=>window.__synkWorld.client.snapshot);
  await page.locator('[data-view="play"]').click();await page.locator('[data-world="play"]').click();await complete(page,'kkamong');
  await finishPractice(page);
  check('first sentence uses the isolated signed-in tutor, not the guest',await page.locator('.game-tutor').getAttribute('data-tutor')==='kkamong');
  for(const option of ['thanks','water','front']){await page.locator(`[data-world="answer"][data-option="${option}"]`).click();check('first sentence acknowledges selection without inventing correctness',await page.evaluate(()=>window.__synkGameTutor.metrics().kind==='picked'));await page.locator('[data-world="next"]').click();}
  await page.locator('.world-review').waitFor();await page.locator('.world-review summary').click();
  await page.locator('[data-tutor-review="greeting"]').click();await waitReaction(page,['retry']);await shot(page,'kkamong-first-verified-retry');
  check('first sentence retry follows the server-verified wrong answer',await page.locator('[data-tutor-review="greeting"]').textContent().then(t=>t.includes('어려웠던')));
  await page.locator('[data-tutor-review="water"]').click();await waitReaction(page,['success']);
  check('first sentence praise follows the server-verified correct answer',await page.locator('[data-tutor-review="water"]').textContent().then(t=>t.includes('맞힌')));
  await closePanel(page);await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="logout"]').click();await page.waitForFunction(()=>window.__synkWorld.client.snapshot===null);
  check('logout restores the guest choice after game completion',await page.evaluate(()=>window.__synkHome.tutor().tutor==='marin'));await ctx.close();
  const motion=await setup('kkamong',{width:390,height:844},'no-preference');const motionFrame=await open(motion.page,'hangul',true);
  await motionFrame.locator('#start').click();await hangulAnswer(motion.page,motionFrame,false);await waitReaction(motion.page,['success']);
  check('normal motion uses the selected dragon reaction animation',await motion.page.locator('.game-tutor').evaluate(n=>n.dataset.reduced==='false'&&n.getAnimations({subtree:true}).length>0));
  await motion.page.locator('#panel-close').click();check('closing during a reaction releases its companion',await motion.page.evaluate(()=>!window.__synkGameTutor));await motion.ctx.close();
  check('no browser exceptions',errors.length===0,errors);check('no missing runtime assets',httpErrors.length===0,httpErrors);check('no external or paid AI requests',external.length===0,external);
  fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({base,checks,errors,httpErrors,external,passed:checks.length,at:new Date().toISOString()},null,2));
 }finally{await browser?.close();}
})().catch(error=>{fs.writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({error:String(error),checks,errors,httpErrors,external},null,2));console.error(error);process.exitCode=1;});
