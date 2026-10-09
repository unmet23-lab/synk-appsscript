'use strict';
// Production renderer and OS encryption; a temporary profile and synthetic
// identities only. No real desktop interaction, login or network traffic.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts','convenience-home-20261009'),prefix='SYNK_CONVENIENCE_HOME ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-convenience-home-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-2000)};
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(row=>!row.ok),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests},null,2));if(!report.ok)process.exitCode=1;
  }finally{if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-convenience-home-'))throw Error('Unsafe QA profile');fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});}
}else{
  const {app,BrowserWindow,protocol,session,ipcMain,safeStorage}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs'),{createDraftRecovery}=require('../src/draft-recovery.cjs'),{createDraftRecoveryRequests}=require('../src/draft-recovery-ipc.cjs');
  const profile=process.argv.find(arg=>arg.startsWith('--profile='))?.slice(10);if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-convenience-home-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let window,auth={configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'qa-member-a',display_name:'검증 계정'},library:{status:'ready',appIds:['world','care']}};
    const checks=[],errors=[],requests=[];const check=(name,ok,detail)=>checks.push({name,ok:!!ok,...(detail?{detail}:{})});
    const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
    const store=createDraftRecovery({directory:path.join(profile,'DraftRecovery'),safeStorage,getAccount:()=>auth,onChange:status=>window?.webContents.send('qa:draft-changed',status)});
    const requestsBridge=createDraftRecoveryRequests({getAccount:()=>auth,recovery:store});
    const handlers={'qa:auth':()=>auth,'qa:switch':value=>{auth={...auth,...value,sessionGeneration:auth.sessionGeneration+1};window.webContents.send('qa:auth-changed',auth);return true;},'qa:draft-status':owner=>requestsBridge.status(owner),'qa:draft-enabled':(value,owner)=>requestsBridge.setEnabled(value,owner),'qa:draft-load':(slot,owner)=>requestsBridge.load(slot,owner),'qa:draft-save':(slot,value,owner)=>requestsBridge.save(slot,value,owner),'qa:draft-clear':(slot,owner)=>requestsBridge.clear(slot,owner)};
    for(const [name,fn]of Object.entries(handlers))ipcMain.handle(name,(_event,...args)=>fn(...args));
    const isolated=session.fromPartition('persist:convenience-home-qa');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
    const run=code=>window.webContents.executeJavaScript(/^(const|let) /.test(code)?'(()=>{'+code+'})()':code);
    async function boot(){
      window=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'convenience-home-fixture.cjs')),session:isolated,backgroundThrottling:false}});window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));await window.loadURL('synk-desktop://platform/index.html');
      for(let count=0;count<60;count++){if(await run("document.documentElement.dataset.ready==='true'&&!!document.querySelector('[data-member-add]')"))break;await pause();}await pause();
    }
    async function type(title,body=''){await run(`document.querySelector('[data-member-add]').click();(()=>{const f=document.querySelector('#member-record-form');f.elements.title.value=${JSON.stringify(title)};f.elements.body.value=${JSON.stringify(body)};f.elements.title.dispatchEvent(new Event('input',{bubbles:true}));})()`);await pause();await pause();await pause();}
    try{
      fs.mkdirSync(out,{recursive:true});await boot();check('os-encryption-available',store.available());check('recovery-default-off',(await store.status()).enabled===false);
      await type('동의 전에는 보관하지 않음');check('consent-off-no-recovery-file',!fs.existsSync(path.join(profile,'DraftRecovery')));
      await run("document.querySelector('[data-member-cancel]').click();document.querySelector('[data-member-discard]').click()");await store.setEnabled(true);await pause();await type('다시 시작할 초안','암호화한 내용');
      const saved=await store.load('member-home');check('input-backed-up-through-real-ipc',saved.draft?.title==='다시 시작할 초안');
      const encrypted=fs.readdirSync(path.join(profile,'DraftRecovery')).filter(name=>name.endsWith('.enc')).map(name=>fs.readFileSync(path.join(profile,'DraftRecovery',name)));check('no-plaintext-draft-on-disk',encrypted.length===1&&!encrypted.some(data=>data.includes(Buffer.from('다시 시작할 초안'))));
      window.destroy();await boot();check('restart-offers-recovery-without-autosave',await run("!!document.querySelector('[data-member-recover]')&&!document.querySelector('#member-record-form')&&document.querySelectorAll('.member-record').length===0"));
      await run("document.querySelector('[data-member-recover]').click()");check('recovered-fields-and-renewed-save-consent',await run("document.querySelector('#member-record-form').elements.title.value==='다시 시작할 초안'&&!document.querySelector('#member-record-form').elements.consent.checked"));
      await run("const f=document.querySelector('#member-record-form');f.elements.consent.checked=true;f.requestSubmit()");await pause();check('save-clears-encrypted-backup',(await store.load('member-home')).draft===null);
      await type('완료 기록','찾을 수 있는 내용');await run("let f=document.querySelector('#member-record-form');f.elements.consent.checked=true;f.requestSubmit();document.querySelector('[data-member-toggle]').click()");await pause();
      await run("const f=document.querySelector('[data-member-record-search]');f.value='암호화한 내용';f.dispatchEvent(new Event('input',{bubbles:true}))");check('search-finds-body',await run("document.querySelectorAll('.member-record').length===1&&document.querySelector('.member-record').textContent.includes('다시 시작할 초안')"));
      await run("const f=document.querySelector('[data-member-record-search]');f.value='';f.dispatchEvent(new Event('input',{bubbles:true}));const s=document.querySelector('[data-member-record-filter]');s.value='done';s.dispatchEvent(new Event('change',{bubbles:true}))");check('completed-filter',await run("document.querySelectorAll('.member-record').length===1&&document.querySelector('[data-member-toggle]').getAttribute('aria-pressed')==='true'"));
      for(const width of [1280,390,320]){window.setContentSize(width,960);await run("document.querySelector('.member-record-filters').scrollIntoView({block:'center'})");await pause();const size=await run("({page:document.documentElement.scrollWidth<=innerWidth+1,main:document.getElementById('main').scrollWidth<=document.getElementById('main').clientWidth+1})");check('filtered-records-fit-'+width,size.page&&size.main,size);fs.writeFileSync(path.join(out,'records-'+width+'.png'),(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
      await type('계정 A에만 보여야 하는 초안');await run("window.__convenienceHomeQA.switchAccount({account:{synk_user_id:'qa-member-b'},library:{status:'ready',appIds:['world']}})");await pause();check('other-account-cannot-see-draft-or-records',await run("!document.querySelector('[data-member-recover]')&&!document.querySelector('#member-record-form')&&document.querySelectorAll('.member-record').length===0"));check('other-account-consent-is-off',(await store.status()).enabled===false);
      await run("window.__convenienceHomeQA.switchAccount({account:{synk_user_id:'qa-member-a'},library:{status:'ready',appIds:['care']}})");await pause();check('revoked-app-not-offered',await run("!document.querySelector('[data-member-recover]')&&document.querySelectorAll('.member-record').length===0"));
      await run("window.__convenienceHomeQA.switchAccount({library:{status:'ready',appIds:['world','care']}})");await pause();await pause();check('same-owner-may-recover-again',await run("!!document.querySelector('[data-member-recover]')"));await store.setEnabled(false);await pause();check('disable-purges-backup-and-banner',!(await store.load('member-home')).draft&&await run("!document.querySelector('[data-member-recover]')"));
      check('window-stayed-hidden',!window.isVisible());check('no-network-or-console-errors',requests.length===0&&errors.length===0);
      const report={ok:checks.every(row=>row.ok),checkedOn:'2026-10-09',scope:'Hidden Electron with real OS encryption and production renderer; isolated synthetic accounts, no live login or deployment.',checks,consoleErrors:errors,requests};console.log(prefix+JSON.stringify(report));window.destroy();app.exit(report.ok?0:1);
    }catch(error){console.log(prefix+JSON.stringify({ok:false,error:error.stack,checks,consoleErrors:errors,requests}));window?.destroy();app.exit(1);}
  });
}
