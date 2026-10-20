import {createHash,randomUUID} from 'node:crypto';
import {WEBSITE_INQUIRY_FORM_ID} from './website-inquiry-google.mjs';

const ROWS='websiteInquiries',STATE='websiteInquiryState',CONFIG='websiteInquiryConfig';
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const STATES=new Set(['new','reviewing','replied','closed']);
const CATEGORIES=[
  {id:'lab',selected:'LAB · 한국어 교육',label:'한국어 교육',next:'학습 목표·현재 수준·희망 방식을 확인하고 답변을 검토해 주세요.',draft:'한국어 교육 문의를 남겨 주셔서 감사합니다. 원하시는 학습 목표, 현재 한국어 수준, 수업이나 프로그램 이용 희망 방식을 알려 주시면 안내를 준비하는 데 도움이 됩니다.'},
  {id:'shift-business',selected:'SHIFT · 기관 강의·기업 컨설팅·브랜딩',label:'기관·기업 협업',next:'협업 목적·대상·희망 일정·범위를 확인하고 답변을 검토해 주세요.',draft:'협업 문의를 남겨 주셔서 감사합니다. 진행 목적, 대상, 희망 일정과 범위를 알려 주시면 요청에 맞는 진행 가능 여부를 확인하겠습니다.'},
  {id:'shift-career',selected:'SHIFT · 유학·취업 연계',label:'유학·취업 연계',next:'관심 과정·국가·희망 시기를 확인하고 확정된 안내만 답변에 넣어 주세요.',draft:'유학·취업 연계에 관해 문의해 주셔서 감사합니다. 관심 있는 과정이나 국가, 희망 시기를 알려 주시면 확인 가능한 안내를 준비하겠습니다.'},
  {id:'pulse',selected:'PULSE · 제작 협업·작품 이용·광고',label:'제작·작품 이용',next:'제작물·이용 범위·매체·일정 확인 후 권리와 견적을 검토해 주세요.',draft:'제작·작품 이용에 관해 문의해 주셔서 감사합니다. 원하시는 제작물 또는 작품, 이용 매체와 범위, 희망 일정을 알려 주시면 확인 후 안내하겠습니다.'},
  {id:'release',selected:'출시 소식 문의',label:'출시 소식',next:'관심 제품과 후속 연락 목적을 확인해 주세요. 자동 홍보 목록에는 추가하지 않습니다.',draft:'출시 소식에 관심을 보내 주셔서 감사합니다. 소식을 받고 싶은 제품을 알려 주시면, 요청하신 내용에 대해 확인 가능한 사항을 안내하겠습니다.'},
];
function text(value,label,max){
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail('INQUIRY_INVALID',label+'을 확인해 주세요.');
  return value.trim();
}
function normalize(input){
  const email=text(input.email,'답변 이메일',254);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!iso(input.createdAt)||!iso(input.submittedAt))throw fail('INQUIRY_INVALID','문의의 답변 이메일·접수 시각을 확인해 주세요.');
  const consent=text(input.consent,'개인정보 동의',1000);
  if(consent!=='위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.')throw fail('INQUIRY_CONSENT_CHANGED','개인정보 동의 답변을 확인할 수 없어 수집을 중단했습니다.',409);
  const responseId=text(input.responseId,'응답 식별자',200);
  if(!/^[\w-]+$/.test(responseId))throw fail('INQUIRY_INVALID','응답 식별자가 올바르지 않습니다.');
  return {responseId,email,type:text(input.type,'문의 유형',200),message:text(input.message,'문의 내용',16000),consent,
    createdAt:new Date(input.createdAt).toISOString(),submittedAt:new Date(input.submittedAt).toISOString()};
}
export function classifyWebsiteInquiry(input){
  const category=CATEGORIES.find(row=>row.selected===input.type);
  const privacy=/개인정보.{0,12}(삭제|열람|철회)|동의.{0,8}철회/.test(input.message);
  const test=/\[SYNK 기능 점검\s*[·-]\s*실제 문의 아님\]/.test(input.message);
  if(test)return {category:'test',label:'합성 기능 점검',reason:'문의 내용에 기존 기능 점검 표식이 있습니다.',nextAction:'기능 점검 응답입니다. 고객 문의나 실적으로 집계하지 않습니다.',draft:'',isTest:true};
  if(privacy)return {category:'privacy',label:'개인정보 요청',reason:'문의 내용에 개인정보 삭제·열람 또는 동의 철회 표현이 있습니다. 운영자가 원문을 확인해야 합니다.',nextAction:'원문의 요청 범위와 본인 확인 방법을 검토해 주세요. 자동 삭제·외부 답변은 수행하지 않습니다.',draft:'개인정보 관련 요청을 보내 주셔서 감사합니다. 요청 범위와 필요한 확인 절차를 검토한 뒤 안내드리겠습니다.',isTest:false};
  if(!category)return {category:'other',label:'분류 확인',reason:'등록된 문의 유형과 일치하지 않습니다. 운영자의 확인이 필요합니다.',nextAction:'문의 원문과 유형을 확인한 뒤 답변을 작성해 주세요.',draft:'문의해 주셔서 감사합니다. 보내 주신 내용을 확인한 뒤 안내드리겠습니다.',isTest:false};
  return {category:category.id,label:category.label,reason:'응답자가 「'+category.selected+'」를 직접 선택했습니다.',nextAction:category.next,draft:category.draft,isTest:false};
}
const sourceHref=id=>'/?tab=workroom&section=tools&tool=inquiries&inquiryId='+encodeURIComponent(id);
const taskHref=(room,id)=>'/?tab=messenger&panel=tasks&channelId='+encodeURIComponent(room)+'&messageId='+encodeURIComponent(id);

