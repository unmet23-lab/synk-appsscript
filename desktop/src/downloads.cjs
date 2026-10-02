'use strict';
const {downloadSpec}=require('./security.cjs');

// Checks the owning Electron cookie session, never a renderer-supplied user.
async function companySessionAllowed(session,entry){
  try{
    const response=await session.fetch(new URL('/api/me',entry).href,{method:'GET',credentials:'include',redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!response.ok)return false;
    const raw=await response.text();if(raw.length>65536)return false;
    const user=JSON.parse(raw)?.user;
    return !!user&&typeof user.id==='string'&&user.id.length>0&&user.active!==false;
  }catch{return false;}
}

function createDownloadHandler({getWindow,session,entry,clientId,configureSave,onDenied=()=>{}}){
  return (event,item,source)=>{
    const window=getWindow();
    const spec=source===window?.webContents?downloadSpec({url:item.getURL(),mime:item.getMimeType(),filename:item.getFilename(),size:item.getTotalBytes(),sourceUrl:source.getURL(),entry,clientId}):null;
    if(!spec){event.preventDefault();if(source===window?.webContents)onDenied('type');return;}
    item.on('updated',()=>{if(item.getReceivedBytes()>spec.maxBytes||item.getTotalBytes()>spec.maxBytes){item.cancel();onDenied('size');}});
    if(!spec.companySession){configureSave(item,spec);return;}
    const sourceUrl=source.getURL();item.pause();configureSave(item,spec);
    void companySessionAllowed(session,entry).then(allowed=>{
      if(!allowed||getWindow()!==window||window.isDestroyed()||source.isDestroyed()||source.getURL()!==sourceUrl){item.cancel();onDenied('session');return;}
      if(item.getState()==='progressing')item.resume();
    }).catch(()=>{item.cancel();onDenied('session');});
  };
}
module.exports={companySessionAllowed,createDownloadHandler};
