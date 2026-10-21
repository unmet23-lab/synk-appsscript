import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// 말하기 연습 시범(10-21)을 리허설 WORLD(실제 Edge, 합성 계정 player-a)에서 끝까지 돈다. 마이크는 Edge의 가짜 장치에 이 시험이 만든
// 합성 소리(사람 목소리가 아니다)를 물린다. 자동 피드백·역할극 서버 몫은 가짜 응답이라 모델·운영 서버·돈을 쓰지 않는다.
// 플래그가 없으면 줄이 없다 → ?speaking=preview로 연다 → 동의 → 녹음 → 서버로 간 몸통(소리·동의·문항) → 참고 피드백 → 역할극 세 차례.
// 그 뒤 「제가 한 말과 달라요」(기록에서 빠짐)·서버 사정·오늘 몫을 다 쓴 때(스스로 확인)·역할극 서버 사정(따라 말하기로 넘김)을 본다.
// 390·1280에서 가로 넘침·13px 밑 한글·44px 밑 단추·흰 알약 둘 이상이 없고, 영어·몽골어에서 lang="ko" 칸 밖 한글이 없는지 잰다.
// 캡처와 result.json은 SYNK_SPEAKING_QA_OUT(기본 qa/speaking-pilot-20261021/browser/)에 쓴다(그림·결과 모두 git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_SPEAKING_QA_OUT||path.join(root,'experiences/synk-world-app/qa/speaking-pilot-20261021/browser'));
const VIEWPORTS=[{tag:'390',size:{width:390,height:844}},{tag:'1280',size:{width:1280,height:800}}];

// 가짜 마이크 소리: 16kHz 한 채널 6초. 말소리처럼 켜졌다 꺼지는 배음(사람 목소리·녹음이 아니다).
function voicedWav(file){
 const rate=16000,seconds=6,n=rate*seconds,data=Buffer.alloc(44+n*2);
 data.write('RIFF',0);data.writeUInt32LE(36+n*2,4);data.write('WAVE',8);data.write('fmt ',12);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);
 data.writeUInt32LE(rate,24);data.writeUInt32LE(rate*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){const t=i/rate,syll=Math.max(0,Math.sin(Math.PI*((t*4)%1))),f=140+20*Math.sin(t*3);let v=0;for(let h=1;h<=6;h++)v+=Math.sin(2*Math.PI*f*h*t)/h;data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v*.32*syll))*32767),44+i*2);}
 fs.writeFileSync(file,data);
}
const FEEDBACK={status:'ok',counted:true,heard:{transcript:'저는 주말에 보통 집에서 쉬어요. 지난 주말에는 친구를 만났어요.',speech:'clear',language:'ko',syllables:26},covered:[0,1],
 elements:{task:{good:'두 가지 질문에 모두 대답했어요.',try:'한 일의 이유나 느낌을 한 문장 더해 봐요.'},language:{good:'지금 하는 일과 지난 일을 나눠 말했어요.',try:'「그리고」 같은 이어 주는 말을 써 봐요.',quote:'지난 주말에는 친구를 만났어요',better:'지난 주말에는 친구를 만나서 영화를 봤어요'},delivery:{good:'속도가 알맞았어요.',try:''}},
 modelLine:'다음 주말에는 친구와 한강 공원에 가고 싶어요.',note:''};
const localized=lang=>({...FEEDBACK,elements:{task:{good:lang==='mn'?'Хоёр асуултад хоёуланд нь хариулсан.':'You answered both questions.',try:lang==='mn'?'Яагаад гэдгийг нэг өгүүлбэрээр нэмээрэй.':'Add one more sentence about why.'},
 language:{good:lang==='mn'?'Одоо болон өнгөрсөн цагийг ялгасан.':'You kept present and past apart.',try:lang==='mn'?'«그리고» гэх мэт холбох үг хэрэглээрэй.':'Try a linking word like 「그리고」.',quote:FEEDBACK.elements.language.quote,better:FEEDBACK.elements.language.better},
 delivery:{good:lang==='mn'?'Хурд тохиромжтой байсан.':'Your pace was comfortable.',try:''}}});
