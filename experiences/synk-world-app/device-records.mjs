// 공개판 설계 §2 「로그인 없이 먼저 해 본다」: 손님이 이 기기에 쌓은 학습 기록을 로그인할 때 계정으로 옮길지 한 번 묻는다.
// 10-19: 한글 만나기의 글자 진도(hangul-stage)와 첫 실행에 고른 「한글을 읽을 수 있어요?」 답(생활 진도 기록의 hangul 칸).
// 10-20(TOPIK 맞춤 재설계 · 유호님이 방식을 Claude 추천에 맡김): 생활 진도(레슨·복습·하루 기록)·짧은 진단과 연습의 학습 기록(Trail)·
// 학습 목표도 같은 물음 하나로 옮긴다.
// - 계정이 비어 있으면 그대로 옮긴다. 계정에 이미 기록이 있으면 사건 ID(학습 기록)·레슨·복습·날(생활 진도)로 중복을 빼고 계정 것을 덮지 않는다.
//   한글 진도와 첫 실행 답, 학습 목표는 계정에 이미 있으면 계정 것을 쓴다.
// - 다른 학생이 쓴 적 있는 기기: 그 학생이 마지막으로 이 기기에 있었던 때(로그인해 있던 때·로그아웃)와 이 계정이 지난번에 고른 때 뒤의
//   손님 기록만 대상이다(기준 시각 deviceWatermark). 그래서 앞 사람의 손님 기록이 다음 사람에게 넘어가지 않는다.
// - 옮긴 출처(손님 기기)는 생활 진도의 imports와 이 기기의 고른 기록(DEVICE_RECORDS_KEY)에 남는다. 학습 기록은 사건 그대로라 ID가 같다.
// - 이 기기의 손님 기록은 지우지 않는다. 계정 쪽은 서버가 받았다고 답한 뒤에만 「옮겼어요」라고 한다(못 받으면 다시 고를 수 있다).
export const HANGUL_DEVICE_KEY='synk.hangul-stage.v1';
export const GUEST_LIFE_KEY='synk.life-korean.progress.v1:guest';
export const GUEST_LEARNING_KEY='synk.atlas.learning.v1.device';
export const DEVICE_RECORDS_KEY='synk.world.device-records.v1';
const RECORD_ANSWERS=new Set(['new','reads']),RECORD_VIA=new Set(['question','graduation','skip','unskip']);
const recordObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const recordTime=value=>Number.isSafeInteger(value)&&value>=0;
const recordEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const recordId=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
const isoTime=value=>{const at=typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(at)?at:-Infinity;};

