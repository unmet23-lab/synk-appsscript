'use strict';
const path=require('node:path');

const PRODUCT_PREVIEWS=Object.freeze({
  path:Object.freeze({id:'path',name:'SYNK PATH',appId:'im.synk.path.preview',sessionScope:'im.synk.path.preview',entry:'http://127.0.0.1:4292/'}),
});
function product(id){return typeof id==='string'&&Object.hasOwn(PRODUCT_PREVIEWS,id)?PRODUCT_PREVIEWS[id]:null;}
function productPreviewAvailable({packaged,mode,clientId}){return packaged===false&&mode==='development'&&clientId==='platform';}
function previewAccountAllowed(id,state){return !!product(id)&&state?.status==='signed-in'&&state.signedIn===true&&typeof state.account?.synk_user_id==='string'&&state.account.synk_user_id.length>0&&state.library?.status==='ready'&&Array.isArray(state.library.appIds)&&state.library.appIds.includes(id);}
function createProductPreviews({packaged,mode,clientId,executable,appRoot,spawn,accountStatus=()=>null}){
  const pending=new Map(),enabled=()=>productPreviewAvailable({packaged,mode,clientId});
  return {
    available:()=>enabled()?Object.keys(PRODUCT_PREVIEWS):[],
    open(id){
      if(!enabled())return Promise.resolve({ok:false,code:'PREVIEW_DEVELOPMENT_ONLY'});
      if(!product(id))return Promise.resolve({ok:false,code:'UNKNOWN_PREVIEW'});
      if(!previewAccountAllowed(id,accountStatus()))return Promise.resolve({ok:false,code:'PREVIEW_NOT_IN_LIBRARY'});
      if(pending.has(id))return pending.get(id);
      const operation=(async()=>{try{
        await new Promise((resolve,reject)=>{
          const child=spawn(executable,[path.join(appRoot,'src','product-main.cjs'),'--synk-product-preview='+id],{shell:false,detached:true,stdio:'ignore',windowsHide:false});
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
function productBrowserDestination(id){return id==='path'?PRODUCT_PREVIEWS.path.entry:null;}
// The remaining PATH client has no download feature.
function productDownload(){return false;}
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
module.exports={PRODUCT_PREVIEWS,product,productPreviewAvailable,previewAccountAllowed,createProductPreviews,productDocument,productResource,productPolicy,assertProductSender,productBrowserDestination,productDownload,createProductBrowser};
