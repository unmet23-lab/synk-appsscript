import {createHash,randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import {isPublicLinkAddress} from './publication-link-probe.mjs';
import {instagramIdentity,metaPublishScopes,metaDataAccessExpired} from './meta-connection.mjs';

// API contracts checked 2026-10-14 against Meta's official Postman collection
// and generated SDK. This module contains no Postiz code or paid API dependency.
// https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
// https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/iguser.py
// https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/page.py
// A media container is NOT a published post. Only media_publish or a Page's
// published feed/photo write can make content public; those requests never retry
// after an ambiguous response, including after process restart.
const JOBS='socialDirectPublishJobs',CONNECTIONS='socialDirectConnections',BUDGET='socialDirectPublishRequests';
const MINUTE=60000,HOUR=3600000,LEASE=5*MINUTE,MAX_RESPONSE=2*1024*1024,PROOF_CHECKS=3,BUSY_CHECKS=10,AUTO_CHECKS=3,SETTLE_MS=180000,MATCH_BEFORE=2*MINUTE,MATCH_AFTER=15*MINUTE,RECONCILE_PAGE_SIZE=50,RECONCILE_MAX_PAGES=10,MEDIA_TIMEOUT=75000,RECHECK=[15000,30000,60000,120000,120000,120000],CREDENTIAL_CODES=new Set(['CHANNEL_INACTIVE','COLLECTION_DISABLED','CONNECTION_CHANGED','CONNECTION_OWNER_INACTIVE']);
const sleep=(ms,signal)=>new Promise(resolve=>{if(signal?.aborted)return resolve();let timer=null;const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',done);resolve();};timer=setTimeout(done,ms);signal?.addEventListener('abort',done,{once:true});});
const normalizeText=value=>String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/,'')).join('\n').trim();
const graphId=value=>typeof value==='string'&&/^\d{1,50}$/.test(value)?value:null;
const postId=value=>typeof value==='string'&&/^\d{1,50}(?:_\d{1,50})?$/.test(value)?value:null;
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:canonical(value)).digest('hex');
const fail=(code,message,status=409,extra={})=>Object.assign(new Error(message),{code,status,providerSafe:true,...extra});
const nonempty=value=>value!==undefined&&value!==null&&value!==''&&value!==false&&!(Array.isArray(value)&&!value.length);
const scopeSet=credentials=>new Set(typeof credentials?.scope==='string'?credentials.scope.split(/[ ,]+/).filter(Boolean):[]);
const mediaType=media=>String(media?.mimeType||media?.type||'image').split('/')[0];
const credentialBinding=c=>[c?.authType,c?.accountId,c?.appScopedId,c?.apiVersion,c?.metaIdentityVersion];
const credentialFingerprint=c=>hash([credentialBinding(c),c?.accessToken,c?.scope,c?.expiresAt,c?.dataAccessExpiresAt,c?.permissionsVerifiedAt]);
const result=(status,message,extra={})=>({provider:'meta-direct',status,message,retryable:false,definitive:status==='failed',publicVerified:false,...extra});
const safeError=error=>error?.providerSafe||error?.code==='SOCIAL_REVIEW_REQUIRED'?{code:error.code,message:error.message,retryable:error.retryable===true,nextRetryAt:error.nextRetryAt||null}:{code:'META_PUBLISH_FAILED',message:'발행 준비를 완료하지 못했어요. 승인 원문과 계정 연결을 확인해 주세요.',retryable:false};

// Rebuild a read at our own endpoint; never fetch paging.next or forward its token/fields.
// Meta SDK Cursor uses after + next (api.py), and IGUser.get_media supports since/until.
// Checked 2026-10-15: https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/api.py
function nextRecentPage(paging,{origin,version,path,since,until}){
  const opaque=value=>typeof value==='string'&&value.length>0&&value.length<=2000&&!/[\u0000-\u0020\u007f]/u.test(value);
  if(typeof paging?.next!=='string'||paging.next.length>8192||/[\u0000-\u0020\\]/u.test(paging.next))return null;
  let url;try{url=new URL(paging.next);}catch{return null;}
  if(url.origin!==origin||url.username||url.password||url.hash||![`/${version}/${path}`,`/${path}`].includes(url.pathname))return null;
  if(paging.cursors!=null&&(typeof paging.cursors!=='object'||Array.isArray(paging.cursors))||url.searchParams.get('__previous'))return null;
  for(const key of ['after','until','__paging_token'])if(url.searchParams.getAll(key).length>1)return null;
  const cursor=paging.cursors?.after,queryCursor=url.searchParams.get('after');
  if(cursor!=null||queryCursor!=null){
    const after=cursor??queryCursor;if(!opaque(after)||cursor!=null&&queryCursor!=null&&cursor!==queryCursor)return null;
    return {since,until,after};
  }
  // Page feeds can return a time cursor instead of cursors.after. Preserve the lower
  // bound and allow only a non-increasing upper bound plus the returned opaque token.
  const value=url.searchParams.get('until'),token=url.searchParams.get('__paging_token');
  if(!/^\d{1,12}$/.test(value||'')||Number(value)<since||Number(value)>until||token!=null&&!opaque(token)||Number(value)===until&&!token)return null;
  return {since,until:Number(value),...(token?{__paging_token:token}:{})};
}

function publicUrl(value){
  if(typeof value!=='string'||value.length>4096||/[\u0000-\u0020\\]/u.test(value))throw fail('INVALID_MEDIA_URL','외부에서 열 수 있는 HTTPS 미디어 주소가 필요해요.');
  let url;try{url=new URL(value);}catch{throw fail('INVALID_MEDIA_URL','HTTPS 미디어 주소를 확인해 주세요.');}
  const host=url.hostname.replace(/^\[|\]$/g,'').replace(/\.$/,'').toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash||host==='localhost'||host.endsWith('.localhost')||/(?:^|\.)(?:local|internal|lan|home)$/.test(host)||isIP(host)&&!isPublicLinkAddress(host))throw fail('INVALID_MEDIA_URL','외부에서 열 수 있는 HTTPS 주소만 쓸 수 있어요.');
  return url.href;
}
const safePublicUrl=value=>{try{return publicUrl(value);}catch{return null;}};
// Meta downloads the media while it handles a media-bearing write, so those requests get a longer timeout.
export const metaRequestTimeout=(method,params={})=>method==='POST'&&['url','image_url','video_url'].some(key=>params?.[key]!=null)?MEDIA_TIMEOUT:20000;
const detectedMime=bytes=>bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.length>=12&&bytes.subarray(4,8).toString()==='ftyp'&&['isom','iso2','mp41','mp42','avc1','M4V ','dash','msnv'].includes(bytes.subarray(8,12).toString())?'video/mp4':null;

