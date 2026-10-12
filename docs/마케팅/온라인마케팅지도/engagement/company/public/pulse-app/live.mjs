// Only invalidation signals travel over SSE. Project data and the recipient's
// inbox are fetched with the existing same-origin authenticated API.
export const livePaths=mode=>mode==='staff'?{live:'/api/pulse-live',events:'/api/pulse-events',read:'/api/pulse-notifications/read'}:{live:'/pulse/api/live',events:'/pulse/api/events',read:'/pulse/api/notifications/read'};
export function projectRevision(snapshot,id,mode){return mode==='staff'?snapshot.projects?.find(row=>row.id===id)?.revision:snapshot.projectRevision;}
export function freshNotifications(items,seen,initial=false){const fresh=[];for(const item of items||[]){if(!initial&&!seen.has(item.id)&&item.unread)fresh.push(item);seen.add(item.id);}return fresh;}
export function createLiveConnection({mode,request,options=()=>({}),onSnapshot=()=>{},onFresh=()=>{},onStatus=()=>{},onExpired=()=>{},EventSourceImpl=globalThis.EventSource,environment=globalThis}){
  const paths=livePaths(mode),seen=new Set();let stopped=false,source=null,timer=null,inflight=false,again=false,initialized=false,controller=null,sourceOpen=false,readGeneration=0,readQueue=Promise.resolve();
  const status=value=>{if(!stopped)onStatus(value);};
  const accept=snapshot=>{if(stopped)return;const fresh=freshNotifications(snapshot.notifications,seen,!initialized);initialized=true;onSnapshot(snapshot);if(fresh.length)onFresh(fresh);};
  const schedule=()=>{clearTimeout(timer);if(!stopped)timer=setTimeout(pull,environment.document?.hidden?90000:45000);};
  async function pull(){
    if(stopped)return;if(environment.navigator?.onLine===false){status('offline');schedule();return;}if(inflight){again=true;return;}inflight=true;const generation=readGeneration;controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),12000);
    try{const snapshot=await request(paths.live,{signal:controller.signal});if(!stopped){if(generation!==readGeneration)again=true;else accept(snapshot);status(sourceOpen?'connected':'reconnecting');}}
    catch(error){if(stopped)return;if(error.status===401||error.status===403||error.status===404){stop();onExpired();return;}status(environment.navigator?.onLine===false?'offline':'reconnecting');}
    finally{clearTimeout(timeout);inflight=false;controller=null;schedule();if(again&&!stopped){again=false;queueMicrotask(pull);}}
  }
  function connect(){if(stopped||source||environment.navigator?.onLine===false||!EventSourceImpl)return;source=new EventSourceImpl(paths.events);source.addEventListener('open',()=>{sourceOpen=true;status('connected');pull();});source.addEventListener('changed',()=>pull());source.addEventListener('error',()=>{sourceOpen=false;status(environment.navigator?.onLine===false?'offline':'reconnecting');pull();});}
  const online=()=>{connect();pull();},offline=()=>{source?.close();source=null;sourceOpen=false;status('offline');},visible=()=>{if(!environment.document?.hidden){connect();pull();}};
  function stop(){stopped=true;clearTimeout(timer);controller?.abort();source?.close();source=null;environment.removeEventListener?.('online',online);environment.removeEventListener?.('offline',offline);environment.document?.removeEventListener('visibilitychange',visible);}
  environment.addEventListener?.('online',online);environment.addEventListener?.('offline',offline);environment.document?.addEventListener('visibilitychange',visible);status('connecting');connect();pull();
  return {stop,pull,read(ids){const run=async()=>{if(stopped)return;readGeneration++;try{const snapshot=await request(paths.read,{...options(),body:ids==='all'?{all:true}:{ids}});readGeneration++;if(Array.isArray(snapshot.notifications))accept(snapshot);else await pull();}catch(error){readGeneration++;pull();throw error;}};const result=readQueue.then(run,run);readQueue=result.catch(()=>{});return result;}};
}
