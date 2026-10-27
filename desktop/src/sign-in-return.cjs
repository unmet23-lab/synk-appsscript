'use strict';
// Back from the browser: a SYNK ID sign-in this app opened ends in the browser tab, so the app that asked comes to
// the front instead of leaving the member on the loopback page. It follows auth-service snapshots: 'signing-in'
// starts the wait, 'restoring' (install() checking the new session) passes, and the first other state ends it —
// signed in, refused or cancelled in the browser, or a failed callback. A five-minute timeout stays quiet: nobody
// is waiting at the browser then, and the app already says so when it is next opened.
function createSignInReturn(){
  let waiting=false;
  return function ended(state){
    if(state?.status==='signing-in'){waiting=true;return false;}
    if(!waiting||state?.status==='restoring')return false;
    waiting=false;
    return state?.signedIn===true||state?.error?.code!=='AUTH_TIMEOUT';
  };
}
// Windows only lets the foreground app hand focus over, and the browser is in front, so a plain focus() just flashes
// the taskbar. Holding the window on top for the one call puts it over the browser; it drops back to normal at once.
// On a Mac the window comes forward only when the app itself is activated (app.focus with steal).
function bringToFront(window,{platform=process.platform,app=null}={}){
  if(!window||window.isDestroyed())return false;
  if(window.isMinimized())window.restore();
  window.show();
  if(platform==='win32'){window.setAlwaysOnTop(true);window.focus();window.setAlwaysOnTop(false);}
  else{if(platform==='darwin')app?.focus?.({steal:true});window.focus();}
  return true;
}
module.exports={createSignInReturn,bringToFront};
