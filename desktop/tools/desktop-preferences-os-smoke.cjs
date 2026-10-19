'use strict';

// Real Windows startup registration and hotkey contention, using only a unique
// QA registry value and isolated Electron processes. No user input is sent.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {spawnSync,execFile}=require('node:child_process');
const root=path.resolve(__dirname,'..'),prefix='SYNK_PREFERENCES_OS_QA ';
const argument=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const RUN='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APPROVED='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';
const query=(key,name)=>spawnSync('reg.exe',['query',key,...(name?['/v',name]:[])],{windowsHide:true,encoding:'utf8'});
const digest=text=>crypto.createHash('sha256').update(text||'').digest('hex');
const snapshot=()=>Object.fromEntries([RUN,APPROVED].map(key=>{const result=query(key);return [key,{exists:result.status===0,digest:digest(result.stdout)}];}));
const isolatedPath=directory=>path.dirname(path.resolve(directory))===path.resolve(os.tmpdir())&&path.basename(directory).startsWith('synk-preferences-os-');

if(!process.versions.electron){
  if(process.platform!=='win32')throw Error('Windows-only verification');
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-preferences-os-'));
  const name='SYNK.QA.Convenience.'+crypto.randomUUID(),before=snapshot();
  const out=path.resolve(argument('out')||path.join(root,'..','docs','_ops','qa','platform-convenience-20261009','os-integration.json'));
  let report;
  try{
    if(query(RUN,name).status===0||query(APPROVED,name).status===0)throw Error('Unique QA startup name unexpectedly exists');
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const run=spawnSync(require('electron'),[__filename,'--profile='+profile,'--qa-name='+name],{cwd:root,windowsHide:true,env,encoding:'utf8',timeout:45000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1000)};
    report.electronExitCode=run.status;report.ok=!!report.ok&&run.status===0&&!run.error;
  }finally{
    // A failed or timed-out child must not leave its unique QA startup entry.
    // Never delete a key or enumerate another app's values for deletion.
    for(const key of [RUN,APPROVED])if(query(key,name).status===0)spawnSync('reg.exe',['delete',key,'/v',name,'/f'],{windowsHide:true,encoding:'utf8'});
    if(!isolatedPath(profile))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:30,retryDelay:200});
    const after=snapshot();
    report??={ok:false,error:'OUTER_RUN_FAILED'};
    report.cleanup={qaStartupRunValueAbsent:query(RUN,name).status!==0,qaStartupApprovedValueAbsent:query(APPROVED,name).status!==0,temporaryProfileRemoved:!fs.existsSync(profile),existingStartupRegistryUnchanged:JSON.stringify(before)===JSON.stringify(after),registryBefore:before,registryAfter:after};
    report.ok=report.ok&&Object.entries(report.cleanup).filter(([key])=>!key.startsWith('registry')).every(([,value])=>value===true);
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,cleanup:report.cleanup,report:out},null,2));
    if(!report.ok)process.exitCode=1;
  }
}else{
  const {app,globalShortcut,BrowserWindow,screen,session}=require('electron');
  const {createDesktopPreferences}=require('../src/desktop-preferences.cjs');
  const {createWindowPlacement}=require('../src/window-placement.cjs');
  const profile=argument('profile'),worker=argument('worker'),name=argument('qa-name');
  if(!profile||!isolatedPath(profile)||!/^SYNK\.QA\.Convenience\.[0-9a-f-]{36}$/.test(name||''))throw Error('Isolated profile and unique QA name required');
  const directory=worker?path.join(profile,'worker-'+worker):profile;
  fs.mkdirSync(directory,{recursive:true});
  app.enableSandbox();app.setName(name);app.setAppUserModelId(name);app.setPath('userData',directory);app.setPath('sessionData',path.join(directory,'Session'));app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    if(worker){
      const shortcut=argument('shortcut');let controller;
      try{
        controller=createDesktopPreferences({directory,app,globalShortcut,getWindow:()=>null,packaged:true,name});controller.initialize();
        let previous='';
        if(worker==='contention')for(const candidate of ['Control+Alt+Shift+F21','Control+Alt+Shift+F20','Control+Alt+Shift+F19'])if(controller.update({globalShortcut:candidate}).ok){previous=candidate;break;}
        const result=controller.update({globalShortcut:shortcut}),own=globalShortcut.isRegistered(shortcut);
        const previousPreserved=!!previous&&controller.snapshot().preferences.globalShortcut===previous&&globalShortcut.isRegistered(previous);
        controller.dispose();
        process.stdout.write(prefix+JSON.stringify({registered:result.ok,code:result.code,own,previousPreserved,released:!globalShortcut.isRegistered(shortcut)&&(!previous||!globalShortcut.isRegistered(previous))})+'\n');app.exit(0);
      }catch(error){controller?.dispose();globalShortcut.unregisterAll();process.stdout.write(prefix+JSON.stringify({error:error.message})+'\n');app.exit(1);}
      return;
    }
    let preferences,window,error;const checks=[],requests=[],details={};
    const check=(name,ok,extra={})=>{checks.push({name,ok:!!ok,...extra});if(!ok)throw Error(name);};
    // The module touches Windows startup only as a packaged build, so the controllers below say packaged.
    const startup={path:process.execPath,args:['--synk-autostart'],name};
    const runWorker=async mode=>{
      const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
      const result=await new Promise(resolve=>execFile(process.execPath,[__filename,'--profile='+profile,'--qa-name='+name,'--worker='+mode,'--shortcut='+details.shortcut],{cwd:root,windowsHide:true,env,encoding:'utf8',timeout:12000},(error,stdout,stderr)=>resolve({status:error?error.code:0,error,stdout,stderr})));
      const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
      if(!line||result.status!==0||result.error){details.workerFailure={mode,status:result.status,error:result.error?.message,stderr:result.stderr?.slice(-1000)};throw Error('Secondary Electron failed: '+mode);}
      return JSON.parse(line.slice(prefix.length));
    };
    const hashes=Object.fromEntries(['src/desktop-preferences.cjs','src/window-placement.cjs','tools/desktop-preferences-os-smoke.cjs'].map(file=>[file,digest(fs.readFileSync(path.join(root,file)))]));
    try{
      check('actual-windows-electron-runtime',process.platform==='win32',{electron:process.versions.electron});
      check('unique-qa-startup-entry-initially-absent',query(RUN,name).status!==0&&query(APPROVED,name).status!==0);
      const isolated=session.fromPartition('preferences-os-qa');isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      fs.writeFileSync(path.join(profile,'window-placement.json'),JSON.stringify({x:99990,y:99990,width:1440,height:940,maximized:true}));
      const placement=createWindowPlacement({directory:profile,screen}),bounds=placement.restore();
      const displays=screen.getAllDisplays();details.displayCount=displays.length;
      check('out-of-screen-saved-placement-fits-current-real-display',displays.some(({workArea:a})=>bounds.x>=a.x&&bounds.y>=a.y&&bounds.x+bounds.width<=a.x+a.width&&bounds.y+bounds.height<=a.y+a.height));
      window=new BrowserWindow({...bounds,show:false,skipTaskbar:true,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false}});
      placement.attach(window,{maximized:bounds.maximized});
      await window.loadURL('data:text/html,<title>SYNK isolated OS QA</title>');
      check('remembered-maximized-window-does-not-show-on-hidden-start',!window.isVisible()&&!window.isMaximized());
      preferences=createDesktopPreferences({directory:profile,app,globalShortcut,getWindow:()=>window,packaged:true,name});preferences.initialize();
      check('actual-windows-startup-initially-off',!preferences.snapshot().preferences.launchAtLogin);
      const enabled=preferences.update({launchAtLogin:true,startHidden:true});details.enableResult=enabled;
      check('module-enables-real-windows-login-item',enabled.ok&&enabled.preferences.launchAtLogin&&app.getLoginItemSettings(startup).openAtLogin===true);
      const registered=query(RUN,name);
      check('windows-run-registry-has-exact-qa-executable-and-autostart-arguments',registered.status===0&&registered.stdout.includes(process.execPath)&&registered.stdout.includes('--synk-autostart')&&!registered.stdout.includes('--synk-dev'));
      check('startup-write-does-not-show-hidden-window',!window.isVisible());
      const disabled=preferences.update({launchAtLogin:false});
      check('module-disables-real-windows-login-item',disabled.ok&&!disabled.preferences.launchAtLogin&&!app.getLoginItemSettings(startup).openAtLogin);
      check('module-removes-qa-run-value',query(RUN,name).status!==0);
      for(const shortcut of ['Control+Alt+Shift+F24','Control+Alt+Shift+F23','Control+Alt+Shift+F22'])if(preferences.update({globalShortcut:shortcut}).ok){details.shortcut=shortcut;break;}
      check('module-registers-uncommon-real-os-global-shortcut',!!details.shortcut&&globalShortcut.isRegistered(details.shortcut));
      check('shortcut-registration-does-not-show-window',!window.isVisible());
      const contention=await runWorker('contention');details.contention=contention;
      check('second-real-electron-process-cannot-register-occupied-shortcut',!contention.registered&&!contention.own&&contention.released);
      check('real-module-reports-collision-and-preserves-previous-hotkey',contention.code==='SHORTCUT_UNAVAILABLE'&&contention.previousPreserved);
      check('owner-retains-shortcut-after-contender-exits',globalShortcut.isRegistered(details.shortcut)&&preferences.snapshot().preferences.globalShortcut===details.shortcut);
      const off=preferences.update({globalShortcut:''});
      check('module-unregisters-real-os-global-shortcut',off.ok&&!globalShortcut.isRegistered(details.shortcut));
      const reuse=await runWorker('reuse');details.reuse=reuse;
      check('second-real-process-can-reuse-shortcut-after-release',reuse.registered&&reuse.own&&reuse.released);
      check('module-can-register-again-after-other-process-cleanup',preferences.update({globalShortcut:details.shortcut}).ok&&globalShortcut.isRegistered(details.shortcut));
      preferences.dispose();
      check('module-dispose-releases-shortcut',!globalShortcut.isRegistered(details.shortcut));
      preferences=createDesktopPreferences({directory:profile,app,globalShortcut,getWindow:()=>window,packaged:true,name});preferences.initialize();
      check('saved-hotkey-registers-again-on-new-controller-initialize',globalShortcut.isRegistered(details.shortcut)&&preferences.snapshot().preferences.globalShortcut===details.shortcut);
      preferences.dispose();
      check('restored-hotkey-releases-on-dispose',!globalShortcut.isRegistered(details.shortcut));
      check('isolated-native-window-never-shown',!window.isVisible());
      check('zero-network-requests',requests.length===0);
    }catch(caught){error=caught.message;}
    finally{
      preferences?.dispose();globalShortcut.unregisterAll();
      app.setLoginItemSettings({...startup,openAtLogin:false});
      if(window&&!window.isDestroyed())window.destroy();
      const cleanup={qaLoginItemDisabled:!app.getLoginItemSettings(startup).openAtLogin,qaRunValueAbsent:query(RUN,name).status!==0,qaShortcutUnregistered:!details.shortcut||!globalShortcut.isRegistered(details.shortcut)};
      const ok=!error&&Object.values(cleanup).every(Boolean);
      process.stdout.write(prefix+JSON.stringify({ok,error,checkedOn:'2026-10-09',scope:'Real Windows startup registry registration/readback/removal, real two-process global shortcut conflict/release/reuse, current actual display bounds and hidden native window. Unique QA registry name and isolated profiles only. No keyboard injection, physical shortcut callback, OS login, sleep/resume, monitor removal, live app configuration, clipboard or account test.',checks,hashes,details,childCleanup:cleanup,requests})+'\n');app.exit(ok?0:1);
    }
  }).catch(error=>{globalShortcut.unregisterAll();process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message})+'\n');app.exit(1);});
}
