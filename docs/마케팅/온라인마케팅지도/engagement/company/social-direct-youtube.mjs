import {createHash,randomUUID} from 'node:crypto';

// Official API contracts checked 2026-10-14:
// https://developers.google.com/youtube/v3/docs/videos/insert
// https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
// https://developers.google.com/youtube/v3/docs/channels/list
// https://support.google.com/youtube/answer/15424877
// An upload receipt is not proof of completed processing or public visibility.
// Lost responses are reconciled against the SAME encrypted upload session;
// no new session or overlapping bytes are sent after an ambiguous media PUT.
const PROVIDER='youtube-direct',JOBS='socialDirectPublishJobs',LINKS='socialDirectConnections',REQUESTS='socialDirectPublishRequests';
const MAX_BYTES=100*1024*1024,MAX_RESPONSE=1024*1024,LEASE=180000,PROOF_CHECKS=3,CHUNK_UNIT=262144,RECHECK=[15000,30000,60000,120000,120000,120000],CREDENTIAL_CODES=new Set(['CHANNEL_INACTIVE','COLLECTION_DISABLED','CONNECTION_CHANGED','CONNECTION_OWNER_INACTIVE']);
const normalizeText=value=>String(value??'').normalize('NFC').replace(/\r\n?/g,'\n').split('\n').map(line=>line.replace(/[ \t]+$/,'')).join('\n').trim();
const SCOPES=['https://www.googleapis.com/auth/youtube.upload','https://www.googleapis.com/auth/youtube.readonly'];
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:canonical(value)).digest('hex');
const fail=(code,message,status=409,extra={})=>Object.assign(new Error(message),{code,status,providerSafe:true,...extra});
const channelId=value=>typeof value==='string'&&/^UC[A-Za-z0-9_-]{22}$/.test(value);
const videoId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{11}$/.test(value);
const scopes=credentials=>new Set(String(credentials?.scope||'').split(/[ ,]+/).filter(Boolean));
const credentialFingerprint=credentials=>hash(['authType','accountId','accessToken','refreshToken','scope','expiresAt','refreshExpiresAt','permissionsVerifiedAt'].map(key=>credentials?.[key]??null));
const filled=value=>value!==undefined&&value!==null&&value!==''&&value!==false&&!(Array.isArray(value)&&!value.length);
const SPEC={formats:['video','shorts','youtube-video','youtube-shorts'],maxTextLength:5000,maxMediaCount:1,mediaTypes:['video/mp4'],maxVideoBytes:MAX_BYTES,options:['privacy','madeForKids','hashtags','madeWithAi','notifySubscribers'],requiredOptions:['privacy','madeForKids']};
const result=(status,message,extra={})=>({provider:PROVIDER,status,message,retryable:false,definitive:false,publicVerified:false,...extra});
function sessionUrl(raw){
  let url;try{url=new URL(raw);}catch{throw fail('YOUTUBE_SESSION_INVALID','YouTube 업로드 연결 주소를 확인하지 못했어요.');}
  if(typeof raw!=='string'||raw.length>8192||/[\u0000-\u0020\\]/u.test(raw)||url.protocol!=='https:'||!['www.googleapis.com','youtube.googleapis.com'].includes(url.hostname)||url.port||url.username||url.password||url.hash||url.pathname!=='/upload/youtube/v3/videos'||!url.searchParams.get('upload_id')||url.searchParams.getAll('upload_id').length!==1||url.searchParams.get('uploadType')!=='resumable')throw fail('YOUTUBE_SESSION_INVALID','YouTube 업로드 연결 주소를 확인하지 못했어요.');
  return url.href;
}
export function createSocialDirectYouTube({store,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),getCredentials,resolveMedia,authorizePublish,uploadChunkBytes=8*1024*1024,uploadBudgetMs=30000}={}){
  if(!store)throw new TypeError('store is required');
  if(!Number.isSafeInteger(uploadChunkBytes)||uploadChunkBytes<CHUNK_UNIT||uploadChunkBytes%CHUNK_UNIT||!Number.isFinite(uploadBudgetMs)||uploadBudgetMs<=0)throw new TypeError('uploadChunkBytes must be a positive multiple of 256KiB and uploadBudgetMs a positive number of milliseconds');
  const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now()),active=new Map();
  const transaction=fn=>typeof store.transaction==='function'?store.transaction(fn):fn();
  const live=channel=>store.get('channels',channel?.id)||channel,secret=channel=>store.secret('channel:'+channel.id);
  const ledgerId=input=>hash([PROVIDER,input.channel.id,input.job.idempotencyKey||input.job.id]);
  const mediaSecret=id=>'youtube-upload:'+id;
  const binding=channel=>{channel=live(channel);const link=store.get(LINKS,channel.id),c=secret(channel);return hash([channel.id,channel.platform,channel.externalId,channel.connectionVersion||0,channel.active,channel.hidden,channel.collectionDisabled,channel.ownerIds,channel.teamId,link?.version,link?.enabled,link?.connectionVersion,link?.accountId,link?.authType,c?.authType,c?.accountId]);};
  const fingerprint=input=>hash({post:input.post,variant:input.variant,contentVersion:input.job.contentVersion,approvalHash:input.job.approvalHash});
  const canRefresh=c=>typeof getCredentials==='function'&&typeof c?.refreshToken==='string'&&c.refreshToken.trim().length>0&&!/[\r\n]/.test(c.refreshToken)&&(!c.refreshExpiresAt||Number.isFinite(Date.parse(c.refreshExpiresAt))&&Date.parse(c.refreshExpiresAt)>stamp());
  function issue(channel,c,{enabled=true,allowRefresh=false}={}){
    if(channel?.platform!=='youtube')return ['UNSUPPORTED_PLATFORM','YouTube 채널을 선택해 주세요.'];
    if(channel.active===false||channel.hidden||channel.collectionDisabled)return ['CHANNEL_DISABLED','채널을 활성화하고 연결을 확인해 주세요.'];
    if(!channelId(channel.externalId)||c?.authType!=='google-oauth'||!c.accessToken||/[\r\n]/.test(c.accessToken))return ['NOT_CONNECTED','YouTube 업로드 권한으로 채널을 연결해 주세요.'];
    if(c.accountId!==channel.externalId)return ['ACCOUNT_MISMATCH','연결한 YouTube 채널과 게시 대상이 달라요.'];
    if(!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=stamp()&&!(allowRefresh&&canRefresh(c)))return ['AUTH_REQUIRED','YouTube 연결을 갱신하거나 다시 연결해 주세요.'];
    const missing=SCOPES.filter(value=>!scopes(c).has(value));
    if(missing.length||!Number.isFinite(Date.parse(c.permissionsVerifiedAt)))return ['SCOPES_REQUIRED','서버에서 확인한 YouTube 업로드·조회 권한이 필요해요.',missing];
    if(enabled){const link=store.get(LINKS,channel.id);if(!link?.enabled||!link.version||link.connectionVersion!==(channel.connectionVersion||0)||link.accountId!==channel.externalId||link.authType!==c.authType)return ['NOT_CONFIGURED','이 채널의 자동 게시를 확인하고 켜 주세요.'];}
    return null;
  }
  function capability(channel){channel=live(channel);const credentials=channel&&secret(channel),problem=issue(channel,credentials,{allowRefresh:true}),link=channel&&store.get(LINKS,channel.id);return {provider:PROVIDER,...SPEC,mode:problem?'manual':'automatic',canPublish:!problem,needsTokenRefresh:!problem&&Date.parse(credentials.expiresAt)<=stamp(),reason:problem?.[1]||null,errorCode:problem?.[0]||null,missingScopes:problem?.[2]||[],requiredScopes:SCOPES,connection:link?{status:problem?'needs_check':'connected',integrationId:channel.externalId,name:channel.displayName||channel.name||channel.id,profile:channel.handle||'',checkedAt:link.checkedAt||link.verifiedAt||null}:null};}
  function validate({channel,post={},variant={}}={}){
    if(channel?.platform!=='youtube'||!SPEC.formats.includes(variant.format))throw fail('FORMAT_MANUAL_REQUIRED','YouTube 동영상·쇼츠 형식을 선택해 주세요.');
    const options=variant.options||{},media=variant.media||post.media||[],title=variant.title||post.title||'';
    if(typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>key!=='notifyOnly'&&!SPEC.options.includes(key)&&filled(options[key])))throw fail('OPTIONS_MANUAL_REQUIRED','이 YouTube 연결에서 지원하지 않는 옵션은 앱에서 마무리해 주세요.');
    if(options.notifyOnly===true)throw fail('FORMAT_MANUAL_REQUIRED','YouTube에서 직접 마무리하도록 선택한 게시물이에요.');
    if(typeof title!=='string'||!title.trim()||[...title].length>100||/[<>]/.test(title))throw fail('YOUTUBE_TITLE_REQUIRED','YouTube 제목을 1~100자로 입력하고 꺾쇠 문자를 빼 주세요.');
    if(!['public','unlisted','private'].includes(options.privacy)||typeof options.madeForKids!=='boolean')throw fail('YOUTUBE_DECLARATION_REQUIRED','공개 범위와 아동용 콘텐츠 여부를 직접 선택해 주세요.');
    for(const key of ['madeWithAi','notifySubscribers'])if(options[key]!==undefined&&typeof options[key]!=='boolean')throw fail('INVALID_OPTIONS','YouTube 게시 옵션을 확인해 주세요.');
    const tags=options.hashtags;if(tags!==undefined&&typeof tags!=='string'&&(!Array.isArray(tags)||tags.some(value=>typeof value!=='string')))throw fail('INVALID_HASHTAGS','해시태그를 글자나 글자 목록으로 입력해 주세요.');
    const description=String(variant.text??post.body??'')+(filled(tags)?'\n\n'+(Array.isArray(tags)?tags.join(' '):tags):'');
    if(Buffer.byteLength(description)>5000||/[<>]/.test(description))throw fail('TEXT_TOO_LONG','YouTube 설명은 5,000바이트 이내로 준비하고 꺾쇠 문자를 빼 주세요.');
    const ref=media[0];if(!Array.isArray(media)||media.length!==1||ref?.mimeType!=='video/mp4'||!ref.assetId&&!ref.id||!/^[a-f0-9]{64}$/.test(ref.sha256||''))throw fail('APPROVED_MEDIA_REQUIRED','워크스페이스에 업로드하고 승인한 MP4 파일 한 개를 선택해 주세요.');
    if(!Number.isSafeInteger(ref.byteSize)||ref.byteSize<12||ref.byteSize>MAX_BYTES)throw fail('MEDIA_TOO_LARGE','직접 업로드는 100MiB 이하 MP4 파일을 지원해요.');
    if(['shorts','youtube-shorts'].includes(variant.format)){
      const duration=ref.duration??ref.durationSeconds;
      if(!Number.isFinite(ref.width)||!Number.isFinite(ref.height)||ref.width<=0||ref.height<ref.width||!Number.isFinite(duration)||duration<=0||duration>180)throw fail('YOUTUBE_SHORTS_FORMAT','쇼츠는 실측한 정사각형·세로 영상이고 길이가 3분 이하여야 해요. 다른 영상은 동영상 형식을 선택해 주세요.');
    }
    return {ref,metadata:{snippet:{title,description},status:{privacyStatus:options.privacy,selfDeclaredMadeForKids:options.madeForKids,...(options.madeWithAi===undefined?{}:{containsSyntheticMedia:options.madeWithAi})}},notifySubscribers:options.notifySubscribers!==false};
  }
  function preflight(input){try{validate(input);return {valid:true,errors:[],warnings:['shorts','youtube-shorts'].includes(input.variant.format)?[{code:'SHORTS_CLASSIFICATION',message:'쇼츠 분류는 업로드한 영상 조건에 따라 YouTube가 결정해요.'}]:[]};}catch(error){return {valid:false,errors:[{code:error.code||'YOUTUBE_PREPARATION_FAILED',message:error.providerSafe?error.message:'YouTube 게시 정보를 확인해 주세요.'}],warnings:[]};}}
  function reserve(channel){transaction(()=>{const key=PROVIDER+':'+channel.id,row=store.get(REQUESTS,key)||{},times=(row.times||[]).filter(value=>value>stamp()-3600000);if(times.length>=120||row.retryAt>stamp())throw fail('YOUTUBE_RATE_LIMIT','YouTube 연결 요청이 많아요. 잠시 후 다시 확인해 주세요.',429);store.put(REQUESTS,key,{provider:PROVIDER,channelId:channel.id,times:[...times,stamp()],retryAt:row.retryAt||null});});}
  async function session(channel,{signal,authorize=()=>{},enabled=true,expectedBinding}={}){
    const original=expectedBinding||binding(channel),checkBase=()=>{authorize();if(signal?.aborted)throw fail('PUBLISH_CANCELLED','YouTube 게시 준비가 중단됐어요.');if(binding(channel)!==original)throw fail('CONNECTION_CHANGED','YouTube 계정이나 자동 게시 설정이 바뀌었어요.');};
    checkBase();let credentials;try{credentials=await(getCredentials?getCredentials(live(channel)):secret(channel));}catch(error){if(CREDENTIAL_CODES.has(error?.code))throw fail(error.code,String(error.message||'채널 연결을 확인해 주세요.').slice(0,300),409,{retryable:true});throw error;}checkBase();
    if(credentialFingerprint(credentials)!==credentialFingerprint(secret(channel)))throw fail('CONNECTION_CHANGED','저장한 YouTube 인증 정보가 바뀌었어요.');
    const problem=issue(live(channel),credentials,{enabled});if(problem)throw fail(problem[0],problem[1]);
    const credentialPin=credentialFingerprint(credentials),check=()=>{checkBase();if(credentialFingerprint(secret(channel))!==credentialPin)throw fail('CONNECTION_CHANGED','처리 중에 YouTube 인증 정보가 바뀌었어요.');};
    async function request(url,{method='GET',body,headers={}}={}){
      check();reserve(channel);let response;
      try{response=await fetchImpl(url,{method,body,headers:{Authorization:'Bearer '+credentials.accessToken,Accept:'application/json','Cache-Control':'no-store',...headers},redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(90000)]):AbortSignal.timeout(90000)});}catch{throw fail('YOUTUBE_NETWORK','YouTube 응답을 확인하지 못했어요.',502);}
      if(method==='GET')check();return response;
    }
    async function json(response){
      let payload;try{if(Number(response.headers?.get?.('content-length')||0)>MAX_RESPONSE)throw Error();const raw=await response.text();if(Buffer.byteLength(raw)>MAX_RESPONSE)throw Error();payload=JSON.parse(raw);}catch{throw fail('YOUTUBE_INVALID_RESPONSE','YouTube 결과를 읽지 못했어요.',502);}
      if(response.status<200||response.status>=300||payload?.error)throw fail([401,403].includes(response.status)?'AUTH_REQUIRED':'YOUTUBE_REQUEST_REJECTED','YouTube가 요청을 완료하지 못했어요. 연결 권한과 할당량을 확인해 주세요.',409);
      return payload;
    }
    const account=await json(await request('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&maxResults=50'));
    if(!Array.isArray(account.items)||account.items.length!==1||account.items[0].id!==channel.externalId)throw fail('ACCOUNT_MISMATCH','로그인한 YouTube 채널과 승인한 게시 대상이 달라요.');
    check();return {request,json,check};
  }
  async function checkConnection(channel,context={}){channel=live(channel);await session(channel,{...context,enabled:false});return {provider:PROVIDER,accountId:channel.externalId,authType:'google-oauth',checkedAt:now(),requiredScopes:SCOPES,canPublish:true};}
  const recheck=row=>row.resume===true&&!['published','failed'].includes(row.status)?RECHECK[0]:row.status==='processing'&&row.processingChecks>0&&row.processingChecks<=RECHECK.length?RECHECK[row.processingChecks-1]:undefined;
  const view=row=>result(['initializing','ready','uploading'].includes(row.status)?'processing':row.status,row.message||'YouTube 업로드 결과를 확인하고 있어요.',{providerId:row.providerId||null,requestId:row.id,url:row.providerId?'https://www.youtube.com/watch?v='+row.providerId:null,publishedAt:row.publishedAt||null,observedAt:row.observedAt||null,errorCode:row.errorCode||null,retryable:row.retryable===true,definitive:row.definitive===true,...(recheck(row)?{checkAfterMs:recheck(row)}:{})});
  function update(id,changes,claim){return transaction(()=>{const row=store.get(JOBS,id);if(!row||claim&&row.claimToken!==claim||row.status==='published'&&changes.status!=='published')return row;const next={...row,...changes,updatedAt:now()};store.put(JOBS,id,next);return next;});}
  async function authorize(input,continuation){if(typeof authorizePublish!=='function')throw fail('PUBLISH_AUTHORIZATION_REQUIRED','게시 승인 검증이 연결되지 않았어요.');await authorizePublish({...input,continuation});if(input.signal?.aborted)throw fail('PUBLISH_CANCELLED','YouTube 게시 준비가 중단됐어요.');}
  async function approvedBytes(input,ref){if(typeof resolveMedia!=='function')throw fail('LOCAL_MEDIA_UNAVAILABLE','승인한 영상 파일을 읽을 수 없어요.');const media=await resolveMedia(ref,input),bytes=Buffer.isBuffer(media?.bytes)?media.bytes:Buffer.from(media?.bytes||[]);if(bytes.length!==ref.byteSize||bytes.subarray(4,8).toString()!=='ftyp'||!['isom','iso2','mp41','mp42','avc1','M4V ','dash','msnv'].includes(bytes.subarray(8,12).toString())||hash(bytes)!==ref.sha256)throw fail('MEDIA_CONTENT_CHANGED','승인한 MP4 파일의 내용이나 크기가 바뀌었어요.');return bytes;}
  function failure(id,error,claim){const row=store.get(JOBS,id);if(row&&claim&&row.claimToken!==claim)return view(row);if(!row)return result('failed',error.providerSafe?error.message:'YouTube 게시 준비를 완료하지 못했어요.',{errorCode:error.code||'YOUTUBE_FAILED',definitive:true,retryable:error.retryable===true});if(row.status==='published')return view(row);const sent=row.bytesAttempted===true;return view(update(id,{status:sent?'uncertain':'failed',message:error.providerSafe?error.message:'YouTube 결과를 확인하지 못했어요. 확인 전까지 다시 보내지 않아요.',errorCode:error.code||'YOUTUBE_FAILED',proofChecks:error.proofCheck?(row.proofChecks||0)+1:row.proofChecks||0,resume:false,definitive:!sent,retryable:false,leaseUntil:null}));}
  async function verifyVideo(row,account){
    const remote=await account.json(await account.request('https://www.googleapis.com/youtube/v3/videos?part=snippet,status,processingDetails&id='+encodeURIComponent(row.providerId)));
    const video=remote.items?.find(item=>item.id===row.providerId),expected=row.metadata;
    if(!video||video.snippet?.channelId!==row.accountId)throw fail('PUBLICATION_PROOF_MISMATCH','업로드 영상이 승인한 채널에 있는지 확인하지 못했어요.');
    if(['deleted','failed','rejected'].includes(video.status?.uploadStatus))return view(update(row.id,{status:'failed',definitive:true,retryable:false,message:'YouTube가 업로드 영상을 처리하지 못했어요. YouTube Studio에서 사유를 확인하세요.',errorCode:'YOUTUBE_PROCESSING_FAILED',leaseUntil:null}));
    if(video.status?.uploadStatus!=='processed'||video.processingDetails?.processingStatus&&video.processingDetails.processingStatus!=='succeeded')return view(update(row.id,{status:'processing',message:'YouTube가 영상을 처리하고 있어요. 다시 업로드하지 않고 완료 상태를 확인해요.',processingChecks:(row.processingChecks||0)+1,resume:false,leaseUntil:null}));
    const date=video.snippet.publishedAt,publishedAt=typeof date==='string'&&Number.isFinite(Date.parse(date))?new Date(date).toISOString():null;
    const textOk=normalizeText(video.snippet.title)===normalizeText(expected.snippet.title)&&normalizeText(video.snippet.description)===normalizeText(expected.snippet.description),optionsOk=video.status?.privacyStatus===expected.status.privacyStatus&&video.status?.selfDeclaredMadeForKids===expected.status.selfDeclaredMadeForKids&&(expected.status.containsSyntheticMedia===undefined||video.status?.containsSyntheticMedia===expected.status.containsSyntheticMedia),timeOk=!!publishedAt&&Date.parse(publishedAt)>=Date.parse(row.createdAt)-300000&&Date.parse(publishedAt)<=stamp()+300000;
    const mismatch=!textOk?['PUBLICATION_PROOF_MISMATCH','제목이나 설명이 승인한 내용과 달라요.']:!optionsOk?['PUBLICATION_OPTIONS_MISMATCH','공개 범위·아동용·AI 표시가 승인한 설정과 달라요.']:!timeOk?['PUBLICATION_TIME_MISMATCH','게시 시각이 이번 업로드와 맞지 않아요.']:null;
    // Repeated reads of the same receipt cannot prove the approved content or privacy.
    // Keep the receipt for read-only reconciliation and never create another upload.
    if(mismatch){const checks=(row.proofChecks||0)+1;if(checks<PROOF_CHECKS)throw fail(mismatch[0],mismatch[1]+' YouTube Studio를 확인하세요.',409,{proofCheck:true});return view(update(row.id,{status:'uncertain',message:'YouTube 업로드 ID는 확인했지만 '+mismatch[1]+' '+checks+'회 확인해도 설정이 일치하지 않아 게시 완료를 확정하지 않았어요. YouTube Studio에서 확인한 뒤 결과를 다시 조회해 주세요.',observedAt:now(),errorCode:mismatch[0],proofChecks:checks,resume:false,definitive:false,retryable:false,leaseUntil:null}));}
    return view(update(row.id,{status:'published',message:'YouTube API에서 업로드 완료와 승인한 공개 범위를 확인했어요. 실제 시청 화면은 별도로 확인해 주세요.',publishedAt,observedAt:now(),errorCode:null,leaseUntil:null}));
  }
  async function receipt(row,response,account){
    if(response.status===308){const range=response.headers?.get?.('range'),match=range&&/^bytes=0-(\d+)$/.exec(range);if(range&&!match)throw fail('YOUTUBE_RANGE_INVALID','업로드 받은 범위를 확인하지 못했어요.');const offset=match?Number(match[1])+1:0;if(!Number.isSafeInteger(offset)||offset<row.confirmedOffset||offset>=row.byteSize)throw fail('YOUTUBE_RANGE_INVALID','YouTube가 확인한 업로드 범위가 올바르지 않아요.');return {offset};}
    if(response.status===200||response.status===201){const data=await account.json(response);if(!videoId(data.id))throw fail('YOUTUBE_VIDEO_ID_MISSING','YouTube 업로드 ID를 확인하지 못했어요.');row=update(row.id,{providerId:data.id,status:'submitted',leaseUntil:null,resume:false});return {result:await verifyVideo(row,account)};}
    if(response.status===404)throw fail('YOUTUBE_SESSION_EXPIRED','업로드 연결이 만료됐어요. 중복 업로드를 막기 위해 YouTube Studio에서 실제 결과를 먼저 확인해 주세요.');
    throw fail('YOUTUBE_UPLOAD_UNCONFIRMED','YouTube 업로드 완료를 확인하지 못했어요. 같은 업로드 연결로 결과만 다시 확인해요.',502);
  }
  async function advance(input,{continuation=false,initial=false,bytes=null}={}){
    const id=ledgerId(input),channel=live(input.channel);let row=store.get(JOBS,id);
    if(row.fingerprint!==fingerprint(input))throw fail('JOB_CONTENT_CHANGED','게시 계정·승인 원문이 준비된 업로드와 달라졌어요.');
    if(row.providerId){if(channel.externalId!==row.accountId)return view(update(id,{message:'게시 뒤 YouTube 채널 연결이 바뀌어 결과를 확인하지 못해요. YouTube Studio에서 확인해 주세요.',errorCode:'ACCOUNT_CHANGED',leaseUntil:null}));return verifyVideo(row,await session(channel,{signal:input.signal,enabled:false}));}
    if(row.binding!==binding(channel))throw fail('JOB_CONTENT_CHANGED','게시 계정·승인 원문이 준비된 업로드와 달라졌어요.');
    const account=await session(channel,{signal:input.signal,expectedBinding:row.binding});
    const saved=store.secret(mediaSecret(id)),url=sessionUrl(saved?.url);
    let offset=0;
    if(!initial){const probe=await receipt(row,await account.request(url,{method:'PUT',body:Buffer.alloc(0),headers:{'Content-Length':'0','Content-Range':'bytes */'+row.byteSize}}),account);if(probe.result)return probe.result;offset=probe.offset;}
    const prepared=validate(input);bytes=bytes||await approvedBytes(input,prepared.ref);await authorize(input,continuation);account.check();
    const claim=randomUUID(),claimed=transaction(()=>{const current=store.get(JOBS,id);if(current.claimToken!==row.claimToken||current.providerId||current.status==='published'||current.leaseUntil&&Date.parse(current.leaseUntil)>stamp()&&current.status==='uploading')return false;store.put(JOBS,id,{...current,status:'uploading',bytesAttempted:true,confirmedOffset:offset,resume:false,claimToken:claim,leaseUntil:new Date(stamp()+LEASE).toISOString(),updatedAt:now()});return true;});
    if(!claimed)return view(store.get(JOBS,id));
    const started=stamp();
    try{
      // Chunks of uploadChunkBytes (a 256KiB multiple) keep every PUT inside its own timeout; a resume continues from the byte YouTube confirmed.
      for(;;){
        const end=Math.min(offset+uploadChunkBytes,bytes.length),final=end===bytes.length;let response;
        try{response=await account.request(url,{method:'PUT',body:bytes.subarray(offset,end),headers:{'Content-Type':'video/mp4','Content-Length':String(end-offset),'Content-Range':'bytes '+offset+'-'+(end-1)+'/'+bytes.length}});}
        catch(error){if(error.code!=='YOUTUBE_NETWORK')throw error;if(final)return view(update(id,{status:'uncertain',message:'마지막 영상 조각의 응답을 받지 못했어요. 같은 업로드 연결로 받은 범위를 확인하기 전까지 다시 보내지 않아요.',errorCode:'YOUTUBE_NETWORK',definitive:false,retryable:false,resume:true,leaseUntil:null},claim));return view(update(id,{status:'processing',confirmedOffset:offset,message:'영상 조각을 보내다 연결이 끊겼어요. 받은 범위를 확인하고 이어서 보내요.',errorCode:'YOUTUBE_UPLOAD_INTERRUPTED',resume:true,leaseUntil:null},claim));}
        const accepted=await receipt(store.get(JOBS,id),response,account);if(accepted.result)return accepted.result;
        if(accepted.offset!==end)return view(update(id,{status:'processing',confirmedOffset:accepted.offset,message:'YouTube가 영상 일부를 받았어요. 받은 범위를 확인하고 남은 부분만 이어서 보내요.',errorCode:null,resume:true,leaseUntil:null},claim));
        offset=end;update(id,{confirmedOffset:offset,leaseUntil:new Date(stamp()+LEASE).toISOString()},claim);
        if(stamp()-started>=uploadBudgetMs||input.signal?.aborted)return view(update(id,{status:'processing',confirmedOffset:offset,message:'영상을 나눠 보내는 중이에요. 다음 확인에서 이어서 보내요.',errorCode:null,resume:true,leaseUntil:null},claim));
      }
    }catch(error){return failure(id,error,claim);}
  }
  async function publish(input){
    if(!input?.channel?.id||!input.job?.id)throw fail('JOB_REQUIRED','승인한 YouTube 예약 작업이 필요해요.');
    const id=ledgerId(input);if(active.has(id))return active.get(id);const prior=store.get(JOBS,id);
    // Only an explicit reschedule executed by the scheduler may replace a
    // definitively unsent attempt. Status polling never opens a new session,
    // and any attempted video bytes permanently exclude this retry path.
    const retryUnsent=prior?.status==='failed'&&prior.definitive===true&&prior.bytesAttempted!==true&&
      (Number(input.job.attempts)||0)>(prior.attemptNumber||0)&&(Number(input.job.scheduleRevision)||1)>(prior.scheduleRevision||1);
    if(prior&&!retryUnsent)return status({...input,job:{...input.job,snapshot:input.job.snapshot||{post:input.post,variant:input.variant}}});
    if(prior&&prior.fingerprint!==fingerprint(input))return result('failed','실패한 예약의 승인 원문이 바뀌었어요. 새 원문으로 다시 승인하고 예약해 주세요.',{errorCode:'JOB_CONTENT_CHANGED',definitive:true});
    const work=(async()=>{let ownedClaim=prior?.claimToken;try{
      const prepared=validate(input),channel=live(input.channel),original=binding(channel);await authorize(input,false);const account=await session(channel,{signal:input.signal,expectedBinding:original});const bytes=await approvedBytes(input,prepared.ref);await authorize(input,false);account.check();
      const claim=randomUUID(),won=transaction(()=>{const current=store.get(JOBS,id);if(current&&(!retryUnsent||current.claimToken!==prior.claimToken||current.status!=='failed'||current.updatedAt!==prior.updatedAt||current.bytesAttempted===true))return false;if(retryUnsent)store.setSecret(mediaSecret(id),null);store.put(JOBS,id,{id,provider:PROVIDER,jobId:input.job.id,channelId:channel.id,accountId:channel.externalId,binding:original,fingerprint:fingerprint(input),metadata:prepared.metadata,byteSize:prepared.ref.byteSize,confirmedOffset:0,bytesAttempted:false,attemptNumber:Number(input.job.attempts)||0,scheduleRevision:Number(input.job.scheduleRevision)||1,status:'initializing',claimToken:claim,createdAt:now(),updatedAt:now(),leaseUntil:new Date(stamp()+LEASE).toISOString()});return true;});if(!won)return view(store.get(JOBS,id));ownedClaim=claim;
      const response=await account.request('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers='+String(prepared.notifySubscribers),{method:'POST',body:JSON.stringify(prepared.metadata),headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Length':String(prepared.ref.byteSize),'X-Upload-Content-Type':'video/mp4'}});
      if(response.status!==200&&response.status!==201)throw fail('YOUTUBE_SESSION_FAILED','YouTube 업로드 준비를 완료하지 못했어요. 권한과 할당량을 확인해 주세요.');
      const url=sessionUrl(response.headers?.get?.('location'));account.check();const saved=transaction(()=>{const current=store.get(JOBS,id);if(current.claimToken!==claim||current.status!=='initializing')return false;store.setSecret(mediaSecret(id),{url,createdAt:now()});store.put(JOBS,id,{...current,status:'ready',leaseUntil:null,updatedAt:now()});return true;});if(!saved)return view(store.get(JOBS,id));
      return await advance(input,{initial:true,bytes});
    }catch(error){const current=store.get(JOBS,id);return !ownedClaim&&current?view(current):failure(id,error,ownedClaim);}})();active.set(id,work);try{return await work;}finally{active.delete(id);}
  }
  async function status(input){
    if(!input?.channel?.id||!input.job?.id)return result('uncertain','YouTube 예약 작업을 확인해 주세요.',{errorCode:'JOB_REQUIRED'});
    const id=ledgerId(input);if(active.has(id))return active.get(id);
    const work=(async()=>{let row=store.get(JOBS,id);if(!row)return result('uncertain','이 YouTube 업로드 기록을 찾지 못했어요.',{errorCode:'SUBMISSION_NOT_FOUND'});if(['published','failed'].includes(row.status))return view(row);
      if(row.leaseUntil&&Date.parse(row.leaseUntil)>stamp())return view(row);
      if(row.status==='initializing'&&!store.secret(mediaSecret(id)))return view(update(id,{status:'failed',message:'영상 전송 전 업로드 준비가 중단됐어요. 원문을 확인하고 새 예약을 만들어 주세요.',errorCode:'NOT_SUBMITTED',definitive:true,retryable:false,leaseUntil:null}));
      const resumed={...input,post:input.job.snapshot?.post||input.post,variant:input.job.snapshot?.variant||input.variant};try{if(!resumed.post||!resumed.variant)throw fail('SNAPSHOT_REQUIRED','승인한 영상 게시 원문을 확인하지 못했어요.');return await advance(resumed,{continuation:true});}catch(error){return failure(id,error,row.claimToken);}
    })();active.set(id,work);try{return await work;}finally{active.delete(id);}
  }
  return {capability,preflight,publish,status,checkConnection};
}
