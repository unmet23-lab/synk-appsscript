// 서울행 「내 사진으로」 칸 시험(--폭 360x640 · --언어 mn으로 좁힌다): 실제 틀 · 실제 seoul-entry · 실제 <dialog>에 가짜 계정과 가짜 제2의 나 판을 물려 실제 브라우저에서 돌린다.
// 운영 계정 · talk · 학생 사진을 쓰지 않는다. 「기준 사진」은 서울행의 지어낸 얼굴 그림을 https 주소로 흉내 낸다.
//   node experiences/seoul-arrival/qa/내사진.mjs [--찍기]   → 캡처는 .tmp/seoul-qa/내사진/
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const MAIN=path.join(os.homedir(),'Documents','SYNK-appsscript');
const require=createRequire(path.join(fs.existsSync(path.join(ROOT,'node_modules'))?ROOT:MAIN,'x.js'));
const {chromium}=require('playwright');
const SIZE=(()=>{const i=process.argv.indexOf('--폭');const [width,height]=(i<0?'390x844':process.argv[i+1]).split('x').map(Number);return {width,height};})();
const SHOTS=process.argv.includes('--찍기'),OUT=path.join(ROOT,'.tmp','seoul-qa','내사진');if(SHOTS)fs.mkdirSync(OUT,{recursive:true});
const PORT=4950+Math.floor(Math.random()*40),base=`http://127.0.0.1:${PORT}`;
const server=spawn(process.execPath,[path.join(ROOT,'experiences/seoul-arrival/qa/서버.mjs'),String(PORT)],{env:{...process.env,SYNK_WORLD_DATA_DIR:path.join(ROOT,'.tmp','seoul-qa',`db-${PORT}`)},stdio:'ignore'});
process.on('exit',()=>{try{server.kill();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<120;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await sleep(500);}
const browser=await chromium.launch({channel:'msedge'});
const fail=[];const check=(ok,what,detail='')=>{console.log(`${ok?'통과':'실패'} ${what}${detail?` — ${detail}`:''}`);if(!ok)fail.push(what);};
// 운영 사진 저장소 주소 꼴 그대로(틀의 CSP img-src가 이 주소만 연다). 요청은 아래 route가 가로채 서울행의 지어낸 얼굴 그림을 준다.
const PHOTO_URL='https://qiwxeddwwnzkwalpsuty.supabase.co/storage/v1/object/sign/me2-media/qa/base.jpg?token=fixture';
const PHOTO_URL2=PHOTO_URL.replace('fixture','fixture2');   // 같은 사진의 새 5분 주소
const PHOTO_BYTES=fs.readFileSync(path.join(ROOT,'experiences/seoul-arrival/assets/img/look-vn-f.webp'));

// 가짜 앱: 실제 판(dialog)과 실제 틀. 제2의 나 판은 status · open만 흉내 낸다(동의 · 올리기는 시험이 상태를 바꿔 대신한다).
const harness=`
window.__h=async function({owner=null,arrival=null,me2=null}={}){
 document.body.innerHTML='<div class="world-topbar"><button id="settings-open"></button></div><dialog id="world-panel"><div id="panel-content"></div></dialog>';
 // 앱(app-shell.css)의 서울행 틀 크기 규칙 그대로 — 없으면 틀이 기본 300×150이 된다
 const css=document.createElement('style');css.textContent='.seoul-layer{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#050b1a;overflow:hidden}.seoul-layer.is-waiting{visibility:hidden;transform:translateX(-200vw)}.seoul-frame{display:block;width:100%;height:100%;border:0}#world-panel{width:min(680px,100vw);min-height:300px}';document.head.append(css);
 const panel=document.querySelector('#world-panel'),content=panel.querySelector('#panel-content');
 const {createSeoulEntry}=await import('/seoul-entry.mjs');
 const st={owner,arrival,me2,statusCalls:0,opens:0,saved:[]};
 const client=()=>({snapshot:st.owner?{accountId:st.owner}:null,generation:1});
 const progress={status:()=>({scoped:true}),arrival:()=>st.arrival,setArrival:p=>{st.saved.push(p);st.arrival={...(st.arrival||{version:1}),...p};return {arrival:st.arrival};},selectedTutor:()=>null};
 const life={ensure:async()=>{},progress};
 const show=(title,html,type)=>{content.innerHTML=html;content.dataset.type=type;if(!panel.open)panel.showModal();};
 const close=()=>{if(panel.open)panel.close();content.innerHTML='';};
 const fake=st.me2===null?null:{status:async()=>{st.statusCalls++;if(st.fail)throw Error('연결 끊김');return st.me2;},open:async()=>{st.opens++;show('내 모습','<div class="fake-me2"><button id="fakeClose" type="button">닫기</button></div>','world-me2');document.querySelector('#fakeClose').addEventListener('click',close);}};
 const seoul=createSeoulEntry({dramaPending:()=>false,restored:Promise.resolve({failed:false}),client,life,home:{tutor:()=>({tutor:null}),state:{reduced:true},toast(){}},
  worldUrl:p=>new URL('/'+p,location.origin).href,launchGame:async()=>{},show,close,selectLanguage(){},tutorStatus:()=>({blocked:false}),native:()=>false,me2:fake});
 window.__seoul=seoul;window.__st=st;window.__panel=panel;
 return true;
};`;
const ROAD={version:1,stage:'card',dream:'idol',name:'볼로르',nameEn:'Bolor',from:'몽골',call:'선배',look:'mn_m',issuedAt:Date.UTC(2026,10,24)};
const INVITED={status:'ok',consent:{given:false},me:{state:'none'}};
async function open({owner='acc-1',arrival=ROAD,me2=INVITED,lang='ko',size=SIZE}={}){
 const context=await browser.newContext({viewport:size});const page=await context.newPage();
 page.on('pageerror',e=>check(false,'페이지 오류',String(e.stack||e).slice(0,600)));
 await page.route('https://qiwxeddwwnzkwalpsuty.supabase.co/storage/v1/object/sign/me2-media/qa/**',r=>r.fulfill({status:200,contentType:'image/webp',body:PHOTO_BYTES}));
 await page.addInitScript(l=>{try{localStorage.setItem('synk.world.lang',l);}catch{}},lang);
 await page.addInitScript(()=>addEventListener('error',e=>console.log('ERRLOC',location.pathname,e.filename,e.lineno,e.colno,e.message)));page.on('console',m=>{if(m.text().startsWith('ERRLOC'))console.log(m.text());});
 // 바깥 판(qa 없이)을 그릇으로 쓴다 — qa=road 판은 제 내 길 누름 처리기가 남아 그릇을 갈아 끼운 뒤 오류를 낸다
 await page.goto(base+'/seoul-arrival/index.html');
 await page.evaluate(harness+';0');await page.evaluate(o=>window.__h(o),{owner,arrival,me2});
 if(owner===null&&arrival)await page.evaluate(a=>localStorage.setItem('synk.world.arrival.v1:guest',JSON.stringify(a)),arrival);
 page.evaluate(()=>window.__seoul.openRoad()).catch(()=>{});
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(i=>i.contentWindow?.__seoulQA));
 const F=()=>page.frames().find(x=>x!==page.mainFrame()&&x.url().includes('/seoul-arrival/'));
 await F().waitForFunction(()=>document.querySelector('#s-path').classList.contains('on'),null,{timeout:15000});
 return {page,F,inF:(fn,a)=>F().evaluate(fn,a)};
}
// 내 길 → 내 사진(학생증) → 「모습 바꾸기」로 얼굴 고르기를 연다
async function toPick(t){
 await t.F().click('#meBadge');await t.F().waitForFunction(()=>document.querySelector('#s-card').classList.contains('on'));
 await sleep(500);await t.F().click('#reLook');await t.F().waitForFunction(()=>document.querySelector('#look').classList.contains('on'));await sleep(500);
}
const until=async(what,fn,ms=8000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await fn())return true;}catch{}await sleep(150);}console.log('  기다림 넘침: '+what);return false;};
const shot=async(t,name)=>{if(SHOTS)await t.page.screenshot({path:path.join(OUT,`${SIZE.width}-${name}.png`)});};
// 맨 앞 칸이 틀 안에 들어오고 글자가 잘리지 않는가
const tileFit=t=>t.inF(()=>{const b=document.querySelector('[data-me]');if(!b)return null;const r=b.getBoundingClientRect(),l=b.querySelector('.lk-me-label'),cs=getComputedStyle(l);
 return {text:l.textContent,w:Math.round(r.width),h:Math.round(r.height),cut:l.scrollWidth>l.clientWidth+1,font:parseFloat(cs.fontSize),left:Math.round(r.left)};});

