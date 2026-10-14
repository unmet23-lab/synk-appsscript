import {createHash,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {mediaRange,STUDIO_MEDIA_LIMIT,validMediaSignature} from './studio-media.mjs';
import {createAttemptLimiter} from './request-security.mjs';

const KIND='socialPublishMediaGrants';
const PREFIX='/social-publish-media/';
const ACTIVE=new Set(['publishing','accepted','processing','unknown']);
const TYPES={'image/jpeg':'jpg','image/png':'png','video/mp4':'mp4','video/webm':'webm'};
const digest=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const copy=value=>JSON.parse(JSON.stringify(value));
const fail=(message,status=409,code='SOCIAL_MEDIA_UNAVAILABLE')=>Object.assign(new Error(message),{status,code});
const unavailable=()=>fail('이 게시 파일은 지금 제공할 수 없어요.',404);
const stoppedError=()=>fail('게시 파일 제공이 중단됐어요.',503,'SOCIAL_MEDIA_STOPPED');
const originError=()=>fail('직접 게시용 공개 HTTPS 주소를 설정해 주세요.',503,'SOCIAL_MEDIA_ORIGIN_UNAVAILABLE');
const assetId=ref=>ref?.assetId||ref?.id;
const refMatches=(left,right)=>assetId(left)===assetId(right)&&left.sha256===right.sha256&&left.mimeType===right.mimeType&&left.byteSize===right.byteSize;

function publicOrigin(value,allowLocalOrigin){
  try{
    const url=new URL(value),host=url.hostname.toLowerCase();
    if(url.origin!==value||url.username||url.password||url.search||url.hash)return null;
    const loopback=['localhost','127.0.0.1','[::1]'].includes(host);
    if(allowLocalOrigin&&loopback&&['http:','https:'].includes(url.protocol))return url.origin;
    if(url.protocol!=='https:'||isIP(host.replace(/^\[|\]$/g,''))||!host.includes('.')||host.endsWith('.')||/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host))return null;
    return url.origin;
  }catch{return null;}
}

/** Bearer URLs are passed only to the SNS upload call, never to workspace views.
 * The caller must redact this path in any proxy/access logs as well.
 * authorizePublish must recheck approval, publisher permissions, pause state and
 * current provider connection; media-fetch also allows submitted job states.
 */
