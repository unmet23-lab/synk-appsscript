// 검수 묶음 장면(2026-11-08, tools/검수묶음.mjs 준비 --장면): 개인화 엔진(Atlas)이 학습자에게 보이는 WORLD 화면을 새 학습자 흐름 그대로 찍는다.
// 생활 한국어 → 엔진 고리(2단계 D, docs/_ops/qa/atlas-world-engine-20261108/D_생활한국어.md) 뒤의 프론트 다시 검수용이다.
// 도구가 판(전·후)·기기(1440·390)마다 새 브라우저 맥락으로 한 번씩 부르고, 그때마다 처음부터 돈다(맥락이 새것이라 매번 새 손님 학습자).
//   ① 처음 홈(튜터 카드) → ② 배우기(지금 할 일) → ③ 첫 생활 레슨: 첫 문제는 일부러 틀리고 나머지는 맞힌다(틀린 띠 · 결과)
//   → ④ 둘째 레슨(이야기)은 다 맞힌다 → ⑤ 홈(튜터 카드가 고른 다음 할 일과 이유) → ⑥ 배우기(위 · 아래 줄) · 복습 요약
//   → ⑦ 내 위치: 판 위 · 근거 줄을 펼친 항목 · 「시간을 두고 다시 확인」 → ⑧ 홈 「맞춤 연습 시작」을 누른 첫 화면(처음이면 학습 목표 창)
//   → ⑨ 시험 준비 · TOPIK I로 저장하고 시작한 첫 화면 → 배우기의 「이번 주 계획」 → ⑩ 브라우저 시계만 하루 반 뒤로: 홈 · 「시간을 두고 다시 확인」
//   → ⑪ 그 카드의 단추로 1일 확인을 마친 뒤의 카드(확인한 칸) → ⑫ 돌아온 복습이 있는 복습 요약 → 그 복습을 끝까지 푼 결과.
//   찍는 이름: home-new · packs-new · lesson-wrong · lesson-result · home-after · packs-after · packs-rows · review-summary
//   · position-top · position-evidence · position-followups · tutor-practice · goal-exam · goal-start · plan-week · plan-week-more · home-day2 · position-followups-day2
//   · position-followups-checked · review-due · review-result
//   (줄이 없는 판은 그 이름을 건너뛴다)
// 리허설 모드(합성 손님, 운영 접근 없음)로 돈다. 주소의 /health가 리허설 서버면 그대로 쓰고, 없으면 그 포트에 임시 데이터 폴더로 띄웠다가 끝나면 끈다.
// 그림마다 곁에 <이름>.측정.json — 문서 가로 넘침, 보이는 한글 중 13px 밑 글자, 44px 밑 누름 자리(보이는 단추 · 링크).
//
// 쓰는 법(--주소뿌리는 꼭 준다 — 앱 파일이 주소 뿌리에서 나가 저장소 경로로 끝나지 않아, 없으면 「전」이 바탕 판으로 안 바뀐다. 순서 그대로):
//   node tools/검수묶음.mjs 준비 <이름> <경로…> --종류 화면 --바탕 <커밋> --장면 experiences/synk-world-app/qa/life-personal-scene.mjs
//     --화면 world=http://127.0.0.1:4297/mobile.html
//     --주소뿌리 http://127.0.0.1:4297/brand-opening/=experiences/brand-opening/ http://127.0.0.1:4297/=experiences/synk-world-app/
// 진행 기록은 SYNK_QA_VERBOSE=1. 화면 언어는 기본 한국어, SYNK_SCENE_LANG=en|mn이면 그 언어로 고른다 — 몽골어 · 영어는 글이 길어
// 한국어에서 맞던 칸이 넘친다(11-08 다시 확인 카드의 창 이름 「1 хоногийн дараа」가 줄바꿈 금지로 칸 밖으로 나갔다).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LESSONS} from '../life-content.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const 기본주소='http://127.0.0.1:4297/mobile.html';
const 이PC=new Set(['127.0.0.1','localhost','[::1]']);
const talk=()=>[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));

