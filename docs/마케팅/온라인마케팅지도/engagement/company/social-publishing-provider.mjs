import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canManageOwners} from './organization.mjs';
import {createSocialProvider} from './social-provider.mjs';
import {createSocialDirectMeta} from './social-direct-meta.mjs';
import {createSocialDirectYouTube} from './social-direct-youtube.mjs';

const LINKS='socialDirectConnections',HEALTH='socialDirectHealth';
const supported=c=>['instagram','facebook','youtube'].includes(c?.platform);
const fail=(code,message,status=409)=>Object.assign(new Error(message),{code,message,status,providerSafe:true});

// New work uses official SNS APIs. Existing Postiz receipts remain readable so
// switching providers never causes a previously submitted job to be sent again.
export function createSocialPublishingProvider({store,clock=()=>new Date().toISOString(),getProviderConfig=()=>({}),directProvider,youtubeProvider,legacyProvider,...options}={}){
  const direct=directProvider||createSocialDirectMeta({store,clock,...options});
  const youtube=youtubeProvider||createSocialDirectYouTube({store,clock,...options});
  const adapter=c=>c?.platform==='youtube'?youtube:direct;
  const providerName=c=>c?.platform==='youtube'?'youtube-direct':'meta-direct';
  const legacy=legacyProvider||createSocialProvider({store,clock,...options});
  const now=()=>new Date(clock()).toISOString();
  let stopped=false,healthRun=null,controller=null;
  function current(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('AUTH_REQUIRED','먼저 로그인해 주세요.',401);return live;}
  function authorized(user,id,context={}){context.authorize?.();if(stopped||context.signal?.aborted)throw fail('PROVIDER_STOPPED','발행 연결 점검이 중단됐어요.',503);const live=current(user),channel=store.get('channels',id);if(!channel||channel.active===false||channel.hidden||!canManageOwners(live,channel))throw fail('CHANNEL_FORBIDDEN','이 계정의 게시 관리 권한을 확인해 주세요.',403);return {user:live,channel};}
  function visible(user){const actor=current(user);return store.all('channels').filter(c=>c.active!==false&&!c.hidden&&canReadChannel(actor,c));}
  function assertUnique(channel){if(store.all(LINKS).some(link=>link.enabled&&link.channelId!==channel.id&&link.accountId===channel.externalId&&store.get('channels',link.channelId)?.platform===channel.platform))throw fail('INTEGRATION_ALREADY_MAPPED','이 SNS 계정은 다른 회사 채널에서 이미 자동 게시를 사용하고 있어요. 기존 채널을 이용해 주세요.');}
  function capability(channel){
    if(!supported(channel))return {...legacy.capability(channel),provider:'manual',mode:channel?.active===false?'unavailable':'manual',canPublish:false,connection:null,reason:channel?.platform==='tiktok'?'TikTok은 현재 SNS 앱에서 게시를 마무리해 주세요.':'이 SNS의 직접 자동 게시 연결은 아직 준비되지 않았어요. 예약 후 SNS 앱에서 마무리할 수 있어요.'};
    const cap=adapter(channel).capability(channel),link=store.get(LINKS,channel.id);try{assertUnique(channel);}catch(error){return {...cap,mode:'manual',canPublish:false,connection:null,reason:error.message,errorCode:error.code};}
    // Approval binds the explicit publishing switch without invalidating the
    // independent comment connection or changing its connectionVersion.
    const connection=link?.enabled?{...(cap.connection||{}),integrationId:providerName(channel)+':'+link.accountId+':'+link.version,profile:channel.handle||link.accountId,name:channel.displayName||channel.handle||'',status:cap.canPublish?'connected':'needs_check',checkedAt:link.checkedAt||null}:null;
    return {...cap,provider:providerName(channel),connection};
  }
  function settings(user){const actor=current(user);return {provider:'direct',mode:'direct',label:'SNS 직접 연결',configured:true,enabled:true,platforms:['instagram','facebook','youtube'],integrations:[],rateLimit:{requests:120,periodSeconds:3600,source:'synk-local-planning-budget'},channels:visible(actor).map(c=>{const cap=capability(c),link=store.get(LINKS,c.id),cfg=getProviderConfig(c.platform)||{};return {channelId:c.id,supported:supported(c),connected:cap.canPublish===true,enabled:link?.enabled===true,canConfigure:supported(c)&&canManageOwners(actor,c),reason:cap.reason,missingScopes:cap.missingScopes||[],connectUrl:supported(c)&&cfg.clientId&&cfg.clientSecret?'/api/oauth/'+c.platform+'/start?channelId='+encodeURIComponent(c.id)+'&publishing=1':null,appConfigured:!!(cfg.clientId&&cfg.clientSecret),checkedAt:link?.checkedAt||null};})};}
  function guard(user,channel,context,link){const currentChannel=authorized(user,channel.id,context).channel;if((currentChannel.connectionVersion||0)!==(channel.connectionVersion||0)||currentChannel.externalId!==channel.externalId||currentChannel.handle!==channel.handle||JSON.stringify(store.get(LINKS,channel.id)||null)!==JSON.stringify(link||null))throw fail('CONNECTION_CHANGED','확인하는 동안 계정 연결이 바뀌었어요. 다시 확인해 주세요.');return currentChannel;}
  async function connect(user,input={},context={}){
    const {channel}=authorized(user,input.channelId,context);if(!supported(channel))throw fail('UNSUPPORTED_PLATFORM','현재 Instagram·Facebook 페이지·YouTube의 직접 게시를 연결할 수 있어요.',400);
    const previous=store.get(LINKS,channel.id);
    const check=()=>guard(user,channel,context,previous);
    // Renew an expired token before pinning the read-only verification attempt.
    if(options.getCredentials){await options.getCredentials(channel);check();}
    const pin=store.secret('channel:'+channel.id)?.accessToken;
    const result=await adapter(channel).checkConnection(channel,{signal:context.signal,authorize:check});check();
    const credentials=store.secret('channel:'+channel.id);
    if(credentials?.accessToken!==pin)throw fail('CONNECTION_CHANGED','연결 확인 중 인증 정보가 바뀌었어요. 다시 확인해 주세요.');
    const accountId=result?.accountId||credentials?.accountId||channel.externalId;
    if(!accountId||accountId!==(credentials?.accountId||channel.externalId))throw fail('ACCOUNT_MISMATCH','게시할 SNS 계정을 확인하지 못했어요.');
    const row={id:channel.id,channelId:channel.id,provider:providerName(channel),enabled:true,version:randomUUID(),connectionVersion:channel.connectionVersion||0,accountId,authType:credentials.authType,checkedAt:now(),updatedAt:now(),updatedBy:user.id};
    store.transaction(()=>{check();assertUnique(channel);store.put(LINKS,channel.id,row);store.put(HEALTH,channel.id,{id:channel.id,channelId:channel.id,version:row.version,connectionVersion:row.connectionVersion,state:'connected',checkedAt:row.checkedAt,lastAttemptAt:row.checkedAt,message:'SNS 계정과 게시 권한을 확인했어요.',errorCode:null});});
    return {channelId:channel.id,...capability(channel)};
  }
  function disconnect(user,input={},context={}){const {channel}=authorized(user,input.channelId,context),old=store.get(LINKS,channel.id);store.put(LINKS,channel.id,{...old,id:channel.id,channelId:channel.id,enabled:false,version:randomUUID(),updatedAt:now(),updatedBy:user.id});return {channelId:channel.id,disconnected:true};}
  function health(user){const actor=current(user),channels=visible(actor).map(c=>{const cap=capability(c),link=store.get(LINKS,c.id),saved=store.get(HEALTH,c.id),same=saved?.version===link?.version&&saved?.connectionVersion===(c.connectionVersion||0),record=same?saved:null;return {channelId:c.id,state:!supported(c)?'unsupported':!link?.enabled?'not_configured':!cap.canPublish?'auth_required':record?.state||'connected',message:!link?.enabled||!cap.canPublish?cap.reason:record?.message||cap.reason,checkedAt:record?.checkedAt||null,lastAttemptAt:record?.lastAttemptAt||null,stale:!record?.checkedAt||Date.parse(now())-Date.parse(record.checkedAt)>3600000,canCheck:supported(c)&&canManageOwners(actor,c),errorCode:record?.errorCode||cap.errorCode||null};});return {provider:'direct',api:{state:'connected',message:'별도 구독 없이 SNS 공식 API에 직접 연결해요. 계정별 권한은 아래 결과를 확인하세요.',checkedAt:null},channels,canCheck:channels.some(c=>c.canCheck),intervalMinutes:60};}
  async function inspect(user,channel,context={}){
    const previous=store.get(LINKS,channel.id),check=()=>guard(user,channel,context,previous),attempt=now();
    try{await adapter(channel).checkConnection(channel,{signal:context.signal,authorize:check});check();store.put(HEALTH,channel.id,{id:channel.id,channelId:channel.id,version:previous?.version||null,connectionVersion:channel.connectionVersion||0,state:'connected',checkedAt:now(),lastAttemptAt:attempt,message:'SNS 계정과 게시 권한을 확인했어요.',errorCode:null});return true;}
    catch(error){check();store.put(HEALTH,channel.id,{id:channel.id,channelId:channel.id,version:previous?.version||null,connectionVersion:channel.connectionVersion||0,state:/AUTH|SCOPE|CONNECT|TOKEN|PERMISSION|ACCOUNT/.test(error.code||'')?'auth_required':'error',checkedAt:null,lastAttemptAt:attempt,message:error.providerSafe||error.metaSafe?error.message:'게시 연결을 확인하지 못했어요. 다시 확인해 주세요.',errorCode:error.code||'CONNECTION_CHECK_FAILED'});return false;}
  }
  async function checkHealth(user,input={},context={}){const actor=current(user);if(stopped)throw fail('PROVIDER_STOPPED','발행 연결 점검이 중단됐어요.',503);const channels=input.channelId?[authorized(actor,input.channelId,context).channel]:visible(actor).filter(c=>supported(c)&&canManageOwners(actor,c)&&store.get(LINKS,c.id)?.enabled).slice(0,5);for(const c of channels){if(!supported(c))throw fail('UNSUPPORTED_PLATFORM','직접 게시를 지원하는 계정을 선택해 주세요.',400);await inspect(actor,c,context);}return health(actor);}
  async function refresh(user,input={},context={}){await checkHealth(user,input,context);return settings(user);}
  function configure(){throw fail('DIRECT_CONNECTION_REQUIRED','계정 관리에서 SNS 게시 권한을 연결한 뒤 자동 게시를 켜 주세요.',400);}
  // Ledger ids are deterministic (direct adapters: sha256 of [provider, channel id, idempotency key]; Postiz: sha256 of
  // "channelId:key"), so a job's receipt is a store.get away. Rows written under another scheme are indexed by one
  // full scan of both tables that is remembered for SCAN_INTERVAL.
  const DIRECT='socialDirectPublishJobs',LEGACY='socialProviderJobs',SCAN_INTERVAL=600000,sha=value=>createHash('sha256').update(value).digest('hex');
  const directId=(name,channel,job)=>sha(JSON.stringify([name,channel?.id,job?.idempotencyKey||job?.id])),legacyKey=(channel,job)=>sha(String(channel?.id)+':'+(job?.idempotencyKey||job?.id));
  let foreign=new Map(),scannedAt=null;
  function foreignIndex(){const at=Date.parse(now());if(scannedAt!==null&&at-scannedAt<SCAN_INTERVAL)return foreign;foreign=new Map();for(const kind of [LEGACY,DIRECT])for(const row of store.all(kind))if(row?.jobId&&row.id)foreign.set(row.jobId,{kind,id:row.id});scannedAt=at;return foreign;}
  function receipt(kind,id,job){const row=store.get(kind,id);return row&&row.jobId===job.id?{kind,row}:null;}
  function existingLedger({channel,job}={}){if(!job?.id)return null;const hit=()=>{const known=foreignIndex().get(job.id);return known?receipt(known.kind,known.id,job):null;};
    const found=receipt(DIRECT,directId('meta-direct',channel,job),job)||receipt(DIRECT,directId('youtube-direct',channel,job),job)||receipt(LEGACY,legacyKey(channel,job),job)||hit();
    return found?{...found,adapter:found.kind===LEGACY?legacy:found.row.provider==='youtube-direct'?youtube:direct}:null;}
  const existingProvider=input=>existingLedger(input)?.adapter||null;
  function preflight(input){return supported(input.channel)?adapter(input.channel).preflight(input):legacy.preflight(input);}
  async function publish(input){const found=existingLedger(input),existing=found?.adapter||null,unsentLegacy=existing===legacy&&found.row.status==='failed'&&found.row.definitive===true&&!found.row.providerId&&supported(input.channel);if(existing&&!unsentLegacy&&(existing===legacy||existing!==adapter(input.channel)))return existing.status(input);if(supported(input.channel))assertUnique(input.channel);return supported(input.channel)?adapter(input.channel).publish(input):{provider:'manual',status:'manual_required',message:capability(input.channel).reason,retryable:false,publicVerified:false};}
  async function status(input){const selected=existingProvider(input);if(selected)return selected.status(input);
    // Direct adapters write their ledger row before any write request, so a missing row proves nothing was sent.
    if(supported(input.channel))return {provider:providerName(input.channel),status:'not_found',errorCode:'NOT_SUBMITTED',message:'전송 기록이 없어 공개 게시 요청을 보내지 않은 것으로 확인했어요. 다시 예약할 수 있어요.',retryable:true,definitive:true,publicVerified:false};
    return {provider:'manual',status:'uncertain',errorCode:'SUBMISSION_NOT_FOUND',message:'전송 기록이 없어서 다시 보내지 않았어요. SNS에서 실제 게시 여부를 확인해 주세요.',retryable:false,publicVerified:false};}
  async function reconcile(user,input={},context={}){const job=store.get('socialPublishJobs',input.jobId);authorized(user,job?.channelId,context);if(existingLedger({channel:{id:job.channelId},job})?.adapter===legacy)return legacy.reconcile(user,input,context);throw fail('DIRECT_RECONCILE_REQUIRED','직접 게시 작업은 결과 다시 확인 또는 실제 게시 주소 확인을 이용해 주세요.');}
  function scanHealthDue({signal}={}){if(stopped||healthRun)return healthRun||Promise.resolve({checked:0});controller=new AbortController();const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;healthRun=(async()=>{let checked=0,failed=0;for(const link of store.all(LINKS)){if(stopped||combined.aborted||checked>=5)break;const channel=store.get('channels',link.channelId),actor=store.get('users',link.updatedBy),last=store.get(HEALTH,link.channelId);if(!link.enabled||!channel||channel.hidden||channel.active===false||!actor?.active||!canManageOwners(actor,channel)||Date.parse(last?.lastAttemptAt||0)>Date.parse(now())-3600000)continue;try{if(!await inspect(actor,channel,{signal:combined}))failed++;checked++;}catch{failed++;}}return {checked,failed};})().finally(()=>{healthRun=null;controller=null;});return healthRun;}
  function requestBudgetSnapshot(user){const rows=visible(user).map(c=>store.get('socialDirectPublishRequests',c.platform==='youtube'?'youtube-direct:'+c.id:c.id)||{});return {times:rows.flatMap(r=>r.times||[]).sort((a,b)=>a-b),retryAfter:Math.max(0,...rows.map(r=>r.retryAt||0))};}
  async function stopHealth(){stopped=true;controller?.abort();await healthRun;await legacy.stopHealth?.();}
  return {assertUnique,requestBudgetSnapshot,settings,configure,connect,disconnect,refresh,capability,preflight,publish,status,reconcile,health,checkHealth,scanHealthDue,stopHealth,waitForHealthIdle:()=>healthRun||Promise.resolve()};
}
