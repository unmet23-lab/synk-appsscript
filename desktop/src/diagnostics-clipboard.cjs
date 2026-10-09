'use strict';
const {TRAY_APPS}=require('./platform-tray.cjs');
const choose=(value,allowed,fallback='unknown')=>allowed.includes(value)?value:fallback;
function diagnosticSummary(input,{environment={},account={}}={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||!Array.isArray(input.clients)||input.clients.length>10)return null;
  const version=environment.version;
  return {
    format:'SYNK platform diagnostics v1',
    platform:choose(environment.platform,['win32','darwin','linux'],'browser'),arch:choose(environment.arch,['x64','arm64','ia32']),
    version:typeof version==='string'&&version.length<80&&/^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.-]+)?$/.test(version)?version:'unknown',
    mode:choose(environment.mode,['development','release']),signedIn:account.signedIn===true,accountConfigured:account.configured===true,
    online:input.online===true,view:choose(input.view,['home','library','benefits','downloads','settings'],'home'),
    clients:input.clients.filter(row=>row&&typeof row==='object'&&typeof row.id==='string'&&Object.hasOwn(TRAY_APPS,row.id)).map(row=>({id:row.id,status:choose(row.status,['installed','not-installed','preview','planned','unavailable']),canLaunch:row.canLaunch===true,preparation:choose(row.preparation,['idle','preparing','ready','error','installer-opened','opening'])})),
  };
}
function copyDiagnostics({clipboard,input,environment,account}){const summary=diagnosticSummary(input,{environment,account});if(!summary)return {ok:false,code:'INVALID_DIAGNOSTICS'};try{clipboard.writeText(JSON.stringify(summary,null,2));return {ok:true};}catch{return {ok:false,code:'CLIPBOARD_UNAVAILABLE'};}}
module.exports={diagnosticSummary,copyDiagnostics};
