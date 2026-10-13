const KIND='clientDrafts';
const TYPES=['project','message','follow-up','progress'];
const FIELDS={project:{title:160,customerName:100,contact:300,summary:3000,terms:3000,dueDate:10,nextContactDate:10,nextStep:600,internalNotes:3000},message:{text:3000,visibility:8},'follow-up':{note:3000,disposition:8,nextContactDate:10},progress:{text:30000}};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=(message,status=400,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})});

export function createClientDraftsService({store,clientProjects,clock=()=>new Date().toISOString()}){
  function current(user){const live=typeof user?.id==='string'&&store.get('users',user.id);if(!live?.active||!['admin','manager','member','viewer'].includes(live.role))throw fail('로그인이 풀렸어요. 다시 로그인해 주세요.',401);return live;}
  function kind(value){if(!TYPES.includes(value))throw fail('초안 종류가 이상해요.');return value;}
  const editable=(user,project)=>project.stage!=='archived'&&user.role!=='viewer'&&(user.role==='admin'||project.ownerId===user.id||user.role==='manager'&&user.teamId&&user.teamId===project.teamId);
  function authorize(user,projectId,type){user=current(user);const project=clientProjects.project(user,projectId);if(type!=='progress'&&!editable(user,project))throw fail('이 프로젝트에서 초안을 쓸 권한이 없어요.',403);return {user,project};}
  const key=(user,projectId,type)=>user.id+'|'+projectId+'|'+type;
  function validateFields(type,value){
    if(!object(value)||!Object.keys(value).length||Object.keys(value).some(field=>!Object.hasOwn(FIELDS[type],field)))throw fail('보관할 내용이 이상해요.');
    const result={};
    for(const [field,text]of Object.entries(value)){
      if(typeof text!=='string'||text.length>FIELDS[type][field]||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw fail('초안이 너무 길거나 비어 있어요.');
      if(['dueDate','nextContactDate'].includes(field)&&text&&(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text+'T00:00:00Z'))||new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text))throw fail('초안의 날짜가 이상해요.');
      if(field==='visibility'&&!['customer','internal'].includes(text)||field==='disposition'&&!['','schedule','done'].includes(text))throw fail('초안의 선택값이 이상해요.');
      result[field]=text;
    }
    if(Buffer.byteLength(JSON.stringify(result),'utf8')>120000)throw fail('초안이 너무 커요.',413);
    return result;
  }
  function rowFor(user,projectId,type){
    const row=store.get(KIND,key(user,projectId,type));if(!row)return {schema:1,ownerId:user.id,projectId,kind:type,revision:0,status:'empty',updatedAt:null};
    if(row.schema!==1||row.ownerId!==user.id||row.projectId!==projectId||row.kind!==type||!Number.isSafeInteger(row.revision)||row.revision<1||!['active','deleted'].includes(row.status)||!Number.isFinite(Date.parse(row.updatedAt))||(row.status==='active'&&typeof row.ciphertext!=='string')||(row.status==='deleted'&&Object.hasOwn(row,'ciphertext')))throw fail('보관한 초안을 읽지 못했어요. 쓰던 글은 그대로 두세요.',500);
    return row;
  }
  function envelope(user,project,row){
    let fields=null,sourceRevision=null;
    if(row.status==='active'){
      try{const body=store.decrypt(row.ciphertext);if(body.ownerId!==user.id||body.projectId!==project.id||body.kind!==row.kind||!Number.isSafeInteger(body.sourceRevision)||body.sourceRevision<1)throw new Error('Draft scope mismatch');fields=validateFields(row.kind,body.fields);sourceRevision=body.sourceRevision;}
      catch{throw fail('보관한 초안을 읽지 못했어요. 쓰던 글은 그대로 두세요.',500);}
    }
    return {kind:row.kind,revision:row.revision,status:row.status,updatedAt:row.updatedAt,sourceRevision,stale:sourceRevision!==null&&sourceRevision!==project.revision,fields};
  }
  function list(user,projectId){user=current(user);const project=clientProjects.project(user,projectId);return {projectId,projectRevision:project.revision,drafts:TYPES.filter(type=>type==='progress'||editable(user,project)).map(type=>envelope(user,project,rowFor(user,projectId,type)))};}
  function mutate(user,projectId,type,input){
    kind(type);const initial=authorize(user,projectId,type);user=initial.user;
    if(!object(input)||!['save','delete'].includes(input.action)||Object.keys(input).some(field=>!(input.action==='save'?['action','expectedRevision','sourceRevision','fields']:['action','expectedRevision']).includes(field))||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw fail('요청 내용이 비어 있어요.');
    const fields=input.action==='save'?validateFields(type,input.fields):null;
    if(input.action==='save'&&(!Number.isSafeInteger(input.sourceRevision)||input.sourceRevision<1||input.sourceRevision>initial.project.revision))throw fail('초안의 프로젝트 버전이 이상해요.');
    return store.transaction(()=>{
      const scope=authorize(user,projectId,type),row=rowFor(scope.user,projectId,type);
      if(row.revision!==input.expectedRevision)throw Object.assign(fail('다른 창에서 초안을 바꿨어요. 지금 글과 보관한 초안을 비교한 뒤 골라 주세요.',409,'CLIENT_DRAFT_CONFLICT'),{current:envelope(scope.user,scope.project,row)});
      if(row.revision>=Number.MAX_SAFE_INTEGER)throw fail('초안을 새로 보관하지 못했어요.',503);
      const next={schema:1,ownerId:scope.user.id,projectId,kind:type,revision:row.revision+1,status:input.action==='save'?'active':'deleted',updatedAt:clock()};
      if(fields)next.ciphertext=store.encrypt({ownerId:scope.user.id,projectId,kind:type,sourceRevision:input.sourceRevision,fields});
      // Only encrypted personal text is stored; project messages, approvals,
      // assignments, files and workflow records are never mutated here.
      store.put(KIND,key(scope.user,projectId,type),next);
      return {projectId,projectRevision:scope.project.revision,draft:envelope(scope.user,scope.project,next)};
    });
  }
  return Object.freeze({list,mutate});
}
