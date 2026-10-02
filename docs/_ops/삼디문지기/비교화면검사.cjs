'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {pathToFileURL,fileURLToPath}=require('node:url');
const requireRuntime=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=requireRuntime('playwright');
async function main(){
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const results=[];
  try{
    for(const width of [1440,390]){
      const context=await browser.newContext({viewport:{width,height:1050}}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      await page.goto(pathToFileURL(path.join(__dirname,'실물비교.html')).href,{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      const snapshot=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        fonts:[...document.fonts].map(f=>({family:f.family,status:f.status})),
        images:[...document.images].map(i=>({naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,loaded:i.complete})),
        links:[...document.querySelectorAll('a[href]')].map(a=>a.href)}));
      assert.ok(snapshot.scrollWidth<=snapshot.width);
      assert.equal(snapshot.images.length,3);
      assert.deepEqual(snapshot.images.map(i=>[i.naturalWidth,i.naturalHeight]),[[4096,4096],[1024,839],[512,512]]);
      assert.ok(snapshot.images.every(i=>i.loaded));
      for(const family of ['SUIT Variable','Inter Tight'])assert.ok(snapshot.fonts.some(f=>f.family.replace(/["']/g,'')===family&&f.status==='loaded'));
      for(const url of snapshot.links)assert.ok(fs.existsSync(fileURLToPath(url)),url);
      await page.locator('summary').click();assert.equal(await page.locator('details').getAttribute('open'),'');
      await page.locator('summary').click();assert.equal(await page.locator('details').getAttribute('open'),null);
      await page.screenshot({path:path.join(__dirname,`비교화면-${width}.png`),fullPage:true});
      if(width===1440)await page.locator('.pair').screenshot({path:path.join(__dirname,'정본과3D_나란히.png')});
      assert.equal(errors.length,0);results.push({width,...snapshot,errors});await context.close();
    }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(__dirname,'비교화면검사.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify({viewports:2,imageLoads:6,sourceDimensions:'unchanged',overflow:0,details:'pass',localLinks:'pass'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
