import {PLATFORM_CAPABILITIES} from './collectors.mjs';
import {publicationWorkflowHref} from './publication-workflow.mjs';
import {clientWorkflowHref} from './client-workflow.mjs';
import {buildClientProjectGroups} from './client-project-groups.mjs';
import {canWriteChannel} from './organization.mjs';
import {clientRightsSourceVisible} from './client-rights-reminders.mjs';

const MINUTE=60000,HOUR=60*MINUTE;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const iso=value=>instant(value)===null?null:new Date(value).toISOString();
const latest=values=>values.map(iso).filter(Boolean).sort().at(-1)||null;
const earliest=values=>values.map(iso).filter(Boolean).sort()[0]||null;
const own=(user,row)=>row&&(row.ownerId===user.id||row.assigneeId===user.id);
const visible=row=>row&&row.active!==false&&row.hidden!==true&&row.stage!=='archived';
const pair=row=>JSON.stringify([row.productionId,row.versionId,[...(row.channels||[])].sort()]);
const labels={idle:'대상 없음',ready:'확인 가능',running:'확인 중',scheduled:'예정대로 대기',paused:'자동 실행 꺼짐',delayed:'확인 지연',failed:'처리 오류',connection:'연결 확인 필요',partial:'일부 상태 미확인',manual:'직접 확인 대기',missed:'관측 시간 경과'};
const definitions=[
  ['package',1,'채널별 게시 묶음','on-demand','/?tab=workroom&section=tools&tool=publication','완성본과 채널을 선택해 실행할 때 묶음을 만듭니다.'],
  ['performance',2,'24·72시간 성과','scheduled','/?tab=workroom&section=tools&tool=publication','등록한 게시물의 관측 시각과 현재 수집 상태입니다.'],
  ['inbox',3,'완성본 자동 연결','scheduled','/?tab=workroom&section=tools&tool=publication','이 PC의 전달 폴더를 연결한 경우 확정본을 자동으로 읽습니다.'],
  ['today',4,'오늘 할 일 연결','on-demand','/?tab=home','현재 게시·고객 원문에서 할 일을 계산합니다.'],
  ['learning',5,'성과 회고·다음 기획','on-demand','/?tab=workroom&section=tools&tool=publication','기록된 72시간 수치를 조회할 때 정리합니다. 비교 자료 부족은 자동화 오류가 아닙니다.'],
  ['review',6,'게시 전 점검','manual','/?tab=workroom&section=tools&tool=publication','영상·음성·사실·사용권은 담당자가 직접 확인하고 기록합니다.'],
  ['client',7,'고객 후속 연락','manual','/?tab=workroom&section=clients','예약한 연락일을 할 일에 연결합니다. 고객에게 자동으로 연락하지 않습니다.'],
  ['links',8,'게시·자료 링크 확인','scheduled','/?tab=workroom&section=tools&tool=publication','저장한 현재 주소의 HTTP 응답을 확인합니다. 직접 열어야 하는 주소는 별도로 표시합니다.'],
  ['weekly',9,'주간 업무·성과 정리','scheduled','/?tab=workroom&section=tools&tool=weekly','매주 월요일 지난주 정리를 준비하고 조회할 때 현재 원문을 다시 읽습니다.'],
  ['delivery',11,'승인된 최종본 납품 준비','on-demand','/?tab=workroom&section=clients','현재 승인 시안과 납품 준비를 조회합니다. 고객 승인과 담당자 확인·최종 등록은 사람이 진행합니다.'],
  ['closeout',12,'납품 수령 확인·마감','on-demand','/?tab=workroom&section=clients','등록한 최종본의 수령 확인과 마감 기록을 조회합니다. 고객 수령 대기는 실행 오류가 아닙니다.'],
  ['kickoff',13,'제작 착수 전 자료·확정사항','on-demand','/?tab=workroom&section=clients','켜 둔 착수 점검의 현재 자료와 확정사항을 조회합니다. 자료 준비와 고객 확인은 사람이 진행합니다.'],
  ['changes',14,'제작 중 변경사항 확인','on-demand','/?tab=workroom&section=clients','저장한 비교 기준과 현재 제작 내용을 대조합니다. 변경 영향 검토와 기준 갱신은 담당자가 진행합니다.'],
  ['requests',15,'장면별 수정 요청·반영','on-demand','/?tab=workroom&section=clients','현재 담당 장면 요청과 본인 차례의 검토를 조회합니다. 수정 반영과 고객 확인 대기는 별도로 표시합니다.'],
  ['schedule',16,'제작 일정·고객 확인 지연','on-demand','/?tab=workroom&section=clients','켜 둔 일정 점검의 목표일과 현재 확인 대기를 계산합니다. 업무 지연을 시스템 실행 실패로 판단하지 않습니다.'],
  ['deliveryCheck',17,'납품 규격·파일 누락 점검','scheduled','/?tab=workroom&section=clients','현재 확정 규격과 납품 준비 파일의 자동 검사 상태입니다. 파일 불일치·누락·직접 확인은 담당자 업무로 구분합니다.'],
  ['rights',34,'자료 사용기한 만료 예정 확인','on-demand','/?tab=workroom&section=clients','담당 프로젝트의 현재 자료·공개 동의에 등록한 만료일을 한국 날짜로 확인합니다. 7일 전부터 오늘 할 일에 연결하며, 완료·보관 뒤에도 등록 기간은 확인합니다.'],
];
const clientCardIds=['delivery','closeout','kickoff','changes','requests','schedule','deliveryCheck'];

