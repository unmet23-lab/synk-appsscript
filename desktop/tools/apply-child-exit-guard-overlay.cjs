'use strict';
// The bundled Workspace client is a reviewed public package plus exact overlays (build-child-release.cjs).
// Its company page keeps unsaved drafts with beforeunload, and Electron cancels closing, reopening and
// quitting with no word unless main handles will-prevent-unload (10-22: a Workspace window that would
// not close). This overlay adds only that prompt: two exact entry-point lines and the shared
// src/draft-exit.cjs from the frozen release source. Nothing else in the package changes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {inventory}=require('./freeze-platform-release.cjs');
const HELPER='src/draft-exit.cjs';
// Each edit replaces one whole line and keeps its own line ending: the public 0.4.11 entry point is CRLF,
// and the location gate overlay added LF lines inside it.
const EDITS=Object.freeze([
  ["const {installDraftExitGuard}=require('./draft-exit.cjs');","const {installDraftExitGuard,WORKSPACE_EXIT_TEXT}=require('./draft-exit.cjs');"],
  ["  if(isPlatform)installDraftExitGuard({contents,window,dialog,getRecoveryAvailable:()=>!!draftRecovery?.available()});","  if(isPlatform)installDraftExitGuard({contents,window,dialog,getRecoveryAvailable:()=>!!draftRecovery?.available()});else if(runtime.clientId==='messenger')installDraftExitGuard({contents,window,dialog,text:WORKSPACE_EXIT_TEXT});"],
]);
// The one index where line is a whole line of source, or -1 when it is missing, partial or repeated.
function wholeLine(source,line){
  const found=[];for(let at=source.indexOf(line);at>=0;at=source.indexOf(line,at+1))found.push(at);
  if(found.length!==1)return -1;const at=found[0],next=source.slice(at+line.length,at+line.length+2);
  return (at===0||source[at-1]==='\n')&&(next[0]==='\n'||next==='\r\n')?at:-1;
}
function swapLines(source,pairs,mismatch){
  for(const [from,to] of pairs){const at=wholeLine(source,from);if(at<0)throw Error(mismatch+': '+from.trim());source=source.slice(0,at)+to+source.slice(at+from.length);}
  return source;
}
function overlayChildExitGuard(source){
  if(source.includes('WORKSPACE_EXIT_TEXT'))throw Error('Child exit guard overlay already applied');
  return swapLines(source,EDITS,'Child exit guard overlay anchor mismatch');
}
// A refreshed baseline may already carry the overlay. Accept only the exact canonical transform.
function verifyAppliedExitGuard(source){
  const plain=swapLines(source,EDITS.map(([before,after])=>[after,before]),'Existing child exit guard differs');
  if(overlayChildExitGuard(plain)!==source)throw Error('Existing child exit guard is not the canonical transform');
}
// The helper comes from the frozen release source; it must still give the entry point what it calls.
function verifyHelper(code){
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,require:()=>{throw Error('Child exit guard helper must stand alone');}},{timeout:1000});
  const {installDraftExitGuard,WORKSPACE_EXIT_TEXT:text}=module.exports;
  if(typeof installDraftExitGuard!=='function'||!text||!['title','message','detail','leave'].every(key=>typeof text[key]==='string'&&text[key]))throw Error('Child exit guard helper differs');
}
function applyChildExitGuardOverlay(stage,commonSource){
  stage=path.resolve(stage);commonSource=path.resolve(commonSource);
  if(stage===commonSource)throw Error('Child overlay requires a separate reviewed stage');
  const runtime=JSON.parse(fs.readFileSync(path.join(stage,'runtime.json'),'utf8'));
  if(runtime.clientId!=='messenger')throw Error('Child exit guard overlay is only for Workspace');
  const mainFile=path.join(stage,'src/main.cjs'),helperFile=path.join(stage,HELPER);
  if(!fs.existsSync(helperFile))throw Error('Child exit guard helper missing');
  // Decide everything before writing, so an unrecognized package fails unchanged.
  const before=inventory(stage),original=fs.readFileSync(mainFile,'utf8'),helper=fs.readFileSync(path.join(commonSource,HELPER));
  verifyHelper(helper.toString('utf8'));
  const reused=original.includes('WORKSPACE_EXIT_TEXT');
  if(reused)verifyAppliedExitGuard(original);
  const main=reused?original:overlayChildExitGuard(original);
  fs.writeFileSync(mainFile,main);fs.writeFileSync(helperFile,helper);
  const after=inventory(stage),previous=new Map(before.map(row=>[row.path,row])),allowed=new Set(['src/main.cjs',HELPER]),changed=[];
  for(const row of after){const old=previous.get(row.path);previous.delete(row.path);if(!old)throw Error('Unexpected child exit guard file: '+row.path);if(old.sha256!==row.sha256){if(!allowed.has(row.path))throw Error('Unexpected child exit guard change: '+row.path);changed.push({...row,beforeSHA256:old.sha256});}}
  if(previous.size)throw Error('Child exit guard overlay removed a file');
  return {ok:true,clientId:runtime.clientId,reused,changed,unchangedFiles:after.length-changed.length,userDataOperations:0};
}
module.exports={applyChildExitGuardOverlay,overlayChildExitGuard,EXIT_GUARD_HELPER:HELPER};
