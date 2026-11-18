'use strict';
const {STATUS_URL}=require('./connection-content.cjs');

// 화면 프로세스가 사라지면(메모리 부족, GPU 재시작, 바깥에서 끝냄) 창은 첫 화면 없이 검게 남는다(11-19 트레이에 숨은 채 켜진 0.4.97).
// 그때 같은 창에 첫 화면을 다시 싣는다. 10분 안에 세 번을 넘겨 되풀이되면 더 싣지 않는다
const GONE_LIMIT=3,GONE_WINDOW_MS=10*60000,GONE_DELAY_MS=400;
function createConnectionRecovery({contents,entry,isQuitting=()=>false,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}){
  let disposed=false,current=null,goneTimer=null;const goneAt=[];
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
    if(current?.url===url)current.committed=true;
  }
  function retryLink(event,url){
    if(event.defaultPrevented||!live()||contents.getURL()!==STATUS_URL||url!==entry)return;
    event.preventDefault();void connect();
  }
  function rendererGone(){
    if(!live()||isQuitting())return;
    const at=now();while(goneAt.length&&at-goneAt[0]>GONE_WINDOW_MS)goneAt.shift();
    if(goneAt.length>=GONE_LIMIT)return;
    goneAt.push(at);clearTimer(goneTimer);
    goneTimer=setTimer(()=>{
      goneTimer=null;
      // 그사이 새 화면 프로세스가 이미 맡았으면(다른 이동) 그대로 둔다
      if(!live()||isQuitting()||typeof contents.isCrashed==='function'&&!contents.isCrashed())return;
      current=null;void start('entry');
    },GONE_DELAY_MS);
  }
  function dispose(){
    if(disposed)return;disposed=true;current=null;clearTimer(goneTimer);goneTimer=null;
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
  return {connect,retryIfDisconnected,dispose};
}
module.exports={createConnectionRecovery,STATUS_URL};
