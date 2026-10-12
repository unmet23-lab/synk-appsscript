import {buildClientKickoff} from './client-kickoff.mjs';
import {buildSceneRequests} from './client-scene-requests.mjs';
import {clientDeliveryIdentity} from './client-closeout.mjs';

const DAY=86400000;
const records=value=>Array.isArray(value)?value:[];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const ids=['kickoff','preview','customer','revision','delivery'];
const targetLabels={kickoff:'제작 착수 준비',preview:'첫 시안 등록',customer:'현재 고객 확인',revision:'수정 요청 처리',delivery:'현재 최종본 납품'};
const stateLabels={complete:'완료',not_required:'처리할 수정 요청 없음',undated:'내부 목표일 없음',upcoming:'진행 예정',due:'오늘 확인',overdue:'확인일 지남'};
const statusLabels={disabled:'일정 점검 꺼짐',archived:'보관됨',complete:'현재 납품 완료',attention:'일정 확인 필요',tracking:'일정 확인 중'};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const day=value=>{const time=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(time)?new Date(time+9*3600000).toISOString().slice(0,10):'';};
const dateNumber=value=>Date.parse(value+'T00:00:00Z');
function shift(value,count,calendar){let time=dateNumber(value),remaining=count;while(remaining>0){time+=DAY;const weekDay=new Date(time).getUTCDay();if(calendar==='calendar'||weekDay!==0&&weekDay!==6)remaining--;}return new Date(time).toISOString().slice(0,10);}
function distance(start,end,calendar){if(start===end)return 0;if(start>end)return -distance(end,start,calendar);const days=Math.round((dateNumber(end)-dateNumber(start))/DAY);if(calendar==='calendar')return days;let result=Math.floor(days/7)*5;const weekDay=new Date(dateNumber(start)).getUTCDay();for(let i=1;i<=days%7;i++){const day=(weekDay+i)%7;if(day!==0&&day!==6)result++;}return result;}
const bounded=(value,min,max)=>value===null||Number.isSafeInteger(value)&&value>=min&&value<=max;
function configuration(value={}){value=object(value)?value:{};return {enabled:value.enabled===true,calendar:value.calendar==='weekdays'?'weekdays':'calendar',targets:Object.fromEntries(ids.map(id=>[id,validDate(value.targets?.[id])?value.targets[id]:''])),remainingWorkDays:bounded(value.remainingWorkDays,0,365)?value.remainingWorkDays:null,customerWaitDays:bounded(value.customerWaitDays,1,60)?value.customerWaitDays:null,internalReviewDays:bounded(value.internalReviewDays,1,60)?value.internalReviewDays:null};}
function link(row,tab='strategy',sceneId=null){const params=new URLSearchParams({mode:'staff',project:row.id,tab});if(sceneId)params.set('scene',sceneId);return '/pulse-app/?'+params;}
function workroom(row,context){return '/?'+new URLSearchParams({tab:'workroom',section:'clients',project:row.id,[context]:'1'});}
function feedbackLink(row,message){const params=new URLSearchParams({tab:'workroom',section:'clients',project:row.id}),versionId=message.workflow?.resultVersionId||message.versionId;if(versionId)params.set('version',versionId);params.set('message',message.id);if(Number.isFinite(message.seconds)&&message.seconds>=0)params.set('seconds',String(message.seconds));return '/?'+params;}
function dateState(date,today){return !date?'undated':date<today?'overdue':date===today?'due':'upcoming';}

