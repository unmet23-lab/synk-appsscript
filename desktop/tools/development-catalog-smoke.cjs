'use strict';
// Existing native renderer QA pattern: hidden windows, synthetic preload and fresh AppData.
// All HTTP(S)/WebSocket requests are blocked; fixture actions never open a real app/browser.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),base=path.join(root,'artifacts/development-catalog-20261009'),prefix='SYNK_DEVELOPMENT_CATALOG ';
if(!process.versions.electron){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'synk-dev-catalog-')),runId=new Date().toISOString().replace(/[:.]/g,'-'),artifacts=path.join(base,runId);
  for(const folder of ['Roaming','Local','Temp'])fs.mkdirSync(path.join(profile,folder),{recursive:true});
  const result=require('node:child_process').spawnSync(require('electron'),[__filename,'--profile='+profile,'--artifacts='+artifacts],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,env:{...process.env,APPDATA:path.join(profile,'Roaming'),LOCALAPPDATA:path.join(profile,'Local'),TEMP:path.join(profile,'Temp'),TMP:path.join(profile,'Temp')}});
  const line=result.stdout?.split(/\r?\n/).find(value=>value.startsWith(prefix));
  const report=line?JSON.parse(line.slice(prefix.length)):{ok:false,error:result.error?.message||'NO_RESULT',stderr:result.stderr?.slice(-2000)};
  report.processExitCode=result.status;report.syntheticProfile=profile;report.profileRetainedAsEvidence=true;
  if(result.status!==0)report.ok=false;
  fs.mkdirSync(artifacts,{recursive:true});const target=path.join(artifacts,'report.json');fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({ok:report.ok,checks:report.checks?.length,failed:report.checks?.filter(item=>!item.ok),error:report.error,consoleErrors:report.consoleErrors,networkRequests:report.networkRequests,report:target},null,2)+'\n');if(!report.ok)process.exitCode=1;
}else{
  const {app,BrowserWindow,protocol,session,Menu}=require('electron'),{createNativeContent}=require('../src/native-content.cjs'),{preferences}=require('../src/security.cjs');
  const profile=process.argv.find(value=>value.startsWith('--profile='))?.slice(10),artifacts=process.argv.find(value=>value.startsWith('--artifacts='))?.slice(12);
  if(!profile||!path.isAbsolute(profile)||!path.basename(profile).startsWith('synk-dev-catalog-')||!artifacts||path.dirname(path.resolve(artifacts))!==path.resolve(base))throw Error('Explicit isolated profile and evidence directory required');
  app.enableSandbox();app.setPath('appData',path.join(profile,'Roaming'));app.setPath('userData',path.join(profile,'UserData'));app.setPath('sessionData',path.join(profile,'Session'));app.commandLine.appendSwitch('force-device-scale-factor','1');
  protocol.registerSchemesAsPrivileged([{scheme:'synk-desktop',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
  // Sequential scenarios close their isolated window before creating the next one.
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    let window;const checks=[],errors=[],requests=[],windowOpens=[];const all=/* 회원 혜택 네 서비스는 별도 혜택 화면에서 진입 */['world','messenger','path','pulse'];
    const check=(name,ok,details={})=>checks.push({name,ok:!!ok,...details});
    const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
    const run=script=>window.webContents.executeJavaScript(script);
    const settle=async()=>{await run('document.fonts.ready');await new Promise(resolve=>setTimeout(resolve,50));};
    const ids=()=>run("[...document.querySelectorAll('#app-list [data-app]')].map(node=>node.dataset.app)");
    const account=(owner,generation=1,grants=[])=>run('window.__synkCatalogFixture.switchAccount('+JSON.stringify({configured:true,status:'signed-in',signedIn:true,sessionGeneration:generation,account:{synk_user_id:owner,display_name:'합성 '+owner},library:{status:'ready',appIds:grants}})+')');
    const click=selector=>run('document.querySelector('+JSON.stringify(selector)+').click()');
    const capture=async name=>{await settle();window.webContents.invalidate();await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,150));const file=path.join(artifacts,name+'.png');fs.writeFileSync(file,(await window.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());return file;};
    async function createWindow(mode){
      const isolated=session.fromPartition('development-catalog-'+mode+'-'+Date.now());
      isolated.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));isolated.setPermissionCheckHandler(()=>false);
      isolated.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{requests.push({url:details.url,method:details.method});callback({cancel:true});});
      isolated.protocol.handle('synk-desktop',createNativeContent({appRoot:root}));
      window=new BrowserWindow({width:1280,height:960,useContentSize:true,show:false,frame:false,webPreferences:{...preferences(path.join(__dirname,'development-catalog-fixture.cjs')),session:isolated,backgroundThrottling:false,additionalArguments:['--catalog-fixture='+mode]}});
      window.webContents.setWindowOpenHandler(details=>{windowOpens.push(details.url);return {action:'deny'};});window.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
      await window.loadURL('synk-desktop://platform/index.html');
      for(let attempt=0;attempt<200;attempt++){const state=await run('document.documentElement.dataset.ready');if(state==='true')return;if(state==='error')throw Error('Renderer init failed');await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Renderer readiness timeout');
    }
    async function action(id,expected){
      const publicBenefit=expected==='public-web',selector=publicBenefit?'#benefit-detail [data-benefit-public="'+id+'"]':'#primary-action';
      if(publicBenefit){await click('[data-view="benefits"]');await click('#benefits-grid [data-benefit="'+id+'"]');}else await click('#app-list [data-app="'+id+'"]');
      const before=await run('window.__synkCatalogFixture.calls().length');
      const button=await run('(()=>{const button=document.querySelector('+JSON.stringify(selector)+');return {action:button.dataset.benefitPublic?"public-web":button.dataset.action,disabled:button.disabled};})()');
      check(id+'-action-ready',button.action===expected&&!button.disabled,button);
      if(button.disabled||button.action!==expected)return;
      await click(selector);for(let i=0;i<80;i++){if(await run('window.__synkCatalogFixture.calls().length')>before)break;await new Promise(resolve=>setTimeout(resolve,20));}await settle();
      const calls=await run('window.__synkCatalogFixture.calls()');check(id+'-fixed-action-call',calls.length===before+1&&calls.at(-1).operation===expected&&calls.at(-1).id===id&&calls.at(-1).synthetic===true,{lastCall:calls.at(-1)});
    }
    try{
      fs.mkdirSync(artifacts,{recursive:true});Menu.setApplicationMenu(null);await createWindow('development');
      check('development-guest-sees-four-catalog-cards',same(await ids(),all),{ids:await ids()});
      check('guest-home-visible-without-member-write',await run("!document.getElementById('view-home').hidden&&!document.querySelector('[data-member-add]')&&!document.getElementById('view-home').textContent.includes('아직 연결된 앱이 없어요')"));
      await click('#app-list [data-app="path"]');await click('#favorite');
      check('guest-favorite-stays-in-device-scope',await run("JSON.parse(localStorage.getItem('synk-launcher-view-v1')).favorites.includes('path')&&!Object.keys(localStorage).some(key=>key.includes(':account:'))"));
      await account('catalog-a');await settle();
      check('empty-grant-account-still-sees-four-cards',same(await ids(),all),{ids:await ids()});
      check('fixture-grants-remain-empty',await run('window.__synkCatalogFixture.snapshot().library.appIds.length===0'));
      await click('#app-list [data-app="path"]');check('guest-favorite-not-imported-to-account',await run("document.getElementById('favorite').getAttribute('aria-pressed')==='false'"));
      await click('[data-view="home"]');await click('[data-member-purpose="student"]');
      check('home-purpose-works-with-empty-grants',await run("document.querySelector('[data-member-purpose=student]').getAttribute('aria-pressed')==='true'&&!!document.querySelector('.member-next [data-member-launch],.member-next [data-member-app]')&&!document.getElementById('view-home').textContent.includes('아직 연결된 앱이 없어요')"));
      check('home-summary-has-app-and-no-overflow',await run("(()=>{const m=document.getElementById('main');return !!document.querySelector('.member-next h2')&&document.documentElement.scrollWidth<=innerWidth&&m.scrollWidth<=m.clientWidth;})()"),{screenshot:await capture('empty-grant-home-1280')});
      await click('[data-view="library"]');
      for(const [filter,expected]of [['development',all],['planned',[]],['installed',['world','messenger']],['all',all]]){await click('[data-filter="'+filter+'"]');check('catalog-filter-'+filter,same(await ids(),expected),{ids:await ids()});}
      await run("document.getElementById('search').value='리허설';document.getElementById('search').dispatchEvent(new Event('input'))");check('catalog-search-rehearsal-stays-in-benefits',!(await ids()).length&&await run("!document.getElementById('benefits-search').hidden&&!!document.querySelector('#benefits-search [data-benefit=rehearsal]')"));
      await run("document.getElementById('search').value='no-matching-synthetic-app';document.getElementById('search').dispatchEvent(new Event('input'))");check('catalog-search-empty-is-search-state',!(await ids()).length&&await run("!document.getElementById('empty-search').hidden&&document.getElementById('library-empty').hidden"));
      await run("document.getElementById('search').value='';document.getElementById('search').dispatchEvent(new Event('input'))");
      for(const id of all.filter(id=>id!=='pulse')){await click('#app-list [data-app="'+id+'"]');check('catalog-select-'+id,await run('document.querySelector(\'#app-list [data-app="'+id+'"]\').getAttribute("aria-pressed")==="true"&&!document.getElementById("app-detail").hidden'));}
      const pulseBefore=await run('window.__synkCatalogFixture.calls().length'),selectedBeforePulse=await run('document.getElementById("breadcrumb-app").textContent');await click('#app-list [data-app="pulse"]');await settle();check('pulse-sidebar-opens-independent-app',await run('window.__synkCatalogFixture.calls().length')===pulseBefore+1&&await run('window.__synkCatalogFixture.calls().at(-1).operation==="pulse-app"'));check('pulse-does-not-replace-platform-with-catalog',await run('document.getElementById("pulse-client").hidden&&document.getElementById("breadcrumb-app").textContent==='+JSON.stringify(selectedBeforePulse)));
      for(const id of ['world','messenger'])await action(id,'launch');for(const id of ['care','fortune','rehearsal'])await action(id,'public-web');
      const beforeUnknown=await run('window.__synkCatalogFixture.calls().length');
      await run("(()=>{const b=document.createElement('button');b.dataset.command='public-web';b.dataset.client='unknown-synthetic';document.body.append(b);b.click();b.remove();const a=document.createElement('button');a.dataset.app='unknown-synthetic';document.body.append(a);a.click();a.remove();})()");
      check('unknown-id-never-reaches-bridge',await run('window.__synkCatalogFixture.calls().length')===beforeUnknown);
      await click('#app-list [data-app="path"]');await click('#favorite');await click('[data-filter="favorites"]');check('account-favorite-filter',same(await ids(),['path']));await click('[data-filter="all"]');
      check('catalog-all-restored',same(await ids(),all),{screenshot:await capture('empty-grant-catalog-1280')});
      for(const width of [390,320]){window.setContentSize(width,960);await settle();check('catalog-'+width+'-no-horizontal-overflow',await run("document.documentElement.scrollWidth<=innerWidth&&document.getElementById('main').scrollWidth<=document.getElementById('main').clientWidth"),{screenshot:await capture('empty-grant-catalog-'+width)});}
      await click('[data-view="home"]');for(const width of [390,320]){window.setContentSize(width,960);await settle();check('home-'+width+'-no-horizontal-overflow',await run("document.documentElement.scrollWidth<=innerWidth&&document.getElementById('main').scrollWidth<=document.getElementById('main').clientWidth"),{screenshot:await capture('empty-grant-home-'+width)});}window.setContentSize(1280,960);await click('[data-member-add]');
      await run("(()=>{const f=document.getElementById('member-record-form');f.elements.kind.value='task';f.elements.appId.value='care';f.elements.title.value='catalog owner A local note';f.elements.body.value='synthetic owner A only';f.elements.consent.checked=true;f.requestSubmit();})()");
      check('member-local-note-saves-for-empty-grant-account',await run("document.querySelectorAll('.member-record').length===1&&document.getElementById('view-home').textContent.includes('catalog owner A local note')"));
      await account('catalog-b',2);await settle();check('account-b-keeps-four-cards-but-no-a-note',same(await ids(),all)&&await run("document.querySelectorAll('.member-record').length===0&&!document.getElementById('view-home').textContent.includes('catalog owner A local note')"));
      await click('#app-list [data-app="path"]');check('account-b-does-not-inherit-a-favorite',await run("document.getElementById('favorite').getAttribute('aria-pressed')==='false'"));
      await account('catalog-a',3);await click('[data-view="home"]');check('account-a-restores-own-local-note',await run("document.querySelectorAll('.member-record').length===1&&document.getElementById('view-home').textContent.includes('catalog owner A local note')"));
      await click('#sign-out');await settle();check('logout-keeps-catalog-hides-member-data',same(await ids(),all)&&await run("document.querySelectorAll('.member-record').length===0&&!document.querySelector('[data-member-add]')&&window.__synkCatalogFixture.snapshot().signedIn===false"));
      await click('#app-list [data-app="path"]');check('logout-restores-guest-favorite-only',await run("document.getElementById('favorite').getAttribute('aria-pressed')==='true'"));
      const calls=await run('window.__synkCatalogFixture.calls()');check('only-six-fixed-synthetic-actions',calls.length===6&&calls.every(row=>row.synthetic===true)&&same(calls.filter(row=>row.operation==='launch').map(row=>row.id),['world','messenger'])&&same(calls.filter(row=>row.operation==='public-web').map(row=>row.id),['care','fortune','rehearsal'])&&same(calls.filter(row=>row.operation==='pulse-app').map(row=>row.id),['pulse']),{calls});
      check('development-window-hidden',!window.isVisible());window.destroy();window=null;
      await createWindow('development-delayed');const timing=await run('window.__synkCatalogFixture.observations()');
      check('environment-first-auth-delayed-still-resolves-member-catalog',timing.environmentResolvedAt<timing.authStatusResolvedAt&&same(await ids(),all)&&await run("window.__synkCatalogFixture.snapshot().account.synk_user_id==='delayed-empty'&&!!document.querySelector('[data-member-add]')"),{timing});
      await click('[data-member-add]');await run("(()=>{const f=document.getElementById('member-record-form');f.elements.kind.value='note';f.elements.appId.value='world';f.elements.title.value='delayed auth owner only';f.elements.consent.checked=true;f.requestSubmit();})()");
      check('delayed-auth-home-save-keeps-verified-owner',await run("JSON.parse(localStorage.getItem('synk.platform.member-home.v1:account:delayed-empty')).owner==='delayed-empty'&&localStorage.getItem('synk.platform.member-home.v1')===null&&document.querySelectorAll('.member-record').length===1"));
      check('delayed-auth-window-hidden',!window.isVisible());window.destroy();window=null;
      await createWindow('release');check('release-guest-retains-world-only',same(await ids(),['world']));await account('release-empty',1);await settle();check('release-empty-member-has-zero-apps',!(await ids()).length&&await run("!document.getElementById('library-empty').hidden"),{screenshot:await capture('release-empty-catalog-1280')});
      await account('release-world',2,['world']);check('release-granted-world-only',same(await ids(),['world']));check('release-has-no-fixture-action',await run('window.__synkCatalogFixture.calls().length===0'));check('release-window-hidden',!window.isVisible());
      const report={ok:checks.every(item=>item.ok)&&!errors.length&&!requests.length&&!windowOpens.length,checkedAt:new Date().toISOString(),scope:'Synthetic development/release native renderer only. No real account, API, installed-app execution, public browser or network.',realAccountUsed:false,installedApplicationModified:false,realApplicationLaunched:false,externalBrowserOpened:false,checks,consoleErrors:errors,networkRequests:requests,windowOpenRequests:windowOpens};
      process.stdout.write(prefix+JSON.stringify(report)+'\n');window.destroy();app.exit(report.ok?0:1);
    }catch(error){process.stdout.write(prefix+JSON.stringify({ok:false,error:error.stack||error.message,checks,consoleErrors:errors,networkRequests:requests,windowOpenRequests:windowOpens})+'\n');window?.destroy();app.exit(1);}
  });
}
