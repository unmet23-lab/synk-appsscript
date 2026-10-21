// Real browser evidence for the eighth local Town brand-art revision.
// Every page uses a fresh memory store; the user's 4288 save is never accessed.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output = path.join(__dirname, 'qa/graphics-v8'), snapshot = path.join(output, 'source-before');
const before = process.argv.includes('--before'), stage = before ? 'before' : 'after';
const baseline = JSON.parse(fs.readFileSync(path.join(output, 'baseline-hashes.json'), 'utf8').replace(/^\uFEFF/, ''));
const servers = [], checks = [], errors = [], consoleErrors = [], shaderWarnings = [], failedRequests = [], screenshots = [], metrics = {}, apiFailures = [];
const sourceFiles = baseline.map(row => row.name);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourcePath = file => before ? path.join(snapshot, baseline.find(row => row.name === file).snapshot) : path.join(__dirname, file);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, ok, details) => { checks.push({name,ok:!!ok,...(details === undefined ? {} : {details})}); console.log(`${ok?'PASS':'FAIL'} ${name}`); if (!ok) throw Error(name); };
const walk = page => page.evaluate(() => SYNKTownDay.metrics().walk);
const gameMetrics = page => page.evaluate(() => SYNKTownDay.metrics());
async function until(fn, name, ms=30000) { const end=Date.now()+ms; while(Date.now()<end) {if(await fn())return;await delay(65);}throw Error(`Timeout: ${name}`); }
async function fixture() {
  const {createStore,createServer} = await import(pathToFileURL(path.join(__dirname,'server.mjs')).href);
  const store=createStore({lifeEnabled:true}),server=createServer({previewEnabled:true,store});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);
  return {store,base:`http://127.0.0.1:${server.address().port}`};
}
async function observe(page,scope) {
  // Sample only after a completed scene frame. Input prediction runs at a faster
  // RAF rate than balanced rendering, so polling arbitrary callbacks mixes an
  // unrendered player pose with the previous camera and produces false lag.
  await page.addInitScript(()=>{const request=window.requestAnimationFrame.bind(window);window.comfortEvents=[];for(const type of['keydown','keyup','blur','focus','visibilitychange'])addEventListener(type,e=>{if(window.comfortRecord)comfortEvents.push({type,code:e.code,time:performance.now(),visibility:document.visibilityState,hasFocus:document.hasFocus()});});window.requestAnimationFrame=callback=>request(time=>{const result=callback(time);if(window.comfortRecord&&window.SYNKTownDay){const m=SYNKTownDay.metrics();if(m.frameCount!==window.comfortLastFrame){window.comfortLastFrame=m.frameCount;comfortSamples.push({time:performance.now(),phase:comfortPhase,frame:m.frameCount,pose:m.playerPose,position:m.cameraPosition,target:m.cameraTarget,screen:m.playerScreen,head:m.playerHeadScreen,direction:m.cameraDirection,fov:m.cameraFov,busy:document.getElementById('day-app').getAttribute('aria-busy'),focus:document.activeElement?.id,hasFocus:document.hasFocus(),contact:window.comfortPhase==='wall'?SYNKTownDay.snapshot().view.life?.contact:null,locomotion:m.locomotion,walk:m.walk,cpu:m.cpuRenderMs});}}return result;});});
  page.on('request',r=>{if(r.url().endsWith('/api/preview/command'))(metrics.commandLog||=[]).push({scope,time:Date.now(),body:r.postDataJSON()});});
  page.on('pageerror',e=>errors.push({scope,error:e.message}));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push({scope,error:m.text(),location:m.location()});else if(/WebGL|shader|framebuffer|GL_INVALID/i.test(m.text())&&m.type()==='warning')shaderWarnings.push({scope,warning:m.text()});});
  page.on('response',async r=>{if(r.status()>=400&&r.url().includes('/api/preview/'))apiFailures.push({scope,url:r.url(),status:r.status(),request:r.request().postDataJSON(),response:await r.json().catch(()=>null)});if(r.status()>=400&&/\.(mjs|js|webp|png|jpg)(\?|$)/.test(r.url()))failedRequests.push({scope,status:r.status(),url:r.url()});});
  page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText||''))failedRequests.push({scope,url:r.url(),error:r.failure()});});
  if(before) await page.route('**/*',async route=>{
    const name=new URL(route.request().url()).pathname.slice(1);
    const rel=name==='avatar-v3.mjs'||name==='avatar-textiles.mjs'?`shared/${name}`:name;
    const file=path.resolve(snapshot,rel);
    if(file.startsWith(snapshot+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()) return route.fulfill({status:200,contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(file)});
    return route.continue();
  });
}
async function shot(page,name) {const file=`${stage}-${name}.png`;await page.screenshot({path:path.join(output,file)});screenshots.push(file);}
async function quiet(page) {await until(async()=>{const w=await walk(page);return!w.moving&&!w.sending&&w.pending===0&&await page.locator('#day-app').getAttribute('aria-busy')!=='true';},'input settles');}
async function focus(page) {await page.bringToFront();await page.locator('#scene').focus();}
async function axis(page,dimension,target,tolerance=.10) {
  await focus(page);const end=Date.now()+22000;let pulse=0;
  while(Date.now()<end){const p=await walk(page),delta=target-p[dimension];if(Math.abs(delta)<=tolerance){(metrics.movementEndpoints||=[]).push({dimension,target,actual:p[dimension],x:p.x,z:p.z,pulses:pulse});return;}
    const key=dimension==='x'?(delta>0?'d':'a'):(delta>0?'s':'w');
    await page.keyboard.down(key);try{await delay(Math.min(550,Math.max(35,(Math.abs(delta)-.025)/3.2*1000)));}finally{await page.keyboard.up(key);}await quiet(page);pulse++;
  }
  metrics.failedMovement={dimension,target,state:await page.evaluate(()=>({game:SYNKTownDay.metrics(),focus:document.activeElement?.id,visibility:document.visibilityState}))};await shot(page,'movement-timeout');throw Error(`walk ${dimension} did not converge to ${target}`);
}
async function camera(page,mode) {for(let i=0;i<5;i++){if((await gameMetrics(page)).camera===mode){await delay(550);return;}await page.locator('#camera-toggle').click();}throw Error(`camera ${mode}`);}
async function capture(page,width,name){await delay(350);metrics[`${width}-${name}`]=await gameMetrics(page);await shot(page,`${name}-${width}`);}
async function layout(page,width,name) {
  const r=await page.evaluate(()=>{const ids=['walk-joystick','walk-interact','camera-toggle'],boxes=ids.map(id=>{const b=document.getElementById(id).getBoundingClientRect();return{id,x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};});return{width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1,boxes};});
  check(`${width}-${name}-controls-fit`,!r.overflow&&r.boxes.every(b=>b.x>=-.5&&b.y>=-.5&&b.right<=r.width+.5&&b.bottom<=r.height+.5),r);
}
async function sampleMotion(page,width){
  await focus(page);
  await page.evaluate(()=>{window.comfortSamples=[];window.comfortPhase='idle';window.comfortLastFrame=-1;window.comfortRecord=true;});
  await delay(180);await page.evaluate(()=>comfortPhase='moving');await page.keyboard.down('d');await delay(700);await page.keyboard.up('d');const releasedAt=await page.evaluate(()=>{comfortPhase='released';return performance.now();});await quiet(page);await delay(650);await page.evaluate(()=>comfortPhase='settled');await delay(220);
  const rows=await page.evaluate(()=>{window.comfortRecord=false;return comfortSamples;});metrics[`${width}-motionSamples`]=rows;
  const unique=rows.filter((r,i)=>!i||r.frame!==rows[i-1].frame),moving=unique.filter(r=>r.phase==='moving'),released=unique.filter(r=>r.phase==='released');
  const idle=unique.filter(r=>r.phase==='idle'),initial=idle.at(-1)||unique[0];
  const offsets=unique.map(r=>({x:r.position[0]-r.pose.x,z:r.position[2]-r.pose.z,y:r.position[1]}));
  const range=(values)=>values.length?Math.max(...values)-Math.min(...values):0;
  const stopSamples=[100,300,600].map(ms=>{const nearest=rows.reduce((best,r)=>Math.abs(r.time-releasedAt-ms)<Math.abs(best.time-releasedAt-ms)?r:best,rows[0]);return{requestedMs:ms,actualMs:nearest.time-releasedAt,position:nearest.position,target:nearest.target};});
  const info={frames:unique.length,movement:unique.at(-1).pose.x-initial.pose.x,offsetRange:{x:range(offsets.map(p=>p.x)),y:range(offsets.map(p=>p.y)),z:range(offsets.map(p=>p.z))},releaseCameraTravel:released.length?Math.hypot(...released.at(-1).position.map((v,i)=>v-released[0].position[i])):null,movingScreenRange:{x:range(moving.map(r=>r.screen.x)),y:range(moving.map(r=>r.screen.y))},settledTarget:unique.at(-1).target,stopSamples};
  metrics[`${width}-motionSummary`]=info;
  check(`${width}-real-key-movement-recorded`,info.frames>10&&info.movement>1.1,info);
  if(!before){const directions=unique.filter(r=>r.direction),directionVariation=Math.max(...[0,1,2].map(i=>range(directions.map(r=>r.direction[i])))),fovVariation=range(unique.map(r=>r.fov));
    check(`${width}-follow-has-fixed-offset-and-direction`,Object.values(info.offsetRange).every(n=>n<.001)&&directionVariation<.00001&&fovVariation<.001,{offsetRange:info.offsetRange,directionVariation,fovVariation});
    const stopDrift=Math.max(...stopSamples.map(r=>Math.hypot(...r.position.map((n,i)=>n-stopSamples[0].position[i]))));check(`${width}-no-camera-drift-at-100-300-600ms`,stopDrift<.001,{stopDrift,stopSamples});
  }
}
async function sustainedMotion(page,width){
  await axis(page,'x',-3);await focus(page);await delay(900);
  await page.evaluate(()=>{window.comfortSamples=[];window.comfortPhase='warmup';window.comfortLastFrame=-1;window.comfortRecord=true;});
  const marks=[];
  for(let i=0;i<6;i++){const key=i%2?'a':'d';const start=await page.evaluate(()=>{comfortPhase='moving';return performance.now();});await page.keyboard.down(key);marks.push({key,start});try{await delay(1700);}finally{await page.keyboard.up(key);}await quiet(page);}
  const release=await page.evaluate(()=>{comfortPhase='released';return performance.now();});await delay(650);
  const rows=await page.evaluate(()=>{comfortRecord=false;return comfortSamples;});
  const moving=rows.filter(r=>r.phase==='moving'),steady=moving.filter(r=>r.time>moving[0]?.time+500),intervals=steady.slice(1).map((r,i)=>r.time-steady[i].time).filter(n=>n>0).sort((a,b)=>a-b),quantile=q=>intervals.length?intervals[Math.min(intervals.length-1,Math.floor(intervals.length*q))]:null;
  const travel=moving.slice(1).reduce((sum,r,i)=>sum+Math.hypot(r.pose.x-moving[i].pose.x,r.pose.z-moving[i].pose.z),0);
  const latencies=marks.map((mark,i)=>{const previous=rows.filter(r=>r.time<=mark.start).at(-1)||rows[0];const end=marks[i+1]?.start||release;const first=rows.find(r=>r.time>=mark.start&&r.time<end&&Math.hypot(r.pose.x-previous.pose.x,r.pose.z-previous.pose.z)>.002);return{key:mark.key,inputAt:mark.start,firstRenderedMovementAt:first?.time,latencyMs:first?first.time-mark.start:null};});
  metrics[width+'-sustainedWalking']={durationMs:moving.at(-1)?.time-moving[0]?.time,frames:moving.length,steadyFrames:steady.length,steadyFps:steady.length>1?(steady.length-1)*1000/(steady.at(-1).time-steady[0].time):0,intervalMs:{p50:quantile(.5),p95:quantile(.95),max:intervals.at(-1)},intervalsOver50Ms:intervals.filter(n=>n>50).length,travel,latencies,marks,latencyMethod:'performance timestamp just before Playwright keyboard.down; includes automation dispatch overhead',samples:rows};
  check(width+'-sustained-real-walking-samples-recorded',moving.length>100&&travel>10&&latencies.every(r=>r.latencyMs!==null),{...metrics[width+'-sustainedWalking'],samples:undefined});
}
async function verifyWalkAuthority(page,width,store){
  await quiet(page);const m=await gameMetrics(page),authority=store.read().state.day.walk;const distance=Math.hypot(m.walk.x-authority.x,m.walk.z-authority.z);const rows=metrics[width+'-sustainedWalking'].samples;const points=rows.map(r=>r.walk).filter(Boolean);const valid=await page.evaluate(async points=>{const {isWalkable}=await import('/walk.mjs');return points.every(isWalkable);},points);
  const locomotion=rows.map(r=>r.locomotion).filter(Boolean),angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));const maxResidual=Math.max(...locomotion.map(l=>l.positionResidual)),range=values=>Math.max(...values)-Math.min(...values);const turnChecks=metrics[width+'-sustainedWalking'].marks.slice(1).map(mark=>{const target=mark.key==='d'?Math.PI/2:-Math.PI/2;const beforeTurn=rows.filter(r=>r.time<=mark.start).at(-1)?.locomotion?.displayedHeading;const intermediate=rows.filter(r=>r.time>=mark.start&&r.time<=mark.start+180).some(r=>r.locomotion&&angle(r.locomotion.displayedHeading,target)>.05&&angle(r.locomotion.displayedHeading,beforeTurn)>.05);return{key:mark.key,intermediate};});
  metrics[width+'-locomotionSummary']={maxResidual,phaseRange:range(locomotion.map(l=>l.phase)),bobRange:range(locomotion.map(l=>l.bob)),rollRange:range(locomotion.map(l=>l.roll)),final:m.locomotion,turnChecks};
  check(width+'-walking-has-distance-driven-gait',locomotion.length>100&&range(locomotion.map(l=>l.phase))>.5&&range(locomotion.map(l=>l.bob))>.004&&range(locomotion.map(l=>l.roll))>.004&&maxResidual<.000001,metrics[width+'-locomotionSummary']);
  check(width+'-body-turn-eases-without-position-lag',turnChecks.every(r=>r.intermediate)&&m.locomotion.gaitBlend<.02&&maxResidual<.000001,metrics[width+'-locomotionSummary']);
  check(width+'-sustained-walk-reconciles-authority',distance<.00001,{predicted:m.walk,authority,distance});check(width+'-walk-samples-stay-in-authoritative-ground',valid&&points.every(r=>Number.isFinite(r.x)&&Number.isFinite(r.z)&&r.pendingMs<=240.001),{points:points.length,maxPendingMs:Math.max(...points.map(r=>r.pendingMs)),maxCorrection:m.walk.maxCorrection});
}
async function facePanel(page,width,height,mode='close') {
  await delay(650);const r=await page.evaluate(()=>{const m=SYNKTownDay.metrics(),p=document.getElementById('nearby-panel').getBoundingClientRect();return{heads:m.conversationHeads,player:m.playerHeadScreen,panel:{x:p.x,y:p.y,right:p.right,bottom:p.bottom}};});
  check(`${width}-${mode}-dialogue-player-face-visible`,r.player?.inFrustum&&!(r.player.x>=r.panel.x&&r.player.x<=r.panel.right&&r.player.y>=r.panel.y&&r.player.y<=r.panel.bottom),r);
  if(width<=760)check(`${width}-${mode}-dialogue-faces-fit`,r.heads.length>=2&&r.heads.every(h=>h.x>0&&h.x<width&&h.y>r.panel.bottom+2&&h.y<height-130),r);
}
async function action(page, type, data = {}) {
  const selector = `[data-command="${type}"]` + Object.entries(data).map(([k,v]) => `[data-${k}="${v}"]`).join('');
  const button = page.locator(selector + ':visible').first();
  await button.waitFor({state:'visible',timeout:25000}); await button.click();
  await until(async () => await page.locator('#day-app').getAttribute('aria-busy') !== 'true', `action ${type}`);
}
async function livedMemory(page,width,store) {
  await axis(page,'x',-3); await axis(page,'z',1.7); await axis(page,'x',6);
  check(width+'-real-walk-reaches-workshop',(await walk(page)).nearby==='workshop');
  await page.locator('#walk-interact').click(); await until(()=>walk(page).then(w=>w.interactionOpen),'workshop dialogue');
  const inventory = JSON.stringify(store.read().state.inventory);
  check(width+'-new-save-has-no-fabricated-memory',(await gameMetrics(page)).brandArt.memoryMarkers.length===0);
  await action(page,'DAY_START',{kind:'help'}); await action(page,'DAY_CHOICE',{choice:'hold'});
  await until(async()=>await page.locator('[data-command="DAY_CONTINUE"]:visible,[data-command="DAY_CONFIRM"]:visible').count()>0,'help preview ready');
  if(await page.locator('[data-command="DAY_CONTINUE"]:visible').count())await action(page,'DAY_CONTINUE');
  check(width+'-preview-creates-no-memory',store.read().state.day.history.length===0&&(await gameMetrics(page)).brandArt.memoryMarkers.length===0);
  await action(page,'DAY_CONFIRM');
  await page.locator('[data-command="DAY_HELP_FINISH"]:visible').waitFor({state:'visible',timeout:25000});
  check(width+'-unfinished-help-creates-no-memory',store.read().state.day.history.length===0&&(await gameMetrics(page)).brandArt.memoryMarkers.length===0);
  await action(page,'DAY_HELP_FINISH');
  await until(async()=>(await gameMetrics(page)).brandArt.memoryMarkers.length===1,'completed memory appears');
  const committed=store.read().state.day.history.at(-1),markers=(await gameMetrics(page)).brandArt.memoryMarkers;
  check(width+'-actual-completed-help-has-one-matching-stitched-memory',committed.kind==='help'&&committed.role==='planner'&&markers[0].resultId===committed.resultId&&markers[0].location==='workshop',{committed,markers});
  check(width+'-visual-memory-grants-no-inventory',JSON.stringify(store.read().state.inventory)===inventory);
  await action(page,'DAY_CLOSE');await page.locator('#walk-close').click();await camera(page,'follow');
  await capture(page,width,'workshop-lived-memory');
  await page.reload();await page.waitForFunction(()=>globalThis.SYNKTownDay?.metrics()?.assetsReady&&SYNKTownDay.metrics().brandArt?.memoryMarkers.length===1,{},{timeout:60000});
  const restored=(await gameMetrics(page)).brandArt.memoryMarkers;
  check(width+'-real-reload-restores-same-memory-without-duplicate',store.read().state.day.history.length===1&&restored.length===1&&restored[0].resultId===committed.resultId);
  await capture(page,width,'workshop-memory-restored');
}
async function game(browser,width,height){
  const {store,base}=await fixture(),page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,...(width<700?{isMobile:true,hasTouch:true}:{})});await observe(page,'graphics-'+width);
  await page.goto(base+'/day.html?play=walk');await page.waitForFunction(()=>globalThis.SYNKTownDay?.metrics()?.assetsReady&&SYNKTownDay.metrics().walk?.enabled,{},{timeout:60000});await focus(page);await quiet(page);await delay(700);
  let m=await gameMetrics(page);check(width+'-real-webgl-assets',!m.fallback&&m.assetsReady&&!m.assetFailures?.length&&!m.contextLost&&(before||m.graphicsVersion===8),{graphicsVersion:m.graphicsVersion,assetFailures:m.assetFailures});check(width+'-default-follow-and-cap-60',m.camera==='follow'&&m.frameCap===60,{camera:m.camera,frameCap:m.frameCap});
  await capture(page,width,'home-follow');await layout(page,width,'home');const rendering=m.rendering;check(width+'-balanced-buffer-policy',width<600?rendering.directRendering&&rendering.estimatedTargetBytes===0:rendering.contactOcclusion&&rendering.aoSamples===8,rendering);
  await sustainedMotion(page,width);await verifyWalkAuthority(page,width,store);const cadence=metrics[width+'-sustainedWalking'];check(width+'-walking-cadence-at-least-55fps',cadence.steadyFps>=55,{fps:cadence.steadyFps,intervalMs:cadence.intervalMs});
  await axis(page,'x',-6);await axis(page,'z',1.7);await sampleMotion(page,width);await axis(page,'x',-6);await axis(page,'z',1.7);await camera(page,'wide');await capture(page,width,'home-wide');check(width+'-wide-direct-rendering',(await gameMetrics(page)).rendering.directRendering);await camera(page,'follow');
  await axis(page,'x',-3);await axis(page,'z',2.5);await axis(page,'x',0);check(width+'-real-walk-reaches-cafe',(await walk(page)).nearby==='cafe');await capture(page,width,'cafe-follow');
  const beforeDialogue=await gameMetrics(page);await page.locator('#walk-interact').click();await until(()=>walk(page).then(w=>w.interactionOpen),'cafe dialogue');await facePanel(page,width,height,'follow');await capture(page,width,'cafe-follow-dialogue');const afterDialogue=await gameMetrics(page);const delta=Math.max(...beforeDialogue.cameraPosition.map((n,i)=>Math.abs(n-afterDialogue.cameraPosition[i])),Math.abs(beforeDialogue.cameraFov-afterDialogue.cameraFov));check(width+'-dialogue-keeps-camera',afterDialogue.camera==='follow'&&delta<.0001,{delta});await page.locator('#walk-close').click();if(!before){await camera(page,'close');await capture(page,width,'cafe-material-close');}await camera(page,'wide');await capture(page,width,'cafe-wide');await camera(page,'follow');
  await axis(page,'x',-3);await axis(page,'z',-4);await axis(page,'x',0);check(width+'-real-walk-reaches-greenhouse',(await walk(page)).nearby==='greenhouse');await capture(page,width,'greenhouse-follow');await camera(page,'wide');await capture(page,width,'greenhouse-wide');await camera(page,'follow');
  if(width<700){const b=await page.locator('#walk-joystick').boundingBox(),c={x:b.x+b.width/2,y:b.y+b.height/2},initial=await walk(page),cdp=await page.context().newCDPSession(page);try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...c,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:c.x+b.width*.35,y:c.y,id:1}]});await delay(400);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}finally{await cdp.detach();}await quiet(page);check(width+'-touch-joystick-moves',(await walk(page)).x>initial.x+.3);}
  if(!before) await livedMemory(page,width,store);
  m=await gameMetrics(page);const authority=store.read().state.day.walk;check(width+'-route-reconciles-authority',Math.hypot(m.walk.x-authority.x,m.walk.z-authority.z)<.00001,{walk:m.walk,authority});metrics[width+'-final']=m;await page.close();
}
function compareBaseline(){
  if(before)return;const old=JSON.parse(fs.readFileSync(path.join(output,'before.json'),'utf8'));
  for(const width of[1280,390,320]){const a=old.metrics[`${width}-home-follow`],b=metrics[`${width}-home-follow`];if(!a||!b)continue;const oldPixels=Math.abs(a.playerScreen.y-a.playerHeadScreen.y),newPixels=Math.abs(b.playerScreen.y-b.playerHeadScreen.y);const result={oldDistance:a.cameraDistance,newDistance:b.cameraDistance,oldHeadToCentrePixels:oldPixels,newHeadToCentrePixels:newPixels,scaleRatio:newPixels/oldPixels};metrics[`${width}-distanceComparison`]=result;check(`${width}-stable-v7-camera-distance-and-scale`,Math.abs(b.cameraDistance-a.cameraDistance)<.0001&&Math.abs(newPixels-oldPixels)<.15,result);const priorWalking=old.metrics[`${width}-sustainedWalking`],newWalking=metrics[`${width}-sustainedWalking`];metrics[`${width}-cadenceComparison`]={oldFps:priorWalking.steadyFps,newFps:newWalking.steadyFps,ratio:newWalking.steadyFps/priorWalking.steadyFps,oldIntervalMs:priorWalking.intervalMs,newIntervalMs:newWalking.intervalMs};check(`${width}-walking-cadence-regression-within-five-percent`,newWalking.steadyFps>=priorWalking.steadyFps*.95,metrics[`${width}-cadenceComparison`]);const am=old.metrics[`${width}-motionSummary`],bm=metrics[`${width}-motionSummary`];check(`${width}-release-drift-not-increased-from-v7`,bm.releaseCameraTravel<=am.releaseCameraTravel+.025,{old:am.releaseCameraTravel,current:bm.releaseCameraTravel});}
}
(async()=>{const startedAt=new Date().toISOString(),sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,hash(sourcePath(file))]));let browser,failure=null;const reportName=before?'before.json':'after.json';try{fs.mkdirSync(output,{recursive:true});if(before&&fs.existsSync(path.join(output,reportName)))throw Error('Preserved baseline already exists');browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});await game(browser,1280,900);await game(browser,390,844);compareBaseline();check('no-javascript-errors',errors.length===0,errors);check('no-console-or-shader-errors',consoleErrors.length===0,consoleErrors);check('no-webgl-or-shader-warnings',shaderWarnings.length===0,shaderWarnings);check('no-local-assets-failed',failedRequests.length===0,failedRequests);check('no-host-api-rejections',apiFailures.length===0,apiFailures);check('source-stable-through-capture',Object.entries(sourceHashes).every(([file,h])=>hash(sourcePath(file))===h));if(!before){const graphics=new Set(['day-scene.mjs','day-environment.mjs','day-materials.mjs','day-residents.mjs','day-style.css','day.html','day-app.mjs']);check('non-graphics-sources-unchanged-from-v7',baseline.filter(r=>!graphics.has(r.name)).every(r=>hash(sourcePath(r.name))===r.sha256),baseline.filter(r=>hash(sourcePath(r.name))!==r.sha256).map(r=>r.name));}}catch(e){failure=e.stack||String(e);console.error(failure);}finally{await browser?.close();await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));const report={startedAt,finishedAt:new Date().toISOString(),stage,sourceHashes,checks,metrics,screenshots,errors,consoleErrors,shaderWarnings,failedRequests,apiFailures,failure,limits:['Fresh memory fixtures on ephemeralports; existing4288user save is never read or written','HostheadlessEdge1280x900 and390x844; no physicalphone or finalartapproval','Baseline freezes25v7product sources plus2sharedThree modules; binaryimages are sharedlive','Actualkeyboard/touchinput and authoritativecoordinates; no injectedpositions','Completedrender timestamps with diagnosticsoverhead; at least10s actualwalking, startup500ms excluded']};fs.writeFileSync(path.join(output,reportName),JSON.stringify(report,null,2));if(failure)process.exitCode=1;}})();