// Links are constructed from source identifiers. Never echo an arbitrary URL,
// filesystem path, provider error, customer note, or credentials to this view.
function item(value){return {id:clean(value.id,400),automationId:value.automationId,kind:clean(value.kind,80),status:value.status,statusLabel:value.statusLabel||labels[value.status]||'확인 필요',title:clean(value.title)||'작업 기록',text:clean(value.text,800),href:value.href,occurredAt:iso(value.occurredAt),dueAt:iso(value.dueAt),...(['customer','staff'].includes(value.waitingFor)?{waitingFor:value.waitingFor}:{})};}

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
    const now=instant(clock());if(now===null)throw fail('서버 시각을 확인해 주세요.',500);
    const refreshedAt=new Date(now).toISOString(),cards=definitions.map(([id,number,title,mode,href,text])=>({id,number,title,mode,href,text,status:'idle',statusLabel:labels.idle,lastAttemptAt:null,lastSuccessAt:null,lastSuccessLabel:mode==='scheduled'?'최근 정상 점검':'최근 결과',lastResultAt:null,nextRunAt:null,nextDueAt:null,checkedAt:null,counts:{targets:0,issues:0,manual:0,paused:0,customerWaiting:0,staffWaiting:0}})),byId=Object.fromEntries(cards.map(row=>[row.id,row])),issues=[],manual=[],partialIds=new Set(),observedIssueIds=new Set(),pending={performance:0,inbox:0,links:0,weekly:0};
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
      const observations=[],future=[];
      for(const entry of entries){
        const channel=channels.get(entry.channelId),rawChannel=store.get('channels',entry.channelId),creator=store.get('users',entry.createdBy),platform=PLATFORM_CAPABILITIES.find(row=>row.id===entry.platform);
        for(const checkpoint of entry.checkpoints||[]){
          if(![24,72].includes(checkpoint.hours))continue;
          const due=instant(checkpoint.dueAt),closes=instant(checkpoint.closesAt),href=publicationWorkflowHref('performance',{entryId:entry.id,checkpointHours:checkpoint.hours}),id=entry.id+':'+checkpoint.hours,title=entry.title||entry.channelName;
          const data={title,href,dueAt:checkpoint.dueAt,occurredAt:checkpoint.attemptedAt||checkpoint.recordedAt};
          if(rt.performance?.enabled!==false&&rawChannel?.collectionDisabled!==true)observed('performance',['window','connection','collection','late'],id);
          if(checkpoint.status==='recorded'&&Object.values(checkpoint.metrics||{}).some(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0)){observations.push(checkpoint.recordedAt);continue;}
          if(due===null||closes===null){mark(['performance']);continue;}
          if(due>now){future.push(checkpoint.dueAt);continue;}
          if(rt.performance?.enabled===false)continue;
          if(rawChannel?.collectionDisabled===true)continue;
          if(checkpoint.status==='missed'||now>closes){problem('performance','window',id,{...data,status:'missed',text:`${checkpoint.hours}시간 관측 기간이 지났습니다. 당시 확인한 수치가 있으면 실제 확인 시각과 함께 보완해 주세요. 과거 수치를 자동 복원하지 않습니다.`});continue;}
          if(platform?.mode==='manual'){human('performance','metric',id,{...data,statusLabel:'직접 수치 입력',text:'이 플랫폼은 자동 수집을 지원하지 않습니다. 공식 화면에서 확인한 수치를 기록해 주세요.'});continue;}
          if(channel?.connected!==true||!creator?.active||!canWriteChannel(creator,rawChannel)){
            problem('performance','connection',id,{...data,status:'connection',text:'현재 공식 채널 연결 또는 수집을 등록한 담당 권한을 확인해 주세요. 직접 확인한 수치도 기록할 수 있습니다.'});continue;
          }
          if(['pending','retry','collecting'].includes(checkpoint.status)&&(instant(checkpoint.nextAttemptAt)===null||instant(checkpoint.nextAttemptAt)<=now))pending.performance++;
          if(checkpoint.status==='collecting'&&instant(checkpoint.attemptedAt)!==null&&now-instant(checkpoint.attemptedAt)<3*MINUTE){byId.performance.status='running';continue;}
          if(checkpoint.status==='retry'||checkpoint.lastErrorCode){problem('performance','collection',id,{...data,status:'failed',text:instant(checkpoint.nextAttemptAt)>now?'자동 수집 응답을 기록하지 못했습니다. 기존 수집기가 예정된 시각에 다시 확인합니다.':'자동 수집 응답을 기록하지 못했습니다. 원문에서 수치와 연결 상태를 확인해 주세요.'});if(instant(checkpoint.nextAttemptAt)>now)future.push(checkpoint.nextAttemptAt);continue;}
          if(checkpoint.status==='manual-required'){human('performance','metric',id,{...data,statusLabel:'직접 수치 보완',text:'자동으로 확인하지 못한 수치가 있습니다. 공식 화면에서 직접 확인하고 기록해 주세요.'});continue;}
          const reference=checkpoint.status==='collecting'?checkpoint.attemptedAt||checkpoint.dueAt:checkpoint.nextAttemptAt||checkpoint.dueAt;
          if(instant(reference)!==null&&now-instant(reference)>15*MINUTE)problem('performance','late',id,{...data,status:'delayed',text:`${checkpoint.hours}시간 수치를 아직 기록하지 못했습니다. 관측 기간이 끝나기 전에 원문을 확인해 주세요.`});
          else byId.performance.status=rt.performance?.running?'running':'scheduled';
        }
      }
      byId.performance.lastResultAt=latest(observations);byId.performance.nextDueAt=earliest(future);
      if(entries.length&&entries.every(row=>store.get('channels',row.channelId)?.collectionDisabled===true))byId.performance.status='paused';
      let inbox=read(['inbox'],()=>publicationInbox.state(user),{available:false,active:false,entries:[]});
      if(!Array.isArray(inbox.entries)){mark(['inbox']);inbox={...inbox,entries:[]};}
      // The inbox screen intentionally shows only its latest 100 receipts. Older
      // still-failed personal receipts must not disappear from a health scan.
      const allReceipts=read(['inbox'],()=>store.all('publicationInboxEntries'),[]).filter(row=>row.ownerId===user.id);
      const receipts=[...new Map([...inbox.entries,...allReceipts].map(row=>[row.id,row])).values()].filter(row=>visible(row)&&(!row.productionId||productions.has(row.productionId)));
      byId.inbox.counts.targets=receipts.length;byId.inbox.lastResultAt=latest(receipts.filter(row=>['ready','duplicate'].includes(row.status)).map(row=>row.updatedAt||row.createdAt));
      if(!inbox.available||!inbox.active||rt.inbox?.enabled===false){byId.inbox.status='paused';byId.inbox.text=inbox.available?'완성본 자동 연결을 꺼 두었습니다. 다시 켜기 전까지 전달 오류로 알리지 않습니다.':'이 실행 환경에서 완성본 폴더 자동 연결을 사용할 수 없습니다.';}
      else{
        observed('inbox',['scan'],'current');
        if(inbox.message)problem('inbox','scan','current',{status:'failed',title:'완성본 폴더 확인',text:'전달 폴더의 최근 확인을 마치지 못했습니다. 기존 완성본 화면에서 폴더 상태를 확인해 주세요.',href:byId.inbox.href,occurredAt:inbox.lastScanAt});
        for(const row of receipts){observed('inbox',['import'],row.id);if(row.status==='error'){pending.inbox++;problem('inbox','import',row.id,{status:'failed',title:row.title,text:'확정본 전달을 마치지 못했습니다. 기존 전달 기록에서 파일과 묶음을 확인해 주세요.',href:row.productionId&&row.versionId?publicationWorkflowHref('prepare',{productionId:row.productionId,versionId:row.versionId}):byId.inbox.href,occurredAt:row.updatedAt||row.createdAt});}}
      }
      const workflow=read(['package','today','review'],()=>publicationWorkflow.workspace(user).items,[]);
      const ownWorkflow=workflow.filter(row=>row.entryId?entryIds.has(row.entryId):row.productionId?productions.has(row.productionId):false);
      for(const row of ownWorkflow){
        if(row.kind==='publication_prepare')human('package','prepare',row.id,{title:row.title,text:'완성한 영상을 확인한 뒤 필요한 채널의 게시 묶음을 만들어 주세요.',statusLabel:'게시 묶음 준비',href:row.inboxId?publicationWorkflowHref('prepare',{inboxId:row.inboxId}):publicationWorkflowHref('prepare',row),occurredAt:row.updatedAt});
        if(row.kind==='publication_publish'&&row.packageId&&packageIds.has(row.packageId))human('package','publish',row.id,{title:row.title,text:row.status==='format-required'?'등록한 게시물의 영상 형식을 원래 묶음에 연결해 주세요.':'파일을 확인하고 실제로 게시한 주소를 기록해 주세요.',statusLabel:row.status==='format-required'?'게시 형식 확인':'게시 주소 기록',href:publicationWorkflowHref('publish',row),occurredAt:row.updatedAt});
        if(row.kind==='publication_review'&&packageIds.has(row.packageId))human('review','check',row.packageId,{title:row.title,text:row.status==='needs-work'?'직접 점검에서 수정이 필요한 항목을 확인해 주세요.':'전체 재생·사실·사용권 등 남은 항목을 직접 확인해 주세요.',statusLabel:row.status==='needs-work'?'게시 전 수정 필요':'직접 점검 대기',href:publicationWorkflowHref('review',row),occurredAt:row.updatedAt});
      }
      byId.review.counts.targets=packages.length;
      const learning=read(['learning'],()=>publicationLearning.workspace(user).cards,[]).filter(row=>entryIds.has(row.entryId));
      byId.learning.counts.targets=learning.length;byId.learning.lastResultAt=latest(learning.map(row=>row.observedAt));byId.learning.lastSuccessAt=byId.learning.lastResultAt;
      if(learning.length)byId.learning.text=`현재 담당 게시물 ${learning.length}건의 기록을 조회할 때 정리합니다. 표본 부족과 아직 오지 않은 관측 시각은 오류가 아닙니다.`;
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
          human('rights','expiry',row.id+':'+entry.targetId,{title:row.title+' · '+entry.label,statusLabel:entry.statusLabel,waitingFor:'staff',text:`${entry.expiresAt}까지로 등록된 ${entry.kind==='portfolio'?'공개 동의':'자료 사용 조건'}입니다. ${entry.status==='expired'?'기간이 지나 현재 사용 여부와 갱신 근거를 확인해 주세요.':'기한 전에 사용 범위와 갱신 여부를 확인해 주세요.'}`,href:clientWorkflowHref(row.id)+'&rights=1&rightsTarget='+encodeURIComponent(entry.targetId),occurredAt:entry.recordedAt,dueAt:entry.expiresAt+'T00:00:00+09:00'});
        }
      }
      byId.rights.lastResultAt=latest(rightsResults);byId.rights.nextDueAt=earliest(rightsDates);
      for(const row of projects){
        if(row.ownerId!==user.id||!/^\d{4}-\d{2}-\d{2}$/.test(row.nextContactDate||''))continue;
        const dueAt=row.nextContactDate+'T00:00:00+09:00';if(instant(dueAt)===null||new Date(instant(dueAt)+9*HOUR).toISOString().slice(0,10)!==row.nextContactDate)continue;
        byId.client.counts.targets++;
        if(row.nextContactDate>today)contactDates.push(dueAt);
        else human('client','follow-up',row.id,{title:row.title,text:'예약한 연락일이 되었습니다. 고객에게 연락한 뒤 기존 프로젝트에서 결과와 다음 일정을 기록해 주세요.',statusLabel:row.nextContactDate<today?'연락일 지남':'오늘 연락',href:clientWorkflowHref(row.id)+'&followUp=1',dueAt});
      }
      byId.client.nextDueAt=earliest(contactDates);byId.client.lastResultAt=latest(projects.filter(row=>row.ownerId===user.id).flatMap(row=>(row.followUpHistory||[]).map(value=>value.at)));byId.client.lastSuccessAt=byId.client.lastResultAt;
      byId.today.counts.targets=ownWorkflow.length+clientItems.filter(row=>['reply','review','next'].includes(row.group)).length;
      byId.today.text='현재 게시·고객 원문에서 확인할 항목을 계산했습니다. 처리 대기는 자동화 실행 실패로 계산하지 않습니다.';
      for(const id of clientCardIds)if(!partialIds.has(id))byId[id].checkedAt=refreshedAt;
      const resultTimes=Object.fromEntries(clientCardIds.map(id=>[id,[]])),scheduledDeliveries=[];
      const resultLabels={delivery:'최근 승인·납품 기록',closeout:'최근 수령·마감 기록',kickoff:'최근 착수 설정',changes:'최근 비교 기준',requests:'최근 장면 처리',schedule:'최근 일정 설정',deliveryCheck:'최근 파일 검사 결과'};
      for(const id of clientCardIds)byId[id].lastResultLabel=resultLabels[id];
      const wait=(automationId,row,{customer=false,staff=false,...values})=>{if(customer)byId[automationId].counts.customerWaiting++;if(staff)byId[automationId].counts.staffWaiting++;human(automationId,'waiting',row.id,{title:row.title,href:clientWorkflowHref(row.id)+'&'+(automationId==='deliveryCheck'?'delivery':automationId)+'=1',waitingFor:staff?'staff':'customer',...values});};
      for(const row of projects){
        const owner=row.ownerId===user.id,versions=Array.isArray(row.versions)?row.versions:[],preview=versions.filter(value=>value.kind==='preview').at(-1),finals=preview?.approvedAt?versions.filter(value=>value.kind==='final'&&value.approvedPreviewId===preview.id):[];
        const strategy=row.studio?.strategy,strategyWaiting=Number.isSafeInteger(strategy?.revision)&&strategy.revision>0&&strategy.request?.strategyRevision===strategy.revision&&strategy.confirmation?.strategyRevision!==strategy.revision;
        const specifications=row.studio?.deliverables,specificationsWaiting=Number.isSafeInteger(specifications?.revision)&&specifications.revision>0&&Array.isArray(specifications.items)&&specifications.items.length>0&&specifications.request?.deliverableRevision===specifications.revision&&specifications.confirmation?.deliverableRevision!==specifications.revision;
        if(owner&&specificationsWaiting){byId.deliveryCheck.counts.targets++;wait('deliveryCheck',row,{customer:true,statusLabel:'고객 납품 규격 확인 대기',text:'담당자가 현재 납품 규격의 확인을 요청했습니다. 고객 확인을 기다리며, 확인 전에는 자동 파일 점검 대상으로 계산하지 않습니다.',occurredAt:specifications.request.at});}
        if(owner&&preview){
          const delivery=accessible(['delivery','deliveryCheck'],()=>clientDelivery?.get(user,row.id));
          if(!delivery||typeof delivery.status!=='string'||!Array.isArray(delivery.items)){if(delivery!==null)mark(['delivery','deliveryCheck']);}
          else{
            byId.delivery.counts.targets++;resultTimes.delivery.push(preview.approvedAt,...finals.map(value=>value.createdAt));
            if(delivery.status==='waiting_approval')wait('delivery',row,{customer:true,statusLabel:'고객 승인 대기',text:'최신 시안의 고객 승인을 기다립니다. 승인이 기록되면 납품 준비에 연결됩니다.',occurredAt:preview.createdAt});
            else if(['preparing','ready','feedback_pending'].includes(delivery.status))wait('delivery',row,{staff:true,statusLabel:delivery.status==='ready'?'담당자 납품 등록 대기':delivery.status==='feedback_pending'?'담당자 수정 요청 처리':'담당자 납품 준비',text:delivery.status==='ready'?'필수 파일과 직접 확인을 마쳤습니다. 담당자가 최종본과 사용 안내를 등록할 차례입니다.':delivery.status==='feedback_pending'?'남은 고객 수정 요청을 담당자가 확인할 차례입니다.':'승인 시안에 맞는 파일·사용 안내를 준비하고 직접 확인할 차례입니다.',occurredAt:preview.approvedAt});
            const report=delivery.deliveryCheck;
            if(!report||typeof report.status!=='string')mark(['deliveryCheck']);
            else if(report.confirmed&&preview.approvedAt&&report.status!=='existing_delivery'){
              byId.deliveryCheck.counts.targets++;resultTimes.deliveryCheck.push(report.checkedAt);scheduledDeliveries.push({row,preview,report});
              if(report.pendingCount>0)wait('deliveryCheck',row,{staff:true,statusLabel:report.statusLabel,text:`현재 규격·파일에서 ${Number.isInteger(report.blockingCount)?report.blockingCount:0}개 누락·불일치·검사 필요 항목과 ${Number.isInteger(report.manualCount)?report.manualCount:0}개 직접 확인 항목을 담당자가 확인할 차례입니다. 파일 점검 결과이며 시스템 실행 오류가 아닙니다.`,occurredAt:report.checkedAt});
            }
          }
        }
        const closeout=row.closeout;
        if(owner&&closeout?.deliveryKey){byId.closeout.counts.targets++;resultTimes.closeout.push(closeout.receipt?.confirmedAt,closeout.closure?.closedAt,closeout.lastClosure?.closedAt);if(closeout.status==='waiting_receipt')wait('closeout',row,{customer:true,statusLabel:'고객 수령 확인 대기',text:'고객이 현재 최종 파일과 사용 안내를 확인하기를 기다립니다. 고객 확인을 자동으로 대신하지 않습니다.',occurredAt:closeout.deliveredAt});else if(['follow_up','ready'].includes(closeout.status))wait('closeout',row,{staff:true,statusLabel:closeout.status==='ready'?'담당자 마감 확정 대기':'담당자 남은 업무 확인',text:closeout.status==='ready'?'고객 수령 확인이 기록됐습니다. 담당자가 프로젝트 마감을 확정할 차례입니다.':'수령 확인 뒤 남은 문의·수정 요청 또는 후속 연락을 담당자가 정리할 차례입니다.',occurredAt:closeout.receipt?.confirmedAt});}
        const kickoff=row.kickoff;
        if(owner&&row.stage!=='delivered'&&kickoff?.enabled){byId.kickoff.counts.targets++;resultTimes.kickoff.push(row.kickoffPlan?.updatedAt);if(kickoff.status==='waiting'){const missing=(kickoff.checks||[]).filter(check=>check.status!=='ready'),unconfirmed=missing.some(check=>check.id==='confirmation'),customer=unconfirmed&&strategyWaiting,staff=missing.some(check=>check.id!=='confirmation')||unconfirmed&&!strategyWaiting||(kickoff.requirements||[]).some(value=>value.required&&value.status!=='ready'&&value.status!=='waived');wait('kickoff',row,{customer,staff:staff||!customer,statusLabel:customer&&!staff?'고객 기획 확인 대기':'담당자 착수 준비 확인',text:`현재 착수 점검에서 ${Number.isInteger(kickoff.missingCount)?kickoff.missingCount:0}개 항목이 남았습니다.${customer?' 고객의 현재 기획 확인을 기다립니다.':''}${staff?' 담당자가 자료·합의 조건·확인 요청 여부를 확인할 차례입니다.':''}`,occurredAt:row.kickoffPlan?.updatedAt});}}
        else if(owner&&kickoff?.status==='disabled'&&row.kickoffPlan?.updatedAt)byId.kickoff.counts.paused++;
        const changes=row.changes;
        if(owner&&changes?.enabled){byId.changes.counts.targets++;resultTimes.changes.push(changes.baseline?.at,...(changes.history||[]).map(value=>value.at));const staff=['pending','reviewed'].includes(changes.status);if(staff||strategyWaiting)wait('changes',row,{customer:strategyWaiting,staff,statusLabel:staff?changes.status==='reviewed'?'담당자 비교 기준 갱신':'담당자 변경 영향 검토':'고객 기획 확인 대기',text:(staff?changes.status==='reviewed'?'현재 변경 검토가 끝났습니다. 담당자가 새 비교 기준을 확정할 차례입니다.':`확정 이후 달라진 내용과 ${Number.isInteger(changes.pendingCount)?changes.pendingCount:0}개 남은 확인 항목을 담당자가 검토할 차례입니다.`:'')+(strategyWaiting?' 요청한 현재 제작 기획의 고객 확인을 기다립니다.':''),occurredAt:changes.baseline?.at});}
        else if(owner&&changes?.status==='disabled'&&row.changeControl?.updatedAt)byId.changes.counts.paused++;
        const requests=Array.isArray(row.sceneRequests?.items)?row.sceneRequests.items:[],assigned=requests.filter(value=>value.status!=='archived'&&(owner||value.status==='review'&&Array.isArray(value.actions)&&value.actions.some(action=>['accept','request_changes'].includes(action.action))));
        if(assigned.length){byId.requests.counts.targets+=assigned.length;resultTimes.requests.push(...assigned.map(value=>value.updatedAt));const outstanding=assigned.filter(value=>value.status!=='done'),customers=outstanding.filter(value=>value.status==='waiting_customer').length,staff=outstanding.length-customers;if(outstanding.length)wait('requests',row,{customer:customers>0,staff:staff>0,statusLabel:staff?owner?'담당자 장면 요청 처리':'내 장면 검토 차례':'고객 장면 확인 대기',text:`현재 장면 요청에서 고객 확인 ${customers}건 · ${owner?'담당자 처리':'내부 검토'} ${staff}건을 기다립니다.`,occurredAt:latest(outstanding.map(value=>value.updatedAt))});}
        const schedule=row.schedule;
        if(owner&&schedule?.enabled){byId.schedule.counts.targets++;resultTimes.schedule.push(...(schedule.history||[]).map(value=>value.at));const waiting=Array.isArray(schedule.waiting)?schedule.waiting:[],customers=waiting.filter(value=>value.audience==='customer').length,staff=waiting.filter(value=>value.audience==='internal').length,due=schedule.pendingCount||0;if(customers||staff||due)wait('schedule',row,{customer:customers>0,staff:staff>0||due>0,statusLabel:due?'담당자 일정·확인 지연 점검':staff?'내부 검토 대기':'고객 확인 대기',text:`고객 확인 ${customers}건 · 내부 검토 ${staff}건을 기다리며, 현재 목표일·납기 위험에서 ${due}개 확인 항목이 있습니다. 업무 대기와 일정 지연이며 시스템 실행 오류가 아닙니다.`,occurredAt:schedule.checkedAt});}
        else if(owner&&schedule?.status==='disabled'&&row.schedulePlan?.updatedAt)byId.schedule.counts.paused++;
      }
      for(const id of clientCardIds)byId[id].lastResultAt=latest(resultTimes[id]);
      const deliveryCard=byId.deliveryCheck,deliveryRuntime=rt.deliveryCheck||{},deliveryInterval=Number.isFinite(deliveryRuntime.intervalMs)&&deliveryRuntime.intervalMs>0?deliveryRuntime.intervalMs:null;
      if(deliveryRuntime.enabled===false){deliveryCard.status='paused';deliveryCard.counts.paused=scheduledDeliveries.length;deliveryCard.text+=' 이 서버의 자동 실행이 꺼져 있습니다. 기존 검사 결과와 담당자 업무는 계속 확인할 수 있습니다.';}
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
              if(errorAt!==null&&(successAt===null||errorAt>successAt)){problem('deliveryCheck','runner',id,{status:'failed',title:row.title,text:'이 프로젝트의 최근 자동 파일 점검을 완료하지 못했습니다. 납품 준비 원문과 다음 점검 결과를 확인해 주세요.',href,occurredAt:state.lastErrorAt});continue;}
              if(state.running){if(attemptAt!==null&&now-attemptAt>grace)problem('deliveryCheck','stuck',id,{status:'delayed',title:row.title,text:'이 프로젝트의 자동 파일 점검이 시작됐지만 완료 기록이 늦어지고 있습니다. 서버 점검 상태를 확인해 주세요.',href,occurredAt:state.lastAttemptAt});else deliveryCard.status='running';continue;}
            }
            if(deliveryRuntime.running){if(deliveryCard.status==='idle')deliveryCard.status='scheduled';continue;}
            const contextAt=latest([row.updatedAt,preview.approvedAt,row.studio?.deliverables?.confirmation?.at]),anchor=latest([matching?state.lastAttemptAt:null,deliveryRuntime.startAt,contextAt]);
            if(deliveryRuntime.enabled===true&&deliveryInterval&&instant(anchor)!==null&&now-instant(anchor)>grace)problem('deliveryCheck','runner-late',id,{status:'delayed',title:row.title,text:'이 프로젝트의 자동 파일 점검 주기가 지났습니다. 서버가 실행 중인지 확인해 주세요.',href,dueAt:new Date(instant(anchor)+deliveryInterval).toISOString()});
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
        if(check.status==='error'&&rt.links?.enabled!==false)problem('links','response',target.kind+':'+target.id,{...data,status:'failed',text:'현재 저장된 주소에서 접속 오류 응답을 확인했습니다. 원문 링크와 다음 확인 결과를 살펴봐 주세요.'});
        else if(check.status==='manual-required')human('links','open',target.kind+':'+target.id,{...data,statusLabel:'링크 직접 확인',text:'로그인·접근 제한 등으로 자동 판정할 수 없습니다. 원문에서 실제 공개와 다운로드를 직접 확인해 주세요.'});
        const due=instant(check.nextCheckAt)??(!check.checkedAt?Math.max(instant(target.createdAt)||now,instant(rt.links?.startAt)||0):null);
        if(due!==null&&due<=now)pending.links++;
        const grace=Math.max(15*MINUTE,(rt.links?.intervalMs||MINUTE)*(Math.ceil(linkTargets.length/10)+2));
        if(rt.links?.enabled!==false&&due!==null&&now-due>grace&&check.status!=='error')problem('links','late',target.kind+':'+target.id,{...data,status:'delayed',text:'예정된 링크 재확인 결과가 아직 없습니다. 기존 링크 화면에서 현재 주소를 확인해 주세요.'});
      }
      byId.links.lastResultAt=latest(linkTimes);byId.links.nextDueAt=earliest(linkDue);
      const weekly=read(['weekly'],()=>weeklySummary.get(user),{});
      byId.weekly.counts.targets=weekly.period?1:0;byId.weekly.lastResultAt=iso(weekly.generatedAt);byId.weekly.nextDueAt=iso(weekly.schedule?.nextRunAt);
      if(weekly.period)observed('weekly',['missing'],weekly.period.startDate);
      if(weekly.sections?.some(row=>!['ready','empty'].includes(row.status)))mark(['weekly']);
      if(weekly.period&&!byId.weekly.lastResultAt)pending.weekly=1;
      if(pending.weekly&&rt.weekly?.enabled!==false&&instant(rt.weekly?.startAt)!==null&&now-instant(rt.weekly.startAt)>Math.max(5*MINUTE,(rt.weekly.intervalMs||MINUTE)*3))problem('weekly','missing',weekly.period.startDate,{status:'delayed',title:'지난주 정리 준비',text:'지난주 정리의 자동 준비 기록이 아직 없습니다. 주간 정리를 열면 현재 원문을 확인할 수 있습니다.',href:byId.weekly.href,dueAt:weekly.period.endAt});
      for(const id of ['performance','inbox','links','weekly']){
        const card=byId[id],state=rt[id]||{},interval=Number.isFinite(state.intervalMs)&&state.intervalMs>0?state.intervalMs:null;
        card.lastAttemptAt=iso(state.lastAttemptAt);card.lastSuccessAt=iso(state.lastSuccessAt);card.nextRunAt=state.enabled===false?null:iso(state.nextRunAt)||(interval&&instant(state.lastAttemptAt)!==null?new Date(instant(state.lastAttemptAt)+interval).toISOString():null);
        if(card.status==='paused'||state.enabled===false){card.status='paused';card.nextRunAt=null;if(state.enabled===false)card.text+=' 이 서버의 자동 실행이 꺼져 있습니다.';continue;}
        if(card.counts.targets===0)continue;
        const errorAt=instant(state.lastErrorAt),successAt=instant(state.lastSuccessAt);
        if(pending[id]||errorAt===null||successAt!==null&&successAt>=errorAt)observed(id,['runner'],'current');
        if(pending[id]&&errorAt!==null&&(successAt===null||errorAt>successAt))problem(id,'runner','current',{status:'failed',title:card.title+' 자동 확인',text:'최근 자동 점검을 완료하지 못했습니다. 개별 원문 상태를 확인하고 서버 점검 결과를 다시 읽어 주세요.',href:card.href,occurredAt:state.lastErrorAt});
        const anchor=instant(state.lastAttemptAt)||instant(state.startAt);
        if(pending[id]||anchor!==null&&interval&&now-anchor<=Math.max(5*MINUTE,interval*3))observed(id,['runner-late'],'current');
        if(pending[id]&&state.enabled===true&&interval&&anchor!==null&&now-anchor>Math.max(5*MINUTE,interval*3)&&!state.running)problem(id,'runner-late','current',{status:'delayed',title:card.title+' 실행 지연',text:'대상이 있지만 자동 확인 주기가 지났습니다. 서버가 실행 중인지 확인해 주세요.',href:card.href,dueAt:new Date(anchor+interval).toISOString()});
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
      if(partialIds.has(card.id)){card.status='partial';card.text+=' 일부 원문을 읽지 못해 완료 여부를 판단하지 않았습니다.';}
      else if(card.status!=='paused'&&mine.length)card.status=['failed','connection','missed','delayed'].find(status=>mine.some(row=>row.status===status))||'failed';
      else if(card.status!=='paused'&&card.status!=='running'&&card.counts.manual)card.status='manual';
      else if(card.status==='idle'&&card.counts.targets)card.status='ready';
      else if(card.status==='idle'&&card.counts.paused)card.status='paused';
      card.statusLabel=labels[card.status];
    }
    return {refreshedAt,cards,issues:issueRows,manual:manualRows,projectGroups,...(projectGroups===null?{projectGroupsError:'프로젝트별 할 일을 불러오지 못했습니다. 다시 확인해 주세요.'}:{}),observedIssueIds:[...observedIssueIds],counts:{issues:issueRows.length,manual:manualRows.length,running:cards.filter(row=>row.status==='running').length,paused:cards.filter(row=>row.status==='paused').length,partial:partialIds.size},note:'현재 본인 소유·담당 원문만 확인합니다. 정상 점검 시각은 모든 항목의 처리 완료를 뜻하지 않습니다. 이 조회는 원본 변경·외부 수집·재시도를 실행하지 않습니다.'};
  }
  return {get};
}
