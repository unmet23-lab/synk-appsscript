const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const titles={customer_feedback:'고객이 시안 수정을 요청했어요',customer_support:'고객 문의가 도착했어요',customer_approval:'고객이 시안을 승인했어요',review_requested:'수정본 검토를 요청했어요',changes_requested:'수정본에 보완 의견이 있어요',review_accepted:'수정본 내부 검토를 마쳤어요',work_started:'고객 요청 처리를 시작했어요',work_completed:'고객 요청 처리를 마쳤어요',work_reopened:'고객 요청을 다시 열었어요',assigned:'고객 프로젝트 담당이 배정됐어요',reviewer_assigned:'고객 프로젝트 검토자로 배정됐어요'};
const unique=values=>[...new Set(values.filter(Boolean))];

// Immutable, content-free event pointers live in the same SQLite document as the
// project mutation. There is no independent write that can commit only half of it.
export function appendClientNotificationEvents(previous,row){
  const events=[...(previous?.notificationEvents||[])],ids=new Set(events.map(event=>event.id));
  const actorId=row.history?.at(-1)?.actor||null;
  const add=(type,resourceId,audiences,extra={})=>{
    const id=`client:${row.id}:${row.revision}:${type}:${resourceId}`;
    if(ids.has(id))return;
    ids.add(id);events.push({id,type,projectId:row.id,revision:row.revision,createdAt:row.updatedAt,actorId,audiences,...extra});
  };
  if(row.ownerId!==previous?.ownerId)add('assigned',row.ownerId,['owner'],{assigneeId:row.ownerId});
  if(row.reviewerId&&row.reviewerId!==previous?.reviewerId)add('reviewer_assigned',row.reviewerId,['reviewer'],{assigneeId:row.reviewerId});
  const older=new Map((previous?.messages||[]).map(message=>[message.id,message]));
  for(const message of row.messages||[]){
    const old=older.get(message.id);
    if(message.author==='customer'&&!old){
      const type=message.action==='approve'?'customer_approval':message.action==='feedback'?'customer_feedback':'customer_support';
      add(type,message.id,type==='customer_approval'?['owner','reviewer']:['owner'],{messageId:message.id,versionId:message.versionId||null,actorId:'customer'});
      continue;
    }
    if(message.author!=='customer'||message.action==='approve'||!old)continue;
    const before=old.resolved?'done':old.workflow?.status||'open',after=message.resolved?'done':message.workflow?.status||'open';
    if(before===after)continue;
    // One approval may close many linked corrections. Its approval event carries
    // that result; emitting a second completion per correction would spam staff.
    if(actorId==='customer'&&after==='done')continue;
    const type=after==='review'?'review_requested':after==='changes_requested'?'changes_requested':after==='waiting_customer'?'review_accepted':after==='done'?'work_completed':after==='in_progress'?'work_started':'work_reopened';
    const historyEntry=message.workflow?.history?.at(-1);
    add(type,message.id,type==='review_requested'?['reviewer']:type==='changes_requested'||type==='review_accepted'?['owner']:['owner','reviewer'],{messageId:message.id,versionId:message.workflow?.resultVersionId||message.versionId||null,workflowAt:historyEntry?.at||null,workflowAction:historyEntry?.action||null});
  }
  return {...row,notificationEvents:events};
}

