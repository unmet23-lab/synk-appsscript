import {randomUUID} from 'node:crypto';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const latestPreview=row=>row.versions.filter(version=>version.kind==='preview').at(-1);
export const CLIENT_WORKFLOW_STATUS={open:'확인할 요청',in_progress:'수정 중',review:'내부 검토 대기',changes_requested:'수정 요청',waiting_customer:'고객 확인 대기',done:'처리됨'};
export function clientWorkflowHref(projectId,versionId=null,messageId=null,seconds=null){
  const query=new URLSearchParams({tab:'workroom',section:'clients',project:projectId});
  if(versionId)query.set('version',versionId);
  if(messageId)query.set('message',messageId);
  if(Number.isFinite(seconds)&&seconds>=0)query.set('seconds',String(seconds));
  return '/?'+query;
}

// Requests are projected from their authoritative project records. Repeated reads,
// server restarts and reassignment therefore never create duplicate messenger tasks.
export function createClientWorkflowService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function current(user){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);return live;}
  function participants(row){
    const owner=store.get('users',row.ownerId),reviewer=store.get('users',row.reviewerId);
    return {owner:owner?.active&&owner.role!=='viewer'?owner:null,reviewer:reviewer?.active&&reviewer.role!=='viewer'&&(reviewer.role==='admin'||reviewer.teamId&&reviewer.teamId===row.teamId)?reviewer:null};
  }
  function projection(user,row){
    if(row.stage==='archived')return [];
    const {owner,reviewer}=participants(row),isOwner=owner?.id===user.id,isReviewer=reviewer?.id===user.id;
    if(!isOwner&&!isReviewer)return [];
    const preview=latestPreview(row),items=[];
    for(const message of row.messages){
      if(message.author!=='customer'||message.action==='approve')continue;
      const status=message.resolved?'done':message.workflow?.status||'open';
      if(status==='done')continue;
      if(!isOwner&&!(isReviewer&&status==='review'))continue;
      const actions=[];
      if(isOwner&&['open','changes_requested'].includes(status))actions.push({action:'start',label:'처리 시작'});
      if(isOwner&&['open','in_progress','changes_requested'].includes(status)){
        if(message.action==='feedback')actions.push({action:'submit_review',label:reviewer?'수정본 검토 요청':'수정본 고객 확인 대기'});
        else actions.push({action:'complete',label:'문의 처리 완료'});
      }
      if(isReviewer&&status==='review')actions.push({action:'accept',label:'검토 통과'},{action:'request_changes',label:'수정 요청'});
      if(isOwner&&['review','waiting_customer'].includes(status))actions.push({action:'reopen',label:'다시 처리'});
      const versionId=message.workflow?.resultVersionId||message.versionId||null;
      items.push({id:`client:${row.id}:${message.id}`,kind:message.action==='feedback'?'feedback':'support',group:status==='review'?(isReviewer?'review':'waiting'):status==='waiting_customer'?'waiting':'reply',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:message.id,versionId,seconds:message.seconds??null,href:clientWorkflowHref(row.id,versionId,message.id,message.seconds),title:message.action==='feedback'?'고객 시안 수정':'고객 문의',text:message.text,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status,statusLabel:CLIENT_WORKFLOW_STATUS[status],dueDate:row.dueDate||'',createdAt:message.at,updatedAt:message.workflow?.updatedAt||message.at,note:message.workflow?.note||'',actions});
    }
    if(isOwner&&preview&&!preview.approvedAt&&!items.some(item=>item.group==='waiting'&&item.status==='waiting_customer'))items.push({id:`client:${row.id}:approval:${preview.id}`,kind:'customer_review',group:'waiting',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview.id,seconds:null,href:clientWorkflowHref(row.id,preview.id),title:'고객 승인 대기',text:preview.label,ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:'waiting_customer',statusLabel:'고객 확인 대기',dueDate:row.dueDate||'',createdAt:preview.createdAt,updatedAt:preview.createdAt,actions:[]});
    if(isOwner&&preview?.approvedAt&&!row.messages.some(message=>message.author==='customer'&&message.action==='feedback'&&!message.resolved)&&!row.versions.some(version=>version.kind==='final'&&version.approvedPreviewId===preview.id))items.push({id:`client:${row.id}:delivery:${preview.id}`,kind:'delivery',group:'next',projectId:row.id,projectTitle:row.title,revision:row.revision,messageId:null,versionId:preview.id,seconds:null,href:clientWorkflowHref(row.id,preview.id),title:'승인 완료 · 최종본 전달',text:'고객이 최근 시안을 승인했습니다. 최종 파일과 사용 안내를 등록하세요.',ownerId:row.ownerId,reviewerId:reviewer?.id||null,status:'ready',statusLabel:'최종 납품 준비',dueDate:row.dueDate||'',createdAt:preview.approvedAt,updatedAt:preview.approvedAt,actions:[]});
    return items;
  }
  function workspace(user){user=current(user);return {items:clientProjects.workspace(user).projects.flatMap(row=>projection(user,row)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))};}
  function update(user,input){
    user=current(user);
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail('요청 내용을 확인해 주세요.');
    return store.transaction(()=>{
      const row=clientProjects.project(user,input.projectId),{owner,reviewer}=participants(row),isOwner=owner?.id===user.id,isReviewer=reviewer?.id===user.id;
      if(row.stage==='archived')throw fail('보관한 프로젝트입니다.',409);
      if(!isOwner&&!isReviewer)throw fail('담당자 또는 지정 검토자만 요청을 처리할 수 있습니다.',403);
      const message=row.messages.find(item=>item.id===input.messageId&&item.author==='customer'&&item.action!=='approve');
      if(!message)throw fail('고객 요청을 찾을 수 없습니다.',404);
      if(input.revision!==row.revision)throw fail('고객 요청이 변경됐습니다. 새로 불러온 뒤 다시 처리해 주세요.',409);
      const status=message.resolved?'done':message.workflow?.status||'open',action=input.action;
      const note=input.note??'';
      if(typeof note!=='string'||note.length>3000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))throw fail('검토 메모를 확인해 주세요.');
      let next,resultVersionId=message.workflow?.resultVersionId||null;
      if(action==='start'&&isOwner&&['open','changes_requested'].includes(status))next='in_progress';
      else if(action==='submit_review'&&isOwner&&message.action==='feedback'&&['open','in_progress','changes_requested'].includes(status)){
        const version=row.versions.find(item=>item.id===input.versionId&&item.kind==='preview');
        if(!version||version.id!==latestPreview(row)?.id||version.id===message.versionId||status==='changes_requested'&&version.id===resultVersionId||version.approvedAt)throw fail('고객 요청 이후의 새 시안을 먼저 등록하고 선택해 주세요.',409);
        next=reviewer?'review':'waiting_customer';resultVersionId=version.id;
      }else if(action==='accept'&&isReviewer&&status==='review'){
        if(!resultVersionId||resultVersionId!==latestPreview(row)?.id)throw fail('최근 수정본이 바뀌었습니다. 담당자가 다시 검토를 요청해야 합니다.',409);
        next=latestPreview(row).approvedAt?'done':'waiting_customer';
      }else if(action==='request_changes'&&isReviewer&&status==='review'){
        if(!note.trim())throw fail('수정할 내용을 남겨 주세요.');next='changes_requested';
      }else if(action==='complete'&&isOwner&&message.action!=='feedback'&&['open','in_progress','changes_requested'].includes(status))next='done';
      else if(action==='reopen'&&isOwner&&['done','waiting_customer','review'].includes(status))next='open';
      else throw fail('현재 상태에서 처리할 수 없거나 담당 권한이 없습니다.',409);
      const at=clock(),entry={action,actor:user.id,at,note:note.trim()},workflow={...(message.workflow||{}),status:next,resultVersionId,updatedAt:at,note:note.trim(),history:[...(message.workflow?.history||[]),entry].slice(-100)};
      const updated={...row,revision:row.revision+1,updatedAt:at,messages:row.messages.map(item=>item.id===message.id?{...item,workflow,resolved:next==='done',resolvedAt:next==='done'?at:null}:item),history:[...row.history,{id:randomUUID(),action:'고객 요청 · '+CLIENT_WORKFLOW_STATUS[next],actor:user.id,at}].slice(-300)};
      clientProjects.commitWorkflow(updated);
      return {project:clientProjects.workspace(user).projects.find(item=>item.id===row.id),...workspace(user)};
    });
  }
  return {workspace,update};
}
