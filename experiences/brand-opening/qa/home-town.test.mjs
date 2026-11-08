import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';
import os from 'node:os';

// 우리 동네(home-town.mjs)를 실제 그림·CSS로 띄워, 화면 크기마다 그림이 잘리지 않고 장소 이름표가 카드·화면 밖으로 숨지 않는지 본다.
// 계정·저장·네트워크는 쓰지 않는다. 이 저장소의 파일만 내준다.
const require=createRequire(import.meta.url);
const {chromium}=(()=>{try{return require('playwright');}catch{return require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}})();
// 이 PC는 Edge로, Linux CI는 러너에 깔린 Chrome으로 띄운다.
const channel=process.platform==='win32'?'msedge':'chrome';
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const types={'.css':'text/css; charset=utf-8','.webp':'image/webp','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8'};
let server,browser,base;
const fixture=`<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/experiences/brand-opening/home-town.css">
<style>:root{--w-sans:system-ui,sans-serif;--wt-strong:650;--wt-label:550;--w-blur:blur(12px);--w-ease:ease;--w-face:#FF6B5B;--w-on-face:#1E0E0A;--w-led-check:#F5C445;--w-led-ok:#7DB45A;--safe-top:0px;--safe-bottom:0px}html,body{margin:0;height:100%}main{position:relative;width:100vw;height:100vh;overflow:hidden}.lobby-action{position:absolute;left:12px;right:12px;bottom:88px;height:var(--card,200px);background:#111}[data-layout=landscape] .lobby-action{right:auto;width:44vw}.place-heading{position:absolute;top:92px;left:30px}.place-heading h1{margin:8px 0 0;font-size:34px;line-height:1.15}.place-heading p{margin:6px 0 0;font-size:14px;line-height:1.5}</style></head>
<body><div class="world-shell" data-place="town"><main><section class="town-scene"></section><div class="place-heading"><p>OUR TOWN</p><h1>우리 동네</h1><p>진도</p></div><div class="lobby-action"></div></main></div><script type="module">
import {createHomeTown,TOWN_PLACES} from '/experiences/brand-opening/home-town.mjs';
window.errors=[];window.addEventListener('error',e=>window.errors.push(e.message));
window.setup=({layout='portrait',card=200,progress=null}={})=>{
 document.documentElement.dataset.layout=layout;document.documentElement.style.setProperty('--card',card+'px');
 window.opened=[];
 window.town=createHomeTown({container:document.querySelector('.town-scene'),asset:p=>'/experiences/brand-opening/'+p,onPlace:place=>window.opened.push(place.id),obstacle:document.querySelector('.lobby-action'),heading:document.querySelector('.place-heading')});
 window.town.setLayout(layout);if(progress)window.town.setProgress(progress);
 return TOWN_PLACES.length;
};window.ready=true;
</script></body></html>`;
before(async()=>{
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://fixture.invalid');
  if(url.pathname==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);return;}
  const name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!name.startsWith(root+path.sep))throw Error('outside fixture');
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(await readFile(name));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel,headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function townPage(t,{width,height,query='',...options}){
 const context=await browser.newContext({viewport:{width,height}});t.after(()=>context.close());
 const page=await context.newPage();const failed=[];page.on('pageerror',e=>failed.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
 await page.goto(`${base}/fixture${query}`);await page.waitForFunction(()=>window.ready);
 await page.evaluate(options=>window.setup(options),options);
 await page.waitForFunction(()=>document.querySelector('.town-photo')?.complete&&document.querySelector('.town-photo').naturalWidth>0);
 t.after(()=>assert.deepEqual(failed,[],'no page error or missing file'));
 return page;
}
const geometry=page=>page.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 return {view:{width:innerWidth,height:innerHeight},frame:rect(document.querySelector('.town-frame')),fit:document.querySelector('.town-frame').dataset.fit,
  card:rect(document.querySelector('.lobby-action')),pins:[...document.querySelectorAll('.town-pin')].map(b=>({id:b.dataset.townPlace,...rect(b)}))};
});
function assertPinsVisible(g,{belowCard=false}={}){
 assert.equal(g.pins.length,7);
 for(const pin of g.pins){
  assert.ok(pin.left>=0&&pin.right<=g.view.width,`${pin.id} stays inside the screen horizontally`);
  assert.ok(pin.top>=0&&pin.bottom<=g.view.height,`${pin.id} stays inside the screen vertically`);
  assert.ok(pin.left>=g.frame.left-1&&pin.right<=g.frame.right+1&&pin.top>=g.frame.top-1&&pin.bottom<=g.frame.bottom+1,`${pin.id} sits on its picture`);
  if(belowCard)assert.ok(pin.bottom<=g.card.top,`${pin.id} is not covered by the card`);
 }
}

