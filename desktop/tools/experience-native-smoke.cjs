'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','experience-20261008'),prefix='SYNK_EXPERIENCE_QA ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-experience-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=result.stdout?.split(/\r?\n/).find(item=>item.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1800)};
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(item=>!item.ok),error:report.error,errors:report.errors,requests:report.requests},null,2));
    if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-experience-'))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron');
  const {createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs'),{installDraftExitGuard}=require('../src/draft-exit.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-experience-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let win;const checks=[],errors=[],requests=[],prompts=[];let nativeChoice=0;
    const check=(name,ok,details={})=>{checks.push({name,ok:!!ok,...details});if(!ok)throw Error(name);};
    const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    try{
      fs.mkdirSync(out,{recursive:true});Menu.setApplicationMenu(null);
      const isolated=session.fromPartition('experience-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(request,callback)=>{requests.push(request.url);callback({cancel:true});});
      win=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'experience-fixture.cjs')),session:isolated,backgroundThrottling:false,offscreen:true}});
      win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      installDraftExitGuard({contents:win.webContents,window:win,dialog:{showMessageBoxSync(_window,options){prompts.push(options.message);return nativeChoice;}}});
      const run=source=>win.webContents.executeJavaScript(source);
      const until=async source=>{for(let i=0;i<70;i++){if(await run(source))return true;await pause(30);}return false;};
      // 나가기 확인창의 선택(남기기·버리기·Esc)은 앱의 close 처리가 실행된 뒤에 다음 동작을 한다. 브라우저가 닫히자마자 커서를 먼저 돌려놓아 고정 시간·커서 위치로는 기다림이 모자랐다.
      const armLeave=()=>run("window.__leaveClosed=false;document.getElementById('leave-dialog').addEventListener('close',()=>{window.__leaveClosed=true;},{once:true})");
      const decide=async value=>{await armLeave();await run("document.querySelector('#leave-dialog [value="+value+"]').click()");await until('window.__leaveClosed===true');};
      const account=(id='journey-a',status='ready')=>run('window.__journeyQA.setAccount('+JSON.stringify({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:id},library:{status,appIds:status==='ready'?['world','care']:[]}})+')');
      const draft=title=>run("document.querySelector('[data-member-add]').click();document.querySelector('#member-record-form [name=title]').value="+JSON.stringify(title)+";document.querySelector('#member-record-form [name=body]').value='남겨 둘 내용';document.querySelector('#member-record-form [name=title]').dispatchEvent(new Event('input',{bubbles:true}))");
      const capture=async name=>{await run('document.fonts.ready');win.webContents.invalidate();await pause(140);const file=path.join(out,name+'.png');fs.writeFileSync(file,(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return file;};
      await win.loadURL('synk-desktop://platform/index.html');check('renderer-ready',await until("document.documentElement.dataset.ready==='true'"));
      check('late-environment-enables-home-launch',await run("!!document.querySelector('[data-member-launch=care]')"));
      await account();
      await run("document.querySelector('[data-member-purpose=student]').click()");
      check('purpose-does-not-force-dialog-or-save',await run("!document.getElementById('personal-dialog').open&&!Object.keys(localStorage).some(key=>key.includes('personalization'))&&document.querySelector('.member-session-note')!==null"));
      await run("window.__journeyQA.setAccount({configured:true,status:'restoring',signedIn:false,sessionGeneration:1})");
      check('temporary-identity-check-hides-session-purpose',await run("!document.querySelector('.member-session-note')"));
      await account();
      check('same-account-recovers-session-purpose',await run("document.querySelector('[data-member-purpose=student]').getAttribute('aria-pressed')==='true'&&!!document.querySelector('.member-session-note')"));
      await run("window.__journeyQA.setAccount({configured:true,status:'error',signedIn:false,sessionGeneration:1,error:{code:'AUTH_SERVER_UNAVAILABLE',retryable:true,message:'합성 연결 실패'}});document.querySelector('[data-member-retry]').click()");
      check('retryable-auth-error-loads-and-restores',await until("window.__journeyQA.calls().includes('account:load')&&!!document.querySelector('[data-member-launch=world]')&&!!document.querySelector('.member-session-note')"));
      await run("document.querySelector('[data-member-launch=world]').click();document.querySelector('[data-member-launch=world]')?.click()");
      check('pending-keeps-home-action-disabled',await run("document.querySelector('.member-next [data-member-launch=world]')?.disabled===true"));
      check('direct-launch-finishes',await until("Object.values(JSON.parse(localStorage.getItem('synk-launcher-view-v1:account:journey-a')||'{}').lastLaunch||{}).filter(value=>Number.isSafeInteger(value)&&value>0).length===1"));
      await pause(200);check('direct-launch-single-call',await run("window.__journeyQA.calls().filter(value=>value==='launch:world').length===1"));
      check('launch-stays-on-home',await run("!document.getElementById('view-home').hidden"));
      await account('journey-failed');await run("window.__journeyQA.setLaunchResult(false);document.querySelector('[data-member-launch=world]').click()");await pause(300);
      check('failed-launch-is-not-recent',await run("!JSON.parse(localStorage.getItem('synk-launcher-view-v1:account:journey-failed')||'{}').lastLaunch?.world"));
      await account();await run("window.__journeyQA.setLaunchResult(true)");
      for(const width of [1280,390,320]){
        win.setContentSize(width,960);await pause(80);
        if(width<760)await run("document.getElementById('library-search-toggle').click()");
        await run("document.getElementById('search').value='운세';document.getElementById('search').dispatchEvent(new Event('input',{bubbles:true}))");
        const metrics=await run("(()=>{const search=document.getElementById('search'),result=document.querySelector('#benefits-search [data-benefit=fortune]');return {search:search.getBoundingClientRect().height>0,result:!!result&&result.getBoundingClientRect().height>0,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};})()");
        check('search-and-benefits-'+width,metrics.search&&metrics.result&&!metrics.overflow,metrics);
        if(width===320)await capture('mobile-search-320');
        await run("document.querySelector('#benefits-search [data-benefit=fortune]').click();document.getElementById('brand-home').click();document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input',{bubbles:true}))");
        if(width<760){await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");check('escape-closes-search-'+width,await run("document.getElementById('library-search-toggle').getAttribute('aria-expanded')==='false'"));await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");/* 10-09 편의 기능부터 Ctrl+K는 라이브러리 검색칸 대신 빠른 검색 창을 연다(다시 누르면 닫힘). */check('shortcut-opens-quick-search-'+width,await run("(()=>{const input=document.getElementById('command-input');return !!input&&input===document.activeElement&&!!input.closest('dialog[open]')&&input.getBoundingClientRect().height>0;})()"));await run("document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))");check('shortcut-closes-quick-search-'+width,await run("!document.getElementById('command-input')?.closest('dialog[open]')"));}
      }
      win.setContentSize(1280,960);await run("document.getElementById('main').scrollTop=0");await capture('home-1280');
      await draft('종료 전에 남길 메모');await run("document.querySelector('[data-window=close]').click()");
      check('custom-close-prompts-before-bridge',await until("document.getElementById('leave-dialog').open"));
      await decide('keep');
      check('keep-preserves-draft',await run("document.querySelector('#member-record-form [name=title]').value==='종료 전에 남길 메모'&&!window.__journeyQA.calls().includes('window:close')"));
      await run("document.querySelector('[data-window=close]').click()");await until("document.getElementById('leave-dialog').open");await decide('discard');/* 버리기는 메모 복구본을 먼저 비운 뒤 창 닫기를 요청하므로 고정 시간 대신 요청을 기다린다. */await until("window.__journeyQA.calls().includes('window:close')");
      check('explicit-discard-allows-close-request',await run("window.__journeyQA.calls().filter(value=>value==='window:close').length===1&&!document.getElementById('member-record-form')"),await run("({calls:window.__journeyQA.calls(),form:!!document.getElementById('member-record-form'),dialog:document.getElementById('leave-dialog').open,decision:document.getElementById('leave-dialog').returnValue})"));
      await draft('Escape로 지키는 새 메모');await run("document.querySelector('[data-window=close]').click()");await until("document.getElementById('leave-dialog').open");
      await armLeave();win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
      check('escape-cancels-reopened-discard-dialog',await until("!document.getElementById('leave-dialog').open"));
      check('escape-does-not-reuse-discard-decision',await run("document.querySelector('#member-record-form [name=title]').value==='Escape로 지키는 새 메모'&&window.__journeyQA.calls().filter(value=>value==='window:close').length===1"));
      await until('window.__leaveClosed===true');await run("document.getElementById('account-button').click();document.getElementById('sign-out').click()");check('logout-prompts',await until("document.getElementById('leave-dialog').open"));await decide('keep');
      check('cancelled-logout-keeps-account-and-draft',await run("!window.__journeyQA.calls().includes('logout')&&!!document.getElementById('member-record-form')"));
      await account('journey-a','unavailable');check('unavailable-hides-draft-and-offers-retry',await run("!document.getElementById('member-record-form')&&!!document.querySelector('[data-member-retry]')"));
      await run("document.querySelector('[data-member-retry]').click()");check('retry-restores-same-account-draft',await until("document.querySelector('#member-record-form [name=title]')?.value==='Escape로 지키는 새 메모'"));
      win.close();await pause(180);check('native-os-close-keeps-draft',!win.isDestroyed()&&prompts.length===1);
      await run("document.querySelector('#member-record-form [name=consent]').checked=true;document.getElementById('member-record-form').requestSubmit()");
      check('save-releases-unload-guard',await run("(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return !event.defaultPrevented&&document.querySelectorAll('.member-record').length===1;})()"));
      await draft('다른 계정에는 안 보이는 메모');await account('journey-b');
      check('account-switch-clears-foreign-draft',await run("!document.getElementById('member-record-form')&&!document.getElementById('view-home').textContent.includes('다른 계정에는 안 보이는 메모')"));
      await draft('마지막 닫기 검증');nativeChoice=1;win.close();await pause(180);check('native-explicit-discard-closes',win.isDestroyed()&&prompts.length===2);
      check('no-external-requests-or-console-errors',!requests.length&&!errors.length,{requests,errors});
      process.stdout.write(prefix+JSON.stringify({ok:true,checkedOn:'2026-10-08',scope:'Hidden Electron, synthetic accounts/launches, actual native close event; no real login/install/deploy.',checks,errors,requests})+'\n');app.exit(0);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checks,errors,requests})+'\n');if(win&&!win.isDestroyed())win.destroy();app.exit(1);}
  });
}
