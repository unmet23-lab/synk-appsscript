'use strict';
const fs=require('node:fs'),path=require('node:path');
function inspectApplicationDestination(app){
  const bundle=path.basename(path.dirname(path.dirname(path.dirname(app.getPath('exe')))));
  if(!bundle.endsWith('.app')||bundle==='.app')throw Error('Unrecognized application bundle');
  const destination=path.join('/Applications',bundle);let exists=false;
  try{fs.lstatSync(destination);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  try{fs.accessSync('/Applications',fs.constants.W_OK);if(exists)fs.accessSync(destination,fs.constants.W_OK);return {exists,requiresAuthorization:false};}
  catch(error){if(!['EACCES','EPERM','EROFS'].includes(error.code))throw error;return {exists,requiresAuthorization:true};}
}

// This gate is deliberately memory-only: moving the application bundle must not
// read, migrate, or reset the account/profile directory. Electron owns the
// successful move's quit and relaunch; the old process must not initialize UI.
function createMacApplicationLocationGate({app,dialog,platform=process.platform,packaged=app.isPackaged,smoke=false,productName=app.getName(),inspectDestination=()=>inspectApplicationDestination(app)}){
  let pending;
  async function warn(status){
    const detail=status==='manual-permission'
      ? 'Applications 폴더의 앱을 바꾸려면 관리자 권한이 필요해요. 기존 앱을 안전하게 확인할 수 있도록 Finder에서 이 앱을 Applications 폴더로 옮겨 주세요.'
      : status==='running-conflict'
      ? 'Applications 폴더의 같은 이름 앱이 실행 중이라 옮기지 않았어요. 그 앱을 완전히 종료한 뒤 다시 실행해 옮겨 주세요.'
      : status==='move-failed'||status==='location-unavailable'
        ? '앱을 Applications 폴더로 옮기지 못했어요. Finder에서 이 앱을 Applications 폴더로 옮긴 뒤 다시 열어 주세요.'
        : '현재 위치에서 계속 열어요. 다음에 실행할 때 다시 옮길 수 있어요.';
    try{await dialog.showMessageBox({type:'warning',title:productName,message:'현재 사본에 업데이트가 적용되지 않을 수 있어요.',detail:detail+'\n\nMac 업데이트는 Applications 폴더의 앱을 바꾸는 방식이에요. DMG나 다운로드 폴더의 사본을 계속 열면 이전 버전으로 실행될 수 있어요. 계정과 저장된 기록은 그대로 유지돼요.',buttons:['계속 열기'],defaultId:0,cancelId:0,noLink:true});}catch{}
    return {continueStartup:true,status};
  }
  async function check(){
    if(platform!=='darwin'||!packaged||smoke)return {continueStartup:true,status:'not-required'};
    try{if(app.isInApplicationsFolder())return {continueStartup:true,status:'in-applications'};}catch{return warn('location-unavailable');}
    let choice;
    try{choice=await dialog.showMessageBox({type:'question',title:productName,message:productName+'을(를) Applications 폴더로 옮길까요?',detail:'Applications 폴더에서 열면 다음 업데이트도 같은 앱에 적용돼요. 옮기면 앱이 다시 열리고, 계정과 저장된 기록은 그대로 유지돼요.',buttons:['Applications로 옮기기','현재 위치에서 열기'],defaultId:0,cancelId:1,noLink:true});}catch{return warn('move-failed');}
    if(choice.response!==0)return warn('declined');
    let conflict=null;
    try{
      let replacementApproved=false;
      const confirmReplacement=()=>dialog.showMessageBoxSync({type:'warning',title:productName,message:'Applications에 같은 이름의 앱이 있어요.',detail:'새 버전으로 바꾸면 Applications의 기존 앱이 교체돼요. 계정과 저장된 기록은 지우지 않아요.',buttons:['기존 앱 유지','새 버전으로 바꾸기'],defaultId:0,cancelId:0,noLink:true})===1;
      // Electron 44's administrator-authorized path bypasses conflictHandler.
      // Inspect only the application destination before entering either path.
      const destination=inspectDestination();
      // The privileged native path can delete a destination without consulting
      // conflictHandler. Keep it in Finder, whose replacement UI owns that step.
      if(destination.requiresAuthorization)return warn('manual-permission');
      if(destination.exists){
        replacementApproved=confirmReplacement();
        if(!replacementApproved)return warn('replacement-declined');
      }
      const moved=app.moveToApplicationsFolder({conflictHandler:type=>{
        // Electron's default for a running conflict only focuses the old copy;
        // refuse it so a declined/failed move can still open this requested copy.
        if(type==='existsAndRunning'){conflict='running-conflict';return false;}
        if(type!=='exists'){conflict='move-failed';return false;}
        const replace=replacementApproved||confirmReplacement();
        if(!replace)conflict='replacement-declined';
        return replace;
      }});
      if(moved)return {continueStartup:false,status:'moving'};
      return warn(conflict||'move-cancelled');
    }catch{return warn('move-failed');}
  }
  return {run(){if(!pending)pending=check();return pending;}};
}

module.exports={createMacApplicationLocationGate};