// hangul-stage/learning.mjs progressKey와 같은 이름(synk-account scopedStorage의 계정·학습 동의 판 구역).
export function hangulAccountKey(status){
 if(!recordObject(status)||!/^[a-zA-Z0-9_.:-]{1,120}$/.test(String(status.accountKey))||!Number.isInteger(status.revision))return null;
 return `synk.account.${status.accountKey}.r${status.revision}.hangul-stage.v1`;
}
// 옮길 만한 진도인지: 글자를 하나라도 만났거나, 건너뛰었거나, 졸업했거나, 한 회차라도 했다.
export function hangulProgressSummary(value){
 if(!recordObject(value)||value.v!==1)return null;
 const letters=recordObject(value.letters)?Object.values(value.letters).filter(recordObject):[];
 const met=letters.filter(letter=>['met','learning','mastered'].includes(letter.state)).length,mastered=letters.filter(letter=>letter.state==='mastered').length;
 const graduated=recordObject(value.graduated),skipped=value.skipped===true,sessions=Array.isArray(value.sessions)?value.sessions.length:0;
 return met||graduated||skipped||sessions?{met,mastered,graduated,skipped,sessions}:null;
}
// 기준 시각이 있으면 한 기록(레슨·한글 진도·학습 목표)의 모든 활동이 그 뒤일 때만 이 사람의 것으로 본다 — 앞 사람이 하던 기록에
// 이어 한 것은 앞 사람 몫이 섞여 있어 통째로 두고 간다(10-21 백엔드 검수 · 하루 기록 문항·학습 기록 사건은 하나하나 시각으로 가른다).
const allAfter=(times,after)=>!after||times.length>0&&Math.min(...times)>after;
// 한글 진도의 활동 시각(글자를 만나거나 답한 때·졸업·회차한 날). 회차는 날짜만 있어 그날 0시(한국 시각)로 친다 — 그날 앞선 기록을 뒤로 보지 않게.
function hangulTimes(value){
 const times=[];
 for(const letter of recordObject(value?.letters)?Object.values(value.letters):[])for(const key of ['metAt','lastAt'])times.push(isoTime(letter?.[key]));
 times.push(isoTime(value?.graduated?.at));
 for(const session of Array.isArray(value?.sessions)?value.sessions:[])times.push(isoTime(`${session?.day}T00:00:00+09:00`));
 return times.filter(Number.isFinite);
}
// 한글 원본 글(JSON) 하나를 기준 시각과 함께 본다. 옮길 때는 검사한 그 글을 그대로 옮긴다(저장소를 다시 읽지 않는다 — 10-21 재확인).
function hangulOf(raw,{after=0}={}){
 try{const value=JSON.parse(raw),summary=hangulProgressSummary(value);return summary&&allAfter(hangulTimes(value),after)?summary:null;}catch{return null;}
}
function readHangul(storage,key,options){const raw=storage.getItem(key);return raw===null?null:hangulOf(raw,options);}
function guestLife(storage){
 try{const value=JSON.parse(storage?.getItem(GUEST_LIFE_KEY)||'null');return recordObject(value)&&value.owner==='guest'&&value.version===1?value:null;}catch{return null;}
}
export function deviceHangulAnswer(storage,{after=0}={}){
 const hangul=guestLife(storage)?.hangul;
 return recordObject(hangul)&&hangul.version===1&&RECORD_ANSWERS.has(hangul.answer)&&RECORD_VIA.has(hangul.via)&&recordTime(hangul.at)&&(!after||hangul.at>after)?{answer:hangul.answer,via:hangul.via}:null;
}

// ── 이 기기에 누가 언제 있었는지(기준 시각) ──
// {version:1, accounts:{<계정>:{decision, at, through?, seenAt?, cloud?, moved?}}, signedOutAt?}
function readDevice(storage){
 try{const value=JSON.parse(storage?.getItem(DEVICE_RECORDS_KEY)||'null');if(recordObject(value)&&value.version===1&&recordObject(value.accounts))return value;}catch{}
 return {version:1,accounts:{}};
}
function writeDevice(storage,value){try{storage.setItem(DEVICE_RECORDS_KEY,JSON.stringify(value));return true;}catch{return false;}}
function accountEntry(device,accountId){return Object.hasOwn(device.accounts,accountId)&&recordObject(device.accounts[accountId])?device.accounts[accountId]:null;}
// 이 계정에 물을 손님 기록의 시작점: 마지막 로그아웃, 다른 계정이 이 기기에 마지막으로 있던 때, 이 계정이 지난번에 고른 때 가운데 가장 늦은 것.
// own=false: 이 계정이 지난번에 고른 때는 빼고 본다(예전에 이 기기에만 옮긴 한글 진도를 계정 저장으로 다시 묻는 경우).
export function deviceWatermark(storage,accountId,{own=true}={}){
 const device=readDevice(storage);let mark=recordTime(device.signedOutAt)?device.signedOutAt:0;
 for(const [id,entry]of Object.entries(device.accounts)){
  if(!recordObject(entry))continue;
  if(id===accountId){if(own)mark=Math.max(mark,recordTime(entry.through)?entry.through:recordTime(entry.at)&&['moved','kept'].includes(entry.decision)?entry.at:0);continue;}
  for(const key of ['seenAt','at','through'])if(recordTime(entry[key]))mark=Math.max(mark,entry[key]);
 }
 return mark;
}
// 로그아웃(app-shell의 logout): 이 뒤의 손님 기록만 다음 로그인에 묻는다.
export function noteDeviceSignOut(storage,at=Date.now()){const device=readDevice(storage);device.signedOutAt=Math.max(recordTime(device.signedOutAt)?device.signedOutAt:0,at);return writeDevice(storage,device);}
// 계정이 이 기기에 있었다(로그인·계정 화면을 연 때): 다른 계정은 이보다 앞선 손님 기록을 받지 않는다.
export function noteDeviceAccount(storage,accountId,at=Date.now()){
 if(!recordId(accountId)||accountId==='guest')return false;
 const device=readDevice(storage),entry=accountEntry(device,accountId)||{};
 device.accounts={...device.accounts,[accountId]:{...entry,seenAt:Math.max(recordTime(entry.seenAt)?entry.seenAt:0,at)}};
 return writeDevice(storage,device);
}

