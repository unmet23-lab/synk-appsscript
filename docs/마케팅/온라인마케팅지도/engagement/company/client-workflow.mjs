import {randomUUID} from 'node:crypto';
import {clientFollowUpToday} from './client-projects.mjs';
import {buildClientProjectGroups} from './client-project-groups.mjs';
import {createClientTaskRechecksService} from './client-task-rechecks.mjs';
import {buildClientDeadlineOverlaps} from './client-deadline-overlaps.mjs';
import {clientRightsSourceVisible} from './client-rights-reminders.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const latestPreview=row=>row.versions.filter(version=>version.kind==='preview').at(-1);
export const CLIENT_WORKFLOW_STATUS={open:'확인할 요청',in_progress:'수정 중',review:'내부 검토 대기',changes_requested:'수정 요청',waiting_customer:'고객 확인 대기',done:'처리됨'};
export function clientWorkflowHref(projectId,versionId=null,messageId=null,seconds=null){
  const query=new URLSearchParams({tab:'workroom',section:'clients',project:projectId});
  if(versionId)query.set('version',versionId);
  if(messageId)query.set('message',messageId);
  if(Number.isFinite(seconds)&&seconds>=0)query.set('seconds',String(seconds));
  return '/?'+query;
}

// Requests are projected from their authoritative project records. Repeated reads,
// server restarts and reassignment therefore never create duplicate messenger tasks.
export function createClientWorkflowService({store,clientProjects,clientDelivery=null,clientRights=null,clock=()=>new Date().toISOString()}){
  const taskRechecks=createClientTaskRechecksService({store});
  function current(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function participants(row){
    const owner=store.get('users',row.ownerId),reviewer=store.get('users',row.reviewerId);
    return {owner:owner?.active&&owner.role!=='viewer'?owner:null,reviewer:reviewer?.active&&reviewer.role!=='viewer'&&(reviewer.role==='admin'||reviewer.teamId&&reviewer.teamId===row.teamId)?reviewer:null};
  }
  function projection(user,row,today,sources){
    if(!clientRightsSourceVisible(row))return [];
    const {owner,reviewer}=participants(row),isOwner=owner?.id===user.id,isReviewer=reviewer?.id===user.id;
    if(!isOwner&&!isReviewer)return [];
    const preview=latestPreview(row),items=[];
    if(isOwner&&clientRights){
      const reminders=clientRights.reminders(user,row.id);
      for(const entry of reminders.items){
        const id=`client:${row.id}:rights:${entry.targetId}`,portfolio=entry.kind==='portfolio';
        sources?.set(id,{recordId:entry.recordId,sourceFingerprint:entry.sourceFingerprint,expiresAt:entry.expiresAt});
        items.push({id,kind:'client_rights_expiry',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&rights=1&rightsTarget='+encodeURIComponent(entry.targetId),title:(portfolio?'공개 동의 기간 확인':'자료 사용 기간 확인')+' · '+entry.label,text:`${entry.expiresAt}까지로 등록된 ${portfolio?'공개 동의':'사용 조건'}입니다. ${entry.daysRemaining<0?'기간이 지나 현재 사용 여부와 갱신 근거를 확인해 주세요.':'기한 전에 사용 범위와 갱신 여부를 확인해 주세요.'}${row.stage==='archived'?' 보관 프로젝트는 보관을 해제한 뒤 조건을 변경할 수 있습니다.':''}`,ownerId:row.ownerId,reviewerId:null,status:entry.status,statusLabel:entry.statusLabel,dueDate:entry.expiresAt,createdAt:entry.recordedAt,updatedAt:entry.recordedAt,actionLabel:'사용 조건 열기',actions:[]});
      }
    }
    // Delivery completion and archival do not end a recorded public-use period.
    if(row.stage==='archived')return items;
    const contactDate=row.nextContactDate,validContactDate=typeof contactDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(contactDate)&&Number.isFinite(Date.parse(contactDate+'T00:00:00Z'))&&new Date(contactDate+'T00:00:00Z').toISOString().slice(0,10)===contactDate;
    if(isOwner&&validContactDate&&contactDate<=today)items.push({id:`client:${row.id}:follow-up`,kind:'follow_up',group:'next',projectId:row.id,projectTitle:row.title,customerName:row.customerName,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&followUp=1',title:'고객 후속 연락',text:`${row.customerName} · ${row.nextStep||'지난 연락 내용과 약속을 확인하고 연락 결과를 남겨 주세요.'}`,nextStep:row.nextStep||'',nextContactDate:contactDate,ownerId:row.ownerId,reviewerId:null,status:contactDate<today?'overdue':'due',statusLabel:contactDate<today?'연락일 지남':'오늘 연락',dueDate:contactDate,createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'연락 결과 기록',actions:[]});
    for(const message of row.messages){
      if(message.author!=='customer'||message.action==='approve')continue;
      const status=message.resolved?'done':message.workflow?.status||'open';
      if(status==='done')continue;
      if(!isOwner&&!(isReviewer&&status==='review'))continue;
      const actions=[];
      if(isOwner&&['open','changes_requested'].includes(status))actions.push({action:'start',label:'처리 시작'});
      if(isOwner&&['open','in_progress','changes_requested'].includes(status)){
        if(message.action==='feedback')actions.push({action:'submit_review',label:reviewer?'수정본 검토 요청':'수정본 고객 확인 대기'});
        else actions.push({action:'complete',label:'문의 처리 완료'});
      }
      if(isReviewer&&status==='review')actions.push({action:'accept',label:'검토 통과'},{action:'request_changes',label:'수정 요청'});
      if(isOwner&&['review','waiting_customer'].includes(status))actions.push({action:'reopen',label:'다시 처리'});
      const versionId=message.workflow?.resultVersionId||message.versionId||null;
      items.push({id:`client:${row.id}:${message.id}`,kind:message.action==='feedback'?'feedback':'support',group:status==='review'?(isReviewer?'review':'waiting'):status==='waiting_customer'?'waiting':'reply',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:message.id,versionId,seconds:message.seconds??null,href:clientWorkflowHref(row.id,versionId,message.id,message.seconds),title:message.action==='feedback'?'고객 시안 수정':'고객 문의',text:message.text,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status,statusLabel:CLIENT_WORKFLOW_STATUS[status],dueDate:row.dueDate||'',createdAt:message.at,updatedAt:message.workflow?.updatedAt||message.at,note:message.workflow?.note||'',actions});
    }
    if(isOwner&&preview&&!preview.approvedAt&&!items.some(item=>item.group==='waiting'&&item.status==='waiting_customer'))items.push({id:`client:${row.id}:approval:${preview.id}`,kind:'customer_review',group:'waiting',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview.id,seconds:null,href:clientWorkflowHref(row.id,preview.id),title:'고객 승인 대기',text:preview.label,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:'waiting_customer',statusLabel:'고객 확인 대기',dueDate:row.dueDate||'',createdAt:preview.createdAt,updatedAt:preview.createdAt,actions:[]});
    const deliveryCheck=isOwner&&clientDelivery?clientDelivery.get(user,row.id).deliveryCheck:null;
    if(deliveryCheck)sources?.set(`client:${row.id}:delivery-check`,{fingerprint:deliveryCheck.fingerprint,checks:deliveryCheck.checks,inspectionCurrent:deliveryCheck.inspectionCurrent});
    const deliveryPending=deliveryCheck?.confirmed&&deliveryCheck.pendingCount>0&&deliveryCheck.status!=='archived';
    if(deliveryPending)items.push({id:`client:${row.id}:delivery-check`,kind:'client_delivery_check',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview?.id||null,seconds:null,href:clientWorkflowHref(row.id)+'&delivery=1',title:'납품 규격·파일 누락 확인 · '+row.title,text:`${deliveryCheck.statusLabel} · ${deliveryCheck.blockingCount}개 누락·불일치 / ${deliveryCheck.manualCount}개 직접 확인`,ownerId:row.ownerId,reviewerId:null,status:deliveryCheck.status,statusLabel:deliveryCheck.statusLabel,dueDate:row.dueDate||'',createdAt:row.createdAt,updatedAt:deliveryCheck.checkedAt||row.updatedAt,actionLabel:'납품 준비 열기',actions:[]});
    if(isOwner&&!deliveryPending&&preview?.approvedAt&&!row.messages.some(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved)&&!row.versions.some(version=>version.kind==='final'&&version.approvedPreviewId===preview.id))items.push({id:`client:${row.id}:delivery:${preview.id}`,kind:'delivery',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview.id,seconds:null,href:clientWorkflowHref(row.id)+'&delivery=1',title:'승인 완료 · 최종본 전달',text:'승인된 시안을 기준으로 필요한 파일과 전달 안내를 준비하세요.',ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:'ready',statusLabel:'최종 납품 준비',dueDate:row.dueDate||'',createdAt:preview.approvedAt,updatedAt:preview.approvedAt,actions:[]});
    const closeout=row.closeout;
    const kickoff=row.kickoff;
    const changes=row.changes;
    const schedule=row.schedule;
    if(isOwner&&schedule?.enabled&&schedule.pendingCount>0&&!['archived','complete'].includes(schedule.status)){
      items.push({id:`client:${row.id}:schedule`,kind:'client_schedule',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&schedule=1',title:'제작 일정·확인 지연 · '+row.title,text:['at_risk','overdue','due'].includes(schedule.risk?.status)?schedule.risk.text:`목표일과 확인 대기에서 ${schedule.pendingCount}개 항목을 확인해 주세요.`,ownerId:row.ownerId,reviewerId:null,status:schedule.status,statusLabel:schedule.statusLabel,dueDate:schedule.agreedDueDate||'',createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'제작 일정 열기',actions:[]});
    }
    for(const request of row.sceneRequests?.items||[]){
      if(request.status==='done'||request.status==='archived'||!isOwner&&!(isReviewer&&request.status==='review'))continue;
      const group=request.status==='review'?(isReviewer?'review':'waiting'):request.status==='waiting_customer'?'waiting':'next';
      items.push({id:`client:${row.id}:scene-request:${request.id}`,kind:'scene_request',group,projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&requests=1',title:'장면 수정 요청 · '+row.title+' · '+request.title,text:request.reason||request.text,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:request.status,statusLabel:request.statusLabel,dueDate:row.dueDate||'',createdAt:request.createdAt,updatedAt:request.updatedAt,actionLabel:'장면 수정 요청 열기',actions:[]});
    }
    if(isOwner&&changes?.enabled&&['pending','reviewed'].includes(changes.status)){
      items.push({id:`client:${row.id}:changes`,kind:'client_changes',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&changes=1',title:'제작 중 변경사항 확인 · '+row.title,text:changes.status==='reviewed'?'변경 내용의 검토가 끝났습니다. 현재 확정 내용을 새 비교 기준으로 저장해 주세요.':'확정 이후 달라진 내용과 장면·일정·제작 조건을 다시 확인해 주세요.',ownerId:row.ownerId,reviewerId:null,status:changes.status,statusLabel:changes.statusLabel,dueDate:'',createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'변경사항 열기',actions:[]});
    }
    if(isOwner&&row.stage!=='delivered'&&kickoff?.enabled&&kickoff.status==='waiting'&&kickoff.overdue){
items.push({id:`client:${row.id}:kickoff`,kind:'client_kickoff',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&kickoff=1',title:'제작 착수 전 자료·확정사항 확인 · '+row.title,text:'자료 확인일이 됐습니다. 받은 자료와 기획·합의 기록에서 남은 항목을 확인해 주세요.',ownerId:row.ownerId,reviewerId:null,status:'due',statusLabel:'착수 준비 확인',dueDate:kickoff.dueDate,createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'착수 준비 열기',actions:[]});
    }
    if(isOwner&&closeout?.deliveryKey&&((closeout.overdue&&!closeout.receipt)||closeout.canClose)){
      const ready=closeout.canClose;
      items.push({id:`client:${row.id}:closeout:${closeout.deliveryKey}`,kind:ready?'client_closeout':'delivery_receipt',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&closeout=1',title:ready?'수령 확인 완료 · 프로젝트 마감':'납품 후 고객 수령 확인',text:ready?'고객 확인과 남은 업무를 점검하고 완료 기록을 확정하세요.':'정한 확인일이 됐습니다. 납품 기록과 확인 요청 문구를 확인해 주세요.',ownerId:row.ownerId,reviewerId:null,status:ready?'ready':'due',statusLabel:ready?'마감 점검':'수령 확인 필요',dueDate:ready?'':closeout.dueDate,createdAt:closeout.deliveredAt,updatedAt:row.updatedAt,actionLabel:ready?'마감 점검':'수령 확인 열기',actions:[]});
    }
    return items;
  }
  function context(user){const now=clock(),today=clientFollowUpToday(now),projects=clientProjects.workspace(user).projects,sources=new Map(),items=projects.flatMap(row=>projection(user,row,today,sources)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return {now,today,projects,items,sources};}
  function workspace(user){user=current(user);const data=context(user);let deadlineOverlaps;try{deadlineOverlaps={data:buildClientDeadlineOverlaps(data.projects,{now:data.now})};}catch{deadlineOverlaps={error:'프로젝트 기한 겹침을 확인하지 못했습니다. 일정 원문을 확인하거나 다시 불러와 주세요.'};}return {items:data.items,projectGroups:buildClientProjectGroups(data.items,{today:data.today}),...taskRechecks.project(user,data),deadlineOverlaps};}
  function recheck(user,input){user=current(user);return store.transaction(()=>{taskRechecks.update(user,input,context(user));return workspace(user);});}
  function update(user,input){
    user=current(user);
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail('요청 내용을 확인해 주세요.');
    return store.transaction(()=>{
      const row=clientProjects.project(user,input.projectId),{owner,reviewer}=participants(row),isOwner=owner?.id===user.id,isReviewer=reviewer?.id===user.id;
      if(row.stage==='archived')throw fail('보관한 프로젝트입니다.',409);
      if(!isOwner&&!isReviewer)throw fail('담당자 또는 지정 검토자만 요청을 처리할 수 있습니다.',403);
      const message=row.messages.find(item=>item.id===input.messageId&&item.author==='customer'&&item.action!=='approve');
      if(!message)throw fail('고객 요청을 찾을 수 없습니다.',404);
      if(input.revision!==row.revision)throw fail('고객 요청이 변경됐습니다. 새로 불러온 뒤 다시 처리해 주세요.',409);
      const status=message.resolved?'done':message.workflow?.status||'open',action=input.action;
      const note=input.note??'';
      if(typeof note!=='string'||note.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))throw fail('검토 메모를 확인해 주세요.');
      let next,resultVersionId=message.workflow?.resultVersionId||null;
      if(action==='start'&&isOwner&&['open','changes_requested'].includes(status))next='in_progress';
      else if(action==='submit_review'&&isOwner&&message.action==='feedback'&&['open','in_progress','changes_requested'].includes(status)){
        const version=row.versions.find(item=>item.id===input.versionId&&item.kind==='preview');
        if(!version||version.id!==latestPreview(row)?.id||version.id===message.versionId||status==='changes_requested'&&version.id===resultVersionId||version.approvedAt)throw fail('고객 요청 이후의 새 시안을 먼저 등록하고 선택해 주세요.',409);
        next=reviewer?'review':'waiting_customer';resultVersionId=version.id;
      }else if(action==='accept'&&isReviewer&&status==='review'){
        if(!resultVersionId||resultVersionId!==latestPreview(row)?.id)throw fail('최근 수정본이 바뀌었습니다. 담당자가 다시 검토를 요청해야 합니다.',409);
        next=latestPreview(row).approvedAt?'done':'waiting_customer';
      }else if(action==='request_changes'&&isReviewer&&status==='review'){
        if(!note.trim())throw fail('수정할 내용을 남겨 주세요.');next='changes_requested';
      }else if(action==='complete'&&isOwner&&message.action!=='feedback'&&['open','in_progress','changes_requested'].includes(status))next='done';
      else if(action==='reopen'&&isOwner&&['done','waiting_customer','review'].includes(status))next='open';
      else throw fail('현재 상태에서 처리할 수 없거나 담당 권한이 없습니다.',409);
      const at=clock(),entry={action,actor:user.id,at,note:note.trim()},workflow={...(message.workflow||{}),status:next,resultVersionId,updatedAt:at,note:note.trim(),history:[...(message.workflow?.history||[]),entry].slice(-100)};
      const updated={...row,revision:row.revision+1,updatedAt:at,messages:row.messages.map(item=>item.id===message.id?{...item,workflow,resolved:next==='done',resolvedAt:next==='done'?at:null}:item),history:[...row.history,{id:randomUUID(),action:'고객 요청 · '+CLIENT_WORKFLOW_STATUS[next],actor:user.id,at}].slice(-300)};
      clientProjects.commitWorkflow(updated);
      return {project:clientProjects.workspace(user).projects.find(item=>item.id===row.id),...workspace(user)};
    });
  }
  return {workspace,update,recheck};
}
