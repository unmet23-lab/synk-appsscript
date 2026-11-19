'use strict';
const {STATUS_URL,STOPPED_URL}=require('./connection-content.cjs');
const onGuide=url=>url===STATUS_URL||url===STOPPED_URL;

// 화면 프로세스가 사라지면(메모리 부족, GPU 재시작, 바깥에서 끝냄) 창은 첫 화면 없이 검게 남는다(11-19 트레이에 숨은 채 켜진 0.4.97).
// 그때 같은 창에 첫 화면을 다시 싣는다. 10분 안에 저절로 세 번 실었는데 또 사라지면 첫 화면 대신 「화면이 잇달아 멈췄어요」 안내를 싣는다
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
  // want: 기다리는 동안 들어온 요청. 사람이 연 요청(person)이 하나라도 있으면 사람 쪽을 따른다. goneAt: 저절로 첫 화면을 다시 실은 때
  // failedDocument: 주 프레임에 오류 문서(연결 거부 따위)가 실렸다. 다음 정상 실림(did-navigate)까지 화면으로 치지 않는다(엔진 다시 검수 -e GA1).
  // stoppedAt: 저절로 안내 화면을 실은 때. 10분 안에 한 번만 싣는다(엔진 다시 검수 -e GA2)
  let disposed=false,started=false,current=null,goneTimer=null,settling=null,awaiting=null,want=null,personDuringTimer=false,failedDocument=false,stoppedAt=-Infinity;const goneAt=[];
  const live=()=>!disposed&&!contents.isDestroyed();
  const aborted=error=>error?.errno===-3||error?.code==='ERR_ABORTED';
  function start(kind){
    if(!live())return Promise.resolve(false);
    started=true;
    const url=kind==='entry'?entry:kind==='stopped'?STOPPED_URL:STATUS_URL;
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
    return live()&&onGuide(contents.getURL())?connect():Promise.resolve(false);
  }
  function navigationStarted(_event,url,isInPlace,isMainFrame){
    if(!isMainFrame||isInPlace)return;
    if(current?.waitingForStart&&current.url===url){current.waitingForStart=false;return;}
    // A different user navigation supersedes a pending attempt, including its
    // eventual rejection. It must never replace the new page with the guide.
    current=null;
  }
  function navigationCommitted(_event,url){
    failedDocument=false;
    if(current?.url===url)current.committed=true;
  }
  // Electron은 오류 문서가 실리면 did-navigate 대신 주 프레임 did-fail-load를 낸다. 다른 이동에 밀려 그만둔 것(-3)은 오류 문서가 아니다
  function mainFailed(_event,code,_description,_url,isMainFrame){if(isMainFrame&&code!==-3)failedDocument=true;}
  function retryLink(event,url){
    if(event.defaultPrevented||!live()||!onGuide(contents.getURL())||url!==entry)return;
    event.preventDefault();void connect();
  }
  /* 지금 주 프레임에 화면이 있는가: 화면 프로세스가 살아 있고 주 프레임에 문서 주소가 있다.
     사라진 프레임에서 이동이 시작되면 Chromium은 곧바로 새 프로세스로 바꾼다. 그 이동이 문서 없이 끝나면 프로세스는 살아 있어도
     주 프레임 주소가 비어 있다. 사라진 채로는 mainFrame을 읽으면 예외가 난다(설계 검토 P2-3, Electron 44.5.1 실측) */
  function hasScreen(){
    if(failedDocument||contents.isCrashed?.())return false;
    if(!isProcessAlive(contents.getOSProcessId?.()))return false;
    try{return Boolean(contents.mainFrame?.url);}catch{return false;}
  }
  /* 화면이 없으면 첫 화면을 싣는다. 실었으면 true다. mode는 저절로(auto: 종료 알림 뒤)와 사람이 연 때(person)다.
     저절로는 10분 안에 세 번까지 첫 화면을 싣고, 그 뒤에는 안내 화면을 싣는다. 실제로 실은 때만 센다(화면 다시 검수 -g).
     사람이 연 때는 세지 않고 늘 첫 화면이다. 이 모듈의 연결 시도가 도는 중이거나 주 프레임이 싣는 중이면 끝난 뒤 다시 본다 */
  function recover(mode){
    if(!live()||!started||isQuitting())return false;
    const pending=!!current?.pending;
    if(pending||contents.isLoadingMainFrame?.()){
      want=want==='person'||mode==='person'?'person':'auto';
      if(pending){if(!awaiting){const attempt=current.promise;awaiting=attempt;attempt.finally(()=>{if(awaiting===attempt){awaiting=null;resume();}});}}
      else if(!settling){settling=()=>{settling=null;resume();};contents.once('did-stop-loading',settling);}
      return false;
    }
    if(hasScreen())return false;
    let kind='entry';
    if(mode==='auto'){
      const at=now();while(goneAt.length&&at-goneAt[0]>GONE_WINDOW_MS)goneAt.shift();
      if(goneAt.length<GONE_LIMIT)goneAt.push(at);
      // 안내 화면마저 되풀이해 사라지면 저절로는 더 싣지 않는다. 사람이 창을 열면 첫 화면을 싣는다
      else if(at-stoppedAt>GONE_WINDOW_MS){kind='stopped';stoppedAt=at;}
      else return false;
    }
    current=null;void start(kind);return true;
  }
  function resume(){const mode=want||'auto';want=null;recover(mode);}
  function rendererGone(){
    if(!live()||isQuitting())return;
    clearTimer(goneTimer);
    goneTimer=setTimer(()=>{goneTimer=null;const mode=personDuringTimer?'person':'auto';personDuringTimer=false;recover(mode);},GONE_DELAY_MS);
  }
  /* 창이 보이거나 초점을 받을 때, 그리고 사람이 창을 열어 달라고 할 때(이미 보이고 초점이 있어도) 부른다.
     종료 알림을 받았는지와 상관없이 지금 화면이 없으면 첫 화면을 싣는다. 실었으면 true다 */
  function recoverIfGone(){
    if(goneTimer!==null){personDuringTimer=true;return false;}
    return recover('person');
  }
  function dispose(){
    if(disposed)return;disposed=true;current=null;awaiting=null;want=null;clearTimer(goneTimer);goneTimer=null;
    if(settling){contents.removeListener('did-stop-loading',settling);settling=null;}
    contents.removeListener('did-start-navigation',navigationStarted);
    contents.removeListener('did-navigate',navigationCommitted);
    contents.removeListener('did-fail-load',mainFailed);
    contents.removeListener('will-navigate',retryLink);
    contents.removeListener('render-process-gone',rendererGone);
    contents.removeListener('destroyed',dispose);
  }
  contents.on('did-start-navigation',navigationStarted);
  contents.on('did-navigate',navigationCommitted);
  contents.on('did-fail-load',mainFailed);
  contents.on('will-navigate',retryLink);
  contents.on('render-process-gone',rendererGone);
  contents.on('destroyed',dispose);
  return {connect,retryIfDisconnected,recoverIfGone,dispose};
}
module.exports={createConnectionRecovery,STATUS_URL};
