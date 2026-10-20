import {createHash} from 'node:crypto';
import {clientNotificationTitle,customerKickoffNotificationKey} from './client-notifications.mjs';
import {customerSceneRequests} from './client-scene-requests.mjs';
import {buildCustomerPreviewApproval} from './client-preview-approval.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const stamp=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const genericBody='프로젝트를 열어 새 내용과 다음 할 일을 확인해 주세요.';
// 고객 알림 본문: 프로젝트 내용 없이 「무엇을 하면 되는지」만(알림 이벤트는 내용 없는 포인터라는 원칙 유지, 2026-10-19).
const customerBodies={preview_ready:'영상을 재생해 보고, 바꾸고 싶은 장면에 의견을 남기거나 승인해 주세요.',final_ready:'최종 파일을 받아 보고 사용 안내를 확인한 뒤 수령 확인을 남겨 주세요.',staff_reply:'보낸 의견이나 문의에 대한 답을 확인해 주세요.',auto_reply:'남긴 문의에 자동 안내가 먼저 답했어요. 담당자도 이어서 확인해요.',strategy_ready:'메시지·근거·행동을 살펴보고, 이대로 진행해도 되면 확인을 남겨 주세요.',deliverables_ready:'받을 파일 목록과 규격을 살펴보고 확인을 남겨 주세요.',concept_ready:'콘셉트를 나란히 비교하고 마음에 가까운 방향을 골라 주세요.',scene_ready:'장면의 흐름과 문구를 확인하고, 바꾸고 싶은 곳이 있으면 의견을 남겨 주세요.',reference_ready:'제작팀이 정리한 참고 자료를 확인해 주세요.',feedback_classified:'보낸 의견을 어떻게 반영할지와 일정 안내를 확인해 주세요.',kickoff_updated:'제작을 시작하기 전에 준비할 자료를 확인해 주세요.',scene_review_ready:'고친 장면을 보고 확인을 남겨 주세요.',preview_review_ready:'이 시안을 기준으로 최종 제작을 승인할 수 있어요.'};
// 앱 안 알림함에서는 이어서 온 같은 종류의 카드 알림(콘셉트·장면·참고 자료)을 한 줄로 묶는다. 기기 알림 목록(customerPushNotifications)은 묶지 않는다.
const GROUPED=new Set(['concept_ready','scene_ready','reference_ready']);
// 같은 카드가 올라온 뒤 고쳐졌으면 한 장으로 센다. 아직 읽지 않은 첫 등록(cardRevision 1)이 있으면 고객에게는 새 카드다.
function groupedTitle(type,members){
  if(type==='reference_ready')return `참고 자료가 바뀌었어요 · ${members.length}건`;
  const noun=type==='concept_ready'?'콘셉트':'장면',cards=new Map();
  for(const member of members){const key=member.card||member.id,seen=cards.get(key)||{fresh:false,known:true};cards.set(key,{fresh:seen.fresh||member.cardRevision===1,known:seen.known&&Number.isSafeInteger(member.cardRevision)});}
  const list=[...cards.values()],n=list.length,fresh=list.filter(card=>card.fresh).length;
  if(!list.every(card=>card.known))return clientNotificationTitle(type);
  if(n===1)return clientNotificationTitle(type,{cardRevision:fresh?1:2});
  if(fresh===n)return `새 ${noun} ${n}개가 도착했어요`;
  if(!fresh)return `${noun} ${n}개가 바뀌었어요`;
  return `새 ${noun} ${fresh}개 · 바뀐 ${noun} ${n-fresh}개`;
}
export function groupCustomerNotifications(items){
  const out=[];
  for(const item of items){
    const last=out.at(-1);
    const member=value=>({id:value.id,cardRevision:value.cardRevision,card:value.conceptId||value.sceneId||null});
    if(last&&GROUPED.has(item.type)&&last.type===item.type&&last.unread===item.unread){(last.members||(last.members=[member(last)])).push(member(item));continue;}
    out.push({...item});
  }
  return out.map(({members,cardRevision,...item})=>members?{...item,ids:members.map(member=>member.id),count:members.length,title:groupedTitle(item.type,members)}:item);
}

