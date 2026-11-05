// 서울행 계정 길 시험: 로그인 판 · 손님 사본 묻고 옮기기 · 주인 바뀜. 운영 계정 없이 seoul-entry.mjs에 가짜 계정을 물려 실제 브라우저에서 돌린다.
//   node experiences/seoul-arrival/qa/계정길.mjs
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
const PORT=4800+Math.floor(Math.random()*150),base=`http://127.0.0.1:${PORT}`;
const server=spawn(process.execPath,[path.join(ROOT,'experiences/seoul-arrival/qa/서버.mjs'),String(PORT)],{env:{...process.env,SYNK_WORLD_DATA_DIR:path.join(ROOT,'.tmp','seoul-qa',`db-${PORT}`)},stdio:'ignore'});
process.on('exit',()=>{try{server.kill();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<120;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await sleep(500);}
const browser=await chromium.launch({channel:'msedge'});
const fail=[];const check=(ok,what,detail='')=>{console.log(`${ok?'통과':'실패'} ${what}${detail?` — ${detail}`:''}`);if(!ok)fail.push(what);};
const fresh=async()=>{const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.on('pageerror',e=>check(false,'페이지 오류',String(e).slice(0,200)));await page.goto(base+'/seoul-arrival/index.html?qa=road');return page;};

// 가짜 앱: 실제 판(dialog)과 실제 틀을 쓰고, 계정 · 생활 기록 · 게임만 흉내 낸다.
const harness=`
window.__h=async function({owner=null,arrival=null,tutor=false,operating=true,blocked=false,native=false,failSave=false}={}){
 document.body.innerHTML='<div class="world-topbar"><button id="settings-open"></button></div><dialog id="world-panel"><div id="panel-content"></div></dialog>';
 const panel=document.querySelector('#world-panel'),content=panel.querySelector('#panel-content');
 const {createSeoulEntry}=await import('/seoul-entry.mjs');
 const st={owner,arrival,failSave,signIns:[],shown:[],games:[],saved:[],toasts:[]};
 const client=()=>({snapshot:st.owner?{accountId:st.owner}:null,generation:1});
 const progress={arrival:()=>st.arrival,setArrival:p=>{if(st.failSave)throw Object.assign(Error('막힘'),{code:'PLAY_DATA_TOO_LARGE'});st.saved.push(p);st.arrival={...(st.arrival||{version:1}),...p};return {arrival:st.arrival};},selectedTutor:()=>tutor?'mongle':null};
 const life={ensure:async()=>{},get progress(){return st.owner||true?progress:null;}};
 const show=(title,html,type)=>{st.shown.push(type);content.innerHTML=html;if(!panel.open)panel.showModal();};
 const close=()=>{if(panel.open)panel.close();content.innerHTML='';};
 const seoul=createSeoulEntry({dramaPending:()=>false,restored:Promise.resolve(),operating,client,life,home:{tutor:()=>({tutor:tutor?'mongle':null}),state:{reduced:true},toast(m){st.toasts.push(m);}},
  worldUrl:p=>new URL('/'+p,location.origin).href,launchGame:async(id,o)=>{st.games.push([id,o]);},signIn:(a,lead)=>st.signIns.push(lead),show,close,selectLanguage(){},tutorStatus:()=>({blocked}),native:()=>native});
 window.__seoul=seoul;window.__st=st;window.__panel=panel;
 return true;
};`;
const setup=async(page,opts)=>{await page.evaluate(harness+';0');return page.evaluate(o=>window.__h(o),opts);};
const GUEST={version:1,stage:'card',dream:'idol',name:'볼로르',nameEn:'Bolor',from:'몽골',call:'선배',look:'mn_m'};
const guestKey='synk.world.arrival.v1:guest';

// 1. 손님이 1화를 누르면 로그인 판, 상태 signin
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:null,operating:true});
 const run=page.evaluate(()=>{window.__done=window.__seoul.run();return true;});await run;
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 const out=await page.evaluate(()=>window.SYNKSeoulHost.prepareEpisode());
 check(out.status==='signin','손님 · 1화 시작 → 로그인 판');
 check(await page.evaluate(()=>window.__st.signIns.length===1&&/학생증/.test(window.__st.signIns[0])),'로그인 판 글이 이야기 말',await page.evaluate(()=>window.__st.signIns[0]));
 const f=page.frames().find(x=>x.url().includes('/seoul-arrival/')&&x!==page.mainFrame());
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(i=>i.contentWindow?.__seoulFrame));
 await sleep(800);
 check(await f.evaluate(()=>document.querySelector('#s-path').classList.contains('on')),'내 길에서 시작');
 await page.close();}

