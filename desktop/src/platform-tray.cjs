'use strict';
const nodeFs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const TRAY_APPS=Object.freeze({world:'SYNK WORLD',messenger:'SYNK Workspace',teacher:'SYNK Workspace · 내 수업',path:'SYNK PATH',pulse:'SYNK PULSE',partners:'SYNK Partners',care:'SYNK 플레저',fortune:'SYNK 무료 운세'});
const validShortcuts=items=>Array.isArray(items)&&items.length<=5&&items.every(item=>item&&typeof item.id==='string'&&Object.hasOwn(TRAY_APPS,item.id)&&(item.kind===undefined||['favorite','recent'].includes(item.kind)));
/* 트레이 바로가기는 앱 창 화면이 계정의 즐겨찾기와 최근 앱으로 정해 보낸다. 트레이로 숨은 채 시작하면 처음 열 때까지 창이 없으므로,
   계정마다 마지막으로 받은 바로가기를 directory에 기억해 두고 계정이 확인될 때 다시 건다(엔진 다시 검수 -g GA1).
   파일에는 계정 번호 대신 그 해시와 앱 이름표만 둔다. getOwner는 확인된 계정 번호나 null을 돌려준다 */
function createPlatformTray({app,Tray,Menu,icon,productName,getWindow,createWindow,enabled=true,shouldHide=()=>true,onAction=()=>{},onShow=null,revealForQuit=()=>true,directory=null,getOwner=()=>null,fs=nodeFs}){
  let tray=null,quitting=false,shortcuts=[];
  const memoryFile=directory?path.join(directory,'tray-shortcuts.json'):null;
  function ownerKey(){try{const id=getOwner();return typeof id==='string'&&id?crypto.createHash('sha256').update(id).digest('hex'):null;}catch{return null;}}
  function remembered(owner){
    if(!memoryFile||!owner||!isActive())return [];
    try{const text=fs.readFileSync(memoryFile,'utf8');if(text.length>=4096)return [];const saved=JSON.parse(text);return saved?.owner===owner&&validShortcuts(saved.items)?saved.items:[];}catch{return [];}
  }
  function remember(owner,items){
    if(!memoryFile||!owner||!isActive())return;
    const next=JSON.stringify({owner,items});
    try{if(fs.readFileSync(memoryFile,'utf8')===next)return;}catch{}
    try{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(memoryFile+'.tmp',next,{mode:0o600});fs.renameSync(memoryFile+'.tmp',memoryFile);}catch{}
  }
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
  function updateMenu(){
    if(!isActive())return;
    const entries=shortcuts.map(item=>({label:TRAY_APPS[item.id],click:()=>{show();onAction({type:'open-app',id:item.id});}}));
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'SYNK Platform 열기',click:show},
      ...(entries.length?[{type:'separator'},...entries]:[]),
      {type:'separator'},
      {label:'완전히 종료',click:()=>app.quit()},
    ]));
  }
  function onWillQuit(event){if(!event.defaultPrevented)dispose();}
  function apply(items){
    shortcuts=items.filter((item,index)=>items.findIndex(row=>row.id===item.id)===index).map(item=>({id:item.id}));
    try{updateMenu();return {ok:true};}catch{return {ok:false,code:'TRAY_UNAVAILABLE'};}
  }
  function setShortcuts(items){
    if(!validShortcuts(items))return {ok:false,code:'INVALID_TRAY_SHORTCUTS'};
    const result=apply(items);remember(ownerKey(),shortcuts);return result;
  }
  // 로그인 상태가 바뀌거나 다시 확인될 때 부른다. 그 계정이 마지막으로 보낸 바로가기로 돌린다. 로그인하지 않았거나 다른 계정이면 비운다
  function accountChanged(){return apply(remembered(ownerKey()));}
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
  return {attachWindow,show,isActive,isQuitting:()=>quitting,cancelQuit,dispose,setShortcuts,accountChanged};
}
module.exports={createPlatformTray,TRAY_APPS};
