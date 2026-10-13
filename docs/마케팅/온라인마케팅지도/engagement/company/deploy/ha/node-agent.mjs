// Private node agent. Metadata identity; no public admin action or service-account key.
import {readFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {validateRuntime,validateControlState} from './controller.mjs';
const exec=promisify(execFile),PROJECT='synk-bake-unmet27',META='http://169.254.169.254/computeMetadata/v1/';
const code=s=>Object.assign(new Error(s),{code:s});
const check=(v,s)=>{if(!v)throw code(s);};
const enc=encodeURIComponent;
const safe=e=>typeof e?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(e.code)?e.code:e?.name==='TimeoutError'?'NODE_CHECK_TIMEOUT':'NODE_CHECK_FAILED';
const retryStatus=new Set([408,429,500,502,503,504]);
const transportCodes=new Set(['UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET','ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','EPIPE']);
// The application checks its public Host before the authentication boundary.
// Keep the connection local; a default loopback Host would return 403, not 401.
export const LOCAL_AUTH_PROBE_JS=`const {request}=require('node:http');
const origin=new URL(process.env.SYNK_COMPANY_ORIGIN),port=Number(process.env.SYNK_COMPANY_PORT||4191);
if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash||!Number.isInteger(port)||port<1||port>65535)process.exit(1);
const req=request({hostname:'127.0.0.1',port,path:'/pulse/api/project',headers:{Host:origin.host,Accept:'application/json'},signal:AbortSignal.timeout(5000)},res=>{res.resume();console.log(JSON.stringify({status:res.statusCode}));res.on('error',()=>{process.exitCode=1;});});
req.on('error',()=>{process.exitCode=1;});req.end();`;
async function json(response){let bytes=0;const parts=[];for await(const part of response.body??[]){bytes+=part.length;check(bytes<=1_048_576,'RESPONSE_TOO_LARGE');parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw code('RESPONSE_INVALID');}}
export function validateNodeConfig(c,plan){
  validateRuntime(plan);check(c?.schema==='synk-ha-node/v1','NODE_CONFIG');
  const node=[plan.nodes.primary,plan.nodes.standby].find(x=>x.instanceId===c.nodeId);
  check(node&&node.name===c.nodeName&&node.zone===c.zone,'NODE_IDENTITY');
  check(c.diskId===plan.data.diskId&&c.diskName===plan.data.name&&c.releaseSha256===plan.release.manifestSha256,'DATA_CONTRACT');
  check(c.planPath==='/etc/synk/ha/plan.json'&&c.helperPath==='/opt/synk/ha/node-host.py','LOCAL_PATHS');
  check(typeof c.activationAllowed==='boolean','ACTIVATION_FLAG');return node;
}
export function createNodeGoogle(c,plan,{fetchImpl=fetch,now=Date.now,clock=()=>performance.now(),log=()=>{}}={}){
  const node=validateNodeConfig(c,plan);let token,expiry=0,verified=false;
  const boundedSignal=(signal,ms)=>signal?AbortSignal.any([signal,AbortSignal.timeout(ms)]):AbortSignal.timeout(ms);
  // A retry consumes the original monotonic deadline, including body reads.
  // GET gets at most two attempts; writes and identity/integrity failures never retry.
  async function exchange(phase,url,options,consume,{signal,budgetMs=10000,started=clock()}={}){
    const deadline=started+budgetMs,method=options.method??'GET';
    const remaining=()=>Math.max(0,Math.ceil(deadline-clock()));
    const total=boundedSignal(signal,remaining());
    const emit=value=>{try{log({event:'SYNK_HA_API',phase,method,...value});}catch{}};
    const failure=(e,attempt,attemptStarted,stage,status)=>{
      const errorName=total.aborted?total.reason?.name:e?.name;
      const errorCode=[e?.code,e?.cause?.code].find(x=>transportCodes.has(x));
      const kind=status>=300&&!([404,412].includes(status))?'HTTP_'+status:errorName==='TimeoutError'||remaining()===0?'TIMEOUT':total.aborted||errorName==='AbortError'?'ABORTED':['RESPONSE_INVALID','RESPONSE_TOO_LARGE','METADATA_FAILED'].includes(e?.code)?e.code:errorCode?'TRANSPORT':'FAILED';
      return {code:phase+'_'+kind,attempt,stage,elapsedMs:Math.max(0,Math.ceil(clock()-started)),attemptMs:Math.max(0,Math.ceil(clock()-attemptStarted)),errorName:['TimeoutError','AbortError','TypeError','SyntaxError','Error'].includes(errorName)?errorName:'Error',...(errorCode?{errorCode}:{}),...(status?{status}:{})};
    };
    for(let attempt=1;attempt<=2;attempt++){
      const attemptStarted=clock();let response,stage='headers',status;
      const attemptSignal=boundedSignal(total,method==='GET'&&attempt===1?Math.min(budgetMs===4000?2000:4000,remaining()):remaining());
      try{
        total.throwIfAborted();if(!remaining())throw new DOMException('Deadline exceeded','TimeoutError');
        response=await fetchImpl(url,{...options,redirect:'error',signal:attemptSignal});status=response.status;
        if(!response.ok&&!([404,412].includes(status)))throw code('GOOGLE_API_'+status);
        stage='body';
        const value=await consume(response);attemptSignal.throwIfAborted();if(!remaining())throw new DOMException('Deadline exceeded','TimeoutError');
        if(attempt>1)emit({outcome:'RECOVERED',attempt,stage,elapsedMs:Math.max(0,Math.ceil(clock()-started)),attemptMs:Math.max(0,Math.ceil(clock()-attemptStarted)),status});
        return value;
      }catch(e){
        const cause=attemptSignal.aborted?attemptSignal.reason:e;
        const detail=failure(cause,attempt,attemptStarted,stage,status);
        const transient=cause?.name==='TimeoutError'||transportCodes.has(cause?.code)||transportCodes.has(cause?.cause?.code)||retryStatus.has(status);
        const backoff=50+Math.floor(Math.random()*101);
        const retry=method==='GET'&&attempt===1&&!total.aborted&&remaining()>backoff&&transient;
        emit({...detail,outcome:retry?'RETRY':'FAILED'});
        // Failed responses must not retain a pooled connection across the retry.
        try{await response?.body?.cancel();}catch{}
        if(!retry)throw code(detail.code);
        try{await delay(backoff,undefined,{signal:total});}catch(e){const ended=failure(e,attempt,attemptStarted,'backoff');emit({...ended,outcome:'FAILED'});throw code(ended.code);}
      }
    }
  }
  async function meta(path,phase,signal,parse=json){return exchange(phase,META+path,{headers:{'Metadata-Flavor':'Google'}},async r=>{check(r.ok&&r.headers.get('metadata-flavor')==='Google','METADATA_FAILED');return parse(r);},{signal,budgetMs:4000});}
  async function identity(signal){const [p,i]=await Promise.all([meta('project/project-id','META_PROJECT',signal,r=>r.text()),meta('instance/id','META_INSTANCE',signal,r=>r.text())]);check(p.trim()===PROJECT&&i.trim()===c.nodeId,'CLOUD_NODE_IDENTITY');verified=true;}
  async function auth(signal){if(!verified)await identity(signal);if(!token||expiry-now()<60_000){const t=await meta('instance/service-accounts/default/token','META_TOKEN',signal);check(typeof t.access_token==='string'&&t.token_type==='Bearer','METADATA_TOKEN');token=t.access_token;expiry=now()+Math.min(t.expires_in,3600)*1000;}return token;}
  async function request(phase,url,method='GET',body,signal){
    check(['https://storage.googleapis.com/','https://compute.googleapis.com/compute/v1/'].some(x=>url.startsWith(x)),'API_HOST');
    const started=clock(),total=boundedSignal(signal,10000),accessToken=await auth(total);
    return exchange(phase,url,{method,headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})},async r=>{if([404,412].includes(r.status)){await r.body?.cancel();return {status:r.status};}return {status:r.status,value:await json(r)};},{signal:total,started});
  }
  async function readObject(name,signal,phase='STATE'){const url=`https://storage.googleapis.com/storage/v1/b/${enc(plan.runtime.bucket)}/o/${enc(name)}`,m=await request(phase+'_META',url,'GET',undefined,signal);if(m.status===404)return null;check(/^\d+$/.test(m.value.generation),'OBJECT_GENERATION');const d=await request(phase+'_BODY',url+'?alt=media&generation='+m.value.generation,'GET',undefined,signal);check(d.status===200,'OBJECT_VERSION');return {generation:m.value.generation,value:d.value};}
  async function diskOwnership(){const base=`https://compute.googleapis.com/compute/v1/projects/${PROJECT}/`;const [v,d]=await Promise.all([request('COMPUTE_INSTANCE',base+`zones/${node.zone}/instances/${node.name}`),request('COMPUTE_DISK',base+`regions/${plan.region}/disks/${plan.data.name}`)]);check(v.value?.id===c.nodeId&&d.value?.id===c.diskId,'CLOUD_DISK_IDENTITY');const path=`/projects/${PROJECT}/regions/${plan.region}/disks/${plan.data.name}`;const found=v.value.disks?.filter(x=>x.source.endsWith(path));check(found?.length===1&&found[0].mode==='READ_WRITE'&&found[0].boot===false&&found[0].autoDelete===false,'CLOUD_WRITER_ATTACHMENT');return true;}
  async function putReceipt(command,value){const name=`${plan.runtime.receiptPrefix}${c.nodeId}/${command.operationId}/${command.generation}.json`;const r=await request('RECEIPT_WRITE',`https://storage.googleapis.com/upload/storage/v1/b/${enc(plan.runtime.bucket)}/o?uploadType=media&name=${enc(name)}&ifGenerationMatch=0`,'POST',value);if(r.status===412){const old=await readObject(name,undefined,'RECEIPT');check(old?.value?.nonce===command.nonce&&old.value.status==='DONE','RECEIPT_CONFLICT');return old;}return r;}
  async function putHealth(value,{signal}={}){
    validateHealthRecord(value,c,now());
    const name=`${plan.runtime.healthPrefix}${c.nodeId}.json`,old=await readObject(name,signal,'HEALTH');
    if(old){
      check(old.value?.nodeId===c.nodeId&&Number.isSafeInteger(old.value.at),'HEALTH_PRIOR_IDENTITY');
      if(old.value.at===value.at&&JSON.stringify(old.value)===JSON.stringify(value))return {generation:old.generation,unchanged:true};
      check(old.value.at<value.at,'HEALTH_OBSERVATION_NOT_NEWER');
    }
    // Use the observation time; transport latency must never renew old health.
    validateHealthRecord(value,c,now());
    const r=await request('HEALTH_WRITE',`https://storage.googleapis.com/upload/storage/v1/b/${enc(plan.runtime.bucket)}/o?uploadType=media&name=${enc(name)}&ifGenerationMatch=${old?.generation??'0'}`,'POST',value,signal);
    check(r.status!==412,'HEALTH_GENERATION_CONFLICT');
    check(/^\d+$/.test(r.value?.generation??''),'HEALTH_WRITE_UNCONFIRMED');
    return {generation:r.value.generation};
  }
  return {identity,diskOwnership,readState:()=>readObject(plan.runtime.stateObject),readReceipt:command=>readObject(`${plan.runtime.receiptPrefix}${c.nodeId}/${command.operationId}/${command.generation}.json`,undefined,'RECEIPT'),putReceipt,putHealth};
}
export function healthRecord(status){
  const keys=['nodeId','alive','ready','activeEpoch','releaseSha256','activationAllowed','guardsAccepted','at','stopFailed'];
  const value=Object.fromEntries(keys.map(k=>[k,status[k]]));
  return {schema:'synk-ha-health/v1',...value,status:status.ready&&status.alive&&status.activationAllowed&&status.guardsAccepted&&!status.stopFailed?'healthy':status.alive?'unhealthy':'unknown'};
}
export function validateHealthRecord(v,c,now){
  check(v?.schema==='synk-ha-health/v1'&&v.nodeId===c.nodeId&&v.releaseSha256===c.releaseSha256,'HEALTH_IDENTITY');
  check(['alive','ready','activationAllowed','guardsAccepted','stopFailed'].every(k=>typeof v[k]==='boolean'),'HEALTH_FLAGS');
  check(Number.isSafeInteger(v.activeEpoch)&&v.activeEpoch>=0&&Number.isSafeInteger(v.at)&&v.at<=now&&now-v.at<=15000,'HEALTH_FRESH_OBSERVATION');
  check(v.ready===false||(v.alive&&v.activationAllowed&&v.guardsAccepted&&!v.stopFailed&&v.activeEpoch>0),'HEALTH_READY_CONTRACT');
  check(v.status===healthRecord(v).status,'HEALTH_STATUS_CONTRACT');
}
export function createHealthPublisher({google,status,now=Date.now,log=()=>{},intervalMs=10000}){
  check(intervalMs===10000,'HEALTH_INTERVAL_CONTRACT');
  let pending=null,abort=null,closed=false,lastAttempt=null,lastShape=null,lastCode=null;
  function sample(){
    if(closed||pending)return false;
    const value=healthRecord(status()),shape=JSON.stringify([value.alive,value.ready,value.activeEpoch,value.activationAllowed,value.guardsAccepted,value.stopFailed]);
    if(lastAttempt!==null&&now()>=lastAttempt&&now()-lastAttempt<intervalMs&&shape===lastShape)return false;
    lastAttempt=now();lastShape=shape;abort=new AbortController();const controller=abort;
    const timer=setTimeout(()=>controller.abort(),5000);
    pending=Promise.resolve().then(async()=>{
      try{check(!controller.signal.aborted,'HEALTH_PUBLISH_CANCELLED');await google.putHealth(value,{signal:controller.signal});if(lastCode!==null){log({event:'SYNK_HA_HEALTH',code:'PUBLISH_RECOVERED'});lastCode=null;}}
      catch(e){const next=controller.signal.aborted?'PUBLISH_TIMEOUT':safe(e);if(lastCode!==next){log({event:'SYNK_HA_HEALTH',code:next});lastCode=next;}}
      finally{clearTimeout(timer);pending=null;abort=null;}
    });
    return true;
  }
  async function shutdown(){closed=true;abort?.abort();await pending;}
  return {sample,shutdown,settled:()=>pending??Promise.resolve()};
}
export function commandForNode(state,c,plan,now){
  validateControlState(state,plan);const q=state.command,o=state.operation;if(!q||q.to!==c.nodeId)return null;
  check(o&&q.operationId===o.operationId&&q.phase===o.phase&&q.generation===o.generation&&q.from===o.from&&q.to===o.to&&q.diskId===c.diskId&&q.releaseSha256===c.releaseSha256&&q.activeEpoch===o.activeEpoch,'COMMAND_CONTRACT');
  check(/^[a-f0-9-]{36}$/.test(q.nonce)&&Number.isSafeInteger(q.issuedAt)&&q.issuedAt<=now,'COMMAND_NONCE');
  check(!state.bootAllowed.includes(q.from)&&!state.readyAllowed.includes(q.from),'OLD_WRITER_NOT_REVOKED');return q;
}
export function bootAuthorized(state,c,plan){validateControlState(state,plan);check(c.activationAllowed&&state.bootAllowed.length===1&&state.bootAllowed[0]===c.nodeId,'WRITER_NOT_AUTHORIZED');if(state.operation&&state.operation.phase!=='COMPLETE')check(state.operation.to===c.nodeId&&['START_CANDIDATE','VERIFY_CANDIDATE','EXPOSE_CANDIDATE'].includes(state.operation.phase),'WRITER_PHASE');return state.operation?.to===c.nodeId?state.operation.activeEpoch:state.activeEpoch;}
export function createNodeAgent({config:c,plan,google,host,now=Date.now,verifyPublic,verifyNetwork,cancelHost=async()=>{}}){
  validateNodeConfig(c,plan);let state=null,lastRead=0,ready=false,alive=false,busy=false,reason='STARTING',epoch=0,guardsAccepted=false,lastRelease=null,stopFailed=false,closing=false,lastRecovery=null,needsRecovery=false;
  function status(){return {nodeId:c.nodeId,alive:alive&&now()-lastRead<=15000,ready:ready&&!closing&&!stopFailed&&now()-lastRead<=15000,activeEpoch:epoch,releaseSha256:c.releaseSha256,activationAllowed:c.activationAllowed,guardsAccepted,at:now(),reason,stopFailed};}
  async function confirmedStop(){await host('stop');stopFailed=false;}
  async function stopWriter(){if(!c.activationAllowed)return;needsRecovery=true;try{await confirmedStop();}catch{stopFailed=true;}}
  async function refreshAuthority(q){
    const current=await google.readState();check(current,'CONTROL_STATE_MISSING');validateControlState(current.value,plan);
    const fields=['operationId','phase','generation','from','to','diskId','releaseSha256','activeEpoch','nonce','issuedAt'];
    const latest=q?commandForNode(current.value,c,plan,now()):null;
    if(!q)check(['operation','command'].every(k=>JSON.stringify(current.value[k])===JSON.stringify(state[k])),'COMMAND_REPLACED');
    check((!q||latest&&fields.every(k=>latest[k]===q[k]))&&current.value.activeId===state.activeId&&current.value.activeEpoch===state.activeEpoch&&current.value.maintenanceUntil===state.maintenanceUntil&&['bootAllowed','readyAllowed'].every(k=>JSON.stringify(current.value[k])===JSON.stringify(state[k])),'COMMAND_REPLACED');
    state=current.value;lastRead=now();return current;
  }
  let idle=Promise.resolve(),finishTick,shutdownPromise;
  function shutdown(){
    closing=true;ready=false;alive=false;reason='STOPPING';
    // Cancel and join an in-flight start before stopping. Concurrent start/stop
    // commands could otherwise leave a late systemd start running at shutdown.
    return shutdownPromise??=(async()=>{await cancelHost();await idle;await stopWriter();})();
  }
  async function tick(){if(busy||closing)return;busy=true;
    idle=new Promise(resolve=>{finishTick=resolve;});
    try{
      const record=await google.readState();check(record,'CONTROL_STATE_MISSING');validateControlState(record.value,plan);state=record.value;lastRead=now();
      if(!state.readyAllowed.includes(c.nodeId))ready=false;
      epoch=state.operation?.to===c.nodeId?state.operation.activeEpoch:state.activeEpoch;
      // Immutable release bytes are checked on startup and at most once a minute.
      // Every promotion host action independently verifies the full release.
      if(lastRelease===null||now()<lastRelease||now()-lastRelease>=60000){await host('release');lastRelease=now();}alive=true;
      if(!c.activationAllowed){ready=false;reason='OBSERVE_ONLY';return;}
      guardsAccepted=(await host('guards')).guardsAccepted===true;check(guardsAccepted,'GUARDS_NOT_ACCEPTED');
      const owns=state.bootAllowed.includes(c.nodeId);
      if(!owns){await confirmedStop();}
      else{bootAuthorized(state,c,plan);await google.diskOwnership();}
      const q=commandForNode(state,c,plan,now());
      if(q){
        let recoveredStart=null;
        if(needsRecovery&&['START_CANDIDATE','VERIFY_CANDIDATE','EXPOSE_CANDIDATE'].includes(q.phase)){
          // Retry only a stack this agent stopped on an earlier failed check.
          // An unchanged durable command is required even when its immutable
          // receipt already exists. Never clear a failed stop on health alone.
          check(!closing&&state.maintenanceUntil<=now()&&(lastRecovery===null||now()-lastRecovery>=60000),'PROMOTION_RECOVERY_HELD');
          ready=false;lastRecovery=now();
          await refreshAuthority(q);bootAuthorized(state,c,plan);await google.diskOwnership();
          await confirmedStop();check(!closing,'AGENT_STOPPING');
          await refreshAuthority(q);bootAuthorized(state,c,plan);await google.diskOwnership();
          recoveredStart=await host('start');await refreshAuthority(q);check(!closing,'AGENT_STOPPING');
          bootAuthorized(state,c,plan);await google.diskOwnership();await host('health');
          needsRecovery=false;
        }
        const prior=await google.readReceipt(q);
        if(!prior){
          let evidence;
          if(q.phase==='FENCE_OLD_WRITER')evidence=await host('fence-proof');
          else if(q.phase==='ACCEPT_DATA'){await google.diskOwnership();evidence=await host('accept-data');}
          else if(q.phase==='START_CANDIDATE'){bootAuthorized(state,c,plan);await google.diskOwnership();evidence={...(recoveredStart??await host('start')),onlyWriter:c.nodeId,activeGeneration:epoch};}
          else if(q.phase==='VERIFY_CANDIDATE'){bootAuthorized(state,c,plan);await google.diskOwnership();evidence={...await host('health'),...await verifyNetwork(),onlyWriter:c.nodeId,activeGeneration:epoch};}
          else if(q.phase==='EXPOSE_CANDIDATE'){
            bootAuthorized(state,c,plan);check(state.readyAllowed.includes(c.nodeId),'ROUTE_NOT_AUTHORIZED');await host('health');ready=true;
            // Give the load balancer time to observe its healthy threshold. A
            // pending public route does not revoke a still-authorized writer.
            try{evidence=await verifyPublic();}catch{
              await refreshAuthority(q);bootAuthorized(state,c,plan);await google.diskOwnership();await host('health');
              ready=true;reason='ROUTE_PENDING';return;
            }
          }
          if(evidence){
            // Controller lease renewal changes the GCS generation while a long
            // host action is still running. Only the unchanged command and writer
            // permissions authorize its receipt, never the storage generation.
            await refreshAuthority(q);check(!closing,'AGENT_STOPPING');
            await google.putReceipt(q,{...q,...evidence,schema:'synk-ha-receipt/v1',nodeId:c.nodeId,at:now(),status:'DONE'});
          }
        }
      }
      if(owns&&state.readyAllowed.includes(c.nodeId)){
        try{check(!stopFailed,'STOP_NOT_CONFIRMED');await host('health');}catch(e){
          ready=false;
          // Recover an authorized owner after a transient control/API failure
          // stopped its stack. Never restart during maintenance or promotion.
          if(closing||state.activeId!==c.nodeId||state.maintenanceUntil>now()||state.operation&&state.operation.phase!=='COMPLETE'||lastRecovery!==null&&now()-lastRecovery<60000)throw e;
          lastRecovery=now();await refreshAuthority(null);bootAuthorized(state,c,plan);await google.diskOwnership();
          await confirmedStop();check(!closing,'AGENT_STOPPING');
          await refreshAuthority(null);bootAuthorized(state,c,plan);await google.diskOwnership();
          await host('start');await refreshAuthority(null);check(!closing,'AGENT_STOPPING');
          bootAuthorized(state,c,plan);await google.diskOwnership();await host('health');
        }
        needsRecovery=false;ready=true;
      }
      reason=ready?'READY':owns?'ACTIVE_NOT_EXPOSED':'STANDBY';
    }catch(e){ready=false;alive=false;reason=safe(e);lastRelease=null;if(!closing)await stopWriter();}
    finally{if(closing){ready=false;alive=false;}busy=false;finishTick();}
  }
  return {tick,status,shutdown};
}
async function load(cpath){const s=await stat(cpath);check(process.getuid?.()===0&&s.uid===0&&(s.mode&0o777)===0o600,'ROOT_CONFIG');const c=JSON.parse(await readFile(cpath,'utf8')),plan=JSON.parse(await readFile(c.planPath,'utf8'));validateNodeConfig(c,plan);return {c,plan};}
async function main(){
  check(process.platform==='linux','LINUX_REQUIRED');const args=process.argv.slice(2),guard=args[0]==='--check-start',cpath=guard?args[1]:args[0];check(cpath==='/etc/synk/ha/node.json','CONFIG_PATH');const {c,plan}=await load(cpath),google=createNodeGoogle(c,plan,{log:value=>console.error(JSON.stringify(value))});
  const activeHosts=new Map();
  const host=async action=>{
    let child,settled;
    const finished=new Promise(resolve=>{settled=resolve;});
    try{
      const stdout=await new Promise((resolve,reject)=>{
        child=execFile('python3',[c.helperPath,cpath,action],{timeout:action==='start'?600000:action==='stop'?300000:240000,killSignal:'SIGTERM',maxBuffer:1_048_576},(error,stdout)=>error?reject(error):resolve(stdout));
        activeHosts.set(child,finished);
      });
      const r=JSON.parse(stdout);check(!r.error,r.error);return r;
    }catch{throw code('HOST_'+action.toUpperCase().replaceAll('-','_')+'_FAILED');}
    finally{activeHosts.delete(child);settled();}
  };
  const cancelHost=async()=>{const pending=[...activeHosts];for(const [child] of pending)child.kill('SIGTERM');await Promise.all(pending.map(([,finished])=>finished));};
  if(guard){const r=await google.readState();check(r,'CONTROL_STATE_MISSING');const epoch=bootAuthorized(r.value,c,plan);await google.diskOwnership();await host('accept-data');console.log(JSON.stringify({allowed:true,activeEpoch:epoch}));return;}
  const localFetch=async()=>{const {stdout}=await exec('docker',['exec','synk-company-company-1','node','-e',LOCAL_AUTH_PROBE_JS],{timeout:12000});return JSON.parse(stdout);};
  const verifyNetwork=async()=>{check((await localFetch('/pulse/api/project')).status===401,'AUTH_BOUNDARY');for(const url of ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest','https://www.google.com/generate_204']){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000)});check(r.ok,'OUTBOUND_FAILED');await r.body?.cancel();}return {authBoundaryOk:true,outboundOk:true};};
  const verifyPublic=async()=>{const r=await fetch('https://workspace.synk.im/api/health',{redirect:'error',signal:AbortSignal.timeout(10000)});check(r.ok&&(await json(r)).ready===true,'PUBLIC_NOT_READY');return {publicHttpsReady:true,failbackDisabled:plan.automaticFailback===false};};
  const agent=createNodeAgent({config:c,plan,google,host,verifyNetwork,verifyPublic,cancelHost});
  const healthPublisher=createHealthPublisher({google,status:agent.status,log:value=>console.log(JSON.stringify(value))});
  const server=createServer((req,res)=>{if(req.method!=='GET'||!['/status','/ready'].includes(req.url)){res.writeHead(404);res.end();return;}const s=agent.status();res.writeHead(req.url==='/status'&&s.alive||req.url==='/ready'&&s.ready?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(s));});
  server.listen(4192,'0.0.0.0');let stopping=false,prior;
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{stopping=true;server.close();void healthPublisher.shutdown();void agent.shutdown();});
  try{while(!stopping){const start=Date.now();await agent.tick();const s=agent.status();if(s.reason!==prior){console.log(JSON.stringify({event:'SYNK_HA_NODE',nodeId:c.nodeId,reason:s.reason,stopFailed:s.stopFailed}));prior=s.reason;}if(!stopping){healthPublisher.sample();await new Promise(r=>setTimeout(r,Math.max(50,5000-(Date.now()-start))));}}}
  finally{await Promise.all([healthPublisher.shutdown(),agent.shutdown()]);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(JSON.stringify({event:'SYNK_HA_NODE_FAILED',code:safe(e)}));process.exitCode=1;});