// 2. 로그인한 계정에 기록이 없고 손님 사본이 있으면 묻는다 → 저장
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:'acc-1',operating:true});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 check((await page.evaluate(()=>document.querySelector('#panel-content').innerText)).includes('볼로르'),'물음에 학생증 이름이 보임');
 check(await page.evaluate(()=>window.__st.saved.length===0),'묻기 전에는 계정에 안 씀');
 await page.evaluate(()=>window.__seoul.moveChoice('yes'));
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 check(await page.evaluate(()=>window.__st.arrival?.name==='볼로르'),'저장: 계정에 옮겨짐');
 check(await page.evaluate(k=>localStorage.getItem(k)===null,guestKey),'저장: 손님 사본 지움');
 await page.close();}

// 3. 아니요 → 사본 지우고 처음부터(스위치 켜진 자리에서)
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));history.replaceState(null,'','?seoul=1');},[guestKey,GUEST]);
 await setup(page,{owner:'acc-2',operating:true});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 await page.evaluate(()=>window.__seoul.moveChoice('no'));
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 check(await page.evaluate(()=>window.__st.saved.length===0&&window.__st.arrival===null),'아니요: 계정에 안 씀');
 check(await page.evaluate(k=>localStorage.getItem(k)===null,guestKey),'아니요: 손님 사본 지움');
 await page.close();}

// 4. 판을 그냥 닫으면 이번엔 넘어간다(사본은 남고 관문으로)
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:'acc-3',operating:true});
 const res=page.evaluate(()=>window.__seoul.run());
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 await page.evaluate(()=>window.__panel.close());
 check(await res==='later','판을 닫으면 관문으로');
 check(await page.evaluate(k=>localStorage.getItem(k)!==null,guestKey),'판을 닫으면 사본은 그대로');
 await page.close();}

// 5. 계정에 기록이 있으면 묻지 않고 사본을 지운다. 끝난 기록이면 서울행 없음
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:'acc-4',arrival:{version:1,stage:'left',dream:'actor',name:'안나'},operating:true});
 const res=await page.evaluate(()=>window.__seoul.run());
 check(res==='skipped','끝난 계정: 서울행 없음');
 check(await page.evaluate(k=>localStorage.getItem(k)===null,guestKey),'앞사람 손님 사본을 지움');
 await page.close();}

// 6. 돌아온 계정 · PC 앱 · 기록 충돌: 서울행 없음(스위치가 켜져 있어도)
for(const [what,opts] of [['돌아온 계정',{owner:'acc-5',tutor:true}],['PC 앱',{owner:'acc-6',native:true}],['기록 충돌',{owner:'acc-7',blocked:true}]]){
 const page=await fresh();
 await page.evaluate(()=>history.replaceState(null,'','?seoulAuto=1'));
 await setup(page,{...opts,operating:true});
 check(await page.evaluate(()=>window.__seoul.run())==='skipped',what+': 서울행 없음');
 await page.close();
}

// 7. 저장은 그때의 주인에게만: 주인이 바뀐 뒤 들어온 저장은 버린다
{const page=await fresh();
 await setup(page,{owner:'acc-8',arrival:{version:1,stage:'card',dream:'idol'},operating:true});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 await page.evaluate(()=>window.SYNKSeoulHost.save({name:'가'}));
 check(await page.evaluate(()=>window.__st.arrival.name==='가'),'같은 주인: 저장됨');
 await page.evaluate(()=>{window.__st.owner='acc-9';window.SYNKSeoulHost.save({name:'나'});});
 check(await page.evaluate(()=>window.__st.arrival.name==='가'),'주인이 바뀐 뒤: 안 씀');
 await page.close();}

