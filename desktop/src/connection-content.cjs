'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {safeEntry}=require('./security.cjs');
const {MESSENGER_CLOUD_PREVIEW_ENTRY}=require('./catalog.cjs');
const {messengerViewEntry}=require('./messenger-teacher.cjs');
const STATUS_URL='synk-desktop://status/';
const ASSETS=Object.freeze({
  '/assets/synk.svg':['synk.svg','image/svg+xml'],
  '/assets/button.webp':['button.webp','image/webp'],
  '/assets/SUIT.woff2':['SUIT.woff2','font/woff2'],
  '/assets/InterTight.woff2':['InterTight.woff2','font/woff2']
});
const CSP="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function createConnectionContent({appRoot,clientId,mode,entry,messengerCloudPreview=false,worldCloudPreview=false,productName,readFile=fs.readFile,realpath=fs.realpath}){
  const teachingEntry=clientId==='messenger'&&messengerCloudPreview===true&&worldCloudPreview===false&&mode==='development'&&
    entry===messengerViewEntry(MESSENGER_CLOUD_PREVIEW_ENTRY,'messenger',['--view=teaching']);
  if(!['world','messenger','platform'].includes(clientId)||!teachingEntry&&!safeEntry(entry,mode,{clientId,messengerCloudPreview,worldCloudPreview}))throw Error('Invalid connection entry');
  const label=escape(productName||({world:'SYNK WORLD',messenger:'SYNK Workspace',platform:'SYNK Platform'}[clientId]));
  const guidance=mode==='development'&&!messengerCloudPreview&&!worldCloudPreview?'이 기기의 앱 서비스가 켜져 있는지 확인한 뒤 다시 연결해 주세요.':'인터넷 연결을 확인하거나 잠시 뒤 다시 연결해 주세요.';
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${label} · 연결 확인</title><style>
@font-face{font-family:SUIT;src:url('/assets/SUIT.woff2') format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:'Inter Tight';src:url('/assets/InterTight.woff2') format('woff2');font-weight:100 900;font-display:swap}
*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font-family:'Inter Tight',SUIT,system-ui,sans-serif;word-break:keep-all}header{padding:24px clamp(24px,5vw,64px)}.logo{display:block;width:68px;height:48px;object-fit:contain}main{min-height:calc(100svh - 96px);display:flex;align-items:center;padding:24px clamp(24px,6vw,80px) 96px}.content{width:100%;max-width:560px;margin:0 auto}.product{font-size:14px;font-weight:750;letter-spacing:.01em;margin:0 0 24px;color:#565a61}h1{font-size:clamp(30px,4vw,44px);line-height:1.22;letter-spacing:-.04em;font-weight:820;margin:0 0 24px}.guidance{max-width:450px;font-size:17px;line-height:1.75;color:#565a61;margin:0 0 32px}.retry{width:240px;max-width:100%;min-height:68px;display:inline-flex;align-items:center;justify-content:center;padding:16px 28px;color:#fff;font-weight:850;font-size:18px;text-decoration:none;background:url('/assets/button.webp') center/100% 100% no-repeat;text-shadow:0 1px 1px rgba(120,30,20,.45)}.retry:hover{filter:brightness(.96)}.retry:active{transform:translateY(2px)}.retry:focus-visible{outline:3px solid #24448c;outline-offset:5px;border-radius:16px}.hint{font-size:13px;line-height:1.7;color:#565a61;margin:24px 0 0}@media(max-width:420px){header{padding-top:16px}.product{margin-bottom:16px}main{padding-top:16px;padding-bottom:48px;min-height:calc(100svh - 88px)}h1{max-width:270px}.guidance{font-size:16px}}@media(forced-colors:active){.retry{background:none;border:2px solid ButtonText;color:LinkText;text-shadow:none}.retry:focus-visible{outline-color:Highlight}}
</style></head><body><header><img class="logo" src="/assets/synk.svg" alt="SYNK" width="68" height="48"></header><main><section class="content" aria-labelledby="connection-title"><p class="product">${label}</p><h1 id="connection-title">지금은 연결할 수 없어요</h1><p class="guidance">${guidance}</p><a id="retry-connection" class="retry" href="${escape(entry)}">다시 연결</a><p class="hint">앱을 닫지 않고 여기에서 다시 시도할 수 있어요.</p></section></main></body></html>`;
  return async function connectionContent(request){
    const headers={'content-security-policy':CSP,'x-content-type-options':'nosniff','cache-control':'no-store'};
    const denied=status=>new Response('Unavailable',{status,headers});
    try{
      const raw=typeof request==='string'?request:request.url,u=new URL(raw);
      if(request?.method&&request.method!=='GET')return denied(405);
      if(u.protocol!=='synk-desktop:'||u.host!=='status'||u.username||u.password||u.search||u.hash||raw!==u.href)return denied(404);
      if(u.pathname==='/')return new Response(html,{headers:{...headers,'content-type':'text/html; charset=utf-8'}});
      const asset=ASSETS[u.pathname];if(!asset)return denied(404);
      const root=path.resolve(appRoot,'assets','launcher'),target=path.join(root,asset[0]);
      const realRoot=await realpath(root),realTarget=await realpath(target);
      if(realTarget!==path.join(realRoot,asset[0]))return denied(404);
      return new Response(await readFile(realTarget),{headers:{...headers,'content-type':asset[1]}});
    }catch{return denied(404);}
  };
}
module.exports={createConnectionContent,STATUS_URL,connectionContentSecurityPolicy:()=>CSP};
