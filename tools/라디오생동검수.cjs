'use strict';
// 실제 배포 후보를 격리한 로컬 주소에서 재생한다. 공유 작업본의 미배포 의상 API는 싣지 않는다.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), { createRequire } = require('node:module');
const deps = createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = deps('playwright');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/_ops/라디오생동_20260909');
const candidate = path.join(out, '마스코트_배포.html');
const query = new URLSearchParams({층:'마스코트,전광판', 크기:'.32', 자리:'중하', 바닥:'2.5', 부스:'1', 결:'추석보름달마당', 밤:'0'});
const wrapper = `<!doctype html><style>html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#171716}video{position:absolute;width:1280px;height:720px}iframe{position:absolute;width:1920px;height:1080px;transform:scale(.6666666667);transform-origin:0 0;border:0}</style><video autoplay muted loop src="/docs/라디오/무대영상/추석_자연생동_20260909.mp4"></video><iframe src="/bots/오버레이/방송층.html?${query}"></iframe>`;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mp4':'video/mp4','.webp':'image/webp','.png':'image/png','.json':'application/json'};
async function main() {
  fs.mkdirSync(out,{recursive:true});
  const server = http.createServer((req,res)=>{
    const url = decodeURIComponent(req.url.split('?')[0]);
    if(url==='/'){res.writeHead(200,{'content-type':mime['.html']});return res.end(wrapper);}
    const p = url==='/bots/오버레이/마스코트.html' ? candidate : path.resolve(root,'.'+url);
    if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    fs.readFile(p,(e,b)=>{res.writeHead(e?404:200,{'content-type':mime[path.extname(p)]||'application/octet-stream'});res.end(e?'missing':b);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const report={scope:'실제 배포 HTML + 새 무대, 실시간 브라우저 65초, 방송과 같은 크기와 자리',errors:[],samples:[]};
  try {
    const context = await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(out,'녹화'),size:{width:1280,height:720}}});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const mascot=page.frames().find(f=>decodeURIComponent(f.url()).includes('/마스코트.html'))
      ||await page.waitForEvent('framenavigated',{predicate:f=>decodeURIComponent(f.url()).includes('/마스코트.html')});
    assert.ok(mascot,'마스코트 프레임');
    await mascot.waitForFunction(()=>typeof 준비!=='undefined'&&준비);
    const start=Date.now();const seen=new Set();
    while(Date.now()-start<65000){
      const sample=await mascot.evaluate(()=>({ms:performance.now(),DJ:현재DJ,expression:현재표정,transform:틀.style.transform,visible:[...document.querySelectorAll('#마스코트틀 img')].filter(i=>!i.hidden&&getComputedStyle(i).display!=='none').map(i=>({src:decodeURIComponent(i.src).split('/').at(-1),width:i.naturalWidth}))}));
      report.samples.push(sample);
      if(!seen.has(sample.expression)){seen.add(sample.expression);await page.screenshot({path:path.join(out,`동작_${sample.expression}.png`)});console.log('확인한 표정: '+sample.expression);}
      await page.waitForTimeout(160);
    }
    report.expressions=[...seen];
    report.videoDuration=await page.evaluate(()=>document.querySelector('video').duration);
    report.elapsedSeconds=(Date.now()-start)/1000;
    const video=page.video();await context.close();
    await video.saveAs(path.join(out,'자연생동_브라우저.webm'));
    assert.equal(report.errors.length,0,JSON.stringify(report.errors));
    assert.ok(seen.has('깜빡'));assert.ok(seen.size>=3,'기본/깜빡 이외 표정도 관측');
    assert.ok(report.samples.every(x=>x.DJ==='까몽'&&x.visible.length===1&&x.visible[0].width===1024));
    assert.equal(new Set(report.samples.map(x=>x.transform)).size,1,'몸 전체의 상시 확대/흔들림 없음');
    report.passed=true;
  } finally {
    fs.writeFileSync(path.join(out,'브라우저검증.json'),JSON.stringify(report,null,2));
    await browser.close();await new Promise(r=>server.close(r));
  }
  console.log(JSON.stringify({passed:report.passed,expressions:report.expressions,samples:report.samples.length,errors:report.errors}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