test('a tall phone shows the whole town at full width with every place above the card',async t=>{
 const page=await townPage(t,{width:390,height:844});const g=await geometry(page);
 assert.equal(g.fit,'full');assert.equal(Math.round(g.frame.width),390);assert.equal(Math.round(g.frame.left),0);
 assert.ok(g.frame.top>0&&g.frame.top<=56,'spare sky is split: the town moves down at most 56px instead of leaving one empty band');
 assertPinsVisible(g,{belowCard:true});
 const hint=await page.locator('.town-hint').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,visible:getComputedStyle(e).visibility==='visible'};});
 assert.ok(hint.visible&&hint.top>=g.frame.top+g.frame.height*.6&&hint.bottom<=g.card.top,'the first-visit hint sits between the town and the card');
});

test('a short phone keeps the full-width picture and moves the street label onto the road above the card',async t=>{
 for(const [width,height] of [[375,667],[360,640]]){
  const page=await townPage(t,{width,height});const g=await geometry(page);
  const metrics=await page.evaluate(()=>window.town.metrics());
  assert.equal(g.fit,'full',`${width}x${height} keeps the full width`);assert.equal(Math.round(g.frame.width),width);
  assert.equal(metrics.compact,true,'the crossing label moves to the road by the bus');
  assert.equal(await page.locator('[data-town-place=street]').evaluate(b=>b.style.top),'51%');
  assertPinsVisible(g,{belowCard:true});
 }
});

test('only a very small phone shrinks the picture, and then every place still clears the card',async t=>{
 const page=await townPage(t,{width:320,height:568});const g=await geometry(page);
 assert.equal(g.fit,'inset');
 assert.ok(g.frame.width<320&&g.frame.width>=320*.7,'the picture keeps most of the width');
 assert.ok(Math.abs((g.frame.left+g.frame.right)/2-160)<1,'the picture stays centred');
 assertPinsVisible(g,{belowCard:true});
});

test('landscape screens keep the whole picture: wide ones pin it right and fill the left, taller ones pin it to the bottom',async t=>{
 const wide=await townPage(t,{width:844,height:390,layout:'landscape'});let g=await geometry(wide);
 assert.equal(g.fit,'wide');assert.equal(Math.round(g.frame.right),844);assert.equal(Math.round(g.frame.height),390);assert.equal(Math.round(g.frame.top),0);
 assertPinsVisible(g);
 const home=g.pins.find(p=>p.id==='home');assert.ok(home.top>=70,'the house sits below the top bar');
 const tall=await townPage(t,{width:1280,height:800,layout:'landscape'});g=await geometry(tall);
 assert.equal(g.fit,'tall');assert.equal(Math.round(g.frame.width),1280);assert.equal(Math.round(g.frame.bottom),800);
 assertPinsVisible(g);
});

test('the image follows the chosen layout and the device clock, and the gaps take the picture edge colours',async t=>{
 const page=await townPage(t,{width:1280,height:800,layout:'portrait',query:'?townTime=night'});
 const state=await page.evaluate(()=>({src:document.querySelector('.town-photo').getAttribute('src'),time:document.documentElement.dataset.townTime,metrics:window.town.metrics()}));
 assert.match(state.src,/town-port-v1-night\.webp$/,'a portrait layout on a wide window still uses the portrait picture');
 assert.equal(state.time,'night');assert.equal(state.metrics.time,'night');
 await page.waitForFunction(()=>document.querySelector('.town-scene').style.background.includes('linear-gradient'));
});

