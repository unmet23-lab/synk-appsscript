const failure=(message,status)=>Object.assign(new Error(message),{status});

/**
 * resolveAccess must synchronously revalidate the request's original session,
 * active user, current role and read permissions before returning its revision.
 * Returning null or throwing denies access. No workspace content is sent here.
 */
export function createCreativeResearchEvents({resolveAccess,heartbeatMs=15000,maxConnections=128}={}){
  if(typeof resolveAccess!=='function')throw new Error('변경 알림에는 현재 읽기 권한 확인이 필요합니다.');
  if(!Number.isInteger(heartbeatMs)||heartbeatMs<1||heartbeatMs>300000)throw new Error('변경 알림 유지 간격을 확인해 주세요.');
  if(!Number.isInteger(maxConnections)||maxConnections<1||maxConnections>1000)throw new Error('변경 알림 연결 한도를 확인해 주세요.');
  const connections=new Set();
  let timer=null,stopped=false;

  function revisionFor(req){
    try{
      const access=resolveAccess(req);
      if(typeof access?.then==='function'){Promise.resolve(access).catch(()=>{});return null;}
      const revision=access?.revision;
      return typeof revision==='string'&&revision.length>0&&revision.length<=256?revision:null;
    }catch{return null;}
  }
  function clearHeartbeat(){if(timer!==null){clearInterval(timer);timer=null;}}
  function close(connection,{destroy=false}={}){
    if(connection.closed)return;
    connection.closed=true;connections.delete(connection);
    const {req,res,onClose,onFailure}=connection;
    req.removeListener('aborted',onClose);req.removeListener('error',onFailure);
    res.removeListener('close',onClose);res.removeListener('finish',onClose);res.removeListener('error',onFailure);
    if(connections.size===0)clearHeartbeat();
    try{if(destroy){if(!res.destroyed)res.destroy();}else if(!res.destroyed&&!res.writableEnded)res.end();}catch{try{res.destroy();}catch{}}
  }
  function write(connection,frame){
    if(connection.closed||connection.req.aborted||connection.res.destroyed||connection.res.writableEnded){close(connection);return false;}
    try{
      // A stalled client must not accumulate notifications without a bound.
      if(connection.res.write(frame)===false){close(connection,{destroy:true});return false;}
      return !connection.closed;
    }catch{close(connection,{destroy:true});return false;}
  }
  function refresh(connection,heartbeat=false){
    if(connection.closed)return false;
    const revision=revisionFor(connection.req);
    if(revision===null){close(connection);return false;}
    if(connection.closed)return false;
    if(revision!==connection.revision){
      if(!write(connection,'event: changed\ndata: '+JSON.stringify({revision})+'\n\n'))return false;
      connection.revision=revision;return true;
    }
    if(heartbeat)write(connection,': heartbeat\n\n');
    return false;
  }
  function changed(){
    if(stopped)return 0;
    let sent=0;
    for(const connection of connections)if(refresh(connection))sent++;
    return sent;
  }
  function connect(req,res){
    if(stopped)throw failure('변경 알림 서비스가 종료 중입니다.',503);
    if(revisionFor(req)===null)throw failure('로그인 상태와 자료 읽기 권한을 다시 확인해 주세요.',401);
    if(connections.size>=maxConnections)throw failure('변경 알림 연결이 많습니다. 잠시 후 다시 연결해 주세요.',503);
    const connection={req,res,revision:null,closed:false};
    connection.onClose=()=>close(connection);
    connection.onFailure=()=>close(connection,{destroy:true});
    // Request close marks a completed GET too; response close tracks the stream.
    req.on('aborted',connection.onClose);req.on('error',connection.onFailure);
    res.on('close',connection.onClose);res.on('finish',connection.onClose);res.on('error',connection.onFailure);
    connections.add(connection);
    try{
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.flushHeaders?.();refresh(connection);
      if(!connection.closed&&timer===null){timer=setInterval(()=>{for(const item of connections)refresh(item,true);},heartbeatMs);timer.unref?.();}
    }catch(error){close(connection,{destroy:true});throw error;}
    return ()=>close(connection);
  }
  function stop(){
    if(stopped)return;
    stopped=true;clearHeartbeat();
    for(const connection of connections)close(connection);
  }
  return {connect,changed,stop};
}
