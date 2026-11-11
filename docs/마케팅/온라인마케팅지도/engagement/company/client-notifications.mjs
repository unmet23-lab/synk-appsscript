import {createHash} from 'node:crypto';
import {customerClientKickoff} from './client-kickoff.mjs';
import {buildCustomerPreviewApproval} from './client-preview-approval.mjs';
import {serverText} from './pulse-locale.mjs';
import {progressOf} from './pulse-progress.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const titles={customer_feedback:'고객이 시안을 고쳐 달래요',customer_support:'고객이 물어봤어요',customer_approval:'고객이 시안을 승인했어요',review_requested:'고친 시안 검토를 부탁했어요',changes_requested:'고친 시안에 더 고칠 게 있대요',review_accepted:'고친 시안 검토가 끝났어요',work_started:'고객 요청을 처리하기 시작했어요',work_completed:'고객 요청 처리를 끝냈어요',work_reopened:'고객 요청을 다시 열었어요',assigned:'고객 프로젝트 담당자가 됐어요',reviewer_assigned:'고객 프로젝트 검토자가 됐어요'};
const unique=values=>[...new Set(values.filter(Boolean))];
titles.customer_delivery_receipt='고객이 최종본을 받았대요';
// 고객 문의에 자동 안내가 먼저 답한 알림(2026-10-19). 사람 답인 「제작팀이 답했어요」와 구별한다.
titles.auto_reply='문의에 자동 안내가 왔어요';
titles.customer_feedback_round='고객이 수정 의견을 모아 보냈어요';
// 결제(판 4): 담당자가 크몽 결제를 요청 · 확인 · 취소했을 때 손님에게. 손님 쪽 본문은 pulse-live.mjs customerBodies.
Object.assign(titles,{payment_requested:'크몽에서 결제해 주세요',payment_confirmed:'결제를 확인했어요',payment_cancelled:'결제가 취소됐어요'});
// 작업 소식(운영 조각 4): 담당자가 소식을 올렸을 때 손님에게(앱 안 · 기기 알림만 — 메일 순간이 아니다). 거두면 손님 알림함에서 빠진다(pulse-live.mjs).
titles.progress_posted='작업 중인 화면이 올라왔어요';
// 의뢰서 흐름(2026-11-04): 새 의뢰 → 내부 확인 → 되묻기 · 모델 → 1차안. 고객 쪽 본문은 pulse-live.mjs customerBodies.
Object.assign(titles,{request_received:'새 의뢰가 들어왔어요',customer_request_answer:'고객이 되물은 내용에 답했어요',customer_request_file:'고객이 자료를 더 보냈어요',customer_request_edit:'고객이 의뢰서를 고쳤어요',customer_model_answer:'고객이 모델 제안에 답했어요',customer_direction_answer:'고객이 방향 제안에 답했어요',customer_draft_review:'고객이 1차안에 의견을 보냈어요',customer_draft_approved:'고객이 1차안을 확인했어요',request_asked:'몇 가지만 더 여쭤봐요',model_proposed:'모델을 확인해 주세요',direction_proposed:'방향 제안이 도착했어요',draft_ready:'1차안이 도착했어요'});
Object.assign(titles,{customer_preferences:'고객이 취향을 알려 줬어요',customer_reference:'고객이 참고 자료에 의견을 남겼어요',customer_strategy:'고객이 제작 설계를 썼어요',customer_strategy_confirmed:'고객이 제작 설계를 확인했어요',customer_concept:'고객이 콘셉트를 골랐어요',customer_scene:'고객이 장면을 보고 의견을 남겼어요',customer_comment:'고객이 기획에 의견을 남겼어요',preview_ready:'새 시안이 왔어요',final_ready:'최종본이 왔어요',staff_reply:'제작팀이 답했어요',strategy_ready:'제작 설계를 확인해 주세요',concept_ready:'콘셉트가 바뀌었어요',scene_ready:'장면 구성이 바뀌었어요',reference_ready:'참고 자료가 바뀌었어요'});
const studioNewsBodies={request_received:'새 의뢰서가 왔어요. 내부 확인에서 빠진 것을 보고 다음을 정해 주세요.',customer_request_answer:'되물은 내용의 답을 내부 확인에서 봐 주세요.',customer_request_file:'고객이 더 보낸 자료를 내부 확인에서 봐 주세요.',customer_request_edit:'고객이 고친 의뢰서를 내부 확인에서 봐 주세요.',customer_model_answer:'모델 제안에 대한 답을 내부 확인에서 봐 주세요.',customer_direction_answer:'방향 제안에 대한 답(고른 안 · 한마디 · 둘 다 아니에요)을 내부 확인에서 봐 주세요.',customer_draft_review:'컷마다 남긴 의견을 봐 주세요.',customer_draft_approved:'고객이 확인한 판으로 다음 단계를 이어 주세요.',customer_preferences:'고객이 남긴 취향을 PULSE에서 봐 주세요.',customer_reference:'고객이 참고 자료에 남긴 의견을 PULSE에서 봐 주세요.',customer_strategy:'고객이 쓴 제작 설계를 PULSE에서 봐 주세요.',customer_strategy_confirmed:'고객이 확인한 제작 설계를 PULSE에서 봐 주세요.',customer_concept:'고객이 고른 콘셉트를 PULSE에서 봐 주세요.',customer_scene:'고객이 장면에 남긴 의견을 PULSE에서 봐 주세요.',customer_comment:'고객이 기획에 남긴 의견을 PULSE에서 봐 주세요.'};
Object.assign(titles,{deliverables_ready:'납품 규격을 확인해 주세요',feedback_classified:'보낸 의견의 수정 범위와 일정이 정리됐어요',kickoff_updated:'준비할 자료에 새 소식이 있어요',scene_review_ready:'고친 장면을 확인해 주세요',preview_review_ready:'수정본 검토가 끝났어요. 시안을 확인해 주세요'});

