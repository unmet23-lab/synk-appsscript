const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SYNK_OPENING_QA_URL||'http://127.0.0.1:4307';
const revision=process.argv.find(arg=>arg.startsWith('--revision='))?.slice('--revision='.length)||'v7';
assert.match(revision,/^v\d+$/,'Revision must have the form --revision=v8');
const output=path.join(__dirname,`felt-${revision}`);
const checks=[],errors=[],resources=[],motionChecks=[];
function check(name,condition){assert.ok(condition,name);checks.push(name);}
async function title(page){
  await page.waitForFunction(()=>window.__synkOpening?.stage()==='title'&&document.querySelector('.opening-company')?.hidden===true);
  await page.waitForTimeout(800);
}
async function screenshot(page,name){
  if(!name.endsWith('-company')){
    await page.waitForFunction(()=>document.querySelector('.opening-company')?.hidden===true);
    await page.waitForFunction(()=>{const video=document.querySelector('.opening-title-video');return !video?.currentSrc||video.currentTime>1.2;});
  }
  await page.screenshot({path:path.join(output,`${name}-minimal.jpg`),type:'jpeg',quality:85});
}
async function framePixels(page){return page.locator('.opening-title-video').evaluate(video=>{
  const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
  const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(video,0,0,160,90);
  return [...context.getImageData(0,0,160,90).data];
});}
async function checkFrameMotion(page,name){
  let previous=await framePixels(page);const deltas=[];
  for(let sample=0;sample<3;sample++){
    await page.waitForTimeout(650);const next=await framePixels(page);let change=0;
    for(let i=0;i<next.length;i+=4)change+=Math.abs(next[i]-previous[i])+Math.abs(next[i+1]-previous[i+1])+Math.abs(next[i+2]-previous[i+2]);
    deltas.push(change/(next.length/4*3));previous=next;
  }
  motionChecks.push({name,meanRgbChanges:deltas});
  check(`${name}: decoded video frames continue changing during playback`,deltas.filter(delta=>delta>.25).length>=2);
}
async function setVisibility(page,hidden){await page.evaluate(value=>{
  Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));
},hidden);}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const [name,width,height]of [['mobile390',390,844],['mobile320',320,700],['desktop',1440,900],['landscape',844,390]]){
      const context=await browser.newContext({viewport:{width,height},hasTouch:name!=='desktop',reducedMotion:'no-preference'}),page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400&&!response.url().includes('/api/'))resources.push({url:response.url(),status:response.status()});});
      const entry=name==='desktop'?'desktop':'mobile';
      await page.goto(`${base}/${entry}.html`,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__synkOpening&&['company','title'].includes(window.__synkOpening.stage()));
      await page.waitForTimeout(900);
      const companyImage=await page.locator('.opening-wordmark').evaluate(el=>({ready:el.complete&&el.naturalWidth>0,ratio:el.width/el.height}));
      check(`${name}: approved logo loads in its original proportion`,companyImage.ready&&Math.abs(companyImage.ratio-1100/541)<.03);
      await screenshot(page,`${name}-company`);
      await title(page);
      check(`${name}: company splash transitions to the product title`,await page.locator('.opening-title').isVisible());
      check(`${name}: no automatic browser audio`,!await page.evaluate(()=>window.__synkOpening.audioStatus().enabled));
      const layout=await page.locator('.synk-opening').evaluate(dialog=>{
        const nodes=[...dialog.querySelectorAll('.opening-title-copy,.opening-hint,.opening-sound,.opening-copyright')];
        return nodes.every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;});
      });
      check(`${name}: title, hint, sound icon, and credits fit the viewport`,layout);
      check(`${name}: the start target covers the whole screen`,await page.locator('.opening-enter').evaluate(el=>{
        const rect=el.getBoundingClientRect();return el.tagName==='BUTTON'&&rect.left<=1&&rect.top<=1&&rect.right>=innerWidth-1&&rect.bottom>=innerHeight-1;
      }));
      check(`${name}: the screen start target has an accessible name`,Boolean(await page.locator('.opening-enter').getAttribute('aria-label')));
      check(`${name}: removed text controls and game-start text are absent`,await page.locator('.synk-opening').evaluate(dialog=>
        !dialog.querySelector('.opening-motion,.opening-skip,.opening-start,.opening-start-area')&&!/영상\s*멈추기|바로\s*시작|게임\s*스타트/.test(dialog.innerText)));
      check(`${name}: sound is an accessible icon with a 44px touch target`,await page.locator('.opening-sound').evaluate(el=>{
        const rect=el.getBoundingClientRect(),icon=el.querySelector('svg,img'),copy=el.cloneNode(true);copy.querySelectorAll('svg,img').forEach(node=>node.remove());
        return Boolean(icon)&&(!(icon instanceof HTMLImageElement)||(icon.complete&&icon.naturalWidth>0))&&!copy.textContent.trim()&&Boolean(el.getAttribute('aria-label'))&&el.getAttribute('aria-pressed')==='false'&&rect.width>=44&&rect.height>=44;
      }));
      check(`${name}: one understated hint matches touch or mouse input`,await page.locator('.synk-opening').evaluate(dialog=>{
        const hints=dialog.querySelectorAll('.opening-hint');return hints.length===1&&hints[0].textContent.trim()==='시작하기';
      }));
      check(`${name}: keyboard focus remains inside the opening`,await page.locator('.synk-opening').evaluate(dialog=>dialog===document.activeElement||dialog.contains(document.activeElement)));
      const aspect=width<800?'mobile':'desktop';
      check(`${name}: the current ${revision} felt trio poster loads`,await page.locator('.opening-title-scene').evaluate((el,expected)=>el.complete&&el.naturalWidth>0&&new URL(el.currentSrc).pathname.endsWith(expected),`felt-world-scene-${aspect}-${revision}.webp`));
      await page.waitForFunction(()=>document.querySelector('.opening-title-video').currentTime>.1);
      const motion=await page.locator('.opening-title-video').evaluate(video=>({duration:video.duration,muted:video.muted,loop:video.loop,source:video.currentSrc,width:video.videoWidth,height:video.videoHeight}));
      check(`${name}: the current ten-second Omni ${revision} shot actually plays`,Math.abs(motion.duration-10)<.1&&new URL(motion.source).pathname.endsWith(`world-menu-${aspect}-omni11-${revision}-web.mp4`)&&motion.width>0&&motion.height>0);
      check(`${name}: background is muted and repeats the entire clip`,motion.muted&&motion.loop);
      check(`${name}: only a playing video replaces the poster`,await page.locator('.synk-opening').evaluate(dialog=>dialog.classList.contains('video-ready')&&dialog.dataset.videoState==='playing'));
      check(`${name}: copyright reads 2027`,await page.locator('.opening-copyright').textContent().then(text=>text==='© 2027 SYNK'));
      await screenshot(page,`${name}-title`);
      if(['mobile390','desktop'].includes(name)){
        await checkFrameMotion(page,name);
        await page.locator('.opening-title-video').evaluate(video=>{video.currentTime=video.duration-.15;});
        await page.waitForFunction(()=>{const v=document.querySelector('.opening-title-video');return v.currentTime>.05&&v.currentTime<1.5&&!v.paused;},null,{timeout:5000});
        check(`${name}: the loop restarts at the beginning instead of a one-second tail`,await page.locator('.opening-title-video').evaluate(video=>video.currentTime<1.5&&!video.paused));
        await screenshot(page,`${name}-full-loop`);
      }
      if(name==='mobile390'){
        await setVisibility(page,true);
        check('a hidden page pauses the background video',await page.locator('.opening-title-video').evaluate(video=>video.paused));
        await setVisibility(page,false);await page.waitForFunction(()=>!document.querySelector('.opening-title-video').paused);
        check('returning to the page resumes the background video',await page.locator('.opening-title-video').evaluate(video=>!video.paused));
        await page.evaluate(()=>{delete document.hidden;});
        await page.waitForFunction(()=>window.__synkHome.sceneAvailable(),null,{timeout:60000});
        check('hidden 3D home pauses its continuous renderer behind the opening',await page.evaluate(()=>window.__synkHome.sceneMetrics().active===false));
        await page.locator('.opening-sound').click();await page.waitForFunction(()=>window.__synkOpening.audioStatus().currentTime>.05);
        const sound=await page.evaluate(()=>window.__synkOpening.audioStatus());
        check('sound candidate plays only after a user gesture',sound.enabled&&sound.currentTime>0&&Math.abs(sound.duration-.38)<.01);
        check('the sound icon exposes its enabled state without starting the game',await page.locator('.opening-sound').getAttribute('aria-pressed')==='true'&&await page.evaluate(()=>window.__synkOpening.stage()==='title'));
        await page.locator('.opening-sound').click();
        check('the sound icon toggles off without starting the game',await page.locator('.opening-sound').getAttribute('aria-pressed')==='false'&&await page.evaluate(()=>{const sound=window.__synkOpening.audioStatus();return !sound.enabled&&sound.paused&&window.__synkOpening.stage()==='title';}));
      }
      await page.locator('.opening-enter').click({position:{x:Math.round(width*.55),y:Math.round(height*.6)}});
      await page.locator('.welcome-art').waitFor();
      check(`${name}: clicking the scene hands off to the existing guest/account welcome`,!await page.locator('.synk-opening').count());
      await page.locator('[data-world="guest"]').click();
      await page.waitForFunction(()=>window.__synkHome.sceneAvailable(),null,{timeout:60000});
      check(`${name}: the real 3D home remains usable`,await page.evaluate(()=>window.__synkHome.sceneAvailable()&&window.__synkHome.sceneMetrics().graphicsVersion===3));
      if(name==='mobile390')check('3D home resumes after starting and entering as a guest',await page.evaluate(()=>window.__synkHome.sceneMetrics().active===true));
      if(name==='mobile390'){
        await page.reload({waitUntil:'networkidle'});
        check('same-tab return skips the opening',!await page.locator('.synk-opening').count());
        await page.locator('[data-action="profile"]').click();
        check('same-tab return still opens the account entrance',await page.locator('[data-world="login-a"]').isVisible());
        await page.keyboard.press('Escape');
      }
      await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
      await page.goto(`${base}/mobile.html`,{waitUntil:'domcontentloaded'});await page.locator('.opening-enter').waitFor();
      check('the company splash is available before its automatic transition',await page.evaluate(()=>window.__synkOpening.stage()==='company'));
      await page.locator('.opening-enter').click({position:{x:180,y:410}});await page.locator('.welcome-art').waitFor();
      check('tapping the company splash skips directly to the app entrance',!await page.locator('.synk-opening').count());
      await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
      await page.goto(`${base}/mobile.html`,{waitUntil:'domcontentloaded'});await title(page);
      check('reduced-motion preference removes animation',await page.locator('.opening-title-copy').evaluate(el=>getComputedStyle(el).animationName==='none'));
      check('reduced-motion uses the poster without loading the video',await page.locator('.opening-title-video').evaluate(video=>video.paused&&!video.getAttribute('src')));
      check('reduced-motion has no separate playback control',await page.locator('.opening-motion').count()===0);
      await page.keyboard.press('Tab');
      check('the first Tab focuses the screen entry',await page.locator('.opening-enter').evaluate(el=>document.activeElement===el));
      await page.keyboard.press('Tab');
      check('keyboard Tab reaches the sound icon from the screen entry',await page.locator('.opening-sound').evaluate(el=>document.activeElement===el));
      await page.keyboard.press('Space');await page.waitForFunction(()=>window.__synkOpening.audioStatus().enabled);
      check('keyboard sound activation leaves the opening visible',await page.evaluate(()=>window.__synkOpening.stage()==='title'));
      await setVisibility(page,true);await setVisibility(page,false);await page.waitForTimeout(300);
      check('reduced-motion remains a poster after sound interaction and page return',await page.locator('.opening-title-video').evaluate(video=>video.paused&&!video.getAttribute('src')));
      await page.evaluate(()=>{delete document.hidden;});
      await page.keyboard.press('Shift+Tab');
      check('keyboard focus returns from sound to the screen entry',await page.locator('.opening-enter').evaluate(el=>document.activeElement===el));
      await page.keyboard.press('Enter');await page.locator('.welcome-art').waitFor();check('keyboard Enter starts from the focused screen entry',true);await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'}),page=await context.newPage();
      await page.addInitScript(()=>{
        const original=HTMLMediaElement.prototype.play;let denied=false;
        HTMLMediaElement.prototype.play=function(...args){
          if(this.classList.contains('opening-title-video')&&!denied){denied=true;return Promise.reject(new DOMException('Autoplay blocked for QA','NotAllowedError'));}
          return original.apply(this,args);
        };
      });
      await page.goto(`${base}/brand-opening/index.html`,{waitUntil:'domcontentloaded'});await title(page);
      check('autoplay rejection keeps the poster without restoring removed controls',await page.locator('.synk-opening').evaluate(dialog=>!dialog.classList.contains('video-ready')&&dialog.dataset.videoState==='blocked'&&!dialog.querySelector('.opening-motion,.opening-skip,.opening-start')));
      await page.keyboard.press('Space');
      check('keyboard Space can enter even when autoplay is blocked',!await page.locator('.synk-opening').count());await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
      await page.goto(`${base}/mobile.html`,{waitUntil:'domcontentloaded'});await page.locator('.opening-enter').waitFor();await page.keyboard.press('Escape');await page.locator('.welcome-art').waitFor();check('keyboard Escape closes the company splash and restores the entrance',true);await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
      await page.route('**/brand-opening/opening.mjs',route=>route.abort());
      await page.goto(`${base}/mobile.html`,{waitUntil:'networkidle'});await page.locator('.welcome-art').waitFor();check('failed optional opening module does not block the app',!await page.locator('#synk-opening-cover').count());await context.close();
    }
    {
      const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
      await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage blocked')};Storage.prototype.setItem=()=>{throw new Error('Storage blocked')};});
      await page.goto(`${base}/brand-opening/index.html`,{waitUntil:'domcontentloaded'});await title(page);await page.locator('.opening-enter').click();check('blocked browser storage does not trap the shared opening',!await page.locator('.synk-opening').count());await context.close();
    }
    check('no browser JavaScript errors in normal opening flows',errors.length===0);
    check('no failed normal static resources',resources.length===0);
    const reply=await fetch(`${base}/brand-opening/../brand-opening/README.md`);check('opening source notes are not exposed as static app resources',reply.status===403);
    const report=JSON.stringify({date:'2026-10-10',revision,base,checks,motionChecks,errors,resources,passed:checks.length,scope:`Edge desktop browser; four viewport sizes, exact ${revision} video/poster selection, icon sound control, screen-wide entry, touch/mouse hint, Enter/Space/Escape/Tab, actual decoded-frame differences, full-clip loop, and reduced-motion/visibility/autoplay cases; not physical phones`},null,2);
    fs.writeFileSync(path.join(__dirname,'browser-result.json'),report);
    fs.writeFileSync(path.join(output,'browser-result.json'),report);
    console.log(JSON.stringify({passed:checks.length,errors,resources},null,2));
  }finally{await browser.close();}
})().catch(error=>{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({revision,checks,motionChecks,errors,resources,error:error.stack},null,2));console.error(error);process.exitCode=1;});
