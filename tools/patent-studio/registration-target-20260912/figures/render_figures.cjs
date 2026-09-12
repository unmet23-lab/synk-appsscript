'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(__dirname,'qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1000,height:650},deviceScaleFactor:1}),results=[];
const external=[];await page.route('**/*',r=>{if(/^https?:/.test(r.request().url())){external.push(r.request().url());return r.abort();}return r.continue();});
for(let n=1;n<=6;n++){
  await page.goto(pathToFileURL(path.join(__dirname,`fig${n}.svg`)).href);await page.evaluate(()=>document.fonts.ready);
  const geometry=await page.evaluate(()=>{const rows=[...document.querySelectorAll('text')].map(t=>{const b=t.getBBox();return{text:t.textContent,x:b.x,y:b.y,w:b.width,h:b.height};});return{bounds:rows.filter(b=>b.x<0||b.y<0||b.x+b.w>1000||b.y+b.h>650),overlaps:rows.flatMap((a,i)=>rows.slice(i+1).filter(b=>a.x+1<b.x+b.w&&b.x+1<a.x+a.w&&a.y+1<b.y+b.h&&b.y+1<a.y+a.h).map(b=>[a.text,b.text])),count:rows.length,fontLoaded:document.fonts.check('500 24px "SUIT Variable"')&&document.fonts.check('500 24px "Inter Tight"')};});
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'text'});const renderedFonts=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});await cdp.detach();
  await page.screenshot({path:path.join(out,`fig${n}.png`)});results.push({figure:n,...geometry,renderedFonts:renderedFonts.fonts});
}
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({generatedAt:new Date().toISOString(),externalRequests:external,results},null,2));
console.log(JSON.stringify({externalRequests:external.length,results},null,2));
if(external.length||results.some(r=>r.bounds.length||r.overlaps.length||!r.fontLoaded))process.exitCode=1;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
