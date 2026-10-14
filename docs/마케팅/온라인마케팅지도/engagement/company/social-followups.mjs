import {createHash,randomUUID} from 'node:crypto';
import {canReadChannel,canWriteChannel} from './organization.mjs';

const KIND='socialFollowups';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function text(value,label,max=200){
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail(label+'을 확인해 주세요.');
  return value.trim();
}
function date(value){
  const raw=text(value,'업무 기한',10),match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if(!match||Number(match[2])<1||Number(match[2])>12||Number(match[3])<1||Number(match[3])>new Date(Date.UTC(Number(match[1]),Number(match[2]),0)).getUTCDate())throw fail('실제로 존재하는 업무 기한을 선택해 주세요.');
  return raw;
}
const sourceHref=id=>'/?tab=social&section=inbox&inboxId='+encodeURIComponent(id);
const taskHref=(channelId,messageId)=>'/?tab=messenger&panel=tasks&channelId='+encodeURIComponent(channelId)+'&messageId='+encodeURIComponent(messageId);

/** Bridges an SNS source reference to the existing company task lifecycle.
 * The task adapter must synchronously reauthorize its existing room/task APIs.
 * Its create method must retain direct-task requestId idempotency across restarts.
 */
export function createSocialFollowups({store,tasks,origin='',clock=()=>new Date().toISOString()}={}){
  if(!store||!tasks||['options','create','get'].some(key=>typeof tasks[key]!=='function'))throw new TypeError('store and synchronous task adapter are required');
  const sourceOrigin=origin?new URL(origin).origin:'';
  function current(user,context={},write=false){
    if(context.signal?.aborted)throw fail('후속 업무 요청이 중단됐습니다.',409);
    const authorized=context.authorize?.(),live=store.get('users',user?.id);
    if(!live?.active||!['admin','manager','member','viewer'].includes(live.role)||authorized&&authorized.id!==live.id)throw fail('현재 로그인 상태를 확인해 주세요.',401);
    if(write&&live.role==='viewer')throw fail('후속 업무 작성 권한이 필요합니다.',403);
    return live;
  }
  function source(user,inboxId,context={},write=false){
    user=current(user,context,write);
    const row=store.get('socialInbox',text(inboxId,'문의 기록',150)),channel=row&&store.get('channels',row.channelId);
    if(!row||!channel||channel.active===false||channel.hidden||!(write?canWriteChannel:canReadChannel)(user,channel))throw fail('현재 접근할 수 있는 문의 기록을 선택해 주세요.',404);
    return {user,row,channel};
  }
  function sync(result){if(result&&typeof result.then==='function')throw new TypeError('Task adapter must be synchronous');return result;}
  function targets(user,channel){
    const options=sync(tasks.options(user));
    return (options?.channels||[]).filter(room=>Array.isArray(room.companyUserIds)&&room.companyUserIds.length>0&&room.companyUserIds.includes(user.id)&&room.companyUserIds.every(id=>{
      const member=store.get('users',id);return member?.active&&canReadChannel(member,channel);
    })).map(room=>({id:room.id,name:room.name,kind:room.kind,assignees:(room.taskAssignees||[]).filter(person=>{
      const member=store.get('users',person.companyUserId);return room.companyUserIds.includes(member?.id)&&member?.active&&canWriteChannel(member,channel);
    }).map(person=>({id:person.companyUserId,name:person.name,taskUserId:person.id}))})).filter(room=>room.assignees.length);
  }
  function taskView(user,record){
    const base={id:record.id,inboxId:record.inboxId,channelId:record.channelId,sourceHref:sourceHref(record.inboxId),createdAt:record.createdAt};
    if(record.state!=='linked'){
      const canRetry=record.createdBy===user.id,revision=store.get('socialInbox',record.inboxId)?.revision;
      return {...base,state:'pending',canRetry,...(canRetry?{sourceRevision:record.sourceRevision,retryInput:{inboxId:record.inboxId,revision,roomId:record.roomId,assigneeId:record.assigneeId,nextAction:record.nextAction,dueDate:record.dueDate}}:{}),message:'업무 등록 결과를 확인 중입니다. 같은 작성자가 같은 내용으로 다시 확인하면 중복 없이 이어집니다.'};
    }
    let result;
    try{result=sync(tasks.get(user,{messageId:record.messageId}));}catch(error){if(![403,404,410].includes(error.status))throw error;}
    const task=result?.task;
    if(!task||String(task.messageId)!==record.messageId||task.channelId!==record.roomId||task.id!==record.taskId)return {...base,state:'unavailable',canRetry:false,message:'연결한 업무가 삭제되었거나 현재 대화방에 접근할 수 없습니다. 새 업무를 자동 생성하지 않습니다.'};
    return {...base,state:'linked',taskId:task.id,messageId:record.messageId,roomId:record.roomId,taskHref:taskHref(record.roomId,record.messageId),nextAction:record.nextAction,title:task.title,dueDate:task.dueDate??null,assigneeId:task.assignee?.companyUserId??result.assigneeCompanyUserId??null,assigneeName:task.assignee?.name||null,stage:task.stage,status:task.status,revision:task.revision,canManage:task.canManage===true,updatedAt:task.updatedAt,workday:task.workday||null};
  }
  function item(user,row,channel){
    const record=store.get(KIND,row.id);
    return {inboxId:row.id,channelId:channel.id,sourceHref:sourceHref(row.id),canCreate:!record&&canWriteChannel(user,channel),followup:record?taskView(user,record):null};
  }
  function list(user){
    user=current(user);const items=[];
    for(const row of store.all('socialInbox')){
      const channel=store.get('channels',row.channelId);
      if(channel&&channel.active!==false&&!channel.hidden&&canReadChannel(user,channel))items.push(item(user,row,channel));
    }
    return {items};
  }
  function workspace(user,{inboxId}={},context={}){
    const live=source(user,inboxId,context),writable=canWriteChannel(live.user,live.channel);
    return {items:[item(live.user,live.row,live.channel)],targets:writable?targets(live.user,live.channel):[],date:new Date(Date.parse(clock())+9*3600000).toISOString().slice(0,10),deadlineBasis:'Asia/Seoul'};
  }
  function linkResult(user,record,result,context){
    const task=result?.task,message=result?.message;
    if(!task?.id||!message?.id||String(task.messageId)!==String(message.id)||task.channelId!==record.roomId)throw fail('기존 업무 서비스의 등록 결과를 확인하지 못했습니다. 같은 내용으로 다시 확인해 주세요.',502);
    // A returned task is durable even if the caller loses permission immediately
    // afterward. Save its identity first, then recheck before exposing the result.
    const linked={...record,state:'linked',taskId:task.id,messageId:String(message.id),linkedAt:clock()};
    store.transaction(()=>{const currentRecord=store.get(KIND,record.inboxId);if(currentRecord?.id!==record.id||currentRecord.requestId!==record.requestId)throw fail('후속 업무 연결 기록이 변경됐습니다.',409);store.put(KIND,record.inboxId,linked);});
    const live=source(user,record.inboxId,context,true);
    return {created:result.created!==false,followup:taskView(live.user,linked)};
  }
  function create(user,input={},context={}){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['inboxId','revision','roomId','assigneeId','nextAction','dueDate'].includes(key)))throw fail('후속 업무 입력 항목을 확인해 주세요.');
    let live=source(user,input.inboxId,context,true);
    const normalized={roomId:text(input.roomId,'업무 대화방'),assigneeId:text(input.assigneeId,'담당자'),nextAction:text(input.nextAction,'다음 행동',2000),dueDate:date(input.dueDate)},fingerprint=hash(normalized);
    let record=store.get(KIND,live.row.id);
    if(record){
      if(record.fingerprint!==fingerprint)throw fail('이미 이 문의에 후속 업무를 연결했습니다. 기존 업무에서 담당·기한·진행 상태를 변경해 주세요.',409);
      if(record.state==='linked')return {created:false,followup:taskView(live.user,record)};
      if(record.createdBy!==live.user.id)throw fail('다른 작성자의 업무 등록 결과를 확인 중입니다. 기존 작성자가 등록 결과를 먼저 확인해 주세요.',409);
      // Read a durable original receipt before applying creation-time revision
      // and assignee checks. A completed task may since have been reassigned.
      if(typeof tasks.find==='function'){
        const found=sync(tasks.find(live.user,{requestId:record.requestId}));
        if(found)return linkResult(user,record,{...found,created:false},context);
      }
    }
    if(!Number.isSafeInteger(input.revision)||input.revision!==live.row.revision)throw fail('문의가 변경됐습니다. 현재 원문을 다시 확인해 주세요.',409);
    const room=targets(live.user,live.channel).find(candidate=>candidate.id===normalized.roomId),assignee=room?.assignees.find(person=>person.id===normalized.assigneeId);
    if(!room||!assignee)throw fail('문의 접근권한이 있는 담당자와 대화방을 선택해 주세요.',403);
    const body=normalized.nextAction+'\n\nSNS 문의 원문: '+sourceOrigin+sourceHref(live.row.id);
    // Persist the stable request before crossing the two database boundary. If
    // task creation succeeds but the company receipt fails, retry reuses it.
    store.transaction(()=>{
      live=source(user,input.inboxId,context,true);
      if(live.row.revision!==input.revision)throw fail('문의가 변경됐습니다. 다시 확인해 주세요.',409);
      const prior=store.get(KIND,live.row.id);
      if(prior){if(prior.fingerprint!==fingerprint||prior.createdBy!==live.user.id&&prior.state!=='linked')throw fail('이미 등록 중인 후속 업무가 있습니다.',409);record=prior;return;}
      record={id:randomUUID(),inboxId:live.row.id,channelId:live.channel.id,sourceRevision:live.row.revision,...normalized,fingerprint,requestId:randomUUID(),taskUserId:assignee.taskUserId,createdBy:live.user.id,createdAt:clock(),state:'pending'};
      store.put(KIND,live.row.id,record);
    });
    if(record.state==='linked')return {created:false,followup:taskView(live.user,record)};
    live=source(user,input.inboxId,context,true);
    const currentRoom=targets(live.user,live.channel).find(candidate=>candidate.id===record.roomId);
    if(!currentRoom?.assignees.some(person=>person.id===record.assigneeId&&person.taskUserId===record.taskUserId))throw fail('담당자 또는 대화방 권한이 변경됐습니다.',403);
    live=source(user,input.inboxId,context,true);
    const result=sync(tasks.create(live.user,{requestId:record.requestId,channelId:record.roomId,title:'SNS 문의 후속 업무',body,assigneeId:record.taskUserId,reviewerId:null,dueDate:record.dueDate}));
    return linkResult(user,record,result,context);
  }
  return {workspace,list,create};
}
