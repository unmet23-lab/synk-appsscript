'use strict';
// 「내 계정」 in a real Chrome with a synthetic bridge (no Electron, sign-in, account server or network):
// the renderer is served by renderer-preview.cjs and the bridge answers with fixed synthetic accounts.
//   node desktop/tools/account-page-browser-qa.cjs <playwright module dir> <out dir>
// Prints one JSON line per check and writes screenshots (1440 and 390 wide).
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const [playwrightDir,outDir]=process.argv.slice(2);
if(!playwrightDir||!outDir)throw new Error('usage: account-page-browser-qa.cjs <playwright module dir> <out dir>');
const {chromium}=require(path.resolve(playwrightDir));
const port=Number(process.env.SYNK_RENDERER_PORT||63251),base=`http://127.0.0.1:${port}/index.html`;
fs.mkdirSync(outDir,{recursive:true});
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const scenarios={
  student:{appIds:['world'],status:'active',identities:['email'],memberships:[{kind:'learner',role:'student',student_code:'S-0412'}],learning:true},
  crew:{appIds:['messenger','studio'],status:'active',identities:['email','google'],memberships:[{kind:'staff',role:'teacher'}],learning:false},
  google:{appIds:['world'],status:'active',identities:['google'],memberships:[],learning:false},
  deleting:{appIds:[],status:'deletion-requested',identities:['email'],memberships:[],learning:false},
};
// Runs in the page before the renderer: the platform's preload bridge, answering from a synthetic account.
function bridgeScript(name,scenario){
  return `(()=>{const s=${JSON.stringify(scenario)},id=${JSON.stringify(ID)},calls=[];window.__accountQaCalls=calls;
  const auth={configured:true,status:'signed-in',signedIn:true,secureStorage:true,sessionGeneration:1,account:{synk_user_id:id,display_name:'합성 회원'},learningSync:true,library:{status:s.status==='active'?'ready':'unavailable',appIds:s.status==='active'?s.appIds:[]}};
  const listeners=new Set(),day=n=>new Date(Date.now()-n*3600000).toISOString();
  // SYNK TOWN's 「마을 기록」 card as talk's records route sends it (W6c) — a deletion request closes it (403 ACCOUNT_UNAVAILABLE).
  let townRev=4,townKnown=true,townBands=true,townSeen=true;
  const town=()=>s.status!=='active'?{ok:false,error:{code:'ACCOUNT_UNAVAILABLE'}}:{ok:true,scope:'synk-town-records',accountId:id,records:{available:true,started:true,revision:townRev,sections:[
    {id:'known',title:'주민이 아는 나',empty:'주민이 기억하는, 같이 한 일이 아직 없어요.',rows:townKnown?[{text:'찻집 주인 · 찻집 일 — 같이 했어요',action:{type:'MEMORY_FORGET',payload:{npc:'cafe-owner',eventId:'20749.tea-order'},label:'잊어 주세요'}}]:[]},
    {id:'settings',title:'마을이 맞춰 둔 것',empty:'마을이 맞춰 둔 것이 아직 없어요.',rows:[townBands?{text:'내가 자주 오는 때에 맞춰 마을 자리를 채워요',action:{type:'PREF_VISIT_BANDS',payload:{on:false},label:'끄기'}}:{text:'자주 오는 때에 맞춰 마을 자리 채우기 · 꺼 둠',action:{type:'PREF_VISIT_BANDS',payload:{on:true},label:'켜기'}},{text:'덜 추천하는 생활 · 비 오는데 바깥에 비품이',action:null}],note:'단추가 없는 줄은 마을 안 이웃 수첩에서 바꿀 수 있어요.'},
    {id:'familiar',title:'익숙한 생활',empty:'여러 번 함께한 생활이 여기에 모여요.',rows:townSeen?[{text:'쟁반이 기울어요'}]:[],note:'본 것 기록을 비우면 모두 다시 새 이야기로 보여요.',actions:[{type:'SEEN_CLEAR',payload:{},label:'본 것 기록 비우기',confirm:'본 것 기록을 비울까요? 마을의 일과 주민의 기억은 그대로예요.'}]},
    {id:'clear',title:'맞춤 기록 모두 비우기',lines:['요즘 자주 한 생활, 남긴 응답, 본 것 기록을 비워요. 직접 정한 설정과 마을의 일은 그대로예요.'],actions:[{type:'MEMORY_CLEAR',payload:{},label:'비우기',confirm:'맞춤 기록을 모두 비울까요?'}]}]}};
  const view=()=>({ok:true,account:{synk_user_id:id,status:s.status,profile:{display_name:'합성 회원',locale:'ko',time_zone:'Asia/Seoul'},profile_revision:2,providers:s.identities},memberships:s.memberships,entitlements:[],
    learning:{enabled:s.learning,revision:3},capabilities:{learningSync:true},dataRequests:s.status==='deletion-requested'?[{request_id:'77777777-7777-4777-8777-777777777777',kind:'delete',status:'pending',requested_at:day(20),due_at:new Date(Date.now()+6.2*86400000).toISOString()}]:[],
    sessions:[{id:'11111111-1111-4111-8111-111111111111',product:'platform',label:'',current:true,revoked:false,last_seen:day(0)},{id:'22222222-2222-4222-8222-222222222222',product:'world',label:'',current:false,revoked:false,last_seen:day(5)},{id:'33333333-3333-4333-8333-333333333333',product:'platform',label:'',current:false,revoked:false,last_seen:day(30)},{id:'44444444-4444-4444-8444-444444444444',product:'messenger',current:false,revoked:true,last_seen:day(90)}]});
  window.synkDesktop=Object.freeze({
    getEnvironment:async()=>({platform:'win32',arch:'x64',version:'0.4.42',mode:'release',publicAppsAvailable:[]}),getClients:async()=>[],authStatus:async()=>auth,getWindowState:async()=>({maximized:false}),
    onAuthChanged:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},onClientsChanged:()=>()=>{},onClientProgress:()=>()=>{},onWindowStateChanged:()=>()=>{},onOpenView:()=>()=>{},
    accountRequest:async(operation,params)=>{calls.push(operation);if(['platformLoad','insightLoad','understandingLoad'].includes(operation))return {ok:true,scope:'synk-personal',resource:operation==='platformLoad'?'platform-library':operation==='insightLoad'?'member-insight':'member-understanding',accountId:id,revision:0,updatedAt:null,state:null};
      if(operation==='accountView'||operation==='load')return view();
      if(operation==='townRecords')return town();
      if(operation==='townRights'){if(params.expectedRevision!==townRev)return {ok:false,error:{code:'stale-command'}};if(params.type==='MEMORY_FORGET')townKnown=false;if(params.type==='PREF_VISIT_BANDS')townBands=params.payload.on;if(['SEEN_CLEAR','MEMORY_CLEAR'].includes(params.type))townSeen=false;townRev++;return town();}if(operation==='updateProfile')return {ok:true,account:{...view().account,profile:{...view().account.profile,...params.profile}}};return {ok:true};},
    accountIdentity:async()=>{calls.push('identity');return {ok:true,accountId:id,email:'member@synthetic.test',newEmail:null,createdAt:'2026-09-30T23:10:00Z',identities:s.identities.map(provider=>({provider,email:provider==='google'?'member.google@synthetic.test':'member@synthetic.test',createdAt:'2026-10-01T00:00:00Z'}))};},
    authSecurity:async()=>{calls.push('authSecurity');return {ok:true};},authSignOut:async()=>({ok:true,serverRevoked:true,serverSessionRevoked:true}),
  });})();`;
}
const results=[];const check=(name,ok,details={})=>{results.push({name,ok:!!ok,...details});console.log(JSON.stringify({name,ok:!!ok,...details}));};
(async()=>{
  const server=spawn(process.execPath,[path.join(__dirname,'renderer-preview.cjs')],{env:{...process.env,SYNK_RENDERER_PORT:String(port)},stdio:'ignore'});
  const browser=await chromium.launch({channel:process.env.SYNK_QA_CHANNEL||'chrome'});
  try{
    for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    for(const [name,scenario]of Object.entries(scenarios))for(const width of name==='student'?[1440,390]:[1440]){
      const context=await browser.newContext({viewport:{width,height:width>500?1000:844}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(String(error).slice(0,200)));page.on('console',message=>{if(message.type()==='error'&&!/Failed to load resource/.test(message.text()))errors.push(message.text().slice(0,200));});
      // A missing file is named by its address; the browser's own favicon probe is not the renderer's.
      page.on('response',response=>{if(response.status()>=400&&new URL(response.url()).pathname!=='/favicon.ico')errors.push(response.status()+' '+new URL(response.url()).pathname);});
      await page.addInitScript(bridgeScript(name,scenario));await page.goto(base,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
      // Signed in: the title-bar account (or 설정 → 내 계정 on a narrow window) opens the screen.
      await page.evaluate(()=>document.getElementById(innerWidth>760?'account-button':'settings-login').click());
      await page.waitForFunction(()=>!document.getElementById('view-account').hidden&&/member@synthetic\.test/.test(document.getElementById('view-account').textContent));
      const calls=await page.evaluate(()=>window.__accountQaCalls.slice()),text=await page.evaluate(()=>document.getElementById('view-account').innerText);
      const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth,document.getElementById('main').scrollWidth-document.getElementById('main').clientWidth));
      const settingsLit=await page.evaluate(()=>document.querySelector('.nav-links [data-view=settings]').getAttribute('aria-current')==='page');
      // The app scrolls inside #main; a tall window shows the whole screen in one picture.
      await page.setViewportSize({width,height:width>500?2700:3600});await page.waitForTimeout(150);await page.screenshot({path:path.join(outDir,`account-${name}-${width}.png`)});await page.setViewportSize({width,height:width>500?1000:844});
      check(`${name} ${width}: opens with accountView and identity, never load`,calls.includes('accountView')&&calls.includes('identity')&&!calls.slice(calls.indexOf('accountView')).includes('load')&&overflow===0&&settingsLit&&!errors.length,{overflow,settingsLit,errors,screenshot:`account-${name}-${width}.png`});
      if(name==='student'&&width===1440){
        check('student: profile, sessions and records read as the member sees them',['학생 · S-0412','member@synthetic.test','이 PC','SYNK WORLD','학습 기록 연결','켜져 있어요','지우기 요청…','비밀번호 바꾸기','2026년 10월 1일'].every(part=>text.includes(part)),{});
        await page.click('[data-account-action=name-edit]');await page.fill('#account-name-input','새 합성 이름');await page.screenshot({path:path.join(outDir,'account-student-name-edit-1440.png')});
        await page.click('#view-account .ap-name-form button[type=submit]');await page.waitForFunction(()=>/이름을 바꿨어요/.test(document.getElementById('view-account').textContent));
        const after=await page.evaluate(()=>window.__accountQaCalls.slice());check('student: a name saves through updateProfile only',after.includes('updateProfile')&&!after.slice(after.indexOf('updateProfile')).includes('load'),{});
        await page.click('[data-account-action=delete-request]');await page.waitForSelector('dialog.ap-confirm[open]');await page.screenshot({path:path.join(outDir,'account-student-delete-confirm-1440.png')});
        await page.click('dialog.ap-confirm button[value=cancel]');
        await page.click('[data-account-action=security]');await page.waitForFunction(()=>/로그인과 보안」을 열었어요/.test(document.getElementById('view-account').textContent));
        check('student: password and e-mail go to the browser SYNK ID',(await page.evaluate(()=>window.__accountQaCalls)).includes('authSecurity'),{});
        // 05 TOWN 「마을 기록」(W6c): the card under the records, one rights command at a time, clearing asks once more.
        check('student: the town records card reads as the notebook does',['05 / TOWN','주민이 아는 나','찻집 주인 · 찻집 일 — 같이 했어요','덜 추천하는 생활','단추가 없는 줄은']
          .every(value=>text.includes(value))&&text.indexOf('04 / RECORDS')<text.indexOf('05 / TOWN'),{});
        await page.click('[data-town="known.r0"]');await page.waitForFunction(()=>/그 주민의 기억에서 뺐어요/.test(document.getElementById('view-account').textContent));
        await page.click('[data-town="clear.a0"]');await page.waitForSelector('dialog.ap-confirm[open]');await page.screenshot({path:path.join(outDir,'account-student-town-clear-confirm-1440.png')});
        await page.click('dialog.ap-confirm button[value=confirm]');await page.waitForFunction(()=>/맞춤 기록을 모두 비웠어요/.test(document.getElementById('view-account').textContent));
        const town=await page.evaluate(()=>window.__accountQaCalls.filter(name=>/^town/.test(name)));
        check('student: forget and clear go out as townRights only',town.join()==='townRecords,townRights,townRights',{town});
        await page.focus('[data-town="settings.r0"]');await page.keyboard.press('Enter');await page.waitForFunction(()=>/자주 오는 때에 맞추지 않아요/.test(document.getElementById('view-account').textContent));
        check('student: a town control keeps the keyboard after its command',await page.evaluate(()=>document.activeElement?.dataset?.town)==='settings.r0',{});
        await page.setViewportSize({width,height:2700});await page.waitForTimeout(150);await page.screenshot({path:path.join(outDir,'account-student-town-after-1440.png')});await page.setViewportSize({width,height:1000});
      }
      if(name==='crew')check('crew: Workspace password lives in the Workspace',text.includes('작업실의 「설정 → 내 로그인 비밀번호」')&&text.includes('Google')&&!text.includes('Google 연결하기'),{});
      if(name==='google')check('Google-only: offers to make a password',text.includes('비밀번호 만들기'),{});
      if(name==='deleting')check('deletion requested: the screen still opens and offers the cancel',text.includes('삭제 요청 취소')&&text.includes('삭제 요청됨')&&text.includes('계정 삭제를 요청한 동안에는 마을 기록을 볼 수 없어요'),{});
      await context.close();
    }
  }finally{await browser.close();server.kill();}
  fs.writeFileSync(path.join(outDir,'results.json'),JSON.stringify({at:new Date().toISOString(),results},null,2)+'\n');
  process.exitCode=results.every(row=>row.ok)?0:1;
})().catch(error=>{console.error(error);process.exitCode=1;});