// Hash only the customer-visible preparation state. Private waiver notes and
// source metadata must neither appear in an event nor create redundant alerts.
export function customerKickoffNotificationKey(row){
  const {enabled,dueDate,requirements}=customerClientKickoff(row);
  return createHash('sha256').update(JSON.stringify({enabled,dueDate,requirements})).digest('hex');
}

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
  // 공개 의뢰서로 들어온 새 프로젝트는 「맡았어요」 대신 「새 의뢰」 하나만 알린다.
  if(!previous&&row.studio?.request)add('request_received',row.id,['owner'],{tab:'desk',actorId:'customer'});
  else if(row.ownerId!==previous?.ownerId)add('assigned',row.ownerId,['owner'],{assigneeId:row.ownerId});
  if(row.reviewerId&&row.reviewerId!==previous?.reviewerId)add('reviewer_assigned',row.reviewerId,['reviewer'],{assigneeId:row.reviewerId});
  const older=new Map((previous?.messages||[]).map(message=>[message.id,message]));
  const feedbackRounds=new Map((row.studio?.feedbackRounds?.rounds||[]).map(round=>[round.id,round]));
  const submittedRounds=new Set();
  for(const message of row.messages||[]){
    const old=older.get(message.id);
    if(message.author==='staff'&&!old&&message.visibility==='customer')add(message.automated?'auto_reply':'staff_reply',message.id,['customer'],{messageId:message.id,tab:'review'});
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
  const history=row.history?.at(-1),action=history?.action?.replace(/^PULSE (?:기획|제작) /,'');
  const committed=history?.id&&history.id!==previous?.history?.at(-1)?.id;
  if(committed&&actorId!=='customer'){
    const approval=buildCustomerPreviewApproval(row),beforeApproval=buildCustomerPreviewApproval(previous||{});
    // Uploads already create preview_ready. Announce the later point at which
    // every previous correction is connected and reviewed for that same file.
    if(beforeApproval.status==='team_review'&&approval.canApprove&&beforeApproval.versionId===approval.versionId&&oldVersions.has(approval.versionId))add('preview_review_ready',approval.versionId,['customer'],{tab:'review',target:'approval',versionId:approval.versionId});
    if(row.kickoffPlan?.enabled&&customerKickoffNotificationKey(row)!==customerKickoffNotificationKey(previous||{}))add('kickoff_updated',String(row.revision),['customer'],{tab:'strategy',target:'kickoff',kickoffKey:customerKickoffNotificationKey(row)});
    for(const [requestId,workflow]of Object.entries(row.sceneRequestWorkflows||{})){
      const old=previous?.sceneRequestWorkflows?.[requestId],request=row.studio?.sceneReviews?.find(item=>item.id===requestId&&item.author==='customer'&&item.status==='changes');
      if(request&&workflow.status==='waiting_customer'&&(old?.status!=='waiting_customer'||old?.resultSceneRevision!==workflow.resultSceneRevision||old?.waitingAt!==workflow.waitingAt))add('scene_review_ready',requestId,['customer'],{tab:'storyboard',sceneId:request.sceneId,requestId,sceneRevision:workflow.resultSceneRevision,workflowAt:workflow.waitingAt});
    }
  }
  // Only the committed studio action creates its alert; reading or importing
  // an unchanged document must not replay old notifications.
  if(committed&&/^PULSE (?:기획|제작) /.test(history.action||'')){
    const studio=row.studio||{},before=previous?.studio||{};
    const customerActions={request_submit:['request_received','desk'],request_answer:['customer_request_answer','desk'],request_file:['customer_request_file','desk'],answer_model:['customer_model_answer','desk'],answer_direction:['customer_direction_answer','desk'],submit_draft_review:['customer_draft_review','desk'],approve_draft:['customer_draft_approved','desk'],save_preferences:['customer_preferences','direction'],save_reference:['customer_reference','direction'],remove_reference:['customer_reference','direction'],save_strategy:['customer_strategy','strategy'],confirm_strategy:['customer_strategy_confirmed','strategy'],select_concept:['customer_concept','concepts'],review_scene:['customer_scene','storyboard'],comment:['customer_comment','history']};
    if(actorId==='customer'&&customerActions[action]){const [type,tab]=customerActions[action];add(action==='request_submit'&&before.request?.submittedAt?'customer_request_edit':type,String(row.revision),['owner','reviewer'],{tab});}
    if(actorId!=='customer'){
      if(action==='request_ask')add('request_asked',String(row.revision),['customer'],{tab:'overview'});
      if(action==='propose_model')add('model_proposed',String(row.revision),['customer'],{tab:'overview'});
      // 방향 제안(11-07 판 1b): 보낼 때마다(고친 제안 · 회차 2 포함) 손님에게 알린다. 정리(settle_direction)는 손님과 이야기한 뒤라 알리지 않는다.
      if(action==='propose_direction')add('direction_proposed',String(row.revision),['customer'],{tab:'overview'});
      if(action==='send_draft')add('draft_ready',String(studio.request?.rounds?.at(-1)?.round),['customer'],{tab:'draft'});
      if(action==='payment_request')add('payment_requested',String(row.revision),['customer'],{tab:'overview'});
      if(action==='payment_confirm')add('payment_confirmed',String(row.revision),['customer'],{tab:'overview'});
      if(action==='payment_cancel')add('payment_cancelled',String(row.revision),['customer'],{tab:'overview'});
      // 작업 소식: 이번에 올린(전에는 올리지 않았던) 소식마다 하나. progressId로 일지의 그 줄과 짝짓고, 거둔 소식의 알림은 손님 보기에서 빠진다.
      if(action==='progress_post'){const was=new Map(progressOf(before).map(item=>[item.id,item.state]));for(const item of progressOf(studio))if(item.state==='posted'&&was.get(item.id)!=='posted')add('progress_posted',item.id,['customer'],{tab:'overview',progressId:item.id});}
      if(action==='request_strategy_review')add('strategy_ready',String(studio.strategy?.revision),['customer'],{tab:'strategy',strategyRevision:studio.strategy?.revision});
      if(action==='request_deliverable_review')add('deliverables_ready',String(studio.deliverables?.revision),['customer'],{tab:'strategy',target:'deliverables',deliverableRevision:studio.deliverables?.revision});
      if(action==='classify_feedback_round'){
        const oldRounds=new Map((before.feedbackRounds?.rounds||[]).map(round=>[round.id,round]));
        for(const round of studio.feedbackRounds?.rounds||[])for(const item of round.items||[]){
          const oldItem=oldRounds.get(round.id)?.items?.find(value=>value.id===item.id);
          if((item.classifications?.length||0)>(oldItem?.classifications?.length||0))add('feedback_classified',item.id,['customer'],{tab:'review',feedbackRoundId:round.id,feedbackItemId:item.id,messageId:item.messageId,versionId:round.versionId,classificationCount:item.classifications.length});
        }
      }
      if((action==='save_concept'||action==='save_scene')&&!studio.request){
        const key=action==='save_concept'?'concepts':'scenes',old=new Map((before[key]||[]).map(card=>[card.id,card]));
        for(const card of studio[key]||[])if(card.visibility==='customer'&&old.get(card.id)?.revision!==card.revision)add(key==='concepts'?'concept_ready':'scene_ready',card.id,['customer'],{tab:key==='concepts'?'concepts':'storyboard',cardRevision:card.revision,...(key==='concepts'?{conceptId:card.id}:{sceneId:card.id})});
      }
      if(action==='save_reference')add('reference_ready',String(row.revision),['customer'],{tab:'direction'});
      if(action==='comment'){
        const comment=studio.comments?.at(-1);
        if(comment?.visibility==='customer')add('staff_reply',comment.id,['customer'],{tab:comment.targetType==='scene'?'storyboard':comment.targetType==='concept'?'concepts':'review',commentId:comment.id,...(comment.targetType==='scene'?{sceneId:comment.targetId}:comment.targetType==='concept'?{conceptId:comment.targetId}:{})});
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
    // Notifications need durable events, not the workspace's schedule/kickoff/
    // workflow views. These sources apply the same current project ACL once.
    const projects=projectId?[clientProjects.project(user,projectId)]:clientProjects.readableSources(user);
    for(const source of projects){
      if(source.stage==='archived'||user.role==='viewer'||!source.notificationEvents?.length)continue;
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
        const studioEvent=['customer_preferences','customer_reference','customer_strategy','customer_strategy_confirmed','customer_concept','customer_scene','customer_comment','request_received','customer_request_answer','customer_request_file','customer_request_edit','customer_model_answer','customer_draft_review','customer_draft_approved'].includes(event.type)&&['direction','strategy','concepts','storyboard','history','desk'].includes(event.tab);
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

// 콘셉트·장면 알림은 처음 올린 카드(cardRevision 1)와 고친 카드를 나눠 부른다. 옛 이벤트(cardRevision 없음)는 원래 제목.
// loc: 손님 알림의 언어(다국어 판 2 — 프로젝트 소통 언어, pulse-locale.mjs). 직원 알림은 늘 한국어.
export function clientNotificationTitle(type,event=null,loc='ko'){
  if(event&&Number.isSafeInteger(event.cardRevision)){
    if(type==='concept_ready')return serverText(loc,event.cardRevision===1?'새 콘셉트가 도착했어요':'콘셉트가 바뀌었어요');
    if(type==='scene_ready')return serverText(loc,event.cardRevision===1?'새 장면이 도착했어요':'장면이 바뀌었어요');
  }
  return serverText(loc,titles[type]||'프로젝트가 바뀌었어요');
}
