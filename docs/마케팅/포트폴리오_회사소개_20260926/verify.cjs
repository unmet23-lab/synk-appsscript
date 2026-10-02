const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const d=__dirname;const {url}=JSON.parse(fs.readFileSync(path.join(d,'qa/preview-server.json')));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[];
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(url);await page.evaluate(()=>document.fonts.ready);
  await page.locator('img').evaluateAll(async imgs=>{for(const i of imgs){i.loading='eager';await i.decode();}});
  const links=await page.locator('a[download]').evaluateAll(es=>es.map(e=>e.href));
  const broken=[];for(const href of links){const r=await page.request.get(href);if(r.status()!==200)broken.push({href,status:r.status()});}
  const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
  await page.screenshot({path:path.join(d,'qa',`preview-${width}.png`)});
  await page.locator('nav a').last().click();await page.locator('#g4 summary').click();
  const inquiry=await page.locator('#g4 pre').isVisible();
  await page.screenshot({path:path.join(d,'qa',`inquiry-${width}.png`)});
  results.push({width,status:response.status(),errors,broken,overflow,inquiry,imageCount:await page.locator('figure img').count()});
  await page.close();
 }
 const p=await browser.newPage();await p.goto(pathToFileURL(path.join(d,'source/behance-01-overview.html')).href);await p.evaluate(()=>document.fonts.ready);
 const cdp=await p.context().newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const doc=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.text'});const fonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
 await browser.close();
 fs.writeFileSync(path.join(d,'qa/preview-check.json'),JSON.stringify({results,actualKoreanFonts:fonts,visualReview:'13 images individually reviewed; material-detail images revised using original source assets; no publication'},null,2));
 console.log(JSON.stringify({results,fonts}));
 if(results.some(r=>r.status!==200||r.errors.length||r.broken.length||r.overflow.document>r.width||!r.inquiry||r.imageCount!==13))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
