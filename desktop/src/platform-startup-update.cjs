'use strict';

// Startup/reopen temporarily owns the updater, joining any background transfer.
// The main account/session UI is created or shown only by proceed.
function createStartupUpdateGate({updater,platform=process.platform,onChange=()=>{},proceed=()=>{},recoveryCode=null,recoveryReleaseId=null}={}){
  let state='checking',code=null,active=true,operation=null,started=false,disposed=false;
  updater.setStartupActive?.(true);
  if(recoveryCode==='UPDATE_RECOVERED')updater.deferAutomaticRelease?.(recoveryReleaseId);
  function snapshot(){const value=updater.snapshot();return {state,code,platform,progress:value.progress||0,currentVersion:value.currentVersion,latestVersion:value.latestVersion,canRetry:active&&state==='error'&&!operation,canOpenCurrent:active&&['error','ready'].includes(state)&&!operation,canInstall:active&&platform==='darwin'&&state==='ready'&&!operation};}
  function publish(next,nextCode=null){if(disposed||!active)return;state=next;code=nextCode;try{onChange(snapshot());}catch{}}
  function finish(){if(!active||disposed)return snapshot();active=false;updater.setStartupActive?.(false);updater.start({check:false});proceed();return snapshot();}
  function observe(value){
    if(!active||disposed)return;
    if(value.state==='checking')publish('checking');
    else if(value.state==='downloading')publish('downloading');
    else if(value.state==='opening')publish('installing');
    else if(value.state==='error')publish('error',value.code||'UPDATE_FAILED');
    else if(platform==='darwin'&&value.state==='ready')publish('ready',value.code);
  }
  function run(task){
    if(operation)return operation;
    operation=Promise.resolve().then(task).catch(()=>publish('error','UPDATE_FAILED')).finally(()=>{operation=null;if(active&&!disposed)onChange(snapshot());});
    return operation;
  }
  async function attempt(){
    const existing=updater.snapshot().state,join=(['checking','downloading','opening'].includes(existing)||updater.isBusy?.())&&updater.waitForIdle;
    publish(existing==='downloading'?'downloading':existing==='opening'?'installing':'checking');let result=join?await updater.waitForIdle():await updater.checkForUpdate();if(!active||disposed)return;
    if(result.ok&&result.state==='opening'){publish('installing');return;}
    if(result.state==='disabled'||result.state==='current'){finish();return;}
    if(!result.ok||!['available','ready'].includes(result.state)){publish('error',result.code||'UPDATE_FAILED');return;}
    if(result.state!=='ready'){publish('downloading');result=await updater.downloadUpdate({automatic:true});}
    if(!active||disposed)return;
    if(!result.ok||result.state!=='ready'){publish('error',result.code||'UPDATE_FAILED');return;}
    if(platform==='darwin'){publish('ready');return;}
    publish('installing');result=await updater.installUpdate({automatic:true});
    if(active&&!disposed&&(!result.ok||result.state!=='opening'))publish('error',result.code||'UPDATE_OPEN_FAILED');
  }
  function start(){if(started||disposed)return operation||Promise.resolve(snapshot());started=true;if(recoveryCode){publish('error',recoveryCode);return Promise.resolve(snapshot());}return run(attempt);}
  function retry(){return snapshot().canRetry?run(attempt):Promise.resolve({...snapshot(),ok:false,code:'UPDATE_BUSY'});}
  function openCurrent(){if(!snapshot().canOpenCurrent)return {...snapshot(),ok:false,code:'UPDATE_BUSY'};return finish();}
  function install(){if(!snapshot().canInstall)return Promise.resolve({...snapshot(),ok:false,code:'UPDATE_BUSY'});return run(async()=>{publish('installing');const result=await updater.installUpdate();if(result.ok)publish('ready',result.code||'UPDATE_MANUAL_INSTALL');else publish('error',result.code||'UPDATE_OPEN_FAILED');});}
  function cancelInstall(){if(!active)return snapshot();if(state!=='installing')updater.cancelPending?.();return finish();}
  return {start,retry,openCurrent,install,cancelInstall,observe,snapshot,isBlocking:()=>active&&!disposed,dispose:()=>{disposed=true;updater.setStartupActive?.(false);}};
}
module.exports={createStartupUpdateGate};
