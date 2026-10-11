import {CAFE_COMPOSE_ID,CAFE_LESSON_IDS,isCafeLesson,isCafeCheckpoint,isCafeOrder,isCafeListen} from './cafe-activity.mjs';
// One bounded record owns the life-Korean curriculum. The official PlayHost can
// supply its storage port; guest/device records remain in their owner's namespace.
export const LIFE_PROGRESS_KEY='synk.life-korean.progress.v1';
export const LIFE_PROGRESS_VERSION=1;
const MINUTE=60000,DAY=86400000,INTERVALS=[1,3,7,14,30];
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message)=>Object.assign(new Error(message||code),{code});
const safeId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const time=value=>Number.isSafeInteger(value)&&value>=0;
const empty=owner=>({version:LIFE_PROGRESS_VERSION,owner,revision:0,activeLessonId:null,activeReview:null,lessons:{},reviews:{}});
const TUTORS=new Set(['marin','kkamong','mongle']),OUTCOMES=new Set(['independent','assisted','retry']);
const dailyId=value=>safeId(value)&&!['constructor','prototype'].includes(value);
const DAILY_MAX_TIME=253402268399999;
const dailyTime=value=>time(value)&&value<=DAILY_MAX_TIME;
// The learning day stays the same across browser/device time zones.
export function lifeDayKey(at){if(!dailyTime(at))throw TypeError('Invalid learning time');return new Date(at+9*3600000).toISOString().slice(0,10);}
const dailyLatest=item=>Math.max(item.observedAt??0,item.guidedAt??0);
function trimDaily(daily){
 const keys=Object.keys(daily.days).sort();for(const key of keys.slice(0,-30))delete daily.days[key];
 for(const day of Object.values(daily.days)){
  const ids=Object.keys(day.items).sort((a,b)=>dailyLatest(day.items[b])-dailyLatest(day.items[a])||(a<b?-1:a>b?1:0));
  for(const id of ids.slice(100))delete day.items[id];
 }
}
function fitDailyRecord(value){
 if(!value.daily)return;
 // Preserve the original answer/checkpoint payload and stay below both the
 // reader's 500k character limit and the account port's 512 KiB value limit.
 const bytes=()=>new TextEncoder().encode(JSON.stringify(value)).length;
 while(bytes()>480000){
  const oldest=Object.keys(value.daily.days).sort()[0];if(!oldest)break;
  delete value.daily.days[oldest];
 }
}
function validateDaily(daily){
 const invalid=()=>{throw fail('LIFE_PROGRESS_UNREADABLE');};
 if(!object(daily)||daily.version!==1||!object(daily.days)||Object.keys(daily).some(key=>!['version','days'].includes(key))||Object.keys(daily.days).length>30)invalid();
 for(const [key,day]of Object.entries(daily.days)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!object(day)||Object.keys(day).some(key=>!['items','closedAt'].includes(key))||!object(day.items)||!Object.keys(day.items).length||Object.keys(day.items).length>100)invalid();
  const sameDay=at=>dailyTime(at)&&lifeDayKey(at)===key;
  if(day.closedAt!==undefined&&!sameDay(day.closedAt))invalid();
  for(const [id,item]of Object.entries(day.items)){
   if(!dailyId(id)||!object(item)||Object.keys(item).some(key=>!['lessonId','observedAt','outcome','guidedAt','tutorId'].includes(key))||!dailyId(item.lessonId))invalid();
   if(item.observedAt===undefined?item.outcome!==undefined:item.outcome===undefined||!sameDay(item.observedAt)||!OUTCOMES.has(item.outcome))invalid();
   if(item.guidedAt===undefined?item.tutorId!==undefined:!sameDay(item.guidedAt)||!TUTORS.has(item.tutorId))invalid();
   if(item.observedAt===undefined&&item.guidedAt===undefined)invalid();
  }
 }
}
function dailyObservation(next,{questionId,lessonId,at,correct,helped},migrating=false){
 if(!dailyTime(at)||!dailyId(questionId)||!dailyId(lessonId))return;
 const dayKey=lifeDayKey(at),daily=next.daily??={version:1,days:{}},day=daily.days[dayKey]??={items:{}},old=day.items[questionId];
 if(migrating&&old?.observedAt>=at)return;
 const observedAt=migrating?at:dailyEventTime(day,old,at);
 day.items[questionId]={...old,lessonId,observedAt,outcome:correct?(helped?'assisted':'independent'):'retry'};trimDaily(daily);
}
function dailyEventTime(day,item,at){
 const end=Date.parse(lifeDayKey(at)+'T23:59:59.999+09:00');
 const value=Math.min(end,Math.max(at,dailyLatest(item||{})+1,(day.closedAt??-1)+1));
 // At the day's last millisecond there is no later representable time.
 if(day.closedAt!==undefined&&value<=day.closedAt)delete day.closedAt;
 return value;
}
function backfillDaily(value){
 if(value.daily!==undefined)return;
 // Only surviving first-answer evidence can be recovered. Past guided practice
 // and replaced review sessions were never recorded and must not be invented.
 for(const [lessonId,lesson]of Object.entries(value.lessons))for(const [questionId,answer]of Object.entries(lesson.answers))dailyObservation(value,{lessonId,questionId,...answer},true);
 for(const [reviewId,answer]of Object.entries(value.activeReview?.answers||{})){
  const review=value.reviews[reviewId];if(review)dailyObservation(value,{lessonId:review.lessonId,questionId:review.questionId,...answer},true);
 }
 fitDailyRecord(value);
}

