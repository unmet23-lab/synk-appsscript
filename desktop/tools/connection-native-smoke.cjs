'use strict';
// Hidden native QA. No TCP server, account service, saved profile, installer or real client process.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts/connection-recovery-20261008'),prefix='SYNK_CONNECTION_QA ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-connection-'));
  fs.mkdirSync(artifacts,{recursive:true});
  try{
    const run=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:90000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-2500)};
    report.processExitCode=run.status;
    if(run.status!==0)report.ok=false;
    const reportPath=path.join(artifacts,'native-connection.json');
    if(fs.existsSync(reportPath)){const previous=JSON.parse(fs.readFileSync(reportPath,'utf8'));if(!previous.ok)fs.copyFileSync(reportPath,path.join(artifacts,'native-connection-failure-'+Date.now()+'.json'));}
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(item=>!item.ok),error:report.error,fixtureRequests:report.fixtureRequests?.length,unexpectedRequests:report.unexpectedRequests,consoleErrors:report.consoleErrors},null,2)+'\n');
    if(!report.ok)process.exitCode=1;
  }finally{
    const resolved=path.resolve(profile);
    if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('synk-connection-')||fs.realpathSync(resolved)!==resolved)throw Error('Unsafe temporary QA profile');
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu,ipcMain}=require('electron');
  const {preferences,assertSender,allowedNavigation}=require('../src/security.cjs');
  const {createConnectionContent}=require('../src/connection-content.cjs');
  const {createConnectionRecovery,STATUS_URL}=require('../src/connection-recovery.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-connection-'))throw Error('Isolated QA profile required');
  const entry='https://world.preview.invalid/entry';
  for(const directory of ['appData','userData','session'])fs.mkdirSync(path.join(profile,directory),{recursive:true});
  app.enableSandbox();app.setName('SYNK Connection Synthetic QA');app.setPath('appData',path.join(profile,'appData'));app.setPath('userData',path.join(profile,'userData'));app.setPath('sessionData',path.join(profile,'session'));
  app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window,recovery;const checks=[],fixtureRequests=[],unexpectedRequests=[],assets=[],consoleErrors=[],expectedFailures=[],blockedNavigation=[];let fixtureAvailable=false;
    const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
    try{
      Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('connection-synthetic-'+Date.now());
      isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      const connection=createConnectionContent({appRoot:root,clientId:'world',mode:'release',entry,productName:'SYNK WORLD'});
      isolated.protocol.handle('synk-desktop',async request=>{const response=await connection(request);assets.push({url:request.url,status:response.status,mime:response.headers.get('content-type')});return response;});
      isolated.protocol.handle('https',request=>{
        if(request.url!==entry){unexpectedRequests.push(request.url);return Response.error();}
        fixtureRequests.push({url:request.url,available:fixtureAvailable});
        return fixtureAvailable?new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>WORLD 연결 성공 · 합성 검사</title><main id="fixture-ready"><h1>연결되었습니다</h1><p>합성 화면입니다.</p></main></html>',{headers:{'content-type':'text/html; charset=utf-8','content-security-policy':"default-src 'none'; frame-ancestors 'none'"}}):Response.error();
      });
      isolated.protocol.handle('http',request=>{unexpectedRequests.push(request.url);return Response.error();});
      isolated.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(details,callback)=>{unexpectedRequests.push(details.url);callback({cancel:true});});
      window=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(root,'src/preload.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      window.webContents.on('console-message',details=>{if(details.level==='error'){const message=String(details.message);if(message.includes('UNTRUSTED_SENDER'))expectedFailures.push(message);else consoleErrors.push(message);}});
      window.webContents.on('did-fail-load',(_event,errorCode,errorDescription,validatedURL,isMainFrame)=>expectedFailures.push({errorCode,errorDescription,url:validatedURL,isMainFrame}));
      recovery=createConnectionRecovery({contents:window.webContents,entry});
      // The regular navigation guard remains in place; recovery must handle only its fixed entry.
      window.webContents.on('will-navigate',(event,url)=>{if(!allowedNavigation(url,entry,'world')){event.preventDefault();blockedNavigation.push(url);}});
      ipcMain.handle('synk:auth-status',event=>{assertSender(event,window,entry,'world');return {status:'synthetic-only',signedIn:false};});
      const run=script=>window.webContents.executeJavaScript(script);
      const waitFor=async(predicate,label)=>{for(let attempt=0;attempt<200;attempt++){try{if(await predicate())return;}catch{}await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Timed out: '+label);};
      const settle=async()=>{await run('document.fonts.ready');window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,140));};
      const linkExpression=`[...document.querySelectorAll('a[href]')].find(node=>node.href===${JSON.stringify(entry)})`;
      const capture=async name=>{await settle();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,160));const target=path.join(artifacts,name+'.png');fs.writeFileSync(target,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return target;};
      const initial=await recovery.connect();
      await waitFor(()=>run('document.readyState==="complete"'),'initial connection page');
      check('initial-failure-shows-status',initial===false&&window.webContents.getURL()===STATUS_URL,{url:window.webContents.getURL(),fixtureRequests:fixtureRequests.length});
      check('fixed-entry-retry-link',await run(`!!(${linkExpression})&&(${linkExpression}).getAttribute('href')===${JSON.stringify(entry)}`));
      const auth=await run("window.synkDesktop.authStatus().then(value=>({resolved:true,value}),error=>({resolved:false,error:String(error)}))");
      check('status-auth-ipc-remains-untrusted',auth.resolved===false&&auth.error.includes('UNTRUSTED_SENDER'),auth);
      check('node-integration-disabled',await run("typeof require==='undefined'&&typeof process==='undefined'"));
      for(const width of [1280,390,320]){
        window.setContentSize(width,900);await settle();
        const layout=await run(`(async()=>{const backgrounds=[...document.querySelectorAll('*')].map(node=>getComputedStyle(node).backgroundImage).filter(value=>value&&value!=='none').flatMap(value=>[...value.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)].map(match=>match[1]));const images=await Promise.all([...new Set(backgrounds)].map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({src,loaded:image.naturalWidth>0});image.onerror=()=>resolve({src,loaded:false});image.src=src;})));return {width:innerWidth,pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),bodyOverflow:Math.max(0,document.body.scrollWidth-innerWidth),fonts:[...document.fonts].map(font=>({family:font.family,status:font.status})),images,inlineImages:[...document.images].map(image=>({src:image.currentSrc,loaded:image.complete&&image.naturalWidth>0})),hasRetry:!!(${linkExpression})};})()`);
        const fontsReady=layout.fonts.some(font=>font.status==='loaded'),feltReady=layout.images.some(image=>/\.(webp|avif|png)(?:[?#]|$)/.test(image.src)&&image.loaded)&&layout.images.every(image=>image.loaded);
        check('connection-layout-'+width,layout.width===width&&!layout.pageOverflow&&!layout.bodyOverflow&&layout.hasRetry&&fontsReady&&feltReady&&layout.inlineImages.every(image=>image.loaded),{...layout,fontsReady,feltReady,screenshot:await capture('world-offline-'+width)});
      }
      await run('document.activeElement?.blur()');
      let keyboardReached=false;
      for(let attempt=0;attempt<8;attempt++){window.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});await new Promise(resolve=>setTimeout(resolve,40));if(await run(`document.activeElement===(${linkExpression})`)){keyboardReached=true;break;}}
      check('retry-link-keyboard-tab',keyboardReached);
      const failureCount=fixtureRequests.length;
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
      await waitFor(()=>fixtureRequests.length>failureCount&&window.webContents.getURL()===STATUS_URL,'keyboard retry failure');
      await settle();
      check('retry-failure-keeps-connection-help',await run(`location.href===${JSON.stringify(STATUS_URL)}&&!!(${linkExpression})`),{fixtureRequests:fixtureRequests.length,screenshot:await capture('world-retry-failed-320')});
      fixtureAvailable=true;
      await run(`(${linkExpression}).click()`);
      await waitFor(()=>run("!!document.getElementById('fixture-ready')"),'retry successful fixture');
      check('retry-success-opens-only-fixed-entry',window.webContents.getURL()===entry&&fixtureRequests.every(request=>request.url===entry),{url:window.webContents.getURL()});
      const healthyCount=fixtureRequests.length,healthy=await recovery.retryIfDisconnected();
      check('second-instance-healthy-is-noop',healthy===false&&fixtureRequests.length===healthyCount);
      fixtureAvailable=false;await recovery.connect();await waitFor(()=>window.webContents.getURL()===STATUS_URL,'second connection failure');
      fixtureAvailable=true;const reopened=await recovery.retryIfDisconnected();await waitFor(()=>run("!!document.getElementById('fixture-ready')"),'second instance reconnection');
      check('second-instance-reconnects-from-status',reopened===true&&window.webContents.getURL()===entry);
      check('no-unexpected-network-request',unexpectedRequests.length===0,{unexpectedRequests});
      check('window-hidden',!window.isVisible());
      const report={ok:checks.every(item=>item.ok)&&consoleErrors.length===0,checkedAt:new Date().toISOString(),scope:'Hidden Electron with isolated temporary AppData, fixed synthetic HTTPS protocol responses and real security/preload/recovery/content modules. No TCP server, account service, real login, installed application launch or installer.',checks,fixtureRequests,unexpectedRequests,assets,consoleErrors,expectedFailures,blockedNavigation,profileIsolated:true,serverStarted:false,realAccountRead:false};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');recovery.dispose();window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checkedAt:new Date().toISOString(),checks,fixtureRequests,unexpectedRequests,assets,consoleErrors,expectedFailures,blockedNavigation,profileIsolated:true,serverStarted:false,realAccountRead:false})+'\n');recovery?.dispose();window?.destroy();app.exit(1);}
  });
}
