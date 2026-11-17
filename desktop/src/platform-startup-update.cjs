'use strict';

// Startup/reopen temporarily owns the updater, joining any background transfer.
// The main account/session UI is created or shown only by proceed.
//
// 켜짐부터 열림까지(1-가 구현 설계 2절과 5절). 확인 단계의 인터넷 실패(UPDATE_NETWORK_FAILED, UPDATE_TIMEOUT)는
// 실패 장면 없이 지금 판을 연다. 확인이 earlyOpenMs 안에 답하지 않으면 지금 판을 먼저 열고, 확인은 뒤에서 마저 한다.
// 숨은 채 시작(hidden)에서는 어느 단계에서 실패해도 지금 판을 숨은 채 열고, 그 실패는 unseenFailure로 남겨
// 다음에 창을 열 때 보인다. initialError를 주면 확인하지 않고 그 실패 장면부터 보인다(되돌림, 보이지 않은 실패).
const SILENT_CHECK_FAILURES=new Set(['UPDATE_NETWORK_FAILED','UPDATE_TIMEOUT']);
const EARLY_OPEN_MS=4000;
function createStartupUpdateGate({updater,platform=process.platform,onChange=()=>{},proceed=()=>{},recoveryCode=null,recoveryReleaseId=null,initialError=null,hidden=false,keepDeferred=false,earlyOpenMs=EARLY_OPEN_MS,setTimer=setTimeout,clearTimer=clearTimeout,onSilentFailure=()=>{}}={}){
  let state='checking',code=null,stage='check',active=true,operation=null,started=false,disposed=false,unseen=null;
  updater.setStartupActive?.(true,{keepDeferred});
  if(recoveryCode==='UPDATE_RECOVERED')updater.deferAutomaticRelease?.(recoveryReleaseId);
  const firstError=initialError?.code||recoveryCode;
  function snapshot(){const value=updater.snapshot();return {state,code,stage,platform,hidden,progress:value.progress||0,currentVersion:value.currentVersion,latestVersion:value.latestVersion,canRetry:active&&state==='error'&&!operation,canOpenCurrent:active&&['error','ready'].includes(state)&&!operation,canInstall:active&&platform==='darwin'&&state==='ready'&&!operation};}
  function publish(next,nextCode=null){if(disposed||!active)return;state=next;code=nextCode;try{onChange(snapshot());}catch{}}
  function finish(){if(!active||disposed)return snapshot();active=false;updater.setStartupActive?.(false);updater.start({check:false});proceed();return snapshot();}
  /* 숨은 채 시작한 길: 실패 장면을 지금 보이지 않고 지금 판을 숨은 채 연다. 그 실패는 다음에 창을 열 때 보인다 */
  function fail(nextCode){
    if(!active||disposed)return;
    if(hidden){unseen={code:nextCode,stage,releaseId:updater.snapshot().releaseId||null};try{onSilentFailure(unseen);}catch{}finish();return;}
    publish('error',nextCode);
  }
  function observe(value){
    if(!active||disposed)return;
    if(value.state==='checking')publish('checking');
    else if(value.state==='downloading'){stage='download';publish('downloading');}
    else if(value.state==='opening'){stage='handoff';publish('installing');}
    // 확인 단계의 인터넷 실패는 확인 결과를 받은 attempt가 실패 장면 없이 지금 판을 연다. 업데이터가 먼저 알리는 오류 상태로 실패 장면을 띄우지 않는다(0.4.96 공개 후보 카본 D2)
    else if(value.state==='error'){if(stage==='check'&&SILENT_CHECK_FAILURES.has(value.code))return;fail(value.code||'UPDATE_FAILED');}
    else if(platform==='darwin'&&value.state==='ready')publish('ready',value.code);
  }
  function run(task){
    if(operation)return operation;
    operation=Promise.resolve().then(task).catch(()=>fail('UPDATE_FAILED')).finally(()=>{operation=null;if(active&&!disposed)onChange(snapshot());});
    return operation;
  }
  /* 확인이 늦으면 지금 판을 먼저 연다. 확인은 그대로 이어지고, 새 판이 있으면 뒤에서 받는 길(5분 확인과 같은 길)로 넘긴다 */
  function checkInTime(){
    let timer=null,early=false;
    const check=updater.checkForUpdate();
    if(!(earlyOpenMs>0))return check;
    return Promise.race([check,new Promise(resolve=>{timer=setTimer(()=>{early=true;resolve(null);},earlyOpenMs);timer?.unref?.();})]).then(result=>{
      clearTimer(timer);
      if(!early)return result;
      finish();
      void check.then(late=>{if(late?.ok&&['available','ready'].includes(late.state))void updater.checkInBackground?.();}).catch(()=>{});
      return null;
    });
  }
  async function attempt(){
    const existing=updater.snapshot().state,join=(['checking','downloading','opening'].includes(existing)||updater.isBusy?.())&&updater.waitForIdle;
    stage=existing==='downloading'?'download':existing==='opening'?'handoff':'check';
    publish(existing==='downloading'?'downloading':existing==='opening'?'installing':'checking');
    let result=join?await updater.waitForIdle():await checkInTime();if(!active||disposed||!result)return;
    if(result.ok&&result.state==='opening'){stage='handoff';publish('installing');return;}
    if(result.state==='disabled'||result.state==='current'){finish();return;}
    if(!result.ok||!['available','ready'].includes(result.state)){
      const failed=result.code||'UPDATE_FAILED';
      if(stage==='check'&&SILENT_CHECK_FAILURES.has(failed)){try{onSilentFailure({code:failed,stage,silent:true});}catch{}finish();return;}
      fail(failed);return;
    }
    if(result.state!=='ready'){stage='download';publish('downloading');result=await updater.downloadUpdate({automatic:true});}
    if(!active||disposed)return;
    if(!result.ok||result.state!=='ready'){fail(result.code||'UPDATE_FAILED');return;}
    if(platform==='darwin'){if(hidden){finish();return;}publish('ready');return;}
    stage='handoff';publish('installing');result=await updater.installUpdate({automatic:true});
    if(active&&!disposed&&(!result.ok||result.state!=='opening'))fail(result.code||'UPDATE_OPEN_FAILED');
  }
  function start(){if(started||disposed)return operation||Promise.resolve(snapshot());started=true;if(firstError){stage=initialError?.stage||'handoff';publish('error',firstError);return Promise.resolve(snapshot());}return run(attempt);}
  function retry(){return snapshot().canRetry?run(attempt):Promise.resolve({...snapshot(),ok:false,code:'UPDATE_BUSY'});}
  function openCurrent(){if(!snapshot().canOpenCurrent)return {...snapshot(),ok:false,code:'UPDATE_BUSY'};return finish();}
  function install(){if(!snapshot().canInstall)return Promise.resolve({...snapshot(),ok:false,code:'UPDATE_BUSY'});return run(async()=>{publish('installing');const result=await updater.installUpdate();if(result.ok)publish('ready',result.code||'UPDATE_MANUAL_INSTALL');else publish('error',result.code||'UPDATE_OPEN_FAILED');});}
  function cancelInstall(){if(!active)return snapshot();if(state!=='installing')updater.cancelPending?.();return finish();}
  /* 숨은 채 시작한 길에서 사람이 창을 부르면 그때부터는 보이는 길이다. 그 뒤의 실패는 실패 장면으로 보인다 */
  function reveal(){hidden=false;}
  return {start,retry,openCurrent,install,cancelInstall,observe,snapshot,reveal,unseenFailure:()=>unseen,isBlocking:()=>active&&!disposed,dispose:()=>{disposed=true;updater.setStartupActive?.(false);}};
}
/* 숨은 채 시작한 길의 보이지 않은 실패가 뒤에서 풀렸는지 본다. 풀렸으면 다음에 창을 열 때 옛 실패 장면을 보이지 않는다.
   확인 실패는 확인이 다시 되면, 받기 실패는 받기가 끝나거나 새 판이 없어지면, 넘김 실패는 새 판이 없어지면 풀린다(0.4.96 카본 D2) */
function unseenFailureResolved(failure,state){
  if(!failure||!state)return false;
  if(failure.stage==='check')return ['current','available','downloading','ready'].includes(state.state);
  if(failure.stage==='download')return ['current','ready'].includes(state.state);
  if(failure.stage==='handoff')return state.state==='current';
  return false;
}
module.exports={createStartupUpdateGate,unseenFailureResolved,SILENT_CHECK_FAILURES,EARLY_OPEN_MS};
