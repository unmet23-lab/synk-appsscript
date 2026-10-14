import {createHash,randomUUID} from 'node:crypto';
import {validateResearchReport,normalizeProducerPublicationDates} from './creative-research.mjs';

const SETTINGS='creative-research-sync',PROGRESS='creative-research-sync-state',LEASE='creative-research-sync-lease';
const INTERVAL_MS=30*1000,LEASE_MS=2*60*1000,MAX_DOCUMENT_BYTES=2*1024*1024;
const MAX_RETRY_MS=5*60*1000,FRESHNESS_LIMIT_HOURS=36;
export const CREATIVE_RESEARCH_COMPLETE='SYNK_CREATIVE_RESEARCH_COMPLETE';
const messages={SYNC_CONFIG_INVALID:'자동 반영 설정의 켜짐 여부와 저장 계정 식별자를 확인해 주세요.',SYNC_DOCUMENT_ADDRESS_INVALID:'Google 문서 주소 또는 문서 ID를 입력해 주세요. 계정 정보·임의 추적값이 포함된 주소는 사용할 수 없습니다.',SYNC_READ_FAILED:'공유 조사 문서를 읽지 못했습니다. 기존 자료는 유지됩니다.',SYNC_READ_TIMEOUT:'공유 문서 읽기가 지연되었습니다. 다음 확인에서 다시 시도합니다.',SYNC_DOCUMENT_INVALID:'완료된 문서는 단일 JSON 보고서와 마지막 완료 표시만 포함해야 합니다.',SYNC_DOCUMENT_TOO_LARGE:'공유 조사 문서가 2MiB 한도를 넘었습니다. 기존 자료는 유지됩니다.',SYNC_REPORT_INVALID:'완료 보고서의 날짜·출처·자료 형식을 확인해 주세요. 기존 자료는 유지됩니다.',SYNC_IMPORT_FAILED:'완료 보고서를 저장하지 못했습니다. 기존 자료와 마지막 성공 기록은 유지됩니다.',SYNC_OWNER_UNAVAILABLE:'자동 반영을 설정한 관리자의 현재 권한을 확인해 주세요.',SYNC_AUTHORITY_CHANGED:'문서나 자동 반영 설정이 변경되어 읽은 결과를 반영하지 않았습니다.',SYNC_STOPPED:'자동 반영 서비스가 종료 중입니다.'};
const failure=(code,status=400)=>Object.assign(new Error(messages[code]||'자동 반영 입력을 확인해 주세요.'),{code,status});
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw failure('SYNC_DOCUMENT_INVALID');return value;};
function instant(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw failure('SYNC_DOCUMENT_INVALID');return new Date(value).toISOString();}
const plus=(at,ms)=>new Date(Date.parse(at)+ms).toISOString();
const defaults=()=>({enabled:false,sources:[],documentId:null,connectionId:null,ownerId:null,version:0});

export function normalizeCreativeResearchDocumentId(value){
  if(typeof value!=='string'||value.length>2000)throw failure('SYNC_DOCUMENT_ADDRESS_INVALID');const input=value.trim();
  if(/^[A-Za-z0-9_-]{20,200}$/.test(input))return input;
  let url;try{url=new URL(input);}catch{throw failure('SYNC_DOCUMENT_ADDRESS_INVALID');}
  const allowedHash=!url.hash||/^#(?:heading=h\.|bookmark=id\.|tab=t\.)[A-Za-z0-9_-]{1,200}$/.test(url.hash);
  if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.port||url.username||url.password||!allowedHash)throw failure('SYNC_DOCUMENT_ADDRESS_INVALID');
  const match=/^\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,200})(?:\/(?:edit|view))?\/?$/.exec(url.pathname);
  const allowedParameter=(key,value)=>key==='usp'&&['sharing','drive_link','drive_web','drivesdk'].includes(value)||key==='tab'&&/^[A-Za-z0-9_.-]{1,120}$/.test(value)||key==='authuser'&&/^\d+$/.test(value);
  if(!match||[...url.searchParams].some(([key,value])=>!allowedParameter(key,value))||['usp','tab','authuser'].some(key=>url.searchParams.getAll(key).length>1))throw failure('SYNC_DOCUMENT_ADDRESS_INVALID');
  return match[1];
}

