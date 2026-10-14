import {POST_PERFORMANCE_METRICS} from './post-performance.mjs';
import {publicationWorkflowHref} from './publication-workflow.mjs';
import {clientWorkflowHref} from './client-workflow.mjs';

const DAY=86400000,WEEK=7*DAY,KST=9*3600000,KIND='weeklyWorkSummaries';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
const date=at=>new Date(at).toISOString().slice(0,10);
const dateValue=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&date(Date.parse(value+'T00:00:00Z'))===value?Date.parse(value+'T00:00:00Z'):null;
const own=(user,row)=>row.ownerId===user.id||row.assigneeId===user.id;
const inRange=(value,period)=>instant(value)!==null&&instant(value)>=Date.parse(period.startAt)&&instant(value)<Date.parse(period.endAt);
const nextDate=(value,period)=>dateValue(value)!==null&&value>=period.nextStartDate&&value<=period.nextEndDate;
const contentHref=id=>'/#'+new URLSearchParams({view:'content',section:'plan',draftId:id});
const safeHref=value=>typeof value==='string'&&/^\/(?:\?|#)[^\u0000-\u0020\\]*$/.test(value)?value:null;
function item(row){
  const value={id:clean(row.id,300),kind:clean(row.kind,80),title:clean(row.title)||'작업 기록',text:clean(row.text,800),href:safeHref(row.href),statusLabel:clean(row.statusLabel,100)};
  if(instant(row.occurredAt)!==null)value.occurredAt=new Date(row.occurredAt).toISOString();
  if(dateValue(row.dueDate)!==null)value.dueDate=row.dueDate;
  return value;
}
function periodAt(now,requested){
  const shifted=now+KST,today=Date.parse(date(shifted)+'T00:00:00Z'),day=new Date(today).getUTCDay();
  const monday=today-((day+6)%7)*DAY,latest=monday-WEEK,oldest=latest-51*WEEK;
  const selected=requested===undefined?latest:dateValue(requested);
  if(selected===null||new Date(selected).getUTCDay()!==1||selected<oldest||selected>latest)throw fail('최근 52주 중 끝난 주의 월요일을 선택해 주세요.');
  return {period:{startDate:date(selected),endDate:date(selected+6*DAY),startAt:new Date(selected-KST).toISOString(),endAt:new Date(selected+WEEK-KST).toISOString(),nextStartDate:date(selected+WEEK),nextEndDate:date(selected+13*DAY),label:`${date(selected)} ~ ${date(selected+6*DAY)}`},latestWeek:date(latest),oldestWeek:date(oldest),nextRunAt:new Date(monday+WEEK-KST).toISOString()};
}

// Only generation metadata is persisted. Every displayed item is rebuilt from
// its authoritative source and current permissions, including old weeks.
export function createWeeklySummaryService({store,studio,postPerformance,publicationWorkflow,publicationLearning,socialPublishing,clientProjects,clientWorkflow,contentService,taskSummary,clock=()=>new Date().toISOString()}={}){
  if(!store)throw new Error('Weekly summaries require a store.');
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function stamp(){const now=instant(clock());if(now===null)throw fail('서버 시각을 확인해 주세요.',500);return now;}
  function get(user,{week}={}){
    user=current(user);const now=stamp(),refreshedAt=new Date(now).toISOString(),calendar=periodAt(now,week),{period}=calendar;
    const sections=[{id:'completed',title:'기간에 남긴 완료 기록',items:[],note:'현재 원문에 남아 있는 확정본 등록·게시 시각·고객 처리·업무 완료 이력 기준입니다. 현재 상태는 다시 확인합니다.'},{id:'performance',title:'콘텐츠 성과',items:[],note:'선택한 주에 게시한 콘텐츠의 현재 확인 가능한 72시간 기록입니다. 미확인 수치는 0으로 계산하지 않습니다.'},{id:'attention',title:'지금 확인할 일',items:[],note:'선택한 주의 과거 상태가 아닌, 현재 남아 있는 조치입니다.'},{id:'upcoming',title:'다음 주 준비',items:[],note:`${period.nextStartDate} ~ ${period.nextEndDate}의 현재 일정과 아직 진행 중인 실험 메모 기획입니다. 기획에 정해진 날짜가 없으면 예정일로 추정하지 않습니다.`}];
    const byId=Object.fromEntries(sections.map(section=>[section.id,section]));
    const partial=(ids)=>{for(const id of ids)byId[id].status='partial';};
    const read=(ids,fn,fallback)=>{try{const result=fn();if(result==null||Array.isArray(fallback)&&!Array.isArray(result))throw new Error('Invalid source response');return result;}catch(error){partial(ids);return fallback;}};
    const accessible=(ids,fn)=>{try{return fn();}catch(error){if(![403,404,409,422].includes(error.status))partial(ids);return null;}};
    const add=(id,value)=>byId[id].items.push(item(value));
    // A viewer's wider read access is not a personal assignment.
    if(user.role!=='viewer'){
      const productions=new Map();
      for(const row of read(['completed','upcoming'],()=>store.all('studioProductions'),[])){
        if(!own(user,row)||!studio)continue;
        const visible=accessible(['completed','upcoming'],()=>studio.production(user,row.id)?.production);
        if(visible&&own(user,visible))productions.set(row.id,visible);
      }
      const receipts=new Map();
      for(const row of read(['completed'],()=>store.all('publicationInboxEntries'),[])){
        if(!['ready','duplicate'].includes(row.status)||instant(row.createdAt)===null)continue;
        const source=productions.get(row.productionId),version=source?.versions?.find(value=>value.id===row.versionId&&value.kind==='video'&&value.mediaId);
        if(!source||!version)continue;
        const key=JSON.stringify([row.productionId,row.versionId]),old=receipts.get(key);
        if(!old||instant(row.createdAt)<instant(old.createdAt))receipts.set(key,row);
      }
      for(const row of receipts.values()){
        if(!inRange(row.createdAt,period))continue;
        const source=productions.get(row.productionId),version=source.versions.find(value=>value.id===row.versionId);
        if(!accessible(['completed'],()=>studio.readableMedia(user,version.mediaId)))continue;
        const resumed=!['ready','published','archived'].includes(source.stage);
        add('completed',{id:'studio:'+source.id+':'+version.id,kind:'studio_completed',title:source.title,text:resumed?'확정본 등록 이력이 있습니다. 현재 제작이 다시 진행 중입니다.':'확정본이 작업실에 등록된 기록입니다.',href:publicationWorkflowHref('prepare',{productionId:source.id,versionId:version.id}),statusLabel:resumed?'확정본 등록 · 현재 진행 중':source.stage==='archived'?'확정본 등록 · 현재 보관':'확정본 등록',occurredAt:row.createdAt});
      }
      for(const row of productions.values()){
        if(['ready','published','archived'].includes(row.stage)||!nextDate(row.dueDate,period))continue;
        const version=(row.versions||[]).filter(value=>value.kind==='video'&&value.mediaId).at(-1);
        add('upcoming',{id:'studio:due:'+row.id,kind:'studio_due',title:row.title,text:'현재 제작 기한입니다. 원본의 진행 상태를 확인해 주세요.',statusLabel:'제작 기한',dueDate:row.dueDate,href:version?publicationWorkflowHref('prepare',{productionId:row.id,versionId:version.id}):row.canReadDraft&&row.draftId?contentHref(row.draftId):null});
      }
      const entries=read(['completed','performance'],()=>postPerformance?postPerformance.list(user).entries:[],[]).filter(row=>{
        const channel=store.get('channels',row.channelId);return channel?.active!==false&&channel?.ownerIds?.includes(user.id)&&row.canEdit===true;
      });
      const weekEntries=entries.filter(row=>inRange(row.publishedAt,period));
      const cards=new Map(read(['performance'],()=>publicationLearning?publicationLearning.workspace(user).cards:[],[]).map(row=>[row.entryId,row]));
      for(const row of weekEntries){
        const href=publicationWorkflowHref('performance',{entryId:row.id,checkpointHours:72});
        add('completed',{id:'post:'+row.id,kind:'post_published',title:row.title||row.channelName,text:'실제 게시 주소와 게시 시각을 기록했습니다. 공개 접속 여부는 링크 점검에서 확인합니다.',statusLabel:row.active===false?'게시 기록 · 추적 중지':'게시 기록',occurredAt:row.publishedAt,href});
        const card=cards.get(row.id),checkpoint=(row.checkpoints||[]).find(value=>value.hours===72),facts=[];
        if(card)for(const definition of POST_PERFORMANCE_METRICS){
          const fact=(card.facts||[]).find(value=>value.id===definition.id),value=fact?.value;
          if(typeof value!=='number'||!Number.isFinite(value)||value<0||definition.unit==='count'&&!Number.isSafeInteger(value)||definition.max!==undefined&&value>definition.max||instant(fact?.observedAt)===null||instant(fact.observedAt)>now)continue;
          let text=definition.label+' '+value+(definition.unit==='percent'?'%':definition.unit==='seconds'?'초':'회');
          const comparison=fact.comparison;
          if(comparison?.status==='ready'&&Number.isSafeInteger(comparison.sampleCount)&&comparison.sampleCount>=3&&Number.isFinite(comparison.median)&&comparison.median>=0){text+=` (이전 ${comparison.sampleCount}편 중앙값 ${comparison.median}`+(definition.unit==='percent'?'%':definition.unit==='seconds'?'초':'회');if(Number.isFinite(comparison.deltaPercent))text+=`, ${comparison.deltaPercent>0?'+':''}${comparison.deltaPercent}%`;else if(comparison.median===0)text+=', 중앙값 0: 변화율 계산 안 함';text+=')';}
          facts.push(text);
        }
        const waiting=instant(checkpoint?.dueAt)!==null&&instant(checkpoint.dueAt)>now;
        const outside=card?.limits?.some(value=>/관측 창을 벗어난/.test(value));
        add('performance',{id:'performance:'+row.id,kind:'post_performance',title:row.title||row.channelName,text:row.active===false?'성과 추적이 중지된 기록입니다.':facts.length?facts.join(' · ')+(outside?' · 관측 시각이 불완전하거나 관측 창을 벗어난 수치는 비교에서 제외됩니다.':''):waiting?'아직 72시간 확인 시각이 되지 않았습니다.':'확인된 72시간 수치가 없습니다. 미확인은 0이 아닙니다.',statusLabel:row.active===false?'추적 중지':facts.length?outside?'관측 조건 확인':'확인된 기록':waiting?'72시간 관측 대기':'수치 미확인',occurredAt:row.publishedAt,href});
      }
      for(const row of read(['attention'],()=>publicationWorkflow?publicationWorkflow.workspace(user).items:[],[]))add('attention',{...row,text:'게시 준비·점검·성과의 현재 원문을 확인해 주세요.'});
      for(const job of read(['upcoming'],()=>socialPublishing?socialPublishing.workspace(user).jobs:[],[])){
        const channel=store.get('channels',job.channelId),at=instant(job.scheduledAt);
        if(at===null||!['scheduled','manual'].includes(job.status)||!(job.publisherId===user.id||channel?.ownerIds?.includes(user.id)))continue;
        const dueDate=date(at+KST);if(!nextDate(dueDate,period))continue;
        add('upcoming',{id:'social:schedule:'+job.id,kind:'social_schedule',title:job.contentSummary?.title||channel?.displayName||'SNS 게시 예약',text:`${channel?.displayName||channel?.platform||'SNS'} · ${new Date(at+KST).toISOString().slice(11,16)} 한국 시간. ${job.status==='manual'?'앱에서 수동 마무리가 필요합니다.':job.paused?'현재 중단된 예약입니다.':'현재 저장된 게시 일정입니다.'}`,statusLabel:job.status==='manual'?'수동 마무리':job.paused?'예약 중단':'게시 예약',dueDate,href:'/?tab=social&section=queue&post='+encodeURIComponent(job.postId)});
      }
      const projects=read(['completed','upcoming'],()=>clientProjects?clientProjects.workspace(user).projects:[],[]).filter(row=>row.ownerId===user.id||row.reviewerId===user.id);
      for(const row of projects){
        const href=clientWorkflowHref(row.id);
        if(row.ownerId===user.id){
          for(const history of row.followUpHistory||[])if(inRange(history.at,period))add('completed',{id:'client:contact:'+row.id+':'+history.id,kind:'client_follow_up',title:row.title,text:history.disposition==='schedule'?'연락 결과를 기록하고 다음 연락을 예약했습니다.':'연락 결과를 기록하고 후속 연락을 마쳤습니다.',statusLabel:'연락 결과 기록',occurredAt:history.at,href:href+'&followUp=1'});
          for(const version of row.versions||[])if(version.kind==='final'&&inRange(version.createdAt,period))add('completed',{id:'client:final:'+row.id+':'+version.id,kind:'client_delivery',title:row.title,text:'고객 프로젝트에 최종본을 등록한 기록입니다.',statusLabel:row.stage==='delivered'?'최종본 등록 · 현재 납품':'최종본 등록',occurredAt:version.createdAt,href:clientWorkflowHref(row.id,version.id)});
          for(const receipt of row.deliveryReceipts||[])if(inRange(receipt.confirmedAt,period))add('completed',{id:'client:receipt:'+row.id+':'+receipt.id,kind:'client_delivery_receipt',title:row.title,text:'고객이 해당 납품 파일과 사용 안내를 확인했다고 기록했습니다. 다운로드·시청 완료를 추정한 기록이 아닙니다.',statusLabel:row.closeout?.deliveryKey===receipt.deliveryKey?'고객 수령 확인':'이전 납품 수령 확인',occurredAt:receipt.confirmedAt,href:href+'&closeout=1'});
          for(const closure of row.closureHistory||[])if(inRange(closure.closedAt,period))add('completed',{id:'client:closeout:'+row.id+':'+closure.id,kind:'client_closeout',title:row.title,text:row.closeout?.closure?.id===closure.id?'고객 확인과 남은 업무를 점검하고 담당자가 프로젝트 마감을 확정했습니다.':'기간 중 마감한 기록입니다. 이후 변경된 납품과 남은 업무를 다시 확인해 주세요.',statusLabel:row.closeout?.closure?.id===closure.id?'프로젝트 마감':'마감 이력 · 현재 다시 확인',occurredAt:closure.closedAt,href:href+'&closeout=1'});
          if(row.stage!=='archived'&&row.closeout?.deliveryKey&&!row.closeout.receipt&&nextDate(row.closeout.dueDate,period))add('upcoming',{id:'client:receipt-due:'+row.id+':'+row.closeout.deliveryKey,kind:'client_receipt_due',title:row.title,text:'납품한 파일의 고객 확인 여부를 점검할 날짜입니다.',statusLabel:'수령 확인 예정',dueDate:row.closeout.dueDate,href:href+'&closeout=1'});
          if(row.stage!=='archived'&&nextDate(row.nextContactDate,period))add('upcoming',{id:'client:contact:'+row.id,kind:'client_follow_up',title:row.title,text:'예약한 날짜에 원문을 확인하고 연락 결과를 남겨 주세요.',statusLabel:'연락 예정',dueDate:row.nextContactDate,href:href+'&followUp=1'});
          if(!['archived','delivered'].includes(row.stage)&&nextDate(row.dueDate,period))add('upcoming',{id:'client:due:'+row.id,kind:'client_due',title:row.title,text:'현재 고객 프로젝트에 기록된 기한입니다.',statusLabel:'고객 업무 기한',dueDate:row.dueDate,href});
          if(!['archived','delivered'].includes(row.stage)&&row.kickoff?.enabled&&row.kickoff.status==='waiting'&&nextDate(row.kickoff.dueDate,period))add('upcoming',{id:'client:kickoff:'+row.id,kind:'client_kickoff_due',title:row.title,text:'제작에 필요한 자료와 기획·합의 기록을 점검할 날짜입니다.',statusLabel:'착수 자료 확인 예정',dueDate:row.kickoff.dueDate,href:href+'&kickoff=1'});
          if(row.schedule?.enabled&&!['archived','complete'].includes(row.schedule.status)){
            for(const milestone of row.schedule.milestones||[])if(!['complete','not_required'].includes(milestone.status)&&nextDate(milestone.targetDate,period))add('upcoming',{id:'client:schedule:'+row.id+':'+milestone.id,kind:'client_schedule_due',title:row.title+' · '+milestone.label,text:'담당자가 설정한 내부 목표일입니다. 현재 원문의 완료 여부를 확인해 주세요.',statusLabel:'제작 단계 목표일',dueDate:milestone.targetDate,href:href+'&schedule=1'});
            for(const waiting of row.schedule.waiting||[])if(nextDate(waiting.dueDate,period))add('upcoming',{id:'client:schedule-wait:'+row.id+':'+waiting.id,kind:'client_schedule_wait',title:row.title+' · '+waiting.label,text:'현재 확인 요청과 설정한 대기 기간을 기준으로 계산한 점검일입니다.',statusLabel:'확인 대기 점검일',dueDate:waiting.dueDate,href:href+'&schedule=1'});
          }
        }
        for(const message of row.messages||[]){
          if(message.author!=='customer'||message.action==='approve')continue;
          const history=(message.workflow?.history||[]).filter(value=>value.action==='complete'&&inRange(value.at,period));
          if(inRange(message.resolvedAt,period))history.push({at:message.resolvedAt});
          const latest=history.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];if(!latest)continue;
          const done=message.resolved===true||message.workflow?.status==='done';
          add('completed',{id:'client:done:'+row.id+':'+message.id,kind:'client_resolved',title:row.title,text:done?'고객 요청을 처리한 기록입니다.':'기간 중 처리 기록이 있으며 현재 다시 진행 중입니다.',statusLabel:done?'고객 요청 처리':'처리 기록 · 현재 진행 중',occurredAt:latest.at,href:clientWorkflowHref(row.id,message.workflow?.resultVersionId||message.versionId,message.id)});
        }
      }
      for(const row of read(['attention'],()=>clientWorkflow?clientWorkflow.workspace(user).items:[],[]))if(['reply','review','next'].includes(row.group))add('attention',{...row,title:row.projectTitle||row.title,text:'고객 프로젝트의 현재 요청과 처리 상태를 원문에서 확인해 주세요.'});
      if(contentService)for(const summary of read(['upcoming'],()=>contentService.workspace(user).drafts,[])){
        if(summary.ownerId!==user.id||!['draft','review','ready'].includes(summary.status)||instant(summary.createdAt)===null||instant(summary.createdAt)>=dateValue(period.nextEndDate)+DAY-KST||instant(summary.createdAt)>now)continue;
        const draft=accessible(['upcoming'],()=>contentService.readDraft(user,summary.id)?.draft);
        if(!draft||draft.ownerId!==user.id||!clean(draft.input?.editorialNote||draft.plan?.input?.editorialNote))continue;
        add('upcoming',{id:'experiment:'+draft.id,kind:'content_experiment',title:draft.title,text:'저장된 제작 실험 메모가 있습니다. 실행 날짜와 선택 내용을 원문에서 확인해 주세요.',statusLabel:'실험 메모가 있는 기획 · 날짜 미지정',href:contentHref(draft.id)});
      }
      if(taskSummary){
        const tasks=read(['completed','attention','upcoming'],()=>taskSummary(user,{startAt:period.startAt,endAt:period.endAt,nextStartDate:period.nextStartDate,nextEndDate:period.nextEndDate}),{});
        for(const section of ['completed','attention','upcoming'])for(const row of tasks?.[section]||[])add(section,row);
      }
    }
    for(const section of sections){
      section.items=[...new Map(section.items.map(row=>[row.id,row])).values()].sort((a,b)=>section.id==='upcoming'?(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.id.localeCompare(b.id):(b.occurredAt||'').localeCompare(a.occurredAt||'')||a.id.localeCompare(b.id));
      section.total=section.items.length;
      if(section.status==='partial')section.note+=' 일부 원문을 읽지 못했습니다. 새로 확인해 주세요.';
      else section.status=section.total?'ready':'empty';
    }
    const metadata=store.get(KIND,user.id+':'+period.startDate);
    return {period,generatedAt:metadata?.generatedAt||null,refreshedAt,sections,counts:Object.fromEntries(sections.map(section=>[section.id,section.total])),schedule:{enabled:true,timeZone:'Asia/Seoul',cadence:'weekly',dayOfWeek:1,nextRunAt:calendar.nextRunAt,latestWeek:calendar.latestWeek,oldestWeek:calendar.oldestWeek,note:'서버가 실행되는 동안 매주 월요일 지난주 정리를 준비합니다. 꺼져 있던 경우 다시 켤 때 가장 최근 지난주를 준비합니다.'}};
  }
  function scanDue(){
    const now=stamp(),{period}=periodAt(now),generatedAt=new Date(now).toISOString();let created=0,existing=0;
    store.transaction(()=>{for(const user of store.all('users')){
      if(!user.active||user.role==='viewer')continue;
      const id=user.id+':'+period.startDate;
      if(store.get(KIND,id)){existing++;continue;}
      store.put(KIND,id,{id,ownerId:user.id,week:period.startDate,generatedAt,schema:1});created++;
    }});
    return {week:period.startDate,created,existing};
  }
  return {get,scanDue};
}