// 8. 틀에서 온 값(다른 창의 객체)도 검사를 지난다
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:null,operating:false});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(i=>i.contentWindow?.__seoulFrame));
 const f=page.frames().find(x=>x!==page.mainFrame()&&x.url().includes('/seoul-arrival/'));
 await f.evaluate(()=>window.parent.SYNKSeoulHost.save({scenes:[{id:'s1e01.wrap',at:Date.now(),lines:3}],best:{s1e01:{n:3,t2:true,tr:false}}}));
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),guestKey);
 check(saved.scenes.length===1&&saved.best.s1e01.n===3,'틀에서 온 값 저장',JSON.stringify(saved.best));
 await page.close();}

// 9. ?seoul=1로 온 손님이 1화 앞에서 로그인해 다시 불린 뒤 저장하면 내 길로 이어진다(타이틀로 돌아가지 않는다)
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));history.replaceState(null,'','?seoul=1');},[guestKey,GUEST]);
 await setup(page,{owner:'acc-10',operating:true});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 await page.evaluate(()=>window.__seoul.moveChoice('yes'));
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(i=>i.contentWindow?.__seoulFrame));
 await sleep(800);
 const f=page.frames().find(x=>x!==page.mainFrame()&&x.url().includes('/seoul-arrival/'));
 check(await f.evaluate(()=>document.querySelector('#s-path').classList.contains('on')),'?seoul=1 · 저장 뒤 내 길로');
 check(await f.evaluate(()=>!document.querySelector('#s-title').classList.contains('on')),'?seoul=1 · 저장 뒤 타이틀이 아님');
 await page.close();}

// 10. 계정 저장이 막히면 손님 사본(유일한 원본)을 지우지 않고 관문으로 — 다음에 다시 묻는다
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:'acc-11',operating:true,failSave:true});
 const res=page.evaluate(()=>window.__seoul.run());
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 await page.evaluate(()=>window.__seoul.moveChoice('yes'));
 check(await res==='later','저장 막힘: 관문으로');
 check(await page.evaluate(k=>JSON.parse(localStorage.getItem(k))?.name==='볼로르',guestKey),'저장 막힘: 손님 사본이 남음');
 check(await page.evaluate(()=>window.__st.toasts.length===1),'저장 막힘: 다시 열어 달라는 안내',await page.evaluate(()=>window.__st.toasts[0]));
 await page.close();}

// 11. 묻는 사이 계정이 바뀌면 새 계정에 쓰지 않고 손님 사본을 남긴다
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify(g));},[guestKey,GUEST]);
 await setup(page,{owner:'acc-12',operating:true});
 const res=page.evaluate(()=>window.__seoul.run());
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 await page.evaluate(()=>{window.__st.owner='acc-13';window.__seoul.moveChoice('yes');});
 check(await res==='later','묻는 사이 계정 바뀜: 관문으로');
 check(await page.evaluate(()=>window.__st.saved.length===0),'묻는 사이 계정 바뀜: 새 계정에 안 씀');
 check(await page.evaluate(k=>localStorage.getItem(k)!==null,guestKey),'묻는 사이 계정 바뀜: 손님 사본이 남음');
 await page.close();}

// 12. 바로가기는 그 길 그대로: 손님 사본이 있어도 서울행을 살펴보지 않는다
for(const search of ['?drama=1','?wardrobe=1','?cafe=1']){
 const page=await fresh();
 await page.evaluate(([k,g,s])=>{localStorage.setItem(k,JSON.stringify(g));history.replaceState(null,'',s);},[guestKey,GUEST,search]);
 await setup(page,{owner:null,operating:true});
 check(await page.evaluate(()=>window.__seoul.active()===false),`바로가기 ${search}: 서울행을 살펴보지 않음`);
 await page.close();
}

