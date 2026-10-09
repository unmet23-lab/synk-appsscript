'use strict';

const TRAY_APPS=Object.freeze({world:'SYNK WORLD',messenger:'SYNK Workspace',teacher:'SYNK 선생님',path:'SYNK PATH',pulse:'SYNK PULSE',partners:'SYNK Partners',care:'SYNK 플레저',fortune:'SYNK 무료 운세',rehearsal:'SYNK 대화 리허설','family-album':'SYNK 가족 앨범'});
function createPlatformTray({app,Tray,Menu,icon,productName,getWindow,createWindow,enabled=true,shouldHide=()=>true,onAction=()=>{}}){
  let tray=null,quitting=false,shortcuts=[];
  const bindings=new Map();
  function isActive(){return !!tray&&!tray.isDestroyed();}
  function show(){
    const window=getWindow();
    if(!window||window.isDestroyed()){createWindow();return;}
    if(window.isMinimized())window.restore();
    window.show();window.focus();
  }
  function cancelQuit(){quitting=false;}
  const beforeQuit=()=>{quitting=true;const window=getWindow();if(window&&!window.isDestroyed()&&!window.isVisible())show();};
  function attachWindow(window){
    if(!isActive()||bindings.has(window))return;
    const close=event=>{
      if(quitting||!isActive()||!shouldHide())return;
      event.preventDefault();window.hide();
    };
    // The draft guard runs first: preventing this event means the user chose
    // to discard. Keeping a draft cancels quitting and restores the same page.
    const blockedUnload=event=>{if(quitting&&!event.defaultPrevented){cancelQuit();show();}};
    const sessionEnd=()=>{quitting=true;};
    const closed=()=>bindings.delete(window);
    window.on('close',close);
    window.on('session-end',sessionEnd);
    window.webContents.on('will-prevent-unload',blockedUnload);
    bindings.set(window,{close,blockedUnload,sessionEnd,closed});
    window.once('closed',closed);
  }
  function dispose(){
    app.removeListener('before-quit',beforeQuit);app.removeListener('will-quit',dispose);
    for(const [window,listeners]of bindings){
      if(window.isDestroyed())continue;
      window.removeListener('close',listeners.close);window.removeListener('session-end',listeners.sessionEnd);
      window.removeListener('closed',listeners.closed);
      window.webContents.removeListener('will-prevent-unload',listeners.blockedUnload);
    }
    bindings.clear();
    if(isActive())tray.destroy();tray=null;
  }
  function updateMenu(){
    if(!isActive())return;
    const entries=shortcuts.map(item=>({label:TRAY_APPS[item.id],click:()=>{show();onAction({type:'open-app',id:item.id});}}));
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'SYNK 플랫폼 열기',click:show},
      ...(entries.length?[{type:'separator'},...entries]:[]),
      {type:'separator'},
      {label:'완전히 종료',click:()=>app.quit()},
    ]));
  }
  function setShortcuts(items){
    if(!Array.isArray(items)||items.length>5||items.some(item=>!item||typeof item.id!=='string'||!Object.hasOwn(TRAY_APPS,item.id)||item.kind!==undefined&&!['favorite','recent'].includes(item.kind)))return {ok:false,code:'INVALID_TRAY_SHORTCUTS'};
    shortcuts=items.filter((item,index)=>items.findIndex(row=>row.id===item.id)===index).map(item=>({id:item.id}));
    try{updateMenu();return {ok:true};}catch{return {ok:false,code:'TRAY_UNAVAILABLE'};}
  }
  if(enabled){
    try{
      tray=new Tray(icon);
      tray.setToolTip(productName);
      updateMenu();
      tray.on('click',show);tray.on('double-click',show);
      app.on('before-quit',beforeQuit);app.on('will-quit',dispose);
    }catch{
      // A missing tray must never leave the user with an unreachable window.
      dispose();
    }
  }
  return {attachWindow,show,isActive,isQuitting:()=>quitting,cancelQuit,dispose,setShortcuts};
}
module.exports={createPlatformTray,TRAY_APPS};
