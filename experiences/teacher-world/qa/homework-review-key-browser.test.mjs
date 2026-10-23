import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {REVIEW_TEXT as T} from '../homework-review.mjs';
// 「과제 첨삭」의 정답·예시답 판 안내를 실제 Chrome으로 본다. 서버 없이 homework-review.mjs만 교사 화면(index.html)과 같은 스타일로 띄우고
// request·loadContent·loadKey를 바꿔 끼운다: 판이 같음 → 예시답이 보인다, 판이 다름·못 읽음 → 이번 주 숫자판 아래와 읽기 줄에 이유가 보인다
// (학생을 고르지 않았을 때도, 정답을 받는 사이 새로고침했을 때도). 학생·글은 모두 합성이다. 캡처는 SYNK_HOMEWORK_KEY_QA_OUT을 줄 때만 남긴다(git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url)),require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{try{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{playwright=null;}}
const content=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework.json'),'utf8'));
const key=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework-key.json'),'utf8'));
const out=process.env.SYNK_HOMEWORK_KEY_QA_OUT?path.resolve(process.env.SYNK_HOMEWORK_KEY_QA_OUT):null;
const KST=text=>Date.parse(text+'+09:00'),START='2027-03-06',NOW=KST('2027-03-26T10:00:00');
const SCORED=/문항 중 \d+문항 맞힘/;
const ESSAY='한빛대학교 언어교육원에서 2022년과 2026년에 외국인 유학생 400명을 대상으로 아르바이트에 대해 조사했다. 아르바이트를 하는 유학생은 2022년 48%에서 2026년 63%로 늘었다.\n\n이유는 생활비 마련이 52%로 가장 많았고 한국어 연습이 27%였다.';
const DATA={mode:'account-linked',classId:'class-qa',name:'4급 반 (합성)',plan:{course:'topik4-online',startsOn:START,weeks:8,revision:1},
 learners:[{learnerId:'l-1',name:'나래 (합성)',accountConnected:true}],
 submissions:[
  {submissionId:'s-1',learnerId:'l-1',week:3,kind:'writing',answers:{'W3-1.1':ESSAY},retry:{},revision:1,submittedAt:'2027-03-24T12:00:00Z',late:false,contentVersion:content.version,feedback:null},
  {submissionId:'r-1',learnerId:'l-1',week:3,kind:'reading',answers:{'R3-1':2,'R3-2':4,'R3-3':2,'R3-4':3,'R3-5':1},retry:{},revision:1,submittedAt:'2027-03-23T12:00:00Z',late:false,contentVersion:content.version,feedback:null},
 ]};
