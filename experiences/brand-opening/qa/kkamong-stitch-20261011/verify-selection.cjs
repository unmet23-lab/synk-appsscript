const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const base='http://127.0.0.1:4314',out=__dirname,root=path.resolve(__dirname,'../../../..');
const checks=[],errors=[],missing=[],external=[],seen=[];let browser,context,page,failure;
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{})});console.log((pass?'PASS ':'FAIL ')+name);assert.ok(pass,name);};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const pictureState=()=>page.locator('.tutor-portrait.large').evaluate(el=>{const body=el.querySelector('.tutor-body'),face=el.querySelector('.tutor-face'),r=body.getBoundingClientRect(),p=el.getBoundingClientRect();return {body:body.currentSrc,face:face.currentSrc,bodyBounds:{x:r.x,y:r.y,width:r.width,height:r.height},bodyWithinPortrait:{x:r.x-p.x,y:r.y-p.y,width:r.width,height:r.height},mask:getComputedStyle(face).maskImage,complete:face.complete&&face.naturalWidth===480};});
async function capture(label){
 await page.locator('.tutor-portrait.large .tutor-face').evaluate(img=>img.decode());
 await page.screenshot({path:path.join(out,label+'.png')});
 await page.locator('.tutor-portrait.large').screenshot({path:path.join(out,label+'-portrait.png')});
 return pictureState();
}
(async()=>{
 const {TUTORS}=await import(pathToFileURL(path.join(root,'experiences/brand-opening/tutor-profiles.mjs')).href),tutor=TUTORS.find(t=>t.id==='kkamong');
 const imageVersions=TUTORS.flatMap(t=>Object.entries(t.images).map(([emotion,url])=>{const parsed=new URL(url,'http://asset.invalid'),file=decodeURIComponent(parsed.pathname.slice(1)),safe=parsed.origin==='http://asset.invalid'&&file===`${t.id}-${emotion}.webp`,digest=safe?sha(fs.readFileSync(path.join(root,'experiences/brand-opening/assets/tutors',file))).slice(0,12):null;return {tutor:t.id,emotion,valid:safe&&parsed.search===`?v=${digest}`};}));
 check('all tutor image URLs retain exact current content hashes and safe file paths',imageVersions.length>0&&imageVersions.every(i=>i.valid),imageVersions);
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [390,648]){
  context=await browser.newContext({viewport:{width,height:width===390?844:980},isMobile:true,hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(12000);
  await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'/')||/^(data|blob):/.test(url))return route.continue();external.push(url);return route.abort();});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/tutors/'))seen.push({url:r.url(),status:r.status()});if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))missing.push({url:r.url(),status:r.status()});});
  await page.goto(base+'/mobile.html?opening=off&tutor=choose');await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);
  await page.evaluate(()=>document.fonts.ready);await page.locator('[data-tutor-id=kkamong]').click();
  const intro=await capture('phone'+width+'-intro');
  check(width+': selection uses canonical introduction',await page.locator('#tutor-speech').textContent()===tutor.card.자기소개);
  check(width+': introduction visibly loads the new stitched proud face',intro.complete&&decodeURI(new URL(intro.face).pathname).endsWith('/kkamong-으쓱.webp')&&new URL(intro.face).search===new URL(tutor.images.으쓱,'http://asset.invalid').search,intro);
  check(width+': portrait keeps the base underneath the face overlay',decodeURI(new URL(intro.body).pathname).endsWith('/kkamong-기본.webp')&&intro.mask.includes('radial-gradient'),intro);
  await page.locator('[data-tutor-reaction=success]').click();const success=await capture('phone'+width+'-success');
  check(width+': success visibly loads the new stitched smile and canonical praise',success.complete&&decodeURI(new URL(success.face).pathname).endsWith('/kkamong-기쁨.webp')&&await page.locator('#tutor-speech').textContent()===tutor.card.잘했을때,success);
  check(width+': body source and placement within its portrait remain fixed through both reactions',intro.body===success.body&&JSON.stringify(intro.bodyWithinPortrait)===JSON.stringify(success.bodyWithinPortrait));
  await page.waitForFunction(()=>{const el=document.querySelector('.tutor-portrait.large'),body=el?.querySelector('.tutor-body'),face=el?.querySelector('.tutor-face');return body&&face&&body.currentSrc===face.currentSrc;});
  const resting=await capture('phone'+width+'-rest');
  check(width+': expression returns to the actual base face after its reaction',resting.body===intro.body&&resting.face===resting.body&&JSON.stringify(resting.bodyWithinPortrait)===JSON.stringify(intro.bodyWithinPortrait),resting);
  for(const [emotion,url]of [['으쓱',intro.face],['기쁨',success.face]]){
   const response=await context.request.get(url),bytes=await response.body(),parsed=new URL(url),file=decodeURIComponent(parsed.pathname.split('/').at(-1)),disk=fs.readFileSync(path.join(root,'experiences/brand-opening/assets/tutors',file));
   check(width+': '+emotion+' served bytes and cache query match the generated asset',response.status()===200&&sha(bytes)===sha(disk)&&parsed.searchParams.get('v')===sha(disk).slice(0,12),{url,sha256:sha(bytes)});
  }
  check(width+': first-meeting preview does not save a tutor choice',await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null));
  await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await context.close();context=null;
 }
 check('no missing assets, JavaScript errors or external services',!errors.length&&!missing.length&&!external.length,{errors,missing,external});
})().catch(e=>{failure=e;console.error(e);process.exitCode=1;}).finally(async()=>{
 if(failure&&page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
 fs.writeFileSync(path.join(out,'selection-result.json'),JSON.stringify({ok:!failure,at:new Date().toISOString(),checks,errors,missing,external,seen,...(failure?{failure:failure.stack}:{})},null,2));
 if(context){await context.unrouteAll({behavior:'ignoreErrors'});await context.close();}await browser?.close();
});
