'use strict';
const {STATUS_URL}=require('./connection-content.cjs');

// 화면 프로세스가 사라지면(메모리 부족, GPU 재시작, 바깥에서 끝냄) 창은 첫 화면 없이 검게 남는다(11-19 트레이에 숨은 채 켜진 0.4.97).
// 그때 같은 창에 첫 화면을 다시 싣는다. 10분 안에 세 번을 넘겨 되풀이되면 더 싣지 않는다
const GONE_LIMIT=3,GONE_WINDOW_MS=10*60000,GONE_DELAY_MS=400;
// 프로세스가 아직 돌고 있는가. Windows에서도 신호 0은 끝난 프로세스에 ESRCH를 낸다
function processAlive(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}
}
function createConnectionRecovery({contents,entry,isQuitting=()=>false,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,isProcessAlive=processAlive}){
  // gone: 화면 프로세스가 사라졌다는 알림을 받았고, 그 뒤 주 프레임에 새 문서가 실리지 않았다. 실리면(did-navigate) 거둔다.
  // 이동이 시작됐다는 것만으로는 거두지 않는다. 그 이동이 취소되면 창이 검게 남는다(엔진 다시 검수 -b GA1).
  // 알림은 늦게 올 수 있다(옛 화면 프로세스의 알림이 새 문서가 실린 뒤에 옴). 그래서 싣기 직전에 지금 주 프레임의 화면 프로세스가 살아 있는지 본다(엔진 다시 검수 -c Q1).
  // isCrashed()만으로는 모른다. 종료 코드 0(clean-exit)으로 사라지면 대신 맡은 화면 프로세스가 없어도 false다(엔진 검수 GA3)
  let disposed=false,current=null,goneTimer=null,gone=false,settling=null,awaiting=null;const goneAt=[];
  const live=()=>!disposed&&!contents.isDestroyed();
  const aborted=error=>error?.errno===-3||error?.code==='ERR_ABORTED';
  function start(kind){
    if(!live())return Promise.resolve(false);
    const url=kind==='entry'?entry:STATUS_URL;
    const attempt={url,kind,pending:true,waitingForStart:true,committed:false,promise:null};
    current=attempt;
    attempt.promise=Promise.resolve().then(()=>{
      if(!live()||current!==attempt)return false;
      return contents.loadURL(url).then(()=>true);
    }).then(loaded=>!!loaded&&live()&&current===attempt).catch(async error=>{
      // loadURL belongs to this main-frame navigation. Global did-fail-load events
      // can also describe subframes or an older navigation to the same URL.
      if(!live()||current!==attempt||attempt.committed||aborted(error))return false;
      if(kind==='entry')await start('status');
      return false;
    }).finally(()=>{attempt.pending=false;});
    return attempt.promise;
  }
  function connect(){
    if(live()&&current?.kind==='entry'&&current.pending)return current.promise;
    return start('entry');
  }
  function retryIfDisconnected(){
    return live()&&contents.getURL()===STATUS_URL?connect():Promise.resolve(false);
  }
  function navigationStarted(_event,url,isInPlace,isMainFrame){
    if(!isMainFrame||isInPlace)return;
    if(current?.waitingForStart&&current.url===url){current.waitingForStart=false;return;}
    // A different user navigation supersedes a pending attempt, including its
    // eventual rejection. It must never replace the new page with the guide.
    current=null;
  }
  function navigationCommitted(_event,url){
    // 이동이 시작된 뒤 옛 화면 프로세스가 사라져도, 그 이동이 새 프로세스에 실리면 되살리지 않는다(화면 다시 검수 -d)
    gone=false;
    if(current?.url===url)current.committed=true;
  }
  function retryLink(event,url){
    if(event.defaultPrevented||!live()||contents.getURL()!==STATUS_URL||url!==entry)return;
    event.preventDefault();void connect();
  }
  function reload(){current=null;void start('entry');}
  /* 사라진 채 아직 새 문서가 없으면 첫 화면을 싣는다. 주 프레임이 싣는 중이면(다른 이동) 그 이동이 끝난 뒤(실림, 실패, 취소) 다시 본다.
     실리면 gone이 거둬져 그대로 두고, 실패하거나 취소되면 싣는다 */
  function rendererAlive(){
    if(contents.isCrashed?.())return false;
    return isProcessAlive(contents.getOSProcessId?.());
  }
  function recover(){
    if(!live()||isQuitting()||!gone)return false;
    // 지금 주 프레임의 화면 프로세스가 살아 있으면 늦게 온 옛 알림이다. 그대로 둔다
    if(rendererAlive()){gone=false;return false;}
    // 이 모듈이 건 연결 시도(다시 실행 때의 다시 잇기 등)가 도는 중이면, 그 시도가 실패해 안내 화면을 띄우는 데까지 끝난 뒤 다시 본다(엔진 다시 검수 -c GA1)
    if(current?.pending){
      if(!awaiting){const attempt=current.promise;awaiting=attempt;attempt.finally(()=>{if(awaiting===attempt)awaiting=null;recover();});}
      return false;
    }
    if(contents.isLoadingMainFrame?.()){
      if(!settling){settling=()=>{settling=null;recover();};contents.once('did-stop-loading',settling);}
      return false;
    }
    reload();return true;
  }
  function rendererGone(){
    if(!live())return;
    gone=true;
    if(isQuitting())return;
    const at=now();while(goneAt.length&&at-goneAt[0]>GONE_WINDOW_MS)goneAt.shift();
    // 10분 안에 세 번을 넘으면 저절로는 더 싣지 않는다. 사람이 창을 꺼내거나(트레이 열기, 다시 실행) 다른 창에서 돌아오면 recoverIfGone이 싣는다
    if(goneAt.length>=GONE_LIMIT)return;
    goneAt.push(at);clearTimer(goneTimer);
    goneTimer=setTimer(()=>{goneTimer=null;recover();},GONE_DELAY_MS);
  }
  /* 창이 보이거나 초점을 받을 때, 그리고 사람이 창을 열어 달라고 할 때(이미 보이고 초점이 있어도) 부른다.
     사라진 채 새 문서가 없으면 횟수와 상관없이 첫 화면을 싣는다. 실었으면 true다 */
  function recoverIfGone(){
    if(goneTimer!==null)return false;
    return recover();
  }
  function dispose(){
    if(disposed)return;disposed=true;current=null;awaiting=null;clearTimer(goneTimer);goneTimer=null;
    if(settling){contents.removeListener('did-stop-loading',settling);settling=null;}
    contents.removeListener('did-start-navigation',navigationStarted);
    contents.removeListener('did-navigate',navigationCommitted);
    contents.removeListener('will-navigate',retryLink);
    contents.removeListener('render-process-gone',rendererGone);
    contents.removeListener('destroyed',dispose);
  }
  contents.on('did-start-navigation',navigationStarted);
  contents.on('did-navigate',navigationCommitted);
  contents.on('will-navigate',retryLink);
  contents.on('render-process-gone',rendererGone);
  contents.on('destroyed',dispose);
  return {connect,retryIfDisconnected,recoverIfGone,dispose};
}
module.exports={createConnectionRecovery,STATUS_URL};
