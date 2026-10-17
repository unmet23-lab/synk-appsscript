// Cloud-only, single-writer HA controller. Node 22; no SDK, shell, AI or laptop.
// Runtime schema: plan.runtime = {bucket,stateObject,receiptPrefix,healthPrefix,
// uptimeCheckId,observerIds}; nodes have immutable instanceId and privateIp.
// Fencing also requires the standby agent's pinned externalReplaySafe receipt;
// a sleep or VM shutdown is never represented as upstream exactly-once proof.
// GCS state is provisioned out of band with initialControlState(); this daemon
// never silently creates missing state. Node-specific service accounts may only
// create receipts under their own prefix; only the controller may CAS state.
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {POLICY, PHASES, initialState, observe, beginFailover, advancePhase, armingBlockers} from './failover-policy.mjs';

const PROJECT = 'synk-bake-unmet27', REGION = 'asia-northeast3';
const META = 'http://169.254.169.254/computeMetadata/v1/'; // Official link-local metadata only.
const COMPUTE = 'https://compute.googleapis.com/compute/v1/';
const STORAGE = 'https://storage.googleapis.com/storage/v1/';
const UPLOAD = 'https://storage.googleapis.com/upload/storage/v1/';
const MONITORING = 'https://monitoring.googleapis.com/v3/';
const integer = n => Number.isSafeInteger(n) && n >= 0;
const numericId = value => typeof value === 'string' && /^[0-9]{1,32}$/.test(value);
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = code => {throw Object.assign(new Error(code), {code});};
const ensure = (condition, code) => {if (!condition) fail(code);};
const encoded = encodeURIComponent;
const fresh = (at, now, age) => integer(at) && at <= now && now-at <= age;
const resourcePath = node => `projects/${PROJECT}/zones/${node.zone}/instances/${node.name}`;
const resourceMatches = (url, path) => ['https://compute.googleapis.com/compute/v1/','https://www.googleapis.com/compute/v1/'].some(base => url === base+path);
const resourceName = value => typeof value==='string' && /^[a-z][a-z0-9-]{0,62}$/.test(value);
const groupPath = node => `projects/${PROJECT}/zones/${node.zone}/instanceGroups/${node.instanceGroupName}`;
// Cloud Monitoring descriptor: samplePeriod=60s, ingestDelay=240s. Allow one
// additional sample of delivery jitter; 240s alone rejects normal live data.
const REPLICA_MAX_AGE_MS=360_000;
const permitPrefix = 'company/ha-control/operator-permits/';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nodeById = (plan,id) => {const node=[plan.nodes.primary,plan.nodes.standby].find(n=>n.instanceId===id);ensure(node,'NODE_NOT_ALLOWLISTED');return node;};
const permitModes = ['planned-handover-drill','controlled-outage-drill','rearm-automatic-failover'];
const operatorKinds = ['operator-planned-handover','operator-controlled-outage'];
const permitPath = value => typeof value==='string' && value.startsWith(permitPrefix) && value.endsWith('.json') && uuid(value.slice(permitPrefix.length,-5));
function replicaAdverse(proof,now) {return (proof?.replicas??[]).some(r=>fresh(r.at,now,REPLICA_MAX_AGE_MS)&&(r.conflict||r.states?.CatchingUp===1||r.states?.OutOfSync===1||r.states?.Synced===0));}
function validReplicaProof(proof,plan,at,maxAge=REPLICA_MAX_AGE_MS) {
  const zones=[plan.nodes.primary.zone,plan.nodes.standby.zone];
  return proof?.healthy===true&&proof.diskId===plan.data.diskId&&Array.isArray(proof.replicas)&&proof.replicas.length===2&&new Set(proof.replicas.map(x=>x.zone)).size===2&&proof.replicas.every(x=>zones.includes(x.zone)&&fresh(x.at,at,maxAge)&&!x.conflict&&x.states?.Synced===1&&x.states?.CatchingUp!==1&&x.states?.OutOfSync!==1);
}
function acceptedReplica(proof,plan,now) {ensure(validReplicaProof(proof,plan,now),'REPLICA_NOT_FRESH_AND_SYNCED');return {diskId:plan.data.diskId,checkedAt:now,healthy:true,replicas:structuredClone(proof.replicas)};}

