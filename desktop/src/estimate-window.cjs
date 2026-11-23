'use strict';

const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createEstimateService}=require('./estimate-service.cjs');
const {readClientConfig,configPath}=require('./estimate-auth.cjs');

function createEstimateWindow({BrowserWindow,ipcMain,session,safeStorage,shell,userData,getBinding,getParent,serviceFactory=createEstimateService}){
  const base=path.join(__dirname,'..','renderer','estimate');
  const entry=pathToFileURL(path.join(base,'index.html')).href;
  const allowed=new Set(['index.html','estimate.css','estimate-ui.js','estimate-demo.js'].map(name=>pathToFileURL(path.join(base,name)).href));
  allowed.add(pathToFileURL(path.join(__dirname,'..','assets','launcher','SUIT.woff2')).href);
  let panel=null,service=null,bound=null,changeTimer=null;
  const current=()=>{const binding=getBinding();return !!bound&&!!binding&&binding.owner===bound.owner&&binding.generation===bound.generation;};
  const checked=event=>current()&&panel&&!panel.isDestroyed()&&event.sender===panel.webContents&&event.senderFrame===panel.webContents.mainFrame&&event.senderFrame.url===entry;
  function changed(){
    if(changeTimer||!panel)return;
    changeTimer=setTimeout(()=>{changeTimer=null;if(current()&&panel&&!panel.isDestroyed()&&panel.webContents.getURL()===entry)panel.webContents.send('synk:estimate-updated');},200);
  }
  function clear(){
    bound=null;clearTimeout(changeTimer);changeTimer=null;
    service?.close();service=null;
    const old=panel;panel=null;if(old&&!old.isDestroyed())old.destroy();
  }
  const denied=()=>({ok:false,code:'AUTH_CHANGED',message:'현재 로그인한 회원을 확인해 주세요.'});
  const names=new Set(['connect','scan','more','openOriginal','openMailbox','readOriginal','confirmReceipt','disconnect','mark','reopen','quote','rememberQuote','repeatPreview','saveRepeatedQuote','job','handoff','accept','finish']);
  ipcMain.handle('synk:estimate-read',async (event,selectedIds)=>{
    if(!checked(event))return denied();const original=service;
    const value=await original.snapshot(selectedIds);return original===service&&checked(event)?value:denied();
  });
  ipcMain.handle('synk:estimate-action',async(event,name,input)=>{
    if(!checked(event))return denied();
    if(!names.has(name)||!input||Array.isArray(input)||typeof input!=='object'||Object.keys(input).length>22||
      !Object.values(input).every(v=>v===null||['boolean','number'].includes(typeof v)||typeof v==='string'&&v.length<=2000)){
      return {ok:false,code:'VALUE',message:'입력한 내용을 확인해 주세요.'};
    }
    const original=service;
    const value=await original.action(name,input);return original===service&&checked(event)?value:denied();
  });
  function sync(){if(bound&&!current())clear();}
  async function open(){
    sync();const binding=getBinding();
    if(!binding)return denied();
    if(panel&&!panel.isDestroyed()){panel.show();panel.focus();return {ok:true};}
    const ses=session.fromPartition('estimate-private');
    ses.setPermissionRequestHandler((_wc,_permission,answer)=>answer(false));
    ses.setPermissionCheckHandler(()=>false);
    ses.webRequest.onBeforeRequest((details,answer)=>answer({cancel:!allowed.has(details.url)}));
    bound={...binding};
    const instance=new BrowserWindow({title:'솔리오 견적 비서',width:1080,height:800,minWidth:390,minHeight:430,
      show:false,parent:getParent()||undefined,autoHideMenuBar:true,
      webPreferences:{session:ses,preload:path.join(__dirname,'estimate-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,
        webviewTag:false,webSecurity:true,allowRunningInsecureContent:false}});
    panel=instance;
    const valid=()=>panel===instance&&current();
    service=serviceFactory({root:path.join(userData,'Estimate'),owner:binding.owner,safe:safeStorage,isCurrent:valid,
      readConfig:()=>readClientConfig({filename:configPath(process.env,process.platform,userData)}),
      openExternal:async url=>{if(!valid())throw Error('AUTH_CHANGED');return shell.openExternal(url);},onChange:changed});
    instance.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    instance.webContents.on('will-navigate',(e,url)=>{if(url!==entry)e.preventDefault();});
    instance.webContents.on('will-redirect',e=>e.preventDefault());
    instance.webContents.on('will-attach-webview',e=>e.preventDefault());
    instance.on('closed',()=>{if(panel===instance){panel=null;clear();}});
    try {
      await instance.loadURL(entry);
      if(!valid())return denied();
      instance.show();void service.opened();return {ok:true};
    } catch {if(panel===instance)clear();return {ok:false,code:'OPEN_FAILED',message:'견적 비서 창을 열지 못했어요.'};}
  }
  return {open,sync,close:clear};
}
module.exports={createEstimateWindow};