async function 건강(주소){
 try{const r=await fetch(new URL('/health',주소),{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():{ok:false,status:r.status};}catch{return null;}
}
// 리허설 서버: 이미 떠 있으면 그대로, 없으면 임시 데이터 폴더로 띄워서 끝날 때 끈다.
async function 서버준비(주소){
 const 지금=await 건강(주소);
 if(지금?.mode==='rehearsal')return {닫기:async()=>{}};
 if(지금)throw Error(`${new URL(주소).host}에 리허설이 아닌 서버가 떠 있다(${JSON.stringify(지금).slice(0,120)}) — 다른 포트를 --화면·--주소뿌리에 준다`);
 const 형제=talk();if(!형제)throw Error('형제 저장소 SYNK-talk(lib/world-v1-server.js)을 못 찾았다 — SYNK_TALK_ROOT로 가리킨다');
 const u=new URL(주소),폴더=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-life-scene-'));
 const 기록=[];
 const 서버=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',windowsHide:true,
  env:{...process.env,SYNK_TALK_ROOT:형제,SYNK_WORLD_PORT:u.port,SYNK_WORLD_MODE:'rehearsal',SYNK_WORLD_DATA_DIR:path.join(폴더,'db-v1')}});
 서버.stdout.on('data',c=>기록.push(String(c)));서버.stderr.on('data',c=>기록.push(String(c)));
 const 닫기=async()=>{
  if(서버.exitCode===null){const 끝=new Promise(r=>서버.once('exit',r));서버.kill();await Promise.race([끝,new Promise(r=>setTimeout(r,5000))]);}
  fs.rmSync(폴더,{recursive:true,force:true,maxRetries:3});
 };
 for(let i=0;i<600;i++){
  if(서버.exitCode!==null){await 닫기();throw Error(`WORLD 서버가 뜨지 않았다: ${기록.join('').slice(-600)}`);}
  if((await 건강(주소))?.mode==='rehearsal')return {닫기};
  await new Promise(r=>setTimeout(r,100));
 }
 await 닫기();throw Error(`WORLD 서버가 60초 안에 뜨지 않았다: ${기록.join('').slice(-600)}`);
}

// 처음 들어올 때의 관문: 화면 언어 → 한글 읽기 → 튜터 고르기. 나오지 않는 관문은 건너뛴다.
async function 입구넘기(page){
 const 끝남=()=>document.querySelector('.world-shell')?.dataset.entry==='ready';
 for(let i=0;i<6;i++){
  await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
  // 화면 언어: 기본 한국어, SYNK_SCENE_LANG=en|mn이면 그 언어로(몽골어 · 영어 화면의 넘침 확인용).
  if(await page.locator('[data-lang-picker]').count()){await page.locator(`[data-lang-choice="${process.env.SYNK_SCENE_LANG||'ko'}"]`).click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));continue;}
  if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));continue;}
  if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){
   await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();
   await page.locator('.tutor-primary[data-tutor-action="finish"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] .tutor-option'));continue;
  }
  if(await page.evaluate(끝남))return;
 }
 await page.waitForFunction(끝남);
}

// 찍기 전: 누른 자리의 hover가 남지 않게 마우스를 구석으로, 움직임이 멎을 때까지 잠깐.
async function 가다듬기(page){await page.mouse.move(1,1);await page.evaluate(()=>document.fonts?.ready);await page.waitForTimeout(400);}