function validate(raw,owner){
 if(typeof raw!=='string'||raw.length>500000)throw fail('LIFE_PROGRESS_UNREADABLE');
 let value;try{value=JSON.parse(raw);}catch{throw fail('LIFE_PROGRESS_UNREADABLE');}
 if(!object(value)||value.version!==1||value.owner!==owner||!time(value.revision)||!object(value.lessons)||!object(value.reviews)||Object.keys(value.lessons).length>100||Object.keys(value.reviews).length>400)throw fail('LIFE_PROGRESS_UNREADABLE');
 if(value.activeLessonId!==null&&!safeId(value.activeLessonId))throw fail('LIFE_PROGRESS_UNREADABLE');
 for(const [id,lesson]of Object.entries(value.lessons)){
  if(!safeId(id)||!object(lesson)||!safeId(lesson.attemptId)||!time(lesson.startedAt)||lesson.completedAt!==null&&!time(lesson.completedAt)||!object(lesson.answers)||Object.keys(lesson.answers).length>100||!Array.isArray(lesson.questionIds)||lesson.questionIds.length>100||!lesson.questionIds.every(safeId)||new Set(lesson.questionIds).size!==lesson.questionIds.length)throw fail('LIFE_PROGRESS_UNREADABLE');
  if(lesson.questionIds.some(id=>!safeId(id))||Object.keys(lesson.answers).some(id=>!lesson.questionIds.includes(id)))throw fail('LIFE_PROGRESS_UNREADABLE');
  for(const [qid,answer]of Object.entries(lesson.answers))if(!object(answer)||typeof answer.correct!=='boolean'||typeof answer.helped!=='boolean'||!time(answer.at)||answer.choiceId!==null&&!safeId(answer.choiceId)||answer.order!==undefined&&(id!==CAFE_COMPOSE_ID||qid!=='cafe-compose-order'||!isCafeOrder(answer.order,{complete:true}))||answer.input!==undefined&&(!isCafeLesson(id)||!isCafeListen(answer.input)))throw fail('LIFE_PROGRESS_UNREADABLE');
  if(lesson.stage!==undefined&&(!object(lesson.stage)||!['intro','story','questions'].includes(lesson.stage.phase)||!time(lesson.stage.sceneIndex)||!time(lesson.stage.questionIndex)||lesson.stage.sceneIndex>100||lesson.stage.questionIndex>100||lesson.stage.helped!==undefined&&typeof lesson.stage.helped!=='boolean'))throw fail('LIFE_PROGRESS_UNREADABLE');
  if(lesson.stage?.cafe!==undefined&&(!isCafeLesson(id)||lesson.stage.phase!=='questions'||!isCafeCheckpoint(lesson.stage.cafe,id)||lesson.stage.questionIndex!==lesson.stage.cafe.step||lesson.stage.sceneIndex!==lesson.stage.cafe.step||lesson.stage.cafe.phase==='complete'&&lesson.questionIds.some(qid=>!lesson.answers[qid])))throw fail('LIFE_PROGRESS_UNREADABLE');
 }
 for(const [id,review]of Object.entries(value.reviews)){
  if(!safeId(id)||!object(review)||review.id!==id||!safeId(review.questionId)||!safeId(review.lessonId)||!safeId(review.packId)||!safeId(review.skillId)||!time(review.dueAt)||!time(review.lastAt)||!time(review.streak)||review.streak>1000||!time(review.lapses)||!time(review.intervalDays)||review.intervalDays>30)throw fail('LIFE_PROGRESS_UNREADABLE');
 }
 if(value.activeReview!==null){const run=value.activeReview;
  if(!object(run)||!safeId(run.id)||!time(run.startedAt)||!Array.isArray(run.ids)||run.ids.length>100||!run.ids.every(id=>safeId(id)&&value.reviews[id])||!object(run.answers)||Object.keys(run.answers).some(id=>!run.ids.includes(id)))throw fail('LIFE_PROGRESS_UNREADABLE');
  for(const answer of Object.values(run.answers))if(!object(answer)||typeof answer.correct!=='boolean'||typeof answer.helped!=='boolean'||!time(answer.at))throw fail('LIFE_PROGRESS_UNREADABLE');
  if(run.pendingHelp!==undefined&&(!object(run.pendingHelp)||Object.entries(run.pendingHelp).some(([id,value])=>!run.ids.includes(id)||value!==true)))throw fail('LIFE_PROGRESS_UNREADABLE');
 }
 if(value.daily!==undefined)validateDaily(value.daily);
 return value;
}

