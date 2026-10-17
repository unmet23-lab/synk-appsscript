import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';

// 우리 동네 ↔ 우리 집 문 열림(home.mjs go → world-motion.mjs doors, 10-17 팁 장부 7행)을 실제 홈 화면으로 본다.
// 3D 방은 가짜 엔진으로 바꿔 첫 그림이 늦는 느린 기기를 흉내 낸다. 계정·저장·네트워크는 쓰지 않고 이 저장소의 파일만 내준다.
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
// 가짜 3D 방: window.__stubFirstFrame ms 뒤에 첫 그림이 된다.
const stub=`export async function mountLivingHomeScene(){await new Promise(r=>setTimeout(r,globalThis.__stubFirstFrame||0));window.__stubMounted=(window.__stubMounted||0)+1;
 return {setTutor(){},setEquipment(){},setMemory(){},setReducedMotion(){},setActive(){},greet(){},capture(){return 'data:,';},getAnchors(){return [];},metrics(){return {};},dispose(){}};}`;
let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://fixture.invalid');
  if(url.pathname==='/experiences/synk-world-home/living-home-scene.mjs'){res.setHeader('Content-Type',types['.mjs']);res.end(stub);return;}
  const name=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!name.startsWith(root+path.sep))throw Error('outside fixture');
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(await readFile(name));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function homePage(t,{reducedMotion='no-preference',worldReduced=false,firstFrame=0}={}){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,reducedMotion});t.after(()=>context.close());
 await context.addInitScript(({worldReduced,firstFrame})=>{
  try{localStorage.setItem('synk.world.tutor.v1:guest',JSON.stringify({version:1,completed:true,tutor:'mongle'}));localStorage.setItem('synk.world.town.hint.v1','1');if(worldReduced)localStorage.setItem('synk.world.maru.reduced','true');}catch{}
  globalThis.__stubFirstFrame=firstFrame;window.__doors=[];window.__lifted=[];
  document.addEventListener('click',e=>{if(e.target.closest?.('#home-main>.town-scene [data-town-place=home],.room-back'))window.__tap??=performance.now();},true);
  new MutationObserver(list=>{for(const m of list){for(const n of m.addedNodes)if(n.classList?.contains('w-doors'))window.__doors.push({mode:n.dataset.mode,at:performance.now()});for(const n of m.removedNodes)if(n.classList?.contains('w-doors'))window.__lifted.push(performance.now());}}).observe(document,{subtree:true,childList:true});
 },{worldReduced,firstFrame});
 const page=await context.newPage();const failed=[];page.on('pageerror',e=>failed.push(e.message));
 await page.goto(`${base}/experiences/brand-opening/home.html?townTime=day`);
 await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&window.__synkHome);
 t.after(()=>assert.deepEqual(failed,[],'no page error'));
 return page;
}
// 문짝 안의 복제 이름표가 아닌 진짜 동네의 이름표. 동네 사진이 18초 동안 천천히 다가와 이름표가 계속 움직이므로 「멈출 때까지 기다리기」 없이 누른다.
const homePin=page=>page.locator('#home-main>.town-scene [data-town-place=home]');
const snapshot=()=>({place:__synkHome.place(),moving:__synkHome.town().moving,focus:document.activeElement?.matches('.room-back')?'room-back':document.activeElement?.dataset?.townPlace||document.activeElement?.tagName,heading:document.querySelector('.place-heading h1').textContent,doors:window.__doors.map(d=>d.mode)});
const state=page=>page.evaluate(`(${snapshot})()`);
// 누른 그 작업 안에서 읽는다 — 한 프레임이라도 뒤에 바뀌면 「바로」가 아니다.
const tapNow=(page,selector)=>page.evaluate(`(()=>{document.querySelector(${JSON.stringify(selector)}).click();return (${snapshot})();})()`);

