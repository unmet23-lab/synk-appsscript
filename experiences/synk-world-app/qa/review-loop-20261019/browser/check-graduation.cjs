// 한글 만나기 졸업 화면(WORLD 안)의 단추 둘: showGraduation()이 바꾸는 것(grad-life 보임, grad-done cream·「우리 동네로」)을 그대로 적용해 찍고,
// 「생활 한국어 첫 레슨」을 눌러 WORLD가 놀이 판을 닫고 첫 레슨을 여는지 본다. 졸업 조건 자체는 흉내 내지 않는다(회차를 끝까지 풀어야 해서).
const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const BASE=process.env.BASE||'http://127.0.0.1:4637',OUT=process.env.SHOTS||path.join(require('node:os').tmpdir(),'world-review-loop-shots');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const out={};
 try{
  for(const [w,h,scale] of [[390,844,2],[1440,900,1]]){
   const context=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:scale}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(BASE+'/mobile.html?opening=off',{waitUntil:'domcontentloaded'});
   await page.waitForSelector('dialog[open] [data-first-hangul]',{timeout:45000});await page.click('[data-first-hangul="new"]');
   await page.waitForSelector('dialog[open] .tutor-option');await page.click('.tutor-option[data-tutor-id="mongle"]');await page.click('.tutor-primary');await page.click('.tutor-primary[data-tutor-action="finish"]');
   await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');
   await page.evaluate(()=>window.__synkHome.openLearningGame('hangul'));
   await page.waitForSelector('#world-panel iframe.game-frame');
   const frame=await (await page.$('#world-panel iframe.game-frame')).contentFrame();await frame.waitForSelector('#home:not([hidden])',{timeout:30000});
   if(await page.locator('dialog.tutor-practice[open] .practice-exit').count()){await page.click('dialog.tutor-practice[open] .practice-exit');await page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));}
   await frame.evaluate(()=>{for(const s of ['home','session','finish','graduation','song']){const el=document.getElementById(s);if(el)el.hidden=s!=='graduation';}
    const life=typeof window.parent.__synkHome?.startLifeLesson==='function';document.getElementById('grad-life').hidden=!life;
    const done=document.getElementById('grad-done');done.classList.toggle('coral',!life);done.classList.toggle('cream',life);document.getElementById('grad-done-label').textContent='우리 동네로';document.getElementById('grad-note').hidden=false;});
   await page.waitForTimeout(500);await page.screenshot({path:path.join(OUT,`A4-hangul-graduation-${w}.png`)});
   await frame.click('#grad-life');
   await page.waitForFunction(()=>window.__synkWorld.life()?.lessonId==='greetings-expressions',null,{timeout:20000});
   out[w]={lesson:await page.evaluate(()=>({lessonId:window.__synkWorld.life().lessonId,title:document.querySelector('#panel-title').textContent,gameFrameGone:!document.querySelector('#world-panel iframe.game-frame')})),errors};
   await page.waitForTimeout(600);await page.screenshot({path:path.join(OUT,`A5-first-lesson-from-hangul-${w}.png`)});
   await context.close();
  }
 }catch(error){console.error('CHECK_FAILED',error.stack);out.error=error.message;process.exitCode=1;}
 finally{console.log(JSON.stringify(out));fs.writeFileSync(path.join(__dirname,'check-graduation.json'),JSON.stringify(out,null,1));await browser.close();}
})();