// 그림 곁 측정: 문서 가로 넘침 · 보이는 한글 13px 밑 · 44px 밑 누름 자리. 열린 모달 창이 있으면 그 안만 보고,
// 가운데 점이 실제로 맨 위에 그려진 것만 센다(창 뒤에 깔린 마을 이름표 · 패널 스크롤 밖 줄을 세지 않게).
async function 재기(page){
 return page.evaluate(()=>{
  const d=document.documentElement,범위=document.querySelector('dialog:modal')||document.body;
  const 보임=e=>{const r=e.getBoundingClientRect();if(r.width<1||r.height<1||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth)return false;
   const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||e.closest('[inert]'))return false;
   const x=Math.min(innerWidth-1,Math.max(0,r.left+r.width/2)),y=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)),top=document.elementFromPoint(x,y);
   return !!top&&(top===e||e.contains(top)||top.contains(e));};
  const 작은글=[],작은단추=[];
  for(const e of 범위.querySelectorAll('*')){
   if(!보임(e))continue;
   const own=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
   if(own&&/[가-힣]/.test(own)){const px=parseFloat(getComputedStyle(e).fontSize);if(px<13)작은글.push(`${px}px ${own.slice(0,24)}`);}
   if(e.matches('button,a[href],[role="button"],summary')){const r=e.getBoundingClientRect();if(r.height<44&&!e.disabled)작은단추.push(`${Math.round(r.width)}×${Math.round(r.height)} ${(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,24)}`);}
  }
  // 홈 겹침(1440): 왼쪽 카드가 장소 안내 띠 · 보이는 제목 줄을 가리는지. 패널이 열려 있으면 재지 않는다(11-08 영어 · 몽골어 카드가 띠와 제목 아랫줄을 가렸다).
  const 겹침=[];
  if(!document.querySelector('dialog:modal')){
   const 판=document.querySelector('.lobby-action')?.getBoundingClientRect();
   const 맞닿음=(e,이름)=>{if(!e||!판)return;const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0||s.clipPath.startsWith('inset(50%'))return;const r=e.getBoundingClientRect();if(r.width&&r.height&&r.bottom>판.top&&r.top<판.bottom&&r.right>판.left&&r.left<판.right)겹침.push(`${이름} ${Math.round(r.bottom-판.top)}px`);};
   맞닿음(document.querySelector('.town-hint:not([hidden])'),'안내 띠');
   const 제목=document.querySelector('.place-heading');
   if(document.documentElement.dataset.layout==='landscape'&&제목&&getComputedStyle(제목).clipPath==='none')for(const e of 제목.children)맞닿음(e,e.tagName);
  }
  return {가로넘침:d.scrollWidth>d.clientWidth+1?`${d.scrollWidth}/${d.clientWidth}`:null,겹침,작은글:[...new Set(작은글)].slice(0,20),작은단추:[...new Set(작은단추)].slice(0,20)};
 });
}

function 질문(lessonId,step){const l=LESSONS.find(x=>x.id===lessonId);const q=l?.questions?.[step];if(!q)throw Error(`레슨 ${lessonId}의 ${step}번 문제를 못 찾았다`);return q;}
const 지금레슨=page=>page.evaluate(()=>{const l=window.__synkWorld.life();return {lessonId:l.lessonId,step:l.step};});

