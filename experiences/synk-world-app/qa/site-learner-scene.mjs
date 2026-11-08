// synk.im 「개인화 엔진이 붙으면」 구역의 증거 그림을 찍는 장면(2026-11-08).
// 검수 장면 life-personal-scene.mjs와 같은 흐름에 ① 틀린 표현의 새 장면 복습 ② 짧은 진단 ③ 게임 한 판(환승 러시) ④ 7일 · 30일 재확인을 더해
// 한 손님 학습자의 30일을 실제 WORLD 화면 그대로 찍는다. 리허설 모드(합성 손님, 운영 접근 없음)이고, 날짜는 이 브라우저의 시계만 옮긴다.
// 첫 문제를 맞힌 다른 손님의 짧은 길(그 말이 내일 돌아오고, 다음 날 홈이 복습을 고른다)도 찍는다.
// 쓰는 법:
//   node experiences/synk-world-app/qa/site-learner-scene.mjs <출력 폴더> [--언어 ko|en] [--폭 390] [--게임안함] [--포트 4297]
//   --폭: 화면 폭(기본 390). 영어는 430으로 찍는다 — 390에서는 다시 확인 카드의 칸 꼬리표(「After 30 days」 · 「Check now」)가 두 줄로 꺾이고,
//   470은 꺾이지 않지만 사이트 휴대폰에서 조각 속 앱 13px 글이 9.7px로 준다(11-09).
// 출력: <출력 폴더>/<언어>/<이름>.png(<폭>×844 @2x 한 화면), <이름>.crop.png(부품만), <이름>.txt(보이는 글), 기록.json(무엇을 찍었고 무엇이 안 됐는지).
// 그림을 사이트로 옮기는 일은 docs/디자인/synk.im_개인화면_20261108/그림.py(.band.png · .crop.png를 자른다)와 SYNK-website site-v10/README.md 「쓸수록 달라지는 것 — 창가 30일」 절을 본다.
// 화면이 바뀌면(WORLD 새 홈 등) 이 장면으로 언어마다 다시 찍는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {LESSONS} from '../life-content.mjs';
import {DIAGNOSTIC_ITEMS} from '../world-diagnostic-items.mjs';
import {bankItems} from '../world-topik-items.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);
const 인자=process.argv.slice(2);
const 값=(이름,기본)=>{const i=인자.indexOf(이름);return i>=0?인자[i+1]:기본;};
const 폴더바탕=인자.find(a=>!a.startsWith('--'))||path.join(os.tmpdir(),'site-learner-scene');
const 언어=값('--언어','ko');
const 포트=값('--포트','4297');
const 폭=Number(값('--폭','390'));
const 게임=!인자.includes('--게임안함');
const 맞힌길만=인자.includes('--맞힌길만');
const 폴더=path.join(폴더바탕,언어);fs.mkdirSync(폴더,{recursive:true});
const 주소=`http://127.0.0.1:${포트}/mobile.html`;
const 기록={언어,찍음:[],안됨:[],글:{},시작:new Date().toISOString()};
const 말=(...a)=>console.log('[장면]',...a);
const 안됨=(무엇,e)=>{const 글=String(e).split('\n')[0].slice(0,260);기록.안됨.push({무엇,글});말('안 됨',무엇,글);};

// 첫날은 월요일 저녁(동네가 밤 불빛), 하루 반 뒤는 수요일 아침(낮 하늘) — 시계를 옮기면 하늘이 저절로 바뀐다.
const 날=Date.UTC(2026,10,9,11,30); // 2026-11-09 20:30 KST
const 하루=86400000;

