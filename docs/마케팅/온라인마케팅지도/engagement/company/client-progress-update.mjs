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
    if(archived)current.push('보관 중인 프로젝트입니다.');
    else current.push('현재 진행 단계: '+(CLIENT_STAGES[row.stage]||'담당자 확인 필요'));

    if(kickoff.enabled){
      const required=kickoff.requirements.filter(item=>item.required),ready=required.filter(item=>item.status==='ready'),received=required.filter(item=>item.status==='received'),missing=required.filter(item=>item.status==='missing');
      if(ready.length)completed.push('필수 자료 내용 확인 완료: '+names(ready));
      if(received.length)current.push(archived?'전달받은 자료 중 담당자 확인 기록이 없는 항목: '+names(received):'전달받은 자료를 담당자가 확인하고 있습니다: '+names(received)+' (다시 보내지 않으셔도 됩니다.)');
      if(!archived&&missing.length)customer.push('필요한 자료를 고객 작업실에 올리거나 기존 자료를 항목에 연결해 주세요: '+names(missing));
    }
    const strategyConfirmed=confirmed(strategy,'strategyRevision'),specsConfirmed=confirmed(specs,'deliverableRevision');
    if(strategyConfirmed)completed.push('현재 제작 기획 고객 확인 완료.');
    else if(!archived&&requested(strategy,'strategyRevision'))customer.push('고객 작업실에서 현재 제작 기획을 확인해 주세요.');
    if(specsConfirmed)completed.push('현재 납품 규격 고객 확인 완료.');
    else if(!archived&&requested(specs,'deliverableRevision'))customer.push('고객 작업실에서 현재 납품 규격을 확인해 주세요.');
    if(changes.enabled&&changes.changes.length)current.push(archived?'제작 기준 이후 변경된 내용이 기록되어 있습니다.':changes.status==='reviewed'?'제작 기준 이후 변경된 내용의 재확인이 완료됐습니다.':'제작 기준 이후 변경된 내용이 있습니다. 관련 장면과 합의 내용을 확인하고 있습니다.');

    const sceneDone=scenes.items.filter(item=>{
      const workflow=row.sceneRequestWorkflows?.[item.id],proof=records(row.studio?.sceneReviews).find(review=>review.id===workflow?.customerReviewId);
      return item.status==='done'&&proof?.author==='customer'&&proof.status==='confirmed'&&proof.sceneId===item.sceneId&&proof.sceneRevision===item.currentRevision;
    });
    if(sceneDone.length)completed.push('수정 장면 고객 확인 완료: '+names(sceneDone));
    const sceneWaiting=scenes.items.filter(item=>item.status==='waiting_customer');
    const sceneWorking=scenes.items.filter(item=>!sceneWaiting.includes(item)&&!sceneDone.includes(item));
    if(!archived&&sceneWaiting.length)customer.push('고객 작업실에서 반영된 수정 장면을 확인해 주세요: '+names(sceneWaiting));
    if(!archived&&sceneWorking.length)current.push(`장면 수정 요청 ${sceneWorking.length}건을 담당자가 확인·반영하고 있습니다.`);

    const feedbackWaiting=pendingFeedback.filter(message=>message.workflow?.status==='waiting_customer'&&message.workflow.resultVersionId===preview?.id);
    const feedbackWorking=pendingFeedback.filter(message=>!feedbackWaiting.includes(message));
    if(!archived&&feedbackWorking.length)current.push(`시안 수정 요청 ${feedbackWorking.length}건을 담당자가 확인·반영하고 있습니다.`);
    if(approved){
      completed.push('현재 시안 고객 승인 완료: '+label(preview.label));
      const reflected=feedback.filter(message=>message.resolved&&message.workflow?.status==='done'&&message.workflow.resultVersionId===preview.id);
      if(reflected.length)completed.push(`현재 시안에 반영된 수정 요청 ${reflected.length}건 고객 확인 완료.`);
    }else if(preview&&!archived&&!feedbackWorking.length)customer.push('고객 작업실에서 현재 시안을 확인하고 수정 의견 또는 승인을 남겨 주세요: '+label(preview.label));
    if(preview&&!approved&&!archived&&feedbackWorking.length)current.push('수정 사항을 확인한 뒤 현재 시안의 고객 확인을 이어갑니다.');
    const pendingSupport=messages.filter(message=>message.action==='support'&&!message.resolved).length;
    if(!archived&&pendingSupport)current.push(`남겨 주신 문의 ${pendingSupport}건을 담당자가 확인하고 있습니다.`);

    // The canonical identity binds the latest approved preview and entire final
    // file set, so older approvals/receipts cannot complete a newer delivery.
    const receipt=delivery.deliveryKey?records(row.deliveryReceipts).findLast(entry=>entry.deliveryKey===delivery.deliveryKey):null,receiptConfirmed=!!(approved&&closeout.receipt&&receipt?.actor==='customer'&&instant(receipt.confirmedAt));
    if(approved&&delivery.deliveryKey){
      completed.push('현재 승인 시안의 최종 파일 등록 완료: '+names(delivery.finals));
      if(receiptConfirmed)completed.push('현재 최종 파일 묶음과 사용 안내의 고객 수령 확인 완료.');
      else if(!archived&&closeout.canConfirm)customer.push('고객 작업실에서 최종 파일과 사용 안내를 확인한 뒤 ‘파일과 안내 확인했어요’를 눌러 주세요.');
    }else if(approved&&!archived)current.push('현재 승인 시안에 연결된 최종 파일은 아직 등록되지 않았습니다.');
    // Only the project's agreed date is suitable for this customer message.
    // Schedule targets, intake wishes and remaining-work estimates stay private.
    dates.push(schedule.agreedDueDate?'합의한 전달일: '+schedule.agreedDueDate:'합의한 전달일은 아직 기록되지 않았습니다. 담당자와 일정 확인이 필요합니다.');
    const nextStep=label(row.nextStep),completedDefault=approved&&nextStep==='새 시안을 확인하고 수정 의견 또는 승인을 남겨 주세요.'||approved&&delivery.deliveryKey&&nextStep==='시안 승인을 확인했습니다. 담당자가 최종 파일과 사용 안내를 준비합니다.'||receiptConfirmed&&nextStep==='최종 파일과 사용 안내를 확인해 주세요. 추가로 궁금한 점은 후속 문의에 남겨 주세요.';
    if(nextStep&&!archived&&!completedDefault)dates.push('프로젝트에 기록된 다음 단계: '+nextStep);
    if(!completed.length)completed.push('아직 기록된 완료 항목이 없습니다.');
    if(!customer.length)customer.push(archived?'보관 중인 프로젝트로, 이 안내에는 고객 확인 요청을 포함하지 않습니다.':'이 안내에 포함할 고객 자료·확인 요청은 없습니다.');
    const title=label(row.title)+' · 진행 안내',sections=[{id:'completed',title:'완료된 일',lines:completed},{id:'current',title:'현재 상태',lines:current},{id:'customer',title:'고객이 해주실 일',lines:customer},{id:'schedule',title:'다음 일정',lines:dates}];
    return {projectId:row.id,revision:row.revision,generatedAt,title,sections,text:[title,...sections.map(section=>section.title+'\n'+section.lines.map(line=>'· '+line).join('\n'))].join('\n\n')};
  }
  return {workspace};
}
