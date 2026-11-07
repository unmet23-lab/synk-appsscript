'use strict';
// Actual hidden Electron renderer and isolated temporary profile, synthetic IPC only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
// SYNK_INSIGHT_NATIVE_ROOT opens another app source, such as an installed app.asar, read-only. Default: this checkout.
const root=process.env.SYNK_INSIGHT_NATIVE_ROOT||path.resolve(__dirname,'..'),out=process.env.SYNK_INSIGHT_QA_OUT||path.resolve(__dirname,'../../experiences/synk-account/qa/member-understanding-20261014'),prefix='SYNK_INSIGHT_QA ';
if(!path.isAbsolute(out)||!path.isAbsolute(root))throw Error('QA output and app paths must be absolute');
const understandingScenarios=require('./member-understanding-scenarios.cjs');
const toolFiles=['member-insight-native-smoke.cjs','member-insight-fixture.cjs','member-understanding-scenarios.cjs'];
const sourceFiles=['renderer/launcher.mjs','renderer/platform-continuity.mjs','renderer/member-insight.mjs','renderer/member-insight-model.mjs','renderer/member-insight-view.mjs','renderer/member-insight.css','renderer/member-activity-controller.mjs','renderer/generated/member-activity.mjs','renderer/generated/member-activity-data.mjs','renderer/member-understanding-controller.mjs','renderer/member-understanding-host.mjs','renderer/generated/member-understanding.mjs','renderer/generated/member-understanding-data.mjs'];
const sha=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fingerprints=()=>({...Object.fromEntries(toolFiles.map(file=>['tools/'+file,sha(path.join(__dirname,file))])),...Object.fromEntries(sourceFiles.map(file=>[file,sha(path.join(root,file))]))});
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-insight-'));
  try{
    const result=require('node:child_process').spawnSync(process.env.SYNK_INSIGHT_ELECTRON||require('electron'),[__filename,'--profile='+profile],{cwd:__dirname,windowsHide:true,encoding:'utf8',timeout:600000,maxBuffer:67108864});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1500)};
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-result.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests}));if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-insight-'))throw Error('Unsafe temporary profile');
    try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});}catch(error){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-profile-cleanup.json'),JSON.stringify({profile,error:error.code,scope:'Only this isolated test profile; the installed SYNK profile was never used.'},null,2)+'\n');}
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require(path.join(root,'src/native-content.cjs')),{preferences}=require(path.join(root,'src/security.cjs')),{signedIn,activityDocument}=require('./member-insight-fixture.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-insight-'))require('./electron-child-guard.cjs').refuse(__filename,'Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[],screenshots=[],popupIntents=[],captureRecoveries=[],knownIssues=[],sourceHashes=fingerprints();
    const check=(name,ok,details={})=>{checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    try{
      fs.mkdirSync(out,{recursive:true});Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('member-insight-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(new URL(details.url).origin+new URL(details.url).pathname);callback({cancel:true});});
      window=new BrowserWindow({width:1440,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'member-insight-fixture.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(details=>{popupIntents.push(details.url);return {action:'deny'};});window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      const run=script=>window.webContents.executeJavaScript(script),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const until=async(expression,limit=240)=>{for(let n=0;n<limit;n++){if(await run(expression))return;await pause(35);}throw Error('Timed out: '+expression);};
      const ready=status=>until('document.querySelector("[data-insight-status='+status+']")!==null');
      const text=()=>run('document.querySelector(".member-insight").innerText');
      const capture=async(name,width,theme='night',scrollTarget=null)=>{
        window.setContentSize(width,960);await run('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.getElementById("main").scrollTop=0;document.fonts.ready');
        if(scrollTarget)await run('document.querySelector('+JSON.stringify(scrollTarget)+').scrollIntoView({block:"start"})');
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
        const dimensions=await run('(()=>{const m=document.getElementById("main");const edge=m.getBoundingClientRect().left+m.clientWidth;return {width:innerWidth,page:document.documentElement.scrollWidth,main:m.scrollWidth,mainWidth:m.clientWidth,past:[...m.querySelectorAll("*")].filter(node=>node.getBoundingClientRect().right>edge+.5&&node.getClientRects().length).slice(0,8).map(node=>node.tagName+"."+node.className+" "+Math.round(node.getBoundingClientRect().right))};})()');
        // product-issue: the floor grid minimum is 300px. The PC window cannot get this narrow (minWidth 960); anything else that overflows still fails.
        const known=dimensions.width<360&&dimensions.main>dimensions.mainWidth&&dimensions.past.length>0&&dimensions.past.every(node=>/^(DETAILS.mi2-fold( mi2-history)?|DIV.mi2-consent) /.test(node));
        if(known)knownIssues.push({name,...dimensions});
        check(name+' no horizontal overflow',dimensions.page<=dimensions.width&&(dimensions.main<=dimensions.mainWidth||known),{...dimensions,...(known?{knownIssue:'mi2-floor-300px'}:{})});
        check(name+' heading rendered',await run('document.querySelector("h1#benefit-title")?.getBoundingClientRect().width>0'));
      };
      const atlasReads=()=>run('window.__synkFixture.calls().filter(c=>c.operation==="atlasSummary").length');
      // Waits for the read this refresh caused, so an earlier ready screen is never mistaken for its result.
      const refresh=async(status='ready')=>{const before=await atlasReads();await run('document.querySelector("[data-insight-action=refresh]").click()');await until('window.__synkFixture.calls().filter(c=>c.operation==="atlasSummary").length>'+before);await ready(status);};
      const setMode=mode=>run('window.__synkFixture.setMode('+JSON.stringify(mode)+')');
      const setActivityMode=mode=>run('window.__synkFixture.setActivityMode('+JSON.stringify(mode)+')');
      const openInsight=()=>run('document.querySelector(".nav-links [data-view=benefits]").click();document.querySelector("[data-benefit=insight]").click()');
      await window.loadURL('synk-desktop://platform/index.html');await until('document.documentElement.dataset.ready==="true"');
      await run('document.querySelector(".nav-links [data-view=benefits]").click();document.querySelector("[data-benefit=insight]").click()');await ready('signed-out');
      check('signed-out never reads Atlas',await run('!window.__synkFixture.calls().some(c=>c.operation==="atlasSummary")'));await capture('native-signed-out-320',320);
      await run('document.querySelector("[data-insight-action=account]").click()');check('account action opens existing account dialog',await run('document.getElementById("account-dialog").open'));await run('document.getElementById("account-dialog").close()');
      await run('window.__synkFixture.switchAccount('+JSON.stringify(signedIn('A',1))+')');await openInsight();await ready('ready');
      check('both report areas visible',(await text()).includes('내가 고른 것')&&(await text()).includes('내가 해본 것'));
      check('synthetic account A learning appears',(await text()).includes('합성 A 짧은 안내 듣기'));
      await until('document.querySelector("[data-insight-action=enable-activity]:not([disabled])")!==null');
      check('app observations default off without writes',await run('!window.__synkFixture.activityState().consent&&!window.__synkFixture.calls().some(c=>c.operation==="insightSave")'));
      await understandingScenarios.sparseSummaryScenario({run,until,inspect:()=>run('window.__synkFixture.understandingState()'),inspectActivity:()=>run('window.__synkFixture.activityState()'),
        writeCount:()=>run('window.__synkFixture.calls().filter(c=>/Save$|Delete$/.test(c.operation)).length'),setLearning:setMode,refresh,capture,check,prefix:'native'});
      await run('document.querySelector("[data-insight-action=enable-activity]").click()');await until('document.querySelector("[data-insight-action=disable-activity]:not([disabled])")!==null');
      check('opt-in stores explicit consent with no observations',await run('window.__synkFixture.activityState().consent&&window.__synkFixture.activityState().eventCount===0'));
      check('newly enabled app use says it is on with no opening to compare',(await text()).includes('앱 이용 기록 켜짐')&&!(await text()).includes('앱을 연 날'));
      await run('document.querySelector(".nav-links [data-view=home]").click();if(document.querySelector("[data-library-panel]").hidden)document.querySelector("[data-panel-toggle]").click()');await until('document.querySelector("[data-cloud=enable]:not([disabled])")?.getBoundingClientRect().width>0');await run('document.querySelector("[data-cloud=enable]").click()');await until('document.querySelector("[data-cloud=favorite][data-id=world]:not([disabled])")?.getBoundingClientRect().width>0');await run('document.querySelector("[data-cloud=favorite][data-id=world]").click()');await until('window.__synkFixture.activityState().favorites.includes("world")');
      check('account-library star synchronizes declared favorite without counting an app opening',await run('window.__synkFixture.libraryState().favorites.includes("world")&&window.__synkFixture.activityState().eventCount===0'));await run('document.querySelector("[data-panel-toggle][aria-expanded=true]").click()');await openInsight();await ready('ready');
      await run('window.__synkFixture.setLaunchAllowed(false);document.querySelector("[data-insight-action=activity][data-insight-target=world]").click()');await pause(80);
      check('failed native launch does not create an observation',await run('window.__synkFixture.activityState().eventCount===0'));await run('window.__synkFixture.setLaunchAllowed(true)');
      await run('document.querySelector("[data-insight-action=activity][data-insight-target=world]").click()');await until('window.__synkFixture.activityState().eventCount===1');
      check('WORLD selector uses successful mock launch before one observation',await run('window.__synkFixture.calls().some(c=>c.operation==="launch"&&c.target==="world")&&window.__synkFixture.activityState().eventCount===1'));
      await run('document.querySelector("[data-insight-action=disable-activity]").click()');await until('document.querySelector("[data-insight-action=enable-activity]:not([disabled])")!==null');
      check('opt-out clears accumulated observations and UI',await run('!window.__synkFixture.activityState().consent&&window.__synkFixture.activityState().eventCount===0')&&(await run('document.querySelector(".mi2-consent").innerText')).includes('앱 이용 기록도 볼까요?')&&!(await text()).includes('앱을 연 날'));
      await setActivityMode('repeated');await refresh();await until('document.querySelector(".mi2-consent")?.innerText.includes("3일 동안 3번")');
      check('repeated openings are said only inside the consent card',(await run('document.querySelector(".mi2-consent").innerText')).includes('WORLD'));
      await setActivityMode('populated');await refresh();await until('document.querySelector(".mi2-compare")?.innerText.includes("앱을 연 날")');
      const usage=await understandingScenarios.activityProjection(activityDocument('populated'));
      check('declared favorites and observed launches remain separate',usage.interests.some(row=>row.id==='world'&&row.kind==='favorite')&&usage.interests.some(row=>row.id==='path'&&row.kind==='opened'),{layer:'model'});
      const openingRow=await run('[...document.querySelectorAll(".mi2-compare tr")].find(row=>row.innerText.includes("앱을 연 날")).innerText');
      check('period comparison counts opening days and never calls them growth',/1일/.test(openingRow)&&/2일/.test(openingRow)&&!openingRow.includes('늘었어요'),{openingRow});
      check('exact comparison bounds are available',!!usage.periods.recent.from&&!!usage.periods.recent.to&&!!usage.periods.previous.from&&usage.periods.previous.to===usage.periods.recent.from,{layer:'model'});
      // A toast waits for window focus before its timer starts, and this window is never focused.
      await run('window.dispatchEvent(new Event("focus"))');await until('document.getElementById("toast").hidden',480);
      for(const theme of ['night','day'])for(const width of [1440,960,390,320]){await capture('native-enabled-'+theme+'-'+width,width,theme);await capture('native-activity-'+theme+'-'+width,width,theme,'.mi2-consent');await capture('native-periods-'+theme+'-'+width,width,theme,'.mi2-compare');await capture('native-learning-'+theme+'-'+width,width,theme,'.mi2-seen-block');}
      await understandingScenarios({run,until,click:selector=>run('document.querySelector('+JSON.stringify(selector)+').click()'),
        inspect:()=>run('window.__synkFixture.understandingState()'),setMode:mode=>run('window.__synkFixture.setUnderstandingMode('+JSON.stringify(mode)+')'),replace:value=>run('window.__synkFixture.replaceUnderstanding('+JSON.stringify(value)+')'),
        inspectMemory:()=>run('window.__synkFixture.memoryState()'),setMemoryMode:mode=>run('window.__synkFixture.setMemoryMode('+JSON.stringify(mode)+')'),
        setLearning:setMode,refresh,reenter:async()=>{await openInsight();await ready('ready');},capture,
        launch:async selector=>{const count=await run('window.__synkFixture.calls().filter(c=>c.operation==="launch").length');await run('document.querySelector('+JSON.stringify(selector)+').click()');await until('window.__synkFixture.calls().filter(c=>c.operation==="launch").length>'+count);check('confirmed topic WORLD button uses the existing native launch bridge',await run('window.__synkFixture.calls().filter(c=>c.operation==="launch").at(-1).target==="world"'));},check,prefix:'native'});
      await run('document.querySelector("[data-insight-action=jump]").click()');await until('document.querySelector("#mi2-why")?.open===true');const basis=await run('document.querySelector("#mi2-why").innerText');
      check('「왜 이렇게 봤나요?」 opens the basis on the same page',await run('location.href')==='synk-desktop://platform/index.html');
      check('evidence is available',basis.includes('혼자 답한 횟수에는 틀린 답도 들어 있어요')&&basis.includes('점수, 급수, 성격 유형은 매기지 않아요')&&basis.includes('메모나 고객 자료의 내용은 읽지 않아요'));await capture('native-evidence-390',390);
      const before=await atlasReads();await refresh();check('refresh reads original Atlas operation',await atlasReads()>before);
      await setMode('empty');await refresh();await until('!!document.querySelector("[data-mi2-kind=declared]")');check('a member with saved settings and no practice is told their choices, never empty',(await run('document.querySelector("#mi2-now-title").innerText')).includes('골랐어요')&&!(await text()).includes('합성 A'));
      await run('window.__synkFixture.clearMemory()');await refresh();await until('!!document.querySelector("[data-mi2-kind=empty]")');const emptyText=await text();check('empty clears previous results',!emptyText.includes('합성 A')&&emptyText.includes('기록이 없다고 실력이 없다는 뜻은 아니에요')&&emptyText.includes('WORLD에서 첫 연습 해 보기'));await capture('native-empty-320',320);
      await setActivityMode('repeated');await setMode('disabled');await refresh();await until('!!document.querySelector("[data-mi2-kind=disconnected]")');const disabled=await text();check('consent off suppresses practice and preferences',!disabled.includes('합성 A')&&!disabled.includes('단계별로 도와줘요')&&disabled.includes('한국 여행'));await capture('native-disabled-320',320);
      check('learning consent off preserves independently authorized app observations',(await run('document.querySelector(".mi2-consent").innerText')).includes('3일 동안 3번')&&await run('!!document.querySelector("[data-insight-action=disable-activity]")'));
      await run('document.querySelector("[data-insight-action=account]").click()');await until('document.getElementById("view-account").hidden===false');check('signed-in account action opens the in-app account page without navigating externally',popupIntents.length===0&&!requests.length);await openInsight();await ready('ready');
      await setMode('enabled');await setActivityMode('partial');await refresh();await until('!!document.querySelector(".mi2-compare table")');const partial=await run('document.querySelector(".mi2-compare").innerText');check('partial activity coverage does not produce delta',!partial.includes('앱을 연 날')&&partial.includes('답한 횟수'));await capture('native-partial-320',320);
      for(const mode of ['malformed','error']){await setActivityMode(mode);await refresh();await until('document.querySelector(".mi2-consent")?.innerText.includes("불러오지 못했어요")');check(mode+' activity fails closed without hiding valid learning',(await text()).includes('합성 A')&&await run('!document.querySelector("[data-insight-action=enable-activity],[data-insight-action=disable-activity]")'));await capture('native-activity-'+mode+'-320',320);}
      await setActivityMode('populated');
      await setMode('error');await refresh('error');check('failed read clears prior personal result',!(await text()).includes('한국 여행'));await capture('native-error-320',320);
      await setMode('enabled');await refresh();
      // What A chose must not follow the session into B.
      await run('window.__synkFixture.replaceUnderstanding('+JSON.stringify({version:1,reviews:[],overrides:[{id:'00000000-0000-4000-8000-0000000000a1',facetId:'topics',values:['ai-tools'],note:'A의 합성 메모',at:new Date().toISOString()}]})+')');await refresh();await until('document.querySelector("[data-insight-row=topics]")?.innerText.includes("AI 도구 활용")');
      await run('window.__synkFixture.holdNext();document.querySelector("[data-insight-action=refresh]").click()');await until('window.__synkFixture.pendingCount()===1');await run('window.__synkFixture.switchAccount('+JSON.stringify(signedIn('B',2))+')');await openInsight();await until('document.querySelector(".member-insight")?.innerText.includes("합성 B 짧은 안내 듣기")');await run('window.__synkFixture.releaseHeld()');await pause(80);
      check('late A response cannot replace B',(await text()).includes('합성 B')&&!(await text()).includes('합성 A'));await capture('native-account-B-390',390);
      check('account B does not inherit A observation consent',await run('!window.__synkFixture.activityState().consent&&document.querySelector(".mi2-consent").innerText.includes("앱 이용 기록도 볼까요?")'));
      const accountB=await text();check('account B sees none of A’s choices, notes or history',!accountB.includes('AI 도구 활용')&&!accountB.includes('A의 합성 메모')&&await run('!document.querySelector(".mi2-history")&&window.__synkFixture.understandingState().overrides===0'));
      await run('window.__synkFixture.switchAccount({configured:true,status:"signed-out",signedIn:false,sessionGeneration:3})');await openInsight();await ready('signed-out');check('sign-out removes prior account content',!(await text()).includes('합성 B'));
      // The signed-out account action reaches the disabled login stub once; the in-app account page reads its own two views.
      check('the signed-out account action only reached the disabled login stub',await run('window.__synkFixture.calls().filter(c=>c.operation==="login").length===1'));
      check('only scoped synthetic reads, consent/favorite/correction writes and WORLD mock launch invoked',await run('window.__synkFixture.calls().every(c=>["login","accountView","townRecords","load","platformLoad","platformSave","atlasSummary","insightLoad","insightSave","understandingLoad","understandingSave","understandingDelete","memoryGet","memoryPost"].includes(c.operation)||(c.operation==="launch"&&c.target==="world"))'));
      check('Atlas receives no caller identity or arbitrary scope',await run('window.__synkFixture.calls().filter(c=>c.operation==="atlasSummary").every(c=>c.keys.length===0)'));
      await run('document.querySelector(".mi2-back").click()');check('back returns to benefits overview',await run('!document.getElementById("benefits-overview").hidden&&document.getElementById("benefit-detail").hidden'));
      check('window remained hidden',!window.isVisible());check('no remote requests',!requests.length);check('no renderer console errors',!errors.length);
      check('tested source files did not change during execution',JSON.stringify(sourceHashes)===JSON.stringify(fingerprints()));
      process.stdout.write(prefix+JSON.stringify({ok:true,checkedOn:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),scope:'Actual hidden Electron renderer; synthetic Atlas, learning memory and consent IPC with isolated temporary profile; 1440/960/390/320 night/day (real window minimum 960). WORLD launch returns a fixture success without starting any app. No live account, installed profile, AI or publication.',checks,consoleErrors:errors,requests,screenshots,popupIntents,captureRecoveries,knownIssues,sourceHashes})+'\n');window.destroy();app.exit(0);
    }catch(error){const state=window&&!window.isDestroyed()?await window.webContents.executeJavaScript('({hidden:document.hidden,status:document.querySelector("[data-insight-status]")?.dataset.insightStatus,text:document.querySelector(".member-insight")?.innerText,calls:window.__synkFixture?.calls()})').catch(()=>null):null;process.stdout.write(prefix+JSON.stringify({ok:false,error:error.stack,state,checks,consoleErrors:errors,requests,screenshots,popupIntents,captureRecoveries,knownIssues})+'\n');window?.destroy();app.exit(1);}
  });
}
