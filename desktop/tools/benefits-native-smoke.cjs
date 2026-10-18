'use strict';
// Actual hidden launcher renderer, synthetic entitlements, no live login or AI.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),artifacts=process.env.SYNK_BENEFITS_OUT||path.join(root,'artifacts'),prefix='SYNK_BENEFITS_QA ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-benefits-'));
  try{
    const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});
    const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
    const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-1500)};
    fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(path.join(artifacts,'benefits-native-20261005.json'),JSON.stringify(report,null,2)+'\n');
    process.stdout.write(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(check=>!check.ok),error:report.error,consoleErrors:report.consoleErrors,requests:report.requests},null,2)+'\n');if(!report.ok)process.exitCode=1;
  }finally{
    if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('synk-benefits-'))throw Error('Unsafe temporary profile');
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:300});
  }
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10);
  if(!profile||path.dirname(profile)!==os.tmpdir()||!path.basename(profile).startsWith('synk-benefits-'))throw Error('Isolated profile required');
  app.enableSandbox();app.setPath('userData',profile);app.commandLine.appendSwitch('force-device-scale-factor','1');protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[];
    const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
    try{
      Menu.setApplicationMenu(null);const isolated=session.fromPartition('benefits-synthetic');isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push(details.url);callback({cancel:true});});
      window=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'renderer-account-fixture.cjs')),session:isolated,backgroundThrottling:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      const run=script=>window.webContents.executeJavaScript(script);
      const settle=async()=>{await run("document.fonts.ready.then(()=>Promise.all([...document.images].filter(i=>i.getAttribute('src')).map(i=>i.decode().catch(()=>{}))))");window.webContents.invalidate();await new Promise(resolve=>setTimeout(resolve,130));};
      const capture=async name=>{await settle();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,130));const target=path.join(artifacts,name+'.png');fs.mkdirSync(artifacts,{recursive:true});fs.writeFileSync(target,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return target;};
      const inspect=()=>run("(()=>{const m=document.getElementById('main');return {pageOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),mainOverflow:Math.max(0,m.scrollWidth-m.clientWidth),imagesLoaded:[...document.images].filter(i=>i.getAttribute('src')).every(i=>i.complete&&i.naturalWidth>0),benefitsVisible:!document.getElementById('view-benefits').hidden,focus:document.activeElement.id,launchCount:document.querySelectorAll('[data-benefit-preview]').length,libraryIds:[...document.querySelectorAll('[data-app]')].map(n=>n.dataset.app),title:document.querySelector('#benefit-title')?.textContent||document.getElementById('benefits-title').textContent};})()");
      await window.loadURL('synk-desktop://platform/index.html');
      for(let attempt=0;attempt<150;attempt++){const state=await run("document.documentElement.dataset.ready");if(state==='true')break;if(state==='error'||attempt===149)throw Error('Renderer not ready');await new Promise(resolve=>setTimeout(resolve,30));}
      for(const width of [1280,390,320]){
        window.setContentSize(width,960);await run("document.querySelector('.nav-links [data-view=benefits]').click()");await settle();
        let info=await inspect();check('overview-'+width,info.benefitsVisible&&!info.pageOverflow&&!info.mainOverflow&&info.imagesLoaded&&info.focus==='benefits-title'&&info.libraryIds.join(',')==='world',{...info,screenshot:await capture('platform-benefits-'+width)});
        for(const id of ['care','fortune']){
          await run("document.querySelector('[data-benefit=\""+id+"\"]').click()");await settle();info=await inspect();
          check(id+'-detail-'+width,info.benefitsVisible&&!info.pageOverflow&&!info.mainOverflow&&info.imagesLoaded&&info.focus==='benefit-title'&&!info.launchCount,{...info,screenshot:await capture('platform-benefit-'+id+'-'+width)});
        }
        await run("document.querySelector('.benefit-back').click()");check('back-to-overview-'+width,await run("!document.getElementById('benefits-overview').hidden&&document.getElementById('benefit-detail').hidden&&document.activeElement.id==='benefits-title'"));
      }
      await run("window.__synkFixture.switchAccount({configured:true,status:'signed-in',signedIn:true,sessionGeneration:1,account:{synk_user_id:'synthetic-benefit-member'},library:{status:'ready',appIds:['care']}});document.querySelector('[data-benefit=care]').click()");
      check('authorized-preview',await run("document.querySelector('[data-benefit-preview=care]')!==null"));
      await run("document.querySelector('[data-benefit-preview=care]').click()");await settle();check('uses-existing-native-preview',await run("JSON.stringify(window.__synkFixture.calls())==='[\"product-preview:care\"]'"));
      await run("window.__synkFixture.switchAccount({configured:true,status:'signed-in',signedIn:true,sessionGeneration:2,account:{synk_user_id:'synthetic-benefit-member'},library:{status:'ready',appIds:[]}})");
      check('revocation-removes-action-keeps-public-detail',await run("!document.getElementById('benefit-detail').hidden&&document.querySelector('[data-benefit-preview]')===null&&document.querySelectorAll('[data-app]').length===0"));
      check('window-remains-hidden',!window.isVisible());
      check('retired-benefits-absent',await run("document.querySelector('[data-benefit=rehearsal]')===null&&document.querySelector('[data-benefit=family-album]')===null&&document.querySelectorAll('.benefit-card').length===4"));
      const report={ok:checks.every(item=>item.ok)&&!errors.length&&!requests.length,checkedOn:new Date().toISOString(),scope:'Hidden Electron launcher at 1280/390/320, public benefit navigation and synthetic native preview permissions. No live login, product launch, paid AI or deployment.',checks,consoleErrors:errors,requests};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.message,checks,consoleErrors:errors,requests})+'\n');window?.destroy();app.exit(1);}
  });
}
