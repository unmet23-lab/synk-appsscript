import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {emptyPlayState} from '../../play-common/play-data.mjs';
// 계정 모드 WORLD(실제 Edge)에서 배우기 판 → 「TOPIK II 쓰기 연습」 → 51·53·54 쓰기 → 규칙 점검 → 자동 피드백(가짜 서버) → 예시답.
// 운영 계정·서버·AI를 쓰지 않는다. 바깥 주소는 막고 계정 API는 아래 가짜만 받는다. 문항 은행은 시험에서만 모두 「검수 통과」로 바꿔 준다.
// 캡처와 result.json은 SYNK_WRITING_QA_OUT(기본 qa/world-writing-20261020/)에 쓴다(그림은 git 밖).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/world-v1-server.js')));
const out=path.resolve(process.env.SYNK_WRITING_QA_OUT||path.join(root,'experiences/synk-world-app/qa/world-writing-20261020'));
const bank=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/world-writing-items.json'),'utf8'));
const opened={...bank,items:bank.items.map(item=>({...item,review:{status:'passed',by:['browser-fixture']}}))};
const A='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222';
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_browser_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const VIEWPORTS=[{tag:'390',size:{width:390,height:844}},{tag:'1280',size:{width:1280,height:800}}];
const FEEDBACK={
 blanks:{kind:'blanks',blanks:[{id:'a',fit:'partial',reason:'안내문 전체가 「-습니다」체라서 끝을 맞추면 좋아요.',better:'수요일에만 내놓으실 수 있습니다.'},{id:'b',fit:'ok',reason:'뒤 문장과 잘 이어져요.',better:''}],note:'다음에는 빈칸 앞말을 되풀이하지 않게 써 봐요.'},
 essay:{kind:'essay',categories:[{id:'content',high:'C',low:'D',good:'두 해의 숫자를 옮겼어요.',fix:'2022년 숫자와 전망이 빠졌어요.',quote:'2020년 300만 명에서'},{id:'structure',high:'C',low:'C',good:'변화부터 썼어요.',fix:'원인과 전망 순서로 이어 보세요.',quote:''},{id:'language',high:'D',low:'E',good:'숫자 단위를 지켰어요.',fix:'「-습니다」가 섞였어요.',quote:'늘었습니다'}],missing:['2022년 780만 명','2026년 전망'],rewrite:{from:'이용자는 2020년 300만 명에서 늘었습니다.',to:'이용자 수는 2020년 300만 명에서 2022년 780만 명으로 늘었다.',why:'「-다」체로 맞추고 숫자를 이어요.'},note:'다음에는 원인 두 가지를 넣어 봐요.'},
};

