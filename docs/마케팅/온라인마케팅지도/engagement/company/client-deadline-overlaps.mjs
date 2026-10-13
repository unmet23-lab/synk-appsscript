const DAY=86400000,KST=9*3600000,WINDOW_DAYS=30;
const milestones=new Set(['preview','customer','revision','delivery']);
const activeStatuses=new Set(['undated','overdue','due','upcoming']);
const scheduleStatuses=new Set(['disabled','archived','complete','attention','tracking']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message,status=500)=>Object.assign(new Error(message),{status});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const compare=(a,b)=>a<b?-1:a>b?1:0;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const scheduleHref=projectId=>'/?'+new URLSearchParams({tab:'workroom',section:'clients',project:projectId,schedule:'1'});
function sourceHref(value,projectId){
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\u0000-\u0020\\]/.test(value))throw fail('일정 링크를 만들지 못했어요. 새로 불러와 주세요.');
  let url;try{url=new URL(value,'https://workspace.invalid');}catch{throw fail('일정 링크를 만들지 못했어요. 새로 불러와 주세요.');}
  if(url.origin!=='https://workspace.invalid'||url.hash||url.searchParams.getAll('project').length!==1||url.searchParams.get('project')!==projectId||!(url.pathname==='/'&&url.searchParams.get('tab')==='workroom'&&url.searchParams.get('section')==='clients'||url.pathname==='/pulse-app/'&&url.searchParams.get('mode')==='staff'))throw fail('일정 링크를 만들지 못했어요. 새로 불러와 주세요.');
  return value;
}
function periodAt(now){
  const time=typeof now==='string'?Date.parse(now):NaN;if(!Number.isFinite(time))throw fail('서버 시계를 읽지 못했어요. 잠시 뒤 다시 해 주세요.');
  const startDate=new Date(time+KST).toISOString().slice(0,10),endDate=new Date(Date.parse(startDate+'T00:00:00Z')+WINDOW_DAYS*DAY).toISOString().slice(0,10);
  if(!validDate(startDate)||!validDate(endDate))throw fail('볼 날짜 범위를 계산하지 못했어요.');
  return {startDate,endDate,daysAhead:WINDOW_DAYS,inclusive:true,timezone:'Asia/Seoul'};
}
function observation(){return {projectCount:0,milestoneCount:0,projects:[]};}
function addObservation(target,project,count){if(!count)return;target.projectCount++;target.milestoneCount+=count;target.projects.push({projectId:project.id,title:project.title,count,href:scheduleHref(project.id)});}
const milestoneOrder=(a,b)=>compare(a.dateType,b.dateType)||compare(a.id,b.id);

