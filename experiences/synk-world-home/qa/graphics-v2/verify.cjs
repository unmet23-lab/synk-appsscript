const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=__dirname,base='http://127.0.0.1:4296',checks=[],errors=[],assets=[],metrics=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const spec of [{name:'desktop',width:1440,height:1024},{name:'mobile',width:390,height:844},{name:'small',width:320,height:740}]){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:spec.width<600?2:1,reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)assets.push({status:r.status(),url:r.url()});});
  await page.goto(base+'/graphics.html?graphics=2',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__graphicsStudy?.ready(),null,{timeout:60000,polling:100});
  check(spec.name+' candidate mounts',await page.evaluate(()=>window.__graphicsStudy.version()==='2'));
  check(spec.name+' no page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.waitForTimeout(250);metrics.push({name:spec.name,...await page.evaluate(()=>window.__graphicsStudy.metrics())});
  await page.screenshot({path:path.join(output,spec.name+'-comparison.png'),fullPage:true});
  await page.locator('#time').selectOption('sunset');await page.waitForFunction(()=>window.__graphicsStudy.metrics().time==='sunset');await page.waitForTimeout(180);await page.screenshot({path:path.join(output,spec.name+'-sunset.png'),fullPage:true});
  await page.locator('[data-version="1"]').click();await page.waitForFunction(()=>window.__graphicsStudy?.ready()&&window.__graphicsStudy.version()==='1');
  check(spec.name+' old scene retains costume and time',await page.evaluate(()=>{const m=window.__graphicsStudy.metrics();return m.time==='sunset'&&m.outfit==='scarf-apron';}));
  await page.locator('[data-version="2"]').click();await page.waitForFunction(()=>window.__graphicsStudy?.ready()&&window.__graphicsStudy.version()==='2');
  check(spec.name+' switch disposes old canvas',await page.locator('#study-scene canvas').count()===1);
  for(const outfit of ['none','scarf','apron','scarf-apron']){await page.locator('#outfit').selectOption(outfit);check(spec.name+' outfit '+outfit,await page.evaluate(o=>window.__graphicsStudy.metrics().outfit===o,outfit));}
  check(spec.name+' respects reduced motion',await page.evaluate(()=>window.__graphicsStudy.metrics().reducedMotion));
  await page.goto(base+(spec.width<600?'/mobile.html':'/desktop.html')+'?graphics=2',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkHome?.sceneAvailable()&&window.__synkWorld,null,{timeout:60000,polling:100});
  const guest=page.locator('[data-world="guest"]');if(await guest.isVisible())await guest.click();
  await page.evaluate(()=>window.__synkHome.setEquipment({body:'mongle-apron-starter',neck:'mongle-scarf-first-steps'}));
  check(spec.name+' integrated home loads candidate renderer',await page.evaluate(()=>window.__synkHome.sceneMetrics().graphicsVersion===2));
  check(spec.name+' existing home supports both items',await page.evaluate(()=>window.__synkHome.sceneMetrics().outfit==='scarf-apron'));
  check(spec.name+' integrated home no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(spec.width<600)check(spec.name+' first action visible above fixed navigation',await page.evaluate(()=>{const b=document.querySelector('.hero-copy .felt-button'),r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&b.contains(document.elementFromPoint(r.left+r.width/2,r.bottom-3));}));
  await page.waitForFunction(()=>window.__synkHome.sceneMetrics().frameCount>=2);
  check(spec.name+' integrated scene contains rendered pixels',await page.evaluate(()=>{const c=document.querySelector('#home-scene canvas'),probe=document.createElement('canvas');probe.width=probe.height=16;const ctx=probe.getContext('2d');ctx.drawImage(c,0,0,16,16);const data=ctx.getImageData(0,0,16,16).data,colors=new Set();let opaque=0;for(let i=0;i<data.length;i+=4){if(data[i+3]>0)opaque++;colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);}return document.querySelector('#home-scene').classList.contains('scene-ready')&&opaque>200&&colors.size>20;}));
  // Capture the actual device viewport. Full-page capture can temporarily alter
  // height media queries and clear a paused WebGL canvas while resizing it.
  await page.screenshot({path:path.join(output,spec.name+'-home.png')});
  await context.close();
 }
 check('no browser runtime errors',errors.length===0);check('no missing assets',assets.length===0);
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({checkedAt:new Date().toISOString(),checks,passed:checks.length,errors,assets,metrics,limits:['Software/browser rendering is not native or physical-device performance proof','Visual art candidate, not approved production mascot mesh','Racing reference was inspected from current source and saved actual render captures']},null,2));console.log(JSON.stringify({passed:checks.length,errors,assets,metrics}));
 }finally{await browser.close();}})().catch(e=>{fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:String(e),checks,errors,assets},null,2));console.error(e);process.exit(1);});
