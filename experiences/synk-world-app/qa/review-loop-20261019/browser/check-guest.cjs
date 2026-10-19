// 계정 모드(공개판과 같은 모드) 손님: TOPIK 목표를 저장해도 홈 추천이 로그인부터 여는 게임으로 가지 않고, 누르면 레슨이 열린다.
// 시험용 계정 설정(identity.example.test)이고 바깥 요청은 모두 막는다 — 실제 SYNK ID·운영 서버에 닿지 않는다.
const path=require('node:path'),fs=require('node:fs');
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const BASE='http://127.0.0.1:4638',OUT=process.env.SHOTS||path.join(require('node:os').tmpdir(),'world-review-loop-shots');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});const out={};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});const blocked=[];
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===BASE)return route.continue();blocked.push(route.request().url());return route.abort('blockedbyclient');});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/world/?opening=off',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__synkWorld?.client&&window.__synkHome,null,{timeout:30000});
  await page.waitForSelector('dialog[open] [data-first-hangul]',{timeout:45000});
  out.mode=await page.evaluate(()=>({operating:document.documentElement.outerHTML.includes('account'),owner:window.__synkWorld.client.snapshot?.accountId||'guest'}));
  await page.click('[data-first-hangul="reads"]');
  await page.waitForSelector('dialog[open] .tutor-option');await page.click('.tutor-option[data-tutor-id="mongle"]');await page.click('.tutor-primary');await page.click('.tutor-primary[data-tutor-action="finish"]');
  await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready',null,{timeout:20000});
  // 학습 목표: 배우는 이유 「TOPIK 기초」(exam) + 저장 동의
  await page.evaluate(()=>window.__synkEducation.open());await page.waitForSelector('#world-study-form');
  await page.evaluate(()=>{document.querySelector('#world-study-form input[name="reason"][value="exam"]').checked=true;document.querySelector('#world-study-form input[name="consent"]').checked=true;});
  await page.click('#world-study-form button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('#world-study-form'),null,{timeout:15000});
  await page.waitForTimeout(800);
  out.plan=await page.evaluate(()=>{const p=window.__synkEducation.metrics().plan;return {owner:window.__synkEducation.metrics().owner,goals:p.settings.goals,selected:p.selected?.id,route:p.selected?.route,excluded:p.excluded.filter(x=>x.id.startsWith('world.play.')).map(x=>[x.id,x.reasons.join(',')])};});
  out.homeTutor=await page.evaluate(()=>window.__synkHome.homeTutor()?.recommendation);
  await page.screenshot({path:path.join(OUT,'D1-guest-topik-home-390.png')});
  // 홈의 주 단추를 두 번 눌러도(먼저 둘러보기 뒤 다시 누르는 것과 같음) 로그인 창이 아니라 레슨이다.
  await page.click('#home-tutor .game-tutor-help');await page.waitForTimeout(1500);
  out.afterPress=await page.evaluate(()=>({screen:window.__synkWorld.screen(),panel:document.querySelector('#world-panel').open?document.querySelector('#panel-title').textContent:null,lesson:window.__synkWorld.life()?.lessonId||null}));
  await page.screenshot({path:path.join(OUT,'D2-guest-topik-after-press-390.png')});
  // 놀이 탭에서 직접 바람길을 고르면 여전히 로그인부터 연다(손님 게임 정책은 결정 대기 — 바꾸지 않았다).
  await page.click('#panel-close');await page.waitForTimeout(500);
  await page.evaluate(()=>window.__synkHome.openLearningGame('runner'));await page.waitForTimeout(800);
  out.directGame=await page.evaluate(()=>({screen:window.__synkWorld.screen(),title:document.querySelector('#panel-title')?.textContent}));
  out.errors=errors;out.blockedHosts=[...new Set(blocked.map(u=>new URL(u).host))];
  await context.close();
  // 손님이 「아직 못 읽어요」를 고르면: 한글 만나기가 첫 추천이고, 로그인 없이 열린다(10-19 결정 「WORLD 손님」).
  const c2=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  await c2.route('**/*',route=>{if(new URL(route.request().url()).origin===BASE)return route.continue();blocked.push(route.request().url());return route.abort('blockedbyclient');});
  const p2=await c2.newPage(),e2=[];p2.on('pageerror',e=>e2.push(e.message));
  await p2.goto(BASE+'/world/?opening=off',{waitUntil:'domcontentloaded'});
  await p2.waitForSelector('dialog[open] [data-first-hangul]',{timeout:45000});await p2.click('[data-first-hangul="new"]');
  await p2.waitForSelector('dialog[open] .tutor-option');await p2.click('.tutor-option[data-tutor-id="kkamong"]');await p2.click('.tutor-primary');await p2.click('.tutor-primary[data-tutor-action="finish"]');
  await p2.waitForFunction(()=>window.__synkEducation?.metrics()?.plan?.selected,null,{timeout:20000});await p2.waitForTimeout(800);
  out.guestHangul={plan:await p2.evaluate(()=>{const p=window.__synkEducation.metrics().plan;return {selected:p.selected.id,reasons:p.reasons,excluded:p.excluded.map(x=>x.id)};})};
  await p2.click('#home-tutor .game-tutor-help');
  await p2.waitForSelector('#world-panel iframe.game-frame',{timeout:20000});
  const f2=await (await p2.$('#world-panel iframe.game-frame')).contentFrame();await f2.waitForSelector('#home:not([hidden])',{timeout:30000});
  out.guestHangul.opened=await p2.evaluate(()=>({screen:window.__synkWorld.screen(),title:document.querySelector('#panel-title').textContent,src:document.querySelector('#world-panel iframe.game-frame').getAttribute('src'),host:!!window.SYNKLearningHost}));
  out.guestHangul.deviceProgressKey=await f2.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('hangul-stage')));
  await p2.screenshot({path:path.join(OUT,'D3-guest-hangul-open-390.png')});
  out.guestHangul.errors=e2;await c2.close();
 }catch(error){console.error('CHECK_FAILED',error.stack);out.error=error.message;process.exitCode=1;}
 finally{console.log(JSON.stringify(out,null,1));fs.writeFileSync(path.join(__dirname,'check-guest.json'),JSON.stringify(out,null,1));await browser.close();}
})();