// 패널 안만 고른다 — 홈(1440의 왼쪽 카드)에도 같은 data-* 단추가 있어 패널 밖 것을 누르면 창에 가려 멈춘다.
const P='#world-panel[open] ';
// 배우기 패널: 이미 열려 있으면 그대로(열린 패널이 아래 메뉴를 덮어 누를 수 없다), 아니면 아래 메뉴의 배우기로 연다.
async function 배우기열기(page){
 if(!await page.locator(`${P}.life-now`).count())await page.locator('.world-nav [data-view="packs"]').click();
 await page.locator(`${P}.life-now`).first().waitFor();
}
// 배우기 → 「지금 할 일」 레슨 → (소개 · 이야기 장면) → 문제마다 고르고 다음. 틀릴 차례(틀림: 문제 번호 집합)에는 오답을 고른다.
async function 레슨풀기(page,{틀림=new Set(),찍기=null}={}){
 await 배우기열기(page);
 const next=page.locator(`${P}.life-now [data-life-lesson]`).first();await next.waitFor();await next.click();
 await 레슨답하기(page,{틀림,찍기});
}
// 열린 레슨(배우기의 「지금 할 일」이든 다시 확인 카드의 단추든)을 끝까지 푼다.
async function 레슨답하기(page,{틀림=new Set(),찍기=null}={}){
 await page.waitForFunction(()=>document.querySelector('[data-life-begin]')||document.querySelector('[data-life-scene-next]')||document.querySelector('[data-life-choice]'));
 if(await page.locator('[data-life-begin]').count())await page.locator('[data-life-begin]').click();
 for(let i=0;i<16&&!await page.locator('[data-life-choice]').count();i++){await page.locator('[data-life-scene-next]').click();await page.waitForTimeout(120);}
 for(let k=0;k<12;k++){
  if(await page.locator('.life-complete').count())break;
  await page.locator('[data-life-choice]').first().waitFor();
  const {lessonId,step}=await 지금레슨(page),q=질문(lessonId,step);
  const 오답=q.choices.find(c=>c.id!==q.answerId);
  await page.locator(`[data-life-choice="${틀림.has(step)&&오답?오답.id:q.answerId}"]`).click();
  await page.locator('.life-feedback').waitFor();
  if(틀림.has(step)&&찍기){await page.locator('.life-feedback').scrollIntoViewIfNeeded();await 가다듬기(page);await 찍기('lesson-wrong');}
  await page.locator('[data-life-question-next]').click();
  await page.waitForFunction(()=>document.querySelector('.life-complete')||document.querySelector('[data-life-choice]:not([disabled])'));
 }
 await page.locator('.life-complete').waitFor();
}

async function 패널닫기(page){await page.locator('#panel-close').click();await page.waitForFunction(()=>!document.querySelector('#world-panel')?.open);}
// 판 안의 칸을 패널 스크롤의 위쪽으로 옮긴다(패널 내용 칸만 스크롤된다).
async function 칸보이기(page,선택자){await page.locator(선택자).first().evaluate(e=>e.scrollIntoView({block:'start'}));await page.waitForTimeout(150);}

