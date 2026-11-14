// 한국어 공부 · 실제 브라우저 흐름(Edge 헤드리스). 먼저 node experiences/korean-study/build.mjs.
// node --test experiences/korean-study/qa/browser.test.mjs — 캡처는 .tmp/writing-tutor-20261028/browser/.
// 콘텐츠 검수가 끝나기 전에도 흐름을 보려고, 시험 서버만 study.json을 원고(content/ending-53.json)의 전 문항을 통과로 바꾼 사본으로 낸다(SYNK_STUDY_REAL=1이면 dist 그대로).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url)),DIST=path.join(HERE,'../dist/study'),OUT=path.resolve(HERE,'../../../.tmp/atlas-edtech-20261028/browser');
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const content=JSON.parse(fs.readFileSync(path.join(HERE,'../content/ending-53.json'),'utf8'));
const fixture=JSON.stringify({version:1,topic:content.topic,items:content.items.map(({review,...i})=>({...i,review:{status:'passed'}}))});
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.woff2':'font/woff2'};
let fail={items:false};
function serve(){return new Promise(res=>{const s=http.createServer((req,r)=>{const u=new URL(req.url,'http://x');
 if(req.method!=='GET'){r.writeHead(405).end();return;}
 if(u.pathname==='/study/study.json'&&!process.env.SYNK_STUDY_REAL){r.writeHead(200,{'content-type':TYPES['.json']}).end(fixture);return;}
 if(u.pathname==='/study/items.json'&&fail.items){r.writeHead(503).end();return;}
 const rel=u.pathname.replace(/^\/study\//,'')||'index.html',file=path.join(DIST,rel==='/study'?'index.html':rel);
 if(!u.pathname.startsWith('/study/')||!file.startsWith(DIST)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){r.writeHead(404).end();return;}
 r.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream'}).end(fs.readFileSync(file));});
 s.listen(0,'127.0.0.1',()=>res(s));});}
const RESALE_GOOD='중고 거래 앱 이용자가 늘었다. 2020년에는 300만 명이었다. 2024년에는 1,200만 명으로 늘었다. 이유는 두 가지이다.';
const ALL_OFF='중고 거래 앱 이용자가 늘었습니다. 2020년에는 300만 명이었습니다. 2024년에는 1,200만 명으로 늘었어요. 이유는 두 가지입니다.';
const GOOD=['언어 교환 프로그램 참가자가 크게 늘었다. 2021년에는 80명이었다. 2025년에는 520명으로 증가했다. 외국인 학생이 많아졌기 때문이다.','유학생의 한 달 생활비가 늘었다. 2021년에는 90만 원이었다. 2025년에는 117만 원으로 올랐다. 집세가 가장 큰 부분을 차지한다.','병원에 갈 때 어려운 점을 조사했다. 증상을 설명하기 어렵다는 응답이 45%로 가장 많았다. 그다음은 병원을 모른다는 응답이었다. 진료비가 부담된다는 응답도 있었다.'];

const goodFor=id=>{const it=JSON.parse(fs.readFileSync(path.join(HERE,'../../synk-world-app/world-writing-items.json'),'utf8')).items.find(i=>i.id===id);const w=it.label.match(/[가-힣]{2,}/g);return `${w[0]} 자료를 보면 ${w[1]||w[0]} 수가 크게 늘었다. ${w.at(-1)}도 증가했다. 그 이유는 두 가지이다.`;};
// 화면 측정: 가로 넘침 · 13px 밑 글자 · 44px 밑 단추 · 한국어가 lang=ko 밖에 있는지(화면 언어가 ko가 아닐 때)
async function measure(page,lang){return page.evaluate(lang=>{const out={overflow:document.documentElement.scrollWidth>innerWidth+1,small:[],tiny:[],stray:[]};
 for(const el of document.querySelectorAll('.st *')){const cs=getComputedStyle(el),r=el.getBoundingClientRect();if(!r.width||cs.visibility==='hidden')continue;
  const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(own&&/[가-힣]/.test(el.textContent)&&parseFloat(cs.fontSize)<13)out.small.push(el.className);
  if((el.matches('button,select,input,textarea'))&&(r.height<44))out.tiny.push(el.outerHTML.slice(0,60));
  if(lang!=='ko'&&own&&[...el.childNodes].some(n=>n.nodeType===3&&/[가-힣]/.test(n.textContent))&&!el.closest('[lang=ko]'))out.stray.push(el.textContent.trim().slice(0,40));}
 return out;},lang);}

test('한국어 공부: 처음 → 쓰기 → 확인 → 연습 → 다른 자료 → 쉼, 새로 고침·언어·네트워크·측정', {timeout:240000}, async()=>{
 assert.ok(fs.existsSync(path.join(DIST,'index.html')),'먼저 build.mjs');
 fs.mkdirSync(OUT,{recursive:true});
 const server=await serve(),base=`http://127.0.0.1:${server.address().port}/study/`;
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
 const report={measures:[],requests:[],errors:[],scenes:[]};
 try{
  for(const [w,h,lang] of [[390,844,'ko'],[1440,900,'ko'],[390,844,'en'],[390,844,'mn']]){
   const ctx=await browser.newContext({viewport:{width:w,height:h}}),page=await ctx.newPage();
   page.on('request',r=>report.requests.push({m:r.method(),u:r.url().replace(base,'/study/')}));
   page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   const shot=async name=>{await page.screenshot({path:path.join(OUT,`${w}-${lang}-${name}.png`),fullPage:true});const m=await measure(page,lang);report.measures.push({w,lang,name,...m});return m;};
   const scene=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem(`synk.study.v2:${localStorage.getItem('synk.study.slot')||'guest'}`)||'{}').scene?.id);
   await page.goto(`${base}?lang=${lang}`);
   await page.waitForSelector('[data-st-text]');await shot('1-write');
   // 판정 안 함: 두 문장
   await page.fill('[data-st-text]','이용자가 늘었다. 이유는 두 가지이다.');await page.click('[data-st-done]');
   assert.ok(await page.isVisible('.st-alert'));
   await page.fill('[data-st-text]',ALL_OFF);await page.click('[data-st-done]');
   await page.waitForSelector('[data-st-next]');await shot('2-seen');
   assert.equal(await page.locator('.st-marks li').count(),4);
   await page.click('[data-st-next]');
   // 전부 「-습니다/-아요」 → 구별 확인 카드 3장(정답·해설 없이도 카드 결과는 바구니 표시)
   await page.waitForSelector('[data-st-bin]');await shot('3-probe');
   for(let i=0;i<3;i++){await page.click('[data-st-bin="formal"]');await page.click('[data-st-advance]');}
   // 카드가 흔들리면(formal만 고름 → 대부분 틀림) 구별부터
   await page.waitForSelector('.st-examples');assert.equal(await scene(),'method');await shot('4-contrast');
   // 새 탭(탭 세션 없음)으로 열면 앞 사람 기록 안내가 먼저, 이어서 하면 같은 장면
   await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.waitForSelector('[data-st-resume]');await shot('5-resume');await page.click('[data-st-resume]');
   await page.waitForSelector('[data-st-bin]');
   for(let i=0;i<6;i++){await page.click('[data-st-bin="plain"]');await page.click('[data-st-advance]');}
   // 방법 뒤에는 같은 글을 고쳐 쓴다(L2 — 바꾸는 꼴 표, 내 글이 채워져 있고 고칠 문장이 표시됨)
   await page.waitForSelector('[data-st-text]');assert.ok(await page.isVisible('.st-help .st-forms'));
   assert.equal(await page.inputValue('[data-st-text]'),ALL_OFF);assert.ok(await page.locator('.st-marks li').count()>=3);await shot('6-revise-L2');
   await page.fill('[data-st-text]',RESALE_GOOD);await page.click('[data-st-done]');await page.waitForSelector('[data-st-next]');await shot('7-revised');
   await page.click('[data-st-next]');
   // 고쳐 쓰기가 맞으면 그 자리에서 처음 보는 자료로 혼자 확인(L0 — 도움 없음)
   await page.waitForSelector('[data-st-text]');assert.equal(await page.isVisible('.st-help .st-forms'),false);
   const fresh=await page.evaluate(()=>JSON.parse(localStorage.getItem(`synk.study.v2:${localStorage.getItem('synk.study.slot')||'guest'}`)).scene.itemId);
   assert.notEqual(fresh,'w53-resale');
   await page.fill('[data-st-text]',goodFor(fresh));await page.click('[data-st-done]');
   await page.waitForSelector('[data-st-next]');await shot('8-alone');await page.click('[data-st-next]');
   await page.waitForSelector('.st-fact');assert.equal(await scene(),'rest');await shot('9-rest');
   // 처음부터: 앞 기록은 지우지 않고 새 칸
   await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.waitForSelector('[data-st-fresh]');await page.click('[data-st-fresh]');await page.waitForSelector('[data-st-text]');
   const keys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('synk.study.v2:')).length);assert.equal(keys,2);
   await ctx.close();
  }
  // 문항 파일 실패(오프라인 등)
  fail.items=true;{const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();await page.goto(base);await page.waitForSelector('[role=alert]');await page.screenshot({path:path.join(OUT,'390-ko-load-error.png')});await ctx.close();}fail.items=false;
  // 저장 막힘
  {const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();await page.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('synk.study.v2:'))throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
   await page.goto(base);await page.waitForSelector('[data-st-text]');await page.fill('[data-st-text]',ALL_OFF);await page.click('[data-st-done]');await page.waitForSelector('.st-alert[role=alert]');await page.screenshot({path:path.join(OUT,'390-ko-save-fail.png')});await ctx.close();}
 }finally{await browser.close();server.close();fs.writeFileSync(path.join(OUT,'result.json'),JSON.stringify(report,null,1));}
 const bad=report.measures.filter(m=>m.overflow||m.small.length||m.tiny.length||m.stray.length);
 assert.deepEqual(bad.map(m=>({w:m.w,lang:m.lang,name:m.name,overflow:m.overflow,small:m.small.slice(0,3),tiny:m.tiny.slice(0,3),stray:m.stray.slice(0,3)})),[]);
 assert.deepEqual(report.requests.filter(r=>r.m!=='GET'),[],'보내는 요청 없음');
 assert.deepEqual(report.requests.filter(r=>!r.u.startsWith('/study/')&&!r.u.endsWith('/assets/favicon-synk-20260919-32.png')),[],'같은 출처 /study/ 밖 요청 없음(WORLD 포함, 사이트 공용 파비콘만 예외)');
 assert.deepEqual(report.errors.filter(e=>!/503|Failed to load resource/.test(e)),[]);
});

