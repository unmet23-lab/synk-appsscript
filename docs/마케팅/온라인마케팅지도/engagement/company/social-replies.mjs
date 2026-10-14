import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';
import {instagramIdentity,hasVerifiedMetaComments} from './meta-connection.mjs';
import {inboxReplyState,observedReplyAcknowledgmentKey,replySetHash} from './social-reply-observations.mjs';

// Meta's generated official SDK confirms POST /{comment-id}/replies (IG) and
// POST /{comment-id}/comments (Page), both with the final message parameter.
// https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/igcomment.py
// https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/comment.py
// Permissions: instagram_business_manage_comments (IG Login), or
// instagram_manage_comments (FB Login); Page replies require pages_manage_engagement.
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation
// https://developers.facebook.com/docs/permissions/reference/pages_manage_engagement
const K={previews:'socialReplyPreviews',attempts:'socialReplyAttempts',dedupe:'socialReplyDedupe',health:'socialNativeHealth',budget:'socialInboxRequests',writes:'socialReplyRequests'};
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const josa=w=>{const s=String(w),c=s.charCodeAt(s.length-1);return c>=0xac00&&c<=0xd7a3?((c-0xac00)%28?'을':'를'):/id$/i.test(s)?'를':'을';};
const text=(value,max,label,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string'||value.length>max||required&&!value.trim())throw fail('INVALID_INPUT',label+josa(label)+' 확인해 주세요.',400);return value.trim();};
const id=value=>typeof value==='string'&&/^\d{1,50}(?:_\d{1,50})?$/.test(value)?value:null;
const fail=(code,message,status=409,extra={})=>Object.assign(new Error(message),{code,status,replySafe:true,...extra});
const HOUR=3600000,MINUTE=60000,ACTIVE=new Set(['preparing','submitting','sent','unknown']);
const credentialIdentity=c=>[c?.accessToken,c?.authType,c?.scope,c?.expiresAt,c?.dataAccessExpiresAt,c?.accountId,c?.appScopedId,c?.apiVersion,c?.metaIdentityVersion,c?.capabilityVerification];
const fieldsOf=row=>[row.id,row.channelId,row.kind,row.source,row.externalId,row.sourceAccountId,row.nativePostId,row.parentExternalId,row.text,row.author,row.url];
function scopesFor(channel,credentials,reply=false){return channel.platform==='instagram'?(credentials?.authType==='instagram-login'?['instagram_business_basic','instagram_business_manage_comments']:['instagram_basic','instagram_manage_comments','pages_read_engagement']):['pages_read_engagement','pages_read_user_content',...(credentials?.authType==='facebook-user'?['pages_show_list']:[]),...(reply?['pages_manage_engagement']:[])];}

/** Explicit preview + confirmation only. Scanners never issue a POST. */
export function createSocialReplies({store,getCredentials,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
  if(!store)throw new TypeError('store is required');const now=()=>new Date(clock()).toISOString(),stamp=()=>Date.parse(now());
  const pending=new Set(),controllers=new Set(),healthRuns=new Map();let closed=false,scanTask=null;
  function actor(user,channelId,context={},write=true){
    const authorized=context.authorize?.(),live=store.get('users',user?.id),channel=store.get('channels',channelId);
    if(!live?.active||authorized?.id&&authorized.id!==live.id)throw fail('AUTH_REQUIRED','현재 로그인 상태를 확인해 주세요.',401);
    if(!channel||channel.active===false||channel.hidden||!(write?canWriteChannel:canReadChannel)(live,channel))throw fail('CHANNEL_FORBIDDEN','이 계정의 담당 권한을 확인해 주세요.',403);
    if(closed||context.signal?.aborted)throw fail('REPLY_CANCELLED','답장 요청이 중단됐어요.',409);return {user:live,channel};
  }
  function credentialsFor(channel){return store.secret('channel:'+channel.id);}
  function binding(channelId){const c=store.get('channels',channelId),settings=store.get('socialInboxConnections',channelId);return hash([c?.id,c?.platform,c?.externalId,c?.handle,c?.connectionVersion,c?.collectionDisabled,c?.ownerIds,c?.teamId,c?.active,c?.hidden,settings?.version,credentialIdentity(c?credentialsFor(c):null)]);}
  function localIssue(channel,credentials,reply=false){
    if(!['instagram','facebook'].includes(channel.platform))return ['UNSUPPORTED_PLATFORM','Instagram·Facebook 페이지에서 수집한 댓글에만 답장할 수 있어요.'];
    if(channel.collectionDisabled||!credentials?.accessToken)return ['NOT_CONNECTED','댓글 권한이 있는 SNS 계정을 연결해 주세요.'];
    if(credentials.expiresAt&&(!Number.isFinite(Date.parse(credentials.expiresAt))||Date.parse(credentials.expiresAt)<=stamp()))return ['AUTH_REQUIRED','SNS 연결이 만료됐어요. 필요한 권한을 허용해 다시 연결해 주세요.'];
    if(credentials.dataAccessExpiresAt&&(!Number.isFinite(Date.parse(credentials.dataAccessExpiresAt))||Date.parse(credentials.dataAccessExpiresAt)<=stamp()))return ['AUTH_REQUIRED','SNS 데이터 접근 권한이 만료됐어요. 다시 연결해 주세요.'];
    const types=channel.platform==='instagram'?['instagram-login','instagram-facebook','facebook-page']:['facebook-user','facebook-page'];
    if(!types.includes(credentials.authType))return ['AUTH_TYPE_REQUIRED','댓글을 관리할 수 있는 로그인 연결을 확인해 주세요.'];
    if(!id(channel.externalId))return ['ACCOUNT_ID_REQUIRED','SNS 계정 ID가 필요해요. 계정을 조회해 ID를 먼저 확인해 주세요.'];
    const granted=new Set(typeof credentials.scope==='string'?credentials.scope.split(/[ ,]+/).filter(Boolean):[]),missing=scopesFor(channel,credentials,reply).filter(value=>!granted.has(value));
    if(missing.length&&!hasVerifiedMetaComments(channel,credentials))return ['SCOPES_REQUIRED','지금 연결에는 댓글 답장 권한이 없어요. 답장 권한을 허용해 다시 연결해 주세요.',missing];return null;
  }
  function itemIssue(row,channel,credentials){
    const issue=localIssue(channel,credentials,true);if(issue)return issue;
    if(row.source!=='api:'+channel.platform||row.kind!=='comment'||!row.importedAt)return ['MANUAL_ITEM','여기서는 자동 수집한 원댓글에만 답장할 수 있어요. 직접 기록한 문의와 메시지는 SNS에서 처리해 주세요.'];
    if(!id(row.externalId)||!id(row.nativePostId)||!id(row.sourceAccountId)||row.sourceAccountId!==channel.externalId)return ['ACCOUNT_MISMATCH','원댓글과 발신 계정의 ID가 맞지 않아요. 댓글을 다시 수집해 주세요.'];
    if(row.deletedAt||row.deleted||row.hidden||row.unavailable)return ['COMMENT_UNAVAILABLE','삭제됐거나 숨겨진 댓글에는 답장할 수 없어요.'];
    if(row.parentExternalId)return ['NESTED_REPLY_UNSUPPORTED','여기서는 원댓글에만 공개 답장을 보낼 수 있어요. 답글의 답글은 SNS에서 달아 주세요.'];
    if(row.contentTruncated)return ['COMMENT_TRUNCATED','원댓글이 너무 길어 일부만 수집됐어요. SNS에서 원문을 보고 답장해 주세요.'];return null;
  }
  function getItem(user,inboxId,context={},write=true){const row=store.get('socialInbox',text(inboxId,150,'댓글 ID',true));if(!row)throw fail('COMMENT_NOT_FOUND','댓글을 찾을 수 없어요. 새로고침해 주세요.',404);return {row,...actor(user,row.channelId,context,write)};}
  function attemptView(row){return Object.fromEntries(['id','inboxId','channelId','text','status','remoteReplyId','message','errorCode','createdAt','submittedAt','sentAt','retryable','observedAt'].map(key=>[key,row[key]??null]));}
  function normalizeLease(row){if(!row||!['preparing','submitting'].includes(row.status)||row.leaseUntil>now())return row;const next={...row,status:row.status==='submitting'?'unknown':'failed',errorCode:row.status==='submitting'?'REPLY_RESULT_UNKNOWN':'PREPARATION_INTERRUPTED',message:row.status==='submitting'?'전송됐는지 알 수 없어요. SNS에서 확인하기 전까지 다시 보내지 않아요.':'보내기 전에 준비가 중단됐어요. 미리보기를 새로 만들어 다시 확인해 주세요.',retryable:row.status==='preparing',updatedAt:now()};store.put(K.attempts,row.id,next);return next;}
  function blockingAttempt(row){return store.all(K.attempts).filter(a=>a.channelId===row.channelId&&a.sourceAccountId===row.sourceAccountId&&a.externalId===row.externalId).map(normalizeLease).find(a=>['preparing','submitting','unknown'].includes(a.status));}
  function assertUnblocked(row){if(blockingAttempt(row))throw fail('REPLY_PENDING','이 원댓글에 보내는 중이거나 전송 여부를 모르는 답장이 있어요. 그 답장의 결과부터 확인해 주세요.');}
  function workspace(user){
    const live=store.get('users',user?.id);if(!live?.active)return {items:[],attempts:[]};
    const items=store.all('socialInbox').filter(row=>{const c=store.get('channels',row.channelId);return c&&c.active!==false&&!c.hidden&&canReadChannel(live,c);});
    const visible=new Set(items.map(row=>row.id)),attempts=store.all(K.attempts).filter(row=>visible.has(row.inboxId)).map(normalizeLease);
    return {items:items.map(row=>{
      const c=store.get('channels',row.channelId),issue=itemIssue(row,c,credentialsFor(c)),blocked=blockingAttempt(row),latest=attempts.filter(a=>a.inboxId===row.id).at(-1),writable=canWriteChannel(live,c);
      const replyState=inboxReplyState(row,c),knownIds=new Set(attempts.filter(a=>a.inboxId===row.id&&a.status==='sent').map(a=>a.remoteReplyId));
      return {inboxId:row.id,...replyState,observedReply:replyState.observedReply?{...replyState.observedReply,knownLocal:replyState.observedReply.replyCount===replyState.observedReply.replyIds.length&&replyState.observedReply.replyIds.every(value=>knownIds.has(value))}:null,canReply:writable&&!issue&&!blocked,canReconcile:writable&&!issue&&blocked?.status==='unknown',reason:issue?.[1]||(blocked?'이 원댓글의 기존 전송 결과를 먼저 확인해 주세요.':!writable?'이 계정으로 답장할 권한이 없어요.':null),requiredScopes:scopesFor(c,credentialsFor(c),true),missingScopes:issue?.[2]||[],latestAttempt:latest?attemptView(latest):null};
    }),attempts:attempts.map(attemptView)};
  }
  function run(fn,outerSignal){if(closed)return Promise.reject(fail('REPLY_STOPPED','답장 서비스가 멈췄어요. 잠시 후 다시 시도해 주세요.',503));if(pending.size>=8)return Promise.reject(fail('REPLY_BUSY','처리 중인 요청이 많아요. 잠시 후 다시 시도해 주세요.',429));const controller=new AbortController();controllers.add(controller);const signal=outerSignal?AbortSignal.any([outerSignal,controller.signal]):controller.signal;const task=Promise.resolve().then(()=>fn(signal)).finally(()=>{pending.delete(task);controllers.delete(controller);});pending.add(task);return task;}
  function reserve(channelId,write=false){store.transaction(()=>{const table=write?K.writes:K.budget,row=store.get(table,channelId)||{},times=(row.times||[]).filter(at=>at>stamp()-HOUR);if(times.length>=(write?20:120)||row.retryAt>stamp())throw fail('META_RATE_LIMIT','댓글 API 요청 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true});store.put(table,channelId,{times:[...times,stamp()],retryAt:row.retryAt||null});});}
  async function accountSession(user,channel,context,expectedBinding,reply=false){
    const check=()=>{actor(user,channel.id,context);if(binding(channel.id)!==expectedBinding)throw fail('CONNECTION_CHANGED','계정 연결이나 권한 설정이 바뀌었어요. 미리보기부터 다시 확인해 주세요.');};check();
    const credentials=await(getCredentials?getCredentials(channel):credentialsFor(channel));check();if(hash(credentialIdentity(credentials))!==hash(credentialIdentity(credentialsFor(channel))))throw fail('CONNECTION_CHANGED','저장된 SNS 연결과 지금 조회한 연결이 달라요.');
    const issue=localIssue(channel,credentials,reply);if(issue)throw fail(issue[0],issue[1]);
    const version=credentials.apiVersion||'v26.0';if(!/^v\d{1,2}\.\d{1,2}$/.test(version))throw fail('INVALID_API_VERSION','Meta API 버전을 확인해 주세요.');
    const direct=channel.platform==='instagram'&&credentials.authType==='instagram-login',origin=direct?'https://graph.instagram.com':'https://graph.facebook.com';let token=credentials.accessToken;
    async function api(path,params={},method='GET'){
      check();reserve(channel.id,method==='POST');const url=new URL('/'+version+'/'+path,origin);if(method==='GET')for(const [key,value]of Object.entries(params))if(value!=null)url.searchParams.set(key,String(value));
      let response;try{response=await fetchImpl(url.href,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:method==='POST'?new URLSearchParams(params).toString():undefined,signal:context.signal?AbortSignal.any([context.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});}catch{throw fail('META_NETWORK','Meta에서 응답을 받지 못했어요.',502,{uncertain:method==='POST',retryable:method==='GET'});}
      if(method==='GET')check();let data;try{if(Number(response.headers?.get?.('content-length')||0)>2*1024*1024)throw Error();const raw=await response.text();if(Buffer.byteLength(raw)>2*1024*1024)throw Error();data=JSON.parse(raw);}catch{throw fail('META_INVALID_RESPONSE','Meta 응답을 읽을 수 없어요.',502,{uncertain:method==='POST'});}
      if(method==='GET')check();const status=Number(response.status),code=Number(data?.error?.code);
      if(status>=500)throw fail('META_UNAVAILABLE','Meta 처리 결과를 알 수 없어요.',502,{uncertain:method==='POST'});
      if(status===429||[4,17,32,613,80001].includes(code)){
        const header=response.headers?.get?.('retry-after'),seconds=Number(header),retryAt=Number.isFinite(seconds)&&seconds>0?stamp()+Math.min(seconds,86400)*1000:Number.isFinite(Date.parse(header))?Math.min(stamp()+86400000,Math.max(stamp()+MINUTE,Date.parse(header))):stamp()+15*MINUTE;
        // Both read and write calls share the remote account's cooldown.
        store.transaction(()=>{for(const kind of [K.budget,K.writes]){const previous=store.get(kind,channel.id)||{};store.put(kind,channel.id,{...previous,retryAt:Math.max(previous.retryAt||0,retryAt)});}});
        throw fail('META_RATE_LIMIT','Meta 요청 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true});
      }
      if([401,403].includes(status)||[102,190,200,283,459].includes(code))throw fail('AUTH_REQUIRED','댓글 토큰 또는 관리 권한을 다시 연결해 주세요.');
      if(status<200||status>=300||data?.error)throw fail('COMMENT_UNAVAILABLE','댓글이 삭제됐거나 이 계정으로는 볼 수 없어요.');
      return data;
    }
    if(channel.platform==='facebook'&&credentials.authType==='facebook-user'){
      let match,after;for(let page=0;page<5;page++){const result=await api('me/accounts',{fields:'id,access_token,tasks',limit:100,after});if(!Array.isArray(result.data))throw fail('META_INVALID_RESPONSE','Facebook 페이지 목록을 불러오지 못했어요.',502);match=result.data.find(row=>row.id===channel.externalId);if(match)break;const next=result.paging?.cursors?.after;if(!result.paging?.next||typeof next!=='string'||next.length>2000||next===after)break;after=next;}
      if(!match?.access_token||!match.tasks?.includes('MODERATE'))throw fail('PAGE_ACCESS_REQUIRED','연결한 Facebook 페이지의 MODERATE 관리 권한을 확인해 주세요.');token=match.access_token;
    }
    let account=await api(channel.platform==='instagram'&&!direct?(credentials.accountId||channel.externalId):'me',{fields:channel.platform==='instagram'?(direct?'id,user_id,username':'id,username'):'id,name'});
    if(direct)account=instagramIdentity(account,{requireUserId:credentials.metaIdentityVersion===1});
    if(account.id!==channel.externalId||channel.platform==='instagram'&&channel.handle&&String(account.username||'').toLowerCase()!==channel.handle.replace(/^@/,'').toLowerCase())throw fail('ACCOUNT_MISMATCH','SNS에서 확인한 발신 계정이 선택한 계정과 달라요.');
    return {api,check,account};
  }
  async function inspectComment(session,row,channel){
    const ig=channel.platform==='instagram',comment=await session.api(row.externalId,{fields:ig?'id,text,username,media,parent_id,hidden':'id,message,from,parent,object,can_comment,is_hidden,is_private'});
    if(comment.id!==row.externalId||comment.hidden||comment.is_hidden||comment.is_private||!ig&&comment.can_comment!==true)throw fail('COMMENT_UNAVAILABLE','지금은 이 댓글에 답장할 수 없어요. SNS에서 댓글 상태를 확인해 주세요.');
    if(comment.parent_id||comment.parent?.id||String(ig?comment.media?.id:comment.object?.id)!==row.nativePostId)throw fail('COMMENT_MISMATCH','원댓글이 달린 게시물이나 댓글 구조가 바뀌었어요. 댓글을 다시 수집해 주세요.');
    const remoteText=ig?comment.text:comment.message;if(typeof remoteText!=='string'||remoteText.trim()!==row.text)throw fail('COMMENT_CHANGED','원댓글 내용이 달라졌어요. 댓글을 다시 수집한 뒤 답장해 주세요.');
    const post=await session.api(row.nativePostId,{fields:ig?'id,owner':'id,from'}),owner=ig?post.owner?.id:post.from?.id;
    const owned=owner===session.account.id||ig&&session.account.appScopedId&&owner===session.account.appScopedId;
    if(post.id!==row.nativePostId||!owned||!ig&&!row.nativePostId.startsWith(channel.externalId+'_'))throw fail('ACCOUNT_MISMATCH','발신 계정의 게시물인지 확인할 수 없어요.');session.check();return comment;
  }
  async function inspectExistingReplies(session,row,channel){
    const ig=channel.platform==='instagram',owners=new Set([session.account.id,session.account.appScopedId].filter(Boolean)),replies=new Map(),cursors=new Set();let after;
    for(let page=0;page<4;page++){
      const result=await session.api(row.externalId+(ig?'/replies':'/comments'),{fields:ig?'id,from,user,parent_id,timestamp,hidden':'id,from,parent,created_time,is_hidden,is_private',limit:50,after});
      if(!Array.isArray(result.data)||result.data.length>50)throw fail('REPLY_HISTORY_INVALID','기존 답장 목록을 확인하지 못했어요. 다시 확인해 주세요.');
      for(const reply of result.data){
        if(!id(reply?.id))throw fail('REPLY_HISTORY_INVALID','기존 답장의 식별자를 확인하지 못했어요.');
        const parent=ig?reply.parent_id:reply.parent?.id;if(parent&&parent!==row.externalId)throw fail('REPLY_HISTORY_INVALID','기존 답장이 이 원댓글에 속하는지 확인하지 못했어요.');
        const authors=[reply.from?.id,reply.user?.id].filter(value=>id(value));
        if(!authors.length)throw fail('REPLY_AUTHOR_UNVERIFIED','기존 답장의 발신 계정을 확인하지 못했어요. SNS 원문에서 답장을 확인해 주세요.');
        if(authors.some(value=>owners.has(value))){
          if(authors.some(value=>!owners.has(value)))throw fail('REPLY_AUTHOR_UNVERIFIED','기존 답장의 발신 계정 정보가 서로 달라요. SNS 원문을 확인해 주세요.');
          if(!reply.hidden&&!reply.is_hidden&&!reply.is_private){const at=ig?reply.timestamp:reply.created_time;replies.set(reply.id,{id:reply.id,at:Number.isFinite(Date.parse(at))?new Date(at).toISOString():null});}
        }
      }
      if(!result.paging?.next){
        const sorted=[...replies.values()].sort((a,b)=>(b.at||'').localeCompare(a.at||'')||b.id.localeCompare(a.id)),ids=sorted.map(value=>value.id);
        return {source:'meta-read',method:'author-id-match',connectionVersion:channel.connectionVersion,sourceAccountId:channel.externalId,latestReplyExternalId:sorted[0]?.id||null,latestReplyAt:sorted[0]?.at||null,observedAt:now(),replyCount:ids.length,replyIds:ids.slice(0,20),replySetHash:replySetHash(ids),complete:true,verifiedReplyIds:ids};
      }
      const cursor=result.paging?.cursors?.after;if(typeof cursor!=='string'||!cursor||cursor.length>2000||/[\u0000-\u001f\u007f]/.test(cursor)||cursors.has(cursor))throw fail('REPLY_HISTORY_INCOMPLETE','기존 답장 목록을 끝까지 확인하지 못했어요. SNS 원문을 확인해 주세요.');after=cursor;cursors.add(cursor);
    }
    throw fail('REPLY_HISTORY_INCOMPLETE','기존 답장이 많아 이번 확인 범위를 넘었어요. SNS 원문에서 확인해 주세요.');
  }
  function recordObservation(user,row,channel,evidence,generation,context){
    return store.transaction(()=>{actor(user,channel.id,context);const live=store.get('socialInbox',row.id);if(!live||live.revision!==row.revision||hash(fieldsOf(live))!==hash(fieldsOf(row))||binding(channel.id)!==generation)throw fail('PREVIEW_CHANGED','댓글이나 계정이 바뀌었어요. 다시 확인해 주세요.');
      const {verifiedReplyIds,...publicEvidence}=evidence,ids=new Set(verifiedReplyIds);
      for(const child of store.all('socialInbox'))if(child.channelId===channel.id&&child.sourceAccountId===channel.externalId&&child.nativePostId===row.nativePostId&&child.parentExternalId===row.externalId&&child.metaAccountReply?.connectionVersion===channel.connectionVersion)store.put('socialInbox',child.id,{...child,metaAccountReply:{...child.metaAccountReply,confirmed:ids.has(child.externalId),hidden:ids.has(child.externalId)?false:child.metaAccountReply.hidden===true}});
      const next={...live,externalReplyEvidence:publicEvidence,metaReplyProofIds:[...ids],metaReplyCompleteAt:evidence.observedAt},changed=observedReplyAcknowledgmentKey(live,channel)!==observedReplyAcknowledgmentKey(next,channel);
      if(changed){next.revision=live.revision+1;next.updatedAt=now();}store.put('socialInbox',live.id,next);return next;
    });
  }
  function preview(user,input={},context={}){return run(async signal=>{
    context={...context,signal};let {row,channel}=getItem(user,input.inboxId,context);if(input.revision!==row.revision)throw fail('COMMENT_CHANGED','댓글이 바뀌었어요. 새로고침해 주세요.');
    const issue=itemIssue(row,channel,credentialsFor(channel));if(issue)throw fail(issue[0],issue[1]);assertUnblocked(row);const message=text(input.text,2000,'최종 답장',true),generation=binding(channel.id),sourceHash=hash(fieldsOf(row));
    const check=()=>{const live=getItem(user,row.id,context).row;if(live.revision!==row.revision||hash(fieldsOf(live))!==sourceHash||binding(channel.id)!==generation)throw fail('PREVIEW_CHANGED','댓글·담당·계정 중 바뀐 것이 있어요. 미리보기를 다시 확인해 주세요.');};
    const session=await accountSession(user,channel,context,generation,true);await inspectComment(session,row,channel);check();assertUnblocked(row);
    const evidence=await inspectExistingReplies(session,row,channel);check();row=recordObservation(user,row,channel,evidence,generation,context);const observationKey=observedReplyAcknowledgmentKey(row,channel);
    if(observationKey&&input.observedReplyAcknowledgmentKey!==observationKey)throw fail('EXISTING_REPLY_REQUIRES_CONFIRMATION','SNS에서 이미 보낸 답장이 있어요. 기존 답장을 확인하고 추가 답장 여부를 선택해 주세요.');
    for(const old of store.all(K.previews))if(old.expiresAt<new Date(stamp()-86400000).toISOString())store.remove(K.previews,old.id);
    if(store.all(K.previews).filter(p=>p.createdBy===user.id&&p.expiresAt>now()).length>=100)throw fail('PREVIEW_LIMIT','열려 있는 답장 미리보기가 너무 많아요. 잠시 후 다시 시도해 주세요.',429);
    const previewId=randomUUID(),raw=randomBytes(32).toString('base64url'),idempotencyKey=randomUUID(),at=now(),publicPreview={id:previewId,inboxId:row.id,revision:row.revision,account:{channelId:channel.id,name:channel.displayName||channel.name||channel.handle||channel.id,platform:channel.platform,profile:channel.handle||channel.url||''},comment:{id:row.externalId,text:row.text,author:row.author||'',url:row.url||'',postId:row.nativePostId},text:message,expiresAt:new Date(stamp()+2*MINUTE).toISOString()};
    publicPreview.observedReply=inboxReplyState(row,channel).observedReply;
    const saved={...publicPreview,createdBy:user.id,createdAt:at,tokenHash:hash(raw),idempotencyKey,generation,sourceHash,observationKey,sourceAccountId:row.sourceAccountId,dedupeKey:hash([channel.platform,row.sourceAccountId,row.externalId,message])};
    store.transaction(()=>{check();store.put(K.previews,previewId,saved);});return {preview:publicPreview,confirmationToken:raw,idempotencyKey};
  },context.signal);}
  function finish(attempt,outcome){
    return store.transaction(()=>{const live=store.get(K.attempts,attempt.id);if(!live||!(['preparing','submitting'].includes(live.status)||live.status==='unknown'&&outcome.status==='sent'))return live;const next={...live,...outcome,leaseUntil:null,updatedAt:now()};store.put(K.attempts,next.id,next);
      if(next.status==='sent'){const row=store.get('socialInbox',next.inboxId);if(row&&hash(fieldsOf(row))===next.sourceHash)store.put('socialInbox',row.id,{...row,outboundSent:true,outboundAttemptId:next.id,outboundSentAt:next.sentAt,revision:row.revision+1,updatedAt:now()});}
      return next;});
  }
  function send(user,input={},context={}){return run(async signal=>{
    context={...context,signal};const saved=store.get(K.previews,text(input.previewId,100,'미리보기 ID',true));if(!saved||saved.createdBy!==user?.id||hash(text(input.confirmationToken,100,'확인 토큰',true))!==saved.tokenHash||input.idempotencyKey!==saved.idempotencyKey)throw fail('CONFIRMATION_REQUIRED','전송할 답장의 최종 미리보기를 다시 확인해 주세요.');
    const {row,channel}=getItem(user,saved.inboxId,context);const prior=store.get(K.attempts,saved.idempotencyKey);if(prior)return {attempt:attemptView(normalizeLease(prior))};
    const check=()=>{const live=getItem(user,saved.inboxId,context).row;if(saved.expiresAt<=now()||live.revision!==saved.revision||hash(fieldsOf(live))!==saved.sourceHash||binding(channel.id)!==saved.generation)throw fail('PREVIEW_CHANGED','미리보기가 만료됐거나 내용·계정이 바뀌었어요. 미리보기를 다시 확인해 주세요.');const issue=itemIssue(live,channel,credentialsFor(channel));if(issue)throw fail(issue[0],issue[1]);};check();
    let attempt=store.transaction(()=>{check();const duplicateId=store.get(K.dedupe,saved.dedupeKey)?.attemptId,duplicate=duplicateId?normalizeLease(store.get(K.attempts,duplicateId)):null;if(duplicate&&ACTIVE.has(duplicate.status))return duplicate;assertUnblocked(row);
      const value={id:saved.idempotencyKey,inboxId:row.id,channelId:channel.id,platform:channel.platform,sourceAccountId:saved.sourceAccountId,externalId:row.externalId,nativePostId:row.nativePostId,sourceHash:saved.sourceHash,text:saved.text,status:'preparing',generation:saved.generation,createdBy:user.id,createdAt:now(),updatedAt:now(),leaseUntil:new Date(stamp()+2*MINUTE).toISOString(),retryable:false};store.put(K.attempts,value.id,value);store.put(K.dedupe,saved.dedupeKey,{id:saved.dedupeKey,attemptId:value.id});return value;});
    if(attempt.id!==saved.idempotencyKey)return {attempt:attemptView(attempt)};
    try{
      const session=await accountSession(user,channel,context,saved.generation,true);await inspectComment(session,row,channel);check();
      const evidence=await inspectExistingReplies(session,row,channel);check();const observed=recordObservation(user,row,channel,evidence,saved.generation,context);
      if(observedReplyAcknowledgmentKey(observed,channel)!==(saved.observationKey??null))throw fail('REPLY_HISTORY_CHANGED','미리보기 뒤 SNS의 답장 내역이 달라졌어요. 기존 답장을 확인하고 새로 미리보기를 만들어 주세요.');
      check();
      store.transaction(()=>{check();const live=store.get(K.attempts,attempt.id);if(live.status!=='preparing')throw fail('ALREADY_SUBMITTED','이미 처리 중인 답장이에요.');attempt={...live,status:'submitting',submittedAt:now(),leaseUntil:new Date(stamp()+2*MINUTE).toISOString()};store.put(K.attempts,attempt.id,attempt);});
      const result=await session.api(row.externalId+(channel.platform==='instagram'?'/replies':'/comments'),{message:saved.text},'POST');if(!id(result?.id))throw fail('REPLY_RESULT_UNKNOWN','답장 접수 ID를 받지 못했어요.',502,{uncertain:true});
      attempt=finish(attempt,{status:'sent',remoteReplyId:result.id,sentAt:now(),observedAt:now(),retryable:false,message:'SNS가 답장을 등록했다고 응답했어요.',errorCode:null});
    }catch(error){const safe=error.replySafe?error:fail('REPLY_FAILED','답장 요청을 처리하지 못했어요. 계정과 권한을 확인해 주세요.',502),uncertain=attempt.status==='submitting'&&(safe.uncertain===true||!error.replySafe);attempt=finish(attempt,{status:uncertain?'unknown':'failed',retryable:!uncertain,errorCode:uncertain?'REPLY_RESULT_UNKNOWN':safe.code,message:uncertain?'전송됐는지 알 수 없어요. SNS에서 답장이 올라갔는지 확인하기 전까지 다시 보내지 않아요.':safe.message});}
    actor(user,channel.id,context);return {attempt:attemptView(attempt)};
  },context.signal);}
  function reconcile(user,input={},context={}){return run(async signal=>{
    context={...context,signal};let attempt=normalizeLease(store.get(K.attempts,text(input.attemptId,100,'답장 기록 ID',true)));if(!attempt)throw fail('REPLY_NOT_FOUND','답장 전송 기록을 찾을 수 없어요.',404);
    const {row,channel}=getItem(user,attempt.inboxId,context),replyId=id(input.remoteReplyId);if(!replyId)throw fail('INVALID_REPLY_ID','SNS에서 확인한 답장 ID를 입력해 주세요.',400);
    if(attempt.status==='sent'&&attempt.remoteReplyId===replyId)return {attempt:attemptView(attempt)};
    if(attempt.status!=='unknown')throw fail('RECONCILE_NOT_NEEDED','전송 여부를 모르는 답장만 SNS 답장 ID로 확인할 수 있어요.');
    const generation=binding(channel.id),check=()=>{const current=getItem(user,row.id,context).row;if(binding(channel.id)!==generation||channel.platform!==attempt.platform||current.externalId!==attempt.externalId||current.nativePostId!==attempt.nativePostId||current.sourceAccountId!==attempt.sourceAccountId||current.source!=='api:'+channel.platform)throw fail('CONNECTION_CHANGED','원댓글이나 발신 계정이 바뀌었어요.');};check();
    const session=await accountSession(user,channel,context,generation,true);await inspectComment(session,row,channel);const ig=channel.platform==='instagram',remote=await session.api(replyId,{fields:ig?'id,text,parent_id,media,user,from,timestamp,hidden':'id,message,parent,object,from,created_time,is_hidden,is_private'});check();
    const parent=ig?remote.parent_id:remote.parent?.id,owner=ig?(remote.user?.id||remote.from?.id):remote.from?.id,body=ig?remote.text:remote.message,postId=ig?remote.media?.id:remote.object?.id;
    const owned=owner===session.account.id||ig&&session.account.appScopedId&&owner===session.account.appScopedId;
    if(remote.id!==replyId||parent!==attempt.externalId||!owned||body!==attempt.text||postId!==attempt.nativePostId||remote.hidden||remote.is_hidden||remote.is_private)throw fail('REPLY_PROOF_MISMATCH','SNS 답장의 계정·원댓글·게시물·최종 문구가 전송 기록과 맞지 않아요.');
    const timestamp=ig?remote.timestamp:remote.created_time,sentAt=Number.isFinite(Date.parse(timestamp))?new Date(timestamp).toISOString():null;if(sentAt&&Date.parse(sentAt)<Date.parse(attempt.createdAt)-5*MINUTE)throw fail('REPLY_PROOF_MISMATCH','이번 전송 요청보다 먼저 작성된 답장이에요.');
    check();attempt=finish(attempt,{status:'sent',remoteReplyId:replyId,sentAt,observedAt:now(),reconciledBy:user.id,reconciledAt:now(),retryable:false,message:'SNS에서 원댓글·발신 계정·답장 내용을 조회해 확인했어요.',errorCode:null});return {attempt:attemptView(attempt)};
  },context.signal);}
  function health(user){
    const live=store.get('users',user?.id);
    return {provider:'meta',intervalMinutes:60,channels:live?.active?store.all('channels').filter(c=>c.active!==false&&!c.hidden&&canReadChannel(live,c)).map(c=>{
      const local=localIssue(c,credentialsFor(c)),reply=localIssue(c,credentialsFor(c),true),stored=store.get(K.health,c.id),saved=stored?.generation===binding(c.id)?stored:null;
      return {channelId:c.id,state:local?['AUTH_REQUIRED','SCOPES_REQUIRED'].includes(local[0])?'auth_required':'unconfigured':saved?.errorCode==='AUTH_REQUIRED'?'auth_required':saved?.state||'unknown',apiState:saved?.apiState||'unknown',checkedAt:saved?.checkedAt||null,lastAttemptAt:saved?.lastAttemptAt||null,nextCheckAt:saved?.nextCheckAt||null,stale:!saved?.checkedAt||stamp()-Date.parse(saved.checkedAt)>HOUR,message:local?.[1]||saved?.message||'아직 Meta 계정 연결을 점검하지 않았어요.',errorCode:local?.[0]||saved?.errorCode||null,canCheck:canWriteChannel(live,c)&&!local,canReply:canWriteChannel(live,c)&&!reply&&!['ACCOUNT_MISMATCH','AUTH_REQUIRED'].includes(saved?.errorCode),missingScopes:reply?.[2]||[]};
    }):[]};
  }
  function checkHealth(user,input={},context={}){const {channel}=actor(user,input.channelId,context);if(healthRuns.has(channel.id))return healthRuns.get(channel.id).then(()=>{actor(user,channel.id,context);return health(user);});const generation=binding(channel.id),saved=store.get(K.health,channel.id);if(saved?.generation===generation&&saved.lastAttemptAt&&stamp()-Date.parse(saved.lastAttemptAt)<MINUTE)return Promise.resolve({...health(user),cached:true});
    const issue=localIssue(channel,credentialsFor(channel));if(issue)return Promise.resolve(health(user));
    const task=run(async signal=>{const joined={...context,signal},check=()=>{actor(user,channel.id,joined);if(binding(channel.id)!==generation)throw fail('CONNECTION_CHANGED','점검하는 동안 계정 설정이 바뀌었어요. 다시 점검해 주세요.');};check();const attempted=now();store.put(K.health,channel.id,{...(saved?.generation===generation?saved:{}),id:channel.id,generation,lastAttemptAt:attempted,nextCheckAt:new Date(stamp()+HOUR).toISOString(),checkedBy:user.id});
      try{await accountSession(user,channel,joined,generation);check();store.put(K.health,channel.id,{id:channel.id,generation,checkedBy:user.id,lastAttemptAt:attempted,checkedAt:now(),nextCheckAt:new Date(stamp()+HOUR).toISOString(),apiState:'connected',state:'connected',message:'Meta API 응답과 계정 ID를 확인했어요.',errorCode:null});}
      catch(error){check();store.put(K.health,channel.id,{...(saved?.generation===generation?saved:{}),id:channel.id,generation,checkedBy:user.id,lastAttemptAt:attempted,nextCheckAt:new Date(stamp()+HOUR).toISOString(),apiState:error.code==='ACCOUNT_MISMATCH'?'connected':error.code==='AUTH_REQUIRED'?'auth_required':'error',state:error.code==='ACCOUNT_MISMATCH'?'mismatch':'error',message:error.replySafe?error.message:'Meta 연결 상태를 확인하지 못했어요.',errorCode:error.replySafe?error.code:'META_ERROR'});}return health(user);
    },context.signal).finally(()=>healthRuns.delete(channel.id));healthRuns.set(channel.id,task);return task;
  }
  function scanHealthDue({signal}={}){if(scanTask)return scanTask;if(closed||signal?.aborted)return Promise.resolve({checked:0,failed:0});scanTask=(async()=>{let checked=0,failed=0;const settingsRows=store.all('socialInboxConnections').sort((a,b)=>(store.get(K.health,a.id)?.lastAttemptAt||'').localeCompare(store.get(K.health,b.id)?.lastAttemptAt||''));for(const settings of settingsRows){if(closed||signal?.aborted)break;if(!settings.enabled)continue;const c=store.get('channels',settings.id),user=store.get('users',settings.updatedBy);if(!c||c.active===false||c.hidden||!user?.active||!canWriteChannel(user,c)||localIssue(c,credentialsFor(c)))continue;const saved=store.get(K.health,c.id);if(saved?.generation===binding(c.id)&&saved.nextCheckAt>now())continue;checked++;try{const result=await checkHealth(user,{channelId:c.id},{signal});if(result.channels.find(row=>row.channelId===c.id)?.errorCode)failed++;}catch{failed++;}if(checked>=10)break;}return {checked,failed};})().finally(()=>scanTask=null);return scanTask;}
  const waitForIdle=async()=>{while(pending.size)await Promise.allSettled([...pending]);if(scanTask)await scanTask.catch(()=>{});};const stop=async()=>{closed=true;for(const controller of controllers)controller.abort();await waitForIdle();};
  return {workspace,preview,send,reconcile,health,checkHealth,scanHealthDue,waitForIdle,stop};
}
