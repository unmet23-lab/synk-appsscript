// 계정 모드(공개판과 같은 모드) 손님 흐름을 격리 헤드리스 Chrome으로 본다(10-19 결정 「WORLD 손님」 · 공개판 설계 §2).
//  A. 손님 한 판 체험: TOPIK 목표 손님이 추천을 따라 바람길 → 말의 리듬을 한 판씩 하고, 결과에서 로그인 안내를 받고, 체험을 마친 게임은 추천에서 빠진다.
//  B. 한글 만나기 기기 기록 옮기기: 손님이 이 기기에 쌓은 한글 진도·첫 실행 답을 로그인할 때 옮길지 묻고, 고른 대로 계정에 담는다(390은 옮기기, 1440은 처음부터).
// 서버는 임의 포트·임시 설정으로 따로 띄우고(SYNK_WORLD_MODE=account), 계정 API는 합성 응답이다 — 실제 SYNK ID·운영 서버에 닿지 않는다.
// node experiences/synk-world-app/qa/guest-trial-20261019/check-guest-trial.cjs  (그림: SHOTS 환경 변수 폴더, 기본은 임시 폴더)
const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),net=require('node:net'),{spawn}=require('node:child_process');
const {chromium}=require(require.resolve('playwright',{paths:[path.join(process.env.USERPROFILE||os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
const root=path.resolve(__dirname,'../../../..');
const OUT=process.env.SHOTS||path.join(os.tmpdir(),'world-guest-trial-shots');fs.mkdirSync(OUT,{recursive:true});
const A='11111111-1111-4111-8111-111111111111',LIFE='synk.life-korean.progress.v1';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const VIEWPORTS=[{name:'390',viewport:{width:390,height:844},deviceScaleFactor:2},{name:'1440',viewport:{width:1440,height:900},deviceScaleFactor:1}];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function freePort(){const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));return port;}
// The synthetic account server: account A, its play record (life progress lives here) and the WORLD bootstrap.
function fixture(){
 const playState={wallet:{coins:0},records:{},imported:false},calls=[];let playRevision=0;
 async function handle(route){
  const req=route.request(),target=new URL(req.url()),body=req.postDataJSON();calls.push({path:target.pathname,method:req.method(),action:body?.action||null,keys:body?.changes?.map(c=>c.key)||[]});let data={ok:true};
  if(target.pathname.endsWith('/synk-account'))data=body?{ok:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[{id:'22222222-2222-4222-8222-222222222222',current:true,revoked:false,product:'world'}]};
  else if(target.pathname.endsWith('/synk-play')){
   if(body?.action==='progress'){for(const change of body.changes){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}playRevision++;}
   else if(body)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'INVALID_PLAY_COMMAND'}}),headers:{'Access-Control-Allow-Origin':'*'}});
   data={ok:true,scope:'synk-play',accountId:A,revision:playRevision,state:structuredClone(playState)};
  }
  else if(target.pathname.endsWith('/synk-learning'))data={ok:true,revision:1,events:[],entries:[],cursor:0,hasMore:false,accepted:[]};
  else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
  else if(target.pathname.endsWith('/synk-personal'))return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,error:{code:'PRODUCT_FORBIDDEN'}}),headers:{'Access-Control-Allow-Origin':'*'}});
  else if(!target.pathname.startsWith('/auth/v1/logout'))data={ok:false,error:{code:'UNEXPECTED_FIXTURE_ENDPOINT',path:target.pathname}};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});
 }
 return {playState,calls,handle};
}
async function context(browser,base,vp,api){
 const ctx=await browser.newContext({viewport:vp.viewport,deviceScaleFactor:vp.deviceScaleFactor,reducedMotion:'reduce'});ctx.setDefaultTimeout(30000);
 const external=[];
 await ctx.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base)return route.continue();if(url.origin==='https://identity.example.test')return api.handle(route);external.push(url.host);return route.abort('blockedbyclient');});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 return {ctx,page,errors,external};
}
async function firstRun(page,answer){
 await page.waitForSelector('dialog[open] [data-first-hangul]',{timeout:45000});await page.click(`[data-first-hangul="${answer}"]`);
 await page.waitForSelector('dialog[open] .tutor-option');await page.click('.tutor-option[data-tutor-id="mongle"]');await page.click('.tutor-primary');await page.click('.tutor-primary[data-tutor-action="finish"]');
 await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready',null,{timeout:30000});
}
const plan=page=>page.evaluate(()=>{const p=window.__synkEducation.metrics().plan;return {selected:p.selected?.id||null,route:p.selected?.route||null,excluded:p.excluded.filter(x=>x.id.startsWith('world.play.')).map(x=>x.id)};});
async function exitPractice(page){for(let i=0;i<10;i++){if(await page.locator('dialog.tutor-practice[open] .practice-exit').count()){await page.click('dialog.tutor-practice[open] .practice-exit');await page.waitForFunction(()=>!document.querySelector('dialog.tutor-practice[open]'));return true;}await wait(300);}return false;}
async function gameFrame(page,game){
 await page.waitForFunction(game=>document.querySelector(`#world-panel iframe.game-frame[src*="korean-${game}"]`),game,{timeout:30000});
 const frame=await (await page.$('#world-panel iframe.game-frame')).contentFrame();await frame.waitForFunction(()=>globalThis.SynkPlayAccount?.status?.(),null,{timeout:30000});return frame;
}
// One real round, fast-forwarded with the game's own QA controls (?qa): the round ends through its real finish() and award.
async function playRunner(page){
 let frame=await gameFrame(page,'runner');
 await exitPractice(page);
 await frame.goto(frame.url().replace(/\/?(\?.*)?$/,'/?qa=1'));await frame.waitForFunction(()=>window.__runner&&globalThis.SynkPlayAccount?.status?.().trial===true);
 const lobby=await frame.evaluate(()=>({trial:SynkPlayAccount.status().trial,mode:SynkPlayAccount.status().mode,note:document.querySelector('.w-trial-note')?.textContent||null,coinLineHidden:document.querySelector('.start-card>.synk-collection-line')?.hidden??null}));
 await frame.evaluate(()=>{__runner.auto(true);__runner.fast(30);});await frame.click('#start');
 await frame.waitForFunction(()=>__runner.state().screen==='results',null,{timeout:90000});await frame.waitForFunction(()=>document.querySelector('#r-coins')?.textContent.includes('체험'));
 return {frame,lobby};
}
async function playRhythm(page){
 let frame=await gameFrame(page,'rhythm');
 await exitPractice(page);
 await frame.evaluate(()=>localStorage.setItem('synk.world.rhythm.calibrated','1'));
 await frame.goto(frame.url().replace(/\/?(\?.*)?$/,'/?qa=1'));await frame.waitForFunction(()=>window.__rhythm&&globalThis.SynkPlayAccount?.status?.().trial===true);
 const lobby=await frame.evaluate(()=>({trial:SynkPlayAccount.status().trial,mode:SynkPlayAccount.status().mode,note:document.querySelector('.w-trial-note')?.textContent||null,coinLineHidden:document.querySelector('.start-card>.synk-collection-line')?.hidden??null}));
 await frame.evaluate(()=>__rhythm.autoplay(true));await frame.click('#start-button');
 await frame.waitForFunction(()=>__rhythm.state().screen==='game'&&__rhythm.state().duration>0&&!__rhythm.state().loading,null,{timeout:60000});
 await frame.evaluate(()=>__rhythm.seek(__rhythm.state().duration-1.5));
 await frame.waitForFunction(()=>__rhythm.state().screen==='results',null,{timeout:60000});await frame.waitForFunction(()=>document.querySelector('#r-coins')?.textContent.includes('체험'));
 return {frame,lobby};
}
const resultView=frame=>frame.evaluate(()=>{const shown=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;
 return {trialClass:document.querySelector('#results').classList.contains('w-trial'),coins:document.querySelector('#r-coins').textContent,
  card:document.querySelector('.w-trial-card')?.innerText.replace(/\s+/g,' ').trim()||null,cardShown:shown(document.querySelector('.w-trial-card')),
  login:shown(document.querySelector('#w-trial-login'))?document.querySelector('#w-trial-login').textContent.trim():null,room:shown(document.querySelector('#w-room')),
  replayShown:['#restart','#replay-button','#other-song'].filter(s=>shown(document.querySelector(s))),used:SynkPlayAccount.status().used,
  overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};});