export function buildClientSchedule(row,{now=new Date().toISOString(),canEdit=false,reviewerId=row.reviewerId||null}={}){
  const today=day(now);if(!validDate(today))throw fail('서버 시각을 확인해 주세요.',500);
  const plan=configuration(row.schedulePlan),{calendar}=plan,preview=records(row.versions).filter(version=>version.kind==='preview').at(-1),delivery=clientDeliveryIdentity(row),sceneRequests=buildSceneRequests(row,{reviewerId}),feedback=records(row.messages).filter(message=>message.author==='customer'&&message.action==='feedback'&&message.visibility!=='internal'),pendingFeedback=feedback.filter(message=>!message.resolved),kickoff=buildClientKickoff(row,{now}),waitingByKey=new Map();
  function addWait({id,kind,label,audience,since,href}){
    const previous=waitingByKey.get(id),sourceDay=day(since),oldDay=day(previous?.since);if(previous&&oldDay&&(!sourceDay||Date.parse(previous.since)<=Date.parse(since)))return;
    const limit=audience==='customer'?plan.customerWaitDays:plan.internalReviewDays,dueDate=sourceDay&&limit!==null?shift(sourceDay,limit,calendar):'',status=dateState(dueDate,today);
    waitingByKey.set(id,{id,kind,label,audience,since:sourceDay?since:'',elapsedDays:sourceDay?Math.max(0,distance(sourceDay,today,calendar)):null,dueDate,status,statusLabel:status==='undated'?'대기 확인일 미정':stateLabels[status],href,overdue:status==='overdue',due:status==='due'});
  }
  const strategy=row.studio?.strategy;
  if(strategy?.revision>0&&strategy.request?.strategyRevision===strategy.revision&&strategy.confirmation?.strategyRevision!==strategy.revision)addWait({id:'strategy:'+strategy.revision,kind:'strategy',label:'제작 기획 고객 확인',audience:'customer',since:strategy.request.at,href:link(row)});
  const specs=row.studio?.deliverables;
  if(specs?.revision>0&&specs.request?.deliverableRevision===specs.revision&&specs.confirmation?.deliverableRevision!==specs.revision)addWait({id:'deliverables:'+specs.revision,kind:'deliverables',label:'납품 규격 고객 확인',audience:'customer',since:specs.request.at,href:link(row)});
  if(preview&&!preview.approvedAt)addWait({id:'preview:customer:'+preview.id,kind:'preview',label:'현재 시안 고객 승인',audience:'customer',since:preview.createdAt,href:link(row,'review')});
  for(const item of sceneRequests.items){
    if(!['review','waiting_customer'].includes(item.status))continue;
    const scene=records(row.studio?.scenes).find(scene=>scene.id===item.sceneId);if(!scene||scene.visibility!=='customer')continue;
    const workflow=row.sceneRequestWorkflows?.[item.id],audience=item.status==='review'?'internal':'customer';
    addWait({id:'scene:'+audience+':'+item.sceneId+':'+item.resultRevision,kind:'scene',label:'장면 '+(audience==='internal'?'내부 검토':'고객 확인')+' · '+item.title,audience,since:audience==='internal'?workflow?.submittedAt:workflow?.waitingAt,href:workroom(row,'requests')});
  }
  for(const message of pendingFeedback){
    const workflow=message.workflow;if(!['review','waiting_customer'].includes(workflow?.status)||!preview||workflow.resultVersionId!==preview.id)continue;
    const audience=workflow.status==='review'?'internal':'customer';if(audience==='internal'&&!reviewerId||audience==='customer'&&preview.approvedAt)continue;
    const events=records(workflow.history),event=events.findLast(event=>audience==='internal'?event.action==='submit_review':['accept','submit_review'].includes(event.action));
    addWait({id:'preview:'+audience+':'+preview.id,kind:'preview',label:audience==='internal'?'현재 수정 시안 내부 검토':'현재 시안 고객 승인',audience,since:event?.at||workflow.updatedAt,href:link(row,'review')});
  }
  const waiting=[...waitingByKey.values()].sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.id.localeCompare(b.id)),customerWaiting=waiting.filter(item=>item.audience==='customer'),requestCount=sceneRequests.items.length+feedback.length,pendingRevisions=sceneRequests.pendingCount+pendingFeedback.length,hasFinal=!!delivery.deliveryKey;
  const completed={kickoff:kickoff.enabled&&kickoff.status==='ready',preview:!!preview,customer:!!preview?.approvedAt&&customerWaiting.length===0,revision:pendingRevisions===0,delivery:hasFinal};
  const reasons={kickoff:!kickoff.enabled?'기존 착수 점검을 설정한 뒤 필수 자료와 확정사항을 확인해 주세요.':completed.kickoff?'현재 착수 점검에서 필수 자료와 확정사항을 확인했습니다.':'현재 착수 점검에서 '+kickoff.missingCount+'개 항목을 확인해야 합니다.',preview:preview?'현재 프로젝트에 시안이 등록돼 있습니다.':'첫 시안을 등록해 주세요.',customer:completed.customer?'현재 시안 승인과 요청한 고객 확인이 끝났습니다.':!preview?'시안 등록 후 고객 확인을 진행합니다.':customerWaiting.length?'현재 고객 확인 '+customerWaiting.length+'건이 남아 있습니다.':'현재 시안의 고객 승인이 필요합니다.',revision:requestCount?pendingRevisions?pendingRevisions+'개 장면·시안 수정 요청이 남아 있습니다.':'기록된 장면·시안 수정 요청 처리가 완료됐습니다.':'현재 처리할 장면·시안 수정 요청이 없습니다.',delivery:hasFinal?'현재 승인 시안에 연결된 최종 파일 '+delivery.finals.length+'개가 등록돼 있습니다.':'현재 고객이 승인한 시안의 최종 파일을 등록해 주세요.'};
  const feedbackTarget=pendingFeedback[0]||feedback.at(-1);
  const hrefs={kickoff:workroom(row,'kickoff'),preview:link(row,'review'),customer:customerWaiting[0]?.href||link(row,'review'),revision:sceneRequests.pendingCount||!feedbackTarget?workroom(row,'requests'):feedbackLink(row,feedbackTarget),delivery:workroom(row,'delivery')};
  const fullyDelivered=hasFinal&&completed.customer&&completed.revision&&waiting.length===0,active=plan.enabled&&row.stage!=='archived'&&!fullyDelivered;
  const milestones=ids.map(id=>{const targetDate=plan.targets[id],status=id==='revision'&&!requestCount?'not_required':completed[id]?'complete':dateState(targetDate,today);return {id,label:targetLabels[id],targetDate,status,statusLabel:stateLabels[status],reason:reasons[id],href:hrefs[id],overdue:active&&status==='overdue',due:active&&status==='due'};});
  const agreedDueDate=validDate(row.dueDate)?row.dueDate:'',remainingDays=agreedDueDate?distance(today,agreedDueDate,calendar):null,estimatedFinishDate=plan.remainingWorkDays===null?'':shift(today,plan.remainingWorkDays,calendar);
  let risk={status:'unknown',text:'남은 작업일을 입력하면 합의한 전달일과 비교할 수 있습니다.'};
  if(!plan.enabled)risk={status:'not_configured',text:'일정 점검을 켜면 현재 기록과 내부 목표일을 확인합니다.'};
  else if(fullyDelivered)risk={status:'complete',text:'현재 승인 시안의 최종본이 등록됐고 남은 수정·확인 요청이 없습니다.'};
  else if(!agreedDueDate)risk={status:'undated',text:'프로젝트에 합의한 전달일이 없습니다. 내부 목표일과 별도로 기록해 주세요.'};
  else if(agreedDueDate<today)risk={status:'overdue',text:'합의한 전달일이 지났습니다. 현재 남은 작업과 일정을 확인해 주세요.'};
  else if(estimatedFinishDate&&estimatedFinishDate>agreedDueDate)risk={status:'at_risk',text:'입력한 남은 작업일 기준 예상 완료일이 합의한 전달일보다 늦습니다. 남은 범위와 일정을 확인해 주세요.'};
  else if(agreedDueDate===today)risk={status:'due',text:'오늘이 합의한 전달일입니다. 현재 남은 작업과 전달 준비를 확인해 주세요.'};
  else if(estimatedFinishDate)risk={status:'on_track',text:'입력한 남은 작업일 기준 예상 완료일이 합의한 전달일 안에 있습니다. 내부 계산값이며 완료를 보장하지 않습니다.'};
  if(!active)for(const item of waiting){item.overdue=false;item.due=false;}
  const pendingCount=active?milestones.filter(item=>item.due||item.overdue).length+waiting.filter(item=>item.due||item.overdue).length+( ['at_risk','overdue','due'].includes(risk.status)?1:0):0,status=row.stage==='archived'?'archived':!plan.enabled?'disabled':fullyDelivered?'complete':pendingCount?'attention':'tracking';
  return {...plan,canEdit:!!canEdit&&row.stage!=='archived',calendarLabel:calendar==='weekdays'?'평일(월~금, 공휴일 미반영)':'달력일',checkedAt:now,today,status,statusLabel:statusLabels[status],pendingCount,agreedDueDate,estimatedFinishDate,remainingDays,risk,milestones,waiting,history:records(row.schedulePlan?.history).map(entry=>({at:entry.at,...configuration(entry)}))};
}