export function createSocialPublishMedia({store,clock=()=>new Date().toISOString(),origin,resolveMedia,authorizePublish,allowLocalOrigin=false,ttlMs=3600000,issueConcurrency=2,handleConcurrency=8,cacheBytes=256*1024*1024}={}){
  if(!store||typeof resolveMedia!=='function'||typeof authorizePublish!=='function')throw new Error('Social publish media requires store, resolveMedia and authorizePublish.');
  if(!Number.isSafeInteger(ttlMs)||ttlMs<60000||ttlMs>3600000)throw new Error('Social publish media TTL must be between 1 minute and 1 hour.');
  if(![issueConcurrency,handleConcurrency].every(value=>Number.isSafeInteger(value)&&value>=1&&value<=64)||!Number.isSafeInteger(cacheBytes)||cacheBytes<0)throw new Error('Social publish media concurrency limits must be integers from 1 to 64 and the cache limit a non-negative byte count.');
  const site=publicOrigin(origin,allowLocalOrigin),pending={issue:new Set(),handle:new Set()},controllers=new Set(),cache=new Map();let stopped=false,cachedBytes=0;
  // Bytes verified against the approved hash are kept per grant (bounded LRU) so HEAD, Range and repeated GET
  // requests from the SNS do not read and hash the file again. A dropped or expired grant releases its copy.
  function forget(id){const entry=cache.get(id);if(!entry)return;cache.delete(id);cachedBytes-=entry.bytes.length;}
  function remember(id,entry){forget(id);if(entry.bytes.length>cacheBytes)return;while(cachedBytes+entry.bytes.length>cacheBytes&&cache.size)forget(cache.keys().next().value);cache.set(id,entry);cachedBytes+=entry.bytes.length;}
  function recall(id){const entry=cache.get(id);if(!entry)return null;cache.delete(id);cache.set(id,entry);return entry;}
  const stats=()=>({cachedGrants:cache.size,cachedBytes});
  const stamp=()=>{const time=Date.parse(clock());if(!Number.isFinite(time))throw stoppedError();return time;};
  const limiter=createAttemptLimiter({limit:120,windowMs:60000,maxEntries:4000,now:stamp});
  const now=()=>new Date(stamp()).toISOString();

  function current(grant,signal,{stored=false}={}){
    if(stopped||signal?.aborted)throw stoppedError();
    if(!site)throw originError();
    if(grant.expiresAt&&Date.parse(grant.expiresAt)<=stamp())throw unavailable();
    if(stored){const live=store.get(KIND,grant.id);if(!live||stable(live)!==stable(grant)){forget(grant.id);throw unavailable();}}
    const job=store.get('socialPublishJobs',grant.jobId),post=job&&store.get('socialPosts',job.postId),channel=job&&store.get('channels',job.channelId);
    if(!job||!post||!channel||!ACTIVE.has(job.status)||channel.active===false||channel.hidden===true||!post.approval||post.expiresAt&&Date.parse(post.expiresAt)<=stamp())throw unavailable();
    if(!job.snapshot?.post||!job.snapshot?.variant||job.snapshot.post.id!==post.id||job.snapshot.variant.channelId!==channel.id||job.contentVersion!==post.contentVersion||job.approvalHash!==post.approval.hash||post.approval.contentVersion!==post.contentVersion)throw unavailable();
    const binding={jobId:job.id,postId:post.id,channelId:channel.id,contentVersion:job.contentVersion,approvalHash:job.approvalHash,approvalFingerprint:digest(stable(post.approval)),connectionVersion:channel.connectionVersion||0,platform:channel.platform,externalId:channel.externalId||null,publisherId:job.publisherId,approverId:job.approverId||null,idempotencyKey:job.idempotencyKey,attempts:job.attempts||0,scheduleRevision:job.scheduleRevision||0,snapshotFingerprint:digest(stable(job.snapshot))};
    if(grant.binding&&stable(binding)!==stable(grant.binding))throw unavailable();
    const ref=job.snapshot.variant.media?.find(item=>refMatches(item,grant.ref));
    if(!ref)throw unavailable();
    return {channel,post:job.snapshot.post,variant:job.snapshot.variant,job,binding,ref};
  }

  async function authorize(grant,signal,phase,stored,continuation=false){
    const context=current(grant,signal,{stored});
    if(await authorizePublish({...context,signal,phase,...(continuation?{continuation:true}:{})})===false)throw unavailable();
    const live=current(grant,signal,{stored});
    if(stable(context.binding)!==stable(live.binding))throw unavailable();
    return live;
  }

  function inspectRef(ref){
    if(!ref||typeof ref!=='object'||typeof assetId(ref)!=='string'||!assetId(ref)||assetId(ref).length>200||!/^[a-f0-9]{64}$/.test(ref.sha256||'')||!TYPES[ref.mimeType])throw fail('해시가 확인된 워크스페이스 이미지·영상을 사용해 주세요.',422,'SOCIAL_MEDIA_NOT_VERIFIED');
    if(ref.byteSize!==undefined&&(!Number.isSafeInteger(ref.byteSize)||ref.byteSize<1||ref.byteSize>STUDIO_MEDIA_LIMIT))throw fail('게시 파일은 100MiB 이하여야 해요.',413,'SOCIAL_MEDIA_TOO_LARGE');
  }

  async function verifiedMedia(grant,signal,phase,stored,continuation=false){
    const context=await authorize(grant,signal,phase,stored,continuation);
    if(stored){const kept=recall(grant.id);if(kept)return kept;}
    const result=await resolveMedia(context.ref,{...context,signal});
    await authorize(grant,signal,phase,stored,continuation);
    const bytes=result?.bytes;
    if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>STUDIO_MEDIA_LIMIT||result.mimeType!==grant.ref.mimeType||grant.ref.byteSize!==undefined&&bytes.byteLength!==grant.ref.byteSize||digest(bytes)!==grant.ref.sha256)throw unavailable();
    const buffer=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
    if(!validMediaSignature(result.mimeType,buffer.subarray(0,4096)))throw unavailable();
    const entry={bytes:buffer,mimeType:result.mimeType};if(stored)remember(grant.id,entry);return entry;
  }

  function track(work,outerSignal,pool,limit){
    if(stopped)return Promise.reject(stoppedError());
    if(pool.size>=limit)return Promise.reject(fail('게시 파일을 준비하고 있어요. 잠시 후 다시 시도해 주세요.',429,'SOCIAL_MEDIA_BUSY'));
    const controller=new AbortController();controllers.add(controller);
    const signal=outerSignal?AbortSignal.any([outerSignal,controller.signal]):controller.signal;
    const task=Promise.resolve().then(()=>work(signal)).finally(()=>{pool.delete(task);controllers.delete(controller);});pool.add(task);return task;
  }

  function prune(){for(const grant of store.all(KIND)){const job=store.get('socialPublishJobs',grant.jobId);if(Date.parse(grant.expiresAt)<=stamp()||!job||!ACTIVE.has(job.status)){store.remove(KIND,grant.id);forget(grant.id);}}}

  function issue(ref,input={}){return track(async signal=>{
    if(!site)throw originError();inspectRef(ref);
    const grant={jobId:input.job?.id,ref:copy(ref)},context=current(grant,signal);
    if(input.channel?.id!==context.channel.id||(input.channel.connectionVersion||0)!==(context.channel.connectionVersion||0)||input.channel.platform!==context.channel.platform||(input.channel.externalId||null)!==(context.channel.externalId||null)||stable(input.post)!==stable(context.post)||stable(input.variant)!==stable(context.variant)||stable(input.job?.snapshot)!==stable(context.job.snapshot)||['idempotencyKey','contentVersion','approvalHash','publisherId','approverId','attempts','scheduleRevision'].some(key=>input.job?.[key]!==context.job[key]))throw unavailable();
    grant.binding=context.binding;grant.ref=copy(context.ref);
    await verifiedMedia(grant,signal,'media-issue',false,input.continuation===true);
    current(grant,signal);
    const raw=randomBytes(32).toString('base64url'),id=digest(raw),createdAt=now(),row={id,...grant,createdAt,expiresAt:new Date(stamp()+ttlMs).toISOString()};
    // Only the hash is persisted. A subsequent issue creates a new URL instead
    // of retaining a recoverable bearer token in jobs or provider journals.
    const save=()=>{current(grant,signal);prune();if(store.all(KIND).length>=10000)throw fail('게시 파일 연결 한도를 확인해 주세요.',429,'SOCIAL_MEDIA_GRANT_LIMIT');store.put(KIND,id,row);};
    if(typeof store.transaction==='function')store.transaction(save);else save();
    return {url:site+PREFIX+raw};
  },input.signal,pending.issue,issueConcurrency);}

  const headers={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'X-Robots-Tag':'noindex, nofollow, noarchive'};
  function sendError(req,res,status,extra={}){
    if(res.headersSent){res.destroy?.();return;}
    const body=Buffer.from(status===503?'게시 파일 제공이 잠시 중단됐어요.':status===429?'잠시 후 다시 요청해 주세요.':'게시 파일을 제공할 수 없어요.');
    res.writeHead(status,{...headers,'Content-Type':'text/plain; charset=utf-8','Content-Length':body.length,...extra});res.end(req.method==='HEAD'?undefined:body);
  }

  async function handle(req,res,{url,signal}={}){
    const path=url?.pathname;if(typeof path!=='string'||!path.startsWith(PREFIX))return false;
    if(!['GET','HEAD'].includes(req.method)){sendError(req,res,405,{Allow:'GET, HEAD'});return true;}
    const match=/^\/social-publish-media\/([A-Za-z0-9_-]{43})$/.exec(path);
    if(!match||url.search||req.headers?.['x-synk-demo']==='1'){sendError(req,res,404);return true;}
    try{await track(async activeSignal=>{
      const tokenHash=digest(match[1]),grant=store.get(KIND,tokenHash);
      if(!grant||grant.id!==tokenHash)throw unavailable();
      limiter.reserve(tokenHash);inspectRef(grant.ref);
      const result=await verifiedMedia(grant,activeSignal,'media-fetch',true);
      let range;try{range=mediaRange(req.headers?.range,result.bytes.length);}catch(error){if(error.status!==416)throw error;current(grant,activeSignal,{stored:true});sendError(req,res,416,{'Content-Range':`bytes */${result.bytes.length}`});return;}
      current(grant,activeSignal,{stored:true});
      const responseHeaders={...headers,'Content-Type':result.mimeType,'Content-Length':range?range.end-range.start+1:result.bytes.length,'Accept-Ranges':'bytes','Content-Disposition':`inline; filename="publish-media.${TYPES[result.mimeType]}"`};
      if(range)responseHeaders['Content-Range']=`bytes ${range.start}-${range.end}/${result.bytes.length}`;
      res.writeHead(range?206:200,responseHeaders);
      if(req.method==='HEAD')res.end();
      else await pipeline(Readable.from([range?result.bytes.subarray(range.start,range.end+1):result.bytes]),res,{signal:activeSignal});
    },signal,pending.handle,handleConcurrency);}catch(error){if(error?.status===404)forget(digest(match[1]));sendError(req,res,error?.status===429?429:error?.status===503?503:404);}
    return true;
  }

  const waitForIdle=async()=>{await Promise.allSettled([...pending.issue,...pending.handle]);};
  const stop=async()=>{stopped=true;for(const controller of controllers)controller.abort();await waitForIdle();cache.clear();cachedBytes=0;};
  return {issue,handle,ready:!!site,unavailableReason:site?null:originError().message,waitForIdle,stop,stats};
}
