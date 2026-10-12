import {createHash} from 'node:crypto';

const rows=value=>Array.isArray(value)?value:[];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const labels={open:'확인할 장면 수정 요청',in_progress:'장면 수정 중',review:'내부 검토 대기',changes_requested:'장면 다시 수정',waiting_customer:'고객 장면 확인 대기',done:'고객 확인 완료',stale:'최신 장면 다시 연결',unavailable:'장면·자료 확인 필요',archived:'보관됨'};
const editableStatuses=['open','in_progress','changes_requested','stale'];
function requests(row){return rows(row.studio?.sceneReviews).filter(review=>review.author==='customer'&&review.status==='changes');}
function sceneContext(row,sceneId){const scene=rows(row.studio?.scenes).find(scene=>scene.id===sceneId),asset=scene?.assetId?rows(row.studio?.assets).find(asset=>asset.id===scene.assetId):null;return {scene,available:!!scene&&scene.visibility==='customer'&&(!scene.assetId||!!asset),fingerprint:scene?hash({scene,asset:asset||null}):''};}
function effective(row,request,workflow,reviewerId){
  const context=sceneContext(row,request.sceneId),{scene}=context;let status=workflow?.status||'open',reason='고객이 장면에 남긴 수정 요청입니다.';
  if(row.stage==='archived'){status='archived';reason='보관된 프로젝트입니다. 복원 후 현재 장면을 확인해 주세요.';}
  else if(!context.available){status='unavailable';reason=!scene?'원문 장면을 찾을 수 없습니다. 담당자가 확인해 주세요.':scene.visibility!=='customer'?'장면이 비공개 상태입니다. 고객에게 공개할 수정 장면을 확인해 주세요.':'장면에 연결된 자료가 없습니다. 원본 자료를 확인해 주세요.';}
  else if(['review','waiting_customer','done'].includes(status)&&(workflow.resultSceneRevision!==scene.revision||workflow.resultFingerprint!==context.fingerprint||workflow.reviewerId!==(reviewerId||null)||workflow.ownerId!==row.ownerId)){
    status='stale';reason='제출한 뒤 장면·자료 또는 담당자·검토자가 바뀌었습니다. 현재 장면을 다시 연결해 주세요.';
  }else if(row.reviewerId&&!reviewerId&&status!=='done'){status='stale';reason='지정 검토자의 현재 권한을 확인해 주세요. 검토자를 정리한 뒤 다시 제출할 수 있습니다.';}
  else if(status==='review')reason='지정 검토자가 연결된 수정 장면을 확인해야 합니다.';
  else if(status==='waiting_customer')reason='연결된 현재 장면을 고객이 확인하면 이 요청이 완료됩니다.';
  else if(status==='done')reason='연결된 수정 장면을 고객이 확인했습니다.';
  else if(status==='changes_requested')reason='추가 수정 요청을 반영한 새 장면 버전을 준비해 주세요.';
  else if(status==='in_progress')reason='수정 후 새 공개 장면 버전을 이 요청에 연결해 주세요.';
  const minRevision=Math.max(request.sceneRevision||0,workflow?.rejectedSceneRevision||0),canSubmit=editableStatuses.includes(status)&&context.available&&Number.isSafeInteger(scene.revision)&&scene.revision>minRevision&&(!row.reviewerId||!!reviewerId);
  if(editableStatuses.includes(status)&&!canSubmit&&context.available&&(!row.reviewerId||!!reviewerId))reason='요청을 받은 장면보다 새로 수정된 공개 버전이 필요합니다.';
  return {...context,status,reason,canSubmit};
}

// Each request is the original customer sceneReview. Workflow records only link
// that request to an exact later scene; reading never creates or completes work.
export function buildSceneRequests(row,{userId=null,canEdit=false,canReview=false,reviewerId=row.reviewerId||null}={}){
  const writable=row.stage!=='archived',items=requests(row).map(request=>{
    const workflow=row.sceneRequestWorkflows?.[request.id],state=effective(row,request,workflow,reviewerId),actions=[];
    if(writable&&canEdit&&['open','changes_requested','stale'].includes(state.status))actions.push({action:'start',label:'장면 수정 시작'});
    if(writable&&canEdit&&state.canSubmit)actions.push({action:'submit',label:reviewerId?'수정 장면 검토 요청':'수정 장면 고객 확인 대기'});
    if(writable&&canReview&&state.status==='review'&&userId!==workflow?.submittedBy)actions.push({action:'accept',label:'장면 검토 통과'},{action:'request_changes',label:'장면 수정 요청'});
    if(writable&&canEdit&&(['review','waiting_customer','done'].includes(state.status)||state.status==='unavailable'&&workflow&&workflow.status!=='open'))actions.push({action:'reopen',label:'다시 처리'});
    return {id:request.id,sceneId:request.sceneId,title:state.scene?.title||request.title||'장면 확인 필요',text:request.text||'',requestedRevision:request.sceneRevision,currentRevision:state.scene?.revision||null,resultRevision:workflow?.resultSceneRevision||null,status:state.status,statusLabel:labels[state.status],reason:state.reason,createdAt:request.at,updatedAt:workflow?.updatedAt||request.at,canSubmit:writable&&!!canEdit&&state.canSubmit,actions,note:workflow?.note||'',history:rows(workflow?.history).map(({action,at,note})=>({action,at,note:note||''}))};
  });
  return {items,pendingCount:items.filter(item=>item.status!=='done').length,doneCount:items.filter(item=>item.status==='done').length,canEdit:writable&&!!canEdit,canReview:writable&&!!canReview,reviewerId};
}

