'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../..'),dir=path.join(root,'docs/엔진');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({offline:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 const files=fs.readdirSync(dir).filter(x=>/^SYNK_(?:Core|Loom|Vellum|Trail|Prism|Temper|Reed|Strata)_소개서\.html$|^SYNK_엔진_지도\.html$/.test(x));assert.equal(files.length,9);
 for(const file of files){await page.goto(pathToFileURL(path.join(dir,file)).href);await page.evaluate(()=>document.fonts.ready);
  assert.ok(!/(?:엔진\s*7종|일곱\s*엔진|엔진\s*일곱)/.test(await page.locator('body').innerText()),file+' old engine count');
  const links=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href')));for(const href of links){if(/^(?:https?:|mailto:|tel:)/.test(href))continue;const [p,hash]=href.split('#');if(p)assert.ok(fs.existsSync(path.resolve(dir,decodeURIComponent(p))),file+' missing '+href);else if(hash)assert.ok(await page.locator('[id="'+hash+'"]').count(),file+' missing anchor '+href);}
  if(file==='SYNK_엔진_지도.html')assert.equal(await page.locator('main strong a[href$="_소개서.html"]').count(),8);
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));const size=await page.evaluate(()=>({view:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.view,file+JSON.stringify(size));results.push({file,...size});if(file==='SYNK_Strata_소개서.html'||file==='SYNK_엔진_지도.html')await page.screenshot({path:path.join(__dirname,`${file.replace('.html','')}-${width}.png`)});}
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'소개서검증.json'),JSON.stringify({files:files.length,views:results.length,errors,results},null,2)+'\n');console.log(JSON.stringify({files:files.length,views:results.length,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
