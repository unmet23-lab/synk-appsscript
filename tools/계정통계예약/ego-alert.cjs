'use strict';

// ego 창에 「Profile error occurred」 알림이 뜨면 ego가 스크립트를 받지 못하고, 그동안 모든 읽기가 3분 제한에 걸렸다
// (11-20 ~ 25 열한 회차 가운데 일곱 회차, 현장 노트 「모든 세션의 ego 스크립트가 출력 없이 멈췄다」).
// 읽기가 오래 걸릴 때만 창을 보고, 그 알림이면 하나뿐인 「확인」을 눌러 닫는다. 닫으면 밀린 스크립트가 이어서 돌므로
// 명령을 다시 띄우지 않고 기다리는 시간을 늘린다(다시 띄우면 밀린 것과 새것이 함께 돈다).
const fs = require('node:fs');
const path = require('node:path');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const exec = promisify(execFile);
const CLOSER = path.join(__dirname,'ego-alert.ps1');
const WORDS = new Set(['none','closed','still_open','unexpected']);
// first · every: 창을 보는 때. total: 알림이 없을 때의 제한. afterClose: 닫은 뒤 더 기다리는 시간. max: 여러 번 닫아도 넘지 않는 제한.
const LIMITS = Object.freeze({first:20_000,every:40_000,total:180_000,afterClose:120_000,max:360_000});

async function runCloser({platform=process.platform,run=exec}={}) {
  if(platform!=='win32')return 'none';
  try{
    const {stdout}=await run('pwsh',['-NoProfile','-NonInteractive','-File',CLOSER],{windowsHide:true,shell:false,timeout:30_000,maxBuffer:64*1024,encoding:'utf8'});
    const word=String(stdout).trim();
    return WORDS.has(word)?word:'failed';
  }catch{return 'failed';}
}
// 동시에 읽는 계정이 셋까지라 같은 때 물으면 한 번만 본다.
let running=null;
function closeEgoAlert() {
  running??=runCloser().finally(()=>{running=null;});
  return running;
}

// 한 읽기가 닫으면 같은 때 밀려 있던 다른 읽기도 더 기다린다.
const shared={closedAt:0};

// ego 명령 하나를 지켜본다. 돌려주는 함수를 부르면 끝난다.
function guardEgo(child,{dir,name,check=closeEgoAlert,limits=LIMITS,state=shared}={}) {
  const started=Date.now(),checks=[];
  let over=false,timedOut=false,checkTimer,killTimer;
  const deadline=()=>Math.min(started+limits.max,Math.max(started+limits.total,state.closedAt>started?state.closedAt+limits.afterClose:0));
  const look=async()=>{
    let result;
    try{result=await check();}catch{result='failed';}
    if(over)return;
    checks.push({afterMs:Date.now()-started,result});
    if(result==='closed')state.closedAt=Date.now();
    checkTimer=setTimeout(look,limits.every);
  };
  const expire=()=>{
    const left=deadline()-Date.now();
    if(left>0){killTimer=setTimeout(expire,left);return;}
    timedOut=true;
    // execFile의 timeout과 같이 출력 통로를 먼저 닫는다. 닫지 않으면 남은 자식이 통로를 쥐고 있을 때 끝나지 않는다.
    child?.stdout?.destroy();child?.stderr?.destroy();child?.kill();
  };
  checkTimer=setTimeout(look,limits.first);
  killTimer=setTimeout(expire,limits.total);
  return ()=>{
    if(over)return;
    over=true;clearTimeout(checkTimer);clearTimeout(killTimer);
    // 정한 낱말과 걸린 시간만 남긴다. 알림이 없는데 끊긴 것도 적어야 멈춘 까닭을 가린다.
    if(!dir||!timedOut&&checks.every(c=>c.result==='none'))return;
    try{fs.writeFileSync(path.join(dir,'ego-alert-'+name+'.json'),JSON.stringify({at:new Date().toISOString(),timedOut,checks}),{flag:'wx'});}
    catch{/* 기록이 막혀도 읽기 결과를 바꾸지 않는다 */}
  };
}
module.exports={guardEgo,closeEgoAlert,runCloser,LIMITS,CLOSER};
