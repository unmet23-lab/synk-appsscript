'use strict';
// Isolated local-render test, not control of a user's browser or live broadcast.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'라이브13'),manifest=require('./라이브13/manifest.json');
const routes=new Map([
 ['/bots/오버레이/마스코트.html',path.join(out,'after-마스코트.html')],
 ['/bots/오버레이/'+manifest.helperName,path.join(out,manifest.helperName)],
 ['/bots/오버레이/라디오가장자리-b76f448ab55a.js',path.join(root,'bots/오버레이/라디오가장자리.js')],
]);
async function main(){
 const server=http.createServer((req,res)=>{
  let p;try{p=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end();return;}
  const target=routes.get(p)||path.resolve(root,'.'+p);
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404).end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'};
  res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(target).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url());});
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/bots/오버레이/마스코트.html?크기=0.32&자리=중하&바닥=2.5&부스=1',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>typeof 준비!=='undefined'&&준비&&window.라디오13?.검사,{timeout:30000});
  const state=await page.evaluate(()=>{const r=틀.getBoundingClientRect();return {ready:준비,dj:현재DJ,scene:현재차림,box:{x:r.x,y:r.y,width:r.width,height:r.height},visible:[...틀.querySelectorAll('img')].filter(i=>!i.hidden).length,booth:!document.getElementById('부스').hidden,pixels:window.라디오13.검사,transform:getComputedStyle(이미지.까몽.기본).transform};});
  assert.equal(state.dj,'까몽');assert.equal(state.scene,'반딧불노을들판');assert.equal(state.visible,1);assert.equal(state.booth,false);assert.equal(state.transform,'none');
  for(const [key,value]of Object.entries({x:455,y:305,width:580,height:580}))assert.ok(Math.abs(state.box[key]-value)<.05,'Layout '+key);
  assert.equal(state.pixels.outsideEyeDifference,0);assert.equal(state.pixels.expressionAlphaEqual,true);
  // The video is behind the same live HTML; snapshots fix the background for expression comparison.
  await page.evaluate(()=>{const v=document.createElement('video');v.id='qa-background';v.src='/영상/public/radioDreams20260910/field-loop.mp4';v.muted=true;v.loop=true;v.style='position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1';document.body.prepend(v);});
  await page.waitForFunction(()=>document.getElementById('qa-background').readyState>=2);
  for(const expression of ['기본','깜빡','눈웃음']){
   await page.evaluate(name=>{인자.set('고정',name);한틱();},expression);
   await page.screenshot({path:path.join(out,'검수-'+expression+'.png')});
  }
  await page.evaluate(()=>{인자.delete('고정');document.getElementById('qa-background').play();});
  const seen=new Set();for(let i=0;i<50;i++){seen.add(await page.evaluate(()=>현재표정));await page.waitForTimeout(200);}
  const playback=await page.evaluate(()=>{const v=document.getElementById('qa-background');return {currentTime:v.currentTime,paused:v.paused,readyState:v.readyState,error:v.error?.message||null};});
  assert.ok(playback.currentTime>5&&!playback.paused&&!playback.error);assert.ok(seen.has('깜빡'),'Natural blink observed');
  assert.deepEqual(errors,[]);
  const result={at:new Date().toISOString(),state,playback,observedExpressions:[...seen],errors,scope:'Local isolated browser, live candidate HTML; 10 seconds runtime plus 3 fixed-expression screenshots. Not the public stream.'};
  fs.writeFileSync(path.join(out,'로컬검수.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
