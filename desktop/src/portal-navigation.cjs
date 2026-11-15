'use strict';

// The common entry's visit-purpose choice leaves the app only for a fixed
// public page named by its ID (SHIFT, the AI course). The renderer sends the
// ID, never a URL, so the platform window's link allow-list (security.cjs)
// stays as it is and no new app ID or OAuth callback exists for it.
const PORTAL_PURPOSE_URLS=Object.freeze({shift:'https://synk.im/shift/'});
function portalPurposeDestination(id){return typeof id==='string'&&Object.hasOwn(PORTAL_PURPOSE_URLS,id)?PORTAL_PURPOSE_URLS[id]:null;}
function createPortalNavigation({clientId,smoke=false,openExternal}){
  const enabled=clientId==='platform'&&smoke===false&&typeof openExternal==='function',pending=new Map();
  return {
    openPurpose(id){
      if(!enabled)return Promise.resolve({ok:false,code:'PORTAL_PURPOSE_UNAVAILABLE'});
      const destination=portalPurposeDestination(id);
      if(!destination)return Promise.resolve({ok:false,code:'UNKNOWN_PORTAL_PURPOSE'});
      // A double click joins the call already opening the same fixed page.
      if(pending.has(id))return pending.get(id);
      // Success only after the browser call itself completes; its error details stay here.
      const operation=Promise.resolve().then(()=>openExternal(destination)).then(()=>({ok:true,id,externalBrowser:true}),()=>({ok:false,code:'PORTAL_PURPOSE_OPEN_FAILED'}));
      pending.set(id,operation);void operation.finally(()=>{if(pending.get(id)===operation)pending.delete(id);});return operation;
    },
  };
}
module.exports={PORTAL_PURPOSE_URLS,portalPurposeDestination,createPortalNavigation};
