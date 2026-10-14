import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {appendClientNotificationEvents} from './client-notifications.mjs';
import {createPulseDeviceService} from './pulse-devices.mjs';
import {buildClientCloseout,customerClientCloseout,clientDeliveryIdentity,clientCloseoutWorkKey} from './client-closeout.mjs';
import {buildClientKickoff,customerClientKickoff,applyClientKickoffAction} from './client-kickoff.mjs';
import {buildClientChanges,customerClientChanges,applyClientChangesAction} from './client-changes.mjs';
import {buildSceneRequests,customerSceneRequests,applySceneRequestAction} from './client-scene-requests.mjs';
import {buildClientSchedule,applyClientScheduleAction} from './client-schedule.mjs';
import {buildCustomerPreviewApproval} from './client-preview-approval.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const digest=value=>createHash('sha256').update(value).digest('hex');
const stages=['received','planning','producing','review','delivered','archived'];
const MESSAGE_LIMIT=300,VERSION_LIMIT=100,FOLLOW_UP_LIMIT=300;
const isApproval=message=>message.author==='customer'&&message.action==='approve';
function messageCapacity(row,approval=false){
  const approvals=row.messages.filter(isApproval).length;
  // Never discard unresolved requests or review evidence. Reserve one approval
  // per possible version separately from the 300 ordinary messages (400 total).
  if(approval?approvals>=VERSION_LIMIT:row.messages.length-approvals>=MESSAGE_LIMIT)throw fail(approval?'승인 기록이 꽉 찼어요. 담당자에게 알려 주세요.':'주고받은 글이 300개가 됐어요. 새 프로젝트로 이어 주세요. 시안 승인은 따로 남길 수 있어요.',409);
}
export const CLIENT_STAGES={received:'접수',planning:'협의',producing:'제작',review:'고객 확인',delivered:'납품',archived:'보관'};
const clean=(value,max,label,required=false)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}을 확인해 주세요.`);const result=value.trim();if(required&&!result)throw fail(`${label}을 입력해 주세요.`);return result;};
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('입력 내용을 다시 봐 주세요.');return value;};
const date=value=>{if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||(!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))throw fail('날짜 형식이 맞지 않아요.');return value;};
const link=value=>{if(!value)return '';let url;try{url=new URL(clean(value,2000,'링크'));}catch{throw fail('https로 시작하는 링크를 적어 주세요.');}if(url.protocol!=='https:'||url.username||url.password)throw fail('https로 시작하는 링크를 적어 주세요.');return url.href;};
export function clientFollowUpToday(value){const at=Date.parse(value);if(!Number.isFinite(at))throw fail('서버 시계를 읽지 못했어요. 잠시 뒤 다시 해 주세요.',500);return new Date(at+9*3600000).toISOString().slice(0,10);}

export function createClientProjectsService({store,clock=()=>new Date().toISOString()}){
  const devices=createPulseDeviceService({store,clock});
  const changeListeners=new Set();
  function subscribeChanges(listener){if(typeof listener!=='function')throw new TypeError('변경 알림 설정이 이상해요.');changeListeners.add(listener);return ()=>changeListeners.delete(listener);}
  function current(user,write=false){const live=store.get('users',user?.id);if(!live?.active)throw fail('먼저 로그인해 주세요.',401);if(write&&live.role==='viewer')throw fail('읽기만 할 수 있는 계정이에요.',403);return live;}
  function allowed(user,row){return user.role==='admin'||row.ownerId===user.id||(row.reviewerId===user.id&&user.role!=='viewer'&&user.teamId&&user.teamId===row.teamId)||(['manager','viewer'].includes(user.role)&&user.teamId&&user.teamId===row.teamId);}
  function project(user,id,write=false){user=current(user,write);const row=store.get('clientProjects',id);if(!row||!allowed(user,row))throw fail('그 프로젝트를 찾지 못했어요.',404);if(write&&user.role!=='admin'&&row.ownerId!==user.id&&!(user.role==='manager'&&user.teamId&&user.teamId===row.teamId))throw fail('이 프로젝트의 담당자나 관리자만 바꿀 수 있어요.',403);if(write&&row.stage==='archived')throw fail('보관한 프로젝트예요. 보관을 풀어야 바꿀 수 있어요.',409);return row;}
  function revision(row,input){if(input.revision!==row.revision)throw fail('그사이 다른 창이나 고객이 내용을 바꿨어요. 새로 불러온 뒤 다시 저장해 주세요.',409);}
  function append(row,action,actor){return {...row,revision:row.revision+1,updatedAt:clock(),history:[...row.history,{id:randomUUID(),action,actor,at:clock()}].slice(-300)};}
  function storeRow(row){
    const previous=store.get('clientProjects',row.id),updated=appendClientNotificationEvents(previous,row),writeMarker=updated.history?.at(-1)?.id;
    store.put('clientProjects',updated.id,updated);
    const userIds=[...new Set([previous?.ownerId,previous?.reviewerId,updated.ownerId,updated.reviewerId].filter(Boolean))];
    // Defer until an enclosing synchronous transaction has committed. A rolled
    // back import must never announce a state that was not durably written.
    if(changeListeners.size)queueMicrotask(()=>{if(!changeListeners.size)return;let committed;try{committed=store.get('clientProjects',updated.id);}catch{return;}if(!committed||committed.revision<updated.revision||writeMarker&&!committed.history.some(entry=>entry.id===writeMarker))return;for(const listener of changeListeners){try{listener({projectId:updated.id,userIds});}catch{}}});
    return {project:staffView(updated)};
  }
  function sceneRequestContext(row,user=null){
    const live=user?store.get('users',user.id):null,reviewer=row.reviewerId?store.get('users',row.reviewerId):null;
    const reviewerId=reviewer?.active&&reviewer.role!=='viewer'&&reviewer.id!==row.ownerId&&(reviewer.role==='admin'||reviewer.teamId&&reviewer.teamId===row.teamId)?reviewer.id:null;
    const canEdit=!!live?.active&&live.role!=='viewer'&&(live.role==='admin'||row.ownerId===live.id||live.role==='manager'&&live.teamId&&live.teamId===row.teamId);
    return {userId:live?.id||null,canEdit,canReview:!!live?.active&&live.id===reviewerId,reviewerId};
  }
  function staffView(row,user=null){const {inviteHash,inviteRevision,notificationEvents,...safe}=row,closeout=buildClientCloseout(row,{now:clock()}),canEdit=!!user&&row.stage!=='archived'&&user.role!=='viewer'&&(user.role==='admin'||row.ownerId===user.id||user.role==='manager'&&user.teamId&&user.teamId===row.teamId);if(safe.studio?.feedbackRounds){safe.studio={...safe.studio,feedbackRounds:{...safe.studio.feedbackRounds}};delete safe.studio.feedbackRounds.drafts;}if(user)closeout.canEdit=canEdit;return {...safe,closeout,kickoff:buildClientKickoff(row,{now:clock(),canEdit}),changes:buildClientChanges(row,{now:clock(),canEdit}),sceneRequests:buildSceneRequests(row,sceneRequestContext(row,user)),schedule:buildClientSchedule(row,{now:clock(),canEdit,reviewerId:sceneRequestContext(row,user).reviewerId}),ownerName:store.get('users',row.ownerId)?.name||'담당자 없음',reviewerName:store.get('users',row.reviewerId)?.name||'',inviteActive:!!inviteHash&&Date.parse(row.inviteExpiresAt)>Date.parse(clock())};}
  function customerView(row){return {id:row.id,title:row.title,customerName:row.customerName,summary:row.summary,terms:row.terms,stage:row.stage,stageLabel:CLIENT_STAGES[row.stage],dueDate:row.dueDate,nextStep:row.nextStep,revision:row.revision,updatedAt:row.updatedAt,ownerName:store.get('users',row.ownerId)?.name||'PULSE 담당자',versions:row.versions.map(({media,...v})=>({...v,...(media?{media:{id:media.id,mimeType:media.mimeType,fileName:media.fileName,byteSize:media.byteSize,url:'/pulse/api/media/'+media.id}}:{})})),messages:row.messages.filter(m=>m.visibility==='customer').map(({workflow,...message})=>message),previewApproval:buildCustomerPreviewApproval(row),closeout:customerClientCloseout(row),kickoff:customerClientKickoff(row,{now:clock()}),changes:customerClientChanges(row),sceneRequests:customerSceneRequests(row,sceneRequestContext(row))};}
  function workspace(user){user=current(user);return {projects:store.all('clientProjects').filter(row=>allowed(user,row)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(row=>staffView(row,user)),members:store.all('users').filter(member=>member.active&&member.role!=='viewer'&&(user.role==='admin'||member.id===user.id||user.role==='manager'&&user.teamId&&member.teamId===user.teamId)).map(({id,name})=>({id,name})),reviewers:store.all('users').filter(member=>member.active&&member.role!=='viewer'&&(user.role==='admin'||member.role==='admin'||user.teamId&&member.teamId===user.teamId)).map(({id,name,teamId,role})=>({id,name,teamId,role})),stages:CLIENT_STAGES,canWrite:user.role!=='viewer',canImport:user.role==='admin'};}
  // Search shares the workspace ACL but needs no schedule, kickoff or workflow
  // calculations. Only current source collections are exposed to the search service.
  function searchSources(user){user=current(user);return store.all('clientProjects').filter(row=>allowed(user,row)).map(row=>{
    const fields=['id','revision','title','customerName','receiptId','summary','terms','nextStep','internalNotes','stage','updatedAt','messages','versions','deleted','deletedAt','hidden','visibility'];
    return {...Object.fromEntries(fields.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])),intake:row.intake?{files:row.intake.files,receivedAt:row.intake.receivedAt}:null,studio:row.studio?Object.fromEntries(['assets','references','concepts','scenes','sceneReviews','comments'].map(key=>[key,row.studio[key]])):null};
  });}
  function save(user,input,id=null){user=current(user,true);object(input);const previous=id?project(user,id):null;if(previous){if(user.role!=='admin'&&previous.ownerId!==user.id&&!(user.role==='manager'&&user.teamId&&user.teamId===previous.teamId))throw fail('이 프로젝트의 담당자나 관리자만 바꿀 수 있어요.',403);revision(previous,input);}if(previous?.stage==='archived'&&input.stage!=='received')throw fail('보관한 프로젝트는 먼저 「접수」로 되돌려 주세요.',409);
    const ownerId=input.ownerId||previous?.ownerId||user.id,owner=store.get('users',ownerId);if(!owner?.active||owner.role==='viewer'||!(user.role==='admin'||owner.id===user.id||user.role==='manager'&&user.teamId&&owner.teamId===user.teamId))throw fail('그 사람은 담당자로 정할 수 없어요.',403);
    const reviewerId=input.reviewerId===undefined?(previous?.reviewerId||null):(input.reviewerId||null),reviewer=reviewerId&&store.get('users',reviewerId);if(reviewerId&&(!reviewer?.active||reviewer.role==='viewer'||reviewerId===ownerId||!(reviewer.role==='admin'||owner.teamId&&reviewer.teamId===owner.teamId)))throw fail('검토자는 담당자가 아닌 같은 팀 사람이어야 해요.',403);
    const stage=input.stage||previous?.stage||'received';if(!stages.includes(stage))throw fail('단계 값이 이상해요.');
    if(stage==='delivered'&&previous?.messages.some(m=>m.author==='customer'&&m.action==='feedback'&&!m.resolved))throw fail('남은 고객 수정 요청과 검토를 먼저 끝내 주세요.',409);
    if(stage==='delivered'&&(!previous?.versions.some(v=>v.kind==='final'&&v.approvedPreviewId===latestPreview(previous)?.id)||!latestPreview(previous)?.approvedAt))throw fail('고객이 승인한 시안과 최종본을 먼저 올려 주세요.',409);
    const at=clock(),base=previous||{id:randomUUID(),createdAt:at,revision:0,versions:[],messages:[],history:[],inviteRevision:0,inviteHash:null,inviteExpiresAt:null,receiptId:''};
    const row={...append(base,previous?'프로젝트 수정':'프로젝트 접수',user.id),ownerId,reviewerId,teamId:owner.teamId||null,title:clean(input.title,160,'프로젝트 이름',true),customerName:clean(input.customerName,100,'고객 이름',true),contact:clean(input.contact||'',300,'연락처'),summary:clean(input.summary||'',3000,'고객이 부탁한 일'),terms:clean(input.terms||'',3000,'합의한 범위와 조건'),nextStep:clean(input.nextStep||'',600,'다음 할 일'),internalNotes:clean(input.internalNotes||'',3000,'내부 메모'),dueDate:date(input.dueDate),nextContactDate:date(input.nextContactDate),stage};
    if(previous&&(row.nextContactDate!==previous.nextContactDate||row.stage!==previous.stage))row.closeoutWorkRevision=(previous.closeoutWorkRevision||0)+1;
    if(stage==='archived'){row.inviteHash=null;row.inviteRevision++;}return storeRow(row);
  }
  function latestPreview(row){return row.versions.filter(v=>v.kind==='preview').at(-1);}
  function sceneRequests(user,id,input){
    object(input);return store.transaction(()=>{
      user=current(user,true);const row=project(user,id);revision(row,input);
      const sceneRequestWorkflows=applySceneRequestAction(row,input,{...sceneRequestContext(row,user),actor:user.id,at:clock()}),events={start:'장면 고치기 시작',submit:'고친 장면 제출',accept:'고친 장면 검토 통과',request_changes:'고친 장면 더 고치기',reopen:'장면 요청 다시 열기'};
      storeRow({...append(row,events[input.action],user.id),sceneRequestWorkflows});return {project:staffView(store.get('clientProjects',id),user)};
    });
  }
  function schedule(user,id,input){
    object(input);return store.transaction(()=>{
      user=current(user,true);const row=project(user,id,true);revision(row,input);
      const schedulePlan=applyClientScheduleAction(row,input,{actor:user.id,at:clock()});
      storeRow({...append(row,'일정 목표일 바꿈',user.id),schedulePlan});return {project:staffView(store.get('clientProjects',id),user)};
    });
  }
  function changes(user,id,input){
    object(input);return store.transaction(()=>{
      user=current(user,true);const row=project(user,id,true);revision(row,input);
      const changeControl=applyClientChangesAction(row,input,{actor:user.id,at:clock()}),events={capture:'바뀐 것 기준 잡음',review:'바뀐 것 다시 봄',reset:'바뀐 것 다시 보기 취소',advance:'바뀐 것 새 기준',set_enabled:'바뀐 것 보기 켜고 끔'};
      storeRow({...append(row,events[input.action],user.id),changeControl});return {project:staffView(store.get('clientProjects',id),user)};
    });
  }
  function kickoff(user,id,input){
    object(input);return store.transaction(()=>{
      user=current(user,true);const row=project(user,id,true);revision(row,input);
      const kickoffPlan=applyClientKickoffAction(row,input,{actor:user.id,at:clock()}),events={configure:'필요한 자료 목록 바꿈',link:'받은 자료 연결',review:'자료 쓸 수 있음 표시',waive:'자료 뺌',reset:'자료 표시 지움'};
      storeRow({...append(row,events[input.action],user.id),kickoffPlan});return {project:staffView(store.get('clientProjects',id),user)};
    });
  }
  function submitKickoffSource(raw,csrf,input){
    object(input);return store.transaction(()=>{
      const {auth,row}=session(raw);if(typeof csrf!=='string'||csrf!==auth.body.csrf)throw fail('고객 화면을 새로 열어 주세요.',403);revision(row,input);
      const kickoffPlan=applyClientKickoffAction(row,input,{actor:'customer',at:clock(),customer:true}),updated={...append(row,'고객이 자료 연결','customer'),kickoffPlan};storeRow(updated);return {project:customerView(updated)};
    });
  }
  function closeout(user,id,input){
    object(input);const fields=input.action==='set_reminder'?['action','revision','deliveryKey','remindAfterDays']:input.action==='close'?['action','revision','deliveryKey','confirmed']:null;
    if(!fields||Object.keys(input).some(key=>!fields.includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    return store.transaction(()=>{
      user=current(user,true);const row=project(user,id,true);revision(row,input);const report=buildClientCloseout(row,{now:clock()});
      if(input.deliveryKey!==report.deliveryKey)throw fail('납품 파일이 바뀌었어요. 새로 불러와 주세요.',409);
      let updated;
      if(input.action==='set_reminder'){
        if(!Number.isInteger(input.remindAfterDays)||input.remindAfterDays<0||input.remindAfterDays>30)throw fail('기다릴 기간은 0(끄기)이나 1~30일로 적어 주세요.');
        updated={...append(row,'수령 기다릴 기간 바꿈',user.id),deliveryReminderDays:input.remindAfterDays};
      }else{
        if(input.confirmed!==true)throw fail('고객이 받았는지와 남은 일을 본 뒤 마감해 주세요.');
        if(!report.canClose)throw fail('고객 수령 확인과 남은 문의·연락을 먼저 정리해 주세요.',409);
        const history=row.closureHistory||[];if(!Array.isArray(history)||history.length>=300)throw fail('마감 기록이 300개가 됐어요. 새 프로젝트로 이어 주세요.',409);
        const receipt=(row.deliveryReceipts||[]).findLast(entry=>entry.deliveryKey===report.deliveryKey);
        const entry={id:randomUUID(),deliveryKey:report.deliveryKey,approvedPreviewId:report.approvedPreviewId,versionIds:report.files.map(file=>file.id),receiptId:receipt.id,closedAt:clock(),actor:user.id,actorName:user.name||'담당자',summaryText:report.summaryText,workKey:clientCloseoutWorkKey(row)};
        updated={...append(row,'마감',user.id),closureHistory:[...history,entry]};
      }
      storeRow(updated);return {project:staffView(store.get('clientProjects',id),user)};
    });
  }
  function confirmDelivery(raw,csrf,input){
    object(input);if(Object.keys(input).some(key=>!['action','revision','deliveryKey','confirmed'].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    return store.transaction(()=>{
      const {auth,row}=session(raw);if(csrf!==auth.body.csrf)throw fail('고객 화면을 새로 열어 주세요.',403);revision(row,input);
      if(input.confirmed!==true)throw fail('파일과 사용 안내를 보신 뒤에 받았다고 눌러 주세요.');
      const identity=clientDeliveryIdentity(row),view=customerClientCloseout(row);
      if(!view.canConfirm||input.deliveryKey!==identity.deliveryKey)throw fail('이미 확인했거나 납품 파일이 바뀌었어요. 다시 봐 주세요.',409);
      const history=row.deliveryReceipts||[];if(!Array.isArray(history)||history.length>=100)throw fail('수령 확인 기록이 꽉 찼어요. 담당자에게 알려 주세요.',409);
      const entry={id:randomUUID(),deliveryKey:identity.deliveryKey,approvedPreviewId:identity.approvedPreviewId,versionIds:identity.finals.map(version=>version.id),confirmedAt:clock(),actor:'customer'};
      const updated={...append(row,'고객이 최종본 받음','customer'),deliveryReceipts:[...history,entry]};storeRow(updated);return {project:customerView(updated)};
    });
  }
  function completeFollowUp(user,id,input){
    object(input);if(Object.keys(input).some(key=>!['revision','note','disposition','nextContactDate'].includes(key)))throw fail('입력 내용을 다시 봐 주세요.');
    const note=clean(input.note,3000,'연락 결과',true),disposition=input.disposition;
    if(!['schedule','done'].includes(disposition))throw fail('다음 연락일을 잡을지, 여기서 끝낼지 골라 주세요.');
    return store.transaction(()=>{
      user=current(user,true);const row=project(user,id,true);revision(row,input);
      if(!row.nextContactDate)throw fail('잡힌 연락이 없어요. 프로젝트 기록에서 다음 연락일을 먼저 정해 주세요.',409);
      const previousContactDate=date(row.nextContactDate),at=clock(),today=clientFollowUpToday(at),history=row.followUpHistory||[];
      if(!Array.isArray(history)||history.length>=FOLLOW_UP_LIMIT)throw fail('연락 기록이 300개가 됐어요. 새 프로젝트로 이어 주세요.',409);
      let nextContactDate='';
      if(disposition==='schedule'){
        if(typeof input.nextContactDate!=='string'||!input.nextContactDate)throw fail('다음 연락일을 적어 주세요.');
        nextContactDate=date(input.nextContactDate);if(nextContactDate<today)throw fail('다음 연락일은 오늘이나 그 뒤로 잡아 주세요.');
      }else if(input.nextContactDate!==undefined&&input.nextContactDate!=='')throw fail('연락을 끝낼 때는 다음 연락일을 비워 주세요.');
      const entry={id:randomUUID(),actor:user.id,actorName:user.name||'담당자',at:new Date(at).toISOString(),note,previousContactDate,nextContactDate,disposition};
      // This internal result never becomes a customer message or replaces the
      // customer-facing nextStep. Keep every detailed follow-up entry intact.
      return storeRow({...append(row,disposition==='schedule'?'연락 결과 · 다음 연락 잡음':'연락 결과 · 끝',user.id),nextContactDate,followUpHistory:[...history,entry]});
    });
  }
  function invite(user,id,input){const row=project(user,id,true);revision(row,input);const raw=randomBytes(32).toString('base64url'),updated=append(row,'초대 링크 새로 만듦',user.id);updated.inviteHash=digest(raw);updated.inviteRevision++;updated.inviteExpiresAt=new Date(Date.parse(clock())+7*86400000).toISOString();return {...storeRow(updated),invite:raw,expiresAt:updated.inviteExpiresAt};}
  function revoke(user,id,input){const row=project(user,id,true);revision(row,input);return storeRow({...append(row,'초대 링크 닫음',user.id),inviteHash:null,inviteRevision:row.inviteRevision+1,inviteExpiresAt:null});}
  function open(raw){if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))throw fail('초대 링크가 없거나 끝났어요.',401);const hashed=digest(raw),row=store.all('clientProjects').find(p=>p.inviteHash===hashed);if(!row||row.stage==='archived'||Date.parse(row.inviteExpiresAt)<=Date.parse(clock()))throw fail('초대 링크가 없거나 끝났어요.',401);const csrf=randomBytes(24).toString('base64url');const session=store.mint('pulse-session',null,{projectId:row.id,inviteRevision:row.inviteRevision,csrf},720);return {session,csrf,project:customerView(row)};}
  function session(raw){
    const auth=store.readToken(raw,'pulse-session'),row=auth&&store.get('clientProjects',auth.body.projectId);
    const device=auth?.body.deviceHash?devices.current(auth.body.deviceHash):null;
    const activeAccess=auth?.body.deviceHash?device&&device.row.id===row?.id:auth?.body.acceptedInvite===true||Date.parse(row?.inviteExpiresAt)>Date.parse(clock());
    if(!row||row.stage==='archived'||!row.inviteHash||Date.parse(auth.expiresAt)<=Date.parse(clock())||auth.body.inviteRevision!==row.inviteRevision||!activeAccess)throw fail('초대 링크가 없거나 끝났어요.',401);
    return {auth,row};
  }
  function read(raw){const {auth,row}=session(raw);return {project:customerView(row),csrf:auth.body.csrf};}
  function addVersion(user,id,input,media=null){const row=project(user,id,true);object(input);revision(row,input);const kind=input.kind;if(!['preview','final'].includes(kind))throw fail('시안인지 최종본인지 골라 주세요.');if(kind==='final'&&row.messages.some(m=>m.author==='customer'&&m.action==='feedback'&&!m.resolved))throw fail('남은 고객 수정 요청과 검토를 먼저 끝내 주세요.',409);if(kind==='final'&&!latestPreview(row)?.approvedAt)throw fail('최근 시안을 고객이 먼저 승인해야 해요.',409);if(row.versions.length>=VERSION_LIMIT)throw fail('한 프로젝트에 파일은 100개까지예요.',409);const url=link(input.url);if(!media&&!url)throw fail('파일을 올리거나 링크를 적어 주세요.');const version={id:randomUUID(),label:clean(input.label,120,'버전 이름',true),kind,url,...(kind==='final'?{approvedPreviewId:latestPreview(row).id}:{}),guide:clean(input.guide||'',3000,'사용 안내'),createdAt:clock(),approvedAt:null,...(media?{media}:{})};if(kind==='final'&&!version.guide)throw fail('최종본에는 사용 안내를 꼭 적어 주세요.');return storeRow({...append(row,kind==='preview'?'새 시안 올림':'최종본 올림',user.id),versions:[...row.versions,version],stage:kind==='preview'?'review':'delivered',nextStep:kind==='final'?'최종본과 사용 안내를 보내 드렸어요. 궁금한 점은 후속 문의에 남겨 주세요.':'새 시안을 보시고 의견이나 승인을 남겨 주세요.'});}
  function message(user,id,input){const row=project(user,id,true);revision(row,input);messageCapacity(row);const visibility=input.visibility==='internal'?'internal':'customer',text=clean(input.text,3000,'메모',true);return storeRow({...append(row,visibility==='customer'?'고객 답변':'내부 메모',user.id),messages:[...row.messages,{id:randomUUID(),text,visibility,author:'staff',authorName:current(user).name,at:clock(),resolved:false}]});}
  function resolveMessage(user,id,messageId,input){const row=project(user,id,true);revision(row,input);const target=row.messages.find(m=>m.id===messageId);if(!target)throw fail('그 요청을 찾지 못했어요.',404);if(target.author==='customer'&&target.action==='feedback')throw fail('시안 수정 요청은 고친 시안 검토와 고객 확인이 끝나야 처리돼요.',409);return storeRow({...append(row,'요청 처리',user.id),messages:row.messages.map(m=>m.id===messageId?{...m,resolved:true,resolvedAt:clock()}:m)});}
  function customerAction(raw,csrf,input){if(input?.action==='submit_kickoff_source')return submitKickoffSource(raw,csrf,input);if(input?.action==='confirm_delivery')return confirmDelivery(raw,csrf,input);const {auth,row}=session(raw);if(csrf!==auth.body.csrf)throw fail('고객 화면을 새로 열어 주세요.',403);object(input);revision(row,input);const action=input.action;if(!['feedback','approve','support'].includes(action))throw fail('요청 종류가 이상해요.');messageCapacity(row,action==='approve');const selected=row.versions.find(v=>v.id===input.versionId);if(action!=='support'&&(!selected||selected.id!==latestPreview(row)?.id))throw fail('가장 최근 시안이 아니에요.',409);if(action==='approve'&&selected.approvedAt)throw fail('이미 승인한 시안이에요.',409);if(action==='feedback'&&selected.approvedAt)throw fail('승인한 뒤에 바꿀 게 있으면 대화에 남겨 주세요.',409);const seconds=input.seconds===null||input.seconds===undefined||input.seconds===''?null:Number(input.seconds);if(seconds!==null&&(!Number.isFinite(seconds)||seconds<0||seconds>86400))throw fail('장면 시간이 이상해요.');const text=action==='approve'?'이 시안을 승인했어요.':clean(input.text,3000,'고객이 부탁한 일',true);const updated={...append(row,action==='approve'?'고객이 시안 승인':'고객 요청','customer'),nextStep:action==='approve'?'승인 감사해요. 이제 최종본과 사용 안내를 준비할게요.':row.nextStep,versions:row.versions.map(v=>action==='approve'&&v.id===selected?.id?{...v,approvedAt:clock()}:v),messages:[...row.messages.map(m=>action==='approve'&&m.workflow?.status==='waiting_customer'&&m.workflow.resultVersionId===selected?.id?{...m,resolved:true,resolvedAt:clock(),workflow:{...m.workflow,status:'done',updatedAt:clock()}}:m),{id:randomUUID(),text,visibility:'customer',author:'customer',authorName:row.customerName,at:clock(),versionId:selected?.id||null,seconds,resolved:action==='approve',action}]};storeRow(updated);return {project:customerView(updated)};}
  function mediaFor(user,mediaId){user=current(user);const row=store.all('clientProjects').find(p=>p.versions.some(v=>v.media?.id===mediaId));if(!row||!allowed(user,row))throw fail('파일을 찾지 못했어요.',404);return row.versions.find(v=>v.media?.id===mediaId).media;}
  function customerMedia(raw,mediaId){const {row}=session(raw);const media=row.versions.find(v=>v.media?.id===mediaId)?.media;if(!media)throw fail('파일을 찾지 못했어요.',404);return media;}
  function findImportedReceipt(user,receiptId){user=current(user,true);if(user.role!=='admin')throw fail('접수 가져오기는 관리자만 할 수 있어요.',403);const existing=store.all('clientProjects').find(p=>p.receiptId===receiptId);return existing?{project:staffView(existing),existing:true}:null;}
  function importReceipt(user,receipt){user=current(user,true);if(user.role!=='admin')throw fail('접수 가져오기는 관리자만 할 수 있어요.',403);return store.transaction(()=>{const existing=findImportedReceipt(user,receipt.id);if(existing)return existing;const result=save(user,{title:(receipt.subject||'PULSE 접수').slice(0,160),customerName:(receipt.contact||'고객 확인 필요').slice(0,100),contact:(receipt.responseContact||'').slice(0,300),summary:receipt.message||'',terms:'',nextStep:'접수 내용을 보고 일정과 범위를 고객과 정해요.',internalNotes:'고객이 쓴 접수 내용이에요. 일정과 요청은 아직 합의 전이에요.',dueDate:'',nextContactDate:'',stage:'received'});const row=store.get('clientProjects',result.project.id);row.receiptId=receipt.id;row.intake={receivedAt:receipt.receivedAt,requestedDeadline:receipt.deadline||'',notes:receipt.notes||'',reportText:receipt.reportText||'',files:receipt.files||[],source:'verified-local-intake'};return storeRow(row);});}
  return {workspace,searchSources,save,project,subscribeChanges,commitWorkflow:storeRow,closeout,kickoff,changes,sceneRequests,sceneRequestContext,schedule,completeFollowUp,invite,revoke,open,read,session,devices,addVersion,message,resolveMessage,customerAction,mediaFor,customerMedia,findImportedReceipt,importReceipt};
}
