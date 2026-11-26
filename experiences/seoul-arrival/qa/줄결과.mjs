// 서울행 「내 팬」 대사별 칭찬의 통로 시험(팬설계 13-2 「통로」): 실제 seoul-entry.mjs가 1화를 닫을 때 부모 창 학습 기록을 읽어
// {line, result, kind}만 넘기는지 실제 브라우저에서 본다. 운영 계정 · talk 없이 가짜 앱(계정길.mjs와 같은 꼴)에 1화 틀만 흉내 낸 틀을 문다.
// 학습 기록은 실제 1화 기록기(learning-entry.cjs createRecorder)로 node에서 만들어 townEvidence 자리에 준다.
//   node experiences/seoul-arrival/qa/줄결과.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const MAIN=path.join(os.homedir(),'Documents','SYNK-appsscript');
const require=createRequire(path.join(fs.existsSync(path.join(ROOT,'node_modules'))?ROOT:MAIN,'x.js'));
const {chromium}=require('playwright');
const Drama=createRequire(import.meta.url)(path.join(ROOT,'experiences/drama/pilot/learning-entry.cjs'));
const PILOT=(await import(pathToFileURL(path.join(ROOT,'experiences/drama/pilot/content.mjs')).href)).default;
const {lineResults}=await import(pathToFileURL(path.join(ROOT,'experiences/synk-world-app/drama-lines.mjs')).href);

// ── 학습 기록: 판 셋(앞 완주 전 · 이번 판 · 한 패널 안의 둘째 판) ──
const LINES=PILOT.scene.filter(x=>x.type==='student'),[L6,L7,L8]=LINES.map(x=>x.id);
const ok=(kind,note)=>({kind:'result',data:{status:'ok',transcript:'x',observation:{kind,note:note||null,sure:kind==='pass'},trail:{correct:kind==='pass',assessable:false}}});
const TAKE={pass:ok('pass'),ending:ok('note',{kind:'ending',want:'polite',got:'plain',at:'x'}),length:ok('note',{kind:'length'}),
 unheard:{kind:'result',data:{status:'no_speech',transcript:'',trail:{correct:null,assessable:false,reason:'unanswered'}}}};
const BASE=Date.now()-600000,SINCE=BASE+10000,W1=BASE+30000,W2=BASE+50000;
function record(rounds){
 const box={now:BASE},mem=new Map(),storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
 let coach=null;const rec=Drama.createRecorder({owner:{createGame:(meta,factory)=>(coach=factory({gameId:meta.gameId,clock:()=>new Date(box.now).toISOString(),storage}))}});
 for(const r of rounds){box.now=r.at;for(const s of LINES){const steps=r.lines[s.id];if(!steps)continue;const line=rec.open({lineId:s.id,skillId:s.skill,phase:'scene'});for(const t of steps)line.take(TAKE[t]);box.now+=1000;}}
 return coach.events();
}
const OLD={at:BASE,lines:{[L6]:['pass'],[L7]:['pass'],[L8]:['pass']}};
const R1={at:SINCE+5000,lines:{[L6]:['ending','pass'],[L7]:['pass'],[L8]:['unheard','pass']}};
const R2={at:W1+5000,lines:{[L6]:['pass'],[L7]:['length','length'],[L8]:['pass']}};
const R2half={at:W1+5000,lines:{[L6]:['length']}};
const R2gap={at:W1+5000,lines:{[L6]:['pass'],[L7]:['length','length']}};   // 기록이 빠진 줄(L8): 앞 판의 결과를 끌어오면 안 된다
const ALL=record([OLD,R1,R2]),HALF=record([OLD,R1,R2half]),GAP=record([OLD,R1,R2gap]);
const EXPECT1=[{line:L6,result:'fixed',kind:'ending'},{line:L7,result:'clean'},{line:L8,result:'heard'}];
const EXPECT2=[{line:L6,result:'clean'},{line:L7,result:'todo',kind:'length'},{line:L8,result:'clean'}];

