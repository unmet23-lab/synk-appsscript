'use strict';
// 주문 폭주 원본과 SNS 키트 시안을 같은 순서로 조작해 같은 장면을 찍는다(2026-10-02).
// 쓰는 법: 원본 서버(PORT=5223 node experiences/order-rush/server.mjs)와 시안 서버(node docs/디자인/앱시안_20261002/order-rush-kit/server.mjs)를 켠 뒤
//   node docs/디자인/앱시안_20261002/order-rush-kit/비교/찍기.cjs
// 따로 띄운 브라우저 프로필을 쓴다(사용자 브라우저를 읽거나 바꾸지 않는다). 소리는 끈 채 실제로 재생해 '들었어요' 상태를 만든다.
const path=require('node:path'),fs=require('node:fs');
const NM=process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=require(require.resolve('playwright',{paths:[NM]}));
const RAW=path.join(__dirname,'_raw');fs.mkdirSync(RAW,{recursive:true});
const TARGETS={before:process.env.BEFORE||'http://127.0.0.1:5223/',after:process.env.AFTER||'http://127.0.0.1:5243/'};
const VIEWS={mobile:{viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true},desktop:{viewport:{width:1440,height:900},deviceScaleFactor:1}};
const KEY={coffee:'1',tea:'2',milk:'3',ice:'4',sugar:'5',cold:'6'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// 주문 조건 → 키 순서(컵은 기본 따뜻함, 얼음을 넣으면 차가워짐, 얼음 없이 차갑게는 6)
function keysFor(order){const out=[];order.cups.forEach((c,i)=>{if(i)out.push('q');out.push(KEY[c.base]);if(c.milk)out.push(KEY.milk);if(c.ice)out.push(KEY.ice);else if(c.temp==='cold')out.push(KEY.cold);if(c.sugar)out.push(KEY.sugar);});return out;}
// 두 재료가 든 '아직 틀린' 컵: 음료 + 온도를 거꾸로 만드는 재료
function wrongPair(order){const c=order.cups[0];return [KEY[c.base],c.temp==='hot'?KEY.ice:(c.milk?KEY.sugar:KEY.milk)];}

async function heard(page){await page.waitForFunction(()=>window.synkCafe?.current?.audioCompleted===true,null,{timeout:20000});await sleep(250);}
async function currentOrder(page){return page.evaluate(async()=>{const {ORDERS,REVIEW}=await import(new URL('core.mjs',location.href).href);const id=window.synkCafe.current.id;return [...ORDERS,...REVIEW].find(o=>o.id===id);});}
async function press(page,keys){for(const k of keys){await page.keyboard.press(k===' '?'Space':k);await sleep(140);}}
// 서빙 축하는 850ms 뒤 저절로 닫힌다. 찍는 동안만 그 타이머를 붙잡아 두었다가 찍은 뒤 이어 간다(게임 코드는 바꾸지 않는다)
async function holdCelebration(page){await page.evaluate(()=>{const o=window.setTimeout;window.setTimeout=function(f,ms,...a){if(ms===850||ms===300){window.__release=()=>{window.setTimeout=o;f();};return 0;}return o(f,ms,...a);};});}

async function run(browser,name,url,viewName){
 const context=await browser.newContext({...VIEWS[viewName],reducedMotion:'no-preference'});
 const page=await context.newPage(),errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 const shot=async(state)=>{const f=path.join(RAW,`${viewName}_${name}_${state}.png`);await page.screenshot({path:f});return f;};
 const layout=async()=>page.evaluate(()=>({scrollW:document.documentElement.scrollWidth,innerW:innerWidth,vv:visualViewport?.width,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)}));
 const info={target:name,view:viewName,url,checks:{}};
 await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await sleep(1400);
 info.checks.lobby=await layout();await shot('a_lobby');
 await page.click('#start');await heard(page);
 const order=await currentOrder(page);info.order=order.id;
 await page.click('#show-text');await press(page,wrongPair(order));await sleep(500);
 info.checks.play=await layout();await shot('b_play');
 await press(page,[' ']);await sleep(800);await shot('e_wrong');
 info.wrongText=await page.locator('#feedback').innerText();
 await press(page,['Backspace']);if(order.cups.length>1)await press(page,['Backspace']);
 await press(page,keysFor(order));await holdCelebration(page);await press(page,[' ']);await sleep(620);await shot('c_served');
 await page.evaluate(()=>window.__release?.());
 // 두 주문을 더 맞게 서빙한 뒤 영업을 마친다
 for(let i=0;i<2;i++){await heard(page);const o=await currentOrder(page);await press(page,keysFor(o));await press(page,[' ']);await page.waitForFunction(id=>window.synkCafe.current?.id!==id,o.id,{timeout:5000});}
 await heard(page);await page.click('#finish');await page.waitForSelector('#results:not([hidden])');await sleep(1500);
 info.checks.results=await layout();await shot('d_results');
 info.score=await page.locator('#result-metrics>div:first-child b').innerText();
 info.errors=errors;info.warnings=warnings.filter(w=>!/GPU stall|GroupMarkerNotSet/.test(w));
 await context.close();return info;
}

(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--mute-audio','--enable-unsafe-swiftshader']});
 const report=[];
 try{for(const viewName of Object.keys(VIEWS))for(const [name,url] of Object.entries(TARGETS))report.push(await run(browser,name,url,viewName));}
 finally{await browser.close();}
 fs.writeFileSync(path.join(__dirname,'찍기_결과.json'),JSON.stringify(report,null,1)+'\n');
 console.log(JSON.stringify(report.map(r=>({t:r.target,v:r.view,order:r.order,score:r.score,wrong:r.wrongText,errors:r.errors.length,overflow:Object.fromEntries(Object.entries(r.checks).map(([k,c])=>[k,c.scrollW>c.innerW||c.innerW>Math.ceil(c.vv||c.innerW)]))})),null,1));
})().catch(e=>{console.error(e);process.exitCode=1;});
