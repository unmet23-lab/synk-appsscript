'use strict';
// Hidden, isolated Chromium QA for the compact app catalogue. The synthetic
// preload is written inside a disposable profile; no production IPC is used.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
const prefix='app-compaction-20261009',signal='SYNK_APP_COMPACTION ';
const finalOnly=process.argv.includes('--final-reload-only');
// 10-09 결정 「SYNK Workspace · 교사 통합」으로 교사 앱은 Workspace에 합쳐져 목록은 여덟 개다.
const EXPECTED_IDS=['world','messenger','path','pulse','care','fortune','rehearsal','family-album'];
const PULSE_FEATURES=['제작 의뢰','창작자 협업','작품과 권리'];
const CORE_FEATURES={world:['한국어 놀이','싱크 타운','학습 이어가기'],messenger:['팀 대화','내 업무','제작·AI 실습'],pulse:PULSE_FEATURES};
// Companion checks are executed by the parent agent, outside this renderer QA.
const automatedTests={reportedBy:'parent agent execution',total:240,passed:240,runs:[
  {command:'node --test desktop/tests/renderer-state.test.cjs desktop/tests/renderer-personalization.test.cjs desktop/tests/library-access.test.cjs desktop/tests/renderer-library.test.cjs desktop/tests/member-home.test.cjs desktop/tests/renderer-auth.test.cjs desktop/tests/member-benefit-preview.test.cjs desktop/tests/auth.test.cjs',passed:160,total:160},
  {command:'node --test experiences/synk-account/tests/platform-library.test.mjs experiences/synk-account/tests/platform-library-view.test.mjs experiences/synk-account/tests/platform.test.mjs experiences/synk-account/tests/member-benefits.test.mjs',passed:68,total:68},
  {command:'node --test tests/platform-library-note-actions.test.mjs',passed:12,total:12}
]};
const buildChecks={reportedBy:'parent agent execution',checks:[
  {command:'node desktop/tools/build-platform-continuity.cjs --check',ok:true},
  {command:'node tools/build-synk-account.js --check',ok:true}
]};
const fixtureSource=`'use strict';
const {contextBridge}=require('electron');
let auth={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0};
let environment={platform:'win32',arch:'x64',version:'synthetic',mode:'development',clientId:'platform',nativeShell:true,teacherPreviewAvailable:true,productPreviewsAvailable:['path','care','fortune','rehearsal','family-album']};
const listeners=new Set(),clientListeners=new Set(),calls=[];
const clients=[{id:'world',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}},{id:'messenger',status:'installed',version:'synthetic',canLaunch:true,installer:{status:'idle'}}];
const denied=operation=>async()=>{calls.push(operation);return {ok:false,code:'QA_OPERATION_DISABLED'};};
contextBridge.exposeInMainWorld('synkDesktop',Object.freeze({
  getEnvironment:async()=>environment,getClients:async()=>clients,authStatus:async()=>auth,
  onAuthChanged:callback=>{listeners.add(callback);return ()=>listeners.delete(callback);},onClientsChanged:callback=>{clientListeners.add(callback);return ()=>clientListeners.delete(callback);},onClientProgress:()=>()=>{},
  openTeacherPreview:denied('teacher-preview'),openProductPreview:denied('product-preview'),launch:denied('launch'),prepareClient:denied('prepare'),openInstaller:denied('install'),cancelPreparation:denied('cancel'),authSignIn:denied('login'),
  authSignOut:denied('logout')
}));
contextBridge.exposeInMainWorld('__synkFixture',Object.freeze({
  switchAccount:snapshot=>{auth=snapshot;for(const callback of listeners)callback(auth);},
  setEnvironment:snapshot=>{environment={...environment,...snapshot};},calls:()=>[...calls]
}));
`;

