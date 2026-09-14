'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const dir=__dirname,root=path.resolve(dir,'../../../..'),sourceDir=path.join(dir,'..','정수리수정');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const routes=new Map([
 ['/bots/오버레이/마스코트.html',path.join(dir,'after-마스코트.html')],
 ['/bots/오버레이/'+manifest.helperName,path.join(sourceDir,manifest.helperName)],
 ['/bots/오버레이/라디오가장자리-b76f448ab55a.js',path.join(root,'bots/오버레이/라디오가장자리.js')],
]);
async function main(){
 const server=http.createServer((req,res)=>{
  let p;try{p=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end();return;}
  const target=routes.get(p)||path.resolve(root,'.'+p);
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404).end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4'};
  res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(target).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url());});
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/bots/오버레이/마스코트.html?크기=0.32&자리=중하&바닥=2.5&부스=1&고정=기본',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>typeof 준비!=='undefined'&&준비&&window.라디오13?.검사,{timeout:30000});
  await page.evaluate(()=>{const v=document.createElement('video');v.id='qa-background';v.src='/영상/public/radioDreams20260910/field-loop.mp4';v.muted=true;v.style='position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1';document.body.prepend(v);});
  await page.waitForFunction(()=>document.getElementById('qa-background').readyState>=2);
  const state=await page.evaluate(()=>{
   const r=틀.getBoundingClientRect(),im=이미지.까몽.기본,c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
   const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   const bounds=[minX,minY,maxX+1,maxY+1],visibleCenterX=r.x+((bounds[0]+bounds[2])/2/c.width)*r.width;
   return {ready:준비,dj:현재DJ,scene:현재차림,box:{x:r.x,y:r.y,width:r.width,height:r.height},alphaBounds:bounds,visibleCenterX,pixels:window.라디오13.검사,expression:현재표정};
  });
  assert.equal(state.dj,'까몽');assert.equal(state.scene,'반딧불노을들판');assert.deepEqual(state.alphaBounds,manifest.layout.visibleAlphaBounds);
  assert.ok(Math.abs(state.box.x-manifest.layout.box.left)<.05);assert.ok(Math.abs(state.box.y-305)<.05);assert.ok(Math.abs(state.box.width-580)<.05);
  assert.ok(Math.abs(state.visibleCenterX-960)<.05,'보이는 마스코트 중심이 화면 중앙이 아니다');
  assert.equal(state.pixels.outsideEyeDifference,0);assert.equal(state.pixels.expressionAlphaEqual,true);assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(dir,'검수-가운데.png')});
  const result={at:new Date().toISOString(),passed:true,state,errors,scope:'Local isolated 1920x1080 render with the current background; not the public stream.'};
  fs.writeFileSync(path.join(dir,'로컬검수.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