export default async function 장면({page,찍기,판,기기,주소들={}}){
 const 주소=new URL(Object.values(주소들).find(Boolean)||process.env.SYNK_WORLD_SCENE_URL||기본주소);
 if(!이PC.has(주소.hostname))throw Error(`이 PC 주소만 쓴다: ${주소.href}`);
 if(!주소.port)throw Error(`포트가 있는 주소를 준다: ${주소.href}`);
 const 말=(...a)=>{if(process.env.SYNK_QA_VERBOSE)console.log(`[장면 ${판} ${기기}]`,...a);};
 const 서버=await 서버준비(주소.origin+'/');
 const 측정=async 이름=>{await 가다듬기(page);const r=await 찍기(이름);try{fs.writeFileSync(r.그림.replace(/\.png$/,'.측정.json'),JSON.stringify(await 재기(page),null,1));}catch(e){말('측정 실패',이름,String(e).slice(0,120));}return r;};
 try{
  page.setDefaultTimeout(30000);
  // 시계를 미리 심어 둔다(지금 시각에서 그대로 흐른다) — 끝에서 하루 반 뒤로 건너뛰려면 처음 열 때부터 있어야 한다.
  await page.clock.install();
  const 첫주소=new URL(주소.href);첫주소.searchParams.set('opening','off');
  await page.goto(첫주소.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkWorld?.client&&typeof window.__synkWorld.life==='function');
  await 입구넘기(page);말('입구 끝');
  await page.locator('.home-tutor-action').first().waitFor();
  await 측정('home-new');
  await 배우기열기(page);await page.locator(`${P}.life-now [data-life-lesson]`).first().waitFor();
  await 측정('packs-new');
  // ③ 첫 레슨: 첫 문제만 틀린다(틀린 띠를 찍는다) → 결과
  await 레슨풀기(page,{틀림:new Set([0]),찍기:측정});말('첫 레슨 끝');
  await 측정('lesson-result');
  await page.locator('[data-life-home]').click();
  // ④ 둘째 레슨: 다 맞힌다
  await 레슨풀기(page);말('둘째 레슨 끝');
  await page.locator('[data-life-home]').click();
  await page.locator('.home-tutor-action').first().waitFor();await page.waitForTimeout(600);
  await 측정('home-after');
  await 배우기열기(page);
  await 측정('packs-after');
  // ⑥ 배우기 아래 줄(이야기 · 복습 · 내 위치 · 이번 주 계획) → 복습 요약 → 이번 주 계획
  await page.locator(`${P}.life-row[data-view="position"]`).first().evaluate(e=>e.scrollIntoView({block:'center'}));
  await 측정('packs-rows');
  if(await page.locator(`${P}[data-life-review]`).count()){
   await page.locator(`${P}[data-life-review]`).first().click();await page.locator(`${P}.life-review-summary`).waitFor();
   await 측정('review-summary');await 패널닫기(page);await 배우기열기(page);
  }else 말('복습 줄이 없다');
  // ⑦ 내 위치: 판 위 → 근거 줄이 있는 첫 항목을 펼쳐서 → 「시간을 두고 다시 확인」
  await page.locator(`${P}.life-row[data-view="position"]`).first().click();
  await page.locator('[data-position-board]').waitFor();await page.waitForTimeout(500);
  await 측정('position-top');
  const 펼칠=await page.evaluate(()=>{const s=[...document.querySelectorAll('.wpos-skill')].find(x=>x.querySelector('.wpos-evidence'));return s?.dataset.skill||null;});
  if(펼칠){await page.locator(`.wpos-skill[data-skill="${펼칠}"] > summary`).click();await 칸보이기(page,`.wpos-skill[data-skill="${펼칠}"]`);await 측정('position-evidence');}
  else 말('근거 줄이 있는 항목이 없다');
  if(await page.locator('.wpos-followups').count()){await 칸보이기(page,'.wpos-followups');await 측정('position-followups');}
  else 말('다시 확인 칸이 없다');
  // ⑧ 홈 「맞춤 연습 시작」
  await 패널닫기(page);
  await page.locator('.home-tutor-action').first().click();await page.waitForTimeout(900);
  await 측정('tutor-practice');
  // ⑨ 처음 누르면 학습 목표 창이 먼저 뜬다 → 시험 준비 · TOPIK I · 이 기기에 기억하기 → 「저장하고 시작하기」가 연 첫 화면 → 배우기의 「이번 주 계획」
  const 폼='#world-study-form';
  if(await page.locator(폼).count()){
   await page.locator(`${폼} label:has(input[name="reason"][value="exam"])`).click();
   const topik=page.locator(`${폼} label:has(input[name="examType"][value="topik1"])`);await topik.waitFor();await topik.click();
   const 동의=page.locator(`${폼} input[name="consent"]`);
   if(await 동의.count()&&!await 동의.isChecked())await page.locator(`${폼} label:has(input[name="consent"])`).click();
   await page.locator(`${폼} label:has(input[name="examType"][value="topik1"])`).evaluate(e=>e.scrollIntoView({block:'center'}));
   await 측정('goal-exam');
   await page.locator(`${폼} button[type="submit"]`).click();
   await page.waitForFunction(()=>!document.querySelector('#world-study-form'),null,{timeout:15000}).catch(()=>말('저장 뒤에도 학습 목표 창이 남았다'));
   await page.waitForTimeout(1200);
   await 측정('goal-start');
   // 처음 여는 게임이면 튜터의 조작 연습 창이 위에 뜬다(10-10) — 그 창을 먼저 닫고 게임 패널을 닫는다(account-browser closeGamePanel과 같은 순서).
   if(await page.locator('dialog.tutor-practice[open] .practice-exit').count()){
    await page.locator('dialog.tutor-practice[open] .practice-exit').click();await page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));
   }
   if(await page.locator('#world-panel[open]').count())await 패널닫기(page);
   await 배우기열기(page);
   const 계획=page.locator(`${P}.life-row[data-view="plan"]`);
   // 패널 내용 칸은 앞 화면의 스크롤 자리를 이어받을 수 있어 맨 위로 올린 뒤 찍고, 아래 칸(시험 형식 연습 · 지금까지)도 한 장 더.
   if(await 계획.count()){
    await 계획.first().click();await page.waitForTimeout(800);
    await page.evaluate(()=>{const c=document.querySelector('#panel-content');if(c)c.scrollTop=0;});await 측정('plan-week');
    await page.evaluate(()=>{const c=document.querySelector('#panel-content');if(c)c.scrollTop=c.scrollHeight;});await 측정('plan-week-more');
   }
   else 말('이번 주 계획 줄이 없다');
  }else 말('학습 목표 창이 뜨지 않았다');
  // ⑩ 하루 반 뒤(이 브라우저의 시계만 앞으로 — 서버 · 기록은 그대로): 돌아온 복습을 고르는 홈과, 1일 창이 열린 「시간을 두고 다시 확인」.
  if(await page.locator('#world-panel[open]').count())await 패널닫기(page);
  await page.clock.setSystemTime(new Date(Date.now()+36*3600000));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkWorld?.client&&typeof window.__synkWorld.life==='function');
  await page.locator('.home-tutor-action').first().waitFor();await page.waitForTimeout(900);
  await 측정('home-day2');
  await 배우기열기(page);
  await page.locator(`${P}.life-row[data-view="position"]`).first().click();
  await page.locator('[data-position-board]').waitFor();await page.waitForTimeout(500);
  if(await page.locator('.wpos-followups').count()){await 칸보이기(page,'.wpos-followups');await 측정('position-followups-day2');}
  else 말('하루 반 뒤에 다시 확인 칸이 없다');
  // ⑪ 그 카드의 단추로 1일 확인을 마친다(열린 레슨을 다 맞힘) → 확인한 칸(초록 불 · 결과의 짧은 꼴 · 긴 문장은 title, 끝 판 F1)
  const 확인단추=page.locator(`${P}[data-followup-life]`).first();
  if(await 확인단추.count()){
   await 확인단추.click();await 레슨답하기(page);말('1일 확인 레슨 끝');
   await page.locator('[data-life-home]').click();
   await 배우기열기(page);
   await page.locator(`${P}.life-row[data-view="position"]`).first().click();
   await page.locator('[data-position-board]').waitFor();await page.waitForTimeout(500);
   if(await page.locator('.wpos-followups').count()){await 칸보이기(page,'.wpos-followups');await 측정('position-followups-checked');}
  }else 말('하루 반 뒤에 생활 다시 확인 단추가 없다');
  // ⑫ 돌아온 복습이 있는 복습 요약(튜터 대사가 그 화면 이야기) → 복습을 끝까지 풀어 결과(마친 말). 맞고 틀림은 이 칸에서 보지 않으니 첫 보기를 고른다.
  if(await page.locator('#world-panel[open]').count())await 패널닫기(page);
  await 배우기열기(page);
  if(await page.locator(`${P}[data-life-review]`).count()){
   await page.locator(`${P}[data-life-review]`).first().click();await page.locator(`${P}.life-review-summary`).waitFor();
   await 측정('review-due');
   if(await page.locator(`${P}[data-life-review-start]`).count()){
    await page.locator(`${P}[data-life-review-start]`).click();
    for(let k=0;k<30&&!await page.locator('.life-complete').count();k++){
     await page.waitForFunction(()=>document.querySelector('.life-complete')||document.querySelector('[data-life-choice]:not([disabled])')||document.querySelector('[data-life-question-next]:not([disabled])'));
     if(await page.locator('[data-life-question-next]:not([disabled])').count()){await page.locator('[data-life-question-next]:not([disabled])').click();await page.waitForTimeout(120);continue;}
     if(await page.locator('[data-life-choice]:not([disabled])').count()){await page.locator('[data-life-choice]:not([disabled])').first().click();await page.waitForTimeout(120);}
    }
    await page.locator('.life-complete').waitFor();await 측정('review-result');
   }else 말('돌아온 복습이 없다');
  }else 말('복습 줄이 없다');
 }finally{await 서버.닫기();}
}
