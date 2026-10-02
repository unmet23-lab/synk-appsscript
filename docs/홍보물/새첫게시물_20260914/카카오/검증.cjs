'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
const read=n=>fs.readFileSync(path.join(__dirname,n));
async function verify(){
  const png=read('대표.png');
  const drift=manifest.sources.filter(s=>hash(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256).map(s=>s.path);
  const svg=read('대표.svg').toString('utf8');
  const embedded=[...svg.matchAll(/(?:href="data:([^;]+);base64,([^"]+)"|src:url\('?data:([^;]+);base64,([^')]+)'?\))/g)].map(m=>({mime:m[1]||m[3],sha256:hash(Buffer.from(m[2]||m[4],'base64'))}));
  const unverifiedEmbedded=embedded.filter(x=>!manifest.sources.some(s=>s.sha256===x.sha256));
  const missingLinks=[];
  for(const v of manifest.readingHTML.viewports)for(const href of v.links)if(!fs.existsSync(path.resolve(__dirname,href)))missingLinks.push(href);
  const fonts=manifest.visual.actualFonts.flatMap(x=>x.fonts);
  const body=read('첫소식-게시본문.txt').toString('utf8');
  const copyMissing=Object.values(manifest.officialCopy).filter(s=>!body.includes(s));
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:900},deviceScaleFactor:1});const external=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);await page.evaluate(()=>document.fonts.ready);
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const actualReadingFonts=[];
  for(const selector of ['h1','.vision','article p:not(.vision)','#inquiry p']){const node=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});const f=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});actualReadingFonts.push({selector,fonts:f.fonts});}
  await cdp.detach();await page.locator('article section:nth-child(4)').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'qa/읽기-390-현재준비.png')});
  await browser.close();
  const result={verifiedAt:new Date().toISOString(),png:{width:png.readUInt32BE(16),height:png.readUInt32BE(20),hashMatches:hash(png)===manifest.visual.sha256},sourceCount:manifest.sources.length,sourceDrift:drift,embeddedAssets:embedded,unverifiedEmbedded,missingLinks:[...new Set(missingLinks)],copyMissing,svgFontNodes:manifest.visual.actualFonts.length,svgFallbackFonts:fonts.filter(f=>!f.isCustomFont),actualReadingFonts,readingFallbackFonts:actualReadingFonts.flatMap(x=>x.fonts).filter(f=>!f.isCustomFont),externalRequests:external,publicURL:null,platformUploaderVerified:false};
  result.passed=result.png.width===2160&&result.png.height===2700&&result.png.hashMatches&&!drift.length&&!unverifiedEmbedded.length&&!missingLinks.length&&!copyMissing.length&&!result.svgFallbackFonts.length&&!result.readingFallbackFonts.length&&!external.length;
  fs.writeFileSync(path.join(__dirname,'qa/verification.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=1;
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
