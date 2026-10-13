import {createHash} from 'node:crypto';

const rows=value=>Array.isArray(value)?value:[];
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const labels={open:'내 차례',in_progress:'고치는 중',review:'검토자 차례',changes_requested:'더 고쳐야 함',waiting_customer:'고객 차례',done:'고객이 확인함',stale:'장면 다시 연결할 것',unavailable:'장면·자료 볼 것',archived:'보관됨'};
const editableStatuses=['open','in_progress','changes_requested','stale'];
function requests(row){return rows(row.studio?.sceneReviews).filter(review=>review.author==='customer'&&review.status==='changes');}
function sceneContext(row,sceneId){const scene=rows(row.studio?.scenes).find(scene=>scene.id===sceneId),asset=scene?.assetId?rows(row.studio?.assets).find(asset=>asset.id===scene.assetId):null;return {scene,available:!!scene&&scene.visibility==='customer'&&(!scene.assetId||!!asset),fingerprint:scene?hash({scene,asset:asset||null}):''};}
function effective(row,request,workflow,reviewerId){
  const context=sceneContext(row,request.sceneId),{scene}=context;let status=workflow?.status||'open',reason='고객이 장면에 남긴 수정 요청이에요.';
  if(row.stage==='archived'){status='archived';reason='보관한 프로젝트예요. 보관을 풀어야 장면을 다시 볼 수 있어요.';}
  else if(!context.available){status='unavailable';reason=!scene?'그 장면을 찾지 못했어요. 담당자가 봐 주세요.':scene.visibility!=='customer'?'장면이 고객에게 안 보이는 상태예요. 고친 장면을 공개해 주세요.':'장면에 연결된 자료가 없어요. 원본을 봐 주세요.';}
  else if(['review','waiting_customer','done'].includes(status)&&(workflow.resultSceneRevision!==scene.revision||workflow.resultFingerprint!==context.fingerprint||workflow.reviewerId!==(reviewerId||null)||workflow.ownerId!==row.ownerId)){
    status='stale';reason='제출한 뒤에 장면·자료나 담당자·검토자가 바뀌었어요. 지금 장면을 다시 연결해 주세요.';
  }else if(row.reviewerId&&!reviewerId&&status!=='done'){status='stale';reason='검토자 권한이 바뀌었어요. 검토자를 정리한 뒤 다시 제출해 주세요.';}
  else if(status==='review')reason='검토자가 고친 장면을 봐야 해요.';
  else if(status==='waiting_customer')reason='고객이 이 장면을 확인하면 끝나요.';
  else if(status==='done')reason='고객이 고친 장면을 확인했어요.';
  else if(status==='changes_requested')reason='더 고쳐 달라는 내용을 반영한 장면을 준비해 주세요.';
  else if(status==='in_progress')reason='고친 뒤에 그 장면을 이 요청에 연결해 주세요.';
  const minRevision=Math.max(request.sceneRevision||0,workflow?.rejectedSceneRevision||0),canSubmit=editableStatuses.includes(status)&&context.available&&Number.isSafeInteger(scene.revision)&&scene.revision>minRevision&&(!row.reviewerId||!!reviewerId);
  if(editableStatuses.includes(status)&&!canSubmit&&context.available&&(!row.reviewerId||!!reviewerId))reason='요청을 받은 뒤에 고친 장면이 있어야 해요.';
  return {...context,status,reason,canSubmit};
}

// Each request is the original customer sceneReview. Workflow records only link
// that request to an exact later scene; reading never creates or completes work.
export function buildSceneRequests(row,{userId=null,canEdit=false,canReview=false,reviewerId=row.reviewerId||null}={}){
  const writable=row.stage!=='archived',items=requests(row).map(request=>{
    const workflow=row.sceneRequestWorkflows?.[request.id],state=effective(row,request,workflow,reviewerId),actions=[];
    if(writable&&canEdit&&['open','changes_requested','stale'].includes(state.status))actions.push({action:'start',label:'고치기 시작'});
    if(writable&&canEdit&&state.canSubmit)actions.push({action:'submit',label:reviewerId?'고친 장면 검토 요청':'고친 장면을 고객에게'});
    if(writable&&canReview&&state.status==='review'&&userId!==workflow?.submittedBy)actions.push({action:'accept',label:'검토 통과'},{action:'request_changes',label:'더 고치기'});
    if(writable&&canEdit&&(['review','waiting_customer','done'].includes(state.status)||state.status==='unavailable'&&workflow&&workflow.status!=='open'))actions.push({action:'reopen',label:'다시 열기'});
    return {id:request.id,sceneId:request.sceneId,title:state.scene?.title||request.title||'장면 볼 것',text:request.text||'',requestedRevision:request.sceneRevision,currentRevision:state.scene?.revision||null,resultRevision:workflow?.resultSceneRevision||null,status:state.status,statusLabel:labels[state.status],reason:state.reason,createdAt:request.at,updatedAt:workflow?.updatedAt||request.at,canSubmit:writable&&!!canEdit&&state.canSubmit,actions,note:workflow?.note||'',history:rows(workflow?.history).map(({action,at,note})=>({action,at,note:note||''}))};
  });
  return {items,pendingCount:items.filter(item=>item.status!=='done').length,doneCount:items.filter(item=>item.status==='done').length,canEdit:writable&&!!canEdit,canReview:writable&&!!canReview,reviewerId};
}

