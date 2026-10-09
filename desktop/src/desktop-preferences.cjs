'use strict';
const fs=require('node:fs'),path=require('node:path');
const DEFAULTS=Object.freeze({closeToTray:true,launchAtLogin:false,startHidden:false,globalShortcut:'',zoomFactor:1});
function validShortcut(value){return typeof value==='string'&&value.length<=80&&(value===''||/^(?:(?:CommandOrControl|Control|Ctrl|Alt|Shift|Super|Command)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space)$/.test(value)&&/(?:CommandOrControl|Control|Ctrl|Alt|Super|Command)\+/.test(value));}
function validatePatch(patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch))return false;
  return Object.keys(patch).every(key=>Object.hasOwn(DEFAULTS,key)&&(['closeToTray','launchAtLogin','startHidden'].includes(key)?typeof patch[key]==='boolean':key==='globalShortcut'?validShortcut(patch[key]):typeof patch[key]==='number'&&Number.isFinite(patch[key])&&patch[key]>=0.8&&patch[key]<=1.5));
}
function createDesktopPreferences({directory,app,globalShortcut,getWindow,onAction=()=>{},onChange=()=>{},platform=process.platform,enabled=true,packaged=false,executable=process.execPath,appRoot,name='SYNKPlatform'}){
  const file=path.join(directory,'desktop-preferences.json'),supported=enabled&&platform==='win32';
  const startup={path:executable,args:packaged?['--synk-autostart']:[appRoot,'--synk-dev','--client=platform','--synk-autostart'],name};
  let values={...DEFAULTS},registered='',shortcutError=null;
  if(enabled)try{const text=fs.readFileSync(file,'utf8');if(text.length<4096){const parsed=JSON.parse(text);if(validatePatch(parsed))values={...values,...parsed};}}catch{}
  function showSearch(){const window=getWindow();if(!window||window.isDestroyed())return;if(window.isMinimized())window.restore();window.show();window.focus();onAction({type:'command-menu'});}
  function loginState(strict=false){
    try{
      if(!supported||typeof app.getLoginItemSettings!=='function')return {registered:values.launchAtLogin,enabled:values.launchAtLogin};
      const result=app.getLoginItemSettings(startup);
      // openAtLogin matches our complete command, but ignores StartupApproved.
      // launchItems.args omits switches in Electron, so use openAtLogin for
      // argument matching and the same named user entry for its enabled state.
      if(Array.isArray(result.launchItems)){
        const samePath=(a,b)=>typeof a==='string'&&path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
        const item=result.launchItems.find(item=>item.name===startup.name&&item.scope==='user'&&samePath(item.path,startup.path));
        const registered=result.openAtLogin===true&&!!item;
        return {registered,enabled:registered&&item.enabled===true};
      }
      return {registered:result.openAtLogin===true,enabled:result.openAtLogin===true&&result.executableWillLaunchAtLogin!==false};
    }catch(error){if(strict)throw error;return {registered:values.launchAtLogin,enabled:values.launchAtLogin};}
  }
  function snapshot(){return {ok:true,preferences:{...values,launchAtLogin:loginState().enabled},capabilities:{launchAtLogin:supported,globalShortcut:supported},...(shortcutError?{warning:shortcutError}:{})};}
  function initialize(){if(supported&&values.globalShortcut)try{if(globalShortcut.register(values.globalShortcut,showSearch))registered=values.globalShortcut;else shortcutError='SHORTCUT_UNAVAILABLE';}catch{shortcutError='SHORTCUT_UNAVAILABLE';}}
  function update(patch){
    if(!enabled)return {ok:false,code:'DESKTOP_UNAVAILABLE'};
    if(!validatePatch(patch))return {ok:false,code:'INVALID_DESKTOP_PREFERENCES'};
    if(!supported&&['launchAtLogin','globalShortcut'].some(key=>Object.hasOwn(patch,key)))return {ok:false,code:'DESKTOP_UNAVAILABLE'};
    let previousStartup;try{previousStartup=loginState(Object.hasOwn(patch,'launchAtLogin'));}catch{return {ok:false,code:'STARTUP_UNAVAILABLE'};}
    const previous={...values,launchAtLogin:previousStartup.enabled},next={...previous,...patch},shortcutRequested=Object.hasOwn(patch,'globalShortcut');let newlyRegistered=false,startupApplied=false;
    if(shortcutRequested&&next.globalShortcut!==registered&&next.globalShortcut){try{newlyRegistered=globalShortcut.register(next.globalShortcut,showSearch);}catch{}if(!newlyRegistered)return {ok:false,code:'SHORTCUT_UNAVAILABLE'};}
    try{
      if(Object.hasOwn(patch,'launchAtLogin')&&next.launchAtLogin!==previous.launchAtLogin){
        startupApplied=true;
        try{app.setLoginItemSettings({...startup,openAtLogin:next.launchAtLogin,enabled:next.launchAtLogin});const actual=loginState(true);if(actual.enabled!==next.launchAtLogin||actual.registered!==next.launchAtLogin)throw Error('Startup setting was not applied');}
        catch{throw Object.assign(Error('Startup setting was not applied'),{code:'STARTUP_UNAVAILABLE'});}
      }
      fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(next),{mode:0o600});fs.renameSync(file+'.tmp',file);
    }catch(error){if(newlyRegistered)globalShortcut.unregister(next.globalShortcut);if(startupApplied)try{app.setLoginItemSettings({...startup,openAtLogin:previousStartup.registered,enabled:previousStartup.enabled});}catch{}return {ok:false,code:error.code==='STARTUP_UNAVAILABLE'?error.code:'PREFERENCES_SAVE_FAILED'};}
    if(shortcutRequested){if(registered&&registered!==next.globalShortcut)globalShortcut.unregister(registered);registered=next.globalShortcut;shortcutError=null;}values=next;
    const window=getWindow();if(window&&!window.isDestroyed())window.webContents.setZoomFactor(values.zoomFactor);
    const result=snapshot();onChange(result);return result;
  }
  function applyWindow(window){window.webContents.setZoomFactor(values.zoomFactor);}
  function dispose(){if(registered)globalShortcut.unregister(registered);registered='';}
  return {initialize,snapshot,update,applyWindow,dispose};
}
module.exports={DEFAULTS,validShortcut,validatePatch,createDesktopPreferences};
