'use strict';

// Fixed public navigation carries only the verified account to match; OAuth grants access.
const PUBLIC_APP_URLS=Object.freeze({care:'https://synk.im/care/',fortune:'https://synk.im/fortune/',rehearsal:'https://synk.im/rehearsal/'});
function publicAppDestination(id){return typeof id==='string'&&Object.hasOwn(PUBLIC_APP_URLS,id)?PUBLIC_APP_URLS[id]:null;}
function publicAppsAvailable({clientId,mode}){return clientId==='platform'&&mode==='development'?Object.keys(PUBLIC_APP_URLS):[];}
function createPublicApps({clientId,mode,openExternal,accountStatus=()=>null}){
  const available=publicAppsAvailable({clientId,mode}),pending=new Map();
  return {
    available:()=>[...available],
    open(id){
      if(!available.length)return Promise.resolve({ok:false,code:'PUBLIC_APP_UNAVAILABLE'});
      let destination=publicAppDestination(id);
      if(!destination)return Promise.resolve({ok:false,code:'UNKNOWN_PUBLIC_APP'});
      if(pending.has(id))return pending.get(id);
      const operation=Promise.resolve().then(()=>{
        const snapshot=accountStatus(),accountId=snapshot?.signedIn&&snapshot?.status==='signed-in'?snapshot.account?.synk_user_id:null;
        if(typeof accountId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(accountId))destination+='#synk-platform-account='+encodeURIComponent(accountId);
        return openExternal(destination);
      }).then(()=>({ok:true,id,externalBrowser:true}),()=>({ok:false,code:'PUBLIC_APP_OPEN_FAILED'}));
      pending.set(id,operation);void operation.finally(()=>{if(pending.get(id)===operation)pending.delete(id);});return operation;
    },
  };
}
module.exports={PUBLIC_APP_URLS,publicAppDestination,publicAppsAvailable,createPublicApps};