// 1. 손님: 서버에 묻지 않고 칸도 없다
{const t=await open({owner:null,me2:INVITED});await toPick(t);
 check(await t.inF(()=>!document.querySelector('[data-me]')),'손님: 내 사진 칸 없음');
 check(await t.page.evaluate(()=>window.__st.statusCalls===0),'손님: 사진 상태를 묻지 않음');
 await t.page.context().close();}

// 2. 초대 안 된 학생: 한 번 묻고 칸은 없다(레일은 지금 그대로)
{const t=await open({me2:{status:'not_invited'}});await toPick(t);await sleep(400);
 check(await t.inF(()=>!document.querySelector('[data-me]')&&document.querySelectorAll('#lkRail .lk-th').length===12),'초대 안 됨: 칸 없음 · 얼굴 12칸 그대로');
 check(await t.page.evaluate(()=>window.__st.statusCalls>=1),'초대 안 됨: 상태는 물어 봄');
 await t.page.context().close();}

// 3. 초대된 학생: 칸 → 판(틀 위) → 올림(현상 중) → 셔터 → 학생증 「사진 현상 중」 → 사진 도착 → 학생증 · 내 길 머리에 사진
const ONLY=(()=>{const i=process.argv.indexOf('--언어');return i<0?null:process.argv[i+1];})();
for(const lang of ['ko','en','mn'].filter(l=>!ONLY||l===ONLY)){
 const t=await open({lang});
 // 판이 미리 열린 채 틀이 올라온 경우(틀 아래에 깔린 판)에도 사진 판은 맨 위에 와야 한다
 await t.page.evaluate(()=>{window.__panel.showModal();const d=document.querySelector('#seoul-layer');d.close();d.showModal();});
 await toPick(t);
 check(await until('내 사진 칸',()=>t.inF(()=>!!document.querySelector('[data-me]'))),`${lang} 초대: 맨 앞에 내 사진 칸`);
 const f0=await tileFit(t);check(f0&&!f0.cut&&f0.font>=13&&f0.left>=0,`${lang} 칸 글이 잘리지 않음`,JSON.stringify(f0));
 check(await t.inF(()=>document.querySelector('#lkRail').firstElementChild?.matches('[data-me]')),`${lang} 칸이 레일 맨 앞`);
 await shot(t,`${lang}-1-칸`);
 await t.F().click('[data-me]');
 check(await until('판 열림',()=>t.page.evaluate(()=>window.__st.opens===1&&window.__panel.open)),`${lang} 칸을 누르면 제2의 나 판`);
 const top=await t.page.evaluate(()=>{const r=document.querySelector('#fakeClose').getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!el?.closest('#world-panel');});
 check(top,`${lang} 사진 판이 서울행 틀 위에 뜸`);
 await shot(t,`${lang}-2-판`);
 // 학생이 동의하고 사진을 올렸다 → 현상 중
 await t.page.evaluate(()=>{window.__st.me2={status:'ok',consent:{given:true},me:{state:'developing'}};});
 await t.page.click('#fakeClose');
 check(await until('현상 중 칸',()=>t.inF(()=>document.querySelector('[data-me]')?.classList.contains('dev')&&document.querySelector('[data-me]').getAttribute('aria-pressed')==='true'&&!!document.querySelector('#lkVf .lk-dev')&&!document.querySelector('#lkShoot').disabled)),`${lang} 판을 닫으면 「사진 현상 중」이 골라져 있음`);
 const f1=await tileFit(t);check(f1&&!f1.cut,`${lang} 현상 중 칸 글이 잘리지 않음`,JSON.stringify(f1));
 await sleep(500);await shot(t,`${lang}-3-현상중`);
 await t.F().click('#lkShoot');
 check(await until('학생증 현상 중',()=>t.inF(()=>!!document.querySelector('#idPhoto .id-dev'))),`${lang} 학생증 사진 칸 「사진 현상 중」`);
 check(await t.page.evaluate(()=>{const s=window.__st.saved.at(-1);return s&&s.photo==='me'&&s.look===null;}),`${lang} 기록에는 photo:'me'만`,JSON.stringify(await t.page.evaluate(()=>window.__st.saved.at(-1))));
 check(await t.page.evaluate(()=>!JSON.stringify(window.__st.arrival).includes('supabase.co')),`${lang} 기록에 사진 주소 없음`);
 const dev=await t.inF(()=>{const s=document.querySelector('#idPhoto .id-dev span');const r=s.getBoundingClientRect(),p=document.querySelector('#idPhoto').getBoundingClientRect();return {text:s.textContent,inside:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1};});
 check(dev.inside,`${lang} 학생증 「사진 현상 중」 글이 칸 안`,JSON.stringify(dev));
 await sleep(400);await shot(t,`${lang}-4-학생증현상중`);
 // 사진이 나왔다 — 처음 사진은 학생이 한 장을 골라야 학생증에 들어간다(choose). 학생증 칸이 「사진 나왔어요 · 눌러서 고르기」 단추가 된다
 await t.page.evaluate(()=>{window.__st.me2={status:'ok',consent:{given:true},me:{state:'choose'}};});
 await t.inF(()=>window.__seoulQA.photo());
 check(await until('고르기 단추',()=>t.inF(()=>!!document.querySelector('#idPhoto [data-pick-photo]'))),`${lang} 사진이 나오면 학생증에 「사진 나왔어요」 단추`,await t.inF(()=>document.querySelector('#idPhoto').textContent));
 const pick=await t.inF(()=>{const b=document.querySelector('#idPhoto [data-pick-photo] span'),p=document.querySelector('#idPhoto').getBoundingClientRect(),r=b.getBoundingClientRect();return {text:b.textContent,inside:r.left>=p.left-1&&r.right<=p.right+1&&r.top>=p.top-1&&r.bottom<=p.bottom+1};});
 check(pick.inside,`${lang} 「사진 나왔어요」 글이 칸 안`,JSON.stringify(pick));
 check(await t.inF(()=>!window.__seoulQA.photoWaiting()),`${lang} 고를 차례에는 다시 묻기를 멈춤`);
 await sleep(400);await shot(t,`${lang}-4b-사진나왔어요`);
 // 한국어 판은 누르기, 영어 · 몽골어 판은 키보드(Enter · Space)로 — 카드가 그 키를 막지 않아야 한다
 if(lang==='ko')await t.F().click('#idPhoto [data-pick-photo]');else{await t.F().focus('#idPhoto [data-pick-photo]');await t.page.keyboard.press(lang==='en'?'Enter':' ');}
 check(await until('판 다시 열림',()=>t.page.evaluate(()=>window.__st.opens===2&&window.__panel.open)),`${lang} 단추를 누르면 제2의 나 판(틀 위)`);
 await t.page.evaluate(u=>{window.__st.me2={status:'ok',consent:{given:true},me:{state:'ready',chosen_url:u}};},PHOTO_URL);
 await t.page.click('#fakeClose');
 check(await until('학생증 사진',()=>t.inF(u=>{const im=document.querySelector('#idPhoto img');return im&&im.src===u&&im.complete&&im.naturalWidth>0;},PHOTO_URL)),`${lang} 판에서 고르고 오면 학생증 사진이 바뀜`,JSON.stringify(await t.inF(()=>{const im=document.querySelector('#idPhoto img');return {card:document.querySelector('#s-card').classList.contains('on'),html:document.querySelector('#idPhoto').innerHTML.slice(0,160),complete:im?.complete,nw:im?.naturalWidth};})));
 await sleep(400);await shot(t,`${lang}-5-학생증사진`);
 // 연결이 잠깐 끊겨도 보이던 사진은 그대로
 await t.page.evaluate(()=>{window.__st.fail=true;});await t.inF(()=>window.__seoulQA.photo());await sleep(300);
 check(await t.inF(u=>document.querySelector('#idPhoto img')?.src===u,PHOTO_URL),`${lang} 상태 요청이 실패해도 학생증 사진이 남음`);
 await t.page.evaluate(()=>{window.__st.fail=false;});
 await t.inF(()=>{window.__seoulQA.buildRoad();window.__seoulQA.show('s-path');});
 check(await t.inF(u=>document.querySelector('#meBadge').classList.contains('face')&&document.querySelector('#meBadge i')?.style.backgroundImage.includes(u),PHOTO_URL),`${lang} 내 길 머리에 내 사진`);
 // 사진이 있으면 칸이 얼굴이 되고, 누르면 칸에 그 얼굴
 await toPick(t);
 check(await until('얼굴 칸',()=>t.inF(()=>document.querySelector('[data-me] .lk-me-face i')!==null)),`${lang} 사진이 있으면 칸에 내 얼굴`);
 await t.F().click('[data-me]');
 check(await until('칸에 사진',()=>t.inF(u=>[...document.querySelectorAll('#lkVf img')].some(i=>i.src===u),PHOTO_URL)),`${lang} 내 얼굴을 칸에 띄움`);
 check(await t.page.evaluate(()=>window.__st.opens===2),`${lang} 사진이 있으면 판을 다시 열지 않음(칸 한 번 · 학생증 단추 한 번뿐)`);
 check(await until('칸에 띄운 얼굴',()=>t.inF(()=>{const vf=document.querySelector('#lkVf'),im=vf.querySelector('img:last-of-type');return vf.classList.contains('has')&&im?.classList.contains('in')&&im.naturalWidth>0&&document.querySelector('[data-me]').getAttribute('aria-pressed')==='true'&&!document.querySelector('#lkShoot').disabled;})),`${lang} 내 얼굴이 칸에 보이고 셔터가 켜짐`);await sleep(400);
 await shot(t,`${lang}-6-내얼굴`);
 // 같은 사진의 새 서명 주소가 오면 칸 · 카메라 칸이 새 주소로 바뀐다(만료된 주소로 남지 않게)
 await t.page.evaluate(u=>{window.__st.me2={status:'ok',consent:{given:true},me:{state:'ready',chosen_url:u}};},PHOTO_URL2);
 await t.inF(()=>window.__seoulQA.photo());
 check(await until('새 주소',()=>t.inF(u=>document.querySelector('[data-me] .lk-me-face i')?.style.backgroundImage.includes(u)&&[...document.querySelectorAll('#lkVf img')].some(i=>i.src===u&&i.classList.contains('in')),PHOTO_URL2)),`${lang} 새 서명 주소가 오면 칸 · 카메라 칸이 새 주소로`);
 await t.F().click('.lk-th[data-i="0"]');await sleep(300);await t.F().click('#lkShoot');
 check(await until('다른 얼굴 저장',()=>t.page.evaluate(()=>{const s=window.__st.saved.at(-1);return s&&s.photo===null&&typeof s.look==='string';})),`${lang} 준비된 얼굴로 바꾸면 내 사진 표시를 지움`);
 await t.page.context().close();
}

