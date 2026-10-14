import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel,canManageOwners} from './organization.mjs';
import {instagramIdentity,hasVerifiedMetaComments} from './meta-connection.mjs';
import {inboxProgressBinding,loadInboxProgress,newInboxTraversal,nextInboxPage,inboxProgressView} from './social-inbox-progress.mjs';

// Read-only Graph API contract checked 2026-10-13. No reply, DM, hide or delete call.
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation
// https://developers.facebook.com/docs/graph-api/reference/object/comments/
// https://developers.facebook.com/docs/graph-api/reference/page/feed/
const SETTINGS='socialInboxConnections',ROWS='socialInbox',BUDGET='socialInboxRequests';
const clean=(value,max=1000)=>typeof value==='string'?value.trim().slice(0,max):'';
const hash=value=>createHash('sha256').update(value).digest('hex');
const id=value=>typeof value==='string'&&/^\d{1,50}(?:_\d{1,50})?$/.test(value)?value:null;
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const scopes=credentials=>new Set(typeof credentials?.scope==='string'?credentials.scope.split(/[ ,]+/).filter(Boolean):[]);
const fail=(code,message,status=409,extra={})=>Object.assign(new Error(message),{code,status,inboxSafe:true,...extra});
function sourceUrl(value,platform){try{if(typeof value!=='string'||value.length>4096)return '';const url=new URL(value),host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||url.port||!(platform==='instagram'?['instagram.com','www.instagram.com']:['facebook.com','www.facebook.com','m.facebook.com']).includes(host))return '';url.hash='';for(const key of [...url.searchParams.keys()])if(!['id','story_fbid','fbid'].includes(key))url.searchParams.delete(key);return url.href;}catch{return '';}}
const comparableUrl=value=>{try{const url=new URL(value),identity=new URLSearchParams();for(const key of ['fbid','id','story_fbid'])if(url.searchParams.has(key))identity.set(key,url.searchParams.get(key));return url.hostname.replace(/^www\./,'').toLowerCase()+url.pathname.replace(/\/$/,'')+(identity.size?'?'+identity:'');}catch{return null;}};
function requiredScopes(channel,credentials){
  if(!['instagram','facebook'].includes(channel.platform))return [];
  if(channel.platform==='instagram')return credentials?.authType==='instagram-login'?['instagram_business_basic','instagram_business_manage_comments']:['instagram_basic','instagram_manage_comments','pages_read_engagement'];
  return ['pages_read_engagement','pages_read_user_content',...(credentials?.authType==='facebook-user'?['pages_show_list']:[])];
}
function credentialIssue(channel,credentials,at){
  if(!['instagram','facebook'].includes(channel.platform))return ['UNSUPPORTED_PLATFORM','Instagram·Facebook 페이지의 댓글만 자동으로 수집해요.'];
  if(!credentials?.accessToken)return ['NOT_CONNECTED','댓글 조회 권한이 있는 SNS 계정을 연결해 주세요.'];
  if(channel.collectionDisabled)return ['NOT_CONNECTED','SNS 조회 연결이 해제돼 있어요.'];
  if(credentials.expiresAt&&(!instant(credentials.expiresAt)||Date.parse(credentials.expiresAt)<=Date.parse(at)))return ['AUTH_REQUIRED','SNS 연결이 만료됐어요. 댓글 조회 권한을 허용해 다시 연결해 주세요.'];
  if(credentials.dataAccessExpiresAt&&(!instant(credentials.dataAccessExpiresAt)||Date.parse(credentials.dataAccessExpiresAt)<=Date.parse(at)))return ['AUTH_REQUIRED','SNS 데이터 접근 권한이 만료됐어요. 다시 연결해 주세요.'];
  const types=channel.platform==='instagram'?['instagram-login','instagram-facebook','facebook-page']:['facebook-user','facebook-page'];
  if(!types.includes(credentials.authType))return ['AUTH_TYPE_REQUIRED','댓글 조회용 Instagram 로그인 또는 Facebook 페이지 연결을 확인해 주세요.'];
  if(channel.platform==='facebook'&&!id(channel.externalId))return ['ACCOUNT_ID_REQUIRED','Facebook 페이지를 먼저 조회해 공식 계정 ID를 확인해 주세요.'];
  if(channel.platform==='instagram'&&credentials.authType!=='instagram-login'&&!id(credentials.accountId||channel.externalId))return ['ACCOUNT_ID_REQUIRED','Instagram 프로페셔널 계정 ID를 확인해 주세요.'];
  const granted=scopes(credentials),missing=requiredScopes(channel,credentials).filter(scope=>!granted.has(scope));
  if(missing.length&&!hasVerifiedMetaComments(channel,credentials))return ['SCOPES_REQUIRED','지금 연결에서 댓글 조회 권한이 확인되지 않아요. 이 권한을 허용해 다시 연결해 주세요.',missing];
  return null;
}