const talk=()=>[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
async function 건강(){try{const r=await fetch(new URL('/health',주소),{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():{ok:false};}catch{return null;}}
async function 서버준비(){
 const 지금=await 건강();
 if(지금?.mode==='rehearsal')return {닫기:async()=>{}};
 if(지금)throw Error(`포트 ${포트}에 리허설이 아닌 서버가 떠 있다`);
 const 형제=talk();if(!형제)throw Error('SYNK-talk을 못 찾았다 — SYNK_TALK_ROOT');
 const 임시=fs.mkdtempSync(path.join(os.tmpdir(),'synk-site-scene-')),쌓임=[];
 const 서버=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',windowsHide:true,
  env:{...process.env,SYNK_TALK_ROOT:형제,SYNK_WORLD_PORT:포트,SYNK_WORLD_MODE:'rehearsal',SYNK_WORLD_DATA_DIR:path.join(임시,'db-v1')}});
 서버.stdout.on('data',c=>쌓임.push(String(c)));서버.stderr.on('data',c=>쌓임.push(String(c)));
 const 닫기=async()=>{if(서버.exitCode===null){const 끝=new Promise(r=>서버.once('exit',r));서버.kill();await Promise.race([끝,new Promise(r=>setTimeout(r,5000))]);}fs.rmSync(임시,{recursive:true,force:true,maxRetries:3});};
 for(let i=0;i<600;i++){if(서버.exitCode!==null){await 닫기();throw Error(쌓임.join('').slice(-400));}if((await 건강())?.mode==='rehearsal')return {닫기};await new Promise(r=>setTimeout(r,100));}
 await 닫기();throw Error('서버가 60초 안에 뜨지 않았다');
}

const P='#world-panel[open] ';
const {chromium}=require('playwright');
const 질문=(lessonId,step)=>{const q=LESSONS.find(x=>x.id===lessonId)?.questions?.[step];if(!q)throw Error(`레슨 ${lessonId} ${step}`);return q;};
const 진단정답=Object.fromEntries([...DIAGNOSTIC_ITEMS,...bankItems(JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/world-topik-items.json'),'utf8')))].flatMap(i=>(i.choices||[]).map(c=>[c.id,c.id===i.correctId])));
const 복습문항=reviewId=>{for(const l of LESSONS)for(const q of l.questions||[])if(q.review?.id===reviewId)return q.review;throw Error(`복습 ${reviewId}`);};

async function 장면(page,길='틀린길'){
 const 다듬기=async()=>{await page.mouse.move(1,1);await page.evaluate(()=>document.fonts?.ready);await page.waitForTimeout(500);};
 async function 찍기(이름,{부품=null,전체=true}={}){
  await 다듬기();
  if(전체)await page.screenshot({path:path.join(폴더,`${이름}.png`),animations:'disabled',caret:'hide'});
  if(부품){
   const c=page.locator(부품).first(),파일=path.join(폴더,`${이름}.crop.png`);
   if(!await c.count())기록.안됨.push({무엇:`${이름} 부품 ${부품}`,글:'없음'});
   else{
    // display:contents 같은 상자 없는 부품은 보이는 자식들을 합친 자리를 찍는다.
    const 상자=await c.evaluate(e=>{const r=e.getBoundingClientRect();if(r.width>0&&r.height>0)return null;const kids=[...e.querySelectorAll('*')].map(k=>k.getBoundingClientRect()).filter(k=>k.width>0&&k.height>0);if(!kids.length)return null;const x=Math.min(...kids.map(k=>k.left)),y=Math.min(...kids.map(k=>k.top));return {x,y,width:Math.max(...kids.map(k=>k.right))-x,height:Math.max(...kids.map(k=>k.bottom))-y};});
    if(상자)await page.screenshot({path:파일,clip:상자,animations:'disabled',caret:'hide'});
    else await c.screenshot({path:파일,animations:'disabled',caret:'hide'}).catch(e=>기록.안됨.push({무엇:`${이름} 부품`,글:String(e).slice(0,200)}));
   }
  }
  const 글=await page.evaluate(sel=>{const n=sel?document.querySelector(sel):null;return (n||document.body).innerText;},부품).catch(()=>'');
  fs.writeFileSync(path.join(폴더,`${이름}.txt`),글);
  기록.찍음.push(이름);기록.글[이름]=글.replace(/\s*\n\s*/g,' / ').slice(0,420);말('찍음',이름);
 }
 // 화면 폭 전부, 세로로 두 자리 사이만 찍는다(실제 화면의 여백까지 — 사이트의 「실제 화면 부품」). 위 · 아래는 {sel,edge,hasText} 또는 화소 값.
 async function 띠찍기(이름,위,아래,{위여백=0,아래여백=0}={}){
  await 다듬기();
  const 자리=async v=>{if(typeof v==='number')return v;const l=v.hasText?page.locator(v.sel,{hasText:v.hasText}).first():page.locator(v.sel).first();if(!await l.count())return null;const b=await l.boundingBox();if(!b)return null;return v.edge==='bottom'?b.y+b.height:b.y;};
  const 위값=await 자리(위),아래값=await 자리(아래);
  if(위값===null||아래값===null){기록.안됨.push({무엇:`${이름} 띠`,글:`자리 못 찾음 ${JSON.stringify([위,아래])}`});return;}
  const y=Math.max(0,위값-위여백),e=Math.min(844,아래값+아래여백);
  await page.screenshot({path:path.join(폴더,`${이름}.band.png`),clip:{x:0,y,width:폭,height:e-y},animations:'disabled',caret:'hide'});
  기록.찍음.push(`${이름}.band`);말('띠',이름,Math.round(y),Math.round(e));
 }
 async function 입구넘기(){
  const 끝남=()=>document.querySelector('.world-shell')?.dataset.entry==='ready';
  for(let i=0;i<6;i++){
   await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('[data-lang-picker]').count()){await page.locator(`[data-lang-choice="${언어}"]`).click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));continue;}
   if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));continue;}
   if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] .tutor-option'));continue;}
   if(await page.evaluate(끝남))return;
  }
  await page.waitForFunction(끝남);
 }
 async function 패널닫기(){if(await page.locator('#world-panel[open]').count()){await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}}
 async function 배우기(){if(!await page.locator(`${P}.life-now`).count()){await 패널닫기();await page.locator('.world-nav [data-view="packs"]').click();}await page.locator(`${P}.life-now`).first().waitFor();}
 const 지금레슨=()=>page.evaluate(()=>{const l=window.__synkWorld.life();return {lessonId:l.lessonId,step:l.step};});
 // 열린 레슨 · 복습을 끝까지. 틀림: 레슨 문제 번호. 찍기틀림: 틀린 순간을 찍는 함수.
 async function 답하기({틀림=new Set(),찍기틀림=null,찍기처음=null,찍기맞음=null}={}){
  let 찍은처음=false,찍은맞음=false;
  await page.waitForFunction(()=>document.querySelector('[data-life-begin]')||document.querySelector('[data-life-scene-next]')||document.querySelector('[data-life-choice]')||document.querySelector('.life-complete'));
  if(await page.locator('[data-life-begin]').count())await page.locator('[data-life-begin]').click();
  for(let i=0;i<16&&!await page.locator('[data-life-choice]').count()&&!await page.locator('.life-complete').count();i++){if(await page.locator('[data-life-scene-next]').count())await page.locator('[data-life-scene-next]').click();await page.waitForTimeout(150);}
  for(let k=0;k<14;k++){
   if(await page.locator('.life-complete').count())break;
   await page.locator('[data-life-choice]').first().waitFor();
   const 복습=await page.locator('.life-session-meta[data-life-phase="review"]').count();
   let 답,오답=null,step=-1;
   if(복습){const id=await page.locator('.life-session-meta').first().getAttribute('data-life-review-id');답=복습문항(id).answerId;}
   else{const now=await 지금레슨();step=now.step;const q=질문(now.lessonId,step);답=q.answerId;오답=q.choices.find(c=>c.id!==q.answerId)?.id;}
   if(찍기처음&&!찍은처음){찍은처음=true;await 찍기처음();}
   await page.locator(`[data-life-choice="${틀림.has(step)&&오답?오답:답}"]`).click();
   await page.locator('.life-feedback').waitFor();
   if(틀림.has(step)&&찍기틀림){await page.locator('.life-feedback').scrollIntoViewIfNeeded();await 찍기틀림();}
   if(!틀림.has(step)&&찍기맞음&&!찍은맞음){찍은맞음=true;await page.locator('.life-feedback').scrollIntoViewIfNeeded();await 찍기맞음();}
   await page.locator('[data-life-question-next]').click();
   await page.waitForFunction(()=>document.querySelector('.life-complete')||document.querySelector('[data-life-choice]:not([disabled])'));
  }
  await page.locator('.life-complete').waitFor();
 }
 async function 지금레슨풀기(옵션){await 배우기();const n=page.locator(`${P}.life-now [data-life-lesson]`).first();await n.waitFor();await n.click();await 답하기(옵션);}
 async function 집으로(){await page.locator('[data-life-home]').click();await page.locator('.home-tutor-action').first().waitFor();await page.waitForTimeout(600);}
 const 시계로=async at=>{await 패널닫기();await page.clock.setSystemTime(new Date(at));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client&&typeof window.__synkWorld.life==='function');await page.locator('.home-tutor-action').first().waitFor();await page.waitForTimeout(900);};
 async function 내위치(){await 배우기();await page.locator(`${P}.life-row[data-view="position"]`).first().click();await page.locator('[data-position-board]').waitFor();await page.waitForTimeout(500);}
 const 칸보이기=async sel=>{await page.locator(sel).first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.waitForTimeout(150);};

 await page.clock.install({time:new Date(날)});
 await page.goto(`${주소}?opening=off`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__synkWorld?.client&&typeof window.__synkWorld.life==='function');
 await 입구넘기();
 await page.locator('.home-tutor-action').first().waitFor();
 await page.waitForTimeout(600);
 if(길==='맞힌길'){
  await 지금레슨풀기({찍기맞음:()=>찍기('60-lesson-right',{부품:'.life-feedback'})});
  await 찍기('61-lesson-result',{부품:'.life-complete'});
  await 집으로();
  await 배우기();
  if(await page.locator(`${P}[data-life-review]`).count()){await page.locator(`${P}[data-life-review]`).first().click();await page.locator(`${P}.life-review-summary`).waitFor();await 찍기('62-review-summary',{부품:`${P}.life-review-list[data-upcoming]`});await 띠찍기('62-review-summary',{sel:`${P}.life-review-list[data-upcoming]`},{sel:`${P}.life-review-list[data-upcoming]`,edge:'bottom'},{위여백:18});await 패널닫기();}
  await 시계로(날+하루+13.5*3600000);
  await 찍기('63-day2-home-review',{부품:'.life-home-board'});
  return;
 }
 await 찍기('01-home-new',{부품:'.life-home-board'});

 // ① 첫 레슨 — 첫 문제만 틀린다
 await 지금레슨풀기({틀림:new Set([0]),찍기처음:()=>찍기('02a-lesson-first'),찍기틀림:()=>찍기('02-lesson-wrong',{부품:'.life-feedback'})});
 await 찍기('03-lesson-result',{부품:'.life-complete'});
 await 집으로();
 // ② 복습 요약 — 틀린 표현은 1분 뒤, 맞힌 표현은 내일
 await 배우기();
 if(await page.locator(`${P}[data-life-review]`).count()){
  await page.locator(`${P}[data-life-review]`).first().click();await page.locator(`${P}.life-review-summary`).waitFor();
  await 찍기('04-review-summary',{부품:`${P}.life-review-list[data-upcoming]`});await 띠찍기('04-review-summary',{sel:`${P}.life-review-list[data-upcoming]`},{sel:`${P}.life-review-list[data-upcoming]`,edge:'bottom'},{위여백:18});
  await 패널닫기();
 }else 안됨('복습 줄','배우기에 복습 줄이 없다');
 // ③ 1분 뒤 — 같은 표현이 새 장면으로
 await page.clock.setSystemTime(new Date(날+80000));await page.waitForTimeout(300);
 await 배우기();
 if(await page.locator(`${P}[data-life-review]`).count())await page.locator(`${P}[data-life-review]`).first().click();
 else if(await page.locator(`${P}.life-now [data-life-review-start]`).count())await page.locator(`${P}.life-now [data-life-review-start]`).first().click();
 await page.waitForTimeout(300);
 if(await page.locator(`${P}[data-life-review-start]`).count())await page.locator(`${P}[data-life-review-start]`).first().click();
 if(await page.locator('.life-session-meta[data-life-phase="review"]').count()){
  await 찍기('05-review-new-scene');await 띠찍기('05-review-new-scene',{sel:'.life-session-meta',edge:'bottom'},{sel:'.life-question-title',edge:'bottom'},{위여백:-2,아래여백:16});
  const id=await page.locator('.life-session-meta').first().getAttribute('data-life-review-id');
  await page.locator(`[data-life-choice="${복습문항(id).answerId}"]`).click();
  await page.locator('.life-feedback').waitFor();await page.locator('.life-feedback').scrollIntoViewIfNeeded();
  await 찍기('06-review-right',{부품:'.life-feedback'});
  await page.locator('[data-life-question-next]').click();
  await page.locator('.life-complete').waitFor();await 찍기('07-review-done');
  await 집으로();
 }else 안됨('새 장면 복습','1분 뒤 복습 문항이 열리지 않았다');
 // ④ 둘째 레슨 — 홈 튜터 카드가 다음 할 일과 이유를 고른다
 await 지금레슨풀기();await 집으로();
 await 찍기('08-home-after',{부품:'.life-home-board'});
 // ⑤ 내 위치 — 근거 줄 · 다시 확인 카드
 await 내위치();await 찍기('09-position-top');
 const 펼칠=await page.evaluate(()=>[...document.querySelectorAll('.wpos-skill')].find(x=>x.querySelector('.wpos-evidence'))?.dataset.skill||null);
 if(펼칠){await page.locator(`.wpos-skill[data-skill="${펼칠}"] > summary`).click();await 칸보이기(`.wpos-skill[data-skill="${펼칠}"]`);await 찍기('10-position-evidence',{부품:`.wpos-skill[data-skill="${펼칠}"]`});}
 else 안됨('근거 줄','근거 있는 항목이 없다');
 if(await page.locator('.wpos-followups').count()){await 칸보이기('.wpos-followups');await 찍기('11-followups-d0',{부품:'.wpos-followups'});}
 else 안됨('다시 확인 칸','없다');
 await 패널닫기();
 // ⑥ 맞춤 연습 → 학습 목표(시험 준비 · TOPIK I)
 try{
  await page.locator('.home-tutor-action').first().click();await page.waitForTimeout(900);
  const 폼='#world-study-form';
  if(await page.locator(폼).count()){
   await page.locator(`${폼} label:has(input[name="reason"][value="exam"])`).click();
   const topik=page.locator(`${폼} label:has(input[name="examType"][value="topik1"])`);await topik.waitFor();await topik.click();
   const 동의=page.locator(`${폼} input[name="consent"]`);if(await 동의.count()&&!await 동의.isChecked())await page.locator(`${폼} label:has(input[name="consent"])`).click();
   await page.locator(`${폼} button[type="submit"]`).click();
   await page.waitForFunction(()=>!document.querySelector('#world-study-form'),null,{timeout:15000}).catch(()=>{});
   await page.waitForTimeout(1200);
  }
  if(await page.locator('dialog.tutor-practice[open] .practice-exit').count()){await page.locator('dialog.tutor-practice[open] .practice-exit').click();await page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));}
  await 패널닫기();
 }catch(e){안됨('학습 목표',e);await page.keyboard.press('Escape').catch(()=>{});}
 // ⑦ 짧은 진단 — 문항마다 맞는 답을 고르되 듣기는 끝까지 듣는다
 try{
  await 내위치();
  const 진단=page.locator('[data-position-diagnostic]').first();
  if(await 진단.count()){
   await 진단.click();await page.waitForTimeout(600);
   let 푼수=0;
   for(let i=0;i<20;i++){
    if(!await page.locator('.wpos-choice,[data-position-listen],[data-position-skip]').count())break;
    if(await page.locator('[data-position-listen]').count()&&!await page.locator('.wpos-choice:not([disabled])').count()){
     await page.locator('[data-position-listen]').first().click();
     await page.waitForSelector('.wpos-choice:not([disabled])',{timeout:40000}).catch(()=>{});
    }
    // 다섯 문항에 하나는 일부러 틀린다(모두 맞힌 판은 실제 학습자처럼 보이지 않는다).
    const 틀릴=푼수%5===4;
    const 고를=await page.locator('.wpos-choice:not([disabled])').evaluateAll((els,[표,틀림])=>{const ids=els.map(e=>e.dataset.positionChoice);return (틀림?ids.find(id=>표[id]===false):ids.find(id=>표[id]))||ids[0]||null;},[진단정답,틀릴]);
    if(고를){await page.locator(`[data-position-choice="${고를}"]`).click();푼수++;}
    else if(await page.locator('[data-position-skip]').count())await page.locator('[data-position-skip]').first().click();
    else break;
    await page.waitForTimeout(250);
   }
   기록.진단문항=푼수;말('진단',푼수);
   await 찍기('12-diagnostic-done');
   if(await page.locator('[data-position-back]').count())await page.locator('[data-position-back]').first().click();
   await 패널닫기();
  }else 안됨('짧은 진단','단추가 없다');
 }catch(e){안됨('짧은 진단',e);await 패널닫기().catch(()=>{});}
 // ⑧ 게임 한 판 — 환승 러시를 틀 안에서 끝까지(자동 진행 없이 실제 칸을 누른다)
 if(게임){
  try{
   await 패널닫기();
   await page.locator('.world-nav [data-view="play"]').click();
   await page.locator('button[data-game="subway"]').waitFor();
   기록.환승잠김=await page.locator('button[data-game="subway"]').getAttribute('aria-disabled');
   await page.locator('button[data-game="subway"]').click();
   await page.waitForSelector('.game-frame');
   const f=page.frameLocator('.game-frame');
   await f.locator('#reader').waitFor();await f.locator('html[data-ready]').waitFor({timeout:60000});await page.waitForTimeout(1500);
   await f.locator('#reader').click();
   const 시작=Date.now();let 고름=0;
   while(Date.now()-시작<480000){
    await page.waitForTimeout(600);
    const st=await f.locator('html').evaluate(()=>({done:document.documentElement.dataset.done||'',err:document.body.dataset.error||'',zones:!document.getElementById('zones').hidden,replies:!document.getElementById('replies').hidden}));
    if(st.err){안됨('환승 러시',st.err);break;}
    if(st.done)break;
    if(st.replies){await f.locator('#replies button').first().click();await page.waitForTimeout(400);continue;}
    if(st.zones){await page.waitForTimeout(500);if(고름===0){await 찍기('13-game-pick');await 띠찍기('13-game-pick',440,820);}await f.locator('#zones button').nth(고름%3).click();고름++;await page.waitForTimeout(600);}
   }
   기록.환승={고름,초:Math.round((Date.now()-시작)/1000)};말('환승 러시',기록.환승);
   await page.waitForTimeout(2500);await 찍기('14-game-result');
   await f.locator('#btn-home').click();await page.waitForTimeout(1500);
  }catch(e){안됨('환승 러시',e);if(await page.locator('.game-frame').count()&&await page.locator('#panel-close').count())await page.locator('#panel-close').click().catch(()=>{});}
 }
 // ⑨ 내 위치 — 게임 · 생활 · 진단이 한 판에(근거가 있는 항목을 출처별로 펼친다)
 try{
  await 패널닫기();await 내위치();await 찍기('15-position-top-all');
  const 줄=await page.evaluate(()=>[...document.querySelectorAll('.wpos-skill')].map(s=>({skill:s.dataset.skill,status:s.dataset.status,rows:s.querySelectorAll('.wpos-evidence').length,글:s.innerText.replace(/\s*\n\s*/g,' / ').slice(0,320)})));
  기록.내위치=줄.filter(x=>x.rows);
  // 근거 줄 — 게임이 든 듣기 항목과 생활이 든 읽기 항목을 펼친다(출처 글을 기록에 남긴다)
  for(const id of ['ko.listening.detail','ko.reading.vocabulary']){
   const 항목=page.locator(`.wpos-skill[data-skill="${id}"]`);
   if(!await 항목.count()){안됨('근거 항목',id);continue;}
   await 항목.locator('> summary').click();await page.waitForTimeout(150);
   await 칸보이기(`.wpos-skill[data-skill="${id}"]`);
   await 찍기(`17-evidence-${id}`,{부품:`.wpos-skill[data-skill="${id}"]`});
   await 항목.locator('> summary').click();await page.waitForTimeout(100);
  }
  await 패널닫기();
 }catch(e){안됨('근거 모아 보기',e);await 패널닫기().catch(()=>{});}
 // ⑩ 돌아오는 날들 — 하루 반 뒤 · 7일 반 뒤 · 30일 반 뒤. 그날 복습을 하고, 지금 확인할 생활 카드를 하나 확인한다.
 async function 복습하기(){
  try{
   await 배우기();
   const 바로=page.locator(`${P}.life-now [data-life-review-start]`);
   if(await 바로.count())await 바로.first().click();
   else{
    const 줄=page.locator(`${P}[data-life-review]`);
    if(!await 줄.count())return false;
    await 줄.first().click();await page.waitForTimeout(300);
    const 시작=page.locator(`${P}[data-life-review-start]`);
    if(!await 시작.count()){await 패널닫기();return false;}
    await 시작.first().click();
   }
   await 답하기();await 집으로();return true;
  }catch(e){안됨('복습',e);return false;}
 }
 async function 그날(이름,at,창){
  await 시계로(at);
  await 찍기(`${이름}-home`,{부품:'.life-home-board'});
  await 내위치();
  // 같은 항목의 카드 한 장이 1 · 7 · 30일로 채워지는 것을 찍는다(낱말 뜻 읽기 — 첫 레슨의 항목).
  const 생활카드=async 꼬리=>{const c=page.locator('.wfol-card',{hasText:언어==='ko'?'낱말 뜻 읽기':'Reading word meanings'}).first();if(await c.count())await c.screenshot({path:path.join(폴더,`${이름}-card-${꼬리}.crop.png`),animations:'disabled',caret:'hide'});else 기록.안됨.push({무엇:`${이름} 카드 ${꼬리}`,글:'낱말 뜻 읽기 카드가 없다'});};
  if(await page.locator('.wpos-followups').count()){await 칸보이기('.wpos-followups');await 찍기(`${이름}-followups-open`,{부품:'.wpos-followups'});await 생활카드('open');await 띠찍기(`${이름}-followups-open`,{sel:'.wpos-followups'},{sel:'.wfol-card',edge:'bottom',hasText:언어==='ko'?'낱말 뜻 읽기':'Reading word meanings'},{위여백:-2,아래여백:2});}
  const 단추=page.locator(`${P}[data-followup-life]`).first();
  if(await 단추.count()){
   await 단추.click();await 답하기();await 집으로();
   await 내위치();if(await page.locator('.wpos-followups').count()){await 칸보이기('.wpos-followups');await 찍기(`${이름}-followups-checked`,{부품:'.wpos-followups'});await 생활카드('checked');}
  }else 안됨(`${창} 확인`,'생활 다시 확인 단추가 없다');
  await 패널닫기();
  const 복습=await 복습하기();기록[`${이름}복습`]=복습;
  await 배우기();
  if(await page.locator(`${P}[data-life-review]`).count()){await page.locator(`${P}[data-life-review]`).first().click();await page.waitForTimeout(300);if(await page.locator(`${P}.life-review-summary`).count())await 찍기(`${이름}-review-summary`,{부품:await page.locator(`${P}.life-review-list[data-upcoming]`).count()?`${P}.life-review-list[data-upcoming]`:null});await 패널닫기();}
 }
 await 그날('20-day2',날+하루+13.5*3600000,'1일');
 await 그날('30-day8',날+7*하루+13.5*3600000,'7일');
 await 그날('40-day31',날+30*하루+13.5*3600000,'30일');
 // 이번 주 계획(쌓지 않음 · 쉬는 날 안내)
 try{await 배우기();const 계획=page.locator(`${P}.life-row[data-view="plan"]`);if(await 계획.count()){await 계획.first().click();await page.waitForTimeout(800);await page.evaluate(()=>{const c=document.querySelector('#panel-content');if(c)c.scrollTop=0;});await 찍기('50-plan-week');}}catch(e){안됨('이번 주 계획',e);}
}

