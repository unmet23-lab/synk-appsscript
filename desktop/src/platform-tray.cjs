'use strict';

const TRAY_APPS=Object.freeze({world:'SYNK WORLD',messenger:'SYNK Workspace',teacher:'SYNK Workspace · 내 수업',path:'SYNK PATH',pulse:'SYNK PULSE',partners:'SYNK Partners',care:'SYNK 플레저',fortune:'SYNK 무료 운세'});
// 메뉴의 앱 줄은 본체가 지금 아는 로그인 · 권한 · 설치로 정해 setApps로 건다. 화면이 보내던 목록과 그 기억은 쓰지 않는다(PC 0.5.0 설계 1절)
function createPlatformTray({app,Tray,Menu,icon,productName,getWindow,createWindow,enabled=true,shouldHide=()=>true,onLaunchApp=()=>{},onShow=null,onCloseToTray=null,revealForQuit=()=>true}){
  let tray=null,quitting=false,apps=[];
  const bindings=new Map();
  function isActive(){return !!tray&&!tray.isDestroyed();}
  function show({forQuit=false}={}){
    if(onShow&&!forQuit){onShow();return;}
    const window=getWindow();
    if(!window||window.isDestroyed()){createWindow();return;}
    if(window.isMinimized())window.restore();
    window.show();window.focus();
  }
  function cancelQuit(){quitting=false;}
  // 끝낼 때 숨은 창을 보여 초안 보호가 물을 자리를 만든다. 조용한 업데이트(초안이 없음을 확인함)에서는 보이지 않는다(1-가 구현 설계 2절)
  const beforeQuit=()=>{quitting=true;if(!revealForQuit())return;const window=getWindow();if(window&&!window.isDestroyed()&&!window.isVisible())show({forQuit:true});};
  function attachWindow(window){
    if(!isActive()||bindings.has(window))return;
    const close=event=>{
      if(quitting||!isActive()||!shouldHide())return;
      event.preventDefault();window.hide();
      onCloseToTray?.(window);
    };
    // The draft guard runs first: preventing this event means the user chose
    // to discard. Keeping a draft cancels quitting and restores the same page.
    const blockedUnload=event=>{if(quitting&&!event.defaultPrevented){cancelQuit();show({forQuit:true});}};
    const sessionEnd=()=>{quitting=true;};
    const closed=()=>bindings.delete(window);
    window.on('close',close);
    window.on('session-end',sessionEnd);
    window.webContents.on('will-prevent-unload',blockedUnload);
    bindings.set(window,{close,blockedUnload,sessionEnd,closed});
    window.once('closed',closed);
  }
  function dispose(){
    app.removeListener('before-quit',beforeQuit);app.removeListener('will-quit',onWillQuit);
    for(const [window,listeners]of bindings){
      if(window.isDestroyed())continue;
      window.removeListener('close',listeners.close);window.removeListener('session-end',listeners.sessionEnd);
      window.removeListener('closed',listeners.closed);
      window.webContents.removeListener('will-prevent-unload',listeners.blockedUnload);
    }
    bindings.clear();
    if(isActive())tray.destroy();tray=null;
  }
  function updateMenu(list=apps){
    if(!isActive())return;
    const entries=list.map(id=>({label:TRAY_APPS[id],click:()=>onLaunchApp(id)}));
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'SYNK Platform 열기',click:show},
      ...(entries.length?[{type:'separator'},...entries]:[]),
      {type:'separator'},
      {label:'완전히 종료',click:()=>app.quit()},
    ]));
  }
  function onWillQuit(event){if(!event.defaultPrevented)dispose();}
  // 같은 줄이면 메뉴를 다시 걸지 않는다
  function setApps(ids){
    if(!Array.isArray(ids)||ids.length>5||ids.some(id=>typeof id!=='string'||!Object.hasOwn(TRAY_APPS,id)))return {ok:false,code:'INVALID_TRAY_APPS'};
    const next=ids.filter((id,index)=>ids.indexOf(id)===index);
    if(next.length===apps.length&&next.every((id,index)=>apps[index]===id))return {ok:true,changed:false};
    // 메뉴가 실제로 바뀐 뒤에만 적용 목록을 적는다. 갱신이 실패하면 같은 목록으로 다시 걸 수 있다(GPT 검수 GA4)
    try{updateMenu(next);apps=next;return {ok:true,changed:true};}catch{return {ok:false,code:'TRAY_UNAVAILABLE'};}
  }
  if(enabled){
    try{
      tray=new Tray(icon);
      tray.setToolTip(productName);
      updateMenu();
      tray.on('click',show);tray.on('double-click',show);
      app.on('before-quit',beforeQuit);app.on('will-quit',onWillQuit);
    }catch{
      // A missing tray must never leave the user with an unreachable window.
      dispose();
    }
  }
  return {attachWindow,show,isActive,isQuitting:()=>quitting,cancelQuit,dispose,setApps,apps:()=>[...apps]};
}
module.exports={createPlatformTray,TRAY_APPS};
