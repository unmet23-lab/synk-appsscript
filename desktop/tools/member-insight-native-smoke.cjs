'use strict';
// Actual hidden Electron renderer and isolated temporary profile, synthetic IPC only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=process.env.SYNK_INSIGHT_QA_OUT||path.resolve(root,'../experiences/synk-account/qa/member-understanding-20261014'),prefix='SYNK_INSIGHT_QA ';
if(!path.isAbsolute(out))throw Error('QA output path must be absolute');
const understandingScenarios=require('./member-understanding-scenarios.cjs');
const sourceFiles=['tools/member-insight-native-smoke.cjs','tools/member-insight-fixture.cjs','tools/member-understanding-scenarios.cjs','renderer/launcher.mjs','renderer/platform-continuity.mjs','renderer/member-insight.mjs','renderer/member-insight-model.mjs','renderer/member-insight-view.mjs','renderer/member-insight.css','renderer/member-activity-controller.mjs','renderer/generated/member-activity.mjs','renderer/generated/member-activity-data.mjs','renderer/member-understanding-controller.mjs','renderer/member-understanding-host.mjs','renderer/generated/member-understanding.mjs','renderer/generated/member-understanding-data.mjs'];
const fingerprints=()=>Object.fromEntries(sourceFiles.map(file=>[file,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-insight-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:240000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1500)};
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests}));if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-insight-'))throw Error('Unsafe temporary profile');
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});}catch(error){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-profile-cleanup.json'),JSON.stringify({profile,error:error.code,scope:'Only this isolated test profile; the installed SYNK profile was never used.'},null,2)+'\n');}
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs'),{signedIn}=require('./member-insight-fixture.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-insight-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[],screenshots=[],popupIntents=[],captureRecoveries=[],sourceHashes=fingerprints();
    const check=(name,ok,details={})=>{checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    try{
      fs.mkdirSync(out,{recursive:true});Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('member-insight-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(new URL(details.url).origin+new URL(details.url).pathname);callback({cancel:true});});
      window=new BrowserWindow({width:1440,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'member-insight-fixture.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(details=>{popupIntents.push(details.url);return {action:'deny'};});window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      const run=script=>window.webContents.executeJavaScript(script),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const until=async expression=>{for(let n=0;n<240;n++){if(await run(expression))return;await pause(35);}throw Error('Timed out: '+expression);};
      const ready=status=>until('document.querySelector("[data-insight-status='+status+']")!==null');
      const text=()=>run('document.querySelector(".member-insight").innerText');
      const capture=async(name,width,theme='night',scrollTarget=null)=>{
        window.setContentSize(width,960);await run('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.getElementById("main").scrollTop=0;document.fonts.ready');
        if(scrollTarget)await run('document.querySelector('+JSON.stringify(scrollTarget.startsWith('.')?scrollTarget:'#'+scrollTarget)+').scrollIntoView({block:"start"})');
        // A hidden Electron window may return its last surface on the first call.
        // Discard that warm-up frame before capturing the current DOM/theme.
        // The warm-up can also fail while Chromium prepares a hidden surface.
        // Bound both captures equally and retain every recovered error in QA.
        const frame=async phase=>{
          for(let attempt=0;attempt<3;attempt++){
            try{window.webContents.invalidate();await pause(150);const pixels=await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});if(pixels.isEmpty())throw Error('EMPTY_SYNTHETIC_CAPTURE');return pixels;}
            catch(error){if(attempt===2)throw error;captureRecoveries.push({name,phase,attempt:attempt+1,error:error.message});await pause(200);}
          }
        };
        await frame('warm-up');await pause(300);
        const pixels=await frame('current');
        fs.writeFileSync(path.join(out,name+'.png'),pixels.toPNG());screenshots.push(name+'.png');
        const dimensions=await run('(()=>{const m=document.getElementById("main");return {width:innerWidth,page:document.documentElement.scrollWidth,main:m.scrollWidth,mainWidth:m.clientWidth};})()');
        check(name+' no horizontal overflow',dimensions.page<=dimensions.width&&dimensions.main<=dimensions.mainWidth,dimensions);
        check(name+' heading rendered',await run('document.querySelector("h1#benefit-title")?.getBoundingClientRect().width>0'));
      };
      const refresh=()=>run('document.querySelector("[data-insight-action=refresh]").click()');
      const setMode=mode=>run('window.__synkFixture.setMode('+JSON.stringify(mode)+')');
      const setActivityMode=mode=>run('window.__synkFixture.setActivityMode('+JSON.stringify(mode)+')');
      const openInsight=()=>run('document.querySelector(".nav-links [data-view=benefits]").click();document.querySelector("[data-benefit=insight]").click()');
      await window.loadURL('synk-desktop://platform/index.html');await until('document.documentElement.dataset.ready==="true"');
      await run('document.querySelector(".nav-links [data-view=benefits]").click();document.querySelector("[data-benefit=insight]").click()');await ready('signed-out');
      check('signed-out never reads Atlas',await run('!window.__synkFixture.calls().some(c=>c.operation==="atlasSummary")'));await capture('native-signed-out-320',320);
      await run('document.querySelector("[data-insight-action=account]").click()');check('account action opens existing account dialog',await run('document.getElementById("account-dialog").open'));await run('document.getElementById("account-dialog").close()');
      await run('window.__synkFixture.switchAccount('+JSON.stringify(signedIn('A',1))+')');await openInsight();await ready('ready');
      check('both report areas visible',(await text()).includes('나의 관심사·선호')&&(await text()).includes('학습 성향·성장'));
      check('synthetic account A learning appears',(await text()).includes('합성 A 짧은 안내 듣기'));
      await until('document.querySelector("[data-insight-action=enable-activity]:not([disabled])")!==null');
      check('app observations default off without writes',await run('!window.__synkFixture.activityState().consent&&!window.__synkFixture.calls().some(c=>c.operation==="insightSave")'));
      await understandingScenarios.sparseSummaryScenario({run,until,inspect:()=>run('window.__synkFixture.understandingState()'),inspectActivity:()=>run('window.__synkFixture.activityState()'),
        writeCount:()=>run('window.__synkFixture.calls().filter(c=>/Save$|Delete$/.test(c.operation)).length'),setLearning:setMode,refresh:async()=>{await refresh();await ready('ready');},capture,check,prefix:'native'});
      await run('document.querySelector("[data-insight-action=enable-activity]").click()');await until('document.querySelector("[data-insight-action=disable-activity]:not([disabled])")!==null');
      check('opt-in stores explicit consent with no observations',await run('window.__synkFixture.activityState().consent&&window.__synkFixture.activityState().eventCount===0'));
      check('newly enabled interest is clearly empty',(await text()).includes('아직 앱 이용에서 확인할 관심 정보가 없어요.'));
      await run('document.querySelector(".nav-links [data-view=home]").click();if(document.querySelector("[data-library-panel]").hidden)document.querySelector("[data-panel-toggle]").click()');await until('document.querySelector("[data-cloud=enable]:not([disabled])")?.getBoundingClientRect().width>0');await run('document.querySelector("[data-cloud=enable]").click()');await until('document.querySelector("[data-cloud=favorite][data-id=world]:not([disabled])")?.getBoundingClientRect().width>0');await run('document.querySelector("[data-cloud=favorite][data-id=world]").click()');await until('window.__synkFixture.activityState().favorites.includes("world")');
      check('account-library star synchronizes declared favorite without counting an app opening',await run('window.__synkFixture.libraryState().favorites.includes("world")&&window.__synkFixture.activityState().eventCount===0'));await run('document.querySelector("[data-panel-toggle][aria-expanded=true]").click()');await openInsight();await ready('ready');
      await run('window.__synkFixture.setLaunchAllowed(false);document.querySelector("[data-insight-action=activity][data-insight-target=world]").click()');await pause(80);
      check('failed native launch does not create an observation',await run('window.__synkFixture.activityState().eventCount===0'));await run('window.__synkFixture.setLaunchAllowed(true)');
      await run('document.querySelector("[data-insight-action=activity][data-insight-target=world]").click()');await until('window.__synkFixture.activityState().eventCount===1');await until('document.querySelector(".mi-interest-list")!==null');
      check('WORLD selector uses successful mock launch before one observation',await run('window.__synkFixture.calls().some(c=>c.operation==="launch"&&c.target==="world")&&window.__synkFixture.activityState().eventCount===1'));
      await run('document.querySelector("[data-insight-action=disable-activity]").click()');await until('document.querySelector("[data-insight-action=enable-activity]:not([disabled])")!==null');
      check('opt-out clears accumulated observations and UI',await run('!window.__synkFixture.activityState().consent&&window.__synkFixture.activityState().eventCount===0&&!document.querySelector(".mi-interest-list")'));
      await setActivityMode('populated');await refresh();await until('document.querySelector(".mi-interest-list")?.innerText.includes("실제 앱 열기에서 관찰")');
      check('declared favorites and observed launches remain separate',(await text()).includes('직접 고른 즐겨찾기')&&await run('document.querySelectorAll(".mi-period-table").length===2'));
      check('period comparison counts opens only',await run('document.querySelector(".mi-member-activity .mi-period-table").innerText.includes("1회 더 많음")'));
      await run('document.querySelector(".mi-member-activity .mi-period-dates").open=true');check('exact comparison bounds are available',await run('document.querySelectorAll(".mi-member-activity .mi-period-dates time").length===4'));
      await until('document.getElementById("toast").hidden');
      for(const theme of ['night','day'])for(const width of [1440,390,320]){await capture('native-enabled-'+theme+'-'+width,width,theme);await capture('native-activity-'+theme+'-'+width,width,theme,'.mi-member-activity');await capture('native-periods-'+theme+'-'+width,width,theme,'.mi-member-activity .mi-periods');await capture('native-learning-'+theme+'-'+width,width,theme,'insight-learning-title');}
      await understandingScenarios({run,until,click:selector=>run('document.querySelector('+JSON.stringify(selector)+').click()'),
        inspect:()=>run('window.__synkFixture.understandingState()'),setMode:mode=>run('window.__synkFixture.setUnderstandingMode('+JSON.stringify(mode)+')'),replace:value=>run('window.__synkFixture.replaceUnderstanding('+JSON.stringify(value)+')'),
        setLearning:setMode,refresh:async()=>{await refresh();await ready('ready');},reenter:async()=>{await openInsight();await ready('ready');},capture,
        launch:async selector=>{const count=await run('window.__synkFixture.calls().filter(c=>c.operation==="launch").length');await run('document.querySelector('+JSON.stringify(selector)+').click()');await until('window.__synkFixture.calls().filter(c=>c.operation==="launch").length>'+count);check('confirmed topic WORLD button uses the existing native launch bridge',await run('window.__synkFixture.calls().filter(c=>c.operation==="launch").at(-1).target==="world"'));},check,prefix:'native'});
      await run('document.querySelector(".mi-evidence").open=true');check('evidence is available',(await text()).includes('독립 응답')&&(await text()).includes('TOPIK'));await capture('native-evidence-390',390);
      const before=await run('window.__synkFixture.calls().filter(c=>c.operation==="atlasSummary").length');await refresh();await ready('ready');check('refresh reads original Atlas operation',await run('window.__synkFixture.calls().filter(c=>c.operation==="atlasSummary").length>'+before));
      await setMode('empty');await refresh();await until('document.querySelector(".member-insight")?.innerText.includes("첫 연습 기록을 기다리고 있어요.")');check('empty clears previous results',!(await text()).includes('합성 A'));await capture('native-empty-320',320);
      await setMode('disabled');await refresh();await until('document.querySelector(".mi-consent")!==null');const disabled=await text();check('consent off suppresses practice and preferences',!disabled.includes('합성 A')&&!disabled.includes('단계별로 도와줘요')&&disabled.includes('한국 여행'));await capture('native-disabled-320',320);
      check('learning consent off preserves independently authorized app observations',await run('!!document.querySelector(".mi-interest-list")&&document.querySelectorAll(".mi-period-table").length===1'));
      await run('document.querySelector("[data-insight-action=account]").click()');await pause(50);check('signed-in account action targets fixed portal without navigating externally',popupIntents.length===1&&popupIntents[0]==='https://synk.im/account/client.html?product=platform');
      await setMode('enabled');await setActivityMode('partial');await refresh();await until('document.querySelector(".mi-member-activity .mi-period-table")?.innerText.includes("비교 보류")');check('partial activity coverage does not produce delta',await run('!document.querySelector(".mi-member-activity .mi-period-table").innerText.includes("더 많음")'));await capture('native-partial-320',320);
      for(const mode of ['malformed','error']){await setActivityMode(mode);await refresh();await until('document.querySelector(".mi-consent-status")?.innerText.includes("불러오지 못했어요")');check(mode+' activity fails closed without hiding valid learning',(await text()).includes('합성 A')&&await run('document.querySelector(".mi-interest-list")===null'));await capture('native-activity-'+mode+'-320',320);}
      await setActivityMode('populated');
      await setMode('error');await refresh();await ready('error');check('failed read clears prior personal result',!(await text()).includes('한국 여행'));await capture('native-error-320',320);
      await setMode('enabled');await refresh();await ready('ready');
      await run('window.__synkFixture.holdNext()');await refresh();await until('window.__synkFixture.pendingCount()===1');await run('window.__synkFixture.switchAccount('+JSON.stringify(signedIn('B',2))+')');await openInsight();await until('document.querySelector(".member-insight")?.innerText.includes("합성 B 짧은 안내 듣기")');await run('window.__synkFixture.releaseHeld()');await pause(80);
      check('late A response cannot replace B',(await text()).includes('합성 B')&&!(await text()).includes('합성 A'));await capture('native-account-B-390',390);
      check('account B does not inherit A observation consent',await run('!window.__synkFixture.activityState().consent&&!document.querySelector(".mi-interest-list")'));
      await run('window.__synkFixture.switchAccount({configured:true,status:"signed-out",signedIn:false,sessionGeneration:3})');await openInsight();await ready('signed-out');check('sign-out removes prior account content',!(await text()).includes('합성 B'));
      check('only scoped synthetic reads, consent/favorite/correction writes and WORLD mock launch invoked',await run('window.__synkFixture.calls().every(c=>["load","platformLoad","platformSave","atlasSummary","insightLoad","insightSave","understandingLoad","understandingSave","understandingDelete"].includes(c.operation)||(c.operation==="launch"&&c.target==="world"))'));
      check('Atlas receives no caller identity or arbitrary scope',await run('window.__synkFixture.calls().filter(c=>c.operation==="atlasSummary").every(c=>c.keys.length===0)'));
      await run('document.querySelector(".mi-back").click()');check('back returns to benefits overview',await run('!document.getElementById("benefits-overview").hidden&&document.getElementById("benefit-detail").hidden'));
      check('window remained hidden',!window.isVisible());check('no remote requests',!requests.length);check('no renderer console errors',!errors.length);
      check('tested source files did not change during execution',JSON.stringify(sourceHashes)===JSON.stringify(fingerprints()));
      process.stdout.write(prefix+JSON.stringify({ok:true,checkedOn:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),scope:'Actual hidden Electron renderer; synthetic Atlas and consent IPC with isolated temporary profile; 1440/390/320 night/day. WORLD launch returns a fixture success without starting any app. No live account, installed profile, AI or publication.',checks,consoleErrors:errors,requests,screenshots,popupIntents,captureRecoveries,sourceHashes})+'\n');window.destroy();app.exit(0);
    }catch(error){const state=window&&!window.isDestroyed()?await window.webContents.executeJavaScript('({hidden:document.hidden,status:document.querySelector("[data-insight-status]")?.dataset.insightStatus,text:document.querySelector(".member-insight")?.innerText,calls:window.__synkFixture?.calls()})').catch(()=>null):null;process.stdout.write(prefix+JSON.stringify({ok:false,error:error.stack,state,checks,consoleErrors:errors,requests,screenshots,popupIntents,captureRecoveries})+'\n');window?.destroy();app.exit(1);}
  });
}
