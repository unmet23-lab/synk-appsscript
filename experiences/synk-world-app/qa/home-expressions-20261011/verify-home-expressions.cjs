// Local isolated guests only. Real home flows + explicitly identified sprite rendering checks.
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../../../..'),base=process.env.SYNK_HOME_TUTOR_URL||'http://127.0.0.1:4314';
const out=path.resolve(__dirname,process.env.SYNK_HOME_EXPRESSION_RUN||'baseline');
const ids=(process.env.SYNK_MASCOT_IDS||'kkamong,marin,mongle').split(','),brief=process.argv.includes('--brief');
const checks=[],errors=[],missing=[],external=[],blockedWrites=[],captures=[],frames=[];
const EYES={marin:{centers:[.334,.666],y:.47,halfX:.13,halfY:.19},mongle:{centers:[.34,.66],y:.35,halfX:.09,halfY:.10},kkamong:{centers:[.30,245/480],y:148/480,halfX:.065,halfY:.075}};
const homePortrait='#home-tutor>.home-tutor-companion .game-tutor-portrait';
let browser,context,page,tutor,failure,dir;
fs.mkdirSync(out,{recursive:true});
const check=(name,pass,detail)=>{checks.push({tutor:tutor?.id,name,pass:!!pass,...(detail?{detail}:{})});console.log((pass?'PASS ':'FAIL ')+(tutor?.id||'')+' '+name);};
const click=selector=>page.locator(selector).evaluate(el=>el.click());
const home=()=>page.evaluate(()=>window.__synkHome.homeTutor());
const core=p=>JSON.stringify({lessons:p.lessons,reviews:p.reviews,activeLessonId:p.activeLessonId,activeReview:p.activeReview});
const progress=()=>page.evaluate(()=>window.__synkWorld.life().progress);
async function setup(view={width:390,height:844},desktop=false){
 context=await browser.newContext({viewport:view,hasTouch:!desktop,isMobile:!desktop,reducedMotion:'no-preference'});context.setDefaultTimeout(15000);
 await context.route('**/*',route=>{const req=route.request(),u=req.url();if(/^(blob|data):/.test(u))return route.continue();if(!u.startsWith(base+'/')){external.push(u);return route.abort();}if(!['GET','HEAD'].includes(req.method())){blockedWrites.push({url:u,method:req.method()});return route.abort();}return route.continue();});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/world/')&&!r.url().includes('favicon'))missing.push({url:r.url(),status:r.status()});});
 await page.clock.install();await page.goto(base+'/mobile.html?opening=off');await page.waitForFunction(()=>window.__synkWorld?.life()?.owner==='guest');
 await page.locator('.home-tutor-choose').click();await page.locator('[data-tutor-id='+tutor.id+']').click();await page.locator('[data-tutor-action=confirm]').click();await page.locator('[data-tutor-action=finish]').click();
 await page.waitForFunction(()=>window.__synkHome.homeTutor().recommendation.kind==='start');await page.evaluate(()=>document.fonts.ready);
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));
 check('selected tutor is guest-owned and greets on home',(await home()).tutor===tutor.id&&(await home()).owner==='guest');
}
async function end(){if(!context)return;await context.unrouteAll({behavior:'ignoreErrors'});await page.goto('about:blank');await context.close();context=null;}
async function state(selector=homePortrait){return page.locator(selector).evaluate(el=>{const b=el.querySelector('.game-tutor-body'),f=el.querySelector('.game-tutor-face'),r=el.getBoundingClientRect(),s=getComputedStyle(f);return {face:f.currentSrc,body:b.currentSrc,faceComplete:f.complete&&f.naturalWidth===480,emotion:el.closest('[data-face]')?.dataset.face,box:{x:r.x,y:r.y,width:r.width,height:r.height},bodyStyle:{filter:getComputedStyle(b).filter,transform:getComputedStyle(b).transform},faceStyle:{filter:s.filter,transform:s.transform},mask:s.maskImage,size:s.maskSize,position:s.maskPosition,repeat:s.maskRepeat,reaction:el.dataset.reaction,animations:el.getAnimations({subtree:true}).map(a=>({time:a.currentTime,state:a.playState}))};});}
async function shot(label,selector=homePortrait){await page.locator(selector+' .game-tutor-face').evaluate(el=>el.decode());const full=path.join(dir,label+'.png'),crop=path.join(dir,label+'-portrait.png'),before=await state(selector);await page.screenshot({path:crop,clip:before.box,animations:'allow'});await page.screenshot({path:full,animations:'allow'});captures.push(full,crop);return {file:crop,state:before};}
async function compareEyes(label,selector=homePortrait){
 // Freeze only the changing scene behind transparent sprite edges for RGB comparison.
 await page.evaluate(()=>document.querySelectorAll('video').forEach(video=>video.pause()));
 await page.locator(selector).evaluate(el=>{for(const a of el.getAnimations({subtree:true}))a.finish();});
 const actual=await shot(label,selector),face=page.locator(selector+' .game-tutor-face'),style=await face.getAttribute('style');let reference,baseOnly;
 try{await face.evaluate(el=>{el.style.setProperty('mask-image','none','important');el.style.setProperty('-webkit-mask-image','none','important');});reference=await page.screenshot({clip:actual.state.box,animations:'allow'});await face.evaluate(el=>el.style.setProperty('visibility','hidden','important'));baseOnly=await page.screenshot({clip:actual.state.box,animations:'allow'});}finally{await face.evaluate((el,s)=>s===null?el.removeAttribute('style'):el.setAttribute('style',s),style);}
 const result=await page.evaluate(async({a,b,c,g})=>{
  const load=async str=>{const img=new Image();img.src='data:image/png;base64,'+str;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return {img,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data};};
  const x=await load(a),y=await load(b),z=await load(c),n=Math.min(x.img.width,x.img.height),px=(x.img.width-n)/2,py=(x.img.height-n)/2;
  const eyes=g.centers.map(cx=>{let max=0,changed=0;for(let row=0;row<x.img.height;row++)for(let col=0;col<x.img.width;col++){if(((col+.5-px-cx*n)/(g.halfX*n))**2+((row+.5-py-g.y*n)/(g.halfY*n))**2>1)continue;let d=0;for(let ch=0;ch<3;ch++)d=Math.max(d,Math.abs(x.pixels[(row*x.img.width+col)*4+ch]-y.pixels[(row*y.img.width+col)*4+ch]));max=Math.max(max,d);if(d>2)changed++;}return {max,changed};});
  let bodyMax=0;for(let row=Math.ceil(x.img.height*.72);row<x.img.height;row++)for(let col=0;col<x.img.width;col++)for(let ch=0;ch<3;ch++)bodyMax=Math.max(bodyMax,Math.abs(x.pixels[(row*x.img.width+col)*4+ch]-z.pixels[(row*z.img.width+col)*4+ch]));
  const canvas=document.createElement('canvas');canvas.width=700;canvas.height=220;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,700,220);ctx.imageSmoothingEnabled=false;const crop={x:px+(g.centers[0]-g.halfX)*n,y:py+(g.y-g.halfY)*n,w:(g.centers[1]-g.centers[0]+g.halfX*2)*n,h:g.halfY*2*n};for(const [i,img]of[x.img,y.img].entries())ctx.drawImage(img,crop.x,crop.y,crop.w,crop.h,i*350+8,36,330,170);ctx.fillStyle='#222';ctx.font='14px sans-serif';ctx.fillText('Actual home mask',8,20);ctx.fillText('Same sprite with mask removed',358,20);
  return {eyes,bodyMax,zoom:canvas.toDataURL().split(',')[1]};
 },{a:fs.readFileSync(actual.file).toString('base64'),b:reference.toString('base64'),c:baseOnly.toString('base64'),g:EYES[tutor.id]});
 fs.writeFileSync(path.join(dir,label+'-eyes.png'),Buffer.from(result.zoom,'base64'));delete result.zoom;
 check(label+': rendered eyes match same unmasked sprite',result.eyes.every(e=>e.max<=2),{...result,state:actual.state});check(label+': torso brightness remains base',result.bodyMax<=2);return result;
}
async function blink(){for(let i=0;i<150;i++){await page.clock.runFor(50);if((await state()).emotion==='잔잔감음')return true;}return false;}
async function baseline(){
 await setup();await compareEyes('390-welcome');await page.clock.runFor(3000);
 // Real natural blink, then interrupt it through real navigation before 130ms restoration.
 check('natural idle blink occurs',await blink());await compareEyes('390-natural-blink');await click('.world-nav [data-view=play]');await page.clock.runFor(500);await click('#panel-close');
 await shot('390-return-during-blink');check('leaving during blink restores base on home return',(await state()).emotion==='기본',await state());
 await page.clock.runFor(1000);check('closed eyes do not remain one second after returning',(await state()).emotion==='기본',await state());
 // Explicit rendering probe, not a claim that home naturally uses surprise/retry.
 const original=await page.locator(homePortrait+' .game-tutor-face').getAttribute('src');
 for(const emotion of ['으쓱','놀람','민망'].filter(e=>tutor.images[e])){await page.locator(homePortrait+' .game-tutor-face').evaluate((el,file)=>el.src=new URL(file,el.src).href,tutor.images[emotion]);await compareEyes('390-explicit-'+emotion);}
 await page.locator(homePortrait+' .game-tutor-face').evaluate((el,src)=>el.src=src,original);
 if(brief){await end();return;}
 await learning();await responsive();await end();await desktop();
}
async function transition(label,selector,expected){
 // ms is cumulative JS test-clock advance. CSS currentTime is recorded separately;
 // page screenshots avoid locator.screenshot waiting for transforms to settle.
 const sequence=[];for(const ms of [0,80,180,350,700,1100]){if(sequence.length)await page.clock.runFor(ms-sequence.at(-1).ms);const record=await shot(label+'-'+ms+'ms',selector);sequence.push({ms,...record.state});}
 frames.push({tutor:tutor.id,label,sequence});check(label+': face remains intended across transition',sequence.every(s=>decodeURIComponent(s.face).includes('-'+expected+'.webp')));check(label+': body layer has no filter/transform changes',sequence.every(s=>s.bodyStyle.filter==='none'&&s.bodyStyle.transform==='none'),sequence.map(s=>({ms:s.ms,body:s.bodyStyle,face:s.faceStyle,box:s.box})));
}
async function learning(){
 // Discard the interrupted baseline reaction before the real educational flow.
 await page.clock.resume();await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind==='start');await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));
 await click('.home-tutor-action');await page.locator('[data-life-begin]').waitFor();await click('[data-life-begin]');
 while(await page.locator('[data-life-scene-next]').count())await click('[data-life-scene-next]');
 const {lessonById}=await import(pathToFileURL(path.join(root,'experiences/synk-world-app/life-content.mjs')).href),lesson=lessonById('greetings-expressions'),q=lesson.questions[0];
 await click('[data-life-choice='+q.choices.find(c=>c.id!==q.answerId).id+']');await click('#panel-close');
 check('real mistake becomes remembered home recommendation',(await home()).recommendation.id===q.id);await compareEyes('390-remembered');
 const before=await progress();await click('.home-tutor-action');await page.locator('.life-expression-practice[open]').waitFor();
 await click('[data-expression-choice='+q.review.choices.find(c=>c.id!==q.review.answerId).id+']');await compareEyes('390-practice-retry','.life-expression-practice .game-tutor-portrait');
 await click('[data-expression-choice='+q.review.answerId+']');await compareEyes('390-practice-success','.life-expression-practice .game-tutor-portrait');await click('.life-expression-return');
 const success=tutor.id==='marin'?'눈웃음':tutor.id==='kkamong'?'으쓱':'기쁨';
 check('home celebrates real guided success',(await home()).companion.kind==='practiceSuccess');await transition('390-home-success',homePortrait,success);await compareEyes('390-home-success-settled');
 check('guided practice leaves lesson/checkpoint grading intact',core(await progress())===core(before));
 await page.clock.runFor(1900);check('home success returns to base',(await state()).emotion==='기본',await state());
 await click('.home-tutor-day');await compareEyes('390-recap-before-finish','.home-day-tutor .game-tutor-portrait');
 await click('.home-day-finish');await transition('390-recap-success','.home-day-tutor .game-tutor-portrait',success);await compareEyes('390-recap-finished','.home-day-tutor .game-tutor-portrait');await click('.home-day-close');
 check('recap disposal removes its tutor and preserves one home companion',await page.locator('.home-day-recap').count()===0&&await page.locator('#home-tutor>.home-tutor-companion').count()===1);await page.clock.runFor(1000);await compareEyes('390-after-recap');
 // Repeat disposal at natural blink and inspect next-frame return without authored facial mutations.
 await page.clock.runFor(3000);check('home continues idle after dialog round trip',await blink());await click('.home-tutor-day');await page.clock.runFor(600);await click('.home-day-close');
 check('recap interruption also restores open eyes',(await state()).emotion==='기본',await state());
 await page.clock.resume();await page.reload();await page.waitForFunction(()=>window.__synkHome?.homeTutor()?.recommendation.kind!=='loading'&&window.__synkHome?.homeTutor()?.tutor);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+50));
 check('reload retains tutor and completed day',(await home()).tutor===tutor.id&&(await home()).days.today.closed);await compareEyes('390-return-visit');
}
async function responsive(){for(const view of [{width:320,height:568},{width:844,height:390},{width:390,height:844}]){
 await page.setViewportSize(view);await page.clock.runFor(150);await page.waitForFunction(expected=>document.documentElement.dataset.layout===expected,view.width>view.height?'landscape':'portrait');
 await compareEyes(view.width+'x'+view.height+'-home');await click('.home-tutor-day');await compareEyes(view.width+'x'+view.height+'-recap','.home-day-tutor .game-tutor-portrait');
 const layout=await page.locator('.home-day-recap').evaluate(el=>({scrollTop:el.scrollTop,overflow:el.scrollWidth-el.clientWidth,headingTop:el.querySelector('h3').getBoundingClientRect().top}));check(view.width+': recap starts with heading visible',layout.scrollTop===0&&layout.overflow<=1&&layout.headingTop>=0,layout);await click('.home-day-close');
 const box=await page.locator('#home-tutor').evaluate(el=>{const b=el.getBoundingClientRect();return {overflow:el.scrollWidth-el.clientWidth,x:b.x,right:b.right,y:b.y,bottom:b.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight};});check(view.width+': home stays within viewport without horizontal overflow',box.overflow<=1&&box.x>=0&&box.right<=box.viewportWidth+1&&box.bottom<=box.viewportHeight+1,box);
}}
async function desktop(){await setup({width:1440,height:900},true);check('desktop uses real fine pointer',await page.evaluate(()=>matchMedia('(pointer:fine)').matches));await compareEyes('1440-desktop-welcome');await page.clock.runFor(3000);check('desktop natural blink occurs',await blink());await compareEyes('1440-desktop-blink');await page.clock.runFor(150);check('desktop blink returns to base',(await state()).emotion==='기본');await end();}
(async()=>{try{const {TUTORS}=await import(pathToFileURL(path.join(root,'experiences/brand-opening/tutor-profiles.mjs')).href);browser=await chromium.launch({channel:'msedge',headless:true});for(const id of ids){tutor=TUTORS.find(t=>t.id===id);dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});await baseline();}}catch(e){failure=e.stack;console.error(failure);}finally{await end().catch(()=>{});await browser?.close();check('page errors zero',errors.length===0,errors);check('missing local resources zero',missing.length===0,missing);check('external requests zero',external.length===0,external);check('server writes zero',blockedWrites.length===0,blockedWrites);const report={url:base,scope:'local isolated guest; no account entry; natural UI flows and separately labeled explicit sprite QA',checks,errors,missing,external,blockedWrites,frames,captures,failure};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,total:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).map(c=>({tutor:c.tutor,name:c.name})),failure}));if(failure||checks.some(c=>!c.pass))process.exitCode=1;}})();
