import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {WEBSITE_INQUIRY_FORM_ID} from './website-inquiry-google.mjs';

const ROWS='websiteInquiries',STATE='websiteInquiryState',CONFIG='websiteInquiryConfig',ERASED='websiteInquiryErasures',CONFIRM_MINUTES=10;
const fail=(code,message,status=400)=>Object.assign(new Error(message),{code,status});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const STATES=new Set(['new','reviewing','replied','closed']);
const CATEGORIES=[
  {id:'lab',selected:'LAB · 한국어 교육',label:'한국어 교육',next:'학습 목표 · 지금 수준 · 원하는 수업 방식을 보고 초안을 다듬어요.',draft:'한국어 교육 문의를 남겨 주셔서 감사합니다. 원하시는 학습 목표, 현재 한국어 수준, 수업이나 프로그램 이용 희망 방식을 알려 주시면 안내를 준비하는 데 도움이 됩니다.'},
  {id:'shift-business',selected:'SHIFT · 기관 강의·기업 컨설팅·브랜딩',label:'기관·기업 협업',next:'협업 목적 · 대상 · 원하는 일정 · 범위를 보고 초안을 다듬어요.',draft:'협업 문의를 남겨 주셔서 감사합니다. 진행 목적, 대상, 희망 일정과 범위를 알려 주시면 요청에 맞는 진행 가능 여부를 확인하겠습니다.'},
  {id:'shift-career',selected:'SHIFT · 유학·취업 연계',label:'유학·취업 연계',next:'관심 과정 · 나라 · 원하는 시기를 보고, 확정된 안내만 초안에 넣어요.',draft:'유학·취업 연계에 관해 문의해 주셔서 감사합니다. 관심 있는 과정이나 국가, 희망 시기를 알려 주시면 확인 가능한 안내를 준비하겠습니다.'},
  {id:'pulse',selected:'PULSE · 제작 협업·작품 이용·광고',label:'제작·작품 이용',next:'제작물 · 이용 범위 · 매체 · 일정을 보고 권리와 견적을 정해요.',draft:'제작·작품 이용에 관해 문의해 주셔서 감사합니다. 원하시는 제작물 또는 작품, 이용 매체와 범위, 희망 일정을 알려 주시면 확인 후 안내하겠습니다.'},
  {id:'release',selected:'출시 소식 문의',label:'출시 소식',next:'관심 제품과 연락받고 싶은 까닭을 봐요. 홍보 목록에 저절로 넣지 않아요.',draft:'출시 소식에 관심을 보내 주셔서 감사합니다. 소식을 받고 싶은 제품을 알려 주시면, 요청하신 내용에 대해 확인 가능한 사항을 안내하겠습니다.'},
];
function text(value,label,max){
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw fail('INQUIRY_INVALID',label+' 칸이 비었거나 형식이 맞지 않아요. Google 원본에서 그 응답을 봐 주세요.');
  return value.trim();
}
function normalize(input){
  const email=text(input.email,'답변 이메일',254);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!iso(input.createdAt)||!iso(input.submittedAt))throw fail('INQUIRY_INVALID','문의의 답변 이메일이나 접수 시각 형식이 맞지 않아요. Google 원본에서 그 응답을 봐 주세요.');
  const consent=text(input.consent,'개인정보 동의',1000);
  if(consent!=='위 안내를 읽고, 문의 답변을 위한 개인정보 수집·이용에 동의합니다.')throw fail('INQUIRY_CONSENT_CHANGED','개인정보 동의 답변이 양식의 동의 문장과 달라 수집을 멈췄어요. 문의 양식의 동의 문장이 바뀌었는지 봐 주세요.',409);
  const responseId=text(input.responseId,'응답 번호',200);
  if(!/^[\w-]+$/.test(responseId))throw fail('INQUIRY_INVALID','응답 번호 형식이 맞지 않아요. Google 원본에서 그 응답을 봐 주세요.');
  return {responseId,email,type:text(input.type,'문의 유형',200),message:text(input.message,'문의 내용',16000),consent,
    createdAt:new Date(input.createdAt).toISOString(),submittedAt:new Date(input.submittedAt).toISOString()};
}
export function classifyWebsiteInquiry(input){
  const category=CATEGORIES.find(row=>row.selected===input.type);
  const privacy=/개인정보.{0,12}(삭제|열람|철회)|동의.{0,8}철회/.test(input.message);
  const test=/\[SYNK 기능 점검\s*[·-]\s*실제 문의 아님\]/.test(input.message);
  if(test)return {category:'test',label:'합성 기능 점검',reason:'문의 내용에 기능 점검 표식이 있어요.',nextAction:'기능 점검 응답이라 고객 문의와 실적에서 빠져요.',draft:'',isTest:true};
  if(privacy)return {category:'privacy',label:'개인정보 요청',reason:'문의 내용에 개인정보 삭제 · 열람이나 동의 철회 표현이 있어요. 원문을 직접 읽어 봐야 해요.',nextAction:'원문에서 요청 범위와 본인 확인 방법을 보고 답을 정해요. 자동으로 지우거나 답하지 않아요.',draft:'개인정보 관련 요청을 보내 주셔서 감사합니다. 요청 범위와 필요한 확인 절차를 검토한 뒤 안내드리겠습니다.',isTest:false};
  if(!category)return {category:'other',label:'분류 확인',reason:'등록된 문의 유형과 맞지 않아요. 직접 읽고 분류해야 해요.',nextAction:'원문과 고른 유형을 읽고 초안을 써요.',draft:'문의해 주셔서 감사합니다. 보내 주신 내용을 확인한 뒤 안내드리겠습니다.',isTest:false};
  return {category:category.id,label:category.label,reason:'문의 양식에서 「'+category.selected+'」 유형을 직접 골랐어요.',nextAction:category.next,draft:category.draft,isTest:false};
}
// 10-21 관리자 화면 글을 해요체로 바꾸기 전에 저장된 분류 글(근거 · 다음 할 일)은 보일 때만 새 글로 바꾼다. 분류(category · isTest)와 고객용 초안은 저장된 그대로다.
const CLASSIFICATION_COPY_20261021=new Map([["학습 목표·현재 수준·희망 방식을 확인하고 답변을 검토해 주세요.", "학습 목표 · 지금 수준 · 원하는 수업 방식을 보고 초안을 다듬어요."], ["협업 목적·대상·희망 일정·범위를 확인하고 답변을 검토해 주세요.", "협업 목적 · 대상 · 원하는 일정 · 범위를 보고 초안을 다듬어요."], ["관심 과정·국가·희망 시기를 확인하고 확정된 안내만 답변에 넣어 주세요.", "관심 과정 · 나라 · 원하는 시기를 보고, 확정된 안내만 초안에 넣어요."], ["제작물·이용 범위·매체·일정 확인 후 권리와 견적을 검토해 주세요.", "제작물 · 이용 범위 · 매체 · 일정을 보고 권리와 견적을 정해요."], ["관심 제품과 후속 연락 목적을 확인해 주세요. 자동 홍보 목록에는 추가하지 않습니다.", "관심 제품과 연락받고 싶은 까닭을 봐요. 홍보 목록에 저절로 넣지 않아요."], ["문의 내용에 기존 기능 점검 표식이 있습니다.", "문의 내용에 기능 점검 표식이 있어요."], ["기능 점검 응답입니다. 고객 문의나 실적으로 집계하지 않습니다.", "기능 점검 응답이라 고객 문의와 실적에서 빠져요."], ["문의 내용에 개인정보 삭제·열람 또는 동의 철회 표현이 있습니다. 운영자가 원문을 확인해야 합니다.", "문의 내용에 개인정보 삭제 · 열람이나 동의 철회 표현이 있어요. 원문을 직접 읽어 봐야 해요."], ["원문의 요청 범위와 본인 확인 방법을 검토해 주세요. 자동 삭제·외부 답변은 수행하지 않습니다.", "원문에서 요청 범위와 본인 확인 방법을 보고 답을 정해요. 자동으로 지우거나 답하지 않아요."], ["등록된 문의 유형과 일치하지 않습니다. 운영자의 확인이 필요합니다.", "등록된 문의 유형과 맞지 않아요. 직접 읽고 분류해야 해요."], ["문의 원문과 유형을 확인한 뒤 답변을 작성해 주세요.", "원문과 고른 유형을 읽고 초안을 써요."]]);
export function websiteInquiryClassificationView(classification){
  if(!classification||typeof classification!=='object')return classification;
  const selected=/^응답자가 「(.+)」를 직접 선택했습니다\.$/.exec(classification.reason||'');
  return {...classification,reason:selected?'문의 양식에서 「'+selected[1]+'」 유형을 직접 골랐어요.':CLASSIFICATION_COPY_20261021.get(classification.reason)??classification.reason,nextAction:CLASSIFICATION_COPY_20261021.get(classification.nextAction)??classification.nextAction};
}
const sourceHref=id=>'/?tab=workroom&section=tools&tool=inquiries&inquiryId='+encodeURIComponent(id);
const taskHref=(room,id)=>'/?tab=messenger&panel=tasks&channelId='+encodeURIComponent(room)+'&messageId='+encodeURIComponent(id);