// 서버 계약: 설명 칸(good·fix·why·missing·note)은 화면 언어로, 한국어는 quote·from·to·better 칸에만 온다.
const localized=(f,lang)=>{const say=lang==='mn'?'Тайлбар':'Note';return {...f,categories:f.categories.map(c=>({...c,good:say+' — good'.replace('good',lang==='mn'?'сайн':'good'),fix:say+(lang==='mn'?' — засах':' — fix')})),missing:[lang==='mn'?'2022 оны тоо':'The 2022 figure'],rewrite:{...f.rewrite,why:lang==='mn'?'Төгсгөлийг тааруулна.':'Match the ending.'},note:lang==='mn'?'Дараа нь шалтгааныг нэмээрэй.':'Next, add the causes.'};};
test('계정 모드 WORLD의 「TOPIK II 쓰기 연습」: 목록·51·53·54·규칙 점검·자동 피드백·예시답·세 언어 (390·1280)',{timeout:600000,skip:!talkRoot&&'형제 저장소 SYNK-talk이 없다(SYNK_TALK_ROOT로 가리킨다)'},async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-writing-'));fs.writeFileSync(path.join(directory,'config.json'),JSON.stringify(config));
 fs.mkdirSync(out,{recursive:true});for(const name of fs.readdirSync(out))if(/\.png$/.test(name))fs.rmSync(path.join(out,name));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,[path.join(root,'experiences/synk-world-app/server.mjs')],{cwd:root,stdio:'pipe',env:{...process.env,SYNK_TALK_ROOT:talkRoot,SYNK_WORLD_PORT:String(port),
  SYNK_WORLD_MODE:'account',SYNK_WORLD_BASE_PATH:'/world/',SYNK_WORLD_ACCOUNT_CONFIG:path.join(directory,'config.json'),SYNK_WORLD_DATA_DIR:path.join(directory,'must-not-create')}});
 let serverOutput='';server.stderr.on('data',c=>serverOutput+=c);server.stdout.on('data',c=>serverOutput+=c);
 const url=`http://127.0.0.1:${port}`,origin=new URL(config.accountApiUrl).origin,calls=[],unexpected=[],errors=[],external=[],shots=[],measures={},checks={};
 let browser,page,context,feedbackMode='ok';
 t.signal.addEventListener('abort',()=>{server.kill('SIGKILL');},{once:true});
 const playState=emptyPlayState();let playRevision=0;
 try{
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(serverOutput);try{const r=await fetch(url+'/world/health');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await playwright.chromium.launch({channel:'msedge',headless:true,timeout:30000});
  context=await browser.newContext({viewport:VIEWPORTS[0].size,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});context.setDefaultTimeout(25000);
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin===url)return route.continue();external.push(route.request().url());return route.abort('blockedbyclient');});
  await context.route('**/world-writing-items.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(opened)}));
  await context.addInitScript(()=>{if(window.top===window&&!sessionStorage.getItem('synk.oauth.session.world'))sessionStorage.setItem('synk.oauth.session.world',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:null,expires_at:Date.now()+3600000}));});
  const cors={'Access-Control-Allow-Origin':'*'};
  await context.route(origin+'/**',async route=>{
   const req=route.request(),target=new URL(req.url());let status=200,data={ok:true};
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{...cors,'Access-Control-Allow-Headers':req.headers()['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'}});return;}
   const body=req.postDataJSON();
   if(target.pathname==='/functions/v1/world-writing/feedback'){
    const h=await req.allHeaders();calls.push({body,product:h['x-synk-product'],contract:h['x-synk-contract'],authorization:h.authorization});
    if(body.action==='status')data={ok:true,accountId:A,enabled:true,dailyLimit:3,bankHash:opened.contentHash};
    else if(feedbackMode==='limit')data={ok:true,accountId:A,status:'limit',dailyLimit:3};
    else data={ok:true,accountId:A,status:'ok',itemId:body.item_id,feedback:Number(body.item_id.slice(1,3))<=52?FEEDBACK.blanks:body.lang==='ko'?FEEDBACK.essay:localized(FEEDBACK.essay,body.lang)};
   }
   else if(target.pathname==='/functions/v1/classroom')data={contract_ver:'c16',ok:true,classes:[]};
   else if(target.pathname.endsWith('/synk-account'))data=body?{ok:true,refreshRevoked:true}:{ok:true,account:{synk_user_id:A,status:'active'},learning:{enabled:false,revision:1},capabilities:{learningSync:true},sessions:[{id:C,current:true,revoked:false,product:'world'}]};
   else if(target.pathname.endsWith('/synk-play')){if(body?.action==='progress')for(const change of body.changes){if(change.value===null)delete playState.records[change.key];else playState.records[change.key]=change.value;}data={ok:true,scope:'synk-play',accountId:A,revision:body?++playRevision:playRevision,state:structuredClone(playState)};}
   else if(target.pathname.endsWith('/synk-world-v1/bootstrap'))data={ok:true,accountId:A,revision:1,avatar:{characterId:'mongle',slots:{body:'',neck:''}},inventory:[{itemId:'mongle-apron-starter'}],activeRun:null};
   else if(target.pathname.endsWith('/synk-learning'))data={ok:true,revision:1,events:[],cursor:0,hasMore:false};
   else if(target.pathname.endsWith('/synk-personal')){status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
   else if(target.pathname.includes('/synk-classroom/'))data={mode:'account-linked',accountId:A,classes:[],emptyReason:'NO_CLASS',serverTime:new Date().toISOString()};
   else if(target.pathname.startsWith('/auth/v1/logout'))data={};
   else{unexpected.push(target.pathname);status=404;data={ok:false,error:{code:'NOT_IN_FIXTURE'}};}
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:cors});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const start=async(lang=null)=>{
   await page.goto(url+'/world/?opening=off'+(lang?'&lang='+lang:''),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__synkWorld?.client.status==='ready');
   await page.waitForFunction(()=>document.querySelector('[data-lang-picker]')||document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('[data-lang-picker]').count()){await page.locator('[data-lang-choice="ko"]').click();await page.locator('[data-lang-confirm]').click();await page.waitForFunction(()=>!document.querySelector('[data-lang-picker]'));}
   await page.waitForFunction(()=>document.querySelector('dialog[open] [data-first-hangul]')||document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] [data-first-hangul="reads"]').count()){await page.locator('dialog[open] [data-first-hangul="reads"]').click();await page.waitForFunction(()=>!document.querySelector('dialog[open] [data-first-hangul]'));}
   await page.waitForFunction(()=>document.querySelector('dialog[open] .tutor-option')||document.querySelector('.world-shell')?.dataset.entry==='ready');
   if(await page.locator('dialog[open] .tutor-option[data-tutor-id="mongle"]').count()){await page.locator('.tutor-option[data-tutor-id="mongle"]').click();await page.locator('.tutor-primary').click();await page.locator('.tutor-primary[data-tutor-action="finish"]').click();}
   await page.waitForFunction(()=>document.querySelector('.world-shell')?.dataset.entry==='ready'&&!document.querySelector('dialog[open] .tutor-option'));
  };
  const openWriting=async()=>{
   if(await page.evaluate(()=>document.querySelector('#world-panel')?.open))await page.locator('#panel-close').click();
   await page.locator('nav [data-view="packs"], [data-view="packs"][data-life-library]').last().click();
   await page.locator('#panel-content [data-world="writing"]').click();
   await page.waitForSelector('#panel-content .ww-list-view');
  };
  const measure=()=>page.evaluate(()=>{
   const el=document.querySelector('#panel-content [data-ww-stage]'),content=document.querySelector('#panel-content'),box=el.getBoundingClientRect(),shown=n=>n.getClientRects().length>0;
   const overflowing=[...el.querySelectorAll('*')].filter(n=>shown(n)&&!n.closest('table')&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>n.className||n.tagName);
   const small=[],mixed=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   for(let n=walker.nextNode();n;n=walker.nextNode()){const text=n.textContent.trim();if(!text||!shown(n.parentElement))continue;
    if(/[가-힣]/.test(text)&&parseFloat(getComputedStyle(n.parentElement).fontSize)<13)small.push(text.slice(0,24));
    // 한 자리 한 언어: 한국어가 아닌 화면에서 lang="ko" 칸 밖에 한글이 있으면 안 된다.
    if(document.documentElement.lang!=='ko'&&/[가-힣]/.test(text)&&!n.parentElement.closest('[lang="ko"]'))mixed.push(text.slice(0,30));}
   const targets=[...el.querySelectorAll('a,button,input,textarea')].filter(shown).map(n=>({key:n.dataset.wwOpen||n.className||n.tagName,height:Math.round(n.getBoundingClientRect().height)}));
   return {lang:document.documentElement.lang,innerWidth,docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,panelOverflow:content.scrollWidth-content.clientWidth,
    overflowing,small,mixed,shortTargets:targets.filter(x=>x.height<44),whitePills:[...el.querySelectorAll('.felt-button')].filter(shown).length,
    columns:(()=>{const q=el.querySelector('.ww-question'),a=el.querySelector('.ww-answer');if(!q||!a)return null;const r1=q.getBoundingClientRect(),r2=a.getBoundingClientRect();return r2.left>=r1.right-1?'side':'stack';})()};
  });
  const shoot=async name=>{await page.evaluate(()=>document.fonts.ready);const file=path.join(out,`${name}.png`);await page.locator('#world-panel').screenshot({path:file});shots.push(path.basename(file));};
  const record=async name=>{measures[name]=await measure();await shoot(name);};
  const scrollTo=selector=>page.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'start'}),selector);

  await start();
  for(const {tag,size} of VIEWPORTS){
   await page.setViewportSize(size);await page.waitForTimeout(200);
   // 390에서 쓴 글은 같은 계정·같은 기기라 1280에서도 남는다(「이어 쓰기」).
   await openWriting();
   checks[`${tag}-list`]=await page.evaluate(()=>({rows:[...document.querySelectorAll('#panel-content .ww-row strong')].map(n=>n.textContent),primary:document.querySelector('#panel-content .ww-primary')?.textContent.trim(),eyebrow:document.querySelector('#panel-eyebrow')?.textContent}));
   assert.equal(checks[`${tag}-list`].rows.length,bank.items.length+1);assert.match(checks[`${tag}-list`].primary,tag==='390'?/51번부터 시작/:/이어 쓰기/);
   await record(`${tag}-list`);
   // 51: 앞말 되풀이 + 문체 섞임 → 규칙 점검 → 자동 피드백
   await page.locator('#panel-content [data-ww-open="w51-recycle"]').last().click();await page.waitForSelector('#panel-content .ww-task[data-type="51"]');
   await page.locator('#panel-content [data-ww-blank="a"]').fill('다음 달부터는 수요일에만 내놓으세요');
   await page.locator('#panel-content [data-ww-blank="b"]').fill('수거하지 않습니다');
   await page.locator('#panel-content [data-ww-check]').click();await page.waitForSelector('#panel-content .ww-checks');
   checks[`${tag}-51`]=await page.evaluate(()=>[...document.querySelectorAll('#panel-content .ww-results .ww-check')].map(n=>n.innerText.replace(/\s+/g,' ')));
   assert.equal(checks[`${tag}-51`].length,2);assert.match(checks[`${tag}-51`].join(' '),/앞에 있는 말/);assert.match(checks[`${tag}-51`].join(' '),/-습니다/);
   await record(`${tag}-51-check`);
   await page.locator('#panel-content [data-ww-ai]').click();await page.waitForSelector('#panel-content .ww-feedback .ww-checks');
   checks[`${tag}-51-ai`]=await page.evaluate(()=>document.querySelector('#panel-content .ww-feedback').innerText);
   assert.match(checks[`${tag}-51-ai`],/조금 고쳐 봐요/);assert.match(checks[`${tag}-51-ai`],/참고용이에요/);assert.doesNotMatch(checks[`${tag}-51-ai`],/d+s*점|[1-6]s*급|합격입니다|불합격/);
   await scrollTo('#panel-content .ww-feedback');await record(`${tag}-51-feedback`);
   // 53: 제목·문체·개조식 → 점검, 예시답 펼침, 자동 피드백(범주별 참고 범위)
   await page.locator('#panel-content [data-ww-back]').click();await page.locator('#panel-content [data-ww-open="w53-resale"]').last().click();await page.waitForSelector('#panel-content .ww-task[data-type="53"]');
   await page.locator('#panel-content [data-ww-text]').fill('중고 거래 앱 이용자 수의 변화\n이용자는 2020년 300만 명에서 늘었습니다.\n- 물가 상승');
   checks[`${tag}-53-counter`]=await page.locator('#panel-content [data-ww-count="text"]').textContent();
   await page.locator('#panel-content [data-ww-check]').click();await page.waitForSelector('#panel-content .ww-checks');
   checks[`${tag}-53`]=await page.evaluate(()=>document.querySelector('#panel-content .ww-results').innerText);
   assert.match(checks[`${tag}-53`],/제목처럼/);assert.match(checks[`${tag}-53`],/개조식/);assert.match(checks[`${tag}-53`],/780만/);
   await page.locator('#panel-content [data-ww-ai]').click();await page.waitForSelector('#panel-content .ww-feedback .ww-cats');
   checks[`${tag}-53-ai`]=await page.evaluate(()=>[...document.querySelectorAll('#panel-content .ww-cat .ww-range')].map(n=>n.textContent.trim()));
   assert.deepEqual(checks[`${tag}-53-ai`],['참고 범위 C~D','참고 범위 C','참고 범위 D~E']);
   if(await page.locator('#panel-content [data-ww-model]').getAttribute('aria-expanded')!=='true')await page.locator('#panel-content [data-ww-model]').click();await page.waitForSelector('#panel-content .ww-model:not([hidden]) .ww-model-text');
   await record(`${tag}-53-top`);await scrollTo('#panel-content .ww-results');await record(`${tag}-53-results`);await scrollTo('#panel-content .ww-model');await record(`${tag}-53-model`);
   // 54: 1280에서는 문제지 | 답안 두 단, 390에서는 한 줄로 쌓인다.
   await page.locator('#panel-content [data-ww-back]').click();await page.locator('#panel-content [data-ww-open="w54-shared-rules"]').last().click();await page.waitForSelector('#panel-content .ww-task[data-type="54"]');
   await record(`${tag}-54`);
   assert.equal(measures[`${tag}-54`].columns,tag==='1280'?'side':'stack');
   // 하루 한도: 자동 피드백이 limit이면 안내만, 규칙 점검은 그대로
   // 연타해도 요청은 하나다(보내는 중 가드).
   {const before=calls.filter(c=>c.body?.action==='feedback').length;await page.locator('#panel-content [data-ww-text]').fill('공동 생활에는 규칙이 필요하다. 그래서 모두가 지켜야 한다.');await page.locator('#panel-content [data-ww-ai]').dblclick();await page.waitForSelector('#panel-content .ww-feedback .ww-cats');assert.equal(calls.filter(c=>c.body?.action==='feedback').length-before,1,'연타는 한 번');}
   feedbackMode='limit';await page.locator('#panel-content [data-ww-text]').fill('공동 생활에는 규칙이 필요하다.');await page.locator('#panel-content [data-ww-ai]').click();
   await page.waitForFunction(()=>/다 썼어요/.test(document.querySelector('#panel-content .ww-feedback')?.textContent||''));feedbackMode='ok';
   // 시간 숨기기는 기기에 남는다
   await page.locator('#panel-content [data-ww-timer-toggle]').click();assert.equal(await page.locator('#panel-content [data-ww-timer]').isHidden(),true);
   await page.locator('#panel-content [data-ww-timer-toggle]').click();
  }
  // 세 언어: 영어·몽골어 화면에서 한국어는 lang="ko" 칸(문제·학생 글·인용)에만 있다.
  for(const code of ['en','mn']){
   await page.setViewportSize(VIEWPORTS[0].size);
   // 계정의 생활 기록 display 칸이 기기 언어를 이긴다(display-language-sync.mjs) — 가짜 계정 기록과 기기 둘 다 바꾼다.
   const walk=v=>{if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(k==='display'&&x&&typeof x==='object'&&x.language)x.language=code;else if(typeof x==='string'&&/"display":{"version":1,"language":"(ko|en|mn)"/.test(x))v[k]=x.replace(/("display":{"version":1,"language":")(ko|en|mn)"/g,'$1'+code+'"');else walk(x);}};walk(playState.records);
   await page.evaluate(code=>localStorage.setItem('synk.world.lang',code),code);await start(code);
   assert.equal(await page.evaluate(()=>document.documentElement.lang),code);
   await openWriting();await record(`390-${code}-list`);
   await page.locator('#panel-content [data-ww-open="w53-resale"]').last().click();await page.waitForSelector('#panel-content .ww-task[data-type="53"]');
   await page.locator('#panel-content [data-ww-check]').click();await page.locator('#panel-content [data-ww-ai]').click();await page.waitForSelector('#panel-content .ww-feedback .ww-cats');
   await record(`390-${code}-53`);
  }
  for(const [name,m] of Object.entries(measures)){
   assert.equal(m.docOverflow,0,name);assert.equal(m.panelOverflow,0,name);assert.deepEqual(m.overflowing,[],name);
   assert.deepEqual(m.small,[],name);assert.deepEqual(m.shortTargets,[],name);assert.ok(m.whitePills<=1,`${name} 흰 알약 ${m.whitePills}`);
   if(m.lang!=='ko')assert.deepEqual(m.mixed,[],`${name} 한 자리 한 언어`);
  }
  const posts=calls.filter(c=>c.body?.action==='feedback');
  assert.ok(posts.length>=4);
  for(const c of calls){assert.equal(c.product,'world');assert.equal(c.contract,'1');assert.equal(c.authorization,'Bearer synthetic-browser-token');}
  for(const c of posts){assert.equal(c.body.consent,'send-once');assert.equal(c.body.bank_hash,opened.contentHash);assert.match(c.body.request_id,/^[0-9a-f-]{36}$/);assert.ok(['ko','en','mn'].includes(c.body.lang));}
  assert.deepEqual(posts.map(c=>c.body.lang).slice(-2),['en','mn']);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checkedAt:new Date().toISOString(),viewports:VIEWPORTS.map(v=>v.tag),shots,measures,checks,feedbackCalls:posts.map(c=>({item:c.body.item_id,lang:c.body.lang})),external:[...new Set(external)].length},null,1));
 }finally{await browser?.close();server.kill();}
});