export function applyClientScheduleAction(row,input,{actor,at}={}){
  const fields=['action','revision','enabled','calendar','targets','remainingWorkDays','customerWaitDays','internalReviewDays'];
  if(!object(input)||input.action!=='configure'||Object.keys(input).some(key=>!fields.includes(key)))throw fail('일정 점검 입력 항목을 확인해 주세요.');
  if(row.stage==='archived')throw fail('보관한 프로젝트입니다.',409);
  if(typeof input.enabled!=='boolean'||!['calendar','weekdays'].includes(input.calendar)||!object(input.targets)||Object.keys(input.targets).some(key=>!ids.includes(key))||ids.some(id=>typeof input.targets[id]!=='string'||input.targets[id]!==''&&!validDate(input.targets[id])))throw fail('일정 점검 사용 여부·달력 기준·내부 목표일을 확인해 주세요.');
  if(!bounded(input.remainingWorkDays,0,365)||!bounded(input.customerWaitDays,1,60)||!bounded(input.internalReviewDays,1,60))throw fail('남은 작업일은 0~365일, 확인 대기 기준은 1~60일 또는 미설정으로 입력해 주세요.');
  const next=configuration(input),previous=configuration(row.schedulePlan);if(JSON.stringify(next)===JSON.stringify(previous))throw fail('변경한 일정 점검 설정이 없습니다.',409);
  const history=records(row.schedulePlan?.history);if(history.length>=100)throw fail('일정 설정 기록 100개를 보존하고 있습니다. 기존 기록을 보존하며 새 프로젝트로 이어가 주세요.',409);
  return {...row.schedulePlan,...next,updatedAt:at,updatedBy:actor,history:[...history,{at,actor,...next}]};
}