// The SSE stream carries only this projection's opaque revision. Notification
// receipts are durable, and every read rechecks the authoritative project ACL.
export function createPulseLiveService({store,clientProjects,clientNotifications,clock=()=>new Date().toISOString(),onChange=()=>{}}){
  function staffState(user){
    const projects=clientProjects.workspace(user).projects.map(({id,revision})=>({id,revision})).sort((a,b)=>a.id.localeCompare(b.id));
    const {notifications,unreadCount}=clientNotifications.list(user);
    const safe=notifications.map(({id,type,title,createdAt,readAt,unread,projectId,projectTitle,versionId,messageId,tab})=>({id,type,title,body:genericBody,createdAt,readAt,unread,projectId,projectTitle,versionId,messageId,tab}));
    return {revision:stamp([user.id,projects,safe.map(item=>[item.id,item.readAt])]),userId:user.id,projects,notifications:safe.slice(0,1000),unreadCount};
  }
  const customerReceipt=(row,eventId)=>`${row.id}|${row.inviteRevision}|${eventId}`;
  function customerProjection(row,{all=false}={}){
    const notifications=[];
    let sceneRequests,kickoffKey,previewApproval;
    for(const event of row.notificationEvents||[]){
      if(!event.audiences?.includes('customer')||event.actorId==='customer')continue;
      if(event.versionId&&!row.versions.some(version=>version.id===event.versionId))continue;
      if(event.messageId&&!row.messages.some(message=>message.id===event.messageId&&message.visibility==='customer'))continue;
      if(event.sceneId&&!row.studio?.scenes?.some(scene=>scene.id===event.sceneId&&scene.visibility==='customer'))continue;
      if(event.conceptId&&!row.studio?.concepts?.some(concept=>concept.id===event.conceptId&&concept.visibility==='customer'))continue;
      if(event.type==='preview_review_ready'){
        previewApproval??=buildCustomerPreviewApproval(row);
        if(!previewApproval.canApprove||previewApproval.versionId!==event.versionId||row.notificationEvents.findLast(item=>item.type==='preview_review_ready'&&item.versionId===event.versionId)?.id!==event.id)continue;
      }
      if(event.commentId){const comment=row.studio?.comments?.find(item=>item.id===event.commentId);if(!comment||comment.visibility!=='customer')continue;const target=comment.targetType==='concept'?row.studio?.concepts:comment.targetType==='scene'?row.studio?.scenes:null;if(target&&!target.some(item=>item.id===comment.targetId&&item.visibility==='customer'))continue;}
      if(event.type==='strategy_ready'){
        const strategy=row.studio?.strategy;
        // 고객이 모델·스타일만 바꿔 확인 요청이 새 버전으로 이어졌으면(carriedFrom) 처음 요청한 버전의 알림을 그대로 둔다.
        if(!strategy?.request||strategy.request.strategyRevision!==strategy.revision||strategy.confirmation?.strategyRevision===strategy.revision||event.strategyRevision!==undefined&&event.strategyRevision!==(strategy.request.carriedFrom??strategy.request.strategyRevision))continue;
      }
      if(event.type==='deliverables_ready'){
        const deliverables=row.studio?.deliverables;
        if(deliverables?.revision!==event.deliverableRevision||deliverables.request?.deliverableRevision!==event.deliverableRevision||deliverables.confirmation?.deliverableRevision===event.deliverableRevision)continue;
      }
      if(event.type==='feedback_classified'){
        const round=row.studio?.feedbackRounds?.rounds?.find(item=>item.id===event.feedbackRoundId),item=round?.items?.find(value=>value.id===event.feedbackItemId&&value.messageId===event.messageId);
        if(!item||item.classifications?.length!==event.classificationCount)continue;
      }
      if(event.type==='kickoff_updated'){
        if(!row.kickoffPlan?.enabled)continue;
        kickoffKey??=customerKickoffNotificationKey(row);
        if(event.kickoffKey!==kickoffKey||row.notificationEvents.findLast(item=>item.type==='kickoff_updated')?.id!==event.id)continue;
      }
      if(event.type==='scene_review_ready'){
        sceneRequests??=customerSceneRequests(row,clientProjects.sceneRequestContext(row)).items;
        const item=sceneRequests.find(item=>item.id===event.requestId&&item.sceneId===event.sceneId),workflow=row.sceneRequestWorkflows?.[event.requestId];
        if(item?.status!=='waiting_customer'||item.resultRevision!==event.sceneRevision||workflow?.waitingAt!==event.workflowAt)continue;
      }
      const readAt=store.get('pulseCustomerNotificationReads',customerReceipt(row,event.id))?.readAt||null;
      // Existing durable reply pointers also land in the conversation after the
      // customer tabs changed; their stored receipts and identities stay intact.
      const tab=event.type==='staff_reply'&&(!event.tab||event.tab==='history')?'review':event.tab||'history';
      const target=Object.fromEntries(['target','commentId','conceptId','sceneId','requestId','feedbackRoundId','feedbackItemId'].filter(key=>event[key]).map(key=>[key,event[key]]));
      notifications.push({id:event.id,type:event.type,title:clientNotificationTitle(event.type,event),body:customerBodies[event.type]||genericBody,createdAt:event.createdAt,readAt,unread:!readAt,projectId:row.id,versionId:event.versionId||null,messageId:event.messageId||null,tab,...(Number.isSafeInteger(event.cardRevision)?{cardRevision:event.cardRevision}:{}),...target});
    }
    notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    return {revision:stamp([row.id,row.inviteRevision,row.revision,notifications.map(item=>[item.id,item.readAt])]),projectId:row.id,projectRevision:row.revision,notifications:all?notifications:notifications.slice(0,1000),unreadCount:notifications.filter(item=>item.unread).length};
  }
  function customerState(token){const state=customerProjection(clientProjects.session(token).row),notifications=groupCustomerNotifications(state.notifications);return {...state,notifications,unreadCount:notifications.filter(item=>item.unread).length};}
  function customerPushNotifications(principal){
    const parsed=/^pulse:([a-f0-9-]{36}):(\d+)$/.exec(principal||'');if(!parsed)return [];
    const row=store.get('clientProjects',parsed[1]);
    // Device authorization is checked separately at delivery. An expired invite
    // blocks new connections, not a customer's already remembered device.
    if(!row||row.stage==='archived'||!row.inviteHash||row.inviteRevision!==Number(parsed[2]))return [];
    return customerProjection(row,{all:true}).notifications;
  }
  function selection(input,notifications){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['ids','all'].includes(key)))throw fail('읽을 알림을 확인해 주세요.');
    if(input.all===true&&input.ids===undefined)return notifications.filter(item=>item.unread).map(item=>item.id);
    if(input.all!==undefined||!Array.isArray(input.ids)||input.ids.length<1||input.ids.length>1000||input.ids.some(id=>typeof id!=='string'||id.length>1000))throw fail('읽을 알림을 확인해 주세요.');
    const known=new Set(notifications.map(item=>item.id));if(input.ids.some(id=>!known.has(id)))throw fail('알림을 찾지 못했어요.',404);
    return [...new Set(input.ids)];
  }
  function staffRead(user,input){
    const state=staffState(user),ids=selection(input,state.notifications);
    if(input.all===true){clientNotifications.readAll(user);onChange();return staffState(user);}
    for(const id of ids)clientNotifications.read(user,id);
    if(ids.length)onChange();return staffState(user);
  }
  function customerRead(token,csrf,input){
    const {auth,row}=clientProjects.session(token);if(typeof csrf!=='string'||auth.body.csrf!==csrf)throw fail('고객 화면을 다시 열어 주세요.',403);
    const state=customerProjection(row,{all:true}),ids=selection(input,state.notifications),at=clock();
    store.transaction(()=>{for(const id of ids){const receipt=customerReceipt(row,id);if(!store.get('pulseCustomerNotificationReads',receipt))store.put('pulseCustomerNotificationReads',receipt,{id:receipt,projectId:row.id,inviteRevision:row.inviteRevision,eventId:id,readAt:at});}});
    if(ids.length)onChange();return customerState(token);
  }
  return {staffState,customerState,staffRead,customerRead,customerPushNotifications};
}
