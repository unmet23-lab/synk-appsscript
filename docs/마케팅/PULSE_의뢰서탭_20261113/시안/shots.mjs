// 의뢰서 탭 시안 캡처 — 바꾸기 전 · 후를 PC와 휴대폰(390×844)으로 찍는다. 서버(serve.mjs 4871)가 떠 있어야 한다.
//   node shots.mjs [이름 일부…]     보여 드릴 그림(PC 1680×970 — 1080p 모니터의 브라우저 창 크기)
//   node shots.mjs 재기              작은 노트북 창(1440×900)에서 물음 칸이 얼마나 넘치는지만 잰다
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url)),out=path.join(here,'shots');
fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4871';
const pc={width:1680,height:970},small={width:1440,height:900},phone={width:390,height:844};
const set=o=>`&set=${encodeURIComponent(JSON.stringify(o))}`;
const laugh=[['win','laugh'],['bold','twist']],liquor=[['notice','주류']],narr=[['voice','narration']];
// 글자 화면은 화장품 예로 찍는다(음료 예에 「주류」를 고른 그림은 헷갈린다).
const beautyAnswers={name:'서리결 홀리데이 기프트',screenText:'겨울 한정 기프트 세트\n12월 1일 출시',audience:'연말 선물을 고르는 30대',oneThing:'눈 결정처럼 녹아드는 크림'};
const cosmetic=[['notice','기능성 화장품']],beauty=set(beautyAnswers);
const scenes=[
  {name:'feel-before-pc',side:'before',q:'step=feel',view:pc},
  {name:'feel-after-pc',side:'after',q:'step=feel',view:pc,clicks:laugh,film:7.6},
  {name:'words-before-pc',side:'before',q:'step=words&kind=beauty'+beauty,view:pc},
  {name:'words-after-pc',side:'after',q:'step=words&kind=beauty'+beauty,view:pc,clicks:cosmetic,scroll:'[data-notice-more]',block:'end'},
  {name:'model-after-pc',side:'after',q:'step=model',view:pc,clicks:narr},
  {name:'files-after-pc',side:'after',q:'step=files',view:pc,scroll:'[data-slot="sound"]',block:'center'},
  {name:'review-after-pc',side:'after',q:'step=review&kind=beauty'+set({...beautyAnswers,win:'laugh',bold:'twist',notice:'기능성 화장품',voice:'narration',modelChoice:'ask'}),view:pc,scroll:'.sx-brief-row:nth-child(12)',block:'center'},
  {name:'feel-after-phone-top',side:'after',q:'step=feel',view:phone,clicks:laugh,film:7.6,top:true},
  {name:'feel-after-phone',side:'after',q:'step=feel',view:phone,clicks:laugh,scroll:'[data-do="bold"]',block:'center'},
  {name:'words-after-phone',side:'after',q:'step=words&kind=beauty'+beauty,view:phone,clicks:cosmetic,scroll:'[data-notice-more]',block:'center'},
  {name:'model-after-phone',side:'after',q:'step=model',view:phone,clicks:narr,scroll:'[data-do="voice"]',block:'center'},
];
const measures=['feel','words','model','files'].flatMap(step=>[{name:`${step}-before`,side:'before',q:`step=${step}`,view:small},{name:`${step}-after`,side:'after',q:`step=${step}`,view:small},
  {name:`${step}-after-picked`,side:'after',q:`step=${step}`,view:small,clicks:step==='feel'?laugh:step==='words'?liquor:step==='model'?narr:[]}]);
const want=process.argv.slice(2),onlyMeasure=want[0]==='재기';
// 이 PC에 깔린 Edge를 쓴다(Playwright 전용 브라우저를 새로 내려받지 않는다 — 현장 노트 「시험 · 화면 확인」).
const browser=await chromium.launch({channel:'msedge'});
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;for(let i=0;i<3;i++){document.getAnimations().forEach(a=>{try{a.finish();}catch{}});await new Promise(r=>setTimeout(r,120));}});
for(const s of onlyMeasure?measures:scenes){
  if(!onlyMeasure&&want.length&&!want.some(w=>s.name.includes(w)))continue;
  const isPhone=s.view===phone;
  const ctx=await browser.newContext({viewport:s.view,deviceScaleFactor:isPhone?3:2,locale:'ko-KR',colorScheme:'dark',isMobile:isPhone,hasTouch:isPhone});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message).slice(0,160)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,160));});
  await page.goto(`${base}/${s.side}/harness.html?${s.q}`,{waitUntil:'networkidle'});
  await page.waitForSelector('[data-ask] [data-title]');
  await settle(page);
  for(const [what,id] of s.clicks||[]){await page.click(`[data-do="${what}"][data-id="${id}"]`);await settle(page);}
  if(s.film!=null){await page.evaluate(async at=>{const v=document.querySelector('[data-win-film]');if(!v)return;v.pause();if(v.readyState<2)await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));v.currentTime=at;await new Promise(r=>v.addEventListener('seeked',r,{once:true}));},s.film);}
  if(s.scroll)await page.evaluate(([sel,block])=>document.querySelector(sel)?.scrollIntoView({block}),[s.scroll,s.block||'center']);
  if(s.top)await page.evaluate(()=>{scrollTo(0,0);for(const el of document.querySelectorAll('.sx-q,.sx-q-stage,.sx-q-ask'))el.scrollTop=0;});
  await settle(page);await page.waitForTimeout(250);
  // 물음 칸이 창에 다 들어오는지: 스크롤이 생기는 상자를 찾아 넘친 높이를 잰다(PC는 물음 칸, 휴대폰은 화면 전체).
  const info=await page.evaluate(()=>{const over=el=>el?Math.max(0,el.scrollHeight-el.clientHeight):0;return {x:document.documentElement.scrollWidth-innerWidth,ask:Math.max(over(document.querySelector('.sx-q-ask')),over(document.querySelector('.sx-q-form'))),page:over(document.scrollingElement)};});
  if(!onlyMeasure)await page.screenshot({path:path.join(out,`${s.name}.png`),fullPage:false});
  console.log(s.name.padEnd(26),'가로 넘침',info.x,'· 물음 칸 넘침',info.ask,'· 쪽 넘침',info.page,errors.length?'· 오류 '+errors.join(' | '):'· 오류 0');
  await ctx.close();
}
await browser.close();
