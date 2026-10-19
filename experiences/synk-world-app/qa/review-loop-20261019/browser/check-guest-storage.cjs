// 계정 모드(공개판과 같은 모드) 손님이 한글 만나기를 열 때 진도가 어디에 저장되는지 본다(10-19 결정 「WORLD 손님」). 서버: SYNK_WORLD_MODE=account(4638).
const path=require('node:path');
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const BASE='http://127.0.0.1:4638';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const out={};
 try{const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===BASE?r.continue():r.abort('blockedbyclient'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/world/?opening=off',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('dialog[open] [data-first-hangul]',{timeout:45000});await page.click('[data-first-hangul="new"]');
  await page.waitForSelector('dialog[open] .tutor-option');await page.click('.tutor-option[data-tutor-id="mongle"]');await page.click('.tutor-primary');await page.click('.tutor-primary[data-tutor-action="finish"]');
  await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready');
  await page.evaluate(()=>window.__synkHome.openLearningGame('hangul'));await page.waitForSelector('#world-panel iframe.game-frame');
  const frame=await (await page.$('#world-panel iframe.game-frame')).contentFrame();await frame.waitForSelector('#home:not([hidden])',{timeout:30000});
  out.guest=await page.evaluate(()=>({owner:window.__synkWorld.client.snapshot?.accountId||'guest',hostInParent:!!window.SYNKLearningHost,screen:window.__synkWorld.screen()}));
  out.key=await frame.evaluate(async()=>{const m=await import('./learning.mjs');const coach=m.createCoach(window);return {hosted:m.isHosted(coach),key:m.progressKey(window,coach)};});
  if(await page.locator('dialog.tutor-practice[open] .practice-exit').count()){await page.click('dialog.tutor-practice[open] .practice-exit');await page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));}
  // 건너뛰기 한 번으로 기기 저장이 실제로 일어나는지(진도를 저장하는 같은 save 경로)
  await frame.click('#skip');await frame.click('#sheet-skip');await page.waitForTimeout(400);
  out.saved=await frame.evaluate(()=>{const raw=localStorage.getItem('synk.hangul-stage.v1');return raw?{skipped:JSON.parse(raw).skipped}:null;});
  out.lifeGuestKey=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('synk.life-korean.progress.v1')));
  out.atlasDevice=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('synk.atlas.learning.v1')));
  out.errors=errors;
 }catch(e){out.error=e.message;process.exitCode=1;}finally{console.log(JSON.stringify(out,null,1));await browser.close();}})();