// 형태·적용 갈래와 저장 장면 복구(루트 R2·R3). 정답은 시험이 원고에서 직접 읽는다(화면은 정답을 미리 보이지 않는다).
import {drillPool} from '../../synk-world-app/world-writing-focus.mjs';
const worldBank=JSON.parse(fs.readFileSync(path.join(HERE,'../../synk-world-app/world-writing-items.json'),'utf8'));
const binOf=Object.fromEntries(drillPool(worldBank.items.filter(i=>i.review.status==='passed')).map(c=>[c.key,c.bin]));
const byId=Object.fromEntries(content.items.map(i=>[i.id,i]));
const PART='중고 거래 앱 이용자가 늘었다. 2020년에는 300만 명이었다. 2024년에는 1,200만 명으로 늘었습니다. 이용자가 늘어난 이유는 두 가지이다.';
const MIXED='중고 거래 앱 이용자가 늘었다. 2020년에는 300만 명이었습니다. 2024년에는 1,200만 명으로 늘었습니다. 이용자가 늘어난 이유는 두 가지이다.';
test('형태 갈래·적용 갈래가 실제 화면을 지나고, 깨진 저장 장면은 다시 정한다', {timeout:240000}, async()=>{
 const server=await serve(),base=`http://127.0.0.1:${server.address().port}/study/`;
 const browser=await playwright.chromium.launch({channel:'msedge',headless:true}),errors=[];
 const sceneOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem(`synk.study.v2:${localStorage.getItem('synk.study.slot')||'guest'}`)||'{}').scene);
 try{
  for(const branch of ['forms','apply']){
   const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base);await page.waitForSelector('[data-st-text]');
   await page.fill('[data-st-text]',MIXED);await page.click('[data-st-done]');await page.click('[data-st-next]');
   // 「-다」가 섞인 글 → 형태 확인 먼저
   let sc=await sceneOf(page);assert.equal(sc.probe,'form');
   // 형태 갈래: 첫 확인 문항이 틀리면 둘째는 건너뛰고 바로 연습(Fable F3). 적용 갈래: 두 문항 모두 맞힘.
   for(const id of branch==='forms'?sc.forms.slice(0,1):sc.forms){await page.fill('[data-st-form]',branch==='forms'?'틀린답':byId[id].answer);await page.click('[data-st-grade]');
    assert.equal(await page.locator('.st-explain').count(),0,'확인 장면은 정답·해설을 보이지 않는다');await page.click('[data-st-advance]');}
   sc=await sceneOf(page);
   if(branch==='forms'){
    assert.equal(sc.method,'forms');await page.waitForSelector('.st-forms');await page.screenshot({path:path.join(OUT,'390-ko-branch-forms.png'),fullPage:true});
    for(const id of sc.forms){await page.fill('[data-st-form]',byId[id].answer);await page.click('[data-st-grade]');await page.waitForSelector('.st-explain');await page.click('[data-st-advance]');}
    await page.waitForSelector('[data-st-text]');assert.equal((await sceneOf(page)).support,2);
    // 둘째 고쳐 쓰기: 한 문장만 고쳐 점검하면 다음 고쳐 쓰기의 표시 문장은 남은 문장뿐(이미 고친 문장은 표시하지 않는다 — Fable s2 FA1)
    await page.fill('[data-st-text]',PART);await page.click('[data-st-done]');await page.waitForSelector('[data-st-next]');await page.click('[data-st-next]');
    await page.waitForSelector('[data-st-text]');assert.equal((await sceneOf(page)).mode,'revise');assert.equal(await page.inputValue('[data-st-text]'),PART);
    assert.deepEqual(await page.locator('.st-marks li').allTextContents(),['2024년에는 1,200만 명으로 늘었습니다.']);
    await page.screenshot({path:path.join(OUT,'390-ko-revise-second.png'),fullPage:true});
   }else{
    // 형태 확인이 맞으면 구별 확인 한 번 더 → 둘 다 되면 적용
    assert.equal(sc.probe,'distinguish');
    for(const key of sc.cards){await page.click(`[data-st-bin="${binOf[key]}"]`);await page.click('[data-st-advance]');}
    sc=await sceneOf(page);assert.equal(sc.method,'apply');
    await page.waitForSelector('[data-st-line]');await page.screenshot({path:path.join(OUT,'390-ko-branch-apply.png'),fullPage:true});
    for(const i of byId[sc.find].off)await page.click(`[data-st-line="${i}"]`);
    await page.click('[data-st-findcheck]');assert.equal(await page.locator('.st-pickline[data-answer] .st-tag').count(),byId[sc.find].off.length);await page.click('[data-st-advance]');
    await page.waitForSelector('[data-st-mine]');await page.fill('[data-st-mine="0"]','이용자가 많는다.');
    assert.equal(await page.getAttribute('[data-st-mine-state="0"]','data-ok'),'false');
    await page.fill('[data-st-mine="0"]','2020년에는 300만 명이었다.');assert.equal(await page.getAttribute('[data-st-mine-state="0"]','data-ok'),'true');
    await page.screenshot({path:path.join(OUT,'390-ko-branch-apply-mine.png'),fullPage:true});
    await page.click('[data-st-advance]');await page.waitForSelector('[data-st-text]');assert.equal((await sceneOf(page)).support,1);
   }
   // 쓰던 글은 새로 고침 뒤에도 남는다
   await page.fill('[data-st-text]','초안 한 줄');await page.reload();await page.waitForSelector('[data-st-text]');
   assert.equal(await page.inputValue('[data-st-text]'),'초안 한 줄');
   await ctx.close();
  }
  // 루트 R4: 새 칸 포인터 저장만 실패하면 앞 학생 기록을 덮지 않고 이어 하기 화면과 저장 실패 안내를 남긴다
  {const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('synk.study.v1:guest',JSON.stringify({v:1,obs:[],drafts:{'w53-resale':{text:'앞 학생의 글',updatedAt:null,checkedAt:null}},seen:{},recentCards:[],scene:null}));}
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='synk.study.slot')throw new DOMException('full','QuotaExceededError');return set.call(this,k,v);};});
   await page.goto(base);await page.waitForSelector('[data-st-fresh]');await page.click('[data-st-fresh]');
   await page.waitForSelector('.st-alert[role=alert]');assert.ok(await page.isVisible('[data-st-resume]'));
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.study.v1:guest')).drafts['w53-resale'].text),'앞 학생의 글');
   await page.click('[data-st-resume]');await page.waitForSelector('[data-st-text]');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.study.v1:guest')).drafts['w53-resale']?.text),'앞 학생의 글','옛 칸은 그대로');
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.study.v2:guest')).drafts['w53-resale']?.text),'앞 학생의 글','새 칸으로 옮김');await ctx.close();}
  {const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'mn-MN'}),page=await ctx.newPage();await page.goto(base);await page.waitForSelector('[data-st-text]');
   assert.equal(await page.getAttribute('[data-study-root]','lang'),'mn');await ctx.close();}
  // 처음 보는 53번 자료를 다 쓰면 검수 통과 54번의 주제·질문으로 같은 끝맺음을 확인한다(예시답 없음)
  for(const [w,h] of [[390,844],[1440,900]]){const ctx=await browser.newContext({viewport:{width:w,height:h}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(ids=>{sessionStorage.setItem('synk.study.resumed','guest');localStorage.setItem('synk.study.v2:guest',JSON.stringify({v:2,obs:[],trail:[],drafts:{},seen:Object.fromEntries(ids.map(i=>[i,'2026-10-01T00:00:00.000Z'])),recentCards:[],scene:null}));},worldBank.items.filter(i=>i.type===53).map(i=>i.id));
   await page.goto(base);await page.waitForSelector('[data-st-text]');assert.equal(await page.textContent('.st-instruction b'),'54.');
   assert.ok(!(await page.textContent('.st-question')).includes(worldBank.items.find(i=>i.type===54).model.slice(0,20)),'예시답 없음');
   await page.screenshot({path:path.join(OUT,`${w}-ko-54.png`),fullPage:true});await ctx.close();}
  // 저장 장면이 내려간 문항·깨진 값이면 빈 화면 대신 다시 정한다
  for(const bad of [{id:'probe',probe:'form',forms:['s53-gone'],i:0},{id:'method',method:'forms',forms:[],i:0},{id:'probe',probe:'distinguish',cards:['x:1'],i:9},'깨짐']){
   const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(String(e)));
   await page.addInitScript(b=>{sessionStorage.setItem('synk.study.resumed','guest');localStorage.setItem('synk.study.v2:guest',JSON.stringify({v:2,obs:[],trail:[],drafts:{},seen:{},recentCards:[],scene:b}));},bad);
   await page.goto(base);await page.waitForSelector('.st-scene .st-main');await ctx.close();
  }
 }finally{await browser.close();server.close();}
 assert.deepEqual(errors,[]);
});
