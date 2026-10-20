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
  const value={id:clean(row.id,300),kind:clean(row.kind,80),title:clean(row.title)||'제목 없는 기록',text:clean(row.text,800),href:safeHref(row.href),statusLabel:clean(row.statusLabel,100)};
  if(instant(row.occurredAt)!==null)value.occurredAt=new Date(row.occurredAt).toISOString();
  if(dateValue(row.dueDate)!==null)value.dueDate=row.dueDate;
  return value;
}
function periodAt(now,requested){
  const shifted=now+KST,today=Date.parse(date(shifted)+'T00:00:00Z'),day=new Date(today).getUTCDay();
  const monday=today-((day+6)%7)*DAY,latest=monday-WEEK,oldest=latest-51*WEEK;
  const selected=requested===undefined?latest:dateValue(requested);
  if(selected===null||new Date(selected).getUTCDay()!==1||selected<oldest||selected>latest)throw fail('최근 52주 안에서 끝난 주의 월요일을 골라 주세요.');
  return {period:{startDate:date(selected),endDate:date(selected+6*DAY),startAt:new Date(selected-KST).toISOString(),endAt:new Date(selected+WEEK-KST).toISOString(),nextStartDate:date(selected+WEEK),nextEndDate:date(selected+13*DAY),label:`${date(selected)} ~ ${date(selected+6*DAY)}`},latestWeek:date(latest),oldestWeek:date(oldest),nextRunAt:new Date(monday+WEEK-KST).toISOString()};
}