export function createWebsiteInquiryService({store,reader,tasks,origin='',clock=()=>new Date().toISOString(),onChange=()=>{},walRetryMs=[5000,30000,120000,600000,1800000,3600000]}={}){
  if(!store||!reader||!tasks||['options','create','find','get','remove'].some(key=>typeof tasks[key]!=='function'))throw new TypeError('store, reader and synchronous task adapter are required');
  const sourceOrigin=origin?new URL(origin).origin:'';
  const confirmKey=createHmac('sha256',store.key).update('website-inquiry-erase-confirm\0v1').digest();
  let pending=null,stopped=false;
  function now(){const value=clock();if(!iso(value))throw new Error('Invalid inquiry clock');return new Date(value).toISOString();}
  function current(user,context={}){
    context.signal?.throwIfAborted();const authorized=context.authorize?.(),live=store.get('users',user?.id);
    if(!live?.active||authorized&&authorized.id!==live.id)throw fail('INQUIRY_AUTH_REQUIRED','먼저 로그인해 주세요.',401);
    if(live.role!=='admin')throw fail('INQUIRY_FORBIDDEN','홈페이지 문의는 회사 관리자만 볼 수 있어요.',403);
    return live;
  }
  const config=()=>store.get('settings',CONFIG)||{enabled:false,actorId:null,intervalMinutes:5,revision:0};
  const state=()=>store.get('settings',STATE)||{status:'not-connected',lastSuccessAt:null,nextCheckAt:null};
  function synchronous(value){if(value&&typeof value.then==='function')throw new TypeError('Task adapter must be synchronous');return value;}
  // Inquiry rows hold customer text. Every write of one zeroes the cells and pages it frees (secure_delete), so an
  // older payload or draft never waits in free pages for a later erase. Synchronous, so no other write runs in between.
  function secure(fn){const before=store.db.prepare('PRAGMA secure_delete').get().secure_delete;store.db.exec('PRAGMA secure_delete=ON');
    try{return fn();}finally{store.db.exec('PRAGMA secure_delete='+(['OFF','ON','FAST'][before]||'OFF'));}}
  const putRow=(id,row)=>secure(()=>store.put(ROWS,id,row));
  // Older frames of a rewritten or erased row wait in the -wal file until it is reset. Truncate it without waiting for a
  // reader (a backup, a read-only check); while one is open, try again later. Returns whether the file is empty now.
  let walTimer=null,walTries=0;
  function truncateWal(){const wait=store.db.prepare('PRAGMA busy_timeout').get().timeout;let done=false;
    try{store.db.exec('PRAGMA busy_timeout=0');done=store.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get()?.busy===0;}catch{}
    finally{store.db.exec('PRAGMA busy_timeout='+(Number.isInteger(wait)?wait:5000));}
    return done;}
  function cleanWal(){
    if(truncateWal()){walTries=0;return true;}
    if(!walTimer&&!stopped&&walTries<walRetryMs.length){walTimer=setTimeout(()=>{walTimer=null;if(!stopped)cleanWal();},walRetryMs[walTries++]);walTimer.unref?.();}
    return false;}
  // A personal room prevents customer information or even source references
  // from reaching unrelated crew through notification previews.
  function personalTarget(user){
    user=current(user);
    const room=(synchronous(tasks.options(user))?.channels||[]).find(row=>row.kind==='self'&&row.companyUserIds?.length===1&&row.companyUserIds[0]===user.id);
    const person=room?.taskAssignees?.find(row=>row.companyUserId===user.id);
    if(!room||!person)throw fail('INQUIRY_TASK_TARGET','할 일을 받을 「나에게」 대화방을 찾지 못했어요. 이 관리자 계정이 메신저 계정과 이어져 있는지 봐 주세요.',409);
    return {roomId:room.id,taskUserId:person.id};
  }
  function snapshot(row){
    const data=store.decrypt(row.payload);
    return {id:row.id,revision:row.revision,...data,status:row.status,classification:websiteInquiryClassificationView(row.classification),replyDraft:row.replyDraft,draftEdited:row.draftEdited===true,
      importedAt:row.importedAt,updatedAt:row.updatedAt,sourceHref:sourceHref(row.id),task:row.task?.state==='linked'?{state:'linked',href:taskHref(row.task.roomId,row.task.messageId),id:row.task.taskId}:row.task?{state:row.task.state}:null};
  }
  function workspace(user,context={}){
    user=current(user,context);
    const settings=config(),run=state();
    const rows=store.all(ROWS).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    return {settings,connection:{configured:reader.configured?.()===true,formId:WEBSITE_INQUIRY_FORM_ID,adminUrl:'https://docs.google.com/forms/d/'+WEBSITE_INQUIRY_FORM_ID+'/edit#responses'},
      run,items:rows.map(snapshot),draftOnly:true,categories:CATEGORIES.map(row=>({id:row.id,label:row.label})),canConfigure:true};
  }
  function get(user,id,context={}){current(user,context);const row=store.get(ROWS,id);if(!row)throw fail('INQUIRY_NOT_FOUND','문의 기록을 찾지 못했어요. 새로 읽어 주세요.',404);return snapshot(row);}
  async function verify(user,context={}){
    current(user,context);const result=await reader.verify({signal:context.signal});current(user,context);
    store.put('settings',STATE,{...state(),connectionVerifiedAt:result.verifiedAt,status:config().enabled?'ready':'paused',errorCode:null,error:null});
    return {connection:result};
  }
  async function configure(user,input,context={}){
    user=current(user,context);
    if(!input||Object.keys(input).some(key=>!['enabled','revision'].includes(key))||typeof input.enabled!=='boolean'||input.revision!==config().revision)throw fail('INQUIRY_CONFIG_CHANGED','그사이 설정이 바뀌었어요. 새로 읽어 주세요.',409);
    const previous=config();
    if(input.enabled){personalTarget(user);await reader.verify({signal:context.signal});current(user,context);if(config().revision!==previous.revision)throw fail('INQUIRY_CONFIG_CHANGED','그사이 설정이 바뀌었어요. 새로 읽어 주세요.',409);}
    const next={enabled:input.enabled,actorId:user.id,intervalMinutes:5,revision:previous.revision+1,updatedAt:now()};
    store.put('settings',CONFIG,next);store.put('settings',STATE,{...state(),status:next.enabled?'ready':'paused',nextCheckAt:next.enabled?now():null,errorCode:null,error:null});
    return {settings:next};
  }
  function update(user,id,input,context={}){
    current(user,context);const row=store.get(ROWS,id);
    if(!row)throw fail('INQUIRY_NOT_FOUND','문의 기록을 찾지 못했어요. 새로 읽어 주세요.',404);
    if(!input||Object.keys(input).some(key=>!['revision','status','replyDraft'].includes(key))||input.revision!==row.revision)throw fail('INQUIRY_REVISION','그사이 문의가 바뀌었어요. 새로 읽어 주세요.',409);
    if(input.status!==undefined&&!STATES.has(input.status))throw fail('INQUIRY_STATUS','처리 상태 값이 맞지 않아요. 상태를 다시 골라 주세요.');
    if(input.replyDraft!==undefined&&(typeof input.replyDraft!=='string'||input.replyDraft.length>6000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.replyDraft)))throw fail('INQUIRY_INVALID','답변 초안이 너무 길거나 쓸 수 없는 글자가 있어요. 6,000자 안으로 줄여 주세요.');
    const draft=input.replyDraft===undefined?row.replyDraft:input.replyDraft.trim();
    const next={...row,status:input.status||row.status,replyDraft:draft,draftEdited:row.draftEdited||input.replyDraft!==undefined,revision:row.revision+1,updatedAt:now()};
    putRow(id,next);return {item:snapshot(next)};
  }
  // Erasing one inquiry (a deletion request, or the end of a cohort) takes two calls. checkErase() states what
  // will go — and whether Google still holds the response, which should be deleted there first — and returns a
  // confirmation token for this admin and this revision. erase() needs that token. Nothing is kept for the
  // token; the erasure record is the row number and the time only.
  function erasable(id,input,keys){
    const row=store.get(ROWS,id);
    if(!row)throw fail('INQUIRY_NOT_FOUND','문의 기록을 찾지 못했어요. 새로 읽어 주세요.',404);
    if(!input||Object.keys(input).some(key=>!keys.includes(key))||input.revision!==row.revision)throw fail('INQUIRY_REVISION','그사이 문의가 바뀌었어요. 새로 읽어 주세요.',409);
    return row;
  }
  function confirmation(user,row,until){return until+'.'+createHmac('sha256',confirmKey).update([user.id,row.id,row.revision,until].join('\0')).digest('hex');}
  function confirmed(user,row,token){
    const match=typeof token==='string'&&/^(\d{13})\.[0-9a-f]{64}$/.exec(token);
    if(!match||Number(match[1])<=Date.parse(now()))return false;
    const expected=Buffer.from(confirmation(user,row,Number(match[1]))),given=Buffer.from(token);
    return expected.length===given.length&&timingSafeEqual(expected,given);
  }
  async function checkErase(user,id,input,context={}){
    user=current(user,context);
    const {responseId}=store.decrypt(erasable(id,input,['revision']).payload);
    let google='unknown';
    // Read with the responseId field only. A failed check never blocks the erasure; it is shown as unknown.
    if(reader.configured?.()===true&&typeof reader.responseState==='function'){
      try{google=await reader.responseState({responseId,signal:context.signal});}catch{context.signal?.throwIfAborted();}
    }
    user=current(user,context);const row=erasable(id,input,['revision']),until=Date.parse(now())+CONFIRM_MINUTES*60000;
    return {erasure:{id,revision:row.revision,google:['present','deleted'].includes(google)?google:'unknown',task:taskPlan(row),isTest:row.classification?.isTest===true,
      expiresAt:new Date(until).toISOString(),token:confirmation(user,row,until)}};
  }
  // What erase() will do with the task: remove (linked · pending), leave it in a room nobody can open (unreachable), or none.
  function taskPlan(row){const task=row.task;if(!task||!['linked','pending'].includes(task.state))return null;return store.get('users',task.actorId)?.active?task.state:'unreachable';}
  // The 「홈페이지 문의 답변 검토」 task was made for this inquiry alone (a link, no customer text), so it goes
  // too — taken back as the admin it was made for. A room nobody can open any more is left as it is.
  function eraseTask(row){
    const task=row.task;
    if(!task||!['linked','pending'].includes(task.state))return 'none';
    const owner=store.get('users',task.actorId);
    if(!owner?.active)return 'unreachable';
    let result;
    try{result=synchronous(tasks.remove(owner,{requestId:task.requestId,...(task.state==='linked'?{messageId:task.messageId}:{})}));}
    catch(error){
      if(error.status===403)return 'unreachable';
      if(error.status===409)throw fail('INQUIRY_TASK_REMOVE','이 문의의 할 일을 지우지 못해 문의도 그대로 뒀어요. 메신저 「나에게」에서 그 할 일을 직접 지운 뒤 다시 해 주세요.',409);
      throw fail('INQUIRY_TASK_REMOVE','이 문의의 할 일을 지우지 못해 문의도 그대로 뒀어요. 잠시 뒤 다시 해 주세요.',502);
    }
    return result?.removed===true?'removed':'none';
  }
  function erase(user,id,input,context={}){
    user=current(user,context);
    // A repeated call after a lost response answers from the erasure record.
    const done=store.get(ERASED,id);if(done&&!store.get(ROWS,id))return {erased:{id,erasedAt:done.erasedAt,task:'none',repeated:true}};
    const row=erasable(id,input,['revision','token']);
    if(!confirmed(user,row,input.token))throw fail('INQUIRY_ERASE_CONFIRM','지우기 확인 시간이 지났거나 확인한 내용과 달라요. 「지우기 전에 확인」을 다시 눌러 주세요.',409);
    // The task goes first. If anything stops here the inquiry is still whole, and the next try finishes.
    const task=eraseTask(row),erasedAt=now();
    try{
      secure(()=>store.transaction(()=>{
        if(store.get(ROWS,id)?.revision!==row.revision)throw fail('INQUIRY_REVISION','그사이 문의가 바뀌었어요. 새로 읽어 주세요.',409);
        store.remove(ROWS,id);store.put(ERASED,id,{id,erasedAt});
      }));
    }catch(error){
      // The task is gone already: mark it, so the screen offers no dead link and the next try goes straight to the row.
      if(task==='removed'){try{const latest=store.get(ROWS,id);if(latest?.task)putRow(id,{...latest,task:{...latest.task,state:'unavailable'}});}catch{}}
      throw error;
    }
    // 'pending' when a reader kept the -wal file from being truncated; cleanWal() tries again on its own.
    const storage=cleanWal()?'clean':'pending';
    try{onChange();}catch{}
    return {erased:{id,erasedAt,task,storage}};
  }
  function importOne(raw){
    const data=normalize(raw),id=hash([WEBSITE_INQUIRY_FORM_ID,data.responseId]);
    // An erased inquiry leaves only {id, erasedAt}. Google may still hold the response (a full re-read, or an
    // edit that moves its timestamp past the watermark), so it never comes back.
    if(store.get(ERASED,id))return null;
    const fingerprint=hash(data),prior=store.get(ROWS,id);
    if(prior?.fingerprint===fingerprint)return prior;
    const classification=classifyWebsiteInquiry(data);
    const row={id,payload:store.encrypt(data),fingerprint,classification,replyDraft:prior?.draftEdited?prior.replyDraft:classification.draft,
      draftEdited:prior?.draftEdited===true,status:prior?.status||'new',revision:(prior?.revision||0)+1,
      importedAt:prior?.importedAt||now(),updatedAt:now(),task:prior?.task||null};
    putRow(id,row);return row;
  }
  function linkTask(row,user){
    if(row.classification.isTest)return;
    user=current(user);
    if(row.task?.state==='linked'||row.task?.state==='unavailable')return;
    let task=row.task;
    if(!task){
      const target=personalTarget(user);
      task={state:'pending',requestId:randomUUID(),actorId:user.id,...target,createdAt:now()};
      row={...row,task};putRow(row.id,row);
    }
    if(task.actorId!==user.id)throw fail('INQUIRY_TASK_ACTOR','다른 관리자가 이 문의의 할 일을 만들던 중이에요. 그 관리자 계정으로 다시 모아 주세요.',409);
    let result;
    try{result=synchronous(tasks.find(user,{requestId:task.requestId}));}
    catch(error){
      if(error.status!==410)throw error;
      putRow(row.id,{...store.get(ROWS,row.id),task:{...task,state:'unavailable'}});
      return;
    }
    if(!result){
      const target=personalTarget(user);
      if(target.roomId!==task.roomId||target.taskUserId!==task.taskUserId)throw fail('INQUIRY_TASK_TARGET','문의 후속 할 일을 받을 대화방이 바뀌었어요. 새로 읽은 뒤 다시 모아 주세요.',409);
      // No customer text/email or model-generated claims are copied to chat.
      result=synchronous(tasks.create(user,{requestId:task.requestId,channelId:task.roomId,title:'홈페이지 문의 답변 검토',
        body:'문의 원문과 분류 근거를 읽고 답변 초안을 다듬어요.\n고객에게 보내는 일은 담당자가 따로 해요.\n\n문의 접수함: '+sourceOrigin+sourceHref(row.id),
        assigneeId:task.taskUserId,reviewerId:null,dueDate:null}));
    }
    if(!result?.task?.id||!result.message?.id||result.task.channelId!==task.roomId||String(result.task.messageId)!==String(result.message.id))
      throw fail('INQUIRY_TASK_RESULT','후속 할 일이 만들어졌는지 확인하지 못했어요. 다음 수집 때 다시 확인해요.',502);
    const latest=store.get(ROWS,row.id);
    putRow(row.id,{...latest,task:{...task,state:'linked',taskId:result.task.id,messageId:String(result.message.id),linkedAt:now()}});
  }
  async function scan({force=false,user,context={},signal}={}){
    if(stopped)throw fail('INQUIRY_STOPPED','문의 수집을 멈추는 중이에요. 잠시 뒤 다시 해 주세요.',503);
    if(user)current(user,context);
    const initial=config(),before=state(),at=now();
    if(!initial.enabled)return {skipped:true,reason:'paused'};
    if(!force&&before.nextCheckAt&&Date.parse(before.nextCheckAt)>Date.parse(at))return {skipped:true,reason:'not-due'};
    const binding=hash(initial),actor=store.get('users',initial.actorId);
    const check=()=>{if(stopped)throw fail('INQUIRY_STOPPED','문의 수집을 멈추는 중이에요. 잠시 뒤 다시 해 주세요.',503);signal?.throwIfAborted();context.signal?.throwIfAborted();if(hash(config())!==binding)throw fail('INQUIRY_CONFIG_CHANGED','수집하는 동안 설정이 바뀌어 멈췄어요. 새로 읽은 뒤 다시 모아 주세요.',409);current(actor);if(user)current(user,context);};
    try{
      check();personalTarget(actor);
      store.put('settings',STATE,{...before,status:'running',lastAttemptAt:at,errorCode:null,error:null});
      // A fixed filter is kept with each nextPageToken. Advance the watermark
      // only after the whole response set has been consumed.
      let cursor=before.continuation||{after:before.watermark?new Date(Date.parse(before.watermark)-60000).toISOString():undefined,pageToken:undefined,maximum:before.watermark||null};
      let pages=0,questionMap;
      do{
        const page=await reader.readPage({after:cursor.after,pageToken:cursor.pageToken,questionMap,signal:signal||context.signal});check();questionMap=page.questionMap;
        if(!Array.isArray(page.items))throw fail('INQUIRY_PROVIDER_INVALID','Google에서 받은 문의 형식이 맞지 않아 멈췄어요. 잠시 뒤 다시 모아 주세요.',502);
        // Validate an entire page before committing any of its customer records.
        const normalized=page.items.map(normalize);
        for(const raw of normalized){check();const row=importOne(raw);if(row)linkTask(row,actor);if(!cursor.maximum||Date.parse(raw.submittedAt)>Date.parse(cursor.maximum))cursor.maximum=raw.submittedAt;}
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
        error:'문의 수집이나 후속 할 일 연결을 끝내지 못했어요. 「연결 확인」으로 Google 연결과 권한을 봐 주세요.',nextCheckAt:new Date(Date.parse(now())+300000).toISOString()});
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
  async function close(){stopped=true;clearTimeout(walTimer);walTimer=null;await pending?.catch(()=>{});}
  return {workspace,get,verify,configure,update,checkErase,erase,tick,health,close};
}
