'use strict';
// Local rendering only. Does not use a logged-in browser or upload covers.
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const rows=[];
 try {
  for(const id of ['lab-youtube','lab-facebook']) {
   const page=await browser.newPage();
   await page.goto(pathToFileURL(path.join(__dirname,id+'.html')).href);
   await page.evaluate(()=>document.fonts.ready);
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('DOM.enable');await cdp.send('CSS.enable');
   const {root}=await cdp.send('DOM.getDocument');
   const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'svg text'});
   const nodes=await page.locator('svg text').evaluateAll(els=>els.map(el=>({text:el.textContent,weight:getComputedStyle(el).fontWeight,synthesis:getComputedStyle(el).fontSynthesis})));
   for(let i=0;i<nodeIds.length;i++) {
    const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:nodeIds[i]});
    const node={id,...nodes[i],fonts};
    if(/[\u0400-\u04ff]/u.test(node.text)) {
     if(node.weight!=='700'||node.synthesis!=='none'||!fonts.every(f=>f.postScriptName==='InterTight-Bold')) throw Error('Mongolian headline font mismatch: '+JSON.stringify(node));
    }
    if(fonts.some(f=>!f.isCustomFont)) throw Error('Unexpected system fallback: '+JSON.stringify(node));
    rows.push(node);
   }
   await page.close();
  }
 } finally {await browser.close();}
 const result={checkedAt:new Date().toISOString(),scope:'Two Mongolian covers, actual local rendered fonts; no platform upload',passed:true,rows};
 fs.writeFileSync(path.join(__dirname,'서체확인.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
