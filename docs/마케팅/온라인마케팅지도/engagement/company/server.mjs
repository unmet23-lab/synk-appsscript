import { createServer } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Store, now, today, token, hash, publicUser, passwordMatches, passwordHashAsync } from './store.mjs';
import { createClientAddress, createAttemptLimiter, reserveAttempts, createConcurrencyGuard, publicRequestError } from './request-security.mjs';
import { normalizeChannelUrl, collectChannel, PLATFORM_CAPABILITIES } from './collectors.mjs';
import { analyze, companyOverview, analyticsCsv, shiftDate, dateRange, METRICS, metricPoint, compareMetric, metricIndex } from '../analytics.mjs';
import { providers, createAuthorization, exchangeCode, refreshCredentials, verifyYouTubePublishingConnection } from './oauth.mjs';
import {createMetaConnectionService,verifyMetaConnection,hasVerifiedMetaComments,metaCommentScopes} from './meta-connection.mjs';
import { canReadChannel,canWriteChannel,canManageOwners,visibleMembers,seedOwnership,recordOwnershipChange,ownerAt } from './organization.mjs';
import { planFailure,shouldCollect,collectionHealth,recentPolicyChannel,recentNextCheckAt,shouldCollectRecent,RECENT_INTERVAL_MINUTES } from './collection-policy.mjs';
import { recordsForOwner } from './ownership-report.mjs';
import { buildHypeFeed } from './hype.mjs';
import { createContentService } from './content-service.mjs';
import { createDailyTrendsService } from './daily-trends-service.mjs';
import { createCreativeResearchService,creativeResearchTime } from './creative-research.mjs';
import {createCreativeResearchEvents} from './creative-research-events.mjs';
import { createCreativeResearchSyncService } from './creative-research-sync.mjs';
import { createDriveStorage } from '../../../../../tools/company-messenger/drive-storage.mjs';
import { createCreatorReviewsService } from './creator-reviews.mjs';
import { createCreatorSourcesService } from './creator-sources.mjs';
import { createClientProjectsService } from './client-projects.mjs';
import { createClientStartupService } from './client-startup.mjs';
import { createClientStartupTemplatesService } from './client-startup-templates.mjs';
import { createClientReplyTemplatesService } from './client-reply-templates.mjs';
import { createClientRightsService } from './client-rights.mjs';
import { createClientMaterialUsageService } from './client-material-usage.mjs';
import { createClientCompletionRecordsService } from './client-completion-records.mjs';
import { createClientDeliveryArchiveService } from './client-delivery-archive.mjs';
import { renderCompletionPdf,renderCompletionCsv } from './client-completion-records-render.mjs';
import { createClientSearchService } from './client-search.mjs';
import { createClientProgressUpdateService } from './client-progress-update.mjs';
import { createClientMaterialsService } from './client-materials.mjs';
import { createClientDraftsService } from './client-drafts.mjs';
import { createClientDeliveryService } from './client-delivery.mjs';
import { createDeliveryFileInspector } from './delivery-file-inspection.mjs';
import {receiveDeliveryMedia,commitDeliveryMedia,discardDeliveryMedia,serveDeliveryMedia} from './client-delivery-media.mjs';
import { createPulseStudioService } from './pulse-studio.mjs';
import { createClientIntake,discardIntakeFiles,serveIntakeFile } from './client-intake.mjs';
import { createBrandQualityService } from './brand-quality-service.mjs';
import { createStaticResponder } from './static-response.mjs';
import { workroomGuide,workroomSource } from './workroom-guide.mjs';
import { companyGuide } from './company-guide.mjs';
import { createStudioService } from './studio-service.mjs';
import { createPublicationPackageService } from './publication-package.mjs';
import { createPublicationInboxService } from './publication-inbox.mjs';
import { createPostPerformanceService } from './post-performance.mjs';
import { createPublicationWorkflowService } from './publication-workflow.mjs';
import { createPublicationLearningService } from './publication-learning.mjs';
import { createPublicationReviewService } from './publication-review.mjs';
import { createPublicationLinkCheckService } from './publication-link-check.mjs';
import { createSocialPublishingService } from './social-publishing.mjs';
import { createSocialPublishingProvider } from './social-publishing-provider.mjs';
import { createSocialPublishMedia } from './social-publish-media.mjs';
import { createSocialMarketingService } from './social-marketing.mjs';
import { createSocialRoutes } from './social-routes.mjs';
import { createSocialSourceDistribution } from './social-source-distribution.mjs';
import { createSocialInboxProvider } from './social-inbox-provider.mjs';
import { createSocialInboxRecovery } from './social-inbox-recovery.mjs';
import { createSocialAiCopy } from './social-ai-copy.mjs';
import { createSocialRecovery } from './social-recovery.mjs';
import { createSocialTracking } from './social-tracking.mjs';
import { createSocialWorkflowsService } from './social-workflows.mjs';
import { createSocialReview } from './social-review.mjs';
import { createSocialPublicRoutes } from './social-public-routes.mjs';
import { createSocialCapacity } from './social-capacity.mjs';
import { createSocialReplies } from './social-replies.mjs';
import { createSocialVariantPerformanceService } from './social-variant-performance.mjs';
import { createSocialFollowups } from './social-followups.mjs';
import { createWeeklySummaryService } from './weekly-summary.mjs';
import { createAutomationHealthService } from './automation-health.mjs';
import { createAutomationNotificationsService } from './automation-notifications.mjs';
import { createSynchronousReadScope } from './synchronous-read-scope.mjs';
import { createDemoService } from './demo-service.mjs';
import { buildGrowthSummary } from './growth-summary.mjs';
import { buildGrowthHistory } from './growth-history.mjs';
import { buildTeamTrends } from './team-trends.mjs';
import { buildContentLeaders } from './content-leaders.mjs';
import { createAssistantService } from './assistant-service.mjs';
import { createClientWorkflowService } from './client-workflow.mjs';
import { createClientNotificationsService } from './client-notifications.mjs';
import { createPulseLiveService } from './pulse-live.mjs';
import { createCrewProfileService } from './crew-profile-service.mjs';
import { createComputerInterpretationService } from './computer-interpretation-service.mjs';
import { receiveStudioMedia,commitStudioMedia,discardStudioMedia,serveStudioMedia } from './studio-media.mjs';
import { createMessenger } from '../../../../../tools/company-messenger/server.mjs';
import { createWebPushService, generateVapidKeys } from '../../../../../tools/company-messenger/web-push-service.mjs';
import { resolvePlatformUrl } from '../../../../../tools/company-messenger/platform-navigation.mjs';
import { createSynkIdentity, synkIdentityConfig } from './synk-identity.mjs';
import { createCustomerIdentity, customerIdentityConfig } from './customer-identity.mjs';
import { createCustomerComputerDraft } from './customer-computer-draft.mjs';
import { createCustomerRoutes } from './customer-routes.mjs';
import { createTeachingService, teachingServiceConfig } from './teaching-service.mjs';

// This service also loads Domain. Wait until the interpretation runtime has
// observed its source through the static service dependency before sharing it.
const { createPracticeSyncService } = await import('./workroom-practice-sync-service.mjs');

const here=dirname(fileURLToPath(import.meta.url));
const metricKeys=['views','likes','comments','shares','saves','reach'];
const HYPE_RECENT_MS=7*86400000,HYPE_RETENTION_MS=8*86400000;
const recentFields=value=>Object.fromEntries(Object.entries(value).map(([key,val])=>['recent'+key[0].toUpperCase()+key.slice(1),val]));
const safeError=message=>String(message||'처리하지 못했습니다.').replace(/(?:Bearer\s+|access_token=|refresh_token=)[^\s&]+/gi,'[보호된 값]').slice(0,400);
const httpError=(message,status=400)=>Object.assign(new Error(message),{status});
// Why stored channel credentials must not be used right now; the code lets publishers show the reason instead of a generic failure.
export function credentialHoldReason(live,channel,connectedBy){
  if(!live?.active)return ['CHANNEL_INACTIVE','이 계정이 비활성이라 연결 정보를 쓰지 않았어요. 계정을 다시 켠 뒤 시도해 주세요.'];
  if(live.collectionDisabled)return ['COLLECTION_DISABLED','이 계정의 연결이 꺼져 있어요. 계정 관리에서 다시 연결한 뒤 시도해 주세요.'];
  if((live.connectionVersion||0)!==(channel.connectionVersion||0))return ['CONNECTION_CHANGED','계정 연결이 바뀌었어요. 새 연결로 다시 시도해 주세요.'];
  if(connectedBy!==undefined&&!connectedBy?.active)return ['CONNECTION_OWNER_INACTIVE','이 계정을 연결한 사람의 회사 계정이 비활성이에요. 지금 담당자가 계정을 다시 연결해 주세요.'];
  return null;
}
const text=(value,max=200)=>String(value??'').trim().slice(0,max);
const count=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:null;
const isLocalHost=host=>['127.0.0.1','localhost','::1'].includes(host);

