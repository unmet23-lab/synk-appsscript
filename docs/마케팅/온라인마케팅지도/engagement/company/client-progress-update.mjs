import {CLIENT_STAGES} from './client-projects.mjs';
import {customerClientKickoff} from './client-kickoff.mjs';
import {customerClientChanges} from './client-changes.mjs';
import {customerSceneRequests} from './client-scene-requests.mjs';
import {buildClientSchedule} from './client-schedule.mjs';
import {clientDeliveryIdentity,customerClientCloseout} from './client-closeout.mjs';
import {strategyView} from './pulse-strategy.mjs';
import {deliverableView} from './pulse-deliverables.mjs';

const records=value=>Array.isArray(value)?value:[];
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const label=value=>typeof value==='string'?value.replace(/[\r\n\t]+/g,' ').trim():'';
const names=items=>{const values=[...new Set(items.map(item=>label(item.label||item.title)).filter(Boolean))];return values.slice(0,8).join(', ')+(values.length>8?` 외 ${values.length-8}개`:'');};
const requested=(state,key)=>state.revision>0&&state.request?.[key]===state.revision&&state.request.author==='staff'&&instant(state.request.at);
const confirmed=(state,key)=>requested(state,key)&&state.confirmation?.[key]===state.revision&&state.confirmation.author==='customer'&&instant(state.confirmation.at);

