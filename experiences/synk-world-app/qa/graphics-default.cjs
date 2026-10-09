const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.SYNK_WORLD_QA_URL||'http://127.0.0.1:4296',out=process.env.SYNK_WORLD_GRAPHICS_QA_DIR?path.resolve(process.env.SYNK_WORLD_GRAPHICS_QA_DIR):__dirname,checks=[],errors=[];
fs.mkdirSync(out,{recursive:true});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 for(const spec of [{name:'pc',width:1440,height:1024},{name:'phone',width:390,height:844},...(process.env.SYNK_WORLD_GRAPHICS_QA_DIR?[{name:'phone-small',width:320,height:740}]:[])]){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:spec.width<600?2:1,reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/graphics.html');await page.waitForFunction(()=>window.__graphicsStudy?.ready());
  check(spec.name+' comparison starts on v3',await page.evaluate(()=>window.__graphicsStudy.metrics().graphicsVersion===3));
  for(const version of ['1','2','3']){
   await page.locator(`[data-version="${version}"]`).click();await page.waitForFunction(v=>window.__graphicsStudy.ready()&&window.__graphicsStudy.version()===v,version);
   check(spec.name+' version '+version+' has one canvas',await page.locator('#study-scene canvas').count()===1);
  }
  for(const outfit of ['none','scarf','apron','scarf-apron']){
   await page.locator('#outfit').selectOption(outfit);await page.waitForFunction(v=>window.__graphicsStudy.metrics().outfit===v,outfit);
   check(spec.name+' '+outfit+' reaches shared model',await page.evaluate(()=>window.__graphicsStudy.metrics().avatarVersion==='mongle-v3'));
  }
  await page.locator('#time').selectOption('sunset');check(spec.name+' sunset switch',await page.evaluate(()=>window.__graphicsStudy.metrics().time==='sunset'));
  check(spec.name+' respects reduced motion',await page.evaluate(()=>window.__graphicsStudy.metrics().reducedMotion));
  await page.evaluate(()=>{for(const v of ['2','1','3','2','3'])document.querySelector(`[data-version="${v}"]`).click();});
  await page.waitForFunction(()=>window.__graphicsStudy.ready()&&window.__graphicsStudy.metrics().graphicsVersion===3&&document.querySelectorAll('#study-scene canvas').length===1);
  check(spec.name+' rapid comparison converges to one current canvas',true);
  await page.goto(base+(spec.width<600?'/mobile.html':'/desktop.html'));await page.waitForFunction(()=>window.__synkHome?.sceneMetrics()?.graphicsVersion===3&&window.__synkWorld);
  const guest=page.locator('[data-world="guest"]');if(await guest.isVisible())await guest.click();
  check(spec.name+' default home uses v3',await page.evaluate(()=>window.__synkHome.sceneMetrics().graphicsVersion===3));
  check(spec.name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(spec.name+' rendered scene has opaque varied pixels',await page.evaluate(()=>{const c=document.querySelector('#home-scene canvas'),p=document.createElement('canvas');p.width=p.height=16;const x=p.getContext('2d');x.drawImage(c,0,0,16,16);const d=x.getImageData(0,0,16,16).data,s=new Set();let n=0;for(let i=0;i<d.length;i+=4){s.add(`${d[i]},${d[i+1]},${d[i+2]}`);if(d[i+3]>0)n++;}return n>200&&s.size>20;}));
  await page.screenshot({path:path.join(out,(out===__dirname?'v3-final-':'home-')+spec.name+'.png')});await context.close();
 }
 check('no runtime or console errors',errors.length===0);
 fs.writeFileSync(path.join(out,'graphics-default.json'),JSON.stringify({checkedAt:new Date().toISOString(),base,passed:checks.length,checks,errors,physicalDevices:0},null,2));console.log(JSON.stringify({passed:checks.length,errors}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
