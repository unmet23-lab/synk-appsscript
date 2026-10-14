import {createHash} from 'node:crypto';
import {clientNotificationTitle,customerKickoffNotificationKey} from './client-notifications.mjs';
import {customerSceneRequests} from './client-scene-requests.mjs';
import {buildCustomerPreviewApproval} from './client-preview-approval.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const stamp=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const genericBody='프로젝트를 열어 새 내용과 다음 할 일을 확인해 주세요.';

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
        if(!strategy?.request||strategy.request.strategyRevision!==strategy.revision||strategy.confirmation?.strategyRevision===strategy.revision||event.strategyRevision!==undefined&&event.strategyRevision!==strategy.revision)continue;
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
      notifications.push({id:event.id,type:event.type,title:clientNotificationTitle(event.type),body:genericBody,createdAt:event.createdAt,readAt,unread:!readAt,projectId:row.id,versionId:event.versionId||null,messageId:event.messageId||null,tab,...target});
    }
    notifications.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
    return {revision:stamp([row.id,row.inviteRevision,row.revision,notifications.map(item=>[item.id,item.readAt])]),projectId:row.id,projectRevision:row.revision,notifications:all?notifications:notifications.slice(0,1000),unreadCount:notifications.filter(item=>item.unread).length};
  }
  function customerState(token){return customerProjection(clientProjects.session(token).row);}
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
    const known=new Set(notifications.map(item=>item.id));if(input.ids.some(id=>!known.has(id)))throw fail('알림을 찾을 수 없습니다.',404);
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