/** Explicitly enabled, bounded imports. Graph responses never become executable URLs. */
const COLLECTION_LIMIT=100,SCAN_REQUESTS=40;
export function createSocialInboxProvider({store,getCredentials,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
  if(!store)throw new TypeError('store is required');
  const now=()=>new Date(clock()).toISOString(),inFlight=new Set(),controllers=new Set(),idleWaiters=[];let closed=false,scanning=false,scanTask=null;
  function settleIdle(){if(!inFlight.size&&!scanning)for(const resolve of idleWaiters.splice(0))resolve();}
  const transaction=fn=>store.transaction(fn);
  function authorized(user,channelId,context={},manage=false){
    context.authorize?.();const live=store.get('users',user?.id),channel=store.get('channels',channelId);
    if(!live?.active)throw fail('AUTH_REQUIRED','현재 로그인 상태를 확인해 주세요.',401);
    if(!channel||channel.active===false||channel.hidden===true||!(manage?canManageOwners(live,channel):canWriteChannel(live,channel)))throw fail('CHANNEL_FORBIDDEN','댓글을 수집할 채널의 담당 권한을 확인해 주세요.',403);
    return {user:live,channel};
  }
  function capability(channel){
    const state=store.get(SETTINGS,channel.id),credentials=store.secret('channel:'+channel.id),issue=credentialIssue(channel,credentials,now());
    const reason=channel.active===false?'보관한 채널이에요.':issue?.[0]==='UNSUPPORTED_PLATFORM'?issue[1]:!state?.enabled?'이 계정의 댓글 자동 수집을 켜 주세요.':state.connectionVersion!==(channel.connectionVersion||0)?'계정 연결이나 담당이 바뀌었어요. 댓글 수집을 다시 설정해 주세요.':issue?.[1]||(['AUTH_REQUIRED','ACCOUNT_MISMATCH','PAGE_ACCESS_REQUIRED'].includes(state.lastErrorCode)?state.lastError:null);
    return {provider:'meta',mode:reason?'unavailable':'read-only',available:!reason,canSync:!reason,enabled:state?.enabled===true,kinds:['comment'],canReply:false,canReadMessages:false,reason:reason||'권한이 허용하는 최근 게시물의 댓글·답글을 읽어 와요. 지난 기록을 빠짐없이 가져오지는 못할 수 있어요.',requiredScopes:requiredScopes(channel,credentials),missingScopes:issue?.[2]||[],errorCode:reason?(issue?.[0]||state?.lastErrorCode||'NOT_ENABLED'):null,lastSyncedAt:state?.lastSyncedAt||null,lastAttemptAt:state?.lastAttemptAt||null,intervalMinutes:15,lastStatus:state?.lastStatus||null,lastError:state?.lastError||null,coverage:state?.coverage||null};
  }
  function settings(user){const live=store.get('users',user?.id);return {supports:{comments:true,directMessages:false,replies:false},channels:live?.active?store.all('channels').filter(c=>c.active!==false&&c.hidden!==true&&canReadChannel(live,c)).map(c=>{const cap=capability(c);return {channelId:c.id,...cap,canConfigure:['instagram','facebook'].includes(c.platform)&&canManageOwners(live,c),canSync:canWriteChannel(live,c)&&cap.canSync};}):[]};}
  function configure(user,input={},context={}){
    const {channel}=authorized(user,input.channelId,context,true);if(input.enabled!==true&&input.enabled!==false)throw fail('INVALID_SETTINGS','댓글 수집 사용 여부를 선택해 주세요.',400);
    if(!['instagram','facebook'].includes(channel.platform))throw fail('UNSUPPORTED_PLATFORM','Instagram·Facebook 페이지만 연결할 수 있어요.',400);
    const previous=store.get(SETTINGS,channel.id)||{};store.put(SETTINGS,channel.id,{...previous,id:channel.id,enabled:input.enabled,version:randomUUID(),connectionVersion:channel.connectionVersion||0,updatedBy:user.id,updatedAt:now(),lastError:null,lastErrorCode:null,progress:null});return {channelId:channel.id,...capability(channel)};
  }
  // Collection and replies share the 120 requests an hour in BUDGET; collection stops at 100 so replies always keep 20.
  function reserveRequest(channelId){transaction(()=>{const at=Date.parse(now()),row=store.get(BUDGET,channelId)||{},times=(row.times||[]).filter(t=>t>at-3600000);if(times.length>=COLLECTION_LIMIT||row.retryAt>at)throw fail('RATE_LIMIT','댓글 조회 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true,nextRetryAt:new Date(Math.max(row.retryAt||0,(times[0]||at)+3600000)).toISOString()});store.put(BUDGET,channelId,{times:[...times,at],retryAt:row.retryAt||null});});}
  async function sync(user,input={},context={}){
    if(closed)throw fail('INBOX_STOPPED','댓글 수집기가 멈춰 있어 새 요청을 받지 않아요.',503);
    const initial=authorized(user,input.channelId,context),channel=initial.channel,state=store.get(SETTINGS,channel.id),ready=capability(channel);
    if(!ready.canSync)throw fail(ready.errorCode||'NOT_AVAILABLE',ready.reason);
    if(inFlight.has(channel.id))return {channelId:channel.id,status:'running',imported:0,updated:0};
    const maxPosts=input.maxPosts??10,maxComments=input.maxComments??200;
    if(!Number.isInteger(maxPosts)||maxPosts<1||maxPosts>25||!Number.isInteger(maxComments)||maxComments<1||maxComments>1000)throw fail('INVALID_LIMIT','한 번에 게시물 1~25개, 댓글 1~1000개까지 확인할 수 있어요.',400);
    const controller=new AbortController();controllers.add(controller);context={...context,signal:context.signal?AbortSignal.any([context.signal,controller.signal]):controller.signal};
    inFlight.add(channel.id);let tokenFingerprint,requests=0,partial=false,progress=null,expectedRevision=state.progress?.revision||0;
    const warnings=[],counts={recentPosts:0,historyPosts:0,recentComments:0,historyComments:0};let imported=0,updated=0,unchanged=0;
    const initialAuthority=hash(JSON.stringify([channel.ownerIds,channel.teamId,initial.user.role,initial.user.teamId]));
    function check(){
      const live=authorized(user,channel.id,context).channel,config=store.get(SETTINGS,channel.id);
      if(!config?.enabled||config.version!==state.version||(live.connectionVersion||0)!==(channel.connectionVersion||0))throw fail('CONNECTION_CHANGED','댓글을 읽는 동안 담당이나 연결 설정이 바뀌었어요. 읽은 결과는 저장하지 않았어요.');
      if(tokenFingerprint&&hash(store.secret('channel:'+channel.id)?.accessToken||'')!==tokenFingerprint)throw fail('CONNECTION_CHANGED','댓글 조회 연결이 바뀌었어요. 읽은 결과는 저장하지 않았어요.');
      const actor=store.get('users',user.id);
      if(hash(JSON.stringify([live.ownerIds,live.teamId,actor?.role,actor?.teamId]))!==initialAuthority)throw fail('CONNECTION_CHANGED','댓글 수집 권한이 바뀌었어요. 마지막으로 저장한 위치에서 다시 확인해 주세요.');
      if(context.signal?.aborted)throw fail('CANCELLED','댓글 수집이 취소됐어요.');
    }
    try{
      check();store.put(SETTINGS,channel.id,{...store.get(SETTINGS,channel.id),lastAttemptAt:now()});
      const credentials=await (getCredentials?getCredentials(channel):store.secret('channel:'+channel.id));check();const issue=credentialIssue(channel,credentials,now());if(issue)throw fail(issue[0],issue[1]);
      tokenFingerprint=hash(credentials.accessToken);check();const version=credentials.apiVersion||'v26.0';if(!/^v\d{1,2}\.\d{1,2}$/.test(version))throw fail('INVALID_CONFIG','Meta API 버전 설정을 확인해 주세요.');
      const direct=channel.platform==='instagram'&&credentials.authType==='instagram-login',origin=direct?'https://graph.instagram.com':'https://graph.facebook.com';let token=credentials.accessToken;
      async function api(path,params={}){
        check();if(++requests>SCAN_REQUESTS)throw fail('SCAN_LIMIT','한 번에 할 수 있는 댓글 조회량을 다 썼어요.',429,{partial:true});reserveRequest(channel.id);
        const url=new URL('/'+version+'/'+path,origin);for(const [key,value] of Object.entries(params))if(value!==undefined)url.searchParams.set(key,String(value));
        let response;try{response=await fetchImpl(url.href,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:context.signal?AbortSignal.any([context.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});}catch{throw fail('PROVIDER_NETWORK','Meta에서 댓글 조회 응답을 받지 못했어요.',502,{retryable:true});}check();
        let data;try{if(Number(response.headers?.get?.('content-length')||0)>2*1024*1024)throw Error();const body=await response.text();if(Buffer.byteLength(body)>2*1024*1024)throw Error();data=JSON.parse(body);}catch{throw fail('INVALID_RESPONSE','Meta 댓글 응답을 읽을 수 없어요.',502);}check();
        const code=Number(data?.error?.code);if(response.status===429||[4,17,32,613,80001].includes(code)){const retryAt=Date.parse(now())+3600000;const budget=store.get(BUDGET,channel.id)||{};store.put(BUDGET,channel.id,{...budget,retryAt});throw fail('RATE_LIMIT','Meta 댓글 조회 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true,nextRetryAt:new Date(retryAt).toISOString()});}
        if([401,403].includes(response.status)||[102,190,200,283,459].includes(code))throw fail('AUTH_REQUIRED','댓글 조회 토큰이나 권한이 만료됐어요. 다시 연결해 주세요.',409);
        if(response.status<200||response.status>=300||data?.error){if(params.after&&code===100)throw fail('CURSOR_REJECTED','Meta의 이어받기 위치가 만료됐어요. 최근 목록부터 다시 확인해요.',502);throw fail('PROVIDER_REJECTED','Meta가 댓글 조회 요청을 거절했어요. 계정·권한·게시물 상태를 확인해 주세요.',502);}
        return data;
      }
      async function pages(path,params,limit,onRow,firstAfter){
        let after=firstAfter,count=0;const cursors=new Set();
        do{const result=await api(path,{...params,limit:Math.min(50,limit-count),after});if(!Array.isArray(result.data))throw fail('INVALID_RESPONSE','Meta 목록 응답이 올바르지 않아요.',502);
          for(const row of result.data){if(count>=limit){partial=true;break;}count++;await onRow(row);}
          if(!result.paging?.next)break;const next=result.paging?.cursors?.after;if(typeof next!=='string'||!next||next.length>2000||/[\s\x00-\x1f\x7f]/.test(next)||cursors.has(next)){partial=true;warnings.push('다음 목록을 이어서 불러오지 못했어요.');break;}if(count>=limit||requests>=39){partial=true;break;}after=next;cursors.add(next);
        }while(true);
      }
      let account;
      if(channel.platform==='facebook'&&credentials.authType==='facebook-user'){
        let matched;await pages('me/accounts',{fields:'id,access_token,tasks'},500,row=>{if(row.id===channel.externalId)matched=row;});
        if(!matched?.access_token||!Array.isArray(matched.tasks)||!matched.tasks.includes('MODERATE'))throw fail('PAGE_ACCESS_REQUIRED','연결한 페이지의 MODERATE 관리 권한과 페이지 토큰을 확인해 주세요.');token=matched.access_token;
      }
      account=await api(channel.platform==='instagram'&&!direct?(credentials.accountId||channel.externalId):'me',{fields:channel.platform==='instagram'?(direct?'id,user_id,username':'id,username'):'id,name'});
      if(direct)account=instagramIdentity(account,{requireUserId:credentials.metaIdentityVersion===1});
      if(!id(account?.id)||channel.externalId&&account.id!==channel.externalId||channel.platform==='instagram'&&channel.handle&&clean(account.username).toLowerCase()!==channel.handle.replace(/^@/,'').toLowerCase())throw fail('ACCOUNT_MISMATCH','연결한 SNS 계정이 SYNK 채널과 달라요.');
      const accountId=account.id,ownIds=new Set([accountId,account.appScopedId].filter(Boolean));
      const binding=inboxProgressBinding(channel,state,credentials,store.get('users',state.updatedBy));
      progress=loadInboxProgress(state.progress,binding,now());
      const seedHistory=!progress.history?.length;
      const replyFields=channel.platform==='instagram'?'id,text,timestamp,username,from,user,parent_id,hidden':'id,message,created_time,from,parent,is_hidden,is_private';
      const fields=channel.platform==='instagram'?replyFields+',replies.limit(50){'+replyFields+'}':replyFields;
      const rowKey=externalId=>'meta:'+hash(channel.platform+':'+accountId+':'+externalId);
      // Look-ups instead of a full table scan for every saved comment (5,000 stored comments: one scan took 53~151 s and
      // held the server for 7~45 s). Reply rows are created only by this scan, so the per-parent index is built once and
      // grows as rows are saved; posts and published jobs are indexed once per checkpoint transaction.
      const repliedParents=new Set(),childIndex=new Map();let lookups=null;
      function addChild(row){let keys=childIndex.get(row.parentExternalId);if(!keys)childIndex.set(row.parentExternalId,keys=new Set());keys.add(row.id);}
      for(const row of store.all(ROWS))if(row.parentExternalId){addChild(row);if(row.channelId===channel.id&&row.sourceAccountId===accountId)repliedParents.add(row.parentExternalId);}
      function sweep(){const collectors=new Map(),published=new Map();
        for(const p of store.all('posts'))if(p.channelId===channel.id&&p.source==='api:'+channel.platform&&!collectors.has(p.externalId))collectors.set(p.externalId,p);
        for(const j of store.all('socialPublishJobs'))if(j.channelId===channel.id&&j.status==='published'){const key=comparableUrl(j.publicationUrl);if(!published.has(key))published.set(key,[]);published.get(key).push(j);}
        return {collectors,published};}
      const coverage=()=>({scope:'recent-and-history',postLimit:maxPosts,commentLimit:maxComments,postsChecked:counts.recentPosts+counts.historyPosts,commentsReceived:counts.recentComments+counts.historyComments,status:partial||progress.history?.length?'partial':'scanned',includesReplies:true,includesMessages:false,completeHistory:false,progress:inboxProgressView(progress,counts)});
      function normalize(comment,post,parentId=null){
        if(!id(comment?.id))throw fail('INVALID_RESPONSE','댓글 응답의 ID가 올바르지 않아요.',502);
        const body=typeof comment.text==='string'?comment.text:typeof comment.message==='string'?comment.message:'';
        const parent=id(parentId||comment.parent_id||comment.parent?.id),authors=[comment.from?.id,comment.user?.id].filter(value=>id(value));
        const ownAuthor=Boolean(parent&&authors.length&&authors.every(value=>ownIds.has(value))),hidden=comment.hidden===true||comment.is_hidden===true||comment.is_private===true;
        return {externalId:comment.id,nativePostId:post.id,parentExternalId:parent,author:clean(comment.username||comment.from?.username||comment.from?.name,120),text:clean(body,10000),remoteCreatedAt:instant(comment.timestamp||comment.created_time),url:sourceUrl(post.url,channel.platform),contentTruncated:body.length>10000,authorKnown:authors.length>0&&!(authors.some(value=>ownIds.has(value))&&authors.some(value=>!ownIds.has(value))),accountReply:ownAuthor&&!hidden,hiddenAccountReply:ownAuthor&&hidden};
      }
      function updateEvidence(parentId,postId,lane,scanId,complete,at,startedAt=at){
        const parent=store.get(ROWS,rowKey(parentId));
        if(!parent||parent.channelId!==channel.id||parent.sourceAccountId!==accountId||parent.nativePostId!==postId||parent.parentExternalId)return;
        if(parent.metaReplyCompleteAt&&parent.metaReplyCompleteAt>at)return;
        if(parent.metaReplyCompleteAt&&parent.metaReplyCompleteAt>startedAt)complete=false;
        const prior=parent.externalReplyEvidence,children=[...(childIndex.get(parentId)||[])].map(key=>store.get(ROWS,key)).filter(Boolean).filter(row=>row.channelId===channel.id&&row.sourceAccountId===accountId&&row.nativePostId===postId&&row.parentExternalId===parentId&&row.metaAccountReply?.connectionVersion===(channel.connectionVersion||0));
        // Complete scans replace the observed set; partial scans retain earlier proof.
        const observed=children.filter(row=>scanId===null||row.metaAccountReply?.[lane+'ScanId']===scanId);
        const rows=(complete?observed:children).filter(row=>row.metaAccountReply?.confirmed!==false&&row.metaAccountReply?.hidden!==true);
        if(!complete&&!observed.length)return;
        const priorBound=prior?.sourceAccountId===accountId&&prior.connectionVersion===(channel.connectionVersion||0);
        if(!complete&&priorBound&&prior.replyCount>20&&!Array.isArray(parent.metaReplyProofIds))return;
        const hiddenIds=new Set(children.filter(row=>row.metaAccountReply?.hidden===true).map(row=>row.externalId));
        const priorIds=priorBound?(Array.isArray(parent.metaReplyProofIds)?parent.metaReplyProofIds:prior?.replyIds||[]).filter(value=>id(value)&&!hiddenIds.has(value)):[];
        const ids=[...new Set([...rows.map(row=>row.externalId),...(!complete?priorIds:[])])].sort();
        const candidates=[...rows];if(!complete&&ids.includes(prior?.latestReplyExternalId))candidates.push({externalId:prior.latestReplyExternalId,remoteCreatedAt:prior.latestReplyAt});
        const latest=candidates.sort((a,b)=>(b.remoteCreatedAt||'').localeCompare(a.remoteCreatedAt||'')||b.externalId.localeCompare(a.externalId))[0];
        if(complete)for(const child of children)store.put(ROWS,child.id,{...child,metaAccountReply:{...child.metaAccountReply,confirmed:ids.includes(child.externalId)}});
        const observedAt=scanId===null?observed.map(row=>row.lastCollectedAt).filter(Boolean).sort().at(-1)||at:at;
        const evidence={source:'meta-read',method:'author-id-match',connectionVersion:channel.connectionVersion||0,sourceAccountId:accountId,replyIds:ids.slice(0,20),replyCount:ids.length,replySetHash:hash(JSON.stringify(ids)),latestReplyExternalId:latest?.externalId||null,latestReplyAt:latest?.remoteCreatedAt||null,observedAt,complete};
        if(!ids.length&&!prior){if(complete)store.put(ROWS,parent.id,{...parent,metaReplyCompleteAt:at,metaReplyProofIds:[]});return;}
        const changed=!prior||['replySetHash','complete','connectionVersion','sourceAccountId','latestReplyAt'].some(key=>prior[key]!==evidence[key]);
        store.put(ROWS,parent.id,{...parent,externalReplyEvidence:evidence,metaReplyProofIds:ids,metaReplyCompleteAt:complete?at:parent.metaReplyCompleteAt||null,revision:parent.revision+(changed?1:0),updatedAt:changed?at:parent.updatedAt});
      }
      function saveItem(task,lane,at){
        const {accountReply,hiddenAccountReply,authorKnown,...item}=task.item,key=rowKey(item.externalId),old=store.get(ROWS,key);
        if(old&&old.channelId!==channel.id)throw fail('DUPLICATE_ACCOUNT','같은 SNS 댓글이 다른 채널에 연결돼 있어요.');
        const observedAt=task.observedAt||at;
        if(old?.lastCollectedAt>observedAt){unchanged++;return;}
        const collector=lookups?lookups.collectors.get(item.nativePostId):store.all('posts').find(p=>p.channelId===channel.id&&p.externalId===item.nativePostId&&p.source==='api:'+channel.platform);
        const matches=item.url?(lookups?lookups.published.get(comparableUrl(item.url))||[]:store.all('socialPublishJobs').filter(j=>j.channelId===channel.id&&j.status==='published'&&comparableUrl(j.publicationUrl)===comparableUrl(item.url))):[];
        const postId=old?.postId||(matches.length===1?matches[0].postId:''),same=old&&Object.entries(item).every(([k,v])=>old[k]===v)&&old.postId===postId&&old.collectorPostId===(collector?.id||null);
        const parent=item.parentExternalId?store.get(ROWS,rowKey(item.parentExternalId)):null;
        const currentAuthorProof=accountReply&&!(parent?.metaReplyCompleteAt>observedAt&&!old?.metaAccountReply?.confirmed);
        const currentHiddenProof=hiddenAccountReply&&!(parent?.metaReplyCompleteAt>observedAt);
        const metaAccountReply=currentAuthorProof||currentHiddenProof?{...(old?.metaAccountReply||{}),connectionVersion:channel.connectionVersion||0,[lane+'ScanId']:task.scanId,confirmed:!currentHiddenProof,hidden:currentHiddenProof===true}:old?.metaAccountReply||null;
        const row={...old,...item,id:key,channelId:channel.id,postId,collectorPostId:collector?.id||null,kind:'comment',source:'api:'+channel.platform,sourceAccountId:accountId,revision:(old?.revision||0)+(same?0:1),status:old?.status||'open',assigneeId:old?.assigneeId||initial.user.id,replyDraft:old?.replyDraft||'',outboundSent:old?.outboundSent===true,createdBy:old?.createdBy||user.id,createdAt:old?.createdAt||at,updatedAt:same?old.updatedAt:at,importedAt:old?.importedAt||at,lastCollectedAt:observedAt,metaAccountReply};
        store.put(ROWS,key,row);if(!old&&row.parentExternalId)addChild(row);if(!old)imported++;else if(!same)updated++;else unchanged++;
        if(currentAuthorProof||currentHiddenProof)updateEvidence(item.parentExternalId,item.nativePostId,lane,task.scanId,false,observedAt,task.startedAt||observedAt);
        if(!item.parentExternalId&&!old?.externalReplyEvidence)updateEvidence(item.externalId,item.nativePostId,lane,null,false,at);
      }
      function checkpoint(tasks,lane,{items=[],ends=[],done=false}={}){
        const at=now();
        transaction(()=>{
          check();const current=store.get(SETTINGS,channel.id);
          if((current.progress?.revision||0)!==expectedRevision)throw fail('PROGRESS_CHANGED','다른 수집이 먼저 진행 위치를 갱신했어요. 저장된 위치에서 다시 이어가요.');
          lookups=items.length?sweep():null;
          try{for(const task of items)saveItem(task,task.scanLane||lane,at);}finally{lookups=null;}
          for(const task of ends)updateEvidence(task.parentId,task.postId,task.scanLane||lane,task.scanId,task.complete,task.observedAt||at,task.startedAt||at);
          if(lane==='history'||seedHistory)progress.history=tasks;
          if(done&&lane==='history')progress.historyCompletedAt=at;
          progress={...progress,revision:expectedRevision+1,lastCheckpointAt:at};
          store.put(SETTINGS,channel.id,{...current,progress,coverage:coverage()});
        });expectedRevision=progress.revision;
      }
      async function traverse(lane,start,{postLimit,commentLimit,requestLimit}){
        const tasks=structuredClone(start),posts=new Set();let comments=0;
        function drain(){
          const items=[],ends=[];
          while(tasks.length){const task=tasks[0];if(task.kind==='reply-end'){ends.push(tasks.shift());continue;}if(task.kind!=='item'||comments>=commentLimit)break;if(!posts.has(task.item.nativePostId)){if(posts.size>=postLimit)break;posts.add(task.item.nativePostId);counts[lane+'Posts']++;}items.push(tasks.shift());comments++;}
          counts[lane+'Comments']+=items.length;
          checkpoint(tasks,lane,{items,ends,done:!tasks.length});
        }
        while(tasks.length){
          check();drain();if(!tasks.length||comments>=commentLimit||requests>=requestLimit)break;
          const task=tasks[0];
          if(task.kind==='item')break;
          if(task.kind!=='posts'&&!posts.has(task.post.id)){if(posts.size>=postLimit)break;posts.add(task.post.id);counts[lane+'Posts']++;}
          if(task.kind==='posts'&&posts.size>=postLimit)break;
          const path=task.kind==='posts'?accountId+(channel.platform==='instagram'?'/media':'/posts'):task.kind==='comments'?task.post.id+'/comments':task.parentId+'/replies';
          const params=task.kind==='posts'?{fields:channel.platform==='instagram'?'id,permalink,timestamp':'id,permalink_url,created_time',limit:Math.min(25,postLimit-posts.size)}:{fields:task.kind==='replies'?replyFields:fields,limit:Math.min(50,commentLimit-comments),...(channel.platform==='facebook'&&task.kind==='comments'?{filter:'stream',order:'reverse_chronological'}:{})};
          let result;try{result=await api(path,{...params,after:task.after??undefined});}catch(error){if(error.code==='CURSOR_REJECTED'){tasks[0]={...task,after:null,cursors:[]};progress.resetReason='expired-cursor';partial=true;checkpoint(tasks,lane);break;}throw error;}
          if(!Array.isArray(result.data)||result.data.length>50)throw fail('INVALID_RESPONSE','Meta 목록 응답이 올바르지 않아요.',502);
          const next=nextInboxPage(result,task),expanded=[],observedAt=now();let identityComplete=task.identityComplete!==false;
          if(result.paging?.next&&!next.after){partial=true;warnings.push('다음 목록 커서를 확인하지 못해 마지막 위치부터 다시 확인해요.');}
          if(task.kind==='posts'){
            for(const post of result.data){if(!id(post.id)||channel.platform==='facebook'&&!post.id.startsWith(accountId+'_'))throw fail('ACCOUNT_MISMATCH','연결한 계정의 게시물인지 확인할 수 없어요.');expanded.push({kind:'comments',post:{id:post.id,url:sourceUrl(post.permalink||post.permalink_url,channel.platform)},after:null,cursors:[]});}
          }else{
            for(const comment of result.data){
              const scanId=task.scanId||randomUUID(),scanLane=task.scanLane||(seedHistory?'history':lane),startedAt=task.startedAt||observedAt,item=normalize(comment,task.post,task.kind==='replies'?task.parentId:null);
              if(task.kind==='replies'&&!item.authorKnown)identityComplete=false;
              expanded.push({kind:'item',item,scanId,scanLane,observedAt,startedAt});
              if(task.kind==='comments'&&channel.platform==='instagram'&&!item.parentExternalId){
                // Meta leaves `replies` out when a comment has none (10-14 live scan: 1 post, 6 comments, 14 GETs, one empty
                // /replies lookup per comment). A missing field is an empty, complete list unless the comment had replies
                // before; then its /replies edge is still read so a missing field cannot erase them.
                const replies=comment.replies,known=replies?null:store.get(ROWS,rowKey(item.externalId)),hadReplies=!replies&&(repliedParents.has(item.externalId)||known?.externalReplyEvidence?.replyCount>0||known?.metaReplyProofIds?.length>0);
                if(replies&&!Array.isArray(replies.data)||replies?.data?.length>50)throw fail('INVALID_RESPONSE','Meta 답글 목록을 확인하지 못했어요.',502);
                let replyIdentityComplete=true;
                for(const reply of replies?.data||[]){const replyItem=normalize(reply,task.post,item.externalId);if(!replyItem.authorKnown)replyIdentityComplete=false;expanded.push({kind:'item',item:replyItem,scanId,scanLane,observedAt,startedAt});}
                const following=replies?nextInboxPage(replies,{after:null,cursors:[]}):{after:null,complete:!hadReplies,cursors:[]};
                if(following.after||!following.complete)expanded.push({kind:'replies',post:task.post,parentId:item.externalId,scanId,scanLane,startedAt,identityComplete:replyIdentityComplete,after:following.after,cursors:following.cursors});
                else expanded.push({kind:'reply-end',parentId:item.externalId,postId:task.post.id,scanId,scanLane,observedAt,startedAt,complete:following.complete&&replyIdentityComplete});
              }
            }
          }
          if(next.after)expanded.push({...task,after:next.after,cursors:next.cursors,identityComplete});
          else if(!next.complete)expanded.push({...task,after:task.after,cursors:task.cursors});
          else if(task.kind==='replies')expanded.push({kind:'reply-end',parentId:task.parentId,postId:task.post.id,scanId:task.scanId,scanLane:task.scanLane,observedAt,startedAt:task.startedAt,complete:identityComplete});
          // The recent lane reads the first page of every new post before any post's next page, so one busy post cannot use up
          // the lane while the next posts' new comments wait for the history lane.
          const later=lane==='recent'&&task.kind==='comments'&&expanded.at(-1)?.kind==='comments'&&expanded.at(-1).post?.id===task.post.id?expanded.pop():null;
          tasks.splice(0,1,...expanded);if(later){const before=tasks.findIndex(next=>next.kind==='posts');tasks.splice(before<0?tasks.length:before,0,later);}drain();
          if(result.paging?.next&&!next.after)break;
        }
        return tasks;
      }
      // Reserve half the bounded work for a fresh head poll before historical work.
      // A single-post/comment test remains useful; production defaults are 10/200.
      const recentPosts=Math.max(1,Math.floor(maxPosts/2)),recentComments=Math.max(1,Math.floor(maxComments/2));
      const hadHistory=Boolean(progress.history?.length);
      if(hadHistory&&(maxPosts===1||maxComments===1)&&progress.smallTurn!=='recent'){
        progress.smallTurn='recent';await traverse('history',progress.history,{postLimit:maxPosts,commentLimit:maxComments,requestLimit:40});
      }else{
        progress.smallTurn='history';
        const recent=await traverse('recent',newInboxTraversal(),{postLimit:hadHistory?recentPosts:maxPosts,commentLimit:hadHistory?recentComments:maxComments,requestLimit:hadHistory?Math.min(20,requests+18):40});
        if(recent.length)partial=true;
        if(!hadHistory){progress.history=recent;checkpoint(recent,'history',{done:!recent.length});}
        else if(counts.recentPosts<maxPosts&&counts.recentComments<maxComments&&requests<40){
          await traverse('history',progress.history,{postLimit:maxPosts-counts.recentPosts,commentLimit:maxComments-counts.recentComments,requestLimit:40});
        }
      }
      check();const finalCoverage=coverage(),at=now();transaction(()=>{check();store.put(SETTINGS,channel.id,{...store.get(SETTINGS,channel.id),lastSyncedAt:at,lastStatus:finalCoverage.status,lastError:null,lastErrorCode:null,coverage:finalCoverage});});
      return {channelId:channel.id,status:finalCoverage.status,imported,updated,unchanged,coverage:finalCoverage,warnings:[...new Set(warnings)],outboundSent:false};
    }catch(error){
      const safe=error.inboxSafe?error:fail('PROVIDER_ERROR','댓글 수집을 마치지 못했어요. 연결 상태를 확인해 주세요.',502);
      try{transaction(()=>{check();const current=store.get(SETTINGS,channel.id);if((current.progress?.revision||0)===expectedRevision)store.put(SETTINGS,channel.id,{...current,lastStatus:'error',lastError:safe.message,lastErrorCode:safe.code});});}catch{}
      throw safe;
    }finally{inFlight.delete(channel.id);controllers.delete(controller);settleIdle();}
  }
  function scanDue({signal}={}){
    if(scanTask)return scanTask;
    if(closed||signal?.aborted)return Promise.resolve({checked:0,imported:0,updated:0,failed:0});
    scanning=true;const controller=new AbortController();controllers.add(controller);const joined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
    const run=(async()=>{
      const result={checked:0,imported:0,updated:0,failed:0};
      for(const saved of store.all(SETTINGS)){
        if(closed||joined.aborted)break;
        const channel=store.get('channels',saved.id),actor=store.get('users',saved.updatedBy),state=store.get(SETTINGS,saved.id);
        if(!state?.enabled||!channel||channel.active===false||channel.hidden===true||!actor?.active||!canWriteChannel(actor,channel)||inFlight.has(channel.id)||!capability(channel).canSync)continue;
        if(state.lastAttemptAt&&Date.parse(state.lastAttemptAt)>Date.parse(now())-15*60000)continue;
        const budget=store.get(BUDGET,channel.id),hourAgo=Date.parse(now())-3600000;if(budget?.retryAt>Date.parse(now()))continue;
        // A scheduled scan starts only when a whole scan fits in collection's share, instead of failing midway.
        if((budget?.times||[]).filter(t=>t>hourAgo).length+SCAN_REQUESTS>COLLECTION_LIMIT)continue;
        result.checked++;
        try{const imported=await sync(actor,{channelId:channel.id},{signal:joined});result.imported+=imported.imported||0;result.updated+=imported.updated||0;}catch{result.failed++;}
      }
      return result;
    })();
    scanTask=run.finally(()=>{controllers.delete(controller);scanning=false;scanTask=null;settleIdle();});return scanTask;
  }
  const waitForIdle=()=>inFlight.size||scanning?new Promise(resolve=>idleWaiters.push(resolve)):Promise.resolve();
  async function stop(){closed=true;for(const controller of controllers)controller.abort();await waitForIdle();}
  return {settings,capability,configure,sync,scanDue,waitForIdle,stop};
}