export function customerSceneRequests(row,options={}){
  const report=buildSceneRequests(row,options),publicScenes=new Set(rows(row.studio?.scenes).filter(scene=>scene.visibility==='customer').map(scene=>scene.id));
  const items=report.items.filter(item=>publicScenes.has(item.sceneId)).map(({canSubmit,actions,note,history,...item})=>({...item,reason:item.status==='review'?'담당자가 고친 장면을 보고 있어요.':item.status==='stale'?'담당자가 장면을 다시 연결하면 봐 주세요.':item.status==='unavailable'?'담당자가 장면 자료를 보고 있어요.':item.reason}));
  return {items,pendingCount:items.filter(item=>item.status!=='done').length,doneCount:items.filter(item=>item.status==='done').length};
}

function append(workflow,event){const history=rows(workflow?.history);if(history.length>=100)throw fail('이 요청의 기록이 100개예요. 새 요청으로 이어 주세요.',409);return {...workflow,...event,history:[...history,{action:event.action,actor:event.actor,at:event.updatedAt,note:event.note||'',...(event.customerReviewId?{customerReviewId:event.customerReviewId}:{})}]};}
export function applySceneRequestAction(row,input,{actor,at,canEdit=false,canReview=false,reviewerId=row.reviewerId||null}={}){
  const fields={start:['note'],submit:['sceneRevision','note','confirmed'],accept:['note','confirmed'],request_changes:['note'],reopen:['note']};
  if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(fields,input.action)||Object.keys(input).some(key=>!['action','revision','requestId',...fields[input.action]].includes(key)))throw fail('요청 내용이 비어 있어요.');
  if(row.stage==='archived')throw fail('보관한 프로젝트예요. 보관을 풀어야 바꿀 수 있어요.',409);
  if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>600||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input.note)))throw fail('메모는 600자 안으로 적어 주세요.');
  const request=requests(row).find(request=>request.id===input.requestId);if(!request)throw fail('그 장면 요청을 찾지 못했어요.',404);
  const workflows=structuredClone(row.sceneRequestWorkflows||{}),previous=workflows[request.id]||{},state=effective(row,request,previous,reviewerId),canOwner=['start','submit','reopen'].includes(input.action);
  if(canOwner?!canEdit:!canReview)throw fail(canOwner?'이 프로젝트의 담당자나 관리자만 할 수 있어요.':'검토자만 할 수 있어요.',403);
  let next={...previous,note:input.note?.trim()||'',actor,action:input.action,updatedAt:at};
  if(input.action==='start'){
    if(!['open','changes_requested','stale'].includes(state.status))throw fail('지금 상태에서는 시작할 수 없어요.',409);next.status='in_progress';
  }else if(input.action==='submit'){
    if(input.confirmed!==true)throw fail('요청 내용과 고친 장면을 직접 본 뒤에 제출해 주세요.');
    if(!state.canSubmit||input.sceneRevision!==state.scene?.revision)throw fail('요청을 받은 뒤에 고친 장면을 골라 주세요.',409);
    next={...next,status:reviewerId?'review':'waiting_customer',resultSceneRevision:state.scene.revision,resultFingerprint:state.fingerprint,ownerId:row.ownerId,reviewerId:reviewerId||null,submittedBy:actor,submittedAt:at,waitingAt:reviewerId?null:at,customerReviewId:null};
  }else if(input.action==='accept'||input.action==='request_changes'){
    if(state.status!=='review'||previous.submittedBy===actor)throw fail('제출한 장면은 다른 검토자가 봐야 해요.',409);
    if(input.action==='accept'){if(input.confirmed!==true)throw fail('고친 장면을 직접 본 뒤에 통과시켜 주세요.');next.status='waiting_customer';next.waitingAt=at;next.acceptedBy=actor;}
    else{if(!next.note)throw fail('무엇을 더 고칠지 적어 주세요.');next.status='changes_requested';next.rejectedSceneRevision=state.scene.revision;}
  }else{
    if(!(['review','waiting_customer','done'].includes(state.status)||state.status==='unavailable'&&previous.status&&previous.status!=='open'))throw fail('지금 상태에서는 다시 열 수 없어요.',409);
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
