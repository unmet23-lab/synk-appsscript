// 펠트 안녕 콘서트 타이틀(11-02) 브라우저 확인: 여러 화면 크기에서 사진 · 글 자리 · 겹침 · 언어 단추 · 소리 · 누르기 · 움직임 줄이기를 본다.
//   node experiences/brand-opening/qa/verify-concert-title.cjs [--out=<폴더>]
// WORLD 개발 서버(experiences/synk-world-app/server.mjs)가 SYNK_OPENING_QA_URL(기본 http://127.0.0.1:64282)에서 떠 있어야 한다.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(__dirname,'../../../node_modules/playwright')));}
const base=process.env.SYNK_OPENING_QA_URL||'http://127.0.0.1:64282';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||path.join(__dirname,'concert-title-20261102');
const SIZES=[
 {name:'phone-390',page:'mobile.html',viewport:{width:390,height:844},mobile:true},
 {name:'phone-360',page:'mobile.html',viewport:{width:360,height:640},mobile:true},
 {name:'tablet-820',page:'mobile.html',viewport:{width:820,height:1180},mobile:true},
 {name:'phone-land-667',page:'mobile.html',viewport:{width:667,height:375},mobile:true},
 {name:'pc-1440',page:'desktop.html',viewport:{width:1440,height:900}},
 {name:'pc-1024',page:'desktop.html',viewport:{width:1024,height:768}},
 {name:'pc-1920',page:'desktop.html',viewport:{width:1920,height:1080}}
];
const results=[];let failures=0;
function check(size,name,ok,detail=''){results.push({size,name,ok:Boolean(ok),detail});if(!ok){failures++;console.log(`✗ ${size} · ${name} ${detail}`);}}
async function boxes(page){return page.evaluate(()=>{
 const pick=s=>{const e=document.querySelector(s);if(!e||e.hidden||getComputedStyle(e).display==='none')return null;const b=e.getBoundingClientRect();return {s,top:b.top,bottom:b.bottom,left:b.left,right:b.right,font:parseFloat(getComputedStyle(e).fontSize)};};
 return ['.concert-logo','.concert-world','.concert-line','.concert-start','.concert-lang','.opening-sound','.opening-copyright'].map(pick).filter(Boolean);
});}
async function toTitle(page){
 await page.waitForFunction(()=>window.__synkOpening?.stage?.()==='title',null,{timeout:15000});
 await page.waitForFunction(()=>window.__synkOpening.sceneStatus().loaded,null,{timeout:15000});
 await page.waitForTimeout(1900);
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true}).catch(()=>chromium.launch({headless:true}));
 for(const size of SIZES){
  const context=await browser.newContext({viewport:size.viewport,deviceScaleFactor:size.mobile?2:1,isMobile:Boolean(size.mobile),hasTouch:Boolean(size.mobile)});
  const page=await context.newPage();const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>failed.push(r.url()));
  await page.goto(`${base}/${size.page}?opening=replay&lang=ko`);
  // 회사 화면(2.6초) 동안 Tab: 아직 안 보이는 언어 단추로 초점이 가면 안 된다
  await page.waitForFunction(()=>window.__synkOpening?.stage?.()==='company',null,{timeout:8000}).catch(()=>{});
  await page.keyboard.press('Tab');
  check(size.name,'회사 화면의 Tab이 숨은 언어 단추로 가지 않는다',await page.evaluate(()=>!document.activeElement?.classList?.contains('concert-lang')));
  await toTitle(page);
  const status=await page.evaluate(()=>window.__synkOpening.sceneStatus());
  const land=size.viewport.width>size.viewport.height;
  check(size.name,'사진을 받았다',status.loaded,status.source);
  check(size.name,'화면 방향에 맞는 사진',land?/land/.test(status.layout):/port/.test(status.layout),status.layout);
  check(size.name,'움직임이 돈다',status.moving);
  const list=await boxes(page);const W=size.viewport.width,H=size.viewport.height;
  for(const b of list)check(size.name,`${b.s} 화면 안`,b.left>=-1&&b.top>=-1&&b.right<=W+1&&b.bottom<=H+1,JSON.stringify(b));
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const a=list[i],b=list[j];
   if((a.s==='.concert-logo'&&b.s==='.concert-world')||(a.s==='.concert-world'&&b.s==='.concert-logo'))continue;
   const hit=a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;check(size.name,`${a.s} × ${b.s} 안 겹침`,!hit);}
  for(const b of list)if(!['.opening-copyright','.concert-world'].includes(b.s))check(size.name,`${b.s} 글자 12px 이상`,!b.font||b.font>=12,String(b.font));
  {const lang=list.find(b=>b.s==='.concert-lang'),sound=list.find(b=>b.s==='.opening-sound');check(size.name,'언어 · 소리 알약 글자 크기가 같다',lang&&sound&&lang.font===sound.font,`${lang?.font} · ${sound?.font}`);}
  {const start=list.find(b=>b.s==='.concert-start');check(size.name,'시작 글자 상자가 화면 폭보다 좁다(초점 테두리가 안 잘림)',start&&start.left>=8&&start.right<=W-8,JSON.stringify(start));}
  {const mask=await page.evaluate(()=>{const g=document.querySelector('.concert-glow').getBoundingClientRect();const pct=parseFloat(getComputedStyle(document.querySelector('.opening-concert')).getPropertyValue('--concert-crowd'));return {line:g.top+g.height*pct/100};});check(size.name,'응원봉 마스크 줄이 관객 시작 줄과 맞는다',Math.abs(mask.line-status.crowd)<3,`${mask.line} · ${status.crowd}`);}
  if(land){const copy=list.find(b=>b.s==='.concert-logo');check(size.name,'가로: 로고가 펠트 글자 왼쪽',copy&&copy.right<status.letters.left-8,`${copy?.right} < ${status.letters.left}`);check(size.name,'가로: 펠트 글자가 화면 안',status.letters.right<=W+2,`${status.letters.right}`);}
  else{check(size.name,'세로: 펠트 글자가 화면 안',status.letters.left>=-2&&status.letters.right<=W+2,`${status.letters.left}~${status.letters.right}`);}
  await page.screenshot({path:path.join(out,`${size.name}.png`)});
  if(size.name==='phone-390'||size.name==='pc-1440'){
   check(size.name,'시작 단추 이름에 보이는 글이 들어 있다',/TO START/.test(await page.locator('.opening-enter').getAttribute('aria-label')||''));
   // 언어: 한국어 → English → Монгол → 한국어
   const line=()=>page.locator('.concert-line').textContent();
   await page.locator('.concert-lang').click();check(size.name,'언어 단추 → English',/international student/.test(await line()));
   await page.locator('.concert-lang').click();check(size.name,'언어 단추 → Монгол',/[Ѐ-ӿ]/.test(await line()));
   await page.screenshot({path:path.join(out,`${size.name}-mn.png`)});
   await page.locator('.concert-lang').click();check(size.name,'언어 단추 → 한국어',/유학생/.test(await line()));
   check(size.name,'언어를 바꿔도 타이틀에 머문다',await page.evaluate(()=>window.__synkOpening.stage())==='title');
   // 소리: 누르면 켜지고 게임은 시작하지 않는다
   await page.locator('.opening-sound').click();
   check(size.name,'소리 단추가 켜진다',await page.locator('.opening-sound').getAttribute('aria-pressed')==='true');
   check(size.name,'소리를 켜도 타이틀에 머문다',await page.evaluate(()=>window.__synkOpening.stage())==='title');
   await page.locator('.opening-sound').click();
   // 누르기: LET’S GO → 0.65초 뒤 들어간다
   await page.mouse.click(W/2,H*.5);await page.waitForTimeout(250);
   check(size.name,'누르면 LET’S GO',/LET/.test(await page.locator('.concert-start').textContent().catch(()=>'')));
   await page.screenshot({path:path.join(out,`${size.name}-tap.png`)});
   await page.waitForFunction(()=>!document.querySelector('.synk-opening'),null,{timeout:4000}).then(()=>check(size.name,'누른 뒤 타이틀이 닫힌다',true)).catch(()=>check(size.name,'누른 뒤 타이틀이 닫힌다',false));
  }
  check(size.name,'콘솔 · 페이지 오류 없음',!errors.length,errors.slice(0,3).join(' | '));
  check(size.name,'받기 실패 없음',!failed.filter(u=>/brand-opening/.test(u)).length,failed.slice(0,3).join(' | '));
  await context.close();
 }
 // 움직임 줄이기: 0.24초 뒤 타이틀, 캔버스 안 돌고, 누르면 바로 들어간다
 {const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'});const page=await context.newPage();
  await page.goto(`${base}/mobile.html?opening=replay&lang=ko`);await toTitle(page);
  const status=await page.evaluate(()=>window.__synkOpening.sceneStatus());check('reduced','움직임 줄이기면 캔버스가 멈춘다',!status.moving&&status.reduced);
  await page.screenshot({path:path.join(out,'reduced-390.png')});
  await page.mouse.click(195,420);await page.waitForFunction(()=>!document.querySelector('.synk-opening'),null,{timeout:1500}).then(()=>check('reduced','누르면 바로 들어간다',true)).catch(()=>check('reduced','누르면 바로 들어간다',false));
  await context.close();}
 await browser.close();
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({base,at:new Date().toISOString(),passed:results.filter(r=>r.ok).length,failed:failures,results},null,1));
 console.log(`확인 ${results.length}개 · 통과 ${results.length-failures} · 실패 ${failures} → ${out}`);
 process.exitCode=failures?1:0;
})().catch(error=>{console.error(error);process.exitCode=2;});
