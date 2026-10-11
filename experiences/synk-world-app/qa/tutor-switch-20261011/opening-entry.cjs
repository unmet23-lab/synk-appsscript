const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=(process.env.SYNK_HOME_TUTOR_URL||'https://synk.im/world').replace(/\/+$/,''),out=path.join(__dirname,process.env.SYNK_OPENING_ENTRY_RUN||'public-opening-20261012');
const checks=[],errors=[],missing=[],external=[],blockedWrites=[],images=[];
let browser,context,page,failure;
fs.mkdirSync(out,{recursive:true});
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});assert.ok(pass,name);};
async function shot(name){await page.evaluate(()=>document.fonts.ready);const file=path.join(out,name+'.png');await page.screenshot({path:file});images.push(file);}
(async()=>{try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});context.setDefaultTimeout(20000);
 await context.route('**/*',route=>{const req=route.request(),url=req.url();if(/^(blob|data):/.test(url))return route.continue();if(!url.startsWith(base+'/')){external.push(url);return route.abort();}if(!['GET','HEAD'].includes(req.method())){blockedWrites.push({url,method:req.method()});return route.abort();}return route.continue();});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))missing.push({url:r.url(),status:r.status()});});
 const response=await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 check('canonical app entry responds successfully without query parameters',response.ok()&&new URL(page.url()).search==='');
 await page.locator('.synk-opening[open]').waitFor();await page.locator('#synk-opening-cover').waitFor({state:'hidden'});
 check('fresh guest sees the actual opening and cover has cleared',await page.locator('.synk-opening').evaluate(el=>el.open)&&await page.locator('#synk-opening-cover').count()===0);
 const wordmark=await page.locator('.opening-wordmark').evaluate(async img=>{await img.decode();return {loaded:img.naturalWidth>0,url:img.currentSrc};});
 check('opening logo is decoded from the deployed app',wordmark.loaded&&wordmark.url.startsWith(base+'/'),wordmark);
 check('new context has no account session or saved tutor',await page.evaluate(()=>!sessionStorage.getItem('synk.oauth.session.world')&&!localStorage.getItem('synk.world.tutor.v1:guest')));
 await shot('opening');await page.locator('.opening-enter').click();await page.locator('.synk-opening').waitFor({state:'hidden'});
 check('opening can be skipped through its actual button',await page.locator('.synk-opening,#synk-opening-cover').count()===0);
 await page.locator('[data-tutor-id=marin]').waitFor();
 const initialOptions=await page.locator('[data-tutor-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.tutorId));
 check('first visit automatically offers all three AI tutors',JSON.stringify(initialOptions)===JSON.stringify(['marin','kkamong','mongle']),initialOptions);
 const choiceImages=await page.locator('.tutor-options img').evaluateAll(imgs=>Promise.all(imgs.map(async img=>{await img.decode();return {loaded:img.naturalWidth===480,url:img.currentSrc};})));
 check('all three initial tutor portraits decode from deployed assets',choiceImages.length===3&&choiceImages.every(img=>img.loaded&&img.url.startsWith(base+'/')),choiceImages);
 check('onboarding identifies the characters as AI tutors',await page.locator('.tutor-intro').innerText().then(text=>text.includes('AI 튜터')));
 await shot('automatic-tutor-choice');await page.locator('#panel-close').click();await page.locator('.home-tutor-choose').waitFor();
 check('closing the choice exposes the guest home with a choose action',await page.locator('.home-tutor-choose').isVisible()&&await page.evaluate(()=>window.__synkWorld.life().owner==='guest'));
 const scene=await page.locator('.scene-poster').evaluate(async img=>{await img.decode();return {loaded:img.naturalWidth>0,url:img.currentSrc};});
 check('home background asset has decoded',scene.loaded&&scene.url.startsWith(base+'/'),scene);await shot('home-before-choice');
 await page.locator('.home-tutor-choose').click();await page.locator('[data-tutor-id=kkamong]').click();
 const preview=await page.locator('.tutor-portrait.large .tutor-face').evaluate(async img=>{await img.decode();return {loaded:img.naturalWidth===480,url:img.currentSrc};});
 check('home reopens a fully rendered Kkamong tutor preview',preview.loaded&&decodeURIComponent(preview.url).includes('/kkamong-'),preview);
 check('Kkamong preview gives the authored first-person introduction',await page.locator('#tutor-speech').innerText().then(text=>text.includes('이 몸')));
 await shot('kkamong-choice-from-home');await page.locator('#panel-close').click();
 check('preview cancellation leaves the guest unselected and unauthenticated',await page.evaluate(()=>!localStorage.getItem('synk.world.tutor.v1:guest')&&!sessionStorage.getItem('synk.oauth.session.world')&&window.__synkWorld.life().owner==='guest'));
 }catch(e){failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}finally{
  await context?.close().catch(()=>{});await browser?.close();
  for(const [name,value]of Object.entries({errors,missing,external,blockedWrites}))checks.push({name:name+' zero',pass:value.length===0,detail:value});
  const report={base,scope:'Public canonical entry with no query bypass; fresh isolated guest; real opening skip and home/tutor choice UI; no login or account writes; no synthetic state or clock',checks,errors,missing,external,blockedWrites,images,failure};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,total:checks.length,passed:checks.filter(c=>c.pass).length,failure}));if(failure||checks.some(c=>!c.pass))process.exitCode=1;
 }
})();
