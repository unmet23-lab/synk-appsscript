'use strict';
// Dedicated local-only renderer. Never attaches to a logged-in Chrome profile.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const coverDir=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
  const before=JSON.parse(fs.readFileSync(path.join(__dirname,'Naver_966px_교정전_지문.json'),'utf8'));
  const preservation=before.files.filter(f=>!f.file.startsWith('shift-naverblog.')).map(f=>({file:f.file,sha256:hash(path.join(coverDir,f.file)),unchanged:hash(path.join(coverDir,f.file))===f.sha256}));
  if(preservation.length!==50||preservation.some(f=>!f.unchanged)) throw Error('Other-cover preservation failed');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const rows=[];
  let externalRequests=0;
  try {
    const page=await browser.newPage({viewport:{width:966,height:360}});
    page.on('request',request=>{if(/^https?:/i.test(request.url())) externalRequests++;});
    await page.goto(pathToFileURL(path.join(coverDir,'shift-naverblog.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const {root}=await cdp.send('DOM.getDocument');
    const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'svg text'});
    const texts=await page.locator('svg text').evaluateAll(els=>els.map(el=>({text:el.textContent,weight:getComputedStyle(el).fontWeight,synthesis:getComputedStyle(el).fontSynthesis})));
    for(let i=0;i<nodeIds.length;i++){
      const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:nodeIds[i]});
      const row={...texts[i],fonts};
      if(fonts.some(f=>!f.isCustomFont)||row.synthesis!=='none') throw Error('Unexpected font fallback or synthesis');
      const expected=i<2?'SUITVariable-ExtraBold':'SUITVariable-Medium';
      if(!fonts.some(f=>f.postScriptName===expected)) throw Error('Korean font weight mismatch');
      rows.push(row);
    }
    if(externalRequests) throw Error('Unexpected external network request');
  } finally {await browser.close();}
  const manifest=JSON.parse(fs.readFileSync(path.join(coverDir,'명세.json'),'utf8'));
  const output=manifest.outputs.find(x=>x.id==='shift-naverblog');
  if(output.w!==966||output.h!==360||output.sha256!==hash(path.join(coverDir,output.file))) throw Error('Naver manifest mismatch');
  const result={checkedAt:new Date().toISOString(),scope:'Naver-only 966x360 desktop title; local rendering, not actual public Naver UI',passed:true,output,actualFonts:rows,externalRequests,preservation};
  fs.writeFileSync(path.join(__dirname,'Naver_966px_검증.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({passed:true,png:output.file,sha256:output.sha256,dimensions:[output.w,output.h],fontRows:rows.length,externalRequests,otherFilesUnchanged:preservation.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