// 4. 정문 이야기 안: 현상 중인 내 사진을 고르면 찍는 시늉 없이 지호 선배의 한 줄 뒤 학생증이 나온다
{const t=await open({me2:{status:'ok',consent:{given:true},me:{state:'developing'}}});
 t.inF(()=>window.__seoulQA.lookPart()).catch(()=>{});
 for(let i=0;i<40;i++){if(await t.inF(()=>document.querySelector('#look').classList.contains('on')))break;await t.inF(()=>document.querySelector('#vn')?.click());await sleep(200);}
 check(await until('칸',()=>t.inF(()=>!!document.querySelector('[data-me].dev'))),'정문: 현상 중 칸');
 check(await t.inF(()=>window.__seoulQA.photoWaiting()),'정문: 미리 받은 답 뒤에도 고르기 판에서 1분 다시 묻기가 걸림');
 await t.F().click('[data-me]');await sleep(300);await t.F().click('#lkShoot');
 check(await until('대사 동안 레일 걷힘',()=>t.inF(()=>document.querySelector('#look').classList.contains('shoot')&&document.querySelector('#vn').classList.contains('on'))),'정문: 지호 선배가 말할 때 레일 · 단추를 걷음');
 check(await t.inF(()=>window.__seoulQA.photoWaiting()),'정문: 내 사진을 고른 뒤에도 다시 묻기가 걸려 있음');
 const said=[];for(let i=0;i<30;i++){const s=await t.inF(()=>document.querySelector('#vnText')?.textContent||'');if(s&&!said.includes(s))said.push(s);if(await t.inF(()=>document.querySelector('#cardHint').classList.contains('on')))break;await t.inF(()=>document.querySelector('#vn')?.click());await sleep(250);}
 check(said.some(s=>s.includes('사진이 나오면 한 장 골라서 학생증에 넣으면 돼요')),'정문: 지호 선배 한 줄',JSON.stringify(said));
 check(!said.some(s=>s.includes('하나, 둘, 셋')),'정문: 찍는 시늉 없음');
 check(await until('학생증 현상 중',()=>t.inF(()=>!!document.querySelector('#idPhoto .id-dev'))),'정문: 학생증 「사진 현상 중」');
 check(await t.inF(()=>!document.querySelector('#look').classList.contains('on')),'정문: 학생증이 나오면 고르기 판이 닫힘');
 await t.page.context().close();}

