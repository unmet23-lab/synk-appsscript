'use strict';
// Actual member-home renderer in a hidden Electron window and synthetic profile.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const desktop=path.resolve(__dirname,'..'),repo=path.resolve(desktop,'..');
const option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const out=path.resolve(option('out',path.join(repo,'.tmp/platform-storage-fix-20261014/native')));
const prefix='SYNK_MEMBER_STORAGE_QA ',profilePrefix='synk-member-storage-recovery-';
const safeProfile=value=>path.dirname(path.resolve(value))===path.resolve(os.tmpdir())&&path.basename(value).startsWith(profilePrefix);
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),profilePrefix));
  try{
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const child=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile,'--out='+out],{cwd:desktop,windowsHide:true,env,encoding:'utf8',timeout:60000});
    const line=child.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:child.error?.message||'NO_REPORT',stderr:child.stderr?.slice(-1800)};
    report.process={exitCode:child.status,signal:child.signal,error:child.error?.message||null};
    if(child.status!==0||child.error)report.ok=false;
    fs.mkdirSync(out,{recursive:true});const text=JSON.stringify(report,null,2)+'\n';
    fs.writeFileSync(path.join(out,'result-'+Date.now()+'.json'),text);fs.writeFileSync(path.join(out,'result.json'),text);
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(row=>!row.ok),error:report.error,requests:report.requests,errors:report.errors,output:path.join(out,'result.json')},null,2));
    if(!report.ok)process.exitCode=1;
  }finally{
    if(!safeProfile(profile))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron');
  const {createNativeContent}=require('../src/native-content.cjs');
  const {nativeContentSecurityPolicy}=require('../src/security.cjs');
  const profile=option('profile','');if(!profile||!safeProfile(profile))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'Session'));app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let win,stage='startup';const checks=[],errors=[],requests=[],screenshots=[],captureRetries=[],loadedSources=new Map();
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(name,ok,details={})=>{stage=name;checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    const sourcePaths=['renderer/member-home.mjs','renderer/draft-recovery.mjs','renderer/launcher.css','renderer/member-home.css','tools/member-home-storage-recovery-fixture.mjs','tools/member-home-storage-recovery-native-smoke.cjs'];
    const hashes=Object.fromEntries(sourcePaths.map(file=>[file,sha(fs.readFileSync(path.join(desktop,file)))]));
    const finish=(ok,error)=>{
      const served=Object.fromEntries([...loadedSources].map(([file,hash])=>[path.relative(desktop,file).split(path.sep).join('/'),{sha256:hash,unchanged:fs.existsSync(file)&&sha(fs.readFileSync(file))===hash}]));
      process.stdout.write(prefix+JSON.stringify({ok,error,checkedAt:new Date().toISOString(),command:'node desktop/tools/member-home-storage-recovery-native-smoke.cjs --out='+out,scope:'Hidden sandboxed Electron component using actual mountMemberHome, current CSS and renderer modules. Synthetic accounts, in-memory record storage and recovery bridge only. No installed application, real profile, credentials, network, OS-encrypted draft store, build, install or release.',hashes,loadedSources:served,checks,errors,requests,screenshots,captureRetries})+'\n');
      if(win&&!win.isDestroyed())win.destroy();app.exit(ok?0:1);
    };
    try{
      fs.mkdirSync(out,{recursive:true});Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('member-storage-recovery-synthetic');
      const content=createNativeContent({appRoot:desktop,readFile:async file=>{const bytes=fs.readFileSync(file);loadedSources.set(file,sha(bytes));return bytes;}});
      isolated.protocol.handle('synk-desktop',request=>{
        const url=new URL(request.url),headers={'content-type':'text/html; charset=utf-8','content-security-policy':nativeContentSecurityPolicy(),'cache-control':'no-store'};
        if(url.host==='platform'&&url.pathname==='/storage-fixture.html')return new Response('<!doctype html><html lang="ko" data-theme="night"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK isolated member storage QA</title><link rel="stylesheet" href="/launcher.css"><link rel="stylesheet" href="/member-home.css"><style>html,body{overflow:auto;height:auto;min-height:100%;margin:0}body{display:block}#fixture{max-width:1180px;margin:0 auto;padding:24px;box-sizing:border-box}.view{display:block;max-width:100%}@media(max-width:600px){#fixture{padding:16px}}</style><main id="fixture"></main><script type="module" src="/storage-fixture.mjs"></script></html>',{headers});
        if(url.host==='platform'&&url.pathname==='/storage-fixture.mjs'){
          const file=path.join(__dirname,'member-home-storage-recovery-fixture.mjs'),bytes=fs.readFileSync(file);loadedSources.set(file,sha(bytes));return new Response(bytes,{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
        }
        return content(request);
      });
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      win=new BrowserWindow({width:1280,height:1080,useContentSize:true,show:false,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,offscreen:true}});
      win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      win.webContents.on('console-message',event=>{if(event.level==='error')errors.push({stage,message:event.message});});
      const run=code=>win.webContents.executeJavaScript(code),qa='window.__memberStorageQA',snap=()=>run(qa+'.snapshot()');
      const until=async code=>{for(let attempt=0;attempt<200;attempt++){if(await run(code))return true;await pause(20);}return false;};
      const boot=async options=>{await run(qa+'.boot('+JSON.stringify(options||{})+')');await pause(40);};
      const click=selector=>run(qa+'.click('+JSON.stringify(selector)+')');
      const fill=draft=>run(qa+'.fill('+JSON.stringify(draft)+')');
      const currentDraft={kind:'note',appId:'world',title:'지금 작성 중인 합성 결과',body:'지금의 본문은 유지되어야 해요.\n두 번째 줄도 유지해요.',consent:true};
      const sameDraft=s=>JSON.stringify(s.form)===JSON.stringify(currentDraft);
      const capture=async(name,width,selector)=>{
        win.setContentSize(width,1080);await until('innerWidth==='+width);await run('document.fonts.ready');await run(qa+'.scrollTo('+JSON.stringify(selector)+')');await pause(120);
        const geometry=await run(qa+'.geometry()');check(name+'-no-horizontal-overflow',geometry.width===width&&geometry.scrollWidth<=geometry.clientWidth,geometry);
        let img;for(let attempt=0;attempt<3;attempt++){
          try{win.webContents.invalidate();await pause(100);img=await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});break;}
          catch(error){captureRetries.push({name,attempt:attempt+1,error:error.message});if(attempt===2)throw error;await pause(150);}
        }
        fs.writeFileSync(path.join(out,name+'.png'),img.toPNG());screenshots.push({file:name+'.png',width:img.getSize().width,height:img.getSize().height});
      };
      await win.loadURL('synk-desktop://platform/storage-fixture.html');check('fixture-ready',await until("document.documentElement.dataset.ready==='true'"));

      for(const damage of ['malformed','partial']){
        for(const action of ['add','toggle','remove']){
          await boot();if(action==='add'){await click('[data-member-add]');await fill(currentDraft);}
          const raw=await run(qa+'.corrupt('+JSON.stringify(damage)+')');
          if(action==='add')await run(qa+'.submit()');else await click(action==='toggle'?'[data-member-toggle="existing-task"]':'[data-member-remove="existing-note"]');
          let s=await snap();check(damage+'-'+action+'-preserves-original-bytes',s.raw===raw&&s.writes===0,{writes:s.writes,originalSha256:sha(raw),afterSha256:sha(s.raw)});
          check(damage+'-'+action+'-shows-alert-and-blocks-further-writes',s.storageError?.role==='alert'&&!!s.storageError.text&&s.storageRetry&&s.controls.add===true&&s.controls.toggle.every(Boolean)&&s.controls.remove.every(Boolean),{storageError:s.storageError,controls:s.controls});
          if(action==='add')check(damage+'-failed-add-keeps-input-and-consent',sameDraft(s)&&s.controls.submit===true,{form:s.form});
        }
      }
      await boot();await click('[data-member-add]');await fill(currentDraft);await run(qa+'.corrupt("partial",{render:true})');
      check('partial-damage-retains-readable-existing-task-and-note',(await snap()).recordIds.length===2);
      await capture('storage-alert-1280',1280,'[data-member-storage-error]');await capture('storage-alert-390',390,'[data-member-storage-error]');
      await run(qa+'.healStorage()');await click('[data-member-retry-storage]');let s=await snap();
      check('explicit-storage-recheck-keeps-draft-and-reenables-save',!s.storageError&&sameDraft(s)&&s.controls.submit===false);
      await run(qa+'.submit()');s=await snap();
      check('healthy-save-preserves-both-original-records-and-new-result',s.writes===1&&s.records.length===3&&s.records[0].kind==='note'&&s.records[0].title===currentDraft.title&&s.records[0].body===currentDraft.body&&JSON.stringify(s.records.slice(1))===JSON.stringify(await run(qa+'.expectedOriginals()')),{recordIds:s.recordIds});
      await run(qa+'.remount()');check('fresh-member-home-mount-restores-saved-result-and-originals',(await snap()).records.length===3&&(await snap()).recordIds.length===3);
      const savedBeforeTask=(await snap()).records;
      const nextTask={kind:'task',appId:'world',title:'다음 합성 작업',body:'앞서 저장한 결과를 확인하기',consent:true};
      await click('[data-member-add]');await fill(nextTask);await run(qa+'.submit()');s=await snap();
      check('healthy-task-save-preserves-existing-task-and-result-notes',s.writes===2&&s.records.length===4&&s.records[0].kind==='task'&&s.records[0].title===nextTask.title&&s.records[0].body===nextTask.body&&JSON.stringify(s.records.slice(1))===JSON.stringify(savedBeforeTask));
      await run(qa+'.remount()');check('fresh-member-home-mount-restores-all-four-records',(await snap()).recordIds.length===4);

      for(const phase of ['status','load']){
        win.setContentSize(1280,1080);await boot({mode:phase+'-error',hold:phase});
        check(phase+'-request-held',await until(qa+'.snapshot().pending.includes('+JSON.stringify(phase)+')'));
        await click('[data-member-add]');await fill(currentDraft);await run(qa+'.release('+JSON.stringify(phase)+')');
        check(phase+'-failure-visible-and-retryable',await until('!!'+qa+'.snapshot().recoveryError&&'+qa+'.snapshot().recoveryRetry?.disabled===false'),await snap());
        s=await snap();check(phase+'-failure-preserves-active-draft-and-consent',sameDraft(s)&&s.recoveryError.role==='alert',{form:s.form,recoveryError:s.recoveryError});
        const failedCalls=s.callCounts;await run(qa+'.render(6)');await fill({title:'',body:''});await fill(currentDraft);await run(qa+'.flush()');await pause(360);s=await snap();
        check(phase+'-failure-blocks-save-clear-and-render-retry',s.callCounts.status===failedCalls.status&&s.callCounts.load===failedCalls.load&&s.callCounts.save===0&&s.callCounts.clear===0&&sameDraft(s),{callCounts:s.callCounts});
        if(phase==='load'){await capture('recovery-error-1280',1280,'[data-member-recovery-error]');await capture('recovery-error-390',390,'[data-member-recovery-error]');}
        await run(qa+'.healthyRecovery();'+qa+'.hold("status")');await click('[data-member-retry-recovery]');
        check(phase+'-explicit-retry-disables-button-while-pending',await until(qa+'.snapshot().pending.includes("status")&&'+qa+'.snapshot().recoveryRetry?.disabled===true'));
        await click('[data-member-retry-recovery]');await run(qa+'.release("status")');
        check(phase+'-explicit-retry-reveals-one-recovery-candidate',await until(qa+'.snapshot().candidates===1&&!'+qa+'.snapshot().recoveryError'));
        check(phase+'-successful-retry-focuses-recovery-action',await until(qa+'.snapshot().activeAction==="recover"'));
        await run(qa+'.render(5)');await fill({title:'',body:''});await fill(currentDraft);await run(qa+'.flush()');await pause(360);s=await snap();
        check(phase+'-candidate-and-current-draft-coexist-without-backup-write',s.candidates===1&&sameDraft(s)&&s.callCounts.save===0&&s.callCounts.clear===0&&s.callCounts.status===failedCalls.status+1&&s.callCounts.load===failedCalls.load+1,{callCounts:s.callCounts,form:s.form,candidates:s.candidates});
        if(phase==='load')await capture('recovery-candidate-390',390,'[data-member-recover]');
        check(phase+'-discard-current-input-preserves-previous-candidate',await run(qa+'.discardCurrent()'));
        s=await snap();check(phase+'-discard-current-does-not-delete-original',s.form===null&&s.candidates===1&&s.callCounts.save===0&&s.callCounts.clear===0&&!await run(qa+'.hasUnsaved()'));
        await click('[data-member-recover]');s=await snap();const recovered=await run(qa+'.candidateDraft()');
        check(phase+'-original-recovery-content-restores-with-fresh-consent',s.form?.title===recovered.title&&s.form?.body===recovered.body&&s.form?.appId===recovered.appId&&s.form?.consent===false&&s.candidates===0&&s.callCounts.clear===0);
      }
      check('source-files-unchanged-during-check',sourcePaths.every(file=>sha(fs.readFileSync(path.join(desktop,file)))===hashes[file]));
      check('no-external-requests-or-renderer-errors',requests.length===0&&errors.length===0,{requests,errors});
      check('window-stays-hidden',!win.isVisible());await run(qa+'.dispose()');finish(true);
    }catch(error){finish(false,error.message);}
  }).catch(error=>{process.stdout.write(prefix+JSON.stringify({ok:false,error:error.stack})+'\n');app.exit(1);});
}
