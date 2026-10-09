'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const desktop=path.resolve(__dirname,'..'),repo=path.resolve(desktop,'..');
const option=(name,fallback)=>process.argv.find(value=>value.startsWith('--'+name+'='))?.slice(name.length+3)||fallback;
const out=path.resolve(option('out',path.join(repo,'docs','_ops','qa','platform-input-continuity-20261009')));
const bundle=path.resolve(option('bundle',path.join(desktop,'renderer','platform-continuity.mjs'))),prefix='SYNK_PLATFORM_INPUT_QA ';
const safeProfile=value=>path.dirname(path.resolve(value))===path.resolve(os.tmpdir())&&path.basename(value).startsWith('synk-platform-input-');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-platform-input-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile,'--out='+out,'--bundle='+bundle],{cwd:desktop,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1800)};
    report.process={exitCode:result.status,signal:result.signal,error:result.error?.message||null};
    if(result.status!==0||result.error){report.ok=false;report.error||=result.error?.message||'ELECTRON_EXIT_'+result.status;}
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-input.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(value=>!value.ok),error:report.error,output:path.join(out,'native-input.json')},null,2));
    if(!report.ok)process.exitCode=1;
  }finally{
    if(!safeProfile(profile))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron');
  const profile=option('profile','');if(!profile||!safeProfile(profile))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-input',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let win,stage='startup';const checks=[],errors=[],requests=[],served=new Map();
    const check=(name,ok,details={})=>{stage=name;checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const scope='Hidden sandboxed Electron using the selected renderer bundle, synthetic identity and memory CAS server. No installed app, user profile, credentials, external requests, build, install or release. Composition events are synthetic; this is not an OS Korean IME test.';
    const finish=(ok,error)=>{
      const loadedSources=Object.fromEntries([...served].map(([key,value])=>[key,{sha256:value.sha256,unchanged:fs.existsSync(value.file)&&sha(fs.readFileSync(value.file))===value.sha256}]));
      const scripts=Object.fromEntries(['platform-input-native-smoke.cjs','platform-input-fixture.mjs'].map(file=>[file,sha(fs.readFileSync(path.join(__dirname,file)))]));
      process.stdout.write(prefix+JSON.stringify({ok,error,checkedAt:new Date().toISOString(),scope,bundle,versions:{electron:process.versions.electron,chrome:process.versions.chrome},scripts,loadedSources,checks,errors,requests})+'\n');
      if(win&&!win.isDestroyed())win.destroy();app.exit(ok?0:1);
    };
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('platform-input-synthetic');
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      isolated.protocol.handle('synk-input',async request=>{
        const headers={'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'",'x-content-type-options':'nosniff','cache-control':'no-store'};
        const denied=()=>new Response('Unavailable',{status:404,headers});
        try{
          const url=new URL(request.url);if(url.host!=='fixture'||url.search||url.hash||request.method!=='GET')return denied();
          if(url.pathname==='/index.html')return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>SYNK isolated input fixture</title><main id="fixture"></main><script type="module" src="/fixture.mjs"></script></html>',{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
          if(url.pathname==='/fixture.mjs')return new Response(fs.readFileSync(path.join(__dirname,'platform-input-fixture.mjs')),{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
          if(url.pathname==='/entry.mjs'){
            const bytes=fs.readFileSync(bundle);
            served.set('bundle/platform-continuity.mjs',{file:bundle,sha256:sha(bytes)});
            return new Response(bytes,{headers:{...headers,'content-type':'text/javascript; charset=utf-8'}});
          }
          return denied();
        }catch{return denied();}
      });
      win=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:false,offscreen:true}});
      win.webContents.on('console-message',(event,level,message,line,sourceId)=>{if(event.level==='error'||event.level===3||level===3)errors.push({message:event.message||message,stage,sourceId:event.sourceId||sourceId,lineNumber:event.lineNumber||line});});
      const run=source=>win.webContents.executeJavaScript(source),qa='window.__platformInputQA';
      const until=async source=>{for(let i=0;i<200;i++){if(await run(source))return true;await pause(15);}return false;};
      const snapshot=()=>run(qa+'.probe()');
      const draft='저장 상태가 바뀌어도 이어 쓰는 한글 메모';
      const retained=async name=>{const p=await snapshot();check(name,p.sameInput&&p.sameForm&&p.sameSelect&&p.connected&&p.focused&&p.value===draft&&p.selectionStart===3&&p.selectionEnd===7&&p.selectionDirection==='backward'&&p.composing&&!p.events.some(event=>event.type==='blur'||event.type==='compositionend'),p);};
      await win.loadURL('synk-input://fixture/index.html');check('fixture-ready',await until("document.documentElement.dataset.ready==='true'"));
      await run(qa+'.connect()');check('library-connected',await until(qa+'.ready()'));await run(qa+'.expand()');
      check('connection-is-read-only',await run(qa+'.calls().every(row=>row.operation==="platformLoad")'));
      await run(qa+'.beginProbe('+JSON.stringify(draft)+')');await retained('initial-editor-and-synthetic-composition');
      await run(qa+'.hold("platformSave");'+qa+'.change("world")');
      check('save-started',await until(qa+'.held("platformSave")&&'+qa+'.status()==="계정에 저장하고 있어요"'));await retained('save-start-retains-editor-focus-selection');
      await run(qa+'.release("platformSave")');check('save-acknowledged',await until('!'+qa+'.pending()&&'+qa+'.status()==="계정에 저장했어요"'));await retained('save-ack-retains-editor-focus-selection');
      await run(qa+'.hold("platformSave");'+qa+'.failSave(true);'+qa+'.change("care")');check('failing-save-started',await until(qa+'.held("platformSave")'));await retained('second-save-retains-editor-focus-selection');
      await run(qa+'.release("platformSave")');check('save-failure-visible',await until(qa+'.status()==="연결을 기다리고 있어요"'));await retained('save-failure-retains-editor-focus-selection');
      await run(qa+'.hold("platformSave");'+qa+'.failSave(false);'+qa+'.click("retry")');check('retry-started',await until(qa+'.held("platformSave")'));await retained('retry-start-retains-editor-focus-selection');
      await run(qa+'.release("platformSave")');check('retry-acknowledged',await until('!'+qa+'.pending()&&'+qa+'.status()==="계정에 저장했어요"'));await retained('retry-ack-retains-editor-focus-selection');
      const composition=await run(qa+'.endComposition()');check('synthetic-composition-listeners-survive',composition.sameInput&&composition.events.filter(event=>event.type==='compositionstart').length===1&&composition.events.filter(event=>event.type==='compositionupdate').length===1&&composition.events.filter(event=>event.type==='compositionend').length===1&&composition.events.filter(event=>event.type.startsWith('composition')).every(event=>!event.isTrusted),composition);
      await win.webContents.insertText('한글');const inserted=await snapshot();check('chromium-text-insertion-uses-same-editor',inserted.sameInput&&inserted.focused&&inserted.value===draft.slice(0,3)+'한글'+draft.slice(7)&&inserted.selectionStart===5&&inserted.selectionEnd===5&&inserted.events.some(event=>event.type==='input'&&event.isTrusted),inserted);
      await run(qa+'.input("")');
      for(const fails of [false,true]){
        const label=fails?'failed-remote-read':'successful-remote-read';
        await run(qa+'.hold("platformSave");'+qa+'.bumpRemote('+JSON.stringify('다른 기기의 합성 기록 '+label)+');'+qa+'.change("world")');
        check(label+'-save-waits',await until(qa+'.held("platformSave")'));await run(qa+'.release("platformSave")');check(label+'-conflict-visible',await until(qa+'.status()==="다른 기기의 변경을 확인해 주세요"'));
        const before=await run('({projection:'+qa+'.projection(),writes:'+qa+'.calls().filter(row=>row.operation==="platformSave").length})');
        await run(qa+'.hold("platformLoad");'+qa+'.failLoad('+fails+');'+qa+'.click("remote")');
        check(label+'-load-waits',await until(qa+'.held("platformLoad")'));const locked=await run(qa+'.lock()');
        check(label+'-locks-editor',locked.inert&&locked.busy==='true'&&locked.fieldDisabled&&locked.selectDisabled&&locked.allControlsDisabled&&locked.refreshDisabled&&locked.importDisabled,locked);
        check(label+'-blocks-edit-and-extra-save',await run(qa+'.blockedEdit()')&&await run(qa+'.calls().filter(row=>row.operation==="platformSave").length==='+before.writes));
        await run('document.querySelector("[data-note-form] [name=title]").focus()');await win.webContents.insertText('차단해야 할 입력');
        check(label+'-chromium-cannot-type-into-locked-editor',(await run(qa+'.lock()')).value===locked.value);
        await run(qa+'.release("platformLoad")');check(label+'-unlocks-after-read',await until('!'+qa+'.lock().inert&&'+qa+'.ready()'));
        if(fails){
          check(label+'-keeps-pending-local-document',await run(qa+'.pending()&&JSON.stringify('+qa+'.projection())==='+JSON.stringify(JSON.stringify(before.projection)))&&await run(qa+'.detail().includes("합성 조회 실패")'));
        }else{
          check(label+'-adopts-confirmed-remote-document',await run('!'+qa+'.pending()&&'+qa+'.lock().notes.includes('+JSON.stringify('다른 기기의 합성 기록 '+label)+')'));
        }
        check(label+'-does-not-write-during-replacement',await run(qa+'.calls().filter(row=>row.operation==="platformSave").length==='+before.writes));
      }
      check('loaded-source-files-unchanged', [...served.values()].every(value=>sha(fs.readFileSync(value.file))===value.sha256));
      check('no-external-requests-or-console-errors',requests.length===0&&errors.length===0,{requests,errors});
      await run(qa+'.dispose()');finish(true);
    }catch(error){finish(false,error.message);}
  }).catch(error=>{process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message})+'\n');app.exit(1);});
}
