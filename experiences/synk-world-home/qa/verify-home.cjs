const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4295';
const results=[];const errors=[];
function check(name,value,detail){results.push({name,passed:!!value,detail});if(!value)throw Error(name);}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 for(const [name,width,height,route]of[['desktop',1440,1050,'desktop.html'],['mobile',390,844,'mobile.html'],['mobile-small',320,740,'mobile.html'],['mobile-on-pc',1440,1050,'mobile.html']]){
  const ctx=await browser.newContext({viewport:{width,height}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push({name,error:e.message}));
  await page.goto(`${base}/${route}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__synkHome?.sceneAvailable());await page.waitForFunction(()=>window.__synkHome.sceneMetrics().frameCount>3);
  check(`${name}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(`${name}: all visible images loaded`,await page.locator('main img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)));
  check(`${name}: Korean font loaded`,await page.evaluate(()=>document.fonts.check('600 18px SUIT')));
  check(`${name}: video excluded from initial network`,await page.evaluate(()=>!performance.getEntriesByType('resource').some(r=>r.name.endsWith('.mp4'))));
  await page.screenshot({path:path.join(__dirname,`${name}-final.png`),fullPage:true});
  if(name==='mobile'){
   const settings=page.getByRole('button',{name:'화면 설정',exact:true});check('mobile settings entry visible',await settings.isVisible());await settings.click();await page.locator('#motion-setting').check();await page.waitForFunction(()=>window.__synkHome.sceneMetrics()?.reducedMotion===true);check('motion preference reaches renderer',true);await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'옷 갈아입기',exact:true}).click();await page.locator('[data-outfit="scarf"]').click();check('costume reaches real mesh',await page.evaluate(()=>window.__synkHome.sceneMetrics().outfit==='scarf'));await page.keyboard.press('Escape');
   check('dialog restores focus',await page.locator('[data-action="wardrobe"]').first().evaluate(e=>e===document.activeElement));
   await page.getByRole('button',{name:'노을로 보기',exact:true}).click();check('sunset reaches renderer',await page.evaluate(()=>window.__synkHome.sceneMetrics().time==='sunset'));
   await page.screenshot({path:path.join(__dirname,'mobile-sunset-final.png')});
   await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__synkHome?.sceneAvailable());check('costume and lighting persist',await page.evaluate(()=>window.__synkHome.state.outfit==='scarf'&&window.__synkHome.state.time==='sunset'));
   await page.getByRole('button',{name:'옷 갈아입기',exact:true}).click();await page.screenshot({path:path.join(__dirname,'mobile-wardrobe-final.png')});await page.keyboard.press('Escape');
   for(const id of ['vowel-dance','geu-a-ga','batchim']){
    await page.locator(`[data-song="${id}"]`).click();const video=page.locator('video');await video.waitFor();await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&v.currentTime>.1;});const duration=await video.evaluate(v=>v.duration);check(`video ${id} decoded and advancing`,duration>50,{duration});await video.evaluate(v=>{v.currentTime=8;});await page.waitForFunction(()=>document.querySelector('video')?.currentTime>8.1);if(id==='vowel-dance')await page.screenshot({path:path.join(__dirname,'mobile-video-final.png')});await page.keyboard.press('Escape');check(`video ${id} removed on close`,await page.locator('video').count()===0);
   }
   await page.locator('[data-nav="town"]').last().click();check('town does not fake unlock',await page.locator('#panel-content').innerText().then(t=>t.includes('실제 학습 기록이나 이용권을 확인한 상태는 아니에요')));await page.keyboard.press('Escape');
  }
  await ctx.close();
 }
 const fallback=await browser.newContext({viewport:{width:390,height:844}});await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).startsWith('webgl'))return null;return original.call(this,type,...args);};});const f=await fallback.newPage();await f.goto(`${base}/mobile.html`,{waitUntil:'networkidle'});check('WebGL unavailable keeps approved mascot',await f.locator('.scene-fallback').isVisible());check('WebGL unavailable keeps main CTA',await f.getByRole('button',{name:'오늘의 놀이 시작',exact:false}).isVisible());await f.screenshot({path:path.join(__dirname,'mobile-fallback.png')});await fallback.close();
 check('no uncaught JS errors',errors.length===0,errors);await browser.close();
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),results,errors,result:'passed',limitations:['Browser viewport testing, not physical S25/iPhone15','Existing video decoding/playback checked, full listening not performed','Procedural art study; no Unity native client or account migration']},null,2));console.log(JSON.stringify({passed:results.length,errors:errors.length}));
})().catch(e=>{fs.writeFileSync(path.join(__dirname,'verification-failure.json'),JSON.stringify({results,errors,failure:String(e)},null,2));console.error(e);process.exit(1);});
