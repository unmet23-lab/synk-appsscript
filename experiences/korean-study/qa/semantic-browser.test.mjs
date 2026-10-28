import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import os from 'node:os';import {createRequire} from 'node:module';
import {ANSWER,ACCOUNT,feedbackFixture,configFor} from './semantic-fixture.mjs';
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const DIST=path.resolve('experiences/korean-study/dist/study'),OUT=path.resolve('.tmp/atlas-edtech-20261028/semantic-browser');
const BANK=JSON.parse(fs.readFileSync(path.join(DIST,'items.json'),'utf8'));
test('의미 튜터 화면: 확인 정오답별 안내 → 적용 → 내 글 수정 → 새 과제, 연결 해제·실패', {timeout:240000},async()=>{
 fs.mkdirSync(OUT,{recursive:true});const posted=[],errors=[],measures=[];let mode='focus';
 const server=http.createServer(async(req,res)=>{const base='http://127.0.0.1:'+server.address().port,u=new URL(req.url,base);
  if(u.pathname==='/account/config.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(configFor(base)));return;}
  if(u.pathname==='/functions/v1/world-writing'){
   let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw);posted.push(b);res.setHeader('content-type','application/json');
   if(b.action==='status'){res.end(JSON.stringify({ok:true,enabled:true,accountId:ACCOUNT,studyVersion:1,bankHash:BANK.sourceHash}));return;}
   if(mode==='fail'||mode==='expired'){res.statusCode=mode==='fail'?503:401;res.end(JSON.stringify({ok:false,code:mode==='fail'?'UNAVAILABLE':'AUTH_REQUIRED'}));return;}
   const f=feedbackFixture();if(b.study.stage==='revision'){Object.assign(f,{status:'clear',summary:'두 시점의 변화 방향이 이어져요.',rewrite:'다른 자료에서도 비교해 볼까요?',focus:null,check:null,practice:null,help:null});}
   res.end(JSON.stringify({ok:true,status:'ok',accountId:ACCOUNT,feedback:f}));return;
  }
  const rel=u.pathname.replace(/^\/study\//,''),file=path.resolve(DIST,rel||'index.html');if(!u.pathname.startsWith('/study/')||!file.startsWith(DIST+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('content-type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 try{
  for(const [width,pick] of [[390,'a'],[1440,'b']]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(()=>sessionStorage.setItem('synk.oauth.session.study',JSON.stringify({access_token:'synthetic-token',expires_at:Date.now()+3600000})));
   const state=()=>page.evaluate(account=>JSON.parse(localStorage.getItem('synk.study.v2:user-'+account)),ACCOUNT);
   const shot=async name=>{await page.screenshot({path:path.join(OUT,`${width}-${name}.png`),fullPage:true});measures.push(await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,tiny:[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height<44;}).map(e=>e.textContent)})));};
   await page.goto(base+'/study/?lang=ko');await page.waitForSelector('[data-st-text]');await page.fill('[data-st-text]',ANSWER);await page.click('[data-st-done]');await page.waitForSelector('[data-ai-choice]');await shot('check');
   assert.equal((await state()).scene.feedback.focus.skill,'data.accuracy');await page.click(`[data-ai-choice="${pick}"]`);await page.click('[data-ai-advance]');
   if(pick==='a'){assert.equal((await state()).scene.phase,'help');await shot('help');await page.click('[data-ai-advance]');}
   assert.equal((await state()).scene.phase,'practice');await shot('practice');await page.click('[data-ai-choice="a"]');await page.click('[data-ai-advance]');
   await page.waitForSelector('[data-st-text]');assert.equal(await page.inputValue('[data-st-text]'),ANSWER);await shot('rewrite');await page.fill('[data-st-text]',ANSWER.replace('줄었다','늘었다'));await page.click('[data-st-done]');await page.waitForSelector('[data-ai-finish]');await shot('clear');await page.click('[data-ai-finish]');
   await page.waitForSelector('[data-st-text]');assert.notEqual((await state()).scene.itemId,'w53-resale');
   const sent=posted.filter(p=>p.action==='feedback').slice(-2);assert.equal(sent[1].study.stage,'revision');assert.equal(sent[1].study.focusSkill,'data.accuracy');
   await page.click('[data-st-disconnect]');await page.waitForSelector('[data-st-connect]');assert.equal(await page.inputValue('[data-st-text]'),'');await context.close();
  }
  mode='fail';const context=await browser.newContext(),page=await context.newPage();await page.addInitScript(()=>sessionStorage.setItem('synk.oauth.session.study',JSON.stringify({access_token:'synthetic-token',expires_at:Date.now()+3600000})));
  await page.goto(base+'/study/?lang=ko');await page.fill('[data-st-text]',ANSWER);await page.click('[data-st-done]');await page.waitForSelector('[data-st-next]');await page.waitForSelector('.st-alert[role=status]');assert.ok((await page.textContent('.st-alert[role=status]')).length>0);await context.close();
  mode='expired';const expired=await browser.newContext(),ep=await expired.newPage();await ep.addInitScript(()=>sessionStorage.setItem('synk.oauth.session.study',JSON.stringify({access_token:'synthetic-token',expires_at:Date.now()+3600000})));
  await ep.goto(base+'/study/?lang=ko');await ep.fill('[data-st-text]',ANSWER);await ep.click('[data-st-done]');await ep.waitForSelector('[role=alert]');assert.match(await ep.textContent('[role=alert]'),/다시 로그인/);
  assert.equal(await ep.inputValue('[data-st-text]'),'');const old=await ep.evaluate(account=>JSON.parse(localStorage.getItem('synk.study.v2:user-'+account)),ACCOUNT);assert.equal(old.drafts['w53-resale'].text,ANSWER);await expired.close();
 }finally{await browser.close();server.close();fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify({posted:posted.map(({answer,...b})=>({...b,answerChars:answer?.length})),errors,measures},null,2));}
 assert.deepEqual(errors,[]);assert.deepEqual(measures.filter(m=>m.overflow||m.tiny.length),[]);
});
