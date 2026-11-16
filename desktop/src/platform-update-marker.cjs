'use strict';
/*
  「바꾸는 중」 표시(검정 구 1-가 구현 설계 2절 「조용한 업데이트」의 장치 1).
  설치기는 READY를 쓴 뒤 앱이 꺼지기를 기다릴 때부터 앱을 켜도 되는 때까지 Handoff\<appId>.updating.json을 쥐고 2초마다 파일 시각만 고친다.
  그 사이 사람이 SYNK를 켜면, 앱은 창과 서비스를 만들기 전에 이 표시를 보고 Handoff\<appId>.show-request에 설치기 번호를 적은 뒤 바로 끝난다.
  설치기는 그 요청을 보고 창을 보이고 앞으로 가져온다. 이 앱은 아무 창도 띄우지 않는다(알림 상자도 띄우지 않는다).
*/
const fs=require('node:fs'),path=require('node:path');
const APP_ID='im.synk.platform.preview';
const STALE_MS=10000,MAX_BYTES=4096;
function markerPaths(localAppData,appId=APP_ID){const folder=path.join(localAppData,'SYNK','Installer','Handoff');return {folder,marker:path.join(folder,appId+'.updating.json'),request:path.join(folder,appId+'.show-request')};}
function processAlive(pid){try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}}
function pause(ms){try{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}catch{}}
/*
  표시가 있는지 본다. 파일 시각이 10초 안이고 그 번호의 설치기가 살아 있으면 있다.
  내용을 읽다 틀리면 한 번 더 읽는다. 그래도 못 읽었는데 시각이 10초 안이면 있다고 본다(잘못 보더라도 그 틈은 10초를 넘지 않는다)
*/
function readUpdatingMarker({localAppData,appId=APP_ID,now=Date.now,isAlive=processAlive,read=file=>fs.readFileSync(file,'utf8'),stat=file=>fs.statSync(file)}={}){
  if(typeof localAppData!=='string'||!path.isAbsolute(localAppData))return {present:false,pid:null};
  const {marker}=markerPaths(localAppData,appId);
  let info;try{info=stat(marker);}catch{return {present:false,pid:null};}
  if(!info.isFile?.()||now()-info.mtimeMs>STALE_MS)return {present:false,pid:null};
  for(let attempt=0;attempt<2;attempt++){
    try{
      const text=read(marker);if(text.length>MAX_BYTES)break;
      const pid=JSON.parse(text)?.pid;
      if(Number.isSafeInteger(pid)&&pid>0)return isAlive(pid)?{present:true,pid}:{present:false,pid:null};
      break;
    }catch{}
  }
  return {present:true,pid:null};
}
/* 설치기에 창을 보이라고 청한다. 번호를 모르면 번호 칸을 비운다. 0.2초 간격으로 다섯 번까지 다시 써 보고, 못 쓰면 조용히 그만둔다 */
function writeShowRequest({localAppData,appId=APP_ID,pid=null,now=Date.now,write=(file,text)=>fs.writeFileSync(file,text),wait=pause}={}){
  if(typeof localAppData!=='string'||!path.isAbsolute(localAppData))return false;
  const {folder,request}=markerPaths(localAppData,appId);
  const text=JSON.stringify({pid:Number.isSafeInteger(pid)&&pid>0?pid:null,at:new Date(now()).toISOString()});
  for(let attempt=0;attempt<6;attempt++){
    try{fs.mkdirSync(folder,{recursive:true});write(request,text);return true;}catch{}
    if(attempt<5)wait(200);
  }
  return false;
}
/* 앱을 켤 때 맨 처음: 표시가 있으면 요청을 남기고 끝난다. 끝났으면 true */
function yieldToUpdatingInstaller({localAppData,appId=APP_ID,exit,...options}={}){
  const seen=readUpdatingMarker({localAppData,appId,...options});
  if(!seen.present)return false;
  writeShowRequest({localAppData,appId,pid:seen.pid,...options});
  exit(0);
  return true;
}
module.exports={STALE_MS,markerPaths,readUpdatingMarker,writeShowRequest,yieldToUpdatingInstaller};
