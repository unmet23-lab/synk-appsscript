import {PLATFORM_CAPABILITIES} from './collectors.mjs';
import {publicationWorkflowHref} from './publication-workflow.mjs';
import {clientWorkflowHref} from './client-workflow.mjs';
import {buildClientProjectGroups} from './client-project-groups.mjs';
import {canWriteChannel} from './organization.mjs';
import {clientRightsSourceVisible} from './client-rights-reminders.mjs';

const MINUTE=60000,HOUR=60*MINUTE,STALE_GRACE=10*MINUTE;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const iso=value=>instant(value)===null?null:new Date(value).toISOString();
const latest=values=>values.map(iso).filter(Boolean).sort().at(-1)||null;
const earliest=values=>values.map(iso).filter(Boolean).sort()[0]||null;
const own=(user,row)=>row&&(row.ownerId===user.id||row.assigneeId===user.id);
const visible=row=>row&&row.active!==false&&row.hidden!==true&&row.stage!=='archived';
const pair=row=>JSON.stringify([row.productionId,row.versionId,[...(row.channels||[])].sort()]);
const labels={idle:'할 일 없음',ready:'준비됨',running:'확인 중',scheduled:'예약됨',paused:'꺼짐',delayed:'늦음',failed:'실패',connection:'연결 끊김',partial:'일부만 확인',manual:'사람 차례',missed:'시각 지남'};
const definitions=[
  ['package',1,'채널별 게시 묶음','on-demand','/?tab=workroom&section=tools&tool=publication','완성본과 채널을 고르면 그때 채널별 파일을 만들어요.'],
  ['performance',2,'게시 후 24·72시간 숫자','scheduled','/?tab=workroom&section=tools&tool=publication','기록한 게시물의 숫자를 게시 24시간·72시간 뒤에 읽어요. 연결된 채널은 자동으로, 아닌 채널은 직접 넣어요.'],
  ['inbox',3,'완성본 가져오기','scheduled','/?tab=workroom&section=tools&tool=publication','이 PC의 받는 폴더를 연결해 두면, 거기 넣은 완성본을 자동으로 가져와요.'],
  ['today',4,'오늘 할 일 모으기','on-demand','/?tab=home','게시 준비와 고객 프로젝트에서 지금 할 일을 열 때마다 모아요.'],
  ['learning',5,'성과에서 다음 기획','on-demand','/?tab=workroom&section=tools&tool=publication','기록한 72시간 숫자를 열 때마다 정리해 다음 기획에 이어요.'],
  ['review',6,'게시 전 점검','manual','/?tab=workroom&section=tools&tool=publication','영상·소리·사실·사용권은 사람이 직접 보고 기록해요.'],
  ['client',7,'다음 연락','manual','/?tab=workroom&section=clients','정해 둔 연락일이 되면 오늘 할 일에 올려요. 고객에게 자동으로 연락하지는 않아요.'],
  ['links',8,'게시·자료 링크 확인','scheduled','/?tab=workroom&section=tools&tool=publication','저장한 게시 주소와 자료 링크에 접속되는지 자동으로 확인해요. 로그인이 필요한 주소는 직접 열어 볼 일로 따로 보여 줘요.'],
  ['weekly',9,'주간 정리','scheduled','/?tab=workroom&section=tools&tool=weekly','매주 월요일에 지난주 정리를 준비하고, 열 때마다 지금 기록으로 다시 모아요.'],
  ['delivery',11,'납품 준비','on-demand','/?tab=workroom&section=clients','열 때마다 승인한 시안과 납품 준비를 읽어요. 고객 승인과 최종본을 고객에게 보이는 건 사람이 해요.'],
  ['closeout',12,'수령 확인과 마감','on-demand','/?tab=workroom&section=clients','고객이 최종본을 받았다고 했는지, 마감했는지 열 때마다 읽어요. 고객 답을 기다리는 건 고장이 아니에요.'],
  ['kickoff',13,'자료 챙기기','on-demand','/?tab=workroom&section=clients','자료 챙기기를 켠 프로젝트에서 아직 없는 자료와 정해 둘 것을 열 때마다 읽어요. 자료 받기와 고객 확인은 사람이 해요.'],
  ['changes',14,'바뀐 것','on-demand','/?tab=workroom&section=clients','잡아 둔 기준과 지금 제작 내용을 비교해요. 바뀐 게 어디에 닿는지 보고 새 기준을 잡는 건 직접 해요.'],
  ['requests',15,'장면 수정 요청','on-demand','/?tab=workroom&section=clients','내가 맡은 장면 요청과 내 검토 차례를 열 때마다 읽어요. 고칠 것과 고객을 기다리는 것은 나눠서 보여 줘요.'],
  ['schedule',16,'일정 지켜보기','on-demand','/?tab=workroom&section=clients','일정 지켜보기를 켠 프로젝트의 목표일과 기다리는 확인을 열 때마다 계산해요. 일이 늦어지는 건 자동화 고장이 아니에요.'],
  ['deliveryCheck',17,'납품 파일 자동 검사','scheduled','/?tab=workroom&section=clients','확정한 납품 규격대로 준비한 파일을 자동으로 검사해요. 없거나 안 맞는 파일과 직접 볼 것은 내 할 일로 따로 보여 줘요.'],
  ['rights',34,'사용 조건 기간','on-demand','/?tab=workroom&section=clients','내 프로젝트의 자료 사용 조건과 공개 동의가 끝나는 날을 한국 날짜로 봐요. 끝나기 7일 전부터 오늘 할 일에 올리고, 마감하거나 보관한 프로젝트도 계속 봐요.'],
];
const clientCardIds=['delivery','closeout','kickoff','changes','requests','schedule','deliveryCheck'];

// Links are constructed from source identifiers. Never echo an arbitrary URL,
// filesystem path, provider error, customer note, or credentials to this view.
function item(value){return {id:clean(value.id,400),automationId:value.automationId,kind:clean(value.kind,80),status:value.status,statusLabel:value.statusLabel||labels[value.status]||'확인 필요',title:clean(value.title)||'제목 없는 기록',text:clean(value.text,800),href:value.href,occurredAt:iso(value.occurredAt),dueAt:iso(value.dueAt),...(value.code==='post-performance-collector-stale'?{code:value.code,since:iso(value.since),affectedEntries:[...new Set(value.affectedEntries.map(id=>clean(id,200)).filter(Boolean))]}:{}),...(['customer','staff'].includes(value.waitingFor)?{waitingFor:value.waitingFor}:{})};}

