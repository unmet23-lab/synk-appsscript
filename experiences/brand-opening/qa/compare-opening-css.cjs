// 옛 · 새 opening.css가 지금 첫 화면에 주는 차이를 계산 스타일로 대조한다(11-02 옛 타이틀 CSS 걷기 판에서 만듦).
//   git show HEAD:experiences/brand-opening/opening.css > <옛 css>
//   node experiences/brand-opening/qa/compare-opening-css.cjs <옛 css> <새 css> [결과 json]
// 라이브 /world에서 단계(회사 화면 · 타이틀)에 닿는 프레임의 문서 전체를 떠 두고, JS를 끈 정적 페이지에 그 문서를 놓아
// opening.css <link>만 같은 자리의 <style>로 바꿔 끼운 뒤 모든 요소(::before · ::after 포함)의 계산 스타일을 견준다.
// 라이브 페이지에 CSS를 끼워 재면 글꼴 도착 · 단계 전환 시점 때문에 판마다 흔들리고, setContent 문서의 요청은 page.route가 못 잡는다
// (docs/현장노트/시험_화면확인.md). 같은 옛 CSS를 한 번 더 그린 대조군 흔들림과 「CSS 먹음」(opening.css만 주는 글꼴 이름)을 함께 센다.
const path=require('node:path'),fs=require('node:fs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(__dirname,'../../../node_modules/playwright')));}
const [oldCss,newCss]=[process.argv[2],process.argv[3]].map(p=>fs.readFileSync(p,'utf8'));
const out=process.argv[4]||null;
const base='https://synk.im/world';
const SIZES=[
 {name:'phone-390',page:'mobile.html',viewport:{width:390,height:844},mobile:true},
 {name:'phone-360x600',page:'mobile.html',viewport:{width:360,height:600},mobile:true},
 {name:'phone-land-667',page:'mobile.html',viewport:{width:667,height:375},mobile:true},
 {name:'tablet-820',page:'mobile.html',viewport:{width:820,height:1180},mobile:true},
 {name:'pc-1440',page:'desktop.html',viewport:{width:1440,height:900}},
 {name:'pc-1024',page:'desktop.html',viewport:{width:1024,height:768}}
];
const contextFor=(browser,size,reduced,js)=>browser.newContext({viewport:size.viewport,deviceScaleFactor:size.mobile?2:1,isMobile:!!size.mobile,hasTouch:!!size.mobile,reducedMotion:reduced?'reduce':'no-preference',javaScriptEnabled:js});
async function capture(browser,size,reduced,stage){
 const context=await contextFor(browser,size,reduced,true),page=await context.newPage();
 await page.goto(`${base}/${size.page}?opening=replay&lang=ko`);
 const ok=await page.waitForFunction(s=>window.__synkOpening?.stage?.()===s,stage,{timeout:30000,polling:'raf'}).then(()=>true,()=>false);
 // 단계에 닿은 그 프레임의 문서(대화상자 속성 · 숨김 · 언어 · 동작 설정 포함)를 그대로 뜬다
 const html=ok?await page.evaluate(()=>'<!doctype html>'+document.documentElement.outerHTML):null;
 await context.close();return html;
}
async function render(browser,size,reduced,html,css){
 const context=await contextFor(browser,size,reduced,false),page=await context.newPage();
 await page.route('**/*.{mjs,js}*',route=>route.abort());
 // CSS 속 상대 주소(./assets/…)는 두 판 모두 같은 절대 주소로 바꾼다
 const inline=css.replace(/url\((['"]?)\.\/assets\//g,`url($1${base}/brand-opening/assets/`);
 const withBase=html.replace(/<head([^>]*)>/i,`<head$1><base href="${base}/">`);
 const doc=withBase.replace(/<link rel="stylesheet" href="[^"]*brand-opening\/opening\.css[^"]*">/,()=>`<style id="opening-css">${inline}</style>`);
 await page.goto(`${base}/__equiv__`).catch(()=>{});// 같은 주소에서 글꼴 · 그림을 받게 한 뒤 내용을 바꾼다
 await page.setContent(doc,{waitUntil:'load'});
 const {styles,applied}=await page.evaluate(async()=>{
  await document.fonts.ready;
  const root=document.querySelector('.synk-opening'),styles={};
  const applied=getComputedStyle(root).fontFamily.includes('OpeningCyrillic');
  for(const a of document.getAnimations()){try{a.pause();a.currentTime=0;}catch{}}
  [root,...root.querySelectorAll('*')].forEach((el,i)=>{for(const pseudo of [null,'::before','::after']){
   const cs=getComputedStyle(el,pseudo);if(pseudo&&cs.content==='none')continue;
   const o={};for(let k=0;k<cs.length;k++){const p=cs[k];o[p]=cs.getPropertyValue(p);}
   styles[`${i}:${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g,'.')}${pseudo||''}`]=o;
  }});
  return {styles,applied};
 });
 await context.close();return {applied:applied&&doc!==withBase,styles};
}
function diff(a,b){
 const list=[];
 for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
  if(!a[k]||!b[k]){list.push(`${k}: 요소 ${a[k]?'사라짐':'새로 생김'}`);continue;}
  for(const p of new Set([...Object.keys(a[k]),...Object.keys(b[k])]))if(a[k][p]!==b[k][p])list.push(`${k} ${p}: ${a[k][p]} → ${b[k][p]}`);
 }
 return list;
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}).catch(()=>chromium.launch({headless:true}));
 const report=[];let changedTotal=0,noiseTotal=0,missed=0,notApplied=0;
 for(const size of SIZES)for(const reduced of [false,true])for(const stage of ['company','title']){
  const label=`${size.name} · ${reduced?'동작 줄이기':'움직임'} · ${stage}`;
  const html=await capture(browser,size,reduced,stage);
  if(!html){missed++;report.push({label,missed:true});console.log(`${label}: 그 단계를 못 잡음`);continue;}
  const A=await render(browser,size,reduced,html,oldCss),B=await render(browser,size,reduced,html,newCss),C=await render(browser,size,reduced,html,oldCss);
  const noise=diff(A.styles,C.styles),changed=diff(A.styles,B.styles),applied=[A,B,C].map(r=>r.applied);
  changedTotal+=changed.length;noiseTotal+=noise.length;notApplied+=applied.filter(x=>!x).length;
  report.push({label,elements:Object.keys(A.styles).length,noise,changed,applied});
  console.log(`${label}: 요소 ${Object.keys(A.styles).length}개 · 대조군 흔들림 ${noise.length} · 옛↔새 달라짐 ${changed.length} · CSS 먹음 ${applied.map(x=>x?'○':'×').join('')}`);
  for(const l of changed.slice(0,8))console.log('   ',l.slice(0,220));
 }
 await browser.close();
 if(out)fs.writeFileSync(out,JSON.stringify(report,null,1));
 console.log(`합계: 옛↔새 달라짐 ${changedTotal} · 대조군 흔들림 ${noiseTotal} · 못 잡은 단계 ${missed} · CSS가 안 먹은 그림 ${notApplied}`);
 if(missed||notApplied)process.exitCode=2;
})().catch(e=>{console.error(e);process.exit(1);});
