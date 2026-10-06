'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {inside,nativeContentSecurityPolicy}=require('./security.cjs');
const MIME=Object.freeze({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.avif':'image/avif','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ico':'image/x-icon'});
// Only packaged presentation files are reachable. Main-process code, runtime config,
// file URLs and paths outside these roots never enter the protocol response.
function createNativeContent({appRoot,readFile=fs.readFile,realpath=fs.realpath}){
  return async function nativeContent(request){
    const headers={'content-security-policy':nativeContentSecurityPolicy(),'x-content-type-options':'nosniff','cache-control':'no-store'};
    const denied=status=>new Response('Unavailable',{status,headers});
    try{
      const u=new URL(typeof request==='string'?request:request.url);
      if(request?.method&&request.method!=='GET')return denied(405);
      if(u.protocol!=='synk-desktop:'||u.host!=='platform'||u.username||u.password||u.search||u.hash)return denied(404);
      const decoded=decodeURIComponent(u.pathname);
      if(/[\\\0]/.test(decoded)||decoded.split('/').some(p=>p==='..'||p==='.')||/%[0-9a-f]{2}/i.test(decoded))return denied(404);
      const asset=decoded.startsWith('/assets/'),root=path.join(appRoot,asset?'assets':'renderer');
      const relative=asset?decoded.slice(8):decoded.slice(1),target=path.resolve(root,relative),mime=MIME[path.extname(target).toLowerCase()];
      if(!mime||!inside(root,target))return denied(404);
      const canonicalRoot=await realpath(root),canonicalTarget=await realpath(target);
      if(!inside(canonicalRoot,canonicalTarget)||canonicalTarget!==path.resolve(canonicalRoot,relative))return denied(404);
      return new Response(await readFile(canonicalTarget),{headers:{...headers,'content-type':mime}});
    }catch{return denied(404);}
  };
}
module.exports={createNativeContent};
