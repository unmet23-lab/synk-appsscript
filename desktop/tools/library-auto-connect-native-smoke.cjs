'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const desktop=path.resolve(__dirname,'..'),arg=name=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3);
const source=path.resolve(arg('source')||desktop),out=path.resolve(arg('out')||path.join(desktop,'..','.tmp','platform-library-auto-20261014','auto-connect-native'));
const prefix='SYNK_LIBRARY_AUTO_QA ';
if(!process.versions.electron){
  fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'isolated-'));
  for(const name of ['appdata','localappdata','temp'])fs.mkdirSync(path.join(profile,name));
  const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--source='+source,'--out='+out,'--profile='+profile],{
    cwd:desktop,windowsHide:true,encoding:'utf8',timeout:90000,env:{...process.env,APPDATA:path.join(profile,'appdata'),LOCALAPPDATA:path.join(profile,'localappdata'),TEMP:path.join(profile,'temp'),TMP:path.join(profile,'temp')},
  });
  fs.writeFileSync(path.join(out,'stdout.log'),result.stdout||'');fs.writeFileSync(path.join(out,'stderr.log'),result.stderr||'');
  const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
  const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',exitCode:result.status};
  report.normalExit=result.status===0&&!result.error;report.exitCode=result.status;report.ok=report.ok&&report.normalExit;
  fs.writeFileSync(path.join(out,'native.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,calls:report.calls},null,2));
  if(!report.ok)process.exitCode=1;
}else{
  const {app,BrowserWindow,protocol,session,Menu,ipcMain}=require('electron');
  const {createNativeContent}=require(path.join(source,'src/native-content.cjs')),{preferences}=require(path.join(source,'src/security.cjs'));
  const profile=path.resolve(arg('profile')||'');
  if(path.dirname(profile)!==out||!path.basename(profile).startsWith('isolated-'))throw Error('Isolated QA profile required');
  for(const name of ['userData','sessionData','logs'])fs.mkdirSync(path.join(profile,name));
  app.enableSandbox();app.setPath('appData',path.join(profile,'appdata'));app.setPath('userData',path.join(profile,'userData'));app.setPath('sessionData',path.join(profile,'sessionData'));app.setAppLogsPath(path.join(profile,'logs'));
  app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let win,phase='startup',loadGate=null;const checks=[],calls=[],errors=[],requests=[];
    const signedIn={configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'auto-connect-synthetic'},library:{status:'ready',appIds:['world']}};
    const signedOut={configured:true,status:'signed-out',signedIn:false,sessionGeneration:2};let auth=signedIn;
    const cloud={version:1,consent:true,favorites:['world'],recent:[],rememberRecent:true,notes:[{id:'native-saved-note',appId:'world',title:'다시 열면 자동으로 이어지는 합성 메모',done:false,createdAt:1}]};
    let remote=cloud,revision=1;
    const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(source,file))).digest('hex');
    const hashes=Object.fromEntries(['renderer/launcher.mjs','renderer/platform-continuity.mjs'].map(file=>[file,hash(file)]));
    const host={executable:process.execPath,pid:process.pid,profile,packaged:app.isPackaged};
    const count=operation=>calls.filter(call=>call.operation===operation).length;
    const check=(name,ok,details={})=>{checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const run=code=>win.webContents.executeJavaScript(code);
    const until=async code=>{for(let index=0;index<200;index++){if(await run(code))return true;await pause(20);}return false;};
    const closeOwned=async()=>{const closing=win;closing.close();for(let index=0;index<150&&!closing.isDestroyed();index++)await pause(20);return closing.isDestroyed();};
    const connected="document.querySelector('.continuity-notes')?.textContent.includes('다시 열면 자동으로 이어지는 합성 메모')&&document.querySelector('[data-connect]').hidden";
    const publish=value=>{auth=value;win.webContents.send('library-auto-qa:auth',value);};
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('library-auto-connect-synthetic');
      isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:source}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      ipcMain.handle('library-auto-qa:request',async(event,operation,params)=>{
        if(!win||event.sender!==win.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('Unexpected QA sender');
        calls.push({phase,operation});
        if(operation==='authStatus')return auth;
        if(operation==='platformLoad'||operation==='platformSave'){
          if(operation==='platformLoad'&&loadGate)await loadGate.promise;
          if(operation==='platformSave'){if(params.expected_revision!==revision)throw Error('Unexpected synthetic CAS revision');remote=params.state;revision++;}
          return {ok:true,scope:'synk-personal',resource:'platform-library',accountId:auth.account?.synk_user_id,revision,updatedAt:null,state:remote};
        }
        return {ok:false,code:'UNEXPECTED_TEST_OPERATION'};
      });
      const open=async()=>{
        win=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'library-auto-connect-fixture.cjs')),session:isolated,backgroundThrottling:false,offscreen:true}});
        win.webContents.on('console-message',event=>{if(event.level==='error')errors.push({phase,message:event.message,source:event.sourceId,line:event.lineNumber});});
        await win.loadURL('synk-desktop://platform/index.html');check(phase+'-renderer-ready',await until("document.documentElement.dataset.ready==='true'"));
      };
      await open();check('startup-loads-saved-library-without-click',await until(connected)&&count('platformLoad')===1);
      check('startup-keeps-library-panel-compact',await run("document.querySelector('[data-library-panel]').hidden&&document.querySelector('[data-panel-toggle]').getAttribute('aria-expanded')==='false'"));
      publish(signedIn);publish(signedIn);await pause(100);check('duplicate-verified-events-do-not-load-again',count('platformLoad')===1);
      phase='reload';const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.reload();await loaded;
      check('reload-renderer-ready',await until("document.documentElement.dataset.ready==='true'"));check('reload-restores-library-without-click',await until(connected)&&count('platformLoad')===2);
      check('reload-local-images-finish-decoding',await run("Promise.all([...document.images].filter(image=>image.getAttribute('src')).map(image=>image.decode().then(()=>image.naturalWidth>0,()=>false))).then(results=>results.length>0&&results.every(Boolean))"));
      await run('document.fonts.ready.then(()=>true)');
      await pause(100);fs.writeFileSync(path.join(out,'automatic-after-reload.png'),(await win.webContents.capturePage()).toPNG());
      check('isolated-window-closes-normally',await closeOwned());
      phase='fresh-window';await open();check('fresh-window-restores-library-without-click',await until(connected)&&count('platformLoad')===3);
      check('fresh-owned-window-closes-normally',await closeOwned());auth=signedOut;phase='signed-out';await open();await pause(100);
      check('signed-out-does-not-load-or-expose-saved-library',count('platformLoad')===3&&!await run(connected));
      publish({...signedOut,status:'restoring',sessionGeneration:3});await pause(100);check('restoring-does-not-load-library',count('platformLoad')===3);
      phase='verified-restoration';publish({...signedIn,sessionGeneration:4});check('verified-restoration-connects-without-click',await until(connected)&&count('platformLoad')===4);
      check('hydration-never-writes-or-opens-OAuth',!calls.some(call=>!['authStatus','platformLoad'].includes(call.operation)),{loadCount:count('platformLoad'),saveCount:count('platformSave'),OAuthCount:count('OAuth'),automatedClicks:0});
      check('read-only-hydration-leaves-no-unsaved-draft-guard',await run("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented;})()"));
      check('hydrated-owned-window-closes-normally',await closeOwned());
      phase='pending-explicit-favorite';remote={...remote,favorites:[]};revision++;let releaseLoad;loadGate={promise:new Promise(resolve=>{releaseLoad=resolve;})};await open();
      await run("document.getElementById('favorite').click()");
      check('explicit-action-pending-hydration-guards-native-unload',await until("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})()"));
      win.close();await pause(100);check('pending-explicit-action-keeps-owned-native-window-open',!win.isDestroyed()&&count('platformSave')===0);
      releaseLoad();loadGate=null;
      check('released-hydration-saves-explicit-favorite-and-keeps-note',await until("document.querySelector('[data-notebook-status]')?.textContent==='계정에 저장했어요'&&document.getElementById('favorite').getAttribute('aria-pressed')==='true'")&&count('platformSave')===1&&remote.favorites.includes('world')&&remote.notes.length===1);
      check('acknowledged-explicit-action-releases-native-unload-guard',await run("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented;})()"));
      check('no-external-requests-or-console-errors',requests.length===0&&errors.length===0,{requests,errors});
      check('tested-production-files-unchanged',Object.entries(hashes).every(([file,value])=>hash(file)===value));
      check('final-owned-window-closes-normally',await closeOwned());
      process.stdout.write(prefix+JSON.stringify({ok:true,checkedAt:new Date().toISOString(),source,scope:'Production renderer and generated bundle in an isolated hidden Electron host; synthetic account and memory-only records; no real account, installer, network request or user profile.',host,hashes,checks,calls,errors,requests})+'\n');app.quit();
    }catch(error){
      if(win&&!win.isDestroyed()){try{fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());}catch{}win.destroy();}
      process.stdout.write(prefix+JSON.stringify({ok:false,error:error.stack,source,host,hashes,checks,calls,errors,requests})+'\n');app.exit(1);
    }
  });
}