// Only generation metadata is persisted. Every displayed item is rebuilt from
// its authoritative source and current permissions, including old weeks.
export function createWeeklySummaryService({store,studio,postPerformance,publicationWorkflow,publicationLearning,socialPublishing,clientProjects,clientWorkflow,contentService,taskSummary,clock=()=>new Date().toISOString()}={}){
  if(!store)throw new Error('Weekly summaries require a store.');
  function current(user){const live=user?.id&&store.get('users',user.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function stamp(){const now=instant(clock());if(now===null)throw fail('서버 시계를 읽지 못했어요. 잠시 뒤 다시 해 주세요.',500);return now;}
  function get(user,{week}={}){
    user=current(user);const now=stamp(),refreshedAt=new Date(now).toISOString(),calendar=periodAt(now,week),{period}=calendar;
    const sections=[{id:'completed',title:'끝낸 일',items:[],note:'그 주에 남은 완료 기록(완성본·게시·고객 일·업무)을 모았어요. 상태 표시는 지금 기준이에요.'},{id:'performance',title:'콘텐츠 성과',items:[],note:'그 주에 게시한 콘텐츠의 72시간 숫자예요. 아직 못 받은 숫자는 0으로 치지 않아요.'},{id:'attention',title:'지금 할 일',items:[],note:'그 주의 상태가 아니라 지금 남아 있는 할 일이에요.'},{id:'upcoming',title:'다음 주 준비',items:[],note:`${period.nextStartDate} ~ ${period.nextEndDate} 일정과, 실험 메모가 있는 진행 중 기획이에요. 날짜를 정하지 않은 기획은 예정일을 짐작해 넣지 않아요.`}];
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
        add('completed',{id:'studio:'+source.id+':'+version.id,kind:'studio_completed',title:source.title,text:resumed?'완성본이 도착한 기록이 있어요. 지금은 제작을 다시 하고 있어요.':'완성본이 작업실에 도착한 기록이에요.',href:publicationWorkflowHref('prepare',{productionId:source.id,versionId:version.id}),statusLabel:resumed?'완성본 도착 · 지금 다시 진행 중':source.stage==='archived'?'완성본 도착 · 지금 보관됨':'완성본 도착',occurredAt:row.createdAt});
      }
      for(const row of productions.values()){
        if(['ready','published','archived'].includes(row.stage)||!nextDate(row.dueDate,period))continue;
        const version=(row.versions||[]).filter(value=>value.kind==='video'&&value.mediaId).at(-1);
        add('upcoming',{id:'studio:due:'+row.id,kind:'studio_due',title:row.title,text:'지금 정해 둔 제작 기한이에요. 작업이 어디까지 됐는지 봐 주세요.',statusLabel:'제작 기한',dueDate:row.dueDate,href:version?publicationWorkflowHref('prepare',{productionId:row.id,versionId:version.id}):row.canReadDraft&&row.draftId?contentHref(row.draftId):null});
      }
      const entries=read(['completed','performance'],()=>postPerformance?postPerformance.list(user).entries:[],[]).filter(row=>{
        const channel=store.get('channels',row.channelId);return channel?.active!==false&&channel?.ownerIds?.includes(user.id)&&row.canEdit===true;
      });
      const weekEntries=entries.filter(row=>inRange(row.publishedAt,period));
      const cards=new Map(read(['performance'],()=>publicationLearning?publicationLearning.workspace(user).cards:[],[]).map(row=>[row.entryId,row]));
      for(const row of weekEntries){
        const href=publicationWorkflowHref('performance',{entryId:row.id,checkpointHours:72});
        add('completed',{id:'post:'+row.id,kind:'post_published',title:row.title||row.channelName,text:'실제 게시 주소와 시각을 기록했어요. 주소에 접속되는지는 링크 확인에서 봐요.',statusLabel:row.active===false?'게시 기록 · 숫자 모으기 꺼짐':'게시 기록',occurredAt:row.publishedAt,href});
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
        const outside=card?.limits?.some(value=>/밖에 읽은 숫자는 비교에서/.test(value));
        add('performance',{id:'performance:'+row.id,kind:'post_performance',title:row.title||row.channelName,text:row.active===false?'이 게시물은 숫자 모으기를 꺼 두었어요.':facts.length?facts.join(' · ')+(outside?' · 읽은 시각이 불확실하거나 모을 기간을 벗어난 숫자는 비교에서 뺐어요.':''):waiting?'아직 72시간 숫자를 읽을 시각이 안 됐어요.':'72시간 숫자를 아직 못 받았어요. 못 받은 숫자는 0이 아니에요.',statusLabel:row.active===false?'숫자 모으기 꺼짐':facts.length?outside?'일부 비교 제외':'숫자 있음':waiting?'72시간 기다리는 중':'숫자 미확인',occurredAt:row.publishedAt,href});
      }
      for(const row of read(['attention'],()=>publicationWorkflow?publicationWorkflow.workspace(user).items:[],[]))add('attention',{...row,text:'게시 준비·성과에서 지금 상태를 보고 이어 가 주세요.'});
      for(const job of read(['upcoming'],()=>socialPublishing?socialPublishing.workspace(user).jobs:[],[])){
        const channel=store.get('channels',job.channelId),at=instant(job.scheduledAt);
        if(at===null||!['scheduled','manual'].includes(job.status)||!(job.publisherId===user.id||channel?.ownerIds?.includes(user.id)))continue;
        const dueDate=date(at+KST);if(!nextDate(dueDate,period))continue;
        add('upcoming',{id:'social:schedule:'+job.id,kind:'social_schedule',title:job.contentSummary?.title||channel?.displayName||'SNS 게시 예약',text:`${channel?.displayName||channel?.platform||'SNS'} · ${new Date(at+KST).toISOString().slice(11,16)} 한국 시간. ${job.status==='manual'?'앱에서 직접 마무리해야 해요.':job.paused?'멈춘 예약이에요.':'저장된 게시 예약이에요.'}`,statusLabel:job.status==='manual'?'직접 마무리':job.paused?'예약 멈춤':'게시 예약',dueDate,href:'/?tab=social&section=queue&post='+encodeURIComponent(job.postId)});
      }
      const projects=read(['completed','upcoming'],()=>clientProjects?clientProjects.workspace(user).projects:[],[]).filter(row=>row.ownerId===user.id||row.reviewerId===user.id);
      for(const row of projects){
        const href=clientWorkflowHref(row.id);
        if(row.ownerId===user.id){
          for(const history of row.followUpHistory||[])if(inRange(history.at,period))add('completed',{id:'client:contact:'+row.id+':'+history.id,kind:'client_follow_up',title:row.title,text:history.disposition==='schedule'?'연락 결과를 적고 다음 연락 날짜를 잡았어요.':'연락 결과를 적고 다음 연락 없이 마쳤어요.',statusLabel:'연락 결과 기록',occurredAt:history.at,href:href+'&followUp=1'});
          for(const version of row.versions||[])if(version.kind==='final'&&inRange(version.createdAt,period))add('completed',{id:'client:final:'+row.id+':'+version.id,kind:'client_delivery',title:row.title,text:'고객 프로젝트에 최종본을 올린 기록이에요.',statusLabel:row.stage==='delivered'?'최종본 올림 · 지금 납품됨':'최종본 올림',occurredAt:version.createdAt,href:clientWorkflowHref(row.id,version.id)});
          for(const receipt of row.deliveryReceipts||[])if(inRange(receipt.confirmedAt,period))add('completed',{id:'client:receipt:'+row.id+':'+receipt.id,kind:'client_delivery_receipt',title:row.title,text:'고객이 납품 파일과 사용 안내를 받았다고 눌렀어요. 실제로 내려받거나 봤는지는 알 수 없어요.',statusLabel:row.closeout?.deliveryKey===receipt.deliveryKey?'받았다고 함':'이전 납품 · 받았다고 함',occurredAt:receipt.confirmedAt,href:href+'&closeout=1'});
          for(const closure of row.closureHistory||[])if(inRange(closure.closedAt,period))add('completed',{id:'client:closeout:'+row.id+':'+closure.id,kind:'client_closeout',title:row.title,text:row.closeout?.closure?.id===closure.id?'고객 확인과 남은 일을 보고 프로젝트를 마감했어요.':'그 주에 마감한 기록이에요. 그 뒤로 납품이나 남은 일이 바뀌었으니 지금 상태를 봐 주세요.',statusLabel:row.closeout?.closure?.id===closure.id?'프로젝트 마감':'이전 마감 기록',occurredAt:closure.closedAt,href:href+'&closeout=1'});
          if(row.stage!=='archived'&&row.closeout?.deliveryKey&&!row.closeout.receipt&&nextDate(row.closeout.dueDate,period))add('upcoming',{id:'client:receipt-due:'+row.id+':'+row.closeout.deliveryKey,kind:'client_receipt_due',title:row.title,text:'고객이 납품 파일을 받았는지 물어볼 날이에요.',statusLabel:'수령 확인할 날',dueDate:row.closeout.dueDate,href:href+'&closeout=1'});
          if(row.stage!=='archived'&&nextDate(row.nextContactDate,period))add('upcoming',{id:'client:contact:'+row.id,kind:'client_follow_up',title:row.title,text:'정해 둔 날에 고객에게 연락하고 결과를 남겨 주세요.',statusLabel:'연락 예정',dueDate:row.nextContactDate,href:href+'&followUp=1'});
          if(!['archived','delivered'].includes(row.stage)&&nextDate(row.dueDate,period))add('upcoming',{id:'client:due:'+row.id,kind:'client_due',title:row.title,text:'고객 프로젝트에 적어 둔 기한이에요.',statusLabel:'프로젝트 기한',dueDate:row.dueDate,href});
          if(!['archived','delivered'].includes(row.stage)&&row.kickoff?.enabled&&row.kickoff.status==='waiting'&&nextDate(row.kickoff.dueDate,period))add('upcoming',{id:'client:kickoff:'+row.id,kind:'client_kickoff_due',title:row.title,text:'시작 준비에서 받을 자료와 정해 둘 것을 챙길 날이에요.',statusLabel:'자료 챙길 날',dueDate:row.kickoff.dueDate,href:href+'&kickoff=1'});
          if(row.schedule?.enabled&&!['archived','complete'].includes(row.schedule.status)){
            for(const milestone of row.schedule.milestones||[])if(!['complete','not_required'].includes(milestone.status)&&nextDate(milestone.targetDate,period))add('upcoming',{id:'client:schedule:'+row.id+':'+milestone.id,kind:'client_schedule_due',title:row.title+' · '+milestone.label,text:'담당자가 정한 내부 목표일이에요. 그 단계가 끝났는지 프로젝트에서 봐 주세요.',statusLabel:'제작 단계 목표일',dueDate:milestone.targetDate,href:href+'&schedule=1'});
            for(const waiting of row.schedule.waiting||[])if(nextDate(waiting.dueDate,period))add('upcoming',{id:'client:schedule-wait:'+row.id+':'+waiting.id,kind:'client_schedule_wait',title:row.title+' · '+waiting.label,text:'확인을 요청한 뒤 기다리기로 한 기간이 끝나는 날이에요. 그때까지 답이 없으면 다시 물어봐 주세요.',statusLabel:'기다림 끝나는 날',dueDate:waiting.dueDate,href:href+'&schedule=1'});
          }
        }
        for(const message of row.messages||[]){
          if(message.author!=='customer'||message.action==='approve')continue;
          const history=(message.workflow?.history||[]).filter(value=>value.action==='complete'&&inRange(value.at,period));
          if(inRange(message.resolvedAt,period))history.push({at:message.resolvedAt});
          const latest=history.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];if(!latest)continue;
          const done=message.resolved===true||message.workflow?.status==='done';
          add('completed',{id:'client:done:'+row.id+':'+message.id,kind:'client_resolved',title:row.title,text:done?'고객 요청을 처리한 기록이에요.':'그 주에 처리했지만 지금 다시 진행 중이에요.',statusLabel:done?'요청 처리함':'처리함 · 지금 다시 진행 중',occurredAt:latest.at,href:clientWorkflowHref(row.id,message.workflow?.resultVersionId||message.versionId,message.id)});
        }
      }
      for(const row of read(['attention'],()=>clientWorkflow?clientWorkflow.workspace(user).items:[],[]))if(['reply','review','next'].includes(row.group))add('attention',{...row,title:row.projectTitle||row.title,text:'고객 프로젝트에서 남은 요청과 처리 상태를 봐 주세요.'});
      if(contentService)for(const summary of read(['upcoming'],()=>contentService.workspace(user).drafts,[])){
        if(summary.ownerId!==user.id||!['draft','review','ready'].includes(summary.status)||instant(summary.createdAt)===null||instant(summary.createdAt)>=dateValue(period.nextEndDate)+DAY-KST||instant(summary.createdAt)>now)continue;
        const draft=accessible(['upcoming'],()=>contentService.readDraft(user,summary.id)?.draft);
        if(!draft||draft.ownerId!==user.id||!clean(draft.input?.editorialNote||draft.plan?.input?.editorialNote))continue;
        add('upcoming',{id:'experiment:'+draft.id,kind:'content_experiment',title:draft.title,text:'저장한 제작 실험 메모가 있어요. 기획에서 언제 해 볼지, 무엇을 고를지 정해 주세요.',statusLabel:'실험 메모 · 날짜 없음',href:contentHref(draft.id)});
      }
      if(taskSummary){
        const tasks=read(['completed','attention','upcoming'],()=>taskSummary(user,{startAt:period.startAt,endAt:period.endAt,nextStartDate:period.nextStartDate,nextEndDate:period.nextEndDate}),{});
        for(const section of ['completed','attention','upcoming'])for(const row of tasks?.[section]||[])add(section,row);
      }
    }
    for(const section of sections){
      section.items=[...new Map(section.items.map(row=>[row.id,row])).values()].sort((a,b)=>section.id==='upcoming'?(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.id.localeCompare(b.id):(b.occurredAt||'').localeCompare(a.occurredAt||'')||a.id.localeCompare(b.id));
      section.total=section.items.length;
      if(section.status==='partial')section.note+=' 일부 기록을 읽지 못했어요. 새로고침해 주세요.';
      else section.status=section.total?'ready':'empty';
    }
    const metadata=store.get(KIND,user.id+':'+period.startDate);
    return {period,generatedAt:metadata?.generatedAt||null,refreshedAt,sections,counts:Object.fromEntries(sections.map(section=>[section.id,section.total])),schedule:{enabled:true,timeZone:'Asia/Seoul',cadence:'weekly',dayOfWeek:1,nextRunAt:calendar.nextRunAt,latestWeek:calendar.latestWeek,oldestWeek:calendar.oldestWeek,note:'서버가 켜져 있으면 매주 월요일에 지난주 정리를 준비해요. 꺼져 있었다면 다시 켤 때 가장 최근 주를 준비해요.'}};
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