// ── 손님 학습 기록(Trail, 이 기기 열쇠 synk.atlas.learning.v1.device)에서 기준 시각 뒤의 것 ──
// 제시(practice.presented)를 기준으로 그 결정(decision.made)과 딸린 사건(첫 답·도움·소리·마침·빼기)을 함께 옮긴다 —
// 부모 없는 사건을 보내면 계정 기록이 받지 않는다. 사건은 고치지 않는다(ID가 같아 다시 옮겨도 중복이 생기지 않는다).
export function guestLearningEvents(storage,{after=0}={}){
 let value=null;try{value=JSON.parse(storage?.getItem(GUEST_LEARNING_KEY)||'null');}catch{value=null;}
 if(!recordObject(value)||value.version!==1||value.owner!=null||!Array.isArray(value.events))return {events:[],attempts:0};
 const events=value.events.filter(event=>recordObject(event)&&recordId(event.id)&&typeof event.type==='string');
 const byId=new Map(events.map(event=>[event.id,event]));
 const shown=new Set(),decisions=new Set();
 for(const event of events){
  if(event.type!=='practice.presented'||isoTime(event.at)<=after)continue;
  if(event.decisionId&&byId.get(event.decisionId)?.type!=='decision.made')continue;
  shown.add(event.id);if(event.decisionId)decisions.add(event.decisionId);
 }
 const keep=new Set([...shown,...decisions]);
 for(const event of events)if(event.presentationId&&shown.has(event.presentationId)||event.type==='experience.completed'&&decisions.has(event.decisionId))keep.add(event.id);
 for(const event of events)if(event.type==='record.excluded'&&keep.has(event.targetId))keep.add(event.id);
 const moved=events.filter(event=>keep.has(event.id));
 return {events:moved,attempts:moved.filter(event=>event.type==='practice.attempted'&&event.attemptNo===1).length};
}
// ── 손님 생활 진도(레슨·복습·하루 기록·학습 목표)에서 기준 시각 뒤의 것 ──
const EXAM_FIELDS=['examType','targetGrade','examDate','examMode','weeklyMinutes'];
export function guestLifeRecords(storage,{after=0}={}){
 const value=guestLife(storage);if(!value)return null;
 const lessons={},reviews={},days={};
 // 레슨: 연 때·마친 때·답이 모두 기준 시각 뒤인 레슨만(답이 하나도 없는 레슨은 옮길 거리가 아니다).
 const ownLesson=lesson=>{
  if(!recordObject(lesson))return false;const answers=Object.values(recordObject(lesson.answers)?lesson.answers:{});
  return answers.length>0&&allAfter([lesson.startedAt,lesson.completedAt,...answers.map(answer=>answer?.at)].filter(recordTime),after);
 };
 for(const [id,lesson]of Object.entries(recordObject(value.lessons)?value.lessons:{}))if(ownLesson(lesson))lessons[id]=lesson;
 // 복습은 레슨 답에서 생기므로 그 레슨이 이 사람의 것일 때만 따라간다(받는 쪽 importRecords가 계정에 그 레슨이 있는지 다시 본다).
 for(const [id,review]of Object.entries(recordObject(value.reviews)?value.reviews:{}))if(recordObject(review)&&recordTime(review.lastAt)&&review.lastAt>after&&ownLesson(value.lessons?.[review.lessonId]))reviews[id]=review;
 for(const [key,day]of Object.entries(recordObject(value.daily?.days)?value.daily.days:{})){
  const items=Object.entries(recordObject(day?.items)?day.items:{}).filter(([,item])=>recordTime(item?.observedAt)&&item.observedAt>after);
  if(items.length)days[key]={...day,items:Object.fromEntries(items)};
 }
 // 학습 목표: 지금 값마다 선언한 때(provenance.at)가 모두 기준 시각 뒤일 때만 — 앞 사람이 정한 목표가 남은 판에서 한 칸만 바꾼 것은 두고 간다.
 // 넘기기 전에 시험 칸은 시험 이유와 짝을 맞춘다(계약 r2 — 이유를 바꾸면 시험 정보는 지운다).
 const saved=value.learningProfile?.profile,declared=recordObject(saved?.provenance)?saved.provenance:{};
 const savedValues=recordObject(saved)&&saved.status==='active'&&saved.consent===true&&recordObject(saved.values)?{...saved.values}:{};
 if(!(Array.isArray(savedValues.reasons)&&savedValues.reasons.includes('exam')))for(const field of EXAM_FIELDS)delete savedValues[field];
 const declaredAfter=()=>{const times=Object.keys(saved.values).map(field=>isoTime(declared[field]?.at));return !after||times.length>0&&times.every(at=>Number.isFinite(at)&&at>after);};
 const profile=Object.keys(savedValues).length&&declaredAfter()?{values:savedValues}:null;
 const counts={lessons:Object.keys(lessons).length,reviews:Object.keys(reviews).length,days:Object.keys(days).length,profile:!!profile};
 return counts.lessons||counts.reviews||counts.days||counts.profile?{lessons,reviews,days,profile,counts}:null;
}