const TURNS={order:{heard:'따뜻한 차 두 잔 주세요.',next:{step:'confirm',hint:null}},confirm:{heard:'네, 맞아요.',next:{step:'place',hint:null}},place:{heard:'가져갈게요.',next:{step:'place',hint:'place'}},placeAgain:{heard:'여기서 마실게요.',next:{step:'done',hint:null}}};

test('리허설 WORLD 「말하기 연습」 시범: 플래그·동의·녹음·자동 피드백(가짜)·역할극·세 언어 (390·1280)',{timeout:900000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 가리킨다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-speaking-')),wav=path.join(directory,'voice.wav');voicedWav(wav);
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),SYNK_WORLD_DATA_DIR:path.join(directory,'db'),SYNK_WORLD_SPEAKING_DEV:''}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,calls=[],errors=[],external=[],shots=[],measures={},checks={},progress=[];
 const step=name=>{progress.push(`${new Date().toISOString().slice(11,19)} ${name}`);if(process.env.SYNK_QA_VERBOSE)console.log(progress.at(-1));};
 let browser,page,context,placeTries=0;
 // 가짜 서버 몫의 답을 바꾼다(feedback: ok·unavailable, remaining: 피드백 뒤 남은 횟수, turn: ok·limit).
 const fake={feedback:'ok',remaining:4,turn:'ok'};
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 try{
  for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  // 개발 서버 몫 자체: 플래그 없는 기본 실행은 꺼짐으로 답한다(로그인 없이 부르면 401).
  assert.equal((await fetch(url+'/api/world/speaking',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status'})})).status,401);
  browser=await playwright.chromium.launch({channel:'msedge',headless:true,timeout:30000,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wav}`,'--autoplay-policy=no-user-gesture-required']});
  context=await browser.newContext({viewport:VIEWPORTS[0].size,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce',permissions:['microphone']});context.setDefaultTimeout(30000);
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
  // 마이크 스트림을 모아 두고, 녹음이 끝난 뒤 모든 트랙이 꺼졌는지 본다.
  await context.addInitScript(()=>{const md=navigator.mediaDevices;if(!md?.getUserMedia)return;const real=md.getUserMedia.bind(md);window.__micStreams=[];md.getUserMedia=async c=>{const s=await real(c);window.__micStreams.push(s);return s;};});
  await context.route('**/api/world/speaking',async route=>{
   const body=route.request().postDataJSON();calls.push({action:body.action,item:body.item_id||`${body.roleplay_id}/${body.step_id}`,consent:body.consent,lang:body.lang,mime:body.audio?.mime,bytes:body.audio?.data?.length||0,seconds:body.seconds});
   let data;
   if(body.action==='status')data={ok:true,enabled:true,dailyLimit:5,remaining:5};
   else if(body.action==='feedback')data=fake.feedback==='ok'?{ok:true,status:'ok',feedback:body.lang==='ko'?FEEDBACK:localized(body.lang),remaining:fake.remaining}:{ok:true,status:fake.feedback};
   else if(fake.turn!=='ok')data={ok:true,status:fake.turn};
   else{const key=body.step_id==='place'&&placeTries++>0?'placeAgain':body.step_id;const turn=TURNS[key];data={ok:true,status:'ok',turn:{status:'ok',counted:true,heard:turn.heard,unclear:false,slots:{},polite:'yes',better:key==='place'?'여기서 마실게요.':'',tip:'',next:turn.next}};}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  // 입장: 화면 상태를 보며 언어 고르기 → 한글 질문 → 튜터 고르기 → 합성 계정 player-a로 로그인 → 「한글 기록 옮기기」는 이 기기에만 두기 → 준비 끝.
  const enter=async(query='')=>{
   await page.goto(url+'/mobile.html?opening=off'+query,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client);
   for(let i=0;i<120;i++){
    const state=await page.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].some(n=>n.getClientRects().length>0);
     return vis('[data-lang-picker]')?'lang':vis('dialog[open] [data-world="device-records"][data-choice="keep"]')?'records':vis('dialog[open] [data-first-hangul="reads"]')?'hangul':vis('dialog[open] .tutor-option')?'tutor':vis('[data-world="guest"]')?'welcome'
      :window.__synkWorld.client.snapshot&&document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open]')?'ready':!window.__synkWorld.client.snapshot&&document.querySelector('.world-shell')?.dataset.entry==='ready'?'guest':'wait';});
    if(state==='ready')return;
    if(state==='lang'){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();}
    else if(state==='hangul')await page.locator('dialog[open] [data-first-hangul="reads"]').click();
    else if(state==='records')await page.locator('dialog[open] [data-world="device-records"][data-choice="keep"]').click();
    else if(state==='tutor'){await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();}
    else if(state==='welcome'||state==='guest'){await page.evaluate(()=>{document.querySelector('#qa-login')?.remove();document.body.insertAdjacentHTML('beforeend','<button data-world="login-a" id="qa-login" hidden></button>');document.getElementById('qa-login').click();});await page.waitForFunction(()=>window.__synkWorld.client.snapshot!==null,null,{timeout:60000});}
    await page.waitForTimeout(250);
   }
   throw Error('입장 단계가 끝나지 않았다');
  };
  const openPacks=async()=>{
   if(await page.evaluate(()=>document.querySelector('#world-panel')?.open))await page.locator('#panel-close').click();
   await page.locator('nav [data-view="packs"], [data-view="packs"][data-life-library]').last().click();
   await page.waitForSelector('#panel-content .life-hub');
  };
  const openSpeaking=async()=>{await openPacks();await page.locator('#panel-content [data-world="speaking"]').click();await page.waitForSelector('#panel-content .wsp-list');};
  const measure=()=>page.evaluate(()=>{
   const el=document.querySelector('#panel-content [data-wsp-stage]'),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect(),shown=n=>n.getClientRects().length>0;
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   const small=[],mixed=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){const text=n.textContent.trim();if(!text||!shown(n.parentElement))continue;
    if(/[가-힣]/.test(text)&&parseFloat(getComputedStyle(n.parentElement).fontSize)<13)small.push(text.slice(0,24));
    if(document.documentElement.lang!=='ko'&&/[가-힣]/.test(text)&&!n.parentElement.closest('[lang="ko"]'))mixed.push(text.slice(0,30));}
   const targets=[...el.querySelectorAll('a,button,input')].filter(shown).map(n=>({key:Object.keys(n.dataset)[0]||n.className||n.tagName,height:Math.round(n.getBoundingClientRect().height)}));
   return {lang:document.documentElement.lang,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content.scrollWidth-content.clientWidth,
    viewportOverflow:innerWidth-(visualViewport?.width||innerWidth),overflowing,small,mixed,shortTargets:targets.filter(x=>x.height<44&&x.key!=='wspSelf'),whitePills:[...el.querySelectorAll('.felt-button')].filter(shown).length};
  });
  const shoot=async name=>{await page.evaluate(()=>document.fonts.ready);const file=path.join(out,`${name}.png`);await page.locator('#world-panel').screenshot({path:file});shots.push(path.basename(file));};
  const record=async name=>{measures[name]=await measure();await shoot(name);};
  const speakingLog=()=>page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('synk.world.speaking.v1:')).flatMap(k=>JSON.parse(localStorage.getItem(k)).log||[]));
  const answerOnce=async()=>{await page.locator('#panel-content [data-wsp-start]').click();await page.waitForSelector('#panel-content [data-wsp-skip]');await page.locator('#panel-content [data-wsp-skip]').click();
   await page.waitForSelector('#panel-content [data-wsp-stop]');await page.waitForTimeout(1600);await page.locator('#panel-content [data-wsp-stop]').click();await page.waitForSelector('#panel-content [data-wsp-retry]');};

  // 1. 플래그 없이: 배우기 판에 말하기 줄이 없다.
  step('enter');await enter();step('packs');await openPacks();
  checks.noFlag=await page.locator('#panel-content [data-world="speaking"]').count();assert.equal(checks.noFlag,0);
  checks.noModule=await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('world-speaking-practice.mjs')));assert.equal(checks.noModule,false);
  // 2. ?speaking=preview로 다시 열면 줄이 생긴다.
  step('flag');await enter('&speaking=preview');
  for(const {tag,size} of VIEWPORTS){
   await page.setViewportSize(size);await page.waitForTimeout(200);
   step(`${tag} list`);await openSpeaking();
   checks[`${tag}-list`]=await page.evaluate(()=>[...document.querySelectorAll('#panel-content .wsp-row strong')].map(n=>n.textContent));
   assert.equal(checks[`${tag}-list`].length,7);await record(`${tag}-list`);
   // 1번: 준비 시작 → (처음이면) 동의 → 바로 말하기 → 녹음 → 다 말했어요 → 다시 듣기·자동 피드백
   await page.locator('#panel-content [data-wsp-open="s1-weekend"]').click();await page.waitForSelector('#panel-content .wsp-task[data-type="1"]');
   await record(`${tag}-task1-idle`);
   await page.locator('#panel-content [data-wsp-start]').click();
   if(tag==='390'){await page.waitForSelector('#panel-content .wsp-consent');await record(`${tag}-consent`);await page.locator('#panel-content [data-wsp-consent]').click();}
   await page.waitForSelector('#panel-content [data-wsp-skip]');await record(`${tag}-task1-prep`);
   checks[`${tag}-prepClock`]=await page.locator('#panel-content [data-wsp-clock]').textContent();assert.match(checks[`${tag}-prepClock`],/준비 시간 · \d+초 남음/);
   await page.locator('#panel-content [data-wsp-skip]').click();await page.waitForSelector('#panel-content [data-wsp-stop]');await page.waitForTimeout(2600);
   await record(`${tag}-task1-rec`);
   await page.locator('#panel-content [data-wsp-stop]').click();await page.waitForSelector('#panel-content [data-wsp-send]');
   checks[`${tag}-micReleased`]=await page.evaluate(()=>window.__micStreams.length>0&&window.__micStreams.every(s=>s.getTracks().every(tr=>tr.readyState==='ended')));
   assert.equal(checks[`${tag}-micReleased`],true,'녹음이 끝나면 마이크 트랙을 모두 끈다');
   await record(`${tag}-task1-review`);
   await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content .wsp-els');
   const sent=calls.filter(c=>c.action==='feedback').at(-1);
   assert.equal(sent.consent,'send-once');assert.equal(sent.item,'s1-weekend');assert.match(sent.mime,/^audio\/(webm|ogg|mp4)/);assert.ok(sent.bytes>1000,'소리 몸통이 실렸다');assert.ok(sent.seconds>=2&&sent.seconds<=35);
   checks[`${tag}-feedback`]=await page.evaluate(()=>document.querySelector('#panel-content .wsp-feedback').innerText);
   assert.match(checks[`${tag}-feedback`],/참고/);assert.match(checks[`${tag}-feedback`],/내용 및 과제 수행/);assert.match(checks[`${tag}-feedback`],/발화 전달력/);assert.doesNotMatch(checks[`${tag}-feedback`],/\d+\s*점|[1-6]\s*급|합격/);
   await page.evaluate(()=>document.querySelector('#panel-content .wsp-feedback')?.scrollIntoView({block:'start'}));await record(`${tag}-task1-feedback`);
   if(tag==='1280'){
    // 「제가 한 말과 달라요」: 이 녹음의 피드백 기록이 「세지 않음」으로 바뀌고, 스스로 확인을 열어 둔다.
    await page.locator('#panel-content [data-wsp-misheard]').click();await page.waitForSelector('#panel-content [data-wsp-self-save]');
    checks.misheard=(await speakingLog()).filter(e=>e.source==='ai-reference').at(-1);
    assert.equal(checks.misheard.counted,false);assert.equal(checks.misheard.status,'misheard');
   }
   // 3번(그림 네 칸)과 5번(자료) 화면 — 긴 문제도 연 순간에는 시트 맨 위(제목·문제 첫 줄)가 보인다.
   await page.locator('#panel-content [data-wsp-back]').click();await page.locator('#panel-content [data-wsp-open="s3-birthday"]').click();await page.waitForSelector('#panel-content .wsp-panels img');
   await page.waitForFunction(()=>[...document.querySelectorAll('#panel-content .wsp-panels img')].every(i=>i.complete&&i.naturalWidth>0));
   checks[`${tag}-task3-top`]=await page.evaluate(()=>document.querySelector('#world-panel').scrollTop);assert.equal(checks[`${tag}-task3-top`],0);await record(`${tag}-task3`);
   await page.locator('#panel-content [data-wsp-back]').click();await page.locator('#panel-content [data-wsp-open="s5-bike"]').click();await page.waitForSelector('#panel-content .wsp-bars');
   checks[`${tag}-task5-top`]=await page.evaluate(()=>document.querySelector('#world-panel').scrollTop);assert.equal(checks[`${tag}-task5-top`],0);await record(`${tag}-task5`);
   await page.locator('#panel-content [data-wsp-back]').click();
  }
  // 4. 역할극(390): 직원 말(승인 목소리) → 말하기 → 다음 말 · 마실 곳을 틀리면 튜터가 돕고 다시 → 주문 완료
  step('roleplay');await page.setViewportSize(VIEWPORTS[0].size);await page.locator('#panel-content [data-wsp-roleplay="rp-cafe-tea"]').click();await page.waitForSelector('#panel-content .wsp-roleplay');
  await record('390-roleplay-intro');
  await page.locator('#panel-content [data-wsp-rp-start]').click();
  for(const [turnNo,step] of ['order','confirm','place','place'].entries()){
   await page.waitForSelector('#panel-content [data-wsp-rp-speak]',{timeout:30000});
   if(step==='order')await record('390-roleplay-turn');
   await page.locator('#panel-content [data-wsp-rp-speak]').click();await page.waitForSelector('#panel-content [data-wsp-rp-stop]');await page.waitForTimeout(1600);
   await page.locator('#panel-content [data-wsp-rp-stop]').click();
   // 이 차례의 서버 몫(가짜)이 답할 때까지 기다린다(다음 차례 판단이 그 답에 달려 있다).
   for(let w=0;calls.filter(c=>c.action==='turn').length<turnNo+1&&w<300;w++)await page.waitForTimeout(100);
   if(turnNo===2){await page.waitForSelector('#panel-content [data-wsp-rp-speak]');checks.placeHint=await page.locator('#panel-content [data-wsp-bubble]').textContent();await record('390-roleplay-hint');}
  }
  await page.waitForSelector('#panel-content .wsp-done');await record('390-roleplay-done');
  // 마무리 문장은 고른 튜터(몽글) 이름으로, 끝난 뒤에는 지난 직원 말 셋이 모두 글로 보인다.
  checks.ending=await page.locator('#panel-content .wsp-done').textContent();assert.match(checks.ending,/몽글과 창가 자리/);
  checks.staffText=await page.evaluate(()=>document.querySelectorAll('#panel-content .wsp-say[data-who="staff"] p[lang="ko"]').length);assert.equal(checks.staffText,3);
  checks.roleplayCalls=calls.filter(c=>c.action==='turn').map(c=>c.item);
  assert.deepEqual(checks.roleplayCalls,['rp-cafe-tea/order','rp-cafe-tea/confirm','rp-cafe-tea/place','rp-cafe-tea/place']);
  assert.match(checks.placeHint,/여기 앉아서/,'마실 곳을 틀리면 튜터(몽글)가 말풍선으로 돕는다');
  // 4-1. 서버 사정(피드백을 만들지 못함): 보낼 단추 없이 스스로 확인을 열고, 남기면 그 시도만 센다.
  step('server trouble');await page.locator('#panel-content [data-wsp-back]').click();await page.locator('#panel-content [data-wsp-open="s1-weekend"]').click();await page.waitForSelector('#panel-content [data-wsp-start]');
  await answerOnce();fake.feedback='unavailable';await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content [data-wsp-self-save]');
  assert.equal(await page.locator('#panel-content [data-wsp-send]').count(),0);await record('390-task1-unavailable');
  await page.locator('#panel-content [data-wsp-self]').first().check();await page.locator('#panel-content [data-wsp-self-save]').click();
  checks.unavailable=(await speakingLog()).slice(-2).map(e=>({source:e.source,status:e.status,counted:e.counted}));
  assert.deepEqual(checks.unavailable,[{source:'ai-unavailable',status:'unavailable',counted:false},{source:'self',status:'self',counted:true}]);
  // 4-2. 오늘 몫을 다 쓴 뒤: 다음 녹음은 보낼 단추 대신 안내와 스스로 확인.
  step('used up');fake.feedback='ok';fake.remaining=0;await page.locator('#panel-content [data-wsp-retry]').click();await answerOnce();
  await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content .wsp-els');
  await page.locator('#panel-content [data-wsp-retry]').click();await answerOnce();await page.waitForSelector('#panel-content [data-wsp-self-save]');
  assert.equal(await page.locator('#panel-content [data-wsp-send]').count(),0);
  checks.usedUp=await page.locator('#panel-content .wsp-review').innerText();assert.match(checks.usedUp,/오늘 받을 수 있는 자동 피드백을 다 받았어요/);await record('390-task1-limit');
  fake.remaining=4;
  // 4-3. 역할극 서버 사정: 따라 말하기로 넘겨 예시 문장과 「다음 말 듣기」를 연다.
  step('roleplay trouble');await page.locator('#panel-content [data-wsp-back]').click();await page.locator('#panel-content [data-wsp-roleplay="rp-cafe-tea"]').click();await page.waitForSelector('#panel-content [data-wsp-rp-start]');
  await page.locator('#panel-content [data-wsp-rp-start]').click();await page.waitForSelector('#panel-content [data-wsp-rp-speak]',{timeout:30000});fake.turn='limit';
  await page.locator('#panel-content [data-wsp-rp-speak]').click();await page.waitForSelector('#panel-content [data-wsp-rp-stop]');await page.waitForTimeout(1600);await page.locator('#panel-content [data-wsp-rp-stop]').click();
  await page.waitForSelector('#panel-content [data-wsp-rp-next]');await record('390-roleplay-self');
  await page.locator('#panel-content [data-wsp-rp-next]').click();await page.waitForSelector('#panel-content [data-wsp-rp-speak]',{timeout:30000});
  checks.selfNext=await page.evaluate(()=>document.querySelectorAll('#panel-content .wsp-say[data-who="staff"]').length);assert.equal(checks.selfNext,2);fake.turn='ok';
  // 5. 영어·몽골어: 화면 글은 그 언어, 한국어는 lang="ko" 칸에만
  for(const lang of ['en','mn']){
   // 계정에 저장된 화면 언어가 주소의 미리 보기(?lang=)를 이기므로(display-language-sync), 설정에서 바꾸듯 setLang을 부른다.
   step(lang);await enter('&speaking=preview');
   await page.evaluate(async lang=>{const m=await import('/brand-opening/world-lang.mjs');m.setLang(lang);},lang);await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);
   await openSpeaking();await record(`390-${lang}-list`);
   await page.locator('#panel-content [data-wsp-open="s1-weekend"]').click();await page.waitForSelector('#panel-content [data-wsp-start]');await page.locator('#panel-content [data-wsp-start]').click();
   await page.waitForSelector('#panel-content [data-wsp-skip]');await page.locator('#panel-content [data-wsp-skip]').click();await page.waitForSelector('#panel-content [data-wsp-stop]');await page.waitForTimeout(1600);
   await page.locator('#panel-content [data-wsp-stop]').click();await page.waitForSelector('#panel-content [data-wsp-send]');await page.locator('#panel-content [data-wsp-send]').click();await page.waitForSelector('#panel-content .wsp-els');
   assert.equal(calls.filter(c=>c.action==='feedback').at(-1).lang,lang);
   await page.evaluate(()=>document.querySelector('#panel-content .wsp-feedback')?.scrollIntoView({block:'start'}));await record(`390-${lang}-feedback`);
  }
  for(const [name,m]of Object.entries(measures)){
   assert.equal(m.docOverflow,0,`${name} 가로 넘침`);assert.equal(m.panelOverflow,0,`${name} 시트 가로 넘침`);assert.deepEqual(m.overflowing,[],`${name} 칸 밖으로 나간 것`);
   assert.deepEqual(m.small,[],`${name} 13px 밑 한글`);assert.deepEqual(m.mixed,[],`${name} lang=ko 밖 한글`);assert.deepEqual(m.shortTargets,[],`${name} 44px 밑 단추`);assert.ok(m.whitePills<=1,`${name} 흰 알약 ${m.whitePills}`);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({at:new Date().toISOString(),progress,shots,checks,measures,calls,errors,external,server:serverOutput.slice(-2000)},null,1)+'\n');
  await browser?.close();server.kill();fs.rmSync(directory,{recursive:true,force:true});
 }
});
