'use strict';
// 합성 미리 보기 확인(검수 synk-id-device-wait-c-20261111 F1): 합성 미리 보기의 ?device 동의 카드가 (1) 저장소에 오래된 첫 본 때가 있어도 뜨고 (2) 그 기록을 건드리지 않고
// (3) 시계를 6분 앞으로 돌려도 바뀌지 않는지, ?device=expired는 다시 시작 카드인지 실제 크롬으로 본다.
//   node experiences/synk-account/qa/device-consent-wait-20261111/preview-check.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const repo=path.resolve(__dirname,'../../../..'),root=path.join(repo,'experiences/synk-account');
const {chromium}=require(path.join(repo,'node_modules/playwright'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{
  const server=await new Promise(resolve=>{const s=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/+/,''),file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
    let body;try{body=fs.readFileSync(file);}catch{res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(body);
  }).listen(0,'127.0.0.1',()=>resolve(s));});
  const origin='http://127.0.0.1:'+server.address().port+'/';
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const out={};
  try{
    const context=await browser.newContext({viewport:{width:1280,height:900}});
    const page=await context.newPage();await page.clock.install();
    const state=()=>page.evaluate(()=>({consent:!document.getElementById('consent').hidden,restart:document.getElementById('connection-restart')?.hidden===false,
      tab:sessionStorage.getItem('synk.id.connect-seen.v1'),shared:localStorage.getItem('synk.id.connect-seen.v1')}));
    const shown=()=>page.waitForSelector('#consent:not([hidden]),#connection-restart:not([hidden])',{timeout:8000});
    // (1)(2) 오래된 기록을 두 저장소에 넣고 연다
    await page.goto(origin+'preview.html?authorization_id=preview&device',{waitUntil:'networkidle'});await shown();
    out.first=await state();
    const old=JSON.stringify({id:'preview',at:Date.now()-600000});
    await page.evaluate(v=>{sessionStorage.setItem('synk.id.connect-seen.v1',v);localStorage.setItem('synk.id.connect-seen.v1',v);},old);
    await page.reload({waitUntil:'networkidle'});await shown();
    out.afterOldRecord=await state();out.recordUntouched=out.afterOldRecord.tab===old&&out.afterOldRecord.shared===old;
    // (3) 6분을 앞으로
    await page.clock.fastForward(360000);await page.waitForTimeout(200);
    out.afterSixMinutes=await state();
    await page.clock.fastForward(86400000);await page.waitForTimeout(200);
    out.afterOneDay=await state();
    // ?device=expired
    await page.goto(origin+'preview.html?authorization_id=preview&device=expired',{waitUntil:'networkidle'});await shown();
    out.expired=await state();
  }finally{await browser.close();server.close();}
  const ok=out.first.consent&&!out.first.restart&&out.first.tab===null&&out.first.shared===null&&out.afterOldRecord.consent&&!out.afterOldRecord.restart&&out.recordUntouched
    &&out.afterSixMinutes.consent&&!out.afterSixMinutes.restart&&out.afterOneDay.consent&&!out.afterOneDay.restart&&out.expired.restart&&!out.expired.consent;
  console.log(JSON.stringify({ok,...out},null,1));process.exitCode=ok?0:1;
})().catch(error=>{console.error(error);process.exitCode=1;});
