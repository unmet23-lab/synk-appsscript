'use strict';
// Native modules only; the renderer integration has its own smoke. This process
// uses synthetic account data and a temporary profile, never the live profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),prefix='SYNK_NATIVE_PREFERENCES_QA ';
const argument=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-native-preferences-'));
  try{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const run=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,env,encoding:'utf8',timeout:30000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-1600)};
    report.electronExitCode=run.status;report.ok=!!report.ok&&run.status===0;
    const out=path.resolve(argument('out')||path.join(root,'artifacts','desktop-preferences-native-smoke.json'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(value=>!value.ok),error:report.error,report:out},null,2));if(!report.ok)process.exitCode=1;
  }finally{
    const resolved=path.resolve(profile);if(path.dirname(resolved)!==path.resolve(os.tmpdir())||!path.basename(resolved).startsWith('synk-native-preferences-'))throw Error('Unsafe temporary profile');fs.rmSync(resolved,{recursive:true,force:true,maxRetries:20,retryDelay:150});
  }
}else{
  const {app,BrowserWindow,Tray,Menu,screen,safeStorage,globalShortcut,session}=require('electron');
  const {createDesktopPreferences}=require('../src/desktop-preferences.cjs'),{createWindowPlacement}=require('../src/window-placement.cjs'),{createDraftRecovery}=require('../src/draft-recovery.cjs'),{createDraftRecoveryRequests}=require('../src/draft-recovery-ipc.cjs'),{createPlatformTray}=require('../src/platform-tray.cjs');
  const profile=argument('profile');if(!profile||path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-native-preferences-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setName('SYNK native preferences isolated QA');app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'Session'));app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let window,preferences,tray,menu;const checks=[],requests=[];
    const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
    const hashes=Object.fromEntries(['src/desktop-preferences.cjs','src/window-placement.cjs','src/draft-recovery.cjs','src/draft-recovery-ipc.cjs','src/platform-tray.cjs','src/main.cjs','src/preload.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
    try{
      const isolated=session.fromPartition('native-preferences-synthetic');isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
      const placement=createWindowPlacement({directory:profile,screen}),bounds=placement.restore();
      window=new BrowserWindow({x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,show:false,skipTaskbar:true,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false}});
      await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK 합성 검증</title><body>암호화와 창 설정 확인</body></html>'));
      check('isolated-window-remains-hidden',!window.isVisible());placement.attach(window);
      preferences=createDesktopPreferences({directory:profile,app,globalShortcut,getWindow:()=>window,appRoot:root,name:'im.synk.preferences.synthetic'});preferences.initialize();
      check('defaults-do-not-enable-startup-or-hotkeys',!preferences.snapshot().preferences.launchAtLogin&&preferences.snapshot().preferences.globalShortcut==='');
      check('actual-electron-zoom-applies',preferences.update({zoomFactor:1.25}).ok&&window.webContents.getZoomFactor()===1.25);
      check('actual-electron-zoom-does-not-show-window',!window.isVisible());
      check('preferences-survive-controller-restart',createDesktopPreferences({directory:profile,app,globalShortcut,getWindow:()=>window,appRoot:root}).snapshot().preferences.zoomFactor===1.25);
      let state={signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:'synthetic-native-owner'}},clock=Date.now();
      const options={directory:path.join(profile,'DraftRecovery'),safeStorage,getAccount:()=>state,configFingerprint:'synthetic-only',now:()=>clock};
      const recovery=createDraftRecovery(options),recoveryRequests=createDraftRecoveryRequests({getAccount:()=>state,recovery}),value={kind:'note',appId:'world',title:'검증용 합성 초안',body:'합성 데이터만 DPAPI로 확인합니다.'};
      check('actual-os-encryption-is-available',recovery.available());check('draft-opt-in-is-required',(await recovery.save('member-home',value)).code==='DRAFT_RECOVERY_DISABLED');
      check('account-opt-in-and-native-encrypted-save',(await recovery.setEnabled(true)).ok&&(await recovery.save('member-home',value)).ok);
      const file=path.join(options.directory,fs.readdirSync(options.directory)[0]),encrypted=fs.readFileSync(file);check('disk-does-not-contain-draft-plaintext',!encrypted.includes(Buffer.from(value.body))&&!encrypted.includes(Buffer.from(state.account.synk_user_id)));
      const recovered=await createDraftRecovery(options).load('member-home');check('new-controller-decrypts-actual-os-draft',JSON.stringify(recovered.draft)===JSON.stringify(value));
      state={...state,sessionGeneration:2,account:{synk_user_id:'another-synthetic-owner'}};check('other-account-does-not-see-draft',(await recovery.load('member-home')).draft===null);
      check('stale-renderer-owner-cannot-read-new-account',recoveryRequests.load('member-home','synthetic-native-owner').code==='AUTH_CHANGED');
      check('stale-renderer-owner-cannot-write-new-account',recoveryRequests.save('member-home',value,'synthetic-native-owner').code==='AUTH_CHANGED');state={...state,sessionGeneration:3,account:{synk_user_id:'synthetic-native-owner'}};
      clock+=7*24*60*60*1000;check('expired-draft-is-removed',(await recovery.load('member-home')).draft===null);await recovery.setEnabled(false);check('opt-out-removes-encrypted-file',fs.readdirSync(options.directory).length===0);
      tray=createPlatformTray({app,Tray,Menu:{buildFromTemplate:template=>{menu=Menu.buildFromTemplate(template);return menu;}},icon:path.join(root,'assets','platform.ico'),productName:'SYNK isolated convenience QA',getWindow:()=>window,createWindow:()=>{throw Error('Unexpected recreation');},shouldHide:()=>preferences.snapshot().preferences.closeToTray});tray.attachWindow(window);
      check('native-tray-contains-validated-app-shortcuts',tray.setShortcuts([{id:'world',kind:'favorite'},{id:'messenger',kind:'recent'}]).ok&&menu.items.some(item=>item.label==='SYNK WORLD')&&menu.items.some(item=>item.label==='SYNK Workspace'));
      window.close();check('close-to-tray-retains-hidden-native-window',!window.isDestroyed()&&!window.isVisible());
      const stored=createWindowPlacement({directory:profile,screen}).restore();check('actual-normal-bounds-survive-close',stored.width===window.getNormalBounds().width&&stored.height===window.getNormalBounds().height);
      preferences.update({closeToTray:false});window.close();for(let i=0;i<30&&!window.isDestroyed();i++)await new Promise(resolve=>setTimeout(resolve,25));check('close-setting-false-really-destroys-window',window.isDestroyed());check('no-external-requests',requests.length===0);
      preferences.dispose();tray.dispose();process.stdout.write(prefix+JSON.stringify({ok:true,checkedOn:'2026-10-09',checks,hashes,requests,scope:'Isolated hidden native Electron window, real safeStorage DPAPI, native Tray/Menu, synthetic account only. No startup mutation or shortcut registration.'})+'\n');app.exit(0);
    }catch(error){preferences?.dispose();tray?.dispose();if(window&&!window.isDestroyed())window.destroy();process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checks,hashes,requests})+'\n');app.exit(1);}
  });
}