export function customerSceneRequests(row,options={}){
  const report=buildSceneRequests(row,options),publicScenes=new Set(rows(row.studio?.scenes).filter(scene=>scene.visibility==='customer').map(scene=>scene.id));
  const items=report.items.filter(item=>publicScenes.has(item.sceneId)).map(({canSubmit,actions,note,history,...item})=>({...item,reason:item.status==='review'?'담당자가 수정 장면을 확인하고 있습니다.':item.status==='stale'?'현재 장면을 담당자가 다시 연결한 뒤 확인해 주세요.':item.status==='unavailable'?'현재 장면 자료를 담당자가 확인하고 있습니다.':item.reason}));
  return {items,pendingCount:items.filter(item=>item.status!=='done').length,doneCount:items.filter(item=>item.status==='done').length};
}

function append(workflow,event){const history=rows(workflow?.history);if(history.length>=100)throw fail('이 장면 요청의 처리 기록 100개를 보존하고 있습니다. 새 장면 요청으로 이어가 주세요.',409);return {...workflow,...event,history:[...history,{action:event.action,actor:event.actor,at:event.updatedAt,note:event.note||'',...(event.customerReviewId?{customerReviewId:event.customerReviewId}:{})}]};}
export function applySceneRequestAction(row,input,{actor,at,canEdit=false,canReview=false,reviewerId=row.reviewerId||null}={}){
  const fields={start:['note'],submit:['sceneRevision','note','confirmed'],accept:['note','confirmed'],request_changes:['note'],reopen:['note']};
  if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(fields,input.action)||Object.keys(input).some(key=>!['action','revision','requestId',...fields[input.action]].includes(key)))throw fail('장면 요청 처리 항목을 확인해 주세요.');
  if(row.stage==='archived')throw fail('보관한 프로젝트입니다.',409);
  if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>600||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.note)))throw fail('검토 메모를 600자 이하로 입력해 주세요.');
  const request=requests(row).find(request=>request.id===input.requestId);if(!request)throw fail('고객의 장면 수정 요청을 찾을 수 없습니다.',404);
  const workflows=structuredClone(row.sceneRequestWorkflows||{}),previous=workflows[request.id]||{},state=effective(row,request,previous,reviewerId),canOwner=['start','submit','reopen'].includes(input.action);
  if(canOwner?!canEdit:!canReview)throw fail(canOwner?'프로젝트 담당자 또는 관리자만 처리할 수 있습니다.':'현재 지정 검토자만 처리할 수 있습니다.',403);
  let next={...previous,note:input.note?.trim()||'',actor,action:input.action,updatedAt:at};
  if(input.action==='start'){
    if(!['open','changes_requested','stale'].includes(state.status))throw fail('현재 상태에서 수정을 시작할 수 없습니다.',409);next.status='in_progress';
  }else if(input.action==='submit'){
    if(input.confirmed!==true)throw fail('요청 내용과 수정된 장면을 직접 확인한 뒤 제출해 주세요.');
    if(!state.canSubmit||input.sceneRevision!==state.scene?.revision)throw fail('요청을 받은 뒤 수정한 현재 공개 장면 버전을 선택해 주세요.',409);
    next={...next,status:reviewerId?'review':'waiting_customer',resultSceneRevision:state.scene.revision,resultFingerprint:state.fingerprint,ownerId:row.ownerId,reviewerId:reviewerId||null,submittedBy:actor,submittedAt:at,waitingAt:reviewerId?null:at,customerReviewId:null};
  }else if(input.action==='accept'||input.action==='request_changes'){
    if(state.status!=='review'||previous.submittedBy===actor)throw fail('현재 제출된 수정 장면을 다른 지정 검토자가 확인해야 합니다.',409);
    if(input.action==='accept'){if(input.confirmed!==true)throw fail('수정 장면을 직접 확인한 뒤 검토를 통과시켜 주세요.');next.status='waiting_customer';next.waitingAt=at;next.acceptedBy=actor;}
    else{if(!next.note)throw fail('다시 수정할 내용을 남겨 주세요.');next.status='changes_requested';next.rejectedSceneRevision=state.scene.revision;}
  }else{
    if(!(['review','waiting_customer','done'].includes(state.status)||state.status==='unavailable'&&previous.status&&previous.status!=='open'))throw fail('현재 상태에서 다시 처리할 수 없습니다.',409);
    next.status='open';next.customerReviewId=null;if(previous.status==='done')next.rejectedSceneRevision=Math.max(previous.rejectedSceneRevision||0,previous.resultSceneRevision||0);
  }
  workflows[request.id]=append(previous,next);return workflows;
}

// Called only while committing a new customer review_scene event, never from a
// projection. A confirmation that preceded submission cannot complete work.
export function recordSceneReview(row,review,{at=review.at,reviewerId=row.reviewerId||null}={}){
  if(review.author!=='customer'||!['confirmed','changes'].includes(review.status))return row.sceneRequestWorkflows;
  const workflows=structuredClone(row.sceneRequestWorkflows||{});let changed=false;
  for(const request of requests(row)){
    if(request.id===review.id||request.sceneId!==review.sceneId)continue;
    const previous=workflows[request.id];if(!previous)continue;
    const state=effective(row,request,previous,reviewerId);if(!(state.status==='waiting_customer'||review.status==='changes'&&state.status==='review')||previous.resultSceneRevision!==review.sceneRevision)continue;
    const event=review.status==='confirmed'?{status:'done',customerReviewId:review.id,confirmedAt:at,action:'customer_confirm'}:{status:'changes_requested',rejectedSceneRevision:review.sceneRevision,customerReviewId:null,action:'customer_changes'};
    workflows[request.id]=append(previous,{...previous,...event,actor:'customer',updatedAt:at,note:previous.note||''});changed=true;
  }
  return changed?workflows:row.sceneRequestWorkflows;
}