export function createClientNotificationsService({store,clientProjects,clientWorkflow,clock=()=>new Date().toISOString(),onChange=()=>{}}){
  function current(user){const live=store.get('users',typeof user==='string'?user:user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  const notify=ids=>{try{onChange(unique(ids));}catch{/* Notification delivery is recoverable from the durable source. */}};
  const unsubscribe=clientProjects.subscribeChanges?.(change=>notify(change.userIds));
  function eligible(user,project,event){
    if(project.stage==='archived'||user.role==='viewer'||event.actorId===user.id)return false;
    const owner=project.ownerId===user.id;
    const reviewer=project.reviewerId===user.id&&(user.role==='admin'||user.teamId&&user.teamId===project.teamId);
    if(!event.audiences.some(audience=>audience==='owner'&&owner||audience==='reviewer'&&reviewer))return false;
    if(event.assigneeId&&event.assigneeId!==user.id)return false;
    return true;
  }
  function receiptId(userId,eventId){return userId+'|'+eventId;}
  function projected(user){
    const result=[];
    // Re-read the actual user and current project ACL on every list/count/read.
    for(const project of clientProjects.workspace(user).projects){
      const source=store.get('clientProjects',project.id);if(!source)continue;
      const messages=new Map(source.messages.map(message=>[message.id,message])),versions=new Map(source.versions.map(version=>[version.id,version]));
      for(const event of source.notificationEvents||[]){
        if(!eligible(user,source,event))continue;
        const message=event.messageId&&messages.get(event.messageId),version=event.versionId&&versions.get(event.versionId);
        if(event.messageId&&!message||event.versionId&&!version)continue;
        const query=new URLSearchParams({tab:'workroom',section:'clients',project:source.id});
        if(event.versionId)query.set('version',event.versionId);if(event.messageId)query.set('message',event.messageId);if(Number.isFinite(message?.seconds))query.set('seconds',String(message.seconds));
        const readAt=store.get('clientNotificationReads',receiptId(user.id,event.id))?.readAt||null;
        const reviewNote=message?.workflow?.history?.findLast(entry=>entry.at===event.workflowAt&&entry.action===event.workflowAction&&entry.actor===event.actorId)?.note;
        const text=event.type==='customer_approval'?`${version?.label||'최근 시안'}의 고객 승인을 확인해 주세요.`:event.type==='changes_requested'?reviewNote||'수정할 내용을 확인해 주세요.':event.type==='review_requested'?`${version?.label||'수정본'}을 확인해 주세요.`:message?.text||source.nextStep||'프로젝트의 요청과 다음 할 일을 확인해 주세요.';
        result.push({id:event.id,kind:'client_workflow',type:event.type,message:null,title:titles[event.type]||'고객 프로젝트가 변경됐어요',text,body:text,projectTitle:source.title,createdAt:event.createdAt,readAt,unread:!readAt,href:'/?'+query,projectId:source.id,messageId:event.messageId||null,versionId:event.versionId||null,seconds:message?.seconds??null});
      }
    }
    return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  }
  function list(user,query={}){
    user=current(user);const all=projected(user),value=key=>typeof query?.get==='function'?query.get(key):query?.[key];
    const unreadOnly=[true,'true','1'].includes(value('unreadOnly')),filtered=unreadOnly?all.filter(item=>item.unread):all,rawLimit=value('limit');
    let notifications=filtered;
    if(rawLimit!==undefined&&rawLimit!==null&&rawLimit!==''){const limit=Number(rawLimit);if(!Number.isInteger(limit)||limit<1||limit>1000)throw fail('알림 표시 개수를 확인해 주세요.');notifications=filtered.slice(0,limit);}
    return {notifications,total:filtered.length,unreadCount:all.filter(item=>item.unread).length};
  }
  function unreadCount(user){return list(user).unreadCount;}
  function read(user,id){
    user=current(user);const item=projected(user).find(item=>item.id===id);if(!item)throw fail('알림을 찾을 수 없습니다.',404);
    if(!item.readAt){store.put('clientNotificationReads',receiptId(user.id,id),{id:receiptId(user.id,id),userId:user.id,eventId:id,readAt:clock()});notify([user.id]);}
    return {ok:true,id,unreadCount:unreadCount(user)};
  }
  function readAll(user){
    user=current(user);const unread=projected(user).filter(item=>!item.readAt),at=clock();
    if(unread.length){store.transaction(()=>{for(const item of unread)store.put('clientNotificationReads',receiptId(user.id,item.id),{id:receiptId(user.id,item.id),userId:user.id,eventId:item.id,readAt:at});});notify([user.id]);}
    return {ok:true,count:unread.length,unreadCount:unreadCount(user)};
  }
  return {list,unreadCount,read,readAll,close:()=>unsubscribe?.()};
}
