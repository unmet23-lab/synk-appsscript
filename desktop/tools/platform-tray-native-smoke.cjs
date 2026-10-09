'use strict';

// A source-only Windows check. Every window, tray icon, draft and browser
// session below belongs to this short-lived isolated Electron process.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),prefix='SYNK_PLATFORM_TRAY_QA ';
const argument=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const requestedOut=path.resolve(argument('out')||path.join(root,'..','docs','_ops','qa','platform-tray-20261009','native.json'));
const out=path.extname(requestedOut)==='.json'?requestedOut:path.join(requestedOut,'native.json');

if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-platform-tray-'));
  try{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,env,encoding:'utf8',timeout:45000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1800)};
    report.electronExitCode=result.status;
    report.electronExitedNormally=result.status===0&&!result.error;
    report.ok=!!report.ok&&report.electronExitedNormally;
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(value=>!value.ok),error:report.error,electronExitCode:result.status,report:out},null,2));
    if(!report.ok)process.exitCode=1;
  }finally{
    const resolved=path.resolve(profile);
    if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('synk-platform-tray-'))throw Error('Unsafe temporary profile');
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,Tray,Menu,session}=require('electron');
  const {createPlatformTray}=require('../src/platform-tray.cjs');
  const {installDraftExitGuard}=require('../src/draft-exit.cjs');
  const profile=argument('profile');
  if(!profile||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-platform-tray-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setName('SYNK tray isolated QA');app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'Session'));
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let win,controller,nativeTray,nativeMenu,nativeChoice=0,beforeQuitCount=0,nativeBeforeUnload=0,stage='startup',reported=false;
    const checks=[],requests=[],errors=[],prompts=[];
    const hashes=Object.fromEntries(['src/platform-tray.cjs','src/draft-exit.cjs','src/main.cjs','tools/platform-tray-native-smoke.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
    const report=(ok,error)=>{
      if(reported)return;reported=true;
      process.stdout.write(prefix+JSON.stringify({ok,error,checkedOn:'2026-10-09',scope:'Isolated source Electron BrowserWindow, native Tray and native Menu; transparent taskbar-hidden QA window; synthetic DOM draft; no original profile, login, external requests, application install or release.',hashes,checks,requests,errors,nativePrompts:prompts.length,nativeBeforeUnload,beforeQuitCount})+'\n');
    };
    const cleanup=()=>{controller?.dispose();if(nativeTray&&!nativeTray.isDestroyed())nativeTray.destroy();if(win&&!win.isDestroyed())win.destroy();};
    const fail=error=>{report(false,error?.message||String(error));cleanup();app.exit(1);};
    const watchdog=setTimeout(()=>fail(Error('TIMEOUT_AT_'+stage)),30000);
    const check=(name,ok,details={})=>{stage=name;checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const until=async predicate=>{for(let i=0;i<150;i++){if(await predicate())return true;await pause(20);}return false;};
    try{
      check('windows-native-environment',process.platform==='win32',{platform:process.platform,electron:process.versions.electron});
      Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('platform-tray-synthetic');
      isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      win=new BrowserWindow({width:480,height:300,show:false,opacity:0,skipTaskbar:true,frame:false,title:'SYNK isolated tray QA',webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
      win.webContents.on('console-message',event=>{if(event.level==='error')errors.push({stage,message:event.message});});
      installDraftExitGuard({contents:win.webContents,window:win,dialog:{showMessageBoxSync(_window,options){prompts.push({stage,message:options.message,choice:nativeChoice});return nativeChoice;}}});
      const CapturedTray=new Proxy(Tray,{construct(Target,args){nativeTray=Reflect.construct(Target,args);return nativeTray;}});
      controller=createPlatformTray({app,Tray:CapturedTray,Menu:{buildFromTemplate(template){nativeMenu=Menu.buildFromTemplate(template);return nativeMenu;}},icon:path.join(root,'assets','platform.ico'),productName:'SYNK tray isolated QA',getWindow:()=>win,createWindow:()=>{throw Error('Unexpected recreation of retained window');},enabled:true});
      controller.attachWindow(win);
      win.webContents.on('will-prevent-unload',()=>{nativeBeforeUnload++;});
      app.on('before-quit',()=>{beforeQuitCount++;});
      check('real-native-tray-and-menu-created',controller.isActive()&&nativeTray instanceof Tray&&nativeMenu instanceof Menu&&!nativeTray.isDestroyed());
      check('native-menu-has-open-and-explicit-exit',nativeMenu.items[0].label==='SYNK 플랫폼 열기'&&nativeMenu.items.at(-1).label==='완전히 종료');
      const html='<!doctype html><html lang="ko"><meta charset="utf-8"><title>합성 초안 검증</title><body><input id="draft"><script>window.__documentToken="synthetic-retained-document";window.__beforeUnloadCount=0;addEventListener("beforeunload",event=>{window.__beforeUnloadCount++;if(document.getElementById("draft").value){event.preventDefault();event.returnValue=false;}});</script></body></html>';
      await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
      const retainedWindow=win,retainedContents=win.webContents,retainedId=win.id,draft='닫기 뒤에도 남아 있어야 하는 합성 초안';
      const run=source=>win.webContents.executeJavaScript(source);
      await run('document.getElementById("draft").value='+JSON.stringify(draft));
      const retained=async()=>win===retainedWindow&&win.id===retainedId&&win.webContents===retainedContents&&!win.isDestroyed()&&await run('document.getElementById("draft").value==='+JSON.stringify(draft)+'&&window.__documentToken==="synthetic-retained-document"');
      win.showInactive();win.close();await pause(60);
      check('native-close-hides-and-retains-window-and-dom',!win.isVisible()&&await retained());
      check('native-close-keeps-draft-without-unload-or-dialog',prompts.length===0&&nativeBeforeUnload===0&&await run('window.__beforeUnloadCount===0'));
      nativeTray.emit('click');
      check('native-tray-click-restores-same-draft',win.isVisible()&&await retained());win.hide();
      nativeTray.emit('double-click');
      check('native-tray-double-click-restores-same-draft',win.isVisible()&&await retained());win.hide();
      nativeMenu.items[0].click();
      check('native-open-menu-restores-same-draft',win.isVisible()&&await retained());win.hide();
      win.showInactive();win.minimize();
      check('native-window-reaches-minimized-state',await until(()=>win.isMinimized()));
      nativeMenu.items[0].click();
      check('native-open-menu-restores-minimized-window',win.isVisible()&&!win.isMinimized()&&await retained());win.hide();
      stage='explicit-quit-keep';nativeMenu.items.at(-1).click();
      check('explicit-quit-keep-cancels-quitting',await until(()=>prompts.length===1&&!controller.isQuitting()));
      check('explicit-quit-keep-restores-hidden-draft',win.isVisible()&&await retained()&&nativeBeforeUnload===1&&beforeQuitCount===1);win.hide();
      win.close();await pause(60);
      check('native-close-after-quit-cancel-still-hides',!win.isVisible()&&!controller.isQuitting()&&await retained()&&prompts.length===1&&nativeBeforeUnload===1);
      check('synthetic-draft-never-requested-network',requests.length===0&&errors.length===0,{requests,errors});
      // The module's will-quit listener runs first. This listener records native
      // destruction without canceling the final real application quit.
      app.on('will-quit',()=>{
        try{
          check('explicit-discard-completes-real-quit',win.isDestroyed()&&controller.isQuitting()&&prompts.length===2&&nativeBeforeUnload===2&&beforeQuitCount===2);
          check('real-quit-destroys-native-tray',nativeTray.isDestroyed()&&!controller.isActive());
          clearTimeout(watchdog);report(true);
        }catch(error){clearTimeout(watchdog);fail(error);}
      });
      stage='explicit-quit-discard';nativeChoice=1;nativeMenu.items.at(-1).click();
    }catch(error){clearTimeout(watchdog);fail(error);}
  }).catch(error=>{process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message})+'\n');app.exit(1);});
}
