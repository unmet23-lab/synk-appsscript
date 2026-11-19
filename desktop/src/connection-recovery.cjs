'use strict';
const {STATUS_URL}=require('./connection-content.cjs');

// 화면 프로세스가 사라지면(메모리 부족, GPU 재시작, 바깥에서 끝냄) 창은 첫 화면 없이 검게 남는다(11-19 트레이에 숨은 채 켜진 0.4.97).
// 그때 같은 창에 첫 화면을 다시 싣는다. 10분 안에 세 번을 넘겨 되풀이되면 첫 화면 대신 안내 화면을 싣는다
const GONE_LIMIT=3,GONE_WINDOW_MS=10*60000,GONE_DELAY_MS=400;
// 프로세스가 아직 돌고 있는가. Windows에서도 신호 0은 끝난 프로세스에 ESRCH를 낸다
function processAlive(pid){
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}catch(error){return error?.code==='EPERM';}
}
/* 판정은 사건의 순서가 아니라 지금 상태로 한다(2026-11-19 설계 검토: 순서로 판정한 세 회차가 모두 P1이었다).
   사건(화면 프로세스 종료 알림, 창이 보임, 초점, 열기 요청)은 「지금 화면이 있는지 보라」는 신호일 뿐이다.
   종료 알림은 작업 큐를 거쳐 늦게 올 수 있고, 오지 않는 죽음이 있는지도 모른다 */
function createConnectionRecovery({contents,entry,isQuitting=()=>false,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,isProcessAlive=processAlive}){
  let disposed=false,started=false,current=null,goneTimer=null,settling=null,awaiting=null;const goneAt=[];
  const live=()=>!disposed&&!contents.isDestroyed();
  const aborted=error=>error?.errno===-3||error?.code==='ERR_ABORTED';
  function start(kind){
    if(!live())return Promise.resolve(false);
    started=true;
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
    if(current?.url===url)current.committed=true;
  }
  function retryLink(event,url){
    if(event.defaultPrevented||!live()||contents.getURL()!==STATUS_URL||url!==entry)return;
    event.preventDefault();void connect();
  }
  /* 지금 주 프레임에 화면이 있는가: 화면 프로세스가 살아 있고 주 프레임에 문서 주소가 있다.
     사라진 프레임에서 이동이 시작되면 Chromium은 곧바로 새 프로세스로 바꾼다. 그 이동이 문서 없이 끝나면 프로세스는 살아 있어도
     주 프레임 주소가 비어 있다. 사라진 채로는 mainFrame을 읽으면 예외가 난다(설계 검토 P2-3, Electron 44.5.1 실측) */
  function hasScreen(){
    if(contents.isCrashed?.())return false;
    if(!isProcessAlive(contents.getOSProcessId?.()))return false;
    try{return Boolean(contents.mainFrame?.url);}catch{return false;}
  }
  /* 첫 화면(한도에 걸렸으면 안내 화면)을 실을지 본다. 실었으면 true다.
     이 모듈이 건 연결 시도가 도는 중이면 그 시도가 안내 화면을 띄우는 데까지 끝난 뒤, 주 프레임이 싣는 중이면 그 이동이 끝난 뒤(실림, 실패, 취소) 다시 본다 */
  function recover(kind='entry'){
    if(!live()||!started||isQuitting())return false;
    if(current?.pending){
      if(!awaiting){const attempt=current.promise;awaiting=attempt;attempt.finally(()=>{if(awaiting===attempt)awaiting=null;recover(kind);});}
      return false;
    }
    if(contents.isLoadingMainFrame?.()){
      if(!settling){settling=()=>{settling=null;recover(kind);};contents.once('did-stop-loading',settling);}
      return false;
    }
    if(hasScreen())return false;
    current=null;void start(kind);return true;
  }
  function rendererGone(){
    if(!live()||isQuitting())return;
    const at=now();while(goneAt.length&&at-goneAt[0]>GONE_WINDOW_MS)goneAt.shift();
    // 10분 안에 세 번을 넘으면 첫 화면 대신 안내 화면을 싣는다. 스크립트가 없어 같은 까닭으로 다시 죽을 일이 적고, 「다시 연결」이 첫 화면으로 잇는다(설계 검토 P2-2)
    const kind=goneAt.length>=GONE_LIMIT?'status':'entry';
    if(kind==='entry')goneAt.push(at);
    clearTimer(goneTimer);
    goneTimer=setTimer(()=>{goneTimer=null;recover(kind);},GONE_DELAY_MS);
  }
  /* 창이 보이거나 초점을 받을 때, 그리고 사람이 창을 열어 달라고 할 때(이미 보이고 초점이 있어도) 부른다.
     종료 알림을 받았는지와 상관없이 지금 화면이 없으면 첫 화면을 싣는다. 사람의 동작마다 한 번이라 한도를 세지 않는다. 실었으면 true다 */
  function recoverIfGone(){
    if(goneTimer!==null)return false;
    return recover('entry');
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
