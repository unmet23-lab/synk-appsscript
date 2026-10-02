'use strict';
// Local files in a separate headless context only; no logged-in browser or platform CSS.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const coverDir=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
  const before=JSON.parse(fs.readFileSync(path.join(__dirname,'Tistory_모바일_교정전_지문.json'),'utf8'));
  const preservation=before.files.filter(f=>!/^shift-tistory\.mobile\.(html|png)$/.test(f.file)).map(f=>({file:f.file,sha256:hash(path.join(coverDir,f.file)),unchanged:hash(path.join(coverDir,f.file))===f.sha256}));
  if(preservation.length!==53||preservation.some(f=>!f.unchanged)) throw Error('Desktop or other-cover bytes changed');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const fonts=[];
  let externalRequests=0;
  try{
    const page=await browser.newPage({viewport:{width:390,height:300}});
    page.on('request',request=>{if(/^https?:/i.test(request.url())) externalRequests++;});
    await page.goto(pathToFileURL(path.join(coverDir,'shift-tistory.mobile.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const {root}=await cdp.send('DOM.getDocument');
    const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'svg text'});
    const text=await page.locator('svg text').evaluateAll(els=>els.map(el=>({text:el.textContent,synthesis:getComputedStyle(el).fontSynthesis})));
    for(let i=0;i<nodeIds.length;i++){
      const result=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:nodeIds[i]});
      if(result.fonts.some(f=>!f.isCustomFont)||text[i].synthesis!=='none') throw Error('Font fallback or synthesis');
      if(!result.fonts.some(f=>f.postScriptName===(i<3?'SUITVariable-ExtraBold':'SUITVariable-Medium'))) throw Error('Korean weight mismatch');
      fonts.push({...text[i],fonts:result.fonts});
    }
    if(externalRequests) throw Error('Unexpected network dependency');
  }finally{await browser.close();}
  const entry=JSON.parse(fs.readFileSync(path.join(coverDir,'명세.json'),'utf8')).outputs.find(x=>x.id==='shift-tistory');
  if(entry.mobile.sha256!==hash(path.join(coverDir,entry.mobile.file))||entry.mobile.width!==390||entry.mobile.height!==300) throw Error('Mobile manifest mismatch');
  const result={checkedAt:new Date().toISOString(),scope:'Dedicated Tistory 390x300 mobile asset, not the public blog or platform media CSS',passed:true,mobile:entry.mobile,desktopSha256:entry.sha256,actualFonts:fonts,externalRequests,preservation};
  fs.writeFileSync(path.join(__dirname,'Tistory_모바일_검증.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:true,sha256:entry.mobile.sha256,dimensions:[390,300],otherFilesUnchanged:preservation.length,fontRows:fonts.length,externalRequests}));
})().catch(error=>{console.error(error);process.exitCode=1;});
