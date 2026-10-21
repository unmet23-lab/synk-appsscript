// Resident art and gameplay QA. All servers use fresh memory stores. Study-only
// routes exercise meshes/poses, and are explicitly separate from real game play.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const outputIndex = process.argv.indexOf('--output-dir');
if (outputIndex >= 0 && (!process.argv[outputIndex + 1] || process.argv[outputIndex + 1].startsWith('--'))) throw Error('--output-dir requires a directory relative to synk-town');
const output = path.resolve(__dirname, outputIndex >= 0 ? process.argv[outputIndex + 1] : 'qa'), portraitDir = path.join(__dirname, 'assets/residents');
const portraitsOnly = process.argv.includes('--portraits-only');
const gameOnly = process.argv.includes('--game-only');
const ids = ['cafe-owner', 'workshop-owner', 'researcher', 'visitor-tea-reader', 'book-guest', 'companion'];
const servers = [], checks = [], errors = [], failedRequests = [], screenshots = [], metrics = {}, portraits = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, ok, details) => { checks.push({ name, ok: !!ok, ...(details === undefined ? {} : { details }) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) throw Error(name); };
async function until(fn, name, ms = 30000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await delay(75); } throw Error(`Timeout: ${name}`); }
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
async function fixture() {
  const { createStore, createServer } = await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href);
  const store = createStore({ lifeEnabled: true }), server = createServer({ previewEnabled: true, store });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); servers.push(server);
  return { store, base: `http://127.0.0.1:${server.address().port}` };
}
function observe(page, scope) {
  page.on('pageerror', error => errors.push({ scope, error: error.message }));
  page.on('response', response => { if (response.status() >= 400 && /\.(?:mjs|js|webp|png|jpg)(?:\?|$)/.test(response.url())) failedRequests.push({ scope, status: response.status(), url: response.url() }); });
  page.on('requestfailed', request => { if (!/ERR_ABORTED/.test(request.failure()?.errorText || '')) failedRequests.push({ scope, url: request.url(), error: request.failure() }); });
}
async function shot(page, filename) { await page.screenshot({ path: path.join(output, filename) }); screenshots.push(filename); }
const walk = page => page.evaluate(() => SYNKTownDay.metrics().walk);
async function quiet(page) { await until(async () => { const w = await walk(page); return !w.moving && !w.sending && w.pending === 0 && await page.locator('#day-app').getAttribute('aria-busy') !== 'true'; }, 'input settles'); }
async function focus(page) { await page.bringToFront(); await page.locator('#scene').focus(); }
async function axis(page, dimension, target, tolerance = .12) {
  await focus(page); const p = await walk(page), sign = Math.sign(target - p[dimension]); if (Math.abs(target - p[dimension]) <= tolerance) return;
  const key = dimension === 'x' ? sign > 0 ? 'd' : 'a' : sign > 0 ? 's' : 'w'; await page.keyboard.down(key);
  try { await until(async () => sign * (target - (await walk(page))[dimension]) <= tolerance, `walk ${dimension} to ${target}`, 12000); }
  finally { await page.keyboard.up(key); } await quiet(page);
}
async function click(page, type, data = {}) {
  const attrs = Object.entries(data).map(([k, v]) => `[data-${k}="${v}"]`).join('');
  await page.locator(`[data-command="${type}"]${attrs}`).filter({ visible: true }).first().click();
  await until(() => page.locator('#day-app').getAttribute('aria-busy').then(value => value !== 'true'), `${type} completes`);
  if (await page.locator('#error').isVisible()) throw Error(await page.locator('#error').textContent());
}
async function camera(page, mode) { for (let i = 0; i < 4; i++) { if (await page.evaluate(() => SYNKTownDay.metrics().camera) === mode) { await delay(650); return; } await page.locator('#camera-toggle').click(); } throw Error(`camera ${mode}`); }
const studyHTML = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resident model fixture, not gameplay</title><style>html,body{margin:0;background:#ece7d9}canvas{display:block;width:100vw;height:100vh}</style><canvas></canvas></html>';
async function prepareStudy(page, base) {
  observe(page, 'mesh-fixture'); await page.route('**/resident-study.html', route => route.fulfill({ status: 200, contentType: 'text/html', body: studyHTML }));
  await page.goto(`${base}/resident-study.html`);
  await page.evaluate(async ids => {
    const T = await import('/scene-assets/three.module.js'), { makeTownResident } = await import('/day-residents.mjs');
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d'); ctx.fillStyle = '#858585'; ctx.fillRect(0, 0, 256, 256);
    let seed = 137; const r = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 8500; i++) { ctx.strokeStyle = `rgba(${r() > .5 ? '238,238,238' : '36,36,36'},.21)`; ctx.lineWidth = .6; const x = r() * 256, y = r() * 256; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r() * 4 - 2, y + r() * 4); ctx.stroke(); }
    const felt = new T.CanvasTexture(c); felt.wrapS = felt.wrapT = T.RepeatWrapping; felt.repeat.set(4, 3);
    const material = color => new T.MeshPhysicalMaterial({ color, roughness: .94, sheen: .6, bumpMap: felt, bumpScale: .009 });
    const m = Object.fromEntries(Object.entries({ felt:'#de7564',coral:'#de7564',sage:'#718567',linen:'#e3d8be',denim:'#647e90',thread:'#c6927d',scarf:'#fff3df',eye:'#17130f',glint:'#fff9e9',wood:'#c6a57c',darkWood:'#685843',stone:'#d1d4c7',plaster:'#e5d7bc',terra:'#c38c6f',ceramic:'#f3e8ce',brass:'#bc9b5d',frame:'#829283',soil:'#66553e',leaf:'#587653',leafLight:'#97a870',tea:'#875e35',awning:'#eadac0',paper:'#fff9df',water:'#a4c9be',shadow:'#39372c'}).map(([k,v]) => [k,material(v)]));
    m.eye.roughness=.14; m.eye.clearcoat=1; m.glint = new T.MeshBasicMaterial({color:'#fff9e9'}); m.brass.metalness=.7;
    const renderer = new T.WebGLRenderer({ canvas: document.querySelector('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor('#ece7d9',1); renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.02;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(30,innerWidth/innerHeight,.01,50);
    scene.add(new T.HemisphereLight('#e8f0ff','#b99c7d',2)); const sun=new T.DirectionalLight('#fff4de',3.0);sun.position.set(-4,7,8);scene.add(sun);const fill=new T.DirectionalLight('#cadffc',.7);fill.position.set(5,3,-4);scene.add(fill);
    const rows=ids.map((id,i)=>{const group=new T.Group();scene.add(group);group.position.set((i-2.5)*1.1,0,0);const resident=makeTownResident(group,m,{id,mobile:innerWidth<600});resident.body.scale.setScalar(.56);return{id,group,...resident};});
    const state={now:0,motion:true,walking:false,working:false,showing:false,holding:false,talking:false,seated:false};
    const matrices = () => rows.map(row=>{row.group.updateMatrixWorld(true);const parts=[];row.body.traverse(o=>{if(o.isMesh)parts.push(...o.matrixWorld.elements);});return parts;});
    function draw(patch={}){Object.assign(state,patch);rows.forEach(row=>row.update(state));scene.updateMatrixWorld(true);renderer.render(scene,camera);}
    const inspect=()=>rows.map(row=>{const box=new T.Box3().setFromObject(row.body),size=box.getSize(new T.Vector3());return{id:row.id,identity:row.identity,headHeight:row.headHeight,height:row.height,headWorldPosition:row.head?.getWorldPosition(new T.Vector3()).toArray(),bounds:{min:box.min.toArray(),max:box.max.toArray(),size:size.toArray()},meshCount:(()=>{let n=0;row.body.traverse(o=>{if(o.isMesh)n++;});return n;})()};});
    window.residentStudy={rows,renderer,scene,camera,state,draw,inspect,matrices,materials:m,T,
      lineup(){rows.forEach((row,i)=>{row.group.visible=true;row.group.position.set((i-2.5)*1.1,0,0);row.body.rotation.y=.12;});renderer.setSize(innerWidth,innerHeight);renderer.setClearColor('#ece7d9',1);camera.aspect=innerWidth/innerHeight;camera.position.set(.1,1.5,6.6);camera.lookAt(0,.68,0);camera.updateProjectionMatrix();draw({now:0,motion:true,walking:false,working:false,showing:false,holding:false,talking:false,seated:false});},
      portrait(id){rows.forEach(row=>{row.group.visible=row.id===id;row.group.position.set(0,0,0);row.body.rotation.y=.13;});renderer.setSize(512,640);renderer.setClearColor('#000000',0);camera.aspect=512/640;camera.position.set(.05,.95,2.9);camera.lookAt(0,.67,0);camera.updateProjectionMatrix();draw({now:0,motion:false,walking:false,working:false,showing:false,holding:false,talking:false,seated:false});const pixels=new Uint8Array(512*640*4);renderer.getContext().readPixels(0,0,512,640,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);let transparentPixels=0,opaquePixels=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)transparentPixels++;if(pixels[i]===255)opaquePixels++;}return{data:renderer.domElement.toDataURL('image/png'),transparentPixels,opaquePixels,width:512,height:640};},
      dispose(){const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(mat);for(const value of Object.values(mat))if(value?.isTexture)textures.add(value);}});let disposedGeometry=0,disposedMaterial=0;geometries.forEach(g=>{g.addEventListener('dispose',()=>disposedGeometry++);g.dispose();});materials.forEach(mat=>{mat.addEventListener('dispose',()=>disposedMaterial++);mat.dispose();});textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();return{geometries:geometries.size,disposedGeometry,materials:materials.size,disposedMaterial,contextLost:renderer.getContext().isContextLost()};}
    };residentStudy.lineup();
  }, ids);
}
async function gameChecks(browser, width) {
  const { store, base } = await fixture(), page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1, ...(width<700?{isMobile:true,hasTouch:true}:{}) }); observe(page,`game-${width}`);
  await page.goto(`${base}/day.html?play=walk`); await page.waitForFunction(()=>globalThis.SYNKTownDay?.metrics()?.assetsReady&&SYNKTownDay.metrics().walk?.enabled); await focus(page); await quiet(page);
  let m=await page.evaluate(()=>SYNKTownDay.metrics()); metrics[`${width}-initial`]=m;
  check(`${width}-real-game-keeps-shared-player-avatar`,!m.fallback&&m.playerAvatar?.avatarVersion==='mongle-v3',{avatar:m.playerAvatar});
  check(`${width}-real-game-exposes-six-distinct-resident-identities`,m.residents?.length===6&&new Set(m.residents.map(r=>JSON.stringify(r.identity))).size===6&&ids.every(id=>m.residents.some(r=>r.id===id)),m.residents);
  check(`${width}-all-resident-height-metrics-are-valid`,m.residents.every(r=>Number.isFinite(r.headHeight)&&r.headHeight>.3&&Number.isFinite(r.height)&&r.height>r.headHeight),m.residents);
  await camera(page,'wide'); await shot(page,`RESIDENTS-game-overview-${width}.png`); await camera(page,'follow');
  await axis(page,'x',-3); await axis(page,'z',2.5); await axis(page,'x',0); await camera(page,'close'); await page.locator('#walk-interact').click(); await until(()=>walk(page).then(w=>w.interactionOpen),'cafe interaction');await delay(750);
  m=await page.evaluate(()=>SYNKTownDay.metrics());metrics[`${width}-dialogue`]=m;
  check(`${width}-real-walk-and-cafe-interaction-still-work`,store.read().state.day.location==='cafe'&&m.walk.enabled&&m.walk.interactionOpen&&!m.fallback);
  if(width<700){const panel=await page.locator('#nearby-panel').boundingBox();check(`${width}-resident-faces-stay-below-dialogue-panel`,m.conversationHeads.length>=2&&m.conversationHeads.every(h=>h.y>panel.y+panel.height+3&&h.y<900-135),{panel,heads:m.conversationHeads});}
  await shot(page,`RESIDENTS-game-dialogue-${width}.png`);
  await click(page,'CHOOSE',{branch:'inside'});await click(page,'NEXT');await click(page,'PLACE');await until(()=>store.read().state.delivered,'real guest seat use',45000);await delay(850);m=await page.evaluate(()=>SYNKTownDay.metrics());metrics[`${width}-realSeated`]=m;check(`${width}-real-game-guest-seats-and-delivery-completes`,store.read().state.served&&store.read().state.delivered&&m.residents.some(r=>r.id==='visitor-tea-reader'&&r.visible));await shot(page,`RESIDENTS-game-seated-${width}.png`);
  await page.locator('#walk-close').click();await page.emulateMedia({reducedMotion:'reduce'});await focus(page);const initial=await walk(page);await page.keyboard.down('a');await delay(300);await page.keyboard.up('a');await quiet(page);m=await page.evaluate(()=>SYNKTownDay.metrics());
  check(`${width}-reduced-motion-still-allows-walking`,m.reducedMotion&&m.walk.x<initial.x-.2);await shot(page,`RESIDENTS-game-reduced-motion-${width}.png`);metrics[`${width}-final`]=m;await page.close();
}
async function sceneLifecycle(browser) {
  const {base}=await fixture(),page=await browser.newPage({viewport:{width:1280,height:900}});observe(page,'real-scene-lifecycle');
  await page.route('**/resident-study.html',route=>route.fulfill({status:200,contentType:'text/html',body:studyHTML}));await page.goto(`${base}/resident-study.html`);
  await page.evaluate(async ids=>{
    const T=await import('/scene-assets/three.module.js'),instances=new Set(),disposed=new Set(),contexts=new Set();
    const add=T.Object3D.prototype.add,drop=T.InstancedMesh.prototype.dispose;
    T.Object3D.prototype.add=function(...objects){objects.forEach(o=>o.traverse(child=>{if(child.isInstancedMesh)instances.add(child);}));return add.apply(this,objects);};
    T.InstancedMesh.prototype.dispose=function(...args){disposed.add(this);return drop.apply(this,args);};
    for(const proto of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const create=proto.createBuffer;proto.createBuffer=function(...args){contexts.add(this);return create.apply(this,args);};}
    const {createDayScene}=await import('/day-scene.mjs');window.residentScene=createDayScene(document.querySelector('canvas'));
    residentScene.render({freeWalk:true,location:'cafe',player:{x:0,z:3.2},npcs:ids.filter(id=>id!=='visitor-tea-reader').map((id,i)=>({id,x:(i-2)*1.05,z:1,pose:i%2?'working':'talking'})),props:[],legacy:{active:true,guestSeated:true,placement:'garden'}},{camera:'wide',reducedMotion:true});
    window.sceneDisposal=()=>{const before={instances:instances.size,disposed:disposed.size};residentScene.dispose();return{before,after:{instances:instances.size,disposed:disposed.size,contextLost:[...contexts].every(gl=>gl.isContextLost())}};};
  },ids);
  await page.waitForFunction(()=>residentScene.stats().assetsReady&&residentScene.stats().ready);await delay(500);
  metrics.sceneSixResidents=await page.evaluate(()=>residentScene.stats());
  check('actual-scene-can-render-all-six-resident-models',metrics.sceneSixResidents.residents.length===6&&metrics.sceneSixResidents.residents.every(r=>r.visible),metrics.sceneSixResidents.residents);
  await shot(page,'RESIDENTS-scene-six-cast-fixture.png');
  metrics.sceneDisposal=await page.evaluate(()=>sceneDisposal());check('actual-scene-releases-resident-and-world-instance-buffers',metrics.sceneDisposal.after.instances===metrics.sceneDisposal.after.disposed&&metrics.sceneDisposal.after.contextLost,metrics.sceneDisposal);await page.close();
}
async function alternativeSurfaceChecks(browser){
  const {base}=await fixture(),fallback=await browser.newPage({viewport:{width:390,height:900}});observe(fallback,'webgl-text-alternative');
  await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^(webgl2?|experimental-webgl)$/.test(type)?null:original.call(this,type,...args);};});
  await fallback.goto(`${base}/day.html?play=walk`);await fallback.waitForFunction(()=>globalThis.SYNKTownDay?.metrics().fallback&&SYNKTownDay.metrics().connected);
  const fallbackResult=await fallback.evaluate(()=>({visible:!document.querySelector('#scene-fallback').hidden,staticGuest:(()=>{const img=document.querySelector('#ft-static img');return{src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth===512};})(),broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)}));
  check('webgl-text-alternative-loads-the-same-human-guest-portrait',fallbackResult.visible&&fallbackResult.staticGuest.src.endsWith('residents/visitor-tea-reader.png')&&fallbackResult.staticGuest.loaded&&fallbackResult.broken.length===0,fallbackResult);metrics.fallback=fallbackResult;
  await shot(fallback,'RESIDENTS-webgl-text-alternative-390.png');
  const assets=[];for(const id of ids){const response=await fallback.request.get(`${base}/assets/residents/${id}.png`);assets.push({id,status:response.status(),type:response.headers()['content-type'],bytes:(await response.body()).length});}
  check('preview-host-serves-all-six-new-resident-portraits',assets.every(r=>r.status===200&&r.type.startsWith('image/png')&&r.bytes>5000),assets);await fallback.close();
  const legacy=await browser.newPage({viewport:{width:1280,height:900}});observe(legacy,'legacy-preview');await legacy.goto(`${base}/preview.html`);await legacy.waitForFunction(()=>document.querySelector('.town-layout')?.getAttribute('aria-busy')==='false');
  const cast=await legacy.evaluate(()=>['actor-owner','actor-guest'].map(id=>{const img=document.querySelector(`#${id} img`);return{id,src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth===512};}));
  check('legacy-preview-shares-the-human-owner-and-guest-cast',cast.length===2&&cast.every(r=>r.loaded&&r.src.includes('/residents/'))&&cast[0].src.endsWith('cafe-owner.png')&&cast[1].src.endsWith('visitor-tea-reader.png'),cast);metrics.legacyPreview=cast;await shot(legacy,'RESIDENTS-legacy-preview-1280.png');await legacy.close();
  const linked=fs.readFileSync(path.join(__dirname,'linked.html'),'utf8');check('linked-template-references-the-same-resident-assets',linked.includes('assets/residents/cafe-owner.png')&&linked.includes('assets/residents/visitor-tea-reader.png'));
}
(async()=>{
  const startedAt=new Date().toISOString();let browser,failure=null,sourceHashes={};
  const files=(portraitsOnly?['day-residents.mjs']:['day-residents.mjs','day-scene.mjs','day-app.mjs','day.html','preview.html','linked.html','server.mjs','../synk-world-home/avatar-v3.mjs','../synk-world-home/avatar-textiles.mjs']).filter(f=>fs.existsSync(path.join(__dirname,f)));
  sourceHashes=Object.fromEntries(files.map(f=>[f,hash(f)]));
  try{
    fs.mkdirSync(output,{recursive:true});fs.mkdirSync(portraitDir,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
    if(!gameOnly){
    const {base}=await fixture(),study=await browser.newPage({viewport:{width:1680,height:800}});await prepareStudy(study,base);
    const lineup=await study.evaluate(()=>residentStudy.inspect());metrics.fixtureLineup=lineup;
    check('fixture-six-models-have-distinct-identities',lineup.length===6&&new Set(lineup.map(r=>JSON.stringify(r.identity))).size===6,lineup);
    check('fixture-cast-is-five-distinct-human-designs-and-one-professor',lineup.filter(r=>r.identity.kind==='human').length===5&&lineup.filter(r=>r.identity.kind==='professor').length===1&&new Set(lineup.map(r=>r.identity.silhouette)).size===6,lineup.map(r=>r.identity));
    check('fixture-six-models-have-real-3d-volume',lineup.every(r=>r.meshCount>8&&r.bounds.size.every(v=>v>.15)&&r.bounds.min[1]>-.3),lineup);
    check('fixture-head-and-total-height-use-actual-world-scale',lineup.every(r=>Math.abs(r.headWorldPosition[1]-r.headHeight)<.025&&Math.abs(r.bounds.max[1]-r.height)<.07),lineup);
    await shot(study,'RESIDENTS-lineup-standing.png');
    for(const pose of ['walking','working','showing','holding','talking','seated']){
      await study.evaluate(pose=>{residentStudy.lineup();residentStudy.draw({now:450,[pose]:true});},pose);
      const a=await study.evaluate(()=>residentStudy.matrices());await study.evaluate(()=>residentStudy.draw({now:720}));const b=await study.evaluate(()=>residentStudy.matrices());
      if(pose==='seated')await study.evaluate(()=>residentStudy.draw({now:720,motion:false}));
      metrics[`fixture-${pose}`]=await study.evaluate(()=>residentStudy.inspect());
      check(`fixture-${pose}-all-transforms-remain-finite`,b.every(row=>row.every(Number.isFinite)));
      if(pose==='walking')check('fixture-walking-actually-articulates-the-residents',b.every((row,i)=>row.some((v,j)=>Math.abs(v-a[i][j])>.00001)));
      await shot(study,`RESIDENTS-lineup-${pose}.png`);
    }
    await study.evaluate(()=>{residentStudy.lineup();residentStudy.draw({now:400,motion:false,walking:true,talking:true});});const stillA=await study.evaluate(()=>residentStudy.matrices());await study.evaluate(()=>residentStudy.draw({now:3200}));const stillB=await study.evaluate(()=>residentStudy.matrices());
    check('fixture-reduced-motion-does-not-animate-limbs',stillA.every((row,i)=>row.every((v,j)=>Math.abs(v-stillB[i][j])<1e-8)));await shot(study,'RESIDENTS-lineup-reduced-motion.png');
    metrics.portraitAlpha=[];
    for(const id of ids){const {data,...alpha}=await study.evaluate(id=>residentStudy.portrait(id),id);const file=path.join(portraitDir,`${id}.png`);fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));portraits.push(path.relative(__dirname,file).replaceAll('\\','/'));metrics.portraitAlpha.push({id,...alpha});}
    check('six-transparent-portraits-exported-from-the-actual-resident-meshes',portraits.length===6&&portraits.every(file=>fs.statSync(path.join(__dirname,file)).size>5000),portraits);
    check('all-six-portraits-have-transparent-and-opaque-pixels',metrics.portraitAlpha.every(row=>row.transparentPixels>50000&&row.opaquePixels>20000),metrics.portraitAlpha);
    const released=await study.evaluate(()=>residentStudy.dispose());metrics.fixtureDisposal=released;check('fixture-disposes-all-resident-geometry-and-materials',released.geometries===released.disposedGeometry&&released.materials===released.disposedMaterial&&released.contextLost,released);await study.close();
    }
    if(!portraitsOnly){for(const width of [1280,390])await gameChecks(browser,width);await sceneLifecycle(browser);if(!gameOnly)await alternativeSurfaceChecks(browser);}
    check('no-browser-javascript-errors',errors.length===0,errors);check('no-missing-model-texture-or-static-module-requests',failedRequests.length===0,failedRequests);
    const changedFiles=Object.entries(sourceHashes).filter(([file,value])=>hash(file)!==value).map(([file])=>file);check('source-files-stable-through-capture',changedFiles.length===0,{changedFiles});
  }catch(error){failure=error.stack||String(error);console.error(failure);}
  finally{await browser?.close();for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}fs.writeFileSync(path.join(output,gameOnly?'RESIDENTS-game-final.json':portraitsOnly?'RESIDENTS-portraits.json':'residents-ui.json'),JSON.stringify({startedAt,finishedAt:new Date().toISOString(),sourceHashes,checks,screenshots,portraits,metrics,errors,failedRequests,failure,reference:'docs/캐릭터/교수연구실/research.png',limits:['Headless Microsoft Edge; physical phone, controller, and subjective user approval unverified.','Model fixture lineup and pose studies are not gameplay; game screenshots use actual WASD and user-facing commands with ephemeral stores.','Portrait PNGs are actual local Three.js mesh renders, no image-generation service and no pixel retouching.','No user-save files, real accounts, or production server were read or modified.']},null,2));if(failure)process.exitCode=1;}
})();
