const CHANNEL='synk.company.entry',VERSION=1;
const COMPANY_ORIGIN='https://workspace.synk.im',HOST_ORIGIN='https://synk.im';
const PATHS={receiver:'/entry/',employee:'/',customer:'/pulse-app/'};
const CAPABILITIES={receiver:['data-synk-company-entry','1'],employee:['data-synk-company-entry','1'],customer:['data-pulse-invite-receiver','2']};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODES=new Set(['INVALID_INPUT','INVITE_REJECTED','TEMPORARY_UNAVAILABLE','RATE_LIMITED','ACCOUNT_CHANGED','ACCOUNT_MISMATCH','BUSY','CANCELLED','HANDOFF_TIMEOUT','HANDOFF_UNAVAILABLE']);
const RETRYABLE=new Set(['TEMPORARY_UNAVAILABLE','RATE_LIMITED','BUSY','HANDOFF_TIMEOUT','HANDOFF_UNAVAILABLE']);
const ID_FIELDS=['requestId','accountGeneration','documentId'];
const FIELDS={bind:[...ID_FIELDS,'phase','expectedAccountId'],offer:[...ID_FIELDS,'token'],cancel:ID_FIELDS};
const STAGE_MS=15000,TOTAL_MS=60000;

function exact(value,keys){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==Object.prototype&&prototype!==null)return false;
  const own=Reflect.ownKeys(value);
  return own.length===keys.length&&keys.every(key=>Object.hasOwn(value,key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'))&&own.every(key=>typeof key==='string'&&keys.includes(key));
}
const uuid=value=>typeof value==='string'&&UUID.test(value);
const ids=value=>ID_FIELDS.every(key=>uuid(value[key]));
const invite=value=>typeof value==='string'&&value.length>0&&value.length<=200&&value.trim().length>0;
function failure(code){return Object.assign(new Error('Company entry could not finish'),{code:CODES.has(code)?code:'TEMPORARY_UNAVAILABLE'});}
function classification(value){
  if(!exact(value,['version','kind','destination'])||value.version!==1)return null;
  return value.kind==='employee'&&value.destination==='/'||value.kind==='customer'&&value.destination==='/pulse-app/'?{kind:value.kind,destination:value.destination}:null;
}
const unavailable=()=>({status:'unavailable',destinations:[],unavailable:['workspace','pulse']});
function assignment(value){
  if(!exact(value,['version','accountMatch','workspace','pulse'])||value.version!==1||value.accountMatch!==true)return null;
  if(!exact(value.workspace,['state','destination'])||value.workspace.destination!=='/'||!['assigned','unassigned'].includes(value.workspace.state))return null;
  if(!exact(value.pulse,['state','destination'])||value.pulse.destination!=='/pulse-app/'||!['assigned','unassigned','unavailable'].includes(value.pulse.state))return null;
  return {status:value.pulse.state==='unavailable'?'partial':'resolved',destinations:[...(value.workspace.state==='assigned'?['/']:[]),...(value.pulse.state==='assigned'?['/pulse-app/']:[])],unavailable:value.pulse.state==='unavailable'?['pulse']:[]};
}

/** Memory-only receiver. App callbacks own their real invite queue and existing session/draft guards. */
export function createCompanyEntryReceiver({window:win=globalThis.window,role,inspectInvite,queueInvite,isInvitePending,resolveDestinations,cancelInvite,onState=()=>{},navigate}={}){
  if(!Object.hasOwn(PATHS,role)||!win)throw new TypeError('A company document role and window are required');
  const notify=state=>{try{onState(Object.freeze(state));}catch{/* UI reporting must not turn a failed handoff into an ACK. */}};
  let url;try{url=new URL(win.location.href);}catch{}
  const supported=win.top===win&&url?.origin===COMPANY_ORIGIN&&url.pathname===PATHS[role]&&!url.search&&!url.hash&&
    (role==='receiver'||typeof queueInvite==='function')&&typeof win.crypto?.randomUUID==='function';
  if(!supported){notify({status:'unavailable',code:'HANDOFF_UNAVAILABLE',retryable:true});return Object.freeze({dispose(){},cancel(){},waitForFirstHandoff:async()=>false});}

  const documentId=win.crypto.randomUUID(),[attribute,capability]=CAPABILITIES[role];
  const now=()=>win.performance.now(),setTimer=(f,ms)=>win.setTimeout(f,ms),clearTimer=id=>{if(id!==null)win.clearTimeout(id);};
  let active=null,disposed=false,closed=false,firstResult=null,firstTimer=null,totalTimer=null,stageTimer=null,startedAt=null,stageDeadline=null,firstDeadline=null;
  const retiredRequests=new Set();
  const waiters=new Set();
  function withinDeadline(){
    if(firstResult===true)return true;
    if(startedAt!==null&&now()-startedAt>=TOTAL_MS||stageDeadline!==null&&now()>=stageDeadline||firstDeadline!==null&&now()>=firstDeadline){end('HANDOFF_TIMEOUT');return false;}
    return true;
  }
  const current=record=>!disposed&&!closed&&active===record&&!record.controller.signal.aborted&&withinDeadline();
  const context=record=>({requestId:record.requestId,accountGeneration:record.accountGeneration,expectedAccountId:record.expectedAccountId,signal:record.controller.signal,isCurrent:()=>current(record)});
  const envelope=(type,record,extra={})=>({channel:CHANNEL,version:VERSION,type,requestId:record.requestId,accountGeneration:record.accountGeneration,documentId,...extra});
  const post=(peer,value)=>peer.target.postMessage(value,peer.origin);
  const same=(record,data)=>ID_FIELDS.every(key=>(key==='documentId'?documentId:record[key])===data[key]);
  function settle(value){if(firstResult===null)firstResult=value;for(const resolve of waiters)resolve(value);waiters.clear();clearTimer(firstTimer);firstTimer=null;}
  function clearTimers(){for(const timer of [firstTimer,totalTimer,stageTimer])clearTimer(timer);firstTimer=totalTimer=stageTimer=firstDeadline=stageDeadline=null;}
  function detach(){win.removeEventListener('message',message);win.document.documentElement.removeAttribute(attribute);}
  function discardQueue(record,reason){
    if(!record)return;
    record.controller.abort();record.token=null;
    if(typeof cancelInvite==='function'){
      try{const result=cancelInvite({...context(record),reason});Promise.resolve(result).catch(()=>notify({status:'error',code:'HANDOFF_UNAVAILABLE',retryable:true}));}
      catch{notify({status:'error',code:'HANDOFF_UNAVAILABLE',retryable:true});}
    }
  }
  function end(code='CANCELLED',{send=true,status=code==='CANCELLED'?'cancelled':'error'}={}){
    if(disposed||closed)return;
    code=CODES.has(code)?code:'CANCELLED';const record=active,terminal=role==='receiver';
    // Closing the request also blocks synchronous abort/notification callbacks
    // from binding another request before this cleanup has finished.
    closed=true;clearTimers();if(terminal)detach();active=null;
    if(record)retiredRequests.add(record.requestId);
    discardQueue(record,code);
    if(send&&record)try{post(record.peer,envelope('error',record,{code,retryable:RETRYABLE.has(code)}));}catch{}
    settle(false);notify({status,code,retryable:RETRYABLE.has(code)});
    if(!terminal&&!disposed){startedAt=null;closed=false;}
  }
  function stage(){clearTimer(stageTimer);stageDeadline=now()+STAGE_MS;stageTimer=setTimer(()=>end('HANDOFF_TIMEOUT'),STAGE_MS);}
  function total(){if(startedAt!==null)return;startedAt=now();totalTimer=setTimer(()=>end('HANDOFF_TIMEOUT'),TOTAL_MS);}
  function completed(record,status,extra){
    if(!current(record))return false;
    record.status=status;post(record.peer,envelope(status,record,extra));
    if(!current(record))return false;
    clearTimers();settle(true);notify({status,...extra});return current(record);
  }
  function peer(event){
    if(event.origin===COMPANY_ORIGIN&&event.source===win)return {target:win,origin:COMPANY_ORIGIN,mode:'native'};
    if(event.origin===HOST_ORIGIN&&win.opener&&event.source===win.opener)return {target:win.opener,origin:HOST_ORIGIN,mode:'web'};
    return null;
  }
  async function jsonPost(endpoint,body,signal){
    const response=await win.fetch(endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal,redirect:'error',cache:'no-store'});
    let data=null;try{data=await response.json();}catch{}
    return {response,data};
  }
  async function inspect(args){
    if(inspectInvite)return inspectInvite(args);
    const {response,data}=await jsonPost('/api/invite/inspect',{token:args.token},args.signal);
    if(!response.ok)throw failure(response.status===403?'INVITE_REJECTED':[400,413].includes(response.status)?'INVALID_INPUT':response.status===429?'RATE_LIMITED':'TEMPORARY_UNAVAILABLE');
    return data;
  }
  async function resolve(record){
    record.status='resolving';stage();notify({status:'resolving'});
    if(!current(record))return;
    try{
      let result;
      if(record.peer.mode==='native')result=unavailable();
      else{
        const args=context(record);
        if(resolveDestinations)result=assignment(await resolveDestinations(args));
        else{
          const {response,data}=await jsonPost('/api/customer/entry/destinations',{expectedAccountId:args.expectedAccountId},args.signal);
          if(response.status===401)result={status:'login_required',destinations:[],unavailable:['workspace','pulse']};
          else if(response.status===409)result={status:'account_mismatch',destinations:[],unavailable:['workspace','pulse']};
          else result=response.ok?assignment(data):unavailable();
        }
      }
      if(!current(record))return;
      result=result||unavailable();
      completed(record,'assignment',{result});
    }catch{if(current(record)){try{completed(record,'assignment',{result:unavailable()});}catch{end('HANDOFF_UNAVAILABLE');}}}
  }
  async function offered(record){
    record.status=record.phase==='classify'?'classifying':'queueing';stage();notify({status:record.status});
    if(!current(record))return;
    try{
      if(record.phase==='classify'){
        const result=classification(await inspect({...context(record),token:record.token}));
        if(!current(record))return;
        if(!result)throw failure('TEMPORARY_UNAVAILABLE');
        record.token=null;
        if(!completed(record,'classified',result))return;
        if(record.peer.mode==='web'&&current(record))(navigate||((destination)=>win.location.replace(destination)))(result.destination);
      }else{
        const queued=await queueInvite({...context(record),token:record.token});
        if(!current(record))return;
        if(!exact(queued,['queued'])||queued.queued!==true)throw failure('HANDOFF_UNAVAILABLE');
        const result={kind:role,destination:PATHS[role],state:'queued'};
        completed(record,'received',result);
      }
    }catch(error){if(current(record))end(CODES.has(error?.code)?error.code:'TEMPORARY_UNAVAILABLE');}
  }
  function message(event){
    if(disposed||closed||!withinDeadline())return;
    try{
      const sender=peer(event),data=event.data;if(!sender||!data||!Object.hasOwn(FIELDS,data.type)||!exact(data,['channel','version','type',...FIELDS[data.type]])||data.channel!==CHANNEL||data.version!==VERSION||!ids(data)||data.documentId!==documentId)return;
      if(data.type==='bind'){
        if(retiredRequests.has(data.requestId))return;
        const validPhase=data.phase==='classify'&&role==='receiver'||data.phase==='deliver'&&role!=='receiver'||data.phase==='resolve'&&role!=='employee';
        if(!validPhase||!(data.expectedAccountId===null||uuid(data.expectedAccountId))||data.phase==='resolve'&&!uuid(data.expectedAccountId)){
          post(sender,envelope('error',data,{code:'INVALID_INPUT',retryable:false}));return;
        }
        if(active){
          if(same(active,data)&&active.phase===data.phase&&active.expectedAccountId===data.expectedAccountId&&active.peer.target===sender.target&&active.peer.mode===sender.mode){post(sender,envelope('bound',active,{phase:active.phase}));return;}
          const previous=active;let consumed=previous.status==='assignment'&&data.requestId!==previous.requestId;
          if(previous.status==='received'&&data.requestId!==previous.requestId&&typeof isInvitePending==='function'){
            try{consumed=isInvitePending({requestId:previous.requestId,accountGeneration:previous.accountGeneration})===false;}catch{/* Unknown queue state remains BUSY. */}
          }
          if(!current(previous))return;
          if(!consumed){post(sender,envelope('error',data,{code:'BUSY',retryable:true}));return;}
          // The app consumed its queue, or the assignment response already ended.
          // Retire only our request context;
          // do not call cancelInvite or touch the app's existing session/draft.
          retiredRequests.add(previous.requestId);
          previous.status='retired';previous.token=null;previous.controller.abort();
          if(disposed||closed)return;
          active=null;clearTimers();startedAt=null;firstResult=null;
        }
        if(firstResult!==null){clearTimers();startedAt=null;firstResult=null;}
        total();clearTimer(firstTimer);firstTimer=firstDeadline=null;
        active={requestId:data.requestId,accountGeneration:data.accountGeneration,expectedAccountId:data.expectedAccountId,phase:data.phase,peer:sender,controller:new win.AbortController(),status:'bound',token:null};
        const record=active;stage();post(sender,envelope('bound',record,{phase:record.phase}));notify({status:'bound'});
        if(current(record)&&data.phase==='resolve')void resolve(record);
        return;
      }
      const record=active;
      if(!record||!same(record,data)||record.peer.target!==sender.target||record.peer.mode!==sender.mode)return;
      if(data.type==='cancel'){end('CANCELLED');return;}
      if(record.phase==='resolve')return;
      if(!invite(data.token)){post(sender,envelope('error',record,{code:'INVALID_INPUT',retryable:false}));return;}
      if(record.token!==null||record.status!=='bound'){
        if(record.token===data.token&&record.status==='received')post(sender,envelope('received',record,{kind:role,destination:PATHS[role],state:'queued'}));
        else if(record.token!==data.token)post(sender,envelope('error',record,{code:'BUSY',retryable:true}));
        return;
      }
      record.token=data.token;void offered(record);
    }catch{/* Malformed or detached-window messages cannot alter the current request. */}
  }
  function dispose(){if(disposed)return;if(!closed)end('CANCELLED',{send:false,status:'disposed'});disposed=true;clearTimers();detach();win.removeEventListener('pagehide',dispose);settle(false);}
  win.addEventListener('message',message);win.addEventListener('pagehide',dispose);
  win.document.documentElement.setAttribute(attribute,capability);
  const ready={channel:CHANNEL,version:VERSION,type:'ready',documentId,documentRole:role};
  try{win.postMessage(ready,COMPANY_ORIGIN);}catch{}
  try{if(win.opener)win.opener.postMessage(ready,HOST_ORIGIN);}catch{}
  notify({status:'ready'});
  return Object.freeze({dispose,cancel:code=>end(code||'CANCELLED'),waitForFirstHandoff(timeoutMs=STAGE_MS){
    if(disposed||closed)return Promise.resolve(false);
    if(firstResult!==null)return Promise.resolve(firstResult);
    const promise=new Promise(resolve=>waiters.add(resolve));total();
    if(!active&&firstTimer===null){const limit=Number.isFinite(timeoutMs)?Math.max(0,Math.min(STAGE_MS,timeoutMs)):STAGE_MS;firstDeadline=now()+limit;firstTimer=setTimer(()=>end('HANDOFF_TIMEOUT'),limit);}
    return promise;
  }});
}
