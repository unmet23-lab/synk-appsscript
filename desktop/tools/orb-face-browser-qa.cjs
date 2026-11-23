'use strict';
// 검정 구 얼굴(PC 클라이언트 1단계)의 실제 Chromium 흐름 시험. 1단계_구현설계.md 15절의 흐름 1~15를 사람처럼 누른다.
// 숨은 Electron 창에 실제 synk-desktop://platform/index.html을 띄우고 합성 다리(orb-face-fixture.cjs)로 인증 · 배정 · 초대 · 구독 자료를 준다.
// 바깥 요청은 모두 막고, 콘솔 오류와 막힌 요청이 0인지 본다. 결과 JSON과 캡처는 git 밖 폴더에 쓴다.
// 돌지 않는 것: 11번의 「창이 숨은 채 켬」(숨은 시험 창도 document.hidden이 거짓이라 흉내 낼 수 없다), 8번의 진입 오류 화면
// (실제 호스트는 배정 조회 실패와 예외에도 솔리오로 보내고, 진입 오류는 계정이 바뀌는 경합에서만 생긴다). 둘 다 컨트롤러 시험(orb-face.test.mjs)이 본다.
//   node desktop/tools/orb-face-browser-qa.cjs <결과 폴더>   (ORB_QA_ONLY=19 처럼 차례 하나만)
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const PREFIX='synk-orb-face-qa-';
if(!process.versions.electron){
  const {spawnSync}=require('node:child_process');
  const out=path.resolve(process.argv[2]||path.join(root,'..','.tmp','pc-client-orb-step1-20261116','qa'));
  fs.mkdirSync(out,{recursive:true});
  const runs=[];
  // 한 판(mode)의 한도는 20분이다. main은 차례가 늘어 10분을 넘겼다(계정 건강 19번을 더한 11-20)
  for(const mode of ['main','nowebgl','nocanvas']){
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),PREFIX));
    try{
      const run=spawnSync(require('electron'),[__filename,'--profile='+profile,'--out='+out,'--mode='+mode],{cwd:root,encoding:'utf8',windowsHide:true,timeout:1200000});
      const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith('SYNK_ORB_QA '));
      runs.push(line?JSON.parse(line.slice('SYNK_ORB_QA '.length)):{ok:false,mode,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-3000),stdout:run.stdout?.slice(-2000)});
    }finally{
      if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith(PREFIX))throw Error('Unsafe temporary profile');
      fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
    }
  }
  const result={ok:runs.every(r=>r.ok),runs};
  fs.writeFileSync(path.join(out,'orb-face-qa.json'),JSON.stringify(result,null,2)+'\n');
  process.stdout.write(JSON.stringify({ok:result.ok,out,runs:runs.map(r=>({mode:r.mode,ok:r.ok,checks:r.checks?.length,failed:r.checks?.filter(c=>!c.ok).map(c=>({name:c.name,...c.detail})),error:r.error,stderr:r.stderr,consoleErrors:r.consoleErrors,blockedRequests:r.blockedRequests,timings:r.timings}))},null,2)+'\n');
  if(!result.ok)process.exitCode=1;
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
  const profile=arg('profile'),out=arg('out'),mode=arg('mode')||'main';
  if(!profile||!path.basename(profile).startsWith(PREFIX)||path.dirname(profile)!==os.tmpdir())require('./electron-child-guard.cjs').refuse(__filename,'Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  // 흐름마다 창을 닫고 새로 연다. 열린 창이 0개가 되는 순간 앱이 끝나지 않게 한다
  app.on('window-all-closed',()=>{});
  const ACCOUNT='20000000-0000-4000-8000-000000000002',GEN='10000000-0000-4000-8000-000000000001';
  const signedIn=(purpose='none',n=1)=>({configured:true,status:'signed-in',signedIn:true,sessionGeneration:10+n,accountGeneration:GEN,account:{synk_user_id:ACCOUNT,display_name:'합성 회원'},onboarding:{purpose},library:{status:'ready',appIds:['messenger']}});
  const signedOut={configured:true,status:'signed-out',signedIn:false,sessionGeneration:1,accountGeneration:'90000000-0000-4000-8000-000000000009'};
  const now=Date.now(),H=3600e3,D=864e5;
  const row=(id,service,used,resetsAt,extra={})=>({id,service,source:'auto',label:service,kind:'weekly',state:'ok',plan:'pro',email:'member@example.com',live:{readAt:now-5*60e3,weekly:{usedPercent:used,resetsAt}},...extra});
  const subsReady={ok:true,seq:1,rows:[row('r-claude','claude',36,now+3*D),row('r-gpt','gpt',88,now+5*D),row('r-gemini','gemini',12,now+6*D),{id:'r-hf',service:'higgsfield',source:'auto',label:'Higgsfield',kind:'credit',state:'ok',plan:'plus',billDay:3,live:{readAt:now,credits:1240,planCredits:3000}}],check:{at:now-5*60e3},checking:false,usage:{accounts:{'r-claude':{rate3:5},'r-gpt':{rate3:10},'r-gemini':{rate3:2}}},prices:null};
  const subsNone={ok:true,seq:1,rows:[],check:{at:now-60e3},checking:false,usage:{accounts:{}}};
  // 2단계 첫 조각(17번): 계정 여럿(이 PC에 없는 계정, 다시 로그인, 못 읽음 포함), 지난 7일, 요금, 환율이 있는 구독 자료
  const days7=[null,{v:10},{v:20},{v:0},{v:14},{v:12},{v:5}];
  const subsRich={ok:true,seq:1,rows:[row('r-claude','claude',36,now+3*D,{email:'work@example.com',price:290000,currency:'KRW',billDay:2}),row('r-claude-2','claude',0,now+3*D,{email:'home@example.com',state:'needs-login'}),row('r-claude-3','claude',0,now+3*D,{email:'lab@example.com',state:'error'}),row('r-gpt','gpt',88,now+5*D),row('r-gemini','gemini',12,now+6*D,{email:'g@example.com'}),row('r-gemini-away','gemini',20,now+6*D,{email:'away@example.com',state:'elsewhere'}),{id:'r-hf',service:'higgsfield',source:'auto',label:'Higgsfield',kind:'credit',state:'ok',plan:'plus',billDay:3,live:{readAt:now,credits:1240,planCredits:3000}}],check:{at:now-5*60e3},checking:false,usage:{accounts:{'r-claude':{rate3:5},'r-gpt':{rate3:10},'r-gemini':{rate3:2}},services:{claude:{kind:'pct',days:days7,dayAvg:13.6},gpt:{kind:'pct',days:days7,dayAvg:9.2}}},prices:{services:{claude:{checked:new Date(now-5*D).toISOString().slice(0,10),currency:'USD',krVat:0.1,plans:{pro:{month:20}}}}},settings:{usdKrw:1400}};
  const subsOld={...subsReady,check:{at:now-7*H}};
  // 방문자 분석 요약(합성 숫자). 구글 검색어 하나에 태그를 넣어 화면이 글자로만 넣는지 본다(사이트방문 설계 6절)
  const day=k=>new Date(now-k*D).toISOString().slice(0,10);
  const visitSummary=()=>({판:1,만든때:new Date(now-H).toISOString(),기간날수:7,세는쪽:Array.from({length:15},(_,i)=>'/p'+i+'/'),안세는쪽:['/a/','/b/','/c/','/d/','/e/'],
    방문:{상태:'됨',까닭:null,받은때:new Date(now).toISOString(),켠날:day(10),마지막기록:new Date(now-2*H).toISOString(),사람:12,앞사람:9,본쪽:20,다시연쪽:0,버림:0,급증:null,
      갈래:[{이름:'검색',수:3},{이름:'SNS',수:6},{이름:'AI 답변',수:1},{이름:'직접',수:2},{이름:'다른 사이트',수:0}],
      들어온곳:[{이름:'인스타그램',수:6},{이름:'구글',수:3}],첫쪽:[{쪽:'/',이름:'홈',수:8}],날마다:[1,2,0,3,2,2,2].map((수,i)=>({날:day(6-i),수})),AI방문:1},
    쪽:{상태:'됨',까닭:null,쪽들:[{쪽:'/',이름:'홈',본수:14,떠남수:9,머문시간:'30초~1분',끝까지:0.333,떠남비율:0.5},{쪽:'/pulse/',이름:'PULSE',본수:4,떠남수:2,머문시간:null,끝까지:null,떠남비율:null}]},
    행동:{상태:'됨',까닭:null,문의:{합:1,나눔:[{이름:'문의 메일',수:1},{이름:'문의 양식',수:0}]},앱받기:{합:2,나눔:[{이름:'앱 받기(Windows)',수:2},{이름:'앱 받기(Mac)',수:0}]},문의비율:null,앱받기비율:null,처음들어온곳별:[{갈래:'SNS',문의:1,앱받기:2}]},
    목적:{상태:'됨',까닭:null,방문:5,고른방문:2,고른칸:[{이름:'PULSE · 광고·영상',수:2}]},
    검색:{구글:{상태:'됨',까닭:null,시작:day(28),끝:day(1),노출:1140,클릭:8,평균순위:9.5,앞:{노출:900,클릭:5,평균순위:11},검색어:[{말:'<img src=x onerror=window.__visXss=1>',노출:40,클릭:0},{말:'synk',노출:681,클릭:2}],쪽:[{쪽:'/',노출:317,클릭:3}]},
      네이버:{상태:'등록 전',까닭:'네이버 서치어드바이저에 아직 등록하지 않았습니다.'}},
    AI:{상태:'됨',까닭:null,회차날:day(1),서비스:[{이름:'Claude',설명:'웹 검색을 켠 답',일반질문:24,답받음:24,언급:0,인용:0,브랜드질문:6,브랜드답받음:6,브랜드인용:5},{이름:'Gemini',설명:'검색 없이 기억으로 답한 값',일반질문:24,답받음:22,언급:1,인용:0,브랜드질문:6,브랜드답받음:6,브랜드인용:1}],
      앞회차:{날:day(8),서비스:[{이름:'Claude',언급:0,답받음:24}]},멈춤:{},AI방문:1}});
  // 아직 숫자가 없는 요약: 줄을 숨기지 않고 「측정 전」과 까닭 한 줄로 둔다(빠진 값을 0으로 보이지 않는다)
  const visitEarly=()=>({판:1,만든때:new Date(now-H).toISOString(),기간날수:7,세는쪽:Array.from({length:15},(_,i)=>'/p'+i+'/'),안세는쪽:['/a/','/b/','/c/','/d/','/e/'],
    방문:{상태:'측정 전',까닭:'방문 기록을 켠 뒤 첫 하루를 모으는 중입니다.'},쪽:{상태:'측정 전',까닭:'방문 기록을 켠 뒤 첫 하루를 모으는 중입니다.'},행동:{상태:'측정 전',까닭:'방문 기록을 켠 뒤 첫 하루를 모으는 중입니다.'},
    검색:{구글:{상태:'권한 기다림',까닭:'서치콘솔 읽기 권한을 기다리고 있습니다.'},네이버:{상태:'등록 전',까닭:'네이버 서치어드바이저에 아직 등록하지 않았습니다.'}},AI:{상태:'측정 전',까닭:'아직 물은 회차가 없습니다.'}});
  app.whenReady().then(async()=>{
    const checks=[],consoleErrors=[],blockedRequests=[],timings={},loadFailures=[];let shot=0;
    const check=(name,ok,detail={})=>{checks.push({name,ok:!!ok,detail});};
    // ORB_QA_ONLY=8,11 처럼 주면 그 차례만 돈다(고친 뒤 빨리 다시 볼 때). 비우면 모두 돈다
    const ONLY=String(process.env.ORB_QA_ONLY||'').split(',').map(s=>s.trim()).filter(Boolean);const only=id=>!ONLY.length||ONLY.includes(id);
    Menu.setApplicationMenu(null);
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    async function open({width=1440,height=900,partition}={}){
      const ses=session.fromPartition(partition||('orb-qa-'+Date.now()+Math.random()));
      ses.setPermissionRequestHandler((_c,_p,cb)=>cb(false));ses.setPermissionCheckHandler(()=>false);
      if(!ses.__orbQa){ses.__orbQa=true;ses.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,cb)=>{blockedRequests.push(details.url);cb({cancel:true});});ses.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));}
      const win=new BrowserWindow({width,height,useContentSize:true,show:false,frame:false,backgroundColor:'#000000',webPreferences:{...preferences(path.join(__dirname,'orb-face-fixture.cjs')),session:ses,backgroundThrottling:false,additionalArguments:mode==='nowebgl'?['--orb-qa-no-webgl']:mode==='nocanvas'?['--orb-qa-no-canvas']:[]}});
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      win.webContents.on('console-message',details=>{if(details.level==='error')consoleErrors.push(String(details.message).slice(0,300));});
      win.webContents.on('render-process-gone',(_e,details)=>{consoleErrors.push('render-process-gone '+details.reason);});
      win.webContents.on('did-fail-load',(_e,code,desc,url,main)=>{if(main)loadFailures.push({code,desc,url});});
      const js=script=>win.webContents.executeJavaScript(script);
      return {win,js,ses};
    }
    // 불러오기가 멈춤 신호로 끝나도 화면이 실제로 떴으면 잇는다(몇 번 그랬는지 적는다)
    async function load(w){
      try{await w.win.loadURL('synk-desktop://platform/index.html');}
      catch(error){for(let i=0;i<100;i++){if(await w.js('typeof window.__orbFixture==="object"&&!!document.getElementById("portal-entry")').catch(()=>false)){timings.loadStoppedEarly=(timings.loadStoppedEarly||0)+1;return;}await wait(50);}throw error;}
    }
    async function boot(w,config,{restore=null,restoreAfter=0,fold=false}={}){
      const t0=Date.now();
      await load(w);
      await w.js('window.__orbFixture.configure('+JSON.stringify(config||{})+')');
      // 11-20부터 구독 줄은 「상세내역」 안에 접혀 있다(솔리오 구독 비서 설계 3.5). 줄을 누르는 앞 흐름은 상세내역을 한 번 펼친 채로 본다.
      // 자바스크립트 click이라 초점은 옮기지 않는다. 접힌 판 자체는 20번이 fold:true로 본다
      // 앞 흐름은 줄의 자리(포인터 사건을 보내는 좌표)를 옛 판 그대로 재므로, 비서 판은 그 흐름에서만 감춘다
      if(!fold)await w.js("(()=>{if(window.__detailsAuto)return true;window.__detailsAuto=1;const st=document.createElement('style');st.textContent='#portal-entry [data-brief],#portal-entry [data-details-top],#portal-entry [data-dial]{display:none!important}#portal-entry .room.dialed:not([hidden]){display:block!important}#portal-entry .room.dialed .say{font:var(--display)!important;letter-spacing:-.018em!important;max-width:21em!important}#portal-entry .room.dialed .say .then{margin-top:0!important;font:inherit!important}';document.head.appendChild(st);const t=setInterval(()=>{const b=document.querySelector('#portal-entry [data-details]');if(b&&!b.hidden&&b.getAttribute('aria-expanded')!=='true'){b.click();clearInterval(t);}},25);setTimeout(()=>clearInterval(t),30000);return true;})()");
      if(restore){if(restoreAfter)setTimeout(()=>{w.js('window.__orbFixture.restore('+JSON.stringify(restore)+')').catch(()=>{});},restoreAfter);else await w.js('window.__orbFixture.restore('+JSON.stringify(restore)+')');}
      return t0;
    }
    const state=w=>w.js(`(()=>{const r=document.getElementById('portal-entry'),s=r?.querySelector('.orb-stage');return {phase:r?.dataset.portalState,ui:s?.dataset.ui,mode:document.documentElement.dataset.orbClient,wait:s?.dataset.wait||null,active:r?.dataset.portalActive,hidden:document.hidden,ready:document.documentElement.dataset.ready,eyes:s?.dataset.eyes||null,fan:s?.dataset.fan==='1'};})()`);
    async function until(w,fn,{timeout=9000,every=40}={}){const t=Date.now();let last;while(Date.now()-t<timeout){last=await state(w);if(fn(last))return {ok:true,ms:Date.now()-t,state:last};await wait(every);}return {ok:false,ms:Date.now()-t,state:last};}
    // 창 밖으로 나간 글을 찾을 때, 스크롤하는 조상(방)이 위아래로 잘라 보이지 않는 부분은 빼고 본다. 방의 아래 끝에 걸친 줄을 창 밖으로 세지 않는다(계정 건강 390 캡처).
    // 가로는 자르지 않는다. 방 안의 가로 넘침은 숨은 가로 스크롤이라 창 밖으로 나간 것처럼 센다(계정 건강 카본 B)
    // 끝 모습으로 찍는다: 첫 화면(구가 드러나는 중) 말고는 글의 나타남 효과를 끄고, 숨은 창이 새 장면을 그리도록 다시 그리기를 요청한 뒤 두 번 찍는다
    async function capture(w,name,{moving=false}={}){
      await w.js('document.fonts.ready');
      if(!moving)await w.js("(()=>{if(!document.getElementById('orb-qa-still')){const st=document.createElement('style');st.id='orb-qa-still';st.textContent='#portal-entry,#portal-entry *{transition:none!important;animation:none!important}';document.head.append(st);}return true;})()");
      await wait(moving?120:420);
      w.win.webContents.invalidate();await w.win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(200);w.win.webContents.invalidate();
      const image=await w.win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
      const file=path.join(out,`${String(++shot).padStart(2,'0')}-${mode}-${name}.png`);fs.writeFileSync(file,image.toPNG());
      const metrics=await w.js(`(()=>{const W=innerWidth,Hh=innerHeight,outside=[];for(const el of document.querySelectorAll('#portal-entry *')){const st=getComputedStyle(el);if(st.visibility==='hidden'||st.display==='none'||el.closest('[inert]')||!el.textContent.trim()||el.children.length)continue;const b=el.getBoundingClientRect();if(!b.width||!b.height)continue;if(Number(st.opacity)===0)continue;let hiddenBy=null,pos=st.position;const c={l:b.left,t:b.top,r:b.right,b:b.bottom};for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const as=getComputedStyle(a);if(Number(as.opacity)===0){hiddenBy=a;break;}if(pos==='fixed')continue;if(pos!=='absolute'||as.position!=='static'){const r=a.getBoundingClientRect();if(as.overflowY!=='visible'){c.t=Math.max(c.t,r.top);c.b=Math.min(c.b,r.bottom);}if(as.overflowX!=='visible'&&(b.right<=r.left+1||b.left>=r.right-1)){hiddenBy=a;break;}if(c.b<=c.t+1){hiddenBy=a;break;}}if(!(pos==='absolute'&&as.position==='static'))pos=as.position;}if(hiddenBy)continue;if(c.r>W+1||c.l<-1||c.b>Hh+1||c.t<-1)outside.push((el.className||el.tagName)+':'+el.textContent.trim().slice(0,30));}return {pageOverflow:Math.max(0,document.documentElement.scrollWidth-W),outside};})()`);
      check('capture '+name,metrics.pageOverflow===0&&metrics.outside.length===0,{file:path.basename(file),...metrics});
      return file;
    }
    const click=(w,sel)=>w.js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;el.click();return true;})()`);
    // 실제 자판처럼 글자 사건(char)도 보낸다. 단추는 Enter의 글자 사건에서 눌린다
    const CHAR={Return:'\r',Space:' '};
    const key=async(w,keyCode)=>{w.win.webContents.sendInputEvent({type:'keyDown',keyCode});if(CHAR[keyCode])w.win.webContents.sendInputEvent({type:'char',keyCode:CHAR[keyCode]});w.win.webContents.sendInputEvent({type:'keyUp',keyCode});await wait(60);};
    const calls=w=>w.js('window.__orbFixture.calls()');
    const text=(w,sel)=>w.js(`(document.querySelector(${JSON.stringify(sel)})?.textContent||'').trim()`);
    // 앱에서 닿는 크기만 찍는다: 1440×900, 가장 작은 창 960×680, 그 창을 110 · 125 · 150%로 확대했을 때의 화면 크기(2단계 첫 조각 설계 검토 1차 10)
    const sizes=[[1440,900],[960,680],[873,618],[768,544],[640,453]];
    // 옛 화면(legacy)은 앱 최소 폭 960에서 칸이 겹치는지도 본다(현장 노트 배포_공개 「PC 판 화면 확인을 1440 · 390만 하면」)
    async function captureWide(w,name){for(const [W,Hh] of [[1440,900],[960,680]]){w.win.setContentSize(W,Hh);await wait(380);await capture(w,`${name}-${W}`);}w.win.setContentSize(1440,900);await wait(300);}
    async function captureSizes(w,name){for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await capture(w,`${name}-${W}`);}w.win.setContentSize(1440,900);await wait(300);}

    try{
      if(mode==='nocanvas'){
        // WebGL도 2D 캔버스도 없을 때: CSS가 그리기가 넘긴 자리에 정적 구를 그린다. 묻는 화면, 들어가는 순간, 솔리오 모두 구가 남아야 한다
        const orbAt=()=>w.js("(()=>{const c=document.querySelector('#portal-entry .orb-canvas'),cs=getComputedStyle(c);return {mode:c.dataset.orbMode,image:cs.backgroundImage.slice(0,40),r:parseFloat(c.style.getPropertyValue('--orb-sr'))||0,x:parseFloat(c.style.getPropertyValue('--orb-sx'))||0,y:parseFloat(c.style.getPropertyValue('--orb-sy'))||0,phase:document.getElementById('portal-entry').dataset.portalState,active:document.getElementById('portal-entry').dataset.portalActive};})()");
        const w=await open();await boot(w,{subs:subsReady},{restore:signedOut});
        const r=await until(w,s=>s.phase==='auth'&&s.ui==='ask');check('static orb reaches the ask scene',r.ok,r.state);
        const a1=await orbAt();check('static orb is drawn by CSS on the ask scene',a1.mode==='static'&&a1.image.startsWith('radial-gradient')&&a1.r>40&&a1.x>0&&a1.y>0,a1);
        await capture(w,'static-auth');
        await click(w,'[data-orb-act="signin"]');await wait(200);await w.js('window.__orbFixture.setAuth('+JSON.stringify(signedIn('none'))+')');
        const e=await until(w,s=>s.phase==='entered');const a2=await orbAt();
        check('static orb stays while entering',e.ok&&a2.mode==='static'&&a2.r>0,{state:e.state,orb:a2});
        const a=await until(w,s=>s.mode==='app'&&s.ui==='app');
        // 솔리오가 뜬 뒤 점 로고가 물러나야 작은 구가 된다. 바쁜 PC에서는 0.4초를 넘길 수 있어 4초까지 본다(11-17 CPU 100%에서 두 번 걸림)
        let a3=await orbAt();for(const t=Date.now();!(a3.r>0&&a3.r<a1.r)&&Date.now()-t<4000;){await wait(100);a3=await orbAt();}
        check('static orb reaches Solio as the small orb',a.ok&&a3.mode==='static'&&a3.r>0&&a3.r<a1.r,{state:a.state,orb:a3});await capture(w,'static-solio');
        w.win.destroy();
      }else if(mode==='nowebgl'){
        const w=await open();await boot(w,{subs:subsReady},{restore:signedOut});
        const r=await until(w,s=>s.phase==='auth'&&s.ui==='ask');check('2D fallback reaches the ask scene',r.ok,r.state);
        check('2D fallback draws the orb on a 2D canvas',await w.js("(()=>{const c=document.querySelector('#portal-entry .orb-canvas');return window.__synkOrbNoWebGL===true&&!c.getContext('webgl')&&!!c.getContext('2d');})()"));
        await capture(w,'2d-auth');
        await click(w,'[data-orb-act="signin"]');await wait(200);await w.js('window.__orbFixture.setAuth('+JSON.stringify(signedIn('none'))+')');
        const a=await until(w,s=>s.mode==='app'&&s.ui==='app');check('2D fallback reaches Solio',a.ok,a.state);await capture(w,'2d-solio');
        w.win.destroy();
      }else{
        // 1. 처음 켬(로그아웃)
        if(only('estimate')&&mode==='main'){
          const w=await open();
          try{
            await boot(w,{subs:subsReady},{restore:signedIn(),fold:true});
            const entered=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:15000});
            check('estimate enters the real Solio room',entered.ok,entered.state);
            const selector='[data-orb-act="open-estimate"]';
            for(const [width,height] of [[1440,900],[390,844]]){
              w.win.setContentSize(width,height);await wait(250);
              const visible=await w.js(`(()=>{const b=document.querySelector('${selector}');if(!b||b.hidden)return false;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&b.contains(hit);})()`);
              check('estimate launch control is reachable at '+width,visible);
              await capture(w,'estimate-entry-'+width);
            }
            check('estimate waits for a click',!(await calls(w)).includes('openEstimate'));
            await click(w,selector);await wait(100);
            check('estimate click reaches the desktop bridge',(await calls(w)).filter(x=>x==='openEstimate').length===1);
          }finally{w.win.destroy();}
        }
        if(only('1')){
          const part='orb-qa-returning-'+Date.now();let w=await open({partition:part});const t0=await boot(w,{subs:subsReady},{restore:signedOut});
          const first=await state(w);timings.documentHidden=first.hidden;
          await wait(900);await capture(w,'welcome',{moving:true});
          const r=await until(w,s=>s.phase==='auth'&&s.ui==='ask');timings.guestToAsk=Date.now()-t0;check('1 guest reaches the ask scene by itself',r.ok,{...r.state,ms:timings.guestToAsk});
          // 켤 때 잠든 눈이 떠올라 곧 뜬다(시안 boot). 묻는 장면에서는 자세가 눈을 가리지만 표정은 평소로 남는다
          check('1 the eyes woke during the opening',r.state?.eyes==='calm',r.state);
          check('1 ask shows sign-in, sign-up and the code field',await w.js("['[data-orb-act=signin]','[data-orb-act=signup]','#portal-invite-input'].every(s=>{const e=document.querySelector(s);const b=e.getBoundingClientRect();return b.width>0&&getComputedStyle(e).visibility!=='hidden';})"));
          check('1 window buttons are on the face',await w.js("!!document.querySelector('#portal-entry .portal-window-bar:not([hidden])')"));
          await captureSizes(w,'auth');
          await click(w,'[data-orb-act="signin"]');const si=await until(w,s=>s.phase==='signing-in'&&s.wait==='wait');
          check('1 signing-in line',si.ok&&(await text(w,'[data-ask-status]'))==='브라우저에서 로그인을 마치면 이 창으로 돌아옵니다.',si.state);await capture(w,'signing-in');
          await key(w,'Escape');const back=await until(w,s=>s.phase==='auth'&&!s.wait);check('1 Esc cancels the sign-in',back.ok&&(await calls(w)).includes('cancelSignIn'),back.state);
          await click(w,'[data-orb-act="signup"]');await wait(200);check('17-3 sign-up line on the ask scene',(await text(w,'[data-ask-note]'))==='브라우저에서 가입한 뒤 「로그인」을 눌러 주세요.'&&(await state(w)).phase==='auth');
          // 7. 초대: 틀린 코드 → 까닭 한 줄 → 다시 시도 → 칸에 원문이 골라져 있음
          const raw='SyntheticInvite_1234567890';
          await w.js('window.__orbFixture.setInvite("fail")');
          await w.js(`(()=>{const i=document.getElementById('portal-invite-input');i.value=${JSON.stringify(raw)};i.dispatchEvent(new Event('input',{bubbles:true}));i.form.requestSubmit();})()`);
          const err=await until(w,s=>s.phase==='invite'&&s.wait==='error');const errText=await text(w,'#portal-invite-error');
          check('7 invite error line without the code',err.ok&&errText&&!errText.includes(raw),{...err.state,errText});await capture(w,'invite-error');
          await click(w,'[data-portal-action="close-invite"]');await wait(1900);
          const sel=await w.js(`(()=>{const i=document.getElementById('portal-invite-input');return {value:i.value,start:i.selectionStart,end:i.selectionEnd,focused:document.activeElement===i};})()`);
          check('7 retry keeps the code selected',sel.value===raw&&sel.start===0&&sel.end===raw.length&&sel.focused,sel);
          await w.js('window.__orbFixture.setInvite("received")');
          await w.js(`(()=>{const i=document.getElementById('portal-invite-input');i.blur();document.body.focus();const dt=new DataTransfer();dt.setData('text/plain',${JSON.stringify(raw)});document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));})()`);
          const got=await until(w,s=>s.phase==='invite'&&s.wait==='done');
          check('7 a paste anywhere submits, and a received guest invite stays with one line',got.ok&&(await text(w,'[data-ask-status]'))==='초대받은 공간을 열었습니다. 열린 창에서 이어 가 주세요.',got.state);await capture(w,'invite-received');
          await click(w,'[data-portal-action="close-invite"]');await until(w,s=>s.phase==='auth'&&s.ui==='ask');
          check('7 back leaves an empty code field',(await w.js("document.getElementById('portal-invite-input').value"))==='');
          // 12. 검사 실행 길: 값이 거짓이면 사건을 버린다
          await w.js("document.getElementById('portal-entry').dispatchEvent(new CustomEvent('synk:qa-guest-entry'))");await wait(300);
          check('12 QA guest event is ignored without the main process value',(await state(w)).phase==='auth');
          // 2. 로그인 → 배정 없음 → not-asked 한 번 → 솔리오 첫 화면
          await click(w,'[data-orb-act="signin"]');await until(w,s=>s.phase==='signing-in');
          await w.js('window.__orbFixture.setAuth('+JSON.stringify(signedIn('pending'))+')');
          const sol=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
          // 처음 들어온 때는 작은 구가 자리를 잡은 뒤 잠깐 웃고 평소로 돌아온다(시안 enter)
          const smile=await until(w,s=>s.eyes==='smile',{timeout:4000});check('2 a fresh sign-in smiles once on arrival',smile.ok,smile.state);
          const calm=await until(w,s=>s.eyes==='calm',{timeout:4000});check('2 the smile returns to calm',calm.ok,calm.state);
          const c2=await calls(w);check('2 sign-in lands on Solio and writes not-asked once',sol.ok&&c2.filter(c=>c==='completePurposeOnboarding:not-asked').length===1,{...sol.state,calls:c2});
          // 때 말(「내일 오후」 따위)은 시험을 돌리는 시각에 따라 달라지므로 꼴만 본다(카본 C3)
          // 11-20부터 맨 위는 비서 판의 문장이다(솔리오 구독 비서 설계 3.1): 「지금 속도면 Codex는 내일 오전 8시 30분쯤 바닥납니다.」와 막히는 길이
          check('2 Solio sentence from the synthetic subscriptions',/^지금 속도면 Codex는 (?:\d+분 뒤|오늘|내일|모레|[일월화수목금토]요일) (?:새벽|오전|오후|저녁|밤) \d+시(?: \d+분)?쯤 바닥납니다\.$/.test(await text(w,'[data-say]'))&&/때까지 \d+(?:분|시간|일)쯤 막힙니다\.$/.test(await text(w,'[data-then]')),{say:await text(w,'[data-say]'),then:await text(w,'[data-then]')});
          check('9-tray the face sends no tray list (the main process builds the tray menu, PC 0.5.0 design 1)',JSON.stringify(await w.js('window.__orbFixture.tray()'))==='[]',{tray:await w.js('window.__orbFixture.tray()')});
          check('9-toast no signed-in toast over the face',await w.js("document.getElementById('toast').hidden||!document.getElementById('toast').textContent.includes('로그인했어요')"));
          await captureSizes(w,'solio-ready');
          // 21. 옛 런처의 .rows · .rows .row 규칙을 걷은 뒤에도 얼굴 줄이 같은 값을 받는다(PC 0.5.0 설계 4.5 R3).
          //     901px 위는 칸 틈 24px · 줄 높이 바닥 60px · 줄 묶음 위 테두리 1px이다. 641~900px은 2px 대신 바깥 격자의 틈(normal)을, 640px 아래는 얼굴의 16px · 10px을 쓴다.
          //     숨은 창은 크기를 바꿔도 새 판을 그리기 전까지 innerWidth가 그대로일 때가 있다. 다시 그리기를 청하며 innerWidth가 W가 될 때까지 기다리고, 잰 폭이 W인지도 단언한다(0.5.0 최종 검수 F1)
          const rowsLook=W=>`(()=>{const rows=document.querySelector('#portal-entry .rows:not([hidden])'),row=rows?.querySelector(':scope > .row');if(!row)return {W:${W},iw:innerWidth,missing:true};const a=getComputedStyle(rows),b=getComputedStyle(row);return {W:${W},iw:innerWidth,theme:document.documentElement.dataset.theme,top:a.borderTopWidth+' '+a.borderTopStyle,topColor:a.borderTopColor,rowTopColor:b.borderTopColor,col:b.columnGap,rowGap:b.rowGap,min:b.minHeight};})()`;
          const sizeTo=async(W,Hh)=>{w.win.setContentSize(W,Hh);for(let i=0;i<60&&(await w.js('innerWidth'))!==W;i++){w.win.webContents.invalidate();if(i===20)await w.win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(50);}await wait(120);};
          const rowStyle=[];
          for(const [W,Hh] of [[1440,900],[960,680],[873,618],[768,544],[640,453],[390,844]]){await sizeTo(W,Hh);rowStyle.push(await w.js(rowsLook(W)));}
          const wantRow=W=>W>900?{col:'24px',rowGap:'24px'}:W>640?{col:'normal',rowGap:'2px'}:{col:'16px',rowGap:'10px'};
          check('21 the face rows keep the old values above 900 px, take the outer grid gap at 641~900 px and their own gap below',rowStyle.every(r=>!r.missing&&r.iw===r.W&&r.top==='1px solid'&&r.min==='60px'&&r.col===wantRow(r.W).col&&r.rowGap===wantRow(r.W).rowGap),rowStyle);
          // 줄 묶음 위 테두리는 낮이든 밤이든(어두운 Windows의 「기기 설정」도 밤과 같은 색) 1px 자리만 있고 보이지 않는다. 옛 값 var(--ink)는 밤에 밝은 줄이 됐고(0.5.0 최종 검수 F2), var(--hair)는 첫 선을 2px로 만들었다(후속 검수 F4)
          await sizeTo(1440,900);
          const themeWas=await w.js('document.documentElement.dataset.theme');
          const rowTheme=[];
          for(const theme of ['day','night']){await w.js(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await wait(60);rowTheme.push(await w.js(rowsLook(1440)));if(theme==='night')await capture(w,'solio-rows-night-1440');}
          await w.js(typeof themeWas==='string'?`document.documentElement.dataset.theme=${JSON.stringify(themeWas)}`:'delete document.documentElement.dataset.theme');
          check('21 in day and night the rows top border keeps its 1px but is not seen',rowTheme.length===2&&rowTheme.every(r=>!r.missing&&r.top==='1px solid'&&r.topColor==='rgba(0, 0, 0, 0)'),rowTheme);
          // 15. 화면 확대
          for(const z of [1.25,1.5]){w.win.webContents.setZoomFactor(z);await wait(500);await capture(w,'solio-zoom-'+Math.round(z*100));}
          w.win.webContents.setZoomFactor(1);await wait(300);
          // Ctrl과 더하기는 막히지 않는다(들어온 뒤 shouldBlockShortcuts는 거짓)
          check('15 zoom keys are not blocked after entry',await w.js("(()=>{const e=new KeyboardEvent('keydown',{key:'=',ctrlKey:true,bubbles:true,cancelable:true});window.dispatchEvent(e);return !e.defaultPrevented;})()"));
          // 9. 들어온 뒤: 작은 구 → 공간 고르기 → Esc · 빈 곳 · 돌아가기
          // 9. 들어온 뒤: 작은 구 → 구 곁의 펼침(2단계 첫 조각) → Esc · 바깥 누름 · 다시 누름
          await click(w,'.here-orb');const sw=await until(w,s=>s.ui==='app'&&s.fan);check('9 the small orb opens the fan beside it, the room stays',sw.ok,sw.state);await wait(700);await capture(w,'fan');
          await key(w,'Escape');const c1=await until(w,s=>s.ui==='app'&&!s.fan);check('9 Esc closes the fan',c1.ok,c1.state);
          check('9 Esc leaves focus on the orb',await w.js("document.activeElement===document.querySelector('#portal-entry .here-orb')"));
          await click(w,'.here-name');await until(w,s=>s.fan);await wait(500);
          await w.js("(()=>{const r=document.getElementById('portal-entry');r.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse',clientX:20,clientY:innerHeight-20}));})()");
          const c3=await until(w,s=>!s.fan);check('9 a press outside closes a pinned fan',c3.ok,c3.state);
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await click(w,'.here-orb');const c4=await until(w,s=>!s.fan);check('9 pressing the orb again closes the fan',c4.ok,c4.state);
          // 구독 방 맨 아래 「계정 관리」 → 새 얼굴의 계정 관리 방(2단계 둘째 조각 설계 9절). 옛 구독 판은 열리지 않는다
          // 실제 누름처럼 단추에 초점을 먼저 둔다(js의 click()은 초점을 옮기지 않는다). 방은 연 단추를 기억해 닫을 때 초점을 돌려준다
          await w.js("document.querySelector('#portal-entry [data-orb-act=subs-manage]').focus()");await click(w,'[data-orb-act="subs-manage"]');await wait(500);
          const mg=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=manage]');return {shown:!!r&&!r.hidden,mode:document.documentElement.dataset.orbClient,solioHidden:document.querySelector('#portal-entry [data-room=solio]').hidden,onSay:document.activeElement===r?.querySelector('[data-aside-say]'),rows:r?r.querySelectorAll('button.row[data-key]').length:0,board:!!document.querySelector('#solio-subscriptions .ms-top')};})()");
          check('9 「계정 관리」 opens the account management room in the face and the old board stays shut',mg.shown&&mg.mode==='app'&&mg.solioHidden&&mg.onSay&&mg.rows>=3&&!mg.board,mg);await captureWide(w,'manage-room');
          await key(w,'Escape');await wait(300);
          const back9=await w.js("(()=>({manage:document.querySelector('#portal-entry [data-room=manage]').hidden,solio:!document.querySelector('#portal-entry [data-room=solio]').hidden,focus:document.activeElement===document.querySelector('#portal-entry [data-orb-act=subs-manage]')}))()");
          check('9 Esc closes the room and gives focus back to 「계정 관리」',back9.manage&&back9.solio&&back9.focus,back9);
          // 펼침의 「설정」은 새 얼굴의 설정 방을 연다(2단계 둘째 조각 설계 9.2). 옛 설정 화면으로 가는 길은 없다
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await w.js("document.querySelector('.fan [data-foot=settings]').focus()");await click(w,'.fan [data-foot="settings"]');await wait(700);
          const st9=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=settings]');return {shown:!!r&&!r.hidden,mode:document.documentElement.dataset.orbClient,onSay:document.activeElement===r?.querySelector('[data-aside-say]'),heading:document.querySelector('#portal-entry [data-orb-heading]').textContent};})()");
          check('9 「설정」 opens the settings room in the face, not the old settings view',st9.shown&&st9.mode==='app'&&st9.onSay&&st9.heading==='설정',st9);await captureWide(w,'settings-room');
          // 「화면」 줄의 효과음 켜고 끄기(11-20). 켜진 채로 서고, 끄면 줄 글에 「효과음 꺼짐」이 붙는다. 다시 켜 두고 줄을 접는다
          const SND='#portal-entry [data-room=settings] [role=switch][data-room-arg=uiSound]',VIEW='#portal-entry [data-room=settings] button.row[data-key="view"]';
          await click(w,VIEW);await wait(500);
          const snd0=await w.js(`(()=>{const q=document.querySelector(${JSON.stringify(SND)});return {on:q?.getAttribute('aria-checked'),label:q?.getAttribute('aria-label')};})()`);
          await captureWide(w,'settings-view-sound');
          await click(w,SND);await wait(500);
          const snd1=await w.js(`(()=>({on:document.querySelector(${JSON.stringify(SND)})?.getAttribute('aria-checked'),row:document.querySelector(${JSON.stringify(VIEW)})?.textContent||''}))()`);
          await click(w,SND);await wait(500);
          const snd2=await w.js(`document.querySelector(${JSON.stringify(SND)})?.getAttribute('aria-checked')`);
          check('9 the screen line has the sound switch, on by default, and turning it off says so in the line',snd0.on==='true'&&snd0.label==='효과음'&&snd1.on==='false'&&snd1.row.includes('효과음 꺼짐')&&snd2==='true',{snd0,snd1,snd2});
          await click(w,VIEW);await wait(400);
          await key(w,'Escape');await wait(400);
          const lb2=await w.js("(()=>({settings:document.querySelector('#portal-entry [data-room=settings]').hidden,solio:!document.querySelector('#portal-entry [data-room=solio]').hidden,mode:document.documentElement.dataset.orbClient}))()");
          check('9 Esc closes the settings room back to Solio',lb2.settings&&lb2.solio&&lb2.mode==='app',lb2);
          await wait(700);check('17 coming back from a room with focus on the orb does not open the fan',!(await state(w)).fan&&await w.js("document.activeElement===document.querySelector('#portal-entry .here-orb')"));
          // 「계정」은 새 얼굴의 내 계정 방을 연다(2단계 둘째 조각 설계 9.3). 옛 내 계정 화면은 그 방의 「마을 기록」으로만 간다
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await click(w,'.fan [data-foot="account"]');await wait(700);
          const ar=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=account]');return {shown:!!r&&!r.hidden,mode:document.documentElement.dataset.orbClient,say:(r?.querySelector('[data-aside-text]')||{}).textContent||'',onSay:document.activeElement===r?.querySelector('[data-aside-say]')};})()");
          check('9 「계정」 opens 내 계정 in the face, not the old account view',ar.shown&&ar.mode==='app'&&ar.say==='합성 회원 님으로 로그인했습니다.'&&ar.onSay,ar);
          const townSel="(()=>{const b=[...document.querySelectorAll('#portal-entry [data-room=account] button.row[data-key]')].find(x=>x.dataset.key==='data');return b;})()";
          await w.js(`${townSel}.click()`);await wait(400);
          await w.js(`(()=>{const t=[...${townSel}.nextElementSibling.querySelectorAll('[data-room-act]')].find(x=>x.dataset.roomAct==='town');t.focus();t.click();return true;})()`);
          const la=await until(w,s=>s.mode==='legacy'&&s.ui==='app');check('9 the town record in 내 계정 opens the old account view',la.ok,la.state);await capture(w,'legacy-account');
          // 옛 화면에서는 어떤 단추를 눌러도 옛 홈 · 라이브러리 · 혜택 · 맞춤 정보로 가지 않는다(Fable 최종)
          const leak=await w.js("(async()=>{const tries=['[data-account-action=insight]','[data-account-action=workspace]','[data-view=home]','[data-view=library]','[data-view=benefits]'];const seen=[];for(const sel of tries){const b=document.querySelector(sel);if(b){b.click();await new Promise(r=>setTimeout(r,120));seen.push([sel,document.documentElement.dataset.view]);}}return {seen,hidden:getComputedStyle(document.querySelector('#view-account .setting-row:has([data-account-action=insight])')||document.body).display,back:getComputedStyle(document.querySelector('#view-account .ap-back')||document.body).display};})()");
          check('9 the old account view cannot leak to settings, home, library, benefits or insight, and its 「← 설정」 is hidden',leak.seen.every(([,v])=>v==='account')&&leak.back==='none',leak);
          await click(w,'[data-orb-act="legacy-back"]');await until(w,s=>s.mode==='app'&&s.ui==='app');await wait(400);
          const tb=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=account]'),a=document.activeElement;return {shown:!!r&&!r.hidden,onTown:a?.dataset?.roomAct==='town'};})()");
          check('9 coming back from the old account view returns to 내 계정 with focus on 「열기」',tb.shown&&tb.onTown,tb);
          // Esc는 펼친 줄을 먼저 접고, 그다음 방을 닫는다. 첫 Esc 뒤에 방이 남고 줄만 접혔는지 먼저 본다(화면 검수 G1)
          await key(w,'Escape');await wait(200);
          const ae1=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=account]'),b=[...r.querySelectorAll('button.row[data-key]')].find(x=>x.dataset.key==='data');return {room:!r.hidden,open:r.querySelectorAll('.more.open').length,folded:!!b&&!b.classList.contains('opened')};})()");
          await key(w,'Escape');await wait(400);
          const ae2=await w.js("({room:!document.querySelector('#portal-entry [data-room=account]').hidden,solio:!document.querySelector('#portal-entry [data-room=solio]').hidden})");
          check('9 Esc folds the row, then closes 내 계정',ae1.room&&ae1.open===0&&ae1.folded&&!ae2.room&&ae2.solio,{ae1,ae2});
          // 14. 들어온 뒤 30초 동안 옛 모습의 대화상자 · 메뉴가 뜨지 않는다
          let stray=null;for(let i=0;i<60;i++){const s=await w.js("(()=>{const open=[...document.querySelectorAll('dialog[open]')].map(d=>d.id);const root=document.documentElement.dataset.orbClient;return {open,root};})()");if(s.open.length||s.root!=='app'){stray=s;break;}await wait(500);}
          check('14 nothing old opens over the face for 30 seconds',!stray,{stray});
          // 10. 로그아웃 → 묻는 화면
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await click(w,'.fan [data-foot="logout"]');
          const lo=await until(w,s=>s.phase==='auth'&&s.ui==='ask',{timeout:12000});check('10 sign-out returns to the ask scene',lo.ok&&(await calls(w)).includes('signOut'),lo.state);
          check('10 the returning flag is cleared',await w.js("localStorage.getItem('synk.orb.returning')===null"));
          // 3. 다시 켬(로그인 복원 1.5초 늦춤): 그동안 글 0, ask를 거치지 않고 솔리오까지
          await w.js('window.__orbFixture.setAuth('+JSON.stringify(signedIn('none',3))+')');await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
          check('3 the returning flag is set after entry',await w.js("localStorage.getItem('synk.orb.returning')==='1'"));
          // 같은 저장소(파티션)로 창을 새로 띄워 다시 켠 것처럼 한다
          w.win.destroy();w=await open({partition:part});const t3=Date.now();await load(w);await w.js('window.__orbFixture.configure('+JSON.stringify({subs:subsReady})+')');
          setTimeout(()=>{w.js('window.__orbFixture.restore('+JSON.stringify(signedIn('none',4))+')').catch(()=>{});},1500);
          let seen=[];const tEnd=Date.now()+9000;let arrived=null;
          while(Date.now()<tEnd){const s=await w.js("(()=>{const st=document.querySelector('.orb-stage');const ask=document.querySelector('[data-layer=ask]');const sw=document.querySelector('[data-layer=switch]');return {phase:document.getElementById('portal-entry')?.dataset.portalState,ui:st?.dataset.ui,askVisible:ask?getComputedStyle(ask).visibility!=='hidden':false,swVisible:sw?getComputedStyle(sw).visibility!=='hidden':false,mode:document.documentElement.dataset.orbClient};})()");seen.push(s);if(s.mode==='app'&&s.ui==='app'){arrived=Date.now()-t3;break;}await wait(50);}
          timings.returningToSolio=arrived;
          check('3 returning boot never shows the ask or chooser layer and reaches Solio',arrived!==null&&!seen.some(s=>s.askVisible||s.swVisible||s.phase==='auth'),{arrivedMs:arrived,phases:[...new Set(seen.map(s=>s.phase))]});
          w.win.destroy();
        }
        // 16. 솔리오 안의 프로그램 오브제와 「방문자 분석」(사이트방문 설계 6절, 맡긴 세션 11-18). 볼 계정에게만 오브제 줄(구독, 방문자 분석)이 있다.
        //     요약에서 온 글은 글자로만 들어가고, 이름이 펼쳐지는 동안(오브제 둘이면 0.55초)에는 머물러도 열리지 않고, 맨 아랫줄은 아래 흐림 위에 남고, 다른 계정에는 앞 계정의 답이 남지 않는다
        if(only('16')&&mode==='main'){
          const w=await open();await boot(w,{subs:subsReady,visits:{ok:true,available:true,summary:visitSummary()}},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const objs=()=>w.js("[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg+':'+o.getAttribute('aria-current'))");
          const o1=await objs();check('16 a viewer account sees 구독 and 방문자 분석 beside the orb',JSON.stringify(o1)===JSON.stringify(['subs:true','visits:false']),{objs:o1});
          const asked=(await calls(w)).filter(c=>c==='visits-snapshot').length;check('16 the summary is read once on arriving at Solio',asked===1,{asked});
          await w.js("(()=>{const st=document.querySelector('#portal-entry .orb-stage');window.__progLog=[];new MutationObserver(()=>window.__progLog.push([st.dataset.prog,performance.now()])).observe(st,{attributes:true,attributeFilter:['data-prog']});window.__overLog=[];document.querySelector('#portal-entry [data-orb-rail]').addEventListener('pointerover',e=>{const o=e.target.closest('.obj');if(o)window.__overLog.push([o.dataset.orbProg,performance.now(),e.pointerType]);});return true;})()");
          const rect=sel=>w.js('(()=>{const r=document.querySelector('+JSON.stringify(sel)+').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()');
          await w.js("(()=>{window.__ptr=null;window.__move=(x,y)=>{const t=document.elementFromPoint(x,y)||document.body,prev=window.__ptr,o={bubbles:true,cancelable:true,composed:true,pointerType:'mouse',pointerId:1,isPrimary:true,clientX:x,clientY:y};if(prev!==t){if(prev)prev.dispatchEvent(new PointerEvent('pointerout',{...o,relatedTarget:t}));t.dispatchEvent(new PointerEvent('pointerover',{...o,relatedTarget:prev}));window.__ptr=t;}t.dispatchEvent(new PointerEvent('pointermove',o));return true;};return true;})()");
          const move=async(x,y)=>{await w.js('window.__move('+x+','+y+')');await wait(20);};
          // 그 오브제 위에 처음 올라온 때부터 그 프로그램이 처음 열린 때까지
          const opened=async name=>w.js('(()=>{const n='+JSON.stringify(name)+',o=window.__overLog.find(e=>e[0]===n);if(!o)return null;const p=window.__progLog.find(e=>e[0]===n&&e[1]>=o[1]);return p?Math.round(p[1]-o[1]):null;})()');
          // 줄 가까이 먼저 가서 이름이 다 펼쳐진 뒤 방문자 분석 위에 머문다: 짧게 열린다
          // 이름 단추 곁에 머물면 구 곁의 펼침이 열리므로(2단계 첫 조각) 오브제 줄의 오른쪽 가까이로 간다
          const here=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-orb-rail]').getBoundingClientRect();return {x:Math.round(r.right+30),y:Math.round(r.top+r.height/2)};})()");await move(here.x,here.y);await wait(900);
          const near=await w.js("document.querySelector('#portal-entry [data-orb-rail]').classList.contains('near')");
          await capture(w,'rail-near');
          await w.js('window.__overLog.length=0;window.__progLog.length=0');
          const v=await rect('#portal-entry [data-orb-prog="visits"]');await move(v.x,v.y);await wait(700);
          const quick=await opened('visits');check('16 after the names are out, resting on 방문자 분석 opens it in about 0.18 s',near&&quick!==null&&quick>=150&&quick<450,{near,ms:quick});
          // 찍는 동안 창 크기가 바뀌어도 손 밑의 오브제가 열리지 않게 포인터를 왼쪽 아래 빈 곳에 둔다
          await move(12,660);await wait(500);
          await captureSizes(w,'visits');
          // 멀리 갔다가 첫 오브제(구독) 위로 곧장 온다: 이름 둘이 펼쳐지는 0.55초 동안은 열리지 않는다
          await move(720,640);await wait(800);await w.js('window.__overLog.length=0;window.__progLog.length=0');
          const s=await rect('#portal-entry [data-orb-prog="subs"]');await move(s.x,s.y);await wait(1300);
          const settle=await opened('subs');check('16 coming straight onto an object waits until the two names are out (0.55 s)',settle!==null&&settle>=520&&settle<1000,{ms:settle});
          // 요약에서 온 글은 글자로만 들어간다
          await click(w,'#portal-entry [data-orb-prog="visits"]');await wait(500);
          const xss=await w.js("(()=>{const room=document.querySelector('#portal-entry [data-room=solio-visits]');return {imgs:room.querySelectorAll('img').length,asText:[...room.querySelectorAll('.mid')].some(m=>m.textContent.startsWith('<img src=x')),ran:window.__visXss===1,rows:room.querySelectorAll('button.row[data-vis]').length,say:room.querySelector('[data-vis-say]').textContent,hidden:room.hidden};})()");
          check('16 summary words stay plain text in the room (no element is made from them)',xss.imgs===0&&xss.asText&&!xss.ran&&xss.rows===5&&!xss.hidden&&xss.say.length>0,xss);
          // 줄을 모두 눌러 펼치고 맨 아래로 내린다: 맨 아랫줄은 아래 흐림(30px) 위에 남는다
          await move(720,860);
          for(let i=0;i<5;i++)await w.js("document.querySelectorAll('#portal-entry [data-room=solio-visits] button.row[data-vis]')["+i+"].click()");
          await wait(900);await capture(w,'visits-open');
          // 펼친 안쪽 줄은 바깥 줄보다 촘촘하다(시안: 위아래 8px, 줄 사이 36~40px)
          const inner=await w.js("(()=>{const m=document.querySelector('#portal-entry [data-room=solio-visits] .more.open .more-in');const rows=[...m.querySelectorAll(':scope > .row')];const tops=rows.map(r=>Math.round(r.getBoundingClientRect().top));const cs=rows[0]?getComputedStyle(rows[0]):null;const kid=rows[0]?[...rows[0].children].map(c=>{const k=getComputedStyle(c);return c.className+':'+Math.round(c.getBoundingClientRect().height)+':'+k.display+':'+k.lineHeight+':'+k.fontSize;}):[];return {kid,rowsTpl:cs?.gridTemplateRows,innerTpl:getComputedStyle(m).gridTemplateRows,heights:rows.map(r=>Math.round(r.getBoundingClientRect().height)),steps:tops.slice(1).map((t,i)=>t-tops[i]),padding:cs?cs.paddingTop+' '+cs.paddingBottom:null,display:cs?.display,outer:Math.round(document.querySelector('#portal-entry [data-room=solio-visits] button.row[data-vis]').getBoundingClientRect().height)};})()");
          check('16 opened inner lines are tighter than the outer lines (about 36 to 40 px apart)',inner.steps.length>0&&inner.steps.every(s=>s>=30&&s<=44),inner);
          const bottom=await w.js("(()=>{const room=document.querySelector('#portal-entry [data-room=solio-visits]');room.scrollTop=room.scrollHeight;room.dispatchEvent(new Event('scroll'));const r=room.getBoundingClientRect(),read=room.querySelector('.read').getBoundingClientRect(),cs=getComputedStyle(room),m=cs.maskImage||cs.webkitMaskImage||'';return {scrolls:room.scrollHeight>room.clientHeight+4,gap:Math.round(r.bottom-read.bottom),mask:m.includes('linear-gradient'),topFade:room.classList.contains('scrolled')&&(m.startsWith('linear-gradient(transparent')||m.startsWith('linear-gradient(rgba(0, 0, 0, 0)')),open:room.querySelectorAll('.more.open').length};})()");
          check('16 the last line stays above the bottom fade, and a scrolled room fades its top edge too',bottom.scrolls&&bottom.mask&&bottom.topFade&&bottom.open===5&&bottom.gap>=30,bottom);
          await capture(w,'visits-bottom');
          // 새 장면(1분마다 오는 상대 시각, 방문자 분석을 다시 눌러 읽은 요약)이 와도 눌러 고정한 줄, 펼침, 자판 초점이 그대로다(0.4.97 공개 후보 검수 A2)
          const rowsNow="[...document.querySelectorAll('#portal-entry [data-room=solio-visits] button.row[data-vis]')]";
          const before=await w.js("(()=>{const rows="+rowsNow+";rows[1].focus({preventScroll:true});return {vals:rows.map(b=>b.querySelector('.val').textContent),focus:document.activeElement?.dataset?.vis||null};})()");
          await w.js('window.__orbFixture.setVisits('+JSON.stringify({ok:true,available:true,summary:{...visitSummary(),방문:{...visitSummary().방문,사람:13,앞사람:10}}})+')');
          const reads=(await calls(w)).filter(c=>c==='visits-snapshot').length;
          await w.js("document.querySelector('#portal-entry [data-orb-prog=visits]').click()");await wait(700);
          const kept=await w.js("(()=>{const rows="+rowsNow+";return {reads:window.__orbFixture.calls().filter(c=>c==='visits-snapshot').length,vals:rows.map(b=>b.querySelector('.val').textContent),pinned:rows.filter(b=>b.classList.contains('pin')&&b.classList.contains('opened')&&b.getAttribute('aria-expanded')==='true'&&!b.nextElementSibling.hasAttribute('aria-hidden')).length,open:document.querySelectorAll('#portal-entry [data-room=solio-visits] .more.open').length,focus:document.activeElement?.dataset?.vis||null,prog:document.querySelector('#portal-entry .orb-stage').dataset.prog};})()");
          check('16 a fresh scene for the same account keeps the pinned lines open and the keyboard focus on its line',kept.reads===reads+1&&JSON.stringify(kept.vals)!==JSON.stringify(before.vals)&&kept.pinned===5&&kept.open===5&&before.focus!==null&&kept.focus===before.focus&&kept.prog==='visits',{before,...kept});
          // 키보드: 오브제 줄은 Tab 한 자리다. 연 오브제만 Tab 차례에 있고, 화살표로 옮긴 초점이 그 프로그램을 연다. Tab은 연 방 안으로 내려간다(0.4.97 최종 검수 F1)
          const kbState="({obj:document.activeElement?.dataset?.orbProg||null,room:document.activeElement?.closest?.('[data-room]')?.dataset?.room||null,prog:document.querySelector('#portal-entry .orb-stage').dataset.prog,tab:[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg+':'+o.getAttribute('tabindex'))})";
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(400);
          await w.js("document.querySelector('#portal-entry [data-orb-prog=subs]').focus()");await key(w,'Tab');await wait(250);
          const kbSubs=await w.js(kbState);
          check('16 Tab from the open object 구독 goes into the subscriptions room, not onto the next object',kbSubs.obj===null&&kbSubs.room==='solio'&&kbSubs.prog==='subs'&&JSON.stringify(kbSubs.tab)===JSON.stringify(['subs:0','visits:-1']),kbSubs);
          await w.js("document.querySelector('#portal-entry [data-orb-prog=subs]').focus()");await key(w,'Right');await w.js("document.activeElement.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))");await wait(300);
          const kb=await w.js(kbState);
          check('16 an arrow key moves along the objects and the object that takes the focus opens its program',kb.obj==='visits'&&kb.prog==='visits'&&JSON.stringify(kb.tab)===JSON.stringify(['subs:-1','visits:0']),kb);
          await key(w,'Tab');await wait(250);
          const kbIn=await w.js(kbState);
          check('16 Tab from the open object 방문자 분석 goes into its room',kbIn.obj===null&&kbIn.room==='solio-visits',kbIn);
          // 자판 초점이 연 오브제에 있는 채로 마우스가 다른 오브제를 열어도, 다음 Tab은 얼굴 첫 자리로 건너뛰지 않고 차례대로 간다(0.4.97 최종 다시 검수 FA1)
          await w.js("document.querySelector('#portal-entry [data-orb-prog=visits]').focus()");await wait(100);
          const subObj=await rect('#portal-entry [data-orb-prog="subs"]');await move(subObj.x,subObj.y);await wait(1300);
          await key(w,'Tab');await wait(250);
          const mix=await w.js("(()=>{const a=document.activeElement;return {obj:a?.dataset?.orbProg||null,room:a?.closest?.('[data-room]')?.dataset?.room||null,first:a===document.querySelector('#portal-entry .here-orb'),prog:document.querySelector('#portal-entry .orb-stage').dataset.prog,visitsTab:document.querySelector('#portal-entry [data-orb-prog=visits]').getAttribute('tabindex')};})()");
          check('16 when the mouse opens another object while the keyboard focus sits on the one before, Tab carries on into the open room instead of jumping back to the start',mix.prog==='subs'&&mix.visitsTab==='-1'&&!mix.first&&mix.room==='solio',mix);
          // 그 오브제 뒤에 얼굴 안의 Tab 자리가 하나도 없으면(구독 방과 그 뒤의 창 단추 묶음을 잠깐 inert로 막아 흉내 낸다) Tab은 얼굴 밖으로 나가지 않고 처음으로 돈다(0.4.97 최종 다시 검수 v4 P3의 의심).
          // Electron은 문서 끝의 Tab을 문서 처음으로 돌리므로 얼굴의 첫 자리로 온다(고치기 전 판도 같다, 이 동작을 지키는 검사). 실제 앱에서는 방 뒤에 창 단추가 있어 Tab이 그리로 가는 것이 맞는 차례다
          await w.js("(()=>{window.__inerted=[document.querySelector('#portal-entry [data-room=solio]'),...new Set([...document.querySelectorAll('#portal-entry [data-window]')].map(b=>b.parentElement))].filter(Boolean);for(const e of window.__inerted)e.inert=true;document.querySelector('#portal-entry [data-orb-prog=visits]').focus();return true;})()");await key(w,'Tab');await wait(250);
          const wrap=await w.js("(()=>{const a=document.activeElement,root=document.querySelector('#portal-entry');const tabbable=[...root.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],[tabindex]')].filter(e=>e.getAttribute('tabindex')!=='-1'&&!e.closest('[inert]')&&!e.hidden&&e.getClientRects().length>0);const r={inRoot:root.contains(a),first:a===tabbable[0],active:(a?.outerHTML||'').slice(0,80)};for(const e of window.__inerted)e.inert=false;return r;})()");
          check('16 with no Tab stop left after the object, Tab wraps to the start of the face instead of leaving it',wrap.inRoot&&wrap.first,wrap);
          await move(720,860);await wait(300);
          // 방문자 분석을 다시 연 뒤에 구독을 누른다(앞 검사가 구독을 열어 둔 채 끝나므로, 누르기가 실제로 구독을 되돌리는지 보게)
          await click(w,'#portal-entry [data-orb-prog="visits"]');await wait(400);
          const beforeSubs=await w.js("document.querySelector('#portal-entry .orb-stage').dataset.prog");
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(400);
          check('16 a click on 구독 brings the subscriptions back',beforeSubs==='visits'&&(await w.js("document.querySelector('#portal-entry .orb-stage').dataset.prog"))==='subs'&&!(await w.js("document.querySelector('#portal-entry [data-room=solio]').hidden")),{beforeSubs});
          // 아직 숫자가 없는 요약: 다섯 줄이 모두 남고 큰 숫자 자리가 「측정 전」이다(방을 열 때 다시 읽는다)
          await w.js('window.__orbFixture.setVisits('+JSON.stringify({ok:true,available:true,summary:visitEarly()})+')');
          await click(w,'#portal-entry [data-orb-prog="visits"]');await wait(700);
          const early=await w.js("(()=>{const room=document.querySelector('#portal-entry [data-room=solio-visits]');return {rows:room.querySelectorAll('button.row[data-vis]').length,vals:[...room.querySelectorAll('button.row[data-vis] .val')].map(v=>v.textContent),zero:/(^|[^0-9])0번/.test([...room.querySelectorAll('button.row[data-vis]')].map(b=>b.textContent).join(' '))};})()");
          check('16 a summary with no numbers yet keeps all five lines as 「측정 전」 with a reason, never 0',early.rows===5&&early.vals.every(v=>v==='측정 전')&&!early.zero,early);
          await capture(w,'visits-early');
          // 다른 계정(볼 계정이 아님)이 들어오면 앞 계정의 답이 화면에 남지 않는다
          await click(w,'#portal-entry [data-orb-prog="visits"]');await wait(400);
          await w.js('window.__orbFixture.setVisits('+JSON.stringify({ok:true,available:false})+')');
          await w.js('window.__orbFixture.setAuth('+JSON.stringify({...signedIn('none',7),account:{synk_user_id:'60000000-0000-4000-8000-000000000006',display_name:'다른 회원'}})+')');
          await wait(600);const back=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1200);
          const o2=await objs();
          const gone=await w.js("(()=>{const room=document.querySelector('#portal-entry [data-room=solio-visits]');return {hidden:room.hidden,rows:room.querySelectorAll('button.row').length,say:room.querySelector('[data-vis-say]').textContent,anyText:/사람이|검색|AI에게/.test(room.textContent)};})()");
          const railGone=await w.js("({rail:document.querySelector('#portal-entry [data-orb-rail]').hidden,mark:document.querySelector('#portal-entry .orb-stage').dataset.rail||null,subs:!document.querySelector('#portal-entry [data-room=solio]').hidden})");
          check('16 another account (not a viewer) gets no objects, Solio as before, and never the previous answer',back.ok&&railGone.rail&&!railGone.mark&&railGone.subs&&gone.hidden&&gone.rows===0&&!gone.say&&!gone.anyText,{objs:o2,...railGone,...gone});
          w.win.destroy();
        }
        // 19. 솔리오 「계정 건강」(계정건강 PC앱_구현설계 10절 · 11절). 오브제 셋(구독, 방문자 분석, 계정 건강)과 계정 건강만 보이는 둘의 경우를 본다.
        //     요약은 판 1의 견본(tests/fixtures)을 지금 시각으로 옮겨 쓴다. 안쪽 글 하나에 태그를 넣어 글자로만 들어가는지 본다
        if(only('19')&&mode==='main'){
          const sample=JSON.parse(fs.readFileSync(path.join(root,'tests','fixtures','sns-health-summary-v1.json'),'utf8'));
          const healthSummary=(patch={})=>{const s=JSON.parse(JSON.stringify(sample));s.만든때=new Date(now-H).toISOString();s.숫자={게시:new Date(now-2*H).toISOString(),팔로워:day(1)};
            const say=s.방.rows[0].more.findIndex(m=>m[0]==='text');if(say>=0)s.방.rows[0].more[say]=['text','<img src=x onerror=window.__heaXss=1> 잘된 편과 안 된 편은 첫 장면에서 갈립니다.'];return Object.assign(s,patch);};
          const healthAnswer=summary=>({ok:true,available:true,summary});
          const objs=w=>w.js("[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg+':'+o.getAttribute('aria-current')+':'+o.style.getPropertyValue('--k'))");
          const pointer=async w=>{await w.js("(()=>{window.__ptr=null;window.__move=(x,y)=>{const t=document.elementFromPoint(x,y)||document.body,prev=window.__ptr,o={bubbles:true,cancelable:true,composed:true,pointerType:'mouse',pointerId:1,isPrimary:true,clientX:x,clientY:y};if(prev!==t){if(prev)prev.dispatchEvent(new PointerEvent('pointerout',{...o,relatedTarget:t}));t.dispatchEvent(new PointerEvent('pointerover',{...o,relatedTarget:prev}));window.__ptr=t;}t.dispatchEvent(new PointerEvent('pointermove',o));return true;};const st=document.querySelector('#portal-entry .orb-stage');window.__progLog=[];new MutationObserver(()=>window.__progLog.push([st.dataset.prog,performance.now()])).observe(st,{attributes:true,attributeFilter:['data-prog']});window.__overLog=[];document.querySelector('#portal-entry [data-orb-rail]').addEventListener('pointerover',e=>{const o=e.target.closest('.obj');if(o)window.__overLog.push([o.dataset.orbProg,performance.now()]);});return true;})()");};
          const move=async(w,x,y)=>{await w.js('window.__move('+x+','+y+')');await wait(20);};
          const rect=(w,sel)=>w.js('(()=>{const r=document.querySelector('+JSON.stringify(sel)+').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()');
          const opened=(w,name)=>w.js('(()=>{const n='+JSON.stringify(name)+',o=window.__overLog.find(e=>e[0]===n);if(!o)return null;const p=window.__progLog.find(e=>e[0]===n&&e[1]>=o[1]);return p?Math.round(p[1]-o[1]):null;})()');
          const ROOM="document.querySelector('#portal-entry [data-room=solio-health]')";
          const rowsNow="[..."+ROOM+".querySelectorAll('button.row[data-vis]')]";

          // 가. 방문자 분석과 계정 건강을 모두 볼 계정: 오브제 셋
          const w=await open();await boot(w,{subs:subsReady,visits:{ok:true,available:true,summary:visitSummary()},health:healthAnswer(healthSummary())},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const o1=await objs(w);
          check('19 a viewer of both sees 구독, 방문자 분석 and 계정 건강 in that order, with the name delays in shown order',JSON.stringify(o1)===JSON.stringify(['subs:true:0','visits:false:1','health:false:2']),{objs:o1});
          const asked=(await calls(w)).filter(c=>c==='health-snapshot').length,askedVisits=(await calls(w)).filter(c=>c==='visits-snapshot').length;
          check('19 each summary is read once on arriving at Solio',asked===1&&askedVisits===1,{asked,askedVisits});
          await pointer(w);
          const here=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-orb-rail]').getBoundingClientRect();return {x:Math.round(r.right+30),y:Math.round(r.top+r.height/2)};})()");await move(w,here.x,here.y);await wait(900);
          const near=await w.js("document.querySelector('#portal-entry [data-orb-rail]').classList.contains('near')");
          await capture(w,'health-rail-near');
          await w.js('window.__overLog.length=0;window.__progLog.length=0');
          const hp=await rect(w,'#portal-entry [data-orb-prog="health"]');await move(w,hp.x,hp.y);await wait(700);
          const quick=await opened(w,'health');
          check('19 after the names are out, resting on 계정 건강 opens it in about 0.18 s',near&&quick!==null&&quick>=150&&quick<450,{near,ms:quick});
          check('19 opening 계정 건강 reads its summary again and not the 방문자 분석 one',(await calls(w)).filter(c=>c==='health-snapshot').length===2&&(await calls(w)).filter(c=>c==='visits-snapshot').length===1);
          await move(w,12,660);await wait(500);
          await captureSizes(w,'health');
          // 줄의 칸끼리 글이 겹치지 않는다(오른쪽 맞춤 칸이 넘치면 왼쪽 칸 위로 번진다). 창 크기마다 글 상자로 잰다
          const gaps=[];
          for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);for(let i=0;i<40&&(await w.js('innerWidth'))!==W;i++)await wait(50);await wait(120);
            gaps.push(await w.js("(()=>{const box=(e)=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return b.width?b:null;};const rows=[..."+ROOM+".querySelectorAll('button.row[data-vis], .more-in > .row')];let min=1e9;for(const b of rows){const cells=[...b.children].map(box).filter(Boolean).filter(c=>c.height);for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){const a=cells[i],c=cells[j];if(a.bottom<=c.top+1||c.bottom<=a.top+1)continue;min=Math.min(min,Math.max(c.left-a.right,a.left-c.right));}}return {W:innerWidth,min:Math.round(min),gap:getComputedStyle(rows[0]).columnGap,cols:getComputedStyle("+ROOM+".querySelector('[data-hea-rows]')).gridTemplateColumns};})()"));}
          w.win.setContentSize(1440,900);await wait(300);
          check('19 the cells of an account line never run into each other at any app size (at least 12 px apart)',gaps.every(g=>g.min>=12),{gaps});
          // 멀리 갔다가 셋째 오브제(계정 건강) 위로 곧장 온다: 이름 셋이 펼쳐지는 0.62초 동안은 열리지 않는다
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(400);
          await move(w,720,640);await wait(800);await w.js('window.__overLog.length=0;window.__progLog.length=0');
          const hp2=await rect(w,'#portal-entry [data-orb-prog="health"]');await move(w,hp2.x,hp2.y);await wait(1400);
          const settle3=await opened(w,'health');
          check('19 coming straight onto the third object waits until the three names are out (0.62 s)',settle3!==null&&settle3>=590&&settle3<1100,{ms:settle3});
          // 요약의 글은 글자로만 들어가고, 줄 꼴 여섯이 그려진다
          await move(w,720,860);
          const room=await w.js("(()=>{const room="+ROOM+";return {hidden:room.hidden,imgs:room.querySelectorAll('img').length,asText:[...room.querySelectorAll('.more-text')].some(m=>m.textContent.startsWith('<img src=x')),ran:window.__heaXss===1,rows:room.querySelectorAll('button.row[data-vis]').length,say:room.querySelector('[data-hea-say]').textContent,then:room.querySelector('[data-hea-then]').textContent,when:room.querySelector('[data-hea-when]').textContent,scope:room.querySelector('[data-hea-scope]').textContent,label:room.querySelector('[data-hea-rows]').getAttribute('aria-label'),bright:[...room.querySelectorAll('button.row[data-vis]')].map(b=>b.classList.contains('now')),speech:room.querySelector('button.row[data-vis]').getAttribute('aria-label')};})()");
          check('19 the 계정 건강 room shows the conclusion, one line per account, when it was measured, and summary words only as text',!room.hidden&&room.imgs===0&&room.asText&&!room.ran&&room.rows===sample.방.rows.length&&room.say===sample.방.say&&room.then===sample.방.then&&room.scope===sample.방.scope&&/^게시 숫자는 .+, 팔로워는 .+에 잰 값입니다\./.test(room.when)&&room.label==='SNS 계정 건강'&&JSON.stringify(room.bright)===JSON.stringify(sample.방.rows.map(r=>!!r.now)),room);
          for(let i=0;i<sample.방.rows.length;i++)await w.js(rowsNow+"["+i+"].click()");
          await wait(900);
          const kinds=await w.js("(()=>{const m="+ROOM+".querySelector('.more.open .more-in');const flow=m.querySelector('.flow');const steps=[...flow.querySelectorAll('.step')];const sub=[...m.querySelectorAll(':scope > .row.sub:not(.do):not(.good):not(.goal)')];const firstDo=m.querySelector('.row.do');return {say:!!m.querySelector('.more-say'),good:!!m.querySelector('.row.good'),heads:m.querySelectorAll('.more-head').length,texts:m.querySelectorAll('.more-text').length,dos:m.querySelectorAll('.row.do').length,firstDoLine:firstDo.classList.contains('first')&&getComputedStyle(firstDo).borderTopStyle==='solid',goal:!!m.querySelector('.row.goal'),steps:steps.map(s=>s.querySelector('b').textContent),leak:steps.map(s=>s.classList.contains('leak')),stepsInRow:new Set(steps.map(s=>Math.round(s.getBoundingClientRect().top))).size,marked:sub.map(r=>r.classList.contains('now')),list:flow.getAttribute('role')+'/'+steps.map(s=>s.getAttribute('role')).join(',')};})()");
          const want=sample.방.rows[0].more;
          check('19 an opened account shows the six new line kinds in the sketch order, the path left to right with only the leaking step bright',kinds.say&&kinds.good&&kinds.heads===want.filter(m=>m[0]==='head').length&&kinds.dos===want.filter(m=>m[0]==='do').length&&kinds.firstDoLine&&kinds.goal===want.some(m=>m[0]==='goal')&&kinds.steps[0]==='1,000'&&kinds.steps.length===want.find(m=>m[0]==='flow')[1].length+1&&kinds.leak.filter(Boolean).length===1&&kinds.stepsInRow===1&&JSON.stringify(kinds.marked)===JSON.stringify(want.filter(m=>m[0]==='row').map(m=>!!m[5]))&&kinds.list.startsWith('list/listitem'),kinds);
          await capture(w,'health-open');
          await w.js(ROOM+".scrollTop=0");await w.js(rowsNow+"[0].scrollIntoView({block:'start'})");await wait(200);
          await capture(w,'health-open-first');
          const bottom=await w.js("(()=>{const room="+ROOM+";room.scrollTop=room.scrollHeight;room.dispatchEvent(new Event('scroll'));const r=room.getBoundingClientRect(),read=room.querySelector('.read').getBoundingClientRect(),cs=getComputedStyle(room),m=cs.maskImage||cs.webkitMaskImage||'';return {scrolls:room.scrollHeight>room.clientHeight+4,gap:Math.round(r.bottom-read.bottom),mask:m.includes('linear-gradient'),topFade:room.classList.contains('scrolled'),open:room.querySelectorAll('.more.open').length};})()");
          check('19 the last line stays above the bottom fade, and a scrolled room fades its top edge too',bottom.scrolls&&bottom.mask&&bottom.topFade&&bottom.open===sample.방.rows.length&&bottom.gap>=30,bottom);
          await capture(w,'health-bottom');
          // 새 장면(계정 건강을 다시 눌러 읽은 요약)이 와도 눌러 고정한 줄, 펼침, 자판 초점이 그대로다
          const before=await w.js("(()=>{const rows="+rowsNow+";rows[1].focus({preventScroll:true});return {when:rows.map(b=>b.querySelector('.when').textContent),focus:document.activeElement?.dataset?.vis||null};})()");
          const next=healthSummary();next.방.rows[0].when='팔로워 20,011 · 한 편 336번';
          await w.js('window.__orbFixture.setHealth('+JSON.stringify(healthAnswer(next))+')');
          await w.js("document.querySelector('#portal-entry [data-orb-prog=health]').click()");await wait(700);
          const kept=await w.js("(()=>{const rows="+rowsNow+";return {when:rows.map(b=>b.querySelector('.when').textContent),pinned:rows.filter(b=>b.classList.contains('pin')&&b.classList.contains('opened')&&b.getAttribute('aria-expanded')==='true').length,focus:document.activeElement?.dataset?.vis||null,prog:document.querySelector('#portal-entry .orb-stage').dataset.prog};})()");
          check('19 a fresh summary for the same account keeps the pinned lines open and the keyboard focus on its line',kept.when[0]==='팔로워 20,011 · 한 편 336번'&&kept.pinned===sample.방.rows.length&&before.focus!==null&&kept.focus===before.focus&&kept.prog==='health',{before,...kept});
          // Esc는 보이는 방의 펼친 줄을 접는다
          await key(w,'Escape');await wait(500);
          check('19 Esc folds the open lines of the 계정 건강 room',(await w.js(ROOM+".querySelectorAll('.more.open').length"))===0);
          // 자판: 화살표로 계정 건강 오브제에 오면 열리고, Tab은 그 방 안으로 내려간다
          const kbState="({obj:document.activeElement?.dataset?.orbProg||null,room:document.activeElement?.closest?.('[data-room]')?.dataset?.room||null,prog:document.querySelector('#portal-entry .orb-stage').dataset.prog,tab:[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg+':'+o.getAttribute('tabindex'))})";
          await click(w,'#portal-entry [data-orb-prog="visits"]');await wait(400);
          await w.js("document.querySelector('#portal-entry [data-orb-prog=visits]').focus()");await key(w,'Right');await w.js("document.activeElement.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))");await wait(300);
          const kb=await w.js(kbState);
          check('19 an arrow key from 방문자 분석 moves onto 계정 건강 and opens it',kb.obj==='health'&&kb.prog==='health'&&JSON.stringify(kb.tab)===JSON.stringify(['subs:-1','visits:-1','health:0']),kb);
          await key(w,'Tab');await wait(250);
          const kbIn=await w.js(kbState);
          check('19 Tab from the open object 계정 건강 goes into its room',kbIn.obj===null&&kbIn.room==='solio-health',kbIn);
          // 가운데 폭(768 · 641)에서도 길의 단계는 둘씩 놓이고, 줄을 바꾼 단계 왼쪽에 빈 세로 선이 남지 않는다(카본 A)
          const mids=[];
          await move(w,12,500);await w.js(rowsNow+"[0].click()");await wait(800);
          for(const W of [960,873,768,641]){w.win.setContentSize(W,560);for(let i=0;i<40&&(await w.js('innerWidth'))!==W;i++)await wait(50);await wait(300);
            await w.js(ROOM+".scrollTop=0");await w.js(rowsNow+"[0].scrollIntoView({block:'start'})");await w.js("(()=>{const h=[..."+ROOM+".querySelectorAll('.more.open .more-head')].at(-1);if(h)h.scrollIntoView({block:'start'});return true;})()");await wait(150);
            await capture(w,'health-open-'+W);
            mids.push(await w.js("(()=>{const m="+ROOM+".querySelector('.more.open .more-in');const sig=m.querySelector(':scope > .row.sub:not(.good):not(.goal):not(.do)'),nb=sig.querySelector('.nm').getBoundingClientRect(),mb=sig.querySelector('.mid').getBoundingClientRect(),rw="+ROOM+".clientWidth;const textUnder=mb.top>=nb.bottom-1&&mb.width>=Math.min(rw*0.6,520);const steps=[...m.querySelectorAll('.step')];const left=Math.min(...steps.map(s=>Math.round(s.getBoundingClientRect().left)));const room="+ROOM+";return {W:innerWidth,textUnder,midWidth:Math.round(mb.width),overflow:Math.max(document.documentElement.scrollWidth-innerWidth,room.scrollWidth-room.clientWidth),steps:steps.length,rows:new Set(steps.map(s=>Math.round(s.getBoundingClientRect().top))).size,rowStartsWithLine:steps.filter(s=>Math.round(s.getBoundingClientRect().left)===left&&getComputedStyle(s).borderLeftStyle!=='none'&&parseFloat(getComputedStyle(s).borderLeftWidth)>0).length};})()"));}
          w.win.setContentSize(1440,900);await wait(400);await w.js(rowsNow+"[0].click()");await wait(500);
          check('19 at 641 to 1000 px an open account puts its explanations under the names at full width, the path steps go two by two below 900 px, no step that starts a line carries a left rule, and the room does not overflow sideways',mids.every(m=>m.textUnder&&(m.W>900||m.rows===Math.ceil(m.steps/2))&&m.rowStartsWithLine===0&&m.overflow<=0),{mids});
          // 좁은 창(390): 이름 아래에 글, 단계는 둘씩
          await move(w,12,600);
          w.win.setContentSize(390,844);await wait(500);
          await w.js(ROOM+".scrollTop=0");await wait(100);
          await capture(w,'health-390');
          await w.js(rowsNow+"[0].click()");await wait(800);
          const narrow=await w.js("(()=>{const m="+ROOM+".querySelector('.more.open .more-in');const steps=[...m.querySelectorAll('.step')];const d=m.querySelector('.row.do');const nm=d.querySelector('.nm').getBoundingClientRect(),mid=d.querySelector('.mid').getBoundingClientRect();const room="+ROOM+";return {perRow:steps.length?steps.filter(s=>Math.round(s.getBoundingClientRect().top)===Math.round(steps[0].getBoundingClientRect().top)).length:0,midBelow:mid.top>=nm.bottom-1,overflow:Math.max(document.documentElement.scrollWidth-innerWidth,room.scrollWidth-room.clientWidth)};})()");
          check('19 at 390 px the words sit under the names and the steps go two by two',narrow.perRow===2&&narrow.midBelow&&narrow.overflow<=0,narrow);
          await capture(w,'health-open-390');
          await w.js(rowsNow+"[0].scrollIntoView({block:'start'})");await w.js(ROOM+".querySelector('.flow').scrollIntoView({block:'center'})");await wait(200);
          await capture(w,'health-flow-390');
          w.win.setContentSize(1440,900);await wait(400);
          // 다른 계정(볼 계정이 아님)이 들어오면 앞 계정의 답이 남지 않는다
          await w.js('window.__orbFixture.setVisits('+JSON.stringify({ok:true,available:false})+')');
          await w.js('window.__orbFixture.setHealth('+JSON.stringify({ok:true,available:false})+')');
          await w.js('window.__orbFixture.setAuth('+JSON.stringify({...signedIn('none',8),account:{synk_user_id:'60000000-0000-4000-8000-000000000006',display_name:'다른 회원'}})+')');
          await wait(600);const back=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1200);
          const gone=await w.js("(()=>{const room="+ROOM+";return {hidden:room.hidden,rows:room.querySelectorAll('button.row').length,say:room.querySelector('[data-hea-say]').textContent,rail:document.querySelector('#portal-entry [data-orb-rail]').hidden,subs:!document.querySelector('#portal-entry [data-room=solio]').hidden};})()");
          check('19 another account (not a viewer) gets no objects and never the previous 계정 건강 answer',back.ok&&gone.hidden&&gone.rows===0&&!gone.say&&gone.rail&&gone.subs,gone);
          w.win.destroy();

          // 나. 계정 건강만 볼 계정(방문자 분석 요약이 없는 PC는 아니지만, 방문자 분석 답이 「볼 수 없음」인 경우): 오브제 둘, 늦춤은 보이는 차례
          const v=await open();await boot(v,{subs:subsReady,health:healthAnswer(healthSummary())},{restore:signedIn('none')});
          await until(v,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const o2=await objs(v);
          check('19 with only 계정 건강 shown, the row is 구독 and 계정 건강, and 계정 건강 takes the second delay',JSON.stringify(o2)===JSON.stringify(['subs:true:0','health:false:1']),{objs:o2});
          check('19 the 방문자 분석 read still happens on the way into Solio (the viewer waiting list depends on it)',(await calls(v)).filter(c=>c==='visits-snapshot').length===1);
          await pointer(v);
          await move(v,720,640);await wait(800);await v.js('window.__overLog.length=0;window.__progLog.length=0');
          const hq=await rect(v,'#portal-entry [data-orb-prog="health"]');await move(v,hq.x,hq.y);await wait(1300);
          const settle2=await opened(v,'health');
          check('19 with two objects, coming straight onto 계정 건강 waits until the two names are out (0.55 s)',settle2!==null&&settle2>=520&&settle2<1000,{ms:settle2});
          await move(v,12,660);await wait(400);
          await capture(v,'health-only-1440');
          v.win.destroy();
        }
        // 20. 솔리오 구독 비서(11-20, docs/디자인/솔리오_구독비서_20261120/설계.md 3절): 맨 위 한 가지, 다가오는 일, 지금 출력, 오늘 진단이 보이고
        //     줄은 상세내역 안에 접혀 있다. 펼치고 접을 때 초점이 body로 빠지지 않는다(설계 검토 D9). 앱에서 닿는 크기에서 찍는다
        if(only('20')&&mode==='main'){
          const w=await open();await boot(w,{subs:subsRich},{restore:signedIn('none'),fold:true});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const look=()=>w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s);const det=q('[data-details]');return {brief:!q('[data-brief]').hidden,say:q('[data-say]').textContent,then:q('[data-then]').textContent,soon:[...q('[data-soon]').children].map(li=>li.textContent),live:q('[data-live]').hidden?null:q('[data-live]').textContent,diag:q('[data-diag]').hidden?null:q('[data-diag]').textContent,det:det&&!det.hidden?det.getAttribute('aria-expanded'):null,rows:!q('[data-rows]').hidden,top:!q('[data-details-top]').hidden,active:document.activeElement?.dataset?.details!==undefined?'details':document.activeElement===document.body?'body':(document.activeElement?.className||'')};})()");
          const f0=await look();
          check('20 the subscriptions room opens folded: one thing on top, coming up, live output and today’s diagnosis, rows under 상세내역',f0.brief&&f0.say.length>0&&f0.det==='false'&&!f0.rows&&!f0.top&&f0.live!==null&&f0.diag!==null&&/오늘 진단/.test(f0.diag)&&f0.soon.length>=1&&f0.soon.length<=3,f0);
          check('20 the top never says plenty while an account is used up',!/넉넉/.test(f0.say+f0.then),f0);
          // 문자판(11-20 유호님이 고르신 A): 계정마다 칸 하나, 낭독 이름, 가운데 큰 숫자, 지금 출력은 구 위
          const dl=await w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s);const d=q('[data-dial]'),svg=q('[data-dial-svg]'),live=q('[data-live]').getBoundingClientRect(),orb=q('.dial-orb').getBoundingClientRect();return {shown:!d.hidden,dialed:q('[data-room=\"solio\"]').classList.contains('dialed'),cells:svg.querySelectorAll('.d-cell').length,ticks:svg.querySelectorAll('.d-t').length,label:svg.getAttribute('aria-label')||'',hero:q('[data-dial-value]').textContent+q('[data-dial-unit]').textContent,liveState:q('[data-live]').dataset.state||'',liveIn:q('[data-live]').parentElement===d?'dial':q('[data-live]').parentElement===q('[data-brief]')?'brief':'',liveAbove:live.bottom<=orb.top+1&&live.left>=d.getBoundingClientRect().left};})()");
          check('20 the dial: a cell per account, three days of hourly ticks, a spoken label and the share in the middle',dl.shown&&dl.dialed&&dl.cells===(subsRich.rows||[]).filter(r=>r.source==='auto'&&r.state!=='elsewhere').length&&dl.ticks===72&&dl.label.length>0&&/^\d+%$|^\d+\/\d+$/.test(dl.hero),dl);
          // 숫자가 있을 때(켜짐)만 구 위에 둔다. 꺼짐의 안내와 「켜기」는 구를 덮지 않게 오른쪽 비서 판에 둔다(화면 검수 dial A3)
          check('20 live output sits above the orb only while counting; the off notice and 켜기 stay in the brief',dl.liveState==='on'?dl.liveIn==='dial'&&dl.liveAbove:dl.liveIn==='brief',dl);
          // 앱 최소 창(960×680)에서도 맨 위부터 「다시 읽기」까지 한 화면에 든다(Fable 최종 F2와 같은 기준)
          w.win.setContentSize(960,680);await wait(450);
          // 방은 아래 30px을 흐리는 스크롤 칸이다. 창 높이가 아니라 방의 보이는 아래와 견주고, 스크롤이 생기지 않았는지도 본다(화면 검수 dial A7)
          const fit=await w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s),b=s=>q(s).getBoundingClientRect().bottom,room=q('[data-room=\"solio\"]');return {details:Math.round(b('[data-details]')),reread:Math.round(b('[data-orb-act=\"reread\"]')),visible:Math.round(room.getBoundingClientRect().bottom-30),scroll:room.scrollHeight-room.clientHeight};})()");
          check('20 at 960×680 the folded room fits down to 다시 읽기 inside the room’s visible area, without scrolling',fit.details<=fit.visible&&fit.reread<=fit.visible&&fit.scroll<=1,fit);
          w.win.setContentSize(1440,900);await wait(300);
          await captureSizes(w,'brief-folded');
          await click(w,'#portal-entry [data-details]');await wait(200);
          const f1=await look();
          check('20 상세내역 opens the rows and says so',f1.det==='true'&&f1.rows,f1);
          await captureWide(w,'brief-open');
          await w.js("document.querySelector('#portal-entry button.row[data-svc]').focus()");await wait(120);
          await key(w,'Tab');await wait(60);
          // 포인터로 누르면 누르는 순간 단추가 초점을 가져가 이 검사가 늘 통과한다. 초점을 줄 안에 둔 채 스크립트로 누른다(화면 검수 r2 B1)
          await w.js("document.querySelector('#portal-entry [data-details]').click()");await wait(200);
          const f2=await look();
          check('20 folding with the focus inside moves it to 상세내역, not to the page',f2.det==='false'&&!f2.rows&&f2.active==='details',f2);
          // 「켜기」 뒤 곧바로 숫자가 서면(이미 센 기록) 지금 출력이 문자판으로 옮겨 가고 단추가 사라진다. 초점은 상세내역으로 간다(0.5.0 공개 후보 카본 D1)
          const TOKON='#portal-entry [data-live] [data-orb-act="tok-on"]';
          const tk0=await w.js(`(()=>{const b=document.querySelector(${JSON.stringify(TOKON)});if(!b||b.hidden)return null;b.focus();return document.activeElement===b;})()`);
          const tdy=(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date(now));
          await w.js('window.__orbFixture.setTokens('+JSON.stringify({enabled:true,scanning:false,progress:null,scannedAt:now,since:tdy,sinceBy:{claude:tdy},tools:{claude:1},failed:0,error:null,cells:[[tdy,'claude','claude-opus-5-5',900,61000,0,0,0,40]]})+')');await wait(1400);
          const tk1=await w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s),a=document.activeElement;return {state:q('[data-live]').dataset.state||'',inDial:q('[data-live]').parentElement===q('[data-dial]'),active:a?.dataset?.details!==undefined?'details':a===document.body?'body':(a?.className||a?.tagName||'')};})()");
          check('20 switching on from the brief, when the count is already there, moves live output into the dial and focus to 상세내역',tk0===true&&tk1.state==='on'&&tk1.inDial&&tk1.active==='details',{tk0,tk1});
          w.win.destroy();
          // ORB_QA_REAL=<스냅숏 JSON>: 이 PC의 실제 구독 자료({subs, tokens})로 같은 화면을 찍는다. 자료와 캡처는 git 밖에 둔다(공개 저장소)
          const real=process.env.ORB_QA_REAL?JSON.parse(fs.readFileSync(process.env.ORB_QA_REAL,'utf8')):null;
          if(real){
            const r=await open();await boot(r,{subs:real.subs,tokens:real.tokens},{restore:signedIn('none'),fold:true});
            await until(r,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(2200);
            const lk=await r.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s);return {say:q('[data-say]').textContent,then:q('[data-then]').textContent,soon:[...q('[data-soon]').children].map(li=>li.textContent),live:q('[data-live]').textContent,diag:q('[data-diag]').textContent};})()");
            check('20 real data renders the folded room',lk.say.length>0,lk);
            await captureSizes(r,'real-folded');
            await click(r,'#portal-entry [data-details]');await wait(300);
            await captureWide(r,'real-open');
            r.win.destroy();
          }
        }
        // 21. 솔리오 「원클릭」(11-20 백업 방, 11-23 원클릭 방 — docs/디자인/솔리오_원클릭_20261123/PC앱_옮기기.md). 실제 입구가 있는 계정은 구독 다음 자리에 오브제가 서고,
        //     방에 결론 · 할 일 단추 · 줄이 있다. 보호 중이면 줄 대신 원클릭 판(큰 단추 · 드라이브 판 · 네 줄 · 묶음 셋)이다.
        //     단추는 정해진 동작과 낱말만 넘기고, 엔진이 없을 때 · 관리자 확인 중 · 지키는 중 · 누른 뒤 · 기다림 · 끝 · 쉼 · 확인할 일을 찍는다. 입구가 없는 계정에는 오브제가 없다
        if(only('21')&&mode==='main'){
          const T=new Date(now).toISOString(),later=new Date(now+50*60000).toISOString(),before=new Date(now-10*60000).toISOString();
          const status={engine:'0.7.0',state:'safe',lastBackupAt:before,proof:{at:new Date(now-3*D).toISOString(),result:'passed'},attention:[],job:null,folders:4,bytes:53687091200,writer:true,nextRunAt:later,writtenAt:before};
          const GBy=1024**3;
          const space={createdAt:new Date(now-8*3600e3).toISOString(),lapFinishedAt:new Date(now-D).toISOString(),scanningDays:null,drive:{letter:'C',size:Math.round(953*GBy),free:Math.round(118.2*GBy),growthPerDay:Math.round(2.1*GBy),startLineGb:100,daysToStartLine:9},otherDrives:1,
            groups:[{grade:'auto',group:'temp',bytes:Math.round(12.1*GBy),count:1},{grade:'auto',group:'build',bytes:Math.round(11.3*GBy),count:4},{grade:'suggest',group:'worktree',bytes:Math.round(7*GBy),count:2},{grade:'view',group:'ai-app-copy',bytes:Math.round(302.7*GBy),count:30},{grade:'view',group:'ai-history',bytes:Math.round(47.4*GBy),count:1}]};
          const snap=patch=>({ok:true,available:true,view:'status',now:T,engine:{installed:true,version:'0.7.0'},status,feed:{state:'unknown',version:null},install:{phase:'idle',progress:0,code:null,mode:null},oneclick:null,space,app:{state:'current',current:'0.5.8',latest:'0.5.8'},...patch});
          const OC=(ago,stage,extra={})=>({at:new Date(Date.now()-ago).toISOString(),wokeAt:new Date(Date.now()-ago).toISOString(),woke:'started',stage,result:null,reason:null,answeredAt:null,...extra});
          const board=w=>w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio-backup]');const b=r.querySelector('[data-bak-board]');const h=r.querySelector('[data-bak-helper]');const doc=document.documentElement;return {hidden:b.hidden,free:b.querySelector('.d-free')?.textContent||'',pred:b.querySelector('.d-pred')?.textContent||'',steps:[...b.querySelectorAll('.one-steps .one-step')].map(x=>x.dataset.k+'|'+x.className.replace(/^one-step ?/,'')+'|'+x.querySelector('.s-mid').textContent),folded:r.querySelector('[data-bak-flow]').classList.contains('folded'),sum:r.querySelector('[data-bak-sum]').hidden?'':r.querySelector('[data-bak-sum]').textContent,helper:h.hidden?'':h.style.transform,groups:[...b.querySelectorAll('.g')].map(g=>g.dataset.g+(g.classList.contains('open')?':open':'')),overflow:doc.scrollWidth>doc.clientWidth||r.scrollWidth>r.clientWidth+1,wide:(()=>{const R=r.getBoundingClientRect();return [...r.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>R.right+1&&e.getClientRects().length).slice(0,6).map(e=>e.tagName+'.'+e.className+'|'+Math.round(e.getBoundingClientRect().right)+'/'+Math.round(R.right));})()};})()");
          const none=snap({view:'no-engine',engine:{installed:false,version:null},status:null,feed:{state:'available',version:'0.7.0'}});
          const objs=w=>w.js("[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg)");
          const room=w=>w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio-backup]');return {hidden:r.hidden,say:r.querySelector('[data-bak-say]').textContent,then:r.querySelector('[data-bak-then]').textContent,acts:[...r.querySelectorAll('[data-bak-acts] button')].map(b=>b.textContent+'|'+b.dataset.orbAct+'|'+b.dataset.orbArg+'|'+(b.getAttribute('aria-disabled')||'')),rows:r.querySelectorAll('button.row[data-vis]').length,subs:!document.querySelector('#portal-entry [data-room=solio]').hidden};})()");
          const w=await open();await boot(w,{subs:subsReady,backup:none},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const o1=await objs(w);
          check('21 an account with the real entry sees 구독 then 원클릭',JSON.stringify(o1)===JSON.stringify(['subs','backup']),{objs:o1});
          const first=await room(w);
          check('21 the first screen stays the subscriptions room (no backup line there)',first.hidden&&first.subs,first);
          await click(w,'#portal-entry [data-orb-prog="backup"]');await wait(700);
          const r1=await room(w);
          check('21 with no engine the room says so in one line and offers 보호 시작 and 이 PC로 옮겨 오기',!r1.hidden&&/아직 백업하지 않고/.test(r1.say)&&JSON.stringify(r1.acts)===JSON.stringify(['보호 시작|backup-start|protect|','이 PC로 옮겨 오기|backup-start|move|'])&&r1.rows===3,r1);
          await captureSizes(w,'backup-no-engine');
          await click(w,'#portal-entry [data-room=solio-backup] [data-orb-act="backup-start"]');await wait(400);
          check('21 보호 시작 asks the main process with the one word protect',(await calls(w)).includes('backup-start:protect'),{calls:(await calls(w)).filter(c=>c.startsWith('backup'))});
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({view:'no-engine',engine:{installed:false,version:null},status:null,install:{phase:'admin',progress:100,code:null,mode:'protect'}}))+')');
          await click(w,'#portal-entry [data-orb-prog="backup"]');await wait(2600);
          const r2=await room(w);
          check('21 while the administrator prompt is up the room says what to press and offers no button',/관리자 확인/.test(r2.say)&&r2.acts.length===0,r2);
          await capture(w,'backup-admin');
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({}))+')');await wait(2600);
          const r3=await room(w);
          check('21 a safe status names the folders and the last check, leads with the 원클릭 button and keeps the engine buttons quiet',/업무 폴더 4개를 지키고 있습니다/.test(r3.say)&&/마지막 확인/.test(r3.then)&&r3.acts[0]==='백업하고 상태 보기|backup-oneclick||'&&r3.acts.slice(1).map(a=>a.split('|')[2]).join()==='restore,move,status'&&r3.rows===0,r3);
          const b3=await board(w);
          check('21 the 원클릭 board shows the drive, four lines read from the engine and three groups without the helper',!b3.hidden&&b3.free==='118.2'&&/9일 뒤/.test(b3.pred)&&b3.steps.map(x=>x.split('|')[0]).join()==='backup,proof,space,update'&&/23\.4GB를 찾았습니다/.test(b3.steps[2])&&b3.groups.join()==='auto,suggest,view'&&!b3.helper&&!b3.folded&&!b3.overflow,b3);
          await captureSizes(w,'oneclick-ready');
          await click(w,'#portal-entry [data-room=solio-backup] [data-bak-g="view"]');await wait(700);
          const b3g=await board(w);
          check('21 a group opens in place without asking the main process',b3g.groups.includes('view:open')&&!(await calls(w)).some(c=>c.startsWith('backup-open')),b3g);
          await capture(w,'oneclick-group');
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({status:{...status,job:{stage:'backup',percent:57}},oneclick:OC(5000,'claimed')}))+')');
          await click(w,'#portal-entry [data-room=solio-backup] [data-orb-act="backup-oneclick"]');await wait(900);
          check('21 the big button asks the main process for 원클릭 with no word',(await calls(w)).includes('backup-oneclick'),{calls:(await calls(w)).filter(c=>c.startsWith('backup'))});
          const r5=await room(w),b5=await board(w);
          check('21 while the engine backs up the button says so and cannot be pressed, and the helper sits on line 01',/지금 백업하는 중입니다\(57%\)/.test(r5.say)&&r5.acts[0]==='백업하는 중|backup-oneclick||true'&&/^backup\|now/.test(b5.steps[0])&&!!b5.helper,{r5,b5});
          await captureSizes(w,'oneclick-running');
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({oneclick:OC(120000,'sent')}))+')');await wait(2600);
          const r6=await room(w),b6=await board(w);
          check('21 a request the engine has not taken for a minute says it waits and lets the person press again',/부탁해 두었습니다/.test(r6.say)&&/다음 매시 백업/.test(r6.then)&&r6.acts[0]==='백업하고 상태 보기|backup-oneclick||'&&/^backup\|wait/.test(b6.steps[0])&&!b6.helper,{r6,b6});
          await capture(w,'oneclick-waiting');
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({status:{...status,lastBackupAt:new Date(Date.now()-60000).toISOString()},oneclick:OC(300000,'answered',{result:'done',answeredAt:new Date(Date.now()-60000).toISOString()})}))+')');
          await click(w,'#portal-entry [data-orb-prog="backup"]');await wait(900);
          const r7=await room(w),b7=await board(w);
          check('21 a finished 원클릭 folds the four lines into one and says what comes next',/백업을 마쳤습니다/.test(r7.say)&&/다음 백업/.test(r7.then)&&b7.folded&&/백업을 마쳤습니다/.test(b7.sum)&&/통과/.test(b7.sum),{r7,b7});
          await captureSizes(w,'oneclick-done');
          await click(w,'#portal-entry [data-room=solio-backup] [data-bak-sum]');await wait(500);
          const b7o=await board(w);
          check('21 pressing the folded line opens the four lines again',!b7o.folded&&/^backup\|done/.test(b7o.steps[0]),b7o);
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({oneclick:OC(300000,'answered',{result:'rested',reason:'battery',answeredAt:new Date(Date.now()-60000).toISOString()})}))+')');
          await click(w,'#portal-entry [data-orb-prog="backup"]');await wait(900);
          const r8=await room(w);
          check('21 a rested answer says why in words and leads with the engine window right after the big button',/배터리/.test(r8.say)&&/지금 백업/.test(r8.then)&&r8.acts[1]==='엔진 창 열기|backup-open|status|',r8);
          await capture(w,'oneclick-rested');
          await w.js('window.__orbFixture.setBackup('+JSON.stringify(snap({status:{...status,state:'attention',attention:['signin']}}))+')');
          await click(w,'#portal-entry [data-orb-prog="backup"]');await wait(900);
          const r4=await room(w);
          check('21 an attention topic leads with its own engine screen right after the 원클릭 button',/Google 로그인/.test(r4.say)&&r4.acts[1]==='엔진 창에서 확인|backup-open|signin|',r4);
          await click(w,'#portal-entry [data-room=solio-backup] [data-orb-act="backup-open"]');await wait(300);
          check('21 the button opens the engine with the topic word only',(await calls(w)).includes('backup-open:signin'),{calls:(await calls(w)).filter(c=>c.startsWith('backup'))});
          await capture(w,'backup-attention');
          w.win.destroy();
          const v=await open();await boot(v,{subs:subsReady,visits:{ok:true,available:true,summary:visitSummary()}},{restore:signedIn('none')});
          await until(v,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const o2=await objs(v);
          check('21 an account without the real entry has no backup object',!o2.includes('backup')&&o2.includes('visits'),{objs:o2});
          v.win.destroy();
        }
        if(only('office-tasks')&&mode==='main'){
          await require('./office-task-browser-qa.cjs')({open,boot,signedIn,signedOut,subsNone,until,wait,click,capture,check,calls});
        }
        if(only('office-mail-more')&&mode==='main'){
          await require('./office-mail-more-browser-qa.cjs')({open,boot,signedIn,subsNone,until,wait,click,key,capture,check,calls});
        }
        if(only('office-mail')&&mode==='main'){
          await require('./office-mail-browser-qa.cjs')({open,boot,signedIn,signedOut,subsNone,until,wait,click,capture,check,calls});
        }
        if(only('office-mail-review')&&mode==='main'){
          await require('./office-mail-review-browser-qa.cjs')({open,boot,signedIn,signedOut,subsNone,until,wait,click,key,capture,check,calls});
        }
        if(only('office-quote-handoff')&&mode==='main'){
          await require('./office-quote-handoff-browser-qa.cjs')({open,boot,signedIn,signedOut,subsNone,until,wait,click,capture,check,calls});
        }
        // 22. 솔리오 「사무실」(사무실 구현설계 14.2 · 14.4). 들어가기와 나오기, 다른 프로그램에 있을 때 오브제의 느낌표, 보기 바꾸기, 줄을 열었다 닫으면 끝냄 알림이 지워짐,
        //     부서 빼기의 두 번 확인, 자판만으로 부서 더하기, 수용 인원을 넘었을 때, 부서 여섯과 일곱, 기록으로만 선 직원(첫 조각의 실제 모습, 11-21 훅을 뺐다), 세션이 없을 때를 본다. 다섯 크기(꽉 참 1440×900, 1080×700, 720×760, 420×760, 380×250)에서 두 보기를 찍는다.
        //     그림은 눈 깜빡임 · 테두리 밝기 · 느낌표만 움직인다. 1.2초 사이에 캔버스에서 바뀐 점의 몫을 잰다
        if(only('22')&&mode==='main'){
          const MKT='C:\\qa\\문서\\마케팅',SHOP='C:\\qa\\코드\\shop';
          const depts=[{id:'qmkt',name:'마케팅부',folder:MKT},{id:'qdev',name:'개발부',folder:SHOP}];
          const sessions=[
            {id:'sess-qa-mkt-01',cwd:MKT,kind:'work',ago:20e3,toolName:'Write',detail:'블로그_11월.md'},
            {id:'sess-qa-mkt-02',cwd:MKT+'\\보고서',kind:'done',ago:60e3,toolName:'Edit',detail:'보고서.md'},
            {id:'sess-qa-dev-01',cwd:SHOP,kind:'ask',ago:180e3,toolName:'Bash',detail:'npm'},
            {id:'sess-qa-cdx-01',tool:'codex',cwd:SHOP+'\\api',kind:'work',ago:30e3},
            {id:'sess-qa-lob-01',cwd:'C:\\qa\\회의록',kind:'work',ago:40e3,toolName:'Read',detail:'회의록_1118.txt',helpers:2},
          ];
          const board=patch=>({available:true,departments:JSON.parse(JSON.stringify(depts)),sessions,assignments:{},settings:{view:'tilted',manualCap:null},roots:{claude:['C:\\Users\\qa\\.claude'],codex:['C:\\Users\\qa\\.codex\\sessions'],added:[]},pc:{cores:16,totalMemGb:31.7,freeMemGb:19,cpuPercent:38},...patch});
          const ROOM="document.querySelector('#portal-entry [data-room=solio-office]')",OBJ="document.querySelector('#portal-entry [data-orb-prog=office]')";
          const look=w=>w.js("(()=>{const r="+ROOM+",o="+OBJ+",q=s=>r.querySelector(s),slot=q('[data-off-slot]');return {hidden:r.hidden,say:q('[data-off-say]').textContent,then:q('[data-off-then]').textContent,rows:[...r.querySelectorAll('[data-off-rows] > button.row')].map(b=>b.dataset.key+'|'+(b.querySelector('.nm')?.firstChild?.textContent||'')+'|'+(b.querySelector('.flag')?'!':'')),zones:slot.dataset.zones||'',view:slot.dataset.view||'',slot:!slot.hidden&&getComputedStyle(slot).display!=='none',news:o.classList.contains('news'),label:o.getAttribute('aria-label'),overflow:Math.max(document.documentElement.scrollWidth-innerWidth,r.scrollWidth-r.clientWidth)};})()");
          const setBoard=async(w,b)=>{await w.js('window.__orbFixture.setOffice('+JSON.stringify(b)+')');await wait(900);};
          // 실제 손처럼 누르기 전에 초점을 그 단추로 옮긴다(쓰던 칸에 초점이 남으면 안쪽을 다시 짓지 않는 규칙 때문이다)
          const press=(w,sel)=>w.js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;el.focus({preventScroll:true});el.click();return true;})()`);
          const sizes5=[[1440,900],[1080,700],[720,760],[420,760],[380,250]];
          const shoot=async(w,name,list=sizes5)=>{const over=[];for(const [W,Hh] of list){w.win.setContentSize(W,Hh);for(let i=0;i<40&&(await w.js('innerWidth'))!==W;i++)await wait(50);await wait(420);await w.js(ROOM+'.scrollTop=0');await wait(120);await capture(w,`${name}-${W}x${Hh}`);const l=await look(w);if(l.overflow>0)over.push({W,Hh,overflow:l.overflow});}w.win.setContentSize(1440,900);await wait(400);check('22 '+name+': no sideways overflow in the room at any size',over.length===0,{over});};
          const w=await open();await boot(w,{subs:subsReady,office:board()},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const objs=await w.js("[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg)");
          check('22 사무실 stands last on the rail for a viewer',JSON.stringify(objs)===JSON.stringify(['subs','office']),{objs});
          const l0=await look(w);
          check('22 while 구독 is open the 사무실 object already carries ! for the waiting question, and a screen reader hears it',l0.hidden&&l0.news&&/새 소식/.test(l0.label||''),l0);
          check('22 records are not watched outside the room',!(await calls(w)).includes('office-watch:true'));
          await capture(w,'office-rail-alert');
          await click(w,'#portal-entry [data-orb-prog="office"]');await wait(1200);
          const l1=await look(w);
          check('22 entering 사무실: the question first, how many cannot tell, one row per department, the lobby, capacity, settings and 부서 더하기, and the floor',!l1.hidden&&l1.say==='개발부가 3분 전에 승인을 물었습니다.'&&l1.then==='하나는 승인 물음을 모릅니다.'&&JSON.stringify(l1.rows)===JSON.stringify(['d:qmkt|마케팅부|!','d:qdev|개발부|!','lobby|부서 없는 일|','cap|수용 인원|','cfg|설정|','add|부서 더하기|'])&&l1.zones==='d:qmkt d:qdev lobby'&&l1.view==='tilted'&&l1.slot,l1);
          check('22 entering turns the record watch on',(await calls(w)).includes('office-watch:true'));
          const motion=await w.js("(async()=>{const c="+ROOM+".querySelector('[data-off-floor]'),x=c.getContext('2d');const a=x.getImageData(0,0,c.width,c.height).data;await new Promise(r=>setTimeout(r,1200));const b=x.getImageData(0,0,c.width,c.height).data;let n=0,lit=0;for(let i=0;i<a.length;i+=4){if(a[i]>20||b[i]>20)lit++;if(Math.abs(a[i]-b[i])>24||Math.abs(a[i+3]-b[i+3])>24)n++;}return {w:c.width,h:c.height,changed:n,lit,share:Math.round(n/(a.length/4)*1e4)/1e4};})()");
          check('22 the floor is drawn and only small parts change in 1.2 s (blink, rim, the bouncing mark), no body or camera moves',motion.lit>500&&motion.share<0.01,motion);
          // 직원 줄: 승인 물음을 모르는 Codex 세션, 도우미 둘
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="d:qdev"]');await click(w,'#portal-entry [data-off-rows] button.row[data-key="lobby"]');await wait(800);
          const staff=await w.js("[..."+ROOM+".querySelectorAll('.row.staff')].map(r=>r.dataset.staff+'|'+r.querySelector('.nm').firstChild.textContent+'|'+r.querySelector('.mid b').textContent+'|'+(r.querySelector('.mid small')?.textContent||''))");
          check('22 staff lines say the state, the folder and tool, the helpers, and that a Codex session cannot tell about questions',staff.includes('sess-qa-dev-01|Claude Code|3분 전에 승인을 물었습니다|shop · 명령 · npm')&&staff.includes('sess-qa-cdx-01|Codex|일하는 중|api · 승인 물음은 모릅니다')&&staff.includes('sess-qa-lob-01|Claude Code|일하는 중|회의록 · 읽기 · 회의록_1118.txt · 도우미 둘과 함께'),{staff});
          await capture(w,'office-rows-open');
          await key(w,'Escape');await wait(600);
          await shoot(w,'office-tilted');
          // 다른 프로그램을 보는 동안에도 느낌표가 남는다. 나가면 기록 살피기를 끈다
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(700);
          const l2=await look(w);const watch2=(await calls(w)).filter(c=>c.startsWith('office-watch:')).at(-1);
          check('22 leaving for 구독 stops the record watch and keeps the ! on the object',l2.hidden&&l2.news&&watch2==='office-watch:false',{...l2,watch2});
          await click(w,'#portal-entry [data-orb-prog="office"]');await wait(1000);
          // 보기 바꾸기: 설정 줄 안의 「위에서」. 저장하고, 카메라가 한 번 옮겨 간다
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"]');await wait(600);
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"] + .more [data-pv="top"]');await wait(1400);
          const l3=await look(w);
          check('22 「위에서」 in the settings row saves the view and the floor turns to the top view',l3.view==='top'&&(await calls(w)).includes('office-settings:{"view":"top"}'),l3);
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"]');await wait(500);
          await shoot(w,'office-top');
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"]');await wait(500);
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"] + .more [data-pv="tilted"]');await wait(1200);
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"]');await wait(400);
          // 마케팅부 줄을 열었다 닫으면 끝냄 알림이 지워진다
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="d:qmkt"]');await wait(700);
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="d:qmkt"]');await wait(1200);
          const l4=await look(w);
          check('22 opening then closing 마케팅부 marks its finished turn seen and the ! goes',(await calls(w)).includes('office-seen:qmkt')&&l4.rows[0]==='d:qmkt|마케팅부|',l4);
          // 부서 빼기는 그 자리에서 한 번 더 묻는다
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="d:qdev"]');await wait(600);
          await press(w,'#portal-entry [data-off-rows] button.row[data-key="d:qdev"] + .more .row.item');await wait(600);
          await press(w,'#portal-entry [data-off-rows] button.row[data-key="d:qdev"] + .more [data-room-act="dept-remove-ask"]');await wait(600);
          const ask=await w.js("(()=>{const m="+ROOM+".querySelector('button.row[data-key=\"d:qdev\"] + .more');const c=m.querySelector('.confirm');return {confirm:!!c,question:c?.querySelector('[data-ask-q]')?.textContent||'',focus:document.activeElement?.dataset?.askQ!==undefined,removed:false};})()");
          check('22 「부서 빼기」 asks first in place, with the focus on the question',ask.confirm&&ask.question==='개발부를 빼시겠습니까?'&&ask.focus&&!(await calls(w)).some(c=>c.startsWith('office-remove:')),ask);
          await w.js("document.querySelector('#portal-entry [data-off-rows] button.row[data-key=\"d:qdev\"] + .more .confirm').scrollIntoView({block:'center'})");await wait(200);
          await capture(w,'office-remove-ask');
          await press(w,'#portal-entry [data-off-rows] button.row[data-key="d:qdev"] + .more .confirm [data-room-act="dept-remove"]');await wait(1200);
          const l5=await look(w);
          check('22 the second press removes 개발부 and its sessions move to 「부서 없는 일」',(await calls(w)).includes('office-remove:qdev')&&!l5.rows.some(r=>r.startsWith('d:qdev'))&&l5.rows.some(r=>r.startsWith('lobby')),l5);
          await setBoard(w,board());
          // 자판만으로 부서 더하기: 설정 줄에서 Tab으로 「부서 더하기」 줄까지 가면 열리고, 이름을 적고 Enter
          await w.js("document.querySelector('#portal-entry [data-off-rows] button.row[data-key=\"cfg\"]').focus()");
          // 숨은 시험 창에는 초점 사건이 오지 않아(19번과 같다) 자판으로 옮긴 초점마다 focusin을 직접 보낸다
          const focusin=()=>w.js("document.activeElement?.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))");
          await focusin();
          let onAdd=false;for(let i=0;i<30&&!onAdd;i++){await key(w,'Tab');await focusin();await wait(80);onAdd=await w.js("document.activeElement?.dataset?.key==='add'");}
          await wait(500);
          const addOpen=await w.js("document.querySelector('#portal-entry [data-off-rows] button.row[data-key=\"add\"]').getAttribute('aria-expanded')");
          await key(w,'Tab');await focusin();await wait(120);
          const inField=await w.js("document.activeElement?.dataset?.f==='name'");
          w.win.webContents.insertText('법무부');await wait(150);
          await key(w,'Return');await wait(1300);
          const l6=await look(w);
          check('22 keyboard only: Tab reaches 「부서 더하기」, it opens, the name field takes 법무부, Enter adds it through the folder dialog',onAdd&&addOpen==='true'&&inField&&(await calls(w)).includes('office-save:{"name":"법무부","folder":"choose"}')&&l6.rows.some(r=>r.endsWith('|법무부|')),{onAdd,addOpen,inField,rows:l6.rows,calls:(await calls(w)).filter(c=>c.startsWith('office-save'))});
          await w.js("document.querySelector('#portal-entry [data-off-rows] button.row[data-key=\"add\"]').scrollIntoView({block:'center'})");await wait(200);
          await capture(w,'office-added');
          await key(w,'Escape');await wait(400);
          // 수용 인원을 넘었을 때(직접 정한 둘, 일하는 넷)
          const busy=[1,2,3,4].map(i=>({id:'sess-qa-busy-0'+i,cwd:i<3?MKT:SHOP,kind:'work',ago:15e3*i,toolName:'Read',detail:'파일'+i+'.md'}));
          await setBoard(w,board({sessions:busy,settings:{view:'tilted',manualCap:2}}));
          const l7=await look(w);
          check('22 over capacity the headline says how many may work and how many do',l7.say==='둘까지인데 지금 넷이 일하고 있습니다.',l7);
          await shoot(w,'office-over',[[1440,900],[720,760]]);
          // 부서 여섯과 일곱: 일곱째부터는 그림에서 「그 밖」 한 구역으로 묶는다
          const six=['마케팅부','법무부','개발부','디자인부','회계부','고객지원부'].map((name,i)=>({id:'qd6'+i,name,folder:'C:\\qa\\부서'+i}));
          const sixStaff=six.slice(0,4).map((d,i)=>({id:'sess-qa-six-0'+i,cwd:d.folder,kind:i===1?'ask':i===3?'rest':'work',ago:30e3+i*1000,toolName:'Read',detail:'메모.md'}));
          await setBoard(w,board({departments:six,sessions:sixStaff}));
          const l8=await look(w);
          check('22 six departments are drawn one by one in two lines',l8.zones.split(' ').length===6&&!l8.zones.includes('other')&&l8.rows.filter(r=>r.startsWith('d:')).length===6,l8);
          await shoot(w,'office-six',[[1440,900],[1080,700]]);
          await setBoard(w,board({departments:[...six,{id:'qd7x',name:'영업부',folder:'C:\\qa\\영업'}],sessions:[...sixStaff,{id:'sess-qa-sev-01',cwd:'C:\\qa\\영업',kind:'work',ago:20e3}]}));
          const l9=await look(w);
          check('22 a seventh department has its row, and the floor bundles it into 「그 밖」',l9.zones.split(' ').filter(z=>z.startsWith('d:')).length===6&&l9.zones.endsWith('other')&&l9.rows.some(r=>r.startsWith('d:qd7x|영업부')),l9);
          await shoot(w,'office-seven',[[1440,900]]);
          // 첫 조각의 실제 모습(11-21 훅을 뺐다): 모든 직원이 기록으로만 선다. 느낌표가 없고, 맨 위 둘째 줄이 승인 물음을 모른다고 한 번 말한다
          const recs=[{id:'sess-qa-rec-01',cwd:MKT,kind:'work',ago:20e3,hooked:false},{id:'sess-qa-rec-02',cwd:SHOP,kind:'work',ago:240e3,hooked:false},{id:'sess-qa-rec-03',tool:'codex',cwd:SHOP+'\\api',kind:'work',ago:30e3}];
          await setBoard(w,board({sessions:recs}));
          const lr=await look(w);
          check('22 records only (the first piece): no ! on the object or any row, and the headline says once that it cannot tell about questions',lr.say==='둘이 일하고 있습니다.'&&lr.then==='모두 승인 물음을 모릅니다.'&&!lr.news&&!lr.rows.some(r=>r.endsWith('|!')),lr);
          await shoot(w,'office-records-only',[[1440,900],[720,760]]);
          // 더했지만 지금 보지 않는 폴더(구독 방 계정 폴더이거나 2초 안에 답하지 않음)도 설정 줄에 남고 뺄 수 있다(설계 검토 be7 고칠 것 1)
          const resting='\\\\qa-share\\team\\.claude';
          await setBoard(w,board({sessions:recs,roots:{claude:['C:\\Users\\qa\\.claude'],codex:['C:\\Users\\qa\\.codex\\sessions'],added:[resting]}}));
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"]');await wait(600);
          const restLook="(()=>{const m="+ROOM+".querySelector('button.row[data-key=\"cfg\"] + .more');const b=m&&[...m.querySelectorAll('[data-room-act=\"root-remove\"]')].find(x=>x.dataset.roomArg==="+JSON.stringify(resting)+");return {open:!!m,text:m?m.textContent:'',remove:!!b};})()";
          const lrest=await w.js(restLook);
          check('22 a folder that is added but not watched keeps its line in 설정 with 「지금은 보지 않음」 and 빼기',lrest.open&&lrest.text.includes(resting)&&lrest.text.includes('지금은 보지 않음')&&lrest.remove,lrest);
          await w.js("document.querySelector('#portal-entry [data-off-rows] button.row[data-key=\"cfg\"] + .more').scrollIntoView({block:'center'})");await wait(200);
          await capture(w,'office-root-resting');
          await w.js("(()=>{const m="+ROOM+".querySelector('button.row[data-key=\"cfg\"] + .more');const b=[...m.querySelectorAll('[data-room-act=\"root-remove\"]')].find(x=>x.dataset.roomArg==="+JSON.stringify(resting)+");b.focus({preventScroll:true});b.click();})()");await wait(1200);
          check('22 its 빼기 removes it',(await calls(w)).includes('office-root-remove:'+resting)&&!(await w.js(restLook)).text.includes(resting));
          await click(w,'#portal-entry [data-off-rows] button.row[data-key="cfg"]');await wait(400);
          // 세션이 하나도 없을 때
          await setBoard(w,board({departments:[],sessions:[]}));
          const l10=await look(w);
          check('22 with no sessions the headline says nothing runs and no empty floor is drawn',l10.say==='지금 이 PC에서 도는 일이 없습니다.'&&l10.then==='Claude Code나 Codex에서 일을 시작하면 여기에 섭니다.'&&!l10.slot&&!l10.news&&JSON.stringify(l10.rows)===JSON.stringify(['cap|수용 인원|','cfg|설정|','add|부서 더하기|']),l10);
          await shoot(w,'office-empty');
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(700);
          check('22 leaving the room at the end stops the record watch',(await calls(w)).filter(c=>c.startsWith('office-watch:')).at(-1)==='office-watch:false');
          w.win.destroy();
          // 볼 계정이 아니면 오브제도 방도 없다
          const v=await open();await boot(v,{subs:subsReady,office:{available:false}},{restore:signedIn('none')});
          await until(v,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1400);
          const o2=await v.js("[...document.querySelectorAll('#portal-entry [data-orb-prog]')].filter(o=>!o.hidden).map(o=>o.dataset.orbProg)");
          check('22 an account that is not an office viewer has no 사무실 object',!o2.includes('office'),{objs:o2});
          v.win.destroy();
        }
        // 4. 배정 하나(Workspace, PULSE 각각)
        // 17. 2단계 첫 조각: 구 곁의 펼침과 구독 줄 안쪽(2단계_첫조각_구현설계.md 5절). 숨은 창에는 실제 마우스가 오지 않아 그 자리의 요소에 포인터 사건을 직접 보낸다(현장 노트 시험_화면확인)
        if(only('17')&&mode==='main'){
          const w=await open();await boot(w,{subs:subsRich},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          check('17 arriving in Solio does not open the fan by itself',!(await state(w)).fan);
          await w.js(`(()=>{const st=document.querySelector('#portal-entry .orb-stage');window.__fanLog=[];new MutationObserver(()=>window.__fanLog.push([st.dataset.fan==='1',performance.now()])).observe(st,{attributes:true,attributeFilter:['data-fan']});
            window.__moreLog=[];new MutationObserver(ms=>{for(const m of ms){const t=m.target;if(t.classList&&t.classList.contains('more'))window.__moreLog.push([(t.previousElementSibling&&t.previousElementSibling.dataset.svc)||'',t.classList.contains('open'),performance.now()]);}}).observe(document.querySelector('#portal-entry [data-rows]'),{attributes:true,attributeFilter:['class'],subtree:true});
            const chain=e=>{const a=[];for(let n=e;n;n=n.parentElement)a.push(n);return a;};
            const opts=(x,y)=>({bubbles:true,cancelable:true,composed:true,pointerType:'mouse',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});
            window.__ptr=null;
            window.__mv=(x,y)=>{const t=document.elementFromPoint(x,y)||document.body,prev=window.__ptr,o=opts(x,y);
              if(prev!==t){const was=prev?chain(prev):[],now=chain(t);if(prev)prev.dispatchEvent(new PointerEvent('pointerout',{...o,relatedTarget:t}));for(const n of was)if(!now.includes(n))n.dispatchEvent(new PointerEvent('pointerleave',{...o,bubbles:false,relatedTarget:t}));t.dispatchEvent(new PointerEvent('pointerover',{...o,relatedTarget:prev}));for(const n of now.slice().reverse())if(!was.includes(n))n.dispatchEvent(new PointerEvent('pointerenter',{...o,bubbles:false,relatedTarget:prev}));window.__ptr=t;}
              t.dispatchEvent(new PointerEvent('pointermove',o));return performance.now();};
            window.__press=(x,y)=>{const a=document.elementFromPoint(x,y)||document.body,o=opts(x,y);a.dispatchEvent(new PointerEvent('pointerdown',o));
              return new Promise(r=>setTimeout(()=>{const b=document.elementFromPoint(x,y)||document.body;b.dispatchEvent(new PointerEvent('pointerup',o));let c=a;while(c&&!c.contains(b))c=c.parentElement;c=c||document.body;c.dispatchEvent(new MouseEvent('click',o));r({down:String(a.className||a.tagName),up:String(b.className||b.tagName),click:String(c.className||c.tagName)});},90));};
            return true;})()`);
          const mv=async(x,y)=>{const t=await w.js('window.__mv('+x+','+y+')');await wait(16);return t;};
          const rect=sel=>w.js('(()=>{const r=document.querySelector('+JSON.stringify(sel)+').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),l:r.left,t:r.top,r:r.right,b:r.bottom};})()');
          const firstFan=(open,after)=>w.js('(()=>{const e=window.__fanLog.find(e=>e[0]==='+open+'&&e[1]>='+after+');return e?e[1]:null;})()');
          const firstMore=(svc,open,after)=>w.js('(()=>{const e=window.__moreLog.find(e=>e[0]==='+JSON.stringify(svc)+'&&e[1]==='+open+'&&e[2]>='+after+');return e?e[2]:null;})()');
          const away=[1360,860];
          const orb=await rect('#portal-entry .here-orb'),name=await rect('#portal-entry .here-name');
          const near=(x,y)=>(x>orb.l-18&&x<orb.r+18&&y>orb.t-18&&y<orb.b+18)||(x>name.l-10&&x<name.r+10&&y>name.t-10&&y<name.b+10);
          // 천천히 다가와 구 곁에 머문다: 0.15초 뒤에 펼쳐진다
          await mv(...away);await wait(400);
          let nearAt=null;for(let i=10;i>=0;i--){const x=orb.x+i*14,y=orb.y+i*14,t=await mv(x,y);if(nearAt===null&&near(x,y))nearAt=t;await wait(30);}
          await wait(700);const o1=await firstFan(true,nearAt);const slowMs=o1===null?null:Math.round(o1-nearAt);
          check('17 resting by the orb opens the fan after about 0.15 s',slowMs!==null&&slowMs>=140&&slowMs<450,{ms:slowMs});
          // 구역을 벗어나 머물면 0.4초 뒤에 접힌다
          const leftAt=await mv(...away);await wait(900);const c1=await firstFan(false,leftAt);const closeMs=c1===null?null:Math.round(c1-leftAt);
          check('17 leaving the fan area closes an unpinned fan after about 0.4 s',closeMs!==null&&closeMs>=380&&closeMs<800,{ms:closeMs});
          // 멀리서 빠르게 구로 오면 조금 더(0.26초) 기다린다
          await wait(400);await mv(orb.x+340,orb.y+240);const fastAt=await w.js('window.__mv('+orb.x+','+orb.y+')');
          await wait(800);const o2=await firstFan(true,fastAt);const fastMs=o2===null?null:Math.round(o2-fastAt);
          check('17 coming fast onto the orb waits a little longer (about 0.26 s)',fastMs!==null&&fastMs>=250&&fastMs<600,{ms:fastMs});
          // 머물러 연 펼침을 누르면 고정되고, 손이 떠나도 남는다
          await click(w,'#portal-entry .here-orb');await wait(120);await mv(...away);await wait(900);
          check('17 pressing the orb pins the fan and leaving no longer closes it',(await state(w)).fan);
          await captureSizes(w,'fan');
          // 바깥을 누르면 고정한 펼침이 닫히고, 흐린 방에 있던 줄은 같이 눌리지 않는다
          const g=await rect('#portal-entry button.row[data-svc="gemini"]');
          const pressed=await w.js('window.__press('+g.x+','+g.y+')');await wait(300);
          const gRow=await w.js("(()=>{const b=document.querySelector('#portal-entry button.row[data-svc=\"gemini\"]');return {open:b.classList.contains('opened'),pin:b.classList.contains('pin')};})()");
          check('17 a press outside closes the pinned fan without pressing the dimmed row under it',!(await state(w)).fan&&!gRow.open&&!gRow.pin,{pressed,gRow});
          // 자판: 초점만으로는 펼치지 않고, 아래 화살표 · Enter · Space로 펼친다. 아래 화살표로 첫 이름에 들어가고 Esc로 닫으면 초점이 구에 남는다
          await mv(...away);await wait(500);
          await w.js("document.querySelector('#portal-entry .here-orb').focus()");await wait(500);
          check('17 focus alone on the orb does not open the fan',!(await state(w)).fan);
          await key(w,'Down');const k1=await until(w,s=>s.fan,{timeout:2000});await wait(500);
          await key(w,'Down');const inFan=await w.js("document.activeElement===document.querySelector('#portal-entry .fan-go')");
          check('17 the down arrow opens the fan and then moves into its first name',k1.ok&&inFan,{state:k1.state,inFan});
          await key(w,'Escape');const k2=await until(w,s=>!s.fan,{timeout:2000});
          const onOrb=await w.js("document.activeElement===document.querySelector('#portal-entry .here-orb')");
          check('17 Esc from inside the fan closes it and returns focus to the orb',k2.ok&&onOrb,{state:k2.state,onOrb});
          await wait(700);check('17 the fan stays closed after Esc while focus rests on the orb',!(await state(w)).fan);
          await key(w,'Return');const k3=await until(w,s=>s.fan,{timeout:2000});await wait(450);
          await key(w,'Return');const k4=await until(w,s=>!s.fan,{timeout:2000});
          check('17 Enter on the orb opens the fan and Enter again closes it',k3.ok&&k4.ok,{open:k3.state,close:k4.state});
          await wait(450);await key(w,'Space');const k5=await until(w,s=>s.fan,{timeout:2000});await wait(450);await key(w,'Escape');await until(w,s=>!s.fan,{timeout:2000});
          check('17 Space on the orb opens the fan',k5.ok,k5.state);
          // 이름 단추에서 펼치면 초점이 보이는 구로 옮겨 가고, 물러난 이름 · 오브제 줄 · 흐린 방은 Tab 차례에서 빠진다(카본 A1)
          await wait(450);await w.js("document.querySelector('#portal-entry .here-name').focus()");await key(w,'Down');const k6=await until(w,s=>s.fan,{timeout:2000});await wait(450);
          const back=await w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s);return {onOrb:document.activeElement===q('.here-orb'),name:q('.here-name').inert,room:q('[data-room=solio]').inert,fan:q('.fan').inert};})()");
          await key(w,'Tab');const tabbed=await w.js("document.activeElement===document.querySelector('#portal-entry .fan-go')");
          check('17 opening from the name moves focus to the orb, and Tab goes into the fan past the hidden name and the dimmed room',k6.ok&&back.onOrb&&back.name&&back.room&&!back.fan&&tabbed,{...back,tabbed});
          await key(w,'Escape');await until(w,s=>!s.fan,{timeout:2000});
          check('17 closing the fan gives the name and the room back to the Tab order',await w.js("!document.querySelector('#portal-entry .here-name').inert&&!document.querySelector('#portal-entry [data-room=solio]').inert"));
          await w.js('document.activeElement&&document.activeElement.blur&&document.activeElement.blur()');
          // 구독 줄: 머물면 약 0.12초 뒤에 안쪽이 열리고, 줄 묶음을 벗어나 머물면 약 0.4초 뒤에 접힌다
          await wait(500);const r1=await rect('#portal-entry button.row[data-svc="claude"]');
          const rowAt=await mv(r1.x,r1.y);await wait(500);const ro=await firstMore('claude',true,rowAt);const rowMs=ro===null?null:Math.round(ro-rowAt);
          check('17 resting on a subscription row opens its inside after about 0.12 s',rowMs!==null&&rowMs>=110&&rowMs<400,{ms:rowMs});
          const inside=await w.js("(()=>{const m=document.querySelector('#portal-entry button.row[data-svc=\"claude\"]').nextElementSibling;return {open:m.classList.contains('open'),inert:m.inert,accounts:m.querySelectorAll('.row.sub').length,fix:[...m.querySelectorAll('.more-fix')].map(p=>p.textContent).join(' '),week:!!m.querySelector('.week'),manage:m.querySelectorAll('[data-orb-act=connect]').length,say:(m.querySelector('.more-say')||{}).textContent||''};})()");
          check('17 the Claude inside shows every account, the accounts to fix first, the last seven days and 「계정 관리」',inside.open&&!inside.inert&&inside.accounts>=3&&/home 계정은 다시 로그인해야 합니다/.test(inside.fix)&&/lab 계정은/.test(inside.fix)&&inside.week&&inside.manage===1&&inside.say.length>0,inside);
          const leaveAt=await mv(...away);await wait(900);const rc=await firstMore('claude',false,leaveAt);const rowClose=rc===null?null:Math.round(rc-leaveAt);
          check('17 leaving the rows closes an unpinned inside after about 0.4 s',rowClose!==null&&rowClose>=380&&rowClose<800,{ms:rowClose});
          // 줄을 누르면 고정되어 손이 떠나도 남는다. 다시 읽어 장면이 새로 그려져도 펼침의 단추와 고정한 줄은 그대로다
          await click(w,'#portal-entry button.row[data-svc="claude"]');await mv(...away);await wait(800);
          const pinned=await w.js("(()=>{const b=document.querySelector('#portal-entry button.row[data-svc=\"claude\"]');return b.classList.contains('pin')&&b.nextElementSibling.classList.contains('open');})()");
          check('17 pressing a row pins its inside and leaving does not close it',pinned);
          await captureSizes(w,'subs-inside');
          // 새 자료로 안쪽이 다시 지어져도 「계정 관리」에 있던 초점은 그 단추에 남는다(카본 A4). 1분마다 오는 장면처럼 구독 자료를 바꿔 보낸다
          const withUsed=used=>({...subsRich,seq:used,rows:subsRich.rows.map(r=>r.id==='r-claude'?{...r,live:{...r.live,weekly:{...r.live.weekly,usedPercent:used}}}:r)});
          await w.js("document.querySelector('#portal-entry button.row[data-svc=\"claude\"]').nextElementSibling.querySelector('[data-orb-act=connect]').focus()");
          await w.js('window.__orbFixture.setSubs('+JSON.stringify(withUsed(38))+')');await wait(900);
          const held=await w.js("(()=>{const m=document.querySelector('#portal-entry button.row[data-svc=\"claude\"]').nextElementSibling,a=document.activeElement;return {onManage:!!a&&a.dataset.orbAct==='connect'&&m.contains(a),val:(m.querySelector('.row.sub .val')||{}).textContent||''};})()");
          check('17 a redraw that rebuilds the inside keeps focus on 「계정 관리」',held.onManage&&/62%/.test(held.val),held);
          await w.js('document.activeElement&&document.activeElement.blur&&document.activeElement.blur()');
          // 다가가 머물러 연 펼침은 방에 있던 자판 초점을 구로 옮겼다가, 닫힐 때 그 자리로 돌려놓는다(대체 검수 F5)
          await mv(...away);await wait(300);await w.js("document.querySelector('#portal-entry button.row[data-svc=\"gemini\"]').focus()");
          for(let i=10;i>=0;i--){await mv(orb.x+i*14,orb.y+i*14);await wait(30);}await until(w,s=>s.fan,{timeout:2000});await wait(300);
          const moved=await w.js("document.activeElement===document.querySelector('#portal-entry .here-orb')");
          await mv(...away);await until(w,s=>!s.fan,{timeout:2000});await wait(200);
          const backTo=await w.js("document.activeElement===document.querySelector('#portal-entry button.row[data-svc=\"gemini\"]')");
          check('17 a fan opened by resting gives keyboard focus back to the row when it closes',moved&&backTo,{moved,backTo});
          await w.js('document.activeElement&&document.activeElement.blur&&document.activeElement.blur()');await wait(300);
          // 펼침이 열린 채로 다시 그려져도 펼침의 단추와 고정한 줄은 그대로다(펼친 동안 방은 inert라 자료를 바꿔 보내 다시 그린다)
          await click(w,'#portal-entry .here-orb');await until(w,s=>s.fan);await wait(500);
          await w.js("window.__fanNode=document.querySelector('#portal-entry .fan-go');window.__rowNode=document.querySelector('#portal-entry button.row[data-svc=\"claude\"]');true");
          await w.js('window.__orbFixture.setSubs('+JSON.stringify(withUsed(40))+')');await wait(900);
          const kept=await w.js("(()=>{const b=document.querySelector('#portal-entry button.row[data-svc=\"claude\"]');return {fan:document.querySelector('#portal-entry .fan-go')===window.__fanNode,row:b===window.__rowNode,pin:b.classList.contains('pin'),open:document.querySelector('#portal-entry .orb-stage').dataset.fan==='1',val:(b.querySelector('.val')||{}).textContent||''};})()");
          check('17 a redraw keeps the open fan, its buttons and the pinned row as they were',/60%/.test(kept.val)&&kept.fan&&kept.row&&kept.pin&&kept.open,kept);
          // 150%로 확대한 가장 작은 창(640×453)에서 솔리오 방이 위 84px에서 아래 24px 자리까지 실제로 내려온다(다시 검수 FA1: 선언만 보던 CSS 시험이 놓쳤다)
          await key(w,'Escape');await until(w,s=>!s.fan,{timeout:2000});w.win.setContentSize(640,453);await wait(500);
          const roomBox=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio]').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),h:innerHeight};})()");
          check('17 at 640×453 the Solio room reaches down to 24 px above the window bottom',Math.abs(roomBox.top-84)<=2&&Math.abs(roomBox.h-24-roomBox.bottom)<=2,roomBox);
          w.win.setContentSize(1440,900);await wait(300);
          w.win.destroy();
          // 구독이 없는 계정의 방도 다섯 크기로 찍는다
          const w2=await open();await boot(w2,{subs:subsNone},{restore:signedIn('none')});
          await until(w2,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          await captureSizes(w2,'subs-none');
          w2.win.destroy();
        }
        // 18. 2단계 둘째 조각 첫 묶음: 구독 방의 「요금」 줄과 계정 관리 방(2단계_둘째조각_구현설계.md 12.2절의 1 · 3 · 4 · 5 · 7 · 8 · 9 · 13 · 16).
        //     숨은 창에는 실제 마우스가 오지 않아 요소에 포인터 사건을 직접 보낸다(17번 묶음의 __mv와 같다)
        if(only('18')&&mode==='main'){
          const subsManage={...subsRich,seq:2,platform:'win32',login:null,
            rows:[...subsRich.rows.map(r=>({...r,folder:true,...(r.id==='r-gemini-away'?{price:20,currency:'USD',billDay:9}:{})})),{id:'m-suno',source:'manual',label:'Suno',kind:'credit',price:10,currency:'USD',billDay:5}],
            tools:{claude:{installed:true,version:'2.1.3'},gpt:{installed:false},gemini:{installed:true,version:'1.3'},higgsfield:{installed:false,npm:false},typecast:{installed:true,api:true}}};
          const w=await open();await boot(w,{subs:subsManage},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          await w.js(`(()=>{const chain=e=>{const a=[];for(let n=e;n;n=n.parentElement)a.push(n);return a;};
            const opts=(x,y)=>({bubbles:true,cancelable:true,composed:true,pointerType:'mouse',pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});
            window.__ptr=null;
            window.__mv=(x,y)=>{const t=document.elementFromPoint(x,y)||document.body,prev=window.__ptr,o=opts(x,y);
              if(prev!==t){const was=prev?chain(prev):[],now=chain(t);if(prev)prev.dispatchEvent(new PointerEvent('pointerout',{...o,relatedTarget:t}));for(const n of was)if(!now.includes(n))n.dispatchEvent(new PointerEvent('pointerleave',{...o,bubbles:false,relatedTarget:t}));t.dispatchEvent(new PointerEvent('pointerover',{...o,relatedTarget:prev}));for(const n of now.slice().reverse())if(!was.includes(n))n.dispatchEvent(new PointerEvent('pointerenter',{...o,bubbles:false,relatedTarget:prev}));window.__ptr=t;}
              t.dispatchEvent(new PointerEvent('pointermove',o));return true;};
            const M='#portal-entry [data-room=manage] ';
            window.__q=(key,sel)=>{const b=[...document.querySelectorAll(M+'button.row[data-key]')].find(x=>x.dataset.key===key);return sel?(b?b.nextElementSibling.querySelector(sel):null):b;};
            window.__act=(key,act,arg)=>{const b=window.__q(key);if(!b)return null;return [...b.nextElementSibling.querySelectorAll('[data-room-act]')].find(x=>x.dataset.roomAct===act&&(arg===undefined||x.dataset.roomArg===arg))||null;};
            window.__row=key=>{const b=window.__q(key);if(!b)return null;const m=b.nextElementSibling;return {opened:b.classList.contains('opened'),pin:b.classList.contains('pin'),now:b.classList.contains('now'),gap:b.classList.contains('gap'),inert:m.inert,live:(m.querySelector('[role=status]')||{}).textContent||'',mid:(b.querySelector('.mid')||{}).textContent||''};};
            window.__type=(key,field,value)=>{const i=[...window.__q(key).nextElementSibling.querySelectorAll('input[data-f]')].find(x=>x.dataset.f===field);if(!i)return false;i.focus();i.value=value;i.dispatchEvent(new Event('input',{bubbles:true}));return true;};
            return true;})()`);
          const mv=async(x,y)=>{await w.js('window.__mv('+x+','+y+')');await wait(16);};
          const away=[1380,880];
          const rect=sel=>w.js('(()=>{const r=document.querySelector('+JSON.stringify(sel)+').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()');
          const row=key=>w.js('window.__row('+JSON.stringify(key)+')');
          // 사람처럼 단추에 초점을 먼저 둔 뒤 누른다(누르면 초점이 단추로 간다)
          const act=(key,a,arg)=>w.js('(()=>{const b=window.__act('+JSON.stringify(key)+','+JSON.stringify(a)+(arg===undefined?'':','+JSON.stringify(arg))+');if(!b)return false;b.focus();b.click();return true;})()');
          const actText=(key,a)=>w.js('(window.__act('+JSON.stringify(key)+','+JSON.stringify(a)+')||{}).textContent||""');
          const saves=async()=>(await calls(w)).filter(c=>c.startsWith('subs-save:'));
          // 1. 요금 줄: 구독 줄 아래에 틈을 두고 서고, 이 PC에 없는 계정의 넣은 요금도 합에 든다(설계 검토 D13)
          const cost=await w.js("(()=>{const b=document.querySelector('#portal-entry [data-rows] button.row[data-key=cost]');return b?{gap:b.classList.contains('gap'),mid:b.querySelector('.mid').textContent,when:b.querySelector('.when').textContent,next:b.nextElementSibling.nextElementSibling?.dataset?.key||null,label:b.getAttribute('aria-label')}:null;})()");
          check('18-1 the 「요금」 line stands under the subscription rows with a gap, above the token line, and counts the account not on this PC',!!cost&&cost.gap&&cost.next==='tok'&&/^한 달 약 /.test(cost.mid)&&/이 PC에 없는 계정 포함/.test(cost.mid)&&/^다음 결제 /.test(cost.when),cost);
          // 맨 위 문장이 세 줄이 되면 요금 줄이 900px 창 아래에 걸린다. 사람처럼 방을 내려 그 줄이 보이게 한 뒤 손을 올린다
          await w.js("document.querySelector('#portal-entry [data-rows] button.row[data-key=cost]').scrollIntoView({block:'center'})");await wait(200);
          const c1=await rect('#portal-entry [data-rows] button.row[data-key=cost]');await mv(c1.x,c1.y);await wait(500);
          const costOpen=await w.js("(()=>{const b=document.querySelector('#portal-entry [data-rows] button.row[data-key=cost]'),m=b.nextElementSibling;return {opened:b.classList.contains('opened'),say:(m.querySelector('.more-say')||{}).textContent||'',bills:m.querySelectorAll('.row.sub').length,rate:!!m.querySelector('input[data-f=usdKrw]'),manage:!!m.querySelector('[data-orb-act=connect]')};})()");
          check('18-1 resting on the 「요금」 line opens its bills, the dollar rate and 「계정 관리」',costOpen.opened&&/^한 달에 약 .+원을 냅니다\./.test(costOpen.say)&&costOpen.bills>=3&&costOpen.rate&&costOpen.manage,costOpen);
          await w.js("(()=>{const m=document.querySelector('#portal-entry [data-rows] button.row[data-key=cost]').nextElementSibling,i=m.querySelector('input[data-f=usdKrw]');i.focus();i.value='1500';i.dispatchEvent(new Event('input',{bubbles:true}));[...m.querySelectorAll('[data-room-act]')].find(x=>x.dataset.roomAct==='rate-save').click();return true;})()");await wait(400);
          const rateSaved=(await saves()).some(c=>c.includes('"usdKrw":1500'));
          const costLive=await w.js("(document.querySelector('#portal-entry [data-rows] button.row[data-key=cost]').nextElementSibling.querySelector('[role=status]')||{}).textContent||''");
          check('18-1 saving the dollar rate writes settings.usdKrw and says so in the line',rateSaved&&costLive==='저장했습니다.',{rateSaved,costLive});
          // 칸에 초점이 남아 있어도 저장한 값이 돌아오면 안쪽 문장이 새 합계로 바뀌고, 초점은 그 칸에 남는다
          const afterRate=await w.js("(()=>{const b=document.querySelector('#portal-entry [data-rows] button.row[data-key=cost]'),m=b.nextElementSibling,n=s=>(/약 ([0-9,]+)원/.exec(s)||[])[1]||'';return {mid:n(b.querySelector('.mid').textContent),say:n((m.querySelector('.more-say')||{}).textContent||''),focus:document.activeElement?.dataset?.f||''};})()");
          check('18-1 after the rate is saved the sentence inside shows the same total as the line, and focus stays in the field',!!afterRate.mid&&afterRate.mid===afterRate.say&&afterRate.focus==='usdKrw',afterRate);
          await mv(...away);await wait(300);
          // 요금 줄을 눌러 고정한 채로 다섯 크기를 찍는다. 크기를 바꾼 뒤에는 그 줄이 방 안에 보이게 둔다
          const costSel='#portal-entry [data-rows] button.row[data-key=cost]';await click(w,costSel);await wait(300);
          for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await w.js(`document.querySelector(${JSON.stringify(costSel)}).scrollIntoView({block:'start'})`);await wait(150);await capture(w,`cost-open-${W}`);}
          w.win.setContentSize(1440,900);await wait(300);await click(w,costSel);await wait(300);
          // 3. 구독 줄 안쪽 「계정 관리」 → 계정 관리 방. 손볼 계정(다시 로그인)이 있으면 그 줄을 연 채로 연다
          await w.js("document.activeElement&&document.activeElement.blur&&document.activeElement.blur()");
          await click(w,'#portal-entry button.row[data-svc="claude"]');await wait(400);
          await w.js("document.querySelector('#portal-entry button.row[data-svc=\"claude\"]').nextElementSibling.querySelector('[data-orb-act=connect]').focus()");
          await w.js("document.querySelector('#portal-entry button.row[data-svc=\"claude\"]').nextElementSibling.querySelector('[data-orb-act=connect]').click()");await wait(700);
          const opened=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=manage]');return {shown:!r.hidden,say:r.querySelector('[data-aside-text]').textContent,then:r.querySelector('[data-aside-then]').textContent,onSay:document.activeElement===r.querySelector('[data-aside-say]'),solioHidden:document.querySelector('#portal-entry [data-room=solio]').hidden,heading:document.querySelector('#portal-entry [data-orb-heading]').textContent};})()");
          const fix=await row('a:r-claude-2');
          check('18-3 the inside 「계정 관리」 opens the room on the account to fix, with focus on the first sentence',opened.shown&&opened.solioHidden&&opened.onSay&&opened.say==='연결한 계정은 일곱이고, 직접 넣은 구독은 하나입니다.'&&/다시 로그인해야 합니다\.$/.test(opened.then)&&opened.heading==='계정 관리'&&fix?.opened&&fix.pin&&fix.now,{opened,fix});
          await captureSizes(w,'manage-fix');
          // 13. Esc 차례: 열린 줄을 먼저 접고, 그다음 방을 닫고, 초점은 방을 연 자리로 간다
          await key(w,'Escape');await wait(200);
          const e1=await w.js("(()=>({manage:!document.querySelector('#portal-entry [data-room=manage]').hidden,open:document.querySelectorAll('#portal-entry [data-room=manage] .more.open').length}))()");
          await key(w,'Escape');await wait(300);
          const e2=await w.js("(()=>{const c=document.querySelector('#portal-entry button.row[data-svc=\"claude\"]').nextElementSibling.querySelector('[data-orb-act=connect]');return {manage:!document.querySelector('#portal-entry [data-room=manage]').hidden,solio:!document.querySelector('#portal-entry [data-room=solio]').hidden,back:document.activeElement===c};})()");
          check('18-13 Esc folds the open row first, then closes the room and gives focus back to the button that opened it',e1.manage&&e1.open===0&&!e2.manage&&e2.solio&&e2.back,{e1,e2});
          await click(w,'[data-orb-act="subs-manage"]');await wait(600);
          // 다가가서 머물면 열리고(0.12초), 줄 묶음을 벗어나 머물면 고정하지 않은 줄이 접힌다(0.4초)
          await key(w,'Escape');await wait(150);
          const g1=await rect('#portal-entry [data-room=manage] button.row[data-key="a:r-gpt"]');await mv(g1.x,g1.y);await wait(450);
          const hover=await row('a:r-gpt');await mv(...away);await wait(900);const left=await row('a:r-gpt');
          check('18 a row opens when the pointer rests on it and folds again after the pointer leaves the rows',hover.opened&&!hover.pin&&!left.opened,{hover,left});
          // 8. 지우기 두 번: 더블클릭 한 번으로는 지워지지 않고, 0.6초 뒤의 두 번째 누름에 지운다
          await click(w,'#portal-entry [data-room=manage] button.row[data-key="a:r-gpt"]');await wait(300);
          await w.js("(()=>{const b=window.__act('a:r-gpt','remove');b.click();b.click();return true;})()");await wait(200);
          const armed=await w.js("(()=>{const b=window.__act('a:r-gpt','remove'),live=document.getElementById(b?.getAttribute('aria-describedby')||'');return {text:b?.textContent||'',warn:!!b&&b.classList.contains('warn'),live:live?.textContent||'',role:live?.getAttribute('role')||''};})()");
          const gone1=(await saves()).some(c=>c.includes('"remove":"r-gpt"'));
          check('18-8 one double click asks only: the button now says 「한 번 더 누르면 지웁니다」 and its status line says what goes',armed.text==='한 번 더 누르면 지웁니다'&&armed.warn&&/되돌릴 수 없습니다|그대로 둡니다/.test(armed.live)&&armed.role==='status'&&!gone1,{armed,gone1});
          await w.js("window.__act('a:r-gpt','remove')?.scrollIntoView({block:'center'})");await wait(150);await capture(w,'manage-remove-ask');
          await wait(700);await act('a:r-gpt','remove');await wait(500);
          const gone2=(await saves()).some(c=>c.includes('"remove":"r-gpt"'));
          const foot=await text(w,'#portal-entry [data-room=manage] [data-aside-foot]');
          check('18-8 a second press after 0.6 s removes the account line',gone2&&!(await row('a:r-gpt'))&&/줄을 지웠습니다\.$/.test(foot),{gone2,foot});
          // 10초가 지나면 물음을 거둔다
          await click(w,'#portal-entry [data-room=manage] button.row[data-key="a:r-gemini"]');await wait(300);
          await act('a:r-gemini','remove');await wait(150);const ask1=await actText('a:r-gemini','remove');
          await wait(10400);const ask2=await actText('a:r-gemini','remove');
          check('18-8 the question goes away by itself after 10 s',ask1==='한 번 더 누르면 지웁니다'&&ask2==='지우기',{ask1,ask2});
          // 손이 그 줄의 안쪽을 떠나면 거둔다
          await act('a:r-gemini','remove');await wait(150);
          const rb=await w.js("(()=>{const r=window.__act('a:r-gemini','remove').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()");
          await mv(rb.x,rb.y);await wait(80);await mv(...away);await wait(300);
          const ask3=await actText('a:r-gemini','remove');
          // 초점이 그 줄의 안쪽을 떠나도 거둔다
          await act('a:r-gemini','remove');await wait(150);
          // 숨은 창에는 초점 사건이 오지 않아(16번 묶음과 같다) 초점을 옮긴 뒤 focusout을 직접 보낸다
          await w.js("(()=>{const b=window.__act('a:r-gemini','remove'),r=window.__q('a:r-gemini');b.focus();r.focus();b.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:r}));return true;})()");await wait(300);
          const ask4=await actText('a:r-gemini','remove');
          check('18-8 the question also goes away when the pointer or the keyboard focus leaves the inside',ask3==='지우기'&&ask4==='지우기',{ask3,ask4});
          // 1분 장면(새 구독 자료)이 와도 물음은 남는다
          await act('a:r-gemini','remove');await wait(150);
          await w.js('window.__orbFixture.setSubs('+JSON.stringify({...(await w.js('window.__orbFixture.subs()')),seq:900})+')');await wait(400);
          const ask5=await actText('a:r-gemini','remove');
          check('18-8 a fresh scene keeps the question',ask5==='한 번 더 누르면 지웁니다',{ask5});
          await w.js("window.__q('a:r-gemini').click()");await wait(300);
          // 요금과 결제일: 칸에 쓰던 글은 새 장면에 지워지지 않고, 틀린 결제일은 그 줄에서 알린다
          await click(w,'#portal-entry [data-room=manage] button.row[data-key="a:r-claude"]');await wait(300);
          await act('a:r-claude','grp','cost');await wait(300);
          const grpFocus=await w.js("(()=>{const a=document.activeElement;return {field:a?.dataset?.f||null,grp:!!a?.closest?.('[data-grp=cost]')};})()");
          await w.js("window.__type('a:r-claude','price','300000')");
          const cur=await w.js('window.__orbFixture.subs()');
          await w.js('window.__orbFixture.setSubs('+JSON.stringify({...cur,seq:901,rows:cur.rows.map(r=>r.id==='r-claude'?{...r,live:{...r.live,weekly:{...r.live.weekly,usedPercent:44}}}:r)})+')');await wait(400);
          const typed=await w.js("(()=>{const i=window.__q('a:r-claude','input[data-f=price]');return {value:i?.value,focused:document.activeElement===i,say:(window.__q('a:r-claude','.more-say')||{}).textContent||''};})()");
          check('18 a field being typed in keeps its text and focus when a new scene arrives',grpFocus.grp&&grpFocus.field==='price'&&typed.value==='300000'&&typed.focused,{grpFocus,typed});
          await captureSizes(w,'manage-cost-edit');
          await key(w,'Escape');await wait(300);
          const afterEsc=await w.js("(()=>{const i=window.__q('a:r-claude','input[data-f=price]');return {value:i?.value,open:window.__q('a:r-claude').classList.contains('opened'),onRow:document.activeElement===window.__q('a:r-claude'),say:(window.__q('a:r-claude','.more-say')||{}).textContent||''};})()");
          check('18-13 Esc in a field folds the row and keeps the written text, and the new scene is drawn once focus leaves',afterEsc.value==='300000'&&!afterEsc.open&&afterEsc.onRow&&/56% 남았습니다/.test(afterEsc.say)&&!/56%/.test(typed.say),{afterEsc,before:typed.say});
          await w.js("window.__q('a:r-claude').click()");await wait(300);
          await w.js("window.__type('a:r-claude','billDay','40')");await act('a:r-claude','save-cost');await wait(300);
          const badDay=(await row('a:r-claude')).live;
          await w.js("window.__type('a:r-claude','billDay','7')");await act('a:r-claude','save-cost');await wait(500);
          const savedCost=(await saves()).find(c=>c.includes('"id":"r-claude"')&&c.includes('"billDay":7'))||'';
          const afterSave=await w.js("(()=>{const g=window.__q('a:r-claude','[data-grp=cost]'),a=document.activeElement;return {grpHidden:!!g&&g.hidden,live:(window.__q('a:r-claude','[role=status]')||{}).textContent||'',focusOn:a?.dataset?.roomAct+':'+(a?.dataset?.roomArg||''),opened:window.__q('a:r-claude').classList.contains('opened')};})()");
          check('18-7 a wrong billing day is refused in the line, and a right one saves, folds the group and leaves focus on 「요금과 결제일」',badDay==='결제일은 1부터 31 사이로 넣어 주세요.'&&savedCost.includes('"price":300000')&&afterSave.grpHidden&&afterSave.live==='저장했습니다.'&&afterSave.focusOn==='grp:cost'&&afterSave.opened,{badDay,savedCost,afterSave});
          // 5. 계정 더하기: 설치 안 됨 → 설치 창 열기 → 다시 확인 단추. 640×453에서도 지금 누를 단추가 방 안에 보인다
          await w.js("window.__q('add').click()");await wait(300);
          await w.js("[...window.__q('add').nextElementSibling.querySelectorAll('[data-pv]')].find(b=>b.dataset.pv==='gpt').click()");await wait(300);
          const inst=await actText('add','install'),recheck0=await actText('add','recheck-tools');
          await act('add','install','gpt');await wait(400);
          const instCalled=(await calls(w)).includes('subs-install:gpt');
          const recheck=await actText('add','recheck-tools');
          check('18-5 adding Codex that is not installed offers 「설치 창 열기」 and 「다시 확인」 (for a hand install too), then 「다시 확인」 alone',inst==='설치 창 열기'&&recheck0==='다시 확인'&&instCalled&&recheck==='다시 확인'&&!(await actText('add','install')),{inst,recheck0,instCalled,recheck});
          await capture(w,'manage-add-install');
          w.win.setContentSize(640,453);await wait(500);
          await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=manage]');r.scrollTop=0;return true;})()");await wait(100);
          await act('add','recheck-tools','gpt');await wait(900);
          const vis640=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=manage]').getBoundingClientRect(),b=window.__act('add','recheck-tools')?.getBoundingClientRect();return b?{room:[Math.round(r.top),Math.round(r.bottom)],btn:[Math.round(b.top),Math.round(b.bottom)],inside:b.top>=r.top-1&&b.bottom<=r.bottom+1}:null;})()");
          check('18-5 at 640×453 the button to press now sits inside the room after pressing it',!!vis640&&vis640.inside,vis640);
          await capture(w,'manage-add-640');
          w.win.setContentSize(1440,900);await wait(400);
          // Claude: 설치됨 → 연결할 이메일과 새 계정 연결 → 코드 → 연결 → 끝나면 더하기 줄이 접힌다
          await w.js("[...window.__q('add').nextElementSibling.querySelectorAll('[data-pv]')].find(b=>b.dataset.pv==='claude').click()");await wait(300);
          await w.js("window.__type('add','email','qa@example.com')");await act('add','login','claude');await wait(300);
          const loginCalled=(await calls(w)).includes('subs-login:claude:qa@example.com');
          await w.js('window.__orbFixture.setLogin('+JSON.stringify({id:'l-qa',service:'claude',stage:'browser',url:'https://claude.ai/qa-login',needsCode:true,message:''})+')');await wait(400);
          const codeStep=await w.js("({field:!!window.__q('add','input[data-f=code]'),console:!!window.__act('add','console-login')})");
          await w.js("window.__type('add','code','short')");await act('add','code');await wait(250);
          const shortCode=(await row('add')).live;
          await w.js("window.__type('add','code','QACODE1234')");await act('add','code');await wait(300);
          const codeSent=(await calls(w)).includes('subs-code:l-qa');
          await capture(w,'manage-add-code');
          await w.js('window.__orbFixture.setLogin('+JSON.stringify({id:'l-qa',service:'claude',stage:'done',url:null,needsCode:false,message:'qa@example.com 계정을 연결했어요.'})+')');await wait(500);
          const done=await w.js("(()=>({opened:window.__q('add').classList.contains('opened'),foot:document.querySelector('#portal-entry [data-room=manage] [data-aside-foot]').textContent}))()");
          check('18-5 Claude: e-mail, browser code, a short code refused, the code sent, and the add line folds when it is done',loginCalled&&codeStep.field&&codeStep.console&&shortCode==='코드를 끝까지 붙여 넣어 주세요.'&&codeSent&&!done.opened&&/Claude 새 계정 줄을 더했습니다\./.test(done.foot),{loginCalled,codeStep,shortCode,codeSent,done});
          // Typecast 연결이 실패하면 다시 입력할 수 있고, 성공하면 접힌 줄에도 방금 넣은 시험 키가 남지 않는다.
          await w.js("window.__q('add').click()");await wait(300);
          await w.js("[...window.__q('add').nextElementSibling.querySelectorAll('[data-pv]')].find(b=>b.dataset.pv==='typecast').click()");await wait(300);
          await w.js("window.__type('add','key','orb-qa-rejected-key')");await key(w,'Return');await wait(400);
          const retryKey=await w.js("(()=>{const i=window.__q('add','input[data-f=key]');return !!i&&i.offsetWidth>0&&i.value==='orb-qa-rejected-key';})()");
          // 실패하면 초점이 저장 단추에 남지 않고 칸으로 돌아온다(PC 0.5.0 설계 2절, 화면 -k P2)
          const retryFocus=await w.js("(()=>{const i=window.__q('add','input[data-f=key]');return !!i&&document.activeElement===i;})()");
          await w.js("window.__type('add','key','orb-qa-accepted-key')");await key(w,'Return');await wait(500);
          const finishedKey=await w.js("(()=>{const b=window.__q('add');return {closed:!b.classList.contains('opened'),retained:[...document.querySelectorAll('input[type=password]')].some(i=>i.value==='orb-qa-accepted-key')};})()");
          const keyCalls=(await calls(w)).filter(call=>call==='subs-key:typecast').length;
          check('18-5 Enter preserves a rejected key for retry with the focus back in its field, and clears a successfully connected key from the closed row',retryKey&&retryFocus&&keyCalls===2&&finishedKey.closed&&!finishedKey.retained,{retryKey,retryFocus,keyCalls,finishedKey});
          // 9. 막혔을 때: 물음 열둘, 누르면 답이 바로 아래에 나온다
          await w.js("window.__q('help').click()");await wait(400);
          const help=await w.js("(()=>{const m=window.__q('help').nextElementSibling,q=[...m.querySelectorAll('button[data-qa]')];q[3].click();const a=q[3].parentElement.nextElementSibling;return {count:q.length,shown:!a.hidden,expanded:q[3].getAttribute('aria-expanded'),answer:a.textContent};})()");
          check('18-9 「막혔을 때」 has twelve questions and an answer opens right under the one pressed',help.count===12&&help.shown&&help.expanded==='true'&&/검은 창/.test(help.answer),help);
          await capture(w,'manage-help');
          // 펼침이 열린 동안 방은 흐리고 Tab에서 빠진다
          await click(w,'#portal-entry .here-orb');await until(w,s=>s.fan);await wait(500);
          const dim=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=manage]');return {inert:r.inert,opacity:getComputedStyle(r).opacity};})()");
          check('18-14 while the fan is open the room is dimmed and out of the Tab order',dim.inert&&Number(dim.opacity)<0.2,dim);
          await key(w,'Escape');await until(w,s=>!s.fan,{timeout:2000});
          w.win.destroy();
        }
        // 18 둘째 묶음: 구독 방의 「모델별 토큰」 줄(12.2절의 2)과 내 계정 방(12.2절의 10 · 11 · 15). 숨은 창이라 누르기 전에 초점을 먼저 둔다
        if(only('18')&&mode==='main'){
          const tday=k=>{const d=new Date(now-k*D);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
          const tokCells=[[tday(0),'claude','claude-opus-5-5',900,61000,0,0,0,40],[tday(1),'claude','claude-sonnet-5',500,22000,0,0,0,30],[tday(2),'gpt','gpt-6.1-sol',300,17000,0,0,0,25]];
          const w=await open();await boot(w,{subs:subsReady,tokens:{ok:true,enabled:false,epoch:1,seq:1}},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          const TOK='#portal-entry [data-rows] button.row[data-key=tok]';
          const tokState=()=>w.js(`(()=>{const b=document.querySelector(${JSON.stringify(TOK)});if(!b)return null;const m=b.nextElementSibling;return {opened:b.classList.contains('opened'),unread:b.classList.contains('unread'),mid:b.querySelector('.mid').textContent,val:b.querySelector('.val').textContent,when:b.querySelector('.when').textContent,afterCost:b.previousElementSibling?.previousElementSibling?.dataset?.key==='cost',live:(m.querySelector('[role=status]')||{}).textContent||'',gauges:m.querySelectorAll('.gauge').length};})()`);
          const tokBtn=(a,arg)=>`[...document.querySelector(${JSON.stringify(TOK)}).nextElementSibling.querySelectorAll('[data-room-act]')].find(q=>q.dataset.roomAct===${JSON.stringify(a)}&&(${JSON.stringify(arg===undefined)}||q.dataset.roomArg===${JSON.stringify(arg??'')}))`;
          const tokAct=(a,arg)=>w.js(`(()=>{const x=${tokBtn(a,arg)};if(!x)return false;x.focus();x.click();return true;})()`);
          const tokText=a=>w.js(`(()=>{const x=${tokBtn(a)};return x?x.textContent:'';})()`);
          const since=async n=>(await calls(w)).slice(n);
          const t0=await tokState();
          check('18-2 the 「모델별 토큰」 line stands under the cost line, dim and switched off',!!t0&&t0.afterCost&&t0.unread&&t0.mid==='꺼져 있습니다',t0);
          await click(w,TOK);await wait(400);
          await w.js(`document.querySelector(${JSON.stringify(TOK)}).scrollIntoView({block:'start'})`);await wait(150);await capture(w,'tok-off-open');
          let n0=(await calls(w)).length;
          await tokAct('tok-on');await wait(700);
          const t1=await tokState(),c1=await since(n0);
          check('18-2 switching on starts the first count, says it may take minutes, and asks for live counting while the line is open',t1.mid==='처음 세는 중입니다'&&t1.val==='0/40'&&t1.live==='켰습니다. 기록이 많으면 처음 세는 데 몇 분 걸립니다.'&&c1.includes('subs-tokens-enable:true')&&c1.includes('subs-tokens-live:true'),{t1,c1});
          await w.js('window.__orbFixture.setTokens({scanning:true,progress:{done:20,total:40}})');await wait(1400);
          const t2=await tokState();
          check('18-2 the first count shows its progress',t2.val==='20/40',t2);
          await w.js('window.__orbFixture.setTokens('+JSON.stringify({scanning:false,progress:null,scannedAt:now,liveAt:null,since:tday(20),sinceBy:{claude:tday(20),gpt:tday(20)},tools:{claude:3,gpt:1},failed:0,error:null,cells:tokCells})+')');await wait(600);
          const t3=await tokState();
          check('18-2 once counted the closed line names the top model and its share, with the total and responses',/^가장 많이 쓴 모델은 Opus 5\.5입니다 · \d+%$/.test(t3.mid)&&!!t3.val&&t3.when==='지난 7일 · 응답 95번'&&t3.gauges===3,t3);
          // 기간을 고르면 줄이 열린 채 서고 초점이 고른 단추에 남는다
          await tokAct('tok-range','today');await wait(400);
          const t4=await w.js(`(()=>{const b=document.querySelector(${JSON.stringify(TOK)}),a=document.activeElement;return {opened:b.classList.contains('opened'),focus:a?.dataset?.pv||null,pressed:b.nextElementSibling.querySelector('[data-pv="today"]')?.getAttribute('aria-pressed'),when:b.querySelector('.when').textContent};})()`);
          check('18-2 choosing 「오늘」 keeps the line open and focus on that button',t4.opened&&t4.focus==='today'&&t4.pressed==='true'&&t4.when==='오늘 · 응답 40번',t4);
          await tokAct('tok-range','week');await wait(300);
          for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await w.js(`document.querySelector(${JSON.stringify(TOK)}).scrollIntoView({block:'start'})`);await wait(150);await capture(w,`tok-open-${W}`);}
          w.win.setContentSize(1440,900);await wait(300);
          // 11-20부터 구독 방 맨 위의 「지금 출력」이 늘 보이므로, 줄을 접어도 방이 보이는 동안은 실시간 부탁을 거두지 않는다(솔리오 구독 비서 설계 3.3)
          n0=(await calls(w)).length;await click(w,TOK);await wait(500);
          const c2=await since(n0);
          check('18-2 folding the line keeps the live counting while the room is shown (솔리오 구독 비서 3.3)',!c2.includes('subs-tokens-live:false'),{c2});
          // 끄기 두 번: 더블클릭 한 번은 묻기만 하고, 0.6초 뒤의 두 번째 누름에 끄고 지운다
          await click(w,TOK);await wait(400);
          await w.js(`(()=>{const x=${tokBtn('tok-off')};x.click();x.click();return true;})()`);await wait(300);
          const off1=await tokText('tok-off'),sent1=(await calls(w)).includes('subs-tokens-enable:false');
          check('18-2 one double click on 「끄기」 only asks',off1==='한 번 더 누르면 끄고 지웁니다'&&!sent1,{off1,sent1});
          await wait(700);await tokAct('tok-off');await wait(700);
          const t5=await tokState();
          check('18-2 a second press after 0.6 s switches off and says the numbers are gone',(await calls(w)).includes('subs-tokens-enable:false')&&t5.mid==='꺼져 있습니다'&&t5.live==='모델별 토큰을 끄고 모은 숫자를 지웠습니다.',t5);
          await click(w,TOK);await wait(300);await w.js('document.activeElement&&document.activeElement.blur&&document.activeElement.blur()');
          // 10. 내 계정: 펼침의 「계정」이 새 얼굴의 방을 연다
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await click(w,'.fan [data-foot="account"]');await wait(900);
          const A='#portal-entry [data-room=account] ';
          await w.js(`(()=>{window.__aq=(key,sel)=>{const b=[...document.querySelectorAll(${JSON.stringify(A+'button.row[data-key]')})].find(x=>x.dataset.key===key);return sel?(b?b.nextElementSibling.querySelector(sel):null):b;};
            window.__aact=(key,act,arg)=>{const b=window.__aq(key);if(!b)return null;return [...b.nextElementSibling.querySelectorAll('[data-room-act]')].find(x=>x.dataset.roomAct===act&&(arg===undefined||x.dataset.roomArg===arg))||null;};
            window.__alive=key=>((window.__aq(key)?.nextElementSibling.querySelector('[role=status]'))||{}).textContent||'';return true;})()`);
          const aact=(key,a,arg)=>w.js('(()=>{const b=window.__aact('+JSON.stringify(key)+','+JSON.stringify(a)+(arg===undefined?'':','+JSON.stringify(arg))+');if(!b)return false;b.focus();b.click();return true;})()');
          const aopen=key=>w.js('(()=>{const b=window.__aq('+JSON.stringify(key)+');if(!b.classList.contains("opened"))b.click();return true;})()');
          const alive=key=>w.js('window.__alive('+JSON.stringify(key)+')');
          const atype=(key,field,value)=>w.js('(()=>{const i=[...window.__aq('+JSON.stringify(key)+').nextElementSibling.querySelectorAll("input[data-f]")].find(x=>x.dataset.f==='+JSON.stringify(field)+');if(!i)return false;i.focus();i.value='+JSON.stringify(value)+';i.dispatchEvent(new Event("input",{bubbles:true}));return true;})()');
          const atext=sel=>text(w,A+sel);
          const a0=await w.js(`(()=>{const r=document.querySelector('#portal-entry [data-room=account]');return {shown:!r.hidden,solioHidden:document.querySelector('#portal-entry [data-room=solio]').hidden,say:r.querySelector('[data-aside-text]').textContent,then:r.querySelector('[data-aside-then]').textContent,foot:r.querySelector('[data-aside-foot]').textContent,heading:document.querySelector('#portal-entry [data-orb-heading]').textContent,onSay:document.activeElement===r.querySelector('[data-aside-say]'),rows:[...r.querySelectorAll('button.row[data-key]')].map(b=>b.dataset.key),email:(window.__aq('login').querySelector('.when')||{}).textContent};})()`);
          check('18-10 「계정」 opens 내 계정 with the member name, the places, the whole e-mail and the account number',a0.shown&&a0.solioHidden&&a0.onSay&&a0.say==='합성 회원 님으로 로그인했습니다.'&&a0.then==='이 PC를 포함해 세 곳에서 쓰고 있습니다.'&&/^문의할 때 쓰는 계정 번호 20000000-/.test(a0.foot)&&a0.heading==='내 계정'&&JSON.stringify(a0.rows)==='["name","login","places","data","del"]'&&a0.email==='member@example.com',a0);
          await captureSizes(w,'account-room');
          // 이름: 빈 이름과 61자는 그 줄에서 거절하고, 새 이름은 저장해 맨 위 문장이 바뀐다
          await aopen('name');await wait(300);
          await atype('name','name','  ');await aact('name','name-save');await wait(300);const n1=await alive('name');
          await atype('name','name','가'.repeat(61));await aact('name','name-save');await wait(300);const n2=await alive('name');
          await atype('name','name','새 합성 이름');await aact('name','name-save');await wait(800);const n3=await alive('name'),say2=await atext('[data-aside-text]');
          check('18-10 a name is refused empty or over 60, and a new one is saved and named at the top',n1==='이름을 넣어 주세요.'&&n2==='이름은 60자 안으로 적어 주세요.'&&n3==='이름을 바꿨습니다. SYNK 앱마다 다음에 열 때 새 이름이 보입니다.'&&say2==='새 합성 이름 님으로 로그인했습니다.'&&(await calls(w)).includes('updateProfile'),{n1,n2,n3,say2});
          // 로그인과 보안은 기본 브라우저에서 연다
          await aopen('login');await wait(300);await aact('login','security','password');await wait(400);
          const s1=await alive('login');
          check('18-10 「바꾸기 ↗」 opens 「로그인과 보안」 in the browser and says what follows',(await calls(w)).includes('security:password')&&s1==='기본 브라우저에서 SYNK ID의 「로그인과 보안」을 열었습니다. 비밀번호를 바꾸면 이 PC 앱도 로그아웃됩니다.',{s1});
          // 로그인한 곳: 한 곳을 로그아웃시키면 목록과 맨 위 둘째 줄이 따라 바뀐다
          await aopen('places');await wait(300);
          await w.js("window.__aq('places').scrollIntoView({block:'start'})");await wait(150);await capture(w,'account-places');
          await aact('places','revoke','s-phone');await wait(800);
          const p1=await w.js("(()=>({rows:window.__aq('places').nextElementSibling.querySelectorAll('.row.sub').length,live:window.__alive('places'),then:document.querySelector('#portal-entry [data-room=account] [data-aside-then]').textContent}))()");
          check('18-10 one place is signed out and the list and the count follow',(await calls(w)).includes('revokeSession:s-phone')&&p1.rows===2&&p1.live==='그 기기의 로그인을 끝냈습니다.'&&p1.then==='이 PC를 포함해 두 곳에서 쓰고 있습니다.',p1);
          // 학습 기록 연결
          await aopen('data');await wait(300);await aact('data','learning');await wait(800);
          const l1=await w.js("(()=>{const s=window.__aq('data').nextElementSibling.querySelector('[role=switch]');return {checked:s.getAttribute('aria-checked'),text:s.textContent,live:window.__alive('data')};})()");
          check('18-10 the learning switch turns on through the account server',(await calls(w)).includes('setLearning')&&l1.checked==='true'&&l1.text==='켜짐'&&l1.live==='학습 기록 연결을 켰습니다.',l1);
          await w.js("window.__aq('data').scrollIntoView({block:'start'})");await wait(150);await capture(w,'account-data');
          // 11. 계정 지우기 요청: 확인 묶음이 펼쳐지고 초점이 물음 줄에 온다. 펼친 직후의 보내기는 받지 않는다
          await aopen('del');await wait(300);
          const d0=await w.js("(async()=>{const ask=window.__aact('del','delete-ask');ask.focus();const t0=performance.now();ask.click();let send=null;for(let i=0;i<30&&!(send=window.__aact('del','delete-send'));i++)await new Promise(r=>setTimeout(r,10));if(send)send.click();return {found:!!send,gap:Math.round(performance.now()-t0)};})()");
          await wait(400);
          const d1=await w.js("(()=>{const g=window.__aq('del').nextElementSibling.querySelector('.confirm'),q=g?.querySelector('[data-ask-q]');return {shown:!!g,role:g?.getAttribute('role'),labelled:!!q&&g.getAttribute('aria-labelledby')===q.id,onQ:!!q&&document.activeElement===q,q:q?.textContent||'',facts:g?g.querySelectorAll('.more-note').length:0,expanded:window.__aact('del','delete-ask')?.getAttribute('aria-expanded')};})()");
          const early=(await calls(w)).includes('requestDeletion');
          check('18-11 「지우기 요청」 opens the confirm group with focus on its question, and an immediate send is not taken',d0.found&&d0.gap<500&&d1.shown&&d1.role==='group'&&d1.labelled&&d1.onQ&&d1.q==='계정 삭제를 요청하시겠습니까?'&&d1.facts===3&&d1.expanded==='true'&&!early,{d0,d1,early});
          for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await w.js("window.__aq('del').scrollIntoView({block:'start'})");await wait(150);await capture(w,`account-delete-confirm-${W}`);}
          w.win.setContentSize(1440,900);await wait(300);
          await aact('del','delete-send');await wait(900);
          const d2=await w.js("(()=>{const b=window.__aq('del');return {val:b.querySelector('.val').textContent,say:document.querySelector('#portal-entry [data-room=account] [data-aside-text]').textContent,live:window.__alive('del'),cancel:!!window.__aact('del','delete-cancel')};})()");
          check('18-11 sending requests the deletion, and the room says until when it can be cancelled',(await calls(w)).includes('requestDeletion')&&d2.val==='요청됨'&&d2.say==='계정을 지워 달라고 요청했습니다.'&&/^삭제 요청을 받았습니다\. .+까지는 이 자리에서 취소할 수 있습니다\.$/.test(d2.live)&&d2.cancel,d2);
          await w.js("window.__aq('del').scrollIntoView({block:'start'})");await wait(150);await capture(w,'account-delete-requested');
          await aact('del','delete-cancel');await wait(900);
          const d3={say:await atext('[data-aside-text]'),live:await alive('del')};
          check('18-11 cancelling the request brings the name back and says learning stays off',(await calls(w)).includes('cancelDeletion')&&d3.say==='새 합성 이름 님으로 로그인했습니다.'&&d3.live==='삭제 요청을 취소했습니다. 학습 기록 연결은 꺼 둔 채입니다.',d3);
          // 모든 곳에서 로그아웃: 더블클릭 한 번은 묻기만 한다. 쓰던 글이 없으면 두 번째 누름에 바로 보내고, 이 PC도 로그아웃되어 묻는 화면으로 간다
          await aopen('places');await wait(300);
          await w.js("(()=>{const b=window.__aact('places','revoke-all');b.click();b.click();return true;})()");await wait(300);
          const r1=await w.js("(()=>{const b=window.__aact('places','revoke-all'),live=document.getElementById(b?.getAttribute('aria-describedby')||'');return {text:b?.textContent||'',live:live?.textContent||''};})()");
          const sentAll=(await calls(w)).includes('revokeAll');
          check('18-10 one double click on 「모든 곳에서 로그아웃」 only asks and says this PC signs out too',r1.text==='한 번 더 누르면 모두 로그아웃합니다'&&/이 PC도 바로 로그아웃됩니다\.$/.test(r1.live)&&!sentAll,{r1,sentAll});
          await wait(700);await aact('places','revoke-all');
          const lo=await until(w,s=>s.phase==='auth'&&s.ui==='ask',{timeout:12000});
          const after=await w.js("({room:document.querySelector('#portal-entry [data-room=account]').hidden,dialog:!!document.querySelector('#leave-dialog[open]')})");
          check('18-15 a second press signs out everywhere, closes the room and goes back to the ask scene',lo.ok&&(await calls(w)).includes('revokeAll')&&after.room&&!after.dialog,{...lo.state,...after});
          w.win.destroy();
        }
        // 18 셋째 묶음: 구독 줄 안의 팁(설계 검토 D7)과 설정 방(12.2절의 12). 숨은 창이라 누르기 전에 초점을 먼저 둔다
        if(only('18')&&mode==='main'){
          const subsTip={ok:true,seq:3,rows:[row('r-claude','claude',36,now+3*D,{passCount:1,passUntil:now+2*D}),row('r-gpt','gpt',40,now+5*D)],check:{at:now-5*60e3},checking:false,usage:{accounts:{}},settings:{}};
          const w=await open();await boot(w,{subs:subsTip},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(1600);
          // 구독 줄의 팁: 줄을 열면 작은 글 한 줄과 반응 단추 둘이 선다
          const SUB='#portal-entry [data-rows] button.row[data-svc=claude]';
          const tip=()=>w.js(`(()=>{const b=document.querySelector(${JSON.stringify(SUB)}),m=b.nextElementSibling;return {opened:b.classList.contains('opened'),tip:(m.querySelector('.more-tip')||{}).textContent||'',acts:[...m.querySelectorAll('[data-room-act=tip]')].map(x=>x.textContent),arg:(m.querySelector('[data-room-act=tip]')||{dataset:{}}).dataset.roomArg||'',live:[...m.querySelectorAll('.more-live')].map(x=>x.textContent).join(''),focusRow:document.activeElement===b};})()`);
          await w.js(`document.querySelector(${JSON.stringify(SUB)}).click()`);await wait(500);
          const tp0=await tip();
          check('18-6 a subscription row carries one tip line with 「도움 됐습니다」 and 「이런 팁 그만」',tp0.opened&&/^Claude 초기화권 1장이 .+ 만료됩니다\./.test(tp0.tip)&&JSON.stringify(tp0.acts)==='["도움 됐습니다","이런 팁 그만"]'&&tp0.arg==='pass:claude|helpful',tp0);
          for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await w.js(`document.querySelector(${JSON.stringify(SUB)}).scrollIntoView({block:'start'})`);await wait(150);await capture(w,`sub-tip-${W}`);}
          w.win.setContentSize(1440,900);await wait(300);
          await w.js(`(()=>{const x=[...document.querySelector(${JSON.stringify(SUB)}).nextElementSibling.querySelectorAll('[data-room-act=tip]')].find(q=>q.textContent==='이런 팁 그만');x.focus();x.click();return true;})()`);await wait(700);
          const tp1=await tip(),tipSave=(await calls(w)).filter(c=>c.startsWith('subs-save:{"tip"'));
          check('18-6 「이런 팁 그만」 saves like the old board, the buttons go, the line says how long it rests, and focus goes back to the row',tipSave.length===1&&tipSave[0]==='subs-save:{"tip":{"key":"pass:claude","action":"stop"}}'&&tp1.acts.length===0&&tp1.live==='이 종류의 팁은 4주 동안 쉽니다.'&&!!tp1.tip&&tp1.focusRow,{tp1,tipSave});
          await w.js(`document.querySelector(${JSON.stringify(SUB)}).click()`);await wait(300);await w.js('document.activeElement&&document.activeElement.blur&&document.activeElement.blur()');
          // 설정 방: 펼침의 「설정」이 새 얼굴의 방을 연다
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await w.js("document.querySelector('.fan [data-foot=settings]').focus()");await click(w,'.fan [data-foot="settings"]');await wait(900);
          const S='#portal-entry [data-room=settings] ';
          await w.js(`(()=>{window.__sq=key=>[...document.querySelectorAll(${JSON.stringify(S+'button.row[data-key]')})].find(x=>x.dataset.key===key)||null;
            window.__sin=key=>window.__sq(key)?.nextElementSibling||null;
            window.__sact=(key,act,arg)=>[...(window.__sin(key)?.querySelectorAll('[data-room-act]')||[])].find(x=>x.dataset.roomAct===act&&(arg===undefined||x.dataset.roomArg===arg))||null;
            window.__slive=key=>((window.__sin(key)?.querySelector('[role=status]'))||{}).textContent||'';return true;})()`);
          const sact=(key,a,arg)=>w.js('(()=>{const b=window.__sact('+JSON.stringify(key)+','+JSON.stringify(a)+(arg===undefined?'':','+JSON.stringify(arg))+');if(!b)return false;b.focus();b.click();return true;})()');
          const sopen=key=>w.js('(()=>{const b=window.__sq('+JSON.stringify(key)+');if(!b.classList.contains("opened"))b.click();return true;})()');
          const slive=key=>w.js('window.__slive('+JSON.stringify(key)+')');
          const stype=(key,field,value)=>w.js('(()=>{const i=[...window.__sin('+JSON.stringify(key)+').querySelectorAll("input[data-f]")].find(x=>x.dataset.f==='+JSON.stringify(field)+');if(!i)return false;i.focus();i.value='+JSON.stringify(value)+';i.dispatchEvent(new Event("input",{bubbles:true}));return true;})()');
          const stext=sel=>text(w,S+sel);
          const sval=(key,cell)=>w.js('(window.__sq('+JSON.stringify(key)+')?.querySelector(".'+cell+'")||{}).textContent||""');
          // 그 줄을 맨 위로 올려 다섯 크기로 찍는다(작은 창에서도 펼친 안쪽이 보이게)
          const capRow=async(name,key)=>{for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await w.js('window.__sq('+JSON.stringify(key)+').scrollIntoView({block:"start"})');await wait(150);await capture(w,`${name}-${W}`);}w.win.setContentSize(1440,900);await wait(300);};
          const s0=await w.js(`(()=>{const r=document.querySelector('#portal-entry [data-room=settings]');return {shown:!!r&&!r.hidden,mode:document.documentElement.dataset.orbClient,solioHidden:document.querySelector('#portal-entry [data-room=solio]').hidden,say:r.querySelector('[data-aside-text]').textContent,then:r.querySelector('[data-aside-then]').textContent,foot:r.querySelector('[data-aside-foot]').textContent,act:r.querySelector('.read [data-room-act]').textContent,heading:document.querySelector('#portal-entry [data-orb-heading]').textContent,onSay:document.activeElement===r.querySelector('[data-aside-say]'),rows:[...r.querySelectorAll('button.row[data-key]')].map(b=>b.dataset.key)};})()`);
          const c0=await calls(w);
          check('18-12 「설정」 opens the settings room in the face with the update sentence, how it starts, and the version',s0.shown&&s0.mode==='app'&&s0.solioHidden&&s0.onSay&&s0.heading==='설정'&&s0.say==='이 PC의 SYNK는 최신 판입니다.'&&s0.then==='컴퓨터를 켤 때 함께 켜지 않습니다.'&&s0.foot==='SYNK Platform 0.4.97 · 시험판 · Windows'&&s0.act==='문제 알리기용 정보 복사'&&JSON.stringify(s0.rows)==='["update","start","key","view","notice"]'&&['prefs-get','care-status','update-status'].every(c=>c0.includes(c)),s0);
          await captureSizes(w,'settings-room');
          // 업데이트: 지금 확인 → 확인 중 → 최신. 새 판이 나오면 받기와 받는 몫, 다 받으면 쓰던 글 확인 뒤 설치 파일 열기, 실패 문장
          await sopen('update');await wait(300);await sact('update','update-check');await wait(80);
          const u1=await stext('[data-aside-text]');await wait(700);const u2=await stext('[data-aside-text]');
          check('18-12 「지금 확인」 checks and the top sentence follows the update state',(await calls(w)).includes('update-check')&&u1==='새 판이 있는지 보고 있습니다.'&&u2==='이 PC의 SYNK는 최신 판입니다.',{u1,u2});
          await w.js("window.__orbFixture.setUpdate({state:'available',latestVersion:'0.4.98'})");await wait(300);
          const u2b=await stext('[data-aside-text]');
          await sact('update','update-download');await wait(400);
          const u3={say:await stext('[data-aside-text]'),val:await sval('update','val'),when:await sval('update','when'),opened:await w.js("window.__sq('update').classList.contains('opened')"),inner:await w.js("(window.__sin('update').querySelector('.more-say')||{}).textContent")};
          check('18-12 a new version is announced, then downloaded with its share in the line',u2b==='새 판(v0.4.98)이 나왔습니다.'&&(await calls(w)).includes('update-download')&&u3.say==='새 판을 받고 있습니다.'&&u3.val==='35%'&&u3.when==='새 판 0.4.98'&&u3.opened&&/^새 판\(v0\.4\.98\) 설치 파일을 받고 있습니다\./.test(u3.inner),{u2b,...u3});
          await captureSizes(w,'settings-update-downloading');
          await w.js("window.__orbFixture.setUpdate({state:'ready'})");await wait(300);
          const instText=await w.js("(window.__sact('update','update-install')||{}).textContent||''");
          await sact('update','update-install');await wait(700);
          const u4={say:await stext('[data-aside-text]'),dialog:await w.js("!!document.querySelector('#leave-dialog[open]')")};
          check('18-12 a ready installer opens with 「앱 끄고 설치 파일 열기」 once the unsaved-writing check finds nothing',instText==='앱 끄고 설치 파일 열기'&&(await calls(w)).includes('update-install')&&u4.say==='업데이트를 준비하고 있습니다.'&&!u4.dialog,{instText,...u4});
          await w.js("window.__orbFixture.setUpdate({state:'error',code:'UPDATE_NETWORK_FAILED'})");await wait(300);
          const u5={say:await stext('[data-aside-text]'),inner:await w.js("(window.__sin('update').querySelector('.more-say')||{}).textContent"),now:await w.js("window.__sq('update').classList.contains('now')")};
          check('18-12 a failed update says so on top and inside the line',u5.say==='새 판을 받지 못했습니다.'&&/^새 판을 받지 못했습니다\. 인터넷 연결을 확인한 뒤 「지금 확인」을 다시 눌러 주세요\./.test(u5.inner)&&u5.now,u5);
          await captureSizes(w,'settings-update-error');
          await w.js("window.__orbFixture.setUpdate({state:'current',code:null})");await wait(300);
          // 켜고 닫을 때: 트레이로 시작은 자동 시작을 켜야 누를 수 있다. 자동 시작을 켜면 줄이 열린 채 서고, 초점이 그 단추에 남고, 맨 위 둘째 줄이 바뀐다
          await sopen('start');await wait(300);
          const lock0=await w.js("window.__sact('start','pref','startHidden')?.getAttribute('aria-disabled')||null");
          await sact('start','pref','startHidden');await wait(300);
          const early=(await calls(w)).some(c=>c.startsWith('prefs-update:{"startHidden"'));
          await sact('start','pref','launchAtLogin');await wait(700);
          const st1=await w.js("(()=>{const b=window.__sq('start'),s=window.__sact('start','pref','launchAtLogin');return {opened:b.classList.contains('opened'),checked:s?.getAttribute('aria-checked'),focus:document.activeElement===s,then:document.querySelector('#portal-entry [data-room=settings] [data-aside-then]').textContent,mid:b.querySelector('.mid').textContent,lock:window.__sact('start','pref','startHidden')?.getAttribute('aria-disabled')||null};})()");
          const prefs1=await w.js('window.__orbFixture.prefs()');
          check('18-12 트레이로 시작 waits for 자동 시작; switching 자동 시작 on keeps the line open with focus on the switch, and the second top line changes',lock0==='true'&&!early&&st1.opened&&st1.checked==='true'&&st1.focus&&st1.then==='컴퓨터를 켜면 창과 함께 켜집니다.'&&st1.lock===null&&prefs1.launchAtLogin===true,{lock0,early,...st1,prefs1});
          await capRow('settings-start','start');
          // 어디서나 열기: 모양이 틀린 단축키와 다른 앱이 쓰는 단축키는 그 줄에서 거절하고, 맞는 단축키는 적용한다
          await sopen('key');await wait(300);
          await stype('key','shortcut','Shift+S');await sact('key','shortcut-apply');await wait(300);const k1=await slive('key');
          await stype('key','shortcut','ctrl+alt+k');await sact('key','shortcut-apply');await wait(500);const k2=await slive('key');
          await stype('key','shortcut','Ctrl+Alt+S');await sact('key','shortcut-apply');await wait(600);
          const k3={live:await slive('key'),val:await sval('key','val'),mid:await sval('key','mid'),prefs:await w.js('window.__orbFixture.prefs()')};
          check('18-12 a malformed shortcut and one another app holds are refused in the line, and a good one is applied',k1==='단축키 모양을 알아보지 못했습니다. 예: Ctrl+Alt+S'&&k2==='다른 앱이 쓰는 단축키입니다. 다른 조합을 골라 주세요.'&&k3.live==='단축키를 바꿨습니다.'&&k3.val==='Ctrl+Alt+S'&&k3.mid==='어느 화면에서든 이 단축키로 SYNK 창을 앞으로 띄웁니다'&&k3.prefs.globalShortcut==='Ctrl+Alt+S',{k1,k2,...k3});
          // 칸에서 Enter로 저장하다 거절되면 초점이 저장 단추에 남지 않고 칸으로 돌아온다(PC 0.5.0 설계 2절, 화면 -k P2). 칸은 저장한 값으로 되돌려 둔다
          await stype('key','shortcut','Ctrl+Alt+K');await key(w,'Return');await wait(600);
          const kEnter=await w.js("(()=>{const i=[...window.__sin('key').querySelectorAll('input[data-f]')].find(x=>x.dataset.f==='shortcut');return {live:window.__slive('key'),focus:!!i&&document.activeElement===i,caret:i?i.selectionStart===i.value.length:false,prefs:window.__orbFixture.prefs().globalShortcut};})()");
          check('18-12 Enter on a refused shortcut leaves the focus in the field with the caret at the end, and keeps the applied one',kEnter.live==='다른 앱이 쓰는 단축키입니다. 다른 조합을 골라 주세요.'&&kEnter.focus&&kEnter.caret&&kEnter.prefs==='Ctrl+Alt+S',kEnter);
          await stype('key','shortcut','Ctrl+Alt+S');await w.js('document.activeElement?.blur?.()');await wait(200);
          // 화면 크기
          await sopen('view');await wait(300);await sact('view','zoom','1.25');await wait(600);
          const z1={mid:await sval('view','mid'),pressed:await w.js("window.__sact('view','zoom','1.25')?.getAttribute('aria-pressed')"),prefs:await w.js('window.__orbFixture.prefs()')};
          check('18-12 a screen size is chosen and saved',z1.mid==='크기 125%'&&z1.pressed==='true'&&z1.prefs.zoomFactor===1.25,z1);
          // 알림: 배너 끄기와 조용한 시각 저장이 편의 쪽 값(옛 설정 화면이 읽는 자리)과 같다
          await sopen('notice');await wait(300);
          await sact('notice','notice','banners');await wait(300);
          await sact('notice','grp','quiet');await wait(400);
          const q0=await w.js("(()=>{const g=window.__sin('notice').querySelector('[data-grp=quiet]');return {shown:!!g&&!g.hidden,fields:[...g.querySelectorAll('input[data-f]')].map(i=>i.dataset.f+'='+i.value)};})()");
          check('18-12 「시각 고치기」 opens the quiet-hours fields inside the notice line',q0.shown&&JSON.stringify(q0.fields)==='["quietStart=22:00","quietEnd=08:00"]',q0);
          await capRow('settings-notice-quiet','notice');
          await stype('notice','quietStart','23:30');await stype('notice','quietEnd','07:00');
          await w.js("(()=>{const b=[...window.__sin('notice').querySelectorAll('[data-pick][data-f=quietDays] button')].find(x=>x.dataset.pv==='weekdays');b.focus();b.click();return true;})()");await wait(100);
          await sact('notice','quiet-save');await wait(500);
          const n1=await w.js("(()=>{let saved=null;try{saved=JSON.parse(localStorage.getItem('synk-platform-notifications-v1'));}catch{}return {saved,live:window.__slive('notice'),grpHidden:window.__sin('notice').querySelector('[data-grp=quiet]').hidden,focus:document.activeElement===window.__sact('notice','grp','quiet')};})()");
          check('18-12 the banner switch and the quiet hours are saved where the convenience notices read them',n1.saved?.banners===false&&n1.saved?.start==='23:30'&&n1.saved?.end==='07:00'&&n1.saved?.weekdays===true&&n1.live==='저장했습니다. 조용한 시간을 켜면 이 시각에 배너를 띄우지 않습니다.'&&n1.grpHidden&&n1.focus,n1);
          await sact('notice','grp','quiet');await wait(300);
          await stype('notice','quietStart','23:45');
          await w.js("window.__sin('notice').querySelector('[data-f=quietEnd]').focus()");await key(w,'Return');await wait(500);
          const enteredQuiet=await w.js("(()=>{const s=JSON.parse(localStorage.getItem('synk-platform-notifications-v1'));return {start:s.start,end:s.end,closed:window.__sin('notice').querySelector('[data-grp=quiet]').hidden,returned:document.activeElement===window.__sact('notice','grp','quiet')};})()");
          check('18-12 Enter from the unchanged end time saves the new start, closes the editor and returns focus',enteredQuiet.start==='23:45'&&enteredQuiet.end==='07:00'&&enteredQuiet.closed&&enteredQuiet.returned,enteredQuiet);
          await sact('notice','rest','30');await wait(400);
          const r1={live:await slive('notice'),mid:await sval('notice','mid'),muted:await w.js("(JSON.parse(localStorage.getItem('synk-platform-notifications-v1'))||{}).mutedUntil||0")};
          check('18-12 「30분」 rests the banners and says until when',/^\d\d:\d\d까지 배너를 띄우지 않습니다\.$/.test(r1.live)&&r1.mid===r1.live.slice(0,-1)&&r1.muted>Date.now()+25*60e3,r1);
          await sact('notice','rest','0');await wait(400);
          // 구독 팁 켜고 끄기: 옛 판과 같은 settings.tipsOff로 저장한다
          const tg0=await w.js("window.__sact('notice','tips')?.getAttribute('aria-checked')||null");
          await sact('notice','tips');await wait(600);
          const tg1={checked:await w.js("window.__sact('notice','tips')?.getAttribute('aria-checked')||null"),live:await slive('notice'),saved:(await calls(w)).includes('subs-save:{"settings":{"tipsOff":true}}')};
          check('18-6 「구독 팁」 in the notice line saves settings.tipsOff',tg0==='true'&&tg1.checked==='false'&&tg1.saved&&tg1.live==='구독 팁을 껐습니다. 구독 줄과 요금 줄에 팁을 띄우지 않습니다.',{tg0,...tg1});
          // 플레저 PC 알림(회원): 알림 줄 안쪽의 켜고 끄기가 본체 다리로 켠다(PC 0.5.0 설계 4.5 R7). 쓰던 글 되살리기 줄은 없다(4.2-4)
          const noDraft=await w.js("!document.querySelector('#portal-entry [data-room=settings] button.row[data-key=draft]')");
          const care0=await w.js("window.__sact('notice','care')?.getAttribute('aria-checked')||null");
          await sact('notice','care');await wait(700);
          const c1={checked:await w.js("window.__sact('notice','care')?.getAttribute('aria-checked')||null"),live:await slive('notice')};
          check('18-12 a member switches PLEASURE PC notifications on in the notice line, and there is no draft recovery line',noDraft&&care0==='false'&&(await calls(w)).includes('care-configure:{"enabled":true}')&&c1.checked==='true'&&c1.live==='플레저 PC 알림을 켰습니다.',{noDraft,care0,...c1});
          // 문제 알리기용 정보 복사: 버전과 연결 상태만 넘기고, 맨 아래 줄이 그렇게 말한다
          await w.js("(()=>{const b=document.querySelector('#portal-entry [data-room=settings] .read [data-room-act]');b.focus();b.click();return true;})()");await wait(500);
          const g1={foot:await stext('[data-aside-foot]'),diag:await w.js('window.__orbFixture.diag()')};
          const diagText=JSON.stringify(g1.diag||{});
          check('18-12 the problem report copies only versions and connection state, and the bottom line says so',(await calls(w)).includes('diag-copy')&&g1.foot==='버전과 연결 상태만 복사했습니다. 이름, 글, 파일 경로는 넣지 않았습니다.'&&!!g1.diag&&g1.diag.view==='settings'&&!/example\.com|합성 회원|20000000-/.test(diagText),g1);
          // Esc는 펼친 줄을 먼저 접고 방을 닫는다. 구독 팁을 껐으므로 구독 줄에 팁이 없다
          const se0=await w.js("document.querySelectorAll('#portal-entry [data-room=settings] .more.open').length");
          await key(w,'Escape');await wait(300);
          const se1=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=settings]');return {room:!r.hidden,open:r.querySelectorAll('.more.open').length};})()");
          check('18-12 the first Esc only folds the open rows of the settings room',se0>0&&se1.room&&se1.open===0,{se0,se1});
          await key(w,'Escape');await wait(300);
          const e1=await w.js(`(()=>{const b=document.querySelector(${JSON.stringify(SUB)});return {settings:document.querySelector('#portal-entry [data-room=settings]').hidden,solio:!document.querySelector('#portal-entry [data-room=solio]').hidden,tip:!!b?.nextElementSibling?.querySelector('.more-tip'),mode:document.documentElement.dataset.orbClient};})()`);
          check('18-12 Esc closes the settings room back to Solio, and with 구독 팁 off the subscription row has no tip',e1.settings&&e1.solio&&!e1.tip&&e1.mode==='app',e1);
          w.win.destroy();
        }
        // 4. 배정 하나: 로그인 뒤 고르기 화면 없이 솔리오로 간다. 그 공간은 열지 않고 펼침에만 세운다(유호님 11-21)
        const inSolioNoOpen=async w=>{const c=await calls(w),solio=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio]');return !!r&&!r.hidden;})()");return {ok:solio&&!c.some(x=>x.startsWith('open:')),solio,calls:c};};
        const fanSpaces=w=>w.js("[...document.querySelectorAll('.fan-go[data-go]')].map(b=>b.dataset.go)");
        // 4-Workspace. 창 안의 Workspace(4단계 구현 설계 3.2 · 6절): 배정 하나면 솔리오로 가고, 펼침에서 고르면 띠 아래를 뷰가 덮는다
        if(only('4')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/'],unavailable:[]},subs:subsReady},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);const s0=await inSolioNoOpen(w);
          check('4 one assignment lands in Solio and opens nothing: workspace',r.ok&&s0.ok,{...r.state,...s0});
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          const fan=await fanSpaces(w);check('4 the fan lists Solio and the one space: workspace',JSON.stringify(fan)==='["solio","workspace"]',{fan});
          await click(w,'.fan-go[data-go="workspace"]');await until(w,s=>!s.fan);
          for(let i=0;i<120&&!(await w.js("!!document.getElementById('qa-workspace-view')"));i++)await wait(40);await wait(300);
          const look=()=>w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s),here=q('.here').getBoundingClientRect(),cover=document.getElementById('qa-workspace-view'),share=q('.share');return {band:document.documentElement.dataset.orbBand||'',hereTop:Math.round(here.top),hereBottom:Math.round(here.bottom),close:!q('.band-close').hidden,closeText:(q('.band-close')||{}).textContent||'',cover:cover?Math.round(cover.getBoundingClientRect().top):null,pulse:!!document.getElementById('qa-pulse-view'),say:(q('[data-space-say]')||{}).textContent||'',name:(q('[data-here-text]')||{}).textContent||'',share:!!share&&!share.hidden,tiles:[...document.querySelectorAll('#portal-entry .share-tile')].length,focus:document.activeElement?.className||''};})()");
          const p1=await look(),placed=await w.js('window.__orbFixture.workspacePlaced()'),c=await calls(w);
          check('4 Workspace opens once inside the window: the band, the small orb in it, the view under it, 「Workspace 닫기」 and no room line',c.filter(x=>x==='open:/').length===1&&p1.band==='workspace'&&p1.hereTop===6&&p1.hereBottom<=56&&p1.cover===56&&p1.close&&p1.closeText==='Workspace 닫기'&&p1.say===''&&!p1.pulse&&JSON.stringify(placed.at(-1))==='{"visible":true,"top":56}',{p1,placed,calls:c});
          check('4 the Workspace view takes the keyboard focus after arriving',c.includes('workspace-focus'),{calls:c});
          await captureSizes(w,'workspace-band');w.win.setContentSize(390,844);await wait(500);await capture(w,'workspace-band-390');w.win.setContentSize(1440,900);await wait(400);
          // 화면 공유 고르기(6.4): 뷰를 숨기고 방 자리에 화면과 창을 세운다. 고르면 답하고 뷰로 돌아온다
          const thumb=(fill,bars)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${fill}"/>${bars.map(([x,y,wd])=>`<rect x="${x}" y="${y}" width="${wd}" height="10" rx="2" fill="#9a9a9a"/>`).join('')}</svg>`);
          const items=[{name:'화면 1',kind:'screen',thumb:thumb('#2a2a2a',[[24,24,180],[24,52,120],[24,80,220]])},{name:'화면 2',kind:'screen',thumb:thumb('#202020',[[24,24,140],[24,52,200]])},{name:'메모장 — 회의 메모.txt',kind:'window',thumb:thumb('#f2f2f2',[[20,20,240],[20,44,200],[20,68,260]])},{name:'Excel — 3분기 매출',kind:'window',thumb:thumb('#e9efe9',[[20,20,90],[120,20,90],[20,44,90],[120,44,90]])},{name:'이름이 아주 긴 창의 제목은 두 줄까지만 보이고 나머지는 줄여서 보입니다 — 브라우저',kind:'window',thumb:''}];
          await w.js(`window.__orbFixture.shareAsk(${JSON.stringify({id:1,items})})`);await wait(400);
          const p2=await look();
          check('4 a share ask hides the view and shows the picker with screens and windows, focus on the first tile',p2.share&&p2.tiles===5&&!p2.cover&&!p2.close&&/share-tile/.test(p2.focus)&&JSON.stringify((await w.js('window.__orbFixture.workspacePlaced()')).at(-1))==='{"visible":false,"top":56}',p2);
          await captureSizes(w,'workspace-share');w.win.setContentSize(390,844);await wait(500);await capture(w,'workspace-share-390');w.win.setContentSize(1440,900);await wait(400);
          await click(w,'.share-tile[data-orb-arg="2"]');let back=null;for(let i=0;i<60&&back!==56;i++){back=(await look()).cover;if(back!==56)await wait(40);}
          check('4 picking a window answers once with its number and Workspace comes back',back===56&&JSON.stringify(await w.js('window.__orbFixture.shareAnswers()'))==='[{"id":1,"pick":2}]'&&!(await look()).share,{back,answers:await w.js('window.__orbFixture.shareAnswers()')});
          await w.js(`window.__orbFixture.shareAsk(${JSON.stringify({id:2,items})})`);await wait(300);await key(w,'Escape');await wait(400);
          check('4 Esc on the picker answers with no choice and Workspace comes back',JSON.stringify((await w.js('window.__orbFixture.shareAnswers()')).at(-1))==='{"id":2,"pick":null}'&&(await look()).cover===56);
          // 본체가 Workspace 뷰를 닫으면 띠 자리를 지킨 채 「다시 열기」를 보인다
          await w.js('window.__orbFixture.setWorkspaceOpen(false)');await wait(400);
          const p3=await look();check('4 a closed Workspace keeps the band place and offers 「다시 열기」',p3.band==='workspace'&&p3.hereTop===6&&!p3.cover&&!p3.close&&p3.say==='Workspace가 닫혔습니다.',p3);
          await capture(w,'workspace-closed');
          await click(w,'[data-orb-act="reopen-space"]');await wait(900);
          check('4 「다시 열기」 opens Workspace again',(await look()).cover===56,await calls(w));
          await click(w,'.band-close');let solio=null;for(let i=0;i<150&&!solio;i++){if(await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio]');return !!r&&!r.hidden&&!document.documentElement.dataset.orbBand;})()"))solio={ok:true};else await wait(40);}solio=solio||{ok:false};await wait(500);
          check('4 「Workspace 닫기」 closes Workspace and goes to Solio, the band goes',solio.ok&&(await calls(w)).includes('workspace-close')&&!(await look()).cover,await look());
          // 트레이의 Workspace 줄(본체 단축 동작 open-space)은 솔리오에서 Workspace를 연다
          await w.js("window.__orbFixture.desktopAction({type:'open-space',space:'workspace'})");let trayed=null;for(let i=0;i<150&&trayed!==56;i++){trayed=(await look()).cover;if(trayed!==56)await wait(40);}
          check('4 the tray line opens Workspace in the window',trayed===56&&(await look()).band==='workspace',{trayed});
          w.win.destroy();
        }
        // 4-Workspace 없음. 배정에 Workspace가 없는 계정에 트레이 줄이 오면 펼침을 열어 까닭을 말한다(설계 검토 R17)
        if(only('4')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/pulse-app/'],unavailable:[]},subs:subsReady},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(800);
          await w.js("window.__orbFixture.desktopAction({type:'open-space',space:'workspace'})");await until(w,s=>s.fan,{timeout:4000});await wait(600);
          const said=await w.js("(()=>{const e=document.querySelector('#portal-entry [data-fan-error]')||document.querySelector('#portal-entry .fan-error');return e&&!e.hidden?e.textContent:'';})()");
          check('4 a tray open without a Workspace assignment opens the fan and says why',said==='이 계정에는 Workspace 배정이 없습니다.'&&!(await calls(w)).includes('open:/'),{said});
          await capture(w,'workspace-not-assigned');
          w.win.destroy();
        }
        // 4-PULSE. 창 안의 PULSE(3단계 구현 설계 4절): 바깥 창 없이 띠 아래를 뷰가 덮고, 작은 구가 왼쪽 위 띠에 남는다
        if(only('4')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/pulse-app/'],unavailable:[]},subs:subsReady},{restore:signedIn('none')});
          const r0=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);const s0=await inSolioNoOpen(w);
          check('4 a PULSE assignment lands in Solio and does not open PULSE',r0.ok&&s0.ok,{...r0.state,...s0});
          // 펼침에서 PULSE를 고르면 창 안에서 열린다
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          // 펼침이 접힌 뒤 구가 PULSE 자리로 들어가는 동안 기다린다(아래 「다시 고르기」와 같은 기다림)
          await click(w,'.fan-go[data-go="pulse"]');const r=await until(w,s=>!s.fan&&s.mode==='app'&&s.ui==='app',{timeout:12000});
          for(let i=0;i<100&&!(await w.js("!!document.getElementById('qa-pulse-view')"));i++)await wait(40);await wait(300);
          const look=()=>w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s),here=q('.here').getBoundingClientRect(),cover=document.getElementById('qa-pulse-view');return {band:document.documentElement.dataset.orbBand||'',hereTop:Math.round(here.top),hereBottom:Math.round(here.bottom),close:!q('.band-close').hidden,closeRight:Math.round(q('.band-close').getBoundingClientRect().right),cover:cover?Math.round(cover.getBoundingClientRect().top):null,say:(q('[data-space-say]')||{}).textContent||'',name:(q('[data-here-text]')||{}).textContent||''};})()");
          const p1=await look(),placed=await w.js('window.__orbFixture.pulsePlaced()'),c=await calls(w);
          check('4 PULSE opens once inside the window: the band, the small orb in it, the view under it and no room line',r.ok&&c.filter(x=>x==='open:/pulse-app/').length===1&&p1.band==='pulse'&&p1.hereTop===6&&p1.hereBottom<=56&&p1.cover===56&&p1.close&&p1.say===''&&p1.name==='PULSE'&&JSON.stringify(placed.at(-1))==='{"visible":true,"top":56}',{p1,placed,calls:c});
          check('4 the view takes the keyboard focus after arriving',c.includes('pulse-focus'),{calls:c});
          await captureSizes(w,'pulse-band');w.win.setContentSize(390,844);await wait(500);await capture(w,'pulse-band-390');w.win.setContentSize(1440,900);await wait(400);
          // 띠의 작은 구를 누르면 뷰가 숨고 펼침이 선다. 펼침에서 PULSE를 다시 고르면 펼침이 닫히고 뷰가 다시 보인다
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(600);
          const p2=await look();check('4 opening the fan from the band hides the view, the band line and 「PULSE 닫기」, and keeps the orb where it was',!p2.cover&&p2.hereTop===6&&!p2.close&&(await w.js("getComputedStyle(document.getElementById('portal-entry'),'::after').display"))==='none'&&JSON.stringify((await w.js('window.__orbFixture.pulsePlaced()')).at(-1))==='{"visible":false,"top":56}',p2);
          await capture(w,'pulse-fan');
          // 뷰는 구가 띠 자리로 돌아온 뒤에 보인다(펼침이 접히는 0.38초)
          await click(w,'.fan-go[data-go="pulse"]');await until(w,s=>!s.fan);let shown=null;for(let i=0;i<60&&shown!==56;i++){shown=(await look()).cover;if(shown!==56)await wait(40);}
          check('4 choosing PULSE again closes the fan and shows the view once the orb is back in the band',shown===56,{shown});
          // 띠에서 다가가기만으로는 펼침이 열리지 않는다(3단계 구현 설계 4.3)
          await w.js("(()=>{const r=document.querySelector('#portal-entry .here-orb').getBoundingClientRect(),root=document.getElementById('portal-entry');for(let i=0;i<6;i++)root.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerType:'mouse',clientX:r.left+r.width/2,clientY:r.top+r.height/2}));return true;})()");await wait(700);
          check('4 coming near the orb in the band does not open the fan',(await w.js("document.querySelector('#portal-entry .orb-stage').dataset.fan==='1'"))===false);
          // 본체가 PULSE 뷰를 닫으면 띠 자리를 지킨 채 「다시 열기」를 보인다
          await w.js('window.__orbFixture.setPulseOpen(false)');await wait(400);
          const p3=await look();check('4 a closed PULSE keeps the band place and offers 「다시 열기」',p3.band==='pulse'&&p3.hereTop===6&&!p3.cover&&!p3.close&&p3.say==='PULSE가 닫혔습니다.',p3);
          await capture(w,'pulse-closed');
          await click(w,'[data-orb-act="reopen-space"]');await wait(900);
          check('4 「다시 열기」 opens PULSE again',(await look()).cover===56,await calls(w));
          // 「PULSE 닫기」: 본체가 닫으면 솔리오로 간다
          await click(w,'.band-close');let back=null;for(let i=0;i<150&&!back;i++){if(await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio]');return !!r&&!r.hidden&&!document.documentElement.dataset.orbBand;})()"))back={ok:true};else await wait(40);}back=back||{ok:false};await wait(500);
          const p4=await look();check('4 「PULSE 닫기」 closes PULSE and goes to Solio, the band goes',back.ok&&(await calls(w)).includes('pulse-close')&&p4.band===''&&!p4.cover&&p4.hereTop>6,{p4});
          w.win.destroy();
        }
        // 5. 배정 여럿: 로그인 뒤 고르기 화면 없이 솔리오로 간다. 펼침에 두 공간이 서고, 자판 Enter로 PULSE만 연다(유호님 11-21)
        if(only('5')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]},subs:subsReady},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);const s0=await inSolioNoOpen(w);
          check('5 two assignments land in Solio without the chooser',r.ok&&s0.ok,{...r.state,...s0});await captureSizes(w,'entry-solio-two-spaces');
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          const fan=await fanSpaces(w);check('5 the fan lists Solio and both spaces',JSON.stringify(fan)==='["solio","workspace","pulse"]',{fan});
          await w.js("document.querySelector('.fan-go[data-go=\"pulse\"]').focus()");await key(w,'Return');
          const p=await until(w,s=>!s.fan&&s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);const c=await calls(w);
          check('5 Enter in the fan opens PULSE only',p.ok&&c.includes('open:/pulse-app/')&&!c.includes('open:/'),{...p.state,calls:c});
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          await click(w,'.fan-go[data-go="solio"]');const s2=await until(w,s=>s.ui==='app'&&!s.fan);let inSolio=null;for(let i=0;i<100&&!inSolio?.ok;i++){inSolio=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio]'),say=document.querySelector('#portal-entry [data-room=solio] [data-say]');return {ok:!!r&&!r.hidden&&!!say&&say.textContent.trim().length>0,hidden:r?.hidden,say:(say?.textContent||'').trim().slice(0,40),rooms:[...document.querySelectorAll('#portal-entry [data-room]')].filter(x=>!x.hidden).map(x=>x.dataset.room)};})()");if(!inSolio.ok)await wait(60);}check('5 going to Solio from the fan',s2.ok&&inSolio.ok,{...s2.state,...inSolio});
          w.win.destroy();
        }
        // 5-2. 배정이 둘이고 구독이 없는 회원도 곧바로 솔리오의 첫 문장을 본다
        if(only('5-2')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]},subs:subsNone},{restore:signedIn('none')});
          const s=await until(w,st=>st.mode==='app'&&st.ui==='app',{timeout:12000});await wait(600);check('5 two assignments go straight to Solio',s.ok&&(await text(w,'[data-say]'))==='아직 연결한 AI 구독이 없습니다.',s.state);
          await capture(w,'solio-none');
          // 「구독 연결하기」 → 계정 관리 방, 「계정 더하기」 줄을 연 채로(2단계 둘째 조각 설계 9.1)
          await click(w,'[data-orb-act="connect"]');await wait(600);
          const add=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=manage]'),b=r?.querySelector('button.row[data-key=\"add\"]');return {shown:!!r&&!r.hidden,open:!!b&&b.classList.contains('opened')&&b.classList.contains('pin'),say:(r?.querySelector('[data-aside-text]')||{}).textContent||'',mode:document.documentElement.dataset.orbClient};})()");
          check('9 「구독 연결하기」 opens the account management room with 「계정 더하기」 open',add.shown&&add.open&&add.say==='아직 연결한 계정이 없습니다.'&&add.mode==='app',add);await capture(w,'manage-none');
          w.win.destroy();
        }
        // 6. 배정 확인 실패 넷: 회사 공간을 확인하지 못해도 로그인을 붙잡지 않고 솔리오로 간다. 펼침에는 확인된 공간만 선다(유호님 11-21)
        if(only('6'))for(const [status,assignment,want] of [['partial',{status:'partial',destinations:['/'],unavailable:['pulse']},['solio','workspace']],['login_required',{status:'login_required',destinations:[],unavailable:[]},['solio']],['account_mismatch',{status:'account_mismatch',destinations:[],unavailable:[]},['solio']],['unavailable',{status:'unavailable',destinations:[],unavailable:['workspace','pulse']},['solio']]]){
          const w=await open();await boot(w,{assignment,subs:subsNone},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);const s0=await inSolioNoOpen(w);
          check('6 '+status+' still lands in Solio with no chooser or retry screen',r.ok&&s0.ok,{...r.state,...s0});
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          const fan=await fanSpaces(w);check('6 '+status+' lists only confirmed spaces in the fan',JSON.stringify(fan)===JSON.stringify(want),{fan});
          // 펼침이 까닭 한 줄과 「다시 확인」을 둔다. 다시 확인이 배정을 확인하면 공간이 서고 까닭이 사라진다. 회사 공간은 열지 않는다(PC 검수 F1, 유호님 11-21 「다 고쳐야지」)
          // 회사 로그인이 끊긴 회원에게는 다시 로그인하라고 말한다(0.5.4 후보 Fable F1)
          const lead=status==='partial'?'회사 공간 가운데 일부를 확인하지 못했습니다.':status==='account_mismatch'?'회사 공간이 다른 계정으로 로그인되어 있어 확인하지 못했습니다.':status==='login_required'?'회사 공간에서 이 로그인을 확인하지 못했습니다. 로그아웃한 뒤 다시 로그인해 주세요.':'회사 공간 배정을 확인하지 못했습니다.';
          const note=()=>w.js("(()=>{const l=document.querySelector('#portal-entry [data-fan-lead]'),b=document.querySelector('#portal-entry [data-foot=\"recheck-spaces\"]');return {lead:l?.textContent||'',leadShown:!!l&&getComputedStyle(l).display!=='none',role:l?.getAttribute('role')||'',recheck:b?.textContent||'',recheckShown:!!b&&getComputedStyle(b).display!=='none'};})()");
          const n1=await note();check('6 '+status+' shows the reason and 「다시 확인」 in the fan',n1.lead===lead&&n1.leadShown&&n1.role==='status'&&n1.recheck==='다시 확인'&&n1.recheckShown,n1);
          await captureSizes(w,'fan-check-'+status);
          await w.js("window.__orbFixture.setAssignment({status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]})");
          // 자판으로 누른다. 끝나면 「다시 확인」 단추가 빠져도 초점이 펼침 안의 공간 단추에 남는다(fix-all 화면 Fable F2, 0.5.4 후보 카본 B1)
          // 알림 줄 둘(오류 · 까닭)이 다시 짓는 동안 떼어지지 않는지 본다. 떼었다 붙이면 낭독기가 새 글을 놓친다(카본 A1)
          await w.js("(()=>{window.__qaLeadRemoved=false;new MutationObserver(ms=>{for(const m of ms)for(const n of m.removedNodes)if(n.matches?.('[data-fan-lead],[data-fan-error]'))window.__qaLeadRemoved=true;}).observe(document.querySelector('#portal-entry [data-orb-fan]'),{childList:true});})()");
          await w.js("document.querySelector('#portal-entry [data-foot=\"recheck-spaces\"]').focus()");await key(w,'Return');let after=null;for(let i=0;i<60;i++){after=await fanSpaces(w);if(after.length===3)break;await wait(60);}
          await wait(120);
          const n2=await note(),c=await calls(w),fo=await w.js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.activeElement,f=document.querySelector('#portal-entry [data-orb-fan]');r({inFan:!!a&&!!f&&f.contains(a),go:a?.dataset?.go||'',tag:a?.tagName||''});})))");
          check('6 '+status+' 「다시 확인」 confirms both spaces, says so in the status line, drops the button and opens nothing',JSON.stringify(after)==='["solio","workspace","pulse"]'&&n2.lead==='회사 공간 배정을 다시 확인했습니다.'&&n2.leadShown&&!n2.recheckShown&&!c.some(x=>x.startsWith('open:')),{after,...n2,calls:c});
          check('6 '+status+' keyboard focus stays on a space in the fan after 「다시 확인」',fo.inFan&&fo.go==='solio',fo);
          check('6 '+status+' the status and error lines stay in place while the fan is rebuilt',(await w.js('window.__qaLeadRemoved'))===false);
          w.win.destroy();
        }
        // 6-2. 들어가 있는 Workspace가 「다시 확인」으로 배정에서 빠지면, 닫힌 방의 「다시 열기」 대신 까닭과 「솔리오로」가 선다(fix-all 화면 Fable F1)
        if(only('6-2')){
          const w=await open();await boot(w,{assignment:{status:'partial',destinations:['/'],unavailable:['pulse']},subs:subsNone},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          await click(w,'.fan-go[data-go="workspace"]');let band=null;for(let i=0;i<100&&band!=='workspace';i++){band=await w.js('document.documentElement.dataset.orbBand||""');if(band!=='workspace')await wait(60);}
          let arrived=false;for(let i=0;i<150&&!arrived;i++){arrived=await w.js("(()=>{const v=document.getElementById('qa-workspace-view');return !!v&&Math.round(v.getBoundingClientRect().top)===56;})()");if(!arrived)await wait(40);}
          await w.js('window.__orbFixture.setWorkspaceOpen(false)');await wait(400);
          const room=()=>w.js("(()=>{const q=s=>document.querySelector('#portal-entry '+s),b=q('[data-room=space] [data-orb-act]');return {shown:!!q('[data-room=space]')&&!q('[data-room=space]').hidden,say:(q('[data-space-say]')||{}).textContent||'',then:(q('[data-space-then]')||{}).textContent||'',btn:b?.textContent||'',act:b?.dataset.orbAct||'',btnShown:!!b&&!b.hidden};})()");
          const r1=await room();check('6-2 a closed Workspace room offers 「다시 열기」 before the recheck',r1.shown&&r1.say==='Workspace가 닫혔습니다.'&&r1.btn==='다시 열기'&&r1.act==='reopen-space'&&r1.btnShown,r1);
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          await w.js("window.__orbFixture.setAssignment({status:'resolved',destinations:[],unavailable:[]})");
          await w.js("document.querySelector('#portal-entry [data-foot=\"recheck-spaces\"]').focus()");await key(w,'Return');let after=null;for(let i=0;i<60;i++){after=await fanSpaces(w);if(after.length===1)break;await wait(60);}
          await wait(120);
          const fo=await w.js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.activeElement,f=document.querySelector('#portal-entry [data-orb-fan]');r({inFan:!!a&&!!f&&f.contains(a),go:a?.dataset?.go||'',tag:a?.tagName||'',cls:String(a?.className||''),act:a?.dataset?.orbAct||'',lead:(document.querySelector('#portal-entry [data-fan-lead]')||{}).textContent||''});})))");
          check('6-2 the recheck that takes Workspace away leaves only Solio, says so and keeps the focus in the fan',JSON.stringify(after)==='["solio"]'&&fo.inFan&&fo.go==='solio'&&fo.lead==='회사 공간 배정을 다시 확인했습니다.',{after,...fo});
          await captureSizes(w,'fan-withdrawn');
          await key(w,'Escape');await wait(500);
          const r2=await room();check('6-2 the room now says there is no Workspace assignment and offers 「솔리오로」, without moving by itself',r2.shown&&r2.say==='이 계정에는 Workspace 배정이 없습니다.'&&r2.then==='솔리오로 돌아가 이어 가 주세요.'&&r2.btn==='솔리오로'&&r2.act==='room-solio'&&r2.btnShown,r2);
          await captureSizes(w,'room-withdrawn');
          await click(w,'[data-room=space] [data-orb-act="room-solio"]');let solio=false;for(let i=0;i<150&&!solio;i++){solio=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-room=solio]');return !!r&&!r.hidden;})()");if(!solio)await wait(40);}
          const c=await calls(w);check('6-2 「솔리오로」 goes to Solio and opens nothing more',solio&&c.filter(x=>x==='open:/').length===1&&!c.includes('workspace-open'),{solio,calls:c});
          w.win.destroy();
        }
        // 6-3. 조회 중 사람이 펼침 밖으로 옮긴 초점은 끝나도 빼앗지 않는다(pc-fan-followups Fable F2).
        // 마우스로 누른 「다시 확인」이 다 확인되어 초점이 공간 단추로 돌아가도 그 공간을 가리킨 모습이 되지 않는다(Fable F3).
        // 이 확인 창은 초점을 갖지 않아 focusin이 돌지 않으므로, F3의 막이는 이 장면이 아니라 코드로만 확인했다
        if(only('6-3')){
          const w=await open();await boot(w,{assignment:{status:'unavailable',destinations:[],unavailable:['workspace','pulse']},subs:subsNone},{restore:signedIn('none')});
          await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(600);
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);
          await w.js('window.__orbFixture.holdAssignment()');
          await w.js("document.querySelector('#portal-entry [data-foot=\"recheck-spaces\"]').focus()");await key(w,'Return');await wait(300);
          await w.js("document.querySelector('#portal-entry .here-orb').focus()");
          await w.js('window.__orbFixture.releaseAssignment()');await wait(700);
          const f1=await w.js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.activeElement,b=document.querySelector('#portal-entry [data-foot=\"recheck-spaces\"]');r({orb:a?.classList?.contains('here-orb')||false,cls:String(a?.className||''),recheckOn:!!b&&!b.disabled});})))");
          check('6-3 focus moved outside the fan during the lookup stays there afterwards',f1.orb&&f1.recheckOn,f1);
          await w.js("window.__orbFixture.setAssignment({status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]})");
          // 실제 마우스 입력으로 누른다(누르면 단추가 초점을 받는다)
          const pt=await w.js("(()=>{const r=document.querySelector('#portal-entry [data-foot=\"recheck-spaces\"]').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};})()");
          for(const type of ['mouseMove','mouseDown','mouseUp'])w.win.webContents.sendInputEvent({type,x:pt.x,y:pt.y,button:'left',clickCount:1});
          // 목록이 늘며 밀린 자리의 공간이 손 아래에 오지 않게 손을 방 쪽으로 뺀다. 그래야 초점을 돌려놓은 일만 본다
          w.win.webContents.sendInputEvent({type:'mouseMove',x:pt.x+700,y:pt.y+500});
          let after=null;for(let i=0;i<60;i++){after=await fanSpaces(w);if(after.length===3)break;await wait(60);}
          await wait(200);
          const f2=await w.js("(()=>{const a=document.activeElement,f=document.querySelector('#portal-entry [data-orb-fan]');return {inFan:!!a&&!!f&&f.contains(a),go:a?.dataset?.go||'',hot:[...document.querySelectorAll('#portal-entry .fan-go.hot')].map(b=>b.dataset.go)};})()");
          check('6-3 a mouse 「다시 확인」 that confirms both spaces moves the focus into the fan (the no-light guard is held by a source test: this window gets no focusin)',JSON.stringify(after)==='[\"solio\",\"workspace\",\"pulse\"]'&&f2.inFan&&f2.hot.length===0,{after,...f2});
          w.win.destroy();
        }
        // 8. error · enter-error, 다시 시도 뒤 checking에 글이 없다, unconfigured
        if(only('8')){
          const w=await open();await boot(w,{subs:subsNone},{restore:{configured:true,status:'error',signedIn:false,sessionGeneration:2,error:{code:'NETWORK',message:'계정 연결 상태를 확인하지 못했어요.',retryable:true}}});
          const r=await until(w,s=>s.phase==='error'&&s.ui==='ask');const acts=await w.js("[...document.querySelectorAll('[data-ask-actions] button')].map(b=>b.textContent)");
          check('8 error shows retry and a new sign-in',r.ok&&JSON.stringify(acts)==='["다시 시도","새로 로그인"]',{...r.state,acts});await capture(w,'error');
          // 다음 계정 확인을 붙잡아 두고 눌러, 확인 단계에 글이 없는지 실제로 본다(카본 C2)
          await w.js('window.__orbFixture.holdAuth()');
          // 사람처럼 「다시 시도」에 초점을 두고 Enter로 누른다. 두 장 뒤에도 초점이 얼굴 안에 남아야 한다(지금 얼굴의 「다시 시도」 초점 고침과 같은 약속, 11-16 토큰 세션 전달)
          await w.js("document.querySelector('[data-portal-action=\"retry-auth\"]').focus()");await key(w,'Return');
          const ch=(await until(w,s=>s.phase==='checking',{timeout:3000})).state;
          check('8 the retry check shows no text',ch?.phase==='checking'&&ch.ui==='none',ch);
          const fo=await w.js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.activeElement,p=document.getElementById('portal-entry');r({inside:!!a&&a!==document.body&&p.contains(a),tag:a?.tagName||null,cls:String(a?.className||'')});})))");
          check('8 focus stays inside the face two frames after 「다시 시도」',fo.inside,fo);
          await w.js('window.__orbFixture.restore('+JSON.stringify({configured:true,status:'error',signedIn:false,sessionGeneration:3,error:{code:'NETWORK',message:'계정 연결 상태를 확인하지 못했어요.',retryable:true}})+')');
          const back=await until(w,s=>s.phase==='error'&&s.ui==='ask',{timeout:4000});check('8 the held check ends back on the error scene',back.ok,back.state);
          w.win.destroy();
        }
        if(only('8')){
          const w=await open();await boot(w,{subs:subsNone},{restore:{configured:false,status:'signed-out',signedIn:false,sessionGeneration:1,error:{code:'AUTH_NOT_CONFIGURED',message:'로그인 설정을 찾지 못했어요.'}}});
          const r=await until(w,s=>s.phase==='auth'&&s.ui==='ask');
          const vis=await w.js("({signin:getComputedStyle(document.querySelector('.ask-ways')).display,signup:document.querySelector('[data-orb-act=signup]').hidden,code:getComputedStyle(document.querySelector('.invite')).display,unconf:document.querySelector('[data-ask-unconf]').textContent})");
          check('8 unconfigured hides sign-in and sign-up and keeps the code field',r.ok&&vis.signin==='none'&&vis.signup&&vis.code!=='none'&&vis.unconf==='로그인 설정을 찾지 못했습니다. synk.im에서 PC 앱을 다시 받아 설치해 주세요.',{...r.state,...vis});await capture(w,'unconfigured');
          w.win.destroy();
        }
        // 8-2. 솔리오 첫 화면: 6시간 넘은 값을 스스로 다시 읽음
        if(only('8-2')){
          const w=await open();await boot(w,{subs:subsOld},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(400);
          const c=await calls(w);check('8 values older than an hour are read again once on entry',r.ok&&c.filter(x=>x==='subs-check').length===1&&(await text(w,'[data-read]'))==='방금 읽은 값입니다.',{calls:c,read:await text(w,'[data-read]')});
          w.win.destroy();
        }
        // 8-2. 다시 읽기가 실패하면 차례 4의 글, 판 파일이 잠깐 바쁘면 1초 뒤 한 번 다시 읽는다
        if(only('8-2')){
          const w=await open();await load(w);await w.js('window.__orbFixture.setCheckResult('+JSON.stringify({ok:false,code:'READ_FAILED'})+')');
          const subsStale={...subsReady,check:{at:now-7*H}};
          await w.js('window.__orbFixture.configure('+JSON.stringify({subs:subsStale})+')');await w.js('window.__orbFixture.restore('+JSON.stringify(signedIn('none'))+')');
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(500);
          check('8 a failed reread over six hours says it could not read now',r.ok&&(await text(w,'[data-then]'))==='지금은 새로 읽지 못했습니다. 잠시 뒤 「다시 읽기」를 눌러 주세요.',{say:await text(w,'[data-say]'),then:await text(w,'[data-then]')});
          w.win.destroy();
        }
        if(only('8-2')){
          const w=await open();await boot(w,{subs:subsReady,subsFail:1},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
          let snaps=0;for(let i=0;i<40;i++){snaps=(await calls(w)).filter(x=>x==='subs-snapshot').length;if(snaps>=2)break;await wait(100);}await wait(200);
          check('8 a busy board is read again once about a second later',r.ok&&snaps===2&&(await text(w,'[data-say]')).length>0&&!(await text(w,'[data-say]')).includes('읽지 못했습니다'),{snaps,say:await text(w,'[data-say]')});
          w.win.destroy();
        }
        // 8-3. 들어온 회원이 아직 구독을 읽지 못한 채 계정 연결 오류를 겪는다: 손님 문장이 아니라 「계정 연결을 확인하지 못했습니다.」와 「다시 확인」이 뜬다.
        //      Enter로 누르면 확인하는 동안에도 단추와 초점이 남고, 연결이 돌아오면 읽는다(Fable 설계 검토 3차 P2-1, 다시 검수 -d)
        if(only('8-3')){
          const errorAuth={configured:true,status:'error',signedIn:false,sessionGeneration:11,error:{code:'NETWORK',message:'계정 연결 상태를 확인하지 못했어요.',retryable:true}};
          const w=await open();await boot(w,{subs:null},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(400);
          await w.js('window.__orbFixture.setAuth('+JSON.stringify(errorAuth)+')');await wait(500);
          const say=await text(w,'[data-say]'),then=await text(w,'[data-then]');
          const btn=await w.js("(()=>{const b=document.querySelector('[data-orb-act=\"recheck-auth\"]'),st=document.querySelector('[data-solio-status]');return {hidden:!b||b.hidden,label:b?.textContent||'',status:st?.textContent||'',statusRole:st?.getAttribute('role')||''};})()");
          check('8-3 a member waiting on an account error sees the error wait and 「다시 확인」, not the guest sentence',r.ok&&say==='계정 연결을 확인하지 못했습니다.'&&then==='연결되면 구독별 남은 양을 읽습니다.'&&!btn.hidden&&btn.label==='다시 확인'&&btn.statusRole==='status'&&btn.status==='계정 연결을 확인하지 못했습니다. 연결되면 구독별 남은 양을 읽습니다.',{say,then,btn});await capture(w,'solio-auth-wait');
          await w.js('window.__orbFixture.holdAuth()');
          await w.js("document.querySelector('[data-orb-act=\"recheck-auth\"]').focus()");await key(w,'Return');await wait(200);
          const during=await w.js("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const a=document.activeElement,b=document.querySelector('[data-orb-act=\"recheck-auth\"]');r({focusOnButton:a===b,buttonShown:!!b&&!b.hidden,unavailable:b?.getAttribute('aria-disabled')==='true',say:(document.querySelector('[data-say]')?.textContent||'').trim()});})))");
          check('8-3 while checking, 「다시 확인」 stays focused and shown but unavailable',during.focusOnButton&&during.buttonShown&&during.unavailable&&during.say==='계정 연결을 다시 확인하고 있습니다.',during);
          await w.js('window.__orbFixture.configure('+JSON.stringify({subs:subsReady})+')');await w.js('window.__orbFixture.restore('+JSON.stringify(signedIn('none'))+')');
          let back='';for(let i=0;i<60;i++){back=await text(w,'[data-say]');if(back&&!back.startsWith('계정 연결'))break;await wait(100);}
          check('8-3 when the account comes back, Solio reads and shows the subscriptions',!!back&&!back.startsWith('계정 연결')&&!back.startsWith('로그인하면'),{say:back});
          w.win.destroy();
        }
        // 14. 0.4.95 원천 후보 카본 P2: 로고의 낭독 이름, 라이브 영역, 기다리는 동안의 inert, 제목에서 Shift+Tab, 낮은 창의 솔리오 방, 줄 없을 때 단추 자리
        if(only('14')){
          const w=await open();await boot(w,{subs:subsReady},{restore:signedOut});
          const r=await until(w,s=>s.phase==='auth'&&s.ui==='ask');
          const a=await w.js("(()=>{const p=document.getElementById('portal-entry'),box=p.querySelector('[data-ask-status-box]');return {mark:p.querySelector('.mark')?.getAttribute('aria-label')||'',boxRole:box?.getAttribute('role')||'',statusRole:p.querySelector('[data-ask-status]')?.getAttribute('role')||'',errorRole:p.querySelector('#portal-invite-error')?.getAttribute('role')||'',actsInLive:!!p.querySelector('[role=status] [data-ask-actions]'),boxInert:!!box?.inert,waysInert:!!p.querySelector('.ask-ways')?.inert};})()");
          check('14 logo name, live regions, and inert status box while not waiting',r.ok&&a.mark==='싱크'&&a.boxRole===''&&a.statusRole==='status'&&a.errorRole==='alert'&&!a.actsInLive&&a.boxInert&&!a.waysInert,a);
          await w.js("document.querySelector('#portal-entry [data-orb-heading]').focus()");
          w.win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab',modifiers:['shift']});w.win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab',modifiers:['shift']});await wait(150);
          const tr=await w.js("(()=>{const a=document.activeElement,p=document.getElementById('portal-entry');return {inside:!!a&&p.contains(a)&&a!==p.querySelector('[data-orb-heading]'),tag:a?.tagName||null,cls:String(a?.className||'')};})()");
          check('14 Shift+Tab from the heading stays inside the face',tr.inside,tr);
          await click(w,'[data-orb-act="signin"]');const sw=await until(w,s=>!!s.wait,{timeout:3000});
          const b=await w.js("(()=>{const p=document.getElementById('portal-entry');return {boxInert:!!p.querySelector('[data-ask-status-box]').inert,waysInert:!!p.querySelector('.ask-ways').inert,signupInert:!!p.querySelector('.signup').inert,formInert:!!p.querySelector('[data-portal-pane=invite]').inert};})()");
          check('14 while waiting the ask fields are inert and the status box is not',sw.ok&&b.waysInert&&b.signupInert&&b.formInert&&!b.boxInert,b);
          w.win.destroy();
          const w2=await open();await boot(w2,{subs:subsReady},{restore:signedIn('none')});
          const r2=await until(w2,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});w2.win.setContentSize(960,560);await wait(700);
          const g=await w2.js("(()=>{const r=document.querySelector('#portal-entry .room[data-room=solio]').getBoundingClientRect(),h=document.querySelector('#portal-entry .here-orb').getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),hereBottom:Math.round(h.bottom),inner:innerHeight};})()");
          check('14 at 960x560 the Solio room stays below the small orb and inside the window',r2.ok&&g.top>=g.hereBottom-1&&g.bottom<=g.inner+1,g);await capture(w2,'solio-960x560');
          w2.win.destroy();
          const w3=await open();await boot(w3,{subs:subsNone},{restore:signedIn('none')});
          const r3=await until(w3,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});await wait(500);
          const al=await w3.js("(()=>{const s=document.querySelector('#portal-entry [data-room=solio] .say').getBoundingClientRect(),b=document.querySelector('#portal-entry [data-orb-act=connect]').getBoundingClientRect();return {sayLeft:Math.round(s.left),btnLeft:Math.round(b.left),btnShown:b.width>0};})()");
          check('14 with no rows the action button sits under the sentence',r3.ok&&al.btnShown&&Math.abs(al.btnLeft-al.sayLeft)<40,al);await capture(w3,'solio-none-button');
          w3.win.destroy();
        }
        // 13. 다시 켬, 로그인 복원이 3초 늦음: 그동안 구가 스스로 커지거나 묻는 화면이 비치지 않는다
        if(only('13')){
          const part='orb-qa-slow-'+Date.now();
          let w=await open({partition:part});await load(w);await w.js("localStorage.setItem('synk.orb.returning','1');true");w.win.destroy();
          w=await open({partition:part});const t0=Date.now();await load(w);await w.js('window.__orbFixture.configure('+JSON.stringify({subs:subsReady})+')');
          setTimeout(()=>{w.js('window.__orbFixture.restore('+JSON.stringify(signedIn('none',2))+')').catch(()=>{});},3000);
          const seen=[];let arrived=null;const tEnd=Date.now()+12000;
          while(Date.now()<tEnd){const s=await w.js("(()=>{const st=document.querySelector('.orb-stage');const ask=document.querySelector('[data-layer=ask]');return {phase:document.getElementById('portal-entry')?.dataset.portalState,ui:st?.dataset.ui,askVisible:ask?getComputedStyle(ask).visibility!=='hidden':false,mode:document.documentElement.dataset.orbClient};})()");seen.push(s);if(s.mode==='app'&&s.ui==='app'){arrived=Date.now()-t0;break;}await wait(50);}
          check('13 a three-second restore never zooms the orb or shows the ask scene',arrived!==null&&!seen.some(s=>s.askVisible||s.phase==='auth'||s.phase==='zooming'),{arrivedMs:arrived,phases:[...new Set(seen.map(s=>s.phase))]});
          w.win.destroy();
        }
        // 12. 검사 실행 길: 값이 참일 때만 들어간다
        if(only('12')){
          const w=await open();await boot(w,{env:{qaGuestEntry:true},subs:null},{restore:signedOut});await until(w,s=>s.phase==='auth'&&s.ui==='ask');
          await w.js("document.getElementById('portal-entry').dispatchEvent(new CustomEvent('synk:qa-guest-entry'))");
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});
          check('12 QA guest path reaches Solio with the guest line',r.ok&&(await text(w,'[data-say]'))==='로그인하면 구독별 남은 양이 여기에 보입니다.',{...r.state,say:await text(w,'[data-say]')});await capture(w,'qa-guest');
          await click(w,'.here-orb');await until(w,s=>s.fan);check('12 the guest fan has only 「설정」',JSON.stringify(await w.js("[...document.querySelectorAll('.fan-foot button')].map(b=>b.textContent)"))==='["설정"]');await key(w,'Escape');await until(w,s=>!s.fan);await captureSizes(w,'guest-room');
          // 손님도 설정 방에 온다. 회원에게만 있는 칸(구독 팁, 플레저 PC 알림)은 없고, 쓰던 글 되살리기 줄은 누구에게도 없다(PC 0.5.0 설계 4.2-4)
          await click(w,'.here-orb');await until(w,s=>s.fan);await wait(500);await w.js("document.querySelector('.fan [data-foot=settings]').focus()");await click(w,'.fan [data-foot="settings"]');await wait(800);
          const gq="(k=>[...document.querySelectorAll('#portal-entry [data-room=settings] button.row[data-key]')].find(b=>b.dataset.key===k))";
          const gs=await w.js(`(()=>{const r=document.querySelector('#portal-entry [data-room=settings]'),q=${gq};const more=q('notice')?.nextElementSibling;return {shown:!!r&&!r.hidden,rows:[...r.querySelectorAll('button.row[data-key]')].map(b=>b.dataset.key),tips:!!more?.querySelector('[data-room-act=tips]'),care:!!more?.querySelector('[data-room-act=care]')};})()`);
          check('12 a guest opens the settings room without the tip and PLEASURE switches, and with no draft line',gs.shown&&JSON.stringify(gs.rows)==='["update","start","key","view","notice"]'&&!gs.tips&&!gs.care,gs);
          await w.js(`(()=>{const b=${gq}('notice');b.click();return true;})()`);await wait(400);
          check('12 a guest sends no PLEASURE notification change',!(await calls(w)).some(c=>c.startsWith('care-configure')));
          for(const [W,Hh] of sizes){w.win.setContentSize(W,Hh);await wait(380);await w.js(`${gq}('notice').scrollIntoView({block:'start'})`);await wait(150);await capture(w,`guest-settings-${W}`);}
          w.win.setContentSize(1440,900);await wait(300);
          w.win.destroy();
        }
        // 11. 움직임 줄이기
        if(only('11')){
          // 런처는 개인 설정으로 data-motion을 덮어쓰므로, 운영체제의 움직임 줄이기 설정을 흉내 내고 켠다
          // 아무 쪽도 열지 않은 창에는 디버거 명령의 답이 오지 않으므로 빈 쪽을 먼저 연다. 흉내 낸 설정은 같은 창의 다음 쪽에도 남는다
          const w=await open();await w.win.loadURL('about:blank');w.win.webContents.debugger.attach('1.3');
          await Promise.race([w.win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]}),wait(5000).then(()=>{throw new Error('EMULATED_MEDIA_TIMEOUT');})]);
          const t0=Date.now();await load(w);
          check('11 the reduced-motion setting reaches the page',await w.js("matchMedia('(prefers-reduced-motion: reduce)').matches"));
          await w.js('window.__orbFixture.configure('+JSON.stringify({subs:subsReady})+')');await w.js('window.__orbFixture.restore('+JSON.stringify(signedOut)+')');
          const r=await until(w,s=>s.phase==='auth'&&s.ui==='ask');timings.reducedToAsk=Date.now()-t0;check('11 reduced motion reaches the ask scene quickly',r.ok&&timings.reducedToAsk<3500,{ms:timings.reducedToAsk});
          w.win.destroy();
        }
      }
    }catch(error){check('run',false,{error:String(error?.stack||error).slice(0,1200)});}
    check('console errors',consoleErrors.length===0,{consoleErrors});
    check('blocked requests',blockedRequests.length===0,{blockedRequests});
    process.stdout.write('SYNK_ORB_QA '+JSON.stringify({ok:checks.every(c=>c.ok),mode,checks,consoleErrors,blockedRequests,timings,loadFailures,only:ONLY})+'\n');
    app.exit(0);
  });
}
