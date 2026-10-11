const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {finishPractice}=require('./practice-browser-helpers.cjs');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4314',output=path.join(__dirname,'tutor-hints-20261010');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],httpErrors=[],external=[];let browser,page;
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail?{detail}:{})});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name);}
async function shot(name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(output,name+'.png')});}
async function choose(id){await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();await page.locator('[data-tutor-action="finish"]').click();}
async function setup(tutor,viewport={width:390,height:844}){
 const ctx=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:true,reducedMotion:'reduce'});
 ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))httpErrors.push({url:r.url(),status:r.status()});});});
 await ctx.route('**/*',r=>{const url=r.request().url();if(url.startsWith(base)||/^(data|blob):/.test(url))return r.continue();external.push(url);return r.abort();});
 await ctx.addInitScript(()=>{window.__reviewClips=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(!window.__reviewClips.includes(this))window.__reviewClips.push(this);return play.call(this);};});
 page=await ctx.newPage();await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);await choose(tutor);return ctx;
}
async function close(){if(await page.locator('.game-tutor-guide[open]').count())await page.locator('.game-tutor-continue').click();if(await page.locator('#world-panel').evaluate(p=>p.open))await page.locator('#panel-close').click();}
async function open(game){
 await close();await page.locator('[data-view="play"]').click();await page.locator(`[data-game="${game}"]`).click();await page.locator('.tutor-practice[open]').waitFor();
 await page.locator('.game-frame').evaluate((f,qa)=>{const u=new URL(f.src);u.searchParams.set('qa',qa);f.src=u.href;},game==='hangul'?'inspect':'1');
 await finishPractice(page);const frame=page.frameLocator('.game-frame');await frame.locator(game==='hangul'?'#session:not([hidden])':'#game:not([hidden])').waitFor();if(game!=='hangul')await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');return frame;
}
const difficulties=()=>page.evaluate(()=>window.__synkGameTutor.metrics().difficulties);
async function help(){await page.locator('.game-tutor-help').click();await page.locator('.game-tutor-guide[open]').waitFor();}
async function review(entry,{launch=true}={}){
 await page.locator(`[data-support-type="${entry.type}"][data-support-id="${entry.id}"] .tutor-support-retry`).click();await page.locator('.tutor-review[open]').waitFor();
 if(entry.review.audio||entry.review.glyph){check('review choices wait for the actual recording',await page.locator('.tutor-review-option').first().isDisabled());await page.locator('.tutor-review-listen').click();await page.waitForFunction(()=>window.__synkGameTutor.metrics().review.heard);}
 const wrong=(entry.review.correct+1)%entry.review.options.length;await page.locator('.tutor-review-option').nth(wrong).tap();
 check('a guided wrong answer keeps the same exercise available',!await page.evaluate(()=>window.__synkGameTutor.metrics().review.correct));
 await page.locator('.tutor-review-option').nth(entry.review.correct).tap();check('the actual reviewed answer succeeds',await page.evaluate(()=>window.__synkGameTutor.metrics().review.correct));
 if(launch)await page.locator('.tutor-review-return').click();
}
async function readable(label){const b=await page.locator('.game-tutor-guide').evaluate(d=>({overflow:d.scrollWidth-d.clientWidth,buttons:[...d.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).map(b=>({w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))}));check(label+': no horizontal overflow',b.overflow<=1);check(label+': controls at least 44px',b.buttons.every(b=>b.w>=44&&b.h>=44),b.buttons);}
async function hangulWrong(frame){
 for(let i=0;i<20;i++){
  await frame.locator('#stage').evaluate(async n=>{while(n.inert)await new Promise(r=>setTimeout(r,40));});
  const step=await frame.locator('body').evaluate(()=>window.__hangulQA.step());
  if(step.kind==='reason'||step.kind==='meet'){await frame.locator('#dock .felt-cta').click();continue;}
  const item=step.item;
  if(['listen_pick','pair','teach'].includes(item.type)){
   await frame.locator('.speak').click();await frame.locator('.speak').evaluate(async b=>{while(b.classList.contains('playing'))await new Promise(r=>setTimeout(r,40));});
   const at=item.options.findIndex(o=>o.text!==item.target.text);await frame.locator('.options .opt').nth(at).click();return;
  }
  if(item.type==='see_pick'){
   const count=await frame.locator('body').evaluate(()=>window.__reviewClips.filter(c=>c.src.includes('/assets/voice/')).length);
   const at=item.options.findIndex(o=>o.text!==item.target.text);await frame.locator('.options .opt').nth(at).click();
   const heard=await frame.locator('body').evaluate(async (el,count)=>{const start=performance.now();for(;;){const voices=window.__reviewClips.filter(c=>c.src.includes('/assets/voice/')),clip=voices.at(-1);if(voices.length>count&&clip.ended)return true;if(performance.now()-start>12000)return false;await new Promise(r=>setTimeout(r,30));}},count);
   check('a selected Hangul sound actually ends before submission',heard);await frame.locator('#dock .felt-cta').click();return;
  }
  throw Error('Unexpected initial Hangul exercise: '+item.type);
 }throw Error('No Hangul exercise');
}
async function rhythmQuestion(frame,index,{correct=true,late=false,none=false}={}){
 const q=await frame.locator('body').evaluate((el,i)=>window.__rhythm.state().questions[i],index);
 await frame.locator('body').evaluate((el,t)=>window.__rhythm.seek(t),q.showTime-.05);
 const delivered=await frame.locator('body').evaluate(async (el,i)=>{const start=performance.now();while(window.__rhythm.state().questions[i].delivered!=='completed'&&performance.now()-start<15000)await new Promise(r=>setTimeout(r,40));const s=window.__rhythm.state();return {delivered:s.questions[i].delivered,paused:s.paused,time:s.time};},index);
 check('actual narration completes before the rhythm answer',delivered.delivered==='completed',delivered);
 if(!none){
  const lane=(correct?q.answer:q.answer==='O'?'X':'O')==='O'?0:1;
  await frame.locator('body').evaluate((el,t)=>window.__rhythm.seek(t),late?q.answerOpen+.1:q.time-.01);await frame.locator('#pad-'+lane).tap();
 }
 if(late||none)await frame.locator('body').evaluate((el,t)=>window.__rhythm.seek(t),q.closeTime+.1);
 await frame.locator('body').evaluate(async (el,i)=>{while(window.__rhythm.state().questions[i].state==='pending')await new Promise(r=>setTimeout(r,30));},index);
 return q;
}
(async()=>{try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 {
  const ctx=await setup('marin'),frame=await open('runner');
  await frame.locator('body').evaluate(()=>{window.__runner.plan(Array(16).fill('miss'));window.__runner.auto();window.__runner.fast(4);});
  await page.waitForFunction(()=>window.__synkGameTutor.metrics().difficulties.some(e=>e.type==='control'));
  await help();const entries=await difficulties();check('runner action failures are not labelled sentence wrong',entries.every(e=>e.type!=='language'));
  check('Marine hints retain the report voice',await page.locator('.tutor-support-item p').first().textContent().then(s=>s.includes('확인')&&!/[!?]/.test(s)));
  await readable('390px Marine');await shot('marin-control-hint');
  const entry=entries.find(e=>e.type==='control'),before=await frame.locator('body').evaluate(()=>({elapsed:window.__runner.state().elapsed,answers:JSON.stringify(window.__runner.state().answers)}));
  await page.locator(`[data-support-type="control"][data-support-id="${entry.id}"] .tutor-support-retry`).click();await page.locator('.tutor-practice[open]').waitFor();
  check('a missed action opens only that one rehearsal step',await page.evaluate(()=>window.__synkGameTutor.metrics().practice.steps.length===1&&window.__synkGameTutor.metrics().practice.targeted));
  await page.waitForTimeout(250);check('focused control rehearsal pauses the real game',before.elapsed===await frame.locator('body').evaluate(()=>window.__runner.state().elapsed));
  await finishPractice(page);await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');
  check('focused success marks only a guided rehearsal',await difficulties().then(es=>es.find(e=>e.id===entry.id&&e.type===entry.type).practised));
  check('control rehearsal keeps the original answer',before.answers===await frame.locator('body').evaluate(()=>JSON.stringify(window.__runner.state().answers)));
  await close();await page.goto(base+'/mobile.html?opening=off&hints=1');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);await page.locator('[data-view="play"]').click();await page.locator('[data-game="runner"]').click();await page.locator('.game-tutor').waitFor();
  check('recent difficulties restore after a fresh page load',await difficulties().then(es=>es.some(e=>e.id===entry.id&&e.practised)));await close();await ctx.close();
 }
 {
  const ctx=await setup('kkamong'),frame=await open('rhythm');
  const first=await rhythmQuestion(frame,0,{correct:true,late:true});await help();let entries=await difficulties();
  const only=entries.filter(e=>e.id.startsWith('t')&&e.answerCorrect);check('a correct O/X answer with a missed beat gets timing help',only.length>0&&only.every(e=>e.type==='timing'));
  check('the original sentence remains correct',await frame.locator('body').evaluate(()=>window.__rhythm.state().questions[0].correct));await shot('kkamong-correct-answer-missed-beat');
  const timing=only[0],timeBefore=await frame.locator('body').evaluate(()=>window.__rhythm.state().time);
  await page.locator(`[data-support-type="timing"][data-support-id="${timing.id}"] .tutor-support-retry`).click();await page.locator('.tutor-practice[open]').waitFor();
  check('a beat-only mistake rehearses timing without a new sentence',await page.evaluate(()=>{const p=window.__synkGameTutor.metrics().practice;return p.targeted&&p.steps.length===1&&p.steps[0].startsWith('beat-');}));
  await finishPractice(page);await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');
  check('timing rehearsal resumes the original track position',await frame.locator('body').evaluate((el,start)=>window.__rhythm.state().time>=start&&window.__rhythm.state().time<start+2,timeBefore));
  await rhythmQuestion(frame,1,{correct:false});await help();entries=await difficulties();const language=entries.find(e=>e.type==='language');
  check('an actual wrong O/X answer gets a sentence hint',!!language);check('Kkamong has its own embarrassed boastful hint',await page.locator(`[data-support-id="${language.id}"] p`).first().textContent().then(s=>s.includes('나도')&&s.includes('아니')));
  await shot('kkamong-language-hint');const before=await frame.locator('body').evaluate(()=>JSON.stringify({score:window.__rhythm.state().score,questions:window.__rhythm.state().questions}));
  await review(language,{launch:false});await shot('kkamong-language-rehearsed');
  check('guided sentence practice keeps the original score and verdict',before===await frame.locator('body').evaluate(()=>JSON.stringify({score:window.__rhythm.state().score,questions:window.__rhythm.state().questions})));
  await page.locator('.tutor-review-return').click();await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');
  check('guided review releases the iframe and resumes the same track',await page.locator('.game-frame').evaluate(f=>!f.inert));
  await rhythmQuestion(frame,2,{correct:false,late:true});await help();entries=await difficulties();
  const mixed=entries.filter(e=>e.review?.audio?.includes('q2')||e.id.includes('q2'));
  check('wrong sentence and missed beat retain both difficulties',mixed.some(e=>e.type==='language')&&mixed.some(e=>e.type==='timing'));
  await page.locator('.game-tutor-continue').click();await frame.locator('#resume-button').click();await rhythmQuestion(frame,3,{none:true});await help();
  check('no response is kept apart from a wrong sentence',await difficulties().then(es=>es.some(e=>e.type==='unanswered'&&e.id.includes('q3'))&&!es.some(e=>e.type==='language'&&e.id.includes('q3'))));
  await close();await ctx.close();
 }
 {
  const ctx=await setup('mongle'),frame=await open('hangul');await hangulWrong(frame);await page.waitForFunction(()=>window.__synkGameTutor.metrics().difficulties.length>0);await help();const entry=(await difficulties()).find(e=>e.type==='language');
  check('an actual heard Hangul mismatch gets sound/letter help',!!entry);check('Mongle uses curiosity and togetherness in its hint',await page.locator('.tutor-support-item p').first().textContent().then(s=>/[!?]/.test(s)&&s.includes('같이')));
  await shot('mongle-hangul-hint');const before=await frame.locator('body').evaluate(()=>JSON.stringify(window.__hangulQA.progress()));
  await review(entry,{launch:false});await shot('mongle-hangul-rehearsed');check('Hangul guided practice does not turn its original wrong answer into correct',before===await frame.locator('body').evaluate(()=>JSON.stringify(window.__hangulQA.progress())));
  await page.locator('.tutor-review-return').click();check('Hangul returns to its original item',await frame.locator('#dock .felt-cta').count()>0);
  await help();await page.locator(`[data-support-id="${entry.id}"] .tutor-support-retry`).click();await page.locator('.tutor-review-listen').click();await page.locator('.tutor-review-exit').click();
  check('closing during review stops the actual recording',await page.evaluate(()=>window.__reviewClips.every(c=>c.paused))&&await page.locator('.tutor-review').count()===0);await close();await ctx.close();
 }
 {
  const ctx=await setup('marin');await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="login-a"]').click();await page.waitForFunction(()=>window.__synkWorld.client.snapshot);
  await page.locator('[data-view="play"]').click();await page.locator('[data-world="play"]').click();await choose('kkamong');await finishPractice(page);
  for(const value of ['thanks','water','front']){await page.locator(`[data-world="answer"][data-option="${value}"]`).click();await page.locator('[data-world="next"]').click();}
  await page.locator('.world-review').waitFor();await page.locator('.world-review summary').click();await page.locator('[data-tutor-review="greeting"]').click();await help();const entry=(await difficulties()).find(e=>e.type==='language');
  check('first sentence hint uses the server-verified answer',entry?.review.options[entry.review.correct].startsWith('안녕하세요'));check('account tutor remains separate from the guest',await page.locator('.game-tutor').getAttribute('data-tutor')==='kkamong');
  const before=await page.locator('.world-review').textContent();await review(entry);check('first sentence review leaves the server completion unchanged',before===await page.locator('.world-review').textContent());await shot('first-sentence-hint');await close();
  await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="logout"]').click();await page.waitForFunction(()=>!window.__synkWorld.client.snapshot);
  await open('runner');check('account difficulties do not leak to the guest',await difficulties().then(es=>es.length===0));await close();await ctx.close();
 }
 check('no browser exceptions',errors.length===0,errors);check('no missing assets',httpErrors.length===0,httpErrors);check('no external or paid requests',external.length===0,external);
 fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({at:new Date().toISOString(),base,pass:checks.length,fail:0,checks,errors,httpErrors,external},null,2));console.log(`DONE ${checks.length} checks`);
 }catch(error){console.error(error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({at:new Date().toISOString(),error:String(error),checks,errors,httpErrors,external},null,2));throw error;}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
