const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4312';
const output=process.env.SYNK_TUTOR_QA_OUTPUT||path.join(__dirname,'tutor-onboarding-20261010');fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],httpErrors=[],external=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});assert.ok(pass,name);};
let browser;
async function ready(page){await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);}
async function take(page,name){await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('.tutor-panel img')].every(img=>img.complete&&img.naturalWidth>0));await page.evaluate(()=>Promise.all(document.querySelector('#world-panel').getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:path.join(output,name+'.png')});}
async function complete(page,id){await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();await page.locator('[data-tutor-action="finish"]').click();}
async function settings(page){if(await page.locator('#world-panel').evaluate(d=>d.open))await page.locator('#panel-close').click();await page.locator('#settings-open').click();await page.locator('[data-tutor-open]').click();}
async function context(viewport,options={}){
 const ctx=await browser.newContext({viewport,...options});
 ctx.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))httpErrors.push({url:r.url(),status:r.status()});});});
 await ctx.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base)||/^(data|blob):/.test(url))return route.continue();external.push(url);return route.abort();});
 await ctx.addInitScript(()=>{
  window.__tutorSounds=[];const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.src.includes('/assets/tutors/'))window.__tutorSounds.push(this);return play.call(this);};
 });
 return {ctx,page:await ctx.newPage()};
}
(async()=>{
 const {TUTORS}=await import(pathToFileURL(path.join(__dirname,'../tutor-profiles.mjs')).href);
 const imageVersions=TUTORS.flatMap(tutor=>Object.entries(tutor.images).map(([emotion,image])=>{
  const url=new URL(image,'https://tutor-assets.invalid/'),file=decodeURIComponent(url.pathname.slice(1));
  const safe=url.origin==='https://tutor-assets.invalid'&&file===`${tutor.id}-${emotion}.webp`;
  const digest=safe?crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../assets/tutors',file))).digest('hex').slice(0,12):null;
  return {tutor:tutor.id,emotion,valid:safe&&url.search===`?v=${digest}`};
 }));
 check('every tutor image URL has the current output hash and resolves without its query',imageVersions.length>0&&imageVersions.every(image=>image.valid),imageVersions);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const {ctx,page}=await context({width:390,height:844},{isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await page.goto(base+'/mobile.html?opening=replay');await ready(page);await page.waitForFunction(()=>window.__synkOpening?.stage()==='title');await page.locator('.opening-enter').click();
 await page.locator('.tutor-panel').waitFor();
 // 2차 3판(10-14): 첫 만남은 튜터 한 명을 크게 미리 보여 주고(조사 §5-3 「한 장씩 넘겨 보며」), 확정은 「○○과 함께하기」를 누를 때만.
 check('first Start previews exactly one tutor and stores nothing yet',await page.locator('[data-tutor-id][aria-pressed=true]').count()===1&&await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null&&window.__synkHome.tutor().tutor===null));
 check('first meeting explains future AI tutor role',await page.locator('.tutor-intro').textContent().then(text=>text.includes('AI 튜터')&&text.includes('앞으로')));
 check('three distinct approved tutors are offered',await page.locator('[data-tutor-id]').count()===3);
 await take(page,'phone390-first-meeting');
 for(const tutor of TUTORS){
  await page.locator(`[data-tutor-id="${tutor.id}"]`).click();
  check(tutor.name+': approved self-introduction',await page.locator('#tutor-speech').textContent()===tutor.card.자기소개);
  check(tutor.name+': preview does not persist choice',await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null));
  const body=await page.locator('.tutor-portrait.large .tutor-body').getAttribute('src');
  for(const [reaction,key]of [['success','잘했을때'],['retry','틀렸을때']]){
   await page.locator(`[data-tutor-reaction="${reaction}"]`).click();
   check(tutor.name+': '+reaction+' approved words',await page.locator('#tutor-speech').textContent()===tutor.card[key]);
   check(tutor.name+': '+reaction+' keeps base body',await page.locator('.tutor-portrait.large .tutor-body').getAttribute('src')===body);
  }
  await page.locator('[data-tutor-reaction="intro"]').click();await take(page,'phone390-'+tutor.id);
 }
 check('reduced motion suppresses movement while words stay available',await page.locator('.tutor-portrait.large').evaluate(el=>getComputedStyle(el).animationName==='none')&&await page.locator('#tutor-speech').textContent().then(Boolean));
 const draft=await page.evaluate(()=>window.__synkHome.tutor().draft);await page.setViewportSize({width:844,height:390});
 check('rotation keeps the current preview and its readable words',await page.evaluate(id=>window.__synkHome.tutor().draft===id&&document.querySelector('#tutor-speech').textContent.length>0,draft));await page.setViewportSize({width:390,height:844});
 await page.locator('[data-tutor-action="sound"]').click();await page.waitForFunction(()=>window.__tutorSounds.length>0);
 check('reaction sound uses an existing local short recording',await page.evaluate(()=>window.__tutorSounds.every(a=>a.src.includes('/assets/tutors/')&&a.volume<=.35)));
 await page.locator('[data-tutor-action="confirm"]').click();
 check('second step introduces real learning/play/review entrances',await page.locator('.tutor-how li').count()===3&&await page.locator('.tutor-welcome-copy').textContent().then(t=>t.includes('AI 튜터')));
 check('second step is still an uncommitted preview',await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null));
 await take(page,'phone390-welcome');await page.locator('[data-tutor-action="back"]').click();await complete(page,'marin');
 check('finish stores only a completed tutor choice',await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor==='marin'&&!document.querySelector('#world-panel').open));
 check('home displays chosen tutor',await page.locator('.place-heading>p:last-child').textContent().then(t=>t.includes('마린'))&&await page.locator('.profile-portrait img').getAttribute('src').then(src=>src.includes('/marin-')));
 check('first Start completion restores keyboard focus to a home action',await page.evaluate(()=>Boolean(document.activeElement?.closest('.lobby-action'))&&document.activeElement.getClientRects().length>0));
 check('closing the screen stops its audio',await page.evaluate(()=>window.__tutorSounds.every(a=>a.paused)));
 await page.reload();await ready(page);await page.waitForFunction(()=>window.__synkHome.tutor().tutor==='marin');await page.waitForFunction(()=>window.__synkOpening?.stage()==='title');await page.locator('.opening-enter').click();
 check('reload restores selection and skips first meeting',!await page.locator('#world-panel').evaluate(d=>d.open));
 await settings(page);await page.locator('[data-tutor-id="kkamong"]').click();await page.keyboard.press('Escape');
 check('cancelled change preserves chosen Marine',await page.evaluate(()=>window.__synkHome.tutor().tutor==='marin'&&JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor==='marin'));
 await page.locator('#life-next-button').evaluate(b=>b.click()); /* 3D 방에서는 숨은 입구(1차). 같은 학습 고리를 직접 부른다 */await page.waitForFunction(()=>window.__synkHome.openPanel().startsWith('life-'));
 check('completed first meeting resumes the real learning flow',await page.locator('#panel-content').textContent().then(t=>t.length>0)&&await page.locator('.tutor-panel').count()===0);await page.locator('#panel-close').click();
 // Actual local synthetic account entrance, without touching rewards or inventory.
 await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="login-a"]').click();await page.waitForFunction(()=>window.__synkWorld.client.snapshot);
 check('signed-in account does not inherit guest choice',await page.evaluate(()=>window.__synkHome.tutor().tutor===null));
 await settings(page);await complete(page,'kkamong');const owner=await page.evaluate(()=>window.__synkWorld.client.snapshot.accountId);
 check('account choice is stored in an isolated device scope',await page.evaluate(id=>JSON.parse(localStorage.getItem('synk.world.tutor.v1:'+encodeURIComponent(id))).tutor==='kkamong'&&JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor==='marin',owner));
 await page.locator('[data-view="me"]').first().click();await page.locator('[data-world="logout"]').click();await page.waitForFunction(()=>window.__synkWorld.client.snapshot===null);
 check('logout restores guest tutor instead of leaking account preference',await page.evaluate(()=>window.__synkHome.tutor().tutor==='marin'));
 await ctx.close();
 const firstSentence=await context({width:390,height:844},{isMobile:true,hasTouch:true});await firstSentence.page.goto(base+'/mobile.html?opening=off');await ready(firstSentence.page);await firstSentence.page.locator('[data-view="play"]').click();await firstSentence.page.locator('[data-world="play"]').click();
 check('first-sentence Start uses the same tutor entrance',await firstSentence.page.locator('.tutor-panel').count()===1);await complete(firstSentence.page,'marin');await firstSentence.page.locator('[data-world="login-a"]').waitFor();
 check('first-sentence continuation preserves existing account requirement',await firstSentence.page.evaluate(()=>window.__synkHome.tutor().tutor==='marin'));await firstSentence.ctx.close();
 for(const [label,width,height,mobile]of [['phone320',320,740,true],['phone322',322,704,true],['phone430',430,932,true],['landscape740',740,320,true],['landscape844',844,390,true],['desktop',1440,1000,false]]){
  const {ctx,page}=await context({width,height},{isMobile:mobile,hasTouch:mobile});await page.goto(base+'/mobile.html?opening=off');await ready(page);await page.locator('#life-next-button').evaluate(b=>b.click()); /* 3D 방에서는 숨은 입구(1차). 같은 학습 고리를 직접 부른다 */await page.locator('.tutor-panel').waitFor();await page.locator('[data-tutor-id="marin"]').click();
  await page.waitForTimeout(1500);await take(page,label+'-marin');
  const bounds=await page.locator('#world-panel').evaluate(d=>({overflow:d.scrollWidth-d.clientWidth,width:d.getBoundingClientRect().width,scroll:d.scrollHeight>d.clientHeight,buttons:[...d.querySelectorAll('button')].map(el=>({text:el.textContent.trim(),w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})).filter(b=>b.w&&b.h)}));
  check(label+': no horizontal overflow',bounds.overflow<=1,bounds);
  check(label+': touch controls remain at least 44px',bounds.buttons.every(b=>b.w>=44&&b.h>=44),bounds.buttons);
  await page.locator('[data-tutor-action="confirm"]').click();await take(page,label+'-welcome');await page.locator('[data-tutor-action="finish"]').click();await page.waitForFunction(()=>window.__synkHome.openPanel().startsWith('life-'));
  check(label+': tutorial completion continues requested learning',await page.locator('.tutor-panel').count()===0);await ctx.close();
 }
 const standalone=await context({width:390,height:844},{isMobile:true,hasTouch:true});
 await standalone.page.goto(base+'/brand-opening/home.html');await standalone.page.waitForFunction(()=>window.__synkHome);await standalone.page.locator('[data-view="play"]').click();await standalone.page.locator('[data-game="runner"]').click();
 check('direct standalone game Start also requires first meeting',await standalone.page.locator('.tutor-panel').count()===1&&await standalone.page.locator('iframe').count()===0);
 await complete(standalone.page,'mongle');await standalone.page.locator('.game-frame').waitFor();
 check('standalone completion opens the originally requested game',await standalone.page.locator('.game-frame').getAttribute('src').then(src=>src.includes('/korean-runner/')));
 await standalone.page.locator('.tutor-practice[open]').waitFor();await standalone.page.locator('.practice-exit').click();
 check('game return restores chosen companion',await standalone.page.evaluate(()=>window.__synkHome.tutor().tutor==='mongle'));await standalone.ctx.close();
 check('no JavaScript errors',errors.length===0,errors);check('no missing assets',httpErrors.length===0,httpErrors);check('no external or paid calls',external.length===0,external);
 fs.writeFileSync(path.join(output,'browser-result.json'),JSON.stringify({base,checks,errors,httpErrors,external,screenshots:fs.readdirSync(output).filter(f=>f.endsWith('.png'))},null,2));console.log(JSON.stringify({passed:checks.length,output}));
})().catch(error=>{fs.writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.stack,checks,errors,httpErrors,external},null,2));console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