// learning: 계정 학습 호스트의 status()(accountKey·revision), accountAnswer: 계정 생활 진도의 hangulReading()(없으면 null).
// accountId: 기준 시각을 읽을 계정(없으면 기준 없이 모두 — 10-19 시험·옛 호출). life·learning: 생활 진도·학습 기록도 옮길 수 있으면 참.
// 옮길 것이 없으면 null. 손님 글자 진도가 있는데 계정 자리를 모르면 이번에는 묻지 않는다(다음 로그인 때 다시 본다).
// retryCloud: 이 계정이 예전에 한글 진도를 이 기기 안에서만 옮겼다(계정 저장 전) — 그 진도는 계정 저장으로 다시 묻는다(10-20 GPT 판과 같다).
export function planDeviceRecords({storage=globalThis.localStorage,learning=null,accountAnswer=null,hangulPort=null,accountId=null,life=false,learningLog=false,retryCloud=false}={}){
 let device,answer,target,accountHas=false,from=HANGUL_DEVICE_KEY;
 const after=accountId?deviceWatermark(storage,accountId):0,hangulAfter=accountId&&retryCloud?deviceWatermark(storage,accountId,{own:false}):after;
 try{device=readHangul(storage,HANGUL_DEVICE_KEY,{after:hangulAfter});answer=deviceHangulAnswer(storage,{after});target=hangulAccountKey(learning);
  if(hangulPort){
   // Previous versions put account progress in an account-scoped local key.
   // Offer that same owner's snapshot before a guest copy; neither is uploaded silently.
   if(target&&readHangul(storage,target)){device=readHangul(storage,target);from=target;}
   target=HANGUL_DEVICE_KEY;accountHas=hangulPort.read()!==null;
  }else if(target)accountHas=storage.getItem(target)!==null;
 }catch{return null;}
 const hangulReady=!(device&&!target);
 const hangul=hangulReady&&device&&!accountHas?{from,to:target,summary:device,after:from===HANGUL_DEVICE_KEY?hangulAfter:0,...(hangulPort?{cloud:true}:{})}:null,moveAnswer=answer&&!accountAnswer?answer:null;
 let lifeRecords=null,events=null;
 try{if(life)lifeRecords=guestLifeRecords(storage,{after});}catch{lifeRecords=null;}
 try{if(learningLog){const found=guestLearningEvents(storage,{after});if(found.events.length)events=found;}}catch{events=null;}
 if(!hangul&&!moveAnswer&&!lifeRecords&&!events)return null;
 return {hangul,answer:moveAnswer,life:lifeRecords,learning:events,after,kept:{hangul:hangulReady&&!!device&&accountHas,answer:!!answer&&!!accountAnswer}};
}
// 옮기는 순간에 다시 본다: 그사이 계정에 기록이 생겼으면 합치지 않는다('exists'), 손님 기록이 사라졌으면 건너뛴다('gone').
// importLife(records): 계정 생활 진도에 없는 것만 더하고 서버에 저장됐는지까지 확인한다(app-shell). importLearning(events): 같은 것을 학습 기록에.
export async function applyDeviceRecords(plan,{storage=globalThis.localStorage,accountAnswer=()=>null,setAccountAnswer,hangulPort=null,guard=()=>{},importLife=null,importLearning=null}){
 // pending: 서버 확인 전에 실패했지만 계정 쪽에 이미 더한 것(다시 고를 때 「일부만」으로 치지 않으려고 판이 기억한다).
 const result={hangul:null,answer:null,life:null,learning:null,errors:[],added:{lessons:0,reviews:0,days:0,profile:false,events:0},pending:{}};
 if(plan?.hangul){
  try{
   const raw=storage.getItem(plan.hangul.from);
   guard();
   if(plan.hangul.cloud){
    if(!hangulPort)throw Error('계정 한글 저장 연결을 다시 열어 주세요.');
    if(raw===null||!hangulOf(raw,{after:plan.hangul.after||0}))result.hangul='gone';
    else{result.hangul=await hangulPort.importSnapshot(raw);guard();}
   }
   else if(storage.getItem(plan.hangul.to)!==null)result.hangul='exists';
   else if(raw===null||!hangulOf(raw,{after:plan.hangul.after||0}))result.hangul='gone';
   else{storage.setItem(plan.hangul.to,raw);result.hangul='moved';}
  }catch(error){result.errors.push(error);}
 }
 if(plan?.answer){
  try{guard();if(accountAnswer())result.answer='exists';else{await setAccountAnswer(plan.answer.answer,{via:plan.answer.via});guard();result.answer='moved';}}
  catch(error){result.errors.push(error);}
 }
 if(plan?.life&&typeof importLife==='function'){
  try{guard();const added=await importLife(plan.life);guard();
   Object.assign(result.added,{lessons:added?.lessons||0,reviews:added?.reviews||0,days:added?.days||0,profile:!!added?.profile});
   result.life=added&&(added.lessons||added.reviews||added.days||added.profile)?'moved':'exists';}
  catch(error){const got=error?.added;if(recordObject(got)&&(got.lessons||got.reviews||got.days||got.profile))result.pending.life=got;result.errors.push(error);}
 }
 if(plan?.learning&&typeof importLearning==='function'){
  try{guard();const added=await importLearning(plan.learning.events);guard();
   if(added?.confirmed===false)throw Object.assign(Error('학습 기록이 아직 계정에 올라가지 않았어요.'),{code:'LEARNING_NOT_SAVED',added:added?.added||0});
   result.added.events=added?.added||0;result.learning=added?.added?'moved':'exists';}
  catch(error){if(Number.isInteger(error?.added)&&error.added>0)result.pending.learning=error.added;result.errors.push(error);}
 }
 return result;
}
export function deviceRecordsDecision(storage,accountId,{cloud=false}={}){
 try{const entry=accountEntry(readDevice(storage),accountId);return recordObject(entry)&&['moved','kept'].includes(entry.decision)&&(!cloud||entry.decision==='kept'||entry.cloud===true)?entry.decision:null;}catch{return null;}
}
// 고른 답과 그때까지의 기준 시각(through)을 계정마다 남긴다: 그 앞의 손님 기록은 이 계정에 다시 묻지 않는다.
// moved: 옮긴 수(출처 기록 · 손님 기기에서 옮긴 레슨·복습·날·학습 기록 사건 수).
export function saveDeviceRecordsDecision(storage,accountId,decision,at=Date.now(),{cloud=false,through=null,moved=null}={}){
 if(!['moved','kept'].includes(decision))throw TypeError('Invalid device records decision');
 const device=readDevice(storage),entry=accountEntry(device,accountId)||{};
 device.accounts={...device.accounts,[accountId]:{...(recordTime(entry.seenAt)?{seenAt:entry.seenAt}:{}),decision,at,...(cloud?{cloud:true}:{}),...(recordTime(through)?{through}:{}),...(recordObject(moved)?{moved:{from:'guest-device',...moved}}:{})}};
 return writeDevice(storage,device);
}

