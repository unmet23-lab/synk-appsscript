'use strict';
// 검정 구 얼굴(PC 클라이언트 1단계)의 실제 Chromium 흐름 시험. 1단계_구현설계.md 15절의 흐름 1~15를 사람처럼 누른다.
// 숨은 Electron 창에 실제 synk-desktop://platform/index.html을 띄우고 합성 다리(orb-face-fixture.cjs)로 인증 · 배정 · 초대 · 구독 자료를 준다.
// 바깥 요청은 모두 막고, 콘솔 오류와 막힌 요청이 0인지 본다. 결과 JSON과 캡처는 git 밖 폴더에 쓴다.
// 돌지 않는 것: 11번의 「창이 숨은 채 켬」(숨은 시험 창도 document.hidden이 거짓이라 흉내 낼 수 없다), 8번의 진입 오류 화면
// (실제 호스트는 배정 조회 실패와 예외를 공간 고르기의 까닭으로 바꾸고, 진입 오류는 계정이 바뀌는 경합에서만 생긴다). 둘 다 컨트롤러 시험(orb-face.test.mjs)이 본다.
//   node desktop/tools/orb-face-browser-qa.cjs <결과 폴더>
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const PREFIX='synk-orb-face-qa-';
if(!process.versions.electron){
  const {spawnSync}=require('node:child_process');
  const out=path.resolve(process.argv[2]||path.join(root,'..','.tmp','pc-client-orb-step1-20261116','qa'));
  fs.mkdirSync(out,{recursive:true});
  const runs=[];
  for(const mode of ['main','nowebgl','nocanvas']){
    const profile=fs.mkdtempSync(path.join(os.tmpdir(),PREFIX));
    try{
      const run=spawnSync(require('electron'),[__filename,'--profile='+profile,'--out='+out,'--mode='+mode],{cwd:root,encoding:'utf8',windowsHide:true,timeout:600000});
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
    async function boot(w,config,{restore=null,restoreAfter=0}={}){
      const t0=Date.now();
      await load(w);
      await w.js('window.__orbFixture.configure('+JSON.stringify(config||{})+')');
      if(restore){if(restoreAfter)setTimeout(()=>{w.js('window.__orbFixture.restore('+JSON.stringify(restore)+')').catch(()=>{});},restoreAfter);else await w.js('window.__orbFixture.restore('+JSON.stringify(restore)+')');}
      return t0;
    }
    const state=w=>w.js(`(()=>{const r=document.getElementById('portal-entry'),s=r?.querySelector('.orb-stage');return {phase:r?.dataset.portalState,ui:s?.dataset.ui,mode:document.documentElement.dataset.orbClient,wait:s?.dataset.wait||null,active:r?.dataset.portalActive,hidden:document.hidden,ready:document.documentElement.dataset.ready,eyes:s?.dataset.eyes||null};})()`);
    async function until(w,fn,{timeout=9000,every=40}={}){const t=Date.now();let last;while(Date.now()-t<timeout){last=await state(w);if(fn(last))return {ok:true,ms:Date.now()-t,state:last};await wait(every);}return {ok:false,ms:Date.now()-t,state:last};}
    // 끝 모습으로 찍는다: 첫 화면(구가 드러나는 중) 말고는 글의 나타남 효과를 끄고, 숨은 창이 새 장면을 그리도록 다시 그리기를 요청한 뒤 두 번 찍는다
    async function capture(w,name,{moving=false}={}){
      await w.js('document.fonts.ready');
      if(!moving)await w.js("(()=>{if(!document.getElementById('orb-qa-still')){const st=document.createElement('style');st.id='orb-qa-still';st.textContent='#portal-entry,#portal-entry *{transition:none!important;animation:none!important}';document.head.append(st);}return true;})()");
      await wait(moving?120:420);
      w.win.webContents.invalidate();await w.win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await wait(200);w.win.webContents.invalidate();
      const image=await w.win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});
      const file=path.join(out,`${String(++shot).padStart(2,'0')}-${mode}-${name}.png`);fs.writeFileSync(file,image.toPNG());
      const metrics=await w.js(`(()=>{const W=innerWidth,Hh=innerHeight,outside=[];for(const el of document.querySelectorAll('#portal-entry *')){const st=getComputedStyle(el);if(st.visibility==='hidden'||st.display==='none'||el.closest('[inert]')||!el.textContent.trim()||el.children.length)continue;const b=el.getBoundingClientRect();if(!b.width||!b.height)continue;if(Number(st.opacity)===0)continue;let hiddenBy=null,pos=st.position;for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const as=getComputedStyle(a);if(Number(as.opacity)===0){hiddenBy=a;break;}if(pos==='fixed')continue;if(pos!=='absolute'||as.position!=='static'){const r=a.getBoundingClientRect();if(as.overflowY!=='visible'&&(b.bottom<=r.top+1||b.top>=r.bottom-1)){hiddenBy=a;break;}if(as.overflowX!=='visible'&&(b.right<=r.left+1||b.left>=r.right-1)){hiddenBy=a;break;}}if(!(pos==='absolute'&&as.position==='static'))pos=as.position;}if(hiddenBy)continue;if(b.right>W+1||b.left<-1||b.bottom>Hh+1||b.top<-1)outside.push((el.className||el.tagName)+':'+el.textContent.trim().slice(0,30));}return {pageOverflow:Math.max(0,document.documentElement.scrollWidth-W),outside};})()`);
      check('capture '+name,metrics.pageOverflow===0&&metrics.outside.length===0,{file:path.basename(file),...metrics});
      return file;
    }
    const click=(w,sel)=>w.js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;el.click();return true;})()`);
    // 실제 자판처럼 글자 사건(char)도 보낸다. 단추는 Enter의 글자 사건에서 눌린다
    const CHAR={Return:'\r',Space:' '};
    const key=async(w,keyCode)=>{w.win.webContents.sendInputEvent({type:'keyDown',keyCode});if(CHAR[keyCode])w.win.webContents.sendInputEvent({type:'char',keyCode:CHAR[keyCode]});w.win.webContents.sendInputEvent({type:'keyUp',keyCode});await wait(60);};
    const calls=w=>w.js('window.__orbFixture.calls()');
    const text=(w,sel)=>w.js(`(document.querySelector(${JSON.stringify(sel)})?.textContent||'').trim()`);
    const sizes=[[1440,900],[390,800],[960,680]];
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
          check('2 Solio sentence from the synthetic subscriptions',/^Codex가 (?:\d+분 뒤|오늘|내일|모레|[일월화수목금토]요일) ?(?:새벽|오전|오후|저녁|밤)?에 바닥납니다.$/.test(await text(w,'[data-say]')),{say:await text(w,'[data-say]'),then:await text(w,'[data-then]')});
          check('9-tray only runnable apps are sent to the tray',JSON.stringify(await w.js('window.__orbFixture.tray()'))==='[]',{tray:await w.js('window.__orbFixture.tray()')});
          check('9-toast no signed-in toast over the face',await w.js("document.getElementById('toast').hidden||!document.getElementById('toast').textContent.includes('로그인했어요')"));
          await captureSizes(w,'solio-ready');
          // 15. 화면 확대
          for(const z of [1.25,1.5]){w.win.webContents.setZoomFactor(z);await wait(500);await capture(w,'solio-zoom-'+Math.round(z*100));}
          w.win.webContents.setZoomFactor(1);await wait(300);
          // Ctrl과 더하기는 막히지 않는다(들어온 뒤 shouldBlockShortcuts는 거짓)
          check('15 zoom keys are not blocked after entry',await w.js("(()=>{const e=new KeyboardEvent('keydown',{key:'=',ctrlKey:true,bubbles:true,cancelable:true});window.dispatchEvent(e);return !e.defaultPrevented;})()"));
          // 9. 들어온 뒤: 작은 구 → 공간 고르기 → Esc · 빈 곳 · 돌아가기
          await click(w,'.here-orb');const sw=await until(w,s=>s.ui==='switch');check('9 the small orb opens the space switch',sw.ok,sw.state);await capture(w,'switch');
          await key(w,'Escape');const c1=await until(w,s=>s.ui==='app');check('9 Esc closes the switch',c1.ok,c1.state);
          await click(w,'.here-name');await until(w,s=>s.ui==='switch');
          await w.js("(()=>{const l=document.querySelector('[data-layer=switch]');const e=new MouseEvent('click',{bubbles:true,clientX:20,clientY:innerHeight-20});l.dispatchEvent(e);})()");
          const c3=await until(w,s=>s.ui==='app');check('9 an empty click closes the switch',c3.ok,c3.state);
          await click(w,'.here-orb');await until(w,s=>s.ui==='switch');await click(w,'[data-orb-act="close-switch"]');const c4=await until(w,s=>s.ui==='app');check('9 「돌아가기」 closes the switch',c4.ok,c4.state);
          // 구독 줄 → 옛 AI 구독 관리(위 탭 줄 숨음) → 돌아가기
          await click(w,'button.row[data-svc]');const lg=await until(w,s=>s.mode==='legacy'&&s.ui==='app');
          const legacy=await w.js("(()=>{const r=document.getElementById('portal-entry').getBoundingClientRect(),t=document.getElementById('solio-tabs'),title=document.querySelector('.launcher > .titlebar');return {band:Math.round(r.height),tabsHidden:(!t||getComputedStyle(t).display==='none')&&[...document.querySelectorAll('#solio-subscriptions .ms-back[data-view=solio]')].every(b=>getComputedStyle(b).display==='none'),titleHidden:!title||getComputedStyle(title).display==='none',launcherInert:document.querySelector('.launcher').inert};})()");
          check('9 a row opens the old subscriptions board under a 56px band',lg.ok&&legacy.band===56&&legacy.tabsHidden&&legacy.titleHidden&&!legacy.launcherInert,legacy);await captureWide(w,'legacy-subscriptions');
          // 계정 관리 → 「한눈에 보기로」가 보이고 눌린다. 띠로 나갔다 다시 열면 한눈에 보기부터 뜬다(Fable 최종)
          await click(w,'#solio-subscriptions [data-subs="manage"]');
          const glanceBack=await w.js("(async()=>{for(let i=0;i<40;i++){const b=document.querySelector('#solio-subscriptions .ms-back[data-subs=glance]');if(b&&getComputedStyle(b).display!=='none'&&b.getBoundingClientRect().width>0)return true;await new Promise(r=>setTimeout(r,50));}return false;})()");
          check('9 the account management view keeps its way back to the glance',glanceBack);
          await click(w,'[data-orb-act="legacy-back"]');const lb=await until(w,s=>s.mode==='app'&&s.ui==='app');check('9 「돌아가기」 returns to Solio',lb.ok,lb.state);
          await click(w,'button.row[data-svc]');await until(w,s=>s.mode==='legacy'&&s.ui==='app');
          const reopened=await w.js("(async()=>{for(let i=0;i<40;i++){if(document.querySelector('#solio-subscriptions .ms-back[data-view=solio]')&&!document.querySelector('#solio-subscriptions .ms-back[data-subs=glance]'))return true;await new Promise(r=>setTimeout(r,50));}return false;})()");
          check('9 reopening the board starts at the glance view',reopened);
          await click(w,'[data-orb-act="legacy-back"]');await until(w,s=>s.mode==='app'&&s.ui==='app');
          await click(w,'.here-orb');await until(w,s=>s.ui==='switch');await click(w,'[data-foot="settings"]');await until(w,s=>s.mode==='legacy'&&s.ui==='app');
          const hiddenRows=await w.js("['#personal-settings-open','#density','#view-settings [data-view=benefits]','#reset-preferences'].map(s=>{const e=document.querySelector(s);const r=e?.closest('.setting-row');return !r||getComputedStyle(r).display==='none';})");
          check('9 settings hides the four library and pleasure rows',hiddenRows.every(Boolean),{hiddenRows});await captureWide(w,'legacy-settings');
          await key(w,'Escape');const lb2=await until(w,s=>s.mode==='app');check('9 Esc leaves the old settings',lb2.ok,lb2.state);
          await click(w,'.here-orb');await until(w,s=>s.ui==='switch');await click(w,'[data-foot="account"]');const la=await until(w,s=>s.mode==='legacy'&&s.ui==='app');check('9 「계정」 opens the account view',la.ok,la.state);await capture(w,'legacy-account');
          // 옛 화면에서는 어떤 단추를 눌러도 옛 홈 · 라이브러리 · 혜택 · 맞춤 정보로 가지 않는다(Fable 최종)
          const leak=await w.js("(async()=>{const tries=['[data-account-action=insight]','[data-account-action=workspace]','[data-view=home]','[data-view=library]','[data-view=benefits]'];const seen=[];for(const sel of tries){const b=document.querySelector(sel);if(b){b.click();await new Promise(r=>setTimeout(r,120));seen.push([sel,document.documentElement.dataset.view]);}}return {seen,hidden:getComputedStyle(document.querySelector('#view-account .setting-row:has([data-account-action=insight])')||document.body).display};})()");
          check('9 the old screens cannot leak to home, library, benefits or insight',leak.seen.every(([,v])=>['solio','settings','account'].includes(v)),leak);
          await click(w,'[data-orb-act="legacy-back"]');await until(w,s=>s.mode==='app'&&s.ui==='app');
          // 14. 들어온 뒤 30초 동안 옛 모습의 대화상자 · 메뉴가 뜨지 않는다
          let stray=null;for(let i=0;i<60;i++){const s=await w.js("(()=>{const open=[...document.querySelectorAll('dialog[open]')].map(d=>d.id);const root=document.documentElement.dataset.orbClient;return {open,root};})()");if(s.open.length||s.root!=='app'){stray=s;break;}await wait(500);}
          check('14 nothing old opens over the face for 30 seconds',!stray,{stray});
          // 10. 로그아웃 → 묻는 화면
          await click(w,'.here-orb');await until(w,s=>s.ui==='switch');await click(w,'[data-foot="logout"]');
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
          const here=await rect('#portal-entry .here-name');await move(here.x,here.y);await wait(900);
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
          // 키보드: 초점이 오브제에 오면 그 프로그램이 열린다
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(400);
          await w.js("document.querySelector('#portal-entry [data-orb-prog=subs]').focus()");await key(w,'Tab');await w.js("document.activeElement.dispatchEvent(new FocusEvent('focusin',{bubbles:true}))");await wait(300);
          const kb=await w.js("({active:document.activeElement?.dataset?.orbProg||null,prog:document.querySelector('#portal-entry .orb-stage').dataset.prog})");
          check('16 keyboard focus on an object opens its program',kb.active==='visits'&&kb.prog==='visits',kb);
          await click(w,'#portal-entry [data-orb-prog="subs"]');await wait(400);
          check('16 a click on 구독 brings the subscriptions back',(await w.js("document.querySelector('#portal-entry .orb-stage').dataset.prog"))==='subs'&&!(await w.js("document.querySelector('#portal-entry [data-room=solio]').hidden")));
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
        // 4. 배정 하나(Workspace, PULSE 각각)
        if(only('4'))for(const [dest,name,say] of [['/','workspace','Workspace를 열었습니다.'],['/pulse-app/','pulse','PULSE를 열었습니다.']]){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:[dest],unavailable:[]},subs:subsReady},{restore:signedIn('none')});
          const r=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});const c=await calls(w);
          check('4 one assignment opens once: '+name,r.ok&&c.filter(x=>x==='open:'+dest).length===1&&(await text(w,'[data-space-say]'))===say,{...r.state,calls:c});
          await capture(w,'room-'+name);
          await click(w,'[data-orb-act="reopen-space"]');await wait(600);check('4 「다시 열기」 opens again: '+name,(await calls(w)).filter(x=>x==='open:'+dest).length===2);
          w.win.destroy();
        }
        // 5. 배정 여럿: 공간 고르기 → 화살표와 Enter로 PULSE
        if(only('5')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]},subs:subsReady},{restore:signedIn('none')});
          const r=await until(w,s=>s.phase==='workspace'&&s.ui==='switch',{timeout:12000});check('5 two assignments show the chooser',r.ok,r.state);await captureSizes(w,'entry-chooser');
          await w.js("document.querySelector('.sw[data-go]').focus()");await key(w,'Right');await key(w,'Return');
          const p=await until(w,s=>s.mode==='app'&&s.ui==='app',{timeout:12000});const c=await calls(w);
          check('5 arrow and Enter open PULSE only',p.ok&&c.includes('open:/pulse-app/')&&!c.includes('open:/'),{...p.state,calls:c});
          await click(w,'.here-orb');await until(w,s=>s.ui==='switch');
          check('5 the switch lists Solio and both spaces',JSON.stringify(await w.js("[...document.querySelectorAll('.sw[data-go]')].map(b=>b.dataset.go)"))==='["solio","workspace","pulse"]');
          await click(w,'.sw[data-go="solio"]');const s2=await until(w,s=>s.ui==='app');check('5 going to Solio from the switch',s2.ok&&(await text(w,'[data-say]')).length>0,s2.state);
          w.win.destroy();
        }
        // 5-2. 「솔리오로」(Esc)
        if(only('5-2')){
          const w=await open();await boot(w,{assignment:{status:'resolved',destinations:['/','/pulse-app/'],unavailable:[]},subs:subsNone},{restore:signedIn('none')});
          await until(w,s=>s.phase==='workspace'&&s.ui==='switch',{timeout:12000});await key(w,'Escape');
          const s=await until(w,st=>st.mode==='app'&&st.ui==='app',{timeout:12000});check('5 Esc on the chooser goes to Solio',s.ok&&(await text(w,'[data-say]'))==='아직 연결한 AI 구독이 없습니다.',s.state);
          await capture(w,'solio-none');
          // 「구독 연결하기」 → 옛 AI 구독 관리의 계정 관리 쪽(설계 9절)
          await click(w,'[data-orb-act="connect"]');const cm=await until(w,st=>st.mode==='legacy',{timeout:6000});
          const manage=await w.js("(async()=>{for(let i=0;i<40;i++){const b=document.querySelector('#solio-subscriptions .ms-back[data-subs=glance]');if(b&&b.getBoundingClientRect().width>0)return true;await new Promise(r=>setTimeout(r,60));}return false;})()");
          check('9 「구독 연결하기」 opens the old board on account management',cm.ok&&manage,cm.state);
          w.win.destroy();
        }
        // 6. 배정 확인 실패 넷
        if(only('6'))for(const [status,assignment] of [['partial',{status:'partial',destinations:['/'],unavailable:['pulse']}],['login_required',{status:'login_required',destinations:[],unavailable:[]}],['account_mismatch',{status:'account_mismatch',destinations:[],unavailable:[]}],['unavailable',{status:'unavailable',destinations:[],unavailable:['workspace','pulse']}]]){
          const w=await open();await boot(w,{assignment,subs:subsNone},{restore:signedIn('none')});
          const r=await until(w,s=>s.phase==='workspace'&&s.ui==='switch',{timeout:12000});
          const lead=await text(w,'[data-sw-lead]'),acts=await w.js("[...document.querySelectorAll('.sw-foot button')].map(b=>b.textContent)");
          check('6 '+status+' shows a reason and 「다시 확인」',r.ok&&lead.length>0&&acts.includes('다시 확인'),{lead,acts,...r.state});
          if(status==='login_required'){
            await capture(w,'entry-login-required');
            const before=(await calls(w)).filter(x=>x==='resolve').length;
            await w.js("[...document.querySelectorAll('.sw-foot button')].find(b=>b.textContent==='다시 확인')?.click()");await wait(600);
            const after=(await calls(w)).filter(x=>x==='resolve').length;check('6 「다시 확인」 looks the assignment up again',after===before+1,{before,after});
          }
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
          await click(w,'.here-orb');await until(w,s=>s.ui==='switch');check('12 the guest switch has only 「설정」',JSON.stringify(await w.js("[...document.querySelectorAll('.sw-foot button')].map(b=>b.textContent)"))==='["설정"]');
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
