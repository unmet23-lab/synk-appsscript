'use strict';
// SYNK SOLIO 판(2026-11-13) 화면 점검: 숨은 Electron 런처를 1440 · 390 · 320 폭으로 열어 위 메뉴 「솔리오」(홈 · 백업·복구 · AI 구독 관리),
// 오른쪽 프로필 메뉴(내 계정 · 회원 혜택 · 로그아웃), 회원 혜택(플레저 · 홈에 고정), 내 계정 「맞춤 정보」 → 내 성향, 내 홈 선반을 찍고 잰다.
// 계정 · 구독 · 성향은 모두 합성이다(member-insight-fixture의 합성 저장소를 쓰는 미리 올림 파일을 임시 프로필 안에 만든다). 바깥 요청은 막는다.
// 사용: node desktop/tools/solio-native-smoke.cjs  (출력 SYNK_SOLIO_OUT, 기본 .tmp/solio-20261113/pc-shots)
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=process.env.SYNK_SOLIO_OUT||path.resolve(root,'../.tmp/solio-20261113/pc-shots'),prefix='SYNK_SOLIO_QA ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-solio-'));
  try{
    // 미리 올림: 합성 성향 · 서재 저장소(member-insight-fixture 앞부분) + 이 점검의 다리(계정 화면 · 구독 판 · 플레저 미리보기).
    const base=fs.readFileSync(path.join(__dirname,'member-insight-fixture.cjs'),'utf8'),cut=base.indexOf("if(typeof module!=='undefined')");
    if(cut<0)throw Error('member-insight-fixture layout changed');
    fs.writeFileSync(path.join(profile,'solio-preload.cjs'),base.slice(0,cut)+rendererBridge());
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile,'--out='+out],{cwd:root,windowsHide:true,encoding:'utf8',timeout:180000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1500)};
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'solio-native.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests,out},null,2)+'\n');if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-solio-'))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10),target=process.argv.find(value=>value.startsWith('--out='))?.slice(6);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-solio-')||!target||!path.isAbsolute(target))require('./electron-child-guard.cjs').refuse(__filename,'Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[],shots=[];
    const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('solio-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
      window=new BrowserWindow({width:1440,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(profile,'solio-preload.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      window.webContents.on('preload-error',(_event,_preload,error)=>errors.push('preload: '+error.message));
      const run=script=>window.webContents.executeJavaScript(script),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const settle=async()=>{await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");window.webContents.invalidate();await pause(160);};
      const capture=async name=>{await settle();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await pause(130);const file=path.join(target,name+'.png');fs.mkdirSync(target,{recursive:true});
        // 화면 전체(스크롤 포함)를 찍도록 #main 높이만큼 창을 잠깐 늘린다.
        const [width,height]=window.getContentSize(),full=Math.min(6000,Math.max(height,await run("Math.ceil(document.getElementById('main').scrollHeight+(document.getElementById('titlebar')?.offsetHeight||0))")));
        window.setContentSize(width,full);await settle();fs.writeFileSync(file,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());window.setContentSize(width,height);await settle();shots.push(path.basename(file));return path.basename(file);};
      const inspect=()=>run(`(()=>{const m=document.getElementById('main'),visible=id=>!document.getElementById(id).hidden;return {view:document.documentElement.dataset.view,pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,m.scrollWidth-m.clientWidth),
        imagesLoaded:[...document.querySelectorAll('#main img')].filter(i=>i.getAttribute('src')&&i.offsetParent).every(i=>i.complete&&i.naturalWidth>0),focus:document.activeElement?.id||'',
        solio:visible('view-solio'),benefits:visible('view-benefits'),insight:visible('view-insight'),account:visible('view-account'),profileMenu:visible('profile-menu'),
        tabs:[...document.querySelectorAll('#solio-tabs [data-solio-section]')].map(n=>n.dataset.solioSection+(n.getAttribute('aria-current')==='page'?'*':'')).join(','),
        navLabels:[...document.querySelectorAll('.nav-links [data-view]')].map(n=>n.dataset.view).join(','),
        shelf:[...document.querySelectorAll('#view-home .shelf [data-member-solio],#view-home .shelf [data-member-app]')].map(n=>'memberSolio' in n.dataset?'solio':n.dataset.memberApp).join(','),
        title:(document.querySelector('#view-'+document.documentElement.dataset.view+' h1')?.textContent||'').trim()};})()`);
      const go=async script=>{await run(script);await settle();return inspect();};
      const member=(id,appIds,generation=1)=>`window.__synkFixture.switchAccount({configured:true,status:'signed-in',signedIn:true,sessionGeneration:${generation},account:{synk_user_id:'synthetic-insight-${id}',display_name:'합성 ${id}'},learningSync:true,library:{status:'ready',appIds:${JSON.stringify(appIds)}}})`;
      await window.loadURL('synk-desktop://platform/index.html');
      for(let attempt=0;attempt<200;attempt++){const state=await run("document.documentElement.dataset.ready");if(state==='true')break;if(state==='error'||attempt===199)throw Error('Renderer not ready');await pause(30);}
      const ok=(info,extra=true)=>extra&&!info.pageOverflow&&!info.mainOverflow&&info.imagesLoaded;
      for(const theme of ['day','night']){
        await run(`document.querySelector('[data-theme-choice=${theme}]').click()`);
        for(const width of theme==='day'?[1440,390,320]:[1440,390]){
          window.setContentSize(width,960);const tag=`${theme}-${width}`,shoot=width!==320;
          // 손님: 위 메뉴 솔리오 · 탭 셋 · 설정의 회원 혜택 줄.
          await run(`window.__synkFixture.switchAccount({configured:true,status:'signed-out',signedIn:false,sessionGeneration:${width}})`);await settle();
          let info=await go("document.querySelector('.nav-links [data-view=solio]').click()");
          check('guest-solio-home-'+tag,ok(info,info.solio&&info.tabs==='home*,backup,subscriptions'&&info.navLabels==='home,library,solio,downloads,settings'),{...info,shot:shoot?await capture('guest-solio-home-'+tag):null});
          info=await go("document.querySelector('[data-solio-section=backup]').click()");
          check('guest-solio-backup-'+tag,ok(info,info.tabs==='home,backup*,subscriptions'&&await run("!document.querySelector('#solio-panel .solio-backup button,#solio-panel .solio-backup a')")),{...info,shot:shoot?await capture('guest-solio-backup-'+tag):null});
          info=await go("document.querySelector('[data-solio-section=subscriptions]').click()");
          check('guest-solio-subscriptions-'+tag,ok(info,info.tabs==='home,backup,subscriptions*'&&await run("/로그인하고 시작해요/.test(document.getElementById('solio-subscriptions').textContent)")),{...info,shot:shoot?await capture('guest-solio-subscriptions-'+tag):null});
          info=await go("document.querySelector('.nav-links [data-view=settings]').click();document.querySelector('#view-settings [data-view=benefits]').click()");
          check('guest-benefits-'+tag,ok(info,info.benefits&&await run("document.querySelectorAll('#benefits-grid [data-benefit]').length===1&&!!document.querySelector('#benefits-grid [data-benefit=care]')")),{...info,shot:shoot&&theme==='day'?await capture('guest-benefits-'+tag):null});
          info=await go("document.querySelector('#benefits-grid [data-benefit=care]').click()");
          check('guest-care-no-denied-note-'+tag,ok(info,info.benefits&&await run("!document.querySelector('#benefit-detail [data-benefit-pin],#benefit-detail .benefit-pin-note')")));
          await go("document.querySelector('#benefit-detail .benefit-back').click()");
          info=await go("document.getElementById('account-button').click()");
          check('guest-account-button-opens-sign-in-'+tag,!info.profileMenu&&await run("document.getElementById('account-dialog').open"));await run("document.getElementById('account-dialog').close()");
          // 회원(메신저 · 플레저 권한, 플레저는 쓰지 않음): 홈 선반은 솔리오 + 메신저, 프로필 메뉴, 혜택, 맞춤 정보, AI 구독 관리.
          await run(member('A',['messenger','care'],width+1));await settle();
          info=await go("document.querySelector('.nav-links [data-view=home]').click()");
          check('member-home-'+tag,ok(info,info.shelf==='messenger,solio'),{...info,shot:shoot?await capture('member-home-'+tag):null});
          info=await go("document.getElementById('account-button').click()");
          check('member-profile-menu-'+tag,info.profileMenu&&await run("document.getElementById('account-button').getAttribute('aria-expanded')==='true'&&[...document.querySelectorAll('#profile-menu [data-profile]')].map(n=>n.dataset.profile).join()==='account,benefits,sign-out'"),{...info,shot:shoot&&theme==='day'?await capture('member-profile-menu-'+tag):null});
          info=await go("document.getElementById('profile-menu').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
          check('member-profile-menu-escape-'+tag,!info.profileMenu&&info.focus==='account-button');
          info=await go("document.getElementById('account-button').click();document.querySelector('[data-profile=benefits]').click()");
          check('member-benefits-'+tag,ok(info,info.benefits&&!info.profileMenu),{...info});
          info=await go("document.querySelector('#benefits-grid [data-benefit=care]').click()");
          check('member-care-pin-'+tag,ok(info,await run("document.querySelector('[data-benefit-pin=care]')?.getAttribute('aria-pressed')==='false'")),{...info,shot:shoot&&theme==='day'?await capture('member-care-detail-'+tag):null});
          await run("(()=>{const pin=document.querySelector('[data-benefit-pin=care]');pin.focus();pin.click();})()");await pause(500);await settle();
          check('member-care-pinned-'+tag,await run("(()=>{const pin=document.querySelector('[data-benefit-pin=care]');return pin?.getAttribute('aria-pressed')==='true'&&document.activeElement===pin;})()"));
          info=await go("document.querySelector('.nav-links [data-view=home]').click()");
          check('member-home-after-pin-'+tag,info.shelf.split(',').includes('care'),{...info});
          await run("document.querySelector('.nav-links [data-view=home]').click()");
          // 고정을 되돌려 다음 폭이 같은 상태에서 시작하게 한다(초점이 제목에 있으면 고정 단추로 빼앗지 않는다).
          await go("document.getElementById('account-button').click();document.querySelector('[data-profile=benefits]').click();document.querySelector('#benefits-grid [data-benefit=care]').click()");await run("document.querySelector('[data-benefit-pin=care]').click()");await pause(500);await settle();
          check('member-care-unpinned-keeps-other-focus-'+tag,await run("document.querySelector('[data-benefit-pin=care]')?.getAttribute('aria-pressed')==='false'&&document.activeElement?.id==='benefit-title'"));
          info=await go("document.getElementById('account-button').click();document.querySelector('[data-profile=account]').click()");
          check('member-account-'+tag,ok(info,info.account&&await run("!!document.querySelector('#view-account [data-section=\"02-personal\"]')")),{...info,shot:shoot&&theme==='day'?await capture('member-account-'+tag):null});
          info=await go("document.querySelector('#view-account [data-account-action=insight]').click()");
          check('member-insight-'+tag,ok(info,info.insight&&info.focus==='benefit-title'&&await run("!!document.querySelector('#insight-detail .mi2-back[data-view=account]')&&/맞춤 정보/.test(document.querySelector('#insight-detail .mi2-eyebrow')?.textContent||'')")),{...info,shot:shoot?await capture('member-insight-'+tag):null});
          info=await go("document.querySelector('#insight-detail .mi2-back').click()");
          check('member-insight-back-'+tag,info.account&&await run("document.getElementById('insight-detail').innerHTML===''"));
          info=await go("document.querySelector('.nav-links [data-view=solio]').click()");
          check('member-solio-home-'+tag,ok(info,info.solio&&await run("/이 PC에서 바로 써요/.test(document.getElementById('solio-panel').textContent)")),{...info,shot:shoot?await capture('member-solio-home-'+tag):null});
          info=await go("document.querySelector('#solio-panel .primary[data-solio-section=subscriptions]').click()");await pause(400);await settle();info=await inspect();
          check('member-solio-subscriptions-'+tag,ok(info,info.tabs==='home,backup,subscriptions*'&&await run("/Claude/.test(document.getElementById('solio-subscriptions').textContent)&&document.getElementById('solio-panel').hidden")),{...info,shot:shoot?await capture('member-solio-subscriptions-'+tag):null});
          info=await go("document.querySelector('#solio-subscriptions .ms-back').click()");
          check('member-subscriptions-back-'+tag,info.solio&&info.tabs==='home*,backup,subscriptions'&&await run("document.getElementById('solio-subscriptions').innerHTML===''"));
          // 옛 경로: 저장된 마지막 화면이 회원 혜택 · 구독 계정판이어도 솔리오로 이어진다(편의 명령도 같은 길).
          info=await go("document.querySelector('.nav-links [data-view=home]').click()");
          check('member-old-names-search-'+tag,await run("(()=>{const s=document.getElementById('search');s.value='계정판';s.dispatchEvent(new Event('input'));document.querySelector('.nav-links [data-view=library]').click();return /AI 구독 관리/.test(document.getElementById('benefits-search').textContent);})()"));
          await run("(()=>{const s=document.getElementById('search');s.value='';s.dispatchEvent(new Event('input'));})()");
          // WORLD만 있는 회원: 홈 선반이 솔리오만, 앱 없는 회원: 솔리오부터 안내.
          await run(member('W',['world'],width+2));await settle();info=await go("document.querySelector('.nav-links [data-view=home]').click()");
          check('member-world-only-home-'+tag,ok(info),{...info,shot:shoot&&theme==='day'?await capture('member-world-only-home-'+tag):null});
          await run(member('N',[],width+3));await settle();info=await go("document.querySelector('.nav-links [data-view=home]').click()");
          check('member-no-apps-home-'+tag,ok(info,await run("!!document.querySelector('#view-home [data-member-solio]')")),{...info,shot:shoot&&theme==='day'?await capture('member-no-apps-home-'+tag):null});
          await run("document.querySelector('#view-home [data-member-solio]').click()");await settle();
          check('member-no-apps-opens-solio-'+tag,(await inspect()).solio);
        }
      }
      check('window-remains-hidden',!window.isVisible());
      const report={ok:checks.every(item=>item.ok)&&!errors.length&&!requests.length,checkedOn:new Date().toISOString(),scope:'Hidden Electron launcher at 1440/390/320, day and night: SOLIO top menu and tabs, profile menu, member benefits (PLEASURE pin), account → 맞춤 정보 → 내 성향, home shelf. Synthetic accounts, subscriptions and insight only; no live login, launch, paid AI or deployment.',checks,shots,consoleErrors:errors,requests};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,stack:error.stack?.slice(0,800),checks,shots,consoleErrors:errors,requests})+'\n');window?.destroy();app.exit(1);}
  });
}

