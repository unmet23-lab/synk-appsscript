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
// Windows lets only the foreground app hand focus over, and the browser that just finished the sign-in is in front: a
// focus() only flashes the taskbar — and leaves the page believing it has focus, so a notice meant to wait for the member's
// return runs out unseen. An always-on-top flip undone in the same tick never reaches the screen either. Held on top for a
// moment, the window comes over the browser and stays there, without taking the keyboard (measured 10-28 with Electron 44
// against Chrome: undone after 400ms it stays above; at once, or with focus(), it stays behind).
// On a Mac the window comes forward only when the app itself is activated (app.focus with steal).
const HOLD_ON_TOP_MS=400;
function bringToFront(window,{platform=process.platform,app=null,schedule=setTimeout}={}){
  if(!window||window.isDestroyed())return false;
  if(window.isMinimized())window.restore();
  // A window closed to the tray comes back without activation too (show() would try to take the focus, like focus()).
  if(!window.isVisible())window.showInactive();
  if(platform==='win32'){window.setAlwaysOnTop(true);schedule(()=>{if(!window.isDestroyed())window.setAlwaysOnTop(false);},HOLD_ON_TOP_MS);}
  else{if(platform==='darwin')app?.focus?.({steal:true});window.focus();}
  return true;
}
module.exports={createSignInReturn,bringToFront};