// 쓰기를 모두 돌려준 반: 첨삭할 글이 없어 고르는 학생이 없다(토요일 수업 전에 읽기 결과만 보러 온 교사).
const RETURNED={...DATA,submissions:DATA.submissions.map(row=>row.kind==='writing'?{...row,feedback:{parts:{'W3-1':{comment:{good:'좋아요.',fix:'',retry:''}}},returnedAt:'2027-03-25T09:00:00Z',revision:1,submissionRevision:1,updatedAt:'2027-03-25T09:00:00Z'}}:row)};
const PAGE=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>과제 첨삭 판 안내 QA</title>
<link rel="stylesheet" href="/teacher-world/style.css"><link rel="stylesheet" href="/teacher-world/personalization.css"><link rel="stylesheet" href="/teacher-world/signal.css"><link rel="stylesheet" href="/teacher-world/homework-review.css"></head>
<body><section id="view-homework"><div id="root" class="hr" data-state="idle"></div></section><script type="module">import {mountHomeworkReview} from '/teacher-world/homework-review.mjs';window.mountHomeworkReview=mountHomeworkReview;</script></body></html>`;

function serve(){
 const dir=path.join(root,'experiences/teacher-world'),types={'.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/qa/key.html'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(PAGE);}
  if(url.pathname.startsWith('/teacher-world/')){
   const file=path.join(dir,decodeURIComponent(url.pathname.slice('/teacher-world/'.length)));
   if(file.startsWith(dir+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});return res.end(fs.readFileSync(file));}
  }
  res.writeHead(404);res.end();
 });
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}

test('과제 첨삭: 정답·예시답 판이 다르거나 못 읽으면 말없이 빼지 않고 알린다, 판이 맞으면 예시답이 보인다',{skip:!playwright&&'playwright가 없다'},async t=>{
 const server=await serve(),base=`http://127.0.0.1:${server.address().port}`;t.after(()=>server.close());
 const browser=await playwright.chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',error=>errors.push(String(error)));
 await page.goto(base+'/qa/key.html');await page.waitForFunction(()=>window.mountHomeworkReview);
 const mount=(mode,data=DATA)=>page.evaluate(({data,content,key,mode,now})=>{
  window.qaApi?.stop();window.qaKeyMode=mode;window.qaKeyCalls=0;window.qaDataCalls=0;window.qaRelease=null;
  const answer=()=>window.qaKeyMode==='old'?{...key,version:'2026-01-01.old'}:key;
  window.qaApi=window.mountHomeworkReview({root:document.getElementById('root'),now:()=>now,
   request:async route=>{if(route==='/api/teacher/homework'){window.qaDataCalls++;return structuredClone(data);}throw Object.assign(Error('NOT_FOUND'),{status:404});},
   loadContent:async()=>content,
   loadKey:async()=>{
    window.qaKeyCalls++;
    if(window.qaKeyMode==='fail')throw Object.assign(Error('NETWORK_ERROR'),{code:'NETWORK_ERROR'});
    if(window.qaKeyMode==='empty')return undefined;
    // 'hold': 답을 잡아 두었다가 window.qaRelease()로 그때의 모드(old·match)대로 돌려준다.
    if(window.qaKeyMode==='hold')return new Promise(resolve=>{window.qaRelease=()=>resolve(answer());});
    return answer();
   }});
  window.qaApi.show(data.classId);
 },{data,content,key,mode,now:NOW});
 const state=()=>page.evaluate(()=>({notice:document.querySelector('.hr-key-notice')?.textContent??null,reading:document.querySelector('.hr-reading-line')?.textContent??null,
  key:!!document.querySelector('.hr-key'),editor:!!document.querySelector('.hr-editor-who'),calls:window.qaKeyCalls,
  rows:[...document.querySelectorAll('.hr-row-sub')].map(n=>n.textContent),items:!!document.querySelector('.hr-reading-items'),pane:document.querySelector('.hr-editor')?.textContent??null}));
 // editor=false: 고른 학생이 없는 화면 — 첨삭 칸 머리 대신 안내·목록만 기다린다.
 const settled=async(expect,{editor=true}={})=>{
  await page.waitForFunction(({expect,editor})=>(!editor||!!document.querySelector('.hr-editor-who'))&&window.qaKeyCalls>0
   &&(expect===null?!document.querySelector('.hr-key-notice')&&(editor?!!document.querySelector('.hr-key'):!!document.querySelector('.hr-reading-items')):document.querySelector('.hr-key-notice')?.textContent===expect),{expect,editor});
  return state();
 };
 const shot=async name=>{if(!out)return;fs.mkdirSync(out,{recursive:true});await page.locator('.hr-week-body').screenshot({path:path.join(out,name+'.png')});};
 const holdThenRefresh=async mode=>{
  await mount('hold');
  await page.waitForFunction(()=>window.qaKeyCalls===1&&!!window.qaRelease&&!!document.querySelector('.hr-editor-who'));
  await page.evaluate(()=>window.qaApi.refresh());await page.waitForFunction(()=>window.qaDataCalls>=2);
  await page.evaluate(mode=>{window.qaKeyMode=mode;window.qaRelease();},mode);
 };

 await mount('old');
 let s=await settled(T.keyMismatch);
 assert.equal(s.key,false,'판이 다른 예시답은 보이지 않는다');
 assert.match(s.reading,new RegExp(T.keyMismatchShort),'읽기 줄도 「불러오고 있어요」에 머물지 않고 이유를 말한다');
 await shot('key-mismatch-1280');
 await page.evaluate(()=>window.qaApi.refresh());await page.waitForFunction(()=>window.qaKeyCalls>=2);
 s=await settled(T.keyMismatch);assert.equal(s.key,false,'새로고침해도 판이 다르면 안내가 그대로다');
 await page.evaluate(()=>{window.qaKeyMode='match';window.qaApi.refresh();});
 s=await settled(null);
 assert.equal(s.notice,null,'판이 맞게 바뀌면 안내가 사라지고 예시답이 보인다');
 assert.match(s.reading,SCORED);

 await mount('fail');
 s=await settled(T.keyFailed);
 assert.equal(s.key,false);assert.match(s.reading,new RegExp(T.keyFailedShort));
 await shot('key-failed-1280');
 await mount('empty');
 s=await settled(T.keyFailed);assert.equal(s.key,false,'빈 답도 못 읽은 것으로 알린다');

 await mount('match');
 s=await settled(null);
 assert.equal(s.notice,null);assert.match(s.reading,SCORED);

 // 고른 학생이 없어도(쓰기를 모두 돌려줌) 주 화면에서 까닭을 말한다 — 목록의 맞힌 수·문항별 맞힌 학생이 왜 없는지.
 await mount('old',RETURNED);
 s=await settled(T.keyMismatch,{editor:false});
 assert.equal(s.editor,false,'고른 학생이 없다');assert.ok(s.pane.includes(T.pick));assert.equal(s.items,false);assert.equal(s.rows[0].split(' · ')[0],'읽기 냄');
 await shot('key-mismatch-no-learner-1280');
 await mount('match',RETURNED);
 s=await settled(null,{editor:false});
 assert.equal(s.items,true,'판이 맞으면 문항별 맞힌 학생이 보인다');assert.match(s.rows[0],/^읽기 \d+\/5/);

 // 정답을 받는 사이 새로고침하면 그 답은 버리고 지금 판으로 한 번 더 읽는다 — 「불러오고 있어요」에 머물지 않는다.
 await holdThenRefresh('old');
 s=await settled(T.keyMismatch);
 assert.equal(s.calls,2,'버린 답 뒤에 한 번 더 읽었다');assert.match(s.reading,new RegExp(T.keyMismatchShort));
 await holdThenRefresh('match');
 s=await settled(null);assert.equal(s.calls,2);assert.match(s.reading,SCORED);

 await page.setViewportSize({width:390,height:844});
 await mount('old');
 s=await settled(T.keyMismatch);
 const fits=await page.evaluate(()=>{const n=document.querySelector('.hr-key-notice'),r=n.getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth+0.5&&document.documentElement.scrollWidth<=document.documentElement.clientWidth+0.5;});
 assert.equal(fits,true,'390 폭에서도 안내가 화면 안에 든다');
 await shot('key-mismatch-390');
 assert.deepEqual(errors,[]);
});
