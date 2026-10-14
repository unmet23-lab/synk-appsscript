const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const base=process.env.SYNK_OPENING_QA_URL||'http://127.0.0.1:4307';
const layoutOnly=process.argv.includes('--layout-only');
const output=path.join(__dirname,'maru-v1'),manifest=path.join(__dirname,'../assets/home/sources.json');
const checks=[],errors=[],resources=[],blockedRequests=[],layouts=[],screenshots=[],captureHashes=[],games=[];
const resultFile=path.join(output,layoutOnly?'layout-result.json':'browser-result.json');
function check(name,passed,details){checks.push({name,passed:Boolean(passed),...(details===undefined?{}:{details})});}
function save(){fs.writeFileSync(resultFile,JSON.stringify({date:'2026-10-10',base,layoutOnly,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed),checks,layouts,games,screenshots,captureHashes,errors,resources,blockedRequests,scope:layoutOnly?'Independent headless Edge; five viewport sizes, first-screen primary action visibility, asset loading, video playback, and refreshed screenshots only. Functional game/panel checks are in browser-result.json.':'Independent headless Edge; five viewport sizes, first-screen primary action visibility, and real embedded game entrance headings. No game was started, account created, or paid AI request made. This is browser emulation, not a physical-device test.'},null,2)+'\n');}
async function snap(page,name,fullPage=false){const file=path.join(output,`${name}.jpg`);await page.screenshot({path:file,type:'jpeg',quality:85,fullPage});screenshots.push(file);const bytes=fs.readFileSync(file);captureHashes.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,fullPage});}
async function scenePlaying(page){await page.locator('.maru-scene').scrollIntoViewIfNeeded();await page.waitForFunction(()=>{const v=document.querySelector('.scene-video');return v&&!v.paused&&v.currentTime>.1&&document.querySelector('.maru-scene').classList.contains('is-playing');},null,{timeout:20000});}
async function assets(page,name){
 const result=await page.evaluate(async()=>{
  await document.fonts.ready;
  const fonts=await Promise.all(['HomeSUIT','HomeInter','HomeMono'].map(async family=>{await document.fonts.load(`500 15px ${family}`);return {family,ready:document.fonts.check(`500 15px ${family}`)};}));
  const images=await Promise.all([...document.images].map(async img=>{try{await img.decode();return {source:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight};}catch{return {source:img.currentSrc||img.src,width:0,height:0};}}));
  const urls=[...new Set([...document.querySelectorAll('body *')].flatMap(el=>[...getComputedStyle(el).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1])))];
  const backgrounds=await Promise.all(urls.map(source=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({source,width:image.naturalWidth});image.onerror=()=>resolve({source,width:0});image.src=source;})));
  return {fonts,images,backgrounds};
 });
 check(`${name}: all required image assets decode`,result.images.every(i=>i.width>0),result.images);
 check(`${name}: felt backgrounds decode`,result.backgrounds.length>0&&result.backgrounds.every(i=>i.width>0),result.backgrounds);
 check(`${name}: SUIT, Inter and DM Mono load`,result.fonts.every(f=>f.ready),result.fonts);
}
async function layout(page,name){
 const result=await page.evaluate(()=>{
  const tiny=[],overflow=[];let minimum=Infinity;
  const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0;};
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
   const node=walker.currentNode,el=node.parentElement,text=node.textContent.trim();if(!text||!visible(el)||el.closest('[aria-hidden="true"],script,style,noscript,.skip-link'))continue;
   const size=parseFloat(getComputedStyle(el).fontSize);if(size===0)continue;const range=document.createRange();range.selectNodeContents(node);
   if(![...range.getClientRects()].some(r=>r.width>0&&r.height>0))continue;minimum=Math.min(minimum,size);if(size<11)tiny.push({text,size});
  }
  for(const el of document.querySelectorAll('.world-shell button,.world-shell a,.world-shell h1,.world-shell h2,.world-shell p')){if(!visible(el))continue;const r=el.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5)overflow.push({tag:el.tagName,cls:el.className,text:el.textContent.trim().slice(0,60),left:r.left,right:r.right});}
  const primary=document.querySelector('.primary-play').getBoundingClientRect(),nav=document.querySelector('.world-nav').getBoundingClientRect();
  return {width:innerWidth,height:innerHeight,scrollY,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,minimumTextPx:minimum,tiny,overflow,primary:{top:primary.top,bottom:primary.bottom},nav:{top:nav.top}};
 });layouts.push({name,...result});check(`${name}: zero horizontal overflow`,result.horizontalOverflow===0&&result.overflow.length===0,result);check(`${name}: rendered text is at least 11px`,result.tiny.length===0&&result.minimumTextPx>=11,result.tiny);
 if(result.width<760)check(`${name}: primary play button is fully visible above the bottom navigation before scrolling`,result.scrollY===0&&result.primary.top>=0&&result.primary.bottom<=result.nav.top,{scrollY:result.scrollY,primary:result.primary,nav:result.nav});
}
async function closeAndResume(page,name,origin,escape=false){
 if(escape)await page.keyboard.press('Escape');else await page.locator('#panel-close').click();
 await page.waitForFunction(()=>!document.querySelector('#world-panel').open);
 check(`${name}: closing removes embedded media`,await page.locator('#panel-content iframe,#panel-content video').count()===0);
 check(`${name}: closing restores trigger focus`,await origin.evaluate(el=>el===document.activeElement));
 await scenePlaying(page);const before=await page.locator('.scene-video').evaluate(v=>v.currentTime);await page.waitForTimeout(400);const after=await page.locator('.scene-video').evaluate(v=>v.currentTime);
 check(`${name}: visible main video resumes and advances`,Math.abs(after-before)>.1,{before,after});
}
async function panelFlows(page,name){
 for(const [view,title]of [['play','놀이'],['wardrobe','옷장'],['me','내 계정']]){
  const origin=page.locator(`.world-nav [data-view="${view}"]`);await origin.click();await page.locator('#world-panel').waitFor({state:'visible'});
  check(`${name}/${view}: panel heading and navigation state`,await page.locator('#panel-title').textContent()===title&&await origin.getAttribute('aria-current')==='page');
  check(`${name}/${view}: main scene pauses under dialog`,await page.locator('.scene-video').evaluate(v=>v.paused));
  if(view==='play')check(`${name}: play selector exposes three entrances`,await page.locator('#panel-content [data-game]').count()===3);
  if(view==='wardrobe')check(`${name}: wardrobe keeps existing account entrance`,await page.locator('#panel-content a.felt-button').getAttribute('href')==='../mobile.html?wardrobe=1&opening=off');
  if(view==='me')check(`${name}: profile keeps existing account entrance`,await page.locator('#panel-content a.felt-button').getAttribute('href')==='../mobile.html?opening=off');
  await closeAndResume(page,`${name}/${view}`,origin,true);
 }
}
async function gameFlows(page,name){
 for(const [id,heading,route]of [['runner','바람길','/korean-runner/'],['hangul','가나다부터','/hangul-stage/'],['rhythm','말의 리듬','/korean-rhythm/']]){
  const origin=page.locator(`#home-main [data-game="${id}"]`).first();await origin.click();const iframe=page.locator('#panel-content iframe');await iframe.waitFor();
  const frame=await iframe.contentFrame();await frame.locator('h1').filter({hasText:heading}).first().waitFor({state:'visible',timeout:30000});
  const info={name,id,url:await iframe.getAttribute('src'),title:await frame.locator('title').textContent(),heading:await frame.locator('h1').filter({hasText:heading}).first().textContent()};games.push(info);
  check(`${name}/${id}: real game entrance heading loads`,new URL(info.url,`${base}/brand-opening/home.html`).pathname===route&&info.heading.includes(heading),info);
  check(`${name}/${id}: scene paused while game is open`,await page.locator('.scene-video').evaluate(v=>v.paused));
  await page.waitForFunction(()=>!document.querySelector('.frame-loader'));await snap(page,`${name}-${id}-entrance`);
  await closeAndResume(page,`${name}/${id}`,origin,id==='hangul');
 }
}
async function settingsFlow(page,name){
 const origin=page.locator('#settings-open');await origin.click();await page.locator('#reduce-motion').check();await page.locator('#panel-close').click();
 check(`${name}: reduced setting pauses video and shows poster`,await page.evaluate(()=>document.querySelector('.scene-video').paused&&!document.querySelector('.maru-scene').classList.contains('is-playing')&&getComputedStyle(document.querySelector('.scene-video')).opacity==='0'&&localStorage.getItem('synk.world.maru.reduced')==='true'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(400);
 check(`${name}: reduced preference survives reload without video source`,await page.locator('.scene-video').evaluate(v=>v.paused&&!v.getAttribute('src')));
 await origin.click();await page.locator('#reduce-motion').uncheck();await page.keyboard.press('Escape');await scenePlaying(page);check(`${name}: leaving reduced setting restores playback`,true);
}
(async()=>{
 assert(fs.existsSync(manifest),'Home asset sources.json must be ready before QA');fs.mkdirSync(output,{recursive:true});JSON.parse(fs.readFileSync(manifest,'utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 async function contextFor(name,width,height,reducedMotion='no-preference'){
  const context=await browser.newContext({viewport:{width,height},hasTouch:name!=='desktop',reducedMotion});
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method())||!['127.0.0.1','localhost'].includes(url.hostname)){blockedRequests.push({name,url:request.url(),method:request.method()});return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push({name,message:e.message}));page.on('response',r=>{if(r.status()>=400)resources.push({name,url:r.url(),status:r.status()});});return {context,page};
 }
 try{
  for(const [name,width,height]of [['mobile390',390,844],['mobile320',320,740],['mobile322',322,704],['desktop',1440,1000],['landscape',844,390]]){
   const {context,page}=await contextFor(name,width,height);console.log(`Checking ${name}`);
   try{
    await page.goto(`${base}/brand-opening/home.html`,{waitUntil:'domcontentloaded'});await page.locator('h1').waitFor();await assets(page,name);await scenePlaying(page);await layout(page,name);
    const video=await page.locator('.scene-video').evaluate(v=>({src:v.currentSrc,duration:v.duration,loop:v.loop,muted:v.muted}));check(`${name}: current v9 scene uses matching responsive source`,video.src.endsWith(`world-menu-${width<760?'mobile':'desktop'}-omni11-v9-web.mp4`)&&Math.abs(video.duration-10)<.1&&video.loop&&video.muted,video);
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await snap(page,`${name}-first-viewport`);await snap(page,`${name}-fullpage`,true);
    if(!layoutOnly){await panelFlows(page,name);if(['mobile390','desktop'].includes(name)){await gameFlows(page,name);await settingsFlow(page,name);}}save();
   }catch(e){check(`${name}: complete browser flow`,false,e.stack);await snap(page,`${name}-failure`).catch(()=>{});save();}finally{await context.close();}
  }
  if(!layoutOnly){
  {
   const {context,page}=await contextFor('os-reduced',390,844,'reduce');try{await page.goto(`${base}/brand-opening/home.html`,{waitUntil:'domcontentloaded'});await assets(page,'os-reduced');await page.waitForTimeout(500);check('OS reduced motion never starts or sources background video',await page.locator('.scene-video').evaluate(v=>v.paused&&!v.getAttribute('src')&&v.currentTime===0));await page.locator('#settings-open').click();check('OS reduced motion is reflected by a checked disabled control',await page.locator('#reduce-motion').isChecked()&&await page.locator('#reduce-motion').isDisabled());await page.keyboard.press('Escape');await page.locator('#scene-open').click();check('OS reduced scene enlargement remains a still image',await page.locator('#panel-content img').count()===1&&await page.locator('#panel-content video').count()===0);await page.keyboard.press('Escape');await snap(page,'os-reduced-poster');}catch(e){check('OS reduced flow',false,e.stack);}finally{await context.close();}
  }
  for(const [name,skip]of [['opening-title',false],['opening-company',true]]){
   const {context,page}=await contextFor(name,390,844);try{await page.goto(`${base}/brand-opening/index.html`,{waitUntil:'domcontentloaded'});await page.locator('.opening-enter').waitFor();if(!skip)await page.waitForFunction(()=>window.__synkOpening?.stage()==='title'&&document.querySelector('.opening-company').hidden);await page.locator('.opening-enter').click({position:{x:180,y:400}});await page.waitForURL('**/brand-opening/home.html');await page.locator('h1').waitFor();check(`${name}: opening click enters the new home`,await page.locator('h1').textContent()==='오늘은 어디로 가볼까?');}catch(e){check(`${name}: home handoff`,false,e.stack);}finally{await context.close();}
  }
  }
  check('No page JavaScript errors',errors.length===0,errors);check('No failed HTTP assets',resources.length===0,resources);check('No mutating or external network calls attempted',blockedRequests.length===0,blockedRequests);save();
  const failures=checks.filter(c=>!c.passed);console.log(JSON.stringify({passed:checks.length-failures.length,failed:failures,errors,resources,output},null,2));assert.equal(failures.length,0,'Maru QA checks failed; see browser-result.json');
 }finally{await browser.close();}
})().catch(error=>{if(fs.existsSync(output))save();console.error(error.message);process.exitCode=1;});