export const DEVICE_RECORDS_TEXT=Object.freeze({
 title:'이 기기의 학습 옮기기',lead:'이 기기에서 한 학습을 이 계정으로 옮길까요?',move:'옮기기',keep:'이 기기에만 두기',
 snapshot:'계정 기록은 덮지 않아요',snapshotBody:'계정에 이미 있는 기록은 그대로 두고, 계정에 없는 것만 더해요. 이 기기의 기록은 지우지 않아요.',
 moving:'계정으로 옮기고 있어요.',failed:'옮기지 못했어요. 연결을 확인한 뒤 다시 골라 주세요.',
 moved:'이 기기의 학습을 내 계정으로 옮겼어요.',partly:'옮길 수 있는 기록만 내 계정으로 옮겼어요.',kept:'계정은 이 기기의 학습 없이 이어 가요. 이 기기의 기록은 그대로 남아 있어요.',
 pendingKept:'옮기던 기록 일부는 이미 내 계정에 더했어요. 다음에 저장할 때 함께 저장돼요. 나머지는 이 기기에만 둬요.',
 hangulRow:'한글 만나기',answerRow:'처음 고른 답',answerNew:'한글을 아직 못 읽어요',answerReads:'한글을 읽을 수 있어요',
 graduated:'졸업했어요',met:n=>`글자 ${n}개를 만났어요`,metMastered:(n,m)=>`글자 ${n}개를 만났고 ${m}개를 익혔어요`,skipped:'건너뛰기를 골랐어요',started:'연습을 시작했어요',
 keptHangul:'한글 만나기는 계정에 이미 진도가 있어 계정 진도로 이어 가요.',keptAnswer:'처음 고른 답은 계정에 이미 있어 계정 것을 써요.',
 lifeRow:'생활 한국어',lessons:n=>`레슨 ${n}개`,reviews:n=>`복습 ${n}개`,days:n=>`연습한 날 ${n}일`,learningRow:'짧은 진단·연습',answers:n=>`답 ${n}개`,profileRow:'학습 목표',profileValue:'고른 목표와 도움 방식'
});
// 화면 언어(10-19 1판): 판을 띄우는 쪽이 text()로 고른 언어의 글을 넘기면 같은 키를 그 글로 바꾼다(없거나 실패하면 위 한국어).
function recordsText(text){let extra=null;try{extra=typeof text==='function'?text():text;}catch{extra=null;}return extra&&typeof extra==='object'?{...DEVICE_RECORDS_TEXT,...extra}:DEVICE_RECORDS_TEXT;}
function hangulLine(summary,T=DEVICE_RECORDS_TEXT){
 if(summary.graduated)return T.graduated;
 const met=summary.met?(summary.mastered?T.metMastered(summary.met,summary.mastered):T.met(summary.met)):'';
 return [met,summary.skipped?T.skipped:''].filter(Boolean).join(' · ')||T.started;
}
export function describeDeviceRecords(plan,T=DEVICE_RECORDS_TEXT){
 const rows=[];
 if(plan?.hangul)rows.push({label:T.hangulRow,value:hangulLine(plan.hangul.summary,T)});
 if(plan?.answer)rows.push({label:T.answerRow,value:plan.answer.answer==='new'?T.answerNew:T.answerReads});
 const counts=plan?.life?.counts;
 if(counts&&(counts.lessons||counts.reviews||counts.days))rows.push({label:T.lifeRow,value:[counts.lessons?T.lessons(counts.lessons):'',counts.reviews?T.reviews(counts.reviews):'',!counts.lessons&&counts.days?T.days(counts.days):''].filter(Boolean).join(' · ')});
 if(plan?.learning?.attempts)rows.push({label:T.learningRow,value:T.answers(plan.learning.attempts)});
 if(counts?.profile)rows.push({label:T.profileRow,value:T.profileValue});
 const notes=[];
 if(plan?.kept.hangul)notes.push(T.keptHangul);
 if(plan?.kept.answer)notes.push(T.keptAnswer);
 return {rows,notes};
}

