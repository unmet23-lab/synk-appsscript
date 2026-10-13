const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const titles={customer_feedback:'고객이 시안을 고쳐 달래요',customer_support:'고객이 물어봤어요',customer_approval:'고객이 시안을 승인했어요',review_requested:'고친 시안 검토를 부탁했어요',changes_requested:'고친 시안에 더 고칠 게 있대요',review_accepted:'고친 시안 검토가 끝났어요',work_started:'고객 요청을 처리하기 시작했어요',work_completed:'고객 요청 처리를 끝냈어요',work_reopened:'고객 요청을 다시 열었어요',assigned:'고객 프로젝트 담당자가 됐어요',reviewer_assigned:'고객 프로젝트 검토자가 됐어요'};
const unique=values=>[...new Set(values.filter(Boolean))];
titles.customer_delivery_receipt='고객이 최종본을 받았대요';
titles.customer_feedback_round='고객이 수정 의견을 모아 보냈어요';
Object.assign(titles,{customer_preferences:'고객이 취향을 알려 줬어요',customer_reference:'고객이 참고 자료에 의견을 남겼어요',customer_strategy:'고객이 제작 설계를 썼어요',customer_strategy_confirmed:'고객이 제작 설계를 확인했어요',customer_concept:'고객이 콘셉트를 골랐어요',customer_scene:'고객이 장면을 보고 의견을 남겼어요',customer_comment:'고객이 기획에 의견을 남겼어요',preview_ready:'새 시안이 왔어요',final_ready:'최종본이 왔어요',staff_reply:'제작팀이 답했어요',strategy_ready:'제작 설계를 확인해 주세요',concept_ready:'콘셉트가 바뀌었어요',scene_ready:'장면 구성이 바뀌었어요',reference_ready:'참고 자료가 바뀌었어요'});
const studioNewsBodies={customer_preferences:'고객이 남긴 취향을 PULSE에서 봐 주세요.',customer_reference:'고객이 참고 자료에 남긴 의견을 PULSE에서 봐 주세요.',customer_strategy:'고객이 쓴 제작 설계를 PULSE에서 봐 주세요.',customer_strategy_confirmed:'고객이 확인한 제작 설계를 PULSE에서 봐 주세요.',customer_concept:'고객이 고른 콘셉트를 PULSE에서 봐 주세요.',customer_scene:'고객이 장면에 남긴 의견을 PULSE에서 봐 주세요.',customer_comment:'고객이 기획에 남긴 의견을 PULSE에서 봐 주세요.'};

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
  const feedbackRounds=new Map((row.studio?.feedbackRounds?.rounds||[]).map(round=>[round.id,round]));
  const submittedRounds=new Set();
  for(const message of row.messages||[]){
    const old=older.get(message.id);
    if(message.author==='staff'&&!old&&message.visibility==='customer')add('staff_reply',message.id,['customer'],{messageId:message.id,tab:'history'});
    if(message.author==='customer'&&!old){
      const round=message.action==='feedback'&&message.feedbackRoundId&&feedbackRounds.get(message.feedbackRoundId);
      const anchor=round&&row.messages.find(item=>item.id===round.items?.[0]?.messageId&&item.author==='customer'&&item.action==='feedback'&&item.feedbackRoundId===round.id&&item.versionId===round.versionId);
      if(anchor&&round.items.some(item=>item.messageId===message.id)){
        if(!submittedRounds.has(round.id)){
          submittedRounds.add(round.id);
          add('customer_feedback_round',round.id,['owner'],{messageId:anchor.id,versionId:anchor.versionId,feedbackRoundId:round.id,tab:'review',actorId:'customer'});
        }
        continue;
      }
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
  const oldVersions=new Set((previous?.versions||[]).map(version=>version.id));
  for(const version of row.versions||[])if(!oldVersions.has(version.id))add(version.kind==='final'?'final_ready':'preview_ready',version.id,['customer'],{versionId:version.id,tab:version.kind==='final'?'history':'review'});
  const oldReceipts=new Set((previous?.deliveryReceipts||[]).map(receipt=>receipt.id));
  for(const receipt of row.deliveryReceipts||[])if(!oldReceipts.has(receipt.id))add('customer_delivery_receipt',receipt.id,['owner','reviewer'],{deliveryReceiptId:receipt.id,deliveryKey:receipt.deliveryKey,actorId:'customer'});
  const history=row.history?.at(-1),action=history?.action?.replace(/^PULSE 기획 /,'');
  // Only the committed studio action creates its alert; reading or importing
  // an unchanged document must not replay old notifications.
  if(history?.id&&history.id!==previous?.history?.at(-1)?.id&&history.action?.startsWith('PULSE 기획 ')){
    const studio=row.studio||{},before=previous?.studio||{};
    const customerActions={save_preferences:['customer_preferences','direction'],save_reference:['customer_reference','direction'],remove_reference:['customer_reference','direction'],save_strategy:['customer_strategy','strategy'],confirm_strategy:['customer_strategy_confirmed','strategy'],select_concept:['customer_concept','concepts'],review_scene:['customer_scene','storyboard'],comment:['customer_comment','history']};
    if(actorId==='customer'&&customerActions[action]){const [type,tab]=customerActions[action];add(type,String(row.revision),['owner','reviewer'],{tab});}
    if(actorId!=='customer'){
      if(action==='request_strategy_review')add('strategy_ready',String(studio.strategy?.revision),['customer'],{tab:'strategy'});
      if(action==='save_concept'||action==='save_scene'){
        const key=action==='save_concept'?'concepts':'scenes',old=new Map((before[key]||[]).map(card=>[card.id,card]));
        for(const card of studio[key]||[])if(card.visibility==='customer'&&old.get(card.id)?.revision!==card.revision)add(key==='concepts'?'concept_ready':'scene_ready',card.id,['customer'],{tab:key==='concepts'?'concepts':'storyboard'});
      }
      if(action==='save_reference')add('reference_ready',String(row.revision),['customer'],{tab:'direction'});
      if(action==='comment'){
        const comment=studio.comments?.at(-1);
        if(comment?.visibility==='customer')add('staff_reply',comment.id,['customer'],{tab:comment.targetType==='scene'?'storyboard':comment.targetType==='concept'?'concepts':'history',commentId:comment.id});
      }
    }
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
  function projected(user,projectId=null){
    const result=[];
    // Re-read the actual user and current project ACL on every list/count/read.
    const projects=projectId?[clientProjects.project(user,projectId)]:clientProjects.workspace(user).projects;
    for(const project of projects){
      const source=store.get('clientProjects',project.id);if(!source)continue;
      const messages=new Map(source.messages.map(message=>[message.id,message])),versions=new Map(source.versions.map(version=>[version.id,version]));
      for(const event of source.notificationEvents||[]){
        if(!eligible(user,source,event))continue;
        const message=event.messageId&&messages.get(event.messageId),version=event.versionId&&versions.get(event.versionId);
        if(event.messageId&&!message||event.versionId&&!version)continue;
        const feedbackRound=event.feedbackRoundId&&(source.studio?.feedbackRounds?.rounds||[]).find(round=>round.id===event.feedbackRoundId&&round.items?.[0]?.messageId===event.messageId);
        if(event.type==='customer_feedback_round'&&!feedbackRound)continue;
        const query=new URLSearchParams({tab:'workroom',section:'clients',project:source.id});
        if(event.type==='customer_delivery_receipt')query.set('closeout','1');
        if(event.versionId)query.set('version',event.versionId);if(event.messageId)query.set('message',event.messageId);if(Number.isFinite(message?.seconds))query.set('seconds',String(message.seconds));
        const studioEvent=['customer_preferences','customer_reference','customer_strategy','customer_strategy_confirmed','customer_concept','customer_scene','customer_comment'].includes(event.type)&&['direction','strategy','concepts','storyboard','history'].includes(event.tab);
        // The existing messenger consumes workroom links only. Project news has
        // its own source opener, so use the exact PULSE tab for this projection.
        const href=projectId&&studioEvent?'/pulse-app/?'+new URLSearchParams({mode:'staff',project:source.id,tab:event.tab}):'/?'+query;
        const readAt=store.get('clientNotificationReads',receiptId(user.id,event.id))?.readAt||null;
        const reviewNote=message?.workflow?.history?.findLast(entry=>entry.at===event.workflowAt&&entry.action===event.workflowAction&&entry.actor===event.actorId)?.note;
        const text=projectId&&studioNewsBodies[event.type]?studioNewsBodies[event.type]:event.type==='customer_feedback_round'?`고객이 ${feedbackRound.number}차 수정 의견 ${feedbackRound.items.length}개를 한 번에 보냈어요. 영상 확인에서 봐 주세요.`:event.type==='customer_delivery_receipt'?'고객이 파일과 사용 안내를 받았다고 했어요. 남은 일을 보고 마감해 주세요.':event.type==='customer_approval'?`${version?.label||'최근 시안'}을 고객이 승인했어요.`:event.type==='changes_requested'?reviewNote||'무엇을 더 고칠지 봐 주세요.':event.type==='review_requested'?`${version?.label||'고친 시안'}을 봐 주세요.`:message?.text||source.nextStep||'이 프로젝트의 요청과 다음 할 일을 봐 주세요.';
        result.push({id:event.id,kind:'client_workflow',type:event.type,message:null,title:titles[event.type]||'고객 프로젝트가 바뀌었어요',text,body:text,projectTitle:source.title,createdAt:event.createdAt,readAt,unread:!readAt,href,projectId:source.id,messageId:event.messageId||null,versionId:event.versionId||null,seconds:message?.seconds??null,tab:event.tab||(event.versionId?'review':'history')});
      }
    }
    return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  }
  function list(user,query={}){
    user=current(user);const all=projected(user),value=key=>typeof query?.get==='function'?query.get(key):query?.[key];
    const unreadOnly=[true,'true','1'].includes(value('unreadOnly')),filtered=unreadOnly?all.filter(item=>item.unread):all,rawLimit=value('limit');
    let notifications=filtered;
    if(rawLimit!==undefined&&rawLimit!==null&&rawLimit!==''){const limit=Number(rawLimit);if(!Number.isInteger(limit)||limit<1||limit>1000)throw fail('알림 개수가 이상해요.');notifications=filtered.slice(0,limit);}
    return {notifications,total:filtered.length,unreadCount:all.filter(item=>item.unread).length};
  }
  function unreadCount(user){return list(user).unreadCount;}
  function projectNews(user,projectId){
    user=current(user);const items=projected(user,projectId).filter(item=>item.unread);
    return {projectId,revision:clientProjects.project(user,projectId).revision,items,unreadCount:items.length};
  }
  function readProjectNews(user,projectId,input){
    user=current(user);
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==1||typeof input.id!=='string'||!input.id||input.id.length>1000)throw fail('본 소식을 하나 골라 주세요.');
    const item=projected(user,projectId).find(item=>item.id===input.id);if(!item)throw fail('그 소식을 찾지 못했어요.',404);
    if(!item.readAt){store.put('clientNotificationReads',receiptId(user.id,item.id),{id:receiptId(user.id,item.id),userId:user.id,eventId:item.id,readAt:clock()});notify([user.id]);}
    return projectNews(user,projectId);
  }
  function read(user,id){
    user=current(user);const item=projected(user).find(item=>item.id===id);if(!item)throw fail('그 알림을 찾지 못했어요.',404);
    if(!item.readAt){store.put('clientNotificationReads',receiptId(user.id,id),{id:receiptId(user.id,id),userId:user.id,eventId:id,readAt:clock()});notify([user.id]);}
    return {ok:true,id,unreadCount:unreadCount(user)};
  }
  function readAll(user){
    user=current(user);const unread=projected(user).filter(item=>!item.readAt),at=clock();
    if(unread.length){store.transaction(()=>{for(const item of unread)store.put('clientNotificationReads',receiptId(user.id,item.id),{id:receiptId(user.id,item.id),userId:user.id,eventId:item.id,readAt:at});});notify([user.id]);}
    return {ok:true,count:unread.length,unreadCount:unreadCount(user)};
  }
  return {list,unreadCount,read,readAll,projectNews,readProjectNews,close:()=>unsubscribe?.()};
}

export function clientNotificationTitle(type){return titles[type]||'프로젝트가 바뀌었어요';}
