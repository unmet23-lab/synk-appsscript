import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Store, now, today, token, hash, publicUser, passwordMatches, passwordHash } from './store.mjs';
import { normalizeChannelUrl, collectChannel, PLATFORM_CAPABILITIES } from './collectors.mjs';
import { analyze, companyOverview, analyticsCsv, shiftDate, dateRange, METRICS, metricPoint, compareMetric, metricIndex } from '../analytics.mjs';
import { providers, createAuthorization, exchangeCode, refreshCredentials } from './oauth.mjs';
import { canReadChannel,canWriteChannel,canManageOwners,visibleMembers,seedOwnership,recordOwnershipChange,ownerAt } from './organization.mjs';
import { planFailure,shouldCollect,collectionHealth,recentPolicyChannel,recentNextCheckAt,shouldCollectRecent,RECENT_INTERVAL_MINUTES } from './collection-policy.mjs';
import { recordsForOwner } from './ownership-report.mjs';
import { buildHypeFeed } from './hype.mjs';
import { createContentService } from './content-service.mjs';
import { createDailyTrendsService } from './daily-trends-service.mjs';
import { createCreativeResearchService } from './creative-research.mjs';
import { createCreatorReviewsService } from './creator-reviews.mjs';
import { createCreatorSourcesService } from './creator-sources.mjs';
import { createStaticResponder } from './static-response.mjs';
import { workroomGuide,workroomSource } from './workroom-guide.mjs';
import { companyGuide } from './company-guide.mjs';
import { createStudioService } from './studio-service.mjs';
import { createDemoService } from './demo-service.mjs';
import { buildGrowthSummary } from './growth-summary.mjs';
import { buildGrowthHistory } from './growth-history.mjs';
import { buildTeamTrends } from './team-trends.mjs';
import { buildContentLeaders } from './content-leaders.mjs';
import { createAssistantService } from './assistant-service.mjs';
import { createCrewProfileService } from './crew-profile-service.mjs';
import { receiveStudioMedia,commitStudioMedia,discardStudioMedia,serveStudioMedia } from './studio-media.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';
import { resolvePlatformUrl } from '../../../../../tools/company-messenger/platform-navigation.mjs';
import { createSynkIdentity, synkIdentityConfig } from './synk-identity.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const metricKeys=['views','likes','comments','shares','saves','reach'];
const HYPE_RECENT_MS=7*86400000,HYPE_RETENTION_MS=8*86400000;
const recentFields=value=>Object.fromEntries(Object.entries(value).map(([key,val])=>['recent'+key[0].toUpperCase()+key.slice(1),val]));
const safeError=message=>String(message||'처리하지 못했습니다.').replace(/(?:Bearer\s+|access_token=|refresh_token=)[^\s&]+/gi,'[보호된 값]').slice(0,400);
const httpError=(message,status=400)=>Object.assign(new Error(message),{status});
const text=(value,max=200)=>String(value??'').trim().slice(0,max);
const count=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const isLocalHost=host=>['127.0.0.1','localhost','::1'].includes(host);