// 이 점검의 미리 올림 다리. member-insight-fixture 앞부분(합성 저장소 함수들) 뒤에 붙어 한 파일로 돈다.
function rendererBridge(){return String.raw`
if(process.versions.electron&&process.type==='renderer'){
  const {contextBridge}=require('electron');
  let auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0};
  const listeners=new Set(),subsListeners=new Set(),calls=[],activity=activityStore(),library=libraryStore(),understanding=understandingStore(),memory=memoryStore();
  const owner=()=>auth.account?.synk_user_id?.replace('synthetic-insight-','')||'A';
  const denied=operation=>async()=>{calls.push({operation});return {ok:false,code:'QA_OPERATION_DISABLED'};};
  const fresh=Date.now()-4*60e3,row=extra=>({id:'r-'+Math.random().toString(36).slice(2,8),service:'claude',source:'auto',label:'Claude',kind:'weekly',state:'ok',email:'member@synthetic.invalid',price:null,currency:'KRW',billDay:null,credits:null,creditsAt:null,lowAt:null,resetDay:null,resetHour:null,resetMinute:null,usedUpAt:null,note:'',live:null,...extra});
  const subs={ok:true,tools:{},rows:[row({email:'work@synthetic.invalid',live:{readAt:fresh,session:{usedPercent:100,resetsAt:fresh+36*60e3},weekly:{usedPercent:51,resetsAt:fresh+115*3600e3}}}),row({email:'roomy@synthetic.invalid',plan:'max',live:{readAt:fresh,weekly:{usedPercent:22,resetsAt:fresh+44*3600e3}}}),row({service:'gpt',label:'ChatGPT · Codex',email:'gpt@synthetic.invalid',live:{readAt:fresh,session:{usedPercent:0,resetsAt:null},weekly:{usedPercent:49,resetsAt:fresh+145*3600e3}}}),row({service:'gemini',source:'manual',kind:'plan',label:'Gemini',email:null,price:29000,billDay:((new Date().getDate()+2-1)%28)+1})],settings:{usdKrw:1400},check:{at:fresh,total:3,ok:3},login:null,checking:false};
  const accountView=()=>({ok:true,account:{synk_user_id:auth.account?.synk_user_id,status:'active',profile:{display_name:auth.account?.display_name||'합성 회원',locale:'ko',time_zone:'Asia/Seoul'},profile_revision:1,providers:['email']},memberships:[],learning:{enabled:true,revision:1},capabilities:{learningSync:true},sessions:[{id:'44444444-4444-4444-8444-444444444444',product:'platform',last_seen:new Date().toISOString(),current:true,revoked:false}],dataRequests:[]});
  contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
    getEnvironment:async()=>({platform:'win32',arch:'x64',version:'synthetic',mode:'development',teacherPreviewAvailable:false,productPreviewsAvailable:['care']}),
    getClients:async()=>[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}},{id:'messenger',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}],authStatus:async()=>auth,
    onAuthChanged:callback=>{listeners.add(callback);return ()=>listeners.delete(callback);},onClientsChanged:()=>()=>{},onClientProgress:()=>()=>{},
    accountIdentity:async()=>({ok:true,accountId:auth.account?.synk_user_id,email:'member@synthetic.invalid',newEmail:null,createdAt:'2026-10-01T00:00:00Z',identities:[{provider:'email'}]}),
    authSecurity:denied('auth-security'),
    accountRequest:async(operation,params={})=>{
      calls.push({operation,owner:owner()});
      if(operation==='load')return {ok:true,account:auth.account};
      if(operation==='accountView')return accountView();
      if(['platformLoad','platformSave'].includes(operation))return library.request(owner(),operation,params);
      if(['insightLoad','insightSave'].includes(operation))return activity.request(owner(),operation,params);
      if(['understandingLoad','understandingSave','understandingDelete'].includes(operation))return understanding.request(owner(),operation,params);
      if(['memoryGet','memoryPost'].includes(operation))return memory.request(owner(),operation,params);
      if(operation==='atlasSummary')return memory.apply(owner(),currentSummary('enabled',owner()));
      return {ok:false,error:{code:'QA_OPERATION_DISABLED'}};
    },
    subscriptions:Object.freeze({snapshot:async()=>subs,check:async()=>subs,onChanged:callback=>{subsListeners.add(callback);return ()=>subsListeners.delete(callback);},save:async()=>subs,help:async()=>({ok:true}),install:denied('subs-install'),useExisting:denied('subs-use'),login:denied('subs-login'),submitCode:denied('subs-code'),cancel:async()=>({ok:true}),openLoginUrl:denied('subs-url'),connectKey:denied('subs-key')}),
    openProductPreview:async id=>{calls.push({operation:'product-preview:'+id});return {ok:true};},openPublicApp:async id=>{calls.push({operation:'public:'+id});return {ok:true};},
    launch:denied('launch'),prepareClient:denied('prepare'),openInstaller:denied('install'),cancelPreparation:denied('cancel'),authSignIn:denied('login'),authSignUp:denied('signup'),openTeacherPreview:denied('teacher-preview'),
    authSignOut:async()=>{auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:auth.sessionGeneration+1};for(const callback of listeners)callback(auth);return {ok:true,serverRevoked:true,serverSessionRevoked:true};},
  }));
  contextBridge.exposeInMainWorld('__synkFixture',Object.freeze({switchAccount:snapshot=>{auth=snapshot;for(const callback of listeners)callback(auth);},calls:()=>calls.map(call=>({...call}))}));
}
`;}