test('기기 동작 줄이기와 WORLD 움직임 줄이기에서는 문 없이 바로 바뀌고 초점은 지금과 같다',async t=>{
 for(const options of [{reducedMotion:'reduce'},{worldReduced:true}]){
  const page=await homePage(t,{...options,firstFrame:3000});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced');
  // 3D 첫 그림(3초 뒤)을 기다리지 않고 누른 그 자리에서 방이 된다.
  assert.deepEqual(await tapNow(page,'#home-main>.town-scene [data-town-place=home]'),{place:'room',moving:null,focus:'room-back',heading:'우리 방',doors:[]},JSON.stringify(options));
  const back=await tapNow(page,'.room-back');
  assert.equal(back.place,'town');assert.equal(back.moving,null);assert.equal(back.heading,'우리 동네');
  assert.match(back.focus,/^(home|cafe|store|clock|bus|street|friends)$/,'focus returns to a town place');
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>window.__doors),[],'no door overlay at any point');
 }
});

test('움직임이 켜져 있으면 문이 3D 첫 그림을 최대 1.2초만 기다려 열리고, 나올 때는 맞물려 동네가 되며 그 사이 탭은 무시한다',async t=>{
 const page=await homePage(t,{firstFrame:5000});
 await homePin(page).click({force:true});
 await page.waitForFunction(()=>document.querySelector('.w-doors[data-mode=open]'));
 // 닫힌 문 뒤에서는 이미 방이다. 열림은 처음부터 1.2초 뒤로 걸려 있다(화면 일이 막혀도 합성기에서 열린다).
 const waiting=await page.evaluate(()=>{const a=document.querySelector('.w-door').getAnimations()[0];return {delay:a.effect.getTiming().delay,place:__synkHome.place(),moving:__synkHome.town().moving,heading:document.querySelector('.place-heading h1').textContent};});
 assert.ok(waiting.delay>900&&waiting.delay<=1200,`door opening is scheduled within 1.2s of the tap (${waiting.delay}ms)`);
 assert.deepEqual({place:waiting.place,moving:waiting.moving,heading:waiting.heading},{place:'room',moving:'room',heading:'우리 동네'},'the town title stays until the doors open');
 // 전환 중 연속 탭: 우리 집 한 번 더, 「동네로」 — 둘 다 무시.
 await homePin(page).dispatchEvent('click');await page.locator('.room-back').dispatchEvent('click');
 await page.waitForFunction(()=>!document.querySelector('.w-doors')&&!__synkHome.town().moving);
 const opened=await page.evaluate(()=>window.__lifted[0]-window.__tap);
 assert.ok(opened<1200+450+500,`doors are lifted soon after 1.2s even though the 3D room is not ready (${Math.round(opened)}ms)`);
 assert.deepEqual(await state(page),{place:'room',moving:null,focus:'room-back',heading:'우리 방',doors:['open']});
 assert.equal(await page.evaluate(()=>window.__stubMounted||0),0,'the room was still drawing its first frame');
 await page.evaluate(()=>{window.__tap=undefined;});await page.locator('.room-back').click();
 await page.waitForFunction(()=>document.querySelector('.w-doors[data-mode=close]'));
 assert.equal(await page.evaluate(()=>__synkHome.place()),'room','the room stays until the two halves meet');
 await page.locator('.room-back').dispatchEvent('click');
 await page.waitForFunction(()=>!document.querySelector('.w-doors')&&!__synkHome.town().moving);
 const closed=await page.evaluate(()=>window.__lifted[1]-window.__tap);
 assert.ok(closed<350+700,`the doors meet in about 0.35s (${Math.round(closed)}ms)`);
 const back=await state(page);
 assert.deepEqual({place:back.place,heading:back.heading,doors:back.doors},{place:'town',heading:'우리 동네',doors:['open','close']});
 assert.match(back.focus,/^(home|cafe|store|clock|bus|street|friends)$/,'focus returns to a town place');
});
