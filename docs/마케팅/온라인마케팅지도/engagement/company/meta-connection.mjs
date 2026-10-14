import {canWriteChannel} from './organization.mjs';
import {createHash} from 'node:crypto';

// Only server-observed account identity and granted permissions become credentials.
// Instagram Login's user_id and app-scoped id are different identifiers.
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
// https://developers.facebook.com/docs/graph-api/reference/debug_token/
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status,metaSafe:true});
const graphId=value=>typeof value==='string'&&/^\d{1,50}$/.test(value)?value:null;
const string=(value,max=16000)=>typeof value==='string'&&value.trim().length<=max?value.trim():'';
const at=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const epoch=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<253402300799?new Date(value*1000).toISOString():null;
const unique=values=>[...new Set(values)].sort();
const digest=value=>createHash('sha256').update(value).digest('hex');
function facebookMatches(channel,page){
  if(channel.externalId)return page.id===channel.externalId;
  const handle=string(channel.handle,120).toLowerCase();
  if(!handle)return false;
  if(string(page.username,120).toLowerCase()===handle)return true;
  try{
    const url=new URL(page.link);
    if(url.protocol!=='https:'||url.username||url.password||url.port||!['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname.toLowerCase()))return false;
    const path=url.pathname.replace(/\/+$/,'');
    if(path==='/profile.php')return graphId(url.searchParams.get('id'))===page.id&&handle===page.id;
    return /^\/[A-Za-z\d_.-]{1,100}$/.test(path)&&path.slice(1).toLowerCase()===handle;
  }catch{return false;}
}

export function instagramIdentity(data,{requireUserId=false}={}){
  const appScopedId=graphId(data?.id),userId=graphId(data?.user_id);
  if(!appScopedId||requireUserId&&!userId||!string(data?.username,120))throw fail('META_ACCOUNT_INVALID','Instagram 계정 ID를 확인하지 못했어요. 연결을 다시 확인해 주세요.',409);
  return {id:userId||appScopedId,appScopedId,username:data.username};
}

export function metaCommentScopes(platform,authType){
  if(platform==='instagram')return authType==='instagram-login'?['instagram_business_basic','instagram_business_manage_comments']:['instagram_basic','instagram_manage_comments','pages_read_engagement'];
  return ['pages_read_engagement','pages_read_user_content','pages_manage_engagement',...(authType==='facebook-user'?['pages_show_list']:[])];
}

export function hasVerifiedMetaComments(channel,credentials){
  const proof=credentials?.capabilityVerification;
  return channel?.platform==='instagram'&&credentials?.authType==='instagram-login'&&credentials.metaIdentityVersion===1&&typeof credentials.accessToken==='string'&&
    proof?.method==='owned-media-comments-read'&&Boolean(at(proof.testedAt))&&proof.commentsRead===true&&proof.accountId===credentials.accountId&&proof.appScopedId===credentials.appScopedId&&
    (!channel.externalId||channel.externalId===proof.accountId)&&proof.tokenSha256===digest(credentials.accessToken);
}

export async function verifyMetaConnection({channel,credentials={},provider={},purpose='comments',fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),signal,authorize,trustedExpiry=false,trustedGrant=false}={}){
  const platform=channel?.platform,authType=credentials.authType,accessToken=string(credentials.accessToken),apiVersion=credentials.apiVersion||provider.apiVersion||'v26.0';
  if(!['instagram','facebook'].includes(platform))throw fail('META_PLATFORM_REQUIRED','Instagram 또는 Facebook 페이지를 선택해 주세요.');
  const types=platform==='instagram'?['instagram-login','instagram-facebook','facebook-page']:['facebook-user','facebook-page'];
  if(!types.includes(authType)||!accessToken||/[\r\n]/.test(accessToken)||!/^v\d{1,2}\.\d{1,2}$/.test(apiVersion))throw fail('META_CONNECTION_INVALID','로그인 방식, 토큰과 API 버전을 확인해 주세요.');
  const requestedId=credentials.accountId==null?'':string(credentials.accountId,50);
  if(!trustedGrant&&!requestedId)throw fail('META_ACCOUNT_REQUIRED','직접 연결할 계정 ID를 입력해 주세요.');
  if(requestedId&&!graphId(requestedId))throw fail('META_ACCOUNT_INVALID','계정 ID는 Meta에서 확인한 숫자 ID를 입력해 주세요.');
  const direct=platform==='instagram'&&authType==='instagram-login',origin=direct?'https://graph.instagram.com':'https://graph.facebook.com';
  const assertIdentity=identity=>{
    if(requestedId&&requestedId!==identity.id&&(!direct||requestedId!==identity.appScopedId))throw fail('META_ACCOUNT_MISMATCH','토큰의 실제 계정이 입력한 계정 ID와 달라요.',409);
    if(channel.externalId&&channel.externalId!==identity.id&&(!direct||channel.externalId!==identity.appScopedId))throw fail('META_ACCOUNT_MISMATCH','토큰의 실제 계정이 기존 SYNK 채널과 달라요.',409);
    if(channel.handle&&platform==='instagram'&&identity.username.toLowerCase()!==channel.handle.replace(/^@/,'').toLowerCase())throw fail('META_ACCOUNT_MISMATCH','토큰의 실제 Instagram 이름이 SYNK 채널 주소와 달라요.',409);
    if(platform==='facebook'&&!facebookMatches(channel,identity))throw fail('META_ACCOUNT_MISMATCH','Facebook 페이지 주소로 실제 페이지를 찾지 못했어요. 숫자 페이지 ID가 든 주소를 넣어 주세요.',409);
  };
  const check=()=>{try{authorize?.();}catch(error){throw Object.assign(error,{metaAuthorization:true});}if(signal?.aborted)throw fail('META_CONNECTION_CANCELLED','계정 연결 확인이 취소됐어요.',409);};
  async function get(path,params={},token=accessToken,host=origin){
    check();const url=new URL('/'+apiVersion+'/'+path,host);for(const [key,value]of Object.entries(params))if(value!==undefined)url.searchParams.set(key,String(value));
    let response,data;
    try{
      response=await fetchImpl(url.href,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json','Cache-Control':'no-store'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
      check();if(Number(response.headers?.get?.('content-length')||0)>1024*1024)throw Error();const raw=await response.text();if(Buffer.byteLength(raw)>1024*1024)throw Error();data=JSON.parse(raw);check();
    }catch(error){if(error.metaSafe||error.metaAuthorization)throw error;throw fail('META_VERIFICATION_UNAVAILABLE','Meta가 연결 확인에 응답하지 않았어요. 저장하지 않았으니 잠시 후 다시 확인해 주세요.',502);}
    if(response.status===429)throw fail('META_RATE_LIMIT','Meta 조회 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429);
    if(response.status>=500)throw fail('META_VERIFICATION_UNAVAILABLE','Meta 연결 확인이 잠시 늦어지고 있어요. 저장하지 않았으니 잠시 후 다시 확인해 주세요.',502);
    if(!response.ok||data?.error)throw fail('META_VERIFICATION_REJECTED','Meta가 계정이나 권한 조회를 허용하지 않았어요. 로그인 방식과 앱 권한을 확인해 주세요.',409);
    return data;
  }
  let identity,scope=[],expiresAt=null,dataAccessExpiresAt=null,expiryStatus='not-provided',pageToken=accessToken,capabilityVerification=null,selectedPageId=null;
  if(direct){
    identity=instagramIdentity(await get('me',{fields:'id,user_id,username'}),{requireUserId:true});
    assertIdentity(identity);
    if(trustedGrant){
      // Only the OAuth code-exchange response, never an HTTP client's scope.
      scope=unique(typeof credentials.scope==='string'?credentials.scope.split(/[ ,]+/).filter(Boolean):[]);
    }else{
      // IG Login has no working permissions edge. Meta's official collection
      // requires basic + manage_comments for both GET comments and POST replies.
      // This proves read capability, not a granted-scope list or a sent reply.
      // https://github.com/fbsamples/messenger-platform-samples/blob/main/postman/instagram-platform-api.postman_collection.json
      const media=await get(identity.id+'/media',{fields:'id',limit:1});
      if(!Array.isArray(media.data)||!graphId(media.data[0]?.id))throw fail('META_COMMENT_PROOF_REQUIRED','계정은 확인했지만 댓글 권한을 확인할 게시물이 없어요. 댓글 권한 OAuth 연결로 연결해 주세요.',409);
      const mediaId=media.data[0].id,owned=await get(mediaId,{fields:'id,owner'});
      if(owned.id!==mediaId||owned.owner?.id!==identity.appScopedId)throw fail('META_MEDIA_OWNER_MISMATCH','댓글 권한을 확인할 게시물의 주인이 실제 연결 계정과 달라요.',409);
      const comments=await get(mediaId+'/comments',{fields:'id',limit:1});
      if(!Array.isArray(comments.data)||comments.data.some(row=>!graphId(row?.id)))throw fail('META_COMMENTS_INVALID','이 계정의 댓글 읽기 권한을 확인하지 못했어요.',409);
      capabilityVerification={method:'owned-media-comments-read',testedAt:new Date(clock()).toISOString(),accountId:identity.id,appScopedId:identity.appScopedId,tokenSha256:digest(accessToken),commentsRead:true,replyPermissionInferred:true,replySendVerified:false};
    }
    if(trustedExpiry&&credentials.expiresAt!=null){expiresAt=at(credentials.expiresAt);if(!expiresAt)throw fail('META_EXPIRY_INVALID','서버에서 받은 토큰 만료 정보를 확인해 주세요.',409);expiryStatus='provider';}
  }else{
    if(!string(provider.clientId,150)||!string(provider.clientSecret))throw fail('META_APP_REQUIRED','이 Facebook 로그인 방식은 앱 연결 설정이 있어야 토큰 권한과 만료를 확인할 수 있어요.',409);
    const debug=await get('debug_token',{input_token:accessToken},provider.clientId+'|'+provider.clientSecret,'https://graph.facebook.com');
    const info=debug.data;
    if(!info||info.is_valid!==true||String(info.app_id)!==provider.clientId||!Array.isArray(info.scopes)||!info.scopes.every(s=>typeof s==='string'))throw fail('META_TOKEN_INVALID','이 앱에서 쓸 수 있는 토큰과 승인 권한을 확인하지 못했어요.',409);
    scope=unique(info.scopes);expiresAt=epoch(info.expires_at);dataAccessExpiresAt=epoch(info.data_access_expires_at);expiryStatus=expiresAt?'provider':info.expires_at===0?'provider-no-expiry':'not-provided';
    if(info.expires_at!=null&&info.expires_at!==0&&!expiresAt||info.data_access_expires_at!=null&&info.data_access_expires_at!==0&&!dataAccessExpiresAt)throw fail('META_EXPIRY_INVALID','Meta가 보낸 만료 정보를 확인하지 못했어요.',409);
    if(platform==='facebook'&&authType==='facebook-user'){
      let cursor,matched;const cursors=new Set();for(let n=0;n<5&&!matched;n++){
        const page=await get('me/accounts',{fields:'id,name,username,link,access_token,tasks',limit:100,after:cursor});
        if(!Array.isArray(page.data))throw fail('META_PAGES_INVALID','관리하는 Facebook 페이지 목록을 불러오지 못했어요.',409);
        matched=page.data.find(row=>(!requestedId||row.id===requestedId)&&facebookMatches(channel,row));
        if(matched||!page.paging?.next)break;const next=page.paging?.cursors?.after;if(typeof next!=='string'||!next||next.length>2000||cursors.has(next))break;cursors.add(next);cursor=next;
      }
      if(!matched?.access_token||purpose==='comments'&&!matched.tasks?.includes('MODERATE'))throw fail('META_PAGE_ACCESS_REQUIRED','선택한 Facebook 페이지와 댓글 관리 권한을 확인해 주세요.',409);
      pageToken=matched.access_token;selectedPageId=matched.id;
    }
    const account=await get(platform==='instagram'?(requestedId||channel.externalId):'me',{fields:platform==='instagram'?'id,username':'id,name,username,link'},pageToken);
    if(!graphId(account?.id))throw fail('META_ACCOUNT_INVALID','Meta 계정 ID를 확인하지 못했어요.',409);
    if(selectedPageId&&account.id!==selectedPageId)throw fail('META_ACCOUNT_MISMATCH','확인하는 동안 선택한 Facebook 페이지가 바뀌었어요. 다시 연결해 주세요.',409);
    identity={id:account.id,appScopedId:null,username:account.username||'',name:account.name||'',...(platform==='facebook'?{link:account.link||''}:{})};
  }
  const verifiedAt=new Date(clock()).toISOString();
  if([expiresAt,dataAccessExpiresAt].some(value=>value&&Date.parse(value)<=Date.parse(verifiedAt)))throw fail('META_TOKEN_EXPIRED','연결 토큰이나 데이터 접근 권한이 만료됐어요. 다시 연결해 주세요.',409);
  assertIdentity(identity);
  const needed=purpose==='comments'?metaCommentScopes(platform,authType):platform==='instagram'?[direct?'instagram_business_basic':'instagram_basic']:['pages_read_engagement'];
  if(!capabilityVerification&&needed.some(value=>!scope.includes(value)))throw fail('META_SCOPES_REQUIRED','승인한 권한에 이 연결에 필요한 댓글이나 계정 조회 권한이 없어요. 권한을 허용한 뒤 다시 연결해 주세요.',409);
  check();return {identity,credentials:{accessToken,authType,apiVersion,accountId:identity.id,...(identity.appScopedId?{appScopedId:identity.appScopedId}:{}),scope:scope.join(' '),expiresAt,dataAccessExpiresAt,expiryStatus,verifiedAt,permissionsVerifiedAt:scope.length?verifiedAt:null,capabilityVerification,refreshMode:trustedExpiry&&credentials.longLived===true?'oauth-long-lived':'external-manual',metaIdentityVersion:1,graphHost:new URL(origin).hostname,...(trustedExpiry&&at(credentials.issuedAt)?{issuedAt:at(credentials.issuedAt),longLived:credentials.longLived===true}:{})}};
}

// Also usable by an explicitly authorized administrative operation, without
// starting an HTTP server, migrations, background jobs or any write to Meta.
export function createMetaConnectionService({store,clock=()=>new Date().toISOString(),fetchImpl=globalThis.fetch,getProviderConfig=()=>({})}={}){
  async function connect(user,channelId,input={},context={}){
    const check=()=>{context.authorize?.();const actor=store.get('users',user?.id),channel=store.get('channels',channelId);if(!actor?.active||actor.role!=='admin')throw fail('META_ADMIN_REQUIRED','계정 직접 연결은 관리자만 할 수 있어요.',403);if(!channel||channel.active===false||channel.hidden||!canWriteChannel(actor,channel))throw fail('META_CHANNEL_FORBIDDEN','연결할 채널의 현재 권한을 확인해 주세요.',403);return channel;};
    const channel=check(),version=channel.connectionVersion||0,provider=getProviderConfig(channel.platform),providerPin=JSON.stringify(provider);
    const current=()=>{const live=check();if((live.connectionVersion||0)!==version||live.platform!==channel.platform||live.externalId!==channel.externalId||live.handle!==channel.handle||JSON.stringify(getProviderConfig(channel.platform))!==providerPin)throw fail('META_CONNECTION_CHANGED','확인하는 동안 계정이나 앱 연결이 바뀌었어요. 다시 연결해 주세요.',409);return live;};
    const result=await verifyMetaConnection({channel,credentials:input,provider,clock,fetchImpl,signal:context.signal,authorize:current});
    store.transaction(()=>{const live=current();if(store.all('channels').some(row=>row.id!==channel.id&&row.platform===channel.platform&&row.externalId===result.identity.id))throw fail('META_DUPLICATE_ACCOUNT','이 계정은 이미 회사의 다른 채널에 연결돼 있어요.',409);
      store.setSecret('channel:'+channel.id,{...result.credentials,connectedBy:user.id,connectedAt:result.credentials.verifiedAt});
      store.put('channels',channel.id,{...live,externalId:result.identity.id,status:'ready',lastError:null,collectionDisabled:false,failureKind:null,failureCode:null,retryCount:0,nextRetryAt:null,requiresReconnect:false,lastFailureAt:null,lastAttemptAt:null,recentStatus:'ready',recentFailureKind:null,recentFailureCode:null,recentRetryCount:0,recentNextRetryAt:null,recentRequiresReconnect:false,recentLastFailureAt:null,recentLastAttemptAt:null,recentLastError:null,connectionVersion:version+1});
    });return {ok:true,verifiedAt:result.credentials.verifiedAt,expiryStatus:result.credentials.expiryStatus};
  }
  return {connect};
}
