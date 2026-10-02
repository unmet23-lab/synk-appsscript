'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {createRequire}=require('module');const req=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');const {chromium}=req('playwright');
const root=path.resolve(__dirname,'../../../..'),parent=path.dirname(__dirname);
(async()=>{
 const m=JSON.parse(fs.readFileSync(path.join(parent,'now-playing.json')));
 for(const f of ['now-playing.json','chapters.txt','upload-metadata.json','youtube.cjs'])fs.copyFileSync(path.join(parent,f),path.join(__dirname,f));
 const server=http.createServer((q,r)=>{try{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));r.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.png')?'image/png':'text/html');r.end(fs.readFileSync(f));}catch{r.statusCode=404;r.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2/3});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/bots/오버레이/방송층.html');
  const frame=page.frames().find(f=>decodeURI(f.url()).includes('전광판.html'));assert.ok(frame);
  await page.evaluate(()=>document.fonts.ready);await frame.evaluate(()=>document.fonts.ready);
  assert.ok(await page.locator('#라디오각인 img').evaluate(e=>e.complete&&e.naturalWidth>0));
  let concat='ffconcat version 1.0\n';const qa=[];
  for(const [i,t] of m.tracks.entries()){
   await frame.evaluate(t=>window.전광판사건({종류:'곡',제목:t}),t.title);
   await page.waitForTimeout(i===0?1400:100);
   const box=await frame.locator('#구석').boundingBox();assert.ok(box.x>960&&box.y<100&&box.x+box.width<1900&&box.y+box.height<250);
   assert.equal(await frame.locator('#구석').innerText(),t.title);
   const name='overlay-'+String(i).padStart(2,'0')+'.png';await page.screenshot({path:path.join(__dirname,name),omitBackground:true});
   const end=m.tracks[i+1]?.start??m.duration;concat+=`file '${name}'\nduration ${(end-t.start).toFixed(6)}\n`;
   qa.push({title:t.title,box});
   if([0,12,15,17].includes(i)){
    await page.evaluate(()=>document.body.style.background="url('/docs/라디오/곡제목_모음집_20260927/background.png') center/cover");
    await page.screenshot({path:path.join(__dirname,'preview-'+i+'.png')});
    await page.evaluate(()=>document.body.style.background='transparent');
   }
  }
  concat+="file 'overlay-18.png'\n";fs.writeFileSync(path.join(__dirname,'overlays.ffconcat'),concat);
  fs.writeFileSync(path.join(__dirname,'layout-qa.json'),JSON.stringify({errors,tracks:qa},null,2));assert.deepEqual(errors,[]);
  console.log('19 titles checked; original embedded radio logo retained; 4 previews rendered');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

