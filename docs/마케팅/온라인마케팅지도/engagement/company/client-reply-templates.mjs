import {randomUUID} from 'node:crypto';

const KIND='clientReplyTemplates';
const TOKENS=['{{고객명}}','{{프로젝트명}}','{{합의한 전달일}}'];
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const keys=(value,allowed)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail('내 답변 문구의 입력 항목을 확인해 주세요.');};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function label(value){if(typeof value!=='string'||!value.trim()||value.length>80||/[\u0000-\u001f\u007f]/.test(value))throw fail('문구 이름은 80자 이내로 입력해 주세요.');return value.trim();}
function body(value){
  if(typeof value!=='string'||!value.trim()||value.length>6000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail('문구 내용은 6,000자 이내로 입력해 주세요.');
  const remaining=value.replace(/\{\{[^{}]*\}\}/g,token=>{if(!TOKENS.includes(token))throw fail('고객명, 프로젝트명, 합의한 전달일만 자동으로 채울 수 있습니다.');return '';});
  if(remaining.includes('{{')||remaining.includes('}}'))throw fail('자동으로 채울 항목의 괄호와 이름을 확인해 주세요.');
  return value;
}

export function createClientReplyTemplatesService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function current(user){
    const live=typeof user?.id==='string'&&store.get('users',user.id);
    if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('먼저 로그인해 주세요.',401);
    if(live.role==='viewer')throw fail('열람 계정은 내 답변 문구를 사용할 수 없습니다.',403);
    return live;
  }
  function project(user,id,revision){
    user=current(user);const row=clientProjects.project(user,id,true);
    if(revision!==undefined&&(!Number.isSafeInteger(revision)||row.revision!==revision))throw fail('프로젝트가 변경됐습니다. 최신 내용을 확인한 뒤 다시 미리보기해 주세요.',409);
    return {user,row};
  }
  const recordKey=(user,id)=>user.id+'|'+id;
  function rowFor(user,id){
    if(!uuid(id))throw fail('내 답변 문구를 확인해 주세요.');
    const row=store.get(KIND,recordKey(user,id));
    if(!row||row.ownerId!==user.id||row.id!==id)throw fail('내 답변 문구를 찾을 수 없습니다.',404);
    if(row.schema!==1||!Number.isSafeInteger(row.revision)||row.revision<1||!['active','deleted'].includes(row.status)||typeof row.updatedAt!=='string'||!Number.isFinite(Date.parse(row.updatedAt))||(row.status==='active'&&typeof row.ciphertext!=='string')||(row.status==='deleted'&&Object.hasOwn(row,'ciphertext')))throw fail('보관한 답변 문구를 읽지 못했습니다.',500);
    return row;
  }
  function view(user,row){
    if(row.status==='deleted')return {id:row.id,revision:row.revision,status:'deleted',label:'',body:null,updatedAt:row.updatedAt};
    try{
      const value=store.decrypt(row.ciphertext);
      if(value.ownerId!==user.id||value.id!==row.id)throw new Error('Scope mismatch');
      return {id:row.id,revision:row.revision,status:'active',label:label(value.label),body:body(value.body),updatedAt:row.updatedAt};
    }catch{throw fail('보관한 답변 문구를 읽지 못했습니다.',500);}
  }
  function list(user){
    return store.all(KIND).filter(row=>row.ownerId===user.id&&row.status==='active').map(row=>view(user,rowFor(user,row.id))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
  }
  function workspace(user,id){const scope=project(user,id);return {projectId:id,revision:scope.row.revision,templates:list(scope.user),tokens:[...TOKENS]};}
  function expected(input){if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw fail('답변 문구의 버전을 확인해 주세요.');}
  function fresh(user,input){
    const row=rowFor(user,input.templateId);
    if(row.revision!==input.expectedRevision||row.status!=='active')throw fail('답변 문구가 변경되거나 삭제됐습니다. 최신 문구를 확인해 주세요.',409);
    return row;
  }
  function preview(user,id,input){
    keys(input,['action','revision','templateId','expectedRevision','target','body']);expected(input);
    if(!['message','progress'].includes(input.target))throw fail('문구를 넣을 입력칸을 확인해 주세요.');
    if(!Number.isSafeInteger(input.revision))throw fail('현재 프로젝트 버전을 확인해 주세요.',409);
    const scope=project(user,id,input.revision),unsaved=input.templateId===null;
    if(unsaved&&input.expectedRevision!==0)throw fail('새 문구의 버전을 확인해 주세요.');
    const saved=unsaved?null:view(scope.user,fresh(scope.user,input));
    const content=Object.hasOwn(input,'body')?body(input.body):saved?.body;
    if(typeof content!=='string')throw fail('미리볼 문구 내용을 입력해 주세요.');
    const values={'{{고객명}}':scope.row.customerName,'{{프로젝트명}}':scope.row.title,'{{합의한 전달일}}':validDate(scope.row.dueDate)?scope.row.dueDate:''};
    const missing=[];
    // One replacement pass treats current project values as text, never as more template tokens.
    const rendered=content.replace(/\{\{[^{}]*\}\}/g,token=>{const value=values[token];if(typeof value!=='string'||!value.trim()){if(!missing.includes(token))missing.push(token);return token;}return value;});
    if(rendered.length>30000)throw fail('자동으로 채운 문구가 너무 깁니다. 문구를 줄여 주세요.',413);
    const maxLength=input.target==='message'?3000:30000,tooLong=rendered.length>maxLength;
    return {projectId:id,revision:scope.row.revision,templateId:saved?.id||null,templateRevision:saved?.revision||0,preview:{body:rendered,ready:missing.length===0&&!tooLong,missing,tooLong,maxLength}};
  }
  function mutate(user,id,input){
    if(input?.action==='preview')return preview(user,id,input);
    keys(input,input?.action==='save'?['action','revision','templateId','expectedRevision','label','body']:['action','revision','templateId','expectedRevision']);
    if(!['save','delete'].includes(input.action))throw fail('문구 저장 또는 삭제 내용을 확인해 주세요.');expected(input);
    if(!Number.isSafeInteger(input.revision))throw fail('현재 프로젝트 버전을 확인해 주세요.',409);
    const initial=project(user,id,input.revision),creating=input.action==='save'&&input.templateId===null;
    if(creating&&input.expectedRevision!==0||!creating&&!uuid(input.templateId))throw fail('내 답변 문구의 버전을 확인해 주세요.');
    const nextLabel=input.action==='save'?label(input.label):null,nextBody=input.action==='save'?body(input.body):null;
    return store.transaction(()=>{
      const scope=project(initial.user,id,input.revision),previous=creating?null:fresh(scope.user,input);
      if(creating&&list(scope.user).length>=50)throw fail('내 답변 문구는 50개까지 보관할 수 있습니다.',409);
      if(previous?.revision>=Number.MAX_SAFE_INTEGER)throw fail('문구의 버전 한도에 도달했습니다.',409);
      const templateId=previous?.id||randomUUID(),row={schema:1,id:templateId,ownerId:scope.user.id,revision:(previous?.revision||0)+1,status:input.action==='save'?'active':'deleted',updatedAt:clock()};
      if(input.action==='save')row.ciphertext=store.encrypt({ownerId:scope.user.id,id:templateId,label:nextLabel,body:nextBody});
      // The reusable text is personal. No project, message, approval or delivery record is written.
      store.put(KIND,recordKey(scope.user,templateId),row);
      return {projectId:id,revision:scope.row.revision,template:view(scope.user,row)};
    });
  }
  return Object.freeze({workspace,mutate});
}