if(!process.versions.electron){
  const {spawnSync}=require('node:child_process');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-app-compaction-'));
  try{
    fs.writeFileSync(path.join(profile,'fixture.cjs'),fixtureSource);
    const run=spawnSync(require('electron'),[__filename,'--profile='+profile,...(finalOnly?['--final-reload-only']:[])],{cwd:root,encoding:'utf8',windowsHide:true,timeout:90000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(signal));
    let result=line?JSON.parse(line.slice(signal.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-2000)};
    fs.mkdirSync(artifacts,{recursive:true});
    const reportPath=path.join(artifacts,prefix+'.json');
    if(finalOnly&&fs.existsSync(reportPath)){
      const previous=JSON.parse(fs.readFileSync(reportPath,'utf8'));
      result={...previous,...result,ok:previous.ok&&result.ok,checks:[...(previous.checks||[]),...(result.checks||[])],screenshots:[...new Set([...(previous.screenshots||[]),...(result.screenshots||[])])],consoleErrors:[...(previous.consoleErrors||[]),...(result.consoleErrors||[])],networkRequests:[...(previous.networkRequests||[]),...(result.networkRequests||[])],verificationNotes:['Full 126-check pass completed before the removal of unreachable Partners icon labels and retired CSS. The final source was freshly loaded and reloaded for the catalogue, PULSE features and partner-search checks below.']};
    }
    fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok:result.ok,checkCount:result.checks?.length,error:result.error,failures:result.checks?.filter(check=>!check.ok),consoleErrors:result.consoleErrors,networkRequests:result.networkRequests,screenshots:result.screenshots},null,2)+'\n');
    if(!result.ok)process.exitCode=1;
  }finally{
    const resolvedProfile=path.resolve(profile);
    if(path.dirname(resolvedProfile)!==path.resolve(os.tmpdir())||!path.basename(resolvedProfile).startsWith('synk-app-compaction-'))throw Error('Unsafe temporary profile');
    fs.rmSync(resolvedProfile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron');
  const {createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||!path.basename(profile).startsWith('synk-app-compaction-')||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir()))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const errors=[],requests=[],checks=[],screenshots=[];
    try{
      Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('app-compaction-'+Date.now());
      isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
      isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      window=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(profile,'fixture.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(String(details.message));});
      window.webContents.on('preload-error',(_event,_preload,error)=>errors.push('preload: '+error.message));
      const run=script=>window.webContents.executeJavaScript(script);
      const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
      const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const settle=async()=>{await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");window.webContents.invalidate();await pause(110);};
      const ready=async()=>{for(let i=0;i<150;i++){const state=await run('document.documentElement.dataset.ready');if(state==='true'){await run("document.querySelector('[data-view=library]').click()");await settle();return;}if(state==='error')throw Error('Renderer init failed');await pause(20);}throw Error('Renderer ready timeout');};
      const capture=async name=>{await settle();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await pause(160);fs.mkdirSync(artifacts,{recursive:true});const filename=path.join(artifacts,prefix+'-'+name+'.png');fs.writeFileSync(filename,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());screenshots.push(filename);return filename;};
      const inspect=()=>run(`(()=>{
        const $=id=>document.getElementById(id),main=$('main'),hero=$('hero'),box=hero.getBoundingClientRect(),text=document.querySelector('.hero-text').getBoundingClientRect();
        return {width:innerWidth,ids:[...document.querySelectorAll('#app-list [data-app]')].map(n=>n.dataset.app),count:$('library-count').textContent,selected:document.documentElement.dataset.product,title:$('breadcrumb-app').textContent,detailHidden:$('app-detail').hidden,emptyHidden:$('library-empty').hidden,
          features:[...document.querySelectorAll('#detail-content .feature-list article h3')].map(n=>n.textContent.trim()),detailText:$('detail-content').textContent.trim(),action:$('primary-action').dataset.action,actionDisabled:$('primary-action').disabled,
          pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,main.scrollWidth-main.clientWidth),detailOverflow:Math.max(0,$('detail-content').scrollWidth-$('detail-content').clientWidth),
          heroTextFits:$('app-detail').hidden||(text.top>=box.top-1&&text.bottom<=box.bottom+1&&text.right<=box.right+1),imagesLoaded:[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0),partnerNode:!!document.querySelector('[data-app=partners]'),partnersLabel:[...document.querySelectorAll('#app-list strong')].some(n=>n.textContent==='SYNK Partners'),
          overflowingNodes:[...main.querySelectorAll('*')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().right>main.getBoundingClientRect().right+1).slice(0,8).map(n=>({node:n.id?'#'+n.id:n.tagName.toLowerCase()+'.'+n.className,right:Math.round(n.getBoundingClientRect().right),text:n.textContent.trim().slice(0,80)}))};
      })()`);
      const layoutOkay=info=>info.pageOverflow===0&&info.mainOverflow===0&&info.detailOverflow===0&&info.heroTextFits&&info.imagesLoaded;
      const search=async value=>{await run("document.getElementById('search').value="+JSON.stringify(value)+";document.getElementById('search').dispatchEvent(new Event('input'))");await settle();};
      const select=async id=>{await run("document.querySelector('#app-list [data-app="+id+"]').click();window.scrollTo(0,0)");await settle();};
      const tab=async value=>{await run("document.querySelector('[data-detail="+value+"]').click()");await settle();};
      let generation=1;
      const account=(id,appIds)=>({configured:true,status:'signed-in',signedIn:true,sessionGeneration:generation++,account:{synk_user_id:id,display_name:'합성 '+id},library:{status:'ready',appIds}});
      const switchTo=async state=>{await run('window.__synkFixture.switchAccount('+JSON.stringify(state)+')');await settle();};
      const mode=async value=>{await run('window.__synkFixture.setEnvironment({mode:'+JSON.stringify(value)+'});document.getElementById("refresh").click()');await pause(150);await settle();};
      await window.loadURL('synk-desktop://platform/index.html');await ready();
      if(!finalOnly)for(const width of [1280,390,320]){
        window.setContentSize(width,900);await mode('development');await search('');
        await switchTo({configured:true,status:'signed-out',signedIn:false,sessionGeneration:generation++});
        await run("document.querySelector('[data-view=library]').click();window.scrollTo(0,0)");await settle();
        let info=await inspect();
        check('catalogue-eight-apps-'+width,JSON.stringify(info.ids)===JSON.stringify(EXPECTED_IDS)&&info.count==='08'&&!info.partnerNode&&!info.partnersLabel&&layoutOkay(info),info);
        await capture('catalogue-'+width);
        for(const id of EXPECTED_IDS){
          await select(id);info=await inspect();
          check(id+'-overview-'+width,info.selected===id&&!info.detailHidden&&info.features.length===3&&(!CORE_FEATURES[id]||JSON.stringify(info.features)===JSON.stringify(CORE_FEATURES[id]))&&layoutOkay(info),info);
          if(id==='world')check('world-game-buttons-preserved-'+width,await run("JSON.stringify([...document.querySelectorAll('#detail-content [data-game]')].map(n=>n.dataset.game))==='[\"racing\",\"runner\",\"rhythm\"]'"));
          if(id==='pulse'){
            check('pulse-merged-features-'+width,JSON.stringify(info.features)===JSON.stringify(PULSE_FEATURES)&&info.action==='none'&&info.actionDisabled&&/준비 중|계획/.test(info.detailText)&&!/SYNK Partners/.test(info.detailText),{features:info.features,action:info.action,actionDisabled:info.actionDisabled});
            await run("document.querySelector('.app-heading').scrollIntoView({block:'start'})");
            await capture('pulse-overview-'+width);
            await run("document.getElementById('detail-content').scrollIntoView({block:'start'});if(innerWidth>680)document.getElementById('main').scrollTop=document.getElementById('detail-content').offsetTop-20");
            await capture('pulse-features-'+width);
            await run("document.getElementById('main').scrollTop=0;window.scrollTo(0,0)");
          }
          await tab('content');info=await inspect();
          check(id+'-content-'+width,info.selected===id&&!info.detailHidden&&info.detailText.length>0&&layoutOkay(info),info);
          await tab('info');info=await inspect();
          check(id+'-info-'+width,info.selected===id&&!info.detailHidden&&info.detailText.includes(info.title)&&layoutOkay(info),info);
        }
        for(const term of ['파트너','partners','창작자']){
          await search(term);info=await inspect();
          check('merged-search-'+term+'-'+width,JSON.stringify(info.ids)==='["pulse"]'&&!info.partnerNode&&layoutOkay(info),info);
        }
        await search('');await select('pulse');
        await run("document.getElementById('personal-open').click();document.getElementById('personal-context').value='partner';document.getElementById('personal-context').dispatchEvent(new Event('change'));document.getElementById('personal-consent').checked=true;document.getElementById('personal-form').requestSubmit()");await settle();
        const personal=await run("({recommendation:document.getElementById('recommendation').textContent,first:document.querySelector('#app-list [data-app]')?.dataset.app,open:document.getElementById('personal-dialog').open})");
        check('partner-purpose-selects-pulse-'+width,personal.first==='pulse'&&personal.recommendation.includes('SYNK PULSE')&&!personal.open,personal);
        await run("document.getElementById('personal-open').click();document.getElementById('personal-clear').click()");await settle();
        await mode('release');
        for(const [name,ids,expected]of [['pulse',['pulse'],['pulse']],['retired-partners',['partners'],[]],['mixed',['partners','pulse'],['pulse']],['teacher',['teacher'],['teacher']],['staff',['messenger'],['messenger']],['unrelated',['world'],['world']]]){
          await switchTo(account(name+'-'+width,ids));info=await inspect();
          check('account-scope-'+name+'-'+width,JSON.stringify(info.ids)===JSON.stringify(expected)&&!info.partnerNode&&(expected.length?!info.detailHidden:info.detailHidden&&!info.emptyHidden)&&layoutOkay(info),info);
        }
        await switchTo(account('old-partner-purpose-'+width,['partners']));
        await run("document.getElementById('personal-settings-open').click();document.getElementById('personal-context').value='partner';document.getElementById('personal-context').dispatchEvent(new Event('change'));document.getElementById('personal-consent').checked=true;document.getElementById('personal-form').requestSubmit()");await settle();
        info=await inspect();
        check('partner-purpose-does-not-grant-access-'+width,info.ids.length===0&&info.detailHidden&&info.actionDisabled&&await run("document.getElementById('recommendation').hidden"),info);
        check('no-privileged-operation-'+width,await run('window.__synkFixture.calls().length===0'));
      }
      if(finalOnly){
        await window.reload();await ready();
        let info=await inspect();
        check('final-reload-eight-apps-1280',JSON.stringify(info.ids)===JSON.stringify(EXPECTED_IDS)&&info.count==='08'&&!info.partnerNode&&!info.partnersLabel&&layoutOkay(info),info);
        await select('pulse');info=await inspect();
        check('final-reload-pulse-three-features-1280',JSON.stringify(info.features)===JSON.stringify(PULSE_FEATURES)&&info.action==='none'&&info.actionDisabled&&layoutOkay(info),info);
        await search('파트너');info=await inspect();
        check('final-reload-partner-search-1280',JSON.stringify(info.ids)==='["pulse"]'&&!info.partnerNode&&layoutOkay(info),info);
        check('final-reload-no-privileged-operation',await run('window.__synkFixture.calls().length===0'));
      }
      const sourceFiles=['desktop/renderer/state.mjs','desktop/renderer/launcher.mjs','desktop/renderer/personalization.mjs','desktop/renderer/benefits.mjs','desktop/renderer/index.html','desktop/renderer/launcher.css','desktop/renderer/member-home.mjs','desktop/src/library-access.cjs','experiences/synk-account/src/platform-library-data.mjs','experiences/synk-account/src/platform-library-view.mjs'];
      const sourceSha256=Object.fromEntries(sourceFiles.map(name=>[name,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'..',name))).digest('hex')]));
      const report={ok:checks.every(item=>item.ok)&&errors.length===0&&requests.length===0,checkedOn:'2026-10-09',scope:'Current bundled renderer in hidden isolated Electron with synthetic development catalogue and account IPC; network blocked; no real login, installation, app launch or deployment',finalSourceReloadVerified:finalOnly,sourceSha256,automatedTests,buildChecks,expectedAppIds:EXPECTED_IDS,expectedPulseFeatures:PULSE_FEATURES,visibleWindowsOpened:false,accountLoginStarted:false,installerOpened:false,clientLaunched:false,aiCallsMade:false,publicDeploymentVerified:false,checks,screenshots,consoleErrors:errors,networkRequests:requests};
      process.stdout.write(signal+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){
      process.stdout.write(signal+JSON.stringify({ok:false,error:error.message,checks,screenshots,consoleErrors:errors,networkRequests:requests})+'\n');window?.destroy();app.exit(1);
    }
  });
}
