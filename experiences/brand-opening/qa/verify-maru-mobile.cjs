// V2 mobile-game lobby QA. Preserve the v1 runner and its evidence.
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const base=process.env.SYNK_OPENING_QA_URL||'http://127.0.0.1:4307',output=path.join(__dirname,'maru-v2');
const layoutOnly=process.argv.includes('--layout-only');
const viewports=[['mobile390',390,844],['mobile320',320,740],['mobile322',322,704],['mobile430',430,932],['landscape',844,390],['desktop',1440,1000]];
const checks=[],errors=[],resources=[],blockedRequests=[],layouts=[],screenshots=[],games=[];
const primary=page=>page.getByRole('button',{name:/놀러 가기/}).first();
function check(name,passed,details){checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});}
function save(){fs.writeFileSync(path.join(output,layoutOnly?'layout-result.json':'browser-result.json'),JSON.stringify({date:'2026-10-10',base,layoutOnly,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed),checks,layouts,games,screenshots,errors,resources,blockedRequests,scope:layoutOnly?'Six emulated Edge viewports: one-screen lobby layout, assets, current video and screenshots.':'Six emulated Edge viewports: one-screen lobby, bottom sheets, three real game entrance headings, return/cleanup/focus, reduced motion, and opening handoff. No game starts, account mutations, or paid AI calls. This is not physical-device proof.'},null,2)+'\n');}
async function snap(page,name,fullPage=false){const file=path.join(output,`${name}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:85,fullPage});const bytes=fs.readFileSync(file);screenshots.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),fullPage});}
async function scenePlaying(page){await page.waitForFunction(()=>{const v=document.querySelector('.scene-video');return v&&!v.paused&&v.currentTime>.1&&v.readyState>=2&&document.querySelector('.maru-scene').classList.contains('is-playing')&&Number(getComputedStyle(v).opacity)===1;},null,{timeout:20000});}
async function advance(page,name){await scenePlaying(page);const before=await page.locator('.scene-video').evaluate(v=>v.currentTime);await page.waitForTimeout(350);const after=await page.locator('.scene-video').evaluate(v=>v.currentTime);check(`${name}: background playback advances`,Math.abs(after-before)>.1,{before,after});}
async function assets(page,name){
 const observed=await page.evaluate(async()=>{
  await document.fonts.ready;
  const fonts=[...document.fonts].map(font=>({family:font.family,status:font.status}));
  const images=await Promise.all([...document.images].map(async img=>{try{await img.decode();return {source:img.currentSrc,width:img.naturalWidth};}catch{return {source:img.currentSrc||img.src,width:0};}}));
  const urls=[...new Set([...document.querySelectorAll('body *')].flatMap(el=>[...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1])))];
  const backgrounds=await Promise.all(urls.map(source=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve({source,width:img.naturalWidth});img.onerror=()=>resolve({source,width:0});img.src=source;})));
  return {fonts,images,backgrounds};
 });
 check(`${name}: required image assets decode`,observed.images.length>0&&observed.images.every(i=>i.width>0),observed.images);
 check(`${name}: felt backgrounds decode`,observed.backgrounds.length>0&&observed.backgrounds.every(i=>i.width>0),observed.backgrounds);
 check(`${name}: a local brand font is loaded and no font has failed`,observed.fonts.some(f=>f.status==='loaded')&&observed.fonts.every(f=>f.status!=='error'),observed.fonts);
}
async function layout(page,name){
 const button=primary(page);await button.waitFor({state:'visible'});
 const primaryBox=await button.boundingBox();
 const observed=await page.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0;};
  const controls=[...document.querySelectorAll('body button,body a')].filter(el=>visible(el)&&!el.closest('dialog,.skip-link')).map(el=>({label:el.getAttribute('aria-label')||el.textContent.trim(),...rect(el)}));
  const tiny=[];let minFont=Infinity;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const n=walker.currentNode,el=n.parentElement,t=n.textContent.trim();if(!t||!visible(el)||el.closest('dialog,script,style,noscript,.skip-link,[aria-hidden="true"]'))continue;const size=parseFloat(getComputedStyle(el).fontSize);if(size===0)continue;const range=document.createRange();range.selectNodeContents(n);if(![...range.getClientRects()].some(r=>r.width>0&&r.height>0))continue;minFont=Math.min(minFont,size);if(size<11)tiny.push({text:t,size});}
  return {width:innerWidth,height:innerHeight,scrollX,scrollY,horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,verticalOverflow:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-innerHeight,scene:rect(document.querySelector('.maru-scene')),nav:rect(document.querySelector('.world-nav')),controls,minFont,tiny};
 });observed.primary=primaryBox;layouts.push({name,...observed});
 check(`${name}: lobby has no horizontal overflow`,observed.horizontalOverflow===0,observed.horizontalOverflow);
 check(`${name}: lobby fits one screen without scrolling`,observed.verticalOverflow<=1&&observed.scrollX===0&&observed.scrollY===0,observed);
 check(`${name}: all lobby controls fit the viewport`,observed.controls.every(r=>r.x>=-.5&&r.y>=-.5&&r.right<=observed.width+.5&&r.bottom<=observed.height+.5),observed.controls);
 check(`${name}: all visible lobby text is at least 11px`,observed.minFont>=11&&observed.tiny.length===0,observed.tiny);
 check(`${name}: large play action has a usable touch target`,primaryBox.width>=160&&primaryBox.height>=48,primaryBox);
 check(`${name}: primary action is entirely above the bottom navigation`,primaryBox.y+primaryBox.height<=observed.nav.y+.5,{primary:primaryBox,nav:observed.nav});
 const navTargets=await page.locator('.world-nav button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height};}));check(`${name}: nav touch targets are at least 44px`,navTargets.length>=3&&navTargets.every(r=>r.width>=44&&r.height>=44),navTargets);
 if(observed.width<760&&observed.height>observed.width)check(`${name}: portrait world background covers the complete viewport`,observed.scene.x<=.5&&observed.scene.y<=.5&&observed.scene.right>=observed.width-.5&&observed.scene.bottom>=observed.height-.5,observed.scene);
}
async function panelGeometry(page,name){
 await page.locator('#world-panel').evaluate(async panel=>{await Promise.all(panel.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
 const observed=await page.locator('#world-panel').evaluate(panel=>{const r=panel.getBoundingClientRect();return {width:innerWidth,height:innerHeight,x:r.x,y:r.y,right:r.right,bottom:r.bottom,overflow:panel.scrollWidth-panel.clientWidth,activeInside:panel.contains(document.activeElement)};});
 check(`${name}: sheet fits horizontally and contains keyboard focus`,observed.x>=-.5&&observed.right<=observed.width+.5&&observed.overflow<=1&&observed.activeInside,observed);
 if(observed.width<760&&observed.height>observed.width)check(`${name}: mobile panel is a bottom sheet`,observed.bottom<=observed.height+1&&observed.bottom>=observed.height-24,observed);
}
async function closeAndResume(page,name,origin,escape=false){
 if(escape)await page.keyboard.press('Escape');else await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel').open);
 check(`${name}: closing removes iframe and dialog media`,await page.locator('#panel-content iframe,#panel-content video').count()===0);
 check(`${name}: closing restores the original lobby trigger`,await origin.evaluate(el=>el===document.activeElement));
 check(`${name}: home navigation becomes current again`,await page.locator('.world-nav [data-view="home"]').getAttribute('aria-current')==='page');await advance(page,name);
}
async function panels(page,name){
 const primaryButton=primary(page);await primaryButton.click();await page.locator('#world-panel').waitFor({state:'visible'});check(`${name}: main play action opens three-game selection`,await page.locator('#panel-content [data-game]').count()===3);await panelGeometry(page,`${name}/primary`);await snap(page,`${name}-play-sheet`);await closeAndResume(page,`${name}/primary`,primaryButton,true);
 for(const view of ['play','wardrobe','me']){
  const origin=page.locator(`.world-nav [data-view="${view}"]`);await origin.click();await page.locator('#world-panel').waitFor({state:'visible'});check(`${name}/${view}: navigation opens a named panel`,Boolean((await page.locator('#panel-title').textContent()).trim())&&await origin.getAttribute('aria-current')==='page');check(`${name}/${view}: background pauses below the panel`,await page.locator('.scene-video').evaluate(v=>v.paused));await panelGeometry(page,`${name}/${view}`);
  if(view==='play')check(`${name}: navigation play sheet includes all three games`,await page.locator('#panel-content [data-game]').count()===3);
  if(view==='wardrobe'||view==='me'){const link=await page.locator('#panel-content a.felt-button').getAttribute('href');const url=new URL(link,`${base}/brand-opening/home.html`);check(`${name}/${view}: existing account flow remains the destination`,['/mobile.html','/desktop.html'].includes(url.pathname)&&url.searchParams.get('opening')==='off'&&(view!=='wardrobe'||url.searchParams.get('wardrobe')==='1'),link);}
  await closeAndResume(page,`${name}/${view}`,origin,view!=='wardrobe');
 }
}
async function embeddedGames(page,name){
 for(const [id,heading,route]of [['runner','바람길','/korean-runner/'],['hangul','가나다부터','/hangul-stage/'],['rhythm','말의 리듬','/korean-rhythm/']]){
  const origin=primary(page);await origin.click();await page.locator(`#panel-content [data-game="${id}"]`).click();const iframe=page.locator('#panel-content iframe');await iframe.waitFor();const frame=iframe.contentFrame();await frame.locator('h1').filter({hasText:heading}).first().waitFor({state:'visible',timeout:30000});await page.waitForFunction(()=>!document.querySelector('.frame-loader'));
  const info={name,id,source:await iframe.getAttribute('src'),title:await frame.locator('title').textContent(),heading:await frame.locator('h1').filter({hasText:heading}).first().textContent()};games.push(info);check(`${name}/${id}: actual game entrance loads`,new URL(info.source,`${base}/brand-opening/home.html`).pathname===route&&info.heading.includes(heading),info);check(`${name}/${id}: background stays paused behind game`,await page.locator('.scene-video').evaluate(v=>v.paused));
  await panelGeometry(page,`${name}/${id}`);await snap(page,`${name}-${id}-entrance`);await closeAndResume(page,`${name}/${id}`,origin,id==='hangul');
 }
}
async function settings(page,name){
 await page.locator('#settings-open').click();await page.locator('#reduce-motion').check();await page.locator('#panel-close').click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.scene-video')).opacity==='0');check(`${name}: manual reduced setting shows a still poster`,await page.evaluate(()=>document.querySelector('.scene-video').paused&&!document.querySelector('.maru-scene').classList.contains('is-playing')&&getComputedStyle(document.querySelector('.scene-video')).opacity==='0'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(400);check(`${name}: saved reduced setting prevents video sourcing on reload`,await page.locator('.scene-video').evaluate(v=>v.paused&&!v.getAttribute('src')));
 await page.locator('#settings-open').click();await page.locator('#reduce-motion').uncheck();await page.keyboard.press('Escape');await advance(page,`${name}/reduced-off`);
}
(async()=>{
 assert(fs.existsSync(path.join(__dirname,'../assets/home/sources.json')),'Home assets must be ready');fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
 async function create(name,width,height,reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width,height},hasTouch:name!=='desktop',reducedMotion});await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(!['GET','HEAD'].includes(req.method())||!['localhost','127.0.0.1'].includes(url.hostname)){blockedRequests.push({name,url:req.url(),method:req.method()});return route.abort();}return route.continue();});const page=await context.newPage();page.on('pageerror',error=>errors.push({name,message:error.message}));page.on('response',response=>{if(response.status()>=400)resources.push({name,url:response.url(),status:response.status()});});return {context,page};
 }
 try{
  for(const [name,width,height]of viewports){
   const {context,page}=await create(name,width,height);console.log(`Checking ${name}`);
   try{
    await page.goto(`${base}/brand-opening/home.html`,{waitUntil:'domcontentloaded'});await primary(page).waitFor();await assets(page,name);await scenePlaying(page);await layout(page,name);const v=await page.locator('.scene-video').evaluate(video=>({source:video.currentSrc,loop:video.loop,muted:video.muted,duration:video.duration}));check(`${name}: approved ten-second v9 shot plays silently in a full loop`,/world-menu-(mobile|desktop)-omni11-v9-web\.mp4$/.test(v.source)&&Math.abs(v.duration-10)<.1&&v.loop&&v.muted,v);await snap(page,`${name}-lobby`);await snap(page,`${name}-fullpage`,true);
    if(!layoutOnly){await panels(page,name);await embeddedGames(page,name);if(['mobile390','desktop'].includes(name))await settings(page,name);}save();
   }catch(error){check(`${name}: complete browser flow`,false,error.stack);await snap(page,`${name}-failure`).catch(()=>{});save();}finally{await context.close();}
  }
  if(!layoutOnly){
   const reducedContext=await create('os-reduced',390,844,'reduce');try{const page=reducedContext.page;await page.goto(`${base}/brand-opening/home.html`,{waitUntil:'domcontentloaded'});await primary(page).waitFor();await assets(page,'os-reduced');await page.waitForTimeout(400);check('OS reduced motion uses a poster without sourcing video',await page.locator('.scene-video').evaluate(v=>v.paused&&v.currentTime===0&&!v.getAttribute('src')));await page.locator('#settings-open').click();check('OS reduced motion is exposed by a checked disabled control',await page.locator('#reduce-motion').isChecked()&&await page.locator('#reduce-motion').isDisabled());await page.keyboard.press('Escape');await snap(page,'os-reduced-lobby');}catch(error){check('OS reduced flow',false,error.stack);}finally{await reducedContext.context.close();}
   for(const skip of [true,false]){const name=skip?'opening-company':'opening-title',{context,page}=await create(name,390,844);try{await page.goto(`${base}/brand-opening/index.html`,{waitUntil:'domcontentloaded'});await page.locator('.opening-enter').waitFor();if(!skip)await page.waitForFunction(()=>window.__synkOpening?.stage()==='title'&&document.querySelector('.opening-company').hidden);await page.locator('.opening-enter').click({position:{x:180,y:400}});await page.waitForURL('**/brand-opening/home.html');await primary(page).waitFor();check(`${name}: opening leads directly to the game lobby`,true);}catch(error){check(`${name}: lobby handoff`,false,error.stack);}finally{await context.close();}}
  }
  check('No browser JavaScript errors',errors.length===0,errors);check('No failed HTTP assets',resources.length===0,resources);check('No external or mutating request attempted',blockedRequests.length===0,blockedRequests);save();const failed=checks.filter(c=>!c.passed);console.log(JSON.stringify({passed:checks.length-failed.length,failed,errors,resources,output},null,2));assert.equal(failed.length,0,'Mobile lobby checks failed; see browser-result.json');
 }finally{await browser.close();}
})().catch(error=>{if(fs.existsSync(output))save();console.error(error.message);process.exitCode=1;});
