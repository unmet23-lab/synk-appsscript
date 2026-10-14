import {randomUUID,createHash} from 'node:crypto';
import {canManageOwners} from './organization.mjs';

const HOUR=3600000,MINUTE=60000,PLANS='socialCapacityPlans';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// This is the workspace's conservative request budget, not Postiz's advertised
// create-post quota. Media cache hits and shared status polls can lower usage.
export function createSocialCapacity({store,publishing,provider,clock=()=>new Date().toISOString()}){
  const now=()=>new Date(clock()).toISOString();
  function current(user,write=false){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('열람 계정에서는 예약을 변경할 수 없습니다.',403);return live;}
  function state(user){
    user=current(user);const view=publishing.workspace(user),visible=new Set(view.jobs.map(job=>job.id));
    const jobs=store.all('socialPublishJobs').filter(job=>{const c=store.get('channels',job.channelId);return visible.has(job.id)&&job.status==='scheduled'&&c?.active!==false&&c?.hidden!==true;});
    const settings=provider.settings(user),limit=settings.rateLimit?.requests||30,reserve=Math.min(6,Math.max(1,limit-1)),planningLimit=limit-reserve;
    const records=jobs.map(job=>{
      const channel=store.get('channels',job.channelId),post=store.get('socialPosts',job.postId),variant=job.snapshot?.variant||{},cap=provider.capability(channel);
      const automatic=cap?.mode==='automatic'&&cap?.canPublish===true&&variant.options?.notifyOnly!==true;
      const estimatedRequests=automatic?4+(variant.media||[]).length+(variant.options?.coverUrl?1:0):0;
      const canMove=job.attempts===0&&channel?.active!==false&&channel?.hidden!==true&&post?.approval?.hash===job.approvalHash&&post?.contentVersion===job.contentVersion&&post?.variants?.every(v=>canManageOwners(user,store.get('channels',v.channelId)));
      return {jobId:job.id,channelId:job.channelId,title:job.snapshot?.post?.title||post?.title||'게시물',scheduledAt:job.scheduledAt,mode:job.mode,estimatedRequests,canMove:!!canMove,reason:!automatic?'자동 발행 대상이 아니므로 호출량에서 제외':!canMove?'승인 버전·발행 권한·시도 이력을 확인해 주세요.':null};
    }).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.jobId.localeCompare(b.jobId));
    const stamp=Date.parse(now()),requests=store.get('socialProviderRequests','postiz')||{};
    const recent=(requests.times||[]).filter(at=>Number.isFinite(at)&&at>stamp-HOUR).map(at=>({at,cost:1}));
    const events=records.filter(row=>row.estimatedRequests>0).map(row=>({at:Date.parse(row.scheduledAt),cost:row.estimatedRequests,jobId:row.jobId,channelId:row.channelId}));
    const signature=hash({jobs:jobs.map(j=>[j.id,j.updatedAt,j.scheduledAt,j.scheduleRevision,j.attempts,j.status,j.approvalHash]),channels:view.channels.map(c=>[c.id,c.active,c.canPublish,c.capability]),policies:store.all('socialQueuePolicies'),requests,limit,reserve});
    return {user,records,jobs,events,recent,limit,reserve,planningLimit,signature,retryAfter:requests.retryAfter||0};
  }
  function workspace(user){
    const data=state(user),windows=[],timeline=[...data.events,...data.recent].sort((a,b)=>a.at-b.at);let left=0,right=0,sum=0,count=0,lastEnd=null;
    for(const event of data.events){if(event.at===lastEnd)continue;lastEnd=event.at;while(right<timeline.length&&timeline[right].at<=event.at){sum+=timeline[right].cost;if(timeline[right].jobId)count++;right++;}while(left<right&&timeline[left].at<=event.at-HOUR){sum-=timeline[left].cost;if(timeline[left].jobId)count--;left++;}windows.push({from:new Date(event.at-HOUR).toISOString(),to:new Date(event.at).toISOString(),estimatedRequests:sum,jobCount:count,overLimit:sum>data.planningLimit});}
    const hot=[];for(const window of windows.filter(w=>w.overLimit)){const previous=hot.at(-1);if(previous&&window.from<=previous.to)previous.to=window.to;else hot.push({...window});}let hotIndex=0;
    const records=data.records.map(row=>{while(hotIndex<hot.length&&hot[hotIndex].to<row.scheduledAt)hotIndex++;return {...row,congested:!!(row.estimatedRequests&&hot[hotIndex]&&row.scheduledAt>hot[hotIndex].from&&row.scheduledAt<=hot[hotIndex].to)};});
    const warnings=[];if(windows.some(row=>row.overLimit))warnings.push('한 시간 안의 예상 호출량이 계획 한도를 넘습니다. 예약 분산을 확인해 주세요.');
    if(data.retryAfter>Date.parse(now()))warnings.push('제공자의 재시도 대기 시간이 남아 있습니다. 그 이후로 예약을 분산해 주세요.');
    if(data.user.role!=='admin')warnings.push('열람 가능한 예약 기준입니다. 다른 팀의 예약은 관리자가 전체 화면에서 함께 확인해야 합니다.');
    return {generatedAt:now(),scope:data.user.role==='admin'?'workspace':'visible',limit:data.limit,reserve:data.reserve,planningLimit:data.planningLimit,periodMinutes:60,assumptions:['게시 1회 + 계정 확인 1회 + 결과 조회 2회 + 첨부·표지 업로드를 합산한 계획용 추정입니다.','파일 캐시·공동 조회로 줄어들거나 재시도로 늘어날 수 있습니다. 실제 전송 시 서버 호출 한도를 다시 적용합니다.','현재 생성된 예약만 포함합니다. 아직 생성되지 않은 반복 예약은 포함하지 않습니다.'],jobs:records,windows,warnings};
  }
  function validateMove(user,change){
    const data=state(user),record=data.records.find(row=>row.jobId===change.jobId);if(!record?.canMove)throw fail('예약의 현재 발행 권한과 승인 버전을 다시 확인해 주세요.',409);
    const job=store.get('socialPublishJobs',change.jobId);if(job.mode==='fixed'&&!change.fixedSelected)throw fail('정시 예약을 직접 선택한 뒤 다시 확인해 주세요.',409);
  }
  function trial(user,changes){
    let result;const rollback={capacityPreview:true};
    try{publishing.atomic(()=>{result=publishing.rescheduleApply(user,{changes});throw rollback;});}catch(error){if(error!==rollback)throw error;}return result;
  }
  function prune(){const stamp=Date.parse(now());for(const row of store.all(PLANS))if(Date.parse(row.appliedAt||row.expiresAt)<stamp-(row.appliedAt?86400000:0))store.remove(PLANS,row.id);}
  function preview(user,input={}){
    user=current(user,true);prune();
    if(!Array.isArray(input.jobIds)||!input.jobIds.length||input.jobIds.length>200||input.jobIds.some(id=>typeof id!=='string'))throw fail('분산할 예약을 1~200개 선택해 주세요.');
    const fixed=input.includeFixedJobIds??[];if(!Array.isArray(fixed)||fixed.some(id=>!input.jobIds.includes(id)))throw fail('이동할 정시 예약을 목록에서 직접 선택해 주세요.');
    const maxShiftHours=input.maxShiftHours??24;if(!Number.isInteger(maxShiftHours)||maxShiftHours<1||maxShiftHours>168)throw fail('분산 범위는 1~168시간으로 선택해 주세요.');
    const data=state(user),selected=[...new Set(input.jobIds)].map(id=>{const row=data.records.find(r=>r.jobId===id);if(!row)throw fail('열람 가능한 예약 대기 항목을 선택해 주세요.',404);return row;}).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.jobId.localeCompare(b.jobId));
    const movable=new Set(selected.filter(row=>row.canMove&&row.estimatedRequests>0&&(row.mode!=='fixed'||fixed.includes(row.jobId))).map(row=>row.jobId));
    const events=[...data.events.filter(row=>!movable.has(row.jobId)),...data.recent],changes=[],warnings=[...workspace(user).warnings];
    function fits(at,cost,channelId){
      if(events.some(row=>row.channelId===channelId&&Math.abs(row.at-at)<MINUTE))return false;
      // Check every rolling window that the inserted event can affect, including
      // windows ending at a future fixed reservation across an hour boundary.
      return [at,...events.filter(e=>e.at>=at&&e.at<at+HOUR).map(e=>e.at)].every(end=>events.filter(e=>e.at>end-HOUR&&e.at<=end).reduce((n,e)=>n+e.cost,0)+cost<=data.planningLimit);
    }
    for(const row of selected){
      const job=store.get('socialPublishJobs',row.jobId),change={jobId:row.jobId,channelId:row.channelId,title:row.title,from:row.scheduledAt,to:row.scheduledAt,updatedAt:job.updatedAt,estimatedRequests:row.estimatedRequests,fixedSelected:fixed.includes(row.jobId),excluded:false,reason:null};
      if(!movable.has(row.jobId)){change.excluded=true;change.reason=row.mode==='fixed'&&!change.fixedSelected?'정시 예약 보호':row.reason||'변경할 수 없는 예약';changes.push(change);continue;}
      const expiresAt=store.get('socialPosts',job.postId)?.expiresAt;
      let at=Math.max(Date.parse(row.scheduledAt),Math.ceil((Date.parse(now())+MINUTE)/MINUTE)*MINUTE,data.retryAfter),end=Math.min(Date.parse(row.scheduledAt)+maxShiftHours*HOUR,expiresAt?Date.parse(expiresAt)-1:Infinity),found=false;
      for(;row.estimatedRequests<=data.planningLimit&&at<=end;at+=MINUTE){if(!fits(at,row.estimatedRequests,row.channelId))continue;
        change.to=new Date(at).toISOString();
        try{trial(user,[...changes.filter(c=>!c.excluded),change]);found=true;break;}catch(error){change.reason=error.message;}
      }
      if(!found){change.to=change.from;change.excluded=true;change.reason=row.estimatedRequests>data.planningLimit?'이 예약 하나의 예상 호출량이 계획 한도를 넘습니다. 파일·옵션 구성을 확인해 주세요.':change.reason||'선택한 범위 안에 분산할 자리가 없습니다.';events.push({at:Date.parse(row.scheduledAt),cost:row.estimatedRequests,channelId:row.channelId});}
      else{change.reason=change.from===change.to?'현재 시각 유지':'호출량·계정 간격을 고려한 분산 제안';events.push({at,cost:row.estimatedRequests,channelId:row.channelId});}
      changes.push(change);
    }
    const active=changes.filter(row=>!row.excluded&&row.from!==row.to);let validationError=null;
    try{trial(user,active);}catch(error){validationError=error.message;warnings.push(error.message);}
    // A later item may be impossible to move (for example it expires shortly).
    // Restoring it must not silently overload an earlier successful proposal.
    const moved=new Map(active.map(change=>[change.jobId,Date.parse(change.to)])),finalEvents=[...data.recent,...data.events.map(event=>({...event,at:moved.get(event.jobId)??event.at}))];
    if(finalEvents.some(end=>{const window=finalEvents.filter(event=>event.at>end.at-HOUR&&event.at<=end.at);return window.some(event=>moved.has(event.jobId))&&window.reduce((sum,event)=>sum+event.cost,0)>data.planningLimit;})){
      validationError='이동할 수 없는 예약을 유지하면 분산 후에도 호출량이 겹칩니다. 예약 선택이나 정시 예약 포함 범위를 조정해 주세요.';warnings.push(validationError);
    }
    const id=randomUUID(),expiresAt=new Date(Date.parse(now())+15*MINUTE).toISOString();
    const plan={id,ownerId:user.id,signature:data.signature,changes,expiresAt,createdAt:now(),validCount:active.length,blockedCount:changes.filter(c=>c.excluded).length,canApply:active.length>0&&!validationError,warnings};
    store.put(PLANS,id,plan);return {previewId:id,...Object.fromEntries(['changes','expiresAt','validCount','blockedCount','canApply','warnings'].map(k=>[k,plan[k]]))};
  }
  function apply(user,input={}){
    user=current(user,true);if(input.confirmed!==true)throw fail('변경 전후의 예약을 확인한 뒤 적용해 주세요.');
    return publishing.atomic(()=>{
      const plan=store.get(PLANS,input.previewId);if(!plan||plan.ownerId!==user.id)throw fail('예약 미리보기를 찾을 수 없습니다.',404);
      const view=publishing.workspace(user),visible=new Set(view.jobs.map(j=>j.id));
      if(plan.appliedAt){if(plan.jobIds.some(id=>!visible.has(id)))throw fail('예약 접근 권한이 변경됐습니다.',403);return {jobs:view.jobs.filter(j=>plan.jobIds.includes(j.id)),existing:true};}
      if(plan.expiresAt<=now()||!plan.canApply||state(user).signature!==plan.signature)throw fail('예약 또는 연결 상태가 변경됐습니다. 미리보기를 다시 확인해 주세요.',409);
      const changes=plan.changes.filter(c=>!c.excluded&&c.from!==c.to);changes.forEach(change=>validateMove(user,change));
      if(changes.some(c=>Date.parse(c.to)<(store.get('socialProviderRequests','postiz')?.retryAfter||0)))throw fail('제공자의 대기 시간이 변경됐습니다. 다시 확인해 주세요.',409);
      const result=publishing.rescheduleApply(user,{changes});
      store.put(PLANS,plan.id,{id:plan.id,ownerId:user.id,jobIds:result.jobs.map(j=>j.id),appliedAt:now(),expiresAt:plan.expiresAt});return {...result,existing:false};
    });
  }
  return {workspace,preview,apply,prune};
}
