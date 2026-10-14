import {createProviderHealth} from './social-provider-health.mjs';
import {createHash, randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {isPublicLinkAddress} from './publication-link-probe.mjs';
import {canReadChannel} from './organization.mjs';

// Contract checked against Postiz's public API on 2026-10-13. No Postiz source
// is embedded here. The API key is a workspace credential, not an SNS token.
// https://docs.postiz.com/public-api/{integrations/list,posts/create,posts/list}
const CLOUD='https://api.postiz.com/public/v1', CONFIG='social:postiz', HOUR=3600000;
const MAX_BYTES=100*1024*1024, MAX_IMAGE_BYTES=10*1000*1000, MAX_RESPONSE=2*1024*1024;
const MEDIA_TYPES=['image/jpeg','image/png','image/gif','image/webp','video/mp4'];
const clean=(value,max=200)=>typeof value==='string'?value.trim().slice(0,max):'';
const identifier=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(value)?value:null;
const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const fail=(code,message,status=400,extra={})=>Object.assign(new Error(message),{code,status,providerSafe:true,...extra});
const admin=user=>{if(!user||user.active===false||user.role!=='admin')throw fail('ADMIN_REQUIRED','발행 연결은 관리자만 바꿀 수 있어요.',403);};
const PLATFORM={
  youtube:{formats:['video','shorts','youtube-video','youtube-shorts'],maxTextLength:5000,maxMediaCount:1,options:['privacy','madeForKids','coverUrl','hashtags']},
  instagram:{formats:['image','carousel','reel','story','instagram-reels','feed'],maxTextLength:2200,maxMediaCount:10,options:['firstComment','hashtags','altText','thumbnailTimestamp']},
  facebook:{formats:['text','image','carousel','video','feed','story'],maxTextLength:63206,maxMediaCount:10,options:['firstComment','hashtags','altText','link']},
  threads:{formats:['text','image','carousel','video','feed'],maxTextLength:500,maxMediaCount:10,options:['firstComment','hashtags','altText']},
  x:{formats:['text','image','carousel','video','feed'],maxTextLength:280,maxMediaCount:4,options:['firstComment','hashtags','altText','whoCanReply','madeWithAi','paidPartnership']},
  linkedin:{formats:['text','image','carousel','video','feed'],maxTextLength:3000,maxMediaCount:20,options:['firstComment','hashtags','altText']},
  bluesky:{formats:['text','image','carousel','video','feed'],maxTextLength:300,maxMediaCount:4,options:['firstComment','hashtags','altText']},
  pinterest:{formats:['image','carousel'],maxTextLength:500,maxMediaCount:5,options:['hashtags','altText','board','link']},
  vk:{formats:['text','image','carousel','video','feed'],maxTextLength:2048,maxMediaCount:10,options:['firstComment','hashtags','altText']},
  tiktok:{formats:['video','carousel'],maxTextLength:2000,maxMediaCount:35,options:[],manualReason:'TikTok은 크리에이터마다 공개 범위와 동의를 확인해야 해서 수동으로 마무리해요.'},
};
const platformOf=value=>({'instagram-standalone':'instagram','linkedin-page':'linkedin',twitter:'x'}[value]||value);
const platform=value=>{const spec=PLATFORM[platformOf(value)]||{formats:['text','image','video','carousel'],maxTextLength:null,maxMediaCount:20,options:[],manualReason:'이 플랫폼은 아직 자동 발행을 지원하지 않아요.'};return {...spec,formats:[...spec.formats,'post']};};
const profile=value=>clean(value,300).replace(/^https?:\/\/(?:www\.)?[^/]+\//i,'').replace(/^@/,'').replace(/\/+$/,'').toLowerCase();
function baseUrl(value){
  let url;try{url=new URL(value);}catch{throw fail('INVALID_BASE_URL','Postiz API 주소를 확인해 주세요.');}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||url.protocol!=='https:'&&!(local&&url.protocol==='http:')||!/^\/(?:api\/)?public\/v1\/?$/.test(url.pathname))throw fail('INVALID_BASE_URL','Postiz public/v1 API의 HTTPS 주소만 쓸 수 있어요.');
  return url.href.replace(/\/$/,'');
}
function publicUrl(value){
  if(typeof value!=='string'||value.length>4096||/[\u0000-\u0020\\]/u.test(value))throw fail('INVALID_MEDIA_URL','인증 정보가 없는 공개 HTTPS 주소를 입력해 주세요.');
  let url;try{url=new URL(value);}catch{throw fail('INVALID_MEDIA_URL','공개 HTTPS 주소를 확인해 주세요.');}
  const host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash||host==='localhost'||host.endsWith('.localhost')||/(?:^|\.)(?:local|internal|lan|home)$/.test(host)||isIP(host)&&!isPublicLinkAddress(host))throw fail('INVALID_MEDIA_URL','외부에서 열 수 있는 HTTPS 주소만 쓸 수 있어요.');
  return url.href;
}
const safeUrl=value=>{try{return publicUrl(value);}catch{return null;}};
const mimeOf=bytes=>{
  if(bytes.length>=12&&bytes.subarray(4,8).toString()==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V ','dash','msnv'].includes(bytes.subarray(8,12).toString()))return 'video/mp4';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()))return 'image/gif';
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';
  return null;
};
const mediaType=media=>String(media?.mimeType||media?.type||'image').split('/')[0];
function validateMedia(media){
  if(!media||typeof media!=='object'||!['image','video'].includes(mediaType(media)))throw fail('UNSUPPORTED_MEDIA','자동 발행은 이미지나 MP4 동영상만 할 수 있어요.');
  let extension='';try{extension=new URL(media.url).pathname.toLowerCase().split('.').at(-1);}catch{}
  if(media.mimeType==='video/webm'||extension==='webm')throw fail('MEDIA_CONVERSION_REQUIRED','Postiz는 WebM을 지원하지 않아요. MP4로 바꾼 파일을 선택해 주세요.');
  if(media.mimeType&&!MEDIA_TYPES.includes(media.mimeType))throw fail('UNSUPPORTED_MEDIA','이 연결은 JPEG·PNG·GIF·WebP 이미지와 MP4 동영상만 지원해요.');
  if(media.mimeType&&media.type&&mediaType({type:media.type})!==mediaType({mimeType:media.mimeType}))throw fail('MEDIA_TYPE_MISMATCH','선택한 게시 형식과 실제 미디어 종류가 달라요.');
  const size=media.byteSize??media.sizeBytes;if(size!==undefined&&(!Number.isFinite(size)||size<=0||size>(mediaType(media)==='image'?MAX_IMAGE_BYTES:MAX_BYTES)))throw fail('MEDIA_TOO_LARGE',mediaType(media)==='image'?'이미지는 파일당 10MB 이하로 준비해 주세요.':'이 연결의 동영상은 파일당 100MiB 이하로 준비해 주세요.');
}
const responseResult=(status,message,extra={})=>({provider:'postiz',status,message,retryable:false,definitive:status==='failed',publicVerified:false,...extra});
const errorResult=(error,uncertain=false)=>responseResult(uncertain?'uncertain':'failed',error?.providerSafe===true?error.message:'발행을 준비하다 문제가 생겼어요. 미디어 접근 권한과 연결을 확인해 주세요.',{errorCode:error?.providerSafe===true?error.code:'PROVIDER_ERROR',retryable:!uncertain&&error?.retryable===true,nextRetryAt:error?.nextRetryAt||null});

export function createSocialProvider({store,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),resolveMedia,authorizePublish,allowedBaseUrls=[]}={}){
  if(!store)throw new TypeError('store is required');
  const allowed=new Set([CLOUD,...allowedBaseUrls.map(baseUrl)]), inFlight=new Map(), mediaInFlight=new Map(), listCache=new Map();
  const time=()=>new Date(clock()).toISOString();
  const config=()=>store.get('socialProviderSettings','postiz');
  const credentials=()=>store.secret(CONFIG);
  const connection=channel=>store.get('socialConnections',channel.id);
  const transaction=fn=>typeof store.transaction==='function'?store.transaction(fn):fn();
  const authorize=(user,context)=>{admin(user);context?.authorize?.();const live=store.get('users',user.id);if(live&&(live.active===false||live.role!=='admin'))throw fail('ADMIN_REQUIRED','현재 관리자 권한을 확인해 주세요.',403);};
  function assertEndpoint(value){const result=baseUrl(value);if(!allowed.has(result))throw fail('BASE_URL_NOT_ALLOWED','이 API 주소는 서버 관리자가 허용한 Postiz 주소가 아니에요.');return result;}
  function configured(){const c=config(),secret=credentials();if(!c?.enabled||!secret?.apiKey||secret.version!==c.version)throw fail('NOT_CONFIGURED','Postiz 발행 연결을 먼저 설정해 주세요.',409);assertEndpoint(c.baseUrl);return {...c,apiKey:secret.apiKey};}
  function requestBudget(){
    const now=Date.parse(time());transaction(()=>{const row=store.get('socialProviderRequests','postiz')||{},recent=(row.times||[]).filter(at=>Number.isFinite(at)&&at>now-HOUR);
      if(row.retryAfter>now||recent.length>=30)throw fail('PROVIDER_RATE_LIMIT','Postiz API 호출 한도를 다 썼어요. 표시된 시각이 지나면 다시 확인해요.',429,{retryable:true,nextRetryAt:new Date(Math.max(row.retryAfter||0,(recent[0]||now)+HOUR+1000)).toISOString()});
      store.put('socialProviderRequests','postiz',{times:[...recent,now],retryAfter:row.retryAfter||null});});
  }
  async function request(cfg,path,{method='GET',json,form,signal}={}){
    assertEndpoint(cfg.baseUrl);if(signal?.aborted)throw fail('REQUEST_CANCELLED','연결 요청이 취소됐어요.',409,{retryable:true});
    requestBudget();const timeout=AbortSignal.timeout(form?120000:30000),joined=signal?AbortSignal.any([signal,timeout]):timeout;
    let response;try{response=await fetchImpl(cfg.baseUrl+path,{method,redirect:'error',headers:{Authorization:cfg.apiKey,Accept:'application/json',...(json!==undefined?{'Content-Type':'application/json'}:{})},body:form||(json!==undefined?JSON.stringify(json):undefined),signal:joined});}
    catch{throw fail('PROVIDER_NETWORK','Postiz 응답을 받지 못했어요. 요청이 처리됐는지 먼저 확인해 주세요.',502,{uncertain:method==='POST',retryable:method==='GET'});}
    const status=Number(response.status);
    if(status===401||status===403)throw fail('PROVIDER_AUTH','Postiz 인증 또는 발행 권한을 다시 연결해 주세요.',409);
    if(status===429){const now=Date.parse(time()),raw=response.headers?.get?.('retry-after'),seconds=Number(raw),retry=raw&&Number.isFinite(seconds)?now+seconds*1000:Date.parse(raw||'');const next=Math.max(now+60000,Number.isFinite(retry)?retry:now+HOUR);const row=store.get('socialProviderRequests','postiz')||{};store.put('socialProviderRequests','postiz',{...row,retryAfter:next});throw fail('PROVIDER_RATE_LIMIT','Postiz 호출 한도에 걸려 요청이 거절됐어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true,nextRetryAt:new Date(next).toISOString()});}
    if(status>=500)throw fail('PROVIDER_UNAVAILABLE','Postiz 서버 응답이 분명하지 않아요. 게시 결과를 먼저 확인해 주세요.',502,{uncertain:method==='POST',retryable:method==='GET'});
    if(status<200||status>=300)throw fail('PROVIDER_REJECTED','Postiz가 요청을 거절했어요. 계정·게시 형식·옵션을 확인해 주세요.',400);
    try{
      if(Number(response.headers?.get?.('content-length')||0)>MAX_RESPONSE)throw new Error();
      const body=await response.text();if(Buffer.byteLength(body)>MAX_RESPONSE)throw new Error();return JSON.parse(body);
    }catch{throw fail('INVALID_PROVIDER_RESPONSE','Postiz 응답을 읽지 못했어요.',502,{uncertain:method==='POST'});}
  }
  function parseIntegrations(rows){
    if(!Array.isArray(rows)||rows.length>1000)throw fail('INVALID_PROVIDER_RESPONSE','Postiz 계정 목록 응답을 읽지 못했어요.',502);
    return rows.map(row=>{if(!identifier(row?.id)||!identifier(row.identifier)||typeof row.disabled!=='boolean')throw fail('INVALID_PROVIDER_RESPONSE','Postiz 계정 정보 일부가 빠져 있어요.',502);
      return {id:row.id,name:clean(row.name,160),identifier:row.identifier,platform:platformOf(row.identifier),profile:clean(row.profile,300),picture:safeUrl(row.picture),disabled:row.disabled,customer:row.customer?.id?{id:clean(row.customer.id,160),name:clean(row.customer.name,160)}:null};});
  }
  function settings(user){const row=config(),isAdmin=user?.active!==false&&user?.role==='admin',visible=new Set(store.all('channels').filter(channel=>user&&canReadChannel(user,channel)).map(channel=>channel.id)),mapped=new Set(store.all('socialConnections').filter(link=>visible.has(link.channelId)).map(link=>link.integrationId));return {provider:'postiz',configured:!!row?.enabled,enabled:row?.enabled===true,...(isAdmin?{baseUrl:row?.baseUrl||CLOUD,organization:row?.organization||null,allowedBaseUrls:[...allowed]}:{}),checkedAt:row?.checkedAt||null,integrations:(row?.integrations||[]).filter(link=>isAdmin||mapped.has(link.id)),rateLimit:{requests:30,periodSeconds:3600,source:'synk-local-conservative-budget'}};}
  async function configure(user,input={},context={}){
    authorize(user,context);if(input.enabled===false){const old=config();if(old)store.put('socialProviderSettings','postiz',{...old,enabled:false,updatedAt:time(),updatedBy:user.id});return settings(user);}
    const old=config(),apiKey=typeof input.apiKey==='string'?input.apiKey.trim():credentials()?.apiKey;
    if(!apiKey||apiKey.length>16000||/[\r\n]/.test(apiKey))throw fail('API_KEY_REQUIRED','Postiz API 키를 입력해 주세요.');
    const endpoint=assertEndpoint(input.baseUrl||old?.baseUrl||CLOUD),candidate={baseUrl:endpoint,apiKey};
    const me=await request(candidate,'/me');if(!identifier(me?.organization?.id))throw fail('INVALID_PROVIDER_RESPONSE','Postiz 워크스페이스를 확인하지 못했어요.',502);
    const integrations=parseIntegrations(await request(candidate,'/integrations')),version=randomUUID(),at=time();
    authorize(user,context);
    if((config()?.version||null)!==(old?.version||null))throw fail('CONFIG_CHANGED','다른 관리자가 연결을 바꿨어요. 새 상태를 확인해 주세요.',409);
    transaction(()=>{store.setSecret(CONFIG,{apiKey,version});store.put('socialProviderSettings','postiz',{enabled:true,version,baseUrl:endpoint,organization:{id:me.organization.id,name:clean(me.organization.name,160)},integrations,checkedAt:at,updatedAt:at,updatedBy:user.id});});
    listCache.clear();return settings(user);
  }
  async function refresh(user,_input={},context={}){authorize(user,context);const cfg=configured(),integrations=parseIntegrations(await request(cfg,'/integrations'));authorize(user,context);if(config()?.version!==cfg.version)throw fail('CONFIG_CHANGED','발행 연결이 바뀌었어요. 새 상태를 확인해 주세요.',409);store.put('socialProviderSettings','postiz',{...config(),integrations,checkedAt:time()});return settings(user);}
  async function connect(user,input={},context={}){
    authorize(user,context);const channel=store.get('channels',input.channelId);if(!channel||channel.active===false)throw fail('CHANNEL_NOT_FOUND','사용할 수 있는 채널을 선택해 주세요.',404);
    const state=await refresh(user,{},context),row=state.integrations.find(item=>item.id===input.integrationId);authorize(user,context);
    if(!row||row.disabled)throw fail('INTEGRATION_UNAVAILABLE','현재 연결된 Postiz 계정을 선택해 주세요.',409);
    if(row.platform!==platformOf(channel.platform))throw fail('INTEGRATION_PLATFORM_MISMATCH','SYNK 채널과 Postiz 계정의 SNS 종류가 달라요. 같은 SNS의 계정을 선택해 주세요.',409);
    if((!profile(channel.handle)||profile(channel.handle)!==profile(row.profile))&&clean(input.confirmedProfile,300)!==row.profile)throw fail('ACCOUNT_CONFIRMATION_REQUIRED','실제 Postiz 계정의 프로필 이름을 확인해서 입력해 주세요.',409);
    const existing=store.all('socialConnections').find(item=>item.channelId!==channel.id&&item.integrationId===row.id&&item.status==='connected'&&item.configVersion===config().version);if(existing)throw fail('INTEGRATION_ALREADY_MAPPED','이 Postiz 계정은 이미 다른 SYNK 채널에 연결돼 있어요.',409);
    const live=store.get('channels',channel.id);if(!live||live.active===false||(live.connectionVersion||0)!==(channel.connectionVersion||0))throw fail('CHANNEL_CHANGED','채널 담당이나 연결이 바뀌었어요. 새 상태를 확인해 주세요.',409);
    const version=(channel.connectionVersion||0)+1;
    return transaction(()=>{store.put('channels',channel.id,{...live,connectionVersion:version});return store.put('socialConnections',channel.id,{provider:'postiz',channelId:channel.id,integrationId:row.id,identifier:row.identifier,profile:row.profile,name:row.name,configVersion:config().version,channelConnectionVersion:version,status:'connected',connectedBy:user.id,checkedAt:state.checkedAt});});
  }
  function disconnect(user,input={},context={}){authorize(user,context);const row=store.get('socialConnections',input.channelId),channel=store.get('channels',input.channelId);if(row)transaction(()=>{store.put('socialConnections',input.channelId,{...row,status:'disconnected',disconnectedAt:time(),disconnectedBy:user.id});if(channel)store.put('channels',channel.id,{...channel,connectionVersion:(channel.connectionVersion||0)+1});});return {channelId:input.channelId,disconnected:true};}
  function capability(channel){
    const spec=platform(channel.platform),cfg=config(),link=connection(channel),row=cfg?.integrations?.find(item=>item.id===link?.integrationId);
    const automatic=channel.active!==false&&cfg?.enabled&&link?.status==='connected'&&link.configVersion===cfg.version&&link.channelConnectionVersion===(channel.connectionVersion||0)&&row&&!row.disabled&&row.identifier===link.identifier&&row.profile===link.profile&&row.platform===platformOf(channel.platform)&&!spec.manualReason;
    const reason=channel.active===false?'보관한 채널이에요.':spec.manualReason||(!cfg?.enabled?'발행 서비스를 아직 연결하지 않았어요. 수동으로 게시할 수 있어요.':!automatic?'이 계정의 발행 연결을 확인하거나 다시 연결해 주세요.':'Postiz 계정 목록에서 이 계정을 확인했어요. SNS 권한과 형식은 발행할 때 다시 검사해요.');
    const name=platformOf(channel.platform),mediaTypes=MEDIA_TYPES.filter(type=>name==='youtube'?type==='video/mp4':name==='pinterest'?type.startsWith('image/'):true);
    const formatRules=Object.fromEntries(spec.formats.map(format=>[format,{minMediaCount:format==='text'?0:format==='carousel'?2:['image','video','shorts','youtube-video','youtube-shorts','reel','instagram-reels','story'].includes(format)||['youtube','instagram','pinterest'].includes(name)?1:0,maxMediaCount:format==='text'?0:['image','video','shorts','youtube-video','youtube-shorts','reel','instagram-reels'].includes(format)||name==='instagram'&&format==='story'?1:spec.maxMediaCount,mediaKind:format==='text'?'none':['image','carousel'].includes(format)||name==='instagram'&&format==='story'?'image':['video','shorts','youtube-video','youtube-shorts','reel','instagram-reels'].includes(format)||name==='youtube'?'video':'image-or-one-video'}]));
    if(name==='youtube')for(const format of ['shorts','youtube-shorts'])Object.assign(formatRules[format],{maxDurationSeconds:180,maxAspectRatio:1,requiresMediaMetadata:true});
    return {provider:automatic?'postiz':'manual',mode:channel.active===false?'unavailable':automatic?'automatic':'manual',canPublish:!!automatic,...structuredClone(spec),mediaTypes,maxImageBytes:MAX_IMAGE_BYTES,maxVideoBytes:MAX_BYTES,formatRules,requiredOptions:name==='youtube'?['privacy','madeForKids']:name==='pinterest'?['board']:[],reason,connection:link?{status:automatic?'connected':link.status==='disconnected'?'disconnected':'needs_check',integrationId:link.integrationId,profile:link.profile,name:link.name,checkedAt:cfg?.checkedAt||link.checkedAt}:null};
  }
  async function uploadMedia({bytes,fileName='media',mimeType,signal}={}){
    if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>MAX_BYTES)throw fail('INVALID_MEDIA','미디어 파일은 100MiB 이하로 준비해 주세요.');
    if(mimeType==='video/webm')throw fail('MEDIA_CONVERSION_REQUIRED','Postiz는 WebM을 지원하지 않아요. MP4로 바꾼 파일을 선택해 주세요.');
    const data=Buffer.from(bytes),detected=mimeOf(data);if(!detected||mimeType&&mimeType!==detected)throw fail('UNSUPPORTED_MEDIA','JPEG·PNG·GIF·WebP 이미지나 MP4 동영상만 보낼 수 있어요.');
    validateMedia({mimeType:detected,byteSize:data.byteLength});
    const cfg=configured(),key=digest(cfg.version+':'+digest(data)),cached=store.get('socialProviderMedia',key);
    if(cached&&Date.parse(time())-Date.parse(cached.uploadedAt)<86400000)return cached.asset;
    if(mediaInFlight.has(key))return mediaInFlight.get(key);
    const work=(async()=>{const form=new FormData();form.append('file',new Blob([data],{type:detected}),clean(fileName,160).replace(/[^\p{L}\p{N}._ -]/gu,'_')||'media');
      const result=await request(cfg,'/upload',{method:'POST',form,signal});if(!identifier(result?.id)||!safeUrl(result.path))throw fail('INVALID_UPLOAD_RESPONSE','미디어 업로드 결과를 확인하지 못했어요.',502);
      const asset={id:result.id,url:result.path,path:result.path,provider:'postiz',mimeType:detected,configVersion:cfg.version};store.put('socialProviderMedia',key,{id:key,asset,uploadedAt:time()});return asset;
    })();mediaInFlight.set(key,work);try{return await work;}finally{mediaInFlight.delete(key);}
  }
  function validate({channel,post,variant}){
    const spec=platform(channel.platform),options=variant.options||{},format=variant.format||'text',media=variant.media||post.media||[],text=String(variant.text??post.body??''),hashtags=options.hashtags;
    if(!spec.formats.includes(format))throw fail('FORMAT_MANUAL_REQUIRED','선택한 게시 형식은 이 연결에서 수동으로 마무리해야 해요.');
    if(!Array.isArray(media)||media.length>spec.maxMediaCount)throw fail('INVALID_MEDIA_COUNT','선택한 형식의 첨부 개수를 확인해 주세요.');
    for(const item of media)validateMedia(item);
    if(!options||typeof options!=='object'||Array.isArray(options))throw fail('INVALID_OPTIONS','채널 옵션을 확인해 주세요.');
    const unsupported=Object.keys(options).filter(key=>key!=='notifyOnly'&&!spec.options.includes(key)&&options[key]!==''&&options[key]!==null&&options[key]!==undefined&&options[key]!==false&&!(Array.isArray(options[key])&&!options[key].length));
    if(unsupported.length)throw fail('OPTIONS_MANUAL_REQUIRED','선택한 채널 옵션은 이 발행 연결에서 직접 확인해야 해요.');
    for(const key of ['firstComment','altText','coverUrl','privacy','board','link','whoCanReply'])if(options[key]!==undefined&&options[key]!==null&&typeof options[key]!=='string')throw fail('INVALID_OPTIONS','채널 옵션의 입력 형식을 확인해 주세요.');
    for(const key of ['madeForKids','madeWithAi','paidPartnership'])if(options[key]!==undefined&&typeof options[key]!=='boolean')throw fail('INVALID_OPTIONS','공개·AI·광고 표시는 예 또는 아니요로 선택해 주세요.');
    if(hashtags!==undefined&&!Array.isArray(hashtags)&&typeof hashtags!=='string')throw fail('INVALID_HASHTAGS','해시태그 형식을 확인해 주세요.');
    const suffix=Array.isArray(hashtags)?hashtags.map(item=>clean(String(item),100)).filter(Boolean).join(' '):clean(hashtags,2000),content=text+(suffix?'\n\n'+suffix:'');
    if(spec.maxTextLength&&[...content].length>spec.maxTextLength)throw fail('TEXT_TOO_LONG',`게시문은 ${spec.maxTextLength}자 이내로 입력해 주세요.`);
    if(!content.trim()&&!media.length)throw fail('EMPTY_POST','게시문 또는 미디어를 입력해 주세요.');
    const name=platformOf(channel.platform),videos=media.filter(row=>mediaType(row)==='video');
    if(format==='text'&&media.length||format==='image'&&(media.length!==1||videos.length)||format==='carousel'&&(media.length<2||videos.length)||['video','shorts','youtube-video','youtube-shorts','reel','instagram-reels'].includes(format)&&(media.length!==1||videos.length!==1))throw fail('FORMAT_MEDIA_MISMATCH','글은 첨부 없이, 이미지는 한 장, 캐러셀은 이미지 두 장 이상, 동영상 형식은 MP4 하나를 선택해 주세요.');
    if(name==='youtube'&&(media.length!==1||videos.length!==1))throw fail('YOUTUBE_VIDEO_REQUIRED','YouTube에는 MP4 동영상 하나가 필요해요.');
    if(['instagram','pinterest'].includes(name)&&!media.length)throw fail('MEDIA_REQUIRED','이 SNS에는 미디어를 첨부해야 해요.');
    if(['x','bluesky','linkedin','facebook','threads'].includes(name)&&videos.length&&(videos.length!==1||media.length!==1))throw fail('MIXED_MEDIA','동영상 하나 또는 이미지만 선택해 주세요.');
    if(name==='instagram'&&videos.length&&(videos.length!==1||media.length!==1))throw fail('MIXED_MEDIA','이 Instagram 연결은 동영상 하나나 이미지 묶음만 지원해요.');
    if(name==='pinterest'&&videos.length)throw fail('FORMAT_MANUAL_REQUIRED','Pinterest 동영상은 표지를 포함해 앱에서 마무리해 주세요.');
    if(name==='instagram'&&(['reel','instagram-reels'].includes(format)?media.length!==1||videos.length!==1:format==='story'?media.length!==1||videos.length!==0:format==='carousel'?media.length<2||videos.length>0:false))throw fail('INVALID_INSTAGRAM_MEDIA','릴스는 동영상 하나, 스토리는 이미지 하나, 캐러셀은 이미지 두 개 이상을 선택해 주세요.');
    if(name==='linkedin'&&format==='carousel'&&(media.length<2||videos.length))throw fail('INVALID_CAROUSEL','LinkedIn 캐러셀에는 이미지가 두 개 이상 필요해요.');
    if(options.firstComment&&[...String(options.firstComment)].length>spec.maxTextLength)throw fail('COMMENT_TOO_LONG','첫 댓글이 채널 글자 수 제한을 넘었어요.');
    if(format==='story'&&(options.firstComment||options.link))throw fail('OPTIONS_MANUAL_REQUIRED','스토리의 댓글·링크 옵션은 SNS 앱에서 직접 확인해 주세요.');
    const settings={__type:connection(channel)?.identifier||name};
    if(name==='youtube'){
      const title=String(variant.title||post.title||'');if(title.length<2||title.length>100)throw fail('YOUTUBE_TITLE_REQUIRED','YouTube 제목은 2~100자로 입력해 주세요.');
      if(!['public','unlisted','private'].includes(options.privacy)||typeof options.madeForKids!=='boolean')throw fail('YOUTUBE_DECLARATION_REQUIRED','YouTube 공개 범위와 아동용 여부를 직접 선택해 주세요.');
      // YouTube classifies Shorts from the video itself; Postiz has no force-Shorts setting.
      // https://support.google.com/youtube/answer/15424877
      if(['shorts','youtube-shorts'].includes(format)){
        const video=media[0],duration=video.durationSeconds??video.duration;
        if(!Number.isFinite(video.width)||!Number.isFinite(video.height)||!Number.isFinite(duration)||video.width<=0||video.height<=0||duration<=0)throw fail('SHORTS_METADATA_REQUIRED','Shorts는 크기와 길이가 확인된 동영상을 선택해 주세요.');
        if(video.width>video.height||duration>180)throw fail('SHORTS_DIMENSIONS_INVALID','YouTube Shorts는 정사각형이나 세로 영상이고, 길이가 3분 이하여야 해요.');
      }
      Object.assign(settings,{title,type:options.privacy,selfDeclaredMadeForKids:options.madeForKids?'yes':'no'});
    }
    if(name==='instagram')settings.post_type=format==='story'?'story':'post';
    if(name==='facebook'){settings.post_type=format==='story'?'story':'post';if(format==='story'&&!media.length)throw fail('MEDIA_REQUIRED','스토리에는 미디어가 필요해요.');if(options.link)settings.url=publicUrl(options.link);}
    if(name==='linkedin')settings.post_as_images_carousel=format==='carousel';
    if(name==='x'){settings.who_can_reply_post=options.whoCanReply||'everyone';if(!['everyone','following','mentionedUsers','subscribers','verified'].includes(settings.who_can_reply_post))throw fail('INVALID_REPLY_OPTION','답글 범위를 확인해 주세요.');if(options.madeWithAi!==undefined)settings.made_with_ai=!!options.madeWithAi;if(options.paidPartnership!==undefined)settings.paid_partnership=!!options.paidPartnership;}
    if(name==='pinterest'){if(!identifier(options.board))throw fail('PINTEREST_BOARD_REQUIRED','Pinterest 보드를 선택해 주세요.');settings.board=options.board;settings.title=clean(variant.title||post.title,100);if(options.link)settings.link=publicUrl(options.link);}
    if(options.thumbnailTimestamp!==undefined&&(!Number.isInteger(options.thumbnailTimestamp)||options.thumbnailTimestamp<0||!videos.length||(videos[0].durationSeconds??videos[0].duration)>0&&options.thumbnailTimestamp>=(videos[0].durationSeconds??videos[0].duration)*1000))throw fail('INVALID_COVER','동영상 길이 안의 표지 시각(밀리초)을 선택해 주세요.');
    if(options.coverUrl)publicUrl(options.coverUrl);
    return {media,content,settings,options};
  }
  function preflight(input){
    try{validate(input);return {valid:true,errors:[],warnings:[]};}
    catch(error){return {valid:false,errors:[{code:error.providerSafe?error.code:'INVALID_POST',message:error.providerSafe?error.message:'게시 형식과 파일 정보를 확인해 주세요.'}],warnings:[]};}
  }
  const ledgerId=(channel,job)=>digest(channel.id+':'+(job.idempotencyKey||job.id));
  const resultFor=row=>responseResult(row.status==='submitting'||row.status==='preparing'?'uncertain':row.status,row.message||'게시 결과를 확인해야 해요.',{providerId:row.providerId||null,requestId:row.requestId,url:row.url||null,publishedAt:row.publishedAt||null,observedAt:row.observedAt||null,errorCode:row.errorCode||null,retryable:row.retryable===true,definitive:row.definitive===true,nextRetryAt:row.nextRetryAt||null});
  function saveResult(id,result,claimToken,expectedStatus){return transaction(()=>{const row=store.get('socialProviderJobs',id);if(claimToken&&row.claimToken!==claimToken||expectedStatus&&row.status!==expectedStatus)return resultFor(row);store.put('socialProviderJobs',id,{...row,...result,updatedAt:time()});return resultFor(store.get('socialProviderJobs',id));});}
  async function publish(input){
    const {channel,post,variant,job,signal}=input;if(!channel?.id||!job?.id)throw fail('JOB_REQUIRED','예약 작업 정보가 필요해요.');
    const id=ledgerId(channel,job);if(inFlight.has(id))return inFlight.get(id);
    const work=(async()=>{
      const old=store.get('socialProviderJobs',id);
      if(old&&['submitting','uncertain','submitted','processing','published'].includes(old.status))return resultFor(old);
      if(old?.status==='failed'&&(!old.definitive||(Number(job.attempts)||0)<=(old.attemptNumber||0)))return resultFor(old);
      if(old?.status==='preparing'&&Date.parse(old.updatedAt)>Date.parse(time())-5*60000)return responseResult('processing','미디어와 발행 요청을 준비하고 있어요.',{requestId:old.requestId});
      const cap=capability(channel);if(!cap.canPublish)return {provider:'manual',status:'manual_required',message:cap.reason,retryable:false,publicVerified:false};
      let prepared,cfg;try{prepared=validate(input);cfg=configured();}catch(error){if(['FORMAT_MANUAL_REQUIRED','OPTIONS_MANUAL_REQUIRED'].includes(error.code))return {...errorResult(error),status:'manual_required',provider:'manual'};return errorResult(error);}
      const link=connection(channel),fingerprint=digest(canonical({postId:post.id,contentVersion:job.contentVersion,variant}));
      if(old?.fingerprint&&old.fingerprint!==fingerprint)return errorResult(fail('JOB_CONTENT_CHANGED','이미 전송한 예약의 내용이 바뀌었어요. 검토와 예약을 새로 만들어 주세요.',409));
      const initial={id,jobId:job.id,idempotencyKey:job.idempotencyKey||null,attemptNumber:Number(job.attempts)||0,claimToken:randomUUID(),channelId:channel.id,integrationId:link.integrationId,configVersion:cfg.version,fingerprint,content:prepared.content,requestId:old?.requestId||randomUUID(),createdAt:old?.createdAt||time(),updatedAt:time(),status:'preparing',retryable:false};
      // Reserve synchronously before the first await. Across workers SQLite's
      // transaction gives one preparer; no in-memory lock alone owns a send.
      const won=transaction(()=>{const live=store.get('socialProviderJobs',id);if(live&&(live.claimToken!==old?.claimToken||live.updatedAt!==old?.updatedAt||live.status!==old?.status))return false;store.put('socialProviderJobs',id,initial);return true;});
      if(!won)return resultFor(store.get('socialProviderJobs',id));
      const finish=result=>saveResult(id,result,initial.claimToken);
      try{
        await authorizePublish?.(input);
        if(Date.parse(time())-Date.parse(cfg.checkedAt)>60000){const integrations=parseIntegrations(await request(cfg,'/integrations',{signal}));if(config()?.version!==cfg.version)throw fail('CONFIG_CHANGED','발행 연결이 바뀌었어요. 새 상태를 확인해 주세요.',409);store.put('socialProviderSettings','postiz',{...config(),integrations,checkedAt:time()});}
        if(!capability(store.get('channels',channel.id)||channel).canPublish||connection(channel)?.integrationId!==link.integrationId)throw fail('CONNECTION_CHANGED','발행 계정 연결이 바뀌었어요. 다시 확인해 주세요.',409);
        const image=[];
        for(const media of prepared.media){
          let uploaded;
          if(media.assetId||media.id){
            if(typeof resolveMedia!=='function')throw fail('LOCAL_MEDIA_UNAVAILABLE','서버에 저장한 미디어 파일을 다시 선택해 주세요.',409);
            const local=await resolveMedia(media,{channel,post,variant,job});if(!local?.bytes)throw fail('LOCAL_MEDIA_UNAVAILABLE','승인한 미디어 파일을 읽지 못했어요.',409);
             const actual=mimeOf(Buffer.from(local.bytes));if(actual&&mediaType({mimeType:actual})!==mediaType(media))throw fail('MEDIA_TYPE_MISMATCH','승인한 미디어 종류와 실제 파일 종류가 달라요. 파일을 다시 선택해 주세요.',409);
            uploaded=await uploadMedia({...local,signal});
          }else{const url=publicUrl(media.url);uploaded=await request(cfg,'/upload-from-url',{method:'POST',json:{url},signal});if(!identifier(uploaded?.id)||!safeUrl(uploaded.path))throw fail('INVALID_UPLOAD_RESPONSE','미디어 업로드 결과를 확인하지 못했어요.',502);}
          image.push({id:uploaded.id,path:uploaded.path||uploaded.url,...(media.alt||prepared.options.altText?{alt:clean(media.alt||prepared.options.altText,1000)}:{}),...(prepared.options.thumbnailTimestamp!==undefined?{thumbnailTimestamp:prepared.options.thumbnailTimestamp}:{})});
        }
        if(prepared.options.coverUrl){const thumbnail=await request(cfg,'/upload-from-url',{method:'POST',json:{url:publicUrl(prepared.options.coverUrl)},signal});if(!identifier(thumbnail?.id)||!safeUrl(thumbnail.path))throw fail('INVALID_UPLOAD_RESPONSE','표지 업로드 결과를 확인하지 못했어요.',502);prepared.settings.thumbnail={id:thumbnail.id,path:thumbnail.path};}
        if(config()?.version!==cfg.version||!capability(store.get('channels',channel.id)||channel).canPublish||connection(channel)?.integrationId!==link.integrationId)throw fail('CONNECTION_CHANGED','전송하기 전에 발행 계정 연결이 바뀌었어요. 다시 확인해 주세요.',409);
        await authorizePublish?.(input);
        const value=[{content:prepared.content,image}];if(prepared.options.firstComment)value.push({content:String(prepared.options.firstComment),image:[]});
        const body={type:'now',date:time(),shortLink:false,tags:[],posts:[{integration:{id:link.integrationId},value,settings:prepared.settings}]};
        transaction(()=>{const latest=store.get('socialProviderJobs',id);if(latest.claimToken!==initial.claimToken||latest.status!=='preparing')throw fail('PREPARATION_SUPERSEDED','이 준비 작업의 실행 권한이 만료됐어요. 최신 작업 결과를 확인해 주세요.',409);store.put('socialProviderJobs',id,{...latest,status:'submitting',updatedAt:time()});});
        let submitted;try{submitted=await request(cfg,'/posts',{method:'POST',json:body,signal});}catch(error){return finish(errorResult(error,error.uncertain===true));}
        const row=Array.isArray(submitted)&&submitted.length===1?submitted[0]:null;
        if(!identifier(row?.postId)||row.integration!==link.integrationId)return finish(responseResult('uncertain','접수 응답에서 게시물 ID를 확인하지 못했어요. Postiz에서 결과를 확인해 주세요.',{errorCode:'SUBMISSION_ID_UNKNOWN'}));
        listCache.clear();return finish(responseResult('submitted','Postiz가 발행 요청을 접수했어요. 실제 게시 결과는 이어서 확인해요.',{providerId:row.postId,observedAt:time()}));
      }catch(error){return finish(errorResult(error));}
    })();inFlight.set(id,work);try{return await work;}finally{inFlight.delete(id);}
  }
  async function listPosts(cfg,row,signal){
    const day=(row.createdAt||time()).slice(0,10),key=cfg.version+':'+day,cache=listCache.get(key);if(cache&&Date.parse(time())-cache.at<60000)return cache.rows;
    const start=new Date(Date.parse(day+'T00:00:00.000Z')-86400000).toISOString(),end=new Date(Math.max(Date.parse(time())+86400000,Date.parse(start)+3*86400000)).toISOString(),query=new URLSearchParams({startDate:start,endDate:end});
    const result=await request(cfg,'/posts?'+query,{signal});if(!Array.isArray(result?.posts))throw fail('INVALID_PROVIDER_RESPONSE','Postiz 게시물 목록을 읽지 못했어요.',502);listCache.set(key,{at:Date.parse(time()),rows:result.posts});return result.posts;
  }
  async function status({channel,job,signal}){
    const id=ledgerId(channel,job),row=store.get('socialProviderJobs',id);
    if(!row)return responseResult('uncertain','이 예약은 전송 기록이 없어요.',{errorCode:'SUBMISSION_NOT_FOUND'});
    if(row.status==='published'||row.status==='failed')return resultFor(row);
    if(row.status==='preparing'){
      if(Date.parse(row.updatedAt)<=Date.parse(time())-300000)return saveResult(id,responseResult('failed','미디어를 준비하다 작업이 멈췄어요. 게시 요청은 보내지 않았으니 다시 예약할 수 있어요.',{errorCode:'NOT_SUBMITTED',definitive:true,retryable:true}),row.claimToken,'preparing');
      return responseResult('processing','미디어를 준비하고 있어요. 게시가 접수되기 전까지 상태를 다시 확인해요.',{requestId:row.requestId});
    }
    if(!row.providerId)return responseResult('uncertain','접수 번호가 없어서 자동으로 다시 보내지 않아요. Postiz에서 결과를 확인해 주세요.',{requestId:row.requestId,errorCode:'SUBMISSION_ID_UNKNOWN'});
    try{
      const cfg=configured();if(cfg.version!==row.configVersion)throw fail('CONFIG_CHANGED','처음 발행할 때 쓴 Postiz 연결이 바뀌었어요. 원래 워크스페이스에서 결과를 확인해 주세요.',409);
      const rows=await listPosts(cfg,row,signal),found=rows.find(item=>item.id===row.providerId&&item.integration?.id===row.integrationId);
      if(!found)return responseResult('uncertain','Postiz 목록에서 접수한 게시물을 찾지 못했어요. 다시 보내기 전에 결과를 확인해 주세요.',{providerId:row.providerId,requestId:row.requestId,errorCode:'PROVIDER_POST_NOT_FOUND'});
      if(found.state==='PUBLISHED')return saveResult(id,responseResult('published','Postiz가 게시 완료를 알려 왔어요. 공개 화면은 따로 확인해야 해요.',{providerId:row.providerId,url:safeUrl(found.releaseURL),publishedAt:null,observedAt:time()}));
      if(found.state==='ERROR')return saveResult(id,responseResult('failed','Postiz가 발행 실패를 알려 왔어요. 일부만 게시됐는지 Postiz에서 확인한 뒤 처리해 주세요.',{providerId:row.providerId,errorCode:'PUBLISH_FAILED',observedAt:time(),definitive:false}));
      if(found.state==='QUEUE')return saveResult(id,responseResult('processing','Postiz에서 발행을 처리하고 있어요.',{providerId:row.providerId,observedAt:time()}));
      return saveResult(id,responseResult('uncertain','Postiz에서 이 게시물이 초안이거나 확인이 필요한 상태예요. 직접 확인해 주세요.',{providerId:row.providerId,errorCode:'UNEXPECTED_POST_STATE',observedAt:time()}));
    }catch(error){const safe=errorResult(error);return {...resultFor(row),message:safe.message,errorCode:safe.errorCode,nextRetryAt:safe.nextRetryAt||null};}
  }
  async function reconcile(user,{jobId,providerId,signal}={},context={}){
    authorize(user,context);const row=store.all('socialProviderJobs').find(item=>item.jobId===jobId);if(!row||!identifier(providerId))throw fail('JOB_NOT_FOUND','확인할 작업과 Postiz 게시물 ID를 입력해 주세요.',404);
    if(row.status==='preparing'||row.status==='submitting'&&Date.parse(row.updatedAt)>Date.parse(time())-300000)throw fail('REQUEST_IN_FLIGHT','아직 전송 중이에요. 결과가 확인될 때까지 기다려 주세요.',409);
    if(row.providerId&&row.providerId!==providerId)throw fail('PROVIDER_ID_LOCKED','이미 연결한 게시물 ID는 바꿀 수 없어요.',409);
    const cfg=configured();if(cfg.version!==row.configVersion)throw fail('CONFIG_CHANGED','원래 발행 연결에서 결과를 확인해 주세요.',409);
    listCache.clear();const rows=await listPosts(cfg,row,signal),found=rows.find(item=>item.id===providerId&&item.integration?.id===row.integrationId&&item.content===row.content);
    if(!found)throw fail('PROVIDER_POST_MISMATCH','같은 계정·본문으로 올린 Postiz 게시물인지 확인하지 못했어요. 게시물 ID를 다시 확인해 주세요.',409);
    authorize(user,context);const latest=store.get('socialProviderJobs',row.id);if(latest.updatedAt!==row.updatedAt||latest.status!==row.status)throw fail('JOB_CHANGED','게시 작업이 바뀌었어요. 최신 결과를 확인해 주세요.',409);
    store.put('socialProviderJobs',row.id,{...row,providerId,status:'submitted',reconciledAt:time(),reconciledBy:user.id});return status({channel:{id:row.channelId},job:{id:row.jobId,idempotencyKey:row.idempotencyKey},signal});
  }
  const healthService=createProviderHealth({store,config,credentials,configured,request,parseIntegrations,authorize,clock});
  return {settings,configure,refresh,connect,disconnect,capability,preflight,uploadMedia,publish,status,reconcile,...healthService};
}
