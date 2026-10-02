'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:4319/');
  await page.waitForFunction(()=>window.loomScene?.ready,{timeout:30000});
  const current=await page.evaluate(async()=>{
    const scene=window.loomScene,r=scene.renderer;
    scene.capture(0);
    let composite;
    const original=r.texture;
    r.texture=function(source){if(source instanceof HTMLCanvasElement)composite=source.toDataURL('image/png');return original.call(this,source);};
    try{await r.load();}finally{r.texture=original;}
    const c=document.createElement('canvas');c.width=r.bodyImage.width;c.height=r.bodyImage.height;c.getContext('2d').drawImage(r.bodyImage,0,0);
    const base=c.toDataURL('image/png');
    scene.capture(0);
    return {base,composite,audit:r.eyeAudit,canvas:[r.canvas.width,r.canvas.height],body:[c.width,c.height],manifest:scene.renderer.manifest,sceneSnapshot:scene.snapshot()};
  });
  const evidenceDir=path.join(__dirname,'실물');fs.mkdirSync(evidenceDir,{recursive:true});
  for(const [name,data] of [['몽글-공통바탕.png',current.base],['몽글-눈영역합성.png',current.composite]])fs.writeFileSync(path.join(evidenceDir,name),Buffer.from(data.split(',')[1],'base64'));
  delete current.base;delete current.composite;
  await page.locator('#world').screenshot({path:path.join(evidenceDir,'현재정원-정지.png')});
  await page.evaluate(()=>window.loomScene.greet());
  await page.locator('#garden').screenshot({path:path.join(evidenceDir,'현재정원-말풍선.png')});
  const provenance=JSON.parse(fs.readFileSync(path.join(ROOT,'experiences/loom-living/provenance.json'),'utf8'));
  const sourceChecks=Object.entries(provenance.sources).map(([role,s])=>({role,path:s.path,expected:s.sha256,actual:hash(fs.readFileSync(path.resolve(ROOT,s.path)))}));
  const packagedChecks=Object.entries(provenance.outputs).map(([name,s])=>({path:`experiences/loom-living/${name}`,expected:s.sha256,actual:hash(fs.readFileSync(path.join(ROOT,'experiences/loom-living',name)))}));
  const grass=JSON.parse(fs.readFileSync(path.join(ROOT,'experiences/loom-living/qa/grass-contour.json'),'utf8'));
  const grassSources=Object.entries(grass.sourceFiles).map(([rel,expected])=>({path:rel,expected,actual:hash(fs.readFileSync(path.join(ROOT,rel)))}));
  const report={observedAt:new Date().toISOString(),method:'Fresh isolated headless browser using current local Loom renderer; existing texture() upload intercepted without changing source files; same in-memory closed-eye composite captured after canonical load()',scope:'Exact asset composition comparison, not identical final rendered scene pixels. Eyes use packaged body source, downscaled from current approved 4K original. No newly generated expression or fake failure.',...current,sourceChecks,packagedChecks,grassSources,files:fs.readdirSync(evidenceDir).filter(n=>n.endsWith('.png')).map(name=>({name,sha256:hash(fs.readFileSync(path.join(evidenceDir,name)))}))};
  report.sourceDrift=[...sourceChecks,...packagedChecks,...grassSources].filter(s=>s.actual!==s.expected);
  fs.writeFileSync(path.join(evidenceDir,'확인기록.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
  console.log(JSON.stringify({audit:current.audit,canvas:current.canvas,body:current.body,sourceDrift:report.sourceDrift,images:report.files},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
