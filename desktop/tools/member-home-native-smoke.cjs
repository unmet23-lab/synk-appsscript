'use strict';
// Hidden Electron + isolated synthetic account; external requests are blocked.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts'),prefix='SYNK_MEMBER_HOME_QA ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-member-home-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1500)};
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,'member-home-native-20261008.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests},null,2)+'\n');if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-member-home-'))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-member-home-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[];const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('member-home-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
      window=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'renderer-account-fixture.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      const run=script=>window.webContents.executeJavaScript(script);
      const settle=async()=>{await run('document.fonts.ready');window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,120));};
      const capture=async name=>{await settle();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,130));const target=path.join(artifacts,name+'.png');fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(target,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return target;};
      const inspect=()=>run("(()=>{const m=document.getElementById('main');return {pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,m.scrollWidth-m.clientWidth),home:!document.getElementById('view-home').hidden,records:document.querySelectorAll('.member-record').length};})()");
      const account=(id,ids=['world','care'])=>run('window.__synkFixture.switchAccount('+JSON.stringify({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:id},library:{status:'ready',appIds:ids}})+')');
      await window.loadURL('synk-desktop://platform/index.html');
      for(let attempt=0;attempt<150;attempt++){const state=await run('document.documentElement.dataset.ready');if(state==='true')break;if(state==='error'||attempt===149)throw Error('Renderer not ready');await new Promise(resolve=>setTimeout(resolve,30));}
      check('guest-home-no-storage-action',await run("!document.getElementById('view-home').hidden&&!document.querySelector('[data-member-add]')&&document.querySelector('[data-member-purpose=student]')!==null"));
      await account('member-a');
      await run("document.querySelector('[data-member-purpose=student]').click()");
      check('purpose-guides-this-window-without-saving',await run("document.querySelector('.member-purpose [data-member-purpose=student]').getAttribute('aria-pressed')==='true'&&!document.getElementById('personal-dialog').open&&![...Array(localStorage.length)].map((_,i)=>localStorage.key(i)).some(key=>key.includes('personalization'))"));
      await run("document.querySelector('[data-member-remember]').click();document.getElementById('personal-consent').checked=true;document.getElementById('personal-form').requestSubmit()");
      const purposeState=await run("({pressed:document.querySelector('.member-purpose [data-member-purpose=student]').getAttribute('aria-pressed'),open:document.getElementById('personal-dialog').open,message:document.getElementById('personal-message').textContent})");
      check('purpose-reuses-existing-consented-atlas-settings',purposeState.pressed==='true'&&!purposeState.open,purposeState);
      const add=async(kind,title)=>run("document.querySelector('[data-member-add]').click();(()=>{const f=document.getElementById('member-record-form');f.elements.kind.value="+JSON.stringify(kind)+";f.elements.title.value="+JSON.stringify(title)+";f.elements.body.value='내가 직접 적은 다음 행동과 결과';f.elements.consent.checked=true;f.requestSubmit();})()");
      await add('task','다음 한국어 연습');await add('note','오늘의 결과 <script>');
      check('task-and-note-save-with-escaped-text',await run("document.querySelectorAll('.member-record').length===2&&document.getElementById('view-home').textContent.includes('오늘의 결과 <script>')&&!document.querySelector('#view-home script')"));
      await run("document.querySelector('[data-member-toggle]').click()");check('task-complete',await run("document.querySelector('[data-member-toggle]').getAttribute('aria-pressed')==='true'"));
      await run("document.querySelector('[data-member-toggle]').click()");check('task-reopen',await run("document.querySelector('[data-member-toggle]').getAttribute('aria-pressed')==='false'"));
      for(const width of [1280,390,320]){
        window.setContentSize(width,960);await run("document.getElementById('main').scrollTop=0;window.scrollTo(0,0);document.getElementById('toast').hidden=true");await settle();const info=await inspect();check('home-layout-'+width,info.home&&!info.pageOverflow&&!info.mainOverflow&&info.records===2,{...info,screenshot:await capture('member-home-'+width)});
        await run("document.querySelector('.member-record-columns').scrollIntoView({block:'center'})");check('record-layout-'+width,!(await inspect()).mainOverflow,{screenshot:await capture('member-home-records-'+width)});
        await run("document.querySelector('[data-member-add]').click();document.querySelector('#member-record-form [name=title]').value='새로고침 중인 초안'");
        await run("window.__synkFixture.setClients([])");check('draft-survives-refresh-'+width,await run("document.querySelector('#member-record-form [name=title]').value==='새로고침 중인 초안'"));
        const form=await inspect();check('form-layout-'+width,!form.pageOverflow&&!form.mainOverflow);await run("document.querySelector('[data-member-cancel]').click()");
        check('cancel-keeps-draft-until-explicit-discard-'+width,await run("document.querySelector('#member-record-form [name=title]').value==='새로고침 중인 초안'&&!!document.querySelector('[data-member-discard]')"));
        await run("document.querySelector('[data-member-discard]').click()");
      }
      await run("document.querySelector('[data-member-app=world]').click()");check('app-link-opens-existing-library',await run("!document.getElementById('view-library').hidden&&document.getElementById('breadcrumb-app').textContent==='SYNK WORLD'"));
      await run("document.querySelector('[data-view=home]').click()");await account('member-b');check('account-switch-clears-records',await run("document.querySelectorAll('.member-record').length===0"));
      await account('member-a',['care']);check('revoked-app-hides-records',await run("document.querySelectorAll('.member-record').length===0&&![...document.querySelectorAll('[data-member-app]')].some(node=>node.dataset.memberApp==='world')"));
      await account('member-a');check('owner-restores-records',await run("document.querySelectorAll('.member-record').length===2"));
      await run("document.querySelector('[data-member-remove]').click()");check('deletion-persists',await run("document.querySelectorAll('.member-record').length===1"));
      await run("window.__synkFixture.switchAccount({configured:true,status:'signed-out',signedIn:false,sessionGeneration:2})");check('logout-removes-member-records',await run("document.querySelectorAll('.member-record').length===0&&!document.querySelector('[data-member-add]')"));
      check('no-app-launch-requested',await run("window.__synkFixture.calls().length===0"));check('window-hidden',!window.isVisible());
      const report={ok:checks.every(item=>item.ok)&&!errors.length&&!requests.length,checkedOn:'2026-10-08',scope:'Hidden Electron, synthetic accounts and 1280/390/320px interaction; no live login, deployment or AI.',checks,consoleErrors:errors,requests};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checks,consoleErrors:errors,requests})+'\n');window?.destroy();app.exit(1);}
  });
}