export function createCompanyApp(options={}) {
  const deliveryCheckSchedule=options.deliveryCheckSchedule??(options.schedule!==false);
  if(typeof deliveryCheckSchedule!=='boolean')throw httpError('납품 파일 점검 자동 실행 설정을 확인해 주세요.');
  const backgroundJobsSetting=process.env.SYNK_COMPANY_BACKGROUND_JOBS_ENABLED??'1';
  if(!['0','1'].includes(backgroundJobsSetting))throw new Error('SYNK_COMPANY_BACKGROUND_JOBS_ENABLED는 0 또는 1이어야 합니다.');
  const backgroundJobsEnabled=backgroundJobsSetting==='1';
  const workroomScheduleSetting=process.env.SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED;
  if(workroomScheduleSetting!==undefined&&!['0','1'].includes(workroomScheduleSetting))throw new Error('SYNK_COMPANY_WORKROOM_SCHEDULE_ENABLED는 0 또는 1이어야 합니다.');
  const workroomScheduleEnabled=workroomScheduleSetting===undefined?backgroundJobsEnabled:workroomScheduleSetting==='1';
  if(options.workNotificationsEnabled!==undefined&&typeof options.workNotificationsEnabled!=='boolean')throw new Error('workNotificationsEnabled는 boolean이어야 합니다.');
  const workNotificationsSetting=options.workNotificationsEnabled??process.env.SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED??backgroundJobsSetting;
  if(![true,false,'0','1'].includes(workNotificationsSetting))throw new Error('SYNK_COMPANY_WORK_NOTIFICATIONS_ENABLED는 0 또는 1이어야 합니다.');
  const workNotificationsEnabled=workNotificationsSetting===true||workNotificationsSetting==='1';
  const clientAddress=createClientAddress(options.trustedProxyIps??process.env.SYNK_COMPANY_TRUSTED_PROXY_IPS??'');
  const port=Number(options.port??process.env.SYNK_COMPANY_PORT??4191);
  const host=options.host??process.env.SYNK_COMPANY_HOST??'127.0.0.1';
  const production=options.production===true||process.env.NODE_ENV==='production'||!isLocalHost(host);
  const originUrl=new URL(options.origin??process.env.SYNK_COMPANY_ORIGIN??`http://127.0.0.1:${port}`);
  const origin=originUrl.origin;
  const webPushSetting=options.webPushEnabled??process.env.SYNK_COMPANY_WEB_PUSH_ENABLED??'0';
  if(![true,false,'0','1'].includes(webPushSetting))throw new Error('SYNK_COMPANY_WEB_PUSH_ENABLED는 0 또는 1이어야 합니다.');
  const webPushEnabled=webPushSetting===true||webPushSetting==='1';
  if(webPushEnabled&&originUrl.protocol!=='https:')throw new Error('기기 알림에는 HTTPS 회사 주소가 필요합니다.');
  if(!isLocalHost(host)&&originUrl.protocol!=='https:')throw new Error('크루용 서버에는 HTTPS 회사 주소가 필요합니다.');
  if(originUrl.pathname!=='/'||originUrl.search||originUrl.hash||originUrl.username)throw new Error('회사 주소에는 경로를 넣지 마세요.');
  const platformUrl=resolvePlatformUrl(options.platformUrl===undefined?process.env.SYNK_PLATFORM_URL:options.platformUrl,{origin});
  const dataDir=options.store?.directory??options.dataDir??process.env.SYNK_COMPANY_DATA??join(here,'data');
  if(existsSync(join(dataDir,'PREPARATION_INCOMPLETE')))throw new Error('복구 검증을 마치지 않은 데이터입니다. 복구 인수 절차를 완료한 뒤 시작해 주세요.');
  if((options.requireExistingData??process.env.SYNK_COMPANY_REQUIRE_EXISTING_DATA==='1')&&['company.sqlite','encryption.key','workspace-integration.json'].some(file=>!existsSync(join(dataDir,file))))throw new Error('클라우드용 회사 데이터와 암호화 키를 먼저 복구해야 합니다. 빈 데이터로 시작하지 않습니다.');
  const store=options.store??new Store(dataDir);
  const integrationFile=join(store.directory,'workspace-integration.json');
  let integrationConfig={};
  if(existsSync(integrationFile)){
    try{integrationConfig=JSON.parse(readFileSync(integrationFile,'utf8'));}catch{throw new Error('사내 앱 통합 설정을 읽을 수 없습니다.');}
  }
  const messengerDataDir=options.messengerDataDir??integrationConfig.messengerDataDir??process.env.MESSENGER_DATA_DIR??((options.dataDir||options.store)?join(store.directory,'messenger'):resolve(here,'../../../../../tools/company-messenger/data'));
  let messenger,clientNotifications,automationNotifications,socialPublishing,socialMarketing;
  const synkIdentity=createSynkIdentity({store,origin,config:options.synkIdentityConfig===undefined?synkIdentityConfig():options.synkIdentityConfig,fetch:options.synkIdentityFetch,verifyIdentity:options.synkIdentityVerifier,now:options.synkIdentityNow,onRevoked:()=>messenger?.disconnectRevoked(),clientAddress});
  const teaching=createTeachingService({store,origin,config:options.teachingConfig===undefined?teachingServiceConfig():options.teachingConfig,fetch:options.teachingFetch,now:options.teachingNow,clientAddress});
  const customerIdentity=createCustomerIdentity({store,origin,config:options.synkCustomerIdentityConfig===undefined?customerIdentityConfig():options.synkCustomerIdentityConfig,fetch:options.synkCustomerIdentityFetch,now:options.synkCustomerIdentityNow,clientAddress});
  messenger=createMessenger({dataDir:messengerDataDir,driveStorage:options.messengerDriveStorage,basePath:'/messenger',platformUrl,backgroundJobsEnabled,workNotificationsEnabled,integration:{
    origin,identityLinks:options.messengerIdentityLinks??integrationConfig.identityLinks??[],
    listUsers:()=>store.all('users'),listTeams:()=>store.all('teams'),workspaceName:()=>store.get('settings','company')?.companyName||'SYNK',
    notifications:{
      list:companyUserId=>{const user=store.get('users',companyUserId);return [...(clientNotifications?.list(user).notifications||[]),...(automationNotifications?.list(user).notifications||[]),...(socialMarketing?.notifications(user,socialPublishing.summary(user))||[])];},
      read:(companyUserId,id)=>{const user=store.get('users',companyUserId);return id.startsWith('social:')?socialMarketing.readNotifications(user,socialPublishing.summary(user),id):id.startsWith('automation:')?automationNotifications.read(user,id):clientNotifications.read(user,id);},
      readAll:companyUserId=>{const user=store.get('users',companyUserId);clientNotifications.readAll(user);automationNotifications?.readAll(user);socialMarketing?.readNotifications(user,socialPublishing.summary(user));},
    },
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
  const inflight=new Set();let queue=Promise.resolve();let timer,pushTimer,researchSyncTimer,publicationTimer,publicationInboxTimer,publicationLinkTimer,weeklySummaryTimer,automationHealthTimer,deliveryCheckTimer,socialTimer;
  let ready=false,startTask=null,shutdownTask=null,stopRequested=false;
  const loginNow=options.loginNow??(()=>Date.now()),loginWork=createConcurrencyGuard(4);
  const loginPair=createAttemptLimiter({limit:8,windowMs:15*60000,now:loginNow});
  const loginIp=createAttemptLimiter({limit:30,windowMs:15*60000,now:loginNow});
  const loginAccount=createAttemptLimiter({limit:50,windowMs:15*60000,now:loginNow});
  const loginGlobal=createAttemptLimiter({limit:120,windowMs:60000,maxEntries:1,now:loginNow});
  const pulseAttempts=createAttemptLimiter({limit:30,windowMs:15*60000,now:loginNow});
  const clock=()=>options.clock?.()||now();
  const content=createContentService({store,clock,fetchImpl:options.contentFetch,isConnected:hasConnection});
  const dailyTrends=createDailyTrendsService({store,clock,collector:options.dailyTrendsCollector,fetchImpl:options.dailyTrendsFetch});
  let creativeResearchEvents;
  const researchEventAuth=new WeakMap();
  const creativeResearch=createCreativeResearchService({store,clock,fetchImpl:options.creativeResearchFetch,onChanged:()=>creativeResearchEvents?.changed()});
  const researchDrive=options.creativeResearchDrive??createDriveStorage({dataDir:messengerDataDir,fetchImpl:options.creativeResearchDriveFetch});
  const creativeResearchSync=createCreativeResearchSyncService({store,research:creativeResearch,clock,reader:options.creativeResearchReader??(async input=>{const connectionId=input.connectionId??(await researchDrive.active())?.id;const result=await researchDrive.readCreativeResearchDocument({...input,connectionId});if(input.connectionId==null&&(await researchDrive.active())?.id!==connectionId)throw Object.assign(httpError('문서를 읽는 동안 저장 계정이 변경되었습니다.',409),{code:'SYNC_AUTHORITY_CHANGED'});return result;})});
  creativeResearchEvents=createCreativeResearchEvents({resolveAccess(req){const original=researchEventAuth.get(req),latest=session(req);if(stopRequested||!original||!latest||latest.hash!==original.hash||latest.user.id!==original.userId||!['admin','manager','member','viewer'].includes(latest.user.role))return null;return {revision:creativeResearch.revision(latest.user)};},heartbeatMs:options.creativeResearchHeartbeatMs??15000,maxConnections:options.creativeResearchMaxConnections??128});
  const creatorReviews=createCreatorReviewsService({store,clock});
  const creatorSources=createCreatorSourcesService({store});
  const automationReadScope=createSynchronousReadScope();
  const clientProjects=automationReadScope.service(createClientProjectsService({store,clock}),['workspace']);
  const deliveryFileInspector=options.deliveryFileInspector??createDeliveryFileInspector({directory:store.directory,ffprobe:options.deliveryFfprobe});
  const clientDelivery=automationReadScope.service(createClientDeliveryService({store,clientProjects,clock,fileInspector:deliveryFileInspector}),['get']);
  let deliveryCheckTick=null;
  function scanDeliveryChecks(){
    if(stopRequested||deliveryCheckTick)return deliveryCheckTick;
    beginRuntime(deliveryCheckRuntime);const seen=new Set();
    const onProject=({projectId,status,at,fingerprint})=>{
      if(status==='skipped'){seen.delete(projectId);delete deliveryCheckRuntime.projects[projectId];return;}
      seen.add(projectId);let project=deliveryCheckRuntime.projects[projectId];
      if(!project||project.fingerprint!==fingerprint)project=deliveryCheckRuntime.projects[projectId]={fingerprint,lastAttemptAt:null,lastSuccessAt:null,lastErrorAt:null,running:false};
      if(status==='running'){project.running=true;project.lastAttemptAt=at;}
      else{project.running=false;if(status==='success'){project.lastSuccessAt=at;project.lastErrorAt=null;}else project.lastErrorAt=at;}
    };
    deliveryCheckTick=Promise.resolve().then(()=>clientDelivery.scanChecks({onProject})).then(result=>{
      for(const projectId of Object.keys(deliveryCheckRuntime.projects))if(!seen.has(projectId))delete deliveryCheckRuntime.projects[projectId];
      deliveryCheckRuntime.lastScanErrorAt=null;finishRuntime(deliveryCheckRuntime,result.failed===0);return result;
    },()=>{deliveryCheckRuntime.lastScanErrorAt=clock();finishRuntime(deliveryCheckRuntime,false);return {failed:true};}).finally(()=>{deliveryCheckTick=null;});
    return deliveryCheckTick;
  }
  const pulseStudio=createPulseStudioService({store,clientProjects,clock});
  const clientStartupTemplates=createClientStartupTemplatesService({store,clientProjects,clock});
  const clientSearch=createClientSearchService({store,clientProjects});
  const clientStartup=createClientStartupService({store,clientProjects,templates:clientStartupTemplates,clock});
  const clientProgressUpdate=createClientProgressUpdateService({store,clientProjects,clock});
  const clientMaterials=automationReadScope.service(createClientMaterialsService({store,clientProjects,clock}),['workspace']);
  const clientReplyTemplates=createClientReplyTemplatesService({store,clientProjects,clock});
  const clientMaterialUsage=automationReadScope.service(createClientMaterialUsageService({store,clientProjects,clientMaterials,clock}),['workspace','reminderExclusions']);
  const clientRights=automationReadScope.service(createClientRightsService({store,clientProjects,clientMaterials,clientMaterialUsage,clock}),['workspace','reminders']);
  const clientDeliveryArchive=createClientDeliveryArchiveService({store,clientProjects,clock});
  const deliveryArchiveActive=new Set();
  const clientCompletionRecords=createClientCompletionRecordsService({store,clientProjects,clientMaterials,clientRights,clock});
  const completionRecordsRenderer=options.completionRecordsRenderer||{pdf:renderCompletionPdf,csv:renderCompletionCsv};
  const completionRecordsActive=new Set();
  const clientDrafts=createClientDraftsService({store,clientProjects,clock});
  const clientWorkflow=automationReadScope.service(createClientWorkflowService({store,clientProjects,clientDelivery,clientRights,clock}),['workspace']);
  let pulseLiveEvents,notifyPulseDevices=()=>{};
  const pulseEventAuth=new WeakMap();
  clientNotifications=createClientNotificationsService({store,clientProjects,clientWorkflow,clock,onChange:ids=>{messenger.notifyCompanyUsers(ids);pulseLiveEvents?.changed();notifyPulseDevices();}});
  const pulseLive=createPulseLiveService({store,clientProjects,clientNotifications,clock,onChange:()=>{pulseLiveEvents?.changed();notifyPulseDevices();}});
  pulseLiveEvents=createCreativeResearchEvents({resolveAccess(req){
    const original=pulseEventAuth.get(req);if(stopRequested||!original)return null;
    if(original.customerToken){const current=clientProjects.session(original.customerToken);if(current.auth.hash!==original.hash)return null;return {revision:pulseLive.customerState(original.customerToken).revision};}
    const latest=session(req);if(!latest||latest.hash!==original.hash||latest.user.id!==original.userId)return null;
    return {revision:pulseLive.staffState(latest.user).revision};
  },heartbeatMs:options.pulseHeartbeatMs??15000,maxConnections:options.pulseMaxConnections??128});
  let webPushKeys=null;
  if(webPushEnabled){
    webPushKeys=store.secret('device-web-push-vapid');
    if(!webPushKeys){webPushKeys=generateVapidKeys();store.setSecret('device-web-push-vapid',webPushKeys);}
  }
  // Explicit device opt-in is independent of restored collection/deletion/reminder queues.
  const deviceNotifications=createWebPushService({db:store.db,enabled:webPushEnabled,...webPushKeys,subject:origin,now:clock,
    notificationsForUser:userId=>userId.startsWith('pulse:')?pulseLive.customerPushNotifications(userId):userId.startsWith('pulse-staff:')?clientNotifications.list(store.get('users',userId.slice('pulse-staff:'.length))).notifications:messenger.notificationsForCompanyUser(userId).filter(row=>row.kind!=='automation_health'),
    currentSession:currentPushSession,...(options.webPushSend?{send:options.webPushSend}:{}),
  });
  let pulsePushScheduled=false;
  notifyPulseDevices=()=>{if(!webPushEnabled||pulsePushScheduled||stopRequested)return;pulsePushScheduled=true;queueMicrotask(()=>{pulsePushScheduled=false;if(!stopRequested)void deviceNotifications.tick().catch(()=>{});});};
  const clientIntake=createClientIntake({directory:options.clientIntakeDir??process.env.SYNK_PULSE_INBOX??(process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'SYNK','PULSE-Intake','inbox'):null)});
  const brandQuality=createBrandQualityService({store,clock});
  const studio=automationReadScope.service(createStudioService({store,clock}),['production']);
  const publicationPackages=automationReadScope.service(createPublicationPackageService({store,studio,clock,...options.publicationPackageOptions}),['get']);
  const publicationInboxLocal=isLocalHost(host)&&isLocalHost(originUrl.hostname);
  const publicationInbox=automationReadScope.service(createPublicationInboxService({store,studio,clock,enabled:publicationInboxLocal&&options.publicationInboxEnabled!==false}),['state']);
  const automationRuntimeStart=clock(),automationRuntime={};
  function runtimeJob(id,enabled,intervalMs){return automationRuntime[id]??(automationRuntime[id]={enabled:!!enabled,running:false,intervalMs,startAt:automationRuntimeStart,lastAttemptAt:null,lastSuccessAt:null,lastErrorAt:null});}
  const deliveryCheckRuntime=Object.assign(runtimeJob('deliveryCheck',deliveryCheckSchedule,60000),{projects:{},lastScanErrorAt:null});
  const inboxRuntime=runtimeJob('inbox',publicationInboxLocal&&(options.publicationInboxSchedule??(options.schedule!==false)),5000);
  function beginRuntime(job){job.running=true;job.lastAttemptAt=clock();}
  function finishRuntime(job,ok){job.running=false;if(ok){job.lastSuccessAt=clock();job.lastErrorAt=null;}else job.lastErrorAt=clock();}
  let publicationInboxTick=Promise.resolve();
  function scanPublicationInbox(){
    if(stopRequested||inboxRuntime.running)return publicationInboxTick;
    beginRuntime(inboxRuntime);
    publicationInboxTick=Promise.resolve().then(()=>publicationInbox.scan()).then(result=>{finishRuntime(inboxRuntime,true);return result;},()=>{finishRuntime(inboxRuntime,false);});
    return publicationInboxTick;
  }
  const postPerformance=automationReadScope.service(createPostPerformanceService({store,clock,collector:options.postPerformanceCollector??collector,getCredentials:credentialsFor,isConnected:hasConnection}),['list','observations']);
  socialMarketing=createSocialMarketingService({store,studio,publicationPackages,clientProjects,performance:postPerformance,clock,...options.socialMarketingOptions});
  const authorizeSocialPublish=input=>{socialProvider.assertUnique?.(input.channel);return socialPublishing.assertExecution({...input,continuation:input.continuation===true||input.phase==='media-fetch'});};
  const socialPublishMedia=createSocialPublishMedia({store,clock,origin,resolveMedia:socialMarketing.resolveMedia,authorizePublish:authorizeSocialPublish,...options.socialPublishMediaOptions});
  const socialProvider=options.socialProvider??(options.socialProviderFactory||createSocialPublishingProvider)({store,clock,getProviderConfig:providerConfig,getCredentials:credentialsFor,resolveMedia:socialMarketing.resolveMedia,issueMediaUrl:(ref,input)=>socialPublishMedia.issue(ref,input),authorizePublish:authorizeSocialPublish,allowedBaseUrls:(process.env.SYNK_SOCIAL_PROVIDER_ALLOWED_URLS||'').split(',').map(x=>x.trim()).filter(Boolean),...options.socialProviderOptions});
  let socialReview;
  socialPublishing=createSocialPublishingService({store,clock,provider:socialProvider,validateSource:socialMarketing.validateSource,onApproved:args=>socialReview?.recordApproval(args),validateReview:args=>socialReview?.validateReview(args),onPublished({post,variant,job,channel,actor}){
    const registered=postPerformance.register(actor,{channelId:channel.id,url:job.publicationUrl,publishedAt:job.publishedAt,title:variant.title||post.title,publicationPackageId:post.source?.packageId||null,...(post.source?.packageId&&variant.publicationFormat?{publicationFormat:variant.publicationFormat}:{})});
    return {performanceEntryId:registered.entry.id};
  }});
  const socialSchedule=options.socialSchedule??(workroomScheduleEnabled&&options.schedule!==false);
  if(typeof socialSchedule!=='boolean')throw httpError('SNS 예약 실행 설정을 확인해 주세요.');
  const socialRuntime=runtimeJob('social',socialSchedule,15000),socialAbort=new AbortController();
  const socialSourceRuntime=runtimeJob('socialSources',socialSchedule,60000);
  const socialInboxRuntime=runtimeJob('socialInbox',socialSchedule,60000);
  const metaConnections=createMetaConnectionService({store,clock,getProviderConfig:providerConfig,fetchImpl:options.metaConnectionFetch});
  const socialHealthRuntime=runtimeJob('socialHealth',socialSchedule,3600000);
  const socialDistribution=createSocialSourceDistribution({store,studio,publicationPackages,marketing:socialMarketing,publishing:socialPublishing,clock});
  const socialInboxProvider=createSocialInboxProvider({store,clock,getCredentials:credentialsFor,...options.socialInboxOptions});
  const socialInboxRecovery=createSocialInboxRecovery({store,inboxProvider:socialInboxProvider,clock,getProviderConfig:providerConfig,fetchImpl:options.metaConnectionFetch});
  const socialReplies=createSocialReplies({store,clock,getCredentials:credentialsFor,...options.socialInboxOptions,...options.socialReplyOptions});
  const socialAi=createSocialAiCopy({store,clock,...options.socialAiOptions});
  const socialRecovery=createSocialRecovery({store,publishing:socialPublishing,marketing:socialMarketing,clock});
  const socialTracking=createSocialTracking({store,publishing:socialPublishing,clock,origin,...options.socialTrackingOptions});
  const socialCapacity=createSocialCapacity({store,publishing:socialPublishing,provider:socialProvider,clock});
  const socialCopyInsights=createSocialVariantPerformanceService({store,publishing:socialPublishing,performance:postPerformance,tracking:socialTracking,validatePostInput:socialMarketing.validatePostInput,clock});
  const socialFollowups=createSocialFollowups({store,clock,origin,tasks:{options:user=>messenger.taskOptionsForCompanyUser(user.id),create:(user,input)=>messenger.createTaskForCompanyUser(user.id,input),get:(user,input)=>messenger.taskForCompanyUser(user.id,input),find:(user,input)=>messenger.findTaskForCompanyUser(user.id,input)}});
  async function prepareSocialPost(user,row,{authorize=()=>user,signal}={}){
    if(signal?.aborted)throw httpError('요청이 중단됐습니다.',409);
    const normalized=socialMarketing.validatePostInput(authorize(),row),refs=[...(normalized.media||[]),...(normalized.variants||[]).flatMap(v=>v.media||[])],assetIds=[...new Set(refs.map(ref=>ref.assetId||ref.id).filter(Boolean))];
    if(assetIds.length)await socialMarketing.prepareMedia(authorize(),assetIds,{authorize,signal});
    if(signal?.aborted)throw httpError('요청이 중단됐습니다.',409);
    return socialMarketing.validatePostInput(authorize(),normalized);
  }
  const socialWorkflows=createSocialWorkflowsService({store,publishing:socialPublishing,clock,preparePost:prepareSocialPost,validatePostInput:socialMarketing.validatePostInput});
  socialReview=createSocialReview({store,publishing:socialPublishing,resolveMedia:socialMarketing.resolveMedia,validateSource:socialMarketing.validateSource,clock,origin});
  let socialTick=Promise.resolve(),socialExtras=Promise.resolve();let socialExtrasRunning=false;
  function notifySocialChanges(){
    if(stopRequested)return;
    // SSE only invalidates the notification view; its contents are re-read with
    // each user's current permissions, including after role changes.
    messenger.notifyCompanyUsers(store.all('users').filter(user=>user.active).map(user=>user.id));
  }
  function scanSocialPublishing(){
    if(stopRequested||socialRuntime.running)return socialTick;
    beginRuntime(socialRuntime);
    const jobsWritten=()=>typeof store.generation==='function'?store.generation('socialPublishJobs'):store.all('socialPublishJobs').map(job=>job.id+':'+job.updatedAt+':'+job.status).join('|'),before=jobsWritten();
    socialTick=Promise.resolve().then(async()=>{
      const result=await socialPublishing.tick({signal:socialAbort.signal});
      const after=jobsWritten();
      if(before!==after)notifySocialChanges();return result;
    }).then(result=>{finishRuntime(socialRuntime,true);void scanSocialExtras();return result;},()=>{finishRuntime(socialRuntime,false);void scanSocialExtras();});
    return socialTick;
  }
  function scanSocialExtras(){
    if(stopRequested||socialExtrasRunning)return socialExtras;
    socialExtrasRunning=true;
    socialExtras=Promise.resolve().then(async()=>{
      socialAi.prune();
      socialCapacity.prune();
      const jobs=[];
      if(!socialSourceRuntime.lastAttemptAt||Date.parse(clock())-Date.parse(socialSourceRuntime.lastAttemptAt)>=60000){
        beginRuntime(socialSourceRuntime);jobs.push(socialDistribution.scan({signal:socialAbort.signal}).then(result=>{finishRuntime(socialSourceRuntime,!result.failed);if(result.created)notifySocialChanges();},()=>finishRuntime(socialSourceRuntime,false)));
      }
      // Check due accounts frequently; scanDue retains each account's 15-minute
      // interval and request budget even when an earlier account delays its start.
      if(!socialInboxRuntime.lastAttemptAt||Date.parse(clock())-Date.parse(socialInboxRuntime.lastAttemptAt)>=socialInboxRuntime.intervalMs){
        beginRuntime(socialInboxRuntime);jobs.push(socialInboxProvider.scanDue({signal:socialAbort.signal}).then(result=>{finishRuntime(socialInboxRuntime,!result.failed);if(result.imported||result.updated)notifySocialChanges();},()=>finishRuntime(socialInboxRuntime,false)));
      }
      if(!socialHealthRuntime.lastAttemptAt||Date.parse(clock())-Date.parse(socialHealthRuntime.lastAttemptAt)>=3600000){
        beginRuntime(socialHealthRuntime);jobs.push(Promise.all([socialProvider.scanHealthDue?.({signal:socialAbort.signal}),socialReplies.scanHealthDue({signal:socialAbort.signal})]).then(results=>{finishRuntime(socialHealthRuntime,!results.some(result=>result?.failed));notifySocialChanges();},()=>finishRuntime(socialHealthRuntime,false)));
      }
      await Promise.all(jobs);
    }).catch(()=>{}).finally(()=>{socialExtrasRunning=false;});
    return socialExtras;
  }
  const publicationLinks=createPublicationLinkCheckService({store,studio,publicationPackages,postPerformance,clock,...(options.publicationLinkProbe?{probe:options.publicationLinkProbe}:{})});
  const socialRoutes=createSocialRoutes({store,publishing:socialPublishing,marketing:socialMarketing,provider:socialProvider,distribution:socialDistribution,inboxProvider:socialInboxProvider,inboxRecovery:socialInboxRecovery,replies:socialReplies,capacity:socialCapacity,copyInsights:socialCopyInsights,followups:socialFollowups,ai:socialAi,recovery:socialRecovery,tracking:socialTracking,workflows:socialWorkflows,review:socialReview,publicationLinks,signal:socialAbort.signal,session,origin,body,send,isStopped:()=>stopRequested,runtime:()=>({...socialRuntime,sources:{...socialSourceRuntime},inbox:{...socialInboxRuntime},health:{...socialHealthRuntime}}),onChange:notifySocialChanges});
  const socialPublicRoutes=createSocialPublicRoutes({review:socialReview,tracking:socialTracking,body,send,origin,signal:socialAbort.signal,clientAddress,isStopped:()=>stopRequested,onReviewChange:notifySocialChanges});
  const publicationLinkSchedule=options.publicationLinkSchedule??(workroomScheduleEnabled&&options.schedule!==false);
  const publicationPerformanceSchedule=backgroundJobsEnabled&&options.schedule!==false;
  const linksRuntime=runtimeJob('links',publicationLinkSchedule,60000),performanceRuntime=runtimeJob('performance',publicationPerformanceSchedule,60000);
  const publicationReview=createPublicationReviewService({store,studio,publicationPackages,publicationLinks,clock});
  const publicationWorkflow=automationReadScope.service(createPublicationWorkflowService({store,studio,publicationInbox,publicationPackages,publicationReview,postPerformance,publicationLinks,clock}),['workspace']);
  function readPublicationWorkday(user){const data=publicationWorkflow.workspace(user);return {...data,items:[...data.items,...socialMarketing.workday(user,socialPublishing.summary(user))]};}
  const publicationLearning=automationReadScope.service(createPublicationLearningService({store,studio,publicationPackages,postPerformance,clock}),['workspace']);
  const weeklySummarySchedule=options.weeklySummarySchedule??(workroomScheduleEnabled&&options.schedule!==false);
  if(typeof weeklySummarySchedule!=='boolean')throw httpError('주간 정리 자동 실행 설정을 확인해 주세요.');
  const weeklyRuntime=runtimeJob('weekly',weeklySummarySchedule,60000);
  const weeklySummary=createWeeklySummaryService({store,studio,postPerformance,publicationWorkflow:{workspace:readPublicationWorkday},publicationLearning,socialPublishing,clientProjects,clientWorkflow,contentService:content,clock,taskSummary:(user,period)=>messenger.weeklySummaryForCompanyUser(user.id,{...period,today:new Date(Date.parse(clock())+9*3600000).toISOString().slice(0,10)})});
  let weeklySummaryError=false;
  function scanWeeklySummary(){if(stopRequested)return;beginRuntime(weeklyRuntime);try{const result=weeklySummary.scanDue();weeklySummaryError=false;finishRuntime(weeklyRuntime,true);return result;}catch{weeklySummaryError=true;finishRuntime(weeklyRuntime,false);}}
  function readWeeklySummary(user,options={}){const result=weeklySummary.get(user,options);return {...result,schedule:{...result.schedule,enabled:weeklySummarySchedule,serverMustStayRunning:true,status:weeklySummaryError?'error':weeklySummarySchedule?'enabled':'disabled'}};}
  const publicationAbort=new AbortController();
  let publicationLinkTick=Promise.resolve();
  function scanPublicationLinks(){
    if(stopRequested||linksRuntime.running)return publicationLinkTick;
    beginRuntime(linksRuntime);
    publicationLinkTick=Promise.resolve().then(()=>publicationLinks.scanDue({signal:publicationAbort.signal})).then(result=>{finishRuntime(linksRuntime,true);return result;},()=>{finishRuntime(linksRuntime,false);});
    return publicationLinkTick;
  }
  let publicationTick=Promise.resolve();
  function collectPublicationPerformance(){
    if(stopRequested||performanceRuntime.running)return publicationTick;
    beginRuntime(performanceRuntime);
    publicationTick=Promise.resolve().then(()=>postPerformance.collectDue({signal:publicationAbort.signal})).then(result=>{finishRuntime(performanceRuntime,true);return result;},()=>{finishRuntime(performanceRuntime,false);});
    return publicationTick;
  }
  const automationHealthSchedule=options.automationHealthSchedule??(workroomScheduleEnabled&&options.schedule!==false);
  if(typeof automationHealthSchedule!=='boolean')throw httpError('자동화 상태 확인 설정을 확인해 주세요.');
  const automationHealthSource=createAutomationHealthService({store,studio,publicationPackages,publicationInbox,postPerformance,publicationLinks,publicationWorkflow,publicationLearning,clientProjects,clientWorkflow,clientDelivery,clientRights,weeklySummary,clock,runtime:()=>Object.fromEntries(Object.entries(automationRuntime).map(([id,row])=>[id,{...row,...(row.projects?{projects:Object.fromEntries(Object.entries(row.projects).map(([projectId,project])=>[projectId,{...project}]))}:{})}]))});
  const automationHealth={get:user=>automationReadScope.run(()=>automationHealthSource.get(user))};
  automationNotifications=createAutomationNotificationsService({store,automationHealth,clock,onChange:ids=>messenger.notifyCompanyUsers(ids)});
  const automationMonitor={enabled:automationHealthSchedule,lastScanAt:null,status:automationHealthSchedule?'pending':'disabled',intervalMs:60000};
  function scanAutomationHealth(){if(stopRequested)return;try{const result=automationNotifications.scan();automationMonitor.lastScanAt=clock();automationMonitor.status=result.failedUsers?'error':automationHealthSchedule?'enabled':'disabled';return result;}catch{automationMonitor.status='error';}}
  let automationHealthTick=null;
  function scanAutomationHealthScheduled(){
    if(stopRequested||automationHealthTick)return automationHealthTick;
    automationHealthTick=automationNotifications.scanAsync({shouldStop:()=>stopRequested}).then(result=>{if(!result.cancelled){automationMonitor.lastScanAt=clock();automationMonitor.status=result.failedUsers?'error':automationHealthSchedule?'enabled':'disabled';}return result;},()=>{automationMonitor.status='error';}).finally(()=>{automationHealthTick=null;});
    return automationHealthTick;
  }
  function readAutomationHealth(user){return {...automationHealth.get(user),monitor:{...automationMonitor,serverMustStayRunning:true,inAppOnly:true}};}
  const crewProfiles=createCrewProfileService({store,clock});
  const practiceSync=createPracticeSyncService({store,clock});
  const computerInterpretation=createComputerInterpretationService({store,clock,getEnv:options.computerAIEnv,fetchImpl:options.computerAIFetch,customerAuthorized:user=>customerIdentity.isCurrentUser(user)});
  const customerDrafts=createCustomerComputerDraft({store,clock,authorized:user=>customerIdentity.isCurrentUser(user)});
  const customerRoutes=createCustomerRoutes({identity:customerIdentity,interpretation:computerInterpretation,drafts:customerDrafts,origin,send,body,stopping:()=>stopRequested});
  const demo=createDemoService({directory:options.demoDataDir??join(store.directory,'demo')});
  const assistant=createAssistantService({today:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(clock())),performance:assistantPerformance,directory:(req,query)=>messenger.assistantDirectory(req,query),productivity:(req,kind,query)=>messenger.productivityOverview(req,kind,query),clientWorkday:user=>clientWorkflow.workspace(user),publicationWorkday:user=>readPublicationWorkday(user),weeklySummary:user=>readWeeklySummary(user),automationHealth:user=>readAutomationHealth(user)});
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
  async function currentPushSession(userId,sessionHash){
    if(stopRequested)return null;
    if(userId.startsWith('pulse:')){
      const remembered=clientProjects.devices.current(sessionHash);
      if(remembered)return userId===`pulse:${remembered.row.id}:${remembered.row.inviteRevision}`;
      const stored=store.db.prepare("SELECT * FROM tokens WHERE hash=? AND purpose='pulse-session' AND expiresAt>?").get(sessionHash,now());
      if(!stored)return false;
      const body=JSON.parse(stored.body),row=store.get('clientProjects',body.projectId);
      return !!row&&row.stage!=='archived'&&!!row.inviteHash&&row.inviteRevision===body.inviteRevision&&Date.parse(row.inviteExpiresAt)>Date.parse(clock())&&userId===`pulse:${row.id}:${row.inviteRevision}`;
    }
    if(userId.startsWith('pulse-staff:'))userId=userId.slice('pulse-staff:'.length);
    const read=()=>{
      const stored=store.db.prepare("SELECT * FROM tokens WHERE hash=? AND purpose='session' AND userId=? AND expiresAt>?").get(sessionHash,userId,now());
      const user=stored&&store.get('users',userId);
      return user?.active?{...stored,body:JSON.parse(stored.body),user}:null;
    };
    const row=read();if(!row)return false;
    let valid;try{valid=await synkIdentity.validateSession(row);}catch{return null;}
    if(stopRequested)return null;
    if(valid!==true)return valid===false?false:null;
    const latest=read();return !!latest&&synkIdentity.sessionAllowed(latest);
  }
  function setSession(res,user,extra={}){const csrfToken=token(),value=store.mint('session',user.id,{csrfToken,...extra},7*24*60),prior=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(prior?Array.isArray(prior)?prior:[prior]:[]),`synk_company_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${originUrl.protocol==='https:'?'; Secure':''}`]);return {user:publicUser(user),csrfToken,...(extra.synkIdentity?{sessionHash:hash(value)}:{})};}
  function setPulseCookie(res,name,value,seconds){
    const prior=res.getHeader('Set-Cookie'),cookie=`${name}=${value}; Path=/pulse; HttpOnly; SameSite=Strict; Max-Age=${seconds}${originUrl.protocol==='https:'?'; Secure':''}`;
    res.setHeader('Set-Cookie',[...(prior?Array.isArray(prior)?prior:[prior]:[]),cookie]);
  }
  function pulseDeviceCookie(res,raw,device){setPulseCookie(res,'synk_pulse_device',raw,Math.max(0,Math.floor((Date.parse(device.auth.expiresAt)-Date.parse(clock()))/1000)));}
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
      const hold=credentialHoldReason(live,c,credentials.connectedBy?store.get('users',credentials.connectedBy)||null:undefined);
      if(hold)throw Object.assign(httpError(hold[1]),{code:hold[0]});
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
    if(stopRequested||!backgroundJobsEnabled)return;
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
  function writeResponse(res,status,body,type='application/json; charset=utf-8'){res.writeHead(status,responseHeaders(type));res.end(type.startsWith('application/json')?JSON.stringify(body):body);}
  function send(res,status,body,type='application/json; charset=utf-8'){messenger.disconnectRevoked();writeResponse(res,status,body,type);}
  async function body(req,{maxBytes=768000,maxChars=256000}={}){
    if(!req.headers['content-type']?.startsWith('application/json'))throw httpError('JSON 입력이 필요합니다.');
    const chunks=[];let bytes=0;
    for await(const part of req.iterator({destroyOnReturn:false})){bytes+=part.length;if(bytes>maxBytes){req.resume();throw httpError('입력이 너무 큽니다. 내용이나 항목 수를 줄여 주세요.',413);}chunks.push(part);}
    let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw httpError('UTF-8 JSON 입력을 확인해 주세요.');}
    if(raw.length>maxChars)throw httpError('입력이 너무 큽니다. 내용이나 항목 수를 줄여 주세요.',413);
    try{return JSON.parse(raw);}catch{throw httpError('입력 형식을 확인해 주세요.');}
  }
  const server=createServer(async(req,res)=>{try{
    if(req.headers.host!==originUrl.host&&!(options.allowTestHost&&req.headers.host?.startsWith('127.0.0.1:')))throw httpError('등록된 회사 주소로 접속해 주세요.',403);
    const url=new URL(req.url,origin),path=url.pathname,method=req.method;
    if(method==='GET'&&path==='/api/creative-research/time'){if(url.search)throw httpError('현재 시각 주소를 확인해 주세요.');return writeResponse(res,200,creativeResearchTime(clock()));}
    // WORLD teaching is a separate capability. Its cookie never creates or
    // substitutes the employee cookie used by the company APIs below.
    if(path.startsWith('/api/teaching/')){
      if(method==='GET'&&path==='/api/teaching/callback'){
        try{await teaching.callback(req,res,url);res.writeHead(302,{Location:'/?tab=teaching&teachingConnected=1','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();}
        catch(error){res.writeHead(302,{Location:'/?tab=teaching&teachingError='+encodeURIComponent(error.code||'TEACHING_AUTH_REQUIRED'),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();}
      }
      if(method==='GET'&&path==='/api/teaching/status')return send(res,200,await teaching.status(req,res));
      if(method==='POST'&&['/api/teaching/start','/api/teaching/cancel','/api/teaching/logout','/api/teaching/request'].includes(path)){
        const input=await body(req,{maxBytes:40000,maxChars:12000});
        const operation=path.slice('/api/teaching/'.length);
        return send(res,200,operation==='request'?await teaching.request(req,input):await teaching[operation](req,res));
      }
      throw httpError('수업 요청을 찾을 수 없습니다.',404);
    }
    // Customer capabilities never create a staff session or grant workspace access.
    if(path.startsWith('/pulse/api/')){
      const deviceToken=(req.headers.cookie||'').match(/(?:^|;\s*)synk_pulse_device=([A-Za-z0-9_-]+)/)?.[1];
      let customerToken=(req.headers.cookie||'').match(/(?:^|;\s*)synk_pulse_session=([A-Za-z0-9_-]+)/)?.[1];
      // Recover the short editing session from a separately consented device.
      // Invalid POST origins must not refresh any capability or cookie.
      if(path!=='/pulse/api/open'&&(method==='GET'||method==='HEAD'||req.headers.origin===origin)){
        try{clientProjects.session(customerToken);}catch(error){
          if(error.status!==401)throw error;
          const recovered=clientProjects.devices.resume(deviceToken);
          if(recovered){customerToken=recovered.raw;setPulseCookie(res,'synk_pulse_session',customerToken,43200);}
        }
      }
      const renewCustomerDevice=()=>{
        const {auth}=clientProjects.session(customerToken),device=clientProjects.devices.read(deviceToken);
        if(device&&auth.body.deviceHash===device.auth.hash){const renewed=clientProjects.devices.touch(deviceToken);pulseDeviceCookie(res,deviceToken,renewed);}
      };
      if(path==='/pulse/api/device-notifications'||path.startsWith('/pulse/api/device-notifications/')){
        if(url.search)throw httpError('고객 기기 알림 주소를 확인해 주세요.');
        const original=clientProjects.session(customerToken),principal=`pulse:${original.row.id}:${original.row.inviteRevision}`;
        const recheck=()=>{const current=clientProjects.session(customerToken);if(current.auth.hash!==original.auth.hash)throw httpError('고객 화면을 다시 열어 주세요.',401);return current;};
        const device=clientProjects.devices.current(original.auth.body.deviceHash),pushHash=device?.auth.hash||original.auth.hash;
        const provenDevice=device&&clientProjects.devices.read(deviceToken)?.auth.hash===device.auth.hash?device:null;
        if(method==='GET'&&path==='/pulse/api/device-notifications'){const result=await deviceNotifications.state(principal,pushHash);const current=recheck();return send(res,200,{...result,deviceConnection:clientProjects.devices.describe(provenDevice),sessionExpiresAt:current.auth.expiresAt,inviteExpiresAt:current.row.inviteExpiresAt});}
        const removeId=/^\/pulse\/api\/device-notifications\/([a-f0-9-]{36})$/.exec(path)?.[1];
        if(!(method==='POST'&&path==='/pulse/api/device-notifications'||method==='DELETE'&&removeId))throw httpError('고객 기기 알림 요청을 확인해 주세요.',405);
        if(req.headers.origin!==origin||req.headers['x-pulse-csrf']!==original.auth.body.csrf)throw httpError('고객 화면에서 기기 알림을 설정해 주세요.',403);
        const input=method==='POST'?await body(req):null;recheck();
        if(method==='POST'){
          const remembered=clientProjects.devices.remember(original,deviceToken);
          try{
            const result=await deviceNotifications.register(principal,remembered.device.auth.hash,input);recheck();
            clientProjects.devices.bind(original,remembered.device);const currentDevice=clientProjects.devices.touch(remembered.raw);
            if(device&&device.auth.hash!==currentDevice.auth.hash){clientProjects.devices.forget(device.auth.hash);await deviceNotifications.revokeSession(device.auth.hash);}
            pulseDeviceCookie(res,remembered.raw,currentDevice);
            return send(res,201,{...result,deviceConnection:clientProjects.devices.describe(currentDevice)});
          }catch(error){if(remembered.created){clientProjects.devices.forget(remembered.device.auth.hash);await deviceNotifications.revokeSession(remembered.device.auth.hash);}throw error;}
        }
        const removed=store.db.prepare('SELECT session_hash FROM web_push_subscriptions WHERE user_id=? AND id=?').get(principal,removeId);
        const result=await deviceNotifications.remove(principal,removeId);recheck();
        if(removed&&clientProjects.devices.current(removed.session_hash)){
          clientProjects.devices.forget(removed.session_hash,{keepSessionHash:removed.session_hash===pushHash?original.auth.hash:null});
          await deviceNotifications.revokeSession(removed.session_hash);
          if(removed.session_hash===pushHash)setPulseCookie(res,'synk_pulse_device','',0);
        }
        return send(res,200,result);
      }
      if(method==='POST'){
        if(req.headers.origin!==origin)throw httpError('고객 라운지에서 요청해 주세요.',403);
        if(path==='/pulse/api/notifications/read'){if(url.search)throw httpError('고객 알림 주소를 확인해 주세요.');const input=await body(req,{maxBytes:150000,maxChars:100000});return send(res,200,pulseLive.customerRead(customerToken,req.headers['x-pulse-csrf'],input));}
        if(path==='/pulse/api/studio/media'){
          const csrf=req.headers['x-pulse-csrf'],revision=Number(req.headers['x-project-revision']);let upload;
          try{pulseStudio.assertCustomerUpload(customerToken,csrf,revision);upload=await receiveStudioMedia(req,store.directory,{allowAudio:true});pulseStudio.assertCustomerUpload(customerToken,csrf,revision);await commitStudioMedia(upload,store.directory);const result=pulseStudio.customerUpload(customerToken,csrf,revision,upload.metadata);upload=null;renewCustomerDevice();return send(res,201,result);}catch(error){await discardStudioMedia(upload,store.directory);throw error;}
        }
        const input=await body(req,{maxBytes:40000,maxChars:12000});
        if(path==='/pulse/api/open'){
          const release=pulseAttempts.reserve(clientAddress(req));
          const result=clientProjects.open(input.invite);release();
          const previous=clientProjects.devices.read(deviceToken),opened=clientProjects.session(result.session);
          if(previous&&previous.row.id===opened.row.id&&previous.row.inviteRevision===opened.row.inviteRevision)clientProjects.devices.bind(opened,previous);
          else if(deviceToken){if(previous){clientProjects.devices.forget(previous.auth.hash);await deviceNotifications.revokeSession(previous.auth.hash);}setPulseCookie(res,'synk_pulse_device','',0);}
          setPulseCookie(res,'synk_pulse_session',result.session,43200);
          return send(res,200,pulseStudio.customerState(result.session));
        }
        if(path==='/pulse/api/action'){const result=pulseStudio.customerAction(customerToken,req.headers['x-pulse-csrf'],input);renewCustomerDevice();return send(res,200,result);}
        if(path==='/pulse/api/studio'){const result=pulseStudio.customerMutate(customerToken,req.headers['x-pulse-csrf'],input);renewCustomerDevice();return send(res,200,result);}
        if(path==='/pulse/api/logout'){const {auth}=clientProjects.session(customerToken);if(req.headers['x-pulse-csrf']!==auth.body.csrf)throw httpError('고객 화면을 다시 열어 주세요.',403);store.db.prepare('DELETE FROM tokens WHERE hash=?').run(auth.hash);await deviceNotifications.revokeSession(auth.hash);if(auth.body.deviceHash){clientProjects.devices.forget(auth.body.deviceHash);await deviceNotifications.revokeSession(auth.body.deviceHash);}setPulseCookie(res,'synk_pulse_session','',0);setPulseCookie(res,'synk_pulse_device','',0);return send(res,200,{ok:true});}
      }
      if(method==='GET'&&['/pulse/api/live','/pulse/api/events'].includes(path)){
        if(url.search||req.headers['x-synk-demo']==='1')throw httpError('실제 고객 알림 주소를 확인해 주세요.');
        const {auth}=clientProjects.session(customerToken);
        if(path==='/pulse/api/live')return send(res,200,pulseLive.customerState(customerToken));
        pulseEventAuth.set(req,{customerToken,hash:auth.hash});return pulseLiveEvents.connect(req,res);
      }
      if(method==='GET'&&['/pulse/api/project','/pulse/api/studio'].includes(path)){
        const state=pulseStudio.customerState(customerToken);
        if(req.headers['x-pulse-active']==='1')renewCustomerDevice();
        return send(res,200,state);
      }
      const studioMedia=path.match(/^\/pulse\/api\/studio\/media\/([a-f0-9-]{36})$/);
      if(['GET','HEAD'].includes(method)&&studioMedia)return await serveStudioMedia(req,res,store.directory,pulseStudio.customerMedia(customerToken,studioMedia[1]),()=>pulseStudio.customerMedia(customerToken,studioMedia[1]));
      const media=path.match(/^\/pulse\/api\/media\/([a-f0-9-]{36})$/);
      if(['GET','HEAD'].includes(method)&&media)return await serveDeliveryMedia(req,res,store.directory,clientProjects.customerMedia(customerToken,media[1]),()=>clientProjects.customerMedia(customerToken,media[1]));
      throw httpError('고객 요청을 찾을 수 없습니다.',404);
    }
    const demoRequest=path==='/api/demo'||path.startsWith('/api/demo/')||req.headers['x-synk-demo']==='1'||url.searchParams.get('demo')==='1';
    if(demoRequest&&!['GET','HEAD'].includes(method)&&path!=='/api/logout')throw httpError('데모 화면에서는 조회만 가능합니다. 실제 화면으로 돌아가 변경해 주세요.',403);
    if(path.startsWith('/social-publish-media/')&&await socialPublishMedia.handle(req,res,{url,signal:socialAbort.signal}))return;
    if(await socialPublicRoutes(req,res,{url}))return;
    if(await customerRoutes(req,res,url))return;
    const identityControl=['/api/logout','/api/synk-id/renew','/api/synk-id/status'].includes(path);
    if(!identityControl&&(path.startsWith('/api/')||path.startsWith('/messenger/api/'))){const current=rawSession(req);if(current)await synkIdentity.validateSession(current);}
    if(method==='GET'&&path==='/api/synk-id/callback'){
      try{await synkIdentity.callback(req,res,url,()=>session(req),setSession);res.writeHead(302,{Location:'/?tab=messenger&synkConnected=1','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();}
      catch(error){res.writeHead(302,{Location:'/?tab=messenger&synkError='+encodeURIComponent(error.code||'SYNK_LOGIN_FAILED'),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();}
    }
    if(path==='/messenger'){if(!['GET','HEAD'].includes(method))throw httpError('메신저 주소를 확인해 주세요.',405);res.writeHead(302,{Location:'/messenger/'});return res.end();}
    if(path==='/pulse-app'){if(!['GET','HEAD'].includes(method))throw httpError('PULSE 주소를 확인해 주세요.',405);res.writeHead(302,{Location:'/pulse-app/'+url.search});return res.end();}
    if(path.startsWith('/messenger/'))return await messenger.handler(req,res);
    if(method==='GET'&&path==='/api/health')return send(res,ready?200:503,{ok:ready,app:'synk-company',version:1,workspaceIntegration:true,ready});
    let auth=identityControl?rawSession(req):session(req),user=auth?.user;
    if(method==='GET'&&path==='/api/synk-id/status')return send(res,200,synkIdentity.status(auth));
    if(method==='GET'&&path==='/api/me')return send(res,200,{user:publicUser(user),csrfToken:auth?.body.csrfToken,synkUserId:auth?.body.synkIdentity||null,needsSetup:store.all('users').length===0,platformUrl});
    if(path.startsWith('/api/social/')){await socialRoutes(req,res,{url,demoRequest});return;}
    if(path==='/api/client-search'){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('프로젝트 검색 주소를 확인해 주세요.');
      if(method!=='POST')throw httpError('프로젝트 검색 요청을 확인해 주세요.',405);
      if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      const input=await body(req,{maxBytes:6000,maxChars:2500}),latest=session(req);
      if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
      if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      return send(res,200,clientSearch.search(latest.user,input));
    }
    const replyTemplatesRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/reply-templates$/);
    if(replyTemplatesRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('내 답변 양식 주소를 확인해 주세요.');
      if(method==='GET'){if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('내 답변 양식 조회 주소를 확인해 주세요.');return send(res,200,clientReplyTemplates.workspace(user,replyTemplatesRoute[1]));}
      if(method==='POST'){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:40000,maxChars:40000}),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        return send(res,200,clientReplyTemplates.mutate(latest.user,replyTemplatesRoute[1],input));
      }
      throw httpError('내 답변 양식 요청을 확인해 주세요.',405);
    }
    const materialUsageRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/material-usage$/);
    if(materialUsageRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('자료 사용 구분 주소를 확인해 주세요.');
      if(method==='GET'){
        if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('자료 사용 구분 조회 주소를 확인해 주세요.');
        return send(res,200,clientMaterialUsage.workspace(user,materialUsageRoute[1]));
      }
      if(method==='POST'){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:2048,maxChars:1200}),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const result=clientMaterialUsage.save(latest.user,materialUsageRoute[1],input);
        messenger.notifyCompanyUsers([...new Set([latest.user.id,clientProjects.project(latest.user,materialUsageRoute[1]).ownerId].filter(Boolean))]);
        return send(res,200,result);
      }
      throw httpError('자료 사용 구분 요청을 확인해 주세요.',405);
    }
    const clientRightsRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/rights$/);
    if(clientRightsRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('자료 사용조건 확인 주소를 확인해 주세요.');
      if(method==='GET'){if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('자료 사용조건 조회 주소를 확인해 주세요.');return send(res,200,clientRights.workspace(user,clientRightsRoute[1]));}
      if(method==='POST'){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:40000,maxChars:14000}),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const result=clientRights.save(latest.user,clientRightsRoute[1],input);messenger.notifyCompanyUsers([...new Set([latest.user.id,clientProjects.project(latest.user,clientRightsRoute[1]).ownerId].filter(Boolean))]);return send(res,200,result);
      }
      throw httpError('자료 사용조건 요청을 확인해 주세요.',405);
    }
    const deliveryArchiveRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/delivery-archive$/);
    if(deliveryArchiveRoute){
      // Native form downloads stream straight to the browser's download manager.
      // Only this read-only endpoint accepts a bounded form CSRF token.
      const formRequest=req.headers['content-type']?.split(';')[0]==='application/x-www-form-urlencoded';
      try{
        if(!auth)throw httpError('먼저 로그인해 주세요.',401);
        if(demoRequest||url.search)throw httpError('납품 파일 묶음 주소를 확인해 주세요.');
        const projectId=deliveryArchiveRoute[1];
        const authorize=()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.project(latest.user,projectId);return latest.user;};
        if(method==='GET'){
          if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('납품 파일 조회 주소를 확인해 주세요.');
          return send(res,200,await clientDeliveryArchive.prepare(authorize(),projectId,{authorize}));
        }
        if(method!=='POST')throw httpError('납품 파일 내려받기 요청을 확인해 주세요.',405);
        // Native forms under no-referrer may send Origin: null. Require browser
        // same-origin fetch metadata and the session CSRF token for that case.
        const sameOriginForm=formRequest&&req.headers.origin==='null'&&req.headers['sec-fetch-site']==='same-origin';
        if(req.headers.origin!==origin&&!sameOriginForm)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        let input;
        if(formRequest){
          const chunks=[];let bytes=0;
          for await(const part of req.iterator({destroyOnReturn:false})){bytes+=part.length;if(bytes>1024){req.resume();throw httpError('내려받기 입력이 너무 큽니다.',413);}chunks.push(part);}
          let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw httpError('내려받기 입력을 확인해 주세요.');}
          const params=new URLSearchParams(raw),keys=[...params.keys()];
          if(new Set(keys).size!==keys.length||keys.length!==2||keys.some(key=>!['fingerprint','csrfToken'].includes(key)))throw httpError('내려받기 입력을 확인해 주세요.');
          input=Object.fromEntries(params);
        }else input=await body(req,{maxBytes:512,maxChars:256});
        const actor=authorize(),current=session(req);
        if((formRequest?input.csrfToken:req.headers['x-csrf-token'])!==current.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!(formRequest?['fingerprint','csrfToken']:['fingerprint']).includes(key))||!/^[a-f0-9]{64}$/.test(input.fingerprint||''))throw httpError('내려받을 파일을 다시 확인해 주세요.');
        if(deliveryArchiveActive.has(user.id))throw httpError('이미 납품 파일을 내려받고 있습니다. 다운로드가 끝난 뒤 다시 눌러 주세요.',429);
        deliveryArchiveActive.add(user.id);
        let archive;
        const abort=()=>archive?.stream.destroy();res.once('close',abort);
        try{
          archive=await clientDeliveryArchive.download(actor,projectId,{fingerprint:input.fingerprint,authorize});
          if(res.destroyed){archive.stream.destroy();return;}
          authorize();
          const headers={...responseHeaders('application/zip'),'Content-Length':archive.contentLength,'Content-Disposition':`attachment; filename="synk-final-delivery.zip"; filename*=UTF-8''${encodeURIComponent(archive.fileName).replace(/'/g,'%27')}`};
          res.writeHead(200,headers);
          await pipeline(archive.stream,res);return;
        }finally{res.off('close',abort);archive?.stream.destroy();deliveryArchiveActive.delete(user.id);}
      }catch(error){
        if(!formRequest||res.headersSent)throw error;
        const failure=publicRequestError(error,{production}),headers=responseHeaders('application/json; charset=utf-8');
        headers['X-Frame-Options']='SAMEORIGIN';headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'");
        res.writeHead(failure.status,headers);return res.end(JSON.stringify({error:safeError(failure.message),status:failure.status}));
      }
    }
    const completionRecordsRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/completion-records$/);
    if(completionRecordsRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('완료 기록 주소를 확인해 주세요.');
      const projectId=completionRecordsRoute[1];
      if(method==='GET'){
        if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('완료 기록 조회 주소를 확인해 주세요.');
        return send(res,200,clientCompletionRecords.prepare(user,projectId));
      }
      if(method!=='POST')throw httpError('완료 기록 요청을 확인해 주세요.',405);
      if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      const input=await body(req,{maxBytes:1500,maxChars:500}),latest=session(req);
      if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
      if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['format','fingerprint'].includes(key))||!['pdf','csv'].includes(input.format)||!/^[a-f0-9]{64}$/.test(input.fingerprint||''))throw httpError('파일 형식과 확인한 기록을 다시 선택해 주세요.');
      if(completionRecordsActive.has(user.id))throw httpError('이미 기록 파일을 준비하고 있습니다. 잠시 뒤 다시 시도해 주세요.',429);
      const report=clientCompletionRecords.prepare(latest.user,projectId);
      if(report.fingerprint!==input.fingerprint)throw httpError('기록이 바뀌었습니다. 최신 기록을 다시 확인한 뒤 내려받아 주세요.',409);
      completionRecordsActive.add(user.id);
      const controller=new AbortController(),abort=()=>controller.abort();res.once('close',abort);
      try{
        const bytes=await completionRecordsRenderer[input.format](report,{signal:controller.signal});
        if(controller.signal.aborted)return;
        const current=session(req);
        if(!current||current.hash!==auth.hash||current.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==current.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        if(clientCompletionRecords.prepare(current.user,projectId).fingerprint!==input.fingerprint)throw httpError('파일 준비 중 기록이 바뀌었습니다. 최신 기록을 다시 확인해 주세요.',409);
        if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>64*1024*1024)throw httpError('기록 파일 크기를 확인하지 못했습니다.',413);
        const date=new Date(new Date(report.generatedAt).getTime()+9*3600000).toISOString().slice(0,10);
        const filename='SYNK_'+report.title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').slice(0,70)+'_기록_'+date+'.'+input.format;
        res.writeHead(200,{...responseHeaders(input.format==='pdf'?'application/pdf':'text/csv; charset=utf-8'),'Content-Length':bytes.length,'Content-Disposition':`attachment; filename="synk-project-records.${input.format}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g,'%27')}`});
        return res.end(bytes);
      }finally{res.off('close',abort);completionRecordsActive.delete(user.id);}
    }
    const startupTemplatesRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/startup-templates$/);
    if(startupTemplatesRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('내 시작 양식 주소를 확인해 주세요.');
      if(method==='GET'){if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('내 시작 양식 조회 주소를 확인해 주세요.');return send(res,200,clientStartupTemplates.workspace(user,startupTemplatesRoute[1]));}
      if(method==='POST'){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:220000,maxChars:80000}),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        return send(res,200,clientStartupTemplates.mutate(latest.user,startupTemplatesRoute[1],input));
      }
      throw httpError('내 시작 양식 요청을 확인해 주세요.',405);
    }
    const clientDraftRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/drafts(?:\/(project|message|follow-up|progress))?$/);
    if(clientDraftRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('개인 초안 주소를 확인해 주세요.');
      if(method==='GET'&&!clientDraftRoute[2]){if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('개인 초안 조회 주소를 확인해 주세요.');return send(res,200,clientDrafts.list(user,clientDraftRoute[1]));}
      if(method==='POST'&&clientDraftRoute[2]){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:128000,maxChars:40000}),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        try{return send(res,200,clientDrafts.mutate(latest.user,clientDraftRoute[1],clientDraftRoute[2],input));}
        catch(error){if(error.status===409&&error.code==='CLIENT_DRAFT_CONFLICT')return send(res,409,{error:safeError(error.message),code:error.code,current:error.current});throw error;}
      }
      throw httpError('개인 초안 요청을 확인해 주세요.',405);
    }
    const projectNewsRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/news(?:\/(read))?$/);
    if(projectNewsRoute){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('프로젝트 새 소식 주소를 확인해 주세요.');
      if(method==='GET'&&!projectNewsRoute[2])return send(res,200,clientNotifications.projectNews(user,projectNewsRoute[1]));
      if(method==='POST'&&projectNewsRoute[2]==='read'){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:8000,maxChars:4000}),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        if(req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        return send(res,200,clientNotifications.readProjectNews(latest.user,projectNewsRoute[1],input));
      }
      throw httpError('프로젝트 새 소식 요청을 확인해 주세요.',405);
    }
    if(['/api/pulse-live','/api/pulse-events','/api/pulse-notifications/read'].includes(path)){
      if(!auth)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest||url.search)throw httpError('실제 PULSE 알림 주소를 확인해 주세요.');
      if(method==='GET'&&path==='/api/pulse-live')return send(res,200,pulseLive.staffState(user));
      if(method==='GET'&&path==='/api/pulse-events'){pulseEventAuth.set(req,{hash:auth.hash,userId:user.id});return pulseLiveEvents.connect(req,res);}
      if(method==='POST'&&path==='/api/pulse-notifications/read'){
        if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
        const input=await body(req,{maxBytes:150000,maxChars:100000}),latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        return send(res,200,pulseLive.staffRead(latest.user,input));
      }
      throw httpError('PULSE 알림 요청을 확인해 주세요.',405);
    }
    if(['/api/device-notifications','/api/pulse-device-notifications'].some(base=>path===base||path.startsWith(base+'/'))){
      if(!auth)throw httpError('회사 계정으로 로그인해 주세요.',401);
      if(url.search)throw httpError('기기 알림 주소를 확인해 주세요.');
      const originalHash=auth.hash,originalUserId=user.id,deviceBase=path.startsWith('/api/pulse-device-notifications')?'/api/pulse-device-notifications':'/api/device-notifications',principal=deviceBase==='/api/pulse-device-notifications'?'pulse-staff:'+user.id:user.id;
      const recheck=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash||latest.user.id!==originalUserId)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return latest;};
      if(method==='GET'&&path===deviceBase){
        const result=await deviceNotifications.state(principal,auth.hash);recheck();return send(res,200,result);
      }
      const removeId=/^\/api\/(?:pulse-)?device-notifications\/([a-f0-9-]{36})$/.exec(path)?.[1];
      if(!(method==='POST'&&path===deviceBase||method==='DELETE'&&removeId))throw httpError('기기 알림 요청을 확인해 주세요.',405);
      if(req.headers.origin!==origin||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      const input=method==='POST'?await body(req):null;
      auth=recheck();if(req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('로그인 상태를 다시 확인해 주세요.',403);
      const result=method==='POST'?await deviceNotifications.register(principal,auth.hash,input):await deviceNotifications.remove(principal,removeId);
      recheck();return send(res,method==='POST'?201:200,result);
    }
    if(method==='GET'&&path==='/api/computer-interpretation'){if(url.search)throw httpError('AI 상담 상태 주소를 확인해 주세요.');return send(res,200,computerInterpretation.state(user));}
    if(method==='POST'&&['/api/synk-id/challenge','/api/synk-id/start','/api/synk-id/exchange','/api/synk-id/renew'].includes(path)){
      const input=await body(req);auth=identityControl?rawSession(req):session(req);
      if(path.endsWith('/challenge'))return send(res,200,await synkIdentity.challenge(req,res,input,auth,()=>session(req)));
      if(path.endsWith('/start'))return send(res,200,await synkIdentity.start(req,res,input,auth,()=>session(req)));
      if(path.endsWith('/exchange'))return send(res,200,await synkIdentity.exchange(req,res,input,()=>session(req),setSession));
      return send(res,200,await synkIdentity.renew(req,input,()=>rawSession(req)));
    }
    if(method==='POST'){
      if(req.headers.origin!==origin)throw httpError('회사 프로그램 화면에서 요청해 주세요.',403);
      const unauth=['/api/setup','/api/login','/api/join','/api/launch'];
      if(!unauth.includes(path)&&(!auth||req.headers['x-csrf-token']!==auth.body.csrfToken))throw httpError('로그인 상태를 다시 확인해 주세요.',403);
      const studioUpload=path.match(/^\/api\/studio-productions\/([^/]+)\/media$/);
      const clientUpload=path.match(/^\/api\/client-projects\/([^/]+)\/media$/);
      const pulseStudioUpload=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/studio\/media$/);
      if(pulseStudioUpload){
        const projectId=pulseStudioUpload[1],revision=Number(req.headers['x-project-revision']),originalHash=auth.hash;let upload;
        const recheck=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);pulseStudio.assertStaffUpload(latest.user,projectId,revision);return latest.user;};
        try{recheck();upload=await receiveStudioMedia(req,store.directory,{allowAudio:true});recheck();await commitStudioMedia(upload,store.directory);const result=pulseStudio.staffUpload(recheck(),projectId,revision,upload.metadata);upload=null;return send(res,201,result);}catch(error){await discardStudioMedia(upload,store.directory);throw error;}
      }
      const deliveryUpload=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/delivery\/media$/);
      if(deliveryUpload){
        let label;try{label=decodeURIComponent(req.headers['x-version-label']||'');}catch{throw httpError('파일 이름을 확인해 주세요.');}
        const originalHash=auth.hash,id=deliveryUpload[1],input={projectRevision:Number(req.headers['x-project-revision']),draftRevision:Number(req.headers['x-delivery-revision']),approvedPreviewId:req.headers['x-approved-preview-id'],requirementId:req.headers['x-requirement-id'],label,...(req.headers['x-deliverable-item-id']!==undefined?{deliverableItemId:req.headers['x-deliverable-item-id']}: {})};let upload;
        const recheck=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientDelivery.assertUpload(latest.user,id,input);return latest.user;};
        try{recheck();upload=await receiveDeliveryMedia(req,store.directory);recheck();await commitDeliveryMedia(upload,store.directory);const actor=recheck();clientDelivery.addUpload(actor,id,{...input,label:upload.label},upload.metadata);upload=null;const authorize=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.project(latest.user,id);};return send(res,201,await clientDelivery.refreshChecks(actor,id,{authorize}));}catch(error){await discardDeliveryMedia(upload,store.directory);throw error;}
      }
      if(clientUpload){
        const originalHash=auth.hash;let upload;
        try{clientProjects.project(user,clientUpload[1],true);upload=await receiveStudioMedia(req,store.directory,{maxLabelLength:120});let latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.project(latest.user,clientUpload[1],true);await commitStudioMedia(upload,store.directory);latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);let guide;try{guide=decodeURIComponent(req.headers['x-version-guide']||'');}catch{throw httpError('사용 안내를 확인해 주세요.');}const result=clientProjects.addVersion(latest.user,clientUpload[1],{revision:Number(req.headers['x-project-revision']),label:upload.label,kind:req.headers['x-version-kind'],guide},upload.metadata);upload=null;return send(res,201,result);}catch(error){await discardStudioMedia(upload,store.directory);throw error;}
      }
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
      const input=await body(req,path==='/api/workroom-practice/state'?{maxBytes:3001000,maxChars:1001000}:['/api/creative-research/import-report','/api/publication-packages'].includes(path)?{maxBytes:1048576,maxChars:1048576}:undefined);
      // Receiving a request body yields control. Revalidate revoked sessions and current roles afterward.
      if(!unauth.includes(path)){auth=identityControl?rawSession(req):session(req);user=auth?.user;if(!user||req.headers['x-csrf-token']!==auth.body.csrfToken)throw httpError('로그인 상태를 다시 확인해 주세요.',401);}
      if(path==='/api/publication-inbox/settings'||path==='/api/publication-inbox/scan'){
        if(demoRequest||!publicationInboxLocal)throw httpError('완성본 자동 가져오기는 로컬 작업실에서 사용할 수 있습니다.',403);
        const originalHash=auth.hash,authorize=()=>{const latest=session(req);if(stopRequested||!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return latest.user;};
        if(path.endsWith('/settings'))await publicationInbox.configure(user,input,{authorize});
        else await publicationInbox.scan({user,authorize});
        return send(res,200,publicationInbox.state(authorize()));
      }
      if(path==='/api/publication-packages'){
        if(demoRequest)throw httpError('게시 묶음은 실제 작업실에서 만들어 주세요.');
        const originalHash=auth.hash,authorize=()=>{const latest=session(req);if(stopRequested||!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return latest.user;};
        const result=await publicationPackages.create(user,input,{authorize});authorize();if(!result.reused)audit(user,'publication-package-created',result.package.id);if(publicationLinkSchedule)void scanPublicationLinks();return send(res,result.reused?200:201,result);
      }
      const publicationLinkCheck=path.match(/^\/api\/publication-links\/(package|post)\/([^/]+)$/);
      if(publicationLinkCheck){
        if(demoRequest)throw httpError('링크 확인은 실제 작업실에서 이용해 주세요.');
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw httpError('저장된 게시·자료 링크만 확인할 수 있습니다.');
        const originalHash=auth.hash,authorize=()=>{const latest=session(req);if(stopRequested||!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return latest.user;};
        const result=await publicationLinks.check(user,{kind:publicationLinkCheck[1],id:publicationLinkCheck[2]},{authorize,signal:publicationAbort.signal});authorize();return send(res,200,result);
      }
      const publicationReviewUpdate=path.match(/^\/api\/publication-packages\/([^/]+)\/review$/);
      if(publicationReviewUpdate){
        if(demoRequest)throw httpError('게시 전 점검은 실제 작업실에서 이용해 주세요.');
        const result=publicationReview.update(user,publicationReviewUpdate[1],input);audit(user,'publication-review-updated',publicationReviewUpdate[1]);return send(res,200,result);
      }
      const publicationLearningPlan=path.match(/^\/api\/publication-learning\/([a-f0-9]{64})\/plan$/i);
      if(publicationLearningPlan){
        if(demoRequest)throw httpError('성과에서 기획하기는 실제 작업실에서 이용해 주세요.');
        return send(res,200,publicationLearning.plan(user,publicationLearningPlan[1],input));
      }
      if(path==='/api/post-performance'){
        if(demoRequest)throw httpError('게시 성과는 실제 작업실에서 등록해 주세요.');
        if(input.publicationPackageId){
          const pack=publicationPackages.get(user,input.publicationPackageId).package,channel=channelFor(user,input.channelId,'write');
          const formats=(pack.channels||[]).filter(format=>format.startsWith(channel.platform==='youtube'?'youtube-':channel.platform==='instagram'?'instagram-':'unsupported-'));
          if(!formats.length)throw httpError('선택한 게시 묶음에는 이 계정의 플랫폼용 영상이 없습니다.');
          if(input.publicationFormat&&!formats.includes(input.publicationFormat))throw httpError('게시 묶음과 계정에 맞는 영상 형식을 선택해 주세요.');
          if(!input.publicationFormat&&formats.length>1)throw httpError('같은 플랫폼의 영상 형식이 여러 개입니다. 실제 게시한 영상 형식을 선택해 주세요.');
          input.publicationFormat=input.publicationFormat||formats[0];
        }else if(input.publicationFormat)throw httpError('영상 형식을 연결할 게시 묶음을 먼저 선택해 주세요.');
        const result=postPerformance.register(user,input);audit(user,'post-performance-registered',result.entry.id);if(publicationLinkSchedule)void scanPublicationLinks();return send(res,result.existing?200:201,result);
      }
      const publicationCheckpoint=path.match(/^\/api\/post-performance\/([^/]+)\/checkpoints\/(24|72)$/);
      if(publicationCheckpoint){if(demoRequest)throw httpError('게시 성과는 실제 작업실에서 기록해 주세요.');return send(res,200,postPerformance.manualCheckpoint(user,publicationCheckpoint[1],Number(publicationCheckpoint[2]),input));}
      const publicationCollect=path.match(/^\/api\/post-performance\/([^/]+)\/collect$/);
      if(publicationCollect){
        if(demoRequest)throw httpError('게시 성과는 실제 작업실에서 확인해 주세요.');
        const originalHash=auth.hash,authorize=()=>{const latest=session(req);if(stopRequested||!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return latest.user;};await postPerformance.collectDue({user,entryId:publicationCollect[1],signal:publicationAbort.signal,authorize});return send(res,200,postPerformance.list(authorize()));
      }
      const publicationActive=path.match(/^\/api\/post-performance\/([^/]+)\/active$/);
      if(publicationActive){if(demoRequest)throw httpError('게시 성과는 실제 작업실에서 변경해 주세요.');return send(res,200,postPerformance.setActive(user,publicationActive[1],input.active));}
      const deliveryRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/delivery$/);
      if(deliveryRoute){const id=deliveryRoute[1],originalHash=auth.hash,authorize=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.project(latest.user,id);};await clientDelivery.refreshChecks(user,id,{authorize});clientDelivery.mutate(user,id,input);return send(res,200,await clientDelivery.refreshChecks(user,id,{authorize}));}
      const deliveryCheckRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/delivery\/check$/);
      if(deliveryCheckRoute){const id=deliveryCheckRoute[1],originalHash=auth.hash,authorize=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.project(latest.user,id,true);};return send(res,200,await clientDelivery.check(user,id,input,{authorize}));}
      const closeoutRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/closeout$/);
      if(closeoutRoute)return send(res,200,clientProjects.closeout(user,closeoutRoute[1],input));
      const kickoffRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/kickoff$/);
      if(kickoffRoute)return send(res,200,clientProjects.kickoff(user,kickoffRoute[1],input));
      const startupRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/startup$/);
      if(startupRoute)return send(res,200,clientStartup.mutate(user,startupRoute[1],input));
      const changesRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/changes$/);
      if(changesRoute)return send(res,200,clientProjects.changes(user,changesRoute[1],input));
      const sceneRequestsRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/scene-requests$/);
      if(sceneRequestsRoute)return send(res,200,clientProjects.sceneRequests(user,sceneRequestsRoute[1],input));
      const scheduleRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/schedule$/);
      if(scheduleRoute)return send(res,200,clientProjects.schedule(user,scheduleRoute[1],input));
      if(path==='/api/client-projects')return send(res,201,clientProjects.save(user,input));
      const pulseStudioRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/studio$/);
      if(pulseStudioRoute)return send(res,200,pulseStudio.staffMutate(user,pulseStudioRoute[1],input));
      if(path==='/api/client-workflow')return send(res,200,clientWorkflow.update(user,input));
      if(path==='/api/client-workflow/recheck')return send(res,200,clientWorkflow.recheck(user,input));
      const clientFollowUp=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/follow-up$/);
      if(clientFollowUp)return send(res,200,clientProjects.completeFollowUp(user,clientFollowUp[1],input));
      const clientRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})(?:\/(invite|revoke|versions|messages|resolve))?$/);
      if(clientRoute){const [,id,action]=clientRoute;return send(res,200,action==='invite'?clientProjects.invite(user,id,input):action==='revoke'?clientProjects.revoke(user,id,input):action==='versions'?clientProjects.addVersion(user,id,input):action==='messages'?clientProjects.message(user,id,input):action==='resolve'?clientProjects.resolveMessage(user,id,input.messageId,input):clientProjects.save(user,input,id));}
      if(path==='/api/client-intake/import'){
        admin(user);let prepared;
        try{
          const receipt=await clientIntake.read(input.receiptId);
          let latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);admin(latest.user);
          const existing=clientProjects.findImportedReceipt(latest.user,receipt.id);
          if(existing)return send(res,201,existing);
          prepared=await clientIntake.prepareFiles(receipt,store.directory);
          latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);admin(latest.user);
          const result=clientProjects.importReceipt(latest.user,prepared);
          if(result.existing){await discardIntakeFiles(prepared,store.directory);prepared=null;}else prepared=null;
          return send(res,201,result);
        }finally{await discardIntakeFiles(prepared,store.directory);}
      }
      const brandRoute=path.match(/^\/api\/brand-quality\/(recipes|operations)(?:\/([a-f0-9-]{36}))?$/);
      if(brandRoute)return send(res,brandRoute[2]?200:201,brandRoute[1]==='recipes'?brandQuality.saveRecipe(user,input,brandRoute[2]||null):brandQuality.saveOperation(user,input,brandRoute[2]||null));
      if(path==='/api/workroom-practice/state'){
        if(url.search)throw httpError('본인의 실습 계정 저장 주소만 사용할 수 있어요.');
        try{return send(res,200,practiceSync.mutate(user,input));}
        catch(error){if(error.status===409&&error.code?.startsWith('PRACTICE_'))return send(res,409,{error:safeError(error.message),code:error.code,current:error.current});throw error;}
      }
      if(path==='/api/daily-trends/settings'){admin(user);const result=dailyTrends.configure(input);audit(user,'daily-trends-settings','daily-trends',{settings:result.settings});return send(res,200,result);}
      if(path==='/api/daily-trends/collect'){
        admin(user);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>key!=='force')||input.force!==undefined&&typeof input.force!=='boolean')throw httpError('다시 수집 여부를 확인해 주세요.');
        if(stopRequested)throw httpError('서버가 종료 중입니다.',503);
        const alreadyRunning=dailyTrends.state().running;
        const result=await dailyTrends.collect({force:input.force??false,requestedBy:user.id});
        audit(user,'daily-trends-collect','daily-trends',{force:input.force??false,alreadyRunning});return send(res,200,result);
      }
      if(path==='/api/setup'){
        if(store.all('users').length)throw httpError('이미 회사가 설정되어 있습니다.',409);
        if(!store.readToken(input.setupToken,'setup'))throw httpError('관리자 시작 링크를 다시 열어 주세요.',403);
        const checkedHash=await passwordHashAsync(input.password);
        const u=store.transaction(()=>{if(store.all('users').length)throw httpError('이미 회사가 설정되어 있습니다.',409);if(!store.readToken(input.setupToken,'setup'))throw httpError('관리자 시작 링크를 다시 열어 주세요.',403);const created=store.createUser({...input,password:undefined,role:'admin'});const user=store.put('users',created.id,{...created,passwordHash:checkedHash});store.db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(input.setupToken));store.put('settings','company',{...store.get('settings','company'),companyName:text(input.companyName,80)||'SYNK'});return user;});
        return send(res,201,setSession(res,u));
      }
      if(path==='/api/launch'){const t=store.consume(input.token,'launch');const u=t&&store.get('users',t.userId);if(!u?.active||!isLocalHost(host))throw httpError('시작 링크가 만료됐습니다. 바탕화면 바로가기를 다시 열어 주세요.',403);return send(res,200,setSession(res,u));}
      if(path==='/api/login'){
        const email=text(input.email??input.username,254).toLowerCase(),ip=clientAddress(req),account=hash(email);
        const release=reserveAttempts([[loginPair,ip+':'+account],[loginIp,ip],[loginAccount,account],[loginGlobal,'all']]);
        let u;
        try{u=await loginWork(async()=>{
          let candidate=store.all('users').find(item=>item.email===email),expectedHash=candidate?.passwordHash;
          let valid=await passwordMatches(input.password,expectedHash);
          if(!candidate){const linkedId=await messenger.authenticateLinkedUsername(email,input.password);const linked=linkedId&&store.get('users',linkedId);if(linked?.active&&!linked.passwordHash){candidate=linked;expectedHash=linked.passwordHash;valid=true;}}
          const latest=candidate&&store.get('users',candidate.id);
          if(!latest?.active||!valid||latest.passwordHash!==expectedHash)throw httpError('이메일 또는 기존 메신저 아이디와 비밀번호를 확인해 주세요.',401);
          return latest;
        });}catch(error){if(error.status!==401)release();throw error;}
        release();return send(res,200,setSession(res,u));
      }
      if(path==='/api/join'){
        const invitation=store.readToken(input.token,'invite');if(!invitation)throw httpError('초대 링크가 만료됐거나 이미 사용됐습니다.',403);
        const checkedHash=await passwordHashAsync(input.password);const result=store.transaction(()=>{const inv=store.readToken(input.token,'invite');if(!inv)throw httpError('이미 사용된 초대입니다.',403);teamFor(inv.body.teamId);const u=store.createUser({email:inv.body.email,name:input.name||inv.body.name,role:inv.body.role||'member',teamId:inv.body.teamId||null});store.put('users',u.id,{...u,passwordHash:checkedHash});store.db.prepare('DELETE FROM tokens WHERE hash=?').run(hash(input.token));return store.get('users',u.id);});return send(res,201,setSession(res,result));
      }
      if(!user)throw httpError('먼저 로그인해 주세요.',401);
      if(path==='/api/computer-interpretation/delete'){
        if(url.search)throw httpError('본인의 서버 응답 인용만 삭제할 수 있어요.');
        return send(res,200,computerInterpretation.removeResponses(user,input));
      }
      if(path==='/api/computer-interpretation'){
        admin(user);if(url.search)throw httpError('AI 상담 요청 주소를 확인해 주세요.');
        const originalHash=auth.hash,originalUser=user.id;
        const revalidate=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash||latest.user.id!==originalUser||req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('로그인 상태를 다시 확인해 주세요.',401);admin(latest.user);};
        try{return send(res,200,await computerInterpretation.interpret(user,input,{revalidate}));}
        catch(error){
          if(error.code==='SYNK_COMPUTER_AI_RESPONSE_INVALID'&&error.captureReceipt){
            revalidate();
            const {version,id,requestId,revision,buildId,status}=error.captureReceipt;
            return send(res,error.status,{error:safeError(error.message),code:error.code,captureReceipt:{version,id,requestId,revision,buildId,status}});
          }
          throw error;
        }
      }
      if(path==='/api/assistant')return send(res,200,assistant.answer(user,input,req));
      if(path==='/api/crew-profile')return send(res,200,crewProfiles.save(user,input));
      if(path==='/api/crew-profile/delete')return send(res,200,crewProfiles.remove(user,input));
      if(path==='/api/crew-work/evaluate')return send(res,200,crewProfiles.evaluate(user,input));
      if(user.role==='viewer'&&!['/api/logout','/api/account/password'].includes(path))throw httpError('열람 계정은 기록을 변경하거나 수집할 수 없습니다.',403);
      if(path==='/api/logout'){await deviceNotifications.revokeSession(auth.hash);const result=synkIdentity.logout(auth.hash);res.setHeader('Set-Cookie','synk_company_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return send(res,200,await result);}
      if(path==='/api/account/password'){
        if(user.passwordHash&&!await passwordMatches(input.oldPassword,user.passwordHash))throw httpError('현재 비밀번호를 확인해 주세요.',403);
        const checkedHash=await passwordHashAsync(input.password),latest=session(req);
        if(!latest||latest.hash!==auth.hash||latest.user.id!==user.id||latest.user.passwordHash!==user.passwordHash||req.headers['x-csrf-token']!==latest.body.csrfToken)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        const changed={...latest.user,passwordHash:checkedHash};store.put('users',user.id,changed);store.revokeUser(user.id);return send(res,200,setSession(res,changed));
      }
      if(path==='/api/studio-productions'){const result=studio.saveProduction(user,input);audit(user,'studio-production-created',result.production.id);return send(res,201,result);}
      if(path==='/api/creator-reviews'){if(demoRequest)throw httpError('개인 점검은 실제 작업실에서 저장해 주세요.');const result=creatorReviews.save(user,input);audit(user,'creator-review-created',result.record.id);return send(res,201,result);}
      const creatorReviewRoute=path.match(/^\/api\/creator-reviews\/([^/]+)(?:\/(archive))?$/);
      if(creatorReviewRoute){if(demoRequest)throw httpError('개인 점검은 실제 작업실에서 저장해 주세요.');const result=creatorReviewRoute[2]?creatorReviews.archive(user,creatorReviewRoute[1],input):creatorReviews.save(user,input,creatorReviewRoute[1]);audit(user,creatorReviewRoute[2]?'creator-review-archived':'creator-review-updated',result.record.id);return send(res,200,result);}
      if(path==='/api/creative-research'){const result=creativeResearch.add(user,input);audit(user,'creative-research-created',result.entry.id);return send(res,201,result);}
      if(path==='/api/creative-research/import-report'){
        if(stopRequested)throw httpError('서버가 종료 중입니다.',503);
        const result=creativeResearch.importReport(user,input);
        if(!result.existing)audit(user,'creative-research-report-imported',result.report.id);
        return send(res,result.existing?200:201,{report:result.report,existing:result.existing});
      }
      if(path==='/api/creative-research/sync-settings'){
        admin(user);const result=creativeResearchSync.configure(user,input);
        audit(user,'creative-research-sync-configured','creative-research-sync');
        return send(res,200,result);
      }
      if(path==='/api/creative-research/sync-check'){
        admin(user);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw httpError('완료 결과 확인 요청을 확인해 주세요.');
        const originalHash=auth.hash;await creativeResearchSync.tick(clock(),{force:true});
        const latest=session(req);if(!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        admin(latest.user);return send(res,200,creativeResearchSync.state(latest.user));
      }
      if(['/api/creative-research/import','/api/creative-research/import-top-ad'].includes(path)){
        if(stopRequested)throw httpError('서버가 종료 중입니다.',503);
        const originalHash=auth.hash,result=await creativeResearch.importTopAd(user,input,{assertSession(){const latest=session(req);if(!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);}});
        audit(user,'creative-research-imported',result.entry.id);return send(res,201,result);
      }
      const creativeUsage=path.match(/^\/api\/creative-research\/([^/]+)\/(claim|release)$/);
      if(creativeUsage){const result=creativeResearch[creativeUsage[2]](user,creativeUsage[1],input);audit(user,'creative-research-'+creativeUsage[2],result.entry.id);return send(res,200,result);}
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
        if(cm[2]==='connection'){
          admin(user);
          if(['instagram','facebook'].includes(c.platform))await metaConnections.connect(user,c.id,input,{signal:socialAbort.signal,authorize:()=>{const current=session(req);if(!current||current.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return current.user;}});
          else{const allowed=['apiKey','accessToken','accountId','apiVersion','refreshToken','authType'];const creds=Object.fromEntries(allowed.filter(k=>input[k]).map(k=>[k,text(input[k],16000)]));if(!creds.accessToken&&!creds.apiKey)throw httpError('연결 정보를 입력해 주세요.');store.setSecret('channel:'+c.id,{...creds,connectedBy:user.id,connectedAt:now()});store.put('channels',c.id,{...c,status:'ready',lastError:null,collectionDisabled:false,failureKind:null,failureCode:null,retryCount:0,nextRetryAt:null,requiresReconnect:false,lastFailureAt:null,lastAttemptAt:null,...recentFields({status:'ready',failureKind:null,failureCode:null,retryCount:0,nextRetryAt:null,requiresReconnect:false,lastFailureAt:null,lastAttemptAt:null,lastError:null}),connectionVersion:(c.connectionVersion||0)+1});}
        }
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
      if(oauth[2]==='start'){
        const c=channelFor(user,url.searchParams.get('channelId'),'connect');if(c.platform!==platform)throw httpError('채널 플랫폼이 다릅니다.');const cfg=providerConfig(platform);if(!cfg.clientId||!cfg.clientSecret)throw httpError('관리자가 플랫폼 앱을 먼저 설정해야 합니다.');
        const meta=['instagram','facebook'].includes(platform),publishing=['instagram','facebook','youtube'].includes(platform)&&url.searchParams.get('publishing')==='1';
        const previous=connection(c),existingGrantedScopes=previous?.permissionsVerifiedAt&&typeof previous.scope==='string'?previous.scope.split(/[ ,]+/):[],inbox=store.get('socialInboxConnections',c.id);
        const preserveComments=publishing&&meta&&(inbox?.enabled===true||hasVerifiedMetaComments(c,previous)||Boolean(previous?.permissionsVerifiedAt)&&metaCommentScopes(platform,previous.authType).every(scope=>existingGrantedScopes.includes(scope)));
        const comments=meta&&(url.searchParams.get('comments')==='1'||preserveComments);
        const inboxBinding=publishing&&meta?{enabled:inbox?.enabled===true,version:inbox?.version||null,connectionVersion:inbox?.connectionVersion??null}:null;
        const state=store.mint('oauth',user.id,{channelId:c.id,sessionHash:hash(auth.raw),platform,comments,publishing,preserveComments,inboxBinding,connectionVersion:c.connectionVersion||0},10);
        const dest=createAuthorization(platform,{...cfg,state,comments,publishing,existingGrantedScopes});res.writeHead(302,{Location:dest,'Referrer-Policy':'no-referrer'});return res.end();
      }
      const state=store.consume(url.searchParams.get('state'),'oauth');if(!state||state.userId!==user.id||state.body.platform!==platform||state.body.sessionHash!==hash(auth.raw))throw httpError('연결 확인이 만료됐습니다. 다시 계정 연결을 눌러 주세요.',403);
      try{
        if(url.searchParams.has('error'))throw httpError('계정 연결이 취소됐습니다.');
        const c=channelFor(user,state.body.channelId,'connect');
        const cfg=providerConfig(platform),cfgPin=JSON.stringify(cfg),comments=state.body.comments===true,publishing=state.body.publishing===true;if(state.body.connectionVersion!=null&&state.body.connectionVersion!==(c.connectionVersion||0))throw httpError('계정 연결이 변경됐습니다. 다시 연결해 주세요.',409);
        const assertCurrent=()=>{const latest=session(req);if(!latest?.user?.active||latest.hash!==auth.hash)throw httpError('크루 로그인이 해제됐습니다.',401);const live=channelFor(latest.user,c.id,'connect');if(!live.active||(live.connectionVersion||0)!==(c.connectionVersion||0)||JSON.stringify(providerConfig(platform))!==cfgPin)throw httpError('계정 또는 앱 연결이 변경됐습니다. 다시 연결해 주세요.',409);if(state.body.inboxBinding){const inbox=store.get('socialInboxConnections',c.id),binding={enabled:inbox?.enabled===true,version:inbox?.version||null,connectionVersion:inbox?.connectionVersion??null};if(JSON.stringify(binding)!==JSON.stringify(state.body.inboxBinding))throw httpError('댓글 수집 설정이 변경됐습니다. 현재 설정을 확인하고 다시 연결해 주세요.',409);}if(stopRequested)throw httpError('서버가 종료 중입니다.',503);};
        assertCurrent();
        let creds=await exchangeCode(platform,{...cfg,code:url.searchParams.get('code')},{fetchImpl:options.oauthFetch});assertCurrent();
        let verified;
        if(['instagram','facebook'].includes(platform)){verified=await verifyMetaConnection({channel:c,credentials:creds,provider:cfg,purpose:publishing?'publishing':comments?'comments':'statistics',requireComments:publishing&&comments,fetchImpl:options.metaConnectionFetch,clock,signal:socialAbort.signal,authorize:assertCurrent,trustedExpiry:true,trustedGrant:true});creds=verified.credentials;}
        if(platform==='youtube'&&publishing){verified=await verifyYouTubePublishingConnection({channel:c,credentials:creds,fetchImpl:options.youtubeConnectionFetch,clock,signal:socialAbort.signal,authorize:assertCurrent});creds=verified.credentials;}
        const result=comments||publishing?null:await collector(c,{...cfg,...creds});assertCurrent();
        const externalId=verified?.identity.id||result.channel.externalId;
        const currentAuth=session(req),currentUser=currentAuth?.user;
        if(!currentUser?.active||currentAuth.raw!==auth.raw||currentUser.id!==user.id)throw httpError('크루 로그인이 해제됐습니다.');
        channelFor(currentUser,c.id,'connect');let live=store.get('channels',c.id);
        if(!live.active||(live.connectionVersion||0)!==(c.connectionVersion||0))throw httpError('채널이 변경됐습니다. 다시 연결해 주세요.');
        if(store.all('channels').some(x=>x.id!==c.id&&x.platform===c.platform&&x.externalId&&x.externalId===externalId))throw httpError('이 계정은 이미 회사에 등록되어 있습니다. 기존 채널에 담당자를 추가해 주세요.');
        const h=pending(live);
        if(h&&h.toOwnerIds.includes(user.id)){
          teamFor(h.toTeamId);if(h.toOwnerIds.some(id=>{const target=store.get('users',id);return !target?.active||target.role==='viewer';}))throw httpError('인계받을 담당자를 다시 확인해 주세요.');
        }
        const runId=randomUUID();
        store.transaction(()=>{
          assertCurrent();
          if(result)store.put('runs',runId,{id:runId,channelId:c.id,channelName:c.displayName,status:'running',startedAt:clock(),requestedBy:user.id});
          if(h&&h.toOwnerIds.includes(user.id))live=completeHandoff(live,currentUser);
          if(result)saveCollection(live,result,runId,true);
          store.setSecret('channel:'+c.id,{...creds,connectedBy:user.id,connectedAt:clock()});
          store.put('channels',c.id,{...store.get('channels',c.id),externalId,collectionDisabled:false,...((comments||publishing)?{status:'ready',lastError:null,requiresReconnect:false,failureKind:null,failureCode:null}:{}),connectionVersion:(live.connectionVersion||0)+1});
          if(publishing&&state.body.preserveComments&&state.body.inboxBinding?.enabled&&state.body.inboxBinding.connectionVersion===(c.connectionVersion||0)){
            const inbox=store.get('socialInboxConnections',c.id);store.put('socialInboxConnections',c.id,{...inbox,version:randomUUID(),connectionVersion:(live.connectionVersion||0)+1,updatedAt:clock(),progress:null,lastError:null,lastErrorCode:null});
          }
          audit(user,'oauth-connected',c.id);
        });res.writeHead(302,{Location:'/?connected='+encodeURIComponent(c.id)+(publishing?'&connectionPurpose=publishing':comments?'&connectionPurpose=comments':'')});return res.end();
      }catch(error){const failure=publicRequestError(error,{production});res.writeHead(302,{Location:'/?connectionError='+encodeURIComponent(safeError(failure.message))});return res.end();}
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
    const publicationDownload=path.match(/^\/api\/publication-packages\/([^/]+)\/download$/);
    if(['GET','HEAD'].includes(method)&&publicationDownload){
      if(!user)throw httpError('먼저 로그인해 주세요.',401);
      if(demoRequest)throw httpError('게시 묶음은 실제 작업실에서 확인해 주세요.');
      const originalHash=auth.hash,authorize=()=>{const latest=session(req);if(stopRequested||!latest||latest.hash!==originalHash||latest.user.id!==user.id)throw httpError('로그인 상태를 다시 확인해 주세요.',401);return latest.user;};
      const result=await publicationPackages.download(user,publicationDownload[1],{authorize});authorize();
      res.writeHead(200,{...responseHeaders(result.mimeType),'Cache-Control':'private, no-store','Content-Length':result.buffer.length,'Content-Disposition':`attachment; filename="synk-publication.zip"; filename*=UTF-8''${encodeURIComponent(result.fileName).replace(/'/g,'%27')}`});return res.end(method==='HEAD'?undefined:result.buffer);
    }
    const deliveryMediaRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/delivery\/media\/([a-f0-9-]{36})$/);
    if(['GET','HEAD'].includes(method)&&deliveryMediaRoute){if(!user)throw httpError('먼저 로그인해 주세요.',401);const [,projectId,mediaId]=deliveryMediaRoute;return await serveDeliveryMedia(req,res,store.directory,clientDelivery.mediaFor(user,projectId,mediaId),()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientDelivery.mediaFor(latest.user,projectId,mediaId);});}
    const intakeFileRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/intake-files\/([a-f0-9-]{36})$/);
    if(['GET','HEAD'].includes(method)&&intakeFileRoute){
      if(!user)throw httpError('먼저 로그인해 주세요.',401);
      const getFile=actor=>{const row=clientProjects.project(actor,intakeFileRoute[1]),file=row.intake?.files?.find(f=>f.id===intakeFileRoute[2]);if(!file)throw httpError('접수 자료를 찾을 수 없습니다.',404);return file;};
      return await serveIntakeFile(req,res,store.directory,getFile(user),()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);getFile(latest.user);});
    }
    const pulseStudioMediaRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/studio\/media\/([a-f0-9-]{36})$/);
    if(['GET','HEAD'].includes(method)&&pulseStudioMediaRoute){if(!user)throw httpError('먼저 로그인해 주세요.',401);const [,projectId,assetId]=pulseStudioMediaRoute;return await serveStudioMedia(req,res,store.directory,pulseStudio.staffMedia(user,projectId,assetId),()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);pulseStudio.staffMedia(latest.user,projectId,assetId);});}
    const clientMediaRoute=path.match(/^\/api\/client-media\/([a-f0-9-]{36})$/);
    if(['GET','HEAD'].includes(method)&&clientMediaRoute){if(!user)throw httpError('먼저 로그인해 주세요.',401);return await serveDeliveryMedia(req,res,store.directory,clientProjects.mediaFor(user,clientMediaRoute[1]),()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.mediaFor(latest.user,clientMediaRoute[1]);});}
    if(['GET','HEAD'].includes(method)&&studioMediaRoute){if(!user)throw httpError('먼저 로그인해 주세요.',401);return await serveStudioMedia(req,res,store.directory,studio.readableMedia(user,studioMediaRoute[1]),()=>{const latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);studio.readableMedia(latest.user,studioMediaRoute[1]);});}
    if(method==='GET'&&path.startsWith('/api/')){if(!user)throw httpError('먼저 로그인해 주세요.',401);
      if(path==='/api/automation-health'){
        if(demoRequest)throw httpError('자동화 상태는 실제 작업실에서 확인해 주세요.');
        if(url.search)throw httpError('내 자동화 상태만 확인할 수 있습니다.');
        return send(res,200,readAutomationHealth(user));
      }
      if(path==='/api/weekly-summary'){
        if(demoRequest)throw httpError('주간 정리는 실제 작업실에서 확인해 주세요.');
        if([...url.searchParams.keys()].some(key=>key!=='week')||url.searchParams.getAll('week').length>1)throw httpError('확인할 주만 선택해 주세요.');
        return send(res,200,readWeeklySummary(user,{week:url.searchParams.has('week')?url.searchParams.get('week'):undefined}));
      }
      if(path==='/api/publication-workspace'){
        if(demoRequest)throw httpError('게시 준비와 성과는 실제 작업실에서 확인해 주세요.');
        const originalHash=auth.hash,catalog=await publicationPackages.catalog(user),latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);
        return send(res,200,{studio:studio.workspace(latest.user),packages:publicationPackages.list(latest.user),catalog,performance:postPerformance.list(latest.user),inbox:publicationInbox.state(latest.user),learning:publicationLearning.workspace(latest.user)});
      }
      if(path==='/api/publication-learning'){
        if(demoRequest)throw httpError('성과에서 기획하기는 실제 작업실에서 이용해 주세요.');
        return send(res,200,publicationLearning.workspace(user));
      }
      if(path==='/api/publication-inbox'){
        if(demoRequest)throw httpError('완성본 자동 가져오기는 실제 작업실에서 확인해 주세요.');
        return send(res,200,publicationInbox.state(user));
      }
      const publicationInboxDraft=path.match(/^\/api\/publication-inbox\/([^/]+)\/draft$/);
      if(publicationInboxDraft){
        if(demoRequest||!publicationInboxLocal)throw httpError('완성본 자동 가져오기는 로컬 작업실에서 사용할 수 있습니다.',403);
        return send(res,200,publicationInbox.readDraft(user,publicationInboxDraft[1]));
      }
      if(path==='/api/post-performance'){if(demoRequest)throw httpError('게시 성과는 실제 작업실에서 확인해 주세요.');return send(res,200,postPerformance.list(user));}
      if(path==='/api/publication-packages'){if(demoRequest)throw httpError('게시 묶음은 실제 작업실에서 확인해 주세요.');return send(res,200,publicationPackages.list(user));}
      const publicationReviewDetail=path.match(/^\/api\/publication-packages\/([^/]+)\/review$/);
      if(publicationReviewDetail){if(demoRequest)throw httpError('게시 전 점검은 실제 작업실에서 확인해 주세요.');return send(res,200,publicationReview.get(user,publicationReviewDetail[1]));}
      const publicationLinkDetail=path.match(/^\/api\/publication-links\/(package|post)\/([^/]+)$/);
      if(publicationLinkDetail){if(demoRequest)throw httpError('링크 확인은 실제 작업실에서 이용해 주세요.');return send(res,200,publicationLinks.get(user,{kind:publicationLinkDetail[1],id:publicationLinkDetail[2]}));}
      const publicationDetail=path.match(/^\/api\/publication-packages\/([^/]+)$/);
      if(publicationDetail){if(demoRequest)throw httpError('게시 묶음은 실제 작업실에서 확인해 주세요.');return send(res,200,publicationPackages.get(user,publicationDetail[1]));}
      const deliveryRead=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/delivery$/);
      if(deliveryRead){const id=deliveryRead[1],originalHash=auth.hash,authorize=()=>{const latest=session(req);if(!latest||latest.hash!==originalHash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);clientProjects.project(latest.user,id);};return send(res,200,await clientDelivery.refreshChecks(user,id,{authorize}));}
      if(path==='/api/client-projects')return send(res,200,clientProjects.workspace(user));
    const startupRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/startup$/);
    if(startupRoute)return send(res,200,clientStartup.workspace(user,startupRoute[1]));
      const progressUpdateRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/progress-update$/);
      if(progressUpdateRoute)return send(res,200,clientProgressUpdate.workspace(user,progressUpdateRoute[1]));
      const materialsRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/materials$/);
      if(materialsRoute)return send(res,200,clientMaterials.workspace(user,materialsRoute[1]));
      const pulseStudioRoute=path.match(/^\/api\/client-projects\/([a-f0-9-]{36})\/studio$/);
      if(pulseStudioRoute)return send(res,200,pulseStudio.staffState(user,pulseStudioRoute[1]));
      if(path==='/api/client-workflow')return send(res,200,clientWorkflow.workspace(user));
      if(path==='/api/publication-workflow'){if(demoRequest)throw httpError('게시 할 일은 실제 작업실에서 확인해 주세요.');return send(res,200,readPublicationWorkday(user));}
      if(path==='/api/client-intake'){admin(user);const result=await clientIntake.list(),latest=session(req);if(!latest||latest.hash!==auth.hash)throw httpError('로그인 상태를 다시 확인해 주세요.',401);admin(latest.user);return send(res,200,result);}
      if(path==='/api/brand-quality')return send(res,200,brandQuality.workspace(user));
      if(path==='/api/workroom-practice/state'){
        if(url.search||req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)throw httpError('본인의 실습 계정 저장 주소만 사용할 수 있어요.');
        return send(res,200,practiceSync.read(user));
      }
      if(path==='/api/computer-interpretation/privacy'){
        if(url.search)throw httpError('본인의 서버 응답 인용만 조회할 수 있어요.');
        return send(res,200,computerInterpretation.privacy(user));
      }
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
      if(path==='/api/daily-trends'){if(demoRequest)throw httpError('일일 트렌드는 실제 작업실에서 확인해 주세요.',400);return send(res,200,{...dailyTrends.state({date:url.searchParams.has('date')?url.searchParams.get('date'):undefined}),schedulerEnabled:backgroundJobsEnabled&&options.schedule!==false&&!stopRequested});}
      if(path==='/api/creative-research/sync-status'){if(demoRequest||url.search)throw httpError('실제 작업실의 자동 반영 상태 주소를 확인해 주세요.');creativeResearch.revision(user);return send(res,200,creativeResearchSync.state(user));}
      if(path==='/api/creative-research/revision'){if(demoRequest||url.search)throw httpError('실제 작업실의 자료 변경 주소를 확인해 주세요.');return send(res,200,{revision:creativeResearch.revision(user)});}
      if(path==='/api/creative-research/events'){if(demoRequest||url.search)throw httpError('실제 작업실의 자료 변경 주소를 확인해 주세요.');researchEventAuth.set(req,{hash:auth.hash,userId:user.id});return creativeResearchEvents.connect(req,res);}
      if(path==='/api/creative-research'){if(demoRequest)throw httpError('제작 참고 자료는 실제 작업실에서 확인해 주세요.',400);const archived=url.searchParams.get('includeArchived')??url.searchParams.get('archived');if(archived!==null&&!['0','1'].includes(archived))throw httpError('보관 자료 조회 여부를 확인해 주세요.');const result=creativeResearch.workspace(user,{includeArchived:archived==='1'});result.automation.sync=creativeResearchSync.state(user);return send(res,200,result);}
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
    const files={'/automation-health.js':['public/automation-health.js','text/javascript; charset=utf-8'],'/automation-health.css':['public/automation-health.css','text/css; charset=utf-8'],'/weekly-summary.js':['public/weekly-summary.js','text/javascript; charset=utf-8'],'/weekly-summary.css':['public/weekly-summary.css','text/css; charset=utf-8'],'/studio.js':['public/studio.js','text/javascript; charset=utf-8'],'/studio.css':['public/studio.css','text/css; charset=utf-8'],'/studio-review.js':['public/studio-review.js','text/javascript; charset=utf-8'],'/studio-review.css':['public/studio-review.css','text/css; charset=utf-8'],'/studio-board.js':['public/studio-board.js','text/javascript; charset=utf-8'],'/studio-board.css':['public/studio-board.css','text/css; charset=utf-8'],'/benchmark.js':['public/benchmark.js','text/javascript; charset=utf-8'],'/benchmark.css':['public/benchmark.css','text/css; charset=utf-8'],'/content.js':['public/content.js','text/javascript; charset=utf-8'],'/content.css':['public/content.css','text/css; charset=utf-8'],'/wordmark.svg':['public/wordmark.svg','image/svg+xml'],'/pages.css':['public/pages.css','text/css; charset=utf-8'],'/dialogs.css':['public/dialogs.css','text/css; charset=utf-8'],'/':['public/index.html','text/html; charset=utf-8'],'/app.js':['public/app.js','text/javascript; charset=utf-8'],'/style.css':['public/style.css','text/css; charset=utf-8'],'/font.woff2':['../../../../브랜드_폰트/SUIT/SUIT-Variable.woff2','font/woff2'],'/inter.ttf':['../../../../브랜드_폰트/InterTight/InterTight-Regular.ttf','font/ttf'],'/inter-semibold.ttf':['../../../../브랜드_폰트/InterTight/InterTight-SemiBold.ttf','font/ttf'],'/mono.ttf':['../../../../브랜드_폰트/DM_Mono/DMMono-Regular.ttf','font/ttf'],'/brand-logo.svg':['../../../../홍보물/마케팅실행_20260909/브랜드킷/SYNK-Ink-정밀.svg','image/svg+xml']};
    Object.assign(files,{'/workspace.js':['public/workspace.js','text/javascript; charset=utf-8'],'/workspace.css':['public/workspace.css','text/css; charset=utf-8'],'/signal.css':['public/signal.css','text/css; charset=utf-8'],'/team-overview.js':['public/team-overview.js','text/javascript; charset=utf-8']});
    Object.assign(files,{'/teaching.js':['public/teaching.js','text/javascript; charset=utf-8'],'/teaching.css':['public/teaching.css','text/css; charset=utf-8'],'/teaching-host.js':['public/teaching-host.js','text/javascript; charset=utf-8'],'/teaching/host.js':['public/teaching-host.js','text/javascript; charset=utf-8']});
    if(path==='/teacher-world'&&['GET','HEAD'].includes(method)){res.writeHead(302,{Location:'/teacher-world/'});return res.end();}
    files['/teacher-world/']=['../../../../../experiences/teacher-world/index.html','text/html; charset=utf-8'];
    for(const file of ['app.mjs','personalization-ui.mjs','style.css','personalization.css','signal.css','workspace-overview.css','workspace-overview.mjs','sharing-fence.mjs'])files['/teacher-world/'+file]=['../../../../../experiences/teacher-world/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    const teacherAssets=['app-world.png','synk-logo.svg','sticker-book.webp','sticker-person.webp','SUIT-Variable.woff2','InterTight-700.woff2','DMMono-Medium.ttf','slab-cream-long.webp','slab-coral-long.webp','chip-blush-long.webp','thread-shift.webp','badge-cream.webp','badge-check.webp','wide-coral.webp','wide-butter.webp'];
    for(const file of teacherAssets){const type=file.endsWith('.woff2')?'font/woff2':file.endsWith('.ttf')?'font/ttf':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'image/webp';files['/teacher-world/assets/'+file]=['../../../../../experiences/teacher-world/assets/'+file,type];}
    // Existing teacher CSS has these fixed absolute image paths. No directory
    // traversal, model, data file or wider assets directory is exposed.
    for(const file of ['wide-coral.webp','slab-cream-long.webp','chip-blush-long.webp','badge-cream.webp'])files['/assets/'+file]=['../../../../../experiences/teacher-world/assets/'+file,'image/webp'];
    if(path==='/consultation'&&['GET','HEAD'].includes(method)){res.writeHead(302,{Location:'/consultation/'});return res.end();}
    files['/consultation/']=['public/customer-computer.html','text/html; charset=utf-8'];
    for(const file of ['customer-computer.js','customer-computer-state.mjs','customer-computer.css'])files['/consultation/'+file]=['public/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    for(const file of ['consultation.mjs','interpretation.mjs','model-host.mjs'])files['/consultation/'+file]=['../../../../../experiences/atlas-lab/'+file,'text/javascript; charset=utf-8'];
    for(const file of ['domain.js','interpretation.js','ask.js'])files['/consultation/core/'+file]=['../../../../../atlas/'+file,'text/javascript; charset=utf-8'];
    for(const file of ['content.js','rules.js'])files['/consultation/computer/'+file]=['../../../맞춤도구/computer/'+file,'text/javascript; charset=utf-8'];
    files['/consultation/assets/scrapbook.css']=['../../../../디자인/펠트스크랩북/scrapbook.css','text/css; charset=utf-8'];
    files['/consultation/assets/SUIT-Variable.woff2']=['../../../../브랜드_폰트/SUIT/SUIT-Variable.woff2','font/woff2'];
    for(const file of ['laptop-felt.webp','fb-tile-cream-long.webp','fb-tile-butter-long.webp','fb-slab-black-long.webp'])files['/consultation/assets/'+file]=['../../../맞춤도구/assets/'+file,'image/webp'];
    for(const file of ['client-delivery-archive.js','client-delivery-archive.css','client-completion-records.js','client-completion-records.css','client-projects.js','client-projects.css','client-search.js','client-search.css','client-reply-templates.js','client-reply-templates.css','client-rights.js','client-rights.css','client-startup.js','client-startup.css','client-progress-update.js','client-progress-update.css','client-materials.js','client-materials.css','client-project-screen-plan.js','client-project-screen.js','client-project-screen.css','client-project-news.js','client-project-news.css','client-drafts.js','client-drafts.css','client-delivery.js','client-delivery.css','client-delivery-check.js','client-delivery-check.css','client-closeout.js','client-closeout.css','client-kickoff.js','client-kickoff.css','client-changes.js','client-changes.css','client-scene-requests.js','client-scene-requests.css','client-schedule.js','client-schedule.css','brand-quality.js','brand-quality.css'])files['/'+file]=['public/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    for(const file of ['client-material-usage.js','client-material-usage.css'])files['/'+file]=['public/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    files['/client-desk.css']=['public/client-desk.css','text/css; charset=utf-8'];files['/client-desk-pulse.webp']=['public/client-desk-pulse.webp','image/webp'];for(const stage of ['received','planning','producing','review','delivered','archived'])files['/client-desk-stage-'+stage+'.webp']=['public/client-desk-stage-'+stage+'.webp','image/webp'];
    files['/pulse/']=['public/pulse-lounge.html','text/html; charset=utf-8'];
    files['/pulse/lounge.js']=['public/pulse-lounge.js','text/javascript; charset=utf-8'];
    files['/pulse/lounge.css']=['public/client-projects.css','text/css; charset=utf-8'];
    files['/pulse-app/']=['public/pulse-app/index.html','text/html; charset=utf-8'];
    files['/pulse-app/index.html']=files['/pulse-app/'];
    for(const file of ['production-ui.mjs','production-context.mjs','deliverables-view.mjs','feedback-rounds-view.mjs','preview-view.mjs','animatic-player.mjs','app.mjs','views.mjs','casting-view.mjs','casting-catalog.mjs','strategy-view.mjs','kickoff-view.mjs','changes-view.mjs','scene-requests-view.mjs','schedule-view.mjs','demo.mjs','api.mjs','live.mjs','push.mjs','install.mjs','push-sw.js','sw.js'])files['/pulse-app/'+file]=['public/pulse-app/'+file,'text/javascript; charset=utf-8'];
    for(const file of ['reference-warm.png','reference-bold.png','reference-calm.png','scene-1.png','scene-2.png','scene-3.png','scene-4.png','preview-v1.mp4','preview-v2.mp4'])files['/pulse-app/demo-assets/'+file]=['public/pulse-app/demo-assets/'+file,file.endsWith('.mp4')?'video/mp4':'image/png'];
    for(const file of ['production.css','preview.css'])files['/pulse-app/'+file]=['public/pulse-app/'+file,'text/css; charset=utf-8'];
    files['/pulse-app/app.css']=['public/pulse-app/app.css','text/css; charset=utf-8'];
    files['/pulse-app/casting.css']=['public/pulse-app/casting.css','text/css; charset=utf-8'];
    for(const id of ['m01','f01','f02','f03','m02','m03','f04'])files['/pulse-app/assets/casting/'+id+'.webp']=['public/pulse-app/assets/casting/'+id+'.webp','image/webp'];
    for(const id of ['M01','F01','F02','F03','M02','F04','M03'])for(const sample of [1,2,3])files['/pulse-app/assets/casting/voice/'+id+'-'+sample+'.mp3']=['public/pulse-app/assets/casting/voice/'+id+'-'+sample+'.mp3','audio/mpeg'];
    for(const id of ['m01','f01','f02','f03','m02','f04','m03'])files['/pulse-app/assets/casting/fullbody/'+id+'-fullbody-v1.webp']=['public/pulse-app/assets/casting/fullbody/'+id+'-fullbody-v1.webp','image/webp'];
    files['/pulse-app/assets/casting/video/F02-ad-motion-5s-v1.mp4']=['public/pulse-app/assets/casting/video/F02-ad-motion-5s-v1.mp4','video/mp4'];
    files['/pulse-app/assets/casting/video/F02-runway-motion-5s-v1.mp4']=['public/pulse-app/assets/casting/video/F02-runway-motion-5s-v1.mp4','video/mp4'];
    files['/pulse-app/production-catalog.mjs']=['public/pulse-app/production-catalog.mjs','text/javascript; charset=utf-8'];
    files['/pulse-app/production-library/']=['public/pulse-app/production-library/index.html','text/html; charset=utf-8'];
    files['/pulse-app/production-library/index.html']=files['/pulse-app/production-library/'];
    for(const file of ['library.js','library.css'])files['/pulse-app/production-library/'+file]=['public/pulse-app/production-library/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    for(const file of ['01-harin-coffee-v3.webp','02-yuna-perfume.webp','03-taejun-tailoring.webp','04-runway-comparison-v2.webp','04-runway-comparison-proportion-v1.webp'])files['/pulse-app/assets/production/'+file]=['public/pulse-app/assets/production/'+file,'image/webp'];
    files['/pulse-app/manifest.webmanifest']=['public/pulse-app/manifest.webmanifest','application/manifest+json; charset=utf-8'];
    for(const file of ['scrapbook.css','brand-pulse.webp','thread-pulse.webp','SUIT.woff2','InterTight.woff2','SYNKLatin-Regular.woff2','SYNKLatin-SemiBold.woff2','SYNKLatin-Bold.woff2','DMMono.ttf','studio-camera.webp','sticker-check.webp'])files['/pulse-app/assets/'+file]=['public/pulse-app/assets/'+file,file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.woff2')?'font/woff2':file.endsWith('.ttf')?'font/ttf':'image/webp'];
    for(const file of ['hero-camera','stage-strategy','stage-direction','stage-concepts','stage-storyboard','stage-review','stage-history'])files['/pulse-app/assets/stage/'+file+'.webp']=['public/pulse-app/assets/stage/'+file+'.webp','image/webp'];
    for(const file of ['icon-192.png','icon-512.png','synk.svg'])files['/pulse-app/icons/'+file]=['public/pulse-app/icons/'+file,file.endsWith('.svg')?'image/svg+xml':'image/png'];
    // Exact browser dependencies only: server model adapter, fixtures and data
    // directories are intentionally absent from this public asset map.
    if(path==='/atlas-lab'&&['GET','HEAD'].includes(method)){res.writeHead(302,{Location:'/atlas-lab/'});return res.end();}
    files['/atlas-lab/']=['../../../../../experiences/atlas-lab/index.html','text/html; charset=utf-8'];
    for(const file of ['lab.js','lab.css','consultation.mjs','interpretation.mjs','model-host.mjs','matching.mjs','matching-ui.mjs','meeting.mjs','meeting-regions.mjs','meeting-ui.mjs','reconnect.mjs','discovery.mjs','discovery-ui.mjs','journey-memory.mjs','participant-launcher.mjs'])files['/atlas-lab/'+file]=['../../../../../experiences/atlas-lab/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    for(const file of ['atlas-learning.js'])files['/learning-hub/'+file]=['../../../../../experiences/learning-hub/'+file,'text/javascript; charset=utf-8'];
    for(const file of ['scrapbook.css','SUIT-Variable.woff2','InterTight-700.woff2','sticker-book.webp','slab-cream-long.webp','slab-blush-long.webp'])files['/learning-hub/assets/'+file]=['../../../../../experiences/learning-hub/assets/'+file,file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.woff2')?'font/woff2':'image/webp'];
    for(const file of ['engine.js','personalization.js','domain.js','interpretation.js','temper-outcomes.js'])files['/consult/core/'+file]=['../../../../../atlas/'+file,'text/javascript; charset=utf-8'];
    for(const file of ['content.js','rules.js'])files['/consult/computer/'+file]=['../../../맞춤도구/computer/'+file,'text/javascript; charset=utf-8'];
    files['/order-rush/learning.mjs']=['../../../../../experiences/order-rush/learning.mjs','text/javascript; charset=utf-8'];
    for(const file of ['personalization.mjs','core.mjs','suno-tracks.mjs','listening.mjs','narration.mjs'])files['/korean-rhythm/'+file]=['../../../../../experiences/korean-rhythm/'+file,'text/javascript; charset=utf-8'];
    Object.assign(files,{'/comparison-charts.js':['public/comparison-charts.js','text/javascript; charset=utf-8'],'/comparison-charts.css':['public/comparison-charts.css','text/css; charset=utf-8'],'/demo-ui.js':['public/demo-ui.js','text/javascript; charset=utf-8']});
    Object.assign(files,{'/growth-home.js':['public/growth-home.js','text/javascript; charset=utf-8'],'/growth-home.css':['public/growth-home.css','text/css; charset=utf-8']});
    Object.assign(files,{'/growth-history.js':['public/growth-history.js','text/javascript; charset=utf-8'],'/growth-history.css':['public/growth-history.css','text/css; charset=utf-8']});
    Object.assign(files,{'/team-trends.js':['public/team-trends.js','text/javascript; charset=utf-8'],'/team-trends.css':['public/team-trends.css','text/css; charset=utf-8']});
    Object.assign(files,{'/chart-hover.js':['public/chart-hover.js','text/javascript; charset=utf-8'],'/chart-hover.css':['public/chart-hover.css','text/css; charset=utf-8']});
    Object.assign(files,{'/marin-home.js':['public/marin-home.js','text/javascript; charset=utf-8'],'/marin-home.css':['public/marin-home.css','text/css; charset=utf-8'],'/marin.webp':['public/marin.webp','image/webp']});
    Object.assign(files,{'/marin-work.js':['public/marin-work.js','text/javascript; charset=utf-8'],'/marin-work.css':['public/marin-work.css','text/css; charset=utf-8']});
    Object.assign(files,{'/workroom.js':['public/workroom.js','text/javascript; charset=utf-8'],'/workroom.css':['public/workroom.css','text/css; charset=utf-8']});
    Object.assign(files,{'/social-workspace.js':['public/social-workspace.js','text/javascript; charset=utf-8'],'/social-workspace.css':['public/social-workspace.css','text/css; charset=utf-8']});
    Object.assign(files,{'/social-tracking.js':['public/social-tracking.js','text/javascript; charset=utf-8'],'/social-review':['public/social-review.html','text/html; charset=utf-8'],'/social-review.js':['public/social-review.js','text/javascript; charset=utf-8'],'/social-review.css':['public/social-review.css','text/css; charset=utf-8']});
    Object.assign(files,{'/publication-flow.js':['public/publication-flow.js','text/javascript; charset=utf-8'],'/publication-flow.css':['public/publication-flow.css','text/css; charset=utf-8']});
    files['/publication-learning-plan.js']=['public/publication-learning-plan.js','text/javascript; charset=utf-8'];
    // Fictional practice assets are public. Account records use the authenticated
    // private endpoint above; the source directory is never exposed.
    Object.assign(files,{
      '/workroom-practice.js':['public/workroom-practice.js','text/javascript; charset=utf-8'],
      '/workroom-practice-sync.js':['public/workroom-practice-sync.js','text/javascript; charset=utf-8'],
      '/workroom-practice.css':['public/workroom-practice.css','text/css; charset=utf-8'],
      '/workroom-practice/model.mjs':['../../../../../experiences/shift-workbench/model.mjs','text/javascript; charset=utf-8'],
      '/workroom-practice/storage-upgrade.mjs':['../../../../../experiences/shift-workbench/storage-upgrade.mjs','text/javascript; charset=utf-8'],
      '/workroom-practice/core.js':['../../../../../atlas/engine.js','text/javascript; charset=utf-8'],
      '/workroom-practice/domain.js':['../../../../../atlas/domain.js','text/javascript; charset=utf-8'],
      '/workroom-practice/temper-outcomes.js':['../../../../../atlas/temper-outcomes.js','text/javascript; charset=utf-8'],
      '/workroom-practice/personalization.js':['../../../../../atlas/personalization.js','text/javascript; charset=utf-8'],
    });
    for(const file of ['publish-rules.js','publish-check.js','maker-tools.js','maker-tools.css','subtitle-lab.js','subtitle-lab.css','creator-sources.js','creator-sources.css'])files['/'+file]=['public/'+file,file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'];
    Object.assign(files,{'/creative-research.js':['public/creative-research.js','text/javascript; charset=utf-8'],'/creative-research.css':['public/creative-research.css','text/css; charset=utf-8']});
    Object.assign(files,{'/company-guide.js':['public/company-guide.js','text/javascript; charset=utf-8'],'/company-guide.css':['public/company-guide.css','text/css; charset=utf-8']});
    Object.assign(files,{'/synk-id.js':['public/synk-id.js','text/javascript; charset=utf-8']});
    Object.assign(files,{'/manifest.webmanifest':['public/manifest.webmanifest','application/manifest+json; charset=utf-8'],'/messenger-icon.png':['public/messenger-icon.png','image/png']});
    files['/device-notifications.js']=['public/device-notifications.js','text/javascript; charset=utf-8'];
    files['/device-notifications.css']=['public/device-notifications.css','text/css; charset=utf-8'];
    files['/notification-sw.js']=['public/notification-sw.js','text/javascript; charset=utf-8'];
    if(['GET','HEAD'].includes(method)&&files[path]){const [file,type]=files[path];messenger.disconnectRevoked();const headers=responseHeaders(type);if(['/social-review','/social-review.js','/social-review.css'].includes(path))headers['Content-Security-Policy']="default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; media-src 'self' blob:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";if(path==='/teacher-world/'){headers['X-Frame-Options']='SAMEORIGIN';headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("frame-ancestors 'none'","frame-ancestors 'self'");}return await respondStatic(req,res,{path:join(here,file),type,headers});}
    throw httpError('페이지를 찾을 수 없습니다.',404);
  }catch(e){const failure=publicRequestError(e,{production});if(res.headersSent){res.destroy();return;}writeResponse(res,failure.status,{error:safeError(failure.message),...(typeof e.code==='string'&&(/^(?:SYNK|TEACHING)_[A-Z0-9_]{1,80}$/.test(e.code)||e.replySafe&&['EXISTING_REPLY_REQUIRES_CONFIRMATION','REPLY_HISTORY_CHANGED'].includes(e.code))?{code:e.code}:{})});}});
  function listen(listener,listenPort,listenHost){
    return new Promise((resolve,reject)=>{
      const failed=error=>{listener.off('listening',started);reject(error);};
      const started=()=>{listener.off('error',failed);resolve();};
      listener.once('error',failed);listener.once('listening',started);listener.listen(listenPort,listenHost);
    });
  }
  function shutdown(){
    ready=false;clearInterval(timer);clearInterval(pushTimer);clearInterval(researchSyncTimer);clearInterval(publicationTimer);clearInterval(publicationInboxTimer);clearInterval(publicationLinkTimer);clearInterval(weeklySummaryTimer);clearInterval(automationHealthTimer);clearInterval(deliveryCheckTimer);clearInterval(socialTimer);socialAbort.abort();publicationAbort.abort();creativeResearchEvents.stop();pulseLiveEvents.stop();clientNotifications.close();const identityStopped=synkIdentity.close(),customerIdentityStopped=customerIdentity.close(),teachingStopped=teaching.close();
    if(shutdownTask)return shutdownTask;
    shutdownTask=(async()=>{
      await Promise.all([socialPublishMedia.stop(),socialPublishing.stop?.(),socialReplies.stop(),socialProvider.stopHealth?.(),socialReview.stop(),socialAi.stop(),socialInboxRecovery.stop(),socialInboxProvider.stop(),socialTick,socialExtras,socialDistribution.waitForIdle(),deliveryFileInspector.close(),deliveryCheckTick,automationHealthTick,identityStopped,customerIdentityStopped,teachingStopped,queue,publicationTick,publicationInboxTick,publicationLinkTick,publicationLinks.stop(),publicationInbox.stop(),postPerformance.stop(),publicationPackages.stop(),dailyTrends.stop(),creativeResearchSync.stop(),creativeResearch.stop(),computerInterpretation.stop(),deviceNotifications.stop()]);messenger.endConnections();
      for(const listener of [redirectServer,server])if(listener?.listening)await new Promise(resolve=>{listener.close(resolve);listener.closeIdleConnections();});
      try{await messenger.close();}finally{synkIdentity.dispose();customerIdentity.dispose();teaching.dispose();store.close();}
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
        if(backgroundJobsEnabled&&options.schedule!==false&&!stopRequested){timer=setInterval(()=>scheduledTick().catch(()=>{}),60000);timer.unref();await scheduledTick();}
        if(options.schedule!==false&&!stopRequested){const checkResearch=()=>Promise.resolve().then(()=>creativeResearchSync.tick(clock())).catch(()=>{});researchSyncTimer=setInterval(checkResearch,30000);researchSyncTimer.unref();void checkResearch();}
        // Registered-post observation makes external SNS requests, so automatic runs
        // follow the background pause setting; explicit collection remains available.
        if(publicationPerformanceSchedule&&!stopRequested){publicationTimer=setInterval(collectPublicationPerformance,60000);publicationTimer.unref();void collectPublicationPerformance();}
        if(publicationInboxLocal&&(options.publicationInboxSchedule??(options.schedule!==false))&&!stopRequested){publicationInboxTimer=setInterval(scanPublicationInbox,5000);publicationInboxTimer.unref();void scanPublicationInbox();}
        if(publicationLinkSchedule&&!stopRequested){publicationLinkTimer=setInterval(scanPublicationLinks,60000);publicationLinkTimer.unref();void scanPublicationLinks();}
        if(weeklySummarySchedule&&!stopRequested){weeklySummaryTimer=setInterval(scanWeeklySummary,60000);weeklySummaryTimer.unref();scanWeeklySummary();}
        if(automationHealthSchedule&&!stopRequested){automationHealthTimer=setInterval(scanAutomationHealthScheduled,60000);automationHealthTimer.unref();void scanAutomationHealthScheduled();}
        if(deliveryCheckSchedule&&!stopRequested){deliveryCheckTimer=setInterval(scanDeliveryChecks,60000);deliveryCheckTimer.unref();void scanDeliveryChecks();}
        if(socialSchedule&&!stopRequested){socialTimer=setInterval(scanSocialPublishing,15000);socialTimer.unref();void scanSocialPublishing();}
        ready=!stopRequested;
        if(ready&&webPushEnabled){pushTimer=setInterval(()=>deviceNotifications.tick().catch(()=>{}),30000);pushTimer.unref();void deviceNotifications.tick().catch(()=>{});}
        return server.address();
      }catch(error){await shutdown().catch(()=>{});throw error;}
    })();
    return startTask;
  }
  async function stop(){ready=false;stopRequested=true;clearInterval(timer);clearInterval(pushTimer);clearInterval(researchSyncTimer);clearInterval(publicationTimer);clearInterval(publicationInboxTimer);clearInterval(publicationLinkTimer);clearInterval(weeklySummaryTimer);clearInterval(automationHealthTimer);clearInterval(deliveryCheckTimer);clearInterval(socialTimer);socialAbort.abort();publicationAbort.abort();if(startTask)await startTask.catch(()=>{});await shutdown();}
  return {server,store,socialPublishMedia,socialPublishing,socialMarketing,socialProvider,socialDistribution,socialInboxProvider,socialAi,socialRecovery,socialTracking,socialWorkflows,socialReview,socialReplies,socialCapacity,socialCopyInsights,socialFollowups,scanSocialPublishing,clientProjects,clientDelivery,messenger,deviceNotifications,dailyTrends,creativeResearch,creativeResearchSync,computerInterpretation,publicationPackages,publicationInbox,postPerformance,publicationLinks,weeklySummary,scanWeeklySummary,automationHealth,automationNotifications,scanAutomationHealth,scanAutomationHealthScheduled,scanDeliveryChecks,origin,host,port,importLegacy,scheduledTick,collectPublicationPerformance,scanPublicationInbox,scanPublicationLinks,report,enqueueCollection,waitForIdle:async()=>{await socialTick;await Promise.all([socialExtras,socialPublishMedia.waitForIdle(),socialPublishing.waitForIdle(),socialReplies.waitForIdle(),socialProvider.waitForHealthIdle?.(),socialReview.waitForIdle(),socialDistribution.waitForIdle(),socialAi.waitForIdle(),socialInboxProvider.waitForIdle(),queue,deliveryCheckTick,automationHealthTick,publicationTick,publicationInboxTick,publicationLinkTick,publicationLinks.waitForIdle(),publicationInbox.waitForIdle(),postPerformance.waitForIdle(),publicationPackages.waitForIdle(),dailyTrends.waitForIdle(),creativeResearch.waitForIdle(),creativeResearchSync.waitForIdle(),computerInterpretation.waitForIdle()]);},start,stop};
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
