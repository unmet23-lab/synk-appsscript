'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../../../..');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main(){
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
  const {loadVisions}=require(path.join(ROOT,'tools/lib/비전정본.js'));
  const currentVision=loadVisions().synk;
  const currentPhilosophy=fs.readFileSync(path.join(ROOT,'docs/SYNK_철학.md'),'utf8').match(/^## 1\. (.+)$/m)[1].trim().replace(/\.$/,'')+'.';
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:2160,height:2700}});
  const attempts=[];
  await context.route(/^https?:\/\//,route=>{attempts.push(route.request().url());route.abort();});
  const page=await context.newPage();
  const report={observedAt:new Date().toISOString(),manifestSha256:sha(path.join(__dirname,'manifest.json')),sourceDrift:manifest.sources.filter(s=>sha(path.join(ROOT,s.path))!==s.sha256),officialCopy:{vision:manifest.officialCopy.vision===currentVision.headline,subtext:manifest.officialCopy.subtext===currentVision.subtext,philosophy:manifest.officialCopy.philosophy===currentPhilosophy},slides:[],externalNetworkAttempts:attempts,manualReviewRecordedIn:'검증결과.md'};
  for(const s of manifest.slides){
    const image=fs.readFileSync(path.join(__dirname,s.file));
    const mobile=fs.readFileSync(path.join(__dirname,s.mobileQA));
    await page.goto(pathToFileURL(path.join(__dirname,s.html)).href);
    await page.evaluate(()=>document.fonts.ready);
    const cdp=await context.newCDPSession(page);
    await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    const {root}=await cdp.send('DOM.getDocument');
    const fonts=[];
    for(const item of s.text){
      const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:`#${item.id}`});
      const result=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
      fonts.push({id:item.id,text:item.text,fonts:result.fonts});
    }
    const boxes=await page.locator('svg text').evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return {id:el.id,x:b.x,y:b.y,width:b.width,height:b.height};}));
    const bboxMaxDelta=Math.max(...boxes.flatMap(b=>['x','y','width','height'].map(k=>Math.abs(b[k]-s.textBBoxes.find(t=>t.id===b.id)[k]))));
    const svg=fs.readFileSync(path.join(__dirname,s.svg),'utf8');
    const embeddedLogos=[...svg.matchAll(/<image id="logo-\d+"[^>]+href="data:image\/png;base64,([^"]+)"/g)].map(m=>crypto.createHash('sha256').update(Buffer.from(m[1],'base64')).digest('hex'));
    const embeddedLogoMatch=embeddedLogos.length===s.logos.length&&s.logos.every((l,i)=>l.sourceSha256===embeddedLogos[i]);
    const row={number:s.number,pngSha256:sha(path.join(__dirname,s.file)),pngMatches:sha(path.join(__dirname,s.file))===s.sha256,pngSize:[image.readUInt32BE(16),image.readUInt32BE(20)],mobileSize:[mobile.readUInt32BE(16),mobile.readUInt32BE(20)],bboxMaxDelta,embeddedLogoMatch,fonts,systemFallback:fonts.flatMap(t=>t.fonts.filter(f=>!f.isCustomFont).map(f=>({id:t.id,...f}))),missingCustomFonts:fonts.filter(t=>t.fonts.length===0).map(t=>t.id)};
    report.slides.push(row);await cdp.detach();
  }
  await browser.close();
  report.mechanicalChecksPassed=Object.values(report.officialCopy).every(Boolean)&&report.sourceDrift.length===0&&attempts.length===0&&report.slides.every(s=>s.pngMatches&&s.pngSize.join()=='2160,2700'&&s.mobileSize.join()=='390,488'&&s.bboxMaxDelta===0&&s.embeddedLogoMatch&&s.systemFallback.length===0&&s.missingCustomFonts.length===0);
  fs.writeFileSync(path.join(__dirname,'qa','검증기록.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({mechanicalChecksPassed:report.mechanicalChecksPassed,officialCopy:report.officialCopy,sourceCount:manifest.sources.length,sourceDrift:report.sourceDrift.length,slides:report.slides.length,textCount:manifest.slides.reduce((n,s)=>n+s.text.length,0),fontChecks:report.slides.reduce((n,s)=>n+s.fonts.length,0),systemFallback:report.slides.flatMap(s=>s.systemFallback),externalNetworkAttempts:attempts,bboxMaxDelta:Math.max(...report.slides.map(s=>s.bboxMaxDelta)),files:report.slides.map(s=>({number:s.number,pngSha256:s.pngSha256}))},null,2));
  if(!report.mechanicalChecksPassed) process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
