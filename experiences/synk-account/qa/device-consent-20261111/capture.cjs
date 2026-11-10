'use strict';
// 동의 카드 전 · 후 캡처(합성 미리 보기 preview.html). 「전」은 바탕 커밋의 preview.html · dist/preview.js,
// 「후」는 작업본 것. 같은 정적 자산(style.css · 글꼴 등)을 쓰고 127.0.0.1에서 연다.
//   node experiences/synk-account/qa/device-consent-20261111/capture.cjs <바탕 커밋> <출력 폴더>
// 출력: <출력>/전|후/<1440|390>/<장면>.png  (검수묶음.mjs 준비 --캡처 <출력>)
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../../..'),root=path.join(repo,'experiences/synk-account');
const [baseRev,outDir]=process.argv.slice(2);if(!baseRev||!outDir)throw Error('Use: capture.cjs <base commit> <output folder>');
const {chromium}=require(path.join(repo,'node_modules/playwright'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf'};
const fromBase=rel=>execFileSync('git',['show',baseRev+':experiences/synk-account/'+rel],{cwd:repo,maxBuffer:64*1024*1024});
function serve(version){
  return new Promise(resolve=>{const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,'');
    const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
    let body;try{body=version==='전'&&['preview.html','dist/preview.js'].includes(rel)?fromBase(rel):fs.readFileSync(file);}catch{res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);
  }).listen(0,'127.0.0.1',()=>resolve(server));});
}
// 로컬 미리 보기는 127.0.0.1에서 열려 도착 주소가 늘 이 PC 주소다 — 웹 주소 쪽 흐름은 단위 시험(portal-rate-limit)이 본다.
const scenes=[['기기-앱-연결','preview.html?authorization_id=preview&device']];
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const report=[];
  try{
    for(const version of ['전','후']){
      const server=await serve(version),origin='http://127.0.0.1:'+server.address().port+'/';
      try{
        for(const [width,height] of [[1440,1000],[390,844]]){
          const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
          for(const [name,query] of scenes){
            await page.goto(origin+query,{waitUntil:'networkidle'});await page.waitForSelector('#consent:not([hidden])',{timeout:8000}).catch(()=>{});
            await page.evaluate(()=>document.fonts.ready);await page.locator('#consent').scrollIntoViewIfNeeded().catch(()=>{});
            const file=path.join(outDir,version,String(width),name+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});await page.screenshot({path:file,fullPage:true});
            const state=await page.evaluate(()=>({consent:!document.getElementById('consent').hidden,account:document.getElementById('consent-account')?.hidden===false?document.getElementById('consent-account').textContent:null,
              device:document.getElementById('consent-native')?.hidden===false,notice:document.getElementById('notice').textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
            report.push({version,width,name,...state,errors:[...errors]});errors.length=0;
          }
          await page.close();
        }
      }finally{server.close();}
    }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(outDir,'capture-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
