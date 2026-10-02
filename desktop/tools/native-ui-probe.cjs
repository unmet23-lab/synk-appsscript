'use strict';
const fs=require('node:fs'),path=require('node:path');
// The real bridge runs in the hidden, isolated smoke profile without signing in.
// Account-specific scenarios are in renderer-responsive-smoke with synthetic IPC.
async function probeNativeUI(contents,artifacts){
  const original=await contents.executeJavaScript("localStorage.getItem('synk-launcher-view-v1')");
  const checks=await contents.executeJavaScript(`(async()=>{
    const checks=[],q=s=>document.querySelector(s),check=(name,ok)=>checks.push({name,ok:!!ok});
    q('[data-filter="all"]').click();q('#search').value='';q('#search').dispatchEvent(new Event('input',{bubbles:true}));
    check('guest-only-public-world',document.querySelectorAll('[data-app]').length===1&&!!q('[data-app="world"]'));
    check('guest-no-staff-or-planned-apps',!q('[data-app="messenger"]')&&!q('[data-app="teacher"]')&&!q('[data-app="studio"]')&&!q('[data-app="pulse"]'));
    check('teacher-web-link-hidden',q('#teacher-web-link').hidden);
    await Promise.all([...document.querySelectorAll('.app-item img')].map(image=>image.decode().catch(()=>{})));check('library-icons-loaded-and-visible',[...document.querySelectorAll('.app-item img')].every(image=>image.complete&&image.naturalWidth>0&&image.getBoundingClientRect().width>=32));
    q('[data-view="downloads"]').click();check('installation-manager-no-private-apps',!q('#view-downloads').hidden&&q('#view-library').hidden&&!q('#download-list').textContent.includes('Messenger')&&document.querySelectorAll('.download-row').length<=1);
    q('[data-view="settings"]').click();check('settings-view',!q('#view-settings').hidden&&q('#view-downloads').hidden);
    q('#density').value='compact';q('#density').dispatchEvent(new Event('change',{bubbles:true}));check('density-persisted',document.documentElement.classList.contains('compact')&&JSON.parse(localStorage.getItem('synk-launcher-view-v1')).density==='compact');q('#density').value='comfortable';q('#density').dispatchEvent(new Event('change',{bubbles:true}));
    q('#search').value='메신저';q('#search').dispatchEvent(new Event('input',{bubbles:true}));check('search-cannot-discover-private-apps',document.querySelectorAll('[data-app]').length===0);q('#search').value='';q('#search').dispatchEvent(new Event('input',{bubbles:true}));q('[data-app="world"]').click();
    const before=q('#favorite').getAttribute('aria-pressed');q('#favorite').click();check('public-world-favorite-persisted',q('#favorite').getAttribute('aria-pressed')!==before&&JSON.parse(localStorage.getItem('synk-launcher-view-v1')).favorites.includes('world')===(before!=='true'));q('#favorite').click();
    q('[data-game="racing"]').click();check('public-content-dialog',q('#content-dialog').open&&q('#content-title').textContent==='한국어 레이싱');q('#content-go-world').click();check('content-dialog-return',!q('#content-dialog').open&&q('#breadcrumb-app').textContent==='SYNK WORLD');
    q('#account-button').click();check('account-dialog',q('#account-dialog').open&&!!q('#account-state').textContent);q('#account-dialog .dialog-close').click();check('account-dialog-close',!q('#account-dialog').open);
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));check('search-keyboard-shortcut',document.activeElement===q('#search'));q('#search').blur();await document.fonts.ready;check('fonts-loaded',document.fonts.status==='loaded');
    const rejected=await window.synkDesktop.windowAction('arbitrary-command');check('window-action-allowlist',rejected.code==='INVALID_WINDOW_ACTION');return checks;
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