function specification(platform){
  return platform==='instagram'?{
    formats:['image','carousel','reel','instagram-reels','feed','post'],maxTextLength:2200,maxMediaCount:10,
    mediaTypes:['image/jpeg','video/mp4'],maxImageBytes:8*1000*1000,maxVideoBytes:100*1024*1024,
    options:['hashtags','altText','thumbnailTimestamp','shareToFeed'],requiredOptions:[],
    formatRules:{image:{minMediaCount:1,maxMediaCount:1,mediaKind:'image',requiresMediaMetadata:true},carousel:{minMediaCount:2,maxMediaCount:10,mediaKind:'image',requiresMediaMetadata:true},reel:{minMediaCount:1,maxMediaCount:1,mediaKind:'video',maxDurationSeconds:900,requiresMediaMetadata:true},'instagram-reels':{minMediaCount:1,maxMediaCount:1,mediaKind:'video',maxDurationSeconds:900,requiresMediaMetadata:true},feed:{minMediaCount:1,maxMediaCount:10,mediaKind:'image'},post:{minMediaCount:1,maxMediaCount:10,mediaKind:'image'}}
  }:{
    formats:['text','image','feed','post'],maxTextLength:63206,maxMediaCount:1,
    mediaTypes:['image/jpeg','image/png'],maxImageBytes:10*1000*1000,maxVideoBytes:0,
    options:['hashtags','altText','link'],requiredOptions:[],
    formatRules:{text:{minMediaCount:0,maxMediaCount:0,mediaKind:'none'},image:{minMediaCount:1,maxMediaCount:1,mediaKind:'image',requiresMediaMetadata:true},feed:{minMediaCount:0,maxMediaCount:1,mediaKind:'image'},post:{minMediaCount:0,maxMediaCount:1,mediaKind:'image'}}
  };
}