async function flowTrial(browser,base,vp){
 const api=fixture(),{ctx,page,errors,external}=await context(browser,base,vp,api),out={};
 await page.goto(base+'/world/?opening=off',{waitUntil:'domcontentloaded'});
 await firstRun(page,'reads');
 await page.evaluate(()=>window.__synkEducation.open());await page.waitForSelector('#world-study-form');
 await page.evaluate(()=>{document.querySelector('#world-study-form input[name="reason"][value="exam"]').checked=true;document.querySelector('#world-study-form input[name="consent"]').checked=true;});
 await page.click('#world-study-form button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('#world-study-form'),null,{timeout:15000});await wait(600);
 out.planStart=await plan(page);
 await page.screenshot({path:path.join(OUT,`A1-guest-topik-home-${vp.name}.png`)});
 // 홈의 추천을 그대로 누른다 → 바람길 체험 판.
 await page.click('#home-tutor .game-tutor-help');
 const runner=await playRunner(page);out.runnerLobby=runner.lobby;out.runnerResult=await resultView(runner.frame);
 out.trialKeyAfterRunner=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.guest-trial.v1')||'null'));
 await page.screenshot({path:path.join(OUT,`A2-runner-trial-result-${vp.name}.png`)});
 await runner.frame.evaluate(()=>document.querySelector('.w-room-bar').scrollIntoView());await page.screenshot({path:path.join(OUT,`A2b-runner-trial-result-bottom-${vp.name}.png`)});
 // 결과의 로그인 단추 → 게임 판이 닫히고 체험 이유가 적힌 계정 연결 판.
 await runner.frame.click('#w-trial-login');
 await page.waitForSelector('#world-panel [data-world="account-login"]');
 out.signInAfterRunner={iframes:await page.locator('iframe').count(),lead:await page.locator('#panel-content .ws-lead').textContent(),host:await page.evaluate(()=>!!window.SYNKPlayHost)};
 await page.screenshot({path:path.join(OUT,`A3-signin-after-trial-${vp.name}.png`)});
 await page.click('#world-panel [data-world="guest"]');await page.waitForFunction(()=>!document.querySelector('#world-panel').open);await wait(600);
 out.planAfterRunner=await plan(page);
 // 다시 바람길을 고르면 체험이 아니라 로그인부터.
 await page.evaluate(()=>window.__synkHome.openLearningGame('runner'));await page.waitForSelector('#world-panel [data-world="account-login"]');
 out.runnerAgain={iframes:await page.locator('iframe').count(),screen:await page.evaluate(()=>window.__synkWorld.screen())};
 await page.click('#world-panel [data-world="guest"]');await page.waitForFunction(()=>!document.querySelector('#world-panel').open);await wait(400);
 // 추천은 이제 리듬 체험 → 한 곡 → 그다음은 레슨(로그인 창을 맴돌지 않는다).
 await page.click('#home-tutor .game-tutor-help');
 const rhythm=await playRhythm(page);out.rhythmLobby=rhythm.lobby;out.rhythmResult=await resultView(rhythm.frame);
 await page.screenshot({path:path.join(OUT,`A4-rhythm-trial-result-${vp.name}.png`)});
 await rhythm.frame.click('#w-room');await page.waitForFunction(()=>!document.querySelector('#world-panel').open);await wait(600);
 out.planAfterBoth=await plan(page);
 await page.click('#home-tutor .game-tutor-help');await wait(1500);
 out.afterBothPress={screen:await page.evaluate(()=>window.__synkWorld.screen()),lesson:await page.evaluate(()=>window.__synkWorld.life()?.lessonId||null)};
 out.trialKey=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.guest-trial.v1')||'null'));
 out.deviceCoins=await page.evaluate(()=>localStorage.getItem('SYNK_PLAY_COLLECTION_V1'));
 out.accountCalls=api.calls.length;out.errors=errors;out.external=[...new Set(external)];
 await ctx.close();return out;
}

async function flowDevice(browser,base,vp,choice){
 const api=fixture(),{ctx,page,errors,external}=await context(browser,base,vp,api),out={choice};
 await page.goto(base+'/world/?opening=off',{waitUntil:'domcontentloaded'});
 await firstRun(page,'new');
 out.guestPlan=await plan(page);
 // 손님으로 한글 만나기를 열어 첫 글자 셋을 만난 상태를 남긴다(한글 단계의 실제 판단 코드로).
 await page.evaluate(()=>window.__synkHome.openLearningGame('hangul'));
 await page.waitForSelector('#world-panel iframe.game-frame[src*="hangul-stage"]');
 const hangul=await (await page.$('#world-panel iframe.game-frame')).contentFrame();await hangul.waitForSelector('#home:not([hidden])',{timeout:30000});
 out.guestKey=await hangul.evaluate(async()=>{const m=await import('./learning.mjs');return m.progressKey(window,m.createCoach(window));});
 out.guestSnapshot=await hangul.evaluate(async()=>{const core=await import('./core.mjs'),{createPack}=await import('./pack.mjs');const pack=createPack(window.SynkLearning.layer);
  const ids=pack.letters.filter(l=>l.role!=='final').slice(0,3).map(l=>l.id),at=new Date().toISOString();
  let p=core.meet(core.readProgress(JSON.parse(localStorage.getItem('synk.hangul-stage.v1')||'null')),ids,at);p=core.answer(p,{focus:[ids[0]],correct:true,at,sessionId:'check-session'});
  localStorage.setItem('synk.hangul-stage.v1',JSON.stringify(p));return {ids,raw:localStorage.getItem('synk.hangul-stage.v1')};});
 await exitPractice(page);if(await page.evaluate(()=>document.querySelector('#world-panel').open))await page.click('#panel-close');await page.waitForFunction(()=>!document.querySelector('#world-panel').open);
 // 로그인: OAuth에서 돌아온 것처럼 세션을 두고 다시 연다.
 await page.evaluate(()=>sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-check-token',refresh_token:null,expires_at:Date.now()+3600000})));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForSelector('#world-panel [data-world="device-records"][data-choice="move"]',{timeout:45000});
 out.offer={title:await page.locator('#panel-title').textContent(),text:(await page.locator('#panel-content').innerText()).replace(/\s+/g,' ').trim(),owner:await page.evaluate(()=>window.__synkWorld.client.snapshot?.accountId),entry:await page.evaluate(()=>window.__synkWorld.entry().phase)};
 out.accountKey=await page.evaluate(()=>{const s=window.SYNKLearningHost?.status();return s?`synk.account.${s.accountKey}.r${s.revision}.hangul-stage.v1`:null;});
 await page.screenshot({path:path.join(OUT,`B1-device-records-offer-${vp.name}.png`)});
 await page.click(`#world-panel [data-world="device-records"][data-choice="${choice}"]`);
 // 계정은 튜터를 아직 안 골랐다: 옮겼으면 한글 질문 없이 튜터 고르기, 처음부터면 한글 질문부터.
 await page.waitForSelector(choice==='move'?'dialog[open] .tutor-option':'dialog[open] [data-first-hangul]',{timeout:30000});await wait(300);
 out.afterChoice={panel:await page.evaluate(()=>window.__synkHome.openPanel()),hangulQuestion:await page.locator('dialog[open] [data-first-hangul]').count(),toast:await page.locator('#home-toast:not([hidden])').textContent().catch(()=>null)};
 await page.screenshot({path:path.join(OUT,`B2-after-${choice}-${vp.name}.png`)});
 out.accountHangul=await page.evaluate(key=>localStorage.getItem(key),out.accountKey);
 out.decision=await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.device-records.v1')||'null'));
 out.guestKept=await page.evaluate(()=>localStorage.getItem('synk.hangul-stage.v1'));
 if(choice==='keep'){await page.click('[data-first-hangul="reads"]');await page.waitForSelector('dialog[open] .tutor-option');}
 await page.click('.tutor-option[data-tutor-id="kkamong"]');await page.click('.tutor-primary');await page.click('.tutor-primary[data-tutor-action="finish"]');
 await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready',null,{timeout:30000});
 await page.waitForFunction(()=>Object.keys(window.__synkWorld.life()?.progress?.lessons||{}).length>=0&&window.__synkLife?.summary().status.phase==='synced',null,{timeout:20000}).catch(()=>{});
 out.accountLifeHangul=(()=>{try{return JSON.parse(api.playState.records[LIFE]||'null')?.hangul||null;}catch{return 'unreadable';}})();
 // 계정으로 한글 만나기를 열면 그 계정 구역의 진도를 읽는다.
 await page.evaluate(()=>window.__synkHome.openLearningGame('hangul'));
 await page.waitForSelector('#world-panel iframe.game-frame[src*="hangul-stage"]');
 const accountFrame=await (await page.$('#world-panel iframe.game-frame')).contentFrame();await accountFrame.waitForSelector('#home:not([hidden])',{timeout:30000});
 out.accountStage=await accountFrame.evaluate(async()=>{const m=await import('./learning.mjs'),coach=m.createCoach(window),key=m.progressKey(window,coach);return {hosted:m.isHosted(coach),key,metLetters:Object.values(JSON.parse(localStorage.getItem(key)||'{"letters":{}}').letters).filter(l=>l.state!=='unmet').length};});
 await page.screenshot({path:path.join(OUT,`B3-account-hangul-${choice}-${vp.name}.png`)});
 await exitPractice(page);if(await page.evaluate(()=>document.querySelector('#world-panel').open))await page.click('#panel-close');
 // 다시 열어도 묻지 않는다.
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready',null,{timeout:45000});await wait(500);
 out.askedAgain=await page.locator('#world-panel [data-world="device-records"]').count();
 out.playWrites=api.calls.filter(c=>c.action==='progress').map(c=>c.keys).flat().filter((k,i,a)=>a.indexOf(k)===i);
 out.errors=errors;out.external=[...new Set(external)];
 await ctx.close();return out;
}

(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'world-guest-trial-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,env:{...process.env,SYNK_WORLD_PORT:String(port),SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')},stdio:'pipe'});
 let serverOutput='';server.stdout.on('data',c=>serverOutput+=c);server.stderr.on('data',c=>serverOutput+=c);
 const result={checkedAt:new Date().toISOString(),mode:'account',syntheticAccount:true,liveProviderCalls:false,viewports:{}};let browser;
 try{
  for(let i=0;i<80;i++){try{const r=await fetch(base+'/health');if(r.ok){result.health=await r.json();break;}}catch{}if(server.exitCode!==null)throw Error(serverOutput);await wait(100);}
  if(!result.health)throw Error('server start timeout '+serverOutput);
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  for(const vp of VIEWPORTS){
   result.viewports[vp.name]={trial:await flowTrial(browser,base,vp),device:await flowDevice(browser,base,vp,vp.name==='390'?'move':'keep')};
   console.log('viewport',vp.name,'done');
  }
  result.dataDirCreated=fs.existsSync(path.join(directory,'must-not-create'));
 }catch(error){console.error('CHECK_FAILED',error.stack);result.error=error.message;process.exitCode=1;}
 finally{
  fs.writeFileSync(path.join(__dirname,'check-guest-trial.json'),JSON.stringify(result,null,1)+'\n');console.log(JSON.stringify(result,null,1));console.log('shots',OUT);
  await browser?.close();server.kill('SIGKILL');fs.rmSync(directory,{recursive:true,force:true});
 }
})();
