'use strict';

const fs=require('node:fs'),path=require('node:path');
const {randomBytes}=require('node:crypto');
const failure=code=>Object.assign(new Error(code),{updateCode:code});
function launchWindowsUpdate({spawn,file,pid,automatic=false,nonce,timeoutMs=30000}={}){
  if(typeof file!=='string'||!Number.isSafeInteger(pid)||pid<=0||automatic&&!/^[a-f0-9]{64}$/.test(nonce||''))return Promise.reject(failure('UPDATE_HANDOFF_INVALID'));
  const args=automatic?['--auto-update','--wait-pid='+pid,'--handoff-token='+nonce]:['--wait-pid='+pid];
  return new Promise((resolve,reject)=>{
    let child,timer,finished=false,buffer='';
    const done=error=>{if(finished)return;finished=true;clearTimeout(timer);child?.stdout?.removeListener('data',data);child?.stdout?.destroy();child?.removeListener('exit',exit);child?.unref();if(error)reject(error);else resolve();};
    const exit=()=>done(failure('UPDATE_HANDOFF_FAILED'));
    const data=chunk=>{
      buffer+=chunk.toString('utf8');
      if(buffer.length>256){done(failure('UPDATE_HANDOFF_INVALID'));return;}
      const newline=buffer.indexOf('\n');if(newline<0)return;
      const line=buffer.slice(0,newline).replace(/\r$/,'');
      done(line==='SYNK_UPDATE_READY '+nonce?null:failure('UPDATE_HANDOFF_INVALID'));
    };
    try{child=spawn(file,args,{detached:true,stdio:automatic?['ignore','pipe','ignore']:'ignore',windowsHide:true});}
    catch{done(failure('UPDATE_HANDOFF_FAILED'));return;}
    child.once('error',()=>done(failure('UPDATE_HANDOFF_FAILED')));
    child.once('spawn',()=>{if(!automatic)done();});
    if(automatic){child.once('exit',exit);child.stdout?.on('data',data);timer=setTimeout(()=>done(failure('UPDATE_HANDOFF_TIMEOUT')),timeoutMs);timer.unref?.();}
  });
}

/* ── 넘김 쪽지, 가림막, 도착 쪽지(검정 구 1-가 구현 설계 2절과 6절) ──
   쪽지는 모양만 바꾼다. 쓰거나 읽다 난 실패는 모두 삼키고, 그때는 쪽지가 없을 때처럼 간다(가림막 없이 지금처럼 넘긴다). */