export function validateRuntime(plan) {
  ensure(plan?.schema === 'synk-ha-plan/v1' && plan.project === PROJECT && plan.region === REGION, 'PLAN_TARGET');
  ensure(plan.automaticFailback === false && plan.data?.singleWriter === true && plan.data?.replication === 'regional-pd-synchronous', 'PLAN_FENCING');
  ensure(plan.routing?.dropTrafficIfUnhealthy === true && plan.routing?.healthCheck?.port === 4192, 'PLAN_ROUTING');
  const ids = new Set();
  for (const role of ['primary','standby','controller']) {
    const n = plan.nodes?.[role];
    ensure(n && /^[a-z][a-z0-9-]{0,62}$/.test(n.name) && /^asia-northeast3-[abc]$/.test(n.zone) && numericId(n.instanceId), 'NODE_IDENTITY');
    ensure(!ids.has(n.instanceId), 'DUPLICATE_NODE'); ids.add(n.instanceId);
    if (role !== 'controller') ensure(/^10\.77\.0\.(?:[1-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-4])$/.test(n.privateIp), 'PRIVATE_PROBE_IP');
  }
  ensure(plan.nodes.primary.zone !== plan.nodes.standby.zone && plan.nodes.primary.privateIp !== plan.nodes.standby.privateIp, 'NODE_SEPARATION');
  ensure(numericId(plan.data.diskId) && /^[a-z][a-z0-9-]{0,62}$/.test(plan.data.name) && sha(plan.release?.manifestSha256), 'DATA_IDENTITY');
  const r = plan.runtime;
  ensure(r && /^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(r.bucket), 'STATE_BUCKET');
  for (const field of ['stateObject','receiptPrefix','healthPrefix']) ensure(typeof r[field] === 'string' && r[field].startsWith('company/ha-control/') && !r[field].includes('..') && !/[\u0000-\u0020?#\\]/.test(r[field]), 'STATE_PREFIX');
  ensure(r.stateObject.endsWith('.json') && r.receiptPrefix.endsWith('/') && r.healthPrefix.endsWith('/') && r.receiptPrefix !== r.healthPrefix, 'STATE_PREFIX');
  ensure(/^[A-Za-z0-9_-]{1,200}$/.test(r.uptimeCheckId) && Array.isArray(r.observerIds) && r.observerIds.length >= 2 && new Set(r.observerIds).size === r.observerIds.length && r.observerIds.every(x=>/^[A-Za-z0-9_-]{1,100}$/.test(x)), 'MONITORING_IDENTITY');
  ensure(r.operatorPermitObject===undefined || permitPath(r.operatorPermitObject),'OPERATOR_PERMIT_PATH');
  return plan;
}

export function initialControlState(plan, now = Date.now()) {
  validateRuntime(plan);
  return {schema:'synk-ha-control/v1',project:PROJECT,activeId:plan.nodes.primary.instanceId,activeEpoch:1,
    maintenanceUntil:0,bootAllowed:[plan.nodes.primary.instanceId],readyAllowed:[plan.nodes.primary.instanceId],
    operation:null,command:null,api:null,runner:null,lastReceipt:null,history:[],updatedAt:now};
}

export function validateControlState(state, plan) {
  ensure(state?.schema === 'synk-ha-control/v1' && state.project === PROJECT, 'CONTROL_SCHEMA');
  const known = [plan.nodes.primary.instanceId,plan.nodes.standby.instanceId];
  ensure(known.includes(state.activeId) && integer(state.activeEpoch) && state.activeEpoch >= 1 && integer(state.maintenanceUntil), 'CONTROL_IDENTITY');
  for (const key of ['bootAllowed','readyAllowed']) ensure(Array.isArray(state[key]) && state[key].length <= 1 && state[key].every(id=>known.includes(id)), 'CONTROL_OWNER');
  if (state.operation) {
    const o = state.operation;
    ensure(known.includes(o.from)&&known.includes(o.to)&&o.from!==o.to && o.diskId === plan.data.diskId && o.releaseSha256 === plan.release.manifestSha256 && uuid(o.operationId), 'OPERATION_IDENTITY');
    ensure(PHASES.includes(o.phase)&&integer(o.generation)&&o.generation>=1,'OPERATION_PHASE');
    if(operatorKinds.includes(o.kind)) {
      const a=o.operatorAuthorization,p=a?.permit;
      const mode=o.kind==='operator-controlled-outage'?'controlled-outage-drill':'planned-handover-drill';
      ensure(a&&permitPath(a.object)&&numericId(a.objectGeneration)&&sha(a.sha256)&&digest(p)===a.sha256&&p?.mode===mode&&p.from===o.from&&p.to===o.to&&p.diskId===o.diskId&&p.releaseSha256===o.releaseSha256&&p.expectedActiveEpoch+1===o.activeEpoch&&uuid(p.requestId)&&p.requestId===o.operationId&&a.object===permitPrefix+p.requestId+'.json','OPERATOR_AUTHORIZATION');
      if(o.kind==='operator-controlled-outage'){
        const proof=o.outageProof,s=proof?.state;
        ensure(o.from===plan.nodes.primary.instanceId&&o.to===plan.nodes.standby.instanceId&&proof?.schema==='synk-ha-controlled-outage/v1'&&proof.requiredFailureMs===POLICY.failureMs&&uuid(s?.bootId)&&s?.activeId===o.from&&integer(s?.sinceWall)&&integer(s?.sinceMono)&&integer(s?.lastWall)&&integer(s?.lastMono)&&s.lastWall-s.sinceWall>=POLICY.failureMs&&s.lastMono-s.sinceMono>=POLICY.failureMs&&s.sinceWall>=p.issuedAt&&integer(s.samples)&&s.samples>=2&&fresh(s.lastWall,o.preparedAt,POLICY.localFreshMs)&&integer(a.acceptedAt)&&a.acceptedAt>=p.issuedAt&&a.acceptedAt<p.expiresAt&&a.acceptedAt===o.preparedAt&&JSON.stringify(proof.observerIds)===JSON.stringify(plan.runtime.observerIds),'CONTROLLED_OUTAGE_PROOF');
        const sample=observe(initialState(),{bootId:s.bootId,monoMs:s.lastMono,wallMs:s.lastWall,local:proof.lastLocal,external:proof.lastExternal},{activeId:o.from,observerIds:proof.observerIds});
        ensure(sample.reason==='OBSERVING','CONTROLLED_OUTAGE_SAMPLE');
      }
    } else ensure(o.kind===undefined||o.kind==='automatic-failover','OPERATION_KIND');
    if(o.phase!=='COMPLETE')ensure(o.from===state.activeId&&(o.kind==='operator-planned-handover'||o.from===plan.nodes.primary.instanceId&&o.to===plan.nodes.standby.instanceId),'OPERATION_DIRECTION');
    ensure(o.activeEpoch === state.activeEpoch+1 || o.phase === 'COMPLETE' && o.activeEpoch === state.activeEpoch, 'OPERATION_EPOCH');
  }
  if (state.runner) ensure(uuid(state.runner.id) && integer(state.runner.until), 'RUNNER_IDENTITY');
  ensure(Array.isArray(state.history)&&state.history.length<=16,'OPERATION_HISTORY');
  return state;
}

async function boundedJson(response, maximum = 1_048_576) {
  ensure(Number(response.headers.get('content-length')||0) <= maximum, 'API_RESPONSE_TOO_LARGE');
  let bytes=0, parts=[];
  for await (const part of response.body ?? []) {bytes+=part.length;ensure(bytes<=maximum,'API_RESPONSE_TOO_LARGE');parts.push(part);}
  try {return JSON.parse(Buffer.concat(parts).toString('utf8'));} catch {fail('API_INVALID_JSON');}
}

export function createGoogleAdapter(plan, {fetchImpl=fetch, now=Date.now}={}) {
  validateRuntime(plan); let token=null, tokenUntil=0, metadataVerified=false;
  const r=plan.runtime;
  async function metadata(path) {
    const response=await fetchImpl(META+path,{headers:{'Metadata-Flavor':'Google'},redirect:'error',signal:AbortSignal.timeout(4000)});
    ensure(response.ok && response.headers.get('metadata-flavor')==='Google','METADATA_UNAVAILABLE');
    return response;
  }
  async function identity() {
    const [projectResponse,idResponse]=await Promise.all([metadata('project/project-id'),metadata('instance/id')]);
    ensure((await projectResponse.text()).trim()===PROJECT && (await idResponse.text()).trim()===plan.nodes.controller.instanceId,'CONTROLLER_IDENTITY');
    metadataVerified=true;
  }
  async function accessToken() {
    if(!metadataVerified) await identity();
    if(token && tokenUntil-now()>60_000)return token;
    const body=await boundedJson(await metadata('instance/service-accounts/default/token'),8192);
    ensure(typeof body.access_token==='string' && body.access_token.length<=8192 && body.token_type==='Bearer' && Number.isFinite(body.expires_in),'METADATA_TOKEN_INVALID');
    token=body.access_token;tokenUntil=now()+Math.min(body.expires_in,3600)*1000;return token;
  }
  async function request(url,{method='GET',body,expected=[200]}={}) {
    const parsed=new URL(url);
    ensure(parsed.protocol==='https:' && !parsed.username && !parsed.password && !parsed.hash && [COMPUTE,STORAGE,UPLOAD,MONITORING].some(base=>url.startsWith(base)),'API_HOST_REJECTED');
    const response=await fetchImpl(url,{method,headers:{Authorization:'Bearer '+await accessToken(),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});
    if(response.status===404||response.status===412)return {status:response.status};
    ensure(expected.includes(response.status),'GOOGLE_API_'+response.status);
    return {status:response.status,body:await boundedJson(response)};
  }
  async function readObject(name) {
    const url=STORAGE+`b/${encoded(r.bucket)}/o/${encoded(name)}`;
    const meta=await request(url); if(meta.status===404)return null;
    const generation=meta.body?.generation;ensure(numericId(generation),'GCS_GENERATION');
    const data=await request(url+'?alt=media&generation='+generation);ensure(data.status===200,'GCS_VERSION_MISSING');
    return {generation,value:data.body};
  }
  async function casState(value,generation) {
    ensure(numericId(String(generation)),'GCS_PRECONDITION_REQUIRED');
    const response=await request(UPLOAD+`b/${encoded(r.bucket)}/o?uploadType=media&name=${encoded(r.stateObject)}&ifGenerationMatch=${generation}`,{method:'POST',body:value});
    if(response.status===412)return null;
    ensure(response.status===200&&numericId(response.body?.generation),'GCS_WRITE_UNCONFIRMED');
    return {generation:response.body.generation,value};
  }
  async function getNode(node) {
    const response=await request(COMPUTE+resourcePath(node));ensure(response.status===200 && response.body.id===node.instanceId && response.body.name===node.name,'LIVE_NODE_CHANGED');
    ensure(response.body.networkInterfaces?.some(n=>n.name==='nic0'&&n.networkIP===node.privateIp),'LIVE_PRIVATE_IP_CHANGED');return response.body;
  }
  async function getDisk() {
    const response=await request(COMPUTE+`projects/${PROJECT}/regions/${REGION}/disks/${plan.data.name}`);
    ensure(response.status===200 && response.body.id===plan.data.diskId && response.body.name===plan.data.name,'LIVE_DISK_CHANGED');
    const zones=response.body.replicaZones?.map(x=>x.split('/').at(-1));
    ensure(zones?.length===2 && zones.includes(plan.nodes.primary.zone)&&zones.includes(plan.nodes.standby.zone),'REGIONAL_REPLICAS_CHANGED');
    ensure(response.body.status==='READY' && (response.body.users||[]).every(u=>[plan.nodes.primary,plan.nodes.standby].some(n=>resourceMatches(u,resourcePath(n)))),'REGIONAL_DISK_NOT_READY');return response.body;
  }
  async function probe(node,path='/ready') {
    ensure(['/ready','/status'].includes(path),'PROBE_PATH');
    try {
      const response=await fetchImpl(`http://${node.privateIp}:4192${path}`,{redirect:'error',signal:AbortSignal.timeout(4000),headers:{Accept:'application/json'}});
      const body=await boundedJson(response,16384);
      if(body.nodeId!==node.instanceId)return {nodeId:node.instanceId,status:'unknown',at:now(),alive:false};
      return {nodeId:node.instanceId,status:response.status===200&&body.ready===true?'healthy':'unhealthy',at:now(),alive:response.status===200&&body.alive===true,body};
    } catch(error) {
      // This is a NEW direct request failure, never merely an old heartbeat.
      if(['API_INVALID_JSON','API_RESPONSE_TOO_LARGE'].includes(error.code))return {nodeId:node.instanceId,status:'unknown',at:now(),alive:false};
      return {nodeId:node.instanceId,status:'unhealthy',at:now(),alive:false};
    }
  }
  async function monitoring() {
    const url=new URL(MONITORING+`projects/${PROJECT}/timeSeries`);
    url.searchParams.set('filter',`metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.labels.check_id="${r.uptimeCheckId}" AND resource.type="uptime_url"`);
    url.searchParams.set('interval.startTime',new Date(now()-180_000).toISOString());url.searchParams.set('interval.endTime',new Date(now()).toISOString());url.searchParams.set('view','FULL');url.searchParams.set('pageSize','10000');
    const seriesList=await timeSeriesPages(url,'MONITORING_TRUNCATED');
    const votes=new Map();
    for(const series of seriesList) {
      const id=series.metric?.labels?.checker_location;
      if(!r.observerIds.includes(id))continue;
      if(series.metric?.labels?.check_id!==r.uptimeCheckId || series.resource?.labels?.host!=='workspace.synk.im')continue;
      for(const point of series.points||[]) {
        const at=Date.parse(point.interval?.endTime), value=point.value?.boolValue;
        if(!Number.isSafeInteger(at)||typeof value!=='boolean')continue;
        const prior=votes.get(id);if(!prior||at>prior.at)votes.set(id,{id,at,status:value?'healthy':'unhealthy'});
        else if(at===prior.at&&prior.status!==(value?'healthy':'unhealthy'))votes.set(id,{id,at,status:'unknown'});
      }
    }
    return r.observerIds.map(id=>votes.get(id)??{id,at:now(),status:'unknown'});
  }
  async function timeSeriesPages(url,code) {
    const result=[],seen=new Set();let totalBytes=0;
    for(let page=0;page<5;page++) {
      const response=await request(url.href);
      // A newly introduced metric may not have a descriptor/series yet. Missing
      // evidence remains unknown; it must never become Synced or trigger a stop.
      if(response.status===404)return [];
      const rows=response.body.timeSeries??[];
      ensure(Array.isArray(rows),'MONITORING_SHAPE');totalBytes+=Buffer.byteLength(JSON.stringify(rows));ensure(totalBytes<=4_194_304,code);result.push(...rows);
      const token=response.body.nextPageToken;if(!token)return result;
      ensure(typeof token==='string'&&token.length<=4096&&!seen.has(token),code);seen.add(token);url.searchParams.set('pageToken',token);
    }
    fail(code);
  }
  async function replicaHealth() {
    const url=new URL(MONITORING+`projects/${PROJECT}/timeSeries`);
    url.searchParams.set('filter',`metric.type="compute.googleapis.com/disk/regional/replica_state" AND resource.type="gce_disk" AND resource.labels.disk_id="${plan.data.diskId}"`);
    url.searchParams.set('interval.startTime',new Date(now()-420_000).toISOString());url.searchParams.set('interval.endTime',new Date(now()).toISOString());url.searchParams.set('view','FULL');url.searchParams.set('pageSize','10000');
    const seriesList=await timeSeriesPages(url,'REPLICA_METRICS_TRUNCATED');
    const latest=new Map(),zones=[plan.nodes.primary.zone,plan.nodes.standby.zone];
    for(const series of seriesList) {
      if(series.resource?.type!=='gce_disk'||series.resource?.labels?.disk_id!==plan.data.diskId)continue;
      const zone=series.metric?.labels?.replica_zone,state=series.metric?.labels?.state;
      if(!zones.includes(zone)||!['Synced','CatchingUp','OutOfSync'].includes(state))continue;
      for(const point of series.points||[]) {
        const at=Date.parse(point.interval?.endTime),value=Number(point.value?.int64Value??point.value?.doubleValue);
        if(!integer(at)||![0,1].includes(value))continue;
        const prior=latest.get(zone);
        if(!prior||at>prior.at)latest.set(zone,{at,states:{[state]:value}});
        else if(at===prior.at){if(Object.hasOwn(prior.states,state)&&prior.states[state]!==value)prior.conflict=true;prior.states[state]=value;}
      }
    }
    const replicas=zones.map(zone=>({zone,...(latest.get(zone)??{at:0,states:{}})}));
    return {diskId:plan.data.diskId,replicas,healthy:replicas.every(x=>fresh(x.at,now(),REPLICA_MAX_AGE_MS)&&!x.conflict&&x.states.Synced===1&&x.states.CatchingUp!==1&&x.states.OutOfSync!==1)};
  }
  async function routingEvidence(operation) {
    const route=plan.routing,old=nodeById(plan,operation.from),target=nodeById(plan,operation.to);
    ensure(old!==target && ['backendServiceName','forwardingRuleName','healthCheckName'].every(k=>resourceName(route[k]))
      && [old,target].every(n=>resourceName(n.instanceGroupName)), 'ROUTING_IDENTITIES_REQUIRED');
    const prefix=`projects/${PROJECT}/regions/${REGION}/`,backendPath=prefix+'backendServices/'+route.backendServiceName,
      forwardingPath=prefix+'forwardingRules/'+route.forwardingRuleName,healthPath=prefix+'healthChecks/'+route.healthCheckName;
    const [backendReply,forwardingReply,healthReply,oldVm,targetVm]=await Promise.all([
      request(COMPUTE+backendPath),request(COMPUTE+forwardingPath),request(COMPUTE+healthPath),getNode(old),getNode(target)]);
    const backend=backendReply.body,forwarding=forwardingReply.body,hc=healthReply.body;
    ensure(backendReply.status===200&&backend?.name===route.backendServiceName&&resourceMatches(backend.selfLink,backendPath)
      && backend.loadBalancingScheme==='EXTERNAL'&&backend.protocol==='TCP', 'BACKEND_SERVICE_CHANGED');
    ensure(backend.failoverPolicy?.dropTrafficIfUnhealthy===true&&backend.failoverPolicy?.disableConnectionDrainOnFailover===true
      && backend.failoverPolicy?.failoverRatio===1, 'BACKEND_FAILOVER_POLICY_CHANGED');
    ensure(Array.isArray(backend.backends)&&backend.backends.length===2&&[plan.nodes.primary,plan.nodes.standby].every(n=>{
      const rows=backend.backends.filter(b=>resourceMatches(b.group,groupPath(n)));
      return rows.length===1&&(rows[0].failover===true)===(n.instanceId===plan.nodes.standby.instanceId);
    }), 'BACKEND_GROUPS_CHANGED');
    ensure(Array.isArray(backend.healthChecks)&&backend.healthChecks.length===1&&resourceMatches(backend.healthChecks[0],healthPath)
      && healthReply.status===200&&hc?.name===route.healthCheckName&&resourceMatches(hc.selfLink,healthPath)
      && hc.type==='HTTP'&&hc.httpHealthCheck?.port===4192&&hc.httpHealthCheck?.requestPath==='/ready'
      && [undefined,'USE_FIXED_PORT'].includes(hc.httpHealthCheck?.portSpecification)
      && hc.checkIntervalSec===route.healthCheck.intervalSeconds&&hc.timeoutSec===route.healthCheck.timeoutSeconds
      && hc.healthyThreshold===route.healthCheck.healthyThreshold&&hc.unhealthyThreshold===route.healthCheck.unhealthyThreshold,
    'BACKEND_HEALTH_CHECK_CHANGED');
    ensure(forwardingReply.status===200&&forwarding?.name===route.forwardingRuleName&&resourceMatches(forwarding.selfLink,forwardingPath)
      && resourceMatches(forwarding.backendService,backendPath)&&forwarding.loadBalancingScheme==='EXTERNAL'
      && forwarding.IPProtocol==='TCP'&&forwarding.IPAddress===route.existingAddress&&forwarding.networkTier==='PREMIUM'
      && forwarding.allPorts!==true&&!forwarding.portRange&&!forwarding.target&&!forwarding.sourceIpRanges?.length
      && Array.isArray(forwarding.ports)&&forwarding.ports.length===2&&['80','443'].every(p=>forwarding.ports.includes(p)),
    'FORWARDING_RULE_CHANGED');
    ensure(oldVm.status==='TERMINATED'&&targetVm.status==='RUNNING','ROUTING_VM_STATE_CHANGED');
    // getHealth is an official read-only API using POST. Node receipts cannot
    // assert LB membership or health: only these authenticated provider reads do.
    const results=await Promise.all([old,target].map(async node=>{
      const response=await request(COMPUTE+backendPath+'/getHealth',{method:'POST',body:{group:COMPUTE+groupPath(node)}});
      ensure(response.status===200&&response.body&&typeof response.body==='object'
        && (response.body.healthStatus===undefined||Array.isArray(response.body.healthStatus)),'BACKEND_HEALTH_UNKNOWN');
      const rows=response.body.healthStatus??[];
      ensure(rows.length<=1&&rows.every(x=>resourceMatches(x.instance,resourcePath(node))&&['HEALTHY','UNHEALTHY'].includes(x.healthState)), 'BACKEND_HEALTH_IDENTITY');
      // A stopped VM can be absent from the health response. Its immutable GCE
      // identity and TERMINATED state were verified above; an empty target never passes.
      return rows[0]?.healthState??'ABSENT';
    }));
    ensure(results[0]!=='HEALTHY'&&results[1]==='HEALTHY','BACKEND_NOT_SWITCHED');
    return {healthyBackend:target.instanceId,oldBackendReady:false,routingVerifiedAt:now(),
      backendService:route.backendServiceName,forwardingRule:route.forwardingRuleName};
  }
  async function gceMutation(kind,requestId,direction={from:plan.nodes.primary.instanceId,to:plan.nodes.standby.instanceId}) {
    ensure(uuid(requestId)&&['stop','attach'].includes(kind),'MUTATION_INTENT');
    const from=nodeById(plan,direction.from),to=nodeById(plan,direction.to);ensure(from!==to,'MUTATION_DIRECTION');
    const old=await getNode(from), standby=await getNode(to);await getDisk();
    const node=kind==='stop'?from:to;
    if(kind==='attach')ensure(old.status==='TERMINATED'&&standby.status==='RUNNING','OLD_WRITER_NOT_STOPPED');
    return request(COMPUTE+resourcePath(node)+(kind==='stop'?'/stop':'/attachDisk')+`?requestId=${requestId}`+(kind==='attach'?'&forceAttach=true':''),{method:'POST',body:kind==='stop'?{}:{source:COMPUTE+`projects/${PROJECT}/regions/${REGION}/disks/${plan.data.name}`,deviceName:plan.data.name,type:'PERSISTENT',mode:'READ_WRITE',boot:false,autoDelete:false}});
  }
  async function reconcileOperation(intent) {
    ensure(uuid(intent.requestId)&&['stop','attach'].includes(intent.kind),'MUTATION_INTENT');
    const node=nodeById(plan,intent.kind==='stop'?(intent.from??plan.nodes.primary.instanceId):(intent.to??plan.nodes.standby.instanceId));
    const base=COMPUTE+`projects/${PROJECT}/zones/${node.zone}/operations`;
    let result;
    if(intent.providerName){ensure(/^[A-Za-z0-9_-]{1,200}$/.test(intent.providerName),'OPERATION_NAME');const response=await request(base+'/'+intent.providerName);if(response.status===404)return null;result=response.body;}
    else {const url=new URL(base);url.searchParams.set('filter',`clientOperationId = "${intent.requestId}"`);url.searchParams.set('maxResults','10');const response=await request(url.href);ensure(!response.body.nextPageToken,'OPERATION_LOOKUP_TRUNCATED');const matches=(response.body.items||[]).filter(x=>x.clientOperationId===intent.requestId);ensure(matches.length<=1,'OPERATION_AMBIGUOUS');result=matches[0];}
    if(!result)return null;
    ensure(result.clientOperationId===intent.requestId && resourceMatches(result.targetLink,resourcePath(node)) && result.targetId===node.instanceId,'PROVIDER_OPERATION_IDENTITY');
    return {name:result.name,status:result.status,error:Boolean(result.error)};
  }
  return {identity,readState:()=>readObject(r.stateObject),casState,getNode,getDisk,probe,monitoring,replicaHealth,routingEvidence,
    readOperatorPermit:()=>r.operatorPermitObject?readObject(r.operatorPermitObject):Promise.resolve(null),
    readHealth:id=>readObject(r.healthPrefix+id+'.json'),
    readReceipt:command=>readObject(`${r.receiptPrefix}${command.to}/${command.operationId}/${command.generation}.json`),
    gceMutation,reconcileOperation};
}

function phaseCommand(operation,now) {
  return {schema:'synk-ha-command/v1',operationId:operation.operationId,phase:operation.phase,generation:operation.generation,
    from:operation.from,to:operation.to,diskId:operation.diskId,releaseSha256:operation.releaseSha256,
    activeEpoch:operation.activeEpoch,nonce:randomUUID(),issuedAt:now};
}
function baseReceipt(operation,at) {return {operationId:operation.operationId,phase:operation.phase,generation:operation.generation,from:operation.from,to:operation.to,at,status:'DONE'};}

export function validateOperatorPermit(record,permitRecord,plan,now) {
  const p=permitRecord?.value;
  ensure(plan.armed===false&&permitPath(plan.runtime.operatorPermitObject),'PLANNED_REQUIRES_DISARMED');
  ensure(p?.schema==='synk-ha-operator-permit/v1'&&permitModes.includes(p.mode)&&uuid(p.requestId)&&numericId(permitRecord.generation),'OPERATOR_PERMIT_SCHEMA');
  ensure(plan.runtime.operatorPermitObject===permitPrefix+p.requestId+'.json','OPERATOR_PERMIT_OBJECT');
  ensure(integer(p.issuedAt)&&integer(p.expiresAt)&&p.issuedAt<=now&&p.expiresAt>now&&p.expiresAt-p.issuedAt<=600_000,'OPERATOR_PERMIT_EXPIRED');
  ensure(p.expectedStateGeneration===record.generation&&p.expectedActiveEpoch===record.value.activeEpoch&&p.from===record.value.activeId&&p.from!==p.to,'OPERATOR_STATE_CHANGED');
  nodeById(plan,p.from);nodeById(plan,p.to);
  ensure(p.diskId===plan.data.diskId&&p.releaseSha256===plan.release.manifestSha256,'OPERATOR_PERMIT_TARGET');
  return {object:plan.runtime.operatorPermitObject,objectGeneration:permitRecord.generation,sha256:digest(p),permit:p,acceptedAt:now};
}

export function createController({plan,acceptance={},adapter,now=Date.now,monotonic=()=>Math.floor(performance.now()),bootId=randomUUID(),log=()=>{}}) {
  validateRuntime(plan);ensure(uuid(bootId),'BOOT_ID');let observations=initialState(),lastSynced=null,busy=false,observationPermit=null;
  const a=adapter??createGoogleAdapter(plan,{now});
  const emit=(code,details={})=>log({event:'SYNK_HA',code,...details}); // only enumerated, nonsecret fields
  async function save(record,value) {
    value.updatedAt=now();const result=await a.casState(value,record.generation);if(!result)fail('CAS_CONFLICT');return result;
  }
  async function acquire(record) {
    const s=record.value;
    if(s.runner && s.runner.id!==bootId && s.runner.until>now())return null;
    return save(record,{...s,runner:{id:bootId,until:now()+60_000}});
  }
  async function stillOwn(record) {
    const current=await a.readState();ensure(current&&current.generation===record.generation&&current.value.runner?.id===bootId&&current.value.runner.until>now(),'CAS_OWNERSHIP_LOST');
  }
  async function advance(record,receipt) {
    const s=record.value,result=advancePhase(s.operation,receipt,now());
    if(result.decision==='HOLD')return {code:result.reason};
    // Keep completed provider UUID/name and phase proof in the same CAS object;
    // final success must not erase the only durable stop/attach evidence.
    const next={...s,operation:result.state,command:null,api:null,lastReceipt:receipt,
      history:[...s.history,{at:now(),phase:s.operation.phase,receipt,api:s.api}]};
    if(result.state.phase==='COMPLETE'){next.activeId=result.state.to;next.activeEpoch=result.state.activeEpoch;next.bootAllowed=[result.state.to];next.readyAllowed=[result.state.to];next.completedAt=now();}
    return {code:result.decision,record:await save(record,next)};
  }
  async function ensureApi(record,kind) {
    let s=record.value;
    if(!s.api){record=await save(record,{...s,api:{kind,from:s.operation.from,to:s.operation.to,requestId:randomUUID(),createdAt:now(),providerName:null,lastDispatchAt:null,doneAt:null}});s=record.value;}
    ensure(s.api.kind===kind&&uuid(s.api.requestId),'API_INTENT_CHANGED');
    const result=await a.reconcileOperation(s.api);
    if(result){
      if(result.error)return {record,done:false,code:'PROVIDER_OPERATION_FAILED'};
      if(s.api.providerName!==result.name||result.status==='DONE'&&!s.api.doneAt){record=await save(record,{...s,api:{...s.api,providerName:result.name,...(result.status==='DONE'?{doneAt:now()}:{} )}});}
      return {record,done:result.status==='DONE',code:result.status==='DONE'?'API_DONE':'API_PENDING'};
    }
    // Same request UUID is the ONLY possible retry. Provider lookup precedes it.
    if(s.api.providerName)return {record,done:false,code:'PROVIDER_OPERATION_MISSING'};
    if(s.api.lastDispatchAt&&now()-s.api.lastDispatchAt<30_000)return {record,done:false,code:'API_OUTCOME_UNKNOWN'};
    if(now()-s.api.createdAt>86_400_000)return {record,done:false,code:'API_REQUEST_REQUIRES_RECONCILIATION'};
    record=await save(record,{...s,api:{...s.api,lastDispatchAt:now()}});
    await stillOwn(record);
    const reply=await a.gceMutation(kind,record.value.api.requestId,record.value.operation);
    if(reply?.body?.name) {
      ensure(/^[A-Za-z0-9_-]{1,200}$/.test(reply.body.name),'PROVIDER_OPERATION_NAME');
      record=await save(record,{...record.value,api:{...record.value.api,providerName:reply.body.name}});
    }
    return {record,done:false,code:'API_DISPATCHED'};
  }
  async function commandReceipt(record) {
    const s=record.value,o=s.operation;
    if(!s.command){
      const next={...s,command:phaseCommand(o,now())};
      if(o.phase==='START_CANDIDATE')next.bootAllowed=[o.to];
      if(o.phase==='EXPOSE_CANDIDATE')next.readyAllowed=[o.to];
      await save(record,next);return {code:'NODE_COMMAND_PERSISTED'};
    }
    ensure(s.command.operationId===o.operationId&&s.command.phase===o.phase&&s.command.generation===o.generation,'COMMAND_CHANGED');
    const response=await a.readReceipt(s.command);
    if(!response)return {code:'WAIT_NODE_RECEIPT'};
    const receipt=response.value;
    ensure(receipt.schema==='synk-ha-receipt/v1'&&receipt.nodeId===o.to&&receipt.nonce===s.command.nonce&&receipt.diskId===o.diskId&&receipt.releaseSha256===o.releaseSha256&&receipt.activeEpoch===o.activeEpoch,'NODE_RECEIPT_IDENTITY');
    ensure(integer(receipt.at)&&receipt.at>=s.command.issuedAt&&receipt.at<=now(),'NODE_RECEIPT_TIME');
    if(!fresh(receipt.at,now(),POLICY.localFreshMs)) {
      // Immutable receipts cannot be rewritten. Ask the agent to revalidate the
      // SAME phase with a new generation/nonce; never relabel old proof as fresh.
      const refreshed={...o,generation:o.generation+1,phaseStartedAt:now()};
      await save(record,{...s,operation:refreshed,command:phaseCommand(refreshed,now())});
      return {code:'STALE_RECEIPT_REVALIDATION_REQUESTED'};
    }
    const status=await a.probe(nodeById(plan,o.to),'/status');
    if(!status.alive||status.body?.releaseSha256!==o.releaseSha256||o.phase!=='FENCE_OLD_WRITER'&&status.body?.activeEpoch!==o.activeEpoch)return {code:'NODE_RECEIPT_LIVE_CHECK_FAILED'};
    if(o.phase==='EXPOSE_CANDIDATE') {
      ensure(typeof a.routingEvidence==='function','ROUTING_ADAPTER_REQUIRED');
      const routing=await a.routingEvidence(o);
      ensure(routing?.healthyBackend===o.to&&routing.oldBackendReady===false&&fresh(routing.routingVerifiedAt,now(),POLICY.localFreshMs),'ROUTING_EVIDENCE_REQUIRED');
      return {receipt:{...receipt,...routing}};
    }
    return {receipt};
  }
  async function stepOperation(record) {
    let s=record.value,o=s.operation;
    if(o.phase==='COMPLETE')return {code:'FAILOVER_COMPLETE_NO_FAILBACK'};
    const oldNode=nodeById(plan,o.from),targetNode=nodeById(plan,o.to);
    const old=await a.getNode(oldNode),target=await a.getNode(targetNode),disk=await a.getDisk();
    if(target.status!=='RUNNING')return {code:'STANDBY_NOT_RUNNING'};
    const currentReplica=await a.replicaHealth();
    if(!currentReplica.healthy){
      // Stopping a VM also stops these Monitoring series. The durable operation
      // may continue from its bounded pre-outage proof through attachment, but
      // a new adverse sample or a ten-minute stalled handover always holds.
      if(replicaAdverse(currentReplica,now())||!integer(o.preparedAt)||now()-o.preparedAt>600_000||!validReplicaProof(o.replicaProof,plan,o.preparedAt,REPLICA_MAX_AGE_MS+POLICY.failureMs)||['VERIFY_CANDIDATE','EXPOSE_CANDIDATE'].includes(o.phase))return {code:'REPLICA_NOT_FRESH_AND_SYNCED'};
    }
    if(o.phase==='FENCE_OLD_WRITER') {
      if(old.status!=='TERMINATED'||s.api){
        const api=await ensureApi(record,'stop');record=api.record;s=record.value;
        if(!api.done||old.status!=='TERMINATED')return {code:api.code};
      }
      ensure(s.bootAllowed.length===0&&s.readyAllowed.length===0,'OLD_GATE_NOT_REVOKED');
      const proof=await commandReceipt(record);if(!proof.receipt)return proof;
      return advance(record,{...proof.receipt,oldVmStopped:true,bootGateRevoked:true,oldRoutingDisabled:true});
    }
    if(old.status!=='TERMINATED')return {code:'OLD_WRITER_RETURNED'};
    if(o.phase==='ATTACH_REGIONAL_DISK') {
      const api=await ensureApi(record,'attach');record=api.record;
      if(!api.done)return {code:api.code};
      const owner=await a.getNode(targetNode),latestDisk=await a.getDisk();
      const path=`projects/${PROJECT}/regions/${REGION}/disks/${plan.data.name}`;
      const matches=(owner.disks||[]).filter(d=>resourceMatches(d.source,path));
      if(matches.length!==1||matches[0].mode!=='READ_WRITE'||matches[0].boot||matches[0].autoDelete)return {code:'ATTACH_NOT_ACCEPTED'};
      // A stopped prior VM may remain in users after forceAttach; its process is
      // independently fenced. Never infer ownership merely from a path string.
      if(!(latestDisk.users||[]).some(u=>resourceMatches(u,resourcePath(targetNode))))return {code:'DISK_OWNER_NOT_CONFIRMED'};
      return advance(record,{...baseReceipt(o,now()),diskId:o.diskId,forceAttachOperationDone:true,storageFenceVerified:true,writableOwner:o.to});
    }
    const proof=await commandReceipt(record);if(!proof.receipt)return proof;
    return advance(record,proof.receipt);
  }
  // Automatic and explicitly permitted outage drills share the exact same live
  // observations, freshness/quorum, replica retention and monotonic 180s policy.
  async function observeOutage(record) {
    const primary=await a.getNode(plan.nodes.primary),standby=await a.getNode(plan.nodes.standby);await a.getDisk();
    const replicas=await a.replicaHealth();
    if(replicas.healthy)lastSynced=acceptedReplica(replicas,plan,now());
    else if(replicaAdverse(replicas,now())||observations.sinceWall===null||!validReplicaProof(lastSynced,plan,now(),REPLICA_MAX_AGE_MS+POLICY.failureMs)){
      lastSynced=null;observations=initialState();return {code:'REPLICA_NOT_FRESH_AND_SYNCED'};
    }
    const [local,external,targetHealth,heartbeat]=await Promise.all([
      a.probe(plan.nodes.primary,'/ready'),a.monitoring(),a.probe(plan.nodes.standby,'/status'),a.readHealth(plan.nodes.primary.instanceId)]);
    let effective=local;
    const h=heartbeat?.value;
    if(h?.schema==='synk-ha-health/v1'&&h.nodeId===plan.nodes.primary.instanceId&&h.releaseSha256===plan.release.manifestSha256&&h.activeEpoch===record.value.activeEpoch&&h.status==='healthy'&&h.alive===true&&h.ready===true&&h.activationAllowed===true&&h.guardsAccepted===true&&h.stopFailed===false&&fresh(h.at,now(),POLICY.localFreshMs))effective={nodeId:plan.nodes.primary.instanceId,status:'healthy',at:now()};
    if(standby.status!=='RUNNING'||!targetHealth.alive||!targetHealth.body?.activationAllowed||!targetHealth.body?.guardsAccepted
        ||targetHealth.body?.releaseSha256!==plan.release.manifestSha256){observations=initialState();return {code:'STANDBY_AGENT_UNAVAILABLE'};}
    const observation={bootId,monoMs:monotonic(),wallMs:now(),local:effective,external};
    const outcome=observe(observations,observation,{activeId:primary.id,observerIds:plan.runtime.observerIds,maintenanceUntil:record.value.maintenanceUntil});observations=outcome.state;
    if(outcome.decision!=='CONFIRMED_OUTAGE')return {code:outcome.reason};
    return {outcome,primary,standby,replicaProof:lastSynced,observation};
  }
  async function operatorRequest(record) {
    if(!plan.runtime.operatorPermitObject||!a.readOperatorPermit)return null;
    const permitRecord=await a.readOperatorPermit();if(!permitRecord)return null;
    const p=permitRecord.value;
    if(record.value.operation?.operatorAuthorization?.permit?.requestId===p?.requestId||record.value.lastRearm?.permit?.requestId===p?.requestId)return null;
    const authorization=validateOperatorPermit(record,permitRecord,plan,now());
    // Every new operator state transition has a START deadline. Reads can
    // outlive it; a permit may also be removed/replaced while probes run.
    async function finalAuthorization() {
      const latest=await a.readOperatorPermit();
      ensure(latest&&latest.generation===permitRecord.generation&&digest(latest.value)===authorization.sha256,'OPERATOR_PERMIT_CHANGED');
      return validateOperatorPermit(record,latest,plan,now());
    }
    const drill=['planned-handover-drill','controlled-outage-drill'].includes(p.mode);
    const skip=new Set(['DISARMED',...(drill?['actualFailoverDrillPassed']:[])]);
    const blockers=armingBlockers(plan,acceptance).filter(x=>!skip.has(x));
    if(blockers.length){observations=initialState();return {code:'OPERATOR_PREPARATION_INCOMPLETE',blockers};}
    if(p.mode==='rearm-automatic-failover') {
      ensure(record.value.operation?.phase==='COMPLETE'&&p.from===plan.nodes.primary.instanceId&&p.to===plan.nodes.standby.instanceId,'REARM_DIRECTION_NOT_PREPARED');
      ensure((await a.replicaHealth()).healthy,'REPLICA_NOT_FRESH_AND_SYNCED');
      const target=await a.probe(plan.nodes.standby,'/status');
      ensure(target.alive&&target.body?.activationAllowed&&target.body?.guardsAccepted&&target.body?.releaseSha256===plan.release.manifestSha256,'REARM_STANDBY_NOT_ACCEPTED');
      const accepted=await finalAuthorization();
      await save(record,{...record.value,lastCompletedOperation:record.value.operation,lastCompletedHistory:record.value.history,operation:null,command:null,api:null,history:[],runner:null,lastRearm:accepted});
      return {code:'REARM_PREPARED_STILL_DISARMED'};
    }
    ensure(!record.value.operation||record.value.operation.phase==='COMPLETE','OPERATION_ALREADY_ACTIVE');
    if(p.mode==='controlled-outage-drill'){
      ensure(p.from===plan.nodes.primary.instanceId&&p.to===plan.nodes.standby.instanceId,'CONTROLLED_DRILL_DIRECTION');
      const identity=digest({object:authorization.object,generation:authorization.objectGeneration,sha256:authorization.sha256,stateGeneration:record.generation});
      if(observationPermit!==identity){observations=initialState();lastSynced=null;observationPermit=identity;}
      const observed=await observeOutage(record);if(!observed.outcome)return observed;
      // Expiry is a START limit, rechecked after potentially slow observations.
      // The accepted durable operation can subsequently finish its fenced work.
      const accepted=await finalAuthorization();
      const operation={version:1,kind:'operator-controlled-outage',operationId:p.requestId,from:p.from,to:p.to,diskId:p.diskId,releaseSha256:p.releaseSha256,phase:PHASES[0],phaseStartedAt:now(),preparedAt:accepted.acceptedAt,generation:1,activeEpoch:record.value.activeEpoch+1,operatorAuthorization:accepted,replicaProof:observed.replicaProof,
        outageProof:{schema:'synk-ha-controlled-outage/v1',requiredFailureMs:POLICY.failureMs,state:structuredClone(observed.outcome.state),observerIds:[...plan.runtime.observerIds],lastLocal:{nodeId:observed.observation.local.nodeId,status:observed.observation.local.status,at:observed.observation.local.at},lastExternal:observed.observation.external.map(({id,status,at})=>({id,status,at}))}};
      const next={...record.value,operation,command:null,api:null,history:[],bootAllowed:[],readyAllowed:[],runner:{id:bootId,until:now()+60_000}};
      validateControlState(next,plan);await save(record,next);observations=initialState();emit('CONTROLLED_OUTAGE_CONFIRMED',{operationId:p.requestId});return {code:'OPERATOR_OUTAGE_PERSISTED'};
    }
    observationPermit=null;observations=initialState();
    const from=nodeById(plan,p.from),to=nodeById(plan,p.to);
    const [old,target,status,replicas]=await Promise.all([a.getNode(from),a.getNode(to),a.probe(to,'/status'),a.replicaHealth()]);await a.getDisk();
    ensure(old.status==='RUNNING'&&target.status==='RUNNING'&&status.alive&&status.body?.activationAllowed&&status.body?.guardsAccepted&&status.body?.releaseSha256===plan.release.manifestSha256,'PLANNED_NODES_NOT_ACCEPTED');
    const accepted=await finalAuthorization(),replicaProof=acceptedReplica(replicas,plan,now());
    const operation={version:1,kind:'operator-planned-handover',operationId:p.requestId,from:p.from,to:p.to,diskId:p.diskId,releaseSha256:p.releaseSha256,phase:PHASES[0],phaseStartedAt:now(),preparedAt:accepted.acceptedAt,generation:1,activeEpoch:record.value.activeEpoch+1,operatorAuthorization:accepted,replicaProof};
    await save(record,{...record.value,operation,command:null,api:null,history:[],bootAllowed:[],readyAllowed:[],runner:{id:bootId,until:now()+60_000}});
    observations=initialState();return {code:'OPERATOR_HANDOVER_PERSISTED'};
  }
  async function tick() {
    if(busy)return {code:'LOCAL_TICK_BUSY'};busy=true;
    try {
      const record=await a.readState();
      if(record){
        validateControlState(record.value,plan);
        // Accepted operator intent is pinned by immutable object generation and
        // digest. Its ten-minute START window does not strand a fenced operation.
        if(operatorKinds.includes(record.value.operation?.kind)&&record.value.operation.phase!=='COMPLETE'){
          const owned=await acquire(record);return owned?await stepOperation(owned):{code:'OTHER_CONTROLLER'};
        }
        const requested=await operatorRequest(record);if(requested)return requested;
      }
      if(observationPermit!==null){observations=initialState();lastSynced=null;observationPermit=null;}
      // The checked-in plan is deliberately false; no cloud mutation is possible
      // merely by invoking this file. Accepted, provisioned state is also needed.
      const blockers=armingBlockers(plan,acceptance);
      if(blockers.length){
        observations=initialState();
        // Real read-only warm-up while disarmed, so operator acceptance can
        // inspect actual probe/Monitoring/replication evidence before arming.
        const [local,external,standby,replicas]=await Promise.all([a.probe(plan.nodes.primary,'/ready'),a.monitoring(),a.probe(plan.nodes.standby,'/status'),a.replicaHealth()]);
        return {code:'DISARMED',blockers,observed:{at:now(),local:local.status,standbyAlive:standby.alive,external,replicas}};
      }
      if(!record){observations=initialState();return {code:'CONTROL_STATE_MISSING'};}
      validateControlState(record.value,plan);
      if(record.value.operation?.phase==='COMPLETE')return {code:'FAILOVER_COMPLETE_NO_FAILBACK'};
      if(record.value.operation){const owned=await acquire(record);return owned?await stepOperation(owned):{code:'OTHER_CONTROLLER'};}
      if(record.value.activeId!==plan.nodes.primary.instanceId)return {code:'NO_AUTOMATIC_FAILBACK'};
      const observed=await observeOutage(record);if(!observed.outcome)return observed;
      const {outcome,primary,standby}=observed;
      const prepared=beginFailover({plan,acceptance,outage:outcome,from:primary.id,to:standby.id,operationId:randomUUID(),diskId:plan.data.diskId,releaseSha256:plan.release.manifestSha256,activeEpoch:record.value.activeEpoch+1,now:now()});
      if(prepared.decision!=='PREPARED')return {code:'ARMING_BLOCKED',blockers:prepared.blockers};
      const next={...record.value,operation:{...prepared.state,kind:'automatic-failover',preparedAt:now(),replicaProof:observed.replicaProof},command:null,api:null,history:[],bootAllowed:[],readyAllowed:[],runner:{id:bootId,until:now()+60_000}};
      await save(record,next);observations=initialState();emit('OUTAGE_CONFIRMED',{operationId:prepared.state.operationId});return {code:'OPERATION_PERSISTED'};
    }catch(error){observations=initialState();const code=/^[A-Z0-9_]{1,100}$/.test(error.code||'')?error.code:'CONTROLLER_UNCERTAIN';
      const diagnostics=code==='CONTROLLER_UNCERTAIN'?{errorType:/^[A-Za-z]{1,40}$/.test(error.name||'')?error.name:'Error',causeCode:/^[A-Z0-9_]{1,60}$/.test(error.cause?.code||'')?error.cause.code:null}:{};
      emit(code,diagnostics);return {code};}
    finally {busy=false;}
  }
  return {tick};
}

export async function runDaemon({plan,acceptance,signal,log=value=>console.log(JSON.stringify(value)),adapter}) {
  ensure(process.platform==='linux'&&Number(process.versions.node.split('.')[0])>=22,'LINUX_NODE22_REQUIRED');
  const controller=createController({plan,acceptance,adapter,log});let prior=null,lastEvidence=0;
  while(!signal?.aborted){const started=Date.now(),result=await controller.tick();if(result.code!==prior){log({event:'SYNK_HA_STATUS',code:result.code});prior=result.code;}
    // Bounded cloud journal evidence for pre-arm acceptance, without normal GCS
    // writes or account/document content. Values originate from fixed probes.
    if(result.observed&&Date.now()-lastEvidence>=60_000){log({event:'SYNK_HA_OBSERVATION',...result.observed});lastEvidence=Date.now();}
    await new Promise(resolve=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,Math.max(0,POLICY.pollMs-(Date.now()-started)));signal?.addEventListener('abort',done,{once:true});if(signal?.aborted)done();});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2),planPath=args[0],acceptancePath=args[1];
  try {ensure(planPath&&acceptancePath&&args.length===2,'PLAN_AND_ACCEPTANCE_FILES_REQUIRED');const plan=JSON.parse(await readFile(planPath,'utf8')),acceptance=JSON.parse(await readFile(acceptancePath,'utf8'));const abort=new AbortController();for(const s of ['SIGTERM','SIGINT'])process.once(s,()=>abort.abort());await runDaemon({plan,acceptance,signal:abort.signal});}
  catch(error){console.error(JSON.stringify({event:'SYNK_HA_START_FAILED',code:/^[A-Z0-9_]{1,100}$/.test(error.code||'')?error.code:'CONFIGURATION_INVALID'}));process.exitCode=1;}
}
