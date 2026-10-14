import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel,canManageOwners} from './organization.mjs';
import {instagramIdentity,hasVerifiedMetaComments} from './meta-connection.mjs';

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
    const previous=store.get(SETTINGS,channel.id)||{};store.put(SETTINGS,channel.id,{...previous,id:channel.id,enabled:input.enabled,version:randomUUID(),connectionVersion:channel.connectionVersion||0,updatedBy:user.id,updatedAt:now(),lastError:null,lastErrorCode:null});return {channelId:channel.id,...capability(channel)};
  }
  function reserveRequest(channelId){transaction(()=>{const at=Date.parse(now()),row=store.get(BUDGET,channelId)||{},times=(row.times||[]).filter(t=>t>at-3600000);if(times.length>=120||row.retryAt>at)throw fail('RATE_LIMIT','댓글 조회 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true,nextRetryAt:new Date(Math.max(row.retryAt||0,(times[0]||at)+3600000)).toISOString()});store.put(BUDGET,channelId,{times:[...times,at],retryAt:row.retryAt||null});});}
  async function sync(user,input={},context={}){
    if(closed)throw fail('INBOX_STOPPED','댓글 수집기가 멈춰 있어 새 요청을 받지 않아요.',503);
    const initial=authorized(user,input.channelId,context),channel=initial.channel,state=store.get(SETTINGS,channel.id),ready=capability(channel);
    if(!ready.canSync)throw fail(ready.errorCode||'NOT_AVAILABLE',ready.reason);
    if(inFlight.has(channel.id))return {channelId:channel.id,status:'running',imported:0,updated:0};
    const maxPosts=input.maxPosts??10,maxComments=input.maxComments??200;
    if(!Number.isInteger(maxPosts)||maxPosts<1||maxPosts>25||!Number.isInteger(maxComments)||maxComments<1||maxComments>1000)throw fail('INVALID_LIMIT','한 번에 게시물 1~25개, 댓글 1~1000개까지 확인할 수 있어요.',400);
    const controller=new AbortController();controllers.add(controller);context={...context,signal:context.signal?AbortSignal.any([context.signal,controller.signal]):controller.signal};
    inFlight.add(channel.id);let tokenFingerprint,requests=0,partial=false,postCount=0;const warnings=[],collected=[],seen=new Set();
    function check(){
      const live=authorized(user,channel.id,context).channel,config=store.get(SETTINGS,channel.id);
      if(!config?.enabled||config.version!==state.version||(live.connectionVersion||0)!==(channel.connectionVersion||0))throw fail('CONNECTION_CHANGED','댓글을 읽는 동안 담당이나 연결 설정이 바뀌었어요. 읽은 결과는 저장하지 않았어요.');
      if(tokenFingerprint&&hash(store.secret('channel:'+channel.id)?.accessToken||'')!==tokenFingerprint)throw fail('CONNECTION_CHANGED','댓글 조회 연결이 바뀌었어요. 읽은 결과는 저장하지 않았어요.');
      if(context.signal?.aborted)throw fail('CANCELLED','댓글 수집이 취소됐어요.');
    }
    try{
      check();store.put(SETTINGS,channel.id,{...store.get(SETTINGS,channel.id),lastAttemptAt:now()});
      const credentials=await (getCredentials?getCredentials(channel):store.secret('channel:'+channel.id));check();const issue=credentialIssue(channel,credentials,now());if(issue)throw fail(issue[0],issue[1]);
      tokenFingerprint=hash(credentials.accessToken);check();const version=credentials.apiVersion||'v26.0';if(!/^v\d{1,2}\.\d{1,2}$/.test(version))throw fail('INVALID_CONFIG','Meta API 버전 설정을 확인해 주세요.');
      const direct=channel.platform==='instagram'&&credentials.authType==='instagram-login',origin=direct?'https://graph.instagram.com':'https://graph.facebook.com';let token=credentials.accessToken;
      async function api(path,params={}){
        check();if(++requests>40)throw fail('SCAN_LIMIT','한 번에 할 수 있는 댓글 조회량을 다 썼어요.',429,{partial:true});reserveRequest(channel.id);
        const url=new URL('/'+version+'/'+path,origin);for(const [key,value] of Object.entries(params))if(value!==undefined)url.searchParams.set(key,String(value));
        let response;try{response=await fetchImpl(url.href,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:context.signal?AbortSignal.any([context.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});}catch{throw fail('PROVIDER_NETWORK','Meta에서 댓글 조회 응답을 받지 못했어요.',502,{retryable:true});}check();
        let data;try{if(Number(response.headers?.get?.('content-length')||0)>2*1024*1024)throw Error();const body=await response.text();if(Buffer.byteLength(body)>2*1024*1024)throw Error();data=JSON.parse(body);}catch{throw fail('INVALID_RESPONSE','Meta 댓글 응답을 읽을 수 없어요.',502);}check();
        const code=Number(data?.error?.code);if(response.status===429||[4,17,32,613,80001].includes(code)){const retryAt=Date.parse(now())+3600000;const budget=store.get(BUDGET,channel.id)||{};store.put(BUDGET,channel.id,{...budget,retryAt});throw fail('RATE_LIMIT','Meta 댓글 조회 한도를 다 썼어요. 잠시 후 다시 확인해 주세요.',429,{retryable:true,nextRetryAt:new Date(retryAt).toISOString()});}
        if([401,403].includes(response.status)||[102,190,200,283,459].includes(code))throw fail('AUTH_REQUIRED','댓글 조회 토큰이나 권한이 만료됐어요. 다시 연결해 주세요.',409);
        if(response.status<200||response.status>=300||data?.error)throw fail('PROVIDER_REJECTED','Meta가 댓글 조회 요청을 거절했어요. 계정·권한·게시물 상태를 확인해 주세요.',502);
        return data;
      }
      async function pages(path,params,limit,onRow,firstAfter){
        let after=firstAfter,count=0;const cursors=new Set();
        do{const result=await api(path,{...params,limit:Math.min(50,limit-count),after});if(!Array.isArray(result.data))throw fail('INVALID_RESPONSE','Meta 목록 응답이 올바르지 않아요.',502);
          for(const row of result.data){if(count>=limit){partial=true;break;}count++;await onRow(row);}
          if(!result.paging?.next)break;const next=result.paging?.cursors?.after;if(typeof next!=='string'||!next||next.length>2000||cursors.has(next)){partial=true;warnings.push('다음 목록을 이어서 불러오지 못했어요.');break;}if(count>=limit||collected.length>=maxComments||requests>=39){partial=true;break;}after=next;cursors.add(next);
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
      const accountId=account.id,ownedPosts=[];await pages(accountId+(channel.platform==='instagram'?'/media':'/posts'),{fields:channel.platform==='instagram'?'id,permalink,timestamp':'id,permalink_url,created_time'},maxPosts,row=>{if(!id(row.id)||channel.platform==='facebook'&&!row.id.startsWith(accountId+'_'))throw fail('ACCOUNT_MISMATCH','연결한 계정의 게시물인지 확인할 수 없어요.');ownedPosts.push(row);});
      const fields=channel.platform==='instagram'?'id,text,timestamp,username,from,parent_id,replies.limit(50){id,text,timestamp,username,from,parent_id}':'id,message,created_time,from,parent';
      function add(comment,post,parentExternalId=null){
        if(!id(comment?.id)){partial=true;warnings.push('식별자가 없는 댓글은 가져오지 않았습니다.');return;}
        if(seen.has(comment.id)||collected.length>=maxComments){if(collected.length>=maxComments)partial=true;return;}seen.add(comment.id);
        const postUrl=sourceUrl(post.permalink||post.permalink_url,channel.platform),body=typeof comment.text==='string'?comment.text:typeof comment.message==='string'?comment.message:'';
        collected.push({externalId:comment.id,nativePostId:post.id,parentExternalId:id(parentExternalId||comment.parent_id||comment.parent?.id),author:clean(comment.username||comment.from?.username||comment.from?.name,120),text:clean(body,10000),remoteCreatedAt:instant(comment.timestamp||comment.created_time),url:postUrl,contentTruncated:body.length>10000});
      }
      for(const post of ownedPosts){
        if(collected.length>=maxComments||requests>=39){partial=true;break;}postCount++;
        await pages(post.id+'/comments',{fields,...(channel.platform==='facebook'?{filter:'stream',order:'reverse_chronological'}:{})},maxComments-collected.length,async comment=>{
          add(comment,post);if(channel.platform!=='instagram'||!id(comment.id))return;
          for(const reply of comment.replies?.data||[])add(reply,post,comment.id);
          if(comment.replies?.paging?.next){const after=comment.replies.paging.cursors?.after;if(typeof after==='string'&&after.length<=2000&&collected.length<maxComments&&requests<39)await pages(comment.id+'/replies',{fields:'id,text,timestamp,username,from,parent_id'},maxComments-collected.length,reply=>add(reply,post,comment.id),after);else partial=true;}
        });
      }
      check();const at=now(),coverage={scope:'recent-owned-posts',postLimit:maxPosts,commentLimit:maxComments,postsChecked:postCount,commentsReceived:collected.length,status:partial?'partial':'scanned',includesReplies:true,includesMessages:false,completeHistory:false};let imported=0,updated=0;
      transaction(()=>{check();for(const item of collected){
        const key='meta:'+hash(channel.platform+':'+accountId+':'+item.externalId),old=store.get(ROWS,key);if(old&&old.channelId!==channel.id)throw fail('DUPLICATE_ACCOUNT','같은 SNS 댓글이 다른 채널에 연결돼 있어요.');
        const collector=store.all('posts').find(p=>p.channelId===channel.id&&p.externalId===item.nativePostId&&p.source==='api:'+channel.platform);
        const matches=item.url?store.all('socialPublishJobs').filter(j=>j.channelId===channel.id&&j.status==='published'&&comparableUrl(j.publicationUrl)===comparableUrl(item.url)):[];
        const postId=old?.postId||(matches.length===1?matches[0].postId:'');
        const unchanged=old&&Object.entries(item).every(([k,v])=>old[k]===v)&&old.postId===postId&&old.collectorPostId===(collector?.id||null);
        const row={...old,...item,id:key,channelId:channel.id,postId,collectorPostId:collector?.id||null,kind:'comment',source:'api:'+channel.platform,sourceAccountId:accountId,revision:(old?.revision||0)+(unchanged?0:1),status:old?.status||'open',assigneeId:old?.assigneeId||initial.user.id,replyDraft:old?.replyDraft||'',outboundSent:old?.outboundSent===true,createdBy:old?.createdBy||user.id,createdAt:old?.createdAt||at,updatedAt:unchanged?old.updatedAt:at,importedAt:old?.importedAt||at,lastCollectedAt:at};
        store.put(ROWS,key,row);if(!old)imported++;else if(!unchanged)updated++;
      }store.put(SETTINGS,channel.id,{...store.get(SETTINGS,channel.id),lastSyncedAt:at,lastStatus:coverage.status,lastError:null,lastErrorCode:null,coverage});});
      return {channelId:channel.id,status:coverage.status,imported,updated,unchanged:collected.length-imported-updated,coverage,warnings:[...new Set(warnings)],outboundSent:false};
    }catch(error){
      const safe=error.inboxSafe?error:fail('PROVIDER_ERROR','댓글 수집을 마치지 못했어요. 연결 상태를 확인해 주세요.',502);
      try{check();store.put(SETTINGS,channel.id,{...store.get(SETTINGS,channel.id),lastStatus:'error',lastError:safe.message,lastErrorCode:safe.code});}catch{}
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
        const budget=store.get(BUDGET,channel.id);if(budget?.retryAt>Date.parse(now()))continue;
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