const 서버=await 서버준비();
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const c=await b.newContext({viewport:{width:폭,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:언어==='ko'?'ko-KR':'en-US',timezoneId:'Asia/Seoul',reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await c.newPage();page.setDefaultTimeout(30000);
 const 오류=[];page.on('pageerror',e=>오류.push(String(e).slice(0,200)));page.on('console',m=>{if(m.type()==='error')오류.push(m.text().slice(0,200));});page.on('response',r=>{if(r.status()>=400)오류.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`);});
 if(!맞힌길만)try{await 장면(page);}catch(e){안됨('장면',e);await page.screenshot({path:path.join(폴더,'멈춘자리.png')}).catch(()=>{});}
 // 맞힌 길은 새 손님(브라우저 맥락을 새로 연다)
 const c2=await b.newContext({viewport:{width:폭,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:언어==='ko'?'ko-KR':'en-US',timezoneId:'Asia/Seoul',reducedMotion:'reduce',serviceWorkers:'block'});
 const p2=await c2.newPage();p2.setDefaultTimeout(30000);
 p2.on('pageerror',e=>오류.push(String(e).slice(0,200)));
 try{await 장면(p2,'맞힌길');}catch(e){안됨('맞힌 길',e);await p2.screenshot({path:path.join(폴더,'멈춘자리2.png')}).catch(()=>{});}
 기록.콘솔오류=[...new Set(오류)].slice(0,20);
}finally{await b.close();await 서버.닫기();}
기록.끝=new Date().toISOString();
fs.writeFileSync(path.join(폴더,'기록.json'),JSON.stringify(기록,null,1));
console.log(JSON.stringify({찍음:기록.찍음.length,안됨:기록.안됨,콘솔오류:기록.콘솔오류},null,1));
