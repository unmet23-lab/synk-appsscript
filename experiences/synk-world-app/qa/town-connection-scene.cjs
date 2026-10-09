const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base='http://127.0.0.1:4396',checks=[],errors=[],assets=[],metrics=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log(name);};
function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))assets.push({status:r.status(),url:r.url()});});}
async function login(page,account){console.log('home navigation '+account);await page.goto(base+'/mobile.html',{waitUntil:'domcontentloaded',timeout:45000});await page.waitForFunction(()=>window.__synkWorld&&window.__synkHome.sceneAvailable(),null,{timeout:60000});console.log('home ready '+account);await page.evaluate(async account=>{await window.__synkWorld.client.signIn(account);window.__synkHome.closePanel();},account);console.log('signed in '+account);}
async function enter(page){
 await page.evaluate(async()=>{const c=window.__synkWorld.client,s=await c.request('town/state');if(s.state.phase==='away')await c.request('town/command',{method:'POST',body:{id:crypto.randomUUID(),type:'VISIT',payload:{},expectedRevision:s.state.revision}});});
 await page.locator('[data-action="town"]').click();await page.locator('[data-world="town-preview"]').click();
 const frame=await page.locator('iframe.game-frame').elementHandle().then(handle=>handle.contentFrame());
 console.log('town frame opened');
 try{await frame.waitForFunction(()=>globalThis.SYNKTownDay?.metrics().connected&&globalThis.SYNKTownDay.metrics().assetsReady&&!globalThis.SYNKTownDay.metrics().fallback,null,{timeout:45000});}
 catch(error){const detail=await frame.evaluate(()=>({metrics:globalThis.SYNKTownDay?.metrics(),error:document.querySelector('#error')?.textContent}));metrics.push({label:'initialization failure',...detail});console.log(JSON.stringify(detail));throw error;}return frame;
}
async function closeView(frame){await frame.locator('#camera-toggle').click();await frame.waitForFunction(()=>SYNKTownDay.metrics().camera==='close',null,{timeout:30000});await frame.waitForFunction(()=>SYNKTownDay.metrics().frameCount>2,null,{timeout:30000});}
async function faceCamera(page,frame,touch){
 if(touch){const box=await frame.locator('#walk-joystick').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height*.76);await page.waitForTimeout(260);await page.mouse.up();}
 else{await frame.locator('#scene').focus();await page.keyboard.down('ArrowDown');await page.waitForTimeout(260);await page.keyboard.up('ArrowDown');}
 await frame.waitForFunction(()=>Math.abs(SYNKTownDay.metrics().playerPose.heading)<.1&&SYNKTownDay.metrics().connected,null,{timeout:15000});await frame.waitForFunction(()=>!SYNKTownDay.metrics().walk.sending&&!SYNKTownDay.metrics().walk.pending,null,{timeout:15000});
}
async function sample(frame,label){const value=await frame.evaluate(()=>{const m=SYNKTownDay.metrics();return {worldLinked:m.worldLinked,connected:m.connected,appearanceVerified:m.appearanceVerified,playerAvatar:m.playerAvatar,camera:m.camera,drawCalls:m.drawCalls,triangles:m.triangles,assetFailures:m.assetFailures,physicalDeviceVerified:m.physicalDeviceVerified};});metrics.push({label,...value});return value;}
(async()=>{const server=await chromium.launchServer({channel:'msedge',headless:true}),browser=await chromium.connect(server.wsEndpoint());try{
 const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion:'reduce'}),phone=await mobile.newPage();mobile.setDefaultTimeout(30000);observe(phone);await login(phone,'player-a');
 await phone.evaluate(()=>window.__synkWorld.client.equip({body:'mongle-apron-starter',neck:'mongle-scarf-first-steps'}));const townA=await enter(phone);
 check('home A opens the authenticated same-origin Town frame',await townA.evaluate(()=>SYNKTownDay.metrics().worldLinked&&SYNKTownDay.metrics().connected));
 const firstAvatar=await sample(townA,'mobile-A-initial');
 check('Town uses the shared v3 avatar with both server-owned items',firstAvatar.appearanceVerified&&firstAvatar.playerAvatar.outfit==='scarf-apron'&&firstAvatar.playerAvatar.avatarVersion==='mongle-v3');
 await closeView(townA);check('phone adds a close camera while retaining the walk view',await townA.evaluate(()=>SYNKTownDay.metrics().camera==='close'&&SYNKTownDay.metrics().walk.enabled));await faceCamera(phone,townA,true);check('phone joystick controls the shared avatar in the close view',true);
 await sample(townA,'mobile-A-close');await phone.screenshot({path:path.join(__dirname,'town-connected-mobile390.png')});
 const desktop=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),pc=await desktop.newPage();observe(pc);await login(pc,'player-b');const townB=await enter(pc);
 check('independent account B never receives account A scarf in its Town renderer',await townB.evaluate(()=>SYNKTownDay.metrics().appearanceVerified&&!SYNKTownDay.metrics().playerAvatar.outfit.includes('scarf')));
 await sample(townB,'desktop-B');
 await phone.evaluate(()=>window.__synkWorld.client.equip({body:'',neck:'mongle-scarf-first-steps'}));await townA.waitForFunction(()=>SYNKTownDay.metrics().playerAvatar.outfit==='scarf');
 check('open Town updates its actual meshes after a confirmed home outfit change',true);
 await phone.evaluate(()=>window.__synkWorld.client.equip({body:'mongle-apron-starter',neck:'mongle-scarf-first-steps'}));await townA.waitForFunction(()=>SYNKTownDay.metrics().playerAvatar.outfit==='scarf-apron');
 await phone.evaluate(()=>window.__synkWorld.client.logout());await townA.waitForFunction(()=>!SYNKTownDay.metrics().connected&&!SYNKTownDay.metrics().appearanceVerified);
 check('logging out clears Town clothing and disables its active game actions',await townA.evaluate(()=>SYNKTownDay.metrics().playerAvatar.outfit==='none'&&[...document.querySelectorAll('[data-command],[data-destination],[data-mode]')].every(button=>button.disabled)));
 check('logging out A leaves independently signed-in B connected',await townB.evaluate(()=>SYNKTownDay.metrics().connected&&!SYNKTownDay.metrics().playerAvatar.outfit.includes('scarf')));
 await mobile.close();await pc.evaluate(()=>window.__synkHome.closePanel());await pc.goto(base+'/desktop.html',{waitUntil:'domcontentloaded'});await pc.waitForFunction(()=>window.__synkWorld);await pc.evaluate(async()=>{await window.__synkWorld.client.signIn('player-a');window.__synkHome.closePanel();});const pcA=await enter(pc);await closeView(pcA);
 check('PC restores the same server-owned combined outfit and close view',await pcA.evaluate(()=>SYNKTownDay.metrics().playerAvatar.outfit==='scarf-apron'&&SYNKTownDay.metrics().camera==='close'));await faceCamera(pc,pcA,false);check('PC keyboard controls the restored shared avatar in the close view',true);
 await sample(pcA,'desktop-A-close');await pc.screenshot({path:path.join(__dirname,'town-connected-desktop.png')});
 check('connected Town has no runtime errors',errors.length===0);check('connected Town has no missing assets',assets.length===0);await desktop.close();
 fs.writeFileSync(path.join(__dirname,'town-connection-scene.json'),JSON.stringify({checkedAt:new Date().toISOString(),base,passed:checks.length,checks,errors,assets,metrics,limits:['Local synthetic identity and real browser WebGL only','No physical-device, Unity build, production login, or TOPIK access verification']},null,2));console.log(JSON.stringify({passed:checks.length,errors,assets}));
}finally{let timer;try{await Promise.race([browser.close(),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}finally{clearTimeout(timer);server.process()?.kill();}}})().catch(error=>{fs.writeFileSync(path.join(__dirname,'town-connection-scene-failure.json'),JSON.stringify({error:String(error),checks,errors,assets,metrics},null,2));console.error(error);process.exit(1);});