// Reuse the workflow ordering without copying customer messages or staff notes
// into the health report. The source link opens those in their existing view.
function projectGroupSummary(group){
  const items=group.items.map(row=>Object.fromEntries(['id','kind','group','projectId','projectTitle','title','status','statusLabel','dueDate','href','actionLabel','updatedAt'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]])));
  return {...group,items,primary:group.primary?items.find(row=>row.id===group.primary.id):null};
}

export function createAutomationHealthService({store,studio,publicationPackages,publicationInbox,postPerformance,publicationLinks,publicationWorkflow,publicationLearning,clientProjects,clientWorkflow,clientDelivery,clientRights=null,weeklySummary,clock=()=>new Date().toISOString(),runtime=()=>({})}={}){
  if(!store)throw new Error('Automation health requires a store.');
  function get(user){
    user=user?.id&&store.get('users',user.id);if(!user?.active)throw fail('먼저 로그인해 주세요.',401);
    const now=instant(clock());if(now===null)throw fail('서버 시계를 읽지 못했어요. 잠시 뒤 다시 해 주세요.',500);
    const refreshedAt=new Date(now).toISOString(),cards=definitions.map(([id,number,title,mode,href,text])=>({id,number,title,mode,href,text,status:'idle',statusLabel:labels.idle,lastAttemptAt:null,lastSuccessAt:null,lastSuccessLabel:mode==='scheduled'?'최근 성공':'최근 결과',lastResultAt:null,nextRunAt:null,nextDueAt:null,checkedAt:null,counts:{targets:0,issues:0,manual:0,paused:0,customerWaiting:0,staffWaiting:0}})),byId=Object.fromEntries(cards.map(row=>[row.id,row])),issues=[],manual=[],partialIds=new Set(),observedIssueIds=new Set(),pending={performance:0,inbox:0,links:0,weekly:0};
    const observed=(automationId,kinds,id)=>{for(const kind of kinds)observedIssueIds.add(`${automationId}:${kind}:${id}`);};
    const mark=ids=>{for(const id of ids)partialIds.add(id);};
    const read=(ids,fn,fallback)=>{try{const value=fn();if(value===undefined||value===null||value?.then||Array.isArray(fallback)&&!Array.isArray(value)||!Array.isArray(fallback)&&(typeof value!=='object'||Array.isArray(value)))throw new Error('Invalid source response');return value;}catch{mark(ids);return fallback;}};
    const accessible=(ids,fn)=>{try{return fn();}catch(error){if(![403,404,409,422].includes(error.status))mark(ids);return null;}};
    const add=(list,automationId,kind,id,values)=>list.push(item({automationId,kind,id:`${automationId}:${kind}:${id}`,...values}));
    const problem=(automationId,kind,id,values)=>add(issues,automationId,kind,id,values);
    const human=(automationId,kind,id,values)=>add(manual,automationId,kind,id,{status:'manual',...values});
    let rt={},projectGroups=[];
    if(user.role!=='viewer'){
      rt=read(['performance','inbox','links','weekly','deliveryCheck'],()=>runtime(),{});
      for(const id of ['performance','inbox','links','weekly'])if(typeof rt[id]?.enabled!=='boolean')mark([id]);
      const productions=new Map();
      for(const row of read(['package','inbox','review','links'],()=>store.all('studioProductions'),[])){
        if(!visible(row)||!own(user,row))continue;
        const value=accessible(['package','inbox','review','links'],()=>studio.production(user,row.id)?.production);
        if(visible(value)&&own(user,value))productions.set(row.id,value);
      }
      const packages=[],seen=new Set();
      const rawPackages=read(['package','review','links'],()=>store.all('studioPublicationPackages'),[]).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||b.id.localeCompare(a.id));
      for(const row of rawPackages){
        const source=productions.get(row.productionId),version=source?.versions?.filter(v=>v.kind==='video'&&v.mediaId).at(-1);
        if(row.state!=='prepared'||!visible(row)||version?.id!==row.versionId)continue;
        const pack=accessible(['package','review','links'],()=>publicationPackages.get(user,row.id)?.package);
        if(!pack||seen.has(pair(pack)))continue;seen.add(pair(pack));packages.push(pack);
      }
      const packageIds=new Set(packages.map(row=>row.id));
      byId.package.counts.targets=packages.length;byId.package.lastResultAt=latest(packages.map(row=>row.createdAt));byId.package.lastSuccessAt=byId.package.lastResultAt;
      let performance=read(['performance','learning','links'],()=>postPerformance.list(user),{entries:[],channels:[]});
      if(!Array.isArray(performance.entries)||!Array.isArray(performance.channels)){mark(['performance','learning','links']);performance={entries:[],channels:[]};}
      const channels=new Map(performance.channels.map(row=>[row.id,row]));
      const entries=performance.entries.filter(row=>{const channel=store.get('channels',row.channelId);return visible(row)&&channel?.active!==false&&channel?.hidden!==true&&channel?.ownerIds?.includes(user.id)&&row.canEdit===true;});
      const ownedPaused=performance.entries.filter(row=>{const channel=store.get('channels',row.channelId);return row.active===false&&row.hidden!==true&&channel?.active!==false&&channel?.hidden!==true&&channel?.ownerIds?.includes(user.id)&&row.canEdit===true;});
      const entryIds=new Set(entries.map(row=>row.id));
      byId.performance.counts.targets=entries.length;byId.performance.counts.paused=ownedPaused.length+entries.filter(row=>store.get('channels',row.channelId)?.collectionDisabled===true).length;
      const observations=[],future=[],staleEntries=new Set(),staleDueAt=[];
      const performanceSuccess=instant(rt.performance?.lastSuccessAt);
      for(const entry of entries){
        const channel=channels.get(entry.channelId),rawChannel=store.get('channels',entry.channelId),creator=store.get('users',entry.createdBy),platform=PLATFORM_CAPABILITIES.find(row=>row.id===entry.platform);
        for(const checkpoint of entry.checkpoints||[]){
          if(![24,72].includes(checkpoint.hours))continue;
          const due=instant(checkpoint.dueAt),closes=instant(checkpoint.closesAt),href=publicationWorkflowHref('performance',{entryId:entry.id,checkpointHours:checkpoint.hours}),id=entry.id+':'+checkpoint.hours,title=entry.title||entry.channelName;
          const data={title,href,dueAt:checkpoint.dueAt,occurredAt:checkpoint.attemptedAt||checkpoint.recordedAt};
          // A recent attempt is not proof that the collector completed after this
          // observation became due. Only include currently accessible automatic work.
          if(due!==null&&due<now&&closes!==null&&closes>=due&&rt.performance?.enabled===true&&rawChannel?.collectionDisabled!==true&&['api-key','oauth'].includes(platform?.mode)&&channel?.connected===true&&creator?.active&&canWriteChannel(creator,rawChannel)&&canWriteChannel(user,rawChannel)){
            observed('performance',['collector-stale'],'current');
            // 관측 시각 직후에는 첫 회차가 아직 도는 중이라 정상이어도 「지연」이 떴다가 사라졌다(10-20). 10분 유예하고, 이미 닫힌 관측(missed)은 세지 않는다.
            if(['pending','retry','collecting'].includes(checkpoint.status)&&now-due>STALE_GRACE&&(performanceSuccess===null||performanceSuccess<due||performanceSuccess>now)){
              staleEntries.add(entry.id);staleDueAt.push(checkpoint.dueAt);
            }
          }
          if(rt.performance?.enabled!==false&&rawChannel?.collectionDisabled!==true)observed('performance',['window','connection','collection','late'],id);
          if(checkpoint.status==='recorded'&&Object.values(checkpoint.metrics||{}).some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0)){observations.push(checkpoint.recordedAt);continue;}
          if(due===null||closes===null){mark(['performance']);continue;}
          if(due>now){future.push(checkpoint.dueAt);continue;}
          if(rt.performance?.enabled===false)continue;
          if(rawChannel?.collectionDisabled===true)continue;
          if(checkpoint.status==='missed'||now>closes){problem('performance','window',id,{...data,status:'missed',text:`${checkpoint.hours}시간 숫자를 읽을 시각이 지났어요. 그때 본 숫자가 있으면 본 시각과 함께 넣어 주세요. 지난 숫자를 대신 채우지는 않아요.`});continue;}
          if(platform?.mode==='manual'){human('performance','metric',id,{...data,statusLabel:'숫자 직접 넣기',text:'이 채널은 숫자를 자동으로 읽지 못해요. 채널에서 직접 본 숫자를 넣어 주세요.'});continue;}
          if(channel?.connected!==true||!creator?.active||!canWriteChannel(creator,rawChannel)){
            problem('performance','connection',id,{...data,status:'connection',text:'채널 연결이 끊겼거나, 이 게시물을 기록한 사람이 채널 권한을 잃었어요. 채널을 다시 연결하거나 직접 본 숫자를 넣어 주세요.'});continue;
          }
          if(['pending','retry','collecting'].includes(checkpoint.status)&&(instant(checkpoint.nextAttemptAt)===null||instant(checkpoint.nextAttemptAt)<=now))pending.performance++;
          if(checkpoint.status==='collecting'&&instant(checkpoint.attemptedAt)!==null&&now-instant(checkpoint.attemptedAt)<3*MINUTE){byId.performance.status='running';continue;}
          // 「다시 확인합니다」는 수집기가 실제로 다시 볼 때(retry)만 쓴다. 자동 수집이 끝난 기록(manual-required)은 사람이 할 일로 남긴다(10-20: 다시 확인한다고 안내하고 할 일을 지웠다).
          if(checkpoint.status==='retry'){problem('performance','collection',id,{...data,status:'failed',text:instant(checkpoint.nextAttemptAt)>now?'숫자를 자동으로 받지 못했어요. 정해진 시각에 다시 읽어요.':'숫자를 자동으로 받지 못했어요. 게시 후 성과에서 숫자와 채널 연결을 봐 주세요.'});if(instant(checkpoint.nextAttemptAt)>now)future.push(checkpoint.nextAttemptAt);continue;}
          if(checkpoint.status==='manual-required'){
            if(['AUTH_REQUIRED','ACCOUNT_MISMATCH','CONNECTION_CHANGED'].includes(checkpoint.lastErrorCode)){problem('performance','connection',id,{...data,status:'connection',text:'채널 연결이나 권한 문제로 자동 수집이 멈췄어요. 채널을 다시 연결하고, 모을 기간이 끝나기 전에 채널에서 직접 본 숫자를 넣어 주세요.'});continue;}
            human('performance','metric',id,{...data,statusLabel:'빠진 숫자 넣기',text:checkpoint.lastErrorCode?'자동 수집을 끝내지 못했어요. 모을 기간이 끝나기 전에 채널에서 직접 본 숫자를 넣어 주세요.':'자동으로 못 읽은 숫자가 있어요. 채널에서 직접 보고 넣어 주세요.'});continue;}
          const reference=checkpoint.status==='collecting'?checkpoint.attemptedAt||checkpoint.dueAt:checkpoint.nextAttemptAt||checkpoint.dueAt;
          if(instant(reference)!==null&&now-instant(reference)>15*MINUTE)problem('performance','late',id,{...data,status:'delayed',text:`${checkpoint.hours}시간 숫자가 아직 안 들어왔어요. 모을 기간이 끝나기 전에 게시 후 성과에서 봐 주세요.`});
          else byId.performance.status=rt.performance?.running?'running':'scheduled';
        }
      }
      if(staleEntries.size){const since=earliest(staleDueAt);problem('performance','collector-stale','current',{code:'post-performance-collector-stale',since,affectedEntries:[...staleEntries],status:'delayed',title:'게시 숫자 자동 수집 멈춤',text:`게시물 ${staleEntries.size}편이 읽을 시각을 지났는데 자동 수집이 끝나지 않았어요. 서버의 자동 수집을 살펴보고, 급한 숫자는 게시 후 성과에서 직접 넣어 주세요.`,href:byId.performance.href,dueAt:since,occurredAt:since});}
      byId.performance.lastResultAt=latest(observations);byId.performance.nextDueAt=earliest(future);
      if(entries.length&&entries.every(row=>store.get('channels',row.channelId)?.collectionDisabled===true))byId.performance.status='paused';
      let inbox=read(['inbox'],()=>publicationInbox.state(user),{available:false,active:false,entries:[]});
      if(!Array.isArray(inbox.entries)){mark(['inbox']);inbox={...inbox,entries:[]};}
      // The inbox screen intentionally shows only its latest 100 receipts. Older
      // still-failed personal receipts must not disappear from a health scan.
      const allReceipts=read(['inbox'],()=>store.all('publicationInboxEntries'),[]).filter(row=>row.ownerId===user.id);
      const receipts=[...new Map([...inbox.entries,...allReceipts].map(row=>[row.id,row])).values()].filter(row=>visible(row)&&(!row.productionId||productions.has(row.productionId)));
      byId.inbox.counts.targets=receipts.length;byId.inbox.lastResultAt=latest(receipts.filter(row=>['ready','duplicate'].includes(row.status)).map(row=>row.updatedAt||row.createdAt));
      if(!inbox.available||!inbox.active||rt.inbox?.enabled===false){byId.inbox.status='paused';byId.inbox.text=inbox.available?'완성본 자동 가져오기를 꺼 두었어요. 다시 켤 때까지 받는 폴더 문제는 알리지 않아요.':'이 서버에서는 완성본 자동 가져오기를 쓸 수 없어요.';}
      else{
        observed('inbox',['scan'],'current');
        if(inbox.message)problem('inbox','scan','current',{status:'failed',title:'완성본 받는 폴더',text:'받는 폴더를 최근에 읽지 못했어요. 게시 준비의 「완성본 자동 가져오기」에서 폴더 상태를 봐 주세요.',href:byId.inbox.href,occurredAt:inbox.lastScanAt});
        for(const row of receipts){observed('inbox',['import'],row.id);if(row.status==='error'){pending.inbox++;problem('inbox','import',row.id,{status:'failed',title:row.title,text:'완성본을 가져오지 못했어요. 게시 준비에서 받은 파일과 원고를 봐 주세요.',href:row.productionId&&row.versionId?publicationWorkflowHref('prepare',{productionId:row.productionId,versionId:row.versionId}):byId.inbox.href,occurredAt:row.updatedAt||row.createdAt});}}
      }
      const workflow=read(['package','today','review'],()=>publicationWorkflow.workspace(user).items,[]);
      const ownWorkflow=workflow.filter(row=>row.entryId?entryIds.has(row.entryId):row.productionId?productions.has(row.productionId):false);
      for(const row of ownWorkflow){
        if(row.kind==='publication_prepare')human('package','prepare',row.id,{title:row.title,text:'완성본을 보고, 올릴 채널의 게시 묶음을 만들어 주세요.',statusLabel:'묶음 만들기',href:row.inboxId?publicationWorkflowHref('prepare',{inboxId:row.inboxId}):publicationWorkflowHref('prepare',row),occurredAt:row.updatedAt});
        if(row.kind==='publication_publish'&&row.packageId&&packageIds.has(row.packageId))human('package','publish',row.id,{title:row.title,text:row.status==='format-required'?'기록한 게시물이 Shorts인지 일반 영상인지 골라 원래 묶음에 이어 주세요.':'파일을 받아 올린 뒤, 실제 게시 주소를 기록해 주세요.',statusLabel:row.status==='format-required'?'형식 고르기':'게시 주소 기록',href:publicationWorkflowHref('publish',row),occurredAt:row.updatedAt});
        if(row.kind==='publication_review'&&packageIds.has(row.packageId))human('review','check',row.packageId,{title:row.title,text:row.status==='needs-work'?'게시 전 점검에 고칠 항목이 있어요. 고친 뒤 점검을 마쳐 주세요.':'영상 끝까지 보기, 사실, 사용권 같은 남은 점검을 직접 해 주세요.',statusLabel:row.status==='needs-work'?'고칠 것 있음':'점검 남음',href:publicationWorkflowHref('review',row),occurredAt:row.updatedAt});
      }
      byId.review.counts.targets=packages.length;
      const learning=read(['learning'],()=>publicationLearning.workspace(user).cards,[]).filter(row=>entryIds.has(row.entryId));
      byId.learning.counts.targets=learning.length;byId.learning.lastResultAt=latest(learning.map(row=>row.observedAt));byId.learning.lastSuccessAt=byId.learning.lastResultAt;
      if(learning.length)byId.learning.text=`내 게시물 ${learning.length}편의 숫자를 열 때마다 정리해요. 비교할 편이 적거나 읽을 시각이 아직 안 됐어도 고장 난 게 아니에요.`;
      const unread=[],projectRows=read(['client','today','rights',...clientCardIds],()=>clientProjects.workspace(user).projects,unread);
      const projects=projectRows.filter(row=>visible(row)&&clientRightsSourceVisible(row)&&(row.ownerId===user.id||row.reviewerId===user.id));
      const rightsProjects=projectRows.filter(row=>clientRightsSourceVisible(row)&&row.ownerId===user.id),rightsProjectIds=new Set(rightsProjects.map(row=>row.id));
      const projectIds=new Set(projects.map(row=>row.id)),clientRows=read(['client','today','requests','rights'],()=>clientWorkflow.workspace(user).items,unread),clientItems=clientRows.filter(row=>row.kind==='client_rights_expiry'?rightsProjectIds.has(row.projectId):projectIds.has(row.projectId));
      const today=new Date(now+9*HOUR).toISOString().slice(0,10),contactDates=[];
      projectGroups=projectRows===unread||clientRows===unread?null:buildClientProjectGroups(clientItems,{today}).map(projectGroupSummary);
      const rightsResults=[],rightsDates=[];byId.rights.lastResultLabel='최근 사용 조건 기록';
      if(clientRights)for(const row of rightsProjects){
        const report=accessible(['rights'],()=>clientRights.reminders(user,row.id));
        if(!report)continue;
        if(report.projectId!==row.id||report.today!==today||!Number.isSafeInteger(report.targets)||report.targets<0||!Array.isArray(report.items)){mark(['rights']);continue;}
        byId.rights.counts.targets+=report.targets;rightsResults.push(report.lastResultAt);rightsDates.push(report.nextDueAt);
        for(const entry of report.items){
          if(!['upcoming','due','expired'].includes(entry.status)||typeof entry.targetId!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresAt||'')){mark(['rights']);continue;}
          byId.rights.counts.staffWaiting++;
          human('rights','expiry',row.id+':'+entry.targetId,{title:row.title+' · '+entry.label,statusLabel:entry.statusLabel,waitingFor:'staff',text:`${entry.expiresAt}까지인 ${entry.kind==='portfolio'?'공개 동의':'자료 사용'} 기간이에요. ${entry.status==='expired'?'이미 지났어요. 아직 쓰고 있는지, 늘릴 근거가 있는지 봐 주세요.':'끝나기 전에 더 쓸지, 늘릴지 정해 주세요.'}`,href:clientWorkflowHref(row.id)+'&rights=1&rightsTarget='+encodeURIComponent(entry.targetId),occurredAt:entry.recordedAt,dueAt:entry.expiresAt+'T00:00:00+09:00'});
        }
      }
      byId.rights.lastResultAt=latest(rightsResults);byId.rights.nextDueAt=earliest(rightsDates);
      for(const row of projects){
        if(row.ownerId!==user.id||!/^\d{4}-\d{2}-\d{2}$/.test(row.nextContactDate||''))continue;
        const dueAt=row.nextContactDate+'T00:00:00+09:00';if(instant(dueAt)===null||new Date(instant(dueAt)+9*HOUR).toISOString().slice(0,10)!==row.nextContactDate)continue;
        byId.client.counts.targets++;
        if(row.nextContactDate>today)contactDates.push(dueAt);
        else human('client','follow-up',row.id,{title:row.title,text:'정해 둔 연락일이 됐어요. 고객에게 연락한 뒤 프로젝트의 「다음 연락」에 결과와 다음 날짜를 적어 주세요.',statusLabel:row.nextContactDate<today?'연락일 지남':'오늘 연락',href:clientWorkflowHref(row.id)+'&followUp=1',dueAt});
      }
      byId.client.nextDueAt=earliest(contactDates);byId.client.lastResultAt=latest(projects.filter(row=>row.ownerId===user.id).flatMap(row=>(row.followUpHistory||[]).map(value=>value.at)));byId.client.lastSuccessAt=byId.client.lastResultAt;
      byId.today.counts.targets=ownWorkflow.length+clientItems.filter(row=>['reply','review','next'].includes(row.group)).length;
      byId.today.text='게시 준비와 고객 프로젝트에서 지금 할 일을 모았어요.';
      for(const id of clientCardIds)if(!partialIds.has(id))byId[id].checkedAt=refreshedAt;
      const resultTimes=Object.fromEntries(clientCardIds.map(id=>[id,[]])),scheduledDeliveries=[];
      const resultLabels={delivery:'최근 승인·납품 기록',closeout:'최근 수령·마감 기록',kickoff:'최근 자료 챙기기 설정',changes:'최근 기준 기록',requests:'최근 장면 처리',schedule:'최근 일정 설정',deliveryCheck:'최근 파일 검사 결과'};
      for(const id of clientCardIds)byId[id].lastResultLabel=resultLabels[id];
      const wait=(automationId,row,{customer=false,staff=false,...values})=>{if(customer)byId[automationId].counts.customerWaiting++;if(staff)byId[automationId].counts.staffWaiting++;human(automationId,'waiting',row.id,{title:row.title,href:clientWorkflowHref(row.id)+'&'+(automationId==='deliveryCheck'?'delivery':automationId)+'=1',waitingFor:staff?'staff':'customer',...values});};
      for(const row of projects){
        const owner=row.ownerId===user.id,versions=Array.isArray(row.versions)?row.versions:[],preview=versions.filter(value=>value.kind==='preview').at(-1),finals=preview?.approvedAt?versions.filter(value=>value.kind==='final'&&value.approvedPreviewId===preview.id):[];
        const strategy=row.studio?.strategy,strategyWaiting=Number.isSafeInteger(strategy?.revision)&&strategy.revision>0&&strategy.request?.strategyRevision===strategy.revision&&strategy.confirmation?.strategyRevision!==strategy.revision;
        const specifications=row.studio?.deliverables,specificationsWaiting=Number.isSafeInteger(specifications?.revision)&&specifications.revision>0&&Array.isArray(specifications.items)&&specifications.items.length>0&&specifications.request?.deliverableRevision===specifications.revision&&specifications.confirmation?.deliverableRevision!==specifications.revision;
        if(owner&&specificationsWaiting){byId.deliveryCheck.counts.targets++;wait('deliveryCheck',row,{customer:true,statusLabel:'규격 고객 확인 전',text:'납품 규격을 고객에게 확인해 달라고 했어요. 고객이 확인하기 전에는 파일을 자동으로 검사하지 않아요.',occurredAt:specifications.request.at});}
        if(owner&&preview){
          const delivery=accessible(['delivery','deliveryCheck'],()=>clientDelivery?.get(user,row.id));
          if(!delivery||typeof delivery.status!=='string'||!Array.isArray(delivery.items)){if(delivery!==null)mark(['delivery','deliveryCheck']);}
          else{
            byId.delivery.counts.targets++;resultTimes.delivery.push(preview.approvedAt,...finals.map(value=>value.createdAt));
            if(delivery.status==='waiting_approval')wait('delivery',row,{customer:true,statusLabel:'고객 승인 전',text:'고객이 최신 시안을 승인하길 기다려요. 승인하면 납품 준비로 넘어가요.',occurredAt:preview.createdAt});
            else if(['preparing','ready','feedback_pending'].includes(delivery.status))wait('delivery',row,{staff:true,statusLabel:delivery.status==='ready'?'보일 수 있음':delivery.status==='feedback_pending'?'남은 수정 요청 있음':'납품 준비 중',text:delivery.status==='ready'?'필요한 파일과 직접 볼 것을 다 챙겼어요. 최종본과 사용 안내를 고객에게 보여 주세요.':delivery.status==='feedback_pending'?'아직 처리하지 않은 고객 수정 요청이 있어요. 납품 전에 먼저 봐 주세요.':'승인한 시안으로 줄 파일과 사용 안내를 준비하고 직접 봐 주세요.',occurredAt:preview.approvedAt});
            const report=delivery.deliveryCheck;
            if(!report||typeof report.status!=='string')mark(['deliveryCheck']);
            else if(report.confirmed&&preview.approvedAt&&report.status!=='existing_delivery'){
              byId.deliveryCheck.counts.targets++;resultTimes.deliveryCheck.push(report.checkedAt);scheduledDeliveries.push({row,preview,report});
              if(report.pendingCount>0)wait('deliveryCheck',row,{staff:true,statusLabel:report.statusLabel,text:`없거나 안 맞는 파일(검사 전 포함) ${Number.isInteger(report.blockingCount)?report.blockingCount:0}개, 직접 볼 것 ${Number.isInteger(report.manualCount)?report.manualCount:0}개가 남았어요. 파일 검사가 찾은 할 일이지, 검사가 고장 난 건 아니에요.`,occurredAt:report.checkedAt});
            }
          }
        }
        const closeout=row.closeout;
        if(owner&&closeout?.deliveryKey){byId.closeout.counts.targets++;resultTimes.closeout.push(closeout.receipt?.confirmedAt,closeout.closure?.closedAt,closeout.lastClosure?.closedAt);if(closeout.status==='waiting_receipt')wait('closeout',row,{customer:true,statusLabel:'고객이 받았다고 안 함',text:'고객이 최종 파일과 사용 안내를 받았다고 눌러 주길 기다려요. 고객 대신 받음으로 처리하지는 않아요.',occurredAt:closeout.deliveredAt});else if(['follow_up','ready'].includes(closeout.status))wait('closeout',row,{staff:true,statusLabel:closeout.status==='ready'?'마감할 수 있음':'남은 일 있음',text:closeout.status==='ready'?'고객이 받았다고 했어요. 이제 프로젝트를 마감해 주세요.':'받았다고 한 뒤에 남은 문의·수정 요청·연락을 정리해 주세요.',occurredAt:closeout.receipt?.confirmedAt});}
        const kickoff=row.kickoff;
        if(owner&&row.stage!=='delivered'&&kickoff?.enabled){byId.kickoff.counts.targets++;resultTimes.kickoff.push(row.kickoffPlan?.updatedAt);if(kickoff.status==='waiting'){const missing=(kickoff.checks||[]).filter(check=>check.status!=='ready'),unconfirmed=missing.some(check=>check.id==='confirmation'),customer=unconfirmed&&strategyWaiting,staff=missing.some(check=>check.id!=='confirmation')||unconfirmed&&!strategyWaiting||(kickoff.requirements||[]).some(value=>value.required&&value.status!=='ready'&&value.status!=='waived');wait('kickoff',row,{customer,staff:staff||!customer,statusLabel:customer&&!staff?'고객 기획 확인 전':'챙길 자료 있음',text:`시작 준비에서 ${Number.isInteger(kickoff.missingCount)?kickoff.missingCount:0}개가 남았어요.${customer?' 고객이 지금 기획을 확인하길 기다려요.':''}${staff?' 자료와 합의 조건을 챙기고, 고객에게 확인을 요청했는지 봐 주세요.':''}`,occurredAt:row.kickoffPlan?.updatedAt});}}
        else if(owner&&kickoff?.status==='disabled'&&row.kickoffPlan?.updatedAt)byId.kickoff.counts.paused++;
        const changes=row.changes;
        if(owner&&changes?.enabled){byId.changes.counts.targets++;resultTimes.changes.push(changes.baseline?.at,...(changes.history||[]).map(value=>value.at));const staff=['pending','reviewed'].includes(changes.status);if(staff||strategyWaiting)wait('changes',row,{customer:strategyWaiting,staff,statusLabel:staff?changes.status==='reviewed'?'새 기준 잡을 차례':'바뀐 것 볼 차례':'고객 기획 확인 전',text:(staff?changes.status==='reviewed'?'바뀐 것을 다 봤어요. 지금 내용을 새 기준으로 잡아 주세요.':`확정한 뒤 바뀐 내용과 남은 확인 ${Number.isInteger(changes.pendingCount)?changes.pendingCount:0}개를 봐 주세요.`:'')+(strategyWaiting?' 고객에게 확인을 요청한 기획은 답을 기다려요.':''),occurredAt:changes.baseline?.at});}
        else if(owner&&changes?.status==='disabled'&&row.changeControl?.updatedAt)byId.changes.counts.paused++;
        const requests=Array.isArray(row.sceneRequests?.items)?row.sceneRequests.items:[],assigned=requests.filter(value=>value.status!=='archived'&&(owner||value.status==='review'&&Array.isArray(value.actions)&&value.actions.some(action=>['accept','request_changes'].includes(action.action))));
        if(assigned.length){byId.requests.counts.targets+=assigned.length;resultTimes.requests.push(...assigned.map(value=>value.updatedAt));const outstanding=assigned.filter(value=>value.status!=='done'),customers=outstanding.filter(value=>value.status==='waiting_customer').length,staff=outstanding.length-customers;if(outstanding.length)wait('requests',row,{customer:customers>0,staff:staff>0,statusLabel:staff?owner?'내 차례':'내 검토 차례':'고객 차례',text:`장면 요청 중 고객을 기다리는 게 ${customers}건, ${owner?'내가 처리할 게':'내가 검토할 게'} ${staff}건이에요.`,occurredAt:latest(outstanding.map(value=>value.updatedAt))});}
        const schedule=row.schedule;
        if(owner&&schedule?.enabled){byId.schedule.counts.targets++;resultTimes.schedule.push(...(schedule.history||[]).map(value=>value.at));const waiting=Array.isArray(schedule.waiting)?schedule.waiting:[],customers=waiting.filter(value=>value.audience==='customer').length,staff=waiting.filter(value=>value.audience==='internal').length,due=schedule.pendingCount||0;if(customers||staff||due)wait('schedule',row,{customer:customers>0,staff:staff>0||due>0,statusLabel:due?'늦어지는 곳 있음':staff?'검토자 차례':'고객 차례',text:`고객 확인 ${customers}건, 내부 검토 ${staff}건을 기다리고 있고, 목표일·납기에서 볼 것이 ${due}개예요. 사람을 기다리거나 일정이 밀린 거라 자동화 고장은 아니에요.`,occurredAt:schedule.checkedAt});}
        else if(owner&&schedule?.status==='disabled'&&row.schedulePlan?.updatedAt)byId.schedule.counts.paused++;
      }
      for(const id of clientCardIds)byId[id].lastResultAt=latest(resultTimes[id]);
      const deliveryCard=byId.deliveryCheck,deliveryRuntime=rt.deliveryCheck||{},deliveryInterval=Number.isFinite(deliveryRuntime.intervalMs)&&deliveryRuntime.intervalMs>0?deliveryRuntime.intervalMs:null;
      if(deliveryRuntime.enabled===false){deliveryCard.status='paused';deliveryCard.counts.paused=scheduledDeliveries.length;deliveryCard.text+=' 이 서버에서는 자동 검사가 꺼져 있어요. 지난 검사 결과와 할 일은 그대로 볼 수 있어요.';}
      if(scheduledDeliveries.length){
        if(typeof deliveryRuntime.enabled!=='boolean')mark(['deliveryCheck']);
        if(deliveryRuntime.enabled===false){const current=scheduledDeliveries.map(({row,report})=>deliveryRuntime.projects?.[row.id]).filter((value,index)=>value?.fingerprint===scheduledDeliveries[index].report.fingerprint);deliveryCard.lastAttemptAt=latest(current.map(value=>value.lastAttemptAt));deliveryCard.lastSuccessAt=latest(current.map(value=>value.lastSuccessAt));}
        else{
          const outcomes=deliveryRuntime.projects,attempts=[],successes=[],grace=Math.max(5*MINUTE,(deliveryInterval||MINUTE)*3);
          if(!outcomes||typeof outcomes!=='object'||Array.isArray(outcomes))mark(['deliveryCheck']);
          if(instant(deliveryRuntime.lastScanErrorAt)!==null&&(instant(deliveryRuntime.lastSuccessAt)===null||instant(deliveryRuntime.lastScanErrorAt)>instant(deliveryRuntime.lastSuccessAt)))mark(['deliveryCheck']);
          deliveryCard.nextRunAt=iso(deliveryRuntime.nextRunAt)||(deliveryInterval&&instant(deliveryRuntime.lastAttemptAt)!==null?new Date(instant(deliveryRuntime.lastAttemptAt)+deliveryInterval).toISOString():null);
          for(const {row,preview,report}of scheduledDeliveries){
            const state=outcomes?.[row.id],fingerprint=typeof report.fingerprint==='string'?report.fingerprint:'',matching=!!fingerprint&&state?.fingerprint===fingerprint,id=row.id+':'+fingerprint,href=clientWorkflowHref(row.id)+'&delivery=1';
            // Ignore old approval/specification outcomes. Current source timing
            // still detects a stopped scanner after its startup/change grace.
            if(matching){attempts.push(state.lastAttemptAt);successes.push(state.lastSuccessAt);const errorAt=instant(state.lastErrorAt),successAt=instant(state.lastSuccessAt),attemptAt=instant(state.lastAttemptAt);
              if(successAt!==null&&(errorAt===null||successAt>=errorAt))observed('deliveryCheck',['runner','runner-late','stuck'],id);
              if(errorAt!==null&&(successAt===null||errorAt>successAt)){problem('deliveryCheck','runner',id,{status:'failed',title:row.title,text:'이 프로젝트의 파일 자동 검사가 최근에 실패했어요. 「납품」에서 파일을 보고, 다음 검사 결과를 기다려 주세요.',href,occurredAt:state.lastErrorAt});continue;}
              if(state.running){if(attemptAt!==null&&now-attemptAt>grace)problem('deliveryCheck','stuck',id,{status:'delayed',title:row.title,text:'이 프로젝트의 파일 자동 검사가 시작된 뒤 오래 끝나지 않고 있어요. 서버가 제대로 돌고 있는지 봐 주세요.',href,occurredAt:state.lastAttemptAt});else deliveryCard.status='running';continue;}
            }
            if(deliveryRuntime.running){if(deliveryCard.status==='idle')deliveryCard.status='scheduled';continue;}
            const contextAt=latest([row.updatedAt,preview.approvedAt,row.studio?.deliverables?.confirmation?.at]),anchor=latest([matching?state.lastAttemptAt:null,deliveryRuntime.startAt,contextAt]);
            if(deliveryRuntime.enabled===true&&deliveryInterval&&instant(anchor)!==null&&now-instant(anchor)>grace)problem('deliveryCheck','runner-late',id,{status:'delayed',title:row.title,text:'이 프로젝트의 파일 자동 검사가 예정보다 늦어요. 서버가 켜져 있는지 봐 주세요.',href,dueAt:new Date(instant(anchor)+deliveryInterval).toISOString()});
            else if(deliveryCard.status==='idle')deliveryCard.status=matching&&instant(state.lastSuccessAt)!==null?'ready':'scheduled';
          }
          deliveryCard.lastAttemptAt=latest(attempts);deliveryCard.lastSuccessAt=latest(successes);
        }
      }
      const linkTargets=[...packages.filter(row=>row.link).map(row=>({kind:'package',id:row.id,title:row.title,createdAt:row.createdAt})),...entries.map(row=>({kind:'post',id:row.id,title:row.title||row.channelName,createdAt:row.createdAt}))],linkTimes=[],linkDue=[];
      for(const target of linkTargets){
        const check=accessible(['links'],()=>publicationLinks.get(user,{kind:target.kind,id:target.id}))?.check;if(!check?.canCheck)continue;
        if(rt.links?.enabled!==false)observed('links',['response','late'],target.kind+':'+target.id);
        byId.links.counts.targets++;if(check.checkedAt)linkTimes.push(check.checkedAt);if(check.nextCheckAt)linkDue.push(check.nextCheckAt);
        const href=publicationWorkflowHref('link',target.kind==='package'?{packageId:target.id}:{entryId:target.id}),data={title:target.title,href,occurredAt:check.checkedAt,dueAt:check.nextCheckAt};
        if(check.status==='error'&&rt.links?.enabled!==false)problem('links','response',target.kind+':'+target.id,{...data,status:'failed',text:'저장한 주소에 접속하니 오류가 났어요. 주소가 맞는지, 게시물이나 자료가 그대로 있는지 봐 주세요.'});
        else if(check.status==='manual-required')human('links','open',target.kind+':'+target.id,{...data,statusLabel:'직접 열어 보기',text:'로그인이 필요하거나 접근이 막혀 있어 자동으로는 알 수 없어요. 주소를 직접 열어 공개됐는지, 받을 수 있는지 봐 주세요.'});
        const due=instant(check.nextCheckAt)??(!check.checkedAt?Math.max(instant(target.createdAt)||now,instant(rt.links?.startAt)||0):null);
        if(due!==null&&due<=now)pending.links++;
        const grace=Math.max(15*MINUTE,(rt.links?.intervalMs||MINUTE)*(Math.ceil(linkTargets.length/10)+2));
        if(rt.links?.enabled!==false&&due!==null&&now-due>grace&&check.status!=='error')problem('links','late',target.kind+':'+target.id,{...data,status:'delayed',text:'링크를 다시 확인할 시각이 지났는데 아직 결과가 없어요. 주소를 직접 열어 봐 주세요.'});
      }
      byId.links.lastResultAt=latest(linkTimes);byId.links.nextDueAt=earliest(linkDue);
      const weekly=read(['weekly'],()=>weeklySummary.get(user),{});
      byId.weekly.counts.targets=weekly.period?1:0;byId.weekly.lastResultAt=iso(weekly.generatedAt);byId.weekly.nextDueAt=iso(weekly.schedule?.nextRunAt);
      if(weekly.period)observed('weekly',['missing'],weekly.period.startDate);
      if(weekly.sections?.some(row=>!['ready','empty'].includes(row.status)))mark(['weekly']);
      if(weekly.period&&!byId.weekly.lastResultAt)pending.weekly=1;
      if(pending.weekly&&rt.weekly?.enabled!==false&&instant(rt.weekly?.startAt)!==null&&now-instant(rt.weekly.startAt)>Math.max(5*MINUTE,(rt.weekly.intervalMs||MINUTE)*3))problem('weekly','missing',weekly.period.startDate,{status:'delayed',title:'지난주 정리',text:'지난주 정리가 아직 자동으로 준비되지 않았어요. 주간 정리를 열면 지금 기록으로 바로 볼 수 있어요.',href:byId.weekly.href,dueAt:weekly.period.endAt});
      for(const id of ['performance','inbox','links','weekly']){
        const card=byId[id],state=rt[id]||{},interval=Number.isFinite(state.intervalMs)&&state.intervalMs>0?state.intervalMs:null;
        card.lastAttemptAt=iso(state.lastAttemptAt);card.lastSuccessAt=iso(state.lastSuccessAt);card.nextRunAt=state.enabled===false?null:iso(state.nextRunAt)||(interval&&instant(state.lastAttemptAt)!==null?new Date(instant(state.lastAttemptAt)+interval).toISOString():null);
        if(card.status==='paused'||state.enabled===false){card.status='paused';card.nextRunAt=null;if(state.enabled===false)card.text+=' 이 서버에서는 자동 실행이 꺼져 있어요.';continue;}
        if(card.counts.targets===0)continue;
        const errorAt=instant(state.lastErrorAt),successAt=instant(state.lastSuccessAt);
        if(pending[id]||errorAt===null||successAt!==null&&successAt>=errorAt)observed(id,['runner'],'current');
        if(pending[id]&&errorAt!==null&&(successAt===null||errorAt>successAt))problem(id,'runner','current',{status:'failed',title:card.title+' 자동 실행',text:'최근 자동 실행이 실패했어요. 항목마다 상태를 보고, 잠시 뒤 새로고침해 주세요.',href:card.href,occurredAt:state.lastErrorAt});
        const anchor=instant(state.lastAttemptAt)||instant(state.startAt);
        if(pending[id]||anchor!==null&&interval&&now-anchor<=Math.max(5*MINUTE,interval*3))observed(id,['runner-late'],'current');
        if(pending[id]&&state.enabled===true&&interval&&anchor!==null&&now-anchor>Math.max(5*MINUTE,interval*3)&&!state.running)problem(id,'runner-late','current',{status:'delayed',title:card.title+' 자동 실행',text:'할 일이 있는데 자동 실행이 예정보다 늦어요. 서버가 켜져 있는지 봐 주세요.',href:card.href,dueAt:new Date(anchor+interval).toISOString()});
        if(state.running&&pending[id])card.status='running';else if(card.status==='idle')card.status=pending[id]||instant(card.nextDueAt)>now?'scheduled':'ready';
      }
    }
    // Stable source keys prevent duplicate issue rows; disappear on resolution or
    // permission loss. Persistence/notification policy belongs to the caller.
    const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
    const issueRows=unique(issues),manualRows=unique(manual);
    for(const card of cards){
      card.checkedAt=user.role!=='viewer'&&!partialIds.has(card.id)?refreshedAt:null;
      card.counts.issues=issueRows.filter(row=>row.automationId===card.id).length;card.counts.manual=manualRows.filter(row=>row.automationId===card.id).length;
      const mine=issueRows.filter(row=>row.automationId===card.id);
      if(partialIds.has(card.id)){card.status='partial';card.text+=' 일부 기록을 읽지 못해서 다 됐는지는 판단하지 않았어요.';}
      else if(card.status!=='paused'&&mine.length)card.status=['failed','connection','missed','delayed'].find(status=>mine.some(row=>row.status===status))||'failed';
      else if(card.status!=='paused'&&card.status!=='running'&&card.counts.manual)card.status='manual';
      else if(card.status==='idle'&&card.counts.targets)card.status='ready';
      else if(card.status==='idle'&&card.counts.paused)card.status='paused';
      card.statusLabel=labels[card.status];
    }
    return {refreshedAt,cards,issues:issueRows,manual:manualRows,projectGroups,...(projectGroups===null?{projectGroupsError:'프로젝트별 할 일을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.'}:{}),observedIssueIds:[...observedIssueIds],counts:{issues:issueRows.length,manual:manualRows.length,running:cards.filter(row=>row.status==='running').length,paused:cards.filter(row=>row.status==='paused').length,partial:partialIds.size},note:'내가 맡은 작업만 봐요. 「최근 성공」은 자동 실행이 끝났다는 뜻이지, 항목이 다 처리됐다는 뜻은 아니에요. 이 화면은 읽기만 해요. 기록을 바꾸거나 숫자를 새로 모으거나 다시 시도하지 않아요.'};
  }
  return {get};
}
