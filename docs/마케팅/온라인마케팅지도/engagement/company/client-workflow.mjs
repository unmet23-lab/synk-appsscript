import {randomUUID} from 'node:crypto';
import {clientFollowUpToday} from './client-projects.mjs';
import {buildClientProjectGroups} from './client-project-groups.mjs';
import {createClientTaskRechecksService} from './client-task-rechecks.mjs';
import {buildClientDeadlineOverlaps} from './client-deadline-overlaps.mjs';
import {clientRightsSourceVisible} from './client-rights-reminders.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const latestPreview=row=>row.versions.filter(version=>version.kind==='preview').at(-1);
export const CLIENT_WORKFLOW_STATUS={open:'내 차례',in_progress:'고치는 중',review:'검토자 차례',changes_requested:'더 고쳐야 함',waiting_customer:'고객 차례',done:'끝남'};
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
        items.push({id,kind:'client_rights_expiry',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&rights=1&rightsTarget='+encodeURIComponent(entry.targetId),title:(portfolio?'포트폴리오 공개 동의 기간이 끝나 가요':'자료 사용 기간이 끝나 가요')+' · '+entry.label,text:`${portfolio?'공개 동의':'사용 조건'}가 ${entry.expiresAt}까지예요. ${entry.daysRemaining<0?'이미 지났어요. 아직 쓰고 있는지, 늘릴지 봐 주세요.':'끝나기 전에 더 쓸지, 늘릴지 정해 주세요.'}${row.stage==='archived'?' 보관한 프로젝트라 보관을 풀어야 바꿀 수 있어요.':''}`,ownerId:row.ownerId,reviewerId:null,status:entry.status,statusLabel:entry.statusLabel,dueDate:entry.expiresAt,createdAt:entry.recordedAt,updatedAt:entry.recordedAt,actionLabel:'사용 조건 보기',actions:[]});
      }
    }
    // Delivery completion and archival do not end a recorded public-use period.
    if(row.stage==='archived')return items;
    const contactDate=row.nextContactDate,validContactDate=typeof contactDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(contactDate)&&Number.isFinite(Date.parse(contactDate+'T00:00:00Z'))&&new Date(contactDate+'T00:00:00Z').toISOString().slice(0,10)===contactDate;
    if(isOwner&&validContactDate&&contactDate<=today)items.push({id:`client:${row.id}:follow-up`,kind:'follow_up',group:'next',projectId:row.id,projectTitle:row.title,customerName:row.customerName,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&followUp=1',title:'고객에게 연락할 날',text:`${row.customerName} · ${row.nextStep||'지난번에 한 약속을 보고, 연락한 결과를 적어 주세요.'}`,nextStep:row.nextStep||'',nextContactDate:contactDate,ownerId:row.ownerId,reviewerId:null,status:contactDate<today?'overdue':'due',statusLabel:contactDate<today?'연락일 지남':'오늘 연락',dueDate:contactDate,createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'연락 결과 적기',actions:[]});
    for(const message of row.messages){
      if(message.author!=='customer'||message.action==='approve')continue;
      const status=message.resolved?'done':message.workflow?.status||'open';
      if(status==='done')continue;
      if(!isOwner&&!(isReviewer&&status==='review'))continue;
      const actions=[];
      if(isOwner&&['open','changes_requested'].includes(status))actions.push({action:'start',label:'시작'});
      if(isOwner&&['open','in_progress','changes_requested'].includes(status)){
        if(message.action==='feedback')actions.push({action:'submit_review',label:reviewer?'고친 시안 검토 요청':'고친 시안을 고객에게'});
        else actions.push({action:'complete',label:'답변 끝'});
      }
      if(isReviewer&&status==='review')actions.push({action:'accept',label:'통과'},{action:'request_changes',label:'더 고치기'});
      if(isOwner&&['review','waiting_customer'].includes(status))actions.push({action:'reopen',label:'다시 열기'});
      const versionId=message.workflow?.resultVersionId||message.versionId||null;
      items.push({id:`client:${row.id}:${message.id}`,kind:message.action==='feedback'?'feedback':'support',group:status==='review'?(isReviewer?'review':'waiting'):status==='waiting_customer'?'waiting':'reply',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:message.id,versionId,seconds:message.seconds??null,href:clientWorkflowHref(row.id,versionId,message.id,message.seconds),title:message.action==='feedback'?'고객이 시안을 고쳐 달래요':'고객이 물어봤어요',text:message.text,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status,statusLabel:CLIENT_WORKFLOW_STATUS[status],dueDate:row.dueDate||'',createdAt:message.at,updatedAt:message.workflow?.updatedAt||message.at,note:message.workflow?.note||'',actions});
    }
    if(isOwner&&preview&&!preview.approvedAt&&!items.some(item=>item.group==='waiting'&&item.status==='waiting_customer'))items.push({id:`client:${row.id}:approval:${preview.id}`,kind:'customer_review',group:'waiting',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview.id,seconds:null,href:clientWorkflowHref(row.id,preview.id),title:'고객이 시안을 보고 있어요',text:preview.label,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:'waiting_customer',statusLabel:'고객 차례',dueDate:row.dueDate||'',createdAt:preview.createdAt,updatedAt:preview.createdAt,actions:[]});
    const deliveryCheck=isOwner&&clientDelivery?clientDelivery.get(user,row.id).deliveryCheck:null;
    if(deliveryCheck)sources?.set(`client:${row.id}:delivery-check`,{fingerprint:deliveryCheck.fingerprint,checks:deliveryCheck.checks,inspectionCurrent:deliveryCheck.inspectionCurrent});
    const deliveryPending=deliveryCheck?.confirmed&&deliveryCheck.pendingCount>0&&deliveryCheck.status!=='archived';
    if(deliveryPending)items.push({id:`client:${row.id}:delivery-check`,kind:'client_delivery_check',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview?.id||null,seconds:null,href:clientWorkflowHref(row.id)+'&delivery=1',title:'납품 파일 검사에서 걸렸어요 · '+row.title,text:`${deliveryCheck.statusLabel} · 없거나 안 맞는 것 ${deliveryCheck.blockingCount}개 / 직접 볼 것 ${deliveryCheck.manualCount}개`,ownerId:row.ownerId,reviewerId:null,status:deliveryCheck.status,statusLabel:deliveryCheck.statusLabel,dueDate:row.dueDate||'',createdAt:row.createdAt,updatedAt:deliveryCheck.checkedAt||row.updatedAt,actionLabel:'납품 열기',actions:[]});
    if(isOwner&&!deliveryPending&&preview?.approvedAt&&!row.messages.some(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved)&&!row.versions.some(version=>version.kind==='final'&&version.approvedPreviewId===preview.id))items.push({id:`client:${row.id}:delivery:${preview.id}`,kind:'delivery',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview.id,seconds:null,href:clientWorkflowHref(row.id)+'&delivery=1',title:'고객이 승인했어요 · 최종본 보내기',text:'승인한 시안으로 줄 파일과 사용 안내를 준비해요.',ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:'ready',statusLabel:'납품 준비',dueDate:row.dueDate||'',createdAt:preview.approvedAt,updatedAt:preview.approvedAt,actions:[]});
    const closeout=row.closeout;
    const kickoff=row.kickoff;
    const changes=row.changes;
    const schedule=row.schedule;
    if(isOwner&&schedule?.enabled&&schedule.pendingCount>0&&!['archived','complete'].includes(schedule.status)){
      items.push({id:`client:${row.id}:schedule`,kind:'client_schedule',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&schedule=1',title:'일정이 늦어지고 있어요 · '+row.title,text:['at_risk','overdue','due'].includes(schedule.risk?.status)?schedule.risk.text:`목표일이 지났거나 오래 기다린 확인이 ${schedule.pendingCount}개 있어요.`,ownerId:row.ownerId,reviewerId:null,status:schedule.status,statusLabel:schedule.statusLabel,dueDate:schedule.agreedDueDate||'',createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'일정 열기',actions:[]});
    }
    for(const request of row.sceneRequests?.items||[]){
      if(request.status==='done'||request.status==='archived'||!isOwner&&!(isReviewer&&request.status==='review'))continue;
      const group=request.status==='review'?(isReviewer?'review':'waiting'):request.status==='waiting_customer'?'waiting':'next';
      items.push({id:`client:${row.id}:scene-request:${request.id}`,kind:'scene_request',group,projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&requests=1',title:'장면을 고쳐 달래요 · '+row.title+' · '+request.title,text:request.reason||request.text,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:request.status,statusLabel:request.statusLabel,dueDate:row.dueDate||'',createdAt:request.createdAt,updatedAt:request.updatedAt,actionLabel:'장면 요청 열기',actions:[]});
    }
    if(isOwner&&changes?.enabled&&['pending','reviewed'].includes(changes.status)){
      items.push({id:`client:${row.id}:changes`,kind:'client_changes',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&changes=1',title:'확정한 뒤 바뀐 게 있어요 · '+row.title,text:changes.status==='reviewed'?'바뀐 것을 다 봤어요. 지금 내용을 새 기준으로 잡아 주세요.':'확정한 뒤 바뀐 내용이 장면·일정·조건에 닿는지 봐 주세요.',ownerId:row.ownerId,reviewerId:null,status:changes.status,statusLabel:changes.statusLabel,dueDate:'',createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'바뀐 것 보기',actions:[]});
    }
    if(isOwner&&row.stage!=='delivered'&&kickoff?.enabled&&kickoff.status==='waiting'&&kickoff.overdue){
items.push({id:`client:${row.id}:kickoff`,kind:'client_kickoff',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&kickoff=1',title:'자료를 다 받을 날이에요 · '+row.title,text:'아직 못 받은 자료와 정해 둬야 하는 것을 챙겨 주세요.',ownerId:row.ownerId,reviewerId:null,status:'due',statusLabel:'자료 챙기기',dueDate:kickoff.dueDate,createdAt:row.createdAt,updatedAt:row.updatedAt,actionLabel:'시작 준비 열기',actions:[]});
    }
    if(isOwner&&closeout?.deliveryKey&&((closeout.overdue&&!closeout.receipt)||closeout.canClose)){
      const ready=closeout.canClose;
      items.push({id:`client:${row.id}:closeout:${closeout.deliveryKey}`,kind:ready?'client_closeout':'delivery_receipt',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:null,seconds:null,href:clientWorkflowHref(row.id)+'&closeout=1',title:ready?'고객이 받았어요 · 마감할 차례':'고객이 받았다고 안 했어요',text:ready?'남은 문의와 연락을 보고 마감해 주세요.':'기다리기로 한 날이 됐어요. 고객에게 받았는지 물어봐 주세요.',ownerId:row.ownerId,reviewerId:null,status:ready?'ready':'due',statusLabel:ready?'마감할 차례':'수령 확인 필요',dueDate:ready?'':closeout.dueDate,createdAt:closeout.deliveredAt,updatedAt:row.updatedAt,actionLabel:ready?'마감하기':'수령 확인 열기',actions:[]});
    }
    return items;
  }
  function context(user){const now=clock(),today=clientFollowUpToday(now),projects=clientProjects.workspace(user).projects,sources=new Map(),items=projects.flatMap(row=>projection(user,row,today,sources)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));return {now,today,projects,items,sources};}
  function workspace(user){user=current(user);const data=context(user);let deadlineOverlaps;try{deadlineOverlaps={data:buildClientDeadlineOverlaps(data.projects,{now:data.now})};}catch{deadlineOverlaps={error:'기한이 겹치는지 계산하지 못했어요. 새로 불러와 주세요.'};}return {items:data.items,projectGroups:buildClientProjectGroups(data.items,{today:data.today}),...taskRechecks.project(user,data),deadlineOverlaps};}
  function recheck(user,input){user=current(user);return store.transaction(()=>{taskRechecks.update(user,input,context(user));return workspace(user);});}
  function update(user,input){
    user=current(user);
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail('요청 내용이 비어 있어요.');
    return store.transaction(()=>{
      const row=clientProjects.project(user,input.projectId),{owner,reviewer}=participants(row),isOwner=owner?.id===user.id,isReviewer=reviewer?.id===user.id;
      if(row.stage==='archived')throw fail('보관한 프로젝트예요. 보관을 풀어야 바꿀 수 있어요.',409);
      if(!isOwner&&!isReviewer)throw fail('담당자나 검토자만 처리할 수 있어요.',403);
      const message=row.messages.find(item=>item.id===input.messageId&&item.author==='customer'&&item.action!=='approve');
      if(!message)throw fail('그 고객 요청을 찾지 못했어요.',404);
      if(input.revision!==row.revision)throw fail('그사이 요청이 바뀌었어요. 새로 불러온 뒤 다시 해 주세요.',409);
      const status=message.resolved?'done':message.workflow?.status||'open',action=input.action;
      const note=input.note??'';
      if(typeof note!=='string'||note.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))throw fail('검토 메모는 3,000자 안으로 적어 주세요.');
      let next,resultVersionId=message.workflow?.resultVersionId||null;
      if(action==='start'&&isOwner&&['open','changes_requested'].includes(status))next='in_progress';
      else if(action==='submit_review'&&isOwner&&message.action==='feedback'&&['open','in_progress','changes_requested'].includes(status)){
        const version=row.versions.find(item=>item.id===input.versionId&&item.kind==='preview');
        if(!version||version.id!==latestPreview(row)?.id||version.id===message.versionId||status==='changes_requested'&&version.id===resultVersionId||version.approvedAt)throw fail('요청을 받은 뒤에 고친 시안을 먼저 올리고 골라 주세요.',409);
        next=reviewer?'review':'waiting_customer';resultVersionId=version.id;
      }else if(action==='accept'&&isReviewer&&status==='review'){
        if(!resultVersionId||resultVersionId!==latestPreview(row)?.id)throw fail('그사이 시안이 바뀌었어요. 담당자가 검토를 다시 요청해야 해요.',409);
        next=latestPreview(row).approvedAt?'done':'waiting_customer';
      }else if(action==='request_changes'&&isReviewer&&status==='review'){
        if(!note.trim())throw fail('무엇을 더 고칠지 적어 주세요.');next='changes_requested';
      }else if(action==='complete'&&isOwner&&message.action!=='feedback'&&['open','in_progress','changes_requested'].includes(status))next='done';
      else if(action==='reopen'&&isOwner&&['done','waiting_customer','review'].includes(status))next='open';
      else throw fail('지금 상태에서는 할 수 없거나 권한이 없어요.',409);
      const at=clock(),entry={action,actor:user.id,at,note:note.trim()},workflow={...(message.workflow||{}),status:next,resultVersionId,updatedAt:at,note:note.trim(),history:[...(message.workflow?.history||[]),entry].slice(-100)};
      const updated={...row,revision:row.revision+1,updatedAt:at,messages:row.messages.map(item=>item.id===message.id?{...item,workflow,resolved:next==='done',resolvedAt:next==='done'?at:null}:item),history:[...row.history,{id:randomUUID(),action:'고객 요청 · '+CLIENT_WORKFLOW_STATUS[next],actor:user.id,at}].slice(-300)};
      clientProjects.commitWorkflow(updated);
      return {project:clientProjects.workspace(user).projects.find(item=>item.id===row.id),...workspace(user)};
    });
  }
  return {workspace,update,recheck};
}