const APP_ID='im.synk.platform.preview';
const MAX_NOTE_BYTES=4096,ARRIVAL_MAX_AGE_MS=5*60*1000;
const VISIBILITY=new Set(['front','behind','minimized','hidden']);
const ARRIVAL_KINDS=new Set(['updated','installed','restored']);
const handoffFolder=localAppData=>path.join(localAppData,'SYNK','Installer','Handoff');
function handoffPaths(localAppData,appId=APP_ID){const folder=handoffFolder(localAppData);return {folder,handoff:path.join(folder,appId+'.handoff.json'),arrival:path.join(folder,appId+'.arrival.json')};}
const int=value=>Number.isFinite(value)?Math.round(value):0;
function curtainEventName(){return 'Local\\SYNK.Curtain.'+randomBytes(16).toString('hex');}
/* 앱 창의 핸들(Buffer)을 쪽지에 적을 수로. 64비트 Windows의 창 핸들은 32비트 안에 있다 */
function windowHandle(buffer){try{if(!Buffer.isBuffer(buffer)||buffer.length<4)return 0;const value=buffer.length>=8?Number(buffer.readBigUInt64LE(0)):buffer.readUInt32LE(0);return Number.isSafeInteger(value)&&value>0?value:0;}catch{return 0;}}
/* 앱은 새 쪽지를 쓰기 전에 옛 쪽지를 지우고, 넘김이 취소되거나 실패하면 쪽지를 지운다(6절) */
function removeHandoffNote({localAppData,appId=APP_ID}={}){try{fs.rmSync(handoffPaths(localAppData,appId).handoff,{force:true});return true;}catch{return false;}}
function writeHandoffNote({localAppData,appId=APP_ID,token,appPid,version,window=0,bounds,maximized=false,visibility,quiet=false,cut=0.5,curtainEvent=null,now=Date.now}={}){
  try{
    if(typeof localAppData!=='string'||!path.isAbsolute(localAppData)||!/^[a-f0-9]{64}$/.test(token||'')||!Number.isSafeInteger(appPid)||appPid<=0||!/^\d+\.\d+\.\d+$/.test(version||'')||!VISIBILITY.has(visibility))return false;
    if(curtainEvent!==null&&!/^Local\\SYNK\.Curtain\.[a-f0-9]{32}$/.test(curtainEvent))return false;
    const paths=handoffPaths(localAppData,appId);removeHandoffNote({localAppData,appId});
    const note={schemaVersion:1,token,appPid,version,window:Number.isSafeInteger(window)&&window>0?window:0,x:int(bounds?.x),y:int(bounds?.y),width:int(bounds?.width),height:int(bounds?.height),maximized:maximized===true,visibility,quiet:quiet===true,cut:Math.max(0,Math.min(1,Number.isFinite(cut)?cut:0.5)),curtainEvent,writtenAt:new Date(now()).toISOString()};
    const text=JSON.stringify(note);if(Buffer.byteLength(text)>MAX_NOTE_BYTES)return false;
    fs.mkdirSync(paths.folder,{recursive:true});
    const temporary=paths.handoff+'.'+randomBytes(8).toString('hex')+'.partial';
    try{fs.writeFileSync(temporary,text,{flag:'wx',mode:0o600});fs.renameSync(temporary,paths.handoff);}finally{try{fs.rmSync(temporary,{force:true});}catch{}}
    return true;
  }catch{return false;}
}
/*
  가림막을 켠다. 받은 새 판 설치 파일을 --curtain으로 켜고, 첫 장을 그렸다는 SYNK_CURTAIN_READY를 기다린다.
  timeoutMs(1.5초) 안에 오지 않으면 그 프로세스를 끝내고 null로 돌아온다(가림막 없이 지금처럼 넘긴다, 2절 가림막 8번).
  돌려주는 손잡이: cancel()은 끝내기가 취소됐을 때, closing()은 마지막 창이 닫혀 will-quit에 들어설 때 보낸다.
*/
function launchCurtain({spawn,file,token,timeoutMs=1500,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  if(typeof spawn!=='function'||typeof file!=='string'||!/^[a-f0-9]{64}$/.test(token||''))return Promise.resolve(null);
  return new Promise(resolve=>{
    let child,timer=null,finished=false,buffer='';
    const say=line=>{try{if(child?.stdin&&!child.stdin.destroyed&&child.stdin.writable)child.stdin.write(line+'\n');}catch{}};
    const handle={cancel:()=>{say('cancel');},closing:()=>{say('closing');},kill:()=>{try{child?.kill();}catch{}},get pid(){return child?.pid||0;}};
    const done=ok=>{
      if(finished)return;finished=true;clearTimer(timer);
      child?.stdout?.removeListener?.('data',data);try{child?.stdout?.destroy?.();}catch{}
      if(!ok){try{child?.kill();}catch{}resolve(null);return;}
      // 앱이 끝나도 가림막은 남는다. 앱이 끝나며 입력이 닫히면 가림막이 「closing」 뒤의 닫힘으로 안다
      try{child.unref?.();child.stdin?.unref?.();}catch{}
      resolve(handle);
    };
    const data=chunk=>{
      buffer+=chunk.toString('utf8');
      if(buffer.length>256){done(false);return;}
      const newline=buffer.indexOf('\n');if(newline<0)return;
      done(buffer.slice(0,newline).replace(/\r$/,'')==='SYNK_CURTAIN_READY');
    };
    try{child=spawn(file,['--curtain','--handoff-token='+token],{detached:true,stdio:['pipe','pipe','ignore'],windowsHide:true});}
    catch{resolve(null);return;}
    child.once?.('error',()=>done(false));
    child.once?.('exit',()=>done(false));
    child.stdin?.on?.('error',()=>{});
    child.stdout?.on?.('data',data);
    timer=setTimer(()=>done(false),timeoutMs);timer?.unref?.();
  });
}
/*
  도착 쪽지를 읽고 지운다(6절). 쓴 지 5분이 넘었거나, 판 번호가 이 앱과 다르거나, 이 앱을 켠 프로세스가 쪽지를 쓴 설치기가 아니거나, 읽다가 틀리면 버린다.
  돌려주는 자리는 화면 화소다. 앱이 화면 좌표로 바꿔 fitPlacement로 화면 안에 놓는다
*/
function consumeArrivalNote({localAppData,appId=APP_ID,version,parentPid,now=Date.now}={}){
  let file;
  try{
    if(typeof localAppData!=='string'||!path.isAbsolute(localAppData))return null;
    file=handoffPaths(localAppData,appId).arrival;
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_NOTE_BYTES)return null;
    const note=JSON.parse(fs.readFileSync(file,'utf8'));
    const written=Date.parse(note?.writtenAt),age=now()-written;
    if(!note||note.schemaVersion!==1||!ARRIVAL_KINDS.has(note.kind)||!VISIBILITY.has(note.visibility)||note.version!==version||!Number.isFinite(written)||age>ARRIVAL_MAX_AGE_MS||age< -30000)return null;
    if(!Number.isSafeInteger(note.installerPid)||note.installerPid<=0||note.installerPid!==parentPid)return null;
    const bounds=[note.x,note.y,note.width,note.height].every(Number.isFinite)&&note.width>=200&&note.height>=200?{x:note.x,y:note.y,width:note.width,height:note.height}:null;
    return {kind:note.kind,visibility:note.visibility,maximized:note.maximized===true,bounds,cut:Number.isFinite(note.cut)?Math.max(0,Math.min(1,note.cut)):1,lit:Number.isFinite(note.lit)?Math.max(0,Math.min(1,note.lit)):0.58};
  }catch{return null;}
  finally{if(file)try{fs.rmSync(file,{force:true});}catch{}}
}
module.exports={launchWindowsUpdate,APP_ID,handoffPaths,curtainEventName,windowHandle,writeHandoffNote,removeHandoffNote,launchCurtain,consumeArrivalNote};