test('places show progress, the next lesson is the one coral place, and a finished pack is checked',async t=>{
 const progress={status:{phase:'ready'},nextLesson:{packId:'store',label:'계산대 앞 세 마디'},packs:[{id:'greetings',completed:3,total:3},{id:'cafe',completed:2,total:7},{id:'store',completed:0,total:3},{id:'directions',completed:0,total:3},{id:'transit',completed:0,total:3},{id:'plans',completed:0,total:3}]};
 const page=await townPage(t,{width:1280,height:800,layout:'landscape',progress});
 const pins=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.town-pin')].map(b=>[b.dataset.townPlace,{state:b.dataset.state,label:b.getAttribute('aria-label'),title:b.title,name:b.querySelector('.town-pin-name').textContent,count:b.querySelector('.town-pin-count').textContent,check:!!b.querySelector('.town-pin-count svg')}])));
 assert.equal(pins.store.state,'now');assert.match(pins.store.label,/지금 할 차례 · 계산대 앞 세 마디/);
 assert.equal(pins.store.title,'지금 할 차례 · 계산대 앞 세 마디','the coral place names the same lesson the tutor card recommends');
 assert.equal(pins.clock.name,'시계탑','the clock building opens the appointments pack');assert.equal(pins.clock.title,'');
 assert.equal(Object.values(pins).filter(p=>p.state==='now').length,1);
 assert.equal(pins.friends.state,'done');assert.ok(pins.friends.check);assert.match(pins.friends.label,/모두 마침/);
 assert.equal(pins.cafe.state,'doing');assert.equal(pins.cafe.count,'2/7');
 assert.equal(pins.home.state,'door');assert.match(pins.home.label,/우리 집 들어가기/);
});

test('tapping a place or its building opens it once, closes the first-visit hint for good, and nothing opens while inactive',async t=>{
 const page=await townPage(t,{width:390,height:844});
 assert.equal(await page.locator('.town-hint').isVisible(),true);
 await page.locator('[data-town-place=cafe]').click();
 await page.locator('.town-area[data-town-area=store]').click({position:{x:4,y:4}});
 assert.deepEqual(await page.evaluate(()=>window.opened),['cafe','store']);
 assert.equal(await page.locator('.town-hint').isVisible(),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('synk.world.town.hint.v1')),'1');
 await page.evaluate(()=>window.town.setActive(false));
 assert.equal(await page.evaluate(()=>document.querySelector('.town-scene').inert),true);
 await page.locator('[data-town-place=bus]').dispatchEvent('click');
 assert.deepEqual(await page.evaluate(()=>window.opened),['cafe','store']);
});

// 11-08 프론트 검수: 영어 · 몽골어 넓은 화면에서 튜터 카드가 말이 길어 커지면서 장소 안내 띠와 제목 아랫줄을 가렸다.
test('on a wide screen the first-visit hint never meets the card, however tall the card grows',async t=>{
 for(const card of [200,330,430,490]){
  const page=await townPage(t,{width:1280,height:720,layout:'landscape',card});
  const box=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom};};const hint=document.querySelector('.town-hint');return {hint:rect(hint),visible:getComputedStyle(hint).visibility==='visible',card:rect(document.querySelector('.lobby-action'))};});
  assert.ok(box.visible,`card ${card}: 안내는 보인다`);
  const clear=box.hint.left>=box.card.right||box.hint.bottom<=box.card.top;
  assert.ok(clear,`card ${card}: 안내 띠(${JSON.stringify(box.hint)})가 카드(${JSON.stringify(box.card)})와 닿지 않는다`);
  assert.ok(box.hint.right<=1280,'화면 안');
 }
});

test('on a wide screen the heading gives way line by line when the card reaches it, and comes back when the card shrinks',async t=>{
 const page=await townPage(t,{width:1280,height:720,layout:'landscape',card:200});
 const heading=()=>page.locator('.place-heading').evaluate(e=>e.dataset.fit);
 const card=px=>page.evaluate(px=>document.documentElement.style.setProperty('--card',px+'px'),px);
 const until=want=>page.waitForFunction(want=>document.querySelector('.place-heading').dataset.fit===want,want);
 assert.equal(await heading(),'full','여유가 있으면 제목 줄이 다 보인다');
 // 화면 720 · 카드 바닥 632: 진도 줄 바닥 약 185 · 제목 바닥 약 150.
 await card(450);await until('title');
 await card(480);await until('compact');
 const lifted=await page.locator('.place-heading h1').evaluate(e=>{const r=e.getBoundingClientRect(),c=document.querySelector('.lobby-action').getBoundingClientRect();return {clear:r.bottom<=c.top,visible:getComputedStyle(e).opacity!=='0'};});
 assert.ok(lifted.clear&&lifted.visible,'카드가 제목에 닿으면 머리말 자리로 올린 제목은 남는다');
 await card(520);await until('none');
 await card(200);await until('full');
 const portrait=await townPage(t,{width:390,height:844,layout:'portrait',card:200});
 assert.equal(await portrait.locator('.place-heading').evaluate(e=>e.dataset.fit),undefined,'세로 화면은 제목을 읽기 전용으로 숨겨 두므로 재지 않는다');
});
