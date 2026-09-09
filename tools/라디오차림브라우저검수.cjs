'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const deps=createRequire('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const {chromium}=deps('playwright'),sharp=deps('sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/_ops/의상라디오검수_20260909/브라우저');
const base='http://localhost:8765/',route='bots/오버레이/마스코트.html?검수=1&무대=1&밤=0&자리=중하&크기=.32&DJ=';
const all=process.argv.includes('--전량');
const mandatory=['기본','깜빡','눈웃음','궁금함','집중','안도','응원','놀람'];
async function shot(page,name){return page.screenshot({path:path.join(out,name)});}
async function pixels(page){return page.evaluate(()=>{
 const state=window.마스코트상태();const visible=[...document.querySelectorAll('#마스코트틀 img')].filter(i=>!i.hidden&&getComputedStyle(i).display!=='none');
 return {state,visible:visible.map(i=>{const s=getComputedStyle(i),b=i.getBoundingClientRect();return{src:decodeURIComponent(i.src),w:i.naturalWidth,h:i.naturalHeight,box:{x:b.x,y:b.y,w:b.width,h:b.height},transform:s.transform,filter:s.filter,blend:s.mixBlendMode,opacity:s.opacity};})};
});}
async function main(){
 fs.mkdirSync(out,{recursive:true});const errors=[],checks=[],motion=[];
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'reduce'});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const page=await context.newPage();
 for(const DJ of ['몽글','마린','까몽']){
  await page.goto(base+route+encodeURIComponent(DJ));await page.waitForFunction(()=>window.마스코트상태?.().준비);
  for(const exp of [...mandatory,...(DJ==='마린'?['인사']:[])]){
   await page.evaluate(x=>window.마스코트검수표정(x),exp);const p=await pixels(page);assert.equal(p.state.DJ,DJ);assert.equal(p.state.표정,exp);assert.equal(p.visible.length,1);
   assert.equal(p.visible[0].filter,'none');assert.equal(p.visible[0].blend,'normal');checks.push({type:'base',DJ,exp,...p});
  }
  await page.evaluate(()=>window.마스코트검수표정('기본'));await shot(page,DJ+'_기본.png');
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/Loom_자산/라디오차림/목록.json'),'utf8'));
 let pairs=Object.entries(manifest.캐릭터.까몽.차림).filter(([,x])=>x.상태==='검수후보'&&x.의상&&x.악세);
 if(all)assert.equal(pairs.length,108,'전량 검사는 108짝이 전부 준비돼야 시작한다');
 if(!all)pairs=pairs.filter(([key])=>key==='여름델+전설의팻말');
 if(!all)assert.equal(pairs.length,1,'대표 검사는 여름델+전설의팻말 후보 1짝이 준비돼야 시작한다');
 const transforms=new Set();
 for(const [key,item]of pairs){
  await page.evaluate(()=>window.마스코트검수표정(null));
  await page.evaluate(x=>window.마스코트차림(x),{DJ:'까몽',의상:item.의상,악세:item.악세});
  for(const exp of mandatory){
   await page.evaluate(x=>window.마스코트검수표정(x),exp);const p=await pixels(page);assert.equal(p.state.차림.키,key);assert.equal(p.state.표정,exp);assert.equal(p.visible.length,1);
   assert.ok(p.visible[0].src.endsWith(item.표정[exp]));assert.equal(p.visible[0].w,1024);assert.equal(p.visible[0].h,1024);
   assert.equal(p.visible[0].filter,'none');assert.equal(p.visible[0].opacity,'1');assert.equal(p.visible[0].blend,'normal');
   assert.ok(Math.abs(p.visible[0].box.w-p.visible[0].box.h)<.001);assert.ok(p.state.활성이미지수<=8);assert.equal(p.state.보류이미지수,0);
   transforms.add(p.visible[0].transform);checks.push({type:'outfit',key,exp,...p});
  }
  if(key==='여름델+전설의팻말'){await shot(page,'까몽_통합후보.png');}
 }
 if(pairs.length){assert.equal(transforms.size,1,'same DJ must keep same frame transform for every outfit');
  const previous=(await pixels(page)).state.차림;
  for(const value of [{DJ:'마린',의상:'SYNK 후드',악세:'펠트 헤드폰'},{DJ:'몽글',의상:'SYNK 후드',악세:'펠트 헤드폰'},{DJ:'까몽',의상:'여름 델',악세:['펠트 헤드폰','안경']}]){
   const rejection=await page.evaluate(async value=>{try{await window.마스코트차림(value);return null;}catch(e){return e.code||e.message;}},value);assert.ok(rejection);assert.deepEqual((await pixels(page)).state.차림,previous);checks.push({type:'rejection',value,rejection});
  }
  await page.evaluate(()=>window.마스코트반응({종류:'결',결:'전자네온물가'}));await page.waitForTimeout(2500);assert.deepEqual((await pixels(page)).state.차림,previous);checks.push({type:'genre-preserves-choice'});
 }
 const sample=pairs.find(([key])=>key==='여름델+전설의팻말');
 if(sample){
  // 시계 제어는 같은 브라우저 문맥의 다른 페이지에도 적용된다. 이미 열린 재고 검수와 분리한다.
  const motionContext=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'no-preference'});
  motionContext.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const mp=await motionContext.newPage();
  // 앱이 시각을 읽기 전에 설치한다. 로드 뒤 설치하면 performance.now()가 역행한다.
  await mp.clock.install({time:Date.now()});
  await mp.goto(base+route+encodeURIComponent('까몽'));await mp.waitForFunction(()=>window.마스코트상태?.().준비);
  await mp.evaluate(x=>window.마스코트차림(x),{DJ:'까몽',의상:sample[1].의상,악세:sample[1].악세});
  await mp.clock.pauseAt(new Date(await mp.evaluate(()=>Date.now()+100)));
  for(const event of ['인사','정답','체크인','투표']){
   await mp.evaluate(e=>{window.마스코트검수표정(null);window.마스코트반응(e);},event);
   const tiles=[];
   for(let n=0;n<24;n++){
    await mp.clock.runFor(100);const p=await pixels(mp);assert.equal(p.visible.length,1);assert.equal(p.state.차림.키,sample[0]);
    const matrix=await mp.evaluate(()=>{const m=new DOMMatrix(getComputedStyle(document.getElementById('마스코트틀')).transform);return{sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d)};});assert.ok(Math.abs(matrix.sx-matrix.sy)<.0001);
    motion.push({event,ms:(n+1)*100,...p,matrix});
    if(n<12){const png=await mp.screenshot();tiles.push({input:await sharp(png).extract({left:540,top:270,width:840,height:810}).resize(280,270).png().toBuffer(),left:(n%4)*280,top:Math.floor(n/4)*270});}
   }
   await sharp({create:{width:1120,height:810,channels:4,background:'#080605'}}).composite(tiles).png().toFile(path.join(out,'동작_'+event+'.png'));
   await mp.clock.runFor(1000);
  }
  await motionContext.close();
 }
 const viewer=await context.newPage();await viewer.setViewportSize({width:1280,height:1000});
 await viewer.goto(base+'docs/_ops/의상라디오검수_20260909/검수보기.html');
 const viewerReady=DJ=>viewer.waitForFunction(DJ=>{const s=document.getElementById('runtime').contentWindow.마스코트상태?.();return s?.준비&&s.DJ===DJ;},DJ);
 await viewerReady('까몽');
 await viewer.getByLabel('의상 1벌').selectOption('앞치마');await viewer.getByLabel('악세 1개').selectOption('한 달 출석 새싹');
 await viewer.getByRole('button',{name:'입히기',exact:true}).click();
 await viewer.waitForFunction(()=>document.getElementById('runtime').contentWindow.마스코트상태?.().차림?.키==='앞치마+한달출석새싹');
 await viewer.getByRole('button',{name:'눈웃음',exact:true}).click();
 await viewer.waitForFunction(()=>document.getElementById('runtime').contentWindow.마스코트상태?.().표정==='눈웃음');
 checks.push({type:'viewer-select-and-expression',key:'앞치마+한달출석새싹'});
 for(const DJ of ['몽글','마린']){
  await viewer.getByRole('button',{name:DJ,exact:true}).click();await viewerReady(DJ);
  await viewer.getByRole('button',{name:'입히기',exact:true}).click();
  await viewer.waitForFunction(()=>document.getElementById('notice').textContent.includes('적용하지 않았습니다'));
  const state=await viewer.evaluate(()=>document.getElementById('runtime').contentWindow.마스코트상태());assert.equal(state.DJ,DJ);assert.equal(state.차림.의상,null);assert.equal(state.차림.악세,null);
  checks.push({type:'viewer-missing-set-rejected',DJ});
 }
 await viewer.getByRole('button',{name:'까몽',exact:true}).click();await viewerReady('까몽');await shot(viewer,'검수보기_1280.png');
 await viewer.setViewportSize({width:390,height:844});await shot(viewer,'검수보기_390.png');
 const overflow=await viewer.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 assert.deepEqual(errors,[]);const result={createdAt:new Date().toISOString(),scope:'Local Chromium, not deployed broadcast/OBS/Skia.',allRequested:all,baseChecks:checks.filter(x=>x.type==='base').length,pairsChecked:pairs.length,outfitExpressionChecks:checks.filter(x=>x.type==='outfit').length,motionSamples:motion.length,errors,overflow,checks,motion};
 result.head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 result.sourceHashes=Object.fromEntries(['bots/오버레이/마스코트.html','bots/오버레이/라디오표정리듬.js','tools/lib/옷목록.js','tools/라디오차림브라우저검수.cjs','docs/Loom_자산/라디오차림/목록.json'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
 fs.writeFileSync(path.join(out,all?'전량검사.json':'대표검사.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({pairs:pairs.length,expressions:result.outfitExpressionChecks,motion:motion.length,errors,overflow}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