// 13. 끝낸 손님: 틀을 미리 받지 않는다. 다음 방문에 서울행도 없다. 로그인했으면 저장을 묻는다
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify({...g,stage:'left'}));},[guestKey,GUEST]);
 await setup(page,{owner:null,operating:true});
 await page.evaluate(()=>window.__seoul.beforeTitle());
 check(await page.evaluate(()=>!document.querySelector('#seoul-layer')),'끝낸 손님: 틀을 미리 받지 않음');
 check(await page.evaluate(()=>window.__seoul.run())==='skipped','끝낸 손님: 서울행 없음');
 await page.close();}
{const page=await fresh();
 await page.evaluate(([k,g])=>{localStorage.setItem(k,JSON.stringify({...g,stage:'left'}));},[guestKey,GUEST]);
 await setup(page,{owner:'acc-14',operating:true});
 await page.evaluate(()=>window.__seoul.beforeTitle());
 const res=page.evaluate(()=>window.__seoul.run());
 await page.waitForFunction(()=>window.__panel.open&&document.querySelector('[data-world="seoul-move"]'),null,{timeout:15000});
 await page.evaluate(()=>window.__seoul.moveChoice('yes'));
 check(await res==='skipped','끝낸 손님이 로그인: 묻고 저장한 뒤 서울행 없음');
 check(await page.evaluate(()=>window.__st.arrival?.stage==='left'),'끝낸 손님이 로그인: 계정에 옮겨짐');
 await page.close();}

// 14. 「내 길」 문: 언어를 바꾸면 글이 바뀌고, 주인이 바뀌면 그 주인 기록으로 맞춘다
{const page=await fresh();
 await setup(page,{owner:'acc-15',arrival:{version:1,stage:'left',dream:'idol'},operating:true});
 await page.evaluate(()=>window.__seoul.syncDoor());
 const door=()=>page.evaluate(()=>{const d=document.querySelector('#my-road-button');return d?{text:d.textContent,hidden:d.hidden}:null;});
 check((await door())?.hidden===false,'문: 기록이 있는 계정에 보임');
 await page.evaluate(async()=>{const {setLang}=await import('/brand-opening/world-lang.mjs');setLang('en');});
 check((await door())?.text==='My road','문: 언어를 바꾸면 글이 바뀜',(await door())?.text);
 await page.evaluate(()=>{window.__st.owner='acc-16';window.__st.arrival=null;window.__seoul.onIdentity();});
 check((await door())?.hidden===true,'문: 기록 없는 계정으로 바뀌면 숨음');
 await page.close();}

// 14b. 학생증 전에 멈춘 학생이 문으로 돌아오면 내 길이 아니라 틀의 시작 화면으로
for(const [stage,screen] of [['dream','#s-title'],['card','#s-path']]){
 const page=await fresh();
 await setup(page,{owner:'acc-18',arrival:{version:1,stage,dream:'idol'},operating:true});
 await page.evaluate(()=>{window.__seoul.openRoad();});
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(i=>i.contentWindow?.__seoulFrame));
 await sleep(800);
 const f=page.frames().find(x=>x!==page.mainFrame()&&x.url().includes('/seoul-arrival/'));
 check(await f.evaluate(s=>document.querySelector(s).classList.contains('on'),screen),`문으로 돌아옴 · ${stage} → ${screen}`);
 await page.close();
}

// 15. 통로는 이상한 값을 조용히 버린다
{const page=await fresh();
 await setup(page,{owner:'acc-17',arrival:{version:1,stage:'card',dream:'idol'},operating:true});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>document.querySelector('#seoul-layer')?.matches(':modal'),null,{timeout:20000});
 const threw=await page.evaluate(()=>{try{window.SYNKSeoulHost.save();window.SYNKSeoulHost.save(null);window.SYNKSeoulHost.save('x');window.SYNKSeoulHost.save([1]);return false;}catch(e){return String(e);}});
 check(threw===false,'통로: 이상한 값에 던지지 않음',String(threw));
 check(await page.evaluate(()=>window.__st.saved.length===0),'통로: 이상한 값은 안 씀');
 await page.close();}

await browser.close();server.kill();
console.log(fail.length?`실패 ${fail.length}건: ${fail.join(' / ')}`:'모두 통과');
process.exit(fail.length?1:0);