// Accept only fresh staff projections from clientProjects.workspace(). Completion,
// current-version waiting clocks and reviewer validity belong to buildClientSchedule;
// do not infer them again from stages, estimates, old final files or old approvals.
export function buildClientDeadlineOverlaps(projects,{now=new Date().toISOString()}={}){
  if(!Array.isArray(projects))throw fail('프로젝트 일정을 불러오지 못했어요. 새로 불러와 주세요.');
  const period=periodAt(now),byDate=new Map(),seen=new Set(),rangeProjects=new Set(),overlapProjects=new Set();
  const observations={excluded:{disabled:0,archived:0,closed:0,complete:0},undated:observation(),overdue:observation(),outsideWindow:observation()};
  let eligibleProjectCount=0,rangeMilestoneCount=0;
  for(const project of projects){
    if(!object(project)||!uuid.test(project.id||'')||typeof project.title!=='string'||seen.has(project.id)||!object(project.schedule)||typeof project.schedule.enabled!=='boolean'||!scheduleStatuses.has(project.schedule.status))throw fail('일정 형식이 이상해요. 새로 불러와 주세요.');
    seen.add(project.id);
    const schedule=project.schedule;
    if(project.stage==='archived'||schedule.status==='archived'){observations.excluded.archived++;continue;}
    if(project.closeout?.status==='closed'&&project.closeout.closure){observations.excluded.closed++;continue;}
    if(!schedule.enabled||schedule.status==='disabled'){observations.excluded.disabled++;continue;}
    if(schedule.status==='complete'){observations.excluded.complete++;continue;}
    if(!Array.isArray(schedule.milestones)||!Array.isArray(schedule.waiting))throw fail('일정 항목을 불러오지 못했어요. 새로 불러와 주세요.');
    eligibleProjectCount++;
    const entries=[],ids=new Set(),targetIds=new Set();
    function add({id,kind,label,date,dateType,dateTypeLabel,audience,href}){
      if(typeof id!=='string'||!id||ids.has(id)||typeof label!=='string'||!label||date!==''&&!validDate(date))throw fail('기한 정보를 읽지 못했어요. 새로 불러와 주세요.');
      ids.add(id);entries.push({id,kind,label,date,dateType,dateTypeLabel,audience,href:sourceHref(href,project.id)});
    }
    for(const target of schedule.milestones){
      if(!object(target))throw fail('단계 일정을 읽지 못했어요. 새로 불러와 주세요.');
      if(!milestones.has(target.id))continue;
      if(targetIds.has(target.id))throw fail('단계 일정이 겹쳐요. 새로 불러와 주세요.');
      targetIds.add(target.id);
      if(['complete','not_required'].includes(target.status))continue;
      if(!activeStatuses.has(target.status))throw fail('단계가 끝났는지 읽지 못했어요. 새로 불러와 주세요.');
      add({id:'target:'+target.id,kind:target.id,label:target.label,date:target.targetDate,dateType:'internal',dateTypeLabel:'목표일',audience:'staff',href:target.href});
    }
    if(targetIds.size!==milestones.size)throw fail('단계 일정을 다 불러오지 못했어요. 새로 불러와 주세요.');
    for(const wait of schedule.waiting){
      if(!object(wait)||typeof wait.id!=='string'||!wait.id||typeof wait.kind!=='string'||!wait.kind||!activeStatuses.has(wait.status)||!['customer','internal'].includes(wait.audience))throw fail('고객 확인·내부 검토 일정을 읽지 못했어요. 새로 불러와 주세요.');
      add({id:'waiting:'+wait.id,kind:wait.kind,label:wait.label,date:wait.dueDate,dateType:'check',dateTypeLabel:wait.audience==='customer'?'고객 확인 기다릴 날':'내부 검토 기다릴 날',audience:wait.audience,href:wait.href});
    }
    add({id:'agreed:delivery',kind:'agreed_delivery',label:'합의한 전달일',date:schedule.agreedDueDate,dateType:'agreed',dateTypeLabel:'합의한 전달일',audience:'staff',href:scheduleHref(project.id)});
    let undated=0,overdue=0,outside=0;
    for(const entry of entries){
      if(!entry.date){undated++;continue;}
      if(entry.date<period.startDate){overdue++;continue;}
      if(entry.date>period.endDate){outside++;continue;}
      rangeMilestoneCount++;rangeProjects.add(project.id);
      if(!byDate.has(entry.date))byDate.set(entry.date,new Map());
      const day=byDate.get(entry.date);if(!day.has(project.id))day.set(project.id,{projectId:project.id,title:project.title,href:scheduleHref(project.id),milestones:[]});
      day.get(project.id).milestones.push(entry);
    }
    addObservation(observations.undated,project,undated);addObservation(observations.overdue,project,overdue);addObservation(observations.outsideWindow,project,outside);
  }
  const days=[];
  for(const [date,byProject]of byDate){
    if(byProject.size<2)continue;
    const projects=[...byProject.values()].sort((a,b)=>compare(a.projectId,b.projectId));
    for(const project of projects){overlapProjects.add(project.projectId);project.milestones.sort(milestoneOrder);}
    days.push({date,projectCount:projects.length,milestoneCount:projects.reduce((count,project)=>count+project.milestones.length,0),projects});
  }
  days.sort((a,b)=>compare(a.date,b.date));
  for(const key of ['undated','overdue','outsideWindow'])observations[key].projects.sort((a,b)=>compare(a.projectId,b.projectId));
  return {checkedAt:now,period,days,counts:{visibleProjectCount:projects.length,eligibleProjectCount,rangeProjectCount:rangeProjects.size,rangeMilestoneCount,overlapDayCount:days.length,overlapProjectCount:overlapProjects.size,overlapMilestoneCount:days.reduce((count,day)=>count+day.milestoneCount,0)},observations,scope:'내가 볼 수 있는 프로젝트',note:'오늘부터 30일 안의 날짜가 겹치는 곳이에요. 일이 얼마나 많은지를 뜻하지는 않아요. 날짜가 없거나 범위 밖인 일은 겹침에 들어가지 않아요.'};
}

export function createClientDeadlineOverlapsService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function get(user){
    const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('로그인이 풀렸어요. 다시 로그인해 주세요.',401);
    // workspace rechecks current roles, ownership and reviewer/team membership.
    // The report is computed on demand: it does not create another task or timer.
    return buildClientDeadlineOverlaps(clientProjects.workspace(live).projects,{now:clock()});
  }
  return Object.freeze({get});
}
