'use strict';
const fs=require('node:fs'),path=require('node:path');
// 개발 점검 실행(--synk-smoke)에서 진짜 다리로 검정 구 얼굴이 서는지 본다. 로그인하지 않은 숨은 창이다.
// 옛 런처의 보기와 대화상자는 PC 0.5.0에서 거뒀으므로(PC 0.5.0 설계 4절) 그것들이 없는지도 본다. 화면 흐름은 orb-face-browser-qa.cjs가 본다.
async function probeNativeUI(contents,artifacts){
  const checks=await contents.executeJavaScript(`(async()=>{
    const checks=[],q=s=>document.querySelector(s),check=(name,ok)=>checks.push({name,ok:!!ok}),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    for(let i=0;i<240&&q('#portal-entry')?.dataset.portalState!=='auth';i++)await wait(50);
    check('orb-face-mounted',!!q('#portal-entry [data-portal-stage]')&&!!q('#portal-entry')?.dataset.portalState&&!q('.host-fallback'));
    q('#portal-entry')?.dispatchEvent(new CustomEvent('synk:qa-guest-entry'));
    for(let i=0;i<240&&document.documentElement.dataset.orbClient!=='app';i++)await wait(50);
    check('orb-qa-guest-entry',document.documentElement.dataset.orbClient==='app'&&q('#portal-entry')?.dataset.portalState==='entered');
    check('old-launcher-views-gone',['#view-home','#view-library','#view-settings','#view-downloads','#account-dialog','#command-dialog','#content-dialog'].every(s=>!q(s))&&!!q('#view-account')?.hidden);
    await document.fonts.ready;check('fonts-loaded',document.fonts.status==='loaded');
    const rejected=await window.synkDesktop.windowAction('arbitrary-command');check('window-action-allowlist',rejected.code==='INVALID_WINDOW_ACTION');
    const desktop=await window.synkDesktop.getDesktopPreferences();check('desktop-preferences-ipc-ready',desktop.ok===true&&typeof desktop.preferences.closeToTray==='boolean'&&typeof desktop.preferences.zoomFactor==='number'&&desktop.capabilities.globalShortcut===false);
    const diagnostic=await window.synkDesktop.copyPlatformDiagnostics({clients:[]});check('smoke-keeps-user-clipboard-untouched',diagnostic.ok===false&&diagnostic.code==='CLIPBOARD_UNAVAILABLE');return checks;
  })()`);
  await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,180));
  fs.writeFileSync(path.join(artifacts,'platform-face-hidden-preview.png'),(await contents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  return {ok:checks.every(c=>c.ok),checks,installerOpened:false,clientLaunched:false,accountLoginStarted:false};
}
module.exports={probeNativeUI};
