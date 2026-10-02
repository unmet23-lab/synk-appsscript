'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),hash=f=>sha(fs.readFileSync(f));
async function verify(out){
 if(!['유호','브리핑'].includes(path.basename(out))||path.dirname(out)!==path.dirname(__dirname))throw new Error('Outside assigned folders');
 const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 const vision=require(path.join(ROOT,'tools/lib/비전정본.js')).loadVisions().shift.headline;
 const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:2160,height:2700}}),attempts=[];
 await context.route(/^https?:\/\//,r=>{attempts.push(r.request().url());r.abort();});const page=await context.newPage();
 const report={observedAt:new Date().toISOString(),manifestSha256:hash(path.join(out,'manifest.json')),sourceDrift:m.sources.filter(s=>hash(path.join(ROOT,s.path))!==s.sha256),officialVision:vision===m.officialCopy.shiftVision,visionRenderedExactly:m.slides.flatMap(s=>s.text.filter(t=>t.role==='official-vision').map(t=>t.text)).join(' ')===vision,slides:[],externalNetworkAttempts:attempts};
 for(const s of m.slides){
  await page.goto(pathToFileURL(path.join(out,s.html)).href);await page.evaluate(()=>document.fonts.ready);const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const fonts=[];
  for(const t of s.text){const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:`#${t.id}`});fonts.push({id:t.id,text:t.text,...await cdp.send('CSS.getPlatformFontsForNode',{nodeId})});}
  const boxes=await page.locator('svg text').evaluateAll(ns=>ns.map(el=>{const b=el.getBoundingClientRect();return {id:el.id,x:b.x,y:b.y,width:b.width,height:b.height};}));
  const bboxMaxDelta=Math.max(...boxes.flatMap(b=>['x','y','width','height'].map(k=>Math.abs(b[k]-s.textBBoxes.find(t=>t.id===b.id)[k]))));
  const embedded=[];for(const a of [...s.assets,...s.logos]){const uri=await page.locator(`#${a.id}`).evaluate(el=>el.tagName.toLowerCase()==='image'?el.getAttribute('href'):el.querySelector('image').getAttribute('href'));embedded.push({id:a.id,source:a.source,matched:sha(Buffer.from(uri.split(',')[1],'base64'))===a.sourceSha256});}
  const png=fs.readFileSync(path.join(out,s.file)),mobile=fs.readFileSync(path.join(out,s.mobileQA));
  report.slides.push({number:s.number,pngMatches:sha(png)===s.sha256,pngSize:[png.readUInt32BE(16),png.readUInt32BE(20)],mobileSize:[mobile.readUInt32BE(16),mobile.readUInt32BE(20)],bboxMaxDelta,embedded,fonts,systemFallback:fonts.flatMap(t=>t.fonts.filter(f=>!f.isCustomFont)),missingFonts:fonts.filter(t=>!t.fonts.length),clipped:boxes.filter(b=>b.x<0||b.y<0||b.x+b.width>2160||b.y+b.height>2700)});await cdp.detach();
 }
 await browser.close();
 const request=out.endsWith('브리핑')?m.slides[4].text.filter(t=>t.role==='new-request-example').map(t=>t.text).join(' '):null;
 report.newRequestExact=request===null||request==='이 이미지를 기준으로 작업해 주세요. 털, 몸의 형태, 색, 조명과 배경은 보존해 주세요. 이번에는 눈 주변만 움직이게 해 주세요. 읽어야 할 글자는 움직이지 않게 해 주세요. 움직임이 끝나면 자연스럽게 정지하게 해 주세요. 결과는 원본과 같은 크기, 같은 배경에서 비교할 수 있게 보여 주세요.';
 report.mechanicalChecksPassed=report.sourceDrift.length===0&&report.officialVision&&report.visionRenderedExactly&&report.newRequestExact&&attempts.length===0&&report.slides.every(s=>s.pngMatches&&s.pngSize.join()=='2160,2700'&&s.mobileSize.join()=='390,488'&&s.bboxMaxDelta===0&&s.embedded.every(x=>x.matched)&&s.systemFallback.length===0&&s.missingFonts.length===0&&s.clipped.length===0);
 fs.writeFileSync(path.join(out,'qa/검증기록.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({folder:path.basename(out),passed:report.mechanicalChecksPassed,visionExact:report.visionRenderedExactly,newRequestExact:report.newRequestExact,sourceDrift:report.sourceDrift,textNodes:report.slides.reduce((n,s)=>n+s.fonts.length,0),embeddedAssets:report.slides.reduce((n,s)=>n+s.embedded.length,0),fallback:report.slides.flatMap(s=>s.systemFallback),network:attempts},null,2));if(!report.mechanicalChecksPassed)process.exitCode=1;
}
if(require.main===module)verify(__dirname).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={verify};