export function createSocialDirectMeta({store,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),getCredentials,resolveMedia,authorizePublish,issueMediaUrl,wait=sleep,containerPoll={}}={}){
  if(!store)throw new TypeError('store is required');
  const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now()),inFlight=new Map();
  const transaction=fn=>typeof store.transaction==='function'?store.transaction(fn):fn();
  const secret=channel=>store.secret('channel:'+channel.id);
  const liveChannel=channel=>store.get('channels',channel?.id)||channel;
  const ledgerId=(channel,job)=>hash(['meta-direct',channel.id,job.idempotencyKey||job.id]);
  const binding=channel=>{const c=liveChannel(channel),link=store.get(CONNECTIONS,c.id);return hash([c.id,c.platform,c.externalId,c.connectionVersion,c.active,c.hidden,c.collectionDisabled,c.ownerIds,c.teamId,link?.version,link?.enabled,link?.connectionVersion,link?.accountId,link?.authType,credentialBinding(secret(c))]);};
  function issue(channel,credentials,{enabled=true}={}){
    if(!channel||!['instagram','facebook'].includes(channel.platform))return ['UNSUPPORTED_PLATFORM','직접 자동 발행은 Instagram과 Facebook 페이지부터 지원해요.'];
    if(channel.active===false||channel.hidden||channel.collectionDisabled)return ['CHANNEL_DISABLED','계정을 활성화하고 연결을 다시 확인해 주세요.'];
    if(!graphId(channel.externalId)||!credentials?.accessToken)return ['NOT_CONNECTED','발행 권한이 있는 SNS 계정을 먼저 연결해 주세요.'];
    const types=channel.platform==='instagram'?['instagram-login','instagram-facebook','facebook-page']:['facebook-user','facebook-page'];
    if(!types.includes(credentials.authType)||/[\r\n]/.test(credentials.accessToken))return ['AUTH_TYPE_REQUIRED','직접 발행할 수 있는 로그인 연결을 확인해 주세요.'];
    if(credentials.accountId!==channel.externalId||credentials.metaIdentityVersion!==1)return ['ACCOUNT_MISMATCH','SNS에서 검증한 계정 ID와 현재 계정이 맞지 않아요.'];
    if(credentials.expiresAt&&(!Number.isFinite(Date.parse(credentials.expiresAt))||Date.parse(credentials.expiresAt)<=stamp())||metaDataAccessExpired(channel,credentials,{purpose:'publishing',requiredScopes:metaPublishScopes(channel.platform,credentials.authType),now:now()}))return ['AUTH_REQUIRED','발행 연결이 만료됐어요. 발행 권한을 허용해 다시 연결해 주세요.'];
    const missing=metaPublishScopes(channel.platform,credentials.authType).filter(scope=>!scopeSet(credentials).has(scope));
    if(missing.length||!Number.isFinite(Date.parse(credentials.permissionsVerifiedAt)))return ['SCOPES_REQUIRED','서버에서 확인한 게시 권한이 필요해요. 댓글 연결과 별도로 발행 권한을 허용해 주세요.',missing];
    if(enabled){const link=store.get(CONNECTIONS,channel.id);if(!link?.enabled||!link.version||link.connectionVersion!==(channel.connectionVersion||0)||link.accountId!==channel.externalId||link.authType!==credentials.authType)return ['NOT_CONFIGURED','이 계정의 직접 발행 연결을 확인하고 켜 주세요.'];}
    return null;
  }
  function capability(channel){
    channel=liveChannel(channel);const credentials=channel?secret(channel):null,problem=issue(channel,credentials),spec=specification(channel?.platform),link=channel&&store.get(CONNECTIONS,channel.id);
    return {provider:'meta-direct',mode:problem?'manual':'automatic',canPublish:!problem,...spec,reason:problem?.[1]||null,errorCode:problem?.[0]||null,requiredScopes:channel?metaPublishScopes(channel.platform,credentials?.authType):[],missingScopes:problem?.[2]||[],connection:link?{status:problem?'needs_check':'connected',integrationId:channel.externalId,name:channel.displayName||channel.name||channel.handle||channel.id,profile:channel.handle||'',checkedAt:link.verifiedAt||link.checkedAt||null}:null};
  }
  function validate({channel,post={},variant={}}={}){
    if(!['instagram','facebook'].includes(channel?.platform))throw fail('FORMAT_MANUAL_REQUIRED','이 SNS는 직접 발행을 지원하지 않아 수동으로 마무리해야 해요.');
    const spec=specification(channel.platform),format=variant.format||'text',options=variant.options||{},media=variant.media||post.media||[];
    if(!spec.formats.includes(format))throw fail('FORMAT_MANUAL_REQUIRED','이 형식은 SNS에서 수동으로 마무리해 주세요. 직접 연결은 Instagram 사진·사진 묶음·릴스와 Facebook 글·링크·사진 한 장을 지원해요.');
    if(!options||typeof options!=='object'||Array.isArray(options))throw fail('INVALID_OPTIONS','채널 옵션을 확인해 주세요.');
    if(Object.keys(options).some(key=>key!=='notifyOnly'&&!spec.options.includes(key)&&nonempty(options[key])))throw fail('OPTIONS_MANUAL_REQUIRED','첫 댓글·스토리·태그 등 아직 연결하지 않은 옵션은 SNS에서 직접 마무리해 주세요.');
    if(options.notifyOnly===true)throw fail('FORMAT_MANUAL_REQUIRED','알림만 받고 SNS에서 마무리하도록 선택한 게시물이에요.');
    const hashtags=options.hashtags;if(hashtags!==undefined&&typeof hashtags!=='string'&&(!Array.isArray(hashtags)||hashtags.some(x=>typeof x!=='string')))throw fail('INVALID_HASHTAGS','해시태그는 글자나 글자 목록으로 입력해 주세요.');
    const content=String(variant.text??post.body??'')+(nonempty(hashtags)?'\n\n'+(Array.isArray(hashtags)?hashtags.join(' '):hashtags):'');
    if([...content].length>spec.maxTextLength)throw fail('TEXT_TOO_LONG',`게시문은 ${spec.maxTextLength}자 이내로 입력해 주세요.`);
    if(!Array.isArray(media)||media.length>spec.maxMediaCount)throw fail('INVALID_MEDIA_COUNT','이 직접 연결에서 지원하는 첨부 개수를 확인해 주세요.');
    const video=media.filter(item=>mediaType(item)==='video'),reel=['reel','instagram-reels'].includes(format);
    if(channel.platform==='instagram'&&(!media.length||video.length&&!reel)||channel.platform==='facebook'&&video.length)throw fail('FORMAT_MANUAL_REQUIRED','Instagram 영상은 릴스로 선택하고 Facebook 영상은 SNS에서 마무리해 주세요.');
    if(format==='text'&&media.length||format==='image'&&(media.length!==1||video.length)||format==='carousel'&&(media.length<2||video.length)||reel&&(media.length!==1||video.length!==1))throw fail('FORMAT_MEDIA_MISMATCH','선택한 게시 형식과 미디어 개수를 확인해 주세요.');
    if(!content.trim()&&!media.length&&!options.link)throw fail('EMPTY_POST','게시문이나 미디어를 입력해 주세요.');
    if(options.altText!==undefined&&typeof options.altText!=='string'||options.altText?.length>1000)throw fail('INVALID_ALT_TEXT','대체 텍스트는 1,000자 이내로 입력해 주세요.');
    if(options.altText&&(!media.length||reel))throw fail('OPTIONS_MANUAL_REQUIRED','대체 텍스트는 사진 게시물에만 지원해요.');
    if(options.link&&media.length)throw fail('OPTIONS_MANUAL_REQUIRED','Facebook 링크 미리보기와 사진은 각각 별도 게시물로 만들어 주세요.');
    if(options.link)publicUrl(options.link);
    if(options.shareToFeed!==undefined&&typeof options.shareToFeed!=='boolean'||options.shareToFeed!==undefined&&!reel)throw fail('INVALID_OPTIONS','피드에도 공유하기는 릴스에서만 선택해 주세요.');
    if(options.thumbnailTimestamp!==undefined&&(!reel||!Number.isInteger(options.thumbnailTimestamp)||options.thumbnailTimestamp<0||options.thumbnailTimestamp>=(media[0]?.durationSeconds??media[0]?.duration)*1000))throw fail('INVALID_COVER','릴스 길이 안의 표지 시각(밀리초)을 선택해 주세요.');
    for(const item of media){
      if(!item||typeof item!=='object'||!spec.mediaTypes.includes(item.mimeType))throw fail('UNSUPPORTED_MEDIA',channel.platform==='instagram'?'Instagram은 JPEG 사진과 MP4 릴스를 지원해요.':'Facebook 사진은 JPEG 또는 PNG로 준비해 주세요.');
      if(item.alt!==undefined&&(typeof item.alt!=='string'||item.alt.length>1000))throw fail('INVALID_ALT_TEXT','사진별 대체 텍스트는 1,000자 이내로 입력해 주세요.');
      if(!item.assetId&&!item.id||!/^[a-f0-9]{64}$/.test(item.sha256||''))throw fail('APPROVED_MEDIA_REQUIRED','자동 발행할 파일을 워크스페이스에 업로드하고 미디어 준비·승인을 다시 진행해 주세요.');
      const max=mediaType(item)==='video'?spec.maxVideoBytes:spec.maxImageBytes;
      if(!Number.isFinite(item.byteSize)||item.byteSize<=0||item.byteSize>max)throw fail('MEDIA_TOO_LARGE',`이 연결의 ${mediaType(item)==='video'?'영상':'사진'} 크기 제한을 확인해 주세요.`);
      if(!Number.isFinite(item.width)||!Number.isFinite(item.height)||item.width<=0||item.height<=0)throw fail('MEDIA_METADATA_REQUIRED','크기를 확인한 미디어를 선택해 주세요.');
      if(channel.platform==='instagram'&&mediaType(item)==='image'&&(item.width/item.height<.8||item.width/item.height>1.91))throw fail('MEDIA_ASPECT_RATIO','Instagram 사진은 가로/세로 비율 4:5부터 1.91:1 사이로 준비해 주세요.');
      if(reel){const duration=item.durationSeconds??item.duration;if(!Number.isFinite(duration)||duration<3||duration>900||item.width>1920)throw fail('REEL_METADATA_INVALID','릴스는 3초~15분, 가로 1,920px 이하 MP4로 준비해 주세요.');}
    }
    return {content,media,options,format,reel};
  }
  function preflight(input){try{validate(input);return {valid:true,errors:[],warnings:[]};}catch(error){const safe=safeError(error);return {valid:false,errors:[{code:safe.code,message:safe.message}],warnings:[]};}}
  function reserve(channelId){transaction(()=>{const row=store.get(BUDGET,channelId)||{},times=(row.times||[]).filter(at=>at>stamp()-HOUR);if(times.length>=120||row.retryAt>stamp())throw fail('META_RATE_LIMIT','직접 발행 요청이 많아요. 잠시 후 다시 확인해 주세요.',429,{retryable:true,nextRetryAt:new Date(Math.max(row.retryAt||0,times[0]+HOUR||stamp()+MINUTE)).toISOString()});store.put(BUDGET,channelId,{times:[...times,stamp()],retryAt:row.retryAt||null});});}
  async function session(channel,{signal,authorize=()=>{},enabled=true,expectedBinding}={}){
    const original=binding(channel),check=()=>{authorize();if(signal?.aborted)throw fail('PUBLISH_CANCELLED','게시 준비가 중단됐어요.');if(binding(channel)!==(expectedBinding||original))throw fail('CONNECTION_CHANGED','발행 계정이나 연결 설정이 바뀌었어요. 다시 확인해 주세요.');};check();
    let credentials;try{credentials=await(getCredentials?getCredentials(liveChannel(channel)):secret(channel));}catch(error){if(CREDENTIAL_CODES.has(error?.code))throw fail(error.code,String(error.message||'계정 연결을 확인해 주세요.').slice(0,300),409,{retryable:true});throw error;}check();
    if(credentialFingerprint(credentials)!==credentialFingerprint(secret(channel)))throw fail('CONNECTION_CHANGED','읽은 인증 정보와 저장된 연결이 달라졌어요.');
    const problem=issue(liveChannel(channel),credentials,{enabled});if(problem)throw fail(problem[0],problem[1]);
    const fingerprint=credentialFingerprint(credentials),version=credentials.apiVersion||'v26.0',direct=channel.platform==='instagram'&&credentials.authType==='instagram-login';
    if(!/^v\d{1,2}\.\d{1,2}$/.test(version))throw fail('INVALID_API_VERSION','Meta API 버전을 확인해 주세요.');
    const origin=direct?'https://graph.instagram.com':'https://graph.facebook.com';let token=credentials.accessToken;
    const assert=()=>{check();if(credentialFingerprint(secret(channel))!==fingerprint)throw fail('CONNECTION_CHANGED','처리 중에 SNS 인증 정보가 바뀌었어요.');};
    async function api(path,params={},method='GET',{final=false}={}){
      assert();reserve(channel.id);const url=new URL('/'+version+'/'+path,origin),body=new URLSearchParams();for(const [key,value]of Object.entries(params))if(value!=null)(method==='GET'?url.searchParams:body).set(key,String(value));
      const timeoutMs=metaRequestTimeout(method,params);let response,data;try{response=await fetchImpl(url.href,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json','Cache-Control':'no-store',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:method==='POST'?body.toString():undefined,timeoutMs,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});}catch{throw fail('META_NETWORK','Meta 응답을 받지 못했어요.',502,{uncertain:method==='POST',retryable:method==='GET'});}
      try{if(Number(response.headers?.get?.('content-length')||0)>MAX_RESPONSE)throw Error();const raw=await response.text();if(Buffer.byteLength(raw)>MAX_RESPONSE)throw Error();data=JSON.parse(raw);}catch{throw fail('META_INVALID_RESPONSE','Meta 결과를 읽지 못했어요.',502,{uncertain:method==='POST',retryable:method==='GET'});}
      const status=Number(response.status),code=Number(data?.error?.code);
      if(status>=500)throw fail('META_UNAVAILABLE','Meta 처리 결과를 확인하지 못했어요.',502,{uncertain:method==='POST',retryable:method==='GET'});
      if(status===429||[4,17,32,613,80001].includes(code)){const header=response.headers?.get?.('retry-after'),seconds=Number(header),retryAt=Number.isFinite(seconds)&&seconds>0?stamp()+Math.min(seconds,86400)*1000:stamp()+15*MINUTE;transaction(()=>{const row=store.get(BUDGET,channel.id)||{};store.put(BUDGET,channel.id,{...row,retryAt:Math.max(row.retryAt||0,retryAt)});});throw fail('META_RATE_LIMIT',final?'Meta가 공개 게시 요청을 제한했어요. 처리됐는지 확인하기 전까지 다시 보내지 않아요.':'Meta가 요청을 잠시 제한했어요. 안내 시각 이후 다시 확인해 주세요.',429,{retryable:!final,uncertain:final,nextRetryAt:new Date(retryAt).toISOString()});}
      if([401,403].includes(status)||[102,190,200,283,459].includes(code))throw fail('AUTH_REQUIRED','SNS의 게시 권한이나 토큰을 다시 연결해 주세요.');
      // Codes 1 and 2 ("unknown error", "service temporarily unavailable") do not say whether the write happened.
      if(final&&[1,2].includes(code))throw fail('META_TRANSIENT','Meta가 일시적인 오류를 알려 왔어요. 처리됐는지 확인하기 전까지 다시 보내지 않아요.',502,{uncertain:true});
      if(status<200||status>=300||data?.error)throw fail('META_REQUEST_REJECTED','Meta가 이 요청을 거절했어요. 계정 권한과 미디어 규격을 확인해 주세요.',409);
      if(method==='GET')assert();return data;
    }
    if(channel.platform==='facebook'&&credentials.authType==='facebook-user'){
      let match,after;const seen=new Set();for(let n=0;n<5;n++){const response=await api('me/accounts',{fields:'id,access_token,tasks',limit:100,after});if(!Array.isArray(response.data))throw fail('META_INVALID_RESPONSE','Facebook 페이지 목록을 확인하지 못했어요.');match=response.data.find(page=>page.id===channel.externalId);if(match)break;const next=response.paging?.cursors?.after;if(!response.paging?.next||typeof next!=='string'||!next||next.length>2000||seen.has(next))break;seen.add(next);after=next;}
      if(!match?.access_token||!match.tasks?.some(task=>['CREATE_CONTENT','MANAGE'].includes(task)))throw fail('PAGE_ACCESS_REQUIRED','이 Facebook 페이지에서 게시물을 만들 권한이 필요해요.');token=match.access_token;
    }
    let account=await api(channel.platform==='instagram'&&!direct?channel.externalId:'me',{fields:channel.platform==='instagram'?(direct?'id,user_id,username':'id,username'):'id,name'});
    if(direct)account=instagramIdentity(account,{requireUserId:true});
    if(account.id!==channel.externalId||channel.platform==='instagram'&&channel.handle&&String(account.username||'').toLowerCase()!==channel.handle.replace(/^@/,'').toLowerCase())throw fail('ACCOUNT_MISMATCH','SNS에서 확인한 발신 계정이 선택한 계정과 달라요.');
    return {api,check:assert,account,nextPage:(path,paging,range)=>nextRecentPage(paging,{origin,version,path,...range})};
  }
  async function checkConnection(channel,context={}){const account=(await session(liveChannel(channel),{...context,enabled:false})).account;return {provider:'meta-direct',accountId:account.id,authType:secret(channel).authType,checkedAt:now(),requiredScopes:metaPublishScopes(channel.platform,secret(channel).authType),canPublish:true};}
  const recheck=row=>row.status==='preparing'&&row.errorCode==='MEDIA_DELIVERY_BUSY'?RECHECK[0]:['processing','creating'].includes(row.status)&&row.processingChecks>0?RECHECK[row.processingChecks-1]:undefined;
  const view=row=>result(['preparing','creating'].includes(row.status)?'processing':row.status==='submitting'?'uncertain':row.status,row.message||'Meta 게시 결과를 확인하고 있어요.',{providerId:row.providerId||null,requestId:row.id,url:row.url||null,publishedAt:row.publishedAt||null,observedAt:row.observedAt||null,errorCode:row.errorCode||null,retryable:row.retryable===true,definitive:row.definitive===true,nextRetryAt:row.nextRetryAt||null,...(recheck(row)?{checkAfterMs:recheck(row)}:{})});
  function update(id,changes,claim){return transaction(()=>{const row=store.get(JOBS,id);if(!row||claim&&row.claimToken!==claim||row.status==='published'&&changes.status!=='published'||changes.status==='processing'&&!['preparing','creating','processing'].includes(row.status))return row;const next={...row,...changes,updatedAt:now()};store.put(JOBS,id,next);return next;});}
  function failure(id,error){const row=store.get(JOBS,id),safe=safeError(error);if(!row)return result('failed',safe.message,{errorCode:safe.code});if(['published','uncertain'].includes(row.status)||error.code==='PREPARATION_SUPERSEDED')return view(row);if(row.status==='processing'&&error.code==='PUBLISH_CANCELLED')return view(update(id,{message:'게시 준비 확인이 중단돼 다음 확인에서 이어서 봐요.'}));if(row.status==='submitting'&&(!error.finalWrite||error.uncertain||!error.providerSafe))return view(update(id,{status:'uncertain',message:'게시됐는지 알 수 없어요. SNS 원문을 확인하기 전까지 다시 보내지 않아요.',errorCode:'SUBMISSION_RESULT_UNKNOWN',definitive:false,retryable:false}));if(row.providerId)return view(update(id,{status:'submitted',message:'게시 접수 ID는 받았지만 원문 확인을 마치지 못했어요. 다시 보내지 않고 결과만 확인해요.',errorCode:safe.code,proofChecks:error.proofCheck?(row.proofChecks||0)+1:row.proofChecks||0,definitive:false,retryable:false}));if(row.status==='preparing'&&error.busy){const checks=(row.busyChecks||0)+1;if(checks<BUSY_CHECKS)return view(update(id,{message:safe.message,errorCode:safe.code,busyChecks:checks,retryable:true}));return view(update(id,{status:'failed',message:'게시 파일 전달이 계속 바빠 준비를 멈췄어요. 공개 게시 요청은 보내지 않았으니 다시 예약할 수 있어요.',errorCode:'MEDIA_DELIVERY_BUSY',definitive:true,retryable:true}));}return view(update(id,{status:'failed',message:safe.message,errorCode:safe.code,definitive:true,retryable:safe.retryable,nextRetryAt:safe.nextRetryAt}));}
  const fingerprint=input=>hash({post:input.post,variant:input.variant,contentVersion:input.job.contentVersion,approvalHash:input.job.approvalHash});
  async function authorize(input,continuation=false){if(typeof authorizePublish!=='function')throw fail('PUBLISH_AUTHORIZATION_REQUIRED','발행 승인 검증이 연결되지 않았어요.');await authorizePublish({...input,continuation});if(input.signal?.aborted)throw fail('PUBLISH_CANCELLED','게시 준비가 중단됐어요.');}
  async function mediaUrl(ref,input,continuation=false){
    if(typeof resolveMedia!=='function'||typeof issueMediaUrl!=='function')throw fail('LOCAL_MEDIA_UNAVAILABLE','승인 파일을 Meta에 전달할 연결이 준비되지 않았어요.');
    const resolved=await resolveMedia(ref,input),bytes=Buffer.from(resolved?.bytes||[]),mime=detectedMime(bytes);
    if(!bytes.length||bytes.length!==ref.byteSize||mime!==ref.mimeType||hash(bytes)!==ref.sha256)throw fail('MEDIA_CONTENT_CHANGED','승인한 미디어의 파일 내용·크기·형식이 바뀌었어요. 다시 준비하고 승인해 주세요.');
    let grant;try{grant=await issueMediaUrl(ref,{...input,continuation});}catch(error){if(error?.code==='SOCIAL_MEDIA_BUSY'||error?.status===429)throw fail('MEDIA_DELIVERY_BUSY','게시 파일 전달 칸이 모두 사용 중이에요. 잠시 후 자동으로 다시 준비해요.',429,{busy:true,retryable:true});throw error;}return publicUrl(grant?.url);
  }
  async function verifyPublished(row,channel,api){
    const ig=channel.platform==='instagram',photo=row.remoteKind==='photo';
    const remote=await api(row.providerId,{fields:ig?'id,owner,caption,permalink,timestamp':photo?'id,from,name,link,created_time':'id,from,message,permalink_url,created_time,is_published'});
    const owner=ig?remote.owner?.id:remote.from?.id,credentials=secret(channel),body=ig?remote.caption:photo?remote.name:remote.message;
    if(remote.id!==row.providerId||![channel.externalId,ig?credentials?.appScopedId:null].filter(Boolean).includes(owner)||!ig&&!photo&&remote.is_published!==true)throw fail('PUBLICATION_PROOF_MISMATCH','발신 계정·게시 상태가 접수 기록과 맞는지 확인하지 못했어요. SNS 원문을 확인해 주세요.');
    const at=ig?remote.timestamp:remote.created_time,publishedAt=typeof at==='string'&&Number.isFinite(Date.parse(at))?new Date(at).toISOString():null;
    const anchor=Number.isFinite(Date.parse(row.submittedAt))?Date.parse(row.submittedAt):Date.parse(row.createdAt);
    const url=safePublicUrl(ig?remote.permalink:photo?remote.link:remote.permalink_url),mismatch=normalizeText(body)!==normalizeText(row.content)?'게시문이 접수 기록과 달라요.':row.reconciledFromUnknown&&(!publishedAt||Date.parse(publishedAt)<anchor-MATCH_BEFORE||Date.parse(publishedAt)>anchor+MATCH_AFTER)?'게시 시각이 자동 대조한 범위와 맞지 않아요.':publishedAt&&Date.parse(publishedAt)<Date.parse(row.createdAt)-5*MINUTE?'이번 발행보다 이전에 작성된 게시물이에요.':null;
    // The ID came back from our own final write, so after PROOF_CHECKS disagreeing reads the row ends as published without proof.
    if(mismatch){const checks=(row.proofChecks||0)+1;if(checks<PROOF_CHECKS||row.reconciledFromUnknown)throw fail('PUBLICATION_PROOF_MISMATCH',mismatch+' SNS 원문을 확인해 주세요.',409,{proofCheck:true});return view(update(row.id,{status:'published',message:'Meta가 접수한 게시물 ID는 확인했지만 '+mismatch+' '+checks+'회 확인한 뒤 접수 ID 기준으로 게시 완료로 마감했어요. SNS 원문을 꼭 확인해 주세요.',providerId:row.providerId,url,publishedAt,observedAt:now(),errorCode:'PUBLICATION_PROOF_UNVERIFIED',proofChecks:checks,definitive:false,retryable:false}));}
    return view(update(row.id,{status:'published',message:'Meta API에서 발신 계정과 게시 내용을 확인했어요. 공개 화면은 별도로 확인해 주세요.',providerId:row.providerId,url,publishedAt,observedAt:now(),errorCode:null,definitive:false,retryable:false}));
  }
  // After an ambiguous final write Meta itself can settle it. An Instagram container says whether this request published
  // anything: unless it is PUBLISHED, a recent post with the same text belongs to someone else, and a FINISHED container
  // proves nothing went out. A PUBLISHED container (or a Facebook write) is matched to the one recent post with this text
  // around the final write that no other ledger row holds; two or more stay unknown. Never a resend here.
  async function reconcileUncertain(row,input){
    const id=row.id,channel=liveChannel(input.channel),ig=channel.platform==='instagram';if(channel.externalId!==(row.accountId||input.channel.externalId))return null;
    // Within SETTLE_MS of the final write Meta may still be completing it: a PUBLISHED container's post is still proof,
    // but a FINISHED container is not yet proof of non-publication, and such a check is not counted.
    const settling=Number.isFinite(Date.parse(row.submittedAt))&&stamp()-Date.parse(row.submittedAt)<SETTLE_MS;
    let api,nextPage,check;try{({api,nextPage,check}=await session(channel,{signal:input.signal,enabled:false}));}catch{return null;}
    if(!settling)update(id,{autoChecks:(row.autoChecks||0)+1});const submitted=Date.parse(row.submittedAt),anchor=Number.isFinite(submitted)?submitted:Date.parse(row.createdAt);let next=null,state=null;
    try{
      if(ig&&row.containerId){state=await api(row.containerId,{fields:'id,status_code'});if(state?.id!==row.containerId)state=null;}
      if((!ig||state?.status_code==='PUBLISHED')&&Number.isFinite(anchor)){
        const path=channel.externalId+(ig?'/media':'/feed'),fields=ig?'id,caption,timestamp,permalink':'id,message,created_time,permalink_url,is_published',seenPages=new Set(),seenPosts=new Map(),candidates=new Map();let complete=false;
        // Round outwards to retain the existing inclusive millisecond window even if
        // Meta applies exclusive second-level bounds. Recheck each returned timestamp.
        let range={since:Math.floor((anchor-MATCH_BEFORE)/1000)-1,until:Math.ceil((anchor+MATCH_AFTER)/1000)+1};
        for(let page=0;page<RECONCILE_MAX_PAGES;page++){
          const recent=await api(path,{fields,limit:RECONCILE_PAGE_SIZE,...range});
          if(!Array.isArray(recent.data)||recent.data.length>RECONCILE_PAGE_SIZE||recent.paging!=null&&(typeof recent.paging!=='object'||Array.isArray(recent.paging)))return null;
          for(const item of recent.data){
            const post=ig?graphId(item?.id):postId(item?.id),at=Date.parse(ig?item?.timestamp:item?.created_time),content=normalizeText(ig?item?.caption:item?.message);
            if(!post||!Number.isFinite(at))return null;
            const signature=canonical([at,content,ig?null:item.is_published]);if(seenPosts.has(post)&&seenPosts.get(post)!==signature)return null;seenPosts.set(post,signature);
            if(content===normalizeText(row.content)&&at>=anchor-MATCH_BEFORE&&at<=anchor+MATCH_AFTER&&(ig||item.is_published===true))candidates.set(post,item);
          }
          if(recent.paging?.next==null){complete=true;break;}
          const following=nextPage(path,recent.paging,range);if(!following)return null;const key=canonical(following);if(seenPages.has(key))return null;seenPages.add(key);range=following;
        }
        // One match on an incomplete scan is not a unique match. A lost final write
        // stays uncertain after any page/error/budget limit; no retry is opened here.
        if(!complete)return null;
        check();next=transaction(()=>{
          const live=store.get(JOBS,id);if(!live||live.status!=='uncertain'||live.providerId||live.claimToken!==row.claimToken)return null;
          const claimed=new Set(store.all(JOBS).filter(other=>other.id!==id&&other.providerId).map(other=>String(other.providerId))),matches=[...candidates.values()].filter(item=>!claimed.has(item.id));
          if(matches.length!==1)return null;
          const claimedRow={...live,status:'submitted',providerId:matches[0].id,reconciledFromUnknown:true,remoteKind:ig?'instagram':'post',message:'SNS 게시 시각 범위를 대조해 이번 글을 찾았어요. 원문을 확인해요.',errorCode:null,observedAt:now(),updatedAt:now()};store.put(JOBS,id,claimedRow);return claimedRow;
        });
      }
    }catch{return null;}
    if(next){try{return await verifyPublished(next,channel,api);}catch(error){return failure(id,error);}}
    if(!settling&&state&&state.id===row.containerId&&state.status_code==='FINISHED')return view(update(id,{status:'failed',definitive:true,retryable:true,errorCode:'NOT_SUBMITTED',message:'Instagram이 준비 파일을 게시하지 않았고 최근 게시물에도 없어요. 공개 게시 요청은 처리되지 않았으니 다시 예약할 수 있어요.'}));
    return null;
  }
  async function advance(input,{continuation=false}={}){
    const id=ledgerId(input.channel,input.job);let row=store.get(JOBS,id);const channel=liveChannel(input.channel);
    if(row.fingerprint!==fingerprint(input))throw fail('JOB_CONTENT_CHANGED','이미 준비한 예약의 승인 원문이 바뀌었어요.');
    if(row.providerId){if(channel.externalId!==(row.accountId||input.channel.externalId))return view(update(id,{status:'submitted',message:'게시 뒤 발행 계정이 바뀌어 원문을 확인하지 못해요. SNS 원문을 확인해 주세요.',errorCode:'ACCOUNT_CHANGED',definitive:false,retryable:false}));return verifyPublished(row,channel,(await session(channel,{signal:input.signal,enabled:false})).api);}
    if(row.binding!==binding(channel))throw fail('CONNECTION_CHANGED','예약을 준비한 뒤 계정 연결이 바뀌었어요.');
    const sessionValue=await session(channel,{signal:input.signal,expectedBinding:row.binding}),{api}=sessionValue;
    if(row.status==='submitting'||row.status==='uncertain')return view(row);
    // Containers usually finish within seconds: look again a few times before handing the wait back to the scheduler.
    const poll={checks:Number(containerPoll.checks??2)},settled=async read=>{let state=await read();while(state.status_code==='IN_PROGRESS'&&poll.checks-->0&&!input.signal?.aborted){await wait(Number(containerPoll.waitMs??10000),input.signal);if(input.signal?.aborted)break;sessionValue.check();state=await read();}return state;};
    await authorize(input,continuation);
    if(row.childIds?.length&&!row.containerId){
      for(const childId of row.childIds){const state=await settled(()=>api(childId,{fields:'id,status_code'}));if(state.id!==childId)throw fail('META_INVALID_RESPONSE','캐러셀 파일 처리 결과의 ID가 맞지 않아요.');if(['ERROR','EXPIRED'].includes(state.status_code))throw fail('MEDIA_PROCESSING_FAILED','Meta가 캐러셀 파일을 처리하지 못했어요. 파일을 확인하고 새로 예약해 주세요.');if(state.status_code!=='FINISHED')return view(update(id,{status:'processing',message:'Meta가 캐러셀 파일을 처리하고 있어요.',processingChecks:(row.processingChecks||0)+1}));}
      await authorize(input,continuation);sessionValue.check();
      const claim=randomUUID(),won=transaction(()=>{const live=store.get(JOBS,id);if(live.status!=='processing'||live.containerId||live.updatedAt!==row.updatedAt)return false;store.put(JOBS,id,{...live,status:'creating',claimToken:claim,updatedAt:now()});return true;});if(!won)return view(store.get(JOBS,id));
      const parent=await api(channel.externalId+'/media',{media_type:'CAROUSEL',children:row.childIds.join(','),caption:row.content},'POST');if(!graphId(parent.id))throw fail('CONTAINER_ID_MISSING','캐러셀 준비 ID를 받지 못했어요. 공개 게시 요청은 보내지 않았어요.');
      row=update(id,{status:'processing',containerId:parent.id},claim);
    }
    if(!row.containerId)throw fail('CONTAINER_ID_MISSING','Instagram 준비 ID를 찾지 못했어요.');
    const state=await settled(()=>api(row.containerId,{fields:'id,status_code'}));if(state.id!==row.containerId)throw fail('META_INVALID_RESPONSE','Instagram 파일 처리 결과의 ID가 맞지 않아요.');
    if(['ERROR','EXPIRED'].includes(state.status_code))throw fail('MEDIA_PROCESSING_FAILED','Meta가 파일을 처리하지 못했거나 준비 시간이 만료됐어요. 파일을 확인하고 새로 예약해 주세요.');
    if(state.status_code==='PUBLISHED')return view(update(id,{status:'uncertain',message:'Instagram은 준비 파일이 게시됐다고 응답했지만 게시물 ID를 확인하지 못했어요. SNS 원문을 확인해 주세요.',errorCode:'SUBMISSION_ID_UNKNOWN',definitive:false,retryable:false}));
    if(state.status_code!=='FINISHED')return view(update(id,{status:'processing',message:'Meta가 미디어를 처리하고 있어요. 완료된 뒤 승인과 권한을 다시 확인해 게시해요.',processingChecks:(row.processingChecks||0)+1}));
    await authorize(input,continuation);sessionValue.check();
    const claim=randomUUID(),won=transaction(()=>{const live=store.get(JOBS,id);if(live.status!=='processing'||live.containerId!==row.containerId||live.updatedAt!==row.updatedAt)return false;store.put(JOBS,id,{...live,status:'submitting',claimToken:claim,submittedAt:now(),updatedAt:now()});return true;});if(!won)return view(store.get(JOBS,id));
    let response;try{response=await api(channel.externalId+'/media_publish',{creation_id:row.containerId},'POST',{final:true});}catch(error){throw Object.assign(error,{finalWrite:true});}
    if(!graphId(response.id))throw fail('SUBMISSION_ID_UNKNOWN','Meta가 게시물 ID를 알려주지 않았어요.',502,{uncertain:true});
    row=update(id,{status:'submitted',providerId:response.id,remoteKind:'instagram',message:'Instagram이 게시 요청을 접수했어요.',observedAt:now()},claim);
    return verifyPublished(row,channel,api);
  }
  async function start(input,{continuation=false}={}){
      const id=ledgerId(input.channel,input.job),old=store.get(JOBS,id);if(old&&['submitting','uncertain','submitted','processing','published','creating'].includes(old.status))return view(old);
      if(old?.status==='preparing'&&old.errorCode!=='MEDIA_DELIVERY_BUSY'&&Date.parse(old.updatedAt)>stamp()-LEASE)return view(old);
      if(old?.status==='failed'&&(!old.definitive||(Number(input.job.attempts)||0)<=(old.attemptNumber||0)))return view(old);
      const channel=liveChannel(input.channel),cap=capability(channel);if(!cap.canPublish)return result('manual_required',cap.reason,{errorCode:cap.errorCode});
      let prepared;try{prepared=validate(input);}catch(error){const safe=safeError(error);return result(['FORMAT_MANUAL_REQUIRED','OPTIONS_MANUAL_REQUIRED'].includes(safe.code)?'manual_required':'failed',safe.message,{errorCode:safe.code});}
      const signature=fingerprint(input);if(old?.fingerprint&&old.fingerprint!==signature)return result('failed','이미 준비한 작업의 승인 원문이 바뀌었어요.',{errorCode:'JOB_CONTENT_CHANGED'});
      const initial={id,provider:'meta-direct',channelId:channel.id,accountId:channel.externalId,jobId:input.job.id,busyChecks:old?.errorCode==='MEDIA_DELIVERY_BUSY'?old.busyChecks||0:0,attemptNumber:Number(input.job.attempts)||0,claimToken:randomUUID(),fingerprint:signature,binding:binding(channel),content:prepared.content,status:'preparing',createdAt:old?.createdAt||now(),updatedAt:now(),definitive:false,retryable:false};
      const won=transaction(()=>{const live=store.get(JOBS,id);if(live&&(live.claimToken!==old?.claimToken||live.updatedAt!==old?.updatedAt||live.status!==old?.status))return false;store.put(JOBS,id,initial);return true;});if(!won)return view(store.get(JOBS,id));
      try{
        await authorize(input,continuation);const account=await session(channel,{signal:input.signal,expectedBinding:initial.binding}),urls=[];
        for(const ref of prepared.media){urls.push(await mediaUrl(ref,input,continuation));account.check();await authorize(input,continuation);}
        if(channel.platform==='facebook'){
          await authorize(input,continuation);account.check();const claim=initial.claimToken;
          transaction(()=>{const live=store.get(JOBS,id);if(live.claimToken!==claim||live.status!=='preparing')throw fail('PREPARATION_SUPERSEDED','이 발행 준비를 다른 실행이 처리하고 있어요.');store.put(JOBS,id,{...live,status:'submitting',submittedAt:now(),updatedAt:now()});});
          const params=urls.length?{url:urls[0],caption:prepared.content,published:true,...(prepared.options.altText?{alt_text_custom:prepared.options.altText}:{})}:{message:prepared.content,...(prepared.options.link?{link:publicUrl(prepared.options.link)}:{}),published:true};
          let response;try{response=await account.api(channel.externalId+(urls.length?'/photos':'/feed'),params,'POST',{final:true});}catch(error){throw Object.assign(error,{finalWrite:true});}const remoteId=postId(response.post_id)||postId(response.id);
          if(!remoteId)throw fail('SUBMISSION_ID_UNKNOWN','Meta가 게시물 ID를 알려주지 않았어요.',502,{uncertain:true});
          const row=update(id,{status:'submitted',providerId:remoteId,remoteKind:urls.length&&!response.post_id?'photo':'post',message:'Facebook이 게시 요청을 접수했어요.',observedAt:now()},claim);return await verifyPublished(row,channel,account.api);
        }
        const childIds=[];
        if(prepared.media.length>1){for(let n=0;n<urls.length;n++){await authorize(input,continuation);account.check();const created=await account.api(channel.externalId+'/media',{image_url:urls[n],is_carousel_item:true,...(prepared.media[n].alt||prepared.options.altText?{alt_text:prepared.media[n].alt||prepared.options.altText}:{})},'POST');if(!graphId(created.id))throw fail('CONTAINER_ID_MISSING','사진 준비 ID를 받지 못했어요. 공개 게시 요청은 보내지 않았어요.');childIds.push(created.id);update(id,{childIds:[...childIds]},initial.claimToken);}update(id,{status:'processing',childIds},initial.claimToken);}
        else{const params=prepared.reel?{media_type:'REELS',video_url:urls[0],caption:prepared.content,share_to_feed:prepared.options.shareToFeed!==false,...(prepared.options.thumbnailTimestamp!==undefined?{thumb_offset:prepared.options.thumbnailTimestamp}:{})}:{image_url:urls[0],caption:prepared.content,...(prepared.media[0]?.alt||prepared.options.altText?{alt_text:prepared.media[0]?.alt||prepared.options.altText}:{})};await authorize(input,continuation);account.check();const created=await account.api(channel.externalId+'/media',params,'POST');if(!graphId(created.id))throw fail('CONTAINER_ID_MISSING','사진·릴스 준비 ID를 받지 못했어요. 공개 게시 요청은 보내지 않았어요.');update(id,{status:'processing',containerId:created.id},initial.claimToken);}
        return await advance(input,{continuation});
      }catch(error){return failure(id,error);}
  }
  async function publish(input){
    if(!input?.channel?.id||!input.job?.id)throw fail('JOB_REQUIRED','승인한 예약 작업 정보가 필요해요.');
    const id=ledgerId(input.channel,input.job);if(inFlight.has(id))return inFlight.get(id);
    const work=start(input);inFlight.set(id,work);try{return await work;}finally{inFlight.delete(id);}
  }
  async function status(input){
    if(!input?.channel?.id||!input.job?.id)return result('uncertain','발행 작업과 계정을 확인해 주세요.',{errorCode:'JOB_REQUIRED'});
    const id=ledgerId(input.channel,input.job);if(inFlight.has(id))return inFlight.get(id);
    const work=(async()=>{const row=store.get(JOBS,id);if(!row)return result('uncertain','이 직접 발행의 전송 기록을 찾지 못했어요.',{errorCode:'SUBMISSION_NOT_FOUND'});
      if(row.status==='uncertain'&&!row.providerId&&['SUBMISSION_RESULT_UNKNOWN','SUBMISSION_ID_UNKNOWN'].includes(row.errorCode)&&(row.autoChecks||0)<AUTO_CHECKS){const settled=await reconcileUncertain(row,input);if(settled)return settled;}
      if(['published','failed','uncertain','submitting'].includes(row.status))return view(row);
      const resumed={...input,post:input.job.snapshot?.post,variant:input.job.snapshot?.variant};
      if(row.status==='preparing'&&row.errorCode==='MEDIA_DELIVERY_BUSY'&&resumed.post&&resumed.variant)return await start(resumed,{continuation:true});
      if(['preparing','creating'].includes(row.status)){if(Date.parse(row.updatedAt)<=stamp()-LEASE)return view(update(id,{status:'failed',definitive:true,retryable:true,errorCode:'NOT_SUBMITTED',message:'미디어 준비 중 실행이 멈췄어요. 공개 게시 요청은 보내지 않았어요.'}));return view(row);}
      try{if(!resumed.post||!resumed.variant)throw fail('SNAPSHOT_REQUIRED','승인한 게시 원문을 확인하지 못했어요.');return await advance(resumed,{continuation:true});}catch(error){if(row.status==='processing'&&error.retryable){const safe=safeError(error);return view(update(id,{message:safe.message,errorCode:safe.code,nextRetryAt:safe.nextRetryAt}));}return failure(id,error);}
    })();inFlight.set(id,work);try{return await work;}finally{inFlight.delete(id);}
  }
  return {capability,preflight,publish,status,checkConnection};
}