// 5. 다시 열기: photo:'me' 기록이면 내 길 머리에 바로 내 사진, 사진관이 쉬어도 만든 사진은 그대로
{const t=await open({arrival:{...ROAD,look:null,photo:'me'},me2:{status:'off',consent:{given:true},me:{state:'ready',chosen_url:PHOTO_URL}}});
 check(await until('머리 사진',()=>t.inF(u=>document.querySelector('#meBadge i')?.style.backgroundImage.includes(u),PHOTO_URL)),'다시 열기: 내 길 머리에 내 사진(사진관 쉼)');
 await t.F().click('#meBadge');
 check(await until('학생증 사진',()=>t.inF(u=>document.querySelector('#idPhoto img')?.src===u,PHOTO_URL)),'다시 열기: 학생증에 내 사진');
 await t.page.evaluate(u=>{window.__st.me2={status:'off',consent:{given:true},me:{state:'ready',chosen_url:u}};},PHOTO_URL2);
 await t.inF(()=>window.__seoulQA.photo());
 check(await until('학생증 새 주소',()=>t.inF(u=>document.querySelector('#idPhoto img')?.src===u&&document.querySelector('#meBadge i')?.style.backgroundImage.includes(u),PHOTO_URL2)),'새 서명 주소가 오면 학생증 · 내 길 머리도 새 주소로');
 await t.page.context().close();}

