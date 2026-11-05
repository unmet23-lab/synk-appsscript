// 서울행 실제 앱 흐름 시험: 새 손님이 타이틀부터 1화 끝 쪽지 · 우리 동네까지 지나간다(운영 계정 · talk를 건드리지 않는다).
//   node experiences/seoul-arrival/qa/흐름.mjs [--폭 390x844] [--언어 ko|en|mn] [--꿈 idol|actor] [--찍기] [--끝 road] [--완주]
// --꺼짐: 스위치를 끈 판(seoul-entry.mjs의 SEOUL_AUTO만 false로 바꿔 내줌)에서 새 손님 길이 서울행 전과 같은지만 본다(틀을 받지 않는다). 켠 뒤에도 끄면 돌아가는 길을 지킨다.
// --후보 <폴더>: synk.im/world의 후보 파일만 그 폴더에서 내주고 나머지는 지금 공개본을 받는다(공개본은 안 바꾼다). 로그인 없이 갈 수 있는 데까지 — 1화는 로컬 시험 몫.
// --언어판: 언어를 고른 적 없는 한국어 밖 기기 — 타이틀을 누르면 지금의 언어 판이 먼저 뜨고, 고르면 이야기가 이어진다.
// --완주: 프롤로그를 건너뛰지 않는다. 「가」는 실제 획으로 쓰고, 입국심사는 일부러 한 번 틀리고, 첫 아침의 누를 자리는 개찰구만 누른다.
// · 로컬 WORLD 서버(리허설)를 직접 띄운다. /drama/는 공개 빌드처럼 data-drama="world"를 단 실제 시범판 파일을 내주고, 드라마 통로는 talk와 같은 판정기로 흉내 낸다(틀시험.mjs와 같다).
// · 드라마 재생 사본은 git 밖이라 공용 작업본의 것을 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {judgeLine,nextTake} from '../../../tools/lib/드라마판정.mjs';
import {syllableStrokes} from '../hangul-strokes.mjs';
import {encodeSign} from '../name-hand.mjs';
import {dramaLines,readEpisodes} from '../../../tools/build-world-speaking-talk.mjs';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const MAIN=path.join(os.homedir(),'Documents','SYNK-appsscript');
const require=createRequire(path.join(fs.existsSync(path.join(ROOT,'node_modules'))?ROOT:MAIN,'x.js'));
const {chromium}=require('playwright');
const args=process.argv.slice(2),opt=(n,d=null)=>{const i=args.indexOf(n);return i<0?d:args[i+1];},has=n=>args.includes(n);
const [W,H]=(opt('--폭','390x844')).split('x').map(Number),LANG=opt('--언어','ko'),DREAM=opt('--꿈','idol'),SHOTS=has('--찍기'),END=opt('--끝','home'),FROM=opt('--자리','title');
const OUT=path.join(ROOT,'.tmp','seoul-qa',`${W}-${LANG}-${DREAM}`);fs.mkdirSync(OUT,{recursive:true});
const PORT=Number(opt('--포트',String(4400+Math.floor(Math.random()*400)))),CAND=opt('--후보'),OFF=has('--꺼짐'),PICKER=has('--언어판');
const PILOT=path.join(ROOT,'experiences/drama/pilot');
const lesson=JSON.parse(fs.readFileSync(path.join(PILOT,'world-lesson.json'),'utf8'));
const lines=dramaLines(await readEpisodes()),byId=new Map(lines.map(l=>[l.id,l]));
const TRANSCRIPTS={'s1e01-6':['네, 맞아요. 길을 잃어서 한참 헤맸어','네, 맞아요. 길을 잃어서 한참 헤맸어요'],'s1e01-7':['네 선배님 그런데 혹시 도서관이 어디에 있는지 아세요'],'s1e01-8':['정말요? 선배님 덕분에 살았어요'],'s1e01-t9':['선배님, 혹시 편의점이 어디에 있는지 아세요?'],'s1e01-t4':['선생님, 혹시 복사실이 어디에 있는지 아세요?']};
const used=new Map();
// 내 길 씨앗(--자리 road): 학생증 이름과 손으로 쓴 이름 글씨. --씨앗이름 "응우옌 티 민 아인" --씨앗글씨 아인 처럼 바꿔 긴 이름의 학생증 자리를 본다
const SEED_NAME=opt('--씨앗이름','볼로르'),SEED_W=opt('--씨앗글씨',SEED_NAME);
const SEED_SYL=[...SEED_W].filter(ch=>syllableStrokes(ch)),SEED_SIGN=encodeSign(SEED_SYL.map(ch=>syllableStrokes(ch).map(s=>s.p)));
const SEED_LINES=SEED_SYL.reduce((a,ch)=>a+syllableStrokes(ch).length,0);
function fakeTake(body){
 const line=byId.get(body.line_id);if(!line)return {ok:true,status:'unavailable'};
 const list=TRANSCRIPTS[line.id]||[line.line],n=used.get(line.id)||0;used.set(line.id,n+1);
 const transcript=list[Math.min(n,list.length-1)];
 const result=judgeLine(line.spec,{transcript,seconds:body.seconds,speechSeconds:body.seconds,language:''}),gated=result.status!=='ok';
 const next=nextTake({result,attempt:body.take.judged+(gated?0:1),unheard:gated?body.take.unheard+1:0});
 return {ok:true,accountId:'synthetic',status:'ok',take:{lineId:line.id,lineKind:line.kind,status:result.status,verdict:result.verdict,note:result.note,sure:result.sure,next,heard:transcript}};
}
const TYPES={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.mp3':'audio/mpeg','.mp4':'video/mp4','.webp':'image/webp','.woff2':'font/woff2'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=[],fail=[];
const check=(ok,what,detail='')=>{log.push(`${ok?'통과':'실패'} ${what}${detail?` — ${detail}`:''}`);if(!ok)fail.push(what);console.log(log.at(-1));};

const FULL=has('--완주'),t00=Date.now(),stamp=what=>console.log(`  ${Math.round((Date.now()-t00)/1000)}초 ${what}`);
// ── 서버 ──
const data=path.join(ROOT,'.tmp','seoul-qa',`db-${PORT}`);
const server=CAND?null:spawn(process.execPath,[path.join(ROOT,'experiences/seoul-arrival/qa/서버.mjs'),String(PORT)],{env:{...process.env,SYNK_WORLD_DATA_DIR:data},stdio:'ignore'});
process.on('exit',()=>{try{server?.kill();}catch{}});
const base=CAND?'https://synk.im/world':`http://127.0.0.1:${PORT}`;
if(!CAND)for(let i=0;i<120;i++){try{const r=await fetch(base+'/health');if(r.ok)break;}catch{}await sleep(500);}

const browser=await chromium.launch({channel:'msedge',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:SHOTS?2:1,hasTouch:W<700,locale:LANG==='ko'?'ko-KR':LANG==='mn'?'mn-MN':'en-US',permissions:['microphone']});
const page=await context.newPage();
const errors=[],badRequests=[];
page.on('pageerror',e=>errors.push('페이지 '+String(e).slice(0,300)));
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('콘솔 '+m.text().slice(0,300));});
page.on('response',r=>{const u=r.url();if(r.status()>=400&&!/\/api\//.test(u))badRequests.push(`${r.status()} ${u.replace(base,'')}`);});
await page.exposeFunction('__fakeTake',fakeTake);
await page.addInitScript(({linesVersion})=>{if(window!==window.top)return;
 window.SYNKDramaHost=Object.freeze({status:async()=>({ok:true,dramaEnabled:true,dramaLimit:30,dramaRemaining:30,linesVersion}),take:p=>window.__fakeTake(p)});
},{linesVersion:lesson.linesVersion});
// /drama/: 실제 시범판 파일(공개 빌드처럼 표시를 단다), 재생 사본은 공용 작업본에서
const frameAsked=[];page.on('request',q=>{if(/\/seoul-arrival\//.test(q.url()))frameAsked.push(q.url());});
const switchOff=text=>{if(!/export const SEOUL_AUTO=(true|false);/.test(text)){console.log('실패 seoul-entry.mjs에서 스위치 줄을 못 찾았다(--꺼짐은 끈 판을 만들 수 없다)');process.exit(1);}return text.replace(/export const SEOUL_AUTO=true;/,'export const SEOUL_AUTO=false;');};
if(OFF&&!CAND)await page.route(/\/seoul-entry\.mjs(\?|$)/,async route=>{const r=await route.fetch();return route.fulfill({response:r,body:switchOff(await r.text())});});
if(CAND){let served=0;
 await page.route('https://synk.im/world/**',async route=>{
  const u=new URL(route.request().url());let rel=decodeURIComponent(u.pathname.replace(/^\/world\//,''));if(!rel||rel.endsWith('/'))rel+='index.html';
  const file=path.join(path.resolve(CAND),'world',rel);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){if(OFF&&rel==='seoul-entry.mjs'){const r=await route.fetch();return route.fulfill({response:r,body:switchOff(await r.text())});}return route.continue();}
  let body=fs.readFileSync(file);if(OFF&&rel==='seoul-entry.mjs')body=switchOff(body.toString('utf8'));
  served++;return route.fulfill({status:200,headers:{'content-type':TYPES[path.extname(file)]||'application/octet-stream','cache-control':'no-store','accept-ranges':'bytes'},body});
 });
 process.on('exit',()=>console.log('후보에서 내준 파일',served));
}else await page.route(/\/drama\//,async route=>{
 const u=new URL(route.request().url());let rel=decodeURIComponent(u.pathname.replace(/^.*\/drama\//,''));if(!rel||rel.endsWith('/'))rel+='index.html';
 const inMedia=rel.startsWith('media/'),file=inMedia?path.join(MAIN,'experiences/drama/pilot',rel):path.join(PILOT,rel);
 if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 let body=fs.readFileSync(file);
 if(rel==='index.html')body=Buffer.from(body.toString('utf8').replace('<html lang="ko">','<html lang="ko" data-drama="world">'));
 return route.fulfill({status:200,headers:{'content-type':TYPES[path.extname(file)]||'application/octet-stream','accept-ranges':'bytes'},body});
});
const shot=async name=>{if(SHOTS)await page.screenshot({path:path.join(OUT,name+'.png')});};
const frameEl=()=>page.frames().find(f=>f.url().includes('/seoul-arrival/'));
const F=()=>frameEl();
const inF=(fn,arg)=>F().evaluate(fn,arg);
const until=async(what,fn,ms=30000)=>{const t0=Date.now();for(;;){try{const v=await fn();if(v)return v;}catch{}if(Date.now()-t0>ms){check(false,what,'시간 초과');throw Error('시간 초과: '+what);}await sleep(120);}};
const overflow=async where=>{const d=await inF(()=>({w:document.documentElement.scrollWidth-innerWidth,vv:innerWidth-(visualViewport?.width||innerWidth)}));if(d.w>0||d.vv>1)check(false,'가로 넘침 '+where,JSON.stringify(d));};

// ── 스위치가 꺼졌을 때: 새 손님은 지금 길 그대로 ──
if(OFF){
 await page.goto(`${base}/mobile.html${LANG!=='ko'?`?lang=${LANG}`:''}`,{waitUntil:'domcontentloaded'});
 await page.evaluate(lang=>{if(lang!=='ko')localStorage.setItem('synk.world.lang',lang);},LANG);
 await until('타이틀',()=>page.evaluate(()=>window.__synkOpening?.stage?.()==='title'));
 await sleep(1500);
 check(!await page.evaluate(()=>!!document.querySelector('#seoul-layer')),'타이틀 아래에 틀이 없음');
 await page.mouse.click(W/2,H*.55);
 await until('입장 관문',()=>page.evaluate(()=>document.querySelector('#world-panel')?.open),20000);
 await sleep(600);await shot('꺼짐-관문');
 check(!await page.evaluate(()=>!!document.querySelector('#seoul-layer')),'서울행 층이 안 뜸');
 check(frameAsked.length===0,'서울행 파일을 받지 않음',frameAsked.slice(0,3).join(' '));
 check(!await page.evaluate(()=>!!document.querySelector('#my-road-button:not([hidden])')),'내 길 문이 없음');
 await finish();
}
// ── 타이틀 ──
if(FROM==='road'){
 await page.goto(`${base}/mobile.html?seoulAuto=1`,{waitUntil:'domcontentloaded'});
 await page.evaluate(({lang,dream,seed})=>{sessionStorage.setItem('synk.brand-opening.v1.seen','1');if(lang!=='ko')localStorage.setItem('synk.world.lang',lang);localStorage.setItem('synk.world.arrival.v1:guest',JSON.stringify({version:1,stage:'card',dream,name:seed.name,nameEn:'Bolor',from:'몽골',call:'선배',look:'mn_m',sign:{w:seed.w,s:seed.sign}}));},{lang:LANG,dream:DREAM,seed:{name:SEED_NAME,w:SEED_W,sign:SEED_SIGN}});
 await page.reload({waitUntil:'domcontentloaded'});
 await until('내 길',async()=>!!F()&&await inF(()=>document.querySelector('#s-path')?.classList.contains('on')),30000);
 await sleep(800);
}else{
await page.goto(`${base}/mobile.html?${CAND?'seoul=1':'seoulAuto=1'}${LANG!=='ko'&&!PICKER?`&lang=${LANG}`:''}`,{waitUntil:'domcontentloaded'});
if(!PICKER)await page.evaluate(lang=>{if(lang!=='ko'){localStorage.setItem('synk.world.lang',lang);}},LANG);
await until('타이틀',()=>page.evaluate(()=>window.__synkOpening?.stage?.()==='title'));
await until('틀이 타이틀 아래에 미리 뜸',()=>page.evaluate(()=>!!document.querySelector('.seoul-frame')?.contentWindow?.__seoulFrame));
await until('판별 끝',async()=>{await sleep(400);return true;});
await shot('01-타이틀');
await page.mouse.click(W/2,H*.55);
if(PICKER){
 await until('언어 판',()=>page.evaluate(()=>!!document.querySelector('#panel-content [data-lang-picker]')),15000);
 await sleep(600);await shot('01b-언어판');
 await page.evaluate(lang=>document.querySelector(`[data-lang-choice="${lang}"]`).click(),LANG);await sleep(200);
 await page.evaluate(()=>document.querySelector('[data-lang-confirm]').click());
}
await until('타이틀이 닫힘',()=>page.evaluate(()=>!document.querySelector('.synk-opening')));
check(await page.evaluate(()=>document.querySelector('#seoul-layer')?.matches(':modal')),'서울행 층이 모달로 올라옴');
await until('내 방으로',()=>inF(()=>document.querySelector('#roomStage')?.classList.contains('on')));
await sleep(600);await shot('02-내방');
// 배경 고리는 파일 앞뒤 덧댐(app.mjs AMB_PAD)을 건너 돈다 — 방 소리가 그 자리로 돌고 있는지
await until('방 소리가 덧댐을 건너 돈다',()=>inF(()=>{const L=window.__seoulQA?.SND?.loops?.amb_room,s=L?.s;return !!(s&&s.loop&&s.buffer&&Math.abs(s.loopStart-.1)<1e-6&&Math.abs(s.loopEnd-(s.buffer.duration-.1))<1e-6);}),10000);
await until('건너뛰기 단추',()=>inF(()=>!document.querySelector('#skipBtn').hidden),8000);
await overflow('내 방');

// ── 거울 앞 ──
if(!FULL)await F().click('#skipBtn');
await until('거울 앞',()=>inF(()=>document.querySelector('#mirror').classList.contains('on')),FULL?90000:8000);stamp('거울 앞');
await sleep(500);await shot('03-거울');
await F().click(`.mr-pick[data-dream="${DREAM}"]`);
await until('꿈 시트',()=>inF(()=>document.querySelector('#mrSheet').classList.contains('on')),4000);
await sleep(500);await shot('04-꿈시트');
await F().click('#mrGo');
check(await until('저장: 꿈',()=>page.evaluate(d=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null')?.dream===d,DREAM)),'손님 기록에 꿈이 저장됨');
await sleep(800);
await until('여정의 건너뛰기',()=>inF(()=>!document.querySelector('#skipBtn').hidden),12000);
await sleep(1500);await shot('05-책상');
if(FULL)await journeyFull();else await F().click('#skipBtn');

// ── 정문 ──
const advance=async stop=>{for(let i=0;i<120;i++){if(await stop())return true;await inF(()=>document.querySelector('#vn')?.click());await sleep(160);}return false;};
await until('정문',()=>inF(()=>document.querySelector('#s-gate').classList.contains('on')),8000);
await sleep(1600);await shot('05e-정문');   // 부스 판 위 종이 안내판 자리(이름을 물으면 안내판은 숨는다)
check(await advance(()=>inF(()=>!!document.querySelector('#panel.on .sheetpad input'))),'이름 묻기까지');
await sleep(400);await shot('06-이름');
await F().fill('#panel .sheetpad input','Bolor');await F().click('#panel .sheetpad .ok');
// 이름 손글씨(설계 이름손글씨.md): 한글 이름 후보 → 「좋아요」 → 쓰기 칸. 기본 길은 「넘어가기」, --완주는 모형 획대로 실제로 쓴다
check(await advance(()=>inF(()=>!!document.querySelector('#panel.on .ko-cand'))),'한글 이름 후보');
check(await inF(()=>document.querySelector('#panel .ko-cand').textContent)==='볼로르','후보가 볼로르');
await sleep(400);await shot('06a-이름후보');await overflow('이름 후보');
await F().click('#panel [data-a="ok"]');
check(await advance(()=>inF(()=>document.querySelector('#nameTrace').classList.contains('on'))),'이름 쓰기 칸');
await sleep(1500);await shot('06b-이름쓰기');await overflow('이름 쓰기');
check(await inF(()=>!document.querySelector('#vn').classList.contains('on')),'쓰는 동안 말풍선을 내림');
{const r=await inF(()=>{const a=document.querySelector('#ntPad').getBoundingClientRect(),b=[...document.querySelectorAll('#nameTrace .trace-skip')].filter(x=>!x.hidden).map(x=>x.getBoundingClientRect());return {pad:a.width,top:a.top,bottom:Math.max(...b.map(x=>x.bottom)),h:innerHeight};});
 check(r.pad>=200&&r.top>=0&&r.bottom<=r.h,'이름 칸이 화면 안',JSON.stringify(r));}
if(FULL){
 const offN=await page.evaluate(()=>{const b=document.querySelector('.seoul-frame').getBoundingClientRect();return {x:b.left,y:b.top};});
 for(let k=0;k<3;k++){
  await until('음절 '+(k+1),()=>inF(i=>window.__seoulQA.nameTrace.state()?.i===i,k),6000);await sleep(k?900:2600);
  const strokes=await inF(()=>window.__seoulQA.nameTrace.paths());
  const draw=async list=>{for(const s of list){await page.mouse.move(s[0][0]+offN.x,s[0][1]+offN.y);await page.mouse.down();for(let i=1;i<s.length;i++)await page.mouse.move(s[i][0]+offN.x,s[i][1]+offN.y,{steps:s.length>4?2:10});await page.mouse.up();await sleep(160);}};
  if(k===1){
   // 둘째 음절은 한 획만 쓰고 「이대로 쓸게요」를 두 번 빨리 누른다 → 한 음절만 넘어가야 하고, 넘어가는 사이 펜을 대도 오류가 없어야 한다(화면 검수 A2)
   await draw(strokes.slice(0,1));
   check(await until('이대로 쓸게요',()=>inF(()=>window.__seoulQA.nameTrace.state()?.accept),5000),'못 넘기면 「이대로 쓸게요」가 나옴');
   await F().evaluate(()=>{const b=document.querySelector('#ntAccept');b.click();b.click();});
   const p0=strokes[0][0];await page.mouse.move(p0[0]+offN.x,p0[1]+offN.y);await page.mouse.down();await page.mouse.move(p0[0]+offN.x+30,p0[1]+offN.y+30,{steps:4});await page.mouse.up();
   await sleep(500);
   check(await inF(()=>window.__seoulQA.nameTrace.state()?.i)===2,'두 번 눌러도 한 음절만 넘어감',String(await inF(()=>window.__seoulQA.nameTrace.state()?.i)));
   await inF(()=>document.querySelector('#ntClear').click());await sleep(300);
   continue;
  }
  await draw(strokes);
  if(k===0){await sleep(200);await shot('06c-첫음절씀');}
 }
 await until('이름 쓰기 끝',()=>inF(()=>!document.querySelector('#nameTrace').classList.contains('on')),8000);check(true,'모형대로 쓰면 이름 쓰기가 끝남');
 check(await until('저장: 이름 글씨',()=>page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null')?.sign?.w==='볼로르')),'손님 기록에 이름 글씨');
}else{
 await F().click('#ntSkip');
 await until('이름 쓰기 닫힘',()=>inF(()=>!document.querySelector('#nameTrace').classList.contains('on')),4000);
}
check(await advance(()=>inF(()=>!!document.querySelector('#panel.on .learn'))),'이름 말해 보기');
await sleep(400);await shot('07-말해보기');
await F().click('#panel [data-n]');
check(await advance(()=>inF(()=>!!document.querySelector('#panel.on [data-i]'))),'나라 묻기');
await sleep(400);await shot('08-나라');
await F().click('#panel [data-i="0"]');
check(await advance(()=>inF(()=>!!document.querySelector('#panel.on [data-k]'))),'부르는 말');
await sleep(400);await shot('09-부르는말');
await F().click('#panel [data-k="선배"]');
check(await advance(()=>inF(()=>document.querySelector('#look').classList.contains('on'))),'얼굴 고르기');
await sleep(600);await shot('10-얼굴');
check(await inF(()=>!document.querySelector('.lk-me')&&!document.querySelector('#lkFile')),'내 사진 칸이 없음');
await F().click('.lk-th[data-i="1"]');await sleep(700);await shot('11-얼굴고름');
await F().click('#lkShoot');

// ── 학생증 ──
check(await advance(()=>inF(()=>document.querySelector('#cardHint').classList.contains('on'))),'학생증 인쇄 안내');
await shot('12-인쇄');
const rig=await F().locator('#cardRig').boundingBox();
await page.mouse.click(rig.x+rig.width/2,rig.y+rig.height/2);
await until('내 길 단추',()=>inF(()=>document.querySelector('#cardFoot').classList.contains('on')),8000);
await sleep(600);await shot('13-학생증');
const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null'));
check(saved?.stage==='card'&&saved?.name==='볼로르'&&saved?.from==='몽골'&&saved?.call==='선배'&&!!saved?.look,'손님 기록: 학생증 칸',JSON.stringify(saved));
{const sg=await inF(()=>({hidden:document.querySelector('#idSign').hidden,lines:document.querySelectorAll('#idSign polyline').length}));
 check(FULL?(!sg.hidden&&sg.lines>=12):(sg.hidden&&!saved?.sign),FULL?'학생증에 내 이름 글씨':'넘어가면 학생증에 글씨 없음',JSON.stringify(sg));}
await F().click('#toPath');
await until('내 길',()=>inF(()=>document.querySelector('#s-path').classList.contains('on')));
await sleep(3000);await shot('14-내길');await overflow('내 길');

// ── 새로고침: 내 길에서 이어진다 ──
// 후보(스위치 꺼짐): 주소에 ?seoul=1이 없어도 이미 시작한 학생은 내 길로 온다
if(CAND)await page.goto(`${base}/mobile.html`,{waitUntil:'domcontentloaded'});else await page.reload({waitUntil:'domcontentloaded'});
await until('새로고침 뒤 내 길',async()=>!!F()&&await inF(()=>document.querySelector('#s-path')?.classList.contains('on')),20000);
check(true,'새로고침 뒤 내 길로 이어짐');
await sleep(800);await shot('15-이어짐');
}
if(CAND){
 // 라이브는 계정 모드라 1화 앞에서 로그인 판이 뜬다. 닫으면 내 길에 그대로 있다
 await F().click('#startEp');
 await until('로그인 판',()=>page.evaluate(()=>document.querySelector('#world-panel')?.open&&!!document.querySelector('#panel-content .ws-lead')),8000);
 await sleep(500);await shot('16-로그인판');
 const lead=await page.evaluate(()=>document.querySelector('#panel-content .ws-lead')?.textContent||'');
 check(/학생증|student ID|үнэмлэх/.test(lead),'로그인 판에 학생증 저장 안내',lead);
 await page.evaluate(()=>document.querySelector('#world-panel').close());await sleep(500);
 check(await inF(()=>document.querySelector('#s-path').classList.contains('on')),'로그인 판을 닫으면 내 길');
 await F().click('#goHome');
 await until('서울행 층이 닫힘',()=>page.evaluate(()=>!document.querySelector('#seoul-layer')),6000);
 await until('입장 관문이 이어짐',()=>page.evaluate(()=>document.querySelector('#world-panel')?.open),12000);
 await sleep(500);await shot('17-관문');
 check(await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null')?.stage)==='left','기록이 끝남으로');
 await finish();
}
if(END==='road'){await finish();}

// ── 1화 ──
await F().click('#startEp');
await until('장면 카드',()=>inF(()=>document.querySelector('#s-scene').classList.contains('on')),4000);
await sleep(700);await shot('16-장면카드');
await until('드라마 틀',()=>page.evaluate(()=>!!document.querySelector('#panel-content .game-frame')),12000);
await sleep(1500);await shot('17-드라마');
const dramaFrame=()=>page.frames().find(f=>f.url().includes('/drama/'));
const start=Date.now();let ticks=0,lastSt='';
for(;;){
 if(Date.now()-start>Number(opt('--한도','300'))*1000){check(false,'1화 끝까지','시간 초과');await shot('17-멈춤');console.log(await dramaFrame()?.evaluate(()=>document.body.innerText.slice(0,600)));break;}
 const st=await dramaFrame()?.evaluate(()=>{
  const vis=el=>!!el&&el.getClientRects().length>0&&!el.disabled;
  if(document.querySelector('.wrap .log'))return 'wrap';
  const dlg=document.querySelector('dialog[open]');if(dlg){const b=[...dlg.querySelectorAll('button')].filter(vis).pop();if(b){b.click();return 'dialog:'+b.textContent.slice(0,20);}}
  const end=[...document.querySelectorAll('button')].filter(vis).find(b=>/^(마치기|Finish|Дуусгах)/.test(b.textContent.trim()));if(end){end.click();return 'finish';}
  const orb=document.querySelector('#orbBtn');if(vis(orb)&&!document.querySelector('#mic')?.hidden){orb.click();return 'orb';}
  const pill=[...document.querySelectorAll('button.pill,button.big')].filter(vis)[0];if(pill){pill.click();return 'pill:'+pill.textContent.slice(0,24);}
  return 'wait';
 }).catch(()=>null);
 if(st==='wrap')break;
 if(st!==lastSt){console.log('  드라마',Math.round((Date.now()-start)/1000)+'초',st);lastSt=st;}
 ticks++;await sleep(1100);
}
await until('오늘 기록 띠',()=>page.evaluate(()=>!!document.querySelector('#panel-content .seoul-cta button')),8000);
await sleep(400);await shot('18-오늘기록');
const hidden=await page.evaluate(()=>{const f=document.querySelector('#panel-content .game-frame').getBoundingClientRect(),b=document.querySelector('.seoul-cta').getBoundingClientRect();return f.bottom-b.top;});
check(hidden<=1,'띠가 틀을 가리지 않음',String(hidden));
const scenes=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null')?.scenes?.map(s=>s.id));
check(scenes?.includes('s1e01.scene')&&scenes?.includes('s1e01.wrap'),'장면 끝 기록',JSON.stringify(scenes));
await page.click('#panel-content .seoul-cta button');

// ── 객석 세 박자 ──
await until('객석',()=>inF(()=>document.querySelector('#s-crowd').classList.contains('on')),4000);
await sleep(1500);await shot('19-객석1');
const beat=[await inF(()=>document.querySelector('#crowdLab').textContent)];
await until('객석 끝',()=>inF(()=>document.querySelector('#crowdFoot').classList.contains('on')),20000);
beat.push(await inF(()=>document.querySelector('#crowdLab').textContent));
await sleep(600);await shot('20-객석끝');
const crowd=await inF(()=>({lab:document.querySelector('#crowdLab').textContent,plus:document.querySelector('#plus').textContent,count:document.querySelector('#crowdCount').textContent,aside:document.querySelector('#crowdAside').textContent,next:document.querySelector('#nextWhat').textContent+' / '+document.querySelector('#nextLeft').textContent,lights:window.__seoulQA.state.lights,best:window.__seoulQA.state.best}));
check(crowd.lights>=3,'불빛이 실제 말한 줄만큼',JSON.stringify(crowd));await overflow('객석');
await F().click('#backPath');

// ── 쪽지 ──
await until('쪽지',()=>inF(()=>document.querySelector('#mom').classList.contains('on')),6000);
await until('답 단추',()=>inF(()=>!document.querySelector('#momActs').hidden),6000);
await sleep(300);await shot('21-쪽지');
await F().click('#momFix');
await until('내 길로 단추',()=>inF(()=>!document.querySelector('#momBye').hidden),6000);
await sleep(300);await shot('22-쪽지답');
await F().click('#momBye');
await sleep(800);await shot('23-내길끝');
const rec=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null'));
check(rec?.momAnswer==='fix'&&!!rec?.momAt,'쪽지 답 저장');
check(await inF(()=>!!document.querySelector('#goHome')&&document.querySelector('#goHome').classList.contains('go-btn')),'1화 끝난 뒤 첫 단추는 우리 동네로');

// ── 우리 동네로 ──
await F().click('#goHome');
await until('서울행 층이 닫힘',()=>page.evaluate(()=>!document.querySelector('#seoul-layer')),6000);
await until('입장 관문이 이어짐',()=>page.evaluate(()=>document.querySelector('#world-panel')?.open),8000);
await sleep(600);await shot('24-관문');
const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null')?.stage);
check(after==='left','기록이 끝남으로');
// 관문을 지나 우리 동네로: 한글 질문 · 튜터 고르기는 지금 그대로다
await page.evaluate(()=>document.querySelector('[data-first-hangul="reads"]')?.click());
await until('튜터 고르기',()=>page.evaluate(()=>!!document.querySelector('[data-tutor-action="confirm"]')),8000);
await page.evaluate(()=>document.querySelector('[data-tutor-action="confirm"]').click());
await until('튜터 마침 단추',()=>page.evaluate(()=>!!document.querySelector('[data-tutor-action="finish"]')),8000);
await page.evaluate(()=>document.querySelector('[data-tutor-action="finish"]').click());
await until('우리 동네',()=>page.evaluate(()=>window.__synkWorld.entry().phase==='ready'),12000);
await sleep(500);await shot('25-우리동네');
check(await page.evaluate(()=>{const d=document.querySelector('#my-road-button');if(!d||d.hidden||!d.textContent.trim())return false;const r=d.getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}),'우리 동네에 내 길 문이 보임');
// 내 길 다시 열기
await page.evaluate(()=>document.querySelector('#my-road-button').click());
await until('내 길 다시 열림',async()=>!!F()&&await inF(()=>document.querySelector('#s-path')?.classList.contains('on')),15000);
await sleep(800);await shot('26-내길다시');
// 학생증 보기 · 모습 바꾸기
await F().click('#meBadge');
await until('학생증 다시 보기',()=>inF(()=>document.querySelector('#s-card').classList.contains('view')),4000);
await sleep(600);await shot('27-학생증다시');
if(FULL||FROM==='road')check(await inF(n=>document.querySelectorAll('#idSign polyline').length>=n,FROM==='road'?SEED_LINES:12),'다시 열어도 학생증에 이름 글씨');
{const o=await inF(()=>{const a=document.querySelector('#idSign svg g')?.getBoundingClientRect(),hit=[...document.querySelectorAll('#idcard .id-info > *, #idcard .id-foot > *, #idcard .id-school')].filter(e=>{const b=e.getBoundingClientRect();if(!a)return false;const rs=e.matches('.id-bar,.id-dream')?[b]:(()=>{const out=[],w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){if(!n.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(n);out.push(...[...r.getClientRects()].filter(x=>x.width>1&&x.height>1));}return out;})();return rs.some(t=>!(t.right<a.left+1||t.left>a.right-1||t.bottom<a.top+1||t.top>a.bottom-1));}).map(e=>e.className||e.id||e.tagName);return hit;});
 if(FULL||FROM==='road')check(!o.length,'학생증 글씨가 인쇄된 글과 겹치지 않음',o.join(','));}
await F().click('#reLook');
await until('모습 고르기 다시',()=>inF(()=>document.querySelector('#look').classList.contains('on')),4000);
await F().click('.lk-th[data-i="3"]');await sleep(500);await F().click('#lkShoot');await sleep(500);
const lookNow=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.arrival.v1:guest')||'null')?.look);
check(!!lookNow&&lookNow!==rec.look,'모습이 바뀌어 저장됨',lookNow);
await shot('28-모습바꿈');
await F().click('#toPath');await sleep(400);
await F().click('#goHome');
await until('내 길 닫힘',()=>page.evaluate(()=>!document.querySelector('#seoul-layer')),6000);
await finish();

// 책상부터 정문까지: 화면이 스스로 흐르는 대로 두고, 고를 것만 고른다
async function journeyFull(){
 await until('가 쓰기 칸',()=>inF(()=>document.querySelector('#trace').classList.contains('on')),120000);stamp('가 쓰기');
 await sleep(1200);await shot('05a-가쓰기');
 await overflow('가 쓰기');
 const off=await page.evaluate(()=>{const b=document.querySelector('.seoul-frame').getBoundingClientRect();return {x:b.left,y:b.top};});
 const strokes=await inF(()=>window.__seoulQA.traceGa.paths());
 check(strokes.length===3&&strokes.every(s=>s.length>=2),'획 표본 셋',String(strokes.map(s=>s.length)));
 for(const s of strokes){
  await page.mouse.move(s[0][0]+off.x,s[0][1]+off.y);await page.mouse.down();
  // 곧은 획은 표본이 양 끝 둘뿐이라 사이를 잘게 나눠 긋는다(실제 펜처럼)
  for(let i=1;i<s.length;i++)await page.mouse.move(s[i][0]+off.x,s[i][1]+off.y,{steps:s.length>4?2:12});
  await page.mouse.up();await sleep(250);
 }
 await sleep(300);await shot('05b-가다씀');
 await until('가 쓰기 끝',()=>inF(()=>!document.querySelector('#trace').classList.contains('on')),8000);check(true,'획대로 쓰면 가 쓰기가 끝남');stamp('가 끝');
 const seen=new Set();let wrong=false,gate=false;const t0=Date.now();
 const once=async(name,fn)=>{if(seen.has(name)||!await fn().catch(()=>false))return;seen.add(name);stamp(name);await sleep(800);await shot('05c-'+name);};
 while(Date.now()-t0<180000){
  gate=await inF(()=>document.querySelector('#s-gate').classList.contains('on')).catch(()=>false);if(gate)break;
  await once('메일',()=>inF(()=>document.querySelector('#banner').classList.contains('on')));
  await once('쪽지',()=>inF(()=>document.querySelector('#note').classList.contains('on')));
  await once('기내방송',()=>inF(()=>document.querySelector('#pa').classList.contains('on')));
  await once('안녕서울',()=>inF(()=>document.querySelector('#bigTitle').classList.contains('on')));
  // 첫 아침: 개찰구 고리만 누른다(버스 고리는 저절로 지나가는지 본다)
  if(!seen.has('개찰구')&&await inF(()=>{const s=document.querySelector('#spot');return !s.hidden&&s.classList.contains('on')&&s.classList.contains('reader');})){seen.add('개찰구');stamp('개찰구');await shot('05c-개찰구');await inF(()=>document.querySelector('#spot').click());}
  await once('버스',()=>inF(()=>{const s=document.querySelector('#spot');return !s.hidden&&s.classList.contains('on')&&s.classList.contains('glyph');}));
  // 입국심사
  const panel=await inF(()=>{const p=document.querySelector('#panel.on');if(!p)return null;if(p.querySelector('[data-k="trip"]'))return 'visa';if(p.querySelector('[data-n]'))return 'n';return 'other';}).catch(()=>null);
  if(panel==='visa'){if(!wrong){wrong=true;await shot('05d-심사');await overflow('심사');await inF(()=>document.querySelector('#panel [data-k="trip"]').click());}else await inF(()=>document.querySelector('#panel [data-k="study"]').click());}
  else if(panel==='n')await inF(()=>document.querySelector('#panel [data-n]').click());
  else await inF(()=>{const v=document.querySelector('#vn.on');if(v)v.click();}).catch(()=>{});
  await sleep(180);
 }
 check(gate,'프롤로그 끝에 정문이 열림',[...seen].join(','));stamp('정문');
 for(const need of ['메일','쪽지','기내방송','안녕서울','개찰구','버스'])check(seen.has(need),'지나감: '+need);
}

async function finish(){
 check(errors.length===0,'콘솔 · 페이지 오류 없음',errors.slice(0,6).join(' | '));
 const missing=[...new Set(badRequests)];
 check(missing.length===0,'실패 요청 없음',missing.slice(0,8).join(' | '));
 fs.writeFileSync(path.join(OUT,'결과.json'),JSON.stringify({log,errors,badRequests:[...new Set(badRequests)]},null,1));
 await browser.close();try{server?.kill();}catch{}
 console.log(fail.length?`실패 ${fail.length}건`:'모두 통과',OUT);
 process.exit(fail.length?1:0);
}
