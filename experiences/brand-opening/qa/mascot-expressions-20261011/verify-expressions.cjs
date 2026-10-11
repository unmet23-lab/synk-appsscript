// Scoped local QA: fresh guest contexts, no account entry, no server writes.
// --audit records visual mismatches without stopping. --selection skips learning flows.
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{pathToFileURL}=require('node:url');
const {finishPractice}=require('../practice-browser-helpers.cjs');
const root=path.resolve(__dirname,'../../../..');
const base=process.env.SYNK_TUTOR_QA_URL||'http://127.0.0.1:4314';
const outputRoot=process.env.SYNK_TUTOR_QA_OUTPUT||__dirname;
let out=outputRoot;const audit=process.argv.includes('--audit'),selectionOnly=process.argv.includes('--selection'),maskOnly=process.argv.includes('--mask');
const ids=(process.env.SYNK_MASCOT_IDS||'marin,mongle').split(',');
const EYES={marin:{centers:[.334,.666],y:.47,halfX:.13,halfY:.19},mongle:{centers:[.34,.66],y:.35,halfX:.09,halfY:.10}};
const successFace=()=>tutor.id==='marin'?'눈웃음':'기쁨';
const retryFace=()=>tutor.id==='marin'?'집중':'민망';
const checks=[],errors=[],missing=[],external=[],blockedWrites=[],images=[],served=new Map();
let browser,context,page,tutor,lessons,failure;
fs.mkdirSync(out,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(name,pass,detail)=>{checks.push({character:tutor?.id||null,name,pass:!!pass,...(detail?{detail}:{})});console.log((pass?'PASS ':'FAIL ')+name);if(!(audit&&name.includes('rendered eyes')))assert.ok(pass,name);};
const life=()=>page.evaluate(()=>window.__synkWorld.life());
const core=p=>JSON.stringify({lessons:p.lessons,reviews:p.reviews,activeLessonId:p.activeLessonId,activeReview:p.activeReview});
const assets=path.join(root,'experiences/brand-opening/assets/tutors');
const selectedPortrait='.tutor-portrait.large';
const lesson=id=>lessons.find(l=>l.id===id);
async function setup(width=390,{clock=false}={}){
 const viewport=typeof width==='object'?width:{width,height:width===390?844:980};
 context=await browser.newContext({viewport,isMobile:true,hasTouch:true,reducedMotion:clock?'no-preference':'reduce'});
 context.setDefaultTimeout(15000);
 await context.route('**/*',route=>{
  const req=route.request(),url=req.url();
  if(/^(blob|data):/.test(url))return route.continue();
  if(!url.startsWith(base+'/')){external.push(url);return route.abort();}
  if(!['GET','HEAD'].includes(req.method())){blockedWrites.push({method:req.method(),url});return route.abort();}
  return route.continue();
 });
 page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))missing.push({url:r.url(),status:r.status()});});
 if(clock)await page.clock.install();
 await page.goto(base+'/mobile.html?opening=off&tutor=choose');
 await page.waitForFunction(()=>window.__synkHome&&window.__synkWorld);
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('[data-tutor-id='+tutor.id+']').click();
 return page;
}
async function endContext(){
 if(!context)return;
 await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await context.close();context=null;
}
async function choose(){
 await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();
 check('chosen tutor belongs only to this isolated guest',await page.evaluate(id=>window.__synkHome.tutor().owner==='guest'&&window.__synkHome.tutor().tutor===id&&JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor===id,tutor.id));
}
async function closePanel(){if(await page.locator('#world-panel').evaluate(el=>el.open))await page.locator('#panel-close').click();}
async function portraitState(selector){
 return page.locator(selector).evaluate(el=>{
  const body=el.querySelector('.tutor-body,.game-tutor-body'),face=el.querySelector('.tutor-face,.game-tutor-face');
  const b=body.getBoundingClientRect(),p=el.getBoundingClientRect();
  const style=getComputedStyle(face);
  return {body:body.currentSrc,face:face.currentSrc,complete:face.complete&&face.naturalWidth===480,bodyWithinPortrait:{x:b.x-p.x,y:b.y-p.y,width:b.width,height:b.height},mask:style.maskImage,maskSize:style.maskSize,maskPosition:style.maskPosition,maskRepeat:style.maskRepeat};
 });
}
async function verifyAsset(url){
 if(served.has(url))return;
 const parsed=new URL(url),file=decodeURIComponent(parsed.pathname.split('/').at(-1));
 check('runtime image stays inside the selected mascot asset folder',parsed.origin===new URL(base).origin&&file.startsWith(tutor.id+'-')&&!file.includes('/')&&file.endsWith('.webp'),{url});
 const disk=fs.readFileSync(path.join(assets,file)),response=await context.request.get(url),bytes=await response.body();
 check(file+': served bytes and cache version match the generated file',response.status()===200&&sha(bytes)===sha(disk)&&parsed.searchParams.get('v')===sha(disk).slice(0,12),{url,sha256:sha(bytes)});
 served.set(url,sha(bytes));
}
async function compareRenderedEyes(label,selector,actualFile){
 const face=page.locator(selector+' .tutor-face,'+selector+' .game-tutor-face');
 const originalStyle=await face.getAttribute('style');let reference,baseOnly;
 try{
  await face.evaluate(img=>{img.style.setProperty('mask-image','none','important');img.style.setProperty('-webkit-mask-image','none','important');});
  reference=await page.locator(selector).screenshot({animations:'disabled'});
  await face.evaluate(img=>img.style.setProperty('visibility','hidden','important'));
  baseOnly=await page.locator(selector).screenshot({animations:'disabled'});
 }finally{
  await face.evaluate((img,value)=>value===null?img.removeAttribute('style'):img.setAttribute('style',value),originalStyle);
 }
 const value=await page.evaluate(async({actual,reference,baseOnly,geometry})=>{
  const load=async value=>{const img=new Image();img.src='data:image/png;base64,'+value;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {img,canvas:c,ctx,pixels:ctx.getImageData(0,0,c.width,c.height).data};};
  const a=await load(actual),b=await load(reference),base=await load(baseOnly),eyes=[];
  const size=Math.min(a.img.width,a.img.height),padX=(a.img.width-size)/2,padY=(a.img.height-size)/2;
  for(const x of geometry.centers){
   const r={x:Math.floor(padX+(x-geometry.halfX)*size),y:Math.floor(padY+(geometry.y-geometry.halfY)*size),w:Math.ceil(geometry.halfX*2*size),h:Math.ceil(geometry.halfY*2*size)};
   let max=0,sum=0,n=0,changed=0,outerCornerMax=0;
   for(let y=r.y;y<r.y+r.h;y++)for(let xx=r.x;xx<r.x+r.w;xx++){
    // The eye region is an ellipse. Rectangle corners are surrounding material.
    if(((xx+.5-(padX+x*size))/(geometry.halfX*size))**2+((y+.5-(padY+geometry.y*size))/(geometry.halfY*size))**2>1){
     for(let ch=0;ch<3;ch++)outerCornerMax=Math.max(outerCornerMax,Math.abs(a.pixels[(y*a.img.width+xx)*4+ch]-b.pixels[(y*b.img.width+xx)*4+ch]));continue;
    }
    let pixel=0;for(let ch=0;ch<3;ch++){const d=Math.abs(a.pixels[(y*a.img.width+xx)*4+ch]-b.pixels[(y*b.img.width+xx)*4+ch]);max=Math.max(max,d);sum+=d;n++;pixel=Math.max(pixel,d);}if(pixel>2)changed++;
   }
   eyes.push({side:eyes.length?'right':'left',maxChannelDiff:max,meanChannelDiff:sum/n,pixelsOver2:changed,outerCornerMax,region:{...r,shape:'ellipse'}});
  }
  const zoom=document.createElement('canvas');zoom.width=600;zoom.height=200;const ctx=zoom.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,600,200);ctx.imageSmoothingEnabled=false;
  const crop={x:Math.floor(padX+(geometry.centers[0]-geometry.halfX)*size),y:Math.floor(padY+(geometry.y-geometry.halfY)*size),w:Math.ceil((geometry.centers[1]-geometry.centers[0]+geometry.halfX*2)*size),h:Math.ceil(geometry.halfY*2*size)};
  ctx.drawImage(a.img,crop.x,crop.y,crop.w,crop.h,0,35,290,130);ctx.drawImage(b.img,crop.x,crop.y,crop.w,crop.h,310,35,290,130);ctx.fillStyle='#222';ctx.font='14px sans-serif';ctx.fillText('Actual masked UI',8,22);ctx.fillText('Same sprite, mask removed',318,22);
  let bodyMax=0,bodySum=0,bodyN=0;
  for(let y=Math.ceil(a.img.height*.72);y<a.img.height;y++)for(let x=0;x<a.img.width;x++)for(let ch=0;ch<3;ch++){
   const d=Math.abs(a.pixels[(y*a.img.width+x)*4+ch]-base.pixels[(y*a.img.width+x)*4+ch]);bodyMax=Math.max(bodyMax,d);bodySum+=d;bodyN++;
  }
  return {sameSize:a.img.width===b.img.width&&a.img.height===b.img.height,eyes,body:{maxChannelDiff:bodyMax,meanChannelDiff:bodySum/bodyN},zoom:zoom.toDataURL('image/png').split(',')[1]};
 },{actual:fs.readFileSync(actualFile).toString('base64'),reference:reference.toString('base64'),baseOnly:baseOnly.toString('base64'),geometry:EYES[tutor.id]});
 const zoomFile=path.join(out,label+'-eyes-compare.png');fs.writeFileSync(zoomFile,Buffer.from(value.zoom,'base64'));images.push(zoomFile);delete value.zoom;
 check(label+': both rendered eyes match the unmasked canonical sprite',value.sameSize&&value.eyes.every(e=>e.maxChannelDiff<=2),value);
 check(label+': torso brightness equals the fixed base render',value.body.maxChannelDiff<=2,value.body);
}
async function capture(label,selector,emotion,{body=null,speechSelector=null,compareBase=false}={}){
 // Finish intentional CSS hops before comparing the invariant sprite placement.
 await page.locator(selector).evaluate(el=>{for(const animation of el.getAnimations({subtree:true})){try{animation.finish();}catch{animation.pause();}}});
 await page.locator(selector+' .tutor-face,'+selector+' .game-tutor-face').evaluate(img=>img.decode());
 const state=await portraitState(selector),expected=new URL(tutor.images[emotion],'http://asset.invalid');
 check(label+': actual face is '+emotion,state.complete&&decodeURIComponent(new URL(state.face).pathname).endsWith('/'+decodeURIComponent(expected.pathname.slice(1)))&&new URL(state.face).search===expected.search,state);
 check(label+': approved base body and intrinsic SVG face mask remain intact',decodeURIComponent(new URL(state.body).pathname).endsWith('/'+tutor.id+'-기본.webp')&&state.mask.includes('/'+tutor.id+'-face-mask.svg')&&state.maskSize==='contain'&&state.maskPosition==='50% 50%'&&state.maskRepeat==='no-repeat'&&(!body||state.body===body.body&&JSON.stringify(state.bodyWithinPortrait)===JSON.stringify(body.bodyWithinPortrait)),state);
 if(speechSelector)check(label+': tutor dialogue remains visible',!!(await page.locator(speechSelector).textContent()).trim());
 const full=path.join(out,label+'.png'),crop=path.join(out,label+'-portrait.png');
 await page.screenshot({path:full,animations:'disabled'});await page.locator(selector).screenshot({path:crop,animations:'disabled'});images.push(full,crop);
 check(label+': screenshot retained the requested face',(await portraitState(selector)).face===state.face);
 if(emotion!=='기본'||compareBase)await compareRenderedEyes(label,selector,crop);
 await verifyAsset(state.face);return state;
}
async function selection(width){
 const view=width;await setup(view,{clock:true});width=typeof view==='object'?view.width+'x'+view.height:width;
 // Pause only this isolated test clock so the 240ms surprise face can be inspected.
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 await page.locator('[data-tutor-reaction=intro]').evaluate(el=>el.click());
 const intro=await capture(width+'-intro',selectedPortrait,tutor.reactions.normal.뒤,{speechSelector:'#tutor-speech'});
 check(width+': introduction keeps canonical selected mascot wording',await page.locator('#tutor-speech').textContent()===tutor.card.자기소개);
 for(const [kind,emotion,field]of [['success','기쁨','잘했을때'],['retry',retryFace(),'틀렸을때']]){
  await page.locator('[data-tutor-reaction='+kind+']').evaluate(el=>el.click());
  await capture(width+'-'+kind,selectedPortrait,emotion,{body:intro,speechSelector:'#tutor-speech'});
  check(width+': '+kind+' keeps canonical selected mascot wording',await page.locator('#tutor-speech').textContent()===tutor.card[field]);
 }
 await page.clock.runFor(2200);await capture(width+'-rest',selectedPortrait,'기본',{body:intro});
 await page.locator('[data-tutor-action=touch]').evaluate(el=>el.click());
 await capture(width+'-touch-surprise',selectedPortrait,'놀람',{body:intro,speechSelector:'#tutor-speech'});
 await page.clock.runFor(250);await capture(width+'-touch-proud',selectedPortrait,tutor.reactions.normal.뒤,{body:intro});
 // Repeated greetings also use the new shy face, not a stale cached variant.
 for(let i=0;i<2;i++){await page.locator('[data-tutor-action=touch]').evaluate(el=>el.click());await page.clock.runFor(250);}
 await capture(width+'-touch-shy',selectedPortrait,'민망',{body:intro});
 await page.clock.runFor(2200);check(width+': greeting returns to base',(await portraitState(selectedPortrait)).face===(await portraitState(selectedPortrait)).body);
 let blink=false;
 for(let n=0;n<140;n++){
  await page.clock.runFor(50);
  if(decodeURIComponent(new URL((await portraitState(selectedPortrait)).face).pathname).endsWith('/'+tutor.id+'-잔잔감음.webp')){blink=true;break;}
 }
 check(width+': natural idle blink occurs',blink);
 if(blink){await capture(width+'-idle-blink',selectedPortrait,'잔잔감음',{body:intro});await page.clock.runFor(200);check(width+': idle blink returns to base',(await portraitState(selectedPortrait)).face===(await portraitState(selectedPortrait)).body);}
 check(width+': preview does not save tutor selection',await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null));
 await page.clock.resume();await endContext();
}
async function responsiveSelection(view){
 await setup(view,{clock:true});await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 const size=view.width+'x'+view.height;
 for(const [kind,emotion]of [['success','기쁨'],['retry',retryFace()]]){
  await page.locator('[data-tutor-reaction='+kind+']').evaluate(el=>el.click());
  await capture(size+'-'+kind,selectedPortrait,emotion,{speechSelector:'#tutor-speech'});
 }
 await page.locator('[data-tutor-action=touch]').evaluate(el=>el.click());
 await capture(size+'-surprise',selectedPortrait,'놀람',{speechSelector:'#tutor-speech'});
 await page.clock.runFor(2200);check(size+': compact or landscape returns to base',(await portraitState(selectedPortrait)).face===(await portraitState(selectedPortrait)).body);
 check(size+': preview keeps guest selection unsaved',await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null));
 await page.clock.resume();await endContext();
}
async function spriteSweep(){
 // Explicit sprite QA, not evidence that gameplay naturally triggered these faces.
 await setup(648,{clock:true});await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
 await page.locator(selectedPortrait).evaluate(el=>{for(const animation of el.getAnimations({subtree:true})){try{animation.finish();}catch{animation.pause();}}});
 const original=await portraitState(selectedPortrait),visited=[];
 for(const [emotion,file]of Object.entries(tutor.images)){
  await page.locator(selectedPortrait+' .tutor-face').evaluate((img,file)=>{img.src=new URL(file,img.currentSrc).href;},file);
  await capture('sprite-'+emotion,selectedPortrait,emotion,{body:original,compareBase:true});visited.push(emotion);
 }
 check('explicit sprite QA covers every profile image, including sleep',visited.length===Object.keys(tutor.images).length&&visited.includes('졸림'),{mode:'explicit-src-render',visited});
 await page.locator(selectedPortrait+' .tutor-face').evaluate((img,file)=>{img.src=new URL(file,img.currentSrc).href;},tutor.images.기본);
 await capture('sprite-restored-base',selectedPortrait,'기본',{body:original,compareBase:true});
 check('explicit sprite QA leaves guest choice unsaved',await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')===null));
 await page.clock.resume();await endContext();
}
async function guided(q,label){
 const before=await life();await page.locator('[data-life-tutor-retry]').click();await page.locator('.life-expression-practice[open]').waitFor();
 const portrait='.life-expression-practice .game-tutor-portrait',baseState=await portraitState(portrait);
 await page.locator('[data-expression-choice='+q.review.choices.find(c=>c.id!==q.review.answerId).id+']').click();
 check(label+': actual guided wrong answer remains retryable',(await life()).tutor.practice.correct===false&&await page.locator('.life-expression-return').isDisabled());
 await capture(label+'-guided-retry',portrait,retryFace(),{body:baseState,speechSelector:'.life-expression-tutor'});
 await page.locator('[data-expression-choice='+q.review.answerId+']').click();
 await capture(label+'-guided-success',portrait,successFace(),{body:baseState,speechSelector:'.life-expression-tutor'});
 check(label+': rehearsal preserves first answer and physical checkpoint',core((await life()).progress)===core(before.progress)&&JSON.stringify((await life()).cafe)===JSON.stringify(before.cafe));
 await page.locator('.life-expression-return').click();
 check(label+': return uses the same selected mascot companion',(await life()).tutor.tutor===tutor.id&&(await life()).tutor.kind==='practiceSuccess');
}
async function lifeAndCafe(){
 await setup();await choose();
 await page.locator('[data-life-library],[data-life-packs]').first().click();await page.locator('[data-life-pack=greetings]').click();await page.locator('[data-life-lesson=greetings-expressions]').click();
 await page.locator('[data-life-begin]').click();while(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();
 const l=lesson('greetings-expressions'),q=l.questions[0],portrait='.life-tutor .game-tutor-portrait',before=await portraitState(portrait);
 await page.locator('[data-life-choice='+q.choices.find(c=>c.id!==q.answerId).id+']').click();
 check('life: a real wrong answer triggers the selected tutor',(await life()).tutor.kind==='retry'&&(await life()).tutor.tutor===tutor.id);
 await capture('life-retry',portrait,retryFace(),{body:before,speechSelector:'.life-tutor .game-tutor-line'});await guided(q,'life');
 await page.locator('[data-life-question-next]').click();await page.locator('[data-life-choice='+l.questions[1].answerId+']').click();
 await capture('life-success',portrait,successFace(),{speechSelector:'.life-tutor .game-tutor-line'});await closePanel();
 await page.locator('[data-view=cafe]').click();const cafe=lesson('cafe-visit-soldout');await page.locator('.cafe-visit-list [data-life-lesson='+cafe.id+']').click();
 await page.locator('[data-life-cafe-mode=read]').click();await page.locator('[data-life-cafe-next]').click();
 const cq=cafe.questions[0],cafeBody=await portraitState(portrait);
 await page.locator('[data-life-cafe-choice='+cq.choices.find(c=>c.id!==cq.answerId).id+']').click();
 check('cafe: actual unavailable order produces repair and selected tutor',(await life()).cafe.phase==='repair'&&(await life()).tutor.kind==='retry'&&(await life()).tutor.tutor===tutor.id);
 await capture('cafe-retry',portrait,retryFace(),{body:cafeBody,speechSelector:'.life-tutor .game-tutor-line'});await guided(cq,'cafe');
 await page.locator('[data-life-cafe-choice='+cq.answerId+']').click();
 check('cafe: corrected order preserves its first wrong answer',(await life()).cafe.phase==='response'&&(await life()).progress.lessons[cafe.id].answers[cq.id].correct===false);
 await capture('cafe-corrected',portrait,successFace(),{speechSelector:'.life-tutor .game-tutor-line'});await closePanel();
 check('life and cafe keep the owner guest',(await life()).owner==='guest');await endContext();
}
async function hangulAnswer(frame,wrong){
 for(let i=0;i<20;i++){
  await frame.locator('#stage').evaluate(async el=>{while(el.inert)await new Promise(r=>setTimeout(r,50));});
  const step=await frame.locator('body').evaluate(()=>window.__hangulQA.step());
  if(['reason','meet'].includes(step.kind)){await frame.locator('#dock .felt-cta').click();continue;}
  const item=step.item;
  assert.ok(['listen_pick','pair','teach','see_pick'].includes(item.type),'early Hangul choice exists');
  const index=item.options.findIndex(o=>wrong?o.text!==item.target.text:o.text===item.target.text);
  await frame.locator('.options .opt').nth(index).click();
  if(item.type==='see_pick')await frame.locator('#dock .felt-cta').click();return;
 }
 throw Error('No Hangul answer reached');
}
async function game(){
 await setup();await choose();await page.locator('[data-view=play]').click();await page.locator('[data-game=hangul]').click();
 await page.locator('.game-tutor[data-tutor-game=hangul]').waitFor();if(await page.locator('.tutor-practice[open]').count())await finishPractice(page);
 if(await page.locator('.game-tutor-guide[open]').count())await page.locator('.game-tutor-continue').click();
 await page.locator('.game-frame').evaluate(frame=>{const u=new URL(frame.src);u.searchParams.set('qa','silent');frame.src=u.href;});
 const frame=page.frameLocator('.game-frame');await frame.locator('body[data-game-tutor='+tutor.id+']').waitFor();
 const portrait='.game-tutor[data-tutor-game=hangul] .game-tutor-portrait',before=await portraitState(portrait);
 await frame.locator('#start').click();await hangulAnswer(frame,true);
 await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='retry');
 await capture('game-hangul-retry',portrait,retryFace(),{body:before,speechSelector:'.game-tutor[data-tutor-game=hangul] .game-tutor-line'});
 await frame.locator('#dock .felt-cta').click();await hangulAnswer(frame,false);
 await page.waitForFunction(()=>window.__synkGameTutor.metrics().kind==='success');
 await capture('game-hangul-success',portrait,successFace(),{body:before,speechSelector:'.game-tutor[data-tutor-game=hangul] .game-tutor-line'});
 check('game keeps the chosen guest tutor',await page.evaluate(id=>window.__synkGameTutor.metrics().tutor===id&&window.__synkHome.tutor().owner==='guest',tutor.id));
 await closePanel();check('closing game removes its tutor',await page.evaluate(()=>!window.__synkGameTutor));await endContext();
}
(async()=>{
 const tutors=(await import(pathToFileURL(path.join(root,'experiences/brand-opening/tutor-profiles.mjs')).href)).TUTORS;
 lessons=(await import(pathToFileURL(path.join(root,'experiences/synk-world-app/life-content.mjs')).href)).LESSONS;
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const id of ids){
  tutor=tutors.find(t=>t.id===id);assert.ok(tutor&&EYES[id],'known inspected tutor');out=path.join(outputRoot,id);fs.mkdirSync(out,{recursive:true});
  for(const [emotion,url]of Object.entries(tutor.images)){
   const u=new URL(url,'http://asset.invalid'),file=decodeURIComponent(u.pathname.slice(1));
   check(id+' '+emotion+': profile version equals file content hash',u.searchParams.get('v')===sha(fs.readFileSync(path.join(assets,file))).slice(0,12));
  }
  if(maskOnly){await responsiveSelection({width:648,height:980});await responsiveSelection({width:844,height:390});}
  else {await selection(648);if(!selectionOnly){await spriteSweep();await selection(390);await responsiveSelection({width:320,height:568});await responsiveSelection({width:844,height:390});await lifeAndCafe();await game();}}
 }
 check('no browser errors, missing assets, external calls or server writes',!errors.length&&!missing.length&&!external.length&&!blockedWrites.length,{errors,missing,external,blockedWrites});
})().catch(e=>{failure=e;console.error(e.stack);process.exitCode=1;}).finally(async()=>{
 if(failure&&page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
 fs.writeFileSync(path.join(outputRoot,'report.json'),JSON.stringify({ok:!failure&&checks.every(c=>c.pass),audit,selectionOnly,maskOnly,tutors:ids,at:new Date().toISOString(),base,checks,errors,missing,external,blockedWrites,images,served:[...served].map(([url,sha256])=>({url,sha256})),...(failure?{failure:failure.stack}:{})},null,2)+'\n');
 if(context)await context.close().catch(()=>{});await browser?.close();
});