export function createCompanyApp(options={}) {
  const port=Number(options.port??process.env.SYNK_COMPANY_PORT??4191);
  const host=options.host??process.env.SYNK_COMPANY_HOST??'127.0.0.1';
  const originUrl=new URL(options.origin??process.env.SYNK_COMPANY_ORIGIN??`http://127.0.0.1:${port}`);
  const origin=originUrl.origin;
  if(!isLocalHost(host)&&originUrl.protocol!=='https:')throw new Error('크루용 서버에는 HTTPS 회사 주소가 필요합니다.');
  if(originUrl.pathname!=='/'||originUrl.search||originUrl.hash||originUrl.username)throw new Error('회사 주소에는 경로를 넣지 마세요.');
  const platformUrl=resolvePlatformUrl(options.platformUrl===undefined?process.env.SYNK_PLATFORM_URL:options.platformUrl,{origin});
  const store=options.store??new Store(options.dataDir??process.env.SYNK_COMPANY_DATA??join(here,'data'));
  const integrationFile=join(store.directory,'workspace-integration.json');
  let integrationConfig={};
  if(existsSync(integrationFile)){
    try{integrationConfig=JSON.parse(readFileSync(integrationFile,'utf8'));}catch{throw new Error('사내 앱 통합 설정을 읽을 수 없습니다.');}
  }
  const messengerDataDir=options.messengerDataDir??integrationConfig.messengerDataDir??((options.dataDir||options.store)?join(store.directory,'messenger'):resolve(here,'../../../../../tools/company-messenger/data'));
  let messenger;
  const synkIdentity=createSynkIdentity({store,origin,config:options.synkIdentityConfig===undefined?synkIdentityConfig():options.synkIdentityConfig,fetch:options.synkIdentityFetch,verifyIdentity:options.synkIdentityVerifier,now:options.synkIdentityNow,onRevoked:()=>messenger?.disconnectRevoked()});
  messenger=createMessenger({dataDir:messengerDataDir,driveStorage:options.messengerDriveStorage,basePath:'/messenger',platformUrl,integration:{
    origin,identityLinks:options.messengerIdentityLinks??integrationConfig.identityLinks??[],
    listUsers:()=>store.all('users'),listTeams:()=>store.all('teams'),workspaceName:()=>store.get('settings','company')?.companyName||'SYNK',
    authenticate(req){const auth=session(req);if(!auth)return null;return {companyUserId:auth.user.id,role:auth.user.role,canWrite:auth.user.role!=='viewer',canManage:auth.user.role==='admin',csrfToken:auth.body.csrfToken,token:auth.hash,parentOrigin:origin};},
    resolveWorkspaceLink({companyUserId,recipientCompanyUserIds,workspaceLink,purpose}){
      const url=new URL(workspaceLink.url,origin),params=new URLSearchParams(url.hash?url.hash.slice(1):url.search),draftId=params.get('draftId');
      if(draftId)return (purpose==='restore'?content.reviewRestore:content.reviewShare)(store.get('users',companyUserId),draftId,recipientCompanyUserIds).workspaceLink;
      if(workspaceLink.kind==='content-review')throw httpError('검토할 기획을 선택해 주세요.');
      return workspaceLink;
    },
  }});
  const legacyPort=options.legacyMessengerPort??integrationConfig.legacyMessengerPort;
  if(legacyPort!==undefined&&(!Number.isInteger(legacyPort)||legacyPort<1||legacyPort>65535||legacyPort===port))throw new Error('이전 메신저 연결 포트를 확인해 주세요.');
  const redirectServer=legacyPort===undefined?null:createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
    if(req.url==='/api/health'){const value=JSON.stringify({service:'synk-workspace-redirect',version:1});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:value);return;}
    res.writeHead(302,{'Location':origin+'/?tab=messenger','Cache-Control':'no-store'});res.end();
  });
  const collector=options.collector??collectChannel;
  const inflight=new Set();let queue=Promise.resolve();let timer;
  let ready=false,startTask=null,shutdownTask=null,stopRequested=false;
  const failedLogins=new Map();
  const clock=()=>options.clock?.()||now();
  const content=createContentService({store,clock,fetchImpl:options.contentFetch,isConnected:hasConnection});
  const dailyTrends=createDailyTrendsService({store,clock,collector:options.dailyTrendsCollector,fetchImpl:options.dailyTrendsFetch});
  const creativeResearch=createCreativeResearchService({store,clock,fetchImpl:options.creativeResearchFetch});
  const creatorReviews=createCreatorReviewsService({store,clock});
  const creatorSources=createCreatorSourcesService({store});
  const studio=createStudioService({store,clock});
  const crewProfiles=createCrewProfileService({store,clock});
  const demo=createDemoService({directory:options.demoDataDir??join(store.directory,'demo')});
  const assistant=createAssistantService({today:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock())),performance:assistantPerformance,directory:(req,query)=>messenger.assistantDirectory(req,query)});
  const migrationAt=clock();
  store.transaction(()=>{for(const c of store.all('channels'))seedOwnership(store,c,migrationAt);});
  for(const run of store.all('runs').filter(x=>['queued','running'].includes(x.status)))store.put('runs',run.id,{...run,status:'interrupted',finishedAt:now(),message:'서버가 다시 시작됐습니다. 수집을 다시 실행해 주세요.'});
  for(const channel of store.all('channels').filter(x=>x.status==='collecting'))store.put('channels',channel.id,{...channel,...planFailure({code:'COLLECTION_INTERRUPTED',retryable:true},channel,clock()),status:'error',lastError:'서버 재시작으로 수집이 중단되어 자동 재시도를 예약했습니다.'});
  for(const channel of store.all('channels').filter(x=>x.recentStatus==='collecting'))store.put('channels',channel.id,{...channel,...recentFields(planFailure({code:'COLLECTION_INTERRUPTED',retryable:true},recentPolicyChannel(channel),clock())),recentStatus:'error',recentLastError:'최근 게시물 수집이 중단되어 재시도를 예약했습니다.'});
  function pending(c){const h=c.pendingHandoffId&&store.get('handoffs',c.pendingHandoffId);return h?.status==='awaiting-connection'?h:null;}
  function incoming(user,c){return !!pending(c)?.toOwnerIds.includes(user.id);}
  function visibleChannels(user) {return store.all('channels').filter(c=>canReadChannel(user,c)||incoming(user,c));}
  function channelFor(user,id,mode='read') {const c=store.get('channels',id);const allowed=c&&(mode==='write'?canWriteChannel(user,c):mode==='connect'?(user.role!=='viewer'&&(canWriteChannel(user,c)||incoming(user,c))):canReadChannel(user,c)||incoming(user,c));if(!allowed)throw httpError('담당 채널을 찾을 수 없습니다.',404);return c;}
  function admin(user) {if(user.role!=='admin')throw httpError('관리자만 변경할 수 있습니다.',403);}
  function audit(user,action,subject,details={}) {const id=randomUUID();store.put('audit',id,{id,userId:user.id,action,subject,...details,at:clock()});}
  function teamFor(id){if(!id)return null;const team=store.get('teams',id);if(!team?.active)throw httpError('활성 팀을 선택해 주세요.');return team;}
  function permissions(user){return {manageOrganization:user.role==='admin',manageTeam:['admin','manager'].includes(user.role),readOnly:user.role==='viewer'};}
  function connection(c) {return store.secret('channel:'+c.id);}
  function providerConfig(platform) {return {...store.secret('provider:'+platform),redirectUri:origin+`/api/oauth/${platform}/callback`};}
  function hasConnection(c) {return !c.collectionDisabled&&(!!connection(c)?.accessToken||(c.platform==='youtube'&&!!(connection(c)?.apiKey||providerConfig(c.platform).apiKey)));}
  function disconnectChannel(c){store.transaction(()=>{const handoff=pending(c);if(handoff)store.put('handoffs',handoff.id,{...handoff,status:'cancelled',cancelledAt:clock(),reasonClosed:'connection-disconnected'});store.deleteSecret('channel:'+c.id);const ids=new Set(store.all('posts').filter(p=>p.channelId===c.id).map(p=>p.id));for(const kind of ['snapshots','channelSnapshots','posts','hypeObservations'])for(const row of store.all(kind))if(row.source?.startsWith('api:')&&(row.channelId===c.id||ids.has(row.postId)))store.remove(kind,row.id);store.put('channels',c.id,{...c,pendingHandoffId:null,status:'not-connected',lastCollectedAt:null,recentStatus:'not-connected',recentLastCollectedAt:null,collectionDisabled:true,connectionVersion:(c.connectionVersion||0)+1});});}
  function namedUsers(ids){return ids.map(id=>({id,name:store.get('users',id)?.name||'이전 담당자'}));}
  function safeChannel(c,user) {const connectedBy=connection(c)?.connectedBy;return {...c,owners:namedUsers(c.ownerIds),teamName:(c.teamId&&store.get('teams',c.teamId)?.name)||'팀 미지정',connected:hasConnection(c),canEdit:user?canWriteChannel(user,c):false,canManageOwners:user?canManageOwners(user,c):false,canConnect:user?user.role!=='viewer'&&(canWriteChannel(user,c)||incoming(user,c)):false,connectionOwner:connectedBy?namedUsers([connectedBy])[0]:null,pendingHandoff:pending(c)};}
  function scopeTeamId(user,query){return query.get('teamId')||(query.get('scope')==='team'?user.teamId:null)||null;}
  function scopedChannels(user,query){
    let channels=visibleChannels(user);const scope=query.get('scope'),teamId=scopeTeamId(user,query);
    if(scope==='team'&&(!teamId||!store.get('teams',teamId)?.active))return [];
    if(teamId)channels=channels.filter(c=>c.teamId===teamId);
    if(scope==='mine')channels=channels.filter(c=>c.ownerIds.includes(user.id));
    return channels;
  }
  function completeHandoff(c,actor){const h=pending(c);if(!h)return c;const updated={...c,ownerIds:h.toOwnerIds,teamId:h.toTeamId||null,pendingHandoffId:null,connectionVersion:(c.connectionVersion||0)+1};recordOwnershipChange(store,c,updated,{actorId:actor.id,at:clock(),reason:h.reason||'담당자 인계'});store.put('channels',c.id,updated);store.put('handoffs',h.id,{...h,status:'completed',completedAt:clock(),completedBy:actor.id});return updated;}
  function changeOwners(user,c,input){
    if(!canManageOwners(user,c))throw httpError('관리자 또는 이 채널의 팀장만 담당자를 배정할 수 있습니다.',403);
    if(!Array.isArray(input.userIds)||!input.userIds.length||input.userIds.length>100)throw httpError('담당자를 한 명 이상 선택해 주세요.');
    const ids=[...new Set(input.userIds)],people=ids.map(id=>store.get('users',id));
    if(people.some(u=>!u?.active||u.role==='viewer'))throw httpError('활성 관리자·팀장·담당자를 선택해 주세요.');
    if(user.role==='manager'&&people.some(u=>u.teamId!==user.teamId))throw httpError('같은 팀의 담당자만 배정할 수 있습니다.',403);
    if(user.role!=='admin'&&input.teamId!==undefined&&input.teamId!==(c.teamId||null))throw httpError('소속 팀은 관리자만 변경할 수 있습니다.',403);
    const teamId=input.teamId===undefined?(c.teamId||null):(input.teamId||null);teamFor(teamId);
    if(pending(c))throw httpError('진행 중인 인계를 완료하거나 취소한 뒤 다시 배정해 주세요.',409);
    if(teamId===(c.teamId||null)&&ids.length===c.ownerIds.length&&ids.every(id=>c.ownerIds.includes(id)))return {ok:true,requiresReconnect:false};
    const reason=text(input.reason,300)||'담당자 배정';const creds=connection(c);
    if(creds?.accessToken&&creds.connectedBy&&!ids.includes(creds.connectedBy)){
      const h={id:randomUUID(),channelId:c.id,fromOwnerIds:c.ownerIds,fromTeamId:c.teamId||null,toOwnerIds:ids,toTeamId:teamId,requestedBy:user.id,requestedAt:clock(),reason,status:'awaiting-connection'};
      store.transaction(()=>{store.put('handoffs',h.id,h);store.put('channels',c.id,{...c,pendingHandoffId:h.id});audit(user,'handoff-requested',c.id,{handoffId:h.id});});
      return {ok:true,requiresReconnect:true,handoff:h,message:'기존 담당과 기록을 유지했습니다. 새 담당자가 계정 연결을 완료하면 인계가 확정됩니다.'};
    }
    store.transaction(()=>{const updated={...c,ownerIds:ids,teamId,status:c.status==='collecting'?(hasConnection(c)?'ready':'not-connected'):c.status,lastAttemptAt:c.status==='collecting'?null:c.lastAttemptAt,connectionVersion:(c.connectionVersion||0)+1};recordOwnershipChange(store,c,updated,{actorId:user.id,at:clock(),reason});store.put('channels',c.id,updated);audit(user,'owners',c.id,{beforeOwnerIds:c.ownerIds,afterOwnerIds:ids,beforeTeamId:c.teamId||null,afterTeamId:teamId});});
    return {ok:true,requiresReconnect:false};
  }
  function providerStates(){return providers(Object.fromEntries(['youtube','instagram','facebook','tiktok'].map(p=>[p,providerConfig(p)]))).map(p=>({...p,label:p.label||p.name,redirectUri:origin+`/api/oauth/${p.id}/callback`,publicApiConfigured:p.id==='youtube'&&!!providerConfig(p.id).apiKey}));}
  function rawSession(req){const raw=/\bsynk_company_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];const row=store.readToken(raw,'session');if(!row)return null;const user=store.get('users',row.userId);return user?.active?{...row,user,raw}:null;}
  function session(req){const row=rawSession(req);return row&&synkIdentity.sessionAllowed(row)?row:null;}
  function setSession(res,user,extra={}){const csrfToken=token(),value=store.mint('session',user.id,{csrfToken,...extra},7*24*60),prior=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(prior?Array.isArray(prior)?prior:[prior]:[]),`synk_company_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${originUrl.protocol==='https:'?'; Secure':''}`]);return {user:publicUser(user),csrfToken,...(extra.synkIdentity?{sessionHash:hash(value)}:{})};}
  function purgeExpired(at=clock()){store.transaction(()=>{for(const kind of ['snapshots','channelSnapshots','posts','hypeObservations'])for(const row of store.all(kind))if((row.expiresAt&&Date.parse(row.expiresAt)<=Date.parse(at))||(kind==='hypeObservations'&&(!Number.isFinite(Date.parse(row.checkedAt))||Date.parse(row.checkedAt)<=Date.parse(at)-HYPE_RETENTION_MS)))store.remove(kind,row.id);const postIds=new Set(store.all('posts').map(p=>p.id));for(const row of store.all('hypeObservations'))if(!postIds.has(row.postId))store.remove('hypeObservations',row.id);});}
  function records(channels,{readOnly=false}={}){if(!readOnly)purgeExpired();const at=Date.parse(clock()),retained=row=>!(row.expiresAt&&Date.parse(row.expiresAt)<=at);const ids=new Set(channels.map(c=>c.id));const posts=store.all('posts').filter(p=>ids.has(p.channelId)&&retained(p));const postIds=new Set(posts.map(p=>p.id));return{version:1,posts,snapshots:store.all('snapshots').filter(s=>postIds.has(s.postId)&&retained(s)),channelSnapshots:store.all('channelSnapshots').filter(s=>ids.has(s.channelId)&&retained(s))};}
  function assistantPerformance(user,{scope,asOf}){
    const {catalog,data}=reportSource(user,new URLSearchParams({scope}),asOf,{readOnly:true});
    const team=typeof user.teamId==='string'&&user.teamId?store.get('teams',user.teamId):null;
    return {channelCount:catalog.channels.length,teamName:team?.active?team.name:null,growth:buildGrowthSummary(data,catalog,{asOf})};
  }
  function teamOverview(user,query){
    const end=query.get('end')||today(),start=query.get('start')||shiftDate(end,-29);
    dateRange(start,end);if(end>today())throw httpError('오늘 이후 날짜는 조회할 수 없습니다.');
    const teams=store.all('teams').filter(team=>team.active&&(user.role==='admin'||team.id===user.teamId));
    const groups=new Map(teams.map(team=>[team.id,{id:team.id,name:team.name,memberCount:0,channels:[],posts:[]} ]));
    if(!groups.size)return {start,end,teams:[]};
    for(const member of visibleMembers(store,user))if(member.active&&groups.has(member.teamId))groups.get(member.teamId).memberCount++;
    const channels=visibleChannels(user).filter(channel=>groups.has(channel.teamId));
    const channelTeams=new Map(channels.map(channel=>[channel.id,channel.teamId]));
    for(const channel of channels)groups.get(channel.teamId).channels.push(channel);
    // Read each record collection once. Expired records are omitted without a write on this GET.
    const at=Date.parse(clock()),retained=row=>!(row.expiresAt&&Date.parse(row.expiresAt)<=at);
    const posts=store.all('posts').filter(post=>channelTeams.has(post.channelId)&&post.publishedDate<=end&&retained(post));
    const postIds=new Set(posts.map(post=>post.id));
    for(const post of posts)groups.get(channelTeams.get(post.channelId)).posts.push(post);
    const postIndex=metricIndex(store.all('snapshots').filter(row=>postIds.has(row.postId)&&retained(row)),'postId');
    const accountIndex=metricIndex(store.all('channelSnapshots').filter(row=>channelTeams.has(row.channelId)&&retained(row)),'channelId');
    const dayBase=shiftDate(end,-1),periodBase=shiftDate(start,-1);
    return {start,end,teams:[...groups.values()].map(group=>{
      const metrics=Object.fromEntries(METRICS.map(({key})=>{
        const src=key==='followers'?{entities:group.channels,index:accountIndex,isPost:false}:{entities:group.posts,index:postIndex,isPost:true};
        return [key,{...metricPoint(src,key,end),day:compareMetric(src,key,dayBase,end),period:compareMetric(src,key,periodBase,end)}];
      }));
      return {id:group.id,name:group.name,memberCount:group.memberCount,channelCount:group.channels.length,
        connectedCount:group.channels.filter(channel=>channel.active!==false&&hasConnection(channel)).length,
        postCount:group.posts.length,newPosts:group.posts.filter(post=>post.publishedDate>=start).length,metrics};
    })};
  }
  function reportSource(user,query,end,{readOnly=false}={}){
    const all=scopedChannels(user,query);const ownerId=['admin','manager'].includes(user.role)?query.get('ownerId'):null;
    const candidates=all.filter(c=>(!query.get('platform')||c.platform===query.get('platform'))&&(!query.get('channel')||c.id===query.get('channel')));
    const events=store.all('ownershipEvents'),raw=records(candidates,{readOnly});
    const selected=ownerId?recordsForOwner(raw,candidates,events,ownerId,end):{records:raw,channels:candidates};
    const channels=selected.channels;
    const catalog={channels:channels.map(c=>({...c,ready:true,brand:c.displayName,handle:c.handle||'',publicUrl:c.canonicalUrl,country:''}))};
    return {all,ownerId,events,channels,catalog,data:selected.records};
  }
  function contentLeaders(user,query){
    const date=query.get('date')||query.get('end')||today();dateRange(date,date);if(date>today())throw httpError('오늘 이후 날짜는 조회할 수 없습니다.');
    const {data,catalog,events}=reportSource(user,query,date);
    return buildContentLeaders(data,catalog,{date,metric:query.get('metric')||'views',mode:query.get('mode')||'change',users:visibleMembers(store,user),ownershipEvents:events});
  }
  function report(user,query,day=false){
    const end=query.get('date')||query.get('end')||today();const start=day?end:query.get('start')||shiftDate(end,-29);
    dateRange(start,end);if(end>today())throw httpError('오늘 이후 날짜는 조회할 수 없습니다.');
    const {all,ownerId,events,catalog,data}=reportSource(user,query,end),result=analyze(data,catalog,{start,end});
    if(query.get('growth')==='1')result.growth=buildGrowthSummary(data,catalog,{asOf:end});
    if(query.get('history')==='1')result.history=buildGrowthHistory(data,catalog,{asOf:end,selectionStart:query.get('historyStart')||undefined,selectionEnd:query.get('historyEnd')||undefined});
    const groups=result.groups('channel');
    const users=visibleMembers(store,user);
    const memberGroups=users.map(u=>{const mine=recordsForOwner(data,catalog.channels,events,u.id,end);const item=analyze(mine.records,{channels:mine.channels},{start,end});return {id:u.id,name:u.name,active:u.active,teamId:u.teamId,channelCount:mine.channels.length,metrics:item.metrics};});
    const overviewCatalog={channels:all.map(c=>({...c,ready:true,brand:c.displayName,publicUrl:c.canonicalUrl}))};
    return {...result,groups,memberGroups,memberGroupsBasis:'수집 당시 담당자 기록입니다. 이전 담당을 확인할 수 없는 기록과 담당 변경 경계의 비교 불가 수치는 크루별 증가량에 넣지 않습니다. 공동 담당은 중복될 수 있습니다.',overview:companyOverview(records(all),overviewCatalog,end),_csv:()=>analyticsCsv(result),scope:{...result.scope,ownerId:ownerId||'',teamId:scopeTeamId(user,query)||'',scope:query.get('scope')||'all'},definitions:{basis:'수집 시점의 누적값 차이',missing:'—는 미확인 또는 제공되지 않는 지표입니다.',history:'등록 전 날짜별 실적은 누적값으로 복원하지 않습니다.',members:'관측 당시 담당자에 귀속하며 공동 담당은 크루별 합계에 중복될 수 있습니다. 회사 합계는 채널을 한 번만 셉니다.'}};
  }
  function saveCollection(channel,result,runId,withinTransaction=false,mode='full'){
    const live=store.get('channels',channel.id);
    if(!live?.active||(live.connectionVersion||0)!==(channel.connectionVersion||0))throw httpError('채널 연결이 변경되어 이번 수집 결과를 저장하지 않았습니다.');
    const externalId=result.channel.externalId||channel.externalId;
    const duplicate=store.all('channels').find(c=>c.id!==channel.id&&c.platform===channel.platform&&externalId&&c.externalId===externalId);
    if(duplicate)throw httpError('같은 계정이 다른 주소로 이미 등록되어 있습니다. 기존 채널의 담당자를 추가해 주세요.');
    const stamp=clock(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp));
    const validPosts=result.posts.filter(p=>{try{return !!p.externalId&&!!p.publishedAt&&!Number.isNaN(Date.parse(p.publishedAt))&&new URL(p.url).protocol==='https:';}catch{return false;}});
    if(validPosts.length!==result.posts.length){
      const omitted=result.posts.length-validPosts.length;
      result={...result,posts:validPosts,coverage:{...result.coverage,status:'partial',omittedPosts:(result.coverage?.omittedPosts||0)+omitted},warnings:[...(result.warnings||[]),`주소 또는 게시일이 제공되지 않은 콘텐츠 ${omitted}개는 집계에서 제외했습니다.`]};
    }
    // Renew retention only for data confirmed in this collection. Expired grants do not extend old data.
    const expiresAt=channel.platform==='youtube'?new Date(Date.parse(stamp)+30*86400000).toISOString():null;
    const write=()=>{
      const complete=result.coverage?.status==='complete';
      const successState={status:complete?'success':'partial',lastCollectedAt:stamp,lastSuccessAt:complete?stamp:live.lastSuccessAt,lastError:null,failureKind:null,failureCode:null,lastFailureAt:null,retryCount:0,nextRetryAt:null,requiresReconnect:false,coverage:result.coverage,warnings:result.warnings||[]};
      const recentState=recentFields({...successState,lastSuccessAt:complete?stamp:live.recentLastSuccessAt});
      if(result.coverage?.collectionError)Object.assign(recentState,recentFields(planFailure(result.coverage.collectionError,recentPolicyChannel(live),stamp)),{recentStatus:'error',recentLastError:'일부 지표의 조회 권한 또는 호출 한도를 확인하고 재시도 일정을 따릅니다.'});
      store.put('channels',channel.id,{...live,externalId,displayName:result.channel.displayName||live.displayName,...(mode==='full'?successState:{}),...recentState});
      const ownership=ownerAt(store.all('ownershipEvents'),live,stamp);
      const channelSnapshot={id:`${channel.id}:${date}`,channelId:channel.id,date,followers:count(result.channel.followers),views:count(result.channel.views),checkedAt:stamp,source:`api:${channel.platform}`,expiresAt,ownership};
      if(mode==='full')store.put('channelSnapshots',channelSnapshot.id,channelSnapshot);
      for(const p of result.posts){
        if(!p.externalId||!p.publishedAt||Number.isNaN(Date.parse(p.publishedAt)))continue;
        const id=`${channel.id}:${p.externalId}`,previous=store.get('posts',id);
        const publishedDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.publishedAt));
        const link=new URL(p.url);if(link.protocol!=='https:')continue;
        store.put('posts',id,{...previous,id,channelId:channel.id,externalId:p.externalId,title:text(p.title,1000)||'제목 없음',url:link.href,publishedDate,publishedAt:p.publishedAt,thumbnailUrl:p.thumbnailUrl||null,source:`api:${channel.platform}`,expiresAt});
        const snapshot={id:`${id}:${date}`,postId:id,date,checkedAt:stamp,source:`api:${channel.platform}`,expiresAt,ownership};
        for(const key of metricKeys)snapshot[key]=count(p.metrics?.[key]);
        if(mode==='full')store.put('snapshots',snapshot.id,snapshot);
        if(Date.parse(p.publishedAt)>=Date.parse(stamp)-HYPE_RECENT_MS&&Date.parse(p.publishedAt)<=Date.parse(stamp)){
          const observation={...snapshot,id:`${id}:${stamp}`,channelId:channel.id,metricPeriods:result.coverage?.metricPeriods||{},expiresAt:new Date(Math.min(Date.parse(stamp)+HYPE_RETENTION_MS,expiresAt?Date.parse(expiresAt):Infinity)).toISOString()};
          store.put('hypeObservations',observation.id,observation);
        }
        if(mode==='full'&&channel.platform==='youtube'&&result.coverage?.ownerAuthorized){for(const old of store.all('snapshots').filter(s=>s.postId===id&&s.source==='api:youtube'))store.put('snapshots',old.id,{...old,expiresAt});}
      }
      if(mode==='full'&&channel.platform==='youtube'&&result.coverage?.ownerAuthorized)for(const old of store.all('channelSnapshots').filter(s=>s.channelId===channel.id&&s.source==='api:youtube'))store.put('channelSnapshots',old.id,{...old,expiresAt});
      const run=store.get('runs',runId);store.put('runs',runId,{...run,status:complete?'success':'partial',finishedAt:stamp,message:result.warnings?.join(' · ')||`${result.posts.length}개 콘텐츠 확인`,postCount:result.posts.length,coverage:result.coverage});
    };
    return withinTransaction?write():store.transaction(write);
  }
  async function credentialsFor(c){const provider=providerConfig(c.platform);let credentials=connection(c)||{};
    if(credentials.accessToken){
      credentials={...credentials,...await refreshCredentials(c.platform,credentials,provider)};
      const live=store.get('channels',c.id);
      if(!live?.active||live.collectionDisabled||(live.connectionVersion||0)!==(c.connectionVersion||0)||
        (credentials.connectedBy&&!store.get('users',credentials.connectedBy)?.active))throw httpError('채널 연결이 변경되어 갱신된 연결 정보를 저장하지 않았습니다.');
      store.setSecret('channel:'+c.id,credentials);
    }
    return {...provider,...credentials};
  }
  function enqueueCollection(user,c,{mode='full'}={}){
    if(!c.active)throw httpError('보관된 채널은 수집하지 않습니다.');
    if(inflight.has(c.id))return {channelId:c.id,status:'already-running'};
    if(!hasConnection(c))throw httpError('먼저 계정을 연결해 주세요. 관리자의 플랫폼 앱 설정이 필요할 수 있습니다.');
    const id=randomUUID(),startedAt=clock();inflight.add(c.id);
    store.put('runs',id,{id,channelId:c.id,channelName:c.displayName,status:'queued',startedAt,requestedBy:user.id,mode,message:mode==='recent'?'최근 7일 게시물 수집 대기':'전체 게시물 수집 대기',connectionVersion:c.connectionVersion||0});
    store.put('channels',c.id,{...c,...(mode==='recent'?{recentStatus:'collecting',recentLastAttemptAt:startedAt}:{status:'collecting',lastAttemptAt:startedAt})});
    queue=queue.then(async()=>{try{
      const live=store.get('channels',c.id);if(!live?.active)throw httpError('수집 전에 채널이 보관됐습니다.');if(!hasConnection(live))throw httpError('수집 전에 채널 연결이 해제됐습니다.');if((live.connectionVersion||0)!==(c.connectionVersion||0))throw httpError('수집 전에 담당자 또는 연결이 변경됐습니다.');
      store.put('runs',id,{...store.get('runs',id),status:'running'});
      const at=clock(),result=await collector(live,await credentialsFor(live),mode==='recent'?{recentSince:new Date(Date.parse(at)-HYPE_RECENT_MS).toISOString(),now:at}:undefined);saveCollection(live,result,id,false,mode);
    }catch(error){const live=store.get('channels',c.id);const failure=planFailure(error,mode==='recent'?recentPolicyChannel(live||c):(live||c),clock());if(live&&!live.collectionDisabled&&(live.connectionVersion||0)===(c.connectionVersion||0))store.put('channels',c.id,{...live,...(mode==='recent'?{...recentFields(failure),recentStatus:'error',recentLastError:safeError(error.message)}:{...failure,status:'error',lastError:safeError(error.message)})});store.put('runs',id,{...store.get('runs',id),...failure,status:'error',finishedAt:clock(),message:safeError(error.message)});
    }finally{inflight.delete(c.id);const latest=store.get('channels',c.id);if(mode==='recent'&&latest?.recentStatus==='collecting'&&(latest.connectionVersion||0)!==(c.connectionVersion||0))store.put('channels',c.id,{...latest,recentStatus:hasConnection(latest)?'ready':'not-connected',recentLastAttemptAt:null});}});
    return{id,channelId:c.id,status:'queued'};
  }
  async function scheduledTick(at=clock()){
    if(stopRequested)return;
    purgeExpired(at);const system=store.all('users').find(u=>u.role==='admin'&&u.active);if(!system)return;
    if(options.schedule!==false||options.dailyTrendsCollector||options.dailyTrendsFetch)dailyTrends.tick(at).catch(()=>{});
    const settings=store.get('settings','company');if(!settings.enabled)return;
    for(const c of store.all('channels')){
      const policy={at,enabled:settings.enabled,hourKst:settings.hourKst,connected:hasConnection(c)};
      try{
        if(c.recentFailureKind&&!c.failureKind){if(shouldCollectRecent(c,policy))enqueueCollection(system,c,{mode:'recent'});continue;}
        if(shouldCollect(c,policy))enqueueCollection(system,c);
        else if(shouldCollectRecent(c,policy))enqueueCollection(system,c,{mode:'recent'});
      }catch{}
    }
  }
  function hypeFeed(user,query){
    const at=clock();purgeExpired(at);
    const channels=scopedChannels(user,query).filter(c=>c.active!==false),ids=new Set(channels.map(c=>c.id));
    const posts=store.all('posts').filter(p=>ids.has(p.channelId)),postIds=new Set(posts.map(p=>p.id));
    const observations=store.all('hypeObservations').filter(o=>ids.has(o.channelId)&&postIds.has(o.postId));
    const settings=store.get('settings','company'),safe=channels.map(c=>({...c,connected:hasConnection(c)}));
    const connected=safe.filter(c=>c.connected),busy=connected.filter(c=>inflight.has(c.id));
    const backoffs=connected.flatMap(c=>{const failure=c.recentFailureKind?recentPolicyChannel(c):c;return failure.failureKind?[{channelId:c.id,kind:failure.failureKind,code:failure.failureCode||null,nextRetryAt:failure.nextRetryAt||null,requiresReconnect:failure.requiresReconnect===true}]:[];});
    const next=connected.flatMap(c=>{const due=recentNextCheckAt(c,{at,enabled:settings.enabled,hourKst:settings.hourKst,connected:true});return due?[due]:settings.enabled&&c.nextRetryAt&&!c.requiresReconnect?[new Date(Math.max(Date.parse(at),Date.parse(c.nextRetryAt))).toISOString()]:[];});
    const checked=connected.map(c=>c.recentLastCollectedAt||c.lastCollectedAt).filter(x=>x&&Number.isFinite(Date.parse(x))&&Date.parse(x)<=Date.parse(at));
    return {...buildHypeFeed({channels:safe,posts,observations,users:visibleMembers(store,user),now:at}),collection:{intervalMinutes:RECENT_INTERVAL_MINUTES,activeChannels:channels.length,connectedChannels:connected.length,waitingChannels:connected.filter(c=>!c.recentLastCollectedAt&&!c.lastCollectedAt).length,collectingChannels:busy.length,partialChannels:connected.filter(c=>c.recentCoverage?.status==='partial').length,backoffChannels:backoffs.length,failedChannels:backoffs.filter(x=>!x.nextRetryAt).length,nextCheckAt:next.length?next.sort()[0]:null,lastCheckedAt:checked.length?checked.sort().at(-1):null,enabled:settings.enabled===true,backoffs}};
  }
  async function importLegacy(user){admin(user);const map=JSON.parse(await readFile(join(here,'../../dashboard/src/data.json'),'utf8'));
    let legacy={posts:[],snapshots:[],channelSnapshots:[]};try{legacy=JSON.parse(await readFile(join(here,'../data/records.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    return store.transaction(()=>{const mappings=new Map(),added=[],skipped=[];
      for(const row of map.queries.channels.rows){if(!((row.channelScope==='기존 운영'&&row.publishable)||row.channelScope==='확장 확보'))continue;
        try{const parsed=normalizeChannelUrl(row.publicUrl);let c=store.all('channels').find(x=>x.canonicalUrl===parsed.canonicalUrl);if(!c){const id=randomUUID();c={...parsed,id,displayName:[row.brand,row.country,row.handle].filter(Boolean).join(' · '),ownerIds:[user.id],active:true,status:'not-connected',createdAt:clock(),teamId:user.teamId||null,legacyId:row.id};store.put('channels',id,c);seedOwnership(store,c,clock());added.push(id);}mappings.set(row.id,c.id);
        }catch{skipped.push({id:row.id,url:row.publicUrl,reason:'지원하는 채널 주소 형식이 아니므로 기존 기록장에 보존했습니다.'});}}
      for(const p of legacy.posts){const channelId=mappings.get(p.channelId);if(!channelId)continue;const id='legacy:'+p.id;store.put('posts',id,{...p,id,channelId,source:'manual-import'});}
      for(const s of legacy.snapshots){const postId='legacy:'+s.postId;if(!store.get('posts',postId))continue;const id=`${postId}:${s.date}`;store.put('snapshots',id,{...s,id,postId,source:'manual-import'});}
      for(const s of legacy.channelSnapshots){const channelId=mappings.get(s.channelId);if(!channelId)continue;const id=`${channelId}:${s.date}`;store.put('channelSnapshots',id,{...s,id,channelId,source:'manual-import'});}
      audit(user,'import-legacy',`${added.length} channels`);return {added:added.length,skipped};});
  }
  const respondStatic=createStaticResponder();
  function responseHeaders(type){return{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};}
  function send(res,status,body,type='application/json; charset=utf-8'){messenger.disconnectRevoked();res.writeHead(status,responseHeaders(type));res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
  async function body(req){
    if(!req.headers['content-type']?.startsWith('application/json'))throw httpError('JSON 입력이 필요합니다.');
    const chunks=[];let bytes=0;
    for await(const part of req.iterator({destroyOnReturn:false})){bytes+=part.length;if(bytes>768000){req.resume();throw httpError('입력이 너무 큽니다. 내용이나 항목 수를 줄여 주세요.',413);}chunks.push(part);}
    let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw httpError('UTF-8 JSON 입력을 확인해 주세요.');}
    if(raw.length>256000)throw httpError('입력이 너무 큽니다. 내용이나 항목 수를 줄여 주세요.',413);
    try{return JSON.parse(raw);}catch{throw httpError('입력 형식을 확인해 주세요.');}
  }
  const server=createServer(async(req,res)=>{try{
    if(req.headers.host!==originUrl.host&&!(options.allowTestHost&&req.headers.host?.startsWith('127.0.0.1:')))throw httpError('등록된 회사 주소로 접속해 주세요.',403);
    const url=new URL(req.url,origin),path=url.pathname,method=req.method;
    const demoRequest=path==='/api/demo'||path.startsWith('/api/demo/')||req.headers['x-synk-demo']==='1'||url.searchParams.get('demo')==='1';
    if(demoRequest&&!['GET','HEAD'].includes(method)&&path!=='/api/logout')throw httpError('데모 화면에서는 조회만 가능합니다. 실제 화면으로 돌아가 변경해 주세요.',403);
    const identityControl=['/api/logout','/api/synk-id/renew','/api/synk-id/status'].includes(path);
    if(!identityControl&&(path.startsWith('/api/')||path.startsWith('/messenger/api/'))){const current=rawSession(req);if(current)await synkIdentity.validateSession(current);}
    if(method==='GET'&&path==='/api/synk-id/callback'){
      try{await synkIdentity.callback(req,res,url,()=>session(req),setSession);res.writeHead(302,{Location:'/?tab=messenger&synkConnected=1','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();}
      catch(error){res.writeHead(302,{Location:'/?tab=messenger&synkError='+encodeURIComponent(error.code||'SYNK_LOGIN_FAILED'),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();}
    }
    if(path==='/messenger'){if(!['GET','HEAD'].includes(method))throw httpError('메신저 주소를 확인해 주세요.',405);res.writeHead(302,{Location:'/messenger/'});return res.end();}
    if(path.startsWith('/messenger/'))return await messenger.handler(req,res);
    if(method==='GET'&&path==='/api/health')return send(res,200,{ok:true,app:'synk-company',version:1,workspaceIntegration:true,ready});
    let auth=identityControl?rawSession(req):session(req),user=auth?.user;
    if(method==='GET'&&path==='/api/synk-id/status')return send(res,200,synkIdentity.status(auth));
    if(method==='GET'&&path==='/api/me')return send(res,200,{user:publicUser(user),csrfToken:auth?.body.csrfToken,needsSetup:store.all('users').length===0,platformUrl});
    if(method==='POST'&&['/api/synk-id/challenge','/api/synk-id/start','/api/synk-id/exchange','/api/synk-id/renew'].includes(path)){
      const input=await body(req);auth=identityControl?rawSession(req):session(req);
      if(path.endsWith('/challenge'))return send(res,200,synkIdentity.challenge(req,res,input,auth));
      if(path.endsWith('/start'))return send(res,200,synkIdentity.start(req,res,input,auth));
      if(path.endsWith('/exchange'))return send(res,200,await synkIdentity.exchange(req,res,input,()=>session(req),setSession));
      return send(res,200,await synkIdentity.renew(req,input,()=>rawSession(req)));
    }
    if(method==='POST'){
      if(req.headers.origin!==origin)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      const unauth=['/api/setup','/api/login','/api/join','/api/launch'];
      if(!unauth.includes(path)&&(!auth||req.headers['x-csrf-token']!==auth.body.csrfToken))throw httpError('로그인 상태를 다시 확인해 주세요.',403);
      const studioUpload=path.match(/^\/api\/studio-productions\/([^/]+)\/media$/);
      if(studioUpload){
        const originalHash=auth.hash;let upload;
        try{
          studio.assertEditable(user,studioUpload[1]);
          upload=await receiveStudioMedia(req,store.directory);
          let latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
          studio.assertEditable(latest.user,studioUpload[1]);
          await commitStudioMedia(upload,store.directory);
          latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
          const result=studio.addMedia(latest.user,studioUpload[1],upload.metadata,upload.label);
          upload=null;audit(latest.user,'studio-media-uploaded',studioUpload[1]);return send(res,201,result);
        }catch(error){await discardStudioMedia(upload,store.directory);throw error;}
      }
      const input=await body(req);
      // Receiving a request body yields control. Revalidate revoked sessions and current roles afterward.
      if(!unauth.includes(path)){auth=identityControl?rawSession(req):session(req);user=auth?.user;if(!user||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('로그인 상태를 다시 확인해 주세요.',401);}
      if(path==='/api/daily-trends/settings'){admin(user);const result=dailyTrends.configure(input);audit(user,'daily-trends-settings','daily-trends',{settings:result.settings});return send(res,200,result);}
      if(path==='/api/daily-trends/collect'){
        admin(user);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='force')||input.force!==undefined&&typeof input.force!=='boolean')throw httpError('다시 수집 여부를 확인해 주세요.');
        if(stopRequested)throw httpError('서버가 종료 중입니다.',503);
        const alreadyRunning=dailyTrends.state().running;
        const result=await dailyTrends.collect({force:input.force??false,requestedBy:user.id});
        audit(user,'daily-trends-collect','daily-trends',{force:input.force??false,alreadyRunning});return send(res,200,result);
      }
      if(path==='/api/setup'){if(store.all('users').length)throw httpError('이미 회사가 설정되어 있습니다.',409);passwordHash(input.password);if(!store.consume(input.setupToken,'setup'))throw httpError('관리자 시작 링크를 다시 열어 주세요.',403);const u=store.createUser({...input,role:'admin'});store.put('settings','company',{...store.get('settings','company'),companyName:text(input.companyName,80)||'SYNK'});return send(res,201,setSession(res,u));}
      if(path==='/api/launch'){const t=store.consume(input.token,'launch');const u=t&&store.get('users',t.userId);if(!u?.active||!isLocalHost(host))throw httpError('시작 링크가 만료됐습니다. 바탕화면 바로가기를 다시 열어 주세요.',403);return send(res,200,setSession(res,u));}
      if(path==='/api/login'){
        const email=text(input.email??input.username,254).toLowerCase(),key=req.socket.remoteAddress+':'+email;const attempts=failedLogins.get(key)||{count:0,since:Date.now()};
        if(Date.now()-attempts.since>15*60000){attempts.count=0;attempts.since=Date.now();}if(attempts.count>=8)throw httpError('로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.',429);
        let u=store.all('users').find(u=>u.email===email);let valid=passwordMatches(input.password,u?.passwordHash);
        if(!u){const linkedId=await messenger.authenticateLinkedUsername(email,input.password);const linked=linkedId&&store.get('users',linkedId);if(linked?.active&&!linked.passwordHash){u=linked;valid=true;}}
        if(!u?.active||!valid){attempts.count++;failedLogins.set(key,attempts);throw httpError('이메일 또는 기존 메신저 아이디와 비밀번호를 확인해 주세요.',401);}failedLogins.delete(key);return send(res,200,setSession(res,u));
      }
      if(path==='/api/join'){
        const invitation=store.readToken(input.token,'invite');if(!invitation)throw httpError('초대 링크가 만료됐거나 이미 사용됐습니다.',403);
        const checkedHash=passwordHash(input.password);const result=store.transaction(()=>{const inv=store.readToken(input.token,'invite');if(!inv)throw httpError('이미 사용된 초대입니다.',403);teamFor(inv.body.teamId);const u=store.createUser({email:inv.body.email,name:input.name||inv.body.name,role:inv.body.role||'member',teamId:inv.body.teamId||null});store.put('users',u.id,{...u,passwordHash:checkedHash});store.db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(input.token));return store.get('users',u.id);});return send(res,201,setSession(res,result));
      }
      if(!user)throw httpError('먼저 로그인해 주세요.',401);
      if(path==='/api/assistant')return send(res,200,assistant.answer(user,input,req));
      if(path==='/api/crew-profile')return send(res,200,crewProfiles.save(user,input));
      if(path==='/api/crew-profile/delete')return send(res,200,crewProfiles.remove(user,input));
      if(path==='/api/crew-work/evaluate')return send(res,200,crewProfiles.evaluate(user,input));
      if(user.role==='viewer'&&!['/api/logout','/api/account/password'].includes(path))throw httpError('열람 계정은 기록을 변경하거나 수집할 수 없습니다.',403);
      if(path==='/api/logout'){const result=synkIdentity.logout(auth.hash);res.setHeader('Set-Cookie','synk_company_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return send(res,200,await result);}
      if(path==='/api/account/password'){if(user.passwordHash&&!passwordMatches(input.oldPassword,user.passwordHash))throw httpError('현재 비밀번호를 확인해 주세요.',403);const changed={...user,passwordHash:passwordHash(input.password)};store.put('users',user.id,changed);store.revokeUser(user.id);return send(res,200,setSession(res,changed));}
      if(path==='/api/studio-productions'){const result=studio.saveProduction(user,input);audit(user,'studio-production-created',result.production.id);return send(res,201,result);}
      if(path==='/api/creator-reviews'){if(demoRequest)throw httpError('개인 점검은 실제 작업실에서 저장해 주세요.');const result=creatorReviews.save(user,input);audit(user,'creator-review-created',result.record.id);return send(res,201,result);}
      const creatorReviewRoute=path.match(/^\/api\/creator-reviews\/([^/]+)(?:\/(archive))?$/);
      if(creatorReviewRoute){if(demoRequest)throw httpError('개인 점검은 실제 작업실에서 저장해 주세요.');const result=creatorReviewRoute[2]?creatorReviews.archive(user,creatorReviewRoute[1],input):creatorReviews.save(user,input,creatorReviewRoute[1]);audit(user,creatorReviewRoute[2]?'creator-review-archived':'creator-review-updated',result.record.id);return send(res,200,result);}
      if(path==='/api/creative-research'){const result=creativeResearch.add(user,input);audit(user,'creative-research-created',result.entry.id);return send(res,201,result);}
      if(['/api/creative-research/import','/api/creative-research/import-top-ad'].includes(path)){
        if(stopRequested)throw httpError('서버가 종료 중입니다.',503);
        const originalHash=auth.hash,result=await creativeResearch.importTopAd(user,input,{assertSession(){const latest=session(req);if(!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);}});
        audit(user,'creative-research-imported',result.entry.id);return send(res,201,result);
      }
      const creativeItem=path.match(/^\/api\/creative-research\/([^/]+)(?:\/(archive))?$/);
      if(creativeItem){const result=creativeItem[2]?creativeResearch.archive(user,creativeItem[1],input):creativeResearch.update(user,creativeItem[1],input);audit(user,creativeItem[2]?'creative-research-archived':'creative-research-updated',result.entry.id);return send(res,200,result);}
      if(path==='/api/studio-materials'){const result=studio.saveMaterial(user,input);audit(user,'studio-material-created',result.material.id);return send(res,201,result);}
      if(path==='/api/studio-examples/direct'){const result=studio.publishDirectExample(user,input);audit(user,'studio-example-published',result.example.id);return send(res,201,result);}
      if(path==='/api/studio-examples'){const result=studio.publishExample(user,input);audit(user,'studio-example-published',result.example.id);return send(res,201,result);}
      const studioProduction=path.match(/^\/api\/studio-productions\/([^/]+)$/);
      if(studioProduction)return send(res,200,studio.saveProduction(user,input,studioProduction[1]));
      const studioVersion=path.match(/^\/api\/studio-productions\/([^/]+)\/versions$/);
      if(studioVersion)return send(res,201,studio.addVersion(user,studioVersion[1],input));
      const studioNote=path.match(/^\/api\/studio-productions\/([^/]+)\/notes$/);
      if(studioNote)return send(res,201,studio.addNote(user,studioNote[1],input));
      const studioResolve=path.match(/^\/api\/studio-productions\/([^/]+)\/notes\/([^/]+)$/);
      if(studioResolve)return send(res,200,studio.resolveNote(user,studioResolve[1],studioResolve[2],input));
      const studioMaterial=path.match(/^\/api\/studio-materials\/([^/]+)$/);
      if(studioMaterial)return send(res,200,studio.saveMaterial(user,input,studioMaterial[1]));
      const studioExample=path.match(/^\/api\/studio-examples\/([^/]+)$/);
      if(studioExample)return send(res,200,studio.archiveExample(user,studioExample[1],input));
      if(path==='/api/content-generate'){const result=content.generate(user,input);audit(user,'content-generated',result.draft.id);return send(res,201,result);}
      if(path==='/api/content-benchmarks/preview')return send(res,200,content.benchmarkPreview(user,input));
      if(path==='/api/content-benchmarks'){const result=content.benchmarkPublish(user,input);audit(user,'content-benchmark-published',result.issue.id);return send(res,201,result);}
      if(path==='/api/content-references'){const result=content.addReference(user,input);audit(user,'content-reference-created',result.reference.id);return send(res,201,result);}
      if(path==='/api/content-search-settings'){const result=content.configureSearch(user,input);audit(user,'content-search-settings','exa',{configured:result.search.configured});return send(res,200,result);}
      if(path==='/api/content-search'){const result=await content.search(user,input);const latest=session(req);if(!latest||latest.hash!==auth.hash||latest.user.role==='viewer')throw httpError('로그인 상태를 다시 확인해 주세요.',401);return send(res,200,result);}
      const contentDraft=path.match(/^\/api\/content-drafts\/([^/]+)$/);
      if(contentDraft){const result=content.update(user,contentDraft[1],input);audit(user,'content-draft-updated',result.draft.id);return send(res,200,result);}
      if(path==='/api/teams'){
        admin(user);const name=text(input.name,80);if(!name)throw httpError('팀 이름을 입력해 주세요.');if(store.all('teams').some(t=>t.active&&t.name.toLowerCase()===name.toLowerCase()))throw httpError('이미 있는 팀 이름입니다.');
        const team={id:randomUUID(),name,active:true,createdAt:clock()};store.put('teams',team.id,team);audit(user,'team-created',team.id);return send(res,201,{team});
      }
      const teamRoute=path.match(/^\/api\/teams\/([^/]+)$/);
      if(teamRoute){admin(user);const team=store.get('teams',teamRoute[1]);if(!team)throw httpError('팀을 찾을 수 없습니다.',404);const name=input.name===undefined?team.name:text(input.name,80);if(!name)throw httpError('팀 이름을 입력해 주세요.');if(store.all('teams').some(t=>t.id!==team.id&&t.active&&t.name.toLowerCase()===name.toLowerCase()))throw httpError('이미 있는 팀 이름입니다.');if(input.active===false&&(store.all('users').some(u=>u.teamId===team.id)||store.all('channels').some(c=>c.teamId===team.id)||store.all('handoffs').some(h=>h.status==='awaiting-connection'&&h.toTeamId===team.id)))throw httpError('소속 크루와 채널을 먼저 다른 팀으로 옮겨 주세요.');const updated={...team,name,active:input.active===undefined?team.active:input.active===true};store.put('teams',team.id,updated);audit(user,'team-updated',team.id,{before:team,after:updated});return send(res,200,{team:updated});}
      const membership=path.match(/^\/api\/members\/([^/]+)\/assignment$/);
      if(membership){
        admin(user);const target=store.get('users',membership[1]),selfAdmin=target?.id===user.id&&target.role==='admin';
        if(!target||target.role==='admin'&&!selfAdmin)throw httpError('다른 관리자의 소속과 역할은 변경할 수 없습니다.',403);
        const role=selfAdmin&&input.role===undefined?target.role:input.role,teamId=input.teamId||null;
        if(selfAdmin&&role!=='admin')throw httpError('관리자는 본인의 소속 팀만 변경할 수 있습니다.',403);
        if(!selfAdmin&&!['manager','member','viewer'].includes(role))throw httpError('크루 역할을 선택해 주세요.');
        teamFor(teamId);if(role==='manager'&&!teamId)throw httpError('팀장에게 소속 팀을 지정해 주세요.');
        const updated={...target,role,teamId};
        store.transaction(()=>{
          store.put('users',target.id,updated);
          // A self-service team change keeps this verified session, while older sessions must sign in again.
          if(selfAdmin)store.db.prepare('DELETE FROM tokens WHERE userId=? AND hash<>?').run(target.id,auth.hash);else store.revokeUser(target.id);
          if(role==='viewer')for(const h of store.all('handoffs'))if(h.status==='awaiting-connection'&&h.toOwnerIds.includes(target.id)){store.put('handoffs',h.id,{...h,status:'cancelled',cancelledAt:clock(),reason:'대상자의 역할이 열람자로 변경되어 취소'});const c=store.get('channels',h.channelId);if(c?.pendingHandoffId===h.id)store.put('channels',c.id,{...c,pendingHandoffId:null});}
          audit(user,'membership-updated',target.id,{before:{role:target.role,teamId:target.teamId||null},after:{role,teamId}});
        });return send(res,200,{member:publicUser(updated)});
      }
      if(path==='/api/channels'){
        const urls=Array.isArray(input.urls)?input.urls:String(input.urls||'').split(/[\n\r]+/).map(s=>s.trim()).filter(Boolean);if(!urls.length||urls.length>100)throw httpError('한 번에 주소 1~100개를 입력해 주세요. 추가 등록은 계속할 수 있습니다.');
        const ownerId=['admin','manager'].includes(user.role)&&input.ownerId?input.ownerId:user.id;const owner=store.get('users',ownerId);if(!owner?.active||owner.role==='viewer')throw httpError('활성 담당 크루를 확인해 주세요.');if(user.role==='manager'&&owner.id!==user.id&&owner.teamId!==user.teamId)throw httpError('같은 팀의 담당자만 선택할 수 있습니다.',403);
        const teamId=user.role==='admin'&&input.teamId!==undefined?(input.teamId||null):(owner.teamId||null);teamFor(teamId);
        const result={added:[],existing:[],errors:[]};store.transaction(()=>{for(const raw of urls){try{const parsed=normalizeChannelUrl(raw),existing=store.all('channels').find(c=>c.canonicalUrl===parsed.canonicalUrl);if(existing){if(canReadChannel(user,existing))result.existing.push(safeChannel(existing,user));else result.errors.push({url:raw,error:'이미 회사에 등록된 채널입니다. 관리자에게 담당자 추가를 요청하세요.'});continue;}const c={...parsed,id:randomUUID(),displayName:parsed.label||parsed.handle||parsed.externalId||parsed.canonicalUrl,ownerIds:[ownerId],teamId,active:true,status:'not-connected',createdAt:clock()};store.put('channels',c.id,c);seedOwnership(store,c,clock());result.added.push(safeChannel(c,user));}catch(e){result.errors.push({url:text(raw,1000),error:safeError(e.message)});}}audit(user,'add-channels',String(result.added.length));});return send(res,201,result);
      }
      const cancelHandoff=path.match(/^\/api\/channels\/([^/]+)\/handoff\/cancel$/);
      if(cancelHandoff){const c=channelFor(user,cancelHandoff[1],'write');if(!canManageOwners(user,c))throw httpError('관리자 또는 팀장만 인계를 취소할 수 있습니다.',403);const h=pending(c);if(h)store.transaction(()=>{store.put('handoffs',h.id,{...h,status:'cancelled',cancelledAt:clock(),cancelledBy:user.id});store.put('channels',c.id,{...c,pendingHandoffId:null});audit(user,'handoff-cancelled',c.id);});return send(res,200,{ok:true});}
      const cm=path.match(/^\/api\/channels\/([^/]+)\/(collect|connection|owners|archive|disconnect|details)$/);
      if(cm){const c=channelFor(user,cm[1],'write');if(cm[2]==='collect')return send(res,202,enqueueCollection(user,c));
        if(cm[2]==='owners')return send(res,200,changeOwners(user,c,input));
        if(cm[2]==='details'){const updated={...c};for(const key of ['displayName','brand','country','language'])if(input[key]!==undefined)updated[key]=text(input[key],key==='displayName'?160:80);if(!updated.displayName)throw httpError('채널 이름을 입력해 주세요.');if(input.teamId!==undefined&&(input.teamId||null)!==(c.teamId||null)){admin(user);if(pending(c))throw httpError('진행 중인 인계를 먼저 완료해 주세요.');teamFor(input.teamId);updated.teamId=input.teamId||null;updated.connectionVersion=(c.connectionVersion||0)+1;if(c.status==='collecting'){updated.status=hasConnection(c)?'ready':'not-connected';updated.lastAttemptAt=null;}}store.transaction(()=>{recordOwnershipChange(store,c,updated,{actorId:user.id,at:clock(),reason:'채널 소속 팀 변경'});store.put('channels',c.id,updated);});}
        if(cm[2]==='archive'){store.put('channels',c.id,{...c,active:input.active===true});}
        if(cm[2]==='connection'){admin(user);const allowed=['apiKey','accessToken','accountId','apiVersion','refreshToken','authType'];const creds=Object.fromEntries(allowed.filter(k=>input[k]).map(k=>[k,text(input[k],16000)]));if(!creds.accessToken&&!creds.apiKey)throw httpError('연결 정보를 입력해 주세요.');store.setSecret('channel:'+c.id,{...creds,connectedBy:user.id,connectedAt:now()});store.put('channels',c.id,{...c,status:'ready',lastError:null,collectionDisabled:false,failureKind:null,failureCode:null,retryCount:0,nextRetryAt:null,requiresReconnect:false,lastFailureAt:null,lastAttemptAt:null,...recentFields({status:'ready',failureKind:null,failureCode:null,retryCount:0,nextRetryAt:null,requiresReconnect:false,lastFailureAt:null,lastAttemptAt:null,lastError:null}),connectionVersion:(c.connectionVersion||0)+1});}
        if(cm[2]==='disconnect')disconnectChannel(c);
        audit(user,cm[2],c.id);return send(res,200,{ok:true});
      }
      if(path==='/api/collect'){const results=[];const q=new URLSearchParams();if(input.scope)q.set('scope',input.scope);if(input.teamId)q.set('teamId',input.teamId);for(const c of scopedChannels(user,q).filter(c=>canWriteChannel(user,c)&&c.active&&hasConnection(c)))results.push(enqueueCollection(user,c));return send(res,202,{runs:results});}
      if(path==='/api/members/invite'){admin(user);const email=text(input.email,254).toLowerCase(),name=text(input.name,80),role=input.role||'member',teamId=input.teamId||null;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name)throw httpError('크루의 이름과 이메일을 입력해 주세요.');if(!['manager','member','viewer'].includes(role))throw httpError('초대할 역할을 확인해 주세요.');teamFor(teamId);if(role==='manager'&&!teamId)throw httpError('팀장의 소속 팀을 선택해 주세요.');if(store.all('users').some(u=>u.email===email))throw httpError('이미 등록된 크루입니다.');const value=store.mint('invite',null,{email,name,role,teamId,invitedBy:user.id},3*24*60);audit(user,'invite',email,{role,teamId});return send(res,201,{inviteUrl:origin+'/#invite='+value,expiresInDays:3,delivery:'copy-link'});}
      const member=path.match(/^\/api\/members\/([^/]+)\/status$/);
      if(member){admin(user);const target=store.get('users',member[1]);if(!target||target.id===user.id||target.role==='admin')throw httpError('이 크루의 상태를 변경할 수 없습니다.');store.put('users',target.id,{...target,active:input.active===true});store.revokeUser(target.id);if(input.active!==true)for(const c of store.all('channels'))if(connection(c)?.connectedBy===target.id)disconnectChannel(c);audit(user,'member-status',target.id);return send(res,200,{ok:true});}
      if(path==='/api/settings'){admin(user);const hour=Number(input.hourKst);if(!Number.isInteger(hour)||hour<0||hour>23)throw httpError('수집 시각은 0~23시로 선택해 주세요.');store.put('settings','company',{...store.get('settings','company'),hourKst:hour,enabled:input.enabled===true,companyName:text(input.companyName,80)||store.get('settings','company').companyName});return send(res,200,{ok:true});}
      if(path==='/api/settings/provider'){admin(user);if(!['youtube','instagram','facebook','tiktok'].includes(input.platform))throw httpError('지원하지 않는 플랫폼입니다.');const cfg=store.secret('provider:'+input.platform)||{};for(const key of ['clientId','clientSecret','apiKey'])if(input[key])cfg[key]=text(input[key],16000);store.setSecret('provider:'+input.platform,cfg);audit(user,'provider-config',input.platform);return send(res,200,{ok:true});}
      if(path==='/api/import-legacy')return send(res,200,await importLegacy(user));
      throw httpError('요청을 찾을 수 없습니다.',404);
    }
    const oauth=path.match(/^\/api\/oauth\/(youtube|instagram|facebook|tiktok)\/(start|callback)$/);
    if(method==='GET'&&oauth){if(!auth)throw httpError('로그인 후 계정을 연결해 주세요.',401);const platform=oauth[1];
      if(oauth[2]==='start'){const c=channelFor(user,url.searchParams.get('channelId'),'connect');if(c.platform!==platform)throw httpError('채널 플랫폼이 다릅니다.');const cfg=providerConfig(platform);if(!cfg.clientId||!cfg.clientSecret)throw httpError('관리자가 플랫폼 앱을 먼저 설정해야 합니다.');const state=store.mint('oauth',user.id,{channelId:c.id,sessionHash:hash(auth.raw),platform},10);const dest=createAuthorization(platform,{...cfg,state});res.writeHead(302,{Location:dest,'Referrer-Policy':'no-referrer'});return res.end();}
      const state=store.consume(url.searchParams.get('state'),'oauth');if(!state||state.userId!==user.id||state.body.platform!==platform||state.body.sessionHash!==hash(auth.raw))throw httpError('연결 확인이 만료됐습니다. 다시 계정 연결을 눌러 주세요.',403);
      try{
        if(url.searchParams.has('error'))throw httpError('계정 연결이 취소됐습니다.');
        const c=channelFor(user,state.body.channelId,'connect');
        const creds=await exchangeCode(platform,{...providerConfig(platform),code:url.searchParams.get('code')});
        const result=await collector(c,{...providerConfig(platform),...creds});
        const currentAuth=session(req),currentUser=currentAuth?.user;
        if(!currentUser?.active||currentAuth.raw!==auth.raw||currentUser.id!==user.id)throw httpError('크루 로그인이 해제됐습니다.');
        channelFor(currentUser,c.id,'connect');let live=store.get('channels',c.id);
        if(!live.active||(live.connectionVersion||0)!==(c.connectionVersion||0))throw httpError('채널이 변경됐습니다. 다시 연결해 주세요.');
        if(store.all('channels').some(x=>x.id!==c.id&&x.platform===c.platform&&x.externalId&&x.externalId===result.channel.externalId))throw httpError('이 계정은 이미 회사에 등록되어 있습니다. 기존 채널에 담당자를 추가해 주세요.');
        const h=pending(live);
        if(h&&h.toOwnerIds.includes(user.id)){
          teamFor(h.toTeamId);if(h.toOwnerIds.some(id=>{const target=store.get('users',id);return !target?.active||target.role==='viewer';}))throw httpError('인계받을 담당자를 다시 확인해 주세요.');
        }
        const runId=randomUUID();
        store.transaction(()=>{
          store.put('runs',runId,{id:runId,channelId:c.id,channelName:c.displayName,status:'running',startedAt:clock(),requestedBy:user.id});
          if(h&&h.toOwnerIds.includes(user.id))live=completeHandoff(live,currentUser);
          saveCollection(live,result,runId,true);
          store.setSecret('channel:'+c.id,{...creds,connectedBy:user.id,connectedAt:clock()});
          store.put('channels',c.id,{...store.get('channels',c.id),collectionDisabled:false,connectionVersion:(live.connectionVersion||0)+1});
          audit(user,'oauth-connected',c.id);
        });res.writeHead(302,{Location:'/?connected='+encodeURIComponent(c.id)});return res.end();
      }catch(error){res.writeHead(302,{Location:'/?connectionError='+encodeURIComponent(safeError(error.message))});return res.end();}
    }
    const creatorAssetRoute=path.match(/^\/api\/creator-sources\/assets\/([a-z0-9-]+)$/);
    if(['GET','HEAD'].includes(method)&&creatorAssetRoute){
      if(!user)throw httpError('먼저 로그인해 주세요.',401);
      const file=await creatorSources.file(user,creatorAssetRoute[1]),bytes=await readFile(file.path),latest=session(req);
      if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
      const headers={...responseHeaders(file.mimeType),'Cache-Control':'private, no-store','Content-Length':bytes.length};
      if(url.searchParams.get('download')==='1')headers['Content-Disposition']=`attachment; filename="synk-brand-asset.${file.fileName.split('.').at(-1).replace(/[^a-z0-9]/gi,'')}"; filename*=UTF-8''${encodeURIComponent(file.fileName).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`;
      res.writeHead(200,headers);return res.end(method==='HEAD'?undefined:bytes);
    }
    const studioMediaRoute=path.match(/^\/api\/studio-media\/([^/]+)$/);
    if(['GET','HEAD'].includes(method)&&studioMediaRoute){if(!user)throw httpError('먼저 로그인해 주세요.',401);return await serveStudioMedia(req,res,store.directory,studio.readableMedia(user,studioMediaRoute[1]),()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);studio.readableMedia(latest.user,studioMediaRoute[1]);});}
    if(method==='GET'&&path.startsWith('/api/')){if(!user)throw httpError('먼저 로그인해 주세요.',401);
      if(path.startsWith('/api/demo/')){
        admin(user);
        if(path==='/api/demo/state')return send(res,200,demo.state(url.searchParams));
        if(path==='/api/demo/day'&&url.searchParams.get('leaders')==='1')return send(res,200,demo.contentLeaders(url.searchParams));
        if(path==='/api/demo/analytics'||path==='/api/demo/day')return send(res,200,demo.report(url.searchParams,path==='/api/demo/day'));
        if(path==='/api/demo/team-overview')return send(res,200,demo.teamOverview(url.searchParams));
        if(path==='/api/demo/team-trends')return send(res,200,demo.teamTrends(url.searchParams));
        if(path==='/api/demo/hype')return send(res,200,demo.hype(url.searchParams));
        if(path==='/api/demo/export.csv'){res.setHeader('Content-Disposition','attachment; filename="synk-demo-growth.csv"');return send(res,200,demo.report(url.searchParams)._csv(),'text/csv; charset=utf-8');}
        throw httpError('데모 요청을 찾을 수 없습니다.',404);
      }
      if(path==='/api/workspace-summary')return send(res,200,{messenger:messenger.summary(req)});
      if(path==='/api/crew-profile'){if(url.search)throw httpError('본인의 업무카드만 조회할 수 있습니다.',400);return send(res,200,crewProfiles.own(user));}
      if(path==='/api/crew-work/roster'){if(url.search)throw httpError('조회할 조직 범위는 현재 계정 권한으로 정해집니다.',400);return send(res,200,crewProfiles.roster(user));}
      if(path==='/api/workroom-guide')return send(res,200,workroomGuide(clock()));
      if(path==='/api/creator-reviews'){if(demoRequest)throw httpError('개인 점검은 실제 작업실에서 확인해 주세요.');return send(res,200,creatorReviews.workspace(user));}
      if(path==='/api/creator-sources')return send(res,200,await creatorSources.workspace(user));
      if(path==='/api/daily-trends'){if(demoRequest)throw httpError('일일 트렌드는 실제 작업실에서 확인해 주세요.',400);return send(res,200,dailyTrends.state({date:url.searchParams.has('date')?url.searchParams.get('date'):undefined}));}
      if(path==='/api/creative-research'){if(demoRequest)throw httpError('제작 참고 자료는 실제 작업실에서 확인해 주세요.',400);const archived=url.searchParams.get('includeArchived')??url.searchParams.get('archived');if(archived!==null&&!['0','1'].includes(archived))throw httpError('보관 자료 조회 여부를 확인해 주세요.');return send(res,200,creativeResearch.workspace(user,{includeArchived:archived==='1'}));}
      if(path==='/api/company-guide')return send(res,200,companyGuide());
      const workroomDocument=path.match(/^\/api\/workroom-source\/([a-z0-9-]+)$/);
      if(workroomDocument)return send(res,200,workroomSource(workroomDocument[1]));
      if(path==='/api/team-overview')return send(res,200,teamOverview(user,url.searchParams));
      if(path==='/api/team-trends'){
        const teams=store.all('teams').filter(team=>team.active===true),ids=new Set(teams.map(team=>team.id));
        const channels=store.all('channels').filter(channel=>ids.has(channel.teamId));
        return send(res,200,buildTeamTrends({teams,channels,records:records(channels,{readOnly:true}),ownTeamId:user.teamId,query:url.searchParams,today:today()}));
      }
      if(path==='/api/studio-examples')return send(res,200,studio.examples(user));
      if(path==='/api/studio-workspace')return send(res,200,studio.workspace(user));
      const studioDetail=path.match(/^\/api\/studio-productions\/([^/]+)$/);
      if(studioDetail)return send(res,200,studio.production(user,studioDetail[1]));
      if(path==='/api/hype')return send(res,200,hypeFeed(user,url.searchParams));
      if(path==='/api/content-workspace')return send(res,200,content.workspace(user));
      const contentShareTargets=path.match(/^\/api\/content-drafts\/([^/]+)\/share-targets$/);
      if(contentShareTargets){
        const {workspaceLink,readerIds}=content.reviewShare(user,contentShareTargets[1]),readable=new Set(readerIds),targets=messenger.workspaceShareTargets(req);
        const channels=targets.channels.filter(room=>room.kind!=='self').map(room=>{const allowed=room.companyUserIds.length>0&&room.companyUserIds.every(id=>readable.has(id));return{id:room.id,name:room.name,kind:room.kind,scope:room.scope,allowed,reason:allowed?'':'기획을 볼 수 없는 참여자가 있어요'};});
        const people=targets.members.filter(person=>person.companyUserId!==user.id&&readable.has(person.companyUserId)&&store.get('users',person.companyUserId)?.role!=='viewer').map(person=>({id:person.id,name:person.name,teamName:person.teamName||null,allowed:true}));
        return send(res,200,{workspaceLink,channels,people});
      }
      if(path==='/api/content-benchmarks/research-prompt'){admin(user);const document=await readFile(join(here,'BENCHMARK_RESEARCH_PROMPT.md'),'utf8'),prompt=document.match(/<!-- RESEARCH_PROMPT_START -->([\s\S]*?)<!-- RESEARCH_PROMPT_END -->/)?.[1]?.trim();if(!prompt)throw httpError('조사 프롬프트 원문을 확인해 주세요.',500);return send(res,200,{prompt});}
      if(path==='/api/content-benchmarks/template'){admin(user);return send(res,200,{template:JSON.parse(await readFile(join(here,'benchmark-upload-template.json'),'utf8'))});}
      const benchmarkDetail=path.match(/^\/api\/content-benchmarks\/([^/]+)$/);
      if(benchmarkDetail)return send(res,200,content.benchmarkDetail(user,benchmarkDetail[1]));
      const contentDetail=path.match(/^\/api\/content-drafts\/([^/]+)$/);
      if(contentDetail)return send(res,200,content.readDraft(user,contentDetail[1]));
      const contentExport=path.match(/^\/api\/content-drafts\/([^/]+)\/export$/);
      if(contentExport){const result=content.exportDraft(user,contentExport[1]);res.setHeader('Content-Disposition',`attachment; filename="content-${result.id.replace(/[^a-zA-Z0-9-]/g,'')}.md"`);return send(res,200,result.markdown,'text/markdown; charset=utf-8');}
      if(path==='/api/state'){
        const channels=visibleChannels(user),ids=new Set(channels.map(c=>c.id)),members=visibleMembers(store,user),teamIds=new Set([...channels.map(c=>c.teamId),user.teamId]),schedule=store.get('settings','company');
        const teams=store.all('teams').filter(t=>user.role==='admin'||teamIds.has(t.id)).map(t=>({...t,memberCount:members.filter(u=>u.teamId===t.id&&u.active).length,channelCount:channels.filter(c=>c.teamId===t.id&&c.active).length}));
        const safe=channels.map(c=>safeChannel(c,user));
        return send(res,200,{user:publicUser(user),permissions:permissions(user),teams,companyName:schedule.companyName,members,channels:safe,collection:collectionHealth(safe,{at:clock(),hourKst:schedule.hourKst,enabled:schedule.enabled}),capabilities:PLATFORM_CAPABILITIES,oauthProviders:providerStates(),schedule,runs:store.all('runs').filter(r=>ids.has(r.channelId)).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,100),deployment:{localOnly:isLocalHost(host),origin,serverMustStayRunning:true},legacyImportAvailable:user.role==='admin'&&existsSync(join(here,'../../dashboard/src/data.json')),demoAvailable:user.role==='admin'&&demo.available()});
      }
      const historyRoute=path.match(/^\/api\/channels\/([^/]+)\/history$/);
      if(historyRoute){const c=channelFor(user,historyRoute[1]),events=store.all('ownershipEvents').filter(e=>e.channelId===c.id).sort((a,b)=>a.effectiveAt.localeCompare(b.effectiveAt)||(a.sequence||0)-(b.sequence||0)).map(e=>({...e,beforeOwners:namedUsers(e.beforeOwnerIds),afterOwners:namedUsers(e.afterOwnerIds),actor:e.actorId?namedUsers([e.actorId])[0]:null}));return send(res,200,{events,handoffs:store.all('handoffs').filter(h=>h.channelId===c.id).map(h=>({...h,fromOwners:namedUsers(h.fromOwnerIds),toOwners:namedUsers(h.toOwnerIds)})),baselineAt:events.find(e=>e.baseline)?.effectiveAt||null});}
      if(path==='/api/day'&&url.searchParams.get('leaders')==='1')return send(res,200,contentLeaders(user,url.searchParams));
      if(path==='/api/analytics'||path==='/api/day')return send(res,200,report(user,url.searchParams,path==='/api/day'));
      if(path==='/api/export.csv'){res.setHeader('Content-Disposition','attachment; filename="synk-company-growth.csv"');return send(res,200,report(user,url.searchParams)._csv(),'text/csv; charset=utf-8');}
      throw httpError('요청을 찾을 수 없습니다.',404);
    }
    const files={'/studio.js':['public/studio.js','text/javascript; charset=utf-8'],'/studio.css':['public/studio.css','text/css; charset=utf-8'],'/studio-review.js':['public/studio-review.js','text/javascript; charset=utf-8'],'/studio-review.css':['public/studio-review.css','text/css; charset=utf-8'],'/studio-board.js':['public/studio-board.js','text/javascript; charset=utf-8'],'/studio-board.css':['public/studio-board.css','text/css; charset=utf-8'],'/benchmark.js':['public/benchmark.js','text/javascript; charset=utf-8'],'/benchmark.css':['public/benchmark.css','text/css; charset=utf-8'],'/content.js':['public/content.js','text/javascript; charset=utf-8'],'/content.css':['public/content.css','text/css; charset=utf-8'],'/wordmark.svg':['public/wordmark.svg','image/svg+xml'],'/pages.css':['public/pages.css','text/css; charset=utf-8'],'/dialogs.css':['public/dialogs.css','text/css; charset=utf-8'],'/':['public/index.html','text/html; charset=utf-8'],'/app.js':['public/app.js','text/javascript; charset=utf-8'],'/style.css':['public/style.css','text/css; charset=utf-8'],'/font.woff2':['../../../../브랜드_폰트/SUIT/SUIT-Variable.woff2','font/woff2'],'/inter.ttf':['../../../../브랜드_폰트/InterTight/InterTight-Regular.ttf','font/ttf'],'/inter-semibold.ttf':['../../../../브랜드_폰트/InterTight/InterTight-SemiBold.ttf','font/ttf'],'/mono.ttf':['../../../../브랜드_폰트/DM_Mono/DMMono-Regular.ttf','font/ttf'],'/brand-logo.svg':['../../../../홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg','image/svg+xml']};
    Object.assign(files,{'/workspace.js':['public/workspace.js','text/javascript; charset=utf-8'],'/workspace.css':['public/workspace.css','text/css; charset=utf-8'],'/team-overview.js':['public/team-overview.js','text/javascript; charset=utf-8']});
    Object.assign(files,{'/comparison-charts.js':['public/comparison-charts.js','text/javascript; charset=utf-8'],'/comparison-charts.css':['public/comparison-charts.css','text/css; charset=utf-8'],'/demo-ui.js':['public/demo-ui.js','text/javascript; charset=utf-8']});
    Object.assign(files,{'/growth-home.js':['public/growth-home.js','text/javascript; charset=utf-8'],'/growth-home.css':['public/growth-home.css','text/css; charset=utf-8']});
    Object.assign(files,{'/growth-history.js':['public/growth-history.js','text/javascript; charset=utf-8'],'/growth-history.css':['public/growth-history.css','text/css; charset=utf-8']});
    Object.assign(files,{'/team-trends.js':['public/team-trends.js','text/javascript; charset=utf-8'],'/team-trends.css':['public/team-trends.css','text/css; charset=utf-8']});
    Object.assign(files,{'/chart-hover.js':['public/chart-hover.js','text/javascript; charset=utf-8'],'/chart-hover.css':['public/chart-hover.css','text/css; charset=utf-8']});
    Object.assign(files,{'/marin-home.js':['public/marin-home.js','text/javascript; charset=utf-8'],'/marin-home.css':['public/marin-home.css','text/css; charset=utf-8'],'/marin.webp':['public/marin.webp','image/webp']});
    Object.assign(files,{'/marin-work.js':['public/marin-work.js','text/javascript; charset=utf-8'],'/marin-work.css':['public/marin-work.css','text/css; charset=utf-8']});
    Object.assign(files,{'/workroom.js':['public/workroom.js','text/javascript; charset=utf-8'],'/workroom.css':['public/workroom.css','text/css; charset=utf-8']});
    // Shared practice code and fictional examples only. Employee drafts remain in
    // the account-scoped workroom client; this does not expose a directory or API.
    Object.assign(files,{
      '/workroom-practice.js':['public/workroom-practice.js','text/javascript; charset=utf-8'],
      '/workroom-practice.css':['public/workroom-practice.css','text/css; charset=utf-8'],
      '/workroom-practice/model.mjs':['../../../../../experiences/shift-workbench/model.mjs','text/javascript; charset=utf-8'],
      '/workroom-practice/core.js':['../../../../../atlas/engine.js','text/javascript; charset=utf-8'],
      '/workroom-practice/personalization.js':['../../../../../atlas/personalization.js','text/javascript; charset=utf-8'],
    });
    for(const file of ['publish-rules.js','publish-check.js','maker-tools.js','maker-tools.css','subtitle-lab.js','subtitle-lab.css','creator-sources.js','creator-sources.css'])files['/'+file]=['public/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    Object.assign(files,{'/creative-research.js':['public/creative-research.js','text/javascript; charset=utf-8'],'/creative-research.css':['public/creative-research.css','text/css; charset=utf-8']});
    Object.assign(files,{'/company-guide.js':['public/company-guide.js','text/javascript; charset=utf-8'],'/company-guide.css':['public/company-guide.css','text/css; charset=utf-8']});
    Object.assign(files,{'/synk-id.js':['public/synk-id.js','text/javascript; charset=utf-8']});
    Object.assign(files,{'/manifest.webmanifest':['public/manifest.webmanifest','application/manifest+json; charset=utf-8'],'/messenger-icon.png':['public/messenger-icon.png','image/png']});
    if(['GET','HEAD'].includes(method)&&files[path]){const [file,type]=files[path];messenger.disconnectRevoked();return await respondStatic(req,res,{path:join(here,file),type,headers:responseHeaders(type)});}
    throw httpError('페이지를 찾을 수 없습니다.',404);
  }catch(e){send(res,e.status||400,{error:safeError(e.status||!options.production?e.message:'처리하지 못했습니다. 관리자에게 문의해 주세요.'),...(typeof e.code==='string'&&e.code.startsWith('SYNK_')?{code:e.code}:{})});}});
  function listen(listener,listenPort,listenHost){
    return new Promise((resolve,reject)=>{
      const failed=error=>{listener.off('listening',started);reject(error);};
      const started=()=>{listener.off('error',failed);resolve();};
      listener.once('error',failed);listener.once('listening',started);listener.listen(listenPort,listenHost);
    });
  }
  function shutdown(){
    ready=false;clearInterval(timer);synkIdentity.close();
    if(shutdownTask)return shutdownTask;
    shutdownTask=(async()=>{
      await Promise.all([queue,dailyTrends.stop(),creativeResearch.stop()]);messenger.endConnections();
      for(const listener of [redirectServer,server])if(listener?.listening)await new Promise(resolve=>{listener.close(resolve);listener.closeIdleConnections();});
      try{await messenger.close();}finally{store.close();}
    })();
    return shutdownTask;
  }
  function start(){
    if(startTask)return startTask;
    if(stopRequested)return Promise.reject(httpError('종료한 서버는 다시 생성해 주세요.',503));
    startTask=(async()=>{
      try{
        await messenger.startMounted();
        synkIdentity.startChecks();
        await listen(server,port,host);
        if(redirectServer)await listen(redirectServer,legacyPort,'127.0.0.1');
        if(options.schedule!==false&&!stopRequested){timer=setInterval(()=>scheduledTick().catch(()=>{}),60000);timer.unref();await scheduledTick();}
        ready=!stopRequested;
        return server.address();
      }catch(error){await shutdown().catch(()=>{});throw error;}
    })();
    return startTask;
  }
  async function stop(){ready=false;stopRequested=true;clearInterval(timer);if(startTask)await startTask.catch(()=>{});await shutdown();}
  return {server,store,messenger,dailyTrends,creativeResearch,origin,host,port,importLegacy,scheduledTick,report,enqueueCollection,waitForIdle:()=>Promise.all([queue,dailyTrends.waitForIdle(),creativeResearch.waitForIdle()]),start,stop};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let app;
  const errorLabel=error=>String(error?.code||error?.name||'Error').replace(/[^A-Za-z0-9_]/g,'').slice(0,80)||'Error';
  Promise.resolve().then(async()=>{app=createCompanyApp();await app.start();console.log('SYNK company SNS: '+app.origin);}).catch(async error=>{
    console.error('[company] Startup failed:',errorLabel(error));process.exitCode=1;
    if(app)await app.stop().catch(cleanupError=>console.error('[company] Shutdown failed:',errorLabel(cleanupError)));
  });
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{
    try{if(app)await app.stop();process.exitCode=0;}catch(error){console.error('[company] Shutdown failed:',errorLabel(error));process.exitCode=1;}
  });
}