// 5b. 다른 사진으로 새 판이 나와 고를 차례여도, 앞서 고른 사진은 머리 · 학생증에 그대로 두고 칸만 「사진 나왔어요」(누르면 판)
{const t=await open({arrival:{...ROAD,look:null,photo:'me'},me2:{status:'ok',consent:{given:true},me:{state:'choose',chosen_url:PHOTO_URL}}});
 check(await until('머리 사진',()=>t.inF(u=>document.querySelector('#meBadge i')?.style.backgroundImage.includes(u),PHOTO_URL)),'새 판 고를 차례: 내 길 머리에 지금 사진');
 await toPick(t);
 check(await t.inF(u=>document.querySelector('#idPhoto img')?.src===u,PHOTO_URL),'새 판 고를 차례: 학생증에 지금 사진');
 check(await until('칸 글',()=>t.inF(()=>document.querySelector('[data-me] .lk-me-label')?.textContent==='사진 나왔어요'&&!!document.querySelector('[data-me] .lk-me-face i'))),'새 판 고를 차례: 칸은 지금 얼굴 + 「사진 나왔어요」');
 await t.F().click('[data-me]');
 check(await until('판',()=>t.page.evaluate(()=>window.__st.opens===1&&window.__panel.open)),'새 판 고를 차례: 칸을 누르면 판');
 await t.page.click('#fakeClose');await sleep(500);
 check(await t.page.evaluate(()=>window.__st.opens===1),'판을 그냥 닫으면 다시 열리지 않음');
 await t.page.context().close();}

// 6. 사진을 지웠거나 초대가 풀리면 빈 사진 칸 · 이름 첫 글자(깨진 그림 없음)
{const t=await open({arrival:{...ROAD,look:null,photo:'me'},me2:{status:'not_invited'}});await sleep(800);
 check(await t.inF(()=>!document.querySelector('#meBadge').classList.contains('face')&&document.querySelector('#meBadge').textContent==='볼'),'초대 풀림: 내 길 머리는 이름 첫 글자');
 await t.F().click('#meBadge');await sleep(500);
 check(await t.inF(()=>!document.querySelector('#idPhoto img')&&!document.querySelector('#idPhoto .id-dev')),'초대 풀림: 학생증 사진 칸은 비움');
 await t.page.context().close();}

await browser.close();server.kill();
console.log(fail.length?`실패 ${fail.length}: ${fail.join(' · ')}`:'모두 통과');
process.exit(fail.length?1:0);
