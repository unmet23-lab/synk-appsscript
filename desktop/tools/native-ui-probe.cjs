'use strict';
const fs=require('node:fs'),path=require('node:path');
// The real bridge runs in the hidden, isolated smoke profile without signing in.
// Account-specific scenarios are in renderer-responsive-smoke with synthetic IPC.
async function probeNativeUI(contents,artifacts){
  const original=await contents.executeJavaScript("localStorage.getItem('synk-launcher-view-v1')");
  const checks=await contents.executeJavaScript(`(async()=>{
    const checks=[],q=s=>document.querySelector(s),check=(name,ok)=>checks.push({name,ok:!!ok});
    const environment=await window.synkDesktop.getEnvironment(),development=environment.mode==='development'&&environment.clientId==='platform'&&environment.nativeShell===true;
    // Source development exposes the catalogue for review. Teacher shares the
    // Workspace card; this does not grant product data or an account session.
    const expectedApps=development?['world','messenger','path','pulse','care','fortune','rehearsal','family-album']:['world'];
    q('[data-filter="all"]').click();q('#search').value='';q('#search').dispatchEvent(new Event('input',{bubbles:true}));
    const displayed=[...document.querySelectorAll('#app-list [data-app]')].map(row=>row.dataset.app);
    check('catalogue-matches-current-runtime',displayed.length===expectedApps.length&&expectedApps.every(id=>displayed.includes(id)));
    check('retired-and-shared-cards-not-duplicated',!q('[data-app="teacher"]')&&!q('[data-app="studio"]')&&!q('[data-app="shift"]')&&!q('[data-app="partners"]'));
    check('teacher-web-link-hidden',q('#teacher-web-link').hidden);
    const tiles=[...document.querySelectorAll('.app-item .tile')];check('library-marks-render-at-readable-size',tiles.length===expectedApps.length&&tiles.every(tile=>tile.textContent.trim()&&tile.getBoundingClientRect().width>=32&&tile.getBoundingClientRect().height>=32));
    q('[data-view="downloads"]').click();check('installation-manager-matches-runtime-catalogue',!q('#view-downloads').hidden&&q('#view-library').hidden&&document.querySelectorAll('.download-row').length===(development?2:1));
    q('[data-view="settings"]').click();check('settings-view',!q('#view-settings').hidden&&q('#view-downloads').hidden);
    q('#density').value='compact';q('#density').dispatchEvent(new Event('change',{bubbles:true}));check('density-persisted',document.documentElement.classList.contains('compact')&&JSON.parse(localStorage.getItem('synk-launcher-view-v1')).density==='compact');q('#density').value='comfortable';q('#density').dispatchEvent(new Event('change',{bubbles:true}));
    q('#search').value='메신저';q('#search').dispatchEvent(new Event('input',{bubbles:true}));check('search-respects-runtime-catalogue',development?document.querySelectorAll('[data-app]').length===1&&!!q('[data-app="messenger"]'):document.querySelectorAll('[data-app]').length===0);q('#search').value='';q('#search').dispatchEvent(new Event('input',{bubbles:true}));q('[data-app="world"]').click();
    const before=q('#favorite').getAttribute('aria-pressed');q('#favorite').click();check('public-world-favorite-persisted',q('#favorite').getAttribute('aria-pressed')!==before&&JSON.parse(localStorage.getItem('synk-launcher-view-v1')).favorites.includes('world')===(before!=='true'));q('#favorite').click();
    q('[data-game="racing"]').click();check('public-content-dialog',q('#content-dialog').open&&q('#content-title').textContent==='한국어 레이싱');q('#content-go-world').click();check('content-dialog-return',!q('#content-dialog').open&&q('#breadcrumb-app').textContent==='SYNK WORLD');
    q('#account-button').click();check('account-dialog',q('#account-dialog').open&&!!q('#account-state').textContent);q('#account-dialog .dialog-close').click();check('account-dialog-close',!q('#account-dialog').open);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));check('command-menu-keyboard-shortcut',q('#command-dialog').open&&document.activeElement===q('#command-input'));q('#command-dialog').close();await document.fonts.ready;check('fonts-loaded',document.fonts.status==='loaded');
    const rejected=await window.synkDesktop.windowAction('arbitrary-command');check('window-action-allowlist',rejected.code==='INVALID_WINDOW_ACTION');
    const desktop=await window.synkDesktop.getDesktopPreferences();check('desktop-preferences-ipc-ready',desktop.ok===true&&typeof desktop.preferences.closeToTray==='boolean'&&typeof desktop.preferences.zoomFactor==='number'&&desktop.capabilities.globalShortcut===false);
    const recovery=await window.synkDesktop.draftRecoveryStatus(null);check('smoke-draft-recovery-disabled',recovery.ok===true&&recovery.enabled===false);
    const diagnostic=await window.synkDesktop.copyPlatformDiagnostics({clients:[]});check('smoke-keeps-user-clipboard-untouched',diagnostic.ok===false&&diagnostic.code==='CLIPBOARD_UNAVAILABLE');return checks;
  })()`);
  for(const [name,script]of [
    ['platform-downloads-hidden-preview.png',"document.querySelector('[data-view=downloads]').click()"],
    ['platform-settings-hidden-preview.png',"document.querySelector('[data-view=settings]').click()"],
    ['platform-guest-hidden-preview.png',"document.querySelector('[data-app=world]').click()"],
    ['platform-account-hidden-preview.png',"document.getElementById('account-button').click()"],
  ]){await contents.executeJavaScript(script);await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,180));fs.writeFileSync(path.join(artifacts,name),(await contents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
  await contents.executeJavaScript(original===null?"localStorage.removeItem('synk-launcher-view-v1')":"localStorage.setItem('synk-launcher-view-v1',"+JSON.stringify(original)+")");
  await contents.executeJavaScript("document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());document.querySelector('[data-app=world]').click();document.querySelector('#main').scrollTop=0;document.querySelector('.library').scrollTop=0;");
  await contents.executeJavaScript("document.fonts.ready.then(()=>Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))))");
  await contents.executeJavaScript(original===null?"localStorage.removeItem('synk-launcher-view-v1')":"localStorage.setItem('synk-launcher-view-v1',"+JSON.stringify(original)+")");
  return {ok:checks.every(c=>c.ok),checks,installerOpened:false,clientLaunched:false,accountLoginStarted:false};
}
module.exports={probeNativeUI};
