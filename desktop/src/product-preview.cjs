'use strict';
const path=require('node:path');
const {publicError}=require('./auth-service.cjs');

const PRODUCT_PREVIEWS=Object.freeze({
  path:Object.freeze({id:'path',name:'SYNK PATH',appId:'im.synk.path.preview',sessionScope:'im.synk.path.preview',entry:'http://127.0.0.1:4292/'}),
  care:Object.freeze({id:'care',name:'SYNK 플레저',appId:'im.synk.care.preview',sessionScope:'im.synk.care.preview',entry:'http://127.0.0.1:4296/'}),
  fortune:Object.freeze({id:'fortune',name:'SYNK 무료 운세',appId:'im.synk.fortune.preview',sessionScope:'im.synk.fortune.preview',entry:'http://127.0.0.1:4299/'}),
});
function product(id){return typeof id==='string'&&Object.hasOwn(PRODUCT_PREVIEWS,id)?PRODUCT_PREVIEWS[id]:null;}
function productPreviewAvailable({packaged,mode,clientId}){return packaged===false&&mode==='development'&&clientId==='platform';}
function previewAccountAllowed(id,state){return !!product(id)&&state?.status==='signed-in'&&state.signedIn===true&&typeof state.account?.synk_user_id==='string'&&state.account.synk_user_id.length>0&&state.library?.status==='ready'&&Array.isArray(state.library.appIds)&&state.library.appIds.includes(id);}
function createProductPreviews({packaged,mode,clientId,executable,appRoot,spawn,authConfigPath,accountStatus=()=>null}){
  const pending=new Map(),enabled=()=>productPreviewAvailable({packaged,mode,clientId});
  return {
    available:()=>enabled()?Object.keys(PRODUCT_PREVIEWS):[],
    open(id){
      if(!enabled())return Promise.resolve({ok:false,code:'PREVIEW_DEVELOPMENT_ONLY'});
      if(!product(id))return Promise.resolve({ok:false,code:'UNKNOWN_PREVIEW'});
      if(!previewAccountAllowed(id,accountStatus()))return Promise.resolve({ok:false,code:'PREVIEW_NOT_IN_LIBRARY'});
      if(pending.has(id))return pending.get(id);
      const operation=(async()=>{try{
        const args=[path.join(appRoot,'src','product-main.cjs'),'--synk-product-preview='+id];
        if(authConfigPath)args.push('--auth-config='+path.resolve(authConfigPath));
        await new Promise((resolve,reject)=>{
          const child=spawn(executable,args,{shell:false,detached:true,stdio:'ignore',windowsHide:true});
          child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});
        });
        return {ok:true,preview:true,separateClient:true,clientId:id};
      }catch{return {ok:false,code:'PREVIEW_LAUNCH_FAILED'};}})();
      pending.set(id,operation);void operation.finally(()=>{if(pending.get(id)===operation)pending.delete(id);});return operation;
    },
  };
}
function productDocument(id,value){try{const p=product(id),u=new URL(value);return !!p&&u.origin===new URL(p.entry).origin&&!u.username&&!u.password&&!u.search&&['/','/index.html'].includes(u.pathname);}catch{return false;}}
function productResource(id,value){try{const p=product(id),u=new URL(value);return !!p&&u.origin===new URL(p.entry).origin&&!u.username&&!u.password;}catch{return false;}}
function productPolicy(){return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";}
function assertProductSender(event,window,id){if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!productDocument(id,event.senderFrame?.url))throw Error('UNTRUSTED_SENDER');}
const FORTUNE_OPERATIONS=new Set(['load','fortuneGet','fortunePut','fortuneDelete']);
function fortuneAccountRequest(auth,operation,params={}){
  if(!FORTUNE_OPERATIONS.has(operation))return Promise.resolve({ok:false,error:{code:'INVALID_REQUEST',message:'운세 앱에서 지원하는 계정 요청을 확인해 주세요.',retryable:false}});
  return auth.accountRequest(operation,params);
}
function bindFortuneIPC({ipcMain,getWindow,auth}){
  const handlers={
    'synk-fortune:auth-status':()=>auth.status(),
    'synk-fortune:auth-sign-in':()=>auth.signIn(),
    'synk-fortune:auth-cancel':()=>auth.cancel(),
    'synk-fortune:auth-sign-out':()=>auth.signOut(),
    'synk-fortune:request':(operation,params)=>fortuneAccountRequest(auth,operation,params),
  };
  for(const [channel,handler]of Object.entries(handlers)){
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async(event,...args)=>{assertProductSender(event,getWindow(),'fortune');try{return await handler(...args);}catch(error){return {ok:false,error:publicError(error)};}});
  }
  return ()=>{for(const channel of Object.keys(handlers))ipcMain.removeHandler(channel);};
}
function sendFortuneAuth(window,state){if(window&&!window.isDestroyed()&&productDocument('fortune',window.webContents.getURL()))window.webContents.send('synk-fortune:auth-changed',state);}
function productBrowserDestination(id){return product(id)?.entry||null;}
function productDownload({id,url,mime,filename,size,sourceUrl}={}){
  if(!product(id)||!productDocument(id,sourceUrl)||typeof url!=='string'||!url.startsWith('blob:'))return false;
  try{const origin=new URL(url.slice(5));if(origin.origin!==new URL(product(id).entry).origin||origin.username||origin.password)return false;}catch{return false;}
  const formats={
    care:{'synk-care.ics':{mime:'text/calendar',extension:'ics',filterName:'일정 파일',maxBytes:1024*1024},'synk-care.json':{mime:'application/json',extension:'json',filterName:'플레저 기록',maxBytes:4*1024*1024},'synk-care-memory.png':{mime:'image/png',extension:'png',filterName:'플레저 기억 카드',maxBytes:20*1024*1024}},
    fortune:{'synk-fortune.json':{mime:'application/json',extension:'json',filterName:'운세 보관함',maxBytes:128*1024}},
  };
  if(['care','path'].includes(id)) {
    formats[id]||={};
    formats[id][`synk-${id}-local-recovery.json`]={mime:'application/json',extension:'json',filterName:'내 계정의 기기 임시기록 복구 파일',maxBytes:64*1024*1024};
  }
  const format=Object.hasOwn(formats,id)&&Object.hasOwn(formats[id],filename)?formats[id][filename]:null;
  const kind=format?.mime===mime?{extension:format.extension,filterName:format.filterName,maxBytes:format.maxBytes}:null;
  return kind&&Number.isSafeInteger(size)&&size>=0&&size<=kind.maxBytes?kind:false;
}
function createProductDownloadHandler({id,getWindow,configureSave,onDenied=()=>{}}){
  return (event,item,source)=>{
    const window=getWindow();
    const spec=window&&!window.isDestroyed()&&source===window.webContents?productDownload({id,url:item.getURL(),mime:item.getMimeType(),filename:item.getFilename(),size:item.getTotalBytes(),sourceUrl:source.getURL()}):false;
    if(!spec){event.preventDefault();onDenied('type');return;}
    let denied=false;
    item.on('updated',()=>{if(!denied&&(item.getReceivedBytes()>spec.maxBytes||item.getTotalBytes()>spec.maxBytes)){denied=true;item.cancel();onDenied('size');}});
    configureSave(item,spec);
  };
}
function productDownloadNotice(reason){return {type:'warning',title:'파일을 저장하지 못했어요',message:reason==='size'?'파일이 이 앱의 저장 크기 한도를 넘었어요.':'이 앱에서 허용한 형식이나 크기의 파일인지 확인하지 못했어요.',detail:'파일은 저장되지 않았어요. 복구 파일을 확인하기 전에는 기기 임시기록을 지우지 마세요.',buttons:['확인']};}
function createProductBrowser({id,openExternal,now=Date.now,enabled=true}){
  let pending=null,lastOpened=-Infinity;
  return ()=>{
    const destination=productBrowserDestination(id);
    if(!enabled||!destination)return Promise.resolve({ok:false,code:'BROWSER_UNAVAILABLE'});
    if(pending)return pending;
    if(now()-lastOpened<1500)return Promise.resolve({ok:false,code:'BROWSER_RETRY_LATER'});
    const operation=(async()=>{try{await openExternal(destination);lastOpened=now();return {ok:true};}catch{return {ok:false,code:'BROWSER_OPEN_FAILED'};}})();
    pending=operation;void operation.finally(()=>{if(pending===operation)pending=null;});return operation;
  };
}
module.exports={PRODUCT_PREVIEWS,product,productPreviewAvailable,previewAccountAllowed,createProductPreviews,productDocument,productResource,productPolicy,assertProductSender,fortuneAccountRequest,bindFortuneIPC,sendFortuneAuth,productBrowserDestination,productDownload,createProductDownloadHandler,productDownloadNotice,createProductBrowser};