// 로그인 뒤 입장 관문(createWorldEntryGate의 offer)에서 한 번 묻는다. present({title,html,onClose})가 판을 띄우고,
// 판의 단추(data-world="device-records" data-choice="move|keep")가 choose로 온다. 판을 닫으면 이번 화면에서는 다시 묻지 않는다.
// 고른 뒤에는 관문이 이어지게 먼저 끝을 알리고 같은 차례에 판을 닫는다(이어지는 튜터 고르기 판을 닫지 않게). 알림은 그다음 판 위에 뜨게 미룬다.
// text: 판 글을 고른 화면 언어로 넘기는 함수(DEVICE_RECORDS_TEXT와 같은 키, 열 때·알릴 때마다 다시 읽는다).
// importLife·importLearning: 생활 진도·학습 기록을 옮기는 통로(app-shell, 없으면 한글만 — 10-19와 같다).
export function createDeviceRecordsOffer({storage=globalThis.localStorage,learningStatus=()=>null,accountAnswer=()=>null,setAccountAnswer,present,close,toast=()=>{},head='',now=Date.now,defer=fn=>setTimeout(fn,0),text=null,hangulPort=()=>null,accountOwner=null,
 importLife=null,importLearning=null}){
 const asked=new Set();let current=null;
 function markup(plan){
  const T=recordsText(text),{rows,notes}=describeDeviceRecords(plan,T);
  return `<div class="ws-signin"><div class="ws-signin-head"><p class="ws-lead">${recordEscape(T.lead)}</p>${head}</div>`
   +`<div class="world-notice" data-tone="ok" data-label="DEVICE"><strong>${rows.map(row=>`${recordEscape(row.label)} · ${recordEscape(row.value)}`).join('<br>')}</strong><span>${recordEscape(T.snapshotBody)}</span></div>`
   +notes.map(note=>`<p class="dialog-note">${recordEscape(note)}</p>`).join('')
   +`<div class="world-actions"><button class="felt-button" data-world="device-records" data-choice="move">${recordEscape(T.move)}</button><button class="plain-button" data-world="device-records" data-choice="keep">${recordEscape(T.keep)}</button></div>`
   +`<p class="dialog-note" data-device-records-status role="status" aria-live="polite"></p></div>`;
 }
 function finish(job,value){if(current!==job)return;current=null;job.resolve(value);}
 function offer({owner}={}){
  const port=hangulPort();
  if(typeof owner!=='string'||!owner||owner==='guest'||asked.has(owner))return null;
  if(port&&port.accountId!==owner)return null;
  const entry=accountEntry(readDevice(storage),owner),retryCloud=!!port&&entry?.decision==='moved'&&entry.cloud!==true;
  let plan=null;try{plan=planDeviceRecords({storage,learning:learningStatus(),accountAnswer:accountAnswer(),hangulPort:port,accountId:owner,life:typeof importLife==='function',learningLog:typeof importLearning==='function',retryCloud});}catch{plan=null;}
  // 이 계정이 이 기기에 있었다는 사실은 기준 시각을 읽은 뒤에 남긴다(그래야 이 계정 자신의 기록은 빠지지 않는다).
  noteDeviceAccount(storage,owner,now());
  if(!plan)return null;
  asked.add(owner);
  return new Promise(resolve=>{const job={owner,plan,port,resolve,busy:false,startedAt:now()};current=job;present({title:recordsText(text).title,html:markup(plan),onClose:()=>finish(job,'dismissed')});});
 }
 function done(job,value,message){finish(job,value);close();if(message)defer(()=>toast(message));return value;}
 // 앞 시도들이 남긴 것(같은 판을 다시 고를 때): moved — 서버가 받았다고 확인한 것(생활 진도·학습 기록 수, 한글·처음 고른 답),
 // pending — 계정에 더했지만 서버 확인을 못 한 것. 다시 고르면 이미 더한 것은 받는 쪽이 「이미 있음」으로 건너뛰고 확인만 다시 한다(10-21 백엔드 검수).
 const lifeNonzero=counts=>!!(counts&&(counts.lessons||counts.reviews||counts.days||counts.profile));
 const lifeSum=(a,b)=>({lessons:(a?.lessons||0)+(b?.lessons||0),reviews:(a?.reviews||0)+(b?.reviews||0),days:(a?.days||0)+(b?.days||0),profile:!!(a?.profile||b?.profile)});
 async function choose(choice,{owner,status=()=>{}}={}){
  const job=current;if(!job||job.busy||!['move','keep'].includes(choice))return null;
  // 그사이 계정이 바뀌었으면 아무것도 옮기지 않고 판만 닫는다.
  if(owner!==job.owner){done(job,'dismissed');return null;}
  job.busy=true;const T=recordsText(text);
  const carry=job.carry??={moved:{lessons:0,reviews:0,days:0,profile:false,events:0},hangul:false,answer:false,pending:{life:null,learning:0}};
  const movedSoFar=()=>lifeNonzero(carry.moved)||carry.moved.events>0||carry.hangul||carry.answer;
  // cloud: 계정 한글 저장이 있는 상태에서 고른 결정이다(옮겼든 「두기」로 남겼든 한글은 정해졌다). 없으면 예전 기기 안 이전으로 보고 다음 로그인에
  // 계정 저장으로 다시 묻는다(retryCloud) — 일부만 옮기고 「두기」를 고른 한글을 다시 묻지 않게 한글 성공 여부로 가르지 않는다(10-21 재확인).
  const cloudDone=()=>!!job.port;
  if(choice==='keep'){
   // 앞 「옮기기」가 일부만 해냈으면 서버가 받은 만큼은 옮긴 것으로 남긴다. 서버 확인을 못 한 것만 있으면 고른 대로 「두기」로 남기되,
   // 계정에 이미 더한 것이 있다고 알린다(그것은 다음 저장 때 올라간다 — 「옮기지 않았다」고도, 「옮겼다」고도 하지 않는다).
   if(movedSoFar()){saveDeviceRecordsDecision(storage,job.owner,'moved',now(),{cloud:cloudDone(),through:job.startedAt,moved:{...carry.moved,at:now()}});return done(job,'moved',T.partly);}
   saveDeviceRecordsDecision(storage,job.owner,'kept',now(),{through:job.startedAt});
   return done(job,'kept',lifeNonzero(carry.pending.life)||carry.pending.learning>0?T.pendingKept:T.kept);}
  status(T.moving,true);
  const guard=()=>{if(current!==job||hangulPort()!==job.port||accountOwner&&accountOwner()!==job.owner)throw Error('로그인한 계정이 바뀌었어요.');};
  const result=await applyDeviceRecords(job.plan,{storage,accountAnswer,setAccountAnswer,hangulPort:job.port,guard,importLife,importLearning});
  if(current!==job)return null;
  // 「이미 있음」이 앞 시도 몫이면(앞에서 옮겼거나, 더하고 확인만 못 했다가 이번에 오류 없이 끝났다) 옮긴 것으로 본다.
  const hadLife=lifeNonzero(carry.moved)||lifeNonzero(carry.pending.life),hadEvents=carry.moved.events>0||carry.pending.learning>0;
  const status4={hangul:result.hangul==='exists'&&carry.hangul?'moved':result.hangul,answer:result.answer==='exists'&&carry.answer?'moved':result.answer,
   life:result.life==='exists'&&hadLife?'moved':result.life,learning:result.learning==='exists'&&hadEvents?'moved':result.learning};
  // 이번 시도에서 서버가 받은 것을 쌓는다. 앞 시도의 확인 못 한 것은 그 단계가 이번에 오류 없이 끝났으면 확인된 것이다.
  if(result.life==='moved')carry.moved={...carry.moved,...lifeSum(carry.moved,result.added)};
  if(['moved','exists'].includes(result.life)&&lifeNonzero(carry.pending.life)){carry.moved={...carry.moved,...lifeSum(carry.moved,carry.pending.life)};carry.pending.life=null;}
  if(result.learning==='moved')carry.moved.events+=result.added.events;
  if(['moved','exists'].includes(result.learning)&&carry.pending.learning>0){carry.moved.events+=carry.pending.learning;carry.pending.learning=0;}
  if(result.hangul==='moved')carry.hangul=true;
  if(result.answer==='moved')carry.answer=true;
  if(lifeNonzero(result.pending.life))carry.pending.life=lifeSum(carry.pending.life,result.pending.life);
  if(result.pending.learning>0)carry.pending.learning+=result.pending.learning;
  const movedNow=Object.values(status4).includes('moved');
  // 계정 저장이 서버에 닿았는지 모르는 부분이 하나라도 있으면(생활 진도·학습 기록·계정 한글 저장) 고른 것을 남기지 않고 다시 고르게 한다.
  if(result.errors.length&&(!movedNow||job.plan.hangul?.cloud||job.plan.life||job.plan.learning)){job.busy=false;status(T.failed,false);return null;}
  saveDeviceRecordsDecision(storage,job.owner,'moved',now(),{cloud:cloudDone(),through:job.startedAt,moved:{...carry.moved,at:now()}});
  const partly=result.errors.length||Object.values(status4).includes('exists')||!movedNow;
  return done(job,'moved',partly?T.partly:T.moved);
 }
 return Object.freeze({offer,choose,pending:()=>current?{owner:current.owner,plan:current.plan}:null});
}