export function createLifeProgress({storage=globalThis.localStorage,owner='guest',now=Date.now,uuid=()=>crypto.randomUUID(),onChange=()=>{},guard=()=>{},mode='local',scoped=mode==='account',save=null,getSaveStatus=null}={}){
 if(typeof owner!=='string'||!owner||owner.length>200)throw TypeError('Life progress owner required');
 const key=scoped?LIFE_PROGRESS_KEY:`${LIFE_PROGRESS_KEY}:${encodeURIComponent(owner)}`;
 let state=empty(owner),stopped=false,readError=null,writeError=null,saving=null;
 const lessons=new Map(),questions=new Map();
 const check=()=>{guard();if(stopped)throw fail('ACCOUNT_CHANGED','이 계정의 생활 한국어 연결이 끝났어요.');};
 try{const raw=storage.getItem(key);if(raw!==null){state=validate(raw,owner);backfillDaily(state);}}catch(error){readError=error?.code?error:fail('LIFE_PROGRESS_UNREADABLE','이 기기의 진도를 확인하지 못했어요. 기존 기록은 보존했어요.');}
 function status(){
  let transport=null;try{transport=getSaveStatus?.();}catch{}
  const phase=readError?'unreadable':writeError?'unsaved':scoped?(transport?.rejected?'unsaved':transport?.phase||'saving'):'device';
  return {owner,phase,scoped,saved:phase==='device'||phase==='synced',pending:transport?.pending||0,rejected:transport?.rejected||0,code:readError?.code||writeError?.code||transport?.code,
   message:readError?'기존 진도를 읽지 못했어요. 원본 기록은 보존했어요.':writeError?'진도를 저장하지 못했어요. 화면의 진행은 유지하고 있어요.':scoped?(transport?.message||'계정에 생활 한국어 진도를 저장하고 있어요.'):'이 기기에 저장돼요.'};
 }
 const emit=()=>{try{onChange(api);}catch{/* Views cannot change ownership. */}};
 function checkDailyWrite(){
  check();if(readError)throw readError;
  const value=status();let transport;try{transport=getSaveStatus?.();}catch{}
  if(transport?.phase)value.phase=transport.phase;
  if(value.rejected)throw fail('LIFE_PROGRESS_REJECTED','보관된 진도를 먼저 확인해 주세요.');
  if(value.phase==='loading')throw fail('LIFE_PROGRESS_LOADING','진도를 불러오고 있어요.');
  if(value.phase==='conflict')throw fail('REVISION_CONFLICT','사용할 진도를 먼저 선택해 주세요.');
  if(value.phase==='unreadable')throw fail('LIFE_PROGRESS_UNREADABLE','기존 진도를 먼저 확인해 주세요.');
  if(value.phase==='stopped')throw fail('ACCOUNT_CHANGED','이 계정의 생활 한국어 연결이 끝났어요.');
 }
 function commit(next){
  check();if(readError)throw fail('LIFE_PROGRESS_UNREADABLE','기존 진도를 확인하지 못했어요. 원본을 덮어쓰지 않았어요.');
  next.revision=state.revision+1;
  fitDailyRecord(next);
  try{storage.setItem(key,JSON.stringify(next));writeError=null;state=next;}
  catch(error){
   // A conflict must retain the host's two alternatives. Device/quota failures
   // keep this view's draft available for an explicit retry/export.
   if(['REVISION_CONFLICT','ACCOUNT_CHANGED','PLAY_SESSION_ENDED'].includes(error.code))throw error;
   state=next;writeError=error?.code?error:fail('LIFE_STORAGE_UNAVAILABLE');
  }
  emit();return status();
 }
 function register(lesson){
  if(!object(lesson)||!safeId(lesson.id)||!safeId(lesson.packId)||!Array.isArray(lesson.questions)||!lesson.questions.length)throw TypeError('Life lesson required');
  if(lesson.questions.some(q=>!safeId(q.id)||!safeId(q.skillId)||!safeId(q.review?.id)))throw TypeError('Stable question and review ids required');
  lessons.set(lesson.id,lesson);for(const question of lesson.questions)questions.set(question.id,{...question,lessonId:lesson.id,packId:lesson.packId});return lesson;
 }
 function catalog(packs=[],flat=[]){
  for(const lesson of flat)register(lesson);
  for(const pack of packs)for(const lesson of pack.lessons||[])if(object(lesson))register({...lesson,packId:lesson.packId||pack.id});
 }
 function lessonState(id){
  check();const saved=state.lessons[id],lesson=lessons.get(id),ids=lesson?.questions.map(q=>q.id)||saved?.questionIds||[];
  const cursor=ids.findIndex(qid=>!saved?.answers[qid]);
  const position=cursor<0?ids.length:cursor,stage=clone(saved?.stage||{phase:'intro',sceneIndex:0,questionIndex:0,helped:false});
  if(!stage.cafe&&stage.phase==='questions'&&stage.questionIndex!==position)stage.helped=false;
  return {id,status:!saved?'new':saved.completedAt!==null?'completed':'started',cursor:position,total:ids.length,answers:clone(saved?.answers||{}),stage,attemptId:saved?.attemptId||null,completedAt:saved?.completedAt??null};
 }
 function startLesson(value,{replay=false}={}){
  check();const lesson=object(value)?register(value):lessons.get(value);if(!lesson)throw TypeError('Unknown life lesson');
  const previous=state.lessons[lesson.id];
  if(!previous||replay){const next=clone(state);next.lessons[lesson.id]={attemptId:uuid(),startedAt:now(),completedAt:previous?.completedAt??null,stage:{phase:'intro',sceneIndex:0,questionIndex:0},questionIds:lesson.questions.map(q=>q.id),answers:{}};next.activeLessonId=lesson.id;commit(next);}
  else if(state.activeLessonId!==lesson.id){const next=clone(state);next.activeLessonId=lesson.id;commit(next);}
  return lessonState(lesson.id);
 }
 function stageValue(id,run,{phase,sceneIndex=0,questionIndex=0,helped=false,cafe}={}){
  if(!run||!['intro','story','questions'].includes(phase)||!time(sceneIndex)||!time(questionIndex)||sceneIndex>100||questionIndex>run.questionIds.length||typeof helped!=='boolean')throw TypeError('Invalid lesson stage');
  if(cafe!==undefined&&(!isCafeLesson(id)||phase!=='questions'||!isCafeCheckpoint(cafe,id)||questionIndex!==cafe.step||sceneIndex!==cafe.step||cafe.phase==='complete'&&run.questionIds.some(qid=>!run.answers[qid])))throw TypeError('Invalid cafe stage');
  return {phase,sceneIndex,questionIndex,helped,...(cafe!==undefined?{cafe:clone(cafe)}:{})};
 }
 function setStage(id,value={}){
  check();const next=clone(state);next.lessons[id].stage=stageValue(id,next.lessons[id],value);commit(next);return lessonState(id);
 }
 function recordAnswer({lessonId,questionId,question,correct,helped=false,choiceId=null,stage,order,input}={}){
  check();if(question)questionId=question.id;
  const run=state.lessons[lessonId],q=questions.get(questionId)||question;
  if(!run||!q||!safeId(q.skillId)||!safeId(q.review?.id)||!run.questionIds.includes(questionId)||q.lessonId&&q.lessonId!==lessonId||typeof correct!=='boolean'||typeof helped!=='boolean'||choiceId!==null&&!safeId(choiceId))throw TypeError('Invalid life answer');
  if(order!==undefined&&(lessonId!==CAFE_COMPOSE_ID||questionId!=='cafe-compose-order'||!isCafeOrder(order,{complete:true}))||input!==undefined&&(!isCafeLesson(lessonId)||!isCafeListen(input)||input.mode==='listen'&&!input.heard&&!input.textShown))throw TypeError('Invalid cafe response');
  if(run.answers[questionId])return {...lessonState(lessonId),duplicate:true};
  helped=helped||input?.mode==='listen'&&input.textShown||run.stage?.phase==='questions'&&run.stage?.questionIndex===run.questionIds.indexOf(questionId)&&run.stage?.helped===true;
  const at=now(),next=clone(state),id=q.review.id,old=next.reviews[id];
  next.lessons[lessonId].answers[questionId]={correct,helped,choiceId,at,...(order!==undefined?{order:clone(order)}:{}),...(input!==undefined?{input:clone(input)}:{})};
  // The first response and its physical cafe state share one storage write.
  if(stage!==undefined)next.lessons[lessonId].stage=stageValue(lessonId,next.lessons[lessonId],stage);
  const difficult=!correct||helped;
  // Lesson replay cannot reschedule a transfer review. A new difficult answer
  // may only pull its appointment forward; spacing grows in answerReview alone.
  const dueAt=old?(difficult?Math.min(old.dueAt,at+MINUTE):old.dueAt):at+(difficult?MINUTE:DAY);
  next.reviews[id]={id,questionId,lessonId,packId:q.packId||lessons.get(lessonId)?.packId,skillId:q.skillId,dueAt,lastAt:at,
   streak:difficult?0:old?.streak??0,lapses:(old?.lapses||0)+(difficult?1:0),intervalDays:difficult?0:old?.intervalDays??1};
  dailyObservation(next,{questionId,lessonId,at,correct,helped});
  commit(next);return {...lessonState(lessonId),duplicate:false};
 }
 function finishLesson(id){
  check();const run=state.lessons[id];if(!run)throw TypeError('Unknown started lesson');
  if(run.questionIds.some(qid=>!run.answers[qid]))throw fail('LIFE_LESSON_INCOMPLETE','아직 남은 문제가 있어요.');
  if(run.stage?.cafe&&run.stage.cafe.phase!=='complete')throw fail('LIFE_CAFE_NOT_RECEIVED','아직 음료를 받지 않았어요. 컵을 받고 이어가 주세요.');
  const duplicate=run.completedAt!==null,next=clone(state);
  if(!duplicate)next.lessons[id].completedAt=now();
  if(next.activeLessonId===id)next.activeLessonId=null;
  if(!duplicate||state.activeLessonId===id)commit(next);
  return {id,completed:true,duplicate,completedAt:next.lessons[id].completedAt,totalCompleted:Object.values(state.lessons).filter(v=>v.completedAt!==null).length};
 }
 function dueReviews(limit=100){check();return Object.values(state.reviews).filter(v=>v.dueAt<=now()).sort((a,b)=>a.dueAt-b.dueAt||a.id.localeCompare(b.id)).slice(0,Math.max(0,Math.min(100,limit))).map(clone);}
 function startReview(limit=6,preferredId=null){
  check();const existing=state.activeReview;
  if(existing&&existing.ids.some(id=>!existing.answers[id]))return clone(existing);
  const due=dueReviews(100);if(preferredId){const index=due.findIndex(r=>r.id===preferredId);if(index>0)due.unshift(...due.splice(index,1));}
  const next=clone(state),ids=due.slice(0,Math.max(0,Math.min(100,limit))).map(v=>v.id);if(!ids.length)return null;
  next.activeReview={id:uuid(),startedAt:now(),ids,answers:{},pendingHelp:{}};commit(next);return clone(next.activeReview);
 }
 function markReviewHelp(id){
  check();const run=state.activeReview;if(!run||!run.ids.includes(id))throw TypeError('Invalid review help');
  if(run.answers[id]||run.pendingHelp?.[id])return clone(run);
  const next=clone(state);next.activeReview.pendingHelp={...(next.activeReview.pendingHelp||{}),[id]:true};commit(next);return clone(next.activeReview);
 }
 function answerReview({id,reviewId,questionId,correct,helped=false,runId}={}){
  check();const run=state.activeReview,keyId=id||reviewId||run?.ids.find(id=>state.reviews[id].questionId===questionId);
  if(!run||runId&&run.id!==runId||!run.ids.includes(keyId)||typeof correct!=='boolean'||typeof helped!=='boolean')throw TypeError('Invalid review answer');
  if(run.answers[keyId])return {duplicate:true,done:run.ids.every(id=>run.answers[id]),remaining:run.ids.filter(id=>!run.answers[id]).length};
  const at=now(),guided=dailyTime(at)&&state.daily?.days[lifeDayKey(at)]?.items[state.reviews[keyId].questionId]?.guidedAt!==undefined;
  helped=helped||run.pendingHelp?.[keyId]===true||guided;
  const next=clone(state),review=next.reviews[keyId],difficult=!correct||helped;
  review.streak=difficult?0:review.streak+1;review.lapses+=difficult?1:0;review.intervalDays=difficult?0:INTERVALS[Math.min(review.streak-1,INTERVALS.length-1)];review.dueAt=at+(difficult?MINUTE:review.intervalDays*DAY);review.lastAt=at;
  next.activeReview.answers[keyId]={correct,helped,at};const remaining=next.activeReview.ids.filter(id=>!next.activeReview.answers[id]).length;
  dailyObservation(next,{questionId:review.questionId,lessonId:review.lessonId,at,correct,helped});
  commit(next);return {duplicate:false,done:remaining===0,remaining,dueAt:review.dueAt,intervalDays:review.intervalDays};
 }
 function recordGuidedPractice({questionId,tutorId}={}){
  checkDailyWrite();const q=questions.get(questionId),review=q&&state.reviews[q.review.id];
  if(!q||!dailyId(questionId)||!dailyId(q.lessonId)||!TUTORS.has(tutorId)||!(state.lessons[q.lessonId]?.questionIds.includes(questionId)||review?.questionId===questionId&&review.lessonId===q.lessonId))throw TypeError('Invalid guided life practice');
  const at=now(),dayKey=lifeDayKey(at),existing=state.daily?.days[dayKey]?.items[questionId];
  if(existing?.guidedAt!==undefined&&existing.guidedAt>=Math.max(existing.observedAt??0,review?.lastAt??0))return {dayKey,item:clone(existing),duplicate:true,status:status()};
  const next=clone(state),daily=next.daily??={version:1,days:{}},day=daily.days[dayKey]??={items:{}};
  const item={...day.items[questionId],lessonId:q.lessonId,guidedAt:dailyEventTime(day,day.items[questionId],at),tutorId};
  day.items[questionId]=item;trimDaily(daily);commit(next);return {dayKey,item:clone(item),duplicate:false,status:status()};
 }
 function markDayComplete(){
  checkDailyWrite();const at=now(),dayKey=lifeDayKey(at),day=state.daily?.days[dayKey];
  if(!day||!Object.keys(day.items).length)return {dayKey,closedAt:null,duplicate:false,empty:true,status:status()};
  const latest=Math.max(...Object.values(day.items).map(dailyLatest));
  if(day.closedAt!==undefined&&day.closedAt>=latest)return {dayKey,closedAt:day.closedAt,duplicate:true,empty:false,status:status()};
  const next=clone(state),closedAt=Math.max(at,latest);next.daily.days[dayKey].closedAt=closedAt;commit(next);
  return {dayKey,closedAt,duplicate:false,empty:false,status:status()};
 }
 function summary(packs=[],flat=[]){
  check();catalog(packs,flat);const ordered=packs.flatMap(pack=>(pack.lessons||[]).map(value=>typeof value==='string'?lessons.get(value):lessons.get(value.id)).filter(Boolean));
  if(!ordered.length)ordered.push(...flat);
  const active=state.activeLessonId&&lessons.get(state.activeLessonId);
  const visits=CAFE_LESSON_IDS.map(id=>ordered.find(l=>l.id===id)).filter(Boolean),nextVisit=visits.find(l=>state.lessons[l.id]?.completedAt==null);
  const latest=Object.entries(state.lessons).filter(([id,run])=>lessons.has(id)&&run.completedAt!==null).reduce((last,[id,run])=>!last||run.completedAt>=last.at?{id,at:run.completedAt}:last,null);
  // A cafe visit opened directly should continue its own stories before sending
  // the player back to the first untouched pack. Existing record IDs stay intact.
  const cafeNext=latest&&isCafeLesson(latest.id)?nextVisit||ordered.find(l=>l.packId==='cafe'&&state.lessons[l.id]?.completedAt==null):null;
  const next=active||cafeNext||ordered.find(lesson=>state.lessons[lesson.id]?.completedAt==null)||null;
  const due=dueReviews(),total=ordered.length,completed=ordered.filter(lesson=>state.lessons[lesson.id]?.completedAt!=null).length;
  return {owner,completed,total,allCompleted:total>0&&completed===total,nextLesson:next?{...next,progress:lessonState(next.id)}:null,resume:!!active,
   cafe:{completed:visits.filter(l=>state.lessons[l.id]?.completedAt!=null).length,total:visits.length,nextNumber:next&&isCafeLesson(next.id)?CAFE_LESSON_IDS.indexOf(next.id)+1:null},
   dueCount:due.length,dueReviews:due.slice(0,6),nextReviewAt:Object.values(state.reviews).length?Math.min(...Object.values(state.reviews).map(v=>v.dueAt)):null,
   packs:packs.map(pack=>{const ids=(pack.lessons||[]).map(value=>typeof value==='string'?value:value.id);return {id:pack.id,completed:ids.filter(id=>state.lessons[id]?.completedAt!=null).length,total:ids.length};}),status:status()};
 }
 async function flush(){
  check();if(readError)throw readError;if(saving)return saving;
  saving=(async()=>{check();if(writeError){storage.setItem(key,JSON.stringify(state));writeError=null;}const result=save?await save():status();check();emit();return result;})().finally(()=>{saving=null;});return saving;
 }
 const api=Object.freeze({key,owner,status,summary,lessonState,startLesson,setStage,recordAnswer,finishLesson,dueReviews,startReview,markReviewHelp,answerReview,recordGuidedPractice,markDayComplete,flush,
  exportSnapshot(){check();return clone(state);},stop(){stopped=true;},registerLesson:register});
 return api;
}
