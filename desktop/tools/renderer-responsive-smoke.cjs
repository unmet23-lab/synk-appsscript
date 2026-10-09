'use strict';
// Real Chromium rendering with synthetic test-only IPC. The hidden isolated
// profile never authenticates an account, sends network traffic or starts apps.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'artifacts');
if(!process.versions.electron){
  const {spawnSync}=require('node:child_process'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-renderer-responsive-'));
  try{
    const run=spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});
    const line=run.stdout?.split(/\r?\n/).find(value=>value.startsWith('SYNK_RESPONSIVE '));
    const result=line?JSON.parse(line.slice('SYNK_RESPONSIVE '.length)):{ok:false,error:run.error?.message||'NO_RESULT',stderr:run.stderr?.slice(-2000)};
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,'renderer-account-library-responsive-20261002.json'),JSON.stringify(result,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok:result.ok,checkCount:result.checks?.length,error:result.error,failures:result.checks?.filter(check=>!check.ok),consoleErrors:result.consoleErrors,networkRequests:result.networkRequests},null,2)+'\n');if(!result.ok)process.exitCode=1;
  }finally{if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-renderer-responsive-'))throw Error('Unsafe temporary profile');fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});}
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||!path.basename(profile).startsWith('synk-renderer-responsive-')||path.dirname(profile)!==os.tmpdir())throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const errors=[],requests=[],checks=[];
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('renderer-responsive-'+Date.now());isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      window=new BrowserWindow({width:1280,height:900,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'renderer-account-fixture.cjs')),session:isolated,backgroundThrottling:false}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(String(details.message));});
      const run=script=>window.webContents.executeJavaScript(script),check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
      const ready=async()=>{for(let i=0;i<150;i++){const state=await run("document.documentElement.dataset.ready");if(state==='true'){await run("document.querySelector('[data-view=library]').click()");return;}if(state==='error')throw Error('Renderer init failed');await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Renderer ready timeout');};
      const settle=async()=>{await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.hasAttribute('src')&&i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,140));};
      const capture=async name=>{await settle();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,180));fs.mkdirSync(artifacts,{recursive:true});const filename=path.join(artifacts,name+'.png');fs.writeFileSync(filename,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return filename;};
      const anon={configured:true,status:'signed-out',signedIn:false,sessionGeneration:0};
      let generation=1;
      const account=(id,appIds,libraryStatus='ready')=>({configured:true,status:'signed-in',signedIn:true,sessionGeneration:generation++,account:{synk_user_id:id,display_name:'합성 '+id},library:{status:libraryStatus,appIds}});
      const switchTo=async state=>{await run('window.__synkFixture.switchAccount('+JSON.stringify(state)+')');await settle();};
      const inspect=()=>run(`(()=>{const $=id=>document.getElementById(id),main=$('main'),hero=$('hero'),box=hero.getBoundingClientRect(),text=document.querySelector('.hero-text').getBoundingClientRect(),nodes=[...document.querySelectorAll('[data-app]')];return {ids:nodes.map(n=>n.dataset.app),count:$('library-count').textContent,detailHidden:$('app-detail').hidden,emptyHidden:$('library-empty').hidden,pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,main.scrollWidth-main.clientWidth),heroTextFits:$('app-detail').hidden||(text.top>=box.top&&text.bottom<=box.bottom&&text.right<=box.right),imagesLoaded:[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0),teacherLinkHidden:$('teacher-web-link').hidden,downloads:$('download-list').textContent,queueHidden:$('queue-count').hidden,textSize:document.documentElement.dataset.textSize,selected:$('breadcrumb-app').textContent,recommendationHidden:$('recommendation').hidden,recommendation:$('recommendation').textContent};})()`);
      await window.loadURL('synk-desktop://platform/index.html');await ready();
      for(const width of [1280,390,320]){
        window.setContentSize(width,900);
        const roles=[['guest',anon,['world']],['student',account('student-'+width,['world']),['world']],['teacher',account('teacher-'+width,['teacher']),['teacher']],['staff',account('staff-'+width,['messenger','studio','shift']),['messenger']],['customer',account('customer-'+width,['pulse']),['pulse']],['path',account('path-'+width,['path']),['path']],['retired',account('retired-'+width,['studio','shift']),[]],['empty',account('empty-'+width,[]),[]],['unavailable',account('unavailable-'+width,['messenger'],'unavailable'),[]],['restoring',{...anon,status:'restoring'},[]]];
        for(const [name,state,expected]of roles){
          await switchTo(state);const info=await inspect();const correct=JSON.stringify(info.ids)===JSON.stringify(expected);
          check(name+'-'+width,correct&&info.pageOverflow===0&&info.mainOverflow===0&&info.heroTextFits&&info.imagesLoaded&&info.teacherLinkHidden&&(expected.length?!info.detailHidden:info.detailHidden&&!info.emptyHidden),info);
          if(name==='path')check(name+'-preview-action-'+width,await run("document.getElementById('primary-action').dataset.action==='product-preview'&&!document.getElementById('primary-action').disabled&&document.getElementById('product-stage').textContent.includes('로컬 MVP')&&!document.getElementById('detail-content').textContent.includes('사내 대화')"));
          if(name==='staff')check('workroom-features-'+width,await run("document.getElementById('detail-content').textContent.includes('제작 데스크')&&document.getElementById('detail-content').textContent.includes('게시 전 점검')&&document.getElementById('detail-content').textContent.includes('AI 업무 연습')"));
          if(!['world','messenger'].some(id=>expected.includes(id)))check(name+'-no-installer-'+width,!/SYNK (WORLD|Messenger)/.test(info.downloads));
          if(['guest','student','teacher','staff','customer','path','retired','empty'].includes(name))checks.at(-1).screenshot=await capture('platform-account-'+name+'-'+width);
        }
        const student=account('personal-student-'+width,['world']);await switchTo(student);
        await run("document.getElementById('personal-open').click()");const dialog=await run("(()=>{const d=document.getElementById('personal-dialog');return {open:d.open,overflow:Math.max(0,d.scrollWidth-d.clientWidth),fits:d.getBoundingClientRect().width<=innerWidth};})()");check('personal-dialog-'+width,dialog.open&&dialog.overflow===0&&dialog.fits,dialog);
        await run("(()=>{const $=id=>document.getElementById(id);$('personal-context').value='teacher';$('personal-context').dispatchEvent(new Event('change'));$('personal-text').value='large';$('personal-explanation').value='brief';$('personal-motion').value='reduced';$('personal-consent').checked=false;$('personal-form').requestSubmit();})()");
        check('consent-required-'+width,await run("document.getElementById('personal-dialog').open&&document.getElementById('personal-message').textContent.includes('동의')"));
        await run("document.getElementById('personal-consent').checked=true;document.getElementById('personal-form').requestSubmit()");await settle();const info=await inspect();
        const scoped=await run("JSON.parse(localStorage.getItem('synk.platform.launcher.personalization.v1:account:personal-student-"+width+"')).profile.scope.personId");
        check('self-report-does-not-grant-'+width,JSON.stringify(info.ids)==='["world"]'&&info.textSize==='large'&&scoped==='personal-student-'+width&&!info.recommendation.includes('워크스페이스 · 내 수업')&&info.pageOverflow===0&&info.mainOverflow===0,{...info,scopePerson:scoped,screenshot:await capture('platform-account-personal-'+width)});
        await run("document.getElementById('favorite').click();document.getElementById('personal-open').click();document.getElementById('search').value='world';document.getElementById('search').dispatchEvent(new Event('input')); ");
        await switchTo(account('other-staff-'+width,['messenger']));const other=await inspect();
        check('switch-clears-prior-state-'+width,JSON.stringify(other.ids)==='["messenger"]'&&other.textSize==='standard'&&other.recommendationHidden&&await run("document.getElementById('search').value===''&&!document.getElementById('personal-dialog').open&&document.getElementById('favorite').getAttribute('aria-pressed')==='false'&&document.getElementById('last-launch').textContent==='기록 없음'"),other);
        await switchTo(student);check('same-account-restores-'+width,await run("document.documentElement.dataset.textSize==='large'&&document.getElementById('favorite').getAttribute('aria-pressed')==='true'"));
        await window.reload();await ready();await switchTo(student);check('reload-restores-only-owner-'+width,await run("document.documentElement.dataset.textSize==='large'&&document.querySelectorAll('[data-app]').length===1&&document.querySelector('[data-app]').dataset.app==='world'"));
        await run("document.querySelector('[data-game=racing]').click()");await switchTo({...student,library:{status:'unavailable',appIds:[]}});
        await run("window.__synkFixture.setClients([{id:'messenger',installer:{status:'preparing',transferredBytes:5,totalBytes:10}}])");const revoked=await inspect();check('revocation-removes-content-'+width,revoked.ids.length===0&&revoked.detailHidden&&revoked.queueHidden&&revoked.recommendationHidden&&await run("!document.getElementById('content-dialog').open&&document.getElementById('primary-action').disabled"),revoked);
        await switchTo(student);await run("document.getElementById('personal-open').click();document.getElementById('personal-clear').click()");check('account-clear-'+width,await run("document.documentElement.dataset.textSize==='standard'&&localStorage.getItem('synk.platform.launcher.personalization.v1:account:personal-student-"+width+"')===null"));
        await run("document.getElementById('sign-out').click()");await settle();const out=await inspect();check('logout-public-only-'+width,JSON.stringify(out.ids)==='["world"]'&&out.textSize==='standard'&&out.recommendationHidden&&!out.downloads.includes('Messenger'),out);
        check('no-privileged-operation-'+width,await run('window.__synkFixture.calls().length===0'));
      }
      const report={ok:checks.every(c=>c.ok)&&errors.length===0&&requests.length===0,checkedOn:'2026-10-02',scope:'Bundled renderer with synthetic account IPC in hidden isolated Electron; no real authentication or device installation',visibleWindowsOpened:false,installerOpened:false,accountLoginStarted:false,clientLaunched:false,nativeDeviceValidation:false,checks,consoleErrors:errors,networkRequests:requests};
      process.stdout.write('SYNK_RESPONSIVE '+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write('SYNK_RESPONSIVE '+JSON.stringify({ok:false,error:error.message,checks,consoleErrors:errors,networkRequests:requests})+'\n');window?.destroy();app.exit(1);}
  });
}