// Generate on demand from the existing project. This projection deliberately
// selects customer-safe facts; copying a staff report would expose private
// review notes, source names, targets, contact records or estimated dates.
export function createClientProgressUpdateService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function workspace(user,id){
    // project() rechecks the current stored identity and normal read ACL,
    // including same-team viewers. No write privilege is needed to prepare text.
    if(typeof user?.id!=='string'||!store.get('users',user.id)?.active)throw Object.assign(new Error('먼저 로그인해 주세요.'),{status:401});
    const row=clientProjects.project(user,id),generatedAt=clock(),context=clientProjects.sceneRequestContext(row);
    const kickoff=customerClientKickoff(row,{now:generatedAt}),changes=customerClientChanges(row),scenes=customerSceneRequests(row,context),schedule=buildClientSchedule(row,{now:generatedAt,reviewerId:context.reviewerId});
    const strategy=strategyView(row.studio?.strategy),specs=deliverableView(row.studio||{},row),delivery=clientDeliveryIdentity(row),closeout=customerClientCloseout(row);
    const versions=records(row.versions),preview=versions.filter(version=>version.kind==='preview').at(-1),approved=instant(preview?.approvedAt),archived=row.stage==='archived';
    const messages=records(row.messages).filter(message=>message.author==='customer'&&message.visibility==='customer'),feedback=messages.filter(message=>message.action==='feedback'),pendingFeedback=feedback.filter(message=>!message.resolved);
    const completed=[],current=[],customer=[],dates=[];
    if(archived)current.push('보관한 프로젝트예요. 보관을 풀어야 바꿀 수 있어요.');
    else current.push('지금 단계: '+(CLIENT_STAGES[row.stage]||'담당자가 볼 것'));

    if(kickoff.enabled){
      const required=kickoff.requirements.filter(item=>item.required),ready=required.filter(item=>item.status==='ready'),received=required.filter(item=>item.status==='received'),missing=required.filter(item=>item.status==='missing');
      if(ready.length)completed.push('받아서 확인한 자료: '+names(ready));
      if(received.length)current.push(archived?'받았지만 아직 열어 보지 못한 자료: '+names(received):'받은 자료를 보고 있어요: '+names(received)+' (다시 보내지 않으셔도 돼요.)');
      if(!archived&&missing.length)customer.push('아직 못 받은 자료가 있어요. 고객 화면에서 올려 주세요: '+names(missing));
    }
    const strategyConfirmed=confirmed(strategy,'strategyRevision'),specsConfirmed=confirmed(specs,'deliverableRevision');
    if(strategyConfirmed)completed.push('기획을 확인해 주셨어요.');
    else if(!archived&&requested(strategy,'strategyRevision'))customer.push('고객 화면에서 기획을 확인해 주세요.');
    if(specsConfirmed)completed.push('납품 규격을 확인해 주셨어요.');
    else if(!archived&&requested(specs,'deliverableRevision'))customer.push('고객 화면에서 납품 규격을 확인해 주세요.');
    if(changes.enabled&&changes.changes.length)current.push(archived?'확정한 뒤에 바뀐 내용이 있어요.':changes.status==='reviewed'?'확정한 뒤에 바뀐 내용을 다 봤어요.':'확정한 뒤에 바뀐 내용이 있어서, 관련 장면과 약속을 다시 보고 있어요.');

    const sceneDone=scenes.items.filter(item=>{
      const workflow=row.sceneRequestWorkflows?.[item.id],proof=records(row.studio?.sceneReviews).find(review=>review.id===workflow?.customerReviewId);
      return item.status==='done'&&proof?.author==='customer'&&proof.status==='confirmed'&&proof.sceneId===item.sceneId&&proof.sceneRevision===item.currentRevision;
    });
    if(sceneDone.length)completed.push('고친 장면을 확인해 주셨어요: '+names(sceneDone));
    const sceneWaiting=scenes.items.filter(item=>item.status==='waiting_customer');
    const sceneWorking=scenes.items.filter(item=>!sceneWaiting.includes(item)&&!sceneDone.includes(item));
    if(!archived&&sceneWaiting.length)customer.push('고객 화면에서 고친 장면을 확인해 주세요: '+names(sceneWaiting));
    if(!archived&&sceneWorking.length)current.push(`장면 수정 요청 ${sceneWorking.length}건을 반영하고 있어요.`);

    const feedbackWaiting=pendingFeedback.filter(message=>message.workflow?.status==='waiting_customer'&&message.workflow.resultVersionId===preview?.id);
    const feedbackWorking=pendingFeedback.filter(message=>!feedbackWaiting.includes(message));
    if(!archived&&feedbackWorking.length)current.push(`시안 수정 요청 ${feedbackWorking.length}건을 반영하고 있어요.`);
    if(approved){
      completed.push('시안을 승인해 주셨어요: '+label(preview.label));
      const reflected=feedback.filter(message=>message.resolved&&message.workflow?.status==='done'&&message.workflow.resultVersionId===preview.id);
      if(reflected.length)completed.push(`시안에 반영한 수정 요청 ${reflected.length}건을 확인해 주셨어요.`);
    }else if(preview&&!archived&&!feedbackWorking.length)customer.push('고객 화면에서 시안을 보고 의견이나 승인을 남겨 주세요: '+label(preview.label));
    if(preview&&!approved&&!archived&&feedbackWorking.length)current.push('수정한 내용을 보고 나서 시안 확인을 이어가요.');
    const pendingSupport=messages.filter(message=>message.action==='support'&&!message.resolved).length;
    if(!archived&&pendingSupport)current.push(`남겨 주신 문의 ${pendingSupport}건에 답하고 있어요.`);

    // The canonical identity binds the latest approved preview and entire final
    // file set, so older approvals/receipts cannot complete a newer delivery.
    const receipt=delivery.deliveryKey?records(row.deliveryReceipts).findLast(entry=>entry.deliveryKey===delivery.deliveryKey):null,receiptConfirmed=!!(approved&&closeout.receipt&&receipt?.actor==='customer'&&instant(receipt.confirmedAt));
    if(approved&&delivery.deliveryKey){
      completed.push('최종본을 보내 드렸어요: '+names(delivery.finals));
      if(receiptConfirmed)completed.push('최종본과 사용 안내를 받았다고 해 주셨어요.');
      else if(!archived&&closeout.canConfirm)customer.push('고객 화면에서 최종본과 사용 안내를 보신 뒤 「파일과 안내 확인했어요」를 눌러 주세요.');
    }else if(approved&&!archived)current.push('최종본은 아직 준비 중이에요.');
    // Only the project's agreed date is suitable for this customer message.
    // Schedule targets, intake wishes and remaining-work estimates stay private.
    dates.push(schedule.agreedDueDate?'합의한 전달일: '+schedule.agreedDueDate:'전달일은 아직 정해지지 않았어요. 담당자와 일정을 맞춰 주세요.');
    const nextStep=label(row.nextStep),completedDefault=approved&&nextStep==='새 시안을 확인하고 수정 의견 또는 승인을 남겨 주세요.'||approved&&delivery.deliveryKey&&nextStep==='승인 감사해요. 최종본과 사용 안내를 준비하고 있어요.'||receiptConfirmed&&nextStep==='최종본과 사용 안내를 보내 드렸어요. 궁금한 점은 대화에 남겨 주세요.';
    if(nextStep&&!archived&&!completedDefault)dates.push('프로젝트에 기록된 다음 단계: '+nextStep);
    if(!completed.length)completed.push('아직 끝난 일이 없어요.');
    if(!customer.length)customer.push(archived?'보관한 프로젝트라 고객에게 부탁할 일은 넣지 않았어요.':'지금 고객에게 부탁할 일은 없어요.');
    const title=label(row.title)+' · 진행 안내',sections=[{id:'completed',title:'완료된 일',lines:completed},{id:'current',title:'현재 상태',lines:current},{id:'customer',title:'고객이 해주실 일',lines:customer},{id:'schedule',title:'다음 일정',lines:dates}];
    return {projectId:row.id,revision:row.revision,generatedAt,title,sections,text:[title,...sections.map(section=>section.title+'\n'+section.lines.map(line=>'· '+line).join('\n'))].join('\n\n')};
  }
  return {workspace};
}
