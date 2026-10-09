'use strict';
const {STATUS_URL}=require('./connection-content.cjs');

function createConnectionRecovery({contents,entry}){
  let disposed=false,current=null;
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
  function dispose(){
    if(disposed)return;disposed=true;current=null;
    contents.removeListener('did-start-navigation',navigationStarted);
    contents.removeListener('did-navigate',navigationCommitted);
    contents.removeListener('will-navigate',retryLink);
    contents.removeListener('destroyed',dispose);
  }
  contents.on('did-start-navigation',navigationStarted);
  contents.on('did-navigate',navigationCommitted);
  contents.on('will-navigate',retryLink);
  contents.on('destroyed',dispose);
  return {connect,retryIfDisconnected,dispose};
}
module.exports={createConnectionRecovery,STATUS_URL};
