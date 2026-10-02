'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {createRequire}=require('node:module');
const deps=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=deps('playwright');
const dir=__dirname, root=path.resolve(dir,'..','..','..');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidate=fs.readFileSync(path.join(dir,'after-마스코트.html'));
assert.equal(sha(candidate),manifest.candidate.sha256,'후보 HTML 지문');
assert.equal(sha(fs.readFileSync(path.join(root,manifest.stage.localPath))),manifest.stage.sha256,'추석 영상 지문');
const exactRemote={...manifest.protectedRemote};
const localMirror={
  '/opt/synk-radio/지면/bots/오버레이/라디오표정리듬.js':'bots/오버레이/라디오표정리듬.js',
  '/opt/synk-radio/지면/bots/오버레이/라디오가장자리-b76f448ab55a.js':'bots/오버레이/라디오가장자리.js',
  '/opt/synk-radio/지면/bots/오버레이/radio13-06fdc6100afc.js':'docs/라디오/선정무대_20260910/정수리수정/radio13-06fdc6100afc.js',
};
for(const [rp,lp] of Object.entries(localMirror)) assert.equal(exactRemote[rp],sha(fs.readFileSync(path.join(root,lp))),'로컬 실행 원본이 원격 기준과 다르다: '+lp);
const remoteImagePaths=Object.keys(exactRemote).filter(p=>p.includes('/opt/synk-radio/지면/docs/'));
const remoteCode=`const fs=require('fs'),crypto=require('crypto');const paths=${JSON.stringify(remoteImagePaths)};const out={};for(const p of paths){const b=fs.readFileSync(p);out[p]={sha256:crypto.createHash('sha256').update(b).digest('hex'),base64:b.toString('base64')}}process.stdout.write(JSON.stringify(out));`;
const remoteJson=execFileSync('ssh',['-i',path.join(os.homedir(),'.ssh','synk_radio'),'-o','StrictHostKeyChecking=no','-o','ConnectTimeout=20','synk@34.71.111.97','node'],{input:remoteCode,encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,windowsHide:true});
const remote=JSON.parse(remoteJson),remoteAssets=new Map();
for(const rp of remoteImagePaths){assert.equal(remote[rp]?.sha256,exactRemote[rp],'서버 그림이 검수 기준과 다르다: '+path.basename(rp));remoteAssets.set(rp.replace('/opt/synk-radio/지면',''),Buffer.from(remote[rp].base64,'base64'));}
for(const [rp,lp] of Object.entries(localMirror)) remoteAssets.set(rp.replace('/opt/synk-radio/지면',''),fs.readFileSync(path.join(root,lp)));
const query=new URLSearchParams({층:'마스코트,전광판',크기:'.32',자리:'중하',바닥:'2.5',부스:'1',DJ:'마린',결:'추석보름달마당'});
const wrapper=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#171716}video{position:absolute;width:1280px;height:720px;object-fit:cover}iframe{position:absolute;width:1920px;height:1080px;transform:scale(.6666666667);transform-origin:0 0;border:0}</style><video autoplay muted loop playsinline src="/docs/라디오/무대영상/추석_자연생동_20260909_v2.mp4"></video><iframe src="/bots/오버레이/마스코트.html?${query}"></iframe>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const report={at:new Date().toISOString(),scope:'실제 1280×720 방송 크기에서 추석 마린 의상 제거와 부스 숨김을 확인',errors:[],missing:[],checks:{}};
async function main(){
 const server=http.createServer((req,res)=>{const url=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);if(url==='/'){res.writeHead(200,{'content-type':mime['.html']});return res.end(wrapper);}if(url==='/favicon.ico'){res.writeHead(204);return res.end();}if(url==='/bots/오버레이/마스코트.html'){res.writeHead(200,{'content-type':mime['.html']});return res.end(candidate);}if(remoteAssets.has(url)){res.writeHead(200,{'content-type':mime[path.extname(url).toLowerCase()]||'application/octet-stream'});return res.end(remoteAssets.get(url));}const file=path.resolve(root,'.'+url);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('outside root');}fs.readFile(file,(e,b)=>{if(e){report.missing.push(url);res.writeHead(404);return res.end('missing');}res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});res.end(b);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)report.missing.push(`${r.status()} ${new URL(r.url()).pathname}`)});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded'});
  let mascot=page.frames().find(f=>decodeURIComponent(f.url()).includes('/마스코트.html'));if(!mascot){await page.waitForEvent('framenavigated',{predicate:f=>decodeURIComponent(f.url()).includes('/마스코트.html'),timeout:30000});mascot=page.frames().find(f=>decodeURIComponent(f.url()).includes('/마스코트.html'));}
  assert.ok(mascot,'마스코트 프레임 생성');
  await mascot.waitForFunction(()=>typeof 준비!=='undefined'&&준비,{timeout:30000});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>1&&!v.paused;},{timeout:15000});
  await mascot.waitForFunction(()=>{const booth=document.querySelector('#부스');const clothes=[...document.querySelectorAll('#마스코트틀 img.옷')];return 현재DJ==='마린'&&현재차림==='추석보름달마당'&&clothes.every(x=>x.hidden)&&booth&&booth.hidden;},{timeout:20000});
  const before=await mascot.evaluate(()=>({DJ:현재DJ,scene:현재차림,ready:준비,clothes:[...document.querySelectorAll('#마스코트틀 img.옷')].map(e=>({name:e.dataset.이름||null,hidden:e.hidden,src:e.getAttribute('src')})),booth:{hidden:document.querySelector('#부스').hidden,rect:document.querySelector('#부스').getBoundingClientRect().toJSON(),children:document.querySelectorAll('#부스 img').length},mascotRect:document.querySelector('#마스코트틀').getBoundingClientRect().toJSON(),videoTime:parent.document.querySelector('video').currentTime}));
  report.checks.initial=before;await page.waitForTimeout(1400);await mascot.evaluate(()=>window.마스코트반응({종류:'교대',결:'반딧불노을들판',DJ:'까몽'}));await page.waitForTimeout(2400);
  const after=await mascot.evaluate(()=>({DJ:현재DJ,scene:현재차림,clothesVisible:[...document.querySelectorAll('#마스코트틀 img.옷')].some(x=>!x.hidden&&x.naturalWidth>0),boothHidden:document.querySelector('#부스').hidden,expression:현재표정}));
  report.checks.afterBoundarySignal=after;await page.screenshot({path:path.join(dir,'미리보기.png')});
  assert.equal(before.DJ,'마린');assert.equal(before.scene,'추석보름달마당');assert.equal(before.ready,true);assert.ok(before.clothes.every(x=>x.hidden&&!x.src),'추석 의상 층 제거');assert.equal(before.booth.hidden,true,'추석 DJ 부스 숨김');assert.equal(after.DJ,'마린');assert.equal(after.scene,'추석보름달마당');assert.equal(after.clothesVisible,false,'곡 경계 신호 뒤에도 의상 없음');assert.equal(after.boothHidden,true,'곡 경계 신호 뒤에도 부스 숨김');assert.ok(before.videoTime>1,'추석 배경 영상 재생');assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.missing.length,0,JSON.stringify(report.missing));report.passed=true;
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(dir,'로컬검수.json'),JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors,missing:report.missing},null,2));
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1});
