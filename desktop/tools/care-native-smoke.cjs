'use strict';
// Real, hidden Electron renderers with synthetic account rights and Blob exports.
// Requires only the local care server; never logs in, sends a message or calls AI.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts'),prefix='SYNK_CARE_NATIVE ',launcherOnly=process.argv.includes('--launcher-only');
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-care-native-'));
  try{
    const boot=launcherOnly?{}:require('node:child_process').spawnSync(require('electron'),[path.join(root,'src','product-main.cjs'),'--synk-product-preview=care','--synk-smoke'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000});
    const bootLine=boot.stdout?.split(/\r?\n/).find(value=>value.startsWith('SYNK_PRODUCT_SMOKE '));
    const nativeEntry=bootLine?JSON.parse(bootLine.slice('SYNK_PRODUCT_SMOKE '.length)):{ok:false,error:boot.error?.message||'NO_ENTRY_RESULT',stderr:boot.stderr?.slice(-1000)};
    const run=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile,...(launcherOnly?['--launcher-only']:[])],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1500)};
    if(!launcherOnly){report.nativeEntry=nativeEntry;report.ok=report.ok&&nativeEntry.ok===true;}
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,(launcherOnly?'care-launcher':'care-native')+'-20261005.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify(report,null,2)+'\n');if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-care-native-'))throw Error('Unsafe test profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron');
  const {createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const {PRODUCT_PREVIEWS,productPolicy,productResource,createProductDownloadHandler}=require('../src/product-preview.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-care-native-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let platformWindow,careWindow,completion;const checks=[],errors=[],blockedRequests=[],denied=[];
    const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
    const run=(window,script)=>window.webContents.executeJavaScript(script);
    const settle=async window=>{await run(window,"document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,120));};
    const ready=async window=>{for(let index=0;index<150;index++){if(await run(window,"document.documentElement.dataset.ready==='true'"))return;await new Promise(resolve=>setTimeout(resolve,40));}throw Error('READY_TIMEOUT');};
    const capture=async(window,name)=>{await settle(window);await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,120));fs.mkdirSync(artifacts,{recursive:true});const target=path.join(artifacts,name+'.png');fs.writeFileSync(target,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return target;};
    const observe=window=>{window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message.slice(0,250));});};
    try{
      Menu.setApplicationMenu(null);
      const launcherSession=session.fromPartition('care-launcher-synthetic');launcherSession.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      launcherSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{blockedRequests.push(details.url);callback({cancel:true});});
      platformWindow=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'renderer-account-fixture.cjs')),session:launcherSession,backgroundThrottling:false}});observe(platformWindow);
      await platformWindow.loadURL('synk-desktop://platform/index.html');await ready(platformWindow);
      check('guest-only-world',await run(platformWindow,"JSON.stringify([...document.querySelectorAll('[data-app]')].map(n=>n.dataset.app))==='[\"world\"]'"));
      await run(platformWindow,"window.__synkFixture.switchAccount({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'synthetic-care',display_name:'합성 플레저'},library:{status:'ready',appIds:['care']}})");
      for(const width of [1280,390,320]){
        platformWindow.setContentSize(width,900);await settle(platformWindow);
        const info=await run(platformWindow,"(()=>{const $=id=>document.getElementById(id),hero=$('hero').getBoundingClientRect(),text=document.querySelector('.hero-text').getBoundingClientRect();return {ids:[...document.querySelectorAll('[data-app]')].map(n=>n.dataset.app),selected:$('breadcrumb-app').textContent,action:$('primary-action').dataset.action,disabled:$('primary-action').disabled,pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,$('main').scrollWidth-$('main').clientWidth),heroTextFits:text.top>=hero.top&&text.bottom<=hero.bottom&&text.right<=hero.right,imagesLoaded:[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0)};})()");
        check('care-library-'+width,JSON.stringify(info.ids)==='["care"]'&&info.selected==='SYNK 플레저'&&info.action==='product-preview'&&!info.disabled&&!info.pageOverflow&&!info.mainOverflow&&info.heroTextFits&&info.imagesLoaded,{...info,screenshot:await capture(platformWindow,'platform-care-'+width)});
      }
      await run(platformWindow,"document.getElementById('primary-action').click()");await settle(platformWindow);
      check('care-action-uses-product-preview',await run(platformWindow,"JSON.stringify(window.__synkFixture.calls())==='[\"product-preview:care\"]'"));
      await run(platformWindow,"window.__synkFixture.switchAccount({configured:true,status:'signed-in',signedIn:true,sessionGeneration:2,account:{synk_user_id:'synthetic-student'},library:{status:'ready',appIds:['world']}})");
      check('account-switch-hides-care',await run(platformWindow,"!document.querySelector('[data-app=care]')&&document.getElementById('breadcrumb-app').textContent==='SYNK WORLD'"));
      if(launcherOnly){const report={ok:checks.every(item=>item.ok)&&errors.length===0&&blockedRequests.length===0,checkedOn:'2026-10-05',scope:'Hidden Electron: actual launcher with synthetic care menu right; no product launch, live authentication or network.',checks,consoleErrors:errors,blockedRequests};process.stdout.write(prefix+JSON.stringify(report)+'\n');platformWindow.destroy();app.exit(report.ok?0:1);return;}
      const careSession=session.fromPartition('care-product-synthetic');careSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));careSession.setPermissionCheckHandler(()=>false);
      careSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','file://*/*']},(details,callback)=>{const denied=!productResource('care',details.url);if(denied)blockedRequests.push(details.url);callback({cancel:denied});});
      careSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[productPolicy()]}}));
      careSession.on('will-download',createProductDownloadHandler({id:'care',getWindow:()=>careWindow,configureSave(item){const target=path.join(profile,item.getFilename());item.setSavePath(target);item.once('done',(_event,state)=>completion?.({state,filename:item.getFilename(),text:fs.existsSync(target)?fs.readFileSync(target,'utf8'):null}));},onDenied:reason=>denied.push(reason)}));
      careWindow=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,webPreferences:{...preferences(),session:careSession,backgroundThrottling:false}});observe(careWindow);
      await careWindow.loadURL(PRODUCT_PREVIEWS.care.entry);await ready(careWindow);
      check('care-document-isolated',await run(careWindow,"typeof require==='undefined'&&typeof synkDesktop==='undefined'&&document.querySelectorAll('iframe,webview').length===0"));
      for(const [extension,mime,body]of [['ics','text/calendar','BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'],['json','application/json','{"synthetic":true}']]){
        const finished=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('DOWNLOAD_TIMEOUT_'+extension)),6000);completion=value=>{clearTimeout(timer);resolve(value);};});
        await run(careWindow,"(()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(["+JSON.stringify(body)+"],{type:"+JSON.stringify(mime+';charset=utf-8')+"}));a.download="+JSON.stringify('synk-care.'+extension)+";a.click();})()");
        const result=await finished;check('native-'+extension+'-save',result.state==='completed'&&result.text===body,{state:result.state,filename:result.filename});
      }
      check('windows-stay-hidden',!platformWindow.isVisible()&&!careWindow.isVisible());check('no-unexpected-downloads',denied.length===0,{denied});
      const report={ok:checks.every(item=>item.ok)&&errors.length===0&&blockedRequests.length===0,checkedOn:'2026-10-05',scope:'Hidden Electron: real launcher, synthetic care menu right, real local care document and production Blob download handler. No live authentication or messages.',checks,consoleErrors:errors,blockedRequests};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');platformWindow.destroy();careWindow.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checks,consoleErrors:errors,blockedRequests})+'\n');platformWindow?.destroy();careWindow?.destroy();app.exit(1);}
  });
}