export function createWebsiteInquiryService({store,reader,tasks,origin='',clock=()=>new Date().toISOString(),onChange=()=>{}}={}){
  if(!store||!reader||!tasks||['options','create','find','get'].some(key=>typeof tasks[key]!=='function'))throw new TypeError('store, reader and synchronous task adapter are required');
  const sourceOrigin=origin?new URL(origin).origin:'';
  let pending=null,stopped=false;
  function now(){const value=clock();if(!iso(value))throw new Error('Invalid inquiry clock');return new Date(value).toISOString();}
  function current(user,context={}){
    context.signal?.throwIfAborted();const authorized=context.authorize?.(),live=store.get('users',user?.id);
    if(!live?.active||authorized&&authorized.id!==live.id)throw fail('INQUIRY_AUTH_REQUIRED','먼저 로그인해 주세요.',401);
    if(live.role!=='admin')throw fail('INQUIRY_FORBIDDEN','홈페이지 문의는 회사 관리자만 확인할 수 있습니다.',403);
    return live;
  }
  const config=()=>store.get('settings',CONFIG)||{enabled:false,actorId:null,intervalMinutes:5,revision:0};
  const state=()=>store.get('settings',STATE)||{status:'not-connected',lastSuccessAt:null,nextCheckAt:null};
  function synchronous(value){if(value&&typeof value.then==='function')throw new TypeError('Task adapter must be synchronous');return value;}
  // A personal room prevents customer information or even source references
  // from reaching unrelated crew through notification previews.
  function personalTarget(user){
    user=current(user);
    const room=(synchronous(tasks.options(user))?.channels||[]).find(row=>row.kind==='self'&&row.companyUserIds?.length===1&&row.companyUserIds[0]===user.id);
    const person=room?.taskAssignees?.find(row=>row.companyUserId===user.id);
    if(!room||!person)throw fail('INQUIRY_TASK_TARGET','관리자의 나에게 대화방을 확인하지 못했습니다.',409);
    return {roomId:room.id,taskUserId:person.id};
  }
  function snapshot(row){
    const data=store.decrypt(row.payload);
    return {id:row.id,revision:row.revision,...data,status:row.status,classification:row.classification,replyDraft:row.replyDraft,draftEdited:row.draftEdited===true,
      importedAt:row.importedAt,updatedAt:row.updatedAt,sourceHref:sourceHref(row.id),task:row.task?.state==='linked'?{state:'linked',href:taskHref(row.task.roomId,row.task.messageId),id:row.task.taskId}:row.task?{state:row.task.state}:null};
  }
  function workspace(user,context={}){
    user=current(user,context);
    const settings=config(),run=state();
    const rows=store.all(ROWS).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    return {settings,connection:{configured:reader.configured?.()===true,formId:WEBSITE_INQUIRY_FORM_ID,adminUrl:'https://docs.google.com/forms/d/'+WEBSITE_INQUIRY_FORM_ID+'/edit#responses'},
      run,items:rows.map(snapshot),draftOnly:true,categories:CATEGORIES.map(row=>({id:row.id,label:row.label})),canConfigure:true};
  }
  function get(user,id,context={}){current(user,context);const row=store.get(ROWS,id);if(!row)throw fail('INQUIRY_NOT_FOUND','문의 기록을 찾을 수 없습니다.',404);return snapshot(row);}
  async function verify(user,context={}){
    current(user,context);const result=await reader.verify({signal:context.signal});current(user,context);
    store.put('settings',STATE,{...state(),connectionVerifiedAt:result.verifiedAt,status:config().enabled?'ready':'paused',errorCode:null,error:null});
    return {connection:result};
  }
  async function configure(user,input,context={}){
    user=current(user,context);
    if(!input||Object.keys(input).some(key=>!['enabled','revision'].includes(key))||typeof input.enabled!=='boolean'||input.revision!==config().revision)throw fail('INQUIRY_CONFIG_CHANGED','현재 설정을 새로 불러와 주세요.',409);
    const previous=config();
    if(input.enabled){personalTarget(user);await reader.verify({signal:context.signal});current(user,context);if(config().revision!==previous.revision)throw fail('INQUIRY_CONFIG_CHANGED','설정이 변경되었습니다.',409);}
    const next={enabled:input.enabled,actorId:user.id,intervalMinutes:5,revision:previous.revision+1,updatedAt:now()};
    store.put('settings',CONFIG,next);store.put('settings',STATE,{...state(),status:next.enabled?'ready':'paused',nextCheckAt:next.enabled?now():null,errorCode:null,error:null});
    return {settings:next};
  }
  function update(user,id,input,context={}){
    current(user,context);const row=store.get(ROWS,id);
    if(!row)throw fail('INQUIRY_NOT_FOUND','문의 기록을 찾을 수 없습니다.',404);
    if(!input||Object.keys(input).some(key=>!['revision','status','replyDraft'].includes(key))||input.revision!==row.revision)throw fail('INQUIRY_REVISION','문의가 바뀌었습니다. 다시 불러와 주세요.',409);
    if(input.status!==undefined&&!STATES.has(input.status))throw fail('INQUIRY_STATUS','문의 처리 상태를 확인해 주세요.');
    if(input.replyDraft!==undefined&&(typeof input.replyDraft!=='string'||input.replyDraft.length>6000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.replyDraft)))throw fail('INQUIRY_INVALID','답변 초안을 확인해 주세요.');
    const draft=input.replyDraft===undefined?row.replyDraft:input.replyDraft.trim();
    const next={...row,status:input.status||row.status,replyDraft:draft,draftEdited:row.draftEdited||input.replyDraft!==undefined,revision:row.revision+1,updatedAt:now()};
    store.put(ROWS,id,next);return {item:snapshot(next)};
  }
  function importOne(raw){
    const data=normalize(raw),id=hash([WEBSITE_INQUIRY_FORM_ID,data.responseId]),fingerprint=hash(data),prior=store.get(ROWS,id);
    if(prior?.fingerprint===fingerprint)return prior;
    const classification=classifyWebsiteInquiry(data);
    const row={id,payload:store.encrypt(data),fingerprint,classification,replyDraft:prior?.draftEdited?prior.replyDraft:classification.draft,
      draftEdited:prior?.draftEdited===true,status:prior?.status||'new',revision:(prior?.revision||0)+1,
      importedAt:prior?.importedAt||now(),updatedAt:now(),task:prior?.task||null};
    store.put(ROWS,id,row);return row;
  }
  function linkTask(row,user){
    if(row.classification.isTest)return;
    user=current(user);
    if(row.task?.state==='linked'||row.task?.state==='unavailable')return;
    let task=row.task;
    if(!task){
      const target=personalTarget(user);
      task={state:'pending',requestId:randomUUID(),actorId:user.id,...target,createdAt:now()};
      row={...row,task};store.put(ROWS,row.id,row);
    }
    if(task.actorId!==user.id)throw fail('INQUIRY_TASK_ACTOR','기존 접수 업무를 생성한 관리자 계정을 확인해 주세요.',409);
    let result;
    try{result=synchronous(tasks.find(user,{requestId:task.requestId}));}
    catch(error){
      if(error.status!==410)throw error;
      store.put(ROWS,row.id,{...store.get(ROWS,row.id),task:{...task,state:'unavailable'}});
      return;
    }
    if(!result){
      const target=personalTarget(user);
      if(target.roomId!==task.roomId||target.taskUserId!==task.taskUserId)throw fail('INQUIRY_TASK_TARGET','문의 후속 업무의 권한이 변경되었습니다.',409);
      // No customer text/email or model-generated claims are copied to chat.
      result=synchronous(tasks.create(user,{requestId:task.requestId,channelId:task.roomId,title:'홈페이지 문의 답변 검토',
        body:'문의 원문과 분류 근거를 확인하고 답변 초안을 검토해 주세요.\n외부 발송은 담당자가 별도로 진행합니다.\n\n문의 접수함: '+sourceOrigin+sourceHref(row.id),
        assigneeId:task.taskUserId,reviewerId:null,dueDate:null}));
    }
    if(!result?.task?.id||!result.message?.id||result.task.channelId!==task.roomId||String(result.task.messageId)!==String(result.message.id))
      throw fail('INQUIRY_TASK_RESULT','후속 업무 등록 결과를 확인하지 못했습니다.',502);
    const latest=store.get(ROWS,row.id);
    store.put(ROWS,row.id,{...latest,task:{...task,state:'linked',taskId:result.task.id,messageId:String(result.message.id),linkedAt:now()}});
  }
  async function scan({force=false,user,context={},signal}={}){
    if(stopped)throw fail('INQUIRY_STOPPED','문의 수집기가 종료 중입니다.',503);
    if(user)current(user,context);
    const initial=config(),before=state(),at=now();
    if(!initial.enabled)return {skipped:true,reason:'paused'};
    if(!force&&before.nextCheckAt&&Date.parse(before.nextCheckAt)>Date.parse(at))return {skipped:true,reason:'not-due'};
    const binding=hash(initial),actor=store.get('users',initial.actorId);
    const check=()=>{if(stopped)throw fail('INQUIRY_STOPPED','문의 수집기가 종료 중입니다.',503);signal?.throwIfAborted();context.signal?.throwIfAborted();if(hash(config())!==binding)throw fail('INQUIRY_CONFIG_CHANGED','문의 수집 설정이 변경되어 중단했습니다.',409);current(actor);if(user)current(user,context);};
    try{
      check();personalTarget(actor);
      store.put('settings',STATE,{...before,status:'running',lastAttemptAt:at,errorCode:null,error:null});
      // A fixed filter is kept with each nextPageToken. Advance the watermark
      // only after the whole response set has been consumed.
      let cursor=before.continuation||{after:before.watermark?new Date(Date.parse(before.watermark)-60000).toISOString():undefined,pageToken:undefined,maximum:before.watermark||null};
      let pages=0,questionMap;
      do{
        const page=await reader.readPage({after:cursor.after,pageToken:cursor.pageToken,questionMap,signal:signal||context.signal});check();questionMap=page.questionMap;
        if(!Array.isArray(page.items))throw fail('INQUIRY_PROVIDER_INVALID','문의 수집 결과 형식을 확인할 수 없습니다.',502);
        // Validate an entire page before committing any of its customer records.
        const normalized=page.items.map(normalize);
        for(const raw of normalized){check();const row=importOne(raw);linkTask(row,actor);if(!cursor.maximum||Date.parse(raw.submittedAt)>Date.parse(cursor.maximum))cursor.maximum=raw.submittedAt;}
        cursor={...cursor,pageToken:page.nextPageToken||undefined};
        store.put('settings',STATE,{...state(),continuation:cursor.pageToken?cursor:null,watermark:cursor.pageToken?before.watermark||null:cursor.maximum});
        pages++;
      }while(cursor.pageToken&&pages<10);
      // Repair an interrupted two-database link even when no fresh response is
      // returned by Google on this run.
      for(const row of store.all(ROWS)){check();if(row.task?.state==='pending')linkTask(row,actor);}
      check();const doneAt=now(),partial=!!cursor.pageToken;
      store.put('settings',STATE,{...state(),status:partial?'catching-up':'ready',lastSuccessAt:partial?before.lastSuccessAt||null:doneAt,
        nextCheckAt:new Date(Date.parse(doneAt)+(partial?60000:initial.intervalMinutes*60000)).toISOString(),errorCode:null,error:null});
      try{onChange();}catch{}
      return {completed:!partial,status:partial?'catching-up':'ready'};
    }catch(error){
      // Keep the previous successful cursor. Provider errors never echo raw
      // responses, customer text or credential diagnostics into status.
      if(hash(config())===binding)store.put('settings',STATE,{...state(),status:'failed',errorCode:/^[A-Z_]+$/.test(error.code||'')?error.code:'INQUIRY_SYNC_FAILED',
        error:'문의 수집 또는 후속 업무 연결을 완료하지 못했습니다. 연결·권한을 확인해 주세요.',nextCheckAt:new Date(Date.parse(now())+300000).toISOString()});
      throw error;
    }
  }
  function tick(options={}){
    if(pending)return pending;
    pending=scan(options).finally(()=>{pending=null;});return pending;
  }
  function health(user){
    current(user);const run=state(),settings=config(),configured=reader.configured?.()===true;
    return {id:'website-inquiries',enabled:settings.enabled,configured,status:configured?(settings.enabled?run.status:'paused'):'not-connected',
      lastAttemptAt:run.lastAttemptAt||null,lastSuccessAt:run.lastSuccessAt||null,nextCheckAt:settings.enabled?run.nextCheckAt||null:null,
      errorCode:run.errorCode||null,error:run.error||null,href:'/?tab=workroom&section=tools&tool=inquiries'};
  }
  async function close(){stopped=true;await pending?.catch(()=>{});}
  return {workspace,get,verify,configure,update,tick,health,close};
}
