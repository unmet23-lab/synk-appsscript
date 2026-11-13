// 놓친 곳 카드 — 공개 후보를 실제 공개 WORLD 위에서 돌려 본다(2026-11-14): 브라우저 요청 가운데 synk.im/world/의 후보 파일만 후보 폴더에서 내주고
// 나머지는 지금 공개본 그대로(공개본은 바꾸지 않는다). 손님 기기 기록(synk.atlas.learning.*)에 시연 녹화의 입장 검사 근무 둘을 실제 엔진으로 심고,
// 배우기 → 내 위치를 열어 카드 줄을 읽고 390 · 1440 캡처를 남긴다. 후보 폴더 없이 부르면 공개본 그대로를 본다(공개 뒤 확인).
//   node experiences/synk-world-app/qa/놓친곳카드-20261114/후보시험.mjs [후보 폴더|-] [출력 폴더]
// SYNK_RECORD_VIDEO=1이면 창마다 화면 녹화(webm)를 출력 폴더에 남긴다 — 판을 연 뒤 카드까지 천천히 내려가 4초 머문다(시연 영상용).
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {worldLearning} from '../../world-learning-map.mjs';
import {caseMetadata} from '../../../entry-check/learning.mjs';
import {VENUES} from '../../../entry-check/content.mjs';
const require=createRequire(import.meta.url);
const shared='C:/Users/q1212/Documents/SYNK-appsscript/node_modules';
const {chromium}=require(require.resolve('playwright',{paths:[shared,path.resolve(import.meta.dirname,'../../../../node_modules')]}));
const DIR=process.argv[2]&&process.argv[2]!=='-'?path.resolve(process.argv[2]):null,OUT=path.resolve(process.argv[3]||path.join(import.meta.dirname,'캡처'));
fs.mkdirSync(OUT,{recursive:true});
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 시연 녹화 응답(입장 검사 캠퍼스 판 11-14 — tests/world-missed-spot.test.mjs RECORDED와 같다). 시각은 지금 기준 어제.
const RECORDED=[['pool-01 pass true 혼자','pool-02 pass false 혼자','pool-10 pass false 혼자','pool-13 pass true 혼자','pool-04 cap true 도움','pool-05 kid true 혼자'],
 ['library-01 pass true 혼자','library-02 card true 도움','library-10 pass true 혼자','library-03 pass true 혼자','library-06 food true 혼자']];
function seed(){
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const CASES=new Map(VENUES.flatMap(v=>v.cases.map(c=>[c.id,c]))),option=v=>v==='pass'?'pass':`reject-${v}`;
 let at=Date.now()-86400000;
 const game=worldLearning.engine.createGame({gameId:'entry-check',storage,clock:()=>new Date(at).toISOString()});
 RECORDED.forEach((lines,part)=>{if(part)at+=6*60000;for(const line of lines){const [id,picked,ok,how]=line.split(' '),c=CASES.get(id);
  at+=4000;const pid=game.present(caseMetadata(c));if(how==='도움')game.help(pid,'replay');at+=3000;
  game.answer(pid,{correct:ok==='true',assessable:true,choice:{selectedId:option(picked),correctId:option(c.answer)}});}});
 game.dispose?.();
 return Object.fromEntries(values);
}

async function run(view,seeded){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const record=process.env.SYNK_RECORD_VIDEO==='1';
 const ctx=await browser.newContext({viewport:view,deviceScaleFactor:2,reducedMotion:'reduce',...(record?{recordVideo:{dir:OUT,size:view}}:{})});
 await ctx.addInitScript(data=>{try{if(!sessionStorage.getItem('__seeded')){for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);sessionStorage.setItem('__seeded','1');}}catch{}},seeded);
 const page=await ctx.newPage();const errors=[],failed=[],fromCandidate=new Set();
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400&&!/\/api\//.test(r.url()))failed.push(`${r.status()} ${r.url()}`);});
 if(DIR)await page.route('https://synk.im/world/**',async route=>{
  const u=new URL(route.request().url()),rel=decodeURIComponent(u.pathname).replace(/^\//,''),file=path.join(DIR,rel);
  if(fs.existsSync(file)&&fs.statSync(file).isFile()){fromCandidate.add(rel);return route.fulfill({contentType:TYPES[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}
  return route.continue();
 });
 await page.goto('https://synk.im/world/mobile.html?opening=off&tutor=choose',{timeout:90000});
 const out={view:`${view.width}x${view.height}`};
 try{
  // 공개본 첫 실행: 튜터 고르기(1/2) → 함께하기 → 「우리 동네로 가기」 → 홈의 「내 위치 보기」.
  await page.locator('[data-tutor-id=mongle]').first().click({timeout:45000}).catch(()=>{});
  await page.getByRole('button',{name:/함께하기/}).click({timeout:30000});
  await page.getByRole('button',{name:'우리 동네로 가기'}).click({timeout:30000});
  await sleep(2500);
  await page.evaluate(()=>[...document.querySelectorAll('[data-view=position]')].find(b=>b.offsetParent)?.click());
  await page.waitForSelector('#panel-content [data-position-board]',{timeout:30000});await sleep(1200);
  out.card=await page.evaluate(()=>{const c=document.querySelector('#panel-content [data-position-missed]');if(!c)return null;
   return {skill:c.dataset.positionMissed,text:c.innerText.replace(/\s+/g,' ').trim(),steps:[...c.querySelectorAll('.wmis-again li')].map(li=>`${li.dataset.step}:${li.dataset.state}`),
    before:!!c.compareDocumentPosition(document.querySelector('#panel-content .wpos-group'))&Node.DOCUMENT_POSITION_FOLLOWING,
    attentionHasSame:!!document.querySelector(`#panel-content [data-position-attention] li[data-skill="${c.dataset.positionMissed}"]`),
    overflow:document.documentElement.scrollWidth>innerWidth+1,cardWidth:Math.round(c.getBoundingClientRect().width)};});
  if(out.card&&record){await sleep(1500);await page.evaluate(async()=>{const box=document.querySelector('#panel-content'),card=box?.querySelector('[data-position-missed]');if(!box||!card)return;const to=card.offsetTop-24,from=box.scrollTop;for(let i=1;i<=60;i++){box.scrollTop=from+(to-from)*i/60;await new Promise(r=>setTimeout(r,25));}});await sleep(4000);}
  if(out.card){await page.locator('#panel-content [data-position-missed]').scrollIntoViewIfNeeded();await sleep(500);
   await page.locator('#panel-content [data-position-missed]').screenshot({path:path.join(OUT,`카드-${view.width}.png`)});}
  await page.screenshot({path:path.join(OUT,`판-${view.width}.png`)});
 }catch(error){out.failure=String(error).slice(0,400);await page.screenshot({path:path.join(OUT,`실패-${view.width}.png`)}).catch(()=>{});}
 out.fromCandidate=[...fromCandidate];out.errors=errors.slice(0,12);out.failed=failed.slice(0,12);
 await browser.close();return out;
}
const seeded=seed();
const rows=[];for(const view of [{width:390,height:844},{width:1440,height:900}])rows.push(await run(view,seeded));
fs.writeFileSync(path.join(OUT,'결과.json'),JSON.stringify(rows,null,1));
console.log(JSON.stringify(rows,null,1));