// ── 서버 · 브라우저 ──
const PORT=4800+Math.floor(Math.random()*150),base=`http://127.0.0.1:${PORT}`;
const server=spawn(process.execPath,[path.join(ROOT,'experiences/seoul-arrival/qa/서버.mjs'),String(PORT)],{env:{...process.env,SYNK_WORLD_DATA_DIR:path.join(ROOT,'.tmp','seoul-qa',`db-${PORT}`)},stdio:'ignore'});
process.on('exit',()=>{try{server.kill();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(let i=0;i<120;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await sleep(500);}
const browser=await chromium.launch({channel:'msedge'});
const fail=[];const check=(ok,what,detail='')=>{console.log(`${ok?'통과':'실패'} ${what}${detail?` — ${detail}`:''}`);if(!ok)fail.push(what);};
const fresh=async()=>{const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.on('pageerror',e=>check(false,'페이지 오류',String(e).slice(0,200)));await page.goto(base+'/seoul-arrival/index.html?qa=road');return page;};

// 가짜 앱(계정길.mjs와 같은 꼴) + 1화 틀 흉내: launchGame이 판에 .game-frame을 띄우고, 시험이 그 안의 꼬리표 · 오늘 기록을 바꾼다.
// evidence는 window.__ev가 돌려주는 {events, evidenceComplete} — 실제 앱의 townEvidence 자리.
const harness=`
window.__h=async function({owner=null,arrival=null}={}){
 document.body.innerHTML='<div class="world-topbar"><button id="settings-open"></button></div><dialog id="world-panel"><div id="panel-content"></div></dialog>';
 const panel=document.querySelector('#world-panel'),content=panel.querySelector('#panel-content');
 const {createSeoulEntry}=await import('/seoul-entry.mjs');
 const st={owner,arrival,signIns:[],shown:[],games:[],saved:[],toasts:[],evReads:0};
 const client=()=>({snapshot:st.owner?{accountId:st.owner}:null,generation:1});
 const progress={status:()=>({scoped:true}),arrival:()=>st.arrival,setArrival:p=>{st.saved.push(p);st.arrival={...(st.arrival||{version:1}),...p};return {arrival:st.arrival};},selectedTutor:()=>null};
 const life={ensure:async()=>{},get progress(){return progress;}};
 const show=(title,html,type)=>{st.shown.push(type);content.innerHTML=html;if(!panel.open)panel.showModal();};
 const close=()=>{if(panel.open)panel.close();content.innerHTML='';};
 const EP='<p id="epTag">EP.01 · Scene 2</p>';
 const launchGame=async(id,o)=>{st.games.push([id,o]);content.innerHTML='<iframe class="game-frame"></iframe>';if(!panel.open)panel.showModal();
  const f=content.querySelector('iframe');await new Promise(r=>{f.addEventListener('load',r,{once:true});f.srcdoc='<!doctype html><body>'+EP+'</body>';});};
 const seoul=createSeoulEntry({dramaPending:()=>false,restored:Promise.resolve({failed:false}),operating:true,client,life,home:{tutor:()=>({tutor:null}),state:{reduced:true},toast(m){st.toasts.push(m);}},
  worldUrl:p=>new URL('/'+p,location.origin).href,launchGame,signIn:(a,lead)=>{st.signIns.push(lead);},show,close,selectLanguage(){},tutorStatus:()=>({blocked:false}),native:()=>false,
  evidence:()=>{st.evReads++;return window.__ev?window.__ev():null;}});
 window.__seoul=seoul;window.__st=st;window.__panel=panel;
 const doc=()=>content.querySelector('.game-frame').contentDocument;
 // 오늘 기록(1화 끝): 꼬리표와 .wrap 목록 — seoul-watch.mjs readWrap이 읽는 꼴. at은 그 순간의 부모 시계(완주 시각)
 window.__wrap=at=>{const real=Date.now;Date.now=()=>at;try{const d=doc();d.getElementById('epTag').textContent='EP.01 · Today';
  const w=d.createElement('div');w.className='wrap';w.innerHTML='<ul class="log"><li><div><p>3줄 중 3줄</p></div></li><li><span class="tick on"></span></li><li><span class="tick"></span></li></ul>';d.body.append(w);
  }finally{setTimeout(()=>{Date.now=real;},50);}};
 // 「처음부터 다시」: 오늘 기록이 사라지고 장면 꼬리표로 돌아온다
 window.__restart=()=>{const d=doc();d.querySelector('.wrap')?.remove();d.getElementById('epTag').textContent='EP.01 · Scene 2';};
 return true;
};`;
const setup=async(page,opts)=>{await page.evaluate(harness+';0');return page.evaluate(o=>window.__h(o),opts);};
const ARRIVAL={version:1,stage:'road',dream:'idol',name:'볼로르',nameEn:'Bolor',from:'몽골',call:'선배',look:'mn_m',scenes:[{id:'s1e01.wrap',at:SINCE,lines:3}]};
const GUEST_KEY='synk.world.arrival.v1:guest';

// 한 판: 서울행을 세우고 1화를 열어(openEpisode) steps대로 끝낸 뒤 판을 닫는다. 돌려받은 값을 준다.
async function episode({owner='acc-1',events=ALL,complete=0,steps=[['wrap',W1]],before=null}={}){
 const page=await fresh();
 if(!owner)await page.evaluate(([k,g])=>localStorage.setItem(k,JSON.stringify(g)),[GUEST_KEY,ARRIVAL]);
 await setup(page,{owner,arrival:owner?ARRIVAL:null});
 await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>!!window.SYNKSeoulHost,null,{timeout:20000});
 // complete: 이 ms 동안은 「다 읽힘」이 거짓(기록 직후). null이면 학습 기록을 못 읽음
 await page.evaluate(([events,complete])=>{const t0=performance.now();window.__ev=events===null?null:()=>({events,evidenceComplete:performance.now()-t0>=complete});},[events,complete]);
 await page.evaluate(()=>{window.__out=null;window.SYNKSeoulHost.openEpisode({}).then(o=>{window.__out=o;});});
 await page.waitForFunction(()=>!!document.querySelector('#panel-content .game-frame')?.contentDocument?.getElementById('epTag'),null,{timeout:10000});
 await sleep(300);
 for(const [kind,at] of steps){
  if(kind==='wrap'){await page.evaluate(at=>window.__wrap(at),at);await page.waitForFunction(()=>!!document.querySelector('#panel-content .seoul-cta'),null,{timeout:5000}).catch(()=>{});}
  else await page.evaluate(()=>window.__restart());
  await sleep(300);
 }
 if(before)await page.evaluate(before);
 // 「덜 읽힘」 시간을 닫은 뒤부터 재도록 다시 단다
 if(complete&&events)await page.evaluate(([events,complete])=>{const t0=performance.now();window.__ev=()=>({events,evidenceComplete:performance.now()-t0>=complete});},[events,complete]);
 await page.evaluate(()=>window.__panel.close());
 await page.waitForFunction(()=>!!window.__out,null,{timeout:5000}).catch(()=>{});
 const out=await page.evaluate(()=>({out:window.__out,reads:window.__st.evReads}));
 await page.close();
 return out;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

{const {out,reads}=await episode();
 check(out?.status==='wrap'&&same(out.results,EXPECT1),'계정 · 다 읽힘: 이번 판의 줄 결과',JSON.stringify(out?.results));
 check(same(EXPECT1,lineResults(ALL,{since:SINCE,until:W1})),'node 계산과 같음');
 check(out?.results?.every(r=>Object.keys(r).every(k=>['line','result','kind'].includes(k))),'틀에는 줄 · 결과 · 종류만 넘긴다');
 check(out?.lines?.n===3,'말한 줄 수는 그대로',JSON.stringify(out?.lines));check(reads===1,'한 번에 읽음',String(reads));}
{const {out,reads}=await episode({complete:350});
 check(same(out?.results,EXPECT1),'기록 직후 「덜 읽힘」이면 1초 안에서 다시 읽는다',`읽은 횟수 ${reads}`);}
{const {out}=await episode({complete:5000});
 check(out?.status==='wrap'&&same(out.results,[]),'1초 넘게 덜 읽히면 빈 배열(1차 그대로)',JSON.stringify(out?.results));}
{const {out,reads}=await episode({events:null});
 check(out?.status==='wrap'&&same(out.results,[])&&reads===1,'학습 기록을 못 읽으면 빈 배열');}
{const {out,reads}=await episode({before:()=>{window.__st.owner='acc-2';}});
 check(out?.status==='wrap'&&same(out.results,[])&&reads===0,'연 뒤 주인이 바뀌면 읽지 않는다',`읽은 횟수 ${reads}`);}
{const {out,reads}=await episode({owner:null});
 check(out?.status==='wrap'&&same(out.results,[])&&reads===0,'손님은 부르지 않는다',`읽은 횟수 ${reads}`);}
{const {out}=await episode({steps:[['wrap',W1],['restart'],['wrap',W2]]});
 check(same(out?.results,EXPECT2),'한 패널 두 판: 둘째 판(첫 완주 뒤)만 센다',JSON.stringify(out?.results));}
{const {out}=await episode({events:GAP,steps:[['wrap',W1],['restart'],['wrap',W2]]});
 check(same(out?.results,EXPECT2.slice(0,2)),'둘째 판에 기록이 빠진 줄은 첫 판 결과를 끌어오지 않는다',JSON.stringify(out?.results));}
{const {out}=await episode({events:HALF,steps:[['wrap',W1],['restart']]});
 check(same(out?.results,EXPECT1),'둘째 판 중간에 닫으면 첫 판의 결과',JSON.stringify(out?.results));}
{const page=await fresh();await setup(page,{owner:'acc-1',arrival:ARRIVAL});await page.evaluate(()=>{window.__seoul.run();});
 await page.waitForFunction(()=>!!window.SYNKSeoulHost,null,{timeout:20000});
 await page.evaluate(()=>{window.__ev=()=>({events:[],evidenceComplete:true});window.__out=null;window.SYNKSeoulHost.openEpisode({}).then(o=>{window.__out=o;});});
 await page.waitForFunction(()=>!!document.querySelector('#panel-content .game-frame'),null,{timeout:10000});await sleep(300);
 await page.evaluate(()=>window.__panel.close());await page.waitForFunction(()=>!!window.__out,null,{timeout:5000}).catch(()=>{});
 const out=await page.evaluate(()=>({out:window.__out,reads:window.__st.evReads}));
 check(out.out?.status==='closed'&&out.reads===0,'끝내지 않고 닫으면 읽지 않는다');await page.close();}

await browser.close();server.kill();
console.log(fail.length?`실패 ${fail.length}건: ${fail.join(' / ')}`:'모두 통과');
process.exit(fail.length?1:0);
