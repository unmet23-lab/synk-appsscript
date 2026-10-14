const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {finishPractice}=require('./practice-browser-helpers.cjs');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4314';
const output=path.join(__dirname,'tutor-practice-20261010');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],httpErrors=[],external=[];let browser,page;
function check(name,pass,detail){checks.push({name,pass:!!pass,...(detail?{detail}:{})});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,name);}
async function shot(name){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.tutor-practice img')].every(i=>i.complete&&i.naturalWidth));await page.screenshot({path:path.join(output,name+'.png')});}
async function choose(tutor){await page.locator(`[data-tutor-id="${tutor}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();await page.locator('[data-tutor-action="finish"]').click();}
async function context(tutor,{viewport={width:390,height:844},motion='reduce'}={}){
 const ctx=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:true,reducedMotion:motion});
 ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))httpErrors.push({url:r.url(),status:r.status()});});});
 await ctx.route('**/*',r=>{const url=r.request().url();if(url.startsWith(base)||/^(data|blob):/.test(url))return r.continue();external.push(url);return r.abort();});
 await ctx.addInitScript(()=>{
  window.__practiceAudio=[];const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.src.includes('/assets/voice/')||this.src.includes('/assets/narration/')){const event={url:this.src,ended:false};window.__practiceAudio.push(event);this.addEventListener('ended',()=>event.ended=true,{once:true});}return play.call(this);};
 });
 page=await ctx.newPage();await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);await choose(tutor);return ctx;
}
async function close(){if(await page.locator('#world-panel').evaluate(p=>p.open))await page.locator('#panel-close').click();}
async function open(game,qa=true){
 await close();await page.locator('[data-view="play"]').click();await page.locator(`[data-game="${game}"]`).click();
 await page.locator('.tutor-practice[open]').waitFor();
 if(qa)await page.locator('.game-frame').evaluate((frame,value)=>{const url=new URL(frame.src);url.searchParams.set('qa',value);frame.src=url.href;},game==='hangul'?'silent':'1');
 return page.frameLocator('.game-frame');
}
async function bounds(label){
 const b=await page.locator('.tutor-practice').evaluate(d=>({overflow:d.scrollWidth-d.clientWidth,rect:{width:d.getBoundingClientRect().width,height:d.getBoundingClientRect().height},buttons:[...d.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>0).map(b=>({text:b.textContent.trim(),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))}));
 check(label+': no horizontal overflow',b.overflow<=1,b);
 check(label+': all visible controls at least 44px',b.buttons.every(b=>b.w>=44&&b.h>=44),b.buttons);
}
async function actualPlaying(game,frame){
 await frame.locator(game==='hangul'?'#session:not([hidden])':'#game:not([hidden])').waitFor();
 await page.waitForFunction(()=>window.__synkGameTutor.metrics().phase==='playing');
 if(game==='runner')check('completion starts the actual runner',await frame.locator('body').evaluate(()=>window.__runner.state().running));
 if(game==='rhythm')check('completion starts the actual rhythm clock',await frame.locator('body').evaluate(()=>window.__rhythm.state().screen==='game'&&!window.__rhythm.state().paused));
 if(game==='hangul')check('completion starts the actual Hangul session',await frame.locator('#dock button').count()>0);
}
(async()=>{try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const tutor of ['marin','kkamong','mongle']){
  const ctx=await context(tutor);
  for(const game of ['runner','rhythm','hangul']){
   const frame=await open(game);const label=`${tutor}/${game}`;
   check(label+': selected tutor leads the demonstration',await page.locator('.tutor-practice').getAttribute('data-tutor')===tutor);
   check(label+': game remains behind the practice',await page.locator('.game-frame').evaluate(f=>f.inert));
   if((tutor==='marin'&&game==='runner')||(tutor==='kkamong'&&game==='rhythm')||(tutor==='mongle'&&game==='hangul')){await bounds(label);await shot(`${tutor}-${game}-demo`);}
   await finishPractice(page,{input:tutor==='marin'?'keyboard':'touch',launch:false,onStep:async s=>{
    if(s.index===0){
     const line=await page.locator('.practice-line').textContent();check(label+': character speech reaches the hands-on turn',tutor==='marin'?/확인|수칙|…/.test(line)&&!/[!?]/.test(line):tutor==='kkamong'?/이 몸|내|나도/.test(line):/같이/.test(line)&&/[!?]/.test(line));
     const wrong=game==='hangul'?'eo':'right';await page.locator(`[data-practice-input="${wrong}"]`).tap();
     check(label+': wrong control cannot advance',(await page.evaluate(()=>window.__synkGameTutor.metrics().practice)).phase==='try');
     check(label+': retry has a real approved face',await page.locator('.tutor-practice').getAttribute('data-face')===(tutor==='marin'?'집중':'민망'));
     if(tutor==='mongle'&&game==='hangul')await shot('mongle-hangul-retry');
    }
    if(s.step==='beat'){
     await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice.cueInMs>600);
     await page.locator('[data-practice-input="left"]').tap();
     check(label+': early O needs the actual line timing',(await page.evaluate(()=>window.__synkGameTutor.metrics().practice)).phase==='try');
    }
    if(s.heard)check(label+': real MP3 ends before input opens',await page.evaluate(()=>window.__practiceAudio.some(x=>x.ended)));
   },onSuccess:async s=>{
    if(s.index===0){check(label+': success expression matches the tutor',await page.locator('.tutor-practice').getAttribute('data-face')===({marin:'눈웃음',kkamong:'으쓱',mongle:'기쁨'})[tutor]);if(game==='runner')await shot(`${tutor}-runner-success`);}
   }});
   check(label+': all steps must be completed before game start',await page.evaluate(()=>window.__synkGameTutor.metrics().practice.complete));
   check(label+': completion is not saved before the final start',await page.evaluate(({tutor,game})=>localStorage.getItem(`synk.world.tutor.practice.v1:guest:${tutor}:${game}`)===null,{tutor,game}));
   if(tutor==='marin'&&game==='runner')await shot('marin-runner-ready');
   await page.locator('.practice-primary').click();await actualPlaying(game,frame);
   check(label+': completion is saved for this owner and game',await page.evaluate(({tutor,game})=>JSON.parse(localStorage.getItem(`synk.world.tutor.practice.v1:guest:${tutor}:${game}`)).completed,{tutor,game}));
   check(label+': training is disposed and game controls regain focus',await page.locator('.tutor-practice').count()===0&&await page.locator('.game-frame').evaluate(f=>!f.inert));
   if(tutor==='marin'&&game==='runner'){
    await page.locator('.game-tutor-help').click();await page.locator('.game-tutor-practice').click();
    await frame.locator('#pause-dialog[open]').waitFor();
    const before=await frame.locator('body').evaluate(()=>window.__runner.state().elapsed);await page.waitForTimeout(300);
    check('rehearsing again pauses the actual runner clock',before===await frame.locator('body').evaluate(()=>window.__runner.state().elapsed));
    await finishPractice(page,{input:'keyboard'});await actualPlaying(game,frame);
    check('finishing repeated practice continues the same runner round',await frame.locator('body').evaluate((el,start)=>window.__runner.state().elapsed>=start, before));
   }
   await close();
  }
  // Persisted completion skips practice on the next entry.
  await page.locator('[data-view="play"]').click();await page.locator('[data-game="runner"]').click();
  await page.locator('.game-tutor').waitFor();await page.waitForTimeout(250);
  check(tutor+': a completed rehearsal is remembered',await page.locator('.tutor-practice').count()===0);await close();await ctx.close();
 }
 // Exit during the first lesson never grants completion.
 {
  const ctx=await context('marin');await open('runner');await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice.phase==='try');await page.keyboard.press('ArrowLeft');await page.locator('.practice-exit').click();
  // 10-14: 연습의 ×는 연습만 닫고 같은 게임 시작 화면으로 돌아간다. 놀이 판은 판의 닫기로 닫는다.
  check('leaving unfinished practice keeps the same game and companion open',await page.locator('.tutor-practice').count()===0&&await page.locator('.game-frame').count()===1&&await page.locator('.game-tutor').count()===1);
  await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel').open);
  await open('runner');check('returning after cancellation starts from the uncompleted first step',(await page.evaluate(()=>window.__synkGameTutor.metrics().practice)).index===0);await page.locator('.practice-exit').click();await ctx.close();
 }
 // Every layout shows a complete practice, without an overflowing tap target.
 for(const viewport of [{width:320,height:568},{width:740,height:320},{width:844,height:390},{width:1440,height:900}]){
  const ctx=await context('kkamong',{viewport,motion:'no-preference'});await open('runner');await page.waitForFunction(()=>window.__synkGameTutor.metrics().practice.phase==='try');await bounds(`${viewport.width}x${viewport.height}`);await shot(`practice-${viewport.width}x${viewport.height}`);await page.locator('.practice-exit').click();await ctx.close();
 }
 // Audio failure must leave the action locked; retry uses the existing clip.
 {
  const ctx=await context('mongle');const block='**/hangul-stage/assets/voice/*.mp3';await ctx.route(block,r=>r.abort());await open('hangul');await page.locator('.practice-primary').click();
  await page.waitForFunction(()=>/소리가 안 왔네/.test(document.querySelector('.practice-line')?.textContent));
  check('unavailable audio cannot become a completed listening practice',await page.locator('[data-practice-input="a"]').isDisabled());
  await ctx.unroute(block);await finishPractice(page);await actualPlaying('hangul',page.frameLocator('.game-frame'));await close();await ctx.close();
 }
 check('no browser exceptions',errors.length===0,errors);check('no failed local assets',httpErrors.length===0,httpErrors);check('no external or paid requests',external.length===0,external);
 fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({at:new Date().toISOString(),base,pass:checks.length,fail:0,checks,errors,httpErrors,external},null,2));console.log(`DONE ${checks.length} checks`);
 }catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({at:new Date().toISOString(),message:error.message,checks,errors,httpErrors,external},null,2));throw error;}finally{await browser?.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