export function parseCompletedCreativeResearch(text,{at=new Date().toISOString()}={}){
  if(typeof text!=='string')throw failure('SYNC_DOCUMENT_INVALID');
  if(Buffer.byteLength(text,'utf8')>MAX_DOCUMENT_BYTES)throw failure('SYNC_DOCUMENT_TOO_LARGE');
  const lines=text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd().split('\n');
  if(lines.at(-1)!==CREATIVE_RESEARCH_COMPLETE)return {complete:false};
  let body=lines.slice(0,-1).join('\n').trim();
  if(body.startsWith('```')){const match=/^```(?:json)?[ \t]*\n([\s\S]*)\n```$/i.exec(body);if(!match)throw failure('SYNC_DOCUMENT_INVALID');body=match[1].trim();}
  let report;try{report=JSON.parse(body);}catch{throw failure('SYNC_DOCUMENT_INVALID');}
  try{const normalized=normalizeProducerPublicationDates(report,{at});return {complete:true,report:validateResearchReport(normalized.report,{at}),originalInputHash:createHash('sha256').update(text).digest('hex'),publicationDateNormalizations:normalized.publicationDateNormalizations};}catch{throw failure('SYNC_REPORT_INVALID');}
}

export function createCreativeResearchSyncService({store,research,reader,clock=()=>new Date().toISOString(),onImported,readerTimeoutMs=60000}={}){
  if(!store||typeof research?.importReport!=='function'||typeof reader!=='function')throw new Error('자동 조사 반영에는 저장소·보고서 가져오기·문서 읽기가 필요합니다.');
  if(!Number.isInteger(readerTimeoutMs)||readerTimeoutMs<1||readerTimeoutMs>60000)throw new Error('문서 읽기 제한 시간을 확인해 주세요.');
  const activeTasks=new Map();let stopped=false;
  function config(){
    const saved={...defaults(),...(store.get('settings',SETTINGS)||{})};
    // Keep old singleton settings and state records readable after the upgrade.
    const sources=Array.isArray(saved.sources)&&saved.sources.length?saved.sources:saved.documentId?[{id:'primary',documentId:saved.documentId,connectionId:saved.connectionId??null}]:[];
    return {...saved,sources,documentId:sources[0]?.documentId??null,connectionId:sources[0]?.connectionId??null};
  }
  const recordKey=(base,source)=>source.id==='primary'?base:base+':'+source.id;
  const progress=source=>store.get('settings',recordKey(PROGRESS,source))||{};
  const leaseFor=source=>store.get('settings',recordKey(LEASE,source));
  const liveUser=user=>{const current=user?.id&&store.get('users',user.id);if(!current?.active)throw Object.assign(new Error('먼저 로그인해 주세요.'),{status:401});return current;};
  function admin(user){user=liveUser(user);if(user.role!=='admin')throw Object.assign(new Error('관리자만 자동 반영을 설정할 수 있습니다.'),{status:403});if(stopped)throw failure('SYNC_STOPPED',503);return user;}
  const leaseActive=(lease,at)=>lease&&Date.parse(lease.leaseExpiresAt)>Date.parse(at);
  const ownerAllowed=current=>{const owner=current.ownerId&&store.get('users',current.ownerId);return owner?.active&&owner.role==='admin'?owner:null;};
  const sourceKey=source=>source.documentId+'\n'+(source.connectionId||'active');
  const recovering=(current,saved)=>!stopped&&current.enabled&&(saved.status==='disabled'||saved.lastErrorCode==='SYNC_STOPPED');
  function visibleReport(user,metadata){
    if(!user?.active||!metadata?.id)return null;
    return typeof research.reportVisible==='function'&&research.reportVisible(user,metadata.id)?metadata:null;
  }
  function sourceState(current,source,viewer,at){
    const saved=progress(source),lease=leaseFor(source),checking=leaseActive(lease,at)&&lease.version===current.version,resumed=recovering(current,saved);
    const lastReport=visibleReport(viewer,saved.lastReport),researchCompletedAt=typeof lastReport?.researchCompletedAt==='string'&&Number.isFinite(Date.parse(lastReport.researchCompletedAt))?lastReport.researchCompletedAt:null,researchAgeHours=researchCompletedAt?Math.max(0,(Date.parse(at)-Date.parse(researchCompletedAt))/3600000):null;
    return {enabled:current.enabled,status:!current.enabled||stopped?'disabled':checking?'checking':resumed||saved.status==='checking'?'waiting':saved.status||'waiting',lastCheckedAt:saved.lastCheckedAt||null,lastReadAt:saved.lastReadAt||null,lastImportedAt:saved.lastImportedAt||null,lastError:resumed?null:saved.lastError||null,lastErrorCode:resumed?null:saved.lastErrorCode||null,lastReport,researchCompletedAt,researchAgeHours,freshness:researchAgeHours===null?'unknown':researchAgeHours>FRESHNESS_LIMIT_HOURS?'stale':'current',freshnessLimitHours:FRESHNESS_LIMIT_HOURS,nextCheckAt:current.enabled&&!stopped?resumed?at:saved.nextCheckAt||at:null};
  }
  function state(user){
    const at=instant(clock()),current=config(),viewer=user?.id&&store.get('users',user.id),rows=current.sources.map(source=>sourceState(current,source,viewer,at));
    const latest=key=>rows.map(row=>row[key]).filter(Boolean).sort().at(-1)||null;
    const reported=rows.filter(row=>row.lastReport).sort((a,b)=>String(b.lastReport.importedAt||'').localeCompare(String(a.lastReport.importedAt||'')))[0]?.lastReport||null;
    const error=rows.find(row=>row.status==='error'),result={enabled:current.enabled,status:!current.enabled||stopped?'disabled':error?'error':rows.some(row=>row.status==='checking')?'checking':rows.some(row=>row.status==='imported')?'imported':'waiting',checkedAt:at,sourceCount:rows.length,errorSourceCount:rows.filter(row=>row.status==='error').length,staleSourceCount:rows.filter(row=>row.freshness==='stale').length,freshnessLimitHours:FRESHNESS_LIMIT_HOURS,lastCheckedAt:latest('lastCheckedAt'),lastReadAt:latest('lastReadAt'),lastImportedAt:latest('lastImportedAt'),lastError:error?.lastError||null,lastErrorCode:error?.lastErrorCode||null,lastReport:reported,nextCheckAt:current.enabled&&!stopped?rows.map(row=>row.nextCheckAt).filter(Boolean).sort()[0]||at:null};
    if(viewer?.active&&viewer.role==='admin')Object.assign(result,{documentId:current.documentId,documentUrl:current.documentId?'https://docs.google.com/document/d/'+current.documentId+'/edit':null,connectionId:current.connectionId,ownerId:current.ownerId,version:current.version,sources:current.sources.map((source,i)=>({...source,documentUrl:'https://docs.google.com/document/d/'+source.documentId+'/edit',...rows[i]}))});
    return result;
  }
  function connection(value){if(value!==null&&(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(value)))throw failure('SYNC_CONFIG_INVALID');return value;}
  function normalizeSources(values){
    if(!Array.isArray(values)||values.length>8)throw failure('SYNC_CONFIG_INVALID');const ids=new Set(),documents=new Set();
    return values.map(value=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['id','documentId','connectionId'].includes(key))||typeof value.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value.id)||ids.has(value.id))throw failure('SYNC_CONFIG_INVALID');const documentId=normalizeCreativeResearchDocumentId(value.documentId);if(documents.has(documentId))throw failure('SYNC_CONFIG_INVALID');ids.add(value.id);documents.add(documentId);return {id:value.id,documentId,connectionId:connection(value.connectionId??null)};});
  }
  function configure(user,input){
    user=admin(user);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['enabled','sources','documentId','connectionId'].includes(key))||input.sources!==undefined&&(input.documentId!==undefined||input.connectionId!==undefined))throw failure('SYNC_CONFIG_INVALID');
    return store.transaction(()=>{
      user=admin(user);const previous=config(),next={...previous,ownerId:user.id,sources:previous.sources.map(source=>({...source}))};
      if(input.enabled!==undefined){if(typeof input.enabled!=='boolean')throw failure('SYNC_CONFIG_INVALID');next.enabled=input.enabled;}
      if(input.sources!==undefined)next.sources=normalizeSources(input.sources);
      // The existing single-document form only edits the first source. It must
      // never silently delete other registered writers.
      else if(input.documentId!==undefined||input.connectionId!==undefined){
        const first=next.sources[0]||{id:'primary',documentId:null,connectionId:null};
        if(input.documentId!==undefined)first.documentId=input.documentId===null||input.documentId===''?null:normalizeCreativeResearchDocumentId(input.documentId);
        if(input.connectionId!==undefined)first.connectionId=connection(input.connectionId);
        if(first.documentId)next.sources=normalizeSources([first,...next.sources.slice(1)]);else next.sources=next.sources.slice(1);
      }
      if(next.enabled&&!next.sources.length)throw failure('SYNC_DOCUMENT_ADDRESS_INVALID');
      next.documentId=next.sources[0]?.documentId??null;next.connectionId=next.sources[0]?.connectionId??null;
      const changed=['enabled','ownerId'].some(key=>next[key]!==previous[key])||JSON.stringify(next.sources)!==JSON.stringify(previous.sources);
      if(changed){
        next.version=previous.version+1;store.put('settings',SETTINGS,next);
        for(const source of next.sources){const saved=progress(source),prior=previous.sources.find(row=>row.id===source.id),same=prior&&sourceKey(prior)===sourceKey(source);store.put('settings',recordKey(PROGRESS,source),{...saved,status:next.enabled?'waiting':'disabled',nextCheckAt:next.enabled?instant(clock()):null,lastError:null,lastErrorCode:null,consecutiveFailures:0,...(!same?{lastReadAt:null,lastModifiedTime:null,lastSeenHash:null,lastSeenSourceKey:null,lastSeenStatus:null}: {})});}
        for(const task of activeTasks.values())task.controller.abort(failure('SYNC_AUTHORITY_CHANGED',409));
      }
      return state(user);
    });
  }
  function authority(claim){
    if(stopped)throw failure('SYNC_STOPPED',503);const current=config(),source=current.sources.find(row=>row.id===claim.source.id),lease=leaseFor(claim.source),at=instant(clock());
    if(!current.enabled||current.version!==claim.current.version||!source||sourceKey(source)!==sourceKey(claim.source)||current.ownerId!==claim.current.ownerId||lease?.id!==claim.lease.id||!leaseActive(lease,at))throw failure('SYNC_AUTHORITY_CHANGED',409);
    const owner=ownerAllowed(current);if(!owner)throw failure('SYNC_OWNER_UNAVAILABLE',403);return owner;
  }
  function finish(claim,update){
    return store.transaction(()=>{const key=recordKey(LEASE,claim.source),lease=store.get('settings',key);if(lease?.id!==claim.lease.id)return false;store.remove('settings',key);if(config().version!==claim.current.version)return false;store.put('settings',recordKey(PROGRESS,claim.source),{...progress(claim.source),...update});return true;});
  }
  async function read(claim){
    let timer,onAbort;const saved=progress(claim.source),ifModifiedTime=saved.lastSeenSourceKey===sourceKey(claim.source)?saved.lastModifiedTime:null,{signal}=claim.controller;
    try{return await Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return reader({documentId:claim.source.documentId,connectionId:claim.source.connectionId,...(ifModifiedTime?{ifModifiedTime}:{}),signal});}),new Promise((_,reject)=>{onAbort=()=>reject(signal.reason||failure('SYNC_STOPPED'));if(signal.aborted)return onAbort();signal.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>claim.controller.abort(failure('SYNC_READ_TIMEOUT')),readerTimeoutMs);})]);}
    catch(error){throw Object.hasOwn(messages,error?.code)?error:failure('SYNC_READ_FAILED');}finally{clearTimeout(timer);if(onAbort)signal.removeEventListener('abort',onAbort);}
  }
  async function processClaim(claim){
    let lastReadAt=null;
    try{
      const response=await read(claim);authority(claim);object(response);
      const saved=progress(claim.source),key=sourceKey(claim.source),modifiedTime=typeof response.modifiedTime==='string'&&Number.isFinite(Date.parse(response.modifiedTime))?new Date(response.modifiedTime).toISOString():null;
      if(response.notModified===true){if(!saved.lastModifiedTime||!modifiedTime||modifiedTime!==saved.lastModifiedTime||saved.lastSeenSourceKey!==key)throw failure('SYNC_DOCUMENT_INVALID');finish(claim,{status:saved.lastSeenStatus||'waiting',lastError:null,lastErrorCode:null,lastReadAt:instant(clock()),consecutiveFailures:0,lastModifiedTime:modifiedTime});return;}
      if(typeof response.text!=='string')throw failure('SYNC_DOCUMENT_INVALID');if(Buffer.byteLength(response.text,'utf8')>MAX_DOCUMENT_BYTES)throw failure('SYNC_DOCUMENT_TOO_LARGE');
      lastReadAt=instant(clock());
      const hash=createHash('sha256').update(response.text).digest('hex');
      if(saved.lastSeenHash===hash&&saved.lastSeenSourceKey===key){finish(claim,{status:saved.lastSeenStatus||'waiting',lastError:null,lastErrorCode:null,lastReadAt,consecutiveFailures:0,lastModifiedTime:modifiedTime});return;}
      const completed=parseCompletedCreativeResearch(response.text,{at:instant(clock())});
      if(!completed.complete){finish(claim,{status:'waiting',lastError:null,lastErrorCode:null,lastReadAt,consecutiveFailures:0,lastSeenHash:hash,lastSeenSourceKey:key,lastSeenStatus:'waiting',lastModifiedTime:modifiedTime});return;}
      const owner=authority(claim);let result;
      try{result=research.importReport(owner,{...completed.report,visibility:'company',shareConfirmed:true},{automaticSourceId:claim.source.documentId,automaticSourcePoolIds:claim.current.sources.map(source=>source.documentId),originalInputHash:completed.originalInputHash,publicationDateNormalizations:completed.publicationDateNormalizations,assertSession:()=>authority(claim)});}catch(error){if(Object.hasOwn(messages,error?.code))throw error;throw failure('SYNC_IMPORT_FAILED');}
      const importedAt=instant(clock()),stored=finish(claim,{status:'imported',lastError:null,lastErrorCode:null,lastReadAt,consecutiveFailures:0,lastReport:result.report,lastSeenHash:hash,lastSeenSourceKey:key,lastSeenStatus:'imported',lastModifiedTime:modifiedTime,...(!result.existing?{lastImportedAt:importedAt}:{})});
      if(stored&&!result.existing&&onImported){try{Promise.resolve(onImported({report:result.report,existing:false})).catch(()=>{});}catch{}}
    }catch(error){const code=Object.hasOwn(messages,error?.code)?error.code:'SYNC_READ_FAILED',consecutiveFailures=Math.min(100,Math.max(0,Number(progress(claim.source).consecutiveFailures)||0)+1),retryMs=Math.min(MAX_RETRY_MS,INTERVAL_MS*2**Math.min(4,consecutiveFailures-1));finish(claim,{status:stopped?'disabled':'error',lastError:messages[code],lastErrorCode:code,consecutiveFailures,nextCheckAt:stopped?null:plus(instant(clock()),retryMs),...(lastReadAt?{lastReadAt}:{})});}
  }
  async function tick(at=clock(),{force=false}={}){
    if(typeof force!=='boolean')return Promise.reject(failure('SYNC_DOCUMENT_INVALID'));if(stopped)return Promise.resolve(state());at=instant(at);
    const claims=store.transaction(()=>{
      const current=config();if(!current.enabled)return [];const claims=[];
      for(const source of current.sources){
        const saved=progress(source),lease=leaseFor(source);if(activeTasks.has(source.id)||leaseActive(lease,at)||!force&&!recovering(current,saved)&&saved.nextCheckAt&&Date.parse(saved.nextCheckAt)>Date.parse(at))continue;
        if(!ownerAllowed(current)){store.put('settings',recordKey(PROGRESS,source),{...saved,status:'error',lastCheckedAt:at,nextCheckAt:plus(at,INTERVAL_MS),lastError:messages.SYNC_OWNER_UNAVAILABLE,lastErrorCode:'SYNC_OWNER_UNAVAILABLE'});continue;}
        const claimed={id:randomUUID(),version:current.version,startedAt:at,leaseExpiresAt:plus(at,LEASE_MS)};store.put('settings',recordKey(LEASE,source),claimed);store.put('settings',recordKey(PROGRESS,source),{...saved,status:'checking',lastCheckedAt:at,nextCheckAt:plus(at,INTERVAL_MS),lastError:null,lastErrorCode:null});claims.push({current,source,lease:claimed});
      }
      return claims;
    });
    for(const claim of claims){const task={controller:new AbortController(),promise:null};claim.controller=task.controller;activeTasks.set(claim.source.id,task);task.promise=Promise.resolve().then(()=>processClaim(claim)).finally(()=>{if(activeTasks.get(claim.source.id)===task)activeTasks.delete(claim.source.id);});}
    await Promise.all([...activeTasks.values()].map(task=>task.promise));return state();
  }
  const waitForIdle=()=>Promise.allSettled([...activeTasks.values()].map(task=>task.promise)).then(()=>{});
  function stop(){stopped=true;for(const task of activeTasks.values())task.controller.abort(failure('SYNC_STOPPED',503));return waitForIdle();}
  return {configure,state,tick,waitForIdle,stop};
}
