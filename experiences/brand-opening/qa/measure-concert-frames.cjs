// 펠트 안녕 콘서트 타이틀(11-02) 캔버스 부하 대리 측정: CPU 감속(1 · 4 · 6배)에서 타이틀이 도는 동안 프레임당 주 스레드 일 · 프레임 간격 · 긴 작업을 잰다.
//   node experiences/brand-opening/qa/measure-concert-frames.cjs [--base=<주소>] [--seconds=10] [--repeat=3] [--out=<폴더>]
// 기본 주소는 라이브 https://synk.im/world. CPU 감속은 주 스레드만 느리게 하고 화면 그리기(GPU)는 이 PC 그대로라, 실제 중저가 휴대폰을 대신하지 못하는 대리 값이다.
// headless 크롬은 rAF가 화면 주사율에 묶이지 않아 초당 200번 넘게 돈다 — 초당 일 비율은 부풀어 나오므로 프레임당 ms를 60Hz 16.7ms · 120Hz 8.3ms와 견준다.
// 같은 PC의 다른 작업이 값을 흔들어(11-02 첫 두 번: 4배 3.0 · 5.6ms) 판마다 repeat번 재 가운데 값과 폭을 쓴다.
const path=require('node:path'),fs=require('node:fs');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(__dirname,'../../../node_modules/playwright')));}
const arg=(k,d)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)||d;
const base=arg('base','https://synk.im/world'),seconds=Number(arg('seconds','10')),repeat=Number(arg('repeat','3')),out=arg('out',path.join(__dirname,'concert-frames-20261102'));
// 휴대폰은 화소 비 3(요즘 중저가 안드로이드의 2.6~3 가운데 무거운 쪽), 컴퓨터는 1440 · 1배. 동작 줄이기는 캔버스를 그리지 않는 판이라 캔버스 몫을 가르는 바탕값이다.
const CASES=[
 ...[1,4,6].map(rate=>({name:`phone-390 · CPU ${rate}배`,page:'mobile.html',viewport:{width:390,height:844},scale:3,mobile:true,rate})),
 {name:'phone-390 · CPU 4배 · 동작 줄이기',page:'mobile.html',viewport:{width:390,height:844},scale:3,mobile:true,rate:4,reduced:true},
 ...[1,4].map(rate=>({name:`pc-1440 · CPU ${rate}배`,page:'desktop.html',viewport:{width:1440,height:900},scale:1,rate}))
];
async function measure(page,cdp,ms){
 const metric=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const before=await metric();
 const frames=await page.evaluate(async ms=>{
  const gaps=[];let long=0,longMs=0;
  const obs=new PerformanceObserver(list=>{for(const e of list.getEntries()){long++;longMs+=e.duration;}});
  try{obs.observe({type:'longtask'});}catch{/* 긴 작업 관찰을 못 하는 브라우저 */}
  // 간격은 rAF 시각끼리만 잰다 — 첫 rAF 시각과 performance.now()를 빼면 감속 판에서 1,039,842ms 같은 헛값이 나왔다(11-02).
  let last=0,end=0;
  await new Promise(done=>{const tick=now=>{if(!end){last=now;end=now+ms;}else{gaps.push(now-last);last=now;}if(now<end)requestAnimationFrame(tick);else done();};requestAnimationFrame(tick);});
  obs.disconnect();
  const s=[...gaps].sort((a,b)=>a-b),q=p=>s[Math.min(s.length-1,Math.floor(p*s.length))];
  return {frames:gaps.length,fps:gaps.length/(ms/1000),p95:q(.95),max:s[s.length-1],over34:gaps.filter(g=>g>34).length/gaps.length,long,longMs,moving:window.__synkOpening.sceneStatus().moving};
 },ms);
 const after=await metric();
 const task=after.TaskDuration-before.TaskDuration,script=after.ScriptDuration-before.ScriptDuration;
 return {...frames,perFrame:task*1000/frames.frames,scriptPerFrame:script*1000/frames.frames};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true}).catch(()=>chromium.launch({headless:true}));
 const rows=[];let gpu=null;
 for(const c of CASES){
  const runs=[];
  for(let i=0;i<repeat;i++){
   const context=await browser.newContext({viewport:c.viewport,deviceScaleFactor:c.scale,isMobile:Boolean(c.mobile),hasTouch:Boolean(c.mobile),reducedMotion:c.reduced?'reduce':'no-preference'});
   const page=await context.newPage();const cdp=await context.newCDPSession(page);
   await cdp.send('Performance.enable');await cdp.send('Emulation.setCPUThrottlingRate',{rate:c.rate});
   await page.goto(`${base}/${c.page}?opening=replay&lang=ko`);
   await page.waitForFunction(()=>window.__synkOpening?.stage?.()==='title',null,{timeout:90000});
   await page.waitForFunction(()=>window.__synkOpening.sceneStatus().loaded,null,{timeout:90000});
   await page.waitForTimeout(2500);// 들어오는 움직임(로고 1초 · 글 1.2초 남짓)이 끝난 뒤 늘 도는 판을 잰다
   gpu??=await page.evaluate(()=>{try{const gl=document.createElement('canvas').getContext('webgl'),info=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(info?info.UNMASKED_RENDERER_WEBGL:gl.RENDERER);}catch{return null;}});
   runs.push(await measure(page,cdp,seconds*1000));
   await context.close();
  }
  const mid=k=>{const s=runs.map(r=>r[k]).sort((a,b)=>a-b);return s[Math.floor(s.length/2)];},per=runs.map(r=>r.perFrame);
  const r={name:c.name,perFrame:mid('perFrame'),low:Math.min(...per),high:Math.max(...per),scriptPerFrame:mid('scriptPerFrame'),fps:mid('fps'),p95:mid('p95'),max:mid('max'),over34:mid('over34'),long:mid('long'),moving:runs.every(x=>x.moving),runs};
  rows.push(r);
  console.log(`${c.name}: 프레임당 주 스레드 일 가운데 ${r.perFrame.toFixed(2)}ms(${repeat}번 ${r.low.toFixed(2)}~${r.high.toFixed(2)} · 스크립트 ${r.scriptPerFrame.toFixed(2)}ms) · rAF ${r.fps.toFixed(0)}회/초 · 간격 95% ${r.p95.toFixed(1)}ms · 최장 ${r.max.toFixed(0)}ms · 34ms 넘는 간격 ${(r.over34*100).toFixed(1)}% · 긴 작업 ${r.long}개 · 움직임 ${r.moving?'돎':'멈춤'}`);
 }
 await browser.close();
 {const on=rows.find(r=>r.name==='phone-390 · CPU 4배'),off=rows.find(r=>r.name==='phone-390 · CPU 4배 · 동작 줄이기');if(on&&off)console.log(`휴대폰 CPU 4배에서 캔버스 몫: 프레임당 ${(on.perFrame-off.perFrame).toFixed(2)}ms(동작 줄이기 판과의 가운데 값 차)`);}
 const file=path.join(out,'결과.json');fs.writeFileSync(file,JSON.stringify({at:new Date().toISOString(),base,seconds,repeat,gpu,rows},null,1));
 console.log(`GPU: ${gpu}\n결과: ${file}`);
})().catch(e=>{console.error(e);process.exit(1);});
