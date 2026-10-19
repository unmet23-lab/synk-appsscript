'use strict';
const path=require('node:path');
const {PLATFORM_ENTRY,MESSENGER_CLOUD_PREVIEW_ENTRY,WORLD_CLOUD_PREVIEW_ENTRY,WORLD_ACCOUNT_ENTRY}=require('./catalog.cjs');
const {PUBLIC_APP_URLS}=require('./public-apps.cjs');
const WORLD_PUBLIC_PLAY=Object.freeze(['learning-hub','korean-racing','korean-runner','korean-rhythm','order-rush','entry-check','story-classroom','blank-slice']);
const importMapHash=require('node:crypto').createHash('sha256').update(JSON.stringify({imports:{three:'./vendor/three.module.js'}})).digest('base64');
function contentSecurityPolicy(resourceType) {
  return "default-src 'self'; script-src 'self' 'sha256-"+importMapHash+"'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https: wss:; media-src 'self' data: blob: https:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors "+(resourceType==='subFrame'?"'self'":"'none'");
}
function nativeContentSecurityPolicy(){return "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";}
function isNativeEntry(value){try{const u=new URL(value);return u.protocol==='synk-desktop:'&&u.host==='platform'&&u.pathname==='/index.html'&&!u.username&&!u.password&&!u.search;}catch{return false;}}
function allowedUrl(value,entry,allowedOrigins=[]) {
  try {const u=new URL(value),base=new URL(entry);return !u.username&&!u.password&&(u.origin===base.origin||allowedOrigins.includes(u.origin))&&['http:','https:'].includes(u.protocol);}catch{return false;}
}
function safeEntry(value,mode,{clientId,messengerCloudPreview=false,worldCloudPreview=false}={}) {
  if(worldCloudPreview!==false)return worldCloudPreview===true&&messengerCloudPreview===false&&clientId==='world'&&mode==='development'&&value===WORLD_CLOUD_PREVIEW_ENTRY;
  if(messengerCloudPreview!==false)return messengerCloudPreview===true&&clientId==='messenger'&&mode==='development'&&value===MESSENGER_CLOUD_PREVIEW_ENTRY;
  try {const u=new URL(value);if(u.username||u.password||u.hash)return false;
    if(value===PLATFORM_ENTRY)return ['development','release'].includes(mode);
    if(mode==='development')return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&['4280','4191'].includes(u.port);
    return u.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);
  }catch{return false;}
}
function trustedEntry(value,entry,clientId) {
  if(entry===PLATFORM_ENTRY)return clientId==='platform'&&isNativeEntry(value);
  if(!allowedUrl(value,entry))return false;
  const u=new URL(value),base=new URL(entry),id=clientId||(base.searchParams.get('product')==='world'?'world':base.pathname==='/synk-account/platform.html'?'platform':'messenger');
  if(id==='platform'&&u.pathname==='/synk-account/client.html')return u.searchParams.getAll('product').length===1&&u.searchParams.get('product')==='platform'&&[...u.searchParams.keys()].every(k=>k==='product');
  if(id==='world'){
    if(entry===WORLD_CLOUD_PREVIEW_ENTRY){
      if(['/world/','/world/index.html','/world/mobile.html','/world/desktop.html'].includes(u.pathname)){
        const values={opening:['off','replay'],tutor:['choose'],cafe:['1'],wardrobe:['1']};
        return !u.hash&&[...u.searchParams.keys()].every(k=>Object.hasOwn(values,k)&&u.searchParams.getAll(k).length===1&&values[k].includes(u.searchParams.get(k)));
      }
      if(u.pathname!==new URL(WORLD_ACCOUNT_ENTRY).pathname||u.searchParams.getAll('product').length!==1||u.searchParams.get('product')!=='world')return false;
      const play=u.searchParams.getAll('play');return [...u.searchParams.keys()].every(k=>k==='product'||k==='play')&&(play.length===0||play.length===1&&WORLD_PUBLIC_PLAY.includes(play[0]));
    }
    if(u.pathname!==base.pathname||u.searchParams.getAll('product').length!==1||u.searchParams.get('product')!=='world')return false;
    return [...u.searchParams.keys()].every(k=>k==='product');
  }
  return u.pathname===base.pathname&&(id==='messenger'||u.search===base.search);
}
function assertSender(event,window,entry,clientId) {
  if(!window||window.isDestroyed()||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!trustedEntry(event.senderFrame?.url,entry,clientId))throw new Error('UNTRUSTED_SENDER');
}
function allowedNavigation(value,entry,clientId) {
  if(entry===PLATFORM_ENTRY)return clientId==='platform'&&isNativeEntry(value);
  if(!allowedUrl(value,entry))return false;
  const u=new URL(value),base=new URL(entry);
  if(clientId==='messenger')return u.pathname===base.pathname;
  if(clientId==='platform')return trustedEntry(value,entry,clientId);
  if(clientId==='world'){
    const paths=entry===WORLD_CLOUD_PREVIEW_ENTRY?['learning-hub','racing','runner','rhythm','order-rush','entry-check','story-classroom','blank-slice','talk-rally','word-magic','spaceship-coop'].map(slug=>'/try/'+slug+'/'):['/learning-hub/','/korean-racing/','/korean-rhythm/','/order-rush/','/korean-runner/'];
    const publicPages=entry===WORLD_CLOUD_PREVIEW_ENTRY&&['/try/order-rush/beginner.html','/try/learning-hub/collection.html'].includes(u.pathname);
    const bundled=entry===WORLD_CLOUD_PREVIEW_ENTRY&&['korean-runner','korean-rhythm','hangul-stage','town'].some(slug=>u.pathname==='/world/'+slug+'/'||u.pathname==='/world/'+slug+'/index.html');
    return trustedEntry(value,entry,clientId)||publicPages||bundled||paths.some(p=>u.pathname===p||u.pathname===p+'index.html');
  }
  return false;
}
// 「우리 반 수업」 링크(실시간·복습·재생목록·화상): WORLD 창이 새 탭으로 여는 그 주소만 시스템 브라우저로 넘긴다.
// 웹 판 experiences/synk-world-app/classroom-lessons.mjs의 safeClassroomLink와 같은 규칙이다(계정 정보는 아래에서 먼저 거른다).
function classroomDestination(u) {
  if(u.protocol!=='https:'||u.port)return null;
  const youtube=u.hostname==='www.youtube.com'&&((u.pathname==='/watch'&&/^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get('v')??''))||(u.pathname==='/playlist'&&/^[A-Za-z0-9_-]{10,100}$/.test(u.searchParams.get('list')??'')));
  const meet=u.hostname==='meet.google.com'&&/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname);
  const zoom=(u.hostname==='zoom.us'||/^[a-z0-9-]+\.zoom\.us$/.test(u.hostname))&&/^\/j\/\d+$/.test(u.pathname);
  return youtube||meet||zoom?u.href:null;
}
function externalDestination(value,entry,clientId,mode) {
  try {const u=new URL(value),base=new URL(entry);if(u.username||u.password)return null;
    if(clientId==='world'){const lesson=classroomDestination(u);if(lesson)return lesson;}
    if(clientId==='platform'&&value==='https://synk.im/account/client.html?product=platform')return value;
    if(clientId==='platform'&&Object.values(PUBLIC_APP_URLS).includes(value))return value;
    if(clientId==='world'&&entry!==WORLD_CLOUD_PREVIEW_ENTRY&&value==='https://synk.im/world/')return value;
    const paths=clientId==='platform'?['/learning-hub/']:clientId==='world'?(entry===WORLD_CLOUD_PREVIEW_ENTRY?['/account/platform.html','/account/index.html']:['/synk-account/platform.html','/synk-account/index.html']):[];
    if(u.origin===base.origin&&paths.includes(u.pathname))return new URL(u.pathname,base.origin).href;
    if(clientId==='platform'&&mode==='development'&&u.origin==='http://127.0.0.1:4191'&&u.pathname==='/')return 'http://127.0.0.1:4191/?tab=messenger';
  }catch{}return null;
}
function downloadSpec({url,mime,filename,size,sourceUrl,entry,clientId}) {
  if(typeof entry!=='string')return null;
  let origin;try{origin=entry===PLATFORM_ENTRY?'synk-desktop://platform':new URL(entry).origin;}catch{return null;}
  if(!allowedNavigation(sourceUrl,entry,clientId)||typeof url!=='string'||!url.startsWith('blob:'+origin+'/')||!Number.isFinite(size)||size<0)return null;
  if(clientId==='messenger')return trustedEntry(sourceUrl,entry,clientId)&&typeof mime==='string'&&mime.split(';')[0].trim()==='text/plain'&&filename==='synk-shift-practice.txt'&&size<=65536?{maxBytes:65536,extension:'txt',filterName:'Text',companySession:true}:null;
  const filenames=clientId==='platform'?['synk-platform-device-settings.json','synk-connected-learning.json']:clientId==='world'?['synk-connected-learning.json']:[];
  return mime==='application/json'&&filenames.includes(filename)&&size<=33554432?{maxBytes:33554432,extension:'json',filterName:'JSON',companySession:false}:null;
}
function allowedDownload(request){return !!downloadSpec(request);}
function inside(root,target,pathApi=path) {const relative=pathApi.relative(root,target);return relative!==''&&!relative.startsWith('..'+pathApi.sep)&&relative!=='..'&&!pathApi.isAbsolute(relative);}
function preferences(preload,partition) {return {preload,partition,sandbox:true,contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,nodeIntegrationInSubFrames:false,webviewTag:false,webSecurity:true,allowRunningInsecureContent:false,experimentalFeatures:false,devTools:false};}
module.exports={allowedUrl,safeEntry,assertSender,trustedEntry,inside,preferences,allowedNavigation,externalDestination,allowedDownload,downloadSpec,contentSecurityPolicy,nativeContentSecurityPolicy,isNativeEntry};
