'use strict';
// Real startup window, gate, updater, and the exact main.cjs quit handlers.
// All remote bytes, identities, child installers and profiles are synthetic.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process'),{Readable}=require('node:stream'),{createHash}=require('node:crypto');
const desktop=path.resolve(__dirname,'..'),arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const output=path.resolve(arg('output')||path.join(desktop,'..','.tmp','platform-startup-quit-native'));
if(!process.versions.electron){
  fs.mkdirSync(output,{recursive:true});const results=[];
  for(const scenario of ['cold','draft','handoff-retry']){
    const out=path.join(output,scenario);fs.mkdirSync(out,{recursive:true});
    for(const leaf of ['appdata','localappdata','temp'])fs.mkdirSync(path.join(out,leaf),{recursive:true});
    const env={...process.env,APPDATA:path.join(out,'appdata'),LOCALAPPDATA:path.join(out,'localappdata'),TEMP:path.join(out,'temp'),TMP:path.join(out,'temp')};delete env.ELECTRON_RUN_AS_NODE;
    const run=spawnSync(require('electron'),[__filename,'--output='+out,'--scenario='+scenario],{cwd:desktop,windowsHide:true,env,encoding:'utf8',timeout:30000});
    fs.writeFileSync(path.join(out,'stdout.log'),run.stdout||'');fs.writeFileSync(path.join(out,'stderr.log'),run.stderr||'');
    let result;try{result=JSON.parse(fs.readFileSync(path.join(out,'result.json'),'utf8'));}catch{result={ok:false,error:run.error?.message||'NO_RESULT'};}
    const waitUntil=Date.now()+5000;while(!fs.existsSync(path.join(out,'child-result.json'))&&Date.now()<waitUntil)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30);
    let child;try{child=JSON.parse(fs.readFileSync(path.join(out,'child-result.json'),'utf8'));}catch{}
    results.push({...result,scenario,normalExit:run.status===0,child,ok:result.ok&&run.status===0&&child?.parentExited===true});
  }
  const report={ok:results.every(row=>row.ok),results};fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
}else{
  const {app,BrowserWindow,ipcMain,session,protocol}=require('electron');
  const {createPlatformUpdater,MANIFEST_URL}=require('../src/platform-update.cjs'),{createStartupUpdateGate}=require('../src/platform-startup-update.cjs');
  const {createStartupUpdateWindow}=require('../src/platform-startup-window.cjs'),{launchWindowsUpdate}=require('../src/platform-update-handoff.cjs'),{installDraftExitGuard}=require('../src/draft-exit.cjs');
  const scenario=arg('scenario');if(!['cold','draft','handoff-retry'].includes(scenario))throw Error('Synthetic scenario required');
  for(const leaf of ['appdata','profile','session'])fs.mkdirSync(path.join(output,leaf),{recursive:true});
  app.setPath('appData',path.join(output,'appdata'));app.setPath('userData',path.join(output,'profile'));app.setPath('sessionData',path.join(output,'session'));app.setName('SYNK Synthetic Startup Quit');app.enableSandbox();
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  const checks=[],events=[],errors=[],requests=[];let nativeStartup,mainWindow,answer=0,prompts=0,handoffs=0,handoffAttempts=0,proceeds=0,quitRequests=0,willQuits=0,finished=false,captureStartup=false;
  const context={app,quittingRequested:false,platformUpdate:null,startupGate:null,startupWindow:null,platformTray:undefined,window:undefined,createWindow:()=>{throw Error('Unexpected main creation');},pulseApp:undefined,pulseRequests:undefined,desktopPreferences:undefined,unbindTeacher:undefined,teacherService:undefined,suiteFollower:undefined,suitePublisher:undefined,auth:undefined,installations:undefined,connectionRecovery:undefined};
  const main=fs.readFileSync(path.join(desktop,'src/main.cjs'),'utf8'),start=main.indexOf("app.on('before-quit'"),end=main.indexOf('if(!app.requestSingleInstanceLock()',start);
  assert.ok(start>=0&&end>start);vm.createContext(context);vm.runInContext(main.slice(start,end),context,{filename:'actual-main-quit-handlers.cjs'});
  const hashes=Object.fromEntries(['src/main.cjs','src/platform-startup-window.cjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(desktop,file))).digest('hex')]));
  const check=(name,value)=>{checks.push({name,ok:!!value});assert.ok(value,name);};
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async predicate=>{const deadline=Date.now()+5000;while(Date.now()<deadline){if(await predicate())return true;await pause(20);}return false;};
  const fail=error=>{if(finished)return;finished=true;clearTimeout(deadline);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:false,checks,events,errors,requests,hashes,error:error.stack},null,2));app.exit(1);};
  const deadline=setTimeout(()=>fail(Error('Synthetic native quit timeout')),20000);
  app.on('window-all-closed',()=>{});
  app.on('before-quit',()=>events.push('before-quit'));
  app.on('will-quit',event=>{willQuits++;events.push('will-quit');if(!event.defaultPrevented){try{check('installer-handshake-once',handoffs===1);check('main-guards-retained',prompts===(scenario==='draft'?2:0));check('no-unexpected-main-init',proceeds===(scenario==='draft'?1:0));check('no-network-or-console-errors',!requests.length&&!errors.length);check('only-owned-hidden-windows',!BrowserWindow.getAllWindows().some(win=>win.isVisible()));check('handoff-before-final-normal-quit',willQuits===(scenario==='handoff-retry'?3:2));check('product-source-unchanged',Object.entries(hashes).every(([file,hash])=>createHash('sha256').update(fs.readFileSync(path.join(desktop,file))).digest('hex')===hash));finished=true;clearTimeout(deadline);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({ok:true,scenario,checks,events,errors,requests,prompts,handoffs,handoffAttempts,proceeds,quitRequests,hashes,host:{executable:process.execPath,pid:process.pid,profile:app.getPath('userData')}},null,2)+'\n');}catch(error){fail(error);}}});
  app.on('browser-window-created',(_event,win)=>{if(captureStartup)nativeStartup=win;win.show=()=>{};win.focus=()=>{};win.showInactive=()=>{};win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});});
  app.whenReady().then(async()=>{
    const bytes=Buffer.from('synthetic installer bytes only'),sha=createHash('sha256').update(bytes).digest('hex'),nonce='a'.repeat(64);
    const manifest={schemaVersion:1,product:'platform',channel:'preview',version:'0.4.10',buildId:'20261014.7',releaseId:'platform-preview-0.4.10',publishedAt:'2026-10-14T00:00:00.000Z',artifacts:[{platform:'win32',arch:'x64',url:'https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.10/synthetic.exe',bytes:bytes.length,sha256:sha,asarSHA256:'b'.repeat(64)}]};
    const childScript=path.join(output,'synthetic-wait-parent.cjs');fs.writeFileSync(childScript,"const fs=require('node:fs');const pid=Number(process.argv.find(v=>v.startsWith('--wait-pid=')).slice(11));const nonce=process.argv.find(v=>v.startsWith('--handoff-token=')).slice(16);process.stdout.write('SYNK_UPDATE_READY '+nonce+'\\n');let attempts=0;const timer=setInterval(()=>{try{process.kill(pid,0);}catch{clearInterval(timer);fs.writeFileSync(process.env.SYNK_UPDATE_TEST_RESULT,JSON.stringify({parentExited:true}));return;}if(++attempts>300){clearInterval(timer);process.exitCode=1;}},25);");
    context.platformUpdate=createPlatformUpdater({enabled:true,config:{manifestUrl:MANIFEST_URL,channel:'preview',releaseId:'platform-preview-0.4.7',buildId:'20261014.4'},currentVersion:'0.4.7',platform:'win32',arch:'x64',cacheRoot:path.join(output,'cache'),now:()=>Date.parse('2026-10-14T12:00:00Z'),onChange:value=>{events.push({updater:value.state,code:value.code});context.startupGate?.observe(value);},
      request:async url=>({status:200,headers:{},body:Readable.from([url===MANIFEST_URL?Buffer.from(JSON.stringify(manifest)):bytes])}),
      requestQuit:()=>{quitRequests++;check('installing-keeps-manual-close-disabled-'+quitRequests,!nativeStartup.isClosable());nativeStartup.close();setTimeout(()=>{try{check('manual-close-did-not-destroy-startup-'+quitRequests,!nativeStartup.isDestroyed());app.quit();}catch(error){fail(error);}},50);},
      openInstaller:async(_file,options)=>{handoffAttempts++;check('all-existing-windows-accepted-close-before-handoff',nativeStartup.isDestroyed()&&(!mainWindow||mainWindow.isDestroyed()));check('automatic-install-contract',options.automatic===true);if(scenario==='handoff-retry'&&handoffAttempts===1)throw Object.assign(Error('Synthetic handoff failure'),{updateCode:'UPDATE_HANDOFF_FAILED'});await launchWindowsUpdate({file:'synthetic-only',pid:process.pid,automatic:true,nonce,spawn:(_ignored,args,settings)=>spawn(process.execPath,[childScript,...args],{...settings,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',SYNK_UPDATE_TEST_RESULT:path.join(output,'child-result.json')}})});handoffs++;events.push('READY');}});
    const startGate=async()=>{
      context.startupGate?.dispose();context.startupWindow?.dispose();context.startupGate=createStartupUpdateGate({updater:context.platformUpdate,platform:'win32',onChange:value=>context.startupWindow?.publish(value),proceed:()=>{proceeds++;context.startupWindow?.dispose();}});
      captureStartup=true;
      context.startupWindow=createStartupUpdateWindow({BrowserWindow,session,ipcMain,appRoot:desktop,gate:context.startupGate,onClose:()=>{if(!context.quittingRequested){context.quittingRequested=true;app.quit();}}});context.startupWindow.show();
      nativeStartup.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      check('real-startup-renderer-ready-'+(quitRequests+1),await until(()=>nativeStartup.webContents.executeJavaScript("document.documentElement.dataset.startupReady==='true'")));
      await context.startupGate.start();check('gate-reaches-installing-'+quitRequests,context.startupGate.snapshot().state==='installing');
    };
    if(scenario==='draft'){
      mainWindow=new BrowserWindow({show:false,width:360,height:400,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});context.window=mainWindow;context.contents=mainWindow.webContents;context.isPlatform=true;
      installDraftExitGuard({window:mainWindow,contents:mainWindow.webContents,dialog:{showMessageBoxSync(){prompts++;return answer;}}});
      const cancelLine=main.split('\n').find(line=>line.includes("if(isPlatform)contents.on('will-prevent-unload'"));assert.ok(cancelLine);vm.runInContext(cancelLine,context);
      await mainWindow.loadURL('data:text/html,<title>synthetic draft</title>');await mainWindow.webContents.executeJavaScript('window.onbeforeunload=()=>false;true');
    }
    await startGate();
    if(scenario==='draft'){
      check('draft-cancel-observed',await until(()=>prompts===1&&proceeds===1));check('draft-cancel-preserved-main-and-prevented-handoff',!mainWindow.isDestroyed()&&handoffs===0&&willQuits===0&&context.platformUpdate.snapshot().state==='ready');check('cancel-resets-quitting-state',context.quittingRequested===false);answer=1;await startGate();
    }
    if(scenario==='handoff-retry'){
      check('failed-handoff-restores-startup-window',await until(()=>context.platformUpdate.snapshot().state==='error'&&nativeStartup&&!nativeStartup.isDestroyed()&&!nativeStartup.webContents.isLoading()));
      check('failed-handoff-resets-quit-state-and-close-policy',context.quittingRequested===false&&nativeStartup.isClosable()&&handoffs===0&&willQuits===1);
      check('recovery-actions-reach-real-renderer',await until(()=>nativeStartup.webContents.executeJavaScript("document.getElementById('startup-update').dataset.state==='error'&&!document.getElementById('startup-retry').hidden&&!document.getElementById('startup-open-current').hidden")));
      await context.startupGate.retry();
    }
  }).catch(fail);
}
